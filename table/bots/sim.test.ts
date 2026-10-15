import { expect, test } from "bun:test";
import { adaptiveBot, greedyBot, randomBot } from "./bots";
import { loadPack } from "./load";
import { runTerm } from "./sim";
import { draw, choose, newGame } from "../engine";

test.each(["egypt-2011", "mars-2091"] as const)("%s: every bot finishes 10 terms inside the ranges, and a seed replays", (name) => {
  const p = loadPack(name);
  const bots = [randomBot(1), greedyBot(null), ...p.deck.visions.map((v) => greedyBot(v.id)), adaptiveBot()];
  for (const b of bots) for (let seed = 1; seed <= 10; seed++) expect(runTerm(p, b, seed).outcome).toBeDefined();
  expect(runTerm(p, adaptiveBot(), 5)).toEqual(runTerm(p, adaptiveBot(), 5));
}, 600_000);

test("a bot told to prefer a combo part takes it when it is offered", () => {
  const p = loadPack("egypt-2011"), want = p.deck.ideologies.nat.picks[2].id;
  const s = newGame(p, { seed: 1 });
  draw(p, s, "h01", 1);
  s.stacks.nat = 1;
  choose(p, s, 0);
  expect(s.offer?.ids).toContain(want);
  expect(greedyBot("v1", [want]).pick(p, s)).toBe(want);
});
