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
  const nor = normalizeFragment(ingestFragment(p), opts && opts.zone ? { zone: opts.zone } : undefined);
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

// --- fragments from devices in different zones -----------------------------

{
  // One message sent at 09:00 UTC on 15 July 2024, exported by a phone set to
  // India time (14:30) and by one set to London time (10:00, BST).
  const f1 = '15/07/24, 14:30 - Alice: on my way\n';
  const f2 = '15/07/24, 10:00 - Alice: on my way\n';
  // Declared wrongly (left at the default for both): two instants, two records.
  assert.strictEqual(synthesize([frag(f1), frag(f2)]).unified.length, 2,
    'a wrong zone declaration must visibly defeat deduplication, not be papered over');
  // Declared correctly: one instant, one message.
  const right = [frag(f1, { zone: 'Asia/Kolkata' }), frag(f2, { zone: 'Europe/London' })];
  assert.strictEqual(right[0].zone.name, 'Asia/Kolkata', 'the zone is recorded as declared');
  const { unified } = synthesize(right);
  assert.strictEqual(unified.length, 1);
  assert.strictEqual(unified[0].observations, 2);
  assert.strictEqual(new Date(unified[0].tUtc).toISOString(), '2024-07-15T09:00:00.000Z');
}

// --- zone-offset advisory: report-only ---------------------------------------

{
  // F1 was exported in India time (+05:30) and left at the default; F2 in UTC.
  // Three messages agree on everything but the instant, by the same +05:30.
  const f1 = '15/07/24, 14:30 - Alice: a\n15/07/24, 15:00 - Bob: b\n15/07/24, 16:10 - Alice: c\n';
  const f2 = '15/07/24, 09:00 - Alice: a\n15/07/24, 09:30 - Bob: b\n15/07/24, 10:40 - Alice: c\n';
  const wrong = [frag(f1), frag(f2)];
  const { unified, omega } = synthesize(wrong);
  assert.strictEqual(unified.length, 6, 'the advisory reports; it does not deduplicate');
  assert.strictEqual(omega.stats.advisories, 1);
  const adv = omega.advisories[0];
  assert.strictEqual(adv.kind, 'zone_offset_suspected');
  assert.deepStrictEqual([adv.support, adv.supportAtZero, adv.maxControlSupport, adv.distinctKeys, adv.examples.length], [3, 0, 0, 3, 3]);
  // offset = t(second) - t(first); the pair is listed in sha256 order.
  assert.strictEqual(adv.offset, adv.fragments[0] === wrong[0].sourceId ? '-05:30' : '+05:30');
  assert.deepStrictEqual(adv.fragments.slice().sort(), [wrong[0].sourceId, wrong[1].sourceId].sort());
  const zp = omega.params.zoneAdvisory;
  assert.deepStrictEqual([zp.stepMinutes, zp.maxOffsetHours, zp.minSupport, zp.minDistinctKeys], [15, 26, 3, 3],
    'its parameters are declared in Omega');
  // U is byte-identical with the advisory switched off.
  const off = synthesize(wrong, { zoneAdvisory: { minSupport: Infinity } });
  assert.strictEqual(off.omega.advisories.length, 0);
  assert.strictEqual(JSON.stringify(off.unified), JSON.stringify(unified));
  // Declared correctly: deduplicated, nothing to advise.
  const right = synthesize([frag(f1, { zone: '+05:30' }), frag(f2)]);
  assert.deepStrictEqual([right.unified.length, right.omega.advisories.length], [3, 0]);
}

