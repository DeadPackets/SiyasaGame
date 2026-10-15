// One call to the native Anthropic API (streamed; the SDK is fetch-based, so it runs in a Worker), metered, and the step loop: call, parse, check, up to 2 repairs.
// biome-ignore-all lint/suspicious/noExplicitAny: model JSON
import Anthropic from "@anthropic-ai/sdk";
import { drop, merge } from "./check.mjs";

export interface Ctx {
  apiKey: string;
  log(msg: string): void;
  save?(name: string, json: unknown): void | Promise<void>;
  budget: number; // dollars; no call starts that could pass it
  // filled by the build; a Workflow that splits the build into steps passes `budget` minus what earlier steps spent
  spent?: number;
  reserved?: number;
  calls?: any[];
  steps?: Record<string, any>;
  t0?: number;
}
export interface Cfg { model: string; effort: "low" | "medium" | "high" | "max" | null }
export type Check = (x: any) => string[] | Promise<string[]>;

// $ per million tokens (cache write = 5-minute TTL, 1.25x input), from platform.claude.com/docs/en/about-claude/pricing 2026-10-14; web search $10 per 1,000
export const PRICE: Record<string, { in: number; out: number; read: number; write: number }> = {
  "claude-opus-5-5": { in: 4, out: 20, read: 0.2, write: 5 },
  "claude-sonnet-5-5": { in: 2, out: 10, read: 0.1, write: 2.5 },
};
const SEARCH = 0.01;
export const secs = (t: number) => Math.round((Date.now() - t) / 100) / 10;
export const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export function init(ctx: Ctx) {
  ctx.spent ??= 0;
  ctx.reserved ??= 0;
  ctx.calls ??= [];
  ctx.steps ??= {};
  ctx.t0 ??= Date.now();
  return ctx as Required<Ctx>;
}

