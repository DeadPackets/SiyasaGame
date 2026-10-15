// Code checks for the world, music and deck outputs. Each check returns a list of errors a model can fix. No file system: it bundles into a Worker.
import { arrange, lintBrief, PALETTE } from "../client/src/hall/arrange.js";
import { validate as hallValidate } from "../client/src/hall/engine.js";
import { EMBLEMS } from "../client/src/patterns/emblem.js";
import homes from "../client/src/patterns/homes.json";
import samples from "../client/public/hall/samples-local.json";

export const TAGS = homes.tags;
export const SAMPLES = samples;
export { EMBLEMS, PALETTE };
export const ICONS = ["coin", "gem", "grain", "crate", "shield", "sword", "spear", "mast", "scroll", "screen", "crowd", "hand", "seal", "flame", "star", "book"];
export const ROLES = ["money", "force", "voice", "trust"];

const str = (x) => typeof x === "string" && x.trim().length > 0;
const num = (x, lo = -Infinity, hi = Infinity) => typeof x === "number" && Number.isFinite(x) && x >= lo && x <= hi;

// ---------- world ----------
export function checkWorld(w) {
  for (const k of ["ideologies", "factions", "patrons", "compass", "timeline", "people", "seeds", "traditions", "adoptions"]) if (w[k] != null && !Array.isArray(w[k])) return [`${k} must be a list (a JSON array), not ${typeof w[k]}`];
  const e = [], I = w.ideologies ?? [], F = w.factions ?? [], P = w.patrons ?? [], H = [...F, ...P];
  const iid = new Set(I.map((x) => x.id)), hid = new Set(H.map((x) => x.id));
  for (const k of ["id", "title", "voice", "polity", "office", "date", "months", "reckoning", "ideologies", "compass", "marker", "grip", "factions", "patrons", "resources", "balance", "balanceWhy", "timeline", "people", "era_brief", "traditions", "adoptions", "music"])
    if (w[k] == null) e.push(`missing top-level field ${k}`);
  if (!(I.length >= 3 && I.length <= 5)) e.push(`${I.length} ideologies; need 3 to 5`);
  for (const x of I) if (!str(x.name) || x.name.length > 22 || x.name.trim().split(/\s+/).length > 2 || /[()]/.test(x.name)) e.push(`ideology ${x.id}: name must be its plain common name, 1 or 2 words, at most 22 characters, no parentheses`);
  if (!(F.length >= 4 && F.length <= 6)) e.push(`${F.length} factions; need 4 to 6`);
  if (!(P.length >= 2 && P.length <= 3)) e.push(`${P.length} patrons; need 2 to 3`);
  if (!num(w.months, 12, 18) || !Number.isInteger(w.months)) e.push(`months ${w.months}; need a whole number 12 to 18`);
  if (!/^\d{4}-\d\d$/.test(w.date ?? "") && !/^-\d{4}-\d\d$/.test(w.date ?? "")) e.push(`date "${w.date}" must be YYYY-MM`);
  if (!str(w.reckoning?.date) || !str(w.reckoning?.name) || !str(w.reckoning?.meaning)) e.push("reckoning needs date, name and meaning");
  if (!str(w.office?.title) || !str(w.office?.holder)) e.push("office needs title and holder");
  const ow = (w.office?.oath ?? "").split(/\s+/).filter(Boolean).length;
  if (ow < 20 || ow > 80 || !str(w.office?.oathSource)) e.push(`office.oath needs 20 to 80 words (${ow}) and an oathSource`);
  if (iid.size !== I.length || hid.size !== H.length) e.push("ids repeat among ideologies or holders");
  for (const id of hid) if (iid.has(id)) e.push(`holder id ${id} is also an ideology id`);
  const tag = (t, where) => { if (!TAGS[t]) e.push(`${where}: tradition tag "${t}" is not in the catalogue`); };
  for (const x of I) {
    if (!/^[a-z]{3}$/.test(x.id ?? "")) e.push(`ideology id "${x.id}" must be 3 lowercase letters`);
    for (const k of ["name", "stands", "base", "culture", "symbols", "roots", "mood", "ruler", "sound"]) if (!str(x[k])) e.push(`ideology ${x.id}: missing ${k}`);
    if (!Array.isArray(x.emblems) || !x.emblems.length || x.emblems.length > 3) e.push(`ideology ${x.id}: emblems must list 1 to 3 kinds`);
    for (const k of x.emblems ?? []) if (k !== "none" && !EMBLEMS.includes(k)) e.push(`ideology ${x.id}: emblem "${k}" is not in the emblem list`);
    (x.traditions ?? []).forEach((t) => tag(t, `ideology ${x.id}`));
    (x.adoptions ?? []).forEach((a) => { tag(a.tag, `ideology ${x.id} adoption`); if (!str(a.note)) e.push(`ideology ${x.id}: adoption ${a.tag} needs a note`); });
  }
  if (!Array.isArray(w.traditions) || w.traditions.length < 2 || w.traditions.length > 8) e.push("traditions must list 2 to 8 tags");
  (w.traditions ?? []).forEach((t) => tag(t, "traditions"));
  (w.adoptions ?? []).forEach((a) => { tag(a.tag, "adoptions"); if (!str(a.note)) e.push(`adoption ${a.tag} needs a note`); });
  const c = w.compass ?? [];
  if (c.length !== I.length || new Set(c).size !== c.length || c.some((id) => !iid.has(id))) e.push(`compass must list every ideology id once: [${[...iid]}]`);
  const mix = (m, where, lo, hi) => {
    if (!Array.isArray(m) || m.length < lo || m.length > hi) return e.push(`${where}: mix must be ${lo} to ${hi} [ideologyId, weight] pairs`);
    for (const p of m) if (!Array.isArray(p) || !iid.has(p[0]) || !num(p[1], 0.01, 1)) e.push(`${where}: bad mix pair ${JSON.stringify(p)}`);
    const s = m.reduce((a, p) => a + (+p?.[1] || 0), 0); if (Math.abs(s - 1) > 0.011) e.push(`${where}: mix weights sum to ${s.toFixed(2)}, not 1`);
  };
  mix(w.marker, "marker", 1, 5);
  if (!num(w.grip, 0, 100)) e.push("grip must be 0 to 100");
  for (const x of H) {
    const pat = P.includes(x), where = `${pat ? "patron" : "faction"} ${x.id}`;
    if (!/^[a-z]{2,4}$/.test(x.id ?? "")) e.push(`${where}: id must be 2 to 4 lowercase letters`);
    if (!str(x.short) || x.short.length > 22) e.push(`${where}: short must be a display name of at most 22 characters`);
    for (const k of ["name", "who", "persona", "fall", "insignia"]) if (!str(x[k])) e.push(`${where}: missing ${k}`);
    if (!str(x.leader?.name)) e.push(`${where}: leader needs a name`);
    mix(x.mix, where, pat ? 1 : 2, 3);
    if (!num(x.support, 0, 100)) e.push(`${where}: support must be 0 to 100`);
    if (!pat && !(Number.isInteger(x.power) && x.power >= 1 && x.power <= 3)) e.push(`${where}: power must be 1, 2 or 3`);
    if (pat && !num(x.grip, 0, 100)) e.push(`${where}: preferred grip must be 0 to 100`);
    if (!ROLES.includes(x.produces)) e.push(`${where}: produces must be one of ${ROLES}`);
    if (!str(x.act?.text)) e.push(`${where}: act needs text`);
    for (const [k, v] of Object.entries(x.act?.res ?? {})) if (!ROLES.includes(k) || !num(v, -3, -1)) e.push(`${where}: act.res ${k}: ${v}; roles only, -1 to -3`);
    for (const [k, v] of Object.entries(x.act?.sup ?? {})) if (!hid.has(k) || k === x.id || !num(v, -5, 5)) e.push(`${where}: act.sup ${k}: ${v}; another holder, -5 to 5`);
    if (!str(x.fates?.hi) || !str(x.fates?.lo)) e.push(`${where}: fates needs hi and lo`);
  }
  const s = F.map((x) => x.support).filter((v) => num(v));
  if (s.length === F.length && F.length) {
    if (Math.max(...s) - Math.min(...s) < 25) e.push(`faction support spans ${Math.max(...s) - Math.min(...s)}; spread it to at least 25`);
    if (s.some((v) => v < 20 || v > 80)) e.push("faction support must stay 20 to 80 on the start date");
    const n = {}; s.forEach((v) => (n[v] = (n[v] ?? 0) + 1)); if (Object.values(n).some((k) => k > 2)) e.push("more than 2 factions share one support value");
  }
  for (const r of ROLES) {
    const x = w.resources?.[r];
    if (!x || !str(x.name) || !ICONS.includes(x.icon)) { e.push(`resources.${r} needs a name and an icon from [${ICONS}]`); continue; }
    if (r === "money") { if (!str(x.unit) || !num(x.value, 5, 40)) e.push("resources.money needs a unit and a start value 5 to 40"); }
    else if (!Number.isInteger(x.value) || x.value < 2 || x.value > 6) e.push(`resources.${r}: start value must be a whole number 2 to 6`);
  }
  if (!num(w.balance, -5, 5)) e.push("balance must be -5 to 5 money units a month");
  const T = w.timeline ?? [];
  if (T.length < 12 || T.length > 20) e.push(`timeline has ${T.length} events; need 12 to 20`);
  T.forEach((t, i) => { if (!str(t.date) || !str(t.event)) e.push(`timeline ${i}: needs date and event`); (t.holders ?? []).forEach((h) => !hid.has(h) && e.push(`timeline ${i}: unknown holder ${h}`)); });
  const pe = w.people ?? [];
  if (pe.length < 8 || pe.length > 20) e.push(`people lists ${pe.length}; need 8 to 20`);
  pe.forEach((p) => { if (!str(p.name) || !str(p.role)) e.push(`people: ${p.name} needs name and role`); if (p.holder != null && !hid.has(p.holder)) e.push(`people: ${p.name} has unknown holder ${p.holder}`); });
  e.push(...checkSeeds(w));
  if (!str(w.era_brief)) e.push("missing era_brief");
  const m = w.music ?? {};
  for (const k of ["tradition", "ceremony", "street"]) if (!str(m[k])) e.push(`music.${k} missing`);
  for (const id of iid) if (!str(m.ideologies?.[id])) e.push(`music.ideologies.${id} missing`);
  if (w.facts == null) e.push("missing top-level field facts"); else e.push(...checkFacts(w.facts));
  return e;
}

