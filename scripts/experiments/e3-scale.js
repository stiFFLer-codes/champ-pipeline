'use strict';

// E3: scale, feasibility only. Ground truth of 100,000 and 1,000,000
// messages; two fragments, delta 14 d, epsilon 7 d, an outage window of 1,400
// days (so a million messages fit at one per minute); --infer, one-to-one.
// Each size is generated once, then reconstructed 3 times, each time in a
// fresh process so its peak resident memory is its own.
//
//   node scripts/experiments/e3-scale.js [size ...]     default 100000 1000000
//
// A run first gets Node's default heap. If it dies, it is retried with
// --max-old-space-size=12288 and both outcomes are recorded.
//
// results/e3-scale.json          sizes and counts (deterministic)
// results/timing/e3-scale.json   per-stage times, peak RSS, machine

const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');
const { spawnSync } = require('child_process');

const REPS = 3;
const BIG_HEAP = '--max-old-space-size=12288';
const config = (size) => ({ seed: 1, size, deltaDays: 14, epsilonDays: 7, windowDays: 1400, attachmentRate: 0.05 });

// Child: generate one scenario into dir.
function generate(size, dir) {
  const { buildScenario } = require('../generate-synthetic-fixtures');
  const t0 = Date.now();
  const scn = buildScenario(config(size));
  const ms = Date.now() - t0;
  const files = scn.fragments.map((f) => {
    fs.writeFileSync(path.join(dir, f.file), f.text, 'utf8');
    return { file: f.file, lines: f.lines.length, bytes: Buffer.byteLength(f.text) };
  });
  process.stdout.write(JSON.stringify({ size, generateMs: ms, files, meta: scn.meta, maxRssKiB: process.resourceUsage().maxRSS }));
}

// Child: reconstruct the fragments in dir, timing each stage.
function reconstruct(dir) {
  const { ingestFragment } = require('../../core/src/ingestion');
  const { normalizeFragment } = require('../../core/src/normalization');
  const { inferFragmentDateOrder } = require('../../core/src/inference');
  const { synthesize } = require('../../core/src/synthesis');
  const files = fs.readdirSync(dir).filter((f) => f.endsWith('.txt')).sort().map((f) => path.join(dir, f));
  const stages = {};
  let t = process.hrtime.bigint();
  const lap = (k) => { const now = process.hrtime.bigint(); stages[k] = Number(now - t) / 1e6; t = now; };
  const ing = files.map((f) => ingestFragment(f)); lap('ingest');
  const nor = ing.map((x) => normalizeFragment(x)); lap('normalize');
  const inf = nor.map((x) => inferFragmentDateOrder(x)); lap('infer');
  const { unified, omega } = synthesize(inf); lap('synthesize');
  // (U, Omega) at this size can exceed the longest string V8 will build, so
  // it is hashed record by record (Omega without its provenance_map, which
  // repeats each record's provenance).
  const h = crypto.createHash('sha256');
  for (const u of unified) h.update(JSON.stringify(u));
  h.update(JSON.stringify(Object.assign({}, omega, { provenance_map: undefined })));
  const outputSha256 = h.digest('hex'); lap('hash');
  const s = omega.stats;
  process.stdout.write(JSON.stringify({
    stages, maxRssKiB: process.resourceUsage().maxRSS,
    heapLimitMiB: Math.round(require('v8').getHeapStatistics().heap_size_limit / 2 ** 20),
    counts: {
      recordsIn: s.normalizedRecordsIn, unified: s.unifiedRecords,
      unifiedMessages: unified.filter((u) => u.sender !== null).length,
      collapsed: s.duplicatesCollapsed, quarantined: s.quarantined, conflicts: s.conflicts,
      dedupAmbiguities: s.dedupAmbiguities, advisories: s.advisories,
    },
    outputSha256,
  }));
}

function child(args, heap) {
  const r = spawnSync(process.execPath, (heap ? [heap] : []).concat([__filename], args), { encoding: 'utf8', maxBuffer: 1 << 26 });
  if (r.status === 0) return { ok: true, out: JSON.parse(r.stdout) };
  return { ok: false, status: r.status, signal: r.signal, stderr: (r.stderr || '').split('\n').filter(Boolean).slice(-3).join(' | ') };
}

async function run(sizes) {
  const L = require('./lib');
  const deterministic = [];
  const timing = [];
  for (const size of sizes || [100000, 1000000]) {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'champ-e3-'));
    try {
      const gen = child(['--generate', String(size), dir], BIG_HEAP);
      if (!gen.ok) throw new Error(`generating ${size} failed: ${gen.stderr}`);
      const g = gen.out;
      const reps = [];
      for (let rep = 1; rep <= REPS; rep++) {
        let r = child(['--reconstruct', dir], null);
        const attempt = { rep, heap: 'default', ok: r.ok };
        if (!r.ok) {
          attempt.failure = { status: r.status, signal: r.signal, stderr: r.stderr };
          r = child(['--reconstruct', dir], BIG_HEAP);
          attempt.retry = { heap: BIG_HEAP, ok: r.ok };
          if (!r.ok) attempt.retry.failure = { status: r.status, signal: r.signal, stderr: r.stderr };
        }
        if (r.ok) Object.assign(attempt, { stagesMs: r.out.stages, totalMs: Object.values(r.out.stages).reduce((a, b) => a + b, 0) - r.out.stages.hash, peakRssMiB: Math.round(r.out.maxRssKiB / 1024), heapLimitMiB: r.out.heapLimitMiB, counts: r.out.counts, outputSha256: r.out.outputSha256 });
        reps.push(attempt);
        console.log(`E3 size ${size} rep ${rep}: ${r.ok ? `${(attempt.totalMs / 1000).toFixed(1)} s, peak RSS ${attempt.peakRssMiB} MiB${attempt.retry ? ' (after retry with larger heap)' : ''}` : 'FAILED'}`);
      }
      const done = reps.filter((x) => x.counts);
      deterministic.push({
        size, config: config(size), ground_truth_messages: g.meta.ground_truth_messages, overlap_messages: g.meta.overlap_messages,
        observations: g.meta.observations, files: g.files.map((f) => ({ file: f.file, lines: f.lines, bytes: f.bytes })),
        counts: done.length ? done[0].counts : null,
        u_messages_equal_ground_truth: done.length ? done[0].counts.unifiedMessages === g.meta.ground_truth_messages : null,
        reps_completed: done.length,
        identical_output_across_reps: done.length > 1 ? new Set(done.map((x) => x.outputSha256)).size === 1 : null,
      });
      timing.push({ size, generateMs: g.generateMs, generatePeakRssMiB: Math.round(g.maxRssKiB / 1024), generateHeap: BIG_HEAP, reps });
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  }
  L.writeJson(path.join(L.RESULTS, 'e3-scale.json'), { experiment: 'E3 scale (feasibility)', mode: '--infer, one-to-one, dt_granularity 0', rows: deterministic });
  L.writeJson(path.join(L.TIMING, 'e3-scale.json'), { experiment: 'E3', note: 'totalMs = ingest + normalize + infer + synthesize (hashing excluded); peak RSS from process.resourceUsage().maxRSS of the reconstructing process', machine: L.machineInfo(), sizes: timing });
  return deterministic;
}

const argv = process.argv.slice(2);
if (argv[0] === '--generate') generate(Number(argv[1]), argv[2]);
else if (argv[0] === '--reconstruct') reconstruct(argv[1]);
else if (require.main === module) run(argv.length ? argv.map(Number) : undefined).catch((e) => { console.error(e); process.exit(1); });
module.exports = { run };
