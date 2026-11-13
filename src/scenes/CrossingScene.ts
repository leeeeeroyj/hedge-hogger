import Phaser from 'phaser';
import { COLORS, CRITTERS, EXTRA_LIFE, FONT, FX, HEIGHT, HI_STORAGE, HOGLET, HOMES, HUD_H, HUD_STATE, PALETTES, POINTS, RAMP, RENDER_SCALE, ROW, TEXT, TILE, WIDTH, legIndex, rowMid, rowTop, type Leg } from '../config';
import { Effects } from '../effects';
import { Water, bakeTextures, fieldKey } from '../backdrop';
import { Controls, type HopDir } from '../controls';
import { DEPTH, LaneView, face } from '../laneView';
import { Critters, farmerPos, type Cause, type HogView } from '../critters';
import { advance, isRoad, isWater, itemX, layout, platformAt, rng, seedFor, vehicleAt, type Lane } from '../lanes';
import { playSound, restoreMute, toggleMute, type SoundName } from '../sfx';
import { touchControls } from '../touch';
import { fitCamera } from '../view';
import type { HudState } from './HudScene';

/** The hoglet crossing now. Positions are design pixels; `r` is the row. While hopping it moves from (fx, fr) to (tx, tr). */
interface Hoglet {
  x: number;
  r: number;
  hopping: boolean;
  u: number;
  fx: number;
  fr: number;
  tx: number;
  tr: number;
  /** +1 faces right, -1 left. */
  face: 1 | -1;
  /** Seconds left of the pause after a death; 0 while alive. */
  dead: number;
  cause: Cause | null;
  blink: number;
  time: number;
  /** Furthest rows reached toward the goal, for row points. */
  best: number;
  /** Seconds left of the little shake after a blocked hop. */
  bump: number;
  queued: HopDir | null;
  /** Hop combo (0 = none) and when the hoglet last landed, on the scene's `age` clock. */
  combo: number;
  landed: number;
}

const DIRS: Record<Exclude<HopDir, 'fwd'>, [number, number]> = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] };

/** The game: one screen of lanes between two hedges. */
export class CrossingScene extends Phaser.Scene {
  private controls!: Controls;
  private laneView!: LaneView;
  private water!: Water;
  private field!: Phaser.GameObjects.Image;
  private tint!: Phaser.GameObjects.Rectangle;
  private homes!: Phaser.GameObjects.Graphics;
  private ripples!: Phaser.GameObjects.Graphics;
  private homeHoglets: Phaser.GameObjects.Image[] = [];
  private sprite!: Phaser.GameObjects.Image;
  private critters = new Critters(rng(1));
  private critterSprites!: Record<'fox' | 'heron' | 'farmer' | 'mouse' | 'beetle', Phaser.GameObjects.Image>;
  private critterMarks!: Phaser.GameObjects.Graphics;
  private torch!: Phaser.GameObjects.Image;
  private fx!: Effects;
  private bannerBig!: Phaser.GameObjects.Text;
  private bannerSmall!: Phaser.GameObjects.Text;
  private bannerTime = 0;
  private fireflies: Array<{ x: number; y: number; phase: number; drift: number }> = [];
  private glow!: Phaser.GameObjects.Graphics;
  /** 0 at nightfall, rising toward morning as the back leg's hoglets get home. */
  private dawn = 0;
  private lastTick = 99;
  /** Dev-only: the last sounds asked for, newest last. */
  private played: SoundName[] = [];
  private lanes: Lane[] = [];
  private laneAt = new Map<number, Lane>();
  private night = 1;
  private leg: Leg = 'out';
  /** 1 where a hoglet is waiting or has arrived. Out legs start with the burrows full; back legs with the nests full. */
  private burrows: number[] = [];
  private nests: number[] = [];
  /** Which start home the hoglet crossing now came from. */
  private current = 0;
  private hog!: Hoglet;
  private rings: Array<{ x: number; y: number; t: number }> = [];
  private clock = 0;
  private score = 0;
  private hi = 0;
  private lives: number = HOGLET.lives;
  private nextLife = EXTRA_LIFE.first;
  /** Seconds left of the breather between legs; 0 while a hoglet is crossing. */
  private between = 0;
  /** Out of lives: the RETRY / TITLE panel is up. */
  private over = false;
  private newHi = false;
  /** Seconds since the scene started, frozen or not: hop combos are timed on it. */
  private age = 0;
  private leaving = false;
  /** Dev-only: stops the lanes and the timer so tests can set up exact positions. */
  private frozen = false;

  constructor() {
    super('crossing');
  }

