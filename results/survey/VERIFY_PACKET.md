# Verification packet: survey coding (WP4, 2026-10-16; revised WP5, 2026-10-19)

For the author. Every question below can be answered from the snippet or the grep lines printed with it. Record answers in `results/survey/VERIFY_ANSWERS.tsv` (`author_answer`: yes / no / unsure).

## Codebook (added 2026-10-19)

This section quotes the coding rules WP3 applied; nothing is recoded. **No source gives a written definition of y, partial and n per property.** WP3 wrote only the general rules below; where it drew the y / partial / n line is recorded only in the coded rows of `extraction.csv`, quoted in full under each property (every y and partial row, and every n row that carries a note). Sources:

- **[R]** `WP3_REPORT.md`, "Coding conventions" (end of §3-5) and §8 D5. The file is in the `champ-survey` worktree and is **untracked: it is in no commit**.
- **[T]** `scripts/survey/tally.js:9-17` and `:57-62` (committed).
- **[E]** `results/survey/extraction.csv` (committed): the code column and the note column (`<property>_ev`) of each row. Quoted verbatim below; file:line pointers are relative to that row's `evidence_base_url`.

**General rules (verbatim).**

- [R] "Values are y / n / partial. "not determined" means a targeted reading of the source did not settle the field; I did not guess."
- [R] D5: ""partial" and "not determined" are used alongside y/n wherever the evidence is mixed or unestablished."
- [R] "For the large projects (the openclaw crawlers, msgvault, PhoneBridge, Skyperious, amberkeep), some cells cite README statements with one code pointer rather than a full trace. Those cells are the least certain."
- [T] "strict counts y only; lenient counts y and partial. "not determined" counts as no in both."

### P1 retains unparseable input as output

- Written rule, [T]: "P1 retains unparseable input as output (unparseable: y when the value starts "retain as output", partial when it starts "partial", else n)". The `unparseable` column is free text; no row starts "partial".
- [R] tally over the 63 proposed includes: "Unparseable input: retained as output 1 (The-Omar-Files); print diagnostic 14; discard without notice 8; abort 14; other or mixed 4; not determined 22."
- **y** (1): Akif-b-Atif/The-Omar-Files: "retain as output: unmatched lines kept verbatim as "[UNPARSED - review this line]" and appended at the archive end, with a printed note"
- The `unparseable` values of the four tools asked about in Q29, Q31, Q33 and Q36 (all n):
  - sokie/keepsake: "delegated to whatsapp-chat-parser (a non-header line continues the previous message); an import with no parsed messages is rejected with HTTP 400"
  - openclaw/wacrawl: "not determined"
  - discordwell/green2blue: "not determined"
  - nicksmarto/sms_viewer: "malformed element: warning and skip; XML syntax error: error logged; lxml recover mode"

### P2 per-record provenance

- Written rule: none.
- **y** (3):
  - discordwell/green2blue: "source_type, source_path and source_fingerprint per import run; source_uid and source thread per message: src/green2blue/archive/android_import.py:43-70; src/green2blue/archive/android_import.py:142-155"
  - minvws/DSA-WhatsApp-merger (borderline, excluded 2026-10-16): "data_holder column per message (which person's export it came from): chatmerger/WhatsAppMerger.py:306"
  - nicksmarto/sms_viewer: "file_messages table maps every logical message to each source file it occurs in, including dropped duplicates: app.py:36-39; app.py:1044"
- **partial** (8):
  - BenjaminJornet/PhoneBridge: "README describes provenance (which backup/device/path) as in progress (README.md:52; README.md:62)"
  - Daily-AC/chatdrop: "original import files retained (cli/chatdrop.py:342-348); messages linked to their import (cli/chatdrop.py:241-245)"
  - openclaw/imsgcrawl: "per-message events table (internal/archive/events.go:51-74)"
  - openclaw/telecrawl: "revision events (README.md:124-125)"
  - openclaw/wacrawl: "revisions/tombstones; contact identity provenance (internal/store/contact_identity.go:198)"
  - sokie/keepsake: "each message carries its source type (export/wts/msgstore), not the file; chat metadata lists every import: server/lib/normalize.ts:38-43; server/index.ts:172-175"
  - tarikab7/whatsapp-chat-merger: "public/chat-merger.html:320 (sourceId, sourceName per record); src/lib/whatsapp-parser.ts:353-357; src/lib/whatsapp-parser.ts:445-449 (duplicateOf)"
  - tmo1/sms-db: "each row stores source_format (format, not file): sms-db.pl:49"
- **n with a note** (1 of 51 n; the other n rows have no note):
  - Akif-b-Atif/The-Omar-Files: "merge_log.json names the source file per merge batch, not per record (Pipeline/scripts/3_merge_export.py:179-196)"

### P3 conflict reporting

- Written rule: none.
- **y** (3):
  - frozenspider/chat-history-manager: "Conflict sections (same source id, different content) returned for the user to resolve Replace/DontReplace; only for sources that carry source ids (not .txt): crates/backend/src/merge/analyzer.rs:29-31; crates/backend/src/merge/analyzer.rs:97-131; crates/backend/src/merge/analyzer.rs:333-367; crates/backend/src/merge/merger.rs:521-528; crates/loaders/src/loader/whatsapp_text.rs:174"
  - ludios/whatsapp-tail-merge: "counts matched messages whose timestamp/type/text differ and warns; base version kept: src/merge.ts:900-929"
  - openclaw/imsgcrawl: "identity conflicts are raised as errors (internal/archive/identity.go:31-96)"
- **partial** (1):
  - openclaw/wacrawl: "conflicting contact identities detected (internal/store/contact_identity.go:115-169)"
- **n with a note** (8 of 59 n; the other n rows have no note):
  - aphexcx/titanium-backup-merger: "prints each message skipped or replaced (main.py:65-81)"
  - casabre/whatsapp-merge: "prints a duplicate analysis of source and merged databases (src/whatsapp_merge/analysis.py:10-34)"
  - hknaack/AndroidMessageMerger: "prints each skipped existing message (mmssms_merge.sh:1028)"
  - Jacksgong/wechat-backup-merge: "prints "replace the file" for each differing file (merge_wechat_backup.py:33-36)"
  - natario1/whatsapp-database-merger: "prints how many rows a unique constraint skipped (counts only): Main.kt:237-239"
  - NumesSanguis/naver_line_restore_chat_root: "a separate manual SQL lists same-content rows (sql/extra/chat_history_check-no-duplicates.sql)"
  - ragibson/SMS-MMS-deduplication: "the log pairs each removed message with the one kept (dedupe_texts.py:252-276), a removal record rather than a conflict report"
  - suurjaak/Skyperious: "shows per-chat differences in the GUI before merging (src/skyperious/gui.py:382)"

### P4 stated determinism

- Written rule, [R]: ""Stated determinism" counts only a property stated in the code or documentation. Observed behaviour does not count."
- **y** (0): none.
- **partial** (4):
  - Akif-b-Atif/The-Omar-Files: "tie rule stated (archive entries first, then new entries in file order): Pipeline/scripts/3_merge_export.py:116-126; re-merging an already merged file adds nothing: Pipeline/scripts/3_merge_export.py:50-52"
  - openclaw/wacrawl: "backup exports "deterministic JSONL shards" (README.md:93)"
  - sokie/keepsake: "comment states that re-importing the same file must be a no-op: server/lib/normalize.ts:4-10"
  - suitangi/Crosstalk: "upsert described as idempotent (packages/ingest/src/index.ts:6)"
- **n with a note** (5 of 59 n; the other n rows have no note):
  - aphexcx/titanium-backup-merger: "output order is Python set iteration (main.py:106-112)"
  - csm10495/merge_and_dedupe: "output sorted by date (merge_and_dedupe.py:131-136); not stated as a property"
  - devadvance/sms-backup-reader-2: "a test name says "skips duplicate messages deterministically" (packages/lib/src/parser.test.ts:244); no stated property in docs"
  - natario1/whatsapp-database-merger: "inputs processed in file-name order (Main.kt:38), not stated as a property"
  - tarikab7/whatsapp-chat-merger: "HTML comment states a stable sort by timestamp then parse order (public/chat-merger.html:569-575); an ordering note, not a determinism property"

### P5 structured report

