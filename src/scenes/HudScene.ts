import Phaser from 'phaser';
import { COLORS, FONT, HEIGHT, HOGLET, HUD_H, HUD_SCALE, HUD_STATE, MIRROR, TEXT, WIDTH, type Leg } from '../config';
import type { Device } from '../controls';
import { MUTED, toggleMute } from '../sfx';
import { fitCamera } from '../view';

export interface HudState {
  score: number;
  hi: number;
  lives: number;
  night: number;
  leg: Leg;
  /** Seconds left for the hoglet crossing now. */
  time: number;
  /** Hop combo multiplier; 0 or 1 shows nothing. */
  combo: number;
  device: Device;
  /** Set when the last life is gone: the game-over panel shows. */
  over: { newHi: boolean } | null;
  paused: boolean;
  /** Attract mode: no hints, pause, sound or game-over panel. */
  attract: boolean;
}

// HUD space is the design size × HUD_SCALE (832×496): sprites drawn here at native 16 px come out half the size
// of game sprites, with no resampling.
const S = HUD_SCALE;
const W = WIDTH * S, BAR = HUD_H * S;
const MAX_ICONS = 6;
const HINTS: Record<Device, string> = {
  kbm: 'ARROWS HOP · SPACE FORWARD · P PAUSE · M SOUND',
  pad: 'D-PAD HOP · A FORWARD · START PAUSE · Y SOUND',
  touch: 'D-PAD OR SWIPE TO HOP  ·  TAP TO HOP FORWARD',
};
const PAUSE_HINTS: Record<Device, string> = { kbm: 'P OR ENTER RESUME  ·  ESC TITLE', pad: 'START OR A RESUME  ·  BACK TITLE', touch: 'TAP RESUME' };

const OVER_HINTS: Record<Device, string> = {
  kbm: 'ENTER RETRY  ·  ESC TITLE',
  pad: 'A RETRY  ·  BACK TITLE',
  touch: 'TAP A BUTTON',
};
const LINE1 = 6, LINE2 = 26;
/** Pause on touch: two bars at the start of the hint line, with a thumb-sized tap zone. */
const PAUSE = { x: 10, y: LINE2 + 1 };
/** Game-over panel, centred on the field. Buttons are 48 units tall: 36 CSS px or more on a landscape phone. */
const PANEL = { x: W / 2, y: BAR + (HEIGHT * S - BAR) / 2, w: 380, h: 208 };
const TIMER = { x: 640, y: LINE2 + 2, w: 152, h: 12 };
const SPEAKER = { x: W - 28, y: 4, w: 20, h: 16 };

const pts = (n: number) => String(n).padStart(6, '0').replace(/\B(?=(\d{3})+(?!\d))/g, ',');

/** Top bar: score and combo, high score, lives, night and leg, then the hint strip and the hoglet's timer. */
export class HudScene extends Phaser.Scene {
  private score!: Phaser.GameObjects.Text;
  private hi!: Phaser.GameObjects.Text;
  private combo!: Phaser.GameObjects.Text;
  private night!: Phaser.GameObjects.Text;
  private hint!: Phaser.GameObjects.Text;
  private dynamic!: Phaser.GameObjects.Graphics;
  private icons: Phaser.GameObjects.Image[] = [];
  private shownLives = -1;
  private overPanel!: Phaser.GameObjects.Container;
  private overScore!: Phaser.GameObjects.Text;
  private overHi!: Phaser.GameObjects.Text;
  private overHint!: Phaser.GameObjects.Text;
  private pauseMenu!: Phaser.GameObjects.Container;
  private pauseHint!: Phaser.GameObjects.Text;
  private pauseZones: Phaser.GameObjects.Zone[] = [];
  private pauseTap!: Phaser.GameObjects.Zone;
  private speakerTap!: Phaser.GameObjects.Zone;

  constructor() {
    super('hud');
  }

