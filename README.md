# CHAMP-Pipeline

[![DOI](https://zenodo.org/badge/DOI/10.5281/zenodo.22260521.svg)](https://doi.org/10.5281/zenodo.22260521)

Reference implementation and formal specification of **CARTA** (Chat Archive
Reconstruction & Temporal Access) — a platform-agnostic framework for
reconstructing a chat history that has fragmented across two irreconcilable
device backups after primary-device failure, secondary-device use, and
primary-device recovery. That failure mode is named and defined in the
manuscript as **Temporal Communication Fragmentation (TCF)**.

- **CARTA** is the framework: a three-phase contract (Ingestion →
  Normalization → Synthesis) with typed inter-stage data and explicit
  reporting obligations. It is specified in [`docs/CARTA-framework.md`](docs/CARTA-framework.md)
  and in the manuscript under [`paper/`](paper/).
- **CHAMP-Pipeline** is this repository: a minimal, WhatsApp-specific
  implementation of that contract, built to make the manuscript's claims
  runnable against known ground truth.

## Status

Phase II-A (minimal conforming implementation) is complete: the pipeline runs
end to end — ingestion → normalization → fragment-scope date inference →
synthesis — and reconstructs a synthetic fragment pair to its known ground
truth. `node tests/run-all.js` passes 5 checks. The associated manuscript is
under revision at IJMADA.

The full CHAMP-Pipeline build (additional formats and a reference viewer) remains
deferred future work.

## Repository layout

| Path | Contents |
| --- | --- |
| `core/src/` | The pipeline: `ingestion/`, `normalization/`, `inference/`, `synthesis/` (Node stdlib only, zero dependencies) |
| `scripts/` | CLI entry points (`ingest.js`, `normalize.js`, `reconstruct.js`) and the synthetic-fixture generator |
| `tests/` | Self-checking test files; `run-all.js` runs every check |
| `data/synthetic_fixtures/` | Generated WhatsApp-export fixtures, including the `tcf-pair/` fragment pair with a ground-truth manifest |
| `docs/` | CARTA specification and paper-planning documents |
| `paper/` | LaTeX source for the arXiv manuscript |
| `frontend/` | Placeholder for the deferred reference viewer |

## Running the pipeline

Requires Node.js (a recent LTS). No install step — there are no dependencies.

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
| `--clustering one-to-one\|complete\|single` | How duplicate observations are grouped. `one-to-one` (default) puts at most one observation per fragment in a record and reports differing per-fragment counts as `dedup_ambiguity`; `complete` is the CARTA 1.0 complete linkage; `single` is connected components. |
| `--infer` | Fragment-scope date-order inference before Synthesis. |
| `--dt <ms>` | Deduplication window (default 0, exact match). |
| `--json` | Print the full (U, Ω) as JSON. |
| `--expect <manifest.json>` | Check the run against a `tcf-pair` manifest and exit non-zero on a mismatch. |

Regenerate the fixtures:

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

## Reproduce the paper's numbers

```sh
node scripts/experiments/run-all.js
```

This runs experiments E1, E2, E4, E5, E7, E8 and then E3 (alone, last),
writes their deterministic outputs to `results/` and their timings to
`results/timing/`, and regenerates `results/paper-numbers.json`, the one file
the paper's numbers are taken from. Name experiments to run only those, e.g.
`node scripts/experiments/run-all.js e4 e7` (paper-numbers still runs last).
E1 is the longest: about an hour on a 2-core laptop. `node tests/run-all.js`
then checks the corpus, committed-pair and survey numbers in
`results/paper-numbers.json` against a fresh computation.

## Running the tests

```sh
node tests/run-all.js
```

## Building the paper

```sh
cd paper
pdflatex main && bibtex main && pdflatex main && pdflatex main
```

## Synthetic data only

This repository contains **no real personal chat data**, anywhere — not in
code, tests, examples, or history. Every fixture is produced by the generator
in `scripts/`.

## Citing

See [`CITATION.cff`](CITATION.cff). Manuscript: *When Chats Split Apart:
Formalizing Temporal Communication Fragmentation and the CARTA Reconstruction
Framework*, Maitreya Sapariya (under revision at IJMADA).

## License

MIT — see [`LICENSE`](LICENSE).
