// Every tunable in one place. No Phaser imports, so pure modules and tests can load it straight from the dev server.

export const WIDTH = 416;
export const HEIGHT = 248;
/** Top bar height. */
export const HUD_H = 24;
export const TILE = 16;
export const ROWS = 14;

/**
 * The canvas renders at this multiple of the design size. The game scene zooms its camera by it, and the HUD scene
 * zooms by half as much, so native 16 px sprites show at half size there without being shrunk.
 */
export const RENDER_SCALE = 4;
export const HUD_SCALE = RENDER_SCALE / 2;

export const FONT = 'Silkscreen, monospace';

/**
 * Rows, top to bottom: 0 orchard hedge (nests), 1 towpath, 2-5 canal, 6 middle verge, 7-11 road, 12 verge,
 * 13 garden hedge (burrows). Out legs run from row 13 to row 0; back legs the other way.
 */
export const ROW = { nests: 0, towpath: 1, canalTop: 2, canalBottom: 5, midVerge: 6, roadTop: 7, roadBottom: 11, verge: 12, burrows: 13 } as const;
export const rowTop = (r: number) => HUD_H + r * TILE;
export const rowMid = (r: number) => HUD_H + r * TILE + TILE / 2;
/** Centre x of the five homes in each hedge. The outer two stay clear of the touch controls' corner fallback. */
export const HOMES = [72, 140, 208, 276, 344] as const;

export type Leg = 'out' | 'back';
export type LaneKind = 'lily' | 'boat' | 'ducks' | 'log' | 'lorry' | 'van' | 'motorbike' | 'car' | 'tractor';

/** One lane per row. Speeds are design pixels per second at night 1, out leg; dir +1 moves right. */
export const LANES: ReadonlyArray<{ row: number; kind: LaneKind; dir: 1 | -1; speed: number }> = [
  { row: 2, kind: 'lily', dir: -1, speed: 16 },
  { row: 3, kind: 'boat', dir: 1, speed: 13 },
  { row: 4, kind: 'ducks', dir: -1, speed: 22 },
  { row: 5, kind: 'log', dir: 1, speed: 26 },
  { row: 7, kind: 'lorry', dir: -1, speed: 28 },
  { row: 8, kind: 'van', dir: 1, speed: 40 },
  { row: 9, kind: 'motorbike', dir: -1, speed: 74 },
  { row: 10, kind: 'car', dir: 1, speed: 48 },
  { row: 11, kind: 'tractor', dir: -1, speed: 18 },
];
/** Item lengths in pixels, picked at random per item. A tractor is its sprite plus a 20 px hay trailer. */
export const LANE_LEN: Record<LaneKind, readonly number[]> = {
  car: [16], van: [16], lorry: [16], motorbike: [16], tractor: [36],
  log: [48, 64, 80], boat: [80, 96], ducks: [48], lily: [32, 48],
};
/** Gap after each item, [min, max] pixels, before the per-leg squeeze. */
export const LANE_GAP: Record<LaneKind, readonly [number, number]> = {
  car: [40, 96], van: [56, 110], lorry: [44, 90], motorbike: [130, 190], tractor: [80, 140],
  log: [36, 64], boat: [44, 72], ducks: [32, 56], lily: [24, 44],
};
/** Lanes loop over this span, so items leave and come back off-screen: x lives in [-64, WIDTH + 64). */
export const LANE_SPAN = WIDTH + 128;
export const LANE_MARGIN = 64;

/**
 * Difficulty per leg. `index` counts legs from 0 (night 1 out = 0, night 1 back = 1, night 2 out = 2...).
 * Speeds grow by `speed` per leg, gaps shrink by `gap` per leg down to `minGap`, and more duck families dive.
 * The farmer's waits shrink by `farmer` per leg, down to `minFarmer` of their night-2 length.
 */
export const RAMP = { speed: 0.08, gap: 0.03, minGap: 0.7, diveChance: 0.45, diveStep: 0.04, maxDive: 0.8, farmer: 0.06, minFarmer: 0.5 };
export const legIndex = (night: number, leg: Leg) => (night - 1) * 2 + (leg === 'back' ? 1 : 0);

/** Duck families that dive: up, then a bob-and-ripple warning, then under, on a loop. Seconds into `cycle`. */
export const DUCK = { cycle: 6.5, warn: 4.3, under: 5.2, up: 6.4 };

/**
 * The hoglet. `lives` counts tries left including the one crossing now. A hop takes `hopTime` seconds and lifts
 * `lift` pixels at its peak. Holding a direction repeats the hop after `repeatDelay`, then every `repeatEvery`.
 * `deadTime` is the pause after a death before the next try; `blink` how long a fresh hoglet blinks.
 * `homeSnap` is how far off a home's centre a hop into the hedge still lands in it. A forward hop within
 * `comboWindow` of landing raises the combo, up to `comboMax`. `legPause` is the breather after all five get home.
 */
export const HOGLET = { lives: 3, time: 30, hopTime: 0.11, lift: 4, repeatDelay: 0.22, repeatEvery: 0.15, deadTime: 1.2, blink: 1, homeSnap: 11, edge: 4, comboWindow: 0.5, comboMax: 4, legPause: 1.8 };

/** Extra lives at `first` points, then every `every` after that. */
export const EXTRA_LIFE = { first: 10000, every: 20000 };
/** localStorage key for the high score. */
export const HI_STORAGE = 'hedge-hogger-hi';

