"""Board E2E: one full term of a built world with mouse and keyboard only, then the guided first month.
Run from the worktree: uv run --with playwright python table/e2e/play.py
Starts the dev server on :5181 unless one is up. Screenshots (1280x800) go to table/e2e/out/. Exits 1 on any console error."""
import json, subprocess, sys, time, urllib.request
from pathlib import Path
from playwright.sync_api import sync_playwright

HERE = Path(__file__).parent
TABLE, OUT = HERE.parent, HERE / "out"
BASE = "http://localhost:5181"
TERM = f"{BASE}/play.html?w=egypt-2011&seed=7&tutor=0"
TUTORED = f"{BASE}/play.html?w=egypt-2011&seed=7&tutor=1"


def server():
    def up():
        try: return urllib.request.urlopen(BASE + "/api/worlds", timeout=3).status == 200
        except Exception: return False
    if up(): return None
    p = subprocess.Popen(["bunx", "vite", "--port", "5181", "--strictPort"], cwd=TABLE, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    for _ in range(120):
        if up(): return p
        time.sleep(1)
    p.kill(); sys.exit("the dev server did not start on :5181")


def page(browser, errors, tag):
    pg = browser.new_context(viewport={"width": 1280, "height": 800}).new_page()
    pg.route_web_socket(lambda url: True, lambda ws: None)  # mute the dev server's hot reload: an edit elsewhere must not reload the page mid-term
    pg.on("console", lambda m: m.type == "error" and errors.append(f"{tag} console: {m.text}"))
    pg.on("pageerror", lambda e: errors.append(f"{tag} pageerror: {e}"))
    return pg


PHASE = "window.board?.phase()"
# the affordable answer that leaves the weakest holder strongest (support sizes s/m/l as in the engine's tune)
SAFEST = """(() => { const s = window.board.state(), d = window.board.pack.deck, size = { s: 4, m: 8, l: 12 };
  const c = [...d.situations, ...d.history, ...d.callbacks, ...d.elections, ...Object.values(d.intents)].find((x) => x.id === s.card);
  const score = (i) => { const sup = { ...s.support }; for (const [h, mv] of Object.entries(c.answers[i].moves)) sup[h] += (mv[0] === '+' ? 1 : -1) * size[mv[1]];
    const v = Object.values(sup); return 2 * Math.min(...v) + v.reduce((a, b) => a + b, 0) / v.length; };
  return [...document.querySelectorAll('.card .ans')].filter((b) => !b.disabled).map((b) => +b.dataset.i).sort((x, y) => score(y) - score(x))[0]; })()"""
NOSCROLL = "document.documentElement.scrollWidth <= innerWidth && document.documentElement.scrollHeight <= innerHeight"


def play_term(pg, fails):
    """Draw, choose an affordable answer, decide, file, play up to 2 cards, end the month; until the epilogue."""
    pg.goto(TERM)
    pg.wait_for_function("window.board && window.board.phase() === 'rest' && document.querySelector('#draw')", timeout=30000)
    pg.click(".keys"); pg.click("#speed-quick"); pg.keyboard.press("Escape")  # ceremonies at Quick speed
    months, start, played, trace, last = 0, time.time(), {}, [], [None, time.time()]
    pg.trace = trace
    while time.time() - start < 1800:
        if pg.locator("#tourmark .tskip").is_visible(): pg.click("#tourmark .tskip")
        ph = pg.evaluate(PHASE)
        if ph is None: fails.append(f"the board went away at {pg.url}"); pg.screenshot(path=str(OUT / "lost.png")); return None
        trace.append(ph) if not trace or trace[-1] != ph else None
        sig = (ph, pg.evaluate("JSON.stringify(window.board.state())"))
        if sig != last[0]: last[:] = [sig, time.time()]
        elif time.time() - last[1] > 90: fails.append(f"stalled in {ph}"); pg.screenshot(path=str(OUT / "lost.png")); return None
        g = pg.evaluate("(() => { const s = window.board.state(); return { month: s.month, plays: s.plays, phase: s.phase } })()")
        if ph == "rest":
            pg.click("#draw")
        elif ph == "card":
            n = pg.locator(".card .ans:not(:disabled)").count()
            if not n: pg.wait_for_timeout(200); continue
            k = pg.evaluate(SAFEST)
            pg.keyboard.press(str(k + 1)); pg.wait_for_timeout(150); pg.keyboard.press("Enter")
            pg.wait_for_function(f"{PHASE} !== 'card'", timeout=10000)
        elif ph == "revealed":
            pg.keyboard.press("Enter")  # focus sits on "File under ..."
            pg.wait_for_function(f"{PHASE} !== 'revealed'", timeout=10000)
        elif ph == "pick":
            pg.locator(".pick .popt:not(:disabled)").first.click()
            pg.wait_for_timeout(1500)  # one pick can lead straight to the next
        elif ph == "hand":
            key = g["month"]
            live = pg.locator("#hand button.hc:not([aria-disabled])")
            if played.get(key, 0) < 2 and g["plays"] > 0 and live.count():
                talk = pg.locator("#hand button.hc:not([aria-disabled])[data-id='talk']")
                other = pg.locator("#hand button.hc:not([aria-disabled]):not([data-id='talk'])")
                (other.first if played.get(key, 0) % 2 and other.count() else talk.first if talk.count() else live.first).click()
                played[key] = played.get(key, 0) + 1
                pg.wait_for_function(f"{PHASE} !== 'hand'", timeout=10000)
            else:
                pg.click("#end"); pg.wait_for_timeout(250)
                if pg.evaluate(PHASE) == "hand": pg.click("#end")  # End month asks once while a play is left
        elif ph == "target" and pg.locator("#center .aopt").count():
            pg.locator("#center .aopt").first.click(); pg.wait_for_timeout(300)  # a card that asks: take the first option
        elif ph == "target":
            low = pg.evaluate("(() => { const s = window.board.state(), f = window.board.pack.world.factions; return f.reduce((a, b) => (s.support[b.id] < s.support[a.id] ? b : a)).id })()")
            pg.click(f"#factions .fac.target[data-id='{low}']")
        elif ph == "month-done":
            months += 1
            pg.wait_for_timeout(1200)
            if not pg.evaluate(NOSCROLL): fails.append(f"month {months}: the page scrolls")
            pg.screenshot(path=str(OUT / f"month-{months:02d}.png"))
            pg.keyboard.press("Enter")  # focus sits on "Draw <month>'s card"
            pg.wait_for_function(f"{PHASE} !== 'month-done'", timeout=10000)
        elif ph == "over":
            pg.wait_for_selector(".verdict #vnext", timeout=30000); pg.wait_for_timeout(1500)
            pages = pg.evaluate("document.querySelectorAll('.verdict .vpage').length")
            for k in range(pages):
                pg.screenshot(path=str(OUT / f"epilogue-{k + 1}.png"))
                if k < pages - 1: pg.keyboard.press("Enter"); pg.wait_for_timeout(700)  # focus sits on the next page's button
            out = pg.evaluate("(() => { const s = window.board.state(); return { over: s.over, month: s.month, stacks: s.stacks, laws: s.laws, picked: s.picked } })()")
            out["headline"] = pg.evaluate("document.querySelector('.vout').textContent")
            out["rule"] = pg.evaluate("document.querySelector('.vrule').textContent")
            out["months_played"] = months
            if pg.evaluate("localStorage.getItem('siyasa-save:egypt-2011')"): fails.append("a finished term left its save")
            return out
        else:
            pg.keyboard.press(" ")  # a ceremony: Space skips it
            pg.wait_for_timeout(120)
    fails.append("the term did not finish in 30 minutes")
    return None


# The guided first month: 8 steps; at each one the lit target must be the only live control on the board.
TUTOR = ["#draw", ".card .ans:not(:disabled)", ".card .ans.sel", "#tutor .tnext", ".reveal .go",
         "#hand button.hc:not([aria-disabled]):not([data-id='talk'])", "#end", "#tutor .tnext"]
LIVE = """() => { const t = document.querySelector('#tutor'), lit = [...document.querySelectorAll(t.dataset.sel)].filter((e) => !e.closest('.leaving, .out'));
  const all = [...document.querySelectorAll("button, a[href], input, select, textarea, summary, [tabindex]:not([tabindex='-1']), [role=button]")];
  const live = all.filter((e) => !e.closest('#tutor, [inert]') && !e.disabled && e.checkVisibility({ visibilityProperty: true }));
  return { lit: lit.length, stray: live.filter((e) => !lit.some((l) => l.contains(e))).map((e) => e.outerHTML.slice(0, 70)) }; }"""
GATES = ["reveal", "file", "monthEnd", "recap"]
SHOWN = "getComputedStyle(document.querySelector('#tutor .tline')).opacity === '1' && !document.querySelector('#tutor .tnext:not([hidden])[aria-disabled]')"
NEXT = f"(() => {{ const t = document.querySelector('#tutor'); return {SHOWN} && (t.dataset.gate ? 'g:' + t.dataset.gate : 'n:' + t.dataset.n); }})()"


def tutor_pass(pg, fails):
    pg.goto(TUTORED)
    pg.wait_for_function("window.board && document.querySelector('#draw')", timeout=30000)
    gates = []
    for k, sel in enumerate(TUTOR, 1):
        end = time.time() + 60
        while True:
            try: got = pg.wait_for_function(NEXT, timeout=30000).json_value()
            except Exception: got = "nothing"
            if got == f"n:{k}": break
            if got.startswith("g:"):
                r = pg.evaluate(LIVE)
                if r["stray"]: fails.append(f"gate {got[2:]}: also live {r['stray'][:3]}")
                gates.append(got[2:]); pg.screenshot(path=str(OUT / f"tutor-gate-{len(gates)}-{got[2:]}.png"))
                pg.click("#tutor .tnext")
                pg.wait_for_function(f"document.querySelector('#tutor').dataset.gate !== '{got[2:]}'", timeout=5000)
                continue
            if time.time() > end: fails.append(f"tutorial step {k}: never shown (stuck on {got})"); return gates
            pg.wait_for_timeout(200)
        r = pg.evaluate(LIVE)
        if not r["lit"] or r["stray"]: fails.append(f"tutorial step {k}: lit {r['lit']}, also live {r['stray'][:3]}")
        pg.wait_for_timeout(400); pg.screenshot(path=str(OUT / f"tutor-step-{k}.png"))
        pg.click(sel)
        if sel == "#end":
            pg.wait_for_timeout(400)
            if pg.evaluate("document.querySelector('#tutor').dataset.n") == "7": pg.click(sel)
    if [g for g in gates if g != "unlock"] != GATES: fails.append(f"tutorial gates {gates}, want {GATES}")
    try: pg.wait_for_function("getComputedStyle(document.querySelector('#tutor .tend')).opacity === '1'", timeout=5000)
    except Exception: fails.append("tutorial: the end line never showed")
    pg.screenshot(path=str(OUT / "tutor-end.png"))
    if pg.evaluate("[...document.querySelectorAll('[inert]')].some((e) => !e.closest('.leaving'))"): fails.append("tutorial end: the board is still inert")
    return gates


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    for f in OUT.glob("*.png"): f.unlink()
    srv, errors, fails = server(), [], []
    try:
        with sync_playwright() as p:
            b = p.chromium.launch()
            tp = page(b, errors, "term")
            try: result = play_term(tp, fails)
            except Exception as e: result = None; fails.append(f"term: {e}".splitlines()[0]); tp.screenshot(path=str(OUT / "lost.png"))
            print("phases:", " ".join(tp.trace[-60:]))
            gates = tutor_pass(page(b, errors, "tutorial"), fails)
            b.close()
    finally:
        if srv: srv.kill()
    report = {"outcome": result, "tutorial_gates": gates, "console_errors": errors, "fails": fails, "screenshots": sorted(f.name for f in OUT.glob("*.png"))}
    (OUT / "result.json").write_text(json.dumps(report, indent=1))
    print(json.dumps(report, indent=1))
    sys.exit(1 if errors or fails or not result else 0)


if __name__ == "__main__":
    main()
