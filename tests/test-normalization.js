'use strict';

// Self-check for CARTA Normalization. node tests/test-normalization.js
// Exit 0 = pass.

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { ingestFragment } = require('../core/src/ingestion');
const { normalizeFragment, REASON, TYPE } = require('../core/src/normalization');

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'champ-norm-'));
let n = 0;
function norm(content, policy) {
  const p = path.join(tmp, `${n++}.txt`);
  fs.writeFileSync(p, content, 'utf8');
  return normalizeFragment(ingestFragment(p), policy);
}
function one(content, policy) {
  const r = norm(content, policy);
  assert.strictEqual(r.records.length + r.quarantine.length, 1);
  return r;
}

// --- unambiguous dates resolve, and to the right reading --------------------

{
  // 15 cannot be a month, so this is day-month-year and only that.
  const r = one('15/01/24, 5:49 am - You: hi\n');
  assert.strictEqual(r.records.length, 1);
  const rec = r.records[0];
  assert.strictEqual(rec.dateOrder, 'DMY');
  assert.strictEqual(new Date(rec.tUtc).toISOString(), '2024-01-15T05:49:00.000Z');
}
{
  // 13 in the second position forces month-day-year.
  const r = one('01/13/24, 03:04 - Contact G: hi\n');
  assert.strictEqual(r.records[0].dateOrder, 'MDY');
  assert.strictEqual(new Date(r.records[0].tUtc).toISOString(), '2024-01-13T03:04:00.000Z');
}

// --- the rule this stage exists for ----------------------------------------

{
  // Both fields <= 12: well-formed under both conventions, so quarantined
  // rather than resolved under the likelier one. This is the whole point.
  const r = one('03/04/24, 09:00 - You: hi\n');
  assert.strictEqual(r.records.length, 0);
  assert.strictEqual(r.quarantine[0].reason, REASON.AMBIGUOUS_DATE_FORMAT);
}
{
  // Per-record judgement: a neighbour that would settle the ordering does NOT
  // rescue the ambiguous record. Fragment-scope inference is a separate,
  // declared step, never something this stage does silently.
  const r = norm('25/01/24, 09:00 - You: unambiguous\n03/04/24, 09:01 - You: ambiguous\n');
  assert.strictEqual(r.records.length, 1);
  assert.strictEqual(r.quarantine.length, 1);
  assert.strictEqual(r.records[0].dateOrder, 'DMY');
  assert.strictEqual(r.quarantine[0].reason, REASON.AMBIGUOUS_DATE_FORMAT);
}

// --- malformed is distinct from ambiguous ----------------------------------

{
  // Neither field can be a month, so no reading exists under any convention.
  // Malformed, not ambiguous -- the codes call for different remedies.
  const r = one('25/13/24, 09:00 - You: hi\n');
  assert.strictEqual(r.quarantine[0].reason, REASON.MALFORMED_TIMESTAMP);
}
{
  // 31 February is well-formed as a string and impossible as a date.
  const r = one('31/02/24, 09:00 - You: hi\n');
  assert.strictEqual(r.quarantine[0].reason, REASON.MALFORMED_TIMESTAMP);
}
{
  // 29 February 2024 is real (leap year); 2023 is not.
  assert.strictEqual(norm('29/02/24, 09:00 - You: hi\n').records.length, 1);
  assert.strictEqual(norm('29/02/23, 09:00 - You: hi\n').quarantine[0].reason, REASON.MALFORMED_TIMESTAMP);
}
{
  const r = one('15/01/24, 25:00 - You: hi\n');
  assert.strictEqual(r.quarantine[0].reason, REASON.MALFORMED_TIMESTAMP);
}
{
  const r = one('15/01/24, 13:00 pm - You: hi\n'); // 13 with a meridiem is nonsense
  assert.strictEqual(r.quarantine[0].reason, REASON.MALFORMED_TIMESTAMP);
}

// --- 12-hour clock boundaries ----------------------------------------------

