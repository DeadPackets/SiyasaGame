// Baroque and imperial European: damask on an ogival frame, treillage (trellis) with rosettes, engine-turned guilloche of the banknote and the certificate.
import { f, add, circ, lattice, stamp, paint, stroke } from "./engine.js";
import { ogee, flower } from "./southasian.js";

const leaf = (A, B, sag) => { const L = Math.hypot(B[0] - A[0], B[1] - A[1]), rho = (L * L / 4 + sag * sag) / (2 * sag); return `M${f(A[0])} ${f(A[1])}A${f(rho)} ${f(rho)} 0 0 1 ${f(B[0])} ${f(B[1])}A${f(rho)} ${f(rho)} 0 0 1 ${f(A[0])} ${f(A[1])}Z`; };
const wave = (x0, y0, len, A, lam, ph, N = 16) => "M" + Array.from({ length: Math.round((len / lam) * N) + 1 }, (_, k) => { const x = (k * lam) / N; return f(x0 + x) + " " + f(y0 + A * Math.sin((2 * Math.PI * x) / lam + ph)); }).join("L");

const M = {
  // damask: a symmetric fleur in every ogival compartment, a rosette in the offset ones; tone on tone by default
  damask(p, ctx) {
    const cols = Math.max(1, Math.round(p.scale || 2)), rows = Math.max(1, Math.round((cols * ctx.h) / ctx.w * (p.tall ?? 0.7))), O = ogee(ctx.w, ctx.h, cols, rows), s = O.s, P = O.P;
    ctx.grid = { x: 0, y: P / 2, px: s, py: P };
    const fleur = (c) => {
      const q = (dx, dy) => add(c, [dx * s, dy * P]);
      // a bud on a short stem, two broad leaves sweeping out and up, two small leaves at the foot
      return leaf(q(0, 0.12), q(0, -0.36), s * 0.11) + leaf(q(0, 0.16), q(-0.3, -0.16), s * 0.085) + leaf(q(0, 0.16), q(0.3, -0.16), s * 0.085) + leaf(q(0, 0.3), q(-0.16, 0.4), s * 0.04) + leaf(q(0, 0.3), q(0.16, 0.4), s * 0.04) + `M${f(q(0, 0.42)[0] - s * 0.012)} ${f(q(0, 0.42)[1])}h${f(s * 0.024)}V${f(q(0, 0.1)[1])}h${f(-s * 0.024)}Z`;
    };
    let A = "", B = "";
    for (let i = 0; i < cols; i++) for (let j = 0; j < rows; j++) { A += fleur([i * s, j * P + P / 2]); B += flower([i * s + s / 2, j * P], Math.min(s, P) * 0.24, 8, -90) + circ(i * s + s / 2, j * P, Math.min(s, P) * 0.06); }
    return { stages: [`<path d="${O.d}" ${stroke(p.line || ctx.slot + "/0.45", p.stroke ?? 1)}/>`, `<path d="${A}"${paint(p.fleur || ctx.slot + "/0.8")}/><path d="${B}"${paint(p.rosette || "c/0.55")}/>`] };
  },

  // treillage: diagonal laths, each drawn as a pair of rails, with a rosette over every crossing
  trellis(p, ctx) {
    const L = lattice(ctx, p.scale || 2, false), id = ctx.id, s = L.sx, sy = L.sy, o = s * (p.rail ?? 0.04), sw = p.stroke ?? 1.4;
    let d = "";
    for (const q of L.pts) for (const sg of [-1, 1]) for (const k of [-o, o]) d += `M${f(q[0] - s / 2 + k)} ${f(q[1] - sg * sy / 2)}l${f(s)} ${f(sg * sy)}`;
    const r = Math.min(s, sy) * (p.rosette ?? 0.2);
    const ros = `<path d="${flower([0, 0], r, p.petals || 4, 0)}"${paint(p.rosetteSlot || "c")}/><path d="${circ(0, 0, r * 0.25)}"${paint(p.coreSlot || ctx.slot)}/>`;
    const corners = L.pts.map((q) => [q[0] - s / 2, q[1] - sy / 2]);
    return { defs: `<g id="${id}R">${ros}</g>`, stages: [`<path d="${d}" ${stroke(p.line || ctx.slot, sw)}/>`, stamp(id + "R", corners) + (p.dot ? `<path d="${L.pts.map((q) => circ(q[0], q[1], p.dot)).join("")}"${paint(p.dotSlot || "c/0.6")}/>` : "")] };
  },

  // guilloche: bands of phase-shifted sine waves (an engine-turned rope), each band edged by a fine rule; alternate bands shift half a wave
  guilloche(p, ctx) {
    const n = Math.max(1, Math.round(p.scale || 1)), lam = ctx.w / n, bands = 2 * Math.max(1, Math.round(((p.bands ?? 1) * ctx.h) / ctx.w / 2)), bh = ctx.h / bands, m = Math.max(3, Math.min(7, Math.round(p.strands ?? 3))), A = bh * 0.4 * (p.amp ?? 1);
    ctx.grid = { x: lam / 2, y: bh / 2, px: lam, py: 2 * bh };
    let w = "", r = "";
    for (let j = 0; j < bands; j++) { const yc = (j + 0.5) * bh; for (let k = 0; k < m; k++) w += wave(-0.01, yc, ctx.w + 0.02, A, lam, (2 * Math.PI * k) / m + (j % 2 ? Math.PI / m : 0)); r += `M0 ${f(j * bh)}h${f(ctx.w)}`; }
    return { stages: [`<path d="${w}" ${stroke(p.line || ctx.slot, p.stroke ?? 2)}/>` + (p.rule === false ? "" : `<path d="${r}" ${stroke(p.ruleSlot || "c", p.ruleWidth ?? 1.2)}/>`)] };
  },
};

export default function baroque(p, ctx) {
  const m = M[p.motif];
  if (!m) throw new Error(`baroque: unknown motif "${p.motif}"`);
  return m(p, ctx);
}
