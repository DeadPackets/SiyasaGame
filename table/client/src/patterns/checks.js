// Browser checks: seam proof against an unclipped 3x3 render, ink share at 48 px, perceptual-hash distinctness, size.
import { render, renderMedallion, colorize, dataURL } from "./engine.js";
import { GOOD, BAD } from "./calibration.js";

const NEUTRAL = { a: "#ffffff", b: "#000000", c: "#808080" };
const cv = (w, h) => { const c = document.createElement("canvas"); c.width = w; c.height = h; return c; };
// rasterise at the exact pixel size it is drawn at, so the canvas never resamples a smaller bitmap
async function img(svg, w, h) {
  const s = w ? svg.replace(/^<svg([^>]*?) width="[^"]*" height="[^"]*"/, `<svg$1 width="${w}" height="${h}"`).replace(/^<svg(?![^>]*width=)/, `<svg width="${w}" height="${h}"`) : svg;
  const i = new Image(); i.src = dataURL(s); await i.decode(); return i;
}

// S = px per unit: 100 -> 250 px, 173.2 -> 433 px (whole pixels, so seams sit on pixel edges).
// A pixel fails when a channel differs by > 64: antialias residue between clipped and unclipped paths peaks near 50 (tangent slivers),
// a half-pixel shift of the wrapped copies already gives 72+ (see the shift control).
// Both sides are rasterised 4 x 4 finer and averaged back to S px per unit. Skia flattens a curve with an error of up to ~0.3 device px
// that changes with the curve's horizontal position (measured: one wave render with its viewBox moved by exactly one cell differs by up to
// 78 at 12 px, never when moved down a cell), so at S alone an exactly periodic tile can fail. That error is fixed in device px and averages
// away; a real seam (a missing or misplaced copy) is in cell units and does not.
export async function seam(recipe, pal, opt = {}, S = 2.5, K = 4) {
  const o = render(recipe, opt.where ? {} : opt), tw = Math.round(o.w * S), th = Math.round(o.h * S), TW = tw * K, TH = th * K, M = 6;
  const tile = await img(colorize(o.svg, pal), TW, TH), truth = colorize(render(recipe, { span: 3 }).svg, pal);
  let px = 0, aa = 0, max = 0;
  // each seam band (within 3 px of an inner tile edge, in output px), compared inside a crop M px wider than the band
  const bands = [tw, 2 * tw].map((s) => [s - 2, 0, 5, 3 * th]).concat([th, 2 * th].map((s) => [0, s - 2, 3 * tw, 5]));
  const seen = new Set();
  for (const [x0, y0, bw, bh] of bands) {
    const rx = Math.max(0, x0 - M), ry = Math.max(0, y0 - M), rw = Math.min(3 * tw, x0 + bw + M) - rx, rh = Math.min(3 * th, y0 + bh + M) - ry, W = rw * K;
    const A = cv(W, rh * K), B = cv(W, rh * K), a = A.getContext("2d"), b = B.getContext("2d");
    for (let j = 0; j < 3; j++) for (let i = 0; i < 3; i++) a.drawImage(tile, (i * tw - rx) * K, (j * th - ry) * K, TW, TH);
    b.drawImage(await img(truth.replace(/viewBox="[^"]*"/, `viewBox="${rx / S} ${ry / S} ${rw / S} ${rh / S}"`), W, rh * K), 0, 0);
    const da = a.getImageData(0, 0, W, rh * K).data, db = b.getImageData(0, 0, W, rh * K).data;
    for (let y = y0; y < y0 + bh; y++) for (let x = x0; x < x0 + bw; x++) {
      const key = y * 1e5 + x; if (seen.has(key)) continue; seen.add(key);
      let d = 0;
      for (let c = 0; c < 3; c++) { let sum = 0; for (let v = 0; v < K; v++) for (let u = 0; u < K; u++) { const k = (((y - ry) * K + v) * W + (x - rx) * K + u) * 4 + c; sum += da[k] - db[k]; } d = Math.max(d, Math.abs(sum) / (K * K)); }
      if (d > max) max = d;
      if (d > 64) { px++; if (opt.where && opt.where.length < 40) opt.where.push([x, y, Math.round(d)]); } else if (d > 24) aa++;
    }
  }
  return { px, aa, max: Math.round(max) };
}

// Plainness: rasterise one field tile (no emblem) with a neutral palette, label connected regions on the torus,
// and count distinct region shapes (slot, area, compactness). A plain grid or lattice has very few (a checkerboard has 2).
export async function plainness(recipe, px = 160) {
  const o = render(recipe), W = px, H = Math.round((px * o.h) / o.w);
  const C = cv(W, H), c = C.getContext("2d");
  c.drawImage(await img(colorize(o.svg, NEUTRAL), W, H), 0, 0, W, H);
  const d = c.getImageData(0, 0, W, H).data, lab = new Int32Array(W * H).fill(-1), cls = new Uint8Array(W * H);
  for (let k = 0; k < W * H; k++) cls[k] = Math.min(4, Math.floor(d[4 * k] / 51.2)); // 5 grey levels keep slot opacities apart
  const shapes = new Map(); let regions = 0;
  for (let k0 = 0; k0 < W * H; k0++) {
    if (lab[k0] >= 0) continue;
    let area = 0, edge = 0; const st = [k0]; lab[k0] = regions;
    while (st.length) {
      const k = st.pop(), x = k % W, y = (k / W) | 0; area++;
      for (const n of [y * W + ((x + 1) % W), y * W + ((x + W - 1) % W), ((y + 1) % H) * W + x, ((y + H - 1) % H) * W + x]) {
        if (cls[n] !== cls[k0]) { edge++; continue; }
        if (lab[n] < 0) { lab[n] = regions; st.push(n); }
      }
    }
    regions++;
    if (area < 8) continue;
    // area in 25% steps, compactness (edge^2/area) in 30% steps
    const sig = `${cls[k0]}:${Math.round(Math.log(area) / Math.log(1.25))}:${Math.round(Math.log((edge * edge) / area) / Math.log(1.3))}`;
    if (!shapes.has(sig)) shapes.set(sig, { area, comp: (edge * edge) / area });
  }
  const distinct = shapes.size;
  // a lattice repeats compact cells (squares, discs, diamonds: edge^2/area < 30); a key fret repeats long corridors, which is structure
  const cls2 = [...shapes.values()].sort((a, b) => b.area - a.area).slice(1), compact = cls2.every((x) => x.comp < 30);
  const L0 = (recipe.layers || [])[0]?.params || {}, F0 = (recipe.layers || [])[0]?.family;
  // constructions that are a lattice by definition, when they stand alone
  const structural = (recipe.layers || []).length === 1 && ((F0 === "girih" && L0.tiling === "4.4.4.4") || (F0 === "fret" && L0.motif === "knot" && (L0.pattern === "plait" || L0.breaks === 0)) || (F0 === "textile" && L0.motif === "weave" && ["gingham", "pinwheel"].includes(L0.preset)));
  return { regions, distinct, structural, plain: ((distinct <= PLAIN_MAX && compact) || structural) && recipe.theme !== "lattice" };
}
export const PLAIN_MAX = 3;

// Connectedness / coverage: is the tile an all-over, edge-to-edge pattern or motifs floating on ground?
// Rasterise one cell (S px per unit) with motif slots white and ground black; interlace is off and band outlines, gaps and rope lay lines are
// painted as motif, since an over-under cut or an outline does not split a band. On the torus, label motif components after a 1 px
// erosion (point contacts do not join) and ground components after a 1.5 unit erosion (grout and outline lines up to 3 units wide do not
// join ground regions), and record whether a component wraps across the cell boundary (its own copy is reachable). Then:
//   motif wraps  -> a connected network of bands across the boundary (girih, frets, meander rows, scales, scrolls)
//   ground wraps -> open ground: share of the cell and the largest empty disc in it (distance transform), as a fraction of the motif repeat
// pass = motif wraps and disc <= CONN.net (a network may frame open ground, not big plain fields)
//     or ground does not wrap (the regions tile the plane, like a checkerboard)
//     or open share <= CONN.open and disc <= CONN.disc (separate tiles with thin gaps, like kikko).
export const CONN = { net: 0.55, open: 0.35, disc: 0.4 };
// pal: the real slot colours, so a highlight too close to the ground counts as ground (what the eye sees); neutral when omitted
export async function connected(recipe, pal, S = 4) {
  const r = { ...recipe, layers: (recipe.layers || []).map((L) => ({ ...L, params: { ...(L.params || {}), interlace: false, gapSlot: "a", edge: "a", lay: "a" } })) };
  return coverage(render(r), pal, S);
}
// o: {svg, w, h, grid} of one seamless tile (an engine render or a hand-made tile with its motif grid)
export async function coverage(o, pal = { a: "#ffffff", b: "#000000", c: "#ffffff" }, S = 4) {
  const W = Math.round(o.w * S), H = Math.round(o.h * S), N = W * H;
  const C = cv(W, H), c = C.getContext("2d");
  c.drawImage(await img(colorize(o.svg, pal), W, H), 0, 0, W, H);
  // motif = visibly not ground: RGB distance from b over 37.5% of the a-b distance (a slot at >= 37.5% opacity, or a c far enough from b)
  const d = c.getImageData(0, 0, W, H).data, M = new Uint8Array(N), g = hex2(pal.b), cut = 0.375 * Math.hypot(...hex2(pal.a).map((v, i) => v - g[i]));
  for (let k = 0; k < N; k++) M[k] = Math.hypot(d[4 * k] - g[0], d[4 * k + 1] - g[1], d[4 * k + 2] - g[2]) > cut ? 1 : 0;
  const at = (x, y) => ((y + H) % H) * W + ((x + W) % W);
  const step = (A, keep) => { const E = new Uint8Array(N); for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const k = y * W + x; E[k] = keep(A[k], A[at(x + 1, y)], A[at(x - 1, y)], A[at(x, y + 1)], A[at(x, y - 1)]) ? 1 : 0; } return E; };
  const erode = (A, n) => { for (let i = 0; i < n; i++) A = step(A, (...v) => v.every(Boolean)); return A; };
  const isM = M, isG = M.map((v) => 1 - v), RG = Math.round(1.5 * S);
  // components of mask A on the torus; lift = how many cells the walk crossed; a component wraps when it meets itself at another lift
  function comps(A) {
    const lab = new Int32Array(N).fill(-1), lx = new Int32Array(N), ly = new Int32Array(N), out = [];
    for (let k0 = 0; k0 < N; k0++) {
      if (!A[k0] || lab[k0] >= 0) continue;
      const id = out.length, C = { area: 0, wrap: false }, st = [k0];
      lab[k0] = id; out.push(C);
      while (st.length) {
        const k = st.pop(), x = k % W, y = (k / W) | 0; C.area++;
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          let nx = x + dx, ny = y + dy, ox = 0, oy = 0;
          if (nx < 0) { nx += W; ox = -1; } else if (nx >= W) { nx -= W; ox = 1; }
          if (ny < 0) { ny += H; oy = -1; } else if (ny >= H) { ny -= H; oy = 1; }
          const n = ny * W + nx;
          if (!A[n]) continue;
          if (lab[n] < 0) { lab[n] = id; lx[n] = lx[k] + ox; ly[n] = ly[k] + oy; st.push(n); }
          else if (lx[n] !== lx[k] + ox || ly[n] !== ly[k] + oy) C.wrap = true;
        }
      }
    }
    return { lab, out };
  }
  const mo = comps(erode(isM, 1)), gr = comps(erode(isG, RG));
  const motifWraps = mo.out.some((x) => x.wrap), groundWraps = gr.out.some((x) => x.wrap);
  // open ground = the wrapping eroded ground grown back over ground by the same radius
  let open = new Uint8Array(N);
  for (let k = 0; k < N; k++) if (gr.lab[k] >= 0 && gr.out[gr.lab[k]].wrap) open[k] = 1;
  for (let i = 0; i < RG; i++) open = step(open, (c, ...v) => c || v.some(Boolean)).map((v, k) => v & isG[k]);
  let openArea = 0; for (let k = 0; k < N; k++) openArea += open[k];
  const rep = Math.min(o.grid.px, o.grid.py) * S, disc = (A) => (2 * Math.sqrt(edtMax(isG, W, H, A))) / rep;
  const x = { motifWraps, groundWraps, open: openArea / N, disc: disc(open), discAll: disc(isG) };
  return { ...x, pass: connPass(x) };
}
export const connPass = (x) => (x.motifWraps ? x.disc <= CONN.net : !x.groundWraps || (x.open <= CONN.open && x.disc <= CONN.disc));
// squared Euclidean distance transform (Felzenszwalb) on the torus: each line is transformed over three periods and the middle kept
function edt1(fv, n) {
  const m = 3 * n, F = new Float64Array(m), D = new Float64Array(m), v = new Int32Array(m), z = new Float64Array(m + 1);
  for (let i = 0; i < m; i++) F[i] = fv[i % n];
  const cut = (q, p) => (F[q] + q * q - (F[p] + p * p)) / (2 * q - 2 * p);
  let k = 0; z[0] = -Infinity; z[1] = Infinity;
  for (let q = 1; q < m; q++) {
    let s = cut(q, v[k]);
    while (s <= z[k]) { k--; s = cut(q, v[k]); }
    k++; v[k] = q; z[k] = s; z[k + 1] = Infinity;
  }
  k = 0;
  for (let q = 0; q < m; q++) { while (z[k + 1] < q) k++; D[q] = (q - v[k]) ** 2 + F[v[k]]; }
  return D.subarray(n, 2 * n);
}
// max over the pixels in mask of the squared distance to the nearest pixel outside A
function edtMax(A, W, H, mask = A) {
  const G = new Float64Array(W * H);
  let any = false;
  for (let k = 0; k < W * H; k++) { G[k] = A[k] ? 1e12 : 0; if (!A[k]) any = true; }
  if (!any) return (Math.min(W, H) / 2) ** 2;
  const col = new Float64Array(H);
  for (let x = 0; x < W; x++) { for (let y = 0; y < H; y++) col[y] = G[y * W + x]; const D = edt1(col, H); for (let y = 0; y < H; y++) G[y * W + x] = D[y]; }
  let mx = 0; const row = new Float64Array(W);
  for (let y = 0; y < H; y++) { for (let x = 0; x < W; x++) row[x] = G[y * W + x]; const D = edt1(row, W); for (let x = 0; x < W; x++) if (mask[y * W + x] && D[x] > mx) mx = D[x]; }
  return mx;
}

