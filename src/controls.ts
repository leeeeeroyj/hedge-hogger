import Phaser from 'phaser';
import { HOGLET } from './config';
import { touchControls, type Gesture } from './touch';

export type Device = 'kbm' | 'pad' | 'touch';
/** A hop request. `fwd` means toward the goal hedge, so it depends on the leg. */
export type HopDir = 'up' | 'down' | 'left' | 'right' | 'fwd';

export interface ControlState {
  /** A hop this frame: on the press, then repeating while held. */
  hop: HopDir | null;
  /** A mouse click this frame, in the scene's world coordinates. */
  click: { x: number; y: number } | null;
  /** Edges: true only on the frame they're pressed. */
  confirm: boolean;
  back: boolean;
  mute: boolean;
  /** P on the keyboard, Start on a controller (Start also confirms, for menus). */
  pause: boolean;
  device: Device;
}

const STICK = 0.5;
// Standard gamepad mapping (Xbox layout).
const BTN = { A: 0, Y: 3, BACK: 8, START: 9 } as const;
const TRACKED = Object.values(BTN);

type KeyName = 'LEFT' | 'RIGHT' | 'UP' | 'DOWN' | 'W' | 'A' | 'S' | 'D' | 'ENTER' | 'SPACE' | 'ESC' | 'M' | 'P';

/**
 * One input layer. Keyboard: arrows or WASD hop, Space hops forward (and confirms on menus), Enter confirms, Esc goes
 * back, M toggles sound, P pauses. Mouse: a click hops toward the pointer. Controller: D-pad or left stick hops, A hops forward
 * and confirms, Start pauses and confirms, Back goes back, Y toggles sound. Touch: the d-pad and HOP, swipes and taps
 * (src/touch.ts). The last device used decides the hints.
 * Construct one per scene.
 */
export class Controls {
  /** Phones and tablets start in touch mode, so the hints are right before the first touch. */
  device: Device = window.matchMedia?.('(pointer: coarse)').matches ? 'touch' : 'kbm';
  private prevButtons = new Set<number>();
  private readonly keys: Record<KeyName, Phaser.Input.Keyboard.Key>;
  private held: HopDir | null = null;
  private repeatAt = 0;
  private pendingClick: { x: number; y: number } | null = null;
  private gestures: Gesture[] = [];

  constructor(private readonly scene: Phaser.Scene) {
    this.keys = scene.input.keyboard!.addKeys('LEFT,RIGHT,UP,DOWN,W,A,S,D,ENTER,SPACE,ESC,M,P') as Controls['keys'];
    scene.input.mouse?.disableContextMenu();
    scene.input.on('pointerdown', (p: Phaser.Input.Pointer) => {
      this.device = p.wasTouch ? 'touch' : 'kbm';
      // Touch gets its own d-pad and swipes; only a real mouse click hops toward the pointer.
      if (!p.wasTouch && p.leftButtonDown()) {
        const w = p.positionToCamera(scene.cameras.main) as Phaser.Math.Vector2;
        this.pendingClick = { x: w.x, y: w.y };
      }
    });
  }

  /** The first connected controller, if the browser has seen one (it needs a button press first). */
  pad(): Phaser.Input.Gamepad.Gamepad | undefined {
    const pad = this.scene.input.gamepad?.pad1;
    return pad && pad.connected ? pad : undefined;
  }

  read(): ControlState {
    // Key repeat follows real time, not the game's clamped frame time.
    const now = this.scene.time.now / 1000;
    const k = this.keys, just = Phaser.Input.Keyboard.JustDown;
    // JustDown is read once per key: it also catches a tap that went down and up between two frames.
    const space = just(k.SPACE);
    let confirm = just(k.ENTER) || space;
    let back = just(k.ESC);
    let mute = just(k.M);
    let pause = just(k.P);
    let tapped: HopDir | null = just(k.UP) || just(k.W) ? 'up' : just(k.DOWN) || just(k.S) ? 'down'
      : just(k.LEFT) || just(k.A) ? 'left' : just(k.RIGHT) || just(k.D) ? 'right' : space ? 'fwd' : null;
    let dir: HopDir | null =
      k.UP.isDown || k.W.isDown ? 'up' : k.DOWN.isDown || k.S.isDown ? 'down' : k.LEFT.isDown || k.A.isDown ? 'left'
        : k.RIGHT.isDown || k.D.isDown ? 'right' : k.SPACE.isDown ? 'fwd' : null;
    if (confirm || back || mute || pause || dir || tapped) this.device = 'kbm';

    const pad = this.pad();
    const down = new Set(pad ? TRACKED.filter((i) => pad.buttons[i]?.pressed) : []);
    const edges = new Set([...down].filter((i) => !this.prevButtons.has(i)));
    this.prevButtons = down;
    if (pad) {
      const sx = pad.leftStick.x, sy = pad.leftStick.y;
      let padDir: HopDir | null = pad.up ? 'up' : pad.down ? 'down' : pad.left ? 'left' : pad.right ? 'right' : null;
      if (!padDir && Math.max(Math.abs(sx), Math.abs(sy)) > STICK) padDir = Math.abs(sx) > Math.abs(sy) ? (sx > 0 ? 'right' : 'left') : sy > 0 ? 'down' : 'up';
      if (!padDir && down.has(BTN.A)) padDir = 'fwd';
      if (padDir || down.size) this.device = 'pad';
      dir ??= padDir;
      confirm ||= edges.has(BTN.A) || edges.has(BTN.START);
      back ||= edges.has(BTN.BACK);
      mute ||= edges.has(BTN.Y);
      pause ||= edges.has(BTN.START);
    }

    // Touch: a held button acts like a held key; swipes and taps are one-off hops, one per frame.
    touchControls.render();
    const touchHeld = touchControls.heldDir();
    this.gestures.push(...touchControls.take());
    const gesture = this.gestures.shift() ?? null;
    if (touchHeld || gesture) this.device = 'touch';
    dir ??= touchHeld;
    tapped ??= gesture;

    // A hop on the press, then repeats while the same direction stays held.
    let hop: HopDir | null = null;
    if (tapped) {
      hop = tapped;
      this.held = dir;
      this.repeatAt = now + HOGLET.repeatDelay;
    } else if (dir !== this.held) {
      this.held = dir;
      if (dir) { hop = dir; this.repeatAt = now + HOGLET.repeatDelay; }
    } else if (dir && now >= this.repeatAt) {
      hop = dir;
      this.repeatAt = now + HOGLET.repeatEvery;
    }
    const click = this.pendingClick;
    this.pendingClick = null;
    return { hop, click, confirm, back, mute, pause, device: this.device };
  }
}