  create() {
    fitCamera(this, HUD_SCALE);
    this.icons = [];
    this.shownLives = -1;
    const label = (x: number, y: number, text: string, color = TEXT.dim) => this.add.text(x, y, text, { fontFamily: FONT, fontSize: '16px', color });

    const g = this.add.graphics();
    g.fillStyle(COLORS.void).fillRect(0, 0, W, BAR);
    g.fillStyle(COLORS.line).fillRect(0, BAR - 2, W, 2);

    label(8, LINE1, 'SCORE');
    this.score = label(76, LINE1, '', TEXT.amber);
    this.combo = label(196, LINE1, '', '#070906').setBackgroundColor(TEXT.amber).setPadding(4, 0, 4, 0);
    label(250, LINE1, 'HI');
    this.hi = label(278, LINE1, '', TEXT.ink);
    label(392, LINE1, 'LIVES');
    this.night = label(SPEAKER.x - 30, LINE1, '', TEXT.canal).setOrigin(1, 0);
    this.hint = label(8, LINE2, '');
    label(TIMER.x - 8, LINE2, 'TIME').setOrigin(1, 0);
    this.dynamic = this.add.graphics();

    // Phones have no M key: the speaker is a tap target, padded for a thumb (64 × 48 units: about 50 × 38 CSS px).
    this.speakerTap = this.add.zone(W - 64, 0, 64, BAR).setOrigin(0).setInteractive({ useHandCursor: true })
      .on('pointerdown', () => toggleMute(this));
    // And no P key: on touch, II at the start of the hint line pauses.
    this.pauseTap = this.add.zone(0, LINE2 - 8, 56, BAR - LINE2 + 8).setOrigin(0).setInteractive({ useHandCursor: true })
      .on('pointerdown', () => this.crossing().setPaused(true));
    this.buildOverPanel(label);
    this.buildPause(label);
  }

  private crossing() {
    return this.scene.get('crossing') as unknown as { setPaused(on: boolean): void; retry(): void; leave(): void };
  }

  /** The pause panel: RESUME and TITLE, as buttons a thumb or the mouse can hit. */
  private buildPause(label: (x: number, y: number, text: string, color?: string) => Phaser.GameObjects.Text) {
    this.pauseZones = [];
    const w = 380, h = 190, x = W / 2, top = PANEL.y - h / 2, g = this.add.graphics();
    g.fillStyle(COLORS.void, 0.55).fillRect(0, BAR, W, HEIGHT * S - BAR);
    g.fillStyle(COLORS.panel, 0.96).fillRect(x - w / 2, top, w, h);
    g.lineStyle(2, COLORS.line).strokeRect(x - w / 2, top, w, h);
    const parts: Phaser.GameObjects.GameObject[] = [g, this.add.text(x, top + 20, 'PAUSED', { fontFamily: FONT, fontSize: '32px', color: TEXT.ink }).setOrigin(0.5, 0)];
    const button = (bx: number, text: string, primary: boolean, act: () => void) => {
      const bw = 140, bh = 48, by = top + 84, art = this.add.graphics();
      if (primary) art.fillStyle(COLORS.amber).fillRect(bx - bw / 2, by, bw, bh);
      else art.lineStyle(2, COLORS.ink).strokeRect(bx - bw / 2 + 1, by + 1, bw - 2, bh - 2);
      const t = label(bx, by + bh / 2, text, primary ? '#070906' : TEXT.ink).setOrigin(0.5);
      const zone = this.add.zone(bx - bw / 2, by, bw, bh).setOrigin(0).setInteractive({ useHandCursor: true }).on('pointerdown', act);
      this.pauseZones.push(zone);
      parts.push(art, t, zone);
    };
    button(x - 80, 'RESUME', true, () => this.crossing().setPaused(false));
    button(x + 80, 'TITLE', false, () => this.crossing().leave());
    this.pauseHint = label(x, top + h - 34, '').setOrigin(0.5, 0);
    parts.push(this.pauseHint);
    this.pauseMenu = this.add.container(0, 0, parts).setVisible(false).setDepth(10);
  }

  private buildOverPanel(label: (x: number, y: number, text: string, color?: string) => Phaser.GameObjects.Text) {
    const crossing = () => this.crossing();
    const { x, y, w, h } = PANEL;
    const bg = this.add.graphics();
    bg.fillStyle(COLORS.void, 0.55).fillRect(0, BAR, W, HEIGHT * S - BAR);
    bg.fillStyle(COLORS.panel, 0.96).fillRect(x - w / 2, y - h / 2, w, h);
    bg.lineStyle(2, COLORS.line).strokeRect(x - w / 2, y - h / 2, w, h);
    const title = this.add.text(x, y - h / 2 + 18, 'GAME OVER', { fontFamily: FONT, fontSize: '32px', color: TEXT.danger }).setOrigin(0.5, 0);
    this.overScore = label(x, y - h / 2 + 64, '', TEXT.ink).setOrigin(0.5, 0);
    this.overHi = label(x, y - h / 2 + 88, 'NEW HIGH SCORE!', TEXT.amber).setOrigin(0.5, 0);
    const button = (bx: number, text: string, primary: boolean, act: () => void) => {
      const bw = 140, bh = 48, by = y + h / 2 - 86;
      const g = this.add.graphics();
      if (primary) g.fillStyle(COLORS.amber).fillRect(bx - bw / 2, by, bw, bh);
      else g.lineStyle(2, COLORS.ink).strokeRect(bx - bw / 2 + 1, by + 1, bw - 2, bh - 2);
      const t = label(bx, by + bh / 2, text, primary ? '#070906' : TEXT.ink).setOrigin(0.5);
      const zone = this.add.zone(bx - bw / 2, by, bw, bh).setOrigin(0).setInteractive({ useHandCursor: true }).on('pointerdown', act);
      return [g, t, zone];
    };
    this.overHint = label(x, y + h / 2 - 26, '').setOrigin(0.5, 0);
    this.overPanel = this.add.container(0, 0, [
      bg, title, this.overScore, this.overHi,
      ...button(x - 80, 'RETRY', true, () => crossing().retry()),
      ...button(x + 80, 'TITLE', false, () => crossing().leave()),
      this.overHint,
    ]).setVisible(false);
  }

