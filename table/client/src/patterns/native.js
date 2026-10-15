// Native hero motifs for traditions the catalogue only reached with borrowed houses: late Soviet, Tudor, Mongol, Indus,
// Sasanian and late antique, Louis XVI, Upper Palaeolithic. One family per tradition; all square cell.
import { f, add, sub, mul, rot, unit, polar, poly, circ, reg, starPts, lattice, stamp, paint, stroke } from "./engine.js";
import fret from "./fret.js";

const cyc = (a, i) => (Array.isArray(a) ? a[i % a.length] : a);
const pt = (q) => `${f(q[0])} ${f(q[1])}`;
const leaf = (A, B, sag) => { const L = Math.hypot(B[0] - A[0], B[1] - A[1]), rho = (L * L / 4 + sag * sag) / (2 * sag); return `M${pt(A)}A${f(rho)} ${f(rho)} 0 0 1 ${pt(B)}A${f(rho)} ${f(rho)} 0 0 1 ${pt(A)}Z`; };
const seg = (A, B) => `M${pt(A)}L${pt(B)}`;
// a band: ground-coloured edge under the line (the edge is what cuts the strand it crosses)
const band = (d, line, edge, w, ol) => (ol ? `<path d="${d}" ${stroke(edge, w + 2 * ol)}/>` : "") + `<path d="${d}" ${stroke(line, w)}/>`;
// the over strand at a crossing, redrawn: its edge stops short of the line ends, so no dark tick crosses the strand where the piece joins it
const overSeg = (C, u, hl, line, edge, w, ol) => (ol ? `<path d="${seg(add(C, mul(u, -hl + 0.8)), add(C, mul(u, hl - 0.8)))}" ${stroke(edge, w + 2 * ol)}/>` : "") + `<path d="${seg(add(C, mul(u, -hl)), add(C, mul(u, hl)))}" ${stroke(line, w)}/>`;
const arc = (C, r, a0, a1) => { const A = add(C, polar(r, a0)), B = add(C, polar(r, a1)); return `M${pt(A)}A${f(r)} ${f(r)} 0 0 1 ${pt(B)}`; };
const rosette = (n, R, slot, core) => `<path d="${Array.from({ length: n }, (_, i) => leaf(polar(R * 0.18, (360 * i) / n - 90), polar(R, (360 * i) / n - 90), R * 0.24)).join("")}"${paint(slot)}/>` + (core ? `<path d="${circ(0, 0, R * 0.26)}"${paint(core)}/>` : "");
const sq = () => "square";

