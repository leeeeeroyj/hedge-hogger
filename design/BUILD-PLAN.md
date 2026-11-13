# Hedge-Hogger: build plan

A single-screen lane-crossing game re-imagined from Konami's *Frogger* (1981). A hedgehog family crosses a country road and a canal: out to the orchard at dusk, then back before dawn. Concept and picks: `design/concept-sheet.html`.

## Scope

**v1**
- One screen, 416×248 at 16 px tiles: 26 columns by 14 rows, with a 24 px HUD. From the bottom: garden hedge (5 burrows), verge, 5-lane road, middle verge, 4-lane canal, towpath, orchard hedge (5 nests).
- Grid hops in four directions (0.11 s each, with an arc). Holding a direction repeats the hop. The x position stays free while riding, as in the original.
- **Legs:** a night is Out (burrows → nests, dusk) then Back (nests → burrows, night into dawn). The palette shifts with each leg.
- **Road:** tractor with a hay trailer, car, motorbike, delivery van, lorry. Headlights after dark.
- **Canal:** logs and narrowboats (drawn in code), duck families that dive (bob and ripple first), lily pads.
- **Land hazards:** a heron on the towpath that stabs the lily pad below it (crouch and glint first), a fox on the middle verge from night 2, and the farmer.
- **Farmer:** from night 2, turns up at random on a verge or the towpath. A torch beam and a "!" come in from the side for 1.3 s first. He chases tile by tile (0.42 s a step) over the verges and the road, but not water, for 9 s, then leaves. A vehicle in his lane sends him diving back to the verge: he gives up, and you score 300.
- **Twists:** hop combo (×2 to ×4 within 0.5 s of landing; multiplies hop and home points), seeded lanes per leg (a retry repeats them), a field mouse to escort home (200), and a beetle in an empty home (200).
- 30 s per hoglet, time bonus 10 per half second left, 1,000 for all five home. 3 lives, plus one at 10,000 and then every 20,000.
- Hedge or full home = bump back, no death. Death = vehicle, water, swept off screen, fox, heron, farmer, timer.
- Game over → retry the current leg with the score reset, or go to the title.
- Keyboard + mouse, controller, touch (d-pad, HOP, swipe). Procedural sound. Deployed to GitHub Pages.

**Later**
- High-score table, weather (rain cuts headlight reach), a badger that digs up through the verge, music, a two-player mode taking turns.

## Architecture

