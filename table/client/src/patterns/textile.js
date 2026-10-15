// Textile: quilt blocks joined by sashing, woven structures (houndstooth, shepherd, gingham, pinwheel), tartan, ikat diamonds, kente strip blocks, ticking stripe.
import { f, add, mul, poly, circ, lattice, stamp, paint, stroke, polar } from "./engine.js";

const cyc = (a, i) => (Array.isArray(a) ? a[i % a.length] : a);
const rect = (x, y, w, h) => `M${f(x)} ${f(y)}h${f(w)}v${f(h)}h${f(-w)}z`;
const rot4 = (P, k) => P.map(([x, y]) => [[x, y], [-y, x], [-x, -y], [y, -x]][k]);
const gcd = (a, b) => (b ? gcd(b, a % b) : a), lcm = (a, b) => (a * b) / gcd(a, b);
// weave structures: true = warp (vertical thread) on top at thread (i, j)
const WEAVE = { plain: (i, j) => (i + j) % 2 === 0, twill: (i, j) => (((i - j) % 4) + 4) % 4 < 2, basket: (i, j) => ((i >> 1) + (j >> 1)) % 2 === 0, twill31: (i, j) => (((i - j) % 4) + 4) % 4 < 3, satin: (i, j) => (i * 2) % 5 === j % 5 };
const PERIOD = { plain: 2, twill: 4, basket: 4, twill31: 4, satin: 5 };
const PRESET = {
  houndstooth: { warp: ["a", "a", "a", "a", "b", "b", "b", "b"], weave: "twill" },
  gingham: { warp: ["a", "a", "b", "b"], weft: ["a", "a", "b", "b"], weave: "plain", mix: true },
  shepherd: { warp: ["a", "a", "b", "b"], weave: "twill" },
  pinwheel: { warp: ["a", "b"], weft: ["b", "a"], weave: "plain" },
};