// the seeds to build now: distinct, arcs that escalate in order, every month covered twice, corners within 1 of an equal share
export function checkSeeds(w) {
  const e = [], iid = new Set((w.ideologies ?? []).map((x) => x.id));
  if (!Array.isArray(w.seeds)) return ["seeds must be a list (a JSON array)"];
  const Sd = w.seeds ?? [], M = w.months;
  if (Sd.length < 28 || Sd.length > 36) e.push(`seeds: ${Sd.length}; need 28 to 36`);
  if (new Set(Sd.map((x) => x.id)).size !== Sd.length) e.push("seed ids repeat");
  const arcs = {};
  for (const x of Sd) {
    if (!/^s\d{2}$/.test(x.id ?? "")) e.push(`seed ${x.id}: id must be s01, s02...`);
    if (!Array.isArray(x.months) || !(x.months[0] >= 1 && x.months[1] >= x.months[0] && x.months[1] <= M && x.months[1] - x.months[0] <= 3)) e.push(`seed ${x.id}: months must be [first, last] inside 1..${M}, at most 4 wide`);
    if (!iid.has(x.corner)) e.push(`seed ${x.id}: corner "${x.corner}" is not an ideology id`);
    if (!str(x.line)) e.push(`seed ${x.id}: missing line`);
    if (x.arc) (arcs[x.arc.id] ??= []).push(x);
  }
  for (const [id, xs] of Object.entries(arcs)) {
    const parts = xs.map((x) => x.arc.part).sort();
    if (xs.length < 2 || xs.length > 3 || parts.some((p, i) => p !== i + 1)) e.push(`arc ${id}: needs parts 1 to 2 or 1 to 3, has [${parts}]`);
    const byPart = [...xs].sort((a, b) => a.arc.part - b.arc.part);
    if (byPart.some((x, i) => i && x.months?.[0] <= byPart[i - 1].months?.[0])) e.push(`arc ${id}: each part must start in a later month than the part before`);
  }
  if (Sd.length) for (let m = 1; m <= M; m++) { const n = Sd.filter((x) => x.months?.[0] <= m && m <= x.months?.[1]).length; if (n < 2) e.push(`month ${m} is covered by ${n} seeds; need at least 2`); }
  const eq = Sd.length / (iid.size || 1), lean = {}; Sd.forEach((x) => (lean[x.corner] = (lean[x.corner] ?? 0) + 1));
  const skew = [...iid].filter((i) => Math.abs((lean[i] ?? 0) - eq) > 1);
  if (skew.length) e.push(`seed corners ${JSON.stringify(lean)}; each must be within 1 of ${eq.toFixed(1)}: move seeds of ${skew.join(", ")}`);
  return e;
}

