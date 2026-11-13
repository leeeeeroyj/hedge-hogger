// Milestone 5 check: banners, sounds, sparks and rings, shake and flash (and reduced motion), fireflies, dawn, frame time.
// Usage: node tools/m5-test.mjs <project-dir> <out-dir>
import { session } from './cdp.mjs';

const [project, out] = process.argv.slice(2);
const t = await session({ project, out, port: 5215, debugPort: 9385 });
const { send, evaluate, until, shot, tap, check, sleep } = t;
const G = 'window.__hedgeHogger';
const C = `${G}.scene.getScene('crossing')`;
const snap = () => evaluate(`${C}.snapshot()`);
const place = (r, x) => evaluate(`${C}.place(${r}, ${x})`);
const HOP = 260;

async function start() {
  await until(() => evaluate(`!!(${G} && ${G}.scene.isActive('title'))`));
  await tap('Enter');
  await until(() => evaluate(`${G}.scene.isActive('crossing') && ${G}.scene.isActive('hud')`));
  await sleep(300);
  await evaluate(`(async () => { window.__L = await import('/src/lanes.ts'); window.__S = (await import('/src/sfx.ts')).SOUNDS; })()`);
}
const quiet = () => evaluate(`(() => { const c = ${C}.critters; c.beetle = null; c.beetleClock = 1e9; c.mouse.item = null; c.mouse.wait = 1e9;
  c.farmer = null; c.farmerClock = 1e9; c.heron.x = 380; c.heron.st = 'walk'; c.heron.t = 1e9; c.fox.x = 400; ${C}.lives = 3; })()`);
const waitAlive = () => until(async () => (await snap()).hog.dead <= 0, 4000);
const played = async () => (await snap()).played;

await start();
let s = await snap();
check('a leg opens with its banner', s.banner.visible && s.banner.big === 'NIGHT 1' && s.banner.small === 'OUT TO THE ORCHARD', JSON.stringify(s.banner));
const missing = await evaluate(`Object.keys(__S).filter((k) => !${G}.cache.audio.exists('sfx-' + k))`);
check('every sound is built at load', missing.length === 0, missing.join(', '));
check('fireflies come out at dusk', s.fireflies === 5);
await shot('1-leg-banner');
await evaluate(`${C}.freeze(true)`);
await quiet();

// Hops, the combo and a bump each have a sound; landing on land kicks up dust.
const col = await evaluate(`(() => { const lanes = ${C}.lanes.filter((l) => __L.isRoad(l.row));
  for (let x = 40; x < 380; x += 2) if (lanes.every((l) => ![-12, -6, 0, 6, 12].some((d) => __L.vehicleAt(l, x + d)))) return x; return null; })()`);
await place(12, col);
s = await snap();
await tap('ArrowUp', 40); await sleep(200);
await tap('ArrowUp', 40); await sleep(200);
await tap('ArrowUp', 40); await sleep(HOP);
let s2 = await snap();
let p = s2.played.slice(s.played.length);
check('a hop, then combo notes', p[0] === 'hop' && p.filter((n) => n === 'combo').length === 2, p.join(','));
check('landing kicks up dust', s2.fx.bursts >= s.fx.bursts + 3, `${s.fx.bursts} → ${s2.fx.bursts}`);
await place(12, col);
await tap('ArrowDown', 40); await sleep(HOP);
check('a blocked hop bumps with a sound', (await played()).at(-1) === 'bump');

// Deaths: a banner with the cause and the lives left, a sound, sparks, a shake and a flash.
s = await snap();
const carX = () => evaluate(`(() => { const lane = ${C}.lanes.find((l) => l.row === 10);
  const it = lane.items.find((i) => { const x = __L.itemX(lane, i); return x > 40 && x < 360; }); return Math.round(__L.itemX(lane, it) + it.len / 2); })()`);
await place(10, await carX());
await sleep(120);
s2 = await snap();
check('a bump: banner with the cause and lives left', s2.banner.visible && s2.banner.big === 'BUMPED!' && s2.banner.small === '2 LIVES LEFT', JSON.stringify(s2.banner));
check('a bump: squash sound, sparks, shake and flash', s2.played.at(-1) === 'squash' && s2.fx.bursts > s.fx.bursts && s2.fx.shakes > s.fx.shakes && s2.fx.flashes > s.fx.flashes);
await shot('2-bump-burst');
await waitAlive();
await quiet();
s = await snap();
await place(5, -2);
await sleep(120);
s2 = await snap();
check('a splash: splash sound, droplets, no shake', s2.played.at(-1) === 'splash' && s2.fx.bursts > s.fx.bursts && s2.fx.shakes === s.fx.shakes, s2.played.slice(-2).join(','));
await waitAlive();
await quiet();

