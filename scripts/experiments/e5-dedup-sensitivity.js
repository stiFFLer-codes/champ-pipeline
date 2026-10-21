'use strict';

// E5: deduplication sensitivity. dt_granularity {0, 60, 120, 300} s x
// clustering {one-to-one, complete, single} x repeat density {0, low, high} x
// jitter p {0, 0.1}, 30 seeds each; --infer. One scenario per (density, p,
// seed), run under all 12 (dt, clustering) settings.
//
//   node scripts/experiments/e5-dedup-sensitivity.js
//
// Scenario: size 1000, two fragments (F1 dmy/12h, F2 mdy/24h, +00:00),
// delta 14 d, epsilon 7 d, attachmentRate 0.05. Repeats are knob (a) bursts
// of 2-3 messages from one sender with one common short body ("ok", "yes",
// "lol", a thumbs-up emoji, "thanks"), spread over 0-5 minutes, anywhere on the
// timeline: low = 10 bursts, high = 50. Jitter is knob (g).
//
// dt_conflict is max(60 s, dt_granularity), because Synthesis refuses
// dt_granularity > dt_conflict.
//
// Metrics, against ground truth, over observations that reached Synthesis:
// pairwise precision / recall / F1 of "same message"; |U| messages minus
// ground-truth messages; ordering-unsatisfiable conflicts (every one is
// false here: no knob (c), and every fragment writes ground-truth order);
// dedup ambiguities. For one-to-one, also determinism (two runs) and order
// independence (fragments swapped) at every dt.
//
// results/e5-dedup-sensitivity.csv   one row per run
// results/e5-summary.json            means per cell; determinism counts
// results/timing/e5.json

const L = require('./lib');
const path = require('path');
const { buildScenario } = require('../generate-synthetic-fixtures');

const DTS = [0, 60000, 120000, 300000];
const CLUSTERINGS = ['one-to-one', 'complete', 'single'];
const DENSITY = { 0: 0, low: 10, high: 50 };
const PS = [0, 0.1];
const SEEDS = Array.from({ length: 30 }, (_, i) => i + 1);

function scenario(density, p, seed) {
  const knobs = {};
  if (DENSITY[density]) knobs.a = [{ count: DENSITY[density], k: [2, 3], where: 'any', spread: 5, common: true }];
  if (p) knobs.g = { p };
  return buildScenario({ seed, size: 1000, deltaDays: 14, epsilonDays: 7, knobs });
}

function one({ density, p, seed }) {
  const scn = scenario(density, p, seed);
  const rows = [];
  L.withScenarioFiles(scn, (inputs) => {
    for (const dt of DTS) {
      for (const clustering of CLUSTERINGS) {
        const opts = { infer: true, clustering, dtGranularityMs: dt, dtConflictMs: Math.max(60000, dt) };
        const row = { density, p, seed, dt_s: dt / 1000, clustering };
        let res;
        if (clustering === 'one-to-one') {
          const e = L.evaluate(scn, inputs, opts, null);
          if (e.error) { rows.push(Object.assign(row, { error: e.error })); continue; }
          res = e.res;
          Object.assign(row, { deterministic: e.deterministic, order_independent: e.orderIndependent, inv1: e.inv1, inv2: e.inv2 });
        } else {
          res = L.runPipeline(inputs, opts);
          Object.assign(row, { deterministic: '', order_independent: '' }, L.checkInvariants(scn, inputs, res));
        }
        const sc = L.score(scn, res);
        const st = res.omega.stats;
        const by = (reason) => res.omega.conflicts.filter((c) => c.reason === reason).length;
        rows.push(Object.assign(row, {
          gt_messages: scn.meta.ground_truth_messages,
          repeat_messages: scn.messages.filter((m) => m.knob === 'a').length,
          jittered: scn.knobs.filter((k) => k.knob === 'g').reduce((s, k) => s + k.items.length, 0),
          precision: L.round(sc.precision),
          recall: L.round(sc.recall),
          f1: L.round(sc.f1),
          tp: sc.tp,
          pred_pairs: sc.predPairs,
          gt_pairs: sc.gtPairs,
          u_minus_gt: res.unified.filter((u) => u.sender !== null).length - scn.meta.ground_truth_messages,
          ordering_conflicts: by('ordering-unsatisfiable'),
          sender_conflicts: by('sender-disagreement'),
          within_cluster_conflicts: res.omega.conflicts.filter((c) => c.kind === 'within-cluster').length,
          dedup_ambiguities: st.dedupAmbiguities,
          advisories: st.advisories,
          quarantined: st.quarantined,
          error: '',
        }));
      }
    }
  });
  return rows;
}

