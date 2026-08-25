# Academic Paper Blueprint & Formal Notation

**Working Title:** *When Chats Split Apart: Formalizing Temporal Communication Fragmentation and the CARTA Reconstruction Framework* (revised 2026-08-24, then finalized 2026-08-24 — "Deterministic Reconstruction" dropped as an unearned capability claim; "CARTA Reconstruction Framework" is safe because reconstruction is CARTA's designed purpose (it's in the acronym), not a claimed achievement of this paper; see memory: `paper-honesty-checkpoint`)  
**Target Category:** arXiv preprint (`cs.DL` Digital Libraries / `cs.SE` Software Engineering / `cs.DC` Distributed Systems)  
**Artifact Purpose:** Establish the complete theoretical formalization, section-by-section prose blueprint, algorithm definitions, and empirical validation plan prior to core engine implementation.

---

## 1. Executive Summary & Research Thesis

### 1.1 The Research Problem
Modern mobile instant messaging platforms (e.g., WhatsApp, Signal, Telegram) restore chat history via a destructive, exclusive-choice operation: restoring a backup replaces the device's current chat state rather than merging into it. When a user experiences primary device failure (e.g., hardware crash, repair, battery drain), temporarily continues communication on a secondary or loaned device, and subsequently recovers the primary device, the user's communication timeline splits into two independently persistent, non-synchronized archives, each individually complete for its own interval. No platform-native action combines them — the user must choose one to continue with. *(A single-slot, last-write-wins cloud backup architecture is one plausible explanation for this behavior; it is an unverified hypothesis, not a claim of this paper — see Definition 2.)*

We term this failure mode **Temporal Communication Fragmentation (TCF)**. The signature of TCF is not the physical destruction of data, but the **platform-enforced inaccessibility of a fully intact, independently persisted communication archive**.

### 1.2 The Proposed Solution
We propose **CARTA (Chat Archive Reconstruction & Temporal Access)**, a platform-agnostic, three-phase formal framework for deterministic, lossless, and auditable reconstruction:
$$\mathcal{F} \xrightarrow{\mathcal{I}} \mathcal{R} \xrightarrow{\mathcal{N}} \mathcal{R}' \xrightarrow{\mathcal{S}} (\mathcal{U}, \Omega)$$
where $\mathcal{U}$ is the unified chronological archive and $\Omega$ is a structured, mathematically auditable reconstruction report preserving provenance, ambiguity, conflicts, and quarantined records.

We describe **CHAMP-Pipeline**, a planned open-source, zero-dependency implementation of CARTA for heterogeneous WhatsApp exports. As of this writing, `core/src/{ingestion,normalization,synthesis}/` are unimplemented — no such demonstration currently exists (see repo `STATE.md`).

---

## 2. Formal Mathematical Notation

Let an instantaneous communication universe over discrete time $\mathbb{T}$ be defined as follows:

### 2.1 Message & Ground-Truth Timeline Definition
A message $m$ is a 5-tuple:
$$m = \langle t, s, b, a, e \rangle$$
where:
* $t \in \mathbb{T}$ is the creation timestamp (with timezone $\tau$).
* $s \in \mathcal{S}_{\text{participants}} \cup \{\bot_{\text{system}}\}$ is the sender identity.
* $b \in \Sigma^*$ is the message text body (possibly empty).
* $a \in \mathcal{A} \cup \{\emptyset\}$ represents attachment metadata (file kind, serial, extension, checksum).
* $e \in \mathcal{E} \cup \{\emptyset\}$ represents system/lifecycle events (encryption notice, membership change, group creation).

A ground-truth communication history $\mathcal{T}$ between participants over an interval $[t_0, t_{\text{end}}]$ is a totally ordered sequence:
$$\mathcal{T} = \langle m_1, m_2, \dots, m_N \rangle \quad \text{such that } t(m_i) \le t(m_{i+1}) \; \forall i$$

---

### 2.2 Formalization of TCF

Let device failure occur at time $t_f$ and primary device recovery occur at $t_r$ ($t_0 < t_f < t_r < t_{\text{end}}$).

#### Definition 1 (Bifurcation Operator $\mathcal{B}$)
The bifurcation operator splits $\mathcal{T}$ into two device-bound fragments $F_1$ (primary device) and $F_2$ (secondary device):
$$F_1 = \{ m \in \mathcal{T} \mid t(m) \le t_f \lor t(m) \ge t_r \}$$
$$F_2 = \{ m \in \mathcal{T} \mid t_f - \delta \le t(m) \le t_r + \epsilon \}$$
where $\delta \ge 0$ represents pre-existing local chat history on device 2, and $\epsilon \ge 0$ represents the lag before account migration back to device 1.

#### Definition 2 (Destructive Restore Semantics $\mathcal{O}_{\text{restore}}$)
The defining, citable behavior: restoring a backup onto a device replaces the device's current chat state; it does not merge. Let $F_1$ be the primary device's archive and $F_2$ the secondary's.
$$\text{Restore}(F_i) \implies \text{device state} \leftarrow F_i, \quad \text{with no combination of } F_1 \text{ and } F_2$$
$$\text{Data Loss Window } \Delta \mathcal{W} = F_2 \setminus F_1 = \{ m \in \mathcal{T} \mid t_f < t(m) < t_r \}$$
$\Delta \mathcal{W}$ remains fully intact only in un-synced, locally-exported files $\mathcal{F} = \{F_1, F_2, \dots, F_n\}$ — inaccessible through the platform's own restore affordance, not destroyed.

*Mechanism disavowed 2026-08-24:* an earlier draft of this definition asserted a specific backend cause — a single-slot, last-write-wins cloud storage slot $\mathcal{C}$ silently overwritten by whichever device backs up last: $\mathcal{C} \leftarrow \text{Backup}(F_2)$, then $\mathcal{C} \leftarrow \text{Backup}(F_1)$, giving $\mathcal{C}_{\text{final}} = \text{Backup}(F_1)$. That mechanism has no citation, controlled experiment, or WhatsApp documentation behind it and is **not** a claim of this paper (see memory: `carta-lww-mechanism-not-evidenced`). Only the observable restore behavior above is asserted.

---

### 2.3 The CARTA Reconstruction Algebra

$$\mathcal{F} = \{F_1, F_2, \dots, F_n\} \xrightarrow{\mathcal{I}} \mathcal{R} \xrightarrow{\mathcal{N}} \mathcal{R}' \xrightarrow{\mathcal{S}} (\mathcal{U}, \Omega)$$

#### Phase 1: Ingestion ($\mathcal{I}$)
$$\mathcal{I}: F_k \mapsto R_k = \langle r_{k,1}, r_{k,2}, \dots, r_{k,M_k} \rangle$$
Each ingested record $r_{k,j}$ captures the raw text slice $\sigma$, raw timestamp string, raw sender token, message category, and explicit provenance metadata:
$$\text{prov}(r_{k,j}) = \langle \text{source\_id}: F_k, \text{line\_range}: [\ell_{\text{start}}, \ell_{\text{end}}], \text{sha256}: h(F_k) \rangle$$
*Invariant:* $\mathcal{I}$ is non-lossy and non-destructive. No content filtering or cross-file reconciliation occurs in Ingestion.

