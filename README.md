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

![Hedge-Hogger at dusk: a hoglet rides a log across the canal, two of its siblings are already in their orchard nests at the top, and two more wait in the garden burrows below a five-lane road of tractors, cars, motorbikes, vans and lorries with their headlights on](docs/screenshot.png)

</div>

## About

Hedge-Hogger is an original arcade game inspired by the mechanics of Konami's 1981 arcade game *Frogger*. A hedgehog mother has five hoglets and one night. At dusk she sees them over the lane and the canal to the orchard; before dawn she has to bring every one of them back.

- **There and back.** Every night is two legs: out to the orchard nests at dusk, then home to the garden burrows in the dark.
- **Lanes you can learn.** Each leg's traffic, boats and ducks are laid out from a seed, so a retry repeats the layout and the next leg brings a new one.
- **A country crossing.** Tractors towing hay, motorbikes, vans and lorries on the road; narrowboats, logs, lily pads and duck families that dive on the canal.
- **Warning before harm.** Headlights reach ahead of every vehicle after dark, diving ducks bob and ripple before they go under, the heron's pad glints before it stabs, and the farmer's torch comes before the farmer.
- **Gentle on motion.** If your system asks for reduced motion, the screen never shakes or flashes.
- **Sound with no audio files.** Sound effects are generated in code, sfxr style, when the game loads.

## Status

**Milestone 6 of 7: touch and mobile.** The whole game, night after night, out and back, with sound, banners, sparks, fireflies and dawn light, and now playable on a phone held sideways: a d-pad and a HOP button, or swipe and tap.

Still to come:
7. **Polish:** a fairness check on every layout and a balance pass.

## How to play

From the bottom of the screen: the garden hedge with five burrows, a verge, a five-lane road, the middle verge, a four-lane canal, the towpath, and the orchard hedge with five nests. On the out leg each hoglet crosses from a burrow to a nest; on the back leg they come home the other way.

- **Hop one tile at a time.** The verges and the towpath are safe.
- **The road:** anything with wheels bumps the hoglet. Watch the headlights.
- **The canal:** the water is deep. Ride the logs, narrowboats, lily pads and duck families, and don't let them carry you off the edge of the screen.
- **Homes:** hop into an empty nest (or burrow, on the way back). The hedge between homes, and a home that's already full, just bump you back.
- **The clock:** each hoglet has 30 seconds. You start with 3 lives, and get another at 10,000 points and every 20,000 after that.
- **The hop combo:** hop forward again within half a second of landing: ×2, ×3, up to ×4. It multiplies hop and home points. Stopping or hopping back ends it.
- **Nights:** get all five across and the next leg begins. A night is out at dusk and back in the dark; each leg is a little faster than the last, and the fox and the farmer join from night 2.
- **Game over:** retry the same leg from zero (the lanes come back exactly as they were), or go back to the title.
- **High score:** your best is kept in this browser and shown on the title and in the top bar.
- **Attract mode:** add `?attract` to the address for a silent demo that hops by itself on a different night and leg each time, and ignores input. `?attract&seed=<n>` repeats the same demos.

**Who's about**

| | |
| --- | --- |
| **Duck families** | Safe to ride, but some dive. They bob and ripple first, then the water's open. |
| **Heron** | Walks the towpath and is deadly to touch. When it crouches the lily pad below it glints, then it stabs down. |
| **Fox** | From night 2, paces the middle verge. Wait for it to pass. |
| **Farmer** | From night 2, a torch beam and a **!** warn that he's coming. He follows you over the verges and the road, but if a vehicle comes through his lane he dives for the verge and gives up. |
| **Field mouse** | Rides a log or a narrowboat. Hop on next to it and it climbs onto your back. |
| **Beetle** | Turns up in an empty home for a few seconds. |

| | Points |
| --- | --- |
| Each new row reached | 10 × combo |
| A hoglet home | 50 × combo, + 10 for every half second left |
| All five home | 1,000 |
| Farmer honked off the road | 300 |
| Field mouse brought home | 200 |
| Beetle in the home you reach | 200 |

## Controls

| | Keyboard + mouse | Controller | Touch |
| --- | --- | --- | --- |
| Hop | Arrows or WASD (hold to keep hopping) | D-pad or left stick | The on-screen d-pad (hold to keep hopping), or swipe |
| Hop forward | Space | A | **HOP**, or tap anywhere on the field |
| Hop toward a spot | Click it | — | — |
| Start | Enter or Space, or click **START** | A or Start | Tap **START** |
| Pause | P | Start | Tap **II** (top left) |
| Sound on / off | M, or click the speaker (top right) | Y | Tap the speaker |
| Retry after game over | Enter or Space, or click **RETRY** | A or Start | Tap **RETRY** |
| Back to the title | Esc, or click **TITLE** when paused or after game over | Back | Tap **TITLE** when paused or after game over |

"Forward" means toward the hedge you're heading for: up the screen on the way out, down on the way back. The game pauses itself if you switch away. Controllers show up once you press a button. On a phone, play in landscape: the d-pad and HOP sit beside the game on wide screens and over its bottom corners otherwise.

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
  critters.ts        fox, heron, farmer, field mouse and beetle
  backdrop.ts        hedges, verges, road, logs and narrowboats, drawn in code
  laneView.ts        the moving lanes on screen
  controls.ts        keyboard, mouse and gamepad input
  touch.ts           on-screen d-pad, HOP, swipes and taps
  effects.ts         sparks, rings, shake and flash
  sfx.ts             procedural sound effects
  hi.ts              the high score, kept in localStorage
  attract.ts         the ?attract demo mode's settings
  scenes/            title screen, the crossing and the HUD
assets/sprites/      the game's 16 × 16 sprites
design/              concept sheet and build plan
tools/sprites.py     sprite search and export script
tools/cdp.mjs        headless Chrome harness for the tests
tools/m*-test.mjs    checks for each milestone
tools/pause-hi-test.mjs  checks pause and the high score on the title
tools/attract-test.mjs   checks the ?attract demo
tools/fairness.mjs   checks every seeded layout can be crossed in time
```

## Credits

- **Sprites:** from the CC0 [Angais/pixel-art-atlas-1.4m](https://huggingface.co/datasets/Angais/pixel-art-atlas-1.4m) collection of AI-generated pixel art, found with [Pixel Search](https://huggingface.co/spaces/cfahlgren1/pixel-search).
- **Font:** [Silkscreen](https://fonts.google.com/specimen/Silkscreen) by Jason Kottke (SIL Open Font License).
- **Engine:** [Phaser](https://phaser.io/).
- **Inspiration:** Konami's *Frogger*. Hedge-Hogger is an original game and isn't affiliated with or endorsed by the original's rights holders.

## License

The code is released under the [MIT License](LICENSE). The sprites in `assets/sprites/` and `design/` are CC0 (public domain), and the Silkscreen font is under the SIL Open Font License.
