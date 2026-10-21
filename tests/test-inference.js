'use strict';

// Self-check for fragment-scope date inference. node tests/test-inference.js
//
// This step is permitted by Section 3.3 only under conditions. The tests below
// are organised around those conditions rather than around the code's branches,
// because the conditions are what a reviewer would check.

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { ingestFragment } = require('../core/src/ingestion');
const { normalizeFragment, REASON } = require('../core/src/normalization');
const { inferFragmentDateOrder } = require('../core/src/inference');

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'champ-infer-'));
let n = 0;
function run(content, opts, policy) {
  const p = path.join(tmp, `${n++}.txt`);
  fs.writeFileSync(p, content, 'utf8');
  return inferFragmentDateOrder(normalizeFragment(ingestFragment(p), policy), opts);
}

// --- it applies when the fragment can settle itself -------------------------

{
  // 25/01 can only be day-month-year. That witness settles 03/04, which could
  // not settle itself.
  const r = run('25/01/24, 09:00 - You: witness\n03/04/24, 09:01 - You: ambiguous\n');
  assert.strictEqual(r.inference.applied, true);
  assert.strictEqual(r.inference.order, 'DMY');
  assert.strictEqual(r.inference.resolved, 1);
  assert.strictEqual(r.quarantine.length, 0);
  assert.strictEqual(r.records.length, 2);
  // Resolved under DMY: 03/04 is 3 April, not 4 March.
  const rescued = r.records.find((x) => x.inferred);
  assert.strictEqual(new Date(rescued.tUtc).toISOString(), '2024-04-03T09:01:00.000Z');
}

// --- CONSTRAINT: results stay distinguishable -------------------------------

{
  const r = run('25/01/24, 09:00 - You: witness\n03/04/24, 09:01 - You: ambiguous\n');
  const witness = r.records.find((x) => x.provenance.line_range[0] === 1);
  const rescued = r.records.find((x) => x.provenance.line_range[0] === 2);
  assert.strictEqual(witness.inferred, undefined, 'a record never in doubt must carry no inferred mark');
  assert.ok(rescued.inferred, 'a rescued record must be marked');
  assert.strictEqual(rescued.inferred.field, 'dateOrder');
  assert.strictEqual(rescued.inferred.value, 'DMY');
  assert.strictEqual(rescued.inferred.by, 'fragment-scope-inference');
  assert.ok(/unambiguous record/.test(rescued.inferred.basis), 'the mark must name its basis');
}

// --- CONSTRAINT: it reports what it inferred and on what evidence -----------

{
  const r = run('25/01/24, 09:00 - You: a\n26/01/24, 09:01 - You: b\n03/04/24, 09:02 - You: c\n');
  const inf = r.inference;
  assert.strictEqual(inf.evidence.witnessCount, 2);
  assert.deepStrictEqual(inf.evidence.byOrder, { DMY: 2 });
  // Every witness and every rescued record is located by line range, so a
  // reader can return to the bytes.
  assert.deepStrictEqual(inf.evidence.witnesses,
    [{ line_range: [1, 1], dateOrder: 'DMY' }, { line_range: [2, 2], dateOrder: 'DMY' }]);
  assert.deepStrictEqual(inf.rescued, [[3, 3]]);
  assert.strictEqual(inf.minWitnesses, 1);
  assert.ok(/established by 2 record/.test(inf.reason));
}

// --- it declines: no evidence (the fixture-03 shape) ------------------------

{
  const r = run('03/04/24, 09:00 - You: a\n05/06/24, 09:01 - You: b\n');
  assert.strictEqual(r.inference.applied, false);
  assert.ok(/no-evidence/.test(r.inference.reason));
  assert.strictEqual(r.inference.resolved, 0);
  assert.strictEqual(r.quarantine.length, 2, 'nothing may be rescued without evidence');
  assert.strictEqual(r.records.length, 0);
}

// --- it declines: split evidence --------------------------------------------