export function checkFacts(f) {
  const e = [];
  if (!Array.isArray(f?.numbers) || f.numbers.length < 4 || f.numbers.length > 10) e.push("facts.numbers must list 4 to 10 figures");
  for (const x of f?.numbers ?? []) if (!str(x.name) || !str(x.key) || !num(x.value) || !str(x.unit) || !str(x.change)) e.push(`facts.numbers ${x.name}: needs name, key, value (a number), unit and change`);
  for (const p of f?.people ?? []) if (!str(p.name) || !str(p.role) || !str(p.from)) e.push(`facts.people ${p.name}: needs name, role and from`);
  for (const x of f?.documents ?? []) if (!str(x.name) || !str(x.date) || !str(x.content)) e.push(`facts.documents ${x.name}: needs name, date and content`);
  return e;
}

// The exact brief shape the skin prompt reads (docs/mocks/patterns/final/briefs/*.json).
export function skinBrief(w) {
  const pick = (o, ks) => Object.fromEntries(ks.filter((k) => o[k] != null).map((k) => [k, o[k]]));
  return {
    id: w.id, title: w.title, era_brief: w.era_brief, traditions: w.traditions, adoptions: w.adoptions,
    ideologies: w.ideologies.map((x) => pick(x, ["id", "name", "stands", "base", "symbols", "roots", "mood", "emblems", "traditions", "adoptions"])),
    factions: w.factions.map((x) => pick(x, ["id", "name", "who", "mix", "insignia"])),
    patrons: w.patrons.map((x) => pick(x, ["id", "name", "who", "insignia"])),
  };
}