- Written rule, [R]: ""Structured report" means a machine-readable or tabulated artefact. Plain stdout lines do not count."
- **y** (5):
  - Akif-b-Atif/The-Omar-Files: "Pipeline/logs/merge_log.json, counts per merge (added, duplicates skipped, placeholders superseded): Pipeline/scripts/3_merge_export.py:179-196"
  - discordwell/green2blue: "ArchiveReport and a duplicate_message_count column (src/green2blue/archive/stage.py:106-116; src/green2blue/archive/db.py:115)"
  - nicksmarto/sms_viewer: "source_files table: per-file counts, overlap (redundant), unique-only count, safe_to_delete: app.py:329-345"
  - sokie/keepsake: "per import JSON {added, merged} returned and stored in the chat's sources list (counts only): server/index.ts:164-178"
  - theetherGit/wamerge: "merge-report.txt, counts only (src/wamerge/steps/merge.py:9; src/wamerge/steps/merge.py:29; src/wamerge/steps/merge.py:66-70)"
- **partial** (1):
  - minvws/DSA-WhatsApp-merger (borderline, excluded 2026-10-16): "PDF/XLSX output states original and merged counts (chatmerger/WhatsAppMerger.py:66-69)"
- **n with a note** (22 of 57 n; the other n rows have no note):
  - akx/merge-sms-backup: "stdout counts before/after dedup (merge-pickle.py:13; merge-pickle.py:18)"
  - alicin/wamove: "stdout counts: chats created/merged, messages added/already there, media found/missing (src/wamove/cli.py:182-190)"
  - aphexcx/titanium-backup-merger: "stdout counts (main.py:92-93; main.py:126)"
  - B16f00t/whapa: "stdout counts (libs/whamerge.py:154-199)"
  - bepaald/signalbackup-tools: "log lines with counts (signalbackup/removedoubles.cc:131-134)"
  - csm10495/merge_and_dedupe: "stdout totals (merge_and_dedupe.py:232-246)"
  - frozenspider/chat-history-manager: "analysis sections are returned over gRPC to the UI (crates/backend/src/grpc/server/merge_service.rs:16-69), not written as a report"
  - Inzyz/whatsapp-android-to-iphone: "summary printed; --dry-run reports without writing (wa2ios/cli.py:56-58; wa2ios/cli.py:234)"
  - KnugiHK/WhatsApp-Chat-Exporter: "log line per merged file (Whatsapp_Chat_Exporter/utility.py:391)"
  - ludios/whatsapp-tail-merge: "MergeReport (per-table inserted/matched/skipped) is logged, not written to a file: src/merge.ts:44-70; src/main.ts:105-124"
  - minhaz725/whatsapp-cross-platform-merge-and-recovery: "stdout counts"
  - namnoops/merjapp: "log lines (printToLog)"
  - natario1/whatsapp-database-merger: "stdout progress only"
  - pl402/wa-fuse: "stdout counts (transfer_media.py:96)"
  - radj/AndroidSMSBackupRestoreCleaner: "debug log with skip count (clean.py:115)"
  - ragibson/SMS-MMS-deduplication: "plain-text per-removal log and a stdout count table (dedupe_texts.py:311-315; dedupe_texts.py:352-361); not machine-readable"
  - rbouaf/restore-messages-disconnected-beeper: "stdout counts: overlaps, added, kept, duplicates skipped (merge.py:325; merge.py:382-387)"
  - sch3m4/wforensic: "stdout counts (tools/merge.py:157)"
  - sllvn/ios-sms-merge: "prints found/created per row (merge_messages.rb:13-50)"
  - suitangi/Crosstalk: "stdout counts (packages/ingest/src/cli.ts:83)"
  - TheSecurityDev/Signal-Backup-V2-Merge: "stderr progress and skipped-duplicate count (merge_signal_backup_v2.py:61-84; merge_signal_backup_v2.py:361)"
  - tmo1/sms-db: "stdout totals incl. duplicates and ignored (sms-db.pl:233)"

**What an answer does (stated before you answer).**
- **Q01-Q26** test a property WP3 coded **y** or **partial**. A **no** is applied as a coding correction in `extraction.csv`: the property is set to **n**, with the note "author verification 2026-10-16". **yes** and **unsure** change nothing.
- **Q27-Q38** ask "Is there any sign of X?" about a property coded **n**. A **yes** is applied as a coding correction in `extraction.csv`: the property is set to **y**, with the note "author verification 2026-10-19". **no** and **unsure** change nothing (a no confirms n).
- **Q39-Q40** (added 2026-10-19) test an upgrade to **y** of a property coded **partial** (Q39) or **n** (Q40). A **yes** is applied as for Q27-Q38: the property is set to **y**, with the note "author verification 2026-10-19". **no** and **unsure** change nothing.
- **Two questions on the same tool and property.** Q39 repeats Q22 (chatdrop P2) and Q40 repeats Q32 (wacrawl P5). If the two answers would set different codes (for chatdrop, Q22 no and Q39 yes), neither is applied and the pair is reported to you. An answer that changes nothing does not block the other (for wacrawl, a yes to either Q32 or Q40 sets y).
- After applying, `node scripts/survey/tally.js` is re-run and every changed count is reported.

**Rows.**
- Every included tool coded y or partial on any of P1-P5 (15 tools, 24 questions).
- The 3 borderline tools excluded by author decision 2026-10-16 (they enter only `survey.sensitivity.*`). minvws/DSA-WhatsApp-merger has 2 questions. MPavion/whatsapp-transcriber and sebnembasak/wa-rescue are coded n on all of P1-P5, so there is no y/partial claim to test. They get no question: under the WP4 rule only a "no" could change a code, and they have no y or partial to downgrade. The 2026-10-19 rule did not add "any sign" questions beyond the 5 tools below, so they still get none.
- Two upgrade questions added 2026-10-19 on evidence noted in WP4: chatdrop P2 (Q39) and wacrawl P5 (Q40).

**The 5 tools closest to all five properties.** Ranked by the number of properties coded y or partial, then the number coded y, then name: The-Omar-Files (3, 2), keepsake (3, 1), wacrawl (3, 0), green2blue (2, 2), sms_viewer (2, 2). The next tool, imsgcrawl, has (2, 1). Each of the top 5 gets one "any sign" question per property coded n (12 questions).

**Properties.** P1 retains unparseable input as output; P2 per-record provenance; P3 conflict reporting; P4 stated determinism; P5 structured report.

**Grep evidence.** `git grep -n -I -i -E '<regex>' <sha> -- . ':(exclude)*.lock' ':(exclude)package-lock.json' ':(exclude)*.min.js'` on the clone at the pinned SHA. Regexes:
- P1: `unpars|unparsable|malformed|invalid line|could not parse|failed to parse|unrecognized|unrecognised|quarantin|reject`
- P2: `provenance|source_?file|source_?path|sourceFile|origin(al)?_?file|line_?(no|num)`
- P3: `conflict|disagree|mismatch|diverg|inconsisten`
- P4: `determinis|idempoten|reproducib|stable.?sort|same output|byte.?identical|no-op`
- P5: `report|summary|json\.dump|JSON\.stringify|json\.Marshal|writeFile|to_csv|csv\.writer`

Hit counts include documentation and tests. Only the lines most relevant to the question are printed, each tagged "grep hit" or "context" (a line shown to explain a hit); the full hit list is reproducible with the command above.

Total: 40 questions (cap 40).


## Akif-b-Atif/The-Omar-Files (`27faf12e3e`)

### Q01. P1 retains unparseable input as output: coded y

**Claim.** A line that matches no known pattern is written to the normalized output verbatim, prefixed "[UNPARSED - review this line]", instead of being dropped.

**Permalink.** https://github.com/Akif-b-Atif/The-Omar-Files/blob/27faf12e3e007ece86a0dab794c50be6ceedf3de/Pipeline/scripts/2_normalize_export.py#L91-L97

```python
   91      for m in messages:
   92          if m.get('unparsed'):
   93              # Matched no known pattern at all — kept verbatim, flagged,
   94              # never dropped.
   95              out_lines.append(f"[UNPARSED - review this line] {m['msg']}")
   96              unparsed_count += 1
   97              continue
```

**Extra snippet (added 2026-10-19): the same function writes out_lines to the normalized file.** https://github.com/Akif-b-Atif/The-Omar-Files/blob/27faf12e3e007ece86a0dab794c50be6ceedf3de/Pipeline/scripts/2_normalize_export.py#L114-L118

