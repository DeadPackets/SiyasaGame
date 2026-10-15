# Front door in production: report

**Result: E2E 24 of 24 PASS, `bunx vite build` passes, impeccable 29/40 → 30/40 (P0 0, P1 1 → 0).** Nothing is committed.

## Files
| File | What |
|---|---|
| `table/client/index.html` | Landing A markup from `v28/index.html`: variants B and C removed; "Your worlds" section and a Turnstile slot added |
| `table/client/src/front/landing.js` | Landing logic, wired to `/api/worlds`, `/api/worlds/:id`, `/api/mine`, `/api/config` and `/api/prompt` |
| `table/client/src/front/landing.css` | `v28/landing.css` without variants B and C and the play-count tooltip, plus a short production block at the end |
| `table/client/src/front/bg.js` | `v28/bg.js`; only the comments changed |
| `table/client/build.html` | Build B markup (the review-mode label is removed) |
| `table/client/src/front/build.js` | Build B logic, driven by `/api/builds/:id` every 1.5 s |
| `table/client/src/front/build.css` | `v28/build.css` without the A (ledger) block |
| `table/client/src/front/common.js` | Helpers for both pages: escape, month names, play and build URLs, tiles, medallions |
| `table/e2e/front.py` | The E2E script |
| `table/client/public/hall/hall.wav` | Copied from `v28/hall/`. `hallsfx.js` needs it and it was missing. Another agent has since added it to `.gitignore`, so `setup.sh` must supply it |

Shared files: I changed none. The front pages import `shared/*`, `patterns/*`, `hall/hallsfx.js` and `engine/tune.ts`. `TUNE.size` replaces the mock's assumed move sizes in "How a term plays".

## What maps to what
| Mock (v28) | Production |
|---|---|
| `hero`, `seal`, `entrance` (variant A) | The same code. Today's world is a random `/api/worlds` row. Its full pack gives the field, the seal, the sash and the ideology ranking by faction mix |
| `term()` on the fixed Egypt `s02` | Runs on today's world: the first month-1 situation whose first answer moves 3 or more factions |
| `library()` with 48 skins | One card per world from its `card` data, plus a date line. Sort is Newest (`created`) or Most played (server order). Search matches title, polity, date and month name; every word must match |
| `states(?state=)` stand-ins | The real `/api/prompt` answers: refused/invalid → the error line. exists → "Play this world". similar → "Play" plus a quiet "Build mine anyway" (sends `force: true`). spaced/capped → "New worlds open at 00:00 UTC, in N h M min." from `opensAt`. building → `/build.html?b=<id>` |
| `build.js` B view | The same code. frame → title, legend, segments, faction slots. skin → colour sweep, then patterns, then face. music → the hall's staged intro. rules → one stud per Vision. month1 → centre and stamp. deck → the count rolls. done → "Begin the briefing" to `/play.html?w=<id>&walk=1` |
| `plan()`, `speed=`, `t=`, `hold` | Removed. Each part the poll returns becomes a main beat in a queue. Faction names come as filler beats between the main beats. Every beat holds at least 1.2 s, and the done beat waits for the names. The first poll paints with no animation, so a build opened again from "Your worlds" shows its parts at once |
| Clock against the 5-minute target | Elapsed time since the prompt, from sessionStorage or `/api/mine` `created`. After 5 min it says "Taking longer than usual" |
| `?state=failed` | The mock copy, the `error` on its own line, "Try again" (to `/?prompt=…`) and "Play a world from the library" |

## Impeccable critique (brand register)
- **Snapshots:** `.impeccable/critique/2026-10-15T02-54-29Z__table-client-index-html.md` (before) and `…T02-57-44Z…` (after).
- **How it ran:** the two assessments ran one after the other, because this run used no sub-agents.
- **Detector:** the static scan found nothing, because the page renders in JS. The browser detector, injected with Playwright, found 5 items.

| Finding | Severity | Fix |
|---|---|---|
| The Reckoning line cut at the first comma, even inside a number: "enters orbit with 3." | P1 | Now cuts at a comma that is not inside a number, or at the end of a sentence |
| In the closed state, the primary Rule button showed dark text on dark for 200 ms as it got focus | P2 | No transition on `.rule.primary` |
| The next-world and running-build cards used `repeating-linear-gradient` stripes | P2 | Replaced with a quiet accent glow |
| Plates flagged as "cramped" or as clipping a child; body-level "gradient-text" and "X theater" | P3 or false positive | Kept. The plates are deliberate stages, no element uses `background-clip: text`, and no "theater" text is on the page |
| `.t2` line-height is 1.25 | P3 | Kept; it is the shared token |

Score: **29/40 → 30/40**. Help and Documentation went from 2 to 3.

## E2E
Run: `uv run --with playwright python table/e2e/front.py` against `bunx vite --port 5183`.
Last run: 24 PASS, 0 FAIL. Artifact: `table/e2e/out/front/`.

| Check | Result | Screenshots |
|---|---|---|
| Landing at 1280x800, 1920x1080, and 1280x800 with reduced motion | 0 console errors, 0 px horizontal scroll | `landing-*.png` |
| Keyboard prompt through the fake build | "Begin the briefing" at 29.9 s (frame 7.2 s, skin 12.2 s, music 19.7 s, deck 27.5 s) | `build-*.png` |
| "Your worlds" after the build | Links back to the build | – |
| Second prompt from the same browser | Shows the spaced state; the library still plays | `state-spaced.png` |
| Refused, with the real Jev | "Siyasa does not build this world. Try a place and a time." | `state-refused.png` |
| Exists, similar, capped, failed build | Pass on stubbed answers in the real shapes | `state-exists`, `state-similar`, `state-capped`, `build-failed` |

The gate keeps its count in memory. To run again: stop the dev server, delete `table/.wrangler/state/v3/do`, start the server. The asset server drops `.html` from `/build.html?b=` (it becomes `/build?b=`); the script handles that.

## Open gaps
- **The fake build never closes its `builds` row**, so `/api/mine` shows it as "building" for good. The fix is in `prompt.ts` (fake mode); the real Workflow must also set `status`.
- **`parts.frame` lacks faction mix, `who` lines and the opening situation.** So:
  - the seal segments have equal widths;
  - the "point to a faction" line and the situation line are not shown;
  - the patrons count as factions (9 slots for Egypt; the mock had 6).
- **`parts.rules` gives only `{visions}`**, so the row says "6 Visions for your term", not laws and powers.
- **"Begin the briefing" shows only at done**, because the world id comes only then. The mock's early "You can begin now" and "Month 1 is ready" states are not possible.
- **Libraries under 4 worlds:** search and sort are hidden, and a "The next world is yours" card fills the row. The "Try" chips are library titles (as in the mock), so they lead to "exists".
- **Stale docs:** `DESIGN.md` and `PRODUCT.md` describe Congress of Jev. I used the v28 mock as the design source.
- **Turnstile is wired but not tested:** local dev has no site key.
- **`.impeccable/` is new and untracked** in the worktree: the critique tool writes its snapshots there.