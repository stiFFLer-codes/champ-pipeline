'use strict';

// WP3 survey, step 2: hits per query -> unique repositories -> metadata screen.
// Reads results/survey/queries.json and raw/*.json.gz (from search.js).
// Writes results/survey/screen_metadata.csv (every unique repository and its
// metadata-screen outcome) and results/survey/flow_search.json (counts).
//
// The metadata screen is a PROPOSED mechanical rule, not an inclusion decision:
// a repository passes when its name, description or topics mention a messaging
// platform (PLATFORM) AND either mention a merge/deduplication operation (MERGE,
// rule A) or the repository ranks in the top RANK_K of any query's best-match
// order (rule B; catches tools that describe merging only in the README, such
// as bepaald/signalbackup-tools, rank 2 in q08). Forks fail.
//
// Usage: node scripts/survey/screen.js

const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const OUT = path.join(__dirname, '..', '..', 'results', 'survey');
const PLATFORM = /whats\s?app|msgstore|signal|telegram|\bsms\b|\bmms\b|imessage|chat|messag|messenger|wechat|viber|discord|skype|kakao|threema/i;
const MERGE = /merg|combin|de-?dup|duplicat|consolidat|reconcil|unif(y|ie|ica)/i;
const RANK_K = 50;

const csv = (v) => {
  const s = v === null || v === undefined ? '' : String(v);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

function screenText(item) {
  return [item.name.replace(/[-_.]+/g, ' '), item.description || '', (item.topics || []).join(' ')].join(' | ');
}

function main() {
  const log = JSON.parse(fs.readFileSync(path.join(OUT, 'queries.json'), 'utf8'));
  const repos = new Map();
  const perQuery = [];
  for (const q of log.queries) {
    let hits = 0;
    for (const p of q.pages) {
      const body = JSON.parse(zlib.gunzipSync(fs.readFileSync(path.join(OUT, 'raw', p.file))).toString('utf8'));
      for (const [i, item] of body.items.entries()) {
        hits++;
        const rank = (p.page - 1) * 100 + i + 1;
        const key = item.full_name.toLowerCase();
        if (!repos.has(key)) repos.set(key, { item, queries: [], bestRank: rank });
        const r = repos.get(key);
        r.queries.push(`${q.id}#${rank}`);
        r.bestRank = Math.min(r.bestRank, rank);
      }
    }
    perQuery.push({ id: q.id, terms: q.terms, total_count: q.total_count, retrieved: hits, capped: q.total_count > 1000 });
  }

  const rows = [];
  let passed = 0;
  let passedA = 0;
  let forks = 0;
  let platformOnly = 0;
  for (const { item, queries, bestRank } of repos.values()) {
    const text = screenText(item);
    const platform = PLATFORM.test(text);
    const merge = MERGE.test(text);
    if (item.fork) forks++;
    if (platform) platformOnly++;
    const pass = !item.fork && platform && (merge || bestRank <= RANK_K);
    if (pass) passed++;
    if (pass && merge) passedA++;
    rows.push([
      item.full_name, queries.join(' '), bestRank, item.stargazers_count, item.fork, item.archived,
      item.pushed_at, item.license ? item.license.spdx_id : '', item.language || '',
      platform ? 'y' : 'n', merge ? 'y' : 'n', pass ? (merge ? 'pass-A' : 'pass-B') : 'fail', item.description || '',
    ]);
  }
  rows.sort((a, b) => (a[11] === b[11] ? a[0].localeCompare(b[0]) : a[11] < b[11] ? -1 : 1));
  const header = ['repo', 'queries(id#rank)', 'best_rank', 'stars', 'fork', 'archived', 'pushed_at', 'license', 'language',
    'platform_term', 'merge_term', 'metadata_screen', 'description'];
  fs.writeFileSync(path.join(OUT, 'screen_metadata.csv'),
    [header, ...rows].map((r) => r.map(csv).join(',')).join('\n') + '\n');

  const flow = {
    rule: {
      PLATFORM: PLATFORM.source, MERGE: MERGE.source, RANK_K,
      fields: 'name (separators as spaces), description, topics',
      pass: 'not a fork AND PLATFORM AND (MERGE [rule A] OR best-match rank <= RANK_K in any query [rule B])',
    },
    per_query: perQuery,
    hits_total: perQuery.reduce((n, q) => n + q.retrieved, 0),
    unique_repos: repos.size,
    forks_in_results: forks,
    with_platform_term: platformOnly,
    after_metadata_screen: passed,
    after_metadata_screen_rule_A_only: passedA,
    passed: rows.filter((r) => r[11] !== 'fail').map((r) => r[0]),
  };
  fs.writeFileSync(path.join(OUT, 'flow_search.json'), JSON.stringify(flow, null, 2) + '\n');
  console.log(JSON.stringify({ hits: flow.hits_total, unique: flow.unique_repos, forks, passed }, null, 0));
}

main();