  update() {
    const s = this.registry.get(HUD_STATE) as HudState | undefined;
    if (!s) return;
    this.score.setText(pts(s.score));
    this.hi.setText(pts(s.hi));
    this.combo.setVisible(s.combo > 1).setText(`x${s.combo}`);
    this.night.setText(`NIGHT ${s.night}  ·  ${s.leg === 'out' ? 'OUT' : 'BACK'}`);
    const pauseTap = s.device === 'touch' && !s.attract && !s.over && !s.paused;
    this.hint.setText(s.attract ? '' : HINTS[s.device]).setX(pauseTap ? 40 : 8);
    this.pauseTap.input!.enabled = pauseTap;
    this.speakerTap.input!.enabled = !s.attract;
    this.pauseMenu.setVisible(s.paused);
    for (const z of this.pauseZones) z.input!.enabled = s.paused;
    if (s.paused) this.pauseHint.setText(PAUSE_HINTS[s.device]);
    const over = !!s.over && !s.attract;
    this.overPanel.setVisible(over);
    for (const obj of this.overPanel.list) if (obj instanceof Phaser.GameObjects.Zone) obj.input!.enabled = over;
    if (s.over) {
      this.overScore.setText(`SCORE ${pts(s.score)}`);
      this.overHi.setVisible(s.over.newHi && Math.floor(this.time.now / 300) % 2 === 0);
      this.overHint.setText(OVER_HINTS[s.device]);
    }

    if (s.lives !== this.shownLives) {
      this.shownLives = s.lives;
      this.icons.forEach((i) => i.destroy());
      this.icons = Array.from({ length: Math.max(0, Math.min(s.lives, MAX_ICONS)) }, (_, i) =>
        this.add.image(472 + i * 18, LINE1 + 8, 'player').setFlipX(MIRROR.has('player')));
    }

    const g = this.dynamic.clear();
    // Out heads up the screen, back heads down: a small arrow after the leg name.
    const ax = SPEAKER.x - 24, ay = LINE1 + 2;
    g.fillStyle(COLORS.canal);
    if (s.leg === 'out') g.fillTriangle(ax, ay + 10, ax + 8, ay + 10, ax + 4, ay + 2);
    else g.fillTriangle(ax, ay + 2, ax + 8, ay + 2, ax + 4, ay + 10);

    const t = Math.max(0, Math.min(1, s.time / HOGLET.time));
    g.fillStyle(COLORS.line).fillRect(TIMER.x, TIMER.y, TIMER.w, TIMER.h);
    g.fillStyle(s.time < 8 ? COLORS.danger : COLORS.amber).fillRect(TIMER.x + 2, TIMER.y + 2, Math.round((TIMER.w - 4) * t), TIMER.h - 4);

    if (pauseTap) g.fillStyle(COLORS.ink).fillRect(PAUSE.x, PAUSE.y, 5, 14).fillRect(PAUSE.x + 9, PAUSE.y, 5, 14);
    if (s.attract) return;
    // Speaker: three waves when on, a cross when muted. Drawn in 2 px blocks to match the game's pixels.
    const muted = this.registry.get(MUTED) === true;
    g.fillStyle(muted ? COLORS.danger : COLORS.ink);
    const px = (x: number, y: number, w = 1, h = 1) => g.fillRect(SPEAKER.x + x * 2, SPEAKER.y + y * 2, w * 2, h * 2);
    px(0, 2, 2, 3); px(2, 1, 1, 5); px(3, 0, 1, 7);
    if (muted) for (let i = 0; i < 4; i++) { px(5 + i, 1 + i); px(8 - i, 1 + i); }
    else { px(5, 2, 1, 3); px(7, 1, 1, 5); px(9, 0, 1, 7); }
  }
}