// Homes: sparks, a ring, a points pop and a jingle; a bonus changes the jingle.
await evaluate(`${C}.spawn('beetle', { home: 1 })`);
await place(1, 140);
s = await snap();
await tap('ArrowUp', 40);
await sleep(150);
s2 = await snap();
check('home with the beetle: sparks, ring and the bonus jingle', s2.fx.bursts > s.fx.bursts && s2.fx.rings > s.fx.rings && s2.played.at(-1) === 'bonus', s2.played.slice(-2).join(','));
await shot('3-home-pops');
await sleep(400);
await place(1, 208);
await tap('ArrowUp', 40);
await sleep(150);
check('a plain home: the home jingle', (await played()).at(-1) === 'home');

// The rest of the cast's sounds.
// He only comes on his own from night 2, when his wait runs out.
await evaluate(`(() => { const c = ${C}; c.place(12, 40); c.night = 2; c.critters.farmerClock = 0; })()`);
await evaluate(`${C}.freeze(false)`);
await sleep(100);
await evaluate(`${C}.freeze(true)`);
check('the farmer arrives with a warning', (await played()).includes('warn'));
await evaluate(`${C}.critters.farmer = null; ${C}.critters.farmerClock = 1e9; ${C}.night = 1`);
await evaluate(`${C}.setScore(9995)`);
await place(12, col);
await tap('ArrowUp', 40);
await sleep(HOP);
check('an extra life has its fanfare', (await played()).includes('extraLife'));
await evaluate(`${C}.setTime(4.6)`);
await evaluate(`${C}.freeze(false)`);
await sleep(1600);
await evaluate(`${C}.freeze(true)`);
check('the last seconds tick', (await played()).filter((n) => n === 'tick').length >= 1);

// All home: banner and fanfare; the back leg brings more fireflies, and dawn comes as the burrows fill.
await quiet();
await evaluate(`${C}.fillGoals(4)`);
await place(1, 344);
await tap('ArrowUp', 40);
await sleep(200);
s = await snap();
check('all home: banner and fanfare', s.banner.big === 'ALL HOME!' && s.banner.small === '+1000' && s.played.includes('allHome'));
await until(async () => (await snap()).leg === 'back', 4000);
await sleep(200);
s = await snap();
check('the back leg opens with its banner and more fireflies', s.banner.big === 'NIGHT 1' && s.banner.small === 'HOME BEFORE DAWN' && s.fireflies === 14 && s.dawn < 0.05);
await quiet();
await evaluate(`${C}.fillGoals(3)`);
await until(async () => (await snap()).dawn > 0.4, 5000, 50);
s = await snap();
check('dawn warms the light as the burrows fill', s.dawn > 0.4 && s.dawn <= 0.46, s.dawn.toFixed(2));
await evaluate(`${C}.freeze(false)`);
await quiet();
await sleep(900);
await shot('4-night-fireflies-dawn');

// Frame time with the whole scene running and a burst going off every 150 ms.
await evaluate(`(() => { const c = ${C}; c.setLeg('out', 2); c.place(12, 40);
  window.__burster = setInterval(() => c.fx.burst(100 + Math.random() * 200, 60 + Math.random() * 150, [0xffb648, 0x6cc3c8], [22, 90, 520]), 150); })()`);
await sleep(500);
const frames = await evaluate(`new Promise((done) => { const d = []; let last = performance.now(); const step = (now) => { d.push(now - last); last = now; if (d.length < 180) requestAnimationFrame(step); else done(d); }; requestAnimationFrame(step); })`);
await evaluate(`clearInterval(window.__burster)`);
const avg = frames.reduce((a, b) => a + b, 0) / frames.length, p95 = [...frames].sort((a, b) => a - b)[Math.floor(frames.length * 0.95)];
check('frame time holds up under bursts (headless, software GL)', avg < 33, `avg ${avg.toFixed(1)} ms, p95 ${p95.toFixed(1)} ms over ${frames.length} frames`);

// Game over: its own sound, and the banner gives way to the panel.
await evaluate(`${C}.freeze(true)`);
await quiet();
await evaluate(`${C}.lives = 1`);
await place(5, -2);
await until(async () => (await snap()).over, 4000);
s = await snap();
check('game over: its sound, and no banner over the panel', s.played.at(-1) === 'gameOver' && !s.banner.visible);

// Reduced motion: no shake, no flash.
await send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'reduce' }] });
await send('Page.reload');
await sleep(500);
await start();
await evaluate(`${C}.freeze(true)`);
await quiet();
await place(10, await carX());
await sleep(150);
s = await snap();
check('reduced motion: a bump still sparks but never shakes or flashes', s.fx.calm && s.hog.cause === 'BUMPED!' && s.fx.bursts > 0 && s.fx.shakes === 0 && s.fx.flashes === 0, JSON.stringify(s.fx));

t.done();
