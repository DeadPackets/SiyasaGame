// The living pattern: the era's tiles tessellate the room. Each cell belongs to the ideology whose
// noise field, weighted by how many of its cards you hold, is strongest there. Floods sweep over it.
const RM = matchMedia("(prefers-reduced-motion: reduce)").matches;
// the approved board's motion (v28 Egypt skin); the pack skin carries look, not motion
export const MOTION = { cell: 84, restAlpha: 0.15, litAlpha: 0.9, breathSeconds: 9, driftSpeed: 0.018, flip: "turn", floodSpeed: 1300, recedeSpeed: 1900, grout: 2 };

function hash(x, y, s) {
  let h = (x * 374761393 + y * 668265263 + s * 2147483647) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}
function noise(x, y, s) {
  const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi;
  const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
  const a = hash(xi, yi, s), b = hash(xi + 1, yi, s), c = hash(xi, yi + 1, s), d = hash(xi + 1, yi + 1, s);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}

// ids: the compass; sprite(id): a square image URL of that ideology's pattern
export function makeField(canvas, ids, sprite) {
  const ctx = canvas.getContext("2d"), m = MOTION;
  let sprites = {}, W = 0, H = 0, dpr = 1, S = 100, cols = 0, rows = 0, cells = [], ground = "#000";
  let weights = {}, born = 0, frozen = RM, last = performance.now() / 1000, clock = 0;
  const floods = [];

  function resize() {
    dpr = Math.min(devicePixelRatio || 1, 1.5);
    W = innerWidth; H = innerHeight;
    canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
    S = m.cell * Math.max(0.7, Math.min(W / 1920, H / 1080));
    cols = Math.ceil(W / S) + 1; rows = Math.ceil(H / S) + 1;
    const ox = (W - cols * S) / 2, oy = (H - rows * S) / 2;
    cells = [];
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) cells.push({ c, r, x: ox + c * S + S / 2, y: oy + r * S + S / 2, cur: null, prev: null, ts: -9, seed: hash(c, r, 7) });
    assign(true);
    ground = getComputedStyle(document.documentElement).getPropertyValue("--ground").trim() || ground;
    const px = Math.round(S * dpr);
    return Promise.all(ids.map((id) => new Promise((ok) => {
      const img = new Image();
      img.onload = () => { const cv = document.createElement("canvas"); cv.width = cv.height = px; cv.getContext("2d").drawImage(img, 0, 0, px, px); sprites[id] = cv; ok(); };
      img.onerror = ok;
      img.src = sprite(id);
    })));
  }

  function assign(instant) {
    const t = clock * m.driftSpeed;
    for (const cell of cells) {
      let best = null, bv = -1;
      ids.forEach((id, i) => { const v = noise(cell.c * 0.14 + t + i * 17.3, cell.r * 0.14 - t * 0.6 + i * 9.1, i + 1) * weights[id]; if (v > bv) { bv = v; best = id; } });
      if (best !== cell.cur) { cell.prev = instant ? best : cell.cur; cell.cur = best; cell.ts = instant ? -9 : clock + cell.seed * 0.6; }
    }
    // cells on a border between two ideologies sink toward the ground, so territories read as regions, not blocks
    for (const cell of cells) {
      let n = 0;
      for (const [dc, dr] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const o = cells[(cell.r + dr) * cols + cell.c + dc]; if (o && cell.c + dc >= 0 && cell.c + dc < cols && o.cur !== cell.cur) n++; }
      cell.edgeT = 1 - 0.2 * n;
      if (cell.edge === undefined) cell.edge = cell.edgeT;
    }
  }
  function setWeights(held, instant) {
    for (const id of ids) weights[id] = Math.pow((held[id] || 0) + 0.7, 1.6);
    if (cells.length) assign(instant);
  }
  function flood(id, ox, oy, opts = {}) {
    const f = { id, ox, oy, t0: clock, speed: opts.speed || m.floodSpeed, tr: Infinity, tx: 0, ty: 0, maxD: 1, boost: opts.boost || 1 };
    floods.push(f);
    return f;
  }
  function recede(f, tx, ty, opts = {}) {
    f.tr = clock + (opts.delay || 0); f.tx = tx; f.ty = ty; f.speed2 = opts.speed || m.recedeSpeed;
    f.maxD = Math.hypot(Math.max(tx, W - tx), Math.max(ty, H - ty));
  }

  const ss = (x) => { x = Math.min(1, Math.max(0, x)); return x * x * (3 - 2 * x); }; // smoothstep: soft start and soft end
  function frame(now) {
    const s = now / 1000, dt = Math.min(0.05, s - last); last = s;
    clock += frozen ? dt * (floods.length ? 1 : 0) : dt;
    if (!frozen && Math.floor(clock * 2) !== Math.floor((clock - dt) * 2)) assign(false);
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = ground; ctx.fillRect(0, 0, canvas.width, canvas.height);
    const breath = (Math.PI * 2) / m.breathSeconds, cx = W / 2, cy = H / 2, half = S / 2 - m.grout / 2;
    for (let i = floods.length - 1; i >= 0; i--) if (clock > floods[i].tr + floods[i].maxD / floods[i].speed2 + 1) floods.splice(i, 1);
    for (const cell of cells) {
      const d = Math.hypot(cell.x - cx, cell.y - cy), age = clock - born - d / 1400;
      if (age < 0) continue;
      const grow = RM ? Math.min(1, age * 3) : ss(age / 0.9);
      const b = frozen ? 1 : 0.72 + 0.28 * Math.sin(clock * breath - d * 0.006 + cell.seed * 1.3);
      const p = Math.min(1, Math.max(0, (clock - cell.ts) / 1.1)), id = p < 0.5 ? cell.prev : cell.cur;
      cell.edge += (cell.edgeT - cell.edge) * Math.min(1, dt * 1.5);
      const sx = RM ? 1 : Math.abs(Math.cos(Math.PI * p)), a = m.restAlpha * b * grow * cell.edge;
      const sc = (RM ? 1 : grow) * (1 - (frozen ? 0 : 0.02 * (1 - b)));
      let fa = 0, fid = null, fsc = 1;
      for (const f of floods) {
        const din = Math.hypot(cell.x - f.ox, cell.y - f.oy), tin = f.t0 + (RM ? 0 : din / f.speed);
        if (clock < tin) continue;
        const dout = Math.hypot(cell.x - f.tx, cell.y - f.ty), tout = f.tr + (RM ? 0 : (f.maxD - dout) / f.speed2);
        const k = clock - tin, q = clock - tout;
        if (q > 0.5) continue;
        let env = ss(k / (RM ? 0.4 : 0.18));
        if (q > 0) env *= 1 - ss(q / 0.5);
        const front = RM ? 0 : Math.exp(-k * 3.2) * f.boost;
        fa = m.litAlpha * (0.42 + 0.58 * front) * env; fid = f.id;
        fsc = RM ? 1 : (0.35 + 0.65 * ss(k / 0.32) + 0.16 * front) * (q > 0 ? Math.max(0.2, 1 - ss(q / 0.5)) : 1);
      }
      if (sprites[id] && a > 0.004) { ctx.globalAlpha = a; draw(sprites[id], cell, half * sc, sx); }
      if (fid && fa > 0.004 && sprites[fid]) { ctx.globalAlpha = Math.min(1, fa); draw(sprites[fid], cell, half * fsc, 1); }
    }
    ctx.globalAlpha = 1;
    requestAnimationFrame(frame);
  }
  function draw(sp, cell, h, sx) {
    const flipX = m.flip === "turn";
    ctx.setTransform(dpr * (flipX ? sx : 1), 0, 0, dpr * (flipX ? 1 : sx), cell.x * dpr, cell.y * dpr);
    ctx.drawImage(sp, -h, -h, h * 2, h * 2);
  }

  return {
    async init(held) { setWeights(held, true); await resize(); },
    start() { born = clock; requestAnimationFrame(frame); },
    setWeights, flood, recede,
    onResize: () => resize(),
  };
}
