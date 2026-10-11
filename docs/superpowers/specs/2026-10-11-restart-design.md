# Restart: the Compass game (prototype design)

Date: 2026-10-11. Status: draft for owner review. Working title: Body Politic (not decided). Look: pending the owner's pick of 3 mocks (cinematic, tabletop, state papers), docs/mocks/v7.

## Why a restart
v4 "The Ruler" was not fun in 3 owner playtests. Measured: 16 to 34 clicks per signed act, 75 min per term, and in run 3 the player's 21 acts cost 17 final-vote points net, so doing nothing scored better. v4 grew systems (25 powers, typed orders, a clerk model that set numbers) to chase fun. The hits (Reigns 1.8M copies, Sultan's Game 1M+, Suzerain 650K+) share a small core: 2 answers per decision, 3 to 5 meters, one demand at a time, short terms, people carrying each choice.

## Goal
A single-player game where the player rules any world they name (a real country at any date, an alternate history, a fiction), reads its politics, and remakes the nation in their image without being torn apart. Fun first, then accuracy. Desktop only, fullscreen.

Audiences, in order: history and alternate-history fans, grand strategists, casual politics players. The hook that spreads is "I typed X, look what happened"; the ending card shows your timeline beside history's.

## Owner rules (2026-10-11)
- **No typed input in play.** The world prompt is the only typing.
- **Player freedom.** No dominant ideology. Powers come only from playstyle. The best player adapts to the situation or masters one style; both beat a player who does neither.
- **Ideologies are real political ideologies of that era**, never parties.
- **No deckbuilder.** Situations are a hidden deck; powers are a fixed hand with no draw.

## Player flow
1. **Choose a world.** "Which world will you rule?" and the library of built worlds. Prototype: 3 worlds built offline; an unknown name says it is not built yet. Later: an unknown name starts one build.
2. **Briefing.** The polity, your office, the date, the Reckoning date, the Compass with each corner in one line, the factions and patrons on it. Pick a **Vision** (or Free hand) and press Take office.
3. **The term.** One month at a time until the Reckoning: 1 situation, 2 plays from your hand, month end.
4. **The end.** You fall early, or you reach the Reckoning. The epilogue shows your timeline beside history's, names your rule by your final zone and grip ("Egypt under an iron Military nationalist"), and scores the Vision.

## The Compass (what you stand for)
- A regular polygon with **3 to 5 corners**, set by the build for the era. Each corner is a real ideology of that place and time under its period name (Egypt 2011: Military nationalism, Liberalism, Islamism, Salafism, Nasserism; Ottoman 1520: Absolutism, Theocracy, Feudalism).
- Allies sit next to each other, enemies far apart. Positions must be true to the era; the owner judges factions first.
- Each corner maps to one **archetype** from a fixed game catalog (Order, Faith, Market, Collective, Nation, Reform, Tradition, Technocracy, Liberty, Commons). The archetype sets the kinds of laws the corner holds. The world gives the names. No world fact is hardcoded.
- **Factions** (4 to 6) are points on the field, actors that can decide and act as one. **Patrons** (2 to 3) are foreign backers, drawn as different tokens on an outer ring near the corner they favour.
- **The marker** starts where the real ruler stood on the start date. No ideology shifts during a run (later).

## Grip (how you hold power)
A dial from 0 (Open) to 100 (Iron). It starts where the real ruler stood. Iron cards push it up (crackdowns, military trials, a banned party); Open cards push it down (elections, amnesty, a free press). An Islamist can rule open or iron; a liberal can too.
| Band | Effect |
|---|---|
| Iron (60+) | Iron cards in hand. Authority +2 a month (fear). Each faction under 30 loses 2 more support a month (resentment). |
| Middle (41-59) | Neither family. |
| Open (40 or less) | Open cards in hand. Each faction at 60+ gives 2 Authority instead of 1. Election situations become eligible, and you can lose them. |

