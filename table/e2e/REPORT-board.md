# Board on the engine: report

**Verdict: a full Egypt term plays in the browser on the real engine and pack. E2E survived month 16, standing 51.7, 0 console errors. The guided month passes all 8 steps and 4 gates.**

## Files

| File | What it is |
|---|---|
| `table/client/play.html` | The v28 board DOM (Settings now has New term and Abandon term with one confirm; the mock's variant tag is gone) |
| `table/client/src/board/main.js` | The port of `app.js`: view, ceremonies, hand, recap, epilogue, saves, settings, keys, `window.board` |
| `table/client/src/board/seat.js` | Compass, grip dial, seal, standing gauge and coalition, on engine geometry (`marker`, `zone`, `resting`, `standing`, `pillars`) |
| `table/client/src/board/field.js` | The living pattern (`bg.js`), fed by pattern-engine medallion sprites |
| `table/client/src/board/tutor.js` | The guided first month, started by the board; exports the spotlight (`spotlight`, `dimBoard`) |
| `table/client/src/board/jev.js` | The 3 Jev routes, 2.5 s timeout, null means the engine default |
| `table/client/src/board/tip.js` | Tooltips, copied unchanged |
| `table/client/src/board/style.css` | The mock CSS plus: D24 medallions, the epilogue pages, top-bar fitting, the dense hand, column count from the pack |
| `table/client/src/hall/hallsfx.js` | No `window.EGYPT`; the board hands in `E.levers(P, G)` through `leversFrom()`; the staged intro and saved volumes stay |
| `table/client/public/hall/hall.wav` | The hall's room impulse (the hall loads it; it was missing). Untracked; `scripts/setup.sh` copies it, `.gitignore` lists it |
| `table/e2e/play.py` | The E2E (below) |

## How the mock's rules layer maps to the engine

| Mock (stand-in) | Engine |
|---|---|
| `st.held / sup / res / grip / month` | `G.stacks / support / res / grip / month`. The board keeps a display copy that ceremonies move to the event values; `reconcile()` lands anything left |
| One sample card | `shortlist` → Director (2+ cards) → plausibility (history card) → `draw`. A history card that does not happen shows a short note, then the next draw. An empty shortlist calls `pass` |
| Answer prices, greyed answers | `options()` (prices after cost rules; all open with a note when none can be paid) |
| Reveal numbers, grip move, standing line | Jev nudge, then `choose()` events: `move`, `res`, `grip`, `file`, `election`, `unlock`, `offer`, `over` |
| `restOf / inZone / needFor / marker / standing` | `resting / zone / marker / standing` on the display state |
| Pick at 2 (`V.picks`) | `offer` event → pick moment → `takePick(id or null)`; picks chain (one pick can open the next) |
| Power card at 3, law at 5 | `unlock` events (power ceremony; law toast) |
| `canPlay`, `afford`, out-of-zone law | `hand()` `ok` / `why` (`phase`, `plays`, `zone`, `cost`) and `plan()` |
| Telegraph (parsed effect text) | `play()` on a `structuredClone` of the state; Talk is tried on each faction |
| Play, Talk target | `play(id, target)` events; a law played runs the law ceremony |
| Month end: acts, income, drift | `endMonth()` events in order: `act`/`plot`, act moves, drift moves, `res`, band and debt moves, `intent`, `debt`, `month`, `over` |
| Income tooltip | The engine's month-end income rule (balance, producers at `TUNE.produceAt`, band, elections, income rules via `holdsCond`) |
| Reckoning | `G.over`, `pillars`, `divergence`, `G.hist`, holder `fall` and `fates` |
| Music levers | `E.levers(P, G)` |
| Every number in rule text | `TUNE` and `G.rules` (act line, demand line, stack marks, plays, bar); every sentence from the pack or `rulesLine` |

## The epilogue

One page at a time inside the mock's verdict sheet: (1) outcome (Vision fulfilled, Survived, Swept away, Fallen to <holder> with its `fall` text, or fallen at the polls or to debt), the rule line from zone and grip ("Arab Republic of Egypt under a steady pragmatist"; the ideology's `ruler` word without its article), the Vision pillars with values, divergence; (2) the fates (`hi` at 50 or more, else `lo`) of all 9 holders; (3) each history card: "In history" (its `historyAnswer`) beside "In yours" (your answer, "It did not happen.", "It never came."), the full history line in its tooltip. Next, Back, arrow keys, Play again, Choose another world.

## Start, saves, the tutorial, the walkthrough hooks

