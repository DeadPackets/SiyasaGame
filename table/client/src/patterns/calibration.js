// Calibration set for the connectedness check: known all-over patterns (engine recipes) and known floating motifs on plain ground
// (hand-built tiles in the round-2 shapes, since the engine no longer draws them). Each bad tile is a 100 x 100 cell with its motif grid.
import { f, poly, circ, reg, polar, starPts } from "./engine.js";

const G = (fam, p, extra = {}) => ({ layers: [{ family: fam, params: p }], ...extra });
export const GOOD = [
  ["girih 4.8.8 lines", G("girih", { tiling: "4.8.8", angle: 67.5, width: 2.4 })],
  ["girih 4.8.8 interlace", G("girih", { tiling: "4.8.8", angle: 60, width: 2.4, interlace: true, outline: 0.9 })],
  ["girih 3.12.12 zellij", G("girih", { tiling: "3.12.12", angle: 66, width: 2.2, petals: 0.42, fills: { star12: "a", petal: "a/0.6", core: "c" } })],
  ["girih 10.bowtie", G("girih", { tiling: "10.bowtie", angle: 72, width: 2 })],
  ["girih 16.4 interlace", G("girih", { tiling: "16.4", angle: 70, width: 2.6, interlace: true, fills: { star: "a/0.25" } })],
  ["kikko", G("japanese", { motif: "kikko", scale: 2, gap: 1.6, rings: 2, step: 0.18, seq: ["a", "b"], inner: "flower" }, { cell: "hex" })],
  ["kikko, widest gap", G("japanese", { motif: "kikko", scale: 3, gap: 2.5, rings: 1, inner: "dot" }, { cell: "hex" })],
  ["seigaiha", G("japanese", { motif: "seigaiha", scale: 4, rings: 4, seq: ["a", "b", "a", "c"] })],
  ["asanoha", G("japanese", { motif: "asanoha", scale: 2, stroke: 1.3 }, { cell: "hex" })],
  ["meander", G("fret", { motif: "meander", scale: 2 })],
  ["meander, turning rows", G("fret", { motif: "meander", scale: 3, alt: true })],
];

const A = ' fill="var(--a)"', tile = (inner) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="100" height="100"><rect width="100" height="100" fill="var(--b)"/>${inner}</svg>`;
const halfDrop = [[25, 25], [75, 25], [0, 75], [50, 75], [100, 75]], sq = { x: 50, y: 50, px: 100, py: 100 }, hd = { x: 25, y: 25, px: 50, py: 100 };
// alternate wedges from the cell centre to the cell edge (the round-2 deco sunburst)
function wedges(n, taper) {
  const K = [[100, 100], [0, 100], [0, 0], [100, 0]], hit = (a) => { const u = polar(1, a), t = Math.min(...[u[0] > 1e-9 ? 50 / u[0] : Infinity, u[0] < -1e-9 ? -50 / u[0] : Infinity, u[1] > 1e-9 ? 50 / u[1] : Infinity, u[1] < -1e-9 ? -50 / u[1] : Infinity]); return [50 + u[0] * t, 50 + u[1] * t]; };
  let d = "";
  for (let i = 0; i < n; i++) {
    const s = (360 * i) / n, e = s + (360 / n) * taper, ang = (q) => ((((Math.atan2(q[1] - 50, q[0] - 50) * 180) / Math.PI - s) % 360) + 360) % 360;
    d += poly([[50, 50], hit(s), ...K.filter((q) => ang(q) > 0 && ang(q) < e - s).sort((p, q) => ang(p) - ang(q)), hit(e)]);
  }
  return d;
}
const lens = (n, r0, r1, w) => Array.from({ length: n }, (_, i) => { const a = -90 + (360 * i) / n, I = polar(r0, a), O = polar(r1, a), L = r1 - r0, s = Math.tan(((180 / n) * w * Math.PI) / 180) * ((r0 + r1) / 2), rho = (L * L) / 8 / s + s / 2; return `M${f(50 + I[0])} ${f(50 + I[1])}A${f(rho)} ${f(rho)} 0 0 1 ${f(50 + O[0])} ${f(50 + O[1])}A${f(rho)} ${f(rho)} 0 0 1 ${f(50 + I[0])} ${f(50 + I[1])}Z`; }).join("");
export const BAD = [
  ["dot powdering", { svg: tile(`<path d="${halfDrop.map(([x, y]) => circ(x, y, 7)).join("")}"${A}/>`), w: 100, h: 100, grid: hd }],
  ["sunburst rosette on ground", { svg: tile(`<path d="${reg(16, 1, -90).map((_, i) => poly([polar(12, -90 + 22.5 * i - 7), polar(40, -90 + 22.5 * i), polar(12, -90 + 22.5 * i + 7)].map((q) => [50 + q[0], 50 + q[1]]))).join("") + circ(50, 50, 11)}"${A}/>`), w: 100, h: 100, grid: sq }],
  ["rosette medallions, unlinked", { svg: tile(`<path d="${circ(50, 50, 44)}" fill="none" stroke="var(--a)" stroke-width="1.6"/><path d="${lens(12, 8, 38, 0.5)}"${A}/>`), w: 100, h: 100, grid: sq }],
  ["lone stars", { svg: tile(`<path d="${[[25, 25], [75, 75]].map(([x, y]) => poly(starPts(5, 16, 6.5).map((q) => [x + q[0], y + q[1]]))).join("")}"${A}/>`), w: 100, h: 100, grid: { x: 25, y: 25, px: 50, py: 50 } }],
  ["crosses powdered (semé)", { svg: tile(`<path d="${halfDrop.map(([x, y]) => poly(starPts(4, 11, 3).map((q) => [x + q[0], y + q[1]]))).join("")}"${A}/>`), w: 100, h: 100, grid: hd }],
  ["deco sunburst, 24 rays wall to wall", { svg: tile(`<path d="${wedges(24, 0.5)}"${A}/><path d="${circ(50, 50, 19)}" fill="var(--b)"/><path d="${circ(50, 50, 13)}"${A}/>`), w: 100, h: 100, grid: sq, note: "geometrically a tessellation: removed by rule, not by the metric" }],
];