const hex2 = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));

// share of medallion pixels that are not ground, and share of strong horizontal edges (mush indicator)
export async function density(svg, w, h, pal, size = 48) {
  const th = Math.round((size * h) / w), C = cv(size, size), c = C.getContext("2d");
  c.drawImage(await img(colorize(svg, pal), size, th), 0, (size - th) / 2, size, th);
  const d = c.getImageData(0, 0, size, size).data, g = hex2(pal.b);
  let ink = 0, edge = 0;
  const lum = (k) => 0.3 * d[k] + 0.59 * d[k + 1] + 0.11 * d[k + 2];
  for (let k = 0; k < d.length; k += 4) {
    if (Math.hypot(d[k] - g[0], d[k + 1] - g[1], d[k + 2] - g[2]) > 60) ink++;
    if ((k / 4) % size < size - 1 && Math.abs(lum(k) - lum(k + 4)) > 40) edge++;
  }
  return { ink: ink / (size * size), edge: edge / (size * (size - 1)) };
}

// ---------- fullscreen comfort and presence ----------
// The reveal floods the screen with the chosen ideology's tile at about 88 px per 100-unit cell (v27: 5.5rem reveal tile, 84 px field cells at 1920 x 1080).
// COMFORT limits what a calm full-screen flash may do; PRESENCE keeps austere ideologies visible at 48 px.
export const REVEAL_PX = 88; // round 4 scale, kept for reference
// Round 5: the flash draws one motif repeat (grid.px, the horizontal motif pitch) FLASH_MOTIF_PX wide, about 3x round 4, so 1920 x 1080 holds ~8 x 4.5 motifs.
export const FLASH_MOTIF_PX = 240;
export const STROBE_PX = 24;
export const flashCell = (o) => (FLASH_MOTIF_PX * o.w) / (o.grid?.px || o.w);
// Round 5 thresholds at the 240 px motif flash (calibrated on the catalogue: edge energy falls ~2.5x from the 88 px cell; 16 there ~ 7-10 here;
// fine repeats now count rising edges within 24 px; spread rises ~1 L* with less antialiasing). Round 4 (88 px): grad 16, strobe 8 within 10 px, sd 30.
export const COMFORT = { grad: 10, strobe: 4, dL: 60, dLc: 80, sd: 32 };
const LIN = Array.from({ length: 256 }, (_, v) => ((v /= 255) <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
const Lstar = (r, g, b) => { const Y = 0.2126 * LIN[r] + 0.7152 * LIN[g] + 0.0722 * LIN[b]; return Y > 0.008856 ? 116 * Math.cbrt(Y) - 16 : 903.3 * Y; };
export const lstarHex = (h) => Lstar(...hex2(h));
function lmap(d, N) { const L = new Float32Array(N); for (let k = 0; k < N; k++) L[k] = Lstar(d[4 * k], d[4 * k + 1], d[4 * k + 2]); return L; }
// grad = mean lightness change to the next pixel right and below (L* per px): how busy the flash is, weighted by contrast;
// edge = share of pixels with a step over 12 L* (reported); strobe: see below (median over sampled rows, and over columns; the worse direction)
// recipe may also be a pre-rendered tile {svg, w, h} (the hand-made reference)
export async function comfort(recipe, pal, W = 1920, H = 1080, px, win = STROBE_PX) {
  const o = recipe.svg ? recipe : render(recipe); px ??= flashCell(o);
  const tw = Math.round(px), th = Math.round((px * o.h) / o.w), C = cv(W, H), c = C.getContext("2d");
  const t = cv(tw, th); t.getContext("2d").drawImage(await img(colorize(o.svg, pal), tw, th), 0, 0, tw, th);
  c.fillStyle = c.createPattern(t, "repeat"); c.fillRect(0, 0, W, H);
  const L = lmap(c.getImageData(0, 0, W, H).data, W * H);
  let e = 0, g = 0, sum = 0, sq = 0;
  for (let y = 0; y < H - 1; y++) for (let x = 0; x < W - 1; x++) { const k = y * W + x, v = L[k], gx = Math.abs(v - L[k + 1]), gy = Math.abs(v - L[k + W]); sum += v; sq += v * v; g += gx + gy; if (gx > 12 || gy > 12) e++; }
  const n = (W - 1) * (H - 1), med = (a) => a.sort((x, y) => x - y)[a.length >> 1];
  // strobe: rising edges (a step up of 15 L* or more) that follow the previous rising edge within 10 px, per 100 px of line; thin lines far apart score 0, fine stripes high
  const line = (n, at) => { let k = 0, last = -999, prev = 0; for (let i = 1; i < n; i++) { const d = at(i) - at(i - 1); if (d > 15 && prev <= 15) { if (i - last < win) k++; last = i; } prev = d; } return (100 * k) / n; };
  const rows = [], cols = [];
  for (let y = 4; y < H; y += 16) rows.push(line(W, (x) => L[y * W + x]));
  for (let x = 4; x < W; x += 16) cols.push(line(H, (y) => L[y * W + x]));
  const mean = sum / n, out = { edge: e / n, grad: g / n, strobe: Math.max(med(rows), med(cols)), mean, sd: Math.sqrt(Math.max(0, sq / n - mean * mean)), dL: Math.abs(lstarHex(pal.a) - lstarHex(pal.b)), dLc: Math.abs(lstarHex(pal.c) - lstarHex(pal.b)) };
  out.fails = [out.grad > COMFORT.grad && `busy: edge energy ${out.grad.toFixed(1)} L*/px > ${COMFORT.grad}`, out.strobe > COMFORT.strobe && `strobing: ${out.strobe.toFixed(1)} fine repeats per 100 px > ${COMFORT.strobe}`, out.dL > COMFORT.dL && `a-b ${out.dL.toFixed(0)} L* > ${COMFORT.dL}`, out.dLc > COMFORT.dLc && `c-b ${out.dLc.toFixed(0)} L* > ${COMFORT.dLc}`, out.sd > COMFORT.sd && `flash contrast ${out.sd.toFixed(0)} > ${COMFORT.sd}`].filter(Boolean);
  out.pass = !out.fails.length;
  return out;
}
// presence: the ideology must read at every size it is shown. At the 48 px medallion (no emblem): a stands off b, ink, lightness spread,
// stroke width and mean lightness difference from the ground; on the 54 px card strip and the 240 px-per-motif flash: ink and mean difference.
// width = 2 x ink area / ink perimeter (perimeter from 4-neighbour edges x pi/4), the mean band width, in 48 px medallion pixels.
// Calibrated on Egypt 2011: the round-6 tiles the owner liked pass (thinnest: Salafism, girih 6.6.6 width 3.6, 1.07 px, mean 7.7 / 7.5 / 7.4;
// round-6 Rome Stoicism, flash mean 6.1, sets the flash floor at 6);
// the final-round Opus Liberalism (6.6.6 width 2.4: 0.78 px, mean 3.7 / 3.4 / 3.6) and Salafism (4.8.8 width 2.2: 0.68 px, 6.6 / 5.7 / 5.5) fail.
// Each floor sits between the faint pair and the thinnest liked tile, nearer the faint side, so tiles that are fine but thin (shippo,
// isogrid, quilts: many fine lines, mean 9.6 L* and up) still pass; the width floor applies only to a line-only tile (mean under lineMean).
export const PRESENCE = { dL: 20, ink: 0.15, sd: 7, width: 0.85, lineMean: 9, mean: 7, strip: { ink: 0.14, mean: 6.4 }, flash: { ink: 0.12, mean: 6 } };
function inkStats(d, N, pal) {
  const g = hex2(pal.b), Lb = lstarHex(pal.b); let ink = 0, all = 0;
  for (let k = 0; k < N; k++) { if (Math.hypot(d[4 * k] - g[0], d[4 * k + 1] - g[1], d[4 * k + 2] - g[2]) > 60) ink++; all += Math.abs(Lstar(d[4 * k], d[4 * k + 1], d[4 * k + 2]) - Lb); }
  return { ink: ink / N, mean: all / N };
}
// the tile repeated at k px per unit over a W x H view
async function tiled(o, pal, k, W, H) {
  const tw = Math.max(1, Math.round(o.w * k)), th = Math.max(1, Math.round(o.h * k)), t = cv(tw, th), C = cv(W, H), c = C.getContext("2d");
  t.getContext("2d").drawImage(await img(colorize(o.svg, pal), tw, th), 0, 0, tw, th);
  c.fillStyle = c.createPattern(t, "repeat"); c.fillRect(0, 0, W, H);
  return inkStats(c.getImageData(0, 0, W, H).data, W * H, pal);
}
async function bandWidth(o, pal, S = 8) {
  const W = Math.round(o.w * S), H = Math.round(o.h * S), C = cv(W, H), c = C.getContext("2d");
  c.drawImage(await img(colorize(o.svg, pal), W, H), 0, 0, W, H);
  const d = c.getImageData(0, 0, W, H).data, g = hex2(pal.b), cut = 0.5 * Math.hypot(...hex2(pal.a).map((v, i) => v - g[i])), M = new Uint8Array(W * H);
  for (let k = 0; k < W * H; k++) M[k] = Math.hypot(d[4 * k] - g[0], d[4 * k + 1] - g[1], d[4 * k + 2] - g[2]) > cut ? 1 : 0;
  let A = 0, P = 0;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { if (!M[y * W + x]) continue; A++; P += 4 - M[y * W + ((x + 1) % W)] - M[y * W + ((x + W - 1) % W)] - M[((y + 1) % H) * W + x] - M[((y + H - 1) % H) * W + x]; }
  return P ? (2 * A) / ((P * Math.PI) / 4) / S : Math.min(o.w, o.h);
}
export async function presence(recipe, pal) {
  const m = recipe.svg ? recipe : renderMedallion({ ...recipe, emblem: undefined }), C = cv(48, 48), c = C.getContext("2d");
  c.drawImage(await img(colorize(m.svg, pal), 48, 48), 0, 0, 48, 48);
  const d = c.getImageData(0, 0, 48, 48).data, L = lmap(d, 48 * 48), N = 48 * 48;
  let s = 0, s2 = 0;
  for (let k = 0; k < N; k++) { s += L[k]; s2 += L[k] * L[k]; }
  const o = recipe.svg ? recipe : render(recipe), g = o.grid || { px: o.w, py: o.h }, V = m.w; // the medallion view width in units
  const mu = s / N, at48 = inkStats(d, N, pal), P = PRESENCE;
  const out = { ink: at48.ink, mean: at48.mean, sd: Math.sqrt(Math.max(0, s2 / N - mu * mu)), dL: Math.abs(lstarHex(pal.a) - lstarHex(pal.b)), width: ((await bandWidth(o, pal)) * 48) / V,
    strip: await tiled(o, pal, 54 / g.py, 240, 54), flash: await tiled(o, pal, FLASH_MOTIF_PX / g.px, 480, 480) };
  const pc = (v) => `${+(v * 100).toFixed(1)}%`;
  out.fails = [out.dL < P.dL && `a-b ${out.dL.toFixed(0)} L* < ${P.dL}`, out.ink < P.ink && `48 px ink ${pc(out.ink)} < ${pc(P.ink)}`, out.sd < P.sd && `48 px contrast ${out.sd.toFixed(1)} < ${P.sd}`,
    out.width < P.width && out.mean < P.lineMean && `lines ${out.width.toFixed(2)} px wide at 48 px < ${P.width} (line-only needs a bolder stroke)`, out.mean < P.mean && `48 px mean lightness off the ground ${out.mean.toFixed(1)} L* < ${P.mean} (line-only needs a stronger ink colour)`,
    out.strip.ink < P.strip.ink && `strip ink ${pc(out.strip.ink)} < ${pc(P.strip.ink)}`, out.strip.mean < P.strip.mean && `strip mean lightness off the ground ${out.strip.mean.toFixed(1)} L* < ${P.strip.mean}`,
    out.flash.ink < P.flash.ink && `flash ink ${pc(out.flash.ink)} < ${pc(P.flash.ink)}`, out.flash.mean < P.flash.mean && `flash mean lightness off the ground ${out.flash.mean.toFixed(1)} L* < ${P.flash.mean}`].filter(Boolean);
  out.pass = !out.fails.length;
  return out;
}

// 63-bit DCT hash of the shape (neutral palette, centre 64 px square)
export async function phash(svg, w, h) {
  const th = Math.round((64 * h) / w), C = cv(32, 32), c = C.getContext("2d");
  c.drawImage(await img(colorize(svg, NEUTRAL), 32, th / 2), 0, (32 - th / 2) / 2, 32, th / 2);
  const d = c.getImageData(0, 0, 32, 32).data, g = [];
  for (let k = 0; k < d.length; k += 4) g.push(0.3 * d[k] + 0.59 * d[k + 1] + 0.11 * d[k + 2]);
  const co = [];
  for (let u = 0; u < 8; u++) for (let v = 0; v < 8; v++) {
    if (!u && !v) continue;
    let s = 0;
    for (let y = 0; y < 32; y++) for (let x = 0; x < 32; x++) s += g[y * 32 + x] * Math.cos(((2 * x + 1) * u * Math.PI) / 64) * Math.cos(((2 * y + 1) * v * Math.PI) / 64);
    co.push(s);
  }
  const med = [...co].sort((a, b) => a - b)[co.length >> 1];
  return co.map((v) => v > med);
}
const ham = (a, b) => a.reduce((n, v, i) => n + (v !== b[i]), 0);

export async function runChecks(WORLDS) {
  const tiles = [];
  for (const W of WORLDS) {
    const group = [];
    for (const [id, r] of Object.entries(W.recipes)) {
      const o = render(r), m = renderMedallion(r), s = await seam(r, W.pal[id]), pl = await plainness(r), cn = await connected(r, W.pal[id]);
      group.push({ world: W.id, id, kind: "engine", bytes: o.bytes, recipe: JSON.stringify(r).length, seamPx: s.px, seamAA: s.aa, seamMax: s.max, ...(await density(m.svg, m.w, m.h, W.pal[id])), hash: await phash(m.svg, m.w, m.h), distinct: pl.distinct, plain: pl.plain, conn: cn });
    }
    const hand = [];
    for (const [id, svg] of Object.entries(W.hand || {})) hand.push({ world: W.id, id, kind: "hand", bytes: svg.length, recipe: null, seamPx: null, ...(await density(svg, 100, 100, W.pal[id])), hash: await phash(svg, 100, 100), conn: await coverage({ svg, w: 100, h: 100, grid: { x: 50, y: 50, px: 100, py: 100 } }, W.pal[id]) });
    for (const G of [group, hand]) {
      for (const t of G) t.phashMin = Math.min(...G.filter((u) => u !== t).map((u) => ham(t.hash, u.hash)));
      for (const t of G) { delete t.hash; tiles.push(t); }
    }
  }
  // control: the same renderer with neighbour copies switched off must fail the seam proof
  // controls: the same renderer with the wrap broken on purpose must fail the seam proof
  const W0 = WORLDS[0], k0 = Object.keys(W0.recipes)[0], controls = [];
  for (const [name, o] of [["no wrapped copies", { noWrap: true }], ["wrapped copies shifted half a pixel", { shift: 0.2 }]]) { const c = await seam(W0.recipes[k0], W0.pal[k0], o); controls.push({ tile: `${W0.id}/${k0}`, name, seamPx: c.px, seamMax: c.max }); }
  const calibration = [];
  for (const [name, r] of GOOD) calibration.push({ name, expect: "good", ...(await connected(r)) });
  for (const [name, t] of BAD) calibration.push({ name, expect: "bad", note: t.note, ...(await coverage(t)) });
  return { generated: new Date().toISOString(), tiles, controls, calibration, CONN };
}