// ---------- late Soviet: metro and pavilion ceilings ----------
export const soviet = (p, ctx) => SOV[p.motif]?.(p, ctx) ?? bad("soviet", p);
soviet.cell = sq;
const SOV = {
  // Stalinist coffered ceiling: deep coffers in stepped frames between bold ribs, a rosette or star in each, a boss where the ribs cross
  coffer(p, ctx) {
    const L = lattice(ctx, p.scale || 2, false), s = L.sx, id = ctx.id, steps = Math.min(3, Math.max(1, Math.round(p.steps ?? 2))), rib = s * (p.rib ?? 0.1);
    const oct = (p.shape ?? "octagon") === "octagon", e0 = s / 2 - rib / 2, inner = s * (p.field ?? 0.26), dk = (e0 - inner) / steps;
    const shape = (e) => (oct ? poly([[-e, -e * 0.42], [-e * 0.42, -e], [e * 0.42, -e], [e, -e * 0.42], [e, e * 0.42], [e * 0.42, e], [-e * 0.42, e], [-e, e * 0.42]]) : poly([[-e, -e], [e, -e], [e, e], [-e, e]]));
    const seq = p.seq || ["b", "a/0.35", "b"];
    let u = `<path d="${poly([[-s / 2, -s / 2], [s / 2, -s / 2], [s / 2, s / 2], [-s / 2, s / 2]])}"${paint(p.ribSlot || ctx.slot)}/>`;
    for (let k = 0; k <= steps; k++) u += `<path d="${shape(e0 - k * dk)}"${paint(k === steps ? p.fieldSlot || "b" : cyc(seq, k))}/>`;
    const c = p.centre ?? "rosette", R = inner * 0.86;
    if (c === "rosette") u += rosette(p.petals ?? 8, R, p.centreSlot || "c", p.coreSlot || ctx.slot);
    else if (c === "star") u += `<path d="${poly(starPts(5, R, R * 0.4))}"${paint(p.centreSlot || "c")}/>`;
    if (p.boss ?? 0.05) { const b = s * (p.boss ?? 0.05); u += `<path d="${poly([[-s / 2 - b, -s / 2], [-s / 2, -s / 2 - b], [-s / 2 + b, -s / 2], [-s / 2, -s / 2 + b]])}"${paint(p.bossSlot || "c")}/>`; }
    return { defs: `<g id="${id}U">${u}</g>`, stages: [stamp(id + "U", L.pts)] };
  },
  // wheat-and-star lattice: from every star four ears of wheat run along the diagonals to the stars between, their grains pointing in
  wheat(p, ctx) {
    const L = lattice(ctx, p.scale || 2, false), s = L.sx, id = ctx.id, g = Math.min(6, Math.max(3, Math.round(p.grains ?? 4))), sw = p.stem ?? 2;
    const D = s * Math.SQRT1_2, R = s * (p.star ?? 0.15), r2 = R * (p.corner ?? 0.5), a0 = R * 1.15, a1 = a0 + (D - r2 - a0) * (p.head ?? 0.7), gl = ((a1 - a0) / g) * 1.7, ang = p.spread ?? 30;
    let stem = "", grains = "";
    for (let q = 0; q < 4; q++) {
      const u = unit(rot([1, 1], 90 * q)), v = mul(u, -1);
      stem += seg([0, 0], mul(u, D));
      // the ear head: grain pairs pointing in to the centre star, one grain on the tip
      for (let i = 0; i < g; i++) { const P = mul(u, a1 - ((i + 0.3) * (a1 - a0)) / g); for (const sg of [-1, 1]) grains += leaf(add(P, mul(rot(v, sg * 90), sw * 0.5)), add(P, mul(rot(v, sg * ang), gl)), gl * 0.2); }
      grains += leaf(mul(u, a0 + gl * 0.8), mul(u, a0 - gl * 0.15), gl * 0.2);
    }
    let u = `<path d="${stem}" ${stroke(p.line || ctx.slot, sw, ' stroke-linecap="round"')}/><path d="${grains}"${paint(p.grainSlot || ctx.slot)}/>`;
    u += `<path d="${poly(starPts(5, R, R * 0.42))}"${paint(p.starSlot || "c")}/>`;
    if (r2 > 0.5) u += `<path d="${poly(starPts(5, r2, r2 * 0.42).map((v) => add(v, [-s / 2, -s / 2])))}"${paint(p.cornerSlot || p.starSlot || "c")}/>`;
    return { defs: `<g id="${id}U">${u}</g>`, stages: [stamp(id + "U", L.pts)] };
  },
};

