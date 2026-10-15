// Japanese motifs: asanoha, seigaiha, shippo, kikko, sayagata, kagome.
import { S3, f, add, sub, mul, len, isect, poly, circ, reg, lattice, stamp, paint, stroke, polar } from "./engine.js";

const cyc = (a, i) => (Array.isArray(a) ? a[i % a.length] : a);

const M = {
  // hemp leaf: triangular grid plus spokes from each triangle's centroid to its corners; facets shade the 6 sub-triangle classes
  asanoha(p, ctx) {
    const L = lattice(ctx, p.scale || 2, true), d = L.sx, sy = L.sy, id = ctx.id;
    const up = [[0, 0], [d, 0], [d / 2, sy]], dn = [[d, 0], [d / 2, sy], [(3 * d) / 2, sy]];
    const cen = (t) => mul(add(add(t[0], t[1]), t[2]), 1 / 3);
    let fills = "", lines = "";
    const fac = p.facets || [];
    [up, dn].forEach((t, ti) => {
      const g = cen(t);
      t.forEach((v, i) => {
        const s = cyc(fac, ti * 3 + i);
        if (s && s !== "none") fills += `<path d="${poly([g, v, t[(i + 1) % 3]])}"${paint(s)}/>`;
        lines += poly([g, v], false);
      });
    });
    if (p.edges !== false) lines += poly([[d / 2, sy], [0, 0], [d, 0]], false) + poly([[0, 0], [-d / 2, sy]], false);
    const sw = p.stroke ?? 1.6;
    let defs = `<path id="${id}L" d="${lines}"/>`;
    if (fills) defs += `<g id="${id}F">${fills}</g>`;
    const ln = (slot, w) => `<g ${stroke(slot, w, ' stroke-linecap="round"')}>${stamp(id + "L", L.pts)}</g>`;
    const dot = p.dots ? `<path d="${L.pts.map((q) => circ(q[0], q[1], p.dots.r ?? 1.8)).join("")}"${paint(p.dots.slot || "c")}/>` : "";
    return { defs, stages: [fills ? stamp(id + "F", L.pts) : "", p.outline ? ln(p.edge || "b", sw + 2 * p.outline) : "", ln(p.line || ctx.slot, sw), dot] };
  },

  // waves: overlapping fans of concentric rings, painted row by row (self-covering so overlaps stay in order)
  seigaiha(p, ctx) {
    const n = p.scale || 3, R = ctx.w / n / 2, id = ctx.id;
    const rows = 2 * Math.max(1, Math.round(ctx.h / (R / 2) / 2)), sy = ctx.h / rows;
    ctx.grid = { x: 0, y: -sy, px: 2 * R, py: 2 * sy }; // a fan shows above its circle centre
    const k = p.rings || 4, seq = p.seq || [ctx.slot, "b"], ow = p.outline ?? 0.8;
    let u = "";
    for (let i = 0; i < k; i++) {
      const r = R * (p.outer ?? 1) * (1 - i / k), s = cyc(seq, i);
      u += `<path d="${circ(0, 0, r - (i === 0 ? 0 : 0))}"${paint(s)}${i === 0 && ow ? ` ${stroke(p.edge || "c", ow).replace('fill="none"', "")}` : ""}/>`;
    }
    if (p.dot) u += `<path d="${circ(0, -R * 0.15, p.dot)}"${paint(p.dotSlot || "c")}/>`;
    // a row is a group of fans; rows are painted top to bottom so later rows overlap earlier ones
    const H = ctx.h * ctx.span, Wd = ctx.w * ctx.span, xs = [];
    for (let i = -1; i * 2 * R <= Wd + R + 0.5; i++) xs.push([i * 2 * R, 0]);
    let rs = "";
    for (let j = -2; j * sy <= H + R + 0.5; j++) rs += `<use href="#${id}${((j % 2) + 2) % 2 ? "O" : "E"}" y="${f(j * sy)}"/>`;
    return { self: true, defs: `<g id="${id}U">${u}</g><g id="${id}E">${stamp(id + "U", xs)}</g><g id="${id}O" transform="translate(${f(R)} 0)"><use href="#${id}E"/></g>`, stages: [rs] };
  },

  // seven treasures: interleaved circles; each circle splits into 4 lenses and a concave core
  shippo(p, ctx) {
    const L = lattice(ctx, p.scale || 2, false), s = L.sx, r = s / 2, id = ctx.id;
    const pts = L.pts.flatMap((q) => [q, [q[0] + s / 2, q[1] + L.sy / 2]]);
    const lens = (b) => { const m = mul(b, 0.5), hh = Math.sqrt(r * r - (len(b) / 2) ** 2), nn = mul([-b[1], b[0]], hh / len(b)), p1 = add(m, nn), p2 = sub(m, nn); return `M${f(p1[0])} ${f(p1[1])}A${f(r)} ${f(r)} 0 0 1 ${f(p2[0])} ${f(p2[1])}A${f(r)} ${f(r)} 0 0 1 ${f(p1[0])} ${f(p1[1])}Z`; };
    const sw = Math.max(0.8, p.stroke ?? 1.4); // the circles are the network that joins the lenses
    let u = `<path d="${circ(0, 0, r)}"${paint(p.core || "b")}/>`;
    u += `<path d="${lens([s / 2, L.sy / 2]) + lens([s / 2, -L.sy / 2])}"${paint(p.lens || ctx.slot)}/>`;
    let defs = `<g id="${id}U">${u}</g><path id="${id}C" d="${circ(0, 0, r)}"/>`;
    let top = "";
    if (p.dot) top += `<path d="${pts.map((q) => circ(q[0], q[1], p.dot)).join("")}"${paint(p.dotSlot || "c")}/>`;
    if (p.ring) top += `<path d="${pts.map((q) => circ(q[0], q[1], r * p.ring)).join("")}" ${stroke(p.ringSlot || "c", sw * 0.8)}/>`;
    return { defs, stages: [stamp(id + "U", pts), `<g ${stroke(p.line && p.line !== "none" ? p.line : "c", sw)}>${stamp(id + "C", pts)}</g>`, top] };
  },

  // tortoiseshell: inset hexagons with nested rings and an inner device
  kikko(p, ctx) {
    const L = lattice(ctx, p.scale || 2, true), d = L.sx, id = ctx.id;
    const R = d / S3 - (p.gap ?? 1.5) / Math.cos(Math.PI / 6), seq = p.seq || [ctx.slot, "b"], k = p.rings || 2;
    const hx = (r) => reg(6, r, 30).map((v) => [v[0], v[1] * L.ky]);
    // the outline stroke goes on the rings only: stroked cusps of the inner device rasterise differently where a tile edge cuts them
    const st = p.stroke ? ` ${stroke(p.line || "c", p.stroke, ' stroke-linejoin="round"').replace('fill="none"', "")}` : "";
    let u = "";
    for (let i = 0; i < k; i++) u += `<path d="${poly(hx(R * (1 - (i * (p.step ?? 0.22)))))}"${paint(cyc(seq, i))}${st}/>`;
    const ri = R * (1 - k * (p.step ?? 0.22)) + R * 0.1, inn = p.inner || "y", is = p.innerSlot || "c";
    if (inn === "y") u += `<path d="${[90, 210, 330].map((a) => poly([[0, 0], hx(ri)[[90, 210, 330].indexOf(a) * 2 + 1]], false)).join("")}" ${stroke(is, p.innerWidth ?? 1.6)}/>`;
    if (inn === "dot") u += `<path d="${circ(0, 0, ri * 0.45)}"${paint(is)}/>`;
    if (inn === "star") u += `<path d="${poly(reg(3, ri, -90)) + poly(reg(3, ri, 90))}"${paint(is)}/>`;
    if (inn === "flower") u += `<path d="${[0, 1, 2, 3, 4, 5].map((i) => { const a = polar(ri * 0.95, -90 + i * 60); return `M0 0Q${f(a[0] * 0.9 + a[1] * 0.35)} ${f(a[1] * 0.9 - a[0] * 0.35)} ${f(a[0])} ${f(a[1])}Q${f(a[0] * 0.9 - a[1] * 0.35)} ${f(a[1] * 0.9 + a[0] * 0.35)} 0 0`; }).join("")}"${paint(is)}/>`;
    return { defs: `<g id="${id}U">${u}</g>`, stages: [stamp(id + "U", L.pts)] };
  },

  // interlocked key fret: manji at the lattice points and the half-step points; hooks join into continuous lines
  sayagata(p, ctx) {
    const L = lattice(ctx, p.scale || 2, false), s = L.sx, a = s / 4, ky = L.ky, id = ctx.id;
    const arm = [0, 1, 2, 3].map((r) => { const R = (v) => { const q = [[v[0], v[1]], [-v[1], v[0]], [-v[0], -v[1]], [v[1], -v[0]]][r]; return [q[0], q[1] * ky]; }; return poly([[0, 0], R([a, 0]), R([a, a])], false); }).join("");
    const pts = L.pts.flatMap((q) => [q, [q[0] + s / 2, q[1] + L.sy / 2]]);
    const sw = p.stroke ?? 2.2;
    let extra = "";
    if (p.box) extra += `<path d="${L.pts.flatMap((q) => [[q[0] + s / 2, q[1]], [q[0], q[1] + L.sy / 2]]).map((q) => poly(reg(4, a * (p.boxSize ?? 0.5), 45, q))).join("")}"${paint(p.box)}/>`;
    if (p.dot) extra += `<path d="${pts.map((q) => circ(q[0], q[1], p.dot)).join("")}"${paint(p.dotSlot || "c")}/>`;
    const ln = (slot, w) => `<g ${stroke(slot, w, ' stroke-linecap="square"')}>${stamp(id + "A", pts)}</g>`;
    return { defs: `<path id="${id}A" d="${arm}"/>`, stages: [extra, p.outline ? ln(p.edge || "c", sw + 2 * p.outline) : "", ln(p.line || ctx.slot, sw)] };
  },

  // basket weave: three line families at 60 degrees, true over-under (family k passes over family k+1)
  kagome(p, ctx) {
    const { w, h } = ctx, m = Math.max(0.5, Math.round((h / (w * S3)) * 2) / 2), N = m % 1 ? 2 * Math.ceil((p.scale || 2) / 2) : p.scale || 2;
    const Hi = w * S3 * m, ky = h / Hi, s0 = (w * S3) / 2 / N;
    ctx.grid = { x: w - s0 / S3, y: 0, px: (2 * s0) / S3, py: 2 * s0 * ky }; // hexagon centres
    const fam = [90, 210, 330].map((a, k) => ({ nrm: polar(1, a), off: k === 0 ? 0.5 : 0 }));
    const sw = p.stroke ?? 2.2, ol = p.outline ?? 0.8, gap = p.gap ?? 1, Wb = sw + 2 * ol;
    const lines = fam.map((F) => {
      const out = [], t = [-F.nrm[1], F.nrm[0]];
      for (let j = -40; j <= 40; j++) {
        const c = s0 * (j + F.off), p0 = mul(F.nrm, c), hits = [];
        for (const [x0, y0, x1, y1] of [[0, 0, w, 0], [0, Hi, w, Hi], [0, 0, 0, Hi], [w, 0, w, Hi]]) {
          const q = isect(p0, t, [x0, y0], [x1 - x0, y1 - y0]);
          if (q[0] >= -1e-6 && q[0] <= w + 1e-6 && q[1] >= -1e-6 && q[1] <= Hi + 1e-6) hits.push(q);
        }
        if (hits.length >= 2) { hits.sort((A, B) => (A[0] - B[0]) * t[0] + (A[1] - B[1]) * t[1]); const A = hits[0], B = hits[hits.length - 1]; if (len(sub(A, B)) > 0.01) out.push({ c, A, B, t }); }
      }
      return out;
    });
    const Y = (q) => [q[0], q[1] * ky];
    const all = lines.flat().map((l) => poly([Y(l.A), Y(l.B)], false)).join("");
    let over = "";
    if (p.interlace !== false) {
      const hl = (Wb / 2 + gap) / Math.sin(Math.PI / 3) + Wb / 2;
      for (let k = 0; k < 3; k++) for (const a of lines[k]) for (const b of lines[(k + 1) % 3]) {
        const q = isect(a.A, a.t, b.A, b.t);
        if (q[0] < 0 || q[0] >= w || q[1] < 0 || q[1] >= Hi) continue;
        over += poly([Y(sub(q, mul(a.t, hl))), Y(add(q, mul(a.t, hl)))], false);
      }
    }
    const id = ctx.id, line = p.line || ctx.slot, edge = p.edge || "b", U = (k, slot, wd) => `<use href="#${id}${k}" ${stroke(slot, wd)}/>`;
    return { defs: `<path id="${id}A" d="${all}"/>` + (over ? `<path id="${id}V" d="${over}"/>` : ""), stages: [(ol ? U("A", edge, Wb) : "") + U("A", line, sw), over ? U("V", p.gapSlot || "b", Wb + 2 * gap) + (ol ? U("V", edge, Wb) : "") + U("V", line, sw) : ""] };
  },
};

export default function japanese(p, ctx) {
  const m = M[p.motif];
  if (!m) throw new Error(`japanese: unknown motif "${p.motif}"`);
  return m(p, ctx);
}
