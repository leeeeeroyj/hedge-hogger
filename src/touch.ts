import { HUD_H, WIDTH } from './config';

export type TouchButton = 'up' | 'down' | 'left' | 'right' | 'hop';
/** A one-off hop from a swipe (that way) or a tap (forward). */
export type Gesture = 'up' | 'down' | 'left' | 'right' | 'fwd';

const BUTTONS: TouchButton[] = ['up', 'down', 'left', 'right', 'hop'];
const LABELS: Record<TouchButton, string> = { up: '▲', down: '▼', left: '◀', right: '▶', hop: 'HOP' };
const RGB: Record<TouchButton, string> = { up: '241, 234, 214', down: '241, 234, 214', left: '241, 234, 214', right: '241, 234, 214', hop: '255, 182, 72' };
/**
 * Over the game, in design pixels: the d-pad's centre, how far its arms reach and their radius, and the HOP button.
 * These stay inside the hedge's corners, clear of the outer homes at x 72 and 344.
 */
const OVERLAY = { pad: { x: 30, y: 206 }, arm: 19, radius: 9, hop: { x: 388, y: 206 }, hopRadius: 14 };
/** A touch within this many radii of a button presses it (the nearest wins). */
const GRAB = 1.4;
/** Gap (CSS px) between buttons and screen edges. */
const MARGIN = 8;
/** Smallest button radius (CSS px) the side bars must fit, or the buttons go over the corners instead. */
const MIN_SIDE = 18;
/** Finger travel, in design pixels, that turns a touch into a swipe. */
const SWIPE = 10;

type Layout = { r: number; hopR: number; centers: Record<TouchButton, { x: number; y: number }> };

/**
 * The touch controls, drawn as page elements: a d-pad under the left thumb and HOP under the right. They sit in the
 * bars beside the game when those are wide enough, otherwise over its bottom corners. A touch anywhere else on the
 * field is a gesture: a swipe hops that way as soon as it's long enough, a tap hops forward. Touches are read from
 * the whole page, because Phaser only hears touches that start on its canvas; the top bar is left to the HUD.
 */
class TouchControls {
  private readonly held = new Map<number, TouchButton | null>();
  /** When each finger on a button pressed it: the latest press wins, as with two keys held. */
  private readonly order = new Map<number, number>();
  private presses = 0;
  private readonly swipes = new Map<number, { x: number; y: number; done: boolean }>();
  private queue: Gesture[] = [];
  private els: Record<TouchButton, HTMLDivElement> | undefined;
  private shown = false;
  private touched = false;
  private readonly coarse = window.matchMedia?.('(pointer: coarse)').matches ?? false;

  constructor() {
    window.addEventListener('pointerdown', (e) => {
      if (e.pointerType !== 'touch' || !this.shown) return;
      this.touched = true;
      const b = this.hit(e.clientX, e.clientY);
      if (b) { this.pressButton(e.pointerId, b); return; }
      const rect = this.rect(), k = rect.width / WIDTH;
      if (e.clientY < rect.top + HUD_H * k) return;
      this.swipes.set(e.pointerId, { x: e.clientX, y: e.clientY, done: false });
    });
    window.addEventListener('pointermove', (e) => {
      if (this.held.has(e.pointerId)) {
        // A thumb sliding onto another button presses it.
        const b = this.hit(e.clientX, e.clientY);
        if (b && b !== this.held.get(e.pointerId)) this.pressButton(e.pointerId, b);
        else if (!b) this.held.set(e.pointerId, null);
        return;
      }
      const s = this.swipes.get(e.pointerId);
      if (!s || s.done) return;
      const k = this.rect().width / WIDTH, dx = (e.clientX - s.x) / k, dy = (e.clientY - s.y) / k;
      if (Math.max(Math.abs(dx), Math.abs(dy)) < SWIPE) return;
      s.done = true;
      this.queue.push(Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : dy > 0 ? 'down' : 'up');
    });
    const up = (e: PointerEvent) => {
      this.held.delete(e.pointerId);
      this.order.delete(e.pointerId);
      const s = this.swipes.get(e.pointerId);
      this.swipes.delete(e.pointerId);
      if (s && !s.done && e.type === 'pointerup') this.queue.push('fwd');
    };
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', up);
  }

  /** Every press is a hop of its own, even while another button is held. */
  private pressButton(id: number, b: TouchButton) {
    this.held.set(id, b);
    this.order.set(id, ++this.presses);
    this.queue.push(b === 'hop' ? 'fwd' : b);
  }

