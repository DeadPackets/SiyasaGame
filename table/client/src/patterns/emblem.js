// Emblem: a geometric centre mark on a knock-out disc so the pattern frames it. No eagles, no extremist marks; the pattee cross is gone (it reads as an iron cross).
import { f, add, sub, mul, rot, poly, circ, reg, paint, stroke, polar, starPts } from "./engine.js";

function leafPath(A, B, sag) { const L = Math.hypot(B[0] - A[0], B[1] - A[1]), rho = (L * L / 4 + sag * sag) / (2 * sag); return `M${f(A[0])} ${f(A[1])}A${f(rho)} ${f(rho)} 0 0 1 ${f(B[0])} ${f(B[1])}A${f(rho)} ${f(rho)} 0 0 1 ${f(A[0])} ${f(A[1])}Z`; }
const rect = (x, y, w, h) => `M${f(x)} ${f(y)}h${f(w)}v${f(h)}h${f(-w)}z`;
// unit-box glyphs (-1..1, y down): [main path, knock-out path in the ground slot]
const U = {
  anchor: ["M-.08 -.62H.08V.62C.3 .6 .5 .45 .6 .25L.46 .2L.78 .02L.82 .4L.7 .33C.55 .62 .3 .8 0 .82C-.3 .8 -.55 .62 -.7 .33L-.82 .4L-.78 .02L-.46 .2L-.36 .25C-.5 .45 -.3 .6 -.08 .62ZM-.42 -.56H.42V-.43H-.42ZM-.17 -.8a.17 .17 0 1 0 .34 0a.17 .17 0 1 0 -.34 0M-.07 -.8a.07 .07 0 1 1 .14 0a.07 .07 0 1 1 -.14 0", ""],
  crown: ["M-.72 .55V.32L-.84 -.42L-.42 -.02L0 -.62L.42 -.02L.84 -.42L.72 .32V.55ZM-.95 -.5a.11 .11 0 1 0 .22 0a.11 .11 0 1 0 -.22 0M-.11 -.72a.11 .11 0 1 0 .22 0a.11 .11 0 1 0 -.22 0M.73 -.5a.11 .11 0 1 0 .22 0a.11 .11 0 1 0 -.22 0", "M-.72 .3H.72V.4H-.72ZM-.08 .1a.08 .08 0 1 0 .16 0a.08 .08 0 1 0 -.16 0"],
  sword: ["M-.1 .32V-.74L0 -.96L.1 -.74V.32ZM-.46 .32H.46V.44H-.46ZM-.06 .44H.06V.78H-.06ZM-.11 .88a.11 .11 0 1 0 .22 0a.11 .11 0 1 0 -.22 0", "M-.02 .22V-.7H.02V.22Z"],
  shield: ["M-.72 -.78H.72V-.1C.72 .42 .32 .76 0 .96C-.32 .76 -.72 .42 -.72 -.1Z", "M-.56 -.62H.56V-.1C.56 .32 .26 .6 0 .76C-.26 .6 -.56 .32 -.56 -.1ZM-.42 -.48V-.12C-.42 .2 -.2 .44 0 .58C.2 .44 .42 .2 .42 -.12V-.48Z"],
  book: ["M-.04 -.42C-.3 -.6 -.62 -.6 -.9 -.48V.56C-.62 .44 -.3 .44 -.04 .62ZM.04 -.42C.3 -.6 .62 -.6 .9 -.48V.56C.62 .44 .3 .44 .04 .62Z", "M-.76 -.3C-.56 -.38 -.36 -.38 -.18 -.28V-.2C-.36 -.3 -.56 -.3 -.76 -.22ZM-.76 -.08C-.56 -.16 -.36 -.16 -.18 -.06V.02C-.36 -.08 -.56 -.08 -.76 0ZM-.76 .14C-.56 .06 -.36 .06 -.18 .16V.24C-.36 .14 -.56 .14 -.76 .22ZM.76 -.3C.56 -.38 .36 -.38 .18 -.28V-.2C.36 -.3 .56 -.3 .76 -.22ZM.76 -.08C.56 -.16 .36 -.16 .18 -.06V.02C.36 -.08 .56 -.08 .76 0ZM.76 .14C.56 .06 .36 .06 .18 .16V.24C.36 .14 .56 .14 .76 .22Z"],
  scales: ["M-.05 -.78H.05V.72H-.05ZM-.8 -.6H.8V-.5H-.8ZM-.42 .72H.42V.86H-.42ZM-.12 -.86a.12 .12 0 1 0 .24 0a.12 .12 0 1 0 -.24 0M-.97 .08H-.33A.32 .32 0 0 1 -.97 .08ZM.33 .08H.97A.32 .32 0 0 1 .33 .08ZM-.81 -.52L-.93 .08H-.89L-.77 -.52ZM-.71 -.52L-.39 .08H-.35L-.67 -.52ZM.81 -.52L.93 .08H.89L.77 -.52ZM.71 -.52L.39 .08H.35L.67 -.52Z", ""],
  flame: ["M0 -1C.36 -.56 .72 -.24 .62 .26C.56 .7 .26 .96 0 .96C-.26 .96 -.56 .7 -.62 .26C-.66 -.08 -.44 -.36 -.26 -.6C-.2 -.34 -.06 -.28 0 -1Z", "M0 -.2C.18 .02 .34 .2 .3 .46C.26 .7 .12 .8 0 .8C-.12 .8 -.26 .7 -.3 .46C-.32 .26 -.16 .1 0 -.2Z"],
  eye: ["M-.96 0C-.6 -.56 .6 -.56 .96 0C.6 .56 -.6 .56 -.96 0ZM-.3 0a.3 .3 0 1 0 .6 0a.3 .3 0 1 0 -.6 0", "M-.8 0C-.5 -.42 .5 -.42 .8 0C.5 .42 -.5 .42 -.8 0ZM-.32 0a.32 .32 0 1 0 .64 0a.32 .32 0 1 0 -.64 0M-.12 0a.12 .12 0 1 0 .24 0a.12 .12 0 1 0 -.24 0"],
  tower: ["M-.48 .9V-.5H-.62V-.86H-.4V-.7H-.2V-.86H.2V-.7H.4V-.86H.62V-.5H.48V.9Z", "M-.16 .9V.52A.16 .16 0 0 1 .16 .52V.9ZM-.05 -.36H.05V-.04H-.05ZM-.62 -.5H.62V-.44H-.62Z"],
  ship: ["M-.9 .26H.9L.62 .64H-.62ZM-.03 -.92H.05V.26H-.03ZM.1 -.8L.1 .14L.72 .14ZM-.08 -.66L-.08 .14L-.62 .14ZM.05 -.92L.36 -.82L.05 -.72Z", "M-.66 .38H.66V.44H-.66Z"],
};

