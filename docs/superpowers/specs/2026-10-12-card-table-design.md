# The card table (prototype design)

Date: 2026-10-12. Status: draft for owner review. Supersedes `2026-10-11-restart-design.md` where they differ; that spec's reasons and research still hold. The look is the v16 mock (`docs/mocks/v16`, layout `?skin=0&rv=b&pv=a&n=3`); the placement of the new elements is pending the owner's pick of the v17 mocks.

## Goal
A single-player game where the player rules any world they name, reads its politics, and remakes it in their image without being torn apart. One term is about 20 minutes. Fun first, then accuracy. Desktop only, fullscreen. Target weight: about 2.8 on the BGG scale (judgement, not measured).

## Owner rules
- No typed input in play. The world prompt is the only typing.
- Player freedom: no dominant ideology. The best player adapts to the situation or masters one style; both beat a player who does neither.
- Ideologies are real political ideologies of that era, never parties.
- Situations are a hidden deck. The hand never draws; it grows only by unlocks.
- **Opus runs once per world, at build. Jev runs during play and returns numbers only, never text.** Every sentence the player reads is written at build.
- No world fact in code. Code holds game rules; the pack holds the world.
- v4 on `main` stays live and untouched. Dropped from v4 (owner, 2026-10-12): chamber, members, votes, deals, map, regions, citizens, the Feed, typed orders.

## The 9 replay drivers (owner: all 9 are in)
| Driver | Carried by |
|---|---|
| 1. Every choice hurts someone | Answers move 4 to 6 holders both ways, your marker and your grip |
| 2. A clock and visible danger | Reckoning countdown, next card face down, intents with their trigger number |
| 3. Builds and combos | Picks and laws built from primitives; 2 to 3 cross-ideology combos per world, written on purpose |
| 4. A reason to replay a world | Visions, grip, zones: the same world plays as an iron Islamist or an open Liberal |
| 5. Infinite content | Any world; 60 to 80 situations per world; a seed orders the deck and the pick offers |
| 6. Stories you retell | History cards and divergence; callback cards that answer earlier choices |
| 7. Rising difficulty | Levels, one rule each, unlocked by fulfilling a Vision |
| 8. Short runs | 12 to 18 months at about 75 seconds each |
| 9. Feel | Hall music driven by the board; world-tuned SFX on 3 tiers; change markers |

## Player flow
1. **Choose a world.** The library of built worlds. Prototype: 3 worlds built offline (Egypt February 2011, USA January 2022, Kepler Base 1 AE). An unknown name says it is not built yet.
2. **Briefing.** Polity, office, date, Reckoning date, the Compass with each corner in one line, the holders on it, the level. Pick a **Vision** or Free hand. Press Take office.
3. **The term.** One month at a time until the Reckoning.
4. **The end.** You fall early, or you reach the Reckoning. The epilogue shows your timeline beside history's, names your rule by your zone and grip ("Egypt under an iron Military nationalist"), and scores the Vision.

## The screen
The v16 board: holders at home (ranked ledger) and abroad on the left, the stage in the centre, the hand on the right, the record bar at the bottom, resources in the top bar. New elements, each shown only from the moment it first matters:
| Element | First shown |
|---|---|
| Change markers (signed chip and moved stretch of the bar) | first answer; cleared at the next batch of changes or the next draw |
| Resting tick on each holder bar | first month end |
| Compass emblem (opens large on click) | briefing; the marker slides in each reveal |
| Grip dial with band label | first time grip moves |
| Reckoning countdown | always |
| Next card face down, title only | after the first answer |
| Vision pillars with check state | briefing (not shown with Free hand) |
| Law seal on its stack | first law enacted |
| Pick moment (3 cards on the stage) | first pick trigger |

## Holders
**Factions** (4 to 6) are blocs at home; **patrons** (2 to 3) are foreign backers. Each holder has a support level 0 to 100, a position on the Compass, a power weight (for the Reckoning), one intent card, one fixed act under 15, and one way to bring you down. Patrons also have a preferred grip and a patron card.

