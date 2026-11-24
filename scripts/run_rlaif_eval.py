#!/usr/bin/env python3
"""
Dual-Layer Quantitative + Qualitative Multimodal RLAIF Engine:
  Layer 1: Calibrated probabilistic rubric scoring via `gemini-decision-1` (v1beta Decisions API)
           evaluating actual rendered PNG screenshots + Playwright runtime telemetry across 6 locked axes.
  Layer 2: Blind Cross-Model Qualitative Critic (`gemini-4-carbon`, high) emitting specific visual/engineering
           critiques and concrete action items for Round 1 -> Round 2 RLAIF self-improvement.
"""
from __future__ import annotations

import base64
import json
import sys
from pathlib import Path
from google import genai

ROOT = Path(r"C:\Users\ckstn\.gemini\antigravity\scratch\neon-frontier-bench-2026")

WEIGHTS = {
    "visual_craftsmanship": 0.20,
    "domain_engineering_fidelity": 0.20,
    "interactivity_and_ux": 0.15,
    "technical_performance": 0.15,
    "reference_surpassing_depth": 0.15,
    "craft_authenticity_anti_ai_look": 0.15,
}

QUESTIONS = {
    "visual_craftsmanship": {
        "type": "score",
        "instructions": "Evaluate overall visual craftsmanship, composition, lighting, material fidelity, and typography across all screenshots.",
        "criteria": [
            "Broken, blank, or severely glitched rendering.",
            "Crude primitive geometry or flat unstyled canvas.",
            "Acceptable functional prototype with noticeable visual rough edges.",
            "Strong cohesive materials, studio lighting, and clean layout.",
            "Exhibition/gallery-grade visual art direction with refined lighting, shading, and polish.",
        ],
    },
    "domain_engineering_fidelity": {
        "type": "score",
        "instructions": "Evaluate mathematical, physical, mechanical, or architectural domain authenticity shown in the screenshots and telemetry.",
        "criteria": [
            "Static or fake placeholder with no real domain simulation.",
            "Superficial animation disconnected from real domain physics or mechanics.",
            "Partially accurate simulation covering basic domain concepts.",
            "Solid, authentic domain engineering with rich interactive mechanics and telemetry.",
            "Deep domain-authentic simulation matching or surpassing flagship technical showcases.",
        ],
    },
    "interactivity_and_ux": {
        "type": "score",
        "instructions": "Evaluate UI/HUD layout clarity, control ergonomics, and responsive polish across both 1440x900 desktop and 700x900 narrow-pane views.",
        "criteria": [
            "Unusable, broken controls, or severe text/panel collisions.",
            "Cluttered HUD obstructing the main viewport or overlapping on narrow screens.",
            "Functional controls with minor crowding or aesthetic unevenness.",
            "Clean, well-structured studio HUD with zero overlaps across desktop and narrow panes.",
            "Effortless, tactile studio-grade interface maximizing canvas focus with crisp tabular readouts.",
        ],
    },
    "technical_performance": {
        "type": "score",
        "instructions": "Evaluate measured technical execution from the attached Playwright QA telemetry (FPS, frame time, boot latency, zero console/page/HTTP errors, shader pre-warming).",
        "criteria": [
            "Runtime errors, crashes, or unusable frame rate (<15 FPS).",
            "Warnings, slow boot, or unstable frame pacing.",
            "Zero runtime errors and steady >=30 FPS.",
            "Zero errors, strong >=55 FPS, clean pre-warmed rendering.",
            "Zero errors and zero warnings, locked ~60 FPS, fast boot, disciplined resource footprint.",
        ],
    },
    "reference_surpassing_depth": {
        "type": "score",
        "instructions": "Evaluate how ambitiously this clean-room work matches or surpasses viral 2026 frontier AI showcase benchmarks in its domain.",
        "criteria": [
            "Fails to represent the benchmark domain.",
            "Minimal toy demo far below public showcase expectations.",
            "Reproduces the core showcase concept competently.",
            "Matches public flagship showcase scope with multi-view inspection and real interactivity.",
            "Surpasses public showcase benchmarks with deeper mechanics, multi-mode inspection, and community-requested polish.",
        ],
    },
    "craft_authenticity_anti_ai_look": {
        "type": "score",
        "instructions": "Specifically audit for 'AI-generated template slop' (generic glowing purple/cyan SaaS cards, repetitive gradients, sterile layouts). Rate how authentically human-studio-crafted it looks.",
        "criteria": [
            "Broken or obvious low-effort generated boilerplate.",
            "Strongly generic AI template look (cliché neon boxes, uncalibrated glow, generic dashboard chrome).",
            "Decent engineering demo with moderate AI-template cues.",
            "Distinctive domain-appropriate bespoke design language.",
            "Indistinguishable from a bespoke human design studio or museum-grade interactive exhibit.",
        ],
    },
}


