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

Phase R is closed. `paper/main.tex` + `paper/sections/*.tex` + `paper/main.bib` (31 entries) compile clean under **real pdflatex** (TeX Live 2026, verified 2026-08-26 — see "Submission readiness" below): 19 pages, 0 overfull/underfull boxes, **0 LaTeX or BibTeX warnings** — the only remaining log line is a pre-existing third-party `algorithm.sty` UTF-8 notice, unfixable from this repo and harmless. Abstract written (187 words, grounded in the finished sections). Both planned figures (TCF timeline, CARTA pipeline) drawn as self-contained TikZ — no external image files. Author/ORCID filled in `CITATION.cff` and `main.tex` (Maitreya Sapariya, Independent Researcher, ORCID 0009-0003-9346-3775). `[CITE-T2]` **resolved**: the architect chose to narrow Section 1's claim to what the archived WhatsApp source actually supports (the restore-account constraint), reframing "no merge operation exists" as the paper's own observation with a pointer to §8.3's tooling survey, rather than an unsupported attribution to WhatsApp — the `\citeTODO`/`\nocite` tripwire removal and the bibliography orphan-check (31 defined = 31 cited = 31 rendered) both confirm the fix is real, not cosmetic. T1 (terminology collision) turned out to already be resolved in `docs/DRAFT_PAPER.md` §2.5 — found during verification, not previously tracked as done. T3 (patent claims) closed as moot — the claim it would have gated was already dropped, and the patent isn't cited in the paper. The Chabot contingency remains **decided, not open**: accepted as a stated limitation. Only the arXiv category is still open, parked for a joint decision at the start of Phase S.

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

4. ~~`.gitignore` contains uncommitted changes.~~ **RESOLVED 2026-08-25** — committed in `be92a41`. `.gitignore` now also excludes `.claude/` and `paper/` build artefacts (aux, bbl, blg, log, out, and the compiled PDF), so only LaTeX source is tracked. Note for submission: arXiv wants `main.bbl` uploaded with the source even though it is ignored here.

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

**Phase R closed 2026-08-25** — abstract, figures, author/ORCID, and `[CITE-T2]` all resolved; see Current Milestone above for full detail. **Real-pdflatex verification closed 2026-08-26** — see "Submission readiness" below. Remaining before Phase S can close: one full cold read-through of the assembled `paper/main.pdf` (not per-section — not yet done), the arXiv category decision (recommended `cs.DL` primary / `cs.CR` cross-list — parked, architect's call), re-verifying the fixture-generator determinism claim at actual submission time, generating a fresh `main.bbl` for upload alongside the source (gitignored, must be added by hand — arXiv doesn't reliably run bibtex), and the arXiv account/submission itself, which is the architect's own action.

Do not commit until the result has been reviewed and explicitly approved.

## Checkpoint Status

### Last Verified Checkpoint

No research checkpoint pushed yet.

### Last Local Commit

**`be92a41` — "docs: sync project trackers and repo metadata to current state", 2026-08-25.** Phase L/W/R work was committed the same day in five scoped commits on `main`:

| Commit | Contents |
|---|---|
| `87e489b` | fix: two synthetic fixture bugs, corpus regenerated |
| `5884c6d` | docs: paper blueprint + literature survey; CARTA specification revised |
| `7e9b08d` | docs: full manuscript draft ("When Chats Split Apart") |
| `6957a98` | build: LaTeX source for the arXiv manuscript |
| `be92a41` | docs: project trackers and repo metadata synced |

Working tree is clean apart from `grill-me-output.txt`, which is deliberately untracked session scratch.

> **Note on this section.** Do not record a bare SHA as "current HEAD" — a commit cannot contain its own hash, so any such line is stale the moment it is written, which is exactly how the earlier `6484f6a` and `8e9eb8b` entries went wrong twice. Record the last *reviewed checkpoint* instead, and re-derive HEAD with `git rev-parse HEAD` when it is actually needed.

### Verification performed 2026-08-25 (independent Opus session, post-commit)

