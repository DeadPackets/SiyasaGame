# Core game, part 1: the engine, the pack checker and the balance bots

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A pure TypeScript rules engine that plays a full term of any built world pack, a checker that refuses packs play cannot run, and bots that play thousands of terms and report the balance targets.

**Architecture:** `table/engine` holds pure functions over a plain, JSON-safe `State` (no classes, no I/O, no `Math.random`): the client, the Worker (sub-project 2) and the bots all call the same functions. Every rule number sits in `tune.ts`. Jev is not called here: the engine takes nudges, the Director's choice and plausibility as inputs, and the callers use the spec's fallbacks until sub-project 2 wires Jev. `table/bots` loads packs from disk, plays terms and writes a report.

**Tech Stack:** TypeScript 5.9 (strict), Bun 1.4.2 (`bun test`, scripts), no runtime dependencies.

**Spec:** `docs/superpowers/specs/2026-10-12-card-table-design.md` (the rules), amended by `2026-10-13-platform-design.md` (difficulty presets replace Levels; the world sets the term) and `2026-10-15-front-door-production-design.md` (the hooks the board must expose; part 2 builds them on this engine's events). Owner decisions D1 to D44 are in memory `usoj-card-table-decisions.md`.

**Scope:** this is part 1 of sub-project 1. Part 2 (a separate plan, written after this one lands) ports the v27 board in `docs/mocks/v28/board` onto this engine and adds the front-door hooks. Sub-project 1 is done when the owner plays a full Egypt term locally on the board.

## Global Constraints

- All new code lives in `table/` on branch `restart` (worktree `/Users/deadpackets/workspace/UnitedStatesOfJev/.worktrees/restart`). No file of v4 (`src/`, `worker/`, root configs) changes.
- No world fact in code. Code holds game rules; names, numbers and text of a world come from the pack. The only player-facing words in the engine are rule words ("Talk to a faction", "Address the nation", the rules lines of `describe.ts`).
- Every rule number lives in `table/engine/tune.ts` (`TUNE`, `PRESETS`). Balance changes touch only that file, never pack data (owner, 2026-09-27: "Never hand-tune a fixture's lines or supports to make the balance pass").
- Determinism: the same pack, seed and inputs give the same state. The engine never calls `Math.random` or `Date`.
- `State` stays plain JSON (sub-project 2 saves it).
- Tests: scenario tests at the engine's public functions, written before the code they test, and the bots' full-term runs as the end-to-end check. No tests of getters, constructors or framework behaviour. Test code stays shorter than the code under test.
- Comments: none by default; one line at most, only for what code cannot show.
- Copy (rules lines): ASD-STE100 Simplified Technical English, no em dashes, second person.
- Commit after each task on `restart`. Never push. Never commit `.env`, `.dev.vars` or anything under `.superpowers/`. Never use bare `git stash`.

## Rulings (where the spec is silent or superseded)

| # | Ruling | Why |
|---|---|---|
| R1 | Difficulty presets (`story`, `standard`, `hard`, `brutal`) replace the spec's Levels: drift 0.15/0.20/0.20/0.25, intent line 25/30/35/35, act line 10/15/15/20, patron sanctions ×0.5/1/1/2. Custom passes a `Rules` object. | Platform spec (D26, D43). "low" drift has no number in the spec; 0.15 is a starting value the bots tune. |
| R2 | Money under 0 at a month end: every faction −5 and a `debt` event (the client warns); 2 month ends in a row: you fall. No shortage card. | Packs carry no shortage card (D17 parked that question). |
| R3 | A history card rolls when drawn: `rand > plausibility` means it did not happen (set aside, `history` event, draw again). Divergence = history cards that did not happen or were never drawn, plus those answered differently from `historyAnswer`, over all history cards. | Spec "History, callbacks and divergence". |
| R4 | Shortlist weight = a seeded hash of (seed + month, card id) × kind weight (history 1.5, callback and election 1.2, situation 1) × 2 when the card's window closes this month. Top 5. The Director fallback takes the first. Queued cards (intents, `queueNext`) come before the shortlist. | Spec: "shortlists up to 5 by seeded weight"; fallback "the seeded top". |
| R5 | A support condition on a group target (`factions`, `patrons`, `lean:x`) holds when every member meets it. | Silent in spec; "every" is the strict reading. |
| R6 | A `trigger` fires when its condition turns true (an edge), at most once until it turns false again. A `monthEnd` trigger fires at each month end. | Prevents a trigger firing every action. |
| R7 | Talk to a faction targets factions only, not patrons. | The card's name; the tutorial says "Choose the faction". |
| R8 | Each intent card comes at most once a term. | Repeating the same card text reads as a bug. |
| R9 | Music levers port the approved board formula (`docs/mocks/v28/board/hallsfx.js:67-78`): ideology lever = stack/5, not distance to the corner. | The owner approved how the board sounds (2026-10-15). |
| R10 | No Jev in this plan: nudges 0, Director = shortlist[0], plausibility 0.7. | Sub-project 2 wires Jev. |
| R11 | Money has no cap and starts at the pack value (world units, 5 to 40). Force, Voice and Trust run 0 to 10. | The pack's money values are world units. |
| R12 | `check.ts` refuses only what breaks play (references, primitives, counts the rules need, 28 or more situations). Word limits, voice, oath and seeds stay in the build's validator (`docs/mocks/gen/validate.mjs`), which sub-project 3 moves. | The Egypt pack predates the oath field; it must still play. |
| R13 | A size above `l` adds 4 per step (s 4, m 8, l 12, then 16, 20). | `boostNext` and `sizeUp` can stack past `l`. |
| R14 | `exchange(from, to, rate)`: when you lack `to`, you pay the shortfall with `from` at ⌈missing / rate⌉ (rate 0.5 = 2 for 1). | Spec gives no use rule. |
| R15 | Patron grip penalty is linear: 10 × sanctions × |grip − preferred| / 20. | "10 more per 20 grip points away". |
| R16 | Choosing a Vision after Free hand counts as the one switch and costs the same. | One rule, no special case. |
| R18 | When no answer on a card can be paid, every answer opens and takes what you have (down to 0). | Otherwise the month stalls; the spec greys unpayable answers but never says all of them can be. |
| R17 | The Egypt pack and the Mars pack (Opus-medium world, Opus-low deck from the 2026-10-14 eval) are copied into `table/packs/` and committed. | The engine and bots need fixed inputs in the repo. |

## Review Focus

1. The deck runs dry (every eligible card seen): the month goes straight to plays, nothing throws. Test in Task 3.
2. Support, grip and resources stay in range after any action (support and grip 0 to 100; Force, Voice, Trust 0 to 10). The bots assert this after every action in every term. Task 7.
3. Two holders under the act line at the same month end, one of them already plotting: you fall to the plotting one, and the other acts. Test in Task 5.
4. A pick set whose cards are all banned (the combo runs ban parts) gives no offer and does not stall the phase. Test in Task 4.
5. A pack with a different ideology count (3 or 4 corners) still gives zones and resting levels in range. Test in Task 2 builds a 3-corner pack from Egypt.

## File map

| File | Responsibility |
|---|---|
| `table/tsconfig.json` | Strict type-check for `engine` and `bots` |
| `table/packs/egypt-2011/{world,deck,skin,music.brief}.json` | The Egypt pack |
| `table/packs/mars-2091/{world,deck}.json` | The Mars pack (bots only) |
| `table/engine/pack.ts` | Pack types, lookups by id |
| `table/engine/check.ts` | `checkPack`: what play needs |
| `table/engine/tune.ts` | `TUNE`, `PRESETS`, `Rules` |
| `table/engine/state.ts` | `State`, `Ev`, `Outcome`, `newGame`, `rand` |
| `table/engine/geo.ts` | Compass: corners, marker, zone, band, resting, standing |
| `table/engine/rules.ts` | Effects, modifiers, conditions, payment |
| `table/engine/turn.ts` | The month: shortlist, draw, choose, hand, play, picks, month end, Visions, levers |
| `table/engine/describe.ts` | Rules lines from primitives |
| `table/engine/index.ts` | Public exports |
| `table/engine/engine.test.ts` | Scenario tests (grows task by task) |
| `table/bots/load.ts` | Read a pack from `table/packs` |
| `table/bots/bots.ts` | Random, greedy-per-Vision and adaptive bots |
| `table/bots/sim.ts` | `runTerm`: one term, its stats and invariants |
| `table/bots/sim.test.ts` | Every bot finishes terms; a seed replays |
| `table/bots/report.ts` | CLI: the balance targets, `table/bots/out/report.md` |

---

### Task 1: Packs, types and the pack checker

**Files:**
- Create: `table/tsconfig.json`, `table/packs/egypt-2011/*.json`, `table/packs/mars-2091/*.json`, `table/engine/pack.ts`, `table/engine/check.ts`, `table/bots/load.ts`, `table/engine/engine.test.ts`

**Interfaces:**
- Produces: all pack types (`Pack`, `World`, `Deck`, `Holder`, `Card`, `Answer`, `HandDef`, `Effect`, `Cond`, `Vision`, `Pillar`, `Role`, `Res`, `Size`, `Band`, `Mix`, `Move`, `Family`, `CardKind`), `ROLES`, `ONE_SHOT`, `holder(p, id)`, `card(p, id)`, `kindOf(p, id)`, `handDef(p, id)`, `checkPack(p): string[]`, `loadPack(name: "egypt-2011" | "mars-2091"): Pack`.

- [ ] **Step 1: Copy the packs and add the tsconfig**

```bash
cd /Users/deadpackets/workspace/UnitedStatesOfJev/.worktrees/restart
G=/Users/deadpackets/workspace/UnitedStatesOfJev/docs/mocks/gen/out
mkdir -p table/packs/egypt-2011 table/packs/mars-2091 table/engine table/bots
cp $G/egypt-2011-v4/{world,deck,skin,music.brief}.json table/packs/egypt-2011/
cp $G/eval/mars-colony-2091/world-opus-medium/world.json table/packs/mars-2091/world.json
cp $G/eval/mars-colony-2091/deck-opus-low-v2/deck.json table/packs/mars-2091/deck.json
```

`table/tsconfig.json`:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "lib": ["ES2022"],
    "types": ["bun"],
    "strict": true,
    "noEmit": true,
    "skipLibCheck": true,
    "resolveJsonModule": true
  },
  "include": ["engine", "bots"]
}
```

- [ ] **Step 2: Write the failure list, then the failing tests**

Ways the checker can fail: it refuses a good pack; it misses a move to an unknown holder; it lets a modifier into a one-shot card (power, grip, patron cards, answers); it misses a missing law; it lets a history card point at no answer; it misses a flag that no answer sets.

`table/engine/engine.test.ts`:

```ts
import { describe, expect, test } from "bun:test";
import { loadPack } from "../bots/load";
import { checkPack } from "./check";
import type { Pack } from "./pack";

const egypt = loadPack("egypt-2011");
const mars = loadPack("mars-2091");

describe("pack check", () => {
  test.each([["egypt", egypt], ["mars", mars]] as const)("%s is playable", (_, p) => expect(checkPack(p)).toEqual([]));

  const broken = (f: (p: Pack) => void) => { const p = structuredClone(egypt); f(p); return checkPack(p).join("\n"); };
  test.each([
    ["a move to an unknown holder", (p: Pack) => { p.deck.ideologies.nat.power.effects[0] = { op: "move", target: "nobody", dir: "+", size: "s" }; }, "bad move"],
    ["a modifier on a one-shot card", (p: Pack) => { p.deck.ideologies.nat.power.effects.push({ op: "sizeUp", ideology: "nat" }); }, "is a modifier"],
    ["a missing law", (p: Pack) => { delete (p.deck.ideologies.nat as Partial<Pack["deck"]["ideologies"][string]>).law; }, "nat.law: missing"],
    ["a history answer out of range", (p: Pack) => { p.deck.history[0].historyAnswer = 9; }, "historyAnswer"],
    ["a flag no answer sets", (p: Pack) => { p.deck.callbacks[0].requires = ["never-set"]; }, "never set"],
  ])("refuses %s", (_, f, msg) => expect(broken(f)).toContain(msg));
});
```

- [ ] **Step 3: Run the tests to see them fail**

Run: `bun test table/engine`
Expected: FAIL, `Cannot find module '../bots/load'`.

- [ ] **Step 4: Write `pack.ts`**

```ts
export const ROLES = ["money", "force", "voice", "trust"] as const;
export type Role = (typeof ROLES)[number];
export type Res = Partial<Record<Role, number>>;
export type Size = "s" | "m" | "l";
export type Band = "iron" | "middle" | "open";
export type Mix = [string, number][];
export type Move = `${"+" | "-"}${Size}`;

export interface Holder {
  id: string;
  name: string;
  short: string;
  mix: Mix;
  support: number;
  power?: number;
  grip?: number;
  produces: Role;
  act: { text: string; res?: Res; sup?: Record<string, number> };
  fall: string;
  fates: { hi: string; lo: string };
}

export interface World {
  id: string;
  title: string;
  polity: string;
  office: { title: string; holder: string; oath?: string; oathSource?: string };
  date: string;
  months: number;
  reckoning: { date: string; name: string; meaning: string };
  ideologies: { id: string; name: string; ruler: string }[];
  compass: string[];
  marker: Mix;
  grip: number;
  factions: Holder[];
  patrons: Holder[];
  resources: Record<Role, { name: string; icon: string; value: number; unit?: string }>;
  balance: number;
}

export type Cond =
  | { if: "support"; target: string; above?: number; below?: number }
  | { if: "grip"; band: Band }
  | { if: "stack"; ideology: string; min: number }
  | { if: "zone"; zone: string }
  | { if: "monthEnd" };

export type Family = "talk" | "address" | "power" | "law" | "grip" | "patron" | "answers";

