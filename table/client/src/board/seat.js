// Your seat: the compass marker comes from the record (engine geometry); grip, the Reckoning and the Vision sit beside it.
import { gsap, RM } from "../shared/motion.js";
import * as E from "../../../engine/index.ts";

let C, uid = 0;
const f = (n) => (+n).toFixed(3);
const $$ = (s) => [...document.querySelectorAll(s)];

// ctx: { P, st, vs: () => view state for engine geometry, IDEO, vision: () => Vision | null }
export function initSeat(ctx) { C = ctx; }
const vs = (held) => (held ? { ...C.vs(), stacks: held } : C.vs());
const corners = () => E.corners(C.P);
const order = () => C.P.world.compass;
export const mixPt = (h) => E.point(C.P, h.mix);
export const marker = (held) => E.marker(C.P, vs(held));
export const restOf = (id) => Math.round(E.resting(C.P, vs(), id));
export const inZone = (id) => E.zone(C.P, vs()) === id;
const away = (id) => Math.hypot(marker()[0] - corners()[id][0], marker()[1] - corners()[id][1]);
// how many more answers of one ideology would put you inside its zone (null: none within 60)
export function needFor(id) { const h = C.st.held; for (let n = 0; n <= 60; n++) if (E.zone(C.P, vs({ ...h, [id]: h[id] + n })) === id) return n; return null; }
export const nearest = () => order().reduce((a, b) => (away(b) < away(a) ? b : a));
export const band = (g) => ({ iron: "Iron rule", open: "Open rule", middle: "Middle" })[E.band(g)];
export const monthsLeft = () => C.P.world.months - C.st.month;
export const standing = (sup = C.st.sup) => Math.round(E.standing(C.P, { support: sup }));
export const standBand = (v) => (v >= E.TUNE.bar + 5 ? "safe" : v >= E.TUNE.bar ? "close" : "below");
const W = (f) => f.power ?? 1;
export const vision = () => C.vision();
export const pillarsMet = () => (vision() ? E.pillars(C.P, vs(), vision().id) : []);
export const pillarMet = (k) => !!pillarsMet()[k];

// who holds you up: one bar per faction, thicker when it counts more, filled to its support; the line is 50
export function coalitionHTML(compact) {
  const { P, st } = C, fs = [...P.world.factions].sort((a, b) => W(b) - W(a) || st.sup[b.id] - st.sup[a.id]), v = standing(), bar = E.TUNE.bar;
  const rows = fs.map((h) => { const id = C.lean(h);
    return `<li class="crow${st.sup[h.id] < bar ? " under" : ""}" style="--t:var(--tile-${id});--ia:var(--${id}-a);--w:${W(h)};--s:${Math.round(st.sup[h.id])}" ${compact ? "" : `data-tip="fac:${h.id}"`}>
      <span class="cmed"></span><span class="cnm t1">${h.short}</span><span class="cb"><i></i></span><b class="cv t1 num">${Math.round(st.sup[h.id])}</b><span class="cw t1 soft">×${W(h)}</span></li>`; }).join("");
  const top = fs.reduce((a, h) => (W(h) * st.sup[h.id] > W(a) * st.sup[a.id] ? h : a));
  return `<div class="coal${compact ? " cmpct" : ""}" role="img" aria-label="Standing ${v}. ${fs.map((h) => `${h.short} ${Math.round(st.sup[h.id])}, weight ${W(h)}`).join("; ")}.">
    ${compact ? "" : `<div class="chead"><b class="t3 disp num" data-band="${standBand(v)}">${v}</b><span class="t1">Standing. You need ${bar} at the Reckoning.</span></div>`}
    <ul class="crows" aria-hidden="true">${rows}</ul>
    <p class="t1 soft cleg">Thicker bars count more. Past the line at ${bar}, a faction holds you up. ${top.short} carries you most.</p></div>`;
}

