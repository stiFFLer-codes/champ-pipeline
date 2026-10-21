# CARTA Framework — Formal Definition

> **Version note (added 2026-10-16).** This document describes **CARTA 1.0**
> and has not been rewritten. `champ-pipeline-core` 0.2.0 implements CARTA 1.1
> and states `spec: "CARTA 1.1"` in Ω. The changes from 1.0 to 1.1, taken from
> the commit messages:
>
> | Change in CARTA 1.1 | Commit |
> | --- | --- |
> | Provenance is `<source_id, line_range, sha256, record_sha256>`; `record_sha256` hashes the record's raw bytes (first byte of its first line through the terminator of its last line, excluding a leading BOM). | `6ca34eb` |
> | Each fragment's clock is read in its declared zone (fixed offset, or IANA name resolved per instant, so DST applies); the default `+00:00` is reported as defaulted. A skipped local time is `MALFORMED_TIMESTAMP`; a repeated one is the new `AMBIGUOUS_LOCAL_TIME`. | `c7b047f` |
> | Attachments are `{ref, form, stem}` and the trailing-period rendering is canonicalised; congruence compares stems only when a trailing-period rendering is involved. | `409639b` |
> | Inference rescues only records whose sole failure is `AMBIGUOUS_DATE_FORMAT`. | `c6ff9fe` |
> | Order tie-break: t_utc, then fragment sha256, then sourceSeq (no longer the file name). | `8440606` |
> | Default clustering is one-to-one: at most one observation per fragment per cluster, with differing per-fragment repeat counts reported as `dedup_ambiguity`. Complete linkage (1.0) and single linkage remain selectable. Two fragments sharing a source_id are refused. | `80136e6` |
> | Invariant 2 checks every provenance entry, in U and in Q, against the ingested fragments by source_id and sha256. | `73af6e8` |
> | Ω states the spec, the implementation and runtime, each fragment (id, sha256, zone, counts, canonicalisations, inference report), the normalization policy, every parameter and the meaning of the provenance tuple; quarantine is collected in sha256 order. | `d4eef99` |
> | A fragment's id can be declared (`--source-id`); Ω records `fragments[].idSource`. | `a53ce1e` |
> | Ω carries a report-only zone-offset advisory (`advisories`): first a modal pair count within ±14 h, then multiset-intersection support with control offsets, at least 3 distinct keys and a ±26 h window. | `92a0df7`, `4464da6` |
> | The TCF split is half-open (F1: t < t_f or t ≥ t_r; F2: t_f − δ ≤ t < t_r + ε), so δ = ε = 0 gives disjoint fragments. | `4974f1b` |

## 1. Temporal Communication Fragmentation (TCF)

### 1.1 Definition

**Temporal Communication Fragmentation (TCF):** a state in which a user's 
communication history for a single logical account becomes partitioned across 
two or more device-bound application instances, that persist independently, and for which the platform provides no operation
yielding their union. It arises from (1) primary-device unavailability, (2)
continued account use on a secondary device during that window, and (3)
primary-device recovery. Every platform path that brings the archives back
together — restore above all — substitutes one state for another rather than
merging them, with no user-facing warning that a competing archive exists
and no diff or reconciliation attempt. *(One plausible backend explanation is a 
single-slot, last-write-wins cloud backup architecture; this is an unverified 
hypothesis, not a claim of this document — see §1.2, condition 3.)*

### 1.2 Necessary Conditions

TCF requires all three of the following to hold simultaneously:

1. **Bifurcation** — at failure time T_f, one authoritative timeline splits 
   into two independently-updating branches (primary paused, secondary active).

2. **Independent persistence** — both branches survive and accumulate new 
   history for some duration Δt with zero synchronization between them.

3. **Asymmetric reconciliation** — no platform-native operation yields the
   union of the two archives. Every path that brings them back together
   substitutes one state for another: the platform's restore operation
   replaces the current chat state rather than merging into it, no warning
   is surfaced, no diff is attempted, and no indication is given that a
   competing archive existed. This is a property of the platform's
   reunification semantics, not an event that must occur; it holds from the
   moment the branches exist, whether or not a restore is ever performed.
   Conditions 1-3 are satisfied while both archives remain individually
   readable on their own devices and only the combined view is unavailable
   (the *latent* case). A restore makes the fragmentation *manifest*: the
   replaced archive then survives only in whatever un-synced local form
   remains on the device holding it. Manifest fragmentation is the severe
   case of TCF, not its definition, and CARTA takes the same input in either
   case. **[Unverified, not asserted 
   here]:** a plausible backend explanation is that the platform's cloud 
   backup destination is a single, last-write-wins slot per account, so the 
   next backup-write silently supersedes the secondary's most recent cloud 
   snapshot — no citation or controlled experiment currently backs this 
   specific architectural claim; only the observable reunification behavior above is part of this definition.

### 1.3 Distinction from Backup Staleness

TCF is distinct from backup staleness — the well-documented problem of 
infrequent snapshots causing data loss on device failure. In backup 
staleness, only one timeline exists; data from the unprotected window is 
simply absent. In TCF, two timelines exist simultaneously, each containing 
data absent from the other; the problem is not absence of data but 
platform-enforced inaccessibility of one archive.

## 2. Positioning TCF Against Neighboring Problems

