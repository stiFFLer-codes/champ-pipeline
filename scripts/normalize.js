'use strict';

// CLI for CARTA Ingestion + Normalization on one or more fragments.
//
//   node scripts/normalize.js <fragment.txt> [...]
//   node scripts/normalize.js --zone Asia/Kolkata <f1> --zone +01:00 <f2>
//                                                            declared zone per
//                                                            fragment
//   node scripts/normalize.js --json <fragment.txt>
//   node scripts/normalize.js --source-id phone-A <fragment.txt>
//                                                            id for the ONE
//                                                            fragment after it
//   node scripts/normalize.js --infer <fragment.txt>        + fragment-scope
//                                                             date inference
//
// --zone applies to every fragment after it until the next --zone; fragments
// before any --zone get the default (+00:00), and the output says which.
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
  const infer = argv.includes('--infer');
  const files = [];
  let zone;
  let sourceId;
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--json' || argv[i] === '--infer') continue;
    if (argv[i] === '--zone') { zone = argv[++i]; continue; }
    if (argv[i] === '--source-id') {
      sourceId = argv[++i];
      if (!sourceId) { console.error('--source-id needs an id'); process.exit(1); }
      continue;
    }
    files.push({ file: argv[i], policy: zone === undefined ? {} : { zone }, sourceId });
    sourceId = undefined;
  }
  if (files.length === 0 || sourceId !== undefined) {
    console.error('Usage: node scripts/normalize.js [--json] [--infer] [--zone <IANA name | +HH:MM>] [--source-id <id>] <fragment.txt> [...]');
    process.exit(1);
  }

  const out = files.map(({ file, policy, sourceId: id }) => {
    const n = normalizeFragment(ingestFragment(file, { sourceId: id }), policy);
    return infer ? inferFragmentDateOrder(n) : n;
  });
  if (json) {
    console.log(JSON.stringify(out.length === 1 ? out[0] : out, null, 2));
    return;
  }

  for (const r of out) {
    const s = r.stats;
    const pct = s.ingested ? ((s.quarantined / s.ingested) * 100).toFixed(1) : '0.0';
    console.log(path.basename(r.sourceId));
    console.log(`  zone        ${r.zone.name} (${r.zone.kind}, ${r.zone.source})`);
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
    console.log('');
  }
}

main();