* **Hard rule 1 holds.** Every commit on every ref was walked with `git ls-tree`: `Real WhatsApp Data/` has never entered the tree. A scan of all committed content for phone numbers, E.164 patterns, 10+ digit runs and email addresses returned only a git SHA fragment, the PRNG's `4294967296`, WhatsApp FAQ article IDs and Wayback timestamps. Fixtures use synthetic senders only ("You", "Contact A").
* **`paper/` tracks exactly 12 source files**, no build artefacts, `.claude/` correctly excluded.
* **HEAD's tree builds standalone.** `paper/` exported from HEAD via `git archive` and compiled in isolation: 19 pages, 0 LaTeX warnings, 0 overfull/underfull boxes, 0 BibTeX warnings, no `[CITE-T2]`. The committed file set is necessary and sufficient.

### Submission readiness verified 2026-08-26

* **Compiled with real `pdflatex`, not just Tectonic.** Every earlier clean build in this project used Tectonic, which is XeTeX-based; the `\ifPDFTeX` guard in `main.tex` meant the `inputenc`/`fontenc` branch that arXiv actually takes had never executed. Verified with pdfTeX 3.141592653-2.6-1.40.29 (TeX Live 2026) against a `git archive` export of HEAD, running `pdflatex → bibtex → pdflatex → pdflatex`: all passes exit 0, BibTeX processed 31 entries with `warning$ -- 0`, and the log confirms `inputenc.sty` and `fontenc.sty` were loaded. **Result: 19 pages, 0 LaTeX warnings, 0 overfull/underfull boxes, 0 undefined references or citations, 0 font-substitution warnings.** This satisfies `docs/PAPER_BLUEPRINT.md` §6.2 item 3 literally. One extra pass beyond the standard four is needed to clear a "Label(s) may have changed" notice (the figure floats shift labels); arXiv runs enough passes for this, and it converges to zero warnings on pass five.
* **arXiv upload bundle built and verified.** `paper/arxiv-submission.tar.gz` (gitignored, regenerable) holds the 12 files arXiv needs: `main.tex`, the nine section files, `tables/tab1_taxonomy.tex`, and `main.bbl`. `main.bib` is deliberately **excluded** so arXiv does not attempt to re-run BibTeX. Verified to compile to the same 19 pages with zero warnings *without* any `.bib` present.
* **Generator determinism re-verified.** `node scripts/generate-synthetic-fixtures.js --seed 1 --count 5` run twice: both runs byte-identical to each other and to the committed corpus (all six files), working tree unchanged by the check. This is the paper's only reproducibility claim.
* **Star counts re-checked against the GitHub API.** All seven repositories unchanged from the recorded figures, including the two the manuscript actually cites (`bepaald/signalbackup-tools` 1,392 and `natario1/whatsapp-database-merger` 78). Access dates in `paper/main.bib` remain 2026-08-25 and are still accurate; re-check again if submission slips by more than a few weeks.

**Remaining before submission: arXiv endorsement (in progress, architect) and the category decision.** (Note: the page count and figures in this block predate the Ground-Problem Alignment pass below; 20 pages is current.) Recommended: primary `cs.DL`, cross-list `cs.CR` then `cs.SE`. `cs.DC` is deliberately *not* recommended — Section 8.1 argues TCF falls outside the CRDT convergence guarantee, so that audience would be reviewing against a claim the paper does not make.

### Ground-Problem Alignment pass 2026-08-26 (external review, adopted with one modification)

An in-depth external review, read against `actual_problem.md`, found that the
TCF definition required an event that never happened in the motivating
incident. Both findings were verified against the source before any edit; full
record in `docs/DRAFT_PAPER.md` drafting note 21.

* **A factual misstatement was corrected.** Section 1 said one of the authors
  lost message history to a destructive restore. `actual_problem.md` says
  nothing was lost and no restore was performed. Confirmed with the author:
  **no restore was ever performed.** This was the most serious item in the
  review — the paper disclaims its own anecdote as non-evidence, so an
  unsupported claim about that anecdote was the worst-placed error in it.
* **Condition 3 became a disposition rather than an event.** Old C3
  ("Asymmetric reconciliation *on merge*") began the split at the moment a
  restore is performed, so TCF did not obtain in the incident that motivated
  it. New C3 ("Asymmetric reconciliation"): no platform-native operation
  yields the union, and every reunification path substitutes one state for
  another. It holds from the moment the branches exist.
