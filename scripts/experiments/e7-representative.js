'use strict';

// E7: one representative report. A small generated scenario (15 messages,
// two fragments, strict mode) whose Omega holds exactly one quarantined
// record, one sender-disagreement conflict, one attachment.form conflict and
// one dedup_ambiguity, and nothing else of those kinds.
//
//   node scripts/experiments/e7-representative.js
//
// How it is made: the timeline runs from 16 Jan to 1 Feb 2024 (UTC), so
// every date is unambiguous except on 1 Feb; knob (b) gives the sender
// conflict, knob (d) the attachment form, knob (a) on a boundary the dedup
// ambiguity. The seed is the first in 1..2000 whose run has exactly the four
// entries (the quarantined record is a 1 Feb message); the search is
// deterministic, and the seed is recorded in the output.
//
// results/e7-representative-omega.json   the config, seed, and the full Omega

const path = require('path');
const L = require('./lib');
const { buildScenario } = require('../generate-synthetic-fixtures');
const { entriesOf } = require('./e4-scenarios');

const CONFIG = {
  size: 10, start: '2024-01-16T01:00:00.000Z', preDays: 3, windowDays: 10, postDays: 3,
  deltaDays: 1, epsilonDays: 1, attachmentRate: 0,
  knobs: { a: [{ k: 2, where: 'boundary' }], b: { where: 'inside' }, d: { form: 'double-filename' } },
};
const WANT = {
  'conflict:sender-disagreement': 1,
  'conflict:within-cluster:attachment.form': 1,
  dedup_ambiguity: 1,
  'quarantine:AMBIGUOUS_DATE_FORMAT': 1,
};

function compact(v, indent) {
  const one = JSON.stringify(v);
  if (v === null || typeof v !== 'object' || one.length <= 96) return one;
  const next = `${indent}  `;
  const items = Array.isArray(v)
    ? v.map((x) => next + compact(x, next))
    : Object.entries(v).filter(([, x]) => x !== undefined).map(([k, x]) => `${next}${JSON.stringify(k)}: ${compact(x, next)}`);
  return Array.isArray(v) ? `[\n${items.join(',\n')}\n${indent}]` : `{\n${items.join(',\n')}\n${indent}}`;
}

function find() {
  for (let seed = 1; seed <= 2000; seed++) {
    const cfg = Object.assign({ seed }, CONFIG);
    const scn = buildScenario(cfg);
    const res = L.withScenarioFiles(scn, (inputs) => L.runPipeline(inputs, { infer: false }));
    if (JSON.stringify(entriesOf(res.omega)) === JSON.stringify(Object.fromEntries(Object.entries(WANT).sort()))) {
      return { cfg, scn, res };
    }
  }
  throw new Error('no seed in 1..2000 gives the wanted Omega');
}

async function run() {
  const { cfg, scn, res } = find();
  const out = {
    experiment: 'E7 representative report',
    config: cfg,
    mode: 'strict (no --infer), one-to-one, dt_granularity 0, dt_conflict 60000 ms',
    command: 'node scripts/generate-synthetic-fixtures.js --scenario <config as JSON> --out <dir> && node scripts/reconstruct.js --json <dir>/scenario-F1-primary.txt <dir>/scenario-F2-secondary.txt',
    ground_truth_messages: scn.meta.ground_truth_messages,
    omega: res.omega,
  };
  // Any value whose JSON fits in 96 characters goes on one line, so the whole
  // report can be printed. Same JSON, other whitespace.
  require('fs').writeFileSync(path.join(L.RESULTS, 'e7-representative-omega.json'), `${compact(out, '')}\n`, 'utf8');
  console.log(`E7: seed ${cfg.seed}, ${scn.meta.ground_truth_messages} messages, |U| ${res.omega.stats.unifiedRecords}, Omega ${JSON.stringify(res.omega).length} characters`);
  return out;
}

if (require.main === module) run().catch((e) => { console.error(e); process.exit(1); });
module.exports = { run };
