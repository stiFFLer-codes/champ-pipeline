> **Draft status.** Complete section list: 1, 2, 3, 4, 5, 6, 7, 8, 9 (Introduction & Motivation; Temporal Communication Fragmentation; The CARTA Architectural Framework; Reconstruction & Reconciliation Algorithms; CHAMP-Pipeline: Planned Implementation; Evaluation; Discussion & Operational Considerations; Related Work; Conclusion & Reproducibility), plus a resolved **References** section added 2026-08-25. Sections 1–2 and 8 drafted 2026-08-25; Sections 3–4 and then 5, 6, 7, 9 added the same day. Manuscript prose 7,889 words. References: bibliographic and software entries, resolved from authoritative metadata and orphan-checked in both directions. `[CITE-T2]` in Section 1 was resolved 2026-08-25 by narrowing the claim to what the archived WhatsApp source actually supports (architect's decision among three options offered — see Drafting note 1); the sentence no longer attributes an unsupported merge claim to WhatsApp. Outline numbering follows `docs/PAPER_BLUEPRINT.md` §3. Open items are listed under "Drafting notes" at the end of this file and are not part of the manuscript text.

---

## 1. Introduction & Motivation

A phone stops working and goes in for repair. Its owner keeps the messaging account running on a spare handset, and the conversations continue there for as long as the repair takes. The original phone comes back. The owner restores the most recent backup onto it, and the messages from the repair window vanish from the screen.

Nothing was deleted. Those messages still sit in the spare device's local database, and in any export the user thought to take before handing the account back. The platform simply offers no operation that puts the two histories together. WhatsApp's own restore guidance requires the same account that created the backup [WhatsApp 2025]; it documents no operation for combining two backups, a gap that has motivated the third-party merge tools surveyed in Section 8.3.

We call this state **Temporal Communication Fragmentation** (TCF). Its signature is a fully intact archive that the platform will not surface. The data survives; the affordance to reach it does not.

Three properties make the situation harder than it first appears. The two archives overlap in part and diverge in part, so neither is a superset of the other. They carry no shared version history, no operation log, and no common ancestor, because consumer chat exports were never designed to be reconciled. And the restore operation that finalises the split gives no warning that a competing archive exists, attempts no comparison, and reports nothing about what it replaced.

**Motivation, stated as motivation.** This work began with one of the authors losing a stretch of message history to exactly this sequence: primary handset unavailable, account carried on a second handset, history replaced on restore. That incident prompted the research questions below. It is an anecdote. It is not evidence, no controlled experiment was run against it, and no claim in this paper rests on it.

The paper asks three questions:

**RQ1.** What conditions must hold for a single account's message history to end up split across two archives that are each internally complete and mutually irreconcilable through the platform?

**RQ2.** Given two or more such archives, what does a reconstruction procedure have to guarantee for its output to be trustworthy as a record, rather than merely plausible?

**RQ3.** Where do those guarantees sit relative to what optimistic replication, digital forensics, and the existing body of chat-merging tools already provide?

Answering RQ1 gives a formal characterisation of TCF with three necessary conditions (Section 2). Answering RQ2 gives CARTA (Chat Archive Reconstruction & Temporal Access), a platform-agnostic specification of a three-stage reconstruction contract, F → R → (R′, Q) → (U, Ω), in which the data passed between stages is typed, records that cannot be safely interpreted are retained in a quarantine set Q rather than dropped, and every reconstruction emits a structured report Ω covering provenance, quarantine carryover, conflicts, and counts (Sections 3 and 4). Answering RQ3 is Section 8.

**What this paper does not do.** No implementation is evaluated here. CHAMP-Pipeline, the WhatsApp-specific reference implementation of CARTA, is described in Section 5 as planned work and does not yet exist; `core/src/{ingestion,normalization,synthesis}/` are empty. There is accordingly no benchmark, no performance measurement, and no reconstruction-accuracy figure anywhere in this paper. Where a capability is stated, it is either a property the specification requires of a conforming implementation or a citation to someone else's system. Readers should treat the contribution as a problem definition and a specification, with implementation and evaluation left as declared future work.

---

## 2. Temporal Communication Fragmentation

### 2.1 Definition

**Temporal Communication Fragmentation** is a state in which a user's communication history for a single logical account becomes partitioned across two or more device-bound application instances, arising from primary-device unavailability, continued account use on a secondary device during that window, and primary-device recovery followed by a restore action that replaces rather than merges. The platform offers no native path to combine the archives, no user-facing warning that a competing archive exists, and no attempt at a diff or a reconciliation.

We assert the observable restore behaviour and nothing about the backend that produces it. A single-slot, last-write-wins cloud backup destination would explain what users see, but we have found no vendor documentation, citation, or controlled experiment establishing that architecture, and no argument in this paper depends on it.

### 2.2 Necessary conditions

TCF requires all three of the following to hold at once.

**Condition 1, Bifurcation.** At failure time $t_f$, one authoritative timeline splits into two independently updating branches. The primary is paused; the secondary is active.

**Condition 2, Independent persistence.** Both branches survive and accumulate new history for some duration with zero synchronisation between them. This condition does most of the work in separating TCF from the replication literature, and Section 8.1 returns to it.

**Condition 3, Asymmetric reconciliation on merge.** When the primary device recovers, the two archives coexist without conflict for a period. The primary's resumption does not by itself threaten what the secondary accumulated. The split becomes permanent at the moment a restore is performed, because the restore replaces current chat state instead of merging into it, surfaces no warning, and gives no indication that a second archive existed. Thereafter the secondary's contribution survives only in whatever unsynced local form remains on the secondary device.

Formally (Section 3 develops this), device failure at $t_f$ and recovery at $t_r$ partition a ground-truth history $\mathcal{T}$ into $F_1$, holding messages with $t(m) \le t_f$ or $t(m) \ge t_r$, and $F_2$, holding messages in $[t_f - \delta,\, t_r + \epsilon]$. The parameters $\delta$ and $\epsilon$ are non-negative, representing pre-existing history on the secondary device and the lag before the account returns to the primary. Both may be strictly positive, so $F_1$ and $F_2$ can overlap. That overlap is why reconstruction needs deduplication rather than concatenation.

### 2.3 Distinction from backup staleness

Backup staleness is the documented problem of infrequent snapshots losing data when a device fails. One timeline exists, and the data from the unprotected window was never captured. TCF has two timelines, each holding messages the other lacks, both physically present. The reconstruction problem is one of retrieval and reconciliation rather than of recovery from destruction.

### 2.4 Position against neighbouring phenomena

**Table 1: Taxonomy of neighbouring data-loss and consistency phenomena.**

| Dimension | Backup Staleness | Sync Conflict | Git 3-Way Merge | **TCF (This Paper)** |
|---|---|---|---|---|
| **Underlying Cause** | Infrequent snapshotting | Concurrent multi-client writes | Divergent commit histories | Device switch + destructive, merge-free restore |
| **Number of Timelines** | Exactly 1 | 2+ concurrent | 2 branches + Common Ancestor | 2 independently persistent, potentially overlapping |
| **Platform Behavior** | Restores stale snapshot | Rejection or branch fork | Automatic merge or conflict markers | **Restore replaces current history; no merge offered** |
| **Physical Data State** | Missing (never recorded) | Present on server | Merged in working tree | **Intact on local device, inaccessible in cloud** |
| **Resolution Target** | Data lost forever | Operational state restored | Codebase reconciliation | **Forensic reconstruction ($U, \Omega$)** |

Two further neighbours deserve separate treatment because they are close enough to invite misreading, and both are already-named phenomena rather than gaps.

**Sync conflict.** Systems built for optimistic replication also allow replicas to diverge, and they define conflict as a first-class condition. Saito and Shapiro survey the area and describe divergence and conflict as the characteristic problems such systems face [Saito & Shapiro 2005]. The difference is what happens on reunification: those platforms attempt reconciliation, imperfectly and with human fallback, whereas the platform behaviour in Condition 3 makes no attempt at all.

**Device migration.** Moving an account between handsets is routine, and the HCI literature on multi-device use describes the resulting failure as information stranded on the device the user is not currently holding [Dearman & Pierce 2008]. Migration moves one continuous timeline. TCF requires two timelines that accumulated independently and concurrently.

### 2.5 Terminology: what TCF is not called

Three established terms sit close enough to "temporal communication fragmentation" that a reader may reasonably assume the phenomenon is already covered. Each denotes something else, and we set the boundaries explicitly rather than rely on context.

**Information fragmentation** (personal information management). Karger and Jones define this as personal information split by the very tools meant to manage it, with applications storing data "in their own particular locations and representations, inaccessible to other applications" [Karger & Jones 2006]; the project-level variant is treated by Bergman and colleagues [Bergman et al. 2006, CITE-VERIFY]. Later usage in the field routinely extends the term across devices as well as applications, so the surface overlap with TCF is real. Two things separate them. The unit differs: information fragmentation concerns *different items* bearing on one task or project, scattered across stores, whereas TCF concerns *one item stream*, a single conversation, split into disjoint temporal segments. And the access status differs: fragmented personal information is scattered but reachable, and the research goal is unification across silos, whereas in TCF one intact archive is unreachable through the platform that holds it. Karger and Jones do treat duplicate copies drifting out of step, which is content divergence between copies a user made; TCF's divergence is temporal, between copies the platform made and then rendered mutually exclusive.

**Fragmented communication** (CSCW and workplace studies). In that literature the term describes one conversation spread across many channels and tools. TCF is the opposite arrangement: one channel, one account, one conversation, split by time rather than by venue.

**Temporal fragmentation** (time geography and ICT studies). Hubers, Schwanen and Dijst use this for the splitting of human *activities* into pieces performed at different times and places [Hubers et al. 2008]. The referent is an activity pattern, not a data archive. We keep the name Temporal Communication Fragmentation because the qualifier "communication" and the archival framing distinguish the two, and because no prior work applies any of these three terms to the configuration defined in Section 2.2. The collision is nonetheless a live source of confusion, and it is the reason this subsection exists.

---

## 3. The CARTA Architectural Framework

CARTA specifies how to get from a set of fragmented exports to one reconstructed history together with an account of how that history was produced. It is a specification and not a system: it fixes what each stage receives, what each stage emits, and what the result must be able to report about its own construction. Section 5 describes the planned implementation, and nothing in this section depends on that implementation existing.

### 3.1 The reconstruction algebra

Write the raw fragment exports as $\mathcal{F} = \{F_1, F_2, \dots, F_n\}$. CARTA composes three stages:

$$\mathcal{F} \xrightarrow{\;\mathcal{I}\;} \mathcal{R} \xrightarrow{\;\mathcal{N}\;} (\mathcal{R}', \mathcal{Q}) \xrightarrow{\;\mathcal{S}\;} (\mathcal{U}, \Omega)$$

The quarantine set $\mathcal{Q}$ appears in the top-level algebra by design. Records that cannot be interpreted safely are an output of the pipeline rather than an internal concern of one stage, and writing them into the signature is what makes it impossible for a conforming implementation to discard them quietly.

TCF as defined in Section 2 is a two-way split: one primary device pauses while one secondary continues, and Definition 1 formalises that case with $n = 2$. CARTA's algebra is stated for $n \ge 2$. Nothing in the reconstruction problem requires exactly two fragments, and a user who suffers repeated device failures can accumulate more. The generalisation runs one way: CARTA covers more than TCF's minimal case, while TCF itself remains binary.

### 3.2 Ingestion

Ingestion maps each fragment independently to a sequence of structured records:

$$\mathcal{I}: F_k \mapsto R_k = \langle r_{k,1}, r_{k,2}, \dots, r_{k,M_k} \rangle$$

Each record keeps the raw text slice, the raw timestamp string, the raw sender token, a message category, and a provenance tuple:

$$\text{prov}(r_{k,j}) = \langle \text{source\_id}: F_k,\; \text{line\_range}: [\ell_{\text{start}}, \ell_{\text{end}}],\; \text{sha256}: h(F_k) \rangle$$

Three parts, three jobs. The source identifier says which fragment the record came from. The line range makes the original text re-locatable, so a reader can return to the bytes the record was derived from. The hash binds that claim to a specific file state, which is what allows an auditor to detect that the fragment has changed since the reconstruction ran.

Ingestion is non-lossy and non-destructive. It writes nothing back to the fragment files, and it filters no content. It also performs no reconciliation across fragments, and this restriction is deliberate rather than incidental: a stage that both parses and reconciles would make it impossible to say afterwards whether a discrepancy came from a parsing decision or a merging decision. Ingestion parses. Reconciliation happens later, once, in one place.

### 3.3 Normalization

Normalization converts each fragment's records into a shared canonical schema, with UTC timestamps, resolved sender identity, and a fixed message-type taxonomy:

$$\mathcal{N}: R_k \mapsto (R'_k, Q_k)$$

Each record meets one of three fates, and the third is the one that distinguishes this stage from a conventional parser.

A record that conforms to the canonical grammar **unambiguously** becomes a canonical record in $R'_k$, carrying a UTC epoch timestamp, a normalised sender identity, and a typed payload. Unambiguous here means a date and time admitting a single valid interpretation, valid UTF-8, and a sender or system token that resolves.

A record that **fails to parse** moves to the quarantine set $Q_k$.

A record that **parses but admits more than one reading** also moves to $Q_k$. The date string `03/04/24` is the standard case: it is well-formed under both day-month-year and month-day-year conventions, and nothing inside the record itself decides between them. Such a record is not normalised, and it is not resolved by picking the more likely convention. Guessing here would convert an uncertainty into an assertion that later stages, and eventually the reader, would have no way to distinguish from an observation.

Every quarantined record carries a typed reason code $\rho$. The taxonomy distinguishes at minimum `MALFORMED_TIMESTAMP`, `UNSUPPORTED_FORMAT`, `AMBIGUOUS_DATE_FORMAT`, `UNRESOLVED_SENDER`, and `INVALID_ENCODING`, which separates a record that could not be read from one that could be read in several ways. The distinction matters downstream, because the two call for different remedies: a malformed record may need a parser fix, whereas an ambiguous one may be resolvable by evidence outside the record, such as a locale established elsewhere in the same fragment.

Normalization is required to carry every record's provenance through to $R'_k$ or $Q_k$. This is a guarantee the stage owes, and not a property Synthesis may assume on its behalf.

### 3.4 Synthesis

Synthesis is the only stage that sees fragments together:

$$\mathcal{S}: (\{R'_1, \dots, R'_n\}, \{Q_1, \dots, Q_n\}) \mapsto (\mathcal{U}, \Omega)$$

It performs four operations on the union $\mathcal{R}'_{\text{all}} = \bigcup_{k=1}^{n} R'_k$, in this order: it orders the records chronologically, groups records that appear to describe the same message into reconciliation clusters, synthesises one canonical record per cluster, and detects observations that cannot be reconciled. Section 4 gives the procedure.

Recall from Section 2.2 that $\delta$ and $\epsilon$ may both be strictly positive, so $F_1$ and $F_2$ can overlap. A message sent during that overlap appears in both fragments and arrives at Synthesis twice, in two separately parsed forms that need not agree byte for byte. Deduplication exists because of this overlap. Without it, concatenation would report the overlap region twice and misrepresent the history it claims to reconstruct.

A conflict is any set of two or more observations that cannot be reconciled deterministically under the reconstruction rules. This is broader than a timestamp collision, and it includes contradictory sender attribution and orderings that cannot both hold.

### 3.5 The reconstruction report

$\Omega$ is a first-class output with four components:

$$\Omega = \langle \Omega_{\text{provenance}},\; \Omega_{\text{quarantine}} = \textstyle\bigcup_k Q_k,\; \Omega_{\text{conflicts}},\; \Omega_{\text{stats}} \rangle$$

The **provenance map** records, for every record in $\mathcal{U}$, its origin device, origin export, origin backup date, and confidence. The **quarantine carryover** holds every record from every $Q_k$, retained with its reason code rather than dropped at the stage boundary. The **conflict log** holds every irreconcilable observation under the definition above. The **statistics** report deduplication counts along with resolved and unresolved ambiguity counts.

Quarantine carryover is the component that does the most work. A reconstruction that silently omits what it could not handle looks identical, to its reader, to one that had nothing to omit. Carrying $\mathcal{Q}$ into $\Omega$ makes the two cases distinguishable without requiring the reader to re-run anything.

### 3.6 Design principles

**Deterministic.** Identical fragment inputs produce an identical $(\mathcal{U}, \Omega)$.

**Auditable.** Every record in $\mathcal{U}$ traces back to at least one source fragment through its provenance.

**Non-destructive.** Original fragment files are read and never modified.

### 3.7 Invariants

Four invariants constrain any conforming implementation.

**Invariant 1, Zero unaccounted loss.** Every ingested record either contributes provenance to a record in the unified archive or appears in the quarantine carryover:

$$\forall r \in \bigcup_{k=1}^{n} R_k, \quad \big(\exists u \in \mathcal{U} : \text{prov}(r) \subseteq \text{prov}(u)\big) \;\lor\; \big(\exists q \in \Omega_{\text{quarantine}} : q = r\big)$$

No third outcome is permitted. A record cannot leave the pipeline unaccounted for.

**Invariant 2, Strict provenance traceability.** Every record in the unified archive carries at least one provenance entry, and every entry references a valid source fragment:

$$\forall u \in \mathcal{U}, \quad |\text{prov}(u)| \ge 1 \;\land\; \forall p \in \text{prov}(u),\; p \text{ references a valid } F_k$$

This forbids synthesised records with no origin, which is what would let an inference enter the archive indistinguishable from an observation.

**Invariant 3, Determinism.** For a fixed $\mathcal{F}$, two runs of the pipeline yield the same pair:

$$\mathcal{S}(\mathcal{N}(\mathcal{I}(\mathcal{F}))) = (\mathcal{U}_1, \Omega_1) \;\land\; \mathcal{S}(\mathcal{N}(\mathcal{I}(\mathcal{F}))) = (\mathcal{U}_2, \Omega_2) \implies (\mathcal{U}_1 = \mathcal{U}_2) \land (\Omega_1 = \Omega_2)$$

We state this as a requirement on conforming implementations. No implementation exists to exhibit it, and Section 4.1 identifies the tie-breaking rule that a conforming implementation needs in order to satisfy it.

**Invariant 4, Idempotent reconstruction.** Applying Synthesis to an already unified, canonical record set together with an identical copy of itself must not introduce additional information loss or unresolved conflicts. We state this as a specification-level target rather than a proven equation. A type-safe formalisation, establishing that records in $\mathcal{U}$ are schema-compatible with those in $\mathcal{R}'$, is deferred to the implementation phase and is not claimed here.

---

## 4. Reconstruction & Reconciliation Algorithms

### 4.1 Ordering and timestamp granularity

Two distinct timestamp tolerances operate in Synthesis, and conflating them is the easiest way to misread the specification.

The first is the **deduplication window** $\Delta t_{\text{granularity}}$, which governs whether two records may describe the same message. Exports quantise time. A platform that writes minute-resolution timestamps into one export and second-resolution into another will represent one message with two different values, so an exact timestamp match would fail to group records that plainly belong together.

The second is the **coarse resolution** used for conflict detection, fixed at one minute. This is a deliberately blunter bucket, used to decide which record pairs are close enough that a contradiction between them is worth reporting.

Ordering comes before either. Records are sorted primarily by $t_{\text{utc}}$ ascending and secondarily by source sequence index. The secondary key is what makes Invariant 3 attainable: records sharing a timestamp would otherwise be ordered by whatever the runtime happened to do, and two runs could disagree. Determinism here is bought by a tie-break rule, not assumed.

### 4.2 The similarity criterion

Two normalised records are related by $\sim_{\text{dedup}}$ when they agree on sender, body, and attachment, and their timestamps fall within the deduplication window:

$$r'_a \sim_{\text{dedup}} r'_b \iff |t_{\text{utc}}(r'_a) - t_{\text{utc}}(r'_b)| \le \Delta t_{\text{granularity}} \;\land\; s(r'_a) = s(r'_b) \;\land\; b(r'_a) = b(r'_b) \;\land\; a(r'_a) \cong a(r'_b)$$

This is a **similarity relation** and we do not claim it is an equivalence relation. Proximity criteria are not generally transitive. Three records spaced just under $\Delta t_{\text{granularity}}$ apart in sequence will satisfy the relation pairwise along the chain while the outer two fall outside each other's window. Treating the relation as an equivalence and speaking of equivalence classes or a quotient set would assert a partition that the criterion does not deliver.

Records satisfying the criterion are therefore grouped into **reconciliation clusters**, and the specification fixes the criterion while leaving the clustering procedure open. Transitive closure with a bounded cluster diameter and connected components over a similarity graph are both admissible, and they can disagree on the chain case above. Choosing between them is an implementation decision deferred to the implementation phase, and a conforming implementation must state which rule it applies, since Invariant 3 constrains a given implementation to behave the same way twice rather than requiring all implementations to agree with each other.

For each cluster $C$, one canonical record $u$ is synthesised, and its provenance is the union of the provenance of every record in the cluster:

$$\text{prov}(u) = \bigcup_{r' \in C} \text{prov}(r')$$

The union is what preserves Invariant 2 across deduplication. Collapsing three observations into one record without unioning their provenance would discard two of the three origins and leave the archive claiming a single source for something seen three times.

### 4.3 The Synthesis procedure

```
Algorithm 1: CARTA Synthesis and Audit Report Construction

Require: normalised fragment record sets R' = {R'_1, ..., R'_n};
         quarantine sets Q = {Q_1, ..., Q_n};
         deduplication window Δt
Ensure:  unified archive U; reconstruction report Ω

 1  U ← ∅ ; C_conflicts ← ∅ ; P_map ← ∅
 2  R'_all ← ⋃_{k=1..n} R'_k
 3  sort R'_all by t_utc ascending, then by source sequence index
 4  B_clusters ← GroupIntoReconciliationClusters(R'_all, ∼_dedup, Δt)
 5  for each cluster C ∈ B_clusters do
 6      u ← SynthesizeCanonicalMessage(C)
 7      u.provenance ← ⋃_{r' ∈ C} r'.provenance
 8      P_map[u.id] ← u.provenance
 9      if IsAmbiguous(C) then
10          C_conflicts.append(CreateConflictDescriptor(C))
11      end if
12      U.append(u)
13  end for
14  Ω ← ⟨ provenance_map: P_map,
15         quarantine:     ⋃ Q,
16         conflicts:      C_conflicts,
17         stats:          ComputeStats(U, R'_all, Q) ⟩
18  return (U, Ω)
```

Line 2 is where reconstruction becomes possible at all, and it is the first point in the pipeline at which fragments meet. Everything before it treats each fragment in isolation.

Line 3 establishes the total order, with the secondary key supplying determinism as described above.

Line 4 applies the similarity criterion. The procedure name matters: it groups records into clusters, and it does not partition them into classes.

Lines 6 to 8 build one canonical record per cluster and union the provenance, then index it in the map that becomes $\Omega_{\text{provenance}}$. A cluster of one is the ordinary case, a message that appeared in a single fragment, and it passes through with its single provenance entry intact.

Lines 9 to 11 handle a cluster whose members are grouped by the similarity criterion yet disagree in some respect the criterion does not cover. Such a cluster still yields a canonical record, and it also yields a conflict descriptor. Detection and reporting are separated from resolution, which is the same discipline the quarantine rule applies in Normalization: the procedure records what it could not settle instead of settling it silently.

Line 14 assembles the report. The quarantine sets arrive at this line untouched, having been carried through from Normalization for exactly this purpose.

### 4.4 Conflict detection

Conflict detection has a second aspect that Algorithm 1's cluster loop does not reach. Two records may describe genuinely different messages, and so belong to different clusters, while still standing in contradiction. The specification's criterion applies to records sharing a coarse timestamp at one-minute resolution but carrying incompatible sender or ordering constraints:

$$\text{Conflict}(u_i, u_j) \implies \text{flag in } \Omega_{\text{conflicts}}$$

Coarse buckets are used here because export timestamp precision is itself unreliable, and demanding exact equality before considering a contradiction would miss the cases most likely to matter. The consequence of flagging is a report entry. Neither record is dropped, neither is rewritten, and both remain in $\mathcal{U}$ with their provenance intact, which is what Invariant 1 requires.

We fold this into the same exposition rather than giving it a separate algorithm block because it shares Algorithm 1's inputs and writes to the same conflict log, and because presenting it separately would suggest a second pass over the data that the specification does not require.

---

## 5. CHAMP-Pipeline: Planned Implementation

CHAMP-Pipeline is the intended WhatsApp-specific reference implementation of CARTA. It does not exist. At the time of writing, `core/src/ingestion/`, `core/src/normalization/` and `core/src/synthesis/` contain no implementation, and nothing in this section describes running code. The section states a design intention and the input range that design would have to cover, so that a reader can judge whether the specification in Sections 3 and 4 is implementable and what implementing it would involve.

The distinction between CARTA and CHAMP-Pipeline is load-bearing throughout this paper. CARTA is the platform-agnostic specification. CHAMP-Pipeline would be one conforming implementation of it for one platform's export format. Nothing about CARTA depends on CHAMP-Pipeline being built, and a second implementation targeting a different platform would be equally conforming.

### 5.1 Intended architecture

The planned package, `champ-pipeline-core`, mirrors the three phases directly: one module per stage, with the stage signatures of Section 3 as the module boundaries. The intended design carries no runtime dependencies, for two reasons that matter to the specification rather than to engineering taste. A reconstruction that a reader cannot re-run in ten years is not auditable in any useful sense, and dependency drift is the most common reason such re-runs fail. Invariant 3 also constrains an implementation to reproduce its own output exactly, and every dependency is a surface through which behaviour can change underneath that guarantee.

A separate viewer package, `champ-pipeline-viewer`, is planned for inspecting a reconstruction and its report. It is presentation over $(\mathcal{U}, \Omega)$ and contributes nothing to the specification.

### 5.2 The input range a conforming implementation must account for

WhatsApp text exports vary in ways that Ingestion and Normalization have to absorb. The specification must account for regional date orderings, since the same eight-character date string is valid under both day-month-year and month-day-year conventions and the export carries no locale marker to settle it. It must account for both 12-hour and 24-hour time. It must account for message bodies that run across several lines, for bodies that are empty, and for lines carrying no sender at all, which is how encryption notices, group creation, and membership changes appear. Attachment references vary in form, including a doubled-filename variant and one with a trailing period. Bodies carry emoji and rich-text markup. System lines can bear dates far earlier than the surrounding conversation.

These categories are illustrated by a synthetic corpus in `data/synthetic_fixtures/`: five fixture files spanning 19 distinct edge-case categories, each fixture's categories recorded in `manifest.json`. The corpus is generated, and it contains no real personal message data of any kind.

The corpus and the implementation are separate claims, and the separation matters. The generator produces examples of these input forms. It does not parse them, reconcile them, or reconstruct anything, and the existence of a fixture exhibiting a doubled-filename attachment establishes that such inputs occur and must be specified for. It establishes nothing about any software's ability to read one. Where Section 5.2 says the specification must account for a case, the corpus is offered as an illustration of what that case looks like in practice, and no more.

The ambiguous-date case is the one that reaches back into the specification rather than merely stressing a parser. Two fixtures use day-month-year ordering and two use month-day-year, and a record whose date is valid under both, with nothing in the record to disambiguate, is exactly the input Section 3.3 routes to quarantine under `AMBIGUOUS_DATE_FORMAT`. The corpus makes that class of input concrete.

### 5.3 What exists and reproduces today

One artefact in the repository runs, and it is the fixture generator, `scripts/generate-synthetic-fixtures.js`. Invoking

```
node scripts/generate-synthetic-fixtures.js --seed 1 --count 5
```

reproduces the five committed fixtures and their manifest byte for byte. We ran it twice in succession and compared checksums across both runs and against the committed files; all three states are identical.

The scope of that result should be read narrowly. It establishes that synthetic input generation is seed-deterministic and therefore that the corpus is reproducible from a clean checkout. It establishes nothing about CARTA reconstruction, because no reconstruction code exists to run. There is no $\mathcal{U}$, no $\Omega$, and no deduplication or conflict count anywhere in this repository, and any claim drawn from this artefact is properly scoped to the generation of a deterministic synthetic corpus across a stated set of edge-case categories.

---

## 6. Evaluation

No evaluation is reported, because there is no implementation to evaluate.

This follows a deliberate scope decision rather than an omission. Building Ingestion, Normalization and Synthesis to the standard Sections 3 and 4 specify is substantial work, and a partial implementation produced quickly in order to report numbers would be worse than none: it would attach measurements to something that does not implement the specification the measurements would be read as validating. An evaluation section will be written when an evaluation has actually been run, populated from that run's output. Until then this paper reports no benchmark, no accuracy figure, and no performance measurement, and the reader should treat every property in Section 3.7 as a requirement placed on implementations rather than an observed result.

---

## 7. Discussion & Operational Considerations

### 7.1 End-to-end encryption

CARTA operates on decrypted local exports that the user's own device produced, using the platform's own export function, on an account the user controls. Encryption is not an obstacle the pipeline encounters, because the pipeline begins after the point where the platform has already decrypted the content for its owner. Nothing in Sections 3 or 4 attempts to read encrypted backup blobs, recover keys, or access an account other than the one performing the export, and no part of the specification would work any better if it could. This is worth stating plainly because reconstruction of chat history is adjacent to a body of forensic work that does address encrypted stores, and a reader arriving from that direction may reasonably expect such a claim. We make none.

The corollary is that CARTA inherits whatever the export function chose to include. A platform that omits a field from its export puts that field beyond reach of any conforming implementation, and reconstruction cannot recover information the export never carried.

### 7.2 Generalisation across platforms

The contract $\mathcal{F} \to \mathcal{R} \to (\mathcal{R}', \mathcal{Q}) \to (\mathcal{U}, \Omega)$ is stated without reference to any platform, and Normalization, Synthesis, the invariants and the report structure are defined over record types rather than over file formats. Ingestion is the exception, and it is necessarily platform-specific: Signal, Telegram and iMessage each export in their own form, with their own timestamp conventions, their own representation of system events, and their own attachment references.

Whether the rest of the contract survives contact with those formats is an open question, and we do not claim it has been answered. The specification has been developed against one platform's export conventions, illustrated by a corpus drawn from that same platform. A second platform could plausibly require reason codes the taxonomy in Section 3.3 does not anticipate, or exhibit a form of cross-fragment disagreement that the conflict definition in Section 3.4 does not capture. Establishing generalisation requires implementing Ingestion for at least one further platform and checking whether the downstream stages need amendment. That work has not been done.

### 7.3 Forensic and legal considerations

CARTA's provenance model and its reconstruction report are close in shape to chain-of-custody practice, which Section 8.2 discusses: each record traces to an identified source with a byte range and a content hash, originals are read and never modified, and the procedure emits an account of what it did. The resemblance is architectural and deliberate.

It is not a claim of admissibility. This paper offers no legal analysis, no jurisdiction-specific argument, and no forensic validation of any kind, and none of the three would follow from the specification alone. Establishing that a reconstruction produced under CARTA would be accepted as evidence anywhere would require an implementation, validation against known-ground-truth material, and legal argument that is outside both this paper's scope and its authors' competence to assert. The honest position is that the design borrows a discipline from forensic practice without claiming the standing that practice confers.

### 7.4 Limitations

**The related-work position is contingent on two documents we could not obtain.** Section 8.2 argues that the forensic lineage stages reconstruction without specifying a typed inter-stage contract. That argument rests on the sources we were able to read. Two in the same lineage resisted retrieval, and either could narrow the claim further, in which case the contribution reduces to the quarantine set and the report as the properties without precedent.

**The clustering procedure is deliberately unspecified.** Section 4.2 fixes the similarity criterion and leaves the grouping algorithm open, and transitive closure with a bounded diameter and connected components over a similarity graph can disagree on chained near-boundary records. Two conforming implementations may therefore produce different reconciliation clusters from the same input while each remaining internally deterministic. This is a real gap in the specification's strength, and closing it means choosing a rule and defending the choice, which we have not done.

**Determinism and idempotence are requirements, not demonstrated properties.** Invariant 3 constrains an implementation to reproduce its own output, and Section 4.1 identifies the tie-break that makes this attainable, but no implementation exists to exhibit it. Invariant 4 is weaker still: it is stated as prose about what Synthesis must not do, and the type-safe formalisation establishing that records in $\mathcal{U}$ are schema-compatible with those in $\mathcal{R}'$ is deferred rather than supplied.

**The corpus is illustrative and single-platform.** Nineteen edge-case categories across five synthetic files show that the input space is varied. They do not establish coverage of that space, and no claim of completeness attaches to the corpus.

---

## 8. Related Work

CARTA sits at the meeting point of four bodies of work, none of which addresses the reconstruction of consumer chat archives after a destructive restore, and all of which supply pieces of the machinery. The argument of this section is narrow and worth stating up front. Merging chat archives is not an open problem; working tools do it today. Staging forensic reconstruction as a pipeline is not new; it was published in 2014. Per-record provenance is not new either; forensics formalised it in the same year. What has not been specified is the contract such a reconstruction owes its reader: what enters and leaves each stage, what becomes of a record that cannot be safely interpreted, and what the procedure must report about its own behaviour.

### 8.1 Optimistic replication and replicated data types

Divergent replicas are the founding concern of optimistic replication. Parker and colleagues formalised the detection of mutual inconsistency between copies as early as 1983 [Parker et al. 1983], and Coda supplies the closest structural analogue to TCF's sequence: a client works disconnected, both sides advance, and the system reintegrates on reconnection, naming and flagging the conflicts it cannot resolve [Kistler & Satyanarayanan 1992]. Coda attempts reintegration. Condition 3 describes a platform that does not.

Convergent and commutative replicated data types give conditions under which divergent replicas provably converge. It is worth being precise about what those conditions are, because the obvious reading of them is wrong for our purposes. Shapiro and colleagues define state-based merge as a least upper bound over a join semilattice, taking two states and no ancestor at all [Shapiro et al. 2011]. Ancestry enters elsewhere: the mergeable replicated data types line models state as versions that "trace their origin to a common ancestor version" and merges via three-way merge against a lowest common ancestor [Kaki et al. 2019], and the certified treatment makes the existence of that ancestor a store precondition, assuming execution begins with a single branch so that any two branches have an LCA [Soundarapandian et al. 2022]. Reconciliation literatures beyond CRDTs share the assumption. Log-based reconciliation takes a common initial state plus per-replica action logs, and the formal treatment of filesystem synchronisation requires the update sequence to be applicable to the original filesystem state [Csirmaz & Csirmaz 2022].

What excludes TCF from the CRDT guarantee is therefore Condition 2, not ancestry. Convergence in the state-based model holds on the assumption that the system transmits payloads between replicas infinitely often over eventually reliable channels, and only so long as all replicas receive all updates [Shapiro et al. 2011]. TCF's branches exchange nothing during the divergence window. Nothing prevents a message set from being treated as a join semilattice under union after the fact; the difficulty is historical rather than algebraic, in that no synchronising representation existed while the two branches were diverging, so no convergence guarantee was ever purchased. Kleppmann and colleagues put the design premise directly, describing CRDTs as multi-user from the ground up, and note that side-by-side document versions and branches remain an area with little work behind it [Kleppmann et al. 2019].

Retrofitting reconciliation onto systems not built for it has been addressed in one direction only. Conflict-free replicated relations augment conventional relational schemas with causal metadata so that existing applications gain multi-synchronous access with little modification [Yu & Ignat 2020]. That retrofit is prospective: the metadata is in place before divergence begins. CARTA addresses the retrospective case, in which the artefacts already exist and no such metadata was ever recorded. Csirmaz and Csirmaz characterise why this regime resists the OT and CRDT framings, contrasting their constant low-latency communication and small deltas with synchronisation that happens in a single exchange after structural differences have accumulated over an extended period [Csirmaz & Csirmaz 2022]. TCF is that regime without the original state their model still assumes.

### 8.2 Timeline reconstruction in digital forensics

Forensic timeline reconstruction is the closest neighbour by problem shape, and the field's own systematisation describes a four-stage process of extraction, normalisation, arrangement and analysis, with multi-source combination handled informally [SoK 2025]. Provenance, quarantine, conflict detection, determinism and invariants do not appear there as formally defined terms.

Chabot and colleagues supply the most developed formal apparatus in this lineage, and two of their contributions bound our claim. The knowledge-representation paper defines a relation of support linking a footprint to the entity it was used to deduce, carried through the analysis and materialised in the output fact base [Chabot et al. 2014a]. Per-record provenance is thus formalised in forensics, and we do not claim otherwise. The relation is an identifier-to-identifier derivation edge; CARTA's provenance additionally binds a byte range and a content hash to each record and states an invariant requiring every synthesised record to carry at least one provenance entry (Section 3). The architecture paper published the same year defines a four-layer pipeline running from extraction through semantic interpretation and reasoning to an investigator-facing interface, covering the path "from the extraction of data to the analysis of the timeline produced" [Chabot et al. 2014b]. Staging a reconstruction process is therefore established prior art, and CARTA claims no priority over it.

The distinctions that remain are specific. That architecture describes its inter-stage relationship in prose, saying that normalisation translates extraction-layer data into the format the upper layer uses, without naming or typing that format; no stage carries a signature or a pre- and post-condition, and the completeness requirement is attributed to earlier work rather than discharged. Records that are irrelevant or unusable are filtered out to reduce downstream volume, which is the opposite disposition from quarantine. The correlation operator quantifies relatedness between two events in order to surface investigative links, and does not collapse two observations of one event into a canonical record; we flag the resemblance to CARTA's similarity-based deduplication explicitly because the two operate on similar inputs toward opposite ends. The outputs are a queryable triple store and a visualisation interface rather than a generated report.

### 8.3 Timeline tooling and chat-archive tooling

Plaso, with its predecessor log2timeline, is the reference open-source super-timeline engine, originally presented as an automation framework for producing a combined timeline from heterogeneous sources [Guðjónsson 2010]. Its treatment of failure is more developed than a summary dismissal would suggest: it defines five typed warning containers covering analysis, extraction, preprocessing, recovery and timelining, serialises them into the storage file, exposes them through `pinfo`, and flags event data in-band as corrupted or recovered. Records that fail are retained and inspectable. What they are not is part of the timeline output contract, since the export path iterates sorted events alone, so the artefact an analyst reads carries no representation of what failed. Plaso's documentation states no determinism, correctness or completeness property, and describes its own event model as currently free form with formal specification tracked as open work.

Its multi-source behaviour is concatenation followed by exact-duplicate suppression, and the suppression key incorporates the source data stream's path specification, so the same event observed in two independent sources is by construction never collapsed into one record. Conflicting observations across sources are not detected. Suppressed events are reported as an aggregate count, without recording which events were dropped or which surviving record absorbed them.

Chat-specific forensic work is abundant and single-acquisition. Anglano's analysis of WhatsApp on Android is the canonical reference, and its reconstruction claim is explicitly the correlation of artefacts within one device to recover contacts and message chronology [Anglano 2014]; a recent systematic review of secure instant-messaging forensics shows a taxonomy organised around acquisition, decryption and artefact interpretation, with no category for reconciling multiple archives [SLR 2025].

The strongest prior art is not in the literature at all. Working tools merge chat archives today. `bepaald/signalbackup-tools`, at 1,392 stars and under active development, imports one Signal backup into another; its documentation declines to deduplicate, advising users whose backups partly overlap to crop the source by date before merging. `natario1/whatsapp-database-merger` merges decrypted WhatsApp message databases with attention to referential integrity, deduplicating only incidentally through database uniqueness constraints, and drops media it cannot copy. Smaller projects come closer to CARTA's stated target: `tarikab7/whatsapp-chat-merger` merges plain-text WhatsApp exports into a unified timeline with claimed automatic deduplication and per-source colour tagging, and `frozenspider/chat-history-manager` normalises Telegram, WhatsApp, Signal and several other formats into one schema, whose author notes candidly that duplicate removal may also discard legitimate repeated messages. `EkriirkE/WAMerge` exists solely because its author encountered the TCF sequence and wrote a tool for it. Commercial products advertise the same capability.

These tools bound the contribution in a way the academic record does not. Merging is available, the problem is recognised, and neither can be claimed. What they establish instead is the gap. The tools differ in how they treat input they cannot parse, from silent discard through a printed per-record diagnostic to aborting the load outright, and none of them retains rejected input as an inspectable output. None couples merging with per-record provenance: `SecurityRonin/chat4n6` tags every recovered record with its evidence source and a confidence score but works on one acquisition and performs no merge, while the tools that merge carry no provenance. No merging tool found reports conflicts or states a determinism property, and the one deduplication predicate we examined in source — `tarikab7/whatsapp-chat-merger`'s — keys on timestamps floored into two-second buckets, which makes detection depend on where a pair falls relative to a bucket boundary rather than on how far apart the pair is. Adjacent formats have better-developed deduplication semantics, notably `ragibson/SMS-MMS-deduplication`, which enumerates attachment presence, country-code variance, timestamp precision and malformed encodings while taking care to avoid false positives, and which a reviewer may reasonably read as the closest existing analogue to CARTA's deduplication criterion.

Work of similar shape is appearing in adjacent domains. A deterministic preprocessing framework for heterogeneous network forensic datasets addresses incompatible schemas and timestamp formats and offers a mechanism for verifying consistency across runs [Preprocessing 2026]. The problem statement is close enough that the difference is worth stating rather than assuming: that work canonicalises datasets for correlation, while CARTA specifies reconciliation of overlapping archives of one conversation, with quarantine and reporting as part of the output contract.

### 8.4 Personal information management and multi-device practice

Personal archiving research describes the conditions in which TCF becomes possible. Marshall observes that individuals' digital belongings are distributed across many stores, some overlapping and some independent, and identifies device replacement as a point where local files are lost for good [Marshall 2008]. That divergence is derivational, between edited variants of one artefact, and the loss is genuine destruction, so it is a different configuration from the one defined here.

Two survey studies support the motivation without evidencing the phenomenon. A three-country survey of 1,423 participants found that 46% had experienced at least one data-loss incident and that, among those who recovered using backups, over half had backups that were outdated or incomplete [Resilience 2025]; incomplete restores are the common case rather than the exception. An earlier panel study reports that fewer than half of young adults back up regularly, though it models backup frequency as a protective behaviour rather than studying device replacement [Redmiles & Hargittai 2019]. Neither describes two independently persistent archives of one account, and we have found no HCI or CSCW study that does.

---

## 9. Conclusion & Reproducibility

This paper contributes a characterisation and a specification. The characterisation is TCF: three necessary conditions that together produce two archives of one account, each internally complete, overlapping in part, and irreconcilable through the platform that holds them. Bifurcation and independent persistence are the conditions that create the split; the restore that replaces rather than merges is the one that makes it permanent. The specification is CARTA: $\mathcal{F} \to \mathcal{R} \to (\mathcal{R}', \mathcal{Q}) \to (\mathcal{U}, \Omega)$, with typed data passing between stages, records that cannot be safely interpreted routed to a quarantine set with reason codes instead of being resolved by guessing, and a reconstruction report carrying provenance, quarantine, conflicts and counts as a first-class output.

Two of those elements are what the survey in Section 8 could not find anywhere among the neighbours. Every tool examined that merges chat archives either discards input it cannot parse, prints a diagnostic and moves on, or aborts the load, and none retains that input as an inspectable output. None emits a structured account of what the reconstruction did. The forensic lineage supplies staging and per-record provenance, both of which predate this work and neither of which we claim; the reference super-timeline engine retains typed warnings but keeps them out of the artefact an analyst reads. $\mathcal{Q}$ and $\Omega$ are the two properties this specification adds to that inheritance.

**Reproducibility.** One artefact in the accompanying repository runs and reproduces: the synthetic fixture generator. Running `node scripts/generate-synthetic-fixtures.js --seed 1 --count 5` regenerates the five committed fixtures and their manifest byte for byte, and we verified this across consecutive runs and against the committed files. That result covers deterministic generation of a synthetic corpus across 19 recorded edge-case categories, and it covers nothing else. CHAMP-Pipeline is not implemented, so no reconstruction, no unified archive, and no report can be reproduced from this repository, and no measurement in this paper depends on any that could be.

What remains is the part a specification cannot settle on its own. The strongest claim available here is that a reconstruction which cannot say what it dropped is indistinguishable, to the person reading it, from one that dropped nothing. Every merging tool we examined leaves its reader in exactly that position. Whether $\mathcal{Q}$ and $\Omega$ are the right instruments for closing that gap is a question an implementation will answer better than an argument.

---

## References

Bibliographic details resolved 2026-08-25 from authoritative metadata (Crossref DOI content negotiation, the arXiv API, and the HAL API) and cross-checked against `docs/PAPER_BLUEPRINT.md` §2.5. Where a resolved record differs from §2.5, the resolved record is used and the difference is noted in Drafting notes.

Anglano, C. (2014). Forensic analysis of WhatsApp Messenger on Android smartphones. *Digital Investigation*, 11(3), 201–213. DOI 10.1016/j.diin.2014.04.003

Bergman, O., Beyth-Marom, R., & Nachmias, R. (2006). The project fragmentation problem in personal information management. In *Proceedings of the SIGCHI Conference on Human Factors in Computing Systems (CHI '06)*, 271–274. DOI 10.1145/1124772.1124813

Breitinger, F., Studiawan, H., & Hargreaves, C. (2025). SoK: Timeline based event reconstruction for digital forensics: Terminology, methodology, and current challenges. *Forensic Science International: Digital Investigation*, 53, 301932. DOI 10.1016/j.fsidi.2025.301932. Preprint: arXiv:2504.18131. *(In-text tag currently `[SoK 2025]`.)*

Chabot, Y., Bertaux, A., Nicolle, C., & Kechadi, M.-T. (2014a). A complete formalized knowledge representation model for advanced digital forensics timeline analysis. *Digital Investigation*, 11(Supplement 2), S95–S105. DOI 10.1016/j.diin.2014.05.009. Preprint: arXiv:1903.01396

Chabot, Y., Bertaux, A., Nicolle, C., & Kechadi, T. (2014b). Automatic Timeline Construction and Analysis for Computer Forensics Purposes. In *2014 IEEE Joint Intelligence and Security Informatics Conference (JISIC)*, 276–279. DOI 10.1109/JISIC.2014.54

Chaudhary, R., Ryan, R., Ferdosian, N., Karie, N. M., & Li, Q. (2026). A Deterministic Forensic Preprocessing Framework for Heterogeneous Network Datasets: Formal Foundations, Implementation, and Empirical Validation. arXiv:2606.11565. *(In-text tag currently `[Preprocessing 2026]`.)*

Csirmaz, E. P., & Csirmaz, L. (2022). Data Synchronization: A Complete Theoretical Solution for Filesystems. arXiv:2210.04565v2

Dearman, D., & Pierce, J. S. (2008). "It's on my other computer!": Computing with Multiple Devices. In *Proceedings of the SIGCHI Conference on Human Factors in Computing Systems (CHI '08)*, 767–776. DOI 10.1145/1357054.1357177

Guðjónsson, K. (2010). *Mastering the Super Timeline With log2timeline*. GIAC (GCFA) Gold Certification paper, SANS Institute Reading Room. https://www.sans.org/white-papers/33438/

Hubers, C., Schwanen, T., & Dijst, M. (2008). ICT and temporal fragmentation of activities: An analytical framework and initial empirical findings. *Tijdschrift voor Economische en Sociale Geografie*, 99(5), 528–546. DOI 10.1111/j.1467-9663.2008.00490.x

Kaki, G., Priya, S., Sivaramakrishnan, K. C., & Jagannathan, S. (2019). Mergeable replicated data types. *Proceedings of the ACM on Programming Languages*, 3(OOPSLA), Article 154, 1–29. DOI 10.1145/3360580

Karger, D. R., & Jones, W. (2006). Data unification in personal information management. *Communications of the ACM*, 49(1), 77–82. DOI 10.1145/1107458.1107496

Kistler, J. J., & Satyanarayanan, M. (1992). Disconnected operation in the Coda File System. *ACM Transactions on Computer Systems*, 10(1), 3–25. DOI 10.1145/146941.146942

Kleppmann, M., Wiggins, A., van Hardenberg, P., & McGranaghan, M. (2019). Local-first software: you own your data, in spite of the cloud. In *Proceedings of the 2019 ACM SIGPLAN International Symposium on New Ideas, New Paradigms, and Reflections on Programming and Software (Onward! 2019)*, 154–178. DOI 10.1145/3359591.3359737

Marshall, C. C. (2008). Rethinking Personal Digital Archiving, Part 1: Four Challenges from the Field. *D-Lib Magazine*, 14(3/4). DOI 10.1045/march2008-marshall-pt1

Onik, A. R., Brown, J., Walker, C., & Baggili, I. (2025). A Systematic Literature Review of Secure Instant Messaging Applications from a Digital Forensics Perspective. *ACM Computing Surveys*, 57(9), 1–36. DOI 10.1145/3727641. *(In-text tag currently `[SLR 2025]`.)*

Parker, D. S., Popek, G. J., Rudisin, G., Stoughton, A., Walker, B. J., Walton, E., Chow, J. M., Edwards, D., Kiser, S., & Kline, C. (1983). Detection of Mutual Inconsistency in Distributed Systems. *IEEE Transactions on Software Engineering*, SE-9(3), 240–247. DOI 10.1109/TSE.1983.236733

Redmiles, E. M., & Hargittai, E. (2019). New Phone, Who Dis? Modeling Millennials' Backup Behavior. *ACM Transactions on the Web*, 13(1), 1–14. DOI 10.1145/3208105. *(Issue dated 2019; published online December 2018. Crossref records the year as 2018 — see Drafting note 17.)*

Saito, Y., & Shapiro, M. (2005). Optimistic replication. *ACM Computing Surveys*, 37(1), 42–81. DOI 10.1145/1057977.1057980

Shapiro, M., Preguiça, N., Baquero, C., & Zawirski, M. (2011). *A comprehensive study of Convergent and Commutative Replicated Data Types*. Research Report RR-7506, INRIA. https://inria.hal.science/inria-00555588

Soundarapandian, V., Kamath, A., Nagar, K., & Sivaramakrishnan, K. C. (2022). Certified mergeable replicated data types. In *Proceedings of the 43rd ACM SIGPLAN International Conference on Programming Language Design and Implementation (PLDI 2022)*, 332–347. DOI 10.1145/3519939.3523735. Preprint: arXiv:2203.14518

WhatsApp. (2025). Back Up or Restore Your Chats. *WhatsApp Help Center*. Archived by the Internet Archive, 2025-01-20; retrieved 2026-08-25. Supports only the restore-account constraint used in Section 1 — see Drafting note 1. https://web.archive.org/web/20250120024159/https://faq.whatsapp.com/1144861179456352

Wunder, J., Wash, R., Renaud, K., Oliveira, D. A., & Benenson, Z. (2025). Achieving Resilience: Data Loss and Recovery on Devices for Personal Use in Three Countries. In *Proceedings of the 2025 CHI Conference on Human Factors in Computing Systems (CHI '25)*, 1–26. DOI 10.1145/3706598.3714202. *(In-text tag currently `[Resilience 2025]`.)*

Yu, W., & Ignat, C.-L. (2020). Conflict-Free Replicated Relations for Multi-Synchronous Database Management at Edge. In *2020 IEEE International Conference on Smart Data Services (SMDS)*, 113–121. DOI 10.1109/SMDS49396.2020.00021.

### Software and repositories

Star counts and last-push dates re-checked against the GitHub REST API on **2026-08-25**.

bepaald. *signalbackup-tools*. GitHub repository, GPL-3.0. https://github.com/bepaald/signalbackup-tools — 1,392 stars; last push 2026-08-22 (both figures checked 2026-08-25).

natario1. *whatsapp-database-merger*. GitHub repository, no declared licence. https://github.com/natario1/whatsapp-database-merger — 78 stars; last push 2022-11-25 (both figures checked 2026-08-25).

tarikab7. *whatsapp-chat-merger*. GitHub repository, MIT. https://github.com/tarikab7/whatsapp-chat-merger — 1 star; last push 2026-06-22 (both figures checked 2026-08-25).

frozenspider. *chat-history-manager*. GitHub repository, MIT. https://github.com/frozenspider/chat-history-manager — 2 stars; last push 2026-06-29 (both figures checked 2026-08-25).

EkriirkE. *WAMerge*. GitHub repository. https://github.com/EkriirkE/WAMerge — 4 stars; last push 2025-03-20 (both figures checked 2026-08-25).

ragibson. *SMS-MMS-deduplication*. GitHub repository. https://github.com/ragibson/SMS-MMS-deduplication — 32 stars; last push 2026-08-09 (both figures checked 2026-08-25).

SecurityRonin. *chat4n6*. GitHub repository. https://github.com/SecurityRonin/chat4n6 — 39 stars; last push 2026-07-30 (both figures checked 2026-08-25).

---

## Drafting notes (not manuscript text)

**All nine outline sections are drafted as of 2026-08-25.** What remains is assembly, copy-edit, and the items below. None blocked drafting; items 1–4 and 11 block submission.

Open items carried from `docs/PAPER_BLUEPRINT.md` §2.5 plus items found during drafting.

1. **`[CITE-T2]` — RESOLVED 2026-08-25.** The architect chose, among three options presented (narrow to what's sourced / keep the merge claim and source it separately / drop the merge claim), to **narrow the Section 1 sentence** to the restore-account constraint the archived page actually supports, reframing "cannot be merged" as the paper's own observation (no native combine operation exists) rather than an attributed WhatsApp statement, with a forward pointer to the third-party tools in Section 8.3 as the evidence for that observation. The sentence now reads: "WhatsApp's own restore guidance requires the same account that created the backup [WhatsApp 2025]; it documents no operation for combining two backups, a gap that has motivated the third-party merge tools surveyed in Section 8.3." Updated in both `docs/DRAFT_PAPER.md` (this file, Section 1) and needs porting to `paper/sections/01_introduction.tex` + `paper/main.bib` (currently still shows `\citeTODO{CITE-T2}` and the staged-uncited `whatsapp_backup_restore` entry — cite it for real and delete the `\citeTODO`/`\nocite` tripwire). Original investigation trail preserved below for the record.

   **Original note (2026-08-25, before the above decision).** The archived source was successfully retrieved; it did not support the sentence as originally written. Routes 1–4 (recorded earlier, all retrieval failures): `faq.whatsapp.com/1144861179456352` (truncated), the same page with `?locale=en_US&cms_platform=android` (truncated), `faq.whatsapp.com/618575946635920` (served Gujarati), and a PDF/HTML scraper (vendor domain unsupported). **Route 5, Wayback Machine, 2026-08-25 — retrieval SUCCEEDED.** Via the CDX API, then `web.archive.org/web/<ts>id_/…` with gzip decoding (the first attempt returned undecoded gzip, which is why an earlier pass read as empty). Three English snapshots of `1144861179456352` were read in full: `20250120024159`, `20240723114725`, `20230313091926`. **Finding: the page supports only half of what Section 1 attributes to it.** It says, across all three snapshots, "To successfully restore your chats, you need to use the same phone number and Google Account or iCloud account you used to create the backup." That supports "each is restorable only by the account it belongs to". It says **nothing** about backups not being mergeable — the strings `merge`, `combine` and `separate backup` do not occur anywhere in the rendered prose of any snapshot (verified by stripping all script/style payloads and grepping the visible text). Section 1 currently claims the guidance "states the position plainly: separate backup files cannot be merged, and each is restorable only by the account it belongs to" — the first clause is unsourced, and "plainly" overstates a source that does not address merging at all. **Action taken:** the archived page is entered in `paper/main.bib` as `whatsapp_backup_restore`, **staged but deliberately uncited**, and the `\citeTODO` marker plus the `\nocite` tripwire were both LEFT IN PLACE. Citing it against the sentence as written would be exactly the forced resolution the marker exists to prevent. **Decision needed (architect's, not the assistant's):** either (a) narrow the Section 1 sentence to the restore-account constraint the archived page does support and cite `whatsapp_backup_restore`, or (b) keep the merging claim and source it separately — note that no further retrieval routes were attempted, per the instruction to stop at Wayback. Option (a) also fixes the durability problem, since the citation would point at an Internet Archive snapshot rather than a live vendor help page.
2. **`[CITE-VERIFY]` — BOTH RESOLVED 2026-08-25.** *Dearman & Pierce* is now **full-text-read**: the PDF at `dgp.toronto.edu/~dearman/papers/2008-MultiDeviceComp-CHI.pdf` was retrieved and read. It supports Section 2.4's claim — 27 interviewees, and "participants reported managing information across their devices as the most challenging aspect of using multiple devices", with the paper's stated complaint being "the diffusion of information across them". Note the scope: the study concerns files, email and bookmarks across devices generally, not message history, which is consistent with how Section 2.4 uses it. *Bergman et al.* is resolved to **abstract-level**: the bibliographic record is confirmed authoritatively via Crossref, and the abstract confirms the project-level framing Section 2.5 attributes ("someone who is working on a single project stores and retrieves information items relating to that project from separate format-related collections"). The body was not read, and the draft's claim does not require it. The `CITE-VERIFY` marker can be removed from Section 2.5's Bergman citation at copy-edit.
3. **Section 8.2 is contingent.** The claim that no prior work specifies a formal inter-stage contract rests on two Chabot-lineage documents that could not be obtained: the ORD2I paper body (*Digital Investigation* 15:83–100, DOI 10.1016/j.diin.2015.07.005) and Chabot's 2015 thesis (NNT 2015DIJOS037). If either defines typed stage inputs and outputs, Section 8.2's final paragraph must narrow to Q and Ω alone. The prose above is written so that this narrowing removes a sentence rather than restructuring the section.
4. **Repository citations** in 8.3 need a citation format decision (URL plus accessed-date plus commit SHA is the defensible option) and a star-count re-check at submission time, since counts drift. Figures used: 1,392 (`signalbackup-tools`), 78 (`natario1`). Others are deliberately described without counts because their counts are low enough to be misleading either way.
5. **Table 1** is reproduced from `PAPER_BLUEPRINT.md` §4 unchanged. Finding (f) suggests an additional row for information fragmentation (PIM); handled in §2.5 prose instead, to be revisited if a reviewer wants it tabular.
6. **Anonymisation.** §1's motivation paragraph is written without device models or dates. Confirm the venue's anonymisation requirements before deciding whether it stays first-person.
7. ~~Notation inconsistency between Section 1 and Section 3.~~ **FIXED 2026-08-25** (verified against actual file, not self-reported) — Section 1's contribution paragraph now reads `F → R → (R′, Q) → (U, Ω)`, matching Section 3.1 and `docs/CARTA-framework.md` §3.1.
8. **Invariant lists differ between the two source documents — tracked, not blocking.** `PAPER_BLUEPRINT.md` §2.4 enumerates completeness, provenance traceability, determinism, and idempotence. `CARTA-framework.md` §3.5 enumerates no-discard, provenance, no-silent-auto-resolution, and originals-unchanged. Section 3.7 follows §2.4's four and carries §3.5's other two as the non-destructive design principle (§3.6) and the Normalization quarantine rule (§3.3) — no guarantee is lost, this is a legitimate resolution, not an error. One redundancy worth trimming at the same pass: determinism currently appears twice, once as a design principle (§3.6) and once as Invariant 3 (§3.7), saying the same thing both times. Reconcile the two source documents to one canonical list before submission; not urgent now.
9. **Spelling — decided, not just flagged.** Running prose stays British (normalisation, behaviour, artefact). The three CARTA stage names and all algorithm-pseudocode identifiers (Normalization, SynthesizeCanonicalMessage, GroupIntoReconciliationClusters, ComputeStats) keep their spelling as fixed in `docs/CARTA-framework.md` and `docs/PAPER_BLUEPRINT.md` §2.3/§5, because they are defined proper nouns / code-identifier-style names tied to the actual repo (`core/src/normalization/`), not prose subject to dialect. No document needs to change.
10. **Section 3.4's operation list was out of sequence relative to Algorithm 1 — FIXED 2026-08-25.** Prose listed "groups... synthesises... orders... detects"; Algorithm 1 sorts before clustering (line 3 before line 4), and Section 4.1 makes the ordering-first point explicitly. Reordered to "orders... groups... synthesises... detects" to match. Found independently, not self-reported.
11. **Determinism claim in §5.3 and §9 was verified by running the generator, not carried over from a prior session's report.** `node scripts/generate-synthetic-fixtures.js --seed 1 --count 5` was executed twice on 2026-08-25; checksums of all six output files were identical across both runs and identical to the pre-existing committed files, so the working tree was unchanged by the check. The fixture directory was backed up first in case of mismatch. **Re-run this check at submission time** — it is the paper's only reproducibility claim, and it is the one claim a reviewer can falsify in under a minute.
12. **Corpus figures used in §5.2 and §9** come from `data/synthetic_fixtures/manifest.json` as it currently stands: five fixtures, 19 distinct edge-case categories, `attachment-double-filename` present in two fixtures. Re-derive from the manifest if the corpus is ever regenerated with different parameters, rather than trusting these numbers.
13. **Section 6 is deliberately two paragraphs.** If a venue's structure requires a fuller evaluation section, the correct response is to run an evaluation, not to expand the prose. Resist padding this section.
14. **No bibliography exists yet.** Citations throughout use author-year brackets as placeholders; §2.5 of `PAPER_BLUEPRINT.md` holds the full citation details, including DOIs and arXiv IDs, for every bracket used. Assembly will need those converted to a real reference list, at which point every entry should be re-resolved rather than transcribed.
15. ~~WRONG AUTHOR IN SECTION 8.1.~~ **FIXED 2026-08-25** (verified independently against Crossref and IEEE Xplore before fixing, not taken on Opus's word alone). Section 8.1 and the reference entry now both read Yu & Ignat. Source error in `docs/PAPER_BLUEPRINT.md §2.5` fixed in the same pass.
16. **Four in-text tags are topic labels rather than author-year, and should be converted at copy-edit.** `[SoK 2025]` → `[Breitinger et al. 2025]`; `[SLR 2025]` → `[Onik et al. 2025]`; `[Resilience 2025]` → `[Wunder et al. 2025]`; `[Preprocessing 2026]` → `[Chaudhary et al. 2026]`. Authors were unknown when the prose was drafted and are now resolved; each is noted against its entry in the References section. Not an error, but no venue will accept the topic-label form.
17. **Redmiles & Hargittai year ambiguity.** The in-text tag and reference say 2019 (the *ACM TWEB* 13(1) issue year); Crossref records 2018 (online publication, December 2018). Both are defensible. Pick one convention across the whole bibliography at assembly and apply it consistently.
18. **Two §2.5 records were corrected against authoritative metadata during this pass.** (a) Chabot et al. 2014b's title is *"Automatic Timeline Construction **and Analysis** for Computer Forensics Purposes"*; §2.5 records it without "and Analysis". (b) Chabot et al. 2014a's identifier: §2.5 records the Elsevier PII `S1742-2876(14)00052-8`; the resolvable DOI is **10.1016/j.diin.2014.05.009**, *Digital Investigation* 11(Supplement 2), S95–S105. The References section uses the resolved forms. `PAPER_BLUEPRINT.md` §2.5 was read-only this pass and still carries the older forms; reconcile it when it is next edited.
19. **Star-count drift check, 2026-08-25.** Re-checked all eight repositories from §2.5 against the GitHub API. Seven are unchanged from the survey figures. One drifted: `KnugiHK/WhatsApp-Chat-Exporter` 1,203 → 1,204. That repository is described in the draft without a count, so no manuscript text changes. The two counts the draft does use (1,392 and 78) both still hold as of this date.
20. ~~Section 8.3 makes citable claims about repositories it does not name.~~ **FIXED 2026-08-25.** All five (`tarikab7/whatsapp-chat-merger`, `frozenspider/chat-history-manager`, `EkriirkE/WAMerge`, `ragibson/SMS-MMS-deduplication`, `SecurityRonin/chat4n6`) now named directly in Sections 8.3 prose and added to the References' Software and repositories list, with star counts and last-push dates fetched fresh from the GitHub API at fix time (not carried over from the survey pass): 1/2026-06-22, 2/2026-06-29, 4/2025-03-20, 32/2026-08-09, 39/2026-07-30 respectively.
