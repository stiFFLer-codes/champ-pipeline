'use strict';

// CARTA Stage 3 -- Synthesis.
//   S : ({R'_1..R'_n}, {Q_1..Q_n}) -> (U, Omega)
//
// The only stage that sees fragments together. Follows Algorithm 1 of the paper
// line for line: order, cluster, synthesise one canonical record per cluster,
// detect conflicts within clusters and then across them, assemble Omega.
//
// -------------------------------------------------------------------------
// DECLARED PARAMETERS (Section 3.8 requires a conforming implementation to
// publish these; they are returned in the result and land in Omega).
//
// 1. CLUSTERING PROCEDURE -- transitive closure with a bounded cluster
//    diameter, implemented as complete linkage. A record joins an existing
//    cluster only if it satisfies ~dedup with EVERY member, not merely with one.
//
//    Section 4.2 leaves the choice open between this and unbounded connected
//    components, and requires the choice to be stated. Bounded is chosen because
//    Section 8.5 cites Baas et al. showing that taking the transitive closure
//    over a similarity relation can degrade precision substantially through
//    chaining: three records each just under dt apart would otherwise land in
//    one cluster while the outer two are further apart than dt allows. Having
//    cited that result, adopting the rule it warns against would be indefensible.
//
// 2. FIELD PRECEDENCE for SynthesizeCanonicalMessage -- one representative
//    observation supplies every canonical field, and the representative is the
//    member with the lowest (t_utc, source_id, sourceSeq).
//
//    This is a fixed per-field rule in the sense Section 4.2 requires: the same
//    rule for every field. Choosing a whole observation rather than mixing
//    fields across observations is deliberate. Field-wise mixing can synthesise
//    a canonical record that no fragment ever actually contained, which is a
//    fabrication wearing the costume of a reconciliation. Every record in U here
//    is a record that genuinely appeared in at least one source.
//
// 3. dt_granularity (deduplication window) -- default 0 ms, i.e. exact match.
//    Both fragments come from one platform at one quantisation (minutes), so a
//    wider window buys nothing and costs precision: the same sender repeating
//    the same short message inside the window would be collapsed into one. See
//    the note on over-merging in the stats.
//
// 4. dt_conflict (coarse conflict bucket) -- default 60000 ms (one minute),
//    with the constraint dt_granularity <= dt_conflict enforced at entry.
// -------------------------------------------------------------------------

const DEFAULT_PARAMS = {
  dtGranularityMs: 0,
  dtConflictMs: 60000,
  clustering: 'transitive-closure-bounded-diameter (complete linkage)',
  fieldPrecedence: 'single representative: min (t_utc, source_id, sourceSeq)',
};

// Attachment congruence, the ~= of Equation (10). Two attachments are congruent
// when both are absent, or both name the same file. The FORM they were written
// in (standard, trailing-period, doubled filename) is an export quirk, not a
// property of the message, so it does not block a match -- but a disagreement
// about it is reported as a conflict rather than silently dropped.
function attachmentsCongruent(a, b) {
  if (!a && !b) return true;
  if (!a || !b) return false;
  return a.ref === b.ref;
}

// Equation (10). Note it does NOT constrain type or attachment form; those are
// exactly the fields a cluster can disagree on, which is what line 9 reports.
function similar(x, y, dtMs) {
  return Math.abs(x.tUtc - y.tUtc) <= dtMs
    && x.sender === y.sender
    && x.body === y.body
    && attachmentsCongruent(x.attachment, y.attachment);
}

function compareRecords(x, y) {
  if (x.tUtc !== y.tUtc) return x.tUtc - y.tUtc;
  // The secondary key of Section 4.1. Without it two runs could disagree on
  // records sharing a timestamp, and Invariant 3 would be unattainable.
  const s = x.provenance.source_id.localeCompare(y.provenance.source_id);
  if (s !== 0) return s;
  return x.sourceSeq - y.sourceSeq;
}

// Line 4. Complete linkage: join only if similar to every existing member.
function groupIntoReconciliationClusters(sorted, dtMs) {
  const clusters = [];
  for (const rec of sorted) {
    let placed = false;
    // Only clusters still within reach on the time axis can accept this record;
    // the input is sorted, so scanning from the end is enough.
    for (let i = clusters.length - 1; i >= 0; i--) {
      const c = clusters[i];
      if (rec.tUtc - c[0].tUtc > dtMs) break;
      if (c.every((m) => similar(m, rec, dtMs))) { c.push(rec); placed = true; break; }
    }
    if (!placed) clusters.push([rec]);
  }
  return clusters;
}