export type Effect =
  | { op: "move"; target: string; dir: "+" | "-"; size: Size }
  | { op: "grip"; dir: "open" | "iron"; size: Size }
  | { op: "gain" | "spend"; kind: Role; n: number }
  | { op: "file"; ideology: string; n: number }
  | { op: "boostNext"; ideology: string; steps: number }
  | { op: "hold"; target: string; bound: "floor" | "ceiling"; level: number; months: number }
  | { op: "setFlag"; flag: string }
  | { op: "queueNext"; tag: string }
  | { op: "cancelIntent"; holder: string }
  | { op: "cost"; family: Family; kind: Role; delta: number }
  | { op: "sizeUp"; ideology: string }
  | { op: "drift"; target: string; multiplier: number }
  | { op: "gripRate"; multiplier: number }
  | { op: "extraPlay"; everyNMonths: number }
  | { op: "income"; kind: Role; n: number; when?: Cond }
  | { op: "exchange"; from: Role; to: Role; rate: number }
  | { op: "trigger"; when: Cond; effects: Effect[] };

export const ONE_SHOT: string[] = ["move", "grip", "gain", "spend", "file", "boostNext", "hold", "setFlag", "queueNext", "cancelIntent"];

export interface Answer {
  text: string;
  sub: string;
  ideology: string;
  res?: Res;
  moves: Record<string, Move>;
  reasons: Record<string, string>;
  grip?: Move;
  gripWhy?: string;
  effects?: Effect[];
  flags?: string[];
  holdsElection?: boolean;
}

export interface Card {
  id: string;
  title: string;
  question: string;
  body: string;
  months: [number, number];
  carrier: { name: string; role: string; real: boolean };
  answers: Answer[];
  band?: "iron" | "open";
  zone?: string;
  requires?: string[];
  blocks?: string[];
  holder?: string;
  date?: string;
  history?: string;
  historyAnswer?: number;
}

export interface HandDef { id: string; title: string; flavour: string; cost?: Res; effects: Effect[] }

export type Pillar = { text: string } & (
  | { kind: "stack"; ideology: string; min: number }
  | { kind: "zone"; zone: string }
  | { kind: "grip"; min?: number; max?: number }
  | { kind: "law"; id: string }
  | { kind: "sup"; holder: string; min: number }
  | { kind: "res"; role: Role; min: number }
);

export interface Vision { id: string; name: string; line: string; corner: string; pillars: Pillar[] }

export interface Deck {
  ideologies: Record<string, { power: HandDef; law: HandDef; picks: HandDef[] }>;
  centreLaws: HandDef[];
  picks: Record<"iron" | "open" | "centre", HandDef[]>;
  gripCards: Record<"iron" | "open", HandDef[]>;
  patronCards: Record<string, HandDef>;
  visions: Vision[];
  combos: { name: string; parts: [string, string]; why: string }[];
  intents: Record<string, Card>;
  elections: Card[];
  history: Card[];
  callbacks: Card[];
  situations: Card[];
}

export interface Pack { world: World; deck: Deck }

export type CardKind = "situation" | "history" | "callback" | "election" | "intent";

const INDEX = new WeakMap<Pack, { holders: Map<string, Holder>; cards: Map<string, [Card, CardKind]>; hand: Map<string, HandDef> }>();
function index(p: Pack) {
  let x = INDEX.get(p);
  if (!x) {
    const d = p.deck;
    const tag = (cs: Card[], k: CardKind) => cs.map((c) => [c.id, [c, k]] as const);
    x = {
      holders: new Map([...p.world.factions, ...p.world.patrons].map((h) => [h.id, h])),
      cards: new Map([...tag(d.situations, "situation"), ...tag(d.history, "history"), ...tag(d.callbacks, "callback"), ...tag(d.elections, "election"), ...tag(Object.values(d.intents), "intent")]),
      hand: new Map(
        [...Object.values(d.ideologies).flatMap((i) => [i.power, i.law, ...i.picks]), ...d.centreLaws, ...Object.values(d.picks).flat(), ...Object.values(d.gripCards).flat(), ...Object.values(d.patronCards)].map((c) => [c.id, c]),
      ),
    };
    INDEX.set(p, x);
  }
  return x;
}

export const holder = (p: Pack, id: string): Holder => index(p).holders.get(id) as Holder;
export const card = (p: Pack, id: string): Card => (index(p).cards.get(id) as [Card, CardKind])[0];
export const kindOf = (p: Pack, id: string): CardKind => (index(p).cards.get(id) as [Card, CardKind])[1];
export const handDef = (p: Pack, id: string): HandDef | undefined => index(p).hand.get(id);
```

- [ ] **Step 5: Write `table/bots/load.ts`**

```ts
import { readFileSync } from "node:fs";
import type { Pack } from "../engine/pack";

export function loadPack(name: "egypt-2011" | "mars-2091"): Pack {
  const read = (f: string) => JSON.parse(readFileSync(new URL(`../packs/${name}/${f}`, import.meta.url), "utf8"));
  return { world: read("world.json"), deck: read("deck.json") };
}
```

- [ ] **Step 6: Write `check.ts`** (a port of the play-relevant parts of `docs/mocks/gen/validate.mjs`; it reads untrusted JSON, so it works on loose types)

```ts
import { ONE_SHOT, type Pack, ROLES } from "./pack";

const SIZES = ["s", "m", "l"];
const FAMILIES = ["talk", "address", "power", "law", "grip", "patron", "answers"];
const num = (x: unknown, lo: number, hi: number) => typeof x === "number" && Number.isFinite(x) && x >= lo && x <= hi;
const role = (k: unknown) => (ROLES as readonly unknown[]).includes(k);

// What play needs from a pack. Content and style checks stay in the build's validator.
// biome-ignore lint: the pack is untrusted JSON until this passes
export function checkPack(pack: Pack): string[] {
  const p = pack as any, w = p.world, d = p.deck, e: string[] = [];
  const I: string[] = (w.ideologies ?? []).map((x: any) => x.id);
  const HS: any[] = [...(w.factions ?? []), ...(w.patrons ?? [])], H: string[] = HS.map((x) => x.id);
  const ids = new Set<string>(), flags = new Set<string>(), need: [string, string][] = [], queued: [string, string][] = [];

  if (I.length < 3 || I.length > 5) e.push(`${I.length} ideologies; need 3 to 5`);
  if (w.compass?.length !== I.length || new Set(w.compass).size !== I.length || w.compass.some((id: string) => !I.includes(id))) e.push("compass must list every ideology once");
  if (!Number.isInteger(w.months) || w.months < 12 || w.months > 18) e.push(`months ${w.months}; need 12 to 18`);
  if ((w.factions?.length ?? 0) < 4 || w.factions.length > 6) e.push("need 4 to 6 factions");
  if ((w.patrons?.length ?? 0) < 2 || w.patrons.length > 3) e.push("need 2 to 3 patrons");
  const mix = (m: any, at: string) => {
    if (!Array.isArray(m) || !m.length || m.some((x: any) => !I.includes(x?.[0]) || !num(x?.[1], 0.01, 1)) || Math.abs(m.reduce((a: number, x: any) => a + x[1], 0) - 1) > 0.011) e.push(`${at}: bad mix`);
  };
  mix(w.marker, "marker");
  if (!num(w.grip, 0, 100)) e.push("grip must be 0 to 100");
  for (const h of HS) {
    const pat = w.patrons.includes(h);
    mix(h.mix, h.id);
    if (!num(h.support, 0, 100)) e.push(`${h.id}: support must be 0 to 100`);
    if (!pat && !(Number.isInteger(h.power) && h.power >= 1 && h.power <= 3)) e.push(`${h.id}: power must be 1 to 3`);
    if (pat && !num(h.grip, 0, 100)) e.push(`${h.id}: preferred grip must be 0 to 100`);
    if (!role(h.produces)) e.push(`${h.id}: produces ${h.produces}`);
    for (const [k, v] of Object.entries(h.act?.res ?? {})) if (!role(k) || !num(v, -3, -1)) e.push(`${h.id}: act.res ${k}`);
    for (const [k, v] of Object.entries(h.act?.sup ?? {})) if (!H.includes(k) || !num(v, -5, 5)) e.push(`${h.id}: act.sup ${k}`);
  }
  for (const r of ROLES) if (!num(w.resources?.[r]?.value, -50, 100)) e.push(`resources.${r} needs a start value`);
  if (!num(w.balance, -5, 5)) e.push("balance must be -5 to 5");

  const target = (t: any) => H.includes(t) || ["factions", "patrons", "lowest"].includes(t) || (typeof t === "string" && t.startsWith("lean:") && I.includes(t.slice(5)));
  const cond = (c: any, at: string) => {
    const ok = {
      support: () => target(c.target) && (num(c.above, 0, 100) || num(c.below, 0, 100)),
      grip: () => ["iron", "middle", "open"].includes(c.band),
      stack: () => I.includes(c.ideology) && num(c.min, 1, 20),
      zone: () => c.zone === "centre" || I.includes(c.zone),
      monthEnd: () => true,
    }[c?.if as string];
    if (!ok?.()) e.push(`${at}: bad condition ${JSON.stringify(c)}`);
  };
  const effects = (list: any, at: string, mods: boolean) => {
    if (list == null) return;
    if (!Array.isArray(list)) return e.push(`${at}: effects must be a list`);
    for (const x of list) {
      if (!ONE_SHOT.includes(x?.op) && !mods) { e.push(`${at}: ${x?.op} is a modifier; only one-shot effects here`); continue; }
      const ok = (() => {
        switch (x.op) {
          case "move": return target(x.target) && ["+", "-"].includes(x.dir) && SIZES.includes(x.size);
          case "grip": return ["open", "iron"].includes(x.dir) && SIZES.includes(x.size);
          case "gain": case "spend": return role(x.kind) && num(x.n, 1, 5);
          case "file": return I.includes(x.ideology) && num(x.n, 1, 2);
          case "boostNext": return (x.ideology === "any" || I.includes(x.ideology)) && num(x.steps, 1, 2);
          case "hold": return target(x.target) && ["floor", "ceiling"].includes(x.bound) && num(x.level, 0, 100) && num(x.months, 1, 6);
          case "setFlag": flags.add(x.flag); return typeof x.flag === "string";
          case "queueNext": queued.push([x.tag, at]); return typeof x.tag === "string";
          case "cancelIntent": return H.includes(x.holder);
          case "cost": return FAMILIES.includes(x.family) && role(x.kind) && num(x.delta, -2, 2);
          case "sizeUp": return I.includes(x.ideology);
          case "drift": return target(x.target) && num(x.multiplier, 0, 2);
          case "gripRate": return num(x.multiplier, 0.5, 2);
          case "extraPlay": return num(x.everyNMonths, 2, 99);
          case "income": if (x.when) cond(x.when, at); return role(x.kind) && num(x.n, 1, 2);
          case "exchange": return role(x.from) && role(x.to) && x.from !== x.to && num(x.rate, 0.01, 1);
          case "trigger": cond(x.when, at); effects(x.effects, `${at} trigger`, false); return Array.isArray(x.effects) && x.effects.length > 0;
          default: return false;
        }
      })();
      if (!ok) e.push(`${at}: bad ${x?.op} ${JSON.stringify(x)}`);
    }
  };
  const handCard = (c: any, at: string, mods: boolean) => {
    if (!c?.id) return e.push(`${at}: missing`);
    if (ids.has(c.id)) e.push(`id ${c.id} is used twice`);
    ids.add(c.id);
    for (const [k, v] of Object.entries(c.cost ?? {})) if (!role(k) || !num(v, 1, 5)) e.push(`${c.id}: cost ${k} ${v}`);
    if (!c.effects?.length) e.push(`${c.id}: no effects`);
    effects(c.effects, c.id, mods);
  };
  const pickCard = (c: any, at: string) => {
    handCard(c, at, true);
    for (const x of c?.effects ?? []) if (ONE_SHOT.includes(x?.op)) e.push(`${c.id}: a pick takes modifiers only, not ${x.op}`);
  };
  for (const id of I) {
    const x = d.ideologies?.[id];
    if (!x) { e.push(`deck.ideologies.${id} missing`); continue; }
    handCard(x.power, `${id}.power`, false);
    handCard(x.law, `${id}.law`, true);
    if (x.picks?.length !== 3) e.push(`${id}.picks: need 3`);
    (x.picks ?? []).forEach((m: any, k: number) => pickCard(m, `${id}.picks[${k}]`));
  }
  if (d.centreLaws?.length !== 2) e.push("centreLaws: need 2");
  (d.centreLaws ?? []).forEach((c: any, k: number) => handCard(c, `centreLaws[${k}]`, true));
  for (const set of ["iron", "open", "centre"]) {
    if (d.picks?.[set]?.length !== 3) e.push(`picks.${set}: need 3`);
    (d.picks?.[set] ?? []).forEach((m: any, k: number) => pickCard(m, `picks.${set}[${k}]`));
  }
  for (const set of ["iron", "open"]) {
    if (!d.gripCards?.[set]?.length) e.push(`gripCards.${set}: need 1 or more`);
    (d.gripCards?.[set] ?? []).forEach((c: any, k: number) => handCard(c, `gripCards.${set}[${k}]`, false));
  }
  for (const h of w.patrons ?? []) handCard(d.patronCards?.[h.id], `patronCards.${h.id}`, false);

  const cardCheck = (c: any, at: string) => {
    if (!c?.id) return e.push(`${at}: missing`);
    if (ids.has(c.id)) e.push(`id ${c.id} is used twice`);
    ids.add(c.id);
    if (!(c.months?.[0] >= 1 && c.months[1] >= c.months[0] && c.months[1] <= w.months)) e.push(`${c.id}: months must be inside 1..${w.months}`);
    if (c.band != null && !["iron", "open"].includes(c.band)) e.push(`${c.id}: band ${c.band}`);
    if (c.zone != null && c.zone !== "centre" && !I.includes(c.zone)) e.push(`${c.id}: zone ${c.zone}`);
    for (const f of [...(c.requires ?? []), ...(c.blocks ?? [])]) need.push([f, c.id]);
    if (!(c.answers?.length >= 2 && c.answers.length <= 3)) e.push(`${c.id}: need 2 or 3 answers`);
    (c.answers ?? []).forEach((a: any, k: number) => {
      const aw = `${c.id} answer ${k + 1}`;
      if (!I.includes(a.ideology)) e.push(`${aw}: ideology ${a.ideology}`);
      for (const [r, v] of Object.entries(a.res ?? {})) if (!role(r) || !num(v, -2, 2)) e.push(`${aw}: res ${r} ${v}`);
      for (const [h, v] of Object.entries(a.moves ?? {})) if (!H.includes(h) || !/^[+-][sml]$/.test(String(v))) e.push(`${aw}: move ${h} ${v}`);
      if (a.grip != null && !/^[+-][sml]$/.test(a.grip)) e.push(`${aw}: grip ${a.grip}`);
      effects(a.effects, aw, false);
      for (const f of a.flags ?? []) flags.add(f);
    });
  };
  for (const [sec, lo] of [["situations", 28], ["history", 1], ["callbacks", 0], ["elections", 1]] as const) {
    if ((d[sec]?.length ?? 0) < lo) e.push(`${sec}: ${d[sec]?.length ?? 0}; need at least ${lo}`);
    (d[sec] ?? []).forEach((c: any, k: number) => cardCheck(c, `${sec}[${k}]`));
  }
  for (const c of d.history ?? []) if (!Number.isInteger(c.historyAnswer) || !c.answers?.[c.historyAnswer]) e.push(`${c.id}: historyAnswer must index an answer`);
  for (const c of d.elections ?? []) if (!c.answers?.some((a: any) => a.holdsElection === true)) e.push(`${c.id}: one answer must hold the election`);
  for (const c of d.callbacks ?? []) if (!c.requires?.length) e.push(`${c.id}: a callback must require a flag`);
  for (const h of H) cardCheck(d.intents?.[h], `intents.${h}`);
  for (const [f, at] of need) if (!flags.has(f)) e.push(`${at}: flag ${f} is never set`);
  for (const [id, at] of queued) if (!ids.has(id)) e.push(`${at}: queueNext ${id} does not exist`);

  const laws = new Set([...I.map((i) => d.ideologies?.[i]?.law?.id), ...(d.centreLaws ?? []).map((c: any) => c.id)]);
  if (!(d.visions?.length >= 1)) e.push("need 1 or more Visions");
  for (const v of d.visions ?? []) for (const q of v.pillars ?? []) {
    const ok = {
      stack: () => I.includes(q.ideology) && num(q.min, 1, 20),
      zone: () => q.zone === "centre" || I.includes(q.zone),
      grip: () => num(q.min, 0, 100) || num(q.max, 0, 100),
      law: () => laws.has(q.id),
      sup: () => H.includes(q.holder) && num(q.min, 0, 100),
      res: () => role(q.role) && typeof q.min === "number",
    }[q?.kind as string];
    if (!ok?.()) e.push(`${v.id}: pillar ${JSON.stringify(q)} cannot be checked`);
  }
  for (const c of d.combos ?? []) if (!c.parts?.every((id: string) => ids.has(id))) e.push(`combo ${c.name}: unknown part`);
  return e;
}
```

- [ ] **Step 7: Run the tests and the type-check**

Run: `bun test table/engine && bunx tsc -p table/tsconfig.json`
Expected: 7 pass, 0 fail; tsc prints nothing. If a real pack fails, the checker is wrong or the pack is: compare the message with `node docs/mocks/gen/validate.mjs <dir>` in the main checkout. Never edit the pack to pass.

- [ ] **Step 8: Commit**

```bash
git add table/tsconfig.json table/packs table/engine/pack.ts table/engine/check.ts table/engine/engine.test.ts table/bots/load.ts
git commit -m "Table engine: pack types, the Egypt and Mars packs, and the play checker"
```

---

### Task 2: Rule numbers, the compass and a new game

**Files:**
- Create: `table/engine/tune.ts`, `table/engine/state.ts`, `table/engine/geo.ts`
- Modify: `table/engine/engine.test.ts` (append)

**Interfaces:**
- Consumes: Task 1 types and lookups.
- Produces: `TUNE`, `PRESETS`, `type Preset = keyof typeof PRESETS`, `type Rules = { drift: number; intentUnder: number; actUnder: number; sanctions: number }`; `State`, `Ev`, `Outcome`, `MoveSrc`, `newGame(p, { seed, rules?, vision?, banned? }): State`, `rand(s): number`; `corners(p)`, `point(p, mix)`, `dist(a, b)`, `marker(p, s)`, `zone(p, s): string | null`, `band(grip): Band`, `resting(p, s, id)`, `standing(p, s)`, `clamp(v, lo = 0, hi = 100)`.

- [ ] **Step 1: Write the failure list, then the failing tests**

Ways it can fail: start values do not come from the pack; a preset does not set its 4 rules; a holder far from the marker rests higher than one near it; resting levels leave 0 to 100; a 3-corner world breaks the geometry.

Append to `engine.test.ts`:

```ts
import { marker, resting, zone } from "./geo";
import { newGame } from "./state";
import { PRESETS, type Preset } from "./tune";

