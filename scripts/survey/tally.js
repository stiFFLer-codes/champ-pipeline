'use strict';

// WP4 survey tally: the survey.* keys of results/paper-numbers.json, computed
// from results/survey/candidates.csv (decisions) and extraction.csv (coding).
// The search-stage counts before the README/source screen (hits, unique
// repositories, metadata screen) are not in candidates.csv and are read from
// flow_search.json, which screen.js writes.
//
// Properties, over the included tools (extraction.csv column):
//   P1 retains unparseable input as output (unparseable: y when the value
//      starts "retain as output", partial when it starts "partial", else n)
//   P2 per-record provenance (provenance)
//   P3 conflict reporting (conflicts)
//   P4 stated determinism (determinism)
//   P5 structured report (report)
// strict counts y only; lenient counts y and partial. "not determined" counts
// as no in both. The y / partial / n definitions are in
// results/survey/CODEBOOK.md.
//
// <mode>.max_props is the most properties one tool holds, with the tools that
// hold that many. survey.generous.max_props is the lenient one with wacrawl's
// two open calls read generously (VERIFY_PACKET Q12: P3 at least partial; Q40:
// P5 y). survey.any_P1_with_P2_or_P3 asks, leniently, whether any tool holds P1
// together with P2 or P3.
//
// survey.sensitivity.* repeats the property and combination counts with the
// three tools the author excluded on 2026-10-16 (I2, "merges exports of
// different accounts") added back.
//
//   node scripts/survey/tally.js      replaces the survey.* keys in paper-numbers.json

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..', '..');
const SURVEY = path.join(ROOT, 'results', 'survey');
const OUT = path.join(ROOT, 'results', 'paper-numbers.json');
const PAPER = ['bepaald/signalbackup-tools', 'natario1/whatsapp-database-merger', 'frozenspider/chat-history-manager',
  'EkriirkE/WAMerge', 'SecurityRonin/chat4n6', 'tarikab7/whatsapp-chat-merger', 'ragibson/SMS-MMS-deduplication'];
const BORDERLINE = ['minvws/DSA-WhatsApp-merger', 'MPavion/whatsapp-transcriber', 'sebnembasak/wa-rescue'];
const PROPS = { P1: 'unparseable', P2: 'provenance', P3: 'conflicts', P4: 'determinism', P5: 'report' };
const MODES = { strict: (v) => v === 'y', lenient: (v) => v === 'y' || v === 'partial' };

// RFC 4180: quoted fields, "" escapes, newlines inside quotes.
function parseCsv(text) {
  const rows = [];
  let row = [];
  let f = '';
  let q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) {
      if (c !== '"') f += c;
      else if (text[i + 1] === '"') { f += '"'; i++; } else q = false;
    } else if (c === '"') q = true;
    else if (c === ',') { row.push(f); f = ''; } else if (c === '\n') { row.push(f); rows.push(row); row = []; f = ''; } else if (c !== '\r') f += c;
  }
  if (f || row.length) { row.push(f); rows.push(row); }
  const [hdr, ...body] = rows;
  return body.map((r) => Object.fromEntries(hdr.map((h, i) => [h, r[i]])));
}

const readCsv = (f) => parseCsv(fs.readFileSync(path.join(SURVEY, f), 'utf8'));

function code(row, p) {
  const v = row[PROPS[p]];
  if (p !== 'P1') return v;
  if (v.startsWith('retain as output')) return 'y';
  return v.startsWith('partial') ? 'partial' : 'n';
}

// All subsets of size >= 2, in a fixed order (by size, then lexicographic).
function combos(xs) {
  const out = [];
  for (let m = 1; m < 1 << xs.length; m++) out.push(xs.filter((_, i) => m & (1 << i)));
  return out.filter((c) => c.length >= 2).sort((a, b) => a.length - b.length || a.join().localeCompare(b.join()));
}

// The most properties any one tool holds, and the tools that hold that many.
function maxProps(rows, yes) {
  const held = (r) => Object.keys(PROPS).filter((p) => yes(code(r, p))).length;
  const max = Math.max(...rows.map(held));
  return [max, rows.filter((r) => held(r) === max).map((r) => r.repo).sort().join('; ')];
}