// ---------- music ----------
export function checkMusic(b, w) {
  const e = [];
  for (const k of ["title", "bpm", "bars", "tonic", "scale", "chords", "theme", "solo", "sighs", "form", "ensemble", "rhythm", "ideologies"]) if (b[k] == null) e.push(`missing field ${k}`);
  if (e.length) return e;
  if (!num(b.bpm, 60, 160)) e.push("bpm must be 60 to 160");
  if (!Number.isInteger(b.bars) || b.bars < 16 || b.bars > 32) e.push("bars must be a whole number 16 to 32");
  if (!num(b.tonic, 45, 55)) e.push("tonic must be MIDI 45 to 55");
  const sc = b.scale;
  if (!Array.isArray(sc) || sc.length < 5 || sc.length > 8 || sc[0] !== 0 || sc.some((v, i) => !num(v, 0, 11.5) || (i && v <= sc[i - 1]))) e.push("scale must be 5 to 8 ascending semitone steps from 0, below 12");
  for (const k of ["climb", "solo"]) { const f = b.form?.[k]; if (!Array.isArray(f) || !(f[0] >= 1 && f[1] >= f[0] && f[1] <= b.bars)) e.push(`form.${k} must be [from, to] inside 1..${b.bars}`); }
  // sound names the arranger reads: every one must be a string from the palette or the hit list
  const known = (x) => str(x) && (SAMPLES[x] || x.startsWith("syn_"));
  const snd = (x, where, opt) => { if (x == null && opt) return; if (typeof x !== "string") e.push(`${where} must be a sound name (a string), got ${JSON.stringify(x)}`); else if (!known(x) && !known(PALETTE[x]?.sample ?? "")) e.push(`${where}: "${x}" is not in the palette or the hit list`); };
  const snds = (x, where, n) => { if (!Array.isArray(x) || x.length < 1 || x.length > n) e.push(`${where} must be a list of 1 to ${n} sound names, got ${JSON.stringify(x)}`); else x.forEach((y, i) => snd(y, `${where}[${i}]`)); };
  const E = b.ensemble;
  if (typeof E.lead !== "object") e.push("ensemble.lead must be {sound, oct}"); else snd(E.lead.sound, "ensemble.lead.sound");
  for (const k of ["section", "bass", "pulse", "soloist", "arp"]) snd(E[k], `ensemble.${k}`);
  snd(E.cymbal, "ensemble.cymbal", true);
  snds(E.bed, "ensemble.bed", 2); snds(E.brass, "ensemble.brass", 2);
  if (!str(E.figure)) e.push("ensemble.figure must be a one-bar pattern string");
  for (const k of ["village", "city", "fills", "shaker", "strict", "tension", "crisis"]) if (!str(b.rhythm[k]?.hit)) e.push(`rhythm.${k}.hit missing`);
  for (const k of ["village", "fills", "shaker"]) snd(b.rhythm[k]?.sound, `rhythm.${k}.sound`);
  for (const k of ["city", "strict", "tension", "crisis"]) snd(b.rhythm[k]?.sound, `rhythm.${k}.sound`, true);
  if (!str(b.rhythm.crisis?.accents)) e.push("rhythm.crisis.accents missing");
  const T = b.moods?.tension ?? {}, C = b.moods?.crisis ?? {};
  for (const k of ["tune", "ostinato", "tremolo", "cry", "heartbeat", "roll"]) snd(T[k], `moods.tension.${k}`, true);
  for (const k of ["tune", "drive", "stab"]) if (C[k] != null) snds(C[k], `moods.crisis.${k}`, 2);
  for (const k of ["low", "timp"]) snd(C[k], `moods.crisis.${k}`, true);
  (b.fills ?? []).forEach((f, i) => snd(f?.sound, `fills[${i}].sound`));
  const want = (w.ideologies ?? []).map((x) => x.id), got = Object.keys(b.ideologies);
  if (want.sort().join() !== [...got].sort().join()) e.push(`ideologies must be keyed exactly by [${want}], got [${got}]`);
  for (const [id, x] of Object.entries(b.ideologies)) {
    if (!x.tune?.length && !x.colour?.length) e.push(`${id}: needs a tune or a colour`);
    if ((x.tune ?? []).length > 3) e.push(`${id}: at most 3 tune players`);
    (x.tune ?? []).forEach((t, i) => snd(t?.sound, `${id}.tune[${i}].sound`));
    for (const c of x.colour ?? []) { if (!["pulse", "drums", "drone", "calls"].includes(c.type)) e.push(`${id}: colour type "${c.type}" is not pulse, drums, drone or calls`); snd(c.sound, `${id}.colour ${c.type} sound`, c.type === "drums"); }
    for (const [k, v] of Object.entries(x.thins ?? {})) {
      if (!["lead", "ornaments", "drums"].includes(k) || !num(v, 0, 1)) e.push(`${id}: thins.${k} must be lead, ornaments or drums, 0 to 1`);
      if (k === "lead" && v > 0.3) e.push(`${id}: thins.lead ${v} strips the tune; at most 0.3`);
    }
  }
  try {
    const score = arrange(structuredClone(b));
    for (const r of hallValidate(score, SAMPLES)) if (r.startsWith("error")) e.push(r);
  } catch (x) { e.push(`arranger failed: ${x.message}`); }
  try { e.push(...lintBrief(b).map((x) => `melody lint: ${x}`)); } catch (x) { e.push(`melody lint failed: ${x.message}`); }
  return e;
}

// ---------- deck ----------
const SIZE = ["s", "m", "l"], FAM = ["talk", "address", "power", "law", "grip", "patron", "answers"];
const ONE = {
  move: { target: "T", dir: ["+", "-"], size: SIZE }, grip: { dir: ["open", "iron"], size: SIZE },
  gain: { kind: "K", n: [1, 5] }, spend: { kind: "K", n: [1, 5] }, file: { ideology: "I", n: [1, 2] },
  boostNext: { ideology: "I*", steps: [1, 2] }, hold: { target: "H", bound: ["floor", "ceiling"], level: [0, 100], months: [1, 6] },
  setFlag: { flag: "S" }, queueNext: { tag: "C" }, cancelIntent: { holder: "H" },
};
const MOD = {
  cost: { family: FAM, kind: "K", delta: [-2, 2] }, sizeUp: { ideology: "I" }, drift: { target: "T", multiplier: [0, 2] },
  gripRate: { multiplier: [0.5, 2] }, extraPlay: { everyNMonths: [2, 99] }, income: { kind: "K", n: [1, 2], when: "W?" },
  exchange: { from: "K", to: "K", rate: [0.01, 1] }, trigger: { when: "W", effects: "ONE" },
};

