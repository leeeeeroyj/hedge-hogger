// Milestone 3 check: diving ducks, the heron, the fox, the farmer, the field mouse and the beetle.
// Usage: node tools/m3-test.mjs <project-dir> <out-dir>
import { session } from './cdp.mjs';

const [project, out] = process.argv.slice(2);
const t = await session({ project, out, port: 5213, debugPort: 9383 });
const { evaluate, until, shot, tap, check, sleep } = t;
const G = 'window.__hedgeHogger';
const C = `${G}.scene.getScene('crossing')`;
const snap = () => evaluate(`${C}.snapshot()`);
const place = (r, x) => evaluate(`${C}.place(${r}, ${x})`);
const freeze = (on) => evaluate(`${C}.freeze(${on})`);
const waitAlive = () => until(async () => (await snap()).hog.dead <= 0, 4000);
const HOP = 260;

await until(() => evaluate(`!!(${G} && ${G}.scene.isActive('title'))`));
await tap('Enter');
await until(() => evaluate(`${G}.scene.isActive('crossing') && ${G}.scene.isActive('hud')`));
await sleep(400);
await evaluate(`(async () => { window.__L = await import('/src/lanes.ts'); window.__K = (await import('/src/config.ts')).CRITTERS; })()`);
// Keep the bonuses out of the way until their own checks.
const quiet = () => evaluate(`${C}.critters.beetle = null; ${C}.critters.beetleClock = 1e9; ${C}.critters.mouse.item = null; ${C}.critters.mouse.wait = 1e9; ${C}.critters.farmerClock = 1e9; ${C}.lives = 3`);
await freeze(true);
await quiet();

// 1. Diving ducks: a family that goes under drops its rider in the water.
await freeze(false);
const duck = await until(() => evaluate(`(() => {
  const c = ${C}, lane = c.lanes.find((l) => l.kind === 'ducks'), now = c.clock;
  for (const [k, it] of lane.items.entries()) {
    if (!it.dives || __L.duckState(it, now) !== 'up') continue;
    let tu = 0; while (__L.duckState(it, now + tu) !== 'under' && tu < 8) tu += 0.02;
    const x0 = __L.itemX(lane, it), xAt = x0 + lane.dir * lane.speed * tu;
    if (tu > 0.6 && tu < 3 && x0 > 30 && x0 + it.len < 386 && xAt > 30 && xAt + it.len < 386) { c.place(lane.row, Math.round(x0 + it.len / 2)); return { k, tu }; }
  }
  return null; })()`), 20000, 50);
const rode = await snap();
check('a hoglet can stand on a duck family that is up', rode.hog.dead <= 0 && rode.hog.r === 4);
await until(async () => (await snap()).hog.dead > 0, 6000, 20);
const dunk = await evaluate(`(() => { const lane = ${C}.lanes.find((l) => l.kind === 'ducks'); return { s: ${C}.snapshot(), st: __L.duckState(lane.items[${duck.k}], ${C}.clock) }; })()`);
check('a diving family drops its rider: SPLASH!', dunk.s.hog.cause === 'SPLASH!' && dunk.st === 'under', `${dunk.s.hog.cause}, ducks ${dunk.st}`);
await freeze(true);
await waitAlive();
await quiet();

// 2. The heron: touching it on the towpath, and its stab into the lily lane.
await evaluate(`${C}.spawn('heron', { x: 200 })`);
await place(1, 204);
await sleep(100);
let s = await snap();
check('walking into the heron on the towpath: PECKED!', s.hog.cause === 'PECKED!', s.hog.cause);
await waitAlive();
await quiet();
const pad = await evaluate(`(() => { const lane = ${C}.lanes.find((l) => l.kind === 'lily');
  const its = lane.items.filter((i) => { const x = __L.itemX(lane, i); return x > 60 && x + i.len < 356; });
  return its.map((i) => Math.round(__L.itemX(lane, i) + i.len / 2)); })()`);