{
  assert.strictEqual(
    new Date(one('15/01/24, 12:00 am - You: hi\n').records[0].tUtc).toISOString(),
    '2024-01-15T00:00:00.000Z', 'midnight is 12 am, not 12:00'
  );
  assert.strictEqual(
    new Date(one('15/01/24, 12:00 pm - You: hi\n').records[0].tUtc).toISOString(),
    '2024-01-15T12:00:00.000Z', 'noon is 12 pm'
  );
  assert.strictEqual(
    new Date(one('15/01/24, 1:05 pm - You: hi\n').records[0].tUtc).toISOString(),
    '2024-01-15T13:05:00.000Z'
  );
}

// --- other reason codes -----------------------------------------------------

{
  const r = one('not a record line at all\n');
  assert.strictEqual(r.quarantine[0].reason, REASON.UNSUPPORTED_FORMAT);
}
{
  // An unparsed line has no timestamp slot and no sender slot, so it must NOT
  // accumulate secondary codes for fields that do not exist on it.
  const r = one('not a record line at all\n');
  assert.deepStrictEqual(r.quarantine[0].alsoFailed, []);
}
{
  // Where a record genuinely fails two ways, precedence is declared rather than
  // incidental, and the losing code is kept rather than discarded.
  const r = one('03/04/24, 09:00 - : hi\n'); // ambiguous date AND empty sender
  assert.strictEqual(r.quarantine[0].reason, REASON.AMBIGUOUS_DATE_FORMAT);
  assert.deepStrictEqual(r.quarantine[0].alsoFailed, [REASON.UNRESOLVED_SENDER]);
}
{
  const r = one('15/01/24, 09:00 - You: bad � byte\n');
  assert.strictEqual(r.quarantine[0].reason, REASON.INVALID_ENCODING);
}

// --- the canonical schema ---------------------------------------------------

{
  const r = one('15/01/24, 09:00 - Contact C: DOC-1.pdf (file attached)\n');
  const rec = r.records[0];
  assert.strictEqual(rec.type, TYPE.ATTACHMENT);
  assert.deepStrictEqual(rec.attachment, { ref: 'DOC-1.pdf', form: 'standard', stem: 'DOC-1' });
  assert.strictEqual(rec.body, '', 'the export marker line is the attachment, not the body');
  assert.strictEqual(rec.sender, 'Contact C');
}
{
  // The body of an attachment message is its caption. The three export
  // variants of one attachment canonicalise to the same caption and stem.
  const std = norm('15/01/24, 09:00 - A: IMG-1.jpg (file attached)\nnice view\n').records[0];
  const dbl = norm('15/01/24, 09:00 - A: IMG-1.jpg (file attached)\nnice view\nIMG-1.jpg\n').records[0];
  const tp = norm('15/01/24, 09:00 - A: IMG-1. (file attached)\nnice view\n').records[0];
  for (const r of [std, dbl, tp]) {
    assert.strictEqual(r.body, 'nice view');
    assert.strictEqual(r.attachment.stem, 'IMG-1');
  }
  assert.deepStrictEqual([std, dbl, tp].map((r) => r.attachment.form),
    ['standard', 'double-filename', 'trailing-period']);
}
{
  const r = one('15/01/24, 09:00 - Contact B created group "Beta"\n');
  const rec = r.records[0];
  assert.strictEqual(rec.type, TYPE.SYSTEM);
  assert.strictEqual(rec.sender, null, 'a system line has no sender to resolve');
  assert.strictEqual(rec.body, 'Contact B created group "Beta"');
}
{
  const r = one('15/01/24, 09:00 - You: \n');
  assert.strictEqual(r.records[0].type, TYPE.EMPTY);
}

// --- declared policy: the fragment's zone ------------------------------------

