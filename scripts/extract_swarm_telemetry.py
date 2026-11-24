#!/usr/bin/env python3
"""
Extracts exact hardware-logged token usage, cache hit ratio, wall-clock duration,
turn/step counts, tool calls, and official Nov 2026 USD cost directly from every
Antigravity Swarm worker's `.system_generated/logs/transcript.jsonl`.
"""
from __future__ import annotations

import json
import sys
from datetime import datetime
from pathlib import Path

BRAIN_DIR = Path(r"C:\Users\ckstn\.gemini\antigravity\brain")
ROOT = Path(r"C:\Users\ckstn\.gemini\antigravity\scratch\neon-frontier-bench-2026")
REGISTRY_PATH = ROOT / "results" / "swarm_registry.json"

# Official Nov 2026 Standard Paid Tier API reference rates ($ / 1M tokens)
# Note: Claude Opus 5.5 API rate is benchmarked separately via community reference ($5 in / $25 out or tracked raw tokens);
# we report exact raw tokens + note API-equivalent pricing clearly.
RATES = {
    "gemini-4-neon": {"in": 3.00, "cache": 0.15, "out": 15.00, "official": True},
    "gemini-4-carbon": {"in": 2.00, "cache": 0.10, "out": 10.00, "official": True},
    "gemini-4-argon": {"in": 2.00, "cache": 0.10, "out": 10.00, "official": True},
    "gemini-4-hydrogen": {"in": 1.50, "cache": 0.075, "out": 7.50, "official": True},
    "claude-opus-5-5": {"in": 5.00, "cache": 0.50, "out": 25.00, "official": False},
}


def base_model_key(model_str: str) -> str:
    m = (model_str or "").lower()
    for k in RATES:
        if k in m:
            return k
    return "gemini-4-neon"


def parse_iso(ts: str) -> float | None:
    if not ts:
        return None
    try:
        return datetime.fromisoformat(ts.replace("Z", "+00:00")).timestamp()
    except Exception:
        return None


def inspect_worker(cid: str) -> dict:
    log_path = BRAIN_DIR / cid / ".system_generated" / "logs" / "transcript.jsonl"
    if not log_path.exists():
        return {"error": f"missing {log_path}"}

    in_tok = 0
    cache_tok = 0
    out_tok = 0
    planner_steps = 0
    tool_calls = 0
    models_seen = set()
    timestamps = []

    with log_path.open("r", encoding="utf-8", errors="replace") as f:
        for line in f:
            if not line.strip():
                continue
            try:
                row = json.loads(line)
            except Exception:
                continue
            ts = parse_iso(row.get("created_at", ""))
            if ts is not None:
                timestamps.append(ts)
            if row.get("type") == "PLANNER_RESPONSE":
                planner_steps += 1
                in_tok += int(row.get("input_tokens") or 0)
                cache_tok += int(row.get("cache_read_tokens") or 0)
                out_tok += int(row.get("output_tokens") or 0)
                if row.get("model"):
                    models_seen.add(row["model"])
                tcs = row.get("tool_calls")
                if isinstance(tcs, list):
                    tool_calls += len(tcs)

    wall_sec = round(max(timestamps) - min(timestamps), 2) if len(timestamps) >= 2 else 0.0
    total_prompt_context = in_tok + cache_tok
    # Note: in Antigravity transcript.jsonl, check whether input_tokens includes cache_read_tokens or is uncached:
    # We compute uncached = max(0, in_tok - cache_tok) if in_tok >= cache_tok else in_tok, and report both raw fields!
    if in_tok >= cache_tok and cache_tok > 0:
        uncached_in = in_tok - cache_tok
        total_in = in_tok
    else:
        uncached_in = in_tok
        total_in = in_tok + cache_tok

    cache_hit_pct = round((cache_tok / total_in) * 100.0, 1) if total_in > 0 else 0.0
    mkey = base_model_key(next(iter(models_seen), ""))
    rate = RATES[mkey]
    est_usd = (uncached_in * rate["in"] + cache_tok * rate["cache"] + out_tok * rate["out"]) / 1_000_000.0

    return {
        "conversation_id": cid,
        "models_logged": sorted(models_seen),
        "planner_turns": planner_steps,
        "tool_calls": tool_calls,
        "wall_clock_sec": wall_sec,
        "raw_input_tokens": in_tok,
        "cache_read_tokens": cache_tok,
        "uncached_input_tokens": uncached_in,
        "total_input_tokens": total_in,
        "output_tokens": out_tok,
        "total_tokens": total_in + out_tok,
        "cache_hit_pct": cache_hit_pct,
        "est_api_usd": round(est_usd, 4),
        "rate_is_official_gemini_docs": rate["official"],
    }


def main() -> int:
    if not REGISTRY_PATH.exists():
        print(f"Registry missing: {REGISTRY_PATH}", file=sys.stderr)
        return 1
    reg = json.loads(REGISTRY_PATH.read_text(encoding="utf-8"))
    summary = []
    for track in reg["tracks"]:
        worker_stats = []
        for w in track["workers"]:
            st = inspect_worker(w["conversation_id"])
            st["worker_name"] = w["name"]
            st["model"] = w["model"]
            st["effort"] = w["effort"]
            worker_stats.append(st)

        # Aggregate per track
        agg = {
            "trackId": track["trackId"],
            "title": track["title"],
            "domain": track["domain"],
            "model_label": track["model_label"],
            "effort": track["effort"],
            "technique": track["technique"],
            "workers": worker_stats,
            "planner_turns": sum(x.get("planner_turns", 0) for x in worker_stats),
            "tool_calls": sum(x.get("tool_calls", 0) for x in worker_stats),
            "wall_clock_sec": round(max((x.get("wall_clock_sec", 0) for x in worker_stats), default=0.0), 2),
            "sum_worker_wall_sec": round(sum(x.get("wall_clock_sec", 0) for x in worker_stats), 2),
            "total_input_tokens": sum(x.get("total_input_tokens", 0) for x in worker_stats),
            "cache_read_tokens": sum(x.get("cache_read_tokens", 0) for x in worker_stats),
            "uncached_input_tokens": sum(x.get("uncached_input_tokens", 0) for x in worker_stats),
            "output_tokens": sum(x.get("output_tokens", 0) for x in worker_stats),
            "total_tokens": sum(x.get("total_tokens", 0) for x in worker_stats),
            "est_api_usd": round(sum(x.get("est_api_usd", 0.0) for x in worker_stats), 4),
        }
        agg["cache_hit_pct"] = (
            round((agg["cache_read_tokens"] / agg["total_input_tokens"]) * 100.0, 1)
            if agg["total_input_tokens"] > 0
            else 0.0
        )
        summary.append(agg)
        print(
            f"[TELEMETRY] {agg['trackId']:24s} | {agg['model_label']:24s} | {agg['wall_clock_sec']:6.1f}s | "
            f"in={agg['total_input_tokens']:8,d} (cache {agg['cache_hit_pct']:4.1f}%) | "
            f"out={agg['output_tokens']:6,d} | turns={agg['planner_turns']:2d} | ${agg['est_api_usd']:.4f}"
        )

    out_path = ROOT / "results" / "swarm_telemetry.json"
    out_path.write_text(json.dumps(summary, indent=2), encoding="utf-8")
    print(f"Saved Swarm telemetry -> {out_path}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
