// Material finishes: SVG tile -> derived PBR maps -> one shared three.js renderer drawing into per-element canvases.
import * as THREE from "three";
import { colorize, foilMask, dataURL } from "./engine.js";

export const FINISHES = ["gold-leaf", "silver-foil", "enamel", "lacquer", "ink"];
const TW = 512; // texels per tile width
const REDUCED = matchMedia("(prefers-reduced-motion: reduce)").matches;

// ---------- periodic noise fields (cached per size) ----------
const hash = (x, y, s) => { let h = Math.imul(x, 374761393) + Math.imul(y, 668265263) + Math.imul(s, 1442695041); h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };
const mod = (a, n) => ((a % n) + n) % n;
function vnoise(x, y, Px, Py, s) {
  const xi = Math.floor(x), yi = Math.floor(y), fx = x - xi, fy = y - yi, sx = fx * fx * (3 - 2 * fx), sy = fy * fy * (3 - 2 * fy);
  const x0 = mod(xi, Px), x1 = (x0 + 1) % Px, y0 = mod(yi, Py), y1 = (y0 + 1) % Py;
  const a = hash(x0, y0, s), b = hash(x1, y0, s), c = hash(x0, y1, s), d = hash(x1, y1, s);
  return a + (b - a) * sx + (c - a) * sy + (a - b - c + d) * sx * sy;
}
const CACHE = new Map();
const cached = (k, fn) => CACHE.get(k) ?? (CACHE.set(k, fn()), CACHE.get(k));
// Px cells across, Py cells down (Py defaults to keep cells square on hex tiles)
const fbm = (W, H, Px, oct, seed, Py = Math.max(1, Math.round((Px * H) / W))) => cached(`f${W}x${H}:${Px}:${Py}:${oct}:${seed}`, () => {
  const o = new Float32Array(W * H);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    let s = 0, a = 0.5, n = 0;
    for (let k = 0; k < oct; k++) { const px = Px << k, py = Py << k; s += a * vnoise((x / W) * px, (y / H) * py, px, py, seed + k); n += a; a *= 0.5; }
    o[y * W + x] = s / n;
  }
  return o;
});
// distance (texels) between nearest and second-nearest jittered point: thin lines where small (crackle)
const voronoiEdge = (W, H, G, seed) => cached(`v${W}x${H}:${G}:${seed}`, () => {
  const Gy = Math.max(1, Math.round((G * H) / W)), cw = W / G, ch = H / Gy, o = new Float32Array(W * H), ids = new Uint32Array(W * H);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const gx = Math.floor(x / cw), gy = Math.floor(y / ch); let d1 = 1e9, d2 = 1e9, id = 0;
    for (let j = -1; j <= 1; j++) for (let i = -1; i <= 1; i++) {
      const cx = gx + i, cy = gy + j, px = (cx + 0.1 + 0.8 * hash(mod(cx, G), mod(cy, Gy), seed)) * cw, py = (cy + 0.1 + 0.8 * hash(mod(cx, G), mod(cy, Gy), seed + 1)) * ch;
      const d = Math.hypot(px - x, py - y);
      if (d < d1) { d2 = d1; d1 = d; id = mod(cx, G) + 4096 * mod(cy, Gy); } else if (d < d2) d2 = d;
    }
    o[y * W + x] = (d2 - d1) / 2; ids[y * W + x] = id;
  }
  return { e: o, id: ids };
});
// washi: long kozo fibres drawn with wrap
const fibres = (W, H) => cached(`fib${W}x${H}`, () => {
  const c = new OffscreenCanvas(W, H), x = c.getContext("2d"); let s = 9;
  const R = () => hash(s++, 7, 3);
  x.fillStyle = "#000"; x.fillRect(0, 0, W, H); x.lineCap = "round";
  for (let i = 0; i < 260; i++) {
    const px = R() * W, py = R() * H, a = R() * Math.PI * 2, L = W * (0.12 + R() * 0.3), bend = (R() - 0.5) * L * 0.5;
    const ex = Math.cos(a) * L, ey = Math.sin(a) * L, mx = ex / 2 - Math.sin(a) * bend, my = ey / 2 + Math.cos(a) * bend;
    x.strokeStyle = `rgba(255,255,255,${0.25 + R() * 0.5})`; x.lineWidth = 0.5 + R() * 1.1;
    for (const ox of [-W, 0, W]) for (const oy of [-H, 0, H]) { x.beginPath(); x.moveTo(px + ox, py + oy); x.quadraticCurveTo(px + ox + mx, py + oy + my, px + ox + ex, py + oy + ey); x.stroke(); }
  }
  const d = x.getImageData(0, 0, W, H).data, o = new Float32Array(W * H);
  for (let i = 0; i < W * H; i++) o[i] = d[i * 4] / 255;
  return blur(o, W, H, 1);
});
// 3 box passes with wrap ~ gaussian
function blur(src, W, H, r) {
  const k = Math.max(1, Math.round(r)), n = 2 * k + 1;
  let a = Float32Array.from(src), b = new Float32Array(W * H);
  for (let p = 0; p < 3; p++) {
    for (let y = 0; y < H; y++) { const o = y * W; let acc = 0; for (let i = -k; i <= k; i++) acc += a[o + mod(i, W)]; for (let x = 0; x < W; x++) { b[o + x] = acc / n; acc += a[o + ((x + k + 1) % W)] - a[o + mod(x - k, W)]; } }
    for (let x = 0; x < W; x++) { let acc = 0; for (let i = -k; i <= k; i++) acc += b[mod(i, H) * W + x]; for (let y = 0; y < H; y++) { a[y * W + x] = acc / n; acc += b[((y + k + 1) % H) * W + x] - b[mod(y - k, H) * W + x]; } }
  }
  return a;
}
const clamp = (v, a = 0, b = 1) => (v < a ? a : v > b ? b : v);
const sstep = (a, b, v) => { const t = clamp((v - a) / (b - a)); return t * t * (3 - 2 * t); };
const hex3 = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16) / 255);
const mix3 = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
// metal F0 (sRGB) nudged toward the palette hue, like a coloured alloy
const alloy = (base, pal, t) => { const m = Math.max(...pal) || 1; return base.map((v, i) => v * (1 - t + t * (pal[i] / m))); };
const hueChroma = ([r, g, b]) => { const mx = Math.max(r, g, b), c = mx - Math.min(r, g, b); const h = !c ? 0 : mx === r ? ((g - b) / c + 6) % 6 : mx === g ? (b - r) / c + 2 : (r - g) / c + 4; return [h * 60, c]; };
// hue 30-90 with strong chroma reads as gold already (Egypt mil #d49a3a sits at 37)
const goldish = (rgb) => { const [h, c] = hueChroma(rgb); return h >= 30 && h <= 90 && c >= 0.35; };
// coloured foil: slot hue and chroma kept, lifted to metal reflectance
const foilTint = (rgb) => { const m = Math.max(...rgb, 1e-3); return rgb.map((v) => 0.95 * (0.85 * (v / m) + 0.15)); };
const GOLD = [1.0, 0.85, 0.56], BOLE = [0.36, 0.13, 0.08];

