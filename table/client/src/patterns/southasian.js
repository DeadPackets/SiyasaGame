// South Asian: pierced stone screens (jali) and the ogival trellis of Mughal pietra dura and textiles. No paisley.
import { f, add, poly, circ, reg, lattice, stamp, paint, stroke, polar, starPts } from "./engine.js";

const leaf = (A, B, sag) => { const L = Math.hypot(B[0] - A[0], B[1] - A[1]), rho = (L * L / 4 + sag * sag) / (2 * sag); return `M${f(A[0])} ${f(A[1])}A${f(rho)} ${f(rho)} 0 0 1 ${f(B[0])} ${f(B[1])}A${f(rho)} ${f(rho)} 0 0 1 ${f(A[0])} ${f(A[1])}Z`; };
// ogee trellis lines over one period: mirrored sine waves around every column axis (s apart, period 2h); they cross on the axis and touch between columns
export function ogee(w, h, cols, rows) {
  const s = w / cols, P = h / rows, N = 12;
  let d = "";
  for (let i = 0; i < cols; i++) for (const sg of [1, -1]) {
    d += "M" + Array.from({ length: rows * N + 1 }, (_, k) => { const y = (k * P) / N; return f(i * s + sg * (s / 2) * Math.sin((Math.PI * k) / N)) + " " + f(y); }).join("L");
  }
  return { d, s, P };
}
export const flower = (c, r, n = 4, a0 = 0) => Array.from({ length: n }, (_, i) => leaf(add(c, polar(r * 0.18, a0 + (360 * i) / n)), add(c, polar(r, a0 + (360 * i) / n)), r * 0.3)).join("");

const M = {
  // jali: the stone (motif slot) pierced by holes on a hex lattice: six-point stars, six-lobed flowers or hexagons, with small holes where three meet
  jali(p, ctx) {
    const L = lattice(ctx, p.scale || 2, true), id = ctx.id, d = L.sx, ky = L.ky, R = d * (p.size ?? 0.4), kind = p.hole || "star";
    const sq = (P) => P.map(([x, y]) => [x, y * ky]);
    let hole = kind === "flower" ? reg(6, R * 0.55, -90).map((q) => circ(q[0], q[1] * ky, R * 0.42)).join("") + circ(0, 0, R * 0.6) : kind === "hex" ? poly(sq(reg(6, R * 1.02, -90))) : poly(sq(starPts(6, R * 1.08, R * 0.64)));
    const t = d * (p.small ?? 0.1), small = (c) => poly(sq(reg(6, t, 0)).map((q) => add(q, c)));
    const tri = L.pts.flatMap((q) => [small(add(q, [d / 2, (L.sy / 3)])), small(add(q, [d, (2 * L.sy) / 3]))]).join("");
    const out = p.moulding ? `<g ${stroke(p.moulding, p.mouldWidth ?? 0.8)}>${stamp(id + "H", L.pts)}</g>` : "";
    return { defs: `<path id="${id}H" d="${hole}"/>`, stages: [`<rect width="${f(ctx.w)}" height="${f(ctx.h)}"${paint(p.stone || ctx.slot)}/>`, `<g${paint(p.holeSlot || "b")}>${stamp(id + "H", L.pts)}</g>${t ? `<path d="${tri}"${paint(p.holeSlot || "b")}/>` : ""}`, out] };
  },

  // ogival trellis with an inlaid four-petal flower where the lines touch and cross (pietra dura, Mughal and Ottoman textiles)
  ogee(p, ctx) {
    const cols = Math.max(1, Math.round(p.scale || 2)), rows = Math.max(1, Math.round((cols * ctx.h) / ctx.w * (p.tall ?? 0.7))), O = ogee(ctx.w, ctx.h, cols, rows), id = ctx.id;
    ctx.grid = { x: 0, y: O.P / 2, px: O.s, py: O.P };
    const r = Math.min(O.s, O.P) * (p.flower ?? 0.2), pts = [];
    for (let i = 0; i < cols; i++) for (let j = 0; j < rows; j++) pts.push([i * O.s, j * O.P], [i * O.s + O.s / 2, j * O.P + O.P / 2]); // crossings and touches
    const fl = pts.map((c) => flower(c, r, 4, 45)).join(""), core = pts.map((c) => circ(c[0], c[1], r * 0.22)).join("");
    let inner = "";
    if (p.bud) for (let i = 0; i < cols; i++) for (let j = 0; j < rows; j++) for (const c of [[i * O.s, j * O.P + O.P / 2], [i * O.s + O.s / 2, j * O.P]]) inner += leaf(add(c, [0, r * 0.9]), add(c, [0, -r * 1.3]), r * 0.4);
    return { stages: [`<path d="${O.d}" ${stroke(p.line || ctx.slot, p.stroke ?? 2.2)}/>`, `<path d="${fl}"${paint(p.flowerSlot || ctx.slot)}/><path d="${core}"${paint(p.coreSlot || "c")}/>` + (inner ? `<path d="${inner}"${paint(p.budSlot || "c/0.6")}/>` : "")] };
  },
};

export default function southasian(p, ctx) {
  const m = M[p.motif];
  if (!m) throw new Error(`southasian: unknown motif "${p.motif}"`);
  return m(p, ctx);
}
southasian.cell = (p) => (p.motif === "jali" ? "hex" : undefined);
