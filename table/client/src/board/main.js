// The board: the approved v28 view, motion and sound, driven by the rules engine and one world pack.
import "../shared/tokens.css";
import "./style.css";
import { gsap, SplitText } from "../shared/motion.js";
import { applySkin, loadFont } from "../shared/skin.js";
import { correct } from "../patterns/palette.js";
import { render, renderMedallion, colorize, dataURL, motif } from "../patterns/engine.js";
import emblem from "../patterns/emblem.js";
import * as FIN from "../patterns/finish.js";
import { init as hallInit, sfx, toggleMute, setVolume, leversFrom } from "../hall/hallsfx.js";
import * as E from "../../../engine/index.ts";
import { holdsCond, plan } from "../../../engine/rules.ts";
import { makeTips } from "./tip.js";
import { makeField, MOTION } from "./field.js";
import { initSeat, compassSVG, gripSVG, sealSVG, moveMarker, moveGrip, refreshVision, restOf, inZone, nearest, needFor, band, monthsLeft, pillarsMet, standing, standBand, refreshStanding, coalitionHTML, vision } from "./seat.js";
import * as jev from "./jev.js";
import { startTutor, spotlight, dimBoard } from "./tutor.js";
import { earn, presetOf, markPlayed } from "../shared/badges.js";

// leaving elements ease out, never just vanish
const fadeOut = (el, d = 0.16) => { if (!el || el.classList.contains("out")) return; el.classList.add("out"); el.style.pointerEvents = "none"; gsap.to(el, { opacity: 0, duration: d, ease: "soft", overwrite: true, onComplete: () => el.remove() }); };
// a word or number swaps with a short slide: the old text rises out, the new one rises in
function slot(el, text) {
  text = String(text);
  if (!el || (el._want ?? el.textContent) === text) return;
  el._want = text;
  if (RM) { el.textContent = text; el._want = undefined; return; }
  gsap.timeline({ onComplete: () => (el._want = undefined) }).to(el, { opacity: 0, y: -5, duration: 0.14, ease: "swift", overwrite: true }).add(() => (el.textContent = el._want ?? text))
    .fromTo(el, { opacity: 0, y: 5 }, { opacity: 1, y: 0, duration: 0.26, ease: "settle", clearProps: "transform,opacity" });
}
// a replaced view leaves softly: its old content fades where it stood while the new content comes in before it
function leave(c) {
  const old = [...c.childNodes].filter((n) => !n.classList?.contains("leaving") && !n.matches?.("h2.sr"));
  if (!old.length) return;
  const w = document.createElement("div"); w.className = "leaving"; w.inert = true; w.setAttribute("aria-hidden", "true");
  w.append(...old); c.append(w); fadeOut(w, 0.2);
}

const RM = matchMedia("(prefers-reduced-motion: reduce)").matches;
const D = (s) => (RM ? 0.01 : s);
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const root = document.documentElement;
const Q = new URLSearchParams(location.search), WID = Q.get("w") || "egypt-2011";
let WALK = Q.get("walk") === "1";
const SAVE = `siyasa-save:${WID}`, TUTOR_DONE = "siyasa-tutor-done", TOUR_KEY = "usoj-tour-v1";
const store = {
  get: (k) => { try { return localStorage.getItem(k); } catch { return null; } },
  set: (k, v) => { try { localStorage.setItem(k, v); } catch {} },
  del: (k) => { try { localStorage.removeItem(k); } catch {} },
};
const T = E.TUNE, RK = E.ROLES;
const r = Math.round;
const num = (v) => (Number.isInteger(v) ? `${v}` : v.toFixed(1));
const signed = (d) => `${d > 0 ? "+" : d < 0 ? "−" : ""}${num(Math.abs(d))}`;
const live = (t) => { $("#live").textContent = t; };
const emit = (name) => document.dispatchEvent(new CustomEvent("moment", { detail: { name } })); // the tutorial follows the month by these
addEventListener("keydown", () => (document.body.dataset.kbd = "1"), true);
addEventListener("pointerdown", () => delete document.body.dataset.kbd, true);

// the world: everything a sentence or a number names comes from here or from the engine
let P, W, SK, IDS, IDEO, PEOPLE, RES, G, st, field, tips, skinApi, glOn = false;
const SRC = {}; // hand card id -> its ideology
const person = (id) => E.holder(P, id);
const isPat = (h) => W.patrons.includes(h);
const byMix = (h) => [...h.mix].sort((a, b) => b[1] - a[1]);
const lean = (h) => byMix(h)[0][0];
const second = (h) => byMix(h)[1]?.[0] ?? lean(h);
const skI = (id) => SK.ideologies.find((x) => x.id === id);
const pal = (id) => { const x = skI(id); return { a: x.a, b: x.b, c: x.c }; };
const vars = (id) => `--t:var(--tile-${id});--tm:var(--tm-${id});--ia:var(--${id}-a);--ia-ink:var(--${id}-c)`;
const FALLS = () => G.rules.actUnder;
// pack dates are "YYYY-MM[-DD]" and a year may be negative (BC), which JS Date cannot hold, so months are counted by hand
const ymd = (x) => { const m = /^(-?)(\d+)-(\d+)(?:-(\d+))?/.exec(x); return { y: (m[1] ? -1 : 1) * +m[2], mo: +m[3], d: m[4] ? +m[4] : null }; };
const MONTHS = (style) => Array.from({ length: 12 }, (_, i) => new Date(Date.UTC(2000, i, 1)).toLocaleDateString("en-GB", { month: style, timeZone: "UTC" }));
const LONG = MONTHS("long"), SHORT = MONTHS("short");
const yearOf = (y) => (y < 0 ? `${-y} BC` : `${y}`);
const date = (m) => { const a = ymd(W.date), t = a.y * 12 + a.mo - 1 + m - 1; return { y: Math.floor(t / 12), mo: (((t % 12) + 12) % 12) + 1 }; };
const ym = (m) => { const d = date(m); return `${d.y < 0 ? "-" : ""}${String(Math.abs(d.y)).padStart(4, "0")}-${String(d.mo).padStart(2, "0")}`; };
const monthLabel = (m, long = true) => { const d = date(m); return long ? `${LONG[d.mo - 1]} ${yearOf(d.y)}` : LONG[d.mo - 1]; };
const reckDate = () => { const d = ymd(W.reckoning.date); return `${LONG[d.mo - 1]} ${yearOf(d.y)}`; };
const dayLabel = (x) => { const d = ymd(x); return `${d.d ? `${d.d} ` : ""}${SHORT[d.mo - 1]} ${yearOf(d.y)}`; };
const histText = (c) => (c.history ?? "").replace(/^In history:\s*/i, "");
const visionOf = () => P.deck.visions.find((v) => v.id === G.vision) ?? null;
const lawOf = (id) => P.deck.ideologies[id].law;
const pickedOn = (id) => G.picked.map((x) => E.handDef(P, x)).find((d) => P.deck.ideologies[id].picks.some((m) => m.id === d.id));
const playsLeft = () => (["hand", "target", "playing"].includes(st.phase) ? G.plays : 0);

/* ---------- save ---------- */
let TERM = null; // this term's log id and preset, kept with the save
const save = () => (G.over ? store.del(SAVE) : store.set(SAVE, JSON.stringify({ w: WID, s: G, term: TERM })));
function loadSave() {
  try { const x = JSON.parse(store.get(SAVE)); if (x?.w !== WID || !x.s || x.s.over) return null; TERM = x.term ?? { id: crypto.randomUUID(), preset: presetOf(x.s.rules) }; return x.s; } catch { return null; }
}
// every term is logged for analysis: after each month end, at the end, and on leaving if it changed since; failures are ignored
let sent = "";
function logGame() {
  if (!G || !TERM) return;
  const body = JSON.stringify({ id: TERM.id, world: WID, preset: TERM.preset, state: G }); if (body === sent) return; sent = body;
  try { fetch("/api/games", { method: "POST", headers: { "content-type": "application/json" }, body, keepalive: body.length < 60000 }).catch(() => {}); } catch {} // keepalive bodies cap at 64 KB
}
addEventListener("pagehide", logGame);
function defaultVision() { // the Vision of the corner the world starts nearest
  const m = E.point(P, W.marker), C = E.corners(P), id = IDS.reduce((a, b) => (Math.hypot(m[0] - C[b][0], m[1] - C[b][1]) < Math.hypot(m[0] - C[a][0], m[1] - C[a][1]) ? b : a));
  return P.deck.visions.find((v) => v.corner === id)?.id ?? null;
}
function freshState(o = {}) {
  const preset = E.PRESETS[Q.get("preset")] ? Q.get("preset") : "standard", vq = Q.get("vision");
  const vis = "vision" in o ? o.vision : vq === "free" ? null : P.deck.visions.some((v) => v.id === vq) ? vq : defaultVision();
  const seed = o.seed ?? (Q.has("seed") ? +Q.get("seed") : Math.floor(Math.random() * 2 ** 31));
  TERM = { id: crypto.randomUUID(), preset: presetOf(o.rules ?? preset) };
  return E.newGame(P, { seed, rules: o.rules ?? preset, vision: vis });
}

/* ---------- Jev ---------- */
const ctx = () => ({ world: W.title, date: ym(G.month), month: G.month, grip: r(G.grip), holders: PEOPLE.map((h) => ({ id: h.id, short: h.short, persona: h.persona, support: r(G.support[h.id]) })),
  recent: G.log.slice(-3).map((l) => { const c = E.card(P, l.card); return `${c.title}: ${c.answers[l.answer].text}`; }) });

/* ---------- helpers ---------- */
function sp(el) { const s = $("#stage").getBoundingClientRect(), b = el.getBoundingClientRect(); return { x: b.left - s.left, y: b.top - s.top, w: b.width, h: b.height }; }
function wc(el) { const b = el.getBoundingClientRect(); return [b.left + b.width / 2, b.top + b.height / 2]; }
// three mood states; the ring colour and shape carry them, the word lives in the tooltip
const mood = (v) => (v >= T.bar ? "Loyal" : v >= G.rules.intentUnder ? "Uneasy" : "Restless");
const moodKey = (v) => ({ Loyal: "calm", Uneasy: "uneasy", Restless: "restless" })[mood(v)];
// Four resource roles: the role and its colour are rules; the name and icon come from the world.
const ICON = {
  coin: '<circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="4.8"/>',
  shield: '<path d="M12 3.2 19 6v5.2c0 4.4-2.9 7.8-7 9.6-4.1-1.8-7-5.2-7-9.6V6z"/>',
  screen: '<rect x="3.5" y="5" width="17" height="11.5" rx="1.5"/><path d="M9 20h6M12 16.5V20"/>',
  hand: '<path d="M8 12.5V6a1.5 1.5 0 0 1 3 0v5M11 10.5V4.8a1.5 1.5 0 0 1 3 0v5.7M14 10.5V6.5a1.5 1.5 0 0 1 3 0V14c0 3.7-2.4 6.5-6 6.5-2.4 0-4-1.2-5.3-3.2L3.6 13.6a1.5 1.5 0 0 1 2.5-1.6L8 14.5"/>',
  mast: '<circle cx="12" cy="8.2" r="1.7"/><path d="M12 10.4V21M8.6 21 12 10.4 15.4 21M8.4 4.6a5 5 0 0 0 0 7.2M15.6 4.6a5 5 0 0 1 0 7.2"/>',
  crowd: '<circle cx="9" cy="8" r="3"/><circle cx="16.6" cy="9.4" r="2.4"/><path d="M3.6 20c0-3.5 2.4-5.9 5.4-5.9s5.4 2.4 5.4 5.9M14.6 14.5a4 4 0 0 1 2-.5c2.3 0 3.9 1.9 3.9 5"/>',
};
const ROLE_ICON = { money: "coin", force: "shield", voice: "mast", trust: "crowd" };
const ico = (k) => `<svg class="ri" viewBox="0 0 24 24" aria-hidden="true">${ICON[RES[k].icon] ?? ICON[ROLE_ICON[k]]}</svg>`;
const amt = (k, v, sign) => (sign ? signed(v) : v < 0 ? `−${num(-v)}` : num(v));
const rchip = (k, v, { sign = false, name = false, short = false } = {}) =>
  `<span class="rch ${short ? "short" : ""}" data-role="${k}">${ico(k)}<b class="num">${amt(k, v, sign)}</b>${name ? `<span class="rnm">${RES[k].name}</span>` : ""}</span>`;
// Money can go into debt, so only Force, Voice and Trust can block a card
const lacks = (cost) => RK.filter((k) => k !== "money" && (cost[k] || 0) > G.res[k]);
const afford = (cost) => plan(G, cost) !== null;
const costChips = (cost) => { const miss = afford(cost) ? [] : lacks(cost); return RK.filter((k) => cost[k]).map((k) => rchip(k, cost[k], { short: miss.includes(k) })).join(""); };
const needText = (cost) => { const miss = lacks(cost); return miss.length ? `Needs ${miss.map((k) => `${cost[k]} ${RES[k].name}, you have ${G.res[k]}`).join("; ")}` : ""; };
// distance on the compass, said as answers to file; one answer is filed a month
const closer = (id) => { const n = needFor(id), nm = IDEO[id].name; return n === 0 ? `You stand inside the ${nm} zone.` : n == null || n > monthsLeft() + 1 ? `Out of reach this term: the ${nm} zone is too far for the months left.` : `File ${n} more ${nm} answer${n > 1 ? "s" : ""} to stand inside its zone.`; };
const costWords = (cost) => RK.filter((k) => cost[k]).map((k) => `${cost[k]} ${RES[k].name}`).join(" + ") || "nothing";
// next month's income of one kind, by source (the engine's month-end rule)
function income(k) {
  const out = [], b = E.band(G.grip);
  if (k === "money") out.push({ from: "Monthly balance", n: W.balance });
  for (const h of PEOPLE) if (h.produces === k && G.support[h.id] >= T.produceAt) out.push({ from: `${h.short} (${r(G.support[h.id])})`, n: 1 });
  if (k === "force" && b === "iron") out.push({ from: "Iron grip", n: 1 });
  if (k === "voice" && b === "open") out.push({ from: "Open grip", n: 1 });
  if (G.elected && T.electionBonus[k]) out.push({ from: "Elections you won", n: G.elected * T.electionBonus[k] });
  const n = G.mods.filter((m) => m.op === "income" && m.kind === k && (!m.when || m.when.if === "monthEnd" || holdsCond(P, G, m.when))).reduce((a, m) => a + m.n, 0);
  if (n) out.push({ from: "Your rules", n });
  return out;
}
const net = (k) => income(k).reduce((a, x) => a + x.n, 0);
const isLow = (k) => (k === "money" ? st.res[k] < 0 : st.res[k] <= 0);
function setRes(k, to, dur = 0.7) {
  const from = st.res[k], el = $(`#res .rc[data-role="${k}"]`);
  st.res[k] = to;
  if (!el || to === from) return;
  floatDelta(el, k, Math.round((to - from) * 10) / 10);
  tick($(".rv", el), from, to, dur, (v) => amt(k, k === "money" ? Math.round(v * 10) / 10 : r(v)));
  el.classList.toggle("debt", k === "money" && to < 0);
  el.classList.remove("glow", "gain", "loss", "lowpulse"); void el.offsetWidth; el.classList.add("glow", to >= from ? "gain" : "loss");
  const low = isLow(k);
  if (low && !el.classList.contains("low")) el.classList.add("lowpulse");
  el.classList.toggle("low", low);
}
// the change itself rises off the chip, so a gain or loss reads before the number finishes rolling
function floatDelta(el, k, d) {
  const t = document.createElement("span");
  t.className = `rdelta t1 num ${d > 0 ? "up" : "down"}`; t.setAttribute("aria-hidden", "true");
  t.textContent = amt(k, d, true);
  const rn = $(".rn", el); $(".rcol", el).append(t); $$(".rdelta", el).slice(0, -1).forEach((o) => fadeOut(o, 0.12));
  gsap.timeline({ onComplete: () => t.remove() })
    .to(rn, { opacity: 0, duration: D(0.2), ease: "soft" }, 0)
    .fromTo(t, { opacity: 0, y: RM ? 0 : 7 }, { opacity: 1, y: 0, duration: D(0.35), ease: "settle" }, 0.05)
    .to(t, { opacity: 0, y: RM ? 0 : -6, duration: D(0.35), ease: "soft" }, RM ? ">" : "+=1")
    .to(rn, { opacity: 1, duration: D(0.3), ease: "soft", clearProps: "opacity" }, "<0.1");
}
function tick(el, from, to, dur = 0.7, fmt = (v) => r(v)) {
  const o = { v: from };
  return gsap.to(o, { v: to, duration: D(dur), ease: "settle", onUpdate: () => (el.textContent = fmt(o.v)) });
}
// Rolling digits: the number counts through every value on one eased curve.
function roll(el, from, to) {
  if (RM || from === to) { el.textContent = to; return; }
  const o = { v: from };
  gsap.to(o, { v: to, duration: Math.min(0.9, 0.3 + Math.abs(to - from) * 0.04), ease: "settle", onUpdate: () => (el.textContent = r(o.v)) });
}
function bloom(els, sound = true) {
  for (const e of els.filter(Boolean)) { e.classList.remove("bloom"); void e.offsetWidth; e.classList.add("bloom"); setTimeout(() => e.classList.remove("bloom"), 1700); }
  if (sound) sfx.shimmer();
}
function kick(px = 4) {
  if (RM) return;
  gsap.fromTo("#stage", { x: (Math.random() < 0.5 ? -1 : 1) * px, y: (Math.random() - 0.5) * px }, { x: 0, y: 0, duration: 0.12, ease: "settle", clearProps: "transform" });
}
// One moment, one focus: the body says which moment it is; CSS steps the other areas back.
function moment(m) { document.body.dataset.moment = m; hideTour(true); slot($("#plays"), handHint()); layoutHand(); }
function handHint() {
  if (["hand", "target", "playing"].includes(st.phase)) { const left = G.plays; return left ? `${left} play${left > 1 ? "s" : ""} left` : "No plays left: end the month"; }
  if (st.phase === "rest") return "Draw this month's card first";
  if (st.phase === "month-done" || st.phase === "month") return "Your plays return next month";
  if (st.phase === "over") return "The term is over";
  if (st.phase === "idle") return "";
  if (st.phase === "pick") return "Choose your rule first";
  return "Answer this month's card first";
}
// Only the next step's primary action pulses, one at a time.
function pulse(el) { $$(".pulse").forEach((p) => p.classList.remove("pulse")); if (el) el.classList.add("pulse"); }
// Roving focus: a group ([data-rove] holds its item selector) is one Tab stop; arrows move inside it.
function rove(box) { if (!box) return; $$(box.dataset.rove, box).forEach((el, k) => (el.tabIndex = k ? -1 : 0)); }

