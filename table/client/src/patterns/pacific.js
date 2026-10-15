// Pacific bark cloth (tapa, siapo, ngatu): bands of sawtooth triangles, nested chevrons and lozenge chains between ruled lines.
import { f, poly, paint, stroke } from "./engine.js";

const M = {
  tapa(p, ctx) {
    const seq = p.seq || ["saw", "chevron", "lozenge"], nb = Math.max(2, Math.round(((p.bands ?? 2) * ctx.h) / ctx.w)), bh = ctx.h / nb, n = Math.max(2, Math.round(p.scale ?? 3)), s = ctx.w / n, sw = p.stroke ?? 1.3;
    ctx.grid = { x: s / 2, y: bh / 2, px: s, py: bh };
    let rule = "", fill = "", line = "";
    for (let j = 0; j < nb; j++) {
      const y0 = j * bh, m = bh * 0.14, top = y0 + m, bot = y0 + bh - m, kind = seq[j % seq.length];
      rule += `M0 ${f(y0)}h${f(ctx.w)}M0 ${f(top)}h${f(ctx.w)}M0 ${f(bot)}h${f(ctx.w)}`;
      for (let i = 0; i < n; i++) {
        const x = i * s;
        if (kind === "saw") fill += poly([[x, bot], [x + s / 2, top], [x + s, bot]]);
        else if (kind === "chevron") for (const k of [0, 0.33, 0.66]) line += `M${f(x)} ${f(top + k * (bot - top))}L${f(x + s / 2)} ${f(bot - (1 - k) * (bot - top) * 0.55)}L${f(x + s)} ${f(top + k * (bot - top))}`;
        else fill += poly([[x, (top + bot) / 2], [x + s / 2, top], [x + s, (top + bot) / 2], [x + s / 2, bot]]) + poly([[x + s * 0.32, (top + bot) / 2], [x + s / 2, top + (bot - top) * 0.3], [x + s * 0.68, (top + bot) / 2], [x + s / 2, bot - (bot - top) * 0.3]]);
      }
    }
    return { stages: [`<path d="${fill}" fill-rule="evenodd"${paint(p.fill || ctx.slot)}/><path d="${line}" ${stroke(p.line || ctx.slot, sw)}/><path d="${rule}" ${stroke(p.rule || ctx.slot, sw)}/>`] };
  },
};

export default function pacific(p, ctx) {
  const m = M[p.motif];
  if (!m) throw new Error(`pacific: unknown motif "${p.motif}"`);
  return m(p, ctx);
}
