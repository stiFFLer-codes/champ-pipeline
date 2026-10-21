'use strict';

// WP3 survey: repository metadata (stars, license, language, fork, archived)
// for candidates that did not come from the search responses (snowballed
// tools, paper tools no query retrieved). Unauthenticated GET /repos/{o}/{r};
// each response is kept byte for byte, gzip-compressed, in
// results/survey/raw/repos/<owner>__<repo>.json.gz with its UTC time in
// results/survey/repo_meta.json.
//
// Usage: node scripts/survey/repo_meta.js owner/repo [owner/repo ...]

const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const OUT = path.join(__dirname, '..', '..', 'results', 'survey');
const RAW = path.join(OUT, 'raw', 'repos');
const file = path.join(OUT, 'repo_meta.json');

async function main() {
  fs.mkdirSync(RAW, { recursive: true });
  const meta = fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : {};
  for (const repo of process.argv.slice(2)) {
    if (meta[repo]) continue;
    const queriedAtUtc = new Date().toISOString();
    const res = await fetch(`https://api.github.com/repos/${repo}`, {
      headers: { Accept: 'application/vnd.github+json', 'User-Agent': 'champ-pipeline-wp3-survey' },
    });
    const text = await res.text();
    if (res.status === 403 || res.status === 429) throw new Error(`rate limited at ${repo}; rerun later`);
    fs.writeFileSync(path.join(RAW, `${repo.replace('/', '__')}.json.gz`), zlib.gzipSync(text));
    const b = res.ok ? JSON.parse(text) : {};
    meta[repo] = {
      queriedAtUtc, status: res.status, stars: b.stargazers_count, fork: b.fork, archived: b.archived,
      license: b.license ? b.license.spdx_id : null, language: b.language, pushed_at: b.pushed_at,
    };
    console.log(repo, JSON.stringify(meta[repo]));
  }
  const sorted = Object.fromEntries(Object.keys(meta).sort().map((k) => [k, meta[k]]));
  fs.writeFileSync(file, JSON.stringify(sorted, null, 2) + '\n');
}

main().catch((e) => { console.error(e.message); process.exit(1); });
