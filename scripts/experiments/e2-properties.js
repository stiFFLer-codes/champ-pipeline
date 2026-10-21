'use strict';

// E2: property tests over random configurations. Configuration s (1..N) is
// drawn from a PRNG seeded with s: 2-4 fragments, random size, delta,
// epsilon, geometry, per-fragment date order / clock / zone, and each knob
// (a)-(h) on with probability 0.3. Every configuration runs in --infer and in
// strict mode, three times each (run, rerun, fragments rotated by one).
//
//   node scripts/experiments/e2-properties.js [N]       default N = 5000
//
// Properties, per mode:
//   P1  Invariant 1: every written observation in exactly one U record or Q
//   P2  Invariant 2: every provenance entry's hashes match the file's bytes
//   P3  Invariant 3: byte-identical (U, Omega) on a second run
//   P4  order independence: byte-identical with the fragments rotated
//   P5  |U| = ground truth, as a partition (--infer only; applies when no
//       knob in {a, e, f, g} was placed and every fragment holds an
//       unambiguous date, so inference can resolve it)
//   P6  the outcome equals the generator's expectation (counts by kind,
//       dedup ambiguities, dating, exact partition)
//
// results/e2-properties.csv   one row per configuration
// results/e2-summary.json     counts per property, every failing seed
// results/timing/e2.json

const L = require('./lib');
const path = require('path');
const { buildScenario, expectedOutcome, mulberry32 } = require('../generate-synthetic-fixtures');

const ZONES = ['+00:00', '+05:30', '-05:00', '+01:00', '+09:45', '-03:30', '+14:00', '-12:00'];
const MODES = { infer: true, strict: false };
const P5_EXCLUDES = ['a', 'e', 'f', 'g'];

function randomConfig(s) {
  const r = mulberry32((s ^ 0x45325052) >>> 0);
  const ri = (lo, hi) => lo + Math.floor(r() * (hi - lo + 1));
  const ch = (arr) => arr[Math.floor(r() * arr.length)];
  const n = ri(2, 4);
  const formats = Array.from({ length: n }, () => ({
    dateOrder: ch(['dmy', 'mdy']), clock: ch(['12h', '24h']), zone: r() < 0.5 ? '+00:00' : ch(ZONES),
  }));
  const on = () => r() < 0.3;
  const knobs = {};
  if (on()) knobs.a = [{ count: ri(1, 3), k: [2, 4], where: 'mixed' }];
  if (on()) knobs.b = { count: ri(1, 2), where: ch(['inside', 'outside']) };
  if (on()) knobs.c = { count: ri(1, 2) };
  if (on()) knobs.d = { count: ri(1, 2), form: 'mixed' };
  if (on()) knobs.e = { count: ri(1, 2) };
  if (on()) {
    const fragment = ri(0, n - 1);
    const others = ZONES.filter((z) => z !== formats[fragment].zone);
    knobs.f = { fragment, declaredZone: ch(others) };
  }
  if (on()) knobs.g = { p: ch([0.05, 0.1, 0.3]) };
  if (on()) knobs.h = { count: 1 };
  return {
    seed: s, size: ri(20, 400), fragments: n, deltaDays: ri(0, 30), epsilonDays: ri(0, 14),
    preDays: ri(1, 30), windowDays: ri(3, 120), gapDays: ri(0, 60), postDays: ri(1, 30),
    attachmentRate: ch([0, 0.05, 0.2]), formats, knobs,
  };
}

const minutesOf = (z) => (z[0] === '-' ? -1 : 1) * (Number(z.slice(1, 3)) * 60 + Number(z.slice(4, 6)));

function one(s) {
  const cfg = randomConfig(s);
  const scn = buildScenario(cfg);
  const placed = [...new Set(scn.knobs.filter((k) => k.placed).map((k) => k.knob))].sort();
  const witnessed = scn.fragments.every((f) => scn.observations.some((o) => o.frag === f.index && !o.ambiguous));
  const row = {
    seed: s, fragments: cfg.fragments, size: cfg.size, delta_days: cfg.deltaDays, epsilon_days: cfg.epsilonDays,
    gt_messages: scn.meta.ground_truth_messages, overlap_messages: scn.meta.overlap_messages,
    knobs_requested: Object.keys(cfg.knobs).sort().join(''), knobs_placed: placed.join(''),
    every_fragment_witnessed: witnessed,
  };
  const f = scn.knobs.find((k) => k.knob === 'f' && k.placed);
  L.withScenarioFiles(scn, (inputs) => {
    for (const [m, infer] of Object.entries(MODES)) {
      const e = L.evaluate(scn, inputs, { infer }, expectedOutcome(scn, { infer }));
      if (e.error) { row[`${m}_error`] = e.error; continue; }
      const p5applies = infer && witnessed && !placed.some((k) => P5_EXCLUDES.includes(k));
      Object.assign(row, {
        [`${m}_unified`]: e.res.omega.stats.unifiedRecords,
        [`${m}_quarantined`]: e.res.omega.stats.quarantined,
        [`${m}_conflicts`]: e.res.omega.stats.conflicts,
        [`${m}_dedup_ambiguities`]: e.res.omega.stats.dedupAmbiguities,
        [`${m}_advisories`]: e.res.omega.stats.advisories,
        [`${m}_P1`]: e.inv1,
        [`${m}_P2`]: e.inv2,
        [`${m}_P3`]: e.deterministic,
        [`${m}_P4`]: e.orderIndependent,
        [`${m}_P5`]: p5applies ? e.score.equalsGroundTruthOnSurvivors && e.res.omega.stats.quarantined === 0
          && e.actual.unifiedMessages === scn.meta.ground_truth_messages : 'n/a',
        [`${m}_P6`]: e.diff.length === 0,
        [`${m}_P6_diff`]: e.diff.join(' '),
        [`${m}_error`]: '',
      });
      if (infer) {
        // The advisory against what knob (f) did, as facts.
        const advs = e.res.omega.advisories;
        let match = 0;
        if (f) {
          const file = scn.fragments[f.fragment].file;
          const shift = minutesOf(f.renderZone) - minutesOf(f.declaredZone);
          for (const a of advs) {
            const i = a.fragments.indexOf(file);
            if (i >= 0 && minutesOf(a.offset) === (i === 1 ? shift : -shift)) match++;
          }
          row.f_shift_minutes = shift;
          row.f_shared_messages = scn.messages.filter((x) => x.holders.includes(f.fragment) && x.holders.length >= 2).length;
        }
        row.advisories_matching_f = match;
        row.advisories_other = advs.length - match;
      }
    }
  });
  return row;
}

