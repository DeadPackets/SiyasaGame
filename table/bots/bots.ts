import { askOptions, type Choice, choose, clamp, corners, dist, draw, endMonth, hand, marker, options, type Pack, pass, pillars, play, type State, shortlist, standing, switchVision, takePick } from "../engine";

export interface Bot {
  name: string;
  vision(p: Pack, s: State): string | null;
  answer(p: Pack, s: State): number;
  pick(p: Pack, s: State): string | null;
  play(p: Pack, s: State): { id: string; target?: string; ch?: Choice } | null;
}

const mulberry = (seed: number) => () => {
  seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), seed | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

// how close a Vision is, 0 to 1, with partial credit per pillar
export function progressOf(p: Pack, s: State, id: string): number {
  const v = p.deck.visions.find((x) => x.id === id);
  if (!v) return 0;
  const met = pillars(p, s, id), C = corners(p), m = marker(p, s);
  const lawIdeo = (lid: string) => p.world.compass.find((i) => p.deck.ideologies[i].law.id === lid);
  const part = (q: (typeof v.pillars)[number]): number => {
    switch (q.kind) {
      case "stack": return Math.min(1, s.stacks[q.ideology] / q.min);
      case "zone": return 1 - Math.min(1, dist(m, q.zone === "centre" ? [0, 0] : C[q.zone]) / 1.5);
      case "grip": return 1 - Math.min(1, Math.max(q.min != null ? q.min - s.grip : 0, q.max != null ? s.grip - q.max : 0) / 50);
      case "law": {
        const i = lawIdeo(q.id);
        const near = 1 - Math.min(1, dist(m, i ? C[i] : [0, 0]) / 1.5);
        return (s.unlocked.includes(q.id) || !i ? 0.4 : (0.4 * s.stacks[i]) / 5) + 0.5 * near;
      }
      case "sup": return Math.min(1, s.support[q.holder] / q.min);
      case "res": return clamp(s.res[q.role] / Math.max(1, q.min), 0, 1);
    }
  };
  return v.pillars.reduce((a, q, k) => a + (met[k] ? 1 : part(q)), 0) / v.pillars.length;
}

function value(p: Pack, s: State, vision: string | null): number {
  if (s.over?.kind === "fallen") return -1000;
  if (s.over?.kind === "swept") return -500;
  const low = Math.min(...[...p.world.factions, ...p.world.patrons].map((h) => s.support[h.id]));
  const st = clamp((standing(p, s) - 40) / 20, 0, 1);
  const safe = clamp((low - s.rules.actUnder) / 20, 0, 1) - (low < s.rules.actUnder ? 2 : 0);
  const purse = (s.res.force + s.res.voice + s.res.trust) / 30 - (s.res.money < 0 ? 1 : 0);
  return 50 * (vision ? progressOf(p, s, vision) : st) + 30 * st + 20 * safe + 6 * purse;
}

type Move = { kind: "answer"; i: number } | { kind: "pick"; id: string | null } | { kind: "play"; id: string; target?: string; ch?: Choice } | { kind: "stop" };

// a few sensible answers per ask: the weakest and strongest holders, every resource, both grip sides, every ideology
function choices(p: Pack, s: State, asks: (keyof Choice)[]): Choice[] {
  const opts = (a: keyof Choice) => {
    if (a !== "holder") return askOptions(p, a);
    const by = [...p.world.factions].sort((x, y) => s.support[x.id] - s.support[y.id]).map((h) => h.id);
    const pat = [...p.world.patrons].sort((x, y) => s.support[x.id] - s.support[y.id])[0]?.id;
    return [...new Set([by[0], by[1], by[by.length - 1], pat].filter(Boolean))] as string[];
  };
  return asks.reduce<Choice[]>((acc, a) => acc.flatMap((c) => opts(a).map((v) => ({ ...c, [a]: v }))), [{}]);
}

