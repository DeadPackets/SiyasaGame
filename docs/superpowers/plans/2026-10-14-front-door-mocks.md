# Siyasa Front Door Mocks Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A clickable front-door flow in `docs/mocks/v28`: landing (3 variants), prompt states, build screen (2 variants), walkthrough with the pledge (2 variants), and the guided first month on the board. It is built on real Egypt build data so the owner can pick one variant per screen.

**Architecture:** There are 4 static pages (`index.html`, `build.html`, `walk.html`, `board/index.html`) sharing 4 small modules in `v28/shared/`: tokens, motion, data and skin. The board is a copy of v27 with one new module, `tutor.js`. The pattern engine and `finish.js` are imported read-only from `docs/mocks/patterns/`. Variants switch by URL parameter.

**Tech Stack:** Plain ES modules, GSAP 3.13 (cdnjs) with v27's named eases, Google Fonts, the shared pattern engine. For verification: Playwright via `uv run --with playwright`.

**Spec:** `docs/superpowers/specs/2026-10-14-front-door-mocks-design.md` (restart worktree). Read it first.

## Global Constraints
- Folder `docs/mocks/v28/`, served at `http://127.0.0.1:8780/v28/` by `python3 -m http.server 8780` run from `docs/mocks`. Untracked; no commits.
- Reuse v27's CSS tokens, GSAP 3.13 with the named eases, and the hall engine by copying them into v28 (v28 may change its copies). The pattern engine and `finish.js` are imported read-only from `docs/mocks/patterns/`; v28 never edits them.
- Data comes only from `docs/mocks/gen/out/egypt-2011-v4/` and the approved skins (`docs/mocks/patterns/final/out/*/opus.json`, `final/worlds.json`, `final/briefs/*.json`). No invented world content. UI copy (buttons, headings) may be written, and follows the copy rules below.
- Copy: Simplified Technical English, no em dashes, address the player as "you".
- Motion (DESIGN.md): every animation eases in and out (settle, swift, soft, sweep); no linear easing, bounce or overshoot; nothing appears or vanishes in one frame. Reduced motion becomes crossfades of 0.5 s or less.
- The board has zero scroll at 1280x800 and up; the landing may scroll below the fold.
- Keyboard: Enter submits the prompt; the arrow keys and Enter drive the walkthrough; Esc skips the current tutorial step; focus is always visible (3 px accent ring).
- Variant parameters: `land=a|b|c`, `state=typing|refused|exists|similar|capped`, `build=a|b`, `speed=real`, `walk=a|b`, `tutor=1`. Default is a; build is compressed to about 25 s unless `speed=real`.
- Testing (owner rule): no unit tests. One Playwright check script (Task 1) is the E2E artifact. Each task ends by running it and passing.
- Agents never dispatch subagents. Make fewer, larger edits.
- Known mock limitation (lead ruling): the board copy keeps v27's hand-written Egypt data, while the build screen and walkthrough use the generated Egypt world, so faction names differ between the walkthrough and the board. Wiring generated packs into the board is sub-project 1 (core game).
- Code-step note: the layout and motion of each screen are design work and are not pre-written here. Each UI step gives the content, data fields, states and checks, and the lead critique of screenshots is the review gate.

## Review Focus
1. A random landing skin with low ink/ground contrast: the prompt text and placeholder must stay at 4.5:1 or better. The skin's palette is run through `correct()` from `patterns/palette.js` (pinned in Task 1, `applySkin`).
2. A world title or faction name longer than the design expects (e.g. "Old Regime (Fulul)", "The Revolution Youth Coalition and the April 6 Youth Movement"): text wraps or uses `short`, and never overflows its box at 1280 px. Pinned in Task 6 by the long-name check in `check.py`.
3. Reduced motion: the flow is complete and usable with `prefers-reduced-motion: reduce` (no animation gates content). Pinned in Task 1, `check.py` reduced-motion pass.
4. Keyboard only: the whole flow from landing to the first tutorial step works without a mouse. Pinned in Task 7, the keyboard walk in `check.py`.
5. WebGL missing or fonts slow: tiles fall back to flat SVG and text renders in the fallback face, with no blank screen. Pinned in Task 1 (`applySkin` awaits `document.fonts.ready` with a 2 s cap) and in the `finish.js` fallback.

