# CHAMP-Pipeline — Project Plan & Research Direction

## 1. North Star

The ultimate goal of this project is:

> **Produce a credible research paper describing Temporal Communication Fragmentation (TCF), the CARTA framework, and CHAMP-Pipeline as a WhatsApp-specific reference implementation demonstrating the framework.**

The initial publication target is an **arXiv preprint**.

Do not optimize the project prematurely for journal formatting, conference requirements, JOSS, production deployment, or elaborate publication infrastructure.

Those may be considered later.

The immediate objective is to produce a technically rigorous and reproducible body of work that can support the paper.

### Core principle

> **The paper is the product. CHAMP-Pipeline's implementation is deferred future work (Phase II), not evidence for this paper.**

*(Revised 2026-08-24 — the original tagline implied CHAMP-Pipeline provides empirical evidence for this paper. The project has since locked a fast-path, specification-paper scope in which no implementation or evaluation is required or claimed. See §6, Phase II.)*

Every major engineering decision must therefore be evaluated against one question:

> Does this materially strengthen the research contribution, the specification's rigor, the literature positioning, or the paper itself?

If not, it should normally be deprioritized.

---

# 2. Research Contribution

The project has three tightly connected layers.

## 2.1 TCF — Temporal Communication Fragmentation

TCF is the research problem being formally defined.

It describes the situation in which a user's communication history becomes partitioned across independently persistent archives associated with the same logical account following device failure, secondary-device use, and asymmetric reconciliation behavior.

The formal definition and necessary conditions are documented in:

```text
docs/CARTA-framework.md
```

The three necessary conditions are:

1. Bifurcation
2. Independent Persistence
3. Asymmetric Reconciliation on Merge

TCF must remain clearly distinguished from related phenomena such as:

* backup staleness,
* synchronization conflict,
* device migration,
* data loss/corruption,
* version-control merge conflict,
* account recovery.

Do not broaden the definition casually.

---

# 3. CARTA — The Abstract Framework

CARTA stands for:

**Chat Archive Reconstruction & Temporal Access**

CARTA is the **abstract research framework**.

It is not the name of the software.

The framework defines a three-stage transformation:

```text
F → R → R' → (U, Ω)
```

where:

* `F` = raw archive fragments
* `R` = structured, provenance-tagged records
* `R'` = normalized, schema-valid records
* `U` = unified reconstructed archive
* `Ω` = structured reconstruction report

The three CARTA stages are:

```text
Ingestion
    ↓
Normalization
    ↓
Synthesis
```

CARTA is governed by three design principles:

1. Deterministic
2. Auditable
3. Non-Destructive

The framework also defines four invariants.

These concepts are documented in:

```text
docs/CARTA-framework.md
```

That document is the conceptual source of truth.

Do not silently alter the theoretical framework while implementing software.

If implementation reveals that the theory itself needs revision, stop and surface the issue for review rather than changing the theory implicitly.

---

# 4. CHAMP-Pipeline — The Implementation

CHAMP-Pipeline is the concrete software implementation of CARTA.

The current implementation target is WhatsApp chat exports.

Naming is locked:

```text
Repository:
champ-pipeline

Core package:
champ-pipeline-core

Viewer package:
champ-pipeline-viewer
```

Never introduce alternate project/package names without explicit approval.

The distinction is mandatory:

```text
CARTA = framework/theory
CHAMP-Pipeline = software/reference implementation
```

Do not use these terms interchangeably.

---

# 5. Research-to-Software Relationship

**Revised 2026-08-24 (fast-path decision).** The diagram below originally implied implementation and experiments must precede the paper. That ordering is superseded — see §6, Phase II. The current relationship is:

```text
Research Problem
      ↓
TCF Formalization
      ↓
CARTA Framework (Specification)
      ↓
Research Paper  ←── current end of this project's roadmap
      ↓
   [Phase II, deferred, separate project]
      ↓
CHAMP-Pipeline Implementation
      ↓
Controlled Experiments
      ↓
Evidence
      ↓
[Follow-up publication, if evidence warrants]
```

