'use strict';

// WP3 survey, step 4: build results/survey/candidates.csv and flow.json.
// Inputs: screen_decisions.tsv (the PROPOSED README/source-screen decisions,
// one row per repository; the author may edit it and re-run this script),
// fetched.json (pinned sha, last commit), the raw search responses (stars,
// license, language) and repo_meta.json (same fields for repositories no query
// returned).
//
// Decision codes: I include (I1-I3 hold); OOS fails I2 (no combining of
// archives); I2 fails I2 for a stated reason; VIEW single-archive viewer,
// converter or exporter; SINGLE merge/dedup inside one archive only; NOCODE
// fails I1; PLAT fails I3; FOR forensic tool on one acquisition (comparator);
// FORK GitHub fork; DEP library or platform named as a dependency; NOTFOUND not
// retrievable.
//
// Usage: node scripts/survey/candidates.js

const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const OUT = path.join(__dirname, '..', '..', 'results', 'survey');
const read = (f) => fs.readFileSync(path.join(OUT, f), 'utf8');
const PAPER = ['bepaald/signalbackup-tools', 'natario1/whatsapp-database-merger', 'frozenspider/chat-history-manager',
  'EkriirkE/WAMerge', 'SecurityRonin/chat4n6', 'tarikab7/whatsapp-chat-merger', 'ragibson/SMS-MMS-deduplication'];

const csv = (v) => {
  const s = v === null || v === undefined ? '' : String(v);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

function main() {
  const [hdr, ...lines] = read('screen_decisions.tsv').trim().split('\n');
  const cols = hdr.split('\t');
  const decisions = lines.map((l) => Object.fromEntries(l.split('\t').map((v, i) => [cols[i], v])));
  const fetched = JSON.parse(read('fetched.json'));
  const repoMeta = fs.existsSync(path.join(OUT, 'repo_meta.json')) ? JSON.parse(read('repo_meta.json')) : {};
  const flowSearch = JSON.parse(read('flow_search.json'));

  // search items and where each repository was found
  const items = new Map();
  const log = JSON.parse(read('queries.json'));
  for (const q of log.queries) {
    for (const p of q.pages) {
      const body = JSON.parse(zlib.gunzipSync(fs.readFileSync(path.join(OUT, 'raw', p.file))).toString('utf8'));
      body.items.forEach((it, i) => {
        const k = it.full_name.toLowerCase();
        if (!items.has(k)) items.set(k, { it, hits: [] });
        items.get(k).hits.push(`${q.id}#${(p.page - 1) * 100 + i + 1}`);
      });
    }
  }
  const screenA = new Set(flowSearch.passed.map((r) => r.toLowerCase()));

  const header = ['repo', 'source', 'paper_tool', 'found_by(query#rank)', 'metadata_screen', 'sha_examined',
    'stars', 'last_commit_date', 'license', 'language', 'fork', 'input_format',
    'proposed_decision', 'code', 'borderline', 'reason', 'named_by', 'evidence_url'];
  const rows = [];
  for (const d of decisions) {
    const k = d.repo.toLowerCase();
    const s = items.get(k);
    const m = s ? {
      stars: s.it.stargazers_count, license: s.it.license ? s.it.license.spdx_id : '', language: s.it.language, fork: s.it.fork,
    } : repoMeta[d.repo] || {};
    const f = fetched[d.repo] || {};
    let evidence = '';
    if (f.sha) evidence = `https://github.com/${d.repo}/${f.readme ? `blob/${f.sha}/${f.readme}` : `tree/${f.sha}`}`;
    else if (d.named_by) {
      const by = d.named_by.split('; ')[0];
      const fb = fetched[by];
      if (fb && fb.sha) evidence = `https://github.com/${by}/blob/${fb.sha}/${fb.readme}`;
    }
    rows.push([
      d.repo, d.source, PAPER.includes(d.repo) ? 'y' : '', s ? s.hits.join(' ') : '',
      s ? (screenA.has(k) ? 'pass' : 'fail') : 'n/a', f.sha || '', m.stars ?? '', f.last_commit_date || '',
      m.license || '', m.language || '', m.fork === undefined ? '' : m.fork, d.input_format || '',
      d.proposed_decision, d.code, d.borderline, d.reason, d.named_by, evidence,
    ]);
  }
  const order = { include: 0, comparator: 1, exclude: 2 };
  rows.sort((a, b) => order[a[12]] - order[b[12]] || a[0].localeCompare(b[0]));
  fs.writeFileSync(path.join(OUT, 'candidates.csv'), [header, ...rows].map((r) => r.map(csv).join(',')).join('\n') + '\n');

  const count = (pred) => decisions.filter(pred).length;
  const bySource = (src) => ({
    screened: count((d) => d.source === src),
    proposed_include: count((d) => d.source === src && d.proposed_decision === 'include'),
    proposed_comparator: count((d) => d.source === src && d.proposed_decision === 'comparator'),
    proposed_exclude: count((d) => d.source === src && d.proposed_decision === 'exclude'),
  });
  const codes = {};
  for (const d of decisions) codes[`${d.source}:${d.proposed_decision}:${d.code}`] = (codes[`${d.source}:${d.proposed_decision}:${d.code}`] || 0) + 1;
  const flow = {
    note: 'All decisions after the metadata screen are PROPOSED; inclusion is the author\'s decision.',
    platform: log.platform,
    queries: flowSearch.per_query,
    hits_total: flowSearch.hits_total,
    unique_repos: flowSearch.unique_repos,
    forks_in_results: flowSearch.forks_in_results,
    metadata_screen: { rule: flowSearch.rule, passed: flowSearch.after_metadata_screen, passed_rule_A_only: flowSearch.after_metadata_screen_rule_A_only },
    readme_source_screen: bySource('search'),
    added_outside_search: { paper_tools_not_retrieved: bySource('paper'), snowball: bySource('snowball') },
    proposed_included_total: count((d) => d.proposed_decision === 'include'),
    proposed_included_borderline: count((d) => d.proposed_decision === 'include' && d.borderline === 'y'),
    proposed_comparators_total: count((d) => d.proposed_decision === 'comparator'),
    decision_codes: codes,
    paper_tools: PAPER.map((r) => {
      const d = decisions.find((x) => x.repo === r);
      const s = items.get(r.toLowerCase());
      return { repo: r, retrieved_by: s ? s.hits : [], metadata_screen: s ? (screenA.has(r.toLowerCase()) ? 'pass' : 'fail') : 'not retrieved', proposed: d ? `${d.proposed_decision} (${d.code})` : 'missing' };
    }),
  };
  fs.writeFileSync(path.join(OUT, 'flow.json'), JSON.stringify(flow, null, 2) + '\n');
  console.log(JSON.stringify({ rows: rows.length, include: flow.proposed_included_total, comparators: flow.proposed_comparators_total }));
}

main();