{
  // 25/01 forces DMY; 01/25 forces MDY. The fragment contradicts itself, so a
  // majority vote is not taken and nothing is inferred.
  const r = run('25/01/24, 09:00 - You: dmy\n01/25/24, 09:01 - You: mdy\n03/04/24, 09:02 - You: amb\n');
  assert.strictEqual(r.inference.applied, false);
  assert.ok(/split-evidence/.test(r.inference.reason), r.inference.reason);
  assert.strictEqual(r.quarantine.length, 1);
  assert.strictEqual(r.quarantine[0].reason, REASON.AMBIGUOUS_DATE_FORMAT);
}

// --- it declines: threshold not met -----------------------------------------

{
  const r = run('25/01/24, 09:00 - You: a\n03/04/24, 09:01 - You: b\n', { minWitnesses: 5 });
  assert.strictEqual(r.inference.applied, false);
  assert.ok(/insufficient-evidence/.test(r.inference.reason));
}

// --- a date that is impossible under one order is never AMBIGUOUS -----------

{
  // 02/30 cannot be month-day, so it is not ambiguous at all: Normalization
  // resolves it as day-month or rejects it. Either way this step never sees it,
  // which is why the module's "order failed to apply" path is unreachable.
  const r = run('01/25/24, 09:00 - You: witness\n02/30/24, 09:01 - You: not ambiguous\n');
  assert.strictEqual(r.inference.candidates, 0, '02/30 must not reach inference as a candidate');
}

{
  // The property that makes the unreachable path unreachable, stated directly:
  // every AMBIGUOUS_DATE_FORMAT record resolves under BOTH orderings, because
  // ambiguity means both fields are in 1..12 and every month has a 12th.
  const { resolveTimestamp, DEFAULT_POLICY } = require('../core/src/normalization');
  let checked = 0;
  for (let a = 1; a <= 12; a++) {
    for (let b = 1; b <= 12; b++) {
      const s = `${String(a).padStart(2, '0')}/${String(b).padStart(2, '0')}/24, 09:00`;
      assert.strictEqual(resolveTimestamp(s, DEFAULT_POLICY).reason, REASON.AMBIGUOUS_DATE_FORMAT);
      assert.strictEqual(resolveTimestamp(s, DEFAULT_POLICY, 'DMY').ok, true, `DMY failed on ${s}`);
      assert.strictEqual(resolveTimestamp(s, DEFAULT_POLICY, 'MDY').ok, true, `MDY failed on ${s}`);
      checked++;
    }
  }
  assert.strictEqual(checked, 144);
}

// --- it consumes only AMBIGUOUS_DATE_FORMAT ---------------------------------

{
  // The orphan line must come first: a non-header line in the middle of a file
  // is a continuation of the record above it, not an unparsed record of its own.
  const r = run('orphan line\n25/01/24, 09:00 - You: witness\n03/04/24, 09:02 - You: amb\n');
  assert.strictEqual(r.inference.applied, true);
  assert.strictEqual(r.inference.resolved, 1);
  assert.strictEqual(r.quarantine.length, 1);
  assert.strictEqual(r.quarantine[0].reason, REASON.UNSUPPORTED_FORMAT,
    'a record quarantined for another reason must be left alone');
}

{
  // A record that is date-ambiguous AND senderless carries AMBIGUOUS_DATE_FORMAT
  // as its primary code by precedence. Settling the date would leave it
  // senderless, so it is not a candidate and must stay quarantined. (Before
  // CARTA 1.1 it was rescued into U with sender null.)
  const r = run('25/01/24, 09:00 - You: witness\n03/04/24, 09:01 - : body\n');
  assert.strictEqual(r.inference.applied, true);
  assert.strictEqual(r.inference.candidates, 0);
  assert.strictEqual(r.inference.resolved, 0);
  assert.strictEqual(r.records.length, 1);
  assert.strictEqual(r.quarantine.length, 1);
  assert.strictEqual(r.quarantine[0].reason, REASON.AMBIGUOUS_DATE_FORMAT);
  assert.deepStrictEqual(r.quarantine[0].alsoFailed, [REASON.UNRESOLVED_SENDER]);
}

