// The skin's semantic checks (round 6) and the brief context, ported from docs/mocks/patterns/{validate.mjs, final/validate.mjs} without the file system.
// Out of scope here (lead ruling): the JSON schema and the pixel checks (seam, connected, comfort, presence, pHash); the render check stays.
// biome-ignore-all lint/suspicious/noExplicitAny: untrusted model JSON
import catalogue from "../client/src/patterns/catalogue.json";
import { EMBLEMS } from "../client/src/patterns/emblem.js";
import { render } from "../client/src/patterns/engine.js";
import FONTS from "../client/src/patterns/fonts.json";
import homes from "../client/src/patterns/homes.json";

const HOMES: Record<string, string[]> = homes.homes, TAGS: Record<string, string> = homes.tags;
const TIER: Record<string, string> = Object.fromEntries((catalogue as any[]).map((c) => [c.id, c.tier]));
const homeOf = (L: any) => HOMES[`${L.family}:${L.params?.motif}`] || HOMES[`${L.family}:*`] || [];
const motifId = (L: any) => (L.family === "girih" ? `girih:${L.params?.tiling || "4.8.8"}` : HOMES[`${L.family}:*`] ? `${L.family}:*` : `${L.family}:${L.params?.motif}`);
const tierOf = (L: any) => TIER[motifId(L)] || "support";
const heroes = (tags: Set<string>) => Object.keys(TIER).filter((id) => TIER[id] === "hero" && (HOMES[id] || HOMES[`${id.split(":")[0]}:*`] || []).some((t) => tags.has(t)));
const SLOT = /^(a|b|c|none)(\/[\d.]+)?$/;
const REQUIRED = ["palette", "fonts", "finish", "house", "ideologies", "factions", "patrons"];

// the world's tradition tags, native hero motifs and motif homes, for the skin call (was `node final/validate.mjs --context`)
export function skinContext(W: any) {
  const home = (id: string) => HOMES[id] || HOMES[`${id.split(":")[0]}:*`] || [];
  const motifs = Object.keys(HOMES).flatMap((k) => (k === "girih:*" ? Object.keys(TIER).filter((id) => id.startsWith("girih:")).concat("girih:4.4.4.4") : [k]));
  const at = (tags: string[]) => Object.fromEntries(motifs.filter((id) => home(id).some((t) => tags.includes(t))).map((id) => [id, TIER[id] || "support"]));
  const tags = [...new Set([...W.traditions, ...W.adoptions.map((a: any) => a.tag), ...W.ideologies.flatMap((i: any) => [...(i.traditions || []), ...(i.adoptions || []).map((a: any) => a.tag)])])];
  return {
    native_traditions: W.traditions,
    native_hero_motifs: heroes(new Set(W.traditions)),
    native_motifs: at(W.traditions),
    ideology_own_traditions: Object.fromEntries(W.ideologies.filter((i: any) => i.traditions?.length).map((i: any) => [i.id, { tags: i.traditions, motifs: at(i.traditions) }])),
    ideology_outsider_options: Object.fromEntries(W.ideologies.filter((i: any) => i.adoptions?.length).map((i: any) => [i.id, i.adoptions.map((a: any) => ({ ...a, motifs: at([a.tag]) }))])),
    world_adoptions_context_only: W.adoptions,
    tag_meanings: Object.fromEntries(tags.map((t) => [t, TAGS[t]])),
  };
}