| Neighboring problem | What looks similar | Why it is not TCF |
|---|---|---|
| Backup staleness | Data missing after device failure | Only one timeline ever existed; TCF has two, both intact, simultaneously |
| Sync conflict | Two divergent states from concurrent device use | Sync platforms attempt reconciliation, however imperfectly; TCF's platform never attempts it |
| Device migration | Multiple devices tied to one account | Migration is a planned, single continuous timeline moved between devices — no independent concurrent accumulation |
| Data loss / corruption | Data becomes unavailable to the user | Both fragments remain physically intact somewhere; it is a retrieval/reconciliation problem, not a destruction problem |
| Version-control merge conflict | Two divergent histories need unification | Git-style systems retain a common-ancestor commit, enabling three-way merge; consumer chat backups store no shared ancestry, so no automated merge is even structurally possible |
| Account recovery | Restoring access after reinstall or loss | Recovery typically yields a single unified timeline (the one server/backup copy that exists); TCF specifically requires two independently-valid timelines needing reconciliation |

**Closing thesis:** TCF's distinguishing signature is not the loss of data, 
but the platform-enforced inaccessibility of a fully-intact archive, caused 
by merge-free reunification semantics with no reconciliation path.

## 3. The CARTA Framework

CARTA (Chat Archive Reconstruction & Temporal Access) is a reconstruction 
framework: a platform-agnostic specification for recovering a unified, 
trustworthy communication history from two or more fragmented archives 
produced by TCF.

### 3.1 Notation

```
F → R → (R', Q) → (U, Ω)
```

Let **F = {F₁, F₂, ..., Fₙ}** be the raw fragment exports (n ≥ 2). *(TCF itself, as defined in §1, is inherently a two-way split — one primary device pauses, one secondary continues — so the founding case and Definition 1's formalization are both n=2. CARTA's algebra is deliberately specified more generally for n ≥ 2, since nothing about the reconstruction problem requires exactly two fragments; a user could plausibly accumulate more than two independently-persistent archives across repeated failures. This is a deliberate generalization, not an inconsistency — but it should be read as CARTA generalizing beyond TCF's minimal case, not as TCF itself being n-ary.)*

### 3.2 The Three Phases

| Phase | Function | Input | Output |
|---|---|---|---|
| **Ingestion** | I: F → R | Raw, heterogeneous platform exports (one per fragment) | Structured, provenance-tagged per-fragment records Rᵢ |
| **Normalization** | N: R → (R', Q) | Structured per-fragment records | Canonically-timestamped, schema-valid records R'ᵢ, with provenance carried forward, plus a quarantine set Qᵢ of records that failed validation |
| **Synthesis** | S: {R'₁, ..., R'ₙ} → (U, Ω) | All normalized fragment sets together | A unified, deduplicated, chronologically-ordered archive **U**, plus **Ω**, a structured reconstruction report |

**Ingestion** never attempts reconciliation across fragments — its only 
responsibility is faithfully parsing each fragment, preserving raw values 
for auditability, and tagging provenance.

**Normalization** is required to preserve every record's provenance from R through to R' or Q — this is an explicit guarantee of N, not an incidental side effect assumed by Synthesis. It converts each fragment into a shared canonical schema 
(UTC timestamps, resolved sender identity, a fixed message-type taxonomy). 
Anything that fails validation — or is syntactically valid but ambiguous, 
such as a date string valid under more than one locale convention with 
nothing in the record itself to disambiguate — is never silently dropped 
or silently resolved by guessing. Both cases move into an explicit 
quarantine set. Ambiguity is never silently converted into certainty.

**Synthesis** is reconstruction, not merge: ordering, deduplication, 
provenance preservation, and conflict detection across all normalized 
fragments together. A conflict is defined as two or more observations that 
cannot be deterministically reconciled under the reconstruction rules — 
this is broader than simple timestamp collisions, and includes cases such 
as contradictory sender attribution or impossible ordering.

### 3.3 Ω — The Reconstruction Report

Ω is not a mere conflict log. It carries forward everything that must 
never be silently discarded:

- **Provenance map** — every record in U mapped to the union of the provenance 
  tuples of the observations it was synthesised from, each tuple being the 
  `source_id`, `line_range` and `sha256` that Ingestion attaches. An 
  implementation may carry further metadata about a fragment (the device or 
  export it came from, the date it was made); that is a property of the 
  fragment, reachable through `source_id`, not an additional field of the tuple.

  *(Corrected 2026-08-28. This previously read "every record's origin device, 
  origin export, origin backup date, and confidence", which named four fields, 
  none of them the three the formal tuple actually defines — a flat 
  contradiction with §3.2 and with Algorithm 1. **No confidence score is 
  specified**, deliberately: a score compresses into one number exactly the 
  uncertainty that quarantine and the conflict log exist to keep explicit. 
  Same correction as the paper's §3.5.)*
- **Quarantine carryover** — every record from Qᵢ, retained rather than dropped
- **Conflict log** — every instance of irreconcilable observations, using 
  the definition above
- **Reconstruction statistics** — deduplication counts, resolved and 
  unresolved ambiguity counts

### 3.4 Design Principles

- **Deterministic** — identical fragment inputs always produce an 
  identical (U, Ω)
- **Auditable** — every record in U traces back to at least one source 
  fragment via provenance
- **Non-destructive** — original fragment files are never modified, only read

### 3.5 Invariants

1. No validated record is ever discarded — it appears in U or is 
   explicitly retained in Ω
2. Every record in U maps back to at least one fragment
3. No unresolved ambiguity is silently auto-resolved — it surfaces in Ω
4. Original fragments remain unchanged throughout

### 3.6 Closing Thesis

CARTA is a reconstruction framework whose Synthesis phase provides exactly 
the reconciliation capability that TCF's third condition shows commercial 
backup platforms lack natively — deterministically, auditably, and 
without touching the original data.
