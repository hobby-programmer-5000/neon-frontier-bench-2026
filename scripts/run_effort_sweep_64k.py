#!/usr/bin/env python3
"""
Phase 2 of Controlled Model x Effort Sweep:
Preserves the 32K cap truncation dataset (`effort_sweep_32k_cap.json`) and re-runs the 5 cells
that saturated max_output_tokens=32768 (`neon_high`, `neon_xhigh`, `hydrogen_xhigh`, `argon_high`,
`carbon_high`) with full synchronous `max_output_tokens=65536` so we capture BOTH the 32K overthinking
truncation cliff AND full uncapped completion quality!
"""
from __future__ import annotations

import json
import shutil
import sys
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path
from google import genai
from run_effort_sweep import OUT_DIR, PRICING_USD_PER_M, PROMPT, extract_html

RERUN_CELLS = [
    ("neon_high", "gemini-4-neon", "high"),
    ("neon_xhigh", "gemini-4-neon", "xhigh"),
    ("hydrogen_xhigh", "gemini-4-hydrogen", "xhigh"),
    ("argon_high", "gemini-4-argon", "high"),
    ("carbon_high", "gemini-4-carbon", "high"),
]


def run_cell_64k(cell_id: str, model: str, effort: str) -> dict:
    client = genai.Client()
    t0 = time.perf_counter()
    try:
        interaction = client.interactions.create(
            model=model,
            input=PROMPT,
            generation_config={
                "thinking_level": effort,
                "max_output_tokens": 65536,
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
        billable_out = out_tok + thought_tok
        cost_usd = (uncached_in * p["in"] + cached_tok * p["cached"] + billable_out * p["out"]) / 1_000_000.0
        tps = billable_out / elapsed if elapsed > 0 else 0.0
        return {
            "cell_id": cell_id,
            "model": model,
            "effort": effort,
            "max_output_tokens_cap": 65536,
            "technique": "Direct Single-Shot API (Interactions v1, 64K cap)",
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
        return {"cell_id": cell_id, "model": model, "effort": effort, "status": f"error: {e}", "wall_clock_sec": round(elapsed, 2)}


def main() -> int:
    orig_path = OUT_DIR / "effort_sweep_metrics.json"
    backup_32k = OUT_DIR / "effort_sweep_32k_cap.json"
    if orig_path.exists() and not backup_32k.exists():
        shutil.copy2(orig_path, backup_32k)
    existing = {r["cell_id"]: r for r in json.loads(orig_path.read_text(encoding="utf-8"))}

    print("Re-running 5 saturated cells at max_output_tokens=65536...", flush=True)
    with ThreadPoolExecutor(max_workers=5) as ex:
        futs = {ex.submit(run_cell_64k, cid, m, eff): cid for cid, m, eff in RERUN_CELLS}
        for fut in as_completed(futs):
            r = fut.result()
            existing[r["cell_id"]] = r
            if r["status"] == "ok":
                print(
                    f"[64K DONE] {r['cell_id']:14s} | {r['wall_clock_sec']:6.2f}s | "
                    f"thought={r['thought_tokens']:5d} out={r['output_tokens']:5d} | "
                    f"{r['tokens_per_sec']:5.1f} tok/s | ${r['cost_usd']:.4f} | {r['html_lines']} LOC",
                    flush=True,
                )
            else:
                print(f"[64K FAIL] {r['cell_id']}: {r['status']}", flush=True)

    order = ["neon_low", "neon_medium", "neon_high", "neon_xhigh", "hydrogen_xhigh", "argon_high", "carbon_high"]
    merged = [existing[k] for k in order if k in existing]
    orig_path.write_text(json.dumps(merged, indent=2), encoding="utf-8")
    print(f"Updated 64K merged metrics -> {orig_path}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
