'use strict';

// Runs every self-check in this directory. node tests/run-all.js
// Exit 0 = everything passed. No framework, no config.

const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const files = fs.readdirSync(__dirname)
  .filter((f) => f.startsWith('test-') && f.endsWith('.js'))
  .sort();

let failed = 0;
for (const f of files) {
  try {
    const out = execFileSync(process.execPath, [path.join(__dirname, f)], { encoding: 'utf8' });
    process.stdout.write(out);
  } catch (err) {
    failed++;
    process.stdout.write(`FAILED ${f}\n`);
    process.stdout.write((err.stdout || '') + (err.stderr || ''));
  }
}

// The corpus checker is not a test file but it is a check, and a corpus that
// drifts from Section 5.2's claims should fail the same way a broken parser does.
try {
  execFileSync(process.execPath, [path.join(__dirname, '..', 'scripts', 'check-corpus-claims.js')], { encoding: 'utf8' });
  process.stdout.write('corpus claims: all hold\n');
} catch (err) {
  failed++;
  process.stdout.write('FAILED check-corpus-claims\n' + (err.stdout || ''));
}

console.log(failed ? `\n${failed} check(s) failed` : `\n${files.length + 1} checks passed`);
process.exit(failed ? 1 : 0);
