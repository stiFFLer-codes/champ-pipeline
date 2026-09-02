# CHAMP-Pipeline

[![DOI](https://zenodo.org/badge/DOI/10.5281/zenodo.22260522.svg)](https://doi.org/10.5281/zenodo.22260522)

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
truth. `node tests/run-all.js` passes 5 checks. The associated arXiv preprint
is drafted and builds clean under pdflatex; submission is pending.

The full CHAMP-Pipeline build (additional formats, a reference UI, CI) remains
deferred future work. See [`STATE.md`](STATE.md) and [`PROJECT_PLAN.md`](PROJECT_PLAN.md).

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
node scripts/normalize.js [--offset <min>] [--infer] <fragment.txt>
```

Regenerate the fixtures:

```sh
node scripts/generate-synthetic-fixtures.js                         # the 5 parsing-edge-case fixtures
node scripts/generate-synthetic-fixtures.js --tcf-pair --delta 14 --epsilon 7   # the committed fragment pair
```

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
Framework*, Maitreya Sapariya (arXiv preprint, forthcoming).

## License

MIT — see [`LICENSE`](LICENSE).
