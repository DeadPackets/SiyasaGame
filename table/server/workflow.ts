import { WorkflowEntrypoint, type WorkflowEvent, type WorkflowStep } from "cloudflare:workers";
import { NonRetryableError } from "cloudflare:workflows";
import { init, type Ctx } from "../build/llm";
import { buildDeckPart, buildMusic, buildSkin, buildWorld, deckPlan, finishDeck } from "../build/pipeline";
import type { Env } from "./env";
import { frameOf, indexWorld } from "./prompt";

// World and deck text reaches the page as HTML, and a world built from a stranger's prompt is public: its text loses angle brackets and straight double quotes. Music is left alone: it uses < > in its rhythm notation and never reaches the page as text.
export function clean<X>(x: X): X {
  if (typeof x === "string") return x.replace(/[<>]/g, "").replace(/"/g, "\u201d") as X;
  if (Array.isArray(x)) return x.map(clean) as X;
  if (x && typeof x === "object") return Object.fromEntries(Object.entries(x).map(([k, v]) => [k, clean(v)])) as X;
  return x;
}

export type BuildParams = { build: string; prompt: string; owner: string; key: string; day?: string };

// Each step returns small JSON and keeps the big parts in R2, so a retry or a resume reads them back for free.
// Budgets in dollars per step; Rome measured 6.06 in all (world 1.64, deck parts 0.2 to 0.8 each).
const LONG = { retries: { limit: 1, delay: "10 seconds" as const, backoff: "constant" as const }, timeout: "20 minutes" as const };
const BUDGET = { world: 2.5, skin: 0.6, music: 0.4, part: 1.5, finish: 0.4 };

export class WorldBuild extends WorkflowEntrypoint<Env, BuildParams> {
  async run(event: WorkflowEvent<BuildParams>, step: WorkflowStep) {
    const { build, prompt, owner, key, day = new Date(event.timestamp).toISOString().slice(0, 10) } = event.payload, env = this.env, dir = `builds/${build}/`, slug = `w-${build.slice(0, 8)}`;
    const ctx = (budget: number): Ctx => init({ apiKey: env.ANTHROPIC_API_KEY, budget, log: (m) => console.log(`[${build}] ${m}`) } as Ctx);
    const put = (name: string, x: unknown) => env.PACKS.put(dir + name, JSON.stringify(x));
    const get = async (name: string) => (await env.PACKS.get(dir + name))!.json<any>();
    const part = async (k: string, v: unknown) => {
      // json_set keeps the parts that other steps wrote in parallel
      await env.DB.prepare("UPDATE builds SET parts = json_set(parts, ?, json(?)) WHERE id = ?").bind(`$.${k}`, JSON.stringify(v), build).run();
    };
    try {
      await step.do("world", LONG, async () => {
        const c = ctx(BUDGET.world), built = await buildWorld(c, prompt, slug);
        // a check that still fails after its repairs is the same on a retry: stop, do not pay again
        if (!built?.seeds?.length || c.steps?.world?.pass === false) throw new NonRetryableError(`The world did not pass its checks: ${JSON.stringify(c.steps?.world?.errors?.slice(0, 3) ?? [])}`);
        const world = clean(built);
        world.id = slug;
        await put("world.json", world);
        await part("frame", frameOf(world));
        return { spent: c.spent };
      });
      const world = await get("world.json");
      const look = (name: "skin" | "music", fn: typeof buildSkin) => step.do(name, LONG, async () => {
        const c = ctx(BUDGET[name]), x = await fn(c, world);
        if (!x || c.steps?.[name]?.pass === false) throw new NonRetryableError(`The ${name} did not pass its checks.`);
        await put(`${name}.json`, x);
        await part(name, x);
        return { spent: c.spent };
      });
      const plan = deckPlan(world);
      const deckParts = plan.map((p) => step.do(`deck ${p.name}`, LONG, async () => {
        const c = ctx(BUDGET.part), d = await buildDeckPart(c, world, p);
        await put(`${p.name}.json`, d);
        if (p.name === plan[0].name) await part("month1", true);
        return { spent: c.spent };
      }));
      // rules parts first in the poll's eyes: the Visions count shows once rules-a is in
      const ra = plan.findIndex((p) => p.name === "rules-a");
      deckParts[ra].then(async () => part("rules", { visions: (await get("rules-a.json")).visions?.length ?? 0 })).catch(() => {});
      // every part settles before a failure ends the build, so no step keeps spending after the build is marked failed
      const all = await Promise.allSettled([look("skin", buildSkin), look("music", buildMusic as typeof buildSkin), ...deckParts]);
      const bad = all.find((r) => r.status === "rejected");
      if (bad) throw (bad as PromiseRejectedResult).reason;

      await step.do("deck", LONG, async () => {
        const got = Object.fromEntries(await Promise.all(plan.map(async (p) => [p.name, await get(`${p.name}.json`)])));
        const c = ctx(BUDGET.finish), deck = await finishDeck(c, world, plan, got);
        const d = c.steps?.deck;
        if (!d?.pass || d.checkPack?.length) throw new NonRetryableError(`The deck failed its checks: ${JSON.stringify([...(d?.errors ?? []), ...(d?.checkPack ?? [])].slice(0, 3))}`);
        await put("deck.json", deck);
        await part("deck", { count: deck.situations.length + deck.history.length + deck.callbacks.length });
        return { spent: c.spent };
      });

      await step.do("list", async () => {
        const [deck, skin, music] = await Promise.all([get("deck.json"), get("skin.json"), get("music.json")]);
        await env.PACKS.put(`packs/${slug}.json`, JSON.stringify({ ...clean({ world, deck, skin }), music }));
        const card = { palette: skin.palette, fonts: skin.fonts, finish: skin.finish, ideologies: skin.ideologies.slice(0, 3) };
        const blurb = String(world.timeline?.[0]?.event ?? world.reckoning.meaning).split(/(?<=\.)\s/)[0];
        await env.DB.prepare("INSERT OR REPLACE INTO worlds (id, title, polity, date, blurb, prompt, card, created, owner) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)")
          .bind(slug, clean(world.title), clean(world.polity), world.date, clean(blurb), prompt, JSON.stringify(clean(card)), Date.now(), owner).run();
        await indexWorld(env, { id: slug, title: world.title, polity: world.polity, date: world.date, blurb }).catch((e: unknown) => console.warn("index", e));
        await env.DB.prepare("UPDATE builds SET status = 'done', world = ? WHERE id = ?").bind(slug, build).run();
      });
    } catch (e) {
      await step.do("fail", async () => {
        await env.DB.prepare("UPDATE builds SET status = 'failed', error = ? WHERE id = ?").bind(String((e as Error)?.message ?? e).slice(0, 300), build).run();
        await env.GATE.get(env.GATE.idFromName("global")).release(key, day);
      });
    }
  }
}