// ---------- rasterise the SVG into albedo + slot masks ----------
async function raster(svg, W, H) {
  const img = new Image(); img.src = dataURL(svg); await img.decode();
  const c = new OffscreenCanvas(W, H), x = c.getContext("2d"); x.drawImage(img, 0, 0, W, H);
  return x.getImageData(0, 0, W, H).data;
}
async function sample(o, pal, foil) {
  const W = TW, H = Math.round((TW * o.h) / o.w), N = W * H;
  const [rgb, ...ms] = await Promise.all([raster(colorize(o.svg, pal), W, H), ...["a", "b", "c"].map((k) => raster(foilMask(o.svg, k), W, H))]);
  const alb = new Float32Array(3 * N), M = ms.map(() => new Float32Array(N));
  for (let i = 0; i < N; i++) { for (let k = 0; k < 3; k++) alb[3 * i + k] = rgb[4 * i + k] / 255; ms.forEach((m, j) => (M[j][i] = m[4 * i] / 255)); }
  const F = new Float32Array(N);
  for (let i = 0; i < N; i++) F[i] = Math.min(1, (foil.includes("a") ? M[0][i] : 0) + (foil.includes("c") ? M[2][i] : 0));
  return { W, H, N, alb, foil, Ma: M[0], Mb: M[1], Mc: M[2], F, pal: { a: hex3(pal.a), b: hex3(pal.b), c: hex3(pal.c) } };
}

