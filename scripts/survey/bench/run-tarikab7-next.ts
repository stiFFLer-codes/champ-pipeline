// WP3 benchmark wrapper (invocation only) for tarikab7/whatsapp-chat-merger's
// Next.js variant, src/lib/whatsapp-parser.ts, imported unmodified under Bun.
// It makes the calls src/store/chat-store.ts addSource makes per dropped folder:
//   result = parseChatText(text, folderName)
//   messages = deduplicateMessages([...messages, ...result.messages])
// Shown messages are those the default filter shows (isDuplicate false).
//
// Requires TZ=UTC (see run-tarikab7-html.js).
//
// Usage: TZ=UTC bun run-tarikab7-next.ts <tool-repo> <pair-dir> <out-dir> <F1|F2 first>

import fs from 'fs';
import path from 'path';

const [repo, pairDir, outDir, first] = process.argv.slice(2);
if (new Date(2024, 0, 1).getTimezoneOffset() !== 0) throw new Error('run with TZ=UTC');

const { parseChatText, deduplicateMessages } = await import(path.resolve(repo, 'src/lib/whatsapp-parser.ts'));

const manifest = JSON.parse(fs.readFileSync(path.join(pairDir, 'manifest.json'), 'utf8'));
let files: string[] = manifest.fragments.map((f: { file: string }) => f.file);
if (first === 'F2') files = files.reverse();

let messages: any[] = [];
const sourceNames = new Map<string, string>();
const parsed: string[] = [];
for (const file of files) {
  const result = parseChatText(fs.readFileSync(path.join(pairDir, file), 'utf8'), file);
  sourceNames.set(result.source.id, file);
  parsed.push(`${file}=${result.messages.length}`);
  messages = deduplicateMessages([...messages, ...result.messages]);
}

fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(path.join(outDir, 'output.json'), JSON.stringify(messages, null, 1) + '\n');
const normalized = messages.map((m) => ({
  tUtc: m.timestamp.toISOString(),
  sender: m.sender,
  body: m.content,
  duplicateFlag: m.isDuplicate,
  source: sourceNames.get(m.sourceId),
  system: m.isSystemMessage,
}));
fs.writeFileSync(path.join(outDir, 'normalized.json'), JSON.stringify(normalized, null, 1) + '\n');
console.log(`parsed ${parsed.join(' ')}; merged ${messages.length}, shown ${messages.filter((m) => !m.isDuplicate).length}`);