describe("new game", () => {
  test("starts from the pack", () => {
    const s = newGame(egypt, { seed: 1 });
    expect(s.support.army).toBe(78);
    expect(s.grip).toBe(65);
    expect(s.res).toEqual({ money: 35, force: 5, voice: 4, trust: 5 });
    expect(zone(egypt, s)).toBe("nat");
  });
  test.each(Object.keys(PRESETS))("preset %s sets the rules", (k) => expect(newGame(egypt, { seed: 1, rules: k as Preset }).rules).toEqual(PRESETS[k as Preset]));
  test.each([["egypt", egypt], ["three corners", (() => {
    const p = structuredClone(egypt), keep = ["nat", "lib", "isl"];
    p.world.compass = keep;
    p.world.ideologies = p.world.ideologies.filter((i) => keep.includes(i.id));
    for (const h of [...p.world.factions, ...p.world.patrons]) h.mix = [[keep[h.id.length % 3], 1]];
    p.world.marker = [["nat", 1]];
    return p;
  })()]] as const)("%s: resting levels stay 0 to 100, highest near the marker", (_, p) => {
    const s = newGame(p, { seed: 1 });
    const r = [...p.world.factions, ...p.world.patrons].map((h) => resting(p, s, h.id));
    for (const v of r) { expect(v).toBeGreaterThanOrEqual(0); expect(v).toBeLessThanOrEqual(100); }
    expect(Number.isFinite(marker(p, s)[0])).toBe(true);
  });
  test("a holder near the marker rests higher than one far from it", () => {
    const s = newGame(egypt, { seed: 1 });
    expect(resting(egypt, s, "army")).toBeGreaterThan(resting(egypt, s, "rev"));
  });
});
```

- [ ] **Step 2: Run them to see them fail**

Run: `bun test table/engine`
Expected: FAIL, `Cannot find module './geo'`.

- [ ] **Step 3: Write `tune.ts`**

```ts
// Every rule number. The bots set the final values; balance changes touch only this file.
export const TUNE = {
  size: { s: 4, m: 8, l: 12 },
  stepAbove: 4,
  gripSize: { s: 5, m: 10, l: 15 },
  nudgeMax: 3,
  startWeight: 4,
  cornerZone: 0.6,
  centreZone: 0.25,
  stack: { pick: 2, power: 3, major: 5 },
  cap: 10,
  plays: 2,
  handCap: 8,
  bar: 50,
  produceAt: 60,
  ironAt: 60,
  openAt: 40,
  pickIron: 80,
  pickOpen: 20,
  ironSqueeze: { under: 30, loss: 2 },
  patronPenalty: { per: 20, loss: 10 },
  debtFactionLoss: 5,
  debtFall: 2,
  talk: { cost: { trust: 1 }, up: 8 },
  address: { cost: { voice: 1 } },
  electionBonus: { voice: 1, trust: 1 },
  patronCardAt: 60,
  visionSwitch: { force: 1, voice: 1, trust: 1 },
  shortlist: 5,
  plausibility: 0.7,
  kindWeight: { history: 1.5, callback: 1.2, election: 1.2, situation: 1, intent: 1 },
};

export type Rules = { drift: number; intentUnder: number; actUnder: number; sanctions: number };

export const PRESETS = {
  story: { drift: 0.15, intentUnder: 25, actUnder: 10, sanctions: 0.5 },
  standard: { drift: 0.2, intentUnder: 30, actUnder: 15, sanctions: 1 },
  hard: { drift: 0.2, intentUnder: 35, actUnder: 15, sanctions: 1 },
  brutal: { drift: 0.25, intentUnder: 35, actUnder: 20, sanctions: 2 },
} satisfies Record<string, Rules>;

export type Preset = keyof typeof PRESETS;
```

- [ ] **Step 4: Write `state.ts`**

```ts
import { type Effect, type Pack, ROLES, type Role } from "./pack";
import { PRESETS, type Preset, type Rules, TUNE } from "./tune";

export type Outcome =
  | { kind: "fallen"; by: string; month: number }
  | { kind: "swept" | "survived" | "fulfilled"; standing: number };

export type MoveSrc = "answer" | "card" | "talk" | "drift" | "act" | "band" | "debt";

export type Ev =
  | { t: "draw"; card: string }
  | { t: "history"; card: string; happened: boolean }
  | { t: "move"; holder: string; delta: number; src: MoveSrc; reason?: string }
  | { t: "grip"; delta: number }
  | { t: "res"; kind: Role; delta: number }
  | { t: "file"; ideology: string; n: number }
  | { t: "unlock"; id: string }
  | { t: "offer"; key: string; ids: string[] }
  | { t: "law"; id: string }
  | { t: "act"; holder: string }
  | { t: "plot"; holder: string }
  | { t: "intent"; holder: string; card: string }
  | { t: "election"; passed: boolean; standing: number }
  | { t: "debt"; months: number }
  | { t: "month"; month: number }
  | { t: "over"; outcome: Outcome };

export interface State {
  seed: number;
  rngN: number;
  rules: Rules;
  month: number;
  phase: "draw" | "answer" | "pick" | "play" | "over";
  card: string | null;
  plays: number;
  support: Record<string, number>;
  grip: number;
  res: Record<Role, number>;
  stacks: Record<string, number>;
  flags: string[];
  seen: string[];
  queue: string[];
  hist: Record<string, { happened: boolean; chose?: number }>;
  boost: { ideology: string; steps: number }[];
  doubleNext: boolean;
  holds: { holder: string; bound: "floor" | "ceiling"; level: number; months: number }[];
  mods: Effect[];
  trig: Record<number, boolean>;
  unlocked: string[];
  laws: string[];
  pickDone: string[];
  picked: string[];
  offer: { key: string; ids: string[] } | null;
  plotting: string[];
  debt: number;
  elected: number;
  vision: string | null;
  switched: boolean;
  banned: string[];
  log: { month: number; card: string; answer: number; ideology: string }[];
  over: Outcome | null;
}

export function newGame(p: Pack, o: { seed: number; rules?: Preset | Rules; vision?: string | null; banned?: string[] }): State {
  const w = p.world;
  return {
    seed: o.seed >>> 0,
    rngN: 0,
    rules: { ...(typeof o.rules === "object" ? o.rules : PRESETS[o.rules ?? "standard"]) },
    month: 1,
    phase: "draw",
    card: null,
    plays: TUNE.plays,
    support: Object.fromEntries([...w.factions, ...w.patrons].map((h) => [h.id, h.support])),
    grip: w.grip,
    res: Object.fromEntries(ROLES.map((r) => [r, w.resources[r].value])) as Record<Role, number>,
    stacks: Object.fromEntries(w.compass.map((id) => [id, 0])),
    flags: [],
    seen: [],
    queue: [],
    hist: {},
    boost: [],
    doubleNext: false,
    holds: [],
    mods: [],
    trig: {},
    unlocked: [],
    laws: [],
    pickDone: [],
    picked: [],
    offer: null,
    plotting: [],
    debt: 0,
    elected: 0,
    vision: o.vision ?? null,
    switched: false,
    banned: o.banned ?? [],
    log: [],
    over: null,
  };
}

