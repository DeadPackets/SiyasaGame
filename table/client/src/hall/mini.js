// Strudel-style mini-notation subset -> timed events. MIT, no deps.
// Supports: seq "a b", rest "~", [sub], <alt>, "," stack, *n /n @n !n ? (k,n[,r])
// ponytail: float time; fine for 60 s loops, use fractions if long drifts ever matter.
const pat = (query) => ({ query });
const cycles = (b, e, f) => { const out = []; for (let c = Math.floor(b); c < e; c++) out.push(...f(c)); return out.filter((ev) => ev.t >= b - 1e-9 && ev.t < e - 1e-9); };
let budget = 0; // events left; bounds CPU for hostile input
const atom = (v) => pat((b, e) => cycles(b, e, (c) => { if (--budget < 0) throw new Error("pattern too dense"); return [{ t: c, d: 1, v }]; }));
const silence = pat(() => []);
const fast = (n, p) => pat((b, e) => p.query(b * n, e * n).map((ev) => ({ ...ev, t: ev.t / n, d: ev.d / n })));
const stack = (ps) => pat((b, e) => ps.flatMap((p) => p.query(b, e)));
const compress = (s, w, p) => pat((b, e) => cycles(b, e, (c) => p.query(c, c + 1).map((ev) => ({ ...ev, t: c + s + (ev.t - c) * w, d: ev.d * w }))));
const timecat = (items) => { const tot = items.reduce((a, i) => a + i.w, 0); let o = 0; return stack(items.map((i) => compress((o += i.w) / tot - i.w / tot, i.w / tot, i.p))); };
const slowcat = (ps) => pat((b, e) => cycles(b, e, (c) => { const n = ps.length, k = Math.floor(c / n); return ps[((c % n) + n) % n].query(k, k + 1).map((ev) => ({ ...ev, t: ev.t + c - k })); }));
const hash = (x) => { const s = Math.sin(x * 12.9898 + 78.233) * 43758.5453; return s - Math.floor(s); };
const degrade = (p, seed) => pat((b, e) => p.query(b, e).filter((ev) => hash(ev.t + seed) >= 0.5));
const euclid = (k, n, r = 0) => { // Bjorklund, same patterns as Strudel
  let a = Array.from({ length: k }, () => [1]), b = Array.from({ length: n - k }, () => [0]);
  while (b.length > 1 && a.length) { const m = Math.min(a.length, b.length), rest = a.length > m ? a.slice(m) : b.slice(m); a = a.slice(0, m).map((x, i) => [...x, ...b[i]]); b = rest; }
  const bits = [...a, ...b].flat(); return bits.map((_, i) => bits[(((i - r) % n) + n) % n]);
};

export function mini(src) {
  const toks = src.match(/[\[\]<>(),*\/@!?~]|-?[\d.]+(?![\w#])|[\w#.:+-]+|\S/g) || [];
  let i = 0, seed = 0;
  const peek = () => toks[i], next = () => toks[i++];
  const num = (zeroOk) => { const t = next(); const n = Number(t); if (!((n > 0 || (zeroOk && n === 0)) && n <= 64)) throw new Error(`number 0..64 expected, got ${t}`); return n; };
  function seq(close) { // items, split by "," into layers
    const layers = [[]];
    while (i < toks.length && peek() !== close) {
      if (peek() === ",") { next(); layers.push([]); continue; }
      layers.at(-1).push(...item());
    }
    if (close) { if (next() !== close) throw new Error(`missing ${close}`); }
    return layers;
  }
  function item() {
    let p, t = next(), w = 1, rep = 1;
    if (t === "[") p = stack(seq("]").map(timecat));
    else if (t === "<") p = stack(seq(">").map((l) => slowcat(l.map((x) => x.p))));
    else if (t === "~") p = silence;
    else if (/^[\w#.:+-]+$/.test(t)) p = atom(/^-?[\d.]+$/.test(t) ? Number(t) : t);
    else throw new Error(`unexpected ${t}`);
    for (;;) {
      const m = peek();
      if (m === "*") { next(); p = fast(num(), p); }
      else if (m === "/") { next(); p = fast(1 / num(), p); }
      else if (m === "@") { next(); w = num(); }
      else if (m === "!") { next(); rep = /^[\d.]+$/.test(peek() ?? "") ? num() : 2; }
      else if (m === "?") { next(); p = degrade(p, ++seed); }
      else if (m === "(") { next(); const k = num(true); next(); const n = num(); let r = 0; if (peek() === ",") { next(); r = num(true); } next(); const q = p; p = timecat(euclid(k, n, r).map((on) => ({ p: on ? q : silence, w: 1 }))); }
      else break;
    }
    return Array.from({ length: rep }, () => ({ p, w }));
  }
  const layers = seq(null);
  return stack(layers.map(timecat));
}

// Events of cycles [0, n), sorted by onset; t and d in cycles.
export const events = (src, n = 1, max = 4096) => { const p = mini(src); budget = max; return p.query(0, n).sort((a, b) => a.t - b.t); };

// Value of the pattern at cycle c (the event whose span holds c): per-event controls like mask, n, gain.
export const at = (src) => { const p = mini(src), memo = new Map(); return (c) => { const k = Math.floor(c + 1e-9); if (!memo.has(k)) { budget = 4096; memo.set(k, p.query(k, k + 1)); } return memo.get(k).find((e) => e.t <= c + 1e-9 && c < e.t + e.d - 1e-9)?.v; }; };

if (typeof process !== "undefined" && process.argv[1]?.endsWith("mini.js")) {
  const show = (s, n = 1) => events(s, n).map((e) => `${+e.t.toFixed(3)}:${e.v}`).join(" ");
  const eq = (s, want, n = 1) => { const got = show(s, n); if (got !== want) throw new Error(`${s}\n got  ${got}\n want ${want}`); };
  eq("a b", "0:a 0.5:b");
  eq("a ~ b ~", "0:a 0.5:b");
  eq("a [b c]", "0:a 0.5:b 0.75:c");
  eq("<a b c>", "0:a 1:b 2:c 3:a", 4);
  eq("<a <b c>>", "0:a 1:b 2:a 3:c", 4);
  eq("a*2 b", "0:a 0.25:a 0.5:b");
  eq("a/2", "0:a", 2);
  eq("a@3 b", "0:a 0.75:b");
  eq("a!3 b", "0:a 0.25:a 0.5:a 0.75:b");
  eq("[c4,e4,g4] a", "0:c4 0:e4 0:g4 0.5:a");
  eq("a b, c", "0:a 0:c 0.5:b");
  eq("x(3,8)", "0:x 0.375:x 0.75:x");
  eq("x(5,8)", "0:x 0.25:x 0.375:x 0.625:x 0.75:x");
  eq("x(3,8,0) y(0,4)", "0:x 0.188:x 0.375:x");
  eq("<[a b] c>*2", "0:a 0.25:b 0.5:c");
  eq("60.5 eb3 f#4", "0:60.5 0.333:eb3 0.667:f#4");
  eq("bd:3 sd", "0:bd:3 0.5:sd");
  const kept = events("a*16?", 1).length; if (kept < 3 || kept > 13) throw new Error(`degrade kept ${kept}/16`);
  for (const bad of ["[a b", "a*", "<a ]", "a ) b", "a*1e9", "x(3,1000)", "[[[a*32]*32]*32]", "a*0"]) { let threw = false; try { events(bad); } catch { threw = true; } if (!threw) throw new Error(`no error for ${bad}`); }
  console.log("mini.js self-check ok");
}