/* ---------- coached marks: one short mark per moment, once per player (off while the tutorial runs) ---------- */
const TOUR = () => ({
  draw: ["#draw", "One card comes each month. Draw it to see this month's question."],
  card: [".card .answers", "Choose an answer, then press Decide. You learn its ideology after you decide."],
  revealed: [".reveal .go", "Each holder reacts, with its reason. File the card to add it to your record."],
  factions: ["#factions", `Keep every faction out of the hatched zone under ${FALLS()}. A faction left there acts against you at month end, then plots your fall.`],
  record: ["#tableau", `This is your record. The first time an ideology reaches ${T.stack.pick}, you pick a lasting rule. ${T.stack.power} cards give a power card, ${T.stack.major} a law.`],
  hand: ["#hand", `Play up to ${T.plays} cards a month. Each card costs the resources on it.`],
  end: ["#end", "End the month when you are ready. Your income arrives and support drifts."],
  standing: [".sealb", `The number on the seal is your standing. It must be ${T.bar} or more at the Reckoning, or your order is swept away.`],
});
let tourOn = false;
const tourSeen = new Set();
let markQ = [], markNow = null;
const tourOpen = () => !!markNow;
function coachMark(...keys) { if (!tourOn) return; markQ = keys.filter((k) => !tourSeen.has(k)); showTour(); }
function tourCheck() { if (Object.keys(TOUR()).every((k) => tourSeen.has(k))) endTour(); }
function endTour() { tourOn = false; markQ = []; hideTour(true); store.set(TOUR_KEY, "done"); }
function hideTour(seen) {
  if (!markNow) return;
  const { el, a, k } = markNow; markNow = null;
  fadeOut(el, 0.18); a.classList.remove("coached");
  if (st.phase === "hand") restPop();
  if (seen) { tourSeen.add(k); markQ = []; tourCheck(); }
}
function primaryEl() {
  return { rest: $("#draw"), card: $(".card .ans.sel") || $(".card .ans:not(:disabled)"), revealed: $(".reveal .go"), hand: $("#hand button.hc:not([aria-disabled])") || $("#end"), "month-done": $("#again"), pick: $(".popt") }[st.phase];
}
const refocus = () => primaryEl()?.focus({ preventScroll: true });
function showTour() {
  hideTour(false);
  const k = markQ.shift(); if (!k) return;
  const [sel, text] = TOUR()[k], a = $(sel); if (!a) return showTour();
  const el = document.createElement("div");
  el.id = "tourmark"; el.setAttribute("role", "note"); el.setAttribute("aria-label", "Tour");
  const [w0, ...wr] = text.split(" ");
  el.innerHTML = `<svg class="tseal" viewBox="-1.2 -1.2 2.4 2.4" aria-hidden="true"><circle r="1.1"/><polygon points="0,-.62 .59,-.19 .36,.5 -.36,.5 -.59,-.19"/></svg><p class="t1"><b class="tw disp">${w0}</b> ${wr.join(" ")}</p><div class="tact"><button class="sbtn tnext t1">${markQ.length ? "Next" : "Got it"}</button><button class="tskip t1">Skip tour</button></div>`;
  document.body.append(el); a.classList.add("coached"); markNow = { el, a, k };
  placeTour(); live(text);
  $(".tnext", el).onclick = () => { tourSeen.add(k); tourCheck(); if (tourOn) showTour(); else hideTour(false); refocus(); };
  $(".tskip", el).onclick = () => { endTour(); refocus(); };
  if (!RM) gsap.from(el, { opacity: 0, y: 6, duration: 0.3, ease: "settle", clearProps: "opacity,transform" });
}
function placeTour() {
  if (!markNow) return;
  const { el, a, k } = markNow, b = a.getBoundingClientRect(), w = el.offsetWidth, h = el.offsetHeight, GP = 16, VW = innerWidth, VH = innerHeight;
  const cx = b.left + b.width / 2 - w / 2, cy = b.top + b.height / 2 - h / 2;
  const at = { left: [b.left - GP - w, cy], right: [b.right + GP, cy], above: [cx, b.top - GP - h], below: [cx, b.bottom + GP] };
  const order = k === "record" ? ["above", "right", "left", "below"] : k === "revealed" || k === "draw" ? ["right", "below", "left", "above"] : b.left > VW / 2 ? ["left", "above", "below", "right"] : ["right", "below", "above", "left"];
  const clamp = ([x, y]) => [Math.max(8, Math.min(VW - 8 - w, x)), Math.max(8, Math.min(VH - 8 - h, y))];
  const clear = ([x, y]) => x + w <= b.left || x >= b.right || y + h <= b.top || y >= b.bottom;
  const side = order.find((s) => clear(clamp(at[s]))) || order[0], [x, y] = clamp(at[side]);
  Object.assign(el.style, { left: `${x}px`, top: `${y}px` }); el.dataset.side = side; el.dataset.k = k;
  el.style.setProperty("--ax", `${Math.max(14, Math.min(w - 14, b.left + b.width / 2 - x))}px`);
  el.style.setProperty("--ay", `${Math.max(14, Math.min(h - 14, b.top + b.height / 2 - y))}px`);
}
addEventListener("resize", placeTour);

/* ---------- tooltips ---------- */
const kw = (key, label) => `<span class="kw" data-tip="kw:${key}" tabindex="0">${label ?? key}</span>`;
const ikw = (id) => kw(`ideo:${id}`, IDEO[id].name);
const mkw = (v) => kw(`mood:${mood(v)}`, mood(v));
const tipHead = (t) => `<b class="tt t2 disp">${t}</b>`;
const firstSentence = (s) => s.split(/(?<=\.)\s+(?=[A-Z])/)[0];
const KW = {
  passive: () => `${tipHead("Pick")}<p>The first time an ideology reaches ${T.stack.pick} cards, choose 1 of 3 lasting rules, or skip it.</p>`,
  power: () => `${tipHead("Power card")}<p>Hold ${T.stack.power} cards of one ideology to unlock a card for your hand. Playing it costs resources.</p>`,
  major: () => `${tipHead("Major law")}<p>Hold ${T.stack.major} cards of one ideology to unlock its law. You can enact it only while you stand inside that ideology's zone on the compass. A law is permanent.</p>`,
  grip: () => `${tipHead(`Grip · ${r(st.grip)} · ${band(st.grip)}`)}<p>How you hold power, from 0 (open) to 100 (iron). Answers that open up or crack down move it.</p><p><b>Iron (${T.ironAt}+):</b> +1 ${RES.force.name} a month; factions under ${T.ironSqueeze.under} lose ${T.ironSqueeze.loss} more a month.</p><p><b>Open (${T.openAt} or less):</b> +1 ${RES.voice.name} a month; elections can come, and you can lose them.</p>`,
  compass: () => `${standTip()}${tipHead("Your seat")}<p>Where you stand among the era's ideologies. Each card you file pulls it toward that card's ideology. Holders near your seat warm to you; far ones cool.</p><p class="soft">You stand closest to ${IDEO[nearest()].name}. ${closer(nearest())} Click to open.</p>`,
  vision: () => { const v = vision(); if (!v) return `${tipHead("Free hand")}<p>You chose no Vision. Only your standing counts at the ${kw("reckoning", "Reckoning")}.</p>`;
    const met = pillarsMet(); return `${tipHead(`Vision · ${v.name}`)}<p>${v.line}</p><ul class="pl">${v.pillars.map((p, k) => `<li class="${met[k] ? "on" : ""}">${p.text}</li>`).join("")}</ul><p class="soft">Checked at the ${kw("reckoning", "Reckoning")}.</p>`; },
  next: () => { const q = G.queue[0]; return `${tipHead("Next month")}<p>${q ? `${E.card(P, q).title}. ` : ""}The card stays face down until you draw it.</p>`; },
  reckoning: () => { const n = W.months, m = Math.min(st.month, n), left = Math.max(0, n - m), sd = standing();
    return `${tipHead(`The Reckoning · ${reckDate()}`)}<p>${W.reckoning.meaning}</p>
      <div class="tterm" aria-hidden="true"><i style="width:${((m - 1) / (n - 1)) * 100}%"></i></div>
      <p><b>${left} ${left === 1 ? "month" : "months"} left</b> <span class="soft">· month ${m} of ${n}</span></p>
      <p>Standing <b class="${sd >= T.bar ? "upc" : "downc"}">${sd}</b> <span class="soft">· your order endures at ${T.bar} or more</span></p>`; },
  "mood:Loyal": () => `${tipHead("Loyal")}<p>Support ${T.bar} or more. Solid ring.</p>`,
  "mood:Uneasy": () => `${tipHead("Uneasy")}<p>Support ${G.rules.intentUnder} to ${T.bar - 1}. Pale ring.</p>`,
  "mood:Restless": () => `${tipHead("Restless")}<p>Support under ${G.rules.intentUnder}. Dashed ring, and its demand comes as a card. Under ${FALLS()} the holder acts and can bring you down.</p>`,
};
function resolveTip(key) {
  const [kind, id, extra] = key.split(":");
  if (kind === "kw") {
    if (id === "ideo") { const n = st.held[extra], lean_ = W.factions.filter((h) => lean(h) === extra).map((h) => h.short);
      return `${tipHead(IDEO[extra].name)}<p>You hold ${n}. ${kw("passive", "Pick")} at ${T.stack.pick}, ${kw("power", "power card")} at ${T.stack.power}, ${kw("major", "law")} at ${T.stack.major}.</p>${lean_.length ? `<p class="soft">Leaning: ${lean_.join(", ")}.</p>` : ""}`; }
    if (id === "res") return resTip(extra);
    const f = KW[extra ? `${id}:${extra}` : id]; return f ? f() : "";
  }
  if (kind === "fac") {
    const h = person(id), v = r(st.sup[id]), l = st.last[id], intent = P.deck.intents[id];
    return `${tipHead(`${h.short} · ${v}`)}<p>${mkw(v)}${isPat(h) ? ", a foreign backer" : `, leans to ${ikw(lean(h))}`}. Acts under ${FALLS()}.${v < G.rules.intentUnder && intent ? ` Its demand: ${intent.title}.` : ""}</p>
      <p>${firstSentence(h.persona)}</p><p>Drifting toward ${restOf(id)}: each month end, support moves part of the way there.</p>${isPat(h) ? "" : `<p class="soft">On the row: the bar is support, the ticks mark ${G.rules.intentUnder} and ${T.bar}, the diamond is where it drifts. Weight in your standing: ${h.power ?? 1}.</p>`}<p class="soft">${l ? `Last: ${signed(l.d)}. ${l.why}` : "No change yet this term."}</p>`;
  }
  if (kind === "prod") { const h = person(id), k = h.produces, v = r(st.sup[id]);
    return `${tipHead(`Gives ${RES[k].name}`)}<p>${h.short} gives you 1 ${RES[k].name} each month while its support is ${T.produceAt} or more.</p><p class="soft">Now ${v}: ${v >= T.produceAt ? "it gives this month." : `it needs ${T.produceAt - v} more.`}</p>`; }
  if (kind === "rule") { const d = pickedOn(id); return d ? `${tipHead(d.title)}<p>${E.rulesLine(P, d)}</p><p class="soft">A lasting rule you took when ${IDEO[id].name} reached ${T.stack.pick}.</p>` : ""; }
  if (kind === "legend") return `${tipHead("Reading a row")}<p>The bar is support, 0 to 100. The two ticks mark ${G.rules.intentUnder} (restless below) and ${T.bar} (loyal above).</p><p>The diamond shows where support is drifting: each month end it moves part of the way there. A coloured stretch shows your last change.</p><p>The hatched start of the bar is the danger zone: under ${FALLS()} a faction acts and can bring you down. The small icon by the number shows what a holder gives you each month at ${T.produceAt} or more.</p>`;
  if (kind === "legend-abroad") return `${tipHead("Reading a backer")}<p>The ring is support, 0 to 100. Its hatched start is the danger zone: under ${FALLS()} a backer turns on you.</p><p>The small icon under the name shows what a backer gives you each month at ${T.produceAt} or more.</p>`;
  if (kind === "stack") {
    const n = st.held[id], d = pickedOn(id), law = lawOf(id);
    return `${tipHead(`${IDEO[id].name} · ${n} held`)}<p>Answers of this ideology are filed here. ${kw("passive", "Pick")} at ${T.stack.pick}, ${kw("power", "power card")} at ${T.stack.power}, ${kw("major", "law")} at ${T.stack.major}.</p>${d ? `<p>Your pick: <b>${d.title}</b>. ${E.rulesLine(P, d)}</p>` : ""}${G.laws.includes(law.id) ? `<p>Law enacted: <b>${law.title}</b>.</p>` : ""}`;
  }
  if (kind === "oz") { const c = st.hand[+id]; return `${tipHead(c.title)}<p>You can enact this law only from inside the ${IDEO[c.source].name} zone. ${closer(c.source)}</p>`; }
  if (kind === "hist") { const c = E.card(P, id); return `${tipHead(c.title)}<p>${histText(c)}</p>`; }
  if (kind === "date") return `${tipHead(`Month ${st.month} of ${W.months}`)}<p>The ${kw("reckoning", "Reckoning")} comes in ${reckDate()}.</p>`;
  if (kind === "deck") return `${tipHead("This month's card")}<p>Each month brings one question. Each answer belongs to one of the era's ideologies; you learn which after you choose.</p>`;
  if (kind === "end" && ($("#end").disabled || st.endArmed)) return "";
  if (kind === "end") return `${tipHead("End month")}<p>End month ${st.month} of ${W.months}. Unplayed cards stay in your hand.</p>`;
  if (kind === "compass") return KW.compass();
  if (kind === "plays") return `${tipHead("Plays")}<p>You can play up to ${T.plays} cards a month. Each costs resources.</p>`;
  return "";
}
const ROLE = { money: "pays for subsidies and patronage. Only this kind can go below 0: the state borrows, and debt at month end costs every faction support.", force: "pays for crackdowns, decrees and iron cards. It stops at 0.", voice: "pays for speeches, campaigns and elections. It stops at 0.", trust: "pays for talks, deals and kept promises. It stops at 0." };
function resTip(k) {
  const inc = income(k), n = net(k);
  return `${tipHead(`${RES[k].name} · ${amt(k, st.res[k])}`)}<p>${RES[k].name} ${ROLE[k]}</p>${isLow(k) ? `<p class="warn">${k === "money" ? `In debt. Every faction loses ${T.debtFactionLoss} if it is still below 0 at month end; ${T.debtFall} month ends in a row and you fall.` : "None left. Cards and answers that need it are blocked."}</p>` : ""}<p><b>Next month ${amt(k, Math.round(n * 10) / 10, true)}</b></p>${inc.length ? `<ul class="inc">${inc.map((x) => `<li><span>${x.from}</span><b class="num">${amt(k, x.n, true)}</b></li>`).join("")}</ul>` : `<p class="soft">No holder gives it now. Holders at ${T.produceAt} or more each give 1.</p>`}`;
}
function standTip() {
  const v = standing();
  return `${tipHead(`Standing ${v}`)}<p>Your order endures at the Reckoning if this is ${T.bar} or more. ${v >= T.bar + 5 ? "You are safe today." : v >= T.bar ? "You are close to the line." : "Today you would be swept away."}</p>${coalitionHTML(true)}<p class="soft">Open your seat (<kbd>C</kbd>) for more.</p>`;
}

/* ---------- medallions: split flat ideology colours and a bold emblem (factions), an emblem seal (backers) ---------- */
const skH = (h) => [...(SK.factions ?? []), ...(SK.patrons ?? [])].find((x) => x.id === h.id);
function crest(h, cls = "crest") {
  const s = skH(h), e = s?.emblem;
  if (!e?.kind || e.kind === "none") return "";
  if (isPat(h)) { const C = correct(SK.palette).palette; return `<svg class="${cls}" viewBox="-50 -50 100 100" aria-hidden="true">${colorize(emblem({ ring: "a", ...e }, 100), { a: C.accent, b: C.panel, c: C.ink })}</svg>`; }
  const p1 = pal(lean(h));
  return `<svg class="${cls} bold" viewBox="-26 -26 52 52" aria-hidden="true">${colorize(emblem({ ...e, ground: "none", ring: "none", slot: "c" }, 100), { ...p1, c: s.accent || p1.c })}</svg>`;
}
const faceHTML = (h) => (isPat(h) ? `<div class="pdisc">${crest(h)}</div>` : `<div class="half h1" style="${vars(lean(h))}"></div><div class="half h2" style="${vars(second(h))}"></div>${crest(h)}`);
const miniHTML = (h) => `<span class="mini fm">${faceHTML(h)}</span>`;
function medHTML(h) {
  return `<div class="med"><div class="breath">${faceHTML(h)}</div><svg class="ring" viewBox="0 0 80 80"><circle class="trk" cx="40" cy="40" r="37"/><circle class="arc" cx="40" cy="40" r="37" pathLength="100" style="stroke-dasharray:${r(st.sup[h.id])} 100"/><circle class="fz" cx="40" cy="40" r="37" pathLength="100" style="stroke-dasharray:${fzDash()}"/></svg>
    <svg class="crack" viewBox="0 0 100 100" preserveAspectRatio="none"><path d="M56 0 L41 38 L59 61 L44 100"/></svg><div class="flash"></div></div>`;
}
const fzDash = () => { const n = FALLS(), seg = []; for (let k = 0; k < n; k += 2.5) seg.push(1, 1.5); return `${seg.join(" ")} 0 ${100 - n}`; };

/* ---------- render ---------- */
const rowHTML = (h, size, i = 0) => `<li class="fac" data-id="${h.id}" data-tip="fac:${h.id}" tabindex="0" style="${isPat(h) ? "" : vars(lean(h)) + ";"}--s:${r(st.sup[h.id])};--i:${i};--rest:${restOf(h.id)};--fz:${FALLS()}%;--l1:${G.rules.intentUnder}%;--l2:${T.bar}%">${medHTML(h)}
    <div class="who"><span class="nm t1">${h.short}</span><span class="badge t1"></span><span class="intent t1"></span></div>
    <span class="bar" aria-hidden="true"><b class="fz"></b><i></i><b class="rst"></b></span><span class="shaft" aria-hidden="true"><i></i></span>
    <div class="nb"><span class="prod" data-role="${h.produces}" data-tip="prod:${h.id}" aria-hidden="true">${ico(h.produces)}</span><span class="v ${size} disp num">${r(st.sup[h.id])}</span></div></li>`;
