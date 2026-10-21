'use strict';

// Every number the paper may cite, in one flat JSON file, computed here and
// never typed by hand.
//
//   node scripts/experiments/paper-numbers.js      writes results/paper-numbers.json
//
// Computed directly: the synthetic corpus (5 fixtures), the committed TCF pair
// run end to end, the delta = epsilon = 0 pair, line counts of the
// implementation and its tests, the reason codes, the survey tally
// (scripts/survey/tally.js). Read from results/: the experiment summaries (run
// scripts/experiments/run-all.js first).
//
// scripts/check-corpus-claims.js recomputes the corpus.*, pair.* and survey.*
// keys and fails when they no longer equal the committed file.

const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');
const { ingestFragment } = require('../../core/src/ingestion');
const { normalizeFragment, REASON } = require('../../core/src/normalization');
const { inferFragmentDateOrder } = require('../../core/src/inference');
const { synthesize } = require('../../core/src/synthesis');
const { surveyNumbers } = require('../survey/tally');

const ROOT = path.join(__dirname, '..', '..');
const RESULTS = path.join(ROOT, 'results');
const OUT = path.join(RESULTS, 'paper-numbers.json');
const FIXTURES = path.join(ROOT, 'data', 'synthetic_fixtures');
const PAIR = path.join(FIXTURES, 'tcf-pair');

// --- the five-fixture corpus --------------------------------------------------

// A record's date is the NN/NN/NN at the start of a line; continuation lines
// carry none. A date is ambiguous when both leading fields are <= 12: it
// parses under day-month-year and month-day-year alike. Format-independent on
// purpose: it asks what the characters admit, not what the manifest says.
const DATE_RE = /^(\d{2})\/(\d{2})\/(\d{2}),/;

function corpusRows() {
  const manifest = JSON.parse(fs.readFileSync(path.join(FIXTURES, 'manifest.json'), 'utf8'));
  const rows = manifest.fixtures.map((f) => {
    const text = fs.readFileSync(path.join(FIXTURES, f.file), 'utf8');
    const dates = new Set();
    let records = 0;
    for (const line of text.split(/\r?\n/)) {
      const m = DATE_RE.exec(line);
      if (m) { dates.add(`${m[1]}/${m[2]}/${m[3]}`); records++; }
    }
    const ambiguous = [...dates].filter((d) => Number(d.slice(0, 2)) <= 12 && Number(d.slice(3, 5)) <= 12);
    const format = f.quirks.includes('date-format-ddmmyy') ? 'DMY' : f.quirks.includes('date-format-mmddyy') ? 'MDY' : '??';
    return { file: f.file, format, records, distinct: dates.size, ambiguous: ambiguous.length, disambiguating: dates.size - ambiguous.length };
  });
  return { manifest, rows };
}

function corpusNumbers() {
  const { manifest, rows } = corpusRows();
  const categories = new Set([].concat(...manifest.fixtures.map((f) => f.quirks)));
  const none = rows.filter((r) => r.disambiguating === 0);
  const f3 = rows.find((r) => r.file.startsWith('fixture-03-'));
  const f3n = inferFragmentDateOrder(normalizeFragment(ingestFragment(path.join(FIXTURES, f3.file))));
  const n = {
    'corpus.seed': manifest.seed,
    'corpus.fixtures': rows.length,
    'corpus.categories': categories.size,
    'corpus.dmy_fixtures': rows.filter((r) => r.format === 'DMY').length,
    'corpus.mdy_fixtures': rows.filter((r) => r.format === 'MDY').length,
    'corpus.fixtures_with_ambiguous_date': rows.filter((r) => r.ambiguous > 0).length,
    'corpus.fixtures_with_disambiguating_date': rows.length - none.length,
    'corpus.fixtures_without_disambiguating_date': none.map((r) => r.file).join(' '),
    'corpus.fixture03.records': f3n.stats.ingested,
    'corpus.fixture03.distinct_dates': f3.distinct,
    'corpus.fixture03.ambiguous_dates': f3.ambiguous,
    'corpus.fixture03.quarantined_after_inference': f3n.stats.quarantined,
    'corpus.fixture03.inference_applied': f3n.inference.applied,
  };
  for (const r of rows) {
    const k = r.file.slice(0, 10);
    n[`corpus.${k}.distinct_dates`] = r.distinct;
    n[`corpus.${k}.ambiguous_dates`] = r.ambiguous;
    n[`corpus.${k}.disambiguating_dates`] = r.disambiguating;
  }
  return n;
}

