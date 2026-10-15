import { Hono } from "hono";
import type { Env } from "./env";
import { jev, underBudget } from "./jev";
import { verifyId } from "./identity";
import { onBuild, onPrompt } from "./prompt";

export { GateDO } from "./gate";
export { WorldBuild } from "./workflow";

const app = new Hono<{ Bindings: Env }>();
const ip = (req: Request) => req.headers.get("cf-connecting-ip") ?? "local";
const str = (x: unknown, max: number) => (typeof x === "string" ? x.slice(0, max) : "");

app.get("/api/worlds", async (c) => {
  const { results } = await c.env.DB.prepare("SELECT id, title, polity, date, blurb, card, plays, created FROM worlds WHERE hidden = 0 ORDER BY plays DESC, created DESC LIMIT 200").all();
  return c.json(results.map((r) => ({ ...r, card: JSON.parse(String(r.card)) })), 200, { "cache-control": "public, max-age=60" });
});

app.get("/api/worlds/:id", async (c) => {
  const obj = await c.env.PACKS.get(`packs/${c.req.param("id")}.json`);
  if (!obj) return c.json({ error: "This world is not built." }, 404);
  return new Response(obj.body, { headers: { "content-type": "application/json", "cache-control": "public, max-age=3600" } });
});

app.post("/api/worlds/:id/play", async (c) => {
  await c.env.DB.prepare("UPDATE worlds SET plays = plays + 1 WHERE id = ?").bind(c.req.param("id")).run();
  return c.json({ ok: true });
});

// Jev during play. Each route returns the engine's input or null; null means the client uses the engine fallback.
type Ctx = { world: string; date: string; month: number; grip: number; holders: { id: string; short: string; persona: string; support: number }[]; recent: string[] };
function ctxOf(body: unknown): Ctx | null {
  const b = body as Partial<Ctx> | null;
  if (!b || !Array.isArray(b.holders) || b.holders.length > 12) return null;
  return {
    world: str(b.world, 120), date: str(b.date, 20), month: Number(b.month) || 1, grip: Number(b.grip) || 0,
    holders: b.holders.map((h) => ({ id: str(h.id, 8), short: str(h.short, 40), persona: str(h.persona, 400), support: Math.round(Number(h.support) || 0) })),
    recent: (Array.isArray(b.recent) ? b.recent : []).slice(-3).map((x) => str(x, 200)),
  };
}

async function gate(c: { env: Env; req: { raw: Request } }, kind: string): Promise<boolean> {
  if (!c.env.OPENROUTER_API_KEY) return false;
  const { success } = await c.env.RL.limit({ key: ip(c.req.raw) });
  return success && (await underBudget(c.env, kind));
}

app.post("/api/jev/nudge", async (c) => {
  const body = await c.req.json().catch(() => null), ctx = ctxOf(body?.ctx), answer = str(body?.answer, 300), ids: string[] = (body?.moved ?? []).slice(0, 8).map((x: unknown) => str(x, 8));
  if (!ctx || !answer || !ids.length || !(await gate(c, "nudge"))) return c.json({ nudge: null });
  try {
    const qs = Object.fromEntries(ids.flatMap((id) => {
      const h = ctx.holders.find((x) => x.id === id);
      return h ? [[`n_${id}`, { type: "noul" as const, instructions: `The ruler chose: "${answer}". Holder: ${h.short}. ${h.persona} Given this holder's interests and the board now, does it take this choice better than a typical reaction would suggest? 0.5 = typical, 1 = much better, 0 = much worse.` }]] : [];
    }));
    const a = await jev(c.env, ctx, qs);
    return c.json({ nudge: Object.fromEntries(ids.filter((id) => a[`n_${id}`]?.noul != null).map((id) => [id, Math.round(((a[`n_${id}`].noul as number) - 0.5) * 6)])) });
  } catch {
    return c.json({ nudge: null });
  }
});

app.post("/api/jev/director", async (c) => {
  const body = await c.req.json().catch(() => null), ctx = ctxOf(body?.ctx);
  const cards: { id: string; title: string; question: string }[] = (body?.cards ?? []).slice(0, 5).map((x: { id: unknown; title: unknown; question: unknown }) => ({ id: str(x.id, 20), title: str(x.title, 80), question: str(x.question, 200) }));
  if (!ctx || cards.length < 2 || !(await gate(c, "director"))) return c.json({ pick: null });
  try {
    const a = await jev(c.env, ctx, {
      pick: { type: "choice", instructions: `Choose the card that makes the strongest next month for this ruler: it follows from what the ruler did lately, raises the stakes, and fits the date. Cards: ${cards.map((x) => `${x.id}: ${x.title}. ${x.question}`).join(" | ")}`, options: cards.map((x) => x.id) },
    });
    const p = a.pick?.probabilities ?? {};
    const top = Object.entries(p).sort((x, y) => y[1] - x[1])[0]?.[0];
    return c.json({ pick: cards.some((x) => x.id === top) ? top : null });
  } catch {
    return c.json({ pick: null });
  }
});

app.post("/api/jev/plausibility", async (c) => {
  const body = await c.req.json().catch(() => null), ctx = ctxOf(body?.ctx), event = str(body?.event, 300), date = str(body?.date, 20);
  if (!ctx || !event || !(await gate(c, "plausibility"))) return c.json({ p: null });
  try {
    const a = await jev(c.env, ctx, { p: { type: "noul", instructions: `In real history, on ${date}: ${event}. Given what this ruler has done so far, does this event still happen in this timeline? 1 = certainly, 0 = it cannot.` } });
    const p = a.p?.noul;
    return c.json({ p: typeof p === "number" ? Math.min(1, Math.max(0, p)) : null });
  } catch {
    return c.json({ p: null });
  }
});

app.get("/api/config", (c) => c.json({ turnstile: c.env.TURNSTILE_SITE_KEY ?? null }));

// your worlds: the ones this browser built (signed cookie), with any build still running
app.get("/api/mine", async (c) => {
  const raw = (c.req.header("cookie") ?? "").split(";").map((p) => p.trim()).find((p) => p.startsWith("siyasa_id="));
  const id = raw ? await verifyId(c.env.IDENTITY_SECRET, raw.slice(10)) : null;
  if (!id) return c.json({ worlds: [], builds: [] });
  const worlds = await c.env.DB.prepare("SELECT id, title, polity, date, blurb, card FROM worlds WHERE owner = ? ORDER BY created DESC LIMIT 50").bind(id).all();
  const builds = await c.env.DB.prepare("SELECT id, prompt, status, created FROM builds WHERE owner = ? AND status = 'running' ORDER BY created DESC LIMIT 5").bind(id).all();
  return c.json({ worlds: worlds.results.map((r) => ({ ...r, card: JSON.parse(String(r.card)) })), builds: builds.results });
});

app.post("/api/prompt", (c) => onPrompt(c.env, c.req.raw, c.executionCtx as ExecutionContext));
app.get("/api/builds/:id", (c) => onBuild(c.env, c.req.param("id")));

export default app;
