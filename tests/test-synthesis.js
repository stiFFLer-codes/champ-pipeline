'use strict';

// Self-check for CARTA Synthesis. node tests/test-synthesis.js

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { ingestFragment } = require('../core/src/ingestion');
const { normalizeFragment } = require('../core/src/normalization');
const { inferFragmentDateOrder } = require('../core/src/inference');
const { synthesize, groupIntoReconciliationClusters } = require('../core/src/synthesis');

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'champ-syn-'));
let n = 0;
function frag(content, opts) {
  const p = path.join(tmp, `${n++}.txt`);
  fs.writeFileSync(p, content, 'utf8');
  const nor = normalizeFragment(ingestFragment(p));
  return (opts && opts.infer) ? inferFragmentDateOrder(nor) : nor;
}

// --- deduplication across fragments ----------------------------------------

{
  // The same message present in both fragments is one record in U, carrying
  // provenance from both. This is the whole reason Synthesis exists.
  const a = frag('25/01/24, 09:00 - Alice: shared message\n');
  const b = frag('25/01/24, 09:00 - Alice: shared message\n');
  const { unified, omega } = synthesize([a, b]);
  assert.strictEqual(unified.length, 1);
  assert.strictEqual(unified[0].observations, 2);
  assert.strictEqual(unified[0].provenance.length, 2, 'provenance must be the union');
  assert.strictEqual(omega.stats.duplicatesCollapsed, 1);
}

{
  // Different bodies are different messages even at the same instant.
  const a = frag('25/01/24, 09:00 - Alice: one\n');
  const b = frag('25/01/24, 09:00 - Alice: two\n');
  assert.strictEqual(synthesize([a, b]).unified.length, 2);
}

// --- the disjoint case reduces to concatenation, without special-casing -----

{
  const a = frag('25/01/24, 09:00 - Alice: early\n');
  const b = frag('26/01/24, 09:00 - Bob: later\n');
  const { unified, omega } = synthesize([a, b]);
  assert.strictEqual(unified.length, 2);
  assert.strictEqual(omega.stats.duplicatesCollapsed, 0);
  assert.ok(unified[0].tUtc < unified[1].tUtc, 'U must be chronologically ordered');
  for (const u of unified) assert.strictEqual(u.observations, 1, 'every cluster is a singleton');
}

// --- declared clustering: bounded diameter, not unbounded chaining ----------

{
  // Three records one minute apart in sequence, same sender and body. Pairwise
  // adjacent ones are within dt; the outer two are not. Unbounded connected
  // components would merge all three. Complete linkage must not.
  const mk = (t) => ({
    tUtc: t, sender: 'A', body: 'x', attachment: null, type: 'message.text',
    sourceSeq: t / 60000, provenance: { source_id: 'f', line_range: [t / 60000 + 1, t / 60000 + 1] },
  });
  const recs = [mk(0), mk(60000), mk(120000)];
  const clusters = groupIntoReconciliationClusters(recs, 60000);
  assert.strictEqual(clusters.length, 2,
    'chaining must be bounded: the outer two records are further apart than dt');
  assert.strictEqual(clusters[0].length, 2);
  assert.strictEqual(clusters[1].length, 1);
}

// --- the cross-cluster conflict criterion -----------------------------------

{
  // Three people, three different messages, one minute. This is a conversation.
  // The literal reading of Equation (12) flags 3 conflicts here; the declared
  // reading flags none.
  const f = frag(
    '25/01/24, 09:00 - Alice: are we still on\n' +
    '25/01/24, 09:00 - Bob: yes at noon\n' +
    '25/01/24, 09:00 - Carol: I will be late\n'
  );
  const { omega } = synthesize([f]);
  assert.strictEqual(omega.stats.conflicts, 0,
    'ordinary group-chat traffic must not be reported as contradiction');
}

{
  // Same body, same minute, two senders. Nothing can settle who said it.
  const f = frag(
    '25/01/24, 09:00 - Alice: who has the projector\n' +
    '25/01/24, 09:00 - Bob: who has the projector\n'
  );
  const { omega } = synthesize([f]);
  assert.strictEqual(omega.stats.conflicts, 1);
  assert.strictEqual(omega.conflicts[0].reason, 'sender-disagreement');
}

{
  // A system line has no sender, so it cannot disagree with one.
  const f = frag(
    '25/01/24, 09:00 - Messages and calls are end-to-end encrypted.\n' +
    '25/01/24, 09:00 - Alice: hello\n'
  );
  assert.strictEqual(synthesize([f]).omega.stats.conflicts, 0);
}

// --- within-cluster conflict ------------------------------------------------