function moves(p: Pack, s: State): Move[] {
  if (s.phase === "answer") return options(p, s).flatMap((o, i) => (o.ok ? [{ kind: "answer" as const, i }] : []));
  if (s.phase === "pick") return [...(s.offer?.ids ?? []).map((id) => ({ kind: "pick" as const, id })), { kind: "pick" as const, id: null }];
  const low = [...p.world.factions].sort((a, b) => s.support[a.id] - s.support[b.id]).slice(0, 2);
  return [
    { kind: "stop" },
    ...hand(p, s)
      .filter((c) => c.ok)
      .flatMap<Move>((c) => (c.target ? low.map((f) => ({ kind: "play" as const, id: c.id, target: f.id })) : choices(p, s, c.asks).map((ch) => ({ kind: "play" as const, id: c.id, ch })))),
  ];
}

function step(p: Pack, s: State, m: Move) {
  if (m.kind === "answer") choose(p, s, m.i);
  else if (m.kind === "pick") takePick(p, s, m.id);
  else if (m.kind === "play") play(p, s, m.id, m.target, m.ch);
}

// finish the current month and `months` more with the greedy policy, on a copy
function rollout(p: Pack, s0: State, vision: string | null, months: number): number {
  const s = structuredClone(s0), stopAt = s.month + months;
  while (!s.over && s.month <= stopAt) {
    if (s.phase === "draw") {
      const ids = shortlist(p, s);
      if (!ids.length) pass(s);
      else draw(p, s, ids[0]);
      continue;
    }
    const m = best(p, s, vision);
    if (s.phase === "play" && m.kind === "stop") endMonth(p, s);
    else step(p, s, m);
  }
  return value(p, s, vision);
}

function best(p: Pack, s: State, vision: string | null, look = 0): Move {
  let top: Move = { kind: "stop" }, tv = -Infinity;
  for (const m of moves(p, s)) {
    const c = structuredClone(s);
    if (m.kind === "stop") endMonth(p, c);
    else step(p, c, m);
    const v = look ? rollout(p, c, vision, look) : value(p, c, vision);
    if (v > tv) {
      tv = v;
      top = m;
    }
  }
  return top;
}

const asBot = (name: string, pickVision: (p: Pack, s: State) => string | null, choice: (p: Pack, s: State) => Move): Bot => ({
  name,
  vision: pickVision,
  answer: (p, s) => {
    const m = choice(p, s);
    return m.kind === "answer" ? m.i : 0;
  },
  pick: (p, s) => {
    const m = choice(p, s);
    return m.kind === "pick" ? m.id : null;
  },
  play: (p, s) => {
    const m = choice(p, s);
    return m.kind === "play" ? { id: m.id, target: m.target, ch: m.ch } : null;
  },
});

export function randomBot(seed: number): Bot {
  const r = mulberry(seed);
  return asBot("random", () => null, (p, s) => {
    const ms = moves(p, s);
    return ms[Math.floor(r() * ms.length)];
  });
}

// prefer: card or pick ids taken whenever offered or playable (the combo measurement)
export const greedyBot = (vision: string | null, prefer: string[] = []): Bot =>
  asBot(`greedy:${vision ?? "free"}`, () => vision, (p, s) => {
    const want = s.phase === "pick" ? s.offer?.ids.find((id) => prefer.includes(id)) : s.phase === "play" ? hand(p, s).find((c) => c.ok && !c.target && !c.asks.length && prefer.includes(c.id))?.id : undefined;
    if (want) return s.phase === "pick" ? { kind: "pick", id: want } : { kind: "play", id: want };
    return best(p, s, s.vision);
  });

// 2-month lookahead on answers and picks; switches Vision once when another is clearly closer
export function adaptiveBot(): Bot {
  const choice = (p: Pack, s: State): Move => {
    if (!s.switched && s.month >= 4 && s.phase === "answer") {
      const ranked = p.deck.visions.map((v) => [v.id, progressOf(p, s, v.id)] as const).sort((a, b) => b[1] - a[1]);
      const cur = s.vision ? progressOf(p, s, s.vision) : 0;
      if (ranked[0][0] !== s.vision && ranked[0][1] - cur > 0.25) {
        try {
          switchVision(p, s, ranked[0][0]);
        } catch {
          // cannot pay: keep the Vision
        }
      }
    }
    return best(p, s, s.vision, s.phase === "play" ? 0 : 2);
  };
  const first = (p: Pack, s: State) =>
    p.deck.visions.map((v) => [v.id, rollout(p, { ...structuredClone(s), vision: v.id }, v.id, 3)] as const).sort((a, b) => b[1] - a[1])[0][0];
  return asBot("adaptive", first, choice);
}
