import { band, clamp, standing, zone } from "./geo";
import { type Card, type Pack, type Res, type Role, type Size, card, kindOf } from "./pack";
import { addRes, apply, costOf, fileTo, gripBy, hash01, modsOf, moveBy, pay, plan, runTriggers, sizeNum } from "./rules";
import { type Ev, type Outcome, type State, rand } from "./state";
import { TUNE } from "./tune";

export function eligible(p: Pack, s: State): Card[] {
  const m = s.month, b = band(s.grip), z = zone(p, s), seen = new Set(s.seen), d = p.deck;
  return [...d.history, ...d.callbacks, ...d.elections, ...d.situations].filter(
    (c) =>
      !seen.has(c.id) && c.months[0] <= m && m <= c.months[1] && (!c.band || c.band === b) && (!c.zone || c.zone === z) &&
      (c.requires ?? []).every((f) => s.flags.includes(f)) && !(c.blocks ?? []).some((f) => s.flags.includes(f)),
  );
}

export function shortlist(p: Pack, s: State): string[] {
  if (s.phase !== "draw") return [];
  const q = s.queue.find((id) => !s.seen.includes(id));
  if (q) return [q];
  return eligible(p, s)
    .map((c) => ({ id: c.id, w: hash01(s.seed + s.month, c.id) * TUNE.kindWeight[kindOf(p, c.id)] * (c.months[1] === s.month ? 2 : 1) }))
    .sort((a, b) => b.w - a.w)
    .slice(0, TUNE.shortlist)
    .map((x) => x.id);
}

export function draw(p: Pack, s: State, id: string, plausibility = TUNE.plausibility): Ev[] {
  if (s.phase !== "draw") throw new Error(`draw in phase ${s.phase}`);
  s.queue = s.queue.filter((x) => x !== id);
  if (kindOf(p, id) === "history" && rand(s) > plausibility) {
    s.seen.push(id);
    s.hist[id] = { happened: false };
    return [{ t: "history", card: id, happened: false }];
  }
  s.card = id;
  s.phase = "answer";
  return [{ t: "draw", card: id }];
}

export function pass(s: State) {
  if (s.phase !== "draw") throw new Error(`pass in phase ${s.phase}`);
  s.phase = "play";
}

function answerPrice(s: State, res: Res | undefined): Res {
  const base = Object.fromEntries(Object.entries(res ?? {}).filter(([, v]) => (v as number) < 0).map(([k, v]) => [k, -(v as number)]));
  return costOf(s, "answers", base);
}

// when no answer can be paid, every answer opens and takes what you have, so a month never stalls
export function options(p: Pack, s: State): { ok: boolean; price: Res; forced?: boolean }[] {
  if (!s.card) return [];
  const all = card(p, s.card).answers.map((a) => {
    const price = answerPrice(s, a.res);
    return { ok: plan(s, price) !== null, price };
  });
  return all.some((o) => o.ok) ? all : all.map((o) => ({ ...o, ok: true, forced: true }));
}

export function end(s: State, outcome: Outcome, ev: Ev[]): Ev[] {
  s.over = outcome;
  s.phase = "over";
  ev.push({ t: "over", outcome });
  return ev;
}

export function progress(p: Pack, s: State, ev: Ev[]) {
  for (const id of p.world.compass) {
    const x = p.deck.ideologies[id];
    for (const [n, c] of [[TUNE.stack.power, x.power], [TUNE.stack.major, x.law]] as const)
      if (s.stacks[id] >= n && !s.unlocked.includes(c.id)) {
        s.unlocked.push(c.id);
        ev.push({ t: "unlock", id: c.id });
      }
  }
}

function after(p: Pack, s: State, ev: Ev[]) {
  runTriggers(p, s, ev);
  progress(p, s, ev);
}

export function choose(p: Pack, s: State, i: number, nudge: Record<string, number> = {}): Ev[] {
  if (s.phase !== "answer" || !s.card) throw new Error(`choose in phase ${s.phase}`);
  const c = card(p, s.card), a = c.answers[i], o = options(p, s)[i], ev: Ev[] = [];
  if (!a || !o.ok) throw new Error(`answer ${i} cannot be chosen`);
  if (o.forced) for (const [k, v] of Object.entries(o.price)) addRes(s, k as Role, -Math.min(v as number, Math.max(0, s.res[k as Role])), ev);
  else pay(s, o.price, ev);
  for (const [k, v] of Object.entries(a.res ?? {})) if ((v as number) > 0) addRes(s, k as Role, v as number, ev);
  const x = s.doubleNext ? 2 : 1;
  s.doubleNext = false;
  const mine = s.boost.filter((b) => b.ideology === a.ideology || b.ideology === "any");
  s.boost = s.boost.filter((b) => !mine.includes(b));
  const steps = mine.reduce((n, b) => n + b.steps, 0) + modsOf(s, "sizeUp").filter((m) => m.ideology === a.ideology).length;
  for (const [h, mv] of Object.entries(a.moves)) {
    const n = clamp(nudge[h] ?? 0, -TUNE.nudgeMax, TUNE.nudgeMax);
    moveBy(s, h, ((mv[0] === "+" ? 1 : -1) * sizeNum(mv[1] as Size, steps) + n) * x, ev, "answer", a.reasons[h]);
  }
  if (a.grip) gripBy(s, (a.grip[0] === "+" ? 1 : -1) * TUNE.gripSize[a.grip[1] as Size] * x, ev);
  for (const e of a.effects ?? []) apply(p, s, e, ev, "answer");
  for (const f of a.flags ?? []) if (!s.flags.includes(f)) s.flags.push(f);
  fileTo(s, a.ideology, x, ev);
  if (kindOf(p, c.id) === "history") s.hist[c.id] = { happened: true, chose: i };
  s.seen.push(c.id);
  s.log.push({ month: s.month, card: c.id, answer: i, ideology: a.ideology });
  s.card = null;
  s.phase = "play";
  if (a.holdsElection) {
    const st = standing(p, s), passed = st >= TUNE.bar;
    ev.push({ t: "election", passed, standing: st });
    if (!passed) return end(s, { kind: "fallen", by: "election", month: s.month }, ev);
    s.elected++;
  }
  after(p, s, ev);
  return ev;
}
