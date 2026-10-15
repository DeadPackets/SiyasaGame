import { setPalette, loadFont } from "../shared/skin.js";
import { gsap, RM } from "../shared/motion.js";
import { colorize } from "../patterns/engine.js";
import emblem from "../patterns/emblem.js";
import { $, $$, esc, ARROW, MONTH, and, playURL, pal, medData, tile, face, json } from "./common.js";

const ID = new URLSearchParams(location.search).get("b") || "";
const TARGET = 300; // s: the product target, about 5 minutes from the prompt to a world
const BEAT = 1.2; // s: the least time one visual beat holds the stage
const POLL = 1500;
const root = document.documentElement, stage = $("#stage");
const fade = (els, d = 0.4) => gsap.fromTo(els, { opacity: 0 }, { opacity: 1, duration: d, ease: "soft" });
const wait = (s) => new Promise((r) => setTimeout(r, s * 1000));
// the skin's type pair in words a player knows (skin.fonts.pair); any other pair falls back to the face's own name
const LETTERS = { kufi: "Kufic letters", naskh: "Naskh letters", inscribed: "carved Roman letters", poster: "poster letters", civic: "plain civic letters", orbital: "wide machine letters", techno: "machine letters", blackletter: "blackletter", earlyprint: "early print letters", victorian: "Victorian letters", typewriter: "typewriter letters", severe: "tall poster letters", rounded: "rounded letters", mincho: "Mincho letters", hellenic: "Greek-style letters", hanzi: "Chinese brush letters", didone: "Didone letters", deco: "Art Deco letters" };
const STEPS = [["world", "The world"], ["skin", "Its look"], ["music", "Its music"], ["rules", "Its laws and powers"], ["month1", "Month 1"], ["deck", "The full deck"]];

// ---------- the facts: each part of the build status adds its own ----------
const F = { prompt: "", ideos: [], facs: [] };
let saved = null;
try { saved = JSON.parse(sessionStorage.getItem(`siyasa-build-${ID}`) || "null"); } catch {}
F.prompt = saved?.prompt || "";
let started = saved?.at || Date.now();

function frame(p) {
  Object.assign(F, { title: p.title, date: MONTH(p.date), polity: p.polity, office: p.office?.title || "", months: p.months });
  F.ideos = p.ideologies.map((x) => ({ id: x.id, name: x.name, power: x.power ?? 1 }));
  F.facs = p.factions.map((x) => ({ id: x.id, name: x.short }));
}
function skin(s) {
  F.skin = s;
  const sk = Object.fromEntries(s.ideologies.map((x) => [x.id, x])), byF = Object.fromEntries([...(s.factions || []), ...(s.patrons || [])].map((f) => [f.id, f]));
  F.ideos = F.ideos.filter((x) => sk[x.id]).map((x) => ({ ...x, sk: sk[x.id] }));
  F.face = face(F.ideos.map((x) => x.sk));
  // a faction wears the pattern of the ideology whose colour it carries; patrons without one take the ideologies in turn
  F.facs.forEach((f, i) => { const b = byF[f.id]; f.lean = s.ideologies.find((x) => b?.accent && x.a === b.accent) || s.ideologies[i % s.ideologies.length]; f.emblem = b?.emblem; });
  F.look = `${LETTERS[s.fonts.pair] ?? `${s.fonts.display} letters`}${s.house?.families?.length ? `, ${and(s.house.families)} patterns` : ""}${s.finish?.type ? `, ${s.finish.type.replace(/-/g, " ")}` : ""}`;
  loadFont(s.fonts.display); // fetched now so the face is ready when its beat comes
}
function music(m) {
  const E = m.ensemble || {};
  F.music = m;
  F.tune = { title: m.title || "its theme", by: and([E.lead?.sound, E.section, ...(E.bed || [])].filter(Boolean).map((x) => x.replace(/_/g, " "))), bpm: m.bpm || 90 };
}

// ---------- shared parts ----------
const rowsHTML = () => STEPS.map(([step, label]) => `<li class="row" data-step="${step}"><span class="mk" aria-hidden="true"></span><span class="lab t1">${label}</span><div class="val t1"></div></li>`).join("");
const headHTML = () => `
  <p class="ask t1"${F.prompt ? "" : " data-wait"}>You asked for <q id="asked">${esc(F.prompt)}</q></p>
  <p class="dateline t1" data-wait><span id="when"></span><span class="dot" aria-hidden="true"></span><span id="where"></span></p>
  <h1 class="title disp" id="title"><span class="sr">${esc(F.prompt || "Your world")}</span><span class="typed idle" aria-hidden="true">${esc(F.prompt || "Your world")}</span></h1>
  <p class="office t1" data-wait></p>
  <p class="now t1" id="now"><span class="pip" aria-hidden="true"></span><span id="nowt"></span></p>`;
