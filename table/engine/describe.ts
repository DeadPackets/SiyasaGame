import { type Cond, type Effect, type HandDef, type Pack, type Role, card, holder } from "./pack";
import { sizeNum } from "./rules";
import { TUNE } from "./tune";

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
const FAMILY = { talk: "Talk", address: "Address", power: "power cards", law: "laws", grip: "grip cards", patron: "backer cards", answers: "answers" };
const GROUPS = ["factions", "patrons"];

export function describe(p: Pack, e: Effect): string {
  const res = (k: Role | "choose") => (k === "choose" ? "of one resource you choose" : p.world.resources[k].name);
  const ideo = (id: string) => (id === "choose" ? "an ideology you choose" : p.world.ideologies.find((i) => i.id === id)?.name ?? id);
  const who = (t: string) =>
    t === "choose" ? "a holder you choose"
    : t === "factions" ? "every faction"
    : t === "patrons" ? "every foreign backer"
    : t === "lowest" ? "the weakest faction"
    : t.startsWith("lean:") ? `every holder near ${ideo(t.slice(5))}`
    : holder(p, t).short;
  const pct = (m: number) => `${Math.round(Math.abs(1 - m) * 100)}%`;
  const when = (c: Cond, lead: string): string => {
    switch (c.if) {
      case "support": return `${lead} ${who(c.target)} ${c.target.startsWith("lean:") || GROUPS.includes(c.target) ? "are" : "is"} ${c.above != null ? `above ${c.above}` : `below ${c.below}`}`;
      case "grip": return `${lead} grip is ${cap(c.band)}`;
      case "stack": return `${lead} you have ${c.min} or more ${ideo(c.ideology)} cards`;
      case "zone": return `${lead} you stand in ${c.zone === "centre" ? "the Pragmatist centre" : `the ${ideo(c.zone)} zone`}`;
      case "monthEnd": return "at each month end";
    }
  };
  switch (e.op) {
    case "move": return `${cap(who(e.target))} ${e.dir}${sizeNum(e.size)}.`;
    case "grip": if (e.dir === "choose") return `Grip ${TUNE.gripSize[e.size]} toward Iron or Open, as you choose.`;
      return `Grip ${e.dir === "iron" ? "+" : "-"}${TUNE.gripSize[e.size]}, toward ${e.dir === "iron" ? "Iron" : "Open"}.`;
    case "gain": return `Get ${e.n} ${res(e.kind)}.`;
    case "spend": return `Pay ${e.n} ${res(e.kind)}.`;
    case "file": return `File ${e.n} card${e.n > 1 ? "s" : ""} under ${ideo(e.ideology)}.`;
    case "boostNext": return `Your next ${e.ideology === "any" ? "" : `${ideo(e.ideology)} `}answer moves support ${e.steps} size${e.steps > 1 ? "s" : ""} more.`;
    case "hold": return `${cap(who(e.target))} cannot go ${e.bound === "floor" ? "below" : "above"} ${e.level} for ${e.months} month${e.months > 1 ? "s" : ""}.`;
    case "setFlag": return "";
    case "queueNext": return `Next month's card: ${card(p, e.tag)?.title ?? "a set card"}.`;
    case "cancelIntent": return `${cap(who(e.holder))} drops its demand.`;
    case "cost": return `${cap(FAMILY[e.family])} cost ${Math.abs(e.delta)} ${e.delta < 0 ? "less" : "more"} ${res(e.kind)}.`;
    case "sizeUp": return `${ideo(e.ideology)} answers move support 1 size more.`;
    case "drift": return e.multiplier === 0 ? `${cap(who(e.target))}: support does not drift.` : `${cap(who(e.target))}: support drifts ${pct(e.multiplier)} ${e.multiplier < 1 ? "slower" : "faster"}.`;
    case "gripRate": return `Grip moves ${pct(e.multiplier)} ${e.multiplier < 1 ? "slower" : "faster"}.`;
    case "extraPlay": return `1 more play every ${e.everyNMonths} months.`;
    case "income": return `Get ${e.n} ${res(e.kind)} a month${e.when ? `, ${when(e.when, "while")}` : ""}.`;
    case "exchange": return `Pay missing ${res(e.to)} with ${res(e.from)}, ${Math.ceil(1 / e.rate)} for 1.`;
    case "trigger": return `${cap(when(e.when, "when"))}: ${e.effects.map((x) => describe(p, x)).filter(Boolean).join(" ")}`;
  }
}

export const rulesLine = (p: Pack, def: HandDef) => def.effects.map((e) => describe(p, e)).filter(Boolean).join(" ");
