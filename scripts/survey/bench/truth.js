'use strict';

// WP3 benchmark: ground truth for a generated fragment pair, independent of
// core/ (CHAMP-Pipeline's own parser is not used to judge other tools).
// Every line of a --tcf-pair fragment is one record in exactly the format the
// generator writes (scripts/generate-synthetic-fixtures.js makeFormatter):
//   DD/MM/YY or MM/DD/YY, then H:MM am|pm or HH:MM, then " - ", then
//   "Sender: body" or a senderless system text. Times are UTC wall clock.
// The date order of each fragment is taken from its manifest quirks.
//
// Usage: node scripts/survey/bench/truth.js <pair-dir>   (prints a summary)

const fs = require('fs');
const path = require('path');
const assert = require('assert');

const LINE = /^(\d{2})\/(\d{2})\/(\d{2}), (\d{1,2}):(\d{2})(?: (am|pm))? - (.*)$/;

function parseFragment(file, order) {
  const lines = fs.readFileSync(file, 'utf8').split('\n');
  if (lines[lines.length - 1] === '') lines.pop();
  return lines.map((line, i) => {
    const m = LINE.exec(line);
    assert(m, `${path.basename(file)}:${i + 1} is not a single-line generator record`);
    const [a, b] = [Number(m[1]), Number(m[2])];
    const [day, month] = order === 'dmy' ? [a, b] : [b, a];
    let hour = Number(m[4]);
    if (m[6]) hour = (hour % 12) + (m[6] === 'pm' ? 12 : 0);
    const t = new Date(Date.UTC(2000 + Number(m[3]), month - 1, day, hour, Number(m[5])));
    const sep = m[7].indexOf(': ');
    const system = sep === -1;
    return {
      file: path.basename(file), line: i + 1, raw: line,
      tUtc: t.toISOString(), system,
      sender: system ? null : m[7].slice(0, sep),
      body: system ? m[7] : m[7].slice(sep + 2),
    };
  });
}

const key = (r) => `${r.tUtc}|${r.sender}|${r.body}`;

function loadPair(dir) {
  const manifest = JSON.parse(fs.readFileSync(path.join(dir, 'manifest.json'), 'utf8'));
  const fragments = manifest.fragments.map((f) => {
    const order = f.quirks.includes('date-format-ddmmyy') ? 'dmy' : 'mdy';
    return { file: f.file, order, records: parseFragment(path.join(dir, f.file), order) };
  });
  const truth = new Map();
  for (const f of fragments) {
    for (const r of f.records) {
      if (r.system) continue;
      if (!truth.has(key(r))) truth.set(key(r), { ...r, in: [] });
      truth.get(key(r)).in.push(`${f.file}:${r.line}`);
    }
  }
  const msgs = (f) => f.records.filter((r) => !r.system).length;
  const overlap = [...truth.values()].filter((t) => t.in.length > 1).length;
  // The manifest is the ground truth; this parse must reproduce its counts.
  assert.strictEqual(truth.size, manifest.ground_truth_messages, 'ground-truth size');
  assert.strictEqual(msgs(fragments[0]), manifest.f1_message_records, 'F1 messages');
  assert.strictEqual(msgs(fragments[1]), manifest.f2_message_records, 'F2 messages');
  assert.strictEqual(overlap, manifest.overlap_messages, 'overlap');
  return { manifest, fragments, truth, key };
}

module.exports = { loadPair, key };

if (require.main === module) {
  const { manifest, fragments, truth } = loadPair(process.argv[2]);
  console.log(`seed ${manifest.seed}: truth ${truth.size} messages; ` +
    fragments.map((f) => `${f.file} ${f.order} ${f.records.length} records`).join('; '));
}
