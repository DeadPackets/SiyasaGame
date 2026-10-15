import { type Effect, type Pack, ROLES, type Role } from "./pack";
import { PRESETS, type Preset, type Rules, TUNE } from "./tune";

export type Outcome =
  | { kind: "fallen"; by: string; month: number }
  | { kind: "swept" | "survived" | "fulfilled"; standing: number };

export type MoveSrc = "answer" | "card" | "talk" | "drift" | "act" | "band" | "debt";

export type Ev =
  | { t: "draw"; card: string }
  | { t: "history"; card: string; happened: boolean }
  | { t: "move"; holder: string; delta: number; src: MoveSrc; reason?: string }
  | { t: "grip"; delta: number }
  | { t: "res"; kind: Role; delta: number }
  | { t: "file"; ideology: string; n: number }
  | { t: "unlock"; id: string }
  | { t: "offer"; key: string; ids: string[] }
  | { t: "law"; id: string }
  | { t: "act"; holder: string }
  | { t: "plot"; holder: string }
  | { t: "intent"; holder: string; card: string }
  | { t: "election"; passed: boolean; standing: number }
  | { t: "debt"; months: number }
  | { t: "month"; month: number }
  | { t: "over"; outcome: Outcome };

export interface State {
  seed: number;
  rngN: number;
  rules: Rules;
  month: number;
  phase: "draw" | "answer" | "pick" | "play" | "over";
  card: string | null;
  plays: number;
  support: Record<string, number>;
  grip: number;
  res: Record<Role, number>;
  stacks: Record<string, number>;
  flags: string[];
  seen: string[];
  queue: string[];
  hist: Record<string, { happened: boolean; chose?: number }>;
  boost: { ideology: string; steps: number }[];
  doubleNext: boolean;
  holds: { holder: string; bound: "floor" | "ceiling"; level: number; months: number }[];
  mods: Effect[];
  trig: Record<number, boolean>;
  unlocked: string[];
  laws: string[];
  pickDone: string[];
  picked: string[];
  offer: { key: string; ids: string[] } | null;
  plotting: string[];
  debt: number;
  elected: number;
  vision: string | null;
  switched: boolean;
  banned: string[];
  log: { month: number; card: string; answer: number; ideology: string }[];
  track?: { month: number; support: Record<string, number>; grip: number; res: Record<Role, number> }[]; // one per month end, for balance analysis; older saves lack it
  over: Outcome | null;
}

export function newGame(p: Pack, o: { seed: number; rules?: Preset | Rules; vision?: string | null; banned?: string[] }): State {
  const w = p.world;
  return {
    seed: o.seed >>> 0,
    rngN: 0,
    rules: { ...(typeof o.rules === "object" ? o.rules : PRESETS[o.rules ?? "standard"]) },
    month: 1,
    phase: "draw",
    card: null,
    plays: TUNE.plays,
    support: Object.fromEntries([...w.factions, ...w.patrons].map((h) => [h.id, h.support])),
    grip: w.grip,
    res: Object.fromEntries(ROLES.map((r) => [r, w.resources[r].value])) as Record<Role, number>,
    stacks: Object.fromEntries(w.compass.map((id) => [id, 0])),
    flags: [],
    seen: [],
    queue: [],
    hist: {},
    boost: [],
    doubleNext: false,
    holds: [],
    mods: [],
    trig: {},
    unlocked: [],
    laws: [],
    pickDone: [],
    picked: [],
    offer: null,
    plotting: [],
    debt: 0,
    elected: 0,
    vision: o.vision ?? null,
    switched: false,
    banned: o.banned ?? [],
    log: [],
    track: [],
    over: null,
  };
}

// mulberry32 over (seed, counter), so the state stays plain JSON
export function rand(s: State): number {
  let t = (s.seed + Math.imul(0x6d2b79f5, ++s.rngN)) | 0;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