```python
  114      NORMALIZED_DIR.mkdir(exist_ok=True)
  115      out_name = raw_path.stem.replace('_raw', '') + '_normalized.txt'
  116      out_path = NORMALIZED_DIR / out_name
  117      with open(out_path, 'w', encoding='utf-8') as f:
  118          f.write('\n'.join(out_lines) + '\n')
```

**Question.** Does the snippet add a line that matched no known pattern to the output (`out_lines.append(...)`, line 95) instead of dropping it?

### Q02. P4 stated determinism: coded partial

**Claim.** The merge function's documentation states an ordering rule for equal timestamps (archive entries first, then new entries in their original order); WP3 coded this partial because it is an ordering rule, not a stated determinism property of the whole output (the file also states re-running adds nothing, 3_merge_export.py:50-52).

**Permalink.** https://github.com/Akif-b-Atif/The-Omar-Files/blob/27faf12e3e007ece86a0dab794c50be6ceedf3de/Pipeline/scripts/3_merge_export.py#L116-L126

```python
  116  def merge_dated_sequences(archive_seq, new_seq, existing_texts, archive_slots):
  117      """
  118      Stable chronological merge of two (dated_block, trailing) sequences.
  119      Both are assumed pre-sorted by datetime. Skips any new_seq entry
  120      that is_superseded() judges already covered by the archive. On a
  121      tie (equal datetime), all of archive_seq's entries at that
  122      timestamp come first, then new_seq's, in new_seq's own original
  123      order — existing content is never reordered relative to itself.
  124      Returns (merged_sequence, added_count, skipped_duplicate_count,
  125      skipped_placeholder_count).
  126      """
```

**Question.** Does the text in the snippet state a fixed rule for how messages with equal timestamps are ordered?

### Q03. P5 structured report: coded y

**Claim.** Each merge appends a JSON entry to Pipeline/logs/merge_log.json with the source file and named counts (added, duplicates skipped, placeholders superseded).

**Permalink.** https://github.com/Akif-b-Atif/The-Omar-Files/blob/27faf12e3e007ece86a0dab794c50be6ceedf3de/Pipeline/scripts/3_merge_export.py#L185-L196

```python
  185      entry = {
  186          "timestamp": datetime.now().isoformat(timespec='seconds'),
  187          "source_file": source_file,
  188          "new_messages_added": added,
  189          "duplicates_skipped": skipped_dup,
  190          "placeholders_superseded_by_archive": skipped_placeholder,
  191      }
  192      if note:
  193          entry["note"] = note
  194      log.append(entry)
  195      with open(LOG_PATH, 'w', encoding='utf-8') as f:
  196          json.dump(log, f, indent=2, ensure_ascii=False)
```

**Question.** Does the snippet write a JSON log entry holding named counts such as `new_messages_added` and `duplicates_skipped`?

## discordwell/green2blue (`8781b3c4be`)

### Q04. P2 per-record provenance: coded y

**Claim.** Every message row stores a per-record source id (`source_uid`, a SHA-256 of the raw exported record, android_import.py:151-152), its source type, and the import run it came from; each import run stores the source path and fingerprint (db.py:34-43).

**Permalink.** https://github.com/discordwell/green2blue/blob/8781b3c4be0f4385d7e4e7c8d48e33a555228f53/src/green2blue/archive/db.py#L69-L83

```python
   69  CREATE TABLE IF NOT EXISTS messages (
   70      id INTEGER PRIMARY KEY AUTOINCREMENT,
   71      source_uid TEXT NOT NULL UNIQUE,
   72      source_type TEXT NOT NULL,
   73      import_run_id INTEGER NOT NULL,
   74      conversation_id INTEGER NOT NULL,
   75      direction TEXT NOT NULL,
   76      sent_at_ms INTEGER NOT NULL,
   77      read_state TEXT NOT NULL,
   78      service_hint TEXT,
   79      subject TEXT,
   80      body_text TEXT,
   81      has_attachments INTEGER NOT NULL DEFAULT 0,
   82      has_url INTEGER NOT NULL DEFAULT 0,
   83      raw_json TEXT NOT NULL,
```

**Question.** Does each row of the `messages` table have columns that record where the message came from (`source_uid`, `source_type`, `import_run_id`)?

### Q05. P5 structured report: coded y

**Claim.** The iOS staging step writes a JSON metadata file containing a `report` block (message counts, warnings, latest merge with its duplicate count).

**Permalink.** https://github.com/discordwell/green2blue/blob/8781b3c4be0f4385d7e4e7c8d48e33a555228f53/src/green2blue/archive/stage.py#L106-L116

```python
  106          "report": {
  107              "messages": report.summary.messages,
  108              "messages_with_attachments": report.messages_with_attachments,
  109              "messages_with_url": report.messages_with_url,
  110              "warnings": list(report.warnings),
  111              "latest_merge": report.latest_merge,
  112              "latest_merge_winner_source_counts": report.latest_merge_winner_source_counts,
  113              "unsupported_feature_counts": report.unsupported_feature_counts,
  114          },
  115      }
  116      metadata_path.write_text(json.dumps(payload, indent=2, sort_keys=True) + "\n")
```

**Question.** Does line 116 write the `report` block shown above to a file as JSON?

## nicksmarto/sms_viewer (`bea638c384`)

### Q06. P2 per-record provenance: coded y

**Claim.** For every source file, the indexer records which logical messages that file contained (file id paired with each message hash), including occurrences that de-duplication drops (comment at app.py:36-40).

**Permalink.** https://github.com/nicksmarto/sms_viewer/blob/bea638c384dcf38280398068d2ea6bbed81769aa/app.py#L1040-L1046

```python
 1040          # Record which logical messages this file contained, and its aggregates.
 1041          with conn:
 1042              if file_hashes:
 1043                  conn.executemany(
 1044                      'INSERT OR IGNORE INTO file_messages (file_id, msg_hash) VALUES (?, ?)',
 1045                      [(file_id, h) for h in file_hashes],
 1046                  )
```

**Question.** Does the snippet record, for each file, which messages it contained (`file_id` paired with each message hash `msg_hash`)?

### Q07. P5 structured report: coded y

**Claim.** A `source_files` table stores per-file counts: messages, MMS, how many also appear elsewhere, how many appear only in this file, and whether the file is safe to delete.

**Permalink.** https://github.com/nicksmarto/sms_viewer/blob/bea638c384dcf38280398068d2ea6bbed81769aa/app.py#L333-L346

```python
  333              conn.execute('''
  334                  CREATE TABLE IF NOT EXISTS source_files (
  335                      id INTEGER PRIMARY KEY AUTOINCREMENT,
  336                      filename TEXT NOT NULL,
  337                      size_bytes INTEGER,
  338                      mtime INTEGER,
  339                      date_min INTEGER,           -- epoch ms, from this file's messages
  340                      date_max INTEGER,
  341                      msg_count INTEGER,          -- distinct logical messages in this file
  342                      mms_count INTEGER,          -- MMS entities kept from this file
  343                      redundant_count INTEGER,    -- of msg_count, how many also appear elsewhere
  344                      unique_only_count INTEGER,  -- messages found ONLY in this file (0 => fully covered)
  345                      safe_to_delete INTEGER      -- 1 if in the computed zero-loss deletable set
  346                  );
```

**Question.** Does this table store, for each backup file, counts such as `unique_only_count` and a `safe_to_delete` flag?

## sokie/keepsake (`89cdfb6ff9`)

### Q08. P2 per-record provenance: coded partial

**Claim.** Each message carries a `source` field naming the kind of import (export, wts or msgstore), not the file or line; WP3 coded this partial for that reason (the per-chat import list does name the file, server/index.ts:174).

**Permalink.** https://github.com/sokie/keepsake/blob/89cdfb6ff94939da3bd61b7ecf1a568bcb9194a0/shared/types.ts#L39-L52

```ts
   39  export interface Msg {
   40    id: string
   41    /** epoch milliseconds */
   42    ts: number
   43    sender: string
   44    fromMe: boolean
   45    system?: boolean
   46    text?: string
   47    media?: Media
   48    reactions?: Reaction[]
   49    edited?: boolean
   50    quoted?: QuotedMsg
   51    source: 'export' | 'wts' | 'msgstore'
   52  }
```

**Question.** Does every message (`Msg`) have a `source` field saying which kind of import it came from (line 51)?

