'use strict';

// Checks the numbers the paper cites about the synthetic corpus and the
// committed TCF pair against the corpus itself, and fails if they disagree.
//
// Why this exists: those claims were once written as prose by hand, and a peer
// reviewer checked them against a stale copy of the repository and reported
// them false. They were not -- but nothing in the repo could have settled that
// argument without someone re-deriving the counts by hand, which is the same
// failure mode the paper spends its length arguing against. A claim about
// generated output should be derived from the output, not asserted alongside it.
//
// The numbers live in results/paper-numbers.json, written by
// scripts/experiments/paper-numbers.js. This script recomputes the corpus.*
// and pair.* keys (all but the 20,000-seed scan) and the survey.* keys
// (scripts/survey/tally.js), and compares. A recorded survey.* key that the
// tally no longer produces also fails.
//
//   node scripts/check-corpus-claims.js            report + assert
//   node scripts/check-corpus-claims.js --report   report only, never fails
//
// Exit 0 = every number holds. Exit 1 = the corpus or the pipeline no longer
// gives a number the file records; the output names which. If the change is
// intended, regenerate the file (and update the paper); otherwise fix the code.

const fs = require('fs');
const path = require('path');
const { corpusNumbers, corpusRows, pairNumbers, OUT } = require('./experiments/paper-numbers');
const { surveyNumbers } = require('./survey/tally');

function main() {
  const reportOnly = process.argv.includes('--report');
  if (!fs.existsSync(OUT)) {
    console.error(`${path.relative(process.cwd(), OUT)} is missing: run node scripts/experiments/paper-numbers.js`);
    process.exit(reportOnly ? 0 : 1);
  }
  const recorded = JSON.parse(fs.readFileSync(OUT, 'utf8'));

  const { manifest, rows } = corpusRows();
  const pad = (s, n) => String(s).padEnd(n);
  console.log(`seed ${manifest.seed}, ${manifest.count} fixtures\n`);
  console.log(`${pad('fixture', 52)} fmt  distinct  ambig  disambig`);
  for (const r of rows) console.log(`${pad(r.file, 52)} ${pad(r.format, 4)} ${pad(r.distinct, 9)} ${pad(r.ambiguous, 6)} ${r.disambiguating}`);

  const now = Object.assign({}, corpusNumbers(), pairNumbers({ scan: false }), surveyNumbers());
  let failed = 0;
  console.log(`\nagainst ${path.basename(OUT)}:`);
  for (const [k, v] of Object.entries(now)) {
    const ok = k in recorded && recorded[k] === v;
    if (!ok) failed++;
    if (!ok || process.argv.includes('--all')) console.log(`  ${ok ? 'ok  ' : 'FAIL'}  ${k} = ${JSON.stringify(v)}${ok ? '' : ` (recorded: ${JSON.stringify(recorded[k])})`}`);
  }
  for (const k of Object.keys(recorded).filter((x) => x.startsWith('survey.') && !(x in now))) {
    failed++;
    console.log(`  FAIL  ${k} is recorded but the tally no longer produces it`);
  }
  console.log(`  ${Object.keys(now).length - failed} of ${Object.keys(now).length} corpus, pair and survey numbers hold${failed ? '' : ' (--all lists them)'}`);

  if (failed && !reportOnly) {
    console.error(`\n${failed} number(s) differ from ${path.basename(OUT)}.`);
    process.exit(1);
  }
}

main();
