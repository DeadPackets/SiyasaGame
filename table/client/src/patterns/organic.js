// Organic: arabesque (islimi) and acanthus scrolls, lotus/palmette friezes, Art Nouveau whiplash. Stems are chains of circular arcs, so every join is smooth.
import { f, add, sub, mul, len, unit, rot, poly, circ, stamp, paint, stroke, polar } from "./engine.js";

const cyc = (a, i) => (Array.isArray(a) ? a[i % a.length] : a);
const M2 = (q) => `M${f(q[0])} ${f(q[1])}`;
// almond leaf from A to B, sag = half width
function leaf(A, B, sag) {
  const L = len(sub(B, A)), rho = (L * L / 4 + sag * sag) / (2 * sag);
  return `${M2(A)}A${f(rho)} ${f(rho)} 0 0 1 ${f(B[0])} ${f(B[1])}A${f(rho)} ${f(rho)} 0 0 1 ${f(A[0])} ${f(A[1])}Z`;
}
// spiral of half-turn arcs: starts at P moving along t, curling to side s (+1 = clockwise in screen space); returns {d, end, C}
export function spiral(P, t, r0, s, decay, turns) {
  let d = M2(P), r = r0, Q = P, C = add(P, mul(rot(unit(t), 90 * s), r0));
  for (let i = 0; i < 2 * turns; i++) {
    const E = add(C, sub(C, Q));
    d += `A${f(r)} ${f(r)} 0 0 ${s > 0 ? 1 : 0} ${f(E[0])} ${f(E[1])}`;
    const r2 = r * decay; C = add(E, mul(unit(sub(C, E)), r2)); r = r2; Q = E;
  }
  return { d, end: Q, C };
}
function bloom(c, r, n, slot, core) {
  let d = "";
  for (let i = 0; i < n; i++) d += leaf(add(c, polar(r * 0.25, (360 * i) / n)), add(c, polar(r, (360 * i) / n)), r * 0.28);
  return `<path d="${d}"${paint(slot)}/><path d="${circ(c[0], c[1], r * 0.3)}"${paint(core)}/>`;
}

