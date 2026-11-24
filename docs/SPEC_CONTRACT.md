# Clean-Room Benchmark Specification Contract (`SPEC_CONTRACT.md`)

**Project Root:** `C:\Users\ckstn\.gemini\antigravity\scratch\neon-frontier-bench-2026`  
**Workflow Version:** V3 Clean-Room Benchmark Workflow (`Gate 0 → Gate 5.5` + Multimodal RLAIF Round 1 → Round 2)

---

## 1. Gate 0 — Zero-Trademark & Clean-Room Policy Lock
- Every work uses 100% original naming (`Chronos Calibre`, `Cambridge Study 1936`, `AeroFan X-900`, `ChromaForge`, `Kinetic Atelier`) with zero copyrighted characters, brands, or third-party proprietary assets.
- Zero external CDN runtime dependencies! Three.js is served locally via `/node_modules/three/build/three.module.js` and `/node_modules/three/examples/jsm/...` using standard ES Module `<script type="importmap">` so `http >= 400 === 0` is guaranteed offline and online.
- Zero pre-made 3D meshes, zero external texture images, zero audio files: **100% procedural geometry, procedural PBR/canvas textures, custom GLSL shaders, and synthesized Web Audio API soundscapes.**

---

## 2. Strict Non-Overlapping Folder Ownership (Zero-Grafting Rule)

| Track / Component | Exclusive Directory | Owner Model & Technique |
|---|---|---|
| Track 1A (Watch — Neon) | `works/track-1a-watch-neon/` | `gemini-4-neon-xhigh` (Specialist Single-Agent) |
| Track 1B (Watch — Opus) | `works/track-1b-watch-opus/` | `claude-opus-5-5-high` (Cross-Vendor Control) |
| Track 2A (Study Room 3D) | `works/track-2-turing-study/study-scene.js` + `index.html` + `styles.css` | `gemini-4-neon-xhigh` (`turing-arch` Swarm Worker 1) |
| Track 2B (Universal Turing Machine Engine + 3D Apparatus + Audio) | `works/track-2-turing-study/utm-core.js` + `utm-mesh.js` + `utm-audio.js` | `gemini-4-neon-xhigh` (`turing-utm` Swarm Worker 2) |
| Track 3 (Turbofan CAD) | `works/track-3-turbofan-cad/` | `gemini-4-carbon-high` (One-Shot Master Spec) |
| Track 4 (ChromaForge Art + Formula Relight) | `works/track-4-chroma-forge/` | `gemini-4-argon-high` (Iterative Visual Refinement) |
| Track 5 (Rube Goldberg + XPBD Cloth) | `works/track-5-kinetic-cloth/` | `gemini-4-neon-high` (`kinetic-arch` spec) → `gemini-4-hydrogen-xhigh` (`kinetic-exec` builder) |
| Exhibition Portal & RLAIF Dashboard | `index.html`, `portal.js`, `portal.css` | Coordinator (`gemini-4-neon-xhigh`) |
| Telemetry, QA & RLAIF Scripts | `scripts/`, `qa/`, `results/` | Coordinator + Independent QA (`qa-verifier`) |

---

## 3. Mandatory Runtime & Instrumentation Contract (All 6 Works)

Every `works/<track-id>/index.html` MUST expose a clean global harness interface for deterministic Gate 5.5 Playwright verification:

```js
window.__BENCH_META__ = {
  id: "<track-id>",
  title: "<Work Title>",
  domain: "<Domain Name>",
  model: "<model-id>",
  effort: "<low|medium|high|xhigh>",
  technique: "<Paradigm>",
  ready: false,           // Set true ONLY after first rendered frame + shader pre-warm
  bootMs: 0,              // performance.now() at ready=true
  shaderPrewarmMs: 0,     // Time spent pre-warming WebGL2 shaders/programs (0 for pure SVG/2D)
  drawCalls: 0,           // Live renderer.info.render.calls (or SVG element count for vector tracks)
  triangles: 0,           // Live renderer.info.render.triangles (or path segments for vector tracks)
  fps: 0,                 // Smoothed live FPS
  telemetry: {}           // Domain-specific live metrics (e.g., rpm, thrustKN, utmSteps, activeCells, clothNodes)
};

window.__BENCH_ACTIONS__ = {
  // Deterministic camera/mode triggers used by Gate 5.5 QA to capture 4 canonical screenshots:
  // "hero", "macro", "alt_mode", "action_state"
  setView: (viewName) => { /* return true if applied */ },
  triggerAction: (actionName) => { /* trigger interactive mutation & return summary string */ }
};
```

### Mandatory Engineering & Aesthetic Guardrails (Addressing Community Reply Critiques)
1. **Zero Shader Compile Stutter (`@spvn` critique):** All WebGL2 tracks MUST call `renderer.compile(scene, camera)` + render 2 warm-up frames before setting `window.__BENCH_META__.ready = true`.
2. **Anti-"AI-Slop" Visual Discipline (`@amok8938` critique):**
   - NO generic neon-purple-cyan SaaS cards, NO cliché glassmorphism overload, NO overlapping text badges, NO uncalibrated glowing soup.
   - Each work MUST adopt an authentic, domain-native industrial/editorial visual language:
     - *Watches (1A & 1B):* Haute-horlogerie Geneva editorial studio — warm anthracite/obsidian guilloché dial plate, brushed rhodium, Côtes de Genève striping, thermally blued screws, hair-thin precision typography (`tabular-nums`).
     - *Cambridge Study 1936:* Atmospheric 1930s British academic warmth — aged oak, dusty sunlight shafts through Gothic leaded glass, antique brass patina, muted sage banker's lamp glow, museum placard minimal HUD.
     - *AeroFan X-900 CAD:* Precision aerospace instrumentation — crisp studio light/dark technical CAD aesthetic inspired by real Siemens NX / Catia cutaways, clear Solid/Wireframe/X-Ray/Thermal toggles, monospaced tabular telemetry.
     - *ChromaForge:* Swiss gallery exhibition minimal frame — maximum canvas real estate for high-dynamic-range hex-flame shaders & live 57.6K cell spreadsheet formula inspector.
     - *Kinetic Atelier:* Warm spotlit steampunk-arcade diorama — rich dark walnut & machined brass bench inside a subtly glowing 1980s hall, dramatic key rim lighting, silky emerald cloth physics banner.
