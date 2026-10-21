'use strict';

// E1: sweep. Seeds 1-100 x delta {0,1,7,14,30} d x epsilon {0,1,7} d x size
// {170, 1000, 10000}; two fragments (F1 dmy/12h, F2 mdy/24h, both +00:00),
// no knobs. Each configuration runs in --infer and in strict mode, three
// times each (run, rerun, fragments swapped).
//
//   node scripts/experiments/e1-sweep.js
//
// results/e1-sweep.csv           one row per configuration
// results/e1-summary.json        counts, and every configuration that failed
// results/timing/e1.json         wall time and machine

const L = require('./lib');
const path = require('path');
const { buildScenario, expectedOutcome } = require('../generate-synthetic-fixtures');

const GRID = {
  seeds: Array.from({ length: 100 }, (_, i) => i + 1),
  deltaDays: [0, 1, 7, 14, 30],
  epsilonDays: [0, 1, 7],
  sizes: [170, 1000, 10000],
};
const MODES = { infer: true, strict: false };

// What must hold, per mode. A configuration fails if any of these is false.
const MUST = {
  infer: ['u_equals_gt', 'oracle_match', 'inv1', 'inv2', 'deterministic', 'order_independent'],
  strict: ['partition_matches_gt', 'oracle_match', 'inv1', 'inv2', 'deterministic', 'order_independent'],
};

function one({ seed, deltaDays, epsilonDays, size }) {
  const scn = buildScenario({ seed, size, deltaDays, epsilonDays });
  const row = {
    seed, delta_days: deltaDays, epsilon_days: epsilonDays, size,
    gt_messages: scn.meta.ground_truth_messages,
    overlap_messages: scn.meta.overlap_messages,
    observations: scn.meta.observations,
  };
  L.withScenarioFiles(scn, (inputs) => {
    for (const [m, infer] of Object.entries(MODES)) {
      const e = L.evaluate(scn, inputs, { infer }, expectedOutcome(scn, { infer }));
      if (e.error) { row[`${m}_error`] = e.error; continue; }
      const s = e.res.omega.stats;
      Object.assign(row, {
        [`${m}_records_in`]: s.normalizedRecordsIn,
        [`${m}_unified`]: s.unifiedRecords,
        [`${m}_unified_messages`]: e.actual.unifiedMessages,
        [`${m}_collapsed`]: s.duplicatesCollapsed,
        [`${m}_quarantined`]: s.quarantined,
        [`${m}_conflicts`]: s.conflicts,
        [`${m}_dedup_ambiguities`]: s.dedupAmbiguities,
        [`${m}_advisories`]: s.advisories,
        [`${m}_dating_mixed`]: s.datingOfUnifiedRecords.mixed,
        [`${m}_precision`]: L.round(e.score.precision),
        [`${m}_recall`]: L.round(e.score.recall),
        [`${m}_partition_matches_gt`]: e.score.equalsGroundTruthOnSurvivors,
        [`${m}_u_equals_gt`]: e.score.equalsGroundTruthOnSurvivors && s.quarantined === 0
          && e.actual.unifiedMessages === scn.meta.ground_truth_messages,
        [`${m}_oracle_match`]: e.diff.length === 0,
        [`${m}_oracle_diff`]: e.diff.join(' '),
        [`${m}_inv1`]: e.inv1,
        [`${m}_inv2`]: e.inv2,
        [`${m}_deterministic`]: e.deterministic,
        [`${m}_order_independent`]: e.orderIndependent,
        [`${m}_error`]: '',
      });
    }
  });
  return row;
}

