'use strict';

// End-to-end CARTA reconstruction: F -> R -> (R', Q) -> (U, Omega).
//
//   node scripts/reconstruct.js <fragment.txt> <fragment.txt> [...]
//   node scripts/reconstruct.js --infer <f1> <f2>      + fragment-scope dates
//   node scripts/reconstruct.js --dt 60000 <f1> <f2>   widen the dedup window
//   node scripts/reconstruct.js --zone Asia/Kolkata <f1> --zone Europe/London <f2>
//                                                     declared zone per fragment
//   node scripts/reconstruct.js --json <f1> <f2>       full (U, Omega)
//   node scripts/reconstruct.js --clustering complete <f1> <f2>
//                                    one-to-one (default) | complete | single
//   node scripts/reconstruct.js --expect <manifest.json> <f1> <f2>
//   node scripts/reconstruct.js --source-id phone-A a/chat.txt --source-id phone-B b/chat.txt
//
// --zone applies to every fragment after it until the next --zone; fragments
// before any --zone get the default (+00:00). Omega records each fragment's
// zone and whether it was declared or defaulted.
//
// --source-id names the ONE fragment after it (ids must be unique, so it does
// not carry over). Without it a fragment's id is its file name, and two exports
// both called "WhatsApp Chat with X.txt" are refused as indistinguishable.
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
  let zone;
  let sourceId;
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--infer') { infer = true; continue; }
    if (a === '--json') { json = true; continue; }
    if (a === '--dt') { params.dtGranularityMs = Number(argv[++i]); continue; }
    if (a === '--clustering') { params.clustering = argv[++i]; continue; }
    if (a === '--expect') { expectPath = argv[++i]; continue; }
    if (a === '--zone') { zone = argv[++i]; continue; }
    if (a === '--source-id') {
      sourceId = argv[++i];
      if (!sourceId) { console.error('--source-id needs an id'); process.exit(1); }
      continue;
    }
    files.push({ file: a, policy: zone === undefined ? {} : { zone }, sourceId });
    sourceId = undefined;
  }
  if (files.length === 0 || sourceId !== undefined) {
    console.error('Usage: node scripts/reconstruct.js [--infer] [--dt <ms>] [--clustering one-to-one|complete|single] [--zone <IANA name | +HH:MM>] [--json] [--expect <manifest>] [--source-id <id>] <fragment> [...]');
    if (sourceId !== undefined) console.error('--source-id must be followed by the fragment it names');
    process.exit(1);
  }

  const fragments = files.map(({ file, policy, sourceId: id }) => {
    const n = normalizeFragment(ingestFragment(file, { sourceId: id }), policy);
    return infer ? inferFragmentDateOrder(n) : n;
  });

  const { unified, omega } = synthesize(fragments, params);

  if (json) {
    console.log(JSON.stringify({ unified, omega }, null, 2));
    return;
  }

  const s = omega.stats;
  console.log(`CARTA reconstruction (${omega.spec}; ${omega.implementation.name} ${omega.implementation.version})`);
  console.log(`  fragments             ${s.fragments}`);
  for (const f of fragments) {
    const inf = f.inference ? (f.inference.applied ? `inference ${f.inference.order}` : 'inference declined') : 'no inference';
    console.log(`      ${path.basename(f.sourceId).padEnd(36)} ${String(f.records.length).padStart(4)} normalized, ${String(f.quarantine.length).padStart(3)} quarantined, ${inf}, zone ${f.zone.name} (${f.zone.source})`);
  }
  console.log(`  records into synthesis ${s.normalizedRecordsIn}`);
  console.log(`  |U|                    ${s.unifiedRecords}`);
  console.log(`  duplicates collapsed   ${s.duplicatesCollapsed}`);
  console.log(`  quarantined            ${s.quarantined}`);
  for (const [k, v] of Object.entries(s.quarantineByReason)) console.log(`      ${k.padEnd(24)} ${v}`);
  console.log(`  conflicts              ${s.conflicts}`);
  for (const [k, v] of Object.entries(s.conflictsByKind)) console.log(`      ${k.padEnd(24)} ${v}`);
  console.log(`  dedup ambiguities      ${s.dedupAmbiguities}`);
  console.log(`  advisories             ${s.advisories}`);
  for (const a of omega.advisories) {
    console.log(`      ${a.kind}: ${a.fragments[1]} reads ${a.offset} against ${a.fragments[0]} (support ${a.support} from ${a.distinctKeys} keys, at zero ${a.supportAtZero}, best control ${a.maxControlSupport})`);
  }
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