- URL: `?w=<worldId>` (default `egypt-2011`), `?preset=story|standard|hard|brutal`, `?vision=<id>|free`, `?seed=<n>`, `?tutor=1|0`, `?walk=1`.
- Save: `localStorage["siyasa-save:<worldId>"] = {w, s}` after every engine call; load resumes at the engine's phase (draw, card, pick, plays); a finished term deletes it. Verified: reload in the hand moment gives a byte-equal state.
- Tutorial: on for the first term (`siyasa-tutor-done` unset) on a fresh term; `?tutor=1` forces it on a fresh term; "Skip the tutorial" always shown; "Replay the tutorial" in Settings. Gates `reveal`, `file`, `unlock`, `monthEnd`, `recap`; `moment` events `draw, answers, decided, reveal, filed, hand, played, monthEnd, recap`; `TUTOR_PACE` 0.67.
- Lead's addition: `window.board = { pack, newTerm({rules, vision, seed}), spot(selector|null), dim(on), phase(), playsLeft(), state() }`. `?walk=1` boots the world dimmed, inert and idle (no Draw button, no tutorial, no save resume) until `newTerm` runs; then the guided month starts if it is the first term. Verified: `newTerm({rules: "hard", vision: null, seed: 5})` gives phase `rest`, the board live, the tutorial on, intent line 35, Free hand.

## Gaps and deviations

1. **Played mark dropped.** The engine lets a card be played again in the same month (only the play count limits it), so the mock's "Played" state would be a rule the engine does not have.
2. **A skipped pick does not wait on its stack.** `takePick(null)` gives it up for good, so the button says "Skip: you give up this rule" and the "Pick waiting" pip, badge and reopen-from-stack are gone.
3. **Next card face down** shows its title only when the next card is set (a queued demand or a set card). Otherwise the Director chooses at draw time, so no title is shown.
4. **Grip, backer and centre cards** have no ideology, so they use the neutral seal art; grip and centre picks fly to the seal, not a stack. All rules and laws you hold are listed in the seat view ("Your rules and laws", new).
5. **Top bar at 1280**: pack names are longer than the mock's ("Arab Republic of Egypt", "Maspero Television"). `fitTop()` steps down in order: place and date stack, resource names wrap, resource names move to their tooltips, the Vision name moves to its tooltip, the place name ends in an ellipsis. At 1280 the Egypt resource names are in tooltips.
6. **Money format**: the mock printed "$35B"; the pack gives a unit sentence, not a format, so the board shows "35" and the world's name.
7. **WebGL finish** draws the deck tiles at rest (the hero surface); every other `.fin` surface keeps the mock's CSS light. Field motion numbers (cell, breath, flood speed) are the v28 Egypt values, fixed, because pack skins carry no motion block.
8. **Elections** had no mock ceremony: the vote result is a line on the reveal sheet; a lost vote goes to the epilogue.
9. **Deviation: default Vision** when `?vision` is absent is the Vision of the corner nearest the start marker (the mock always had one). `?vision=free` gives Free hand; the walkthrough passes its own choice.
10. **Mock-only tools dropped**: skin swap, variant keys (P, D, N, X, R), demo keys (E, G, K, L, B), the yellow variant tag. The layout is the owner's picks (home a, record a, seat c, recap a).
11. The coach marks (tour) stay for a player who skips the tutorial; they are off while the tutorial runs and marked done when it ends.
12. Pack years can be BC (Rome `-0044-03`); dates are counted by hand ("May 44 BC").
13. A late hand can hold 14 cards; past "thin" and "tight" a third step, "dense", puts each card on one line with its costs in a row.

## Verification

| Check | Result |
|---|---|
| `cd table && bunx vite build` | passes |
| `bun test engine bots` | 45 pass, 0 fail (the suite now has 45, not 42) |
| E2E term, `play.html?w=egypt-2011&seed=7&tutor=0`, 1280x800, Quick ceremonies, Space skips | **Survived**, month 16 of 16, standing 51.7, 7 picks taken, 0 console errors, no page scroll at any recap |
| E2E tutorial, `tutor=1` | 8 of 8 steps, only the lit target live at each step, gates `reveal, file, monthEnd, recap`, end line shown, board live after |
| Spot checks | Mars and Rome load and draw (Rome: 4-corner compass, 4 columns); Rome with reduced motion, 3 months, 0 errors; walk mode; resume after reload |

Notes: Jev is live on this dev server (`.dev.vars` has the key), so nudges, Director picks and plausibility rolls make the outcome vary between runs. The E2E mutes Vite's hot-reload socket, because other agents edit files in this worktree and a reload mid-term broke two early runs.

Artifacts in `table/e2e/out/`: `result.json`, `month-01.png` to `month-15.png` (month 16 ends in the epilogue), `epilogue-1.png` to `epilogue-3.png`, `tutor-step-1.png` to `tutor-step-8.png`, `tutor-gate-1-reveal.png` to `tutor-gate-4-recap.png`, `tutor-end.png`.

Run: `uv run --with playwright python table/e2e/play.py` from the worktree (about 4 minutes; starts the dev server on :5181 if none is up).
