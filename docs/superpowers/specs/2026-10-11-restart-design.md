# Restart: the Compass game (prototype design)

Date: 2026-10-11. Status: draft for owner review. Working title: Body Politic (not decided). Look: pending the owner's pick of 3 mocks (cinematic, tabletop, state papers).

## Why a restart
v4 "The Ruler" was not fun in 3 owner playtests. Measured: 16 to 34 clicks per signed act, 75 min per term, and in run 3 the player's 21 acts cost 17 final-vote points net, so doing nothing scored better. v4 grew systems (25 powers, typed orders, a clerk model that set numbers) to chase fun. The hits in the genre (Reigns 1.8M copies, Sultan's Game 1M+, Suzerain 650K+) share a small core: 2 answers per decision, 3 to 5 meters, one demand at a time, short terms, people carrying each choice.

## Goal
A single-player game where the player rules any world they choose, reads political situations, and steers the nation between real ideologies without being torn apart by its factions. Fun first, then accuracy. Desktop only, fullscreen.

## Player freedom (owner rule, 2026-10-11)
"Player freedom is critical. There should be no dominant ideology, and the powers the player has purely depend on their playstyle." So:
- Every corner and the Pragmatist centre is a viable way to win in every world. The start can be historically uneven (accurate starting support stays), but no corner is a trap and none is the best path.
- The player's powers come only from how they play: **what they stand for** (the zone gives its laws) and **how they rule** (the verbs they use grow stronger, see Mastery).
- The best player either adapts to the situation (moves across the Compass and keeps laws from earlier zones) or masters one style. Both must beat a player who does neither.

## Player flow
1. **Choose a world.** The only typing in the game: "Which world will you rule?". The library of built worlds shows below. Prototype: the library holds 3 worlds built offline; an unknown name says it is not built yet. Later: an unknown name starts one build.
2. **Briefing.** The polity, your office, the date, the Compass with each corner explained in one line, the factions on it, how you fall and how you win. Then pick 1 agenda, one per corner plus one for the centre, and press Take office.
3. **The term.** 12 months. Each month: 1 situation, then 2 actions, then month end.
4. **The end.** You fall (a faction brings you down) or you reach month 12. The ending names your rule by your final zone ("Egypt under a Pragmatist"), scores the agenda, and replays the answers that decided the term.

