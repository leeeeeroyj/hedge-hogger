import Phaser from 'phaser';
import { COLORS, HEIGHT, HOGLET, HOMES, HUD_H, HUD_STATE, PALETTES, RENDER_SCALE, ROW, WIDTH, rowMid, rowTop, type Leg } from '../config';
import { Water, bakeTextures, fieldKey } from '../backdrop';
import { Controls } from '../controls';
import { DEPTH, LaneView, face } from '../laneView';
import { advance, itemX, layout, type Lane } from '../lanes';
import { restoreMute, toggleMute } from '../sfx';
import { fitCamera } from '../view';
import type { HudState } from './HudScene';

/** The game: one screen of lanes between two hedges. */
export class CrossingScene extends Phaser.Scene {
  private controls!: Controls;
  private laneView!: LaneView;
  private water!: Water;
  private field!: Phaser.GameObjects.Image;
  private tint!: Phaser.GameObjects.Rectangle;
  private homes!: Phaser.GameObjects.Graphics;
  private homeHoglets: Phaser.GameObjects.Image[] = [];
  private hoglet!: Phaser.GameObjects.Image;
  private lanes: Lane[] = [];
  private night = 1;
  private leg: Leg = 'out';
  /** 1 where a hoglet is waiting or has arrived. Out legs start with the burrows full; back legs with the nests full. */
  private burrows: number[] = [];
  private nests: number[] = [];
  private current = 0;
  private clock = 0;
  private score = 0;
  private hi = 0;
  private lives: number = HOGLET.lives;
  private leaving = false;

  constructor() {
    super('crossing');
  }

  create() {
    this.leaving = false;
    this.clock = 0;
    this.score = 0;
    this.lives = HOGLET.lives;
    this.controls = new Controls(this);
    fitCamera(this, RENDER_SCALE);
    restoreMute(this);
    bakeTextures(this);
    this.cameras.main.fadeIn(250);
    this.water = new Water(this, DEPTH.water);
    this.field = this.add.image(0, 0, fieldKey('out')).setOrigin(0).setDepth(DEPTH.field);
    this.homes = this.add.graphics().setDepth(DEPTH.homes).setBlendMode(Phaser.BlendModes.ADD);
    this.tint = this.add.rectangle(0, HUD_H, WIDTH, HEIGHT - HUD_H, 0, 0).setOrigin(0).setDepth(DEPTH.tint);
    this.laneView = new LaneView(this);
    this.hoglet = this.add.image(0, 0, 'player').setDepth(DEPTH.hoglet);
    this.setLeg('out', 1);
    if (!this.scene.isActive('hud')) this.scene.launch('hud');
  }

  /** Starts a leg: lays out its lanes from the seed and fills the homes it starts from. */
  setLeg(leg: Leg, night = this.night) {
    this.leg = leg;
    this.night = night;
    this.lanes = layout(night, leg);
    this.laneView.build(this.lanes, leg);
    this.field.setTexture(fieldKey(leg));
    const P = PALETTES[leg];
    this.tint.setFillStyle(P.tint, P.tintAlpha);
    this.burrows = leg === 'out' ? [1, 1, 1, 1, 1] : [0, 0, 0, 0, 0];
    this.nests = leg === 'out' ? [0, 0, 0, 0, 0] : [1, 1, 1, 1, 1];
    this.current = 0;
    this.drawHomes();
  }

  private drawHomes() {
    this.homeHoglets.forEach((i) => i.destroy());
    this.homeHoglets = [];
    const start = this.leg === 'out' ? ROW.burrows : ROW.nests;
    const goal = this.leg === 'out' ? ROW.nests : ROW.burrows;
    HOMES.forEach((x, k) => {
      for (const [row, filled] of [[ROW.burrows, this.burrows[k]], [ROW.nests, this.nests[k]]] as const) {
        if (!filled || (row === start && k === this.current)) continue;
        this.homeHoglets.push(face(this.add.image(x, rowMid(row) + (row === ROW.nests ? 1 : 0), 'player'), 'player', k % 2 === 0).setDepth(DEPTH.homes));
      }
    });
    // A warm glow marks the empty homes the hoglets are heading for.
    this.homes.clear().fillStyle(COLORS.amber, 0.1);
    HOMES.forEach((x, k) => { if (!(goal === ROW.nests ? this.nests : this.burrows)[k]) this.homes.fillRect(x - 10, rowTop(goal) + 2, 20, 13); });
    // The hoglet waiting to go sits in the mouth of its home.
    face(this.hoglet.setPosition(HOMES[this.current], rowMid(start)), 'player', this.leg === 'out');
  }

  update(_time: number, delta: number) {
    const dt = Math.min(0.05, delta / 1000);
    this.clock += dt;
    const input = this.controls.read();
    if (input.mute) toggleMute(this);
    if (input.back) { this.leave(); return; }
    advance(this.lanes, dt);
    this.laneView.update(this.clock);
    this.water.draw(this.leg, this.clock, this.lanes);
    this.hi = Math.max(this.hi, this.score);
    const hud: HudState = { score: this.score, hi: this.hi, lives: this.lives, night: this.night, leg: this.leg, time: HOGLET.time, combo: 0, device: input.device };
    this.registry.set(HUD_STATE, hud);
  }

  /** Back to the title. */
  leave() {
    if (this.leaving) return;
    this.leaving = true;
    this.cameras.main.fadeOut(250);
    this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => {
      this.scene.stop('hud');
      this.scene.start('title');
    });
  }

  /** Dev-only: a plain snapshot of the scene for tests. */
  snapshot() {
    return {
      night: this.night,
      leg: this.leg,
      clock: this.clock,
      burrows: [...this.burrows],
      nests: [...this.nests],
      hoglet: { x: this.hoglet.x, y: this.hoglet.y, flipX: this.hoglet.flipX },
      lanes: this.lanes.map((l) => ({ row: l.row, kind: l.kind, dir: l.dir, speed: l.speed, xs: l.items.map((i) => itemX(l, i)) })),
    };
  }
}
