import Phaser from 'phaser';
import { BOAT_PAINT, HEIGHT, HOMES, LANE_LEN, PALETTES, ROW, TILE, WIDTH, rowTop, type Leg } from './config';

const hash = (a: number, b: number) => ((a * 73856093) ^ (b * 19349663)) >>> 0;
const hex = (n: number) => `#${n.toString(16).padStart(6, '0')}`;

function canvas(scene: Phaser.Scene, key: string, w: number, h: number, draw: (g: CanvasRenderingContext2D) => void) {
  if (scene.textures.exists(key)) return;
  const tex = scene.textures.createCanvas(key, w, h)!;
  draw(tex.getContext());
  tex.refresh();
}

/** Texture key of the baked field (hedges, verges, towpath, road) for a leg. The canal rows are left clear. */
export const fieldKey = (leg: Leg) => `field-${leg}`;
export const logKey = (len: number) => `log-${len}`;
export const boatKey = (len: number, paint: number) => `boat-${len}-${paint}`;

/** Bakes every code-drawn texture once per game: both fields, logs, narrowboats, the hay trailer and a headlight beam. */
export function bakeTextures(scene: Phaser.Scene) {
  for (const leg of ['out', 'back'] as const) canvas(scene, fieldKey(leg), WIDTH, HEIGHT, (g) => drawField(g, leg));
  for (const len of LANE_LEN.log) canvas(scene, logKey(len), len, TILE, (g) => drawLog(g, len));
  for (const len of LANE_LEN.boat) BOAT_PAINT.forEach((_, p) => canvas(scene, boatKey(len, p), len, TILE, (g) => drawBoat(g, len, p)));
  canvas(scene, 'trailer', 20, TILE, drawTrailer);
  canvas(scene, 'headlight', 34, TILE, (g) => {
    const grad = g.createLinearGradient(0, 0, 34, 0);
    grad.addColorStop(0, 'rgba(255,200,100,0.7)');
    grad.addColorStop(1, 'rgba(255,200,100,0)');
    g.fillStyle = grad;
    g.beginPath(); g.moveTo(0, 6); g.lineTo(34, 1); g.lineTo(34, 15); g.lineTo(0, 10); g.fill();
  });
}

function drawField(g: CanvasRenderingContext2D, leg: Leg) {
  const P = PALETTES[leg];
  const fill = (c: string, x: number, y: number, w: number, h: number) => { g.fillStyle = c; g.fillRect(x, y, w, h); };
  for (const r of [ROW.nests, ROW.burrows]) {
    const y = rowTop(r);
    fill(P.hedge, 0, y, WIDTH, TILE);
    for (let x = 0; x < WIDTH; x += 3) for (let k = 0; k < 3; k++) { const h = hash(x, r * 7 + k); if (h % 3 === 0) fill(P.hedge2, x, y + (h % 13), 3, 3); }
    for (let i = 0; i < 40; i++) { const h = hash(i, r + 31); fill(P.berry, h % WIDTH, y + 2 + ((h >> 5) % 12), 1, 1); }
    for (const hx of HOMES) {
      fill(P.hole, hx - 10, y + 2, 20, 13);
      fill(P.hole, hx - 8, y + 1, 16, 1);
      fill(P.path, hx - 10, r === ROW.nests ? y + 15 : y + 2, 20, 1);
    }
  }
  for (const r of [ROW.midVerge, ROW.verge]) {
    const y = rowTop(r);
    fill(P.grass, 0, y, WIDTH, TILE);
    for (let i = 0; i < 160; i++) { const h = hash(i, r * 13); fill(h % 5 ? P.tuft : P.grass2, h % WIDTH, y + 1 + ((h >> 7) % 14), h % 4 ? 1 : 2, 1); }
    for (let i = 0; i < 9; i++) { const h = hash(i, r * 17 + 3); fill(P.flower, h % WIDTH, y + 3 + ((h >> 6) % 10), 1, 1); }
  }
  const ty = rowTop(ROW.towpath);
  fill(P.path, 0, ty, WIDTH, TILE);
  for (let i = 0; i < 220; i++) { const h = hash(i, 91); fill(P.path2, h % WIDTH, ty + ((h >> 8) % 16), 1, 1); }
  fill(P.grass, 0, ty, WIDTH, 2);
  for (let r = ROW.roadTop; r <= ROW.roadBottom; r++) {
    const y = rowTop(r);
    fill(P.road, 0, y, WIDTH, TILE);
    for (let i = 0; i < 90; i++) { const h = hash(i, r * 29); fill(P.road2, h % WIDTH, y + ((h >> 9) % 16), 1, 1); }
    if (r > ROW.roadTop) for (let x = 4; x < WIDTH; x += 24) fill(P.dash, x, y, 10, 1);
  }
  fill(P.kerb, 0, rowTop(ROW.roadTop), WIDTH, 1);
  fill(P.kerb, 0, rowTop(ROW.verge) - 1, WIDTH, 1);
  // Stone coping along both canal banks.
  fill(P.coping, 0, rowTop(ROW.canalTop), WIDTH, 2);
  fill(P.coping, 0, rowTop(ROW.midVerge) - 2, WIDTH, 2);
}

