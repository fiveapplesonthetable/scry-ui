#!/usr/bin/env python3
"""End-to-end smoke for scry-ui.

Drives a real chromium against the running scry-ui server, exercising
the five surfaces (Search, Dashboard, Logs, Settings, Health) and the
new features (verb-combobox, autocomplete, file-grouped results,
keyboard nav, mobile reflow). Captures screenshots at both desktop
(1366×900) and phone (412×900) viewports.

Wrap in /mnt/agent/recordings/app/recorder.py to also capture video.

Assumes scry-ui is already running at $SCRY_UI_URL.
"""

from __future__ import annotations

import os
import sys
import time
import urllib.request
from pathlib import Path

from playwright.sync_api import BrowserContext, Page, sync_playwright

URL = os.environ.get("SCRY_UI_URL", "http://127.0.0.1:8787")
SHOTS = Path(os.environ.get("RECORD_SHOTS_DIR", "/tmp/scry-ui-shots"))
SHOTS.mkdir(parents=True, exist_ok=True)
README_SHOTS = Path("/mnt/agent/scry-ui/docs/screenshots")
README_SHOTS.mkdir(parents=True, exist_ok=True)

RESULTS: list[tuple[str, bool, str]] = []


def check(name: str, ok: bool, detail: str = "") -> bool:
    sym = "ok" if ok else "FAIL"
    print(f"  [{sym}] {name}{(' — ' + detail) if detail else ''}", flush=True)
    RESULTS.append((name, ok, detail))
    return ok


def shot(page: Page, name: str, *, copy_to_readme: bool = False) -> None:
    path = SHOTS / f"{int(time.time() * 1000)}-{name}.png"
    try:
        page.screenshot(path=str(path), full_page=False)
        print(f"      shot -> {path}", flush=True)
        if copy_to_readme:
            dest = README_SHOTS / f"{name}.png"
            dest.write_bytes(path.read_bytes())
    except Exception as e:  # noqa: BLE001
        print(f"      shot failed: {e}", flush=True)


def wait_for_server(url: str, timeout: float = 10.0) -> bool:
    deadline = time.time() + timeout
    while time.time() < deadline:
        try:
            with urllib.request.urlopen(f"{url}/api/health", timeout=1) as r:
                if r.status == 200:
                    return True
        except Exception:
            time.sleep(0.3)
    return False


# ---------------------------------------------------------------- desktop


def desktop_run(ctx: BrowserContext) -> None:
    page = ctx.new_page()

    # Search: grep
    page.goto(URL + "/#/search")
    page.wait_for_selector("[data-test='primary-input']", timeout=5000)
    shot(page, "desktop-01-search-empty", copy_to_readme=True)

    page.locator("[data-test='primary-input']").fill("ZygoteInit")
    page.locator("[data-test='primary-input']").press("Enter")
    page.wait_for_selector("[data-test='hit-row']", timeout=15_000)
    rows = page.locator("[data-test='hit-row']")
    check("desktop · grep ZygoteInit returns hits", rows.count() > 0, f"{rows.count()} rows")
    page.wait_for_selector("[data-test='status-line']", timeout=2000)
    shot(page, "desktop-02-grep-results", copy_to_readme=True)

    # File panel
    rows.first.click()
    page.wait_for_selector("[data-test='close-file']", timeout=5000)
    check("desktop · file panel opens", page.locator(".sc-filepanel__body").count() == 1)
    shot(page, "desktop-03-file-panel", copy_to_readme=True)
    page.keyboard.press("Escape")  # exercise Esc shortcut
    page.wait_for_selector("[data-test='close-file']", state="detached", timeout=2000)
    check("desktop · Esc closes file panel", page.locator(".sc-filepanel").count() == 0)

    # Switch verb -> def via picker
    page.locator("[data-test='cmd-picker-btn']").click()
    page.wait_for_selector("[data-test='cmd-item-def']", timeout=3000)
    shot(page, "desktop-04-cmd-picker", copy_to_readme=True)
    page.locator("[data-test='cmd-item-def']").click()

    # Autocomplete on def — type a prefix, wait for dropdown
    inp = page.locator("[data-test='primary-input']")
    inp.fill("")
    inp.type("Activity", delay=20)
    try:
        page.wait_for_selector("[data-test='autocomplete']", timeout=4000)
        ac_rows = page.locator("[data-test='ac-row']")
        check("desktop · autocomplete shows suggestions", ac_rows.count() > 0, f"{ac_rows.count()} sugs")
        shot(page, "desktop-05-autocomplete", copy_to_readme=True)
        # accept via keyboard
        page.keyboard.press("ArrowDown")
        page.keyboard.press("Enter")
        page.wait_for_selector("[data-test='hit-row']", timeout=15_000)
        check("desktop · keyboard-pick autocomplete runs query", True)
    except Exception as e:  # noqa: BLE001
        check("desktop · autocomplete shows suggestions", False, str(e))

    shot(page, "desktop-06-def-results", copy_to_readme=True)

    # j/k navigation — pickSuggestion blurs the input, so j should land on body.
    # Click the result area to be sure focus is off the input.
    page.locator("body").click()
    page.keyboard.press("j")
    page.keyboard.press("j")
    page.wait_for_timeout(150)
    sel = page.locator(".sc-hit--selected")
    check("desktop · j navigates selection", sel.count() == 1)

    # Filters toggle
    page.locator("[data-test='filters-toggle']").click()
    page.wait_for_selector(".sc-filters", timeout=2000)
    check("desktop · Filters opens", page.locator(".sc-filters").count() == 1)
    shot(page, "desktop-07-filters", copy_to_readme=True)

    # Dashboard
    page.goto(URL + "/#/dashboard")
    page.wait_for_selector(".sc-dash__kpi", timeout=5000)
    page.wait_for_function(
        "() => !!document.querySelector('.sc-pre') && document.querySelector('.sc-pre').textContent.length > 50",
        timeout=10_000,
    )
    check("desktop · dashboard renders KPI strip + stats", True)
    shot(page, "desktop-08-dashboard", copy_to_readme=True)

    # Logs
    page.goto(URL + "/#/logs")
    page.wait_for_selector("[data-test='logs-list']", timeout=5000)
    items = page.locator("[data-test='log-item']")
    if items.count() > 0:
        items.first.click()
        page.wait_for_timeout(800)
    check("desktop · logs page renders", items.count() > 0, f"{items.count()} files")
    shot(page, "desktop-09-logs", copy_to_readme=True)

    # Settings — toggle dark explicitly
    page.goto(URL + "/#/settings")
    page.wait_for_selector("[data-test='setting-theme']", timeout=5000)
    page.locator("[data-test='setting-theme']").select_option("dark")
    page.wait_for_function(
        "() => document.documentElement.getAttribute('data-theme') === 'dark'",
        timeout=2000,
    )
    check("desktop · theme switches to dark", True)
    shot(page, "desktop-10-settings-dark", copy_to_readme=True)

    page.locator("[data-test='setting-theme']").select_option("light")
    page.wait_for_function(
        "() => document.documentElement.getAttribute('data-theme') === 'light'",
        timeout=2000,
    )
    check("desktop · theme switches to light", True)
    shot(page, "desktop-11-settings-light", copy_to_readme=True)

    # Restore dark for following pages.
    page.locator("[data-test='setting-theme']").select_option("dark")
    page.wait_for_function(
        "() => document.documentElement.getAttribute('data-theme') === 'dark'",
        timeout=2000,
    )

    # Health
    page.goto(URL + "/#/health")
    page.wait_for_selector("[data-test='scry-stderr']", timeout=5000)
    page.wait_for_function(
        "() => Array.from(document.querySelectorAll('.sc-dash__kpi-value'))"
        ".some(e => e.textContent && e.textContent.trim() === 'connected')",
        timeout=5000,
    )
    check("desktop · health reports scry serve connected", True)
    shot(page, "desktop-12-health", copy_to_readme=True)

    page.close()


