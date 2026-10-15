import { applySkin, loadFont } from "../shared/skin.js";
import { gsap, RM } from "../shared/motion.js";
import { makeField } from "./bg.js";
import { render, renderMedallion, colorize, dataURL } from "../patterns/engine.js";
import emblem from "../patterns/emblem.js";
import { TUNE } from "../../../engine/tune.ts";
import { badges } from "../shared/badges.js";
import { $, $$, esc, ARROW, MONTH, playURL, buildURL, pal, medal, medData, tileVars, face, json } from "./common.js";

const SHOWN = 8;
const MIN = 4;
const SMALL = 4; // under this many worlds the library hides its tools and keeps a place for the next world
const pick = (a) => a[Math.floor(Math.random() * a.length)];
const shuffle = (a) => a.map((x) => [Math.random(), x]).sort((p, q) => p[0] - q[0]).map(([, x]) => x);
let LIST = [];
const byId = (id) => LIST.find((w) => w.id === id);

// an ideology's strength in its world: the summed faction mix
function ranked(pack) {
  const s = {};
  for (const f of pack.world.factions || []) for (const [id, v] of f.mix || []) s[id] = (s[id] || 0) + v;
  return [...pack.skin.ideologies].sort((a, b) => (s[b.id] || 0) - (s[a.id] || 0)).map((x) => ({ ...x, power: s[x.id] || 0 }));
}

async function main() {
  try { LIST = (await json("/api/worlds")) || []; } catch (e) { console.warn("library unavailable", e); }
  const field = makeField($("#field"));
  let today = null, first = null;
  if (LIST.length) {
    try { today = await json(`/api/worlds/${encodeURIComponent(pick(LIST).id)}`); } catch (e) { console.warn("world unavailable", e); }
  }
  if (today?.skin && today?.world) {
    await applySkin(today.skin);
    const ideos = ranked(today);
    first = ideos[0];
    ruleTo(today.world, ideos[0]);
    await hero(ideos, field);
    examplesRow(shuffle(LIST.filter((w) => w.id !== today.world.id && w.title.length <= 44)).slice(0, 3));
  } else $(".cue").hidden = true;
  wireForm(field, first);
  entrance();
  if (today) try { term(today, first); } catch (e) { console.warn("example unavailable", e); }
  library();
  mine().catch((e) => console.warn("your worlds unavailable", e));
  guard().catch((e) => console.warn("turnstile unavailable", e));
}

async function hero(ideos, field) {
  const root = document.documentElement;
  root.style.setProperty("--ia", ideos[0].a);
  $("#world").hidden = false;
  seal(ideos);
  // the sash: the world's ideologies along the hero's lower edge, as wide as they are strong
  const total = ideos.reduce((a, x) => a + Math.max(x.power, 0.3), 0);
  $(".sash").innerHTML = ideos.map((x) => `<i style="flex:${(Math.max(x.power, 0.3) / total).toFixed(3)};background:${x.a}"></i>`).join("");
  // the field: each cell one motif period, squared, so any tile shape tessellates
  const sprite = (id) => { const x = ideos.find((i) => i.id === id); return dataURL(colorize(renderMedallion(x.recipe, { periods: 1 }).svg, pal(x))); };
  await field.setSkin({ ids: ideos.map((x) => x.id), sprite, ground: getComputedStyle(root).getPropertyValue("--ground").trim() }, Object.fromEntries(ideos.map((x) => [x.id, 1 + x.power])));
  field.start();
  addEventListener("resize", () => field.onResize());
  let timer = 0;
  const wave = () => {
    if (document.hidden) return;
    const x = pick(ideos), edge = Math.random() < 0.5;
    const ox = edge ? (Math.random() < 0.5 ? -80 : innerWidth + 80) : Math.random() * innerWidth, oy = edge ? Math.random() * innerHeight : (Math.random() < 0.5 ? -80 : innerHeight + 80);
    field.recede(field.flood(x.id, ox, oy, { speed: 260, alpha: 0.32, boost: 0.4 }), ox, oy, { delay: 5.5, speed: 320 });
  };
  // the field and its slow waves run only while the hero is seen
  new IntersectionObserver(([e]) => {
    field.setActive(e.isIntersecting);
    clearInterval(timer);
    if (e.isIntersecting && !RM) timer = setInterval(wave, 9000);
  }).observe($(".hero"));
}