#### Phase 2: Normalization ($\mathcal{N}$)
$$\mathcal{N}: R_k \mapsto (R'_k, Q_k)$$
For each record $r \in R_k$:
* If $r$ conforms to canonical parsing grammar **unambiguously** (valid date/time format with a single valid interpretation, valid UTF-8, resolvable sender/system token), produce canonical record $r' \in R'_k$ with UTC epoch timestamp $t_{\text{utc}} \in \mathbb{R}$, normalized sender identity $s \in \mathcal{S}$, and typed payload.
* If parsing fails outright, **or $r$ is syntactically parseable but ambiguous** (e.g., a date string valid under more than one locale convention, with nothing in the record itself to disambiguate — such as `03/04/24`), $r$ is routed to the Quarantine Set $Q_k$ with a typed failure reason code $\rho \in \mathcal{P}_{\text{errors}}$, which distinguishes at minimum: `MALFORMED_TIMESTAMP`, `UNSUPPORTED_FORMAT`, `AMBIGUOUS_DATE_FORMAT`, `UNRESOLVED_SENDER`, `INVALID_ENCODING`. Ambiguity is never silently resolved by guessing — an ambiguous-but-parseable record is not normalized. *(Never silently convert uncertainty into certainty.)*

#### Phase 3: Synthesis ($\mathcal{S}$)
$$\mathcal{S}: (\{R'_1, \dots, R'_n\}, \{Q_1, \dots, Q_n\}) \mapsto (\mathcal{U}, \Omega)$$
Let $\mathcal{R}'_{\text{all}} = \bigcup_{k=1}^n R'_k$.
Synthesis computes:
1. **Deduplication (Similarity-Based Clustering):**
   Define a deduplication *similarity relation* $\sim_{\text{dedup}}$ over $\mathcal{R}'_{\text{all}}$ — **not claimed to be an equivalence relation**, since proximity-based criteria are not generally transitive (a chain of near-boundary timestamps can link records that are not themselves within $\Delta t$ of each other):
   $$r'_a \sim_{\text{dedup}} r'_b \iff |t_{\text{utc}}(r'_a) - t_{\text{utc}}(r'_b)| \le \Delta t_{\text{granularity}} \land s(r'_a) = s(r'_b) \land b(r'_a) = b(r'_b) \land a(r'_a) \cong a(r'_b)$$
   Records satisfying this similarity criterion are grouped into **reconciliation clusters**. For each cluster $C \subseteq \mathcal{R}'_{\text{all}}$, a canonical record $u \in \mathcal{U}$ is synthesized whose provenance is the union:
   $$\text{prov}(u) = \bigcup_{r' \in C} \text{prov}(r')$$
   *(The exact clustering algorithm — e.g., transitive closure with a bounded cluster diameter, or connected components on a similarity graph — is an implementation decision deferred to CHAMP-Pipeline's Phase II; this specification fixes the similarity criterion, not the clustering procedure.)*
2. **Chronological Sorting:**
   $\mathcal{U}$ is totally ordered such that $t_{\text{utc}}(u_i) \le t_{\text{utc}}(u_{i+1})$.
3. **Conflict & Ambiguity Detection:**
   For records with identical coarse timestamps ($1$-minute resolution) but incompatible sender/order constraints:
   $$\text{Conflict}(u_i, u_j) \implies \text{flag in } \Omega_{\text{conflicts}}$$
4. **Audit Report ($\Omega$):**
   $$\Omega = \langle \Omega_{\text{provenance}}, \Omega_{\text{quarantine}} = \bigcup Q_k, \Omega_{\text{conflicts}}, \Omega_{\text{stats}} \rangle$$

---

### 2.4 Mathematical Invariants Guaranteed by CARTA

1. **Zero Unaccounted Loss (Completeness):**
   $$\forall r \in \bigcup_{k=1}^n R_k, \quad (\exists u \in \mathcal{U} \text{ s.t. } \text{prov}(r) \subseteq \text{prov}(u)) \;\lor\; (\exists q \in \Omega_{\text{quarantine}} \text{ s.t. } q = r)$$
2. **Strict Provenance Traceability:**
   $$\forall u \in \mathcal{U}, \quad |\text{prov}(u)| \ge 1 \land \forall p \in \text{prov}(u), \; p \text{ references valid source } F_k$$
3. **Determinism:**
   $$\forall \mathcal{F}, \quad \mathcal{S}(\mathcal{N}(\mathcal{I}(\mathcal{F}))) = (\mathcal{U}_1, \Omega_1) \land \mathcal{S}(\mathcal{N}(\mathcal{I}(\mathcal{F}))) = (\mathcal{U}_2, \Omega_2) \implies (\mathcal{U}_1 = \mathcal{U}_2) \land (\Omega_1 = \Omega_2)$$
4. **Idempotent Reconstruction (specification-level target, not yet formally proven against a concrete schema):**
   Applying Synthesis to an already unified, canonical record set together with an identical copy of itself must not introduce additional information loss or unresolved conflicts. A fully type-safe formalization — establishing that $\mathcal{U}$-records are schema-compatible with $\mathcal{R}'$ — is deferred to CHAMP-Pipeline's Phase II implementation, not claimed here.

---

## 2.5 Literature Survey Findings (Living — Phase L second pass completed 2026-08-25)

**Dated summary — 2026-08-25.** Phase L's six kill-shot questions were run as six parallel searches; findings below, each with a real citation or an explicitly scoped negative. **The delta survived, but substantially narrowed, and two prior positions were corrected rather than confirmed.** What changed: (1) finding (a) was *revised* — the "CRDT merge requires a common ancestor" claim is true of the mergeable-RDT line but **false of foundational CRDTs**, which merge two states with no ancestor; the argument that actually excludes TCF is the *zero-synchronization* premise, not ancestry. (2) The claim that chat-archive reconciliation is "previously unaddressed" is **dead** — merging tools ship today, including a 1.4k-star actively-maintained one, and the TCF scenario itself is independently described verbatim in a public repository README. (3) Per-record provenance is **not** novel to CARTA: it is formally defined in forensics as of 2014 (Chabot et al.'s *relation of support*) and implemented per-record in current chat-forensics tooling. What survives is narrower and still defensible: **no specification exists** for reconciliation under partial overlap, and **no artifact found couples reconciliation with provenance, quarantine, conflict reporting, and determinism**. See the revised delta sentence below; the naming contribution also carries an unresolved terminology-collision risk (finding (c)).

**Second-pass corrections, same day (2026-08-25), after review challenged two claims for outrunning their citations — both challenges were correct:** (4) **"every one of them silently drops records it cannot parse" is REFUTED** — verified at source level, the five tools *differ*; `chat-history-manager` aborts the load and `WAMerge` prints a per-record diagnostic. The universal claim that does hold is the quarantine one. (5) **"no prior work stages forensic reconstruction" is REFUTED** — Chabot et al. published a four-layer staged pipeline at IEEE JISIC 2014, so staging is conceded and CARTA's claim narrows to the *formality of the inter-stage contract* plus Q and Ω. Both corrections are recorded in place in findings (e) and (b), with the refuted wording marked so it cannot be reinstated. **The delta is now contingent on two unread Chabot documents** — see the status line.

Six kill-shot questions, each requiring a real citation or a scoped "not found". Confidence is labelled per finding: **full-text-read**, **abstract-level**, or **search-summary-level**.

---

**(a) Does CRDT/offline-sync literature already name "complete-but-unmergeable divergent replicas with destructive resolution"? — No. *(REVISED 2026-08-25 — the first-pass reasoning was partly wrong; see below.)***

No prior naming of this configuration was found in two passes. But the structural gap is not where the first pass put it.

*The mergeable-RDT line does require ancestry, as an axiom.* Kaki et al., *"Mergeable Replicated Data Types"* (PACMPL 3(OOPSLA), Art. 154, 2019; DOI 10.1145/3360580) — **full-text-read**: replicated state is modelled "in terms of concurrently evolving *versions* of a data type that trace their origin to a common ancestor version," merged by "a three-way merge involving a pair of concurrent versions and their LCA version." Soundarapandian et al., *"Certified Mergeable Replicated Data Types"* (PLDI 2022; arXiv:2203.14518) — **full-text-read** — makes it a store precondition: "We assume that execution of the store will begin with a single branch, from which new branches may be dynamically created. Hence, for any two branches, the LCA will always exist." The same holds across adjacent reconciliation literatures: log-based reconciliation takes "a common initial state and logs of actions" (arXiv:cs/0109033, *abstract-level*); versioned-database reconciliation backtracks to "the latest common ancestor D₀" (arXiv:2110.01778, *full-text-read*); formal filesystem synchronization requires the update sequence to be "applicable to the original filesystem Φ" (Csirmaz & Csirmaz, arXiv:2210.04565, *full-text-read*).

*But foundational CRDTs do not require an ancestor, and the first-pass claim over-reached.* Shapiro, Preguiça, Baquero & Zawirski, *"A comprehensive study of Convergent and Commutative Replicated Data Types"* (INRIA RR-7506, 2011) — **full-text-read**: state-based merge is a two-argument least upper bound on a join semilattice, `merge(x, y) = x ⊔ᵥ y`. No ancestor, no base, no history traversal. What it requires instead is that replicas share an object identity, that the payload *itself* be a semilattice element carrying its own causal history, and — decisively — an ongoing channel: convergence holds "assuming the system transmits payload infinitely often between pairs of replicas over eventually-reliable point-to-point channels," and "as long as all replicas receive all updates."

**The correct exclusion argument is therefore TCF's Condition 2 (zero synchronization), not ancestry.** TCF's fragments never exchanged anything during the divergence window, and no synchronizing representation was ever established between them. **⚠ Phrasing constraint for the paper (flagged 2026-08-25):** do **not** write that flat text exports "are not semilattice elements" — that is stronger than the evidence and a CRDT-literate reviewer will find the opening. Nothing structurally prevents treating a message set as a join-semilattice under union *after the fact*; the barrier is the historical fact that no such representation existed while the two branches diverged, so no convergence guarantee was ever purchased. State it as a fact about TCF's history, not as a mathematical impossibility about the data. As Kleppmann et al. put it (*"Local-first software: You own your data, in spite of the cloud"*, Onward! 2019 — **full-text-read**), CRDTs are "multi-user from the ground up" — the guarantee is purchased by designing the representation for replication *before* divergence, which a consumer chat export forecloses. That paper does **not** name TCF-like fragmentation (full text searched for backup/restore/device-failure/legacy: nothing describing two independently-complete archives or destructive restore), and it flags the adjacent case as open: "There is little work to date on understanding the algorithms and programming models for collaboration in situations where multiple document versions and branches exist side-by-side."

*Retrofitting — scoped negative with one near-miss that must be cited, not ignored.* Yu & Ignat *(corrected 2026-08-25 — the author was originally misrecorded here as "Rostad"; verified against Crossref/IEEE Xplore: Weihai Yu and Claudia-Lavinia Ignat)*, *"Conflict-Free Replicated Relations for Multi-Synchronous Database Management at Edge"* (IEEE SMDS 2020, DOI 10.1109/SMDS49396.2020.00021) — **full-text-read** — is genuine retrofit work: "With CRR, existing RDB applications, with very little modification, can be enhanced with multi-synchronous access." But CRR is a ***prospective*** retrofit: it augments the schema with causal metadata *before* divergence. CARTA addresses the ***retrospective*** case, where artifacts already exist and no metadata was ever recorded. Csirmaz & Csirmaz independently characterize why this regime resists OT/CRDT framing at all: "constant, low latency communication in OT and CRDT versus a single data exchange in filesystem synchronization; … small number of differences versus significant structural differences accumulated during an extended time period." TCF is that regime, one degree harder — without even the original state their model presupposes.

*Honest caveat to state in one sentence in the paper:* Git's degenerate no-merge-base case performs a two-way merge against an empty base, which is approximately what CARTA's Synthesis does before dedup clustering. No peer-reviewed treatment of this fallback was found (**search-summary-level**, documentation/blog only) — do not cite it as literature, but acknowledge it so a reviewer does not think it was missed.

---

**(b) Does digital-forensics timeline reconstruction already formalize multi-source, provenance-preserving reconstruction? — Confirmed as the closest neighbour; still not standardized there. *(EXTENDED 2026-08-25 — second source now read; provenance sub-claim corrected.)***

*The field's own systematization.* *"SoK: Timeline based event reconstruction for digital forensics: Terminology, methodology, and current challenges"* (DFRWS 2025, arXiv:2504.18131) — **abstract-level**. Pipeline: Extraction → Normalization → Arrangement → Analysis, with "source combination" (its term for multi-source merging) handled informally. None of provenance / quarantine / conflict detection / deterministic / invariant appear there as formally defined terms.

*The second candidate, now read (the prior "garbled PDF" failure did not recur).* **Identity corrected:** arXiv:1903.01396 is an arXiv posting of a **DFRWS 2014 / *Digital Investigation*** paper — Chabot, Bertaux, Nicolle & Kechadi, *"A complete formalized knowledge representation model for advanced digital forensics timeline analysis"* (approach: **SADFC**; *Digital Investigation* 11(Supplement 2), S95–S105, DOI 10.1016/j.diin.2014.05.009 — corrected 2026-08-25 from the Elsevier PII form previously recorded here, resolved against Crossref). **Cite it as 2014, not as a 2019 preprint.** **full-text-read**, with verified full-text term counts:

- *Pipeline:* **representation-only; the staged pipeline is explicitly deferred by the authors** — "the investigation process model and the architecture will be discussed in details in other documents," and future work will focus on "the precision and completeness of the definition of each step as well as its inputs and outputs." It names four operator families (extraction / mapping / inference / analysis) — roughly CARTA-shaped — but does not type the interfaces or the residues. Its case study uses "a process designed for the need of this paper."
- *Invariants:* **absent.** `invariant` 0, `determinis*` 0, `sound` 0, `trace`/`traceability` 0. Court desiderata (reproducibility, verifiability, integrity) appear as motivation, never discharged as properties.
- *Multi-source merge:* **absent as a mechanism.** `merg*` 0, `reconcil*` 0, `duplicat*` 0, `conflict` 0. The operative verb is "federate," used 3× and never defined: information "should be federated within the same model." It *names* the temporal-heterogeneity problem ("different time zones and unsynchronized clocks… different formats or granularities") and concludes only that "a good handling of all these forms of heterogeneity is required."
- *Ambiguity:* **no quarantine equivalent.** `quarantin*` 0, `ambigu*` 0, `confidence` 0. One real device — interval-valued event times "allow to represent the notion of uncertainty" — confined to the temporal attribute and unlabelled. Its inference operator does the opposite of CARTA's rule: an unknown participant is filled in by heuristic and "the fact participation(13,19) can be added," indistinguishable from extracted fact. It also assumes the problem away: "the assumption that the data has been processed upstream to ensure accuracy and correctness is used."
- *Provenance:* **PRESENT — this corrects a claim CARTA must not make.** Formally defined as the **relation of support** σ_f: "f supports en means that f is used to deduce one or more attributes of en," set-valued, carried through the pipeline, and materialized in the output fact base (`support(x,y)`, 19 occurrences). **"Forensics has no formal notion of per-record provenance" is not a claim this source supports.** The defensible narrower claim: `support` is an id-to-id derivation edge with no locator, no hash, no integrity binding, and no stated invariant requiring it to be non-empty — versus CARTA's byte-addressable, hash-bound provenance (source id + line range + sha256) *plus* an invariant over it.
- *Audit report:* **absent.** `audit` 0. Output is a human-read enriched timeline.

***The deferred follow-on work, now traced (2026-08-25) — this narrows the claim.*** The 2014 DFRWS paper deferred its Investigation Process Model to "other documents." Those were located by enumerating Chabot's complete output across three independent indexes (HAL author API, 27 records; UCD DSpace, 7 records; arXiv API, 1 record). **No document titled or subtitled "investigation process model" exists in any of them** — the deferred content surfaced instead as an architecture paper and a thesis.

**The architecture paper matters, and CARTA must concede a point to it.** Chabot, Bertaux, Nicolle & Kechadi, *"Automatic Timeline Construction and Analysis for Computer Forensics Purposes"* (title corrected 2026-08-25 — "and Analysis" was previously omitted here), IEEE JISIC 2014, DOI 10.1109/JISIC.2014.54 — **full-text-read** — publishes a four-layer staged pipeline (**Extraction → Semantic → Reasoning → Interface**) that performs reconstruction "from the extraction of data to the analysis of the timeline produced through the construction and the storage of the latter," with a per-source parser bank and an explicit normalization boundary: normalization "aims to solve heterogeneity problems by **translating data produced by the extraction layer in the format used by the upper layer**."

⚠ **Consequence: "no prior work stages the reconstruction process" is FALSE and must never be written.** Staging a forensic reconstruction pipeline is not novel to CARTA; it was published in 2014.

*What that paper still does not do* (**full-text-read**, scoped to this paper): the inter-stage format "is never named or typed" — no signatures, no pre/post-conditions, no invariant over any stage; completeness is attributed to Gladyshev & Patel rather than claimed or discharged, and no determinism claim appears. `merge`, `reconcile`, `fusion`, `duplicate`, `conflict`, `contradiction` **do not appear at all**. Its correlation operator "quantif[ies] the correlation between two events" without collapsing them. Unparseable and irrelevant records are *discarded to shrink the working set* — "all data extracted from footprints are not relevant for an investigation, therefore, they need to be filtered in order to reduce the amount of data to be process by the upper layer" — the opposite of quarantine. Terminal outputs are a queryable triple store plus a visualisation/query/settings UI; no report, no statistics block, no conflict log. The EGC 2014 short paper (hal-00941150, **full-text-read**, French) confirms the three ontology layers and shows the *Provenance Knowledge Layer* is a region of the knowledge base recording investigator actions — **not** a generated audit artifact.

**⚠ RESIDUAL RISK — NOT CLOSED. Do not record "no prior formal pipeline contract exists" as settled.** Two documents could not be obtained: (i) the **ORD2I** paper body — correct title *"An ontology-based approach for the reconstruction and analysis of digital incidents timelines"*, *Digital Investigation* **15** (Dec 2015) 83–100, DOI 10.1016/j.diin.2015.07.005 (**abstract + introduction + conclusion read only; body paywalled**), whose abstract announces "**seven necessary criteria that an efficient reconstruction tool must meet**" — the one place in the lineage something invariant-shaped might be stated *and discharged*; and (ii) **Chabot's 2015 PhD thesis** (Université de Bourgogne / UCD *cotutelle*, NNT **2015DIJOS037**), whose abstract advertises "des fondations théoriques garantissant la crédibilité des résultats produits par les outils via une **définition formelle et rigoureuse des processus utilisés**" — the single most likely home of a fuller process model. Thesis retrieval failed on every automated route (theses.fr → `ged.ube.fr` 403; no HAL/TEL deposit; not in UCD DSpace; no Wayback snapshot; CORE/OpenAIRE no OA copy). ResearchGate lists it as full-text-available on the author's profile — that is the live lead, and it needs a manual download or a library request. **If the thesis defines typed stage inputs/outputs, CARTA's residual claim reduces to Q and Ω alone, and the paper must say so plainly rather than defending the pipeline framing.**

*Net:* two independent forensics sources, eleven years apart, both name multi-source combination as a requirement and neither specifies the operation. That is a defensible gap claim. **Framing risk to handle explicitly:** Chabot's "correlation" (pairwise event-relatedness scoring) is superficially adjacent to CARTA's similarity-based dedup clustering; the purposes are opposed (surface links between *distinct* events vs. collapse redundant representations of *one* event), but a skimming reviewer will see "similarity score over event pairs" twice.

---

**(c) Has this exact phenomenon already been formally named? — No name found for the composite; but a real terminology collision exists. *(NEW 2026-08-25.)***

**Scoped negative:** across 19 recorded queries spanning distributed systems, mobile/file-system replication, digital forensics, digital preservation/archival science, PIM, CSCW/HCI and grey web, **no paper, standard, or reference work was found defining a term for "two complete, independently-persisted archives of one logical account, rendered mutually inaccessible by a restore that replaces rather than merges."** (**search-summary-level.**) Closest hits each name a *component* — divergence, conflict, reconciliation, fragmentation — never the composite with the destructive-restore crystallization step.

**Consequence for how the claim must be phrased:** every one of TCF's three conditions already has a name. The defensible claim is "no prior work names the *conjunction* as a phenomenon in the consumer-messaging setting" — **not** "no prior work addresses these ideas."

*Nearest misses, for Related Work:*
- **Coda — the closest structural analogue.** Kistler & Satyanarayanan, *"Disconnected Operation in the Coda File System"*, ACM TOCS 10(1):3–25, 1992 (**search-summary-level**): same pause → independent updates → merge shape, with "reintegration" and "local–global conflict" as named steps. Decisive difference: Coda *attempts* reintegration and *flags* conflicts for manual repair.
- Saito & Shapiro, *"Optimistic Replication"*, ACM Computing Surveys 37(1):42–81, 2005, DOI 10.1145/1057977.1057980 (**abstract-level**): names divergence and conflict as first-class — "Optimistic replication faces the unique challenges of diverging replicas and conflicts between concurrent operations" — but presumes a system that intends to reconcile.
- Parker et al., *"Detection of Mutual Inconsistency in Distributed Systems"*, IEEE TSE SE-9(3), 1983 — the formal ancestor of "two copies diverged"; detection-focused.
- **Split-brain** — cluster/HA terminology only; no extension to consumer single-account backups was found.

**⚠ Terminology collision (unresolved, flagged for decision — not silently fixed).** The bare phrase "Temporal Communication Fragmentation" returns zero prior uses, but **"temporal fragmentation" is already established** in time-geography/ICT for the splitting of *activities* across times and places — Hubers, Schwanen & Dijst, *"ICT and Temporal Fragmentation of Activities"*, *Tijdschrift voor Economische en Sociale Geografie* 99(5):528–546, 2008 (**search-summary-level**). Separately, "fragmented communication" in workplace/CSCW usage denotes *one conversation spread across many channels* — precisely what TCF is **not**. No competing definition of the *same* phenomenon, so this is naming hygiene rather than priority — but it will mislead readers twice over, and the label is the weakest link in the naming contribution.

**Destructive restore is itself already named prior art.** US Patent 8,151,139 B1, *"Preventing data loss from restore overwrites"* (filed 2009-03-27, granted 2012-04-03; Symantec → Cohesity) — verified directly: "restoring the version often involves copying the version to a working copy, which overwrites (and destroys) data stored in the working copy." **"Destructive restore is an unrecognized hazard" is not claimable.** TCF's delta must live in the composite, not in the destructive-restore step alone. *(Unverified: whether the patent's "restore backup" constitutes a second independently-accumulated timeline — a summarizer said yes; reading the quoted mechanism it appears to be a rollback diff of the pre-restore working copy, which is not the same thing. Needs a proper claims read; if it does, the delta narrows materially.)*