### Q09. P4 stated determinism: coded partial

**Claim.** A source comment states that re-importing the same file must be a no-op; WP3 coded this partial (an idempotence statement, not a determinism property of the output).

**Permalink.** https://github.com/sokie/keepsake/blob/89cdfb6ff94939da3bd61b7ecf1a568bcb9194a0/server/lib/normalize.ts#L4-L10

```ts
    4  /**
    5   * Merging rules, born from how the two sources differ:
    6   * - Export .txt timestamps have MINUTE precision; wtsexporter has seconds.
    7   * - Exports lack reactions; wtsexporter has them.
    8   * - The same message must not appear twice when both sources are imported,
    9   *   and re-importing the same file must be a no-op.
   10   */
```

**Question.** Does the comment state that importing the same file again must change nothing ("must be a no-op")?

### Q10. P5 structured report: coded y

**Claim.** Each import stores a record with the file name and the counts `added` and `merged` in the chat's `sources` list, and returns them as JSON.

**Permalink.** https://github.com/sokie/keepsake/blob/89cdfb6ff94939da3bd61b7ecf1a568bcb9194a0/server/index.ts#L164-L178

```ts
  164      const meta: ChatMeta = {
  165        id: chatId,
  166        name: existing?.name ?? name,
  167        me: existing?.me ?? me,
  168        participants: [...new Set([...(existing?.participants ?? []), ...participants])],
  169        messageCount: messages.length,
  170        firstTs: messages[0]?.ts,
  171        lastTs: messages[messages.length - 1]?.ts,
  172        sources: [
  173          ...(existing?.sources ?? []),
  174          { type: 'export', importedAt: new Date().toISOString(), file: file.originalname, added, merged },
  175        ],
  176      }
  177      store.saveChat(meta)
  178      res.json({ chat: meta, added, merged })
```

**Question.** Does the snippet store, for each import, the file name with the counts `added` and `merged`, and return them as JSON (line 178)?

## openclaw/wacrawl (`b4971ac2dc`)

### Q11. P2 per-record provenance: coded partial

**Claim.** Contact identifier observations carry the source store they were observed in and when; WP3 coded this partial because it covers contact identity (and revision/tombstone events), not every message.

**Permalink.** https://github.com/openclaw/wacrawl/blob/b4971ac2dc72303bdf4d1677782c9e3a1301182d/internal/store/contact_identity.go#L197-L203

```go
  197  // ContactLIDEvidence is a sourced raw field observation. A zero observation time
  198  // or empty store means unknown legacy provenance, not an inferred source event.
  199  type ContactLIDEvidence struct {
  200  	LID                 string    `json:"lid"`
  201  	SourceStoreIdentity string    `json:"source_store_identity,omitempty"`
  202  	FirstObservedAt     time.Time `json:"first_observed_at,omitempty"`
  203  }
```

**Question.** Does this structure record, for a contact identifier, which source store it was observed in (`source_store_identity`)?

### Q12. P3 conflict reporting: coded partial

**Claim.** When one contact (JID) arrives with two different LIDs, it is marked conflicting and the previously archived version is retained (contact_identity.go:169-174); WP3 coded this partial because the conflict is detected and resolved, with no report found.

**Permalink.** https://github.com/openclaw/wacrawl/blob/b4971ac2dc72303bdf4d1677782c9e3a1301182d/internal/store/contact_identity.go#L114-L125

```go
  114  	first := map[string]string{}
  115  	conflicting := map[string]bool{}
  116  	for _, c := range input {
  117  		if c.LID == "" {
  118  			continue
  119  		}
  120  		if lid, ok := first[c.JID]; ok && !sameContactLID(lid, c.LID) {
  121  			conflicting[c.JID] = true
  122  		} else if !ok {
  123  			first[c.JID] = c.LID
  124  		}
  125  	}
```

**Codebook P3, next to this snippet (from the Codebook above, [E]).** Written rule: none. Coded rows:

- **y** (3):
  - frozenspider/chat-history-manager: "Conflict sections (same source id, different content) returned for the user to resolve Replace/DontReplace; only for sources that carry source ids (not .txt): crates/backend/src/merge/analyzer.rs:29-31; crates/backend/src/merge/analyzer.rs:97-131; crates/backend/src/merge/analyzer.rs:333-367; crates/backend/src/merge/merger.rs:521-528; crates/loaders/src/loader/whatsapp_text.rs:174"
  - ludios/whatsapp-tail-merge: "counts matched messages whose timestamp/type/text differ and warns; base version kept: src/merge.ts:900-929"
  - openclaw/imsgcrawl: "identity conflicts are raised as errors (internal/archive/identity.go:31-96)"
- **partial** (1):
  - openclaw/wacrawl: "conflicting contact identities detected (internal/store/contact_identity.go:115-169)"
- **n with a note** (8 of 59 n; the other n rows have no note):
  - aphexcx/titanium-backup-merger: "prints each message skipped or replaced (main.py:65-81)"
  - casabre/whatsapp-merge: "prints a duplicate analysis of source and merged databases (src/whatsapp_merge/analysis.py:10-34)"
  - hknaack/AndroidMessageMerger: "prints each skipped existing message (mmssms_merge.sh:1028)"
  - Jacksgong/wechat-backup-merge: "prints "replace the file" for each differing file (merge_wechat_backup.py:33-36)"
  - natario1/whatsapp-database-merger: "prints how many rows a unique constraint skipped (counts only): Main.kt:237-239"
  - NumesSanguis/naver_line_restore_chat_root: "a separate manual SQL lists same-content rows (sql/extra/chat_history_check-no-duplicates.sql)"
  - ragibson/SMS-MMS-deduplication: "the log pairs each removed message with the one kept (dedupe_texts.py:252-276), a removal record rather than a conflict report"
  - suurjaak/Skyperious: "shows per-chat differences in the GUI before merging (src/skyperious/gui.py:382)"

**Question.** Does the snippet mark a contact as `conflicting` when the same contact (JID) arrives with two different LID values?

### Q13. P4 stated determinism: coded partial

**Claim.** The README states that `wacrawl backup` exports "deterministic JSONL shards"; WP3 coded this partial because it concerns the backup export, not the merge.

**Permalink.** https://github.com/openclaw/wacrawl/blob/b4971ac2dc72303bdf4d1677782c9e3a1301182d/README.md#L93

```markdown
   93  `wacrawl backup` exports deterministic JSONL shards, compresses them, and encrypts them to one or more X25519 age recipients before Git sees the data. Copied media can travel in content-deduplicated encrypted blobs, and restores verify hashes and cross-table references before replacing the archive.
```

**Question.** Does this README line say that `wacrawl backup` exports "deterministic" JSONL shards?

## openclaw/imsgcrawl (`14a0b732d5`)

### Q14. P2 per-record provenance: coded partial

**Claim.** Every message event row stores the message GUID, its row id in the source database and when it was observed; WP3 coded this partial (source row and time, not the source file).

**Permalink.** https://github.com/openclaw/imsgcrawl/blob/14a0b732d5448d34320aa5f76e2b249c6fa06d57/internal/archive/events.go#L51-L54

```go
   51  	_, err = tx.ExecContext(ctx, `insert or ignore into message_events(
   52  event_key, message_guid, source_rowid, event_type, revision_at, payload_json, revision_data, observed_at
   53  ) values(?, ?, ?, ?, ?, ?, ?, ?)`, eventKey, message.GUID, message.SourceRowID, eventType,
   54  		revisionAt, string(payload), revisionData, observedAt.UTC().Format(time.RFC3339Nano))
```

**Question.** Does the snippet store, for each message event, the message's row id in the source database (`source_rowid`) and the time it was observed (`observed_at`)?

### Q15. P3 conflict reporting: coded y

**Claim.** When the archive already holds a different handle at the same source row, the import stops with an identity-conflict error naming both values.

**Permalink.** https://github.com/openclaw/imsgcrawl/blob/14a0b732d5448d34320aa5f76e2b249c6fa06d57/internal/archive/identity.go#L25-L33

```go
   25  		var existingID, existingService string
   26  		err := tx.QueryRowContext(ctx, `select handle, service from handles where source_rowid = ?`, handle.SourceRowID).Scan(&existingID, &existingService)
   27  		if err != nil && !errors.Is(err, sql.ErrNoRows) {
   28  			return err
   29  		}
   30  		if err == nil && (existingID != handle.ID || existingService != handle.Service) {
   31  			return identityConflict("handle", handle.SourceRowID,
   32  				existingService+"/"+existingID, handle.Service+"/"+handle.ID)
   33  		}
```

