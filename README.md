# CHAMP-Pipeline

[![Article DOI](https://img.shields.io/badge/article-10.68485%2Fijmada.20266168-blue.svg)](https://doi.org/10.68485/ijmada.20266168)
[![DOI](https://zenodo.org/badge/DOI/10.5281/zenodo.22260521.svg)](https://doi.org/10.5281/zenodo.22260521)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![Node.js 24](https://img.shields.io/badge/node-24-brightgreen.svg)](.nvmrc)
[![tests](https://github.com/stiFFLer-codes/champ-pipeline/actions/workflows/tests.yml/badge.svg)](https://github.com/stiFFLer-codes/champ-pipeline/actions/workflows/tests.yml)

**CHAMP-Pipeline** is the reference implementation of **CARTA** (Chat Archive
Reconstruction and Temporal Access), a platform-agnostic framework for
reconstructing one chat history from several independently preserved archives of
the same account. The accompanying article names that failure mode **Temporal
Communication Fragmentation (TCF)** and evaluates this implementation.

## Paper

Published in the *International Journal of Management and Data Analytics*:

> Sapariya, M. (2026). When Chats Split Apart: Formalizing Temporal Communication
> Fragmentation and the CARTA Reconstruction Framework. *International Journal of
> Management and Data Analytics, 6*(1), 449–470.
> https://doi.org/10.68485/ijmada.20266168

The article cites release v0.2.0 of this repository
(https://doi.org/10.5281/zenodo.23526491), and every number it reports is in
`results/paper-numbers.json` at that release. Section 3 of the article is the
reference text for CARTA 1.1.

## What TCF and CARTA are

TCF is the state a single messaging account reaches when its history splits
across two archives, each internally complete, that the platform will not
recombine: the timeline bifurcates when the primary device fails, both branches
keep accumulating with no synchronisation between them, and no platform operation
yields their union. CARTA is a three-phase contract (**Ingestion → Normalization
→ Synthesis**) with typed inter-stage data and explicit reporting obligations.
Synthesis returns the unified history **U** and a report **Ω** that states what
was merged, what was set aside and why, so that a reconstruction which dropped
something is distinguishable from one that dropped nothing.

This repository is the WhatsApp-specific implementation of that contract: a
small, zero-dependency Node.js pipeline that reconstructs a synthetic fragment
pair to its known ground truth. The full CHAMP-Pipeline build (further input
formats and a reference viewer) is deferred future work.

## Requirements

Node.js 24, pinned in [`.nvmrc`](.nvmrc). There is no install step: the pipeline
uses the Node standard library only and has no dependencies.

## Quick start

```sh
# every check in the repository
node tests/run-all.js

# reproduce the numbers the paper reports
node scripts/experiments/run-all.js
```

`node tests/run-all.js` runs the four `test-*.js` files plus the corpus checker,
five checks in total.

`node scripts/experiments/run-all.js` regenerates **E1, E2, E4, E5, E7 and E8,
and then E3 on its own last**. It writes their deterministic outputs to
`results/`, their timings to `results/timing/`, and regenerates
`results/paper-numbers.json`, the single file the paper's numbers are taken
from. Name experiments to run a subset, e.g. `node scripts/experiments/run-all.js
e4 e7` (paper-numbers still runs last). E1 is the longest at roughly an hour on a
2-core laptop.

Two studies have their own entry points and are not part of `run-all.js`:

```sh
# benchmark: the surveyed tools, unmodified, on the synthetic fragment pair
node scripts/survey/bench/run-benchmark.js

# survey: repository search -> metadata screen -> fetch -> tally
node scripts/survey/search.js
node scripts/survey/screen.js
node scripts/survey/fetch.js <temp-dir>
node scripts/survey/tally.js
```

The benchmark needs `git`, Node, Bun and Python 3.12; it clones each tool at its
pinned commit into a temporary directory outside the repository and writes
`results/benchmark/`. The survey needs network access and uses the
unauthenticated GitHub REST API (10 searches per minute); `fetch.js` clones into
the temporary directory you pass it.

## Running the pipeline

```sh
# reconstruct a fragment pair and check it against the manifest
node scripts/reconstruct.js --infer --expect data/synthetic_fixtures/tcf-pair/manifest.json \
  data/synthetic_fixtures/tcf-pair/tcf-F1-primary.txt \
  data/synthetic_fixtures/tcf-pair/tcf-F2-secondary.txt

# individual stages
node scripts/ingest.js --json <fragment.txt> ...
node scripts/normalize.js [--zone <IANA name | +HH:MM>] [--infer] <fragment.txt>
```

Options of `reconstruct.js` (the stage scripts take `--zone` and `--source-id` the same way):

| Option | Effect |
| --- | --- |
| `--zone <IANA name \| +HH:MM>` | The zone the fragments after it were exported in, until the next `--zone`. Fragments before any `--zone` are read as `+00:00`; Ω records each fragment's zone and whether it was declared or defaulted. |
| `--source-id <id>` | The id of the one fragment after it (it does not carry over). Without it a fragment's id is its file name, and two fragments with the same file name are refused. Ω records which applied (`fragments[].idSource`). |
| `--clustering one-to-one\|complete\|single` | How duplicate observations are grouped. `one-to-one` (default) puts at most one observation per fragment in a record and reports differing per-fragment counts as `dedup_ambiguity`; `complete` is the complete linkage of CARTA 1.0, superseded by `one-to-one` in 1.1; `single` is connected components. |
| `--infer` | Fragment-scope date-order inference before Synthesis. |
| `--dt <ms>` | Deduplication window (default 0, exact match). |
| `--json` | Print the full (U, Ω) as JSON. |
| `--expect <manifest.json>` | Check the run against a `tcf-pair` manifest and exit non-zero on a mismatch. |

## Regenerating the fixtures

```sh
node scripts/generate-synthetic-fixtures.js                         # the 5 parsing-edge-case fixtures
node scripts/generate-synthetic-fixtures.js --tcf-pair --delta 14 --epsilon 7   # the committed fragment pair
node scripts/generate-synthetic-fixtures.js --scenario <config.json> --out <dir>  # a scenario
```

`--scenario` reads a JSON config (seed, size, 2-4 fragments, δ, ε, timeline
lengths, per-fragment date order, clock and zone, and knobs (a)-(h) for
repeats, sender disagreement, ordering, attachment forms, a synthetic body
variant, a misdeclared zone, clock jitter and zone-dependent date ambiguity) and writes
`scenario-F<i>-primary|secondary.txt` plus a `manifest.json` with the ground
truth and the expected outcome. The parameters and their defaults are
`SCENARIO_DEFAULTS` in `scripts/generate-synthetic-fixtures.js`.

## Repository layout

| Path | Contents |
| --- | --- |
| `core/src/` | The pipeline: `ingestion/`, `normalization/`, `inference/`, `synthesis/` (Node standard library only, zero dependencies) |
| `core/` | `champ-pipeline-core` package manifest |
| `scripts/` | CLI entry points (`ingest.js`, `normalize.js`, `reconstruct.js`), the fixture generator and the corpus checker |
| `scripts/experiments/` | Experiment drivers E1–E8, `run-all.js` and `paper-numbers.js` |
| `scripts/survey/` | Survey pipeline and the `bench/` benchmark drivers |
| `tests/` | Self-checking test files; `run-all.js` runs every check |
| `data/synthetic_fixtures/` | Generated WhatsApp-export fixtures, including the `tcf-pair/` fragment pair with a ground-truth manifest |
| `docs/` | The CARTA specification and the source-evidence note for claims about other software |
| `paper/` | A pointer to the published article (the pre-review LaTeX draft is superseded) |
| `results/` | Committed experiment outputs, benchmark and survey data, and `paper-numbers.json` |

## Data and ethics

Every fixture is produced by `scripts/generate-synthetic-fixtures.js` from a seed.
The repository contains **no real personal chat data**, anywhere: no messages,
contacts, phone numbers, media or archives, in code, tests, examples, results or
history. No data were collected from people and no human subjects were involved,
so no ethics approval applies. The benchmark runs third-party tools on the same
synthetic fragment pair. The incident that motivates the work is described in the
article; it is not stored here.

## Citing

Cite the article for the method and the results, and the software for the code.
[`CITATION.cff`](CITATION.cff) carries both, and GitHub's "Cite this repository"
button shows the article.

- Concept DOI (all versions): [10.5281/zenodo.22260521](https://doi.org/10.5281/zenodo.22260521)
- This release (v0.2.0): [10.5281/zenodo.23526491](https://doi.org/10.5281/zenodo.23526491)

## License

MIT. See [`LICENSE`](LICENSE).

## Author

**Maitreya Sapariya**, Department of Information Technology, A. D. Patel Institute
of Technology (ADIT), CVM University, Gujarat, India
[ORCID 0009-0003-9346-3775](https://orcid.org/0009-0003-9346-3775)
