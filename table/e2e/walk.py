# The briefing over the dimmed board: 8 screens, Custom rules, a Vision, the pledge, Take office starts the term.
#   uv run --with playwright python table/e2e/walk.py [world-id]   (dev server on :5184)
import json, sys
from pathlib import Path
from playwright.sync_api import sync_playwright

OUT = Path(__file__).parent / "out" / "walk"; OUT.mkdir(parents=True, exist_ok=True)
W = sys.argv[1] if len(sys.argv) > 1 else "egypt-2011"
URL = f"http://localhost:5184/play?w={W}&walk=1&tutor=0"
fails, errs = [], []
def ok(c, m): (None if c else fails.append(m)); print(("PASS " if c else "FAIL ") + m)
with sync_playwright() as p:
    b = p.chromium.launch()
    pg = b.new_page(viewport={"width": 1440, "height": 900})
    pg.on("console", lambda m: m.type == "error" and errs.append(m.text))
    pg.on("pageerror", lambda e: errs.append(str(e)))
    S = "document.getElementById('briefing').shadowRoot"
    pg.goto(URL)
    try: pg.wait_for_function(f"document.getElementById('briefing')?.shadowRoot?.querySelector('.scr')", timeout=20000)
    except Exception: pg.screenshot(path=str(OUT / f"{W}-stuck.png")); print("STUCK", errs[:5]); raise
    for i in range(1, 8):
        pg.wait_for_timeout(900)
        pg.screenshot(path=str(OUT / f"{W}-s{i}.png"))
        h = pg.evaluate(f"{S}.querySelector('.scr:not(.leaving) h1')?.textContent")
        ok(bool(h), f"screen {i}: {h}")
        if i == 6:
            pg.evaluate(f"(() => {{ const r = {S}; r.querySelector('#more').click(); const s = r.querySelector('.knob[data-k=actUnder]'); s.value = '20'; s.dispatchEvent(new Event('change')); }})()")
            ok(pg.evaluate(f"{S}.querySelector('input[name=diff][value=custom]').checked"), "a knob switches to Custom")
            pg.screenshot(path=str(OUT / f"{W}-s6-custom.png"))
        if i == 7:
            pg.evaluate(f"{S}.querySelector('input[name=vision]').click()")
        pg.evaluate(f"{S}.querySelector('#next').click()")
    pg.wait_for_timeout(6000)
    pg.screenshot(path=str(OUT / f"{W}-s8-pledge.png"))
    ok(pg.evaluate(f"{S}.querySelector('#take').classList.contains('lit')"), "the pledge lights Take office")
    pg.evaluate(f"{S}.querySelector('#take').click()")
    pg.wait_for_timeout(2500)
    st = pg.evaluate("(() => { const g = window.board.state(); return { phase: window.board.phase(), vision: g.vision, rules: g.rules, month: g.month, walk: !!document.getElementById('briefing') }; })()")
    pg.screenshot(path=str(OUT / f"{W}-board.png"))
    ok(not st["walk"], "the briefing is gone after Take office")
    ok(st["vision"] is not None and st["rules"] and st["rules"].get("actUnder") == 20, f"the term carries the Vision and Custom rules: {json.dumps(st)[:200]}")
    ok(not errs, f"console errors: {errs[:3]}")
    b.close()
(OUT / f"{W}-result.json").write_text(json.dumps({"fails": fails, "errors": errs}, indent=1))
sys.exit(1 if fails else 0)