## Resources
| Resource | Comes from | Spent on | Egypt name |
|---|---|---|---|
| **Authority** (small integer) | 2 a month, +1 per faction at 60+, grip effects | most cards (1 to 4) | Mandate |
| **Treasury** (world units) | the world's monthly balance (written at build; Egypt 2011 drains), patron cards, some answers and laws | subsidy and patronage cards | Reserves ($B) |
Treasury under 0 at a month end forces a bread-riot class situation and every faction -5. Two month ends in a row under 0 is a fall (state collapse), warned a month ahead.

## The hand (powers)
A fixed hand, no draw, at most 6 cards, 2 plays a month. The hand is dimmed until the month's situation is answered.
- **2 basic cards, always:** Talk to a faction (1 Authority: +8 support, a 0.05 step toward it) and Address the nation (1 Authority: a 0.08 step toward a corner you pick).
- **Up to 4 power cards, from where you stand:**
  - **Zone laws:** the laws of each corner whose zone you are in (tier I within 0.9 of the corner, II within 0.6, III within 0.3) and of the Pragmatist centre (within 0.25 of the middle). A law, once enacted, is permanent and leaves the hand for the statute book.
  - **Grip cards:** Iron or Open, by band.
  - **Patron cards:** a patron at 60+ offers its card (aid, a loan, arms, mediation).
  When more than 4 are eligible, the hand shows the highest tiers and "+N more".
- **Upgrades (growth, chosen):** the first time you reach tier II or III of any corner, the centre, or a grip extreme (20 or less, 80 or more), pick 1 of 3 upgrades from a fixed catalog of about 15 (world-named), or skip. 3 to 5 picks a term. Examples: Talk costs 0; laws of this corner cost 1 less; patron cards twice as strong; a third play every third month.

## A month
1. **Situation.** One card, carried by a named person, with 2 answers. Before choosing, each answer shows only its text and a **"who cares" mark** per faction or patron it moves: 1 to 3 dots, no direction, no ideology. After choosing, **the reveal**: the ideology stamp, the marker moving, each change with a one-line reason, and on history cards the line "In history: ...". Next month's situation shows face down with its title only.
2. **2 plays** from the hand. A card you cannot pay for shows greyed with its price.
3. **Month end.** Support drifts, the balance is paid, factions and patrons declare their **intents** for next month with the trigger number. A divergence meter shows how far your timeline is from history.

## Numbers (engine-owned; Jev never sets a number)
| Rule | Value |
|---|---|
| Answer push toward a corner or the centre | small 0.08, medium 0.15, large 0.25 (unit circle) |
| Affinity of a faction | 100 x (1 - distance / 2) |
| Patron affinity | the same, plus its grip preference (written at build): -10 per 20 grip points away from it |
| Support drift each month end | 25% of the gap toward affinity |
| Direct change from an answer or card | 4, 8 or 12 (small, medium, large) |
| Fall line (factions) | under 15 |
| Authority at start / cap | 6 / 12 |
| Card costs | Authority 1 to 4 by tier; Treasury in world units |
All values are TUNE constants in one file; the bot sims set the final values.

## Factions and patrons act (Jev)
At month end one Jev call fans out one Choice per faction and per patron, over a closed list by support band:
| | 60+ | 30-59 | 15-29 | under 15 |
|---|---|---|---|---|
| Faction | back you (+2 Authority), negotiate | back you, negotiate, march (marker pushed 0.05 toward it, -1 Authority), strike (-2 Authority) | negotiate, march, strike | **plot** (forced): "brings you down at the end of next month if still under 15" |
| Patron | aid (its card stays cheap), pressure (its next situation first) | pressure, stay quiet | pressure, stay quiet | **sanction** (forced): its monthly sanction, written at build, hits Treasury |
The state holds the actor's persona, support, corner, your grip, and your last 3 answers and plays. A plot still under 15 at the next month end ends the run in that faction's own way (written at build: a coup, an uprising, a walkout). **Losing is never a surprise.**