{
  // The export carries no zone. Undeclared, it is +00:00 and says so.
  const r = one('15/01/24, 12:00 - You: hi\n');
  assert.deepStrictEqual(r.zone, { name: '+00:00', kind: 'fixed-offset', source: 'default' });
  assert.strictEqual(new Date(r.records[0].tUtc).toISOString(), '2024-01-15T12:00:00.000Z');
}
{
  // Declaring a zone must move the instant -- otherwise it is decorative.
  const r = one('15/01/24, 12:00 - You: hi\n', { zone: '+05:30' });
  assert.deepStrictEqual(r.zone, { name: '+05:30', kind: 'fixed-offset', source: 'declared' });
  assert.strictEqual(new Date(r.records[0].tUtc).toISOString(), '2024-01-15T06:30:00.000Z');
}
{
  // An IANA zone applies the offset in force at that instant: London is UTC+0
  // in January and UTC+1 (BST) in July.
  const z = { zone: 'Europe/London' };
  assert.strictEqual(new Date(one('15/01/24, 12:00 - You: hi\n', z).records[0].tUtc).toISOString(),
    '2024-01-15T12:00:00.000Z');
  assert.strictEqual(new Date(one('15/07/24, 12:00 - You: hi\n', z).records[0].tUtc).toISOString(),
    '2024-07-15T11:00:00.000Z');
  assert.strictEqual(one('15/07/24, 12:00 - You: hi\n', z).zone.kind, 'iana');
}
{
  // 31 March 2024, 01:30 never happened in London (clocks went 01:00 -> 02:00):
  // no instant reads that way. 27 October 2024, 01:30 happened twice (02:00 ->
  // 01:00): two instants an hour apart. Neither is guessed at.
  const z = { zone: 'Europe/London' };
  assert.strictEqual(one('31/03/24, 01:30 - You: hi\n', z).quarantine[0].reason, REASON.MALFORMED_TIMESTAMP);
  assert.strictEqual(one('27/10/24, 01:30 - You: hi\n', z).quarantine[0].reason, REASON.AMBIGUOUS_LOCAL_TIME);
  // The hour either side of each transition is unaffected.
  assert.strictEqual(norm('31/03/24, 00:59 - You: a\n31/03/24, 02:00 - You: b\n27/10/24, 00:59 - You: c\n27/10/24, 02:00 - You: d\n', z)
    .records.length, 4);
}
{
  // An unknown zone is refused, not silently treated as UTC.
  assert.throws(() => norm('15/01/24, 12:00 - You: hi\n', { zone: 'Mars/Olympus_Mons' }), /unknown time zone/);
  assert.throws(() => norm('15/01/24, 12:00 - You: hi\n', { zone: '+15:00' }), /out of range/);
}

// --- stage guarantees -------------------------------------------------------

{
  // Provenance is carried through to BOTH sides. A quarantined record that lost
  // its provenance could not be traced back, which is what Invariant 1 needs.
  const r = norm('25/01/24, 09:00 - You: ok\n03/04/24, 09:01 - You: ambiguous\n');
  for (const rec of r.records) {
    assert.ok(rec.provenance.sha256 && rec.provenance.line_range && rec.provenance.source_id);
  }
  for (const q of r.quarantine) {
    assert.ok(q.provenance.sha256 && q.provenance.line_range && q.provenance.source_id);
  }
}

{
  // Conservation: every record in is one record out, on exactly one side.
  const dirs = [
    path.join(__dirname, '..', 'data', 'synthetic_fixtures'),
    path.join(__dirname, '..', 'data', 'synthetic_fixtures', 'tcf-pair'),
  ];
  let seen = 0;
  for (const dir of dirs) {
    for (const f of fs.readdirSync(dir).filter((x) => x.endsWith('.txt'))) {
      const ing = ingestFragment(path.join(dir, f));
      const r = normalizeFragment(ing);
      assert.strictEqual(
        r.records.length + r.quarantine.length,
        ing.records.length,
        `conservation failed on ${f}`
      );
      // Every normalised record carries the tie-break key Synthesis sorts on.
      for (const rec of r.records) assert.strictEqual(typeof rec.sourceSeq, 'number');
      seen++;
    }
  }
  assert.ok(seen >= 7, `expected the full corpus, saw ${seen} fragments`);
}

{
  // Determinism: same input, same output. Invariant 3 is a requirement on this
  // implementation, so it is checked rather than assumed. The SAME path is used
  // for both runs, because source_id is the file's own name and is part of the
  // input the pipeline is being deterministic about.
  const p = path.join(tmp, 'determinism.txt');
  fs.writeFileSync(p, '15/01/24, 09:00 - You: a\n03/04/24, 09:01 - You: b\n25/13/24, 09:02 - You: c\n', 'utf8');
  const a = JSON.stringify(normalizeFragment(ingestFragment(p)));
  const b = JSON.stringify(normalizeFragment(ingestFragment(p)));
  assert.strictEqual(a, b);
}

fs.rmSync(tmp, { recursive: true, force: true });
console.log('normalization: all checks passed');