function renderPeople() {
  const home = [...W.factions].sort((x, y) => st.sup[y.id] - st.sup[x.id]);
  $("#factions ul").innerHTML = home.map((h, i) => rowHTML(h, "t3", i)).join("");
  gsap.killTweensOf(".med .breath");
  $("#patrons ul").innerHTML = W.patrons.map((h) => rowHTML(h, "t2")).join("");
  for (const h of PEOPLE) { settleMood(h.id); settleCrack(h.id, true); }
  rove($("#factions ul")); rove($("#patrons ul"));
  if (!RM) $$(".med .breath").forEach((b, i) => gsap.to(b, { scale: 1.035, duration: 3.2 + (i % 3) * 0.4, yoyo: true, repeat: -1, ease: "soft", delay: i * 0.37 }));
}
// ring colour + shape (dashed when restless) and the intent word under the demand line
function settleMood(id) {
  const li = $(`.fac[data-id="${id}"]`); if (!li) return;
  const v = r(st.sup[id]), F = FALLS(), intent = P.deck.intents[id]?.title ?? "Restless";
  li.dataset.mood = moodKey(v); li.style.setProperty("--s", v);
  li.classList.toggle("crit", v < F + 5); li.classList.toggle("producing", v >= T.produceAt);
  const plot = G.plotting.includes(id) && G.phase !== "over", it = $(".intent", li);
  fadeText(it, plot ? `Plotting: brings you down if still under ${F} at the end of ${monthLabel(G.month, false)}` : v < F ? `Under ${F}: acts this month` : v < F + 5 ? `${v - F + 1} from acting` : v < G.rules.intentUnder ? intent : "");
  it.classList.toggle("fallen", v < F || plot);
  it.title = v < F ? `Under ${F}. At month end it acts and plots. If it is still under ${F} a month later, it brings you down.` : v < G.rules.intentUnder ? `Its demand: ${intent}. Under ${F} it acts and plots against you.` : "";
}
function fadeText(el, text) {
  if ((el._want ?? el.textContent) === text) return;
  const was = el.textContent; el._want = text;
  if (RM || (!text && !was)) { el.textContent = text; el._want = undefined; return; }
  if (text) { el.textContent = text; el._want = undefined; gsap.fromTo(el, { opacity: was ? 0.3 : 0 }, { opacity: 1, duration: 0.3, ease: "soft", overwrite: true, clearProps: "opacity" }); }
  else gsap.to(el, { opacity: 0, duration: 0.2, ease: "soft", overwrite: true, onComplete: () => { if (el._want === "") el.textContent = ""; el._want = undefined; gsap.set(el, { clearProps: "opacity" }); } });
}
function renderTop() {
  $("#polity").textContent = W.polity;
  $("#months").innerHTML = Array.from({ length: W.months }, (_, i) => `<li class="${i + 1 < st.month ? "done" : i + 1 === st.month ? "now" : ""}"></li>`).join("");
  $("#res").innerHTML = RK.map((k) => `<div class="rc ${k === "money" && st.res[k] < 0 ? "debt" : ""} ${isLow(k) ? "low" : ""}" data-role="${k}" data-tip="kw:res:${k}" tabindex="0">${ico(k)}<span class="rcol"><span class="rv t2 disp num">${amt(k, st.res[k])}</span><span class="rn soft">${RES[k].name}</span></span></div>`).join("");
  rove($("#res"));
}
const MARK = () => ({ [T.stack.pick]: "pick", [T.stack.power]: "power", [T.stack.major]: "major" }), NEXT = { pick: "pick a rule", power: "power card", major: "law" };
function stackHTML(id) {
  const n = st.held[id], M = MARK(), next = Object.keys(M).map(Number).find((k) => k > n), law = G.laws.includes(lawOf(id).id), rule = pickedOn(id), k5 = Math.min(n, 5);
  return `<div class="pile" style="--k:${Math.max(0, k5 - 1)}">${n ? "" : `<div class="slot"></div>`}${law ? `<span class="lawseal" aria-label="Law enacted"></span>` : ""}${rule ? `<span class="ruleseal" data-tip="rule:${id}"><span class="sr">Rule taken: ${rule.title}</span></span>` : ""}${Array.from({ length: k5 }, (_, i) => `<div class="pc ${i === k5 - 1 ? "fin" : ""}" style="transform:translate(${i * 6}px,${-i * 4}px) rotate(${(i % 2 ? 2 : -2) + i}deg)"></div>`).join("")}
    ${n ? `<span class="count t3 disp num">${n}</span>` : ""}</div>
    <div class="lab"><div class="track" aria-hidden="true">${Array.from({ length: T.stack.major }, (_, j) => j + 1).map((k) => `<i class="${k <= n ? "on" : ""} ${M[k] ? `m-${M[k]}` : ""} ${k === T.stack.pick && rule ? "took" : ""} ${k === next ? "next" : ""}"></i>`).join("")}</div>
    <span class="sn t1">${IDEO[id].name}</span>${law ? `<span class="nx law t1">Law enacted</span>` : next && next - n === 1 ? `<span class="nx t1">1 more: ${NEXT[M[next]]}</span>` : ""}</div>`;
}
function nameStack(s) {
  const id = s.dataset.id, n = st.held[id], rule = pickedOn(id);
  s.setAttribute("aria-label", `${IDEO[id].name}, ${n} filed${G.laws.includes(lawOf(id).id) ? ", law enacted" : ""}${rule ? `, rule taken: ${rule.title}` : ""}`);
}
// one stack re-renders; what changed on it (label, lit pips, seals) eases in instead of switching
function restack(id) {
  const s = $(`.stack[data-id="${id}"]`), old = { nx: $(".nx", s)?.textContent ?? "", on: $$(".track i.on", s).length, seals: $$(".ruleseal, .lawseal", s).map((e) => e.className) };
  s.innerHTML = stackHTML(id); nameStack(s);
  if (RM) return s;
  const nx = $(".nx", s); if (nx && nx.textContent !== old.nx) gsap.from(nx, { opacity: 0, y: 4, duration: 0.3, ease: "settle", clearProps: "opacity,transform" });
  const on = $$(".track i.on", s); if (on.length > old.on) gsap.from(on.slice(old.on), { scale: 0.3, opacity: 0, duration: 0.35, ease: "settle", stagger: 0.05, clearProps: "opacity,transform" });
  for (const e of $$(".ruleseal, .lawseal", s)) if (!old.seals.includes(e.className)) gsap.from(e, { opacity: 0, scale: 0.6, duration: 0.4, ease: "settle", clearProps: "opacity,transform" });
  return s;
}
function renderTableau() {
  $("#tableau").innerHTML = `<h2 class="zl t1">Your record</h2>` + IDS.map((id) => `<div class="stack" data-id="${id}" data-tip="stack:${id}" tabindex="0" style="${vars(id)}">${stackHTML(id)}</div>`).join("");
  $$("#tableau .stack").forEach(nameStack);
  rove($("#tableau"));
}

/* ---------- the hand: what the engine says you hold ---------- */
const BASIC = () => ({ talk: { title: "Talk to a faction", effect: `One faction you choose gains ${T.talk.up} support.` }, address: { title: "Address the nation", effect: "Your next answer counts twice." } });
let fresh = new Set();
function handCards() {
  const B = BASIC();
  return E.hand(P, G).map((h) => {
    const def = E.handDef(P, h.id), src = SRC[h.id];
    const source = h.kind === "talk" || h.kind === "address" ? "always" : src ?? h.kind;
    const from = source === "always" ? "Always in hand" : src ? `From ${IDEO[src].name}` : h.kind === "grip" ? `From your ${E.band(G.grip)} grip` : h.kind === "patron" ? `From ${person(Object.keys(P.deck.patronCards).find((k) => P.deck.patronCards[k].id === h.id)).short}` : "From the centre";
    return { ...h, title: def?.title ?? B[h.id].title, effect: def ? E.rulesLine(P, def) : B[h.id].effect, source, from, major: h.kind === "law" && !!src, fresh: fresh.has(h.id) };
  });
}
const rank = (c) => (c.source === "always" ? -1 : IDS.includes(c.source) ? IDS.indexOf(c.source) * 2 + (c.major ? 1 : 0) : { law: 50, grip: 60, patron: 70 }[c.kind] ?? 80);
const NEUTRAL = `<svg viewBox="-1.2 -1.2 2.4 2.4" aria-hidden="true"><circle r="1.04"/><circle class="in" r=".82"/><polygon points="0,-.6 .57,-.19 .35,.49 -.35,.49 -.57,-.19"/><circle class="dot" r=".09"/></svg>`;
const whyNot = (c) => (c.why === "phase" ? handHint() + "." : c.why === "plays" ? "No plays left this month. End the month to get more." : c.why === "zone" ? closer(c.source) : c.why === "cost" ? needText(c.cost) + "." : "");
const cardInner = (c, full) => `${IDS.includes(c.source) ? `<span class="art fin"></span>` : `<span class="art neutral">${NEUTRAL}</span>`}
  <span class="cost t1">${costChips(c.cost)}</span>
  <span class="txt"><span class="ti t2 disp">${c.title}</span><span class="ef t1 soft">${c.why === "zone" ? `Stand closer to ${IDEO[c.source].name}` : c.effect}</span>${full && c.why === "zone" ? `<span class="src t1">${closer(c.source)}</span>` : ""}${full && !afford(c.cost) ? `<span class="src t1 need">${needText(c.cost)}</span>` : ""}${full ? `<span class="src t1 soft">${c.from}</span>` : ""}</span>`;
