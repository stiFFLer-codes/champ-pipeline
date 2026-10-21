// WP3 benchmark wrapper (invocation only) for sokie/keepsake. The tool is an
// Express app; its route POST /api/import/export-zip (server/index.ts:107-178)
// reads an uploaded .txt export and calls, in order:
//   entries = parseExportTxt(txt)            participants = participantsOf(entries)
//   msgs = buildExportMsgs(entries, me)      mergeMessages(existing chat messages, msgs)
// This wrapper imports those unmodified modules under Bun (dependencies from
// the tool's own package-lock.json) and makes the same calls for each fragment
// in turn, merging the second into the chat created by the first (the route's
// targetChatId path). `me` is the participant the user identifies as
// themselves in the import dialog; the pair's own-account label is "You".
//
// Requires TZ=UTC (export times are read as device-local wall clock).
//
// Usage: TZ=UTC bun run-keepsake.ts <tool-repo> <pair-dir> <out-dir> <F1|F2 first>

import fs from 'fs';
import path from 'path';

const [repo, pairDir, outDir, first] = process.argv.slice(2);
if (new Date(2024, 0, 1).getTimezoneOffset() !== 0) throw new Error('run with TZ=UTC');

const { parseExportTxt, participantsOf, buildExportMsgs } = await import(path.resolve(repo, 'server/lib/importExport.ts'));
const { mergeMessages } = await import(path.resolve(repo, 'server/lib/normalize.ts'));

const manifest = JSON.parse(fs.readFileSync(path.join(pairDir, 'manifest.json'), 'utf8'));
let files: string[] = manifest.fragments.map((f: { file: string }) => f.file);
if (first === 'F2') files = files.reverse();

const ME = 'You';
let chat: any[] = [];
const report: any[] = [];
for (const file of files) {
  const entries = parseExportTxt(fs.readFileSync(path.join(pairDir, file), 'utf8'));
  const participants = participantsOf(entries);
  if (!participants.includes(ME)) throw new Error(`${file}: "${ME}" not among ${participants}`);
  const { messages, added, merged } = mergeMessages(chat, buildExportMsgs(entries, ME));
  chat = messages;
  report.push({ file, parsed: entries.length, participants, added, merged });
}

fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(path.join(outDir, 'output.json'), JSON.stringify({ sources: report, messages: chat }, null, 1) + '\n');
// keepsake spreads same-minute export messages 10 ms apart for display order
// (normalize.ts spreadWithinMinute); times are compared at the minute.
const normalized = chat.map((m) => ({
  tUtc: new Date(Math.floor(m.ts / 60000) * 60000).toISOString(),
  sender: m.system ? null : m.sender,
  body: m.text ?? '',
  duplicateFlag: false,
  source: null,
  system: !!m.system,
}));
fs.writeFileSync(path.join(outDir, 'normalized.json'), JSON.stringify(normalized, null, 1) + '\n');
console.log(report.map((r) => `${r.file}: parsed ${r.parsed}, added ${r.added}, merged ${r.merged}`).join('; ') + `; chat ${chat.length}`);
