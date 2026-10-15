"""Front door E2E: the landing and the build screen against the dev server (cd table && bunx vite --port 5183).
Run: uv run --with playwright python table/e2e/front.py
Order matters: the local gate allows 1 build a day per address, so the build runs first and the second prompt must be spaced.
To run again: stop the dev server, delete table/.wrangler/state/v3/do, start the server. Out: table/e2e/out/front/ (shots, result.json)."""
import functools, json, sys, time
from pathlib import Path
from playwright.sync_api import sync_playwright

BASE = "http://localhost:5183"
HERE = Path(__file__).parent
OUT = HERE / "out" / "front"
JEV = "OPENROUTER_API_KEY=" in ((HERE.parent / ".dev.vars").read_text() if (HERE.parent / ".dev.vars").exists() else "")
PROMPT = "Venice, March 1797, the last days of the Republic"
REFUSED = "A game where I order the ethnic cleansing and expulsion of a whole minority population"
FAILS, NOTES = [], {}

def page(b, w, h, rm=False):
    ctx = b.new_context(viewport={"width": w, "height": h}, reduced_motion="reduce" if rm else "no-preference")
    pg = ctx.new_page()
    pg.errors = []
    pg.on("console", lambda m: pg.errors.append(m.text) if m.type == "error" else None)
    pg.on("pageerror", lambda e: pg.errors.append(f"pageerror: {e}"))
    return ctx, pg

def check(ok, what):
    print(("PASS " if ok else "FAIL ") + what)
    if not ok: FAILS.append(what)

def wide(pg): return pg.evaluate("document.documentElement.scrollWidth - innerWidth")

def landing(pg, tag):
    pg.goto(BASE + "/")
    pg.wait_for_function("!document.documentElement.classList.contains('wait') && document.querySelector('#grid li, #none:not([hidden])')", timeout=15000)
    pg.wait_for_timeout(2500)  # the entrance and the field settle

