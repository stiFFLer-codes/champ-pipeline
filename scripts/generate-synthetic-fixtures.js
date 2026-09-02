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
  let tcfPair = false;
  let deltaDays = 0;
  let epsilonDays = 0;
  let windowDays = 120;
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--seed') {
      seed = Number(argv[++i]);
    } else if (argv[i] === '--count') {
      count = Number(argv[++i]);
    } else if (argv[i] === '--tcf-pair') {
      tcfPair = true;
    } else if (argv[i] === '--delta') {
      deltaDays = Number(argv[++i]);
    } else if (argv[i] === '--epsilon') {
      epsilonDays = Number(argv[++i]);
    } else if (argv[i] === '--window') {
      windowDays = Number(argv[++i]);
    } else {
      fail(`Unknown argument: ${argv[i]}`);
    }
  }
  if (!Number.isInteger(seed)) fail('--seed must be an integer');
  if (tcfPair) {
    if (!Number.isInteger(deltaDays) || deltaDays < 0) fail('--delta must be a non-negative integer (days)');
    if (!Number.isInteger(epsilonDays) || epsilonDays < 0) fail('--epsilon must be a non-negative integer (days)');
    if (!Number.isInteger(windowDays) || windowDays < 1) fail('--window must be a positive integer (days)');
    if (deltaDays + epsilonDays >= windowDays) {
      fail('--delta + --epsilon must be smaller than --window, or the fragments are not fragments');
    }
    return { seed, tcfPair, deltaDays, epsilonDays, windowDays };
  }
  if (!Number.isInteger(count) || count < 1) fail('--count must be a positive integer');
  if (count < PROFILES.length) {
    console.error(`Warning: --count ${count} < ${PROFILES.length}; the batch will not cover every quirk type.`);
  }
  return { seed, count, tcfPair: false };
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

// --------------------------------------------------------------------------
// TCF fragment pairs.
//
// The five profiles above are parsing edge cases: one account each, no
// relationship between files. Nothing among them exhibits the phenomenon the
// paper is actually about -- two independently preserved fragments of ONE
// account -- so there was nothing an implementation could be run against to
// demonstrate reconstruction. This mode emits that.
//
// One ground-truth timeline is generated, then split per the paper's own
// definition (Section 2.2):
//
//   F1 (primary)    t <= t_f  or  t >= t_r
//   F2 (secondary)  t_f - delta <= t <= t_r + epsilon
//
// A message inside [t_f - delta, t_f] or [t_r, t_r + epsilon] satisfies both
// and is therefore written to BOTH files -- one message, two observations. The
// two fragments are rendered in DIFFERENT date/time formats on purpose, so a
// duplicate pair is byte-different while denoting the same message. That is
// exactly the condition Section 3.4 says deduplication exists for, and an
// implementation that compares raw lines rather than normalised records will
// fail on it.
//
//   --delta 0 --epsilon 0   the disjoint case: the motivating incident, where
//                           reconstruction reduces to ordered concatenation
//   --delta N --epsilon M   the overlapping case the specification is written
//                           for, where N + M days of messages are duplicated
//
// The manifest records ground truth, so a reconstruction can be checked rather
// than admired: expected_unified_size is what |U| must equal, and
// overlap_messages is how many duplicate pairs Synthesis has to collapse.
// --------------------------------------------------------------------------

const DAY_MS = 86400000;

