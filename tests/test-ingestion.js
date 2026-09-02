'use strict';

// Self-check for CARTA Ingestion. No framework: node tests/test-ingestion.js
// Exit 0 = pass. Covers the cases the synthetic corpus does NOT exercise,
// because the corpus is well-formed by construction and a parser earns its
// keep on malformed input.

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { ingestFragment } = require('../core/src/ingestion');

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'champ-ingest-'));
let n = 0;
function withFile(name, content) {
  const p = path.join(tmp, `${n++}-${name}`);
  fs.writeFileSync(p, content, 'utf8');
  return p;
}
function lines(res) {
  return res.records.map((r) => r.provenance.line_range);
}

// --- the ordinary shapes ---------------------------------------------------

{
  const f = withFile('basic.txt', '08/01/24, 9:00 am - You: Hello\n');
  const r = ingestFragment(f).records;
  assert.strictEqual(r.length, 1);
  assert.strictEqual(r[0].category, 'message');
  assert.strictEqual(r[0].rawSender, 'You');
  assert.strictEqual(r[0].rawBody, 'Hello');
  assert.strictEqual(r[0].rawTimestamp, '08/01/24, 9:00 am');
  assert.deepStrictEqual(r[0].provenance.line_range, [1, 1]);
}

{
  // A system line carries no sender and keeps its text out of rawBody, so a
  // later stage cannot mistake it for something someone said.
  const f = withFile('system.txt', '08/01/24, 09:00 - Contact B created group "Beta"\n');
  const r = ingestFragment(f).records[0];
  assert.strictEqual(r.category, 'system');
  assert.strictEqual(r.rawSender, null);
  assert.strictEqual(r.rawBody, null);
  assert.strictEqual(r.rawSystemText, 'Contact B created group "Beta"');
}

{
  // Empty body: the export writes "Sender: " and the head regex eats the space.
  const f = withFile('empty.txt', '08/01/24, 9:07 am - You: \n');
  const r = ingestFragment(f).records[0];
  assert.strictEqual(r.category, 'message', 'empty body is a message, not a system line');
  assert.strictEqual(r.rawSender, 'You');
  assert.strictEqual(r.rawBody, '');
}

{
  // Multi-line: continuation lines extend line_range rather than starting a
  // record. This is what line_range being a RANGE is for.
  const f = withFile('multi.txt', '08/01/24, 11:02 - You: Agenda:\nfirst\nsecond\n');
  const r = ingestFragment(f).records;
  assert.strictEqual(r.length, 1);
  assert.strictEqual(r[0].rawBody, 'Agenda:\nfirst\nsecond');
  assert.strictEqual(r[0].multiline, true);
  assert.deepStrictEqual(r[0].provenance.line_range, [1, 3]);
}

// --- attachment forms ------------------------------------------------------

{
  const f = withFile('att.txt', '08/01/24, 09:00 - You: DOC-1.pdf (file attached)\n');
  assert.strictEqual(ingestFragment(f).records[0].attachment.form, 'standard');
}
{
  const f = withFile('att2.txt', '08/01/24, 09:00 - You: VID-1. (file attached)\n');
  const a = ingestFragment(f).records[0].attachment;
  assert.strictEqual(a.form, 'trailing-period');
  assert.strictEqual(a.rawRef, 'VID-1.');
}
{
  const f = withFile('att3.txt', '08/01/24, 09:00 - You: DOC-1.pdf (file attached)\nDOC-1.pdf\n');
  const r = ingestFragment(f).records;
  assert.strictEqual(r.length, 1, 'the repeated filename is a continuation, not a record');
  assert.strictEqual(r[0].attachment.form, 'double-filename');
  assert.deepStrictEqual(r[0].provenance.line_range, [1, 2]);
}

// --- malformed input: the part that actually matters -----------------------

{
  // A file opening with a continuation line has text belonging to no record.
  // It must survive as an 'unparsed' record: Normalization decides what to do
  // with it, and dropping it here would put it beyond the reach of Q.
  const f = withFile('orphan.txt', 'dangling text\n08/01/24, 09:00 - You: Hi\n');
  const r = ingestFragment(f).records;
  assert.strictEqual(r.length, 2);
  assert.strictEqual(r[0].category, 'unparsed');
  assert.strictEqual(r[0].rawText, 'dangling text');
  assert.deepStrictEqual(lines(ingestFragment(f)), [[1, 1], [2, 2]]);
}

{
  // A file with no record head at all is entirely unparsed, and still covered.
  const f = withFile('none.txt', 'not a chat export\nat all\n');
  const r = ingestFragment(f).records;
  assert.strictEqual(r.length, 1);
  assert.strictEqual(r[0].category, 'unparsed');
  assert.deepStrictEqual(r[0].provenance.line_range, [1, 2]);
}

{
  const f = withFile('blank.txt', '');
  const res = ingestFragment(f);
  assert.strictEqual(res.records.length, 0);
  assert.strictEqual(res.lineCount, 0);
}

{
  // A blank line mid-file is content, not a separator, and belongs to the
  // record above it.
  const f = withFile('gap.txt', '08/01/24, 09:00 - You: a\n\n08/01/24, 09:01 - You: b\n');
  const r = ingestFragment(f).records;
  assert.strictEqual(r.length, 2);
  assert.deepStrictEqual(r[0].provenance.line_range, [1, 2]);
  assert.strictEqual(r[0].rawBody, 'a\n');
}

// --- encoding ---------------------------------------------------------------

{
  const f = withFile('crlf.txt', '08/01/24, 09:00 - You: a\r\n08/01/24, 09:01 - You: b\r\n');
  const r = ingestFragment(f).records;
  assert.strictEqual(r.length, 2, 'CRLF must not produce phantom records');
  assert.strictEqual(r[1].rawBody, 'b');
}
{
  const f = withFile('bom.txt', '﻿08/01/24, 09:00 - You: a\n');
  const r = ingestFragment(f).records;
  assert.strictEqual(r.length, 1, 'a BOM must not make line 1 unparseable');
  assert.strictEqual(r[0].category, 'message');
}

// --- provenance -------------------------------------------------------------

{
  const content = '08/01/24, 09:00 - You: a\n';
  const f = withFile('prov.txt', content);
  const res = ingestFragment(f);
  const p = res.records[0].provenance;
  assert.strictEqual(p.source_id, path.basename(f));
  assert.strictEqual(p.sha256, res.sha256);
  assert.strictEqual(p.sha256.length, 64);
  // The hash binds the claim to a file state: change the file, change the hash.
  const f2 = withFile('prov2.txt', content + '08/01/24, 09:01 - You: b\n');
  assert.notStrictEqual(ingestFragment(f2).sha256, p.sha256);
}

// --- the stage guarantee, on real corpus files ------------------------------

{
  const dir = path.join(__dirname, '..', 'data', 'synthetic_fixtures');
  const files = fs.readdirSync(dir).filter((x) => x.endsWith('.txt'));
  assert.ok(files.length > 0, 'corpus is missing');
  for (const file of files) {
    const res = ingestFragment(path.join(dir, file));
    // ingestFragment asserts coverage internally; re-derive it here so the test
    // fails loudly rather than depending on an assertion that could be removed.
    let expected = 1;
    for (const r of res.records) {
      assert.strictEqual(r.provenance.line_range[0], expected, `gap in ${file}`);
      expected = r.provenance.line_range[1] + 1;
    }
    assert.strictEqual(expected - 1, res.lineCount, `coverage short in ${file}`);
  }
}

fs.rmSync(tmp, { recursive: true, force: true });
console.log('ingestion: all checks passed');
