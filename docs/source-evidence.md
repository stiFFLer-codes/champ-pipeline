# Source evidence for claims about other software

The IJMADA revision (round 1) states facts about three programs' source code.
This note gives the file and line for each claim, at the commit the paper
cites. Plaso lines were first read in WP6 (2026-10-20) from a clone; all lines
below were re-read on 2026-10-22 from `raw.githubusercontent.com` at the same
commits. Nothing was executed.

## Plaso (log2timeline/plaso, commit 3733f4d78f9c0c951a56bc8a5749fd0809c31aca)

Paper, Section 2.4: "In Plaso, the reference open-source super-timeline engine
(log2timeline/plaso, 2026), the text-log parsers keep a warning for each line
they fail to parse, with at most an 80-character excerpt rather than the line
itself, and stop once consecutive failures exceed 20; warnings are left out of
the exported timeline. Its duplicate suppression keys on event content and
source path and compares only consecutive same-timestamp events, so one event
seen in two sources is not collapsed, conflicts go undetected, and suppressed
events appear only as a count."

| Claim | Evidence |
|---|---|
| a warning per line that fails to parse | `plaso/parsers/text_plugins/interface.py:199-202` (`ProduceWarning("unable to parse log line: …")`); warnings are created in `plaso/parsers/mediator.py:586-623` |
| at most an 80-character excerpt | `text_plugins/interface.py:195-197`: a line longer than 80 characters is cut to 77 plus `...` |
| stops after consecutive failures | `text_plugins/interface.py:34` sets `_MAXIMUM_CONSECUTIVE_LINE_FAILURES = 20`; `:176-181` stops when the count **exceeds** 20, i.e. on the 21st consecutive failure, with the warning "more than 20 consecutive failures to parse lines" (also `jsonl_plugins/interface.py:29`) |
| warnings left out of the exported timeline | `plaso/multi_process/output_engine.py:276` iterates `GetSortedEvents` only; the output path has no warning-container reference |
| duplicate key = event content and source path | `plaso/containers/events.py:48-117` (`CalculateEventValuesHash`, MD5 over event-data attributes); the path spec enters through the event-data stream at `:30-32`. For metadata-only file entries the path spec is not in the key (`engine/worker.py:861-879`, `parsers/mediator.py:553-555`) |
| only consecutive same-timestamp events compared | `output_engine.py:424-430` skips an event only if its `timestamp_desc` and values hash equal the previous event's; the heap holds one timestamp at a time (`:96-98`, `:209-219`) |
| conflicts undetected | no conflict-detection code; events with unequal hashes are both output (`output_engine.py:424-459`) |
| suppressed events only as a count | `output_engine.py:429` (`number_of_duplicate_events += 1`); shown at `cli/status_view.py:314, 523` |

## keepsake (sokie/keepsake, commit 89cdfb6ff94939da3bd61b7ecf1a568bcb9194a0)

Paper, Section 4.4: "keepsake retries its matching at a shift of ±60 minutes,
which cannot reach +05:30."

- `server/lib/normalize.ts:33-36`: `dedupeKey(m, minuteOffset)` keys on the
  minute plus an offset in minutes, the from-me flag and the text.
- `server/lib/normalize.ts:98-109`: `const offsets = m.media ? [0] : [0, -60, 60]`;
  the comment says the ±60-minute fallbacks absorb time-zone or DST drift.
  Text messages only.

## chat-history-manager (frozenspider/chat-history-manager, commit d1f6f8879e151b1309118ec4d59d0b9298c9ba81)

Paper, Section 4.4: "Its code stops a merge when it detects a time shift between
datasets, a refusal rather than a report, but the check relies on source
identifiers that its WhatsApp text loader does not set, so it would not have
fired on this input."

- `crates/backend/src/merge/analyzer.rs:97-118`: when a master and a slave
  message share a source id and differ only in timestamp, the analysis bails
  with "Time shift detected between datasets!".
- Scope: the check needs a source id on both messages (`:97`). The WhatsApp
  text loader sets none (`crates/loaders/src/loader/whatsapp_text.rs:174`,
  `None /* source_id_option */`), so on WhatsApp text exports, the paper's
  input, the check cannot fire.
