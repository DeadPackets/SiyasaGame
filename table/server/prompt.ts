import type { Env } from "./env";
import { ipKey } from "./gate";
import { identity } from "./identity";
import { jev } from "./jev";

export const CONTENT_RULE =
  "Siyasa is a serious strategy game about holding power in any real or invented polity. It writes war, coups, purges, repression and atrocities as history, plainly. It never writes as play the mass killing of civilians, ethnic cleansing or the expulsion of a population.";

const nextOpen = () => { const d = new Date(); d.setUTCHours(24, 0, 0, 0); return d.toISOString(); };

type Candidate = { id: string; title: string; date: string; polity: string; blurb: string };
// Measured on v4 2026-09-22: bge-m3 scored Rome's own prompt 0.54 against its pack; Jev decides above this floor.
const COSINE_FLOOR = 0.45;

export async function embed(env: Env, text: string): Promise<number[]> {
  const r = (await env.AI.run("@cf/baai/bge-m3", { text: [text] } as never)) as { data?: number[][] };
  if (!Array.isArray(r?.data?.[0])) throw new Error("bge-m3 returned no vector");
  return r.data[0];
}

export async function indexWorld(env: Env, w: { id: string; title: string; polity: string; date: string; blurb: string }) {
  await env.VEC.upsert([{ id: w.id, values: await embed(env, `${w.title}. ${w.polity}, ${w.date}. ${w.blurb}`) }]);
}

async function similar(env: Env, prompt: string): Promise<{ load: Candidate } | { offer: Candidate[] } | null> {
  const q = await env.VEC.query(await embed(env, prompt), { topK: 20 });
  const ids = q.matches.filter((m) => m.score >= COSINE_FLOOR).map((m) => m.id);
  if (!ids.length) return null;
  const { results } = await env.DB.prepare(`SELECT id, title, date, polity, blurb FROM worlds WHERE hidden = 0 AND id IN (${ids.map(() => "?").join(",")})`).bind(...ids).all<Candidate>();
  if (!results.length) return null;
  const a = await jev(env, { prompt }, {
    match: {
      type: "choice",
      instructions: { candidates: Object.fromEntries(results.map((c) => [c.id, { title: c.title, date: c.date, place: c.polity, description: c.blurb }])), question: "Does `prompt` describe the same scenario as one of `candidates`, a close variant of one, or something new?" },
      options: [...results.map((c) => c.id), "none_of_these"],
    },
  });
  const p = Object.entries(a.match?.probabilities ?? {}).sort((x, y) => y[1] - x[1]);
  const [top, topP] = p[0] ?? ["none_of_these", 0];
  if (top === "none_of_these") return null;
  if (topP >= 0.95) return { load: results.find((c) => c.id === top) as Candidate };
  if (topP >= 0.85) return { offer: p.filter(([id, v]) => id !== "none_of_these" && v >= 0.5).slice(0, 3).map(([id]) => results.find((c) => c.id === id) as Candidate) };
  return null;
}

async function human(env: Env, token: unknown, ip: string): Promise<boolean> {
  if (!env.TURNSTILE_SECRET) return true; // ponytail: no secret set means no check; production sets one
  if (typeof token !== "string" || !token) return false;
  const r = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", { method: "POST", body: new URLSearchParams({ secret: env.TURNSTILE_SECRET, response: token, remoteip: ip }) });
  return Boolean(((await r.json()) as { success?: boolean }).success);
}