**Question.** Does the snippet stop with an `identityConflict(...)` naming the old and the new value when the stored handle differs (lines 30-32)?

## openclaw/telecrawl (`e3444f31ae`)

### Q16. P2 per-record provenance: coded partial

**Claim.** The README states that tombstones keep their deletion time, source and reason, and that edits and deletes are kept as append-only revision events; WP3 coded this partial (README statement, events not traced to code).

**Permalink.** https://github.com/openclaw/telecrawl/blob/e3444f31aeca578273707f86e43ca6031785c240/README.md#L121-L127

```markdown
  121  Canonical chats, folders and memberships, topics, contacts, groups and
  122  participants, and messages retain explicit Telegram tombstones with deletion
  123  time, source, and reason. Missing rows in a bounded import are not deletions.
  124  Message identities remain stable across imports, and observable Telegram edits
  125  and explicit deletes are retained as append-only revision events. Upgrading an
  126  older archive seeds a baseline observation for every existing message before a
  127  later edit can replace its canonical payload.
```

**Question.** Does the README say that deletion tombstones record a "source" and that edits and deletes are kept as "append-only revision events"?

## frozenspider/chat-history-manager (`d1f6f8879e`)

### Q17. P3 conflict reporting: coded y

**Claim.** When master and slave messages share a source id (condition at analyzer.rs:97) but differ, the analyzer opens a Conflict section that the user later resolves; per analyzer.rs:29 conflicts are detectable only for sources that carry source ids, which the WhatsApp .txt loader does not (whatsapp_text.rs:174).

**Permalink.** https://github.com/frozenspider/chat-history-manager/blob/d1f6f8879e151b1309118ec4d59d0b9298c9ba81/crates/backend/src/merge/analyzer.rs#L121-L131

```rust
  121                      // Conflict started
  122                      // (Conflicts are only detectable if data source supply source IDs)
  123  
  124                      let (mm, sm) = cx.advance_both()?;
  125                      let mm_internal_id = mm.typed_id();
  126                      let sm_internal_id = sm.typed_id();
  127                      log::debug!("Conflict started:\nWas    {:#?}\nBecame {:#?}", *mm, *sm);
  128                      state = InProgress(Conflict {
  129                          first_master_msg_id: mm_internal_id,
  130                          first_slave_msg_id: sm_internal_id,
  131                      });
```

**Question.** Does the snippet start a `Conflict` record (line 128) for the two differing messages?

## ludios/whatsapp-tail-merge (`af03a6af60`)

### Q18. P3 conflict reporting: coded y

**Claim.** The merge counts shared messages whose timestamp, type or text differ between the two databases, stores the count in its report and logs a warning; the base version is kept.

**Permalink.** https://github.com/ludios/whatsapp-tail-merge/blob/af03a6af60a6cb9268c1ff4b777858fa88d211fa/src/merge.ts#L917-L928

```ts
  917  		const n = this.scalar<number>(
  918  			`SELECT count(*) FROM temp.map_message p ` +
  919  			`JOIN src.message x ON x._id = p.old_id ` +
  920  			`JOIN main.message d ON d._id = p.new_id ` +
  921  			`WHERE p.inserted = 0 AND (${differs})`,
  922  		);
  923  		this.report.matched_message_diffs = n;
  924  		if (n > 0) {
  925  			log.warn("{n} shared messages differ in {columns} between the databases; keeping the base's version", {
  926  				n, columns: durable,
  927  			});
  928  		}
```

**Question.** Does the snippet count shared messages that differ between the two databases and print a warning when that count is above zero?

## suitangi/Crosstalk (`e677b2c1f0`)

### Q19. P4 stated determinism: coded partial

**Claim.** The package documentation describes the database write `upsertBatch` as idempotent; WP3 coded this partial (idempotence, not determinism of the output).

**Permalink.** https://github.com/suitangi/Crosstalk/blob/e677b2c1f01b3ea78f3be4701c8e276d86212bde/packages/ingest/src/index.ts#L4-L9

```ts
    4   * Public surface:
    5   *   - migrateDb(db)        — apply the canonical schema to a sqlite handle
    6   *   - upsertBatch(db, b)   — write a validated RecordBatch (one txn, idempotent)
    7   *   - ingestIntoPath(...)  — open/migrate/ingest convenience
    8   *   - mergePersons(...)    — cross-platform identity merge
    9   *   - moveParticipant(...) — single-participant identity reassignment
```

**Question.** Does line 6 describe `upsertBatch` as "idempotent"?

## theetherGit/wamerge (`f65fc4206a`)

### Q20. P5 structured report: coded y

**Claim.** The merge writes output/merge-report.txt (merge.py:597-598): a table of before/after counts and named skip counts, with no message content.

**Permalink.** https://github.com/theetherGit/wamerge/blob/f65fc4206a330a5d1e405d5e4136c36eea3bf402/src/wamerge/steps/merge.py#L559-L571

```python
  559  out(f"{'':34}{'before':>10}{'after':>10}")
  560  for t, label in (("ZWAMESSAGE", "messages"), ("ZWACHATSESSION", "chats"),
  561                   ("ZWAGROUPINFO", "groups"), ("ZWAGROUPMEMBER", "group senders"),
  562                   ("ZWAMEDIAITEM", "media records (untouched)")):
  563      out(f"{label:34}{before[t]:>10}{after[t]:>10}")
  564  out()
  565  for k in ("android text messages read", "messages added", "  of which starred",
  566            "skipped: already on the iPhone", "skipped: duplicate inside the Android history",
  567            "skipped: not an ordinary chat or group (channels, status, broadcast)",
  568            "skipped: no message id or timestamp", "existing iPhone chats extended",
  569            "1:1 chats created", "groups created", "  of which hidden on Android (kept hidden)",
  570            "  of which archived on Android (kept archived)", "group senders added"):
  571      out(f"{k:68}{stats[k]:>8}")
```

**Extra snippet (added 2026-10-19): the report path.** https://github.com/theetherGit/wamerge/blob/f65fc4206a330a5d1e405d5e4136c36eea3bf402/src/wamerge/steps/merge.py#L29

```python
   29  REPORT = os.path.join(os.path.dirname(OUT) or ".", "merge-report.txt")
```

**Extra snippet (added 2026-10-19): out() prints each line and also keeps it in `lines`.** https://github.com/theetherGit/wamerge/blob/f65fc4206a330a5d1e405d5e4136c36eea3bf402/src/wamerge/steps/merge.py#L37-L42

```python
   37  lines = []
   38
   39
   40  def out(s=""):
   41      print(s)
   42      lines.append(s)
```

**Extra snippet (added 2026-10-19): `lines` is written to the report file.** https://github.com/theetherGit/wamerge/blob/f65fc4206a330a5d1e405d5e4136c36eea3bf402/src/wamerge/steps/merge.py#L597-L599

```python
  597  with open(REPORT, "w") as f:
  598      f.write("\n".join(lines) + "\n")
  599  print(f"Report saved to {REPORT}")
```

**Question.** Does the snippet produce a table with one label and one number per line (for example "messages added", "skipped: already on the iPhone")?

## BenjaminJornet/PhoneBridge (`a39b514b76`)

### Q21. P2 per-record provenance: coded partial

**Claim.** The README lists "Provenance" (which backups, devices and paths a file came from) as a feature marked "In progress"; WP3 coded this partial from the README alone.

**Permalink.** https://github.com/BenjaminJornet/PhoneBridge/blob/a39b514b76b1b6b717ccec1a5292d9451e8147ee/README.md#L51-L63

```markdown
   51  | ♻️ | **Content-based dedup across backups** | 🚧 In progress |
   52  | 🧭 | **Provenance + "safe to purge" advisor** | 🚧 In progress |
   53  | 📁 | Pick any folder / any phone as a source | ✅ Working |
   54  | 📲 | On-device sync straight from the phone (no SmartSwitch) | 🚧 Alpha |
   55  | 👤 | Contacts · 🗓️ Calendar · 📝 Notes · Apps/APKs · 💬 WhatsApp | 🚧 Alpha |
   56  
   57  ## How it works
   58  
   59  ```
   60   SmartSwitch ┐
   61   Folder ─────┤   hash (SHA-256)     ┌─ one copy per unique file
   62   ADB pull ───┼──▶ dedup by content ─┤─ provenance: which backups/devices/paths
   63   Takeout ────┘   + index (SQLite)   └─ safe-purge advisor (reclaim GB)
