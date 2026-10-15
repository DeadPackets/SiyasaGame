// Zellij: the bold, flat cut-tile looks of the hand-made Egypt skin (v27 "Zellij night"), rebuilt as one family. Defaults reproduce
// the hand-made tiles: star (Islamism), burst (Nasserism), chevron (military), circles (liberalism), lattice (Salafism).
// Widths are in cell units; defaults scale with the motif, so scale 2 keeps the hand-made proportions.
import { f, add, mul, poly, circ, reg, lattice, stamp, paint, stroke, polar, starPts } from "./engine.js";

// centred square lattice: cell centres (L.pts), corners (C) and edge midpoints (E)
function grid(p, ctx) {
  const L = lattice(ctx, p.scale || 1, false), s = L.sx, h = s / 2;
  return { L, s, k: s / 100, C: L.pts.map((q) => [q[0] - h, q[1] - h]), E: L.pts.flatMap((q) => [[q[0], q[1] - h], [q[0] - h, q[1]]]) };
}
const W = (v, d, k) => v ?? d * k; // given width in cell units, else the hand-made width scaled with the motif
const links = (pts, s) => pts.map((q) => poly([q, add(q, [-s / 2, s / 2])], false) + poly([q, add(q, [s / 2, s / 2])], false)).join(""); // both diagonals down, separate strokes (a joined V mitres into a jog)