// ---------- per-finish surface fields ----------
// out: alb (sRGB), h (height 0..1), tilt (extra normal xy), rough, metal, cc (clearcoat), ccH (clearcoat height), aniso, irid
function fields(fin, S) {
  const { W, H, N, alb: A, Ma, Mb, Mc, F, pal } = S;
  const o = { alb: new Float32Array(3 * N), h: new Float32Array(N), tilt: new Float32Array(2 * N), rough: new Float32Array(N), metal: new Float32Array(N), cc: null, ccH: null, aniso: null, irid: null, ns: 4, ccNs: 3 };
  const put = (i, c) => { o.alb[3 * i] = c[0]; o.alb[3 * i + 1] = c[1]; o.alb[3 * i + 2] = c[2]; };
  const paint = (i) => [A[3 * i], A[3 * i + 1], A[3 * i + 2]];
  const grain = fbm(W, H, 96, 2, 11), low = fbm(W, H, 4, 3, 12);
  const slotMetal = (gold) => { const ma = gold && goldish(pal.a) ? GOLD : foilTint(pal.a), mc = gold && goldish(pal.c) ? GOLD : foilTint(pal.c), ua = S.foil.includes("a"), uc = S.foil.includes("c");
    return (i) => { const wa = ua ? Ma[i] : 0, wc = uc ? Mc[i] : 0, t = wa + wc ? wc / (wa + wc) : 0; return mix3(ma, mc, t); }; };
  if (fin === "gold-leaf") {
    const Fb = blur(F, W, H, 2), Fw = blur(F, W, H, 7), wr = fbm(W, H, 9, 3, 13), wob = fbm(W, H, 5, 2, 15), crk = voronoiEdge(W, H, 9, 3).e, crm = fbm(W, H, 3, 2, 14);
    const G = 3, Gy = Math.max(1, Math.round((G * H) / W)), metal = slotMetal(true);
    for (let i = 0; i < N; i++) {
      const x = i % W, y = (i / W) | 0, f = F[i];
      const lx = (x / W) * G + (low[i] - 0.5) * 0.25, ly = (y / H) * Gy + (wob[i] - 0.5) * 0.25, cx = Math.floor(lx), cy = Math.floor(ly);
      const seamD = Math.min(lx - cx, 1 - (lx - cx)) * (W / G), seamE = Math.min(ly - cy, 1 - (ly - cy)) * (H / Gy);
      const seam = (1 - sstep(0.4, 1.8, Math.min(seamD, seamE))) * (0.6 + 0.4 * grain[i]);
      const id = mod(cx, G) + 17 * mod(cy, Gy), r1 = hash(id, 1, 5), r2 = hash(id, 2, 5);
      const crack = (1 - sstep(0.35, 1.3, crk[i])) * sstep(0.52, 0.66, crm[i]);
      const rid = Math.pow(1 - Math.abs(2 * wr[i] - 1), 12);
      const g = metal(i).map((v) => v * (0.94 + 0.12 * r1) * (1 - 0.22 * seam));
      put(i, mix3(paint(i), mix3(g, BOLE, crack), f));
      o.metal[i] = f * (1 - crack);
      o.rough[i] = f * (0.1 + 0.14 * grain[i] + 0.12 * r2 + 0.25 * seam + 0.3 * crack) + (1 - f) * (0.78 + 0.12 * grain[i]);
      o.h[i] = 0.7 * sstep(0.08, 0.92, Fb[i]) + 0.3 * Fw[i] + f * (0.035 * grain[i] + 0.14 * rid + 0.18 * seam - 0.25 * crack) + (1 - f) * 0.015 * grain[i];
      o.tilt[2 * i] = f * (hash(id, 3, 5) - 0.5) * 0.09; o.tilt[2 * i + 1] = f * (hash(id, 4, 5) - 0.5) * 0.09;
    }
    o.ns = 5;
  } else if (fin === "silver-foil") {
    const Fb = blur(F, W, H, 1.2), Fw = blur(F, W, H, 6), s1 = fbm(W, H, 3, 1, 21, 300), s2 = fbm(W, H, 1, 1, 22, 120), s3 = fbm(W, H, 7, 1, 23, 440);
    const metal = slotMetal(false);
    o.aniso = new Float32Array(N);
    for (let i = 0; i < N; i++) {
      const f = F[i], st = 0.45 * s1[i] + 0.3 * s2[i] + 0.25 * s3[i];
      put(i, mix3(paint(i), metal(i).map((v) => v * (0.9 + 0.12 * st)), f));
      o.metal[i] = f; o.aniso[i] = f * 0.9;
      o.rough[i] = f * (0.24 + 0.2 * st) + (1 - f) * (0.8 + 0.1 * grain[i]);
      o.h[i] = 0.75 * sstep(0.2, 0.8, Fb[i]) + 0.35 * Fw[i] * f + f * 0.08 * st + (1 - f) * 0.015 * grain[i];
    }
    o.ns = 2.6;
  } else if (fin === "enamel") {
    // wire wherever the colour changes (works with part-opacity slots too)
    const e = new Float32Array(N);
    for (let i = 0; i < N; i++) {
      const x = i % W, y = (i / W) | 0, r = 3 * (y * W + ((x + 1) % W)), l = 3 * (y * W + mod(x - 1, W)), d = 3 * (((y + 1) % H) * W + x), u = 3 * (mod(y - 1, H) * W + x);
      let g = 0; for (let k = 0; k < 3; k++) g += Math.abs(A[r + k] - A[l + k]) + Math.abs(A[d + k] - A[u + k]);
      e[i] = clamp(g * 4);
    }
    const eb = blur(e, W, H, 1.5), wire = new Float32Array(N);
    for (let i = 0; i < N; i++) wire[i] = sstep(0.04, 0.3, eb[i]);
    const near = blur(wire, W, H, 6), peel = fbm(W, H, 10, 3, 41), cloud = fbm(W, H, 5, 4, 42), brass = alloy(GOLD, pal.c, 0.1);
    o.cc = new Float32Array(N); o.ccH = new Float32Array(N); o.guil = new Float32Array(N);
    for (let i = 0; i < N; i++) {
      const w = sstep(0.2, 0.7, wire[i]), p = mix3(paint(i), mix3(pal.b, pal.a, 0.35).map((c) => c * 1.5), Mb[i]), lift = 0.8 + 0.2 * near[i] + 0.22 * (cloud[i] - 0.5);
      o.guil[i] = Mb[i] * (1 - w);
      const en = p.map((c) => clamp(Math.pow(c, 1.08) * lift));
      put(i, mix3(en, brass, w));
      o.metal[i] = w + (1 - w) * 0.04;
      o.rough[i] = w * 0.3 + (1 - w) * 0.35;
      o.cc[i] = 1 - w;
      o.h[i] = 0.7 * sstep(0, 1, wire[i]); // rounded wire, no knife-edge rim
      o.ccH[i] = 0.18 * peel[i];
    }
    o.ns = 3.5; o.ccNs = 4;
  } else if (fin === "lacquer") {
    const depth = fbm(W, H, 3, 4, 51), Ab = blur(Ma, W, H, 3), wave = fbm(W, H, 2, 3, 52), wob = fbm(W, H, 6, 2, 59), th = fbm(W, H, 8, 2, 60);
    const isGold = goldish(pal.c), gold = alloy(GOLD, pal.c, 0.12), pearl = mix3(pal.c, [1, 1, 1], 0.2), q = 2, shell = voronoiEdge(W, H, 30, 61);
    o.cc = new Float32Array(N).fill(1); o.ccH = new Float32Array(N);
    if (!isGold) o.irid = new Float32Array(2 * N);
    for (let i = 0; i < N; i++) {
      const x = i % W, y = (i / W) | 0, sid = shell.id[i], fx = isGold ? (x / q) | 0 : sid, fy = isGold ? (y / q) | 0 : 7, nx = (x / 3) | 0, ny = (y / 3) | 0;
      const gap = isGold ? 0 : 1 - sstep(0.3, 0.9, shell.e[i]);
      const dust = Mc[i] * (isGold ? (hash(fx, fy, 53) < 0.95 ? 1 : 0) : 1 - gap), nash = Mb[i] * (hash(nx, ny, 54) < 0.018 ? 1 : 0), fl = Math.max(dust, nash);
      const fid = dust ? hash(fx, fy, 55) : hash(nx, ny, 56), fid2 = dust ? hash(fx, fy, 57) : hash(nx, ny, 58);
      const flake = isGold ? gold.map((c) => c * (0.85 + 0.2 * fid)) : pearl.map((c) => c * (0.8 + 0.25 * fid));
      const deep = 0.6 + 0.5 * depth[i];
      const base = [pal.b[0] * deep * 0.85, pal.b[1] * deep * 0.7, pal.b[2] * deep * 0.65];
      const mot = pal.a.map((c) => c * (0.78 + 0.25 * depth[i]));
      const col = mix3(mix3(base, mot, Ma[i]), mix3(base, isGold ? gold : pearl, 0.3), Mc[i] * (1 - Ma[i]));
      put(i, mix3(col, flake, fl));
      o.metal[i] = isGold ? fl : 0;
      o.rough[i] = fl ? (isGold ? 0.3 + 0.15 * fid2 : 0.12 + 0.1 * fid2) : 0.32;
      if (o.irid) { o.irid[2 * i] = fl; o.irid[2 * i + 1] = 0.6 * th[i] + 0.4 * fid; }
      o.h[i] = 0.4 * sstep(0.1, 0.9, Ab[i]) + 0.1 * Mc[i];
      o.tilt[2 * i] = fl * (fid - 0.5) * (isGold ? 0.16 : 0.1); o.tilt[2 * i + 1] = fl * (fid2 - 0.5) * (isGold ? 0.16 : 0.1);
      o.ccH[i] = 0.25 * o.h[i] + 0.5 * wave[i];
    }
    o.ns = 3; o.ccNs = 2.5;
  } else { // ink
    const fib = fibres(W, H), M = new Float32Array(N);
    for (let i = 0; i < N; i++) M[i] = 1 - Mb[i];
    const Mbl = blur(M, W, H, 1), Mdeb = blur(M, W, H, 2.5);
    for (let i = 0; i < N; i++) {
      const edge = clamp(1 - Math.abs(Mbl[i] - 0.5) / 0.3), tooth = 0.55 * grain[i] + 0.3 * fib[i] + 0.25 * low[i];
      const ink = M[i] * (0.88 + 0.12 * sstep(0.3, 0.45, tooth)), fv = fib[i] * (1 - M[i]);
      const paper = pal.b.map((c, k) => clamp(c * (0.95 + 0.08 * grain[i]) + fv * 0.3 * (0.4 + 0.6 * pal.c[k])));
      const inkc = paint(i).map((c) => c * (1 - 0.18 * edge) * (0.9 + 0.14 * grain[i]));
      put(i, mix3(paper, inkc, ink));
      o.rough[i] = 0.93 - 0.55 * ink * (1 - 0.6 * edge);
      o.h[i] = 0.6 * fib[i] * (1 - 0.7 * M[i]) + 0.12 * grain[i] - sstep(0.1, 0.9, Mdeb[i]) + 0.1 * edge;
    }
    o.ns = 4;
  }
  return o;
}

