// Girih: Islamic star patterns by Hankin's polygons-in-contact method (Kaplan 2005) on five periodic base tilings.
import { S3, DEG, f, add, sub, mul, dot, len, unit, isect, poly, circ, reg, lattice, stamp, paint, stroke } from "./engine.js";

const tiling = (p) => TILINGS[p.tiling] || TILINGS["4.8.8"];

// polygons per lattice point: [offset (ideal coords), sides, circumradius, first vertex angle] or [offset, "gap", vertices].
// cell: the base cell the tiling needs; sy: ideal row spacing for horizontal spacing d.
const T54 = Math.tan((54 * Math.PI) / 180); // literal: engine.js is still initialising when this module runs
const TILINGS = {
  "4.4.4.4": { cell: "square", polys: (d) => [[[0, 0], 4, d / Math.SQRT2, 45]] },
  "4.8.8": { cell: "square", polys: (d) => { const R = d / 2 / Math.cos(22.5 * DEG), e = 2 * R * Math.sin(22.5 * DEG); return [[[0, 0], 8, R, 22.5], [[d / 2, d / 2], 4, e / Math.SQRT2, 0]]; } },
  "6.6.6": { cell: "hex", polys: (d) => [[[0, 0], 6, d / S3, 30]] },
  "3.12.12": { cell: "hex", polys: (d, sy) => { const R = d / 2 / Math.cos(15 * DEG), t = (2 * R * Math.sin(15 * DEG)) / S3; return [[[0, 0], 12, R, 15], [[d / 2, sy / 3], 3, t, 30], [[d, (2 * sy) / 3], 3, t, 90]]; } },
  "4.6.12": { cell: "hex", polys: (d, sy) => { const e = d / (1 / Math.tan(15 * DEG) + 1), R = e / 2 / Math.sin(15 * DEG), q = e / Math.SQRT2; return [[[0, 0], 12, R, 15], [[d / 2, sy / 3], 6, e, 0], [[d, (2 * sy) / 3], 6, e, 0], [[d / 2, 0], 4, q, 45], [[d / 4, sy / 2], 4, q, 105], [[(3 * d) / 4, sy / 2], 4, q, 165]]; } },
  // girih decagons on a centred rectangle (h/w = tan 54), each touching four neighbours; the gaps are girih bowties
  "10.bowtie": { cell: "dec", sy: (d) => (d / 2) * T54, polys: (d, sy) => { const R = d / 4 / Math.cos(54 * DEG) / Math.cos(18 * DEG); return [[[0, 0], 10, R, 0], [[0, sy], "gap", gap([[0, 0], [d / 2, sy], [0, 2 * sy], [-d / 2, sy]], 10, R, 0, [0, sy])]]; } },
  // 16-gons on a square lattice touching four neighbours; the gaps are concave four-point stars
  "16.4": { cell: "square", polys: (d) => { const R = d / 2 / Math.cos(11.25 * DEG); return [[[0, 0], 16, R, 11.25], [[d / 2, d / 2], "gap", gap([[0, 0], [d, 0], [0, d], [d, d]], 16, R, 11.25, [d / 2, d / 2])]]; } },
};
// the gap around G between regular n-gons at the given centres: their vertices within R of G, sorted by angle, relative to G
function gap(cs, n, R, a0, G) {
  const out = [];
  for (const c of cs) for (const v of reg(n, R, a0, c)) if (len(sub(v, G)) < R * 0.999 && !out.some((q) => len(sub(q, v)) < 1e-6)) out.push(v);
  return out.map((v) => sub(v, G)).sort((a, b) => Math.atan2(a[1], a[0]) - Math.atan2(b[1], b[0]));
}
const inside = (P, q) => { let c = false; for (let i = 0, j = P.length - 1; i < P.length; j = i++) { const a = P[i], b = P[j]; if (a[1] > q[1] !== b[1] > q[1] && q[0] < ((b[0] - a[0]) * (q[1] - a[1])) / (b[1] - a[1]) + a[0]) c = !c; } return c; };
const cross2 = (a, b) => a[0] * b[1] - a[1] * b[0];
function crosses(P, a, b) { // segment a-b properly crosses a polygon edge
  for (let i = 0; i < P.length; i++) {
    const c = P[i], d = P[(i + 1) % P.length], r = sub(b, a), s = sub(d, c), den = cross2(r, s);
    if (Math.abs(den) < 1e-9) continue;
    const t = cross2(sub(c, a), s) / den, u = cross2(sub(c, a), r) / den;
    if (t > 1e-4 && t < 1 - 1e-4 && u > 1e-4 && u < 1 - 1e-4) return true;
  }
  return false;
}
// Hankin rays for any simple polygon (convex or not): pair rays greedily by shortest total length (Kaplan's rule for irregular polygons).
function hankinAny(P, th) {
  const n = P.length, rays = [];
  P.forEach((A, k) => {
    const B = P[(k + 1) % n], e = unit(sub(B, A)), M = mul(add(A, B), 0.5);
    let nin = [-e[1], e[0]]; if (!inside(P, add(M, mul(nin, 1e-3)))) nin = mul(nin, -1);
    const c = Math.cos(th), s = Math.sin(th);
    rays.push({ o: M, u: add(mul(e, c), mul(nin, s)), fw: true, k }, { o: M, u: add(mul(e, -c), mul(nin, s)), fw: false, k });
  });
  const cand = [];
  for (let i = 0; i < rays.length; i++) for (let j = i + 1; j < rays.length; j++) {
    const a = rays[i], b = rays[j], den = cross2(a.u, b.u);
    if (a.k === b.k || Math.abs(den) < 1e-9) continue;
    const w = sub(b.o, a.o), t = cross2(w, b.u) / den, u = cross2(w, a.u) / den;
    if (t < 1e-6 || u < 1e-6) continue;
    const X = add(a.o, mul(a.u, t));
    if (!inside(P, mul(add(X, mul(add(a.o, b.o), 0.5)), 0.5)) || crosses(P, a.o, X) || crosses(P, b.o, X)) continue;
    cand.push([t + u + Math.abs(t - u) * 1e-3, i, j, X, t, u]);
  }
  cand.sort((a, b) => a[0] - b[0]);
  const used = new Set(), segs = [];
  for (const [, i, j, X, t, u] of cand) if (!used.has(i) && !used.has(j)) { used.add(i); used.add(j); segs.push([rays[i], X, t], [rays[j], X, u]); }
  return segs;
}

