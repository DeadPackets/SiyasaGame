# Siyasa front door: clickable mocks (design)

Sub-project 4 of Siyasa v1.0, built first (owner, 2026-10-14). This spec covers the **mocks** only: a clickable flow with variants, so the owner can pick a look. A short follow-up spec turns the picks into production code.

Inputs: `2026-10-13-platform-design.md` (landing, prompt path, build steps, walkthrough, guided month), `2026-10-12-card-table-design.md` (the board), DESIGN.md and PRODUCT.md (tokens, motion, copy rules), the v27 mock (`docs/mocks/v27`).

## Owner rulings
- Order of v1.0: front door, then core game, online play, world builds, replay and launch.
- During a build the player **watches the world paint in, then the walkthrough starts** on the arrived world. Target: the walkthrough opens about 5 minutes after the prompt (today's measured 10.5 minutes is a parked generation fix).
- The player is the ruler: every line addresses "you".

## The flow
Landing → prompt states → build screen → walkthrough (8 screens, ending in the pledge) → guided first month on the board.

## Screens and variants
Variants switch by URL parameter; the default is A.

| Screen | Content | Variants (`?param=`) |
|---|---|---|
| Landing | "What world do you want to rule today?" text box as the single focus; each load wears one random built world's skin (display face, palette, ideology pattern, finish); below the fold: "How a term plays" in 3 beats with a moving board fragment, then the library (one card per world in its own skin, sort: most played, newest). | `land=a` Archive: box over the living pattern field. `land=b` Wall of seals: library as medallions around the box. `land=c` Cinematic: full-screen ideology flashes cycle behind the box. |
| Prompt states | Typing; refused (one line, why); exists (Play this world); similar (Play as primary, "Build mine anyway" quiet); daily cap reached ("New worlds open at 00:00 UTC", library stays playable). | one design; `state=` picks each for review |
| Build screen | Starts in a neutral skin. In arrival order: name and date type in; ideologies and factions appear as medallions; the skin floods colour, pattern and face in; music fades up; the deck fills a count. When world and skin exist: **Begin the briefing**. A failed build says so in one line. | `build=a` Ledger: a state document filling line by line. `build=b` Seal: the seal of state assembling ring by ring. `speed=real` plays the recorded timings at 1x; default compresses them to about 25 s. |
| Walkthrough | One idea per screen, Next and "Skip to the board" always: 1 the world, 2 the people, 3 the ideas (each ideology's pattern flashed once), 4 your means (4 resources), 5 the clock (the Reckoning), 6 difficulty (4 presets, Custom behind a link), 7 a Vision or Free hand, 8 the pledge (full screen, the world's face and music), then Take office. | `walk=a` Full-screen slides. `walk=b` On the board: the board is dimmed and each screen lights the area it explains. |
| Guided first month | On the v27 board: draw, read the answers, Decide, the reveal, File, play a card, End month, the recap. One target lit, the rest dimmed and `inert`; "Skip the tutorial" always visible. | one design |

## Data (no invented content)
- World: the complete Egypt build `docs/mocks/gen/out/egypt-2011-v4/` (world, skin, music brief, deck).
- Landing skins and library: the 48 approved Opus skins (`docs/mocks/patterns/final/out/*/opus.json`, `final/coverage/*.json`) with their world titles from `final/worlds.json`.
- Build screen timings: the recorded per-call finish times in `egypt-2011-v4/metrics.json`.
- Copy follows PRODUCT.md: Simplified Technical English, no em dashes, second person.

## Build rules
- Folder `docs/mocks/v28/`, served at `http://127.0.0.1:8780/v28/`. Reuse v27's CSS tokens, GSAP 3.13 with the named eases and the hall engine by copying them into v28 (v28 may change its copies). The pattern engine and `finish.js` are imported read-only from `docs/mocks/patterns/`, the one shared engine; v28 never edits them.
- DESIGN.md motion rules hold: every animation eases in and out; reduced motion becomes crossfades of 0.5 s or less; zero scroll on the board at 1280x800 and up (the landing may scroll below the fold).
- Keyboard: Enter submits the prompt; arrows and Enter drive the walkthrough; Esc skips the tutorial step; focus always visible.
- Untracked like all mocks; no commits.

## Verification
- The lead screenshots every screen and variant at 1280x800, 1512x982 and 1920x1080 and critiques them before the owner sees anything (memory: mock quality).
- 0 console errors across the whole flow; the full flow clicks through end to end with keyboard only.
- The owner picks one variant per screen; the picks go into the production spec.

## Out of scope
Production code, the real build API, Turnstile and caps (sub-project 3), the engine (sub-project 1), mobile layouts.