  create() {
    this.leaving = false;
    this.frozen = false;
    this.clock = 0;
    this.age = 0;
    this.score = 0;
    this.lives = HOGLET.lives;
    this.nextLife = EXTRA_LIFE.first;
    this.between = 0;
    this.over = false;
    this.newHi = false;
    this.hi = loadHi();
    this.rings = [];
    this.controls = new Controls(this);
    fitCamera(this, RENDER_SCALE);
    restoreMute(this);
    bakeTextures(this);
    this.cameras.main.fadeIn(250);
    this.water = new Water(this, DEPTH.water);
    this.field = this.add.image(0, 0, fieldKey('out')).setOrigin(0).setDepth(DEPTH.field);
    this.homes = this.add.graphics().setDepth(DEPTH.homes).setBlendMode(Phaser.BlendModes.ADD);
    this.ripples = this.add.graphics().setDepth(DEPTH.hoglet);
    this.tint = this.add.rectangle(0, HUD_H, WIDTH, HEIGHT - HUD_H, 0, 0).setOrigin(0).setDepth(DEPTH.tint);
    this.laneView = new LaneView(this);
    this.sprite = this.add.image(0, 0, 'player').setDepth(DEPTH.hoglet);
    const critter = (key: string, depth: number = DEPTH.critters) => this.add.image(-50, -50, key).setDepth(depth).setVisible(false);
    this.critterSprites = { fox: critter('fox'), heron: critter('heron'), farmer: critter('farmer'), mouse: critter('mouse', DEPTH.hoglet), beetle: critter('beetle', DEPTH.homes) };
    this.critterMarks = this.add.graphics().setDepth(DEPTH.critters);
    this.fx = new Effects(this, DEPTH.fx);
    this.glow = this.add.graphics().setDepth(DEPTH.lights).setBlendMode(Phaser.BlendModes.ADD);
    const bannerText = (size: number) => this.add.text(WIDTH / 2, 0, '', { fontFamily: FONT, fontSize: `${size}px`, color: TEXT.ink })
      .setOrigin(0.5).setDepth(DEPTH.banner).setStroke('#070906', size / 4).setVisible(false);
    this.bannerBig = bannerText(16);
    this.bannerSmall = bannerText(8);
    this.played = [];
    this.dawn = 0;
    this.torch = this.add.image(0, 0, 'torch').setOrigin(0, 0.5).setDepth(DEPTH.lights).setBlendMode(Phaser.BlendModes.ADD).setVisible(false);
    this.setLeg('out', 1);
    if (!this.scene.isActive('hud')) this.scene.launch('hud');
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => touchControls.show(false));
  }

  private get startRow() { return this.leg === 'out' ? ROW.burrows : ROW.nests; }
  private get goalRow() { return this.leg === 'out' ? ROW.nests : ROW.burrows; }
  /** Row step toward the goal: up the screen on out legs, down on back legs. */
  private get fwd() { return this.leg === 'out' ? -1 : 1; }
  private get starts() { return this.leg === 'out' ? this.burrows : this.nests; }
  private get goals() { return this.leg === 'out' ? this.nests : this.burrows; }

  /** Starts a leg: lays out its lanes from the seed and fills the homes it starts from. */
  setLeg(leg: Leg, night = this.night) {
    this.leg = leg;
    this.night = night;
    this.lanes = layout(night, leg);
    this.laneAt = new Map(this.lanes.map((l) => [l.row, l]));
    this.laneView.build(this.lanes, leg);
    this.field.setTexture(fieldKey(leg));
    const P = PALETTES[leg];
    this.tint.setFillStyle(P.tint, P.tintAlpha);
    this.burrows = leg === 'out' ? [1, 1, 1, 1, 1] : [0, 0, 0, 0, 0];
    this.nests = leg === 'out' ? [0, 0, 0, 0, 0] : [1, 1, 1, 1, 1];
    // Critters get their own seeded stream per leg, so a retry brings the same surprises. The farmer comes sooner
    // on each leg after his first night.
    const pace = Math.max(RAMP.minFarmer, 1 - RAMP.farmer * Math.max(0, legIndex(night, leg) - legIndex(CRITTERS.farmer.fromNight, 'out')));
    this.critters.reset(rng(seedFor(night, leg) * 7919 + 17), pace);
    this.between = 0;
    this.dawn = 0;
    // Fireflies over the hedges, verges and towpath: a few at dusk, more after dark.
    const r = rng(seedFor(night, leg) + 4242), rows = [ROW.nests, ROW.towpath, ROW.midVerge, ROW.verge, ROW.burrows];
    this.fireflies = Array.from({ length: FX.fireflies[leg] }, () => ({
      x: r() * WIDTH, y: rowTop(rows[Math.floor(r() * rows.length)]) + 2 + r() * 12, phase: r() * Math.PI * 2, drift: 2 + r() * 4,
    }));
    this.banner(`NIGHT ${night}`, leg === 'out' ? 'OUT TO THE ORCHARD' : 'HOME BEFORE DAWN', TEXT.canal);
    this.nextHoglet();
  }

  /** Sends out the next waiting hoglet from the leftmost full start home. */
  private nextHoglet() {
    this.current = Math.max(0, this.starts.indexOf(1));
    this.hog = {
      x: HOMES[this.current], r: this.startRow, hopping: false, u: 0, fx: 0, fr: 0, tx: 0, tr: 0,
      face: this.leg === 'out' ? 1 : -1, dead: 0, cause: null, blink: HOGLET.blink, time: HOGLET.time, best: 0, bump: 0, queued: null,
      combo: 0, landed: -9,
    };
    this.drawHomes();
  }

  private drawHomes() {
    this.homeHoglets.forEach((i) => i.destroy());
    this.homeHoglets = [];
    HOMES.forEach((x, k) => {
      for (const [row, filled] of [[ROW.burrows, this.burrows[k]], [ROW.nests, this.nests[k]]] as const) {
        if (!filled || (row === this.startRow && k === this.current)) continue;
        this.homeHoglets.push(face(this.add.image(x, rowMid(row) + (row === ROW.nests ? 1 : 0), 'player'), 'player', k % 2 === 0).setDepth(DEPTH.homes));
      }
    });
    // A warm glow marks the empty homes the hoglets are heading for.
    this.homes.clear().fillStyle(COLORS.amber, 0.1);
    HOMES.forEach((x, k) => { if (!this.goals[k]) this.homes.fillRect(x - 10, rowTop(this.goalRow) + 2, 20, 13); });
  }

  update(_time: number, delta: number) {
    const dt = Math.min(0.05, delta / 1000);
    // The touch controls show during play and hide behind the game-over panel.
    touchControls.show(!this.over && !this.leaving);
    const input = this.controls.read();
    if (input.mute) toggleMute(this);
    if (input.back) { this.leave(); return; }
    this.age += dt;
    if (this.over && input.confirm) { this.retry(); return; }
    if (!this.frozen) {
      this.clock += dt;
      advance(this.lanes, dt);
      for (const ev of this.critters.update(dt, this.hogView(), this.laneAt, this.goals, this.night)) {
        if (ev.kind === 'honk') {
          this.addScore(POINTS.honk);
          this.fx.burst(ev.x, ev.y, [COLORS.amber, COLORS.ink], FX.honk);
          this.fx.shake(FX.shake.honk);
          this.pop(ev.x, ev.y - 10, `HONK! +${POINTS.honk}`, TEXT.amber);
          this.sfx('honk');
        } else if (ev.kind === 'stab') {
          this.rings.push({ x: ev.x, y: rowMid(ROW.canalTop), t: 0 });
          this.sfx('stab');
        } else if (ev.kind === 'farmer') this.sfx('warn');
      }
    }
    this.laneView.update(this.clock);
    this.water.draw(this.leg, this.clock, this.lanes);

    let hop: [number, number] | null = null;
    if (input.hop) hop = input.hop === 'fwd' ? [0, this.fwd] : DIRS[input.hop];
    else if (input.click && input.click.y >= HUD_H) {
      // Mouse: hop toward the pointer along its stronger axis.
      const p = this.hogPos(), dx = input.click.x - p.x, dy = input.click.y - p.y;
      if (Math.max(Math.abs(dx), Math.abs(dy)) >= 6) hop = Math.abs(dx) > Math.abs(dy) ? [Math.sign(dx), 0] : [0, Math.sign(dy)];
    }
    if (this.between > 0) {
      // The breather after all five get home, then the next leg: back, or out on the next night.
      this.between -= dt;
      if (this.between <= 0) {
        if (this.leg === 'out') this.setLeg('back');
        else this.setLeg('out', this.night + 1);
      }
    } else if (!this.over) this.updateHoglet(dt, hop);
    this.drawHoglet();
    this.drawCritters();
    this.fx.update(dt);
    this.updateBanner(dt);
    this.drawGlow();
    // The last seconds tick.
    const secs = Math.ceil(this.hog.time);
    if (this.hog.dead <= 0 && !this.over && this.between <= 0 && secs <= FX.timerTick && secs < this.lastTick && secs > 0) this.sfx('tick');
    this.lastTick = secs;

    if (this.score > this.hi) { this.hi = this.score; this.newHi = true; }
    const combo = this.hog.combo;
    const hud: HudState = {
      score: this.score, hi: this.hi, lives: this.lives, night: this.night, leg: this.leg, time: this.hog.time, combo, device: input.device,
      over: this.over ? { newHi: this.newHi } : null,
    };
    this.registry.set(HUD_STATE, hud);
  }

  private updateHoglet(dt: number, hop: [number, number] | null) {
    const h = this.hog;
    h.blink = Math.max(0, h.blink - dt);
    h.bump = Math.max(0, h.bump - dt);
    for (const ring of this.rings) ring.t += dt;
    this.rings = this.rings.filter((ring) => ring.t < 0.6);
    if (h.dead > 0) {
      h.dead -= dt;
      if (h.dead <= 0) this.respawn();
      return;
    }
    // Stopping lets the combo lapse.
    if (!h.hopping && h.combo && this.age - h.landed > HOGLET.comboWindow) h.combo = 0;
    if (!this.frozen) {
      h.time -= dt;
      if (h.time <= 0) { h.time = 0; this.die('TOO SLOW!'); return; }
    }
    // A press during a hop is kept and used on landing, so quick taps never get lost.
    if (hop && h.hopping) h.queued = hop[1] === 0 ? (hop[0] > 0 ? 'right' : 'left') : hop[1] < 0 ? 'up' : 'down';
    else if (!h.hopping) {
      const next = hop ?? (h.queued ? DIRS[h.queued as Exclude<HopDir, 'fwd'>] : null);
      h.queued = null;
      if (next) this.tryHop(next[0], next[1]);
    }

    if (h.hopping) {
      h.u += dt / HOGLET.hopTime;
      if (h.u >= 1) this.land();
      else if (h.u > 0.5 && isRoad(h.tr) && vehicleAt(this.laneAt.get(h.tr)!, this.hogPos().x)) this.die('BUMPED!');
    } else if (isWater(h.r)) {
      const lane = this.laneAt.get(h.r)!;
      if (!platformAt(lane, h.x, this.clock)) this.die('SPLASH!');
      else {
        if (!this.frozen) h.x += lane.dir * lane.speed * dt;
        if (h.x < HOGLET.edge || h.x > WIDTH - HOGLET.edge) this.die('SWEPT AWAY!');
      }
    } else if (isRoad(h.r) && vehicleAt(this.laneAt.get(h.r)!, h.x)) this.die('BUMPED!');
    if (h.dead <= 0) {
      const cause = this.critters.hit(this.hogView(), this.night);
      if (cause) this.die(cause);
    }
  }

  private hogView(): HogView {
    const h = this.hog, p = this.hogPos();
    return { x: p.x, y: p.y, r: h.hopping ? h.tr : h.r, alive: h.dead <= 0 };
  }

  /** Starts a hop if the rules allow it. Blocked hops into a hedge or a full home give a little shake instead. */
  private tryHop(dx: number, dr: number) {
    const h = this.hog;
    if (dx) h.face = dx > 0 ? 1 : -1;
    let tx = h.x + dx * TILE;
    const tr = h.r + dr;
    if (tr < 0 || tr >= ROW.burrows + 1) return;
    if (h.r === this.startRow && dr !== this.fwd) return;
    if (tr === this.startRow) { this.bumped(); return; }
    if (tr === this.goalRow) {
      const j = HOMES.findIndex((hx, k) => !this.goals[k] && Math.abs(tx - hx) < HOGLET.homeSnap);
      if (j < 0) { this.bumped(); return; }
      tx = HOMES[j];
    }
    if (!isWater(tr) && (tx < 8 || tx > WIDTH - 8)) return;
    // Forward hops build the combo while they come quickly; a hop back ends it; sideways hops leave it be.
    if (dr === this.fwd) h.combo = h.combo && this.age - h.landed <= HOGLET.comboWindow ? Math.min(HOGLET.comboMax, h.combo + 1) : 1;
    else if (dr === -this.fwd) h.combo = 0;
    Object.assign(h, { hopping: true, u: 0, fx: h.x, fr: h.r, tx, tr });
    if (h.combo >= 2 && dr === this.fwd) this.sfx('combo', { detune: (h.combo - 2) * 200 });
    else this.sfx('hop');
  }

  private bumped() {
    this.hog.bump = 0.15;
    this.sfx('bump');
  }

  private land() {
    const h = this.hog;
    h.hopping = false;
    h.x = h.tx;
    h.r = h.tr;
    h.landed = this.age;
    const progress = (h.r - this.startRow) * this.fwd;
    if (progress > h.best) { h.best = progress; this.addScore(POINTS.row * Math.max(1, h.combo)); }
    if (h.r === this.goalRow) { this.reachHome(HOMES.indexOf(h.x as (typeof HOMES)[number])); return; }
    if (!isWater(h.r)) this.fx.burst(h.x, rowMid(h.r) + 6, [0x9b8a6a, 0x76634a], FX.dust);
    if (isWater(h.r)) {
      const lane = this.laneAt.get(h.r)!, item = platformAt(lane, h.x, this.clock);
      if (!item) this.die('SPLASH!');
      else {
        this.fx.ring(h.x, rowMid(h.r) + 5, COLORS.canal, 6, 300, true);
        if (this.critters.board(lane, item, h.x)) { this.pop(h.x, rowMid(h.r) - 12, 'HOP ON!', TEXT.ink); this.sfx('squeak'); }
      }
    } else if (isRoad(h.r) && vehicleAt(this.laneAt.get(h.r)!, h.x)) this.die('BUMPED!');
  }

  private reachHome(j: number) {
    this.goals[j] = 1;
    this.starts[this.current] = 0;
    const bonus = this.critters.arrive(j);
    const pts = POINTS.home * Math.max(1, this.hog.combo) + POINTS.timeBonus * Math.floor(this.hog.time / 0.5);
    this.addScore(pts + (bonus.beetle ? POINTS.beetle : 0) + (bonus.mouse ? POINTS.mouse : 0));
    const hx = HOMES[j], hy = rowMid(this.goalRow), away = -this.fwd * 14;
    this.fx.burst(hx, hy, [COLORS.amber, 0xfff3c4, 0xe9d27a], FX.home);
    this.fx.ring(hx, hy, COLORS.amber, 14, 500);
    this.pop(hx, hy + away, `+${pts}`, TEXT.amber);
    const extras = [bonus.beetle && `BEETLE +${POINTS.beetle}`, bonus.mouse && `MOUSE +${POINTS.mouse}`].filter(Boolean) as string[];
    extras.forEach((e, k) => this.pop(hx, hy + away * (2 + k * 0.7), e, TEXT.ink));
    if (this.goals.every((v) => v)) {
      // All five across: a breather, then the next leg. A night is out and back.
      this.addScore(POINTS.allHome);
      this.banner('ALL HOME!', `+${POINTS.allHome}`, TEXT.amber);
      this.sfx('allHome');
      this.between = HOGLET.legPause;
      this.current = -1;
      this.hog.combo = 0;
      this.drawHomes();
      saveHi(this.hi);
      return;
    }
    this.sfx(extras.length ? 'bonus' : 'home');
    this.nextHoglet();
  }

  /** Adds points, with an extra life at each threshold. */
  private addScore(n: number) {
    this.score += n;
    while (this.score >= this.nextLife) {
      this.lives += 1;
      this.nextLife += EXTRA_LIFE.every;
      this.pop(WIDTH / 2, rowMid(ROW.midVerge) + 14, 'EXTRA LIFE!', TEXT.amber);
      this.sfx('extraLife');
    }
  }

  private die(cause: Cause) {
    const h = this.hog;
    if (h.dead > 0) return;
    const p = this.hogPos();
    h.x = p.x;
    h.r = h.hopping ? h.tr : h.r;
    h.hopping = false;
    h.dead = HOGLET.deadTime;
    h.cause = cause;
    this.lives -= 1;
    this.critters.dropMouse();
    const y = rowMid(h.r), wet = cause === 'SPLASH!' || cause === 'SWEPT AWAY!';
    if (wet) {
      this.rings.push({ x: h.x, y, t: 0 });
      this.fx.burst(h.x, y, [COLORS.canal, 0x357c89], FX.splash);
    } else {
      this.fx.burst(h.x, y, [0x8a5a3a, 0xc89a6a, 0x5a3a24], FX.bump);
      this.fx.shake(FX.shake.death);
      this.fx.flash(FX.flash);
    }
    const voice: Record<Cause, SoundName> = { 'BUMPED!': 'squash', 'SPLASH!': 'splash', 'SWEPT AWAY!': 'splash', 'TOO SLOW!': 'bump', 'CAUGHT!': 'growl', 'PECKED!': 'peck', 'BAGGED!': 'shout' };
    this.sfx(voice[cause]);
    this.banner(cause, this.lives === 0 ? 'OUT OF LIVES' : this.lives === 1 ? 'LAST LIFE' : `${this.lives} LIVES LEFT`, TEXT.danger);
  }

  private respawn() {
    if (this.lives <= 0) {
      // Out of lives: game over. RETRY replays this leg (same seed) from zero; TITLE goes back.
      this.over = true;
      this.bannerTime = 0;
      saveHi(this.hi);
      this.sfx('gameOver');
      return;
    }
    this.nextHoglet();
  }

  private hogPos() {
    const h = this.hog;
    if (!h.hopping) return { x: h.x, y: rowMid(h.r) };
    return { x: h.fx + (h.tx - h.fx) * h.u, y: rowMid(h.fr) + (rowMid(h.tr) - rowMid(h.fr)) * h.u };
  }

  private drawHoglet() {
    const h = this.hog, p = this.hogPos();
    const wet = h.cause === 'SPLASH!' || h.cause === 'SWEPT AWAY!';
    if (this.between > 0 || this.over) {
      this.sprite.setVisible(false);
    } else if (h.dead > 0) {
      this.sprite.setTexture('curl').setFlipX(false).setPosition(Math.round(p.x), Math.round(p.y)).setVisible(!wet);
    } else {
      const lift = h.hopping ? Math.sin(Math.PI * h.u) * HOGLET.lift : 0;
      const shake = h.bump > 0 ? Math.round(Math.sin(h.bump * 80)) : 0;
      face(this.sprite.setTexture('player'), 'player', h.face > 0).setPosition(Math.round(p.x + shake), Math.round(p.y - lift));
      this.sprite.setVisible(h.blink <= 0 || Math.floor(h.blink * 16) % 2 === 0);
    }
    const g = this.ripples.clear();
    for (const ring of this.rings) {
      g.lineStyle(1, COLORS.canal, 1 - ring.t / 0.6).strokeEllipse(ring.x, ring.y, 8 + ring.t * 48, 4 + ring.t * 24);
    }
  }

  private drawCritters() {
    const c = this.critters, S = this.critterSprites, g = this.critterMarks.clear();
    const t = this.clock;
    const foxOn = this.night >= CRITTERS.fox.fromNight;
    face(S.fox, 'fox', c.fox.dir > 0).setPosition(Math.round(c.fox.x), rowMid(ROW.midVerge) - 1).setVisible(foxOn);

    const heron = c.heron;
    face(S.heron, 'heron', heron.dir > 0).setPosition(Math.round(heron.x), rowMid(ROW.towpath) - 4 + (heron.st === 'crouch' ? 2 : 0)).setVisible(true);
    if (heron.st === 'crouch') {
      // The pad below glints before the stab.
      g.lineStyle(1, 0xffffff, 0.35 + 0.3 * Math.sin(t * 30)).strokeEllipse(heron.x, rowMid(ROW.canalTop), 18, 10);
    } else if (heron.st === 'strike') {
      g.fillStyle(0xc9c3b0).fillRect(Math.round(heron.x) - 1 + heron.dir * 3, rowTop(ROW.canalTop) - 2, 2, 10);
    }

    const f = c.farmer;
    S.farmer.setVisible(!!f && f.st !== 'warn');
    this.torch.setVisible(!!f && f.st !== 'dive');
    if (f) {
      const p = f.st === 'warn' ? { x: f.fromLeft ? -8 : WIDTH + 8, y: rowMid(f.home) } : farmerPos(f);
      if (f.st === 'warn') {
        // The torch sweeps in from the side, with a flashing "!" at the edge.
        const reach = (70 * Math.min(1, (CRITTERS.farmer.warn - f.t) / 0.6) + 10) / 64;
        this.torch.setPosition(f.fromLeft ? 0 : WIDTH, p.y).setScale(reach, 1).setFlipX(!f.fromLeft).setOrigin(f.fromLeft ? 0 : 1, 0.5);
        if (Math.sin(t * 16) > -0.3) {
          const bx = f.fromLeft ? 8 : WIDTH - 8, by = p.y - 13;
          g.fillStyle(COLORS.danger).fillRect(bx - 4, by, 8, 10);
          g.fillStyle(COLORS.ink).fillRect(bx - 1, by + 2, 2, 4).fillRect(bx - 1, by + 7, 2, 2);
        }
      } else {
        face(S.farmer, 'farmer', f.face > 0).setPosition(Math.round(p.x), Math.round(p.y) - 2 + (f.u < 0.5 ? -1 : 0));
        this.torch.setPosition(p.x + f.face * 5, p.y).setScale(52 / 64, 1).setFlipX(f.face < 0).setOrigin(f.face > 0 ? 0 : 1, 0.5);
      }
    }

    const m = c.mouse;
    if (m.carried && this.hog.dead <= 0) {
      const p = this.hogPos(), lift = this.hog.hopping ? Math.sin(Math.PI * this.hog.u) * HOGLET.lift : 0;
      // Half size, perched on the spines, so the hoglet stays readable.
      face(S.mouse, 'mouse', this.hog.face > 0).setScale(0.5).setPosition(Math.round(p.x) - this.hog.face * 2, Math.round(p.y - lift) - 7).setVisible(true);
    } else if (m.item && !m.carried) {
      const lane = this.laneAt.get(m.lane)!;
      face(S.mouse, 'mouse', lane.dir > 0).setScale(1).setPosition(Math.round(itemX(lane, m.item) + m.off), rowTop(m.lane) + 5 + (Math.sin(t * 5) > 0.8 ? -1 : 0)).setVisible(true);
    } else S.mouse.setVisible(false);

    const b = c.beetle;
    S.beetle.setVisible(!!b && (b.t > CRITTERS.beetle.warn || Math.sin(t * 20) > 0));
    if (b) S.beetle.setPosition(HOMES[b.home], rowMid(this.goalRow) + (Math.sin(t * 8) > 0 ? 0 : -1));
  }

  private sfx(name: SoundName, config?: Phaser.Types.Sound.SoundConfig) {
    if (import.meta.env.DEV) this.played = [...this.played.slice(-39), name];
    playSound(this, name, config);
  }

  /** A two-line message across the middle verge, under every sprite. */
  private banner(big: string, small: string, color: string) {
    this.bannerTime = FX.banner;
    this.bannerBig.setText(big).setColor(color);
    this.bannerSmall.setText(small);
  }

  private updateBanner(dt: number) {
    this.bannerTime = Math.max(0, this.bannerTime - dt);
    const t = this.bannerTime, on = t > 0 && !this.over;
    const alpha = Math.min(1, t / 0.3, (FX.banner - t) / 0.12);
    const y = rowMid(ROW.midVerge);
    // Both lines fit the middle verge: clear of the logs above and the road below.
    this.bannerBig.setVisible(on).setAlpha(alpha).setY(y - 6);
    this.bannerSmall.setVisible(on).setAlpha(alpha).setY(y + 4);
  }

  /** A few words that float up from where they happened and fade. */
  private pop(x: number, y: number, str: string, color: string) {
    const t = this.add.text(Phaser.Math.Clamp(x, 30, WIDTH - 30), y, str, { fontFamily: FONT, fontSize: '8px', color })
      .setOrigin(0.5).setDepth(DEPTH.pops).setStroke('#070906', 2);
    this.tweens.add({ targets: t, y: y - 10, alpha: 0, duration: 900, ease: 'Quad.in', onComplete: () => t.destroy() });
  }

  /** Fireflies, and the light warming toward morning on the back leg. */
  private drawGlow() {
    const target = this.leg === 'back' ? (this.between > 0 ? 1 : this.goals.filter((v) => v).length / 5) * FX.dawn.reach : 0;
    this.dawn += (target - this.dawn) * Math.min(1, this.game.loop.delta / 1000 * 1.5);
    if (this.leg === 'back') {
      const P = PALETTES.back, from = Phaser.Display.Color.ValueToColor(P.tint), to = Phaser.Display.Color.ValueToColor(FX.dawn.tint);
      const c = Phaser.Display.Color.Interpolate.ColorWithColor(from, to, 100, this.dawn * 100);
      this.tint.setFillStyle(Phaser.Display.Color.GetColor(c.r, c.g, c.b), P.tintAlpha + (FX.dawn.alpha - P.tintAlpha) * this.dawn);
    }
    const g = this.glow.clear(), t = this.age, fade = 1 - this.dawn;
    for (const f of this.fireflies) {
      const a = Math.max(0, Math.sin(t * 1.7 + f.phase)) * fade;
      if (a <= 0.02) continue;
      const x = (f.x + Math.sin(t * 0.4 + f.phase) * f.drift * 3 + WIDTH) % WIDTH, y = f.y + Math.sin(t * 0.9 + f.phase * 2) * 2;
      g.fillStyle(0xd8ff7a, a * 0.22).fillCircle(x, y, 2.5);
      g.fillStyle(0xf4ffc0, a * 0.9).fillRect(Math.round(x), Math.round(y), 1, 1);
    }
  }

  /** After game over: this leg again, same seed, from zero. */
  retry() {
    this.score = 0;
    this.lives = HOGLET.lives;
    this.nextLife = EXTRA_LIFE.first;
    this.over = false;
    this.newHi = false;
    this.setLeg(this.leg, this.night);
  }

  /** Back to the title. */
  leave() {
    if (this.leaving) return;
    this.leaving = true;
    saveHi(this.hi);
    this.cameras.main.fadeOut(250);
    this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => {
      this.scene.stop('hud');
      this.scene.start('title');
    });
  }

  // ---- Dev-only hooks for tests ----

  /** A plain snapshot of the scene. */
  snapshot() {
    const h = this.hog;
    return {
      night: this.night, leg: this.leg, clock: this.clock, score: this.score, lives: this.lives, current: this.current,
      hi: this.hi, nextLife: this.nextLife, between: this.between, over: this.over,
      banner: { big: this.bannerBig.text, small: this.bannerSmall.text, visible: this.bannerBig.visible },
      fx: { ...this.fx.stats, calm: this.fx.calm }, played: [...this.played], fireflies: this.fireflies.length, dawn: this.dawn,
      burrows: [...this.burrows], nests: [...this.nests],
      hog: { x: h.x, r: h.r, hopping: h.hopping, dead: h.dead, cause: h.cause, time: h.time, face: h.face, combo: h.combo },
      touch: { visible: touchControls.visible, layout: touchControls.layout() },
      sprite: { x: this.sprite.x, y: this.sprite.y, flipX: this.sprite.flipX, visible: this.sprite.visible, texture: this.sprite.texture.key },
      critters: JSON.parse(JSON.stringify({ ...this.critters, mouse: { ...this.critters.mouse, item: this.critters.mouse.item ? this.lanes.find((l) => l.row === this.critters.mouse.lane)!.items.indexOf(this.critters.mouse.item) : null } })),
      lanes: this.lanes.map((l) => ({ row: l.row, kind: l.kind, dir: l.dir, speed: l.speed, xs: l.items.map((i) => itemX(l, i)), lens: l.items.map((i) => i.len) })),
    };
  }

  /** Stops (or restarts) the lanes and the timer. */
  freeze(on: boolean) {
    this.frozen = on;
  }

  /** Puts the hoglet at a row and x, alive and still. */
  place(r: number, x: number) {
    Object.assign(this.hog, { x, r, hopping: false, dead: 0, cause: null, blink: 0, bump: 0, queued: null, best: (r - this.startRow) * this.fwd, combo: 0, landed: -9 });
  }

  setScore(points: number) {
    this.score = points;
    this.nextLife = points < EXTRA_LIFE.first ? EXTRA_LIFE.first : EXTRA_LIFE.first + Math.ceil((points + 1 - EXTRA_LIFE.first) / EXTRA_LIFE.every) * EXTRA_LIFE.every;
  }

  setTime(seconds: number) {
    this.hog.time = seconds;
  }

  /**
   * Puts a critter on stage. fox / heron: at x (the heron in state `st`). farmer: warns now, for the hoglet where it is.
   * beetle: in goal home `home`. mouse: on item `item` of lane row `lane`, `off` px from its left end.
   */
  spawn(kind: 'fox' | 'heron' | 'farmer' | 'beetle' | 'mouse', o: { x?: number; st?: 'walk' | 'crouch' | 'strike'; t?: number; home?: number; lane?: number; item?: number; off?: number } = {}) {
    const c = this.critters;
    if (kind === 'fox') c.fox.x = o.x ?? c.fox.x;
    else if (kind === 'heron') Object.assign(c.heron, { x: o.x ?? c.heron.x, st: o.st ?? 'walk', t: o.t ?? CRITTERS.heron.walk });
    else if (kind === 'farmer') c.spawnFarmer(this.hogView());
    else if (kind === 'beetle') c.beetle = { home: o.home ?? 0, t: o.t ?? CRITTERS.beetle.stay };
    else {
      const lane = this.laneAt.get(o.lane ?? 5)!;
      Object.assign(c.mouse, { lane: lane.row, item: lane.items[o.item ?? 0], off: o.off ?? 12, carried: false, wait: 0 });
    }
  }

  /** Fills the first `n` goal homes, as if those hoglets had already crossed. */
  fillGoals(n: number) {
    for (let k = 0; k < n; k++) { this.goals[k] = 1; this.starts[k] = 0; }
    this.nextHoglet();
  }
}

function loadHi() {
  try {
    return Math.max(0, Number(localStorage.getItem(HI_STORAGE)) || 0);
  } catch {
    return 0;
  }
}

function saveHi(hi: number) {
  try {
    if (hi > loadHi()) localStorage.setItem(HI_STORAGE, String(hi));
  } catch {
    // Private windows and blocked storage: the high score just doesn't stick.
  }
}