const K = {
  // star: k >= n/2 is not a star, so k is clamped
  star(R, p) { const n = p.n || 5, k = Math.max(1, Math.min(p.k || 2, Math.ceil(n / 2) - 1)); const ri = k > 1 ? (R * Math.cos((Math.PI * k) / n)) / Math.cos((Math.PI * (k - 1)) / n) : R * Math.cos(Math.PI / n); return `<path d="${poly(starPts(n, R, p.inner ? R * p.inner : ri, p.rot ?? -90))}"${paint(p.slot)}/>`; },
  crescent(R, p) {
    const a = p.rot ?? -40, dx = R * 0.36, r = R * 0.8, x = (R * R - r * r + dx * dx) / (2 * dx), y = Math.sqrt(R * R - x * x);
    const P1 = rot([x, -y], a), P2 = rot([x, y], a);
    let s = `<path d="M${f(P1[0])} ${f(P1[1])}A${f(R)} ${f(R)} 0 1 0 ${f(P2[0])} ${f(P2[1])}A${f(r)} ${f(r)} 0 1 1 ${f(P1[0])} ${f(P1[1])}Z"${paint(p.slot)}/>`;
    if (p.star !== false) s += `<path d="${poly(starPts(5, R * 0.3, R * 0.12, a - 90).map((q) => add(q, rot([R * 0.6, 0], a))))}"${paint(p.slot)}/>`;
    return s;
  },
  cross(R, p) {
    const t = R * (p.bar ?? 0.3), st = p.style || "greek";
    if (st === "latin") return `<path d="${rect(-t / 2, -R, t, 2 * R) + rect(-R * 0.62, -R * 0.45 - t / 2, R * 1.24, t)}"${paint(p.slot)}/>`;
    let d = rect(-t / 2, -R, t, 2 * R) + rect(-R, -t / 2, 2 * R, t);
    if (st === "coptic") { d += [0, 90, 180, 270].map((a) => { const c = rot([R * 0.92, 0], a), v = rot([0, t * 1.15], a); return poly([add(c, v), add(c, mul(v, -1)), add(c, rot([t * 0.5, 0], a))]); }).join(""); d += reg(4, R * 0.55, 45).map((q) => circ(q[0], q[1], R * 0.1)).join(""); }
    return `<path d="${d}"${paint(p.slot)}/>`;
  },
  wheel(R, p) {
    const n = p.n || 8, sw = p.width ?? R * 0.1;
    let s = `<path d="${circ(0, 0, R * 0.78)}" ${stroke(p.slot, sw)}/><path d="${reg(n, R * 0.78, -90).map((q) => poly([[0, 0], q], false)).join("")}" ${stroke(p.slot, sw * 0.6)}/><path d="${circ(0, 0, R * 0.2)}"${paint(p.slot)}/>`;
    if (p.knobs !== false) s += `<path d="${reg(n, R * 0.95, -90).map((q) => circ(q[0], q[1], R * 0.08)).join("")}"${paint(p.slot)}/>`;
    return s;
  },
  laurel(R, p) {
    const n = p.n || 6, lr = R * 0.21, sag = R * 0.085, rho = (lr * lr + sag * sag) / (2 * sag);
    let d = "";
    for (const side of [-1, 1]) for (let i = 0; i < n; i++) {
      const a = 90 + side * (25 + (i * 130) / n), c = polar(R * 0.78, a), u = polar(lr, a + side * 118), A = add(c, u), B = sub(c, u);
      d += `M${f(A[0])} ${f(A[1])}A${f(rho)} ${f(rho)} 0 0 1 ${f(B[0])} ${f(B[1])}A${f(rho)} ${f(rho)} 0 0 1 ${f(A[0])} ${f(A[1])}Z`;
    }
    let s = `<path d="${d}"${paint(p.slot)}/>`;
    if (p.inner) s += K[p.inner.kind || "star"](R * (p.inner.size ?? 0.45), { ...p.inner, slot: p.inner.slot || p.slot });
    return s;
  },
  gear(R, p) {
    const n = p.n || 10, ro = R, ri = R * 0.78, pts = [];
    for (let i = 0; i < n; i++) { const a = (360 * i) / n, h = 360 / n / 4; pts.push(polar(ri, a - 2 * h * 0.9), polar(ro, a - h * 0.7), polar(ro, a + h * 0.7), polar(ri, a + 2 * h * 0.9)); }
    return `<path d="${poly(pts) + circ(0, 0, R * 0.36)}" fill-rule="evenodd"${paint(p.slot)}/>`;
  },
  column(R, p) {
    const w = R * 0.42;
    let d = rect(-w * 1.25, R * 0.78, w * 2.5, R * 0.16) + rect(-w * 1.05, R * 0.64, w * 2.1, R * 0.12) + rect(-w, -R * 0.66, w * 2, R * 1.28) + rect(-w * 1.3, -R * 0.84, w * 2.6, R * 0.16) + rect(-w * 1.1, -R * 0.98, w * 2.2, R * 0.12);
    const fl = [-0.6, -0.2, 0.2, 0.6].map((x) => rect(w * x - R * 0.035, -R * 0.6, R * 0.07, R * 1.16)).join("");
    return `<path d="${d}"${paint(p.slot)}/><path d="${fl}"${paint("b")}/>`;
  },
  sun(R, p) {
    const n = p.n || 12, pts = [];
    for (let i = 0; i < 2 * n; i++) { const a = -90 + (180 * i) / n; pts.push(polar(i % 2 ? R * 0.5 : i % 4 ? R * 0.82 : R, a)); }
    return `<path d="${poly(pts)}"${paint(p.slot)}/><path d="${circ(0, 0, R * 0.4)}"${paint("b")}/><path d="${circ(0, 0, R * 0.3)}"${paint(p.slot)}/>`;
  },
  wheat(R, p) {
    // grains are short relative arcs to keep the glyph small
    const g = (c, a, l, w) => { const v = polar(l, a), rho = (l * l / 4 + w * w) / (2 * w); return `M${f(c[0])} ${f(c[1])}a${f(rho)} ${f(rho)} 0 0 1 ${f(v[0])} ${f(v[1])}a${f(rho)} ${f(rho)} 0 0 1 ${f(-v[0])} ${f(-v[1])}z`; };
    let d = "";
    for (const a of p.n === 1 ? [0] : [-24, 0, 24]) {
      const base = [0, R * 0.95], tip = add(base, polar(R * 1.75, -90 + a)), u = sub(tip, base);
      d += poly([add(base, rot([R * 0.03, 0], a)), add(tip, rot([R * 0.03, 0], a)), add(tip, rot([-R * 0.03, 0], a)), add(base, rot([-R * 0.03, 0], a))]);
      for (let i = 0; i < 3; i++) for (const sd of [-1, 1]) d += g(add(base, mul(u, 0.55 + i * 0.15)), -90 + a + sd * 35, R * 0.24, R * 0.07);
      d += g(add(base, mul(u, 0.98)), -90 + a, R * 0.2, R * 0.05);
    }
    d += rect(-R * 0.3, R * 0.25, R * 0.6, R * 0.1);
    return `<path d="${d}"${paint(p.slot)}/>`;
  },
  rays(R, p) {
    const n = p.n || 12, w = p.width ?? 0.16;
    let d = "";
    for (let i = 0; i < n; i++) { const a = -90 + (360 * i) / n; d += poly([polar(R * 0.42, a - (180 / n) * w * 2), polar(R * (i % 2 ? 0.8 : 1), a), polar(R * 0.42, a + (180 / n) * w * 2)]); }
    const q = R * 0.26;
    return `<path d="${d + rect(-q, -q, 2 * q, 2 * q)}"${paint(p.slot)}/><path d="${rect(-q * 0.55, -q * 0.55, q * 1.1, q * 1.1)}"${paint("b")}/>`;
  },
  globe(R, p) {
    const r = R * 0.9, w = R * 0.09;
    return `<path d="${circ(0, 0, r)}M${f(-r)} 0h${f(2 * r)}M${f(-r * 0.87)} ${f(-r * 0.5)}h${f(r * 1.74)}M${f(-r * 0.87)} ${f(r * 0.5)}h${f(r * 1.74)}M0 ${f(-r)}a${f(r * 0.45)} ${f(r)} 0 1 0 0 ${f(2 * r)}a${f(r * 0.45)} ${f(r)} 0 1 0 0 ${f(-2 * r)}M0 ${f(-r)}v${f(2 * r)}" ${stroke(p.slot, w)}/>`;
  },
  orbit(R, p) {
    const e = (a) => `<ellipse rx="${f(R * 0.95)}" ry="${f(R * 0.36)}" transform="rotate(${a})" ${stroke(p.slot, R * 0.08)}/>`;
    return e(30) + e(-30) + e(90) + `<path d="${circ(0, 0, R * 0.17) + circ(R * 0.6, -R * 0.62, R * 0.09)}"${paint(p.slot)}/>`;
  },
  cap(R, p) { // pileus, the felt cap of the freed slave: liberty in the Roman Republic
    return `<path d="M${f(-R * 0.62)} ${f(R * 0.42)}C${f(-R * 0.62)} ${f(-R * 0.3)} ${f(-R * 0.32)} ${f(-R * 0.92)} 0 ${f(-R * 0.92)}C${f(R * 0.32)} ${f(-R * 0.92)} ${f(R * 0.62)} ${f(-R * 0.3)} ${f(R * 0.62)} ${f(R * 0.42)}Z${rect(-R * 0.82, R * 0.42, R * 1.64, R * 0.22)}"${paint(p.slot)}/><path d="${rect(-R * 0.62, R * 0.16, R * 1.24, R * 0.07)}"${paint(p.knock || "b")}/>`;
  },
  tomoe(R, p) { // mitsudomoe: three commas turning about the centre; each a round head whose tail tapers along the rim
    const Ro = R * 0.8, r = R * 0.24, span = 100;
    let d = "";
    for (let k = 0; k < 3; k++) {
      const a = -90 + 120 * k, P1 = polar(Ro, a), P2 = polar(Ro - 2 * r, a);
      d += `M${f(P1[0])} ${f(P1[1])}A${f(r)} ${f(r)} 0 0 0 ${f(P2[0])} ${f(P2[1])}`;
      for (let i = 1; i <= 10; i++) { const t = i / 10, q = polar(Ro - 2 * r * (1 - t) ** 1.4, a + span * t); d += `L${f(q[0])} ${f(q[1])}`; }
      d += `A${f(Ro)} ${f(Ro)} 0 0 0 ${f(P1[0])} ${f(P1[1])}Z`;
    }
    return `<path d="${d}"${paint(p.slot)}/>` + (p.ringed !== false ? `<path d="${circ(0, 0, R)}" ${stroke(p.slot, R * 0.07)}/>` : "");
  },
  torii(R, p) {
    return `<path d="M${f(-R)} ${f(-R * 0.66)}Q0 ${f(-R * 0.8)} ${f(R)} ${f(-R * 0.66)}L${f(R * 0.9)} ${f(-R * 0.5)}Q0 ${f(-R * 0.62)} ${f(-R * 0.9)} ${f(-R * 0.5)}Z${rect(-R * 0.8, -R * 0.3, R * 1.6, R * 0.13)}${rect(-R * 0.62, -R * 0.52, R * 0.15, R * 1.42)}${rect(R * 0.47, -R * 0.52, R * 0.15, R * 1.42)}${rect(-R * 0.05, -R * 0.52, R * 0.1, R * 0.24)}"${paint(p.slot)}/>`;
  },
  lotus(R, p) {
    const L = (A, B, sag) => leafPath(A, B, sag);
    return `<path d="${L([0, R * 0.45], [0, -R * 0.85], R * 0.2) + L([-R * 0.05, R * 0.45], [-R * 0.6, -R * 0.45], R * 0.17) + L([R * 0.05, R * 0.45], [R * 0.6, -R * 0.45], R * 0.17) + L([-R * 0.1, R * 0.48], [-R * 0.92, -R * 0.02], R * 0.13) + L([R * 0.1, R * 0.48], [R * 0.92, -R * 0.02], R * 0.13)}${rect(-R * 0.7, R * 0.55, R * 1.4, R * 0.1)}"${paint(p.slot)}/>`;
  },
  palm(R, p) {
    let d = `M${f(-R * 0.06)} ${f(R * 0.95)}Q${f(R * 0.08)} ${f(R * 0.2)} ${f(-R * 0.02)} ${f(-R * 0.35)}L${f(R * 0.08)} ${f(-R * 0.35)}Q${f(R * 0.2)} ${f(R * 0.2)} ${f(R * 0.08)} ${f(R * 0.95)}Z`;
    for (const a of [-165, -130, -95, -60, -25, 10, -195]) { const B = add([R * 0.03, -R * 0.4], polar(R * 0.78, a)); d += leafPath([R * 0.03, -R * 0.4], B, R * 0.1 * (a < -90 ? -1 : 1)); }
    return `<path d="${d}"${paint(p.slot)}/>`;
  },
  clock(R, p) {
    let t = ""; for (let i = 0; i < 12; i++) { const A = polar(R * (i % 3 ? 0.72 : 0.62), i * 30), B = polar(R * 0.82, i * 30); t += `M${f(A[0])} ${f(A[1])}L${f(B[0])} ${f(B[1])}`; }
    return `<path d="${circ(0, 0, R * 0.95)}" ${stroke(p.slot, R * 0.09)}/><path d="${t}" ${stroke(p.slot, R * 0.06)}/><path d="M0 0L${f(R * 0.32)} ${f(-R * 0.3)}M0 0V${f(-R * 0.58)}" ${stroke(p.slot, R * 0.09, ' stroke-linecap="round"')}/>`;
  },
  crescentcross(R, p) { // crescent embracing a cross: the 1919 emblem of Muslim-Christian national unity in Egypt
    const s = K.crescent(R, { ...p, star: false }), a = p.rot ?? -40, c = rot([R * 0.5, 0], a), t = R * 0.13, l = R * 0.4;
    return s + `<path d="${rect(c[0] - t / 2, c[1] - l, t, 2 * l) + rect(c[0] - l * 0.7, c[1] - l * 0.35 - t / 2, l * 1.4, t)}"${paint(p.slot)}/>`;
  },
  coin(R, p) { const q = R * 0.3; return `<path d="${circ(0, 0, R * 0.92) + rect(-q, -q, 2 * q, 2 * q)}" fill-rule="evenodd"${paint(p.slot)}/><path d="${circ(0, 0, R * 0.68)}" ${stroke("b", R * 0.06)}/>`; },
};

for (const k of Object.keys(U)) if (!K[k]) K[k] = (R, p) => `<path d="${U[k][0]}" transform="scale(${f(R)})"${paint(p.slot)}/>` + (U[k][1] ? `<path d="${U[k][1]}" transform="scale(${f(R)})"${paint(p.knock || "b")}/>` : "");
export const EMBLEMS = Object.keys(K);

// one emblem at the origin for a view V units across: glyph radius 0.136 V, knock-out disc about 41% of the view, so the pattern shows around it
export default function emblem(p, V) {
  const k = K[p.kind];
  if (!k) throw new Error(`emblem: unknown kind "${p.kind}"`);
  const R = 0.17 * V, pad = Math.min(0.4, p.pad ?? 0.22), rg = p.ring ?? "c";
  let s = `<path d="${circ(0, 0, R * (1 + pad))}"${paint(p.ground || "b")}/>`;
  if (rg !== "none") s += `<path d="${circ(0, 0, R * (1 + pad * 0.55))}" ${stroke(rg, ((p.ringWidth ?? 1.2) * V) / 100)}/>`;
  return s + k(R * 0.8, { ...p, slot: p.slot || "c" });
}
