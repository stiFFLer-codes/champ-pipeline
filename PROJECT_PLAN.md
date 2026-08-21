# CHAMP-Pipeline — Project Plan & Research Direction

## 1. North Star

The ultimate goal of this project is:

> **Produce a credible research paper describing Temporal Communication Fragmentation (TCF), the CARTA framework, and CHAMP-Pipeline as a WhatsApp-specific reference implementation demonstrating the framework.**

The initial publication target is an **arXiv preprint**.

Do not optimize the project prematurely for journal formatting, conference requirements, JOSS, production deployment, or elaborate publication infrastructure.

Those may be considered later.

The immediate objective is to produce a technically rigorous and reproducible body of work that can support the paper.

### Core principle

> **The paper is the product. CHAMP-Pipeline is evidence.**

Every major engineering decision must therefore be evaluated against one question:

> Does this materially strengthen the research contribution, implementation evidence, reproducibility, or paper?

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

The intended relationship is:

```text
Research Problem
      ↓
TCF Formalization
      ↓
CARTA Framework
      ↓
CHAMP-Pipeline Implementation
      ↓
Controlled Experiments
      ↓
Evidence
      ↓
Research Paper
```

The implementation exists primarily to provide evidence that the framework can be operationalized.

Therefore:

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

# PHASE 1 — Evidence Foundation

### Objective

Create a trustworthy synthetic experimental corpus for implementation and validation.

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

The current reconnaissance identified:

1. `attachment-double-filename` appears in only one fixture and should be represented in at least two independent fixtures.
2. The self-chat encryption fixture has a mismatch between its manifest classification, generator constant, and emitted literal text.

These must be resolved before treating the fixture corpus as locked.

### Exit condition

The synthetic corpus is:

* deterministic,
* internally consistent,
* deliberately specified,
* sufficiently diverse for the parser,
* documented through the manifest,
* reproducible from a clean checkout.

### Current status

**IN PROGRESS**

---

# PHASE 2 — CARTA Data Contract

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

**NOT STARTED**

---

# PHASE 3 — Ingestion

### Objective

Implement:

```text
F → R
```

The ingestion stage converts raw WhatsApp export files into structured, provenance-bearing records.

It must account for the edge cases represented by the synthetic corpus.

At minimum investigate and handle:

* date formats
* time formats
* sender detection
* senderless system lines
* multiline messages
* empty-body messages
* attachments
* encryption notices
* group events
* Unicode/emoji
* malformed/unrecognized lines

The implementation must preserve information rather than silently discard it.

### Exit condition

Every supported synthetic fixture can be deterministically converted from raw TXT into the canonical `R` representation.

### Current status

**NOT STARTED**

---

# PHASE 4 — Normalization

### Objective

Implement:

```text
R → R'
```

Normalization must produce canonical, schema-valid records while preserving provenance.

Records that cannot safely be normalized must enter the quarantine set:

```text
Q
```

Nothing should disappear silently.

### Exit condition

Every ingested record is either:

```text
valid R'
```

or:

```text
explicitly retained in Q
```

with provenance preserved.

### Current status

**NOT STARTED**

---

# PHASE 5 — Synthesis

### Objective

Implement:

```text
{R'₁, R'₂, ..., R'ₙ} → (U, Ω)
```

This is the central CHAMP-Pipeline research implementation.

Synthesis must address:

* chronological reconstruction
* duplicate detection/reconciliation
* provenance
* archive relationships
* ambiguity
* conflicts
* deterministic decisions
* non-destructive behavior

Unresolved ambiguity must not be silently discarded.

It must surface in `Ω`.

### Output

```text
U = unified reconstructed archive

Ω = auditable reconstruction report
```

### Exit condition

Multiple fragmented archives can be reconstructed deterministically into `U` with an accompanying auditable `Ω`.

### Current status

**NOT STARTED**

---

# PHASE 6 — Validation

### Objective

Demonstrate that the implementation actually satisfies the framework.

Validation must cover:

## Correctness

Expected reconstruction behavior.

## Determinism

Identical inputs produce identical:

```text
U
Ω
```

## Invariants

The CARTA invariants are preserved.

## Edge cases

Synthetic fixtures exercise difficult parser/reconciliation conditions.

## Regression

Previously validated behavior remains stable after changes.

Prefer deterministic tests and golden/reference outputs where appropriate.

### Exit condition

The complete core pipeline has a reproducible automated validation suite.

### Current status

**NOT STARTED**

---

# PHASE 7 — Experimental Evidence

### Objective

Convert implementation into research evidence.

The paper must be able to report what was actually evaluated.

Potential evidence includes:

* number of synthetic scenarios
* message/record counts
* archive fragmentation patterns
* reconstruction outcomes
* duplicate resolution
* ambiguous cases
* quarantine cases
* invariant preservation
* deterministic repeatability

Do not manufacture statistical claims that the dataset cannot support.

If the evaluation consists primarily of controlled handcrafted scenarios, describe it honestly as controlled proof-of-concept/validation evidence rather than pretending it is a large statistical benchmark.

