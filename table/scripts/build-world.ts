// Build one world pack with the real models.
//   bun scripts/build-world.ts "<scenario prompt>" <slug> [--budget 9]
// Writes packs/<slug>/{world,deck,skin,music.brief,metrics}.json; raw answers, part files and run.log go to build/out/<slug>/.
import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { checkPack, type Pack } from "../engine";
import { finish, init, secs } from "../build/llm";
import { buildDeck, buildMusic, buildSkin, buildWorld, CONFIG } from "../build/pipeline";
import { reach } from "../build/reach";
import { apiKey } from "./key";

const args = process.argv.slice(2), bi = args.indexOf("--budget"), budget = bi >= 0 ? Number(args.splice(bi, 2)[1]) : 9;
const [scenario, slug] = args;
if (!scenario || !/^[a-z0-9-]+$/.test(slug ?? "") || !(budget > 0)) {
  console.error('usage: bun scripts/build-world.ts "<scenario prompt>" <slug> [--budget dollars]');
  process.exit(2);
}

const ROOT = new URL("..", import.meta.url).pathname, PACK = `${ROOT}packs/${slug}/`, OUT = `${ROOT}build/out/${slug}/`;
const PACK_FILES = new Set(["world.json", "deck.json", "skin.json", "music.brief.json", "metrics.json"]);
mkdirSync(PACK, { recursive: true });
mkdirSync(OUT, { recursive: true });
const ctx = init({
  apiKey: apiKey(),
  budget,
  log: (msg) => {
    const line = `[${secs(ctx.t0)}s] ${msg}`;
    console.log(line);
    appendFileSync(`${OUT}run.log`, `${line}\n`);
  },
  save: (name, x) => writeFileSync((PACK_FILES.has(name) ? PACK : OUT) + name, typeof x === "string" ? x : JSON.stringify(x, null, 1)),
});

const T: Record<string, number> = {}, at = (k: string) => <X>(x: X) => ((T[k] = secs(ctx.t0)), x);
let world: any = null, deck: any = null;
try {
  world = await buildWorld(ctx, scenario, slug).then(at("world"));
  if (!world?.seeds?.length) throw new Error("world: no seeds to build on");
  const names = ["skin", "music", "deck"], parts = await Promise.allSettled([buildSkin(ctx, world).then(at("skin")), buildMusic(ctx, world).then(at("music")), buildDeck(ctx, world).then(at("deck"))]);
  parts.forEach((r, i) => r.status === "rejected" && ctx.log(`${names[i]} failed: ${r.reason?.message}`));
  if (parts[2].status === "fulfilled") deck = parts[2].value;
} catch (x) {
  ctx.log(`stopped: ${(x as Error).message}`);
  ctx.steps.stopped = (x as Error).message;
}
T.full = secs(ctx.t0);

// the final pack, checked again as play will load it
const pack = { world, deck } as unknown as Pack, engine = world && deck ? checkPack(pack) : ["no world or no deck"], R = engine.length ? null : reach(pack);
const hand = deck ? [...Object.values(deck.ideologies ?? {}).flatMap((x: any) => [x.power, x.law]), ...(deck.centreLaws ?? []), ...Object.values(deck.gripCards ?? {}).flat(), ...Object.values(deck.patronCards ?? {})].filter(Boolean) : [];
const force = { cards: hand.filter((c: any) => c.cost?.force).length, of: hand.length };
const times = { T_play: T.world != null && T.skin != null ? Math.max(T.world, T.skin) : null, T_month1: ctx.steps.deck?.month1 ?? null, T_full: T.full, marks: T };
const m = finish(ctx, { scenario, slug, config: CONFIG, budget, times, built: ctx.steps.deck?.built ?? 0, checkPack: engine, reach: R && { rates: R.rates, errors: R.errors, crashes: R.crashes, seconds: R.seconds }, force });
ctx.save!("metrics.json", m);

const pass = Object.fromEntries(Object.entries(ctx.steps).filter(([, s]: any) => s?.pass != null).map(([k, s]: any) => [k, s.pass ? "pass" : `${s.errors.length} error(s)`]));
console.log(`\n$${m.cost} of $${budget}; world ${T.world ?? "-"}s, skin ${T.skin ?? "-"}s, music ${T.music ?? "-"}s, deck ${T.deck ?? "-"}s, full ${T.full}s`);
console.log("checks:", JSON.stringify(pass));
console.log(`checkPack: ${engine.length} error(s)`, engine.slice(0, 10));
console.log(R ? `reach (${R.seconds}s): ${JSON.stringify(R.rates)}; ${R.errors.length} unreachable` : "reach: not run (checkPack failed)", R?.errors ?? "");
console.log(`force is a cost on ${force.cards} of ${force.of} hand cards`);
process.exit(engine.length || !R || R.errors.length ? 1 : 0);