const goHTML = () => `<div class="go" id="go" data-state="off"><p class="goline t1" id="goline"></p><a class="begin t1" id="begin" href="/"><span class="fill" aria-hidden="true"></span><span class="bl">Begin the briefing</span>${ARROW}</a></div>`;
const row = (step) => $(`.row[data-step="${step}"]`);

// screen reader lines wait their turn: each one stays at least 1.1 s
const sayQ = [];
let sayT = 0;
const sayNext = () => { const t = sayQ.shift(); if (t == null) { sayT = 0; return; } $("#live").textContent = t; sayT = setTimeout(sayNext, 1100); };
const say = (t) => { sayQ.push(t); if (!sayT) sayNext(); };

// what Siyasa is doing now, in plain words
function now(text, anim) {
  const el = $("#nowt"), box = $("#now");
  if (el.textContent === text) return;
  const swap = () => { el.textContent = text; box.classList.toggle("gone", !text); };
  if (!anim || !el.textContent) return swap();
  gsap.timeline().to(el, { opacity: 0, duration: 0.2, ease: "soft" }).call(swap).to(el, { opacity: 1, duration: 0.3, ease: "soft" });
}
function running(steps) { for (const s of steps) { const r = row(s); if (!r.classList.contains("done")) r.classList.add("run"); } }
// a part arrives: its line writes in from the left and its mark is stamped
function arrive(step, html, anim) {
  const r = row(step), val = $(".val", r), mk = $(".mk", r);
  r.classList.remove("run"); r.classList.add("done");
  if (html != null) val.innerHTML = html;
  if (!anim) return val;
  if (RM) { fade(html != null ? [val, mk] : mk); return val; }
  if (html != null) wipeIn(val);
  gsap.fromTo(mk, { scale: 1.9, opacity: 0 }, { scale: 1, opacity: 1, duration: 0.55, ease: "settle", clearProps: "transform" });
  return val;
}
const wipeIn = (el) => (RM ? fade(el) : gsap.fromTo(el, { clipPath: "inset(-20% 100% -20% 0)" }, { clipPath: "inset(-20% -4% -20% 0)", duration: 0.9, ease: "settle", clearProps: "clipPath" }));
function roll(el, to, anim) {
  if (!el) return;
  const from = +el.textContent || 0;
  if (!anim || RM || from === to) { el.textContent = to; return; }
  const o = { v: from };
  gsap.to(o, { v: to, duration: 1.1, ease: "settle", onUpdate: () => (el.textContent = Math.round(o.v)) });
}
function typeTitle(anim) {
  const el = $("#title .typed"), txt = F.title;
  $("#title .sr").textContent = txt;
  const done = () => { el.textContent = txt; el.classList.remove("idle", "typing"); gsap.set(el, { opacity: 1 }); };
  if (!anim) return done();
  if (RM) return gsap.timeline().to(el, { opacity: 0, duration: 0.2, ease: "soft" }).call(done).to(el, { opacity: 1, duration: 0.3, ease: "soft" });
  const o = { n: 0 };
  gsap.timeline()
    .to(el, { opacity: 0, duration: 0.2, ease: "soft" })
    .call(() => { el.textContent = ""; el.classList.remove("idle"); el.classList.add("typing"); gsap.set(el, { opacity: 1 }); })
    .to(o, { n: txt.length, duration: Math.min(0.9, txt.length * 0.03), ease: "soft", onUpdate: () => (el.textContent = txt.slice(0, Math.round(o.n))) })
    .call(done);
}
function reveal(els, anim) {
  els.forEach((el) => el.removeAttribute("data-wait"));
  if (anim) RM ? fade(els) : gsap.fromTo(els, { opacity: 0, y: 8 }, { opacity: 1, y: 0, duration: 0.7, stagger: 0.1, ease: "settle", clearProps: "transform" });
}
function go(anim) {
  const g = $("#go");
  g.dataset.state = "done";
  $("#goline").textContent = "Your world is complete.";
  $("#begin").href = playURL(F.world);
  if (!anim) return;
  RM ? fade(g) : gsap.fromTo(g, { opacity: 0, y: 10 }, { opacity: 1, y: 0, duration: 0.8, ease: "settle", clearProps: "transform" });
  const f = $("#begin .fill");
  RM ? fade(f) : gsap.fromTo(f, { scaleX: 0 }, { scaleX: 1, duration: 0.9, ease: "sweep", clearProps: "transform" });
}