// opts (one part of a split deck): only = the sections it writes, situations/callbacks = [lo, hi], window = [first, last] month, quota = exact answers per corner
export function checkDeck(d, w, opts = {}) {
  for (const k of ["situations", "history", "callbacks", "elections", "visions", "combos", "centreLaws"]) if (d[k] != null && !Array.isArray(d[k])) return [`${k} must be a list (a JSON array), not ${typeof d[k]}`];
  const has = (k) => !opts.only || opts.only.includes(k);
  const e = [], I = w.ideologies.map((x) => x.id), H = [...w.factions, ...w.patrons].map((x) => x.id), PAT = w.patrons.map((x) => x.id);
  const ids = new Map(), setFlags = new Set(), needFlags = [], queued = [];
  const reg = (id, src, where) => { if (!str(id)) return e.push(`${where}: missing id`); if (ids.has(id)) e.push(`id ${id} is used twice`); ids.set(id, src); };
  const target = (t) => H.includes(t) || ["factions", "patrons", "lowest"].includes(t) || (typeof t === "string" && t.startsWith("lean:") && I.includes(t.slice(5)));
  const cond = (c, where) => {
    if (!c || typeof c !== "object") return e.push(`${where}: condition missing`);
    const ok = { support: () => target(c.target) && (num(c.above, 0, 100) || num(c.below, 0, 100)), grip: () => ["iron", "middle", "open"].includes(c.band),
      stack: () => I.includes(c.ideology) && num(c.min, 1, 20), zone: () => I.includes(c.zone) || c.zone === "centre", monthEnd: () => true }[c.if];
    if (!ok || !ok()) e.push(`${where}: bad condition ${JSON.stringify(c)}`);
  };
  const arg = (type, v, where, k) => {
    const bad = () => e.push(`${where}: ${k} ${JSON.stringify(v)} is not valid`);
    if (Array.isArray(type)) { if (typeof type[0] === "number" ? !num(v, type[0], type[1]) : !type.includes(v)) bad(); }
    else if (type === "T") { if (!target(v)) bad(); } else if (type === "H") { if (!H.includes(v)) bad(); }
    else if (type === "K") { if (!ROLES.includes(v)) bad(); } else if (type === "I") { if (!I.includes(v)) bad(); }
    else if (type === "I*") { if (v !== "any" && !I.includes(v)) bad(); } else if (type === "S") { if (!str(v)) bad(); else setFlags.add(v); }
    else if (type === "C") { if (!str(v)) bad(); else queued.push([v, where]); }
    else if (type === "W") cond(v, where); else if (type === "W?") { if (v != null) cond(v, where); }
    else if (type === "ONE") { if (!Array.isArray(v) || !v.length) bad(); else compile(v, where, false); }
  };
  function compile(list, where, mods) {
    if (list == null) return;
    if (!Array.isArray(list)) return e.push(`${where}: effects must be a list`);
    for (const p of list) {
      const spec = ONE[p?.op] ?? (mods ? MOD[p?.op] : null), at = `${where} ${p?.op}`;
      if (!spec) { e.push(`${where}: "${p?.op}" is not a ${mods ? "" : "one-shot "}primitive here`); continue; }
      for (const k of Object.keys(p)) if (k !== "op" && !(k in spec)) e.push(`${at}: unknown field ${k}`);
      for (const [k, t] of Object.entries(spec)) if (p[k] !== undefined || !String(t).endsWith("?")) arg(t, p[k], at, k);
      if (p.op === "trigger" && Array.isArray(p.effects)) for (const f of p.effects) {
        const c = p.when ?? {};
        const self = (c.if === "support" && f.op === "move" && (f.target === c.target || f.target === "factions" || f.target === "lowest") && ((c.above != null && f.dir === "+") || (c.below != null && f.dir === "-")))
          || (c.if === "grip" && f.op === "grip" && ((c.band === "iron" && f.dir === "iron") || (c.band === "open" && f.dir === "open")))
          || (c.if === "stack" && f.op === "file" && f.ideology === c.ideology);
        if (self) e.push(`${at}: this trigger can fire itself (its ${f.op} makes its own condition truer)`);
      }
    }
  }
  const total = (o) => Object.values(o ?? {}).reduce((a, v) => a + (+v || 0), 0);
  const hand = (c, where, src, lo, hi, mods) => {
    if (!c) return e.push(`${where}: missing`);
    reg(c.id, src, where); if (!str(c.title) || !str(c.flavour)) e.push(`${c.id}: needs title and flavour`);
    for (const [k, v] of Object.entries(c.cost ?? {})) if (!ROLES.includes(k) || !num(v, 1, 5)) e.push(`${c.id}: cost ${k} ${v} not valid`);
    const cost = total(c.cost); if (cost < lo || cost > hi) e.push(`${c.id}: costs ${cost} in all; need ${lo} to ${hi}`);
    compile(c.effects, c.id, mods);
    if (!c.effects?.length) e.push(`${c.id}: no effects`);
    const gain = (c.effects ?? []).filter((p) => p.op === "gain").reduce((a, p) => a + (+p.n || 0), 0), spend = (c.effects ?? []).filter((p) => p.op === "spend").reduce((a, p) => a + (+p.n || 0), 0);
    if (gain > cost + spend) e.push(`${c.id}: returns ${gain} resources for a cost of ${cost + spend}; no play returns more than it costs`);
  };
  const mod = (c, where, src) => {
    if (!c) return e.push(`${where}: missing`);
    reg(c.id, src, where); if (!str(c.title) || !str(c.flavour)) e.push(`${c.id}: needs title and flavour`);
    if (!c.effects?.length) e.push(`${c.id}: no effects`);
    for (const p of c.effects ?? []) if (!MOD[p?.op]) e.push(`${c.id}: modifiers take modifier primitives only, not "${p?.op}"`);
    compile(c.effects, c.id, true);
  };
  const count = (arr, lo, hi, what) => { if (!Array.isArray(arr) || arr.length < lo || arr.length > hi) e.push(`${what}: ${arr?.length ?? 0}; need ${lo === hi ? lo : `${lo} to ${hi}`}`); return Array.isArray(arr) ? arr : []; };
  if (has("ideologies")) for (const id of I) {
    const x = d.ideologies?.[id];
    if (!x) { e.push(`ideologies.${id} missing`); continue; }
    hand(x.power, `ideologies.${id}.power`, id, 2, 3, false); hand(x.law, `ideologies.${id}.law`, id, 3, 5, true);
    count(x.picks, 3, 3, `ideologies.${id}.picks`).forEach((m, k) => mod(m, `ideologies.${id}.picks[${k}]`, id));
  }
  for (const k of Object.keys(d.ideologies ?? {})) if (!I.includes(k)) e.push(`ideologies.${k} is not a world ideology`);
  if (has("centreLaws")) count(d.centreLaws, 2, 2, "centreLaws").forEach((c, k) => hand(c, `centreLaws[${k}]`, "centre", 3, 5, true));
  if (has("picks")) for (const s of ["iron", "open", "centre"]) count(d.picks?.[s], 3, 3, `picks.${s}`).forEach((m, k) => mod(m, `picks.${s}[${k}]`, s));
  if (has("gripCards")) for (const s of ["iron", "open"]) count(d.gripCards?.[s], 2, 2, `gripCards.${s}`).forEach((c, k) => hand(c, `gripCards.${s}[${k}]`, s, 1, 3, false));
  if (has("patronCards")) for (const p of PAT) hand(d.patronCards?.[p], `patronCards.${p}`, p, 1, 3, false);

  // cards with answers
  const tally = Object.fromEntries(I.map((i) => [i, 0])), M = w.months;
  let carried = 0, real = 0;
  const card = (c, where, kind) => {
    if (!c) return e.push(`${where}: missing`);
    reg(c.id, kind, where); const at = c.id ?? where;
    for (const k of ["title", "question", "body"]) if (!str(c[k])) e.push(`${at}: missing ${k}`);
    if (!Array.isArray(c.months) || !(c.months[0] >= 1 && c.months[1] >= c.months[0] && c.months[1] <= M)) e.push(`${at}: months must be [first, last] inside 1..${M}`);
    if (c.band != null && !["iron", "open"].includes(c.band)) e.push(`${at}: band must be iron or open`);
    if (c.zone != null && c.zone !== "centre" && !I.includes(c.zone)) e.push(`${at}: zone ${c.zone} not valid`);
    for (const f of [...(c.requires ?? []), ...(c.blocks ?? [])]) needFlags.push([f, at]);
    if (!str(c.carrier?.name) || !str(c.carrier?.role) || typeof c.carrier?.real !== "boolean") e.push(`${at}: carrier needs name, role and real`);
    carried++; if (c.carrier?.real) real++;
    const A = c.answers ?? [];
    if (A.length < 2 || A.length > 3) e.push(`${at}: ${A.length} answers; need 2 or 3`);
    A.forEach((a, k) => {
      const aw = `${at} answer ${k + 1}`;
      if (!str(a.text) || !str(a.sub)) e.push(`${aw}: needs text and sub`);
      if (!I.includes(a.ideology)) e.push(`${aw}: ideology "${a.ideology}" not valid`);
      else if (kind !== "intent" && kind !== "election") tally[a.ideology]++;
      for (const [r, v] of Object.entries(a.res ?? {})) if (!ROLES.includes(r) || !num(v, -2, 2)) e.push(`${aw}: res ${r} ${v}; roles only, -2 to 2`);
      const mv = Object.entries(a.moves ?? {});
      if (mv.length < 4 || mv.length > 6) e.push(`${aw}: moves ${mv.length} holders; need 4 to 6`);
      for (const [h, v] of mv) {
        if (!H.includes(h)) e.push(`${aw}: unknown holder ${h}`);
        if (!/^[+-][sml]$/.test(v)) e.push(`${aw}: move ${h} "${v}" must be +s, +m, +l, -s, -m or -l`);
        if (!str(a.reasons?.[h])) e.push(`${aw}: move of ${h} has no reason`);
      }
      for (const h of Object.keys(a.reasons ?? {})) if (!(h in (a.moves ?? {}))) e.push(`${aw}: reason for ${h}, who does not move`);
      if (!mv.some(([, v]) => v?.[0] === "+") || !mv.some(([, v]) => v?.[0] === "-")) e.push(`${aw}: moves must go both ways (someone up, someone down)`);
      if (a.grip != null) { if (!/^[+-][sml]$/.test(a.grip)) e.push(`${aw}: grip "${a.grip}" not valid`); if (!str(a.gripWhy)) e.push(`${aw}: grip change has no gripWhy`); }
      compile(a.effects, aw, false);
      (a.flags ?? []).forEach((f) => (str(f) ? setFlags.add(f) : e.push(`${aw}: bad flag`)));
    });
    if (kind === "history") {
      if (!str(c.date) || !str(c.history)) e.push(`${at}: history cards need date and history`);
      if (!Number.isInteger(c.historyAnswer) || !A[c.historyAnswer]) e.push(`${at}: historyAnswer must index an answer`);
    }
    if (kind === "callback" && !c.requires?.length) e.push(`${at}: a callback must require a flag`);
    if (kind === "election" && !A.some((a) => a.holdsElection === true)) e.push(`${at}: one answer must hold the election (holdsElection: true)`);
  };
  if (has("situations")) count(d.situations, ...(opts.situations ?? [60, 80]), "situations").forEach((c, k) => {
    card(c, `situations[${k}]`, "situation");
    const sd = opts.seeds?.find((x) => x.id === c?.id);
    if (opts.seeds && !sd) e.push(`${c?.id}: is not one of your seeds [${opts.seeds.map((x) => x.id)}]; use the seed's id`);
    if (sd && Array.isArray(c.months) && (c.months[0] < sd.months[0] || c.months[1] > sd.months[1])) e.push(`${c.id}: months ${JSON.stringify(c.months)} fall outside its seed's window [${sd.months}]`);
    if (opts.window && Array.isArray(c?.months) && (c.months[0] < opts.window[0] || c.months[1] > opts.window[1])) e.push(`${c.id}: months ${JSON.stringify(c.months)} fall outside your window [${opts.window}]`);
  });
  if (opts.seeds) for (const x of opts.seeds) if (!(d.situations ?? []).some((c) => c?.id === x.id)) e.push(`seed ${x.id} has no situation`);
  if (has("history")) count(d.history, 10, 15, "history").forEach((c, k) => card(c, `history[${k}]`, "history"));
  if (has("callbacks")) count(d.callbacks, ...(opts.callbacks ?? [10, 15]), "callbacks").forEach((c, k) => card(c, `callbacks[${k}]`, "callback"));
  if (has("elections")) count(d.elections, 2, 3, "elections").forEach((c, k) => card(c, `elections[${k}]`, "election"));
  if (has("intents")) for (const h of H) { const c = d.intents?.[h]; card(c, `intents.${h}`, "intent"); if (c && c.holder !== h) e.push(`intents.${h}: holder must be ${h}`); }
  for (const [f, at] of needFlags) if (!setFlags.has(f)) e.push(`${at}: requires or blocks flag "${f}", which no answer sets`);
  for (const [id, at] of queued) if (!ids.has(id)) e.push(`${at}: queueNext card "${id}" does not exist`);
  const n = Object.values(tally).reduce((a, b) => a + b, 0), share = n / I.length;
  if (opts.quota) {
    const miss = I.filter((i) => tally[i] !== opts.quota[i]);
    if (miss.length) e.push(`answer quota per corner is ${JSON.stringify(opts.quota)}; you have ${JSON.stringify(tally)}: retag or rewrite answers of ${miss.join(", ")} until each count matches exactly`);
  }
  const off = opts.quota ? [] : I.filter((i) => Math.abs(tally[i] - share) > 1);
  if (off.length) e.push(`ideology tally of answers (situations, history, callbacks) is ${JSON.stringify(tally)}; each must be within 1 of ${share.toFixed(1)}: retag or rewrite answers of ${off.join(", ")}`);
  if (real > carried * 0.1) e.push(`${real} of ${carried} cards have a real carrier; at most ${Math.floor(carried * 0.1)}`);
  e.push(...Object.values(style(d, w)).flat());

  // visions and combos
  const laws = [...ids].filter(([id]) => id.startsWith("l-")).map(([id]) => id);
  const corners = new Set();
  if (has("visions")) count(d.visions, 4, 6, "visions").forEach((v, k) => {
    const at = v.id ?? `visions[${k}]`; reg(v.id, "vision", at);
    if (!str(v.name) || !str(v.line)) e.push(`${at}: needs name and line`);
    if (v.corner !== "centre" && !I.includes(v.corner)) e.push(`${at}: corner must be an ideology id or centre`); else corners.add(v.corner);
    count(v.pillars, 3, 4, `${at} pillars`).forEach((p, j) => {
      const pw = `${at} pillar ${j + 1}`, ok = {
        stack: () => I.includes(p.ideology) && num(p.min, 2, 8), zone: () => p.zone === "centre" || I.includes(p.zone),
        grip: () => num(p.min, 0, 100) || num(p.max, 0, 100), law: () => laws.includes(p.id), sup: () => H.includes(p.holder) && num(p.min, 30, 90),
        res: () => ROLES.includes(p.role) && num(p.min, -50, p.role === "money" ? 100 : 10),
      }[p.kind];
      if (!ok || !ok()) e.push(`${pw}: ${JSON.stringify(p)} is not checkable or not reachable`);
      if (!str(p.text)) e.push(`${pw}: needs text`);
    });
  });
  if (has("visions")) for (const c of [...I, "centre"]) if (!corners.has(c)) e.push(`no Vision covers ${c}`);
  if (has("combos")) count(d.combos, 2, 3, "combos").forEach((c, k) => {
    const at = `combos[${k}]`, src = (c.parts ?? []).map((p) => ids.get(p));
    if (!str(c.name) || !str(c.why)) e.push(`${at}: needs name and why`);
    if (c.parts?.length !== 2 || src.some((s) => !s)) e.push(`${at}: parts must be 2 existing card or modifier ids`);
    else if (src[0] === src[1]) e.push(`${at}: parts come from the same ideology or set (${src[0]})`);
  });
  return e;
}

