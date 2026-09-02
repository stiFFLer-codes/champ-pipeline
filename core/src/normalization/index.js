'use strict';

// CARTA Stage 2 -- Normalization.   N : R_k -> (R'_k, Q_k)
//
// Converts one fragment's records into the canonical schema, and routes every
// record it cannot interpret unambiguously into the quarantine set instead of
// guessing. Paper Section 3.3.
//
// The rule that makes this stage more than a parser: a record that PARSES but
// admits more than one reading is quarantined, exactly like one that fails to
// parse. "03/04/24" is well-formed under both day-month-year and month-day-year
// and nothing inside the record decides between them, so it does not get
// normalised under the likelier convention. Guessing would turn an uncertainty
// into an assertion that no later stage, and no reader, could tell apart from an
// observation.
//
// Judgement is PER RECORD. A fragment where other records would settle the
// ordering does not rescue an ambiguous one here -- fragment-scope inference is
// permitted only as a separate, declared step that consumes Q_k and reports what
// it inferred, never silently inside this stage. That is the paper's rule and it
// is why the quarantine counts on this corpus are high rather than tidy.
//
// -------------------------------------------------------------------------
// DECLARED POLICY (paper Section 3.8 requires a conforming implementation to
// publish these; they are returned in the result and belong in Omega):
//
//   utcOffsetMinutes  Default 0. SEE THE NOTE BELOW -- this one is a genuine
//                     gap in the specification, not merely a tunable.
//   yearWindow        Two-digit years: 00-69 -> 2000-2069, 70-99 -> 1970-1999.
//   typeTaxonomy      message.text | message.attachment | message.empty | system
//   reasonPrecedence  First matching code wins, in the fixed order declared in
//                     REASON_PRECEDENCE below.
// -------------------------------------------------------------------------
//
// NOTE ON UTC, surfaced rather than papered over:
//
//   Section 3.3 says a canonical record carries "a UTC epoch timestamp". A
//   WhatsApp text export carries no UTC offset -- Section 5.2 already observes
//   that the export has no locale marker to settle the DATE ordering, and the
//   same is true of the clock. Converting a wall-clock reading to a UTC instant
//   therefore requires an offset the input does not contain.
//
//   Resolving that silently would be precisely the failure this stage exists to
//   prevent. So the offset is a declared policy parameter, defaulting to 0, and
//   the canonical timestamps are wall-clock instants correct up to the declared
//   offset. An implementation reconciling fragments from devices in different
//   zones must set it per fragment and say so.
//
//   This is a specification gap, not an implementation choice, and it is flagged
//   for the paper rather than fixed here.

const REASON = {
  UNSUPPORTED_FORMAT: 'UNSUPPORTED_FORMAT',
  INVALID_ENCODING: 'INVALID_ENCODING',
  MALFORMED_TIMESTAMP: 'MALFORMED_TIMESTAMP',
  AMBIGUOUS_DATE_FORMAT: 'AMBIGUOUS_DATE_FORMAT',
  UNRESOLVED_SENDER: 'UNRESOLVED_SENDER',
};

// A record can fail more than one way at once. The specification asks for one
// typed code, so the order is fixed and declared rather than left to whichever
// check happened to run first.
const REASON_PRECEDENCE = [
  REASON.UNSUPPORTED_FORMAT,
  REASON.INVALID_ENCODING,
  REASON.MALFORMED_TIMESTAMP,
  REASON.AMBIGUOUS_DATE_FORMAT,
  REASON.UNRESOLVED_SENDER,
];

const TYPE = {
  TEXT: 'message.text',
  ATTACHMENT: 'message.attachment',
  EMPTY: 'message.empty',
  SYSTEM: 'system',
};

const DEFAULT_POLICY = {
  utcOffsetMinutes: 0,
  yearWindowPivot: 70, // < 70 -> 2000s, >= 70 -> 1900s
  typeTaxonomy: Object.values(TYPE),
  reasonPrecedence: REASON_PRECEDENCE,
};

const STAMP = /^(\d{2})\/(\d{2})\/(\d{2}),\s(\d{1,2}):(\d{2})(?:\s?([ap])\.?m\.?)?$/i;