// mulberry32 over (seed, counter), so the state stays plain JSON
export function rand(s: State): number {
  let t = (s.seed + Math.imul(0x6d2b79f5, ++s.rngN)) | 0;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
```

- [ ] **Step 5: Write `geo.ts`**

```ts
import { type Band, type Mix, type Pack, holder } from "./pack";
import type { State } from "./state";
import { TUNE } from "./tune";

export type Pt = [number, number];
export const clamp = (v: number, lo = 0, hi = 100) => Math.min(hi, Math.max(lo, v));
export const dist = (a: Pt, b: Pt) => Math.hypot(a[0] - b[0], a[1] - b[1]);

const CORNERS = new WeakMap<Pack, Record<string, Pt>>();
export function corners(p: Pack): Record<string, Pt> {
  let c = CORNERS.get(p);
  if (!c) {
    const n = p.world.compass.length;
    c = Object.fromEntries(p.world.compass.map((id, i) => {
      const a = -Math.PI / 2 + (2 * Math.PI * i) / n;
      return [id, [Math.cos(a), Math.sin(a)] as Pt];
    }));
    CORNERS.set(p, c);
  }
  return c;
}

export function point(p: Pack, mix: Mix): Pt {
  const C = corners(p);
  return mix.reduce<Pt>(([x, y], [id, w]) => [x + w * C[id][0], y + w * C[id][1]], [0, 0]);
}

export function marker(p: Pack, s: State): Pt {
  const C = corners(p), [sx, sy] = point(p, p.world.marker), k = TUNE.startWeight;
  let x = k * sx, y = k * sy, n = k;
  for (const [id, m] of Object.entries(s.stacks)) { x += m * C[id][0]; y += m * C[id][1]; n += m; }
  return [x / n, y / n];
}

export function zone(p: Pack, s: State): string | null {
  const m = marker(p, s);
  if (Math.hypot(m[0], m[1]) <= TUNE.centreZone) return "centre";
  let best: string | null = null, bd = TUNE.cornerZone;
  for (const [id, c] of Object.entries(corners(p))) { const d = dist(m, c); if (d <= bd) { best = id; bd = d; } }
  return best;
}

export const band = (grip: number): Band => (grip >= TUNE.ironAt ? "iron" : grip <= TUNE.openAt ? "open" : "middle");

export function resting(p: Pack, s: State, id: string): number {
  const h = holder(p, id);
  let r = 100 * (1 - dist(marker(p, s), point(p, h.mix)) / 2);
  if (h.grip != null) r -= (TUNE.patronPenalty.loss * s.rules.sanctions * Math.abs(s.grip - h.grip)) / TUNE.patronPenalty.per;
  return clamp(r);
}

export function standing(p: Pack, s: State): number {
  let a = 0, w = 0;
  for (const f of p.world.factions) { a += (f.power ?? 1) * s.support[f.id]; w += f.power ?? 1; }
  return a / w;
}
```

- [ ] **Step 6: Run the tests and the type-check**

Run: `bun test table/engine && bunx tsc -p table/tsconfig.json`
Expected: all pass, tsc silent.

- [ ] **Step 7: Commit**

```bash
git add table/engine
git commit -m "Table engine: rule numbers, presets, the compass and a new game"
```

---

### Task 3: The month's card (shortlist, draw, choose)

**Files:**
- Create: `table/engine/rules.ts`, `table/engine/turn.ts`, `table/engine/index.ts`
- Modify: `table/engine/engine.test.ts` (append)

**Interfaces:**
- Consumes: Tasks 1 and 2.
- Produces (`rules.ts`): `sizeNum(size, steps = 0)`, `targets(p, s, t)`, `moveBy(s, id, d, ev, src, reason?)`, `gripBy(s, d, ev)`, `addRes(s, kind, n, ev)`, `fileTo(s, id, n, ev)`, `modsOf(s, op)`, `costOf(s, family, base)`, `plan(s, price): Res | null`, `pay(s, price, ev)`, `holdsCond(p, s, c)`, `apply(p, s, e, ev, src = "card")`, `runTriggers(p, s, ev, monthEnd = false)`, `hash01(seed, id)`.
- Produces (`turn.ts`): `eligible(p, s): Card[]`, `shortlist(p, s): string[]`, `draw(p, s, id, plausibility = TUNE.plausibility): Ev[]`, `pass(s): void`, `options(p, s): { ok: boolean; price: Res }[]`, `choose(p, s, i, nudge = {}): Ev[]`, and the internal `progress` and `end` that Tasks 4 and 5 extend.
- `index.ts` re-exports `pack`, `check`, `tune`, `state`, `geo`, `turn`, and later `describe`.

- [ ] **Step 1: Write the failure list, then the failing tests**

Ways it can fail: the size or the nudge is not applied, or the nudge is not clamped; grip moves the wrong way; the card files under the wrong stack; Address does not double the changes and the filing; an answer you cannot pay for goes through; a history card that did not happen stays in play; the shortlist offers cards outside their window or more than 5; a callback shows without its flag; a lost election does not end the term; the deck runs dry and the month stalls.

Append:

```ts
import { card } from "./pack";
import { choose, draw, eligible, options, pass, shortlist } from "./turn";

const at = (p: Pack, id: string) => { const s = newGame(p, { seed: 1 }); draw(p, s, id, 1); return s; };

describe("the month's card", () => {
  test("an answer moves holders by size plus a clamped nudge, moves grip and files the card", () => {
    const s = at(egypt, "h01"), a = card(egypt, "h01").answers[0];
    const ev = choose(egypt, s, 0, { army: 9 });
    expect(s.support.army).toBe(78 + 8 + 3);
    expect(s.grip).toBe(65 + 5);
    expect(s.stacks.nat).toBe(1);
    expect(s.phase).toBe("play");
    expect(ev).toContainEqual({ t: "move", holder: "army", delta: 11, src: "answer", reason: a.reasons.army });
  });
  test("Address the nation doubles the next answer and files 2", () => {
    const s = at(egypt, "h01");
    s.doubleNext = true;
    choose(egypt, s, 0);
    expect([s.support.army, s.grip, s.stacks.nat, s.doubleNext]).toEqual([78 + 16, 75, 2, false]);
  });
  test("an answer you cannot pay for is refused while another is open", () => {
    const p = structuredClone(egypt);
    p.deck.history[0].answers[0].res = { trust: -2 };
    p.deck.history[0].answers[1].res = {};
    const s = at(p, "h01");
    s.res.trust = 1;
    expect(options(p, s).map((o) => o.ok).slice(0, 2)).toEqual([false, true]);
    expect(() => choose(p, s, 0)).toThrow();
  });
  test("when no answer can be paid, every answer opens and takes what you have", () => {
    const p = structuredClone(egypt);
    for (const a of p.deck.history[0].answers) a.res = { trust: -2 };
    const s = at(p, "h01");
    s.res.trust = 1;
    choose(p, s, 0);
    expect(s.res.trust).toBe(0);
  });
  test("a history card that does not happen is set aside", () => {
    const s = newGame(egypt, { seed: 1 });
    expect(draw(egypt, s, "h01", 0)).toEqual([{ t: "history", card: "h01", happened: false }]);
    expect(s.phase).toBe("draw");
    expect(shortlist(egypt, s)).not.toContain("h01");
  });
  test("the shortlist holds at most 5 cards, all inside their month window", () => {
    const s = newGame(egypt, { seed: 3 });
    const ids = shortlist(egypt, s);
    expect(ids.length).toBeGreaterThan(0);
    expect(ids.length).toBeLessThanOrEqual(5);
    for (const id of ids) expect(card(egypt, id).months[0]).toBeLessThanOrEqual(1);
  });
  test("a callback waits for its flag", () => {
    const c = egypt.deck.callbacks[0], s = newGame(egypt, { seed: 1 });
    s.month = c.months[0];
    expect(eligible(egypt, s).map((x) => x.id)).not.toContain(c.id);
    s.flags.push(...(c.requires ?? []));
    expect(eligible(egypt, s).map((x) => x.id)).toContain(c.id);
  });
  test("a lost election brings you down", () => {
    const e = egypt.deck.elections[0], s = newGame(egypt, { seed: 1 });
    for (const f of egypt.world.factions) s.support[f.id] = 20;
    draw(egypt, s, e.id);
    choose(egypt, s, e.answers.findIndex((a) => a.holdsElection));
    expect(s.over).toMatchObject({ kind: "fallen", by: "election" });
  });
  test("a month with no card left goes straight to plays", () => {
    const s = newGame(egypt, { seed: 1 });
    s.seen = [...egypt.deck.situations, ...egypt.deck.history, ...egypt.deck.callbacks, ...egypt.deck.elections].map((c) => c.id);
    expect(shortlist(egypt, s)).toEqual([]);
    pass(s);
    expect(s.phase).toBe("play");
  });
});
```

- [ ] **Step 2: Run them to see them fail**

Run: `bun test table/engine`
Expected: FAIL, `Cannot find module './turn'`.

- [ ] **Step 3: Write `rules.ts`**

```ts
import { band, clamp, zone } from "./geo";
import { type Cond, type Effect, type Family, type Pack, ROLES, type Res, type Role, type Size } from "./pack";
import type { Ev, MoveSrc, State } from "./state";
import { TUNE } from "./tune";

const SIZES: Size[] = ["s", "m", "l"];

export function sizeNum(size: Size, steps = 0): number {
  const i = SIZES.indexOf(size) + steps;
  return i <= 2 ? TUNE.size[SIZES[i]] : TUNE.size.l + (i - 2) * TUNE.stepAbove;
}

export function hash01(seed: number, id: string): number {
  let h = (seed ^ 0x811c9dc5) >>> 0;
  for (let i = 0; i < id.length; i++) h = Math.imul(h ^ id.charCodeAt(i), 16777619);
  h ^= h >>> 13;
  h = Math.imul(h, 0x5bd1e995);
  return ((h ^ (h >>> 15)) >>> 0) / 4294967296;
}

export function targets(p: Pack, s: State, t: string): string[] {
  const F = p.world.factions;
  if (t === "factions") return F.map((h) => h.id);
  if (t === "patrons") return p.world.patrons.map((h) => h.id);
  if (t === "lowest") return [F.reduce((a, b) => (s.support[b.id] < s.support[a.id] ? b : a)).id];
  if (t.startsWith("lean:")) {
    const id = t.slice(5);
    return [...F, ...p.world.patrons].filter((h) => [...h.mix].sort((a, b) => b[1] - a[1])[0][0] === id).map((h) => h.id);
  }
  return [t];
}

export function moveBy(s: State, id: string, d: number, ev: Ev[], src: MoveSrc, reason?: string) {
  const from = s.support[id];
  let to = clamp(from + d);
  for (const h of s.holds) {
    if (h.holder !== id) continue;
    if (h.bound === "floor" && d < 0) to = Math.max(to, Math.min(h.level, from));
    if (h.bound === "ceiling" && d > 0) to = Math.min(to, Math.max(h.level, from));
  }
  s.support[id] = to;
  if (to !== from) ev.push(reason ? { t: "move", holder: id, delta: to - from, src, reason } : { t: "move", holder: id, delta: to - from, src });
}

export function modsOf<K extends Effect["op"]>(s: State, op: K) {
  return s.mods.filter((m): m is Extract<Effect, { op: K }> => m.op === op);
}

export function gripBy(s: State, d: number, ev: Ev[]) {
  const from = s.grip;
  s.grip = clamp(from + d * modsOf(s, "gripRate").reduce((a, m) => a * m.multiplier, 1));
  if (s.grip !== from) ev.push({ t: "grip", delta: s.grip - from });
}

export function addRes(s: State, kind: Role, n: number, ev: Ev[]) {
  const from = s.res[kind];
  s.res[kind] = kind === "money" ? from + n : clamp(from + n, 0, TUNE.cap);
  if (s.res[kind] !== from) ev.push({ t: "res", kind, delta: s.res[kind] - from });
}

export function fileTo(s: State, id: string, n: number, ev: Ev[]) {
  s.stacks[id] += n;
  ev.push({ t: "file", ideology: id, n });
}

export function costOf(s: State, family: Family, base: Res): Res {
  const out: Res = { ...base };
  for (const m of modsOf(s, "cost")) if (m.family === family) out[m.kind] = Math.max(0, (out[m.kind] ?? 0) + m.delta);
  for (const k of ROLES) if (!out[k]) delete out[k];
  return out;
}

// What a price really takes, with exchanges covering a shortfall; null when it cannot be paid. Money may go into debt.
export function plan(s: State, price: Res): Res | null {
  const out: Res = { ...price };
  for (const k of ROLES) {
    if (k === "money") continue;
    const miss = (out[k] ?? 0) - s.res[k];
    if (miss <= 0) continue;
    const m = modsOf(s, "exchange").find((x) => x.to === k && (x.from === "money" || s.res[x.from] - (out[x.from] ?? 0) >= Math.ceil(miss / x.rate)));
    if (!m) return null;
    out[k] = s.res[k];
    out[m.from] = (out[m.from] ?? 0) + Math.ceil(miss / m.rate);
  }
  return out;
}

export function pay(s: State, price: Res, ev: Ev[]) {
  const take = plan(s, price);
  if (!take) throw new Error(`cannot pay ${JSON.stringify(price)}`);
  for (const k of ROLES) if (take[k]) addRes(s, k, -(take[k] as number), ev);
}

export function holdsCond(p: Pack, s: State, c: Cond): boolean {
  switch (c.if) {
    case "support": return targets(p, s, c.target).every((h) => (c.above == null || s.support[h] > c.above) && (c.below == null || s.support[h] < c.below));
    case "grip": return band(s.grip) === c.band;
    case "stack": return (s.stacks[c.ideology] ?? 0) >= c.min;
    case "zone": return zone(p, s) === c.zone;
    case "monthEnd": return false;
  }
}

export function apply(p: Pack, s: State, e: Effect, ev: Ev[], src: MoveSrc = "card") {
  switch (e.op) {
    case "move": for (const h of targets(p, s, e.target)) moveBy(s, h, (e.dir === "+" ? 1 : -1) * sizeNum(e.size), ev, src); return;
    case "grip": return gripBy(s, (e.dir === "iron" ? 1 : -1) * TUNE.gripSize[e.size], ev);
    case "gain": return addRes(s, e.kind, e.n, ev);
    case "spend": return addRes(s, e.kind, -e.n, ev);
    case "file": return fileTo(s, e.ideology, e.n, ev);
    case "boostNext": s.boost.push({ ideology: e.ideology, steps: e.steps }); return;
    case "hold": for (const h of targets(p, s, e.target)) s.holds.push({ holder: h, bound: e.bound, level: e.level, months: e.months }); return;
    case "setFlag": if (!s.flags.includes(e.flag)) s.flags.push(e.flag); return;
    case "queueNext": if (!s.queue.includes(e.tag)) s.queue.unshift(e.tag); return;
    case "cancelIntent": { const id = p.deck.intents[e.holder]?.id; s.queue = s.queue.filter((x) => x !== id); return; }
    default: s.mods.push(e);
  }
}

export function runTriggers(p: Pack, s: State, ev: Ev[], monthEnd = false) {
  s.mods.forEach((m, i) => {
    if (m.op !== "trigger") return;
    if (m.when.if === "monthEnd") { if (monthEnd) for (const x of m.effects) apply(p, s, x, ev); return; }
    const now = holdsCond(p, s, m.when);
    if (now && !s.trig[i]) for (const x of m.effects) apply(p, s, x, ev);
    s.trig[i] = now;
  });
}
```

- [ ] **Step 4: Write `turn.ts`**

```ts
import { band, clamp, standing, zone } from "./geo";
import { type Card, type Pack, type Res, type Role, type Size, card, kindOf } from "./pack";
import { addRes, apply, costOf, fileTo, gripBy, hash01, modsOf, moveBy, pay, plan, runTriggers, sizeNum } from "./rules";
import { type Ev, type Outcome, type State, rand } from "./state";
import { TUNE } from "./tune";

export function eligible(p: Pack, s: State): Card[] {
  const m = s.month, b = band(s.grip), z = zone(p, s), seen = new Set(s.seen), d = p.deck;
  return [...d.history, ...d.callbacks, ...d.elections, ...d.situations].filter((c) =>
    !seen.has(c.id) && c.months[0] <= m && m <= c.months[1] && (!c.band || c.band === b) && (!c.zone || c.zone === z) &&
    (c.requires ?? []).every((f) => s.flags.includes(f)) && !(c.blocks ?? []).some((f) => s.flags.includes(f)));
}

export function shortlist(p: Pack, s: State): string[] {
  if (s.phase !== "draw") return [];
  const q = s.queue.find((id) => !s.seen.includes(id));
  if (q) return [q];
  return eligible(p, s)
    .map((c) => ({ id: c.id, w: hash01(s.seed + s.month, c.id) * TUNE.kindWeight[kindOf(p, c.id)] * (c.months[1] === s.month ? 2 : 1) }))
    .sort((a, b) => b.w - a.w)
    .slice(0, TUNE.shortlist)
    .map((x) => x.id);
}

export function draw(p: Pack, s: State, id: string, plausibility = TUNE.plausibility): Ev[] {
  if (s.phase !== "draw") throw new Error(`draw in phase ${s.phase}`);
  s.queue = s.queue.filter((x) => x !== id);
  if (kindOf(p, id) === "history" && rand(s) > plausibility) {
    s.seen.push(id);
    s.hist[id] = { happened: false };
    return [{ t: "history", card: id, happened: false }];
  }
  s.card = id;
  s.phase = "answer";
  return [{ t: "draw", card: id }];
}

export function pass(s: State) {
  if (s.phase !== "draw") throw new Error(`pass in phase ${s.phase}`);
  s.phase = "play";
}

function answerPrice(s: State, res: Card["answers"][number]["res"]) {
  const base = Object.fromEntries(Object.entries(res ?? {}).filter(([, v]) => (v as number) < 0).map(([k, v]) => [k, -(v as number)]));
  return costOf(s, "answers", base);
}

// when no answer can be paid, every answer opens and takes what you have, so a month never stalls
export function options(p: Pack, s: State): { ok: boolean; price: Res; forced?: boolean }[] {
  if (!s.card) return [];
  const all = card(p, s.card).answers.map((a) => { const price = answerPrice(s, a.res); return { ok: plan(s, price) !== null, price }; });
  return all.some((o) => o.ok) ? all : all.map((o) => ({ ...o, ok: true, forced: true }));
}

export function end(s: State, outcome: Outcome, ev: Ev[]): Ev[] {
  s.over = outcome;
  s.phase = "over";
  ev.push({ t: "over", outcome });
  return ev;
}

// unlocks and pick offers; Task 4 fills in the offers
export function progress(p: Pack, s: State, ev: Ev[]) {
  for (const id of p.world.compass) {
    const x = p.deck.ideologies[id];
    for (const [n, c] of [[TUNE.stack.power, x.power], [TUNE.stack.major, x.law]] as const)
      if (s.stacks[id] >= n && !s.unlocked.includes(c.id)) { s.unlocked.push(c.id); ev.push({ t: "unlock", id: c.id }); }
  }
}

function after(p: Pack, s: State, ev: Ev[]) {
  runTriggers(p, s, ev);
  progress(p, s, ev);
}

export function choose(p: Pack, s: State, i: number, nudge: Record<string, number> = {}): Ev[] {
  if (s.phase !== "answer" || !s.card) throw new Error(`choose in phase ${s.phase}`);
  const c = card(p, s.card), a = c.answers[i], o = options(p, s)[i], ev: Ev[] = [];
  if (!a || !o.ok) throw new Error(`answer ${i} cannot be chosen`);
  if (o.forced) for (const [k, v] of Object.entries(o.price)) addRes(s, k as Role, -Math.min(v as number, Math.max(0, s.res[k as Role])), ev);
  else pay(s, o.price, ev);
  for (const [k, v] of Object.entries(a.res ?? {})) if ((v as number) > 0) addRes(s, k as Role, v as number, ev);
  const x = s.doubleNext ? 2 : 1;
  s.doubleNext = false;
  const mine = s.boost.filter((b) => b.ideology === a.ideology || b.ideology === "any");
  s.boost = s.boost.filter((b) => !mine.includes(b));
  const steps = mine.reduce((n, b) => n + b.steps, 0) + modsOf(s, "sizeUp").filter((m) => m.ideology === a.ideology).length;
  for (const [h, mv] of Object.entries(a.moves)) {
    const n = clamp(nudge[h] ?? 0, -TUNE.nudgeMax, TUNE.nudgeMax);
    moveBy(s, h, ((mv[0] === "+" ? 1 : -1) * sizeNum(mv[1] as Size, steps) + n) * x, ev, "answer", a.reasons[h]);
  }
  if (a.grip) gripBy(s, (a.grip[0] === "+" ? 1 : -1) * TUNE.gripSize[a.grip[1] as Size] * x, ev);
  for (const e of a.effects ?? []) apply(p, s, e, ev, "answer");
  for (const f of a.flags ?? []) if (!s.flags.includes(f)) s.flags.push(f);
  fileTo(s, a.ideology, x, ev);
  if (kindOf(p, c.id) === "history") s.hist[c.id] = { happened: true, chose: i };
  s.seen.push(c.id);
  s.log.push({ month: s.month, card: c.id, answer: i, ideology: a.ideology });
  s.card = null;
  s.phase = "play";
  if (a.holdsElection) {
    const st = standing(p, s), passed = st >= TUNE.bar;
    ev.push({ t: "election", passed, standing: st });
    if (!passed) return end(s, { kind: "fallen", by: "election", month: s.month }, ev);
    s.elected++;
  }
  after(p, s, ev);
  return ev;
}
```

(Tidy the imports into one line each when tsc passes; the duplicate `geo` import is only there to keep this block readable.)

`index.ts`:

```ts
export * from "./check";
export * from "./geo";
export * from "./pack";
export * from "./state";
export * from "./tune";
export * from "./turn";
```

- [ ] **Step 5: Run the tests and the type-check**

Run: `bun test table/engine && bunx tsc -p table/tsconfig.json`
Expected: all pass, tsc silent.

- [ ] **Step 6: Commit**

```bash
git add table/engine
git commit -m "Table engine: the month's card, from shortlist to answer"
```

---

### Task 4: The hand, plays, picks and laws

**Files:**
- Modify: `table/engine/turn.ts`, `table/engine/engine.test.ts` (append)

**Interfaces:**
- Consumes: Task 3.
- Produces: `type Kind = "talk" | "address" | "law" | "power" | "grip" | "patron"`, `interface HandCard { id: string; kind: Kind; cost: Res; ok: boolean; why?: "phase" | "plays" | "zone" | "cost"; target: boolean }`, `hand(p, s): HandCard[]` (in display order: Talk, Address, laws, power cards, the rest), `play(p, s, id, target?): Ev[]`, `takePick(p, s, id: string | null): Ev[]`. `progress` now also opens pick offers.

- [ ] **Step 1: Write the failure list, then the failing tests**

Ways it can fail: Talk does not cost Trust or lift by 8; the hand plays before the month's card or past 2 plays; a third card in a stack does not unlock its power card; a second card does not offer its picks, or offers them twice; a major law plays outside its zone; a law can be enacted twice, or its modifiers do not last; a cost modifier or an exchange is ignored; a pick set with every card banned stalls the phase.

Append:

```ts
import { hand, play, takePick } from "./turn";

const playing = (p: Pack = egypt) => { const s = newGame(p, { seed: 1 }); pass(s); return s; };
const slot = (p: Pack, s: ReturnType<typeof newGame>, id: string) => hand(p, s).find((c) => c.id === id);

describe("the hand", () => {
  test("Talk lifts one faction by 8 for 1 Trust and uses a play", () => {
    const s = playing();
    play(egypt, s, "talk", "rev");
    expect([s.support.rev, s.res.trust, s.plays]).toEqual([44, 4, 1]);
  });
  test("the hand waits for the month's card, and 2 plays is the limit", () => {
    const s = newGame(egypt, { seed: 1 });
    expect(hand(egypt, s).every((c) => c.why === "phase")).toBe(true);
    pass(s);
    play(egypt, s, "talk", "rev");
    play(egypt, s, "talk", "rev");
    expect(slot(egypt, s, "talk")?.why).toBe("plays");
  });
  test("3 cards in a stack unlock its power card; 2 offer its picks once", () => {
    const s = at(egypt, "h01");
    s.stacks.nat = 2;
    const ev = choose(egypt, s, 0);
    expect(ev).toContainEqual({ t: "unlock", id: "p-nat" });
    expect(s.offer?.key).toBe("stack:nat");
    expect(s.phase).toBe("pick");
    const id = s.offer!.ids[0];
    takePick(egypt, s, id);
    expect([s.phase, s.picked]).toEqual(["play", [id]]);
    expect(s.offer).toBeNull();
  });
  test("a pick set with every card banned gives no offer", () => {
    const s = newGame(egypt, { seed: 1, banned: egypt.deck.ideologies.nat.picks.map((m) => m.id) });
    draw(egypt, s, "h01", 1);
    s.stacks.nat = 1;
    choose(egypt, s, 0);
    expect([s.offer, s.phase]).toEqual([null, "play"]);
  });
  test("a major law needs its corner's zone", () => {
    const s = playing();
    s.unlocked.push("l-lib");
    s.res = { money: 35, force: 9, voice: 9, trust: 9 };
    s.stacks.lib = 5;
    expect(slot(egypt, s, "l-lib")?.why).toBe("zone");
    s.stacks.lib = 12;
    expect(slot(egypt, s, "l-lib")?.ok).toBe(true);
  });
  test("a law is enacted once and its modifiers last", () => {
    const s = playing();
    s.stacks.nat = 5;
    s.unlocked.push("l-nat");
    play(egypt, s, "l-nat");
    expect(s.laws).toEqual(["l-nat"]);
    expect(slot(egypt, s, "l-nat")).toBeUndefined();
    expect(s.mods).toContainEqual(egypt.deck.ideologies.nat.law.effects.find((e) => e.op === "income"));
  });
  test("a cost modifier changes a price; an exchange covers a shortfall", () => {
    const s = playing();
    s.mods.push({ op: "cost", family: "talk", kind: "trust", delta: -1 });
    expect(slot(egypt, s, "talk")?.cost).toEqual({});
    const t = playing();
    t.res.trust = 0;
    expect(slot(egypt, t, "talk")?.why).toBe("cost");
    t.mods.push({ op: "exchange", from: "voice", to: "trust", rate: 0.5 });
    play(egypt, t, "talk", "rev");
    expect([t.res.voice, t.res.trust]).toEqual([2, 0]);
  });
});
```

- [ ] **Step 2: Run them to see them fail**

Run: `bun test table/engine`
Expected: FAIL, `hand` is not exported.

- [ ] **Step 3: Extend `turn.ts`**

Add `handDef` to the `./pack` import. Replace `progress` and add the hand:

```ts
export function progress(p: Pack, s: State, ev: Ev[]) {
  for (const id of p.world.compass) {
    const x = p.deck.ideologies[id];
    for (const [n, c] of [[TUNE.stack.power, x.power], [TUNE.stack.major, x.law]] as const)
      if (s.stacks[id] >= n && !s.unlocked.includes(c.id)) { s.unlocked.push(c.id); ev.push({ t: "unlock", id: c.id }); }
  }
  while (!s.offer && s.phase !== "over") {
    const z = zone(p, s);
    const key = [
      ...p.world.compass.filter((id) => s.stacks[id] >= TUNE.stack.pick).map((id) => `stack:${id}`),
      ...(s.grip <= TUNE.pickOpen ? ["open"] : []),
      ...(s.grip >= TUNE.pickIron ? ["iron"] : []),
      ...(z === "centre" ? ["centre"] : []),
    ].find((k) => !s.pickDone.includes(k));
    if (!key) return;
    s.pickDone.push(key);
    const set = key.startsWith("stack:") ? p.deck.ideologies[key.slice(6)].picks : p.deck.picks[key as "iron" | "open" | "centre"];
    const ids = set.map((m) => m.id).filter((id) => !s.banned.includes(id)).sort((a, b) => hash01(s.seed, a) - hash01(s.seed, b));
    if (!ids.length) continue;
    s.offer = { key, ids };
    s.phase = "pick";
    ev.push({ t: "offer", key, ids });
  }
}

export function takePick(p: Pack, s: State, id: string | null): Ev[] {
  if (s.phase !== "pick" || !s.offer) throw new Error(`takePick in phase ${s.phase}`);
  if (id !== null) {
    if (!s.offer.ids.includes(id)) throw new Error(`${id} is not offered`);
    s.mods.push(...(handDef(p, id)?.effects ?? []));
    s.picked.push(id);
  }
  s.offer = null;
  s.phase = "play";
  const ev: Ev[] = [];
  after(p, s, ev);
  return ev;
}

export type Kind = "talk" | "address" | "law" | "power" | "grip" | "patron";
export interface HandCard { id: string; kind: Kind; cost: Res; ok: boolean; why?: "phase" | "plays" | "zone" | "cost"; target: boolean }

export function hand(p: Pack, s: State): HandCard[] {
  const z = zone(p, s), b = band(s.grip), d = p.deck, out: HandCard[] = [];
  const add = (id: string, kind: Kind, base: Res, inZone = true) => {
    if (s.banned.includes(id)) return;
    const cost = costOf(s, kind, base);
    const why = s.phase !== "play" ? "phase" : s.plays < 1 ? "plays" : !inZone ? "zone" : plan(s, cost) === null ? "cost" : undefined;
    out.push(why ? { id, kind, cost, ok: false, why, target: kind === "talk" } : { id, kind, cost, ok: true, target: kind === "talk" });
  };
  add("talk", "talk", TUNE.talk.cost);
  add("address", "address", TUNE.address.cost);
  for (const id of p.world.compass) {
    const l = d.ideologies[id].law;
    if (s.unlocked.includes(l.id) && !s.laws.includes(l.id)) add(l.id, "law", l.cost ?? {}, z === id);
  }
  if (z === "centre") for (const l of d.centreLaws) if (!s.laws.includes(l.id)) add(l.id, "law", l.cost ?? {});
  for (const id of p.world.compass) { const c = d.ideologies[id].power; if (s.unlocked.includes(c.id)) add(c.id, "power", c.cost ?? {}); }
  if (b !== "middle") for (const c of d.gripCards[b]) add(c.id, "grip", c.cost ?? {});
  for (const h of p.world.patrons) { const c = d.patronCards[h.id]; if (c && s.support[h.id] >= TUNE.patronCardAt) add(c.id, "patron", c.cost ?? {}); }
  return out;
}

export function play(p: Pack, s: State, id: string, target?: string): Ev[] {
  const h = hand(p, s).find((x) => x.id === id);
  if (!h?.ok) throw new Error(`cannot play ${id}: ${h?.why ?? "not in hand"}`);
  if (id === "talk" && !p.world.factions.some((f) => f.id === target)) throw new Error("Talk needs a faction");
  const ev: Ev[] = [];
  pay(s, h.cost, ev);
  s.plays--;
  if (id === "talk") moveBy(s, target as string, TUNE.talk.up, ev, "talk");
  else if (id === "address") s.doubleNext = true;
  else {
    for (const e of handDef(p, id)?.effects ?? []) apply(p, s, e, ev);
    if (h.kind === "law") { s.laws.push(id); ev.push({ t: "law", id }); }
  }
  after(p, s, ev);
  return ev;
}
```

- [ ] **Step 4: Run the tests and the type-check**

Run: `bun test table/engine && bunx tsc -p table/tsconfig.json`
Expected: all pass, tsc silent.

- [ ] **Step 5: Commit**

```bash
git add table/engine
git commit -m "Table engine: the hand, plays, picks and laws"
```

---

### Task 5: Month end, falls, the Reckoning, Visions and music levers

**Files:**
- Modify: `table/engine/turn.ts`, `table/engine/engine.test.ts` (append)

**Interfaces:**
- Consumes: Tasks 3 and 4.
- Produces: `endMonth(p, s): Ev[]`, `pillars(p, s, visionId): boolean[]`, `switchVision(p, s, id): Ev[]`, `divergence(p, s): number`, `levers(p, s): Record<string, number>` (keys: `grip`, `tension`, `crisis`, `growth` and each ideology id; values 0 to 1).

- [ ] **Step 1: Write the failure list, then the failing tests**

Ways it can fail: drift runs before the act; a holder that was plotting does not bring you down; two holders under the line at once act in the wrong order; debt does not cost the factions or does not end the term at 2; an intent is not queued or comes twice; the Reckoning names the wrong outcome; the Vision switch is free or repeatable.

Append:

```ts
import { endMonth, pillars, switchVision } from "./turn";

describe("month end", () => {
  test("a holder under the act line acts before drift; still under next month, it brings you down", () => {
    const s = playing();
    s.support.rev = 10;
    const ev = endMonth(egypt, s);
    const act = ev.findIndex((e) => e.t === "act" && e.holder === "rev"), drift = ev.findIndex((e) => e.t === "move" && e.src === "drift");
    expect(act).toBeGreaterThanOrEqual(0);
    expect(act).toBeLessThan(drift);
    expect(s.plotting).toContain("rev");
    pass(s);
    s.support.rev = 10;
    s.support.fel = 10;
    endMonth(egypt, s);
    expect(s.over).toEqual({ kind: "fallen", by: "rev", month: 2 });
  });
  test("debt costs every faction 5, and 2 month ends in debt bring you down", () => {
    const s = playing();
    s.res.money = -10;
    const ev = endMonth(egypt, s);
    expect(ev.filter((e) => e.t === "move" && e.src === "debt")).toHaveLength(egypt.world.factions.length);
    expect(s.debt).toBe(1);
    pass(s);
    endMonth(egypt, s);
    expect(s.over).toMatchObject({ kind: "fallen", by: "debt" });
  });
  test("a faction under the intent line brings its intent next month, once", () => {
    const s = playing();
    s.support.fel = 18;
    endMonth(egypt, s);
    expect(shortlist(egypt, s)).toEqual([egypt.deck.intents.fel.id]);
    draw(egypt, s, egypt.deck.intents.fel.id);
    choose(egypt, s, 0);
    s.support.fel = 18;
    endMonth(egypt, s);
    expect(s.queue).not.toContain(egypt.deck.intents.fel.id);
  });
  test.each([
    ["swept", 20, false],
    ["survived", 90, false],
    ["fulfilled", 90, true],
  ] as const)("the Reckoning: %s", (kind, sup, meet) => {
    const s = playing();
    s.vision = "v1";
    s.month = egypt.world.months;
    for (const f of egypt.world.factions) s.support[f.id] = sup;
    if (meet) { s.stacks.nat = 5; s.laws.push("l-nat"); s.grip = 65; }
    endMonth(egypt, s);
    expect(s.over?.kind).toBe(kind);
    if (meet) expect(pillars(egypt, s, "v1").every(Boolean)).toBe(true);
  });
  test("you switch Vision once, and it costs 1 Force, 1 Voice and 1 Trust", () => {
    const s = playing();
    switchVision(egypt, s, "v2");
    expect([s.vision, s.res.force, s.res.voice, s.res.trust]).toEqual(["v2", 4, 3, 4]);
    expect(() => switchVision(egypt, s, "v3")).toThrow();
  });
});
```

(The Reckoning test leans on Egypt's Vision `v1`: stack nat 5, law `l-nat`, Armed Forces 70 or more, grip 60 or more. The `pillars(...).every` line guards that assumption.)

- [ ] **Step 2: Run them to see them fail**

Run: `bun test table/engine`
Expected: FAIL, `endMonth` is not exported.

- [ ] **Step 3: Extend `turn.ts`**

Add `resting` to the `geo` import and `holdsCond` and `targets` to the `rules` import, then:

```ts
export function pillars(p: Pack, s: State, id: string): boolean[] {
  const v = p.deck.visions.find((x) => x.id === id);
  if (!v) return [];
  const z = zone(p, s);
  return v.pillars.map((q) => {
    switch (q.kind) {
      case "stack": return s.stacks[q.ideology] >= q.min;
      case "zone": return z === q.zone;
      case "grip": return (q.min == null || s.grip >= q.min) && (q.max == null || s.grip <= q.max);
      case "law": return s.laws.includes(q.id);
      case "sup": return s.support[q.holder] >= q.min;
      case "res": return s.res[q.role] >= q.min;
    }
  });
}

export function switchVision(p: Pack, s: State, id: string): Ev[] {
  if (s.switched || s.phase === "over" || !p.deck.visions.some((v) => v.id === id)) throw new Error(`cannot switch to ${id}`);
  const ev: Ev[] = [];
  pay(s, TUNE.visionSwitch, ev);
  s.vision = id;
  s.switched = true;
  return ev;
}

export function divergence(p: Pack, s: State): number {
  const H = p.deck.history;
  return H.filter((c) => { const h = s.hist[c.id]; return !h?.happened || h.chose !== c.historyAnswer; }).length / H.length;
}

const driftMult = (p: Pack, s: State, id: string) =>
  modsOf(s, "drift").filter((m) => targets(p, s, m.target).includes(id)).reduce((a, m) => a * m.multiplier, 1);

export function endMonth(p: Pack, s: State): Ev[] {
  if (s.phase !== "play") throw new Error(`endMonth in phase ${s.phase}`);
  const ev: Ev[] = [], w = p.world, R = s.rules, H = [...w.factions, ...w.patrons];
  const under = H.filter((h) => s.support[h.id] < R.actUnder);
  const fall = under.find((h) => s.plotting.includes(h.id));
  if (fall) return end(s, { kind: "fallen", by: fall.id, month: s.month }, ev);
  for (const h of under) {
    ev.push({ t: "act", holder: h.id });
    for (const [k, v] of Object.entries(h.act.res ?? {})) addRes(s, k as Role, v as number, ev);
    for (const [id, v] of Object.entries(h.act.sup ?? {})) moveBy(s, id, v, ev, "act");
    ev.push({ t: "plot", holder: h.id });
  }
  s.plotting = under.map((h) => h.id);
  for (const h of H) moveBy(s, h.id, (resting(p, s, h.id) - s.support[h.id]) * R.drift * driftMult(p, s, h.id), ev, "drift");

  const b = band(s.grip), inc: Partial<Record<Role, number>> = {};
  const add = (k: Role, n: number) => { inc[k] = (inc[k] ?? 0) + n; };
  for (const h of H) if (s.support[h.id] >= TUNE.produceAt) add(h.produces, 1);
  if (b === "iron") add("force", 1);
  if (b === "open") add("voice", 1);
  add("money", w.balance);
  if (s.elected) { add("voice", s.elected * TUNE.electionBonus.voice); add("trust", s.elected * TUNE.electionBonus.trust); }
  for (const m of modsOf(s, "income")) if (!m.when || m.when.if === "monthEnd" || holdsCond(p, s, m.when)) add(m.kind, m.n);
  for (const [k, n] of Object.entries(inc)) addRes(s, k as Role, n as number, ev);

  if (s.res.money < 0) {
    s.debt++;
    ev.push({ t: "debt", months: s.debt });
    if (s.debt >= TUNE.debtFall) return end(s, { kind: "fallen", by: "debt", month: s.month }, ev);
    for (const f of w.factions) moveBy(s, f.id, -TUNE.debtFactionLoss, ev, "debt");
  } else s.debt = 0;
  if (b === "iron") for (const f of w.factions) if (s.support[f.id] < TUNE.ironSqueeze.under) moveBy(s, f.id, -TUNE.ironSqueeze.loss, ev, "band");
  s.holds = s.holds.map((h) => ({ ...h, months: h.months - 1 })).filter((h) => h.months > 0);
  runTriggers(p, s, ev, true);

  for (const h of [...H].sort((a, c) => s.support[a.id] - s.support[c.id])) {
    const c = p.deck.intents[h.id];
    if (c && s.support[h.id] < R.intentUnder && !s.seen.includes(c.id) && !s.queue.includes(c.id)) {
      s.queue.push(c.id);
      ev.push({ t: "intent", holder: h.id, card: c.id });
    }
  }

  if (s.month >= w.months) {
    const st = standing(p, s);
    const kind = st < TUNE.bar ? "swept" : s.vision && pillars(p, s, s.vision).every(Boolean) ? "fulfilled" : "survived";
    return end(s, { kind, standing: st }, ev);
  }
  s.month++;
  s.phase = "draw";
  s.card = null;
  s.plays = TUNE.plays + modsOf(s, "extraPlay").filter((m) => s.month % m.everyNMonths === 0).length;
  ev.push({ t: "month", month: s.month });
  return ev;
}

// ported from the approved board (docs/mocks/v28/board/hallsfx.js:67-78)
export function levers(p: Pack, s: State): Record<string, number> {
  const home = p.world.factions.map((f) => s.support[f.id]);
  const avg = home.reduce((a, b) => a + b, 0) / home.length, low = Math.min(...home);
  const total = Object.values(s.stacks).reduce((a, b) => a + b, 0), c = (v: number) => clamp(v, 0, 1);
  return {
    grip: s.grip / 100,
    tension: c((45 - avg) / 15),
    crisis: c((18 - low) / 8),
    growth: c((0.5 * (s.month - 1)) / Math.max(1, p.world.months - 1) + 0.3 * Math.min(1, total / 12) + (0.2 * avg) / 100),
    ...Object.fromEntries(p.world.compass.map((id) => [id, c(s.stacks[id] / 5)])),
  };
}
```

- [ ] **Step 4: Run the tests and the type-check**

Run: `bun test table/engine && bunx tsc -p table/tsconfig.json`
Expected: all pass, tsc silent.

- [ ] **Step 5: Commit**

```bash
git add table/engine
git commit -m "Table engine: month end, falls, the Reckoning, Visions and music levers"
```

---

### Task 6: Rules lines from primitives

**Files:**
- Create: `table/engine/describe.ts`
- Modify: `table/engine/index.ts` (export it), `table/engine/engine.test.ts` (append)

**Interfaces:**
- Consumes: pack lookups, `sizeNum`, `TUNE`.
- Produces: `describe(p, e: Effect): string` (empty for `setFlag`), `rulesLine(p, def: HandDef): string`.

- [ ] **Step 1: Write the failure list, then the failing test**

Ways it can fail: a primitive has no line (empty, "undefined" or "NaN"); a line grows past 25 words; a group target reads as an id.

Append:

```ts
import { describe as line } from "./describe";
import type { Effect } from "./pack";

describe("rules lines", () => {
  const every = (p: Pack): Effect[] => {
    const d = p.deck, hands = [...Object.values(d.ideologies).flatMap((i) => [i.power, i.law, ...i.picks]), ...d.centreLaws, ...Object.values(d.picks).flat(), ...Object.values(d.gripCards).flat(), ...Object.values(d.patronCards)];
    const answers = [...d.situations, ...d.history, ...d.callbacks, ...d.elections, ...Object.values(d.intents)].flatMap((c) => c.answers.flatMap((a) => a.effects ?? []));
    return [...hands.flatMap((h) => h.effects), ...answers];
  };
  test.each([["egypt", egypt], ["mars", mars]] as const)("%s: every effect reads as a short line", (_, p) => {
    for (const e of every(p)) {
      const s = line(p, e);
      if (e.op === "setFlag") continue;
      expect(s).not.toMatch(/undefined|NaN|lean:|\[object/);
      expect(s.length).toBeGreaterThan(5);
      expect(s.split(/\s+/).length).toBeLessThanOrEqual(25);
    }
  });
});
```

- [ ] **Step 2: Run it to see it fail**

Run: `bun test table/engine`
Expected: FAIL, `Cannot find module './describe'`.

- [ ] **Step 3: Write `describe.ts`**

```ts
import { type Cond, type Effect, type HandDef, type Pack, type Role, card, holder } from "./pack";
import { sizeNum } from "./rules";
import { TUNE } from "./tune";

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
const FAMILY = { talk: "Talk", address: "Address", power: "power cards", law: "laws", grip: "grip cards", patron: "backer cards", answers: "answers" };

export function describe(p: Pack, e: Effect): string {
  const res = (k: Role) => p.world.resources[k].name;
  const ideo = (id: string) => p.world.ideologies.find((i) => i.id === id)?.name ?? id;
  const who = (t: string) =>
    t === "factions" ? "every faction" : t === "patrons" ? "every foreign backer" : t === "lowest" ? "the weakest faction"
    : t.startsWith("lean:") ? `every holder near ${ideo(t.slice(5))}` : holder(p, t).short;
  const pct = (m: number) => `${Math.round(Math.abs(1 - m) * 100)}%`;
  const when = (c: Cond, lead: string): string => {
    switch (c.if) {
      case "support": return `${lead} ${who(c.target)} ${c.target.startsWith("lean:") || ["factions", "patrons"].includes(c.target) ? "are" : "is"} ${c.above != null ? `above ${c.above}` : `below ${c.below}`}`;
      case "grip": return `${lead} grip is ${cap(c.band)}`;
      case "stack": return `${lead} you have ${c.min} or more ${ideo(c.ideology)} cards`;
      case "zone": return `${lead} you stand in ${c.zone === "centre" ? "the Pragmatist centre" : `the ${ideo(c.zone)} zone`}`;
      case "monthEnd": return "at each month end";
    }
  };
  switch (e.op) {
    case "move": return `${cap(who(e.target))} ${e.dir}${sizeNum(e.size)}.`;
    case "grip": return `Grip ${e.dir === "iron" ? "+" : "-"}${TUNE.gripSize[e.size]}, toward ${e.dir === "iron" ? "Iron" : "Open"}.`;
    case "gain": return `Get ${e.n} ${res(e.kind)}.`;
    case "spend": return `Pay ${e.n} ${res(e.kind)}.`;
    case "file": return `File ${e.n} card${e.n > 1 ? "s" : ""} under ${ideo(e.ideology)}.`;
    case "boostNext": return `Your next ${e.ideology === "any" ? "" : `${ideo(e.ideology)} `}answer moves support ${e.steps} size${e.steps > 1 ? "s" : ""} more.`;
    case "hold": return `${cap(who(e.target))} cannot go ${e.bound === "floor" ? "below" : "above"} ${e.level} for ${e.months} month${e.months > 1 ? "s" : ""}.`;
    case "setFlag": return "";
    case "queueNext": return `Next month's card: ${card(p, e.tag)?.title ?? "a set card"}.`;
    case "cancelIntent": return `${holder(p, e.holder).short} drops its demand.`;
    case "cost": return `${cap(FAMILY[e.family])} cost ${Math.abs(e.delta)} ${e.delta < 0 ? "less" : "more"} ${res(e.kind)}.`;
    case "sizeUp": return `${ideo(e.ideology)} answers move support 1 size more.`;
    case "drift": return e.multiplier === 0 ? `${cap(who(e.target))}: support does not drift.` : `${cap(who(e.target))}: support drifts ${pct(e.multiplier)} ${e.multiplier < 1 ? "slower" : "faster"}.`;
    case "gripRate": return `Grip moves ${pct(e.multiplier)} ${e.multiplier < 1 ? "slower" : "faster"}.`;
    case "extraPlay": return `1 more play every ${e.everyNMonths} months.`;
    case "income": return `Get ${e.n} ${res(e.kind)} a month${e.when ? `, ${when(e.when, "while")}` : ""}.`;
    case "exchange": return `Pay missing ${res(e.to)} with ${res(e.from)}, ${Math.ceil(1 / e.rate)} for 1.`;
    case "trigger": return `${cap(when(e.when, "when"))}: ${e.effects.map((x) => describe(p, x)).filter(Boolean).join(" ")}`;
  }
}

export const rulesLine = (p: Pack, def: HandDef) => def.effects.map((e) => describe(p, e)).filter(Boolean).join(" ");
```

(`card(p, id)` returns `undefined` for an unknown id at runtime; the checker already refuses an unknown `queueNext`.)

Add `export * from "./describe";` to `index.ts`.

- [ ] **Step 4: Run the tests and the type-check**

Run: `bun test table/engine && bunx tsc -p table/tsconfig.json`
Expected: all pass, tsc silent. If a Mars `drift` or `trigger` line runs past 25 words, shorten the template, not the test.

- [ ] **Step 5: Commit**

```bash
git add table/engine
git commit -m "Table engine: rules lines written from primitives"
```

---

### Task 7: Bots, the term runner and the report

**Files:**
- Create: `table/bots/bots.ts`, `table/bots/sim.ts`, `table/bots/sim.test.ts`, `table/bots/report.ts`, `table/bots/out/.gitignore` (content: `*.json` and `baseline.md`, one per line)

**Interfaces:**
- Consumes: the whole engine through `../engine` (index).
- Produces: `interface Bot { name: string; vision(p, s): string | null; answer(p, s): number; pick(p, s): string | null; play(p, s): { id: string; target?: string } | null }`, `randomBot(seed)`, `greedyBot(vision: string | null)`, `adaptiveBot()`, `progressOf(p, s, visionId): number` (0 to 1), `runTerm(p, bot, seed, opts?: { rules?: Preset; banned?: string[] }): TermResult`, and the CLI `bun table/bots/report.ts [--terms N] [--world egypt-2011|mars-2091|all]` that writes `table/bots/out/report.md` and `report.json`.

`TermResult`: `{ bot: string; seed: number; vision: string | null; outcome: Outcome; months: number; actions: number; spentIn: Record<Role, number>; capMonths: Record<Role, number>; change: { answer: number; drift: number; other: number }; firstPlays: string[] }`. `spentIn[k]` counts answers and plays that spent kind `k`; `capMonths[k]` counts month ends with kind `k` at the cap (money: never); `change` sums |delta| of `move` events by source; `firstPlays` lists the first card played each month.

- [ ] **Step 1: Write the failure list, then the failing test**

Ways it can fail: a bot picks an action the engine refuses (a throw); a term never ends; a state leaves its ranges (support or grip outside 0 to 100, Force, Voice or Trust outside 0 to 10); the same seed gives a different term.

`table/bots/sim.test.ts`:

```ts
import { expect, test } from "bun:test";
import { adaptiveBot, greedyBot, randomBot } from "./bots";
import { loadPack } from "./load";
import { runTerm } from "./sim";

test.each(["egypt-2011", "mars-2091"] as const)("%s: every bot finishes 10 terms inside the ranges, and a seed replays", (name) => {
  const p = loadPack(name);
  const bots = [randomBot(1), greedyBot(null), ...p.deck.visions.map((v) => greedyBot(v.id)), adaptiveBot()];
  for (const b of bots) for (let seed = 1; seed <= 10; seed++) expect(runTerm(p, b, seed).outcome).toBeDefined();
  expect(runTerm(p, adaptiveBot(), 5)).toEqual(runTerm(p, adaptiveBot(), 5));
}, 600_000);
```

`runTerm` asserts the ranges itself after every action (Step 3), so a range break fails this test with the action that caused it.

- [ ] **Step 2: Run it to see it fail**

Run: `bun test table/bots`
Expected: FAIL, `Cannot find module './bots'`.

- [ ] **Step 3: Write `sim.ts`**

```ts
import { choose, draw, endMonth, type Ev, newGame, type Outcome, type Pack, type Preset, ROLES, type Role, type State, TUNE, pass, play, shortlist, takePick } from "../engine";
import type { Bot } from "./bots";

export interface TermResult {
  bot: string; seed: number; vision: string | null; outcome: Outcome; months: number; actions: number;
  spentIn: Record<Role, number>; capMonths: Record<Role, number>; change: { answer: number; drift: number; other: number }; firstPlays: string[];
}

function inRange(s: State, what: string) {
  const bad = Object.entries(s.support).find(([, v]) => !(v >= 0 && v <= 100)) ?? (!(s.grip >= 0 && s.grip <= 100) ? ["grip", s.grip] : null)
    ?? (["force", "voice", "trust"] as Role[]).map((k) => [k, s.res[k]] as const).find(([, v]) => !(v >= 0 && v <= TUNE.cap));
  if (bad) throw new Error(`out of range after ${what}: ${bad[0]} = ${bad[1]} (seed ${s.seed}, month ${s.month})`);
}

export function runTerm(p: Pack, bot: Bot, seed: number, opts: { rules?: Preset; banned?: string[] } = {}): TermResult {
  const s = newGame(p, { seed, rules: opts.rules, banned: opts.banned });
  s.vision = bot.vision(p, s);
  const zero = () => Object.fromEntries(ROLES.map((r) => [r, 0])) as Record<Role, number>;
  const r: TermResult = { bot: bot.name, seed, vision: s.vision, outcome: null as unknown as Outcome, months: 0, actions: 0, spentIn: zero(), capMonths: zero(), change: { answer: 0, drift: 0, other: 0 }, firstPlays: [] };
  const track = (ev: Ev[], what: string, action = false) => {
    const spent = new Set<Role>();
    for (const e of ev) {
      if (e.t === "move") r.change[e.src === "answer" ? "answer" : e.src === "drift" ? "drift" : "other"] += Math.abs(e.delta);
      if (action && e.t === "res" && e.delta < 0) spent.add(e.kind);
    }
    if (action) { r.actions++; for (const k of spent) r.spentIn[k]++; }
    inRange(s, what);
  };
  for (let guard = 0; !s.over; guard++) {
    if (guard > 500) throw new Error(`term did not end (seed ${seed})`);
    const ids = shortlist(p, s);
    if (!ids.length) pass(s);
    else { track(draw(p, s, ids[0]), `draw ${ids[0]}`); if (s.phase === "draw") continue; }
    if (s.phase === "answer") { const i = bot.answer(p, s); track(choose(p, s, i), `answer ${i}`, true); }
    let first = true;
    while (!s.over && (s.phase === "pick" || s.phase === "play")) {
      if (s.phase === "pick") { const id = bot.pick(p, s); track(takePick(p, s, id), `pick ${id}`); continue; }
      const m = bot.play(p, s);
      if (!m) break;
      track(play(p, s, m.id, m.target), `play ${m.id}`, true);
      if (first) { r.firstPlays.push(m.id); first = false; }
    }
    if (s.over) break;
    for (const k of ["force", "voice", "trust"] as Role[]) if (s.res[k] >= TUNE.cap) r.capMonths[k]++;
    track(endMonth(p, s), "month end");
  }
  r.outcome = s.over as Outcome;
  r.months = s.month;
  r.vision = s.vision;
  return r;
}
```

- [ ] **Step 4: Write `bots.ts`**

```ts
import { choose, clamp, corners, dist, endMonth, hand, marker, options, type Pack, pillars, play, standing, type State, switchVision, takePick, draw, shortlist, pass } from "../engine";

export interface Bot {
  name: string;
  vision(p: Pack, s: State): string | null;
  answer(p: Pack, s: State): number;
  pick(p: Pack, s: State): string | null;
  play(p: Pack, s: State): { id: string; target?: string } | null;
}

const mulberry = (seed: number) => () => {
  seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), seed | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

// how close a Vision is, 0 to 1, with partial credit per pillar
export function progressOf(p: Pack, s: State, id: string): number {
  const v = p.deck.visions.find((x) => x.id === id);
  if (!v) return 0;
  const met = pillars(p, s, id), C = corners(p), m = marker(p, s);
  const lawIdeo = (lid: string) => p.world.compass.find((i) => p.deck.ideologies[i].law.id === lid);
  return v.pillars.reduce((a, q, k) => a + (met[k] ? 1 : (() => {
    switch (q.kind) {
      case "stack": return Math.min(1, s.stacks[q.ideology] / q.min);
      case "zone": return 1 - Math.min(1, dist(m, q.zone === "centre" ? [0, 0] : C[q.zone]) / 1.5);
      case "grip": return 1 - Math.min(1, Math.max(q.min != null ? q.min - s.grip : 0, q.max != null ? s.grip - q.max : 0) / 50);
      case "law": { const i = lawIdeo(q.id); return s.unlocked.includes(q.id) ? 0.6 : i ? (0.5 * s.stacks[i]) / 5 : 0.3; }
      case "sup": return Math.min(1, s.support[q.holder] / q.min);
      case "res": return clamp(s.res[q.role] / Math.max(1, q.min), 0, 1);
    }
  })()), 0) / v.pillars.length;
}

function value(p: Pack, s: State, vision: string | null): number {
  if (s.over?.kind === "fallen") return -1000;
  if (s.over?.kind === "swept") return -500;
  const fac = p.world.factions.map((f) => s.support[f.id]), low = Math.min(...fac);
  const st = clamp((standing(p, s) - 40) / 20, 0, 1);
  const safe = clamp((low - s.rules.actUnder) / 20, 0, 1) - (low < s.rules.actUnder ? 2 : 0);
  const purse = (s.res.force + s.res.voice + s.res.trust) / 30 - (s.res.money < 0 ? 1 : 0);
  return 50 * (vision ? progressOf(p, s, vision) : st) + 30 * st + 20 * safe + 6 * purse;
}

type Move = { kind: "answer"; i: number } | { kind: "pick"; id: string | null } | { kind: "play"; id: string; target?: string } | { kind: "stop" };

function moves(p: Pack, s: State): Move[] {
  if (s.phase === "answer") return options(p, s).flatMap((o, i) => (o.ok ? [{ kind: "answer" as const, i }] : []));
  if (s.phase === "pick") return [...(s.offer?.ids ?? []).map((id) => ({ kind: "pick" as const, id })), { kind: "pick" as const, id: null }];
  const low = [...p.world.factions].sort((a, b) => s.support[a.id] - s.support[b.id]).slice(0, 2);
  return [{ kind: "stop" }, ...hand(p, s).filter((c) => c.ok).flatMap((c) => (c.target ? low.map((f) => ({ kind: "play" as const, id: c.id, target: f.id })) : [{ kind: "play" as const, id: c.id }]))];
}

function step(p: Pack, s: State, m: Move) {
  if (m.kind === "answer") choose(p, s, m.i);
  else if (m.kind === "pick") takePick(p, s, m.id);
  else if (m.kind === "play") play(p, s, m.id, m.target);
}

// finish the current month and `months` more with a greedy policy, on a copy
function rollout(p: Pack, s0: State, vision: string | null, months: number): number {
  const s = structuredClone(s0), stopAt = s.month + months;
  while (!s.over && s.month <= stopAt) {
    if (s.phase === "draw") { const ids = shortlist(p, s); if (!ids.length) pass(s); else draw(p, s, ids[0]); continue; }
    if (s.phase === "play") { const m = best(p, s, vision); if (m.kind === "stop") endMonth(p, s); else step(p, s, m); continue; }
    step(p, s, best(p, s, vision));
  }
  return value(p, s, vision);
}

function best(p: Pack, s: State, vision: string | null, look = 0): Move {
  let top: Move = { kind: "stop" }, tv = -Infinity;
  for (const m of moves(p, s)) {
    const c = structuredClone(s);
    if (m.kind === "stop") { if (c.phase === "play") endMonth(p, c); } else step(p, c, m);
    const v = look ? rollout(p, c, vision, look) : value(p, c, vision);
    if (v > tv) { tv = v; top = m; }
  }
  return top;
}

const asBot = (name: string, pickVision: (p: Pack, s: State) => string | null, choice: (p: Pack, s: State) => Move): Bot => ({
  name,
  vision: pickVision,
  answer: (p, s) => { const m = choice(p, s); return m.kind === "answer" ? m.i : 0; },
  pick: (p, s) => { const m = choice(p, s); return m.kind === "pick" ? m.id : null; },
  play: (p, s) => { const m = choice(p, s); return m.kind === "play" ? { id: m.id, target: m.target } : null; },
});

export function randomBot(seed: number): Bot {
  const r = mulberry(seed);
  return asBot("random", () => null, (p, s) => { const ms = moves(p, s); return ms[Math.floor(r() * ms.length)]; });
}

export const greedyBot = (vision: string | null): Bot => asBot(`greedy:${vision ?? "free"}`, () => vision, (p, s) => best(p, s, s.vision));

// 2-month lookahead on answers and picks; switches Vision once when another is clearly closer
export function adaptiveBot(): Bot {
  const choice = (p: Pack, s: State): Move => {
    if (!s.switched && s.month >= 4 && s.phase === "answer") {
      const ranked = p.deck.visions.map((v) => [v.id, progressOf(p, s, v.id)] as const).sort((a, b) => b[1] - a[1]);
      const cur = s.vision ? progressOf(p, s, s.vision) : 0;
      if (ranked[0][0] !== s.vision && ranked[0][1] - cur > 0.25) { try { switchVision(p, s, ranked[0][0]); } catch { /* cannot pay: keep the Vision */ } }
    }
    return best(p, s, s.vision, s.phase === "play" ? 0 : 2);
  };
  return asBot("adaptive", (p, s) => p.deck.visions.map((v) => [v.id, rollout(p, Object.assign(structuredClone(s), { vision: v.id }), v.id, 3)] as const).sort((a, b) => b[1] - a[1])[0][0], choice);
}
```

(The adaptive bot calls `switchVision` on the live state inside its choice; `runTerm` catches that through the next action's range check. If the reviewer prefers, move the switch into `runTerm` behind an optional `bot.switch?(p, s)` hook; keep the behaviour.)

- [ ] **Step 5: Write `report.ts`**

```ts
import { mkdirSync, writeFileSync } from "node:fs";
import { ROLES } from "../engine";
import { adaptiveBot, greedyBot, randomBot } from "./bots";
import { loadPack } from "./load";
import { runTerm, type TermResult } from "./sim";

const arg = (k: string, d: string) => { const i = process.argv.indexOf(`--${k}`); return i > 0 ? process.argv[i + 1] : d; };
const N = Number(arg("terms", "1000")), which = arg("world", "all");
const worlds = (which === "all" ? ["egypt-2011", "mars-2091"] : [which]) as ("egypt-2011" | "mars-2091")[];
const pct = (n: number) => `${Math.round(n * 100)}%`;
const runs = (f: (seed: number) => TermResult, n = N) => Array.from({ length: n }, (_, k) => f(k + 1));
const rate = (rs: TermResult[], kinds: string[]) => rs.filter((r) => kinds.includes(r.outcome.kind)).length / rs.length;

const out: Record<string, unknown> = {}, md: string[] = [`# Balance report`, ``, `${N} terms per bot, preset standard, Jev stand-in (nudge 0, Director = top, plausibility 0.7).`, ``];
for (const name of worlds) {
  const p = loadPack(name), t0 = performance.now();
  const random = runs((seed) => runTerm(p, randomBot(seed), seed));
  const greedy = Object.fromEntries(p.deck.visions.map((v) => [v.id, runs((seed) => runTerm(p, greedyBot(v.id), seed))]));
  const adaptive = runs((seed) => runTerm(p, adaptiveBot(), seed), Math.max(50, Math.round(N / 10)));
  const fulfil = Object.fromEntries(Object.entries(greedy).map(([id, rs]) => [id, rate(rs, ["fulfilled"])]));
  const fv = Object.values(fulfil), all = [...random, ...Object.values(greedy).flat(), ...adaptive];
  const plays = Object.values(greedy).flat().flatMap((r) => r.firstPlays), top = Object.entries(plays.reduce<Record<string, number>>((a, id) => ((a[id] = (a[id] ?? 0) + 1), a), {})).sort((a, b) => b[1] - a[1])[0];
  const acts = all.reduce((a, r) => a + r.actions, 0), months = all.reduce((a, r) => a + r.months, 0);
  const spent = Object.fromEntries(ROLES.map((k) => [k, all.reduce((a, r) => a + r.spentIn[k], 0) / acts]));
  const capped = Object.fromEntries(["force", "voice", "trust"].map((k) => [k, all.reduce((a, r) => a + r.capMonths[k as "force"], 0) / months]));
  const ch = all.reduce((a, r) => ({ answer: a.answer + r.change.answer, drift: a.drift + r.change.drift, other: a.other + r.change.other }), { answer: 0, drift: 0, other: 0 });
  const answerShare = ch.answer / (ch.answer + ch.drift + ch.other);
  const combos = p.deck.combos.map((c) => {
    const n = Math.max(50, Math.round(N / 4));
    const lift = Math.max(...p.deck.visions.map((v) => rate(runs((seed) => runTerm(p, greedyBot(v.id), seed), n), ["fulfilled"]) - rate(runs((seed) => runTerm(p, greedyBot(v.id), seed, { banned: c.parts }), n), ["fulfilled"])));
    return { name: c.name, lift };
  });
  const adaptiveRate = rate(adaptive, ["fulfilled"]);
  const targets: [string, boolean, string][] = [
    ["random falls in 60% or more of terms", rate(random, ["fallen"]) >= 0.6, pct(rate(random, ["fallen"]))],
    ["no dominant ideology: Vision rates within 15 points", Math.max(...fv) - Math.min(...fv) <= 0.15, Object.entries(fulfil).map(([k, v]) => `${k} ${pct(v)}`).join(", ")],
    ["skill pays: adaptive beats every greedy bot by 15 points", fv.every((v) => adaptiveRate - v >= 0.15), `adaptive ${pct(adaptiveRate)}`],
    ["no card is the best play in more than 50% of months", (top?.[1] ?? 0) / Math.max(1, plays.length) <= 0.5, top ? `${top[0]} ${pct(top[1] / plays.length)}` : "no plays"],
    ["every kind is spent in 15% or more of actions", Object.values(spent).every((v) => v >= 0.15), Object.entries(spent).map(([k, v]) => `${k} ${pct(v)}`).join(", ")],
    ["no kind sits at its cap more than 30% of months", Object.values(capped).every((v) => v <= 0.3), Object.entries(capped).map(([k, v]) => `${k} ${pct(v)}`).join(", ")],
    ["answers cause 50% or more of support change", answerShare >= 0.5, pct(answerShare)],
    ...combos.map((c) => [`combo "${c.name}" lifts a Vision by 10 points`, c.lift >= 0.1, pct(c.lift)] as [string, boolean, string]),
  ];
  out[name] = { fulfil, adaptiveRate, random: rate(random, ["fallen"]), spent, capped, answerShare, combos, seconds: (performance.now() - t0) / 1000 };
  md.push(`## ${p.world.title}`, ``, `| Target | Pass | Measured |`, `|---|---|---|`, ...targets.map(([t, ok, m]) => `| ${t} | ${ok ? "yes" : "**no**"} | ${m} |`), ``, `Run time ${Math.round((performance.now() - t0) / 1000)} s.`, ``);
}
mkdirSync(new URL("out/", import.meta.url), { recursive: true });
writeFileSync(new URL("out/report.json", import.meta.url), JSON.stringify(out, null, 1));
writeFileSync(new URL("out/report.md", import.meta.url), md.join("\n"));
console.log(md.join("\n"));
```

- [ ] **Step 6: Run the test, then a short report**

Run: `bun test table/bots && bun table/bots/report.ts --terms 40`
Expected: the test passes; the report prints a target table for both worlds (pass or fail does not matter yet) and writes `table/bots/out/report.md`. If the 10-term test takes over 10 minutes, cut the adaptive bot's lookahead to 1 month and note it.

- [ ] **Step 7: Type-check and commit**

```bash
bunx tsc -p table/tsconfig.json
git add table/bots
git commit -m "Table bots: random, greedy and adaptive players, the term runner and the balance report"
```

---

### Task 8: Balance pass

**Files:**
- Modify: `table/engine/tune.ts` only
- Create: `table/bots/out/report.md` (committed as the record)

**Interfaces:**
- Consumes: `bun table/bots/report.ts`.
- Produces: tuned `TUNE`/`PRESETS` values and the report the owner reads before the board port.

- [ ] **Step 1: Run the full report and record the baseline**

Run: `bun table/bots/report.ts --terms 1000 | tee table/bots/out/baseline.md`
Expected: two target tables. Copy them into the commit message of Step 4 as "Before".

- [ ] **Step 2: Tune, at most 5 rounds**

For each failed target, change only the knob in this table, one or two knobs per round, then re-run with `--terms 300`:

| Target fails | Knobs, in order |
|---|---|
| random falls under 60% | `PRESETS.standard.drift` up; `TUNE.size` down; `patronPenalty.loss` up |
| Vision rates spread over 15 points | `stack.major` and `cornerZone` (zone gates on laws); `size` steps |
| adaptive not 15 points ahead | `nudgeMax` and `size` (bigger choices reward planning); `plays` |
| one card is the best play over 50% | that card's family: `talk.up`, `talk.cost`, `address.cost` |
| a kind spent under 15% or capped over 30% | `cap`, `produceAt`, `talk.cost`/`address.cost`, `electionBonus` |
| answers under 50% of change | `PRESETS.*.drift` down; `size` up |
| a combo lifts under 10 points | none in the engine: list it for the owner (it is a pack problem; packs are never edited to pass) |

Never edit a pack. Never add a rule. If a target still fails after 5 rounds, stop and list it.

- [ ] **Step 3: Run the final full report**

Run: `bun table/bots/report.ts --terms 1000`
Expected: `table/bots/out/report.md` with the final tables.

- [ ] **Step 4: Run all tests, then commit**

```bash
bun test table && bunx tsc -p table/tsconfig.json
git add table/engine/tune.ts table/bots/out/report.md
git commit -m "Balance pass: rule numbers tuned against the bot targets

Before: <paste the baseline tables>
After: see table/bots/out/report.md
Unmet: <each target still failing, with its measured value>"
```

The engine tests may need their expected numbers updated when `TUNE.size`, `talk.up` or `gripSize` change; update the numbers in the test, never the rule they check.

---

## Self-review

- **Spec coverage:** holders, record and Compass (Task 2); grip bands, elections (Tasks 3 and 5); resources, income, debt (Tasks 4 and 5); the hand, power cards, major and centre laws, grip and patron cards (Task 4); picks and their triggers (Task 4); every primitive (Tasks 3 and 4, lines in Task 6); a month in its order (Tasks 3 to 5); intents, acts, plots and falls (Task 5); the numbers (Task 2, tuned in Task 8); history, callbacks and divergence (Tasks 3 and 5); Visions, the switch, the Reckoning and outcomes (Task 5); difficulty presets for Levels (R1, Task 2); Jev's 3 jobs as inputs with fallbacks (R10); music levers (Task 5); bot verification and its 7 targets (Tasks 7 and 8). Not here, by scope: the E2E Chrome run, the owner's playtest and the board (part 2); the build and legibility check (sub-project 3); Jev (sub-project 2).
- **Placeholders:** none; the commit message in Task 8 has slots for measured numbers by design.
- **Type consistency:** `Ev`, `State`, `HandCard`, `Kind`, `TermResult` and every function name match between the task that produces them and the tasks that consume them.
- **Review Focus:** each of the 5 lines has its test (Tasks 2, 3, 4, 5, 7).