// ---------- style: the ruler's voice, word limits, no free answer, listed real people, floors said aloud ----------
// limits = the 90th percentile per field over the 12 eval decks (2026-10-14); body = the 99th, to keep colour
export const LIMITS = { title: 5, question: 14, body: 50, text: 9, sub: 11, reason: 11, gripWhy: 11, history: 29, flavour: 14, line: 18 };
const wc = (s) => (typeof s === "string" ? s.trim().split(/\s+/).filter(Boolean).length : 0);
export function style(d, w) {
  const r = { voice: [], words: [], free: [], real: [], floor: [] };
  const long = (at, k, s) => { const n = wc(s); if (n > LIMITS[k]) r.words.push(`${at} ${k}: ${n} words; at most ${LIMITS[k]}`); };
  const cards = [...(d.situations ?? []), ...(d.history ?? []), ...(d.callbacks ?? []), ...(d.elections ?? []), ...Object.values(d.intents ?? {})].filter(Boolean);
  const hands = [...Object.values(d.ideologies ?? {}).flatMap((x) => [x?.power, x?.law, ...(x?.picks ?? [])]), ...(d.centreLaws ?? []), ...Object.values(d.picks ?? {}).flat(), ...Object.values(d.gripCards ?? {}).flat(), ...Object.values(d.patronCards ?? {})].filter(Boolean);
  const known = (w.facts?.people?.length ? w.facts.people : w.people ?? []).map((p) => p.name.toLowerCase());
  const floors = (w.facts?.numbers ?? []).filter((x) => num(x.floor) && str(x.key));
  for (const c of cards) {
    const at = c.id, q = c.question ?? "", who = c.carrier?.name?.toLowerCase() ?? "";
    if (!/\byour?s?\b/i.test(q) || /\b(we|our|the council)\b/i.test(q) || /\bus\b/.test(q)) r.voice.push(`${at} question: ask what YOU will do, with "you" or "your"; never "we", "our", "us" or "the Council"`);
    for (const k of ["title", "question", "body", "history"]) long(at, k, c[k]);
    if (c.carrier?.real && !known.some((n) => n.includes(who) || who.includes(n))) r.real.push(`${at}: real carrier ${c.carrier.name} is not in facts.people; invent a minor carrier and set real false`);
    (c.answers ?? []).forEach((a, k) => {
      const aw = `${at} answer ${k + 1}`;
      if (!Object.values(a.moves ?? {}).some((v) => /^-[ml]$/.test(v)) && !Object.values(a.res ?? {}).some((v) => v < 0) && !(a.effects ?? []).some((p) => p?.op === "spend"))
        r.free.push(`${aw}: costs no one; move a holder down by -m or -l, or cost a resource`);
      for (const k of ["text", "sub", "gripWhy"]) long(aw, k, a[k]);
      for (const [h, v] of Object.entries(a.reasons ?? {})) long(`${aw} ${h}`, "reason", v);
    });
    // ponytail: the first level within 25 characters after the key, per sentence; skips rates and percents, misses "fell by 3 to 179"
    for (const s of [c.question, c.body, ...(c.answers ?? []).flatMap((a) => [a.text, a.sub])].join(". ").split(/(?<!\d)[.;!?](?!\d)/)) for (const x of floors) {
      const m = new RegExp(String.raw`${x.key}\D{0,25}?(?<!\bby )(\d[\d,]*(?:\.\d+)?)(?![\d,.])(?!\s*(?:%|percent|\w+\s+(?:a|per|each|every)\b))`, "i").exec(s);
      if (m && +m[1].replace(/,/g, "") < x.floor && !/below|under|breach/i.test(s)) r.floor.push(`${at}: ${x.key} at ${m[1]} is below its floor of ${x.floor} ${x.unit}; say "below the floor" in that sentence or keep it at or above`);
    }
  }
  for (const h of hands) long(h.id, "flavour", h.flavour);
  for (const v of d.visions ?? []) long(v.id, "line", v.line);
  return r;
}

