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
// 1. CLUSTERING PROCEDURE -- 'one-to-one' (CARTA 1.1), selectable with
//    params.clustering; the procedure text lands in Omega.
//
//    one-to-one  A cluster holds at most ONE observation per fragment. Runs of
//                mutually similar observations are formed by complete linkage
//                (below), then split: the k-th observation of the run in each
//                fragment, in that fragment's source order, joins the k-th
//                cluster. Two identical lines in ONE fragment are two messages
//                the user saw twice -- a fragment is internally complete and
//                does not duplicate itself -- so they must never collapse into
//                one. Where fragments disagree on how many times the run
//                occurs, the k-th-with-k-th pairing is a declared choice, not
//                an observation, and a dedup_ambiguity entry names the run.
//    complete    Complete linkage alone, the CARTA 1.0 behaviour: an
//                observation joins a cluster only if similar to EVERY member.
//                Bounded diameter, because Baas et al. (Section 8.5) show
//                transitive closure over a similarity relation degrades
//                precision through chaining. It can merge repeats within one
//                fragment. Kept for sensitivity experiments.
//    single      Single linkage (connected components), the unbounded chaining
//                the above warns against. Kept for sensitivity experiments.
//
// 2. FIELD PRECEDENCE for SynthesizeCanonicalMessage -- one representative
//    observation supplies every canonical field, and the representative is the
//    member that sorts first by (t_utc, fragment sha256, sourceSeq). Content
//    hash rather than file name (CARTA 1.1), so renaming a fragment cannot
//    change the representative.
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
//
// 5. zoneAdvisory -- the report-only zone-offset advisory (ZONE_ADVISORY).
// -------------------------------------------------------------------------

const {
  DEFAULT_POLICY, REASON_MEANING, CANONICALISATIONS,
} = require('../normalization');
const pkg = require('../../package.json');

const SPEC = 'CARTA 1.1';

const PROVENANCE_TUPLE = 'source_id: the fragment\'s file name, or the id declared for it (fragments[].idSource says which); line_range: first and last line, 1-indexed, inclusive; ' +
  'sha256: SHA-256 of the whole fragment file; record_sha256: SHA-256 of the record\'s raw bytes, from the ' +
  'first byte of its first line through the line terminator (LF or CRLF) of its last line, excluding a leading BOM';

const SIMILARITY = 'two observations are the same message when |t_utc difference| <= dtGranularityMs, ' +
  'senders are equal, canonical bodies are equal, and attachments are congruent';

const ORDER_TIE_BREAK ='t_utc, then fragment sha256, then sourceSeq (then source_id, reachable only between byte-identical fragments)';

const CLUSTERING = {
  'one-to-one': 'runs of mutually similar observations (complete linkage) split so that a cluster holds at most one observation per fragment: the k-th observation of the run in each fragment, in source order, joins the k-th cluster; differing per-fragment counts are reported as dedup_ambiguity',
  complete: 'complete linkage: an observation joins a cluster only if similar to every member (CARTA 1.0; can merge repeats within one fragment)',
  single: 'single linkage: connected components of the similarity relation (unbounded chaining; can merge repeats within one fragment)',
};

// Zone-offset advisory. A fragment whose zone was declared wrongly (or left
// at the default) shifts every instant it holds, so its overlap with another
// fragment fails to deduplicate and the shift shows up as one recurring time
// difference between observations that otherwise agree. Real zone offsets are
// multiples of 15 minutes, which is what the rule looks for; every other
// offset can only collect chance agreement, so the best of those is the bar a
// candidate must clear. Support is a one-to-one match count (a multiset
// intersection), so k repeats on each side count k, not k squared, and the
// distinct-key floor keeps one repeated "ok" from carrying an advisory alone.
// 26 hours is the widest gap between two real offsets (+14:00 and -12:00).
// Report-only: it names the suspected offsets and never changes U.
const ZONE_ADVISORY = {
  stepMinutes: 15,
  maxOffsetHours: 26,
  minSupport: 3,
  minDistinctKeys: 3,
  maxExamples: 3,
  rule: 'for each pair of fragments (in sha256 order), with key = (sender, canonical body, attachment stem), ' +
    'support S(d) = sum over keys k and instants t of min(count_first(k, t), count_second(k, t + d)), the size of ' +
    'the multiset intersection of the two fragments\' (key, instant) observations at shift d, where d = ' +
    't_utc(second) - t_utc(first) and |d| <= maxOffsetHours; candidate offsets are the nonzero d that are ' +
    'multiples of stepMinutes, control offsets the nonzero d that are not; report every candidate d with ' +
    'S(d) >= minSupport, S(d) > S(0), S(d) > the largest control support, and support from at least ' +
    'minDistinctKeys distinct keys, ordered by support (ties: smaller |d|, then negative first). ' +
    'Report-only: U is not changed',
};

