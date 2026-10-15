// Steppe felt and wood: ram's-horn scrolls (koshkar muiz) of Kazakh and Kyrgyz felts, carvings and Mongolian ornament.
import { f, lattice, stamp, stroke } from "./engine.js";
import { spiral } from "./organic.js";

const M = {
  // ram's horns: a stem runs down every column; at each node a pair of horns springs from it and curls down; a smaller pair curls up below
  horn(p, ctx) {
    const L = lattice(ctx, p.scale || 2, false), id = ctx.id, s = L.sx, ky = L.ky, h = s / 2, r0 = s * (p.curl ?? 0.14), dec = p.decay ?? 0.58, tu = p.turns ?? 1.25, sw = s * (p.width ?? 0.06);
    // each horn sweeps out from the stem to its shoulder, then curls outward, down and back in; down = horns open downward
    const horn = (y, sg, down, r) => { const v = down ? 1 : -1, Q = [sg * s * 0.3, y - v * s * 0.1], c = [sg * s * 0.12, y - v * s * 0.22], t = [sg, v]; return `M0 ${f(y)}Q${f(c[0])} ${f(c[1])} ${f(Q[0])} ${f(Q[1])}` + spiral(Q, t, r, down ? sg : -sg, dec, tu).d.replace(/^M[^A]*/, ""); };
    let d = `M0 ${f(-h)}V${f(h)}` + horn(-s * 0.06, 1, true, r0) + horn(-s * 0.06, -1, true, r0);
    if (p.second !== false) d += horn(s * 0.3, 1, false, r0 * 0.7) + horn(s * 0.3, -1, false, r0 * 0.7);
    const t = ky !== 1 ? ` transform="scale(1 ${f(ky * 1000) / 1000})"` : "";
    return { defs: `<g id="${id}U"${t}>${p.outline ? `<path d="${d}" ${stroke(p.edge || "c", sw + 2 * p.outline, ' stroke-linecap="round"')}/>` : ""}<path d="${d}" ${stroke(p.line || ctx.slot, sw, ' stroke-linecap="round"')}/></g>`, stages: [stamp(id + "U", L.pts)] };
  },
};

export default function steppe(p, ctx) {
  const m = M[p.motif];
  if (!m) throw new Error(`steppe: unknown motif "${p.motif}"`);
  return m(p, ctx);
}