// Hankin geometry for one convex polygon centred at the origin.
function hankin(P, th, dl) {
  const n = P.length, E = P.map((A, k) => {
    const B = P[(k + 1) % n], e = unit(sub(B, A)), M = mul(add(A, B), 0.5), dd = (dl * len(sub(B, A))) / 2;
    let nin = [-e[1], e[0]]; if (dot(nin, M) > 0) nin = mul(nin, -1);
    const c = Math.cos(th), s = Math.sin(th);
    return { M, nin, dd, Sf: sub(M, mul(e, dd)), uf: add(mul(e, c), mul(nin, s)), Sb: add(M, mul(e, dd)), ub: add(mul(e, -c), mul(nin, s)) };
  });
  const X = E.map((a, k) => { const b = E[(k + 1) % n], q = isect(a.Sf, a.uf, b.Sb, b.ub); return isFinite(q[0]) && len(q) < len(P[0]) ? q : mul(add(a.Sf, b.Sb), 0.5); });
  const tips = E.map((a) => (a.dd > 1e-6 ? [add(a.M, mul(a.nin, a.dd * Math.tan(th)))] : a.dd < -1e-6 ? [a.Sb, a.Sf] : [a.M]));
  return { E, X, tips, outline: tips.flatMap((t, k) => [...t, X[k]]) };
}

