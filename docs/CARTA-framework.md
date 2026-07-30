# CARTA Framework — Formal Definition

## 1. Temporal Communication Fragmentation (TCF)

### 1.1 Definition

**Temporal Communication Fragmentation (TCF):** a state in which a user's 
communication history for a single logical account becomes partitioned across 
two or more device-bound application instances, arising from (1) primary-device 
unavailability, (2) continued account use on a secondary device during that 
window, and (3) primary-device recovery followed by a backup-write event that — 
due to the platform's single-slot, last-write-wins backup semantics — silently 
and irreversibly supersedes the secondary archive, with no user-facing warning 
and no native reconciliation path.

### 1.2 Necessary Conditions

TCF requires all three of the following to hold simultaneously:

1. **Bifurcation** — at failure time T_f, one authoritative timeline splits 
   into two independently-updating branches (primary paused, secondary active).

2. **Independent persistence** — both branches survive and accumulate new 
   history for some duration Δt with zero synchronization between them.

3. **Asymmetric reconciliation on merge** — when the primary device recovers, 
   the primary and secondary archives briefly coexist without conflict: the 
   primary's resumption does not, by itself, threaten the secondary's 
   independently-accumulated archive. Fragmentation crystallizes only at the 
   next backup-write event on the primary — because the platform's cloud 
   backup destination is a single, last-write-wins slot per account (not per 
   device), that write silently and irreversibly supersedes the secondary's 
   most recent cloud snapshot. No warning is surfaced, no diff is attempted, 
   and no indication is given that a competing archive existed. The 
   secondary's data survives only in whatever un-synced local form remains on 
   the secondary device itself.

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
by single-slot backup semantics with no reconciliation path.

## 3. The CARTA Framework

CARTA (Chat Archive Reconstruction & Temporal Access) is a reconstruction 
framework: a platform-agnostic specification for recovering a unified, 
trustworthy communication history from two or more fragmented archives 
produced by TCF.

### 3.1 NotationF → R → R' → (U, Ω)  Let **F = {F₁, F₂, ..., Fₙ}** be the raw fragment exports (n ≥ 2).

### 3.2 The Three Phases

| Phase | Function | Input | Output |
|---|---|---|---|
| **Ingestion** | I: F → R | Raw, heterogeneous platform exports (one per fragment) | Structured, provenance-tagged per-fragment records Rᵢ |
| **Normalization** | N: R → R' | Structured per-fragment records | Canonically-timestamped, schema-valid records R'ᵢ, with provenance carried forward, plus a quarantine set Qᵢ of records that failed validation |
| **Synthesis** | S: {R'₁, ..., R'ₙ} → (U, Ω) | All normalized fragment sets together | A unified, deduplicated, chronologically-ordered archive **U**, plus **Ω**, a structured reconstruction report |

**Ingestion** never attempts reconciliation across fragments — its only 
responsibility is faithfully parsing each fragment, preserving raw values 
for auditability, and tagging provenance.

**Normalization** converts each fragment into a shared canonical schema 
(UTC timestamps, resolved sender identity, a fixed message-type taxonomy). 
Anything that fails validation is never silently dropped — it moves into 
an explicit quarantine set.

**Synthesis** is reconstruction, not merge: ordering, deduplication, 
provenance preservation, and conflict detection across all normalized 
fragments together. A conflict is defined as two or more observations that 
cannot be deterministically reconciled under the reconstruction rules — 
this is broader than simple timestamp collisions, and includes cases such 
as contradictory sender attribution or impossible ordering.

### 3.3 Ω — The Reconstruction Report

Ω is not a mere conflict log. It carries forward everything that must 
never be silently discarded:

- **Provenance map** — every record's origin device, origin export, origin 
  backup date, and confidence
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