const handOrder = () => st.hand.map((_, i) => i).sort((a, b) => rank(st.hand[a]) - rank(st.hand[b]) || a - b);
const cardName = (c) => `${c.title}, costs ${costWords(c.cost)}. ${c.why === "zone" ? closer(c.source) : afford(c.cost) ? c.effect : needText(c.cost)}`.replace(/"/g, "&quot;");
const canPlay = (c) => c.ok && st.phase === "hand";
function renderHand() {
  st.hand = handCards();
  slot($("#plays"), handHint());
  popout(null);
  const order = handOrder();
  const kind = (b) => (b.classList.contains("broke") ? "broke" : "");
  const was = new Map($$("#hand .hc").map((b) => [b.dataset.id, kind(b)]));
  $("#hand ul").innerHTML = order.map((i, k) => {
    const c = st.hand[i], gs = !k || st.hand[order[k - 1]].source !== c.source ? "gs" : "", sty = IDS.includes(c.source) ? vars(c.source) : "";
    return `<li class="${gs}" data-i="${i}"><button class="hc ${c.why === "plays" && st.phase === "hand" ? "spent" : ""} ${c.fresh ? "new" : ""} ${c.why === "zone" ? "oz" : ""} ${afford(c.cost) || c.why === "plays" ? "" : "broke"}" data-i="${i}" data-id="${c.id}" style="${sty}" aria-label="${cardName(c)}" ${canPlay(c) ? "" : "aria-disabled=true"}>${cardInner(c)}</button></li>`;
  }).join("");
  if (!RM) for (const b of $$("#hand .hc")) {
    const w = was.get(b.dataset.id), k = kind(b);
    if (w === undefined || w === k) continue;
    gsap.fromTo($$(":scope > :not(.cost)", b), { opacity: k ? 1 : 0.45 }, { opacity: k ? 0.45 : 1, duration: 0.35, ease: "soft", clearProps: "opacity" });
  }
  bindHand();
  layoutHand();
}
// Fit the hand into its area: one row per card; rows go thin first, and effects hide only when that is not enough.
function layoutHand() { const h = $("#hand"); h.classList.add("measure"); fitHand(); h.classList.remove("measure"); }
function fitHand() {
  const hand = $("#hand"), ul = $("ul", hand), lis = $$("li", ul), n = lis.length;
  if (!n) return;
  hand.classList.remove("tight", "thin", "dense");
  ul.style.removeProperty("--swa"); ul.style.removeProperty("--rg");
  const fs = parseFloat(getComputedStyle(root).fontSize), used = () => lis[n - 1].getBoundingClientRect().bottom - lis[0].getBoundingClientRect().top;
  const spare = ul.clientHeight - used();
  if (spare > 0) ul.style.setProperty("--swa", `${Math.min(3.4 * fs, 2 * fs + spare / n)}px`);
  else for (const m of ["thin", "tight", "dense"]) { if (ul.scrollHeight <= ul.clientHeight + 1) break; hand.classList.add(m); }
  const left = ul.clientHeight - used();
  if (left > 0) ul.style.setProperty("--rg", `${Math.min(1.5 * fs, left / n)}px`);
}
// The hovered or focused card pops out over the stage, at full size with its art.
function popout(li) {
  const old = $("#fx .pop:not(.out)");
  if (!li) { fadeOut(old, 0.14); return; }
  const i = li.dataset.i, c = st.hand[+i];
  if (!c || old?.dataset.i === i) return;
  fadeOut(old, 0.14);
  const p = document.createElement("div"), mid = st.phase === "hand";
  p.className = `hc pop${mid ? " mid" : ""}`; if (mid) p.dataset.tipAvoid = ""; p.dataset.i = i; p.style.cssText = IDS.includes(c.source) ? vars(c.source) : "";
  p.innerHTML = cardInner(c, true) + (mid ? `<span class="pophint t1">${canPlay(c) ? "Click it in your hand, or press Enter, to play it." : whyNot(c)}</span>` : "");
  $("#fx").append(p);
  const h = $("#hand").getBoundingClientRect(), b = li.getBoundingClientRect(), cr = $("#center").getBoundingClientRect(), ph = p.offsetHeight;
  const x = mid ? cr.left + cr.width / 2 - p.offsetWidth / 2 : h.left - 14 - p.offsetWidth, fit = mid ? Math.min(1, (cr.height - 16) / ph) : 1; // a tall card scales down, never clips
  const y = mid ? cr.top + cr.height / 2 - ph / 2 : Math.max(cr.top, Math.min(cr.bottom - ph, innerHeight - 8 - ph, b.top + Math.min(b.height, 60) / 2 - ph / 2));
  gsap.set(p, { left: x, top: y });
  gsap.fromTo(p, { scale: RM ? fit : 0.92 * fit, x: RM || mid ? 0 : 16, y: RM || !mid ? 0 : 12, opacity: 0 }, { scale: fit, x: 0, y: 0, opacity: 1, duration: D(0.24), ease: "settle" });
}
const restPop = () => { popout(st.phase === "hand" ? $("#hand li:hover") || $("#hand li:has(.hc:focus-visible)") : null); handCall(); };
const ARROW = `<svg class="arrow" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 12h15M13 6l6 6-6 6"/></svg>`;
function handCall() {
  const el = $("#center .rest:not(.out) .callh"); if (!el) return;
  const left = st.phase === "hand" ? G.plays : 0, can = left > 0 && st.hand.some(canPlay);
  const html = st.phase !== "hand" ? "" : can
    ? `<div class="slots" aria-hidden="true">${"<i></i>".repeat(left)}</div><p class="t2 disp">${left > 1 ? `Play up to ${left} cards` : "Play 1 more card"} from your hand ${ARROW}</p><button class="quiet t1">or end the month</button>`
    : `<p class="t2 disp">${left ? "Nothing you can play now" : "All plays made"}</p><p class="t1 soft">End the month when you are ready.</p>`;
  if (el._html === html) return; el._html = html;
  el.innerHTML = html;
  $(".quiet", el)?.addEventListener("click", () => $("#end").click());
  if (html && !RM) gsap.fromTo(el, { opacity: 0, y: 8 }, { opacity: 1, y: 0, duration: 0.36, ease: "settle", clearProps: "opacity,transform" });
  const ar = $(".arrow", el); if (ar && !RM) gsap.to(ar, { x: 6, duration: 0.9, yoyo: true, repeat: -1, ease: "soft" });
}

/* ---------- holders react ---------- */
function settleCrack(id, instant) {
  const li = $(`.fac[data-id="${id}"]`); if (!li || !li.querySelector(".h1")) return;
  const k = st.sup[id] < G.rules.intentUnder ? 1 : 0, dur = instant ? 0 : D(0.9);
  gsap.to(li.querySelector(".h1"), { x: -1.6 * k, y: -0.6 * k, rotation: -2.5 * k, duration: dur, ease: "settle" });
  gsap.to(li.querySelector(".h2"), { x: 1.6 * k, y: 0.6 * k, rotation: 2.5 * k, duration: dur, ease: "settle" });
  gsap.to(li.querySelector(".crack"), { opacity: k ? 0.9 : 0, duration: dur });
}
// What the last choice changed stays on the rows (a signed chip by the number, the moved stretch of the bar) until its card files.
function mark(li, delta, from, to) {
  st.marks[li.dataset.id] = delta; showMark(li);
  if (!RM) gsap.fromTo($(".badge", li), { opacity: 0, scale: 0.8 }, { opacity: 1, scale: 1, duration: 0.3, ease: "settle", clearProps: "opacity,transform" });
  const bar = $(".bar", li); if (!bar) return;
  const c = bar.querySelector(".chg:not(.out)") ?? bar.appendChild(document.createElement("b")); c.className = `chg ${delta > 0 ? "up" : "down"}`;
  c.style.cssText = `left:${Math.min(from, to)}%;width:${Math.abs(to - from)}%`;
}
function flipBars(lis, fn) {
  const bars = lis.map((li) => $(".bar", li)).filter(Boolean), w0 = bars.map((b) => b.offsetWidth);
  fn();
  if (RM) return;
  bars.forEach((b) => { gsap.killTweensOf(b, "width"); b.style.width = ""; });
  bars.map((b) => b.offsetWidth).forEach((w1, i) => { if (w0[i] && w1 !== w0[i]) gsap.fromTo(bars[i], { width: w0[i] }, { width: w1, duration: 0.25, ease: "settle", clearProps: "width" }); });
}
function showMark(li) {
  const d = st.marks[li.dataset.id], b = $(".badge", li);
  const apply = () => flipBars([li], () => { const t = d ? signed(d) : ""; if (b.textContent !== t) b.textContent = t; b.className = d ? `badge t1 mark ${d > 0 ? "up" : "down"}${st.drift?.has(li.dataset.id) ? " drift" : ""}` : "badge t1"; });
  gsap.killTweensOf(b, "opacity");
  if (!d && !RM && b.classList.contains("mark")) gsap.to(b, { opacity: 0, duration: 0.4, ease: "soft", onComplete: () => { apply(); gsap.set(b, { clearProps: "opacity" }); } });
  else apply();
}
function clearMarks() { st.marks = {}; st.drift = new Set(); $$(".fac").forEach(showMark); $$(".bar .chg").forEach((c) => fadeOut(c, 0.4)); }
// a holder's shown support moves to `to`
function react(id, to, i = 0, why = "") {
  const li = $(`.fac[data-id="${id}"]`), from = st.sup[id], delta = r(to) - r(from);
  st.sup[id] = to; if (delta) st.last[id] = { d: delta, why };
  if (!li) return;
  if (delta) mark(li, delta, r(from), r(to));
  refreshStanding(); tips.refresh();
  roll(li.querySelector(".v"), r(from), r(to));
  gsap.to(li.querySelector(".arc"), { strokeDasharray: `${r(to)} 100`, duration: D(0.9), ease: "settle" });
  settleMood(id);
  if (!delta) return;
  const med = li.querySelector(".med"), fl = li.querySelector(".flash");
  fl.style.setProperty("--fc", delta > 0 ? "var(--up)" : "var(--down)");
  if (RM) { gsap.fromTo(fl, { opacity: 1 }, { opacity: 0, duration: 0.4, ease: "soft" }); settleCrack(id); }
  else {
    gsap.fromTo(fl, { opacity: 1, scale: 1 }, { opacity: 0, scale: 1.2, duration: 0.8, ease: "settle" });
    gsap.fromTo(med, { scale: 1 }, { scale: delta > 0 ? 1.13 : 0.94, duration: 0.14, yoyo: true, repeat: 1, ease: "settle" });
    gsap.fromTo(li, { x: delta > 0 ? 7 : -7 }, { x: 0, duration: 0.45, ease: "settle", clearProps: "transform" });
    if (Math.abs(delta) >= 8) kick(4);
    if (delta < 0 && li.querySelector(".h1")) {
      const f = Math.min(1.6, Math.abs(delta) / 6);
      gsap.timeline()
        .to(li.querySelector(".h1"), { x: -6 * f, y: -3 * f, rotation: -9 * f, duration: 0.12, ease: "settle" })
        .to(li.querySelector(".h2"), { x: 6 * f, y: 3 * f, rotation: 8 * f, duration: 0.12, ease: "settle" }, "<")
        .to(li.querySelector(".crack"), { opacity: 1, duration: 0.08 }, "<")
        .add(() => settleCrack(id), "+=0.25");
    } else settleCrack(id);
  }
  if (!hush) sfx.faction(delta, i);
}
// Cause to effect: a chip carries the change from where it happened to the row it lands on.
function chip(fromXY, id, to, why, i) {
  if (!i) clearMarks();
  const delta = r(to) - r(st.sup[id]);
  return new Promise((res) => {
    const target = $(`.fac[data-id="${id}"] .v`);
    if (!delta || !target) { react(id, to, i, why); res(); return; }
    const [tx, ty] = wc(target), [fx, fy] = fromXY;
    const c = document.createElement("span");
    c.className = `chipfly t2 disp num ${delta > 0 ? "up" : "down"}`; c.textContent = signed(delta);
    $("#fx").append(c);
    const w = c.offsetWidth, h = c.offsetHeight;
    gsap.set(c, { left: fx - w / 2, top: fy - h / 2 });
    const land = () => { c.remove(); react(id, to, i, why); res(); };
    if (RM) { gsap.to(c, { opacity: 0, duration: 0.04, onComplete: land }); return; }
    const lift = -Math.min(120, Math.abs(tx - fx) * 0.25);
    gsap.timeline({ onComplete: land })
      .fromTo(c, { scale: 0.7, opacity: 0 }, { scale: 1.08, opacity: 1, duration: 0.16, ease: "soft" })
      .to(c, { x: tx - fx, scale: 0.9, duration: 0.5, ease: "settle" }, ">")
      .to(c, { keyframes: [{ y: Math.min(0, ty - fy) + lift, duration: 0.22, ease: "soft" }, { y: ty - fy, duration: 0.28, ease: "settle" }] }, "<");
  });
}
let hush = false; // month end plays one sound per beat, not one per row
// whatever the engine changed that no ceremony showed yet lands now
function reconcile() {
  let k = 0;
  for (const h of PEOPLE) if (st.sup[h.id] !== G.support[h.id]) react(h.id, G.support[h.id], k++, "");
  for (const kk of RK) if (st.res[kk] !== G.res[kk]) setRes(kk, G.res[kk]);
  if (st.grip !== G.grip) shiftGrip(G.grip);
  let moved = false;
  for (const id of IDS) if (st.held[id] !== G.stacks[id]) { st.held[id] = G.stacks[id]; restack(id); moved = true; }
  if (moved) { field.setWeights(st.held, false); moveMarker(true); }
  refreshVision();
}

/* ---------- kinetic layer ---------- */
let kinTL = null;
function skipKin() { if (kinTL) kinTL.progress(1); }
// ceremonies run on gsap's clock: Quick plays them at 2.5x; Space or a click runs the rest at 40x to its end state
let SPEED = store.get("usoj-speed") === "quick" ? 2.5 : 1, cer = false;
function ceremony() { cer = true; gsap.globalTimeline.timeScale(SPEED * (window.TUTOR_PACE || 1)); }
function calm() { cer = false; gsap.globalTimeline.timeScale(window.TUTOR_PACE || 1); }
function skipAll() { if (!cer) return false; gsap.globalTimeline.timeScale(40); skipKin(); return true; }
const wait = (s, fn) => gsap.delayedCall(RM ? 0.05 : s, fn);
const sleep = (s) => new Promise((res) => gsap.delayedCall(RM ? 0.05 : s, res));
function kinetic(spec) {
  return new Promise((done) => {
    const k = $("#kin");
    st.kin = true; tips.closeAll();
    k.style.cssText = spec.id ? vars(spec.id) : "";
    if (spec.wash) k.style.setProperty("--kbg", spec.wash);
    k.innerHTML = `${spec.id ? `<div class="wipe fin bloom"></div>` : `<div class="wash"></div>`}
      <div class="lines ${spec.left ? "left" : ""}">${spec.kicker ? `<span class="ks hot">${spec.kicker}</span>` : ""}
      ${spec.lines.map((l) => `<span class="k ${l.cls || ""}">${l.text}</span>`).join("")}${spec.sub ? `<span class="ks">${spec.sub}</span>` : ""}</div>`;
    k.classList.add("on");
    const back = $(".wipe, .wash", k), L = $$(".k", k), kickEl = $(".ks.hot", k), sub = $(".ks:not(.hot)", k);
    const finish = () => { st.kin = false; kinTL = null; k.classList.remove("on"); k.innerHTML = ""; done(); };
    const tl = gsap.timeline({ onComplete: finish });
    kinTL = tl;
    if (RM) { tl.fromTo(k, { opacity: 0 }, { opacity: 1, duration: 0.08 }).add(() => sfx.hit(0.6)).to({}, { duration: 0.12 }).to(k, { opacity: 0, duration: 0.06 }).set(k, { opacity: 1 }); return; }
    const [ox, oy] = spec.from || [innerWidth / 2, innerHeight / 2], [tx, ty] = spec.to || [innerWidth / 2, innerHeight / 2];
    const shapeIn = spec.id ? [`circle(0px at ${ox}px ${oy}px)`, `circle(${Math.hypot(innerWidth, innerHeight)}px at ${ox}px ${oy}px)`] : ["inset(0 0 0 100%)", "inset(0 0 0 0%)"];
    const shapeOut = spec.id ? `circle(0px at ${tx}px ${ty}px)` : "inset(0 100% 0 0)";
    fitLines(L);
    gsap.set(L, { opacity: 0 }); if (kickEl) gsap.set(kickEl, { opacity: 0 }); if (sub) gsap.set(sub, { opacity: 0 });
    tl.fromTo(back, { clipPath: shapeIn[0] }, { clipPath: shapeIn[1], duration: 0.5, ease: "sweep" }, 0).add(() => sfx.hit(0.8), 0.32);
    if (kickEl) tl.fromTo(kickEl, { opacity: 0, y: -24 }, { opacity: 1, y: 0, duration: 0.3, ease: "settle" }, 0.3);
    const t0 = 0.42;
    L.forEach((l, i) => {
      const at = t0 + i * 0.16;
      if (spec.style === "stamp") {
        const split = new SplitText(l, { type: "words,chars" });
        tl.set(l, { opacity: 1 }, at).fromTo(split.chars, { opacity: 0, scale: 2.6, yPercent: -20 }, { opacity: 1, scale: 1, yPercent: 0, duration: 0.22, ease: "swift", stagger: 0.035 }, at)
          .add(() => { sfx.hit(1); kick(4); }, at + 0.22 + split.chars.length * 0.0175);
      } else if (spec.style === "rise") {
        const split = new SplitText(l, { type: "words,chars" });
        tl.set(l, { opacity: 1 }, at).from(split.chars, { yPercent: 110, opacity: 0, duration: 0.42, ease: "settle", stagger: 0.03 }, at).add(() => sfx.hit(0.9), at + 0.12);
      } else {
        tl.fromTo(l, { opacity: 1, xPercent: i % 2 ? 120 : -120 }, { xPercent: 0, duration: 0.3, ease: "settle" }, at).add(() => { sfx.hit(0.7); kick(3); }, at + 0.1);
      }
    });
    const end = spec.hold || 1.95;
    if (sub) tl.fromTo(sub, { opacity: 0, y: 16 }, { opacity: 1, y: 0, duration: 0.3, ease: "settle" }, t0 + L.length * 0.16 + 0.25);
    tl.to([...L, kickEl, sub].filter(Boolean), { scaleY: 0, opacity: 0, duration: 0.2, ease: "swift", stagger: 0.03 }, end)
      .to(back, { clipPath: shapeOut, duration: 0.42, ease: "swift" }, end + 0.05);
  });
}
// a big line wraps (balanced in CSS) and steps down until it sits inside the screen
function fitLines(L) {
  const mh = (innerHeight * 0.62) / Math.max(1, L.length);
  for (const l of L) for (let k = 0; k < 8 && (l.scrollWidth > l.clientWidth + 1 || l.offsetHeight > mh); k++) l.style.fontSize = `${parseFloat(getComputedStyle(l).fontSize) * 0.88}px`;
}
// a long title stamps as two lines
const twoLines = (t) => { const w = t.split(" "), cut = Math.ceil(w.length / 2); return w.length > 3 ? [w.slice(0, cut).join(" "), w.slice(cut).join(" ")] : [t]; };

/* ---------- tactile cards: tilt toward the cursor, lift, press ---------- */
function tactile(el, src = el) {
  if (RM || el._tactile) return; el._tactile = true;
  const rx = gsap.quickTo(el, "rotationX", { duration: 0.35, ease: "settle" }), ry = gsap.quickTo(el, "rotationY", { duration: 0.35, ease: "settle" }), y = gsap.quickTo(el, "y", { duration: 0.3, ease: "settle" });
  gsap.set(el, { transformPerspective: 700 });
  src.addEventListener("pointermove", (e) => { const b = el.getBoundingClientRect(); rx(((e.clientY - b.top) / b.height - 0.5) * -16); ry(((e.clientX - b.left) / b.width - 0.5) * 16); y(-6); el.classList.add("lift"); });
  src.addEventListener("pointerleave", () => { rx(0); ry(0); y(0); el.classList.remove("lift"); gsap.to(el, { scale: 1, duration: 0.2 }); });
  src.addEventListener("pointerdown", () => gsap.to(el, { scale: 0.96, duration: 0.08 }));
  src.addEventListener("pointerup", () => gsap.to(el, { scale: 1, duration: 0.2, ease: "settle" }));
}

/* ---------- the flow ---------- */
const deckHTML = (live = true) => `<div class="deck" ${live ? `data-tip="deck"` : ""} aria-hidden="true"><div class="tiles">${IDS.map((id) => `<i class="fin" data-id="${id}" style="${vars(id)}"></i>`).join("")}</div></div>`;
// gold leaf on the deck: the tiles are one surface under one light; flat SVG tiles when WebGL is missing
const TILES = {};
function finishDeck(deck) {
  if (!glOn) return;
  const parts = $$("i", deck).map((el) => { const id = el.dataset.id; TILES[id] ??= render(skI(id).recipe); el.classList.add("gl"); return { el, tile: TILES[id], pal: pal(id) }; });
  FIN.strip(FIN.surface($(".tiles", deck)), parts, "gold-leaf", SK.finish?.foilSlot ?? "a");
}
function showRest(after) {
  const c = $("#center");
  if (after === "hand") { leave(c); c.insertAdjacentHTML("afterbegin", `<div class="rest"><div class="callh" aria-live="polite"></div></div>`); return; }
  const q = G.queue[0], idle = st.phase === "idle";
  leave(c); c.insertAdjacentHTML("afterbegin", `<div class="rest">${deckHTML(!after)}
    ${after ? `<div class="nextc" data-tip="next" tabindex="0"><span class="t1 soft">Next month, face down</span>${q ? `<b class="t2 disp">${E.card(P, q).title}</b>` : ""}</div>` : ""}
    ${after || idle ? "" : `<button id="draw" class="primary t2 disp">Draw ${monthLabel(G.month, false)}'s card</button><p class="coach t1 soft">One question a month. Your answer moves the holders of power.</p>`}</div>`);
  const r0 = c.firstElementChild, deck = $(".deck", r0);
  tactile(deck); finishDeck(deck);
  if (after) {
    gsap.fromTo(deck, { opacity: 0, scale: 0.9 }, { opacity: 0.5, scale: 0.92, duration: D(0.42), ease: "settle" });
    gsap.from($$(".nextc, .coach", r0), { opacity: 0, y: RM ? 0 : 10, duration: D(0.36), stagger: 0.08, delay: 0.12, ease: "settle", clearProps: "transform,opacity" });
  } else {
    gsap.from([deck, $("#draw"), $(".coach", r0)].filter(Boolean), { opacity: 0, y: RM ? 0 : 24, duration: D(0.8), stagger: 0.1, ease: "settle", clearProps: "transform,opacity" });
    if (!RM) gsap.to(deck, { y: "+=3", duration: 2.4, yoyo: true, repeat: -1, ease: "soft", delay: 0.8 });
    if (idle) return;
    $("#draw").onclick = drawCard;
    pulse($("#draw"));
    coachMark("draw");
  }
}
// a short line on the stage, then it leaves (a history card that did not happen, a month with no card)
async function note(text) {
  const p = document.createElement("div"); p.className = "plate"; p.setAttribute("role", "status");
  p.innerHTML = `<p class="t2 disp">${text}</p>`;
  $("#center").append(p); Object.assign(p.style, { position: "absolute", zIndex: 3 });
  gsap.from(p, { opacity: 0, y: RM ? 0 : 8, duration: D(0.3), ease: "settle" });
  live(text);
  await sleep(1.8);
  fadeOut(p, 0.25);
}

async function drawCard() {
  if (st.phase !== "rest") return;
  st.phase = "drawing";
  emit("draw");
  audio(); tips.closeAll();
  moment("card"); pulse(null); sfx.draw(); clearMarks(); ceremony();
  const c = $("#center"), deck = $(".deck", c);
  gsap.killTweensOf(deck);
  c.tabIndex = -1; c.focus({ preventScroll: true });
  fadeOut($("#draw"), 0.18); fadeOut($("#center .coach"), 0.18);
  const lifted = new Promise((res) => (RM ? res() : gsap.to(deck, { y: -24, scale: 1.05, duration: 0.3, ease: "settle", onComplete: res })));
  let id = null;
  for (;;) {
    const ids = E.shortlist(P, G);
    if (!ids.length) break;
    let pick = ids.length > 1 ? await jev.director(ctx(), ids.map((x) => { const k = E.card(P, x); return { id: x, title: k.title, question: k.question }; })) : null;
    if (!ids.includes(pick)) pick = ids[0];
    let p = null;
    if (E.kindOf(P, pick) === "history") { const k = E.card(P, pick); p = await jev.plausibility(ctx(), histText(k) || k.title, k.date ?? ym(G.month)); }
    const ev = E.draw(P, G, pick, p ?? T.plausibility); save();
    if (ev[0].t === "draw") { id = pick; break; }
    await note(`In this timeline, ${E.card(P, pick).title} does not happen.`);
  }
  await lifted;
  if (!id) { // the deck has run dry this month: straight to your plays
    E.pass(G); save();
    await note("No card comes this month.");
    return toHand();
  }
  const swap = () => showCard(id, true);
  if (RM) gsap.to(deck, { opacity: 0, duration: 0.25, onComplete: swap });
  else gsap.timeline().to(deck, { scaleX: 0, duration: 0.2, ease: "swift", onStart: () => sfx.flip() }).add(swap);
}
function showCard(id, animate) {
  const q = E.card(P, id), c = $("#center"), opts = E.options(P, G);
  st.phase = "card"; st.sel = null; moment("card");
  const card = document.createElement("article");
  card.className = "card"; card.setAttribute("aria-label", "This month's card");
  card.innerHTML = `<div class="front">
      <h3 class="t3 disp">${q.question}</h3><p class="body t1">${q.body}</p>
      <div class="answers">${q.answers.map((a, i) => ansHTML(a, i, opts[i])).join("")}</div>${opts.some((o) => o.forced) ? `<p class="t1 warn">You cannot pay for any answer in full. Each one takes what you have.</p>` : ""}</div>`;
  leave(c); c.prepend(card); fitCard(card); bindAnswers(card);
  if (animate) wait(0.85, calm); else calm();
  $(".ans:not(:disabled)", card)?.focus({ preventScroll: true }); setTimeout(() => coachMark("card"), RM ? 50 : 900);
  emit("answers");
  live(q.question);
  if (!animate) return;
  if (RM) { gsap.from(card, { opacity: 0, duration: 0.3, clearProps: "opacity" }); return; }
  gsap.fromTo(card, { scaleX: 0, scaleY: 0.6, y: -20 }, { scaleX: 1, scaleY: 1, y: 0, duration: 0.65, ease: "settle" });
  const split = new SplitText($("h3", card), { type: "words" });
  gsap.from(split.words, { opacity: 0, y: 12, duration: 0.55, stagger: 0.035, delay: 0.15, ease: "settle", clearProps: "opacity,transform" });
  gsap.from($$(".body, .ans", card), { opacity: 0, y: 14, duration: 0.55, stagger: 0.07, delay: 0.25, ease: "settle", clearProps: "opacity,transform" });
}
// a long card shrinks to the room the stage has; it never runs over the record below
function fitCard(card) {
  const f = card && $(".front", card); if (!f) return;
  f.style.zoom = ""; card.classList.remove("tight"); const room = $("#center").clientHeight;
  if (f.getBoundingClientRect().height > room) card.classList.add("tight"); // first it spends less on air, then the type steps down
  for (let k = 0; k < 4; k++) { const h = f.getBoundingClientRect().height; if (h <= room + 0.5) break; f.style.zoom = ((parseFloat(f.style.zoom) || 1) * room) / h; }
}
// an answer shows what it pays and costs before you choose; one you cannot pay for is greyed with its price
function ansHTML(a, i, o) {
  const gain = Object.fromEntries(Object.entries(a.res ?? {}).filter(([, v]) => v > 0)), price = o.price, miss = o.ok ? [] : lacks(price);
  const chips = RK.filter((k) => price[k] || gain[k]).map((k) => rchip(k, (gain[k] ?? 0) - (price[k] ?? 0), { sign: true, name: true, short: miss.includes(k) })).join("");
  const sel = st.sel === i && o.ok;
  return `<button class="ans ${o.ok ? "" : "short"} ${sel ? "sel" : ""}" data-i="${i}" aria-pressed="${sel}" ${o.ok ? "" : "disabled"}><span class="t t2"><kbd class="ak" aria-hidden="true">${i + 1}</kbd>${a.text}</span><span class="s t1 soft">${a.sub}</span><span class="pay">${chips}${o.ok ? "" : `<span class="need t1">${needText(price)}</span>`}<span class="dec t1" aria-hidden="true">Decide</span></span></button>`;
}
function bindAnswers(card) {
  const q = E.card(P, G.card);
  $$(".ans", card).forEach((b) => {
    const a = q.answers[+b.dataset.i];
    const on = () => {
      if (b.disabled) return;
      const ids = Object.keys(a.moves);
      $$(".fac").forEach((li) => li.classList.toggle("cares", ids.includes(li.dataset.id)));
      sfx.hover(); ids.forEach((_, i) => sfx.care(i));
      live(`Touches: ${ids.map((id) => person(id).short).join(", ")}`);
    };
    const off = () => $$(".fac").forEach((li) => li.classList.remove("cares"));
    b.addEventListener("pointerenter", on); b.addEventListener("focus", () => b.matches(":focus-visible") && on());
    b.addEventListener("pointerleave", off); b.addEventListener("blur", off);
    // Space only skips ceremonies; it never chooses a blind answer (a native button would click on Space)
    for (const t of ["keydown", "keyup"]) b.addEventListener(t, (e) => { if (e.key === " ") e.preventDefault(); });
    b.addEventListener("click", () => { if (st.sel === +b.dataset.i) { off(); answer(st.sel); } else select(+b.dataset.i); });
  });
}
// first click lifts an answer and shows Decide; a second click (or Enter) commits. Nothing undoes it after the reveal.
function select(i) {
  const card = $(".card"), b = card && $$(".ans", card)[i];
  if (st.phase !== "card" || !b || b.disabled) return;
  st.sel = i; hideTour(true);
  $$(".ans", card).forEach((x, k) => { x.classList.toggle("sel", k === i); x.setAttribute("aria-pressed", k === i); });
  $(".answers", card).classList.add("has-sel");
  if (document.activeElement !== b) b.focus({ preventScroll: true });
  if (!RM) gsap.fromTo($(".dec", b), { scale: 0.7, opacity: 0 }, { scale: 1, opacity: 1, duration: 0.25, ease: "settle" });
  sfx.hover(); live(`Selected: ${E.card(P, G.card).answers[i].text}. Press Enter or click it again to decide.`);
}
function unselect() {
  const card = $(".card"); if (!card || st.sel == null || st.phase !== "card") return false;
  st.sel = null; $$(".ans", card).forEach((x) => { x.classList.remove("sel"); x.setAttribute("aria-pressed", false); });
  $(".answers", card).classList.remove("has-sel"); live("No answer selected."); return true;
}
// net change per holder and per resource, in the order the events came
function tally(ev) {
  const mv = new Map(), res = {}; let grip = 0;
  for (const e of ev) {
    if (e.t === "move") mv.set(e.holder, (mv.get(e.holder) ?? 0) + e.delta);
    if (e.t === "res") res[e.kind] = (res[e.kind] ?? 0) + e.delta;
    if (e.t === "grip") grip += e.delta;
  }
  return { mv, res, grip };
}
async function answer(i) {
  if (st.phase !== "card") return;
  st.phase = "deciding";
  const card = $(".card"), q = E.card(P, G.card), a = q.answers[i], id = a.ideology, btn = $$(".ans", card)[i], kind = E.kindOf(P, q.id);
  $$(".ans", card).forEach((b) => (b.disabled = true));
  const nudged = jev.nudge(ctx(), a.text, Object.keys(a.moves));
  emit("decided");
  await window.tutorGate?.("reveal");
  ceremony();
  st.phase = "reveal"; st.sel = null; moment("reveal");
  if (!RM) gsap.fromTo(btn, { scale: 1 }, { scale: 1.03, duration: 0.15, yoyo: true, repeat: 1 });
  const s0 = standing(), ev = E.choose(P, G, i, (await nudged) ?? {}); save();
  const { mv, res, grip } = tally(ev), s1 = r(E.standing(P, G));
  const order = [...Object.keys(a.moves), ...[...mv.keys()].filter((h) => !(h in a.moves))].map((h) => [h, G.support[h], r(G.support[h]) - r(st.sup[h])]);
  const elect = ev.find((e) => e.t === "election");
  const Wt = (h) => (isPat(person(h)) ? 0 : person(h).power ?? 1), big = order.filter(([h, , d]) => Wt(h) && d).sort((x, y) => Math.abs(y[2] * Wt(y[0])) - Math.abs(x[2] * Wt(x[0])))[0];
  const swhy = s1 === s0 || !big ? `Standing holds at ${s0}.` : `Standing ${s0} → ${s1}: ${person(big[0]).short} ${big[2] > 0 ? "rose" : "fell"} ${Math.abs(big[2])}, weight ${Wt(big[0])}.`;
  const gd = Math.round(grip), gwhy = gd ? `Grip moves toward ${gd < 0 ? "open" : "iron"}${a.gripWhy ? `: ${a.gripWhy.replace(/\.$/, "")}` : ""}. ` : "";
  const ewhy = elect ? ` The vote: standing ${r(elect.standing)}, you ${elect.passed ? "win" : "lose"}.` : "";
  const reveal = document.createElement("div");
  reveal.className = "reveal fin"; reveal.style.cssText = vars(id);
  const r0 = card.getBoundingClientRect(), br = btn.getBoundingClientRect(), ox = br.left + br.width / 2 - r0.left, oy = br.top + br.height / 2 - r0.top;
  reveal.innerHTML = `<div class="sheet">
      <div class="head"><div class="seal"></div><div><div class="iname t3 disp" tabindex="-1" data-id="${id}">${IDEO[id].name}</div><div class="yours t1 soft">You chose: ${a.text}</div><span class="chips">${RK.filter((k) => res[k]).map((k) => rchip(k, Math.round(res[k] * 10) / 10, { sign: true, name: true })).join("")}${gd ? `<span class="chip t1">${kw("grip", "Grip")} ${signed(gd)} · toward ${gd < 0 ? "open" : "iron"}</span>` : ""}</span><p class="cons t1 soft">${gwhy}${swhy}${ewhy}</p></div></div>
      <ul class="rx">${order.map(([h, , d]) => { const p = person(h);
        return `<li>${miniHTML(p)}<div class="t1"><b>${p.short}</b><span class="why">${a.reasons[h] || ""}</span></div><span class="d t2 disp num ${d > 0 ? "up" : d < 0 ? "down" : ""}">${d ? signed(d) : "0"}</span></li>`; }).join("")}</ul>
      <div class="foot">${kind === "history" && q.history ? `<p class="hist t1"><strong>In history:</strong> ${histText(q)}</p>` : "<span></span>"}
      ${st.skipHinted ? "" : `<span class="skiphint t1 soft">Space to skip</span>`}<button class="primary go t2 disp">${G.over ? "See the end" : `File under ${IDEO[id].name}`}</button></div></div>`;
  st.skipHinted = true;
  const h0 = card.offsetHeight;
  card.append(reveal);
  for (const k of ["tight", "two"]) { const rx = $(".rx", reveal); if (rx.scrollHeight > rx.clientHeight + 1) reveal.classList.add(k); }
  const h1 = card.offsetHeight, sheet = $(".sheet", reveal);
  $(".iname", reveal).focus({ preventScroll: true });
  sfx.flip();
  gsap.fromTo(card, { height: h0 }, { height: h1, duration: D(0.5), ease: "sweep", clearProps: "height" });
  await new Promise((res) => gsap.fromTo(reveal, { clipPath: `circle(0px at ${ox}px ${oy}px)` },
    { clipPath: `circle(${Math.hypot(r0.width, h1) * 1.1}px at ${ox}px ${oy}px)`, duration: D(0.55), ease: "sweep", onComplete: res }));
  $(".front", card).style.visibility = "hidden";
  const [cx, cy] = wc(card), pile = $(`.stack[data-id="${id}"] .pile`), [tx, ty] = wc(pile);
  const f = field.flood(id, cx, cy, { boost: 1.2 });
  sfx.stamp(id);
  await kinetic({ id, style: "stamp", kicker: "Your answer belongs to", lines: [{ text: IDEO[id].name }], from: [cx, cy], to: [tx, ty], hold: 2.95 });
  field.recede(f, tx, ty); document.body.classList.add("quiet");
  stackPulse(id); bloom([reveal, $(`.stack[data-id="${id}"] .pc.fin`)]);
  const rows = $$(".rx li", sheet);
  await new Promise((res) => gsap.timeline({ onComplete: res }).to(sheet, { opacity: 1, duration: D(0.35) })
    .from($(".iname", sheet), { opacity: 0, x: RM ? 0 : -12, duration: D(0.4), ease: "settle" }, "<")
    .from($(".seal", sheet), { rotation: RM ? 0 : -90, scale: RM ? 1 : 0.4, duration: D(0.6), ease: "settle" }, "<")
    .fromTo(rows, { opacity: 0, x: RM ? 0 : -10 }, { opacity: 1, x: 0, duration: D(0.35), stagger: RM ? 0 : 0.05, ease: "settle" }, "<0.1"));
  for (const k of RK) if (res[k]) setRes(k, G.res[k]);
  if (Object.keys(res).length) sfx.care(0);
  live(`${IDEO[id].name}. ${order.filter(([, , d]) => d).map(([h, , d]) => `${person(h).short} ${d > 0 ? "up" : "down"} ${Math.abs(d)}`).join(", ")}. ${gwhy}${swhy}${ewhy}`);
  // each change leaves its line and lands on its row, one after another so the eye can follow
  const landings = [];
  for (const [k, [h, to]] of order.entries()) {
    landings.push(chip(wc($(".d", rows[k])), h, to, a.reasons[h] || `${q.title}.`, k));
    if (!RM) await sleep(0.42);
  }
  await Promise.all(landings);
  if (kind === "history" && q.history) live(histText(q));
  gsap.timeline().to($(".go", sheet), { opacity: 1, duration: D(0.35) }, RM ? 0 : "+=0.15")
    .add(() => { const g = $(".go", sheet); g.onclick = () => fileCard(id, ev); st.phase = "revealed"; calm(); $(".skiphint", sheet)?.remove(); pulse(g); g.focus({ preventScroll: true }); coachMark("revealed", "factions"); emit("reveal"); });
}
function stackPulse(id, big) {
  const s = $(`.stack[data-id="${id}"]`); if (!s) return;
  s.classList.add("hot");
  if (!RM) gsap.fromTo($(".pile", s), { scale: 1 }, { scale: big ? 1.1 : 1.05, duration: 0.18, yoyo: true, repeat: 1, ease: "settle" });
  setTimeout(() => s.classList.remove("hot"), 1500);
}
async function fileCard(id, ev) {
  if (st.phase !== "revealed") return;
  st.phase = "filing";
  emit("filed");
  await window.tutorGate?.("file");
  ceremony(); clearMarks();
  pulse(null); hideTour(true); document.body.classList.remove("quiet");
  const card = $(".card"), pile = $(`.stack[data-id="${id}"] .pile`);
  $$("#tableau .stack").forEach((x) => (x.tabIndex = x.dataset.id === id ? 0 : -1)); $(`.stack[data-id="${id}"]`).focus({ preventScroll: true });
  const a = sp(card), b = sp(pile), pcW = pile.offsetHeight * 0.75, k = Math.min(st.held[id], 4);
  const tx = b.x + 2 + pcW / 2 + k * 6 - (a.x + a.w / 2), ty = b.y + b.h / 2 - k * 4 - (a.y + a.h / 2);
  sfx.file();
  $(".go", card).disabled = true;
  await new Promise((res) => {
    if (RM) return gsap.to(card, { opacity: 0, duration: 0.3, onComplete: res });
    gsap.timeline({ onComplete: res }).to($(".sheet", card), { opacity: 0, duration: 0.18 })
      .to(card, { x: tx, y: ty, scaleX: pcW / a.w, scaleY: pile.offsetHeight / a.h, rotation: 6, duration: 0.7, ease: "swift" }, "<0.05");
  });
  card.remove();
  const from = st.held[id];
  for (const x of IDS) if (st.held[x] !== G.stacks[x]) { st.held[x] = G.stacks[x]; if (x !== id) restack(x); }
  const s = restack(id);
  $$("#tableau .stack").forEach((x) => (x.tabIndex = x === s ? 0 : -1)); s.focus({ preventScroll: true });
  if (!RM) gsap.from($$(".pc", s).at(-1), { y: -36, opacity: 0, duration: 0.45, ease: "settle", clearProps: "opacity,transform" });
  if (from && $(".count", s)) tick($(".count", s), from, st.held[id], 0.4);
  field.setWeights(st.held, false);
  moveMarker(true); refreshVision();
  if (st.grip !== G.grip) wait(0.5, () => shiftGrip(G.grip));
  stackPulse(id, true); kick(3);
  live(`Filed under ${IDEO[id].name}: ${st.held[id]} held.`);
  showRest("filed");
  await sleep(0.35);
  await unlocksAndPicks(ev);
  reconcile();
  if (G.over) return reckoning();
  toHand();
}
// what the engine opened: a power card or a law for the hand, then any pick it offers
async function unlocksAndPicks(ev) {
  for (const e of ev) if (e.t === "unlock") {
    const src = SRC[e.id];
    if (lawOf(src).id === e.id) await passive(src, `${IDEO[src].name} reached ${T.stack.major} cards: its law joins your hand.`);
    else await unlock(e.id);
  }
  while (G.phase === "pick" && G.offer) await unlocksAndPicks(await pickMoment(G.offer));
}
function passive(id, text) {
  return new Promise((done) => {
    fresh.add(lawOf(id).id);
    const s = $(`.stack[data-id="${id}"]`), [x, y] = wc($(".pile", s));
    const f = field.flood(id, x, y, { speed: MOTION.floodSpeed * 0.8 });
    field.recede(f, x, y, { delay: 0.7 });
    sfx.passive(id); bloom([$(".pc.fin", s)]);
    const t = document.createElement("div");
    t.className = "toast t1"; t.textContent = text;
    s.append(t);
    gsap.fromTo(t, { opacity: 0, y: RM ? 0 : 10 }, { opacity: 1, y: 0, duration: D(0.4), ease: "settle" });
    gsap.to(t, { opacity: 0, delay: 3.2, duration: 0.5, onComplete: () => t.remove() });
    live(text);
    wait(0.7, done);
  });
}
// the pattern drawn line by line, then filled (the power card's art)
function artSVG(id) {
  const o = render(skI(id).recipe, { span: 4 });
  const inner = o.svg.replace(/^<svg[^>]*>/, "").replace(/<\/svg>$/, "").replace(/<rect width="[\d.]+" height="[\d.]+" fill="var\(--b\)"\/>/, "").replace(/<(polygon|circle|rect|path|line|polyline|ellipse)\b/g, '<$1 pathLength="1"');
  return `<svg viewBox="0 0 ${o.w * 4} ${o.h * 4}" preserveAspectRatio="xMidYMid slice" aria-hidden="true"><g class="con">${inner}</g></svg>`;
}
async function unlock(cardId) {
  await window.tutorGate?.("unlock");
  const id = SRC[cardId], u = E.handDef(P, cardId), s = $(`.stack[data-id="${id}"]`), pile = $(".pile", s), [x, y] = wc(pile);
  st.phase = "unlock"; ceremony();
  live(`${IDEO[id].name} reached ${T.stack.power}. Power card unlocked: ${u.title}.`);
  sfx.unlock(id);
  const f = field.flood(id, x, y, { boost: 1.8, speed: MOTION.floodSpeed * 1.5 });
  bloom([$(".pc.fin", s)], false);
  await kinetic({ id, style: "slide", kicker: `${IDEO[id].name} at ${T.stack.power} · new power card`, lines: twoLines(u.title).map((t, k) => ({ text: t, cls: `mid ${k % 2 ? "alt" : ""}` })),
    sub: `${E.rulesLine(P, u)} · costs ${costWords(u.cost ?? {})}`, from: [x, y], to: [innerWidth / 2, innerHeight / 2] });
  field.recede(f, innerWidth / 2, innerHeight / 2);
  const p = pal(id), pw = document.createElement("div");
  pw.className = "power"; pw.style.cssText = vars(id) + `;--a:${p.a};--b:${p.b};--c:${p.c}`;
  pw.innerHTML = `<div class="art">${artSVG(id)}<div class="tile fin"></div></div>
    <div class="pt"><span class="kick t1">Power card · ${IDEO[id].name} ${T.stack.power} held</span><span class="ttl t2 disp">${u.title}</span><span class="ef t1 soft">${E.rulesLine(P, u)}</span><span class="co t1">Costs ${costWords(u.cost ?? {})}</span></div>`;
  $("#stage").append(pw);
  const cr = sp($("#center"));
  gsap.set(pw, { left: cr.x + cr.w / 2 - pw.offsetWidth / 2, top: cr.y + cr.h / 2 - pw.offsetHeight / 2 });
  $(".tile", pw).style.setProperty("--ts", `${$(".art", pw).offsetWidth / 4}px`);
  const shapes = $$(".con *:not(g):not(use):not(defs):not(clipPath)", pw);
  gsap.set(shapes, { fillOpacity: 0, stroke: `var(--${id}-c)`, strokeWidth: 1.4, strokeDasharray: 1, strokeDashoffset: 1 });
  const tl = gsap.timeline();
  if (RM) { gsap.set(shapes, { strokeDashoffset: 0, fillOpacity: 1 }); tl.from(pw, { opacity: 0, duration: 0.3 }).to({}, { duration: 0.8 }); }
  else tl.from(pw, { scale: 0.85, opacity: 0, duration: 0.5, ease: "settle" })
    .to(shapes, { strokeDashoffset: 0, duration: 1.0, ease: "swift", stagger: { amount: 0.5, from: "center" } }, 0.1)
    .to(shapes, { fillOpacity: 1, strokeWidth: 0, duration: 0.5, ease: "settle" }, 0.9)
    .to($(".tile", pw), { opacity: 1, duration: 0.3 }, 1.35).add(() => bloom([$(".tile", pw)]), 1.35).to({}, { duration: 0.9 });
  await new Promise((res) => tl.eventCallback("onComplete", res));
  fresh.add(cardId);
  renderHand();
  const slip = $(`#hand .hc[data-id="${cardId}"]`);
  if (!slip) { fadeOut(pw, 0.2); return; }
  const t = sp(slip), p0 = sp(pw);
  gsap.set(slip, { opacity: 0 });
  sfx.file();
  await new Promise((res) => gsap.to(pw, { x: t.x + t.w / 2 - (p0.x + p0.w / 2), y: t.y + t.h / 2 - (p0.y + p0.h / 2), scaleX: t.w / p0.w, scaleY: t.h / p0.h, opacity: RM ? 0 : 0.25, duration: D(0.7), ease: "swift",
    onComplete: () => { fadeOut(pw, 0.2); gsap.to(slip, { opacity: 1, duration: D(0.3), clearProps: "opacity" }); bloom([$(".art.fin", slip)], false); kick(3); res(); } }));
}

function toHand() {
  calm();
  st.phase = "hand"; moment("hand"); disarmEnd();
  renderHand();
  showRest("hand");
  emit("hand");
  const end = $("#end"), done = G.plays < 1 || !st.hand.some(canPlay);
  end.disabled = false; end.classList.add("shown"); end.classList.toggle("primary", done); end.classList.toggle("sec", !done);
  if (!$("#seatbig").open && !document.activeElement?.closest?.("#hand ul, #settings")) (done ? end : $("#hand")).focus({ preventScroll: true });
  restPop();
  pulse(done ? end : null);
  coachMark("record", "hand", "end");
}

// Telegraph: the engine plays the card on a copy; ghost values show on the rows it would move, and its stack lights.
function trial(c, target, ch) { const s = structuredClone(G); try { E.play(P, s, c.id, target, ch); return s; } catch { return null; } }
function preview(c, on) {
  const prev = new Map($$(".fac").map((li) => [li, $(".badge", li).textContent]));
  flipBars($$(".fac"), () => previewMarks(c, on));
  if (!RM) for (const [li, t] of prev) { const b = $(".badge", li); if (b.classList.contains("ghostv") && b.textContent !== t) gsap.fromTo(b, { opacity: 0 }, { opacity: 1, duration: 0.16, ease: "soft", clearProps: "opacity" }); }
}
function previewMarks(c, on) {
  $$(".fac").forEach((li) => { showMark(li); li.classList.remove("cares"); });
  $$(".stack.ghost").forEach((s) => s.classList.remove("ghost")); $$(".track .gp").forEach((g) => g.classList.remove("gp"));
  if (!on || !c) return;
  const ghost = (id, v, cls) => { const li = $(`.fac[data-id="${id}"]`); if (!li) return; const b = $(".badge", li); b.textContent = `→ ${r(v)}`; b.className = `badge t1 ghostv ${cls}`; li.classList.add("cares"); };
  if (c.target) for (const h of W.factions) { const s = trial(c, h.id); if (s) ghost(h.id, s.support[h.id], "neutral"); }
  else { const s = trial(c, undefined, c.ch); if (s) for (const h of PEOPLE) if (r(s.support[h.id]) !== r(G.support[h.id])) ghost(h.id, s.support[h.id], s.support[h.id] > G.support[h.id] ? "up" : "down"); }
  const s = IDS.includes(c.source) && $(`.stack[data-id="${c.source}"]`);
  if (s) { s.classList.add("ghost"); $$(".track i.on", s).at(-1)?.classList.add("gp"); }
}
function hover(li, on) {
  const c = st.hand[+li.dataset.i];
  if (on) $$("#hand li.hot").forEach((l) => l !== li && l.classList.remove("hot"));
  li.classList.toggle("hot", on);
  if (on && document.activeElement?.closest("#hand li") && !li.contains(document.activeElement)) $(".hc", li)?.focus({ preventScroll: true });
  if (!c || st.phase === "target") return;
  if (!on && $("#hand li.hot")) return;
  preview(c, on && canPlay(c)); on && st.phase !== "month-done" ? popout(li) : restPop();
  if (on) sfx.hover();
}
function bindHand() {
  $$("#hand li").forEach((li) => {
    const b = $("button.hc", li);
    li.addEventListener("pointerenter", () => hover(li, true));
    li.addEventListener("pointerleave", () => hover(li, false));
    b.addEventListener("focus", (e) => e.target.matches(":focus-visible") && hover(li, true));
    b.addEventListener("blur", () => hover(li, false));
    li.onclick = () => tryPlay(+b.dataset.i, b);
  });
}
// play it, or say why not: on the card and to a screen reader
function tryPlay(i, b) {
  const c = st.hand[i];
  if (canPlay(c)) return play(i);
  gsap.fromTo(b, { x: -4 }, { x: 0, duration: 0.3, ease: "settle" });
  const why = st.phase !== "hand" ? handHint() + "." : whyNot(c);
  if (!why) return;
  live(why);
  const ef = $(".ef", b); if (!ef || st.phase !== "hand") return;
  ef.dataset.orig ??= ef.textContent; ef.textContent = why; ef.classList.add("needflash");
  clearTimeout(b._t); b._t = setTimeout(() => { ef.textContent = ef.dataset.orig; ef.classList.remove("needflash"); }, 2800);
}
const plateNote = (html) => {
  let p = $("#center .plate:not(.out)");
  if (!p) { p = document.createElement("div"); p.className = "plate"; $("#center .rest")?.append(p); gsap.from(p, { opacity: 0, y: RM ? 0 : 6, duration: D(0.22), ease: "settle", clearProps: "transform,opacity" }); }
  p.innerHTML = html;
};
function play(i) {
  const c = st.hand[i];
  preview(c, false); popout(null); tips.closeAll();
  if (c.target) {
    st.phase = "target"; moment("target"); preview(c, true);
    $$("#factions .fac").forEach((li) => { li.dataset.tipOff = li.dataset.tip; delete li.dataset.tip; li.classList.add("target"); li.setAttribute("role", "button"); li.setAttribute("aria-pressed", "false"); li.tabIndex = 0;
      li.onclick = li.onkeydown = (e) => { if (e.type === "click" || e.key === "Enter" || e.key === " ") { e.preventDefault?.(); e.stopPropagation?.(); li.setAttribute("aria-pressed", "true"); resolvePlay(i, li.dataset.id); } }; });
    $("#factions .fac")?.focus({ preventScroll: true });
    plateNote(`<p class="t2 disp">Who do you talk to?</p><p class="t1">Choose a faction on the left. <kbd>Esc</kbd> cancels.</p>`);
    live("Choose a faction to talk to.");
    return;
  }
  if (c.asks?.length) return askFor(i, c, 0, {});
  resolvePlay(i);
}
// A card that asks for a choice: one picker per ask, the hovered option previewed on the rows and in the plate; Esc cancels.
const ASKQ = { holder: ["Which holder?", "Choose a faction or a foreign backer on the left."], kind: ["Which resource?", "Choose one."], dir: ["Which way does your grip move?", "Choose one."], ideology: ["Which ideology?", "Choose one."] };
const resultHTML = (s) => !s ? "" : [...RK.filter((k) => s.res[k] !== G.res[k]).map((k) => rchip(k, Math.round((s.res[k] - G.res[k]) * 10) / 10, { sign: true, name: true })),
  r(s.grip) !== r(G.grip) ? `<span class="chip t1">Grip ${signed(r(s.grip) - r(G.grip))}</span>` : "", ...IDS.filter((id) => s.stacks[id] !== G.stacks[id]).map((id) => `<span class="chip t1">${IDEO[id].name} ${signed(s.stacks[id] - G.stacks[id])}</span>`)].join("");
function askFor(i, c, k, ch) {
  if (k >= c.asks.length) return resolvePlay(i, undefined, ch);
  const a = c.asks[k], last = k === c.asks.length - 1, opts = E.askOptions(P, a), [q, how] = ASKQ[a];
  clearTarget(); st.phase = "target"; moment("target");
  const pick = (v) => askFor(i, c, k + 1, { ...ch, [a]: v });
  const show = (v) => { const full = { ...ch, [a]: v }, res = $("#center .askres"); preview({ ...c, ch: full }, last); if (res) res.innerHTML = last ? resultHTML(trial(c, undefined, full)) : ""; };
  const label = (v) => (a === "kind" ? `${ico(v)}<span>${RES[v].name}</span>` : a === "dir" ? `<span>${band(v === "iron" ? 100 : 0)}</span>` : `<i class="sw" style="${vars(v)}"></i><span>${IDEO[v].name}</span>`);
  plateNote(`<p class="t1 soft">${c.title}${c.asks.length > 1 ? ` · ${k + 1} of ${c.asks.length}` : ""}</p><p class="t2 disp">${q}</p>${a === "holder" ? "" : `<div class="askopts" data-rove=".aopt">${opts.map((v) => `<button class="aopt t1" data-v="${v}" ${a === "kind" ? `data-role="${v}"` : ""}>${label(v)}</button>`).join("")}</div>`}
    <p class="askres t1" aria-live="polite"></p><p class="t1">${how} <kbd>Esc</kbd> cancels.</p><button class="quiet t1 askno">Cancel</button>`);
  $("#center .askno").onclick = cancelTarget;
  if (a === "holder") {
    $$("#left .fac").forEach((li) => { li.dataset.tipOff = li.dataset.tip; delete li.dataset.tip; li.classList.add("target"); li.setAttribute("role", "button"); li.tabIndex = 0;
      li.onpointerenter = li.onfocus = () => show(li.dataset.id);
      li.onclick = li.onkeydown = (e) => { if (e.type === "click" || e.key === "Enter" || e.key === " ") { e.preventDefault?.(); e.stopPropagation?.(); pick(li.dataset.id); } }; });
    $("#factions .fac")?.focus({ preventScroll: true });
  } else {
    const bs = $$("#center .aopt"); rove($("#center .askopts"));
    bs.forEach((b) => { b.onpointerenter = b.onfocus = () => show(b.dataset.v); b.onclick = () => pick(b.dataset.v); });
    bs[0]?.focus({ preventScroll: true });
  }
  live(`${c.title}: ${q} ${how}`);
}
function clearTarget() { preview(null, false); $$("#left .fac").forEach((li) => { li.onpointerenter = li.onfocus = null; if (li.dataset.tipOff) { li.dataset.tip = li.dataset.tipOff; delete li.dataset.tipOff; } li.classList.remove("target"); li.removeAttribute("role"); li.removeAttribute("aria-pressed"); li.onclick = li.onkeydown = null; }); rove($("#factions ul")); rove($("#patrons ul")); }
function cancelTarget() { if (st.phase !== "target") return; clearTarget(); fadeOut($("#center .plate")); toHand(); }
// A played card flies to the centre, stamps, dissolves into its effect, and the effect travels to the rows.
async function resolvePlay(i, target, ch) {
  if (!["hand", "target"].includes(st.phase)) return;
  const c = st.hand[i];
  emit("played");
  clearTarget(); fadeOut($("#center .plate"));
  ceremony(); st.phase = "playing"; moment("playing"); pulse(null);
  const slip = $(`#hand .hc[data-i="${i}"]`), src = $(`#fx .pop[data-i="${i}"]`) || slip, s = sp(src), w0 = src.offsetWidth, h0 = src.offsetHeight;
  $("#hand").focus({ preventScroll: true });
  sfx.play();
  const ev = E.play(P, G, c.id, target, ch); save();
  const { mv, res } = tally(ev);
  const ghost = src.cloneNode(true); ghost.classList.add("fly"); ghost.removeAttribute("data-tip");
  popout(null); $$("#hand li.hot").forEach((l) => l.classList.remove("hot"));
  Object.assign(ghost.style, { left: `${s.x + s.w / 2 - w0 / 2}px`, top: `${s.y + s.h / 2 - h0 / 2}px`, width: `${w0}px`, height: `${h0}px` }); // its own size, so a card caught mid-scale keeps all its text
  gsap.set(ghost, { rotationX: 0, rotationY: 0, x: 0, y: 0, scale: s.w / w0 });
  $("#stage").append(ghost);
  slip.style.visibility = "hidden"; src.style.visibility = "hidden";
  for (const k of RK) if (res[k]) setRes(k, G.res[k], 0.5);
  const cr = sp($("#center")), big = Math.min(1.35, (cr.h - 24) / h0, (cr.w - 24) / w0); // it grows only as far as the stage holds it whole
  if (!RM) await new Promise((res2) => gsap.timeline({ onComplete: res2 })
    .to(ghost, { left: cr.x + cr.w / 2 - w0 / 2, top: cr.y + cr.h / 2 - h0 / 2, scale: big, rotation: -3, duration: 0.45, ease: "settle" })
    .to(ghost, { scale: big * 0.85, rotation: 0, duration: 0.12, ease: "swift", onComplete: () => { sfx.hit(0.9); kick(4); } })
    .to(ghost, { scale: big * 1.2, opacity: 0, filter: "blur(6px)", duration: 0.4, ease: "swift" }, "+=0.15"));
  const [x, y] = wc(ghost); ghost.remove();
  if (IDS.includes(c.source)) { const f = field.flood(c.source, x, y, { speed: MOTION.floodSpeed * 0.9 }); field.recede(f, x, y, { delay: 0.5 }); }
  const why = `${c.title} played.`, lands = [];
  let k = 0;
  for (const h of mv.keys()) { lands.push(chip([x, y], h, G.support[h], why, k++)); await sleep(0.3); }
  live(`Played ${c.title}. ${c.effect}`);
  await Promise.all(lands);
  if (st.grip !== G.grip) shiftGrip(G.grip);
  if (ev.some((e) => e.t === "law")) await enactLaw(c.id);
  for (const x2 of IDS) if (st.held[x2] !== G.stacks[x2]) { st.held[x2] = G.stacks[x2]; restack(x2); field.setWeights(st.held, false); moveMarker(true); }
  await unlocksAndPicks(ev);
  reconcile();
  toHand();
  if (c.id === "address") plateNote(`<p class="t2 disp">${c.title}</p><p class="t1 soft">Your next answer counts twice.</p>`);
}

// End month asks once while plays remain; the second press ends it.
function disarmEnd() { st.endArmed = false; fadeOut($("#end .endq"), 0.14); }
function askEnd() {
  if (st.phase !== "hand") return;
  const left = G.plays;
  if (left > 0 && st.hand.some(canPlay) && !st.endArmed) {
    st.endArmed = true; tips.closeAll();
    const msg = `${left} play${left > 1 ? "s" : ""} left. Press again to end the month.`;
    $("#end").insertAdjacentHTML("beforeend", `<span class="endq t1">${msg}</span>`);
    live(msg); return;
  }
  disarmEnd(); endMonth();
}
// an act's effects in plain words
const actFx = (a) => [...Object.entries(a.res ?? {}).map(([k, n]) => `${RES[k].name} ${amt(k, n, true)}`), ...Object.entries(a.sup ?? {}).map(([id, d]) => `${person(id).short} ${signed(d)}`)].join(", ") + ".";
// the month turns: a slim band across the stage while support drifts on the rows
function monthBand(title, sub, during, actLine = "") {
  const b = document.createElement("div");
  b.className = "mband"; b.setAttribute("role", "status"); b.tabIndex = -1;
  b.innerHTML = `<h3 class="t3 disp">${title}</h3><span class="t1">${sub}</span>${actLine ? `<p class="t1 mact">${actLine}</p>` : ""}`;
  $("#center").append(b); b.focus({ preventScroll: true });
  return new Promise((res) => {
    const tl = gsap.timeline({ onComplete: () => { b.remove(); res(); } });
    if (RM) tl.fromTo(b, { opacity: 0 }, { opacity: 1, duration: 0.12 }).add(during).to({}, { duration: 0.2 }).to(b, { opacity: 0, duration: 0.1 });
    else tl.fromTo(b, { clipPath: "inset(0 50% 0 50%)" }, { clipPath: "inset(0 0% 0 0%)", duration: 0.35, ease: "settle" })
      .add(() => tl.to({}, { duration: during() ?? 0.6 }).to(b, { opacity: 0, y: -10, duration: 0.25, ease: "swift" }), 0.2);
  });
}
async function endMonth() {
  if (st.phase !== "hand") return;
  st.phase = "month";
  emit("monthEnd");
  await window.tutorGate?.("monthEnd");
  ceremony(); moment("month"); pulse(null); tips.closeAll(); popout(null);
  const end = $("#end"); end.disabled = true;
  sfx.endMonth();
  const sup0 = { ...st.sup }, res0 = { ...st.res }, stand0 = standing(), m0 = G.month;
  const ev = E.endMonth(P, G); save(); logGame();
  fresh = new Set();
  showRest("filed"); document.body.classList.add("quiet");
  const acted = ev.filter((e) => e.t === "act").map((e) => person(e.holder)), intents = ev.filter((e) => e.t === "intent").map((e) => person(e.holder)), debt = ev.find((e) => e.t === "debt");
  const actLine = acted.map((h) => `<b>${h.short} acts.</b> ${h.act.text} ${actFx(h.act)}`).join(" ");
  // the beats in order: acts, then income, then drift row by row; the values come from the events as they happened
  const run = { ...sup0 }, beats = { act: [], drift: [], other: [] }, inc = {}, actRes = {};
  let inActs = true;
  for (const e of ev) {
    if (e.t === "move") { run[e.holder] += e.delta; beats[e.src === "act" ? "act" : e.src === "drift" ? "drift" : "other"].push([e.holder, run[e.holder]]); if (e.src === "drift") inActs = false; }
    if (e.t === "res") { const t = inActs && acted.length ? actRes : inc; t[e.kind] = (t[e.kind] ?? 0) + e.delta; }
  }
  const over = G.over, next = over ? null : monthLabel(G.month);
  const lastOf = (list) => [...new Map(list).entries()]; // the last value per holder, in first-seen order
  await monthBand(over ? (over.kind === "fallen" ? "The end" : "The Reckoning") : next, over ? reckDate() : `Month ${G.month} of ${W.months} · Reckoning ${reckDate()}`, () => {
    st.month = G.month; renderTop(); renderSeat(); drainHourglass(); slot($("#date"), monthLabel(st.month));
    clearMarks(); hush = true;
    // one beat at a time, each with at most one sound: acts, income, drift, then debt or the iron squeeze
    const STEP = 0.6, drift = ev.reduce((a, e) => a + (e.t === "move" && e.src === "drift" ? e.delta : 0), 0);
    let t = 0.5;
    const beat = (fn, sound) => { wait(t, () => { fn(); if (sound) sound(); }); t += STEP; };
    const act = lastOf(beats.act);
    if (act.length || Object.keys(actRes).length) beat(() => {
      let res = { ...res0 };
      for (const k of Object.keys(actRes)) setRes(k, (res[k] += actRes[k]), 0.8);
      act.forEach(([h, to], j) => react(h, to, j, `${acted.map((x) => x.short).join(", ")} acted.`));
      acted.forEach((h) => settleMood(h.id));
    }, () => { sfx.hit(1); kick(4); });
    const ik = Object.keys(inc).filter((k) => inc[k]);
    if (ik.length) beat(() => ik.forEach((k) => setRes(k, G.res[k], 1.1)), () => sfx.care(0));
    const order = $$(".fac").map((li) => li.dataset.id), dl = lastOf(beats.drift).sort((a, b) => order.indexOf(a[0]) - order.indexOf(b[0]));
    if (dl.length) beat(() => dl.forEach(([h, to], k) => wait(k * 0.06, () => {
      st.drift.add(h); react(h, to, k, "Drift toward its resting level.");
      const rst = $(`.fac[data-id="${h}"] .rst`);
      if (rst && !RM) gsap.fromTo(rst, { "--rk": 1 }, { "--rk": 1.7, duration: 0.25, yoyo: true, repeat: 1, ease: "settle" });
    })), () => Math.abs(drift) >= 1 && sfx.faction(drift));
    const other = lastOf(beats.other);
    if (other.length) beat(() => other.forEach(([h, to], k) => wait(k * 0.06, () => react(h, to, k, debt ? "The state is in debt." : "Iron rule squeezes the weak."))), () => sfx.faction(-8));
    wait(t, () => (hush = false));
    return t + 0.35;
  }, actLine);
  hush = false;
  reconcile();
  if (over) return reckoning();
  calm(); st.phase = "month-done"; moment("month-done"); renderHand();
  const F = FALLS(), names = (hs) => hs.map((h) => h.short).join(", "), many = (hs, one, more) => (hs.length > 1 ? more : one);
  const plotting = G.plotting.map(person), low = W.factions.filter((h) => G.support[h.id] < F + 5 && !G.plotting.includes(h.id)), nm = monthLabel(G.month, false);
  const warn = plotting.length ? `${names(plotting)} ${many(plotting, "is", "are")} plotting. Keep ${many(plotting, "it", "them")} at ${F} or more through ${nm}, or ${many(plotting, "it brings", "they bring")} you down.`
    : debt ? `${RES.money.name} is below 0: every faction lost ${T.debtFactionLoss}. ${T.debtFall - debt.months} more month end in debt and you fall.`
    : low.length ? `${names(low)} ${many(low, "is", "are")} close to ${F}. Under ${F} a faction acts and plots; still under ${F} a month later, it brings you down.`
    : intents.length ? `${names(intents)}: ${many(intents, "its demand comes", "their demands come")} as a card.` : "";
  const brief = plotting.length ? `${names(plotting)} plotting: keep ${many(plotting, "it", "them")} at ${F}+ through ${nm}.`
    : debt ? `In debt: every faction lost ${T.debtFactionLoss}.`
    : low.length ? `${names(low)} close to ${F}. Under ${F}, ${many(low, "it acts", "they act")}.`
    : intents.length ? `${names(intents)}: ${many(intents, "a demand", "demands")} next.` : "";
  st.recap = { next, inc: Object.entries(inc).filter(([, n]) => n), acted, warn, brief, sup0, res0, stand0, m0 };
  await window.tutorGate?.("recap");
  showRecap();
  if (plotting.length || debt || low.length) wait(0.6, () => sfx.heartbeat()); // the warning's own sound, with the warning
  $("#again").focus({ preventScroll: true }); slot($("#plays"), handHint());
  live(`Month ended. ${next}. Standing ${standing()}.`);
  coachMark("standing");
}

// the seal's standing arc, large: 0 at the left, 50 at the bottom notch, 100 at the right
const GAUGE_D = "M-1 0A1 1 0 0 0 1 0";
const BURST = `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2l2.2 6.1L20 5.6l-2.6 5.9L23 14l-6.2 1.3L17 22l-5-4.2L7 22l.2-6.7L1 14l5.6-2.5L4 5.6l5.8 2.5z"/></svg>`;
const gaugeHTML = (v0, v) => `<div class="gauge ${standBand(v)}" role="img" aria-label="Standing ${v}, was ${v0}. Your order needs ${T.bar} at the Reckoning.">
  <svg viewBox="-1.25 -.2 2.5 1.48" aria-hidden="true"><path class="trk" d="${GAUGE_D}" pathLength="100"/><path class="fill" d="${GAUGE_D}" pathLength="100" style="stroke-dasharray:${v0} 100"/>
  <path class="notch" d="M0 1.13-.09 1.29H.09Z"/><line class="was" x1="-.84" y1="0" x2="-1.16" y2="0" transform="rotate(${-v0 * 1.8})"/><g class="needle"><line x1="-.68" y1="0" x2="-1.12" y2="0"/><circle cx="-1" cy="0" r=".07"/></g></svg>
  <div class="gc"><b class="gn num">${v0}</b><span class="gd t1 num ${v > v0 ? "up" : v < v0 ? "down" : ""}">${v === v0 ? "" : `<span aria-hidden="true">${v > v0 ? "▲" : "▼"}</span>${Math.abs(v - v0)}`}</span></div><span class="g50 t1">${T.bar}</span></div>`;
function showRecap() {
  const { next, acted, brief, sup0, res0, stand0 } = st.recap, c = $("#center"), v = standing();
  const res = RK.map((k) => [k, Math.round((st.res[k] - res0[k]) * 10) / 10]).filter(([, n]) => n);
  const moved = PEOPLE.map((h) => [h, r(st.sup[h.id]) - r(sup0[h.id])]).filter(([, d]) => d).sort((x, y) => (x[1] > 0) - (y[1] > 0) || Math.abs(y[1]) - Math.abs(x[1]));
  const body = `${res.length ? `<div class="rcres">${res.map(([k, n]) => `<span class="rbig" data-role="${k}">${ico(k)}<b class="num">${amt(k, n, true)}</b><span class="sr">${RES[k].name}</span></span>`).join("")}</div>` : ""}
      ${moved.length ? `<ul class="rcmov">${moved.map(([h, d]) => { const act = acted.includes(h); return `<li class="${act ? "act" : ""}" data-tip="fac:${h.id}" tabindex="0" style="${isPat(h) ? "" : vars(lean(h))}" aria-label="${h.short}${act ? " acted" : ""}, ${signed(d)}">
        ${medHTML(h)}${act ? `<span class="burst">${BURST}</span>` : ""}<span class="rn">${h.short}</span><b class="num ${d > 0 ? "up" : "down"}"><span aria-hidden="true">${d > 0 ? "▲" : "▼"}</span>${Math.abs(d)}</b></li>`; }).join("")}</ul>` : ""}
      ${brief ? `<p class="warn t1">${brief}</p>` : ""}`;
  leave(c); c.insertAdjacentHTML("afterbegin", `<div class="rest side"><div class="endcard rc-a"><h3 class="t3 disp">${next}</h3>${gaugeHTML(stand0, v)}${body}
    <button class="primary t2 disp" id="again">Draw ${monthLabel(G.month, false)}'s card</button></div></div>`);
  const card = $(".endcard", c), g = $(".gauge", card);
  $$(".rcmov li", card).forEach((li) => settleRecapRing(li));
  gsap.fromTo(card, { opacity: 0, y: RM ? 0 : 20 }, { opacity: 1, y: 0, duration: D(0.5), ease: "settle", clearProps: "opacity,transform" });
  if (!RM) gsap.fromTo($$(".rbig, .rcmov li, .endcard > .warn", card), { opacity: 0, y: 8 }, { opacity: 1, y: 0, duration: 0.4, stagger: 0.05, delay: 0.2, ease: "settle", clearProps: "opacity,transform" });
  gsap.set($(".needle", g), { rotation: -stand0 * 1.8, svgOrigin: "0 0" });
  const go = { duration: D(1.1), delay: RM ? 0 : 0.35, ease: "settle" };
  gsap.to($(".needle", g), { rotation: -v * 1.8, svgOrigin: "0 0", ...go });
  gsap.to($(".fill", g), { strokeDasharray: `${v} 100`, ...go });
  const n = $(".gn", g), o = { v: stand0 }; gsap.to(o, { v, ...go, onUpdate: () => (n.textContent = r(o.v)) });
  if (!RM) gsap.fromTo($(".gd", g), { opacity: 0 }, { opacity: 1, duration: 0.4, delay: 1.3, ease: "soft", clearProps: "opacity" });
  $("#again").onclick = beginMonth;
  pulse($("#again"));
  emit("recap");
}
const settleRecapRing = (li) => li.querySelector(".arc")?.style.setProperty("stroke-dasharray", `${r(st.sup[li.getAttribute("data-tip").split(":")[1]])} 100`);
// the next month starts on the deck
function beginMonth() {
  if (st.phase !== "month-done") return;
  clearMarks(); document.body.classList.remove("quiet");
  const end = $("#end"); end.classList.remove("shown", "sec"); end.classList.add("primary");
  st.phase = "rest"; moment("rest"); renderHand(); showRest();
  $("#draw")?.focus({ preventScroll: true });
}

/* ---------- the Reckoning and the epilogue ---------- */
function ruleName() { // "<polity> under an iron <ruler>": your zone (or the nearest corner) and your grip
  const z = E.zone(P, G), id = z && z !== "centre" ? z : z === "centre" ? null : nearest();
  const ruler = id ? IDEO[id].ruler.replace(/^(a|an|the)\s+/i, "") : "pragmatist", gw = { iron: "iron", open: "open", middle: "steady" }[E.band(G.grip)];
  return `${W.polity} under ${/^[aeiou]/i.test(gw) ? "an" : "a"} ${gw} ${ruler}`;
}
async function reckoning() {
  if (st.kin || st.phase === "over") return;
  logGame(); audio();
  ceremony(); st.phase = "over"; moment("rest"); pulse(null); tips.closeAll(); popout(null); hideTour(false);
  const O = G.over, fallen = O.kind === "fallen", by = fallen && !["election", "debt"].includes(O.by) ? person(O.by) : null, lead = E.zone(P, G) in IDEO ? E.zone(P, G) : IDS.reduce((a, b) => (G.stacks[b] > G.stacks[a] ? b : a));
  sfx.endMonth();
  $("#end").disabled = true; $("#end").classList.remove("shown");
  await kinetic({ id: lead, style: "rise", lines: fallen ? [{ text: "You fall" }, { text: by ? by.short : O.by === "debt" ? "In debt" : "At the polls", cls: "alt" }] : [{ text: "The reckoning" }, { text: reckDate(), cls: "alt" }], hold: 2.0 });
  renderTop(); renderSeat(); $("#date").textContent = fallen ? monthLabel(O.month) : reckDate();
  const score = r(E.standing(P, G)), V = visionOf(), met = V ? E.pillars(P, G, V.id) : [];
  const outcome = { fulfilled: "Vision fulfilled", survived: "Survived", swept: "Swept away", fallen: by ? `Fallen to ${by.short}` : "Fallen" }[O.kind];
  const badge = O.kind === "fulfilled" && V && earn(WID, V.id, G.rules) ? `<p class="t1 badge">Badge earned: ${V.name}, ${presetOf(G.rules).replace(/^./, (c) => c.toUpperCase())}</p>` : "";
  const why = by ? by.fall : O.by === "debt" ? `${T.debtFall} month ends in a row in debt. The state cannot pay, and you fall.` : O.by === "election" ? `The vote went against you. Your standing was ${score}; you needed ${T.bar}.` : `Standing ${score}. Your order needs ${T.bar} to endure.`;
  const val = (p) => ({ stack: () => `${G.stacks[p.ideology]} filed`, zone: () => (E.zone(P, G) === p.zone ? "Inside" : "Outside"), grip: () => `Grip ${r(G.grip)}`, law: () => (G.laws.includes(p.id) ? "Enacted" : "Not enacted"), sup: () => `${r(G.support[p.holder])}`, res: () => amt(p.role, G.res[p.role]) })[p.kind]();
  const div = r(E.divergence(P, G) * 100);
  const yours = (c) => { const h = G.hist[c.id]; return !h ? "It never came." : !h.happened ? "It did not happen." : c.answers[h.chose].text; };
  const sameAs = (c) => G.hist[c.id]?.happened && G.hist[c.id].chose === c.historyAnswer;
  const when = (c) => (c.date ? dayLabel(c.date) : "");
  const pages = [
    `<span class="t1 soft">${fallen ? `${monthLabel(O.month)} · month ${O.month} of ${W.months}` : `The Reckoning · ${reckDate()}`}</span><h2 class="vout disp">${outcome}</h2>${badge}
      <p class="t2 disp vrule">${ruleName()}</p><p class="t1 soft vwhy">${why}</p>
      <h3 class="t1 vh">${V ? `Vision: ${V.name}` : "Free hand"}</h3>
      ${V ? `<ul class="vpl t1">${V.pillars.map((p, k) => `<li class="${met[k] ? "met" : "miss"}"><span class="vm" aria-hidden="true">${met[k] ? "✓" : "✕"}</span><span>${p.text}<span class="sr"> ${met[k] ? "met" : "missed"}</span></span><b class="num">${val(p)}</b></li>`).join("")}</ul>` : `<p class="t1 soft">You chose no Vision. Only your standing counted.</p>`}
      <p class="t1 vdiv">Your timeline left history at ${div}% of its turns.</p>`,
    `<h3 class="t1 vh">What became of them</h3><ul class="rx vfate">${PEOPLE.map((h) => `<li>${miniHTML(h)}<div class="t1"><b>${h.short} · ${r(G.support[h.id])}</b><span class="why">${h.fates[G.support[h.id] >= T.bar ? "hi" : "lo"]}</span></div></li>`).join("")}</ul>`,
    `<h3 class="t1 vh">In history, and in yours</h3><div class="vhist t1" role="table" aria-label="In history, and in yours"><div class="vhr vhh" role="row"><span role="columnheader">Card</span><span role="columnheader">In history</span><span role="columnheader">In yours</span></div>
      ${P.deck.history.map((c) => `<div class="vhr${sameAs(c) ? " same" : ""}" role="row"><span role="cell"><b data-tip="hist:${c.id}" tabindex="0">${c.title}</b><span class="soft"> ${when(c)}</span></span><span role="cell" class="soft">${c.answers[c.historyAnswer]?.text ?? ""}</span><span role="cell">${yours(c)}</span></div>`).join("")}</div>`,
  ];
  const NEXTL = ["What became of them", "In history, and in yours"];
  const v = document.createElement("section");
  v.className = "verdict reveal fin"; v.style.cssText = vars(lead); v.setAttribute("aria-label", "The epilogue");
  v.style.setProperty("--vt", `${$("#top").getBoundingClientRect().bottom + 12}px`);
  v.innerHTML = `<div class="sheet vsheet"><div class="vpages">${pages.map((h, k) => `<div class="vpage${k ? " vmore" : " vmain"}" data-p="${k}" ${k ? "hidden" : ""}>${h}</div>`).join("")}</div>
    <div class="vact"><button class="sbtn t1" id="vback" hidden>Back</button><button class="primary t2 disp" id="vnext">${NEXTL[0]}</button><button class="sbtn t1" id="playagain">Play again</button><button class="sbtn t1" id="worlds">Choose another world</button><span class="t1 soft vstep" aria-live="polite">1 of ${pages.length}</span></div></div>`;
  $("#stage").append(v);
  let page = 0;
  const show = (k) => {
    const old = $(`.vpage[data-p="${page}"]`, v), nw = $(`.vpage[data-p="${k}"]`, v);
    page = k; old.hidden = true; nw.hidden = false;
    gsap.fromTo(nw.children, { opacity: 0, y: RM ? 0 : 10 }, { opacity: 1, y: 0, duration: D(0.4), stagger: 0.05, ease: "settle", clearProps: "transform,opacity" });
    $("#vback", v).hidden = !k; $("#vnext", v).hidden = k === pages.length - 1; if (k < pages.length - 1) $("#vnext", v).textContent = NEXTL[k];
    $("#playagain", v).classList.toggle("primary", k === pages.length - 1); $("#playagain", v).classList.toggle("sbtn", k !== pages.length - 1);
    $(".vstep", v).textContent = `${k + 1} of ${pages.length}`;
    (k === pages.length - 1 ? $("#playagain", v) : $("#vnext", v)).focus({ preventScroll: true });
  };
  $("#vnext", v).onclick = () => show(page + 1);
  $("#vback", v).onclick = () => show(page - 1);
  $("#playagain", v).onclick = () => { store.del(SAVE); const q = new URLSearchParams(location.search); q.delete("seed"); q.delete("tutor"); location.search = q; };
  $("#worlds", v).onclick = () => (location.href = "/");
  v.addEventListener("keydown", (e) => {
    if (e.key === "ArrowRight" && page < pages.length - 1) show(page + 1);
    if (e.key === "ArrowLeft" && page > 0) show(page - 1);
    if (e.key !== "Tab") return;
    const f = $$("button:not([hidden]), a[href], [tabindex='0']", v).filter((x) => !x.closest("[hidden]")), i = f.indexOf(document.activeElement);
    if (e.shiftKey ? i <= 0 : i === f.length - 1) { e.preventDefault(); f.at(e.shiftKey ? -1 : 0).focus(); }
  });
  for (const el of $$("#top, #left, #center, #tableau, #right, .skiplink")) el.inert = true;
  if (RM) gsap.set(v, { clipPath: "none" });
  else {
    await new Promise((res) => gsap.fromTo(v, { clipPath: "circle(0% at 50% 50%)" }, { clipPath: "circle(75% at 50% 50%)", duration: 0.7, ease: "sweep", onComplete: res }));
    gsap.set(v, { clipPath: "none" });
    gsap.from($$(".vmain > *", v), { opacity: 0, y: 14, duration: 0.5, stagger: 0.06, ease: "settle", clearProps: "transform,opacity" });
  }
  bloom([v]); calm();
  $("#vnext", v).focus({ preventScroll: true });
  live(`${outcome}. ${ruleName()}. ${why}`);
}

/* ---------- the seat (compass, grip, Reckoning, Vision), picks and laws ---------- */
let hgR = null;
const hgY = (x) => [13 - 9.6 * x, 23 - 9 * (1 - x)];
function timeHTML() {
  const n = W.months, m = Math.min(st.month, n), left = Math.max(0, n - m), x = left / (n - 1);
  const [yt, yb] = hgY(hgR ?? x), q = (v) => v.toFixed(2);
  return `<button class="tchip hg" data-tip="kw:reckoning" aria-label="${left} months left. Month ${m} of ${n}. Reckoning ${reckDate()}"><svg viewBox="0 0 18 26" aria-hidden="true">
    <defs><clipPath id="hgT"><path d="M4 3C4 8.4 8.2 10.6 8.2 13h1.6C9.8 10.6 14 8.4 14 3z"/></clipPath><clipPath id="hgB"><path d="M8.2 13C8.2 15.4 4 17.6 4 23h10C14 17.6 9.8 15.4 9.8 13z"/></clipPath></defs>
    <rect class="sand st" clip-path="url(#hgT)" x="3" width="12" y="${q(yt)}" height="${q(13 - yt)}"/><rect class="sand sb" clip-path="url(#hgB)" x="3" width="12" y="${q(yb)}" height="${q(23 - yb)}"/>
    <line class="grain" x1="9" y1="13" x2="9" y2="22.6"/>
    <path class="glass" d="M2.6 2.2h12.8M2.6 23.8h12.8M4 3C4 8.4 8.2 10.6 8.2 13S4 17.6 4 23M14 3C14 8.4 9.8 10.6 9.8 13S14 17.6 14 23"/></svg><b class="num">${left}</b><span class="soft hgu">${left === 1 ? "month" : "months"}</span></button>`;
}
function drainHourglass() {
  const n = W.months, x = Math.max(0, n - Math.min(st.month, n)) / (n - 1), from = hgR ?? x;
  hgR = x;
  const svg = $(".tchip.hg svg"); if (!svg || from === x) return;
  const top = $(".st", svg), sb = $(".sb", svg), g = $(".grain", svg), o = { x: from };
  const draw = () => { const [yt, yb] = hgY(o.x); top.setAttribute("y", yt); top.setAttribute("height", 13 - yt); sb.setAttribute("y", yb); sb.setAttribute("height", 23 - yb); };
  if (RM) { o.x = x; draw(); return; }
  const c = svg.closest(".tchip"), nEl = $(".num", c), unit = $(".hgu", c), now = [nEl.textContent, unit.textContent];
  nEl.textContent = r(from * (n - 1)); unit.textContent = nEl.textContent === "1" ? "month" : "months";
  gsap.timeline()
    .add(() => c.classList.add("pour"), 0)
    .to(svg, { scale: 1.18, duration: 0.45, ease: "settle" }, 0)
    .to(g, { opacity: 1, strokeWidth: 1.5, duration: 0.3, ease: "soft" }, 0.1)
    .fromTo(g, { strokeDashoffset: 0 }, { strokeDashoffset: -12, duration: 1.4, ease: "soft" }, 0.1)
    .to(o, { x, duration: 1.2, ease: "settle", onUpdate: draw }, 0.2)
    .add(() => { slot(nEl, now[0]); slot(unit, now[1]); }, 0.75)
    .to(g, { opacity: 0, strokeWidth: 0.9, duration: 0.4, ease: "soft" }, 1.1)
    .to(svg, { scale: 1, duration: 0.6, ease: "settle", clearProps: "transform" }, 1.0)
    .add(() => c.classList.remove("pour"), 1.1);
  const tk = $(".sealring .mt.now");
  if (tk) gsap.from(tk, { opacity: 0, strokeWidth: 0.32, duration: 0.9, ease: "settle", delay: 0.3, clearProps: "opacity,strokeWidth" });
}
const reckHTML = () => `<span class="reck t1" data-tip="kw:reckoning"><span><span class="soft">Month</span> <b class="rleft num">${Math.min(st.month, W.months)} of ${W.months}</b></span><span class="soft dot"> · </span><span><span class="soft">Reckoning</span> <b class="rdate">${reckDate()}</b></span></span>`;
const visionHTML = () => { const v = vision(); return `<button class="vision t1" data-tip="vision" tabindex="-1"><span class="soft vk">Vision</span><b class="vn">${v ? v.name : "Free hand"}</b><span class="vp" aria-hidden="true"></span></button>`; };
const gripHTML = () => `<div class="gripd ${st.gripMoved ? "on" : ""}" data-tip="grip">${gripSVG()}<span class="t1 gl"><span class="soft">Grip</span> <b class="band">${band(st.grip)}</b> <b class="gv num">${r(st.grip)}</b></span></div>`;
function renderSeat() {
  $$("#seal").forEach((e) => e.remove());
  $(".where").insertAdjacentHTML("afterend", `<div id="seal"><div class="sl">${gripHTML()}${visionHTML()}</div><button class="sealb" data-tip="compass" data-tip-avoid aria-label="Your seat">${sealSVG()}</button><div class="sr2">${timeHTML()}</div></div>`);
  $$(".sealb, .vision").forEach((b) => (b.onclick = openSeat));
  if (hgR === null) hgR = Math.max(0, W.months - Math.min(st.month, W.months)) / (W.months - 1);
  refreshVision(); refreshStanding(); moveGrip(); if (!st.gripMoved) document.body.dataset.gripband = "";
  layoutHand(); fitTop();
}
// The top bar keeps the world's own names: it steps them down until nothing meets (the place stacks, resource names wrap, then go to their tooltips, then the Vision's name does)
function fitTop() {
  const t = $("#top"), edge = (sel, side) => { const bs = $$(sel).filter((e) => e.offsetWidth).map((e) => e.getBoundingClientRect()[side]); return side === "right" ? Math.max(...bs) : Math.min(...bs); };
  const ok = () => edge("#polity, #date", "right") + 12 <= edge("#seal .sl > *", "left") && edge("#seal .sr2 > *", "right") + 12 <= edge("#res .rc", "left");
  t.classList.remove("f1", "f2", "f3", "f4"); $("#polity").style.maxWidth = "";
  for (const f of ["f1", "f2", "f3", "f4"]) { if (ok()) break; t.classList.add(f); }
  if (!ok()) { const pl = $("#polity"); pl.title = W.polity; pl.style.maxWidth = `${Math.max(96, edge("#seal .sl > *", "left") - 12 - pl.getBoundingClientRect().left)}px`; } // last: the place name ends in an ellipsis, whole in its title
}
function shiftGrip(to) {
  const from = st.grip, first = !st.gripMoved;
  st.grip = to; st.gripMoved = true;
  moveGrip(from); refreshVision();
  if (first) fitTop();
  if (first && !RM) $$(".gripd").forEach((g) => gsap.from(g, { opacity: 0, scale: 0.8, duration: 0.6, ease: "settle", clearProps: "opacity,transform" }));
  live(`Grip ${r(st.grip)}: ${band(st.grip)}.`);
}
// The big view: the full compass with names, who holds you up, grip, the Reckoning, the Vision, and the rules and laws you hold.
function openSeat() {
  tips.closeAll();
  const d = $("#seatbig"), v = vision(), met = pillarsMet();
  const held = [...G.picked, ...G.laws].map((id) => E.handDef(P, id)).filter(Boolean);
  d.innerHTML = `<div class="sbody"><div class="sfig">${compassSVG(true)}<p class="t1 soft">The small circle in the centre is the middle way: a record balanced across the ideologies stands there.</p></div><div class="sside">
      <h2 class="t3 disp">Your seat</h2>
      <section class="scoal" aria-label="Who holds you up"><h3 class="t1 strong">Who holds you up</h3>${coalitionHTML(false)}</section>
      <p class="t1">You stand closest to <b>${IDEO[nearest()].name}</b>. ${closer(nearest())} A law can be enacted only from inside its ideology's zone.</p>
      <div class="sgrip">${gripHTML()}</div>
      <p class="t1">${reckHTML()}</p>
      <div class="svis">${v ? `<p class="t2 disp">${v.name}</p><p class="t1 soft">${v.line}</p><ul class="pl t1">${v.pillars.map((p, k) => `<li class="${met[k] ? "on" : ""}">${p.text}</li>`).join("")}</ul>` : `<p class="t2 disp">Free hand</p><p class="t1 soft">No aims to check. Only your standing counts at the Reckoning.</p>`}</div>
      ${held.length ? `<div class="svis"><p class="t1 strong">Your rules and laws</p><ul class="pl t1">${held.map((h) => `<li class="on"><b>${h.title}.</b> ${E.rulesLine(P, h)}</li>`).join("")}</ul></div>` : ""}
      <button class="primary t2 disp" id="sclose" autofocus>Back to the table</button></div></div>`;
  $(".sgrip .gripd", d).classList.add("on");
  d.showModal(); moveGrip();
  if (!st.gripMoved) document.body.dataset.gripband = "";
  $("#sclose").onclick = () => d.close();
  d.onclick = (e) => { if (e.target === d) d.close(); };
  if (!RM) gsap.from(".sbody", { opacity: 0, scale: 0.96, duration: 0.35, ease: "settle", clearProps: "opacity,transform" });
}
// Pick: the engine offers lasting rules face up on the stage; take one, or give it up.
function pickMoment(offer) {
  return new Promise((done) => {
    calm(); const was = st.phase; st.phase = "pick"; moment("pick"); tips.closeAll(); pulse(null);
    const key = offer.key, sid = key.startsWith("stack:") ? key.slice(6) : null, c = $("#center");
    const kicker = sid ? `${IDEO[sid].name} reached ${T.stack.pick} · your pick` : { iron: "Iron grip · your pick", open: "Open grip · your pick", centre: "The middle way · your pick" }[key];
    const opts = offer.ids.map((id) => E.handDef(P, id));
    const combo = (id) => { const k = P.deck.combos.find((x) => x.parts.includes(id)); const o = k && E.handDef(P, k.parts.find((x) => x !== id)); return o ? `Works with ${o.title}` : ""; };
    if (sid) sfx.passive(sid); else sfx.shimmer();
    leave(c); c.insertAdjacentHTML("afterbegin", `<div class="pick" style="${sid ? vars(sid) : ""}"><div class="phead"><span class="t1 kick">${kicker}</span><h3 class="t3 disp">Choose one lasting rule</h3></div>
      <div class="popts" data-rove=".popt">${opts.map((o, k) => `<button class="popt" data-k="${k}">${sid ? `<span class="art fin"></span>` : `<span class="art neutral">${NEUTRAL}</span>`}<span class="ti t2 disp">${o.title}</span><span class="fl t1 soft">${o.flavour}</span><span class="ru t1">${E.rulesLine(P, o)}</span>${combo(o.id) ? `<span class="combo t1">${combo(o.id)}</span>` : ""}</button>`).join("")}</div>
      <button class="skip t1">Skip: you give up this rule</button></div>`);
    const cards = $$(".popt", c);
    cards.forEach((b) => tactile(b)); rove($(".popts", c));
    if (!RM) gsap.from(cards, { y: 40, rotation: (k) => (k - 1) * 4, opacity: 0, duration: 0.6, stagger: 0.09, ease: "settle", clearProps: "transform,opacity" });
    cards[0]?.focus({ preventScroll: true });
    const finish = (o) => {
      const ev = E.takePick(P, G, o ? o.id : null); save();
      if (o) {
        if (sid) { const s = restack(sid); stackPulse(sid, true); bloom([$(".pc.fin", s)]); if (!RM) gsap.from($(".ruleseal", s), { scale: 2.4, opacity: 0, duration: 0.5, ease: "settle", clearProps: "opacity,transform" }); $(`.stack[data-id="${sid}"]`).focus({ preventScroll: true }); }
        live(`Rule taken: ${o.title}.`);
      } else live("You gave up this rule.");
      st.phase = was; showRest(was === "hand" || was === "playing" ? "hand" : "filed"); done(ev);
    };
    cards.forEach((b) => (b.onclick = () => {
      const o = opts[+b.dataset.k], tgt = sid ? $(`.stack[data-id="${sid}"] .pile`).getBoundingClientRect() : $(".sealb").getBoundingClientRect(), [tx, ty] = [tgt.right - 6, tgt.bottom - 6], [fx, fy] = wc(b);
      if (sid) sfx.stamp(sid); else sfx.shimmer();
      cards.forEach((x) => (x.disabled = true));
      if (RM) return finish(o);
      gsap.to(cards.filter((x) => x !== b), { opacity: 0, y: 30, duration: 0.3 });
      gsap.timeline({ onComplete: () => finish(o) }).to(b, { scale: 1.06, duration: 0.15 }).to(b, { x: tx - fx, y: ty - fy, scale: 0.2, opacity: 0.2, duration: 0.6, ease: "swift" });
    }));
    $(".skip", c).onclick = () => finish(null);
  });
}
// A law is enacted: its title stamps over the ideology's pattern, then its seal lands on the stack.
async function enactLaw(cardId) {
  const law = E.handDef(P, cardId), id = SRC[cardId], pile = id && $(`.stack[data-id="${id}"] .pile`), [x, y] = pile ? wc(pile) : [innerWidth / 2, innerHeight / 2];
  sfx.unlock(id ?? IDS[0]); const was = cer; ceremony();
  await kinetic({ id: id ?? null, style: "slide", kicker: `${id ? IDEO[id].name : "The middle way"} · law enacted`, lines: twoLines(law.title).map((t, k) => ({ text: t, cls: `mid ${k % 2 ? "alt" : ""}` })),
    from: [innerWidth / 2, innerHeight / 2], to: [x, y], hold: 1.05 });
  if (id) { const s = restack(id); stackPulse(id, true); const seal = $(".lawseal", s); if (!RM && seal) gsap.from(seal, { scale: 2.4, opacity: 0, duration: 0.5, ease: "settle", clearProps: "opacity,transform" }); bloom([seal]); }
  refreshVision(); if (!was) calm();
  live(`Law enacted: ${law.title}.`);
}

/* ---------- sound ---------- */
let audioOn = false;
function audio() { if (audioOn) return; audioOn = true; hallInit({ id: WID }, PACK.music, null); }

/* ---------- start, resume, the walkthrough's hooks ---------- */
let PACK;
function syncView() {
  st = { held: { ...G.stacks }, sup: { ...G.support }, last: {}, res: { ...G.res }, grip: G.grip, month: G.month, phase: st?.phase === "idle" ? "idle" : "rest", kin: false, muted: st?.muted ?? false, sel: null, marks: {}, endArmed: false, gripMoved: G.grip !== W.grip, hand: [], drift: new Set(), skipHinted: st?.skipHinted };
  window.__game = st;
}
function renderAll() {
  hgR = null;
  renderTop(); $("#date").textContent = monthLabel(st.month);
  renderPeople(); renderTableau(); renderHand(); renderSeat();
  field.setWeights(st.held, true); moveMarker(false);
}
// open the term where the engine stands
function resume() {
  for (const el of $$("[inert]")) if (el.closest("#stage") || el.matches(".skiplink")) el.inert = false;
  $(".verdict")?.remove();
  const end = $("#end"); end.disabled = true; end.classList.remove("shown", "sec");
  if (G.phase === "answer") return showCard(G.card, false);
  if (G.phase === "pick") return pickMoment(G.offer).then(unlocksAndPicks).then(() => { reconcile(); toHand(); });
  if (G.phase === "play") return toHand();
  if (G.phase === "over") return reckoning();
  st.phase = "rest"; moment("rest"); showRest();
}
function firstTerm() { const t = Q.get("tutor"); return t === "1" || (t !== "0" && store.get(TUTOR_DONE) !== "1"); }
function tutor() {
  tourOn = false;
  startTutor({ playsLeft: () => playsLeft(), phase: () => st.phase, onDone: () => { store.set(TUTOR_DONE, "1"); store.set(TOUR_KEY, "done"); } });
}
// the walkthrough starts a term without a reload: rules is a preset name or a Rules object, vision an id or null (Free hand)
function newTerm(o = {}) {
  if (!P) throw new Error("the world is not loaded yet");
  G = freshState({ rules: o.rules, vision: o.vision ?? null, seed: o.seed }); save(); played();
  st.phase = "rest"; syncView(); renderAll();
  $("#stage").inert = false; dimBoard(false);
  if (firstTerm()) tutor();
  resume();
}

// the library's "most played" counts terms started, not page loads
const played = () => { markPlayed(WID); fetch(`/api/worlds/${encodeURIComponent(WID)}/play`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ preset: TERM.preset }) }).catch(() => {}); };
async function boot() {
  try { const res = await fetch(`/api/worlds/${encodeURIComponent(WID)}`); if (!res.ok) throw new Error(res.status); PACK = await res.json(); }
  catch { $("#center").innerHTML = `<div class="plate"><p class="t2 disp">This world did not load.</p><p class="t1">Reload the page to try again, or go back to the world list.</p></div>`; return; }
  P = { world: PACK.world, deck: PACK.deck }; W = P.world; SK = PACK.skin; RES = W.resources;
  IDS = W.compass; root.style.setProperty("--n", IDS.length); IDEO = Object.fromEntries(W.ideologies.map((x) => [x.id, x])); PEOPLE = [...W.factions, ...W.patrons];
  for (const id of IDS) { const d = P.deck.ideologies[id]; for (const c of [d.power, d.law, ...d.picks]) SRC[c.id] = id; }
  document.title = `${W.title} · Siyasa`;
  // the skin: palette and display face (skin.js), body face, pattern tiles and their motifs, the finish
  skinApi = await applySkin(SK);
  root.style.setProperty("--fb", `"${SK.fonts.body}"`); loadFont(SK.fonts.body);
  for (const id of IDS) {
    const p = pal(id), t = skinApi.tile(id);
    root.style.setProperty(`--${id}-a`, p.a); root.style.setProperty(`--${id}-b`, p.b); root.style.setProperty(`--${id}-c`, p.c);
    root.style.setProperty(`--tile-${id}`, `url("${t.url}")`);
    root.style.setProperty(`--tm-${id}`, `url("${dataURL(colorize(motif(render(skI(id).recipe).svg), p))}")`);
  }
  root.dataset.finish = "gold-leaf"; root.style.setProperty("--fi", SK.finish?.intensity ?? 0.5);
  glOn = !RM && FIN.start();

  const saved = loadSave(), forced = Q.get("tutor") === "1";
  if (WALK && saved) { WALK = false; history.replaceState(null, "", location.pathname + location.search.replace(/[?&]walk=1/, "").replace(/^&/, "?")); } // a term in progress opens where it stands; the briefing waits for the next one
  if (forced) store.del(SAVE);
  G = WALK ? freshState() : (!forced && saved) || freshState();
  if (!WALK && (forced || !saved)) played();
  st = { phase: WALK ? "idle" : "rest" }; syncView();
  window.board = { pack: PACK, walking: () => WALK, newTerm, spot: spotlight, dim: dimBoard, phase: () => st.phase, playsLeft, state: () => G };
  initSeatState();
  tips = makeTips(resolveTip);
  field = makeField($("#field"), IDS, (id) => dataURL(colorize(renderMedallion(skI(id).recipe, { periods: 1.2 }).svg, pal(id))));
  leversFrom(() => E.levers(P, G));
  renderAll();
  await document.fonts.ready; layoutHand();
  await field.init(st.held); field.start();
  addEventListener("resize", () => { field.onResize(); layoutHand(); fitTop(); if (st.phase === "card") fitCard($(".card")); });
  wireKeys(); wireSettings();
  const ch = () => { if (!$("#center > h2.sr")) $("#center").insertAdjacentHTML("afterbegin", `<h2 class="sr" id="center-h">This month</h2>`); };
  new MutationObserver(ch).observe($("#center"), { childList: true }); ch();
  if (!RM) gsap.from(["#top", "#left > *", "#hand", ".stack"], { opacity: 0, y: 14, duration: 0.8, stagger: 0.06, ease: "settle", clearProps: "opacity,transform" });
  if (WALK) { moment("rest"); showRest(); $("#stage").inert = true; dimBoard(true); return; }
  const fresh0 = G.month === 1 && G.phase === "draw" && !G.seen.length;
  if (fresh0 && firstTerm()) tutor();
  else tourOn = Q.get("tour") === "1" || (Q.get("tour") !== "0" && store.get(TOUR_KEY) !== "done");
  resume();
}
// seat.js reads the live view object through this getter, so a new term's view is seen at once
function initSeatState() { initSeat({ P, get st() { return st; }, vs: () => ({ ...G, stacks: st.held, grip: st.grip, support: st.sup, res: st.res }), IDEO, vision: visionOf, lean }); }

