// Pattern engine: JSON recipe -> seamless SVG tile. Colours only via var(--a) motif, var(--b) ground, var(--c) highlight.
import girih from "./girih.js";
import japanese from "./japanese.js";
import rosette from "./rosette.js";
import tech from "./tech.js";
import emblem from "./emblem.js";
import deco from "./deco.js";
import textile from "./textile.js";
import fret from "./fret.js";
import organic from "./organic.js";
import heraldic from "./heraldic.js";
import ancient from "./ancient.js";
import scifi from "./scifi.js";
import chinese from "./chinese.js";
import southasian from "./southasian.js";
import brick from "./brick.js";
import sectile from "./sectile.js";
import baroque from "./baroque.js";
import victorian from "./victorian.js";
import modern from "./modern.js";
import african from "./african.js";
import steppe from "./steppe.js";
import pacific from "./pacific.js";
import maritime from "./maritime.js";
import mashrabiya from "./mashrabiya.js";
import zellij from "./zellij.js";
import { soviet, tudor, mongol, indus, sasanian, louis, paleo } from "./native.js";
import { migrate } from "./legacy.js";

export const FAMILIES = { girih, japanese, rosette, tech, deco, textile, fret, organic, heraldic, ancient, scifi, chinese, southasian, brick, sectile, baroque, victorian, modern, african, steppe, pacific, maritime, mashrabiya, zellij, soviet, tudor, mongol, indus, sasanian, louis, paleo };
export const S3 = Math.sqrt(3), DEG = Math.PI / 180;

// ---------- numbers, vectors, paths ----------
// round half up (not toFixed, which rounds -6.25 and 93.75 apart), so a point and its period copy stay exactly one period apart
export const f = (v) => String(Math.round(v * 10 + 1e-9) / 10).replace(/^(-?)0\./, "$1.");
export const add = (a, b) => [a[0] + b[0], a[1] + b[1]];
export const sub = (a, b) => [a[0] - b[0], a[1] - b[1]];
export const mul = (a, s) => [a[0] * s, a[1] * s];
export const dot = (a, b) => a[0] * b[0] + a[1] * b[1];
export const len = (a) => Math.hypot(a[0], a[1]);
export const unit = (a) => mul(a, 1 / len(a));
export const rot = (a, deg) => { const c = Math.cos(deg * DEG), s = Math.sin(deg * DEG); return [a[0] * c - a[1] * s, a[0] * s + a[1] * c]; };
export const polar = (r, deg) => [r * Math.cos(deg * DEG), r * Math.sin(deg * DEG)];
export function isect(p, u, q, v) { // p + t u = q + s v
  const cr = u[0] * v[1] - u[1] * v[0], w = sub(q, p);
  return add(p, mul(u, (w[0] * v[1] - w[1] * v[0]) / cr));
}
export const pt = (p) => f(p[0]) + " " + f(p[1]);
export const poly = (ps, close = true) => "M" + ps.map(pt).join(" ") + (close ? "Z" : "");
// the chord is exactly twice the rounded radius: f(2r) can be one step short of 2 f(r), and then each large-arc half bulges past the
// circle by up to sqrt(r) / 3 units (a 16.2 ring drew 17.5 tall), beyond the reach the families plan their wrapped copies for
export const circ = (x, y, r) => { const R = f(r), D = f(2 * +R); return `M${f(x - +R)} ${f(y)}a${R} ${R} 0 1 0 ${D} 0a${R} ${R} 0 1 0 -${D} 0`; };
export const reg = (n, R, a0 = 0, c = [0, 0]) => Array.from({ length: n }, (_, i) => add(c, polar(R, a0 + (360 * i) / n)));
// filled n-point star with given inner radius; ri omitted -> {n/2} geometry
export const starPts = (n, R, ri, a0 = -90) => Array.from({ length: 2 * n }, (_, i) => polar(i % 2 ? ri ?? R * 0.5 : R, a0 + (180 * i) / n));

// slot spec: "a", "c/0.6", "none"
export function paint(spec, kind = "fill") {
  if (!spec || spec === "none") return ` ${kind}="none"`;
  const [s, o] = String(spec).split("/");
  return ` ${kind}="var(--${s})"` + (o ? ` ${kind}-opacity="${o}"` : "");
}
export const stroke = (spec, w, extra = "") => `fill="none"${paint(spec, "stroke")} stroke-width="${f(w)}"${extra}`;