*Grey-literature corroboration, explicitly labelled:* Borrill, *"Why iCloud Fails: The Category Mistake of Cloud Synchronization"*, arXiv:2602.19433 (submitted 2026-02-23, v3 2026-03-07) — ID verified to resolve; **unrefereed single-author preprint that advocates the author's own proposed protocol**. Documents destructive-restore-over-divergent-state ("The 'correct past' that Time Machine preserved can be destroyed by the subsequent sync") and a 366 GB divergent-archive reconciliation done with ad-hoc MD5 scripts. **Usable only as corroborating evidence that the failure mode occurs in the wild; never as authority, never load-bearing.**

*Vendor confirmation of the no-merge affordance:* WhatsApp support guidance, quoted via third-party documentation: "It's not possible to merge different backup files. Each backup file is linked to a unique WhatsApp account and can only be restored by that specific account." (**search-summary-level — must be replaced by a direct WhatsApp FAQ citation before the paper relies on it.**)

---

**(d) Does Plaso/log2timeline — the reference "super timeline" tool — already provide this? — No formal claims; but its quarantine analogue is stronger than assumed. *(NEW 2026-08-25.)***

Scope of this finding: 5 documentation pages, 6 source files, and a mechanical sweep of **all 53 `.md` files under `docs/` in `log2timeline/plaso@main`** (**doc-read**). Not read: `plaso/storage/`, the linked architecture drawing, the GitHub wiki, the SANS PDF body.