function wireKeys() {
  $("#hand").addEventListener("keydown", (e) => {
    const k = { ArrowDown: 1, ArrowRight: 1, ArrowUp: -1, ArrowLeft: -1 }[e.key], items = $$("#hand .hc"), j = items.indexOf(document.activeElement);
    if (!k || (j < 0 && document.activeElement !== $("#hand"))) return;
    e.preventDefault(); items[j < 0 ? 0 : (j + k + items.length) % items.length].focus();
  });
  const mx = gsap.quickTo(root, "--mx", { duration: 0.8, ease: "power3.out" }), my = gsap.quickTo(root, "--my", { duration: 0.8, ease: "power3.out" });
  addEventListener("pointermove", (e) => { mx(e.clientX / innerWidth); my(e.clientY / innerHeight); });
  addEventListener("pointerdown", () => audio(), { once: true, capture: true });
  addEventListener("keydown", (e) => {
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    if (e.target.closest?.("#settings")) return;
    if (st.phase === "idle") return;
    if (e.key === "m" || e.key === "M") { audio(); st.muted = toggleMute(); $("#mute").checked = st.muted; tips.refresh(); return; }
    if (e.key === " " && (cer || st.kin)) { e.preventDefault(); skipAll() || skipKin(); return; }
    if (st.kin) return;
    if (e.key === "c" || e.key === "C") $("#seatbig").open ? $("#seatbig").close() : openSeat();
    if (e.key === "o" || e.key === "O") { const sp2 = $("#settings"); sp2.togglePopover(); if (sp2.matches(":popover-open")) $("#vol-music").focus(); }
    if (/^[1-9]$/.test(e.key) && st.phase === "card") select(+e.key - 1);
    // Enter is the moment's main action, unless focus is already on a control that Enter presses
    if (e.key === "Enter" && !e.target.closest?.("button, a, input, summary, [role=button]")) {
      e.preventDefault();
      if (st.phase === "rest") $("#draw")?.click();
      else if (st.phase === "card" && st.sel != null) answer(st.sel);
      else if (st.phase === "revealed") $(".reveal .go")?.click();
      else if (st.phase === "hand") { $("#end").focus(); live("End month? Press Enter on End month."); }
      else if (st.phase === "month-done") $("#again")?.click();
    }
    if (e.key === "Escape") { if (tourOpen()) endTour(); else if (st.phase === "pick") $(".pick .skip")?.click(); else if (!unselect()) cancelTarget(); }
  });
  $("#kin").addEventListener("click", skipKin);
  // a click anywhere during a ceremony skips it (settings and the tutorial stay usable)
  document.addEventListener("click", (e) => { if (cer && !e.target.closest?.("#settings, .keys, #tourmark, #tutor")) skipAll(); }, true);
  $("#end").onclick = askEnd;
  document.addEventListener("keydown", (e) => {
    const box = e.target.closest?.("[data-rove]"), d = { ArrowDown: 1, ArrowRight: 1, ArrowUp: -1, ArrowLeft: -1 }[e.key];
    if (!box || !d || box.closest("#hand")) return;
    const items = $$(box.dataset.rove, box), j = items.indexOf(e.target); if (j < 0) return;
    e.preventDefault(); const n = (j + d + items.length) % items.length;
    items.forEach((x) => (x.tabIndex = -1)); items[n].tabIndex = 0; items[n].focus();
  });
  $(".skiplink").onclick = (e) => { e.preventDefault(); ($("#draw") || $(".ans:not(:disabled)") || $(".reveal .go") || $("#vnext") || $("#again") || $("#hand button.hc:not([aria-disabled])") || $("#end:not(:disabled)"))?.focus(); };
}