// Line 6.
function synthesizeCanonicalMessage(cluster) {
  const rep = cluster.slice().sort(compareRecords)[0];
  const inferredCount = cluster.filter((r) => r.inferred).length;
  return {
    tUtc: rep.tUtc,
    sender: rep.sender,
    type: rep.type,
    body: rep.body,
    attachment: rep.attachment,
    dateOrder: rep.dateOrder,
    // How the contributing observations came to be dated. A canonical record
    // built partly from observations whose ordering was inferred is not the
    // same evidential object as one built entirely from records that were never
    // in doubt, and Omega should not pretend otherwise.
    dating: inferredCount === 0 ? 'direct'
      : inferredCount === cluster.length ? 'inferred' : 'mixed',
    observations: cluster.length,
  };
}

// Line 9. Members already agree on sender, body and attachment ref, because
// ~dedup required it. What remains available to disagree on is the typed
// payload, the attachment form, and the exact instant within the window.
function hasUnresolvedConflict(cluster) {
  if (cluster.length < 2) return null; // a cluster of one never conflicts
  const disagreements = [];
  const types = new Set(cluster.map((r) => r.type));
  if (types.size > 1) disagreements.push({ field: 'type', values: [...types] });
  const forms = new Set(cluster.map((r) => (r.attachment ? r.attachment.form : null)));
  if (forms.size > 1) disagreements.push({ field: 'attachment.form', values: [...forms] });
  return disagreements.length ? disagreements : null;
}

function createConflictDescriptor(cluster, disagreements) {
  return {
    kind: 'within-cluster',
    disagreements,
    observations: cluster.map((r) => ({
      source_id: r.provenance.source_id,
      line_range: r.provenance.line_range,
      tUtc: r.tUtc,
      type: r.type,
    })),
  };
}

// Line 14, Equation (12). Two canonical records in the same coarse bucket that
// were NOT deduplicated, and that disagree on sender or on ordering.
//
// DEPARTURE FROM THE LITERAL EQUATION, declared rather than quietly applied.
//
// Equation (12)'s second disjunct is s(u_i) != s(u_j). Read literally, that
// flags every pair of records in the same coarse bucket sent by different
// people. In a group chat that is not a contradiction, it is a conversation:
// three participants messaging inside one minute yields three "conflicts", and
// the count grows as the square of the traffic in a bucket. Verified: the
// three-line example in tests/test-synthesis.js produces 3 conflicts under the
// literal reading and 0 under the one below.
//
// A sender disagreement is only irreconcilable when the two records are
// otherwise the same observation -- same body, same bucket, attributed to two
// different people. That is a genuine "who said this?" which no total order can
// settle. Two different bodies from two different senders settle themselves.
//
// The clause is therefore read as: same bucket, not deduplicated, SAME BODY,
// different sender. Ordering-unsatisfiable is unaffected and applies as written.
//
// Records with no sender (system lines) are excluded from the sender clause
// entirely: s() is undefined for them, so `null !== 'Alice'` is a type error
// dressed as a finding, not a contradiction.
//
// Flagged for the paper. This is a defect in the equation, not in the data.
function detectCrossClusterConflicts(unified, params) {
  const out = [];
  const bucket = (t) => Math.floor(t / params.dtConflictMs);
  for (let i = 0; i < unified.length; i++) {
    for (let j = i + 1; j < unified.length; j++) {
      const a = unified[i];
      const b = unified[j];
      if (bucket(a.tUtc) !== bucket(b.tUtc)) break; // sorted: no later j can match
      if (similar(a, b, params.dtGranularityMs)) continue; // one message, not two
      const senderClash =
        a.sender !== null && b.sender !== null &&
        a.sender !== b.sender && a.body === b.body;
      const orderClash = orderingUnsatisfiable(a, b);
      if (!senderClash && !orderClash) continue;
      out.push({
        kind: 'cross-cluster',
        reason: senderClash ? 'sender-disagreement' : 'ordering-unsatisfiable',
        records: [a.id, b.id],
        bucket: bucket(a.tUtc) * params.dtConflictMs,
      });
    }
  }
  return out;
}