// ---------- Tudor: knot gardens and rose diapers ----------
export const tudor = (p, ctx) => TUD[p.motif]?.(p, ctx) ?? bad("tudor", p);
tudor.cell = sq;
// the diagonal trellis through the cell's edge midpoints: Q edges (x - y = const) and P edges (x + y = const)
const trellis = (s) => { const V = [s / 2, 0], H = [0, s / 2], Vm = [-s / 2, 0], Hm = [0, -s / 2]; return { Q: seg(H, Vm) + seg(Hm, V), P: seg(V, H) + seg(Vm, Hm) }; };
const TUD = {
  // knot garden: a ring in every bed threaded on the two diagonals through its centre, and small rings linking each ring to its four
  // neighbours; every crossing alternates over and under (worked round each ring: the X line runs over it, the Y line under it,
  // and the ring runs over a link just after the axis, under it just before)
  knot(p, ctx) {
    const L = lattice(ctx, p.scale || 1, false), s = L.sx, id = ctx.id, w = p.band ?? 3.6, ol = p.outline ?? 1, ln = p.line || ctx.slot, ed = p.edge || "b", h = s / 2;
    const r = s * Math.min(0.44, Math.max(0.34, p.radius ?? 0.4)), deg = 180 / Math.PI, cut = (v) => ((1.2 * (w + 2 * ol) + 1.2) / v) * deg;
    // a link must cross both rings it joins and clear the diagonals
    const lk = p.link ?? 0.16, rl = lk ? Math.min(s * 0.3 - w, Math.max(s * lk, h - r + s * 0.06)) : 0;
    const psi = rl ? Math.atan2(Math.sqrt(Math.max(0, r * r - ((r * r - rl * rl + h * h) / s) ** 2)), (r * r - rl * rl + h * h) / s) * deg : 0;
    const overs = [135, 315, ...(rl ? [0, 90, 180, 270].map((a) => a + psi) : [])], dA = cut(r), dE = dA - (0.9 / r) * deg;
    const X = seg([-h, -h], [h, h]), Y = seg([h, -h], [-h, h]);
    let ring = p.pool ? `<path d="${circ(0, 0, r)}"${paint(p.pool)}/>` : "";
    ring += band(circ(0, 0, r), ln, ed, w, ol);
    const links = rl ? band(circ(h, 0, rl) + circ(0, h, rl), ln, ed, w, ol) : "";
    const over = (ol ? `<path d="${overs.map((a) => arc([0, 0], r, a - dE, a + dE)).join("")}" ${stroke(ed, w + 2 * ol)}/>` : "") + `<path d="${overs.map((a) => arc([0, 0], r, a - dA, a + dA)).join("")}" ${stroke(ln, w)}/>`;
    const bs = p.boss ?? 6, boss = bs ? `<path d="${circ(0, 0, bs) + (rl ? circ(h, 0, bs * 0.5) + circ(0, h, bs * 0.5) : "")}"${paint(p.bossSlot || "c")}/>` : "";
    const g = (k, body) => `<g id="${id}${k}">${body}</g>`;
    return { defs: g("R", ring) + g("K", links) + g("X", band(X, ln, ed, w, ol)) + g("Y", band(Y, ln, ed, w, ol)) + g("O", over + boss), stages: ["R", "K", "X", "Y", "O"].map((k) => stamp(id + k, L.pts)) };
  },
  // Tudor rose diaper: a lozenge trellis, a double rose (five petals over five) in every lozenge, a knot of four studs where the lines cross
  rose(p, ctx) {
    const L = lattice(ctx, p.scale || 1, false), s = L.sx, id = ctx.id, w = p.band ?? 2.4, T = trellis(s), R = s * (p.size ?? 0.25);
    const petals = (n, r, d, a0) => Array.from({ length: n }, (_, i) => { const c = polar(d, a0 + (360 * i) / n); return circ(c[0], c[1], r); }).join("");
    const barbs = Array.from({ length: 5 }, (_, i) => leaf(polar(R * 0.62, -54 + 72 * i), polar(R * 1.08, -54 + 72 * i), R * 0.1)).join("");
    let rose = `<path d="${barbs}"${paint(p.barbSlot || "c")}/><path d="${petals(5, R * 0.42, R * 0.52, -90)}"${paint(p.roseSlot || ctx.slot)}/>`;
    rose += `<path d="${petals(5, R * 0.27, R * 0.27, -54)}"${paint(p.innerSlot || "c")}/><path d="${circ(0, 0, R * 0.2)}"${paint(p.seedSlot || ctx.slot)}/>`;
    const k = s * (p.knot ?? 0.035), knot = k ? `<path d="${[[0, -1], [1, 0], [0, 1], [-1, 0]].map(([x, y]) => circ(s / 2 + x * k * 1.3, y * k * 1.3, k)).join("")}"${paint(p.knotSlot || "c")}/>` : "";
    const cr = p.corner ?? "c/0.7", cR = R * 0.42, cornerRose = cr !== "none" ? `<path d="${petals(4, cR * 0.45, cR * 0.5, 0)}"${paint(cr)} transform="translate(${f(-s / 2)} ${f(-s / 2)})"/>` : "";
    return { defs: `<g id="${id}T"><path d="${T.P + T.Q}" ${stroke(p.line || ctx.slot, w)}/>${knot}</g><g id="${id}R">${rose}${cornerRose}</g>`, stages: [stamp(id + "T", L.pts), stamp(id + "R", L.pts)] };
  },
};