const clients = new Map<string, Anthropic>();
export async function call(c: Ctx, name: string, attempt: number, messages: any[], cfg: Cfg, { maxTokens, web = false }: { maxTokens: number; web?: boolean }) {
  const ctx = init(c), model = cfg.model.replace(/^anthropic\//, "").replace(".", "-"), pr = PRICE[model]; // anthropic/claude-opus-5.5 -> claude-opus-5-5
  if (!pr) throw new Error(`${name}: model ${cfg.model} has no price in PRICE`);
  maxTokens = Math.min(maxTokens, 128000);
  const est = (JSON.stringify(messages).length / 3) * (pr.in / 1e6) * 1.25 + maxTokens * (pr.out / 1e6) + (web ? 0.5 : 0);
  while (ctx.reserved > 0 && ctx.spent + ctx.reserved + est > ctx.budget) await sleep(2000); // in-flight calls hold their worst case; wait for them to settle
  if (ctx.spent + ctx.reserved + est > ctx.budget) throw new Error(`${name}: stopped before the call: $${ctx.spent.toFixed(2)} spent + $${(ctx.reserved + est).toFixed(2)} possible > budget $${ctx.budget}`);
  ctx.reserved += est;
  const t = Date.now();
  ctx.log(`${name}#${attempt} start (${model} ${cfg.effort ?? "default"})`);
  try {
    let claude = clients.get(ctx.apiKey);
    if (!claude) clients.set(ctx.apiKey, (claude = new Anthropic({ apiKey: ctx.apiKey, maxRetries: 6, timeout: 40 * 60 * 1000, fetchOptions: { timeout: false } as any }))); // retries 429/5xx and failed connects; `timeout: false` turns off Bun's 5-minute socket idle timer (other runtimes ignore it)
    const [sys, ...rest] = messages, convo = [...rest];
    const u: any = { text: "", provider: "anthropic", input: 0, cached: 0, cacheWrite: 0, output: 0, reasoning: 0, searches: 0, cost: 0, finish: null, citations: new Set<string>(), continues: 0 };
    for (let k = 0; ; k++) {
      let msg: any;
      for (let drop = 0; !msg; drop++) {
        try {
          msg = await claude.beta.messages
            .stream({
              model, max_tokens: maxTokens, system: sys.content, messages: convo, output_config: { effort: cfg.effort ?? "medium" },
              betas: ["server-side-fallback-2026-07-01", "thinking-token-count-2026-05-13"], fallbacks: "default",
              ...(web ? { tools: [{ type: "web_search_20260209", name: "web_search", max_uses: 5 }] } : {}),
            } as any)
            .finalMessage();
        } catch (x) {
          // a connection dropped mid-stream is not retried by the SDK; resend up to 2 times (the dropped part's tokens are not metered)
          if (drop >= 2 || (x instanceof Anthropic.APIError && !(x instanceof Anthropic.APIConnectionError))) throw x;
          u.drops = drop + 1;
          ctx.log(`${name}#${attempt}: connection dropped (${(x as Error).message.slice(0, 120)}), resending`);
        }
      }
      const us = msg.usage, its = us.iterations?.filter((x: any) => x.type === "message" || x.type === "fallback_message") ?? [];
      // top-level usage covers only the attempt that answered; with a fallback, iterations hold each attempt
      for (const x of its.length ? its : [us]) {
        const p = PRICE[x.model] ?? pr;
        u.input += x.input_tokens + (x.cache_read_input_tokens ?? 0) + (x.cache_creation_input_tokens ?? 0);
        u.cached += x.cache_read_input_tokens ?? 0;
        u.cacheWrite += x.cache_creation_input_tokens ?? 0;
        u.output += x.output_tokens;
        u.cost += (x.input_tokens * p.in + (x.cache_read_input_tokens ?? 0) * p.read + (x.cache_creation_input_tokens ?? 0) * p.write + x.output_tokens * p.out) / 1e6;
      }
      u.reasoning += us.output_tokens_details?.thinking_tokens ?? 0;
      u.searches += us.server_tool_use?.web_search_requests ?? 0;
      u.cost += (us.server_tool_use?.web_search_requests ?? 0) * SEARCH;
      if (its.some((x: any) => x.type === "fallback_message")) u.fallback = msg.model;
      for (const b of msg.content) {
        if (b.type === "text") {
          u.text += b.text;
          for (const c of b.citations ?? []) if (c.url) u.citations.add(c.url);
        }
        if (b.type === "web_search_tool_result" && !Array.isArray(b.content)) (u.searchErrors ??= []).push(b.content?.error_code); // errors come back as blocks, not throws
      }
      if (msg.stop_reason === "refusal") {
        u.finish = "refusal";
        u.refusal = msg.stop_details;
        break;
      }
      if (msg.stop_reason === "pause_turn" && k < 5) { // the server resumes its search loop
        convo.push({ role: "assistant", content: msg.content });
        u.continues++;
        continue;
      }
      u.finish = ({ end_turn: "stop", max_tokens: "length" } as Record<string, string>)[msg.stop_reason] ?? msg.stop_reason;
      break;
    }
    const { text, ...rec } = u, m = { step: name, attempt, model: cfg.model, effort: cfg.effort, seconds: secs(t), ...rec, cost: Math.round(u.cost * 1e6) / 1e6, citations: [...u.citations], chars: text.length };
    ctx.spent += m.cost;
    ctx.calls.push(m);
    ctx.log(`${name}#${attempt} done ${m.seconds}s in ${m.input} (cached ${m.cached}, write ${m.cacheWrite}) out ${m.output} (reasoning ${m.reasoning}) search ${m.searches} $${m.cost.toFixed(4)} ${m.finish}${m.fallback ? ` served by ${m.fallback}` : ""}; build $${ctx.spent.toFixed(3)}`);
    await ctx.save?.(`raw.${name}.${attempt}.txt`, text);
    if (m.finish !== "stop") throw new Error(`${name}: finish ${m.finish}${m.refusal ? ` (${JSON.stringify(m.refusal)})` : ""}; a length stop, refusal or filter is never retried`);
    return text as string;
  } finally {
    ctx.reserved -= est;
  }
}

// ---------- one step: call, check, up to 2 repairs, keep the version with the fewest errors ----------
const parse = (t: string) => JSON.parse(t.slice(t.indexOf("{"), t.lastIndexOf("}") + 1));
const FIX = (errors: string[], whole: boolean) =>
  `The checker found ${errors.length} error(s) in the JSON above:\n- ${errors.join("\n- ")}\n\nFix every error and keep everything that passed. ` +
  (whole
    ? "Return the whole corrected JSON object."
    : 'Return one JSON object holding only what changes, in the same shape: an object lists only its changed keys; an array of items with "id" lists only the changed or new items, each one whole; any other array is given whole. To delete items, add "remove": [their ids].') +
  " No code fence, no text outside the JSON.";
const bad = (e: string[]) => (/could not read|not valid JSON/.test(e[0] ?? "") ? Infinity : e.length); // a crash is worse than any real error count
async function checked(check: Check, cur: any) {
  try {
    return await check(cur);
  } catch (x) {
    return [`the checker could not read this JSON (${(x as Error).message}); keep the documented shape`];
  }
}

// the [system, user] messages of a step; user is one string, or [shared block, per-call block] with the first block cached so parallel calls share it
export const messages = (system: string, user: string | string[]) => [
  { role: "system", content: [{ type: "text", text: system, cache_control: { type: "ephemeral" } }] },
  { role: "user", content: [user].flat().map((text, i) => ({ type: "text", text, ...(i ? {} : { cache_control: { type: "ephemeral" } }) })) },
];

// one repair call on top of the step's messages: send the errors, merge the patch, re-check
export async function repair(ctx: Ctx, name: string, k: number, cfg: Cfg, base: any[], cur: any, text: string, errors: string[], check: Check, maxTokens: number) {
  const fix = await call(ctx, name, k, [...base, { role: "assistant", content: cur ? JSON.stringify(cur) : text }, { role: "user", content: FIX(errors, !cur) }], cfg, { maxTokens });
  let patch = null;
  try {
    patch = parse(fix);
  } catch (x) {
    return { cur, errors: [`not valid JSON: ${(x as Error).message}`] };
  }
  const { remove, ...rest } = patch, next = drop(merge(cur, rest), new Set(remove ?? []));
  return { cur: next, errors: await checked(check, next) };
}

export async function step(c: Ctx, name: string, cfg: Cfg, system: string, user: string | string[], check: Check, { maxTokens, repairTokens = maxTokens, web = false, file }: { maxTokens: number; repairTokens?: number; web?: boolean; file: string }) {
  const ctx = init(c), t = Date.now(), base = messages(system, user);
  const text = await call(ctx, name, 0, base, cfg, { maxTokens, web });
  let cur: any = null, errors: string[];
  try {
    cur = parse(text);
    errors = await checked(check, cur);
  } catch (x) {
    errors = [`not valid JSON: ${(x as Error).message}`];
  }
  let best = { cur, errors }, repairs = 0;
  const first = errors.length;
  ctx.log(`${name}: ${errors.length} error(s) ${JSON.stringify(errors.slice(0, 6))}`);
  for (let k = 1; k <= 2 && errors.length; k++) {
    repairs = k;
    try {
      ({ cur, errors } = await repair(ctx, name, k, cfg, base, cur, text, errors, check, repairTokens));
    } catch (x) {
      ctx.log(`${name}: repair ${k} failed: ${(x as Error).message}`);
      break;
    }
    ctx.log(`${name}: after repair ${k}: ${errors.length} error(s) ${JSON.stringify(errors.slice(0, 6))}`);
    if (bad(errors) < bad(best.errors)) best = { cur, errors };
  }
  if (best.cur) await ctx.save?.(file, best.cur);
  ctx.steps[name] = { seconds: secs(t), firstErrors: first, repairs, pass: !best.errors.length, errors: best.errors };
  return best.cur;
}

export function finish(c: Ctx, extra: Record<string, unknown> = {}) {
  const ctx = init(c), sum = (k: string) => ctx.calls.reduce((a, x) => a + (x[k] ?? 0), 0);
  return {
    ...extra, seconds: secs(ctx.t0), cost: Math.round(sum("cost") * 10000) / 10000,
    tokens: { input: sum("input"), cached: sum("cached"), cacheWrite: sum("cacheWrite"), output: sum("output"), reasoning: sum("reasoning") }, steps: ctx.steps, calls: ctx.calls,
  };
}