def img_part(path: Path) -> dict:
    data = base64.b64encode(path.read_bytes()).decode("ascii")
    return {"type": "image", "data": data, "mime_type": "image/png"}


def score_track_decision_api(client_beta: genai.Client, qa_item: dict) -> dict:
    telemetry_summary = {
        "domain": qa_item.get("meta", {}).get("domain", ""),
        "title": qa_item.get("meta", {}).get("title", ""),
        "pass": qa_item["pass"],
        "navReadyMs": qa_item["navReadyMs"],
        "shaderPrewarmMs": qa_item.get("meta", {}).get("shaderPrewarmMs"),
        "fpsMedian": qa_item["perf"]["fpsMedian"],
        "fpsP10": qa_item["perf"]["fpsP10"],
        "frameTimeMedianMs": qa_item["perf"]["frameTimeMedianMs"],
        "drawCalls": qa_item.get("meta", {}).get("drawCalls"),
        "triangles": qa_item.get("meta", {}).get("triangles"),
        "consoleErrors": len(qa_item["consoleErrors"]),
        "consoleWarnings": len(qa_item["consoleWarnings"]),
        "pageErrors": len(qa_item["pageErrors"]),
        "httpErrors": len(qa_item["httpErrors"]),
        "hudDesktopOverlaps": qa_item["hudDesktop"]["overlaps"],
        "hudNarrow700Overlaps": qa_item["hudNarrow"]["overlaps"],
        "hudNarrowOverflowX": qa_item["hudNarrow"]["overflowX"],
        "actionResult": qa_item["actionResult"],
        "domainTelemetry": qa_item.get("meta", {}).get("telemetry", {}),
    }

    inputs = [
        {
            "type": "text",
            "text": (
                "Evaluate this interactive benchmark build strictly and honestly from the 4 rendered screenshots "
                "(1: Desktop Hero 1440x900, 2: Macro Close-up 1440x900, 3: Alternate Mode / Action 1440x900, "
                "4: Narrow Pane 700x900) and the verified Playwright runtime telemetry below.\n"
                f"Telemetry JSON:\n{json.dumps(telemetry_summary, indent=2)}"
            ),
        }
    ]
    for key in ["hero", "macro", "alt_mode", "narrow"]:
        p = Path(qa_item["screenshots"][key])
        if p.exists():
            inputs.append(img_part(p))

    res = client_beta.decisions.create(
        model="gemini-decision-1",
        input=inputs,
        questions=QUESTIONS,
    )

    axes = {}
    weighted_0_to_4 = 0.0
    for k, w in WEIGHTS.items():
        ans = res.answers[k]
        sc = float(ans.score)
        weighted_0_to_4 += sc * w
        axes[k] = {
            "score_0_4": round(sc, 3),
            "score_0_100": round((sc / 4.0) * 100.0, 1),
            "confidence": round(float(ans.confidence), 3),
            "probabilities": {str(lv): round(float(pr), 4) for lv, pr in ans.probabilities.items()},
        }

    total_100 = round((weighted_0_to_4 / 4.0) * 100.0, 2)
    return {
        "trackId": qa_item["trackId"],
        "rlaif_decision_score_100": total_100,
        "axes": axes,
    }


