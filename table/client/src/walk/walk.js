// The walkthrough over the dimmed board (owner pick: walk B). Port of docs/mocks/v28/walk.js, on the real pack.
// Runs when the page has ?walk=1: 8 screens, one idea each, ending in the pledge; Take office starts the term.
import { gsap, RM } from "../shared/motion.js";
import { applySkin } from "../shared/skin.js";
import { monthName } from "../shared/dates.js";
import { badges } from "../shared/badges.js";
import { render, renderMedallion, colorize, dataURL } from "../patterns/engine.js";
import emblem from "../patterns/emblem.js";
import { PRESETS as RULESETS, TUNE } from "../../../engine/tune.ts";
// the briefing lives in a shadow root: the board styles many of the same class names (.fac, .dot, .mark)
import tokens from "../shared/tokens.css?inline";
import css from "./walk.css?inline";

const Q = new URLSearchParams(location.search);
if (Q.get("walk") === "1") start();

async function whenBoard() {
  for (let i = 0; i < 300; i++) {
    if (window.board?.pack && window.board?.newTerm) return window.board;
    await new Promise((r) => setTimeout(r, 100));
  }
  throw new Error("the board did not load");
}

async function start() {
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
  const MONTH = monthName;
  const WORDS = "zero one two three four five six seven eight nine ten eleven twelve thirteen fourteen fifteen sixteen seventeen eighteen nineteen twenty".split(" ");
  const word = (n) => WORDS[n] ?? String(n);
  const cap = (s) => s[0].toUpperCase() + s.slice(1);
  const firstSentence = (s) => String(s).split(/(?<=\.)\s+(?=[A-Z])/)[0];
  // a Vision's short phrase: its line up to the first comma, colon or semicolon
  const phrase = (s) => s.split(/[,:;]\s/)[0].replace(/\.$/, "");
  const pal = (x) => ({ a: x.a, b: x.b, c: x.c });
  const med = (sk, emb) => dataURL(colorize(renderMedallion({ ...sk.recipe, emblem: emb ?? sk.emblem }).svg, pal(sk)));
  const tile = (sk, k = 1) => { const t = render(sk.recipe); return { url: dataURL(colorize(t.svg, pal(sk))), w: t.w * k, h: t.h * k }; };
  const bg = (u) => `url(&quot;${u}&quot;)`;

  const host = Object.assign(document.createElement("div"), { id: "briefing" }), shadow = host.attachShadow({ mode: "open" });
  shadow.innerHTML = `<style>${tokens}
${css}</style><div class="wk"></div>`;
  const root = shadow.querySelector(".wk");
  root.innerHTML = `<div class="walk" id="walk" role="dialog" aria-modal="true" aria-label="Your briefing">
  <header class="top">
    <p class="where t1" id="where"><svg viewBox="0 0 16 16" aria-hidden="true"><path d="M3 8h10M9 4l4 4-4 4"/></svg><span></span></p>
    <div class="tools"><a class="skip t1" id="skip" href="#">Skip to the board</a></div>
  </header>
  <main class="stage" id="wstage"><p class="t1 lost">Your briefing is loading.</p></main>
  <footer class="nav" id="nav">
    <button type="button" class="back t1" id="back"><svg viewBox="0 0 16 16" aria-hidden="true"><path d="M13 8H3M7 4 3 8l4 4"/></svg>Back</button>
    <div class="prog"><span class="rail" aria-hidden="true"><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i></span><span class="count t1" id="count">1 of 8</span></div>
    <button type="button" class="next t1" id="next"><span class="nl">Next</span><svg viewBox="0 0 16 16" aria-hidden="true"><path d="M3 8h10M9 4l4 4-4 4"/></svg></button>
  </footer>
  <section class="pledge" id="pledge" aria-labelledby="oath-h" hidden>
    <div class="pglow" aria-hidden="true"></div><div class="pfield" aria-hidden="true"></div>
    <div class="pin">
      <div class="pseal" id="pseal" aria-hidden="true"></div>
      <h1 class="sr" id="oath-h">Your oath</h1>
      <div class="oath disp" id="oath" role="group" tabindex="-1"></div>
      <div class="pgo">
        <a class="take t1" id="take" href="#"><span class="fill" aria-hidden="true"></span><span>Take office</span><svg viewBox="0 0 16 16" aria-hidden="true"><path d="M3 8h10M9 4l4 4-4 4"/></svg></a>
        <button type="button" class="pback t1" id="pback"><svg viewBox="0 0 16 16" aria-hidden="true"><path d="M13 8H3M7 4 3 8l4 4"/></svg>Back</button>
      </div>
    </div>
  </section>
</div><p class="sr" id="wlive" aria-live="polite"></p>`;
  document.body.append(host);
  const stage = $("#wstage", root);

  let B, F;
  try {
    B = await whenBoard();
    if (!B.walking()) return host.remove();
    F = facts(B.pack);
    await applySkin(B.pack.skin);
  } catch (e) {
    stage.innerHTML = `<p class="t2 lost">The briefing did not load. Reload the page to try again.</p>`;
    throw e;
  }

  // ---------- the facts, all from the pack ----------
  function facts(pack) {
    const w = pack.world, skin = pack.skin;
    const skI = Object.fromEntries(skin.ideologies.map((x) => [x.id, x])), skF = Object.fromEntries((skin.factions || []).map((x) => [x.id, x]));
    const power = {};
    for (const f of w.factions) for (const [id, v] of f.mix || []) power[id] = (power[id] || 0) + v;
    const byId = Object.fromEntries(w.ideologies.map((x) => [x.id, x]));
    const ideos = w.compass.map((id) => byId[id]).filter((x) => x && skI[x.id]).map((x) => ({ id: x.id, name: x.name, stands: x.stands, sk: skI[x.id], power: power[x.id] || 0 }));
    const strong = [...ideos].sort((a, b) => b.power - a.power);
    const holders = [...w.factions, ...w.patrons];
    return {
      ideos, strong, face: strong.find((x) => x.sk.emblem?.kind && x.sk.emblem.kind !== "none") || strong[0],
      facs: w.factions.map((f) => ({ id: f.id, name: f.short || f.name, who: f.who, lean: skI[f.mix?.[0]?.[0]] ?? ideos[0].sk, emblem: skF[f.id]?.emblem })),
      title: w.title, date: MONTH(w.date), polity: w.polity, office: w.office.title, holder: w.office.holder,
      situ: w.timeline?.[0]?.event ?? w.reckoning.meaning,
      res: ["money", "force", "voice", "trust"].map((k) => ({ k, name: w.resources[k].name, icon: w.resources[k].icon, from: holders.filter((h) => h.produces === k).map((h) => h.short || h.name) })),
      months: +w.months, reck: w.reckoning, visions: pack.deck.visions, music: pack.music, world: w,
      oath: w.office?.oath ? { text: w.office.oath, source: w.office.oathSource } : null,
    };
  }

  for (const el of $$(".pfield", root)) { const t = tile(F.strong[0].sk, 0.5); el.style.setProperty("--tile", `url("${t.url}")`); el.style.setProperty("--tsize", `${t.w}px ${t.h}px`); }

  // ---------- the seal: the world's ideologies round its strongest emblem, with an optional legend ring ----------
  function sealSVG(p, legend) {
    const P2 = (r, a) => `${(r * Math.cos(a)).toFixed(2)} ${(r * Math.sin(a)).toFixed(2)}`, gap = 0.04, R1 = 72, R2 = 96, core = F.face;
    const total = F.strong.reduce((a, x) => a + Math.max(x.power, 0.4), 0);
    let a0 = -Math.PI / 2, defs = "", ring = "";
    F.strong.forEach((x, i) => {
      const t = tile(x.sk, 0.3), a1 = a0 + (Math.max(x.power, 0.4) / total) * Math.PI * 2, s = a0 + gap / 2, e = a1 - gap / 2, big = e - s > Math.PI ? 1 : 0;
      defs += `<pattern id="${p}-p${i}" patternUnits="userSpaceOnUse" width="${t.w.toFixed(2)}" height="${t.h.toFixed(2)}"><image href="${t.url}" width="${t.w.toFixed(2)}" height="${t.h.toFixed(2)}"/></pattern>`;
      ring += `<path class="seg" d="M${P2(R2, s)} A${R2} ${R2} 0 ${big} 1 ${P2(R2, e)} L${P2(R1, e)} A${R1} ${R1} 0 ${big} 0 ${P2(R1, s)}Z" fill="url(#${p}-p${i})"/>`;
      a0 = a1;
    });
    const L = 110, vb = legend ? 124 : 100;
    const arc = (id, s) => { const max = Math.PI * L * 0.8, fit = s.length * 7.2 > max ? ` textLength="${max.toFixed(1)}" lengthAdjust="spacingAndGlyphs"` : ""; return `<text><textPath href="#${id}" startOffset="50%" text-anchor="middle"${fit}>${esc(s.toUpperCase())}</textPath></text>`; };
    const leg = legend ? `<path id="${p}-t" d="M${-L} 0A${L} ${L} 0 0 1 ${L} 0"/><path id="${p}-b" d="M${-L} 0A${L} ${L} 0 0 0 ${L} 0"/>` : "";
    const ringTxt = legend ? `<g class="legend">${arc(`${p}-t`, legend[0])}${arc(`${p}-b`, legend[1])}<rect x="-2" y="-2" width="4" height="4" transform="translate(${-L} 0) rotate(45)"/><rect x="-2" y="-2" width="4" height="4" transform="translate(${L} 0) rotate(45)"/></g><circle class="lring" r="${L + 10}"/><circle class="lring" r="${L - 9}"/>` : "";
    const k = 46 / (0.17 * (1 + Math.min(0.4, core.sk.emblem?.pad ?? 0.22)));
    return `<svg viewBox="${-vb} ${-vb} ${2 * vb} ${2 * vb}" aria-hidden="true"><defs>${defs}${leg}<clipPath id="${p}-c"><circle r="68"/></clipPath></defs>${ringTxt}
      <g class="body"><circle r="99" fill="var(--ground)"/><g class="ring">${ring}</g>
      <circle r="98.5" fill="none" stroke="var(--accent)" stroke-width="1.2"/><circle r="70" fill="var(--ground)"/>
      <image href="${dataURL(colorize(renderMedallion(core.sk.recipe, { periods: 2.6 }).svg, pal(core.sk)))}" x="-68" y="-68" width="136" height="136" clip-path="url(#${p}-c)"/>
      <circle r="68" fill="var(--ground)" opacity=".5"/>${core.sk.emblem && core.sk.emblem.kind !== "none" ? colorize(emblem(core.sk.emblem, k), pal(core.sk)) : ""}
      <circle r="68.6" fill="none" stroke="var(--accent)" stroke-width="1.2"/></g></svg>`;
  }

  // ---------- the screens ----------
  const ICON = {
    coin: '<circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="4.8"/>',
    shield: '<path d="M12 3.2 19 6v5.2c0 4.4-2.9 7.8-7 9.6-4.1-1.8-7-5.2-7-9.6V6z"/>',
    screen: '<rect x="3.5" y="5" width="17" height="11.5" rx="1.5"/><path d="M9 20h6M12 16.5V20"/>',
    hand: '<path d="M8 12.5V6a1.5 1.5 0 0 1 3 0v5M11 10.5V4.8a1.5 1.5 0 0 1 3 0v5.7M14 10.5V6.5a1.5 1.5 0 0 1 3 0V14c0 3.7-2.4 6.5-6 6.5-2.4 0-4-1.2-5.3-3.2L3.6 13.6a1.5 1.5 0 0 1 2.5-1.6L8 14.5"/>',
    mast: '<circle cx="12" cy="8.2" r="1.7"/><path d="M12 10.4V21M8.6 21 12 10.4 15.4 21M8.4 4.6a5 5 0 0 0 0 7.2M15.6 4.6a5 5 0 0 1 0 7.2"/>',
    crowd: '<circle cx="9" cy="8" r="3"/><circle cx="16.6" cy="9.4" r="2.4"/><path d="M3.6 20c0-3.5 2.4-5.9 5.4-5.9s5.4 2.4 5.4 5.9M14.6 14.5a4 4 0 0 1 2-.5c2.3 0 3.9 1.9 3.9 5"/>',
  };
  const ROLE = { money: ["Money", "coin"], force: ["Force", "shield"], voice: ["Voice", "mast"], trust: ["Trust", "crowd"] };
  // the world sets the term (owner ruling); a preset sets only drift, the intent line, the acting line and sanctions
  const PRESETS = [
    ["story", "Story", "Low drift. Factions act only under 10."],
    ["standard", "Standard", "The base rules."],
    ["hard", "Hard", "Factions bring their demands at 35, not 30."],
    ["brutal", "Brutal", "Factions act under 20. Double sanctions."],
  ];
  const PRE = Object.fromEntries(PRESETS.map((p) => [p[0], p]));
  // Custom: the same 4 rules as controls, starting from the chosen preset
  const KNOBS = [
    ["drift", "Drift strength", [[RULESETS.story.drift, "low"], [RULESETS.standard.drift, "base"], [RULESETS.brutal.drift, "strong"]]],
    ["intentUnder", "A faction brings its intent under", [[25, "25"], [30, "30"], [35, "35"]]],
    ["actUnder", "A faction acts under", [[10, "10"], [15, "15"], [20, "20"]]],
    ["sanctions", "Patron sanctions", [[0.5, "half"], [1, "base"], [2, "double"]]],
  ];
  const won = badges(B.pack.world.id);
  let diff = "standard", custom = { ...RULESETS.standard }, vision = null, rulesOpen = false;
  const diffLine = () => (diff === "custom" ? "Your own rules, set in the Custom column." : PRE[diff][2]);
  const markCol = (el) => $$("[data-col]", el).forEach((c) => c.classList.toggle("on", c.dataset.col === diff));
  const rules = () => (diff === "custom" ? { ...custom } : diff);
  const head = (h, lede) => `<header class="sh" data-in><h1 class="h disp" id="sh">${h}</h1>${lede ? `<p class="lede t1">${lede}</p>` : ""}</header>`;
  const visionLine = () => (vision ? vision.line : "No aims to check. Only your standing counts at the Reckoning.");
  const and = (a) => (a.length < 2 ? a.join("") : `${a.slice(0, -1).join(", ")} and ${a.at(-1)}`);

  const SCREENS = [
    { name: "The world", spot: "#top .where", where: ["up-left", "the place and the date, top left"],
      html: () => `<div class="s1"><div class="txt">
        <p class="dateline t1" data-in>${esc(F.date)}<span class="dot" aria-hidden="true"></span>${esc(F.polity)}</p>
        <h1 class="h disp big" id="sh" data-in>${esc(F.title)}</h1>
        <p class="office t2" data-in>You rule as ${esc(F.office)}.</p>
        <p class="situ t1" data-in>${esc(F.situ)}</p></div>
        <div class="stamp" data-in>${sealSVG("s1")}</div></div>` },
    { name: "The people", spot: "#factions", where: ["left", "at home, on the left"],
      html: () => `${head(`${cap(word(F.facs.length))} factions hold power at home`, "Every answer moves their support, and each one reacts for its own reasons.")}
        <ul class="facs" style="--n:${F.facs.length > 9 ? 4 : 3}">${F.facs.map((f) => `<li class="fac" data-in><span class="md" style="background-image:${bg(med(f.lean, f.emblem))}"></span><div><p class="fn t2">${esc(f.name)}</p><p class="fw t1">${esc(firstSentence(f.who))}</p></div></li>`).join("")}</ul>` },
    { name: "The ideas", spot: "#tableau", where: ["down", "your record, under the card"],
      html: () => `${head(`Every answer serves one of ${word(F.ideos.length)} ideas`, `Your answers build your record, one stack for each idea. ${cap(word(TUNE.stack.pick))} in a stack give you a pick, ${word(TUNE.stack.power)} a power card, ${word(TUNE.stack.major)} a law.`)}
        <ol class="ideas" style="--n:${F.ideos.length}">${F.ideos.map((x) => { const t = tile(x.sk, 0.5); return `<li class="idea" data-in><span class="it" style="--tile:${bg(t.url)};--ts:${t.w}px ${t.h}px"><i class="glint"></i></span><p class="in t2">${esc(x.name)}</p><p class="is t1">${esc(firstSentence(x.stands))}</p></li>`; }).join("")}</ol>` },
    { name: "Your means", spot: "#res", where: ["up-right", "your resources, top right"],
      html: () => `${head("Four means to rule", "Cards cost these. If you lack Force, Voice or Trust, the card is blocked. Money can go into debt.")}
        <ul class="means">${F.res.map((r) => `<li class="mean" data-role="${r.k}" data-in><span class="ico"><svg viewBox="0 0 24 24" aria-hidden="true">${ICON[r.icon] ?? ICON[ROLE[r.k][1]]}</svg></span><p class="mn t2">${esc(r.name)}</p><p class="mr t1">${ROLE[r.k][0]}</p>${r.from.length ? `<p class="mf t1">From ${esc(and(r.from))}</p>` : ""}</li>`).join("")}</ul>` },
    { name: "The clock", spot: ".sealb, .hg", where: ["up", "the seal and the hourglass, at the top"],
      html: () => `${head(`${cap(word(F.months))} months`, `The Reckoning comes in ${esc(MONTH(F.reck.date))}.`)}
        <div class="clock" data-in><p class="from t1">Month 1 is ${esc(F.date)}</p><ol class="ruler" style="--m:${F.months}" aria-label="${F.months} months, then the Reckoning">${Array.from({ length: F.months }, (_, i) => `<li class="mo${i ? "" : " now"}"><i></i><span class="t1">${i + 1}</span></li>`).join("")}<li class="mo rk"><i></i><span class="t1">Reckoning</span></li></ol></div>
        <div class="reck" data-in><p class="rn t2 disp">${esc(F.reck.name)}</p><p class="rm t1">${esc(F.reck.meaning)}</p><p class="rr t1">At the Reckoning, your standing must be 50 or more.</p></div>` },
    { name: "Difficulty", spot: null,
      html: () => `${head("Choose how hard", "The world stays the same. The rules change.")}
        <div class="diffbox" data-in><fieldset class="seg"><legend class="sr">Difficulty</legend>${[...PRESETS, ["custom", "Custom"]].map(([id, n]) => `<label class="sg"><input type="radio" name="diff" value="${id}"${diff === id ? " checked" : ""}><span class="t1">${n}</span></label>`).join("")}</fieldset>
        <p class="dl t1" id="dl" aria-live="polite">${diffLine()}</p></div>
        <div class="custom" data-in><button type="button" class="more t1" id="more" aria-expanded="${rulesOpen}" aria-controls="rules">Custom rules<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M4 6l4 4 4-4"/></svg></button>
        <div class="rules" id="rules"${rulesOpen ? "" : " hidden"}><table class="t1"><caption class="sr">The four rules each preset sets, and your own</caption><thead><tr><th scope="col">Rule</th>${PRESETS.map(([id, n]) => `<th scope="col" data-col="${id}">${n}</th>`).join("")}<th scope="col" data-col="custom">Custom</th></tr></thead>
        <tbody>${KNOBS.map(([k, label, opts]) => `<tr><th scope="row">${label}</th>${PRESETS.map(([id]) => `<td data-col="${id}">${opts.find(([v]) => v === RULESETS[id][k])?.[1] ?? RULESETS[id][k]}</td>`).join("")}<td data-col="custom"><select class="knob t1" data-k="${k}" aria-label="${label}, Custom">${opts.map(([v, n]) => `<option value="${v}"${custom[k] === v ? " selected" : ""}>${n}</option>`).join("")}</select></td></tr>`).join("")}</tbody></table>
        <p class="t1 soft">Change a rule in the Custom column to make your own.</p></div></div>` },
    { name: "A Vision", spot: null,
      html: () => `${head("Choose a Vision", "A Vision is a set of aims, checked at the Reckoning. Or rule with a free hand.")}
        <fieldset class="vlist" data-in><legend class="sr">Vision</legend>${[...F.visions, null].map((v) => { const sk = v && F.ideos.find((x) => x.id === v.corner)?.sk;
          return `<label class="vrow${v ? "" : " free"}"><input type="radio" name="vision" value="${v ? v.id : ""}"${(vision?.id ?? null) === (v?.id ?? null) ? " checked" : ""}><span class="vm${sk ? "" : v?.corner === "centre" ? " centre" : " plain"}"${sk ? ` style="background-image:${bg(med(sk))}"` : ""}></span><span class="vn t1">${v ? esc(v.name) : "Free hand"}</span><span class="vp t1">${v ? esc(phrase(v.line)) : "No Vision"}${v && won[v.id] ? ` · Fulfilled on ${esc(won[v.id].map(cap).join(", "))}` : ""}</span><span class="on-mark" aria-hidden="true"></span></label>`; }).join("")}</fieldset>
        <p class="vline t1" id="vline" aria-live="polite" data-in>${esc(visionLine())}</p>` },
    { name: "The pledge", spot: null },
  ];
  const N = SCREENS.length, ROT = { left: 180, up: -90, down: 90, "up-left": -135, "up-right": -45 };

  // ---------- the board behind: dimmed, the area each screen explains lit; the panel sits over the centre and the hand ----------
  B.dim?.(true);
  function place() {
    const c = $("#center")?.getBoundingClientRect(), r = $("#right")?.getBoundingClientRect();
    if (!c?.width || !r?.width) return;
    const s = $("#walk", root).style;
    s.setProperty("--bx", `${c.left}px`); s.setProperty("--by", `${c.top}px`); s.setProperty("--bw", `${r.right - c.left}px`); s.setProperty("--bh", `${c.bottom - c.top}px`);
  }
  place(); [300, 1000, 2500].forEach((t) => setTimeout(place, t));
  addEventListener("resize", () => requestAnimationFrame(place));

  let cur = -1, sworn = false, leavingNow = false;
  function footer() {
    $("#count", root).textContent = `${Math.min(cur + 1, N)} of ${N}`;
    $$(".rail i", root).forEach((el, i) => { el.classList.toggle("done", i < cur); el.classList.toggle("on", i === cur); });
    $("#nav", root).toggleAttribute("data-first", cur === 0);
    const nl = cur === N - 2 ? "Take the oath" : "Next";
    if ($("#next .nl", root).textContent !== nl) $("#next .nl", root).textContent = nl;
    const w = SCREENS[cur].where, el = $("#where", root);
    el.classList.toggle("off", !w);
    if (w) { $("span", el).textContent = `On the board: ${w[1]}`; $("svg", el).style.transform = `rotate(${ROT[w[0]]}deg)`; }
  }
  function go(k) {
    k = Math.max(0, Math.min(N - 1, k));
    if (k === cur || leavingNow) return;
    const dir = k > cur ? 1 : -1, first = cur < 0;
    cur = k;
    footer();
    B.spot?.(SCREENS[k].spot);
    $("#wlive", root).textContent = `${k + 1} of ${N}. ${SCREENS[k].name}.`;
    if (k === N - 1) return swear(first);
    root.dataset.screen = k + 1;
    if (sworn) unswear();
    for (const o of $$(".scr, .lost", stage)) {
      if (o.classList.contains("leaving")) { gsap.killTweensOf(o); o.remove(); continue; }
      o.classList.add("leaving"); o.inert = true;
      gsap.killTweensOf(o); gsap.set(o, { "--w": "0%" }); o.classList.remove("wiping", "back");
      gsap.to(o, RM ? { opacity: 0, duration: 0.2, ease: "soft", onComplete: () => o.remove() } : { opacity: 0, x: -24 * dir, duration: 0.25, ease: "swift", onComplete: () => o.remove() });
    }
    const el = document.createElement("section");
    el.className = `scr s-${k + 1}`;
    el.innerHTML = SCREENS[k].html();
    const h = $("#sh", el); h.id = `sh-${k + 1}`; h.tabIndex = -1;
    el.setAttribute("aria-labelledby", h.id);
    stage.append(el);
    bind(el);
    enter(el, dir, k, first, () => { if (el.isConnected && !el.classList.contains("leaving") && !el.contains(shadow.activeElement)) h.focus({ preventScroll: true }); });
  }
  function enter(el, dir, k, first, done) {
    const parts = $$("[data-in]", el);
    if (RM) gsap.fromTo(el, { opacity: 0 }, { opacity: 1, duration: 0.3, ease: "soft", clearProps: "opacity", onComplete: done });
    else if (first) gsap.fromTo(parts, { opacity: 0, y: 12 }, { opacity: 1, y: 0, duration: 0.7, stagger: 0.07, ease: "settle", clearProps: "opacity,transform", onComplete: done });
    else {
      el.classList.add("wiping"); el.classList.toggle("back", dir < 0);
      gsap.fromTo(el, { "--w": "100%" }, { "--w": "0%", duration: 0.42, ease: "sweep", onComplete: () => { el.classList.remove("wiping", "back"); done(); } });
      gsap.fromTo(parts, { opacity: 0, x: 12 * dir }, { opacity: 1, x: 0, duration: 0.32, stagger: 0.03, delay: 0.1, ease: "settle", clearProps: "opacity,transform" });
    }
    if (RM) return;
    const at = first ? 0.5 : 0.35;
    if (k === 0) gsap.fromTo($(".stamp svg .body", el), { rotation: -14, scale: 0.9, svgOrigin: "0 0" }, { rotation: -6, scale: 1, duration: 1.6, ease: "sweep", delay: Math.max(0, at - 0.3) });
    if (k === 2) {
      const tl = gsap.timeline({ delay: at });
      $$(".idea", el).forEach((li, i) => {
        const t = $(".it", li), g = $(".glint", li), n = $(".in", li);
        tl.fromTo(t, { filter: "brightness(1) saturate(1)" }, { filter: "brightness(1.55) saturate(1.25)", duration: 0.24, ease: "soft", yoyo: true, repeat: 1, clearProps: "filter" }, i * 0.26)
          .fromTo(g, { opacity: 1, backgroundPosition: "130% 0" }, { backgroundPosition: "-30% 0", duration: 0.5, ease: "swift" }, i * 0.26)
          .to(g, { opacity: 0, duration: 0.2, ease: "soft" }, i * 0.26 + 0.4)
          .fromTo(n, { color: "var(--accent)" }, { color: "var(--ink)", duration: 0.8, ease: "soft", clearProps: "color" }, i * 0.26);
      });
    }
    if (k === 4) gsap.fromTo($$(".mo:not(.rk) i", el), { scaleY: 0 }, { scaleY: 1, duration: 0.3, stagger: 0.02, delay: 0.15, ease: "settle", clearProps: "transform" });
  }
  const swapText = (el, t) => { if (!el || el.textContent === t) return; gsap.timeline().to(el, { opacity: 0, duration: 0.12, ease: "soft" }).call(() => (el.textContent = t)).to(el, { opacity: 1, duration: 0.2, ease: "soft" }); };
  function syncKnobs(el) { for (const s of $$(".knob", el)) s.value = String(custom[s.dataset.k]); }
  function bind(el) {
    markCol(el);
    for (const r of $$('input[name="diff"]', el)) r.addEventListener("change", () => {
      if (r.value !== "custom") custom = { ...RULESETS[r.value] };
      diff = r.value; syncKnobs(el); markCol(el);
      swapText($("#dl", el), diffLine());
    });
    for (const s of $$(".knob", el)) s.addEventListener("change", () => {
      custom = { ...custom, [s.dataset.k]: Number(s.value) };
      diff = "custom"; markCol(el);
      const c = $('input[name="diff"][value="custom"]', el); if (c) c.checked = true;
      swapText($("#dl", el), diffLine());
    });
    for (const r of $$('input[name="vision"]', el)) r.addEventListener("change", () => {
      vision = F.visions.find((v) => v.id === r.value) ?? null;
      swapText($("#vline", el), visionLine());
    });
    const more = $("#more", el);
    if (more) more.addEventListener("click", () => {
      rulesOpen = !rulesOpen; more.setAttribute("aria-expanded", rulesOpen);
      const box = $("#rules", el);
      if (rulesOpen) { box.hidden = false; gsap.fromTo(box, { opacity: 0, y: RM ? 0 : -6 }, { opacity: 1, y: 0, duration: 0.3, ease: "settle", clearProps: "opacity,transform" }); }
      else gsap.to(box, { opacity: 0, duration: 0.2, ease: "swift", onComplete: () => { box.hidden = true; gsap.set(box, { clearProps: "opacity" }); } });
    });
  }

  // ---------- the pledge: the world's own oath, word for word ----------
  function oath() {
    const o = F.oath, text = o?.text ?? `I take the office of ${F.office} of ${F.polity}, and I will hold it until ${esc(MONTH(F.reck.date))}.`;
    const html = `<p class="ot" id="ot" lang="en" data-l>${esc(text)}</p><p class="ov t1" data-l>Your Vision: ${vision ? esc(vision.name) : "a free hand"}</p><p class="osrc t1" data-l>${esc(o?.source ?? `${F.office}, ${MONTH(F.reck.date)}`)}</p>`;
    return { html, label: text };
  }
  let pledgeTl = null;
  function swear(first) {
    sworn = true;
    const P = $("#pledge", root), seal = $("#pseal", root), o = oath(), take = $("#take", root), fill = $(".fill", take);
    seal.innerHTML = sealSVG("ps", [F.title, `${F.date} · ${F.polity}`]);
    $("#oath", root).innerHTML = o.html; $("#oath", root).setAttribute("aria-label", o.label);
    take.classList.remove("lit");
    const old = $$(".scr", stage);
    old.forEach((x) => { x.classList.add("leaving"); x.inert = true; gsap.killTweensOf(x); });
    const show = () => { old.forEach((x) => x.remove()); root.dataset.screen = N; gsap.set($(".nav", root), { clearProps: "opacity" }); gsap.set(P, { opacity: 0 }); P.hidden = false; $("#oath", root).focus({ preventScroll: true }); };
    const lit = () => take.classList.add("lit");
    B.music?.swell?.(true);
    pledgeTl?.kill();
    const lines = $$("[data-l]", P), out = first ? [] : [...old, $(".nav", root)];
    if (RM) {
      pledgeTl = gsap.timeline();
      if (out.length) pledgeTl.to(out, { opacity: 0, duration: 0.25, ease: "swift" });
      pledgeTl.call(show).fromTo(P, { opacity: 0 }, { opacity: 1, duration: 0.35, ease: "soft", immediateRender: false }).set(fill, { scaleX: 1 }).call(lit);
      return;
    }
    const T = lines.length * 0.75;
    pledgeTl = gsap.timeline();
    if (out.length) pledgeTl.to(out, { opacity: 0, duration: 0.3, ease: "swift" });
    pledgeTl.call(show)
      .fromTo(P, { opacity: 0 }, { opacity: 1, duration: 0.5, ease: "soft", immediateRender: false }, ">")
      .fromTo($(".pglow", P), { opacity: 0 }, { opacity: 1, duration: 2.4, ease: "soft" }, "<")
      .fromTo($(".pfield", P), { opacity: 0 }, { opacity: 0.12, duration: 3, ease: "soft" }, "<")
      .fromTo($("svg .body", seal), { rotation: -24, scale: 0.82, opacity: 0, svgOrigin: "0 0" }, { rotation: -6, scale: 1, opacity: 1, duration: 1.8, ease: "sweep" }, "<0.15")
      .fromTo($("svg .legend", seal), { opacity: 0, rotation: 30, svgOrigin: "0 0" }, { opacity: 1, rotation: 0, duration: 2.2, ease: "settle" }, "<0.2")
      .fromTo($$("svg .lring", seal), { opacity: 0 }, { opacity: 1, duration: 1.4, ease: "soft" }, "<0.15")
      .fromTo(lines, { opacity: 0, y: 14, filter: "blur(6px)" }, { opacity: 1, y: 0, filter: "blur(0px)", duration: 1.2, stagger: 0.75, ease: "settle", clearProps: "filter,transform" }, "<0.45")
      .fromTo(fill, { scaleX: 0 }, { scaleX: 1, duration: 1, ease: "sweep" }, `<${T + 0.2}`)
      .call(lit, null, "<0.55")
      .fromTo($(".pback", P), { opacity: 0 }, { opacity: 1, duration: 0.6, ease: "soft" }, "<");
  }
  function unswear() {
    sworn = false;
    pledgeTl?.kill(); pledgeTl = null;
    const P = $("#pledge", root);
    gsap.set($(".nav", root), { clearProps: "opacity" });
    gsap.to(P, { opacity: 0, duration: RM ? 0.25 : 0.3, ease: "soft", onComplete: () => { if (!sworn) P.hidden = true; } });
    B.music?.swell?.(false);
  }
  // Take office (or Skip): the panel leaves, the board lights, and the term starts with the choices made so far
  function leave(e) {
    e?.preventDefault();
    if (leavingNow) return;
    if (pledgeTl?.isActive()) { pledgeTl.progress(1); return; } // the ceremony is skipped to its end, not past it
    leavingNow = true;
    B.music?.swell?.(false);
    B.spot?.(null);
    B.dim?.(false);
    gsap.to(root, { opacity: 0, duration: RM ? 0.35 : 0.8, ease: "soft", onComplete: () => host.remove() });
    const url = new URL(location.href);
    url.searchParams.delete("walk");
    history.replaceState(null, "", url);
    B.newTerm({ rules: rules(), vision: vision?.id ?? null });
  }

  $("#next", root).addEventListener("click", () => go(cur + 1));
  $("#back", root).addEventListener("click", () => go(cur - 1));
  $("#pback", root).addEventListener("click", () => go(N - 2));
  $("#take", root).addEventListener("click", (e) => { if (cur === N - 1) leave(e); });
  $("#skip", root).addEventListener("click", leave);
  addEventListener("keydown", (e) => {
    if (!host.isConnected || e.metaKey || e.ctrlKey || e.altKey || e.defaultPrevented) return;
    const t = e.composedPath()[0], form = t.matches?.('input[type="radio"], select');
    if (e.key === "ArrowRight" && !form) { e.preventDefault(); if (cur < N - 1) go(cur + 1); }
    else if (e.key === "ArrowLeft" && !form) { e.preventDefault(); go(cur - 1); }
    else if (e.key === "Enter" && !t.closest?.("a, button, summary, select")) { e.preventDefault(); cur === N - 1 ? leave() : go(cur + 1); }
  }, { capture: true });
  go(0);
}