// the world's seal: a ring of its ideologies' patterns, each as wide as it is strong, around its strongest medallion
function seal(ideos) {
  const P = (r, a) => `${(r * Math.cos(a)).toFixed(2)} ${(r * Math.sin(a)).toFixed(2)}`, gap = 0.035, R1 = 70, R2 = 96;
  const total = ideos.reduce((a, x) => a + Math.max(x.power, 0.4), 0);
  const core = ideos.find((x) => x.emblem?.kind && x.emblem.kind !== "none");
  let a0 = -Math.PI / 2, defs = "", ring = "";
  ideos.forEach((x, i) => {
    const t = render(x.recipe), k = 0.3, a1 = a0 + (Math.max(x.power, 0.4) / total) * Math.PI * 2, s = a0 + gap / 2, e = a1 - gap / 2, big = e - s > Math.PI ? 1 : 0;
    defs += `<pattern id="seal-p${i}" patternUnits="userSpaceOnUse" width="${(t.w * k).toFixed(2)}" height="${(t.h * k).toFixed(2)}"><image href="${dataURL(colorize(t.svg, pal(x)))}" width="${(t.w * k).toFixed(2)}" height="${(t.h * k).toFixed(2)}"/></pattern>`;
    ring += `<path d="M${P(R2, s)} A${R2} ${R2} 0 ${big} 1 ${P(R2, e)} L${P(R1, e)} A${R1} ${R1} 0 ${big} 0 ${P(R1, s)}Z" fill="url(#seal-p${i})"><title>${esc(x.name)}</title></path>`;
    a0 = a1;
  });
  $(".seal").innerHTML = `<svg viewBox="-100 -100 200 200"><defs>${defs}<clipPath id="seal-c"><circle r="66"/></clipPath></defs>
    <circle r="99" fill="var(--ground)" opacity=".72"/>
    <g class="ring">${ring}</g>
    <circle r="98.4" fill="none" stroke="var(--ink)" stroke-opacity=".28" stroke-width=".6"/>
    <circle r="68" fill="var(--ground)"/>
    ${core ? `<image href="${dataURL(colorize(renderMedallion(core.recipe, { periods: 2.6 }).svg, pal(core)))}" x="-66" y="-66" width="132" height="132" clip-path="url(#seal-c)"/>
    <circle r="66" fill="var(--ground)" opacity=".5"/>${colorize(emblem(core.emblem, 44 / (0.17 * (1 + Math.min(0.4, core.emblem.pad ?? 0.22)))), pal(core))}` : ""}
    <circle r="66.6" fill="none" stroke="var(--accent)" stroke-width="1"/></svg>`;
}

function examplesRow(ws) {
  if (!ws.length) return;
  const box = $("#try"), ta = $("#prompt");
  for (const w of ws) {
    const b = document.createElement("button");
    b.type = "button"; b.className = "ex t1"; b.textContent = w.title;
    b.addEventListener("click", () => { ta.value = w.title; ta.dispatchEvent(new Event("input")); ta.focus(); ta.setSelectionRange(ta.value.length, ta.value.length); });
    box.append(b);
  }
  box.hidden = false;
}

// the "Rule <world>" link under the box
function ruleTo(w, strongest) {
  $(".mark .mk").style.backgroundImage = `url("${medData(strongest)}")`;
  $("#world-name").textContent = w.title;
  $("#rule").setAttribute("aria-label", `Rule ${w.title}`);
  $("#rule").href = playURL(w.id);
  if (!$("#state").dataset.cards) $("#rule").hidden = false;
}

function entrance() {
  document.documentElement.classList.remove("wait");
  if (RM) return gsap.fromTo(["#field", ".ask", ".world", ".mast", ".foot", ".sash", "main", ".end"], { opacity: 0 }, { opacity: 1, duration: 0.4, ease: "soft" });
  // a state document's line rises once behind a mask; the seal settles in beside it
  gsap.timeline()
    .fromTo(".q label", { clipPath: "inset(0% -4% 100% -4%)", y: 28 }, { clipPath: "inset(-20% -4% -20% -4%)", y: 0, duration: 1.15, clearProps: "clipPath" }, 0.15)
    .from(".box", { y: 18, opacity: 0, duration: 0.95 }, 0.5)
    .from([".try", ".state"], { opacity: 0, duration: 0.8, ease: "soft" }, 0.85)
    .from(".world .seal", { scale: 0.94, rotation: -8, opacity: 0, duration: 1.6, transformOrigin: "50% 50%" }, 0.2)
    .from(".rule", { y: 10, opacity: 0, duration: 0.8 }, 0.95)
    .from([".mast", ".foot", ".sash"], { opacity: 0, duration: 0.9, ease: "soft" }, 0.85)
    .from(["main", ".end"], { opacity: 0, duration: 0.6, ease: "soft" }, 0.85)
    .add(() => { if ($(".seal .ring")) gsap.to(".seal .ring", { rotation: 7, svgOrigin: "0 0", duration: 26, ease: "soft", yoyo: true, repeat: -1 }); });
}

