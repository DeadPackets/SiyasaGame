import { ONE_SHOT, type Pack, ROLES } from "./pack";

const SIZES = ["s", "m", "l"];
const FAMILIES = ["talk", "address", "power", "law", "grip", "patron", "answers"];
const num = (x: unknown, lo: number, hi: number) => typeof x === "number" && Number.isFinite(x) && x >= lo && x <= hi;
const role = (k: unknown) => (ROLES as readonly unknown[]).includes(k);

// What play needs from a pack; content and style checks stay in the build's validator. The pack is untrusted JSON until this passes.
// biome-ignore-all lint/suspicious/noExplicitAny: untrusted JSON
export function checkPack(pack: Pack): string[] {
  const p = pack as any, w = p.world, d = p.deck, e: string[] = [];
  const I: string[] = (w.ideologies ?? []).map((x: any) => x.id);
  const HS: any[] = [...(w.factions ?? []), ...(w.patrons ?? [])], H: string[] = HS.map((x) => x.id);
  const ids = new Set<string>(), flags = new Set<string>(), need: [string, string][] = [], queued: [string, string][] = [];

  if (I.length < 3 || I.length > 5) e.push(`${I.length} ideologies; need 3 to 5`);
  if (w.compass?.length !== I.length || new Set(w.compass).size !== I.length || w.compass.some((id: string) => !I.includes(id))) e.push("compass must list every ideology once");
  if (!Number.isInteger(w.months) || w.months < 12 || w.months > 18) e.push(`months ${w.months}; need 12 to 18`);
  if ((w.factions?.length ?? 0) < 4 || w.factions.length > 6) e.push("need 4 to 6 factions");
  if ((w.patrons?.length ?? 0) < 2 || w.patrons.length > 3) e.push("need 2 to 3 patrons");
  const mix = (m: any, at: string) => {
    if (!Array.isArray(m) || !m.length || m.some((x: any) => !I.includes(x?.[0]) || !num(x?.[1], 0.01, 1)) || Math.abs(m.reduce((a: number, x: any) => a + x[1], 0) - 1) > 0.011) e.push(`${at}: bad mix`);
  };
  mix(w.marker, "marker");
  if (!num(w.grip, 0, 100)) e.push("grip must be 0 to 100");
  for (const h of HS) {
    const pat = w.patrons.includes(h);
    mix(h.mix, h.id);
    if (!num(h.support, 0, 100)) e.push(`${h.id}: support must be 0 to 100`);
    if (!pat && !(Number.isInteger(h.power) && h.power >= 1 && h.power <= 3)) e.push(`${h.id}: power must be 1 to 3`);
    if (pat && !num(h.grip, 0, 100)) e.push(`${h.id}: preferred grip must be 0 to 100`);
    if (!role(h.produces)) e.push(`${h.id}: produces ${h.produces}`);
    for (const [k, v] of Object.entries(h.act?.res ?? {})) if (!role(k) || !num(v, -3, -1)) e.push(`${h.id}: act.res ${k}`);
    for (const [k, v] of Object.entries(h.act?.sup ?? {})) if (!H.includes(k) || !num(v, -5, 5)) e.push(`${h.id}: act.sup ${k}`);
  }
  for (const r of ROLES) if (!num(w.resources?.[r]?.value, -50, 100)) e.push(`resources.${r} needs a start value`);
  if (!num(w.balance, -5, 5)) e.push("balance must be -5 to 5");

  const target = (t: any) => H.includes(t) || ["factions", "patrons", "lowest"].includes(t) || (typeof t === "string" && t.startsWith("lean:") && I.includes(t.slice(5)));
  const cond = (c: any, at: string) => {
    const ok = {
      support: () => target(c.target) && (num(c.above, 0, 100) || num(c.below, 0, 100)),
      grip: () => ["iron", "middle", "open"].includes(c.band),
      stack: () => I.includes(c.ideology) && num(c.min, 1, 20),
      zone: () => c.zone === "centre" || I.includes(c.zone),
      monthEnd: () => true,
    }[c?.if as string];
    if (!ok?.()) e.push(`${at}: bad condition ${JSON.stringify(c)}`);
  };
  const effects = (list: any, at: string, mods: boolean) => {
    if (list == null) return;
    if (!Array.isArray(list)) return e.push(`${at}: effects must be a list`);
    for (const x of list) {
      if (!ONE_SHOT.includes(x?.op) && !mods) { e.push(`${at}: ${x?.op} is a modifier; only one-shot effects here`); continue; }
      const ok = (() => {
        switch (x.op) {
          case "move": return target(x.target) && ["+", "-"].includes(x.dir) && SIZES.includes(x.size);
          case "grip": return ["open", "iron"].includes(x.dir) && SIZES.includes(x.size);
          case "gain": case "spend": return role(x.kind) && num(x.n, 1, 5);
          case "file": return I.includes(x.ideology) && num(x.n, 1, 2);
          case "boostNext": return (x.ideology === "any" || I.includes(x.ideology)) && num(x.steps, 1, 2);
          case "hold": return target(x.target) && ["floor", "ceiling"].includes(x.bound) && num(x.level, 0, 100) && num(x.months, 1, 6);
          case "setFlag": flags.add(x.flag); return typeof x.flag === "string";
          case "queueNext": queued.push([x.tag, at]); return typeof x.tag === "string";
          case "cancelIntent": return H.includes(x.holder);
          case "cost": return FAMILIES.includes(x.family) && role(x.kind) && num(x.delta, -2, 2);
          case "sizeUp": return I.includes(x.ideology);
          case "drift": return target(x.target) && num(x.multiplier, 0, 2);
          case "gripRate": return num(x.multiplier, 0.5, 2);
          case "extraPlay": return num(x.everyNMonths, 2, 99);
          case "income": if (x.when) cond(x.when, at); return role(x.kind) && num(x.n, 1, 2);
          case "exchange": return role(x.from) && role(x.to) && x.from !== x.to && num(x.rate, 0.01, 1);
          case "trigger": cond(x.when, at); effects(x.effects, `${at} trigger`, false); return Array.isArray(x.effects) && x.effects.length > 0;
          default: return false;
        }
      })();
      if (!ok) e.push(`${at}: bad ${x?.op} ${JSON.stringify(x)}`);
    }
  };
  const handCard = (c: any, at: string, mods: boolean) => {
    if (!c?.id) return e.push(`${at}: missing`);
    if (ids.has(c.id)) e.push(`id ${c.id} is used twice`);
    ids.add(c.id);
    for (const [k, v] of Object.entries(c.cost ?? {})) if (!role(k) || !num(v, 1, 5)) e.push(`${c.id}: cost ${k} ${v}`);
    if (!c.effects?.length) e.push(`${c.id}: no effects`);
    effects(c.effects, c.id, mods);
  };
  const pickCard = (c: any, at: string) => {
    handCard(c, at, true);
    for (const x of c?.effects ?? []) if (ONE_SHOT.includes(x?.op)) e.push(`${c.id}: a pick takes modifiers only, not ${x.op}`);
  };
  for (const id of I) {
    const x = d.ideologies?.[id];
    if (!x) { e.push(`deck.ideologies.${id} missing`); continue; }
    handCard(x.power, `${id}.power`, false);
    handCard(x.law, `${id}.law`, true);
    if (x.picks?.length !== 3) e.push(`${id}.picks: need 3`);
    (x.picks ?? []).forEach((m: any, k: number) => pickCard(m, `${id}.picks[${k}]`));
  }
  if (d.centreLaws?.length !== 2) e.push("centreLaws: need 2");
  (d.centreLaws ?? []).forEach((c: any, k: number) => handCard(c, `centreLaws[${k}]`, true));
  for (const set of ["iron", "open", "centre"]) {
    if (d.picks?.[set]?.length !== 3) e.push(`picks.${set}: need 3`);
    (d.picks?.[set] ?? []).forEach((m: any, k: number) => pickCard(m, `picks.${set}[${k}]`));
  }
  for (const set of ["iron", "open"]) {
    if (!d.gripCards?.[set]?.length) e.push(`gripCards.${set}: need 1 or more`);
    (d.gripCards?.[set] ?? []).forEach((c: any, k: number) => handCard(c, `gripCards.${set}[${k}]`, false));
  }
  for (const h of w.patrons ?? []) handCard(d.patronCards?.[h.id], `patronCards.${h.id}`, false);

  const cardCheck = (c: any, at: string) => {
    if (!c?.id) return e.push(`${at}: missing`);
    if (ids.has(c.id)) e.push(`id ${c.id} is used twice`);
    ids.add(c.id);
    if (!(c.months?.[0] >= 1 && c.months[1] >= c.months[0] && c.months[1] <= w.months)) e.push(`${c.id}: months must be inside 1..${w.months}`);
    if (c.band != null && !["iron", "open"].includes(c.band)) e.push(`${c.id}: band ${c.band}`);
    if (c.zone != null && c.zone !== "centre" && !I.includes(c.zone)) e.push(`${c.id}: zone ${c.zone}`);
    for (const f of [...(c.requires ?? []), ...(c.blocks ?? [])]) need.push([f, c.id]);
    if (!(c.answers?.length >= 2 && c.answers.length <= 3)) e.push(`${c.id}: need 2 or 3 answers`);
    (c.answers ?? []).forEach((a: any, k: number) => {
      const aw = `${c.id} answer ${k + 1}`;
      if (!I.includes(a.ideology)) e.push(`${aw}: ideology ${a.ideology}`);
      for (const [r, v] of Object.entries(a.res ?? {})) if (!role(r) || !num(v, -2, 2)) e.push(`${aw}: res ${r} ${v}`);
      for (const [h, v] of Object.entries(a.moves ?? {})) if (!H.includes(h) || !/^[+-][sml]$/.test(String(v))) e.push(`${aw}: move ${h} ${v}`);
      if (a.grip != null && !/^[+-][sml]$/.test(a.grip)) e.push(`${aw}: grip ${a.grip}`);
      effects(a.effects, aw, false);
      for (const f of a.flags ?? []) flags.add(f);
    });
  };
  for (const [sec, lo] of [["situations", 28], ["history", 1], ["callbacks", 0], ["elections", 1]] as const) {
    if ((d[sec]?.length ?? 0) < lo) e.push(`${sec}: ${d[sec]?.length ?? 0}; need at least ${lo}`);
    (d[sec] ?? []).forEach((c: any, k: number) => cardCheck(c, `${sec}[${k}]`));
  }
  for (const c of d.history ?? []) if (!Number.isInteger(c.historyAnswer) || !c.answers?.[c.historyAnswer]) e.push(`${c.id}: historyAnswer must index an answer`);
  for (const c of d.elections ?? []) if (!c.answers?.some((a: any) => a.holdsElection === true)) e.push(`${c.id}: one answer must hold the election`);
  for (const c of d.callbacks ?? []) if (!c.requires?.length) e.push(`${c.id}: a callback must require a flag`);
  for (const h of H) cardCheck(d.intents?.[h], `intents.${h}`);
  for (const [f, at] of need) if (!flags.has(f)) e.push(`${at}: flag ${f} is never set`);
  for (const [id, at] of queued) if (!ids.has(id)) e.push(`${at}: queueNext ${id} does not exist`);

  const laws = new Set([...I.map((i) => d.ideologies?.[i]?.law?.id), ...(d.centreLaws ?? []).map((c: any) => c.id)]);
  if (!(d.visions?.length >= 1)) e.push("need 1 or more Visions");
  for (const v of d.visions ?? []) for (const q of v.pillars ?? []) {
    const ok = {
      stack: () => I.includes(q.ideology) && num(q.min, 1, 20),
      zone: () => q.zone === "centre" || I.includes(q.zone),
      grip: () => num(q.min, 0, 100) || num(q.max, 0, 100),
      law: () => laws.has(q.id),
      sup: () => H.includes(q.holder) && num(q.min, 0, 100),
      res: () => role(q.role) && typeof q.min === "number",
    }[q?.kind as string];
    if (!ok?.()) e.push(`${v.id}: pillar ${JSON.stringify(q)} cannot be checked`);
  }
  for (const c of d.combos ?? []) if (!c.parts?.every((id: string) => ids.has(id))) e.push(`combo ${c.name}: unknown part`);
  return e;
}