// ---------- the look lands in three beats: colour, then patterns, then the face ----------
function flood(paint, anim) {
  if (!anim || !document.startViewTransition) return paint();
  const vt = document.startViewTransition(paint), pe = "::view-transition-new(root)";
  vt.ready.then(() => {
    if (RM) root.animate({ opacity: [0, 1] }, { duration: 400, easing: "cubic-bezier(.37,0,.63,1)", pseudoElement: pe });
    else root.animate({ maskPosition: ["100% 0", "0% 0"] }, { duration: 1200, easing: "cubic-bezier(.87,0,.13,1)", pseudoElement: pe });
  }).catch(() => {});
}
function colour() {
  setPalette(F.skin);
  root.classList.add("skinned");
  const t = tile(F.ideos[0].sk, 0.5), field = $(".field");
  field.style.setProperty("--tile", `url("${t.url}")`);
  field.style.setProperty("--tsize", `${t.w}px ${t.h}px`);
  $(".mark .mk").style.backgroundImage = `url("${medData(F.face)}")`;
}
function faceIn(anim) {
  const swap = () => { root.style.setProperty("--display", `"${F.skin.fonts.display}", serif`); root.classList.add("faced"); };
  if (!anim) return swap();
  const els = $$(".disp, .lab, .legend, .core text");
  gsap.timeline().to(els, { opacity: 0.1, duration: RM ? 0.2 : 0.3, ease: "soft" }).call(swap).to(els, { opacity: 1, duration: RM ? 0.25 : 0.5, ease: "soft", clearProps: "opacity" });
}

