// Fairness search: can a hoglet get from each start home to a goal home inside the timer, on every seeded layout?
// A time-stepped search over the real lane and critter rules (three steps per hop). Pure: loaded from the dev server
// by tools/fairness.mjs. The fox and the farmer are left out: both can be avoided by waiting.
import { CRITTERS, HOGLET, HOMES, ROW, TILE, WIDTH, type Leg } from '../src/config';
import { Critters, type Heron } from '../src/critters';
import { isRoad, isWater, layout, platformAt, rng, vehicleAt, type Lane } from '../src/lanes';

const HOP = 3;
const DT = HOGLET.hopTime / HOP;
const MOVES: Array<[number, number]> = [[0, -1], [0, 1], [-1, 0], [1, 0]];

export interface Result {
  night: number;
  leg: Leg;
  start: number;
  /** Seconds into the leg when the hoglet sets off. */
  offset: number;
  /** Fastest seconds to each goal home, or null if it can't be reached in time. */
  toHome: Array<number | null>;
  best: number | null;
}

interface State { r: number; x: number }

/** The heron's position and state through the leg, from the same rules the scene runs. */
function heronTimeline(lanes: Lane[], seconds: number): Array<Pick<Heron, 'x' | 'st'>> {
  const c = new Critters(rng(1));
  const laneAt = new Map(lanes.map((l) => [l.row, l]));
  const away = { x: -99, y: -99, r: -1, alive: false };
  const out: Array<Pick<Heron, 'x' | 'st'>> = [];
  for (let k = 0; k * DT <= seconds + 1; k++) {
    out.push({ x: c.heron.x, st: c.heron.st });
    c.update(DT, away, laneAt, [0, 0, 0, 0, 0], 1);
  }
  return out;
}

export function search(night: number, leg: Leg, start: number, offset: number, limit: number = HOGLET.time): Result {
  const lanes = layout(night, leg);
  const laneAt = new Map(lanes.map((l) => [l.row, l]));
  const startRow = leg === 'out' ? ROW.burrows : ROW.nests;
  const goalRow = leg === 'out' ? ROW.nests : ROW.burrows;
  const fwd = leg === 'out' ? -1 : 1;
  const heron = heronTimeline(lanes, offset + limit);
  const heronAt = (t: number) => heron[Math.min(heron.length - 1, Math.round(t / DT))];
  const H = CRITTERS.heron;

  // Hazards for a hoglet standing at (r, x) at time t. Lanes and ducks run from the leg's start at t = 0.
  const safe = (r: number, x: number, t: number) => {
    if (isRoad(r) && vehicleAt(laneAt.get(r)!, x, t)) return false;
    if (isWater(r) && !platformAt(laneAt.get(r)!, x, 0, t)) return false;
    const h = heronAt(t);
    if (r === ROW.towpath && Math.abs(x - h.x) < H.hit) return false;
    if (r === ROW.canalTop && h.st === 'strike' && Math.abs(x - h.x) < H.stab) return false;
    return true;
  };

  const toHome: Array<number | null> = [null, null, null, null, null];
  const pending = new Map<number, State[]>();
  let frontier = new Map<string, State>([[`${startRow},${HOMES[start]}`, { r: startRow, x: HOMES[start] }]]);
  const steps = Math.ceil(limit / DT);

  for (let k = 0; k < steps && frontier.size + pending.size > 0; k++) {
    const t = offset + k * DT;
    for (const s of pending.get(k) ?? []) frontier.set(`${s.r},${Math.round(s.x)}`, s);
    pending.delete(k);
    const next = new Map<string, State>();
    for (const s of frontier.values()) {
      // Wait a step: riding a platform carries the hoglet, and the screen edge sweeps it away.
      let wx = s.x;
      if (isWater(s.r)) {
        const lane = laneAt.get(s.r)!;
        wx += lane.dir * lane.speed * DT;
      }
      if (s.r === startRow || (wx >= HOGLET.edge && wx <= WIDTH - HOGLET.edge && safe(s.r, wx, t + DT))) next.set(`${s.r},${Math.round(wx)}`, { r: s.r, x: wx });

      // Hop: the same rules as CrossingScene.tryHop, with the road checked through the second half of the hop.
      for (const [dx, dr] of MOVES) {
        if (s.r === startRow && dr !== fwd) continue;
        const tr = s.r + dr;
        if (tr < 0 || tr > ROW.burrows || tr === startRow) continue;
        let tx = s.x + dx * TILE;
        let home = -1;
        if (tr === goalRow) {
          home = HOMES.findIndex((hx) => Math.abs(tx - hx) < HOGLET.homeSnap);
          if (home < 0) continue;
          tx = HOMES[home];
        }
        if (!isWater(tr) && (tx < 8 || tx > WIDTH - 8)) continue;
        let ok = true;
        for (let i = 2; i <= HOP && ok; i++) if (isRoad(tr) && vehicleAt(laneAt.get(tr)!, s.x + ((tx - s.x) * i) / HOP, t + i * DT)) ok = false;
        if (!ok) continue;
        const tl = t + HOP * DT;
        if (home >= 0) {
          const secs = (k + HOP) * DT;
          if (toHome[home] === null || secs < toHome[home]!) toHome[home] = secs;
          continue;
        }
        if (!safe(tr, tx, tl)) continue;
        const list = pending.get(k + HOP) ?? [];
        list.push({ r: tr, x: tx });
        pending.set(k + HOP, list);
      }
    }
    frontier = next;
    if (toHome.every((v) => v !== null)) break;
  }
  const found = toHome.filter((v): v is number => v !== null);
  return { night, leg, start, offset, toHome, best: found.length ? Math.min(...found) : null };
}
