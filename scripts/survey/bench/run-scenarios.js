'use strict';

// WP4 scenario benchmark (slim). The runnable WP3 tools and CHAMP-Pipeline on
// generated scenario pairs, each tool in its best-case format (WP3_REPORT
// §7.2), scored against the generator's ground truth for discrepancies and for
// whether the output carries any notice of each one.
//
//   node scripts/survey/bench/run-scenarios.js [<temp-dir>]
//
// Pairs: size 170, delta 14 d, epsilon 7 d, attachmentRate 0, seeds 1-5;
// both fragments in the tool's format; F1 loaded first. Scenarios: baseline;
// a-inside (k = 2 identical messages inside the overlap); b (one body from two
// senders in one minute); f (F2 rendered in +05:30, all fragments read as
// +00:00). CHAMP-Pipeline: --infer, one-to-one, dt 0, on the same files.
//
// Scoring. A message observation's key is (instant as read, sender, body);
// every tool here reads the wall clock as UTC, as CHAMP does with zones
// undeclared. Ground-truth messages that share a key are scored together
// (connected components); per component, with g messages and n shown records
// matching its keys (exactly, or with day and month swapped):
//   lost         g if n = 0
//   false merge  g - n if 0 < n < g
//   dup left     n - g if n > g
//   misdated     shown records whose time is not the ground-truth minute
// A discrepancy has a notice when the output marks a record of its component:
// a tool's per-record duplicate flag (records hidden as duplicates), or, for
// CHAMP, an Omega entry (conflict, dedup ambiguity, quarantine) that names one
// of its observations, or an advisory naming a fragment that holds one.
// Aggregate counts that do not identify a record are not notices.
//
// results/benchmark/scenarios.csv          one row per tool, scenario, seed
// results/benchmark/scenarios-summary.csv  sums by tool x scenario

const fs = require('fs');
const os = require('os');
const path = require('path');
const B = require('./run-benchmark');
const L = require('../../experiments/lib');
const { swapDayMonth } = require('./score');
const { buildScenario, scenarioManifest } = require('../../generate-synthetic-fixtures');

const ROOT = path.join(__dirname, '..', '..', '..');
const OUT = path.join(ROOT, 'results', 'benchmark');
const SEEDS = [1, 2, 3, 4, 5];
const BASE = { size: 170, deltaDays: 14, epsilonDays: 7, attachmentRate: 0 };
const SCENARIOS = {
  baseline: {},
  'a-inside': { knobs: { a: [{ k: 2, where: 'inside' }] } },
  b: { knobs: { b: { where: 'inside' } } },
  f: { f2Zone: '+05:30', knobs: { f: { fragment: 1, declaredZone: '+00:00' } } },
};
const TZ = { ...process.env, TZ: 'UTC' };
const readJson = (f) => JSON.parse(fs.readFileSync(f, 'utf8'));

const TOOLS = [
  { name: 'keepsake', repo: 'sokie/keepsake', format: ['dmy', '24h'],
    run: (dir, scnDir, work) => { B.sh('bun', [path.join(__dirname, 'run-keepsake.ts'), dir, scnDir, work, 'F1'], { cwd: work, env: TZ }); return readJson(path.join(work, 'normalized.json')); } },
  { name: 'The-Omar-Files', repo: 'Akif-b-Atif/The-Omar-Files', format: ['dmy', '24h'],
    run: (dir, scnDir, work, scn) => {
      fs.cpSync(dir, work, { recursive: true, filter: (src) => path.basename(src) !== '.git' });
      const senders = [...new Set(scn.messages.map((m) => m.sender))].sort();
      fs.writeFileSync(path.join(work, 'Pipeline', 'identities.json'), JSON.stringify({ identities: senders.map((s) => ({ name: s, aliases: [s] })) }, null, 2) + '\n');
      B.sh(B.python(), ['control.py', 'merge', ...scn.fragments.map((f) => path.join(scnDir, f.file))], { cwd: path.join(work, 'Pipeline') });
      return B.omarRecords(fs.readFileSync(path.join(work, 'Full_Archive.txt'), 'utf8'));
    } },
  { name: 'krishnarajt', repo: 'krishnarajt/Whatsapp-Chat-File-Merger', format: ['mdy', '24h'],
    run: (dir, scnDir, work, scn) => {
      B.shPy(B.python(), [path.join(__dirname, 'run_krishnarajt.py'), path.join(dir, 'Source.py'), ...scn.fragments.map((f) => path.join(scnDir, f.file))], { cwd: work });
      // Output lines are input lines verbatim: read each back as its input line.
      const byLine = new Map();
      for (const o of scn.observations) byLine.set(scn.fragments[o.frag].lines[o.line - 1], o);
      const text = fs.readFileSync(path.join(work, fs.readdirSync(work).find((f) => f.endsWith('_merged.txt'))), 'utf8');
      return text.split(/\r?\n/).filter(Boolean).map((l) => {
        const o = byLine.get(l);
        return o ? { tUtc: new Date(o.tRead).toISOString(), sender: o.sender, body: o.body, duplicateFlag: false, system: o.sender === null }
          : { tUtc: null, sender: null, body: l, duplicateFlag: false, system: false };
      });
    } },
  { name: 'tarikab7 HTML', repo: 'tarikab7/whatsapp-chat-merger', format: ['mdy', '24h'],
    run: (dir, scnDir, work) => { B.sh('node', [path.join(__dirname, 'run-tarikab7-html.js'), dir, scnDir, work, 'F1'], { cwd: work, env: TZ }); return readJson(path.join(work, 'normalized.json')); } },
  { name: 'tarikab7 Next.js', repo: 'tarikab7/whatsapp-chat-merger', format: ['mdy', '24h'],
    run: (dir, scnDir, work) => { B.sh('bun', [path.join(__dirname, 'run-tarikab7-next.ts'), dir, scnDir, work, 'F1'], { cwd: work, env: TZ }); return readJson(path.join(work, 'normalized.json')); } },
];

