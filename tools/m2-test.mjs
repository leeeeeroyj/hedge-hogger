// Milestone 2 check: hopping, riding, deaths, homes, the timer, score, lives and the leg change.
// Usage: node tools/m2-test.mjs <project-dir> <out-dir>
import { session } from './cdp.mjs';

const [project, out] = process.argv.slice(2);
const t = await session({ project, out, port: 5212, debugPort: 9382 });
const { evaluate, until, shot, tap, down, up, click, check, sleep } = t;
const G = 'window.__hedgeHogger';
const C = `${G}.scene.getScene('crossing')`;
const snap = () => evaluate(`${C}.snapshot()`);
const place = (r, x) => evaluate(`${C}.place(${r}, ${x})`);
const HOP = 260;

await until(() => evaluate(`!!(${G} && ${G}.scene.isActive('title'))`));
await tap('Enter');
await until(() => evaluate(`${G}.scene.isActive('crossing') && ${G}.scene.isActive('hud')`));
await sleep(500);
await evaluate(`${C}.freeze(true)`);
// Milestone 3's bonuses would change exact scores here: keep the beetle and the mouse away.
await evaluate(`${C}.critters.beetleClock = 1e9; ${C}.critters.mouse.wait = 1e9`);

// Helpers that run in the page: find an x on a lane that is clear of traffic, or one under a platform.
const lanes = `(async () => { const L = await import('/src/lanes.ts'); window.__L = L; })()`;
await evaluate(lanes);
const clearX = (row) => evaluate(`(() => { const lane = ${C}.lanes.find((l) => l.row === ${row});
  for (let x = 40; x < 380; x += 2) if (![-10, -6, 0, 6, 10].some((d) => __L.vehicleAt(lane, x + d))) return x; return null; })()`);
const carX = (row) => evaluate(`(() => { const lane = ${C}.lanes.find((l) => l.row === ${row});
  const it = lane.items.find((i) => { const x = __L.itemX(lane, i); return x > 20 && x < 380; }); return it ? __L.itemX(lane, it) + it.len / 2 : null; })()`);
const padX = (row) => evaluate(`(() => { const lane = ${C}.lanes.find((l) => l.row === ${row});
  const it = lane.items.filter((i) => { const x = __L.itemX(lane, i); return x > 20 && x + i.len < 396; }).sort((a, b) => b.len - a.len)[0];
  return it ? __L.itemX(lane, it) + it.len / 2 : null; })()`);
const waterX = (row) => evaluate(`(() => { const lane = ${C}.lanes.find((l) => l.row === ${row});
  for (let x = 40; x < 380; x += 2) if (![-10, 0, 10].some((d) => __L.platformAt(lane, x + d, ${C}.clock))) return x; return null; })()`);

// 1. A forward hop from the burrow: one row up, ten points.
let s = await snap();
await tap('ArrowUp');
await sleep(HOP);
let s2 = await snap();
check('up hops one row from the burrow', s2.hog.r === 12 && s2.hog.x === s.hog.x && !s2.hog.hopping, `r ${s.hog.r} → ${s2.hog.r}`);
check('a new row scores 10', s2.score === s.score + 10, `${s.score} → ${s2.score}`);

// 2. The hedge behind: no hopping back into the burrow; it bumps and the hoglet stays put.
await tap('ArrowDown');
await sleep(HOP);
s = await snap();
check('the start hedge bumps the hoglet back, no death', s.hog.r === 12 && s.hog.dead <= 0 && s.lives === 3);

// 3. Holding a direction repeats the hop; going back over a row scores nothing.
await place(12, 120);
s = await snap();
await down('ArrowRight');
await sleep(620);
await up('ArrowRight');
await sleep(HOP);
s2 = await snap();
const hops = (s2.hog.x - 120) / 16;
check('holding a direction keeps hopping', hops >= 3 && hops <= 5 && Number.isInteger(hops), `${hops} hops`);
check('sideways hops score nothing', s2.score === s.score);

// 4. Space hops forward; a clear road lane is safe.
const rx = await clearX(11);
await place(12, rx);
s = await snap();
await tap(' ');
await sleep(HOP);
s2 = await snap();
check('Space hops forward into a clear lane', s2.hog.r === 11 && s2.hog.dead <= 0 && s2.score === s.score + 10, JSON.stringify(s2.hog));

// 5. Traffic: standing where a vehicle is bumps the hoglet. One life gone, a curled hoglet left behind.
await place(10, await carX(10));
await sleep(150);
s = await snap();
check('a vehicle bumps the hoglet', s.hog.cause === 'BUMPED!' && s.lives === 2, JSON.stringify(s.hog));
check('a bumped hoglet curls up on the road', s.sprite.texture === 'curl' && s.sprite.visible);
await shot('1-bumped');
await until(async () => (await snap()).hog.dead <= 0, 4000);
s = await snap();
check('after a death the next try starts from a burrow', s.hog.r === 13 && s.hog.time === 30, JSON.stringify(s.hog));

// 6. The canal: open water is a splash; a platform carries the hoglet with it.
await place(5, await waterX(5));
await sleep(150);
s = await snap();
check('open water is a splash', s.hog.cause === 'SPLASH!' && s.lives === 1 && !s.sprite.visible);
await shot('2-splash');
await until(async () => (await snap()).hog.dead <= 0, 4000);
await evaluate(`${C}.lives = 3`);

