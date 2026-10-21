'use strict';

// WP3 survey, step 3: pin and fetch every repository that goes to the
// README/source screen: those passing the metadata screen (flow_search.json)
// plus any named on the command line (paper tools, snowballed tools).
// For each: a blobless, depth-1 git clone into <tmp-dir> (no API quota used),
// recording HEAD sha, its commit date, the file list size and the README path.
// README text stays in <tmp-dir>; only metadata is written to
// results/survey/fetched.json. Resumes: repositories already fetched are skipped.
//
// Usage: node scripts/survey/fetch.js <tmp-dir> [owner/repo ...]

const fs = require('fs');
const path = require('path');
const { execFile } = require('child_process');

const OUT = path.join(__dirname, '..', '..', 'results', 'survey');
const PARALLEL = 8;
const [tmp, ...extra] = process.argv.slice(2);
const git = (args) => new Promise((resolve, reject) =>
  execFile('git', args, { encoding: 'utf8', maxBuffer: 1 << 28 }, (e, stdout, stderr) =>
    (e ? reject(Object.assign(e, { stderr })) : resolve(stdout.trim()))));
const CODE = /\.(py|js|mjs|cjs|ts|tsx|jsx|java|kt|kts|rs|go|c|cc|cpp|h|hpp|cs|rb|php|swift|dart|scala|sh|ps1|bat|html|sql|pl|lua|r)$/i;

const flow = JSON.parse(fs.readFileSync(path.join(OUT, 'flow_search.json'), 'utf8'));
const repos = [...new Set([...flow.passed, ...extra])];
const file = path.join(OUT, 'fetched.json');
const fetched = fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : {};

async function fetchOne(repo) {
  const dir = path.join(tmp, repo.replace('/', '__'));
  try {
    if (!fs.existsSync(path.join(dir, '.git'))) {
      fs.rmSync(dir, { recursive: true, force: true });
      await git(['-c', 'core.longpaths=true', 'clone', '-q', '--depth', '1', '--filter=blob:none', '--no-checkout',
        `https://github.com/${repo}.git`, dir]);
    }
    const [sha, date] = (await git(['-C', dir, 'log', '-1', '--format=%H%n%cI'])).split('\n');
    const files = (await git(['-C', dir, 'ls-tree', '-r', '--name-only', 'HEAD'])).split('\n').filter(Boolean);
    const readme = files.filter((f) => /^readme(\.|$)/i.test(f)).sort()[0] || null;
    if (readme) fs.writeFileSync(path.join(tmp, `${repo.replace('/', '__')}.README`), await git(['-C', dir, 'show', `HEAD:${readme}`]));
    fetched[repo] = {
      sha, last_commit_date: date, files: files.length,
      code_files: files.filter((f) => CODE.test(f)).length, readme,
      fetched_at_utc: new Date().toISOString(),
    };
  } catch (e) {
    fetched[repo] = { error: String(e.stderr || e.message).trim().split('\n').pop() };
  }
  console.log(repo, JSON.stringify(fetched[repo]));
  const sorted = Object.fromEntries(Object.keys(fetched).sort().map((k) => [k, fetched[k]]));
  fs.writeFileSync(file, JSON.stringify(sorted, null, 2) + '\n');
}

async function main() {
  const todo = repos.filter((r) => !(fetched[r] && fetched[r].sha));
  const workers = Array.from({ length: PARALLEL }, async () => {
    while (todo.length) await fetchOne(todo.shift());
  });
  await Promise.all(workers);
}

main();
