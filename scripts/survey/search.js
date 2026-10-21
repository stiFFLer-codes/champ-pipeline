'use strict';

// WP3 survey, step 1: run the protocol's GitHub repository searches and keep
// every raw response. Unauthenticated REST (search limit 10 requests/minute),
// best-match order (no `sort` parameter), 100 per page, every page up to the
// API's 1,000-result cap. Forks are excluded by the API's default (no `fork:`
// qualifier). Each response body is stored byte for byte, gzip-compressed, as
// results/survey/raw/qNN-pP.json.gz; results/survey/queries.json records the
// URL, UTC time, HTTP Date, request id and body sha256 of every page.
//
// Usage: node scripts/survey/search.js

const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const crypto = require('crypto');

const QUERIES = [
  'whatsapp merge', 'whatsapp merger', 'merge whatsapp backup', 'merge whatsapp chats',
  'whatsapp msgstore merge', 'whatsapp chat export merge', 'combine whatsapp chat',
  'signal backup merge', 'telegram export merge', 'chat history merge', 'merge chat backups',
  'sms backup merge', 'sms deduplication', 'imessage merge', 'chat archive deduplicate',
];
const QUALIFIER = 'in:name,description,readme';
const PER_PAGE = 100;
const CAP = 1000;
const GAP_MS = 7000; // keeps under 10 search requests/minute

const OUT = path.join(__dirname, '..', '..', 'results', 'survey');
const RAW = path.join(OUT, 'raw');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function get(url) {
  for (;;) {
    const queriedAtUtc = new Date().toISOString();
    const res = await fetch(url, {
      headers: { Accept: 'application/vnd.github+json', 'User-Agent': 'champ-pipeline-wp3-survey' },
    });
    if (res.status === 403 || res.status === 429) {
      const reset = Number(res.headers.get('x-ratelimit-reset')) * 1000;
      const wait = Math.max(reset - Date.now(), 0) + 2000;
      console.error(`rate limited (${res.status}); waiting ${Math.round(wait / 1000)} s`);
      await sleep(wait);
      continue;
    }
    const text = await res.text();
    if (!res.ok) throw new Error(`${res.status} ${url}: ${text}`);
    return {
      queriedAtUtc,
      httpDate: res.headers.get('date'),
      requestId: res.headers.get('x-github-request-id'),
      text,
    };
  }
}

async function main() {
  fs.mkdirSync(RAW, { recursive: true });
  const log = [];
  for (const [i, terms] of QUERIES.entries()) {
    const id = `q${String(i + 1).padStart(2, '0')}`;
    const q = `${terms} ${QUALIFIER}`;
    const entry = { id, terms, q, pages: [] };
    for (let page = 1; ; page++) {
      const url = `https://api.github.com/search/repositories?q=${encodeURIComponent(q)}&per_page=${PER_PAGE}&page=${page}`;
      const r = await get(url);
      const body = JSON.parse(r.text);
      const file = `${id}-p${page}.json.gz`;
      fs.writeFileSync(path.join(RAW, file), zlib.gzipSync(r.text));
      entry.total_count = body.total_count;
      entry.pages.push({
        page, file, url,
        queriedAtUtc: r.queriedAtUtc, httpDate: r.httpDate, requestId: r.requestId,
        sha256: crypto.createHash('sha256').update(r.text).digest('hex'),
        items: body.items.length, incomplete_results: body.incomplete_results,
      });
      console.log(`${id} p${page} total=${body.total_count} items=${body.items.length} "${q}"`);
      await sleep(GAP_MS);
      if (page * PER_PAGE >= Math.min(body.total_count, CAP) || body.items.length === 0) break;
    }
    entry.retrieved = entry.pages.reduce((n, p) => n + p.items, 0);
    log.push(entry);
  }
  fs.writeFileSync(path.join(OUT, 'queries.json'), JSON.stringify({
    platform: 'GitHub REST API, GET /search/repositories (unauthenticated)',
    order: 'best match (no sort parameter)',
    qualifier: QUALIFIER,
    forks: 'excluded by API default (no fork: qualifier)',
    queries: log,
  }, null, 2) + '\n');
}

main().catch((e) => { console.error(e); process.exit(1); });