function girih(p, ctx) {
  const T = tiling(p), n0 = p.scale || 1;
  // dec cell: rows are exactly 2n so the decagons stay regular
  const L = T.cell === "dec" ? (() => { const sx = ctx.w / n0, sy = ctx.h / (2 * n0), pts = []; ctx.grid = { x: 0, y: 0, px: sx, py: 2 * sy }; for (let j = 0; j < 2 * n0; j++) for (let i = 0; i < n0; i++) pts.push([i * sx + (j % 2 ? sx / 2 : 0), j * sy]); return { pts, sx, sy }; })() : lattice(ctx, n0, T.cell === "hex");
  const d = L.sx, sy0 = T.sy ? T.sy(d) : T.cell === "hex" ? (d * S3) / 2 : d, ky = T.cell === "dec" ? L.sy / sy0 : L.ky;
  const th = (p.angle ?? 60) * DEG, dl = p.delta ?? 0, I = ctx.I, id = ctx.id;
  const lw = p.width ?? 2.4, ol = p.outline ?? (I > 0.4 ? 0.9 : 0), gap = p.gap ?? 1.1;
  const line = p.line || ctx.slot, edge = p.edge || "b", fills = p.fills || {};
  const pr = p.petals ?? (I > 0.7 ? 0.45 : 0), dots = p.dots, join = p.join === "round" ? ' stroke-linejoin="round"' : ' stroke-miterlimit="8"';
  const Wb = lw + 2 * ol, hl = (Wb / 2 + gap) / Math.abs(Math.sin(2 * th)) + Wb / 2;

  const classes = new Map(), places = [];
  for (const c of L.pts) T.polys(d, sy0).forEach(([o, n, R, a0], gi) => {
    const key = n === "gap" ? "g" + gi : n + "_" + a0;
    if (!classes.has(key)) classes.set(key, n === "gap" ? { n: 0, gap: R.map((v) => [v[0], v[1] * ky]), pts: [] } : { n, P: reg(n, R, a0).map((v) => [v[0], v[1] * ky]), pts: [] });
    classes.get(key).pts.push([c[0] + o[0], c[1] + o[1] * ky]);
  });
  let defs = "", sFill = fills.rest ? `<rect width="${f(ctx.w)}" height="${f(ctx.h)}"${paint(fills.rest)}/>` : "", sLine = "", sOver = "";
  [...classes.values()].forEach((C, ci) => {
    const k = `${id}c${ci}`;
    if (C.gap) {
      const segs = hankinAny(C.gap, th);
      defs += `<path id="${k}l" d="${segs.map(([r, X]) => poly([r.o, X], false)).join("")}"/>`;
      sLine += stamp(k + "l", C.pts);
      if (fills.gap) { defs += `<path id="${k}f" d="${poly(C.gap)}"${paint(fills.gap)}/>`; sFill += stamp(k + "f", C.pts); }
      if (p.interlace) {
        const d2 = (e) => segs.filter(([r]) => r.fw).map(([r, , t]) => poly([sub(r.o, mul(r.u, hl - e)), add(r.o, mul(r.u, Math.max(0, Math.min(hl, 0.9 * t) - e)))], false)).join("");
        defs += `<path id="${k}p" d="${d2(0)}"/><path id="${k}g" d="${d2(1)}"/>`;
        const u = (slot, wd, q = "p") => `<use href="#${k}${q}" ${stroke(slot, wd)}/>`;
        defs += `<g id="${k}t">${u(p.gapSlot || "b", Wb + 2 * gap, "g") + (ol ? u(edge, Wb, "g") : "") + u(line, lw)}</g>`;
        sOver += stamp(k + "t", C.pts);
      }
      return;
    }
    const G = hankin(C.P, th, dl);
    let fill = "", lines = G.E.map((a, i) => "M" + [a.Sf, G.X[i], G.E[(i + 1) % C.n].Sb].map((q) => f(q[0]) + " " + f(q[1])).join(" ")).join("");
    const starFill = fills["star" + C.n] ?? fills.star;
    if (starFill) fill += `<path d="${poly(G.outline)}"${paint(starFill)}/>`;
    if (pr > 0 && C.n !== 4) { // squares sit on the tile corners; their petal edges would run along the tile edge (antialias seam)
      const inner = G.outline.map((q) => mul(q, pr));
      if (fills.petal) fill += `<path d="${G.X.map((x, i) => { const j = (i + 1) % C.n; return poly([mul(x, pr), x, ...G.tips[j], G.X[j], mul(G.X[j], pr), ...G.tips[j].map((t) => mul(t, pr)).reverse()]); }).join("")}"${paint(fills.petal)}/>`;
      if (fills.core) fill += `<path d="${poly(inner)}"${paint(fills.core)}/>`;
      lines += poly(inner) + G.X.map((x) => poly([mul(x, pr), x], false)).join("");
    } else if (fills.core) fill += `<path d="${poly(G.X)}"${paint(fills.core)}/>`;
    if (fill) { defs += `<g id="${k}f">${fill}</g>`; sFill += stamp(k + "f", C.pts); }
    defs += `<path id="${k}l" d="${lines}"/>`;
    sLine += stamp(k + "l", C.pts);
    let top = "";
    if (p.interlace && dl >= 0) {
      // the ground band and outline (g) stop a unit short of the over-strand line (p): ending on the same pixel, their antialiasing left a dark tick across the strand
      const d2 = (e) => G.E.map((a, i) => { const Cx = G.tips[i][0], back = a.dd > 1e-6 ? Math.min(hl, len(sub(Cx, a.Sf))) : hl, fw = Math.min(hl, 0.9 * len(sub(G.X[i], Cx))); return poly([sub(Cx, mul(a.uf, Math.max(0, back - e))), add(Cx, mul(a.uf, Math.max(0, fw - e)))], false); }).join("");
      defs += `<path id="${k}p" d="${d2(0)}"/><path id="${k}g" d="${d2(1)}"/>`;
      const u = (slot, wd, q = "p") => `<use href="#${k}${q}" ${stroke(slot, wd)}/>`;
      top += u(p.gapSlot || "b", Wb + 2 * gap, "g") + (ol ? u(edge, Wb, "g") : "") + u(line, lw);
    }
    if (dots && (!dots.n || dots.n.includes(C.n))) {
      const at = dots.at || "x", r = dots.r ?? 1.6;
      const ps = at === "o" ? [[0, 0]] : at === "tip" ? G.tips.map((t) => t[0]) : at === "inner" ? G.X.map((x) => mul(x, pr || 0.5)) : G.X;
      top += `<path d="${ps.map((q) => circ(q[0], q[1], at === "o" ? (dots.ro ?? r * 2.4) : r)).join("")}"${paint(dots.slot || "c")}/>`;
    }
    if (top) { defs += `<g id="${k}t">${top}</g>`; sOver += stamp(k + "t", C.pts); }
  });
  const band = (slot, wdt) => `<g ${stroke(slot, wdt, join)}>${sLine}</g>`;
  return { defs, stages: [sFill, ol ? band(edge, Wb) : "", band(line, lw), sOver] };
}
girih.cell = (p) => tiling(p).cell;
export default girih;
