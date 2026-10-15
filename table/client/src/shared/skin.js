import { render, renderMedallion, colorize, dataURL } from "../patterns/engine.js";
import { correct } from "../patterns/palette.js";

const FONTS = new Map(); // one stylesheet per family, however many skins use it
export function loadFont(family) {
  if (!FONTS.has(family)) {
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = `https://fonts.googleapis.com/css2?family=${family.replace(/ /g, "+")}:wght@400;600;700&display=swap`;
    FONTS.set(family, new Promise((r) => { link.onload = link.onerror = r; }).then(() => document.fonts.load(`600 1em "${family}"`)).catch(() => {}));
    document.head.append(link);
  }
  return FONTS.get(family);
}

export function setPalette(skin, el = document.documentElement) {
  const P = correct(skin.palette).palette; // contrast-corrected
  for (const k of ["ground", "panel", "panel2", "ink", "ink2", "line", "accent", "up", "down", "accentText"]) if (P[k]) el.style.setProperty(`--${k}`, P[k]);
}

export async function applySkin(skin, el = document.documentElement) {
  setPalette(skin, el);
  el.style.setProperty("--display", `"${skin.fonts.display}", serif`);
  await Promise.race([loadFont(skin.fonts.display), new Promise((r) => setTimeout(r, 2000))]); // never block on slow fonts
  const by = Object.fromEntries(skin.ideologies.map((x) => [x.id, x]));
  const pal = (id) => ({ a: by[id].a, b: by[id].b, c: by[id].c });
  return {
    pal,
    tile: (id) => { const t = render(by[id].recipe); return { url: dataURL(colorize(t.svg, pal(id))), w: t.w, h: t.h }; },
    medallion: (id) => colorize(renderMedallion({ ...by[id].recipe, emblem: by[id].emblem }).svg, pal(id)),
  };
}