// ---------- fields -> textures ----------
function tex(W, H, fill, srgb) {
  const d = new ImageData(W, H);
  for (let i = 0; i < W * H; i++) fill(i, d.data, 4 * i);
  const t = new THREE.Texture(d);
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 8; t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace; t.needsUpdate = true;
  return t;
}
function normalTex(h, W, H, s, tilt) {
  return tex(W, H, (i, d, p) => {
    const x = i % W, y = (i / W) | 0, xm = mod(x - 1, W), xp = (x + 1) % W, ym = mod(y - 1, H) * W, yp = ((y + 1) % H) * W, yy = y * W;
    const dx = h[ym + xp] + 2 * h[yy + xp] + h[yp + xp] - h[ym + xm] - 2 * h[yy + xm] - h[yp + xm];
    const dy = h[yp + xm] + 2 * h[yp + x] + h[yp + xp] - h[ym + xm] - 2 * h[ym + x] - h[ym + xp];
    let nx = (-dx * s) / 8 + (tilt ? tilt[2 * i] : 0), ny = (dy * s) / 8 + (tilt ? tilt[2 * i + 1] : 0), l = Math.hypot(nx, ny, 1);
    d[p] = (nx / l) * 127.5 + 127.5; d[p + 1] = (ny / l) * 127.5 + 127.5; d[p + 2] = (1 / l) * 127.5 + 127.5; d[p + 3] = 255;
  });
}

