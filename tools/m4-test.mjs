// Milestone 4 check: the hop combo, extra lives, legs and nights, the ramp, game over, retry and title, high score.
// Usage: node tools/m4-test.mjs <project-dir> <out-dir>
import { session } from './cdp.mjs';

const [project, out] = process.argv.slice(2);
const t = await session({ project, out, port: 5214, debugPort: 9384 });
const { evaluate, until, shot, tap, click, check, sleep } = t;
const G = 'window.__hedgeHogger';
const C = `${G}.scene.getScene('crossing')`;
const snap = () => evaluate(`${C}.snapshot()`);
const place = (r, x) => evaluate(`${C}.place(${r}, ${x})`);
const HOP = 260;

await until(() => evaluate(`!!(${G} && ${G}.scene.isActive('title'))`));
await evaluate(`localStorage.removeItem('hedge-hogger-hi')`);
await tap('Enter');
await until(() => evaluate(`${G}.scene.isActive('crossing') && ${G}.scene.isActive('hud')`));
await sleep(400);
await evaluate(`(async () => { window.__L = await import('/src/lanes.ts'); window.__K = await import('/src/config.ts'); })()`);
const quiet = () => evaluate(`(() => { const c = ${C}.critters; c.beetle = null; c.beetleClock = 1e9; c.mouse.item = null; c.mouse.wait = 1e9;
  c.farmer = null; c.farmerClock = 1e9; c.heron.x = 380; c.heron.st = 'walk'; c.heron.t = 1e9; c.fox.x = 400; })()`);
await evaluate(`${C}.freeze(true)`);
await quiet();

// A column clear of traffic in every road lane, with the lanes frozen.
const col = await evaluate(`(() => { const lanes = ${C}.lanes.filter((l) => __L.isRoad(l.row));
  for (let x = 40; x < 380; x += 2) if (lanes.every((l) => ![-12, -6, 0, 6, 12].some((d) => __L.vehicleAt(l, x + d)))) return x; return null; })()`);
check('found a clear column across the road', col !== null, String(col));

// 1. The combo: quick forward hops go x1, x2, x3, x4, x4, and multiply the row points.
await place(12, col);
let s = await snap();
const combos = [];
for (let k = 0; k < 5; k++) {
  await tap('ArrowUp', 40);
  await sleep(200);
  combos.push((await snap()).hog.combo);
}
let s2 = await snap();
check('quick forward hops build the combo to x4', combos.join(',') === '1,2,3,4,4' && s2.hog.r === 7, combos.join(','));
check('row points are 10 × combo', s2.score === s.score + 10 + 20 + 30 + 40 + 40, `${s.score} → ${s2.score}`);
const hud = await evaluate(`${G}.registry.get('hud')`);
check('the HUD gets the combo', hud.combo === 4);
// Game time, not wall time: headless frames hitch, so wait on the game's own clock.
const lapsed = await until(async () => { const v = await evaluate(`({ combo: ${C}.hog.combo, since: ${C}.age - ${C}.hog.landed })`); return v.since > 0.55 ? v : null; }, 5000, 20);
check('stopping lets the combo lapse', lapsed.combo === 0, JSON.stringify(lapsed));
await place(12, col);
await tap('ArrowUp', 40); await sleep(200);
await tap('ArrowUp', 40); await sleep(200);
const before = (await snap()).hog.combo;
await tap('ArrowDown', 40); await sleep(200);
s = await snap();
check('a hop back ends the combo', before === 2 && s.hog.combo === 0, `${before} → ${s.hog.combo}`);
await place(12, col);
await tap('ArrowUp', 40); await sleep(200);
await tap('ArrowLeft', 40); await sleep(200);
s = await snap();
check('a sideways hop keeps it', s.hog.combo === 1);

// Home points are multiplied too; the time bonus isn't.
await place(1, 140);
await evaluate(`${C}.setTime(20); ${C}.hog.combo = 2; ${C}.hog.landed = ${C}.age`);
s = await snap();
await tap('ArrowUp', 40);
await sleep(HOP);
s2 = await snap();
check('home points are 50 × combo, plus the time bonus', s2.score === s.score + 30 + 150 + 400, `${s.score} → ${s2.score}`);

// 2. Extra lives at 10,000 and then every 20,000.
await evaluate(`${C}.setScore(9990)`);
await place(12, col);
s = await snap();
await tap('ArrowUp', 40);
await sleep(HOP);
s2 = await snap();
check('an extra life at 10,000', s2.lives === s.lives + 1 && s2.nextLife === 30000, `${s.lives} → ${s2.lives}, next ${s2.nextLife}`);
await evaluate(`${C}.setScore(29995)`);
await place(12, col);
await tap('ArrowUp', 40);
await sleep(HOP);
s = await snap();
check('and another at 30,000', s.lives === s2.lives + 1 && s.nextLife === 50000, `${s2.lives} → ${s.lives}, next ${s.nextLife}`);