## The Compass
- A regular polygon with **3 to 5 corners** on a unit circle. The build sets the count for the era. Each corner is a real political ideology of that place and time under its period name (Egypt 2011: Military nationalism, Liberalism, Islamism, Salafism, Nasserism; Ottoman 1520: Absolutism, Theocracy, Feudalism). Ideologies are never parties.
- The build orders the corners: allies next to each other, enemies opposite.
- Each corner maps to one **archetype** from a fixed game catalog (Order, Faith, Market, Collective, Nation, Reform, Tradition, Technocracy, Liberty, Commons). The archetype is a game rule and sets the kinds of laws that corner can hold. The world gives the names. No world fact is hardcoded.
- **Factions** (4 to 6) are fixed points on the field, placed by their real positions. A faction is an actor that can decide and act as one (the owner's group-split rule).
- **The marker** is the ruler's position. It starts where the real ruler stood on the start date (set by the build).
- No ideology shifts during a run in the prototype (owner, 2026-10-11: later).

## Numbers (engine-owned; Jev never sets a number)
| Rule | Value |
|---|---|
| Answer push toward a corner or the centre | small 0.08, medium 0.15, large 0.25 (unit circle) |
| Address the nation push | 0.08 toward the picked corner |
| Win over push | 0.05 toward the faction's point |
| Affinity of a faction | 100 x (1 - distance / 2) |
| Support drift each month end | 25% of the gap toward affinity |
| Direct support change from an answer | 4, 8 or 12 (written at build as small, medium, large) |
| Fall line | support under 15 |
| Legitimacy at start / income each month | 6 / 2 + 1 per faction at 60 or more |
| Action costs | law tier I 2, tier II 4, tier III 6, centre law 3; win over 2 (+8 support); crack down 3 (-6 support, blocks its move; factions whose corner has the Order archetype +4); address 1 |
| Zones | tier I: within 0.9 of a corner; II: within 0.6; III: within 0.3; Pragmatist centre: within 0.25 of the middle |

All values are TUNE constants in one file; the bot sims below set the final values.

## A month
1. **Situation.** One card from the world's deck, carried by a named person. 2 answers. Before choosing, each answer shows only its text and a **"who cares" mark** per faction it moves: 1 to 3 dots by size, no direction, no ideology (owner ruling). After choosing, **the reveal**: the ideology stamp, the marker moving, and each moved faction's change with a one-line reason written at build.
2. **2 actions** from 4 verbs, the same in every world, named by the world:
   - **Enact a law** from the book of the zone you stand in. Permanent. A law stays enacted after you move away.
   - **Win over a faction:** +8 support and a small step toward it.
   - **Crack down on a faction:** -6 support and its next move is blocked.
   - **Address the nation:** step toward a corner you pick.
   An action you cannot pay for is shown greyed with its price.
3. **Month end.** Support drifts, supports tick, Legitimacy is paid, then each faction shows its **intent** for next month with the trigger number ("Brotherhood: calls a Friday march; support 43").

## Factions act (Jev)
At month end, one Jev call fans out one Choice per faction. Options depend on the support band:
| Support | Options |
|---|---|
| 60 or more | back you (+2 Legitimacy), negotiate (its next situation is offered first if eligible) |
| 30 to 59 | back you, negotiate, march (marker pushed 0.05 toward its point, -1 Legitimacy), strike (-2 Legitimacy) |
| 15 to 29 | negotiate, march, strike |
| under 15 | plot (forced, not Jev): the intent says "brings you down at the end of next month if still under 15" |
The Jev state holds the faction's persona, its support, its corner, and the last 3 answers and actions with their ideology. A plot that is still under 15 at the next month end ends the run in that faction's own way (written at build: a coup, an uprising, a walkout). **Losing is never a surprise: a full month of warning.**

## Story director (Jev)
The deck holds 30 to 40 situations per world (prototype). A card is eligible by its month window, an optional zone, flags set by earlier answers, and a faction support band. Jev picks the next card with one Choice over the eligible cards, given the last month's events. Ties and Jev failures fall back to an engine weighted pick with a seeded RNG. Cost: about 2 Jev calls a month, about $0.005 a term.

## Agendas
The build writes **one agenda per corner plus one for the centre** (4 to 6), each from a path that really existed in that world (Tantawi: keep the army above the state, Military nationalism; hand power to an elected president, Liberalism; make a deal with the Brotherhood, Islamism; and so on). At Take office the player picks one. An agenda is engine-checkable: its zone at month 12 (tier II or deeper, or the centre) plus 2 of its 3 listed laws enacted. **Changing course:** once a term the player may switch agenda for 4 Legitimacy; laws already enacted count if listed. Score: reach month 12 (base), agenda met (large), average support (small).

## Mastery (how you rule)
Each of the 4 verbs gains a rank as you use it: rank I at 3 uses, II at 6, III at 10. A rank makes that verb stronger (TUNE):
| Verb | Rank I | Rank II | Rank III |
|---|---|---|---|
| Enact a law | laws cost 1 less | a law also gives +4 to factions in its corner | one free law per term |
| Win over | +10 instead of +8 | costs 1 | also lifts that faction's neighbour by 4 |
| Crack down | costs 2 | -8 instead of -6 | blocks 2 moves |
| Address the nation | push 0.10 | push 0.12 and +1 Legitimacy | a second address each month is free |
Ranks last the term. They show on the actions bar as small pips, so a player can see their style forming.

## The world build (offline script in the prototype)
- One big Opus 5.5 call writes the world JSON (owner: one big call). Model choice is tested later (owner: prototype first). Content: polity, office, start date, era, theme tokens, corners (3 to 5, period name, archetype, one line), factions (4 to 6, real names, position, starting support, persona, how it brings you down), the marker start, laws (3 per corner by tier plus 2 centre laws), 3 agendas, 30 to 40 situations.
- Validation: schema, counts, each corner gets an equal share of answer pushes (within 1), every faction delta has a reason, every agenda law exists, positions inside the polygon. One repair call on failure.
- **Legibility check (Jev):** for each answer, a Choice over the corners and the centre from the answer text and the world. An answer whose own push target scores under 0.6 is too vague to guess fairly; it goes back to one repair call.
- The content rule carries over unchanged (`CONTENT_RULE`): real interests, unmoralised; only orders of mass killing of civilians, ethnic cleansing or expulsion are refused.
- Prototype worlds: Egypt, February 2011; USA, January 2022; Kepler Base, 1 AE.

## Stack (prototype)
Local only. A Bun server holds the OpenRouter key and calls Jev (the call shape and client carry over from `worker/jev.ts`). The client is React 19 and Vite in the look the owner picks. The engine is pure TypeScript shared by the client, the server and the bots. Branch `restart`; v4 is untouched.

## Verification
- **Bot sims** (engine only, a Jev stand-in): 1,000 terms per world for each bot: random; one greedy bot per agenda (each corner and the centre); one bot per verb style (prefers one verb); one adaptive bot (2-month lookahead, switches agenda when behind). Targets:
  - random falls in 60% or more of terms;
  - **no dominant ideology:** the agenda-met rates of the per-agenda greedy bots are all within 15 points of each other, in every world;
  - **no dominant style:** the verb-style bots' survival rates are within 15 points of each other;
  - **skill pays:** the adaptive bot beats every single-plan bot by 15 points or more;
  - no single action is the best pick in more than 50% of months.
  The build repairs a world that fails the ideology target (deck coverage, law strength) before it enters the library.
- **One E2E run** in Chrome per world: a full term played by script against real Jev, saving a screenshot per month and the run log as a repeatable artifact.
- Then the owner plays 2 terms. A short interview after each.

## Out of scope for the prototype
In-app world generation, model optimisation (Sonnet and Haiku tests), ideology shifts, the name, Steam, mobile, sound, sharing.