function summarise(rows) {
  const props = ['P1', 'P2', 'P3', 'P4', 'P5', 'P6'];
  const byMode = {};
  const failingSeeds = {};
  for (const m of Object.keys(MODES)) {
    byMode[m] = { configs: rows.length, errors: rows.filter((r) => r[`${m}_error`]).map((r) => r.seed) };
    for (const p of props) {
      const applies = rows.filter((r) => r[`${m}_${p}`] !== 'n/a' && r[`${m}_${p}`] !== undefined);
      const fail = applies.filter((r) => r[`${m}_${p}`] !== true).map((r) => r.seed);
      byMode[m][p] = { applied: applies.length, held: applies.length - fail.length };
      failingSeeds[`${m}_${p}`] = fail;
    }
  }
  const withF = rows.filter((r) => r.knobs_placed.includes('f'));
  const knobCounts = {};
  for (const k of 'abcdefgh') {
    knobCounts[k] = {
      requested: rows.filter((r) => r.knobs_requested.includes(k)).length,
      placed: rows.filter((r) => r.knobs_placed.includes(k)).length,
    };
  }
  return {
    experiment: 'E2 property tests',
    configs: rows.length,
    generator: 'randomConfig(s) in scripts/experiments/e2-properties.js; mulberry32 seeded with s',
    p5_applies_when: `--infer, no knob in {${P5_EXCLUDES.join(', ')}} placed, every fragment holds an unambiguous date`,
    fragments: { 2: rows.filter((r) => r.fragments === 2).length, 3: rows.filter((r) => r.fragments === 3).length, 4: rows.filter((r) => r.fragments === 4).length },
    knobs: knobCounts,
    by_mode: byMode,
    failing_seeds: failingSeeds,
    advisory_facts_infer: {
      configs_with_f: withF.length,
      configs_with_f_and_matching_advisory: withF.filter((r) => r.advisories_matching_f > 0).length,
      configs_with_f_no_matching_advisory: withF.filter((r) => r.advisories_matching_f === 0).length,
      of_which_shift_over_14h: withF.filter((r) => r.advisories_matching_f === 0 && Math.abs(r.f_shift_minutes) > 14 * 60).length,
      of_which_fewer_than_3_shared: withF.filter((r) => r.advisories_matching_f === 0 && r.f_shared_messages < 3).length,
      configs_without_f: rows.length - withF.length,
      configs_without_f_with_advisory: rows.filter((r) => !r.knobs_placed.includes('f') && r.advisories_other > 0).length,
      configs_with_f_and_other_advisory: withF.filter((r) => r.advisories_other > 0).length,
    },
  };
}

async function run(n) {
  const N = n || 5000;
  const items = Array.from({ length: N }, (_, i) => i + 1);
  const t0 = Date.now();
  const rows = await L.parallelMap(__filename, items);
  const wall = (Date.now() - t0) / 1000;
  L.writeCsv(path.join(L.RESULTS, 'e2-properties.csv'), rows);
  const summary = summarise(rows);
  L.writeJson(path.join(L.RESULTS, 'e2-summary.json'), summary);
  L.writeJson(path.join(L.TIMING, 'e2.json'), { experiment: 'E2', configs: N, wallSeconds: wall, machine: L.machineInfo() });
  console.log(`E2: ${N} configs in ${wall.toFixed(0)} s`);
  for (const [k, seeds] of Object.entries(summary.failing_seeds)) {
    console.log(`  ${k}: ${seeds.length ? `FAILING seeds ${seeds.join(' ')}` : 'no failing seed'}`);
  }
  return summary;
}

if (process.argv.includes('--worker')) L.serveWorker(one);
else if (require.main === module) run(Number(process.argv[2]) || undefined).catch((e) => { console.error(e); process.exit(1); });
module.exports = { run, one, randomConfig };
