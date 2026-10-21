'use strict';

// E8: the zone-offset advisory, as frozen in commit 4464da6 together with
// scripts/experiments/e8-config.json (grid, seeds, metrics; read from there).
//
//   node scripts/experiments/e8-advisory.js
//
// (i) false alarms: zones correct, so every advisory is a false alarm.
// (ii) detection: F2 rendered in one zone and declared as another, for every
//      ordered pair of E2's zones. A run detects when an advisory names the
//      F1/F2 pair at the true shift with its sign. Each miss gets the first
//      failing condition of the rule, computed with zoneOffsetSupport at the
//      true shift.
//
// results/e8-false-alarms.csv, results/e8-detection.csv, results/e8-summary.json,
// results/timing/e8.json

const L = require('./lib');
const path = require('path');
const { buildScenario } = require('../generate-synthetic-fixtures');
const { zoneOffsetSupport } = require('../../core/src/synthesis');

const CFG = require('./e8-config.json');
const SEEDS = Array.from({ length: CFG.seeds.to - CFG.seeds.from + 1 }, (_, i) => CFG.seeds.from + i);
const OPTS = CFG.mode;
const minutesOf = (z) => (z[0] === '-' ? -1 : 1) * (Number(z.slice(1, 3)) * 60 + Number(z.slice(4, 6)));
const brief = (a) => ({ offset: a.offset, support: a.support, supportAtZero: a.supportAtZero, maxControlSupport: a.maxControlSupport, distinctKeys: a.distinctKeys });

function falseAlarm({ geometry, size, repeatBursts, seed }) {
  const g = CFG.falseAlarms.grid.geometry.find((x) => x.name === geometry);
  const b = CFG.falseAlarms.burst;
  const knobs = repeatBursts ? { a: [{ count: repeatBursts, k: b.k, where: b.where, spread: b.spread, common: b.common }] } : {};
  const scn = buildScenario(Object.assign({}, CFG.falseAlarms.base, { seed, size, deltaDays: g.deltaDays, epsilonDays: g.epsilonDays, knobs }));
  const res = L.withScenarioFiles(scn, (inputs) => L.runPipeline(inputs, OPTS));
  const advs = res.omega.advisories;
  return {
    geometry, size, repeat_bursts: repeatBursts, seed,
    gt_messages: scn.meta.ground_truth_messages,
    overlap_messages: scn.meta.overlap_messages,
    repeat_messages: scn.messages.filter((m) => m.knob === 'a').length,
    quarantined: res.omega.stats.quarantined,
    advisories: advs.length,
    advisory_details: advs.map(brief),
  };
}

function missReason(frags, res, dTrue) {
  const p = res.omega.params.zoneAdvisory;
  if (frags.some((f) => f.records.length === 0)) return { reason: 'a fragment has no record with an instant' };
  const [first, second] = frags.slice().sort((x, y) => (x.sha256 < y.sha256 ? -1 : x.sha256 > y.sha256 ? 1 : 0));
  const S = zoneOffsetSupport(first.records, second.records, p);
  const d = second === frags[1] ? dTrue : -dTrue;
  const at = S.get(d) || { n: 0, keys: new Set() };
  const zero = S.has(0) ? S.get(0).n : 0;
  let control = 0;
  for (const [x, s] of S) if (x % (p.stepMinutes * 60000) !== 0) control = Math.max(control, s.n);
  const facts = { support_true: at.n, distinct_keys_true: at.keys.size, support_at_zero: zero, max_control: control };
  const reason = at.n < p.minSupport ? `support < ${p.minSupport}`
    : at.keys.size < p.minDistinctKeys ? `distinct keys < ${p.minDistinctKeys}`
      : at.n <= zero ? 'support <= support at zero'
        : at.n <= control ? 'support <= best control support'
          : 'none of the rule\'s conditions fails';
  return Object.assign(facts, { reason });
}

function detection({ renderZone, declaredZone, seed }) {
  const base = CFG.detection.base;
  const formats = base.formats.map((f) => Object.assign({}, f, { zone: f.zone === '<renderZone>' ? renderZone : f.zone }));
  const scn = buildScenario(Object.assign({}, base, { seed, formats, knobs: { f: { fragment: 1, declaredZone } } }));
  const shift = minutesOf(renderZone) - minutesOf(declaredZone);
  const row = { render_zone: renderZone, declared_zone: declaredZone, shift_minutes: shift, seed, overlap_messages: scn.meta.overlap_messages };
  L.withScenarioFiles(scn, (inputs) => {
    const frags = L.fragmentsOf(inputs, OPTS);
    const res = L.runPipeline(inputs, OPTS, frags);
    const f2 = scn.fragments[1].file;
    let match = 0;
    for (const a of res.omega.advisories) {
      const i = a.fragments.indexOf(f2);
      if (i >= 0 && minutesOf(a.offset) === (i === 1 ? shift : -shift)) match++;
    }
    Object.assign(row, {
      quarantined: res.omega.stats.quarantined,
      advisories: res.omega.advisories.length,
      detected: match > 0,
      other_advisories: res.omega.advisories.length - match,
      advisory_details: res.omega.advisories.map(brief),
    }, match ? {} : missReason(frags, res, shift * 60000));
  });
  return row;
}

