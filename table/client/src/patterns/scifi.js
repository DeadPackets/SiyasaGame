// Sci-fi and spaceflight: chamfered hex armour, isogrid, honeycomb core, interlaced rings, heat-shield tiles, solar cells, geodesic struts,
// orbital rings, scan graticule, Cairo pentagons. Round 4 cut the bevelled armour, greeble panels and alien cells; round 5 cut the constellation.
import { S3, f, add, sub, mul, len, poly, circ, reg, lattice, stamp, paint, stroke } from "./engine.js";

const cyc = (a, i) => (Array.isArray(a) ? a[i % a.length] : a);

// round each corner of a closed polygon with a quadratic curve that starts r before the corner (r as a share of the shorter side)
function rounded(P, r) {
  const n = P.length, cut = (i, j) => { const d = sub(P[j], P[i]), L = len(d); return add(P[i], mul(d, Math.min(r * L, L / 2) / L)); };
  let d = "";
  for (let i = 0; i < n; i++) {
    const a = cut(i, (i + n - 1) % n), b = cut(i, (i + 1) % n);
    d += (i ? "L" : "M") + f(a[0]) + " " + f(a[1]) + "Q" + f(P[i][0]) + " " + f(P[i][1]) + " " + f(b[0]) + " " + f(b[1]);
  }
  return d + "Z";
}
const shrink = (P, k) => { const c = mul(P.reduce((s, q) => add(s, q), [0, 0]), 1 / P.length); return P.map((q) => add(c, mul(sub(q, c), k))); };