function buildTcfPair(rng, opts) {
  const { deltaDays, epsilonDays, windowDays } = opts;
  const preDays = 30;
  const postDays = 30;

  const start = new Date(BASE_DATE);
  const tF = new Date(start.getTime() + preDays * DAY_MS);
  const tR = new Date(tF.getTime() + windowDays * DAY_MS);
  const end = new Date(tR.getTime() + postDays * DAY_MS);

  // One ground-truth timeline for the whole span. Messages are generated at
  // minute resolution, which is what the export format carries.
  const participants = ['You'].concat(take(rng, CONTACTS, 3));
  const truth = [];
  let t = new Date(start.getTime() + randint(rng, 60, 600) * 60000);
  while (t < end) {
    truth.push({ t: new Date(t.getTime()), sender: pick(rng, participants) });
    // Step in minutes so the whole span is covered at a plausible density.
    t = new Date(t.getTime() + randint(rng, 120, 2880) * 60000);
  }

  const f1Lo = null; // F1 is defined by exclusion, not by a single interval.
  const f2Start = new Date(tF.getTime() - deltaDays * DAY_MS);
  const f2End = new Date(tR.getTime() + epsilonDays * DAY_MS);

  const fmt1 = makeFormatter('dmy', '12h');
  const fmt2 = makeFormatter('mdy', '24h');
  const c1 = makeCollector();
  const c2 = makeCollector();
  c1.quirks.add('date-format-ddmmyy');
  c1.quirks.add('time-12h');
  c2.quirks.add('date-format-mmddyy');
  c2.quirks.add('time-24h');

  addSystem(c1, fmt1, truth[0].t, ENC_NOTICE_GROUP, ['encryption-notice-group']);
  addSystem(c2, fmt2, f2Start, ENC_NOTICE_GROUP, ['encryption-notice-group']);

  let inF1 = 0;
  let inF2 = 0;
  let overlap = 0;
  for (const m of truth) {
    // The body is drawn once and shared, so a duplicated message is the same
    // message in both fragments rather than two different ones at one instant.
    const body = messageBody(rng, c1);
    const onF1 = m.t <= tF || m.t >= tR;
    const onF2 = m.t >= f2Start && m.t <= f2End;
    if (onF1) {
      addMessage(c1, fmt1, m.t, m.sender, body);
      inF1++;
    }
    if (onF2) {
      addMessage(c2, fmt2, m.t, m.sender, body);
      c2.quirks.add('rich-text-markup');
      inF2++;
    }
    if (onF1 && onF2) overlap++;
  }
  void f1Lo;

  // The split is the whole point of this mode, so check it rather than trust
  // it. Every ground-truth message must land in at least one fragment, and a
  // message counted twice must be counted once as an overlap. If this ever
  // fails, the fragments are not a decomposition of the timeline and any
  // reconstruction checked against them would be checked against nonsense.
  if (inF1 + inF2 - overlap !== truth.length) {
    fail(
      `fragment split is not a decomposition: ${inF1} + ${inF2} - ${overlap} ` +
        `!= ${truth.length} ground-truth messages`
    );
  }
  if (deltaDays === 0 && epsilonDays === 0 && overlap !== 0) {
    fail(`delta = epsilon = 0 must yield disjoint fragments, got ${overlap} overlapping`);
  }

  return {
    c1,
    c2,
    meta: {
      t_f: tF.toISOString(),
      t_r: tR.toISOString(),
      delta_days: deltaDays,
      epsilon_days: epsilonDays,
      outage_window_days: windowDays,
      disjoint: overlap === 0,
      ground_truth_messages: truth.length,
      f1_message_records: inF1,
      f2_message_records: inF2,
      overlap_messages: overlap,
      expected_unified_size: truth.length,
      note:
        'expected_unified_size counts messages only, not the encryption-notice ' +
        'system line each fragment opens with. A conforming reconstruction of ' +
        'these two fragments must yield |U| = expected_unified_size after ' +
        'collapsing overlap_messages duplicate pairs.',
    },
  };
}

function mainTcfPair(opts) {
  const outDir = path.join(__dirname, '..', 'data', 'synthetic_fixtures', 'tcf-pair');
  fs.mkdirSync(outDir, { recursive: true });
  const rng = mulberry32((opts.seed ^ 0x54434650) >>> 0);
  const { c1, c2, meta } = buildTcfPair(rng, opts);

  const f1 = 'tcf-F1-primary.txt';
  const f2 = 'tcf-F2-secondary.txt';
  fs.writeFileSync(path.join(outDir, f1), `${c1.lines.join('\n')}\n`, 'utf8');
  fs.writeFileSync(path.join(outDir, f2), `${c2.lines.join('\n')}\n`, 'utf8');

  const manifest = {
    seed: opts.seed,
    mode: 'tcf-pair',
    command:
      `node scripts/generate-synthetic-fixtures.js --tcf-pair --seed ${opts.seed}` +
      ` --delta ${opts.deltaDays} --epsilon ${opts.epsilonDays} --window ${opts.windowDays}`,
    ...meta,
    fragments: [
      { file: f1, role: 'primary', quirks: Array.from(c1.quirks).sort() },
      { file: f2, role: 'secondary', quirks: Array.from(c2.quirks).sort() },
    ],
  };
  fs.writeFileSync(
    path.join(outDir, 'manifest.json'),
    `${JSON.stringify(manifest, null, 2)}\n`,
    'utf8'
  );

  console.log(`wrote ${f1} (${c1.lines.length} lines, ${meta.f1_message_records} messages)`);
  console.log(`wrote ${f2} (${c2.lines.length} lines, ${meta.f2_message_records} messages)`);
  console.log(
    `delta=${opts.deltaDays}d epsilon=${opts.epsilonDays}d -> ` +
      `${meta.overlap_messages} overlapping message(s), ` +
      `${meta.disjoint ? 'DISJOINT (concatenation case)' : 'OVERLAPPING (deduplication case)'}`
  );
  console.log(`ground truth ${meta.ground_truth_messages} messages; |U| must equal ${meta.expected_unified_size}`);
}

function main() {
  const opts = parseArgs(process.argv.slice(2));
  if (opts.tcfPair) {
    mainTcfPair(opts);
    return;
  }
  const { seed, count } = opts;
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