# ------------------------------------------------------------------ phone


def phone_run(ctx: BrowserContext) -> None:
    # 412×900 ≈ Pixel 7 portrait.
    page = ctx.new_page()
    page.set_viewport_size({"width": 412, "height": 900})

    page.goto(URL + "/#/search")
    page.wait_for_selector("[data-test='primary-input']", timeout=5000)
    # Confirm tab labels are hidden but icons remain.
    labels = page.locator(".sc-tab__label").first
    visible = labels.is_visible() if labels.count() > 0 else False
    check("phone · tab labels hidden under 520px", not visible)
    shot(page, "phone-01-search-empty", copy_to_readme=True)

    page.locator("[data-test='primary-input']").fill("ZygoteInit")
    page.locator("[data-test='primary-input']").press("Enter")
    page.wait_for_selector("[data-test='hit-row']", timeout=15_000)
    shot(page, "phone-02-results", copy_to_readme=True)

    # Open file panel — should overlay full width.
    page.locator("[data-test='hit-row']").first.click()
    page.wait_for_selector("[data-test='close-file']", timeout=5000)
    panel_w = page.evaluate(
        "() => document.querySelector('.sc-filepanel').getBoundingClientRect().width"
    )
    check("phone · file panel overlays full width", panel_w >= 400, f"width={panel_w}")
    shot(page, "phone-03-file-panel", copy_to_readme=True)
    page.locator("[data-test='close-file']").click()

    # Dashboard
    page.goto(URL + "/#/dashboard")
    page.wait_for_selector(".sc-dash__kpi", timeout=5000)
    page.wait_for_function(
        "() => !!document.querySelector('.sc-pre') && document.querySelector('.sc-pre').textContent.length > 50",
        timeout=10_000,
    )
    shot(page, "phone-04-dashboard", copy_to_readme=True)

    # Logs
    page.goto(URL + "/#/logs")
    page.wait_for_selector("[data-test='logs-list']", timeout=5000)
    if page.locator("[data-test='log-item']").count() > 0:
        page.locator("[data-test='log-item']").first.click()
        page.wait_for_timeout(800)
    shot(page, "phone-05-logs", copy_to_readme=True)

    # Settings
    page.goto(URL + "/#/settings")
    page.wait_for_selector("[data-test='setting-theme']", timeout=5000)
    shot(page, "phone-06-settings", copy_to_readme=True)

    page.close()


def main() -> int:
    if not wait_for_server(URL):
        print(f"FATAL: scry-ui not reachable at {URL}", flush=True)
        return 2
    print(f"== scry-ui e2e against {URL}", flush=True)

    headless = os.environ.get("HEADLESS", "0") == "1"
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=headless)
        ctx = browser.new_context(viewport={"width": 1366, "height": 900})
        try:
            print("-- desktop run --", flush=True)
            desktop_run(ctx)
            print("-- phone run --", flush=True)
            phone_run(ctx)
        finally:
            ctx.close()
            browser.close()

    failed = [r for r in RESULTS if not r[1]]
    print(f"\n== {len(RESULTS) - len(failed)}/{len(RESULTS)} checks passed", flush=True)
    if failed:
        for name, _, detail in failed:
            print(f"  FAIL: {name} {detail}", flush=True)
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