function scenario(name, seed, [dateOrder, clock]) {
  const s = SCENARIOS[name];
  const formats = [{ dateOrder, clock, zone: '+00:00' }, { dateOrder, clock, zone: s.f2Zone || '+00:00' }];
  return buildScenario({ ...BASE, seed, formats, knobs: s.knobs || {} });
}

const keyOf = (t, sender, body) => `${new Date(t).toISOString()}|${sender}|${body}`;

// Ground-truth messages joined into components by shared observation keys.
function truth(scn) {
  const ids = new Set(scn.messages.map((m) => m.id));
  const minute = new Map(scn.messages.map((m) => [m.id, Math.floor(m.t / 60000) * 60000]));
  const parent = new Map([...ids].map((i) => [i, i]));
  const find = (x) => { while (parent.get(x) !== x) x = parent.get(x); return x; };
  const keyGt = new Map();
  for (const o of scn.observations) {
    if (!ids.has(o.gt)) continue;
    const k = keyOf(o.tRead, o.sender, o.body);
    if (keyGt.has(k)) parent.set(find(o.gt), find(keyGt.get(k))); else keyGt.set(k, o.gt);
  }
  const comp = new Map();
  for (const i of ids) {
    const r = find(i);
    if (!comp.has(r)) comp.set(r, { msgs: [], minutes: new Set(), obs: [] });
    comp.get(r).msgs.push(i);
    comp.get(r).minutes.add(minute.get(i));
  }
  for (const o of scn.observations) if (ids.has(o.gt)) comp.get(find(o.gt)).obs.push(o);
  const compOfKey = new Map([...keyGt].map(([k, g]) => [k, find(g)]));
  return { comp, compOfKey };
}

// records: [{tUtc, sender, body, duplicateFlag}]; noticed(componentRoot) -> bool
function score(scn, records, noticed) {
  const { comp, compOfKey } = truth(scn);
  const shown = new Map([...comp.keys()].map((c) => [c, { n: 0, misdated: 0 }]));
  let unmatched = 0;
  const locate = (r) => {
    if (!r.tUtc) return null;
    const body = (r.body ?? '').trimEnd();
    const k = keyOf(r.tUtc, r.sender, body);
    if (compOfKey.has(k)) return { c: compOfKey.get(k), t: Date.parse(r.tUtc) };
    const sw = swapDayMonth(r.tUtc);
    const ks = sw && keyOf(sw, r.sender, body);
    return ks && compOfKey.has(ks) ? { c: compOfKey.get(ks), t: NaN } : null;
  };
  for (const r of records.filter((x) => !x.duplicateFlag)) {
    const m = locate(r);
    if (!m) { if (!r.system) unmatched++; continue; }
    const s = shown.get(m.c);
    s.n++;
    if (!comp.get(m.c).minutes.has(m.t)) s.misdated++;
  }
  const row = { gt_messages: scn.messages.length, shown: records.filter((x) => !x.duplicateFlag).length, flagged_duplicate: records.filter((x) => x.duplicateFlag).length, unmatched };
  for (const k of ['lost', 'false_merge', 'dup_left', 'misdated']) { row[k] = 0; row[`${k}_notice`] = 0; }
  for (const [c, { msgs }] of comp) {
    const g = msgs.length;
    const { n, misdated } = shown.get(c);
    const found = { lost: n === 0 ? g : 0, false_merge: n > 0 && n < g ? g - n : 0, dup_left: n > g ? n - g : 0, misdated };
    const note = Object.values(found).some(Boolean) && noticed(c, comp.get(c), locate);
    for (const [k, v] of Object.entries(found)) { row[k] += v; if (note) row[`${k}_notice`] += v; }
  }
  return row;
}

