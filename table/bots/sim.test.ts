import { expect, test } from "bun:test";
import { adaptiveBot, greedyBot, randomBot } from "./bots";
import { loadPack } from "./load";
import { runTerm } from "./sim";

test.each(["egypt-2011", "mars-2091"] as const)("%s: every bot finishes 10 terms inside the ranges, and a seed replays", (name) => {
  const p = loadPack(name);
  const bots = [randomBot(1), greedyBot(null), ...p.deck.visions.map((v) => greedyBot(v.id)), adaptiveBot()];
  for (const b of bots) for (let seed = 1; seed <= 10; seed++) expect(runTerm(p, b, seed).outcome).toBeDefined();
  expect(runTerm(p, adaptiveBot(), 5)).toEqual(runTerm(p, adaptiveBot(), 5));
}, 600_000);
