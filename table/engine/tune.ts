// Every rule number. The bots set the final values; balance changes touch only this file.
export const TUNE = {
  size: { s: 4, m: 8, l: 12 },
  stepAbove: 4,
  gripSize: { s: 5, m: 10, l: 15 },
  nudgeMax: 3,
  startWeight: 4,
  cornerZone: 0.8,
  centreZone: 0.15,
  stack: { pick: 2, power: 3, major: 5 },
  cap: 10,
  plays: 2,
  handCap: 8,
  bar: 50,
  produceAt: 65,
  ironAt: 60,
  openAt: 40,
  pickIron: 80,
  pickOpen: 20,
  ironSqueeze: { under: 30, loss: 2 },
  patronPenalty: { per: 20, loss: 10 },
  debtFactionLoss: 5,
  debtFall: 2,
  talk: { cost: { trust: 1 }, up: 5 },
  address: { cost: { voice: 1 } },
  electionBonus: { voice: 1, trust: 1 },
  patronCardAt: 60,
  visionSwitch: { force: 1, voice: 1, trust: 1 },
  shortlist: 5,
  plausibility: 0.7,
  kindWeight: { history: 1.5, callback: 1.2, election: 1.2, situation: 1, intent: 1 },
};

export type Rules = { drift: number; intentUnder: number; actUnder: number; sanctions: number };

export const PRESETS = {
  story: { drift: 0.1, intentUnder: 25, actUnder: 10, sanctions: 0.5 },
  standard: { drift: 0.15, intentUnder: 30, actUnder: 15, sanctions: 1 },
  hard: { drift: 0.15, intentUnder: 35, actUnder: 15, sanctions: 1 },
  brutal: { drift: 0.25, intentUnder: 35, actUnder: 20, sanctions: 2 },
} satisfies Record<string, Rules>;

export type Preset = keyof typeof PRESETS;