def blind_qualitative_critic(client_std: genai.Client, qa_item: dict, anon_label: str) -> dict:
    # Strip model/effort/technique identifiers so the critique is 100% blind!
    blind_telemetry = {
        "candidate": anon_label,
        "domain": qa_item.get("meta", {}).get("domain", ""),
        "fpsMedian": qa_item["perf"]["fpsMedian"],
        "fpsP10": qa_item["perf"]["fpsP10"],
        "navReadyMs": qa_item["navReadyMs"],
        "consoleErrors": len(qa_item["consoleErrors"]),
        "consoleWarnings": len(qa_item["consoleWarnings"]),
        "hudNarrowOverlaps": qa_item["hudNarrow"]["overlaps"],
        "hudNarrowOverflowX": qa_item["hudNarrow"]["overflowX"],
        "drawCalls": qa_item.get("meta", {}).get("drawCalls"),
        "triangles": qa_item.get("meta", {}).get("triangles"),
        "loc": qa_item["codeStats"]["lines"],
    }

    inputs = [
        {
            "type": "text",
            "text": (
                f"You are a ruthless, exhibition-grade Creative Director & Principal Graphics Engineer performing a BLIND RLAIF visual & engineering audit for {anon_label}.\n"
                "Inspect the 4 screenshots (Hero 1440x900, Macro Close-up, Alt Mode/Action, Narrow 700x900) and telemetry.\n"
                "Return STRICT JSON with keys:\n"
                '  "strengths": [2-3 specific visual/engineering strengths observed in the pixels],\n'
                '  "defects_and_ai_tells": [2-4 concrete visual, geometric, lighting, typography, or HUD flaws observed in the screenshots],\n'
                '  "actionable_r2_fixes": [2-3 high-leverage code/visual upgrades to raise quality toward exhibition grade],\n'
                '  "blind_qualitative_score_100": <integer 0-100>,\n'
                '  "verdict_ko": "<concise 2-sentence Korean qualitative verdict>"\n'
                f"Telemetry:\n{json.dumps(blind_telemetry, indent=2)}"
            ),
        }
    ]
    for key in ["hero", "macro", "alt_mode", "narrow"]:
        p = Path(qa_item["screenshots"][key])
        if p.exists():
            inputs.append(img_part(p))

    res = client_std.interactions.create(
        model="gemini-4-carbon",
        input=inputs,
        generation_config={"thinking_level": "medium", "max_output_tokens": 8192},
    )
    txt = (res.output_text or "").strip()
    s = txt.find("{")
    e = txt.rfind("}")
    if s != -1 and e != -1:
        try:
            parsed = json.loads(txt[s : e + 1])
            parsed["critic_model"] = "gemini-4-carbon (medium, blind)"
            return parsed
        except Exception:
            pass
    return {"raw": txt, "blind_qualitative_score_100": None, "critic_model": "gemini-4-carbon (medium, blind)"}


