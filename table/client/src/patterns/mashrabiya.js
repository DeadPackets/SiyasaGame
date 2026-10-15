// Mashrabiya: the turned-wood lattice of Cairo's houses (Mamluk and Ottoman). Short turned spindles, each with a central bead and two collars,
// meet at knobs; the grid runs square (orthogonal) or on the diagonal. No arabesque, no carving: the turning is the only ornament.
import { f, circ, lattice, paint, stroke } from "./engine.js";

export default function mashrabiya(p, ctx) {
  if (p.motif && p.motif !== "turned") throw new Error(`mashrabiya: unknown motif "${p.motif}" (only "turned")`);
  const diag = p.diagonal !== false, L = lattice(ctx, p.scale || 3, false), s = L.sx, ky = L.ky, id = ctx.id;
  // a spindle along +x, length Ls, from one knob to the next
  // clamped so the turning stays fine at full screen: a fat bead reads as a chain of sausages, not turned wood
  const cl = (v, d, lo, hi) => Math.max(lo, Math.min(hi, v ?? d)), Ls = diag ? (s * Math.SQRT2) / 2 : s, w = Ls * cl(p.rod, 0.06, 0.04, 0.075), bR = Ls * cl(p.bead, 0.11, 0.07, 0.13), kR = Ls * cl(p.knob, 0.1, 0.07, 0.12);
  const bead = `M${f(Ls / 2 - bR * 1.6)} 0a${f(bR * 1.6)} ${f(bR)} 0 1 0 ${f(bR * 3.2)} 0a${f(bR * 1.6)} ${f(bR)} 0 1 0 ${f(-bR * 3.2)} 0`;
  const collar = [0.21, 0.79].map((t) => `M${f(Ls * t - w * 0.35)} ${f(-w * 0.95)}h${f(w * 0.7)}v${f(w * 1.9)}h${f(-w * 0.7)}z`).join("");
  const sp = `<path d="M0 0H${f(Ls)}" ${stroke(p.wood || ctx.slot, w)}/><path d="${bead + collar}"${paint(p.wood || ctx.slot)}/>`
    + (p.shine !== "none" ? `<path d="M${f(Ls / 2 - bR * 0.7)} ${f(-bR * 0.45)}h${f(bR * 1.4)}" ${stroke(p.shine || "c/0.55", Math.max(0.5, bR * 0.22), ' stroke-linecap="round"')}/>` : "");
  // knobs on the nodes; spindles from each node: right and down (square) or the two downward diagonals (diagonal, nodes on a centred lattice)
  const nodes = diag ? L.pts.flatMap((q) => [q, [q[0] + s / 2, q[1] + L.sy / 2]]) : L.pts, dirs = diag ? [45, 135] : [0, 90];
  const use = (q, a) => `<use href="#${id}S" transform="translate(${f(q[0])} ${f(q[1])}) scale(1 ${f(ky)}) rotate(${a})"/>`;
  const spindles = nodes.flatMap((q) => dirs.map((a) => use(q, a))).join("");
  const knob = `<path d="${nodes.map((q) => circ(q[0], q[1], kR)).join("")}"${paint(p.knobSlot || p.wood || ctx.slot)}/>` + (p.knobCore ? `<path d="${nodes.map((q) => circ(q[0], q[1], kR * 0.4)).join("")}"${paint(p.knobCore)}/>` : "");
  return { defs: `<g id="${id}S">${sp}</g>`, stages: [(p.screen ? `<rect width="${f(ctx.w)}" height="${f(ctx.h)}"${paint(p.screen)}/>` : "") + spindles, knob] };
}