// Settings: one gear in the top bar opens a native popover under it.
function wireSettings() {
  const pop = $("#settings"), gear = $(".keys"), status = $(".sstatus", pop), confirm = $(".sconfirm", pop);
  const say = (t) => { status.textContent = t; };
  const place = () => { const b = gear.getBoundingClientRect(); pop.style.top = `${b.bottom + 10}px`; pop.style.left = `${Math.max(16, b.right - pop.offsetWidth)}px`; };
  addEventListener("resize", () => pop.matches(":popover-open") && place());
  let swallow = false;
  document.addEventListener("pointerdown", (e) => { swallow = pop.matches(":popover-open") && !pop.contains(e.target) && !gear.contains(e.target); }, true);
  document.addEventListener("click", (e) => { if (swallow) { swallow = false; e.stopPropagation(); e.preventDefault(); } }, true);
  pop.addEventListener("toggle", (e) => { if (e.newState !== "open") return; tips.closeAll(); place(); $("#mute").checked = !!st.muted; confirm.hidden = true; say(""); });
  for (const k of ["music", "sfx"]) {
    const el = $(`#vol-${k}`), v = store.get(`vol-${k}`);
    if (v != null) el.value = v;
    el.addEventListener("input", () => { audio(); setVolume(k, +el.value); store.set(`vol-${k}`, el.value); });
  }
  $("#mute").addEventListener("change", () => { audio(); if ($("#mute").checked !== !!st.muted) st.muted = toggleMute(); });
  $("#quit").onclick = () => { say("Saved."); location.href = "/"; };
  // New term and Abandon ask once before they end this term
  let pending = null;
  const ask = (text, yes, fn) => { pending = fn; $("p", confirm).textContent = text; $("#confirm-yes").textContent = yes; confirm.hidden = false; $("#confirm-no").focus(); };
  $("#newterm").onclick = () => ask("Start a new term? This one ends now and is not scored.", "New term", () => { store.del(SAVE); const q = new URLSearchParams(location.search); q.delete("seed"); q.delete("tutor"); location.search = q; });
  $("#abandon").onclick = () => ask("Abandon this term? It ends now and is not scored.", "Abandon", () => { store.del(SAVE); location.href = "/"; });
  $("#confirm-yes").onclick = () => pending?.();
  $("#confirm-no").onclick = () => { confirm.hidden = true; pending = null; };
  $("#replay-tour").onclick = () => { store.del(SAVE); location.search = `?w=${encodeURIComponent(WID)}&tutor=1`; };
  const showSpeed = () => { for (const [id, q] of [["#speed-full", false], ["#speed-quick", true]]) { const b = $(id); b.classList.toggle("on", (SPEED > 1) === q); b.setAttribute("aria-pressed", (SPEED > 1) === q); } };
  for (const [id, q] of [["#speed-full", false], ["#speed-quick", true]]) $(id).onclick = () => { SPEED = q ? 2.5 : 1; store.set("usoj-speed", q ? "quick" : "full"); showSpeed(); };
  showSpeed();
}

boot();
