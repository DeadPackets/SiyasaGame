// Motifs that stay out, and how an old recipe that used one maps to the closest surviving motif (same slots, scale and colour roles).
// Round 5 restored deco sunburst and ziggurat, heraldic semé and vair, ancient spirals, tech scan, circuit and hexcells (each reworked to be
// all-over and connected) and removed the ones below that cannot tile as one connected field or that the owner found ugly.
export const REMOVED = [
  ["scifi", "stars", "lone stars on plain ground; a starfield cannot join up", "scifi scangrid (star-chart graticule)"],
  ["scifi", "constellation", "round 5: owner disliked the round-4 star chart", "scifi scangrid (star-chart graticule)"],
  ["scifi", "cells", "round 4: blobby alien cells, ugly at full screen", "scifi cairo"],
  ["scifi", "panel", "round 4: greeble panels, busy and toy-like", "scifi isogrid"],
  ["scifi", "armour", "round 4: heavy bevelled plates", "scifi hexarmour (fine, chamfered)"],
  ["found", "tunnels", "round 4: wobbly ant galleries, ugly", "chinese bingwen"],
  ["found", "comb", "round 4: noisy random honeycomb", "scifi honeycomb"],
  ["found", "pantry", "round 4: clip-art food in a rack", "brick subway (kitchen tile)"],
  ["modern", "coffer", "round 5: owner: ugly", "modern breeze (concrete screen)"],
  ["modern", "pinstripe", "round 5: owner disliked the round-4 Kepler set; thin stripes buzz", "modern grid"],
  ["modern", "truchet", "round 5: owner disliked the round-4 Kepler set", "scifi rings"],
];
export const REWORKED = [
  ["rosette", "medallions always linked to every neighbour by bands (diagonals too on a square lattice)"],
  ["deco chevron", "round 5: zigzag bands run unbroken across cell edges; each fan ends on the band above, outer rays on its valleys"],
  ["deco sunburst", "round 5: framed sunray panels; rays stop at the panel frame (straight or brick rows, centred or rising sun)"],
  ["deco ziggurat", "round 5: stepped chevron bands that fill the field, no plain rows"],
  ["heraldic vair", "round 5: counterchanged bells with curved shoulders, rows interlock, no ground"],
  ["heraldic seme", "round 5: charges sit in a lozenge diaper whose lines join them"],
  ["ancient spirals", "round 5: running spiral, every spiral joined to the next by an S-link"],
  ["tech circuit", "round 5: calm buses with rounded 45-degree stubs to pads in a fixed rhythm"],
  ["tech hexcells", "round 5: every cell outlined; lit, ringed and plain cells in a fixed three-colouring, no random noise"],
  ["tech scan", "round 5: bars sit on a continuous rail per row"],
  ["textile quilt / weave", "sashing always on (6% minimum); weave keeps the four presets, colors recolours the threads"],
  ["fret leiwen", "spirals hang from a continuous rail"],
  ["ancient stepfret / circles", "baseline joins the keys; circle rings always drawn"],
  ["organic palmette / whiplash", "rows closer (even count); a knot where the curves meet"],
];
const MAP = {
  "scifi:stars": () => ({ motif: "scangrid", scale: 2, ring: true }),
  "scifi:constellation": (p) => ({ motif: "scangrid", scale: 2, ring: true, line: p.line, markSlot: p.brightSlot || p.starSlot }),
  "scifi:cells": (p) => ({ motif: "cairo", scale: 2, fillA: p.cell, fillB: p.cell ? p.cell + "/0.75" : undefined }),
  "scifi:panel": (p) => ({ motif: "isogrid", scale: 3, pocket: p.plate }),
  "scifi:armour": (p) => ({ motif: "hexarmour", scale: p.scale, gap: p.gap, plate: p.plate }),
  "found:tunnels": (p) => ({ motif: "bingwen", line: p.edge }),
  "found:comb": () => ({ motif: "honeycomb", scale: 4 }),
  "found:pantry": (p) => ({ motif: "subway", tile: p.itemSlot }),
  "modern:coffer": (p) => ({ motif: "breeze", scale: p.scale || 2, block: p.ribSlot }),
  "modern:pinstripe": (p) => ({ motif: "grid", scale: 2, line: p.line }),
  "modern:truchet": (p) => ({ motif: "rings", scale: 2, line: p.line }),
};
const FAM = { "scifi:stars": "scifi", "scifi:constellation": "scifi", "scifi:cells": "scifi", "scifi:panel": "scifi", "scifi:armour": "scifi", "found:tunnels": "chinese", "found:comb": "scifi", "found:pantry": "brick", "modern:coffer": "modern", "modern:pinstripe": "modern", "modern:truchet": "scifi" };
export function migrate(recipe) {
  if (!(recipe.layers || []).some((L) => MAP[`${L.family}:${L.params?.motif}`])) return recipe;
  const layers = (recipe.layers || []).map((L) => {
    const k = `${L.family}:${L.params?.motif}`;
    if (!MAP[k]) return L;
    const params = Object.fromEntries(Object.entries(MAP[k](L.params || {})).filter(([, v]) => v != null));
    return { ...L, family: FAM[k], params };
  });
  return { ...recipe, layers };
}
