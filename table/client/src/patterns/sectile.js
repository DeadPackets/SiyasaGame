// Opus sectile and Cosmati: roundels linked by bands, cut-stone wheels of triangles inside, a lozenge in the field between (Roman, Byzantine, medieval Rome).
import { f, poly, circ, lattice, stamp, paint, stroke, polar } from "./engine.js";

const M = {
  cosmati(p, ctx) {
    const L = lattice(ctx, p.scale || 2, false), id = ctx.id, s = L.sx, ky = L.ky, R = s * (p.size ?? 0.3), bw = s * (p.band ?? 0.05), n = Math.max(4, Math.min(12, Math.round(p.n ?? 8)));
    const sq = (P) => P.map(([x, y]) => [x, y * ky]), r = R - bw;
    // the wheel: 2n triangles from the centre, alternating slots
    let wa = "", wc = "";
    for (let i = 0; i < 2 * n; i++) { const t = poly(sq([[0, 0], polar(r, -90 + (180 * i) / n), polar(r, -90 + (180 * (i + 1)) / n)])); i % 2 ? (wc += t) : (wa += t); }
    // links: two rails from roundel to roundel, a row of triangles between them
    const span = s - 2 * R, k = Math.max(2, Math.round(span / (bw * 3))), tw = span / k, rails = `M${f(R)} ${f(-bw)}h${f(span)}M${f(R)} ${f(bw)}h${f(span)}`;
    let tri = ""; for (let i = 0; i < k; i++) tri += poly([[R + i * tw, bw], [R + (i + 0.5) * tw, -bw], [R + (i + 1) * tw, bw]]);
    const link = `<g id="${id}L"><path d="${rails}" ${stroke(p.line || ctx.slot, bw * 0.6)}/><path d="${tri}"${paint(p.inlay || "c/0.7")}/></g>`;
    const lz = s * (p.field ?? 0.13), field = poly(sq([[s / 2, s / 2 - lz], [s / 2 + lz, s / 2], [s / 2, s / 2 + lz], [s / 2 - lz, s / 2]]));
    const u = `<path d="${wa}"${paint(p.wheel || ctx.slot)}/><path d="${wc}"${paint(p.wheel2 || "c")}/><path d="M${f(-R)} 0a${f(R)} ${f(R * ky)} 0 1 0 ${f(2 * R)} 0a${f(R)} ${f(R * ky)} 0 1 0 ${f(-2 * R)} 0" ${stroke(p.line || ctx.slot, bw * 1.2)}/>`
      + `<use href="#${id}L"${ky !== 1 ? ` transform="scale(1 ${f(ky * 1000) / 1000})"` : ""}/><use href="#${id}L" transform="rotate(90)${ky !== 1 ? ` scale(${f(ky * 1000) / 1000} 1)` : ""}"/><path d="${field}"${paint(p.fieldSlot || ctx.slot + "/0.6")}/>`;
    return { defs: `${link}<g id="${id}U">${u}</g>`, stages: [stamp(id + "U", L.pts)] };
  },
};

export default function sectile(p, ctx) {
  const m = M[p.motif];
  if (!m) throw new Error(`sectile: unknown motif "${p.motif}"`);
  return m(p, ctx);
}