// A tool's notice: a record of the component kept but flagged as a duplicate.
const toolNotice = (records) => (c, _comp, locate) => records.some((r) => r.duplicateFlag && (locate(r) || {}).c === c);

// CHAMP's notice: an Omega entry naming one of the component's observations.
function champNotice(scn, res) {
  const frag = new Map(scn.fragments.map((f) => [f.file, f.index]));
  const named = new Set();
  const advised = new Set();
  const add = (p) => { for (let l = p.line_range[0]; l <= p.line_range[1]; l++) named.add(`${frag.get(p.source_id)}:${l}`); };
  const byId = new Map(res.unified.map((u) => [u.id, u]));
  for (const c of res.omega.conflicts) {
    if (c.observations) c.observations.forEach(add);
    if (c.records) for (const id of c.records) byId.get(id).provenance.forEach(add);
  }
  for (const d of res.omega.dedup_ambiguities) d.observations.forEach(add);
  for (const q of res.omega.quarantine) add(q.provenance);
  for (const a of res.omega.advisories) for (const f of a.fragments) advised.add(frag.get(f));
  return (c, comp) => comp.obs.some((o) => named.has(`${o.frag}:${o.line}`) || advised.has(o.frag));
}

function main() {
  const rows = [];
  const checkouts = new Map(TOOLS.map((t) => [t.repo, B.checkout(t.repo)]));
  for (const tool of TOOLS) {
    for (const name of Object.keys(SCENARIOS)) {
      for (const seed of SEEDS) {
        const scn = scenario(name, seed, tool.format);
        const tag = `${tool.name.replace(/\W+/g, '-')}_${name}_s${seed}`;
        const scnDir = B.freshDir('scenarios', tag, 'pair');
        for (const f of scn.fragments) fs.writeFileSync(path.join(scnDir, f.file), f.text, 'utf8');
        fs.writeFileSync(path.join(scnDir, 'manifest.json'), JSON.stringify(scenarioManifest(scn), null, 2) + '\n');
        const base = { scenario: name, seed, format: tool.format.join('/'), overlap_messages: scn.meta.overlap_messages };

        const records = tool.run(checkouts.get(tool.repo), scnDir, B.freshDir('scenarios', tag, 'work'), scn);
        rows.push({ tool: tool.name, files_of: tool.name, ...base, ...score(scn, records, toolNotice(records)) });

        const inputs = scn.fragments.map((f) => ({ path: path.join(scnDir, f.file), zone: f.declaredZone }));
        const res = L.runPipeline(inputs, { infer: true });
        const champ = res.unified.map((u) => ({ tUtc: new Date(u.tUtc).toISOString(), sender: u.sender, body: u.body, duplicateFlag: false, system: u.sender === null }));
        rows.push({ tool: 'CHAMP-Pipeline', files_of: tool.name, ...base, ...score(scn, champ, champNotice(scn, res)),
          omega_entries: res.omega.conflicts.length + res.omega.dedup_ambiguities.length + res.omega.quarantine.length + res.omega.advisories.length });
        process.stderr.write(`  ${tag}\n`);
      }
    }
  }
  L.writeCsv(path.join(OUT, 'scenarios.csv'), rows);
  const sum = new Map();
  for (const r of rows) {
    const k = `${r.tool}|${r.files_of}|${r.scenario}`;
    if (!sum.has(k)) sum.set(k, { tool: r.tool, files_of: r.files_of, format: r.format, scenario: r.scenario, runs: 0 });
    const s = sum.get(k);
    s.runs++;
    for (const c of ['gt_messages', 'shown', 'unmatched', 'lost', 'lost_notice', 'false_merge', 'false_merge_notice', 'dup_left', 'dup_left_notice', 'misdated', 'misdated_notice']) s[c] = (s[c] || 0) + r[c];
  }
  L.writeCsv(path.join(OUT, 'scenarios-summary.csv'), [...sum.values()]);
  console.log(`${rows.length} rows; machine ${os.type()} ${os.release()}; node ${process.version}; bun ${B.sh('bun', ['--version'])}`);
}

main();