export async function onPrompt(env: Env, req: Request, ctx: ExecutionContext): Promise<Response> {
  const body = (await req.json().catch(() => null)) as { prompt?: unknown; token?: unknown; force?: unknown } | null;
  const prompt = typeof body?.prompt === "string" ? body.prompt.trim().replace(/\s+/g, " ") : "";
  if (prompt.length < 3) return Response.json({ state: "invalid", reason: "Name a place and a time." }, { status: 400 });
  if (prompt.length > 300) return Response.json({ state: "invalid", reason: "Use 300 characters or fewer." }, { status: 400 });
  const ip = req.headers.get("cf-connecting-ip") ?? "local";
  if (!(await human(env, body?.token, ip))) return Response.json({ state: "invalid", reason: "Try again." }, { status: 403 });
  const { success } = await env.RL.limit({ key: `prompt:${ip}` });
  if (!success) return Response.json({ state: "invalid", reason: "Wait a minute, then try again." }, { status: 429 });

  // safety first: a refused prompt costs no build and no count. If Jev is down, the build's own content rule still holds.
  try {
    const a = await jev(env, { prompt }, { refuse: { type: "noul", instructions: `${CONTENT_RULE} Is this prompt asking for what that rule refuses, for content that harasses or mocks a real private person, or for sexual content?` } });
    if ((a.refuse?.noul ?? 0) >= 0.5) return Response.json({ state: "refused", reason: "Siyasa does not build this world. Try a place and a time." });
  } catch {}

  if (body?.force !== true) {
    try {
      const hit = await similar(env, prompt);
      if (hit && "load" in hit) return Response.json({ state: "exists", world: hit.load });
      if (hit) return Response.json({ state: "similar", worlds: hit.offer });
    } catch {}
  }

  const gate = env.GATE.get(env.GATE.idFromName("global")), key = ipKey(ip);
  const claim = await gate.claim(key);
  if (claim !== "ok") return Response.json({ state: claim, opensAt: nextOpen() });

  const who = await identity(env.IDENTITY_SECRET, req), id = crypto.randomUUID(), fake = env.FAKE_BUILD === "1";
  await env.DB.prepare("INSERT INTO builds (id, prompt, owner, status, fake, created) VALUES (?, ?, ?, 'running', ?, ?)").bind(id, prompt, who.id, fake ? 1 : 0, Date.now()).run();
  if (!fake) {
    try {
      await env.BUILD.create({ id, params: { build: id, prompt, owner: who.id, key } });
    } catch (e) {
      ctx.waitUntil(gate.release(key));
      await env.DB.prepare("UPDATE builds SET status = 'failed', error = ? WHERE id = ?").bind(String(e).slice(0, 300), id).run();
    }
  }
  return Response.json({ state: "building", build: id }, { headers: who.header ? { "set-cookie": who.header } : {} });
}

// Dev and E2E: a build that replays the Egypt pack on a 25-second timeline and spends nothing.
const FAKE: [number, string][] = [[4, "frame"], [8, "skin"], [11, "music"], [15, "rules"], [19, "month1"], [24, "deck"], [25, "done"]];
async function fakeParts(env: Env, since: number) {
  const s = (Date.now() - since) / 1000, got = FAKE.filter(([at]) => s >= at).map(([, k]) => k);
  const pack = (await (await env.PACKS.get("packs/egypt-2011.json"))?.json()) as Record<string, any> | null;
  if (!pack) return { status: "failed", parts: {}, error: "The fake build needs the Egypt pack seeded." };
  const w = pack.world, parts: Record<string, unknown> = {};
  if (got.includes("frame")) parts.frame = frameOf(w);
  if (got.includes("skin")) parts.skin = pack.skin;
  if (got.includes("music")) parts.music = pack.music;
  if (got.includes("rules")) parts.rules = { visions: pack.deck.visions.length };
  if (got.includes("month1")) parts.month1 = true;
  if (got.includes("deck")) parts.deck = { count: pack.deck.situations.length + pack.deck.history.length + pack.deck.callbacks.length };
  return got.includes("done") ? { status: "done", parts, world: w.id } : { status: "running", parts };
}

// the seal's segments weigh each ideology by the factions' mix; patrons are not factions at home
export const frameOf = (w: Record<string, any>) => {
  const power: Record<string, number> = {};
  for (const f of w.factions) for (const [id, v] of f.mix ?? []) power[id] = (power[id] ?? 0) + v;
  return {
    title: w.title, polity: w.polity, date: w.date, months: w.months, office: w.office,
    ideologies: w.ideologies.map((x: { id: string; name: string }) => ({ id: x.id, name: x.name, power: power[x.id] ?? 0 })),
    factions: w.factions.map((x: { id: string; short: string; who: string }) => ({ id: x.id, short: x.short, who: x.who })),
  };
};

export async function onBuild(env: Env, id: string): Promise<Response> {
  const row = await env.DB.prepare("SELECT status, parts, world, error, fake, created FROM builds WHERE id = ?").bind(id).first<{ status: string; parts: string; world: string | null; error: string | null; fake: number; created: number }>();
  if (!row) return Response.json({ status: "missing" }, { status: 404 });
  if (row.fake) {
    const r = await fakeParts(env, row.created);
    if (r.status !== "running" && row.status === "running") await env.DB.prepare("UPDATE builds SET status = ?, world = ? WHERE id = ?").bind(r.status, r.world ?? null, id).run();
    return Response.json(r);
  }
  return Response.json({ status: row.status, parts: JSON.parse(row.parts), world: row.world, error: row.error });
}
