// Rosette: n-fold medallions on a square or hex lattice, with petals, star, rings, dot borders and a gap filler, always joined by
// link bands to every neighbour (and across the diagonals on a square lattice), so no medallion floats on plain ground.
import { f, add, mul, poly, circ, reg, lattice, stamp, paint, stroke, polar, starPts } from "./engine.js";

function petals(n, R, q) {
  const r0 = (q.r0 ?? 0.25) * R, r1 = (q.r1 ?? 0.9) * R, wd = q.width ?? 0.6, rot0 = q.rot ?? -90;
  return Array.from({ length: n }, (_, i) => {
    const a = rot0 + (360 * i) / n, I = polar(r0, a), O = polar(r1, a), half = (180 / n) * wd;
    if (q.shape === "kite" || q.shape === "dart") {
      const rm = q.shape === "kite" ? (r0 + r1) / 2.2 : r0 + (r1 - r0) * 0.3, rr = rm / Math.cos((half * Math.PI) / 180);
      return poly([I, polar(rr, a - half), O, polar(rr, a + half)]);
    }
    const L = r1 - r0, s = Math.max(0.1, Math.tan((half * Math.PI) / 180) * ((r0 + r1) / 2)), rho = (L * L) / 4 / s / 2 + s / 2;
    return `M${f(I[0])} ${f(I[1])}A${f(rho)} ${f(rho)} 0 0 1 ${f(O[0])} ${f(O[1])}A${f(rho)} ${f(rho)} 0 0 1 ${f(I[0])} ${f(I[1])}Z`;
  }).join("");
}

// one medallion at the origin; ky squashes it with the lattice
function medallion(n, R, p, ky) {
  let u = "";
  if (p.knock) u += `<path d="${circ(0, 0, R * p.knock.r)}"${paint(p.knock.slot || "b")}/>`;
  for (const q of p.rings || []) u += `<path d="${circ(0, 0, R * q.r)}" ${stroke(q.slot || "c", q.w ?? 1.2)}${q.dash ? ` stroke-dasharray="${q.dash}"` : ""}/>`;
  for (const q of [].concat(p.petals || [])) u += `<path d="${petals(n * (q.mult || 1), R, q)}"${paint(q.slot || "a")}${q.line ? ` ${stroke(q.line, q.lw ?? 0.8).replace('fill="none"', "")}` : ""}/>`;
  if (p.star) { const s = p.star, Rs = R * (s.r ?? 0.5); u += `<path d="${poly(starPts(s.n || n, Rs, Rs * (s.inner ?? 0.55), s.rot ?? -90))}"${paint(s.slot || "c")}/>`; }
  for (const q of [].concat(p.dots || [])) u += `<path d="${reg(n * (q.mult || 2), R * q.r, q.rot ?? -90).map((v) => circ(v[0], v[1], q.size ?? 1.2)).join("")}"${paint(q.slot || "c")}/>`;
  if (p.disc) u += `<path d="${circ(0, 0, R * p.disc.r)}"${paint(p.disc.slot || "c")}/>`;
  return ky === 1 ? u : `<g transform="scale(1 ${f(ky * 1000) / 1000})">${u}</g>`;
}

export default function rosette(p, ctx) {
  const hex = p.lattice ? p.lattice === "hex" : ctx.hex, L = lattice(ctx, p.scale || 1, hex), id = ctx.id;
  const n = p.n || (hex ? 6 : 8), R = (L.sx / 2) * (p.size ?? 0.92), ky = Math.round(L.ky * 1000) / 1000;
  const gaps = hex ? L.pts.flatMap((q) => [[q[0] + L.sx / 2, q[1] + L.sy / 3], [q[0] + L.sx, q[1] + (2 * L.sy) / 3]]) : L.pts.map((q) => [q[0] + L.sx / 2, q[1] + L.sy / 2]);
  let defs = `<g id="${id}M">${medallion(n, R, p, ky)}</g>`, sLink = "", sFill = "";
  {
    const lk = p.links || {}, nb = hex ? [[L.sx, 0], [L.sx / 2, L.sy], [-L.sx / 2, L.sy]] : [[L.sx, 0], [0, L.sy], ...(lk.diag !== false ? [[L.sx, L.sy], [-L.sx, L.sy]] : [])];
    sLink = `<path d="${L.pts.flatMap((q) => nb.map((o) => poly([q, add(q, o)], false))).join("")}" ${stroke(lk.slot || "a", Math.max(1, lk.w ?? 1.6))}/>`;
  }
  if (p.filler) {
    const q = p.filler, rf = (q.size ?? 0.3) * (L.sx / 2), k = q.n || (hex ? 6 : 4);
    let g = "";
    if (q.kind === "rosette") g = medallion(k, rf, q, ky);
    else {
      const d = q.kind === "dot" ? circ(0, 0, rf * 0.45) : q.kind === "diamond" ? poly(reg(4, rf, -90)) : q.kind === "cross" ? poly(starPts(4, rf, rf * 0.22)) : poly(starPts(k, rf, rf * (q.inner ?? 0.45)));
      g = `<path d="${d}"${paint(q.slot || "c")}/>` + (q.dot ? `<path d="${circ(0, 0, q.dot)}"${paint(q.dotSlot || "b")}/>` : "");
      if (ky !== 1) g = `<g transform="scale(1 ${ky})">${g}</g>`;
    }
    defs += `<g id="${id}G">${g}</g>`;
    sFill = stamp(id + "G", gaps);
  }
  return { defs, stages: [sLink, stamp(id + "M", L.pts) + sFill] };
}