```

**Question.** Does the README describe a provenance feature (which backups, devices or paths each file came from), even though it is marked "In progress"?

## Daily-AC/chatdrop (`d2e255ba4c`)

### Q22. P2 per-record provenance: coded partial

**Claim.** An `import_messages` table links each message to the import it came from and to its line in the source file; WP3 coded this partial.

**Permalink.** https://github.com/Daily-AC/chatdrop/blob/d2e255ba4c9c7eebb4f7d54d151244c213f66d47/cli/chatdrop.py#L241-L245

```python
  241                  self.db.execute("""CREATE TABLE import_messages (
  242                      import_id TEXT NOT NULL REFERENCES imports(id), ordinal INTEGER NOT NULL,
  243                      message_id TEXT NOT NULL REFERENCES messages(id), source_line INTEGER NOT NULL,
  244                      sender TEXT NOT NULL, timestamp_raw TEXT NOT NULL, body TEXT NOT NULL,
  245                      PRIMARY KEY(import_id, ordinal))""")
```

**Question.** Does this table link each message (`message_id`) to the import it came from (`import_id`) and to a line in the source (`source_line`)?

## tarikab7/whatsapp-chat-merger (`403c98e132`)

### Q23. P2 per-record provenance: coded partial

**Claim.** In the README's HTML app, every parsed message stores the id and name of the source (folder) it came from; WP3 coded this partial (source, not line).

**Permalink.** https://github.com/tarikab7/whatsapp-chat-merger/blob/403c98e132e8d3fbdbe054adfd53bf3d182225a9/public/chat-merger.html#L314-L320

```html
  314        if(currentMsg)messages.push(currentMsg);
  315        var dateStr=mt[1],timeStr=mt[2],sender=mt[3].trim(),body=mt[4];
  316        var ts=parseDate(dateStr,timeStr);
  317        var mediaType=detectMedia(body);var mediaFile=null;
  318        if(mediaType){mediaFile=body.replace(/\s*\(file attached\)\s*/i,'').replace(/\s*<Media omitted>\s*/i,'').trim();body=''}
  319        _globalLineIdx++;
  320        currentMsg={id:uid(),timestamp:ts,lineIdx:_globalLineIdx,sender:sender,text:body,mediaType:mediaType,mediaFile:mediaFile,mediaUrl:null,sourceId:sourceId,sourceName:sourceName,isMe:sender==='You',isDuplicate:false,isSystem:false,identityId:null};
```

**Question.** Does line 320 store, in every parsed message, the source it came from (`sourceId` and `sourceName`)?

## tmo1/sms-db (`072105c86f`)

### Q24. P2 per-record provenance: coded partial

**Claim.** Each message row stores the input format it came from (`source_format`), not the file; WP3 coded this partial.

**Permalink.** https://github.com/tmo1/sms-db/blob/072105c86fd76baedf9bc32a5d877077636ae451/sms-db.pl#L47-L51

```perl
   47  my $dbh = DBI->connect("dbi:SQLite:$opts{'d'}", undef, undef, {RaiseError => 1, PrintError => 0, AutoCommit => 0, sqlite_extended_result_codes => 1});
   48  unless ($dbh->tables(undef, undef, 'messages', 'TABLE')) {
   49  	$dbh->do("CREATE TABLE messages(_id INTEGER PRIMARY KEY AUTOINCREMENT,timestamp INT,sender_address TEXT,sender_name TEXT,recipient_address TEXT,recipient_name TEXT,msg_box INT,message_type INT,source_format INT,hash INT UNIQUE)");
   50  	$dbh->do("PRAGMA user_version = $DATABASE_VERSION");
   51  }
```

**Question.** Does the `messages` table created on line 49 have a column named `source_format`?

## minvws/DSA-WhatsApp-merger (`b87125191b`)

### Q25. P2 per-record provenance: coded y

**Claim.** (Borderline; excluded by author decision 2026-10-16.) A `data_holder` column is added to every merged message, naming whose export it came from, looked up from the message's file.

**Permalink.** https://github.com/minvws/DSA-WhatsApp-merger/blob/b87125191b8ca90ed2bed3d5d2355cc5e9d7d041/chatmerger/WhatsAppMerger.py#L303-L307

```python
  303              data_holders[filepath] = data_holder
  304              parser.data_holder = data_holder
  305          self.contact_mapping.apply_data_holders(data_holders)
  306          self.concat_df['data_holder'] = self.concat_df.apply(
  307              lambda x: data_holders.get(x.data_holder, data_holders.get(x.file, x.data_holder)), axis=1)
```

**Question.** Do lines 306-307 add a `data_holder` column to the merged messages, filled per message from the file it came from (`x.file`)?

### Q26. P5 structured report: coded partial

**Claim.** (Borderline; excluded by author decision 2026-10-16.) The PDF/XLSX justification template has a summary ("Samenvatting") stating how many exported files were merged and the message count before and after. Translation of lines 65-67: "For the chat '%(conversation_name)s', %(n_conversations)s exported files were merged. Together these files contain %(orig_len)s chat messages. This number was reduced to %(merged_len)s messages. A reduction of %(reduction)s." WP3 coded this partial (counts in a human-readable document).

**Permalink.** https://github.com/minvws/DSA-WhatsApp-merger/blob/b87125191b8ca90ed2bed3d5d2355cc5e9d7d041/chatmerger/WhatsAppMerger.py#L63-L70

```python
   63  <section>
   64      <h2>Samenvatting</h2>
   65      <p>Voor het chatgesprek '%(conversation_name)s' zijn %(n_conversations)s ge&euml;xporteerde bestanden samengevoegd.
   66  Deze bestanden bevatten gezamenlijk %(orig_len)s chatberichten. Dit aantal is gereduceerd tot  %(merged_len)s berichten. Een
   67  reductie van %(reduction)s.</p><p>
   68  Door periode selectie is het aantal bijlagen gereduceert van %(n_bijlagen_orig)s naar %(n_bijlagen_date_range)s. Dit is 
   69  door ontdubbelen verder gereduceert naar %(n_bijlagen_merged)s.</p>
   70  </section>
