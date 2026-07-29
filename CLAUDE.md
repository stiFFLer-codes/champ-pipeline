# CHAMP-Pipeline — Project Memory

## What this project is
CHAMP-Pipeline is the open-source reference implementation of CARTA (Chat 
Archive Reconstruction & Temporal Access) — a platform-agnostic academic 
framework for solving Temporal Communication Fragmentation (TCF): the 
problem of a user's chat history splitting across two irreconcilable 
backups following primary device failure, secondary device use, and 
primary device recovery.

- **CARTA** = the abstract, three-phase framework (Ingestion → 
  Normalization → Synthesis). This is the research contribution. It is 
  documented in /docs/CARTA-framework.md, not implemented directly in 
  this repo's code.
- **CHAMP-Pipeline** = this repository. The concrete, WhatsApp-specific 
  software that implements CARTA end-to-end, proving the framework works.

This repo exists to support: a peer-reviewed journal paper, an arXiv 
preprint, a Zenodo-minted citable DOI, and a JOSS (Journal of Open Source 
Software) submission. Code quality, documentation, and reproducibility 
matter more here than in a typical side project — this is citable 
scholarly output.

## Hard rules — never violate these
1. **No real personal chat data, ever, anywhere in this repo.** Not in 
   code, not in tests, not in commit history, not in examples. All test 
   and demo data must come from the synthetic generator in /scripts.
2. **Naming is locked.** The repo, the core package, and the frontend 
   package are always: `champ-pipeline`, `champ-pipeline-core`, 
   `champ-pipeline-viewer`. Never introduce alternate casing or naming.
3. **CARTA and CHAMP-Pipeline are not interchangeable.** CARTA is the 
   framework (docs/theory). CHAMP-Pipeline is the software. Don't blur 
   the two in code comments, docstrings, or READMEs.

## Phase roadmap
- **Phase 0 — Repo scaffold: DONE.** Folder structure, LICENSE, 
  CITATION.cff, placeholder READMEs are in place.
- **Phase 1 — Framework definition:** in progress, happens primarily 
  outside this codebase (design discussion), result lands in 
  /docs/CARTA-framework.md.
- **Phase 2 — Synthetic data generator:** next. Produces realistic fake 
  WhatsApp exports (regional date formats, multi-line messages, system 
  notices, attachment quirks, empty-body messages) into 
  /data/synthetic_fixtures.
- **Phase 3 — CARTA core modules:** Ingestion, Normalization, Synthesis, 
  built in /core against the fixtures from Phase 2.
- **Phase 4 — CI/CD:** GitHub Actions for lint/test/golden-file checks, 
  a data-validation Action, and a release-to-Zenodo trigger workflow.
- **Phase 5 — Reference UI:** the Vite + React + Tailwind viewer, 
  rebuilt against synthetic data only.
- **Phase 6 — Publication infra:** Zenodo DOI, ORCID, arXiv, JOSS — 
  happens outside this repo's code.

## How we work — review discipline
- One task per session, one clear deliverable. Never attempt to build 
  multiple phases in a single pass.
- After finishing a task, stop and report exactly what was done — 
  including any deviation from the prompt, any assumption made, and any 
  edge case skipped. Do not silently smooth over ambiguity.
- Treat every implementation decision as something a peer reviewer might 
  question. If something feels like it's cutting a corner, say so rather 
  than hiding it in a clean-looking diff.

## Your role
Act as an elite reviewer and research partner, not just a code generator. 
That means: flag assumptions, surface edge cases proactively, push back 
if a request seems to conflict with the hard rules above, and hold this 
codebase to the rigor of something that will be cited in a paper and 
archived with a permanent DOI — not the rigor of a weekend hackathon 
project.