// ---------- the prompt: Enter asks the server; its answer is one of the 5 states, in place under the box ----------
const HINT = "Try a place and a moment: a city, a month and a year";
const stateLine = (text) => { $("#state-l").textContent = text; };
let busy = false;

function wireForm(field, first) {
  const form = $("#ask"), ta = $("#prompt"), err = $("#err"), box = $(".box"), go = $(".go");
  const clear = () => { err.classList.remove("on"); box.classList.remove("bad"); ta.removeAttribute("aria-invalid"); };
  const bad = (text) => {
    err.innerHTML = `<span class="ei" aria-hidden="true">!</span>${esc(text)}`;
    err.classList.add("on"); box.classList.add("bad"); ta.setAttribute("aria-invalid", "true"); ta.focus();
  };
  ta.addEventListener("input", () => { clear(); typing(); });
  const again = new URLSearchParams(location.search).get("prompt"); // "Try again" from a failed build
  if (again) { ta.value = again.slice(0, 240); typing(); }
  // Enter asks (the spec rule); Shift+Enter keeps its new line
  ta.addEventListener("keydown", (e) => { if (e.key === "Enter" && !e.shiftKey && !e.isComposing) { e.preventDefault(); form.requestSubmit(); } });
  const leave = (url) => {
    const b = go.getBoundingClientRect();
    if (first) field.flood(first.id, b.left + b.width / 2, b.top + b.height / 2, { boost: 1.4 });
    gsap.to([".ask", ".world"], { opacity: 0, y: RM ? 0 : -12, duration: RM ? 0.25 : 0.55, ease: "swift", delay: RM ? 0 : 0.25, onComplete: () => location.assign(url) });
  };
  const ask = async (force) => {
    const prompt = ta.value;
    busy = true; go.setAttribute("aria-busy", "true"); form.classList.add("busy");
    stateLine("Siyasa is reading your prompt.");
    let r;
    try {
      const token = await tokenNow();
      r = await json("/api/prompt", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ prompt, token, force: force || undefined }) });
    } catch (e) { console.warn("prompt failed", e); }
    resetToken();
    busy = false; go.removeAttribute("aria-busy"); form.classList.remove("busy");
    stateLine("");
    switch (r?.state) {
      case "building":
        try { sessionStorage.setItem(`siyasa-build-${r.build}`, JSON.stringify({ prompt, at: Date.now() })); } catch {}
        return leave(buildURL(r.build));
      case "exists": return picks([r.world], "This world exists", ask);
      case "similar": return r.worlds?.length ? picks(r.worlds, "The library has worlds close to this one.", ask) : ask(true);
      case "spaced": case "capped": return closed(r.state, r.opensAt);
      case "invalid": case "refused": return bad(r.reason || "Try again.");
      default: return bad("Siyasa did not answer. Try again.");
    }
  };
  form.addEventListener("submit", (e) => {
    e.preventDefault();
    if (busy || $("#state").dataset.kind === "closed") return;
    ta.value = ta.value.replace(/\s+/g, " ").trim();
    if (ta.value.length < MIN) return bad("Name a place, a time, or both.");
    ask(false);
  });
}

// while you type a place with no date, one hint line; any other state ends when you edit the prompt
function typing() {
  const st = $("#state"), v = $("#prompt").value.trim();
  if (st.dataset.kind === "closed") return;
  if (st.dataset.cards) { delete st.dataset.cards; $("#picks").hidden = true; $("#rule").hidden = !$("#world-name").textContent; }
  $("#try").hidden = $("#try").children.length < 2 || !!v; // the examples step aside once you type
  st.dataset.kind = "";
  stateLine(v.length >= 3 && !/\d/.test(v) ? HINT : "");
}

