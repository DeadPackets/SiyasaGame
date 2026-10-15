import { describe, expect, test } from "bun:test";
import { loadPack } from "../bots/load";
import { checkPack } from "./check";
import type { Pack } from "./pack";

const egypt = loadPack("egypt-2011");
const mars = loadPack("mars-2091");

describe("pack check", () => {
  test.each([["egypt", egypt], ["mars", mars]] as const)("%s is playable", (_, p) => expect(checkPack(p)).toEqual([]));

  const broken = (f: (p: Pack) => void) => { const p = structuredClone(egypt); f(p); return checkPack(p).join("\n"); };
  test.each([
    ["a move to an unknown holder", (p: Pack) => { p.deck.ideologies.nat.power.effects[0] = { op: "move", target: "nobody", dir: "+", size: "s" }; }, "bad move"],
    ["a modifier on a one-shot card", (p: Pack) => { p.deck.ideologies.nat.power.effects.push({ op: "sizeUp", ideology: "nat" }); }, "is a modifier"],
    ["a missing law", (p: Pack) => { delete (p.deck.ideologies.nat as Partial<Pack["deck"]["ideologies"][string]>).law; }, "nat.law: missing"],
    ["a history answer out of range", (p: Pack) => { p.deck.history[0].historyAnswer = 9; }, "historyAnswer"],
    ["a flag no answer sets", (p: Pack) => { p.deck.callbacks[0].requires = ["never-set"]; }, "never set"],
  ])("refuses %s", (_, f, msg) => expect(broken(f)).toContain(msg));
});

import { marker, resting, zone } from "./geo";
import { newGame } from "./state";
import { PRESETS, type Preset } from "./tune";

describe("new game", () => {
  test("starts from the pack", () => {
    const s = newGame(egypt, { seed: 1 });
    expect(s.support.army).toBe(78);
    expect(s.grip).toBe(65);
    expect(s.res).toEqual({ money: 35, force: 5, voice: 4, trust: 5 });
    expect(zone(egypt, s)).toBe("nat");
  });
  test.each(Object.keys(PRESETS))("preset %s sets the rules", (k) => expect(newGame(egypt, { seed: 1, rules: k as Preset }).rules).toEqual(PRESETS[k as Preset]));
  const threeCorners = (() => {
    const p = structuredClone(egypt), keep = ["nat", "lib", "isl"];
    p.world.compass = keep;
    p.world.ideologies = p.world.ideologies.filter((i) => keep.includes(i.id));
    for (const h of [...p.world.factions, ...p.world.patrons]) h.mix = [[keep[h.id.length % 3], 1]];
    p.world.marker = [["nat", 1]];
    return p;
  })();
  test.each([["egypt", egypt], ["three corners", threeCorners]] as const)("%s: resting levels stay 0 to 100", (_, p) => {
    const s = newGame(p, { seed: 1 });
    for (const h of [...p.world.factions, ...p.world.patrons]) {
      const r = resting(p, s, h.id);
      expect(r).toBeGreaterThanOrEqual(0);
      expect(r).toBeLessThanOrEqual(100);
    }
    expect(Number.isFinite(marker(p, s)[0])).toBe(true);
  });
  test("a holder near the marker rests higher than one far from it", () => {
    const s = newGame(egypt, { seed: 1 });
    expect(resting(egypt, s, "army")).toBeGreaterThan(resting(egypt, s, "rev"));
  });
});