- *Provenance:* **carried, but explicitly not a specification.** `EventData.SCHEMA` has `_parser_chain`; `EventDataStream.SCHEMA` has `path_spec` + md5/sha1/sha256; population is unconditional in `parsers/mediator.py`. But Plaso's own docs disclaim the schema: "Note that event data is currently free form. **Work is in progress to make a more formal specification.**" (Scribbles-about-events) — the single most quotable line for the paper.
- *Determinism:* **no documented property.** `determinis*`, `invariant`, `reproducib*` produce zero substantive hits across all 53 docs files. One implementation comment exists ("The export event heap is used to make sure the events are sorted in a deterministic way"), covering the *output* stage only; extraction-stage ordering across N workers is undocumented. **State this as "Plaso makes no determinism claim," not "Plaso is nondeterministic."**
- *Quarantine:* **the narrowest point of the delta — credit it accurately.** Plaso defines **five typed, schema'd, serialized warning containers** (`AnalysisWarning`, `ExtractionWarning`, `PreprocessingWarning`, `RecoveryWarning`, `TimeliningWarning`) retained in the storage file and queryable via `pinfo --sections warnings`; event data also carries in-band `_corrupted` / `_recovered` flags. **Do not claim Plaso "just logs warnings" — that is false and a Plaso-literate reviewer will catch it.** The surviving distinction: warnings are **not part of the timeline output contract** — `_ExportEvents` iterates only `GetSortedEvents`, so the artifact an analyst works from contains no representation of what failed.
- *Ambiguity:* **guesses silently.** `--timezone` is optional: values without a zone indicator are inferred "based on the source data where possible otherwise it will default to UTC," with no per-event flag recording that a zone was assumed. `ambigu*` appears 0 times in all 53 docs files. Two mitigations to credit: `DateLessLogHelper` models date ambiguity with an explicit range + granularity enum, and "dynamic time" preserves source granularity.
- *Deduplication / reconciliation:* **concatenates, then suppresses exact duplicates — and provably cannot reconcile across sources.** Suppression requires equality of `timestamp_desc` *and* `event_values_hash`, scoped within a single timestamp bucket; `CalculateEventValuesHash` folds the data stream's `path_spec.comparable` into the hash, and `ProduceEventData` always supplies that stream. Therefore the same event observed in two *different* sources hashes differently and is never collapsed. No canonical-record construction exists in `output_engine.py`. `reconcil*` appears 0 times in the docs corpus. Dedup is also a *default*, not a contract (`psort -a` disables it).
- *Conflict detection:* **absent.** `conflict` appears in the docs corpus only in Python-packaging troubleshooting.
- *Audit report:* **split and partial.** Structured for warnings; for dedup drops there is only a scalar counter ("Duplicate Removals : 23157") — which events were suppressed, and which record absorbed them, is never recorded.
- *Formal claims:* **none.** The design pages are self-described as provisional ("This page contains some scribbles about events"; Internals §Storage is three TODO lines). The origin paper — Guðjónsson, *"Mastering the Super Timeline With log2timeline"*, SANS/GIAC GCFA Gold, 2010 — is a practitioner methodology paper: it presents "a framework, built to parse different log files and artifacts and produce a super timeline in an easy automatic fashion" (**search-summary-level**, landing page + abstract only).

