/**
 * Chronos Calibre N-4 — Main Horology Runtime, Interactive Controls & Benchmark Harness
 * Wires Litvin & Fuentes involute gear kinematics, 6-layer procedural SVG movement,
 * dual-layer Canvas hybrid optics, 8 Hz Swiss lever Web Audio, and SPEC_CONTRACT telemetry.
 */

import { CALIBRE, RAD, evaluateEscapementKinematics } from "./involute-math.js";
import { generateProceduralTextures, StudioOpticsEngine, HorologyAudioEngine } from "./optics-audio.js";
import { ChronosWatchRenderer } from "./watch-renderer.js";

const BOOT_T0 = performance.now();

// Canonical Z-layer elevation offsets in SVG units (Layer 0 bottom -> Layer 5 top, generous CAD separation)
const LAYER_Z_OFFSETS = [154, 92, 30, -32, -94, -156];

// Initial gallery display time: 10:09:32 (classic Swiss haute-horlogerie symmetry)
const INITIAL_CLOCK_SECONDS = 10 * 3600 + 9 * 60 + 32;

const state = {
  mode: "hero", // "hero" | "macro" | "alt_mode"
  simSeconds: 0,
  baseClockSeconds: INITIAL_CLOCK_SECONDS,
  timeScale: 1.0,
  paused: false,

  // Power reserve & mainspring winding mechanics (0..72 hours)
  powerReserveHrs: 64.5,
  amplitudeFactor: 1.0,
  windingAngleDeg: 0,
  windingVelocity: 0,
  isHoldingWind: false,
  demoWindStartMs: 0,
  demoWindDurationMs: 0,
  demoWindStartPr: 56.0,
  lastClickStepIndex: 0,

  // Camera & Exploded Isometric CAD wall-clock smooth interpolation (320ms cubic-out)
  viewBox: { x: -332, y: -332, w: 664, h: 664 },
  animStartMs: 0,
  animDurationMs: 320,
  animFromVb: { x: -332, y: -332, w: 664, h: 664 },
  animToVb: { x: -332, y: -332, w: 664, h: 664 },
  animFromExplode: 0,
  animFromMacro: 0,
  explodeProgress: 0,
  targetExplode: 0,
  macroProgress: 0,
  targetMacro: 0,
  torqueOverlay: false,
  layerZ: LAYER_Z_OFFSETS,

  // Beat tracking for audio & impulse sync
  lastBeatIndex: -1,

  // FPS telemetry smoothing
  fpsSmoothed: 60,
  frameCount: 0,
  readyFired: false,
};

// Expose SPEC_CONTRACT.md global telemetry immediately (ready stays false until first frame)
window.__BENCH_META__ = {
  id: "track-1a-watch-neon",
  title: "Chronos Calibre N-4",
  domain: "Horology & Precision CAD",
  model: "gemini-4-neon",
  effort: "xhigh",
  technique: "Clean-Room Specialist Agent",
  ready: false,
  bootMs: 0,
  shaderPrewarmMs: 0,
  drawCalls: 0,
  triangles: 0,
  fps: 60,
  telemetry: {
    vph: 28800,
    beatRateHz: 8.0,
    powerReserveHrs: 64.5,
    tourbillonDeg: 0,
    mode: "hero",
  },
};

function getTargetViewBox(mode, stageWidth) {
  if (mode === "macro") {
    // Exact 2.4x optical magnification centered squarely on the 6 o'clock Tourbillon & Swiss Lever Escapement
    return { x: -138.3, y: -26.0, w: 276.7, h: 276.7 };
  }
  if (mode === "alt_mode") {
    // Orthographic Exploded Isometric CAD framing (all 6 extruded Z-layers cleanly separated with right callout margin)
    if (stageWidth >= 760) {
      return { x: -292, y: -316, w: 760, h: 644 };
    }
    return { x: -316, y: -322, w: 632, h: 654 };
  }
  // Studio Exhibition Hero framing
  return { x: -332, y: -332, w: 664, h: 664 };
}

