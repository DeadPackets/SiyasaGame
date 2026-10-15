// Revise a library pack after the owner's first playtest (O12, O14, O16, O4): plain-words text, power cards with a player choice,
// no card carriers; optionally a new music brief and one Vision spread repair. Numbers and effects of other cards never change.
//   bun scripts/revise.ts <slug> [--music] [--spread] [--budget 4]
// biome-ignore-all lint/suspicious/noExplicitAny: model JSON
import { readFileSync, writeFileSync } from "node:fs";
import { checkPack, type Pack } from "../engine";
import { checkDeck, LIMITS } from "../build/check.mjs";
import { init, step } from "../build/llm";
import { buildMusic, CONFIG } from "../build/pipeline";
import DECK from "../build/prompts/deck.md?raw";
import { reach } from "../build/reach";
import { apiKey } from "./key";

const args = process.argv.slice(2), flag = (f: string) => (args.includes(f) ? (args.splice(args.indexOf(f), 1), true) : false);
const music = flag("--music"), spread = flag("--spread"), bi = args.indexOf("--budget"), budget = bi >= 0 ? Number(args.splice(bi, 2)[1]) : 4;
const slug = args[0], PACK = `${new URL("..", import.meta.url).pathname}packs/${slug}/`;
const read = (f: string) => JSON.parse(readFileSync(PACK + f, "utf8")), write = (f: string, x: unknown) => writeFileSync(PACK + f, JSON.stringify(x, null, 1));
const world = read("world.json"), deck = read("deck.json");
const ctx = init({ apiKey: apiKey(), budget, log: (m) => console.log(m) });
const sys = `${DECK}\n\nWorld:\n${JSON.stringify(world, null, 1)}`;
const wc = (s: unknown) => (typeof s === "string" ? s.trim().split(/\s+/).filter(Boolean).length : 0);

// ---------- text: plain words, same ids, same shape ----------
const cards = [...deck.situations, ...deck.history, ...deck.callbacks, ...deck.elections, ...Object.values(deck.intents)] as any[];
const textOf = (c: any) => ({ title: c.title, question: c.question, body: c.body, ...(c.history ? { history: c.history } : {}),
  answers: c.answers.map((a: any) => ({ text: a.text, sub: a.sub, reasons: a.reasons, ...(a.gripWhy ? { gripWhy: a.gripWhy } : {}) })) });
const hands = [...Object.values(deck.ideologies).flatMap((i: any) => [i.law, ...i.picks]), ...deck.centreLaws, ...Object.values(deck.picks).flat(), ...Object.values(deck.gripCards).flat(), ...Object.values(deck.patronCards)] as any[];
const TEXT_ASK = `Rewrite the player-facing text below in plain words (the "Plain words" rule). Same meaning, same facts, same names of holders, same ids and the same keys; only the wording changes. Every field stays within its word limit (${JSON.stringify(LIMITS)}). Every question asks what YOU will do. Keep each reason from its holder's point of view. Answer with one JSON object keyed by id, in the same shape as the input.`;
const textCheck = (src: Record<string, any>) => (out: any) => {
  const e: string[] = [];
  for (const [id, c] of Object.entries(src)) {
    const o = out?.[id];
    if (!o) { e.push(`${id}: missing`); continue; }
    for (const k of Object.keys(c)) if (k !== "answers" && k !== "reasons" && typeof o[k] !== "string") e.push(`${id}.${k}: missing`);
    for (const k of ["title", "question", "body", "history", "flavour"]) if (c[k] != null && wc(o[k]) > (LIMITS as any)[k]) e.push(`${id}.${k}: ${wc(o[k])} words; at most ${(LIMITS as any)[k]}`);
    if (c.question != null && !/\byour?s?\b/i.test(o.question ?? "")) e.push(`${id}.question: ask what YOU will do`);
    if (c.answers) {
      if (o.answers?.length !== c.answers.length) { e.push(`${id}: needs ${c.answers.length} answers`); continue; }
      c.answers.forEach((a: any, i: number) => {
        const b = o.answers[i];
        for (const k of ["text", "sub", "gripWhy"]) if (a[k] != null && (typeof b?.[k] !== "string" || wc(b[k]) > (LIMITS as any)[k])) e.push(`${id} answer ${i + 1}.${k}: missing or over ${(LIMITS as any)[k]} words`);
        for (const h of Object.keys(a.reasons ?? {})) if (typeof b?.reasons?.[h] !== "string" || wc(b.reasons[h]) > LIMITS.reason) e.push(`${id} answer ${i + 1} reason ${h}: missing or over ${LIMITS.reason} words`);
      });
    }
  }
  return e;
};
const chunks: Record<string, any>[] = [];
for (let i = 0; i < cards.length; i += 16) chunks.push(Object.fromEntries(cards.slice(i, i + 16).map((c) => [c.id, textOf(c)])));
chunks.push(Object.fromEntries([...hands.map((h) => [h.id, { title: h.title, flavour: h.flavour }]), ...deck.visions.map((v: any) => [v.id, { name: v.name, line: v.line, corner: v.corner, pillars: v.pillars.map((q: any) => q.text) }])]));
const holders = [...world.factions, ...world.patrons];
const worldText = Object.fromEntries(holders.map((h: any) => [h.id, { who: h.who, act: h.act.text, fall: h.fall, hi: h.fates.hi, lo: h.fates.lo }]));

