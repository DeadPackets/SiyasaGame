// Brick and tile bonds: Persian hazarbaf (bricks laid to draw diamonds and zigzags), herringbone (Roman opus spicatum, parquet), glazed subway tile.
import { f, paint } from "./engine.js";

const rect = (x, y, w, h) => `M${f(x)} ${f(y)}h${f(w)}v${f(h)}h${f(-w)}z`;
const frac = (v) => v - Math.floor(v);

const M = {
  // running bond; bricks whose centre lies on a diamond (or zigzag) band of the motif grid take the pattern slot
  hazarbaf(p, ctx) {
    const rows = 2 * Math.max(2, Math.round((p.rows ?? 8) / 2)), bh = ctx.h / rows, per = Math.max(1, Math.round(p.scale ?? 1)), nb = Math.max(4, Math.round(p.bricks ?? 6)), bw = ctx.w / nb, g = p.mortar ?? 1;
    const Px = ctx.w / per, Py = ctx.h / per, form = p.form || "lattice", band = p.band ?? 0.09;
    ctx.grid = { x: Px / 2, y: Py / 2, px: Px, py: Py };
    let A = "", B = "";
    for (let j = 0; j < rows; j++) for (let i = 0; i < nb; i++) {
      const x = i * bw + (j % 2 ? bw / 2 : 0), y = j * bh, cx = frac((x + bw / 2) / Px) - 0.5, cy = frac((y + bh / 2) / Py) - 0.5;
      const dm = Math.abs(cx) + Math.abs(cy); // 0 at the field centre, 0.5 on the diamond grid through the corners
      const v = form === "zigzag" ? Math.abs(Math.abs(cx) * 2 - frac(cy + 0.5)) : form === "diamond" ? Math.abs(dm - 0.25) : Math.min(Math.abs(dm - 0.5), Math.abs(dm - 0.2), dm < 0.06 ? 0 : 1);
      const r = rect(x + g / 2, y + g / 2, bw - g, bh - g);
      if (v < band) A += r; else B += r;
    }
    return { stages: [`<path d="${B}"${paint(p.brick || ctx.slot + "/0.5")}/><path d="${A}"${paint(p.pattern || "c")}/>`] };
  },

  // herringbone of 2:1 blocks laid at 45 degrees (opus spicatum, parquet), so the zigzag runs across the field; one horizontal-step period
  // holds one block of each direction, which makes the lattice rectangular and lets a square cell wrap
  herringbone(p, ctx) {
    const B = Math.max(1, Math.round(p.scale ?? 1)), A = 2 * B, u = ctx.w / (Math.SQRT2 * A), g = p.mortar ?? 1, ky = ctx.h / ctx.w;
    const sx = Math.SQRT2 * u, sy = 2 * Math.SQRT2 * u * ky, R = ([x, y]) => [((x + y) * u) / Math.SQRT2, (((y - x) * u) / Math.SQRT2) * ky];
    ctx.grid = { x: 0, y: 0, px: 2 * sx, py: sy };
    const blk = (x0, y0, w, h) => { const e = g / (2 * u); return "M" + [[x0 + e, y0 + e], [x0 + w - e, y0 + e], [x0 + w - e, y0 + h - e], [x0 + e, y0 + h - e]].map(R).map((q) => f(q[0]) + " " + f(q[1])).join("L") + "Z"; };
    const h0 = blk(0, 0, 2, 1), v0 = blk(2, -1, 1, 2);
    let H = "", V = "";
    for (let i = 0; i < A; i++) for (let j = 0; j < B; j++) { const t = `translate(${f(i * sx)} ${f(j * sy)})`; H += `<path d="${h0}" transform="${t}"/>`; V += `<path d="${v0}" transform="${t}"/>`; }
    return { stages: [`<g${paint(p.across || ctx.slot)}>${H}</g><g${paint(p.down || "c/0.8")}>${V}</g>`] };
  },


  // glazed tiles in running bond with grout; a soft highlight along each tile's top edge reads as the glaze bevel
  subway(p, ctx) {
    const rows = Math.max(2, 2 * Math.round((p.rows ?? 8) / 2)), th = ctx.h / rows, cols = Math.max(1, Math.round(p.cols ?? 4)), tw = ctx.w / cols, g = p.grout ?? 1.2;
    ctx.grid = { x: tw / 2, y: th / 2, px: tw, py: 2 * th };
    let t = "", hl = "";
    for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) { const x = i * tw + (j % 2 ? tw / 2 : 0); t += rect(x + g / 2, j * th + g / 2, tw - g, th - g); hl += rect(x + g / 2 + th * 0.15, j * th + g / 2 + th * 0.12, tw - g - th * 0.3, th * 0.12); }
    return { stages: [`<path d="${t}"${paint(p.tile || ctx.slot)}/><path d="${hl}"${paint(p.glaze || "c/0.35")}/>`] };
  },
};

export default function brick(p, ctx) {
  const m = M[p.motif];
  if (!m) throw new Error(`brick: unknown motif "${p.motif}"`);
  return m(p, ctx);
}
