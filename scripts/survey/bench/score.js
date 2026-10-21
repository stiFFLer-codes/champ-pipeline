'use strict';

// WP3 benchmark: score every run in results/benchmark/raw/<run>/ against the
// pair's manifest ground truth and write results/benchmark/benchmark.csv.
//
// Each run directory holds run.json ({tool, sha, input, order, command, ...})
// and normalized.json: the tool's merged output as records
// {tUtc, sender, body, duplicateFlag, source, system}, where duplicateFlag means
// the tool kept the record but marked it a duplicate (hidden by default), and
// source is the input file the tool attributes the record to (null if none).
//
// A record the tool marks as a system line counts in shown_system unless it
// matches a ground-truth message, in which case it is matched as usual and also
// counted in shown_message_labelled_system (a genuine message mislabelled).
//
// order_inversions counts adjacent shown records (among those matching the
// truth) whose true times are out of order.
//
// A shown record matches a ground-truth message "exactly" when (tUtc, sender,
// body) are equal, and is "misdated" when they become equal only after
// swapping the day and month of tUtc (a DD/MM <-> MM/DD misreading). Bodies are
// compared without trailing whitespace; records whose body differs only there
// are counted in shown_body_trailing_ws_altered.
//
// Usage: node scripts/survey/bench/score.js

const fs = require('fs');
const path = require('path');
const { loadPair, key } = require('./truth');

const ROOT = path.join(__dirname, '..', '..', '..');
const RAW = path.join(ROOT, 'results', 'benchmark', 'raw');

function swapDayMonth(iso) {
  if (!iso) return null;
  const d = new Date(iso);
  const s = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCDate() - 1, d.getUTCMonth() + 1,
    d.getUTCHours(), d.getUTCMinutes(), d.getUTCSeconds()));
  // Only a real swap: the day must be a valid month and the result a valid date.
  return d.getUTCDate() <= 12 && s.getUTCMonth() === d.getUTCDate() - 1 ? s.toISOString() : null;
}

const trim = (r) => ({ ...r, body: r.body === null ? null : r.body.trimEnd() });

function classify(raw, truth) {
  const rec = trim(raw);
  const k = key(rec);
  if (truth.has(k)) return { kind: 'exact', k };
  const sw = swapDayMonth(rec.tUtc);
  if (sw && truth.has(key({ ...rec, tUtc: sw }))) return { kind: 'misdated', k: key({ ...rec, tUtc: sw }) };
  return { kind: 'unmatched', k: null };
}

function score(pairDir, out) {
  const { manifest, fragments, truth } = loadPair(pairDir);
  const shown = out.filter((r) => !r.duplicateFlag);
  const hits = new Map([...truth.keys()].map((k) => [k, { exact: 0, misdated: 0 }]));
  const kinds = { exact: 0, misdated: 0, unmatched: 0, system: 0 };
  let labelledSystem = 0;
  let wsAltered = 0;
  let inversions = 0;
  let prevT = null;
  for (const r of shown) {
    let c = classify(r, truth);
    if (c.k && r.system) labelledSystem++;
    if (!c.k && r.system) c = { kind: 'system', k: null };
    kinds[c.kind]++;
    if (c.k) {
      hits.get(c.k)[c.kind]++;
      if (r.body !== truth.get(c.k).body) wsAltered++;
      // Output order against true time, over the records that match truth.
      const t = truth.get(c.k).tUtc;
      if (prevT !== null && t < prevT) inversions++;
      prevT = t;
    }
  }
  let dupRemaining = 0;
  let overlapDupRemaining = 0;
  let lost = 0;
  let onlyMisdated = 0;
  for (const [k, h] of hits) {
    const n = h.exact + h.misdated;
    if (n === 0) lost++;
    if (n > 1) {
      dupRemaining += n - 1;
      if (truth.get(k).in.length > 1) overlapDupRemaining += n - 1;
    }
    if (n > 0 && h.exact === 0) onlyMisdated++;
  }

  // An input record survives if some output record (shown or flagged) carries
  // it from the same file, read exactly or with day/month swapped. A system
  // line is matched on time and text only, since each tool labels its sender.
  const outBySource = new Map();
  for (const raw of out) {
    const r = trim(raw);
    const set = outBySource.get(r.source) || new Set();
    const sw = swapDayMonth(r.tUtc);
    for (const v of [r, { ...r, sender: null }]) {
      set.add(key(v));
      if (sw) set.add(key({ ...v, tUtc: sw }));
    }
    outBySource.set(r.source, set);
  }
  const anySource = outBySource.size === 1 && outBySource.has(null);
  const inputs = fragments.flatMap((f) => f.records.map((r) => ({ ...r, file: f.file })));
  const absent = inputs.filter((r) => {
    const set = anySource ? outBySource.get(null) : outBySource.get(r.file);
    return !set || !set.has(key(r));
  });

  return {
    ground_truth: manifest.ground_truth_messages,
    input_records: inputs.length,
    output_shown: shown.length,
    output_flagged_duplicate: out.length - shown.length,
    shown_exact: kinds.exact,
    shown_misdated: kinds.misdated,
    shown_unmatched: kinds.unmatched,
    shown_system: kinds.system,
    shown_message_labelled_system: labelledSystem,
    shown_body_trailing_ws_altered: wsAltered,
    order_inversions: inversions,
    overlap_duplicates_remaining: overlapDupRemaining,
    duplicates_remaining_total: dupRemaining,
    genuine_lost: lost,
    genuine_only_misdated: onlyMisdated,
    input_records_absent_from_output: absent.length,
    input_messages_absent: absent.filter((r) => !r.system).length,
    input_system_absent: absent.filter((r) => r.system).length,
    absent_by_file: Object.fromEntries(fragments.map((f) => [f.file, absent.filter((r) => r.file === f.file).length])),
  };
}

function main() {
  const rows = [];
  for (const run of fs.readdirSync(RAW).sort()) {
    const dir = path.join(RAW, run);
    const meta = JSON.parse(fs.readFileSync(path.join(dir, 'run.json'), 'utf8'));
    if (meta.status !== 'ran') { rows.push({ run, ...meta }); continue; }
    const out = JSON.parse(fs.readFileSync(path.join(dir, 'normalized.json'), 'utf8'));
    rows.push({ run, ...meta, ...score(path.join(ROOT, meta.input), out) });
  }
  const cols = ['run', 'tool', 'variant', 'sha', 'input', 'order', 'status', 'ground_truth', 'input_records',
    'output_shown', 'output_flagged_duplicate', 'shown_exact', 'shown_misdated', 'shown_unmatched', 'shown_system', 'shown_message_labelled_system', 'shown_body_trailing_ws_altered', 'order_inversions',
    'overlap_duplicates_remaining', 'duplicates_remaining_total', 'genuine_lost', 'genuine_only_misdated',
    'input_records_absent_from_output', 'input_messages_absent', 'input_system_absent', 'absent_by_file',
    'diagnostics_emitted', 'conflicts_reported', 'provenance_reported', 'unparseable_input', 'note'];
  const csv = (v) => {
    const s = v === undefined || v === null ? '' : typeof v === 'object' ? JSON.stringify(v) : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  fs.writeFileSync(path.join(ROOT, 'results', 'benchmark', 'benchmark.csv'),
    [cols.join(','), ...rows.map((r) => cols.map((c) => csv(r[c])).join(','))].join('\n') + '\n');
  for (const r of rows) console.log(JSON.stringify(r));
}

module.exports = { score, swapDayMonth };
if (require.main === module) main();
