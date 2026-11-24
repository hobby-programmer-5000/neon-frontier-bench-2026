# Contributors & Role Attribution

This repository follows strict transparent attribution between **Human Benchmark Direction & Qualitative Evaluation** and **AI Agentic Engineering & Multi-Model Swarm Execution**.

---

## 1. Human Author — `hobby-programmer-5000` (`hobbyprogrammer5000@gmail.com`)

**Role:** Project Initiator · Benchmark Architect · Fairness Gatekeeper · Human Qualitative Evaluator (Ground Truth)

- **Project Motivation & Problem Framing:** Initiated the benchmark to test widespread SNS/YouTube/Reddit hype around **Google Gemini 4 Neon** (Nov 18, 2026) through real, end-to-end clean-room implementations rather than relying on vendor charts.
- **Experimental Design & Directives:**
  - Mandated multi-domain coverage (Art, Precision Mechanical CAD, 3D Architecture/Computing, Aerospace Thermodynamics, Real-Time Physics/Cloth) grounded in public video showcases **and** community comment/reply critiques.
  - Required exact quantitative telemetry (token usage, cache hit rate, wall-clock time, model, effort level, paradigm/technique, real runtime FPS) paired with **dual quantitative + qualitative RLAIF**.
  - Enforced **controlled round-parity fairness** (explicitly halting Round 3 after Round 2 completion to preserve strict apples-to-apples round parity and protect real-world quota limits).
  - Directed the single-frame comparison reel layout (Head-to-Head Split-Screen Showdown first, followed by sequential domain showcase) and MIT open-source publication.
- **Ground-Truth Human Qualitative Evaluation (RLHF Signal):** Directly interacted with all 6 live works (including the blind/revealed `Neon XHigh` vs `Opus 5.5 High` horology showdown), scoring aesthetics, domain craft, UX ergonomics, and anti-AI naturalness — uncovering the **RLAIF Judge Aesthetic Blind-Spot** (`Decision-1 Visual Craft ρ = -0.261` vs `Anti-AI-Look ρ = +0.696`).

---

## 2. AI Engineering Partner — `antigravity` (`259228136+antigravity-bot@users.noreply.github.com`)

**Role:** Research Orchestrator · Clean-Room Swarm Coordinator · Automated QA & RLAIF Harness Engineer

- **Evidence-First Research & Verification:** Investigated 15+ public showcases across `blog.google`, `antigravity.google`, X (`@googledevs`, `@GoogleDeepMind`), YouTube (Chase AI, Bijan Bowen, Can It Code? + viewer comments), and Reddit (`r/GoogleGemini`, `r/GeminiAI`, `r/TopologyAI`, `r/google_antigravity`), plus live 2× Crossref DOI academic fact-checking (`7/7` DOIs verified).
- **Multi-Model Clean-Room Swarm Execution (`24,966 LOC`, 0 External Assets):**
  - Orchestrated 8 specialized workers across 5 models (`Gemini 4 Neon XHigh/High`, `Claude Opus 5.5 High`, `Gemini 4 Carbon High`, `Gemini 4 Argon High`, `Gemini 4 Hydrogen XHigh`) and 5 distinct agentic paradigms (`Specialist Single-Agent`, `Cross-Vendor Control`, `2-Worker Specialist Swarm`, `One-Shot Master Spec`, `Iterative Visual Refinement`, `Orchestrator → Executor`).
- **Telemetry, Gate 5.5 QA & Multimodal RLAIF Engineering:**
  - Built hardware-logged transcript token/cache extractor (`scripts/extract_swarm_telemetry.py`), controlled 7-cell Direct API Effort Sweep (`low → xhigh`, 32K vs 64K cap discovery), Playwright Chrome WebGL2 QA harness (`qa/run_qa.mjs`), dual-layer Multimodal RLAIF evaluator (`gemini-decision-1` + Blind `gemini-4-carbon`), interactive exhibition portal (`index.html`), and automated demo video compositing pipeline (`scripts/capture_demo_clips.mjs` + `scripts/compose_demo_video.py`).