const lx = await padX(5);
await place(5, lx);
s = await snap();
await evaluate(`${C}.freeze(false)`);
await sleep(500);
await evaluate(`${C}.freeze(true)`);
s2 = await snap();
const logLane = s.lanes.find((l) => l.row === 5);
const rode = s2.hog.x - s.hog.x, want = logLane.dir * logLane.speed * (s2.clock - s.clock);
check('a log carries the hoglet at its speed', s2.hog.dead <= 0 && Math.abs(rode - want) < 1.5, `${rode.toFixed(1)} vs ${want.toFixed(1)}`);

// Riding off the edge of the screen sweeps the hoglet away.
await evaluate(`${C}.freeze(false)`);
await until(() => evaluate(`(() => { const lane = ${C}.lanes.find((l) => l.row === 5);
  const x = lane.dir > 0 ? 402 : 14; return [-8, 0, 8].every((d) => __L.platformAt(lane, x + d, ${C}.clock)); })()`), 30000, 10);
await evaluate(`(() => { const lane = ${C}.lanes.find((l) => l.row === 5); ${C}.place(5, lane.dir > 0 ? 402 : 14); })()`);
await until(async () => (await snap()).hog.dead > 0, 2000, 20);
s = await snap();
check('riding off the screen edge sweeps the hoglet away', s.hog.cause === 'SWEPT AWAY!', s.hog.cause);
await evaluate(`${C}.freeze(true)`);
await until(async () => (await snap()).hog.dead <= 0, 4000);
await evaluate(`${C}.lives = 3`);

// 7. The timer: running out costs a life.
await evaluate(`${C}.freeze(false)`);
await evaluate(`${C}.setTime(0.15)`);
await until(async () => (await snap()).hog.dead > 0, 2000, 20);
s = await snap();
check('running out of time costs a life', s.hog.cause === 'TOO SLOW!' && s.lives === 2 && s.hog.time === 0);
await evaluate(`${C}.freeze(true)`);
await until(async () => (await snap()).hog.dead <= 0, 4000);

// The heron walks while the lanes run: put it where these checks don't go.
await evaluate(`${C}.spawn('heron', { x: 220 })`);
// 8. Homes. The hedge between homes bumps; a hop slightly off centre still lands in the home.
await place(1, 106);
await tap('ArrowUp');
await sleep(HOP);
s = await snap();
check('the hedge between homes bumps the hoglet back', s.hog.r === 1 && s.hog.dead <= 0);
await evaluate(`${C}.setTime(20)`);
s = await snap();
await place(1, 80);
await tap('ArrowUp');
await sleep(HOP);
s2 = await snap();
check('a hop near a nest lands in it', s2.nests.join('') === '10000' && s2.burrows.join('') === '01111', `nests ${s2.nests.join('')} burrows ${s2.burrows.join('')}`);
check('home scores 10 + 50 + 10 per half second left', s2.score === s.score + 10 + 50 + 10 * 40, `${s.score} → ${s2.score}`);
check('the next hoglet comes from the next burrow', s2.current === 1 && s2.hog.r === 13 && s2.hog.x === 140, JSON.stringify(s2.hog));
await place(1, 72);
await tap('ArrowUp');
await sleep(HOP);
s = await snap();
check('a full nest bumps the hoglet back', s.hog.r === 1 && s.hog.dead <= 0 && s.nests.join('') === '10000');

// 9. Mouse: a click above the hoglet hops it up.
await place(12, 208);
const pos = await evaluate(`(() => { const cam = ${C}.cameras.main, rect = ${G}.canvas.getBoundingClientRect(), wv = cam.worldView;
  const k = rect.width / wv.width; return { x: rect.left + (208 - wv.x) * k, y: rect.top + (24 + 12 * 16 + 8 - 40 - wv.y) * k }; })()`);
await click(pos.x, pos.y);
await sleep(HOP);
s = await snap();
check('a mouse click above the hoglet hops it up', s.hog.r === 11 || s.hog.cause === 'BUMPED!', JSON.stringify(s.hog));
await until(async () => (await snap()).hog.dead <= 0, 4000);

// 10. All five across: 1000 points, then the back leg, with the nests full and forward meaning down.
await evaluate(`${C}.fillGoals(4)`);
s = await snap();
await place(1, 344);
await tap('ArrowUp');
await until(async () => (await snap()).leg === 'back', 4000);
await sleep(100);
s2 = await snap();
check('the fifth hoglet home starts the back leg, after a breather', s2.leg === 'back' && s2.night === 1 && s2.nests.join('') === '11111' && s2.burrows.join('') === '00000');
check('all five home scores 1000 more', s2.score >= s.score + 1000 + 60, `${s.score} → ${s2.score}`);
check('the back leg starts from the first nest', s2.hog.r === 0 && s2.hog.x === 72);
await tap(' ');
await sleep(HOP);
s = await snap();
check('on the back leg Space hops down the screen', s.hog.r === 1, `r ${s.hog.r}`);
await shot('3-back-leg');

// 11. Out of lives: game over (milestone 4 checks the panel, retry and title).
await evaluate(`${C}.lives = 1`);
await place(5, await waterX(5));
await until(async () => (await snap()).over, 4000);
s = await snap();
check('losing the last life ends the game', s.over && s.lives === 0);

const hud = await evaluate(`${G}.registry.get('hud')`);
check('HUD gets the score, lives and timer', hud.lives === s.lives && hud.score === s.score && Math.abs(hud.time - s.hog.time) < 0.5, JSON.stringify(hud));

t.done();
