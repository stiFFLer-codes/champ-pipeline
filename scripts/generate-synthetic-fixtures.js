'use strict';

const fs = require('fs');
const path = require('path');

function mulberry32(a) {
  return function () {
    a |= 0;
    a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function fail(message) {
  console.error(`Error: ${message}`);
  console.error('Usage: node scripts/generate-synthetic-fixtures.js [--seed <int>] [--count <int>]');
  process.exit(1);
}

function parseArgs(argv) {
  let seed = 1;
  let count = 5;
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--seed') {
      seed = Number(argv[++i]);
    } else if (argv[i] === '--count') {
      count = Number(argv[++i]);
    } else {
      fail(`Unknown argument: ${argv[i]}`);
    }
  }
  if (!Number.isInteger(seed)) fail('--seed must be an integer');
  if (!Number.isInteger(count) || count < 1) fail('--count must be a positive integer');
  if (count < PROFILES.length) {
    console.error(`Warning: --count ${count} < ${PROFILES.length}; the batch will not cover every quirk type.`);
  }
  return { seed, count };
}

const CONTACTS = [
  'Contact A', 'Contact B', 'Contact C', 'Contact D',
  'Contact E', 'Contact F', 'Contact G', 'Contact H',
];

const GROUP_NAMES = ['Study Group Alpha', 'Project Group Beta', 'Group Chat Gamma'];

const SENTENCES = [
  'Sounds good.',
  'See you then.',
  'Can you send the notes over?',
  'I will check and get back to you.',
  'Let me know when you are free.',
  'That works for me.',
  'Thanks for the update.',
  'I will be there in ten minutes.',
  'Did you see the announcement?',
  'We can move it to Friday.',
  'Please review the draft when you get a chance.',
  'I have added it to the shared list.',
  'Not sure yet, I will confirm tomorrow.',
  'Yes, that is correct.',
  'No worries, take your time.',
  'The meeting got pushed by an hour.',
  'Can everyone vote on the poll?',
  'I will bring the printed copies.',
  'Let us pick this up in the morning.',
  'Good point, I had not thought of that.',
  'I have attached the summary.',
  'Same time next week?',
  'It is already on the calendar.',
  'Ok, done.',
];

const MULTILINE_OPENERS = [
  'Here are the action items from today:',
  'Quick summary of where we left things:',
  'Packing list for the trip:',
  'Agenda for the next session:',
];

const MULTILINE_ITEMS = [
  'First item still needs an owner',
  'Second item is done and dusted',
  'Third item carried over to next week',
  'Budget line needs a second look',
  'Venue is confirmed',
  'Bring a printed copy if you can',
  'Open question parked for now',
  'Deadline stays as agreed',
];

const MULTILINE_CLOSERS = [
  'Anything missing, reply below.',
  'That covers everything for now.',
  'More details to follow.',
];

const EMOJIS = ['👍', '😂', '🎉', '🙏', '😊', '✅', '📌'];

const ATTACHMENT_KINDS = [
  { prefix: 'IMG', ext: 'jpg' },
  { prefix: 'VID', ext: 'mp4' },
  { prefix: 'DOC', ext: 'pdf' },
  { prefix: 'DOC', ext: 'docx' },
  { prefix: 'PTT', ext: 'opus' },
  { prefix: 'STK', ext: 'webp' },
];

const ENC_NOTICE_SELF = 'Messages to yourself are end-to-end encrypted. No one else, not even WhatsApp, can read, listen to, or share them.';
const ENC_NOTICE_GROUP = 'Messages and calls are end-to-end encrypted. Only people in this group can read, listen to, or share them. *Learn more*';

const BASE_DATE = Date.UTC(2024, 0, 8, 9, 0);

const pad2 = (n) => String(n).padStart(2, '0');
const randint = (rng, lo, hi) => lo + Math.floor(rng() * (hi - lo + 1));
const pick = (rng, arr) => arr[Math.floor(rng() * arr.length)];

function shuffle(rng, arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    const tmp = arr[i];
    arr[i] = arr[j];
    arr[j] = tmp;
  }
  return arr;
}

function take(rng, arr, n) {
  return shuffle(rng, arr.slice()).slice(0, n);
}

function makeFormatter(dateOrder, clock) {
  return {
    dateOrder,
    clock,
    stamp(date) {
      const d = pad2(date.getUTCDate());
      const m = pad2(date.getUTCMonth() + 1);
      const y = String(date.getUTCFullYear()).slice(-2);
      const datePart = dateOrder === 'dmy' ? `${d}/${m}/${y}` : `${m}/${d}/${y}`;
      let timePart;
      if (clock === '24h') {
        timePart = `${pad2(date.getUTCHours())}:${pad2(date.getUTCMinutes())}`;
      } else {
        let h = date.getUTCHours() % 12;
        if (h === 0) h = 12;
        timePart = `${h}:${pad2(date.getUTCMinutes())} ${date.getUTCHours() < 12 ? 'am' : 'pm'}`;
      }
      return `${datePart}, ${timePart} - `;
    },
  };
}

