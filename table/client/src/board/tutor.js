// The guided first month: one step per moment, its target lit, the rest dimmed and inert.
// Also the spotlight API for the walkthrough: spot(selector | null), dim(on), or postMessage({ spot, dim }).
import { place } from "./tip.js";
import { gsap } from "../shared/motion.js";
import { TUNE } from "../../../engine/index.ts";

const RM = matchMedia("(prefers-reduced-motion: reduce)").matches;
// the guided month plays slower: the board multiplies its gsap clock by this; a Continue waits READ ms so the line gets read
const PACE = 0.67, READ = 1200;
let B = { playsLeft: () => 0, phase: () => "", onDone: () => {} };
const plays = () => B.playsLeft();
// the answer's ideology, read off the reveal the board just showed
const revealed = () => { const el = document.querySelector(".reveal .iname"); return { name: el?.textContent ?? "", id: el?.dataset.id }; };
// lit: one hole per selector (a selector list unions into one hole); live: what stays clickable (default: all lit);
// at: what the line sits beside; show / done: the moments that bring and end the step; ready: the target is complete
const STEPS = [
  { lit: ["#draw, #center .coach", ".sealb"], live: "#draw", at: "#draw, #center .coach", done: "draw", prefer: ["below", "right", "left"],
    text: () => `Keep your standing at 50 or more until the Reckoning. Draw this month's card.` },
  { lit: [".card"], show: "answers", doneIf: () => find(".card .ans.sel").length, prefer: ["below", "right", "left"], text: "Read the question, then choose an answer." },
  { lit: [".card .answers"], ready: () => find(".card .ans.sel").length, focus: ".card .ans.sel", done: "decided", prefer: ["below", "right", "left"], text: "Press your answer again to decide. You cannot undo it." },
  { lit: [".reveal .head, .reveal .rx", "#left"], at: ".card", show: "reveal", next: "Next", prefer: ["below", "right", "left"], text: "Read each reason. Their support moved on the left." },
  { lit: () => [".reveal .go", `.stack[data-id="${revealed().id}"]`], live: ".reveal .go", at: ".reveal .go", done: "filed", prefer: ["left", "above", "below"],
    text: () => `File it under ${revealed().name}. Three cards in one ideology unlock a power card.` },
  { lit: ["#hand li"], focus: "#hand", show: "hand", done: "played", prefer: ["below", "left"], text: `Play up to ${TUNE.plays} cards from your hand. Each costs what it shows.` },
  { lit: ["#end"], show: "hand", done: "monthEnd", prefer: ["left", "above"],
    text: () => (document.querySelector("#end .endq") ? `You have ${plays()} play${plays() > 1 ? "s" : ""} left. Press End month again to end it.` : "End the month. You get your income, and support drifts.") },
  { lit: [".endcard > :not(#again)"], at: ".endcard", show: "recap", next: "Finish", prefer: ["below", "right", "left"], text: "This is your month. At the Reckoning, your standing must be 50 or more." },
];
// moments inside a step that wait on the player or show a gain: lit without a number
const ASIDE = {
  target: { lit: ["#factions"], prefer: ["right", "below"], text: "Choose the faction you want to talk to." },
  pick: { lit: [".pick"], prefer: ["above", "below", "right"], text: "Choose one lasting rule, or skip it for now." },
};
// before each ceremony the game pauses on one line that says what comes; it plays after Continue (app.js awaits tutorGate)
let filed = {}; // the ideology the answer files under, read at the File gate while the reveal still names it
const GATE = {
  reveal: { lit: [".card"], prefer: ["below", "right", "left"], text: "Each faction now reacts to your answer, with its reason." },
  file: { lit: () => [".card", `.stack[data-id="${filed.id}"]`], at: ".reveal .go", prefer: ["left", "above", "below"], text: () => `Your answer goes into your record under ${filed.name}.` },
  unlock: { lit: () => [`.stack[data-id="${filed.id}"]`], prefer: ["above", "right", "left"], text: () => `${filed.name} now has three cards, so you unlock a power card.` },
  monthEnd: { lit: ["#left"], prefer: ["right", "below"], text: "The month ends. You get your income, and support drifts back toward where it rests." },
  recap: { lit: ["#center"], prefer: ["right", "left", "below"], text: "Here is what changed this month." },
};
const MOCK_KEYS = new Set("co"); // the seat (C) and settings (O) stay shut while the tutorial runs
const PAD = 12, FOCUSABLE = "button:not(:disabled), a[href], input, [tabindex]:not([tabindex='-1'])";