const DEFAULT_PARAMS = {
  dtGranularityMs: 0,
  dtConflictMs: 60000,
  clustering: 'one-to-one',
  similarity: SIMILARITY,
  fieldPrecedence: 'single representative: the first member under orderTieBreak',
  orderTieBreak: ORDER_TIE_BREAK,
  zoneAdvisory: ZONE_ADVISORY,
};

// Attachment congruence, the ~= of Equation (10). Two attachments are congruent
// when both are absent, or both name the same file. The FORM they were written
// in (standard, trailing-period, doubled filename) is an export quirk, not a
// property of the message, so it does not block a match -- but a disagreement
// about it is reported as a conflict rather than silently dropped.
//
// A trailing-period rendering has lost its extension, so the only thing it can
// be compared on is the stem Normalization derived. Full names are never
// compared on stems: report.pdf and report.docx are two files.
const ATTACHMENT_CONGRUENCE =
  'both absent; or same filename; or same stem when either is a trailing-period rendering';
function attachmentsCongruent(a, b) {
  if (!a && !b) return true;
  if (!a || !b) return false;
  if (a.ref === b.ref) return true;
  return (a.form === 'trailing-period' || b.form === 'trailing-period') && a.stem === b.stem;
}

// Equation (10). Note it does NOT constrain type or attachment form; those are
// exactly the fields a cluster can disagree on, which is what line 9 reports.
function similar(x, y, dtMs) {
  return Math.abs(x.tUtc - y.tUtc) <= dtMs
    && x.sender === y.sender
    && x.body === y.body
    && attachmentsCongruent(x.attachment, y.attachment);
}