function makeCollector() {
  return { lines: [], quirks: new Set() };
}

function addMessage(c, fmt, t, sender, body) {
  c.lines.push(`${fmt.stamp(t)}${sender}: ${body}`);
  c.quirks.add('standard-sender-line');
}

function addSystem(c, fmt, t, text, extraQuirks) {
  c.lines.push(`${fmt.stamp(t)}${text}`);
  c.quirks.add('senderless-system-line');
  for (const q of extraQuirks || []) c.quirks.add(q);
}

function addMultiline(c, fmt, t, sender, bodyLines) {
  c.lines.push(`${fmt.stamp(t)}${sender}: ${bodyLines[0]}`);
  for (let i = 1; i < bodyLines.length; i++) c.lines.push(bodyLines[i]);
  c.quirks.add('standard-sender-line');
  c.quirks.add('multi-line-message');
}

function addEmptyBody(c, fmt, t, sender) {
  c.lines.push(`${fmt.stamp(t)}${sender}: `);
  c.quirks.add('standard-sender-line');
  c.quirks.add('empty-body-message');
}

function addAttachment(c, rng, fmt, t, sender, kind, variant) {
  const date8 = `${t.getUTCFullYear()}${pad2(t.getUTCMonth() + 1)}${pad2(t.getUTCDate())}`;
  const serial = String(randint(rng, 1, 9999)).padStart(4, '0');
  const filename = `${kind.prefix}-${date8}-WA${serial}.${kind.ext}`;
  if (variant === 'trailing-period') {
    c.lines.push(`${fmt.stamp(t)}${sender}: ${kind.prefix}-${date8}-WA${serial}. (file attached)`);
    c.quirks.add('attachment-trailing-period');
  } else if (variant === 'double') {
    c.lines.push(`${fmt.stamp(t)}${sender}: ${filename} (file attached)`);
    c.lines.push(filename);
    c.quirks.add('attachment-double-filename');
  } else {
    c.lines.push(`${fmt.stamp(t)}${sender}: ${filename} (file attached)`);
    c.quirks.add('attachment-standard');
  }
  c.quirks.add('standard-sender-line');
}

function advance(rng, t) {
  let ms = t.getTime() + randint(rng, 1, 240) * 60000;
  if (rng() < 0.12) ms += randint(rng, 1, 4) * 86400000;
  return new Date(ms);
}

function messageBody(rng, c) {
  const r = rng();
  if (r < 0.15) {
    c.quirks.add('rich-text-markup');
    return `*${pick(rng, SENTENCES)}*`;
  }
  if (r < 0.3) {
    c.quirks.add('rich-text-markup');
    return `_${pick(rng, SENTENCES)}_`;
  }
  if (r < 0.45) {
    c.quirks.add('emoji');
    return `${pick(rng, SENTENCES)} ${pick(rng, EMOJIS)}`;
  }
  return pick(rng, SENTENCES);
}

function multilineBody(rng) {
  const count = randint(rng, 3, 6);
  const body = [pick(rng, MULTILINE_OPENERS)];
  while (body.length < count - 1) body.push(pick(rng, MULTILINE_ITEMS));
  body.push(pick(rng, MULTILINE_CLOSERS));
  return body.slice(0, count);
}

function buildEvents(rng, msgCount, specials) {
  const events = [];
  for (let i = 0; i < msgCount; i++) events.push('msg');
  return shuffle(rng, events.concat(specials));
}

function runEvents(rng, c, fmt, startDate, participants, events) {
  let t = startDate;
  for (const ev of events) {
    t = advance(rng, t);
    if (ev === 'msg') {
      addMessage(c, fmt, t, pick(rng, participants), messageBody(rng, c));
    } else if (ev === 'multiline') {
      addMultiline(c, fmt, t, pick(rng, participants), multilineBody(rng));
    } else if (ev === 'empty') {
      addEmptyBody(c, fmt, t, pick(rng, participants));
    } else if (ev === 'attach-plain') {
      addAttachment(c, rng, fmt, t, pick(rng, participants), pick(rng, ATTACHMENT_KINDS), 'plain');
    } else if (ev === 'attach-trailing') {
      addAttachment(c, rng, fmt, t, pick(rng, participants), pick(rng, ATTACHMENT_KINDS), 'trailing-period');
    } else if (ev === 'attach-double') {
      addAttachment(c, rng, fmt, t, pick(rng, participants), pick(rng, ATTACHMENT_KINDS), 'double');
    }
  }
}

function profileSelfChat(rng) {
  const fmt = makeFormatter('dmy', '12h');
  const c = makeCollector();
  c.quirks.add('date-format-ddmmyy');
  c.quirks.add('time-12h');
  let t = new Date(BASE_DATE);
  addSystem(c, fmt, t, ENC_NOTICE_SELF, ['encryption-notice-self']);
  const participants = ['You', take(rng, CONTACTS, 1)[0]];
  const events = buildEvents(rng, randint(rng, 12, 18), ['attach-plain', 'multiline', 'empty']);
  runEvents(rng, c, fmt, t, participants, events);
  return c;
}