Vite 8 + Phaser 4.2.1 + TypeScript 7. Project files, `view.ts`, `sfx.ts` and the deploy workflow come from Sentinel (`package.json`, `tsconfig.json`, `vite.config.ts` with `base: './'` and `publicDir: 'assets'`, `index.html`, `src/main.ts`). Node `^20.19.0 || >=22.12.0` (Vite's `engines`).

| Module | Source | What |
|---|---|---|
| `config.ts` | new | Every tunable: grid, rows, home x positions, hop time, combo window, lane table (kind, dir, base speed, length and gap ranges), duck dive cycle, heron, fox and farmer timings, points, lives, ramp per leg, palettes. Sprite list and mirror flags. |
| `lanes.ts` | new, pure (no Phaser) | `layout(night, leg)` from a mulberry32 seed; `itemX`, `platformAt`, `vehicleAt`, `duckState`. Pure, so the fairness check can bundle it. |
| `controls.ts` | adapted from MP | Four hop directions plus "hop forward", edge-triggered with hold-to-repeat; keyboard, mouse (hop toward the pointer), controller (d-pad, stick, A), touch; last-used device for hints. |
| `touch.ts` | adapted from MP | D-pad (4 buttons) on the left, HOP on the right, in the side bars on wide phones, otherwise over the bottom corners. Swipe or tap anywhere else. |
| `backdrop.ts` | new | Bakes hedges, verges, towpath and road to a canvas texture per palette (dusk, night, dawn). Canal water and its shimmer are drawn per frame. |
| `critters.ts` | new | Fox, heron and farmer state machines (pure update functions + draw in the scene). |
| `effects.ts` | copied from MP | Sparks, rings, shake in game pixels, flash. Additive glows for homes, headlights and fireflies. No bloom. |
| `sfx.ts` | copied | Same synth, new voices (hop, bump, splash, honk, home, combo up, farmer shout), own mute key. |
| `view.ts` | copied | Camera fit at 4× (game) and 2× (HUD). |
| `scenes/TitleScene.ts` | new | Title, legend, controls, start. |
| `scenes/CrossingScene.ts` | new | The game: lanes, hoglet, critters, bonuses, scoring, deaths, legs. Writes HUD state to the registry. |
| `scenes/HudScene.ts` | new | Score + combo chip, high score, lives, night and leg, hint strip, timer bar, sound toggle. |

**World model.** A fixed screen with no camera scroll and no arcade physics, like Mars Patrol: rows are integers, positions are design pixels, collisions are a few lines of maths in `lanes.ts`. Lanes wrap over a span of `W + 128`, so items leave and re-enter off-screen.

## Milestones

Each one ends playable, tested, committed, pushed and live (playbook v2). Default rhythm: show the result and wait for the go-ahead before each commit.

**Definition of done, every milestone:** its test and every earlier one pass; screenshots looked at; this plan's Status and the README updated (Status, rules, roster, controls, screenshot if the look changed); Part C1 checks; commit as leeeeeroyj; push; the Pages deploy succeeds.

1. **Skeleton + publishing.** Project files, title scene, baked backdrop (dusk and night palettes), all 9 lanes moving from a seed, headlights, the hoglet in its burrow, a minimal HUD, dev hooks, `tools/cdp.mjs` + `tools/m1-test.mjs`, deploy workflow (actions bumped to `checkout@v7`, `setup-node@v7`, `upload-pages-artifact@v5`, `deploy-pages@v5`). Pages on the existing repo, MIT licence, README with a Status listing the milestones to come, repo settings (C5). First push.
   *Verify:* `m1-test`: title runs; START (Enter) opens the crossing and the HUD; every lane moves in its direction; the same seed gives the same layout and a different leg a different one (`lanes.ts` imported from the dev server); the hoglet sits in a burrow; no page errors. `npm run build` clean; screenshots of the title and the crossing at both palettes.
2. **First playable.** Hops (keyboard, controller, mouse), road and water deaths, riding, swept off the edge, homes (fill and bump), timer, scoring for new rows, lives, respawn.
   *Verify:* CDP drives the hoglet into a vehicle (life lost), across the road and onto a log (riding x changes), into a home (nest filled, score up).
3. **Full roster.** Diving ducks, lily pads + heron, fox, farmer (warn, chase, honk, leave), field mouse, beetle.
   *Verify:* a dev-hook spawn for each; screenshots; CDP checks that a diving family drops a rider, a honk scores 300, and a mouse escort scores 200.
4. **Structure.** Out and back legs, the night counter, ramp per leg, fox and farmer from night 2, hop combo, extra lives, game over, retry and title.
   *Verify:* a hook fills the homes to skip legs; check the seed repeats on retry, the ramp numbers and the combo maths.
5. **HUD and feedback.** Timer bar, combo chip, banners (behind sprites), sounds, sparks and rings, fireflies, dawn light; prefers-reduced-motion drops shake and flashes.
   *Verify:* screenshots mid-burst (the hoglet and the hazards stay readable); frame time in headless Chrome.
6. **Touch and mobile.** D-pad, HOP, swipe, side-bar layout, landscape overlay, tappable SOUND / RETRY / TITLE (36 CSS px or more), controls hidden on menus.
   *Verify:* CDP touch emulation at 844×390 (corner layout) and 932×390 (side bars); then a real phone (needs you).
7. **Polish.** Fairness check, balance pass from your play, final README and hero screenshot.

## Testing

- Headless Chrome via CDP, Node built-ins only. The shared harness `tools/cdp.mjs` (Vite on its own port, Chrome, `send`/`evaluate`/`until`/`shot`, keys, multi-touch, page-error capture, `check` and exit code) is imported by every `tools/mN-test.mjs`. Run as `node tools/mN-test.mjs . <out-dir>`.
- Dev builds expose the game as `window.__hedgeHogger`. The crossing scene has dev hooks from milestone 1 (set night and leg, snapshot of lanes and hoglet), growing each milestone (place the hoglet, spawn a critter, fill homes, grant points).
- Pure modules (`lanes.ts`, `config.ts`) are tested straight from the dev server with `await import('/src/lanes.ts')`.
- **Fairness:** a time-expanded search over `lanes.ts` (state = position, row, time) with the scene's hop time and collision rules, for nights 1–6 × both legs and every home, with ducks diving and the heron striking. Reports the fastest crossing against the 30 s timer and any layout with no path. The farmer and fox are left out (avoidable by waiting), and the report says so.
- **Balance probe:** the concept sheet's autopilot, ported to drive the real scene. In the mockup it brought 118 hoglets home in 20 simulated minutes and lost 57 lives, mostly on the road: crossable, not proof of fairness.
- Screenshots looked at every milestone. A real phone before touch is called done.

## Open questions

None for v1 (see Decided).

## Status (2026-11-13)

**Part A done and reviewed. Milestone 1 built and verified; waiting for the go-ahead to commit, push and publish.**

- Folder, `tools/sprites.py`, `.gitignore` (includes the playbook) and the concept-sheet template copied. `git init -b main` with the leeeeeroyj identity and SSH command set repo-locally; remote `git@github-leeeeeroyj:leeeeeroyj/hedge-hogger.git` is reachable and empty.
- 13 sprite slots with 8 candidates each in `tools/sprite_slots.json`. Your picks are set as `"chosen"`, and `"mirror": true` marks the picks drawn flipped (everything except lorry, lily, farmer).
- Concept sheet built with a playable mockup at 416×248. Checked in headless Chrome: no console errors, screenshots look right, the demo plays out and back across legs.
- **Milestone 1 (skeleton), built 2026-11-13, not yet committed.** Vite 8 + Phaser 4.2.1 + TypeScript 7 project from Sentinel's files; deploy workflow with `checkout@v7`, `setup-node@v7`, `upload-pages-artifact@v5`, `deploy-pages@v5`. `config.ts` (every tunable), `lanes.ts` (pure: seeded layout, `itemX`, `advance`, `duckState`, `platformAt`, `vehicleAt`), `backdrop.ts` (field baked per palette with the canal rows left clear; logs, narrowboats, hay trailer and headlight beam baked once; canal water and shimmer drawn per frame), `laneView.ts` (lane sprites, shared by title and game; facing from `MIRROR`; diving ducks bob, then vanish), title scene with the lanes running under a veil, crossing scene (both legs, homes, the hoglet waiting in its burrow or nest, dev hooks `setLeg` and `snapshot`), HUD (score, high score, life icons, night and leg with an arrow, device hint, timer bar, tappable speaker), `controls.ts` (confirm, back, mute only), `sfx.ts` (two voices). README with Status, MIT licence, hero screenshot of the dusk crossing.
- **Verified (M1):** `node tools/m1-test.mjs . <out-dir>`: 16/16. Title runs and every sprite loads; Enter opens the crossing and HUD; nine lanes for night 1 out; the hoglet waits in burrow 1; every lane moves its own way at its own speed; same seed same layout, other leg or night different; log, open water and car rules; diving ducks cycle up, warn, under, and under is open water; later legs faster; HUD state; the back leg starts from the nests; Esc returns to the title; no page errors. `npm run build` clean (only Phaser's chunk-size warning). Screenshots of the title, the dusk crossing and the night crossing looked at: facings, headlights, trailers and homes correct.

**Decided**
- **2026-11-13 · Name:** Hedge-Hogger (working title was "The Other Side"). Repo `leeeeeroyj/hedge-hogger`, folder `hedge-hogger/`. Name check: no game or trademark of that name found. The nearest are *HedgeHogers* (an iOS physics puzzler) and *Hedge Huggers* (a GMTK 2024 jam game).
- **2026-11-13 · Farmer:** follows the hoglet across the road and can be honked off it. Night 1 is farmer-free; he joins from night 2, as the fox does.
- **2026-11-13 · Hedges and full homes** bump the hoglet back; they don't kill it.

- **2026-11-13 · Process:** moved to playbook v2: milestone 1 includes publishing (README, licence, Pages, repo settings), every milestone is pushed and live, and tests share `tools/cdp.mjs`.

**Next:** your go-ahead on the milestone 1 file list, then: commit as leeeeeroyj with the Part C checks, push, enable Pages (Actions), repo settings (C5), watch the deploy, check the licence is detected. Then milestone 2.