---

### Task 1: Shared foundation and the check script

**Files:**
- Create: `docs/mocks/v28/shared/tokens.css`, `docs/mocks/v28/shared/motion.js`, `docs/mocks/v28/shared/data.js`, `docs/mocks/v28/shared/skin.js`
- Create: `docs/mocks/v28/review.html` (an index of every screen and variant link, for the owner and the checker)
- Create: `docs/mocks/v28/check.py`

**Interfaces:**
- Produces:
  - `loadEgypt(): Promise<{world, deck, skin, music, metrics}>`
  - `listWorlds(): Promise<Array<{slug, title, skin}>>`
  - `buildTimeline(metrics): Array<{at: number, step: string, label: string}>`
  - `applySkin(skin, el = document.documentElement): Promise<{tile(id), medallion(id), pal(id)}>`
  - `RM: boolean`; GSAP eases registered as "settle", "swift", "soft" and "sweep".

- [ ] **Step 1: tokens.css.** Copy the `:root` token block, base type (Hanken Grotesk, the three sizes `--t1/--t2/--t3`, root clamp 13 to 16 px), the focus ring and the `@media (prefers-reduced-motion)` rules from `docs/mocks/v27/style.css`. Add `--display` (default "Reem Kufi").

- [ ] **Step 2: motion.js.**
```js
// GSAP 3.13 + CustomEase loaded by each page from cdnjs before this module.
export const RM = matchMedia("(prefers-reduced-motion: reduce)").matches;
const { gsap, CustomEase } = window;
gsap.registerPlugin(CustomEase);
CustomEase.create("settle", ".45,0,.15,1");
CustomEase.create("swift", ".4,0,.2,1");
CustomEase.create("soft", ".37,0,.63,1");
CustomEase.create("sweep", ".87,0,.13,1");
gsap.defaults({ ease: "settle", overwrite: "auto" });
export { gsap };
```

- [ ] **Step 3: data.js.**
```js
const M = new URL("../../", import.meta.url); // docs/mocks/
const get = (p) => fetch(new URL(p, M)).then((r) => { if (!r.ok) throw new Error(`${p}: ${r.status}`); return r.json(); });
const EG = "gen/out/egypt-2011-v4/";

export async function loadEgypt() {
  const [world, deck, skin, music, metrics] = await Promise.all(["world", "deck", "skin", "music.brief", "metrics"].map((f) => get(`${EG}${f}.json`)));
  return { world, deck, skin, music, metrics };
}

export async function listWorlds() {
  const slugs = await get("patterns/final/worlds.json");
  const rows = await Promise.all(slugs.map(async (slug) => {
    try { const [brief, skin] = await Promise.all([get(`patterns/final/briefs/${slug}.json`), get(`patterns/final/out/${slug}/opus.json`)]); return { slug, title: brief.title, skin }; }
    catch { return null; } // a world without an approved skin is left out
  }));
  return rows.filter(Boolean);
}

// Arrival time (s) of each part, from the recorded calls: world first; skin, music, rules and seeds after it; batches after seeds.
export function buildTimeline(metrics) {
  const sum = (re) => metrics.calls.filter((c) => re.test(c.step)).reduce((a, c) => a + (c.seconds || 0), 0);
  const last = (re) => Math.max(0, ...[...new Set(metrics.calls.filter((c) => re.test(c.step)).map((c) => c.step))].map((s) => sum(new RegExp(`^${s}$`))));
  const W = sum(/^world$/), seeds = W + last(/^seeds$/);
  return [
    { at: W, step: "world", label: "The world" },
    { at: W + last(/^skin$/), step: "skin", label: "Its look" },
    { at: W + last(/^music$/), step: "music", label: "Its music" },
    { at: W + last(/^rules-/), step: "rules", label: "Its laws and powers" },
    { at: seeds + last(/^sit-b1$/), step: "month1", label: "Month 1" },
    { at: seeds + last(/^sit-b/), step: "deck", label: "The full deck" },
  ].sort((a, b) => a.at - b.at);
}
```

