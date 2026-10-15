import { render, renderMedallion, colorize, dataURL } from "../patterns/engine.js";

export const $ = (s, r = document) => r.querySelector(s);
export const $$ = (s, r = document) => [...r.querySelectorAll(s)];
export const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
export const ARROW = `<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M3 8h10M9 4l4 4-4 4"/></svg>`;
export { monthName as MONTH } from "../shared/dates.js";
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
import { monthName } from "../shared/dates.js";
import { applySkin } from "../shared/skin.js";
import { badges, playedOn } from "../shared/badges.js";

// world cards: each in its own skin; the finish engine loads on the first card
let FIN = null;
const fin = () => (FIN ??= import("../patterns/finish.js").then((m) => (m.start() ? m : null), () => null));
export function worldCard(w) {
  const two = (w.card?.ideologies || []).slice(0, 2), li = document.createElement("li"), ideas = two.map((x) => x.name).join(" and "), won = Object.keys(badges(w.id)).length;
  li.innerHTML = `<a class="wcard" href="${playURL(w.id)}" aria-label="Play ${esc(w.title)}. ${esc(monthName(w.date))}. ${esc(ideas)}">
    <span class="band" aria-hidden="true"></span>
    <span class="meds" aria-hidden="true">${two.map((x) => `<span class="med" style='background-image:url("${medData(x)}")'></span>`).join("")}</span>
    <span class="wt t2 disp" title="${esc(w.title)}">${esc(w.title)}</span>
    <span class="wd t1">${esc(monthName(w.date))}</span>
    <span class="wi t1">${esc(ideas)}</span>
    ${won ? `<span class="wb t1">${won} ${won === 1 ? "Vision" : "Visions"} fulfilled</span>` : playedOn(w.id) ? `<span class="wb t1 soft">Played</span>` : ""}
    <span class="play t1">Play${ARROW}</span>
  </a>`;
  const a = li.firstElementChild;
  if (two[0]) tileVars(a, two[0], 0.62);
  if (w.card?.palette) applySkin(w.card, a).catch(() => {});
  li._w = w;
  fin().then((f) => { const c = w.card?.finish; if (f && c) $$(".med", li).forEach((el, j) => f.assign(f.surface(el), medal(two[j]), pal(two[j]), c.type, c.foilSlot)); });
  return li;
}
