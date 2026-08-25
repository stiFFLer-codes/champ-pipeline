# CHAMP-Pipeline — Current State

## Last Updated

2026-08-25 (Phase R closed — bibliography, LaTeX assembly, abstract, figures, author/ORCID, [CITE-T2] all done)

## Major Decision Log

**2026-08-24 — Fast path locked.** After a full-session research review ("grilling"), the project locked a scope decision: this paper is a rigorous position/specification paper (TCF definition + CARTA specification + formal F→R→R'→(U,Ω) contracts). CHAMP-Pipeline implementation is explicitly deferred as **Phase II**, a separate future project — not a prerequisite for this paper. No pipeline, no benchmark, no experimental claims required or made in this paper. Full rationale, paper-ready stop condition, and must/should/should-not scope lists: `docs/PAPER_BLUEPRINT.md §2.6`. Four mathematical specification issues (F₁/F₂ overlap vs. Table 1's disjoint claim, dedup relation not an equivalence relation, idempotence type mismatch, ambiguous-but-parseable normalization records) were found and resolved the same session — see `docs/PAPER_BLUEPRINT.md §2.2–2.4` and `docs/CARTA-framework.md §3.2`.

**Update 2026-08-24 (later same day): `PROJECT_PLAN.md` has since been fully revised** to the Phase 0/1/2/L/W/R/S/II scheme described above — the flag that used to be here is resolved, not still open. A follow-up cross-check (via an independent Opus session, same day) found this file (STATE.md) had NOT been updated to match, making STATE.md the stale document instead. Fixed below. Also fixed same pass: kill-shot count was inconsistently reported between `PROJECT_PLAN.md` ("2 of 4") and this file ("3 of 4 remain") — corrected everywhere to the accurate count (1 fully resolved, 1 preliminary, 2 not started); Zenodo/DOI language in `docs/PAPER_BLUEPRINT.md` contradicted its own out-of-scope decision — fixed; `CLAUDE.md` still described CHAMP-Pipeline as "proving the framework works" — fixed; a `docs/CARTA-framework.md` notation gap (Q missing from F→R→(R',Q)→(U,Ω)) and an unstated provenance-preservation guarantee were found and fixed; memory's title reference was stale — fixed.

**2026-08-25 — Phase L complete; delta survived but narrowed.** Six kill-shot questions run in parallel; results recorded in `docs/PAPER_BLUEPRINT.md §2.5` with per-finding confidence labels. **Two previously-recorded findings were corrected, not confirmed:** (1) "CRDT merge requires a common ancestor" is true of the mergeable-RDT line (Kaki OOPSLA'19, Soundarapandian PLDI'22) but **false of foundational CRDTs** — Shapiro et al.'s 2011 state-based merge is a two-argument least upper bound with no ancestor; the argument that actually excludes TCF is its *zero-synchronization* condition, not ancestry. (2) arXiv:1903.01396 is really a **DFRWS 2014 / *Digital Investigation*** paper (Chabot et al., SADFC) and it **does** formally define per-record provenance (the "relation of support"), so CARTA cannot claim provenance as novel. **Three claims are now positively forbidden** and are listed in §2.5: that the problem is unrecognized, that merging chat archives is novel, and that destructive restore is an unrecognized hazard — all three are refuted by shipped tooling, an independent public repository describing the TCF scenario verbatim, and US Patent 8,151,139 B1 respectively. **What survives:** no *specification* exists for reconciliation under partial overlap, and no artifact found couples reconciliation with provenance, quarantine, conflict reporting, and determinism. The delta sentence was rewritten accordingly and now explicitly disclaims priority over both merging and the problem itself.

**2026-08-25 (same day, after review) — two further claims challenged for outrunning their citations; both challenges were correct, both claims corrected.** (1) **"Every merging tool silently drops records it cannot parse" — REFUTED at source level.** The five tools differ: `frozenspider/chat-history-manager` *aborts the load* on an unknown record type, and `EkriirkE/WAMerge` *prints a per-record diagnostic* before skipping. Only three of five drop silently. The universal claim that does hold — and the one CARTA's contribution actually rests on — is that **none of the five retains rejected input for later inspection**. The lesson recorded in §2.5: *"no quarantine"* and *"silently drops"* are different claims, and only the first is universal. (2) **"No prior work stages forensic reconstruction as a pipeline" — REFUTED.** Tracing the follow-on work the 2014 DFRWS paper deferred (Chabot's complete corpus enumerated across HAL, UCD DSpace and arXiv — no "investigation process model" document exists in any of them) surfaced **Chabot et al., IEEE JISIC 2014, DOI 10.1109/JISIC.2014.54**, which publishes a four-layer Extraction → Semantic → Reasoning → Interface pipeline. **Staging is conceded.** CARTA's claim narrows to the *formality of the inter-stage data contract* plus the two typed outputs with no analogue in that lineage — **Q** and **Ω**. That paper names no stage signatures, attributes completeness to Gladyshev rather than discharging it, never uses merge/reconcile/conflict, and *filters* unparseable records away rather than retaining them.

**Update — this contingency was later closed by decision, not by reading the documents.** The human architect decided: accept the limitation as stated and proceed to bibliography assembly rather than keep chasing the two documents. Section 7.4/8.2's contingency language is the accepted, shipped limitation — not an open TODO. See Phase R status below.

**⚠ The delta is now contingent, and Phase L closes with this explicitly open.** (Original framing, kept for the historical record.) Two Chabot documents could not be obtained — the **ORD2I** body (*Digital Investigation* 15:83–100, DOI 10.1016/j.diin.2015.07.005, paywalled; its "seven necessary criteria" are the likeliest place an invariant is stated *and discharged*) and the **2015 thesis** (NNT 2015DIJOS037; every automated route 403'd, ResearchGate author profile is the live lead). **If either defines typed stage inputs/outputs, the residual claim reduces to Q and Ω alone and the paper must say so plainly rather than defending the pipeline framing.** Until one is read, "no prior formal inter-stage contract exists" is NOT settled and must not be written as such.

## Current Phase

Phase L — Literature Survey Completion (DONE, 2026-08-25) → Phase W — Paper Writing (DONE, 2026-08-25) → Phase R — Repo Hygiene & Submission Prep (**DONE, 2026-08-25**) → next: Phase S — arXiv Submission (NOT STARTED)

## Current Milestone

Phase R is closed. `paper/main.tex` + `paper/sections/*.tex` + `paper/main.bib` (31 entries) compile clean via Tectonic: 19 pages, 0 overfull/underfull boxes, **0 LaTeX or BibTeX warnings** — the only remaining log line is a pre-existing third-party `algorithm.sty` UTF-8 notice, unfixable from this repo and harmless. (No local pdflatex install on this machine; a pdflatex run on the eventual submission machine is still the check that matters.) Abstract written (187 words, grounded in the finished sections). Both planned figures (TCF timeline, CARTA pipeline) drawn as self-contained TikZ — no external image files. Author/ORCID filled in `CITATION.cff` and `main.tex` (Maitreya Sapariya, Independent Researcher, ORCID 0009-0003-9346-3775). `[CITE-T2]` **resolved**: the architect chose to narrow Section 1's claim to what the archived WhatsApp source actually supports (the restore-account constraint), reframing "no merge operation exists" as the paper's own observation with a pointer to §8.3's tooling survey, rather than an unsupported attribution to WhatsApp — the `\citeTODO`/`\nocite` tripwire removal and the bibliography orphan-check (31 defined = 31 cited = 31 rendered) both confirm the fix is real, not cosmetic. T1 (terminology collision) turned out to already be resolved in `docs/DRAFT_PAPER.md` §2.5 — found during verification, not previously tracked as done. T3 (patent claims) closed as moot — the claim it would have gated was already dropped, and the patent isn't cited in the paper. The Chabot contingency remains **decided, not open**: accepted as a stated limitation. Only the arXiv category is still open, parked for a joint decision at the start of Phase S.

## Project North Star

The paper is the product. CHAMP-Pipeline's implementation is deferred future work (Phase II), not evidence for this paper.

The final goal is a credible research paper describing TCF, CARTA, and CHAMP-Pipeline, with an arXiv preprint as the initial publication target.

## Completed

* TCF formalization and CARTA framework documentation completed.
* Repository reconnaissance completed.
* `PROJECT_PLAN.md` created.
* Synthetic fixture generator inspected.
* Five synthetic fixtures inspected.
* Fixture manifest inspected.
* Git state and repository privacy state verified.

## Current Repository Reality

*(Revised 2026-08-24 — see also `PROJECT_PLAN.md §13`, kept in sync.)*

Implemented:

* CARTA/TCF documentation (`docs/CARTA-framework.md`) — mechanism-honest, notation-complete.
* Formal specification and living paper draft (`docs/PAPER_BLUEPRINT.md`) — internally consistent, swept clean of fabricated numbers and unearned claims.
* Deterministic synthetic fixture generator, five fixture files, fixture manifest — both known bugs resolved.
* Repository/package scaffolding.

**Deferred to Phase II (intentionally, not missing-and-pending):**

* Ingestion, Normalization, Synthesis, Ω reconstruction report.
* Automated tests, CI, viewer.

None of the above is required for this paper. Do not schedule engineering work against them without an explicit, separate decision to open Phase II.

## Known Issues

1. ~~`attachment-double-filename` appears in only one fixture.~~ **RESOLVED 2026-08-24.** Added an `attach-double` event to `profileGroupLifecycle`; now appears in fixture-02 and fixture-03 (verified via manifest.json).

2. ~~Self-chat encryption fixture text mismatch.~~ **RESOLVED 2026-08-24.** Was a stale checked-in file — the generator's `ENC_NOTICE_SELF` constant already matched the manifest's `encryption-notice-self` tag; regenerating fixed the `.txt` content. Verified fixture-01's first line now matches the constant exactly.

3. ~~The generator and five fixtures are currently untracked.~~ **STALE, already resolved** — confirmed via `git ls-files` on 2026-08-24 that these are committed (as of commit `8e9eb8b`).

**Determinism re-verified 2026-08-24**: regenerating twice with `--seed 1 --count 5` produced byte-identical `manifest.json` both times.

4. `.gitignore` contains uncommitted changes:

   * `Real WhatsApp Data/`
   * `.commandcode/`

5. Real WhatsApp exports exist locally under `Real WhatsApp Data/` but are ignored and must never enter the repository, fixtures, tests, documentation, generated artifacts, or Git history.

## Current Milestone Objective

Lock the synthetic evidence foundation.

The corpus must be:

* deterministic,
* internally consistent,
* deliberately specified,
* sufficiently diverse for the parser,
* accurately represented by its manifest,
* reproducible.

## Immediate Next Action

**Phase L is CLOSED (2026-08-25).** Six kill-shot questions plus two follow-up verifications, all recorded in `docs/PAPER_BLUEPRINT.md §2.5`. Delta survived, narrowed twice, four prior positions corrected, nine claims positively forbidden. **Next milestone is Phase W — paper writing. It is not blocked.**

Carried into Phase W as tracked pre-submission TODOs (not blockers), full text in §2.5's status line:

- **T1 — the name.** Terminology collision ("temporal fragmentation" is taken in time-geography; "fragmented communication" means the opposite in CSCW). Author's call, not a research question. **Leaning: distinguish in Related Work rather than run a rename sweep this late — recorded as leaning, not decided.**
- **T2 — WhatsApp FAQ sourcing.** Replace the third-party-sourced "cannot merge backups" quote with a direct WhatsApp support citation.
- **T3 — US 8,151,139 B1 claims read.** Confirm its "restore backup" is a rollback diff (current reading) and not a second independently-accumulated timeline.

**The one open risk that can still change the paper's claim:** the two unread Chabot documents (ORD2I body; 2015 thesis, NNT 2015DIJOS037). Both resisted every automated retrieval route; ResearchGate's author profile is the live lead and needs a manual download or a library request. If either defines typed stage inputs/outputs, CARTA's residual claim reduces to Q and Ω alone. **Phase W drafting should avoid hardening the inter-stage-contract framing until this is settled** — write Q and Ω as the load-bearing contribution and treat the contract formality as the weaker, contingent claim.

**Phase W complete 2026-08-25** — all nine outline sections drafted in `docs/DRAFT_PAPER.md`, 7,893 words, written against the `.claude/anti-ai.skill` §3.1 standard throughout, verified in three separate deep-review passes (Sections 1/2/8; 3/4; 5/6/7/9).

**Phase R, bibliography + LaTeX assembly, complete 2026-08-25** — `paper/main.bib` (30 entries, each traced to Crossref/arXiv/HAL/GitHub API metadata) and `paper/main.tex` + `paper/sections/*.tex` built from the Markdown draft and independently verified: compiles clean, locked corrections intact (`GroupIntoReconciliationClusters`, British spelling — "Normalization"/"Synthesis" deliberately kept American as CARTA's formal stage names, matching `docs/CARTA-framework.md`), read-only sources confirmed untouched by file mtimes, no commits made. `paper/main.bbl` is gitignored with the other build artifacts but must be generated and included by hand at arXiv submission time (arXiv does not reliably run bibtex) — flagged in `.gitignore` itself so it isn't forgotten.

**Author/ORCID filled 2026-08-25**: Maitreya Sapariya, Independent Researcher, https://orcid.org/0009-0003-9346-3775, in both `CITATION.cff` and `paper/main.tex`. `date-released` left deliberately absent (invalid as an empty string; set at first tagged release). **Chabot contingency: decided, not open** — accepted as a stated limitation per the architect's explicit call, not chased further.

**Phase R closed 2026-08-25** — abstract, figures, author/ORCID, and `[CITE-T2]` all resolved; see Current Milestone above for full detail. Remaining before Phase S can close: one full cold read-through of the assembled `paper/main.pdf` (not per-section), the arXiv category decision (cs.DL / cs.SE / cs.DC — parked, architect's call), re-verifying the fixture-generator determinism claim at actual submission time, generating a fresh `main.bbl` for upload alongside the source (gitignored, must be added by hand — arXiv doesn't reliably run bibtex), and the arXiv account/submission itself, which is the architect's own action.

Do not commit until the result has been reviewed and explicitly approved.

## Checkpoint Status

### Last Verified Checkpoint

No research checkpoint pushed yet.

### Last Pushed Commit

`8e9eb8b28080915944da704fa73fd558d3e4183e` — verified via `git rev-parse HEAD` 2026-08-24. (Previously recorded as `6484f6a`, which was stale — corrected same pass as the other fixes above.) A substantial amount of uncommitted work sits on top of this (fast-path decision, math fixes, fixture bug fixes, title change, this consistency pass) — none of it has been reviewed/approved as a checkpoint yet.

### GitHub Verification

Verified previously: repository is `stiFFLer-codes/champ-pipeline`, branch `main`.

The current uncommitted work has NOT yet been approved as a checkpoint.

### Next Checkpoint

Checkpoints 1 (Evidence/Illustrative Corpus Locked) and 2 (CARTA Specification Locked) — see `PROJECT_PLAN.md §10` for current names/criteria — appear technically satisfied as of 2026-08-24, but **neither has been reviewed and explicitly approved by the human architect yet.** Technical completion is not the same as an approved checkpoint per this project's own protocol.

### Push Required After

Explicit human review and approval of Checkpoints 1 and 2 (and any subsequent work since). Criteria for Checkpoint 1 already verified: fixture issues resolved, corpus regenerated, manifest/contents verified, determinism re-verified twice, no privacy issues present. Only after explicit approval should the agent be instructed to commit and push.

## Phase Order

*(Revised 2026-08-24 to match `PROJECT_PLAN.md §6/§7` — the old Phase 1–10 chain below is retired.)*

```text
Phase 0 — Research Foundation (DONE)
        ↓
Phase 1 — Evidence & Illustrative Corpus (DONE)
        ↓
Phase 2 — CARTA Specification Lock (DONE)
        ↓
Phase L — Literature Survey Completion (DONE 2026-08-25)
        ↓
Phase W — Paper Writing (DRAFT COMPLETE 2026-08-25)
        ↓
Phase R — Repo Hygiene & Submission Prep (DONE 2026-08-25)
        ↓
Phase S — arXiv Submission (← current finish line)

Phase II — CHAMP-Pipeline Implementation & Empirical Evaluation
(DEFERRED — separate future project, not part of this roadmap)
```

Do not skip phases or begin a later phase without explicit approval.

## Operating Rules

* Read `PROJECT_PLAN.md` for project direction and scope.
* Read `STATE.md` for current operational state.
* Do not perform a full repository reconnaissance unless the state is missing, stale, or contradictory.
* One milestone at a time.
* Do not silently expand scope.
* Do not invent architecture.
* Prefer simple solutions.
* No real personal WhatsApp data.
* No commits without explicit approval.
* Verify implementation claims with actual terminal/source/test evidence.
* Use deliberate GitHub checkpoints at stable research milestones. After each approved push, the repository state must be independently verified against GitHub before proceeding.
* Stop after completing the assigned milestone.

## Session Handoff Rule

At the end of a session, update this file with:

* current phase,
* current milestone,
* completed work,
* verified results,
* unresolved issues,
* next action,
* relevant constraints.

Do not use this file to redefine CARTA theory or project scope. Those remain governed by `docs/CARTA-framework.md` and `PROJECT_PLAN.md`.

## Session Handoff Protocol

At the end of a session, STATE.md must reflect the verified repository state.

If the current session may be ending:

- record the current phase,
- record the current milestone,
- record completed work,
- record verified results,
- record unresolved issues,
- record the next action,
- record checkpoint status,
- state whether a push is required,
- do not begin the next milestone.

The next session should begin from STATE.md rather than repeating a full repository reconnaissance, unless STATE.md is missing, stale, or contradictory.

## Next Session Instruction

Start by reading:

```text
PROJECT_PLAN.md
STATE.md
```

Then continue from the current milestone.

Do not redo the full project reconnaissance unless the state is missing, stale, or contradictory.