export function rng(seed) { // mulberry32
  let a = (seed | 0) + 0x6d2b79f5;
  return () => { a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

// Lattice points of one period. hex: rows offset by half a step; on a square cell the rows stretch to fit (ky != 1).
// The first lattice a layer asks for sets its motif grid (ctx.grid) unless the family set one.
export function lattice(ctx, n, hex) {
  const { w, h } = ctx, sx = w / n, pts = [];
  if (hex) {
    const rows = 2 * Math.max(1, Math.round((n * h) / w / S3)), sy = h / rows;
    for (let j = 0; j < rows; j++) for (let i = 0; i < n; i++) pts.push([i * sx + (j % 2 ? sx / 2 : 0), j * sy]);
    ctx.grid ??= { x: 0, y: 0, px: sx, py: 2 * sy };
    return { pts, sx, sy, ky: sy / ((sx * S3) / 2) };
  }
  const ny = Math.max(1, Math.round((n * h) / w)), sy = h / ny;
  for (let j = 0; j < ny; j++) for (let i = 0; i < n; i++) pts.push([(i + 0.5) * sx, (j + 0.5) * sy]);
  ctx.grid ??= { x: sx / 2, y: sy / 2, px: sx, py: sy };
  return { pts, sx, sy, ky: sy / sx };
}
export const stamp = (id, pts) => pts.map((p) => `<use href="#${id}"${p[0] ? ` x="${f(p[0])}"` : ""}${p[1] ? ` y="${f(p[1])}"` : ""}/>`).join("");

// ---------- render ----------
// Base cells (w x h). A girih tiling or a family can require its cell; otherwise recipe.cell picks it.
export const CELLS = { square: [100, 100], hex: [100, 173.2], dec: [100, 137.6] };
export function cellOf(recipe) {
  recipe = migrate(recipe);
  const L0 = (recipe.layers || [])[0], fam = L0 && FAMILIES[L0.family];
  const c = (fam && fam.cell && fam.cell(L0.params || {})) || recipe.cell || "square";
  return CELLS[c] ? c : "square";
}
// opt.span: render span x span tiles of the infinite pattern (checker ground truth). opt.noWrap / opt.shift: break the wrap on purpose (checker controls).
// The field tile is pure pattern: the emblem never repeats (see renderMedallion). grid = layer 1's motif centre (x, y) and periods (px across, py down).
function draw(recipe, opt = {}) {
  recipe = migrate(recipe); // motifs cut in earlier rounds render as their closest survivor
  const cell = cellOf(recipe), [w, h] = CELLS[cell], hex = cell === "hex", span = opt.span || 1;
  const I = recipe.intricacy ?? 0.5, seed = recipe.seed ?? 1;
  // copies of one cell: a row of x offsets, then rows at y offsets (row-major, each copy drawn once)
  const xs = [], ys = [];
  for (let i = -1; i <= span; i++) if (!opt.noWrap || (i >= 0 && i < span)) xs.push(i * w);
  for (let j = -1; j <= span; j++) if (!opt.noWrap || (j >= 0 && j < span)) ys.push(j * h);
  let defs = "", body = "", grid = null;
  [...(recipe.layers || [])].slice(0, 3).forEach((L, li) => {
    const fam = FAMILIES[L.family];
    if (!fam) throw new Error(`unknown family "${L.family}"`);
    const ctx = { w, h, hex, cell, I, span, slot: L.slot || "a", rng: rng(seed * 7919 + li * 104729), id: "l" + li };
    // repeat counts must be whole numbers or the tile stops wrapping
    const P = { ...(L.params || {}) };
    for (const k of ["scale", "grid", "strips", "blocks", "rows", "ticks"]) if (P[k] != null) P[k] = Math.max(1, Math.round(P[k]));
    // number params the model sometimes fills with a slot: outline "b" means an outline in b, dot "c" a dot in c, the fan's core "c" a core in c
    for (const [k, slot, w] of [["outline", "edge", 0.8], ["dot", "dotSlot", 1.2]]) if (typeof P[k] === "string") { if (P[k] !== "none") P[slot] ??= P[k]; P[k] = P[k] === "none" ? 0 : w; }
    if (L.family === "deco" && typeof P.core === "string") { P.coreSlot ??= P.core; delete P.core; }
    const out = fam(P, ctx);
    // a number param given a slot string ("sash": "a/0.35") turns every coordinate into NaN and the tile renders blank
    if ((out.defs || "").includes("NaN") || out.stages.some((st) => st && st.includes("NaN"))) throw new Error(`layer ${li + 1} (${L.family} ${P.motif || P.tiling || ""}) draws NaN coordinates: a number param got a non-number (string params: ${Object.entries(P).filter(([, v]) => typeof v === "string").map(([k, v]) => `${k}=${v}`).join(", ")})`);
    if (!li) grid = ctx.grid || { x: w / 2, y: h / 2, px: w, py: h };
    defs += out.defs || "";
    let g = "";
    out.stages.forEach((s, si) => {
      if (!s) return;
      const id = ctx.id + "s" + si;
      defs += `<g id="${id}">${s}</g>`;
      if (out.self) { g += `<use href="#${id}"/>`; return; }
      if (opt.shift) { g += ys.map((y) => xs.map((x) => `<use href="#${id}" x="${f(x + (x || y ? opt.shift : 0))}" y="${f(y)}"/>`).join("")).join(""); return; }
      defs += `<g id="${id}r">${stamp(id, xs.map((x) => [x, 0]))}</g>`;
      g += stamp(id + "r", ys.map((y) => [0, y]));
    });
    body += L.opacity != null && L.opacity < 1 ? `<g opacity="${L.opacity}">${g}</g>` : g;
  });
  const m = (v, p) => ((v % p) + p) % p;
  return { defs, body, w, h, cell, grid: { ...grid, x: m(grid.x, w), y: m(grid.y, h) } };
}
const svgOf = (vb, W, H, inner) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${vb}" width="${W}" height="${H}">${inner}</svg>`;

export function render(recipe, opt = {}) {
  const d = draw(recipe, opt), span = opt.span || 1, W = f(d.w * span), H = f(d.h * span);
  const svg = svgOf(`0 0 ${W} ${H}`, W, H, `<rect width="${W}" height="${H}" fill="var(--b)"/><defs>${d.defs}</defs>${d.body}`);
  return { svg, w: d.w, h: d.h, cell: d.cell, grid: d.grid, bytes: svg.length };
}

// Medallion (or any single large view: opt.aspect = w/h): the pattern centred on one motif centre, the emblem once on a knock-out disc over it.
// opt.periods: view width in motif periods (default 1.5, so the neighbours frame the centre motif).
export function renderMedallion(recipe, opt = {}) {
  const d = draw(recipe, { span: 3 }), g = d.grid, asp = opt.aspect || 1;
  // the 3 x 3 render covers one cell around the centre, so the view stays inside it
  const V = Math.min((opt.periods || 1.5) * Math.min(g.px, g.py), 2 * d.w / Math.max(1, asp), 2 * d.h * Math.min(1, asp)), Vw = V * Math.max(1, asp), Vh = V / Math.min(1, asp);
  const cx = d.w + g.x, cy = d.h + g.y, x0 = cx - Vw / 2, y0 = cy - Vh / 2;
  const E = recipe.emblem && recipe.emblem.kind && recipe.emblem.kind !== "none" ? `<g transform="translate(${f(cx)} ${f(cy)})">${emblem(recipe.emblem, Math.min(Vw, Vh))}</g>` : "";
  const svg = svgOf(`${f(x0)} ${f(y0)} ${f(Vw)} ${f(Vh)}`, f(Vw), f(Vh), `<rect x="${f(x0)}" y="${f(y0)}" width="${f(Vw)}" height="${f(Vh)}" fill="var(--b)"/><defs>${d.defs}</defs>${d.body}${E}`);
  return { svg, w: Vw, h: Vh, cell: d.cell, grid: g, bytes: svg.length };
}

// CSS background for a repeating view of a field tile in a box of bw x bh px, with a motif centre at the box centre.
// rows: the box height holds exactly that many vertical periods (the strip; bh is adjusted to whole pixels of tile and returned).
// across: the box width holds that many horizontal periods (the field block).
export function view(o, bw, bh, { rows, across } = {}) {
  const g = o.grid;
  let k = rows ? bh / (rows * g.py) : bw / (across * g.px);
  k = Math.round(o.w * k) / o.w; // whole-pixel tile width, so repeats never drift
  if (rows) bh = Math.round(rows * g.py * k);
  const tw = o.w * k, th = o.h * k, m = (v, p) => ((v % p) + p) % p;
  return { size: `${f(tw)}px ${(Math.round(th * 100) / 100)}px`, pos: `${f(m(bw / 2 - g.x * k, tw))}px ${Math.round(m(bh / 2 - g.y * k, th) * 100) / 100}px`, h: bh, tw, th };
}
// tile as a CSS url at its true aspect; pal {a,b,c} bakes colours in (data URLs cannot read CSS variables)
export function tileURL(recipe, pal, opt = {}) {
  const o = render(recipe, opt);
  return { url: dataURL(pal ? colorize(o.svg, pal) : o.svg), w: o.w, h: o.h };
}

// ---------- colour helpers for consumers ----------
// a skin colour that is not plain hex never reaches the markup (built skins come from strangers' prompts)
const HEX = /^#[0-9a-f]{3,8}$/i;
export const colorize = (svg, p) => svg.replace(/var\(--([abc])\)/g, (_, k) => (HEX.test(p[k]) ? p[k] : "#808080"));
export const motif = (svg) => svg.replace(/<rect width="[\d.]+" height="[\d.]+" fill="var\(--b\)"\/>/, "");
// luminance mask for the finish: the foil slot is white, everything else black
export const foilMask = (svg, foil = "a") => svg.replace(/var\(--([abc])\)/g, (_, k) => (foil.includes(k) ? "#fff" : "#000"));
export const dataURL = (svg) => "data:image/svg+xml," + encodeURIComponent(svg);
