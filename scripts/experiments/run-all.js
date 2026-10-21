'use strict';

// Runs the experiments, then regenerates results/paper-numbers.json.
//
//   node scripts/experiments/run-all.js              all of them
//   node scripts/experiments/run-all.js e4 e7        only these (paper-numbers
//                                                    still runs last)
//
// Deterministic outputs go to results/*.json and *.csv; wall times, per-stage
// times and machine details go to results/timing/. E3 runs on its own, after
// the others have finished, so its timings are not shared with other work.
// Worker processes: WP2_WORKERS (default: logical CPUs - 1).

const ORDER = ['e1', 'e2', 'e4', 'e5', 'e7', 'e8', 'e3'];
const SCRIPTS = {
  e1: './e1-sweep',
  e2: './e2-properties',
  e3: './e3-scale',
  e4: './e4-scenarios',
  e5: './e5-dedup-sensitivity',
  e7: './e7-representative',
  e8: './e8-advisory',
};

async function main() {
  const asked = process.argv.slice(2).map((a) => a.toLowerCase());
  const bad = asked.filter((a) => !SCRIPTS[a]);
  if (bad.length) {
    console.error(`unknown experiment(s): ${bad.join(', ')} (one of: ${ORDER.join(', ')})`);
    process.exit(1);
  }
  for (const e of ORDER.filter((x) => !asked.length || asked.includes(x))) {
    const t0 = Date.now();
    console.log(`--- ${e}`);
    await require(SCRIPTS[e]).run();
    console.log(`--- ${e} done in ${((Date.now() - t0) / 1000).toFixed(0)} s`);
  }
  require('./paper-numbers').main();
}

main().catch((e) => { console.error(e); process.exit(1); });
