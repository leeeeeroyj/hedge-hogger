// Fairness report: runs tools/fairness-search.ts in headless Chrome for nights 1–6, both legs, every start home and a
// few start times, and fails if any crossing has no path inside the timer.
// Usage: node tools/fairness.mjs <project-dir> <out-dir> [nights=6]
import { writeFileSync } from 'node:fs';
import { session } from './cdp.mjs';

const [project, out, nightsArg] = process.argv.slice(2);
const NIGHTS = Number(nightsArg ?? 6);
const OFFSETS = [0, 7, 14];
const t = await session({ project, out, port: 5217, debugPort: 9387 });
const { evaluate, until, check } = t;

await until(() => evaluate(`!!window.__hedgeHogger`));
await evaluate(`(async () => { window.__F = await import('/tools/fairness-search.ts'); })()`);

const all = [];
console.log('night leg   fastest  slowest-start  worst-home   (seconds; timer 30)');
for (let night = 1; night <= NIGHTS; night++) {
  for (const leg of ['out', 'back']) {
    const t0 = Date.now();
    const rows = await evaluate(`(() => { const out = [];
      for (const offset of ${JSON.stringify(OFFSETS)}) for (let start = 0; start < 5; start++) out.push(__F.search(${night}, '${leg}', start, offset));
      return out; })()`);
    all.push(...rows);
    const bests = rows.map((r) => r.best);
    const worstHome = Math.max(...rows.flatMap((r) => r.toHome.map((v) => v ?? Infinity)));
    const fmt = (v) => (v === null || !Number.isFinite(v) ? ' none' : v.toFixed(1).padStart(5));
    const fastest = Math.min(...bests.map((v) => v ?? Infinity)), slowest = Math.max(...bests.map((v) => v ?? Infinity));
    console.log(`  ${night}   ${leg.padEnd(4)}  ${fmt(fastest)}    ${fmt(slowest)}         ${fmt(worstHome)}      (${((Date.now() - t0) / 1000).toFixed(1)} s)`);
  }
}
writeFileSync(`${out}/fairness.json`, JSON.stringify(all, null, 1));

const stuck = all.filter((r) => r.best === null);
check(`every start home reaches a goal home inside 30 s (nights 1–${NIGHTS}, both legs, starts at ${OFFSETS.join('/')} s)`, stuck.length === 0,
  stuck.slice(0, 5).map((r) => `night ${r.night} ${r.leg} home ${r.start + 1} at ${r.offset} s`).join('; '));
const unreachable = all.filter((r) => r.toHome.some((v) => v === null));
check('every goal home is reachable from every start home', unreachable.length === 0,
  unreachable.slice(0, 5).map((r) => `night ${r.night} ${r.leg} from ${r.start + 1} at ${r.offset} s: ${r.toHome.map((v) => (v === null ? '-' : v.toFixed(0))).join(' ')}`).join('; '));
const worst = Math.max(...all.map((r) => r.best ?? 0));
check('the slowest best crossing leaves at least 10 s on the clock', worst <= 20, `${worst.toFixed(1)} s`);
t.done();
