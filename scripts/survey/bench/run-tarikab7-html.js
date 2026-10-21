'use strict';

// WP3 benchmark wrapper (invocation only) for tarikab7/whatsapp-chat-merger's
// documented app, public/chat-merger.html. The page's inline <script> is run
// unmodified in a Node vm context in which React, ReactDOM, document and window
// are inert stubs (the UI is never rendered). The wrapper then makes the calls
// the app makes when two export folders are dropped one after the other:
//   parseWhatsAppChat(text, sourceId, sourceName) per folder   (FileReader text)
//   buildMerged(sources) after each ADD_SOURCE                 (reducer)
// Shown messages are those the default filter shows (isDuplicate false).
//
// Requires TZ=UTC: the app reads export times as device-local wall clock, the
// generator writes UTC wall clock, so local must equal UTC.
//
// Usage: TZ=UTC node run-tarikab7-html.js <tool-repo> <pair-dir> <out-dir> <F1|F2 first>

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const [repo, pairDir, outDir, first] = process.argv.slice(2);
if (new Date(2024, 0, 1).getTimezoneOffset() !== 0) throw new Error('run with TZ=UTC');

const html = fs.readFileSync(path.join(repo, 'public', 'chat-merger.html'), 'utf8');
const scripts = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)];
if (scripts.length !== 1) throw new Error(`expected one inline script, found ${scripts.length}`);

const inert = new Proxy(function () {}, { get: () => inert, apply: () => inert, construct: () => inert });
const ctx = vm.createContext({ React: inert, ReactDOM: inert, document: inert, window: inert, console });
vm.runInContext(scripts[0][1], ctx, { filename: 'chat-merger.html' });

const manifest = JSON.parse(fs.readFileSync(path.join(pairDir, 'manifest.json'), 'utf8'));
let files = manifest.fragments.map((f) => f.file);
if (first === 'F2') files = files.reverse();

const sources = [];
let merged;
for (const [i, file] of files.entries()) {
  const text = fs.readFileSync(path.join(pairDir, file), 'utf8');
  const id = `source-${i + 1}`;
  sources.push({ id, name: file, messages: ctx.parseWhatsAppChat(text, id, file) });
  merged = ctx.buildMerged(sources);
}

fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(path.join(outDir, 'output.json'), JSON.stringify(merged.allMessages, null, 1) + '\n');
const normalized = merged.allMessages.map((m) => ({
  tUtc: new Date(m.timestamp).toISOString(),
  sender: m.sender,
  body: m.text,
  duplicateFlag: m.isDuplicate,
  source: m.sourceName,
  system: m.isSystem,
}));
fs.writeFileSync(path.join(outDir, 'normalized.json'), JSON.stringify(normalized, null, 1) + '\n');
console.log(`parsed ${sources.map((s) => `${s.name}=${s.messages.length}`).join(' ')}; ` +
  `merged ${merged.allMessages.length}, shown ${merged.allMessages.filter((m) => !m.isDuplicate).length}`);
