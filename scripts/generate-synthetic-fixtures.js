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
  console.error('       node scripts/generate-synthetic-fixtures.js --tcf-pair [--seed <int>] [--delta <days>] [--epsilon <days>] [--window <days>]');
  console.error('       node scripts/generate-synthetic-fixtures.js --scenario <config.json> --out <dir>');
  process.exit(1);
}

function parseArgs(argv) {
  let seed = 1;
  let count = 5;
  let tcfPair = false;
  let deltaDays = 0;
  let epsilonDays = 0;
  let windowDays = 120;
  let scenario = null;
  let out = null;
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--scenario') {
      scenario = argv[++i];
    } else if (argv[i] === '--out') {
      out = argv[++i];
    } else if (argv[i] === '--seed') {
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
  if (scenario || out) {
    if (!scenario || !out) fail('--scenario and --out go together');
    return { scenario, out };
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
//   F1 (primary)    t < t_f  or  t >= t_r
//   F2 (secondary)  t_f - delta <= t < t_r + epsilon
//
// Half-open (CARTA 1.1). The closed intervals of the first version put a
// message stamped exactly t_f or t_r into BOTH fragments even at
// delta = epsilon = 0, so the "disjoint" case was not disjoint (28 of seeds
// 1-20,000 aborted on it). Half-open intervals make delta = epsilon = 0 a
// partition of the timeline by construction.
//
// A message inside [t_f - delta, t_f) or [t_r, t_r + epsilon) satisfies both
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
    // Its quirks are collected apart and credited only to the fragment(s) the
    // message is written to, so each manifest lists what its file contains.
    const bodyQuirks = makeCollector();
    const body = messageBody(rng, bodyQuirks);
    const onF1 = m.t < tF || m.t >= tR;
    const onF2 = m.t >= f2Start && m.t < f2End;
    if (onF1) {
      addMessage(c1, fmt1, m.t, m.sender, body);
      for (const q of bodyQuirks.quirks) c1.quirks.add(q);
      inF1++;
    }
    if (onF2) {
      addMessage(c2, fmt2, m.t, m.sender, body);
      for (const q of bodyQuirks.quirks) c2.quirks.add(q);
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

// --------------------------------------------------------------------------
// Scenarios: the TCF pair generalised, for the experiments. Kept apart from
// buildTcfPair so the committed pair still regenerates byte for byte.
//
// Fragments, n = 2..4, by n - 1 failures of the primary:
//   outage i   [t_f_i, t_r_i);  t_f_1 = start + pre, t_r_i = t_f_i + window,
//              t_f_(i+1) = t_r_i + gap
//   P          t outside every outage
//   S_i        t_f_i - delta <= t < t_r_i + epsilon
// Every boundary sits 30 s into its minute, so one minute can straddle it.
//
// Ground truth: `size` messages at DISTINCT minutes, uniform over [start, end),
// each at a random second. One message per minute is a declared
// simplification: every same-minute phenomenon (repeats, sender clashes,
// ordering contradictions) comes from a knob, so what it must do to the
// outcome is known. Each fragment opens with its own encryption notice (P at
// its first message, S_i at its first instant; no message shares that minute).
//
// Rendering: a fragment writes the messages it holds in ground-truth order,
// stamped with its render zone's wall clock, to the minute. The pipeline is
// told the DECLARED zone, which is the render zone unless knob (f) says not.
// Zones here are fixed offsets only.
//
// Knobs (each instance is listed in the manifest with the effect it must have
// on a default run: --infer, one-to-one, dt_granularity 0):
//   a  k identical messages, same sender, same minute: inside the overlap,
//      outside it, or on a boundary (copies on both sides of it)
//   b  one body, two senders, one minute
//   c  two messages in one minute that one fragment writes in the other order
//   d  an attachment written doubled-filename or trailing-period in one
//      fragment and standard in the others
//   e  a body that differs in one fragment: a SYNTHETIC variant (" (rev)"
//      appended), not WhatsApp's rendering of an edited message
//   f  one fragment declared in a zone other than the one it was rendered in
//   g  +-1 min on one fragment's copy of an overlap message, probability p: a
//      HYPOTHETICAL stand-in for clock disagreement, not an observed behaviour
//   h  a message whose date is ambiguous in one fragment's zone and not in
//      another's (needs fragments in different zones)
// --------------------------------------------------------------------------

const MIN_MS = 60000;
const BOUNDARY_SECOND = 30;
const FORMAT_CYCLE = [['dmy', '12h'], ['mdy', '24h'], ['dmy', '24h'], ['mdy', '12h']];
const COMMON_REPEATS = ['ok', 'yes', 'lol', '👍', 'thanks'];

const SCENARIO_DEFAULTS = {
  seed: 1,
  size: 170,
  fragments: 2,
  deltaDays: 14,
  epsilonDays: 7,
  preDays: 30,
  windowDays: 120,
  gapDays: 60,
  postDays: 30,
  start: '2024-01-08T09:00:00.000Z',
  attachmentRate: 0.05,
  formats: null, // [{dateOrder, clock, zone}] per fragment; default FORMAT_CYCLE in +00:00
  knobs: {},
};

function offsetMs(zone) {
  const m = /^([+-])(\d{2}):(\d{2})$/.exec(zone);
  if (!m) throw new Error(`scenario zones are fixed offsets (+HH:MM), got "${zone}"`);
  return (m[1] === '-' ? -1 : 1) * (Number(m[2]) * 60 + Number(m[3])) * MIN_MS;
}

function resolveScenarioConfig(input) {
  const cfg = Object.assign({}, SCENARIO_DEFAULTS, input || {});
  const n = cfg.fragments;
  if (!Number.isInteger(n) || n < 2 || n > 4) throw new Error('fragments must be 2, 3 or 4');
  for (const k of ['seed', 'size', 'deltaDays', 'epsilonDays', 'preDays', 'windowDays', 'gapDays', 'postDays']) {
    if (!Number.isInteger(cfg[k]) || cfg[k] < 0) throw new Error(`${k} must be a non-negative integer`);
  }
  if (cfg.size < 1 || cfg.windowDays < 1) throw new Error('size and windowDays must be positive');
  cfg.formats = cfg.formats || FORMAT_CYCLE.slice(0, n).map(([dateOrder, clock]) => ({ dateOrder, clock, zone: '+00:00' }));
  if (cfg.formats.length !== n) throw new Error('formats needs one entry per fragment');
  for (const f of cfg.formats) offsetMs(f.zone);
  cfg.knobs = Object.assign({}, cfg.knobs);
  return cfg;
}

function buildScenario(input) {
  const cfg = resolveScenarioConfig(input);
  const rng = mulberry32((cfg.seed ^ 0x5343454e) >>> 0);
  const n = cfg.fragments;
  const start = Date.parse(cfg.start);
  const participants = ['You'].concat(take(rng, CONTACTS, 3));

  // --- geometry ------------------------------------------------------------
  const outages = [];
  let tf = start + cfg.preDays * DAY_MS + BOUNDARY_SECOND * 1000;
  for (let i = 1; i < n; i++) {
    const tr = tf + cfg.windowDays * DAY_MS;
    outages.push([tf, tr]);
    tf = tr + cfg.gapDays * DAY_MS;
  }
  const end = outages[n - 2][1] + cfg.postDays * DAY_MS;
  const delta = cfg.deltaDays * DAY_MS;
  const eps = cfg.epsilonDays * DAY_MS;
  const holds = [(t) => outages.every(([a, b]) => t < a || t >= b)]
    .concat(outages.map(([a, b]) => (t) => t >= a - delta && t < b + eps));
  const holdersAt = (t) => holds.map((h, i) => (h(t) ? i : -1)).filter((i) => i >= 0);
  const cuts = [...new Set([start, end].concat(...outages.map(([a, b]) => [a, b, a - delta, b + eps])))]
    .filter((x) => x >= start && x <= end).sort((x, y) => x - y);
  const boundaries = cuts.filter((b) => b > start && b < end && holdersAt(b - 1).join() !== holdersAt(b).join());

  // --- ground truth --------------------------------------------------------
  const used = new Set(outages.map(([a]) => Math.floor((a - delta) / MIN_MS))); // S_i notice minutes
  const startMin = Math.ceil(start / MIN_MS);
  const totalMin = Math.floor(end / MIN_MS) - startMin;
  if (cfg.size > totalMin / 2) throw new Error(`size ${cfg.size} is too dense for ${totalMin} minutes`);
  const minutes = [];
  while (minutes.length < cfg.size) {
    const m = startMin + Math.floor(rng() * totalMin);
    if (!used.has(m)) { used.add(m); minutes.push(m); }
  }
  minutes.sort((x, y) => x - y);

  const messages = [];
  const serials = new Map();
  const add = (t, sender, body, extra) => {
    const m = Object.assign({ id: `m${String(messages.length + 1).padStart(7, '0')}`, seq: messages.length, t, sender, body, attachment: null, knob: null }, extra);
    messages.push(m);
    return m;
  };
  const attachmentAt = (t) => {
    const kind = pick(rng, ATTACHMENT_KINDS);
    const d = new Date(t);
    const date8 = `${d.getUTCFullYear()}${pad2(d.getUTCMonth() + 1)}${pad2(d.getUTCDate())}`;
    const serial = (serials.get(date8) || 0) + 1; // unique per day, so stems never collide
    serials.set(date8, serial);
    const stem = `${kind.prefix}-${date8}-WA${String(serial).padStart(4, '0')}`;
    return { name: `${stem}.${kind.ext}`, stem };
  };
  for (const m of minutes) {
    const t = m * MIN_MS + randint(rng, 0, 59) * 1000;
    const sender = pick(rng, participants);
    if (rng() < cfg.attachmentRate) add(t, sender, '', { attachment: attachmentAt(t) });
    else add(t, sender, messageBody(rng, makeCollector()));
  }

  // --- knob placement --------------------------------------------------------
  // A free minute (nothing else in it) whose holders satisfy `where`: inside
  // the overlap (>= 2 fragments), outside it (exactly 1), or anywhere. With
  // `accept`, every candidate is enumerated and one drawn from those accepted.
  const segments = (pred) => {
    const out = [];
    for (let i = 0; i + 1 < cuts.length; i++) if (pred(holdersAt(cuts[i]))) out.push([cuts[i], cuts[i + 1]]);
    return out;
  };
  function freeMinute(where, spread, accept) {
    const pred = where === 'inside' ? (h) => h.length >= 2 : where === 'outside' ? (h) => h.length === 1 : () => true;
    const ranges = segments(pred).map(([a, b]) => [Math.ceil(a / MIN_MS), Math.floor(b / MIN_MS) - 1 - spread])
      .filter(([lo, hi]) => hi >= lo);
    const free = (m) => { for (let s = 0; s <= spread; s++) if (used.has(m + s)) return false; return true; };
    let m = null;
    if (accept) {
      const ok = [];
      for (const [lo, hi] of ranges) for (let x = lo; x <= hi; x++) if (free(x) && accept(x)) ok.push(x);
      if (ok.length) m = ok[Math.floor(rng() * ok.length)];
    } else {
      const total = ranges.reduce((s, [lo, hi]) => s + hi - lo + 1, 0);
      for (let tries = 0; total > 0 && m === null && tries < 1000; tries++) {
        let r = Math.floor(rng() * total);
        for (const [lo, hi] of ranges) { if (r <= hi - lo) { if (free(lo + r)) m = lo + r; break; } r -= hi - lo + 1; }
      }
    }
    if (m !== null) for (let s = 0; s <= spread; s++) used.add(m + s);
    return m;
  }
  // `count` distinct seconds in [lo, hi], ascending.
  const seconds = (count, lo, hi) => take(rng, Array.from({ length: hi - lo + 1 }, (_, i) => lo + i), count).sort((x, y) => x - y);
  const knobs = [];
  let serial = 0;
  const unique = (knob) => `${pick(rng, SENTENCES)} (${knob}${++serial})`;
  const spec = (k) => [].concat(cfg.knobs[k] || []);

  for (const s of spec('a')) {
    for (let c = 0; c < (s.count || 1); c++) {
      const k = Array.isArray(s.k) ? randint(rng, s.k[0], s.k[1]) : (s.k || 2);
      const where = s.where === 'mixed' ? pick(rng, ['inside', 'outside', 'boundary']) : (s.where || 'inside');
      const sender = pick(rng, participants);
      const body = s.common ? pick(rng, COMMON_REPEATS) : unique('a');
      let times = null;
      if (where === 'boundary') {
        const order = take(rng, boundaries, boundaries.length);
        const b = order.find((x) => !used.has(Math.floor(x / MIN_MS)));
        if (b !== undefined) {
          const m = Math.floor(b / MIN_MS);
          used.add(m);
          const before = Math.ceil(k / 2);
          times = seconds(before, 0, BOUNDARY_SECOND - 1).concat(seconds(k - before, BOUNDARY_SECOND, 59))
            .map((sec) => m * MIN_MS + sec * 1000);
        }
      } else {
        const spread = s.spread ? randint(rng, 0, s.spread) : 0;
        const m = freeMinute(where, spread, null);
        if (m !== null) {
          const offs = [0].concat(Array.from({ length: k - 1 }, () => randint(rng, 0, spread))).sort((x, y) => x - y);
          // Copies sharing a minute get ascending seconds, so ground-truth order is their written order.
          const secs = seconds(k, 0, 59);
          times = offs.map((o, i) => (m + o) * MIN_MS + secs[i] * 1000).sort((x, y) => x - y);
        }
      }
      const items = times ? times.map((t) => add(t, sender, body, { knob: 'a' })) : [];
      knobs.push({ knob: 'a', where, k, common: !!s.common, placed: !!times, items });
    }
  }
  for (const s of spec('b')) {
    for (let c = 0; c < (s.count || 1); c++) {
      const where = s.where || 'inside';
      const m = freeMinute(where, 0, null);
      const [s1, s2] = take(rng, participants, 2);
      const body = unique('b');
      const secs = seconds(2, 0, 59);
      const items = m === null ? [] : [add(m * MIN_MS + secs[0] * 1000, s1, body, { knob: 'b' }), add(m * MIN_MS + secs[1] * 1000, s2, body, { knob: 'b' })];
      knobs.push({ knob: 'b', where, placed: m !== null, items });
    }
  }
  for (const s of spec('c')) {
    for (let c = 0; c < (s.count || 1); c++) {
      const m = freeMinute('inside', 0, null);
      const secs = seconds(2, 0, 59);
      const items = m === null ? [] : [0, 1].map((i) => add(m * MIN_MS + secs[i] * 1000, pick(rng, participants), unique('c'), { knob: 'c' }));
      knobs.push({ knob: 'c', placed: m !== null, items });
    }
  }
  for (const s of spec('d')) {
    for (let c = 0; c < (s.count || 1); c++) {
      const form = s.form === 'mixed' || !s.form ? pick(rng, ['double-filename', 'trailing-period']) : s.form;
      const m = freeMinute('inside', 0, null);
      const t = m === null ? 0 : m * MIN_MS + randint(rng, 0, 59) * 1000;
      const items = m === null ? [] : [add(t, pick(rng, participants), '', { knob: 'd', attachment: attachmentAt(t), variantForm: form })];
      knobs.push({ knob: 'd', form, placed: m !== null, items });
    }
  }
  for (const s of spec('e')) {
    for (let c = 0; c < (s.count || 1); c++) {
      const m = freeMinute('inside', 0, null);
      const items = [];
      if (m !== null) {
        const body = unique('e');
        items.push(add(m * MIN_MS + randint(rng, 0, 59) * 1000, pick(rng, participants), body, { knob: 'e', variantBody: `${body} (rev)` }));
      }
      knobs.push({ knob: 'e', variant: 'synthetic: " (rev)" appended in one fragment', placed: m !== null, items });
    }
  }
  const zones = cfg.formats.map((f) => offsetMs(f.zone));
  for (const s of spec('h')) {
    for (let c = 0; c < (s.count || 1); c++) {
      const ambiguousIn = (m, i) => new Date(m * MIN_MS + zones[i]).getUTCDate() <= 12;
      const m = freeMinute('inside', 0, (x) => new Set(holdersAt(x * MIN_MS).map((i) => ambiguousIn(x, i))).size > 1);
      const items = m === null ? [] : [add(m * MIN_MS + randint(rng, 0, 59) * 1000, pick(rng, participants), unique('h'), { knob: 'h' })];
      knobs.push({ knob: 'h', placed: m !== null, items });
    }
  }

  messages.sort((x, y) => x.t - y.t || x.seq - y.seq);
  for (const m of messages) m.holders = holdersAt(m.t);
  // Variants go to the LAST fragment holding the message.
  const last = (m) => m.holders[m.holders.length - 1];
  for (const k of knobs) {
    if (k.knob === 'c' && k.items.length) k.items[1].swapIn = last(k.items[1]);
    for (const m of k.items) {
      if (m.variantForm) m.variantForm = { frag: last(m), form: m.variantForm };
      if (m.variantBody) m.variantBody = { frag: last(m), body: m.variantBody };
    }
  }
  const g = cfg.knobs.g;
  if (g) {
    const jittered = [];
    for (const m of messages) {
      if (m.holders.length < 2 || !(rng() < g.p)) continue;
      m.jitter = { frag: last(m), minutes: rng() < 0.5 ? -1 : 1 };
      jittered.push(m);
    }
    knobs.push({ knob: 'g', p: g.p, stand_in: 'hypothetical clock disagreement', placed: jittered.length > 0, items: jittered });
  }
  const declared = cfg.formats.map((f) => f.zone);
  const f = cfg.knobs.f;
  if (f) {
    declared[f.fragment] = f.declaredZone;
    knobs.push({ knob: 'f', fragment: f.fragment, renderZone: cfg.formats[f.fragment].zone, declaredZone: f.declaredZone, placed: f.declaredZone !== cfg.formats[f.fragment].zone, items: [] });
  }

  // --- rendering -------------------------------------------------------------
  const fragments = cfg.formats.map((fm, i) => ({
    index: i,
    file: `scenario-F${i + 1}-${i === 0 ? 'primary' : 'secondary'}.txt`,
    role: i === 0 ? 'primary' : 'secondary',
    dateOrder: fm.dateOrder,
    clock: fm.clock,
    zone: fm.zone,
    declaredZone: declared[i],
    interval: i === 0 ? 'outside every outage' : `[${new Date(outages[i - 1][0] - delta).toISOString()}, ${new Date(outages[i - 1][1] + eps).toISOString()})`,
    lines: [],
  }));
  const observations = [];
  const render = (fr, id, t, jitterMin, sender, text, extra) => {
    const wall = Math.floor((t + offsetMs(fr.zone)) / MIN_MS) * MIN_MS + jitterMin * MIN_MS;
    const line = fr.lines.length + 1;
    const stamp = makeFormatter(fr.dateOrder, fr.clock).stamp(new Date(wall));
    fr.lines.push(`${stamp}${sender === null ? '' : `${sender}: `}${text}`);
    const o = Object.assign({
      id: `${fr.index}:${line}`, gt: id, frag: fr.index, line,
      tRead: wall - offsetMs(fr.declaredZone), sender, body: text, stem: null, form: null,
      ambiguous: new Date(wall).getUTCDate() <= 12,
    }, extra);
    observations.push(o);
    return o;
  };
  const systemLines = [];
  for (const fr of fragments) {
    const held = messages.filter((m) => m.holders.includes(fr.index));
    for (let j = 0; j + 1 < held.length; j++) {
      if (held[j + 1].swapIn === fr.index) [held[j], held[j + 1]] = [held[j + 1], held[j]];
    }
    const noticeT = fr.index === 0 ? (held.length ? held[0].t : start) : outages[fr.index - 1][0] - delta;
    const sysId = `sys-F${fr.index + 1}`;
    render(fr, sysId, noticeT, 0, null, ENC_NOTICE_GROUP);
    systemLines.push({ id: sysId, holders: [fr.index] });
    for (const m of held) {
      const jit = m.jitter && m.jitter.frag === fr.index ? m.jitter.minutes : 0;
      if (m.attachment) {
        const form = m.variantForm && m.variantForm.frag === fr.index ? m.variantForm.form : 'standard';
        const ref = form === 'trailing-period' ? `${m.attachment.stem}.` : m.attachment.name;
        const o = render(fr, m.id, m.t, jit, m.sender, `${ref} (file attached)`, { body: '', stem: m.attachment.stem, form });
        if (form === 'double-filename') fr.lines.push(m.attachment.name);
        void o;
      } else {
        const body = m.variantBody && m.variantBody.frag === fr.index ? m.variantBody.body : m.body;
        render(fr, m.id, m.t, jit, m.sender, body);
      }
    }
    fr.text = `${fr.lines.join('\n')}\n`;
  }

  const scn = { config: cfg, fragments, messages, systemLines, observations, knobs };
  for (const k of knobs) k.expect = knobExpectation(scn, k);
  scn.meta = {
    ground_truth_messages: messages.length,
    system_lines: systemLines.length,
    overlap_messages: messages.filter((m) => m.holders.length >= 2).length,
    observations: observations.length,
    boundaries: boundaries.map((b) => new Date(b).toISOString()),
  };
  return scn;
}

// The observations a run keeps: without --infer an ambiguous date is
// quarantined; with it, it is kept if its fragment has an unambiguous one.
function liveObservations(scn, infer) {
  const obs = scn.observations;
  const witness = scn.fragments.map((f) => obs.some((o) => o.frag === f.index && !o.ambiguous));
  return obs.filter((o) => !o.ambiguous || (infer && witness[o.frag]));
}

// Synthesis's zone advisory (Omega.params.zoneAdvisory, frozen with E8 in
// 4464da6) restated on observations: how many offsets it reports for one pair
// of fragments. key = (sender, canonical body, attachment stem); S(d) = size of
// the multiset intersection of (key, instant) at shift d, |d| <= 26 h. An
// offset is reported if it is a nonzero multiple of 15 min with S(d) >= 3,
// S(d) > S(0), S(d) > every control offset's support (the nonzero d that are
// not multiples of 15 min) and support from >= 3 distinct keys.
const ZONE_ADVISORY = { stepMs: 15 * MIN_MS, maxMs: 26 * 60 * MIN_MS, minSupport: 3, minDistinctKeys: 3 };
function zoneAdvisoryCount(first, second) {
  const group = (obs) => {
    const g = new Map();
    for (const o of obs) {
      const k = `${o.sender}\u0000${o.body}\u0000${o.stem || ''}`;
      if (!g.has(k)) g.set(k, new Map());
      g.get(k).set(o.tRead, (g.get(k).get(o.tRead) || 0) + 1);
    }
    return g;
  };
  const b = group(second);
  const support = new Map();
  for (const [k, aByT] of group(first)) {
    const bByT = b.get(k);
    if (!bByT) continue;
    for (const [ta, na] of aByT) {
      for (const [tb, nb] of bByT) {
        const d = tb - ta;
        if (Math.abs(d) > ZONE_ADVISORY.maxMs) continue;
        if (!support.has(d)) support.set(d, { n: 0, keys: new Set() });
        support.get(d).n += Math.min(na, nb);
        support.get(d).keys.add(k);
      }
    }
  }
  const atZero = support.has(0) ? support.get(0).n : 0;
  let control = 0;
  for (const [d, s] of support) if (d % ZONE_ADVISORY.stepMs !== 0) control = Math.max(control, s.n);
  return [...support].filter(([d, s]) => d !== 0 && d % ZONE_ADVISORY.stepMs === 0 && s.n >= ZONE_ADVISORY.minSupport
    && s.n > atZero && s.n > control && s.keys.size >= ZONE_ADVISORY.minDistinctKeys).length;
}

// What one knob instance must do to a default run (--infer, one-to-one,
// dt_granularity 0), stated from how it was placed. These statements ignore
// interactions with other knobs and chance matches, except the advisory count
// of (f): the frozen rule's control offsets and S(0) are chance matches, so
// it is the rule evaluated on the observations. expectedOutcome below ignores
// nothing, and it is what the experiments check against.
function knobExpectation(scn, k) {
  const none = { unifiedDelta: 0, entries: {} };
  if (!k.placed) return none;
  const holderCounts = (items) => {
    const c = {};
    for (const m of items) for (const h of m.holders) c[h] = (c[h] || 0) + 1;
    return c;
  };
  switch (k.knob) {
    case 'a': {
      // Group copies by minute: one key group per minute (spread 0 gives one).
      const byMin = new Map();
      for (const m of k.items) {
        const key = Math.floor(m.t / MIN_MS);
        if (!byMin.has(key)) byMin.set(key, []);
        byMin.get(key).push(m);
      }
      let oneToOne = 0;
      let complete = 0;
      let ambiguities = 0;
      let pairingMatches = true;
      for (const items of byMin.values()) {
        const counts = Object.values(holderCounts(items));
        oneToOne += Math.max(...counts) - items.length;
        complete += 1 - items.length;
        if (counts.length > 1 && new Set(counts).size > 1) ambiguities++;
        // Pair k-th with k-th in each holder's source order, as one-to-one
        // does, and see whether every cluster is one ground-truth message.
        const lists = Object.keys(holderCounts(items)).map((h) => items.filter((m) => m.holders.includes(Number(h))));
        for (let j = 0; j < Math.max(...counts); j++) {
          if (new Set(lists.filter((l) => l.length > j).map((l) => l[j].id)).size > 1) pairingMatches = false;
        }
      }
      return {
        unifiedDelta: oneToOne,
        unifiedDeltaComplete: complete,
        entries: ambiguities ? { dedup_ambiguity: ambiguities } : {},
        holderCounts: holderCounts(k.items),
        pairingMatchesGroundTruth: pairingMatches,
      };
    }
    case 'b': return { unifiedDelta: 0, entries: { 'conflict:sender-disagreement': 1 } };
    case 'c': return { unifiedDelta: 0, entries: { 'conflict:ordering-unsatisfiable': 1 } };
    case 'd': return { unifiedDelta: 0, entries: { 'conflict:within-cluster:attachment.form': 1 } };
    case 'e': return { unifiedDelta: 1, entries: {} };
    case 'f': {
      const i = k.fragment;
      const shared = scn.messages.filter((m) => m.holders.includes(i) && m.holders.length >= 2).length;
      // Advisories are per fragment pair and offset (zoneAdvisoryCount): for
      // each other fragment, those with fragment i read in its declared zone,
      // less those with it read in the zone it was rendered in (what the run
      // without (f) reports by chance).
      const live = liveObservations(scn, true);
      const asRendered = (o) => Object.assign({}, o, { tRead: o.tRead + offsetMs(k.declaredZone) - offsetMs(k.renderZone) });
      const mine = live.filter((o) => o.frag === i);
      let advisories = 0;
      for (const f of scn.fragments) {
        if (f.index === i) continue;
        const theirs = live.filter((o) => o.frag === f.index);
        advisories += zoneAdvisoryCount(mine, theirs) - zoneAdvisoryCount(mine.map(asRendered), theirs);
      }
      return {
        unifiedDelta: shared,
        entries: advisories ? { 'advisory:zone_offset_suspected': advisories } : {},
        shift: `${k.renderZone} rendered, ${k.declaredZone} declared`,
      };
    }
    case 'g': return { unifiedDelta: k.items.length, entries: {}, note: 'at dt_granularity >= 60000 ms these deduplicate' };
    case 'h': return { unifiedDelta: 0, entries: {}, datingMixedDelta: 1, strictQuarantinedDelta: 1 };
    default: return none;
  }
}

// The outcome a conforming run must produce, computed from what the generator
// rendered (instant as read under the declared zone, sender, canonical body,
// attachment stem, date ambiguity, line position), never from parsing the
// files. Valid at dt_granularity = 0, where similarity is equality of
// (t_utc, sender, body, stem); stems are unique per attachment, so congruence
// is stem equality. The clustering and conflict rules restate Synthesis:
// this is an executable statement of the specification, checked against an
// implementation that reads only the bytes.
function expectedOutcome(scn, opts) {
  const { infer = true, clustering = 'one-to-one', dtConflictMs = 60000 } = opts || {};
  const obs = scn.observations;
  const live = liveObservations(scn, infer);
  const key = (o) => `${o.tRead}\u0000${o.sender}\u0000${o.body}\u0000${o.stem}`;
  const groups = new Map();
  for (const o of live) {
    if (!groups.has(key(o))) groups.set(key(o), []);
    groups.get(key(o)).push(o);
  }
  const clusters = [];
  let dedupAmbiguities = 0;
  for (const g of groups.values()) {
    if (clustering !== 'one-to-one') { clusters.push(g); continue; }
    const per = new Map();
    for (const o of g) {
      if (!per.has(o.frag)) per.set(o.frag, []);
      per.get(o.frag).push(o);
    }
    const lists = [...per.values()].map((l) => l.sort((x, y) => x.line - y.line));
    const counts = lists.map((l) => l.length);
    for (let k = 0; k < Math.max(...counts); k++) clusters.push(lists.filter((l) => l.length > k).map((l) => l[k]));
    if (lists.length > 1 && new Set(counts).size > 1) dedupAmbiguities++;
  }
  const conflicts = { 'within-cluster': 0, 'sender-disagreement': 0, 'ordering-unsatisfiable': 0 };
  for (const c of clusters) if (new Set(c.map((o) => o.form)).size > 1) conflicts['within-cluster']++;
  const buckets = new Map();
  for (const c of clusters) {
    const b = Math.floor(c[0].tRead / dtConflictMs);
    if (!buckets.has(b)) buckets.set(b, []);
    buckets.get(b).push(c);
  }
  for (const cs of buckets.values()) {
    for (let i = 0; i < cs.length; i++) {
      for (let j = i + 1; j < cs.length; j++) {
        const [a, b] = [cs[i], cs[j]];
        if (key(a[0]) === key(b[0])) continue;
        const sender = a[0].sender !== null && b[0].sender !== null && a[0].sender !== b[0].sender && a[0].body === b[0].body;
        const signs = new Set();
        for (const x of a) for (const y of b) if (x.frag === y.frag) signs.add(Math.sign(x.line - y.line));
        signs.delete(0);
        if (sender) conflicts['sender-disagreement']++;
        else if (signs.size > 1) conflicts['ordering-unsatisfiable']++;
      }
    }
  }
  const dating = { direct: 0, inferred: 0, mixed: 0 };
  for (const c of clusters) {
    const r = c.filter((o) => o.ambiguous).length;
    dating[r === 0 ? 'direct' : r === c.length ? 'inferred' : 'mixed']++;
  }
  const quarantined = obs.length - live.length;
  return {
    recordsIn: live.length,
    unified: clusters.length,
    unifiedMessages: clusters.filter((c) => c[0].sender !== null).length,
    collapsed: live.length - clusters.length,
    quarantined,
    quarantineByReason: quarantined ? { AMBIGUOUS_DATE_FORMAT: quarantined } : {},
    conflicts,
    dedupAmbiguities,
    dating,
    partition: clusters.map((c) => c.map((o) => o.id).sort()).sort(),
  };
}

// The manifest a scenario is written with: everything but the file bodies.
function scenarioManifest(scn) {
  const counts = (e) => Object.assign({}, e, { partition: undefined });
  const fileOf = (i) => scn.fragments[i].file;
  return {
    mode: 'scenario',
    config: scn.config,
    command: 'node scripts/generate-synthetic-fixtures.js --scenario <this config as JSON> --out <dir>',
    meta: scn.meta,
    fragments: scn.fragments.map((f) => ({
      file: f.file, role: f.role, dateOrder: f.dateOrder, clock: f.clock,
      zone: f.zone, declaredZone: f.declaredZone, interval: f.interval, lines: f.lines.length,
    })),
    knobs: scn.knobs.map((k) => Object.assign({}, k, { items: k.items.map((m) => m.id) })),
    expected: {
      note: 'dt_granularity 0, dt_conflict 60000 ms, default zone advisory; computed from the generator\'s own record of what it wrote',
      infer: { 'one-to-one': counts(expectedOutcome(scn, { infer: true })), complete: counts(expectedOutcome(scn, { infer: true, clustering: 'complete' })) },
      strict: { 'one-to-one': counts(expectedOutcome(scn, { infer: false })) },
    },
    ground_truth: scn.messages.map((m) => ({
      id: m.id, t: new Date(m.t).toISOString(), sender: m.sender, knob: m.knob,
      holders: scn.observations.filter((o) => o.gt === m.id).map((o) => ({ file: fileOf(o.frag), line: o.line })),
    })).concat(scn.systemLines.map((s) => ({
      id: s.id, system: true,
      holders: scn.observations.filter((o) => o.gt === s.id).map((o) => ({ file: fileOf(o.frag), line: o.line })),
    }))),
  };
}

function mainScenario(opts) {
  const scn = buildScenario(JSON.parse(fs.readFileSync(opts.scenario, 'utf8')));
  fs.mkdirSync(opts.out, { recursive: true });
  for (const f of scn.fragments) {
    fs.writeFileSync(path.join(opts.out, f.file), f.text, 'utf8');
    console.log(`wrote ${f.file} (${f.lines.length} lines)`);
  }
  fs.writeFileSync(path.join(opts.out, 'manifest.json'), `${JSON.stringify(scenarioManifest(scn), null, 2)}\n`, 'utf8');
  const e = expectedOutcome(scn);
  console.log(`ground truth ${scn.meta.ground_truth_messages} messages, ${scn.meta.overlap_messages} in >= 2 fragments; expected |U| ${e.unified} (--infer)`);
}

function main() {
  const opts = parseArgs(process.argv.slice(2));
  if (opts.scenario) {
    mainScenario(opts);
    return;
  }
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

// Required (rather than run) by tests that exercise the split directly.
if (require.main === module) main();
module.exports = {
  buildTcfPair, mulberry32, buildScenario, expectedOutcome, scenarioManifest, SCENARIO_DEFAULTS,
};
