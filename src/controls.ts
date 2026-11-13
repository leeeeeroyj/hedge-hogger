import Phaser from 'phaser';

export type Device = 'kbm' | 'pad' | 'touch';

export interface ControlState {
  /** Edges: true only on the frame they're pressed. */
  confirm: boolean;
  back: boolean;
  mute: boolean;
  device: Device;
}

// Standard gamepad mapping (Xbox layout).
const BTN = { A: 0, Y: 3, BACK: 8, START: 9 } as const;
const TRACKED = Object.values(BTN);

type KeyName = 'ENTER' | 'SPACE' | 'ESC' | 'M';

/**
 * One input layer. Keyboard: Enter or Space confirms, Esc goes back, M toggles sound. Controller: A or Start
 * confirms, Back goes back, Y toggles sound. The last device used decides the hints. Construct one per scene.
 */
export class Controls {
  /** Phones and tablets start in touch mode, so the hints are right before the first touch. */
  device: Device = window.matchMedia?.('(pointer: coarse)').matches ? 'touch' : 'kbm';
  private prevButtons = new Set<number>();
  private readonly keys: Record<KeyName, Phaser.Input.Keyboard.Key>;

  constructor(private readonly scene: Phaser.Scene) {
    this.keys = scene.input.keyboard!.addKeys('ENTER,SPACE,ESC,M') as Controls['keys'];
    scene.input.mouse?.disableContextMenu();
    scene.input.on('pointerdown', (p: Phaser.Input.Pointer) => (this.device = p.wasTouch ? 'touch' : 'kbm'));
  }

  /** The first connected controller, if the browser has seen one (it needs a button press first). */
  pad(): Phaser.Input.Gamepad.Gamepad | undefined {
    const pad = this.scene.input.gamepad?.pad1;
    return pad && pad.connected ? pad : undefined;
  }

  read(): ControlState {
    const k = this.keys, just = Phaser.Input.Keyboard.JustDown;
    let confirm = just(k.ENTER) || just(k.SPACE);
    let back = just(k.ESC);
    let mute = just(k.M);
    if (confirm || back || mute) this.device = 'kbm';

    const pad = this.pad();
    const down = new Set(pad ? TRACKED.filter((i) => pad.buttons[i]?.pressed) : []);
    const edges = new Set([...down].filter((i) => !this.prevButtons.has(i)));
    this.prevButtons = down;
    if (pad) {
      if (down.size) this.device = 'pad';
      confirm ||= edges.has(BTN.A) || edges.has(BTN.START);
      back ||= edges.has(BTN.BACK);
      mute ||= edges.has(BTN.Y);
    }
    return { confirm, back, mute, device: this.device };
  }
}
