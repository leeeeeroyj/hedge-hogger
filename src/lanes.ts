// Seeded lane layouts and the lane rules: where things are, what you can stand on, what hits you.
// Pure (no Phaser), so tests and the fairness check can import it directly.
import { DUCK, LANE_GAP, LANE_LEN, LANE_MARGIN, LANE_SPAN, LANES, RAMP, ROW, WIDTH, legIndex, type LaneKind, type Leg } from './config';

export interface Item {
  /** Left edge in design pixels. `itemX` gives it wrapped into [WIDTH - LANE_SPAN, WIDTH). */
  x: number;
  len: number;
  /** Duck families: whether this one dives, and its phase in the dive cycle. */
  dives?: boolean;
  phase?: number;
  /** Narrowboats: index into BOAT_PAINT. */
  paint?: number;
}

export interface Lane {
  row: number;
  kind: LaneKind;
  dir: 1 | -1;
  /** Speed for this leg, design pixels per second. */
  speed: number;
  items: Item[];
}

export const isWater = (row: number) => row >= ROW.canalTop && row <= ROW.canalBottom;
export const isRoad = (row: number) => row >= ROW.roadTop && row <= ROW.roadBottom;

/** mulberry32: small, fast and seedable, so a retry repeats the same layout. */
export function rng(seed: number) {
  let a = seed | 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const seedFor = (night: number, leg: Leg) => night * 101 + (leg === 'out' ? 0 : 1);

/** Lays out every lane for one leg. The same night and leg always give the same layout. */
export function layout(night: number, leg: Leg): Lane[] {
  const random = rng(seedFor(night, leg));
  const index = legIndex(night, leg);
  const speedScale = 1 + RAMP.speed * index;
  const gapScale = Math.max(RAMP.minGap, 1 - RAMP.gap * index);
  const diveChance = Math.min(RAMP.maxDive, RAMP.diveChance + RAMP.diveStep * index);
  return LANES.map(({ row, kind, dir, speed }) => {
    const items: Item[] = [];
    let x = -LANE_MARGIN + Math.floor(random() * 40);
    for (;;) {
      const lens = LANE_LEN[kind];
      const len = lens[Math.floor(random() * lens.length)];
      if (x + len > WIDTH + LANE_MARGIN) break;
      const item: Item = { x, len };
      if (kind === 'ducks') { item.dives = random() < diveChance; item.phase = random() * DUCK.cycle; }
      if (kind === 'boat') item.paint = Math.floor(random() * 4);
      items.push(item);
      const [g0, g1] = LANE_GAP[kind];
      x += len + Math.round((g0 + random() * (g1 - g0)) * gapScale);
    }
    if (kind === 'ducks' && items.length && !items.some((i) => i.dives)) items[0].dives = true;
    return { row, kind, dir, speed: speed * speedScale * (0.9 + random() * 0.2), items };
  });
}

/** Where an item's left edge will be after `dt` seconds, wrapped into the lane's span. */
export function itemX(lane: Lane, item: Item, dt = 0) {
  // Kept in [WIDTH - LANE_SPAN, WIDTH): an item only jumps a span while it's wholly off screen, either way it moves,
  // as long as it's at most LANE_SPAN - WIDTH (128 px) long.
  const x = item.x + lane.dir * lane.speed * dt - (WIDTH - LANE_SPAN);
  return (((x % LANE_SPAN) + LANE_SPAN) % LANE_SPAN) + (WIDTH - LANE_SPAN);
}

/** Moves every item along its lane. */
export function advance(lanes: Lane[], dt: number) {
  for (const lane of lanes) for (const item of lane.items) item.x = itemX(lane, item, dt);
}

export type DuckState = 'up' | 'warn' | 'under';
/** A duck family's state at time `t` (seconds). Families that don't dive are always up. */
export function duckState(item: Item, t: number): DuckState {
  if (!item.dives) return 'up';
  const p = (((t + (item.phase ?? 0)) % DUCK.cycle) + DUCK.cycle) % DUCK.cycle;
  return p < DUCK.warn ? 'up' : p < DUCK.under ? 'warn' : p < DUCK.up ? 'under' : 'up';
}

/** The platform under x in a water lane at time `t` + `dt`, or null if that spot is open water (or a dived duck). */
export function platformAt(lane: Lane, x: number, t: number, dt = 0): Item | null {
  for (const item of lane.items) {
    const ix = itemX(lane, item, dt);
    if (x >= ix + 1 && x <= ix + item.len - 1) {
      if (lane.kind === 'ducks' && duckState(item, t + dt) === 'under') return null;
      return item;
    }
  }
  return null;
}

/** The vehicle covering x in a road lane after `dt` seconds, padded by `pad` pixels each side, or null. */
export function vehicleAt(lane: Lane, x: number, dt = 0, pad = 3): Item | null {
  for (const item of lane.items) {
    const ix = itemX(lane, item, dt);
    if (x > ix - pad && x < ix + item.len + pad) return item;
  }
  return null;
}