// ---------- Mongol: the olzii endless knot ----------
export const mongol = (p, ctx) => (p.motif === "olzii" ? olzii(p, ctx) : bad("mongol", p));
mongol.cell = sq;
// square endless knots on the diagonal plait: walls at the middle of each knot's sides, corners left open so every knot runs into its
// four diagonal neighbours (one endless line, as on ger doors and felt)
function olzii(p, ctx) {
  const k = 2 * Math.min(2, Math.max(1, Math.round(p.scale ?? 1)));
  const out = fret({ ...p, motif: "knot", pattern: "olzii", grid: k, width: p.width ?? 0.22, outline: p.outline ?? 0.9, edge: p.edge || "b" }, ctx);
  ctx.grid = { x: ctx.w / k, y: ctx.h / k, px: (2 * ctx.w) / k, py: (2 * ctx.h) / k };
  if (p.boss ?? 2.5) out.stages.push(`<path d="${Array.from({ length: k * k / 4 }, (_, i) => { const x = ((i % (k / 2)) + 0.5) * (2 * ctx.w) / k, y = (Math.floor(i / (k / 2)) + 0.5) * (2 * ctx.h) / k; return circ(x, y, p.boss ?? 2.5); }).join("")}"${paint(p.bossSlot || "c")}/>`);
  return out;
}

// ---------- Indus: pipal leaves and counterchanged scales ----------
export const indus = (p, ctx) => IND[p.motif]?.(p, ctx) ?? bad("indus", p);
indus.cell = sq;
// pipal leaf: heart-shaped base, long drip tip; base at the origin, tip at (0, -L)
const pipal = (Lf, w) => { const h = (x, y) => pt([x * w, y * Lf]); return `M${h(0, -0.06)}C${h(0.2, 0.1)} ${h(1.05, 0.12)} ${h(1, -0.3)}C${h(0.95, -0.56)} ${h(0.3, -0.66)} ${h(0.12, -0.8)}C${h(0.05, -0.86)} ${h(0.02, -0.94)} 0 ${f(-Lf)}C${h(-0.02, -0.94)} ${h(-0.05, -0.86)} ${h(-0.12, -0.8)}C${h(-0.3, -0.66)} ${h(-0.95, -0.56)} ${h(-1, -0.3)}C${h(-1.05, 0.12)} ${h(-0.2, 0.1)} ${h(0, -0.06)}Z`; };
const IND = {
  // pipal-leaf lattice (Harappan painted ware): four leaves on stalks round every node, tips meeting the next node's leaves
  pipal(p, ctx) {
    const L = lattice(ctx, p.scale || 2, false), s = L.sx, id = ctx.id, axis = !!p.axis, D = axis ? s / 2 : s * Math.SQRT1_2;
    const r0 = s * (p.node ?? 0.07), Lf = (D - r0 * 1.6) * (p.length ?? 0.82), w = Lf * (p.width ?? 0.3), a0 = axis ? -90 : -45;
    let leaves = "", veins = "", stalk = "";
    for (let q = 0; q < 4; q++) {
      const a = a0 + 90 * q, tr = `rotate(${f(a + 90)})translate(0 ${f(-r0 * 1.6)})`;
      leaves += `<path d="${pipal(Lf, w)}" transform="${tr}"/>`;
      veins += `<path d="M0 ${f(-0.1 * Lf)}V${f(-0.8 * Lf)}" transform="${tr}"/>`;
      stalk += seg([0, 0], polar(D, a));
    }
    let u = `<path d="${stalk}" ${stroke(p.line || ctx.slot, p.stalk ?? 1.6)}/><g${paint(p.leafSlot || ctx.slot)}>${leaves}</g>`;
    if (p.vein !== "none") u += `<g ${stroke(p.vein || "b/0.7", p.veinWidth ?? 1)}>${veins}</g>`;
    u += `<path d="${circ(0, 0, r0)}"${paint(p.nodeSlot || "c")}/>`;
    if (p.dot ?? 2) { const c = axis ? [s / 2, s / 2] : [s / 2, 0]; u += `<path d="${circ(c[0], c[1], p.dot ?? 2)}"${paint(p.dotSlot || "c")}/>`; }
    return { defs: `<g id="${id}U">${u}</g>`, stages: [stamp(id + "U", L.pts)] };
  },
  // checker-scale: overlapping scale rows, alternate scales filled and hollow like a checkerboard, each with an inner ring
  scales(p, ctx) {
    const n = 2 * Math.max(1, Math.round((p.scale || 4) / 2)), R = ctx.w / n / 2, id = ctx.id, rows = 2 * Math.max(1, Math.round(ctx.h / (R * (p.step ?? 1)) / 2)), sy = ctx.h / rows;
    ctx.grid = { x: 0, y: -sy / 2, px: 2 * R, py: 2 * sy };
    const ow = p.outline ?? 1.6, inner = p.inner ?? 0.55, ed = p.edge || "b";
    const sc = (fill, ring) => `<path d="${circ(0, 0, R - ow / 2)}"${paint(fill)} ${stroke(ed, ow).replace('fill="none"', "")}/>` + (inner ? `<path d="${circ(0, R * 0.12, R * inner)}" ${stroke(ring, p.ring ?? 2)}/>` : "") + (p.dot ? `<path d="${circ(0, R * 0.12, p.dot)}"${paint(ring)}/>` : "");
    const A = sc(p.fill || ctx.slot, p.ringSlot || "c"), B = sc(p.fill2 || "b", p.ring2 || ctx.slot), H = ctx.h * ctx.span, Wd = ctx.w * ctx.span;
    // a row alternates filled and hollow scales; odd rows sit half a scale over, so the two kinds meet like a checkerboard
    let row = ""; for (let i = -1; i * 2 * R <= Wd + 2 * R + 0.5; i++) row += `<use href="#${id}${((i % 2) + 2) % 2 ? "B" : "A"}" x="${f(i * 2 * R)}"/>`;
    let rs = ""; for (let j = -Math.ceil(R / sy) - 1; j * sy <= H + R + 0.5; j++) rs += `<use href="#${id}R"${j % 2 ? ` x="${f(R)}"` : ""} y="${f(j * sy)}"/>`;
    return { self: true, defs: `<g id="${id}A">${A}</g><g id="${id}B">${B}</g><g id="${id}R">${row}</g>`, stages: [rs] };
  },
};