// ---------- the seal: one ring for each step, so the seal grows until the build ends ----------
const BS = { pulse: 103.5, legend: 95, i1: 62, i2: 84, stud: 87, fac: 46, fr: 10.5, core: 31 };
const P = (r, a) => [r * Math.cos(a), r * Math.sin(a)];
const pt = (r, a) => P(r, a).map((v) => v.toFixed(2)).join(" ");
// one line of the seal's legend on half the ring; a long one is fitted to the arc (about 5.6 units a letter at this size)
const arcText = (id, s) => { const max = Math.PI * BS.legend * 0.84, fit = s.length * 5.6 > max ? ` textLength="${max.toFixed(1)}" lengthAdjust="spacingAndGlyphs"` : ""; return `<text><textPath href="#${id}" startOffset="50%" text-anchor="middle"${fit}>${esc(s.toUpperCase())}</textPath></text>`; };
const MID = {}; // each ideology segment's middle, for its name label
let pulseTl = null;
const B = {
  mount() {
    const g = [100, 90, BS.i2, BS.i1, BS.core].map((r) => `<circle class="guide" r="${r}"/>`).join("");
    stage.innerHTML = `<div class="bgrid">
      <section class="side">${headHTML()}<ol class="rows">${rowsHTML()}</ol>${goHTML()}</section>
      <figure class="sealbox"><svg class="bseal" viewBox="-108 -108 216 216" role="img" aria-label="The seal of your world. It is not made yet.">
        <defs><path id="b-top" d="M${-BS.legend} 0 A${BS.legend} ${BS.legend} 0 0 1 ${BS.legend} 0"/><path id="b-bot" d="M${-BS.legend} 0 A${BS.legend} ${BS.legend} 0 0 0 ${BS.legend} 0"/><mask id="b-draw" maskUnits="userSpaceOnUse" x="-108" y="-108" width="216" height="216"><circle r="${BS.legend}" fill="none" stroke="#fff" stroke-width="16" pathLength="100" stroke-dasharray="100 100" stroke-dashoffset="0" transform="rotate(-90)"/></mask><clipPath id="b-fc"><circle r="${BS.fr - 0.4}"/></clipPath></defs>
        <g class="guides">${g}<circle class="work" r="100" pathLength="100"/></g><g class="parts"></g></svg></figure>
    </div>`;
    if (!RM) gsap.fromTo(".bseal .work", { rotation: 0 }, { rotation: 360, svgOrigin: "0 0", duration: 3.2, ease: "soft", repeat: -1 });
  },
  worldVal: () => `<span class="li" data-k="ideos"></span><span class="li" data-k="facs"></span>`,
  // world: the legend draws round and the empty segments and faction slots are set
  title(anim) {
    const svg = $(".bseal"), total = F.ideos.reduce((a, x) => a + Math.max(x.power, 0.4), 0), gap = 0.03;
    let a0 = -Math.PI / 2;
    const segs = F.ideos.map((x) => {
      const a1 = a0 + (Math.max(x.power, 0.4) / total) * Math.PI * 2, s = a0 + gap / 2, e = a1 - gap / 2, big = e - s > Math.PI ? 1 : 0;
      MID[x.id] = P((BS.i1 + BS.i2) / 2, (a0 + a1) / 2);
      a0 = a1;
      return `<path class="seg" data-i="${x.id}" d="M${pt(BS.i2, s)} A${BS.i2} ${BS.i2} 0 ${big} 1 ${pt(BS.i2, e)} L${pt(BS.i1, e)} A${BS.i1} ${BS.i1} 0 ${big} 0 ${pt(BS.i1, s)}Z"><title>${esc(x.name)}</title></path>`;
    }).join("");
    const facs = F.facs.map((f, i) => { const [x, y] = P(BS.fac, -Math.PI / 2 + (i * 2 * Math.PI) / F.facs.length); return `<g transform="translate(${x.toFixed(2)} ${y.toFixed(2)})"><g class="fac" data-f="${f.id}"><title>${esc(f.name)}</title><circle class="fd" r="${BS.fr}"/></g></g>`; }).join("");
    $(".parts", svg).innerHTML = `
      <g class="legend" mask="url(#b-draw)">${arcText("b-top", F.title)}${arcText("b-bot", `${F.date} · ${F.polity}`)}<rect x="-1.6" y="-1.6" width="3.2" height="3.2" transform="translate(${-BS.legend} 0) rotate(45)"/><rect x="-1.6" y="-1.6" width="3.2" height="3.2" transform="translate(${BS.legend} 0) rotate(45)"/></g>
      <g class="pulse"></g><g class="ring">${segs}</g><g class="studs"></g><g class="facs">${facs}</g><g class="core"></g>
      <g class="seglab" aria-hidden="true"><rect rx="3"/><text></text></g>`;
    svg.setAttribute("aria-label", `The seal of ${F.title}: its ${F.ideos.length} ideologies, its ${F.facs.length} factions and its ${F.months} months.`);
    gsap.killTweensOf(".bseal .work");
    gsap.to(".bseal .work", { opacity: 0, duration: 0.4, ease: "soft" });
    if (!anim) return;
    if (RM) return fade($(".parts", svg));
    gsap.timeline()
      .fromTo("#b-draw circle", { attr: { "stroke-dashoffset": 100 } }, { attr: { "stroke-dashoffset": 0 }, duration: 1.3, ease: "sweep" }, 0)
      .fromTo($$(".seg", svg), { opacity: 0, scale: 0.92, svgOrigin: "0 0" }, { opacity: 1, scale: 1, duration: 0.7, stagger: 0.08, ease: "settle" }, 0.25)
      .fromTo($$(".fac", svg), { opacity: 0, scale: 0.5, transformOrigin: "50% 50%" }, { opacity: 1, scale: 1, duration: 0.6, stagger: 0.06, ease: "settle" }, 0.45);
  },
  era(anim) {
    const el = $('[data-k="ideos"]');
    el.innerHTML = `${F.ideos.length} ideologies: ${and(F.ideos.map((x) => `<span class="nm" tabindex="0" data-i="${x.id}">${esc(x.name)}</span>`))}`;
    if (anim) wipeIn(el);
  },
  faction(f, anim) {
    const el = $('[data-k="facs"]'), shown = F.facs.slice(0, F.facs.indexOf(f) + 1);
    el.innerHTML = `${shown.length} of ${F.facs.length} factions: ${and(shown.map((x) => `<span class="nm" tabindex="0" data-f="${x.id}">${esc(x.name)}</span>`))}`.replace(`${F.facs.length} of ${F.facs.length}`, `${F.facs.length}`);
    const slot = $(`.bseal .fac[data-f="${f.id}"]`);
    slot?.classList.add("named");
    if (anim && !RM && slot) gsap.fromTo(slot, { scale: 1.25, transformOrigin: "50% 50%" }, { scale: 1, duration: 0.7, ease: "settle" });
    if (anim) fade($$(".nm", el).at(-1), 0.4);
  },
  // skin: the patterns pour into the segments and the faction medallions, one ideology after another
  patterns(anim) {
    const svg = $(".bseal"), defs = $("defs", svg);
    F.ideos.forEach((x, i) => {
      const d = i * 0.15, t = tile(x.sk, 0.28), seg = $(`.seg[data-i="${x.id}"]`, svg);
      if (!seg) return;
      defs.insertAdjacentHTML("beforeend", `<pattern id="b-p${i}" patternUnits="userSpaceOnUse" width="${t.w.toFixed(2)}" height="${t.h.toFixed(2)}"><image href="${t.url}" width="${t.w.toFixed(2)}" height="${t.h.toFixed(2)}"/></pattern>`);
      seg.insertAdjacentHTML("afterend", `<path class="segp" data-i="${x.id}" d="${seg.getAttribute("d")}" style="fill:url(#b-p${i})"/>`);
      const fill = [seg.nextElementSibling];
      for (const f of F.facs.filter((f) => f.lean === x.sk)) {
        const g = $(`.fac[data-f="${f.id}"]`, svg);
        g.insertAdjacentHTML("beforeend", `<g class="fm"><image href="${medData(f.lean, f.emblem)}" x="${-BS.fr}" y="${-BS.fr}" width="${2 * BS.fr}" height="${2 * BS.fr}" clip-path="url(#b-fc)"/><circle class="fr" r="${BS.fr}"/></g>`);
        fill.push(g.lastElementChild);
      }
      if (anim) gsap.fromTo(fill, { opacity: 0 }, { opacity: 1, duration: RM ? 0.4 : 0.8, delay: RM ? 0 : d, ease: "soft" });
    });
    if (!RM) gsap.to(".bseal .ring", { rotation: 6, svgOrigin: "0 0", duration: 24, ease: "soft", yoyo: true, repeat: -1, delay: 1.5 });
  },
  // music: an outer ring that breathes with the music while it plays
  music(anim) {
    const g = $(".bseal .pulse");
    g.innerHTML = `<circle r="${BS.pulse}"/>`;
    if (anim) RM ? fade(g) : gsap.fromTo(g, { opacity: 0, scale: 0.97, svgOrigin: "0 0" }, { opacity: 1, scale: 1, duration: 0.9, ease: "settle" });
  },
  // rules: one stud for each Vision round the ring
  rules(n, anim) {
    const g = $(".bseal .studs");
    g.innerHTML = Array.from({ length: n }, (_, i) => { const [x, y] = P(BS.stud, -Math.PI / 2 + ((i + 0.5) * 2 * Math.PI) / n); return `<rect class="law" x="-1.3" y="-1.3" width="2.6" height="2.6" transform="translate(${x.toFixed(2)} ${y.toFixed(2)}) rotate(45)"/>`; }).join("");
    if (anim) RM ? fade(g) : gsap.fromTo(g.children, { opacity: 0 }, { opacity: 1, duration: 0.4, stagger: 0.08, ease: "soft" });
  },
  // month 1: the centre and its month ticks are set, the first tick lit, the world's emblem stamped
  core(anim) {
    const c = $(".bseal .core");
    if (c.childElementCount) return;
    const ticks = Array.from({ length: F.months }, (_, i) => { const a = -Math.PI / 2 + ((i + 0.5) * 2 * Math.PI) / F.months, [x1, y1] = P(BS.core - 7, a), [x2, y2] = P(BS.core - 3.2, a); return `<line data-m="${i + 1}" x1="${x1.toFixed(2)}" y1="${y1.toFixed(2)}" x2="${x2.toFixed(2)}" y2="${y2.toFixed(2)}"/>`; }).join("");
    c.innerHTML = `<circle class="cd" r="${BS.core}"/><g class="mticks">${ticks}</g><g class="cstamp"></g><text class="cn" y="3.5">${F.months}</text><text class="cl" y="16">months</text>`;
    if (anim) RM ? fade(c) : gsap.fromTo(c, { opacity: 0, scale: 0.85, svgOrigin: "0 0" }, { opacity: 1, scale: 1, duration: 0.7, ease: "settle" });
  },
  month1(anim) {
    B.core(anim);
    lightMonths(1, anim);
    const core = F.face, s = $(".bseal .cstamp");
    if (!core?.emblem?.kind || core.emblem.kind === "none") return;
    const k = 5.2 / (0.17 * (1 + Math.min(0.4, core.emblem.pad ?? 0.22)));
    s.innerHTML = `<g transform="translate(0 -15.5)"><circle r="7.6" class="stampring"/>${colorize(emblem(core.emblem, k), pal(core))}</g>`;
    if (anim) RM ? fade(s) : gsap.fromTo(s, { scale: 1.8, rotation: -20, opacity: 0, svgOrigin: "0 -15.5" }, { scale: 1, rotation: 0, opacity: 1, duration: 0.7, ease: "sweep" });
  },
  // a name in the left column lights its part of the seal; an ideology's segment shows its name
  hl(el) {
    const svg = $(".bseal"), lab = $(".seglab", svg);
    svg.classList.toggle("hl", !!el);
    $$(".on", svg).forEach((x) => x.classList.remove("on"));
    lab?.classList.remove("show");
    if (!el) return;
    if (el.dataset.f) return $(`.fac[data-f="${el.dataset.f}"]`, svg)?.classList.add("on");
    const id = el.dataset.i;
    $$(`[data-i="${id}"]`, svg).forEach((x) => x.classList.add("on"));
    if (!lab || !MID[id]) return;
    const t = $("text", lab), r = $("rect", lab);
    t.textContent = F.ideos.find((x) => x.id === id).name;
    const w = t.getComputedTextLength() + 8;
    r.setAttribute("x", (-w / 2).toFixed(1)); r.setAttribute("width", w.toFixed(1)); r.setAttribute("y", "-5.5"); r.setAttribute("height", "11");
    lab.setAttribute("transform", `translate(${MID[id][0].toFixed(1)} ${MID[id][1].toFixed(1)})`);
    lab.classList.add("show");
  },
};
function lightMonths(upTo, anim) {
  const lit = $$(".mticks [data-m]").filter((t) => +t.dataset.m <= upTo && !t.classList.contains("on"));
  lit.forEach((t) => t.classList.add("on"));
  if (anim && lit.length) RM ? fade(lit, 0.3) : gsap.fromTo(lit, { opacity: 0 }, { opacity: 1, duration: 0.45, stagger: 0.05, ease: "soft" });
}

