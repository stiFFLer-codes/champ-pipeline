# Survey codebook: properties P1-P5

Drafted by Claude from the WP3 coded exemplars; approved by the author on 2026-10-20.

Each included tool is coded y / partial / n on each property in `results/survey/extraction.csv`.

| Property | y | partial | n |
|---|---|---|---|
| P1 retains unparseable input as output | input the tool cannot parse appears, marked, in its output | (not used) | skipped, warned about, or aborted |
| P2 per-record provenance | every output record carries its source AND a record-level locator (a line, row, source uid or content hash sufficient to find the record in its source) | the source is recorded per record without a locator, or a locator without the source; or it covers only some record types; or it is documented but not implemented | batch-level or aggregate only, or none |
| P3 conflict reporting | detects that sources disagree about the same message or item AND tells the user (report, warning, error or prompt) | detects the disagreement internally but does not tell the user | no detection (logging skipped or removed records is not a conflict report) |
| P4 stated determinism | the docs or code state that the same inputs give the same output | a narrower stated property (a tie or order rule, idempotent re-import, or a deterministic sub-output) | no statement; observed behaviour does not count |
| P5 structured report | a machine-readable or tabulated record of what the merge did: a JSON, CSV or table artefact, or a returned object that reaches the user or a client; an internal return value that is only logged counts as console text | a human-readable document only (e.g. PDF), or a plain-text log file | console text only, including machine-readable output printed only to the console |

## Refinement, 2026-10-20 (author decision)

The table above includes both points.

- P2: a locator is a line, row, source uid or content hash sufficient to find the record in its source (consistent with CARTA's own record_sha256).
- P5: a plain-text log file is partial; a JSON, CSV or table artefact, or a returned object, is y.

On 2026-10-20 every row was checked against the codebook (AI-assisted, using the recorded evidence; repositories were re-read only for the cited lines of disputed rows). Rows the codebook contradicted were recoded by author decision. The author personally re-checked the six claim-critical answers (Q01, Q04, Q06, Q12, Q39, Q40); the notes are in VERIFY_ANSWERS.tsv.

Counting (strict counts y only, lenient counts y and partial, "not determined" counts as n) is defined in `scripts/survey/tally.js`.

## Refinement, 2026-10-21 (author decision)

The table above includes it.

- P5: a returned object counts as y only if it reaches the user or a client; an internal return value that is only logged counts as console text. Reason: the decision of 2026-10-21 to code ludios/whatsapp-tail-merge P5 as n (its CLI only logs the MergeReport).