The specification exists to be independently implementable and defensible on its own; it does not require an implementation to demonstrate that. When Phase II does begin — separately, later — the same rules apply as before:

* Do not build features merely because they are technically interesting.
* Do not introduce ML unnecessarily.
* Do not introduce cloud infrastructure unnecessarily.
* Do not introduce databases unnecessarily.
* Do not build production-grade infrastructure unless the research requires it.
* Do not build a sophisticated UI before the core research pipeline works.
* Do not optimize prematurely.
* Prefer the simplest implementation that faithfully demonstrates the framework.

---

# 6. Master Project Phases

**Revised 2026-08-24 — fast-path decision locked.** The phase structure below replaces the original Phase 0–10 roadmap. Phases 3–8 of the original roadmap (Ingestion, Normalization, Synthesis, Validation, Experimental Evidence, Minimal Demonstration Layer) are not deleted — they are consolidated into **Phase II**, a deliberately deferred, separate future project, not a prerequisite for this paper. Full rationale: `docs/PAPER_BLUEPRINT.md §2.6`.

The project is organized around research deliverables rather than calendar deadlines.

## PHASE 0 — Research Foundation

### Objective

Establish and freeze the conceptual foundation.

### Completed work

* TCF formalization
* Three necessary conditions
* Distinction from related phenomena
* CARTA framework
* CARTA three-stage pipeline
* `F → R → R' → (U, Ω)` notation
* Design principles
* Invariants
* Reconstruction report concept

### Exit condition

The research problem and CARTA framework can be explained independently of the implementation.

### Current status

**DONE**

---

# PHASE 1 — Evidence & Illustrative Corpus

