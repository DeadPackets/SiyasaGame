# World build pipeline, portable: report

**Verdict: done.** The Rome run built a full pack: `checkPack` 0 errors, every check passed, 0 unreachable Visions, **$6.06 and 897 s**. The engine `checkPack`, the reach check and all content checks also run in workerd (local `wrangler dev`), with the same results as in Bun.

## Files

| File | What it is |
|---|---|
| `build/check.mjs` | The spike's `validate.mjs`, with its imports fixed to `client/src/{hall,patterns}` and JSON imports, and without `fs` and the CLI block. It exports `checkWorld`, `checkMusic`, `checkDeck`, `style`, `repeats`, `merge`, `drop`, `skinBrief`, `TAGS`, `SAMPLES`, `EMBLEMS`, `PALETTE`, `ICONS`, `ROLES`, `LIMITS`. |
| `build/skin-check.ts` | `checkSkin(skin, brief)`: the round-6 semantic checks plus the render and 6 KB size check. `skinContext(brief)`: the old `--context` output. A missing top-level key returns early. There is no JSON schema and there are no pixel checks (lead ruling). |
| `build/reach.ts` | `reach(pack)`: for each Vision, 40 terms of `greedyBot(visionId)` at preset `standard`. A Vision under 5% is an error string with its id, name, corner, measured rate and pillars, and each pillar shows its start value. It also returns `rates`, `crashes` and `seconds`. It takes **0.7 s for 5 Visions and 1.0 s for 6** (limit 20 s). |
| `build/llm.ts` | `call` (native Anthropic SDK, streamed, `output_config.effort`, the two betas, web search max 5, `pause_turn` continuation, fallback-aware `PRICE` metering), `step` (call, parse, check, up to 2 merge-patch repairs, keep the best), `repair`, `messages`, `finish`, `init`. |
| `build/pipeline.ts` | `CONFIG` (the spike's, Opus 5.5 medium for every part), `buildWorld`, `buildSkin`, `buildMusic`, `buildDeck`, plus the deck split as `deckPlan`, `buildDeckPart` and `finishDeck`. The prompts come in through Vite `?raw` imports. |
| `build/prompts/deck.md` | The N1 rules. The other prompts are unchanged. |
| `scripts/build-world.ts` | The Bun CLI. It writes `packs/<slug>/{world,deck,skin,music.brief,metrics}.json`, and writes raw answers, part files and `run.log` to `build/out/<slug>/`. It runs `checkPack` and `reach` on the final pack, prints the cost, times and force share, and exits with 1 when the pack fails. |

`ctx = { apiKey, log, save?, budget }`. The build fills `spent`, `reserved`, `calls`, `steps` and `t0` on the ctx. Before each call, the budget guard adds the call's worst case to the spend so far and to the worst case of the calls in flight. When the total is over `budget`, the guard waits for the calls in flight to settle; if it is still over, it throws.

## How a Workflow should call it

1. **Step `world`**: `buildWorld(ctx, prompt, slug)` takes about 540 s of wall time with almost no CPU. Use `ctx.save` to put the world in R2, and return only the key and `ctx.spent`.
2. **Steps `skin`, `music` and `deck` in parallel**: `buildSkin(ctx, world)`, `buildMusic(ctx, world)` and `buildDeck(ctx, world)`. Give each one `budget = total − spent so far`. Then each one alone stays under the remaining budget, but together the three can go over it. Either split the remainder (for example deck 70%, skin and music 15% each), or run all three in one step with one ctx, as the CLI does.
3. **Durability option**: `buildDeck` is about 360 s and about $4.2 in one step, so a retry of that step pays again. To make each part its own step, call `deckPlan(world)` and then one step per part, `buildDeckPart(ctx, world, part)`. Then call `finishDeck(ctx, world, parts, got)`, which merges, checks, runs `checkPack` and reach, and makes at most one reach repair of `rules-a`.
4. Set step retries to 0 or 1 on model steps. The SDK already retries 429, 5xx and failed connects 6 times, and `call` resends a stream that drops mid-way up to 2 times.
5. **Limits**: a step's return value is limited to 1 MiB (Rome `deck.json` is 189 KB), so return R2 keys. Reach uses about 1 s of CPU. In Workers, `performance.now()` does not advance during synchronous code, so `reach().seconds` reads about 0 there; this only affects the reported number.
6. **Bundle**: the `?raw` prompt imports need Vite (the `@cloudflare/vite-plugin` build) or the Bun runtime. `bun build` does not resolve them.

## Rome run

"After the Ides", Consul Marcus Antonius, 13 months, 4 ideologies (lib, opt, cae, pop), 34 seeds, 9 holders. Deck: 34 situations, 12 history, 7 callbacks, 3 elections, 5 Visions, 3 combos.

| Part | Calls | Seconds | Cost | First errors |
|---|---|---|---|---|
| world (5 searches) | 1 | 536.4 | $1.638 | 0 |
| music | 1 | 49.5 | $0.139 | 0 |
| skin | 2 | 58.4 | $0.232 | 1 (fit.tradition), fixed |
| rules-a | 1 | 94.8 | $0.224 | 0 |
| rules-b | 2 | 265.6 | $0.641 | 1 (word limit), fixed |
| rules-c | 1 | 343.0 | $0.760 | 0 |
| sit-b1 | 1 | 152.1 | $0.484 | 0 |
| sit-b2 | 2 | 196.4 | $0.484 | 1 (question voice), fixed |
| sit-b3 | 1 | 354.6 | $0.785 | 0 |
| sit-b4 | 1 | 312.7 | $0.672 | 0 |
| **total** | 13 | **896.7** | **$6.06** | merged deck: 0 errors, 0 repeats |

The world, skin and music were ready at 594.8 s (T_play). Month 1 was ready at 688.5 s and the full pack at 896.7 s. Tokens: 1.07 M input (0.91 M cached), 255 k output (146 k reasoning).

**checkPack: 0 errors. Reach: 0 unreachable.** Vision rates (greedy bot, 40 terms):

| Vision | Corner | Rate | Pillars (start value) |
|---|---|---|---|
| v1 Avenger of Caesar | cae | 25% | zone cae, law l-cae, sup cpt ≥ 60 (64), res force ≥ 5 |
| v2 Concord after the Ides | centre | 97.5% | zone centre, law l-centre1, sup sen ≥ 45 (40) |
| v3 The Republic Restored | lib | 97.5% | stack lib ≥ 3, sup lbr ≥ 40 (22), grip ≤ 40 |
| v4 First Man of the Senate | opt | 92.5% | stack opt ≥ 3, sup sen ≥ 55 (40), res trust ≥ 4 |
| v5 The People's Consul | pop | 100% | stack pop ≥ 4, sup plb ≥ 65 (54), grip ≤ 40 |

Total spend: **about $6.9 of the $15 cap**. That is $6.06 for run 2, about $0.7 estimated for the dropped run 1 (not metered), and $0.16 for the reach-repair proof.

- **Run 1 failed for a code reason.** After 228 s of the world call, Bun closed the stream ("socket connection was closed unexpectedly"). Bun's fetch has a socket idle timer, and a long web search or thinking pause sends no bytes. Fix: `fetchOptions: { timeout: false }` on the client (other runtimes ignore it), plus up to 2 resends of a stream that drops mid-way. Run 2 needed no resends.
- **Reach-repair proof.** The reach repair did not fire on Rome, because no Vision was unreachable. I ran `finishDeck` once on the Egypt pack, which has 2 unreachable Visions (v3 at 2.5%, v5 at 0%). One `rules-a` repair call ($0.16, 11 s) raised **v3 to 90% and v5 to 30%**. The patch kept `checkDeck` and `checkPack` at 0 errors, and the code kept it. I did not save it to `packs/egypt-2011`.

## What the N1 prompt changes did

- **(a) Reachability.** All 5 Visions are reachable, and every `sup` pillar asks for a level within 25 of its holder's start (the largest gap is +18). Only v1 and v2 use a law pillar, and the laws are the start corner (cae) and centre1. **Side effect: 4 of 5 Visions are now too easy (92% to 100%).** The spread is 25% to 100%, but the balance target is within 15 points. The reach check has only a floor, at 5%.
- **(b) Force.** Force is a cost on **7 of 17 hand cards (41%)**, above the one-third target. The CLI measures this; no code check enforces it.

## Still open

1. **Balance ceiling.** Reach needs a ceiling (for example, an error over 80%) or a spread rule, so the repair can also make easy Visions harder. The prompt now pushes toward easy, and one Egypt repair overshot to 90%.
2. **Spike quirk kept on purpose.** In the spike, `rulesParts` put `quota:` inside a comment, so history is checked "within 1 of an equal share" and not against the exact quota its message states. I kept that behaviour and marked it with a `ponytail:` comment. Fixing it is a one-word change, but it will cause more repairs.
3. **Skin.** Without the JSON schema, a skin with a bad recipe shape that still renders can pass, and there are no pixel checks.
4. **Force share** is a prompt rule only. Enforcing it would take a 3-line check in `checkDeck`.
5. **Budget across parallel Workflow steps**: the steps need a split of the budget, or the three parts must share one ctx.
6. A stream that drops mid-way costs tokens that are not metered, so `ctx.spent` reads low by that amount.

---

Rerun the build with `bun scripts/build-world.ts "<prompt>" <slug>` from `table/`. To check it worked, confirm that the last line of `build/out/<slug>/run.log` shows 0 errors for the merged deck, and that `metrics.json` has `checkPack: []`.

Files are in `/Users/deadpackets/workspace/UnitedStatesOfJev/.worktrees/restart/table/`:
- `build/check.mjs`
- `build/skin-check.ts`
- `build/reach.ts`
- `build/llm.ts`
- `build/pipeline.ts`
- `build/prompts/deck.md`
- `scripts/build-world.ts`
- `packs/rome-44bc/`
- `build/out/rome-44bc/`