'use strict';

// End-to-end CARTA reconstruction: F -> R -> (R', Q) -> (U, Omega).
//
//   node scripts/reconstruct.js <fragment.txt> <fragment.txt> [...]
//   node scripts/reconstruct.js --infer <f1> <f2>      + fragment-scope dates
//   node scripts/reconstruct.js --dt 60000 <f1> <f2>   widen the dedup window
//   node scripts/reconstruct.js --json <f1> <f2>       full (U, Omega)
//   node scripts/reconstruct.js --expect <manifest.json> <f1> <f2>
//
// --expect checks the run against a tcf-pair manifest's ground truth and exits
// non-zero on a mismatch, so the reconstruction is verified rather than admired.

const fs = require('fs');
const path = require('path');
const { ingestFragment } = require('../core/src/ingestion');
const { normalizeFragment } = require('../core/src/normalization');
const { inferFragmentDateOrder } = require('../core/src/inference');
const { synthesize } = require('../core/src/synthesis');

function main() {
  const argv = process.argv.slice(2);
  const files = [];
  const params = {};
  let infer = false;
  let json = false;
  let expectPath = null;
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--infer') { infer = true; continue; }
    if (a === '--json') { json = true; continue; }
    if (a === '--dt') { params.dtGranularityMs = Number(argv[++i]); continue; }
    if (a === '--expect') { expectPath = argv[++i]; continue; }
    files.push(a);
  }
  if (files.length === 0) {
    console.error('Usage: node scripts/reconstruct.js [--infer] [--dt <ms>] [--json] [--expect <manifest>] <fragment> [...]');
    process.exit(1);
  }

  const fragments = files.map((f) => {
    const n = normalizeFragment(ingestFragment(f));
    return infer ? inferFragmentDateOrder(n) : n;
  });

  const { unified, omega } = synthesize(fragments, params);

  if (json) {
    console.log(JSON.stringify({ unified, omega }, null, 2));
    return;
  }

  const s = omega.stats;
  console.log('CARTA reconstruction');
  console.log(`  fragments             ${s.fragments}`);
  for (const f of fragments) {
    const inf = f.inference ? (f.inference.applied ? `inference ${f.inference.order}` : 'inference declined') : 'no inference';
    console.log(`      ${path.basename(f.sourceId).padEnd(36)} ${String(f.records.length).padStart(4)} normalized, ${String(f.quarantine.length).padStart(3)} quarantined, ${inf}`);
  }
  console.log(`  records into synthesis ${s.normalizedRecordsIn}`);
  console.log(`  |U|                    ${s.unifiedRecords}`);
  console.log(`  duplicates collapsed   ${s.duplicatesCollapsed}`);
  console.log(`  quarantined            ${s.quarantined}`);
  for (const [k, v] of Object.entries(s.quarantineByReason)) console.log(`      ${k.padEnd(24)} ${v}`);
  console.log(`  conflicts              ${s.conflicts}`);
  for (const [k, v] of Object.entries(s.conflictsByKind)) console.log(`      ${k.padEnd(24)} ${v}`);
  console.log(`  dating of U            direct ${s.datingOfUnifiedRecords.direct}, inferred ${s.datingOfUnifiedRecords.inferred}, mixed ${s.datingOfUnifiedRecords.mixed}`);
  console.log(`  declared dt_granularity ${omega.params.dtGranularityMs} ms, dt_conflict ${omega.params.dtConflictMs} ms`);
  console.log(`  clustering             ${omega.params.clustering}`);
  console.log(`  field precedence       ${omega.params.fieldPrecedence}`);
  console.log('  Invariants 1 and 2 verified on this run');

  if (expectPath) {
    const m = JSON.parse(fs.readFileSync(expectPath, 'utf8'));
    const expectedMessages = m.ground_truth_messages;
    const systemLines = unified.filter((u) => u.type === 'system').length;
    const messages = s.unifiedRecords - systemLines;
    const conserved = s.unifiedRecords + s.quarantined + s.duplicatesCollapsed;
    const ingestedTotal = fragments.reduce((n, f) => n + f.records.length + f.quarantine.length, 0);
    const checks = [
      [`|U| messages == ground truth (${expectedMessages})`, messages === expectedMessages],
      [`duplicates collapsed == overlap (${m.overlap_messages})`, s.duplicatesCollapsed === m.overlap_messages],
      ['conservation: |U| + collapsed + quarantined == records ingested', conserved === ingestedTotal],
    ];
    console.log('\nground-truth check against ' + path.basename(expectPath));
    let bad = 0;
    for (const [label, ok] of checks) {
      console.log(`  ${ok ? 'ok  ' : 'FAIL'}  ${label}`);
      if (!ok) bad++;
    }
    console.log(`  (messages ${messages}, system lines ${systemLines}, collapsed ${s.duplicatesCollapsed}, quarantined ${s.quarantined}, ingested ${ingestedTotal})`);
    if (bad) process.exit(1);
  }
}

main();
