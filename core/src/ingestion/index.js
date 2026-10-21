'use strict';

// CARTA Stage 1 -- Ingestion.   I : F_k -> R_k = <r_k,1, ..., r_k,M_k>
//
// Maps one fragment to a sequence of structured records, each carrying the raw
// text slice, the raw timestamp string, the raw sender token, a category, and a
// provenance tuple <source_id, line_range, sha256, record_sha256>. Paper
// Section 3.2. sha256 binds the record to a file state; record_sha256 binds it
// to its own bytes (see the provenance helper in ingestFragment).
//
// Three rules this stage obeys, and the reasons they are not negotiable:
//
//   Non-lossy.       Every line of the fragment ends up inside exactly one
//                    record's line_range. This is asserted on every run, not
//                    assumed -- Invariant 1 (zero unaccounted loss) is a claim
//                    about records the pipeline saw, so a line dropped HERE is
//                    lost before the quarantine set that would have caught it
//                    even exists.
//   Non-destructive. Fragment files are opened read-only. Nothing is written
//                    back, ever.
//   No reconciliation. This stage does not compare fragments, resolve senders,
//                    parse timestamps into instants, or decide anything is a
//                    duplicate. It parses. Anything that looks like a judgement
//                    call belongs to Normalization or Synthesis, so that a
//                    later discrepancy can be attributed to one stage.
//
// In particular a line this stage cannot classify becomes a record of category
// 'unparsed' rather than being skipped. Deciding what to do about it is
// Normalization's job (it routes to Q under a reason code); losing it silently
// is nobody's job.

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// A record line opens with the export's timestamp prefix. WhatsApp text exports
// write "DD/MM/YY, H:MM am - " or "DD/MM/YY, HH:MM - ". Both orderings of the
// date and both clock conventions are accepted here WITHOUT deciding which is
// which: the ordering is genuinely ambiguous for most dates, and resolving it
// is Normalization's decision under AMBIGUOUS_DATE_FORMAT. This stage captures
// the characters and moves on.
const RECORD_HEAD = /^(\d{2}\/\d{2}\/\d{2},\s\d{1,2}:\d{2}(?:\s?[ap]\.?m\.?)?)\s-\s(.*)$/i;

// Within the remainder, "Sender: body" marks a message and its absence marks a
// system line. WhatsApp sender tokens cannot contain ": ", so the first
// occurrence delimits. Stated as an assumption rather than buried: a contact
// whose display name contains ": " would be mis-split, and no fragment in the
// synthetic corpus exercises that.
const SENDER_SPLIT = ': ';

const ATTACHMENT = /^(.*\S)\s\(file attached\)$/;

function sha256Hex(buf) {
  return crypto.createHash('sha256').update(buf).digest('hex');
}

// Byte offset at which each line starts, aligned with splitLines(): a leading
// UTF-8 BOM is skipped, and only LF ends a line (a CR before it stays part of
// the line's bytes). starts[k + 1], when it exists, is where line k's
// terminator ends.
function lineByteStarts(buf) {
  let i = buf[0] === 0xef && buf[1] === 0xbb && buf[2] === 0xbf ? 3 : 0;
  const starts = [i];
  for (; i < buf.length; i++) if (buf[i] === 0x0a) starts.push(i + 1);
  return starts;
}

function splitLines(text) {
  // Strip a UTF-8 BOM if present, normalise CRLF, and drop only a single
  // trailing newline -- a blank line in the middle of a file is content and is
  // preserved as such.
  let t = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
  if (t === '') return []; // a zero-byte fragment has no lines, not one blank one
  t = t.replace(/\r\n/g, '\n');
  if (t.endsWith('\n')) t = t.slice(0, -1);
  // A file that was only a newline is one blank line, which '' .split would
  // also produce -- correct here, and distinct from the empty case above.
  return t.split('\n');
}

function classify(remainder) {
  const i = remainder.indexOf(SENDER_SPLIT);
  if (i === -1) {
    // No sender token. Either a system line ("Contact B added Contact C") or a
    // message with an empty body, which the export writes as "Sender: " with
    // the trailing space already consumed by the head regex.
    if (remainder.endsWith(':')) {
      return { category: 'message', rawSender: remainder.slice(0, -1), rawBody: '' };
    }
    return { category: 'system', rawSender: null, rawBody: remainder };
  }
  return {
    category: 'message',
    rawSender: remainder.slice(0, i),
    rawBody: remainder.slice(i + SENDER_SPLIT.length),
  };
}

function detectAttachment(rawBody, continuationLines) {
  const m = ATTACHMENT.exec(rawBody);
  if (!m) return null;
  const ref = m[1];
  // The doubled-filename variant repeats the bare filename on its own line
  // directly after the message line. That line is a continuation of this
  // record, so it is already inside line_range; naming the form here records
  // WHY the range spans two lines.
  if (continuationLines.length > 0 && continuationLines.includes(ref)) {
    return { rawRef: ref, form: 'double-filename' };
  }
  if (ref.endsWith('.')) return { rawRef: ref, form: 'trailing-period' };
  return { rawRef: ref, form: 'standard' };
}

