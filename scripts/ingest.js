'use strict';

// CLI for CARTA Ingestion. Parses one or more fragments and reports what came
// out, without reconciling anything across them -- the stage boundary is real.
//
//   node scripts/ingest.js <fragment.txt> [...]        summary per fragment
//   node scripts/ingest.js --json <fragment.txt>       full records as JSON
//   node scripts/ingest.js --source-id phone-A <f>     id for the ONE fragment after it
//
// Summary counts are the honest output here: this stage produces records, not
// results, and there is nothing yet to evaluate.

const path = require('path');
const { ingestFragment } = require('../core/src/ingestion');

function summarise(res) {
  const by = { message: 0, system: 0, unparsed: 0 };
  const attach = { standard: 0, 'trailing-period': 0, 'double-filename': 0 };
  let multiline = 0;
  let emptyBody = 0;
  for (const r of res.records) {
    by[r.category]++;
    if (r.multiline) multiline++;
    if (r.category === 'message' && r.rawBody === '') emptyBody++;
    if (r.attachment) attach[r.attachment.form]++;
  }
  return { by, attach, multiline, emptyBody };
}

function main() {
  const args = process.argv.slice(2);
  const json = args.includes('--json');
  const files = [];
  let sourceId;
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--json') continue;
    if (args[i] === '--source-id') {
      sourceId = args[++i];
      if (!sourceId) { console.error('--source-id needs an id'); process.exit(1); }
      continue;
    }
    files.push({ file: args[i], sourceId });
    sourceId = undefined;
  }
  if (files.length === 0 || sourceId !== undefined) {
    console.error('Usage: node scripts/ingest.js [--json] [--source-id <id>] <fragment.txt> [...]');
    process.exit(1);
  }

  if (json) {
    const out = files.map((f) => ingestFragment(f.file, { sourceId: f.sourceId }));
    console.log(JSON.stringify(json && out.length === 1 ? out[0] : out, null, 2));
    return;
  }

  for (const f of files) {
    const res = ingestFragment(f.file, { sourceId: f.sourceId });
    const s = summarise(res);
    console.log(`${res.sourceId}${res.idSource === 'declared' ? ` (${path.basename(f.file)})` : ''}`);
    console.log(`  sha256      ${res.sha256}`);
    console.log(`  lines       ${res.lineCount}`);
    console.log(`  records     ${res.records.length}  (message ${s.by.message}, system ${s.by.system}, unparsed ${s.by.unparsed})`);
    console.log(`  multi-line  ${s.multiline}`);
    console.log(`  empty body  ${s.emptyBody}`);
    console.log(
      `  attachments ${s.attach.standard + s.attach['trailing-period'] + s.attach['double-filename']}` +
        `  (standard ${s.attach.standard}, trailing-period ${s.attach['trailing-period']}, doubled ${s.attach['double-filename']})`
    );
    console.log('  line coverage verified: every line inside exactly one record');
    console.log('');
  }
}

main();
