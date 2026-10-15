import { gsap, RM } from "../shared/motion.js";
import { badges, playedOn } from "../shared/badges.js";
import { $, $$, esc, ARROW, MONTH, medData, face, json, worldCard } from "./common.js";

const ERAS = [["ancient", "Ancient", -1e9, 499], ["medieval", "Medieval", 500, 1499], ["early", "Early modern", 1500, 1799], ["modern", "Modern", 1800, 1945], ["now", "Contemporary", 1946, 2030], ["future", "Future", 2031, 1e9]];
const STATES = [["new", "Not played"], ["played", "Played"], ["vision", "Vision fulfilled"]];
// pack dates are "YYYY-MM[-DD]" with a possibly negative (BC) year: one sortable number
const when = (d) => { const m = /^(-?\d+)(?:-(\d{2}))?(?:-(\d{2}))?/.exec(String(d)); return m ? +m[1] * 10000 + +(m[2] || 0) * 100 + +(m[3] || 0) : NaN; };
const eraOf = (d) => { const y = Math.trunc(when(d) / 10000); return ERAS.find(([, , lo, hi]) => y >= lo && y <= hi)?.[0]; };
const stateOf = (w) => (Object.keys(badges(w.id)).length ? "vision" : playedOn(w.id) ? "played" : "new");
const SORTS = { played: (a, b) => b.plays - a.plays || b.created - a.created, new: (a, b) => b.created - a.created, old: (a, b) => when(a.date) - when(b.date), late: (a, b) => when(b.date) - when(a.date) };

const P = new URLSearchParams(location.search);
const S = { q: P.get("q") || "", era: P.get("era") || "", state: P.get("state") || "", mine: P.get("mine") === "1", sort: SORTS[P.get("sort")] ? P.get("sort") : "played" };
let LIST = [], MINE = new Set();
const cards = new Map();

async function main() {
  try { LIST = (await json("/api/worlds")) || []; } catch (e) { console.warn("library unavailable", e); $("#count").textContent = "The library did not load. Reload the page to try again."; return; }
  for (const w of LIST) { w.era = eraOf(w.date); w.hay = [w.title, w.polity, w.date, MONTH(w.date), w.blurb].join(" ").toLowerCase(); }
  const first = LIST[0]?.card?.ideologies;
  if (first?.length) $(".mark .mk").style.backgroundImage = `url("${medData(face(first))}")`;
  $(".spines").innerHTML = LIST.map((w) => (w.card?.ideologies?.[0] ? `<i style="background:${w.card.ideologies[0].a}"></i>` : "")).join("");
  chips($("#eras"), "era", [["", "All eras"], ...ERAS.map(([id, label]) => [id, label, LIST.filter((w) => w.era === id).length]).filter((x) => x[2])]);
  chips($("#states"), "state", [["", "Any record"], ...STATES.map(([id, label]) => [id, label, LIST.filter((w) => stateOf(w) === id).length])]);
  const q = $("#q"), sort = $("#sort");
  q.value = S.q; sort.value = S.sort;
  q.addEventListener("input", () => { S.q = q.value; show(); });
  sort.addEventListener("change", () => { S.sort = sort.value; show(); });
  show(true);
  mine().catch((e) => console.warn("your worlds unavailable", e));
}

// one choice per group; the pressed chip again clears it
function chips(box, key, items) {
  box.innerHTML = items.map(([id, label, n]) => `<button type="button" class="t1" data-v="${id}" aria-pressed="${S[key] === id}">${esc(label)}${n != null ? `<span class="n">${n}</span>` : ""}</button>`).join("");
  box.addEventListener("click", (e) => {
    const b = e.target.closest("button");
    if (!b) return;
    S[key] = S[key] === b.dataset.v ? "" : b.dataset.v;
    $$("button", box).forEach((x) => x.setAttribute("aria-pressed", String(x.dataset.v === S[key])));
    show();
  });
}

async function mine() {
  const m = await json("/api/mine");
  MINE = new Set((m?.worlds || []).map((w) => w.id));
  const n = LIST.filter((w) => MINE.has(w.id)).length;
  if (!n) { if (S.mine) { S.mine = false; show(); } return; }
  const box = document.createElement("div");
  box.className = "chips"; box.setAttribute("role", "group"); box.setAttribute("aria-label", "Built by you");
  box.innerHTML = `<button type="button" class="t1" aria-pressed="${S.mine}">Your worlds<span class="n">${n}</span></button>`;
  box.firstChild.onclick = () => { S.mine = !S.mine; box.firstChild.setAttribute("aria-pressed", String(S.mine)); show(); };
  $(".rows").append(box);
  if (S.mine) show();
}

function show(first) {
  const terms = S.q.trim().toLowerCase().split(/\s+/).filter(Boolean);
  const hits = LIST.filter((w) => terms.every((t) => w.hay.includes(t)) && (!S.era || w.era === S.era) && (!S.state || stateOf(w) === S.state) && (!S.mine || MINE.has(w.id))).sort(SORTS[S.sort]);
  const els = hits.map((w) => { if (!cards.has(w.id)) cards.set(w.id, worldCard(w)); return cards.get(w.id); });
  const before = new Set($("#grid").children);
  $("#grid").replaceChildren(...els);
  $("#count").innerHTML = hits.length === LIST.length ? `<b>${LIST.length}</b> ${LIST.length === 1 ? "world" : "worlds"}` : `<b>${hits.length}</b> of ${LIST.length} worlds`;
  empty(hits.length, S.q.trim());
  const u = new URLSearchParams();
  if (S.q.trim()) u.set("q", S.q.trim());
  if (S.era) u.set("era", S.era);
  if (S.state) u.set("state", S.state);
  if (S.mine) u.set("mine", "1");
  if (S.sort !== "played") u.set("sort", S.sort);
  history.replaceState(null, "", `${location.pathname}${u.size ? `?${u}` : ""}`);
  gsap.fromTo(els.filter((li) => !before.has(li)).slice(0, 24), { opacity: 0, y: RM || !first ? 0 : 10 }, { opacity: 1, y: 0, duration: RM ? 0.2 : first ? 0.45 : 0.25, stagger: RM ? 0 : first ? 0.03 : 0.015, ease: "settle" });
}

// nothing fits: a search can become a prompt; filters alone can be cleared
function empty(n, q) {
  const box = $("#none");
  box.hidden = n > 0 || !LIST.length && !q;
  if (!LIST.length && !q) return ($("#count").textContent = "The library is empty. Build the first world.");
  if (n) return;
  const filtered = S.era || S.state || S.mine;
  box.innerHTML = q
    ? `<p class="t2">No world in the library matches “${esc(q)}”${filtered ? " with these filters" : ""}.</p><p class="t1 soft">Siyasa can build it for you. It takes about 15 minutes.</p><div class="acts"><a class="go t1" href="/?prompt=${encodeURIComponent(q.slice(0, 240))}">Build it instead${ARROW}</a>${filtered ? `<button type="button" class="clear t1">Clear the filters</button>` : ""}</div>`
    : `<p class="t2">No world fits these filters.</p><div class="acts"><button type="button" class="clear t1">Clear the filters</button></div>`;
  const c = $(".clear", box);
  if (c) c.onclick = () => { Object.assign(S, { era: "", state: "", mine: false }); $$(".chips button").forEach((x) => x.setAttribute("aria-pressed", String(x.dataset.v === ""))); show(); };
}

main();
