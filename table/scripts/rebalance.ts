// Re-run the deck finish (merge, checks, reach repair) on a built world's saved parts: no new content, one repair call at most.
//   bun scripts/rebalance.ts <slug>
import { readFileSync, writeFileSync } from "node:fs";
import { init } from "../build/llm";
import { deckPlan, finishDeck } from "../build/pipeline";
import { apiKey } from "./key";

const slug = process.argv[2], ROOT = new URL("..", import.meta.url).pathname, OUT = `${ROOT}build/out/${slug}/`, PACK = `${ROOT}packs/${slug}/`;
const world = JSON.parse(readFileSync(`${PACK}world.json`, "utf8")), parts = deckPlan(world);
const got = Object.fromEntries(parts.map((p) => [p.name, JSON.parse(readFileSync(`${OUT}${p.name}.json`, "utf8"))]));
for (const p of parts) if (p.name.startsWith("sit-")) p.done = 0;
const ctx = init({ apiKey: apiKey(), budget: 1, log: (m) => console.log(m), save: (n, x) => n === "deck.json" && writeFileSync(`${PACK}deck.json`, JSON.stringify(x, null, 1)) });
await finishDeck(ctx, world, parts, got);
console.log("reach", JSON.stringify(ctx.steps.reach), "spent", ctx.spent.toFixed(3), "deck errors", JSON.stringify(ctx.steps.deck.errors));
