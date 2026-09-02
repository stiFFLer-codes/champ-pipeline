'use strict';

// Checks the claims Section 5.2 of the paper makes about the synthetic corpus
// against the committed fixtures themselves, and fails if they disagree.
//
// Why this exists: those claims were written as prose by hand, and a peer
// reviewer checked them against a stale copy of the repository and reported
// them false. They were not -- but nothing in the repo could have settled that
// argument without someone re-deriving the counts by hand, which is the same
// failure mode the paper spends nine sections arguing against. A claim about
// generated output should be derived from the output, not asserted alongside it.
//
//   node scripts/check-corpus-claims.js            report + assert
//   node scripts/check-corpus-claims.js --report   report only, never fails
//
// Exit 0 = every claim holds. Exit 1 = the paper and the corpus disagree; the
// output names which claim, and the paper is what needs changing.

const fs = require('fs');
const path = require('path');

const FIXTURE_DIR = path.join(__dirname, '..', 'data', 'synthetic_fixtures');

// A record's date is the DD/MM/YY at the start of a line. Continuation lines of
// a multi-line message carry no date and are correctly skipped by the anchor.
const DATE_RE = /^(\d{2})\/(\d{2})\/(\d{2}),/;

// A date string is ambiguous when both leading components are <= 12, so it
// parses under day-month-year and month-day-year alike and nothing inside the
// record decides between them. This test is format-independent on purpose: it
// asks what the eight characters admit, not what the manifest declares.
function isAmbiguous(a, b) {
  return Number(a) <= 12 && Number(b) <= 12;
}

function analyse(file) {
  const text = fs.readFileSync(path.join(FIXTURE_DIR, file), 'utf8');
  const dates = new Set();
  for (const line of text.split(/\r?\n/)) {
    const m = DATE_RE.exec(line);
    if (m) dates.add(`${m[1]}/${m[2]}/${m[3]}`);
  }
  const ambiguous = [];
  const disambiguating = [];
  for (const d of dates) {
    const [a, b] = d.split('/');
    (isAmbiguous(a, b) ? ambiguous : disambiguating).push(d);
  }
  return {
    file,
    distinct: dates.size,
    ambiguous: ambiguous.sort(),
    disambiguating: disambiguating.sort(),
  };
}

function main() {
  const reportOnly = process.argv.includes('--report');
  const manifest = JSON.parse(
    fs.readFileSync(path.join(FIXTURE_DIR, 'manifest.json'), 'utf8')
  );

  const rows = manifest.fixtures.map((f) => {
    const r = analyse(f.file);
    r.quirks = f.quirks;
    r.format = f.quirks.includes('date-format-ddmmyy')
      ? 'DMY'
      : f.quirks.includes('date-format-mmddyy')
        ? 'MDY'
        : '??';
    return r;
  });

  const categories = new Set();
  for (const f of manifest.fixtures) for (const q of f.quirks) categories.add(q);

  const pad = (s, n) => String(s).padEnd(n);
  console.log(`corpus: ${FIXTURE_DIR}`);
  console.log(`seed ${manifest.seed}, ${manifest.count} fixtures, ${categories.size} distinct categories\n`);
  console.log(`${pad('fixture', 52)} fmt  distinct  ambig  disambig`);
  for (const r of rows) {
    console.log(
      `${pad(r.file, 52)} ${pad(r.format, 4)} ${pad(r.distinct, 9)} ${pad(r.ambiguous.length, 6)} ${r.disambiguating.length}`
    );
  }

  const dmy = rows.filter((r) => r.format === 'DMY').length;
  const mdy = rows.filter((r) => r.format === 'MDY').length;
  const everyHasAmbiguous = rows.every((r) => r.ambiguous.length > 0);
  const noDisambiguating = rows.filter((r) => r.disambiguating.length === 0);

  console.log('\nclaims made in Section 5.2:');
  const claims = [
    [`${manifest.count} fixtures in the corpus`, rows.length === 5],
    [`${categories.size} distinct edge-case categories`, categories.size === 19],
    [`${dmy} fixtures day-month-year, ${mdy} month-day-year`, dmy === 3 && mdy === 2],
    ['every fixture has >=1 ambiguous date record', everyHasAmbiguous],
    [
      `${rows.length - noDisambiguating.length} of ${rows.length} have >=1 disambiguating record`,
      noDisambiguating.length === 1,
    ],
    [
      'fixture-03 is the one with no disambiguating record',
      noDisambiguating.length === 1 &&
        noDisambiguating[0].file.startsWith('fixture-03-'),
    ],
  ];

  let failed = 0;
  for (const [text, ok] of claims) {
    console.log(`  ${ok ? 'ok  ' : 'FAIL'}  ${text}`);
    if (!ok) failed++;
  }

  if (failed && !reportOnly) {
    console.error(
      `\n${failed} claim(s) in Section 5.2 do not hold against this corpus.` +
        '\nThe corpus is the artefact a reader can check. Change the paper, not this script.'
    );
    process.exit(1);
  }
  console.log(failed ? '\n(--report: not failing)' : '\nAll Section 5.2 corpus claims hold.');
}

main();