const $ = (s, r = document) => r.querySelector(s);
const find = (sel) => { try { return [...document.querySelectorAll(sel)].filter((e) => !e.closest(".leaving, .out") && e.getClientRects().length); } catch { return []; } };
const val = (v) => (typeof v === "function" ? v() : v);
const focusIn = (els) => els.map((e) => (e.matches(FOCUSABLE) ? e : $(FOCUSABLE, e))).find(Boolean);

const css = `
#tutor .tdim { position: fixed; inset: 0; width: 100%; height: 100%; z-index: 3; pointer-events: none; opacity: 0; }
#tutor .veil { fill: color-mix(in oklab, var(--ground) 40%, #000); fill-opacity: .72; }
#tutor .tline, #tutor .tend { position: fixed; z-index: 7; left: 0; top: 0; display: flex; align-items: center; gap: .75rem; white-space: nowrap; border-radius: 12px;
  background: var(--panel2); color: var(--ink); opacity: 0; visibility: hidden; box-shadow: 0 0 0 1.5px color-mix(in oklab, var(--accent) 55%, transparent), 0 6px 8px -4px rgb(0 0 0 / .6); }
#tutor .tline { max-width: calc(100vw - 32px); padding: .55rem 1rem; }
#tutor .tline:has(.tnext:not([hidden])) { padding-right: .6rem; }
#tutor .tend { padding: .7rem 1.4rem; }
#tutor .tn { color: var(--accent); font-weight: 600; font-variant-numeric: tabular-nums; }
#tutor .tt { font-weight: 600; }
#tutor .tk { color: var(--ink2); }
#tutor .tk kbd { margin-right: .3rem; }
#tutor .tnext { min-height: 2.25rem; padding: .3rem .9rem; border-radius: 8px; background: var(--accent); color: var(--ground); font-weight: 700; }
/* the read time: Continue fills softly, then takes a press */
#tutor .tnext[aria-disabled] { cursor: default; animation: tfill ${READ}ms linear both;
  background: linear-gradient(var(--accent), var(--accent)) left / 0% 100% no-repeat, color-mix(in oklab, var(--accent) 40%, var(--panel2)); }
@keyframes tfill { to { background-size: 100% 100%, auto; } }
@media (prefers-reduced-motion: reduce) { #tutor .tnext[aria-disabled] { animation: none; } }
#tutor .tskip { position: fixed; z-index: 7; min-height: max(1.8rem, 26px); padding: 0 .85rem; border-radius: 8px; background: var(--panel); color: var(--ink); font-weight: 600;
  box-shadow: inset 0 0 0 1px color-mix(in oklab, var(--ink) 35%, transparent); transition: background .18s var(--ease-soft), box-shadow .18s var(--ease-soft); }
#tutor .tskip:hover { background: color-mix(in oklab, var(--panel) 75%, var(--ink)); box-shadow: inset 0 0 0 1px color-mix(in oklab, var(--ink) 60%, transparent); }
body[data-tutor] :is(#plays, #vtag) { visibility: hidden; } /* the skip sits where the hand's hint was; the mock keys are off */
`;

const root = document.createElement("div");
root.id = "tutor";
const holeG = (k) => `<g class="h${k}"${k ? ' opacity="0"' : ""}>${'<rect fill="#000" filter="url(#tsoft)" width="0" height="0"/>'.repeat(3)}</g>`;
root.innerHTML = `<style>${css}</style>
<svg class="tdim" aria-hidden="true"><defs><filter id="tsoft" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="6"/></filter>
<mask id="tmask" maskUnits="userSpaceOnUse" x="0" y="0" width="100%" height="100%"><rect width="100%" height="100%" fill="#fff"/>${holeG(0)}${holeG(1)}</mask></defs>
<rect class="veil" width="100%" height="100%" mask="url(#tmask)"/></svg>
<p class="tline" id="tutor-line" role="status"><span class="tn t1"></span><span class="tt t2"></span><span class="tk t1" hidden><kbd>Esc</kbd>skips</span><button class="tnext t1" hidden></button></p>
<button class="tskip t1" hidden data-tip-avoid>Skip the tutorial</button>
<p class="tend t2 disp" aria-live="polite"></p>`;
document.body.append(root);
const svg = $(".tdim", root), line = $(".tline", root), skip = $(".tskip", root), nextB = $(".tnext", root), endEl = $(".tend", root), escHint = $(".tk", root);

