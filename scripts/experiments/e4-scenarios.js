'use strict';

// E4: one scenario per knob, (a)-(h), each a single knob on an otherwise
// clean two-fragment timeline (size 120, delta 7 d, epsilon 7 d), run with
// --infer. (a) is shown under one-to-one and under the CARTA 1.0 complete
// linkage. Two extra (a) rows put the repeats on a fragment boundary, with
// and without overlap (beyond the brief; see WP2_REPORT).
//
//   node scripts/experiments/e4-scenarios.js
//
// Expected: a baseline run (same seed and config, knob off; the baseline
// messages are drawn before any knob, so they are the same messages) plus the
// knob's own statement in the manifest: |U| = ground truth + system lines +
// the stated delta (+ any deviation the baseline itself had), Omega entries
// and mixed dating = the baseline's + the stated ones. pass = actual equals
// that, AND the run equals the generator's full expectation (expectedOutcome,
// which also fixes the partition).
//
// results/e4-scenarios.json, results/e4-scenarios.csv

const L = require('./lib');
const path = require('path');
const { buildScenario, expectedOutcome } = require('../generate-synthetic-fixtures');

const BASE = { size: 120, deltaDays: 7, epsilonDays: 7 };
const IST = [{ dateOrder: 'dmy', clock: '12h', zone: '+00:00' }, { dateOrder: 'mdy', clock: '24h', zone: '+05:30' }];

const ROWS = [
  { row: 'a', clustering: 'one-to-one', input: 'a: k=3 identical inside the overlap, k=2 identical outside it', cfg: { seed: 11, knobs: { a: [{ k: 3, where: 'inside' }, { k: 2, where: 'outside' }] } } },
  { row: 'a', clustering: 'complete', input: 'a: the same scenario under complete linkage (CARTA 1.0)', cfg: { seed: 11, knobs: { a: [{ k: 3, where: 'inside' }, { k: 2, where: 'outside' }] } } },
  { row: 'a-boundary', clustering: 'one-to-one', input: 'a: k=3 identical in the minute holding a boundary of the overlap (2 copies before it, 1 after)', cfg: { seed: 12, knobs: { a: [{ k: 3, where: 'boundary' }] } } },
  { row: 'a-boundary-disjoint', clustering: 'one-to-one', input: 'a: k=2 identical in the minute of a boundary, delta = epsilon = 0 (1 copy in each fragment)', cfg: { seed: 13, deltaDays: 0, epsilonDays: 0, knobs: { a: [{ k: 2, where: 'boundary' }] } } },
  { row: 'b', clustering: 'one-to-one', input: 'b: one body from two senders in one minute, inside the overlap', cfg: { seed: 14, knobs: { b: { where: 'inside' } } } },
  { row: 'c', clustering: 'one-to-one', input: 'c: two messages in one minute, written in opposite orders by the two fragments', cfg: { seed: 15, knobs: { c: {} } } },
  { row: 'd', clustering: 'one-to-one', input: 'd: one attachment doubled-filename in F2, one trailing-period in F2; both standard in F1', cfg: { seed: 16, knobs: { d: [{ form: 'double-filename' }, { form: 'trailing-period' }] } } },
  { row: 'e', clustering: 'one-to-one', input: 'e: one body with " (rev)" appended in F2 (synthetic variant, not WhatsApp\'s edit rendering)', cfg: { seed: 17, knobs: { e: {} } } },
  { row: 'f', clustering: 'one-to-one', input: 'f: F2 rendered in +05:30, declared +00:00', cfg: { seed: 18, formats: IST, knobs: { f: { fragment: 1, declaredZone: '+00:00' } } } },
  { row: 'g', clustering: 'one-to-one', input: 'g: +-1 min on F2\'s copy of every overlap message, p = 1 (hypothetical clock disagreement)', cfg: { seed: 19, knobs: { g: { p: 1 } } } },
  { row: 'h', clustering: 'one-to-one', input: 'h: F2 in +05:30 (declared); one message whose date is ambiguous in one zone and not in the other', cfg: { seed: 20, formats: IST, knobs: { h: {} } } },
];

// Omega entries of a run, as "kind" -> count.
function entriesOf(omega) {
  const e = {};
  const inc = (k) => { e[k] = (e[k] || 0) + 1; };
  for (const c of omega.conflicts) {
    if (c.kind === 'within-cluster') for (const d of c.disagreements) inc(`conflict:within-cluster:${d.field}`);
    else inc(`conflict:${c.reason}`);
  }
  for (let i = 0; i < omega.dedup_ambiguities.length; i++) inc('dedup_ambiguity');
  for (const a of omega.advisories) inc(`advisory:${a.kind}`);
  for (const q of omega.quarantine) inc(`quarantine:${q.reason}`);
  return Object.fromEntries(Object.entries(e).sort());
}