// ---------- the beats: one for each change; the page shows one beat at a time ----------
const NOW = {
  start: "Siyasa is writing your world: its people, their ideas and its history.",
  look: "Siyasa is drawing its look and writing its music and its laws.",
  deck: "Siyasa is writing the situations for each month.",
  check: "Siyasa is checking the world before it opens.",
};
const ON = {
  title(anim) {
    arrive("world", B.worldVal(), anim);
    running(STEPS.slice(1).map(([s]) => s));
    typeTitle(anim);
    $("#asked").textContent ||= F.prompt;
    $("#when").textContent = F.date; $("#where").textContent = F.polity;
    $(".office").textContent = F.office ? `You rule as ${F.office}.` : "";
    reveal([$(".dateline"), $(".office"), ...(F.prompt ? [$(".ask")] : [])].filter((el) => el.hasAttribute("data-wait")), anim);
    now(NOW.look, anim);
    B.title(anim);
    say(`The world is ready: ${F.title}.`);
  },
  era(anim) { B.era(anim); },
  faction(anim, b) { B.faction(b.f, anim); },
  colour(anim) {
    flood(() => { colour(); arrive("skin", null, false); }, anim); // the look's words wait for the next beat, so nothing moves under the sweep
    say("Its look is ready.");
  },
  patterns(anim) { const v = $(".val", row("skin")); v.textContent = F.look; if (anim) wipeIn(v); B.patterns(anim); },
  face(anim) { faceIn(anim); },
  music(anim) {
    arrive("music", `<button type="button" class="play t1" id="play"><svg viewBox="0 0 16 16" aria-hidden="true"><path class="i-play" d="M5 3.2v9.6L12.6 8z"/><path class="i-stop" d="M4.5 4.5h7v7h-7z"/></svg><span></span></button>${F.tune.by ? ` <span class="by">for ${esc(F.tune.by)}</span>` : ""}`, anim);
    B.music(anim);
    sound.arrived(anim);
    say("Its music is ready.");
  },
  rules(anim, b) {
    const val = arrive("rules", `<span class="num" data-n="visions">0</span> Visions for your term`, anim);
    roll($('[data-n="visions"]', val), b.n, anim);
    B.rules(b.n, anim);
    now(NOW.deck, anim);
    say("Its laws and powers are ready.");
  },
  month1(anim) {
    arrive("month1", `The situations for ${esc(F.date)}`, anim);
    B.month1(anim);
    say("Month 1 is ready.");
  },
  deck(anim, b) {
    const val = arrive("deck", `<span class="num cnt">0</span> cards over ${F.months} months`, anim);
    roll($(".cnt", val), b.n, anim);
    lightMonths(F.months, anim);
    now(NOW.check, anim);
    say("The full deck is ready.");
  },
  done(anim) {
    go(anim);
    now("", anim);
    sound.label();
    say("Your world is complete. Press Enter to begin the briefing.");
  },
};