3. **Narrow-Pane Responsive HUD (`700×900`, `0` Overlaps):** Control panels MUST stay compact or collapsible (`<= 280px` drawer or clean bottom strip) and never overlap canvas titles, KPI pills, or each other at `700×900` OR `1440×900`.
4. **WebGL2 Strict Safety (`V3 Postmortem #5`):**
   - Never inject duplicate `onBeforeCompile` hooks on shared materials.
   - Never use early `return` inside helper GLSL functions that could trigger ANGLE D3D11 `warning X4000`.
   - Always keep `depthWrite: true` on opaque surfaces; clamp pixel ratio `Math.min(window.devicePixelRatio, 2)`.
   - Zero `console.error`, zero `console.warn` (including WebGL/Three.js deprecation warnings!), zero uncaught exceptions.

---

## 4. Official Nov 2026 Token Pricing Reference (Verified via Gemini Docs MCP)

| Model | Input ($ / 1M) | Cached Input ($ / 1M) | Output incl. Thinking ($ / 1M) | Thinking Levels | Source |
|---|---:|---:|---:|---|---|
| `gemini-4-neon` | `$3.00` | `$0.15` | `$15.00` | `low`, `medium`, `high` (def), `xhigh` | `gemini-api-guides/pricing.md` (Nov 2026) |
| `gemini-4-carbon` | `$2.00` (intro thru Nov 30; `$4.00` Dec 1) | `$0.10` | `$10.00` (intro; `$20.00` Dec 1) | `low`, `medium` (def), `high` | `gemini-api-guides/pricing.md` |
| `gemini-4-argon` | `$2.00` (intro thru Nov 30; `$4.00` Dec 1) | `$0.10` | `$10.00` (intro; `$20.00` Dec 1) | `low`, `medium` (def), `high` | `gemini-api-guides/pricing.md` |
| `gemini-4-hydrogen` | `$1.50` | `$0.075` | `$7.50` | `low`, `medium`, `high` (def), `xhigh` | `gemini-api-guides/pricing.md` |
| `gemini-decision-1` | `$0.10` | N/A | `$0.00` (0 output tokens) | Calibrated Decision Model | `gemini-api-guides/pricing.md` |
| `claude-opus-5-5` | Tracked via Antigravity transcript tokens (`input`, `cache_read`, `output`) | — | — | `low`, `medium`, `high` | Antigravity `transcript.jsonl` |

---

## 5. Locked Quantitative + Qualitative RLAIF Rubric (6 Axes, 0–4 Scale → Normalized 0–100)

Evaluated via **two independent AI feedback layers**:
1. **Calibrated Multimodal Decision Model (`gemini-decision-1`, `v1beta` Decisions API):** Computes probability-weighted expected score, per-level probability distribution, and confidence over the 4 rendered screenshots (`hero`, `macro`, `alt_mode`, `narrow_700x900`) + Playwright runtime telemetry JSON.
2. **Blind Cross-Model Qualitative Critic (`gemini-4-carbon-high` via Interactions API):** Reviews screenshots & metrics blindly without model names, emits actionable critique + concrete defect list used to drive **RLAIF Round 1 → Round 2 refinement**!

| Axis | Weight | Level 0 → Level 4 Anchor Criteria |
|---|---:|---|
| 1. `visual_craftsmanship` | 20% | 0=Broken/blank · 1=Primitive shapes/flat lighting · 2=Decent prototype · 3=Cohesive materials & studio lighting · 4=Gallery/exhibition-grade art direction |
| 2. `domain_engineering_fidelity` | 20% | 0=Fake/static · 1=Superficial animation · 2=Partially accurate model · 3=Physically/mathematically solid · 4=Deep domain-authentic simulation (involute teeth, real UTM, Brayton thermo, live formulas, XPBD cloth) |
| 3. `interactivity_and_ux` | 15% | 0=Unusable/overlapping · 1=Cluttered controls · 2=Functional basic HUD · 3=Clean responsive controls (`0` overlaps) · 4=Effortless tactile studio UX across `1440×900` & `700×900` |
| 4. `technical_performance` | 15% | 0=Errors/crash/<15 FPS · 1=Warnings/stutter · 2=0 errors & 30+ FPS · 3=0 errors, 55+ FPS, fast boot · 4=0 errors/warnings, locked 60 FPS, pre-warmed shaders, tight resource budget |
| 5. `reference_surpassing_depth` | 15% | 0=Misses reference · 1=Minimal toy clone · 2=Matches core demo idea · 3=Matches visual & technical scope · 4=Surpasses public reference AND resolves community comment critiques |
| 6. `craft_authenticity_anti_ai_look` | 15% | 0=Generic broken slop · 1=Obvious default AI neon-card template · 2=Acceptable tech demo · 3=Distinctive bespoke styling · 4=Indistinguishable from a bespoke human design studio piece |