function daysInMonth(year, month) {
  return [31, (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0 ? 29 : 28,
    31, 30, 31, 30, 31, 31, 30, 31, 30, 31][month - 1];
}

function expandYear(yy, pivot) {
  return yy < pivot ? 2000 + yy : 1900 + yy;
}

/**
 * Resolve a raw timestamp string, or say why it cannot be resolved.
 * Returns {ok:true, tUtc, dateOrder} or {ok:false, reason}.
 *
 * `forceOrder` ('DMY' | 'MDY') resolves under a stated convention instead of
 * deriving one from the record's own values. Normalization NEVER passes it --
 * doing so would be the silent inference Section 3.3 rules out. It exists for
 * the separate, declared fragment-scope step in core/src/inference, which must
 * announce the order it applied and the evidence for it.
 */
function resolveTimestamp(raw, policy, forceOrder) {
  const m = STAMP.exec(raw || '');
  if (!m) return { ok: false, reason: REASON.MALFORMED_TIMESTAMP };

  const a = Number(m[1]);
  const b = Number(m[2]);
  const year = expandYear(Number(m[3]), policy.yearWindowPivot);
  let hour = Number(m[4]);
  const minute = Number(m[5]);
  const meridiem = m[6] ? m[6].toLowerCase() : null;

  if (meridiem) {
    if (hour < 1 || hour > 12) return { ok: false, reason: REASON.MALFORMED_TIMESTAMP };
    hour = meridiem === 'a' ? (hour === 12 ? 0 : hour) : (hour === 12 ? 12 : hour + 12);
  } else if (hour > 23) {
    return { ok: false, reason: REASON.MALFORMED_TIMESTAMP };
  }
  if (minute > 59) return { ok: false, reason: REASON.MALFORMED_TIMESTAMP };

  // Which of the two leading fields is the month? Decided by the values alone;
  // nothing outside the record is consulted.
  const aCouldBeMonth = a >= 1 && a <= 12;
  const bCouldBeMonth = b >= 1 && b <= 12;

  let day;
  let month;
  let dateOrder;
  if (forceOrder) {
    // A stated convention, supplied by the declared inference step. Still
    // validated: an order that yields an impossible date is not applied.
    if (forceOrder === 'DMY') { day = a; month = b; } else { month = a; day = b; }
    dateOrder = forceOrder;
    if (month < 1 || month > 12) return { ok: false, reason: REASON.MALFORMED_TIMESTAMP };
  } else if (aCouldBeMonth && bCouldBeMonth) {
    // Both readings are well-formed. This is the case the stage exists for.
    return { ok: false, reason: REASON.AMBIGUOUS_DATE_FORMAT };
  } else if (bCouldBeMonth) {
    day = a; month = b; dateOrder = 'DMY';
  } else if (aCouldBeMonth) {
    month = a; day = b; dateOrder = 'MDY';
  } else {
    // Neither field can be a month, so no reading exists under either
    // convention. Malformed, not ambiguous -- the distinction matters, because
    // ambiguity may be resolvable by outside evidence and this is not.
    return { ok: false, reason: REASON.MALFORMED_TIMESTAMP };
  }

  if (day < 1 || day > daysInMonth(year, month)) {
    return { ok: false, reason: REASON.MALFORMED_TIMESTAMP };
  }

  const wall = Date.UTC(year, month - 1, day, hour, minute);
  return { ok: true, tUtc: wall - policy.utcOffsetMinutes * 60000, dateOrder };
}

function classifyType(rec) {
  if (rec.category === 'system') return TYPE.SYSTEM;
  if (rec.attachment) return TYPE.ATTACHMENT;
  if (rec.rawBody === '') return TYPE.EMPTY;
  return TYPE.TEXT;
}

// The doubled-filename export variant repeats the attachment's filename on a
// continuation line. That line is an artefact of how the export was written,
// not something anybody sent, so the canonical body drops it.
//
// This matters more than it looks. Equation (10) deduplicates on body equality.
// Two devices exporting the same attachment message in different variants --
// exactly the TCF configuration, two handsets on possibly different app
// versions -- would otherwise produce bodies that differ by that repeated line,
// fail to deduplicate, and appear twice in U. Canonicalising here keeps
// Equation (10) intact rather than widening it to tolerate export noise.
//
// Nothing is lost: Ingestion preserved the raw text, and provenance line_range
// still points at the bytes containing both lines.
function canonicalBody(rec) {
  if (rec.category === 'system') return rec.rawSystemText;
  if (!rec.attachment || rec.attachment.form !== 'double-filename') return rec.rawBody;
  const lines = rec.rawBody.split('\n');
  while (lines.length > 1 && lines[lines.length - 1] === rec.attachment.rawRef) lines.pop();
  return lines.join('\n');
}

// Invalid UTF-8 survives a utf8 decode as U+FFFD. Its presence means bytes were
// lost before this stage could see them, which is not something to normalise.
function hasInvalidEncoding(rec) {
  return typeof rec.rawText === 'string' && rec.rawText.includes('�');
}

function resolveSender(rec) {
  if (rec.category === 'system') return { ok: true, sender: null };
  const s = (rec.rawSender || '').trim();
  if (s === '') return { ok: false, reason: REASON.UNRESOLVED_SENDER };
  return { ok: true, sender: s };
}

/**
 * Normalize one ingested fragment.
 * @param {{sourceId:string, records:object[]}} ingested output of ingestFragment
 * @param {object} [policyOverrides]
 * @returns {{sourceId, records, quarantine, policy, stats}}
 */
function normalizeFragment(ingested, policyOverrides) {
  const policy = Object.assign({}, DEFAULT_POLICY, policyOverrides || {});
  const records = [];
  const quarantine = [];

  ingested.records.forEach((rec, seq) => {
    const failures = [];

    // An unparsed line has no timestamp slot and no sender slot, so running the
    // other checks against it would manufacture secondary reason codes for
    // fields that do not exist. One code, and it is the accurate one.
    if (rec.category === 'unparsed') {
      quarantine.push({
        reason: REASON.UNSUPPORTED_FORMAT,
        alsoFailed: [],
        sourceSeq: seq,
        record: rec,
        provenance: rec.provenance,
      });
      return;
    }

    if (hasInvalidEncoding(rec)) failures.push(REASON.INVALID_ENCODING);

    const ts = resolveTimestamp(rec.rawTimestamp, policy);
    if (!ts.ok) failures.push(ts.reason);

    const sender = resolveSender(rec);
    if (!sender.ok) failures.push(sender.reason);

    if (failures.length > 0) {
      // One code, chosen by the declared precedence rather than by check order.
      const reason = REASON_PRECEDENCE.find((r) => failures.includes(r));
      quarantine.push({
        reason,
        alsoFailed: failures.filter((f) => f !== reason),
        sourceSeq: seq,
        record: rec,
        provenance: rec.provenance, // carried through, as the stage owes
      });
      return;
    }

    records.push({
      tUtc: ts.tUtc,
      dateOrder: ts.dateOrder,
      sender: sender.sender,
      type: classifyType(rec),
      body: canonicalBody(rec),
      attachment: rec.attachment ? { ref: rec.attachment.rawRef, form: rec.attachment.form } : null,
      // Synthesis sorts primarily by t_utc and secondarily by source sequence
      // index (paper Section 4.1). That index is this record's position in its
      // own fragment, and it is the tie-break Invariant 3 depends on.
      sourceSeq: seq,
      provenance: rec.provenance,
    });
  });

  // The stage's own guarantee: every record in equals one record out, on one
  // side or the other. Nothing is dropped and nothing is duplicated.
  if (records.length + quarantine.length !== ingested.records.length) {
    throw new Error(
      `Normalization lost records on ${ingested.sourceId}: ` +
        `${records.length} + ${quarantine.length} != ${ingested.records.length}`
    );
  }

  const byReason = {};
  for (const q of quarantine) byReason[q.reason] = (byReason[q.reason] || 0) + 1;

  return {
    sourceId: ingested.sourceId,
    records,
    quarantine,
    policy,
    stats: {
      ingested: ingested.records.length,
      normalized: records.length,
      quarantined: quarantine.length,
      byReason,
    },
  };
}

module.exports = {
  normalizeFragment, resolveTimestamp, canonicalBody, classifyType,
  REASON, TYPE, DEFAULT_POLICY,
};
