# The platform: landing, world build, walkthrough, tutorial (design)

Amends `2026-10-12-card-table-design.md`: replaces its Player flow step 1 and step 2, its Levels section, its Stack (local Bun becomes Cloudflare Workers), and removes "In-app world generation" from its Out of scope.

## Owner rulings (2026-10-13)
- The world library is public and browsable.
- Every player prompt gets a cheap Jev safety check, then a similarity check that offers existing worlds before a new build.
- Runs on Cloudflare Workers, deployed to siyasa.deadpackets.pw. The game is named Siyasa (repo DeadPackets/SiyasaGame).
- 1 new world per IP per UTC day, with a counter. A global daily cap applies to world builds only. **Play is never capped.**
- Difficulty: 4 presets open from the start, plus Custom rules. The spec's levels unlocked by Visions are removed; a fulfilled Vision earns a badge on the world.

## Reused from v4 (`main`, `worker/`)
| Part | v4 file | Change |
|---|---|---|
| Similarity | `match.ts`: bge-m3 embedding, Vectorize top 20 above cosine 0.45, Jev picks load / offer / build | none |
| Gate | `BuildsDO.claim`: per-IP window and global daily build cap in one serialised call | window 10 min becomes 1 per UTC day; IPv6 keyed by /64 |
| Play cap | `BuildsDO.takeGame` (`DAILY_GAME_CAP` 200) | **removed** |
| Build | Workflow `ScenarioBuild` | new steps (below) |
| Identity | `identity.ts` signed cookie | none; it lists "your worlds" |
| Content | `CONTENT_RULE` | none |

## A prompt, step by step
1. Turnstile (managed mode) token checked by the Worker. Fail: "Try again."
2. Jev Noul: "This prompt asks for content the content rule refuses, harasses a private person, or is sexual." At 0.5 or higher: refuse in one line, no build, no count.
3. `match.ts`. **Load**: open that world. **Offer**: show the similar worlds, "Play" as the primary action, "Build mine anyway" as the quiet one. **Build**: go on.
4. `BuildsDO.claim(ip, "build", day, daily=true)`. "spaced": "One new world a day. Play any world in the library." "capped": "New worlds open at 00:00 UTC."
5. Start the Workflow. The build costs the slot even if the player leaves.

## The build (Workflow steps)
| Step | Writes | Needs |
|---|---|---|
| 1 Frame | name, polity, office, dates, era brief, each ideology's and faction's brief | prompt |
| 2 Skin | recipe (Opus, `patterns/final/prompt.md`), validated, up to 2 repairs | 1 |
| 3 Music | music brief, arranger validator | 1 |
| 4 Deck | situations, cards, laws, Visions, history and callbacks | 1 |
| 5 Checks | pack validation and legibility (card-table spec), one repair call | 2, 3, 4 |
| 6 List | Jev Noul on the built name and blurb (same rule as step 2 of the prompt path), Vectorize upsert, library row | 5 |

Steps 2, 3 and 4 run in parallel after step 1. Every Opus call starts with the same cached prefix: content rule, then the frame from step 1. The detail of steps 1 and 4 is the next spec (world information generation, owner plan step 3).

The client follows a build by polling its status every 1.5 s; each finished step's output is in the status, so the page can paint with it.
<!-- ponytail: polling; a DO WebSocket only if 1.5 s feels late in the mock. -->

## Landing
- One focus: a large text box, "What world do you want to rule today?", and its submit. Turnstile does not show unless Cloudflare asks.
- Each visit takes one built world from the library at random and wears its skin: display face, palette, ideology pattern, finish. The reading layer (Hanken Grotesk, sizes, controls) never changes.
- Below the fold, in order: how a term plays (3 beats, one line each, with a moving board fragment), then the library.
- Library: one card per world in its own skin; sort by most played or newest; search uses the same embedding as the similarity check.

## The build screen
- Starts in a neutral skin (no world colours). Each step that finishes paints the page: the frame sets the name and date, the skin floods colour, font and pattern in, music fades in when its brief arrives, and the deck fills a card count.
- The player can leave; the world appears under "your worlds" and in the library when listed.
- A failed build says so in one line and gives the slot back.

## The walkthrough (replaces the Briefing)
One idea per screen, each with Next and "Skip to the board":
1. The world: polity, office, date, the situation in 2 lines.
2. The people: each faction with its medallion and what it wants.
3. The ideas: the Compass corners, each ideology's pattern flashed once.
4. Your means: the 4 resources with their world names.
5. The clock: the Reckoning date and what it asks.
6. Difficulty: the 4 presets, with Custom behind a link.
7. A Vision, or Free hand.
8. The pledge: a full-screen oath in the world's face and music; Take office.

## The guided first month (replaces D9 coach marks)
- On by default for a player's first run; "Skip the tutorial" always visible; replay from Settings.
- One step per moment: draw, read the answers, Decide, the reveal, File, play a card, End month, the recap.
- Each step lights one target and dims the rest. Everything else is `inert`, so no other click or key works until the step is done or skipped.

## Difficulty
Presets set these rules; the bots set the numbers.
| Rule | Story | Standard | Hard | Brutal |
|---|---|---|---|---|
| Drift strength | low | base | base | 25% |
| A faction brings its intent under | 25 | 30 | 35 | 35 |
| A faction acts under | 10 | 15 | 15 | 20 |
| Patron sanctions | half | base | base | double |

The world sets the term (12 to 18 months to its Reckoning); presets never change it (owner, 2026-10-15).

Custom shows the same 4 rules as controls, starting from a preset. Badges and the library's "most played" count each preset apart.

## Costs and caps
- `DAILY_BUILD_CAP` stays a var; a cap that is not a number closes the gate (as in v4).
- Play: about 40 Jev calls a run (estimate, not measured). A daily Jev budget var; past it, each call uses its fallback from the card-table spec, so play continues.

## Library moderation
- Hidden worlds: a `hidden` column the owner sets by `wrangler d1 execute`. No report button in this version.

## Rebrand and launch (owner, 2026-10-14)
- Name Siyasa, Worker `siyasa`, custom domain siyasa.deadpackets.pw, repo DeadPackets/SiyasaGame (renamed; GitHub redirects the old URL).
- No saved data is kept. On launch day, in one step: delete the v4 D1 `usoj`, the Vectorize index `usoj-scenarios`, the `GameDO` and `BuildsDO` classes and the `build`/`daily` Workflows; create D1 `siyasa`, Vectorize `siyasa-worlds` (bge-m3, 1024, cosine) and the new classes; point unitedstatesofjev.deadpackets.pw at siyasa.deadpackets.pw.
- Until launch, v4 keeps running untouched at the old address.
- Cookie `siyasa_id` replaces `usoj_id`.

## Out of scope
Accounts, cloud saves across devices, a report button, a light theme, mobile.

## Open
- World information generation (steps 1 and 4 in detail): the next spec.
- Taste: 2 to 3 mocks each for the landing, the build screen, the walkthrough and the guided month, picked by the owner before code.
