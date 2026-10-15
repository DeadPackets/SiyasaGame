// World build, ported from the spike (docs/mocks/gen/run.mjs): the world call (web search for facts; it also writes the ~32 seeds), then skin, music,
// the 3 rules parts and the situation batches in parallel. No file system: the caller's ctx.save stores what it wants.
// biome-ignore-all lint/suspicious/noExplicitAny: model JSON
import { checkPack, type Pack } from "../engine";
import { checkDeck, checkMusic, checkWorld, EMBLEMS, ICONS, PALETTE, repeats, SAMPLES, skinBrief, TAGS } from "./check.mjs";
import { type Cfg, type Ctx, init, messages, repair, secs, sleep, step } from "./llm";
import DECK from "./prompts/deck.md?raw";
import MUSIC from "./prompts/music.md?raw";
import SKIN from "./prompts/skin.md?raw";
import SKIN_REF from "./prompts/skin-reference.md?raw";
import WORLD from "./prompts/world.md?raw";
import { reach } from "./reach";
import { checkSkin, skinContext } from "./skin-check";

// Model and thinking level per part.
export const CONFIG: Record<"world" | "skin" | "music" | "deck", Cfg> = {
  world: { model: "anthropic/claude-opus-5.5", effort: "medium" },
  skin: { model: "anthropic/claude-opus-5.5", effort: "medium" },
  music: { model: "anthropic/claude-opus-5.5", effort: "medium" },
  deck: { model: "anthropic/claude-opus-5.5", effort: "medium" },
};

const catalogue = `### Tradition tags (tag: meaning)\n${Object.entries(TAGS).map(([k, v]) => `- ${k}: ${v}`).join("\n")}\n\n### Emblem kinds\n${EMBLEMS.join(", ")}, none\n\n### Resource icons\n${ICONS.join(", ")}\n`;
export const buildWorld = (ctx: Ctx, scenario: string, slug: string, cfg = CONFIG.world) =>
  step(ctx, "world", cfg, `${WORLD}\n${catalogue}`, `Scenario: ${scenario}\nSlug: ${slug}`, checkWorld, { maxTokens: 64000, repairTokens: 32000, web: true, file: "world.json" });

// skin: the patterns prompt and reference unchanged; this call cannot run commands, so the caller gives it the context and runs the checks
export async function buildSkin(ctx: Ctx, world: any, cfg = CONFIG.skin) {
  const brief = skinBrief(world);
  await ctx.save?.("skin-brief.json", brief);
  const user = `SLUG: ${world.id}\nMODEL: opus\n\nIn this call you cannot run commands or write files. The caller has run step 3 for you and gives its output below with the brief. ` +
    `Answer with the skin JSON only (step 4); the caller writes it, runs the validator (step 5) and sends back its errors. Skip step 6.\n\n## Brief (final/briefs/${world.id}.json)\n${JSON.stringify(brief, null, 1)}\n\n## Context (node final/validate.mjs --context)\n${JSON.stringify(skinContext(brief), null, 1)}\n`;
  return step(ctx, "skin", cfg, `${SKIN}\n\n${SKIN_REF}`, user, (skin) => checkSkin(skin, brief), { maxTokens: 16000, file: "skin.json" });
}

// music: the palette is the arranger's own, cut to the sounds the sample set holds
export function buildMusic(ctx: Ctx, world: any, cfg = CONFIG.music) {
  const S = SAMPLES as Record<string, unknown>, P = PALETTE as Record<string, any>;
  const sounds = Object.entries(P).filter(([s, p]) => S[p.sample ?? s] || s.startsWith("syn_"))
    .map(([s, p]) => `- ${s}: range MIDI ${p.range[0]}-${p.range[1]}${p.pluck ? ", plucked" : ""}${p.sample ? `, a ${p.sample} recording played softer` : ""}${["short", "trem", "pizz"].filter((k) => p[k]).map((k) => `, ${k}: ${p[k]}`).join("")}`).join("\n");
  const hits = Object.keys(S).filter((s) => !P[s]).join(", ");
  const sys = `${MUSIC}\n### Sounds\n${sounds}\n\n### Hit samples (for rhythm, cymbal and fills)\n${hits}\n`;
  const w = { title: world.title, polity: world.polity, date: world.date, voice: world.voice, music: world.music, compass: world.compass,
    ideologies: world.ideologies.map(({ id, name, stands, base, culture, mood, sound }: any) => ({ id, name, stands, base, culture, mood, sound })) };
  return step(ctx, "music", cfg, sys, `World:\n${JSON.stringify(w, null, 1)}`, (b) => checkMusic(b, world), { maxTokens: 16000, file: "music.brief.json" });
}