/* ---------- the spotlight: soft-edged holes that ease between targets ---------- */
const layers = [0, 1].map((k) => ({ g: $(`.h${k}`, root), rects: [...root.querySelectorAll(`.h${k} rect`)], sels: null, key: "", from: null, t: 1, shown: [] }));
let cur = 0, dimOn = false, looping = false;
const rectOf = (els) => {
  if (!els.length) return null;
  const rs = els.map((e) => e.getBoundingClientRect()), x = Math.min(...rs.map((r) => r.left)) - PAD, y = Math.min(...rs.map((r) => r.top)) - PAD;
  return { x, y, w: Math.max(...rs.map((r) => r.right)) + PAD - x, h: Math.max(...rs.map((r) => r.bottom)) + PAD - y };
};
const union = (rs) => { const x = Math.min(...rs.map((r) => r.x)), y = Math.min(...rs.map((r) => r.y)); return { x, y, w: Math.max(...rs.map((r) => r.x + r.w)) - x, h: Math.max(...rs.map((r) => r.y + r.h)) - y }; };
const mix = (a, b, t) => ({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t, w: a.w + (b.w - a.w) * t, h: a.h + (b.h - a.h) * t });
function spot(sels) {
  const a = layers[cur], key = sels?.join("|") ?? "";
  if (key === a.key) return;
  if (!sels) { a.key = ""; gsap.to(a.g, { opacity: 0, duration: 0.3, ease: "soft", onComplete: () => { if (!a.key) a.sels = null; } }); return; }
  if (!a.sels || !dimOn) { gsap.killTweensOf(a); Object.assign(a, { sels, key, from: null, t: 1, shown: [] }); gsap.set(a.g, { opacity: 1 }); return; } // nothing lit: appear in place
  if (RM) { // reduced motion: the old holes fade out while the new ones fade in where they belong
    const b = layers[1 - cur]; Object.assign(b, { sels, key, from: null, t: 1, shown: [] });
    a.key = ""; gsap.to(a.g, { opacity: 0, duration: 0.3, ease: "soft", onComplete: () => { if (!a.key) a.sels = null; } });
    gsap.fromTo(b.g, { opacity: 0 }, { opacity: 1, duration: 0.3, ease: "soft" });
    cur = 1 - cur; return;
  }
  Object.assign(a, { sels, key, from: a.shown.length ? a.shown : null, t: 0 });
  gsap.to(a, { t: 1, duration: 0.5, ease: "swift", overwrite: true });
}
function dim(on) {
  if (on === dimOn) return;
  dimOn = on; loop();
  gsap.to(svg, { opacity: on ? 1 : 0, duration: RM ? 0.3 : 0.4, ease: "soft", overwrite: true });
}
function drawLayer(L) {
  if (!L.sels) return;
  const live = L.sels.map((s, k) => rectOf(find(s)) || L.shown[k]), moving = L.from && L.t < 1;
  if (live.some((r) => !r)) return;
  // a hole that splits or merges travels from (or into) the nearest one of the other set
  const n = moving ? Math.max(live.length, L.from.length) : live.length;
  L.shown = Array.from({ length: n }, (_, k) => { const to = live[Math.min(k, live.length - 1)]; return moving ? mix(L.from[k] || union(L.from), to, L.t) : to; });
  L.rects.forEach((el, k) => {
    const r = L.shown[k] || { x: 0, y: 0, w: 0, h: 0 };
    for (const [a, v] of Object.entries({ x: r.x, y: r.y, width: r.w, height: r.h, rx: Math.min(16, r.h / 2) })) el.setAttribute(a, v.toFixed(1));
  });
  if (!moving) L.shown = L.shown.slice(0, live.length);
}

