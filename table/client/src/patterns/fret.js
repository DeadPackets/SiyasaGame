// Fret and knot: Greek key meander, Chinese thunder fret (leiwen, spirals hung from a rail), Celtic knotwork with true over-under.
import { f, poly, lattice, stamp, paint, stroke } from "./engine.js";

const M = {
  // Greek key: a square spiral on a running baseline, 8 x 8 grid units per key; rows may alternate direction
  meander(p, ctx) {
    const n = p.scale || 2, U = ctx.w / n / 8, rows = Math.max(1, Math.round(ctx.h / (8 * U))), V = ctx.h / rows / 8, id = ctx.id;
    ctx.grid = { x: 4 * U, y: 4 * V, px: 8 * U, py: (p.alt ? 16 : 8) * V };
    const key = [[0.5, 7.5], [0.5, 0.5], [6.5, 0.5], [6.5, 4.5], [2.5, 4.5], [2.5, 2.5], [4.5, 2.5]];
    const k = (mir) => { const P = key.map(([x, y]) => [(mir ? 8 - x : x) * U, y * V]); return poly(P, false) + poly([P[0], [mir ? -0.5 * U : 8.5 * U, 7.5 * V]], false); };
    const sw = (p.stroke ?? 0.9) * Math.min(U, V), cap = ' stroke-linecap="square"';
    let defs = `<path id="${id}A" d="${k(false)}"/><path id="${id}B" d="${k(true)}"/>`, s = "";
    const pts = (odd) => { const o = []; for (let j = 0; j < rows; j++) if (!p.alt || j % 2 === odd) for (let i = 0; i < n; i++) o.push([i * 8 * U, j * 8 * V]); return o; };
    const ln = (slot, w) => `<g ${stroke(slot, w, cap)}>${stamp(id + "A", pts(0))}${p.alt ? stamp(id + "B", pts(1)) : ""}</g>`;
    if (p.dot) { defs += `<path id="${id}D" d="M${f(4.5 * U)} ${f(6 * V)}h.01"/>`; s = `<g ${stroke(p.dotSlot || "c", p.dot, ' stroke-linecap="round"')}>${stamp(id + "D", pts(0))}</g>`; }
    return { defs, stages: [p.outline ? ln(p.edge || "c", sw + 2 * p.outline) : "", ln(p.line || ctx.slot, sw), s] };
  },

  // thunder fret: square spirals in a checkerboard of turning directions, optionally boxed
  leiwen(p, ctx) {
    const L = lattice(ctx, Math.max(2, 2 * Math.round((p.scale || 4) / 2)), false), s = L.sx, id = ctx.id, t = p.turns ?? 3, g = s / (4 * t + 2), ky = L.ky;
    // each spiral starts from a rail along the cell's lower edge, so the spirals of a row hang from one continuous band
    const spiral = (mir) => { const P = [[s / 2, s / 2], [-s / 2, s / 2]]; let x = -s / 2 + g, y = s / 2 - g, len = s - 2 * g; const dirs = [[0, -1], [1, 0], [0, 1], [-1, 0]]; P.push([x, y]); for (let i = 0; i < 4 * t && len > 0; i++) { const [dx, dy] = dirs[i % 4]; x += dx * len; y += dy * len; P.push([x, y]); if (i % 2 === 1) len -= 2 * g; } return poly(P.map(([a, b]) => [mir ? -a : a, b * ky]), false); };
    const sw = (p.stroke ?? 0.85) * g, cap = ' stroke-linecap="square"';
    const par = (q) => (Math.floor(q[0] / s) + Math.floor(q[1] / L.sy)) % 2, pA = L.pts.filter((q) => !par(q)), pB = L.pts.filter(par);
    let defs = `<path id="${id}A" d="${spiral(false)}"/><path id="${id}B" d="${spiral(true)}"/>`, fill = "";
    if (p.box) { defs += `<path id="${id}X" d="M${f(-s / 2)} ${f((-s / 2) * ky)}h${f(s)}v${f(s * ky)}h${f(-s)}z"/>`; fill = `<g${paint(p.box)}>${stamp(id + "X", pB)}</g>`; }
    const ln = (slot, w) => `<g ${stroke(slot, w, cap)}>${stamp(id + "A", pA)}${stamp(id + "B", pB)}</g>`;
    return { defs, stages: [fill, p.outline ? ln(p.edge || "c", sw + 2 * p.outline) : "", ln(p.line || ctx.slot, sw)] };
  },

  // Celtic knotwork: a diagonal plait over a grid of sites (cell centres and corners); breaks turn the strands; every crossing alternates over-under
  knot(p, ctx) {
    const k = Math.max(2, 2 * Math.round((p.grid || 4) / 2)), s = ctx.w / k, sy = ctx.h / Math.max(2, 2 * Math.round((k * ctx.h) / ctx.w / 2)), N = 2 * k, Ny = Math.round((2 * ctx.h) / sy), R = ctx.rng;
    ctx.grid = { x: ctx.w / 2, y: ctx.h / 2, px: ctx.w, py: ctx.h };
    const q = s / 4, qy = sy / 4, dens = p.breaks ?? 0.3, pat = p.pattern || "random", type = {};
    const key = (I, J) => (((I % N) + N) % N) + "," + (((J % Ny) + Ny) % Ny);
    for (let J = 0; J < Ny; J++) for (let I = 0; I < N; I++) {
      if ((I + J) % 2) continue;
      let t = "X";
      if (pat === "random") { const r = R(); t = r < dens / 2 ? "H" : r < dens ? "V" : "X"; }
      else if (pat === "chain") t = I % 2 === 1 && (J / 1) % 4 === 1 ? "H" : "X";
      else if (pat === "rings") t = I % 2 === 0 && J % 2 === 0 ? ((I + J) % 4 === 0 ? "H" : "V") : "X";
      else if (pat === "lattice") t = I % 4 === 0 && J % 4 === 0 ? "V" : I % 4 === 2 && J % 4 === 2 ? "H" : "X";
      else if (pat === "olzii") t = I % 4 === 0 && J % 4 === 2 ? "V" : I % 4 === 2 && J % 4 === 0 ? "H" : "X"; // square knots, corners open to the diagonal neighbours
      type[key(I, J)] = t;
    }
    // random breaks: mirror the first quadrant so the knot has two mirror axes
    if (pat === "random") for (let J = 0; J < Ny; J++) for (let I = 0; I < N; I++) if ((I + J) % 2 === 0) { const mi = I <= N / 2 ? I : N - I, mj = J <= Ny / 2 ? J : Ny - J; type[key(I, J)] = type[key(mi, mj)]; }
    let under = "", over = "";
    for (let J = 0; J < Ny; J++) for (let I = 0; I < N; I++) {
      if ((I + J) % 2) continue;
      const cx = (I * s) / 2, cy = (J * sy) / 2, t = type[key(I, J)], NW = [cx - q, cy - qy], NE = [cx + q, cy - qy], SW = [cx - q, cy + qy], SE = [cx + q, cy + qy];
      const qd = (A, B) => `M${f(A[0])} ${f(A[1])}Q${f(cx)} ${f(cy)} ${f(B[0])} ${f(B[1])}`;
      if (t === "H") under += qd(NW, NE) + qd(SW, SE);
      else if (t === "V") under += qd(NW, SW) + qd(NE, SE);
      else { const a = poly([NW, SE], false), b = poly([NE, SW], false); under += a + b; over += I % 2 === 0 ? a : b; }
    }
    const sw = (p.width ?? 0.2) * s, ol = p.outline ?? 0.8, gap = p.gap ?? 1, Wb = sw + 2 * ol, id = ctx.id, line = p.line || ctx.slot, edge = p.edge || "c";
    const U = (k2, slot, wd) => `<use href="#${id}${k2}" ${stroke(slot, wd)}/>`;
    return { defs: `<path id="${id}U" d="${under}"/><path id="${id}O" d="${over}"/>`, stages: [(ol ? U("U", edge, Wb) : "") + U("U", line, sw), U("O", p.gapSlot || "b", Wb + 2 * gap) + (ol ? U("O", edge, Wb) : "") + U("O", line, sw)] };
  },
};

export default function fret(p, ctx) {
  const m = M[p.motif];
  if (!m) throw new Error(`fret: unknown motif "${p.motif}"`);
  return m(p, ctx);
}