// ---------- deck ----------
export interface Part { name: string; only: string[]; max: number; msg: string; seeds?: any[]; situations?: [number, number]; callbacks?: [number, number]; quota?: Record<string, number>; done?: number }

// rules: 3 parts; code sets the history quota per corner. Visions and combos sit with the cards they point at.
const RULES = [["ideologies", "centreLaws", "picks", "gripCards", "patronCards", "visions", "combos"], ["intents", "elections"], ["history"]];
const rulesParts = (world: any): Part[] => {
  const I: string[] = world.compass, k = I.length, hq = Math.round(30 / k), per = Object.fromEntries(I.map((i) => [i, hq]));
  // ponytail: no quota on rules-c, as in the spike (its `quota:` sat inside a comment there), so history is checked "within 1 of an equal share"
  return RULES.map((only, i) => ({ name: `rules-${"abc"[i]}`, only, max: [24000, 32000, 40000][i],
    msg: `Your part: RULES ${"ABC"[i]} of 3. Write only ${only.join(", ")}, with the deck-wide counts. ` +
      (only.includes("history") ? `History cards: 10 to 15 from the world's timeline, in date order, with exactly ${hq} answers per corner across them (${hq * k} answers): ${JSON.stringify(per)}. ` : "") +
      (only.includes("intents") ? "Answers of intent and election cards count toward no quota. " : "") +
      `Ids as in Shapes. Flags you set start with "r${"abc"[i]}_"; cards you write require or block only flags you set yourself.` }));
};

// situations: batch 1 = up to 6 seeds starting in months 1-3, small so month 1 is ready first; the rest in batches of 8 to 10.
// Each batch writes callbacks on its own flags (1 for batch 1, 2 for the others); code sets each batch's answer quota per corner.
const sitParts = (world: any): Part[] => {
  const I: string[] = world.compass, k = I.length, M = world.months, per = (q: number) => Object.fromEntries(I.map((i) => [i, q]));
  const S = [...world.seeds].sort((a, b) => a.months[0] - b.months[0] || a.id.localeCompare(b.id));
  const first = S.filter((x) => x.months[0] <= 3).slice(0, 6), rest = S.filter((x) => !first.includes(x)), nb = Math.max(1, Math.round(rest.length / 9));
  const batches = [first, ...Array.from({ length: nb }, (_, i) => rest.slice(Math.round((i * rest.length) / nb), Math.round(((i + 1) * rest.length) / nb)))].filter((b) => b.length);
  return batches.map((b, i) => {
    const cb = i ? 2 : 1, q = Math.round(((b.length + cb) * 2.5) / k);
    return { name: `sit-b${i + 1}`, only: ["situations", "callbacks"], seeds: b, situations: [b.length, b.length], callbacks: [cb, cb], quota: per(q), max: i ? 40000 : 24000,
      msg: `Your part: SITUATIONS, batch ${i + 1} of ${batches.length}. Write only situations and callbacks.\n` +
        `- situations: exactly one per seed below (${b.length} cards), each with the seed's id and months inside the seed's window.\n` +
        `- callbacks: exactly ${cb}, each requiring a flag that one of your situations sets; months after that situation's first month, up to ${M}. Ids c${i + 1}1 to c${i + 1}9.\n` +
        `- Every flag you set starts with "b${i + 1}_".\n` +
        `- Quota: across your situations and callbacks, exactly ${q} answers per corner (${q * k} answers): ${JSON.stringify(per(q))}.\n` +
        `- Another part writes the history cards for the timeline events; your situations are the decisions around them, never the event itself as a card.\n\n` +
        `Your seeds (the world's seeds list shows the rest):\n${JSON.stringify(b, null, 1)}` };
  });
};

// the deck's parts in start order: batch 1 first, then the longest, so the budget guard holds back the last ones
export function deckPlan(world: any) {
  const sit = sitParts(world), [ra, rb, rc] = rulesParts(world);
  return [sit[0], rc, rb, ...sit.slice(1), ra];
}
// every deck part shares one cached prefix (deck.md + the world)
const partMessages = (world: any, p: Part): [string, string[]] => [DECK, [`World:\n${JSON.stringify(world, null, 1)}`, p.msg]];
export function buildDeckPart(ctx: Ctx, world: any, p: Part, cfg = CONFIG.deck) {
  return step(ctx, p.name, cfg, ...partMessages(world, p), (d) => checkDeck(d, world, p), { maxTokens: p.max, repairTokens: 24000, file: `${p.name}.json` })
    .then((d) => { p.done = secs(init(ctx).t0); return d; });
}
const assemble = (parts: Part[], got: Record<string, any>) => {
  const S = parts.filter((p) => p.name.startsWith("sit-")).map((p) => got[p.name] ?? {});
  return { ...got["rules-a"], ...got["rules-b"], ...got["rules-c"], situations: S.flatMap((d) => d.situations ?? []), callbacks: S.flatMap((d) => d.callbacks ?? []) };
};

