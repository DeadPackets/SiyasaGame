// Tooltips: open after 120 ms, lock after 0.6 s so the cursor can enter, nest on keywords inside a tooltip,
// close when the cursor leaves the whole stack. Never placed over the element they explain. Keyboard: focus opens, Esc closes.
const OPEN = 120, LOCK = 600, GAP = 10, EDGE = 8;
const EASE = "cubic-bezier(.37,0,.63,1)", RM = () => matchMedia("(prefers-reduced-motion: reduce)").matches; // "soft" in DESIGN.md

// beside its anchor, never over it; `prefer` (side names) overrides the default order (the tutor uses it)
export function place(el, anchor, parent, prefer) {
  // a nested tooltip sits beside its parent tooltip, level with the keyword, so it covers neither
  const k = anchor.getBoundingClientRect(), pr = parent?.getBoundingClientRect();
  // an anchor inside [data-tip-left] opens to the left of that whole area (the hand: never over a neighbour card)
  const side = !pr && anchor.closest("[data-tip-left]")?.getBoundingClientRect();
  const box = pr || side;
  const a = box ? { left: box.left, right: box.right, top: k.top, bottom: k.bottom, width: box.width, height: k.height } : k;
  const t = el.getBoundingClientRect(), W = innerWidth, H = innerHeight;
  const clampX = (x) => Math.max(EDGE, Math.min(W - EDGE - t.width, x)), clampY = (y) => Math.max(EDGE, Math.min(H - EDGE - t.height, y));
  const right = [a.right + GAP, clampY(a.top + a.height / 2 - t.height / 2)], left = [a.left - GAP - t.width, clampY(a.top + a.height / 2 - t.height / 2)];
  const above = [clampX(a.left + a.width / 2 - t.width / 2), a.top - GAP - t.height], below = [clampX(a.left + a.width / 2 - t.width / 2), a.bottom + GAP];
  const order = prefer ? prefer.map((s) => ({ right, left, above, below })[s]) : side ? [left] : a.left + a.width / 2 < W / 2 ? [right, above, below, left] : [left, above, below, right];
  const fits = ([x, y]) => x >= EDGE && y >= EDGE && x + t.width <= W - EDGE && y + t.height <= H - EDGE;
  // never over an element marked data-tip-avoid (the centre card preview); try every side before giving in
  const avoid = [...document.querySelectorAll("[data-tip-avoid]")].map((e) => e.getBoundingClientRect());
  const clear = ([x, y]) => avoid.every((r) => x + t.width <= r.left || x >= r.right || y + t.height <= r.top || y >= r.bottom);
  // last try: slide the below and above spots sideways until they clear the box
  const slid = avoid.flatMap((r) => [below, above].flatMap(([, y]) => [[r.left - GAP - t.width, y], [r.right + GAP, y]]));
  const mid = a.left + a.width / 2, near = (p) => Math.abs(p[0] + t.width / 2 - mid);
  // a top-bar tip drops below, beside the preview on the anchor's side, so it covers nothing in the bar
  const all = anchor.closest("#top") ? [below, ...slid.sort((p, q) => near(p) - near(q)), ...order] : [...order, right, left, above, below, ...slid];
  const [x, y] = all.find((p) => fits(p) && clear(p)) || order.find(fits) || order[0];
  el.style.left = `${Math.round(x)}px`; el.style.top = `${Math.round(y)}px`;
}

export function makeTips(resolve) {
  const layer = document.getElementById("tips");
  const stack = []; // { anchor, el, locked, lockT }
  let openT = null, closeT = null, pending = null, px = -1, py = -1, seq = 0;

  function closeFrom(level) {
    while (stack.length > level) {
      const e = stack.pop(); clearTimeout(e.lockT); e.anchor.removeAttribute("aria-describedby");
      // ease out, never just vanish
      const el = e.el; el.style.pointerEvents = "none"; el.removeAttribute("id");
      const a = el.animate?.([{ opacity: 1, transform: "none" }, { opacity: 0, transform: "translateY(3px)" }], { duration: RM() ? 1 : 140, easing: EASE, fill: "forwards" });
      if (a) a.onfinish = () => el.remove(); else el.remove();
    }
  }
  function levelOf(node) { for (let i = stack.length - 1; i >= 0; i--) if (stack[i].el.contains(node)) return i + 1; return 0; }

  function open(anchor) {
    const level = levelOf(anchor);
    if (stack[level]?.anchor === anchor) return;
    // a hand card already shows large in the centre preview; its tip would only repeat it
    if (anchor.closest("#hand") && document.querySelector("#fx .pop.mid")) return;
    const html = resolve(anchor.dataset.tip, anchor);
    closeFrom(level);
    if (!html) return;
    const el = document.createElement("div");
    el.className = "tip"; el.id = `tip${++seq}`; el.setAttribute("role", "tooltip"); el.innerHTML = html; el._anchor = anchor;
    el.querySelectorAll("[tabindex]").forEach((k) => (k.tabIndex = -1)); // keywords inside a tooltip are for the pointer; Tab stays on the board
    layer.append(el); place(el, anchor, level ? stack[level - 1].el : null);
    anchor.setAttribute("aria-describedby", el.id);
    const entry = { anchor, el, locked: false };
    entry.lockT = setTimeout(() => { entry.locked = true; el.classList.add("locked"); }, LOCK);
    stack.push(entry);
    el.animate?.([{ opacity: 0, transform: "translateY(4px)" }, { opacity: 1, transform: "none" }], { duration: RM() ? 1 : 180, easing: EASE });
  }

  // keep every level whose anchor is under the pointer, or whose tooltip is locked and under the pointer
  function check() {
    const under = px < 0 ? null : document.elementFromPoint(px, py);
    let keep = 0;
    stack.forEach((e, i) => { if (under && (e.anchor.contains(under) || (e.locked && e.el.contains(under)))) keep = i + 1; });
    closeFrom(keep);
    if (pending && !(under && pending.contains(under))) { clearTimeout(openT); pending = null; }
  }

  addEventListener("pointermove", (e) => { px = e.clientX; py = e.clientY; }, { passive: true });
  document.addEventListener("pointerover", (e) => {
    // also catches an anchor that was re-rendered under the cursor and never sent pointerout
    clearTimeout(closeT); closeT = setTimeout(check, 140);
    const t = e.target.closest?.("[data-tip]");
    if (!t || t === pending || stack.some((s) => s.anchor === t)) return;
    clearTimeout(openT); pending = t;
    openT = setTimeout(() => { pending = null; open(t); }, OPEN);
  });
  document.addEventListener("pointerout", () => { clearTimeout(closeT); closeT = setTimeout(check, 140); });
  // keyboard focus only; a mouse click that focuses a row must not pin its tooltip open
  document.addEventListener("focusin", (e) => { const t = e.target.closest?.("[data-tip]"); if (t && e.target.matches(":focus-visible")) open(t); });
  document.addEventListener("focusout", (e) => {
    const t = e.target.closest?.("[data-tip]");
    if (!t) return;
    setTimeout(() => { const i = stack.findIndex((s) => s.anchor === t); if (i >= 0 && !stack[i].el.contains(document.activeElement) && document.activeElement !== t) closeFrom(i); }, 0);
  });
  addEventListener("keydown", (e) => { if (e.key === "Escape") closeFrom(0); });
  document.addEventListener("pointerdown", (e) => { if (!e.target.closest?.(".tip")) closeFrom(0); }, true);

  return { closeAll: () => closeFrom(0), refresh: () => { for (const s of stack) s.el.innerHTML = resolve(s.anchor.dataset.tip, s.anchor) || s.el.innerHTML; } };
}
