// Twentieth-century modern: constructivist bars and discs, mid-century breeze-block screens, the Swiss grid, Memphis-lite. Round 5 removed coffers, pinstripe and Truchet curves.
import { f, circ, lattice, stamp, paint, stroke } from "./engine.js";

const rect = (x, y, w, h) => `M${f(x)} ${f(y)}h${f(w)}v${f(h)}h${f(-w)}z`;
const tri = (a, b, c) => `M${f(a[0])} ${f(a[1])}L${f(b[0])} ${f(b[1])}L${f(c[0])} ${f(c[1])}Z`;

const M = {
  // constructivist: heavy diagonal bars one way, light rules the other, a ring on every other crossing
  constructivist(p, ctx) {
    const n = Math.max(1, Math.round(p.scale || 2)), s = ctx.w / n, ny = Math.max(1, Math.round((n * ctx.h) / ctx.w)), sy = ctx.h / ny, w = s * (p.bar ?? 0.16);
    ctx.grid = { x: s / 2, y: sy / 2, px: s, py: sy };
    let heavy = "", light = "", ring = "";
    for (let i = 0; i < n; i++) for (let j = 0; j < ny; j++) { const x = i * s, y = j * sy; heavy += `M${f(x)} ${f(y + sy)}l${f(s)} ${f(-sy)}`; light += `M${f(x)} ${f(y)}l${f(s)} ${f(sy)}`; ring += circ(x + s / 2, y + sy / 2, s * (p.ring ?? 0.2)); }
    return { stages: [`<path d="${light}" ${stroke(p.lightSlot || ctx.slot + "/0.5", w * 0.25, ' stroke-linecap="square"')}/><path d="${heavy}" ${stroke(p.line || ctx.slot, w, ' stroke-linecap="square"')}/>`, `<path d="${ring}" ${stroke(p.ringSlot || "c", w * 0.5)}/>`] };
  },

  // breeze-block screen (claustra): cast concrete blocks with a pierced opening, laid edge to edge; the concrete is one network,
  // a thin joint marks each block and a lit rim gives the openings depth. opening: circle | petal | diamond
  breeze(p, ctx) {
    const L = lattice(ctx, p.scale || 2, false), id = ctx.id, s = L.sx, ky = L.ky, h = s / 2, kind = p.opening || "circle";
    const E = (x, y, r) => `M${f(x - r)} ${f(y * ky)}a${f(r)} ${f(r * ky)} 0 1 0 ${f(2 * r)} 0a${f(r)} ${f(r * ky)} 0 1 0 ${f(-2 * r)} 0`;
    const D = (x, y, r) => `M${f(x)} ${f((y - r) * ky)}L${f(x + r)} ${f(y * ky)}L${f(x)} ${f((y + r) * ky)}L${f(x - r)} ${f(y * ky)}Z`;
    const corners = (g) => [[-h, -h], [h, -h], [-h, h], [h, h]].map(([x, y]) => g(x, y)).join("");
    const hole = kind === "petal" ? [[0, -0.19], [0.19, 0], [0, 0.19], [-0.19, 0]].map(([x, y]) => E(x * s, y * s, s * 0.165)).join("") + E(0, 0, s * 0.2) + corners((x, y) => E(x, y, s * 0.09))
      : kind === "diamond" ? D(0, 0, s * 0.36) + corners((x, y) => D(x, y, s * 0.12)) : E(0, 0, s * 0.34) + corners((x, y) => E(x, y, s * 0.12));
    const rim = kind === "diamond" ? `M${f(-s * 0.36)} 0L0 ${f(-s * 0.36 * ky)}L${f(s * 0.36)} 0` : kind === "petal" ? "" : `M${f(-s * 0.34 * 0.92)} ${f(s * 0.34 * 0.39 * ky)}A${f(s * 0.34)} ${f(s * 0.34 * ky)} 0 0 1 ${f(s * 0.34 * 0.39)} ${f(-s * 0.34 * 0.92 * ky)}`;
    let u = `<path d="${rect(-h, -h * ky, s, s * ky)}"${paint(p.block || ctx.slot)}/><path d="${hole}"${paint(p.holeSlot || "b")}/>`;
    if (rim && p.rim !== "none") u += `<path d="${rim}" ${stroke(p.rim || "c/0.6", p.rimWidth ?? 1.2, ' stroke-linecap="round"')}/>`;
    if ((p.joint ?? 0.6) > 0) u += `<path d="M${f(-h)} ${f(-h * ky)}h${f(s)}M${f(-h)} ${f(-h * ky)}v${f(s * ky)}" ${stroke(p.jointSlot || "b/0.5", p.joint ?? 0.6)}/>`;
    return { defs: `<g id="${id}U">${u}</g>`, stages: [stamp(id + "U", L.pts)] };
  },

  // the Swiss grid: fine module lines, heavier lines every few modules, and one filled module per field placed on a diagonal rhythm
  grid(p, ctx) {
    const n = Math.max(1, Math.round(p.scale || 2)), k = Math.max(2, Math.min(4, Math.round(p.modules ?? 3))), s = ctx.w / n, ny = Math.max(1, Math.round((n * ctx.h) / ctx.w)), sy = ctx.h / ny, m = s / k, my = sy / k;
    ctx.grid = { x: s / 2, y: sy / 2, px: s, py: sy };
    let fine = "", maj = "", fill = "";
    for (let i = 0; i < n * k; i++) (i % k ? (fine += `M${f(i * m)} 0v${f(ctx.h)}`) : (maj += `M${f(i * m)} 0v${f(ctx.h)}`));
    for (let j = 0; j < ny * k; j++) (j % k ? (fine += `M0 ${f(j * my)}h${f(ctx.w)}`) : (maj += `M0 ${f(j * my)}h${f(ctx.w)}`));
    for (let i = 0; i < n; i++) for (let j = 0; j < ny; j++) { const q = (i + j) % k; fill += rect(i * s + q * m, j * sy + ((k - 1 - q) % k) * my, m, my); }
    return { stages: [`<path d="${fill}"${paint(p.module || ctx.slot + "/0.55")}/><path d="${fine}" ${stroke(p.fineSlot || ctx.slot + "/0.4", p.fineWidth ?? 0.6)}/><path d="${maj}" ${stroke(p.line || ctx.slot, p.stroke ?? 1.3)}/>`] };
  },

  // Memphis-lite: a zigzag rule and a rule of half discs alternate down the field
  memphis(p, ctx) {
    const n = Math.max(2, Math.round(p.scale ?? 3)), s = ctx.w / n, rows = 2 * Math.max(1, Math.round(((p.rows ?? 2) * ctx.h) / ctx.w)), rh = ctx.h / rows, sw = p.stroke ?? 2.4;
    ctx.grid = { x: s / 2, y: rh / 2, px: 2 * rh, py: 2 * rh };
    let z = "", base = "", half = "", t = "";
    for (let j = 0; j < rows; j += 2) {
      const y = j * rh + rh * 0.6, A = rh * 0.42;
      z += "M" + Array.from({ length: 2 * n + 1 }, (_, k) => f((k * s) / 2) + " " + f(y + (k % 2 ? -A : A))).join("L");
      const yb = (j + 1) * rh + rh * 0.72, R0 = Math.min(s * 0.3, rh * 0.62);
      base += `M0 ${f(yb)}h${f(ctx.w)}`;
      for (let i = 0; i < n; i++) { const x = i * s + s / 2; half += `M${f(x - R0)} ${f(yb)}A${f(R0)} ${f(R0)} 0 0 1 ${f(x + R0)} ${f(yb)}Z`; t += tri([i * s, yb], [i * s + s * 0.08, yb + rh * 0.2], [i * s - s * 0.08, yb + rh * 0.2]); }
    }
    return { stages: [`<path d="${z}" ${stroke(p.line || ctx.slot, sw, ' stroke-linejoin="round"')}/><path d="${half}"${paint(p.halfSlot || "c")}/><path d="${base}" ${stroke(p.line || ctx.slot, sw)}/><path d="${t}"${paint(p.tick || ctx.slot)}/>`] };
  },
};

export default function modern(p, ctx) {
  const m = M[p.motif];
  if (!m) throw new Error(`modern: unknown motif "${p.motif}"`);
  return m(p, ctx);
}