// errors a model can fix; W is the skin brief (skinBrief(world))
export function checkSkin(skin: any, W: any): string[] {
  const missing = REQUIRED.filter((k) => skin?.[k] == null);
  if (missing.length) return [`missing top-level field(s) ${missing.join(", ")}`];
  const errors: string[] = [], seen = new Map<string, string>(), I: any[] = skin.ideologies || [];
  const ids = (a: any[]) => JSON.stringify((a || []).map((x) => x.id));
  for (const k of ["ideologies", "factions", "patrons"]) if (ids(skin[k]) !== ids(W[k])) errors.push(`${k} must be exactly [${W[k].map((x: any) => x.id).join(", ")}] in that order; got [${(skin[k] || []).map((x: any) => x.id).join(", ")}]`);
  const pair = (FONTS as any[]).find((p) => p.id === skin.fonts?.pair);
  if (pair && (pair.display !== skin.fonts.display || pair.body !== skin.fonts.body)) errors.push(`fonts: pair "${pair.id}" is ${pair.display} + ${pair.body}; copy those names exactly`);
  const native = new Set<string>(W.traditions || []), outsiders: [string, string[]][] = [];
  const house: string[] = skin.house?.families || [], ok = heroes(native);
  if (house.length < 1 || house.length > 2) errors.push(`house.families must name 1 or 2 families (got ${house.length}); native hero families here: ${[...new Set(ok.map((id) => id.split(":")[0]))].join(", ")}`);
  for (const fm of house) if (!ok.some((id) => id.startsWith(`${fm}:`))) errors.push(`house family "${fm}" has no hero motif native to this world [${[...native].join(", ")}]; native hero motifs: ${ok.join(", ")}`);
  for (const x of I) {
    const r = x.recipe || {}, L0 = r.layers?.[0] || {}, P = L0.params || {}, B = W.ideologies.find((b: any) => b.id === x.id) || {};
    try {
      const o = render(r);
      if (o.bytes > 6144) errors.push(`${x.id}: tile is ${(o.bytes / 1024).toFixed(1)} KB, limit 6 KB; lower scale, rings, petals or remove a layer`);
    } catch (e: any) {
      errors.push(`${x.id}: recipe does not render: ${e.message}`);
      continue;
    }
    const key = `${L0.family}:${P.motif || P.tiling || "4.8.8"}`, sig = JSON.stringify((r.layers || []).map((L: any) => [L.family, L.params]), (_k, v) => (typeof v === "string" && SLOT.test(v) ? undefined : v));
    if (seen.has(sig)) errors.push(`${x.id}: same structure as ${seen.get(sig)} (${key}, only colours differ); within the house vary the base tiling or motif, star order, contact angle, interlace vs band vs filled, layers or density`);
    else seen.set(sig, x.id);
    if (L0.family === "textile" && P.motif === "tartan" && P.sett) {
      const t = P.sett.reduce((s: number, [, n]: any) => s + n, 0), g = P.sett.filter(([k]: any) => String(k).startsWith("b")).reduce((s: number, [, n]: any) => s + n, 0);
      if (g > t / 2) errors.push(`${x.id}: tartan sett is mostly ground (${g} of ${t} threads in b); give at least half the threads to a or c`);
    }
    const plain = (L0.family === "girih" && P.tiling === "4.4.4.4") || (L0.family === "fret" && P.motif === "knot" && (P.pattern === "plait" || P.breaks === 0)) || (L0.family === "textile" && P.motif === "weave" && ["gingham", "pinwheel"].includes(P.preset));
    if (plain && (r.layers || []).length === 1 && r.theme !== "lattice") errors.push(`${x.id}: ${key} is a plain lattice; choose a richer structure, or set "theme": "lattice" only if the ideology's theme is a grid`);
    // house tradition: every layer inside the house and native, layer 1 a hero motif; or the one outsider (an ideology whose own brief documents an adoption)
    const nat = new Set([...native, ...(B.traditions || [])]), own = new Map<string, string>((B.adoptions || []).map((a: any) => [a.tag, a.note])), fit = x.fit || {};
    const outF = [...new Set<string>((r.layers || []).map((L: any) => L.family).filter((fm: string) => !house.includes(fm)))];
    const nm = (L: any) => `${L.family}:${L.params?.motif || L.params?.tiling || ""}`;
    if (outF.length) {
      outsiders.push([x.id, outF]);
      if (!own.size) errors.push(`${x.id}: uses ${outF.join(", ")} outside the house [${house.join(", ")}], but its brief documents no adoption of its own; build it from the house (vary structure and colour)`);
      if (outF.length > 1) errors.push(`${x.id}: uses ${outF.length} families outside the house (${outF.join(", ")}); an outsider may add one family only`);
    }
    (r.layers || []).forEach((L: any, li: number) => {
      const h = homeOf(L), inHouse = house.includes(L.family);
      if (inHouse && !h.some((t) => nat.has(t))) errors.push(`${x.id}: layer ${li + 1} ${nm(L)} is at home in [${h.join(", ")}], none native to this world [${[...nat].join(", ")}]; the house must stay native`);
      if (!inHouse && own.size && !h.some((t) => own.has(t))) errors.push(`${x.id}: outsider layer ${li + 1} ${nm(L)} is at home in [${h.join(", ")}], none of this ideology's documented adoptions [${[...own.keys()].join(", ")}]`);
    });
    if (house.includes(L0.family) && tierOf(L0) !== "hero")
      errors.push(`${x.id}: layer 1 ${nm(L0)} is support tier; use a hero motif of the house (native hero motifs: ${heroes(nat).filter((id) => house.includes(id.split(":")[0])).join(", ") || "none"}); support motifs only as accent layers`);
    if (!house.includes(L0.family) && own.size && tierOf(L0) !== "hero" && heroes(new Set(own.keys())).length) errors.push(`${x.id}: outsider layer 1 ${nm(L0)} is support tier, but hero motifs fit its adoption: ${heroes(new Set(own.keys())).join(", ")}`);
    const h0 = homeOf(L0);
    if (!h0.includes(fit.tradition)) errors.push(`${x.id}: fit.tradition "${fit.tradition ?? ""}" must be one of layer 1's homes [${h0.join(", ")}] that this world allows`);
    else if (house.includes(L0.family) && !nat.has(fit.tradition)) errors.push(`${x.id}: fit.tradition "${fit.tradition}" is not native here [${[...nat].join(", ")}]; the house speaks for the world's own tradition`);
    else if (!house.includes(L0.family)) {
      if (!own.has(fit.tradition)) errors.push(`${x.id}: outsider fit.tradition "${fit.tradition}" must be one of its brief's adoptions [${[...own.keys()].join(", ")}]`);
      else if (!(fit.adoption || "").trim()) errors.push(`${x.id}: "${fit.tradition}" is an adoption; fit.adoption must cite the brief: "${own.get(fit.tradition)}"`);
    }
    if (!(fit.variant || "").trim()) errors.push(`${x.id}: fit.variant must say in one line how this structure and colour carry the ideology's mood`);
    const kinds: string[] = B.emblems || [], k = x.emblem?.kind;
    if (kinds.length && !kinds.includes(k)) errors.push(`${x.id}: emblem "${k}" is not one of this ideology's real symbols in the emblem set [${kinds.join(", ")}]`);
  }
  if (outsiders.length > 1) errors.push(`${outsiders.length} ideologies leave the house (${outsiders.map(([id, fs]) => `${id}: ${fs.join(", ")}`).join("; ")}); at most one outsider: keep the others in the house and vary structure and colour`);
  const ek = I.map((x) => x.emblem?.kind).filter((k) => k && k !== "none"), dup = ek.filter((k, i) => ek.indexOf(k) !== i);
  if (dup.length) errors.push(`ideology emblems repeat (${[...new Set(dup)].join(", ")}); give each ideology its own mark from its list`);
  if (I.filter((x) => !x.emblem || x.emblem.kind === "none").length > 1) errors.push("at most one ideology may have no emblem");
  for (const k of ["factions", "patrons"]) {
    const L: any[] = skin[k] || [], kinds = L.map((x) => x.emblem?.kind);
    for (const x of L) if (!EMBLEMS.includes(x.emblem?.kind)) errors.push(`${k} ${x.id}: emblem kind "${x.emblem?.kind}" is not in the set`);
    const d = kinds.filter((q, i) => q && kinds.indexOf(q) !== i);
    if (d.length) errors.push(`${k}: emblems must all differ; repeated: ${[...new Set(d)].join(", ")}`);
  }
  for (const f of skin.factions || []) if (W.factions.some((b: any) => b.id === f.id) && f.accent && !/^#[0-9a-f]{6}$/i.test(f.accent)) errors.push(`factions ${f.id}: accent must be #rrggbb`);
  return errors;
}