## History track and divergence
- The build writes **10 to 15 dated history cards**: the real events of the term (Egypt: the referendum, Maspero, Mohamed Mahmoud, the parliamentary elections, Port Said, the presidential vote). For an alternate-history premise, the build writes that world's own canon.
- Before a history card fires, one Jev Noul asks whether it still happens in this timeline, given the state; the engine rolls (seeded). If it happens, it is the month's situation: a fork with 2 real roads, one tagged as the road history took. If it does not, the reveal says what history did instead.
- **Divergence** = the share of history cards that did not happen plus history forks you took differently. The epilogue lists each history card: "In history" beside "In yours".

## Story director (Jev)
The deck holds **60 to 80 situations** per world plus the history cards (Old World needed 3,000+ events; 30 to 40 is used up in about 3 terms). A situation is eligible by month window, zone, grip band, flags set by earlier answers, and support bands. Jev picks the next one with one Choice over the eligible cards, given last month. Ties and Jev failures fall back to an engine weighted pick with a seeded RNG. Later: a cheap model writes fresh situations per run.

## Visions and the Reckoning (the goal)
- The build writes **4 to 6 Visions** from paths that really existed, covering every corner and the centre at least once (Egypt: The new Pharaoh, The Western partner, The Arab nationalist, The Islamic project, The national consensus), plus **Free hand** for players who want no goal. Each Vision has 3 to 4 engine-checkable pillars: a zone or tier, a grip band, a law enacted, a faction or patron at a support level, Treasury above a level.
- Once a term the player may switch Vision for 3 Authority.
- **The Reckoning** is the world's natural climax, set by the build, 12 to 18 months in (Egypt: SCAF's promised handover, 30 June 2012, month 17). At its month end: your order **endures** if the power-weighted average support of the factions (weights written at build) is 50 or more.
- Outcomes: Vision fulfilled (endures, all pillars), survived (endures), swept away (does not endure), fallen (before the Reckoning). The Free hand score is average support and divergence.

## Jev's jobs (about 3 calls a month, about $0.01 a term)
Faction and patron moves; the story director; history plausibility. At build: the legibility check (below). Jev never sets a number.

## The world build (offline script in the prototype)
- One big Opus 5.5 call writes the world JSON (owner: one big call; model tests come after the prototype). Content: polity, office, start date, Reckoning, theme tokens, corners, factions (position, starting support, persona, power weight, how it brings you down), patrons (position, grip preference, card, sanction), the marker and grip start, the monthly Treasury balance, laws (3 per corner by tier, 2 centre), grip and patron cards, Visions with pillars, 60 to 80 situations, 10 to 15 history cards.
- Validation: schema, counts, every Vision pillar checkable and reachable, each corner gets an equal share of answer pushes (within 1), every change has a reason, positions inside the polygon. One repair call on failure.
- **Legibility check (Jev):** for each answer, a Choice over the corners and the centre from its text; under 0.6 on its own target means too vague to guess, and it goes to one repair call.
- The content rule carries over unchanged (`CONTENT_RULE`).
- Prototype worlds: Egypt, February 2011; USA, January 2022; Kepler Base, 1 AE.

## Stack (prototype)
Local only. A Bun server holds the OpenRouter key and calls Jev (call shape from `worker/jev.ts`). The client is React 19 and Vite in the picked look. The engine is pure TypeScript shared by client, server and bots. Branch `restart`; v4 is untouched.

## Verification
- **Bot sims** (engine only, a Jev stand-in), 1,000 terms per world per bot: random; one greedy bot per Vision; one adaptive bot (2-month lookahead, switches Vision when behind). Targets:
  - random falls in 60% or more of terms;
  - **no dominant ideology:** every per-Vision bot fulfils its Vision at a rate within 15 points of the others, in every world;
  - **skill pays:** the adaptive bot beats every single-plan bot by 15 points or more;
  - no single card is the best play in more than 50% of months.
  A world that fails is repaired (situation coverage, law strength) before it enters the library.
- **One E2E run** in Chrome per world: a full term by script against real Jev, a screenshot per month and the run log as a repeatable artifact.
- Then the owner plays 2 terms, with a short interview after each.

## Out of scope for the prototype
In-app world generation, model optimisation, fresh per-run situations, ideology shifts, the name, Steam, mobile, sound, sharing.
