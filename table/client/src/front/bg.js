// The living pattern: the world's tiles tessellate the room. Each cell belongs to the ideology whose
// noise field, weighted by its strength in the world, is strongest there. Floods sweep over it.
// the approved skins carry no motion block
const MOTION = { cell: 84, restAlpha: 0.22, litAlpha: 0.9, breathSeconds: 9, driftSpeed: 0.018, flip: "turn", floodSpeed: 1300, recedeSpeed: 1900 };
const RM = matchMedia("(prefers-reduced-motion: reduce)").matches;

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

export function makeField(canvas) {
  const ctx = canvas.getContext("2d");
  let ids = [], skin, sprites = {}, W = 0, H = 0, dpr = 1, S = 100, cols = 0, rows = 0, cells = [];
  let weights = {}, born = 0, frozen = RM, last = performance.now() / 1000, clock = 0, active = true;
  const floods = [];

  function resize() {
    dpr = Math.min(devicePixelRatio || 1, 1.5);
    W = innerWidth; H = innerHeight;
    canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
    S = skin.motion.cell * Math.max(0.7, Math.min(W / 1920, H / 1080));
    cols = Math.ceil(W / S) + 1; rows = Math.ceil(H / S) + 1;
    const ox = (W - cols * S) / 2, oy = (H - rows * S) / 2;
    cells = [];
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
      const x = ox + c * S + S / 2, y = oy + r * S + S / 2;
      cells.push({ c, r, x, y, cur: null, prev: null, ts: -9, seed: hash(c, r, 7) });
    }
    assign(true);
    return renderSprites();
  }

  async function renderSprites() {
    const px = Math.round(S * dpr);
    await Promise.all(ids.map((id) => new Promise((ok) => {
      const img = new Image();
      img.onload = () => {
        const cv = document.createElement("canvas"), c = cv.getContext("2d"); cv.width = cv.height = px;
        c.drawImage(img, 0, 0, px, px);
        // soft edge: a radial alpha, so no cell (and no block of cells) ever shows a hard square
        const g = c.createRadialGradient(px / 2, px / 2, 0, px / 2, px / 2, px * 0.707);
        g.addColorStop(0, "#000"); g.addColorStop(0.5, "#000"); g.addColorStop(0.72, "rgba(0,0,0,.55)"); g.addColorStop(1, "rgba(0,0,0,0)");
        c.globalCompositeOperation = "destination-in"; c.fillStyle = g; c.fillRect(0, 0, px, px);
        sprites[id] = cv; ok();
      };
      img.onerror = ok;
      img.src = skin.sprite(id);
    })));
  }

  function assign(instant) {
    const t = clock * skin.motion.driftSpeed;
    for (const cell of cells) {
      let best = null, bv = -1;
      for (let i = 0; i < ids.length; i++) {
        const id = ids[i];
        const n = noise(cell.c * 0.14 + t + i * 17.3, cell.r * 0.14 - t * 0.6 + i * 9.1, i + 1);
        const v = (n + 0.32 * (hash(cell.c, cell.r, i + 3) - 0.5)) * weights[id]; // per-cell jitter: ragged, organic borders instead of straight blocks
        if (v > bv) { bv = v; best = id; }
      }
      if (best !== cell.cur) {
        cell.prev = instant ? best : cell.cur; cell.cur = best;
        cell.ts = instant ? -9 : clock + cell.seed * 0.6;
      }
    }
    edges();
  }

  // cells on a border between two ideologies sink toward the ground, so territories read as regions, not blocks
  function edges() {
    for (const cell of cells) {
      let n = 0;
      for (const [dc, dr] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const o = cells[(cell.r + dr) * cols + cell.c + dc];
        if (o && cell.c + dc >= 0 && cell.c + dc < cols && o.cur !== cell.cur) n++;
      }
      cell.edgeT = 1 - 0.2 * n;
      if (cell.edge === undefined) cell.edge = cell.edgeT;
    }
  }
  function setWeights(held, instant) {
    for (const id of ids) weights[id] = Math.pow((held[id] || 0) + 0.7, 1.6);
    if (cells.length) assign(instant);
  }

  // A flood: tiles of `id` turn over in a wave from (ox, oy). recede() sends them home into (tx, ty).
  function flood(id, ox, oy, opts = {}) {
    const f = { id, ox, oy, t0: clock, speed: opts.speed || skin.motion.floodSpeed, tr: Infinity, tx: 0, ty: 0, maxD: 1, boost: opts.boost || 1, alpha: opts.alpha || 1 };
    floods.push(f);
    return f;
  }
  function recede(f, tx, ty, opts = {}) {
    f.tr = clock + (opts.delay || 0); f.tx = tx; f.ty = ty;
    f.speed2 = opts.speed || skin.motion.recedeSpeed;
    f.maxD = Math.hypot(Math.max(tx, W - tx), Math.max(ty, H - ty));
    return (f.maxD / f.speed2) * 1000 + (opts.delay || 0) * 1000;
  }

  const ss = (x) => { x = Math.min(1, Math.max(0, x)); return x * x * (3 - 2 * x); }; // smoothstep: soft start and soft end
  function frame(now) {
    if (!active) return;
    const s = now / 1000, dt = Math.min(0.05, s - last); last = s;
    if (!frozen) clock += dt; else clock += dt * (floods.length ? 1 : 0);
    if (!frozen && Math.floor(clock * 2) !== Math.floor((clock - dt) * 2)) assign(false);
    const g = skin.ground;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = g; ctx.fillRect(0, 0, canvas.width, canvas.height);
    const m = skin.motion, rest = m.restAlpha, lit = m.litAlpha, gr = 2;
    const breath = (Math.PI * 2) / m.breathSeconds, cx = W / 2, cy = H / 2;
    const half = S / 2 - gr / 2;
    for (let i = floods.length - 1; i >= 0; i--) {
      const f = floods[i];
      if (clock > f.tr + f.maxD / f.speed2 + 1) floods.splice(i, 1);
    }
    for (const cell of cells) {
      const d = Math.hypot(cell.x - cx, cell.y - cy);
      const age = RM ? 9 : clock - born - d / 1400; // reduced motion: the clock stands still, so the field is whole at once
      if (age < 0) continue;
      const grow = RM ? Math.min(1, age * 3) : ss(age / 0.9);
      const b = frozen ? 0.86 : 0.72 + 0.28 * Math.sin(clock * breath - d * 0.006 + cell.seed * 1.3);
      // flip between the previous and current owner
      let p = Math.min(1, Math.max(0, (clock - cell.ts) / 1.1)), id = p < 0.5 ? cell.prev : cell.cur;
      cell.edge += (cell.edgeT - cell.edge) * Math.min(1, dt * 1.5); // exponential approach: no hard start once moving
      let sx = RM ? 1 : Math.abs(Math.cos(Math.PI * p)), a = rest * b * grow * cell.edge;
      let sc = (RM ? 1 : grow) * (1 - (frozen ? 0 : 0.02 * (1 - b)));
      // floods override
      let fa = 0, fid = null, fsx = 1, fsc = 1;
      for (const f of floods) {
        const din = Math.hypot(cell.x - f.ox, cell.y - f.oy), tin = f.t0 + (RM ? 0 : din / f.speed);
        if (clock < tin) continue;
        const dout = Math.hypot(cell.x - f.tx, cell.y - f.ty), tout = f.tr + (RM ? 0 : (f.maxD - dout) / f.speed2);
        const k = clock - tin, q = clock - tout;
        if (q > 0.5) continue;
        let env = ss(k / (RM ? 0.4 : 0.18));
        if (q > 0) env *= 1 - ss(q / 0.5);
        const front = RM ? 0 : Math.exp(-k * 3.2) * f.boost;
        fa = lit * (0.42 + 0.58 * front) * env * f.alpha; fid = f.id;
        // tiles bloom in place: a uniform scale pop at the front, shrink away on recede
        const e = ss(k / 0.32);
        fsx = 1;
        fsc = RM ? 1 : (0.35 + 0.65 * e + 0.16 * front) * (q > 0 ? Math.max(0.2, 1 - ss(q / 0.5)) : 1);
      }
      const sp = sprites[id];
      if (sp && a > 0.004) {
        ctx.globalAlpha = a;
        drawCell(sp, cell, half * sc, sx);
      }
      if (fid && fa > 0.004 && sprites[fid]) {
        ctx.globalAlpha = Math.min(1, fa);
        drawCell(sprites[fid], cell, half * fsc, fsx);
      }
    }
    ctx.globalAlpha = 1;
    requestAnimationFrame(frame);
  }
  function drawCell(sp, cell, h, sx) {
    const flipX = skin.motion.flip === "turn";
    ctx.setTransform(dpr * (flipX ? sx : 1), 0, 0, dpr * (flipX ? 1 : sx), cell.x * dpr, cell.y * dpr);
    ctx.drawImage(sp, -h, -h, h * 2, h * 2);
  }

  return {
    // s: { ids, sprite(id) -> url of a square tile, ground }; held: { id: strength }
    async setSkin(s, held) {
      skin = { motion: MOTION, ...s }; ids = s.ids; setWeights(held, true);
      await resize();
    },
    start() { born = clock; requestAnimationFrame(frame); },
    rebirth() { born = clock; },
    setActive(on) { if (on && !active) { active = true; last = performance.now() / 1000; requestAnimationFrame(frame); } active = on; },
    setWeights, flood, recede,
    onResize: () => resize(),
  };
}
