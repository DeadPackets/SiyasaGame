import { band, clamp, zone } from "./geo";
import { type Ask, CHOOSE, type Choice, type Cond, type Effect, type Family, type Pack, ROLES, type Res, type Role, type Size } from "./pack";
import type { Ev, MoveSrc, State } from "./state";
import { TUNE } from "./tune";

const SIZES: Size[] = ["s", "m", "l"];

export function sizeNum(size: Size, steps = 0): number {
  const i = SIZES.indexOf(size) + steps;
  return i <= 2 ? TUNE.size[SIZES[i]] : TUNE.size.l + (i - 2) * TUNE.stepAbove;
}

export function hash01(seed: number, id: string): number {
  let h = (seed ^ 0x811c9dc5) >>> 0;
  for (let i = 0; i < id.length; i++) h = Math.imul(h ^ id.charCodeAt(i), 16777619);
  h ^= h >>> 13;
  h = Math.imul(h, 0x5bd1e995);
  return ((h ^ (h >>> 15)) >>> 0) / 4294967296;
}

export function targets(p: Pack, s: State, t: string): string[] {
  const F = p.world.factions;
  if (t === "factions") return F.map((h) => h.id);
  if (t === "patrons") return p.world.patrons.map((h) => h.id);
  if (t === "lowest") return [F.reduce((a, b) => (s.support[b.id] < s.support[a.id] ? b : a)).id];
  if (t.startsWith("lean:")) {
    const id = t.slice(5);
    return [...F, ...p.world.patrons].filter((h) => [...h.mix].sort((a, b) => b[1] - a[1])[0][0] === id).map((h) => h.id);
  }
  return [t];
}

export function moveBy(s: State, id: string, d: number, ev: Ev[], src: MoveSrc, reason?: string) {
  const from = s.support[id];
  let to = clamp(from + d);
  for (const h of s.holds) {
    if (h.holder !== id) continue;
    if (h.bound === "floor" && d < 0) to = Math.max(to, Math.min(h.level, from));
    if (h.bound === "ceiling" && d > 0) to = Math.min(to, Math.max(h.level, from));
  }
  s.support[id] = to;
  if (to !== from) ev.push(reason ? { t: "move", holder: id, delta: to - from, src, reason } : { t: "move", holder: id, delta: to - from, src });
}

export function modsOf<K extends Effect["op"]>(s: State, op: K) {
  return s.mods.filter((m): m is Extract<Effect, { op: K }> => m.op === op);
}

export function gripBy(s: State, d: number, ev: Ev[]) {
  const from = s.grip;
  s.grip = clamp(from + d * modsOf(s, "gripRate").reduce((a, m) => a * m.multiplier, 1));
  if (s.grip !== from) ev.push({ t: "grip", delta: s.grip - from });
}

export function addRes(s: State, kind: Role, n: number, ev: Ev[]) {
  const from = s.res[kind];
  s.res[kind] = kind === "money" ? from + n : clamp(from + n, 0, TUNE.cap);
  if (s.res[kind] !== from) ev.push({ t: "res", kind, delta: s.res[kind] - from });
}

export function fileTo(s: State, id: string, n: number, ev: Ev[]) {
  s.stacks[id] += n;
  ev.push({ t: "file", ideology: id, n });
}

export function costOf(s: State, family: Family, base: Res): Res {
  const out: Res = { ...base };
  for (const m of modsOf(s, "cost")) if (m.family === family) out[m.kind] = Math.max(0, (out[m.kind] ?? 0) + m.delta);
  for (const k of ROLES) if (!out[k]) delete out[k];
  return out;
}

// What a price really takes, with an exchange covering a shortfall; null when it cannot be paid. Money may go into debt.
export function plan(s: State, price: Res): Res | null {
  const out: Res = { ...price };
  for (const k of ROLES) {
    if (k === "money") continue;
    const miss = (out[k] ?? 0) - s.res[k];
    if (miss <= 0) continue;
    const m = modsOf(s, "exchange").find((x) => x.to === k && (x.from === "money" || s.res[x.from] - (out[x.from] ?? 0) >= Math.ceil(miss / x.rate)));
    if (!m) return null;
    out[k] = s.res[k];
    out[m.from] = (out[m.from] ?? 0) + Math.ceil(miss / m.rate);
  }
  return out;
}