function init() {
  const stageCol = document.getElementById("stage-viewport");
  const bgCanvas = document.getElementById("optics-bg-canvas");
  const fgCanvas = document.getElementById("optics-fg-canvas");
  const svgEl = document.getElementById("watch-svg");
  const svgPlanes = {
    defs: document.getElementById("watch-svg-defs"),
    base: document.getElementById("watch-svg-base"),
    train: document.getElementById("watch-svg-train"),
    movement: svgEl,
    bridges: document.getElementById("watch-svg-bridges"),
    top: document.getElementById("watch-svg-top"),
  };

  // UI Element References
  const ui = {
    modeBadge: document.getElementById("hud-mode-badge"),
    telVph: document.getElementById("tel-vph"),
    telPower: document.getElementById("tel-power"),
    telCage: document.getElementById("tel-cage"),
    telAmp: document.getElementById("tel-amp"),
    metaFps: document.getElementById("meta-fps"),
    railPowerText: document.getElementById("rail-power-text"),
    railReserveFill: document.getElementById("rail-reserve-fill"),
    railScaleText: document.getElementById("rail-scale-text"),
    railExplodeText: document.getElementById("rail-explode-text"),
    btnHero: document.getElementById("btn-view-hero"),
    btnMacro: document.getElementById("btn-view-macro"),
    btnCad: document.getElementById("btn-view-cad"),
    btnWind: document.getElementById("btn-wind-crown"),
    btnSlow: document.getElementById("btn-scale-slow"),
    btnReal: document.getElementById("btn-scale-real"),
    btnFast: document.getElementById("btn-scale-fast"),
    btnPause: document.getElementById("btn-pause"),
    btnStep: document.getElementById("btn-step"),
    btnTorque: document.getElementById("btn-torque"),
    btnAudio: document.getElementById("btn-audio"),
    sliderExplode: document.getElementById("slider-explode"),
  };

  // 1. Synthesize Procedural Horological Textures (Côtes de Genève, Perlage, Sunray, Leather)
  const textures = generateProceduralTextures();

  // 2. Build 4-Plane GPU-Composited Procedural SVG Movement & Hybrid Dual-Canvas Optics Engine
  const renderer = new ChronosWatchRenderer(svgPlanes, textures);
  const optics = new StudioOpticsEngine(bgCanvas, fgCanvas, svgEl);
  const audio = new HorologyAudioEngine();

  window.__BENCH_META__.drawCalls = renderer.totalSvgElements;
  window.__BENCH_META__.triangles = renderer.totalGeometrySegments;

  function syncCanvasSize() {
    const rect = stageCol.getBoundingClientRect();
    optics.resize(Math.round(rect.width), Math.round(rect.height));
  }
  syncCanvasSize();
  window.addEventListener("resize", syncCanvasSize);
  if (typeof ResizeObserver !== "undefined") {
    const ro = new ResizeObserver(syncCanvasSize);
    ro.observe(stageCol);
  }

  // Subtle pointer-reactive sapphire specular reflection
  stageCol.addEventListener("pointermove", (ev) => {
    const rect = stageCol.getBoundingClientRect();
    if (rect.width > 0 && rect.height > 0) {
      optics.setPointer((ev.clientX - rect.left) / rect.width, (ev.clientY - rect.top) / rect.height);
    }
  });

  // Helper: sync active button states & editorial badges
  function syncUiState() {
    ui.btnHero.classList.toggle("active", state.mode === "hero");
    ui.btnMacro.classList.toggle("active", state.mode === "macro");
    ui.btnCad.classList.toggle("active", state.mode === "alt_mode");

    const modeLabels = {
      hero: "STUDIO HERO",
      macro: "MACRO 2.4× ESCAPEMENT",
      alt_mode: "EXPLODED CAD · TORQUE",
    };
    ui.modeBadge.textContent = modeLabels[state.mode] || "STUDIO HERO";

    ui.btnSlow.classList.toggle("active", Math.abs(state.timeScale - 0.1) < 0.01);
    ui.btnReal.classList.toggle("active", Math.abs(state.timeScale - 1.0) < 0.01);
    ui.btnFast.classList.toggle("active", Math.abs(state.timeScale - 10.0) < 0.01);

    ui.railScaleText.textContent = state.paused
      ? "PAUSED"
      : state.timeScale < 0.5
        ? "0.1× SLOW-MO"
        : state.timeScale > 5
          ? "10× FAST"
          : "1.0× REAL";

    ui.btnPause.textContent = state.paused ? "Resume" : "Pause";
    ui.btnPause.classList.toggle("active", state.paused);
    ui.btnTorque.classList.toggle("active", state.torqueOverlay);
    ui.btnAudio.classList.toggle("active", audio.enabled);
    ui.btnAudio.innerHTML = `<span class="status-dot"></span>${audio.enabled ? "8 Hz Active" : "8 Hz Audio"}`;
    ui.btnWind.classList.toggle("winding", state.isHoldingWind || state.demoWindDurationMs > 0);

    const explodePct = Math.round(state.targetExplode * 100);
    if (Number(ui.sliderExplode.value) !== explodePct) {
      ui.sliderExplode.value = String(explodePct);
    }
    ui.railExplodeText.textContent = `${explodePct}%`;
  }

  function startCameraTransition(targetMode, { snap = false } = {}) {
    const targetVb = getTargetViewBox(targetMode, stageCol.clientWidth || window.innerWidth);
    state.animStartMs = performance.now();
    state.animDurationMs = snap ? 0 : 300;
    state.animFromVb = { ...state.viewBox };
    state.animToVb = { ...targetVb };
    state.animFromExplode = state.explodeProgress;
    state.animFromMacro = state.macroProgress;
    if (snap) {
      state.viewBox = { ...targetVb };
      state.explodeProgress = state.targetExplode;
      state.macroProgress = state.targetMacro;
    }
  }

  // Canonical Mode Switcher (used by UI and window.__BENCH_ACTIONS__.setView)
  function applyViewMode(rawName, { snap = false } = {}) {
    const normalized = String(rawName || "hero").toLowerCase().trim();
    let targetMode = "hero";
    if (normalized === "macro" || normalized === "escapement" || normalized === "zoom") {
      targetMode = "macro";
    } else if (
      normalized === "alt_mode" ||
      normalized === "exploded" ||
      normalized === "cad" ||
      normalized === "action_state"
    ) {
      targetMode = "alt_mode";
    } else {
      targetMode = "hero";
    }

    state.mode = targetMode;
    state.targetMacro = targetMode === "macro" ? 1 : 0;
    state.targetExplode = targetMode === "alt_mode" ? 1 : 0;

    if (targetMode === "alt_mode") {
      state.torqueOverlay = true;
    } else if (targetMode === "hero") {
      state.torqueOverlay = false;
    }

    startCameraTransition(targetMode, { snap });
    syncUiState();
    return true;
  }

  // Wind mainspring by a given angular increment (degrees)
  function applyCrownWind(deltaDeg) {
    if (deltaDeg <= 0) return;
    state.windingAngleDeg += deltaDeg;
    state.windingVelocity = Math.min(1, state.windingVelocity + 0.45);
    // 180 deg crown turn adds ~4.2 hours of reserve (up to 72.0h cap)
    state.powerReserveHrs = Math.min(72.0, state.powerReserveHrs + deltaDeg * 0.0235);

    const toothStep = 360 / CALIBRE.ratchet.teeth;
    const clickIdx = Math.floor(state.windingAngleDeg / toothStep);
    if (clickIdx !== state.lastClickStepIndex) {
      state.lastClickStepIndex = clickIdx;
      audio.triggerWindingClick();
    }
  }

  // View Perspective Buttons
  ui.btnHero.addEventListener("click", () => applyViewMode("hero"));
  ui.btnMacro.addEventListener("click", () => applyViewMode("macro"));
  ui.btnCad.addEventListener("click", () => applyViewMode("alt_mode"));

  // Time Scale Buttons
  for (const btn of [ui.btnSlow, ui.btnReal, ui.btnFast]) {
    btn.addEventListener("click", () => {
      state.timeScale = Number(btn.dataset.scale) || 1;
      state.paused = false;
      syncUiState();
    });
  }

  // Pause & Single-Beat Step (+0.125s = 1 Swiss Lever Escapement Beat)
  ui.btnPause.addEventListener("click", () => {
    state.paused = !state.paused;
    syncUiState();
  });

  ui.btnStep.addEventListener("click", () => {
    state.paused = true;
    state.simSeconds += 1 / CALIBRE.ratios.beatRateHz; // Exact 1/8s beat step
    if (state.powerReserveHrs > 0) {
      state.powerReserveHrs = Math.max(0, state.powerReserveHrs - 1 / (8 * 3600));
    }
    const kin = evaluateEscapementKinematics(state.simSeconds, state.amplitudeFactor);
    audio.triggerBeat(kin.isTick, state.amplitudeFactor);
    state.lastBeatIndex = kin.beatIndex;
    syncUiState();
  });

  // Torque Flow Overlay Toggle
  ui.btnTorque.addEventListener("click", () => {
    state.torqueOverlay = !state.torqueOverlay;
    syncUiState();
  });

  // 8 Hz Mechanical Audio Toggle (strictly user-gesture initiated, zero autoplay warnings)
  ui.btnAudio.addEventListener("click", async () => {
    await audio.toggle();
    syncUiState();
  });

  // Manual Z-Layer Explode Slider
  ui.sliderExplode.addEventListener("input", () => {
    const val = Number(ui.sliderExplode.value) / 100;
    state.targetExplode = val;
    if (val > 0.05 && state.mode !== "alt_mode") {
      state.mode = "alt_mode";
      state.targetMacro = 0;
    } else if (val <= 0.02 && state.mode === "alt_mode") {
      state.mode = "hero";
    }
    startCameraTransition(state.mode, { snap: true });
    state.explodeProgress = val;
    syncUiState();
  });

  // Hold-to-Wind Button Interaction
  const startHoldWind = (ev) => {
    ev.preventDefault();
    state.isHoldingWind = true;
    applyCrownWind(14);
    syncUiState();
  };
  const stopHoldWind = () => {
    if (!state.isHoldingWind) return;
    state.isHoldingWind = false;
    syncUiState();
  };
  ui.btnWind.addEventListener("pointerdown", startHoldWind);
  window.addEventListener("pointerup", stopHoldWind);
  window.addEventListener("pointercancel", stopHoldWind);
  ui.btnWind.addEventListener("click", () => applyCrownWind(22));

  // Direct Tactile Drag on the 3 o'clock Fluted Watch Crown inside the SVG
  let crownDragging = false;
  let lastCrownY = 0;
  const crownNode = renderer.nodes.crownGroup;
  if (crownNode) {
    crownNode.addEventListener("pointerdown", (ev) => {
      ev.preventDefault();
      crownDragging = true;
      lastCrownY = ev.clientY;
      crownNode.setPointerCapture?.(ev.pointerId);
    });
    crownNode.addEventListener("pointermove", (ev) => {
      if (!crownDragging) return;
      const dy = lastCrownY - ev.clientY;
      lastCrownY = ev.clientY;
      if (Math.abs(dy) > 0.2) {
        applyCrownWind(Math.abs(dy) * 2.4);
      }
    });
    const endCrownDrag = () => {
      crownDragging = false;
    };
    crownNode.addEventListener("pointerup", endCrownDrag);
    crownNode.addEventListener("pointercancel", endCrownDrag);
  }

  // Expose SPEC_CONTRACT.md Deterministic QA Action Harness
  window.__BENCH_ACTIONS__ = {
    setView: (viewName) => {
      return applyViewMode(viewName, { snap: false });
    },
    triggerAction: (actionName) => {
      const act = String(actionName || "demo").toLowerCase().trim();
      if (act === "demo" || act === "action_state") {
        // Wall-clock smooth crown winding (56h -> 71.8h in 520ms) + 6-layer isometric CAD & Torque Flow!
        state.demoWindStartMs = performance.now();
        state.demoWindDurationMs = 520;
        state.demoWindStartPr = Math.min(58.0, state.powerReserveHrs);
        state.powerReserveHrs = state.demoWindStartPr;
        state.torqueOverlay = true;
        applyViewMode("alt_mode", { snap: false });
        return `demo: wound mainspring (${state.demoWindStartPr.toFixed(1)}h -> 71.8h) & activated 6-layer isometric CAD + torque flow`;
      }
      if (act === "wind") {
        state.demoWindStartMs = performance.now();
        state.demoWindDurationMs = 520;
        state.demoWindStartPr = state.powerReserveHrs;
        return `wind: winding mainspring (${state.powerReserveHrs.toFixed(1)}h -> 72.0h)`;
      }
      if (act === "torque") {
        state.torqueOverlay = !state.torqueOverlay;
        syncUiState();
        return `torque: ${state.torqueOverlay}`;
      }
      if (act === "step") {
        state.simSeconds += 1 / CALIBRE.ratios.beatRateHz;
        return `step: beat advanced`;
      }
      if (act === "pause") {
        state.paused = !state.paused;
        syncUiState();
        return `paused: ${state.paused}`;
      }
      return `unknown action: ${act}`;
    },
  };

  syncUiState();

  // Main Locked-60-FPS Animation & Telemetry Loop
  let prevTime = performance.now();
  let lastHudDomUpdate = 0;

  function tick(nowMs) {
    const rawDt = Math.max(0.001, Math.min(0.05, (nowMs - prevTime) / 1000));
    prevTime = nowMs;

    // Smoothed live FPS
    const instFps = Math.min(240, 1 / rawDt);
    state.fpsSmoothed = state.fpsSmoothed * 0.9 + instFps * 0.1;

    // 1. Crown winding update (interactive hold OR wall-clock deterministic demo wind)
    if (state.demoWindDurationMs > 0) {
      const u = Math.min(1, (nowMs - state.demoWindStartMs) / state.demoWindDurationMs);
      const ease = 1 - Math.pow(1 - u, 3);
      const targetPr = 71.8;
      const nextPr = state.demoWindStartPr + (targetPr - state.demoWindStartPr) * ease;
      const deltaPr = Math.max(0, nextPr - state.powerReserveHrs);
      state.powerReserveHrs = nextPr;
      state.windingAngleDeg += deltaPr * 42 + rawDt * 240;
      state.windingVelocity = 0.9;
      if (u >= 1) {
        state.demoWindDurationMs = 0;
        syncUiState();
      }
    } else if (state.isHoldingWind) {
      applyCrownWind(rawDt * 380);
    } else {
      state.windingVelocity = Math.max(0, state.windingVelocity - rawDt * 4.5);
    }

    // 2. Balance wheel amplitude envelope coupled to mainspring torque reserve
    const targetAmp =
      state.powerReserveHrs <= 0.01
        ? 0.0
        : state.powerReserveHrs < 6.0
          ? 0.42 + (state.powerReserveHrs / 6.0) * 0.58
          : 1.0;
    state.amplitudeFactor += (targetAmp - state.amplitudeFactor) * Math.min(1, rawDt * 5.0);

    // 3. Advance chronometer mechanical clock
    if (!state.paused && state.powerReserveHrs > 0.001) {
      const simDt = rawDt * state.timeScale;
      state.simSeconds += simDt;
      // Realistic 72-hour reserve depletion (accelerated gently in 10x fast-forward so gauge visibly responds)
      const drainMultiplier = state.timeScale > 5 ? 18 : 1;
      state.powerReserveHrs = Math.max(0, state.powerReserveHrs - (simDt * drainMultiplier) / 3600);
    }

    // 4. Deterministic wall-clock cubic-out camera & CAD explode transition (always settles in 300ms!)
    const targetVbNow = getTargetViewBox(state.mode, stageCol.clientWidth || window.innerWidth);
    state.animToVb = targetVbNow;
    const tNorm =
      state.animDurationMs <= 0
        ? 1
        : Math.max(0, Math.min(1, (nowMs - state.animStartMs) / state.animDurationMs));
    const easeOut = 1 - Math.pow(1 - tNorm, 3);

    state.viewBox.x = state.animFromVb.x + (state.animToVb.x - state.animFromVb.x) * easeOut;
    state.viewBox.y = state.animFromVb.y + (state.animToVb.y - state.animFromVb.y) * easeOut;
    state.viewBox.w = state.animFromVb.w + (state.animToVb.w - state.animFromVb.w) * easeOut;
    state.viewBox.h = state.animFromVb.h + (state.animToVb.h - state.animFromVb.h) * easeOut;

    state.explodeProgress = state.animFromExplode + (state.targetExplode - state.animFromExplode) * easeOut;
    state.macroProgress = state.animFromMacro + (state.targetMacro - state.animFromMacro) * easeOut;

    // 5. Evaluate exact escapement & zero-slip gear train kinematics
    const kinematics = evaluateEscapementKinematics(state.simSeconds, state.amplitudeFactor);

    // Trigger 8 Hz Swiss lever mechanical tick-tock audio on each beat crossing
    if (kinematics.beatIndex !== state.lastBeatIndex && !state.paused && state.powerReserveHrs > 0.01) {
      state.lastBeatIndex = kinematics.beatIndex;
      audio.triggerBeat(kinematics.isTick, state.amplitudeFactor);
    }

    // 6. Render Procedural SVG Movement + Dual-Layer Canvas Hybrid Optics
    renderer.update(state, kinematics);
    optics.render(state, kinematics, nowMs / 1000);

    // 7. Update live telemetry DOM & SPEC_CONTRACT window.__BENCH_META__ (~12 Hz DOM cadence)
    const cageDeg = (((kinematics.tourbillonAngleRad * RAD) % 360) + 360) % 360;
    const effectiveVph = state.paused || state.powerReserveHrs <= 0.01 ? 0 : Math.round(28800 * state.timeScale);
    const effectiveBeatHz = state.paused || state.powerReserveHrs <= 0.01 ? 0 : Number((8.0 * state.timeScale).toFixed(1));
    const ampDeg = Math.round(295 * state.amplitudeFactor);

    window.__BENCH_META__.fps = Number(state.fpsSmoothed.toFixed(1));
    window.__BENCH_META__.telemetry = {
      vph: effectiveVph,
      beatRateHz: effectiveBeatHz,
      powerReserveHrs: Number(state.powerReserveHrs.toFixed(2)),
      tourbillonDeg: Number(cageDeg.toFixed(1)),
      mode: state.mode,
    };

    if (nowMs - lastHudDomUpdate > 75 || state.frameCount < 2) {
      lastHudDomUpdate = nowMs;
      ui.telVph.innerHTML = `${effectiveVph.toLocaleString("en-US")}<span class="unit">vph</span>`;
      ui.telPower.innerHTML = `${state.powerReserveHrs.toFixed(1)}<span class="unit">/ 72h</span>`;
      ui.telCage.innerHTML = `${cageDeg.toFixed(1).padStart(5, "0")}<span class="unit">°</span>`;
      ui.telAmp.innerHTML = `${ampDeg}<span class="unit">° · ${(effectiveBeatHz / 2).toFixed(1)} Hz</span>`;
      ui.metaFps.textContent = `${Math.round(state.fpsSmoothed)} FPS`;
      ui.railPowerText.textContent = `${state.powerReserveHrs.toFixed(1)} h`;
      ui.railReserveFill.style.width = `${((state.powerReserveHrs / 72) * 100).toFixed(1)}%`;
      ui.railReserveFill.classList.toggle("low", state.powerReserveHrs < 12);
    }

    // Flip ready=true strictly AFTER first complete SVG + Canvas rendered frame
    state.frameCount++;
    if (!state.readyFired && state.frameCount >= 2) {
      state.readyFired = true;
      window.__BENCH_META__.bootMs = Number((performance.now() - BOOT_T0).toFixed(1));
      window.__BENCH_META__.ready = true;
    }

    requestAnimationFrame(tick);
  }

  requestAnimationFrame(tick);
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init);
} else {
  init();
}