/**
 * Ingest one fragment file.
 * @param {string} filePath path to a chat export
 * @param {{sourceId?: string}} [opts] override the source identifier (two
 *        exports named "WhatsApp Chat with X.txt" need distinct ones)
 * @returns {{sourceId: string, idSource: string, sha256: string, lineCount: number, records: object[]}}
 */
function ingestFragment(filePath, opts) {
  const options = opts || {};
  const buf = fs.readFileSync(filePath); // read-only: nothing is written back
  const digest = sha256Hex(buf);
  const sourceId = options.sourceId || path.basename(filePath);
  const lines = splitLines(buf.toString('utf8'));
  const byteStarts = lineByteStarts(buf);

  // record_sha256 hashes the record's raw bytes in the file: from the first
  // byte of its first line through the terminator (LF or CRLF) of its last
  // line, or to end of file if that line has none. Raw bytes, not decoded
  // text, so invalid UTF-8 and CRLF are bound exactly as found.
  const provenance = (s, e) => ({
    source_id: sourceId,
    line_range: [s + 1, e + 1], // 1-indexed, inclusive
    sha256: digest,
    record_sha256: sha256Hex(buf.subarray(byteStarts[s], byteStarts[e + 1] ?? buf.length)),
  });

  // Pass 1: find where each record starts. A line matching RECORD_HEAD opens a
  // record; anything else continues the record above it.
  const starts = [];
  for (let i = 0; i < lines.length; i++) {
    if (RECORD_HEAD.test(lines[i])) starts.push(i);
  }

  const records = [];

  // A file whose first line is not a record head has leading continuation lines
  // belonging to no record. That is malformed input, not something to discard.
  if (lines.length > 0 && (starts.length === 0 || starts[0] > 0)) {
    const end = starts.length === 0 ? lines.length : starts[0];
    records.push(makeUnparsed(lines.slice(0, end), provenance(0, end - 1), 0));
  }

  for (let s = 0; s < starts.length; s++) {
    const startLine = starts[s];
    const endLine = (s + 1 < starts.length ? starts[s + 1] : lines.length) - 1;
    const head = RECORD_HEAD.exec(lines[startLine]);
    const continuation = lines.slice(startLine + 1, endLine + 1);
    const parts = classify(head[2]);
    const attachment =
      parts.category === 'message' ? detectAttachment(parts.rawBody, continuation) : null;

    const bodyLines = parts.rawBody === null ? [] : [parts.rawBody].concat(continuation);

    records.push({
      index: records.length,
      category: parts.category,
      rawTimestamp: head[1],
      rawSender: parts.rawSender,
      rawBody: parts.category === 'system' ? null : bodyLines.join('\n'),
      rawSystemText: parts.category === 'system' ? [parts.rawBody].concat(continuation).join('\n') : null,
      attachment,
      multiline: continuation.length > 0,
      rawText: lines.slice(startLine, endLine + 1).join('\n'),
      provenance: provenance(startLine, endLine),
    });
  }

  assertNonLossy(records, lines.length, sourceId);

  // idSource says whether source_id is the file name or a declared id, so a
  // reader of Omega knows which of the two a provenance entry names.
  const idSource = options.sourceId ? 'declared' : 'file-name';
  return { sourceId, idSource, sha256: digest, lineCount: lines.length, records };
}

function makeUnparsed(sliceLines, provenance, index) {
  return {
    index,
    category: 'unparsed',
    rawTimestamp: null,
    rawSender: null,
    rawBody: null,
    rawSystemText: null,
    attachment: null,
    multiline: sliceLines.length > 1,
    rawText: sliceLines.join('\n'),
    provenance,
  };
}

// The stage's own guarantee, checked rather than claimed: the record line
// ranges tile the file exactly -- contiguous, non-overlapping, covering every
// line from 1 to lineCount.
function assertNonLossy(records, lineCount, sourceId) {
  if (lineCount === 0) return;
  let expected = 1;
  for (const r of records) {
    const [s, e] = r.provenance.line_range;
    if (s !== expected) {
      throw new Error(
        `Ingestion is lossy on ${sourceId}: expected a record starting at line ${expected}, got ${s}`
      );
    }
    if (e < s) throw new Error(`Ingestion produced an inverted line_range [${s}, ${e}] on ${sourceId}`);
    expected = e + 1;
  }
  if (expected - 1 !== lineCount) {
    throw new Error(
      `Ingestion is lossy on ${sourceId}: covered ${expected - 1} of ${lineCount} lines`
    );
  }
}

module.exports = { ingestFragment };