function profileDoubleFilename(rng) {
  const fmt = makeFormatter('mdy', '24h');
  const c = makeCollector();
  c.quirks.add('date-format-mmddyy');
  c.quirks.add('time-24h');
  const t = new Date(BASE_DATE);
  const participants = ['You', take(rng, CONTACTS, 1)[0]];
  const events = buildEvents(rng, randint(rng, 10, 14), [
    'attach-double', 'attach-double', 'attach-trailing', 'attach-plain', 'empty', 'multiline',
  ]);
  runEvents(rng, c, fmt, t, participants, events);
  return c;
}

function profileGroupLifecycle(rng) {
  const fmt = makeFormatter('dmy', '24h');
  const c = makeCollector();
  c.quirks.add('date-format-ddmmyy');
  c.quirks.add('time-24h');
  const groupName = pick(rng, GROUP_NAMES);
  const members = take(rng, CONTACTS, 3);
  let t = new Date(BASE_DATE);
  addSystem(c, fmt, t, ENC_NOTICE_GROUP, ['encryption-notice-group']);
  t = advance(rng, t);
  addSystem(c, fmt, t, `${members[0]} created group "${groupName}"`, ['group-creation']);
  t = advance(rng, t);
  addSystem(c, fmt, t, `${members[0]} added ${members[1]}`, ['membership-added']);
  t = advance(rng, t);
  addSystem(c, fmt, t, 'You were added', ['membership-you-were-added']);
  const participants = ['You'].concat(members);
  const events = buildEvents(rng, randint(rng, 14, 20), ['attach-plain', 'attach-double', 'multiline', 'multiline', 'empty']);
  runEvents(rng, c, fmt, t, participants, events);
  return c;
}

function profileMultilineRich(rng) {
  const fmt = makeFormatter('mdy', '12h');
  const c = makeCollector();
  c.quirks.add('date-format-mmddyy');
  c.quirks.add('time-12h');
  const t = new Date(BASE_DATE);
  const participants = ['You'].concat(take(rng, CONTACTS, 2));
  const events = buildEvents(rng, randint(rng, 8, 12), [
    'multiline', 'multiline', 'multiline', 'attach-plain', 'empty',
  ]);
  runEvents(rng, c, fmt, t, participants, events);
  return c;
}

function profileLongLivedGroup(rng) {
  const fmt = makeFormatter('dmy', '12h');
  const c = makeCollector();
  c.quirks.add('date-format-ddmmyy');
  c.quirks.add('time-12h');
  const groupName = pick(rng, GROUP_NAMES);
  const members = take(rng, CONTACTS, 3);
  let t = new Date(Date.UTC(2019, randint(rng, 0, 11), randint(rng, 1, 28), randint(rng, 8, 20), randint(rng, 0, 59)));
  addSystem(c, fmt, t, ENC_NOTICE_GROUP, ['encryption-notice-group', 'early-year-system-line']);
  t = advance(rng, t);
  addSystem(c, fmt, t, `${members[0]} created group "${groupName}"`, ['group-creation', 'early-year-system-line']);
  t = advance(rng, t);
  addSystem(c, fmt, t, `${members[0]} added ${members[1]}`, ['membership-added', 'early-year-system-line']);
  const recentStart = new Date(BASE_DATE);
  const participants = ['You'].concat(members);
  const events = buildEvents(rng, randint(rng, 10, 14), ['attach-plain', 'multiline']);
  runEvents(rng, c, fmt, recentStart, participants, events);
  return c;
}

const PROFILES = [
  { slug: 'self-chat-encryption-notice', build: profileSelfChat },
  { slug: 'double-filename-attachment', build: profileDoubleFilename },
  { slug: 'group-chat-encryption-and-membership', build: profileGroupLifecycle },
  { slug: 'multiline-and-rich-text', build: profileMultilineRich },
  { slug: 'early-creation-then-recent', build: profileLongLivedGroup },
];

function main() {
  const { seed, count } = parseArgs(process.argv.slice(2));
  const outDir = path.join(__dirname, '..', 'data', 'synthetic_fixtures');
  fs.mkdirSync(outDir, { recursive: true });
  const manifest = { seed, count, fixtures: [] };
  for (let i = 0; i < count; i++) {
    const profile = PROFILES[i % PROFILES.length];
    const rng = mulberry32((seed ^ Math.imul(i + 1, 0x9E3779B9)) >>> 0);
    const c = profile.build(rng);
    const filename = `fixture-${String(i + 1).padStart(2, '0')}-${profile.slug}.txt`;
    fs.writeFileSync(path.join(outDir, filename), `${c.lines.join('\n')}\n`, 'utf8');
    manifest.fixtures.push({ file: filename, quirks: Array.from(c.quirks).sort() });
    console.log(`wrote ${filename} (${c.lines.length} lines)`);
  }
  fs.writeFileSync(path.join(outDir, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
  console.log(`wrote manifest.json (${count} fixture files, seed ${seed})`);
}

main();