function summarise(rows) {
  const mean = (xs) => (xs.length ? L.round(xs.reduce((a, b) => a + b, 0) / xs.length, 4) : null);
  const cells = [];
  for (const dt of DTS) {
    for (const clustering of CLUSTERINGS) {
      for (const density of Object.keys(DENSITY)) {
        for (const p of PS) {
          const rs = rows.filter((r) => r.dt_s === dt / 1000 && r.clustering === clustering && r.density === density && r.p === p && !r.error);
          cells.push({
            dt_s: dt / 1000, clustering, density, p, runs: rs.length,
            precision: mean(rs.map((r) => r.precision)),
            recall: mean(rs.map((r) => r.recall)),
            f1: mean(rs.map((r) => r.f1)),
            min_f1: rs.length ? Math.min(...rs.map((r) => r.f1)) : null,
            u_minus_gt: mean(rs.map((r) => r.u_minus_gt)),
            ordering_conflicts: mean(rs.map((r) => r.ordering_conflicts)),
            runs_with_ordering_conflict: rs.filter((r) => r.ordering_conflicts > 0).length,
            dedup_ambiguities: mean(rs.map((r) => r.dedup_ambiguities)),
            sender_conflicts: mean(rs.map((r) => r.sender_conflicts)),
            advisories: mean(rs.map((r) => r.advisories)),
          });
        }
      }
    }
  }
  const oto = rows.filter((r) => r.clustering === 'one-to-one');
  const determinism = DTS.map((dt) => {
    const rs = oto.filter((r) => r.dt_s === dt / 1000);
    return {
      dt_s: dt / 1000, runs: rs.length,
      deterministic: rs.filter((r) => r.deterministic === true).length,
      order_independent: rs.filter((r) => r.order_independent === true).length,
      failing: rs.filter((r) => r.deterministic !== true || r.order_independent !== true).map((r) => `${r.density}/p${r.p}/seed${r.seed}`),
    };
  });
  return {
    experiment: 'E5 dedup sensitivity',
    scenario: 'size 1000; fragments 2 (F1 dmy 12h, F2 mdy 24h, +00:00); delta 14 d, epsilon 7 d; attachmentRate 0.05; repeats: knob (a) bursts of 2-3, one sender, common short body, spread 0-5 min, anywhere (low 10, high 50 bursts); jitter: knob (g)',
    settings: { dt_granularity_s: DTS.map((d) => d / 1000), clustering: CLUSTERINGS, density: DENSITY, jitter_p: PS, seeds: `${SEEDS[0]}-${SEEDS[SEEDS.length - 1]}`, dt_conflict: 'max(60 s, dt_granularity)', mode: '--infer' },
    metric_scope: 'pairwise over observations that reached Synthesis; u_minus_gt counts message records (system lines excluded)',
    invariant_failures: rows.filter((r) => r.inv1 === false || r.inv2 === false).length,
    errors: rows.filter((r) => r.error).length,
    one_to_one_determinism: determinism,
    cells,
  };
}

async function run() {
  const items = [];
  for (const density of Object.keys(DENSITY)) for (const p of PS) for (const seed of SEEDS) items.push({ density, p, seed });
  const t0 = Date.now();
  const rows = [].concat(...await L.parallelMap(__filename, items));
  const wall = (Date.now() - t0) / 1000;
  L.writeCsv(path.join(L.RESULTS, 'e5-dedup-sensitivity.csv'), rows);
  const summary = summarise(rows);
  L.writeJson(path.join(L.RESULTS, 'e5-summary.json'), summary);
  L.writeJson(path.join(L.TIMING, 'e5.json'), { experiment: 'E5', scenarios: items.length, runs: rows.length, wallSeconds: wall, machine: L.machineInfo() });
  console.log(`E5: ${rows.length} runs in ${wall.toFixed(0)} s`);
  return summary;
}

if (process.argv.includes('--worker')) L.serveWorker(one);
else if (require.main === module) run().catch((e) => { console.error(e); process.exit(1); });
module.exports = { run, one };