*(Renamed 2026-08-24 — under the fast-path decision this corpus is illustrative/supporting material only, not feeding an empirical evaluation. Not on the paper's critical path; cheap to finish, worth finishing.)*

### Objective

Create a trustworthy synthetic corpus illustrating the range of WhatsApp export edge cases CARTA's specification must account for.

### Components

```text
Fixture specification
        ↓
Deterministic synthetic generator
        ↓
Controlled edge cases
        ↓
Manifest
        ↓
Reproducible fixtures
```

The generator must remain deterministic for a given seed and configuration.

The synthetic corpus must contain deliberate coverage for relevant WhatsApp export edge cases, including where applicable:

* regional date formats
* 12-hour and 24-hour time formats
* multiline messages
* empty-body messages
* senderless system messages
* standard sender lines
* emoji
* rich-text markup
* standard attachments
* trailing-period attachment cases
* double-filename attachment cases
* self-chat encryption notices
* group encryption notices
* group creation
* membership events
* early-year/system-line cases
* other parser-relevant edge cases discovered during implementation

### Known current issues to resolve

~~1. `attachment-double-filename` appears in only one fixture...~~ **RESOLVED 2026-08-24** — see `STATE.md` Known Issues.
~~2. The self-chat encryption fixture has a mismatch...~~ **RESOLVED 2026-08-24** — see `STATE.md` Known Issues.

Both resolved; determinism re-verified via two regeneration runs producing byte-identical manifests. No known blocking issues remain in this phase.

### Exit condition

The synthetic corpus is:

* deterministic,
* internally consistent,
* deliberately specified,
* sufficiently diverse for the parser,
* documented through the manifest,
* reproducible from a clean checkout.

### Current status

**DONE** (2026-08-24) — both known bugs resolved, determinism re-verified.

---

# PHASE 2 — CARTA Specification Lock

*(Renamed 2026-08-24, merged with the mathematical-consistency review. Four issues found and resolved 2026-08-24: F₁/F₂ overlap vs. Table 1's disjointness claim, dedup relation reframed as similarity clustering rather than a false equivalence-relation claim, idempotence softened to a specification-level target, ambiguous-but-parseable Normalization records routed to quarantine. See `docs/PAPER_BLUEPRINT.md §2.2–2.4`, `docs/CARTA-framework.md §3.2`. The cross-doc consistency pass (also 2026-08-24) found and fixed three more: `docs/CARTA-framework.md §3.1/§3.2` omitted Q from the F→R→(R',Q)→(U,Ω) notation and the Normalization function signature; Normalization's provenance-preservation guarantee was implicit, not stated; and TCF's inherently-binary framing vs. CARTA's n≥2 algebra was unreconciled — all three now fixed with an explanatory note. This phase is closed.)*

### Objective

Define the machine-readable contracts for:

```text
F
R
R'
Q
U
Ω
```

before implementing the full parser/core pipeline.

This phase is strategically important.

The implementation must not accidentally define the research architecture.

The schemas should explicitly represent:

* provenance,
* timestamps,
* sender identity,
* message/body information,
* message classification,
* attachments,
* system events,
* validation state,
* ambiguity where applicable.

`Q` represents quarantined records that cannot safely be normalized.

`Ω` represents the auditable reconstruction report.

The exact schemas must be agreed upon before downstream implementation proceeds.

### Exit condition

Another engineer can implement the pipeline using the defined contracts without inventing the core data model.

### Current status

**DONE** (2026-08-24) — cross-doc consistency pass complete.

---

# PHASE L — Literature Survey Completion

*(New phase, added 2026-08-24 — was implicit before but never formally tracked.)*

### Objective

Establish CARTA's actual novelty/delta against prior art, with real citations — not comfortable assumptions.

### Kill-shot questions

1. Has this exact phenomenon already been formally named? (broad name search) — not yet run.
2. Does digital forensics already provide essentially the same reconstruction framework? — **done.** Confirmed as the closest neighbor; real citation (DFRWS 2025 SoK, arXiv:2504.18131) identifies unified multi-source reconciliation as an open challenge, not a solved methodology.
3. Do CRDT/distributed-systems/replica-reconciliation approaches already solve the same problem under a different abstraction? — **preliminary pass done** (Kaki et al., OOPSLA'19/PLDI'22 — requires a tracked common ancestor, doesn't cover ancestryless flat exports); needs a second, deeper verification pass.
4. Has WhatsApp backup/export reconstruction already been demonstrated in forensic or archival literature specifically? — not yet run.

Findings tracked in `docs/PAPER_BLUEPRINT.md §2.5`, updated in place as the survey progresses.

### Exit condition

A submission-grade Related Work section, and a delta sentence that has survived contact with all four kill-shots — or been honestly narrowed or withdrawn if it didn't.

### Current status

**IN PROGRESS** (1 of 4 fully resolved — forensics; 1 preliminary, needs a second pass — CRDT; 2 not yet started — exact-name search, WhatsApp-specific)

---

# PHASE W — Paper Writing

*(Replaces the original Phase 9 — renamed 2026-08-24 to avoid confusion with the old numbered scheme.)*

### Objective

Write the position/specification paper: TCF formalization, CARTA specification, formal data contracts, literature positioning, and an explicit, honest statement of implementation status.

### Exit condition

The manuscript satisfies the paper-ready stop condition defined in `docs/PAPER_BLUEPRINT.md §2.6`: TCF formally and defensibly characterized; CARTA internally consistent and independently implementable; the novelty position survives the literature kill-shots; all mathematical claims internally valid; every empirical/capability statement is either cited or explicitly labeled proposed/future work.

### Current status

**DRAFT COMPLETE (2026-08-25).** All nine outline sections written to `docs/DRAFT_PAPER.md` (7,893 words), each verified in an independent review pass against the locked spec and survey — not self-reported. A References section (30 entries) was assembled and independently verified the same day; the bibliography is now real BibTeX in `paper/main.bib`, not placeholders. `[CITE-T2]` is **resolved** (2026-08-25) — narrowed to what the archived source supports, per the architect's decision; see Phase R below. The Section 8.2 contingency on the two unread Chabot-lineage documents is **decided, not open** — the architect chose to accept it as a stated limitation rather than chase further reads. Tracked in `docs/DRAFT_PAPER.md`'s "Drafting notes" block.

---

# PHASE R — Repo Hygiene & Submission Prep

*(New phase, added 2026-08-24.)*

### Objective

Fill `CITATION.cff` (author, version, date — currently placeholder-empty), reconcile any remaining doc inconsistencies, confirm no real chat data or stray artifacts are present, and ensure reproducibility instructions match what the paper actually claims — the fixture generator, and nothing else. Also now covers: converting `docs/DRAFT_PAPER.md` into real LaTeX (`paper/`) and confirming it compiles clean.

### Current status

**DONE (2026-08-25).** `paper/main.tex` + `paper/sections/*.tex` + `paper/main.bib` (31 entries) built and independently verified across four passes: compiles clean (Tectonic — 19pp, 0 overfull/underfull boxes, **0 LaTeX/BibTeX warnings**, the only remaining log line being a pre-existing third-party `algorithm.sty` UTF-8 notice), abstract written and grounded in the finished sections, both planned figures (TCF timeline, CARTA pipeline) drawn as self-contained TikZ, author/ORCID filled in both `CITATION.cff` and `main.tex` (Maitreya Sapariya, Independent Researcher, ORCID 0009-0003-9346-3775), `[CITE-T2]` resolved (Section 1's claim narrowed to what the archived source actually supports — the "cannot be merged" framing became the paper's own observation with a pointer to §8.3's tooling survey, not an unsupported attribution to WhatsApp), bibliography orphan-clean (31 defined = 31 cited = 31 rendered), locked corrections and British spelling intact, read-only sources confirmed untouched by file mtimes throughout, no commits made. T1 (terminology collision) was found already resolved in `docs/DRAFT_PAPER.md` §2.5 (three named collisions distinguished, ported to `paper/sections/02_tcf.tex`). T3 (patent claims) closed as moot — the claim it would have policed was already dropped, and the patent isn't cited anywhere in the paper. `paper/main.bbl` is gitignored with build artifacts but must be generated and included manually at submission time since arXiv does not reliably run bibtex — noted in `.gitignore` itself.

---

# PHASE S — arXiv Submission

*(Replaces the original Phase 10 — renamed 2026-08-24. Zenodo DOI, ORCID, and JOSS remain explicitly out of scope per §12.)*

### Objective

Publish the completed, reviewed paper as an arXiv preprint.

### Exit condition

The paper is submitted/published as an arXiv preprint.

### Current status

**NOT STARTED** — this is the current finish line for this project.

---

# PHASE II — CHAMP-Pipeline Implementation & Empirical Evaluation

**DEFERRED — a separate future project, not part of this roadmap.**

*(Consolidates what were originally Phases 3–8, added 2026-08-24 as part of the fast-path decision. Content preserved below for when this phase is deliberately opened — nothing here is scheduled or required for the current paper.)*

Consolidates: Ingestion (`F → R`, provenance-preserving, handling date/time formats, sender detection, multiline/empty-body messages, attachments, encryption notices, group events, Unicode/emoji, malformed lines); Normalization (`R → R' + Q`, with the ambiguous-record quarantine rule locked in Phase 2); Synthesis (`R' → U, Ω`, chronological reconstruction, dedup via the reconciliation-cluster procedure locked in Phase 2, conflict detection, non-destructive behavior); Validation (correctness, determinism, invariant preservation, edge-case coverage, regression, golden/reference outputs); Experimental Evidence (real numbers from real runs only — no manufactured statistical claims, honest framing as controlled proof-of-concept evidence if that's what it is); and a Minimal Demonstration Layer (a simple viewer, supporting infrastructure, not the research contribution, no significant time on visual polish).

### Exit condition (when this phase is eventually opened)

Multiple fragmented synthetic archives can be reconstructed deterministically into `U` with an accompanying auditable `Ω`, validated against the CARTA invariants, with a reproducible automated test/validation suite, and a researcher/reviewer can run the project end-to-end.

### Current status

**NOT SCHEDULED.** Begins only after Phase S, and only as a deliberate, separately-planned decision — potential title: *"CHAMP: A Reference Implementation and Evaluation of CARTA for Fragmented WhatsApp Archives."* Do not begin any of this work under the current roadmap without an explicit, separate decision to open Phase II.

---

*(The original Phase 9 — Paper and Phase 10 — arXiv Preprint sections were removed 2026-08-24: superseded by Phase W and Phase S above, which replace Phase 9's research-argument diagram — it still routed "CHAMP implementation → Experimental methodology → Results" through the paper, the exact ordering the fast-path decision superseded — and its contribution list, which named "CHAMP-Pipeline as a WhatsApp-specific reference implementation" and "reproducible controlled evaluation methodology" as paper contributions. Neither is claimed by this paper; both remain Phase II.)*

---

# 7. Current Position

**Revised 2026-08-24.**

```text
PHASE 0 — Research Foundation
DONE

PHASE 1 — Evidence & Illustrative Corpus
DONE (both known bugs resolved 2026-08-24)

PHASE 2 — CARTA Specification Lock
DONE (4 math issues + 3 cross-doc consistency issues resolved 2026-08-24)

PHASE L — Literature Survey Completion
DONE (2026-08-25) — six kill-shot questions answered; delta survived but narrowed; see STATE.md Major Decision Log

PHASE W — Paper Writing
DRAFT COMPLETE (all 9 sections, 7,893 words — see docs/DRAFT_PAPER.md)

PHASE R — Repo Hygiene & Submission Prep
DONE (2026-08-25) — paper/ builds clean, 0 warnings; abstract, figures, author/ORCID, and [CITE-T2] all resolved; see full detail above

PHASE S — arXiv Submission
NOT STARTED — current finish line

PHASE II — CHAMP-Pipeline Implementation & Empirical Evaluation
DEFERRED — separate future project, out of scope for this roadmap
```

The immediate milestone is therefore:

> **Begin Phase S: one full read-through of the assembled `paper/main.pdf` (not per-section — the whole thing, cold), settle the arXiv category (cs.DL / cs.SE / cs.DC — architect's call, to be decided together), generate `main.bbl` fresh at submission time for upload alongside the source, and submit.**

---

# 8. Project Control Rules

These rules apply to all future implementation work.

## Rule 1 — Paper-first

The paper is the final goal.

Software exists to support the paper.

## Rule 2 — One milestone at a time

Do not implement multiple major phases in one task.

A task must have:

* a clear objective,
* a defined scope,
* an exit condition.

## Rule 3 — Do not invent architecture

If a design decision affects CARTA, TCF, the canonical data model, or research methodology, stop and surface it for review.

Do not silently decide it during implementation.

## Rule 4 — Prefer simple solutions

Do not introduce complexity without a research or engineering justification.

Avoid unnecessary:

* ML
* cloud services
* databases
* frameworks
* abstractions
* distributed systems
* deployment infrastructure

unless explicitly justified.

## Rule 5 — Synthetic data only

No real personal WhatsApp data may enter:

* the repository
* fixtures
* tests
* examples
* documentation
* generated artifacts
* commits
* Git history

Real local WhatsApp data must remain outside the project artifact.

## Rule 6 — CARTA and CHAMP must remain distinct

Never use them interchangeably.

## Rule 7 — Preserve auditability

The implementation must preserve provenance and surface ambiguity rather than silently destroying information.

## Rule 8 — Reproducibility matters

The same inputs and configuration should produce deterministic results wherever the framework requires determinism.

## Rule 9 — Verify before trusting

Do not treat an agent's natural-language summary as sufficient evidence.

Implementation claims should be verified through:

* source inspection,
* terminal output,
* tests,
* Git state,
* and where appropriate GitHub state.

## Rule 10 — No silent scope expansion

If an implementation task reveals an interesting additional feature, do not automatically implement it.

Classify it as:

```text
Required
Valuable
Optional
Scope creep
```

and continue only if it is genuinely justified.

---

# 9. Agent Working Protocol

The AI implementation agent is an executor, not the project architect.

For each assigned task:

1. Read this `PROJECT_PLAN.md`.
2. Identify the current phase.
3. Read the relevant project documentation.
4. Inspect the existing implementation before changing it.
5. Implement only the explicitly assigned milestone.
6. Run appropriate verification.
7. Report:

   * what changed,
   * what was verified,
   * exact test/command results,
   * assumptions,
   * deviations,
   * unresolved issues.
8. Stop.

Do not continue into the next phase without explicit instruction.

---

# 10. Research Architect / Reviewer Protocol

Project-level architecture and research direction are reviewed externally from the implementation agent.

The project should use the following loop:

```text
Project Plan
    ↓
Milestone definition
    ↓
Implementation prompt
    ↓
Agent execution
    ↓
Raw verification
    ↓
Review
    ↓
Approval / correction
    ↓
Next milestone
```

The agent must not infer permission to proceed to the next milestone.

---

## Git Checkpoints and Repository Verification

### Purpose

GitHub checkpoints are deliberate research milestones, not routine backups.

Local implementation work may involve multiple edits and verification passes, but the repository should only be committed and pushed after a stable milestone has been reviewed and explicitly approved.

### Checkpoint flow

Use this model:

```text
Agent implementation
        ↓
Local verification
        ↓
Review / approval
        ↓
Checkpoint approved
        ↓
Commit + push
        ↓
Independent GitHub verification
        ↓
STATE.md updated
        ↓
Next milestone
```

### Rules

1. Do not commit or push unless explicitly instructed.
2. Do not push after every small implementation pass.
3. Push only at stable research milestones.
4. Before a push:

   * implementation must be locally verified,
   * relevant tests must pass,
   * known deviations must be reviewed,
   * unintended files must be checked,
   * privacy constraints must be verified.
5. After a push, the repository state must be independently checked against GitHub.
6. A successful agent report saying "pushed" is not sufficient evidence by itself.
7. The GitHub state becomes the external verification point for the completed checkpoint.
8. If GitHub differs from the agent's report, stop and resolve the discrepancy before continuing.

### Planned checkpoints

Document these checkpoint boundaries:

```text
[Revised 2026-08-24 — checkpoints 3-8 below replaced; they were built around
implementation phases now deferred to Phase II. See docs/PAPER_BLUEPRINT.md §2.6.]

Checkpoint 1 — Evidence/Illustrative Corpus Locked
After Phase 1 is fully verified:
- fixture specification fixed,
- generator deterministic,
- manifest consistent,
- required edge-case coverage accepted.

Checkpoint 2 — CARTA Specification Locked
After F, R, R', Q, U, and Ω contracts, invariants, and algorithms are reviewed,
internally consistent, and finalized across both docs/CARTA-framework.md and
docs/PAPER_BLUEPRINT.md.

Checkpoint 3 — Literature Survey Complete
After all four kill-shot questions are answered with real citations and the
delta sentence has survived contact with them (or been honestly narrowed).

Checkpoint 4 — Paper Draft Complete
After the manuscript satisfies the paper-ready stop condition
(docs/PAPER_BLUEPRINT.md §2.6) and every claim traces to formal derivation,
citation, or an explicitly labeled proposed/future-work statement.

Checkpoint 5 — Paper-Ready Repository
After documentation, README, citation metadata, and reproducibility
instructions are aligned with what the paper actually claims — the fixture
generator, and nothing else.

Checkpoint 6 — arXiv Submitted
Current finish line for this project.

Phase II Kickoff (separate future milestone, not part of this checkpoint
sequence) — only after Checkpoint 6, and only as an explicit, separately
planned decision to begin CHAMP-Pipeline implementation.
```

Checkpointing should follow research significance rather than arbitrary software milestones.

### GitHub verification

State that after every checkpoint push, the project reviewer should independently inspect GitHub and verify, as appropriate:

* pushed commit SHA,
* branch,
* changed files,
* file contents,
* commit history,
* repository status,
* absence of unintended files,
* agreement between claimed and actual implementation state.

The purpose is:

> Agent says X → local evidence says X → GitHub says X → checkpoint accepted.

Do not add unrelated project requirements.

---

# 11. Definition of a Valid Improvement

An improvement is valid only if it clearly strengthens at least one of:

* research validity,
* correctness,
* reproducibility,
* auditability,
* testability,
* clarity,
* maintainability necessary for the research artifact.

A feature is not justified merely because:

* it is technically interesting,
* it looks impressive,
* it is common in production software,
* another project uses it,
* an AI agent suggests it.

---

# 12. Scope Protection

The following are explicitly **not current priorities**:

* full CHAMP-Pipeline implementation (Ingestion/Normalization/Synthesis/Validation) — deferred to Phase II, see §6 (added 2026-08-24)
* any benchmark or experimental evaluation before Phase II (added 2026-08-24)
* production deployment
* commercial productization
* cloud infrastructure
* machine-learning-based reconstruction
* LLM-based reconstruction
* vector databases
* RAG
* microservices
* unnecessary backend APIs
* elaborate frontend design
* mobile applications
* large-scale distributed processing
* conference optimization
* journal formatting
* JOSS submission
* performance optimization before correctness
* unnecessary abstraction layers

These may be reconsidered only if later evidence demonstrates that they materially strengthen the research contribution.

---

# 13. Current Known Repository Reality

**Revised 2026-08-24.** The repository currently contains:

* formal CARTA documentation (`docs/CARTA-framework.md`), mechanism-honest as of 2026-08-24 (LWW/single-slot backup mechanism disavowed, demoted to a labeled unverified hypothesis),
* a detailed formal specification and living paper draft (`docs/PAPER_BLUEPRINT.md`), internally consistent as of 2026-08-24 (4 math issues resolved, no fabricated numbers, no unearned capability claims — swept and grepped clean),
* a partial literature survey with real citations (`docs/PAPER_BLUEPRINT.md §2.5`),
* repository/project scaffolding,
* deterministic synthetic fixture generator, five generated fixtures, fixture manifest — both previously-known bugs resolved 2026-08-24 (see `STATE.md`).

The following are, by the fast-path decision (§6, Phase II), **intentionally and indefinitely deferred, not missing-and-pending**:

* ingestion parser, normalization, synthesis, Ω implementation,
* automated tests, CI, viewer.

None of the above is required for this paper. Do not schedule engineering work against them without an explicit, separate decision to open Phase II.

Do not assume a component exists merely because a roadmap, README, or previous conversation says it should exist.

Always verify actual repository state.

---

# 14. Final Success Definition

**Revised 2026-08-24 (fast-path decision).** The project (this roadmap) is successful when:

```text
TCF is formally and defensibly characterized
        +
CARTA is formally specified and internally consistent
        +
The novelty/related-work position survives the literature kill-shots
        +
Every empirical/capability statement is cited or explicitly labeled
proposed/future work
        +
Paper accurately describes all of the above
        ↓
ARXIV PREPRINT
```

`CHAMP implements CARTA`, `Implementation is reproducible`, `Implementation is validated`, and `Evidence supports the claims` are **not** required for this success definition — they belong to Phase II, a separate, deferred, future project (§6). Requiring them here was the original plan; this revision explicitly supersedes that.

That is the finish line.

Everything else is secondary.

---

# 15. North-Star Statement

Keep this statement in mind whenever making project decisions:

> **We are building the minimum rigorous, defensible specification — not software — necessary to turn TCF + CARTA into a publishable research paper.**
> *(Revised 2026-08-24 — no software artifact is required for this paper; see §6, Phase II.)*

And:

> **The paper is the product. CHAMP-Pipeline's implementation is deferred future work, not evidence for this paper.**