// Total order on observations: t_utc, then the fragment's sha256, then source
// sequence index. Without the tie-breaks two runs could disagree on records
// sharing a timestamp, and Invariant 3 would be unattainable.
//
// The fragment is identified by its CONTENT hash, not its file name, so
// renaming a fragment cannot change which observation represents a cluster.
// source_id is consulted only between byte-identical fragments, whose
// observations agree on every canonical field anyway. Plain code-unit
// comparison, not localeCompare, so the order does not depend on the locale.
const cmp = (a, b) => (a < b ? -1 : a > b ? 1 : 0);
function compareRecords(x, y) {
  return x.tUtc - y.tUtc
    || cmp(x.provenance.sha256, y.provenance.sha256)
    || x.sourceSeq - y.sourceSeq
    || cmp(x.provenance.source_id, y.provenance.source_id);
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

// Single linkage: union every pair within dt that is similar.
function connectedComponents(sorted, dtMs) {
  const parent = sorted.map((_, i) => i);
  const find = (i) => { while (parent[i] !== i) i = parent[i] = parent[parent[i]]; return i; };
  for (let i = 0; i < sorted.length; i++) {
    for (let j = i - 1; j >= 0 && sorted[i].tUtc - sorted[j].tUtc <= dtMs; j--) {
      if (similar(sorted[i], sorted[j], dtMs)) parent[find(i)] = find(j);
    }
  }
  const groups = new Map();
  sorted.forEach((r, i) => {
    const root = find(i);
    if (!groups.has(root)) groups.set(root, []);
    groups.get(root).push(r);
  });
  return [...groups.values()];
}

// One-to-one: split each complete-linkage run so that every cluster holds at
// most one observation per fragment, pairing them k-th with k-th in source
// order. Returns the clusters, plus the runs whose fragments disagree on how
// many times the run occurs.
function oneToOne(sorted, dtMs) {
  const clusters = [];
  const ambiguousRuns = [];
  for (const run of groupIntoReconciliationClusters(sorted, dtMs)) {
    const byFragment = new Map();
    for (const r of run) {
      const id = r.provenance.source_id;
      if (!byFragment.has(id)) byFragment.set(id, []);
      byFragment.get(id).push(r);
    }
    const lists = [...byFragment.values()];
    for (const l of lists) l.sort((x, y) => x.sourceSeq - y.sourceSeq);
    const counts = lists.map((l) => l.length);
    const split = [];
    for (let k = 0; k < Math.max(...counts); k++) split.push(lists.filter((l) => l.length > k).map((l) => l[k]));
    clusters.push(...split);
    if (lists.length > 1 && new Set(counts).size > 1) ambiguousRuns.push({ run, clusters: split });
  }
  return { clusters, ambiguousRuns };
}

const CLUSTER = {
  'one-to-one': oneToOne,
  complete: (s, dt) => ({ clusters: groupIntoReconciliationClusters(s, dt), ambiguousRuns: [] }),
  single: (s, dt) => ({ clusters: connectedComponents(s, dt), ambiguousRuns: [] }),
};

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
  // Values sorted, so the report does not depend on member order.
  const types = new Set(cluster.map((r) => r.type));
  if (types.size > 1) disagreements.push({ field: 'type', values: [...types].sort() });
  const forms = new Set(cluster.map((r) => (r.attachment ? r.attachment.form : null)));
  if (forms.size > 1) disagreements.push({ field: 'attachment.form', values: [...forms].sort() });
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

// S(d) of ZONE_ADVISORY.rule for one ordered pair of record lists: d -> {n,
// keys, examples}. keys (distinct keys) and examples are kept for candidate
// offsets only; control offsets need just n.
function zoneOffsetSupport(first, second, p) {
  const step = p.stepMinutes * 60000;
  const max = p.maxOffsetHours * 3600000;
  const key = (r) => `${r.sender}\u0000${r.body}\u0000${r.attachment ? r.attachment.stem : ''}`;
  // key -> instant -> records, in source order.
  const group = (records) => {
    const g = new Map();
    for (const r of records) {
      const k = key(r);
      if (!g.has(k)) g.set(k, new Map());
      const byT = g.get(k);
      if (!byT.has(r.tUtc)) byT.set(r.tUtc, []);
      byT.get(r.tUtc).push(r);
    }
    return g;
  };
  const a = group(first);
  const b = group(second);
  const support = new Map();
  for (const [k, aByT] of a) {
    const bByT = b.get(k);
    if (!bByT) continue;
    const times = [...bByT.keys()].sort((x, y) => x - y);
    for (const [ta, xs] of aByT) {
      let lo = 0;
      let hi = times.length;
      while (lo < hi) { const mid = (lo + hi) >> 1; if (times[mid] < ta - max) lo = mid + 1; else hi = mid; }
      for (let j = lo; j < times.length && times[j] <= ta + max; j++) {
        const ys = bByT.get(times[j]);
        const d = times[j] - ta;
        if (!support.has(d)) support.set(d, { n: 0, keys: new Set(), examples: [] });
        const s = support.get(d);
        s.n += Math.min(xs.length, ys.length);
        if (d % step !== 0) continue;
        s.keys.add(k);
        if (s.examples.length < p.maxExamples) {
          s.examples.push([xs[0], ys[0]].map((r) => ({ source_id: r.provenance.source_id, line_range: r.provenance.line_range })));
        }
      }
    }
  }
  return support;
}

// The zone-offset advisory (ZONE_ADVISORY.rule). Reads the fragments, writes
// nothing back: its output goes to Omega only.
function zoneOffsetAdvisories(byHash, p) {
  const step = p.stepMinutes * 60000;
  const hhmm = (ms) => {
    const m = Math.abs(ms) / 60000;
    return `${ms < 0 ? '-' : '+'}${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
  };
  const out = [];
  for (let i = 0; i < byHash.length; i++) {
    for (let j = i + 1; j < byHash.length; j++) {
      const support = zoneOffsetSupport(byHash[i].records, byHash[j].records, p);
      const atZero = support.has(0) ? support.get(0).n : 0;
      let control = 0;
      for (const [d, s] of support) if (d % step !== 0) control = Math.max(control, s.n);
      const passing = [...support]
        .filter(([d, s]) => d !== 0 && d % step === 0 && s.n >= p.minSupport && s.n > atZero && s.n > control
          && s.keys.size >= p.minDistinctKeys)
        .sort(([d1, s1], [d2, s2]) => s2.n - s1.n || Math.abs(d1) - Math.abs(d2) || d1 - d2);
      for (const [d, s] of passing) {
        out.push({
          kind: 'zone_offset_suspected',
          fragments: [byHash[i].sourceId, byHash[j].sourceId],
          offset: hhmm(d),
          support: s.n,
          supportAtZero: atZero,
          maxControlSupport: control,
          distinctKeys: s.keys.size,
          examples: s.examples,
        });
      }
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
  params.zoneAdvisory = Object.assign({}, ZONE_ADVISORY, (paramOverrides || {}).zoneAdvisory);
  if (params.dtGranularityMs > params.dtConflictMs) {
    throw new Error(
      `dtGranularityMs (${params.dtGranularityMs}) must not exceed dtConflictMs ` +
        `(${params.dtConflictMs}); otherwise one pair of records could be both ` +
        'a single message and two conflicting ones'
    );
  }
  if (!CLUSTER[params.clustering]) {
    throw new Error(`unknown clustering "${params.clustering}" (one of: ${Object.keys(CLUSTER).join(', ')})`);
  }
  params.clusteringProcedure = CLUSTERING[params.clustering];
  params.attachmentCongruence = ATTACHMENT_CONGRUENCE;
  // A fragment is identified by source_id in provenance, in the one-per-
  // fragment rule and in Invariant 1. Two fragments under one name (the same
  // basename from two directories) would make all three ambiguous.
  const ids = fragments.map((f) => f.sourceId);
  const dup = ids.find((id, i) => ids.indexOf(id) !== i);
  if (dup !== undefined) throw new Error(`two fragments share the source_id "${dup}"; give them distinct ids (the CLIs take --source-id)`);

  // Line 2: the first point in the pipeline at which fragments meet.
  const all = [];
  for (const f of fragments) for (const r of f.records) all.push(r);

  // Line 3.
  const sorted = all.slice().sort(compareRecords);

  // Line 4. Members, and clusters by their first member, are put in the
  // total order, so U and every provenance list are canonical.
  const { clusters, ambiguousRuns } = CLUSTER[params.clustering](sorted, params.dtGranularityMs);
  for (const c of clusters) c.sort(compareRecords);
  clusters.sort((a, b) => compareRecords(a[0], b[0]));

  // Lines 5-13.
  const unified = [];
  const conflicts = [];
  const provenanceMap = {};
  const idOf = new Map();
  clusters.forEach((cluster, idx) => {
    const u = synthesizeCanonicalMessage(cluster);
    u.id = `u${String(idx + 1).padStart(6, '0')}`;
    u.provenance = cluster.map((r) => r.provenance);
    provenanceMap[u.id] = u.provenance;
    idOf.set(cluster, u.id);
    const disagreements = hasUnresolvedConflict(cluster);
    if (disagreements) conflicts.push(createConflictDescriptor(cluster, disagreements));
    unified.push(u);
  });

  // Runs the fragments disagree about: one fragment saw the message more often
  // than another, so which observations are the same message is a choice.
  const dedupAmbiguities = ambiguousRuns.map(({ run, clusters: split }) => {
    const counts = {};
    for (const r of run) counts[r.provenance.source_id] = (counts[r.provenance.source_id] || 0) + 1;
    return {
      kind: 'dedup_ambiguity',
      tUtc: run[0].tUtc,
      sender: run[0].sender,
      countsByFragment: counts,
      resolvedAs: 'k-th with k-th in source order',
      records: split.map((c) => idOf.get(c)),
      observations: run.slice().sort(compareRecords)
        .map((r) => ({ source_id: r.provenance.source_id, line_range: r.provenance.line_range })),
    };
  });

  // Line 14.
  conflicts.push(...detectCrossClusterConflicts(unified, params));

  // Line 15. Fragments are taken in content-hash order, not argument order,
  // so Omega does not depend on the order the fragments were supplied in.
  const byHash = fragments.slice().sort((a, b) => cmp(a.sha256, b.sha256) || cmp(a.sourceId, b.sourceId));
  const quarantine = [];
  for (const f of byHash) for (const q of f.quarantine) quarantine.push(q);

  const advisories = zoneOffsetAdvisories(byHash, params.zoneAdvisory);

  const dating = { direct: 0, inferred: 0, mixed: 0 };
  for (const u of unified) dating[u.dating]++;

  const omega = {
    spec: SPEC,
    implementation: {
      name: pkg.name,
      version: pkg.version,
      runtime: { node: process.version, icu: process.versions.icu, tz: process.versions.tz },
    },
    fragments: byHash.map(describeFragment),
    normalization: normalizationPolicy(fragments),
    params,
    provenance_tuple: PROVENANCE_TUPLE,
    provenance_map: provenanceMap,
    quarantine,
    conflicts,
    dedup_ambiguities: dedupAmbiguities,
    advisories,
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
      dedupAmbiguities: dedupAmbiguities.length,
      advisories: advisories.length,
      // Ambiguity that outside evidence resolved, versus ambiguity still
      // standing. Section 3.5 asks Omega to report both.
      datingOfUnifiedRecords: dating,
    },
  };

  checkInvariants(fragments, unified, omega);
  return { unified, omega, params };
}

// Omega's account of one fragment: what it is (by content), the zone its
// clock was read in, what Normalization rewrote, and what inference did.
function describeFragment(f) {
  const applied = { 'attachment-marker': 0, 'double-filename': 0, 'trailing-period': 0 };
  for (const r of f.records) {
    if (!r.attachment) continue;
    applied['attachment-marker']++;
    if (r.attachment.form in applied) applied[r.attachment.form]++;
  }
  return {
    id: f.sourceId,
    idSource: f.idSource || null,
    sha256: f.sha256,
    zone: f.zone || null,
    normalized: f.records.length,
    quarantined: f.quarantine.length,
    canonicalisationsApplied: applied,
    inference: f.inference || null, // null: the inference step was not run
  };
}

// The normalization policy, stated once. Every fragment must have been
// normalized under the same one (zones aside, which are per fragment and
// reported per fragment); otherwise a single statement would misreport.
function normalizationPolicy(fragments) {
  const shared = (p) => JSON.stringify([p.yearWindowPivot, p.typeTaxonomy, p.reasonPrecedence]);
  const policies = fragments.map((f) => f.policy || DEFAULT_POLICY);
  if (new Set(policies.map(shared)).size > 1) {
    throw new Error('fragments were normalized under different policies; Omega cannot state one');
  }
  const p = policies[0] || DEFAULT_POLICY;
  return {
    yearWindowPivot: p.yearWindowPivot,
    yearWindow: `two-digit years below ${p.yearWindowPivot} are 20xx, the rest 19xx`,
    typeTaxonomy: p.typeTaxonomy,
    reasonCodes: p.reasonPrecedence.map((code) => ({ code, meaning: REASON_MEANING[code] })),
    reasonPrecedence: 'a record failing several checks carries the first failing code in reasonCodes order; the others are kept in alsoFailed',
    canonicalisations: CANONICALISATIONS,
    zones: 'each fragment\'s clock is read in its declared zone (fixed offset, or IANA name resolved per instant via Intl); undeclared means +00:00, reported as source "default"',
  };
}

// Invariants 1 and 2, checked on every run rather than asserted in prose.
// Invariant 3 (determinism) is a property of two runs and lives in the tests.
function checkInvariants(fragments, unified, omega) {
  // Invariant 2: every record in U carries at least one provenance entry, and
  // every entry -- in U and in Q -- references a fragment this run ingested,
  // by source_id AND sha256. A matching name alone is not enough: an entry
  // citing another version of a file with that name would point at bytes the
  // run never saw.
  const shaOf = new Map(fragments.map((f) => [f.sourceId, f.sha256]));
  const cited = (p, who) => {
    if (!p.sha256 || shaOf.get(p.source_id) !== p.sha256) {
      throw new Error(`Invariant 2 violated: ${who} cites ${p.source_id} @ ${p.sha256}, not an ingested fragment`);
    }
  };
  for (const u of unified) {
    if (!Array.isArray(u.provenance) || u.provenance.length < 1) {
      throw new Error(`Invariant 2 violated: ${u.id} carries no provenance`);
    }
    for (const p of u.provenance) cited(p, u.id);
  }
  for (const q of omega.quarantine) cited(q.provenance, 'a quarantined record');

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
  zoneOffsetSupport,
  DEFAULT_PARAMS,
  CLUSTERING,
};