// ---------- Sasanian and late antique: pearl roundels, interlaced circles ----------
export const sasanian = (p, ctx) => SAS[p.motif]?.(p, ctx) ?? bad("sasanian", p);
sasanian.cell = sq;
const SAS = {
  // pearl roundels (Sasanian silks and stucco): a pearl-bordered ring round a rosette, rings clasped to their neighbours, a four-petal filler between
  roundel(p, ctx) {
    const L = lattice(ctx, p.scale || 1, false), s = L.sx, id = ctx.id, R = s * (p.size ?? 0.46), bw = R * (p.band ?? 0.18), n = Math.max(8, Math.round(p.pearls ?? 16));
    let u = `<path d="${circ(0, 0, R)}"${paint(p.ringSlot || ctx.slot)}/><path d="${circ(0, 0, R - bw)}"${paint(p.fieldSlot || "b")}/>`;
    u += `<path d="${reg(n, R - bw / 2, -90).map((v) => circ(v[0], v[1], bw * (p.pearl ?? 0.3))).join("")}"${paint(p.pearlSlot || "c")}/>`;
    const c = p.centre ?? "rosette", Rc = (R - bw) * 0.72;
    if (c === "rosette") u += rosette(p.petals ?? 8, Rc, p.centreSlot || ctx.slot, p.coreSlot || "c");
    else if (c === "star") u += `<path d="${poly(starPts(8, Rc, Rc * 0.55, -90))}"${paint(p.centreSlot || ctx.slot)}/><path d="${circ(0, 0, Rc * 0.25)}"${paint(p.coreSlot || "c")}/>`;
    const k = bw * 0.7, clasp = `<path d="${circ(s / 2, 0, k) + circ(0, s / 2, k)}"${paint(p.claspSlot || "c")}/>`;
    const fl = s / 2 - R * 0.72, fill = (p.filler ?? "a/0.7") !== "none" ? `<path d="${[0, 90, 180, 270].map((a) => leaf(add([s / 2, s / 2], polar(fl * 0.1, a + 45)), add([s / 2, s / 2], polar(fl * 1.15, a + 45)), fl * 0.32)).join("")}"${paint(p.filler ?? "a/0.7")}/>` : "";
    return { defs: `<g id="${id}U">${u}${fill}${clasp}</g>`, stages: [stamp(id + "U", L.pts)] };
  },
  // interlaced circles (Byzantine and Umayyad window grilles, Coptic carving): every ring crosses its four neighbours, over and under in turn
  interlace(p, ctx) {
    const L = lattice(ctx, p.scale || 1, false), s = L.sx, id = ctx.id, r = s * Math.min(0.66, Math.max(0.55, p.radius ?? 0.6)), w = p.band ?? 3, ol = p.outline ?? 1, ln = p.line || ctx.slot, ed = p.edge || "b";
    const phi = (Math.acos(s / 2 / r) * 180) / Math.PI, dA = ((1.7 * (w + 2 * ol) + 1) / r) * (180 / Math.PI), dE = dA - (0.9 / r) * (180 / Math.PI);
    let over = "", overE = "";
    for (let q = 0; q < 4; q++) { const a = phi + 90 * q; over += arc([0, 0], r, a - dA, a + dA); overE += arc([0, 0], r, a - dE, a + dE); }
    let u = `<g id="${id}C">` + (p.pool ? `<path d="${circ(0, 0, r - w / 2)}"${paint(p.pool)}/>` : "") + band(circ(0, 0, r), ln, ed, w, ol) + `</g>`;
    let core = "";
    const c = p.centre ?? "rosette", Rc = s * (p.centreSize ?? 0.2);
    if (c === "rosette") core += rosette(p.petals ?? 6, Rc, p.centreSlot || "c", p.coreSlot || ctx.slot);
    else if (c === "dot") core += `<path d="${circ(0, 0, Rc * 0.45)}"${paint(p.centreSlot || "c")}/>`;
    const st = s * (p.stud ?? 0.07); if (st) core += `<path d="${poly([[s / 2 - st, s / 2], [s / 2, s / 2 - st], [s / 2 + st, s / 2], [s / 2, s / 2 + st]])}"${paint(p.studSlot || "c")}/>`;
    const O = (ol ? `<path d="${overE}" ${stroke(ed, w + 2 * ol)}/>` : "") + `<path d="${over}" ${stroke(ln, w)}/>`;
    return { defs: `${u}<g id="${id}O">${O}${core}</g>`, stages: [stamp(id + "C", L.pts), stamp(id + "O", L.pts)] };
  },
};

