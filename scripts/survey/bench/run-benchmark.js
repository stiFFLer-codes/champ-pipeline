'use strict';

// WP3 benchmark driver. Checks out each runnable tool at its pinned SHA in a
// temp directory outside the repo, runs it unmodified on the input pair
// through its invocation wrapper (both fragment orders), records exact
// commands and versions in run.json, converts the tool's output into
// normalized.json records, and scores everything into
// results/benchmark/benchmark.csv (score.js). Runs that cannot be made are
// recorded as status "blocked" with the reason.
//
// Usage: node scripts/survey/bench/run-benchmark.js [<temp-dir>]
//   default temp dir: <os tmp>/wp3-bench. Needs git, node, bun and Python 3
//   (WP3_PYTHON, default: the `py -3.12` launcher on Windows, else python3);
//   a venv with pandas and numpy is created in the temp dir for krishnarajt.

const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');
const { loadPair } = require('./truth');

const ROOT = path.join(__dirname, '..', '..', '..');
const RAW = path.join(ROOT, 'results', 'benchmark', 'raw');
const TMP = path.resolve(process.argv[2] || path.join(os.tmpdir(), 'wp3-bench'));
const PAIR = 'data/synthetic_fixtures/tcf-pair';
const PAIR_ABS = path.join(ROOT, PAIR);

const SHA = {
  'tarikab7/whatsapp-chat-merger': '403c98e132e8d3fbdbe054adfd53bf3d182225a9',
  'krishnarajt/Whatsapp-Chat-File-Merger': '138add0aa8534e9ccc92f3fb5090b31d363a33d9',
  'Akif-b-Atif/The-Omar-Files': '27faf12e3e007ece86a0dab794c50be6ceedf3de',
  'sokie/keepsake': '89cdfb6ff94939da3bd61b7ecf1a568bcb9194a0',
};

const sh = (cmd, args, opts = {}) =>
  execFileSync(cmd, args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], ...opts }).trim();

// On the author's machine `import pandas` (3.0.x, Python 3.12, Windows) dies
// intermittently with NTSTATUS 0xC000070A before any tool code runs. Such a
// call (crash status, nothing printed) is retried, and every failed attempt is
// returned so run.json records it; any other failure is not retried.
const crashes = [];
function shPy(cmd, args, opts = {}) {
  for (let attempt = 1; ; attempt++) {
    try {
      return sh(cmd, args, opts);
    } catch (e) {
      const native = e.status >= 0xC0000000 && !e.stdout && !e.stderr;
      if (!native || attempt === 5) throw e;
      crashes.push({ args: args.map((a) => path.basename(a)).join(' '), status: `0x${e.status.toString(16).toUpperCase()}` });
    }
  }
}

function checkout(repo) {
  const sha = SHA[repo];
  const dir = path.join(TMP, 'repos', repo.replace('/', '__'));
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
    sh('git', ['-c', 'core.longpaths=true', 'init', '-q', dir]);
    sh('git', ['-C', dir, 'config', 'core.longpaths', 'true']);
    sh('git', ['-C', dir, 'fetch', '-q', '--depth', '1', `https://github.com/${repo}.git`, sha]);
    sh('git', ['-C', dir, 'checkout', '-q', 'FETCH_HEAD']);
  }
  if (sh('git', ['-C', dir, 'rev-parse', 'HEAD']) !== sha) throw new Error(`${repo} not at ${sha}`);
  if (sh('git', ['-C', dir, 'status', '--porcelain'])) throw new Error(`${repo} checkout is modified`);
  return dir;
}

