// African textile and wall traditions, as generic geometry only: bogolan (Mali mud cloth) bands, Ndebele-style stepped wall painting,
// and an adinkra-like stamped grid (comb-drawn grid with a generic stamp; no specific Adinkra symbol).
import { f, poly, circ, lattice, stamp, paint, stroke } from "./engine.js";

const rect = (x, y, w, h) => `M${f(x)} ${f(y)}h${f(w)}v${f(h)}h${f(-w)}z`;
// stepped lozenge of radius R in k steps (Ndebele, Andean)
export function stepDiamond(R, k, ky = 1) {
  const q = []; for (let i = 0; i < k; i++) q.push([(i * R) / k, -R + (i * R) / k], [((i + 1) * R) / k, -R + (i * R) / k]);
  const Q = [...q, [R, 0]], all = [...Q, ...Q.slice(0, -1).reverse().map(([x, y]) => [x, -y]), ...Q.slice(1).map(([x, y]) => [-x, -y]), ...Q.slice(1, -1).reverse().map(([x, y]) => [-x, y])];
  return poly(all.map(([x, y]) => [x, y * ky]));
}

const M = {
  // bogolan: horizontal bands between double rules; each band carries crosses on a line, a zigzag, dots on a line or a ladder
  bogolan(p, ctx) {
    const seq = p.seq || ["cross", "zigzag", "dots", "ladder"], nb = 2 * Math.max(1, Math.round(((p.bands ?? 2) * ctx.h) / ctx.w / 2)), bh = ctx.h / nb, n = Math.max(2, Math.round(p.scale ?? 3)), s = ctx.w / n, sw = p.stroke ?? 1.8;
    ctx.grid = { x: s / 2, y: bh / 2, px: bh, py: bh * 2 };
    let L = "", D = "";
    for (let j = 0; j < nb; j++) {
      const y0 = j * bh, yc = y0 + bh / 2, a = bh * 0.3, kind = seq[j % seq.length];
      L += `M0 ${f(y0)}h${f(ctx.w)}M0 ${f(y0 + sw * 2.2)}h${f(ctx.w)}`;
      if (kind === "zigzag") L += "M" + Array.from({ length: 2 * n + 1 }, (_, k) => f((k * s) / 2) + " " + f(yc + (k % 2 ? -a : a))).join("L");
      else L += `M0 ${f(yc)}h${f(ctx.w)}`;
      for (let i = 0; i < n; i++) {
        const x = i * s + s / 2;
        if (kind === "cross") L += `M${f(x - a)} ${f(yc - a)}l${f(2 * a)} ${f(2 * a)}M${f(x - a)} ${f(yc + a)}l${f(2 * a)} ${f(-2 * a)}`;
        else if (kind === "dots") D += circ(x, yc, sw * 1.5) + circ(x - s / 2, yc, sw * 0.9);
        else if (kind === "ladder") L += `M${f(x - s * 0.3)} ${f(yc - a)}v${f(2 * a)}M${f(x)} ${f(yc - a)}v${f(2 * a)}M${f(x + s * 0.3)} ${f(yc - a)}v${f(2 * a)}`;
      }
      if (kind !== "zigzag") L += `M0 ${f(yc - a)}h${f(ctx.w)}M0 ${f(yc + a)}h${f(ctx.w)}`; // the rails that hold each row of marks
    }
    return { stages: [`<path d="${L}" ${stroke(p.line || ctx.slot, sw)}/><path d="${D}"${paint(p.dotSlot || ctx.slot)}/>`] };
  },

  // Ndebele-style: fields of colour outlined in heavy lines; a stepped lozenge with a stepped core, stepped corner fields, a bar down every seam
  ndebele(p, ctx) {
    const L = lattice(ctx, p.scale || 2, false), id = ctx.id, s = L.sx, ky = L.ky, h = s / 2, k = Math.max(2, Math.min(5, Math.round(p.steps ?? 3))), lw = s * (p.outline ?? 0.035);
    const ol = (slot) => ` ${stroke(p.line || "b", lw, ' stroke-linejoin="miter"').replace('fill="none" ', "")}${paint(slot)}`;
    let u = `<path d="${rect(-h, -h * ky, s, s * ky)}"${ol(p.field || "c/0.8")}/>`;
    u += `<path d="${rect(-h, -h * ky, s * 0.1, s * ky)}"${ol(p.bar || ctx.slot + "/0.6")}/>`;
    u += `<path d="${stepDiamond(h * 0.82, k, ky)}"${ol(p.lozenge || ctx.slot)}/><path d="${stepDiamond(h * 0.4, Math.max(1, k - 1), ky)}"${ol(p.core || "c")}/>`;
    return { defs: `<g id="${id}U">${u}</g>`, stages: [stamp(id + "U", L.pts)] };
  },

  // stamped grid: comb-drawn bundles of rules divide the cloth into squares; each square carries the same generic stamp
  stampgrid(p, ctx) {
    const L = lattice(ctx, p.scale || 2, false), id = ctx.id, s = L.sx, ky = L.ky, h = s / 2, c = Math.max(2, Math.min(4, Math.round(p.comb ?? 3))), g = s * 0.035, sw = p.stroke ?? 0.8;
    let comb = ""; for (let i = 0; i < c; i++) comb += `M${f(-h)} ${f((-h + i * g) * ky)}h${f(s)}M${f(-h + i * g)} ${f(-h * ky)}v${f(s * ky)}`;
    const r = (h - c * g) * 0.62, kind = p.stamp || "diamond";
    const st = kind === "ring" ? `<path d="${circ(0, 0, r) + circ(0, 0, r * 0.55)}" ${stroke(p.stampSlot || "c", sw * 1.6)}/><path d="${circ(0, 0, r * 0.18)}"${paint(p.stampSlot || "c")}/>`
      : kind === "cross" ? `<path d="M${f(-r)} 0h${f(2 * r)}M0 ${f(-r * ky)}v${f(2 * r * ky)}" ${stroke(p.stampSlot || "c", sw * 2.4)}/><path d="${rect(-r * 0.3, -r * 0.3 * ky, r * 0.6, r * 0.6 * ky)}"${paint(p.stampSlot || "c")}/>`
      : `<path d="${poly([[0, -r * ky], [r, 0], [0, r * ky], [-r, 0]]) + poly([[0, -r * 0.55 * ky], [r * 0.55, 0], [0, r * 0.55 * ky], [-r * 0.55, 0]])}" ${stroke(p.stampSlot || "c", sw * 1.6)}/><path d="${poly([[0, -r * 0.16 * ky], [r * 0.16, 0], [0, r * 0.16 * ky], [-r * 0.16, 0]])}"${paint(p.stampSlot || "c")}/>`;
    const tie = `<path d="M${f(-h + c * g)} 0H${f(-r)}M${f(r)} 0H${f(h)}" ${stroke(p.line || ctx.slot, sw)}/>`;
    return { defs: `<g id="${id}U"><path d="${comb}" ${stroke(p.line || ctx.slot, sw)}/>${p.tie === false ? "" : tie}${st}</g>`, stages: [stamp(id + "U", L.pts)] };
  },
};

export default function african(p, ctx) {
  const m = M[p.motif];
  if (!m) throw new Error(`african: unknown motif "${p.motif}"`);
  return m(p, ctx);
}
