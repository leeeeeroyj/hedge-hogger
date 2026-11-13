import Phaser from 'phaser';
import { FONT, HEIGHT, RENDER_SCALE, SPRITES, TEXT, WIDTH, type SpriteKey } from '../config';
import { Water, bakeTextures, fieldKey } from '../backdrop';
import { Controls } from '../controls';
import { DEPTH, LaneView, face } from '../laneView';
import { advance, layout, type Lane } from '../lanes';
import { playSound, registerSounds, restoreMute, toggleMute } from '../sfx';
import { fitCamera } from '../view';

const ROAD: SpriteKey[] = ['tractor', 'car', 'motorbike', 'van', 'lorry'];
const WILD: SpriteKey[] = ['duck', 'heron', 'fox', 'farmer'];

export class TitleScene extends Phaser.Scene {
  private controls!: Controls;
  private lanes: Lane[] = [];
  private laneView!: LaneView;
  private water!: Water;
  private padStatus: Phaser.GameObjects.Text | undefined;
  private start!: Phaser.GameObjects.Text;
  private leaving = false;
  private clock = 0;

  constructor() {
    super('title');
  }

  preload() {
    for (const key of SPRITES) this.load.image(key, `sprites/${key}.png`);
  }

  create() {
    this.leaving = false;
    this.padStatus = undefined;
    this.controls = new Controls(this);
    fitCamera(this, RENDER_SCALE);
    registerSounds(this);
    restoreMute(this);
    bakeTextures(this);
    this.cameras.main.fadeIn(250);

    // The crossing runs behind the title, under a dark veil.
    this.water = new Water(this, DEPTH.water);
    this.add.image(0, 0, fieldKey('out')).setOrigin(0).setDepth(DEPTH.field);
    this.lanes = layout(1, 'out');
    this.laneView = new LaneView(this);
    this.laneView.build(this.lanes, 'out');
    this.add.rectangle(0, 0, WIDTH, HEIGHT, 0x070906, 0.74).setOrigin(0).setDepth(20);

    const depth = 21, cx = WIDTH / 2;
    const text = (x: number, y: number, str: string, size: number, color: string) =>
      this.add.text(x, y, str, { fontFamily: FONT, fontSize: `${size}px`, color, align: 'center' }).setOrigin(0.5, 0).setDepth(depth);
    const sprite = (key: SpriteKey, x: number, y: number, right = true) => face(this.add.image(x, y, key), key, right).setDepth(depth);

    text(cx, 12, 'FIVE HOGLETS  ·  ONE NIGHT  ·  THERE AND BACK', 8, TEXT.dim);
    text(cx, 22, 'HEDGE-HOGGER', 24, TEXT.amber);
    text(cx, 50, 'HOP THEM OVER THE ROAD AND THE CANAL, THEN BRING THEM HOME.', 8, TEXT.ink);

    text(70, 68, 'YOU', 8, TEXT.dim);
    sprite('player', 70, 88);
    text(190, 68, 'THE ROAD', 8, TEXT.danger);
    ROAD.forEach((key, i) => sprite(key, 154 + i * 18, 88, i % 2 === 1));
    text(330, 68, 'THE WILD', 8, TEXT.canal);
    WILD.forEach((key, i) => sprite(key, 303 + i * 18, 88));

    this.start = text(cx, 110, '> START <', 16, TEXT.amber);
    // A hit area well beyond the letters, so a thumb finds it.
    this.start.setInteractive({ hitArea: new Phaser.Geom.Rectangle(-24, -8, this.start.width + 48, this.start.height + 16), hitAreaCallback: Phaser.Geom.Rectangle.Contains, useHandCursor: true });
    this.start.on('pointerdown', () => this.begin());
    const touchScreen = window.matchMedia?.('(pointer: coarse)').matches ?? false;
    text(cx, 132, touchScreen ? 'TAP START' : 'PRESS ENTER OR A, OR CLICK START', 8, TEXT.dim);

    const column = (x: number, title: string, keys: string, actions: string) => {
      text(x, 148, title, 8, TEXT.amber);
      this.add.text(x - 4, 160, keys, { fontFamily: FONT, fontSize: '8px', color: TEXT.ink, align: 'right', lineSpacing: 2 }).setOrigin(1, 0).setDepth(depth);
      this.add.text(x + 4, 160, actions, { fontFamily: FONT, fontSize: '8px', color: TEXT.dim, lineSpacing: 2 }).setDepth(depth);
    };
    if (touchScreen) {
      column(cx, 'TOUCH', 'D-PAD\nHOP\nSWIPE\nTAP\nSPEAKER', 'HOP\nHOP FORWARD\nHOP THAT WAY\nHOP FORWARD\nSOUND, TOP RIGHT IN GAME');
      return;
    }
    column(112, 'KEYBOARD + MOUSE', 'ARROWS / WASD\nSPACE\nCLICK\nM', 'HOP\nHOP FORWARD\nHOP TOWARD IT\nSOUND ON/OFF');
    column(308, 'CONTROLLER', 'D-PAD / STICK\nA\nY', 'HOP\nHOP FORWARD\nSOUND ON/OFF');
    this.padStatus = text(cx, 224, '', 8, TEXT.dim);
  }

  update(_time: number, delta: number) {
    const dt = Math.min(0.05, delta / 1000);
    this.clock += dt;
    advance(this.lanes, dt);
    this.laneView.update(this.clock);
    this.water.draw('out', this.clock, this.lanes);
    const input = this.controls.read();
    if (input.mute) toggleMute(this);
    if (input.confirm) this.begin();
    this.start.setAlpha(Math.sin(this.clock * 4) > -0.5 ? 1 : 0.5);
    const pad = this.controls.pad();
    this.padStatus?.setText(pad ? 'CONTROLLER CONNECTED' : 'USING A CONTROLLER? PRESS ANY BUTTON ON IT').setColor(pad ? TEXT.canal : TEXT.dim);
  }

  private begin() {
    if (this.leaving) return;
    this.leaving = true;
    playSound(this, 'start');
    this.cameras.main.fadeOut(250);
    this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => this.scene.start('crossing'));
  }
}