**⚠ One unresolved seam:** `Using-psort.html` asserts cross-VSS-store duplicate removal, which the hash argument above says should not happen. Either that paragraph is stale or there is a storage-layer normalization not read. **Marked INCONCLUSIVE — do not build a paper claim on the VSS case; build it on the hash/path_spec chain, which is unambiguous.**

---

**(e) Has chat-backup reconstruction already been demonstrated — in literature or in shipped tooling? — Literature: no. Tooling: YES, and this is the finding that most narrows the contribution. *(NEW 2026-08-25.)***

*Literature half — scoped negative.* Every WhatsApp/Signal/Telegram forensics paper found operates on **one acquisition at a time**; "reconstruction" there means intra-device artifact correlation, not multi-archive reconciliation. Canonical reference: Anglano, *"Forensic analysis of WhatsApp Messenger on Android smartphones"*, *Digital Investigation* 11(3):201–213, 2014, DOI 10.1016/j.diin.2014.04.003 (**abstract-level**) — its reconstruction claim is explicitly intra-device: artifacts "can be correlated together to infer various types of information that cannot be obtained by considering each one of them in isolation." A 2025 SLR over the whole secure-IM forensics field (*ACM Computing Surveys*, DOI 10.1145/3727641, **abstract-level**) shows no merging/reconciliation category in its taxonomy. **Bounded by the six recorded literature queries; Elsevier/Springer full texts were paywalled and DFRWS proceedings are poorly indexed in the corpora searched.**

*Tooling half — the claim of novelty is refuted.* (All **repo-README-read**, high confidence on claims, unverified on implementation.)
- **`bepaald/signalbackup-tools`** — 1,392★, last push 2026-08-22, actively maintained. Merges two Signal backups (`--importthreads ALL --source …`). **Merges, but explicitly refuses dedup:** "This function does not automatically discard duplicate messages. If the backups you are merging contain (partly) the same messages… you will probably want to crop the source backup by date before merging." No provenance, no conflict reporting; unparseable/unknown records "skipped" as documented behaviour. **Simultaneously the strongest prior art against novelty and the strongest evidence for the surviving delta** — the most popular chat-merge tool in existence pushes partial overlap back onto the user as a manual date-crop.
- **`natario1/whatsapp-database-merger`** — 78★, abandoned (last push 2022-11-25). Merges decrypted `msgstore.db` at SQLite level with real referential-integrity work; dedup only incidental via unique constraints; **unparseable records silently dropped by design** ("the merger will simply drop thumbnails that it was not able to copy"). Author's retirement note is itself an argument for a platform-agnostic spec: "the database schema can change very quickly."
- **`tarikab7/whatsapp-chat-merger`** — 1★, MIT, last push 2026-06-22. **Functionally the nearest neighbour to CARTA's stated target**: "a single-file, client-side web app to import, merge, and browse multiple WhatsApp chat exports in a unified timeline," claiming "Smart Merge… with automatic deduplication," identity merging, and per-source colour tags. No conflict reporting, no quarantine, no determinism or audit claims. **Source-code-read 2026-08-25** (upgraded from README-level): the repo carries two independent implementations. Unparseable input is **silently dropped** — `public/chat-merger.html`'s parser ends `return messages.filter(function(m2){return m2.timestamp>0});`, discarding every date-unparseable message with no warning, count, or UI surface; both implementations also discard non-matching lines preceding the first valid header via an `if (currentMessage)` with no `else`. Its `ParseResult` type has no `errors`/`skipped` field. *Dedup predicate, now determined:* `src/lib/whatsapp-parser.ts` keys on `⌊timestamp/2000⌋:sender:lowercased-trimmed-body[0:200]` — **2-second bucket flooring makes it boundary-sensitive and not stable under a uniform time shift** (two identical messages 1 ms apart can straddle a bucket edge and escape detection, while two 1999 ms apart inside one bucket are caught); `public/chat-merger.html` uses exact string match on sender+timestamp+text+media, deterministic. Both *mark* duplicates rather than removing them. **This is a useful concrete example for the paper of an undocumented, non-deterministic dedup predicate in the wild — but verify independently before citing it as such.**
- **`frozenspider/chat-history-manager`** — 2★, MIT. Closest to CARTA's platform-agnostic framing: one normalized schema across Telegram/WhatsApp (db *and* text exports)/Signal/others — literally Ingestion→Normalization in shape. Dedup partial and honestly caveated ("Best effort is made to get rid of them, but the side effect is that it might also remove 'legitimate' duplicates") — i.e. a practitioner statement of exactly the false-positive hazard CARTA's design must address.
- **`EkriirkE/WAMerge`** — 4★. **Its README is an independent, first-person statement of the TCF scenario**: "I had to reset my main phone, and in the meantime I used my old phone… I got my normal phone back up and whatsapp logged in and the pre-reset-history was there but NOTHING from the time on my other device." **Double-edged: strong evidence TCF is real and independently encountered; fatal to any claim the problem is unrecognized.**
- *Capability prior art in adjacent formats:* `ragibson/SMS-MMS-deduplication` (32★, active) is the most rigorous dedup-semantics work found anywhere — enumerating attachment-presence, country-code, ms-vs-s precision and malformed-encoding cases, "taking extreme care not to identify any false positives." **A reviewer could reasonably say CARTA's dedup contribution is this, ported.** `SecurityRonin/chat4n6` (39★) already does per-record provenance in chat forensics — "tags every recovered record with its evidence source and confidence score" and produces structured reports — but single-acquisition, no merge.
- *Parsers/viewers (abundant, none merge):* `KnugiHK/WhatsApp-Chat-Exporter` (1,203★), `Pustur/whatsapp-chat-parser` (219★), and others. *Commercial:* MobileTrans, PanFone, Syncios, iMyFone all market WhatsApp backup merging (**search-summary-level**, vendor pages, capabilities unverified).

