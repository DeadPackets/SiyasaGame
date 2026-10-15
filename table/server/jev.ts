import type { Env } from "./env";

// Jev returns numbers only (owner rule): a noul is 0 to 1, a choice is a probability per option.
type Noul = { type: "noul"; instructions: unknown };
type Choice = { type: "choice"; instructions: unknown; options: string[] };
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