/* ---------- drawings ---------- */
export function compassSVG(big) {
  const P = corners(), ids = order(), id0 = `cz${uid++}`, poly = ids.map((id) => P[id].map(f).join(",")).join(" "), [mx, my] = marker(), Z = E.TUNE.cornerZone;
  const zones = ids.map((id) => `<circle cx="${f(P[id][0])}" cy="${f(P[id][1])}" r="${Z}" style="fill:var(--${id}-a)"/>`).join("");
  const dots = ids.map((id) => `<circle class="cn" cx="${f(P[id][0])}" cy="${f(P[id][1])}" r="${big ? 0.075 : 0.14}" style="fill:var(--${id}-a)"/>`).join("");
  let extra = "";
  if (big) {
    const FS = 0.092, boxes = [], fac = C.P.world.factions, nodes = [...ids.map((id) => P[id]), ...fac.map(mixPt)];
    const box = (x, y, txt, anchor, fs) => { const w = txt.length * 0.6 * fs, x0 = anchor === "start" ? x : anchor === "end" ? x - w : x - w / 2; return [x0 - 0.02, y - fs * 1.05, x0 + w + 0.02, y + fs * 0.4]; };
    const hits = (b, own) => boxes.some((o) => b[0] < o[2] && b[2] > o[0] && b[1] < o[3] && b[3] > o[1]) || nodes.some((n) => n !== own && n[0] > b[0] - 0.03 && n[0] < b[2] + 0.03 && n[1] > b[1] - 0.03 && n[1] < b[3] + 0.03);
    // try the label beside its point, then step it up or down until it is clear
    const place = (px, py, txt, anchor, dx, fs, own) => {
      for (const dy of [0, 0.11, -0.11, 0.22, -0.22, 0.33, -0.33, 0.44]) { const b = box(px + dx, py + dy, txt, anchor, fs); if (!hits(b, own)) { boxes.push(b); return dy; } }
      boxes.push(box(px + dx, py, txt, anchor, fs)); return 0;
    };
    extra += ids.map((id) => {
      const [x, y] = P[id], a = x > 0.2 ? "start" : x < -0.2 ? "end" : "middle", tx = x + (x > 0.2 ? 0.13 : x < -0.2 ? -0.13 : 0), ty = y + (y < -0.5 ? -0.15 : 0.04);
      boxes.push(box(tx, ty, C.IDEO[id].name, a, 0.11));
      return `<text class="cl" x="${f(tx)}" y="${f(ty)}" text-anchor="${a}" style="fill:var(--${id}-c)">${C.IDEO[id].name}</text>`;
    }).join("");
    extra += fac.map((h, k) => {
      const pt0 = nodes[ids.length + k], [x, y] = pt0, r = Math.abs(x) > 0.6 ? x < 0 : x >= 0; // near the ring, the label turns inward
      const dx = r ? 0.07 : -0.07, dy = place(x, y + 0.03, h.short, r ? "start" : "end", dx, FS, pt0);
      const lead = dy ? `<line class="ld" x1="${f(x)}" y1="${f(y)}" x2="${f(x + dx * 0.8)}" y2="${f(y + dy)}"/>` : "";
      return `<g class="pp">${lead}<circle cx="${f(x)}" cy="${f(y)}" r=".04"/><text x="${f(x + dx)}" y="${f(y + 0.03 + dy)}" text-anchor="${r ? "start" : "end"}">${h.short}</text></g>`;
    }).join("");
    // patrons sit on an outer ring, toward the corners they favour
    extra += C.P.world.patrons.map((h) => {
      const [x, y] = mixPt(h), a = Math.atan2(y, x), px = 1.32 * Math.cos(a), py = 1.32 * Math.sin(a), r = px >= 0;
      const dy = place(px, py + 0.03, h.short, r ? "start" : "end", r ? 0.09 : -0.09, FS, null);
      return `<g class="pp pat"><rect x="${f(px - 0.04)}" y="${f(py - 0.04)}" width=".08" height=".08" transform="rotate(45 ${f(px)} ${f(py)})"/><text x="${f(px + (r ? 0.09 : -0.09))}" y="${f(py + 0.03 + dy)}" text-anchor="${r ? "start" : "end"}">${h.short}</text></g>`;
    }).join("");
  }
  return `<svg class="cmp${big ? " big" : ""}" viewBox="${big ? "-2.08 -1.48 4.16 2.96" : "-1.16 -1.16 2.32 2.32"}" aria-hidden="true">
    <defs><clipPath id="${id0}"><polygon points="${poly}"/></clipPath></defs>
    ${big ? `<circle class="ring" r="1.32"/>` : ""}<polygon class="pg" points="${poly}"/>
    <g class="zn" clip-path="url(#${id0})">${zones}<circle class="ctr" r="${E.TUNE.centreZone}"/></g>
    ${dots}${extra}<g class="mk" transform="translate(${f(mx)} ${f(my)})"><circle class="halo" r="${big ? 0.13 : 0.26}"/><circle class="dot" r="${big ? 0.065 : 0.13}"/></g></svg>`;
}
const pt = (t) => [-Math.cos((Math.PI * t) / 100), -Math.sin((Math.PI * t) / 100)];
const arc = (a, b) => `M${pt(a).map(f).join(" ")} A1 1 0 0 1 ${pt(b).map(f).join(" ")}`;
export function gripSVG() {
  const o = E.TUNE.openAt, i = E.TUNE.ironAt;
  return `<svg class="gdial" viewBox="-1.22 -1.2 2.44 1.36" aria-hidden="true"><path class="b open" d="${arc(0, o - 1)}"/><path class="b mid" d="${arc(o + 1, i - 1)}"/><path class="b iron" d="${arc(i + 1, 100)}"/>
    <g class="ndl" transform="rotate(${f(C.st.grip * 1.8)})"><line x1="0" y1="0" x2="-.78" y2="0"/></g><circle class="hub" r=".11"/></svg>`;
}
// the seal: the compass inside a ring of the term's months, the standing gauge on its lower rim
export function sealSVG() {
  const n = C.P.world.months, ticks = Array.from({ length: n }, (_, i) => {
    const a = -Math.PI / 2 + ((i + 0.5) * 2 * Math.PI) / n, cls = i + 1 < C.st.month ? "done" : i + 1 === C.st.month ? "now" : i === n - 1 ? "rk" : "";
    return `<line class="mt ${cls}" x1="${f(1.3 * Math.cos(a))}" y1="${f(1.3 * Math.sin(a))}" x2="${f(1.48 * Math.cos(a))}" y2="${f(1.48 * Math.sin(a))}"/>`;
  }).join("");
  const v = standing();
  const ring = `<path class="sg trk" d="M-1.53 0 A1.53 1.53 0 0 0 1.53 0" pathLength="100"/><path class="sg fill" d="M-1.53 0 A1.53 1.53 0 0 0 1.53 0" pathLength="100" style="stroke-dasharray:${v} 100"/><line class="notch" x1="0" y1="1.42" x2="0" y2="1.62"/>`;
  const ra = -Math.PI / 2 + ((n - 0.5) * 2 * Math.PI) / n, rx = 1.39 * Math.cos(ra), ry = 1.39 * Math.sin(ra);
  const rk = `<rect class="rkm" x="-.13" y="-.13" width=".26" height=".26" transform="translate(${f(rx)} ${f(ry)}) rotate(45)"/>`;
  return `<svg class="sealring" viewBox="-1.6 -1.6 3.2 3.2" aria-hidden="true"><circle class="disc" r="1.58"/>${ticks}${rk}${ring}</svg>${compassSVG(false)}<span class="standn num" aria-hidden="true">${v}</span>`;
}
export function refreshStanding() {
  const v = standing(), b = standBand(v);
  document.body.dataset.stand = b;
  for (const el of $$(".sealb")) {
    el.setAttribute("aria-label", `Your seat. Standing ${v}: your order endures at the Reckoning at ${E.TUNE.bar} or more.`);
    const n = el.querySelector(".standn");
    if (n) { n._t?.kill(); const o = { v: +n.textContent || v }; n._t = gsap.to(o, { v, duration: RM ? 0.01 : 0.7, ease: "settle", onUpdate: () => (n.textContent = Math.round(o.v)) }); }
    el.querySelector(".sg.fill")?.style.setProperty("stroke-dasharray", `${v} 100`);
  }
}