function drawLog(g: CanvasRenderingContext2D, len: number) {
  const fill = (c: string, x: number, y: number, w: number, h: number) => { g.fillStyle = c; g.fillRect(x, y, w, h); };
  fill('#6b4a2e', 0, 3, len, 10); fill('#8a6440', 0, 3, len, 2); fill('#4e3420', 0, 11, len, 2);
  for (let k = 6; k < len - 4; k += 11) fill('#4e3420', k, 6, 4, 1);
  fill('#b08a5a', 0, 4, 3, 8); fill('#7a5a38', 1, 6, 1, 4); fill('#b08a5a', len - 3, 4, 3, 8);
}

/** A narrowboat with its bow on the right; flip it for boats heading left. */
function drawBoat(g: CanvasRenderingContext2D, len: number, paint: number) {
  const [body, trim] = BOAT_PAINT[paint].map(hex);
  const fill = (c: string, x: number, y: number, w: number, h: number) => { g.fillStyle = c; g.fillRect(x, y, w, h); };
  fill(body, 3, 3, len - 6, 11); fill(trim, 3, 12, len - 6, 1);
  fill(body, len - 4, 5, 4, 7); fill('#1a1410', 3, 13, len - 6, 1);
  fill('#e8dcc0', 12, 2, len - 26, 4); fill('#c9b994', 12, 5, len - 26, 1);
  for (let k = 18; k < len - 18; k += 12) fill('#f4d27a', k, 8, 3, 2);
  fill('#3a2a20', 6, 4, 3, 4);
}

function drawTrailer(g: CanvasRenderingContext2D) {
  const fill = (c: string, x: number, y: number, w: number, h: number) => { g.fillStyle = c; g.fillRect(x, y, w, h); };
  fill('#7a5a2a', 0, 5, 20, 8); fill('#d8b860', 1, 3, 8, 6); fill('#c9a850', 10, 3, 8, 6);
  fill('#2a2420', 3, 13, 3, 2); fill('#2a2420', 14, 13, 3, 2);
}

/** The canal: water colour plus a slow shimmer that drifts with each lane. Redrawn every frame. */
export class Water {
  private readonly g: Phaser.GameObjects.Graphics;
  constructor(scene: Phaser.Scene, depth: number) {
    this.g = scene.add.graphics().setDepth(depth);
  }
  draw(leg: Leg, clock: number, lanes: ReadonlyArray<{ row: number; dir: number; speed: number }>) {
    const P = PALETTES[leg], g = this.g.clear();
    g.fillStyle(P.water).fillRect(0, rowTop(ROW.canalTop) + 2, WIDTH, 4 * TILE - 4);
    g.fillStyle(P.water2);
    for (const lane of lanes) {
      if (lane.row < ROW.canalTop || lane.row > ROW.canalBottom) continue;
      const y = rowTop(lane.row);
      for (let i = 0; i < 14; i++) {
        const h = hash(i, lane.row * 41);
        const x = ((((h % (WIDTH + 128)) + lane.dir * clock * lane.speed * 0.6) % WIDTH) + WIDTH) % WIDTH;
        g.fillRect(Math.round(x), y + 3 + ((h >> 6) % 11), 6 + (h % 7), 1);
      }
    }
  }
}