**What this kills:** any claim that merging chat archives is novel, unattempted, or unsolved; any claim that the TCF problem is unrecognized; any implication that WhatsApp text exports are an unmerged format.

**What survives:** (1) no *specification* exists — every artifact is an implementation, mostly single-author, several abandoned, all schema-coupled to one platform version; (2) partial overlap is refused, or resolved by undocumented heuristic, or handled only at the SQL-constraint level; (3) no tool couples merge with provenance (chat4n6 tags but doesn't merge; the mergers don't tag); (4) **quarantine is unimplemented anywhere — this is the one property that holds 5-for-5**, and it is the claim to lead with; (5) no audit report and no determinism guarantee in any merging tool found.

**⚠ Correction, 2026-08-25 — an earlier version of this summary and of the delta sentence claimed "every one of them silently drops records it cannot parse." That is REFUTED and must not be reinstated.** Parse-failure handling was verified per-tool at source level; the tools differ, and two of the five do *not* drop silently:
- *Silently drops (3 of 5):* `signalbackup-tools` and `whatsapp-database-merger` (README-level, per the quotes above), and `tarikab7/whatsapp-chat-merger` (**source-code-read** — see the filter call quoted above).
- *Warns, then skips (`EkriirkE/WAMerge`):* unresolvable records print a per-record diagnostic before being skipped — `print(f"Could not resolve A.message.key_id={bm['key_id']}")` — so the skip is **visible, not silent**. No aggregate count is produced, and it is stdout-only. Separately, unimplemented record *types* (polls, payments, message types 7 and 11) are omitted by never being queried — unimplemented scope, not parse failure, and not evidence for a dropping claim.
- *Aborts the load (`frozenspider/chat-history-manager`) — the direct counter-example:* unknown message types propagate an error rather than vanishing — `FromPrimitive::from_i32(msg_tpe).with_context(|| format!("Unknown message type ID: {msg_tpe}"))?` — malformed text exports `bail!("File does not start with a timestamp as expected")`, unknown attachment types `bail!("Unknown file type: {}", filename)`, and deliberate skips are announced via `log::warn!`. **Citing this tool as a silent dropper would be a factual error a reviewer could check in one file.**

The lesson to carry into drafting: *"no quarantine"* and *"silently drops"* are different claims. The first is universal across the surveyed tools and is what CARTA's contribution actually rests on; the second is not, and stating it cost nothing to fix here but would have been a refutable overreach in the manuscript.

**Additional exposure:** arXiv:2606.11565, *"A Deterministic Forensic Preprocessing Framework for Heterogeneous Network Datasets"* (**abstract-level**) — near-identical *shape* to CARTA one domain over ("Incompatible schemas and timestamp formats hinder evidence correlation and timeline reconstruction, while current ad hoc approaches offer no mechanism to verify consistency across runs"). **Needs an explicit differentiation paragraph, not just a citation.**

---

**(f) Does HCI / personal-information-management already cover this? — Nothing closer found; but one established term must be cited and distinguished. *(NEW 2026-08-25.)***

**Scoped negative:** no HCI/CSCW study was found describing two independently-persistent, each-individually-complete archives of one account arising from device failure + secondary-device use + restore. Everything found describes either *one timeline moved or lost*, or *scattered-but-reachable items*.

**⚠ The reviewer risk, and it is material.** "**Information fragmentation**" is an established PIM term, and it is **broader than previously assumed** — post-2008 usage routinely includes fragmentation *across devices*, not only across applications. Canonical definition, Karger & Jones, *"Data unification in personal information management"*, CACM 49(1):77–82, 2006 (**full-text-read**, book-chapter version): "This information is fragmented by the very tools that have been designed to help us manage it. Applications often store their data in their own particular locations and representations, inaccessible to other applications." Karger also discusses duplicate copies and "inconsistent versioning" between them. **TCF falls outside the established term on the two rows that carry definitional weight** — unit of analysis (*different items* about one task vs. *one item stream* for one account) and access status (*scattered but reachable* vs. *one intact archive platform-enforced inaccessible*). But the surface resemblance is strong enough that **the paper must do the distinguishing work explicitly, in the body, with a citation.** Leaving the term uncited while claiming a naming contribution is the single most likely trigger for a reviewer objection in this area. Add Bergman, Beyth-Marom & Nachmias, *"The project fragmentation problem in personal information management"*, CHI 2006, DOI 10.1145/1124772.1124813 (**search-summary-level — ACM returned 403; verify before citing**).

*Nearest published prose in personal archiving:* Marshall, *"Rethinking Personal Digital Archiving, Part 1"*, *D-Lib Magazine* 14(3/4), 2008, doi:10.1045/march2008-marshall-pt1 (**full-text-read**) — "Individuals' digital belongings are necessarily distributed over many different stores, some overlapping, and some completely independent," and device replacement as a loss site: "even if they're technically recoverable, the local files on the old computer are lost forever." Not TCF: the divergence is *derivational* (edit variants) and the loss is *destructive*.

*For the taxonomy table's "Device migration" row (currently uncited):* Dearman & Pierce, *"'It's on my other computer!': Computing with Multiple Devices"*, CHI 2008, DOI 10.1145/1357054.1357177 (**search-summary-level — read the PDF before citing**) supports the row's actual claim; its failure mode is information stranded on the wrong device, i.e. one copy in the wrong place. Optionally Ravasio, Schär & Krueger, TOCHI 2004 (**quoted second-hand via Karger — verify against the original**).

*Motivation-only citations, clearly labelled as such — not evidence of TCF:* *"Achieving Resilience: Data Loss and Recovery on Devices for Personal Use in Three Countries"*, CHI 2025, DOI 10.1145/3706598.3714202 (**abstract + intro read**; n=1423 across DE/UK/US): "Almost half of the participants (656, 46%) experienced at least one data loss incident. Whereas 42% of 656 participants recovered using backups, over half of them had outdated or incomplete backups." Good support for "restore-time incompleteness is the norm." Also Redmiles & Hargittai, *"New Phone, Who Dis? Modeling Millennials' Backup Behavior"*, ACM TWEB 13(1), 2019, DOI 10.1145/3208105 (**abstract-level**) — "less than half of young adults perform mobile or computer backups regularly"; note its content models backup *frequency*, so its title fits the migration framing better than its substance does.

*Unresolved:* cross-device messaging continuity returned nothing academic — only patents (e.g. US 7,499,926 "Maintaining and replicating chat histories"; US 9,253,125 "Managing a messaging state across multiple clients"). **The patent literature is an adjacent prior-art surface this survey did not properly cover, and a systems-oriented reviewer may raise it.**

---

### Revised delta sentence (2026-08-25 — supersedes the 2026-08-24 candidate)

The previous candidate claimed "the specific, previously unaddressed instance of destructive-restore chat-backup fragmentation." **"Previously unaddressed" is refuted by finding (e) and is removed.** "Provenance traceability" as a novel contribution is narrowed by findings (b) and (e). Replacement, claiming only what the citations support:

> *Reconciling two independently-accumulated chat archives is already attempted in practice — by shipped open-source tooling and by commercial products — but nowhere specified: the most-used such tool declines to deduplicate overlapping regions at all, the remainder resolve overlap by undocumented heuristic or by database uniqueness constraints, they diverge in what becomes of input they cannot parse — some discard it without surfacing it, one prints a per-record diagnostic, one aborts the load — and **none of them retains rejected input for later inspection**, nor couples reconciliation with per-record provenance, conflict reporting, or a determinism guarantee. Building on forensic timeline-reconstruction practice — which has staged reconstruction as a pipeline since 2014, but specifies its inter-stage relationship only in prose, filters unparseable input away rather than retaining it, and whose 2025 systematization still treats multi-source "source combination" informally — we contribute a formal characterization of the conditions under which this fragmentation arises, together with a platform-agnostic specification of the reconciliation contract itself: F → R → R′ → (U, Ω), where the inter-stage data contract is given explicitly and two outputs have no analogue in that lineage — the quarantine set Q with typed reason codes, and the structured reconstruction report Ω. We do not claim to be the first to merge chat archives, to stage a reconstruction pipeline, or to encounter the problem.*

