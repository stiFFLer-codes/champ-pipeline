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
//   zone              Per fragment. Default +00:00, and recorded as defaulted.
//                     SEE THE NOTE BELOW.
//   yearWindow        Two-digit years: 00-69 -> 2000-2069, 70-99 -> 1970-1999.
//   typeTaxonomy      message.text | message.attachment | message.empty | system
//   reasonPrecedence  First matching code wins, in the fixed order declared in
//                     REASON_PRECEDENCE below.
//   canonicalisations The export-variant rules in CANONICALISATIONS below.
// -------------------------------------------------------------------------
//
// NOTE ON TIME ZONES (CARTA 1.1):
//
//   A canonical record carries a UTC instant, and a WhatsApp text export
//   carries no zone or offset: converting its wall-clock reading to an instant
//   needs a fact the input does not contain. So every fragment is normalized
//   under a DECLARED zone -- the device's zone when the export was written --
//   which is either a fixed offset ("+05:30") or an IANA name
//   ("Asia/Kolkata"), resolved per instant through Intl so that daylight
//   saving is applied where it was in force. Fragments from devices in
//   different zones need different declarations; a wrong declaration shifts
//   every instant of that fragment and defeats deduplication against the
//   others, which is why the zone of every fragment is reported in Omega.
//
//   Daylight saving makes some readings non-unique, and they are treated like
//   any other uninterpretable reading rather than guessed at:
//     - a reading the zone skipped (spring forward) names no instant:
//       MALFORMED_TIMESTAMP;
//     - a reading the zone repeated (fall back) names two instants an hour
//       apart: AMBIGUOUS_LOCAL_TIME.

const REASON = {
  UNSUPPORTED_FORMAT: 'UNSUPPORTED_FORMAT',
  INVALID_ENCODING: 'INVALID_ENCODING',
  MALFORMED_TIMESTAMP: 'MALFORMED_TIMESTAMP',
  AMBIGUOUS_DATE_FORMAT: 'AMBIGUOUS_DATE_FORMAT',
  AMBIGUOUS_LOCAL_TIME: 'AMBIGUOUS_LOCAL_TIME',
  UNRESOLVED_SENDER: 'UNRESOLVED_SENDER',
};

// What each code asserts, published in Omega so the taxonomy is part of the
// report rather than something a reader must look up in the source.
const REASON_MEANING = {
  UNSUPPORTED_FORMAT: 'text that does not open with a record head and belongs to no record',
  INVALID_ENCODING: 'the record contains bytes that are not valid UTF-8',
  MALFORMED_TIMESTAMP: 'the timestamp names no instant: unparseable, an impossible date or clock value, or a local time skipped by a DST transition in the declared zone',
  AMBIGUOUS_DATE_FORMAT: 'the date reads validly as both day-month-year and month-day-year',
  AMBIGUOUS_LOCAL_TIME: 'the local time occurs twice in the declared zone (a DST fall-back), so it names two instants',
  UNRESOLVED_SENDER: 'a message line with an empty sender',
};

// A record can fail more than one way at once. The specification asks for one
// typed code, so the order is fixed and declared rather than left to whichever
// check happened to run first.
const REASON_PRECEDENCE = [
  REASON.UNSUPPORTED_FORMAT,
  REASON.INVALID_ENCODING,
  REASON.MALFORMED_TIMESTAMP,
  REASON.AMBIGUOUS_DATE_FORMAT,
  REASON.AMBIGUOUS_LOCAL_TIME,
  REASON.UNRESOLVED_SENDER,
];

const TYPE = {
  TEXT: 'message.text',
  ATTACHMENT: 'message.attachment',
  EMPTY: 'message.empty',
  SYSTEM: 'system',
};

const DEFAULT_POLICY = {
  zone: '+00:00',
  yearWindowPivot: 70, // < 70 -> 2000s, >= 70 -> 1900s
  typeTaxonomy: Object.values(TYPE),
  reasonPrecedence: REASON_PRECEDENCE,
};

// --- declared zones ----------------------------------------------------------

const zones = new Map();

// '+05:30' -> fixed offset; anything else must be an IANA name Intl knows.
// An unknown zone is refused outright: falling back to UTC would be exactly
// the silent default this declaration exists to prevent.
function parseZone(zone) {
  if (zones.has(zone)) return zones.get(zone);
  let z;
  const m = /^([+-])(\d{2}):(\d{2})$/.exec(zone);
  if (m) {
    if (Number(m[2]) > 14 || Number(m[3]) > 59) throw new Error(`offset out of range: "${zone}"`);
    const ms = (m[1] === '-' ? -1 : 1) * (Number(m[2]) * 60 + Number(m[3])) * 60000;
    z = { name: zone, kind: 'fixed-offset', offsetAt: () => ms };
  } else {
    let fmt;
    try {
      fmt = new Intl.DateTimeFormat('en-US', {
        timeZone: zone, hourCycle: 'h23',
        year: 'numeric', month: 'numeric', day: 'numeric',
        hour: 'numeric', minute: 'numeric', second: 'numeric',
      });
    } catch (e) {
      throw new Error(`unknown time zone "${zone}": declare an IANA name (e.g. Asia/Kolkata) or an offset (e.g. +05:30)`);
    }
    // The zone's UTC offset at instant t, read back from its wall clock.
    const offsetAt = (t) => {
      const p = {};
      for (const { type, value } of fmt.formatToParts(t)) p[type] = Number(value);
      return Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second) - t;
    };
    // Recorded as declared: ICU's resolved id can be a legacy alias (Node 24
    // resolves Asia/Kolkata to Asia/Calcutta), which is not what anyone typed.
    z = { name: zone, kind: 'iana', offsetAt };
  }
  zones.set(zone, z);
  return z;
}

