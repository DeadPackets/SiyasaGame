// Maritime: knotted fishing net, laid rope, the running-dog wave (Greek and Roman, then every navy and port).
import { f, circ, lattice, stamp, paint, stroke } from "./engine.js";
import { spiral } from "./organic.js";

const leaf = (A, B, sag) => { const L = Math.hypot(B[0] - A[0], B[1] - A[1]), rho = (L * L / 4 + sag * sag) / (2 * sag); return `M${f(A[0])} ${f(A[1])}A${f(rho)} ${f(rho)} 0 0 1 ${f(B[0])} ${f(B[1])}A${f(rho)} ${f(rho)} 0 0 1 ${f(A[0])} ${f(A[1])}Z`; };

const M = {
  // diamond mesh of cord with a knot at every crossing
  net(p, ctx) {
    const L = lattice(ctx, p.scale || 2, false), id = ctx.id, s = L.sx, sy = L.sy, sw = p.stroke ?? 1.8;
    let d = ""; for (const q of L.pts) d += `M${f(q[0] - s / 2)} ${f(q[1] - sy / 2)}l${f(s)} ${f(sy)}M${f(q[0] - s / 2)} ${f(q[1] + sy / 2)}l${f(s)} ${f(-sy)}`;
    const k = sw * (p.knot ?? 1.5), knot = `<path d="${circ(0, 0, k)}"${paint(p.knotSlot || "c")}/><path d="M${f(-k * 1.8)} ${f(-k * 0.6)}l${f(k * 3.6)} ${f(k * 1.2)}" ${stroke(p.knotSlot || "c", sw * 0.7)}/>`;
    return { defs: `<g id="${id}K">${knot}</g>`, stages: [`<path d="${d}" ${stroke(p.line || ctx.slot, sw)}/>`, stamp(id + "K", L.pts)] };
  },

  // laid rope: rows of slanted strands; cross adds ropes running down
  rope(p, ctx) {
    const rows = Math.max(1, Math.round(p.rows ?? 3)), rh = ctx.h / rows, n = Math.max(4, Math.round(p.scale ?? 8)), pit = ctx.w / n, wdt = rh * (p.thick ?? 0.62), sag = pit * 0.36;
    ctx.grid = { x: pit / 2, y: rh / 2, px: rh, py: rh };
    let d = "";
    for (let j = 0; j < rows; j++) { const yc = (j + 0.5) * rh; for (let i = 0; i < n; i++) { const x = i * pit; d += leaf([x - pit * 0.75, yc + wdt / 2], [x + pit * 0.75, yc - wdt / 2], sag); } }
    let v = "";
    if (p.cross) { const m = Math.max(1, Math.round(p.cross)), cw = ctx.w / m, k = Math.round(ctx.h / pit); for (let i = 0; i < m; i++) for (let j = 0; j < k; j++) { const x = (i + 0.5) * cw, y = (j * ctx.h) / k; v += leaf([x - wdt / 2, y - pit * 0.45], [x + wdt / 2, y + pit * 0.45], sag); } }
    const lay = (dd) => `<path d="${dd}" ${stroke(p.lay || "b", p.layWidth ?? 0.8)}/>`; // the lay line between strands, over every strand
    return { stages: [(v ? `<path d="${v}"${paint(p.strand2 || ctx.slot + "/0.7")}/>` + lay(v) : "") + `<path d="${d}"${paint(p.strand || ctx.slot)}/>`, lay(d)] };
  },

  // running dog: from a baseline each wave rises, breaks forward over its crest and curls into a spiral; alternate rows run upside down
  wave(p, ctx) {
    const rows = 2 * Math.max(1, Math.round(((p.rows ?? 3) * ctx.h) / ctx.w / 2)), rh = ctx.h / rows, H = rh * 0.86, n = Math.max(1, Math.round(ctx.w / (H * (p.spread ?? 1.3)))), lam = ctx.w / n, r0 = H * 0.28, sw = p.stroke ?? 2.6;
    ctx.grid = { x: lam / 2, y: rh / 2, px: 2 * rh, py: 2 * rh };
    let d = "";
    for (let j = 0; j < rows; j++) {
      const up = j % 2 === 0, v = up ? 1 : -1, yb = up ? (j + 1) * rh - (rh - H) / 2 : j * rh + (rh - H) / 2;
      d += `M0 ${f(yb)}h${f(ctx.w)}`;
      for (let i = 0; i < n; i++) {
        const x0 = i * lam + (up ? 0 : lam * 0.5), Q = [x0 + lam * 0.34 * v, yb - v * H * 0.42];
        d += `M${f(x0)} ${f(yb)}Q${f(x0 + lam * 0.3 * v)} ${f(yb)} ${f(Q[0])} ${f(Q[1])}` + spiral(Q, [0, -v], r0, 1, p.decay ?? 0.6, p.turns ?? 1.4).d.replace(/^M[^A]*/, "");
      }
    }
    return { stages: [`<path d="${d}" ${stroke(p.line || ctx.slot, sw, ' stroke-linecap="round" stroke-linejoin="round"')}/>`] };
  },
};

export default function maritime(p, ctx) {
  const m = M[p.motif];
  if (!m) throw new Error(`maritime: unknown motif "${p.motif}"`);
  return m(p, ctx);
}