* **The reviewer's own C3 was NOT adopted verbatim.** They proposed dropping
  the asymmetry and keeping only "no native mechanism". That would blunt
  §2.4's distinction from sync conflict (which turns on other platforms
  attempting reconciliation badly, not on absence) and drift TCF toward the
  multi-device information fragmentation §2.5 fences off. The destructive
  restore is instead kept as a named sub-case: Conditions 1–3 hold in the
  **latent** case (both archives readable, no view spanning them — this is
  what the incident exhibits), and a restore makes it **manifest**.
* **Two smaller items, both verified:** an exhaustive product claim ("the
  platform simply offers no operation") sitting one sentence above the
  deliberately narrowed WhatsApp citation — a residual inconsistency from the
  `[CITE-T2]` pass, now "we found no documented way"; and *internally
  complete*, used in the abstract, RQ1 and §9 but never defined, now defined
  in §2.2 as an idealisation of the model rather than a property established
  of any real archive.
* **CARTA (Sections 3–6) needed no change.** The specification never depended
  on how the fragments arose. That is the strongest evidence the framework was
  right and only the problem statement was overfitted.
* **Figure 1 was redrawn, not edited** — C3 can no longer be drawn at a point.
  **`pdflatex` reported zero overfull boxes for a version of the drawing whose
  labels visibly collided in three places, two of which predated this pass.**
  They were found only by rasterising the page and looking at it. For TikZ,
  log-clean is not correctness; inspect the rendered page.

**Re-verified after the pass** (same toolchain, TeX Live 2026 `pdflatex`):
`pdflatex → bibtex → pdflatex ×4`, all passes exit 0, BibTeX 31 entries
`warning$ -- 0`. **20 pages** (was 19; the pass added two paragraphs), **0
LaTeX warnings, 0 overfull/underfull boxes, 0 undefined, 0 font
substitutions.** Abstract re-measured at **199 rendered words** (target
150–200). `paper/arxiv-submission.tar.gz` rebuilt at 33,488 bytes, 12 files,
and re-verified to build to the identical PDF in a clean directory with no
`.bib` present.

### Found and closed 2026-08-26 (architect, independent check) — verified artefact and committed working tree had diverged

The pdflatex verification above ran against a `git archive` export of HEAD — a legitimate, arguably stricter test (it verifies the exact committed tree in isolation, immune to working-directory contamination). But its output was never copied back: `paper/main.log` in the actual working tree still read `Output written on main.xdv` (Tectonic's XeTeX-derived pipeline) at the time this was checked, not `main.pdf` (pdfTeX's direct output) — meaning the *tracked repository's own* build products (`main.log`, `main.pdf`, `main.bbl`, all gitignored, so `git status` never flagged the mismatch) were still Tectonic-built, not pdflatex-built, despite the verification commit's message. This is a self-report/reality gap of exactly the kind this project has repeatedly caught elsewhere — this time in build provenance rather than a citation.

**Fixed by rebuilding directly with the installed TinyTeX** (`C:\Users\MaitreyaSapariya\.tl-verify\TinyTeX`, full binary paths, `paper/` as the working directory): `pdflatex → bibtex → pdflatex → pdflatex`, all four steps exit 0. Confirmed via the log's own banner — `This is pdfTeX, Version 3.141592653-2.6-1.40.29 (TeX Live 2026)` — and `Output written on main.pdf` (not `.xdv`). **19 pages, 0 warnings, 0 overfull/underfull boxes.** Ran a further pass beyond the standard four to check the "Label(s) may have changed" note the verification commit flagged as needing a fifth pass: it did **not** recur — `rerunfilecheck` reported `File main.out has not changed` after the fourth pass, confirming convergence without needing that extra rerun. `paper/main.bbl` was independently confirmed byte-identical to the one already packaged in `paper/arxiv-submission.tar.gz`, so the upload bundle needed no rebuild. The tracked repository's own `paper/` directory now genuinely reflects a real-pdflatex build, not Tectonic.

A convenience copy of this pdflatex-verified PDF was placed at the repo root, `When-Chats-Split-Apart.pdf`, per the architect's request — gitignored, consistent with `paper/main.pdf` also being a regenerable, uncommitted artefact.

### GitHub Verification

Repository is `stiFFLer-codes/champ-pipeline`, branch `main`. **Nothing has been pushed yet** — `git status -sb` reports `main...origin/main [ahead 5]`, so all five commits above are local only.

Committing is not the same as an approved checkpoint. See "Next Checkpoint" below.

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