/** Points. `row` is per new row reached; `timeBonus` is per half second left when a hoglet gets home. */
export const POINTS = { row: 10, home: 50, timeBonus: 10, allHome: 1000, honk: 300, mouse: 200, beetle: 200 };

/**
 * Hazards and bonuses. Times in seconds, speeds in design pixels per second, `hit` is the half-width of a touch.
 * Fox: paces the middle verge from night `fromNight`. Heron: walks the towpath, then crouches (the pad below glints),
 * then stabs the lily lane. Farmer: from night `fromNight`, a torch and "!" warn for `warn`, then he chases one tile
 * every `step` for `chase` seconds over the verges and road (or along the towpath), then leaves. A vehicle in his
 * lane sends him diving back to the verge. Mouse: rides a log or boat until a hoglet lands near it. Beetle: sits in
 * an empty home for `stay` seconds, every `every` seconds; it blinks for the last `warn`.
 */
export const CRITTERS = {
  fox: { speed: 26, min: 24, max: WIDTH - 24, hit: 10, fromNight: 2 },
  heron: { speed: 9, min: 40, max: WIDTH - 40, firstWalk: 1.5, walk: 3.2, crouch: 0.75, strike: 0.35, hit: 9, stab: 10 },
  farmer: { fromNight: 2, firstDelay: 7, delay: [12, 18] as const, warn: 1.3, chase: 9, step: 0.42, leaveStep: 0.22, hitX: 10, hitY: 8 },
  mouse: { lanes: [5, 3] as const, grab: 14, firstWait: 1, wait: 6, dropWait: 2 },
  beetle: { first: 4, every: 10, stay: 6, warn: 1.5 },
};

/**
 * Feedback. Bursts are [sparks, speed px/s, life ms]; `shake` is in game pixels and `flash` a white alpha (both off
 * under prefers-reduced-motion). Banners hold for `banner` seconds. Fireflies per leg; `dawn` is how far the back
 * leg's light warms toward morning once all five are home, in steps as each one arrives.
 */
export const FX = {
  dust: [3, 30, 260] as const,
  bump: [22, 90, 520] as const,
  splash: [16, 60, 600] as const,
  home: [16, 80, 600] as const,
  honk: [12, 70, 450] as const,
  shake: { death: 2.5, honk: 1.2 },
  flash: 0.22,
  banner: 1.6,
  fireflies: { out: 5, back: 14 },
  dawn: { tint: 0xff9a5c, alpha: 0.12, reach: 0.75 },
  timerTick: 5,
};

/** Narrowboat paintwork: [hull, trim]. */
export const BOAT_PAINT = [[0x2f6b3a, 0xb8433d], [0x7a2a2a, 0xe9c46a], [0x24476b, 0xe07a3a], [0x4a2f5e, 0x6cc3c8]] as const;

export interface Palette {
  grass: string; grass2: string; tuft: string; flower: string;
  hedge: string; hedge2: string; berry: string; hole: string;
  path: string; path2: string;
  road: string; road2: string; dash: string; kerb: string;
  water: number; water2: number; coping: string;
  /** Colour and alpha laid over the whole field. */
  tint: number; tintAlpha: number;
  /** Headlight strength, 0..1. */
  lights: number;
}
/** Out legs run at dusk; back legs at night. */
export const PALETTES: Record<Leg, Palette> = {
  out: {
    grass: '#4e6a33', grass2: '#587538', tuft: '#7d9c47', flower: '#e9d27a',
    hedge: '#24391f', hedge2: '#335229', berry: '#b8433d', hole: '#140f0b',
    path: '#76634a', path2: '#857157',
    road: '#38383e', road2: '#414148', dash: '#d9d2b8', kerb: '#8a8778',
    water: 0x2c6874, water2: 0x357c89, coping: '#968b76',
    tint: 0xff8c46, tintAlpha: 0.1, lights: 0.28,
  },
  back: {
    grass: '#2a3c29', grass2: '#304530', tuft: '#466a3e', flower: '#b9b28a',
    hedge: '#16251a', hedge2: '#203722', berry: '#7a3434', hole: '#0a0806',
    path: '#4d4538', path2: '#575042',
    road: '#25262c', road2: '#2c2d34', dash: '#a9a690', kerb: '#5e5d55',
    water: 0x1b4553, water2: 0x225463, coping: '#6a665a',
    tint: 0x141e50, tintAlpha: 0.22, lights: 0.5,
  },
};

export const COLORS = {
  void: 0x070906,
  panel: 0x192018,
  line: 0x2f3b2c,
  ink: 0xf1ead6,
  amber: 0xffb648,
  canal: 0x6cc3c8,
  danger: 0xe0453a,
};

export const TEXT = {
  ink: '#f1ead6',
  dim: '#a8af99',
  amber: '#ffb648',
  canal: '#6cc3c8',
  danger: '#e0453a',
  off: '#5c6a57',
};

/** Sprite slots exported by tools/sprites.py to assets/sprites/<slot>.png. */
export const SPRITES = ['player', 'mouse', 'car', 'van', 'tractor', 'motorbike', 'lorry', 'duck', 'lily', 'heron', 'fox', 'farmer', 'beetle'] as const;
export type SpriteKey = (typeof SPRITES)[number];
/** Picks whose art faces left (from tools/sprite_slots.json); they're flipped so every sprite faces right at rest. */
export const MIRROR: ReadonlySet<SpriteKey> = new Set(['player', 'mouse', 'car', 'van', 'tractor', 'motorbike', 'duck', 'heron', 'fox', 'beetle']);

/** Registry key the crossing scene writes each frame for the HUD. */
export const HUD_STATE = 'hud';
