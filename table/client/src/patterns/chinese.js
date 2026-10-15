// Chinese lattice and textile: ice-ray (bingwen) window lattice, step-by-step brocade window lattice (bubujin), copper-cash interlocking circles.
import { f, add, sub, mul, len, poly, circ, lattice, stamp, paint, stroke, polar } from "./engine.js";

const rect = (x, y, w, h) => `M${f(x)} ${f(y)}h${f(w)}v${f(h)}h${f(-w)}z`;
// Voronoi cells of seeded points on the periodic w x h domain (convex polygons)
export function voronoi(S, w, h) {
  const all = []; for (let i = -1; i <= 1; i++) for (let j = -1; j <= 1; j++) for (const s of S) all.push([s[0] + i * w, s[1] + j * h]);
  const clip = (P, a, b) => { const m = mul(add(a, b), 0.5), n = sub(b, a), side = (q) => (q[0] - m[0]) * n[0] + (q[1] - m[1]) * n[1], out = []; P.forEach((q, i) => { const r = P[(i + 1) % P.length], sq = side(q), sr = side(r); if (sq <= 0) out.push(q); if (sq * sr < 0) out.push(add(q, mul(sub(r, q), sq / (sq - sr)))); }); return out; };
  return S.map((s) => { let P = [[s[0] - w, s[1] - h], [s[0] + w, s[1] - h], [s[0] + w, s[1] + h], [s[0] - w, s[1] + h]]; for (const o of all) { const d = len(sub(o, s)); if (d > 1e-6 && d < w) P = clip(P, s, o); } return P; });
}

const M = {
  // ice-ray: straight wooden strips meeting at irregular angles, as in cracked ice; plum blossoms on some joints (bingmei)
  bingwen(p, ctx) {
    const g = Math.max(2, Math.min(5, Math.round(p.scale ?? 2))), gy = Math.max(2, Math.round((g * ctx.h) / ctx.w)), R = ctx.rng, { w, h } = ctx, j = p.jitter ?? 0.95;
    ctx.grid = { x: w / 2, y: h / 2, px: w / g, py: h / gy };
    // sheared rows give long straight runs and sharp corners rather than round cells
    const S = []; for (let y = 0; y < gy; y++) for (let x = 0; x < g; x++) S.push([((x + 0.5 + (y % 2) * 0.35 + (R() - 0.5) * j) * w) / g, ((y + 0.5 + (R() - 0.5) * j) * h) / gy]);
    const C = voronoi(S, w, h), sw = p.stroke ?? 3.2;
    let d = C.map((P) => poly(P)).join(""), bl = "";
    if (p.blossom) { const r = sw * 1.6; for (const P of C) for (const q of P) if (R() < p.blossom / 4) bl += [0, 72, 144, 216, 288].map((a) => { const c = add(q, polar(r * 0.75, a - 90)); return circ(c[0], c[1], r * 0.55); }).join(""); }
    return { stages: [(p.pane ? `<path d="${d}"${paint(p.pane)}/>` : "") + `<path d="${d}" ${stroke(p.line || ctx.slot, sw, ' stroke-linejoin="miter"')}/>`, bl ? `<path d="${bl}"${paint(p.blossomSlot || "c")}/>` : ""] };
  },

  // step-by-step brocade (bubujin): nested frames joined by short bars, the bars stepping round the frame
  window(p, ctx) {
    const L = lattice(ctx, p.scale || 1, false), id = ctx.id, s = L.sx, ky = L.ky, k = Math.max(1, Math.min(3, Math.round(p.nest ?? 2))), sw = p.stroke ?? 2.4;
    const H = s / 2, gap = H / (k + 1);
    let d = `M${f(-H)} ${f(-H)}h${f(s)}`  + `M${f(-H)} ${f(-H)}v${f(s)}`; // the shared outer frame: top and left edges, the neighbours draw the rest
    for (let i = 1; i <= k; i++) {
      const r = H - i * gap; d += rect(-r, -r, 2 * r, 2 * r);
      const r0 = r + gap, o = r * 0.45; // bars from this frame out to the one around it, offset so they step
      d += `M${f(-o)} ${f(-r)}V${f(-r0)}M${f(o)} ${f(r)}V${f(r0)}M${f(-r)} ${f(o)}H${f(-r0)}M${f(r)} ${f(-o)}H${f(r0)}`;
    }
    const c = p.core ? `<path d="${rect(-gap * 0.35, -gap * 0.35, gap * 0.7, gap * 0.7)}"${paint(p.core)}/>` : "";
    return { defs: `<g id="${id}U"${ky !== 1 ? ` transform="scale(1 ${f(ky * 1000) / 1000})"` : ""}><path d="${d}" ${stroke(p.line || ctx.slot, sw, ' stroke-linecap="square"')}/>${c}</g>`, stages: [stamp(id + "U", L.pts)] };
  },

  // copper cash: circles on a square lattice overlap their four neighbours (lens petals); each coin has a square hole
  coin(p, ctx) {
    const L = lattice(ctx, p.scale || 2, false), id = ctx.id, s = L.sx, ky = L.ky, r = s / Math.SQRT2, sw = p.stroke ?? 1.2;
    const lens = (dx, dy) => { const D = Math.hypot(dx, dy), m = [dx / 2, dy / 2], hh = Math.sqrt(r * r - (D / 2) ** 2), n = [(-dy / D) * hh, (dx / D) * hh], A = add(m, n), B = sub(m, n); return `M${f(A[0])} ${f(A[1] * ky)}A${f(r)} ${f(r * ky)} 0 0 1 ${f(B[0])} ${f(B[1] * ky)}A${f(r)} ${f(r * ky)} 0 0 1 ${f(A[0])} ${f(A[1] * ky)}Z`; };
    const q = s * (p.hole ?? 0.16), rim = `M${f(-r)} 0a${f(r)} ${f(r * ky)} 0 1 0 ${f(2 * r)} 0a${f(r)} ${f(r * ky)} 0 1 0 ${f(-2 * r)} 0`;
    let u = `<path d="${lens(s, 0) + lens(0, s)}"${paint(p.petal || ctx.slot)}/>`;
    u += `<path d="${rect(-q, -q * ky, 2 * q, 2 * q * ky)}"${paint(p.holeSlot || "b")} ${stroke(p.rimSlot || "c", sw).replace('fill="none" ', "")}/>`;
    return { defs: `<g id="${id}U">${u}</g><path id="${id}C" d="${rim}"/>`, stages: [stamp(id + "U", L.pts), `<g ${stroke(p.line || "c", sw)}>${stamp(id + "C", L.pts)}</g>`] };
  },
};

export default function chinese(p, ctx) {
  const m = M[p.motif];
  if (!m) throw new Error(`chinese: unknown motif "${p.motif}"`);
  return m(p, ctx);
}
