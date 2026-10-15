import { type Band, type Mix, type Pack, holder } from "./pack";
import type { State } from "./state";
import { TUNE } from "./tune";

export type Pt = [number, number];
export const clamp = (v: number, lo = 0, hi = 100) => Math.min(hi, Math.max(lo, v));
export const dist = (a: Pt, b: Pt) => Math.hypot(a[0] - b[0], a[1] - b[1]);

const CORNERS = new WeakMap<Pack, Record<string, Pt>>();
export function corners(p: Pack): Record<string, Pt> {
  let c = CORNERS.get(p);
  if (!c) {
    const n = p.world.compass.length;
    c = Object.fromEntries(
      p.world.compass.map((id, i) => {
        const a = -Math.PI / 2 + (2 * Math.PI * i) / n;
        return [id, [Math.cos(a), Math.sin(a)] as Pt];
      }),
    );
    CORNERS.set(p, c);
  }
  return c;
}

export function point(p: Pack, mix: Mix): Pt {
  const C = corners(p);
  return mix.reduce<Pt>(([x, y], [id, w]) => [x + w * C[id][0], y + w * C[id][1]], [0, 0]);
}

export function marker(p: Pack, s: State): Pt {
  const C = corners(p), [sx, sy] = point(p, p.world.marker), k = TUNE.startWeight;
  let x = k * sx, y = k * sy, n = k;
  for (const [id, m] of Object.entries(s.stacks)) {
    x += m * C[id][0];
    y += m * C[id][1];
    n += m;
  }
  return [x / n, y / n];
}

export function zone(p: Pack, s: State): string | null {
  const m = marker(p, s);
  if (Math.hypot(m[0], m[1]) <= TUNE.centreZone) return "centre";
  let best: string | null = null, bd = TUNE.cornerZone;
  for (const [id, c] of Object.entries(corners(p))) {
    const d = dist(m, c);
    if (d <= bd) { best = id; bd = d; }
  }
  return best;
}

export const band = (grip: number): Band => (grip >= TUNE.ironAt ? "iron" : grip <= TUNE.openAt ? "open" : "middle");

export function resting(p: Pack, s: State, id: string): number {
  const h = holder(p, id);
  let r = 100 * (1 - dist(marker(p, s), point(p, h.mix)) / 2);
  if (h.grip != null) r -= (TUNE.patronPenalty.loss * s.rules.sanctions * Math.abs(s.grip - h.grip)) / TUNE.patronPenalty.per;
  return clamp(r);
}

export function standing(p: Pack, s: State): number {
  let a = 0, w = 0;
  for (const f of p.world.factions) {
    a += (f.power ?? 1) * s.support[f.id];
    w += f.power ?? 1;
  }
  return a / w;
}
