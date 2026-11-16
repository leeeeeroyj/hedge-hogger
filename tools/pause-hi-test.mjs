// Pause and high score: P, Start (the pad) and the page going to the background pause the crossing; P or Enter
// resumes; Esc from the pause menu goes to the title, and the touch II and pause panel buttons work. The high score
// shows on the title.
// Usage: node tools/pause-hi-test.mjs <project-dir> <out-dir>
import { session } from './cdp.mjs';

const [project, out] = process.argv.slice(2);
const t = await session({ project, out, port: 5218, debugPort: 9388 });
const { evaluate, until, shot, tap, click, check, sleep } = t;
const G = 'window.__hedgeHogger';
const S = `${G}.scene.getScene('crossing')`;
const clock = () => evaluate(`${S}.snapshot().clock`);
const start = async () => {
  await until(() => evaluate(`${G}.scene.isActive('title')`));
  await sleep(400);
  await tap('Enter');
  await until(() => evaluate(`${G}.scene.isActive('crossing') && !!${G}.registry.get('hud')`), 5000);
  await sleep(600);
};
/** Design pixels (416 × 248) to page pixels. */
const at = async (x, y) => {
  const r = await evaluate(`(() => { const r = document.querySelector('#game canvas').getBoundingClientRect(); return [r.left, r.top, r.width / 416]; })()`);
  return [r[0] + x * r[2], r[1] + y * r[2]];
};

await until(() => evaluate(`!!${G}`));
await evaluate(`localStorage.setItem('hedge-hogger-hi', '4321')`);
await start();

await tap('p');
await sleep(100);
const a = await clock();
await sleep(600);
check('P pauses: the lanes and the timer stop', (await evaluate(`${S}.paused`)) && (await clock()) === a);
check('the pause panel shows', await evaluate(`${G}.scene.getScene('hud').pauseMenu.visible`));
await shot('1-paused');
await tap('p');
await sleep(400);
check('P again resumes', !(await evaluate(`${S}.paused`)) && (await clock()) > a);
await tap('p');
await sleep(100);
await tap('Enter');
await sleep(100);
check('Enter resumes', !(await evaluate(`${S}.paused`)));
await tap('ArrowUp');
await sleep(300);
check('hops still work after a pause', (await evaluate(`${S}.snapshot().hog.r`)) === 12);
await evaluate(`Object.defineProperty(document, 'hidden', { value: true, configurable: true }); document.dispatchEvent(new Event('visibilitychange'))`);
await sleep(100);
check('the page going to the background pauses', await evaluate(`${S}.paused`));
// Phaser's own loop sleeps on the same event: wake it.
await evaluate(`delete document.hidden; document.dispatchEvent(new Event('visibilitychange'))`);
await sleep(200);
// RESUME on the panel, by mouse: x 133–203, y 130–154 in design pixels.
await click(...(await at(168, 142)));
await sleep(200);
check('the RESUME button resumes', !(await evaluate(`${S}.paused`)));
await tap('p');
await sleep(100);
await tap('Escape');
await until(() => evaluate(`${G}.scene.isActive('title')`), 3000).catch(() => {});
check('Esc from the pause menu goes to the title', await evaluate(`${G}.scene.isActive('title') && !${G}.scene.isActive('hud')`));
await sleep(500);
await shot('2-title');
check('the title shows HI', await evaluate(`${G}.scene.getScene('title').children.list.some((o) => o.text === 'HI 4,321')`));
await start();
check('a run started after leaving from pause is not paused, and its tweens run', !(await evaluate(`${S}.paused || ${S}.tweens.paused`)));
t.done();
