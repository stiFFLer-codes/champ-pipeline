'use strict';

// Fragment-scope date inference.
//
// This is NOT a CARTA stage. Section 3.3 permits it explicitly and constrains
// it tightly:
//
//   "An implementation may offer fragment-scope inference as a separate,
//    declared step that consumes Q_k and reports what it inferred and on what
//    evidence. What the specification rules out is performing that inference
//    silently within the stage, where the resulting timestamps would be
//    indistinguishable from ones that were never in doubt."
//
// Four constraints follow, and each is implemented as something checkable
// rather than something asserted:
//
//   SEPARATE      It lives outside core/src/normalization and runs only when
//                 called. Normalization never invokes it. A pipeline that skips
//                 this module is still conforming; it just quarantines more.
//   CONSUMES Q_k  Its only input is the quarantine set plus the records that
//                 resolved on their own. It re-reads no files.
//   REPORTS       Returns an inference report naming the order applied, the
//                 evidence count, and witness records by line range.
//   DISTINGUISH   Every rescued record carries an `inferred` block. A reader of
//                 U can always tell a record whose ordering was decided by
//                 outside evidence from one that was never in doubt, which is
//                 the whole reason the specification allows this at all.
//
// The evidence is the fragment's own unambiguous records. If a fragment
// contains at least one date whose day component exceeds twelve, that record
// admits a single reading and establishes the fragment's convention. Records
// that were ambiguous in isolation can then be resolved under it.
//
// Three cases where this step correctly does nothing:
//
//   No evidence         No record in the fragment resolved on its own, so there
//                       is nothing to generalise from. This is fixture-03: all
//                       of its dates are ambiguous and the fragment cannot
//                       settle itself. Nothing is inferred and Q_k is unchanged.
//   Split evidence      The fragment's own unambiguous records disagree on the
//                       order. That is a contradiction, not a majority vote to
//                       be taken, so nothing is inferred.
// (A fourth case, the established order yielding an invalid date, turns out to
// be unreachable: ambiguity requires both fields in 1..12, which is a valid
// (day, month) pair either way. It is a loud guard in the code, not a branch.)

const {
  resolveTimestamp, canonicalBody, classifyType, REASON, DEFAULT_POLICY,
} = require('../normalization');

// How many witnesses the fragment must supply before its convention is treated
// as established. One is enough in principle; requiring it to be declared is
// the point, not the threshold.
const DEFAULT_MIN_WITNESSES = 1;

/**
 * Run fragment-scope date inference over one normalized fragment.
 *
 * @param {object} normalized output of normalizeFragment
 * @param {{minWitnesses?:number}} [opts]
 * @returns {{sourceId, records, quarantine, inference, policy}}
 */