function freshDir(...parts) {
  const dir = path.join(TMP, 'run', ...parts);
  fs.rmSync(dir, { recursive: true, force: true });
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

function python() {
  const venv = path.join(TMP, 'venv-py312');
  const bin = path.join(venv, process.platform === 'win32' ? 'Scripts/python.exe' : 'bin/python');
  if (!fs.existsSync(bin)) {
    const base = process.env.WP3_PYTHON ? [process.env.WP3_PYTHON] : process.platform === 'win32' ? ['py', '-3.12'] : ['python3'];
    sh(base[0], [...base.slice(1), '-m', 'venv', venv]);
    sh(bin, ['-m', 'pip', 'install', '-q', 'pandas', 'numpy']);
  }
  return bin;
}

const pair = loadPair(PAIR_ABS);
const files = pair.fragments.map((f) => f.file);
const ordered = (first) => (first === 'F1' ? files : [...files].reverse());

const env = {
  os: `${os.type()} ${os.release()} ${os.arch()}`,
  node: process.version,
  bun: sh('bun', ['--version']),
};

// Tools echo absolute paths, which name the machine's user. run.json gets
// <tmp>, <repo> and ~ in their place: each in the form given and the resolved
// long form, and with backslashes doubled as Python's repr prints them.
function redact(s) {
  const real = (p) => { try { return fs.realpathSync.native(p); } catch { return p; } };
  for (const [p, tag] of [[TMP, '<tmp>'], [ROOT, '<repo>'], [os.homedir(), '~']]) {
    for (const form of new Set([p, real(p)])) s = s.split(form.replace(/\\/g, '\\\\')).join(tag).split(form).join(tag);
  }
  return s;
}

function writeRun(name, meta, normalized) {
  fs.mkdirSync(path.join(RAW, name), { recursive: true });
  fs.writeFileSync(path.join(RAW, name, 'run.json'), JSON.stringify(meta, (k, v) => (typeof v === 'string' ? redact(v) : v), 2) + '\n');
  if (normalized) fs.writeFileSync(path.join(RAW, name, 'normalized.json'), JSON.stringify(normalized, null, 1) + '\n');
}

// --- tarikab7/whatsapp-chat-merger: two implementations in one repository ---
function runTarikab7() {
  const repo = 'tarikab7/whatsapp-chat-merger';
  const dir = checkout(repo);
  const variants = [
    ['html', 'node', 'run-tarikab7-html.js', 'public/chat-merger.html (README entry point)'],
    ['next', 'bun', 'run-tarikab7-next.ts', 'src/lib/whatsapp-parser.ts (Next.js app in the same repository)'],
  ];
  for (const [variant, runtime, wrapper, what] of variants) {
    for (const first of ['F1', 'F2']) {
      const name = `tarikab7-${variant}_tcf-pair_${first}first`;
      const out = path.join(RAW, name);
      const stdout = sh(runtime, [path.join(__dirname, wrapper), dir, PAIR_ABS, out, first],
        { cwd: freshDir(name), env: { ...process.env, TZ: 'UTC' } });
      writeRun(name, {
        tool: repo, variant: what, sha: SHA[repo], input: PAIR, order: `${first} loaded first`,
        status: 'ran', env: { ...env, TZ: 'UTC' },
        command: `TZ=UTC ${runtime} scripts/survey/bench/${wrapper} <checkout> ${PAIR} results/benchmark/raw/${name} ${first}`,
        wrapper_stdout: stdout,
        diagnostics_emitted: 'none (the parse and merge code writes no message, warning or log)',
        conflicts_reported: 'n (output has no conflict field)',
        provenance_reported: variant === 'html'
          ? 'partial: each record carries sourceId/sourceName and a global lineIdx counter; no file line or hash'
          : 'partial: each record carries sourceId (and duplicateOf for flagged copies); no file line or hash',
        unparseable_input: variant === 'html'
          ? 'lines matching no header pattern are appended to the previous message body, or dropped if no message precedes them; records whose date fails to parse are filtered out (timestamp 0); no notice'
          : 'lines matching no header pattern are appended to the previous message body, or dropped if no message precedes them; no notice',
      });
    }
  }
}

// --- krishnarajt/Whatsapp-Chat-File-Merger: Tk GUI, pandas ---
function runKrishnarajt() {
  const repo = 'krishnarajt/Whatsapp-Chat-File-Merger';
  const dir = checkout(repo);
  const py = python();
  const versions = shPy(py, ['-c', 'import sys,pandas,numpy;print(sys.version.split()[0],pandas.__version__,numpy.__version__)']).split(' ');
  // Every output line is an input line verbatim, so it is read back in the
  // format of the fragment it came from.
  const byLine = new Map(pair.fragments.flatMap((f) => f.records.map((r) => [r.raw, { ...r, file: f.file }])));
  for (const first of ['F1', 'F2']) {
    const name = `krishnarajt_tcf-pair_${first}first`;
    const cwd = freshDir(name);
    const before = crashes.length;
    const stdout = shPy(py, [path.join(__dirname, 'run_krishnarajt.py'), path.join(dir, 'Source.py'),
      ...ordered(first).map((f) => path.join(PAIR_ABS, f))], { cwd });
    const outFile = fs.readdirSync(cwd).find((f) => f.endsWith('_merged.txt'));
    const text = fs.readFileSync(path.join(cwd, outFile), 'utf8');
    fs.mkdirSync(path.join(RAW, name), { recursive: true });
    fs.copyFileSync(path.join(cwd, outFile), path.join(RAW, name, 'output.txt'));
    // Python's text mode writes CRLF on Windows; the CR is not part of a line.
    const normalized = text.split(/\r?\n/).filter((l) => l !== '').map((l) => {
      const r = byLine.get(l);
      if (!r) return { tUtc: null, sender: null, body: l, duplicateFlag: false, source: null, system: false };
      return { tUtc: r.tUtc, sender: r.sender, body: r.body, duplicateFlag: false, source: r.file, system: r.system };
    });
    writeRun(name, {
      tool: repo, variant: 'Source.py (Tk GUI)', sha: SHA[repo], input: PAIR, order: `${first} picked first`,
      status: 'ran', env: { ...env, python: versions[0], pandas: versions[1], numpy: versions[2] },
      command: `python scripts/survey/bench/run_krishnarajt.py <checkout>/Source.py <first> <second>  (cwd: empty temp dir; output ${outFile})`,
      wrapper_stdout: stdout,
      diagnostics_emitted: `stdout only: "${stdout.replace(/\r?\n/g, ' | ')}"`,
      conflicts_reported: 'n', provenance_reported: 'n',
      unparseable_input: 'lines without "/" or ":" (and https lines without ",") are removed before parsing, silently; a line whose date fits neither %m/%d/%y nor %d/%m/%y raises an uncaught ValueError (abort); am/pm is ignored, so 12h times are read as 24h for ordering',
      note: 'requirements.txt pins pandas 1.3.4 / numpy 1.21.4 (no wheels for Python 3.12); current pandas/numpy used instead. Output lines are the input lines verbatim, re-ordered.',
      environment_crashes_retried: crashes.slice(before),
    }, normalized);
  }
}

// Full_Archive.txt (DD-Mon-YYYY, HH:MM - ...) as normalized records; a line
// without that head continues the previous record.
function omarRecords(text) {
  const LINE = /^(\d{2})-([A-Za-z]{3})-(\d{4}), (\d{2}):(\d{2}) - (.*)$/;
  const MON = { Jan: 0, Feb: 1, Mar: 2, Apr: 3, May: 4, Jun: 5, Jul: 6, Aug: 7, Sep: 8, Oct: 9, Nov: 10, Dec: 11 };
  const normalized = [];
  for (const l of text.split(/\r?\n/)) {
    if (!l) continue;
    const m = LINE.exec(l);
    if (!m) { normalized[normalized.length - 1].body += `\n${l}`; continue; }
    const t = new Date(Date.UTC(Number(m[3]), MON[m[2]], Number(m[1]), Number(m[4]), Number(m[5]))).toISOString();
    const sys = m[6].startsWith('[SYSTEM] ');
    const sep = m[6].indexOf(': ');
    normalized.push(sys || sep === -1
      ? { tUtc: t, sender: null, body: sys ? m[6].slice(9) : m[6], duplicateFlag: false, source: null, system: true }
      : { tUtc: t, sender: m[6].slice(0, sep), body: m[6].slice(sep + 2), duplicateFlag: false, source: null, system: false });
  }
  return normalized;
}

// --- Akif-b-Atif/The-Omar-Files: normalize + merge into Full_Archive.txt ---
function runOmar() {
  const repo = 'Akif-b-Atif/The-Omar-Files';
  const dir = checkout(repo);
  const py = python();
  const senders = [...new Set(pair.fragments.flatMap((f) => f.records.filter((r) => !r.system).map((r) => r.sender)))].sort();
  const identities = { identities: senders.map((s) => ({ name: s, aliases: [s] })) };
  for (const first of ['F1', 'F2']) {
    const name = `omar-files_tcf-pair_${first}first`;
    const run = freshDir(name);
    fs.cpSync(dir, run, { recursive: true, filter: (src) => path.basename(src) !== '.git' });
    fs.writeFileSync(path.join(run, 'Pipeline', 'identities.json'), JSON.stringify(identities, null, 2) + '\n');
    const stdout = sh(py, ['control.py', 'merge', ...ordered(first).map((f) => path.join(PAIR_ABS, f))],
      { cwd: path.join(run, 'Pipeline') });
    const out = path.join(RAW, name);
    fs.mkdirSync(out, { recursive: true });
    fs.copyFileSync(path.join(run, 'Full_Archive.txt'), path.join(out, 'Full_Archive.txt'));
    fs.copyFileSync(path.join(run, 'Pipeline', 'logs', 'merge_log.json'), path.join(out, 'merge_log.json'));
    const normalized = omarRecords(fs.readFileSync(path.join(run, 'Full_Archive.txt'), 'utf8'));
    writeRun(name, {
      tool: repo, variant: 'Pipeline/control.py merge (2_normalize_export.py + 3_merge_export.py)', sha: SHA[repo],
      input: PAIR, order: `${first} merged first`, status: 'ran',
      env: { ...env, python: sh(py, ['-c', 'import sys;print(sys.version.split()[0])']) },
      command: `cd <copy of checkout>/Pipeline && python control.py merge <first> <second>  (Pipeline/identities.json written by the wrapper: ${senders.length} senders, each mapped to itself)`,
      wrapper_stdout: stdout,
      diagnostics_emitted: 'per export: lines written, placeholders, unparsed lines; per merge: added / skipped-duplicate counts (stdout and Pipeline/logs/merge_log.json)',
      conflicts_reported: 'n', provenance_reported: 'n (merge_log.json names the source file of each merge batch, not of each record)',
      unparseable_input: 'retained: a line matching no pattern is kept verbatim as "[UNPARSED - review this line] ..." and appended at the archive end; continuation lines join the previous message',
      note: 'the tool resolves sender labels through Pipeline/identities.json and asks on stdin for unknown ones; the wrapper supplies an identity map (label -> same label) so that no prompt occurs and no label changes.',
    }, normalized);
  }
}

// --- sokie/keepsake: Express app; its export-import route functions under Bun ---
function runKeepsake() {
  const repo = 'sokie/keepsake';
  const dir = checkout(repo);
  if (!fs.existsSync(path.join(dir, 'node_modules'))) {
    // the tool's own lockfile; install scripts skipped (none are needed to import the server modules)
    sh(process.platform === 'win32' ? 'npm.cmd' : 'npm', ['ci', '--ignore-scripts', '--no-audit', '--no-fund'], { cwd: dir, shell: process.platform === 'win32' });
  }
  const parser = JSON.parse(fs.readFileSync(path.join(dir, 'node_modules', 'whatsapp-chat-parser', 'package.json'), 'utf8')).version;
  for (const first of ['F1', 'F2']) {
    const name = `keepsake_tcf-pair_${first}first`;
    const stdout = sh('bun', [path.join(__dirname, 'run-keepsake.ts'), dir, PAIR_ABS, path.join(RAW, name), first],
      { cwd: freshDir(name), env: { ...process.env, TZ: 'UTC' } });
    writeRun(name, {
      tool: repo, variant: 'server/lib importExport.ts + normalize.ts (route POST /api/import/export-zip)', sha: SHA[repo],
      input: PAIR, order: `${first} imported first`, status: 'ran',
      env: { ...env, TZ: 'UTC', 'whatsapp-chat-parser': parser, install: 'npm ci --ignore-scripts (tool package-lock.json)' },
      command: `TZ=UTC bun scripts/survey/bench/run-keepsake.ts <checkout> ${PAIR} results/benchmark/raw/${name} ${first}`,
      wrapper_stdout: stdout,
      diagnostics_emitted: 'per import: parsed entries, added and merged counts (the route returns them and stores them in the chat metadata "sources" list)',
      conflicts_reported: 'n', provenance_reported: 'partial: each message carries source type ("export"/"wts"/"msgstore"), not the file; chat metadata lists each import with added/merged counts',
      unparseable_input: 'delegated to whatsapp-chat-parser: a line that does not start a message is appended to the previous message; an import with zero parsed messages is rejected with HTTP 400',
      note: '"me" = "You" (the import dialog asks which participant is the user). Second import merged into the first chat (route targetChatId path).',
    }, null);
  }
}

function blocked() {
  writeRun('chat-history-manager_tcf-pair', {
    tool: 'frozenspider/chat-history-manager', sha: 'd1f6f8879e151b1309118ec4d59d0b9298c9ba81',
    input: PAIR, status: 'blocked',
    note: 'not run: no Rust toolchain, C/C++ linker, OpenSSL or protoc on this machine (README "How to build"); ' +
      'merging is exposed only through the gRPC merge service (src/main.rs:27-38 has no merge command). ' +
      'By code reading the WhatsApp text loader would reject both fragments before any merge: ' +
      'crates/loaders/src/loader/whatsapp_text.rs:86-88 requires exactly two senders (the pair has four), ' +
      ':15,20 require a two-digit-hour 24h clock (F1 is 12h), :18 requires the file name "WhatsApp Chat with <name>.txt".',
  });
  writeRun('all-tools_homogeneous', {
    tool: 'all runnable tools', input: 'homogeneous-format pair (not generated)', status: 'blocked',
    note: 'generator --tcf-pair hard-codes F1 dmy/12h and F2 mdy/24h (scripts/generate-synthetic-fixtures.js:436-437); ' +
      'a same-format pair needs a generator change, see WP3_REPORT.md.',
  });
}

// Helpers for scripts/survey/bench/run-scenarios.js, which requires this file.
module.exports = { SHA, TMP, sh, shPy, crashes, checkout, freshDir, python, omarRecords };

if (require.main === module) {
  fs.rmSync(RAW, { recursive: true, force: true });
  runTarikab7();
  runKrishnarajt();
  runOmar();
  runKeepsake();
  blocked();
  console.log(sh('node', [path.join(__dirname, 'score.js')]));
}
