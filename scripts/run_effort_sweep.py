#!/usr/bin/env python3
"""
Controlled Apple-to-Apple Model x Effort Quantitative Benchmark (Gemini Interactions API).
Measures exact input/thought/output tokens, wall-clock latency, official Nov 2026 USD cost,
and saves generated artifacts for headless Chromium QA + gemini-decision-1 RLAIF scoring.
"""
from __future__ import annotations

import json
import os
import re
import sys
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path
from google import genai

ROOT = Path(r"C:\Users\ckstn\.gemini\antigravity\scratch\neon-frontier-bench-2026")
OUT_DIR = ROOT / "results" / "effort_sweep"
OUT_DIR.mkdir(parents=True, exist_ok=True)

# Official Nov 2026 Standard Paid Tier pricing (per 1M tokens) from gemini-api-guides/pricing.md
PRICING_USD_PER_M = {
    "gemini-4-neon": {"in": 3.00, "cached": 0.15, "out": 15.00},
    "gemini-4-carbon": {"in": 2.00, "cached": 0.10, "out": 10.00},   # intro thru Nov 30, 2026
    "gemini-4-argon": {"in": 2.00, "cached": 0.10, "out": 10.00},    # intro thru Nov 30, 2026
    "gemini-4-hydrogen": {"in": 1.50, "cached": 0.075, "out": 7.50},
}

CELLS = [
    ("neon_low", "gemini-4-neon", "low"),
    ("neon_medium", "gemini-4-neon", "medium"),
    ("neon_high", "gemini-4-neon", "high"),
    ("neon_xhigh", "gemini-4-neon", "xhigh"),
    ("hydrogen_xhigh", "gemini-4-hydrogen", "xhigh"),
    ("argon_high", "gemini-4-argon", "high"),
    ("carbon_high", "gemini-4-carbon", "high"),
]

PROMPT = """Build a single self-contained HTML file (no external CDN links, no external fonts, zero external assets) implementing an interactive **Swiss Escapement & Double-Pendulum Harmonic Phase-Space Studio**.

Strict engineering & aesthetic requirements:
1. Aesthetic: Swiss horology studio editorial style — warm obsidian (#111214) background, brushed silver/champagne brass (#d6b984) precision lines, blued steel (#4e7cb2) accents, crisp tabular-nums typography. NO generic neon purple/cyan AI-slop glow cards.
2. Left 65% panel: Real-time 60 FPS high-DPI HTML5 Canvas or SVG showing a precision coupled mechanical escapement wheel (15 teeth with involute-style profile) + oscillating anchor pallet fork + coaxial hairspring balance wheel driving an articulated compound double-pendulum harmonic trace.
3. Right 35% panel: Live phase-space portrait (angle theta vs angular velocity omega) + kinetic/potential energy conservation sparkline + clean compact controls (Drive Torque slider, Damping slider, Time Scale 0.25x-2x, Pause/Step, Reset). Zero UI overlap at 1440x900 and 700x900.
4. Physics: True 4th-order Runge-Kutta (RK4) fixed-timestep (dt=1/240s) integrator for the coupled harmonic dynamics so energy stays bounded and numerically stable.
5. Instrumentation: After first frame renders, set `window.__SWEEP_META__ = { ready: true, fps: <number>, energyJ: <number>, steps: <number> }`.
6. Output ONLY the complete HTML document inside a single ```html ... ``` fenced code block. Zero runtime errors or console warnings."""


def extract_html(text: str) -> str:
    m = re.search(r"```html\s*(.*?)```", text, flags=re.S | re.I)
    if m:
        return m.group(1).strip()
    idx = text.lower().find("<!doctype html")
    if idx != -1:
        return text[idx:].strip()
    idx2 = text.lower().find("<html")
    if idx2 != -1:
        return text[idx2:].strip()
    return text.strip()


def run_cell(cell_id: str, model: str, effort: str) -> dict:
    client = genai.Client()
    t0 = time.perf_counter()
    try:
        interaction = client.interactions.create(
            model=model,
            input=PROMPT,
            generation_config={
                "thinking_level": effort,
                "max_output_tokens": 32768,
            },
        )
        elapsed = time.perf_counter() - t0
        raw_text = interaction.output_text or ""
        html = extract_html(raw_text)
        html_path = OUT_DIR / f"{cell_id}.html"
        html_path.write_text(html, encoding="utf-8")

        u = interaction.usage
        in_tok = int(getattr(u, "total_input_tokens", 0) or 0)
        cached_tok = int(getattr(u, "total_cached_tokens", 0) or 0)
        out_tok = int(getattr(u, "total_output_tokens", 0) or 0)
        thought_tok = int(getattr(u, "total_thought_tokens", 0) or 0)
        tot_tok = int(getattr(u, "total_tokens", 0) or (in_tok + out_tok + thought_tok))

        p = PRICING_USD_PER_M[model]
        uncached_in = max(0, in_tok - cached_tok)
        # Official pricing.md: Output price includes thinking tokens
        billable_out = out_tok + thought_tok
        cost_usd = (
            uncached_in * p["in"]
            + cached_tok * p["cached"]
            + billable_out * p["out"]
        ) / 1_000_000.0

        tps = billable_out / elapsed if elapsed > 0 else 0.0
        return {
            "cell_id": cell_id,
            "model": model,
            "effort": effort,
            "technique": "Direct Single-Shot API (Interactions v1)",
            "status": "ok",
            "wall_clock_sec": round(elapsed, 2),
            "input_tokens": in_tok,
            "cached_tokens": cached_tok,
            "thought_tokens": thought_tok,
            "output_tokens": out_tok,
            "billable_output_tokens": billable_out,
            "total_tokens": tot_tok,
            "tokens_per_sec": round(tps, 1),
            "cost_usd": round(cost_usd, 5),
            "html_bytes": len(html.encode("utf-8")),
            "html_lines": html.count("\n") + 1,
            "html_path": str(html_path),
        }
    except Exception as e:
        elapsed = time.perf_counter() - t0
        return {
            "cell_id": cell_id,
            "model": model,
            "effort": effort,
            "technique": "Direct Single-Shot API (Interactions v1)",
            "status": f"error: {type(e).__name__}: {e}",
            "wall_clock_sec": round(elapsed, 2),
        }


def main() -> int:
    print(f"Starting Controlled Model x Effort Sweep ({len(CELLS)} cells)...", flush=True)
    results = []
    with ThreadPoolExecutor(max_workers=4) as ex:
        futs = {ex.submit(run_cell, cid, m, eff): cid for cid, m, eff in CELLS}
        for fut in as_completed(futs):
            r = fut.result()
            results.append(r)
            if r["status"] == "ok":
                print(
                    f"[DONE] {r['cell_id']:14s} | {r['wall_clock_sec']:6.2f}s | "
                    f"in={r['input_tokens']:4d} thought={r['thought_tokens']:5d} "
                    f"out={r['output_tokens']:5d} | {r['tokens_per_sec']:5.1f} tok/s | "
                    f"${r['cost_usd']:.4f} | {r['html_lines']} LOC",
                    flush=True,
                )
            else:
                print(f"[FAIL] {r['cell_id']}: {r['status']}", flush=True)

    order = {cid: i for i, (cid, _, _) in enumerate(CELLS)}
    results.sort(key=lambda x: order[x["cell_id"]])
    out_json = OUT_DIR / "effort_sweep_metrics.json"
    out_json.write_text(json.dumps(results, indent=2), encoding="utf-8")
    print(f"Saved metrics -> {out_json}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