// Every instant at which the zone's clock reads `wall` (a wall-clock reading
// coded as if it were UTC). Usually one; none in a DST gap, two in an overlap.
// ponytail: candidate offsets are sampled a day either side, so a zone with
// two transitions inside 48 hours would be misread; no current IANA zone has.
function instantsAt(z, wall) {
  const offsets = new Set([z.offsetAt(wall - 86400000), z.offsetAt(wall + 86400000)]);
  return [...offsets].map((o) => wall - o).filter((t) => z.offsetAt(t) === wall - t).sort((x, y) => x - y);
}

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

  // The date is settled; the declared zone turns the reading into an instant.
  // A failure here is flagged `zone`, so the inference step can tell it from a
  // date that failed (which it treats as impossible).
  const instants = instantsAt(parseZone(policy.zone), Date.UTC(year, month - 1, day, hour, minute));
  if (instants.length === 0) return { ok: false, reason: REASON.MALFORMED_TIMESTAMP, zone: true };
  if (instants.length > 1) return { ok: false, reason: REASON.AMBIGUOUS_LOCAL_TIME, zone: true };
  return { ok: true, tUtc: instants[0], dateOrder };
}

function classifyType(rec) {
  if (rec.category === 'system') return TYPE.SYSTEM;
  if (rec.attachment) return TYPE.ATTACHMENT;
  if (rec.rawBody === '') return TYPE.EMPTY;
  return TYPE.TEXT;
}

// Attachment canonicalisations. Equation (10) deduplicates on body equality
// and attachment congruence. Two devices exporting the same attachment message
// in different variants -- exactly the TCF configuration, two handsets on
// possibly different app versions -- write it differently, and every
// difference that is export noise rather than message content is removed here:
//
//   attachment-marker  The "<file> (file attached)" line is the export's way of
//                      writing the attachment, which the canonical record
//                      carries as `attachment`. The body is the caption: the
//                      lines written with it, if any.
//   double-filename    That variant repeats the filename on a continuation
//                      line. An artefact of the export, so the caption drops it.
//   trailing-period    That variant writes "IMG-...-WA0001." with the extension
//                      lost. Nothing in the record can restore it, so it cannot
//                      be canonicalised to the standard name; instead every
//                      attachment gets a `stem` (name minus its final extension
//                      or bare trailing period), and Synthesis compares stems
//                      only when a trailing-period rendering is involved.
//                      Dropping extensions from every name would make the
//                      variants equal too, but would merge report.pdf with
//                      report.docx.
//
// Nothing is lost: Ingestion preserved the raw text, and provenance still
// points at, and hashes, the bytes containing every line.
const CANONICALISATIONS = {
  'attachment-marker': 'the "<file> (file attached)" line becomes attachment {ref, form, stem}; body is the caption (the remaining lines)',
  'double-filename': 'trailing continuation lines repeating the attachment filename are dropped from the caption',
  'trailing-period': 'stem = filename minus its final extension or bare trailing period; Synthesis compares stems when a trailing-period rendering is involved',
};

function canonicalBody(rec) {
  if (rec.category === 'system') return rec.rawSystemText;
  if (!rec.attachment) return rec.rawBody;
  const lines = rec.rawBody.split('\n').slice(1);
  if (rec.attachment.form === 'double-filename') {
    while (lines.length > 0 && lines[lines.length - 1] === rec.attachment.rawRef) lines.pop();
  }
  return lines.join('\n');
}

function canonicalAttachment(att) {
  if (!att) return null;
  return { ref: att.rawRef, form: att.form, stem: att.rawRef.replace(/\.[^.]*$/, '') };
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

// The canonical record. Built in one place so the declared inference step,
// which rescues records after the fact, produces records schema-identical to
// ones that resolved unaided.
function canonicalRecord(rec, ts, seq) {
  return {
    tUtc: ts.tUtc,
    dateOrder: ts.dateOrder,
    sender: resolveSender(rec).sender,
    type: classifyType(rec),
    body: canonicalBody(rec),
    attachment: canonicalAttachment(rec.attachment),
    // Synthesis sorts primarily by t_utc and secondarily by source sequence
    // index (paper Section 4.1). That index is this record's position in its
    // own fragment, and it is the tie-break Invariant 3 depends on.
    sourceSeq: seq,
    provenance: rec.provenance,
  };
}

/**
 * Normalize one ingested fragment.
 * @param {{sourceId:string, records:object[]}} ingested output of ingestFragment
 * @param {object} [policyOverrides]
 * @returns {{sourceId, records, quarantine, policy, stats}}
 */
function normalizeFragment(ingested, policyOverrides) {
  const policy = Object.assign({}, DEFAULT_POLICY, policyOverrides || {});
  const z = parseZone(policy.zone); // refuses an unknown zone before any record is read
  const zone = {
    name: z.name,
    kind: z.kind,
    source: policyOverrides && policyOverrides.zone !== undefined ? 'declared' : 'default',
  };
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

    records.push(canonicalRecord(rec, ts, seq));
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
    idSource: ingested.idSource,
    sha256: ingested.sha256,
    zone,
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
  normalizeFragment, resolveTimestamp, canonicalRecord,
  REASON, REASON_MEANING, TYPE, DEFAULT_POLICY, CANONICALISATIONS,
};
