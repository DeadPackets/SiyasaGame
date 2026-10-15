// Heraldic and medieval: foiled diaper, Gothic tracery diaper, dragon scales, vair (counterchanged bells), semé on a diaper (round 5: both reworked so the field is one connected surface).
import { f, add, mul, poly, circ, reg, lattice, stamp, paint, stroke, polar, starPts } from "./engine.js";

const M = {
  // diaper of foils: lozenge lattice lines with a cusped foil (3-6 lobes) in every lozenge and a boss at each crossing
  foil(p, ctx) {
    const L = lattice(ctx, p.scale || 2, true), id = ctx.id, n = p.lobes || 4, hw = L.sx / 2, hh = L.sy, r = Math.min(hw, hh) * (p.size ?? 0.36);
    const lobes = reg(n, r * 0.62, n === 4 ? 0 : -90).map((c) => circ(c[0], c[1], r * 0.48)).join("");
    let u = `<path d="${lobes}"${paint(p.foilSlot || ctx.slot)}/>`;
    if (p.cusp !== false) u += `<path d="${poly(reg(n, r * 0.62, (n === 4 ? 0 : -90) + 180 / n))}"${paint(p.foilSlot || ctx.slot)}/>`;
    u += `<path d="${circ(0, 0, r * 0.42)}"${paint(p.innerSlot || "b")}/>`;
    if (p.inner !== false) u += `<path d="${poly(starPts(n, r * 0.34, r * 0.13, n === 4 ? -45 : -90))}"${paint(p.coreSlot || "c")}/>`;
    const lines = `<path d="${L.pts.flatMap((q) => [poly([[q[0], q[1] - hh], [q[0] + hw, q[1]]], false), poly([[q[0] + hw, q[1]], [q[0], q[1] + hh]], false)]).join("")}" ${stroke(p.lineSlot || ctx.slot, p.lineWidth ?? 1.6)}/>`;
    const boss = `<path d="${L.pts.map((q) => circ(q[0] + hw, q[1], p.boss ?? 2)).join("")}"${paint(p.bossSlot || "c")}/>`;
    return { defs: `<g id="${id}U">${u}</g>`, stages: [lines, stamp(id + "U", L.pts), p.boss === 0 ? "" : boss] };
  },

  // Gothic tracery diaper: rings that touch their four neighbours, a cusped quatrefoil in each ring, a four-point star where four rings meet
  tracery(p, ctx) {
    const L = lattice(ctx, p.scale || 2, false), id = ctx.id, s = L.sx, ky = L.ky, R = s / 2, sw = p.stroke ?? 1.3;
    const dl = R * 0.36, rl = R * 0.44, t = (dl + Math.sqrt(2 * rl * rl - dl * dl)) / 2; // outer crossing of two lobes: the cusp
    const cusp = (k) => { const a = (k * Math.PI) / 2 + Math.PI / 4; return [Math.SQRT2 * t * Math.cos(a), Math.SQRT2 * t * Math.sin(a) * ky]; };
    let qf = `M${f(cusp(3)[0])} ${f(cusp(3)[1])}`;
    for (let k = 0; k < 4; k++) { const c = cusp(k), big = Math.atan2(t, t - dl) > Math.PI / 2 ? 1 : 0; qf += `A${f(rl)} ${f(rl * ky)} 0 ${big} 1 ${f(c[0])} ${f(c[1])}`; }
    qf += "Z";
    let u = `<path d="M${f(-R)} 0a${f(R)} ${f(R * ky)} 0 1 0 ${f(2 * R)} 0a${f(R)} ${f(R * ky)} 0 1 0 ${f(-2 * R)} 0" ${stroke(p.line || ctx.slot, sw)}/>`;
    u += `<path d="${qf}"${p.foilSlot ? paint(p.foilSlot) : ' fill="none"'} ${stroke(p.line || ctx.slot, sw * 0.8).replace('fill="none" ', "")}/>`;
    const g = R * (Math.SQRT2 - 1) * 0.9, st = poly(starPts(4, g, g * 0.32, -90).map(([x, y]) => [x + s / 2, (y + s / 2) * ky]));
    u += `<path d="${st}"${paint(p.starSlot || "c")}/>`;
    if (p.boss !== false) u += `<path d="${circ(0, 0, R * 0.1)}"${paint(p.bossSlot || "c")}/>`;
    return { defs: `<g id="${id}U">${u}</g>`, stages: [stamp(id + "U", L.pts)] };
  },

  // overlapping pointed scales, painted row by row so each row tucks under the next
  scales(p, ctx) {
    const n = p.scale || 3, w = ctx.w / n, id = ctx.id, rows = 2 * Math.max(1, Math.round(ctx.h / (w * (p.step ?? 0.42)) / 2)), sy = ctx.h / rows, hgt = w * (p.length ?? 0.9);
    ctx.grid = { x: 0, y: -hgt / 2, px: w, py: 2 * sy };
    const sc = (k) => { const hw = (w / 2) * k, top = -hgt * k, r = (hw * hw + hgt * hgt * k * k) / (2 * hw); return `M${f(-hw)} 0A${f(r)} ${f(r)} 0 0 1 0 ${f(top)}A${f(r)} ${f(r)} 0 0 1 ${f(hw)} 0A${f(hw)} ${f(hw * 0.5)} 0 0 1 ${f(-hw)} 0Z`; };
    let u = `<path d="${sc(1)}"${paint(p.scaleSlot || ctx.slot)}${p.edge !== "none" ? ` ${stroke(p.edge || "b", p.edgeWidth ?? 0.9).replace('fill="none"', "")}` : ""}/>`;
    if (p.inner !== false) u += `<path d="${sc(0.5)}"${paint(p.innerSlot || "c/0.45")}/>`;
    if (p.rib) u += `<path d="M0 ${f(-hgt * 0.92)}V${f(hgt * 0.1)}" ${stroke(p.rib, 0.6)}/>`;
    const H = ctx.h * ctx.span, Wd = ctx.w * ctx.span, xs = [];
    for (let i = -1; i * w <= Wd + w + 0.5; i++) xs.push([i * w, 0]);
    let rr = "";
    for (let j = -2; j * sy <= H + hgt + 0.5; j++) rr += `<use href="#${id}${((j % 2) + 2) % 2 ? "O" : "E"}" y="${f(j * sy)}"/>`;
    return { self: true, defs: `<g id="${id}U">${u}</g><g id="${id}E">${stamp(id + "U", xs)}</g><g id="${id}O" transform="translate(${f(w / 2)} 0)"><use href="#${id}E"/></g>`, stages: [rr] };
  },
  // vair: rows of bells, each row counterchanged (the up-bells in bellSlot, the down-bells are the ground between them), alternate rows shifted
  // half a bell; curved shoulders, point-symmetric, so the down-bell is the same shape turned over
  vair(p, ctx) {
    const n = Math.max(2, Math.min(5, Math.round(p.scale ?? 3))), W = ctx.w / n, rows = 2 * Math.max(1, Math.round(ctx.h / (W * (p.tall ?? 0.9)) / 2)), H = ctx.h / rows, id = ctx.id;
    ctx.grid = { x: 0, y: H / 2, px: W, py: 2 * H };
    const P = (x, y) => f(x * W) + " " + f(y * H);
    const bell = `M${P(-0.35, 1)}L${P(-0.35, 0.7)}C${P(-0.35, 0.5)} ${P(-0.15, 0.5)} ${P(-0.15, 0.3)}L${P(-0.15, 0)}L${P(0.15, 0)}L${P(0.15, 0.3)}C${P(0.15, 0.5)} ${P(0.35, 0.5)} ${P(0.35, 0.7)}L${P(0.35, 1)}Z`; // width(y) + width(H - y) = W
    const pts = []; for (let j = 0; j < rows; j++) for (let i = 0; i < n; i++) pts.push([(i + (j % 2) / 2) * W, j * H]);
    const edge = p.edge && p.edge !== "none" ? `<g ${stroke(p.edge, p.edgeWidth ?? 0.8, ' stroke-linejoin="round"')}>${stamp(id + "B", pts)}</g>` : "";
    return { defs: `<path id="${id}B" d="${bell}"/>`, stages: [(p.field ? `<rect width="${f(ctx.w)}" height="${f(ctx.h)}"${paint(p.field)}/>` : "") + `<g${paint(p.bellSlot || ctx.slot)}>${stamp(id + "B", pts)}</g>`, edge] };
  },

  // semé on a diaper: a lozenge trellis whose lines join every charge; charge fleur | ermine | cross | mullet
  seme(p, ctx) {
    const L = lattice(ctx, p.scale || 2, true), id = ctx.id, hw = L.sx / 2, hh = L.sy, r = Math.min(hw, hh) * (p.size ?? 0.52), kind = p.charge || "fleur";
    const lens = (A, B, sag) => { const Lq = Math.hypot(B[0] - A[0], B[1] - A[1]), rho = (Lq * Lq / 4 + sag * sag) / (2 * sag); return `M${f(A[0])} ${f(A[1])}A${f(rho)} ${f(rho)} 0 0 1 ${f(B[0])} ${f(B[1])}A${f(rho)} ${f(rho)} 0 0 1 ${f(A[0])} ${f(A[1])}Z`; };
    const C = {
      fleur: () => lens([0, r * 0.2], [0, -r], r * 0.2) + lens([-r * 0.08, r * 0.12], [-r * 0.62, -r * 0.42], r * 0.13) + lens([r * 0.62, -r * 0.42], [r * 0.08, r * 0.12], r * 0.13)
        + `M${f(-r * 0.36)} ${f(r * 0.1)}h${f(r * 0.72)}v${f(r * 0.14)}h${f(-r * 0.72)}z` + lens([0, r * 0.26], [-r * 0.16, r * 0.7], r * 0.07) + lens([r * 0.16, r * 0.7], [0, r * 0.26], r * 0.07) + lens([0, r * 0.26], [0, r * 0.78], r * 0.06),
      ermine: () => circ(0, -r * 0.62, r * 0.13) + circ(-r * 0.24, -r * 0.4, r * 0.13) + circ(r * 0.24, -r * 0.4, r * 0.13) + `M0 ${f(-r * 0.28)}Q${f(r * 0.1)} ${f(r * 0.3)} ${f(r * 0.34)} ${f(r * 0.8)}Q0 ${f(r * 0.55)} ${f(-r * 0.34)} ${f(r * 0.8)}Q${f(-r * 0.1)} ${f(r * 0.3)} 0 ${f(-r * 0.28)}Z`,
      cross: () => poly([[-0.12, -0.75], [0.12, -0.75], [0.07, -0.12], [0.75, -0.12], [0.75, 0.12], [0.07, 0.12], [0.12, 0.75], [-0.12, 0.75], [-0.07, 0.12], [-0.75, 0.12], [-0.75, -0.12], [-0.07, -0.12]].map(([x, y]) => [x * r * 1.05, y * r * 1.05])), // cross formy
      mullet: () => poly(starPts(5, r * 0.8, r * 0.33)),
    };
    const u = `<path d="${(C[kind] || C.fleur)()}"${paint(p.chargeSlot || ctx.slot)}/>`;
    const lines = `<path d="${L.pts.flatMap((q) => [poly([[q[0], q[1] - hh], [q[0] + hw, q[1]]], false), poly([[q[0] + hw, q[1]], [q[0], q[1] + hh]], false)]).join("")}" ${stroke(p.lineSlot || ctx.slot + "/0.85", p.lineWidth ?? 1.8)}/>`;
    const knot = (p.knot ?? 1.8) > 0 ? `<path d="${L.pts.map((q) => circ(q[0] + hw, q[1], p.knot ?? 1.8)).join("")}"${paint(p.knotSlot || "c")}/>` : "";
    return { defs: `<g id="${id}U">${u}</g>`, stages: [lines, stamp(id + "U", L.pts), knot] };
  },
};

export default function heraldic(p, ctx) {
  const m = M[p.motif];
  if (!m) throw new Error(`heraldic: unknown motif "${p.motif}"`);
  return m(p, ctx);
}