const M = {
  // hex plates with fine chamfered corners; a two-tone panel line (lit on the upper edges, shaded on the lower), a fastener near every corner,
  // thin gaps between plates, optional nodes where three gaps meet
  hexarmour(p, ctx) {
    const L = lattice(ctx, p.scale || 3, true), id = ctx.id, d = L.sx, ky = L.ky, R = d / S3 - (p.gap ?? 1) / S3, ch = Math.min(0.1, p.chamfer ?? 0.08); // a deep chamfer leaves heavy dark triangles at the nodes
    const hex = reg(6, R, 30).map((v) => [v[0], v[1] * ky]);
    const cham = (H, c) => H.flatMap((v, k) => [add(v, mul(sub(H[(k + 5) % 6], v), c)), add(v, mul(sub(H[(k + 1) % 6], v), c))]);
    let u = `<path d="${poly(cham(hex, ch))}"${paint(p.plate || ctx.slot)}/>`;
    const ins = p.inset ?? 0.16;
    if (ins > 0) {
      const I = cham(shrink(hex, 1 - ins), ch * 1.4);
      let lit = "";
      I.forEach((q, k) => { const r2 = I[(k + 1) % I.length], m = mul(add(q, r2), 0.5); if (m[0] * 0.5 + m[1] < 0) lit += `M${f(q[0])} ${f(q[1])}L${f(r2[0])} ${f(r2[1])}`; });
      const lw = Math.max(0.4, Math.min(1, p.lineWidth ?? 0.7)); // a heavier panel line reads as a cartoon outline at full screen
      u += `<path d="${poly(I)}" ${stroke(p.shade || "b/0.55", lw, ' stroke-linejoin="round"')}/><path d="${lit}" ${stroke(p.line || "c/0.6", lw, ' stroke-linecap="round"')}/>`;
    }
    if (p.rivets !== false) u += `<path d="${shrink(hex, 1 - ins / 2 - 0.04).map((q) => circ(q[0], q[1], Math.max(0.55, R * 0.035))).join("")}"${paint(p.rivetSlot || "c/0.75")}/>`;
    let nodes = "";
    if (p.nodes) nodes = `<path d="${L.pts.flatMap((q) => [0, 1].map((k) => { const v = add(q, [0, (k ? 1 : -1) * (d / S3) * ky]); return circ(v[0], v[1], Math.max(0.8, R * 0.06)); })).join("")}"${paint(p.nodeSlot || "c")}/>`;
    return { defs: `<g id="${id}U">${u}</g>`, stages: [stamp(id + "U", L.pts), nodes] };
  },

  // isogrid: milled triangular pockets with filleted corners and a fine machined step inside, ribs left standing between them,
  // a boss with a fastener hole at every node
  isogrid(p, ctx) {
    const L = lattice(ctx, p.scale || 2, true), id = ctx.id, d = L.sx, h = L.sy, e1 = [d, 0], e2 = [d / 2, h];
    const rib = p.rib ?? 1.6, r0 = d / (2 * S3), k = Math.max(0.2, (r0 - rib / 2) / r0);
    const up = shrink([[0, 0], e1, e2], k), dn = shrink([e1, add(e1, e2), e2], k), fil = p.fillet ?? 0.22;
    let u = `<path d="${rounded(up, fil) + rounded(dn, fil)}"${paint(p.pocket || ctx.slot)}/>`;
    const inner = rounded(shrink([[0, 0], e1, e2], k * 0.66), fil) + rounded(shrink([e1, add(e1, e2), e2], k * 0.66), fil);
    u += p.inner ? `<path d="${inner}"${paint(p.inner)}/>` : `<path d="${inner}" ${stroke(p.step || "c/0.35", p.stepWidth ?? 0.6)}/>`;
    const boss = p.boss ?? 0.09;
    const top = boss ? `<g${paint(p.bossSlot || "c")}>${stamp(id + "B", L.pts)}</g><g${paint(p.holeSlot || "b")}>${stamp(id + "O", L.pts)}</g>` : "";
    const ribs = p.ribLine ? `<path d="${L.pts.map((q) => `M${f(q[0])} ${f(q[1])}h${f(d)}M${f(q[0])} ${f(q[1])}l${f(d / 2)} ${f(h)}M${f(q[0])} ${f(q[1])}l${f(-d / 2)} ${f(h)}`).join("")}" ${stroke(p.ribLine, 0.5)}/>` : "";
    return { defs: `<g id="${id}U">${u}</g><path id="${id}B" d="${circ(0, 0, d * boss)}"/><path id="${id}O" d="${circ(0, 0, d * boss * 0.38)}"/>`, stages: [stamp(id + "U", L.pts), ribs + top] };
  },

  // aerospace honeycomb core: thin cell walls, the walls along the ribbon direction doubled (two foils bonded, a fine glue line between)
  honeycomb(p, ctx) {
    const L = lattice(ctx, p.scale || 4, true), id = ctx.id, ky = L.ky, R = L.sx / S3, w = p.wall ?? 1.1;
    const H = reg(6, R, 30).map((v) => [v[0], v[1] * ky]);
    const rib = `M${f(H[5][0])} ${f(H[5][1])}L${f(H[0][0])} ${f(H[0][1])}`;
    const u = (p.cell ? `<path d="${poly(H)}"${paint(p.cell)}/>` : "") + `<path d="${poly(H)}" ${stroke(p.line || ctx.slot, w, ' stroke-linejoin="round"')}/>`;
    const v = `<path d="${rib}" ${stroke(p.line || ctx.slot, w * 2.6)}/><path d="${rib}" ${stroke(p.glue || "b/0.7", w * 0.45)}/>`; // over every outline, so the glue line stays visible
    return { defs: `<g id="${id}U">${u}</g><g id="${id}V">${v}</g>`, stages: [stamp(id + "U", L.pts), stamp(id + "V", L.pts)] };
  },

  // interlaced rings: a ring on every node of a square lattice, each crossing its four neighbours; at every crossing one ring passes over
  // and the other under, alternating around each ring like chain mail, so the whole field is one woven net
  rings(p, ctx) {
    const L = lattice(ctx, p.scale || 2, false), id = ctx.id, s = L.sx, ky = L.ky, r = s * Math.max(0.53, Math.min(0.68, p.radius ?? 0.6)), w = p.band ?? 3, ow = p.outline ?? 1.5;
    const ring = `M${f(-r)} 0a${f(r)} ${f(r * ky)} 0 1 0 ${f(2 * r)} 0a${f(r)} ${f(r * ky)} 0 1 0 ${f(-2 * r)} 0`;
    const del = (w * 1.7) / r;
    let arcs = "";
    for (const B of [[s, 0], [0, s], [-s, 0], [0, -s]]) {
      const D = Math.hypot(...B), hh = Math.sqrt(r * r - (D / 2) ** 2), m = mul(B, 0.5), pp = [-B[1] / D, B[0] / D];
      for (const sg of [1, -1]) {
        const P = add(m, mul(pp, sg * hh));
        if (B[0] * P[1] - B[1] * P[0] <= 0) continue; // this ring passes under here
        const t = Math.atan2(P[1], P[0]), A0 = [r * Math.cos(t - del), r * Math.sin(t - del) * ky], A1 = [r * Math.cos(t + del), r * Math.sin(t + del) * ky];
        arcs += `M${f(A0[0])} ${f(A0[1])}A${f(r)} ${f(r * ky)} 0 0 1 ${f(A1[0])} ${f(A1[1])}`;
      }
    }
    const band = (dd) => `<path d="${dd}" ${stroke(p.edge || "b", w + 2 * ow)}/><path d="${dd}" ${stroke(p.line || ctx.slot, w)}/>`;
    const dot = (p.dot ?? 0) > 0 ? `<path d="${circ(0, 0, p.dot)}"${paint(p.dotSlot || "c")}/>` : "";
    return { defs: `<g id="${id}R">${band(ring)}${dot}</g><g id="${id}O">${band(arcs)}</g>`, stages: [stamp(id + "R", L.pts), stamp(id + "O", L.pts)] };
  },

  // heat-shield tiles: rounded tiles in staggered rows with thin gaps, three close tones in a fixed rhythm (a spacecraft belly)
  heatshield(p, ctx) {
    const id = ctx.id, g = p.gap ?? 1, rc = p.round ?? 0.18, seq = p.seq || [ctx.slot, ctx.slot + "/0.84", ctx.slot + "/0.92"];
    const n = Math.max(2, Math.round(p.scale ?? 4)), tw = ctx.w / n, rows = 2 * Math.max(1, Math.round(ctx.h / (tw * (p.tall ?? 0.85)) / 2)), th = ctx.h / rows;
    ctx.grid = { x: tw / 2, y: th / 2, px: tw, py: 2 * th };
    const T = rounded([[-tw / 2 + g / 2, -th / 2 + g / 2], [tw / 2 - g / 2, -th / 2 + g / 2], [tw / 2 - g / 2, th / 2 - g / 2], [-tw / 2 + g / 2, th / 2 - g / 2]], rc);
    const cls = [[], [], []];
    for (let j = 0; j < rows; j++) for (let i = 0; i < n; i++) cls[(i + 2 * j) % 3].push([(i + 0.5 + (j % 2) / 2) * tw, (j + 0.5) * th]);
    return { defs: `<path id="${id}T" d="${T}"/>`, stages: [cls.map((c, k) => `<g${paint(cyc(seq, k))}>${stamp(id + "T", c)}</g>`).join("")] };
  },

  // solar-panel cells: square cells with cut corners, fine fingers across and two or three busbars, thin gaps between cells
  solar(p, ctx) {
    const L = lattice(ctx, p.scale || 3, false), id = ctx.id, s = L.sx, sy = L.sy, g = p.gap ?? 1.4, hw = s / 2 - g / 2, hh = sy / 2 - g / 2, c = Math.min(hw, hh) * (p.cut ?? 0.22);
    const cell = poly([[-hw + c, -hh], [hw - c, -hh], [hw, -hh + c], [hw, hh - c], [hw - c, hh], [-hw + c, hh], [-hw, hh - c], [-hw, -hh + c]]);
    const nf = Math.max(4, Math.round(p.fingers ?? 8)), nb = Math.max(2, Math.min(3, Math.round(p.busbars ?? 2)));
    let fing = ""; for (let k = 1; k < nf; k++) { const y = -hh + (2 * hh * k) / nf; fing += `M${f(-hw + 0.5)} ${f(y)}H${f(hw - 0.5)}`; }
    let bus = ""; for (let k = 0; k < nb; k++) { const x = -hw + (2 * hw * (k + 0.5)) / nb; bus += `M${f(x)} ${f(-hh + 0.5)}V${f(hh - 0.5)}`; }
    const u = `<path d="${cell}"${paint(p.cellSlot || ctx.slot)}/><path d="${fing}" ${stroke(p.finger || "c/0.2", p.fingerWidth ?? 0.35)}/><path d="${bus}" ${stroke(p.busSlot || "c/0.75", p.busWidth ?? 1.1)}/>`;
    return { defs: `<g id="${id}U">${u}</g>`, stages: [stamp(id + "U", L.pts)] };
  },

  // geodesic struts: a triangular frame subdivided once (frequency 2), hubs at every node; the centre of each upward triangle may be glazed
  geodesic(p, ctx) {
    const L = lattice(ctx, p.scale || 2, true), id = ctx.id, d = L.sx, h = L.sy, w = p.stroke ?? 1.6;
    const M2 = (a, b) => mul(add(a, b), 0.5), o = [0, 0], A = [d, 0], B = [d / 2, h], C = [1.5 * d, h];
    const up = [M2(o, A), M2(A, B), M2(B, o)], dn = [M2(A, B), M2(B, C), M2(C, A)];
    const main = `M0 0h${f(d)}M0 0l${f(d / 2)} ${f(h)}M0 0l${f(-d / 2)} ${f(h)}`;
    let u = (p.glaze !== "none" ? `<path d="${poly(up)}"${paint(p.glaze || ctx.slot + "/0.22")}/>` : "") + `<path d="${poly(up) + poly(dn)}" ${stroke(p.sub || ctx.slot + "/0.6", w * 0.55)}/><path d="${main}" ${stroke(p.line || ctx.slot, w, ' stroke-linecap="round"')}/>`;
    u += `<path d="${circ(0, 0, w * 1.15)}"${paint(p.hubSlot || "c")}/><path d="${[...up, M2(B, C)].map((q) => circ(q[0], q[1], w * 0.6)).join("")}"${paint(p.hubSlot || "c/0.8")}/>`;
    return { defs: `<g id="${id}U">${u}</g>`, stages: [stamp(id + "U", L.pts)] };
  },

  // orbital rings: every node carries a ring through the centres of its triangles, so rings cross in a continuous net; a small ring and a dot mark the node
  orbit(p, ctx) {
    const L = lattice(ctx, p.scale || 2, true), id = ctx.id, d = L.sx, ky = L.ky, R = d * (p.radius ?? 0.577), sw = p.stroke ?? 1.6;
    const ell = (r) => `M${f(-r)} 0a${f(r)} ${f(r * ky)} 0 1 0 ${f(2 * r)} 0a${f(r)} ${f(r * ky)} 0 1 0 ${f(-2 * r)} 0`;
    let defs = `<path id="${id}R" d="${ell(R)}"/>`, s1 = `<g ${stroke(p.line || ctx.slot, sw)}>${stamp(id + "R", L.pts)}</g>`, s2 = "";
    if ((p.inner ?? 0.22) > 0) { defs += `<path id="${id}I" d="${ell(d * (p.inner ?? 0.22))}"/>`; s2 += `<g ${stroke(p.innerSlot || "c", sw * 0.8)}>${stamp(id + "I", L.pts)}</g>`; }
    if ((p.dot ?? 1.6) > 0) s2 += `<path d="${L.pts.map((q) => circ(q[0], q[1], p.dot ?? 1.6)).join("")}"${paint(p.dotSlot || "c")}/>`;
    if (p.fill) { defs += `<path id="${id}F" d="${ell(R)}"/>`; s1 = `<g${paint(p.fill)}>${stamp(id + "F", L.pts)}</g>` + s1; }
    return { defs, stages: [s1, s2] };
  },

  // scan graticule: majors on the motif grid, fine minors between, a cross mark at every major crossing; no fine periodic stripes
  scangrid(p, ctx) {
    const n = p.scale || 3, k = Math.max(2, Math.min(5, Math.round(p.minor ?? 3))), sx = ctx.w / n, ny = Math.max(1, Math.round((n * ctx.h) / ctx.w)), sy = ctx.h / ny, id = ctx.id;
    ctx.grid = { x: 0, y: 0, px: sx, py: sy };
    let maj = "", min = "";
    for (let i = 0; i < n; i++) { maj += `M${f(i * sx)} 0v${f(ctx.h)}`; for (let t = 1; t < k; t++) min += `M${f(i * sx + (t * sx) / k)} 0v${f(ctx.h)}`; }
    for (let j = 0; j < ny; j++) { maj += `M0 ${f(j * sy)}h${f(ctx.w)}`; for (let t = 1; t < k; t++) min += `M0 ${f(j * sy + (t * sy) / k)}h${f(ctx.w)}`; }
    const c = Math.min(sx, sy) * (p.mark ?? 0.18), mw = p.markWidth ?? 2.4;
    const marks = `M${f(-c)} 0h${f(2 * c)}M0 ${f(-c)}v${f(2 * c)}`, pts = [];
    for (let i = 0; i < n; i++) for (let j = 0; j < ny; j++) pts.push([i * sx, j * sy]);
    const ring = p.ring ? `<path d="${pts.map((q) => circ(q[0], q[1], c * 0.6)).join("")}" ${stroke(p.ringSlot || "c", mw * 0.6)}/>` : "";
    return { defs: `<path id="${id}X" d="${marks}"/>`, stages: [(p.cells ? `<rect width="${f(ctx.w)}" height="${f(ctx.h)}"${paint(p.cells)}/>` : "") + `<path d="${min}" ${stroke(p.minorSlot || ctx.slot + "/0.7", p.minorWidth ?? 1.4)}/><path d="${maj}" ${stroke(p.line || ctx.slot, p.stroke ?? 2.6)}/>`, `<g ${stroke(p.markSlot || "c", mw)}>${stamp(id + "X", pts)}</g>${ring}`] };
  },

  // Cairo pentagonal tiling: short bow-tie edges alternate horizontal and vertical on a checker; grout lines in the ground slot
  cairo(p, ctx) {
    const n = p.scale || 2, u = ctx.w / (2 * n), ny = Math.max(1, Math.round((n * ctx.h) / ctx.w)), v = ctx.h / (2 * ny), t = p.bow ?? 0.37, id = ctx.id;
    // shifted a quarter unit so no grout junction sits exactly on the cell edge (antialiasing there reads as a seam)
    ctx.grid = { x: u / 4, y: v / 4, px: 2 * u, py: 2 * v };
    const P = (x, y) => [(x + 0.25) * u, (y + 0.25) * v];
    // the two pentagons of a horizontal bow-tie at the origin (above and below), and of a vertical one at (1, 0) (left and right)
    const hUp = [P(-t / 2, 0), P(t / 2, 0), P(0.5, 0.5), P(0, 1 - t / 2), P(-0.5, 0.5)], hDn = [P(-t / 2, 0), P(t / 2, 0), P(0.5, -0.5), P(0, t / 2 - 1), P(-0.5, -0.5)];
    const vL = [P(1, -t / 2), P(1, t / 2), P(0.5, 0.5), P(t / 2, 0), P(0.5, -0.5)], vR = [P(1, -t / 2), P(1, t / 2), P(1.5, 0.5), P(2 - t / 2, 0), P(1.5, -0.5)];
    const fil = (a) => (p.round ? rounded(shrink(a, 1), p.round) : poly(a));
    const A = `<path d="${fil(hUp) + fil(hDn)}"${paint(p.fillA || ctx.slot)}/>`, B = `<path d="${fil(vL) + fil(vR)}"${paint(p.fillB || ctx.slot)}/>`;
    const grout = `<path d="${poly(hUp) + poly(hDn) + poly(vL) + poly(vR)}" ${stroke(p.grout || "b", p.gap ?? 1.4, ' stroke-linejoin="round"')}/>`;
    const pts = []; for (let i = 0; i < n; i++) for (let j = 0; j < ny; j++) pts.push([i * 2 * u, j * 2 * v], [i * 2 * u + u, j * 2 * v + v]);
    const accent = p.dot ? `<path d="${pts.map((q) => circ(q[0] + 0.75 * u, q[1] + 0.75 * v, p.dot)).join("")}"${paint(p.dotSlot || "c")}/>` : "";
    return { defs: `<g id="${id}U">${A + B}</g><g id="${id}G">${grout}</g>`, stages: [stamp(id + "U", pts), stamp(id + "G", pts), accent] }; // grout over every fill
  },
};

M.pentagon = M.cairo; // neutral name for the same pentagonal tiling (the final prompt avoids place names)
export default function scifi(p, ctx) {
  const m = M[p.motif];
  if (!m) throw new Error(`scifi: unknown motif "${p.motif}"`);
  return m(p, ctx);
}
scifi.cell = (p) => (["hexarmour", "isogrid", "orbit", "honeycomb", "geodesic"].includes(p.motif) ? "hex" : undefined);