{
  // The order settles 03/11/24 as 3 November, but in New York 01:30 that day
  // happened twice (DST ended). The record stays in Q, now for the reason that
  // still applies, and the report says so.
  const r = run('25/01/24, 09:00 - You: witness\n03/11/24, 01:30 - You: amb\n', undefined,
    { zone: 'America/New_York' });
  assert.strictEqual(r.inference.order, 'DMY');
  assert.strictEqual(r.inference.resolved, 0);
  assert.strictEqual(r.quarantine.length, 1);
  assert.strictEqual(r.quarantine[0].reason, REASON.AMBIGUOUS_LOCAL_TIME);
  assert.strictEqual(r.quarantine[0].dateOrderInferred, 'DMY');
  assert.deepStrictEqual(r.inference.requarantined, [{ line_range: [2, 2], reason: REASON.AMBIGUOUS_LOCAL_TIME }]);
  assert.deepStrictEqual(r.stats.byReason, { AMBIGUOUS_LOCAL_TIME: 1 });
}

// --- conservation across the step -------------------------------------------

{
  const dirs = [
    path.join(__dirname, '..', 'data', 'synthetic_fixtures'),
    path.join(__dirname, '..', 'data', 'synthetic_fixtures', 'tcf-pair'),
  ];
  let seen = 0;
  for (const dir of dirs) {
    for (const f of fs.readdirSync(dir).filter((x) => x.endsWith('.txt'))) {
      const ing = ingestFragment(path.join(dir, f));
      const nor = normalizeFragment(ing);
      const inf = inferFragmentDateOrder(nor);
      assert.strictEqual(
        inf.records.length + inf.quarantine.length,
        ing.records.length,
        `conservation failed on ${f}`
      );
      // Records stay in source order after rescued ones are folded back in.
      for (let i = 1; i < inf.records.length; i++) {
        assert.ok(inf.records[i].sourceSeq > inf.records[i - 1].sourceSeq, `order broken in ${f}`);
      }
      seen++;
    }
  }
  assert.strictEqual(seen, 7, `expected 7 fragments, saw ${seen}`);
}

// --- the inferred order must match what the corpus actually used ------------

{
  const dir = path.join(__dirname, '..', 'data', 'synthetic_fixtures');
  const manifest = JSON.parse(fs.readFileSync(path.join(dir, 'manifest.json'), 'utf8'));
  for (const f of manifest.fixtures) {
    const declared = f.quirks.includes('date-format-ddmmyy') ? 'DMY' : 'MDY';
    const r = inferFragmentDateOrder(normalizeFragment(ingestFragment(path.join(dir, f.file))));
    if (r.inference.applied) {
      assert.strictEqual(r.inference.order, declared,
        `inferred ${r.inference.order} but the generator wrote ${declared} in ${f.file}`);
    }
  }
}

// --- fixture-03 is the corpus's own boundary case ---------------------------

{
  const p = path.join(__dirname, '..', 'data', 'synthetic_fixtures',
    'fixture-03-group-chat-encryption-and-membership.txt');
  const r = inferFragmentDateOrder(normalizeFragment(ingestFragment(p)));
  assert.strictEqual(r.inference.applied, false,
    'fixture-03 has no self-disambiguating record; inference must decline');
  assert.strictEqual(r.records.length, 0);
  assert.ok(r.quarantine.length > 0);
}

// --- determinism -------------------------------------------------------------

{
  const p = path.join(tmp, 'det.txt');
  fs.writeFileSync(p, '25/01/24, 09:00 - You: a\n03/04/24, 09:01 - You: b\n', 'utf8');
  const go = () => JSON.stringify(inferFragmentDateOrder(normalizeFragment(ingestFragment(p))));
  assert.strictEqual(go(), go());
}

fs.rmSync(tmp, { recursive: true, force: true });
console.log('inference: all checks passed');
