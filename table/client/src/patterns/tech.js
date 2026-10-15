// Tech: PCB trace bundles with rounded 45-degree jogs, isometric cubes, and (round 5, reworked to be calm and connected) circuit buses with pads,
// a honeycomb display in a fixed three-colouring, scan rows on rails.
import { S3, f, add, sub, mul, poly, circ, reg, lattice, stamp, paint, stroke } from "./engine.js";

const M = {
  // traces: bundles of parallel copper traces that run across the board and jog up and back with rounded 45-degree bends;
  // every trace wraps the cell, so the board is one network. Vias sit on some traces between the jogs.
  traces(p, ctx) {
    const rows = Math.max(1, Math.round(p.rows ?? 2)), m = Math.max(2, Math.min(5, Math.round(p.lines ?? 3))), sy = ctx.h / rows, gap = sy / (m + 1) * (p.pitch ?? 0.95), R = ctx.rng;
    const n = Math.max(1, Math.round(p.scale || 1)), px = ctx.w / n, jog = Math.min(sy * 0.45, (p.jog ?? 0.25) * sy, px * 0.28); // the fall must end before the period does (0.68 px + jog < px)
    ctx.grid = { x: px / 2, y: sy / 2, px, py: sy };
    // centre line of a bundle in one period: flat, rise 45 degrees, flat, fall, flat
    const c = (x0, y0, up) => { const a = px * 0.18, s = up ? -1 : 1; return [[x0, y0], [x0 + a, y0], [x0 + a + jog, y0 + s * jog], [x0 + px / 2 + a, y0 + s * jog], [x0 + px / 2 + a + jog, y0], [x0 + px, y0]]; };
    // offset a polyline sideways by o (miter joins), then round its inner corners
    const off = (P, o) => P.map((q, i) => {
      const nrm = (A, B) => { const d = sub(B, A), L = Math.hypot(d[0], d[1]); return [-d[1] / L * o, d[0] / L * o]; };
      if (i === 0) return add(q, nrm(q, P[1])); if (i === P.length - 1) return add(q, nrm(P[i - 1], q));
      const n1 = nrm(P[i - 1], q), n2 = nrm(q, P[i + 1]), m2 = add(n1, n2), k = (o * o) / (m2[0] * n1[0] + m2[1] * n1[1] || 1);
      return add(q, mul(m2, k));
    });
    // a corner point moved toward a neighbour; an inner offset can shrink a segment to nothing (0 / 0 drew NaN)
    const rr = p.round ?? 0.6, toward = (Q, N) => { const v = sub(N, Q), L = Math.hypot(...v); return L ? add(Q, mul(v, Math.min(rr * jog, L / 2) / L)) : Q; };
    const path = (P) => { let d = `M${f(P[0][0] - 0.5)} ${f(P[0][1])}`; for (let i = 1; i < P.length - 1; i++) { const A = toward(P[i], P[i - 1]), B = toward(P[i], P[i + 1]); d += `L${f(A[0])} ${f(A[1])}Q${f(P[i][0])} ${f(P[i][1])} ${f(B[0])} ${f(B[1])}`; } return d + `L${f(P.at(-1)[0] + 0.5)} ${f(P.at(-1)[1])}`; };
    let d = "", vias = "", holes = "";
    for (let j = 0; j < rows; j++) for (let i = 0; i < n; i++) {
      const C = c(i * px, (j + 0.5) * sy + jog / 2, true); // every bundle jogs the same way, so the spacing between bundles stays even
      for (let t = 0; t < m; t++) { const P = off(C, (t - (m - 1) / 2) * gap); d += path(P); if (R() < (p.vias ?? 0.35)) { const q = add(P[2], mul(sub(P[3], P[2]), 0.25 + (0.5 * t) / (m - 1))); vias += circ(q[0], q[1], gap * 0.42); holes += circ(q[0], q[1], gap * 0.18); } }
    }
    const sw = Math.min(gap * 0.55, p.stroke ?? 2.6);
    return { stages: [`<path d="${d}" ${stroke(p.line || ctx.slot, sw, ' stroke-linecap="round"')}/>`, vias ? `<path d="${vias}"${paint(p.viaSlot || "c")}/><path d="${holes}"${paint("b")}/>` : ""] };
  },

  // tumbling blocks: each hexagon split into three rhombi
  cubes(p, ctx) {
    const L = lattice(ctx, p.scale || 3, true), R = L.sx / S3, id = ctx.id, V = reg(6, R, 30).map((v) => [v[0], v[1] * L.ky]);
    const o = [0, 0], top = poly([o, V[3], V[4], V[5]]), left = poly([o, V[1], V[2], V[3]]), right = poly([o, V[5], V[0], V[1]]);
    let u = `<path d="${top}"${paint(p.top || ctx.slot)}/><path d="${left}"${paint(p.left || "c")}/><path d="${right}"${paint(p.right || "b")}/>`;
    if (p.stroke) u += `<path d="${top + left + right}" ${stroke(p.line || "b", p.stroke, ' stroke-linejoin="round"')}/>`;
    if (p.inset) u += `<path d="${poly([o, V[3], V[4], V[5]].map((q) => add(mul(q, p.inset), mul(V[4], (1 - p.inset) * 0.5))))}"${paint(p.insetSlot || "c")}/>`;
    return { defs: `<g id="${id}U">${u}</g>`, stages: [stamp(id + "U", L.pts)] };
  },
  // circuit: horizontal buses of parallel traces; at a fixed rhythm the outer traces branch off with rounded 45-degree bends to round pads
  // (one up, one down per period, staggered against the next bus), so every pad hangs on a bus that wraps the board
  circuit(p, ctx) {
    const n = Math.max(1, Math.round(p.scale ?? 2)), px = ctx.w / n, rows = Math.max(1, Math.round((n * ctx.h) / ctx.w * (p.rowsPer ?? 1))), py = ctx.h / rows, id = ctx.id;
    const m = Math.max(2, Math.min(4, Math.round(p.lines ?? 3))), g = py * (p.pitch ?? 0.075), sw = Math.min(g * 0.6, p.stroke ?? 2), pr = py * (p.pad ?? 0.075), rr = py * 0.06;
    ctx.grid = { x: px / 2, y: py / 2, px, py };
    const y0 = -((m - 1) / 2) * g, y1 = ((m - 1) / 2) * g, run = py * 0.2, rise = py * 0.32;
    // stub from bus line y at x leaving up (dir -1) or down (+1): rounded corner, 45-degree run, rounded turn to vertical, pad
    const stub = (x, y, dir) => { const a = run, e = [x + a, y + dir * a], end = [x + a, y + dir * rise]; return `M${f(x - rr)} ${f(y)}Q${f(x)} ${f(y)} ${f(x + rr * 0.7)} ${f(y + dir * rr * 0.7)}L${f(e[0] - rr * 0.4)} ${f(e[1] - dir * rr * 0.4)}Q${f(e[0])} ${f(e[1])} ${f(e[0])} ${f(e[1] + dir * rr)}L${f(end[0])} ${f(end[1])}`; };
    const xa = -px / 2 + px * 0.1, xb = px * 0.1, endA = [xa + run, y0 - rise], endB = [xb + run, y1 + rise];
    let lines = ""; for (let t = 0; t < m; t++) lines += `M${f(-px / 2 - 0.5)} ${f(y0 + t * g)}h${f(px + 1)}`;
    const u = `<path d="${lines + stub(xa, y0, -1) + stub(xb, y1, 1)}" ${stroke(p.line || ctx.slot, sw, ' stroke-linecap="round" stroke-linejoin="round"')}/>`
      + `<path d="${circ(endA[0], endA[1], pr) + circ(endB[0], endB[1], pr)}"${paint(p.padSlot || "c")}/><path d="${circ(endA[0], endA[1], pr * 0.42) + circ(endB[0], endB[1], pr * 0.42)}"${paint(p.holeSlot || "b")}/>`
      + ((p.vias ?? true) && m > 2 ? `<path d="${circ(px * 0.35, 0, g * 0.42)}"${paint(p.viaSlot || "c/0.8")}/>` : "");
    const pts = []; for (let i = 0; i < n; i++) for (let j = 0; j < rows; j++) pts.push([(i + 0.5) * px, (j + 0.5) * py]);
    return { defs: `<g id="${id}U">${u}</g>`, stages: [stamp(id + "U", pts)] };
  },

  // honeycomb display: every cell outlined; lit, ringed and dark cells in the fixed three-colouring of the hexagonal lattice (calm, no noise)
  hexcells(p, ctx) {
    const n = 3 * Math.max(1, Math.round((p.scale ?? 3) / 3)), L = lattice(ctx, n, true), d = L.sx, ky = L.ky, id = ctx.id, gap = p.gap ?? 1.2, R = d / Math.sqrt(3) - gap / Math.sqrt(3);
    const hx = (r) => poly(reg(6, r, 30).map((v) => [v[0], v[1] * ky]));
    const cls = [[], [], []];
    L.pts.forEach((q, k) => { const j = Math.round(q[1] / L.sy), i = Math.round((q[0] - (j % 2 ? d / 2 : 0)) / d), qa = i - (j - (j & 1)) / 2; cls[(((qa - j) % 3) + 3) % 3].push(q); });
    const defs = `<path id="${id}H" d="${hx(R)}"/><path id="${id}I" d="${hx(R * 0.62)}"/>`;
    return { defs, stages: [`<g ${stroke(p.line || ctx.slot + "/0.55", p.stroke ?? 1)}>${stamp(id + "H", L.pts)}</g><g${paint(p.litSlot || ctx.slot)}>${stamp(id + "H", cls[0])}</g>`
      + `<g ${stroke(p.ringSlot || "c/0.7", p.stroke ?? 1)}>${stamp(id + "I", cls[1])}</g>` + (p.coreSlot !== "none" ? `<g${paint(p.coreSlot || "c/0.85")}>${stamp(id + "I", cls[0])}</g>` : "")] };
  },

  // scan rows: a waveform readout; each row is a thin rail with bars standing above and below it (three fixed heights, seeded order),
  // so the row reads as one trace, not loose bars
  scan(p, ctx) {
    const rows = Math.max(2, Math.round(p.rows ?? 3)), sy = ctx.h / rows, n = Math.max(6, Math.round(p.bars ?? 10)), bx = ctx.w / n, Rn = ctx.rng;
    ctx.grid = { x: ctx.w / 2, y: sy / 2, px: ctx.w / Math.max(1, Math.round(p.scale ?? 2)), py: sy };
    const H = [0.58, 0.74, 0.9].map((k) => (k * sy) / 2), bw = bx * (p.width ?? 0.5);
    let rail = "", a = "", c = "";
    for (let j = 0; j < rows; j++) {
      const y = (j + 0.5) * sy;
      rail += `M0 ${f(y)}h${f(ctx.w)}`;
      for (let i = 0; i < n; i++) { const h = H[Math.floor(Rn() * 3)], b = `M${f(i * bx + (bx - bw) / 2)} ${f(y - h)}h${f(bw)}v${f(2 * h)}h${f(-bw)}z`; Rn() < (p.accent ?? 0.15) ? (c += b) : (a += b); }
    }
    return { stages: [`<path d="${rail}" ${stroke(p.railSlot || ctx.slot, p.rail ?? 1.6)}/><path d="${a}"${paint(p.line || ctx.slot)}/><path d="${c}"${paint(p.accentSlot || "c")}/>`] };
  },
};

export default function tech(p, ctx) {
  const m = M[p.motif];
  if (!m) throw new Error(`tech: unknown motif "${p.motif}"`);
  return m(p, ctx);
}
tech.cell = (p) => (p.motif === "hexcells" ? "hex" : undefined);
