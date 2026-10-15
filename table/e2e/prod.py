# Production smoke: landing and each library world's briefing load with 0 console errors.
#   uv run --with playwright python table/e2e/prod.py [base-url]
import json, sys, urllib.request
from pathlib import Path
from playwright.sync_api import sync_playwright

BASE = sys.argv[1] if len(sys.argv) > 1 else "https://siyasa.deadpackets.pw"
OUT = Path(__file__).parent / "out" / "prod"; OUT.mkdir(parents=True, exist_ok=True)
worlds = [w["id"] for w in json.load(urllib.request.urlopen(urllib.request.Request(f"{BASE}/api/worlds", headers={"user-agent": "Mozilla/5.0 siyasa-e2e"})))]
fails = []
def ok(c, m): (None if c else fails.append(m)); print(("PASS " if c else "FAIL ") + m)
with sync_playwright() as p:
    b = p.chromium.launch()
    for path, name, ready in [("/", "landing", "document.querySelector('#prompt, textarea, input[type=text]')")] + [(f"/play?w={w}&walk=1&tutor=0", w, "document.getElementById('briefing')?.shadowRoot?.querySelector('.scr')") for w in worlds]:
        pg = b.new_page(viewport={"width": 1440, "height": 900}); errs = []
        pg.on("console", lambda m: m.type == "error" and errs.append(m.text)); pg.on("pageerror", lambda e: errs.append(str(e)))
        pg.goto(BASE + path)
        try: pg.wait_for_function(ready, timeout=25000); loaded = True
        except Exception: loaded = False
        pg.wait_for_timeout(5000); pg.screenshot(path=str(OUT / f"{name}.png"))
        ok(loaded and not errs, f"{name}: loaded={loaded} errors={errs[:2]}")
        pg.close()
    b.close()
(OUT / "result.json").write_text(json.dumps({"base": BASE, "worlds": worlds, "fails": fails}, indent=1))
sys.exit(1 if fails else 0)
