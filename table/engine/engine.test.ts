import { describe, expect, test } from "bun:test";
import { loadPack } from "../bots/load";
import { checkPack } from "./check";
import type { Effect, Pack } from "./pack";

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

import { card } from "./pack";
import { choose, draw, eligible, options, pass, shortlist } from "./turn";

const at = (p: Pack, id: string) => { const s = newGame(p, { seed: 1 }); draw(p, s, id, 1); return s; };

describe("the month's card", () => {
  test("an answer moves holders by size plus a clamped nudge, moves grip and files the card", () => {
    const s = at(egypt, "h01"), a = card(egypt, "h01").answers[0];
    const ev = choose(egypt, s, 0, { army: 9 });
    expect(s.support.army).toBe(78 + 8 + 3);
    expect(s.grip).toBe(65 + 5);
    expect(s.stacks.nat).toBe(1);
    expect(s.phase).toBe("play");
    expect(ev).toContainEqual({ t: "move", holder: "army", delta: 11, src: "answer", reason: a.reasons.army });
  });
  test("Address the nation doubles the next answer and files 2", () => {
    const s = at(egypt, "h01");
    s.doubleNext = true;
    choose(egypt, s, 0);
    expect([s.support.army, s.grip, s.stacks.nat, s.doubleNext]).toEqual([78 + 16, 75, 2, false]);
  });
  test("an answer you cannot pay for is refused while another is open", () => {
    const p = structuredClone(egypt);
    p.deck.history[0].answers[0].res = { trust: -2 };
    p.deck.history[0].answers[1].res = {};
    const s = at(p, "h01");
    s.res.trust = 1;
    expect(options(p, s).map((o) => o.ok).slice(0, 2)).toEqual([false, true]);
    expect(() => choose(p, s, 0)).toThrow();
  });
  test("when no answer can be paid, every answer opens and takes what you have", () => {
    const p = structuredClone(egypt);
    for (const a of p.deck.history[0].answers) a.res = { trust: -2 };
    const s = at(p, "h01");
    s.res.trust = 1;
    choose(p, s, 0);
    expect(s.res.trust).toBe(0);
  });
  test("a history card that does not happen is set aside", () => {
    const s = newGame(egypt, { seed: 1 });
    expect(draw(egypt, s, "h01", 0)).toEqual([{ t: "history", card: "h01", happened: false }]);
    expect(s.phase).toBe("draw");
    expect(shortlist(egypt, s)).not.toContain("h01");
  });
  test("the shortlist holds at most 5 cards, all inside their month window", () => {
    const s = newGame(egypt, { seed: 3 });
    const ids = shortlist(egypt, s);
    expect(ids.length).toBeGreaterThan(0);
    expect(ids.length).toBeLessThanOrEqual(5);
    for (const id of ids) expect(card(egypt, id).months[0]).toBeLessThanOrEqual(1);
  });
  test("a callback waits for its flag", () => {
    const c = egypt.deck.callbacks[0], s = newGame(egypt, { seed: 1 });
    s.month = c.months[0];
    expect(eligible(egypt, s).map((x) => x.id)).not.toContain(c.id);
    s.flags.push(...(c.requires ?? []));
    expect(eligible(egypt, s).map((x) => x.id)).toContain(c.id);
  });
  test("a lost election brings you down", () => {
    const e = egypt.deck.elections[0], s = newGame(egypt, { seed: 1 });
    for (const f of egypt.world.factions) s.support[f.id] = 20;
    draw(egypt, s, e.id);
    choose(egypt, s, e.answers.findIndex((a) => a.holdsElection));
    expect(s.over).toMatchObject({ kind: "fallen", by: "election" });
  });
  test("a month with no card left goes straight to plays", () => {
    const s = newGame(egypt, { seed: 1 });
    s.seen = [...egypt.deck.situations, ...egypt.deck.history, ...egypt.deck.callbacks, ...egypt.deck.elections].map((c) => c.id);
    expect(shortlist(egypt, s)).toEqual([]);
    pass(s);
    expect(s.phase).toBe("play");
  });
});

import { hand, play, takePick } from "./turn";

const playing = (p: Pack = egypt) => { const s = newGame(p, { seed: 1 }); pass(s); return s; };
const slot = (p: Pack, s: ReturnType<typeof newGame>, id: string) => hand(p, s).find((c) => c.id === id);

describe("the hand", () => {
  test("Talk lifts one faction by 8 for 1 Trust and uses a play", () => {
    const s = playing();
    play(egypt, s, "talk", "rev");
    expect([s.support.rev, s.res.trust, s.plays]).toEqual([44, 4, 1]);
  });
  test("the hand waits for the month's card, and 2 plays is the limit", () => {
    const s = newGame(egypt, { seed: 1 });
    expect(hand(egypt, s).every((c) => c.why === "phase")).toBe(true);
    pass(s);
    play(egypt, s, "talk", "rev");
    play(egypt, s, "talk", "rev");
    expect(slot(egypt, s, "talk")?.why).toBe("plays");
  });
  test("3 cards in a stack unlock its power card; 2 offer its picks once", () => {
    const s = at(egypt, "h01");
    s.stacks.nat = 2;
    const ev = choose(egypt, s, 0);
    expect(ev).toContainEqual({ t: "unlock", id: "p-nat" });
    expect(s.offer?.key).toBe("stack:nat");
    expect(s.phase).toBe("pick");
    const id = s.offer?.ids[0] as string;
    takePick(egypt, s, id);
    expect([s.phase, s.picked]).toEqual(["play", [id]]);
    expect(s.offer).toBeNull();
  });
  test("a pick set with every card banned gives no offer", () => {
    const s = newGame(egypt, { seed: 1, banned: egypt.deck.ideologies.nat.picks.map((m) => m.id) });
    draw(egypt, s, "h01", 1);
    s.stacks.nat = 1;
    choose(egypt, s, 0);
    expect([s.offer, s.phase]).toEqual([null, "play"]);
  });
  test("a major law needs its corner's zone", () => {
    const s = playing();
    s.unlocked.push("l-lib");
    s.res = { money: 35, force: 9, voice: 9, trust: 9 };
    s.stacks.lib = 5;
    expect(slot(egypt, s, "l-lib")?.why).toBe("zone");
    s.stacks.lib = 12;
    expect(slot(egypt, s, "l-lib")?.ok).toBe(true);
  });
  test("a law is enacted once and its modifiers last", () => {
    const s = playing();
    s.stacks.nat = 5;
    s.unlocked.push("l-nat");
    play(egypt, s, "l-nat");
    expect(s.laws).toEqual(["l-nat"]);
    expect(slot(egypt, s, "l-nat")).toBeUndefined();
    expect(s.mods).toContainEqual(egypt.deck.ideologies.nat.law.effects.find((e) => e.op === "income") as Effect);
  });
  test("a cost modifier changes a price; an exchange covers a shortfall", () => {
    const s = playing();
    s.mods.push({ op: "cost", family: "talk", kind: "trust", delta: -1 });
    expect(slot(egypt, s, "talk")?.cost).toEqual({});
    const t = playing();
    t.res.trust = 0;
    expect(slot(egypt, t, "talk")?.why).toBe("cost");
    t.mods.push({ op: "exchange", from: "voice", to: "trust", rate: 0.5 });
    play(egypt, t, "talk", "rev");
    expect([t.res.voice, t.res.trust]).toEqual([2, 0]);
  });
});
