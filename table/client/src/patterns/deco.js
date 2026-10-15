// Deco: scallop fans (interlocking scales), stepped arcades, chevron fans, framed sunray panels, stepped ziggurat bands. Units sit on a square lattice; fans paint row by row.
import { f, add, mul, poly, circ, lattice, stamp, paint, stroke, polar } from "./engine.js";

const cyc = (a, i) => (Array.isArray(a) ? a[i % a.length] : a);
const rect = (x, y, w, h) => `M${f(x)} ${f(y)}h${f(w)}v${f(h)}h${f(-w)}z`;
// ray from c at angle a (deg) to the edge of the box [x0,x1] x [y0,y1]
function toBox(c, a, x0, y0, x1, y1) {
  const u = polar(1, a), ts = [];
  if (u[0] > 1e-9) ts.push((x1 - c[0]) / u[0]); if (u[0] < -1e-9) ts.push((x0 - c[0]) / u[0]);
  if (u[1] > 1e-9) ts.push((y1 - c[1]) / u[1]); if (u[1] < -1e-9) ts.push((y0 - c[1]) / u[1]);
  return add(c, mul(u, Math.min(...ts)));
}
// alternate wedges from c between angles a0..a1 (deg), clipped to box [x0,y0,x1,y1]; taper = share of each step filled
function wedges(c, a0, a1, n, box, taper = 1) {
  const K = [[box[0], box[1]], [box[2], box[1]], [box[2], box[3]], [box[0], box[3]]], ang = (q) => (Math.atan2(q[1] - c[1], q[0] - c[0]) * 180) / Math.PI;
  let d = "";
  for (let i = 0; i < n; i++) {
    const s = a0 + ((a1 - a0) * i) / n, e = s + ((a1 - a0) / n) * taper, rel = (q) => (((ang(q) - s) % 360) + 360) % 360;
    d += poly([c, toBox(c, s, ...box), ...K.filter((q) => rel(q) > 1e-6 && rel(q) < e - s).sort((q, r) => rel(q) - rel(r)), toBox(c, e, ...box)]);
  }
  return d;
}