function one(item) { return item.kind === 'fa' ? falseAlarm(item) : detection(item); }

function summarise(fa, det) {
  const rate = (k, n) => L.round(n ? k / n : 0);
  const cells = [];
  for (const g of CFG.falseAlarms.grid.geometry) {
    for (const size of CFG.falseAlarms.grid.size) {
      for (const rb of CFG.falseAlarms.grid.repeatBursts) {
        const rs = fa.filter((r) => r.geometry === g.name && r.size === size && r.repeat_bursts === rb);
        const hit = rs.filter((r) => r.advisories > 0);
        cells.push({
          geometry: g.name, size, repeat_bursts: rb, runs: rs.length, runs_with_advisory: hit.length,
          false_alarm_rate: rate(hit.length, rs.length), advisories: rs.reduce((s, r) => s + r.advisories, 0),
          false_alarms: hit.map((r) => ({ seed: r.seed, advisories: r.advisory_details })),
        });
      }
    }
  }
  const reasons = (rs) => {
    const out = {};
    for (const r of rs.filter((x) => !x.detected)) out[r.reason] = (out[r.reason] || 0) + 1;
    return out;
  };
  const pairs = [];
  for (const rz of CFG.detection.zones) {
    for (const dz of CFG.detection.zones) {
      if (rz === dz) continue;
      const rs = det.filter((r) => r.render_zone === rz && r.declared_zone === dz);
      const hit = rs.filter((r) => r.detected);
      pairs.push({
        render_zone: rz, declared_zone: dz, shift_minutes: minutesOf(rz) - minutesOf(dz), runs: rs.length,
        detected: hit.length, detection_rate: rate(hit.length, rs.length),
        runs_with_other_advisory: rs.filter((r) => r.other_advisories > 0).length,
        misses_by_reason: reasons(rs),
        misses: rs.filter((r) => !r.detected).map((r) => ({ seed: r.seed, reason: r.reason, overlap_messages: r.overlap_messages, support_true: r.support_true, distinct_keys_true: r.distinct_keys_true, support_at_zero: r.support_at_zero, max_control: r.max_control })),
      });
    }
  }
  const shifts = [...new Set(pairs.map((p) => p.shift_minutes))].sort((a, b) => a - b).map((s) => {
    const rs = det.filter((r) => r.shift_minutes === s);
    const hit = rs.filter((r) => r.detected).length;
    return { shift_minutes: s, pairs: pairs.filter((p) => p.shift_minutes === s).length, runs: rs.length, detected: hit, detection_rate: rate(hit, rs.length), misses_by_reason: reasons(rs) };
  });
  const detected = det.filter((r) => r.detected).length;
  return {
    experiment: 'E8 zone-offset advisory',
    config: 'scripts/experiments/e8-config.json',
    frozen_with_commit: '4464da677c7963bc902d890b5e2139d966406f81',
    false_alarms: {
      runs: fa.length,
      runs_with_advisory: fa.filter((r) => r.advisories > 0).length,
      false_alarm_rate: rate(fa.filter((r) => r.advisories > 0).length, fa.length),
      cells,
    },
    detection: {
      runs: det.length, detected, detection_rate: rate(detected, det.length),
      runs_with_other_advisory: det.filter((r) => r.other_advisories > 0).length,
      misses_by_reason: reasons(det),
      by_shift: shifts,
      by_pair: pairs,
    },
  };
}

async function run() {
  const items = [];
  for (const g of CFG.falseAlarms.grid.geometry) {
    for (const size of CFG.falseAlarms.grid.size) {
      for (const repeatBursts of CFG.falseAlarms.grid.repeatBursts) {
        for (const seed of SEEDS) items.push({ kind: 'fa', geometry: g.name, size, repeatBursts, seed });
      }
    }
  }
  for (const renderZone of CFG.detection.zones) {
    for (const declaredZone of CFG.detection.zones) {
      if (renderZone === declaredZone) continue;
      for (const seed of SEEDS) items.push({ kind: 'det', renderZone, declaredZone, seed });
    }
  }
  const t0 = Date.now();
  const rows = await L.parallelMap(__filename, items);
  const wall = (Date.now() - t0) / 1000;
  const fa = rows.filter((_, i) => items[i].kind === 'fa');
  const det = rows.filter((_, i) => items[i].kind === 'det');
  L.writeCsv(path.join(L.RESULTS, 'e8-false-alarms.csv'), fa);
  L.writeCsv(path.join(L.RESULTS, 'e8-detection.csv'), det);
  const summary = summarise(fa, det);
  L.writeJson(path.join(L.RESULTS, 'e8-summary.json'), summary);
  L.writeJson(path.join(L.TIMING, 'e8.json'), { experiment: 'E8', runs: items.length, wallSeconds: wall, workers: Number(process.env.WP2_WORKERS) || require('os').cpus().length - 1, machine: L.machineInfo() });
  console.log(`E8: ${items.length} runs in ${wall.toFixed(0)} s; false-alarm runs ${summary.false_alarms.runs_with_advisory}/${fa.length}; detected ${summary.detection.detected}/${det.length}`);
  return summary;
}

if (process.argv.includes('--worker')) L.serveWorker(one);
else if (require.main === module) run().catch((e) => { console.error(e); process.exit(1); });
module.exports = { run, one };
