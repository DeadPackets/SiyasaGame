// Ancient: intersecting circles (Indus / flower of life), Mesoamerican step-fret, Andean tocapu blocks, the Aegean running spiral (round 5: every spiral joined to the next).
import { f, add, sub, mul, len, poly, circ, lattice, stamp, paint, stroke } from "./engine.js";

const M = {
  // circles on a checker (square) or hex lattice; radius = k x nearest-neighbour distance (0.71 = seven treasures, 1 = through the neighbours' centres)
  circles(p, ctx) {
    const hex = p.lattice === "hex", L = lattice(ctx, p.scale || 3, hex), id = ctx.id, s = L.sx, ky = L.ky;
    const pts = hex ? L.pts : L.pts.flatMap((q) => [q, [q[0] + s / 2, q[1] + L.sy / 2]]);
    const nbs = hex ? [[s, 0], [s / 2, L.sy], [-s / 2, L.sy]] : [[s / 2, L.sy / 2], [-s / 2, L.sy / 2]], r = (hex ? s : s / Math.SQRT2) * (p.radius ?? 1); // the rings are always drawn: they make the network
    const lens = (b) => { const bb = [b[0], b[1] / ky], D = len(bb); if (D >= 2 * r) return ""; const m = mul(bb, 0.5), hh = Math.sqrt(r * r - (D / 2) ** 2), nn = mul([-bb[1], bb[0]], hh / D), p1 = add(m, nn), p2 = sub(m, nn); return `M${f(p1[0])} ${f(p1[1] * ky)}A${f(r)} ${f(r * ky)} 0 0 1 ${f(p2[0])} ${f(p2[1] * ky)}A${f(r)} ${f(r * ky)} 0 0 1 ${f(p1[0])} ${f(p1[1] * ky)}Z`; };
    // discs overlap their neighbours, so all of them go down before any petal (stamped together, a later disc hid the earlier petals)
    const dk = p.disc ? `<path id="${id}D" d="M${f(-r)} 0a${f(r)} ${f(r * ky)} 0 1 0 ${f(2 * r)} 0a${f(r)} ${f(r * ky)} 0 1 0 ${f(-2 * r)} 0"${paint(p.disc)}/>` : "";
    const u = `<path d="${nbs.map(lens).join("")}"${paint(p.petal || ctx.slot)}/>`;
    const ring = `M${f(-r)} 0a${f(r)} ${f(r * ky)} 0 1 0 ${f(2 * r)} 0a${f(r)} ${f(r * ky)} 0 1 0 ${f(-2 * r)} 0`;
    let top = `<g ${stroke(p.line && p.line !== "none" ? p.line : "c", Math.max(0.6, p.stroke ?? 1.1))}>${stamp(id + "C", pts)}</g>`;
    if (p.dot) top += `<path d="${pts.map((q) => circ(q[0], q[1], p.dot)).join("")}"${paint(p.dotSlot || "c")}/>`;
    if (p.ring) top += `<path d="${pts.map((q) => circ(q[0], q[1], r * p.ring)).join("")}" ${stroke(p.ringSlot || "c", 0.8)}/>`;
    return { defs: `${dk}<g id="${id}U">${u}</g><path id="${id}C" d="${ring}"/>`, stages: [dk ? stamp(id + "D", pts) : "", stamp(id + "U", pts), top] }; // own stage: every tile copy of a stage draws before the next stage
  },

  // step-fret (xicalcoliuhqui): stairs rise to a square hook; alternate rows turn 180 degrees
  stepfret(p, ctx) {
    const n = p.scale || 3, U = ctx.w / n / 10, rows = Math.max(1, Math.round(ctx.h / (10 * U))), V = ctx.h / rows / 10, id = ctx.id;
    const A = [[0.5, 9.5], [2.5, 9.5], [2.5, 7.5], [4.5, 7.5], [4.5, 0.5], [9.5, 0.5], [9.5, 5.5], [6.5, 5.5], [6.5, 2.5], [7.5, 2.5]];
    const sw = (p.stroke ?? 0.95) * Math.min(U, V), cap = ' stroke-linecap="square"';
    ctx.grid = { x: 5 * U, y: 5 * V, px: 10 * U, py: (p.alt ? 20 : 10) * V };
    // the baseline runs on to the next key (as in the meander), so each row is one band
    const d = (r) => poly([[10.5, 9.5], ...A].map(([x, y]) => (r ? [10 - x, 10 - y] : [x, y])).map(([x, y]) => [x * U, y * V]), false);
    const pts = (odd) => { const o = []; for (let j = 0; j < rows; j++) if (!p.alt || j % 2 === odd) for (let i = 0; i < n; i++) o.push([i * 10 * U, j * 10 * V]); return o; };
    let fill = "";
    if (p.block) fill = `<path d="${pts(0).concat(p.alt ? pts(1) : []).map(([x, y]) => `M${f(x + 5.5 * U)} ${f(y + 1.5 * V)}h${f(3 * U)}v${f(3 * V)}h${f(-3 * U)}z`).join("")}"${paint(p.block)}/>`;
    const ln = (slot, w) => `<g ${stroke(slot, w, cap)}>${stamp(id + "A", pts(0))}${p.alt ? stamp(id + "B", pts(1)) : ""}</g>`;
    return { defs: `<path id="${id}A" d="${d(false)}"/><path id="${id}B" d="${d(true)}"/>`, stages: [fill, p.outline ? ln(p.edge || "c", sw + 2 * p.outline) : "", ln(p.line || ctx.slot, sw)] };
  },

  // tocapu (Inca tunics): a grid of square blocks, two ground tones in a checker, each block carrying one of four stepped glyphs
  tocapu(p, ctx) {
    const n = Math.max(2, Math.round(p.scale ?? 2)), s = ctx.w / n, ny = Math.max(2, Math.round((n * ctx.h) / ctx.w)), sy = ctx.h / ny, g = p.grout ?? 1, u = Math.min(s, sy) / 8;
    ctx.grid = { x: s / 2, y: sy / 2, px: s, py: sy };
    const R = (x, y, w, h) => `M${f(x)} ${f(y)}h${f(w)}v${f(h)}h${f(-w)}z`;
    const G = [
      (x, y) => R(x - u, y - 3 * u, 2 * u, 6 * u) + R(x - 3 * u, y - u, 6 * u, 2 * u) + R(x - 2 * u, y - 2 * u, 4 * u, 4 * u), // stepped cross
      (x, y) => [-2, 0, 2].flatMap((i) => [-2, 0, 2].filter((j) => (i + j) % 4 === 0).map((j) => R(x + (i - 1) * u, y + (j - 1) * u, 2 * u, 2 * u))).join(""), // checker
      (x, y) => R(x - 3 * u, y - 3 * u, 2 * u, 6 * u) + R(x - 3 * u, y + u, 6 * u, 2 * u) + R(x + u, y - 3 * u, 2 * u, 2 * u), // key
      (x, y) => R(x - 3 * u, y + u, 2 * u, 2 * u) + R(x - u, y - u, 2 * u, 4 * u) + R(x + u, y - 3 * u, 2 * u, 6 * u), // stair
    ];
    let A = "", B = "", c = "";
    for (let i = 0; i < n; i++) for (let j = 0; j < ny; j++) { const r = R(i * s + g / 2, j * sy + g / 2, s - g, sy - g); (i + j) % 2 ? (B += r) : (A += r); c += G[(i + 2 * j) % 4](i * s + s / 2, j * sy + sy / 2); }
    return { stages: [`<path d="${A}"${paint(p.block || ctx.slot)}/><path d="${B}"${paint(p.block2 || ctx.slot + "/0.6")}/><path d="${c}"${paint(p.glyph || "c")}/>`] };
  },

  // running spiral (Minoan, Mycenaean, Greek): double spirals in rows, each wound in from the top and out to the bottom, and joined to the
  // next by an S-link, so every row is one unbroken line; alternate rows shift half a spiral
  spirals(p, ctx) {
    const n = Math.max(2, Math.min(5, Math.round(p.scale ?? 3))), s = ctx.w / n, rows = 2 * Math.max(1, Math.round(ctx.h / (s * (p.rowGap ?? 0.95)) / 2)), sy = ctx.h / rows, id = ctx.id;
    const r0 = Math.min(s * 0.4, sy * 0.4), T = Math.max(1.25, Math.min(3, p.turns ?? 1.75)), N = Math.round(T * 34), sw = p.stroke ?? 2;
    ctx.grid = { x: s / 2, y: sy / 2, px: s, py: 2 * sy };
    const A = Array.from({ length: N + 1 }, (_, k) => { const t = k / N, a = (-90 + 360 * T * t) * Math.PI / 180, r = r0 * (1 - t); return [r * Math.cos(a), r * Math.sin(a)]; });
    const B = A.slice(0, -1).reverse().map(([x, y]) => [-x, y === 0 ? 0 : -y]);
    const k = s * 0.38, link = `C${f(k)} ${f(r0)} ${f(s - k)} ${f(-r0)} ${f(s)} ${f(-r0)}`;
    const d = "M" + [...A, ...B].map(([x, y]) => f(x) + " " + f(y)).join("L") + link;
    const pts = []; for (let j = 0; j < rows; j++) for (let i = 0; i < n; i++) pts.push([(i + 0.5 + (j % 2) / 2) * s, (j + 0.5) * sy]);
    const eye = (p.dot ?? 0) > 0 ? `<path d="${pts.map((q) => circ(q[0], q[1], p.dot)).join("")}"${paint(p.dotSlot || "c")}/>` : "";
    const out = p.outline ? `<g ${stroke(p.edge || "c", sw + 2 * p.outline, ' stroke-linecap="round" stroke-linejoin="round"')}>${stamp(id + "S", pts)}</g>` : "";
    return { defs: `<path id="${id}S" d="${d}"/>`, stages: [out, `<g ${stroke(p.line || ctx.slot, sw, ' stroke-linecap="round" stroke-linejoin="round"')}>${stamp(id + "S", pts)}</g>`, eye] };
  },
};

export default function ancient(p, ctx) {
  const m = M[p.motif];
  if (!m) throw new Error(`ancient: unknown motif "${p.motif}"`);
  return m(p, ctx);
}