// --- the committed TCF pair -------------------------------------------------

const hash = (res) => crypto.createHash('sha256').update(JSON.stringify(res)).digest('hex');

function reconstruct(files, infer, params) {
  return synthesize(files.map((f) => {
    const n = normalizeFragment(ingestFragment(f));
    return infer ? inferFragmentDateOrder(n) : n;
  }), params);
}

function runNumbers(prefix, files, infer) {
  const res = reconstruct(files, infer);
  const s = res.omega.stats;
  const system = res.unified.filter((u) => u.sender === null).length;
  const again = reconstruct(files, infer);
  const swapped = reconstruct(files.slice().reverse(), infer);
  const n = {
    [`${prefix}.records_in`]: s.normalizedRecordsIn,
    [`${prefix}.unified`]: s.unifiedRecords,
    [`${prefix}.unified_messages`]: s.unifiedRecords - system,
    [`${prefix}.unified_system_lines`]: system,
    [`${prefix}.collapsed`]: s.duplicatesCollapsed,
    [`${prefix}.quarantined`]: s.quarantined,
    [`${prefix}.conflicts`]: s.conflicts,
    [`${prefix}.dedup_ambiguities`]: s.dedupAmbiguities,
    [`${prefix}.advisories`]: s.advisories,
    [`${prefix}.dating_direct`]: s.datingOfUnifiedRecords.direct,
    [`${prefix}.dating_inferred`]: s.datingOfUnifiedRecords.inferred,
    [`${prefix}.dating_mixed`]: s.datingOfUnifiedRecords.mixed,
    [`${prefix}.deterministic`]: hash(again) === hash(res),
    [`${prefix}.order_independent`]: hash(swapped) === hash(res),
  };
  for (const f of res.omega.fragments) n[`${prefix}.quarantined_by_fragment.${f.id}`] = f.quarantined;
  return n;
}

// scan: also count, over seeds 1-20,000, delta = epsilon = 0 pairs that
// overlap (slow; the corpus check skips it).
function pairNumbers(opts) {
  const scan = !opts || opts.scan !== false;
  const m = JSON.parse(fs.readFileSync(path.join(PAIR, 'manifest.json'), 'utf8'));
  const files = m.fragments.map((f) => path.join(PAIR, f.file));
  const n = {
    'pair.seed': m.seed,
    'pair.delta_days': m.delta_days,
    'pair.epsilon_days': m.epsilon_days,
    'pair.ground_truth_messages': m.ground_truth_messages,
    'pair.f1_message_records': m.f1_message_records,
    'pair.f2_message_records': m.f2_message_records,
    'pair.overlap_messages': m.overlap_messages,
  };
  Object.assign(n, runNumbers('pair.infer', files, true), runNumbers('pair.strict', files, false));
  for (const c of ['complete', 'single']) n[`pair.infer.${c}.unified`] = reconstruct(files, true, { clustering: c }).omega.stats.unifiedRecords;

  // delta = epsilon = 0, regenerated from the generator's own function.
  const { buildTcfPair, mulberry32 } = require('../generate-synthetic-fixtures');
  const gen = (seed) => buildTcfPair(mulberry32((seed ^ 0x54434650) >>> 0), { deltaDays: 0, epsilonDays: 0, windowDays: 120 });
  const { c1, c2, meta } = gen(m.seed);
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'champ-numbers-'));
  try {
    const df = [[m.fragments[0].file, c1], [m.fragments[1].file, c2]].map(([f, c]) => {
      fs.writeFileSync(path.join(dir, f), `${c.lines.join('\n')}\n`, 'utf8');
      return path.join(dir, f);
    });
    const d = reconstruct(df, true).omega.stats;
    Object.assign(n, {
      'pair.disjoint.overlap_messages': meta.overlap_messages,
      'pair.disjoint.f2_message_records': meta.f2_message_records,
      'pair.disjoint.infer.records_in': d.normalizedRecordsIn,
      'pair.disjoint.infer.unified': d.unifiedRecords,
    });
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
  if (scan) {
    let overlapping = 0;
    for (let seed = 1; seed <= 20000; seed++) if (gen(seed).meta.overlap_messages !== 0) overlapping++;
    n['pair.disjoint.seeds_scanned'] = 20000;
    n['pair.disjoint.seeds_overlapping'] = overlapping;
  }
  return n;
}