// ---------- shared GL ----------
const U = { uT: { value: new THREE.Vector3(1, 0, 0) }, uB: { value: new THREE.Vector3(0, 1, 0) } };
// engine-turned lines under the enamel, drawn in the shader so they fade once a line spans < 3 px (no moire)
const GUIL_A = `
#include <map_fragment>
float gPh = 64. * vRoughnessMapUv.x + 0.8 * sin(6.2832 * 3. * vRoughnessMapUv.y) + 0.2 * sin(6.2832 * 7. * vRoughnessMapUv.y);
float gK = texture2D(roughnessMap, vRoughnessMapUv).a * (1. - smoothstep(0.22, 0.4, fwidth(gPh)));
diffuseColor.rgb *= 1. + 0.16 * sin(6.2832 * gPh) * gK;`;
const GUIL_N = `
#include <normal_fragment_maps>
{ float y = vRoughnessMapUv.y; vec2 gd = vec2(64., 0.8 * 6.2832 * 3. * cos(6.2832 * 3. * y) + 0.2 * 6.2832 * 7. * cos(6.2832 * 7. * y));
  normal = normalize(normal - (uT * gd.x + uB * gd.y) / length(gd) * cos(6.2832 * gPh) * 0.22 * gK); }`;

let renderer = null, scene, camera, mesh, key, envTex;
const BAND_K = 0.75; // brightness of the soft vertical sheen band in the room
const MAXPX = 2048;
let RW = 256, RH = 256; // drawing buffer; grows to the largest surface drawn so far
function initGL() {
  renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: "high-performance" });
  renderer.setPixelRatio(1); renderer.setSize(RW, RH, false);
  renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.15;
  renderer.setClearColor(0x000000, 0);
  scene = new THREE.Scene();
  // night desk: near-black room, one warm softbox behind-above the viewer, a cool strip, a faint desk bounce
  // far, soft room: a smooth dome with one broad low-contrast lobe; no shapes to reflect
  const env = new THREE.Scene(), dome = new THREE.SphereGeometry(10, 96, 48), pos = dome.attributes.position, col = [], v = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i).normalize();
    // a tall soft band ~20 deg wide: its reflection is a sheen band ~half a tile wide that the pointer sweeps across
    const az = Math.atan2(v.x, v.z), side = 0.14 * (0.5 + 0.5 * Math.sin(az)), l = Math.exp(-((az / 0.22) ** 2)) * Math.exp(-((v.y / 0.7) ** 2)) * (v.z > 0 ? 1 : 0) * BAND_K, up = 0.5 + 0.5 * v.y;
    col.push(0.17 + side + 0.1 * up + 0.5 * l, 0.16 + side + 0.09 * up + 0.48 * l, 0.15 + side + 0.08 * up + 0.45 * l); // side: the room is brighter one way, so turning the tile changes its overall level
  }
  dome.setAttribute("color", new THREE.Float32BufferAttribute(col, 3));
  env.add(new THREE.Mesh(dome, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide })));
  const pm = new THREE.PMREMGenerator(renderer);
  envTex = pm.fromScene(env, 0.04).texture;
  scene.environment = envTex;
  
  key = new THREE.DirectionalLight(0xfff6ee, 1.1); scene.add(key, key.target); // far lamp: grazing enough that its mirror image never lands on a flat tile
  camera = new THREE.PerspectiveCamera(22, 1, 0.1, 50);
  camera.position.set(0, 0, 0.5 / Math.tan((11 * Math.PI) / 180));
  mesh = new THREE.Mesh(new THREE.PlaneGeometry(1, 1)); scene.add(mesh);
}

