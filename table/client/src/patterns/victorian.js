// Victorian and industrial: cast-iron grilles (railings, balconies, the khedival and colonial downtowns) and encaustic or cement floor tiles.
import { f, circ, poly, lattice, stamp, paint, stroke, starPts, polar } from "./engine.js";

const rect = (x, y, w, h) => `M${f(x)} ${f(y)}h${f(w)}v${f(h)}h${f(-w)}z`;
const leaf = (A, B, sag) => { const L = Math.hypot(B[0] - A[0], B[1] - A[1]), rho = (L * L / 4 + sag * sag) / (2 * sag); return `M${f(A[0])} ${f(A[1])}A${f(rho)} ${f(rho)} 0 0 1 ${f(B[0])} ${f(B[1])}A${f(rho)} ${f(rho)} 0 0 1 ${f(A[0])} ${f(A[1])}Z`; };

const M = {
  // square bars; a ring in every square touches the bars and is held by a collar at each touch; a boss on every crossing
  grille(p, ctx) {
    const L = lattice(ctx, p.scale || 2, false), id = ctx.id, s = L.sx, ky = L.ky, w = s * (p.bar ?? 0.06), R = s / 2 - w / 2;
    let u = `<path d="M${f(-s / 2)} ${f((-s / 2) * ky)}h${f(s)}M${f(-s / 2)} ${f((-s / 2) * ky)}v${f(s * ky)}" ${stroke(p.line || ctx.slot, w, ' stroke-linecap="square"')}/>`;
    u += `<path d="M${f(-R)} 0a${f(R)} ${f(R * ky)} 0 1 0 ${f(2 * R)} 0a${f(R)} ${f(R * ky)} 0 1 0 ${f(-2 * R)} 0" ${stroke(p.ring || ctx.slot, w * 0.7)}/>`;
    const inner = p.inner || "quatrefoil";
    if (inner === "quatrefoil") u += `<path d="${[0, 90, 180, 270].map((a) => { const c = polar(R * 0.42, a); return `M${f(c[0] + R * 0.3)} ${f(c[1] * ky)}a${f(R * 0.3)} ${f(R * 0.3 * ky)} 0 1 0 ${f(-R * 0.6)} 0a${f(R * 0.3)} ${f(R * 0.3 * ky)} 0 1 0 ${f(R * 0.6)} 0`; }).join("")}" ${stroke(p.ring || ctx.slot, w * 0.45)}/>`;
    else if (inner === "cross") u += `<path d="M${f(-R)} 0h${f(2 * R)}M0 ${f(-R * ky)}v${f(2 * R * ky)}" ${stroke(p.ring || ctx.slot, w * 0.45)}/>`;
    const cl = `<path d="${[[0, -s / 2], [0, s / 2], [-s / 2, 0], [s / 2, 0]].map(([x, y], i) => (i < 2 ? rect(x - w * 0.9, y * ky - w * 0.7, w * 1.8, w * 1.4) : rect(x - w * 0.7, y * ky - w * 0.9, w * 1.4, w * 1.8))).join("")}"${paint(p.collar || "c")}/>`;
    const boss = `<path d="${circ(-s / 2, (-s / 2) * ky, w * (p.boss ?? 1.1))}"${paint(p.bossSlot || "c")}/>`;
    return { defs: `<g id="${id}U">${u}${cl}${boss}</g>`, stages: [stamp(id + "U", L.pts)] };
  },

  // encaustic / cement tile: an eight-point star in the centre, quarter circles in the corners that make whole circles across four tiles, leaves between
  encaustic(p, ctx) {
    const L = lattice(ctx, p.scale || 2, false), id = ctx.id, s = L.sx, ky = L.ky, h = s / 2;
    const sq = (P) => P.map(([x, y]) => [x, y * ky]);
    let u = `<path d="M${f(-h)} ${f(-h * ky)}h${f(s)}M${f(-h)} ${f(-h * ky)}v${f(s * ky)}" ${stroke(p.grout || "b", p.groutWidth ?? 0.9)}/>`; // joints first: the corner disc covers them
    u += `<path d="${circ(-h, -h * ky, s * (p.corner ?? 0.3))}"${paint(p.cornerSlot || "c")} ${stroke(p.ringSlot || ctx.slot, s * 0.035).replace('fill="none" ', "")}/>`;
    u += `<path d="${poly(sq(starPts(8, s * 0.3, s * 0.2, -90)))}"${paint(p.star || ctx.slot)}/><path d="${poly(sq(starPts(4, s * 0.13, s * 0.06, -90)))}"${paint(p.core || "c")}/>`;
    u += `<path d="${[45, 135, 225, 315].map((a) => { const A = polar(s * 0.27, a), B = polar(s * 0.5, a); return leaf([A[0], A[1] * ky], [B[0] * 0.78, B[1] * 0.78 * ky], s * 0.045); }).join("")}"${paint(p.leaf || ctx.slot + "/0.6")}/>`;
    return { defs: `<g id="${id}U">${u}</g>`, stages: [stamp(id + "U", L.pts)] };
  },
};

export default function victorian(p, ctx) {
  const m = M[p.motif];
  if (!m) throw new Error(`victorian: unknown motif "${p.motif}"`);
  return m(p, ctx);
}
