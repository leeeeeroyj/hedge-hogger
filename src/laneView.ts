import Phaser from 'phaser';
import { MIRROR, PALETTES, TILE, rowTop, type Leg, type SpriteKey } from './config';
import { boatKey, logKey } from './backdrop';
import { duckState, itemX, type Item, type Lane } from './lanes';

/** Depths shared by every scene that draws the crossing. Headlights sit above the tint so they glow. */
export const DEPTH = { water: 0, field: 1, homes: 2, platforms: 3, vehicles: 4, critters: 6, hoglet: 7, tint: 9, lights: 10, banner: 5 } as const;

/** A sprite drawn facing `right` (or left), whatever way its art faces. */
export function face(img: Phaser.GameObjects.Image, key: SpriteKey, right: boolean) {
  // Art that faces left (MIRROR) is flipped to face right, and the other way round.
  return img.setFlipX(MIRROR.has(key) === right);
}

interface ItemView { item: Item; parts: Array<{ img: Phaser.GameObjects.Image; dx: number; duck?: number }> }

/** Display objects for every lane item, repositioned from the lane state each frame. */
export class LaneView {
  private views: Array<{ lane: Lane; items: ItemView[] }> = [];
  private objects: Phaser.GameObjects.GameObject[] = [];

  constructor(private readonly scene: Phaser.Scene) {}

  build(lanes: Lane[], leg: Leg) {
    for (const o of this.objects) o.destroy();
    this.objects = [];
    const lights = PALETTES[leg].lights;
    this.views = lanes.map((lane) => {
      const y = rowTop(lane.row), right = lane.dir > 0;
      const items = lane.items.map((item) => {
        const parts: ItemView['parts'] = [];
        const add = (img: Phaser.GameObjects.Image, dx: number, duck?: number) => { this.objects.push(img); parts.push({ img, dx, duck }); };
        const sprite = (key: SpriteKey, depth: number) => face(this.scene.add.image(0, y + TILE / 2, key), key, right).setDepth(depth);
        switch (lane.kind) {
          case 'log': add(this.scene.add.image(0, y, logKey(item.len)).setOrigin(0).setDepth(DEPTH.platforms), 0); break;
          case 'boat': add(this.scene.add.image(0, y, boatKey(item.len, item.paint ?? 0)).setOrigin(0).setFlipX(!right).setDepth(DEPTH.platforms), 0); break;
          case 'lily': for (let k = 0; k < item.len; k += TILE) add(sprite('lily', DEPTH.platforms), k + 8); break;
          case 'ducks': for (let k = 0; k < 3; k++) add(sprite('duck', DEPTH.platforms), right ? item.len - 8 - k * 16 : 8 + k * 16, k); break;
          default: {
            const front = right ? item.len - 8 : 8;
            if (lane.kind === 'tractor') add(this.scene.add.image(0, y, 'trailer').setOrigin(0).setDepth(DEPTH.vehicles), right ? 0 : 16);
            add(sprite(lane.kind, DEPTH.vehicles), front);
            if (lights > 0) {
              const beam = this.scene.add.image(0, y, 'headlight').setOrigin(right ? 0 : 1, 0).setFlipX(!right)
                .setBlendMode(Phaser.BlendModes.ADD).setAlpha(lights).setDepth(DEPTH.lights);
              add(beam, right ? item.len : 0);
            }
          }
        }
        return { item, parts };
      });
      return { lane, items };
    });
  }

  /** Places everything for the current lane state. `clock` drives the ducks' dive cycle. */
  update(clock: number) {
    for (const { lane, items } of this.views) {
      for (const { item, parts } of items) {
        const x = itemX(lane, item);
        const state = lane.kind === 'ducks' ? duckState(item, clock) : 'up';
        for (const p of parts) {
          p.img.x = Math.round(x + p.dx);
          if (p.duck !== undefined) {
            // Warning: a quick bob. Under: gone (the ripples come in a later milestone).
            p.img.setVisible(state !== 'under');
            p.img.y = rowTop(lane.row) + TILE / 2 + (state === 'warn' ? Math.round(Math.sin(clock * 22 + p.duck) * 1.2) : 0);
          }
        }
      }
    }
  }
}