// --- code size --------------------------------------------------------------

const lines = (f) => (fs.readFileSync(f, 'utf8').match(/\n/g) || []).length; // as wc -l

function codeNumbers() {
  const n = {};
  const mods = fs.readdirSync(path.join(ROOT, 'core', 'src')).filter((d) => fs.existsSync(path.join(ROOT, 'core', 'src', d, 'index.js'))).sort();
  let total = 0;
  for (const d of mods) {
    const l = lines(path.join(ROOT, 'core', 'src', d, 'index.js'));
    n[`impl.lines.${d}`] = l;
    total += l;
  }
  n['impl.modules'] = mods.length;
  n['impl.lines.total'] = total;
  const tests = fs.readdirSync(path.join(ROOT, 'tests')).filter((f) => /^test-.*\.js$/.test(f)).sort();
  total = 0;
  for (const f of tests) {
    const l = lines(path.join(ROOT, 'tests', f));
    n[`tests.lines.${f.replace(/\.js$/, '')}`] = l;
    total += l;
  }
  n['tests.files'] = tests.length;
  n['tests.lines.total'] = total;
  n['tests.checks'] = tests.length + 1; // tests/run-all.js: each test file, plus the corpus check
  const harness = fs.readdirSync(__dirname).filter((f) => f.endsWith('.js')).sort();
  n['experiments.scripts'] = harness.length;
  n['experiments.lines.total'] = harness.reduce((s, f) => s + lines(path.join(__dirname, f)), 0);
  n['reason_codes.count'] = Object.keys(REASON).length;
  n['reason_codes.list'] = Object.keys(REASON).join(' ');
  return n;
}

// --- experiment headlines -------------------------------------------------------

function readResult(file) {
  const p = path.join(RESULTS, file);
  if (!fs.existsSync(p)) throw new Error(`${path.relative(ROOT, p)} is missing: run node scripts/experiments/run-all.js`);
  return JSON.parse(fs.readFileSync(p, 'utf8'));
}

// Every number in a nested object, as flat keys under prefix.
function flatten(prefix, v, out) {
  if (v === null || typeof v !== 'object') { out[prefix] = v; return out; }
  if (Array.isArray(v)) {
    if (v.every((x) => x === null || typeof x !== 'object')) out[prefix] = v.join(' ');
    else out[`${prefix}.count`] = v.length;
    return out;
  }
  for (const [k, x] of Object.entries(v)) flatten(`${prefix}.${k}`, x, out);
  return out;
}