{
  // Below minSupport: two shifted pairs are not enough.
  const f1 = '15/07/24, 14:30 - Alice: a\n15/07/24, 15:00 - Bob: b\n';
  const f2 = '15/07/24, 09:00 - Alice: a\n15/07/24, 09:30 - Bob: b\n';
  assert.strictEqual(synthesize([frag(f1), frag(f2)]).omega.advisories.length, 0);
  // Support at d = 0 that matches the shifted support blocks it, and a time
  // difference that is not a multiple of 15 minutes never counts.
  const g1 = '15/07/24, 09:00 - A: p\n15/07/24, 09:01 - A: q\n15/07/24, 09:02 - A: r\n' +
    '15/07/24, 10:00 - A: s\n15/07/24, 10:01 - A: t\n15/07/24, 10:02 - A: u\n15/07/24, 12:00 - A: v\n';
  const g2 = '15/07/24, 09:00 - A: p\n15/07/24, 09:01 - A: q\n15/07/24, 09:02 - A: r\n' +
    '15/07/24, 11:00 - A: s\n15/07/24, 11:01 - A: t\n15/07/24, 11:02 - A: u\n15/07/24, 12:07 - A: v\n';
  assert.strictEqual(synthesize([frag(g1), frag(g2)]).omega.advisories.length, 0, '3 at +01:00 does not beat 3 at zero');
}

{
  // Matches, not pairs: three identical "ok" in one minute on each side are 3
  // matches (9 pairs), all from one key, which is below minDistinctKeys.
  const ok3 = (hhmm) => `15/07/24, ${hhmm} - A: ok\n`.repeat(3);
  assert.strictEqual(synthesize([frag(ok3('14:30')), frag(ok3('09:00'))]).omega.advisories.length, 0,
    'one repeated message cannot carry an advisory alone');
  // A control offset (not a multiple of 15 minutes) with more support blocks
  // the candidate: 3 keys at 5:30, 4 keys at 7 minutes.
  const c1 = '15/07/24, 14:30 - A: a\n15/07/24, 14:31 - A: b\n15/07/24, 14:32 - A: c\n' +
    '15/07/24, 16:00 - B: w\n15/07/24, 16:01 - B: x\n15/07/24, 16:02 - B: y\n15/07/24, 16:03 - B: z\n';
  const c2 = '15/07/24, 09:00 - A: a\n15/07/24, 09:01 - A: b\n15/07/24, 09:02 - A: c\n' +
    '15/07/24, 15:53 - B: w\n15/07/24, 15:54 - B: x\n15/07/24, 15:55 - B: y\n15/07/24, 15:56 - B: z\n';
  assert.strictEqual(synthesize([frag(c1), frag(c2)]).omega.advisories.length, 0, '3 at 5:30 does not beat 4 at 7 minutes');
}

