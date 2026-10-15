import type { Env } from "./env";

// Jev returns numbers only (owner rule): a noul is 0 to 1, a choice is a probability per option.
type Noul = { type: "noul"; instructions: string };
type Choice = { type: "choice"; instructions: string; options: string[] };
export type Question = Noul | Choice;
export type Answers = Record<string, { noul?: number; probabilities?: Record<string, number> }>;

export async function jev(env: Env, state: unknown, questions: Record<string, Question>): Promise<Answers> {
  const wire = Object.fromEntries(
    Object.entries(questions).map(([k, q]) => [k, q.type === "choice" ? { type: "choice", instructions: q.instructions, criteria: Object.fromEntries(q.options.map((o) => [o, null])) } : q]),
  );
  const r = await fetch("https://openrouter.ai/api/v1/systemone", {
    method: "POST",
    headers: { Authorization: `Bearer ${env.OPENROUTER_API_KEY}`, "Content-Type": "application/json", "HTTP-Referer": "https://siyasa.deadpackets.pw", "X-Title": "Siyasa" },
    body: JSON.stringify({ model: "typesafe/jev-1.13", state, questions: wire }),
    signal: AbortSignal.timeout(8000),
  });
  if (!r.ok) throw new Error(`jev ${r.status}: ${(await r.text()).slice(0, 200)}`);
  return ((await r.json()) as { answers: Answers }).answers;
}

// one D1 row per day and kind; past the budget every call takes the engine's fallback, so play never stops
export async function underBudget(env: Env, kind: string): Promise<boolean> {
  const day = new Date().toISOString().slice(0, 10), cap = Number(env.JEV_DAILY_CALLS ?? "20000");
  const row = await env.DB.prepare("INSERT INTO meter (day, kind, n) VALUES (?, ?, 1) ON CONFLICT (day, kind) DO UPDATE SET n = n + 1 RETURNING n").bind(day, kind).first<{ n: number }>();
  return Number.isFinite(cap) && (row?.n ?? 0) <= cap;
}
