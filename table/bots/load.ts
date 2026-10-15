import { readFileSync } from "node:fs";
import type { Pack } from "../engine/pack";

export function loadPack(name: "egypt-2011" | "mars-2091"): Pack {
  const read = (f: string) => JSON.parse(readFileSync(new URL(`../packs/${name}/${f}`, import.meta.url), "utf8"));
  return { world: read("world.json"), deck: read("deck.json") };
}