{
  // Same message, congruent attachments (same file), different export FORM.
  // Congruence lets them deduplicate; the disagreement is still reported.
  const a = frag('25/01/24, 09:00 - Alice: DOC-1.pdf (file attached)\n');
  const b = frag('25/01/24, 09:00 - Alice: DOC-1.pdf (file attached)\nDOC-1.pdf\n');
  const { unified, omega } = synthesize([a, b]);
  assert.strictEqual(unified.length, 1, 'attachment form must not block deduplication');
  const within = omega.conflicts.filter((c) => c.kind === 'within-cluster');
  assert.strictEqual(within.length, 1);
  assert.strictEqual(within[0].disagreements[0].field, 'attachment.form');
}

// --- canonical records are real records, not fabrications -------------------

{
  const a = frag('25/01/24, 09:00 - Alice: shared\n');
  const b = frag('25/01/24, 09:00 - Alice: shared\n');
  const { unified } = synthesize([a, b]);
  const u = unified[0];
  // Every field of the canonical record came from one observation that actually
  // existed, rather than being mixed across observations into a record no
  // fragment ever held.
  const sources = [].concat(a.records, b.records);
  assert.ok(
    sources.some((r) => r.tUtc === u.tUtc && r.sender === u.sender && r.body === u.body),
    'the canonical record must match some real source observation'
  );
}

// --- declared parameter constraint ------------------------------------------

{
  const f = frag('25/01/24, 09:00 - Alice: x\n');
  assert.throws(
    () => synthesize([f], { dtGranularityMs: 120000, dtConflictMs: 60000 }),
    /must not exceed/,
    'dt_granularity > dt_conflict must be refused, not silently accepted'
  );
}

// --- Invariant 1: zero unaccounted loss --------------------------------------

{
  // A fragment with a quarantined record and a normalized one: both must be
  // accounted for, on their respective sides.
  const f = frag('25/01/24, 09:00 - Alice: fine\n03/04/24, 09:01 - Alice: ambiguous\n');
  const { unified, omega } = synthesize([f]);
  assert.strictEqual(unified.length, 1);
  assert.strictEqual(omega.quarantine.length, 1);
  assert.strictEqual(unified.length + omega.quarantine.length, 2);
  // synthesize() throws if Invariant 1 fails, so reaching here is the assertion.
}

// --- Invariant 3: determinism -----------------------------------------------

{
  const p1 = path.join(tmp, 'd1.txt');
  const p2 = path.join(tmp, 'd2.txt');
  fs.writeFileSync(p1, '25/01/24, 09:00 - Alice: a\n26/01/24, 09:00 - Bob: b\n', 'utf8');
  fs.writeFileSync(p2, '25/01/24, 09:00 - Alice: a\n27/01/24, 09:00 - Carol: c\n', 'utf8');
  const go = () => {
    const fs2 = [p1, p2].map((p) => normalizeFragment(ingestFragment(p)));
    return JSON.stringify(synthesize(fs2));
  };
  assert.strictEqual(go(), go());
  // And independent of the order the fragments are supplied in.
  const rev = () => {
    const fs2 = [p2, p1].map((p) => normalizeFragment(ingestFragment(p)));
    return synthesize(fs2).unified.map((u) => `${u.tUtc}|${u.sender}|${u.body}`).join(',');
  };
  const fwd = () => {
    const fs2 = [p1, p2].map((p) => normalizeFragment(ingestFragment(p)));
    return synthesize(fs2).unified.map((u) => `${u.tUtc}|${u.sender}|${u.body}`).join(',');
  };
  assert.strictEqual(fwd(), rev(), 'U must not depend on the order fragments are passed in');
}

// --- ground truth on the committed TCF pair ---------------------------------

{
  const dir = path.join(__dirname, '..', 'data', 'synthetic_fixtures', 'tcf-pair');
  const m = JSON.parse(fs.readFileSync(path.join(dir, 'manifest.json'), 'utf8'));
  const frags = m.fragments.map((x) =>
    inferFragmentDateOrder(normalizeFragment(ingestFragment(path.join(dir, x.file)))));
  const { unified, omega } = synthesize(frags);
  const systemLines = unified.filter((u) => u.type === 'system').length;
  assert.strictEqual(unified.length - systemLines, m.ground_truth_messages,
    `|U| messages should equal ground truth ${m.ground_truth_messages}`);
  assert.strictEqual(omega.stats.duplicatesCollapsed, m.overlap_messages,
    `collapsed should equal overlap ${m.overlap_messages}`);
  const ingested = frags.reduce((s, f) => s + f.records.length + f.quarantine.length, 0);
  assert.strictEqual(
    omega.stats.unifiedRecords + omega.stats.duplicatesCollapsed + omega.stats.quarantined,
    ingested, 'conservation across the whole pipeline'
  );
}

fs.rmSync(tmp, { recursive: true, force: true });
console.log('synthesis: all checks passed');