// 3. Legs and nights: the fifth home gives a breather, then back; the back leg's fifth starts night 2.
await evaluate(`${C}.fillGoals(4)`);
await place(1, 344);
await tap('ArrowUp', 40);
await sleep(HOP);
s = await snap();
check('all five home: a breather with the hoglet off stage', s.between > 0 && s.leg === 'out' && !s.sprite.visible && s.nests.join('') === '11111');
await until(async () => (await snap()).leg === 'back', 4000);
s = await snap();
check('then the back leg of night 1', s.night === 1 && s.leg === 'back' && s.between <= 0);
await quiet();
await evaluate(`${C}.fillGoals(4)`);
await place(12, 344);
await tap('ArrowDown', 40);
await until(async () => (await snap()).night === 2, 4000);
s = await snap();
const hud2 = await evaluate(`${G}.registry.get('hud')`);
check('the back leg done: night 2, out', s.night === 2 && s.leg === 'out' && hud2.night === 2 && hud2.leg === 'out');

// 4. The ramp, straight from the modules: faster lanes, sooner farmer.
const ramp = await evaluate(`(() => {
  const bad = [];
  for (let n = 1; n <= 4; n++) for (const leg of ['out', 'back']) {
    const idx = __K.legIndex(n, leg), want = 1 + __K.RAMP.speed * idx;
    __L.layout(n, leg).forEach((l, i) => { const r = l.speed / (__K.LANES[i].speed * want); if (r < 0.9 - 1e-9 || r > 1.1 + 1e-9) bad.push(n + leg + l.kind + r.toFixed(3)); });
  }
  return bad;
})()`);
check('lane speeds follow the ramp: base × (1 + 0.08 per leg), ±10%', ramp.length === 0, ramp.join(' '));
const farmer = await evaluate(`(() => { const c = ${C}; const out = {}; for (const [n, leg] of [[2, 'out'], [2, 'back'], [3, 'out'], [9, 'out']]) { c.setLeg(leg, n); out[n + leg] = +c.critters.farmerClock.toFixed(2); } return out; })()`);
check('the farmer comes sooner each leg after night 2, down to half', farmer['2out'] === 7 && farmer['2back'] === 6.58 && farmer['3out'] === 6.16 && farmer['9out'] === 3.5, JSON.stringify(farmer));

// 5. Game over: the panel, retry on the same seed, and the high score kept.
await evaluate(`${C}.setLeg('back', 2)`);
await quiet();
await evaluate(`${C}.setScore(4321); ${C}.lives = 1`);
await place(5, -2);
await until(async () => (await snap()).over, 4000);
s = await snap();
const hud3 = await evaluate(`${G}.registry.get('hud')`);
check('out of lives: game over', s.over && s.lives === 0 && hud3.over !== null);
await sleep(300);
await shot('1-game-over');
const stored = await evaluate(`localStorage.getItem('hedge-hogger-hi')`);
check('the high score is saved', Number(stored) === s.hi && s.hi >= 4321, `${stored} / ${s.hi}`);
await tap('Enter');
await sleep(200);
s = await snap();
const fresh = await evaluate(`JSON.stringify(__L.layout(2, 'back').map((l) => l.items.map((i) => i.x)))`);
const now = await evaluate(`JSON.stringify(${C}.lanes.map((l) => l.items.map((i) => i.x)))`);
check('Enter retries the same leg from zero', !s.over && s.score === 0 && s.lives === 3 && s.night === 2 && s.leg === 'back' && s.nests.join('') === '11111');
check('the retry repeats the seed', fresh === now && s.clock < 1);
s = await snap();
check('the high score survives the retry', s.hi >= 4321);

// The TITLE button on the panel.
await quiet();
await evaluate(`${C}.lives = 1`);
await place(5, -2);
await until(async () => (await snap()).over, 4000);
const btn = await evaluate(`(() => { const r = ${G}.canvas.getBoundingClientRect(), k = r.width / 832; const y = 48 + (496 - 48) / 2 + 98 - 76 + 20; return { x: r.left + (416 + 80) * k, y: r.top + y * k }; })()`);
await click(btn.x, btn.y);
await until(() => evaluate(`${G}.scene.isActive('title') && !${G}.scene.isActive('hud')`), 4000);
check('TITLE on the panel goes back to the title', true);

// A new game keeps the saved high score.
await tap('Enter');
await until(() => evaluate(`${G}.scene.isActive('crossing')`));
await sleep(300);
s = await snap();
check('a new game starts at night 1 with the saved high score', s.night === 1 && s.leg === 'out' && s.score === 0 && s.hi >= 4321, `hi ${s.hi}`);

t.done();
