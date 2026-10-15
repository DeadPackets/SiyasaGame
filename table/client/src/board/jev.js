// Jev during play: each call gives the engine an input, or null. Null or slower than 2.5 s means the engine default.
async function ask(route, body, key) {
  try {
    const r = await fetch(`/api/jev/${route}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body), signal: AbortSignal.timeout(2500) });
    return r.ok ? ((await r.json())[key] ?? null) : null;
  } catch { return null; }
}
// ctx: { world, date, month, grip, holders: [{ id, short, persona, support }], recent: [string] }
export const nudge = (ctx, answer, moved) => ask("nudge", { ctx, answer, moved }, "nudge");
export const director = (ctx, cards) => ask("director", { ctx, cards }, "pick");
export const plausibility = (ctx, event, date) => ask("plausibility", { ctx, event, date }, "p");