function summarise(rows) {
  const count = (pred) => rows.filter(pred).length;
  const failed = (r) => Object.entries(MUST).flatMap(([m, keys]) => (r[`${m}_error`] ? [`${m}_error`] : keys.filter((k) => r[`${m}_${k}`] !== true).map((k) => `${m}_${k}`)));
  const byMode = {};
  for (const m of Object.keys(MODES)) {
    byMode[m] = { configs: rows.length };
    for (const k of ['u_equals_gt', 'partition_matches_gt', 'oracle_match', 'inv1', 'inv2', 'deterministic', 'order_independent']) {
      byMode[m][k] = count((r) => r[`${m}_${k}`] === true);
    }
    byMode[m].errors = count((r) => !!r[`${m}_error`]);
    byMode[m].with_advisory = count((r) => r[`${m}_advisories`] > 0);
    byMode[m].with_conflict = count((r) => r[`${m}_conflicts`] > 0);
    byMode[m].with_dedup_ambiguity = count((r) => r[`${m}_dedup_ambiguities`] > 0);
    byMode[m].with_quarantine = count((r) => r[`${m}_quarantined`] > 0);
  }
  const bySize = {};
  for (const size of GRID.sizes) {
    const rs = rows.filter((r) => r.size === size);
    const sum = (k) => rs.reduce((a, r) => a + (r[k] || 0), 0);
    bySize[size] = {
      configs: rs.length,
      gt_messages_total: sum('gt_messages'),
      overlap_messages_total: sum('overlap_messages'),
      infer_collapsed_total: sum('infer_collapsed'),
      infer_quarantined_total: sum('infer_quarantined'),
      strict_quarantined_total: sum('strict_quarantined'),
      strict_records_in_total: sum('strict_records_in'),
      infer_u_equals_gt: rs.filter((r) => r.infer_u_equals_gt === true).length,
      strict_u_equals_gt: rs.filter((r) => r.strict_u_equals_gt === true).length,
      infer_with_advisory: rs.filter((r) => r.infer_advisories > 0).length,
    };
  }
  const failures = rows.map((r) => ({ seed: r.seed, delta_days: r.delta_days, epsilon_days: r.epsilon_days, size: r.size, failed: failed(r) }))
    .filter((f) => f.failed.length);
  return {
    experiment: 'E1 sweep',
    grid: GRID,
    fixed: 'fragments 2; F1 dmy 12h +00:00, F2 mdy 24h +00:00 (both left undeclared); windowDays 120, preDays 30, postDays 30; attachmentRate 0.05; no knobs; clustering one-to-one, dt_granularity 0, dt_conflict 60000 ms',
    must_hold: MUST,
    definitions: {
      u_equals_gt: 'no record quarantined, |U| messages = ground-truth messages, and U partitions the observations exactly as the ground truth does',
      partition_matches_gt: 'U partitions the observations that reached Synthesis exactly as the ground truth does',
      oracle_match: 'counts, conflicts by kind, dedup ambiguities, dating and the exact partition equal expectedOutcome() from the generator',
      inv1: 'every written observation is in exactly one U record or in Q, checked against the generator',
      inv2: 'every provenance entry\'s sha256 is its file\'s and record_sha256 hashes exactly its line range, checked against the files',
      deterministic: 'two runs give byte-identical (U, Omega)',
      order_independent: '(U, Omega) byte-identical with the fragments passed in the other order',
    },
    by_mode: byMode,
    by_size: bySize,
    failing_configs: failures.length,
    failures,
  };
}

async function run() {
  const items = [];
  for (const size of GRID.sizes) {
    for (const deltaDays of GRID.deltaDays) {
      for (const epsilonDays of GRID.epsilonDays) {
        for (const seed of GRID.seeds) items.push({ seed, deltaDays, epsilonDays, size });
      }
    }
  }
  const t0 = Date.now();
  const rows = await L.parallelMap(__filename, items);
  const wall = (Date.now() - t0) / 1000;
  L.writeCsv(path.join(L.RESULTS, 'e1-sweep.csv'), rows);
  const summary = summarise(rows);
  L.writeJson(path.join(L.RESULTS, 'e1-summary.json'), summary);
  L.writeJson(path.join(L.TIMING, 'e1.json'), { experiment: 'E1', configs: items.length, wallSeconds: wall, workers: Number(process.env.WP2_WORKERS) || require('os').cpus().length - 1, machine: L.machineInfo() });
  console.log(`E1: ${items.length} configs in ${wall.toFixed(0)} s; failing configs ${summary.failing_configs}`);
  return summary;
}

if (process.argv.includes('--worker')) L.serveWorker(one);
else if (require.main === module) run().catch((e) => { console.error(e); process.exit(1); });
module.exports = { run, one };