// exists and similar: one world card each, in its own face; Play is the hot button, "Build mine anyway" the quiet one
function picks(worlds, line, ask) {
  const st = $("#state"), hits = worlds.slice(0, 3);
  st.dataset.cards = String(hits.length);
  st.dataset.kind = "";
  $("#try").hidden = true; $("#rule").hidden = true;
  const box = $("#picks");
  box.className = `picks n${hits.length}`;
  box.replaceChildren(...hits.map((w) => {
    const card = byId(w.id)?.card, c = document.createElement("div");
    c.className = "wc";
    const m = card?.ideologies?.length ? face(card.ideologies) : null;
    c.innerHTML = `<span class="med" aria-hidden="true"${m ? ` style='background-image:url("${medData(m)}")'` : ""}></span>
      <span class="tt"><span class="wt disp">${esc(w.title)}</span><span class="wi t1">${esc([w.date && MONTH(w.date), w.polity].filter(Boolean).join(", "))}</span></span>
      <a class="pl t1" href="${playURL(w.id)}"${hits.length > 1 ? ` aria-label="Play ${esc(w.title)}"` : ""}>${hits.length > 1 ? "Play" : "Play this world"}${ARROW}</a>`;
    // the card names its world in that world's face; colours and the Play button stay the page's
    if (card?.fonts?.display) { c.style.setProperty("--display", `"${card.fonts.display}", serif`); loadFont(card.fonts.display); }
    return c;
  }));
  if (hits.length > 1) {
    const b = document.createElement("button");
    b.type = "button"; b.className = "anyway t1"; b.textContent = "Build mine anyway";
    b.onclick = () => { if (!busy) ask(true); };
    box.append(b);
  }
  stateLine(line);
  box.hidden = false;
  gsap.fromTo(box.children, { opacity: 0, y: RM ? 0 : 8 }, { opacity: 1, y: 0, duration: RM ? 0.25 : 0.5, stagger: RM ? 0 : 0.06 });
  $(".pl", box)?.focus({ preventScroll: true });
}

// spaced or capped: the box closes and says when it opens again; Rule and the library are the way in
function closed(kind, opensAt) {
  const st = $("#state"), ta = $("#prompt");
  st.dataset.kind = "closed";
  if (st.dataset.cards) { delete st.dataset.cards; $("#picks").hidden = true; }
  stateLine("");
  ta.value = ""; ta.disabled = true; $(".box").classList.add("capped");
  $("#try").hidden = true; $(".go").setAttribute("aria-disabled", "true");
  const rule = $("#rule");
  rule.classList.add("primary"); rule.hidden = !$("#world-name").textContent;
  const cap = document.createElement("div"), at = Date.parse(opensAt) || Date.now() + 86400000 - (Date.now() % 86400000);
  cap.className = "capline"; cap.setAttribute("role", "status");
  const more = kind === "spaced" ? "One new world a day. You can play any world in the library." : "You can play any world in the library.";
  const put = () => {
    const min = Math.max(1, Math.ceil((at - Date.now()) / 60000)), h = Math.floor(min / 60), m = min % 60;
    cap.innerHTML = `<p class="t2">New worlds open at 00:00 UTC, in ${h} h ${m} min.</p><p class="t1 soft">${more}</p>`;
  };
  put(); setInterval(put, 60000);
  ta.after(cap);
  (rule.hidden ? $("#library .wcard") : rule)?.focus({ preventScroll: true });
}