**Status of the delta: SURVIVED, NARROWED TWICE.** It now rests on *specification vs. implementation*, on *the explicit inter-stage data contract*, and on *Q and Ω as typed outputs with no analogue in the forensics lineage* — not on novelty of the problem, of merging, of provenance, or **of staging a reconstruction pipeline** (conceded to Chabot et al., JISIC 2014). **This is contingent on the two unread Chabot documents** — the ORD2I body and the 2015 thesis — either of which could narrow it a third time, to Q and Ω alone.

---

### Claims this survey positively forbids

Recorded so a later drafting session cannot reintroduce them:

1. ❌ "This phenomenon has not been encountered / addressed before." — Refuted: `EkriirkE/WAMerge`, commercial vendors, user forums.
2. ❌ "Merging chat archives is novel / unsolved." — Refuted: `bepaald/signalbackup-tools` (1.4k★, active), 8+ WhatsApp-specific repos.
3. ❌ "Per-record provenance is not formalized in digital forensics." — Refuted: Chabot et al. 2014's relation of support; `chat4n6` implements per-record source+confidence today.
4. ❌ "Destructive restore is an unrecognized hazard." — Refuted: US 8,151,139 B1 (2009/2012).
5. ❌ "CRDT merge requires a common ancestor." — Refuted for foundational CRDTs (Shapiro et al. 2011); true only of the mergeable-RDT line.
6. ❌ "Plaso merely logs warnings and discards failures." — Refuted: five typed retained warning containers.
7. ❌ "Fragmentation of personal information across devices is unnamed." — Refuted: "information fragmentation" (PIM), routinely used across devices.
8. ❌ "No prior work stages forensic reconstruction as an end-to-end pipeline." — Refuted: Chabot et al., IEEE JISIC 2014 — a four-layer Extraction → Semantic → Reasoning → Interface architecture running "from the extraction of data to the analysis of the timeline produced." *(Added 2026-08-25.)*
9. ❌ "Every merging tool silently drops records it cannot parse." — Refuted: `frozenspider/chat-history-manager` aborts the load on an unknown record type; `EkriirkE/WAMerge` prints a per-record diagnostic before skipping. **The correct universal claim is the quarantine one — none of the five retains rejected input for later inspection.** *(Added 2026-08-25.)*

---

**Status: PHASE L CLOSED (2026-08-25).** All six kill-shot questions answered with real citations or explicitly scoped negatives, plus two follow-up verifications run the same day. **Delta survived, narrowed twice.** Four prior positions were corrected rather than confirmed: the CRDT ancestry argument, the provenance-novelty claim, the "every tool silently drops" claim, and the pipeline-staging claim. Nine claims are now positively forbidden (list above).

**Pre-submission TODOs — track, do not block Phase W drafting on these:**
- **T1 — The name.** Terminology collision in finding (c). Author's call, not a research question. **Leaning (2026-08-25, not final): do the distinguishing work in Related Work rather than run a rename sweep this late.** Record the decision here once made.
- **T2 — WhatsApp FAQ sourcing.** The "cannot merge backups" quote in (c) is currently third-party; replace with a direct WhatsApp support citation before the paper relies on it.
- **T3 — US 8,151,139 B1 claims read.** Confirm whether its "restore backup" is merely a rollback diff (current reading) or a genuine second independently-accumulated timeline (would narrow the delta materially).

