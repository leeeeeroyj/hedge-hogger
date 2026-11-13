// Milestone 6 check: touch on phones. Corner layout at 844×390, side bars at 932×390, the portrait overlay.
// Usage: node tools/m6-test.mjs <project-dir> <out-dir>
import { session } from './cdp.mjs';

const [project, out] = process.argv.slice(2);
const t = await session({ project, out, port: 5216, debugPort: 9386, width: 844, height: 390, touch: true, mobile: true });
const { send, evaluate, until, shot, press, move, lift, check, sleep } = t;
const G = 'window.__hedgeHogger';
const C = `${G}.scene.getScene('crossing')`;
const snap = () => evaluate(`${C}.snapshot()`);
const place = (r, x) => evaluate(`${C}.place(${r}, ${x})`);
const HOP = 300;
const rect = () => evaluate(`(() => { const r = ${G}.canvas.getBoundingClientRect(); return { left: r.left, top: r.top, width: r.width, height: r.height }; })()`);
/** Design pixels (game space) to CSS pixels. */
const css = async (x, y) => { const r = await rect(), k = r.width / 416; return { x: r.left + x * k, y: r.top + y * k }; };
const tapAt = async (p, ms = 60) => { await press(1, p.x, p.y); await sleep(ms); await lift(1); };
const metrics = (width, height, angle = 90) => send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: true, screenOrientation: { type: angle ? 'landscapePrimary' : 'portraitPrimary', angle } });
const quiet = () => evaluate(`(() => { const c = ${C}.critters; c.beetle = null; c.beetleClock = 1e9; c.mouse.item = null; c.mouse.wait = 1e9;
  c.farmer = null; c.farmerClock = 1e9; c.heron.x = 380; c.heron.st = 'walk'; c.heron.t = 1e9; c.fox.x = 400; ${C}.lives = 3; })()`);

await until(() => evaluate(`!!(${G} && ${G}.scene.isActive('title'))`));
await sleep(600);
await shot('1-title-844');
const titleText = await evaluate(`${G}.scene.getScene('title').children.list.filter((o) => o.type === 'Text').map((o) => o.text).join('|')`);
check('the title shows the touch controls, not keys', titleText.includes('TAP START') && titleText.includes('SWIPE') && !titleText.includes('WASD'));
const touchVisibleOnTitle = await evaluate(`[...document.querySelectorAll('body > div')].some((d) => d.textContent === 'HOP' && d.style.display !== 'none')`);
check('no touch controls on the title', !touchVisibleOnTitle);
const startBox = await evaluate(`(() => { const s = ${G}.scene.getScene('title').start, h = s.input.hitArea, r = ${G}.canvas.getBoundingClientRect(), k = r.width / 416; return { h: h.height * k, w: h.width * k }; })()`);
check('START is a thumb-sized target (36 CSS px or more)', startBox.h >= 36, `${startBox.w.toFixed(0)} × ${startBox.h.toFixed(0)} px`);
await tapAt(await css(208, 118));
await until(() => evaluate(`${G}.scene.isActive('crossing') && ${G}.scene.isActive('hud')`), 5000);
await sleep(400);
check('tapping START starts the game', true);
await evaluate(`${C}.freeze(true)`);
await quiet();

// Corner layout: everything over the game, inside the hedge corners, clear of the outer homes.
let s = await snap();
let r = await rect();
const L = s.touch.layout;
const inside = (p) => p.x > r.left && p.x < r.left + r.width && p.y > r.top && p.y < r.top + r.height;
check('touch controls show during play', s.touch.visible);
check('844×390: d-pad and HOP over the bottom corners', Object.values(L.centers).every(inside), JSON.stringify(L.centers));
const k = r.width / 416;
const homeL = r.left + (72 - 10) * k, homeR = r.left + (344 + 10) * k;
check('they stay clear of the outer homes', L.centers.right.x + L.r <= homeL && L.centers.hop.x - L.hopR >= homeR);
check('d-pad and HOP reach 36 CSS px with their grab margin', L.r * 2 * 1.4 >= 36 && L.hopR * 2 >= 36, `d-pad ${(L.r * 2).toFixed(0)} px (grab ${(L.r * 2.8).toFixed(0)}), HOP ${(L.hopR * 2).toFixed(0)} px`);
await shot('2-crossing-844');

// The d-pad, HOP, a swipe and a tap on the field.
const col = await evaluate(`(async () => { const Ln = await import('/src/lanes.ts'); const lanes = ${C}.lanes.filter((l) => Ln.isRoad(l.row));
  for (let x = 120; x < 300; x += 2) if (lanes.every((l) => ![-12, -6, 0, 6, 12].some((d) => Ln.vehicleAt(l, x + d)))) return x; return null; })()`);