function inject(m, key, edit) {
  m.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, U);
    sh.fragmentShader = edit(sh.fragmentShader.replace("#include <common>", "#include <common>\nuniform vec3 uT, uB;\n"));
  };
  m.customProgramCacheKey = () => key;
}
async function build({ tile, pal, fin, foil }) {
  const S = await sample(tile, pal, foil), o = fields(fin, S), { W: w, H: h } = S;
  const a8 = (v) => Math.round(clamp(v) * 255);
  const map = tex(w, h, (i, d, p) => { d[p] = a8(o.alb[3 * i]); d[p + 1] = a8(o.alb[3 * i + 1]); d[p + 2] = a8(o.alb[3 * i + 2]); d[p + 3] = 255; }, true);
  const orm = tex(w, h, (i, d, p) => { d[p] = a8(o.cc ? o.cc[i] : 0); d[p + 1] = a8(o.rough[i]); d[p + 2] = a8(o.metal[i]); d[p + 3] = o.guil ? a8(o.guil[i]) : 255; });
  const m = new THREE.MeshPhysicalMaterial({ map, normalMap: normalTex(o.h, w, h, o.ns, o.tilt), roughnessMap: orm, metalnessMap: orm, roughness: 1, metalness: 1, envMap: envTex, envMapIntensity: 1 });
  if (o.cc) Object.assign(m, { clearcoat: 1, clearcoatMap: orm, clearcoatRoughness: fin === "lacquer" ? 0.025 : 0.04, clearcoatNormalMap: normalTex(o.ccH, w, h, o.ccNs), clearcoatNormalScale: new THREE.Vector2(1, 1) });
  if (o.aniso) Object.assign(m, { anisotropy: 1, anisotropyMap: tex(w, h, (i, d, p) => { d[p] = 255; d[p + 1] = 128; d[p + 2] = a8(o.aniso[i]); d[p + 3] = 255; }) });
  if (o.guil) inject(m, "guil", (f) => f.replace("#include <map_fragment>", GUIL_A).replace("#include <normal_fragment_maps>", GUIL_N));
  if (fin === "enamel") Object.assign(m, { envMapIntensity: 0.3, specularIntensity: 0.35, clearcoatRoughness: 0.1 });
  if (fin === "lacquer" && o.irid) { const it = tex(w, h, (i, d, p) => { d[p] = a8(o.irid[2 * i]); d[p + 1] = a8(o.irid[2 * i + 1]); d[p + 2] = 0; d[p + 3] = 255; }); Object.assign(m, { iridescence: 1, iridescenceIOR: 1.65, iridescenceThicknessRange: [280, 900], iridescenceMap: it, iridescenceThicknessMap: it }); }
  if (fin === "ink") m.envMapIntensity = 0.6;
  return m;
}