- [ ] **Step 4: skin.js.**
```js
import { render, renderMedallion, colorize, dataURL } from "../../patterns/engine.js";
import { correct } from "../../patterns/palette.js";

export async function applySkin(skin, el = document.documentElement) {
  const P = correct(skin.palette).palette; // contrast-corrected
  for (const k of ["ground", "panel", "panel2", "ink", "ink2", "line", "accent", "up", "down"]) if (P[k]) el.style.setProperty(`--${k}`, P[k]);
  el.style.setProperty("--display", `"${skin.fonts.display}", serif`);
  const link = document.createElement("link");
  link.rel = "stylesheet";
  link.href = `https://fonts.googleapis.com/css2?family=${skin.fonts.display.replace(/ /g, "+")}:wght@400;600;700&display=swap`;
  document.head.append(link);
  await Promise.race([document.fonts.ready, new Promise((r) => setTimeout(r, 2000))]); // never block on slow fonts
  const by = Object.fromEntries(skin.ideologies.map((x) => [x.id, x]));
  const pal = (id) => ({ a: by[id].a, b: by[id].b, c: by[id].c });
  return {
    pal,
    tile: (id) => { const t = render(by[id].recipe); return { url: dataURL(colorize(t.svg, pal(id))), w: t.w, h: t.h }; },
    medallion: (id) => colorize(renderMedallion({ ...by[id].recipe, emblem: by[id].emblem }).svg, pal(id)),
  };
}
```
If `renderMedallion` returns a different shape, read `docs/mocks/patterns/engine.js:139-160` and adapt only the two return lines.

- [ ] **Step 5: check.py.** A Playwright script that takes a list of URLs (from `review.html`'s links) and checks each:
  - at 1280x800, 1512x982 and 1920x1080: a screenshot to `docs/mocks/v28/shots/<name>-<w>.png`, then collect console errors and failed requests;
  - one pass with `reduced_motion="reduce"` at 1280x800;
  - fail (exit 1) on any console error, any failed request, or (pages with `data-noscroll`) a document taller than the viewport;
  - print a table of url, size, errors and scroll.
  Run with: `uv run --with playwright python docs/mocks/v28/check.py`. Install Chromium once with `uv run --with playwright playwright install chromium`.

- [ ] **Step 6: review.html.** Lists every screen and variant as links, grouped by screen, using the variant parameters from the Global Constraints. `check.py` reads its links.

- [ ] **Step 7: Verify.** Add a temporary test link in review.html to a page that calls `loadEgypt()`, `listWorlds()` and `applySkin()` and prints counts. Run check.py. Expected: 0 errors; `listWorlds()` returns 40 or more worlds; the timeline has 6 entries in rising order. Then remove the temporary link.

---

### Task 2: Landing, variant A (Archive)

**Files:** Create `docs/mocks/v28/index.html`, `docs/mocks/v28/landing.js`, `docs/mocks/v28/landing.css`

**Interfaces:**
- Consumes `listWorlds`, `applySkin`, `gsap`, `RM`.
- Produces `landing.js` exports `renderLanding(variant)`; the page reads `land` and `state` from the URL.

- [ ] **Step 1:** Above the fold:
  - a large text box labelled "What world do you want to rule today?" with its submit button ("Build my world"), the single hottest element;
  - one random world from `listWorlds()` applied by `applySkin`; its title shows quietly as "Today's look: <title>";
  - the background is that world's ideology tiles as a slow living field (copy `bg.js` from v27 and adapt).
- [ ] **Step 2:** Below the fold:
  - "How a term plays" in 3 beats, one line each ("Answer one situation a month.", "Every answer moves the people who care.", "Hold power until the Reckoning."), each with a small moving fragment (a card flip, a support bar easing, the seal ring filling);
  - then the library grid: one card per world in its own skin (title, its 2 strongest ideology medallions), sorted by "newest" with a "most played" toggle. There are no play counts yet, so "most played" uses the list order and says so in a hover tooltip.
- [ ] **Step 3:** Submitting goes to `build.html` with the typed text (carry `build`, `walk` and `speed` through). Enter submits.
- [ ] **Step 4: Verify.** Add the landing A links to review.html, run check.py: 0 errors at all 3 sizes. Lead critique of the screenshots before Task 3.

### Task 3: Landing variants B and C, and the prompt states

**Files:** Modify `landing.js` and `landing.css`.

- [ ] **Step 1:** `land=b`, Wall of seals: the library becomes a ring or wall of world medallions around the text box. Hovering a seal previews that world's skin on the page with a 300 ms soft crossfade; clicking it plays that world (a link to `walk.html?world=<slug>`; the walkthrough falls back to Egypt data for slugs other than egypt-2011).
- [ ] **Step 2:** `land=c`, Cinematic: full-screen ideology flashes (`flash()` from `patterns/flash.js`) cycle every 6 s behind the box, from random worlds. Under `RM` it shows one still tile, no cycling.
- [ ] **Step 3:** Prompt states (`state=`), same layout, shown under the box:
  - **typing:** a hint line ("Try a place and a moment: Cairo, February 2011");
  - **refused:** one line, for example "Siyasa does not build worlds about real private people. Try a place and a time.";
  - **exists:** "This world exists" with the world's card and **Play this world**;
  - **similar:** 3 similar world cards, Play as the primary button and "Build mine anyway" as a quiet text button;
  - **capped:** "New worlds open at 00:00 UTC. You can play any world below."
  Use real worlds from `listWorlds()` for the exists and similar cards.
- [ ] **Step 4: Verify.** Add the links to review.html; run check.py; 0 errors. Lead critique.

### Task 4: Build screen A and B

**Files:** Create `docs/mocks/v28/build.html`, `build.js`, `build.css`

**Interfaces:** Consumes `loadEgypt`, `buildTimeline`, `applySkin`, `gsap`, `RM`. Produces `build.html?prompt=...&build=a|b&speed=real&walk=a|b`.

- [ ] **Step 1:** Clock: real seconds when `speed=real`; otherwise all timeline `at` values are scaled so the last event lands at 25 s. Show the elapsed time and "about N minutes left" (real scale).
- [ ] **Step 2:** The page starts in a neutral skin (v27 tokens, no world colour). On each timeline event:
  - **world:** the title and date type in; the ideologies and factions appear as plain medallions;
  - **skin:** `applySkin` floods colour, pattern and face in with a 1.2 s sweep wipe;
  - **music:** the hall engine (copied into `v28/hall/` from v27) starts the world's `music.brief.json` at -inf, fading to the music bus over 2 s; a mute button shows;
  - **rules:** a count of laws and powers ticks up;
  - **month1:** **Begin the briefing** becomes the hottest element, linking to `walk.html` with params;
  - **deck:** the deck count completes.
  The button is available from the skin event onward.
- [ ] **Step 3:** `build=a` Ledger: a state document whose lines fill in order (a document heading, the clauses as the parts arrive). `build=b` Seal: the seal of state assembles ring by ring (outer ring = the world name, then ideologies, then factions, centre = the month count), using `renderMedallion` tiles.
- [ ] **Step 4:** Add a link `state=failed` that shows the one-line failure ("This world could not be built. Your daily build is returned. Try again or play a world below.").
- [ ] **Step 5: Verify.** Add the links to review.html; run check.py (compressed speed); 0 errors. Lead critique.

### Task 5: Board copy and the guided first month

**Files:** Copy `docs/mocks/v27/*` and `docs/mocks/v27/hall`, `docs/mocks/v27/shared` to `docs/mocks/v28/board/`. Create `docs/mocks/v28/board/tutor.js`. Modify `board/index.html` (one script tag) and `board/app.js` only to emit the events tutor.js needs.

**Interfaces:**
- `board/app.js` dispatches `document.dispatchEvent(new CustomEvent("moment", { detail: { name } }))` with name "draw", "answers", "decided", "reveal", "filed", "hand", "played", "monthEnd" and "recap", at the points where those moments begin.
- `tutor.js` listens for "moment" events.
- `tutor.js` accepts `window.postMessage({ spot: "<css selector>" | null, dim: true | false })` for walkthrough B.

- [ ] **Step 1:** When `tutor=1`:
  1. a step list (draw, read the answers, Decide, the reveal, File, play a card, End month, the recap);
  2. each step lights one target (a spotlight cut-out with a soft edge, everything else dimmed to about 70%);
  3. every other element gets `inert`;
  4. a one-line instruction appears next to the target and never covers it (reuse the tip placement logic from `tip.js`);
  5. "Skip the tutorial" is always visible top right;
  6. Esc skips the current step.
  The step advances on the matching "moment" event.
- [ ] **Step 2:** The postMessage API: `spot` lights a selector with the same spotlight, without `inert`. Used by the walkthrough, variant B.
- [ ] **Step 3: Verify.** Add `board/?tutor=1` to review.html. check.py at 3 sizes: 0 errors, zero scroll (`data-noscroll` on board). Run a scripted pass in check.py that clicks through the 8 tutorial steps on 1280x800 and asserts each step's target is the only non-inert interactive element. Lead critique.

### Task 6: Walkthrough A and B, the pledge

**Files:** Create `docs/mocks/v28/walk.html`, `walk.js`, `walk.css`

**Interfaces:** Consumes `loadEgypt`, `applySkin`, `gsap`, `RM`, and the board postMessage API. Produces navigation to `board/?tutor=1`.

- [ ] **Step 1:** Eight screens, each with **Next** (the hottest element) and "Skip to the board". The arrow keys and Enter move between screens.
  1. **The world:** `world.title`, `world.office.title`, `world.date`, and 2 lines from `world.era_brief`.
  2. **The people:** the factions with medallion, `short`, and one line from `who`.
  3. **The ideas:** the compass corners in order; each ideology's tile flashes once with its name and one line from `stands`.
  4. **Your means:** the 4 resources with world name, role icon and fixed role colour.
  5. **The clock:** `world.reckoning.name` and `meaning`, and the months.
  6. **Difficulty:** 4 presets (Story, Standard, Hard, Brutal) with one line each, and a "Custom rules" link that shows the 5 rules read-only.
  7. **A Vision:** the deck's `visions` as choices, plus "Free hand".
  8. **The pledge:** full screen, the world's display face, the music swelling; the oath text is built from the office, the polity and the chosen Vision ("I, <office holder>, take the seat of <polity> ..."); then **Take office**.
- [ ] **Step 2:** `walk=a`: full-screen slides with a sweep transition. `walk=b`: the board (`board/index.html` in a full-viewport iframe, dimmed) sits behind a panel. Each screen sends `postMessage({spot})` to light the board area it explains: the people → the ledger, the ideas → the record, your means → the resource chips, the clock → the seal and hourglass. Take office removes the dim.
- [ ] **Step 3:** Long names: every faction and title box wraps (`text-wrap: balance`) and never overflows; prefer `short` where present. Add a check.py assertion that no element inside `.walk` has `scrollWidth > clientWidth`.
- [ ] **Step 4: Verify.** Add the links to review.html; check.py: 0 errors, no overflow, at 3 sizes. Lead critique.

### Task 7: Whole-flow check

**Files:** Modify `docs/mocks/v28/check.py`

- [ ] **Step 1:** Add a keyboard-only walk on the default variants at 1280x800, with no mouse:
  1. landing: type "Egypt, February 2011", press Enter;
  2. build (compressed): wait for **Begin the briefing**, Tab to it, press Enter;
  3. walkthrough: press ArrowRight 7 times, Enter on Take office;
  4. assert the tutorial's first step is shown.
  Fail on any console error.
- [ ] **Step 2:** Run the full check.py (every review.html link at 3 sizes, reduced motion, the tutorial pass, the keyboard walk). Expected: 0 failures. Its printed table and `shots/` are the repeatable artifact.
- [ ] **Step 3:** The lead reviews every screenshot and fixes or reports findings before the owner gets the review.html link.