// ---------- Louis XVI: guilloche and the fleur-de-lis trellis ----------
export const louis = (p, ctx) => LOU[p.motif]?.(p, ctx) ?? bad("louis", p);
louis.cell = sq;
// fleur-de-lis, height H, centred on the origin
function fleur(H) {
  const h = (x, y) => pt([x * H, y * H]);
  const mid = `M${h(0, -0.5)}C${h(0.17, -0.34)} ${h(0.15, -0.06)} ${h(0.055, 0.08)}L${h(-0.055, 0.08)}C${h(-0.15, -0.06)} ${h(-0.17, -0.34)} ${h(0, -0.5)}Z`;
  const side = (k) => `M${h(0.07 * k, 0.07)}C${h(0.1 * k, -0.18)} ${h(0.44 * k, -0.34)} ${h(0.42 * k, -0.04)}C${h(0.41 * k, 0.08)} ${h(0.3 * k, 0.1)} ${h(0.27 * k, 0.02)}C${h(0.32 * k, -0.04)} ${h(0.3 * k, -0.14)} ${h(0.22 * k, -0.1)}C${h(0.15 * k, -0.06)} ${h(0.13 * k, 0.02)} ${h(0.12 * k, 0.08)}Z`;
  const bar = `M${h(-0.19, 0.08)}H${f(0.19 * H)}V${f(0.16 * H)}H${f(-0.19 * H)}Z`;
  const foot = `M${h(-0.05, 0.16)}C${h(-0.06, 0.28)} ${h(-0.03, 0.36)} ${h(0, 0.42)}C${h(0.03, 0.36)} ${h(0.06, 0.28)} ${h(0.05, 0.16)}Z` + [1, -1].map((k) => `M${h(0.04 * k, 0.16)}C${h(0.14 * k, 0.2)} ${h(0.22 * k, 0.26)} ${h(0.2 * k, 0.34)}C${h(0.13 * k, 0.32)} ${h(0.08 * k, 0.24)} ${h(0.01 * k, 0.16)}Z`).join("");
  return mid + side(1) + side(-1) + bar + foot;
}
const LOU = {
  // guilloche: two bands wind round a row of eyes and cross between them, over and under in turn; a rosette in every eye
  guilloche(p, ctx) {
    const n = 2 * Math.min(2, Math.max(1, Math.round(p.scale ?? 1))), P = ctx.w / n, R = P / (2.15 + 0.35 * Math.min(1, Math.max(0, p.open ?? 0.4))), id = ctx.id;
    const w = p.band ?? 3, ol = p.outline ?? 1, ln = p.line || ctx.slot, ed = p.edge || "b", rule = p.rule ?? 2.5;
    const rows = Math.max(1, Math.round(ctx.h / (2 * R + w + 2 * ol + rule + (p.gap ?? 4)))), sy = ctx.h / rows;
    ctx.grid = { x: 0, y: sy / 2, px: P, py: sy };
    const b = Math.asin((2 * R) / P), sb = Math.sin(b), cb = Math.cos(b), dx = (P / 2) * sb * sb, dy = (P / 2) * sb * cb;
    // strand A runs over the top of even eyes and under the bottom of odd ones; strand B is A one eye on. One period; the engine wraps it.
    const strand = (y0, off) => {
      let d = "";
      for (let k = off; k < n + off; k += 2) {
        const x = k * P, Lu = [x - dx, y0 - dy], Ru = [x + dx, y0 - dy], Ll = [x + P - dx, y0 + dy], Rl = [x + P + dx, y0 + dy], Nu = [x + 2 * P - dx, y0 - dy];
        d += `M${pt(Lu)}A${f(R)} ${f(R)} 0 0 1 ${pt(Ru)}L${pt(Ll)}A${f(R)} ${f(R)} 0 0 0 ${pt(Rl)}L${pt(Nu)}`;
      }
      return d;
    };
    const u = unit([cb, sb]), hl = (w / 2 + ol + 1.2) / Math.sin(2 * b) + 1;
    // one row drawn at y = 0 (fillet, eyes, strand A, strand B, A's over-crossings), stamped down the cell; rows never overlap
    let O = "", eyes = "";
    for (let k = 0; k < n; k += 2) O += overSeg([k * P + P / 2, 0], u, hl, ln, ed, w, ol);
    for (let k = 0; k < n; k++) eyes += `<use href="#${id}Y" x="${f(k * P)}"/>`;
    const row = (rule ? `<path d="M0 ${f(-sy / 2)}H${f(ctx.w)}" ${stroke(p.ruleSlot || ctx.slot + "/0.6", rule)}/>` : "") + eyes + band(strand(0, 0), ln, ed, w, ol) + band(strand(0, 1), ln, ed, w, ol) + O;
    return { defs: `<g id="${id}Y">${rosette(p.petals ?? 8, R * (p.eye ?? 0.62), p.eyeSlot || "c", p.coreSlot || ctx.slot)}</g><g id="${id}W">${row}</g>`, stages: [stamp(id + "W", Array.from({ length: rows }, (_, j) => [0, (j + 0.5) * sy]))] };
  },
  // fleur-de-lis on a lozenge trellis, a patera where the lines cross (Louis XVI silks and boiseries)
  fleur(p, ctx) {
    const L = lattice(ctx, p.scale || 1, false), s = L.sx, id = ctx.id, w = p.band ?? 3.2, T = trellis(s), H = s * (p.size ?? 0.46), pr = s * (p.patera ?? 0.09);
    const fl = `<path d="${fleur(H)}"${paint(p.fleurSlot || ctx.slot)}/>`;
    const corner = (p.corner ?? "fleur") === "fleur" ? `<g transform="translate(${f(-s / 2)} ${f(-s / 2)})scale(.62)">${fl.replace(paint(p.fleurSlot || ctx.slot), paint(p.cornerSlot || p.fleurSlot || ctx.slot))}</g>` : "";
    const pat = pr ? `<g transform="translate(${f(s / 2)} 0)">${rosette(p.petals ?? 8, pr, p.pateraSlot || "c", p.coreSlot || ctx.slot)}</g><g transform="translate(0 ${f(s / 2)})">${rosette(p.petals ?? 8, pr, p.pateraSlot || "c", p.coreSlot || ctx.slot)}</g>` : "";
    return { defs: `<g id="${id}T"><path d="${T.P + T.Q}" ${stroke(p.line || ctx.slot, w)}/></g><g id="${id}F">${fl}${corner}${pat}</g>`, stages: [stamp(id + "T", L.pts), stamp(id + "F", L.pts)] };
  },
};

