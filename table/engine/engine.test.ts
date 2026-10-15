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
