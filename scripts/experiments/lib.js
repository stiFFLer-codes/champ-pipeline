'use strict';

// Shared harness for the experiments: write a generated scenario to a
// temporary directory, run CHAMP-Pipeline on the files exactly as
// scripts/reconstruct.js does, and score the result against the generator's
// ground truth. Nothing here reads the pipeline's internals; everything it
// checks is read from the files and from (U, Omega).

const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');
const { ingestFragment } = require('../../core/src/ingestion');
const { normalizeFragment } = require('../../core/src/normalization');
const { inferFragmentDateOrder } = require('../../core/src/inference');
const { synthesize } = require('../../core/src/synthesis');

const ROOT = path.join(__dirname, '..', '..');
const RESULTS = path.join(ROOT, 'results');
const TIMING = path.join(RESULTS, 'timing');

const sha256 = (x) => crypto.createHash('sha256').update(x).digest('hex');

let tmpRoot = null;
// Writes the scenario's fragments, hands their paths and declared zones to
// fn, and removes them afterwards.
function withScenarioFiles(scn, fn) {
  if (!tmpRoot) tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'champ-wp2-'));
  const dir = fs.mkdtempSync(path.join(tmpRoot, 's-'));
  try {
    const inputs = scn.fragments.map((f) => {
      const p = path.join(dir, f.file);
      fs.writeFileSync(p, f.text, 'utf8');
      return { path: p, zone: f.declaredZone };
    });
    return fn(inputs);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}
process.on('exit', () => { if (tmpRoot) fs.rmSync(tmpRoot, { recursive: true, force: true }); });

// The fragments Synthesis receives. A declared zone of +00:00 is left
// undeclared (the default), which reads the same instants.
function fragmentsOf(inputs, opts) {
  const o = opts || {};
  return inputs.map(({ path: p, zone }) => {
    const n = normalizeFragment(ingestFragment(p), zone && zone !== '+00:00' ? { zone } : undefined);
    return o.infer ? inferFragmentDateOrder(n) : n;
  });
}

// One end-to-end run.
function runPipeline(inputs, opts, frags) {
  const o = opts || {};
  const params = {};
  for (const k of ['clustering', 'dtGranularityMs', 'dtConflictMs']) if (o[k] !== undefined) params[k] = o[k];
  return synthesize(frags || fragmentsOf(inputs, o), params);
}

const outputHash = (res) => sha256(JSON.stringify({ unified: res.unified, omega: res.omega }));

// Every input order other than the given one, rotated by one place.
const rotate = (xs) => xs.slice(1).concat(xs.slice(0, 1));

// Provenance entry -> the generator's observation id "<fragment>:<line>".
function observationIdOf(scn) {
  const byFile = new Map(scn.fragments.map((f) => [f.file, f.index]));
  return (p) => `${byFile.get(p.source_id)}:${p.line_range[0]}`;
}

// Pairwise deduplication against ground truth, over the observations that
// reached Synthesis (a quarantined observation cannot be paired by anyone).
function score(scn, res) {
  const id = observationIdOf(scn);
  const gtOf = new Map(scn.observations.map((o) => [o.id, o.gt]));
  const partition = res.unified.map((u) => u.provenance.map(id).sort()).sort();
  const surviving = new Set([].concat(...partition));
  let predPairs = 0;
  let tp = 0;
  for (const c of partition) {
    for (let i = 0; i < c.length; i++) {
      for (let j = i + 1; j < c.length; j++) {
        predPairs++;
        if (gtOf.get(c[i]) === gtOf.get(c[j])) tp++;
      }
    }
  }
  const perGt = new Map();
  for (const o of scn.observations) if (surviving.has(o.id)) perGt.set(o.gt, (perGt.get(o.gt) || 0) + 1);
  let gtPairs = 0;
  for (const c of perGt.values()) gtPairs += (c * (c - 1)) / 2;
  const precision = predPairs ? tp / predPairs : 1;
  const recall = gtPairs ? tp / gtPairs : 1;
  const clustersPerGt = new Map();
  let mixedClusters = 0;
  for (const c of partition) {
    const ids = new Set(c.map((x) => gtOf.get(x)));
    if (ids.size > 1) mixedClusters++;
    for (const g of ids) clustersPerGt.set(g, (clustersPerGt.get(g) || 0) + 1);
  }
  const splitMessages = [...clustersPerGt.values()].filter((v) => v > 1).length;
  return {
    partition,
    tp,
    predPairs,
    gtPairs,
    precision,
    recall,
    f1: precision + recall ? (2 * precision * recall) / (precision + recall) : 0,
    mixedClusters,
    splitMessages,
    equalsGroundTruthOnSurvivors: mixedClusters === 0 && splitMessages === 0,
  };
}

// Invariants 1 and 2 checked from outside the pipeline, against the files.
//   1: every observation the generator wrote is in exactly one U record or in
//      Q, and nothing else is (the pipeline's own check is "at least once").
//   2: every provenance entry's sha256 is its file's, and its record_sha256
//      is the hash of exactly the bytes of its line range.
function checkInvariants(scn, inputs, res) {
  const id = observationIdOf(scn);
  const seen = new Map();
  const entries = [];
  for (const u of res.unified) for (const p of u.provenance) entries.push(p);
  for (const q of res.omega.quarantine) entries.push(q.provenance);
  for (const p of entries) seen.set(id(p), (seen.get(id(p)) || 0) + 1);
  const inv1 = seen.size === scn.observations.length && scn.observations.every((o) => seen.get(o.id) === 1);

  const files = new Map(inputs.map(({ path: p }) => {
    const buf = fs.readFileSync(p);
    const starts = [0];
    for (let i = 0; i < buf.length; i++) if (buf[i] === 0x0a) starts.push(i + 1);
    return [path.basename(p), { buf, sha: sha256(buf), starts }];
  }));
  const inv2 = entries.every((p) => {
    const f = files.get(p.source_id);
    if (!f || p.sha256 !== f.sha) return false;
    const [a, b] = p.line_range;
    return p.record_sha256 === sha256(f.buf.subarray(f.starts[a - 1], f.starts[b] ?? f.buf.length));
  });
  return { inv1, inv2 };
}

