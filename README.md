<div align="center">

# Hedge-Hogger

**Five hoglets. One night. There and back.**

A lane-crossing arcade game about a hedgehog family, a country road and a canal. It runs in the browser with a keyboard and mouse, a controller, or touch on a phone.

### [▶ Play it now](https://leeeeeroyj.github.io/hedge-hogger/)

[![Deploy](https://github.com/leeeeeroyj/hedge-hogger/actions/workflows/deploy.yml/badge.svg)](https://github.com/leeeeeroyj/hedge-hogger/actions/workflows/deploy.yml)
![Phaser 4](https://img.shields.io/badge/Phaser-4-8a5cf6)
![TypeScript](https://img.shields.io/badge/TypeScript-7-3178c6?logo=typescript&logoColor=white)
![Vite](https://img.shields.io/badge/Vite-8-646cff?logo=vite&logoColor=white)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

![Hedge-Hogger at dusk: five hoglets wait in their burrows below a five-lane road of tractors, cars, motorbikes, vans and lorries with their headlights on, and beyond it a canal of logs, duck families, narrowboats and lily pads, then the towpath and the empty orchard nests](docs/screenshot.png)

</div>

## About

Hedge-Hogger is an original arcade game inspired by the mechanics of Konami's 1981 arcade game *Frogger*. A hedgehog mother has five hoglets and one night. At dusk she sees them over the lane and the canal to the orchard; before dawn she has to bring every one of them back.

- **There and back.** Every night is two legs: out to the orchard nests at dusk, then home to the garden burrows in the dark.
- **Lanes you can learn.** Each leg's traffic, boats and ducks are laid out from a seed, so a retry repeats the layout and the next leg brings a new one.
- **A country crossing.** Tractors towing hay, motorbikes, vans and lorries on the road; narrowboats, logs, lily pads and duck families that dive on the canal.
- **Warning before harm.** Headlights reach ahead of every vehicle after dark, and diving ducks bob and ripple before they go under.
- **Sound with no audio files.** Sound effects are generated in code, sfxr style, when the game loads.

## Status

**Milestone 1 of 7: the skeleton.** The title screen and the crossing run, with all nine lanes moving at dusk (out) and at night (back). The hoglet waits in its burrow; hopping comes next.

Still to come:
2. **First playable:** hopping, riding the logs and boats, getting hit or falling in, the five homes, the timer, score and lives.
3. **The full roster:** diving ducks, the heron, the fox, the farmer, the field mouse and the beetle.
4. **Structure:** out and back legs, nights getting harder, the hop combo, extra lives, game over and retry.
5. **HUD and feedback:** banners, sounds, sparks and splashes, fireflies and dawn light.
6. **Touch and mobile:** an on-screen d-pad, a HOP button and swipes.
7. **Polish:** a fairness check on every layout and a balance pass.

## How to play

From the bottom of the screen: the garden hedge with five burrows, a verge, a five-lane road, the middle verge, a four-lane canal, the towpath, and the orchard hedge with five nests. On the out leg each hoglet crosses from a burrow to a nest; on the back leg they come home the other way. The full rules arrive with milestone 2.

## Controls

| | Keyboard + mouse | Controller | Touch |
| --- | --- | --- | --- |
| Start | Enter or Space, or click **START** | A or Start | Tap **START** |
| Sound on / off | M, or click the speaker (top right) | Y | Tap the speaker |
| Back to the title | Esc | Back | — |

Hopping (arrows or WASD, D-pad or stick, and touch) arrives with milestone 2. Controllers show up once you press a button.

## Run it locally

You need [Node.js](https://nodejs.org/) 20.19+ or 22.12+.

```bash
npm install
npm run dev        # http://localhost:5173
npm run build      # type-check and build to dist/
```

Every push to `main` builds the game and deploys it to GitHub Pages.

## Project layout

```
src/
  main.ts            game setup
  config.ts          tunables: screen, rows, lanes, difficulty ramp, palettes
  lanes.ts           seeded lane layouts and the lane rules
  backdrop.ts        hedges, verges, road, logs and narrowboats, drawn in code
  laneView.ts        the moving lanes on screen
  controls.ts        keyboard, mouse and gamepad input
  sfx.ts             procedural sound effects
  scenes/            title screen, the crossing and the HUD
assets/sprites/      the game's 16 × 16 sprites
design/              concept sheet and build plan
tools/sprites.py     sprite search and export script
tools/cdp.mjs        headless Chrome harness for the tests
tools/m*-test.mjs    checks for each milestone
```

## Credits

- **Sprites:** from the CC0 [Angais/pixel-art-atlas-1.4m](https://huggingface.co/datasets/Angais/pixel-art-atlas-1.4m) collection of AI-generated pixel art, found with [Pixel Search](https://huggingface.co/spaces/cfahlgren1/pixel-search).
- **Font:** [Silkscreen](https://fonts.google.com/specimen/Silkscreen) by Jason Kottke (SIL Open Font License).
- **Engine:** [Phaser](https://phaser.io/).
- **Inspiration:** Konami's *Frogger*. Hedge-Hogger is an original game and isn't affiliated with or endorsed by the original's rights holders.

## License

The code is released under the [MIT License](LICENSE). The sprites in `assets/sprites/` and `design/` are CC0 (public domain), and the Silkscreen font is under the SIL Open Font License.