await place(12, col);
await tapAt(L.centers.up);
await sleep(HOP);
s = await snap();
check('d-pad up hops up', s.hog.r === 11 && s.hog.x === col, JSON.stringify(s.hog));
await tapAt(L.centers.left);
await sleep(HOP);
s = await snap();
check('d-pad left hops left', s.hog.x === col - 16);
await tapAt(L.centers.right);
await sleep(HOP);
await place(12, col);
await tapAt(L.centers.hop);
await sleep(HOP);
s = await snap();
check('HOP hops forward', s.hog.r === 11);
await place(12, col);
await press(1, L.centers.up.x, L.centers.up.y);
await sleep(650);
await lift(1);
await sleep(HOP);
s = await snap();
check('holding the d-pad keeps hopping', s.hog.r <= 9, `row ${s.hog.r}`);
await place(12, col);
const mid = await css(200, 150);
await press(2, mid.x, mid.y);
await move(2, mid.x - 30, mid.y + 2);
await sleep(50);
await lift(2);
await sleep(HOP);
s = await snap();
check('a swipe left on the field hops left', s.hog.x === col - 16 && s.hog.r === 12, JSON.stringify(s.hog));
await tapAt(mid);
await sleep(HOP);
s = await snap();
check('a tap on the field hops forward', s.hog.r === 11);
const hud = await evaluate(`${G}.registry.get('hud')`);
check('the HUD hints switch to touch', hud.device === 'touch');

// Two thumbs: hold the d-pad right and tap HOP with the other.
await place(12, col);
await press(1, L.centers.right.x, L.centers.right.y);
await sleep(80);
await press(2, L.centers.hop.x, L.centers.hop.y);
await sleep(60);
await lift(2);
await sleep(80);
await lift(1);
await sleep(HOP);
s = await snap();
check('two thumbs at once: right and HOP both land', s.hog.x >= col + 16 && s.hog.r === 11, JSON.stringify(s.hog));

// The speaker is a big target and a tap there never hops.
await place(12, col);
const hudRect = await rect(), hk = hudRect.width / 832;
check('the speaker target is 36 CSS px or more', 48 * hk >= 36 && 64 * hk >= 36, `${(64 * hk).toFixed(0)} × ${(48 * hk).toFixed(0)} px`);
const muted0 = await evaluate(`${G}.registry.get('muted') === true`);
await tapAt({ x: hudRect.left + (832 - 32) * hk, y: hudRect.top + 24 * hk });
await sleep(HOP);
s = await snap();
const muted1 = await evaluate(`${G}.registry.get('muted') === true`);
check('tapping the speaker toggles sound without a hop', muted1 !== muted0 && s.hog.r === 12);
await tapAt({ x: hudRect.left + (832 - 32) * hk, y: hudRect.top + 24 * hk });

// Game over: the controls hide, RETRY is big and works.
await quiet();
await evaluate(`${C}.lives = 1`);
await place(5, -2);
await until(async () => (await snap()).over, 4000);
await sleep(200);
s = await snap();
const dpadShown = await evaluate(`[...document.querySelectorAll('body > div')].some((d) => d.textContent === 'HOP' && d.style.display !== 'none')`);
check('the controls hide behind the game-over panel', !s.touch.visible && !dpadShown);
check('RETRY and TITLE are 36 CSS px tall or more', 48 * hk >= 36, `${(140 * hk).toFixed(0)} × ${(48 * hk).toFixed(0)} px`);
await shot('3-game-over-844');
await tapAt({ x: hudRect.left + (416 - 80) * hk, y: hudRect.top + (48 + 224 + 104 - 86 + 24) * hk });
await sleep(300);
s = await snap();
check('tapping RETRY retries', !s.over && s.lives === 3 && s.touch.visible);

// Side bars at 932×390: the d-pad left of the game, HOP right of it.
await metrics(932, 390);
await sleep(600);
r = await rect();
s = await snap();
const S2 = s.touch.layout;
check('932×390: d-pad in the left bar, HOP in the right', S2.centers.right.x + S2.r <= r.left && S2.centers.left.x - S2.r >= 0 && S2.centers.hop.x - S2.hopR >= r.left + r.width, JSON.stringify({ left: r.left, right: r.left + r.width, c: S2.centers }));
check('side-bar buttons are 36 CSS px or more', S2.r * 2 >= 36 && S2.hopR * 2 >= 36, `d-pad ${(S2.r * 2).toFixed(0)} px, HOP ${(S2.hopR * 2).toFixed(0)} px`);
await evaluate(`${C}.freeze(true)`);
await quiet();
await place(12, col);
await tapAt(S2.centers.up);
await sleep(HOP);
s = await snap();
check('the side-bar d-pad hops', s.hog.r === 11);
await shot('4-crossing-932');

// Portrait: the turn-your-phone overlay.
await metrics(390, 844, 0);
await sleep(400);
const rotate = await evaluate(`getComputedStyle(document.getElementById('rotate')).display`);
check('portrait shows the turn-your-phone overlay', rotate === 'flex', rotate);
await shot('5-portrait');

t.done();