def score_effort_sweep(client_beta: genai.Client) -> None:
    qa_path = ROOT / "results" / "effort_sweep" / "effort_sweep_qa.json"
    metrics_path = ROOT / "results" / "effort_sweep" / "effort_sweep_metrics.json"
    if not qa_path.exists() or not metrics_path.exists():
        print("Effort sweep QA or metrics not found; skipping sweep RLAIF.")
        return
    qa_rows = {r["cell_id"]: r for r in json.loads(qa_path.read_text(encoding="utf-8"))}
    metric_rows = json.loads(metrics_path.read_text(encoding="utf-8"))

    sweep_q = {
        "visual_craft": QUESTIONS["visual_craftsmanship"],
        "domain_fidelity": QUESTIONS["domain_engineering_fidelity"],
        "ux_polish": QUESTIONS["interactivity_and_ux"],
        "anti_ai_look": QUESTIONS["craft_authenticity_anti_ai_look"],
    }
    for row in metric_rows:
        cid = row["cell_id"]
        q = qa_rows.get(cid)
        if not q or not Path(q["screenshot"]).exists():
            continue
        inputs = [
            {
                "type": "text",
                "text": (
                    f"Evaluate this single-shot Swiss Escapement & Double-Pendulum Phase-Space Studio screenshot. "
                    f"Runtime pass={q['runtime_pass']}, FPS={q['perf']['fpsMedian']}, errors={len(q['consoleErrors'])+len(q['pageErrors'])}, hud_overlaps={q['hud']['overlaps']}."
                ),
            },
            img_part(Path(q["screenshot"])),
        ]
        res = client_beta.decisions.create(model="gemini-decision-1", input=inputs, questions=sweep_q)
        scores = {k: round((float(res.answers[k].score) / 4.0) * 100.0, 1) for k in sweep_q}
        avg = round(sum(scores.values()) / len(scores), 2)
        if not q["runtime_pass"]:
            avg = round(avg * 0.5, 2)
        row["qa_runtime_pass"] = q["runtime_pass"]
        row["qa_fps"] = q["perf"]["fpsMedian"]
        row["qa_errors"] = len(q["consoleErrors"]) + len(q["pageErrors"])
        row["qa_overlaps"] = q["hud"]["overlaps"]
        row["rlaif_axes"] = scores
        row["rlaif_score_100"] = avg
        row["quality_per_cent"] = round(avg / max(0.01, row.get("cost_usd", 0.001) * 100.0), 1)
        print(
            f"  [SWEEP RLAIF] {cid:14s} | RLAIF={avg:5.1f} | FPS={q['perf']['fpsMedian']:5.1f} | "
            f"errs={row['qa_errors']} | tok={row.get('total_tokens',0):6d} (thought={row.get('thought_tokens',0):5d}) | "
            f"${row.get('cost_usd',0):.4f}",
            flush=True,
        )

    out_path = ROOT / "results" / "effort_sweep" / "effort_sweep_full.json"
    out_path.write_text(json.dumps(metric_rows, indent=2), encoding="utf-8")
    print(f"Saved full effort sweep + RLAIF -> {out_path}")


def main() -> int:
    mode = sys.argv[1] if len(sys.argv) > 1 else "works"
    round_num = sys.argv[2] if len(sys.argv) > 2 else "1"

    client_beta = genai.Client(http_options={"api_version": "v1beta"})
    client_std = genai.Client()

    if mode in ("sweep", "both"):
        score_effort_sweep(client_beta)

    if mode in ("works", "both"):
        from concurrent.futures import ThreadPoolExecutor
        qa_path = ROOT / "results" / f"qa_round{round_num}.json"
        qa_list = json.loads(qa_path.read_text(encoding="utf-8"))

        def eval_one(idx_item):
            idx, item = idx_item
            anon = f"Candidate-{chr(65 + idx)}"
            cb = genai.Client(http_options={"api_version": "v1beta"})
            cs = genai.Client()
            dec = score_track_decision_api(cb, item)
            crit = blind_qualitative_critic(cs, item, anon)
            bscore = crit.get("blind_qualitative_score_100")
            if bscore is None:
                bscore = dec["rlaif_decision_score_100"]
            combined = round(0.60 * dec["rlaif_decision_score_100"] + 0.40 * float(bscore), 2)
            entry = {
                "trackId": item["trackId"],
                "anon_label": anon,
                "round": int(round_num),
                "decision_rlaif_100": dec["rlaif_decision_score_100"],
                "blind_critic_100": crit.get("blind_qualitative_score_100"),
                "composite_rlaif_100": combined,
                "decision_axes": dec["axes"],
                "blind_critique": crit,
            }
            print(
                f"  [RLAIF R{round_num}] {item['trackId']:24s} | Composite={combined:5.1f} "
                f"(Decision-1={dec['rlaif_decision_score_100']:5.1f}, Blind-Carbon={crit.get('blind_qualitative_score_100')})",
                flush=True,
            )
            return idx, entry

        with ThreadPoolExecutor(max_workers=6) as ex:
            paired = list(ex.map(eval_one, enumerate(qa_list)))
        paired.sort(key=lambda x: x[0])
        out = [e for _, e in paired]
        out_path = ROOT / "results" / f"rlaif_round{round_num}.json"
        out_path.write_text(json.dumps(out, indent=2, ensure_ascii=False), encoding="utf-8")
        print(f"Saved Works RLAIF R{round_num} -> {out_path}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