def run():
    OUT.mkdir(parents=True, exist_ok=True)
    with sync_playwright() as p:
        b = p.chromium.launch(channel="chrome")

        # 1. the landing at two sizes and with reduced motion: no console error, no sideways scroll
        for w, h, rm in [(1280, 800, False), (1920, 1080, False), (1280, 800, True)]:
            tag = f"{w}x{h}{'-rm' if rm else ''}"
            ctx, pg = page(b, w, h, rm)
            landing(pg, tag)
            pg.screenshot(path=str(OUT / f"landing-{tag}.png"))
            pg.screenshot(path=str(OUT / f"landing-{tag}-full.png"), full_page=True)
            check(not pg.errors, f"landing {tag}: 0 console errors {pg.errors[:3]}")
            check(wide(pg) <= 0, f"landing {tag}: no horizontal scroll ({wide(pg)} px)")
            n = pg.evaluate("document.querySelectorAll('#grid a.wcard').length")
            check(n >= 1, f"landing {tag}: library shows {n} world(s)")
            ctx.close()

        # 2. a prompt by keyboard goes through the fake build to "Begin the briefing"
        ctx, pg = page(b, 1280, 800)
        landing(pg, "build")
        pg.keyboard.type(PROMPT)  # the box has autofocus
        t0 = time.time()
        pg.keyboard.press("Enter")
        try:
            pg.wait_for_url("**/build*?b=*", timeout=30000)  # the asset server drops .html
        except Exception:
            line = pg.evaluate("document.querySelector('.capline, #err')?.textContent || ''")
            check(False, f"build: the prompt did not start a build ({line.strip()[:90]}). Reset the gate: stop the server, delete table/.wrangler/state/v3/do, start it.")
            return finish(b)
        build_id = pg.url.split("b=")[1]
        marks = {}
        for name, cond in [("frame", "!document.querySelector('#title .typed.idle')"), ("skin", "document.documentElement.classList.contains('skinned')"),
                           ("music", "document.querySelector('.row[data-step=music].done')"), ("deck", "document.querySelector('.row[data-step=deck].done')"),
                           ("done", "document.querySelector('#go[data-state=done]')")]:
            try:
                pg.wait_for_function(cond, timeout=60000)
                marks[name] = round(time.time() - t0, 1)
                pg.wait_for_timeout(1300 if name != "done" else 1500)
                pg.screenshot(path=str(OUT / f"build-{name}.png"))
            except Exception:
                check(False, f"build: never reached {name}")
                break
        NOTES["build_seconds"] = marks
        href = pg.evaluate("document.querySelector('#begin')?.getAttribute('href') || ''")
        check(href.startswith("/play.html?w=") and href.endswith("&walk=1"), f"build: Begin the briefing goes to {href}")
        check("done" in marks and marks["done"] < 60, f"build: done in {marks.get('done')} s (fake timeline about 25 s)")
        check(not pg.errors, f"build: 0 console errors {pg.errors[:3]}")
        check(wide(pg) <= 0, "build: no horizontal scroll")
        rows = pg.evaluate("[...document.querySelectorAll('.row')].map((r) => r.classList.contains('done'))")
        check(all(rows) and len(rows) == 6, f"build: all 6 steps done {rows}")

        # 3. back on the landing: "Your worlds" links to the build, and a second prompt is spaced; the library stays playable
        landing(pg, "after")
        mine = pg.evaluate(f"!!document.querySelector('#mine:not([hidden]) a[href*=\"{build_id}\"]')")
        check(mine, "landing: Your worlds links back to the build")
        pg.focus("#prompt")
        pg.keyboard.type("Byzantium, May 1453")
        pg.keyboard.press("Enter")
        try:
            pg.wait_for_selector(".capline", timeout=30000)
            line = pg.inner_text(".capline")
            check("New worlds open at 00:00 UTC, in" in line, f"spaced: {line.splitlines()[0]}")
            check(pg.evaluate("document.querySelectorAll('#grid a.wcard').length") >= 1, "spaced: the library stays playable")
            pg.wait_for_timeout(600)
            pg.screenshot(path=str(OUT / "state-spaced.png"))
        except Exception:
            check(False, "spaced: the closed line never showed")
        check(not pg.errors, f"landing after build: 0 console errors {pg.errors[:3]}")
        ctx.close()

        # 4. exists, similar, capped and a failed build need a library match or a full day; the server's answers are stubbed in their real shapes
        ctx, pg = page(b, 1280, 800)
        landing(pg, "stubs")
        ws = pg.evaluate("fetch('/api/worlds').then((r) => r.json())")
        pick = lambda w: {k: w[k] for k in ("id", "title", "date", "polity", "blurb")}
        stubs = [("exists", {"state": "exists", "world": pick(ws[0])}, ".wc .pl", "Play this world"),
                 ("similar", {"state": "similar", "worlds": [pick(w) for w in ws[:3]]}, ".picks .anyway", "Build mine anyway"),
                 ("capped", {"state": "capped", "opensAt": time.strftime("%Y-%m-%dT%H:%M:%S.000Z", time.gmtime(time.time() + 3 * 3600 + 900))}, ".capline", "New worlds open at 00:00 UTC")]
        for name, body, sel, text in stubs:
            pg.unroute("**/api/prompt")
            pg.route("**/api/prompt", functools.partial(lambda body, route: route.fulfill(json=body), body))
            landing(pg, name)
            pg.keyboard.type("Egypt after the revolution")
            pg.keyboard.press("Enter")
            try:
                pg.wait_for_selector(sel, timeout=5000)
                pg.wait_for_timeout(700)
                check(text in pg.inner_text("#ask"), f"{name}: shows {text!r}")
                pg.screenshot(path=str(OUT / f"state-{name}.png"))
            except Exception:
                check(False, f"{name}: {sel} never showed")
        # a failed build: the one line, the reason on its own line, the slot given back
        pg.route("**/api/builds/*", lambda route: route.fulfill(json={"status": "failed", "parts": {}, "error": "The world did not pass its checks."}))
        pg.goto(BASE + "/build.html?b=stub-failed")
        try:
            pg.wait_for_selector("#go[data-state=failed] .reason", timeout=10000)
            pg.wait_for_timeout(700)
            check("Your daily build is returned" in pg.inner_text(".fail") and pg.inner_text(".reason") == "The world did not pass its checks.", "failed build: the line and its reason")
            pg.screenshot(path=str(OUT / "build-failed.png"))
        except Exception:
            check(False, "failed build: the failure copy never showed")
        check(not pg.errors, f"stubbed states: 0 console errors {pg.errors[:3]}")
        ctx.close()

        # 5. refused: only when Jev can answer
        if JEV:
            ctx, pg = page(b, 1280, 800)
            landing(pg, "refused")
            pg.keyboard.type(REFUSED)
            pg.keyboard.press("Enter")
            try:
                pg.wait_for_selector("#err.on", timeout=30000)
                check(True, f"refused: {pg.inner_text('#err').strip(' !\n')}")
                pg.screenshot(path=str(OUT / "state-refused.png"))
            except Exception:
                check(False, f"refused: no refusal ({pg.evaluate('location.pathname')})")
            ctx.close()
        else:
            print("SKIP refused: no Jev key in table/.dev.vars")
        return finish(b)

def finish(b):
    b.close()
    (OUT / "result.json").write_text(json.dumps({"fails": FAILS, "notes": NOTES, "when": time.strftime("%Y-%m-%d %H:%M:%S")}, indent=1))
    print(f"\n{'FAIL' if FAILS else 'PASS'}: {len(FAILS)} failure(s). Shots and result.json in {OUT}")
    return 1 if FAILS else 0

if __name__ == "__main__":
    sys.exit(run())