export function pay(s: State, price: Res, ev: Ev[]) {
  const take = plan(s, price);
  if (!take) throw new Error(`cannot pay ${JSON.stringify(price)}`);
  for (const k of ROLES) if (take[k]) addRes(s, k, -(take[k] as number), ev);
}

export function holdsCond(p: Pack, s: State, c: Cond): boolean {
  switch (c.if) {
    case "support": return targets(p, s, c.target).every((h) => (c.above == null || s.support[h] > c.above) && (c.below == null || s.support[h] < c.below));
    case "grip": return band(s.grip) === c.band;
    case "stack": return (s.stacks[c.ideology] ?? 0) >= c.min;
    case "zone": return zone(p, s) === c.zone;
    case "monthEnd": return false;
  }
}

// which choice each effect waits for, by field
const ASKS: [string, string, Ask][] = [["move", "target", "holder"], ["hold", "target", "holder"], ["cancelIntent", "holder", "holder"], ["gain", "kind", "kind"], ["spend", "kind", "kind"], ["grip", "dir", "dir"], ["file", "ideology", "ideology"], ["boostNext", "ideology", "ideology"]];
export const asksOf = (effects: Effect[]): Ask[] =>
  [...new Set(effects.flatMap((e) => ASKS.filter(([op, k]) => e.op === op && (e as Record<string, unknown>)[k] === CHOOSE).map((x) => x[2])))];

function fill(e: Effect, ch: Choice): Effect {
  const x = ASKS.find(([op, k]) => e.op === op && (e as Record<string, unknown>)[k] === CHOOSE);
  if (!x) return e;
  const v = ch[x[2]];
  if (v == null) throw new Error(`${e.op} needs a chosen ${x[2]}`);
  return { ...e, [x[1]]: v } as Effect;
}

export function apply(p: Pack, s: State, e0: Effect, ev: Ev[], src: MoveSrc = "card", ch: Choice = {}) {
  const e = fill(e0, ch);
  switch (e.op) {
    case "move":
      for (const h of targets(p, s, e.target)) moveBy(s, h, (e.dir === "+" ? 1 : -1) * sizeNum(e.size), ev, src);
      return;
    case "grip": return gripBy(s, (e.dir === "iron" ? 1 : -1) * TUNE.gripSize[e.size], ev);
    case "gain": return addRes(s, e.kind as Role, e.n, ev);
    case "spend": return addRes(s, e.kind as Role, -e.n, ev);
    case "file": return fileTo(s, e.ideology, e.n, ev);
    case "boostNext":
      s.boost.push({ ideology: e.ideology, steps: e.steps });
      return;
    case "hold":
      for (const h of targets(p, s, e.target)) s.holds.push({ holder: h, bound: e.bound, level: e.level, months: e.months });
      return;
    case "setFlag":
      if (!s.flags.includes(e.flag)) s.flags.push(e.flag);
      return;
    case "queueNext":
      if (!s.queue.includes(e.tag)) s.queue.unshift(e.tag);
      return;
    case "cancelIntent": {
      const id = p.deck.intents[e.holder]?.id;
      s.queue = s.queue.filter((x) => x !== id);
      return;
    }
    default:
      s.mods.push(e);
  }
}

export function runTriggers(p: Pack, s: State, ev: Ev[], monthEnd = false) {
  s.mods.forEach((m, i) => {
    if (m.op !== "trigger") return;
    if (m.when.if === "monthEnd") {
      if (monthEnd) for (const x of m.effects) apply(p, s, x, ev);
      return;
    }
    const now = holdsCond(p, s, m.when);
    if (now && !s.trig[i]) for (const x of m.effects) apply(p, s, x, ev);
    s.trig[i] = now;
  });
}