  /** Shown during play on touch screens (or once the screen has been touched); hidden on menus. */
  show(on: boolean) {
    if (on === this.shown) return;
    this.shown = on;
    if (!on) { this.held.clear(); this.order.clear(); this.swipes.clear(); this.queue = []; }
    this.render();
  }

  get visible() {
    return this.shown && (this.coarse || this.touched);
  }

  /** The direction the most recently pressed held button asks for, if any. */
  heldDir(): Gesture | null {
    let best: TouchButton | null = null, latest = -1;
    for (const [id, b] of this.held) if (b && (this.order.get(id) ?? 0) > latest) [best, latest] = [b, this.order.get(id) ?? 0];
    return best === 'hop' ? 'fwd' : best;
  }

  /** Swipes and taps since the last call. */
  take(): Gesture[] {
    const q = this.queue;
    this.queue = [];
    return q;
  }

  /** Redraws the buttons. Call once per frame. */
  render() {
    if (!this.visible) {
      if (this.els) for (const b of BUTTONS) this.els[b].style.display = 'none';
      return;
    }
    const els = (this.els ??= this.build());
    const { r, hopR, centers } = this.layout();
    const pressed = new Set(this.held.values());
    for (const b of BUTTONS) {
      const c = centers[b], on = pressed.has(b), radius = b === 'hop' ? hopR : r;
      Object.assign(els[b].style, {
        display: 'flex', left: `${c.x - radius}px`, top: `${c.y - radius}px`, width: `${radius * 2}px`, height: `${radius * 2}px`,
        fontSize: `${Math.max(10, radius * (b === 'hop' ? 0.45 : 0.7))}px`,
        background: `rgba(${RGB[b]}, ${on ? 0.45 : 0.12})`, border: `2px solid rgba(${RGB[b]}, ${on ? 0.8 : 0.45})`,
      });
    }
  }

  /** Where the buttons are, in CSS pixels (for tests and the layout). */
  layout(): Layout {
    const rect = this.rect();
    const k = rect.width / WIDTH;
    const base = OVERLAY.radius * k;
    const gutter = Math.min(rect.left, window.innerWidth - rect.right);
    // Wide screens: the d-pad in the left bar, HOP in the right one.
    const side = Math.min(base * 1.3, (gutter - MARGIN * 2) / 6.2);
    if (side >= Math.max(base * 0.8, MIN_SIDE)) {
      const r = side, hopR = r * 1.5, arm = r * 2.1;
      const y = Math.min(rect.bottom, window.innerHeight) - arm - r - MARGIN;
      const l = gutter / 2, rt = window.innerWidth - gutter / 2;
      return {
        r, hopR,
        centers: { up: { x: l, y: y - arm }, down: { x: l, y: y + arm }, left: { x: l - arm, y }, right: { x: l + arm, y }, hop: { x: rt, y } },
      };
    }
    const at = (x: number, y: number) => ({ x: rect.left + x * k, y: rect.top + y * k });
    const { pad, arm, hop } = OVERLAY;
    return {
      r: base, hopR: OVERLAY.hopRadius * k,
      centers: { up: at(pad.x, pad.y - arm), down: at(pad.x, pad.y + arm), left: at(pad.x - arm, pad.y), right: at(pad.x + arm, pad.y), hop: at(hop.x, hop.y) },
    };
  }

  private rect() {
    return document.querySelector('#game canvas')?.getBoundingClientRect() ?? new DOMRect(0, 0, window.innerWidth, window.innerHeight);
  }

  private hit(x: number, y: number): TouchButton | null {
    const { r, hopR, centers } = this.layout();
    let best: TouchButton | null = null, bestD = Infinity;
    for (const b of BUTTONS) {
      const d = Math.hypot(x - centers[b].x, y - centers[b].y);
      if (d < (b === 'hop' ? hopR : r) * GRAB && d < bestD) [best, bestD] = [b, d];
    }
    return best;
  }

  private build() {
    const make = (b: TouchButton) => {
      const el = document.createElement('div');
      el.textContent = LABELS[b];
      Object.assign(el.style, {
        position: 'fixed', borderRadius: '50%', pointerEvents: 'none', zIndex: '5', boxSizing: 'border-box',
        alignItems: 'center', justifyContent: 'center', color: '#f1ead6', fontFamily: 'Silkscreen, monospace',
      });
      document.body.append(el);
      return el;
    };
    return { up: make('up'), down: make('down'), left: make('left'), right: make('right'), hop: make('hop') };
  }
}

export const touchControls = new TouchControls();