await evaluate(`${C}.spawn('heron', { x: ${pad[0]}, st: 'crouch', t: 5 })`);
await place(2, pad[0]);
await sleep(150);
s = await snap();
check('a crouching heron is a warning, not a hit', s.hog.dead <= 0 && s.critters.heron.st === 'crouch');
await evaluate(`${C}.critters.heron.t = 0.05`);
await freeze(false);
await until(async () => (await snap()).hog.dead > 0, 2000, 20);
s = await snap();
check('the stab takes a hoglet on the pad below: PECKED!', s.hog.cause === 'PECKED!' && s.hog.r === 2, s.hog.cause);
await freeze(true);
await waitAlive();
await quiet();
if (pad.length > 1) {
  await evaluate(`${C}.spawn('heron', { x: ${pad[0]}, st: 'strike', t: 5 })`);
  await place(2, pad[1]);
  await sleep(150);
  s = await snap();
  check('the stab misses a pad further along', s.hog.dead <= 0);
}
await evaluate(`${C}.spawn('heron', { x: 380, st: 'walk', t: 99 })`);

// 3. The fox: not on night 1; on night 2 it guards the middle verge.
await evaluate(`${C}.spawn('fox', { x: 150 })`);
await place(6, 150);
await sleep(150);
s = await snap();
check('night 1 has no fox', s.hog.dead <= 0);
await evaluate(`${C}.setLeg('out', 2)`);
await quiet();
await evaluate(`${C}.spawn('fox', { x: 150 }); ${C}.spawn('heron', { x: 380, st: 'walk', t: 99 })`);
await place(6, 156);
await sleep(150);
s = await snap();
check('from night 2 the fox catches a hoglet on the middle verge: CAUGHT!', s.hog.cause === 'CAUGHT!', s.hog.cause);
await waitAlive();
await quiet();
await evaluate(`${C}.spawn('fox', { x: 380 })`);

// 4. The farmer: night 1 is farmer-free; from night 2 he warns, chases, can be honked off, and leaves.
await evaluate(`${C}.setLeg('out', 1)`);
await quiet();
await evaluate(`${C}.critters.farmerClock = 0`);
await freeze(false);
await sleep(300);
s = await snap();
check('night 1 is farmer-free', s.critters.farmer === null);
await freeze(true);
await evaluate(`${C}.setLeg('out', 2)`);
await quiet();
await evaluate(`${C}.spawn('fox', { x: 380 }); ${C}.spawn('heron', { x: 380, st: 'walk', t: 99 })`);
await place(12, 200);
await evaluate(`${C}.spawn('farmer')`);
await freeze(false);
await sleep(500);
s = await snap();
check('the farmer warns first: torch and "!" on the verge, from the far side', s.critters.farmer?.st === 'warn' && s.critters.farmer.home === 12 && !s.critters.farmer.fromLeft, JSON.stringify(s.critters.farmer));
await shot('1-farmer-warn');
await until(async () => (await snap()).critters.farmer?.st === 'chase', 3000, 20);
const f0 = (await snap()).critters.farmer;
await sleep(1500);
const f1 = (await snap()).critters.farmer;
check('then he walks toward the hoglet', f1.st === 'chase' && f1.tx < f0.tx, `${f0.tx} → ${f1.tx}`);
await shot('2-farmer-chase');
await until(async () => (await snap()).hog.dead > 0, 9000, 20);
s = await snap();
check('if he reaches it: BAGGED!', s.hog.cause === 'BAGGED!', s.hog.cause);
await freeze(true);
await waitAlive();
await quiet();

// Honked: a farmer chasing on the road, with a vehicle in his lane, dives off and scores 300.
const car = await evaluate(`(() => { const lane = ${C}.lanes.find((l) => l.row === 9);
  const it = lane.items.find((i) => { const x = __L.itemX(lane, i); return x > 40 && x < 360; }); return Math.round(__L.itemX(lane, it) + it.len / 2); })()`);
await place(12, 40);
await evaluate(`(() => { const c = ${C}.critters; c.spawnFarmer({ x: 300, y: 0, r: 12, alive: true });
  Object.assign(c.farmer, { st: 'chase', t: 9, fx: ${car}, fr: 9, tx: ${car}, tr: 9, u: 1 }); })()`);