// ---------- surfaces ----------
// Materials build one at a time, only for surfaces near the view; one unseen for 5 s is freed (a page of 40 worlds would hold GBs of maps).
const SURF = [], MATS = new Map();
let busy = false, sweep = 0;
const io = typeof IntersectionObserver !== "undefined" ? new IntersectionObserver((es) => es.forEach((e) => { e.target.__s.visible = e.isIntersecting; e.target.__s.dirty = true; }), { rootMargin: "50% 0px" }) : null;
export function surface(el) {
  const s = { el, visible: !io, dirty: true, mat: null, cv: null, ctx: null, geo: null, key: "", spec: null };
  el.__s = s; SURF.push(s); io?.observe(el);
  return s;
}
// tile: engine render() or renderMedallion() output. The element's own CSS background is the flat fallback; its size and position set the repeat.
export function assign(s, tile, pal, fin, foil = "a") {
  s.spec = { tile, pal, fin, foil }; s.key = `${fin}|${foil}|${pal.a}${pal.b}${pal.c}|${tile.svg}`; s.geo = null; s.dirty = true;
}
function ensureCanvas(s, w, h) {
  if (!s.cv) { s.cv = document.createElement("canvas"); s.cv.style.cssText = "position:absolute;inset:0;width:100%;height:100%;display:block"; s.ctx = s.cv.getContext("2d"); s.el.append(s.cv); }
  if (s.cv.width !== w || s.cv.height !== h) { s.cv.width = w; s.cv.height = h; s.geo = null; }
}
const OS = 1.08; // overscan so the tilt never shows a plane edge
const len = (v, full, auto) => (v.endsWith("%") ? (parseFloat(v) / 100) * full : parseFloat(v) || auto);
function geometry(s, cw, ch) {
  const cs = getComputedStyle(s.el), t = s.spec.tile, [bw, bh = "auto"] = cs.backgroundSize.split(" "), [bx, by = "50%"] = cs.backgroundPosition.split(" ");
  const tw = len(bw, cw, t.w), th = len(bh, ch, (tw * t.h) / t.w), px = len(bx, cw - tw, 0), py = len(by, ch - th, 0);
  const g = new THREE.PlaneGeometry((cw / ch) * OS, OS), pos = g.attributes.position, uv = g.attributes.uv;
  for (let i = 0; i < pos.count; i++) uv.setXY(i, (pos.getX(i) * ch + cw / 2 - px) / tw, 1 - (ch / 2 - pos.getY(i) * ch - py) / th);
  return g;
}

// ---------- pointer: damped spring, idle drift ----------
const P = { x: innerWidth * 0.3, y: innerHeight * 0.25, vx: 0, vy: 0, tx: innerWidth * 0.3, ty: innerHeight * 0.25, last: -1e9 };
addEventListener("pointermove", (e) => { P.tx = e.clientX; P.ty = e.clientY; P.last = performance.now(); });
addEventListener("scroll", () => SURF.forEach((s) => (s.dirty = true)), { passive: true });
addEventListener("resize", () => SURF.forEach((s) => { s.dirty = true; s.geo = null; }));
export const stats = { fps: 0, ms: 0, drawn: 0, visible: 0, gl: "", built: 0 };
let tPrev = performance.now(), acc = { n: 0, ms: 0, t0: performance.now(), drawn: 0 };
const OMEGA = 16, TILT = 0.078; // critically damped: settles in ~0.25 s, no overshoot; up to ~4.5 deg tilt