// ---------- powers: same id and cost, now with a choice ----------
const powersSrc = Object.fromEntries(world.compass.map((i: string) => [i, deck.ideologies[i].power]));
const POWER_ASK = `Rewrite each ideology's power card below so it follows the Choices rule: every power card includes at least one "choose", so the player bends it to whatever the board needs. Keep each id, keep its cost total (2 to 3), keep the ideology's spirit, and write its title and flavour in plain words. Answer with one JSON object {"<ideologyId>": card} for these ideologies only.\n\n${JSON.stringify(powersSrc, null, 1)}`;
const powerCheck = (out: any) => {
  const ideologies = Object.fromEntries(world.compass.map((i: string) => [i, { ...deck.ideologies[i], power: out?.[i] }]));
  return checkDeck({ ideologies }, world, { only: ["ideologies"] });
};

const jobs: Promise<any>[] = [
  step(ctx, "powers", CONFIG.deck, sys, POWER_ASK, powerCheck, { maxTokens: 8000, file: "powers.json" }),
  step(ctx, "world-text", CONFIG.deck, sys, `${TEXT_ASK}\n\n${JSON.stringify(worldText, null, 1)}`, textCheck(worldText), { maxTokens: 12000, file: "world-text.json" }),
  ...chunks.map((ch, k) => step(ctx, `text-${k}`, CONFIG.deck, sys, `${TEXT_ASK}\n\n${JSON.stringify(ch, null, 1)}`, textCheck(ch), { maxTokens: 24000, file: `text-${k}.json` })),
  music ? buildMusic(ctx, world) : Promise.resolve(null),
];
const [powers, wtext, ...rest] = await Promise.all(jobs.map((j) => j.catch((x) => (console.error(String(x)), null))));
const brief = rest.pop(), texts = rest;

// ---------- merge ----------
const failed = Object.entries(ctx.steps).filter(([, s]: any) => !s.pass).map(([k]) => k);
if (powers && ctx.steps.powers?.pass) for (const i of world.compass) deck.ideologies[i].power = powers[i];
texts.forEach((t, k) => {
  if (!t || !ctx.steps[`text-${k}`]?.pass) return;
  for (const [id, o] of Object.entries(t) as [string, any][]) {
    const c = cards.find((x) => x.id === id) ?? hands.find((x) => x.id === id), v = deck.visions.find((x: any) => x.id === id);
    if (v) { Object.assign(v, { name: o.name, line: o.line, corner: o.corner }); v.pillars.forEach((q: any, i: number) => { if (typeof o.pillars?.[i] === "string") q.text = o.pillars[i]; }); continue; }
    if (!c) continue;
    for (const k of ["title", "question", "body", "history", "flavour"]) if (c[k] != null) c[k] = o[k];
    c.answers?.forEach((a: any, i: number) => { const b = o.answers[i]; a.text = b.text; a.sub = b.sub; if (a.gripWhy) a.gripWhy = b.gripWhy; for (const h of Object.keys(a.reasons)) a.reasons[h] = b.reasons[h]; });
  }
});
if (wtext && ctx.steps["world-text"]?.pass) for (const h of holders) { const o = wtext[h.id]; Object.assign(h, { who: o.who, fall: o.fall }); h.act.text = o.act; h.fates = { hi: o.hi, lo: o.lo }; }
for (const c of cards) delete c.carrier;

// ---------- Vision spread (Rome, O4): one repair toward 35% to 85% for the focused bot ----------
const pack = () => ({ world, deck }) as unknown as Pack;
let errs = checkPack(pack()), R = errs.length ? null : reach(pack());
console.log("checkPack", JSON.stringify(errs.slice(0, 5)), "reach", JSON.stringify(R?.rates));
if (spread && R) {
  const ask = `The focused test bot fulfils each Vision this often over 40 terms on Standard: ${JSON.stringify(R.rates)}. Rewrite the Visions' pillars so every Vision lands between 35% and 85%: harden the easy ones, ease the hard ones, keep each Vision's idea and its id. Answer {"visions": [...]} with every Vision.\n\n${JSON.stringify(deck.visions, null, 1)}`;
  const v = await step(ctx, "visions", CONFIG.deck, sys, ask, (x: any) => checkDeck({ ...deck, visions: x?.visions }, world, { only: ["visions"] }), { maxTokens: 8000, file: "visions.json" }).catch(() => null);
  if (v?.visions) {
    const old = deck.visions;
    deck.visions = v.visions;
    const e2 = checkPack(pack()), R2 = e2.length ? null : reach(pack()), off = (r: Record<string, number>) => Object.values(r).filter((x) => x < 0.35 || x > 0.85).length;
    console.log("after spread", JSON.stringify(e2.slice(0, 5)), JSON.stringify(R2?.rates));
    if (!R2 || R2.errors.length || off(R2.rates) >= off(R.rates)) deck.visions = old;
    else { R = R2; errs = e2; }
  }
}
write("deck.json", deck);
write("world.json", world);
if (brief && ctx.steps.music?.pass) write("music.brief.json", brief);
console.log(JSON.stringify({ slug, spent: ctx.spent.toFixed(3), failed, checkPack: errs.length, rates: R?.rates }));