function propertyNumbers(prefix, rows) {
  const n = { [`${prefix}.included`]: rows.length };
  for (const [mode, yes] of Object.entries(MODES)) {
    const has = (r, p) => yes(code(r, p));
    [n[`${prefix}.${mode}.max_props`], n[`${prefix}.${mode}.max_props.tools`]] = maxProps(rows, yes);
    for (const p of Object.keys(PROPS)) n[`${prefix}.${mode}.${p}.count`] = rows.filter((r) => has(r, p)).length;
    for (const c of combos(Object.keys(PROPS))) {
      const tools = rows.filter((r) => c.every((p) => has(r, p))).map((r) => r.repo).sort();
      n[`${prefix}.${mode}.combo.${c.join('+')}.count`] = tools.length;
      n[`${prefix}.${mode}.combo.${c.join('+')}.tools`] = tools.join('; ');
    }
  }
  return n;
}

function surveyNumbers() {
  const cand = readCsv('candidates.csv');
  const extr = new Map(readCsv('extraction.csv').map((r) => [r.repo, r]));
  const flow = JSON.parse(fs.readFileSync(path.join(SURVEY, 'flow_search.json'), 'utf8'));
  const decided = (d) => cand.filter((r) => r.proposed_decision === d);
  const coded = (repos) => repos.map((r) => {
    if (!extr.has(r)) throw new Error(`survey: ${r} is included but has no row in extraction.csv`);
    return extr.get(r);
  });

  const n = {
    'survey.flow.hits_total': flow.hits_total,
    'survey.flow.unique_repos': flow.unique_repos,
    'survey.flow.forks_in_results': flow.forks_in_results,
    'survey.flow.with_platform_term': flow.with_platform_term,
    'survey.flow.metadata_screen.passed': flow.after_metadata_screen,
    'survey.flow.metadata_screen.passed_rule_A_only': flow.after_metadata_screen_rule_A_only,
  };
  for (const src of ['search', 'paper', 'snowball']) {
    const s = cand.filter((r) => r.source === src);
    n[`survey.flow.${src}.screened`] = s.length;
    for (const d of ['include', 'comparator', 'exclude']) n[`survey.flow.${src}.${d}`] = s.filter((r) => r.proposed_decision === d).length;
  }
  n['survey.flow.screened_total'] = cand.length;
  n['survey.flow.included'] = decided('include').length;
  n['survey.flow.included_borderline'] = decided('include').filter((r) => r.borderline === 'y').length;
  n['survey.flow.comparators'] = decided('comparator').length;
  n['survey.flow.excluded'] = decided('exclude').length;
  const codes = {};
  for (const r of cand) codes[`${r.source}.${r.proposed_decision}.${r.code}`] = (codes[`${r.source}.${r.proposed_decision}.${r.code}`] || 0) + 1;
  for (const k of Object.keys(codes).sort()) n[`survey.flow.codes.${k}`] = codes[k];

  const included = decided('include').map((r) => r.repo);
  for (const b of BORDERLINE) if (included.includes(b)) throw new Error(`survey: ${b} is listed as borderline-excluded but is included`);
  Object.assign(n, propertyNumbers('survey', coded(included)));
  Object.assign(n, propertyNumbers('survey.sensitivity', coded([...included, ...BORDERLINE].sort())));

  const generous = coded(included).map((r) => (r.repo !== 'openclaw/wacrawl' ? r
    : { ...r, conflicts: r.conflicts === 'y' ? 'y' : 'partial', report: 'y' }));
  [n['survey.generous.max_props'], n['survey.generous.max_props.tools']] = maxProps(generous, MODES.lenient);
  n['survey.any_P1_with_P2_or_P3'] = coded(included).some((r) => MODES.lenient(code(r, 'P1'))
    && (MODES.lenient(code(r, 'P2')) || MODES.lenient(code(r, 'P3'))));

  for (const p of PAPER) {
    const r = cand.find((x) => x.repo === p);
    n[`survey.paper_tools.${p}`] = r ? `${r.proposed_decision} (${r.code})` : 'missing';
  }
  return n;
}

function main() {
  const recorded = fs.existsSync(OUT) ? JSON.parse(fs.readFileSync(OUT, 'utf8')) : {};
  const kept = Object.fromEntries(Object.entries(recorded).filter(([k]) => !k.startsWith('survey.')));
  const s = surveyNumbers();
  fs.writeFileSync(OUT, `${JSON.stringify(Object.assign(kept, s), null, 2)}\n`, 'utf8');
  console.log(`wrote ${Object.keys(s).length} survey.* keys to ${path.relative(ROOT, OUT)}`);
}

if (require.main === module) {
  try { main(); } catch (e) { console.error(e.message); process.exit(1); }
}
module.exports = { surveyNumbers, parseCsv };