### Exit condition

There is sufficient evidence to support the implementation and methodology claims made in the paper.

### Current status

**NOT STARTED**

---

# PHASE 8 — Minimal Demonstration Layer

### Objective

Build the simplest useful viewer demonstrating the reconstructed output.

The viewer is supporting infrastructure.

It is not the primary research contribution.

Potential functionality:

* contact/chat navigation
* reconstructed message display
* date filtering
* keyword search
* media/attachment representation
* basic provenance/reconstruction visibility where useful

Do not spend significant time on visual polish.

### Exit condition

A researcher/reviewer can run the project and inspect a reconstructed archive.

### Current status

**NOT STARTED**

---

# PHASE 9 — Paper

### Objective

Produce the actual research paper.

The paper should follow the research argument:

```text
Problem
   ↓
Formalization
   ↓
Related phenomena
   ↓
CARTA framework
   ↓
CHAMP implementation
   ↓
Experimental methodology
   ↓
Results
   ↓
Limitations
   ↓
Conclusion
```

The paper should not become a software user manual.

Likely contribution categories include:

1. Formal definition of TCF.
2. CARTA framework for reconstruction of fragmented communication archives.
3. CHAMP-Pipeline as a WhatsApp-specific reference implementation.
4. Reproducible controlled evaluation methodology.

Only make claims that the evidence supports.

### Exit condition

A complete, internally consistent research paper exists and accurately corresponds to the implementation and experimental evidence.

### Current status

**NOT STARTED**

---

# PHASE 10 — arXiv Preprint

### Objective

Publish the completed paper as an arXiv preprint.

Supporting infrastructure such as:

* GitHub release
* Zenodo DOI
* ORCID
* citation metadata

may be completed around this stage.

These are supporting outputs, not the primary project goal.

### Exit condition

The paper is submitted/published as an arXiv preprint.

### Current status

**NOT STARTED**

---

# 7. Current Position

At the time this document is created:

```text
PHASE 0 — Research Foundation
DONE

PHASE 1 — Evidence Foundation
IN PROGRESS

PHASE 2 — CARTA Data Contract
NOT STARTED

PHASE 3 — Ingestion
NOT STARTED

PHASE 4 — Normalization
NOT STARTED

PHASE 5 — Synthesis
NOT STARTED

PHASE 6 — Validation
NOT STARTED

PHASE 7 — Experimental Evidence
NOT STARTED

PHASE 8 — Demonstration Layer
NOT STARTED

PHASE 9 — Paper
NOT STARTED

PHASE 10 — arXiv
NOT STARTED
```

The immediate milestone is therefore:

> **Lock the synthetic evidence foundation before designing and implementing the CARTA data contracts.**

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
Checkpoint 1 — Evidence Foundation Locked
After Phase 1 / M1 is fully verified:
- fixture specification fixed,
- generator deterministic,
- manifest consistent,
- required edge-case coverage accepted.

Checkpoint 2 — CARTA Data Contract Locked
After F, R, R', Q, U, and Ω contracts are reviewed and finalized.

Checkpoint 3 — Ingestion Complete
After ingestion implementation, relevant tests, and fixture parsing are verified.

Checkpoint 4 — Normalization Complete
After R → R' and quarantine behavior are implemented and verified.

Checkpoint 5 — Synthesis Complete
After R' → (U, Ω), deterministic reconstruction, and relevant tests are verified.

Checkpoint 6 — Core Validation Complete
After end-to-end, golden/reference, invariant, determinism, and regression validation is passing.

Checkpoint 7 — Research Evidence Locked
After experimental methodology and results are finalized and reproducible.

Checkpoint 8 — Paper-Ready Repository
After documentation, README, citation metadata, reproducibility instructions, and implementation are aligned with the paper.
```

Clarify that the viewer does not automatically require its own checkpoint; checkpointing should follow research significance rather than arbitrary software milestones.

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

The repository currently contains:

* formal CARTA documentation,
* repository/project scaffolding,
* deterministic synthetic fixture generator,
* five generated fixtures,
* fixture manifest.

The following core research implementation is currently missing:

* ingestion parser,
* normalization,
* synthesis,
* Ω implementation,
* automated tests,
* CI,
* viewer.

The synthetic generator and fixtures currently require validation/locking before they become the foundation for downstream implementation.

Do not assume a component exists merely because a roadmap, README, or previous conversation says it should exist.

Always verify actual repository state.

---

# 14. Final Success Definition

The project is successful when:

```text
TCF is formally defined
        +
CARTA is formally specified
        +
CHAMP implements CARTA
        +
Implementation is reproducible
        +
Implementation is validated
        +
Evidence supports the claims
        +
Paper accurately describes all of the above
        ↓
ARXIV PREPRINT
```

That is the finish line.

Everything else is secondary.

---

# 15. North-Star Statement

Keep this statement in mind whenever making project decisions:

> **We are building the minimum rigorous, reproducible software artifact necessary to turn TCF + CARTA into a defensible research paper.**

And:

> **The paper is the product. CHAMP-Pipeline is the evidence.**
