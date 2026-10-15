import { band, clamp, resting, standing, zone } from "./geo";
import { type Ask, type Card, type Choice, type Pack, ROLES, type Res, type Role, type Size, card, handDef, kindOf } from "./pack";
import { addRes, apply, asksOf, costOf, fileTo, gripBy, hash01, holdsCond, modsOf, moveBy, pay, plan, runTriggers, sizeNum, targets } from "./rules";
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
  if (!s.queue.includes(id) && !eligible(p, s).some((c) => c.id === id)) throw new Error(`${id} cannot be drawn now`);
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

// month end passes offers = false: an offer waits for the next answer or play
export function progress(p: Pack, s: State, ev: Ev[], offers = true) {
  for (const id of p.world.compass) {
    const x = p.deck.ideologies[id];
    for (const [n, c] of [[TUNE.stack.power, x.power], [TUNE.stack.major, x.law]] as const)
      if (s.stacks[id] >= n && !s.unlocked.includes(c.id)) {
        s.unlocked.push(c.id);
        ev.push({ t: "unlock", id: c.id });
      }
  }
  while (offers && !s.offer && s.phase !== "over") {
    const z = zone(p, s);
    const key = [
      ...p.world.compass.filter((id) => s.stacks[id] >= TUNE.stack.pick).map((id) => `stack:${id}`),
      ...(s.grip <= TUNE.pickOpen ? ["open"] : []),
      ...(s.grip >= TUNE.pickIron ? ["iron"] : []),
      ...(z === "centre" ? ["centre"] : []),
    ].find((k) => !s.pickDone.includes(k));
    if (!key) return;
    s.pickDone.push(key);
    const set = key.startsWith("stack:") ? p.deck.ideologies[key.slice(6)].picks : p.deck.picks[key as "iron" | "open" | "centre"];
    const ids = set.map((m) => m.id).filter((id) => !s.banned.includes(id)).sort((a, b) => hash01(s.seed, a) - hash01(s.seed, b));
    if (!ids.length) continue;
    s.offer = { key, ids };
    s.phase = "pick";
    ev.push({ t: "offer", key, ids });
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

export function takePick(p: Pack, s: State, id: string | null): Ev[] {
  if (s.phase !== "pick" || !s.offer) throw new Error(`takePick in phase ${s.phase}`);
  if (id !== null) {
    if (!s.offer.ids.includes(id)) throw new Error(`${id} is not offered`);
    s.mods.push(...(handDef(p, id)?.effects ?? []));
    s.picked.push(id);
  }
  s.offer = null;
  s.phase = "play";
  const ev: Ev[] = [];
  after(p, s, ev);
  return ev;
}

export type Kind = "talk" | "address" | "law" | "power" | "grip" | "patron";
export interface HandCard { id: string; kind: Kind; cost: Res; ok: boolean; why?: "phase" | "plays" | "zone" | "cost"; target: boolean; asks: Ask[] }

export function hand(p: Pack, s: State): HandCard[] {
  const z = zone(p, s), b = band(s.grip), d = p.deck, out: HandCard[] = [];
  const add = (id: string, kind: Kind, base: Res, inZone = true) => {
    if (s.banned.includes(id)) return;
    const cost = costOf(s, kind, base), asks = asksOf(handDef(p, id)?.effects ?? []);
    const why = s.phase !== "play" ? "phase" : s.plays < 1 ? "plays" : !inZone ? "zone" : plan(s, cost) === null ? "cost" : undefined;
    out.push(why ? { id, kind, cost, ok: false, why, target: kind === "talk", asks } : { id, kind, cost, ok: true, target: kind === "talk", asks });
  };
  add("talk", "talk", TUNE.talk.cost);
  add("address", "address", TUNE.address.cost);
  for (const id of p.world.compass) {
    const l = d.ideologies[id].law;
    if (s.unlocked.includes(l.id) && !s.laws.includes(l.id)) add(l.id, "law", l.cost ?? {}, z === id);
  }
  if (z === "centre") for (const l of d.centreLaws) if (!s.laws.includes(l.id)) add(l.id, "law", l.cost ?? {});
  for (const id of p.world.compass) {
    const c = d.ideologies[id].power;
    if (s.unlocked.includes(c.id)) add(c.id, "power", c.cost ?? {});
  }
  if (b !== "middle") for (const c of d.gripCards[b]) add(c.id, "grip", c.cost ?? {});
  for (const h of p.world.patrons) {
    const c = d.patronCards[h.id];
    if (c && s.support[h.id] >= TUNE.patronCardAt) add(c.id, "patron", c.cost ?? {});
  }
  return out;
}

// every option an ask allows; a choice outside it is refused
export function askOptions(p: Pack, a: Ask): string[] {
  const w = p.world;
  return a === "holder" ? [...w.factions, ...w.patrons].map((h) => h.id) : a === "kind" ? [...ROLES] : a === "dir" ? ["iron", "open"] : [...w.compass];
}

export function play(p: Pack, s: State, id: string, target?: string, ch: Choice = {}): Ev[] {
  const h = hand(p, s).find((x) => x.id === id);
  if (!h?.ok) throw new Error(`cannot play ${id}: ${h?.why ?? "not in hand"}`);
  if (id === "talk" && !p.world.factions.some((f) => f.id === target)) throw new Error("Talk needs a faction");
  for (const a of h.asks) if (!askOptions(p, a).includes(String(ch[a]))) throw new Error(`${id} needs a chosen ${a}`);
  const ev: Ev[] = [];
  pay(s, h.cost, ev);
  s.plays--;
  if (id === "talk") moveBy(s, target as string, TUNE.talk.up, ev, "talk");
  else if (id === "address") s.doubleNext = true;
  else {
    for (const e of handDef(p, id)?.effects ?? []) apply(p, s, e, ev, "card", ch);
    if (h.kind === "law") {
      s.laws.push(id);
      ev.push({ t: "law", id });
    }
  }
  after(p, s, ev);
  return ev;
}

export function pillars(p: Pack, s: State, id: string): boolean[] {
  const v = p.deck.visions.find((x) => x.id === id);
  if (!v) return [];
  const z = zone(p, s);
  return v.pillars.map((q) => {
    switch (q.kind) {
      case "stack": return s.stacks[q.ideology] >= q.min;
      case "zone": return z === q.zone;
      case "grip": return (q.min == null || s.grip >= q.min) && (q.max == null || s.grip <= q.max);
      case "law": return s.laws.includes(q.id);
      case "sup": return s.support[q.holder] >= q.min;
      case "res": return s.res[q.role] >= q.min;
    }
  });
}

export function switchVision(p: Pack, s: State, id: string): Ev[] {
  if (s.switched || s.phase === "over" || !p.deck.visions.some((v) => v.id === id)) throw new Error(`cannot switch to ${id}`);
  const ev: Ev[] = [];
  pay(s, TUNE.visionSwitch, ev);
  s.vision = id;
  s.switched = true;
  return ev;
}

export function divergence(p: Pack, s: State): number {
  const H = p.deck.history;
  return H.filter((c) => {
    const h = s.hist[c.id];
    return !h?.happened || h.chose !== c.historyAnswer;
  }).length / H.length;
}

const driftMult = (p: Pack, s: State, id: string) =>
  modsOf(s, "drift").filter((m) => targets(p, s, m.target).includes(id)).reduce((a, m) => a * m.multiplier, 1);

export function endMonth(p: Pack, s: State): Ev[] {
  if (s.phase !== "play") throw new Error(`endMonth in phase ${s.phase}`);
  const ev: Ev[] = [], w = p.world, R = s.rules, H = [...w.factions, ...w.patrons];
  const under = H.filter((h) => s.support[h.id] < R.actUnder);
  const fall = under.find((h) => s.plotting.includes(h.id));
  for (const h of under) {
    if (h === fall) continue;
    ev.push({ t: "act", holder: h.id });
    for (const [k, v] of Object.entries(h.act.res ?? {})) addRes(s, k as Role, v as number, ev);
    for (const [id, v] of Object.entries(h.act.sup ?? {})) moveBy(s, id, v, ev, "act");
    ev.push({ t: "plot", holder: h.id });
  }
  if (fall) return end(s, { kind: "fallen", by: fall.id, month: s.month }, ev);
  s.plotting = under.map((h) => h.id);
  for (const h of H) moveBy(s, h.id, (resting(p, s, h.id) - s.support[h.id]) * R.drift * driftMult(p, s, h.id), ev, "drift");

  const b = band(s.grip), inc: Partial<Record<Role, number>> = {};
  const add = (k: Role, n: number) => {
    inc[k] = (inc[k] ?? 0) + n;
  };
  for (const h of H) if (s.support[h.id] >= TUNE.produceAt) add(h.produces, 1);
  if (b === "iron") add("force", 1);
  if (b === "open") add("voice", 1);
  add("money", w.balance);
  if (s.elected) {
    add("voice", s.elected * TUNE.electionBonus.voice);
    add("trust", s.elected * TUNE.electionBonus.trust);
  }
  for (const m of modsOf(s, "income")) if (!m.when || m.when.if === "monthEnd" || holdsCond(p, s, m.when)) add(m.kind, m.n);
  for (const [k, n] of Object.entries(inc)) addRes(s, k as Role, n as number, ev);

  if (s.res.money < 0) {
    s.debt++;
    ev.push({ t: "debt", months: s.debt });
    if (s.debt >= TUNE.debtFall) return end(s, { kind: "fallen", by: "debt", month: s.month }, ev);
    for (const f of w.factions) moveBy(s, f.id, -TUNE.debtFactionLoss, ev, "debt");
  } else s.debt = 0;
  if (b === "iron") for (const f of w.factions) if (s.support[f.id] < TUNE.ironSqueeze.under) moveBy(s, f.id, -TUNE.ironSqueeze.loss, ev, "band");
  s.holds = s.holds.map((h) => ({ ...h, months: h.months - 1 })).filter((h) => h.months > 0);
  runTriggers(p, s, ev, true);
  progress(p, s, ev, false);

  for (const h of [...H].sort((a, c) => s.support[a.id] - s.support[c.id])) {
    const c = p.deck.intents[h.id];
    if (c && s.support[h.id] < R.intentUnder && !s.seen.includes(c.id) && !s.queue.includes(c.id)) {
      s.queue.push(c.id);
      ev.push({ t: "intent", holder: h.id, card: c.id });
    }
  }

  if (s.month >= w.months) {
    const st = standing(p, s);
    const kind = st < TUNE.bar ? "swept" : s.vision && pillars(p, s, s.vision).every(Boolean) ? "fulfilled" : "survived";
    return end(s, { kind, standing: st }, ev);
  }
  s.month++;
  s.phase = "draw";
  s.card = null;
  s.plays = TUNE.plays + modsOf(s, "extraPlay").filter((m) => s.month % m.everyNMonths === 0).length;
  ev.push({ t: "month", month: s.month });
  return ev;
}

// ported from the approved board (docs/mocks/v28/board/hallsfx.js:67-78)
export function levers(p: Pack, s: State): Record<string, number> {
  const home = p.world.factions.map((f) => s.support[f.id]);
  const avg = home.reduce((a, b) => a + b, 0) / home.length, low = Math.min(...home);
  const total = Object.values(s.stacks).reduce((a, b) => a + b, 0), c = (v: number) => clamp(v, 0, 1);
  return {
    grip: s.grip / 100,
    tension: c((45 - avg) / 15),
    crisis: c((18 - low) / 8),
    growth: c((0.5 * (s.month - 1)) / Math.max(1, p.world.months - 1) + 0.3 * Math.min(1, total / 12) + (0.2 * avg) / 100),
    ...Object.fromEntries(p.world.compass.map((id) => [id, c(s.stacks[id] / 5)])),
  };
}