// Main beats come from the build's parts, in step order. Each faction is named on a beat of its own between them,
// so the left column keeps moving while a slow part is written. The last beat waits for the names.
const mainQ = [], fillQ = [], seen = new Set();
let lastMain = false, pumping = false, live = false;
function enqueue(st) {
  const p = st.parts || {}, add = (key, dur, extra) => mainQ.push({ key, dur: dur ?? BEAT, main: true, ...extra });
  const got = (k) => p[k] && !seen.has(k) && seen.add(k);
  if (got("frame")) { frame(p.frame); add("title", 1.3); add("era", 1.4); fillQ.push(...F.facs.map((f) => ({ key: "faction", dur: BEAT, f }))); }
  if (seen.has("frame") && got("skin")) { skin(p.skin); add("colour", 1.3); add("patterns", 1.4); add("face"); }
  if (seen.has("frame") && got("music")) { music(p.music); add("music"); }
  if (seen.has("frame") && got("rules")) add("rules", 1.4, { n: p.rules.visions ?? 0 });
  if (seen.has("frame") && got("month1")) add("month1", 1.6);
  if (seen.has("frame") && got("deck")) add("deck", BEAT, { n: p.deck.count ?? 0 });
  if (st.status === "done" && st.world && !seen.has("done")) { seen.add("done"); F.world = st.world; add("done", BEAT, { last: true }); }
  pump();
}
async function pump() {
  if (pumping) return;
  pumping = true;
  while (mainQ.length || fillQ.length) {
    const takeFill = fillQ.length && (!mainQ.length || lastMain || mainQ[0].last);
    const b = takeFill ? fillQ.shift() : mainQ.shift();
    lastMain = !!b.main;
    ON[b.key](live, b);
    if (live) await wait(b.dur);
  }
  pumping = false;
}

