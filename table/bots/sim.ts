import { choose, draw, type Ev, endMonth, newGame, type Outcome, type Pack, type Preset, pass, play, ROLES, type Role, type State, shortlist, TUNE, takePick } from "../engine";
import type { Bot } from "./bots";

export interface TermResult {
  bot: string;
  seed: number;
  vision: string | null;
  outcome: Outcome;
  months: number;
  actions: number;
  spentIn: Record<Role, number>;
  capMonths: Record<Role, number>;
  change: { answer: number; drift: number; other: number };
  firstPlays: string[];
}

const KINDS: Role[] = ["force", "voice", "trust"];

function inRange(s: State, what: string) {
  const bad =
    Object.entries(s.support).find(([, v]) => !(v >= 0 && v <= 100)) ??
    (!(s.grip >= 0 && s.grip <= 100) ? ["grip", s.grip] : undefined) ??
    KINDS.map((k) => [k, s.res[k]] as const).find(([, v]) => !(v >= 0 && v <= TUNE.cap));
  if (bad) throw new Error(`out of range after ${what}: ${bad[0]} = ${bad[1]} (seed ${s.seed}, month ${s.month})`);
}

export function runTerm(p: Pack, bot: Bot, seed: number, opts: { rules?: Preset; banned?: string[] } = {}): TermResult {
  const s = newGame(p, { seed, rules: opts.rules, banned: opts.banned });
  s.vision = bot.vision(p, s);
  const zero = () => Object.fromEntries(ROLES.map((r) => [r, 0])) as Record<Role, number>;
  const r: TermResult = { bot: bot.name, seed, vision: s.vision, outcome: { kind: "swept", standing: 0 }, months: 0, actions: 0, spentIn: zero(), capMonths: zero(), change: { answer: 0, drift: 0, other: 0 }, firstPlays: [] };
  const track = (ev: Ev[], what: string, action = false) => {
    const spent = new Set<Role>();
    for (const e of ev) {
      if (e.t === "move") r.change[e.src === "answer" ? "answer" : e.src === "drift" ? "drift" : "other"] += Math.abs(e.delta);
      if (action && e.t === "res" && e.delta < 0) spent.add(e.kind);
    }
    if (action) {
      r.actions++;
      for (const k of spent) r.spentIn[k]++;
    }
    inRange(s, what);
  };
  for (let guard = 0; !s.over; guard++) {
    if (guard > 500) throw new Error(`term did not end (seed ${seed})`);
    const ids = shortlist(p, s);
    if (!ids.length) pass(s);
    else {
      track(draw(p, s, ids[0]), `draw ${ids[0]}`);
      if (s.phase === "draw") continue;
    }
    if (s.phase === "answer") {
      const i = bot.answer(p, s);
      track(choose(p, s, i), `answer ${i}`, true);
    }
    let first = true;
    while (!s.over && (s.phase === "pick" || s.phase === "play")) {
      if (s.phase === "pick") {
        const id = bot.pick(p, s);
        track(takePick(p, s, id), `pick ${id}`);
        continue;
      }
      const m = bot.play(p, s);
      if (!m) break;
      track(play(p, s, m.id, m.target, m.ch), `play ${m.id}`, true);
      if (first) {
        r.firstPlays.push(m.id);
        first = false;
      }
    }
    if (s.over) break;
    for (const k of KINDS) if (s.res[k] >= TUNE.cap) r.capMonths[k]++;
    track(endMonth(p, s), "month end");
  }
  r.outcome = s.over as unknown as Outcome;
  r.months = s.month;
  r.vision = s.vision;
  return r;
}