const M = {
  // n-point stars on the centred lattice, a knocked-out core with a dot, studs between, a thin band joining the stars along the diagonals (band 0: none)
  star(p, ctx) {
    const { L, s, k, C, E } = grid(p, ctx), n = p.n || 8, R = s * (p.size ?? 0.31), id = ctx.id, P = [...L.pts, ...C];
    let u = `<path d="${poly(starPts(n, R, R * (p.inner ?? 0.62), p.rot ?? -90))}"${paint(p.star || ctx.slot)}/>`;
    if ((p.knock ?? 0.39) > 0) u += `<path d="${poly(reg(2 * n, R * (p.knock ?? 0.39), -90))}"${paint(p.knockSlot || "b")}/>`;
    if ((p.core ?? 0.145) > 0) u += `<path d="${circ(0, 0, R * (p.core ?? 0.145))}"${paint(p.coreSlot || "c")}/>`;
    const st = s * (p.stud ?? 0.08), band = W(p.band, 2.5, k); // the hand-made stars float; the thin diagonal band joins them
    return { defs: `<g id="${id}T">${u}</g>`, stages: [band > 0 ? `<path d="${links(P, s)}" ${stroke(p.bandSlot || p.star || ctx.slot, band)}/>` : "", stamp(id + "T", P) + (st > 0 ? `<path d="${E.map((q) => poly(reg(8, st, -90, q))).join("")}"${paint(p.studSlot || "c")}/>` : "")] };
  },
  // rays from each cell centre to its cell edge and the discs on the corners; the rays cross a dark ring to the hub disc, so the field joins up
  burst(p, ctx) {
    const { L, s, C } = grid(p, ctx), n = p.n || 8, Lr = s * (p.length ?? 0.74), hw = s * (p.width ?? 0.12), id = ctx.id;
    const rays = Array.from({ length: n }, (_, i) => { const a = -90 + (360 * i) / n, u = polar(Lr, a), v = polar(hw, a + 90); return poly([[0, 0], add(u, v), add(u, mul(v, -1))]); }).join("");
    const kn = s * (p.knock ?? 0.19), co = s * (p.core ?? 0.13), dr = s * (p.disc ?? 0.15);
    // each burst stops at its own cell edge (half a unit over, so facing rays overlap instead of leaving an antialiased hairline), as in the hand-made tile
    const u = `<clipPath id="${id}K"><rect x="${f(-s / 2 - 0.5)}" y="${f(-s / 2 - 0.5)}" width="${f(s + 1)}" height="${f(s + 1)}"/></clipPath>` + (kn > 0 ? `<path d="${circ(0, 0, kn)}"${paint(p.knockSlot || "b")}/>` : "") + `<path d="${rays}" clip-path="url(#${id}K)"${paint(p.ray || ctx.slot)}/>` + (co > 0 ? `<path d="${circ(0, 0, co)}"${paint(p.coreSlot || "c")}/>` : "");
    return { defs: `<g id="${id}B">${u}</g>`, stages: [stamp(id + "B", L.pts) + (dr > 0 ? `<path d="${C.map((q) => circ(q[0], q[1], dr)).join("")}"${paint(p.discSlot || p.ray || ctx.slot)}/>` : "")] };
  },
  // zigzag bands (the carved chevron domes of Mamluk Cairo): bands per motif row, one V per motif; studs alternate hollow / on the band
  chevron(p, ctx) {
    const { s, k } = grid(p, ctx), rows = Math.max(1, Math.round(p.bands || 2)), rh = s / rows, d = rh * (p.depth ?? 0.48), t = rh * (p.band ?? 0.28);
    const nx = Math.round(ctx.w / s), ny = Math.round(ctx.h / rh), st = s * (p.stud ?? 0.06), studs = p.studs || "alt";
    let band = "", band2 = "", sd = "";
    for (let j = 0; j < ny; j++) {
      const y0 = j * rh + (rh - d - t) / 2, top = [];
      for (let i = 0; i <= nx; i++) top.push([i * s, y0 + d], ...(i < nx ? [[i * s + s / 2, y0]] : []));
      const P = poly([...top, ...top.slice().reverse().map((q) => [q[0], q[1] + t])]);
      if (j % 2 && p.band2) band2 += P; else band += P;
      const onBand = studs === "band" || (studs === "alt" && j % 2);
      if (studs !== "none" && st > 0) for (let i = 0; i < nx; i++) sd += poly(reg(8, st, -90, onBand ? [i * s, y0 + d + t / 2] : [i * s + s / 2, y0 + t + d * 0.75]));
    }
    return { stages: [`<path d="${band}"${paint(p.line || ctx.slot)}/>` + (band2 ? `<path d="${band2}"${paint(p.band2)}/>` : "") + (sd ? `<path d="${sd}"${paint(p.studSlot || "c")}/>` : "")] };
  },
  // intersecting rings on the centred lattice, small rings on the edge midpoints, dots where they meet
  circles(p, ctx) {
    const { L, s, k, C, E } = grid(p, ctx), sw = W(p.stroke, 2.6, k), r = s * (p.radius ?? 0.5), sr = s * (p.small ?? 0.22), dot = W(p.dot, 3.6, k);
    const big = [...L.pts, ...C].map((q) => circ(q[0], q[1], r)).join(""), small = sr > 0 ? E.map((q) => circ(q[0], q[1], sr)).join("") : "";
    return { stages: [(small && p.smallFill ? `<path d="${small}"${paint(p.smallFill)}/>` : "") + `<path d="${big}" ${stroke(p.line || ctx.slot, sw)}/>` + (small ? `<path d="${small}" ${stroke(p.smallSlot || p.line || ctx.slot, sw)}/>` : "") + (dot > 0 ? `<path d="${[...E, ...L.pts].map((q) => circ(q[0], q[1], dot)).join("")}"${paint(p.dotSlot || "c")}/>` : "")] };
  },
  // diagonal bands split by a fine ground line, a diamond knot on the crossings, square studs in the openings
  lattice(p, ctx) {
    const { L, s, k, C, E } = grid(p, ctx), P = [...L.pts, ...C], ln = links(P, s), kd = s * (p.knot ?? 0.141), st = s * (p.stud ?? 0.08), sp = W(p.split, 2, k);
    const knots = p.knots === "all" ? P : L.pts;
    return { stages: [`<path d="${ln}" ${stroke(p.line || ctx.slot, W(p.band, 7, k))}/>` + (sp > 0 ? `<path d="${ln}" ${stroke(p.splitSlot || "b", sp)}/>` : ""),
      (kd > 0 ? `<path d="${knots.map((q) => poly(reg(4, kd, -90, q))).join("")}"${paint(p.knotSlot || "b")} ${stroke(p.knotLine || "c", W(p.knotWidth, 2.5, k)).replace('fill="none" ', "")}/>` : "") + (st > 0 ? `<path d="${E.map((q) => poly(reg(4, st / Math.SQRT2, 45, q))).join("")}"${paint(p.studSlot || p.line || ctx.slot)}/>` : "")] };
  },
};

export default function zellij(p, ctx) {
  const m = M[p.motif];
  if (!m) throw new Error(`zellij: unknown motif "${p.motif}" (star, burst, chevron, circles, lattice)`);
  return m(p, ctx);
}
zellij.cell = () => "square";
