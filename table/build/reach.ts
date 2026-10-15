// Vision reachability (owner decision N1): the greedy bot plays each Vision for 40 terms at preset standard; a Vision fulfilled in under 5% of them is an error.
import type { Pack } from "../engine";
import { greedyBot } from "../bots/bots";
import { runTerm } from "../bots/sim";

// max: a Vision the focused bot fulfils this often is a formality; it goes to the repair but never fails the build
export const REACH = { terms: 40, min: 0.05, max: 0.85 };

export function reach(p: Pack, terms = REACH.terms) {
  const t0 = performance.now(), rates: Record<string, number> = {}, errors: string[] = [], easy: string[] = [], crashes: string[] = [];
  const start = Object.fromEntries([...p.world.factions, ...p.world.patrons].map((h) => [h.id, h.support]));
  const law = (id: string) => p.world.compass.find((i) => p.deck.ideologies[i]?.law.id === id) ?? "centre";
  const pillar = (q: Pack["deck"]["visions"][number]["pillars"][number]) =>
    q.kind === "stack" ? `stack ${q.ideology} min ${q.min}`
    : q.kind === "zone" ? `zone ${q.zone}`
    : q.kind === "grip" ? `grip ${q.min != null ? `min ${q.min}` : `max ${q.max}`} (start ${p.world.grip})`
    : q.kind === "law" ? `law ${q.id} (playable only in the ${law(q.id)} zone)`
    : q.kind === "sup" ? `sup ${q.holder} min ${q.min} (start ${start[q.holder]})`
    : `res ${q.role} min ${q.min} (start ${p.world.resources[q.role]?.value})`;
  for (const v of p.deck.visions) {
    let won = 0;
    for (let seed = 1; seed <= terms; seed++) {
      try {
        if (runTerm(p, greedyBot(v.id), seed, { rules: "standard" }).outcome.kind === "fulfilled") won++;
      } catch (x) {
        crashes.push(`${v.id} seed ${seed}: ${(x as Error).message}`);
      }
    }
    rates[v.id] = won / terms;
    if (rates[v.id] < REACH.min)
      errors.push(`Vision ${v.id} "${v.name}" (corner ${v.corner}) was fulfilled in ${won} of ${terms} test terms (${Math.round(rates[v.id] * 100)}%), under ${REACH.min * 100}%. Pillars: ${v.pillars.map(pillar).join("; ")}. Make every pillar reachable from the start state within the term: lower a min, or swap a pillar for one this Vision's own cards can reach.`);
    else if (rates[v.id] > REACH.max)
      easy.push(`Vision ${v.id} "${v.name}" (corner ${v.corner}) was fulfilled in ${won} of ${terms} test terms (${Math.round(rates[v.id] * 100)}%), over ${REACH.max * 100}%: it asks too little. Pillars: ${v.pillars.map(pillar).join("; ")}. Raise one min (a sup min 10 to 20 above its start, or a stack min by 1), or add one pillar that costs this Vision something its rivals want.`);
  }
  return { rates, errors, easy, crashes, seconds: Math.round(performance.now() - t0) / 1000 };
}