// seq(u_i, u_j) is unsatisfiable when the fragments order the pair in opposite
// directions, so no single total order respects both. Position inside a
// fragment is its line range, which is monotonic by construction.
function orderingUnsatisfiable(a, b) {
  const signs = new Set();
  for (const pa of a.provenance) {
    for (const pb of b.provenance) {
      if (pa.source_id !== pb.source_id) continue;
      signs.add(Math.sign(pa.line_range[0] - pb.line_range[0]));
    }
  }
  signs.delete(0);
  return signs.size > 1;
}

/**
 * @param {object[]} fragments outputs of normalizeFragment (optionally passed
 *        through fragment-scope inference first)
 * @param {object} [paramOverrides]
 * @returns {{unified, omega, params}}
 */
function synthesize(fragments, paramOverrides) {
  const params = Object.assign({}, DEFAULT_PARAMS, paramOverrides || {});
  if (params.dtGranularityMs > params.dtConflictMs) {
    throw new Error(
      `dtGranularityMs (${params.dtGranularityMs}) must not exceed dtConflictMs ` +
        `(${params.dtConflictMs}); otherwise one pair of records could be both ` +
        'a single message and two conflicting ones'
    );
  }

  // Line 2: the first point in the pipeline at which fragments meet.
  const all = [];
  for (const f of fragments) for (const r of f.records) all.push(r);

  // Line 3.
  const sorted = all.slice().sort(compareRecords);

  // Line 4.
  const clusters = groupIntoReconciliationClusters(sorted, params.dtGranularityMs);

  // Lines 5-13.
  const unified = [];
  const conflicts = [];
  const provenanceMap = {};
  clusters.forEach((cluster, idx) => {
    const u = synthesizeCanonicalMessage(cluster);
    u.id = `u${String(idx + 1).padStart(6, '0')}`;
    u.provenance = cluster.map((r) => r.provenance);
    provenanceMap[u.id] = u.provenance;
    const disagreements = hasUnresolvedConflict(cluster);
    if (disagreements) conflicts.push(createConflictDescriptor(cluster, disagreements));
    unified.push(u);
  });

  // Line 14.
  conflicts.push(...detectCrossClusterConflicts(unified, params));

  // Line 15.
  const quarantine = [];
  for (const f of fragments) for (const q of f.quarantine) quarantine.push(q);

  const dating = { direct: 0, inferred: 0, mixed: 0 };
  for (const u of unified) dating[u.dating]++;

  const omega = {
    provenance_map: provenanceMap,
    quarantine,
    conflicts,
    stats: {
      fragments: fragments.length,
      normalizedRecordsIn: all.length,
      unifiedRecords: unified.length,
      duplicatesCollapsed: all.length - unified.length,
      quarantined: quarantine.length,
      quarantineByReason: quarantine.reduce((acc, q) => {
        acc[q.reason] = (acc[q.reason] || 0) + 1; return acc;
      }, {}),
      conflicts: conflicts.length,
      conflictsByKind: conflicts.reduce((acc, c) => {
        acc[c.kind] = (acc[c.kind] || 0) + 1; return acc;
      }, {}),
      // Ambiguity that outside evidence resolved, versus ambiguity still
      // standing. Section 3.5 asks Omega to report both.
      datingOfUnifiedRecords: dating,
    },
    params,
  };

  checkInvariants(fragments, unified, omega);
  return { unified, omega, params };
}

// Invariants 1 and 2, checked on every run rather than asserted in prose.
// Invariant 3 (determinism) is a property of two runs and lives in the tests.
function checkInvariants(fragments, unified, omega) {
  // Invariant 2: every record in U carries at least one provenance entry.
  for (const u of unified) {
    if (!Array.isArray(u.provenance) || u.provenance.length < 1) {
      throw new Error(`Invariant 2 violated: ${u.id} carries no provenance`);
    }
  }

  // Invariant 1: zero unaccounted loss. Every normalized record either
  // contributes provenance to a record in U or appears in the quarantine
  // carryover. Identity is (source_id, line_range), which Ingestion guarantees
  // is unique within a fragment.
  const key = (p) => `${p.source_id}#${p.line_range[0]}-${p.line_range[1]}`;
  const accounted = new Set();
  for (const u of unified) for (const p of u.provenance) accounted.add(key(p));
  for (const q of omega.quarantine) accounted.add(key(q.provenance));

  for (const f of fragments) {
    for (const r of f.records) {
      if (!accounted.has(key(r.provenance))) {
        throw new Error(`Invariant 1 violated: ${key(r.provenance)} reached neither U nor Q`);
      }
    }
  }
}

module.exports = {
  synthesize,
  similar,
  groupIntoReconciliationClusters,
  DEFAULT_PARAMS,
};
