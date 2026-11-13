// The fox, the heron, the farmer, the field mouse and the beetle. Pure state and rules, no Phaser, so tests and the
// fairness check can load it straight from the dev server. The scene draws them and acts on the events.
import { CRITTERS, HOMES, HUD_H, ROW, TILE, WIDTH, rowMid } from './config';
import { isRoad, itemX, vehicleAt, type Item, type Lane } from './lanes';

export type Cause = 'BUMPED!' | 'SPLASH!' | 'SWEPT AWAY!' | 'TOO SLOW!' | 'CAUGHT!' | 'PECKED!' | 'BAGGED!';

/** What the critters need to know about the hoglet. `r` is its row, or the row it's landing on mid-hop. */
export interface HogView { x: number; y: number; r: number; alive: boolean }

export interface Fox { x: number; dir: 1 | -1 }
export interface Heron { x: number; dir: 1 | -1; st: 'walk' | 'crouch' | 'strike'; t: number }
/** The farmer walks from (fx, fr) to (tx, tr); `u` is how far through the step he is. `home` is the row he came in on. */
export interface Farmer {
  st: 'warn' | 'chase' | 'leave' | 'dive';
  t: number;
  home: number;
  fromLeft: boolean;
  fx: number; fr: number; tx: number; tr: number; u: number;
  face: 1 | -1;
}
/** The mouse rides `item` on lane row `lane`, `off` pixels from its left end, until a hoglet carries it. */
export interface Mouse { lane: number; item: Item | null; off: number; carried: boolean; wait: number }
export interface Beetle { home: number; t: number }

export type CritterEvent = { kind: 'honk'; x: number; y: number } | { kind: 'stab'; x: number } | { kind: 'farmer'; row: number; fromLeft: boolean };

const rowOfY = (y: number) => Math.round((y - HUD_H - TILE / 2) / TILE);

export function farmerPos(f: Farmer) {
  const u = Math.min(1, f.u);
  return { x: f.fx + (f.tx - f.fx) * u, y: rowMid(f.fr) + (rowMid(f.tr) - rowMid(f.fr)) * u };
}

export class Critters {
  fox: Fox = { x: 120, dir: 1 };
  heron: Heron = { x: 300, dir: -1, st: 'walk', t: CRITTERS.heron.firstWalk };
  farmer: Farmer | null = null;
  farmerClock: number = CRITTERS.farmer.firstDelay;
  mouse: Mouse = { lane: CRITTERS.mouse.lanes[0], item: null, off: 0, carried: false, wait: CRITTERS.mouse.firstWait };
  beetle: Beetle | null = null;
  beetleClock: number = CRITTERS.beetle.first;

  /** Scales the farmer's waits: 1 on night 2 out, shrinking on later legs. */
  private pace = 1;

  constructor(private rand: () => number) {}

  /** Back to the start of a leg. `rand` is seeded per leg, so a retry brings the same surprises. */
  reset(rand: () => number, pace = 1) {
    this.rand = rand;
    this.pace = pace;
    this.fox = { x: 120, dir: 1 };
    this.heron = { x: 300, dir: -1, st: 'walk', t: CRITTERS.heron.firstWalk };
    this.farmer = null;
    this.farmerClock = CRITTERS.farmer.firstDelay * pace;
    this.mouse = { lane: CRITTERS.mouse.lanes[0], item: null, off: 0, carried: false, wait: CRITTERS.mouse.firstWait };
    this.beetle = null;
    this.beetleClock = CRITTERS.beetle.first;
  }

  update(dt: number, hog: HogView, laneAt: ReadonlyMap<number, Lane>, goals: readonly number[], night: number): CritterEvent[] {
    const events: CritterEvent[] = [];
    const F = CRITTERS.fox, H = CRITTERS.heron;

    const fox = this.fox;
    fox.x += fox.dir * F.speed * dt;
    if (fox.x > F.max) fox.dir = -1;
    else if (fox.x < F.min) fox.dir = 1;

    const heron = this.heron;
    heron.t -= dt;
    if (heron.st === 'walk') {
      heron.x += heron.dir * H.speed * dt;
      if (heron.x > H.max) heron.dir = -1;
      else if (heron.x < H.min) heron.dir = 1;
      if (heron.t <= 0) { heron.st = 'crouch'; heron.t = H.crouch; }
    } else if (heron.st === 'crouch' && heron.t <= 0) {
      heron.st = 'strike';
      heron.t = H.strike;
      events.push({ kind: 'stab', x: heron.x });
    } else if (heron.st === 'strike' && heron.t <= 0) {
      heron.st = 'walk';
      heron.t = H.walk;
    }

    this.updateFarmer(dt, hog, laneAt, night, events);

    // The beetle visits an empty goal home now and then.
    const B = CRITTERS.beetle;
    if (!this.beetle) {
      this.beetleClock -= dt;
      if (this.beetleClock <= 0) {
        const free = HOMES.map((_, k) => k).filter((k) => !goals[k]);
        if (free.length) this.beetle = { home: free[Math.floor(this.rand() * free.length)], t: B.stay };
        this.beetleClock = B.every;
      }
    } else {
      this.beetle.t -= dt;
      if (this.beetle.t <= 0 || goals[this.beetle.home]) this.beetle = null;
    }

    // The mouse waits, then boards a log or a boat.
    const m = this.mouse;
    if (!m.carried && !m.item) {
      m.wait -= dt;
      if (m.wait <= 0) {
        const lanes = CRITTERS.mouse.lanes;
        m.lane = lanes[Math.floor(this.rand() * lanes.length)];
        const items = laneAt.get(m.lane)!.items;
        m.item = items[Math.floor(this.rand() * items.length)];
        m.off = Math.min(m.item.len - 10, 12 + Math.floor(this.rand() * 3) * TILE);
      }
    }
    return events;
  }

