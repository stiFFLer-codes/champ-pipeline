# CHAMP-Pipeline — Current State

## Last Updated

2026-08-29 (Phase II-A COMPLETE — pipeline runs end to end, paper rewritten against it; 31 pages, 0 warnings; push + endorsement + category remain)

## Major Decision Log

**2026-08-24 — Fast path locked.** After a full-session research review ("grilling"), the project locked a scope decision: this paper is a rigorous position/specification paper (TCF definition + CARTA specification + formal F→R→R'→(U,Ω) contracts). CHAMP-Pipeline implementation is explicitly deferred as **Phase II**, a separate future project — not a prerequisite for this paper. No pipeline, no benchmark, no experimental claims required or made in this paper. Full rationale, paper-ready stop condition, and must/should/should-not scope lists: `docs/PAPER_BLUEPRINT.md §2.6`. Four mathematical specification issues (F₁/F₂ overlap vs. Table 1's disjoint claim, dedup relation not an equivalence relation, idempotence type mismatch, ambiguous-but-parseable normalization records) were found and resolved the same session — see `docs/PAPER_BLUEPRINT.md §2.2–2.4` and `docs/CARTA-framework.md §3.2`.

**Update 2026-08-24 (later same day): `PROJECT_PLAN.md` has since been fully revised** to the Phase 0/1/2/L/W/R/S/II scheme described above — the flag that used to be here is resolved, not still open. A follow-up cross-check (via an independent Opus session, same day) found this file (STATE.md) had NOT been updated to match, making STATE.md the stale document instead. Fixed below. Also fixed same pass: kill-shot count was inconsistently reported between `PROJECT_PLAN.md` ("2 of 4") and this file ("3 of 4 remain") — corrected everywhere to the accurate count (1 fully resolved, 1 preliminary, 2 not started); Zenodo/DOI language in `docs/PAPER_BLUEPRINT.md` contradicted its own out-of-scope decision — fixed; `CLAUDE.md` still described CHAMP-Pipeline as "proving the framework works" — fixed; a `docs/CARTA-framework.md` notation gap (Q missing from F→R→(R',Q)→(U,Ω)) and an unstated provenance-preservation guarantee were found and fixed; memory's title reference was stale — fixed.

**2026-08-25 — Phase L complete; delta survived but narrowed.** Six kill-shot questions run in parallel; results recorded in `docs/PAPER_BLUEPRINT.md §2.5` with per-finding confidence labels. **Two previously-recorded findings were corrected, not confirmed:** (1) "CRDT merge requires a common ancestor" is true of the mergeable-RDT line (Kaki OOPSLA'19, Soundarapandian PLDI'22) but **false of foundational CRDTs** — Shapiro et al.'s 2011 state-based merge is a two-argument least upper bound with no ancestor; the argument that actually excludes TCF is its *zero-synchronization* condition, not ancestry. (2) arXiv:1903.01396 is really a **DFRWS 2014 / *Digital Investigation*** paper (Chabot et al., SADFC) and it **does** formally define per-record provenance (the "relation of support"), so CARTA cannot claim provenance as novel. **Three claims are now positively forbidden** and are listed in §2.5: that the problem is unrecognized, that merging chat archives is novel, and that destructive restore is an unrecognized hazard — all three are refuted by shipped tooling, an independent public repository describing the TCF scenario verbatim, and US Patent 8,151,139 B1 respectively. **What survives:** no *specification* exists for reconciliation under partial overlap, and no artifact found couples reconciliation with provenance, quarantine, conflict reporting, and determinism. The delta sentence was rewritten accordingly and now explicitly disclaims priority over both merging and the problem itself.

**2026-08-25 (same day, after review) — two further claims challenged for outrunning their citations; both challenges were correct, both claims corrected.** (1) **"Every merging tool silently drops records it cannot parse" — REFUTED at source level.** The five tools differ: `frozenspider/chat-history-manager` *aborts the load* on an unknown record type, and `EkriirkE/WAMerge` *prints a per-record diagnostic* before skipping. Only three of five drop silently. The universal claim that does hold — and the one CARTA's contribution actually rests on — is that **none of the five retains rejected input for later inspection**. The lesson recorded in §2.5: *"no quarantine"* and *"silently drops"* are different claims, and only the first is universal. (2) **"No prior work stages forensic reconstruction as a pipeline" — REFUTED.** Tracing the follow-on work the 2014 DFRWS paper deferred (Chabot's complete corpus enumerated across HAL, UCD DSpace and arXiv — no "investigation process model" document exists in any of them) surfaced **Chabot et al., IEEE JISIC 2014, DOI 10.1109/JISIC.2014.54**, which publishes a four-layer Extraction → Semantic → Reasoning → Interface pipeline. **Staging is conceded.** CARTA's claim narrows to the *formality of the inter-stage data contract* plus the two typed outputs with no analogue in that lineage — **Q** and **Ω**. That paper names no stage signatures, attributes completeness to Gladyshev rather than discharging it, never uses merge/reconcile/conflict, and *filters* unparseable records away rather than retaining them.

**Update — this contingency was later closed by decision, not by reading the documents.** The human architect decided: accept the limitation as stated and proceed to bibliography assembly rather than keep chasing the two documents. Section 7.4/8.2's contingency language is the accepted, shipped limitation — not an open TODO. See Phase R status below.

**⚠ The delta is now contingent, and Phase L closes with this explicitly open.** (Original framing, kept for the historical record.) Two Chabot documents could not be obtained — the **ORD2I** body (*Digital Investigation* 15:83–100, DOI 10.1016/j.diin.2015.07.005, paywalled; its "seven necessary criteria" are the likeliest place an invariant is stated *and discharged*) and the **2015 thesis** (NNT 2015DIJOS037; every automated route 403'd, ResearchGate author profile is the live lead). **If either defines typed stage inputs/outputs, the residual claim reduces to Q and Ω alone and the paper must say so plainly rather than defending the pipeline framing.** Until one is read, "no prior formal inter-stage contract exists" is NOT settled and must not be written as such.

## Major Decision Log — 2026-08-27

**Fast-path scope lock REOPENED, and Phase II-A opened.** The 2026-08-24 lock (position/specification paper only, no implementation) was made before the peer review surfaced arXiv's CS moderation practice for review articles and position papers, updated 31 October 2025: such submissions must complete peer review at a journal or conference first. The paper as scoped is squarely in that content type. The lock was optimising for a finish line the paper may not be admitted through.

The architect reopened it and chose to build a **minimal** implementation. This is not a reversal of the fast-path reasoning — the paper is still the product. What changed is that shipping with no artifact carries a venue risk the original decision could not have known about, and building the minimum happens to retire review Majors 3, 6 and 7 as a side effect.

**Why this is much cheaper than PROJECT_PLAN.md's Phase II suggests.** Two findings from re-reading the ground problem:

1. **The motivating incident is the $\delta = \epsilon = 0$ boundary case.** `actual_problem.md` states the F12 "effectively started with a new WhatsApp history", so the two fragments are disjoint. Reconstruction of the actual January incident is ordered concatenation — no deduplication, no clusters larger than one, no conflicts possible. The elaborate machinery is for the general case, not the originating one.
2. **§3.8's conformance rule requires an implementation to *declare* its open parameters, not solve them.** A minimal implementation that states its clustering rule, precedence rule and both tolerances is conforming. Nothing has to be solved to be correct.

**Corpus gap found and closed the same day.** Neither review caught it: `generate-synthetic-fixtures.js` emitted five *independent* fixtures — parsing edge cases, one account each — with no notion of a fragment pair, no $t_f$/$t_r$, no $\delta$ or $\epsilon$. **Nothing in the repository exhibited the phenomenon the paper is about**, so there was nothing an implementation could be validated against. Added `--tcf-pair` (with `--delta`, `--epsilon`, `--window`), which generates one ground-truth timeline and splits it per §2.2's own definition. Committed corpus lives in `data/synthetic_fixtures/tcf-pair/`.

Properties that make it useful rather than decorative:

* Overlapping messages are written to **both** fragments and rendered in **different date and clock conventions** — `06/02/24, 6:53 pm` in F1 is `02/06/24, 18:53` in F2. One message, two byte-different observations. An implementation deduplicating on raw lines fails; one deduplicating on normalised records passes. That is precisely what §3.4 says deduplication exists for.
* The manifest records **ground truth**, so `|U|` is checkable rather than admired: `expected_unified_size`, `overlap_messages`, `f1_message_records`, `f2_message_records`, `t_f`, `t_r`.
* The generator **asserts its own split**: `f1 + f2 − overlap == ground_truth`, and that `δ = ε = 0` really yields zero overlap. If the decomposition ever breaks it fails loudly rather than producing fragments that are not fragments.
* Committed configuration is `--delta 14 --epsilon 7` (20 overlapping messages, 170 ground truth, 57 + 133 records). `--delta 0 --epsilon 0` reproduces the January incident exactly.

**Regression-verified:** the five original fixtures and `manifest.json` are byte-identical after the change (`md5sum -c`), and `check-corpus-claims.js` still passes all six §5.2 claims. The paper's committed corpus claims are unaffected.

**Cross-document drift corrected in `PROJECT_PLAN.md` the same pass** — it still carried the pre-review language: "partitioned" (fragments can overlap, so it is not a partition), "Asymmetric Reconciliation on Merge" (renamed to Absent Reconciliation), "four invariants" (three plus a demoted design target), and the core-principle tagline asserting no implementation.

## Phase II-A — Ingestion complete, 2026-08-28

`core/src/ingestion/index.js` implements `I : F_k -> R_k`. CLI: `node scripts/ingest.js [--json] <fragment.txt> ...`. Self-check: `node tests/test-ingestion.js`. Zero dependencies, Node stdlib only.

**Record shape** — raw text slice, raw timestamp string, raw sender token, category, attachment descriptor, and the provenance triple `<source_id, line_range, sha256>` exactly as §3.2 defines it. `line_range` is 1-indexed and inclusive; it is a *range* because a multi-line message's continuation lines belong to the record above them.

**The stage boundary is enforced, not just described.** Ingestion keeps `rawTimestamp` verbatim — `01/12/24` stays `01/12/24` and is not resolved to a date. Deciding whether that is 1 December or 12 January is Normalization's job under `AMBIGUOUS_DATE_FORMAT`, and a parser that guessed here would make it impossible to say later whether a discrepancy came from parsing or from merging.

**Three categories: `message`, `system`, `unparsed`.** The third matters more than it looks. A line the grammar cannot classify becomes a record rather than being skipped, because Invariant 1 is a claim about records the pipeline *saw* — a line dropped at Ingestion is lost before the quarantine set that would have caught it even exists. Nothing is filtered.

**Non-lossy is asserted on every run, not claimed.** `assertNonLossy` checks that record line ranges tile the file exactly: contiguous, non-overlapping, covering line 1 through `lineCount`. It throws rather than returning bad records.

**Validation.**

* All five fixtures and both `tcf-pair` fragments ingest with **0 unparsed records** and full line coverage.
* **Cross-checked against the manifest**: the parser's detections (empty body, multi-line, senderless system line, doubled-filename attachment, trailing-period attachment) were compared against the quirk metadata the *generator* independently wrote, across all five fixtures. **Zero mismatches.** The two were written from opposite directions and agree.
* **Ground truth recovered on the TCF pair**: 57 and 133 message records, exactly matching `f1_message_records` and `f2_message_records` in the pair manifest.
* `tests/test-ingestion.js` covers what the corpus cannot, because the corpus is well-formed by construction: orphan leading continuation lines, a file with no record head at all, a zero-byte file, blank lines mid-file, CRLF, BOM, all three attachment forms, and provenance hash sensitivity.

**One real bug found by that test file and fixed**: `''.split('
')` returns `['']`, so a zero-byte fragment reported one phantom line and produced a spurious `unparsed` record. The corpus would never have surfaced it.

**Stated assumption, not buried**: the sender token is the text before the first `": "`. WhatsApp sender tokens cannot contain that sequence, but a contact whose display name did would be mis-split, and no fragment in the corpus exercises it.

**Doc drift fixed the same pass**: `docs/CARTA-framework.md` §3.3 still described the provenance map as carrying "origin device, origin export, origin backup date, and confidence" — four fields, none of them the three the formal tuple defines. It contradicted both the paper and the code being written against it. Corrected, with the no-confidence-score decision recorded.

## Anti-AI writing audit, 2026-08-28

Ran the `anti-ai` skill's §3.1 academic-manuscript pass over `paper/`. This is directly responsive to the half of review Major 1 that *is* actionable: the arXiv moderation post names LLM-assisted phrasing patterns as a motivating signal for the policy change, so how the paper reads is a live admission risk, separate from what it argues.

Note: `.claude/anti-ai.skill` is a packaged zip, not an installed skill, so `/anti-ai` does not resolve. Extracted and followed `SKILL.md` directly. Unpack it to `.claude/skills/anti-ai/` to make the slash command work.

**Result: the manuscript was already clean.** Measured, not asserted:

| Check | Result |
| --- | --- |
| Overused AI vocabulary (delve, underscore, foster, harness, leverage, tapestry, realm, landscape, pivotal, crucial, robust, seamless, comprehensive, amidst, holistic, transformative, "paves the way", "sheds light on", + ~20 more) | **0 hits** across all sections |
| Formulaic connectives (Moreover, Furthermore, Consequently, "It is important to note", "In conclusion", "further research is needed") | **0** as paragraph openers; 2 mid-sentence "additionally" adverbs, which are not the tell |
| Negative parallelism ("not just X, it's Y") | **0** |
| Vague attribution ("several studies have shown", "research suggests") | **0** |
| Participial `-ing` tails ("...ensuring seamless delivery") | **0** of 671 sentences |
| Priority inflation ("first to", "to the best of our knowledge", "significant improvement") | **0** |
| Rule-of-three | 4 candidates, all substantive (three CARTA stages; the similarity relation's actual fields; two cited titles). None decorative. |
| Sentence burstiness | mean 20.3 words, **stdev 13.9**, range 1--78. The tell is *low* variance clustering at 15--25; this is the opposite. |

The single `novel` in the paper is used deflationarily ("would make CARTA's provenance triple look considerably more novel than it is"), which is the inverse of the tell. The opening is concrete from the first clause ("A phone stops working and goes in for repair"), with no throat-clearing paragraph to cut. The conclusion ends on a concrete claim, with no uplift horizon and no "further research is needed".

**One real finding, fixed.** Two sentences in §7 used paired em-dashes as brackets, which the skill flags as a rewrite candidate ("more than one em dash in a sentence"). Both interiors already contained commas, so the fix was parentheses in one case and a sentence split in the other. Prose em-dash usage overall is 15 across 27 pages, which is not overuse; the earlier per-file counts of 100 and 76 were LaTeX comment separators, not prose.

**No other edits made.** The audit found nothing else worth changing, and manufacturing cosmetic edits to demonstrate effort would be the wrong outcome for a pass whose entire purpose is removing artificial-looking prose.

**27 pages, 0 warnings.** Root PDF and `arxiv-submission.tar.gz` regenerated.

## Phase II-A — Normalization complete, 2026-08-29

`core/src/normalization/index.js` implements `N : R_k -> (R'_k, Q_k)`. CLI `node scripts/normalize.js [--offset <min>] <fragment>`. Self-check `node tests/test-normalization.js`. Zero dependencies.

**Per-record judgement is implemented literally.** A record whose date is well-formed under both orderings is quarantined even when a neighbouring record in the same fragment would settle the ordering. That is §3.3's rule, and it is what produces the numbers below rather than tidier ones.

### The corpus result, which is the paper's own prediction executing

| fragment | ingested | normalized | quarantined |
| --- | --- | --- | --- |
| fixture-01 | 20 | 10 | 10 (50%) |
| fixture-02 | 19 | 12 | 7 (37%) |
| **fixture-03** | **25** | **0** | **25 (100%)** |
| fixture-04 | 13 | 5 | 8 (62%) |
| fixture-05 | 16 | 11 | 5 (31%) |
| tcf-F1 | 58 | 34 | 24 (41%) |
| tcf-F2 | 134 | 77 | 57 (43%) |

All under `AMBIGUOUS_DATE_FORMAT`. **Fixture-03 quarantines completely** — the exact case §5.2 predicted in prose ("in fixture 03 alone would a declared fragment-scope step have nothing to work from afterwards"), now demonstrated by running code rather than asserted.

**Independent cross-validation.** For every fragment, the date ordering the pipeline *resolved* was compared against the ordering the generator *declared* in the manifest: fixture-01 DMY/DMY, 02 MDY/MDY, 03 all-quarantined, 04 MDY/MDY, 05 DMY/DMY, tcf-F1 DMY, tcf-F2 MDY. **Zero contradictions.** The parser never inferred an ordering the corpus disagrees with, and it was written without reference to the manifest.

### Two findings that belong to the specification, not the code

**1. "UTC epoch timestamp" has no source for the offset.** §3.3 says a canonical record carries a UTC epoch timestamp. A WhatsApp text export carries no UTC offset — §5.2 already notes the export has no locale marker to settle the date *ordering*, and the same is true of the *clock*. Converting a wall-clock reading to a UTC instant therefore requires information the input does not contain, and doing it silently is precisely what this stage exists to prevent. Implemented as a declared policy parameter `utcOffsetMinutes` (default 0), so canonical timestamps are wall-clock instants correct up to a declared offset, and the declaration lands in Ω per §3.8. **The paper should say this; right now it asserts UTC without saying where the offset comes from.** Flagged, not silently patched — PROJECT_PLAN.md §3 requires surfacing theory gaps rather than changing the theory implicitly.

**2. The Phase II-A exit condition I wrote on 2026-08-27 was unreachable.** It required `|U|` to equal `expected_unified_size`. Under the per-record rule ~42% of the pair's records quarantine, so `|U|` cannot equal ground truth and should not. Corrected in PROJECT_PLAN.md to conservation, which is what Invariant 1 actually asserts: `|U| + |Ω_quarantine| = ground truth`. Producing a `U` spanning the whole timeline additionally needs the fragment-scope date-inference step that §3.3 permits as a *separate, declared* step over `Q_k`. That is now a named Phase II-A item.

### Declared policy (§3.8 conformance)

`utcOffsetMinutes` 0 · two-digit year pivot 70 (00–69 → 2000s) · taxonomy `message.text | message.attachment | message.empty | system` · reason precedence `UNSUPPORTED_FORMAT, INVALID_ENCODING, MALFORMED_TIMESTAMP, AMBIGUOUS_DATE_FORMAT, UNRESOLVED_SENDER`, first match wins, losing codes retained in `alsoFailed`.

**One design change the tests forced.** An `unparsed` line was accumulating secondary reason codes for a timestamp slot and a sender slot it does not have. Short-circuited: one accurate code, no manufactured ones.

`MALFORMED_TIMESTAMP` is kept distinct from `AMBIGUOUS_DATE_FORMAT` and the distinction is load-bearing: `25/13/24` has no reading under any convention, while `03/04/24` has two. §3.3 says the two call for different remedies, and only the second is resolvable by outside evidence.

## Phase II-A — fragment-scope date inference, 2026-08-29

`core/src/inference/index.js`. CLI flag `--infer` on `scripts/normalize.js`. Self-check `node tests/test-inference.js`; `node tests/run-all.js` now runs every check at once (4 passing).

**Not a CARTA stage.** §3.3 permits it as a *separate, declared* step over `Q_k` and constrains it four ways. Each constraint is implemented as something checkable:

| §3.3 requires | How it is met |
| --- | --- |
| separate | Own module outside `core/src/normalization`; runs only when called; a pipeline that skips it still conforms |
| consumes `Q_k` | Its only inputs are the quarantine set and the records that resolved unaided; it re-reads no files |
| reports what it inferred and on what evidence | Returns order applied, witness count by order, and witness line ranges so a reader can return to the bytes |
| results stay distinguishable | Every rescued record carries an `inferred` block naming field, value, method and basis |

### Result on the corpus

| fragment | before | after `--infer` | inference |
| --- | --- | --- | --- |
| fixture-01 | 10 quarantined | 0 | applied DMY, 10 witnesses |
| fixture-02 | 7 | 0 | applied MDY, 12 witnesses |
| **fixture-03** | **25 (100%)** | **25 (100%)** | **declined: no-evidence** |
| fixture-04 | 8 | 0 | applied MDY, 5 witnesses |
| fixture-05 | 5 | 0 | applied DMY, 11 witnesses |
| tcf-F1 | 24 | 0 | applied DMY, 34 witnesses |
| tcf-F2 | 57 | 0 | applied MDY, 77 witnesses |

**Fixture-03 is the only fragment where the step correctly refuses.** It has no self-disambiguating record, so there is nothing to generalise from, and it stays fully quarantined. The paper predicted exactly this in prose; it is now behaviour with a test asserting it.

Every inferred order matches the ordering the generator declared in the manifest. Asserted in the test file, not just observed.

**The pair now fully resolves** — F1 58 records, F2 134, 0 quarantined — which unblocks Synthesis. In F2, 77 records were never in doubt and 57 carry the `inferred` mark, so the two remain separable in `U`, which is the entire reason §3.3 permits the step.

**It declines in three cases, all tested**: no evidence; split evidence (unambiguous records disagreeing — treated as a contradiction, not a majority vote); and below a declared witness threshold.

### A dead branch the tests found

The module re-quarantined a record when the established order produced an invalid date. That branch is unreachable: `AMBIGUOUS_DATE_FORMAT` is assigned only when both leading fields are in 1..12, which is a valid (day, month) pair under *both* orderings, and the clock is validated before the ordering question arises. Replaced with a loud guard that throws if either premise ever changes, and the property itself is now asserted across all 144 ambiguous date shapes.

Two of the three test failures in this session were faults in the tests rather than the code — one assumed a mid-file orphan line becomes an `UNSUPPORTED_FORMAT` record when Ingestion correctly treats it as a continuation of the record above. Both are recorded here because a test that agrees with the code for the wrong reason is worth less than one that disagrees for the right one.

## Phase II-A — Synthesis complete; the pipeline runs end to end, 2026-08-29

`core/src/synthesis/index.js` implements Algorithm 1 line for line. CLI `node scripts/reconstruct.js [--infer] [--dt <ms>] [--expect <manifest>] <fragments...>`. `node tests/run-all.js` — **5 checks passing**.

### It hits ground truth

```
node scripts/reconstruct.js --infer --expect .../tcf-pair/manifest.json F1 F2

  records into synthesis 192
  |U|                    172        (170 messages + 2 encryption notices)
  duplicates collapsed    20
  quarantined              0
  ok  |U| messages == ground truth (170)
  ok  duplicates collapsed == overlap (20)
  ok  conservation: |U| + collapsed + quarantined == records ingested
```

The disjoint configuration (`--delta 0 --epsilon 0`, the January incident) reconstructs to 172 records with 0 collapsed and 0 conflicts — ordered concatenation, with no special-casing anywhere in the code, exactly as §3.4 claims it should reduce to. **Invariants 1 and 2 are verified inside `synthesize()` on every run**, not asserted in prose; Invariant 3 is a property of two runs and is tested, including independence from the order fragments are supplied in.

### Declared parameters (§3.8)

| Parameter | Value | Why |
| --- | --- | --- |
| clustering | transitive closure with bounded diameter (complete linkage) | §8.5 cites Baas et al. on transitive-closure chaining degrading precision. Having cited it, adopting the rule it warns against would be indefensible. |
| field precedence | single representative, min (t_utc, source_id, sourceSeq) | Field-wise mixing can synthesise a canonical record no fragment ever held. Every record in U is a record that really appeared somewhere. |
| dt_granularity | 0 ms | Both fragments share one platform's minute quantisation; a wider window would collapse a sender repeating a short message. |
| dt_conflict | 60000 ms | Constraint dt_granularity ≤ dt_conflict enforced at entry, and tested. |

### Two more specification findings — the count is now four

**3. Equation (12) reports ordinary group-chat traffic as conflicts.** Its second disjunct is `s(u_i) ≠ s(u_j)`. Read literally, any two records in the same coarse bucket from different senders conflict. Three people messaging inside one minute produces **three conflicts**, and the count grows as the square of traffic per bucket — Ω_conflicts would be unusable on any real group chat. Two people talking is not a contradiction.

The defensible reading, implemented and declared: a sender disagreement is irreconcilable only when the records are otherwise the *same observation* — same body, same bucket, different sender. That is a genuine "who said this?". Verified both ways: the three-line busy-minute example gives 3 conflicts literally and 0 under the declared reading, while same-body/two-senders correctly gives 1. Records with no sender (system lines) are excluded entirely, since `s()` is undefined for them and `null !== 'Alice'` is a type error dressed as a finding.

**4. The doubled-filename export variant defeats deduplication.** Equation (10) matches on body equality, and that variant repeats the filename on a continuation line, so the *same attachment message* exported by two devices in different variants has different bodies, fails to deduplicate, and appears twice in U. This is exactly the TCF configuration: two handsets, possibly different app versions. Fixed in Normalization, where canonicalisation belongs — the repeated line is an export artefact, not content — which keeps Equation (10) intact instead of widening it to tolerate export noise. Ingestion still preserves the raw text and provenance still points at both lines.

Found by a test that failed for the right reason. Both findings are flagged for the paper; neither is patched silently.

### Where the paper now stands relative to the code

Sections 5 and 6 still say CHAMP-Pipeline does not exist and that no evaluation is reported. That is now false in the good direction, and rewriting them is the last item in Phase II-A.

## Phase II-A complete — the paper now reports an implementation, 2026-08-29

Sections 5, 6, 7, 9 and the abstract rewritten against what actually runs. **31 pages, 0 LaTeX warnings, 0 BibTeX warnings, 0 overfull/underfull, 0 undefined references, 0 Type 3 fonts.**

**Section 5** is now "Reference Implementation" rather than "Planned Implementation". The line "It does not exist" is gone. New §5.3 describes the fragment-pair corpus and why its two fragments are rendered in different date orderings and clock conventions. §5.4 documents the end-to-end command and the self-check suite.

**Section 6** was one paragraph explaining there was nothing to evaluate. It now reports reconstruction against known ground truth, with a subsection on what the strict per-record quarantine rule costs, one on the corpus's boundary case, and one headed "What this does not establish".

**Section 7.5, new: "What implementing the specification revealed".** This is the main scientific yield of Phase II-A and the strongest argument for having reopened the scope lock: four defects in the specification, three of which survived two rounds of review of the prose.

**Every figure in Section 6 was machine-verified against a live run before the section was written, and again after.** Not transcribed from notes:

| claim | verified |
| --- | --- |
| 1,014 lines core / 808 lines checks / 4 modules | exact |
| 192 records in, \|U\| 172, 20 collapsed, 0 quarantined, 0 conflicts | exact |
| dating: 103 direct, 69 inferred | exact |
| strict mode: 81 quarantined, 111 to Synthesis, \|U\| 103, 8 of 20 collapsed | exact |
| fixture-03: 25 records, 100% quarantined, inference declines | exact |
| 5 checks passing | exact |

The strict-mode figure is the one worth keeping in view: without the declared fragment-scope step, only 8 of the 20 overlapping messages still deduplicate, because the other 12 have at least one side quarantined. The quarantine rule has a measurable cost and the paper now states it as a number rather than a principle.

### anti-ai pass over the new prose

Roughly 1,200 words of new academic prose, audited under the skill's §3.1 before and after: **0 hits** on the vocabulary list, **0** formulaic connectives, **0** negative parallelism, **0** vague attribution, **0** participial `-ing` tails across 772 sentences. Burstiness held after adding ~100 sentences — mean 20.2, stdev 13.5, range 1–78. The four rule-of-three matches are the same substantive ones as before. Em-dashes in the new sections: 0 in §6, 0 in §7.5.

One overfull box appeared and was fixed by referring to the group-chat fixture by description rather than repeating its long filename, which §5.2 already gives.

### What is left

Phase II-A is closed. Remaining before submission, all outside the code: **push** (`origin/main` still behind), the **AI-use disclosure** in `main.tex` still needs the author's confirmation, **endorsement outreach** has not started, and the **arXiv category** is still undecided. Major 1's content-type risk is materially reduced — the paper now reports an implementation and an evaluation, and its longest section is no longer the survey — but the routing decision is still the architect's.

## Current Phase

Phase L (DONE, 2026-08-25) → Phase W (DONE, 2026-08-25) → Phase R incl. two peer-review revision rounds (DONE, 2026-08-27) → **Phase II-A — Minimal Conforming Implementation (IN PROGRESS, opened 2026-08-27)** → Phase S — arXiv Submission (NOT STARTED, now gated behind II-A)

Phase II-A progress: tcf-pair corpus **done**; **Ingestion done (2026-08-28)**; **Normalization done (2026-08-29)**; **fragment-scope date inference done (2026-08-29)**; **Synthesis done (2026-08-29)** — the pipeline runs end to end and hits ground truth; **Sections 5, 6, 7, 9 and the abstract rewritten against what ran (2026-08-29)**. Phase II-A is complete.

## Current Milestone

Phase R is closed. `paper/main.tex` + `paper/sections/*.tex` + `paper/main.bib` (37 entries) compile clean under **real pdflatex** (TeX Live 2026, verified 2026-08-26; rebuilt after the formal-consistency and peer-review passes of 2026-08-26/27 — see "Submission readiness" below): 27 pages, 0 overfull/underfull boxes, **0 LaTeX or BibTeX warnings** — the only remaining log line is a pre-existing third-party `algorithm.sty` UTF-8 notice, unfixable from this repo and harmless. Abstract written (187 words, grounded in the finished sections). Both planned figures (TCF timeline, CARTA pipeline) drawn as self-contained TikZ — no external image files. Author/ORCID filled in `CITATION.cff` and `main.tex` (Maitreya Sapariya, Independent Researcher, ORCID 0009-0003-9346-3775). `[CITE-T2]` **resolved**: the architect chose to narrow Section 1's claim to what the archived WhatsApp source actually supports (the restore-account constraint), reframing "no merge operation exists" as the paper's own observation with a pointer to §8.3's tooling survey, rather than an unsupported attribution to WhatsApp — the `\citeTODO`/`\nocite` tripwire removal and the bibliography orphan-check (37 defined = 37 cited = 37 rendered as of the 2026-08-26 passes; 31 at the time of that fix) both confirm the fix is real, not cosmetic. T1 (terminology collision) turned out to already be resolved in `docs/DRAFT_PAPER.md` §2.5 — found during verification, not previously tracked as done. T3 (patent claims) closed as moot — the claim it would have gated was already dropped, and the patent isn't cited in the paper. The Chabot contingency remains **decided, not open**: accepted as a stated limitation. Only the arXiv category is still open, parked for a joint decision at the start of Phase S.

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

### Formal-consistency pass, 2026-08-26 (post-review)

The root convenience copy was found **stale** — dated before commit `46a5641`, so it predated the TCF-definition correction. Rebuilt and replaced; both root and `paper/main.pdf` are now byte-identical (md5 `f7c935c1…`). `paper/arxiv-submission.tar.gz` was regenerated to match the new source.

A scoped formal-consistency pass was then applied against an external review of the 20-page draft. **Ten changes, source-verified before editing:**

1. **`partitioned` → `fragmented`** in Definition 1, and `partition` → `split` in the formal $F_1$/$F_2$ sentence. Both contradicted the paper's own admission that $\delta, \epsilon > 0$ allows $F_1 \cap F_2 \neq \emptyset$ — and §4.2 already polices exactly this word for clusters.
2. **C3's necessary condition separated from WhatsApp's observed restore behaviour.** "No warning, no diff, overwrites" was doing definitional work in both §2.1 and Condition 3; it is now stated separately as an observation about one documented restore path that the definition does not depend on.
3. **Ω's provenance map reconciled with `prov(r)`.** §3.4 claimed the map records "origin device, origin export, origin backup date, and confidence" while the formal tuple is ⟨`source_id`, `line_range`, `sha256`⟩ and Algorithm 1 line 8 assigns exactly that union — a flat contradiction, now resolved in favour of the tuple, with extra fragment metadata described as reachable through `source_id`.
4. **`confidence` deleted from the specification.** It appeared exactly once, undefined, and a confidence score compresses into one number the uncertainty Q and Ω exist to keep explicit.
5. **`SynthesizeCanonicalMessage` declared as the second open parameter**, on the same terms as the clustering procedure: field-wise precedence, deterministic selection among compatible values, conflict descriptor emitted when values are incompatible, rule to be stated by a conforming implementation.
6. **"Canonical" defined** as the deterministic representative under an implementation's declared policy — not globally unique, since open clustering allows conforming implementations to disagree.
7. **`IsAmbiguous` → `HasUnresolvedConflict`**, and the predicate defined: disagreement on a field the similarity criterion does not constrain, judged after the declared rules have run. A cluster of one never satisfies it.
8. **Cross-cluster conflict detection added to Algorithm 1** as line 14, after the loop (it compares canonical records, so it cannot run before every cluster has one). §4.4's "we fold this into the exposition rather than the algorithm" defence is retired. Walkthrough prose renumbered: old line 14 is now line 15.
9. **Corpus date-format count corrected: 3 DMY + 2 MDY**, not 2+2 — `manifest.json` has `date-format-ddmmyy` on fixtures 01/03/05. The old sentence did not account for fixture 5 at all, a residue of a four-fixture corpus.
10. **Ambiguous-date scope stated.** §3.3 now says Normalization judges per record and holds fragment-scope inference outside the stage as a separate declared step; §5.2 reports what the corpus actually shows.

Also: abstract and conclusion "two archives" → "two or more", matching Definition 1 and §1's RQ statements.

**One review item was rejected on evidence.** The review asserted the corpus contains no genuinely ambiguous date record and proposed adding a disclaimer to that effect. Checked against the fixtures: every fixture contains at least one date string whose day and month components are both ≤ 12, and `fixture-03` is 4-of-4 ambiguous with no disambiguating record anywhere in the file. The proposed disclaimer would have been false. The real defect underneath it — unstated quarantine scope — is item 10 above. Three further review items (abstract already says "surveyed here"; latent-case sentence already in the abstract; softening "three necessary conditions") were declined as no-ops or as trading away generality the paper needs.

**Rebuild after the pass:** `pdflatex → bibtex → pdflatex ×2` under the same TinyTeX. **21 pages, 0 LaTeX warnings, 0 BibTeX warnings, 0 overfull/underfull boxes, 0 undefined references.** `rerunfilecheck` reports `main.out` unchanged — converged, no fifth pass needed. Page count moved 19 → 20 → 21 across the last two content passes; the "19 pages" figures in the earlier entries of this file are historical records of those builds and were deliberately **not** rewritten.

**Not done, deliberately:** `docs/DRAFT_PAPER.md` (§ algorithm block, lines ~234–237) and `docs/PAPER_BLUEPRINT.md` (~400–403) still carry the retired `IsAmbiguous` and the pre-pass algorithm. They now contradict `paper/`. Re-syncing them is a separate deliverable, not folded into this pass.

### Peer-review revision pass, 2026-08-26 (`peer-review-report.docx`)

A simulated hostile peer review was supplied as a `.docx` (gitignored; it is input to a revision, not project content). Every checkable claim in it was verified against the source before acting. **Outcome: 26 pages, 0 LaTeX warnings, 0 BibTeX warnings, 0 overfull/underfull boxes, 0 undefined references. Bibliography 37 defined = 37 cited = 37 rendered.**

**The single most important find — Type 3 fonts and broken ligature extraction (review Minor 1).** `main.tex` loaded `[T1]{fontenc}` with no Type 1 font family, so pdfTeX fell back to EC bitmap fonts: **15 Type 3 fonts embedded**, and no ToUnicode map. The page looked fine; the *extracted text* did not. `definition` extracted as `de\x1cnition`, `conflict` as `con\x1dict` — the fi/fl ligatures coming out as raw T1 slots. arXiv full-text search and Google Scholar index that extracted text, so the paper's own keywords were unsearchable. Fixed with one line, `\usepackage{lmodern}`, loaded before `fontenc`. **Verified after: 0 Type 3 fonts, 0 raw ligature slots, every keyword extracting correctly.** This was invisible to every prior build check because the log reports no warning for it.

**Majors acted on.** M3 (reproducibility claim unsupported) was **version skew** — the reviewer's snapshot showed `.gitkeep` placeholders, but the generator (12,930 bytes) and all five fixtures exist and were verified this session. The valid residue was fixed: the repository URL now appears in §5.3 and §9 (it appeared nowhere in the manuscript before), and the determinism claim is now scoped to the runtime it was actually tested on (Node.js v24.14.0, Windows 11) with cross-version stability explicitly *not* claimed. M4 (novelty does not survive the data-integration literature) — added **§8.5, "Data integration, data quality and entity resolution"**, and narrowed the claim in the abstract, §8 preamble and §9 from invention to **transfer**. M5 — Condition 3 restated as a property of the input rather than of a vendor's feature list, with the "undocumented ≠ absent" distinction made explicit in §1. M6 — invariants reframed as **reporting obligations** rather than correctness properties, idempotence **demoted from "Invariant 4"** to a named non-claim, and a new **§3.8 Conformance** checklist added stating what an implementation must declare. M7 — §5.2 relabelled: the 19 categories are **anticipated** input forms, and the fixture-03 discussion is now explicitly a constructed demonstration, not a measurement.

**Six new bibliography entries, every one verified against Crossref or the arXiv API before being written in** (31 → 37): `souibgui2019dataquality`, `moreau2015prov`, `chapman2024finegrained`, `baas2021transitivity`, `saeedi2018famer`, `li2015identity`.

**Two errors found in the review's own citations, and not propagated.** The review gave DOI `10.1016/j.procs.2019.09.013` for Souibgui et al.; that DOI resolves to an unrelated EEG paper. The correct one is `10.1016/j.procs.2019.09.223`, confirmed via Crossref. The review also dated Chapman et al. to 2023; the ACM TODS paper is 2024 (`10.1145/3644385`). Both are recorded in a comment block in `main.bib`.

**Minors fixed:** ligature/Type 3 (1); Wunder first name **Jan → Julia**, confirmed against Crossref, not taken from the review (2); plural authorship on a single-author paper, three places including one introduced during this same pass (3); Condition 3 renamed **Asymmetric → Absent reconciliation** (4); §7.4 written to close the dangling forward reference from §2.1 about fragments that are not internally complete (5); confidence-score position reconciled between §3.5 and §8.3 (6); who sets $\Delta t$ (7); the **$\Delta t \le 60$s constraint** between the two tolerances, which was a genuine latent contradiction — without it the same pair of records could be simultaneously one message and two conflicting ones (8); `Conflict` given a real definition instead of a numbered sentence (9); Table 1 "Data lost forever" → "Data unrecoverable from the snapshot" (10); star counts reframed as dated snapshots in all eight repository entries (11); Kleppmann attributed as of 2019 (12); Figure 1 caption cut from ~150 words to descriptive only (13); §7.1 overclaim deleted (14); zero-dependency trade-off costed (15); **Declarations section added** — funding, competing interests, data availability, AI-use disclosure (16); the closing line promoted into the abstract (18).

**Not done — the architect's calls, not mine.** M1 (arXiv CS content-type risk: implement / journal-first / restructure) and M2 (endorsement outreach) are strategy and outside-world actions. Minor 17 (restructuring the abstract to lead with the contribution) interacts with M1 and was left. The platform-affordance probe M5 recommends is real primary evidence nobody can fabricate; its absence is now **recorded as a stated limitation in §7.5** rather than glossed.

**Two live submission blockers, both flagged in the source as comments:** (1) `origin/main` is **8 commits behind** local, so the repository URL now printed in the paper does not yet show the artefact it points at — push before posting; (2) the AI-use disclosure in `main.tex` is a **draft written from what this repo records** and must be confirmed or corrected by the author before submission.

Still not re-synced: `docs/DRAFT_PAPER.md` and `docs/PAPER_BLUEPRINT.md`, which now diverge from `paper/` more than they did after the previous pass.

### Second review round, 2026-08-26 — the unpushed-corpus trap

The reviewer checked the repository URL the paper now prints and reported that §5.2's fixture-03 claim was false: five distinct dates, three of them disambiguating. **They were reading GitHub. GitHub is eight commits behind local, and one of those commits is `87e489b`, which regenerated the corpus.**

| | fixture-03 distinct dates | disambiguating |
| --- | --- | --- |
| GitHub (`origin/main`, stale) | 08, 11, 13, 14, 18 Jan | 3 |
| Local `HEAD` (current) | 08, 09, 10, 11 Jan | 0 |

§5.2 is **correct against the tree that will be published** and wrong against the tree published today. Same cause for their `CITATION.cff` finding: GitHub's copy has empty `given-names`/`family-names`/`orcid`; the local copy has been fully populated since unpushed commit `be92a41`. **Neither is a paper defect. Both become false the moment `git push` runs, and stay true only if it does.** This is now the highest-priority action in the project — the paper's own URL currently points at a tree that contradicts it.

**Five other findings verified as genuine errors of mine, all introduced by the previous pass, all fixed:**

1. §7.4 opened by citing `sec:tcf:definition` (§2.1) for internal completeness, which is defined in §2.2. Retargeted to `sec:tcf:conditions`.
2. §4.1 called the conflict bucket "fixed at one minute" and then required implementations to widen it — a direct contradiction I introduced when closing Minor 8. It is now a declared parameter $\Delta t_{\text{conflict}}$ with a stated default of one minute.
3. §4.1 justified that default as "the coarsest quantum observed in the export formats surveyed in §5.2" — but the same pass had just made §5.2 disclaim being a field survey. Fixing Majors 7 and Minor 8 separately created a circular justification. Regrounded on the target format's resolution, with the survey claim withdrawn explicitly.
4. Equation (12) and §3.8's conformance list updated to the parameterised bucket; the tolerance relation is now Equation (13), $\Delta t_{\text{granularity}} \le \Delta t_{\text{conflict}}$.
5. `gudjonsson2010log2timeline` used `\dj` (d with stroke) where the Icelandic name takes `\dh` (eth). Corrected — and the fix initially broke the entry, because I put the explanatory `%%` note *inside* the braces. BibTeX has no in-entry comment syntax and silently voided all six fields. **`main.bib`'s own header comment, lines 32--36, already documents this exact hazard.** Note moved above the entry.

**The overlap gap, also confirmed and closed.** `actual_problem.md` states the F12 "effectively started with a new WhatsApp history", so the motivating incident is $\delta = \epsilon = 0$ — no overlap — while §1 asserted overlap among the three properties making the problem hard and §3.4 grounds deduplication in it. §2.2 now names the boundary case explicitly, states that the motivating incident is it, and argues where $\delta > 0$ comes from in general (a secondary restored from a pre-$t_f$ backup inherits history the primary also holds; use of the secondary after $t_r$ gives $\epsilon > 0$). §1 softened to "may overlap", and §3.4 notes the disjoint case falls out as all-singleton clusters with no special-casing.

**One reviewer claim rejected on evidence.** They report Li \& Wang's second author as "G. Alan Wang". OpenAlex does normalise the display name that way, but the article's own byline on the publisher's page is "Alan G. Wang", which is what the entry follows. Citing the published byline is correct practice; left unchanged.

**Verified after all of the above:** 26 pages, 0 LaTeX warnings, 0 BibTeX warnings, 0 overfull/underfull, 0 undefined references, 37 defined = 37 cited = 37 rendered, 0 Type 3 fonts, 0 raw ligature slots, eth rendering correctly in extracted text.

### Corpus claims made checkable, 2026-08-27

The reviewer's structural recommendation — derive §5.2's corpus counts from a committed script rather than asserting them as prose — is now done. **New artefact: `scripts/check-corpus-claims.js`** (Node, no dependencies, matching the generator's conventions). It reads the committed fixtures and `manifest.json`, derives every count §5.2 states, prints a per-fixture table, and **exits non-zero if the paper and the corpus disagree**, naming which claim broke.

Against the current corpus all six claims pass. **Against GitHub's stale corpus it fails with exit 1 on exactly the two claims the reviewer challenged, and reproduces their table figure for figure** — which is the demonstration that the tool works and that their numbers were `origin/main`'s, not a reading error:

| fixture | local (distinct/ambig/disambig) | GitHub stale |
| --- | --- | --- |
| 01 self-chat | 6 / 3 / 3 | 6 / 3 / 3 |
| 02 double-filename | 6 / 2 / 4 | 6 / 2 / 4 |
| **03 group/encryption** | **4 / 4 / 0** | **5 / 2 / 3** |
| 04 multiline | 4 / 2 / 2 | 4 / 2 / 2 |
| 05 early-creation | 5 / 2 / 3 | 5 / 2 / 3 |

Only fixtures 01 and 03 differ from `origin/main` at all (checksum-compared file by file), and only 03's counts differ — which is why the reviewer's table looked so credible: four of its five rows are correct against both trees.

Paper updated to match: §5.3 and §9 now describe **two** runnable artefacts rather than one, §5.3 records why the checker exists (a hand-written prose claim about generated output is the same failure mode the paper argues against everywhere else), and §5.2 states outright that its counts are derived by the script rather than asserted. **27 pages, 0 LaTeX warnings, 0 BibTeX warnings, 0 overfull/underfull, 0 undefined references, 0 Type 3 fonts.**

**Push remains outstanding and is the architect's own action, by their decision.** Until it runs, the URL printed in §5.3 and §9 points at a tree whose fixture-03 contradicts §5.2, and `CITATION.cff` there still mints a blank author. The `%% SUBMISSION BLOCKER` comment in `05_implementation.tex` stays until then.

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