s = await snap();
await freeze(false);
await sleep(100);
await freeze(true);
let s2 = await snap();
check('a vehicle in his lane honks him off: +300', s2.critters.farmer?.st === 'dive' && s2.score === s.score + 300, `${s2.critters.farmer?.st}, ${s.score} → ${s2.score}`);
await freeze(false);
await until(async () => (await snap()).critters.farmer === null, 8000, 50);
s = await snap();
check('he leaves the screen and comes back later', s.critters.farmerClock >= 11 && s.critters.farmerClock <= 18, s.critters.farmerClock.toFixed(1));
await evaluate(`(() => { const c = ${C}.critters; c.spawnFarmer({ x: 100, y: 0, r: 12, alive: true }); Object.assign(c.farmer, { st: 'chase', t: 0.05, u: 1 }); })()`);
await until(async () => (await snap()).critters.farmer?.st === 'leave', 2000, 20);
check('after his chase time he gives up and leaves', true);
await freeze(true);
await evaluate(`${C}.critters.farmer = null`);
await quiet();

// 5. The field mouse: hop onto its log, it climbs on, and it's worth 200 at home.
await evaluate(`${C}.setLeg('out', 1)`);
await quiet();
await evaluate(`${C}.spawn('heron', { x: 380, st: 'walk', t: 99 })`);
const log = await evaluate(`(() => { const lane = ${C}.lanes.find((l) => l.row === 5);
  const k = lane.items.findIndex((i) => { const x = __L.itemX(lane, i); return x > 40 && x + i.len < 376; });
  ${C}.spawn('mouse', { lane: 5, item: k, off: 12 }); return Math.round(__L.itemX(lane, lane.items[k]) + 12); })()`);
await place(6, log);
await tap('ArrowUp');
await sleep(HOP);
s = await snap();
check('hopping next to the mouse: it climbs on', s.hog.r === 5 && s.hog.dead <= 0 && s.critters.mouse.carried, JSON.stringify(s.critters.mouse));
await shot('3-mouse-aboard');
await place(1, 140);
await evaluate(`${C}.setTime(20)`);
s = await snap();
await tap('ArrowUp');
await sleep(HOP);
s2 = await snap();
check('a mouse escorted home scores 200 more', s2.score === s.score + 10 + 50 + 400 + 200 && !s2.critters.mouse.carried, `${s.score} → ${s2.score}`);
// A mouse on a hoglet that dies runs off.
await evaluate(`(() => { const c = ${C}.critters; c.mouse.carried = true; })()`);
await place(5, -2);
await sleep(150);
s = await snap();
check('a carried mouse runs off when the hoglet dies', !s.critters.mouse.carried && s.critters.mouse.item === null);
await waitAlive();
await quiet();

// 6. The beetle: an empty home with a beetle in it is worth 200 more; it leaves after a while.
await evaluate(`${C}.spawn('beetle', { home: 2 })`);
await place(1, 208);
await evaluate(`${C}.setTime(20)`);
s = await snap();
await tap('ArrowUp');
await sleep(HOP);
s2 = await snap();
check('a hoglet that gets to the beetle scores 200 more', s2.score === s.score + 10 + 50 + 400 + 200 && s2.critters.beetle === null, `${s.score} → ${s2.score}`);
await evaluate(`${C}.spawn('beetle', { home: 3, t: 0.3 })`);
await freeze(false);
await sleep(600);
s = await snap();
check('the beetle leaves after its time', s.critters.beetle === null);
await freeze(true);

// The whole cast on night 2 for a look: fox, heron crouching, farmer warning, mouse on a log, beetle in a home.
await evaluate(`${C}.setLeg('out', 2)`);
await quiet();
await evaluate(`(() => { const c = ${C}; c.spawn('fox', { x: 120 }); c.spawn('heron', { x: 250, st: 'crouch', t: 9 }); c.spawn('beetle', { home: 3, t: 9 });
  const lane = c.lanes.find((l) => l.row === 3); const k = lane.items.findIndex((i) => { const x = __L.itemX(lane, i); return x > 40 && x + i.len < 376; });
  c.spawn('mouse', { lane: 3, item: k, off: 28 }); c.place(12, 300); c.spawn('farmer'); c.critters.farmer.t = 0.6; })()`);
await sleep(300);
await shot('4-cast');

t.done();
