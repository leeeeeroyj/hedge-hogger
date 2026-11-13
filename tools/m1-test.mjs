// Milestone 1 check: title, the crossing with all nine lanes moving from a seed, the hoglet in its burrow, both legs.
// Usage: node tools/m1-test.mjs <project-dir> <out-dir>
import { session } from './cdp.mjs';

const [project, out] = process.argv.slice(2);
const t = await session({ project, out, port: 5211, debugPort: 9381 });
const { evaluate, until, shot, tap, check, sleep } = t;
const G = 'window.__hedgeHogger';
const C = `${G}.scene.getScene('crossing')`;

await until(() => evaluate(`!!(${G} && ${G}.scene.isActive('title'))`));
await sleep(800);
await shot('1-title');
check('title scene runs', true);
const missing = await evaluate(`(async () => { const { SPRITES } = await import('/src/config.ts'); return SPRITES.filter((k) => !${G}.textures.exists(k)); })()`);
check('every sprite slot loaded', missing.length === 0, missing.join(', '));

await tap('Enter');
await until(() => evaluate(`${G}.scene.isActive('crossing') && ${G}.scene.isActive('hud')`));
await sleep(700);
await shot('2-crossing-out');

const cfg = await evaluate(`(async () => { const c = await import('/src/config.ts'); return { homes: c.HOMES, burrowY: c.rowMid(c.ROW.burrows), nestY: c.rowMid(c.ROW.nests), span: c.LANE_SPAN }; })()`);
const s0 = await evaluate(`${C}.snapshot()`);
check('nine lanes laid out for night 1, out', s0.lanes.length === 9 && s0.night === 1 && s0.leg === 'out', `${s0.lanes.length} lanes`);
check('hoglet waits in the first burrow', s0.hoglet.x === cfg.homes[0] && s0.hoglet.y === cfg.burrowY, JSON.stringify(s0.hoglet));
check('out leg starts with the burrows full and the nests empty', s0.burrows.join('') === '11111' && s0.nests.join('') === '00000');

// Every lane moves in its own direction at its own speed.
await sleep(1000);
const s1 = await evaluate(`${C}.snapshot()`);
const elapsed = s1.clock - s0.clock;
const moved = s0.lanes.map((l, i) => {
  const d = ((s1.lanes[i].xs[0] - l.xs[0]) % cfg.span + cfg.span * 1.5) % cfg.span - cfg.span / 2;
  return { kind: l.kind, ok: Math.sign(d) === l.dir && Math.abs(Math.abs(d) - l.speed * elapsed) < 1.5, d: d.toFixed(1), want: (l.dir * l.speed * elapsed).toFixed(1) };
});
const bad = moved.filter((m) => !m.ok);
check('every lane moves its way at its speed', bad.length === 0, bad.map((m) => `${m.kind} ${m.d} vs ${m.want}`).join('; ') || `${elapsed.toFixed(2)} s`);

// Seeded layouts, straight from the module.
const seeded = await evaluate(`(async () => {
  const L = await import('/src/lanes.ts');
  const a = JSON.stringify(L.layout(1, 'out')), b = JSON.stringify(L.layout(1, 'out')), c = JSON.stringify(L.layout(1, 'back')), d = JSON.stringify(L.layout(2, 'out'));
  const lanes = L.layout(1, 'out');
  const log = lanes.find((l) => l.kind === 'log'), car = lanes.find((l) => l.kind === 'car'), ducks = lanes.find((l) => l.kind === 'ducks');
  const li = log.items[0], ci = car.items[0], di = ducks.items.find((i) => i.dives);
  const states = new Set(); for (let t = 0; t < 7; t += 0.05) states.add(L.duckState(di, t));
  const t0 = [...Array(140).keys()].map((k) => k * 0.05).find((t) => L.duckState(di, t) === 'under');
  return {
    same: a === b, legDiffers: a !== c, nightDiffers: a !== d,
    onLog: L.platformAt(log, li.x + li.len / 2, 0) === li,
    offLog: L.platformAt(log, li.x - 4, 0) === null,
    hitCar: L.vehicleAt(car, ci.x + 8) === ci,
    duckStates: [...states].sort().join(','),
    underIsWater: L.platformAt(ducks, L.itemX(ducks, di, t0) + 24, t0) === null,
    faster: L.layout(3, 'out').every((l, i) => l.speed > lanes[i].speed),
  };
})()`);
check('same night and leg give the same layout', seeded.same);
check('a different leg or night gives a new layout', seeded.legDiffers && seeded.nightDiffers);
check('lane rules: log under you, open water beside it, a car hits', seeded.onLog && seeded.offLog && seeded.hitCar);
check('diving ducks go up, warn, under; under is open water', seeded.duckStates === 'under,up,warn' && seeded.underIsWater, seeded.duckStates);
check('later legs run faster', seeded.faster);

const hud = await evaluate(`${G}.registry.get('hud')`);
check('HUD state: night 1, out, 3 lives, full timer', hud.night === 1 && hud.leg === 'out' && hud.lives === 3 && hud.time === 30, JSON.stringify(hud));

// The back leg: night palette, nests full, the hoglet waits in the first nest facing down-screen.
await evaluate(`${C}.setLeg('back', 1)`);
await sleep(600);
await shot('3-crossing-back');
const s2 = await evaluate(`${C}.snapshot()`);
check('back leg starts from the nests', s2.leg === 'back' && s2.nests.join('') === '11111' && s2.burrows.join('') === '00000' && s2.hoglet.y === cfg.nestY, JSON.stringify(s2.hoglet));
const hud2 = await evaluate(`${G}.registry.get('hud')`);
check('HUD follows the leg', hud2.leg === 'back');

await tap('Escape');
await until(() => evaluate(`${G}.scene.isActive('title') && !${G}.scene.isActive('hud')`));
check('Esc returns to the title', true);

t.done();