/* ---------- the instruction line: beside the target, never over it ---------- */
let want = null, shownKey = null, lineNow = null, still = 0, lastR = null, described = [], readT = 0;
const fadeLine = (d, cb) => gsap.to(line, { opacity: 0, duration: d, ease: "soft", overwrite: true, onComplete: () => { line.style.visibility = "hidden"; cb?.(); } });
function setLine(now) {
  if (now.key === shownKey || now.key === want?.key) return;
  want = now; still = 0;
  if (line.style.visibility === "visible") fadeLine(0.15);
}
function hideLine() { want = null; shownKey = null; lineNow = null; fadeLine(0.2); }
function fill(s) {
  $(".tn", line).textContent = s.n ? `${s.n} of ${STEPS.length}` : ""; $(".tn", line).hidden = !s.n;
  $(".tt", line).textContent = s.text;
  escHint.hidden = !(s.n && !s.next && canSkip());
  nextB.hidden = !s.next; nextB.textContent = s.next || "";
  clearTimeout(readT); nextB.setAttribute("aria-disabled", "true"); readT = setTimeout(() => nextB.removeAttribute("aria-disabled"), READ);
}
function putLine(r, anchorEl, prefer) {
  // place() keeps 8 px off the edges and 10 px off the anchor; a box 8 px larger on each side makes that 16 and 18
  const box = { style: {}, getBoundingClientRect: () => { const b = line.getBoundingClientRect(); return { width: b.width + 16, height: b.height + 16 }; } };
  place(box, { getBoundingClientRect: () => ({ left: r.x, top: r.y, right: r.x + r.w, bottom: r.y + r.h, width: r.w, height: r.h }), closest: (q) => anchorEl.closest(q) }, null, prefer);
  line.style.left = `${parseFloat(box.style.left) + 8}px`; line.style.top = `${parseFloat(box.style.top) + 8}px`;
}
function describe(els) { // the lit controls name the line as their description
  for (const e of described) e.removeAttribute("aria-describedby");
  described = els.filter((e) => !e.hasAttribute("aria-describedby")); for (const e of described) e.setAttribute("aria-describedby", "tutor-line");
}

function frame() {
  layers.forEach(drawLayer);
  // the line waits until its target stops moving (a card still flipping in), then follows it
  const ls = want || lineNow, anchor = ls ? find(ls.at) : [], r = rectOf(anchor);
  if (r) {
    const same = lastR && Math.abs(r.x - lastR.x) + Math.abs(r.y - lastR.y) + Math.abs(r.w - lastR.w) + Math.abs(r.h - lastR.h) < 1;
    still = same ? still + 1 : 0; lastR = r;
    if (want && still >= 6 && layers[cur].t >= 1) {
      const s = want; want = null; shownKey = s.key; lineNow = s;
      fill(s); line.style.visibility = "visible"; putLine(r, anchor[0], s.prefer);
      gsap.fromTo(line, { opacity: 0, y: RM ? 0 : 4 }, { opacity: 1, y: 0, duration: RM ? 0.3 : 0.28, ease: "settle", overwrite: true });
      const liveEls = find(s.live), lost = document.activeElement === document.body || document.activeElement?.closest("[inert]");
      describe(liveEls.map((e) => (e.matches(FOCUSABLE) ? e : $(FOCUSABLE, e) || e)));
      const f = s.next ? nextB : s.focus ? $(s.focus) : lost ? focusIn(liveEls) : null;
      if (f && f !== document.activeElement) f.focus({ preventScroll: true });
    } else if (!want && lineNow && !same) putLine(r, anchor[0], lineNow.prefer);
  }
  if (dimOn || layers.some((L) => L.t < 1) || want || lineNow) requestAnimationFrame(frame); else looping = false;
}
function loop() { if (!looping) { looping = true; requestAnimationFrame(frame); } }

/* ---------- inert: everything except the live target, the tutor and the live region ---------- */
const mine = new Set();
function inertBut(targets) { // null: nothing inert
  const keep = new Set([root, $("#live"), $("#tips")]), want = new Set();
  const walk = (node) => { for (const c of node.children) { if (keep.has(c) || targets.includes(c) || c.tagName === "SCRIPT") continue; if (targets.some((t) => c.contains(t))) walk(c); else want.add(c); } };
  if (targets) walk(document.body);
  for (const el of mine) if (!want.has(el)) { el.inert = false; mine.delete(el); }
  for (const el of want) if (!el.inert) { el.inert = true; mine.add(el); }
}

/* ---------- the guided month ---------- */
let running = false, i = 0, last = "", seen = new Set(), raf = 0, gate = null;
// the board is still: no finite gsap tween or CSS animation runs (endless loops, pointer followers and the tutor's own are not motion to wait on)
const ours = (x) => layers.includes(x) || (x instanceof Element && root.contains(x));
const busy = () => gsap.globalTimeline.getChildren(true, true, false).some((t) => !t.paused() && !t.vars.paused && t.totalProgress() < 1 && t.repeat() !== -1 && !t.targets().some(ours))
  || document.getAnimations().some((a) => a.playState === "running" && a.effect?.getComputedTiming().endTime !== Infinity && !ours(a.effect.target));
