export const ROLES = ["money", "force", "voice", "trust"] as const;
export type Role = (typeof ROLES)[number];
export type Res = Partial<Record<Role, number>>;
export type Size = "s" | "m" | "l";
export type Band = "iron" | "middle" | "open";
export type Mix = [string, number][];
export type Move = `${"+" | "-"}${Size}`;

export interface Holder {
  id: string;
  name: string;
  short: string;
  mix: Mix;
  support: number;
  power?: number;
  grip?: number;
  produces: Role;
  act: { text: string; res?: Res; sup?: Record<string, number> };
  fall: string;
  fates: { hi: string; lo: string };
}

export interface World {
  id: string;
  title: string;
  polity: string;
  office: { title: string; holder: string; oath?: string; oathSource?: string };
  date: string;
  months: number;
  reckoning: { date: string; name: string; meaning: string };
  ideologies: { id: string; name: string; ruler: string }[];
  compass: string[];
  marker: Mix;
  grip: number;
  factions: Holder[];
  patrons: Holder[];
  resources: Record<Role, { name: string; icon: string; value: number; unit?: string }>;
  balance: number;
}

export type Cond =
  | { if: "support"; target: string; above?: number; below?: number }
  | { if: "grip"; band: Band }
  | { if: "stack"; ideology: string; min: number }
  | { if: "zone"; zone: string }
  | { if: "monthEnd" };

export type Family = "talk" | "address" | "power" | "law" | "grip" | "patron" | "answers";

export type Effect =
  | { op: "move"; target: string; dir: "+" | "-"; size: Size }
  | { op: "grip"; dir: "open" | "iron" | "choose"; size: Size }
  | { op: "gain" | "spend"; kind: Role | "choose"; n: number }
  | { op: "file"; ideology: string; n: number }
  | { op: "boostNext"; ideology: string; steps: number }
  | { op: "hold"; target: string; bound: "floor" | "ceiling"; level: number; months: number }
  | { op: "setFlag"; flag: string }
  | { op: "queueNext"; tag: string }
  | { op: "cancelIntent"; holder: string }
  | { op: "cost"; family: Family; kind: Role; delta: number }
  | { op: "sizeUp"; ideology: string }
  | { op: "drift"; target: string; multiplier: number }
  | { op: "gripRate"; multiplier: number }
  | { op: "extraPlay"; everyNMonths: number }
  | { op: "income"; kind: Role; n: number; when?: Cond }
  | { op: "exchange"; from: Role; to: Role; rate: number }
  | { op: "trigger"; when: Cond; effects: Effect[] };

// "choose" in a hand card's one-shot effect: the player picks at play time (owner ruling O12)
export const CHOOSE = "choose";
export type Ask = "holder" | "kind" | "dir" | "ideology";
export type Choice = { holder?: string; kind?: Role; dir?: "iron" | "open"; ideology?: string };

export const ONE_SHOT: string[] = ["move", "grip", "gain", "spend", "file", "boostNext", "hold", "setFlag", "queueNext", "cancelIntent"];

export interface Answer {
  text: string;
  sub: string;
  ideology: string;
  res?: Res;
  moves: Record<string, Move>;
  reasons: Record<string, string>;
  grip?: Move;
  gripWhy?: string;
  effects?: Effect[];
  flags?: string[];
  holdsElection?: boolean;
}

export interface Card {
  id: string;
  title: string;
  question: string;
  body: string;
  months: [number, number];
  carrier?: { name: string; role: string; real: boolean }; // dropped from new packs (owner, 2026-10-15)
  answers: Answer[];
  band?: "iron" | "open";
  zone?: string;
  requires?: string[];
  blocks?: string[];
  holder?: string;
  date?: string;
  history?: string;
  historyAnswer?: number;
}

export interface HandDef { id: string; title: string; flavour: string; cost?: Res; effects: Effect[] }

export type Pillar = { text: string } & (
  | { kind: "stack"; ideology: string; min: number }
  | { kind: "zone"; zone: string }
  | { kind: "grip"; min?: number; max?: number }
  | { kind: "law"; id: string }
  | { kind: "sup"; holder: string; min: number }
  | { kind: "res"; role: Role; min: number }
);

export interface Vision { id: string; name: string; line: string; corner: string; pillars: Pillar[] }

export interface Deck {
  ideologies: Record<string, { power: HandDef; law: HandDef; picks: HandDef[] }>;
  centreLaws: HandDef[];
  picks: Record<"iron" | "open" | "centre", HandDef[]>;
  gripCards: Record<"iron" | "open", HandDef[]>;
  patronCards: Record<string, HandDef>;
  visions: Vision[];
  combos: { name: string; parts: [string, string]; why: string }[];
  intents: Record<string, Card>;
  elections: Card[];
  history: Card[];
  callbacks: Card[];
  situations: Card[];
}

export interface Pack { world: World; deck: Deck }

export type CardKind = "situation" | "history" | "callback" | "election" | "intent";

const INDEX = new WeakMap<Pack, { holders: Map<string, Holder>; cards: Map<string, [Card, CardKind]>; hand: Map<string, HandDef> }>();
function index(p: Pack) {
  let x = INDEX.get(p);
  if (!x) {
    const d = p.deck;
    const tag = (cs: Card[], k: CardKind) => cs.map((c) => [c.id, [c, k]] as [string, [Card, CardKind]]);
    x = {
      holders: new Map([...p.world.factions, ...p.world.patrons].map((h) => [h.id, h])),
      cards: new Map([...tag(d.situations, "situation"), ...tag(d.history, "history"), ...tag(d.callbacks, "callback"), ...tag(d.elections, "election"), ...tag(Object.values(d.intents), "intent")]),
      hand: new Map(
        [...Object.values(d.ideologies).flatMap((i) => [i.power, i.law, ...i.picks]), ...d.centreLaws, ...Object.values(d.picks).flat(), ...Object.values(d.gripCards).flat(), ...Object.values(d.patronCards)].map((c) => [c.id, c]),
      ),
    };
    INDEX.set(p, x);
  }
  return x;
}

export const holder = (p: Pack, id: string): Holder => index(p).holders.get(id) as Holder;
export const card = (p: Pack, id: string): Card => (index(p).cards.get(id) as [Card, CardKind])[0];
export const kindOf = (p: Pack, id: string): CardKind => (index(p).cards.get(id) as [Card, CardKind])[1];
export const handDef = (p: Pack, id: string): HandDef | undefined => index(p).hand.get(id);