function evaluateRow(r) {
  const cfg = Object.assign({}, BASE, r.cfg);
  const base = buildScenario(Object.assign({}, cfg, { knobs: {} }));
  const baseRes = L.withScenarioFiles(base, (inputs) => L.runPipeline(inputs, { infer: true, clustering: r.clustering }));
  const scn = buildScenario(cfg);
  const knobs = scn.knobs;
  const delta = knobs.reduce((s, k) => s + (r.clustering === 'complete' && k.expect.unifiedDeltaComplete !== undefined
    ? k.expect.unifiedDeltaComplete : k.expect.unifiedDelta), 0);
  const expectedEntries = entriesOf(baseRes.omega);
  for (const k of knobs) for (const [kind, n] of Object.entries(k.expect.entries)) expectedEntries[kind] = (expectedEntries[kind] || 0) + n;
  const baseMixed = baseRes.omega.stats.datingOfUnifiedRecords.mixed;
  const expectedMixed = baseMixed + knobs.reduce((s, k) => s + (k.expect.datingMixedDelta || 0), 0);
  const baseDeviation = baseRes.omega.stats.unifiedRecords - (base.meta.ground_truth_messages + base.meta.system_lines);
  const expectedU = scn.meta.ground_truth_messages + scn.meta.system_lines + delta + baseDeviation;
  return L.withScenarioFiles(scn, (inputs) => {
    const res = L.runPipeline(inputs, { infer: true, clustering: r.clustering });
    const actualEntries = entriesOf(res.omega);
    const oracleDiff = L.diffOutcome(L.outcomeOf(scn, res), expectedOutcome(scn, { infer: true, clustering: r.clustering }));
    const mixed = res.omega.stats.datingOfUnifiedRecords.mixed;
    const sorted = (o) => JSON.stringify(Object.fromEntries(Object.entries(o).sort()));
    const pass = res.omega.stats.unifiedRecords === expectedU && sorted(actualEntries) === sorted(expectedEntries)
      && mixed === expectedMixed && oracleDiff.length === 0 && knobs.every((k) => k.placed);
    return {
      row: r.row,
      clustering: r.clustering,
      input: r.input,
      config: Object.assign({}, BASE, r.cfg),
      knob_instances: knobs.map((k) => ({ knob: k.knob, placed: k.placed, items: k.items.map((m) => m.id), expect: k.expect })),
      baseline: { ground_truth_messages: base.meta.ground_truth_messages, unified: baseRes.omega.stats.unifiedRecords, entries: entriesOf(baseRes.omega), dating_mixed: baseMixed },
      ground_truth_messages: scn.meta.ground_truth_messages,
      system_lines: scn.meta.system_lines,
      expected_unified: expectedU,
      expected_entries: expectedEntries,
      expected_dating_mixed: expectedMixed,
      actual_unified: res.omega.stats.unifiedRecords,
      actual_entries: actualEntries,
      actual_dating_mixed: mixed,
      oracle_diff: oracleDiff,
      pass,
    };
  });
}

async function run() {
  const rows = ROWS.map(evaluateRow);
  L.writeJson(path.join(L.RESULTS, 'e4-scenarios.json'), { experiment: 'E4 scenario table', base: BASE, mode: '--infer, dt_granularity 0, dt_conflict 60000 ms', rows });
  const fmt = (o) => Object.entries(o).map(([k, v]) => `${k} x${v}`).join('; ') || '-';
  L.writeCsv(path.join(L.RESULTS, 'e4-scenarios.csv'), rows.map((r) => ({
    row: r.row, clustering: r.clustering, input: r.input,
    expected: `|U| ${r.expected_unified}; ${fmt(r.expected_entries)}${r.expected_dating_mixed ? `; dating.mixed ${r.expected_dating_mixed}` : ''}`,
    actual_unified: r.actual_unified,
    omega_entries: `${fmt(r.actual_entries)}${r.actual_dating_mixed ? `; dating.mixed ${r.actual_dating_mixed}` : ''}`,
    pass: r.pass ? 'pass' : 'FAIL',
  })));
  for (const r of rows) console.log(`E4 ${r.row.padEnd(20)} ${r.clustering.padEnd(10)} |U| ${r.actual_unified}/${r.expected_unified} ${r.pass ? 'pass' : 'FAIL'}`);
  return rows;
}

if (require.main === module) run().catch((e) => { console.error(e); process.exit(1); });
module.exports = { run, entriesOf };