// ---------- repeats: near-duplicate situations outside a declared arc (word overlap; calibrated on a deck with known copies) ----------
const STOP = new Set("that this with from they their will your have what them into more than over were been also only would which when while there these those after before under about just very must every other some such could should".split(" "));
const words = (t) => new Set(t.toLowerCase().replace(/[^a-z\u00c0-\u024f ]/g, " ").split(/\s+/).filter((x) => x.length >= 4 && !STOP.has(x)).map((x) => x.slice(0, 6)));
const jac = (a, b) => { let n = 0; for (const x of a) if (b.has(x)) n++; return n / (a.size + b.size - n || 1); };
export function repeats(d, w) {
  const S = d.situations ?? [], arc = Object.fromEntries((w.seeds ?? []).filter((x) => x.arc).map((x) => [x.id, x.arc.id]));
  const q = S.map((c) => words([c.title, (c.question ?? "").replace(/^(?:[A-Z][\w'.-]*\s?){1,4},\s*/, ""), c.body].join(" "))), a = S.map((c) => words((c.answers ?? []).map((x) => `${x.text} ${x.sub}`).join(" ")));
  const hits = [];
  for (let i = 0; i < S.length; i++) for (let j = i + 1; j < S.length; j++) {
    if (arc[S[i].id] && arc[S[i].id] === arc[S[j].id]) continue;
    const jq = jac(q[i], q[j]), ja = jac(a[i], a[j]);
    if (jq >= 0.2 || jq + ja >= 0.36) hits.push(`${S[i].id} "${S[i].title}" ~ ${S[j].id} "${S[j].title}" (question ${jq.toFixed(2)}, answers ${ja.toFixed(2)})`);
  }
  return hits;
}

// ---------- repair patches ----------
// Objects merge by key; arrays of items with ids merge by id, item by item (a patch may carry only the changed fields); anything else is replaced.
export function merge(a, b) {
  if (a == null) return b;
  const withIds = (x) => Array.isArray(x) && x.length > 0 && x.every((o) => o && typeof o === "object" && "id" in o);
  if (withIds(a) && Array.isArray(b)) { const out = [...a]; for (const o of b) { const i = out.findIndex((x) => x.id === o?.id); i >= 0 ? (out[i] = merge(out[i], o)) : out.push(o); } return out; }
  if (a && b && typeof a === "object" && typeof b === "object" && !Array.isArray(a) && !Array.isArray(b)) { const out = { ...a }; for (const k in b) out[k] = merge(a[k], b[k]); return out; }
  return b;
}
export function drop(x, ids) {
  if (Array.isArray(x)) return x.filter((o) => !(o && typeof o === "object" && ids.has(o.id))).map((o) => drop(o, ids));
  if (x && typeof x === "object") return Object.fromEntries(Object.entries(x).map(([k, v]) => [k, drop(v, ids)]));
  return x;
}