// ---------- the clock: time since the prompt against the 5-minute target ----------
const fmt = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;
let clockT = 0;
function tick() {
  const t = Math.max(0, (Date.now() - started) / 1000), rem = TARGET - t, mins = Math.round(rem / 60), complete = seen.has("done");
  $("#elapsed").textContent = fmt(t);
  $("#left").textContent = complete ? "The build is complete" : rem <= 0 ? "Taking longer than usual" : rem < 60 ? "Under a minute left" : mins <= 1 ? "About a minute left" : `About ${mins} minutes left`;
  if (complete) clearInterval(clockT);
}

// ---------- sound: the world's own music, once it has arrived and you have clicked or pressed a key ----------
const sound = (() => {
  const hint = $("#hint"), btn = $("#mute");
  let unlocked = false, here = false, H = null, playing = false, muted = false;
  const label = () => {
    const on = playing && !muted;
    btn.classList.toggle("muted", !on);
    btn.setAttribute("aria-label", on ? "Mute the music (M)" : "Play the music (M)");
    const p = $("#play");
    if (p) { p.classList.toggle("on", on); $("span", p).textContent = on ? `Mute ${F.tune.title}` : `Play ${F.tune.title}`; }
    pulseTl?.kill(); pulseTl = null;
    const c = $(".bseal .pulse circle");
    if (c && on && !RM) pulseTl = gsap.fromTo(c, { opacity: 0.35, scale: 1, svgOrigin: "0 0" }, { opacity: 1, scale: 1.012, duration: 60 / F.tune.bpm, ease: "soft", yoyo: true, repeat: -1 });
    else if (c) gsap.to(c, { opacity: 0.6, scale: 1, svgOrigin: "0 0", duration: 0.4, ease: "soft" });
  };
  const showHint = (v) => { if (hint.hidden === !v) return; hint.hidden = !v; if (v) fade(hint, 0.5); };
  async function start() {
    if (!unlocked || !here || H) return;
    H = "loading";
    try {
      if (!window.Tone) await new Promise((ok, no) => { const s = document.createElement("script"); s.src = "/hall/tone.js"; s.onload = ok; s.onerror = no; document.head.append(s); });
      H = await import("../hall/hallsfx.js");
      H.init({ id: ID }, F.music); // a given brief plays its staged intro: the bed, then the theme, the pulse and the rest
      playing = true; label();
    } catch (e) { H = null; console.warn("music unavailable", e); }
  }
  const unlock = () => { if (unlocked) return; unlocked = true; showHint(false); start(); };
  const toggle = () => { muted = H.toggleMute(); label(); };
  addEventListener("pointerdown", unlock, { capture: true });
  addEventListener("keydown", (e) => { if ((e.key === "m" || e.key === "M") && playing && !e.metaKey && !e.ctrlKey) return toggle(); unlock(); }, { capture: true });
  btn.addEventListener("click", () => (playing ? toggle() : unlock()));
  stage.addEventListener("click", (e) => { if (e.target.closest("#play")) playing ? toggle() : unlock(); });
  return {
    label: () => F.tune && label(),
    arrived(anim) {
      here = true; btn.hidden = false;
      if (anim) fade(btn, 0.5);
      showHint(!unlocked);
      label();
      start();
    },
  };
})();