// ---------- Upper Palaeolithic: incised bone and ochre ----------
export const paleo = (p, ctx) => PAL[p.motif]?.(p, ctx) ?? bad("paleo", p);
paleo.cell = sq;
const PAL = {
  // incised chevron bands (engraved ivory and bone): parallel zigzags in each band, a row of drilled pits between bands
  chevron(p, ctx) {
    const n = Math.max(1, Math.round(p.scale ?? 2)), lam = ctx.w / n, rows = Math.max(1, Math.round(p.rows ?? 2)), ry = ctx.h / rows, m = Math.min(3, Math.max(1, Math.round(p.lines ?? 3)));
    const sw = p.stroke ?? 3, amp = lam * (p.depth ?? 0.4) / 2, sp = Math.max(sw * 2.2, ry * (p.spacing ?? 0.14)), id = ctx.id;
    ctx.grid = { x: lam / 2, y: ry / 2, px: lam, py: ry };
    // the middle groove of a three-line band in the light slot, as if rubbed with ochre
    let d = "", mid = "", pits = "";
    for (let j = 0; j < rows; j++) {
      const flip = p.alt !== false && j % 2 ? -1 : 1, yc = (j + 0.5) * ry;
      for (let t = 0; t < m; t++) { const y = yc + (t - (m - 1) / 2) * sp; let z = `M${f(-lam)} ${f(y + flip * amp)}`; for (let i = -1; i <= n + 1; i++) z += `L${f(i * lam + lam / 2)} ${f(y - flip * amp)}L${f((i + 1) * lam)} ${f(y + flip * amp)}`; if (m === 3 && t === 1) mid += z; else d += z; }
      if (p.dot ?? 2.8) for (let i = 0; i < n; i++) pits += circ(i * lam + lam / 2, j * ry, p.dot ?? 2.8) + circ(i * lam, j * ry, (p.dot ?? 2.8) * 0.7);
    }
    const cap = ' stroke-linejoin="round" stroke-linecap="round"';
    return { stages: [`<path d="${d}" ${stroke(p.line || ctx.slot, sw, cap)}/>` + (mid ? `<path d="${mid}" ${stroke(p.midSlot || "c/0.85", sw * 0.8, cap)}/>` : ""), pits ? `<path d="${pits}"${paint(p.dotSlot || "c")}/>` : ""] };
  },
  // ochre lattice (Blombos-style engraved ochre): rails bounding bands of cross-hatched lozenges, an ochre dot in each lozenge
  ochre(p, ctx) {
    const n = Math.max(1, Math.round(p.scale ?? 2)), lam = ctx.w / n, rows = Math.max(1, Math.round(p.rows ?? 2)), ry = ctx.h / rows, sw = p.stroke ?? 2.2;
    ctx.grid = { x: lam / 2, y: ry / 2, px: lam, py: ry };
    let d = "", dots = "";
    for (let j = 0; j < rows; j++) {
      const y0 = j * ry, y1 = y0 + ry, o = p.alt && j % 2 ? lam / 2 : 0;
      if (p.rail !== false) d += `M${f(-lam)} ${f(y0)}H${f(ctx.w + lam)}`;
      for (let i = -1; i <= n; i++) { const x = i * lam + o; d += `M${f(x)} ${f(y0)}L${f(x + lam)} ${f(y1)}M${f(x + lam)} ${f(y0)}L${f(x)} ${f(y1)}`; if (p.dot ?? 3.2) dots += circ(x + lam / 2, (y0 + y1) / 2, p.dot ?? 3.2) + (p.pits ?? true ? circ(x, (y0 + y1) / 2, (p.dot ?? 3.2) * 0.6) : ""); }
    }
    return { stages: [`<path d="${d}" ${stroke(p.line || ctx.slot, sw, ' stroke-linecap="round"')}/>`, dots ? `<path d="${dots}"${paint(p.dotSlot || "c")}/>` : ""] };
  },
};

function bad(fam, p) { throw new Error(`${fam}: unknown motif "${p.motif}"`); }