{
  // A 26-hour shift (+14:00 rendered against -12:00) is inside the window, and
  // every passing offset is reported, the best supported first.
  const d1 = '16/07/24, 11:00 - A: a\n16/07/24, 11:01 - A: b\n16/07/24, 11:02 - A: c\n16/07/24, 11:03 - A: d\n';
  const d2 = '15/07/24, 09:00 - A: a\n15/07/24, 09:01 - A: b\n15/07/24, 09:02 - A: c\n15/07/24, 09:03 - A: d\n';
  const wide = synthesize([frag(d1), frag(d2)]).omega.advisories;
  assert.deepStrictEqual(wide.map((a) => [a.offset.slice(1), a.support]), [['26:00', 4]]);
  const m1 = d1 + '20/07/24, 15:30 - B: e\n20/07/24, 15:31 - B: f\n20/07/24, 15:32 - B: g\n';
  const m2 = d2 + '20/07/24, 10:00 - B: e\n20/07/24, 10:01 - B: f\n20/07/24, 10:02 - B: g\n';
  const both = synthesize([frag(m1), frag(m2)]).omega.advisories;
  assert.deepStrictEqual(both.map((a) => [a.offset.slice(1), a.support]), [['26:00', 4], ['05:30', 3]]);
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

// --- repeated identical messages: one observation per fragment per cluster --

{
  // Within ONE fragment, two identical lines are two messages. (Under CARTA
  // 1.0 complete linkage they collapsed into one record of U.)
  const f = frag('25/01/24, 09:00 - Alice: ok\n25/01/24, 09:00 - Alice: ok\n');
  const { unified, omega } = synthesize([f]);
  assert.strictEqual(unified.length, 2, 'repeats within a fragment must not collapse');
  for (const u of unified) assert.strictEqual(u.observations, 1);
  assert.strictEqual(omega.stats.dedupAmbiguities, 0);
  // The CARTA 1.0 procedure stays selectable, and still collapses them.
  assert.strictEqual(synthesize([f], { clustering: 'complete' }).unified.length, 1);
}

{
  // Across fragments, equal counts: matched one-to-one, k-th with k-th in
  // source order, and nothing to report.
  const a = frag('25/01/24, 09:00 - Alice: ok\n25/01/24, 09:00 - Alice: ok\n');
  const b = frag('25/01/24, 09:00 - Alice: ok\n25/01/24, 09:00 - Alice: ok\n');
  const { unified, omega } = synthesize([a, b]);
  assert.strictEqual(unified.length, 2);
  for (const u of unified) assert.strictEqual(u.observations, 2);
  assert.deepStrictEqual(unified.map((u) => u.provenance.map((p) => p.line_range[0])), [[1, 1], [2, 2]],
    'the k-th observation in each fragment pairs with the k-th in the other');
  assert.strictEqual(omega.stats.dedupAmbiguities, 0);
}

{
  // Across fragments, unequal counts: F1 saw the message twice, F2 once.
  // Which of F1's two is F2's one cannot be observed, so the pairing is a
  // declared choice and the run is reported rather than resolved silently.
  const a = frag('25/01/24, 09:00 - Alice: ok\n25/01/24, 09:00 - Alice: ok\n');
  const b = frag('25/01/24, 09:00 - Alice: ok\n');
  const { unified, omega } = synthesize([a, b]);
  assert.strictEqual(unified.length, 2);
  assert.deepStrictEqual(unified.map((u) => u.observations).sort(), [1, 2]);
  assert.strictEqual(omega.dedup_ambiguities.length, 1);
  const amb = omega.dedup_ambiguities[0];
  assert.deepStrictEqual(amb.countsByFragment, { [a.sourceId]: 2, [b.sourceId]: 1 });
  assert.deepStrictEqual(amb.records, unified.map((u) => u.id));
  assert.strictEqual(amb.observations.length, 3);
}

{
  // The three procedures on one chain: one sender repeating one body a minute
  // apart, with dt = 1 minute. Single linkage chains all three; complete
  // linkage bounds the diameter; one-to-one keeps one fragment's repeats apart.
  const f = frag('25/01/24, 09:00 - A: x\n25/01/24, 09:01 - A: x\n25/01/24, 09:02 - A: x\n');
  const sizes = (clustering) => synthesize([f], { dtGranularityMs: 60000, clustering }).unified.length;
  assert.deepStrictEqual([sizes('single'), sizes('complete'), sizes('one-to-one')], [1, 2, 3]);
  assert.throws(() => synthesize([f], { clustering: 'average' }), /unknown clustering/);
}

{
  // One name for two fragments would make provenance ambiguous: refused.
  const a = frag('25/01/24, 09:00 - Alice: x\n');
  assert.throws(() => synthesize([a, Object.assign({}, a)]), /share the source_id/);
}

{
  // Two exports from two phones carry the same file name. Refused by default;
  // reconstructed together once each is given an id with --source-id.
  const { execFileSync } = require('child_process');
  const name = 'WhatsApp Chat with Contact B.txt';
  const files = ['p1', 'p2'].map((d, i) => {
    fs.mkdirSync(path.join(tmp, d));
    const p = path.join(tmp, d, name);
    fs.writeFileSync(p, `25/01/24, 09:0${i} - Alice: from ${d}\n`, 'utf8');
    return p;
  });
  const cli = path.join(__dirname, '..', 'scripts', 'reconstruct.js');
  const run = (args) => execFileSync(process.execPath, [cli, ...args], { encoding: 'utf8', stdio: 'pipe' });
  assert.throws(() => run(files), /share the source_id/);
  const { omega } = JSON.parse(run(['--json', '--source-id', 'phone-A', files[0], '--source-id', 'phone-B', files[1]]));
  assert.deepStrictEqual(omega.fragments.map((f) => [f.id, f.idSource]).sort(), [['phone-A', 'declared'], ['phone-B', 'declared']]);
  assert.strictEqual(omega.stats.unifiedRecords, 2);
  // An id names only the fragment right after it, and must name one.
  assert.throws(() => run(['--source-id', 'phone-A', files[0], '--source-id', 'phone-B']), /must be followed/);
  assert.throws(() => run(['--source-id', 'phone-A', files[0], files[1], '--source-id']), /needs an id/);
  assert.strictEqual(JSON.parse(run(['--json', '--source-id', 'x', files[0]])).omega.fragments[0].idSource, 'declared');
  assert.strictEqual(JSON.parse(run(['--json', files[0]])).omega.fragments[0].idSource, 'file-name');
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

{
  // Two messages in the same minute that the fragments put in opposite
  // orders: no single total order respects both, and that is reported.
  const a = frag('25/01/24, 09:00 - Alice: x\n25/01/24, 09:00 - Bob: y\n');
  const b = frag('25/01/24, 09:00 - Bob: y\n25/01/24, 09:00 - Alice: x\n');
  const { unified, omega } = synthesize([a, b]);
  assert.strictEqual(unified.length, 2);
  assert.strictEqual(omega.conflicts.length, 1);
  assert.strictEqual(omega.conflicts[0].reason, 'ordering-unsatisfiable');
  assert.deepStrictEqual(omega.conflicts[0].records.slice().sort(), unified.map((u) => u.id).sort());
  // The same two messages in the same order in both fragments: no conflict.
  const c = frag('25/01/24, 09:00 - Alice: x\n25/01/24, 09:00 - Bob: y\n');
  assert.strictEqual(synthesize([a, c]).omega.stats.conflicts, 0);
}

// --- within-cluster conflict ------------------------------------------------

{
  // A cluster whose members disagree on type. Built from normalized records
  // directly, because parsed input cannot produce one: type is a function of
  // sender (null only for system lines), body and attachment presence, all of
  // which ~dedup already requires to agree. The check is a guard, and this
  // exercises it.
  const mk = (id, hex, type) => {
    const sha256 = hex.repeat(64);
    const provenance = { source_id: id, line_range: [1, 1], sha256, record_sha256: sha256 };
    return {
      sourceId: id, sha256, quarantine: [],
      records: [{ tUtc: 0, dateOrder: 'DMY', sender: 'A', type, body: '', attachment: null, sourceSeq: 0, provenance }],
    };
  };
  const { unified, omega } = synthesize([mk('a.txt', '1', 'message.text'), mk('b.txt', '2', 'message.empty')]);
  assert.strictEqual(unified.length, 1);
  assert.deepStrictEqual(omega.conflicts[0].disagreements, [{ field: 'type', values: ['message.empty', 'message.text'] }]);
}

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

{
  // The trailing-period variant lost the extension. The same attachment in a
  // standard and a trailing-period rendering is still one message (before
  // CARTA 1.1 it appeared twice in U, with no conflict), and the form
  // disagreement is reported.
  const a = frag('25/01/24, 09:00 - Alice: IMG-20240125-WA0001.jpg (file attached)\n');
  const b = frag('25/01/24, 09:00 - Alice: IMG-20240125-WA0001. (file attached)\n');
  const { unified, omega } = synthesize([a, b]);
  assert.strictEqual(unified.length, 1, 'standard and trailing-period renderings must deduplicate');
  assert.deepStrictEqual(omega.conflicts[0].disagreements,
    [{ field: 'attachment.form', values: ['standard', 'trailing-period'] }]);
}

{
  // Stems are compared only when a trailing-period rendering is involved.
  // Two full names that share a stem are two files.
  const a = frag('25/01/24, 09:00 - Alice: report.pdf (file attached)\n');
  const b = frag('25/01/24, 09:00 - Alice: report.docx (file attached)\n');
  assert.strictEqual(synthesize([a, b]).unified.length, 2);
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

{
  // The representative must not depend on what the files are called. The same
  // two fragments under swapped names yield the same canonical record. (Under
  // the CARTA 1.0 source_id tie-break it followed whichever name sorted first.)
  const dmy = '25/01/24, 09:00 - Alice: shared\n';
  const mdy = '01/25/24, 09:00 - Alice: shared\n';
  const run = (nameDmy, nameMdy) => {
    const d = fs.mkdtempSync(path.join(tmp, 'rename-'));
    fs.writeFileSync(path.join(d, nameDmy), dmy);
    fs.writeFileSync(path.join(d, nameMdy), mdy);
    const u = synthesize([nameDmy, nameMdy].map((x) => normalizeFragment(ingestFragment(path.join(d, x))))).unified[0];
    return `${u.tUtc}|${u.dateOrder}|${u.body}`;
  };
  assert.strictEqual(run('a.txt', 'b.txt'), run('b.txt', 'a.txt'));
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

// --- Invariant 2: provenance references an ingested fragment -----------------

{
  // An entry whose source_id matches but whose hash does not is citing bytes
  // the run never ingested. So is an entry naming no ingested fragment.
  const tamper = (edit) => {
    const f = frag('25/01/24, 09:00 - Alice: x\n');
    f.records = f.records.map((r) => Object.assign({}, r, { provenance: Object.assign({}, r.provenance, edit) }));
    return () => synthesize([f]);
  };
  assert.throws(tamper({ sha256: '0'.repeat(64) }), /Invariant 2 violated/);
  assert.throws(tamper({ source_id: 'elsewhere.txt' }), /Invariant 2 violated/);
  assert.doesNotThrow(tamper({}));
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

// --- Omega is complete, and depends on nothing but the fragments ------------

{
  const p1 = path.join(tmp, 'o1.txt');
  const p2 = path.join(tmp, 'o2.txt');
  fs.writeFileSync(p1, '25/01/24, 09:00 - Alice: a\n03/04/24, 09:01 - Bob: amb\n', 'utf8');
  fs.writeFileSync(p2, '25/01/24, 09:00 - Alice: a\n05/06/24, 09:02 - Carol: amb\n', 'utf8');
  const go = (files) => synthesize(files.map((p) =>
    inferFragmentDateOrder(normalizeFragment(ingestFragment(p), { zone: 'Europe/London' }))));
  const { omega } = go([p1, p2]);

  assert.strictEqual(omega.spec, 'CARTA 1.1');
  const pkg = require('../core/package.json');
  assert.deepStrictEqual([omega.implementation.name, omega.implementation.version], [pkg.name, pkg.version]);
  assert.deepStrictEqual(Object.keys(omega.implementation.runtime), ['node', 'icu', 'tz']);
  for (const f of omega.fragments) {
    assert.strictEqual(f.sha256.length, 64);
    assert.deepStrictEqual(f.zone, { name: 'Europe/London', kind: 'iana', source: 'declared' });
    assert.ok(f.inference && Array.isArray(f.inference.evidence.witnesses), 'the inference report is in Omega');
  }
  assert.deepStrictEqual(omega.normalization.reasonCodes.map((r) => r.code), [
    'UNSUPPORTED_FORMAT', 'INVALID_ENCODING', 'MALFORMED_TIMESTAMP',
    'AMBIGUOUS_DATE_FORMAT', 'AMBIGUOUS_LOCAL_TIME', 'UNRESOLVED_SENDER',
  ]);
  for (const r of omega.normalization.reasonCodes) assert.ok(r.meaning, `${r.code} has no stated meaning`);
  for (const k of ['yearWindowPivot', 'typeTaxonomy', 'reasonPrecedence', 'canonicalisations']) {
    assert.ok(k in omega.normalization, `normalization policy lacks ${k}`);
  }
  for (const k of ['dtGranularityMs', 'dtConflictMs', 'clustering', 'clusteringProcedure',
    'similarity', 'attachmentCongruence', 'fieldPrecedence', 'orderTieBreak', 'zoneAdvisory']) {
    assert.ok(k in omega.params, `params lack ${k}`);
  }

  // The same fragments in the other order give the same (U, Omega), byte for
  // byte -- quarantine included -- and nothing in it names where they live.
  const json = JSON.stringify(go([p1, p2]));
  assert.strictEqual(JSON.stringify(go([p2, p1])), json, '(U, Omega) must not depend on argument order');
  assert.ok(!json.includes(path.basename(tmp)), 'no absolute or temporary paths in the output');
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

// --- generated scenarios: the run is what the generator says it must be ------

{
  // Three fragments in three zones, every knob on. The generator states the
  // outcome from what it wrote (instants, ambiguity, line positions); the
  // pipeline reads only the bytes. They must agree on every count and on the
  // exact partition of observations into U, in both modes and clusterings.
  const { buildScenario, expectedOutcome } = require('../scripts/generate-synthetic-fixtures');
  const L = require('../scripts/experiments/lib');
  const scn = buildScenario({
    seed: 5, size: 80, fragments: 3, deltaDays: 3, epsilonDays: 3, windowDays: 20, gapDays: 5,
    formats: [
      { dateOrder: 'dmy', clock: '12h', zone: '+00:00' },
      { dateOrder: 'mdy', clock: '24h', zone: '+05:30' },
      { dateOrder: 'dmy', clock: '24h', zone: '-04:00' },
    ],
    knobs: {
      a: [{ count: 3, k: [2, 4], where: 'mixed' }], b: { count: 1 }, c: { count: 1 }, d: { count: 2, form: 'mixed' },
      e: { count: 1 }, f: { fragment: 1, declaredZone: '+00:00' }, g: { p: 0.1 }, h: { count: 1 },
    },
  });
  assert.deepStrictEqual([...new Set(scn.knobs.filter((k) => k.placed).map((k) => k.knob))].sort(),
    ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'], 'every knob is exercised');
  L.withScenarioFiles(scn, (inputs) => {
    for (const infer of [true, false]) {
      for (const clustering of ['one-to-one', 'complete']) {
        const res = L.runPipeline(inputs, { infer, clustering });
        assert.deepStrictEqual(L.diffOutcome(L.outcomeOf(scn, res), expectedOutcome(scn, { infer, clustering })), [],
          `${infer ? 'infer' : 'strict'} ${clustering}`);
        assert.deepStrictEqual(L.checkInvariants(scn, inputs, res), { inv1: true, inv2: true });
      }
    }
  });
  // No knob: U is the ground truth, message for message.
  const plain = buildScenario({ seed: 5, size: 80 });
  L.withScenarioFiles(plain, (inputs) => {
    const res = L.runPipeline(inputs, { infer: true });
    const s = L.score(plain, res);
    assert.strictEqual(res.unified.filter((u) => u.sender !== null).length, plain.meta.ground_truth_messages);
    assert.ok(s.equalsGroundTruthOnSurvivors && res.omega.stats.quarantined === 0);
  });
}

// --- the split is half-open, so delta = epsilon = 0 is a partition -----------

{
  // Seed 7 puts a ground-truth message exactly on a split boundary. Under the
  // closed intervals of CARTA 1.0 it landed in both fragments at delta =
  // epsilon = 0 and the generator aborted (as did 27 other seeds in 1-20,000).
  const { buildTcfPair, mulberry32 } = require('../scripts/generate-synthetic-fixtures');
  const { meta } = buildTcfPair(mulberry32((7 ^ 0x54434650) >>> 0),
    { deltaDays: 0, epsilonDays: 0, windowDays: 120 });
  assert.strictEqual(meta.overlap_messages, 0, 'delta = epsilon = 0 must be disjoint');
  assert.strictEqual(meta.f1_message_records + meta.f2_message_records, meta.ground_truth_messages);
}

fs.rmSync(tmp, { recursive: true, force: true });
console.log('synthesis: all checks passed');