// merge the parts, check the deck at the sizes built, then the Vision reach check (N1): unreachable or too-easy Visions go to one rules-a repair
export async function finishDeck(c: Ctx, world: any, parts: Part[], got: Record<string, any>, cfg = CONFIG.deck) {
  const ctx = init(c), t = Date.now();
  let deck: any = assemble(parts, got);
  const sit = parts.filter((p) => p.name.startsWith("sit-")), cb = sit.reduce((a, p) => a + (p.callbacks?.[0] ?? 0), 0);
  const sizes = { situations: [world.seeds.length, world.seeds.length], callbacks: [cb, cb] };
  const pack = () => ({ world, deck }) as unknown as Pack;
  let engine = checkPack(pack()), R = engine.length ? null : reach(pack());
  const r0 = R && { rates: R.rates, errors: R.errors };
  ctx.log(`reach: ${engine.length ? `skipped, checkPack has ${engine.length} error(s) ${JSON.stringify(engine.slice(0, 4))}` : `${R!.seconds}s ${JSON.stringify(R!.rates)}`}`);
  if ((R?.errors.length || R?.easy.length) && got["rules-a"]) {
    const ra = parts.find((p) => p.name === "rules-a")!, check = (d: any) => checkDeck(d, world, ra), before = check(got["rules-a"]).length;
    try {
      const fixed = await repair(ctx, "rules-a", 3, cfg, messages(...partMessages(world, ra)), got["rules-a"], "", [...R.errors, ...R.easy], check, 24000);
      const deck2 = assemble(parts, { ...got, "rules-a": fixed.cur }), engine2 = checkPack({ world, deck: deck2 } as unknown as Pack);
      const R2 = engine2.length ? null : reach({ world, deck: deck2 } as unknown as Pack);
      ctx.log(`reach after the rules-a repair: ${fixed.errors.length} check error(s) (was ${before}), ${engine2.length} checkPack error(s), rates ${JSON.stringify(R2?.rates)}`);
      if (R2 && fixed.errors.length <= before && R2.errors.length <= R.errors.length && R2.errors.length + R2.easy.length < R.errors.length + R.easy.length) {
        got["rules-a"] = fixed.cur;
        deck = deck2;
        engine = engine2;
        R = R2;
        await ctx.save?.("rules-a.json", fixed.cur);
      }
    } catch (x) {
      ctx.log(`rules-a reach repair failed: ${(x as Error).message}`);
    }
  }
  await ctx.save?.("deck.json", deck);
  const errors = checkDeck(deck, world, sizes), hits = repeats(deck, world);
  const corners = Object.fromEntries(world.compass.map((i: string) => [i, world.seeds.filter((x: any) => x.corner === i).length]));
  ctx.steps.reach = { first: r0, rates: R?.rates ?? null, errors: R?.errors ?? null, crashes: R?.crashes ?? null, seconds: R?.seconds ?? null, repaired: r0 != null && R?.errors !== r0.errors };
  ctx.steps.deck = { seconds: secs(t), pass: !errors.length, errors, checkPack: engine, repeats: hits, built: deck.situations.length, corners, month1: sit[0]?.done ?? null,
    parts: parts.map((p) => ({ name: p.name, seeds: p.seeds?.map((x) => x.id), done: p.done ?? null })), failed: parts.filter((p) => !got[p.name]).map((p) => p.name) };
  ctx.log(`deck merged: ${deck.situations.length} situations, ${deck.callbacks.length} callbacks; ${errors.length} error(s), ${hits.length} repeat(s) ${JSON.stringify(errors.slice(0, 6))}`);
  return deck;
}

// deck: all parts at once after the world; the first writes the cache, the rest start 5 s later so they read it
export async function buildDeck(ctx: Ctx, world: any, cfg = CONFIG.deck) {
  const parts = deckPlan(world);
  const out = await Promise.allSettled(parts.map((p, i) => sleep(i ? 5000 : 0).then(() => buildDeckPart(ctx, world, p, cfg))));
  out.forEach((r, i) => r.status === "rejected" && ctx.log(`${parts[i].name} failed: ${r.reason?.message}`));
  const got = Object.fromEntries(parts.map((p, i) => [p.name, out[i].status === "fulfilled" ? ((out[i] as PromiseFulfilledResult<any>).value ?? null) : null]));
  return finishDeck(ctx, world, parts, got, cfg);
}