function frame(now) {
  requestAnimationFrame(frame);
  const dt = Math.min(1 / 30, (now - tPrev) / 1000); tPrev = now;
  if (!REDUCED && now - P.last > 2500) { const t = now / 1000; P.tx = innerWidth * (0.5 + 0.34 * Math.sin(t * 0.23)); P.ty = innerHeight * (0.42 + 0.3 * Math.sin(t * 0.15 + 1.3)); }
  if (REDUCED) { P.x = P.tx; P.y = P.ty; P.vx = P.vy = 0; }
  else for (const k of ["x", "y"]) { const v = "v" + k, t = "t" + k, a = OMEGA * OMEGA * (P[t] - P[k]) - 2 * OMEGA * P[v]; P[v] += a * dt; P[k] += P[v] * dt; }
  const moving = Math.abs(P.tx - P.x) > 0.2 || Math.abs(P.ty - P.y) > 0.2 || Math.hypot(P.vx, P.vy) > 0.2;
  if (moving || P.moved !== moving) SURF.forEach((s) => (s.dirty = true));
  P.moved = moving;
  const t0 = performance.now(); let drawn = 0, vis = 0, want = null;
  const gx = P.x / innerWidth - 0.5, gy = P.y / innerHeight - 0.5;
  for (const s of SURF) {
    if (!s.visible || !s.key) continue;
    const mat = MATS.get(s.key);
    if (mat !== s.mat) { s.mat = mat; s.dirty = true; }
    if (!mat) { want ||= s; continue; }
    mat.userData.seen = now; vis++;
    if (!s.dirty) continue;
    const r = s.el.getBoundingClientRect(), dpr = Math.min(2, devicePixelRatio || 1), w = Math.min(MAXPX, Math.round(r.width * dpr)), h = Math.min(MAXPX, Math.round(r.height * dpr));
    if (!w || !h || r.bottom < 0 || r.top > innerHeight) { s.dirty = false; continue; }
    ensureCanvas(s, w, h);
    if (!s.geo) s.geo = geometry(s, r.width, r.height);
    if (w > RW || h > RH) { RW = Math.max(RW, w); RH = Math.max(RH, h); renderer.setSize(RW, RH, false); }
    const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
    // the tile under the pointer feels it fully (band crosses the tile as the pointer does); every tile feels the page-wide position a little
    const u = (P.x - cx) / r.width, vy = (P.y - cy) / r.height;
    scene.environmentRotation.set(clamp(vy * 0.5, -0.35, 0.35) + 0.1 * gy, -(clamp(u * 0.85, -0.6, 0.6) + 0.12 * gx), 0);
    mesh.geometry = s.geo; mesh.material = mat; mat.envMapRotation.copy(scene.environmentRotation);
    // a long strip turned about its short axis would swing its far end out of frame: scale that tilt by the aspect
    mesh.rotation.set(REDUCED ? 0 : clamp((P.y - cy) / Math.max(r.height * 0.6, 300), -1, 1) * TILT * Math.min(1, w / h), REDUCED ? 0 : clamp((P.x - cx) / Math.max(r.width * 0.6, 300), -1, 1) * TILT * Math.min(1, h / w), 0);
    key.position.set(-0.45 + 1.3 * clamp(u, -0.6, 0.6) + 0.2 * gx, 0.7 - 0.3 * clamp(vy, -0.6, 0.6), 0.8); key.target.position.set(0, 0, 0); key.updateMatrixWorld(); key.target.updateMatrixWorld();
    camera.aspect = w / h; camera.updateProjectionMatrix(); camera.updateMatrixWorld(); mesh.updateMatrixWorld();
    U.uT.value.set(1, 0, 0).applyQuaternion(mesh.quaternion); U.uB.value.set(0, 1, 0).applyQuaternion(mesh.quaternion);
    renderer.setViewport(0, 0, w, h); renderer.setScissor(0, 0, w, h); renderer.setScissorTest(true);
    renderer.render(scene, camera);
    s.ctx.clearRect(0, 0, w, h); s.ctx.drawImage(renderer.domElement, 0, RH - h, w, h, 0, 0, w, h);
    s.dirty = false; drawn++;
  }
  if (want && !busy) {
    busy = true; const k = want.key;
    build(want.spec).then((m) => { m.userData.seen = performance.now(); MATS.set(k, m); stats.built++; }, (e) => console.error(e)).finally(() => (busy = false));
  }
  if (now - sweep > 2000) {
    sweep = now;
    for (const [k, m] of MATS) if (now - m.userData.seen > 5000) { for (const v of Object.values(m)) if (v?.isTexture && v !== envTex) v.dispose(); m.dispose(); MATS.delete(k); }
  }
  const ms = performance.now() - t0;
  if (drawn) { acc.n++; acc.ms += ms; acc.drawn += drawn; }
  stats.visible = vis;
  if (now - acc.t0 > 1000) { stats.fps = Math.round((acc.n * 1000) / (now - acc.t0)); stats.ms = acc.n ? +(acc.ms / acc.n).toFixed(1) : 0; stats.drawn = acc.n ? Math.round(acc.drawn / acc.n) : 0; acc = { n: 0, ms: 0, t0: now, drawn: 0 }; }
}

export function start() {
  if (renderer) return true;
  try { initGL(); } catch (e) { renderer = null; console.warn("WebGL unavailable, static SVG tiles shown", e); return false; }
  const gl = renderer.getContext(), dbg = gl.getExtension("WEBGL_debug_renderer_info");
  stats.gl = dbg ? gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL) : "webgl";
  requestAnimationFrame(frame);
  return true;
}