// The run's outcome in the shape expectedOutcome() predicts.
function outcomeOf(scn, res, partition) {
  const s = res.omega.stats;
  const conflicts = { 'within-cluster': 0, 'sender-disagreement': 0, 'ordering-unsatisfiable': 0 };
  for (const c of res.omega.conflicts) conflicts[c.kind === 'within-cluster' ? c.kind : c.reason]++;
  return {
    recordsIn: s.normalizedRecordsIn,
    unified: s.unifiedRecords,
    unifiedMessages: res.unified.filter((u) => u.sender !== null).length,
    collapsed: s.duplicatesCollapsed,
    quarantined: s.quarantined,
    quarantineByReason: s.quarantineByReason,
    conflicts,
    dedupAmbiguities: s.dedupAmbiguities,
    dating: s.datingOfUnifiedRecords,
    partition: partition || score(scn, res).partition,
  };
}

// Field names on which the run and the expectation differ.
function diffOutcome(actual, expected) {
  return Object.keys(expected).filter((k) => JSON.stringify(actual[k]) !== JSON.stringify(expected[k]));
}

function machineInfo() {
  const cpus = os.cpus();
  return {
    cpu: cpus[0] ? cpus[0].model.trim() : null,
    logicalCpus: cpus.length,
    memoryGiB: +(os.totalmem() / 2 ** 30).toFixed(1),
    os: `${os.type()} ${os.release()} (${os.platform()} ${os.arch()})`,
    node: process.version,
    v8: process.versions.v8,
    icu: process.versions.icu,
    tz: process.versions.tz,
  };
}

function writeJson(file, data) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, `${JSON.stringify(data, null, 2)}\n`, 'utf8');
}

function writeCsv(file, rows) {
  const cols = [...new Set([].concat(...rows.map((r) => Object.keys(r))))];
  const cell = (v) => {
    const s = v === null || v === undefined ? '' : typeof v === 'object' ? JSON.stringify(v) : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, `${[cols.join(',')].concat(rows.map((r) => cols.map((c) => cell(r[c])).join(','))).join('\n')}\n`, 'utf8');
}

// Rates in results files are rounded, so they print and diff stably.
const round = (x, d = 6) => Math.round(x * 10 ** d) / 10 ** d;

// One configuration, checked the same way everywhere: run, run again, run with
// the fragments in another order; compare the three outputs byte for byte;
// check the invariants from outside; compare with the expectation if given.
function evaluate(scn, inputs, opts, expected) {
  let res;
  let again;
  let rotated;
  try {
    res = runPipeline(inputs, opts);
    again = runPipeline(inputs, opts);
    rotated = runPipeline(rotate(inputs), opts);
  } catch (e) {
    return { error: e.message };
  }
  const h = outputHash(res);
  const sc = score(scn, res);
  const actual = outcomeOf(scn, res, sc.partition);
  return Object.assign({
    res,
    actual,
    score: sc,
    deterministic: outputHash(again) === h,
    orderIndependent: outputHash(rotated) === h,
    diff: expected ? diffOutcome(actual, expected) : null,
  }, checkInvariants(scn, inputs, res));
}

// Spread items over child processes running `script` with --worker; results
// come back in item order whatever order the workers finish in.
function parallelMap(script, items, workers) {
  const { fork } = require('child_process');
  const n = Math.max(1, Math.min(workers || Number(process.env.WP2_WORKERS) || os.cpus().length - 1, items.length));
  return new Promise((resolve, reject) => {
    const results = new Array(items.length);
    let next = 0;
    let alive = 0;
    let done = 0;
    if (items.length === 0) { resolve(results); return; }
    for (let w = 0; w < n; w++) {
      const child = fork(script, ['--worker'], { stdio: ['ignore', 'inherit', 'inherit', 'ipc'] });
      alive++;
      const feed = () => {
        if (next < items.length) { const i = next++; child.send({ i, item: items[i] }); } else child.send({ stop: true });
      };
      child.on('message', ({ i, result }) => {
        results[i] = result;
        done++;
        if (done % Math.max(1, Math.floor(items.length / 20)) === 0) process.stderr.write(`  ${path.basename(script)} ${done}/${items.length}
`);
        feed();
      });
      child.on('exit', (code) => {
        alive--;
        if (code !== 0) reject(new Error(`${path.basename(script)} worker exited with ${code}`));
        else if (alive === 0) resolve(results);
      });
      feed();
    }
  });
}

function serveWorker(fn) {
  process.on('message', (m) => {
    if (m.stop) { process.disconnect(); return; }
    process.send({ i: m.i, result: fn(m.item) });
  });
}

module.exports = {
  ROOT, RESULTS, TIMING, sha256, withScenarioFiles, fragmentsOf, runPipeline, outputHash, rotate,
  score, checkInvariants, outcomeOf, diffOutcome, machineInfo, writeJson, writeCsv, round,
  evaluate, parallelMap, serveWorker,
};