## The record and the Compass
- The world has 3 to 5 ideologies of the era. Each is a **corner** of a regular polygon on the unit circle. The build sets the order: allies are next to each other.
- Each answer carries one ideology. When you choose it, the card is **filed** into that ideology's stack in the record bar.
- **The marker is computed from the record:** `marker = (4 x start + sum of stack_i x corner_i) / (4 + sum of stacks)`. The start is the real ruler's mix of corners and counts as 4 cards, so early answers move you most.
- Each holder's position is a mix of corners (Muslim Brotherhood: 70% Islamism, 20% Salafism, 10% Liberalism).
- **Resting level** of a holder = `100 x (1 - distance(marker, holder) / 2)`. Patrons lose 10 more per 20 grip points away from their preferred grip.
- At each month end, support moves 20% of the gap toward the resting level. Answers and cards are the short-term layer on top.
- **Zones:** within 0.6 of a corner is that corner's zone; within 0.25 of the centre is the Pragmatist centre.

## Grip
A dial from 0 (Open) to 100 (Iron), starting where the real ruler stood. Answers and cards that open up or crack down carry a grip tag (small, medium, large = 5, 10, 15 points).
| Band | Effect |
|---|---|
| Iron (60 and up) | +2 Mandate a month. Each faction under 30 loses 2 more support a month. Iron cards in hand. |
| Middle (41 to 59) | None. |
| Open (40 and less) | Each faction at 60 and up gives 2 Mandate instead of 1. Open cards in hand. Election cards become eligible. |

**Elections** (2 to 3 per world, open band only) are an early Reckoning. The card shows the current weighted support against 50 before you choose. Weighted support 50 and up: +1 Mandate a month for the rest of the term. Under 50: you fall.

## Resources
| Resource | Comes from | Spent on |
|---|---|---|
| **Mandate** (world-named) | 2 a month, +1 per faction at 60 and up, grip effects, some answers | hand cards (1 to 4) |
| **Reserves** (world units) | the world's monthly balance (written at build), patron cards, some answers and cards | subsidy and patronage cards |

Reserves under 0 at a month end makes next month's card a shortage card and moves every faction down 5. Two month ends in a row under 0 is a fall, warned one month ahead.

## The hand
At most 8 cards, 2 plays a month, dimmed until the month's card is answered. A card you cannot pay for shows its price, greyed.
- **Always:** Talk to a faction (1 Mandate: one holder up 8). Address the nation (1 Mandate: your next answer counts twice: its changes double and it files 2 cards).
- **Power cards:** at 3 cards in a stack, that ideology's power card joins the hand. Reusable, costs Mandate.
- **Major laws:** at 5 cards, that ideology's major law joins the hand. Enacted once, permanent; then it leaves the hand and shows as a seal on its stack. Playable only while the marker is in that corner's zone; out of zone it shows "Stand closer to <ideology>".
- **Centre laws** (2 per world): in hand while the marker is in the centre zone.
- **Grip cards** (2 iron, 2 open per world): in hand while grip is in that band.
- **Patron cards:** a patron at 60 and up offers its card (aid, a loan, arms, mediation).

When more than 8 are eligible, the hand shows the 2 basic cards, then laws, then power cards, then the rest, and a "+N more" card that opens the overflow.