const M = {
  // running scroll: a wave of semicircles; in every bay a tendril spirals off the stem and ends in a bloom; leaves on the outer side
  scroll(p, ctx) {
    const n = p.scale || 2, lam = ctx.w / n, A = lam / 4, rows = Math.max(1, Math.round(ctx.h / (2 * A * (p.rowGap ?? 1.15)))), sy = ctx.h / rows, id = ctx.id;
    const sw = p.stem ?? 1.8, sl = p.line || ctx.slot, lf = p.leafSlot || ctx.slot, bl = p.bloomSlot || "c", style = p.leaf || "almond";
    ctx.grid = { x: A, y: 0.56 * sy, px: lam, py: (p.offset && rows > 1 ? 2 : 1) * sy };
    let stem = "", tend = "", leaves = "", blooms = "";
    for (let i = 0; i < n; i++) {
      const x0 = i * lam;
      // up bay then down bay
      for (const [k, up] of [[0, true], [1, false]]) {
        const a = [x0 + k * lam / 2, 0], b = [x0 + (k + 1) * lam / 2, 0], crest = [x0 + k * lam / 2 + A, up ? -A : A];
        stem += `${M2(a)}A${f(A)} ${f(A)} 0 0 ${up ? 1 : 0} ${f(b[0])} ${f(b[1])}`;
        const sp = spiral(crest, [1, 0], A * (p.curl ?? 0.62), up ? 1 : -1, p.decay ?? 0.62, p.turns ?? 1);
        tend += sp.d;
        if (p.bloom !== false) blooms += bloom(sp.C, A * (p.bloomSize ?? 0.32), p.petals ?? 6, bl, p.coreSlot || "b");
        // leaves: on the outer side of the crest, pointing back along the stem
        const base = add(crest, [-A * 0.15, 0]), out = up ? -1 : 1;
        if (style === "acanthus") {
          for (let j = 0; j < 4; j++) { const ang = (up ? -150 : 150) + (up ? 1 : -1) * j * 26, B = add(crest, polar(A * (0.95 - j * 0.12), ang)); leaves += leaf(add(crest, polar(A * 0.05, ang)), B, A * 0.16); }
        } else if (style === "palmette") {
          for (let j = -2; j <= 2; j++) leaves += leaf(base, add(base, polar(A * (0.85 - Math.abs(j) * 0.14), (out < 0 ? -90 : 90) + j * 22 - 25 * (out < 0 ? 1 : -1))), A * 0.11);
        } else leaves += leaf(base, add(base, [-A * 0.75, out * A * 0.42]), A * 0.17) + leaf(add(b, [-A * 0.4, 0]), add(b, [-A * 0.9, -out * A * 0.5]), A * 0.13);
      }
    }
    const row = `<path d="${leaves}"${paint(lf)}/><path d="${stem + tend}" ${stroke(sl, sw, ' stroke-linecap="round"')}/>${blooms}`;
    // rows sit a little off the half step so no stem crest is tangent to the tile edge (antialias seam)
    const pts = []; for (let j = 0; j < rows; j++) pts.push([p.offset && j % 2 ? lam / 2 : 0, (j + 0.56) * sy]);
    return { defs: `<g id="${id}R"${p.flip ? ` transform="scale(1 -1)"` : ""}>${row}</g>`, stages: [stamp(id + "R", pts)] };
  },

  // anthemion: palmettes on the crests and lotus flowers in the troughs of a scrolling stem; alternate rows offset
  palmette(p, ctx) {
    const n = p.scale || 2, lam = ctx.w / n, A = lam / 4, rows = 2 * Math.max(1, Math.round(ctx.h / (lam * Math.min(0.75, p.rowGap ?? 0.7)) / 2)), sy = ctx.h / rows, id = ctx.id;
    ctx.grid = { x: A, y: 0.5 * sy - 1.05 * A, px: lam, py: 2 * sy }; // palmette centre; rows alternate, an even count keeps the wrap
    const sw = p.stem ?? 1.5, pal = p.palmSlot || ctx.slot, lot = p.lotusSlot || "c", k = p.petals ?? 7;
    let stem = "", P = "", Lt = "", vol = "";
    for (let i = 0; i < n; i++) {
      const x0 = i * lam;
      stem += `${M2([x0, 0])}A${f(A)} ${f(A)} 0 0 1 ${f(x0 + lam / 2)} 0A${f(A)} ${f(A)} 0 0 0 ${f(x0 + lam)} 0`;
      // volutes where the stem meets the axis
      vol += spiral([x0 + lam / 2, 0], [0, 1], A * 0.42, 1, 0.55, 1).d + spiral([x0 + lam / 2, 0], [0, -1], A * 0.42, 1, 0.55, 1).d;
      // palmette above the up-arc: a fan of petals from a small heart
      const pc = [x0 + A, -A * 1.05];
      for (let j = 0; j < k; j++) { const ang = -90 + (j - (k - 1) / 2) * (150 / k), L = A * (1.05 - Math.abs(j - (k - 1) / 2) * 0.07); P += leaf(add(pc, polar(A * 0.12, ang)), add(pc, polar(L, ang)), A * 0.12); }
      P += circ(pc[0], pc[1] + A * 0.05, A * 0.16);
      // lotus below the down-arc: a pointed centre petal, two side petals curving out, sepals
      const lc = [x0 + 3 * A, A * 1.05];
      Lt += leaf(lc, add(lc, [0, A * 1.05]), A * 0.2) + leaf(lc, add(lc, polar(A * 0.95, 125)), A * 0.17) + leaf(lc, add(lc, polar(A * 0.95, 55)), A * 0.17);
      Lt += `${M2(add(lc, [-A * 0.3, 0]))}h${f(A * 0.6)}l${f(-A * 0.3)} ${f(-A * 0.22)}z`;
    }
    const row = `<path d="${stem + vol}" ${stroke(p.line || ctx.slot, sw, ' stroke-linecap="round"')}/><path d="${P}"${paint(pal)}/><path d="${Lt}"${paint(lot)}/>`;
    const pts = []; for (let j = 0; j < rows; j++) pts.push([j % 2 ? lam / 2 : 0, (j + 0.5) * sy]);
    return { defs: `<g id="${id}R">${row}</g>`, stages: [stamp(id + "R", pts)] };
  },

  // Art Nouveau whiplash: a four-fold network of S-curves through the cell edge midpoints, each throwing off a curl, with a bloom at the centre
  whiplash(p, ctx) {
    const n = p.scale || 1, s = ctx.w / n, ky = ctx.h / (s * Math.max(1, Math.round(ctx.h / s))), id = ctx.id, h = s / 2, sw = Math.max(1.4, p.stem ?? 1.6);
    const tw = p.twist ?? 0.55;
    ctx.grid = { x: s / 2, y: (s * ky) / 2, px: s, py: s * ky };
    let net = "", curls = "", lv = "";
    for (let r = 0; r < 4; r++) {
      const R = (q) => rot(q, 90 * r);
      const A = R([0, -h]), B = R([h, 0]), C1 = R([-h * tw, -h * 0.25]), C2 = R([h * 0.25, h * tw]);
      net += `${M2(A)}C${f(C1[0])} ${f(C1[1])} ${f(C2[0])} ${f(C2[1])} ${f(B[0])} ${f(B[1])}`;
      // curl off the middle of the curve
      const m = R([-h * 0.08, h * 0.12]), t = unit(R([1, 0.6]));
      const sp = spiral(m, t, h * (p.curl ?? 0.2), 1, 0.6, 1.25);
      curls += sp.d;
      lv += leaf(R([h * 0.35, -h * 0.35]), R([h * 0.75, -h * 0.75]), h * 0.09);
    }
    // a knot where four neighbouring curves meet at each edge midpoint, so the network never hangs on a point contact
    let u = `<path d="${lv}"${paint(p.leafSlot || "a/0.6")}/><path d="${net + curls}" ${stroke(p.line || ctx.slot, sw, ' stroke-linecap="round"')}/><path d="${[[0, -h], [h, 0], [0, h], [-h, 0]].map((q) => circ(q[0], q[1], sw * 1.3)).join("")}"${paint(p.line || ctx.slot)}/>`;
    if (p.bloom !== false) u += bloom([0, 0], h * (p.bloomSize ?? 0.3), p.petals ?? 5, p.bloomSlot || "c", "b");
    const pts = []; for (let j = 0; j < Math.max(1, Math.round(ctx.h / s)); j++) for (let i = 0; i < n; i++) pts.push([(i + 0.5) * s, (j + 0.5) * s * ky]);
    return { defs: `<g id="${id}U"${ky !== 1 ? ` transform="scale(1 ${f(ky * 1000) / 1000})"` : ""}>${u}</g>`, stages: [stamp(id + "U", pts.map((q) => [q[0], q[1]]))] };
  },
  // leaf trellis: diagonal stems, pairs of leaves along every stem, a bud where stems cross
  leaftrellis(p, ctx) {
    const n = Math.max(1, Math.round(p.scale ?? 2)), s = ctx.w / n, ny = Math.max(1, Math.round((n * ctx.h) / ctx.w)), sy = ctx.h / ny, sw = p.stem ?? 1.4;
    ctx.grid = { x: s / 2, y: sy / 2, px: s, py: sy };
    let st = "", lv = "", bud = "";
    const L = Math.hypot(s, sy) * (p.leaf ?? 0.15), sag = L * 0.28;
    for (let i = 0; i < n; i++) for (let j = 0; j < ny; j++) for (const sg of [1, -1]) {
      const A = [i * s, j * sy + (sg < 0 ? sy : 0)], B = add(A, [s, sg * sy]), u = unit(sub(B, A));
      st += `M${f(A[0])} ${f(A[1])}L${f(B[0])} ${f(B[1])}`;
      [0.18, 0.38, 0.58, 0.78].forEach((t, k) => { const q = add(A, mul(sub(B, A), t)); lv += leaf(q, add(q, mul(rot(u, k % 2 ? 32 : -32), L)), sag); }); // alternate leaves along the stem
      if (sg > 0) bud += circ(i * s, j * sy, sw * 2.2);
    }
    return { stages: [`<path d="${st}" ${stroke(p.line || ctx.slot, sw)}/><path d="${lv}"${paint(p.leafSlot || ctx.slot)}/><path d="${bud}"${paint(p.budSlot || "c")}/>`] };
  },

};

export default function organic(p, ctx) {
  const m = M[p.motif];
  if (!m) throw new Error(`organic: unknown motif "${p.motif}"`);
  return m(p, ctx);
}