// Enter confirms the primary action once it is ready (PRODUCT.md)
addEventListener("keydown", (e) => {
  if (e.key !== "Enter" || e.defaultPrevented || e.target.closest?.("a, button, [tabindex]")) return;
  if ($("#go")?.dataset.state === "done") location.assign($("#begin").href);
});
// pointing at or focusing a name lights its part of the seal
const pointAt = (el) => B.hl(el);
stage.addEventListener("pointerover", (e) => pointAt(e.target.closest("[data-f], .nm")));
stage.addEventListener("focusin", (e) => pointAt(e.target.closest("[data-f], .nm")));
stage.addEventListener("pointerleave", () => pointAt(null));
stage.addEventListener("focusout", (e) => { if (!e.relatedTarget?.closest?.("[data-f], .nm")) pointAt(null); });

// ---------- failure: one line, the reason on its own line, two ways on ----------
function failed(reason) {
  const g = $("#go");
  g.dataset.state = "failed";
  g.innerHTML = `<div class="failtext" role="alert"><p class="fail t2">This world could not be built. Your daily build is returned. Try again or play a world from the library.</p><p class="t1 reason">${esc(reason || "The build stopped without a reason.")}</p></div>
    <div class="acts"><a class="again t1" href="/${F.prompt ? `?prompt=${encodeURIComponent(F.prompt)}` : ""}">Try again</a><a class="tolib t1" href="/#library">Play a world from the library${ARROW}</a></div>`;
  root.dataset.state = "failed";
  if (F.prompt) $(".ask").removeAttribute("data-wait");
  $("#clock").hidden = true;
  $("#now").classList.add("gone");
  gsap.killTweensOf(".bseal .work");
  $(".bseal").setAttribute("aria-label", "The seal of your world. It was not made.");
  fade([stage], 0.5);
}
function lost() {
  stage.innerHTML = `<div class="lost"><p class="t2">Siyasa cannot find this build.</p><a class="t1" href="/#library">Play a world from the library</a></div>`;
  $("#clock").hidden = true;
}

// ---------- start: poll every 1.5 s; the first answer paints at once, later ones play as beats ----------
async function poll() {
  let st = null;
  try { st = await json(`/api/builds/${encodeURIComponent(ID)}`); } catch (e) { console.warn("build status unavailable", e); }
  if (st?.status === "missing") return lost();
  if (st) {
    enqueue(st);
    if (st.status === "failed") { await until(() => !pumping); return failed(st.error); }
    if (st.status === "done") return;
  }
  live = true;
  setTimeout(poll, POLL);
}
const until = async (ok) => { while (!ok()) await wait(0.2); };

if (!ID) lost();
else {
  B.mount();
  running(["world"]);
  now(NOW.start, false);
  RM ? fade(stage, 0.4) : gsap.fromTo(stage.firstElementChild, { opacity: 0, y: 14 }, { opacity: 1, y: 0, duration: 0.9, ease: "settle", clearProps: "transform" });
  tick();
  clockT = setInterval(tick, 500);
  // a build opened again from "Your worlds": its prompt and start time come from the server
  if (!saved) json("/api/mine").then((m) => { const b = m?.builds?.find((x) => x.id === ID); if (!b) return; started = b.created; F.prompt = b.prompt; if (!$("#asked").textContent) { $("#asked").textContent = b.prompt; reveal([$(".ask")], true); } if ($("#title .typed.idle")) $("#title .typed").textContent = $("#title .sr").textContent = b.prompt; }).catch(() => {});
  poll();
}