const schedule = () => { if (!raf) raf = requestAnimationFrame(sync); };
// a step with its words and selectors worked out from the board as it is now
function resolve(s, extra) {
  const lit = val(s.lit), live = s.live || lit.join(", ");
  return { ...s, ...extra, lit, live, at: s.at || lit.join(", "), text: val(s.text) };
}
const showable = (s, seenNow) => (!s.show || seenNow.has(s.show)) && (!s.ready || s.ready()) && find(resolve(s).live).length > 0;
function advance() { i++; seen = new Set([last]); if (i >= STEPS.length) finish(true); }
// Esc skips a step only where the month can go on without it: a reading step, or one whose next step is already there
const canSkip = () => !!STEPS[i] && (!!STEPS[i].next || (!!STEPS[i + 1] && showable(STEPS[i + 1], new Set([last]))));

function sync() {
  raf = 0;
  if (!running) return;
  while (STEPS[i]?.doneIf?.()) advance();
  if (!running) return;
  const ph = B.phase(), s = STEPS[i], aside = ASIDE[ph] && find(ASIDE[ph].lit.join(", ")).length ? ASIDE[ph] : null;
  const now = gate ? resolve({ ...GATE[gate.name], live: "#tutor .tnext", next: "Continue" }, { key: `gate-${gate.name}` })
    : aside ? resolve(aside, { key: `aside-${ph}` }) : s && showable(s, seen) ? resolve(s, { n: i + 1 }) : null;
  if (now && !aside && !gate) now.key = `step-${i}-${now.text}`;
  // one thing at a time: a new line, and its light, wait until the board is still
  if (now && now.key !== shownKey && busy()) { if (shownKey) hideLine(); schedule(); return; }
  root.dataset.n = now?.n || ""; root.dataset.sel = now?.live || ""; root.dataset.gate = gate?.name || "";
  if (now) { spot(now.lit); dim(true); setLine(now); inertBut(find(now.live)); }
  else {
    dim(false); inertBut([]); // a ceremony runs: the board stays shut and unlit, the line is gone, and a click still skips it
    if (shownKey) hideLine();
  }
  loop();
}
const stepVisible = () => !!root.dataset.n; // a numbered step; Esc in an aside goes to the board (cancel the target, skip the pick)

// top right, where the hand's hint sits (hidden while the tutor runs); #right does not move in the board's entrance
function putSkip() {
  const r = $("#right")?.getBoundingClientRect(), hh = $("#hand .hh"); if (!r || !hh) return;
  skip.style.top = `${Math.round(r.top + (hh.offsetHeight - skip.offsetHeight) / 2)}px`; skip.style.left = `${Math.round(r.right - 4 - skip.offsetWidth)}px`;
}

// Continue at a gate: the line and the dim leave first, then the ceremony plays
function release() {
  const g = gate; if (!g) return;
  gate = null; root.dataset.gate = ""; hideLine(); dim(false); inertBut([]);
  gsap.delayedCall(0.22, g.res);
}
function press() {
  if (nextB.hasAttribute("aria-disabled")) return;
  if (gate) release(); else if (STEPS[i]?.next && stepVisible()) { advance(); schedule(); }
}

function finish(done) {
  const lastLive = find(root.dataset.sel || "#none");
  running = false;
  gate?.res(); gate = null; root.dataset.gate = "";
  if (window.TUTOR_PACE) { delete window.TUTOR_PACE; const g = gsap.globalTimeline; g.timeScale(g.timeScale() / PACE); } // back to the player's speed
  delete document.body.dataset.tutor; root.dataset.n = ""; root.dataset.sel = ""; delete window.tutorGate; B.onDone();
  inertBut(null); dim(false); spot(null); hideLine(); describe([]);
  gsap.to(skip, { opacity: 0, duration: 0.25, ease: "soft", onComplete: () => (skip.hidden = true) });
  // focus lands on what the player does next
  (focusIn(lastLive.filter((e) => !e.closest(".endcard"))) || $("#again") || $("#draw") || $("#end:not(:disabled)") || $("#hand"))?.focus({ preventScroll: true });
  if (!done) return;
  endEl.textContent = "You have the seat. The rest of the term is yours.";
  endEl.style.visibility = "visible";
  // clear of the recap and the record: in the gap between them if it fits, else in the empty room under the hand
  const ec = $(".endcard")?.getBoundingClientRect(), tb = $("#tableau")?.getBoundingClientRect(), h = endEl.offsetHeight;
  if (ec && tb && tb.top - ec.bottom >= h + 12) Object.assign(endEl.style, { left: `${ec.left + ec.width / 2}px`, top: `${(ec.bottom + tb.top) / 2}px` });
  else {
    const rt = $("#right").getBoundingClientRect(), lo = Math.max(...find("#hand li").map((e) => e.getBoundingClientRect().bottom), rt.top), hi = $("#end").getBoundingClientRect().top;
    Object.assign(endEl.style, { whiteSpace: "normal", textWrap: "balance", textAlign: "center", width: `${rt.width}px`, left: `${rt.left + rt.width / 2}px`, top: `${(lo + hi) / 2}px` });
  }
  gsap.fromTo(endEl, { opacity: 0, xPercent: -50, yPercent: -50, y: RM ? 0 : 6 }, { opacity: 1, y: 0, duration: RM ? 0.3 : 0.45, ease: "settle" });
  const out = () => { removeEventListener("pointerdown", out, true); removeEventListener("keydown", out, true); clearTimeout(t); gsap.to(endEl, { opacity: 0, duration: RM ? 0.3 : 0.6, ease: "soft", onComplete: () => (endEl.style.visibility = "hidden") }); };
  const t = setTimeout(out, 3000);
  addEventListener("pointerdown", out, true); addEventListener("keydown", out, true);
}

