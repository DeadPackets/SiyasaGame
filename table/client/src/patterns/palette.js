// Palette contrast corrector: ink on panel >= 7:1, ink2 on panel >= 4.5:1, accent button text >= 4.5:1 (WCAG ratios).
// Colours move toward white or black (away from their background) in small steps, so hue mostly survives.
const rgb = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
const hex = (c) => "#" + c.map((v) => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, "0")).join("");
const lin = (v) => ((v /= 255) <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
export const lum = (h) => { const [r, g, b] = rgb(h).map(lin); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
export const contrast = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
const mix = (a, b, t) => hex(rgb(a).map((v, i) => v + (rgb(b)[i] - v) * t));

// push fg away from bg until the ratio holds
function raise(fg, bg, target) {
  if (contrast(fg, bg) >= target) return fg;
  const to = lum(bg) < 0.18 ? "#ffffff" : "#000000";
  for (let t = 0.05; t <= 1.001; t += 0.05) { const c = mix(fg, to, t); if (contrast(c, bg) >= target) return c; }
  return to;
}

export function correct(pal) {
  const p = { ...pal }, r = (k) => Math.round(k * 100) / 100, report = {};
  const b1 = contrast(p.ink, p.panel); p.ink = raise(p.ink, p.panel, 7); report.inkPanel = [r(b1), r(contrast(p.ink, p.panel))];
  const b2 = contrast(p.ink2, p.panel); p.ink2 = raise(p.ink2, p.panel, 4.5); report.ink2Panel = [r(b2), r(contrast(p.ink2, p.panel))];
  // button text: the best of ground, ink, black, white; if none reaches 4.5, move the accent away from that text
  const cands = [p.ground, p.ink, "#000000", "#ffffff"], best = (a) => cands.reduce((m, c) => (contrast(c, a) > contrast(m, a) ? c : m));
  let t = best(p.accent); const b3 = contrast(t, p.accent);
  if (b3 < 4.5) { p.accent = raise(p.accent, t, 4.5); t = best(p.accent); }
  p.accentText = t;
  report.accentText = [r(b3), r(contrast(t, p.accent))];
  report.changed = ["ink", "ink2", "accent"].filter((k) => p[k].toLowerCase() !== String(pal[k]).toLowerCase());
  return { palette: p, report };
}