  private updateFarmer(dt: number, hog: HogView, laneAt: ReadonlyMap<number, Lane>, night: number, events: CritterEvent[]) {
    const R = CRITTERS.farmer;
    if (!this.farmer) {
      this.farmerClock -= dt;
      if (this.farmerClock <= 0 && hog.alive && night >= R.fromNight) {
        this.spawnFarmer(hog);
        events.push({ kind: 'farmer', row: this.farmer!.home, fromLeft: this.farmer!.fromLeft });
      }
      return;
    }
    const f = this.farmer;
    f.t -= dt;
    if (f.st === 'warn') {
      if (f.t <= 0) { f.st = 'chase'; f.t = R.chase; f.u = 1; }
      else return;
    }
    if (f.st === 'chase' && f.t <= 0) f.st = 'leave';
    f.u += dt / (f.st === 'chase' ? R.step : R.leaveStep);
    if (f.u >= 1) this.farmerStep(hog);
    const p = farmerPos(f);
    if ((f.st === 'leave' || f.st === 'dive') && (p.x < -12 || p.x > WIDTH + 12)) {
      this.farmer = null;
      this.farmerClock = (R.delay[0] + this.rand() * (R.delay[1] - R.delay[0])) * this.pace;
      return;
    }
    const fr = rowOfY(p.y);
    if (f.st === 'chase' && isRoad(fr) && vehicleAt(laneAt.get(fr)!, p.x, 0, 2)) {
      // Honked off the road: he dives for the nearer verge and gives up.
      Object.assign(f, { st: 'dive', fx: p.x, tx: p.x, fr, tr: fr <= 9 ? ROW.midVerge : ROW.verge, u: 0.2 });
      events.push({ kind: 'honk', x: p.x, y: p.y });
    }
  }

  /** He comes in from the side away from the hoglet, on the land row nearest it. */
  spawnFarmer(hog: HogView) {
    const row = hog.r <= ROW.canalTop + 1 ? ROW.towpath : hog.r <= ROW.roadTop + 1 ? ROW.midVerge : ROW.verge;
    const fromLeft = hog.x > WIDTH / 2;
    const x = fromLeft ? -8 : WIDTH + 8;
    this.farmer = { st: 'warn', t: CRITTERS.farmer.warn, home: row, fromLeft, fx: x, fr: row, tx: x, tr: row, u: 1, face: fromLeft ? 1 : -1 };
  }

  private farmerStep(hog: HogView) {
    const f = this.farmer!;
    const x = f.tx, r = f.tr;
    Object.assign(f, { fx: x, fr: r, u: 0 });
    if (f.st === 'leave' || f.st === 'dive') {
      f.face = f.fromLeft ? -1 : 1;
      Object.assign(f, { tx: x + f.face * TILE, tr: r });
      return;
    }
    // He keeps to land: the towpath if he came in there, otherwise the verges and the road between them.
    const zone = (row: number) => (f.home === ROW.towpath ? row === ROW.towpath : row >= ROW.midVerge && row <= ROW.verge);
    const hr = hog.alive ? hog.r : r;
    if (zone(hr) && Math.abs(hog.x - x) <= 8 && hr !== r) {
      Object.assign(f, { tx: x, tr: r + Math.sign(hr - r) });
      return;
    }
    const dir = (Math.sign(hog.x - x) || f.face) as 1 | -1;
    f.face = dir;
    Object.assign(f, { tx: x + dir * Math.min(TILE, Math.max(4, Math.abs(hog.x - x))), tr: r });
  }

  /** What kills a hoglet at this spot right now, if anything. */
  hit(hog: HogView, night: number): Cause | null {
    const r = rowOfY(hog.y);
    if (r === ROW.midVerge && night >= CRITTERS.fox.fromNight && Math.abs(hog.x - this.fox.x) < CRITTERS.fox.hit) return 'CAUGHT!';
    if (r === ROW.towpath && Math.abs(hog.x - this.heron.x) < CRITTERS.heron.hit) return 'PECKED!';
    if (r === ROW.canalTop && this.heron.st === 'strike' && Math.abs(hog.x - this.heron.x) < CRITTERS.heron.stab) return 'PECKED!';
    const f = this.farmer;
    if (f && f.st === 'chase') {
      const p = farmerPos(f);
      if (Math.abs(p.x - hog.x) < CRITTERS.farmer.hitX && Math.abs(p.y - hog.y) < CRITTERS.farmer.hitY) return 'BAGGED!';
    }
    return null;
  }

  /** A hoglet landed on `item` at `x`: if the mouse is riding it close by, it climbs on. */
  board(lane: Lane, item: Item, x: number) {
    const m = this.mouse;
    if (m.carried || m.item !== item || lane.row !== m.lane) return false;
    if (Math.abs(itemX(lane, item) + m.off - x) >= CRITTERS.mouse.grab) return false;
    m.carried = true;
    return true;
  }

  /** The hoglet died: a mouse on its back runs off and boards again later. */
  dropMouse() {
    if (!this.mouse.carried) return;
    Object.assign(this.mouse, { carried: false, item: null, wait: CRITTERS.mouse.dropWait });
  }

  /** A hoglet got home into `home`: returns the bonuses it brought. */
  arrive(home: number) {
    const beetle = this.beetle?.home === home;
    const mouse = this.mouse.carried;
    if (beetle) { this.beetle = null; this.beetleClock = CRITTERS.beetle.every; }
    if (mouse) Object.assign(this.mouse, { carried: false, item: null, wait: CRITTERS.mouse.wait });
    return { beetle, mouse };
  }
}