function experimentNumbers() {
  const n = {};
  const e1 = readResult('e1-summary.json');
  n['e1.configs'] = e1.by_mode.infer.configs;
  n['e1.failing_configs'] = e1.failing_configs;
  flatten('e1', { by_mode: e1.by_mode, by_size: e1.by_size }, n);

  const e2 = readResult('e2-summary.json');
  n['e2.configs'] = e2.configs;
  n['e2.failing_seeds'] = Object.values(e2.failing_seeds).reduce((s, x) => s + x.length, 0);
  flatten('e2', { fragments: e2.fragments, knobs: e2.knobs, advisory: e2.advisory_facts_infer }, n);
  for (const [m, props] of Object.entries(e2.by_mode)) {
    for (const [p, v] of Object.entries(props)) if (/^P\d$/.test(p)) { n[`e2.${m}.${p}.applied`] = v.applied; n[`e2.${m}.${p}.held`] = v.held; }
  }

  const e3 = readResult('e3-scale.json');
  for (const r of e3.rows) {
    flatten(`e3.${r.size}`, { ground_truth_messages: r.ground_truth_messages, observations: r.observations, counts: r.counts, u_messages_equal_ground_truth: r.u_messages_equal_ground_truth, reps_completed: r.reps_completed, identical_output_across_reps: r.identical_output_across_reps }, n);
  }
  const t3 = readResult(path.join('timing', 'e3-scale.json'));
  const median = (xs) => xs.slice().sort((a, b) => a - b)[Math.floor(xs.length / 2)];
  for (const s of t3.sizes) {
    const ok = s.reps.filter((r) => r.totalMs !== undefined);
    if (!ok.length) continue;
    n[`e3.${s.size}.timing.median_total_s`] = Math.round(median(ok.map((r) => r.totalMs))) / 1000;
    n[`e3.${s.size}.timing.median_peak_rss_mib`] = median(ok.map((r) => r.peakRssMiB));
    n[`e3.${s.size}.timing.needed_larger_heap`] = s.reps.some((r) => r.retry);
  }
  n['e3.timing.machine'] = `${t3.machine.cpu}; ${t3.machine.logicalCpus} logical CPUs; ${t3.machine.memoryGiB} GiB; ${t3.machine.os}; Node ${t3.machine.node}`;

  const e4 = readResult('e4-scenarios.json');
  n['e4.rows'] = e4.rows.length;
  n['e4.pass'] = e4.rows.filter((r) => r.pass).length;
  for (const r of e4.rows) {
    const k = `e4.${r.row}${r.clustering === 'one-to-one' ? '' : `.${r.clustering}`}`;
    n[`${k}.expected_unified`] = r.expected_unified;
    n[`${k}.actual_unified`] = r.actual_unified;
    n[`${k}.pass`] = r.pass;
    flatten(`${k}.entries`, r.actual_entries, n);
  }

  const e5 = readResult('e5-summary.json');
  n['e5.invariant_failures'] = e5.invariant_failures;
  n['e5.errors'] = e5.errors;
  for (const d of e5.one_to_one_determinism) {
    n[`e5.one_to_one.dt${d.dt_s}.runs`] = d.runs;
    n[`e5.one_to_one.dt${d.dt_s}.deterministic`] = d.deterministic;
    n[`e5.one_to_one.dt${d.dt_s}.order_independent`] = d.order_independent;
  }
  for (const c of e5.cells) {
    const k = `e5.dt${c.dt_s}.${c.clustering}.${c.density}.p${c.p}`;
    for (const m of ['precision', 'recall', 'f1', 'min_f1', 'u_minus_gt', 'ordering_conflicts', 'runs_with_ordering_conflict', 'dedup_ambiguities', 'sender_conflicts']) n[`${k}.${m}`] = c[m];
  }

  const e7 = readResult('e7-representative-omega.json');
  n['e7.seed'] = e7.config.seed;
  n['e7.ground_truth_messages'] = e7.ground_truth_messages;
  n['e7.unified'] = e7.omega.stats.unifiedRecords;
  n['e7.quarantined'] = e7.omega.stats.quarantined;
  n['e7.conflicts'] = e7.omega.stats.conflicts;
  n['e7.dedup_ambiguities'] = e7.omega.stats.dedupAmbiguities;
  n['e7.file_lines'] = lines(path.join(RESULTS, 'e7-representative-omega.json'));

  const e8 = readResult('e8-summary.json');
  n['e8.frozen_with_commit'] = e8.frozen_with_commit;
  for (const k of ['runs', 'runs_with_advisory', 'false_alarm_rate']) n[`e8.false_alarms.${k}`] = e8.false_alarms[k];
  for (const c of e8.false_alarms.cells) {
    const k = `e8.false_alarms.${c.geometry}.size${c.size}.bursts${c.repeat_bursts}`;
    for (const m of ['runs', 'runs_with_advisory', 'false_alarm_rate', 'advisories']) n[`${k}.${m}`] = c[m];
  }
  for (const k of ['runs', 'detected', 'detection_rate', 'runs_with_other_advisory']) n[`e8.detection.${k}`] = e8.detection[k];
  flatten('e8.detection.misses_by_reason', e8.detection.misses_by_reason, n);
  for (const s of e8.detection.by_shift) {
    for (const m of ['runs', 'detected', 'detection_rate']) n[`e8.detection.shift${s.shift_minutes}.${m}`] = s[m];
  }
  return n;
}

function main() {
  const numbers = Object.assign({}, corpusNumbers(), pairNumbers(), codeNumbers(), experimentNumbers(), surveyNumbers());
  fs.mkdirSync(RESULTS, { recursive: true });
  fs.writeFileSync(OUT, `${JSON.stringify(numbers, null, 2)}\n`, 'utf8');
  console.log(`wrote ${path.relative(ROOT, OUT)} (${Object.keys(numbers).length} keys)`);
}

if (require.main === module) {
  try { main(); } catch (e) { console.error(e.message); process.exit(1); }
}
module.exports = { main, corpusNumbers, corpusRows, pairNumbers, codeNumbers, OUT };