**Open residual risks, highest first:**
1. **The two unread Chabot documents — the only item that could narrow the delta a third time.** ORD2I body (DOI 10.1016/j.diin.2015.07.005, paywalled; its "seven necessary criteria" are the likeliest place an invariant is stated *and discharged*) and the 2015 thesis (NNT 2015DIJOS037; all automated retrieval 403'd — ResearchGate author profile is the live lead, needs manual download or a library request). **Until one is read, "no prior formal inter-stage contract exists" is not settled.**
2. `frozenspider/chat-history-manager`'s dedup predicate — unread (its parse-failure behaviour *was* verified).
3. The Plaso VSS seam (finding (d)) — INCONCLUSIVE.
4. DFRWS proceedings searched directly, and patent prior art surveyed properly — neither covered by this pass, and the patent surface is where destructive-restore is most likely already named.
5. Two French workshop papers (hal-01099652, hal-01199518) have HAL records but no deposited files — content entirely unknown; emailing the author is likely cheaper than further search.

---

## 2.6 Scope Decision: Specification Paper, Fast Path (locked 2026-08-24)

**Decision:** this paper is a rigorous position/specification paper. CHAMP-Pipeline remains explicitly planned/future implementation (**Phase II**), not a prerequisite for this paper. No full pipeline, no benchmark, no experimental performance claims are required or claimed here.

**Why:** building a real (even minimal) Ingestion→Normalization→Synthesis→Validation pipeline properly, at the rigor this project has committed to throughout, is not a few-days task. Faking a miniature implementation just so the paper can say "implemented" would be worse than having none. The paper's actual contribution — TCF's formal characterization, CARTA's specification, and the explicit F→R→R'→(U,Ω) reconstruction contracts — stands on its own as a specification paper, provided the literature positioning survives the kill-shots and the mathematics is internally consistent.

**Paper-ready stop condition:** the paper is ready when TCF is formally and defensibly characterized, CARTA is internally consistent and sufficiently specified to be independently implementable, the novelty/related-work position survives the literature kill-shots, all mathematical claims are internally valid, and every empirical/capability statement is supported by either cited evidence or explicitly labeled as proposed/future work. Once satisfied: **stop engineering, write.**

**Must do before the paper:** (A) the four mathematical issues above — done, 2026-08-24; (B) finish the literature kill-shots — exact TCF-name search, CRDT/replica reconciliation, digital-forensics reconstruction, existing WhatsApp/chat-specific forensic reconstruction; (C) finalize the CARTA specification (inputs, outputs, provenance, quarantine, ambiguity, conflict representation, invariants); (D) write the paper, every claim traced to formal derivation, cited literature, or explicitly labeled proposed design.

**Should do, optional:** a small, manually-verified conceptual walkthrough — two tiny hand-built fragments → CARTA transformation → U + Ω worked by hand, not by running code — would strengthen the paper without committing to building the full engine.

**Should not do until the paper is drafted:** full parser, full normalization engine, full synthesis engine, benchmark framework, performance study, viewer, CI engineering, cloud deployment, ML, LLM, database, production-grade CHAMP.

**Phase II (deferred, separate project):** CHAMP-Pipeline implementation + empirical evaluation. Potential future title: *"CHAMP: A Reference Implementation and Evaluation of CARTA for Fragmented WhatsApp Archives."* Not started, not scoped, not a requirement for this paper's completion.

**Standard for this decision:** we propose, formalize, specify, and identify the implementation path. We do not pretend the software exists, invent benchmarks, put fabricated performance tables into the manuscript, or call a future implementation "our implementation."

---

## 3. Paper Structure & Section-by-Section Blueprint

```
+---------------------------------------------------------------------------------------+
|                                    PAPER TITLE                                        |
|  When Chats Split Apart: Formalizing Temporal Communication                           |
|         Fragmentation and the CARTA Reconstruction Framework                          |
+---------------------------------------------------------------------------------------+
|  1. INTRODUCTION & MOTIVATION                                                         |
|     - Growth of multi-device messaging and destructive, merge-free backup restore     |
|     - The hidden failure mode: device repair/switch -> bifurcation -> destructive     |
|       restore (no merge offered)                                                      |
|     - Motivating real-world scenario and research questions                           |
+---------------------------------------------------------------------------------------+
|  2. TEMPORAL COMMUNICATION FRAGMENTATION (TCF)                                        |
|     - Formal problem statement and necessary conditions (Bifurcation, Persistence,    |
|       Asymmetric Reconciliation)                                                      |
|     - Comparative taxonomy table against neighboring phenomena (staleness, CRDTs,     |
|       git merge, sync conflicts)                                                      |
+---------------------------------------------------------------------------------------+
|  3. THE CARTA ARCHITECTURAL FRAMEWORK                                                 |
|     - High-level design: Ingestion (I) -> Normalization (N) -> Synthesis (S)          |
|     - Formal data contracts (F, R, R', Q, U, \Omega)                                  |
|     - Core invariants (Zero-loss, provenance traceability, determinism)               |
+---------------------------------------------------------------------------------------+
|  4. RECONSTRUCTION & RECONCILIATION ALGORITHMS                                        |
|     - Algorithm 1: Coarse Timestamp Discretization & Fuzzy Window Deduplication       |
|     - Algorithm 2: Non-Destructive Conflict Detection & \Omega Report Assembly        |
|     - Handling timestamp quantization (1-minute resolution) and message reordering    |
+---------------------------------------------------------------------------------------+
|  5. CHAMP-PIPELINE: PLANNED IMPLEMENTATION (UNBUILT AS OF THIS WRITING)               |
|     - Architecture of champ-pipeline-core                                             |
|     - Handling heterogeneous WhatsApp export dialects (DMY vs MDY, 12h vs 24h,        |
|       multi-line bodies, double filenames, senderless encryption/system notices)      |
|     - Zero-dependency design and reproducibility guarantee                            |
+---------------------------------------------------------------------------------------+
|  6. [DEFERRED TO PHASE II — no evaluation claimed in this paper unless conducted]     |
|     - This paper is a specification/position paper. No pipeline exists to evaluate.   |
|     - An evaluation section is only written if a real evaluation is actually run.     |
+---------------------------------------------------------------------------------------+
|  7. DISCUSSION & OPERATIONAL CONSIDERATIONS                                           |
|     - End-to-end encryption (E2EE) implications and client-side execution             |
|     - Cross-platform generalizability (Signal, Telegram, Apple iMessage)              |
|     - Legal and digital forensics archiving standards                                 |
+---------------------------------------------------------------------------------------+
|  8. RELATED WORK                                                                      |
|     - Distributed consistency models and partition reconciliation                     |
|     - Mobile chat backup mechanisms & digital forensics extraction                    |
|     - Digital preservation & historical personal communication archives               |
+---------------------------------------------------------------------------------------+
|  9. CONCLUSION & REPRODUCIBILITY                                                      |
|     - Summary of contributions                                                        |
|     - Data and code availability (GitHub open-source release; Zenodo DOI is           |
|       explicitly out of scope per PROJECT_PLAN.md §12 — not required for arXiv)       |
+---------------------------------------------------------------------------------------+
```

---

## 4. Planned Tables and Figures

### Table 1: Taxonomy of Neighboring Data-Loss and Consistency Phenomena
| Dimension | Backup Staleness | Sync Conflict | Git 3-Way Merge | **TCF (This Paper)** |
|---|---|---|---|---|
| **Underlying Cause** | Infrequent snapshotting | Concurrent multi-client writes | Divergent commit histories | Device switch + destructive, merge-free restore |
| **Number of Timelines** | Exactly 1 | 2+ concurrent | 2 branches + Common Ancestor | 2 independently persistent, potentially overlapping |
| **Platform Behavior** | Restores stale snapshot | Rejection or branch fork | Automatic merge or conflict markers | **Restore replaces current history; no merge offered** |
| **Physical Data State** | Missing (never recorded) | Present on server | Merged in working tree | **Intact on local device, inaccessible in cloud** |
| **Resolution Target** | Data lost forever | Operational state restored | Codebase reconciliation | **Forensic reconstruction ($U, \Omega$)** |

### Table 2: [REMOVED 2026-08-24]
No benchmark exists yet. Synthesis is unimplemented, so there is nothing to measure. A results table will be added here only once `core/src/synthesis/` exists and a real benchmark script has actually been run — populated from that script's output, never drafted by hand in advance.

---

## 5. Algorithmic Pseudocode (For Section 4 of Paper)

```latex
\begin{algorithm}[H]
\caption{CARTA Synthesis and Audit Report Construction}
\label{alg:carta_synthesis}
\begin{algorithmic}[1]
\Require Normalized fragment record sets $\mathcal{R}' = \{R'_1, R'_2, \dots, R'_n\}$, Quarantine sets $\mathcal{Q} = \{Q_1, \dots, Q_n\}$, Deduplication window $\Delta t$
\Ensure Unified archive $\mathcal{U}$, Reconstruction report $\Omega$
\State $\mathcal{U} \leftarrow \emptyset$, $\mathcal{C}_{\text{conflicts}} \leftarrow \emptyset$, $\mathcal{P}_{\text{map}} \leftarrow \emptyset$
\State $\mathcal{R}'_{\text{all}} \leftarrow \bigcup_{k=1}^n R'_k$
\State Sort $\mathcal{R}'_{\text{all}}$ primarily by $t_{\text{utc}}$ ascending, secondarily by source sequence index
\State $\mathcal{B}_{\text{clusters}} \leftarrow \text{GroupIntoReconciliationClusters}(\mathcal{R}'_{\text{all}}, \sim_{\text{dedup}}, \Delta t)$
\For{\textbf{each} cluster $C \in \mathcal{B}_{\text{clusters}}$}
    \State $u \leftarrow \text{SynthesizeCanonicalMessage}(C)$
    \State $u.\text{provenance} \leftarrow \bigcup_{r' \in C} r'.\text{provenance}$
    \State $\mathcal{P}_{\text{map}}[u.\text{id}] \leftarrow u.\text{provenance}$
    \If{$\text{IsAmbiguous}(C)$}
        \State $\mathcal{C}_{\text{conflicts}}.\text{append}(\text{CreateConflictDescriptor}(C))$
    \EndIf
    \State $\mathcal{U}.\text{append}(u)$
\EndFor
\State $\Omega \leftarrow \langle \text{provenance\_map}: \mathcal{P}_{\text{map}}, \text{quarantine}: \bigcup \mathcal{Q}, \text{conflicts}: \mathcal{C}_{\text{conflicts}}, \text{stats}: \text{ComputeStats}(\mathcal{U}, \mathcal{R}'_{\text{all}}, \mathcal{Q}) \rangle$
\State \Return $(\mathcal{U}, \Omega)$
\end{algorithmic}
\end{algorithm}
```

---

## 6. Implementation & Paper Packaging Plan

### 6.1 In-Repository LaTeX Structure (`paper/`)
```text
paper/
├── main.tex                  # Primary LaTeX driver document (IEEE/arXiv class)
├── main.bib                  # BibTeX bibliography with full citations
├── sections/
│   ├── 01_introduction.tex
│   ├── 02_tcf_formalization.tex
│   ├── 03_carta_framework.tex
│   ├── 04_algorithms.tex
│   ├── 05_implementation.tex
│   ├── 06_evaluation.tex
│   ├── 07_discussion.tex
│   ├── 08_related_work.tex
│   └── 09_conclusion.tex
├── figures/
│   ├── fig1_tcf_timeline.pdf
│   └── fig2_carta_pipeline.pdf
└── tables/
    ├── tab1_taxonomy.tex
    └── tab2_benchmark_results.tex
```

### 6.2 Pre-submission Checklist for arXiv
1. **Zero Data Leakage:** Verify with automated scripts that no personal names, numbers, or private chat data exist anywhere in the paper, code, or fixtures.
2. **Reproducibility Script:** Not yet built. No `scripts/benchmark-bifurcation.js` exists. This checklist item stays unchecked until a real benchmark script exists and has actually been run.
3. **Clean Compilation:** `pdflatex main.tex` -> `bibtex main` -> `pdflatex main.tex` produces 0 warnings and 0 missing references.
4. ~~**Permanent DOI & Zenodo Archival**~~ — **out of scope for this paper**, per `PROJECT_PLAN.md §12` (explicitly not a current priority) and Phase S (arXiv Submission only). Remove from the pre-submission checklist; not a blocker.