function inferFragmentDateOrder(normalized, opts) {
  const options = Object.assign({ minWitnesses: DEFAULT_MIN_WITNESSES }, opts || {});
  const policy = normalized.policy || DEFAULT_POLICY;

  // --- gather evidence from records that resolved without help --------------
  const witnesses = normalized.records.filter((r) => r.dateOrder && !r.inferred);
  const counts = {};
  for (const w of witnesses) counts[w.dateOrder] = (counts[w.dateOrder] || 0) + 1;
  const orders = Object.keys(counts);

  const report = {
    applied: false,
    order: null,
    reason: null,
    evidence: {
      witnessCount: witnesses.length,
      byOrder: counts,
      // A handful of concrete witnesses, located by line range so a reader can
      // go back to the bytes rather than take the count on trust.
      sample: witnesses.slice(0, 5).map((w) => ({
        line_range: w.provenance.line_range,
        dateOrder: w.dateOrder,
      })),
    },
    candidates: normalized.quarantine.filter((q) => q.reason === REASON.AMBIGUOUS_DATE_FORMAT).length,
    resolved: 0,
    stillQuarantined: 0,
  };

  if (orders.length === 0) {
    report.reason = 'no-evidence: no record in this fragment resolved its own date order';
  } else if (orders.length > 1) {
    report.reason = `split-evidence: unambiguous records disagree (${orders.map((o) => `${o} ${counts[o]}`).join(', ')})`;
  } else if (witnesses.length < options.minWitnesses) {
    report.reason = `insufficient-evidence: ${witnesses.length} witness(es), ${options.minWitnesses} required`;
  } else {
    report.applied = true;
    report.order = orders[0];
    report.reason = `established by ${witnesses.length} record(s) resolving to ${orders[0]} and none disagreeing`;
  }

  if (!report.applied) {
    report.stillQuarantined = normalized.quarantine.length;
    return {
      sourceId: normalized.sourceId,
      records: normalized.records,
      quarantine: normalized.quarantine,
      inference: report,
      policy,
    };
  }

  // --- apply, and mark everything it touches --------------------------------
  const records = normalized.records.slice();
  const quarantine = [];

  for (const q of normalized.quarantine) {
    if (q.reason !== REASON.AMBIGUOUS_DATE_FORMAT) {
      quarantine.push(q);
      continue;
    }
    const ts = resolveTimestamp(q.record.rawTimestamp, policy, report.order);
    if (!ts.ok) {
      // Unreachable, and deliberately loud rather than silently re-quarantining.
      //
      // A record carries AMBIGUOUS_DATE_FORMAT only when both leading fields
      // are in 1..12, which is a valid (day, month) pair under BOTH orderings --
      // every month has a 12th. Its time component is valid too, because
      // resolveTimestamp checks the clock before it ever reaches the ordering
      // question. So applying either order must succeed.
      //
      // If this ever throws, one of those two premises has changed and the
      // right response is to fix the premise, not to quarantine the record and
      // move on.
      throw new Error(
        `fragment-scope inference: ${report.order} unexpectedly failed on ` +
          `"${q.record.rawTimestamp}" (${ts.reason}) at ${normalized.sourceId} ` +
          `line ${q.provenance.line_range[0]}`
      );
    }
    records.push({
      tUtc: ts.tUtc,
      dateOrder: ts.dateOrder,
      // Reuses Normalization's own field construction rather than restating
      // it: a rescued record must be schema-identical to one that resolved
      // unaided, or the `inferred` mark would not be the only difference.
      sender: q.record.rawSender ? q.record.rawSender.trim() : null,
      type: classifyType(q.record),
      body: canonicalBody(q.record),
      attachment: q.record.attachment
        ? { ref: q.record.attachment.rawRef, form: q.record.attachment.form }
        : null,
      sourceSeq: q.sourceSeq,
      provenance: q.provenance,
      // The mark that keeps this distinguishable from a record that was never
      // in doubt. Section 3.3's requirement, and the reason this step is
      // permitted rather than forbidden.
      inferred: {
        field: 'dateOrder',
        value: report.order,
        by: 'fragment-scope-inference',
        basis: `${report.evidence.witnessCount} unambiguous record(s) in ${normalized.sourceId}`,
      },
    });
    report.resolved++;
  }

  report.stillQuarantined = quarantine.length;

  // Conservation still holds across this step: nothing gained, nothing lost.
  if (records.length + quarantine.length !== normalized.records.length + normalized.quarantine.length) {
    throw new Error(
      `fragment-scope inference lost records on ${normalized.sourceId}: ` +
        `${records.length} + ${quarantine.length} != ` +
        `${normalized.records.length + normalized.quarantine.length}`
    );
  }

  // Sort so the fragment's records stay in source order regardless of which
  // pass produced them. Synthesis re-sorts globally, but a fragment-level
  // consumer should not see rescued records bolted on at the end.
  records.sort((x, y) => x.sourceSeq - y.sourceSeq);

  return { sourceId: normalized.sourceId, records, quarantine, inference: report, policy };
}

module.exports = { inferFragmentDateOrder, DEFAULT_MIN_WITNESSES };