/* ---------- live updates ---------- */
export function moveMarker(animate) {
  const [x, y] = marker();
  for (const g of $$(".cmp .mk")) {
    const m = /translate\(([-\d.]+) ([-\d.]+)\)/.exec(g.getAttribute("transform")), o = { x: +m[1], y: +m[2] };
    if (!animate || RM) { g.setAttribute("transform", `translate(${f(x)} ${f(y)})`); continue; }
    gsap.to(o, { x, y, duration: 1.4, ease: "sweep", onUpdate: () => g.setAttribute("transform", `translate(${f(o.x)} ${f(o.y)})`) });
    gsap.fromTo(g.querySelector(".halo"), { attr: { r: g.closest(".big") ? 0.13 : 0.26 } }, { attr: { r: g.closest(".big") ? 0.24 : 0.5 }, duration: 0.7, yoyo: true, repeat: 1, ease: "settle" });
  }
  for (const li of $$("#factions .fac, #patrons .fac")) li.style.setProperty("--rest", restOf(li.dataset.id));
}
export function moveGrip(from) {
  const g = C.st.grip;
  for (const el of $$(".gripd")) {
    if (C.st.gripMoved || el.closest("dialog")) el.classList.add("on");
    el.querySelector(".band").textContent = band(g);
    el.dataset.band = E.band(g);
    const ndl = el.querySelector(".ndl"), o = { v: from ?? g }, gv = el.querySelector(".gv");
    if (RM || from == null) { ndl.setAttribute("transform", `rotate(${f(g * 1.8)})`); gv.textContent = Math.round(g); continue; }
    gsap.to(o, { v: g, duration: 0.9, ease: "settle", onUpdate: () => { ndl.setAttribute("transform", `rotate(${f(o.v * 1.8)})`); gv.textContent = Math.round(o.v); } });
  }
  document.body.dataset.gripband = E.band(g);
}
export function refreshVision() {
  const v = vision(); if (!v) return;
  const met = pillarsMet(), n = met.filter(Boolean).length;
  for (const el of $$(".vp")) el.innerHTML = met.map((m) => `<i class="${m ? "on" : ""}"></i>`).join("");
  for (const el of $$(".vision")) el.setAttribute("aria-label", `Vision, ${v.name}: ${n} of ${met.length} goals met`);
}
