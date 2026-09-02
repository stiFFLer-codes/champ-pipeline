'use strict';

// CLI for CARTA Ingestion + Normalization on one or more fragments.
//
//   node scripts/normalize.js <fragment.txt> [...]
//   node scripts/normalize.js --offset -330 <fragment.txt>   declared UTC offset
//   node scripts/normalize.js --json <fragment.txt>
//   node scripts/normalize.js --infer <fragment.txt>        + fragment-scope
//                                                             date inference
//
// --infer runs the SEPARATE, DECLARED step of Section 3.3 over Q_k. It is off
// by default: a run without it is still conforming, it just quarantines more.
//
// Each fragment is processed independently. Nothing here compares fragments --
// that is Synthesis, and keeping the boundary visible is the point.

const path = require('path');
const { ingestFragment } = require('../core/src/ingestion');
const { normalizeFragment } = require('../core/src/normalization');
const { inferFragmentDateOrder } = require('../core/src/inference');

function main() {
  const argv = process.argv.slice(2);
  const json = argv.includes('--json');
  const files = [];
  const policy = {};
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--json') continue;
    if (argv[i] === '--infer') continue;
    if (argv[i] === '--offset') { policy.utcOffsetMinutes = Number(argv[++i]); continue; }
    files.push(argv[i]);
  }
  if (files.length === 0) {
      console.error('Usage: node scripts/normalize.js [--json] [--infer] [--offset <minutes>] <fragment.txt> [...]');
    process.exit(1);
  }

  const infer = argv.includes('--infer');
  const out = files.map((f) => {
    const n = normalizeFragment(ingestFragment(f), policy);
    return infer ? inferFragmentDateOrder(n) : n;
  });
  if (json) {
    console.log(JSON.stringify(out.length === 1 ? out[0] : out, null, 2));
    return;
  }

  for (const r of out) {
    const total = r.records.length + r.quarantine.length;
    const s = r.stats || { ingested: total, normalized: r.records.length, quarantined: r.quarantine.length, byReason: {} };
    if (r.inference) {
      s.normalized = r.records.length;
      s.quarantined = r.quarantine.length;
      s.byReason = {};
      for (const q of r.quarantine) s.byReason[q.reason] = (s.byReason[q.reason] || 0) + 1;
    }
    const pct = s.ingested ? ((s.quarantined / s.ingested) * 100).toFixed(1) : '0.0';
    console.log(path.basename(r.sourceId));
    console.log(`  ingested    ${s.ingested}`);
    console.log(`  normalized  ${s.normalized}`);
    console.log(`  quarantined ${s.quarantined}  (${pct}%)`);
    for (const [code, n] of Object.entries(s.byReason).sort((a, b) => b[1] - a[1])) {
      console.log(`      ${code.padEnd(24)} ${n}`);
    }
    const orders = {};
    for (const rec of r.records) orders[rec.dateOrder] = (orders[rec.dateOrder] || 0) + 1;
    if (Object.keys(orders).length) {
      console.log(`  date orders resolved: ${Object.entries(orders).map(([k, v]) => `${k} ${v}`).join(', ')}`);
    }
    if (r.inference) {
      const inf = r.inference;
      console.log(`  fragment-scope inference: ${inf.applied ? 'APPLIED ' + inf.order : 'not applied'}`);
      console.log(`      ${inf.reason}`);
      console.log(`      candidates ${inf.candidates}, resolved ${inf.resolved}, still quarantined ${inf.stillQuarantined}`);
    }
    console.log(`  declared utcOffsetMinutes ${r.policy.utcOffsetMinutes}`);
    console.log('');
  }
}

main();
