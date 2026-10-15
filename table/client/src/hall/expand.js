// Score -> timed note events (pure; runs in the browser and in node for the sample build).
import { events, at } from "./mini.js";

const PC = { c: 0, d: 2, e: 4, f: 5, g: 7, a: 9, b: 11 };
export const nameToMidi = (s) => {
  const m = /^([a-g])(#|b)?(-?\d)$/.exec(s);
  if (!m) throw new Error(`bad note ${s}`);
  return 12 * (+m[3] + 1) + PC[m[1]] + (m[2] === "#" ? 1 : m[2] === "b" ? -1 : 0);
};

// Notes are names (d3, eb4) or MIDI numbers (51.5 = a quarter tone). Each event: t, d (bars), midi (or null for hits), sound, vel, deg (scale degree, for ornaments)
export function expand(score) {
  const n = score.bars, out = {};
  for (const ly of score.layers) {
    const scale = score.scales[ly.scale ?? score.maqam], root = score.root + 12 * (ly.oct ?? 0);
    const deg2midi = (d) => root + scale[((d % scale.length) + scale.length) % scale.length] + 12 * Math.floor(d / scale.length);
    let evs;
    if (ly.rhythm) { const ns = events(ly.note, n, 20000); evs = events(ly.rhythm, n, 20000).flatMap((e) => ns.filter((x) => x.t <= e.t + 1e-9 && e.t < x.t + x.d - 1e-9).map((x) => ({ ...e, v: x.v }))); }
    else evs = events(ly.deg ?? ly.note ?? ly.hit, n, 20000);
    if (ly.mask) { const m = at(ly.mask); evs = evs.filter((e) => +m(e.t) === 1); }
    if (ly.segment) evs = evs.flatMap((e) => { const s = 1 / ly.segment, k = Math.max(1, Math.round(e.d / s)); return Array.from({ length: k }, (_, i) => ({ ...e, t: e.t + i * s, d: e.d / k })); });
    const vel = ly.vel ? at(ly.vel) : () => 1;
    out[ly.id] = evs.map((e) => {
      const v = Math.max(0, Math.min(1, +(vel(e.t) ?? 1)));
      if (ly.deg != null) return { t: e.t, d: e.d, vel: v, sound: ly.sound, deg: e.v, midi: deg2midi(e.v), up: deg2midi(e.v + 1) };
      if (ly.note != null) return { t: e.t, d: e.d, vel: v, sound: ly.sound, midi: (typeof e.v === "number" ? e.v : nameToMidi(e.v)) + (ly.add ?? 0) };
      return { t: e.t, d: e.d, vel: v, sound: e.v === "x" ? ly.sound : ly.sound ?? e.v, midi: null };
    });
  }
  return out;
}
