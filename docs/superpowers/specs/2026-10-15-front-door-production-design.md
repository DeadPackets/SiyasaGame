# Siyasa front door: production (design)

Turns the picks from the front-door mocks (`2026-10-14-front-door-mocks-design.md`, mock in `docs/mocks/v28`) into what production builds. The flow, copy and behaviour come from `2026-10-13-platform-design.md`. This spec adds the picks and the contract between the front door and the game.

## Owner rulings (2026-10-15)
- Picks: **Landing A (Archive), Build B (Seal), Walkthrough B (on the dimmed board)**.
- Order: this spec first, then sub-project 1 (core game). The front-door code is built together with sub-project 3 (world builds), because the build screen needs the build Workflow and the walkthrough and tutorial need the engine and a real pack.
- The oath is the real oath of that office at that time, in English, written by the build (no search, no original-language text). Invented worlds get an oath in their own society's form.
- The world sets the term (12 to 18 months to its Reckoning). Difficulty presets never change it.
- The tutorial runs slower than play (pace 0.67) and waits on each tooltip before the next animation.
- The music opens with an intro: layers enter one family at a time from the world's month-1 state.

## What is ported from v28
The mock is the reference for layout, copy, motion and keyboard behaviour. Port the behaviour, not the mock's scaffolding.

| Screen | Port from | Keep | Drop |
|---|---|---|---|
| Landing | `index.html`, `landing.js/css`, `bg.js` (variant A) | the prompt box over the living pattern field; one random library skin each visit; "How a term plays"; the library; the 5 prompt states with their copy | variants B and C; `state=` |
| Build screen | `build.html`, `build.js/css` (variant B) | the seal growing ring by ring, one ring for each Workflow step; the presentation queue (one beat holds the stage for at least 1.2 s); "Begin the briefing"; the failure copy and the reason on its own line | variant A; `speed=`; the recorded-timing player (the real Workflow status drives it) |
| Walkthrough | `walk.html`, `walk.js/css` (variant B) | 8 screens over the dimmed board, each lighting the area it explains; "Skip to the board"; difficulty as a segmented control; Custom rules; Vision or Free hand; the pledge (Enter during its timeline only finishes the timeline) | variant A; `s=`; the iframe |
| Guided first month | `board/tutor.js`, the `app.js` gate lines | the 8 steps and their text; Continue gates before each ceremony; pace 0.67; "Skip the tutorial"; "Replay the tutorial" in Settings | `tour=0` |
| Music | `hall/hallsfx.js` | start from the saved Music and Effects volumes; one bus level; the staged intro (bed alone for 2 bars, theme on bar 1 beat 1, pulse at bar 3, the rest at bar 5, a 4 s bus fade-in); the pledge swell | the second copy in `board/hall/` |

## Where it lives
- Landing and build screen are their own pages in `table/client`.
- **The walkthrough and the tutorial are layers on the board page, not an iframe.** The mock's `postMessage({spot, dim})` becomes a direct call into the board.
- One hall engine module for the whole client. The two v28 copies merge into it.
- The `shared/oaths.json` stand-in is not ported. The pack carries the oath, and the build validator rejects a pack without one, so no fallback oath exists.

## Contract with the core game (sub-project 1 builds this)
The board and engine expose these. The front door uses nothing else.

| Hook | Shape | Used by |
|---|---|---|
| Moments | a `moment` event for each of: draw, answers, decided, reveal, filed, hand, played, monthEnd, recap (the names the v28 board emits) | tutorial steps |
| Gates | before each ceremony (reveal, file, unlock, monthEnd, recap) the board awaits `tutorGate(name)`; no tutorial means it does not wait | tutorial Continue |
| Pace | one timescale for ceremonies and calm motion, set by the tutorial to 0.67 and restored after | tutorial |
| Spotlight | `spot(selector \| null)` and `dim(on)` on the board's named areas: place and date, factions, record, resources, seal and hourglass | walkthrough |
| Start | the board opens with the walkthrough's choices: difficulty preset or Custom rules, Vision or none | Take office, Skip to the board |
| Music state | the engine's month state sets the hall levers (grip, growth, tension, crisis, ideologies) | music on all pages |

## Data the front door reads from a pack
Title, polity, date, situation, office (title, holder, oath, oathSource), months and the Reckoning (date, name, meaning), factions with medallions and wants, ideologies with skins, the 4 resources with world names, Visions, skin, music brief, deck count. **No world fact is written in front-door code.**

## Verification
- One keyboard-only E2E run from the landing prompt to the end of tutorial step 8, on a built pack, at 1280x800, with reduced motion on and off. It must give 0 console errors. Its artifact is the screenshots of each screen plus a WAV render of the first 16 bars of music.
- The owner spot-checks the whole flow in Chrome.

## Out of scope
The mock's review tools (`review.html`, `check.py`), Turnstile, caps and the Workflow (sub-project 3), mobile layouts.