```

**Question.** Does the summary section state the number of merged files and the message count before and after merging (`orig_len`, `merged_len`)?

## Any sign of a property coded n (the 5 tools closest to all five)

### Q27. Akif-b-Atif/The-Omar-Files, P2 per-record provenance: coded n

**Question.** Is there any sign that each output record names the source file (or source record) it came from?

**Grep.** /provenance|source_?file|source_?path|sourceFile|origin(al)?_?file|line_?(no|num)/ at `27faf12e3e`: 2 hit(s) in 1 file(s).

- Pipeline/scripts/3_merge_export.py:179 (grep hit): `def write_log(source_file, added, skipped_dup, skipped_placeholder, note):`  
  https://github.com/Akif-b-Atif/The-Omar-Files/blob/27faf12e3e007ece86a0dab794c50be6ceedf3de/Pipeline/scripts/3_merge_export.py#L179
- Pipeline/scripts/3_merge_export.py:187 (grep hit): `"source_file": source_file,`  
  https://github.com/Akif-b-Atif/The-Omar-Files/blob/27faf12e3e007ece86a0dab794c50be6ceedf3de/Pipeline/scripts/3_merge_export.py#L187
- Pipeline/scripts/2_normalize_export.py:110 (context): `out_lines.append(f"{m['date']}, {m['time']} - {canon}: {msg_text}")`  
  https://github.com/Akif-b-Atif/The-Omar-Files/blob/27faf12e3e007ece86a0dab794c50be6ceedf3de/Pipeline/scripts/2_normalize_export.py#L110

**What the hits show.** Both hits are the per-merge log entry (one `source_file` per merge batch). The archive line format written at 2_normalize_export.py:110 has no source field.

### Q28. Akif-b-Atif/The-Omar-Files, P3 conflict reporting: coded n

**Question.** Is there any sign that the tool reports when two sources disagree about the same message?

**Grep.** /conflict|disagree|mismatch|diverg|inconsisten/ at `27faf12e3e`: 3 hit(s) in 2 file(s).

- Pipeline/Tools/chat_analyzer/baseline_corpus.py:90 (grep hit): `"i actually disagree a bit", "i see it differently honestly",`  
  https://github.com/Akif-b-Atif/The-Omar-Files/blob/27faf12e3e007ece86a0dab794c50be6ceedf3de/Pipeline/Tools/chat_analyzer/baseline_corpus.py#L90
- Pipeline/Tools/chat_analyzer/chat_config.py:332 (grep hit): `"disagree",`  
  https://github.com/Akif-b-Atif/The-Omar-Files/blob/27faf12e3e007ece86a0dab794c50be6ceedf3de/Pipeline/Tools/chat_analyzer/chat_config.py#L332

**What the hits show.** All 3 hits are vocabulary lists of a separate chat-analysis tool, not merge code.

### Q29. sokie/keepsake, P1 retains unparseable input as output: coded n

**Question.** Is there any sign that input the tool cannot parse is kept in its output (rather than skipped, dropped or rejected)?

**Grep.** /unpars|unparsable|malformed|invalid line|could not parse|failed to parse|unrecognized|unrecognised|quarantin|reject/ at `89cdfb6ff9`: 5 hit(s) in 2 file(s).

- server/index.ts:133 (grep hit): `return void res.status(400).json({ error: 'could not parse any messages from this file' })`  
  https://github.com/sokie/keepsake/blob/89cdfb6ff94939da3bd61b7ecf1a568bcb9194a0/server/index.ts#L133
- server/index.ts:257 (grep hit): `return void res.status(400).json({ error: 'could not parse result.json' })`  
  https://github.com/sokie/keepsake/blob/89cdfb6ff94939da3bd61b7ecf1a568bcb9194a0/server/index.ts#L257
- server/lib/importExport.ts:36 (context): `export function parseExportTxt(txt: string): ExportEntry[] {`  
  https://github.com/sokie/keepsake/blob/89cdfb6ff94939da3bd61b7ecf1a568bcb9194a0/server/lib/importExport.ts#L36

**What the hits show.** The two parse-related hits reject a whole input from which nothing could be parsed (HTTP 400); the other 3 hits concern the Host-header check and image export. Line parsing is delegated to whatsapp-chat-parser (importExport.ts:36); per the WP3 extraction note, a line without a message header continues the previous message.

### Q30. sokie/keepsake, P3 conflict reporting: coded n

**Question.** Is there any sign that the tool reports when two sources disagree about the same message?

**Grep.** /conflict|disagree|mismatch|diverg|inconsisten/ at `89cdfb6ff9`: 0 hit(s) in 0 file(s).

**What the hits show.** No hits.

### Q31. openclaw/wacrawl, P1 retains unparseable input as output: coded n

**Question.** Is there any sign that input the tool cannot parse is kept in its output (rather than skipped, dropped or rejected)?

**Grep.** /unpars|unparsable|malformed|invalid line|could not parse|failed to parse|unrecognized|unrecognised|quarantin|reject/ at `b4971ac2dc`: 79 hit(s) in 25 file(s).

- CHANGELOG.md:52 (grep hit): `- Retain message metadata when an optional local attachment path is invalid, without fabricating a deletion; reject the entire media-copy batch before copying a`  
  https://github.com/openclaw/wacrawl/blob/b4971ac2dc72303bdf4d1677782c9e3a1301182d/CHANGELOG.md#L52

**What the hits show.** The 79 hits are about rejecting sources, backups and SQL statements (CHANGELOG, docs). A narrower search of non-test Go source for /skip(ped)? (message|row)|unparse|cannot decode|failed to decode|malformed/ found 0 hits.

### Q32. openclaw/wacrawl, P5 structured report: coded n

**Question.** Is there any sign of a structured (machine-readable or tabulated) report of the merge?

**Grep.** /report|summary|json\.dump|JSON\.stringify|json\.Marshal|writeFile|to_csv|csv\.writer/ at `b4971ac2dc`: 122 hit(s) in 31 file(s).

- docs/commands.md:200 (context): `| `--json` | Emit JSON instead of human-readable output |`  
  https://github.com/openclaw/wacrawl/blob/b4971ac2dc72303bdf4d1677782c9e3a1301182d/docs/commands.md#L200
- internal/cli/output.go:15 (context): `if a.json {`  
  https://github.com/openclaw/wacrawl/blob/b4971ac2dc72303bdf4d1677782c9e3a1301182d/internal/cli/output.go#L15
- internal/cli/output.go:16 (context): `return a.printJSON(value)`  
  https://github.com/openclaw/wacrawl/blob/b4971ac2dc72303bdf4d1677782c9e3a1301182d/internal/cli/output.go#L16
- internal/cli/output.go:19 (context): `case store.ImportStats:`  
  https://github.com/openclaw/wacrawl/blob/b4971ac2dc72303bdf4d1677782c9e3a1301182d/internal/cli/output.go#L19
- internal/store/types.go:7 (context): `type ImportStats struct {`  
  https://github.com/openclaw/wacrawl/blob/b4971ac2dc72303bdf4d1677782c9e3a1301182d/internal/store/types.go#L7

**What the hits show.** The broad regex hits are mostly docs, CHANGELOG and tests. The lines shown come from a second search, /--json|ImportStats|printJSON/: with the global `--json` flag, `wacrawl import` prints its ImportStats (mode, source path, counts of chats, contacts, messages, media) as JSON on stdout. Whether JSON on stdout counts as a "structured report" under the WP3 convention ("plain stdout lines do not count") is for you to judge.

### Q33. discordwell/green2blue, P1 retains unparseable input as output: coded n

**Question.** Is there any sign that input the tool cannot parse is kept in its output (rather than skipped, dropped or rejected)?

**Grep.** /unpars|unparsable|malformed|invalid line|could not parse|failed to parse|unrecognized|unrecognised|quarantin|reject/ at `8781b3c4be`: 19 hit(s) in 12 file(s).

- src/green2blue/parser/ndjson_parser.py:27 (grep hit): `Malformed lines are logged as warnings and skipped.`  
  https://github.com/discordwell/green2blue/blob/8781b3c4be0f4385d7e4e7c8d48e33a555228f53/src/green2blue/parser/ndjson_parser.py#L27
- src/green2blue/parser/ndjson_parser.py:61 (grep hit): `logger.warning("Line %d: failed to parse record, skipping: %s", line_num, e)`  
  https://github.com/discordwell/green2blue/blob/8781b3c4be0f4385d7e4e7c8d48e33a555228f53/src/green2blue/parser/ndjson_parser.py#L61

**What the hits show.** Malformed input lines are logged as warnings and skipped; no hit shows them kept in an output.

### Q34. discordwell/green2blue, P3 conflict reporting: coded n

**Question.** Is there any sign that the tool reports when two sources disagree about the same message?

**Grep.** /conflict|disagree|mismatch|diverg|inconsisten/ at `8781b3c4be`: 23 hit(s) in 11 file(s).

- src/green2blue/archive/db.py:200 (grep hit): `"ON CONFLICT(key) DO UPDATE SET value = excluded.value",`  
  https://github.com/discordwell/green2blue/blob/8781b3c4be0f4385d7e4e7c8d48e33a555228f53/src/green2blue/archive/db.py#L200
- src/green2blue/archive/verify.py:93 (grep hit): `merge_errors = _merge_mismatches(conn, latest_merge_id)`  
  https://github.com/discordwell/green2blue/blob/8781b3c4be0f4385d7e4e7c8d48e33a555228f53/src/green2blue/archive/verify.py#L93

**What the hits show.** Hits are SQL "ON CONFLICT" upserts and verify.py count-consistency checks (stored merge counts against table counts, verify.py:189-209); none reports two sources disagreeing about one message.

### Q35. discordwell/green2blue, P4 stated determinism: coded n

**Question.** Is there any sign that the documentation or code states the merged output is deterministic (same inputs, same output)?

**Grep.** /determinis|idempoten|reproducib|stable.?sort|same output|byte.?identical|no-op/ at `8781b3c4be`: 18 hit(s) in 14 file(s).

- src/green2blue/models.py:232 (grep hit): `"""Compute a deterministic opaque chat identifier for a group conversation."""`  
  https://github.com/discordwell/green2blue/blob/8781b3c4be0f4385d7e4e7c8d48e33a555228f53/src/green2blue/models.py#L232
- ARCHITECTURE.md:240 (grep hit): `- **fake-synced** — Pretend already synced. Sets `ck_sync_state=1`, generates deterministic 64-char hex record IDs (`sha256(guid:salt)`), sets `ck_record_change`  
  https://github.com/discordwell/green2blue/blob/8781b3c4be0f4385d7e4e7c8d48e33a555228f53/ARCHITECTURE.md#L240

**What the hits show.** "Deterministic" appears for generated identifiers (chat ids, record ids); no hit states that the merged output is deterministic.

### Q36. nicksmarto/sms_viewer, P1 retains unparseable input as output: coded n

**Question.** Is there any sign that input the tool cannot parse is kept in its output (rather than skipped, dropped or rejected)?

**Grep.** /unpars|unparsable|malformed|invalid line|could not parse|failed to parse|unrecognized|unrecognised|quarantin|reject/ at `bea638c384`: 6 hit(s) in 5 file(s).

- README.md:27 (grep hit): `- **Robust parsing** — skips corrupted/malformed entries instead of failing the whole file.`  
  https://github.com/nicksmarto/sms_viewer/blob/bea638c384dcf38280398068d2ea6bbed81769aa/README.md#L27
- app.py:865 (context): `parser = etree.XMLParser(recover=True, huge_tree=True)`  
  https://github.com/nicksmarto/sms_viewer/blob/bea638c384dcf38280398068d2ea6bbed81769aa/app.py#L865
- app.py:1026 (grep hit): `app.logger.warning(f"Skipping malformed message element in {filename}: {e}")`  
  https://github.com/nicksmarto/sms_viewer/blob/bea638c384dcf38280398068d2ea6bbed81769aa/app.py#L1026

**What the hits show.** Malformed elements are skipped with a warning; the XML parser runs in recover mode. No hit shows them kept in an output.

### Q37. nicksmarto/sms_viewer, P3 conflict reporting: coded n

**Question.** Is there any sign that the tool reports when two sources disagree about the same message?

**Grep.** /conflict|disagree|mismatch|diverg|inconsisten/ at `bea638c384`: 3 hit(s) in 2 file(s).

- app.py:26 (grep hit): `# an old cache unusable. assess_cache() rebuilds automatically on a mismatch.`  
  https://github.com/nicksmarto/sms_viewer/blob/bea638c384dcf38280398068d2ea6bbed81769aa/app.py#L26
- app.py:500 (grep hit): `sources record the sender inconsistently (e.g. one archive stores a sent`  
  https://github.com/nicksmarto/sms_viewer/blob/bea638c384dcf38280398068d2ea6bbed81769aa/app.py#L500

**What the hits show.** app.py:26 is about the cache schema. app.py:499-503 explains that the sender is left out of the message identity because sources record it inconsistently; no hit reports such a disagreement.

### Q38. nicksmarto/sms_viewer, P4 stated determinism: coded n

**Question.** Is there any sign that the documentation or code states the merged output is deterministic (same inputs, same output)?

**Grep.** /determinis|idempoten|reproducib|stable.?sort|same output|byte.?identical|no-op/ at `bea638c384`: 2 hit(s) in 1 file(s).

- index.html:550 (grep hit): `// Pre-seed the applied key so the echoed 'datazoom' from setup is a no-op.`  
  https://github.com/nicksmarto/sms_viewer/blob/bea638c384dcf38280398068d2ea6bbed81769aa/index.html#L550
- index.html:625 (grep hit): `if (key === G.state.lastAppliedKey) return;   // dedupe echoed/no-op changes`  
  https://github.com/nicksmarto/sms_viewer/blob/bea638c384dcf38280398068d2ea6bbed81769aa/index.html#L625

**What the hits show.** Both hits are user-interface code (chart zoom events).

## Upgrade questions (added 2026-10-19)

### Q39. Daily-AC/chatdrop, P2 per-record provenance: coded partial

**Claim.** The `import_messages` table stores, for every message, the import it came from (`import_id`) and its line in the source file (`source_line`). Ingestion fills both for each message (cli/chatdrop.py:328-329; `source_line` comes from the parser, :121). The original archive of each import is kept and re-read on rebuild (cli/chatdrop.py:342-348). WP3 coded P2 partial; this question tests y. Q22 shows the same lines.

**Permalink.** https://github.com/Daily-AC/chatdrop/blob/d2e255ba4c9c7eebb4f7d54d151244c213f66d47/cli/chatdrop.py#L241-L245

```python
  241                  self.db.execute("""CREATE TABLE import_messages (
  242                      import_id TEXT NOT NULL REFERENCES imports(id), ordinal INTEGER NOT NULL,
  243                      message_id TEXT NOT NULL REFERENCES messages(id), source_line INTEGER NOT NULL,
  244                      sender TEXT NOT NULL, timestamp_raw TEXT NOT NULL, body TEXT NOT NULL,
  245                      PRIMARY KEY(import_id, ordinal))""")
```

**Extra snippet (added 2026-10-19): the parser stores source_line (line 121) in every message it returns.** https://github.com/Daily-AC/chatdrop/blob/d2e255ba4c9c7eebb4f7d54d151244c213f66d47/cli/chatdrop.py#L117-L122

```python
  117          messages.append({
  118              "ordinal": ordinal, "sender": lines[start][1:],
  119              "sent_at": timestamp.isoformat(timespec="seconds" if match.group(6) else "minutes"),
  120              "timestamp_raw": lines[start + 1], "body": body,
  121              "source_line": start + 1,
  122          })
```

**Extra snippet (added 2026-10-19): ingestion loops over every parsed message.** https://github.com/Daily-AC/chatdrop/blob/d2e255ba4c9c7eebb4f7d54d151244c213f66d47/cli/chatdrop.py#L308-L312

```python
  308      def ingest_messages(self, import_id, messages, references):
  309          conversation_id = self.db.execute("SELECT conversation_id FROM imports WHERE id=?", (import_id,)).fetchone()[0]
  310          claimed = set()
  311          result = {"added_messages": 0, "reused_messages": 0, "filled_attachments": 0}
  312          for message in messages:
```

**Extra snippet (added 2026-10-19): inside that loop, one import_messages row per message, with import_id and source_line.** https://github.com/Daily-AC/chatdrop/blob/d2e255ba4c9c7eebb4f7d54d151244c213f66d47/cli/chatdrop.py#L327-L329

```python
  327              claimed.add(message_id)
  328              self.db.execute("INSERT INTO import_messages VALUES (?, ?, ?, ?, ?, ?, ?)", (
  329                  import_id, message["ordinal"], message_id, message["source_line"], message["sender"], message["timestamp_raw"], message["body"]))
```

**Question.** Is linking every message to its import (`import_id`) and to its line in the source file (`source_line`) per-record provenance in full (code y), not partial?

### Q40. openclaw/wacrawl, P5 structured report: coded n

**Claim.** With the global `--json` flag (internal/cli/cli.go:48), `wacrawl import` prints its ImportStats (internal/cli/read.go:83-87) as indented JSON (output.go:101-105). The JSON fields are mode, source_path, db_path, the counts of chats, contacts, groups, participants, messages and media messages (media copied and missing when nonzero), started_at and finished_at (internal/store/types.go:7-28). Without `--json` the same fields are printed as key=value lines. Q32 shows the same evidence.

**Permalink.** https://github.com/openclaw/wacrawl/blob/b4971ac2dc72303bdf4d1677782c9e3a1301182d/internal/cli/output.go#L14-L22

```go
   14  func (a *app) print(value any) error {
   15  	if a.json {
   16  		return a.printJSON(value)
   17  	}
   18  	switch v := value.(type) {
   19  	case store.ImportStats:
   20  		_, err := fmt.Fprintf(a.stdout, "mode=%s\nsource=%s\ndb=%s\nchats=%d\ncontacts=%d\ngroups=%d\nparticipants=%d\nmessages=%d\nmedia_messages=%d\nmedia_copied=%d\nmedia_missing=%d\n",
   21  			v.Mode, v.SourcePath, v.DBPath, v.Chats, v.Contacts, v.Groups, v.Participants, v.Messages, v.MediaMessages, v.MediaCopied, v.MediaMissing)
   22  		return err
```

**Question.** Does the ImportStats JSON that `wacrawl import --json` prints on stdout count as a structured report of the merge (code y)? (The WP3 convention says plain stdout lines do not count.)
