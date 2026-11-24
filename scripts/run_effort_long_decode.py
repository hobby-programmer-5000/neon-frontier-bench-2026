#!/usr/bin/env python3
"""
Long Decode Ablation for `gemini-4-hydrogen` (xhigh):
Tests the exact same Swiss Escapement & Double-Pendulum prompt from `run_effort_sweep.py`
with official Interactions API Long Decode (`background=True`, `max_output_tokens=131072`)
so we can compare 64K synchronous cap truncation (`hydrogen_xhigh`) side-by-side with
unthrottled Long Decode (`hydrogen_xhigh_long`).
"""
from __future__ import annotations

import json
import sys
import time
from pathlib import Path
from google import genai
from run_effort_sweep import OUT_DIR, PRICING_USD_PER_M, PROMPT, extract_html

CELL_ID = "hydrogen_xhigh_long"
MODEL = "gemini-4-hydrogen"
EFFORT = "xhigh"
MAX_OUT = 131072


def extract_long_decode_text(interaction) -> tuple[str, int]:
    steps = getattr(interaction, "steps", None) or []
    parts = []
    hops = 0
    for step in steps:
        if getattr(step, "type", None) == "model_output":
            hops += 1
            for content in (getattr(step, "content", None) or []):
                if getattr(content, "type", None) == "text" and getattr(content, "text", None):
                    parts.append(content.text)
    if parts:
        return "".join(parts), hops
    return (getattr(interaction, "output_text", None) or ""), max(hops, 1)


def main() -> int:
    client = genai.Client()
    t0 = time.perf_counter()
    print(f"Launching Long Decode ablation: {CELL_ID} ({MODEL}, effort={EFFORT}, cap={MAX_OUT}, background=True)...", flush=True)

    interaction = client.interactions.create(
        model=MODEL,
        input=PROMPT,
        background=True,
        generation_config={
            "thinking_level": EFFORT,
            "max_output_tokens": MAX_OUT,
        },
    )
    print(f"  Interaction ID: {interaction.id} (initial status={interaction.status})", flush=True)

    polls = 0
    while getattr(interaction, "status", None) in ("in_progress", "queued"):
        time.sleep(5)
        polls += 1
        interaction = client.interactions.get(id=interaction.id)
        if polls % 6 == 0:
            elapsed_now = time.perf_counter() - t0
            print(f"  ... polling ({elapsed_now:.0f}s, status={interaction.status})", flush=True)

    elapsed = time.perf_counter() - t0
    status = getattr(interaction, "status", "unknown")
    raw_text, hops = extract_long_decode_text(interaction)
    html = extract_html(raw_text)
    html_path = OUT_DIR / f"{CELL_ID}.html"
    html_path.write_text(html, encoding="utf-8")

    u = getattr(interaction, "usage", None)
    in_tok = int(getattr(u, "total_input_tokens", 0) or 0)
    cached_tok = int(getattr(u, "total_cached_tokens", 0) or 0)
    out_tok = int(getattr(u, "total_output_tokens", 0) or 0)
    thought_tok = int(getattr(u, "total_thought_tokens", 0) or 0)
    tot_tok = int(getattr(u, "total_tokens", 0) or (in_tok + out_tok + thought_tok))

    p = PRICING_USD_PER_M[MODEL]
    uncached_in = max(0, in_tok - cached_tok)
    billable_out = out_tok + thought_tok
    cost_usd = (uncached_in * p["in"] + cached_tok * p["cached"] + billable_out * p["out"]) / 1_000_000.0
    tps = billable_out / elapsed if elapsed > 0 else 0.0

    rec = {
        "cell_id": CELL_ID,
        "model": MODEL,
        "effort": EFFORT,
        "max_output_tokens_cap": MAX_OUT,
        "long_decode": True,
        "long_decode_hops": hops,
        "technique": "Direct Single-Shot API (Interactions v1, 128K Long Decode)",
        "status": "ok" if status == "completed" else f"status:{status}",
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

    has_close = ("</script>" in html.lower()) and ("</html>" in html.lower())
    print(
        f"[LONG DECODE DONE] status={status} | hops={hops} | {rec['wall_clock_sec']}s | "
        f"in={in_tok} (cached={cached_tok}) thought={thought_tok} out={out_tok} | "
        f"{rec['tokens_per_sec']} tok/s | ${rec['cost_usd']:.4f} | {rec['html_lines']} LOC | complete={has_close}",
        flush=True,
    )

    metrics_path = OUT_DIR / "effort_sweep_metrics.json"
    rows = json.loads(metrics_path.read_text(encoding="utf-8"))
    rows = [r for r in rows if r["cell_id"] != CELL_ID]
    # Insert right after hydrogen_xhigh for direct side-by-side comparison
    insert_at = next((i + 1 for i, r in enumerate(rows) if r["cell_id"] == "hydrogen_xhigh"), len(rows))
    rows.insert(insert_at, rec)
    metrics_path.write_text(json.dumps(rows, indent=2), encoding="utf-8")
    print(f"Updated {metrics_path} (total {len(rows)} cells)", flush=True)
    return 0


if __name__ == "__main__":
    sys.exit(main())