## Picks
Take 1 of 3 face-up modifiers, or skip. A modifier changes a rule for the rest of the term.
- **Triggers** (first time only): a stack reaches 2 (that ideology's 3 modifiers); grip reaches 20 or less (open set) or 80 or more (iron set); the marker enters the centre (centre set). About 3 to 5 picks a term.
- The build writes 3 modifiers per ideology and 3 each for iron, open and centre (24 for a pentagon world).
- The seed orders the offers.

## Effects (primitives)
Every answer side effect, card, law and modifier is a list of primitives. Opus writes the name and one flavour line. **The engine writes the rules line from the primitives**, so one mechanic reads the same in every world.

One-shot effects: `move(target, dir, size)` · `grip(dir, size)` · `mandate(n)` · `reserves(n)` · `file(ideology, n)` · `boostNext(ideology|any, steps)` · `hold(holder, floor|ceiling, level, months)` · `setFlag(flag)` · `queueNext(tag)` · `cancelIntent(holder)`.

Modifiers: `cost(family, delta)` · `sizeUp(ideology)` · `drift(target, multiplier)` · `gripRate(multiplier)` · `extraPlay(everyNMonths)` · `income(resource, n, condition)` · `trigger(condition, effect)`.

Targets: a holder, the holders leaning to an ideology, all factions, all patrons, the lowest faction. Conditions: a holder above or below a level, a grip band, a stack count, in a zone, month end.

## A month
1. **Draw.** The engine lists the eligible cards (month window, flags required or blocked, grip band, zone, support bands). Intent cards jump the queue. The engine shortlists up to 5 by seeded weight; Jev picks 1. A history card first gets a Jev plausibility score, then a seeded roll.
2. **Answer.** 2 or 3 answers, each with a "who cares" mark per holder it moves (1 to 3 dots, no direction). On choice: sizes become numbers, then one Jev nudge per holder; grip moves; the card files; the marker moves; unlocks and picks are checked. The reveal shows the ideology stamp, each change with its reason, and on history cards "In history: ...". The change markers stay on the rows.
3. **Up to 2 plays** from the hand.
4. **Month end.** Drift toward resting levels; Mandate income; the Reserves balance; band effects; intents; Vision pillars; on the last month, the Reckoning.

## Intents and falls
- A holder under 30 at a month end brings its **intent card** as next month's card (written at build, 2 to 3 answers).
- A holder under 15 at a month end **acts** at once (its fixed act, written at build) and **plots**: if it is still under 15 at the next month end, you fall in its own way (a coup, an uprising, a sanction regime). The plot shows its trigger number. Losing is never a surprise.

## Numbers (TUNE constants in one file; the bots set the final values)
| Rule | Value |
|---|---|
| Support change from an answer or card (small, medium, large) | 4, 8, 12 |
| Jev nudge per holder per answer | -3 to +3 |
| Grip change (small, medium, large) | 5, 10, 15 |
| Start weight in the marker | 4 cards |
| Drift each month end | 20% of the gap |
| Corner zone / centre zone | 0.6 / 0.25 |
| Stack thresholds: pick / power / major | 2 / 3 / 5 |
| Mandate at start / cap | 6 / 12 |
| Plays a month / hand cap | 2 / 8 |
| Intent / act and plot | under 30 / under 15 |
| Reckoning and election bar | weighted support 50 |

## History, callbacks and divergence
- The build writes **10 to 15 dated history cards**: the real events of the term (for an alternate-history premise, that world's own canon). If Jev and the roll say it does not happen, the reveal says what history did instead.
- The build writes **10 to 15 callback cards**, each gated on a flag an earlier answer set ("You promised the Brotherhood the interior ministry in March").
- **Divergence** = the share of history cards that did not happen plus history forks taken differently. The epilogue lists each history card: "In history" beside "In yours".

## Visions, the Reckoning and the score
- The build writes **4 to 6 Visions** from paths that really existed, covering every corner and the centre at least once, plus **Free hand**. Each Vision has 3 to 4 engine-checked pillars: a stack count or zone, a grip band, a law enacted, a holder at a level, Reserves above a level.
- Switch Vision once a term for 3 Mandate.
- **The Reckoning** is the world's natural climax, 12 to 18 months in, set by the build. Your order endures if the power-weighted average support of the factions is 50 or more.
- Outcomes: Vision fulfilled (endures, all pillars), survived (endures), swept away (does not endure), fallen (before the Reckoning). Free hand scores average support and divergence.

## Levels
Level 0 is the base. Fulfilling any Vision at level N unlocks level N+1, stored in the browser. Each level adds one rule:
| Level | Rule |
|---|---|
| 1 | Drift 25% |
| 2 | Intents fire under 35 |
| 3 | Mandate income -1 |
| 4 | Fall line 20 |
| 5 | Patron sanctions twice as hard; election and Reckoning bar 55 |

## Jev's jobs (numbers only, about 2 to 3 calls a month)
| Call | Returns | Fallback on failure |
|---|---|---|
| Nudge, once per answer | -3 to +3 per moved holder | 0 for every holder |
| Director, once a month | the index of 1 card in the shortlist | the seeded top of the shortlist |
| Plausibility, per history card | 0 to 1 | 0.7 |

The call shape comes from v4 `worker/jev.ts`. The state sent holds the holders' personas, support, positions, grip, and the last 3 answers and plays.

## The world build (offline script in the prototype)
- Opus 5.5 writes the pack: polity, office, dates, Reckoning, corners and order, holders (mix, support, power weight, intent card, act, fall), patrons' grip preference and card, the marker and grip start, the monthly balance, Mandate and Reserves names, per ideology a power card, a major law and 3 modifiers, 2 centre laws, 3 iron, 3 open and 3 centre modifiers, 2 iron and 2 open cards, 2 to 3 elections, 60 to 80 situations, 10 to 15 history cards, 10 to 15 callback cards, 4 to 6 Visions, the skin, and the music brief.
- Each situation answer: text, sub-line, ideology, per holder a direction, size and one-line reason, an optional grip tag, optional effects and flags.
- **Required combos:** 2 to 3 pairs of cards or modifiers from different ideologies that work together, named in the pack for the bots to test.
- **Validation:** schema and counts; every effect compiles to primitives; no single play can return more Mandate than it costs; no trigger can fire itself; `extraPlay` no more often than every 2 months; every Vision pillar checkable and reachable; each corner within 1 of an equal share of answers; every change has a reason; the music brief passes the arranger's validator. One repair call on failure.
- **Legibility check (Jev):** for each answer, a Choice over the corners from its text; under 0.6 on its own corner means too vague, and it goes to the repair call.
- The content rule carries over unchanged (`CONTENT_RULE`).

## Music and SFX
- The pack carries the music brief. The hall engine (Tone.js, sampled orchestra and world instruments, one convolution hall, mastering chain) arranges it on the client. Calibration runs at build and is stored in the pack.
- Levers: distance to each corner drives that ideology's lever; grip drives grip; month, laws and stacks drive growth; average support under 45 drives tension; the lowest faction under 18 drives crisis.
- SFX come from the same band, in the current chord, on 3 tiers: big moments about 6 dB over the music's peaks with a 3 dB duck; feedback about 3 dB over; frequent UI at or under the music. Music and SFX have separate volume controls.

## Stack (prototype)
Local only, on branch `restart`, in a new `table/` folder so no v4 file changes.
| Part | What |
|---|---|
| `table/engine` | Pure TypeScript rules, seeded RNG, the primitives compiler. Shared by client, server and bots. |
| `table/client` | Vite + TypeScript. The v16 mock's DOM, CSS, GSAP motion and hall audio, ported to TS modules. No framework. |
| `table/server` | Bun. Holds the OpenRouter key, serves packs, calls Jev. |
| `table/build` | The offline world build and validation script. |
| `table/bots` | Simulations against the engine with a Jev stand-in. |

## Verification
- **Bot sims**, 1,000 terms per world per bot: random; one greedy bot per Vision; one adaptive bot (2-month lookahead, switches Vision when behind). Targets:
  - random falls in 60% or more of terms;
  - no dominant ideology: every per-Vision bot fulfils its Vision within 15 points of the others, in every world;
  - skill pays: the adaptive bot beats every single-plan bot by 15 points or more;
  - no single card is the best play in more than 50% of months;
  - answers cause 50% or more of all support change (drift does not erase choices);
  - each named combo raises the Vision rate by 10 points or more over the same build without it.
- **One E2E run** in Chrome per world: a full term by script against real Jev, a screenshot per month and the run log as a repeatable artifact.
- Then the owner plays 2 terms, with a short interview after each, and the term time is measured (target about 20 minutes).

## Out of scope for the prototype
In-app world generation, fresh situations per run, a daily seed, the share card, accounts and cloud saves, ideology shifts during a run, the name, Steam, mobile.

## Open
- **Build size.** The owner ruled one big Opus call (2026-10-11). This pack is about 3 times the 2026-10-11 one. First build step: measure one Egypt call; if it fails output limits, split it into world, deck and music calls.
- **Placement** of the new elements: the owner picks from the v17 mocks.