// board: { playsLeft(), phase(), onDone() }
export function startTutor(board) {
  if (running) return;
  B = board; running = true; i = 0; last = ""; seen = new Set(); gate = null;
  window.TUTOR_PACE = PACE; gsap.globalTimeline.timeScale(PACE);
  document.body.dataset.tutor = "1"; gsap.set(skip, { opacity: 1 });
  skip.hidden = false; putSkip(); document.fonts?.ready.then(putSkip);
  window.tutorGate = (name) => (running && GATE[name] ? new Promise((res) => { if (name === "file") filed = revealed(); gate = { name, res }; schedule(); }) : undefined);
  wire();
  inertBut([]); // the board boots under the tutor; the first step lights once the Draw button is there
  schedule();
}
let wired = false;
function wire() {
  if (wired) return; wired = true;
  addEventListener("resize", putSkip);
  skip.onclick = () => finish(false);
  nextB.onclick = press;
  document.addEventListener("moment", (e) => {
    if (!running) return;
    const n = e.detail.name; last = n; seen.add(n);
    const j = STEPS.findIndex((s, k) => k >= i && s.done === n);
    if (j >= 0) { i = j; advance(); }
    schedule();
  });
  // the board changes under a step (an answer selected, End month armed, a pick opens): look again
  new MutationObserver(schedule).observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ["class"] });
  // inert stops clicks, not document key listeners: the board keys stay off while the tutorial runs
  addEventListener("keydown", (e) => {
    if (!running || e.metaKey || e.ctrlKey || e.altKey) return;
    // at a gate the game is paused: Enter, Space and Esc continue; Tab still moves to Skip; nothing reaches the board
    if (gate && e.key !== "Tab") { e.preventDefault(); e.stopImmediatePropagation(); if (["Enter", " ", "Escape"].includes(e.key) && !e.repeat) press(); return; }
    if (e.key === "Escape" && stepVisible()) { e.preventDefault(); e.stopImmediatePropagation(); if (canSkip()) STEPS[i].next ? nextB.click() : (advance(), schedule()); return; }
    // Enter from the page is the board's "main action", which would press a dimmed control (File, Draw next month): on a Next step it means Next
    if (e.key === "Enter" && STEPS[i]?.next && stepVisible() && (e.target === document.body || e.target.closest?.("[inert]"))) { e.preventDefault(); e.stopImmediatePropagation(); nextB.click(); return; }
    if (MOCK_KEYS.has(e.key.toLowerCase())) { e.preventDefault(); e.stopImmediatePropagation(); }
  }, true);
}
// the walkthrough's spotlight on the board's named areas
export function spotlight(sel) { spot(sel ? [sel] : null); if (sel) dim(true); loop(); }
export function dimBoard(on) { dim(!!on); loop(); }

addEventListener("message", (e) => {
  if (e.origin !== location.origin || !e.data || typeof e.data !== "object" || !("spot" in e.data || "dim" in e.data)) return;
  if ("spot" in e.data) spot(typeof e.data.spot === "string" ? [e.data.spot] : null);
  if (e.data.dim === false) dim(false); else if (e.data.dim === true || typeof e.data.spot === "string") dim(true);
  loop();
});