// ---------- Turnstile: managed mode, shown only when Cloudflare asks ----------
let TS = null, token = "", waiting = null;
async function guard() {
  const cfg = await json("/api/config");
  if (!cfg?.turnstile) return;
  await new Promise((ok, no) => { const s = document.createElement("script"); s.src = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit"; s.onload = ok; s.onerror = no; document.head.append(s); });
  TS = window.turnstile.render("#ts", {
    sitekey: cfg.turnstile, appearance: "interaction-only",
    callback: (t) => { token = t; waiting?.(t); waiting = null; },
    "expired-callback": () => { token = ""; },
  });
}
const tokenNow = () => (TS == null || token ? Promise.resolve(token || undefined) : new Promise((r) => { waiting = r; setTimeout(() => r(undefined), 15000); }));
const resetToken = () => { if (TS != null) { token = ""; window.turnstile.reset(TS); } };

// ---------- how a term plays: one real month of today's world, in its skin ----------
function term(pack, ideo) {
  const { world, deck } = pack, facIds = new Set(world.factions.map((f) => f.id));
  const fits = (s) => s.answers?.length >= 2 && Object.keys(s.answers[0].moves || {}).filter((id) => facIds.has(id)).length >= 3 && s.question.length <= 110;
  const sit = deck.situations.find((s) => s.months?.[0] <= 1 && fits(s)) || deck.situations.find(fits) || deck.situations[0];
  if (!sit) return;
  $("#term").hidden = false;
  $("#term-src").textContent = `From ${world.title}, ${MONTH(world.date)}`;
  const [a1, a2] = sit.answers, loops = [];

  // 1: a real situation turns face up and an answer is chosen
  const fc = $(".frag-card");
  if (ideo) tileVars(fc, ideo, 0.42);
  $(".who", fc).textContent = [sit.carrier?.name, sit.carrier?.role].filter(Boolean).join(", ");
  $(".ques", fc).textContent = sit.question;
  $$(".ans", fc).forEach((p, i) => (p.textContent = [a1, a2][i].text));
  const cd = $(".cd", fc), pickA = $(".ans", fc);
  if (RM) { gsap.set(cd, { rotationY: 180 }); pickA.classList.add("sel"); }
  else loops.push([fc, gsap.timeline({ repeat: -1, paused: true })
    .to({}, { duration: 0.8 })
    .to(cd, { rotationY: 180, duration: 1.2 })
    .call(() => pickA.classList.add("sel"), null, "+=1.6")
    .to({}, { duration: 2.4 })
    .to(cd, { rotationY: 360, duration: 1.2 })
    .call(() => pickA.classList.remove("sel"))
    .set(cd, { rotationY: 0 })]);

  // 2: that answer moves three groups, with their real names and support
  const fb = $(".frag-bars"), fac = Object.fromEntries(world.factions.map((f) => [f.id, f]));
  const rows = Object.entries(a1.moves).filter(([id]) => fac[id]).slice(0, 3).map(([id, mv]) => ({ f: fac[id], from: fac[id].support, to: Math.max(0, Math.min(100, fac[id].support + (mv[0] === "-" ? -1 : 1) * (TUNE.size[mv[1]] ?? 0))) }));
  fb.innerHTML = `<p class="said t1">You chose <b>${esc(a1.text)}</b></p>` + rows.map((r) => `<div class="brow"><span class="nm t1">${esc(r.f.short || r.f.name)}</span><span class="trk"><i style="left:30%"></i><i style="left:50%"></i><span class="fill"></span></span><span class="chip ${r.to > r.from ? "up" : "down"}">${r.to > r.from ? "▲" : "▼"}${Math.abs(r.to - r.from)}</span></div>`).join("");
  const fills = $$(".fill", fb), chips = $$(".chip", fb);
  if (RM) gsap.set(fills, { scaleX: (j) => rows[j].to / 100 });
  else {
    gsap.set(fills, { scaleX: (j) => rows[j].from / 100 }); gsap.set(chips, { opacity: 0 });
    loops.push([fb, gsap.timeline({ repeat: -1, paused: true })
      .to({}, { duration: 0.6 })
      .to(chips, { opacity: 1, duration: 0.3, ease: "soft", stagger: 0.08 })
      .to(fills, { scaleX: (j) => rows[j].to / 100, duration: 1, stagger: 0.08 }, "<")
      .to({}, { duration: 2.4 })
      .to(chips, { opacity: 0, duration: 0.4, ease: "soft" })
      .to(fills, { scaleX: (j) => rows[j].from / 100, duration: 0.8, ease: "soft" }, "<")]);
  }

  // 3: the seal fills month by month to the Reckoning
  const n = world.months, rk = world.reckoning;
  const gist = rk.meaning.split(/,(?!\d)|(?<=\.)\s/)[0].replace(/\.$/, ""); // the first clause; a comma inside a number (3,100) is not a break
  $("#reck").textContent = `Here: ${rk.name.split(":")[0]}, ${MONTH(rk.date)}. ${gist}. Keep your standing at 50 or more.`;
  const fs = $(".frag-seal"), P = (r, i) => { const a = -Math.PI / 2 + ((i + 0.5) * 2 * Math.PI) / n; return [(r * Math.cos(a)).toFixed(3), (r * Math.sin(a)).toFixed(3)]; };
  const ticks = Array.from({ length: n }, (_, i) => { const [x1, y1] = P(1.3, i), [x2, y2] = P(1.46, i); return `<line class="mt" x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}"/>`; }).join("");
  const [rx, ry] = P(1.62, n - 1);
  fs.innerHTML = `<svg viewBox="-1.8 -1.8 3.6 3.6"><circle class="disc" r="1.58"/>${ticks}<path class="trk2" d="M0 -1.12 A1.12 1.12 0 1 1 -0.001 -1.12"/><path class="arc" d="M0 -1.12 A1.12 1.12 0 1 1 -0.001 -1.12" pathLength="100" stroke-dasharray="0 100"/><rect class="rk" x="-.09" y="-.09" width=".18" height=".18" transform="translate(${rx} ${ry}) rotate(45)"/><text class="sm" y="-.08">1</text><text class="sl" y=".46">month</text></svg>`;
  const arc = $(".arc", fs), mts = $$(".mt", fs), num = $(".sm", fs), lab = $(".sl", fs), dia = $(".rk", fs);
  const at = (m) => { mts.forEach((t, i) => t.setAttribute("class", `mt${i < m - 1 ? " on" : i === m - 1 ? " now" : ""}`)); num.textContent = m; lab.textContent = m === n ? "the Reckoning" : "month"; dia.setAttribute("class", `rk${m === n ? " lit" : ""}`); };
  const o = { v: 0 }, draw = () => arc.setAttribute("stroke-dasharray", `${o.v.toFixed(2)} 100`);
  if (RM) { o.v = 100; draw(); at(n); }
  else {
    const tl = gsap.timeline({ repeat: -1, paused: true }).call(at, [1]);
    for (let m = 1; m <= n; m++) tl.call(at, [m]).to(o, { v: (m * 100) / n, duration: 0.38, onUpdate: draw }).to({}, { duration: m === n ? 2.2 : 0.18 });
    tl.to(o, { v: 0, duration: 0.8, ease: "soft", onUpdate: draw }).call(at, [1]).to({}, { duration: 0.4 });
    loops.push([fs, tl]);
  }
  // loops run only while seen
  const io = new IntersectionObserver((es) => es.forEach((e) => e.target._tl[e.isIntersecting ? "play" : "pause"]()));
  for (const [el, tl] of loops) { el._tl = tl; io.observe(el); }
}

// ---------- world cards: each in its own skin ----------
const FIN = import("../patterns/finish.js").then((m) => (m.start() ? m : null), () => null);
function worldCard(w) {
  const two = (w.card?.ideologies || []).slice(0, 2), li = document.createElement("li"), ideas = two.map((x) => x.name).join(" and "), won = Object.keys(badges(w.id)).length;
  li.innerHTML = `<a class="wcard" href="${playURL(w.id)}" aria-label="Play ${esc(w.title)}. ${esc(MONTH(w.date))}. ${esc(ideas)}">
    <span class="band" aria-hidden="true"></span>
    <span class="meds" aria-hidden="true">${two.map((x) => `<span class="med" style='background-image:url("${medData(x)}")'></span>`).join("")}</span>
    <span class="wt t2 disp" title="${esc(w.title)}">${esc(w.title)}</span>
    <span class="wd t1">${esc(MONTH(w.date))}</span>
    <span class="wi t1">${esc(ideas)}</span>
    ${won ? `<span class="wb t1">${won} ${won === 1 ? "Vision" : "Visions"} fulfilled</span>` : ""}
    <span class="play t1">Play${ARROW}</span>
  </a>`;
  const a = li.firstElementChild;
  if (two[0]) tileVars(a, two[0], 0.62);
  if (w.card?.palette) applySkin(w.card, a).catch(() => {});
  li._w = w;
  FIN.then((fin) => { const f = w.card?.finish; if (fin && f) $$(".med", li).forEach((el, j) => fin.assign(fin.surface(el), medal(two[j]), pal(two[j]), f.type, f.foilSlot)); });
  return li;
}
// a small library keeps one place open for the next world: it points back to the prompt
function nextCard() {
  const li = document.createElement("li");
  li.className = "next";
  li.innerHTML = `<button type="button" class="wcard blank"><span class="band" aria-hidden="true"></span><span class="wt t2 disp">The next world is yours</span><span class="wi t1">Name a place and a time. Siyasa builds it in about 15 minutes.</span><span class="play t1">Write a prompt${ARROW}</span></button>`;
  $("button", li).onclick = () => { scrollTo({ top: 0, behavior: RM ? "auto" : "smooth" }); $("#prompt").focus({ preventScroll: true }); };
  return li;
}

// ---------- the library: 8 worlds, then all; sort and search on the client ----------
function library() {
  const grid = $("#grid"), more = $("#more"), none = $("#none"), filter = $("#filter");
  if (!LIST.length) { none.textContent = "The library is empty. Build the first world."; none.hidden = false; return; }
  const small = LIST.length < SMALL;
  $("#tools").hidden = small;
  if (small) $("#lib-sub").textContent = LIST.length === 1 ? "One world is built so far. Play it, or build the next one." : `${LIST.length} worlds are built so far. Play one, or build the next one.`;
  const cards = LIST.map((w, i) => { const li = worldCard(w); li._played = i; li._hay = [w.title, w.polity, w.date, MONTH(w.date)].join(" ").toLowerCase(); return li; });
  const tail = small ? [nextCard()] : [];
  let sort = "new", all = false;
  const show = () => {
    const q = filter.value.trim().toLowerCase().split(/\s+/).filter(Boolean);
    const list = [...cards].sort(sort === "new" ? (a, b) => b._w.created - a._w.created : (a, b) => a._played - b._played);
    const hits = list.filter((li) => q.every((t) => li._hay.includes(t)));
    grid.replaceChildren(...list, ...tail);
    let n = 0;
    for (const li of list) li.hidden = !hits.includes(li) || (!q.length && !all && n++ >= SHOWN);
    more.hidden = q.length > 0 || cards.length <= SHOWN;
    more.textContent = all ? "Show fewer worlds" : `Show all ${cards.length} worlds`;
    none.hidden = hits.length > 0;
    if (!hits.length) { none.innerHTML = `No world in the library matches “${esc(filter.value.trim())}”. <button type="button">Build it instead</button>`; $("button", none).onclick = () => { const ta = $("#prompt"); if (!ta.disabled) ta.value = filter.value.trim(); scrollTo({ top: 0, behavior: RM ? "auto" : "smooth" }); ta.focus({ preventScroll: true }); }; }
    return [...list.filter((li) => !li.hidden), ...tail];
  };
  const fadeIn = (els) => gsap.fromTo(els, { opacity: 0, y: RM ? 0 : 10 }, { opacity: 1, y: 0, duration: RM ? 0.25 : 0.45, stagger: RM ? 0 : 0.03, ease: "settle" });
  fadeIn(show());
  filter.addEventListener("input", () => show());
  more.addEventListener("click", () => { all = !all; const before = new Set(cards.filter((li) => !li.hidden)); fadeIn(show().filter((li) => !before.has(li))); });
  for (const b of $$(".seg button")) b.addEventListener("click", () => {
    if (b.dataset.sort === sort) return;
    sort = b.dataset.sort;
    $$(".seg button").forEach((x) => x.setAttribute("aria-pressed", String(x === b)));
    gsap.to(cards, { opacity: 0, duration: RM ? 0.15 : 0.2, ease: "swift", onComplete: () => fadeIn(show()) });
  });
}

// ---------- your worlds: built from this browser, with any build still running ----------
async function mine() {
  const m = await json("/api/mine");
  const worlds = m?.worlds || [], builds = m?.builds || [];
  if (!worlds.length && !builds.length) return;
  const running = builds.map((b) => {
    const li = document.createElement("li");
    li.innerHTML = `<a class="wcard building" href="${buildURL(b.id)}" aria-label="Your world is being built: ${esc(b.prompt)}. Open the build screen.">
      <span class="band" aria-hidden="true"></span>
      <span class="wt t2 disp">${esc(b.prompt)}</span>
      <span class="wi t1"><span class="pip" aria-hidden="true"></span>Siyasa is building this world.</span>
      <span class="play t1">See the build${ARROW}</span>
    </a>`;
    return li;
  });
  $("#mine-grid").replaceChildren(...running, ...worlds.map(worldCard));
  $("#mine").hidden = false;
}

main();