const M = {
  // overlapping scallop fans with ribs and arcs, painted top row first so each row covers the one behind
  fan(p, ctx) {
    const n = p.scale || 3, R = ctx.w / n / 2, id = ctx.id;
    const rows = 2 * Math.max(1, Math.round(ctx.h / (R * Math.min(0.7, p.step ?? 0.5)) / 2)), sy = ctx.h / rows;
    ctx.grid = { x: 0, y: -sy, px: 2 * R, py: 2 * sy };
    const k = p.rings ?? 3, seq = p.seq || ["b", ctx.slot], ribs = p.ribs ?? 12, rs = p.ribSlot || ctx.slot, ow = p.outline ?? 1.2;
    let u = `<path d="${circ(0, 0, R)}"${paint(cyc(seq, 0))}/>`;
    for (let i = 1; i <= k; i++) u += `<path d="${circ(0, 0, R * (1 - (i * (1 - (p.core ?? 0.22))) / (k + 1)))}"${paint(cyc(seq, i))}/>`;
    if (ribs) u += `<path d="${Array.from({ length: ribs + 1 }, (_, i) => poly([polar(R * (p.core ?? 0.22), 180 + (180 * i) / ribs), polar(R * 0.97, 180 + (180 * i) / ribs)], false)).join("")}" ${stroke(rs, p.ribWidth ?? 0.9)}/>`;
    u += `<path d="${circ(0, 0, R * (p.core ?? 0.22))}"${paint(p.coreSlot || "c")}/>`;
    if (ow) u += `<path d="${circ(0, 0, R - ow / 2)}" ${stroke(p.edge || "c", ow)}/>`;
    const H = ctx.h * ctx.span, Wd = ctx.w * ctx.span, xs = [];
    for (let i = -1; i * 2 * R <= Wd + R + 0.5; i++) xs.push([i * 2 * R, 0]);
    let rr = "";
    for (let j = -2; j * sy <= H + R + 0.5; j++) rr += `<use href="#${id}${((j % 2) + 2) % 2 ? "O" : "E"}" y="${f(j * sy)}"/>`;
    return { self: true, defs: `<g id="${id}U">${u}</g><g id="${id}E">${stamp(id + "U", xs)}</g><g id="${id}O" transform="translate(${f(R)} 0)"><use href="#${id}E"/></g>`, stages: [rr] };
  },

  // stepped arches: nested round-headed arches (an arcade), optional keystone and column bands
  arch(p, ctx) {
    const L = lattice(ctx, p.scale || 2, false), sx = L.sx, sy = L.sy, id = ctx.id, k = p.nest ?? 4, seq = p.seq || [ctx.slot, "b"], st = (p.step ?? 0.11) * sx, sill = p.sill || ctx.slot; // the sill joins the arcade into one band
    const one = (hw, top, bot) => { const r = hw; return `M${f(-hw)} ${f(bot)}V${f(top + r)}A${f(r)} ${f(r)} 0 0 1 ${f(hw)} ${f(top + r)}V${f(bot)}Z`; };
    let u = "";
    for (let i = 0; i < k; i++) { const hw = sx / 2 - (p.pier ?? 0.06) * sx - i * st; if (hw <= 1) break; u += `<path d="${one(hw, -sy / 2 + (p.rise ?? 0.08) * sy + i * st, sy / 2)}"${paint(cyc(seq, i))}/>`; }
    if (p.key) u += `<path d="${poly([[0, -sy / 2], [sx * 0.06, -sy / 2 + sx * 0.1], [-sx * 0.06, -sy / 2 + sx * 0.1]])}"${paint(p.key)}/>`;
    u += `<path d="${rect(-sx / 2, sy / 2 - sy * 0.08, sx, sy * 0.08)}"${paint(sill)}/>`;
    const hi = Math.max(2, sx / 2 - (p.pier ?? 0.06) * sx - (k - 1) * st);
    if (p.rays) u += `<path d="${wedges([0, sy / 2], 180, 360, p.rays, [-hi * 0.8, -sy / 2 + (p.rise ?? 0.08) * sy + (k - 1) * st + hi * 0.25, hi * 0.8, sy / 2], 0.5)}"${paint(p.raySlot || "c")}/>`;
    const pts = p.offset ? L.pts.map((q) => [q[0] + (Math.floor(q[1] / sy) % 2 ? sx / 2 : 0), q[1]]) : L.pts;
    return { defs: `<g id="${id}U">${u}</g>`, stages: [stamp(id + "U", pts)] };
  },

  // chevron fans: continuous zigzag bands (they run unbroken across every cell edge); a fan of rays rises from each apex to the band above,
  // its outer rays landing on the valleys of that band, so neighbouring fans meet there and nothing is clipped at a cell edge
  chevron(p, ctx) {
    const L = lattice(ctx, p.scale || 2, false), sx = L.sx, sy = L.sy, id = ctx.id, k = Math.max(2, Math.min(3, Math.round(p.bands ?? 2))), seq = p.seq || [ctx.slot, "c"], bw = (p.band ?? 0.08) * sy, dep = Math.min(0.45, p.depth ?? 0.25) * sy;
    let u = "", v = "";
    for (let i = 0; i < k; i++) {
      // each band runs a little past both cell edges, so neighbours overlap instead of meeting on an antialiased seam
      const y = sy / 2 - i * bw * 2, V = (yy) => [[-sx * 0.6, yy - dep * 0.2], [-sx / 2, yy], [0, yy - dep], [sx / 2, yy], [sx * 0.6, yy - dep * 0.2]];
      u += `<path d="${poly([...V(y), ...V(y - bw).reverse()])}"${paint(cyc(seq, i))}/>`;
    }
    const apex = [0, sy / 2 - (2 * k - 1) * bw - dep], top = [[-sx / 2, -sy / 2], [0, -sy / 2 - dep], [sx / 2, -sy / 2]]; // the lowest edge of the band above
    const hit = (a) => { const u0 = polar(1, a); for (const [A, B] of [[top[0], top[1]], [top[1], top[2]]]) { const d = [B[0] - A[0], B[1] - A[1]], cr = u0[0] * d[1] - u0[1] * d[0], w = [A[0] - apex[0], A[1] - apex[1]], t = (w[0] * d[1] - w[1] * d[0]) / cr, s2 = (w[0] * u0[1] - w[1] * u0[0]) / cr; if (t > 0 && s2 >= -1e-6 && s2 <= 1 + 1e-6) return add(apex, mul(u0, t)); } return top[1]; };
    const ang = (q) => (Math.atan2(q[1] - apex[1], q[0] - apex[0]) * 180) / Math.PI, a0 = ang(top[0]), a1 = ang(top[2]) + 360 * (ang(top[2]) < a0 ? 1 : 0), fan = Math.max(7, Math.round(p.fan ?? 11)), st = (a1 - a0) / fan;
    for (let i = 0; i < fan; i++) { const s0 = a0 + i * st, s1 = s0 + st * 0.5, pk = s0 < -90 && s1 > -90 ? [top[1]] : []; v += poly([apex, hit(s0), ...pk, hit(s1)]); }
    if (fan) v = `<path d="${v}"${paint(p.fanSlot || "a/0.55")}/>`;
    if (p.dot) u += `<path d="${circ(apex[0], apex[1] - p.dot * 1.8, p.dot)}"${paint(p.dotSlot || "c")}/>`;
    return { defs: `<g id="${id}U">${u}</g><g id="${id}F">${v}</g>`, stages: [stamp(id + "F", L.pts), stamp(id + "U", L.pts)] };
  },

  // sunray panels: each cell is a framed panel with a sun whose rays run to the frame (the frame stops them, so no ray meets a neighbour's);
  // rise: the sun sits on the panel's sill (a rising sun) instead of its centre; brick: alternate rows shift half a panel
  sunburst(p, ctx) {
    const L = lattice(ctx, p.brick ? 2 * Math.ceil((p.scale || 2) / 2) : p.scale || 2, false), sx = L.sx, sy = L.sy, id = ctx.id, rise = !!p.rise, fw = (p.frame ?? 0.035) * sx, n = Math.max(8, Math.min(32, Math.round(p.rays ?? 16)));
    const c = rise ? [0, sy / 2 - fw / 2] : [0, 0], box = [-sx / 2, -sy / 2, sx / 2, sy / 2], R = Math.min(sx, sy) * (p.sun ?? 0.16);
    let u = `<path d="${wedges(c, rise ? 180 : -90, rise ? 360 : 270, rise ? Math.ceil(n / 2) : n, box, 0.5)}"${paint(p.ray || ctx.slot)}/>`;
    const k = Math.max(0, Math.min(3, Math.round(p.rings ?? 2))), seq = p.seq || ["b", "c"];
    // a rising sun is a half disc on the sill: a full disc would spill into the panel below and be cut by it
    const disc = (r) => (rise ? `M${f(c[0] - r)} ${f(c[1])}A${f(r)} ${f(r)} 0 0 1 ${f(c[0] + r)} ${f(c[1])}Z` : circ(c[0], c[1], r));
    for (let i = 0; i < k; i++) { const r = R * (1 + 0.45 * (k - i)); u += `<path d="${disc(r)}"${paint(cyc(seq, i))}/>`; }
    u += `<path d="${disc(R)}"${paint(p.sunSlot || "c")}/>`;
    u += `<path d="${rect(-sx / 2, -sy / 2, sx, sy)}" ${stroke(p.frameSlot || ctx.slot, fw)}/>`;
    const pts = p.brick ? L.pts.map((q) => [q[0] + (Math.round((q[1] - sy / 2) / sy) % 2 ? sx / 2 : 0), q[1]]) : L.pts;
    return { defs: `<g id="${id}U">${u}</g>`, stages: [stamp(id + "U", pts)] };
  },

  // ziggurat: stepped chevron bands that fill the whole field (no plain ground between rows); colours cycle through seq
  ziggurat(p, ctx) {
    const L = lattice(ctx, p.scale || 2, false), sx = L.sx, sy = L.sy, id = ctx.id, s = Math.max(2, Math.min(5, Math.round(p.steps ?? 3))), nb = Math.max(2, Math.min(6, Math.round(p.bands ?? 4)));
    const seq = p.seq || [ctx.slot, "b", "c/0.7", "b"], u0 = sx / (2 * s + 2), hs = (p.depth ?? 0.5) * sy / s, bh = sy / nb;
    const prof = (y0) => { const P = [[-sx / 2 - u0, y0]]; for (let i = 0; i <= s; i++) P.push([-sx / 2 + i * u0, y0 - i * hs], [-sx / 2 + (i + 1) * u0, y0 - i * hs]); return P.concat(P.slice(0, -1).reverse().map(([x, y]) => [-x, y])); };
    let u = "";
    for (let i = 0; i < nb; i++) { const y = sy / 2 + s * hs / 2 - i * bh; u += `<path d="${poly([...prof(y), ...prof(y - bh).reverse()])}"${paint(cyc(seq, i))}/>`; }
    if (p.line) u += `<path d="${Array.from({ length: nb }, (_, i) => poly(prof(sy / 2 + s * hs / 2 - i * bh), false)).join("")}" ${stroke(p.line, p.lineWidth ?? 0.8, ' stroke-linejoin="miter"')}/>`;
    return { defs: `<g id="${id}U">${u}</g>`, stages: [stamp(id + "U", L.pts)] };
  },
};

export default function deco(p, ctx) {
  const m = M[p.motif];
  if (!m) throw new Error(`deco: unknown motif "${p.motif}"`);
  return m(p, ctx);
}
