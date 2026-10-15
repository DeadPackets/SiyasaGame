import { render, renderMedallion, colorize, dataURL } from "../patterns/engine.js";

export const $ = (s, r = document) => r.querySelector(s);
export const $$ = (s, r = document) => [...r.querySelectorAll(s)];
export const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
export const ARROW = `<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M3 8h10M9 4l4 4-4 4"/></svg>`;
export const MONTH = (ym) => new Date(`${String(ym).slice(0, 7)}-01T00:00:00Z`).toLocaleDateString("en-GB", { month: "long", year: "numeric", timeZone: "UTC" });
export const and = (a) => (a.length < 2 ? a.join("") : `${a.slice(0, -1).join(", ")} and ${a.at(-1)}`);
export const playURL = (id) => `/play.html?w=${encodeURIComponent(id)}&walk=1`;
export const buildURL = (id) => `/build.html?b=${encodeURIComponent(id)}`;
export const pal = (x) => ({ a: x.a, b: x.b, c: x.c });
export const medal = (x, emb) => renderMedallion({ ...x.recipe, emblem: emb ?? x.emblem });
export const medData = (x, emb) => dataURL(colorize(medal(x, emb).svg, pal(x)));
export const tile = (x, k) => { const t = render(x.recipe); return { url: dataURL(colorize(t.svg, pal(x))), w: t.w * k, h: t.h * k }; };
export const tileVars = (el, x, k) => { const t = tile(x, k); el.style.setProperty("--tile", `url("${t.url}")`); el.style.setProperty("--tsize", `${t.w}px ${t.h}px`); };
// the strongest ideology that has an emblem: the world's face on a seal
export const face = (ideos) => ideos.find((x) => x.emblem?.kind && x.emblem.kind !== "none") || ideos[0];
export const json = async (url, init) => { const r = await fetch(url, init); const b = await r.json().catch(() => null); if (!b && !r.ok) throw new Error(`${url}: ${r.status}`); return b; };