const M = {
  // pieced star blocks; sashing strips (always, at least 6%) join the blocks into one grid
  quilt(p, ctx) {
    const L = lattice(ctx, p.scale || 2, false), id = ctx.id, sash = Math.max(0.06, p.sash ?? 0.1) * L.sx, B = L.sx - sash, h = B / 2, ky = L.ky;
    const S = p.star || "a", S2 = p.star2 || p.star || "a", C = p.centre || "c", K = p.corner;
    let a = "", b = "", c = "", k = "";
    const tri = (pts, which) => { const d = poly(pts); which === 0 ? (a += d) : which === 1 ? (b += d) : (c += d); };
    const blk = p.block || "lemoyne";
    if (blk === "ohio") {
      const u = B / 3;
      c += rect(-u / 2, -u / 2, u, u);
      for (let r = 0; r < 4; r++) { tri(rot4([[-u / 2, -u / 2], [-u / 2, -h], [0, -u]], r), 0); tri(rot4([[u / 2, -u / 2], [u / 2, -h], [0, -u]], r), 1); if (K) k += poly(rot4([[-h, -h], [-u / 2, -h], [-u / 2, -u / 2], [-h, -u / 2]], r)); }
    } else if (blk === "sawtooth") {
      const q = B / 4;
      c += rect(-q, -q, 2 * q, 2 * q);
      if (p.inner) c += poly([[0, -q * 0.9], [q * 0.9, 0], [0, q * 0.9], [-q * 0.9, 0]]);
      for (let r = 0; r < 4; r++) { tri(rot4([[-q, -q], [0, -q], [-q, -h]], r), 0); tri(rot4([[q, -q], [0, -q], [q, -h]], r), 1); if (K) k += poly(rot4([[-h, -h], [-q, -h], [-q, -q], [-h, -q]], r)); }
    } else if (blk === "compass") {
      const n = p.points || 16;
      for (let i = 0; i < n; i++) { const big = i % 2 === 0, R = h * (big ? 0.98 : 0.62), wd = (360 / n) * (big ? 0.5 : 0.42), t = polar(R, -90 + (360 * i) / n), l = polar(h * (big ? 0.3 : 0.24), -90 + (360 * i) / n - wd), rr = polar(h * (big ? 0.3 : 0.24), -90 + (360 * i) / n + wd); tri([[0, 0], l, t], big ? 0 : 2); tri([[0, 0], t, rr], big ? 1 : 2); }
      k += circ(0, 0, h * 0.995); c += circ(0, 0, h * 0.14);
    } else {
      // LeMoyne: eight 45-degree diamonds, halves shaded for a folded look
      const s = h / (2 * Math.cos(Math.PI / 8));
      for (let i = 0; i < 8; i++) { const th = -90 + 45 * i, A = polar(s, th - 22.5), T = polar(2 * s * Math.cos(Math.PI / 8), th), Bv = polar(s, th + 22.5); tri([[0, 0], A, T], i % 2 ? 2 : 0); tri([[0, 0], T, Bv], i % 2 ? 2 : 1); }
      if (K) for (let r = 0; r < 4; r++) k += poly(rot4([[-h, -h], [-h * 0.55, -h], [-h, -h * 0.55]], r));
    }
    let u = (K ? `<path d="${k}"${paint(K)}/>` : "") + `<path d="${a}"${paint(S)}/><path d="${b}"${paint(S2)}/><path d="${c}"${paint(C)}/>`;
    if (sash) u += `<path d="${rect(-L.sx / 2, -L.sx / 2, L.sx, sash / 2) + rect(-L.sx / 2, L.sx / 2 - sash / 2, L.sx, sash / 2) + rect(-L.sx / 2, -L.sx / 2, sash / 2, L.sx) + rect(L.sx / 2 - sash / 2, -L.sx / 2, sash / 2, L.sx)}"${paint(p.sashSlot || "a/0.6")}/>` + (p.stone ? `<path d="${[[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([x, y]) => rect((x * L.sx) / 2 - sash / 2, (y * L.sx) / 2 - sash / 2, sash, sash)).join("")}"${paint(p.stone)}/>` : "");
    if (p.quilting) u += `<path d="${circ(0, 0, h * 0.8)}" ${stroke(p.quilting, 0.5)} stroke-dasharray="1.2 1.4"/>`;
    return { defs: `<g id="${id}U"${ky !== 1 ? ` transform="scale(1 ${f(ky * 1000) / 1000})"` : ""}>${u}</g>`, stages: [stamp(id + "U", L.pts)] };
  },

  // woven cloth: warp/weft colour orders over a weave structure; presets houndstooth, gingham, shepherd, pinwheel
  weave(p, ctx) {
    // presets only: free warp orders can leave most threads ground; colors [x, y] recolours the two threads
    const P = PRESET[p.preset] || PRESET.houndstooth, cs = p.colors || ["a", "b"], sw = (a) => a.map((t) => (t === "a" ? cs[0] : cs[1]));
    const warp = sw(P.warp), weft = sw(P.weft || P.warp), wv = WEAVE[P.weave];
    const T0 = lcm(lcm(warp.length, weft.length), PERIOD[P.weave]), rep = Math.max(1, Math.round((p.scale || 2) * 8 / T0)), T = T0 * rep, Ty = Math.max(1, Math.round((T * ctx.h) / ctx.w / T0)) * T0;
    const tx = ctx.w / T, ty = ctx.h / Ty, runs = {};
    for (let j = 0; j < Ty; j++) {
      let i0 = 0, cur = null;
      for (let i = 0; i <= T; i++) {
        const col = i === T ? null : P.mix && warp[i % warp.length] !== weft[j % weft.length] ? (p.mixSlot || cs[0] + "/0.5") : wv(i, j) ? warp[i % warp.length] : weft[j % weft.length];
        if (col !== cur) { if (cur && cur !== "b") runs[cur] = (runs[cur] || "") + rect(i0 * tx, j * ty, (i - i0) * tx, ty); cur = col; i0 = i; }
      }
    }
    let s = Object.entries(runs).map(([k, d]) => `<path d="${d}"${paint(k)}/>`).join("");
    if (p.thread) s += `<path d="${Array.from({ length: T }, (_, i) => `M${f(i * tx)} 0v${f(ctx.h)}`).join("")}" ${stroke(p.thread, 0.25)}/>`;
    return { stages: [s] };
  },

  // tartan: a symmetric sett of stripes in warp and weft; warp stripes half-cover the weft, a twill line texture on top
  tartan(p, ctx) {
    const sett = p.sett || [["a", 10], ["b", 2], ["c", 1], ["b", 4]], full = p.symmetric === false ? sett : [...sett, ...[...sett].reverse()];
    const T = full.reduce((s, [, n]) => s + n, 0), tx = ctx.w / T, ty = ctx.h / T;
    let h = "", v = "", x = 0;
    for (const [slot, n] of full) { if (slot !== "b") { h += `<path d="${rect(0, x * ty, ctx.w, n * ty)}"${paint(slot)}/>`; v += `<path d="${rect(x * tx, 0, n * tx, ctx.h)}"${paint(slot)}/>`; } x += n; }
    const m = Math.round(p.twill ?? 24), s = ctx.w / m; // one diagonal per twill step; the neighbour copies draw the rest, so none doubles
    const tw = `<path d="${Array.from({ length: m }, (_, k) => `M${f(k * s)} 0l${f(ctx.w)} ${f(ctx.h)}`).join("")}" ${stroke(p.twillSlot || "b/0.16", s * 0.34)}/>`;
    return { stages: [h, `<g opacity="${p.blend ?? 0.55}">${v}</g>`, p.twill === 0 ? "" : tw] };
  },

  // ikat: nested stepped diamonds whose rows bleed sideways (seeded), on a diamond lattice
  ikat(p, ctx) {
    const L = lattice(ctx, p.scale || 2, true), id = ctx.id, R = ctx.rng, k = p.nest ?? 3, seq = p.seq || [ctx.slot, "c", "b"], rows = p.rows ?? 22, bleed = p.bleed ?? 0.35;
    const hw = L.sx / 2, hh = L.sy, dy = (2 * hh) / rows;
    let u = "";
    for (let lv = 0; lv < k; lv++) {
      const sc = 1 - lv / (k + (p.core ?? 0.4)); let d = "";
      for (let r = 0; r < rows; r++) {
        const y = -hh + r * dy, yc = Math.abs(y + dy / 2) / hh, half = hw * sc * (1 - yc) - (p.gap ?? 0.6), j = (R() - 0.5) * dy * 2 * bleed, j2 = (R() - 0.5) * dy * 2 * bleed;
        if (half + j > 0.4) d += rect(-half - j2, y, 2 * half + j + j2, dy + 0.05);
      }
      u += `<path d="${d}"${paint(cyc(seq, lv))}/>`;
    }
    if (p.dot) u += `<path d="${circ(0, 0, p.dot)}"${paint(p.dotSlot || "b")}/>`;
    return { defs: `<g id="${id}U">${u}</g>`, stages: [stamp(id + "U", L.pts)] };
  },

  // kente: warp strips of alternating blocks; block A = weft bars, block B = a small woven motif
  kente(p, ctx) {
    const n = p.strips || 3, m = Math.max(1, Math.round((p.blocks || 3) * ctx.h / ctx.w)), sw = ctx.w / n, bh = ctx.h / m, R = ctx.rng;
    const A = p.barSlots || [ctx.slot, "c"], Bs = p.motifSlot || "c", kind = p.motif2 || "ladder";
    let fill = "", bars = "", mot = "", edge = "";
    for (let i = 0; i < n; i++) for (let j = 0; j < m; j++) {
      const x = i * sw, y = j * bh;
      if ((i + j) % 2 === 0) {
        fill += rect(x, y, sw, bh);
        const nb = p.bars ?? 4;
        for (let b = 0; b < nb; b++) bars += `<path d="${rect(x, y + ((b + 0.5) * bh) / nb - bh / nb / 4, sw, bh / nb / 2)}"${paint(cyc(A, b))}/>`;
      } else {
        const cx = x + sw / 2, cy = y + bh / 2;
        if (kind === "ladder") for (let t = 0; t < 4; t++) mot += rect(x + sw * 0.2, y + bh * (0.14 + t * 0.2), sw * 0.6, bh * 0.08);
        if (kind === "zigzag") mot += poly(Array.from({ length: 7 }, (_, t) => [x + (t % 2 ? sw * 0.75 : sw * 0.25), y + (bh * (t + 0.5)) / 7]), false);
        if (kind === "checks") for (let a = 0; a < 3; a++) for (let b = 0; b < 3; b++) if ((a + b) % 2 === 0) mot += rect(x + sw * (0.2 + a * 0.2), y + bh * (0.2 + b * 0.2), sw * 0.2, bh * 0.2);
        if (kind === "diamond") mot += poly([[cx, y + bh * 0.15], [x + sw * 0.8, cy], [cx, y + bh * 0.85], [x + sw * 0.2, cy]]) + poly([[cx, y + bh * 0.35], [x + sw * 0.6, cy], [cx, y + bh * 0.65], [x + sw * 0.4, cy]]);
      }
      void R;
    }
    for (let i = 0; i < n; i++) edge += rect(i * sw, 0, sw * 0.06, ctx.h) + rect((i + 1) * sw - sw * 0.06, 0, sw * 0.06, ctx.h);
    const mz = kind === "zigzag" ? `<path d="${mot}" ${stroke(Bs, sw * 0.12)}/>` : `<path d="${mot}"${paint(Bs)} fill-rule="evenodd"/>`;
    return { stages: [`<path d="${fill}"${paint(p.blockSlot || "a/0.3")}/>${bars}${mz}<path d="${edge}"${paint(p.edgeSlot || "c")}/>`] };
  },
  // ticking: a broad stripe flanked by two narrow ones, repeated; the mattress and kitchen cloth stripe
  ticking(p, ctx) {
    const n = Math.max(2, Math.min(8, Math.round(p.scale ?? 3))), s = ctx.w / n, b = s * (p.broad ?? 0.2), nw = s * (p.narrow ?? 0.05), g = s * (p.gap ?? 0.12);
    ctx.grid = { x: s / 2, y: ctx.h / 2, px: s, py: ctx.h };
    let A = "", C = "";
    for (let i = 0; i < n; i++) { const x = i * s + s / 2; A += rect(x - b / 2, 0, b, ctx.h) + rect(x - b / 2 - g - nw, 0, nw, ctx.h) + rect(x + b / 2 + g, 0, nw, ctx.h); if (p.thread) C += rect(i * s - nw * 0.3, 0, nw * 0.6, ctx.h); }
    return { stages: [`<path d="${A}"${paint(p.stripe || ctx.slot)}/>` + (C ? `<path d="${C}"${paint(p.thread)}/>` : "")] };
  },

};

export default function textile(p, ctx) {
  const m = M[p.motif];
  if (!m) throw new Error(`textile: unknown motif "${p.motif}"`);
  return m(p, ctx);
}
