/**
 * AeroFan X-900 — Studio Viewport Orchestrator, Telemetry HUD & Gate 5.5 Harness
 * Model: gemini-4-carbon (high) | Paradigm: One-Shot Master Spec
 */

import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { BraytonEngine } from './brayton-thermo.js';
import { createTurbofanCAD } from './turbofan-cad.js';
import { TurbineAudioEngine } from './turbine-audio.js';

// ============================================================================
// 1. INITIALIZE MANDATORY BENCHMARK HARNESS CONTRACT
// ============================================================================
const bootStartMs = performance.now();

window.__BENCH_META__ = {
  id: 'track-3-turbofan-cad',
  title: 'AeroFan X-900 — Cutaway Turbofan CAD',
  domain: 'Aerospace Engineering & CAD',
  model: 'gemini-4-carbon',
  effort: 'high',
  technique: 'One-Shot Master Spec',
  ready: false,
  bootMs: 0,
  shaderPrewarmMs: 0,
  drawCalls: 0,
  triangles: 0,
  fps: 60,
  telemetry: {}
};

// ============================================================================
// 2. WEBGL2 RENDERER, STUDIO LIGHTING & SCENE SETUP
// ============================================================================
const canvas = document.getElementById('webgl-canvas');
const renderer = new THREE.WebGLRenderer({
  canvas,
  antialias: true,
  alpha: true,
  powerPreference: 'high-performance'
});
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.08;

const scene = new THREE.Scene();

// Procedural studio IBL environment via RoomEnvironment (zero external HDR assets!)
const pmremGenerator = new THREE.PMREMGenerator(renderer);
const roomEnv = new RoomEnvironment();
const envTarget = pmremGenerator.fromScene(roomEnv, 0.04);
scene.environment = envTarget.texture;
scene.environmentIntensity = 0.82;
roomEnv.dispose();
pmremGenerator.dispose();

// Precision 3-point aerospace CAD studio lighting
const hemiLight = new THREE.HemisphereLight(0xdbe8f8, 0x1c2430, 0.65);
scene.add(hemiLight);

const keyLight = new THREE.DirectionalLight(0xf6f9ff, 2.25);
keyLight.position.set(-4.5, 6.5, 6.2);
scene.add(keyLight);

const rimLight = new THREE.DirectionalLight(0x8ec0ff, 1.35);
rimLight.position.set(5.2, 3.8, -5.5);
scene.add(rimLight);

const cutawayFill = new THREE.DirectionalLight(0xffdfbf, 0.95);
cutawayFill.position.set(-0.8, 1.6, 5.8);
scene.add(cutawayFill);

// Camera & OrbitControls
const camera = new THREE.PerspectiveCamera(38, window.innerWidth / window.innerHeight, 0.1, 80);
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.075;
controls.minDistance = 1.15;
controls.maxDistance = 22.0;
controls.maxPolarAngle = Math.PI * 0.82;

// ============================================================================
// 3. INSTANTIATE BRAYTON SOLVER, TURBOFAN 3D CAD & WEB AUDIO SYNTH
// ============================================================================
const brayton = new BraytonEngine();
const cad = createTurbofanCAD();
scene.add(cad.root);

const audio = new TurbineAudioEngine();

const uiState = {
  view: 'hero',
  timeScale: 1.0,
  showStreamlines: true,
  hudCollapsed: false
};

// Camera presets (base poses framed for 16:10 desktop; automatically distance-scaled on narrow aspect!)
const VIEW_PRESETS = {
  hero: {
    pos: new THREE.Vector3(-3.75, 1.78, 5.45),
    target: new THREE.Vector3(0.05, -0.05, 0.0)
  },
  macro: {
    pos: new THREE.Vector3(0.14, 0.78, 2.08),
    target: new THREE.Vector3(0.66, 0.14, 0.02)
  },
  alt_mode: {
    pos: new THREE.Vector3(-1.55, 2.38, 10.15),
    target: new THREE.Vector3(-0.15, 0.02, 0.0)
  },
  demo: {
    pos: new THREE.Vector3(-2.65, 2.22, 8.95),
    target: new THREE.Vector3(-0.10, 0.00, 0.0)
  }
};

// ============================================================================
// 4. RESPONSIVE OPTICAL FRAMING (ZERO CLIPPING & ZERO DOCK OCCLUSION AT 700x900)
// ============================================================================
const viewportWindowEl = document.getElementById('viewport-window');

function applyViewportOpticalOffset() {
  const fullW = window.innerWidth;
  const fullH = window.innerHeight;
  camera.aspect = fullW / Math.max(1, fullH);

  if (viewportWindowEl && !uiState.hudCollapsed) {
    const rect = viewportWindowEl.getBoundingClientRect();
    if (rect.width > 120 && rect.height > 120) {
      // Shift optical center of projection to the exact center of the unobstructed viewport cell!
      const clearCenterX = rect.left + rect.width * 0.5;
      const clearCenterY = rect.top + rect.height * 0.5;
      const shiftX = fullW * 0.5 - clearCenterX;
      const shiftY = fullH * 0.5 - clearCenterY;
      camera.setViewOffset(fullW, fullH, shiftX, shiftY, fullW, fullH);
      camera.updateProjectionMatrix();
      return;
    }
  }
  camera.clearViewOffset();
  camera.updateProjectionMatrix();
}

function computeAspectDistanceScale() {
  if (viewportWindowEl && !uiState.hudCollapsed) {
    const rect = viewportWindowEl.getBoundingClientRect();
    const effAspect = rect.width / Math.max(1, rect.height);
    const narrowBoost = window.innerWidth <= 1060 ? 1.24 : 1.0;
    return Math.max(1.0, Math.min(2.25, (1.45 / Math.max(0.55, effAspect)) * narrowBoost));
  }
  const aspect = window.innerWidth / Math.max(1, window.innerHeight);
  return Math.max(1.0, Math.min(2.25, 1.45 / Math.max(0.55, aspect)));
}

function jumpCameraToPreset(presetKey) {
  const preset = VIEW_PRESETS[presetKey] || VIEW_PRESETS.hero;
  const distScale = presetKey === 'macro'
    ? Math.max(1.0, computeAspectDistanceScale() * 0.85)
    : computeAspectDistanceScale();

  const offset = preset.pos.clone().sub(preset.target).multiplyScalar(distScale);
  camera.position.copy(preset.target).add(offset);
  controls.target.copy(preset.target);
  applyViewportOpticalOffset();
  controls.update();
}

// ============================================================================
// 5. DOM REFERENCES & STUDIO HUD BINDINGS
// ============================================================================
const dom = {
  shell: document.getElementById('cad-shell'),
  calloutLayer: document.getElementById('callout-layer'),
  regimeBadge: document.getElementById('regime-badge'),
  valThrust: document.getElementById('val-thrust'),
  valEpr: document.getElementById('val-epr'),
  valN1: document.getElementById('val-n1'),
  valN1Rpm: document.getElementById('val-n1-rpm'),
  barN1: document.getElementById('bar-n1'),
  valN2: document.getElementById('val-n2'),
  valN2Rpm: document.getElementById('val-n2-rpm'),
  barN2: document.getElementById('bar-n2'),
  valBpr: document.getElementById('val-bpr'),
  valOpr: document.getElementById('val-opr'),
  valTsfc: document.getElementById('val-tsfc'),
  valFuel: document.getElementById('val-fuel'),
  stnBody: document.getElementById('station-tbody'),
  sparkPath: document.getElementById('spark-line-path'),
  sparkArea: document.getElementById('spark-area-path'),
  sparkPeak: document.getElementById('spark-peak-label'),

  sliderThrottle: document.getElementById('slider-throttle'),
  lblThrottle: document.getElementById('lbl-throttle'),
  sliderAlt: document.getElementById('slider-alt'),
  lblAlt: document.getElementById('lbl-alt'),
  sliderMach: document.getElementById('slider-mach'),
  lblMach: document.getElementById('lbl-mach'),
  sliderExplode: document.getElementById('slider-explode'),
  lblExplode: document.getElementById('lbl-explode'),

  btnStreamlines: document.getElementById('btn-streamlines'),
  btnAudio: document.getElementById('btn-audio'),
  btnDemo: document.getElementById('btn-demo'),
  btnHudToggle: document.getElementById('btn-hud-toggle'),

  statFps: document.getElementById('stat-fps'),
  statCalls: document.getElementById('stat-calls'),
  statTris: document.getElementById('stat-tris'),
  statMode: document.getElementById('stat-mode')
};

// Create 8 reusable 2D exploded-stage callout DOM nodes
const calloutDefs = cad.getAssemblyCallouts();
const calloutEls = calloutDefs.map((c) => {
  const el = document.createElement('div');
  el.className = 'cad-callout';
  el.textContent = c.label;
  el.style.opacity = '0';
  dom.calloutLayer.appendChild(el);
  return el;
});

function syncControlInputsFromEngine() {
  dom.sliderThrottle.value = String(Math.round(brayton.targetThrottle));
  dom.lblThrottle.textContent = `${brayton.targetThrottle.toFixed(0)}%`;

  dom.sliderAlt.value = String(Math.round(brayton.altitudeFt));
  dom.lblAlt.textContent = `${Math.round(brayton.altitudeFt).toLocaleString('en-US')} ft`;

  dom.sliderMach.value = brayton.mach.toFixed(2);
  dom.lblMach.textContent = `M ${brayton.mach.toFixed(2)}`;

  dom.sliderExplode.value = String(Math.round(brayton.explode * 100));
  dom.lblExplode.textContent = `${Math.round(brayton.explode * 100)}%`;

  // Highlight active throttle preset button
  document.querySelectorAll('[data-throttle-preset]').forEach((btn) => {
    const p = Number(btn.getAttribute('data-throttle-preset'));
    btn.classList.toggle('active', Math.abs(brayton.targetThrottle - p) <= 1.5);
  });

  // Highlight active render mode pill
  const activeMode = cad.getRenderMode();
  document.querySelectorAll('[data-render-mode]').forEach((btn) => {
    btn.classList.toggle('active', btn.getAttribute('data-render-mode') === activeMode);
  });

  // Highlight active camera view pill
  document.querySelectorAll('[data-view-preset]').forEach((btn) => {
    btn.classList.toggle('active', btn.getAttribute('data-view-preset') === uiState.view);
  });

  dom.statMode.textContent = activeMode.toUpperCase();
}

function updateTelemetryDOM(state) {
  dom.regimeBadge.textContent = state.regime;
  dom.regimeBadge.classList.toggle('toga', state.throttlePct >= 94.0);

  dom.valThrust.innerHTML = `${state.netThrustKN.toFixed(1)}<span class="kpi-unit">kN</span>`;
  dom.valEpr.textContent = `EPR ${state.epr.toFixed(2)} · ${state.coreChoked ? 'CHOKED' : 'SUBSONIC'}`;

  dom.valN1.innerHTML = `${state.n1Pct.toFixed(1)}<span class="kpi-unit">%</span>`;
  dom.valN1Rpm.textContent = `${Math.round(state.n1Rpm).toLocaleString('en-US')} RPM (LP)`;
  dom.barN1.style.width = `${Math.min(100, state.n1Pct)}%`;

  dom.valN2.innerHTML = `${state.n2Pct.toFixed(1)}<span class="kpi-unit">%</span>`;
  dom.valN2Rpm.textContent = `${Math.round(state.n2Rpm).toLocaleString('en-US')} RPM (HP)`;
  dom.barN2.style.width = `${Math.min(100, state.n2Pct)}%`;

  dom.valBpr.innerHTML = `${state.bpr.toFixed(2)}<span class="kpi-unit">:1</span>`;
  dom.valOpr.textContent = `OPR ${state.opr.toFixed(1)}:1`;

  dom.valTsfc.innerHTML = `${state.tsfc.toFixed(2)}<span class="kpi-unit">g/kN·s</span>`;
  dom.valFuel.textContent = `Fuel ${state.fuelFlowKgS.toFixed(2)} kg/s`;

  const { s0, s2, s3, s4, s5 } = state.stations;
  const rows = [
    { stn: 'T0/P0', desc: 'Freestream', T: s0.T, P: s0.P, hot: false },
    { stn: 'T2/P2', desc: 'LPC Delivery', T: s2.T, P: s2.P, hot: false },
    { stn: 'T3/P3', desc: 'HPC Exit', T: s3.T, P: s3.P, hot: false },
    { stn: 'T4 TIT', desc: 'Combustor', T: s4.T, P: s4.P, hot: true },
    { stn: 'T5 EGT', desc: 'LPT Exit', T: s5.T, P: s5.P, hot: true }
  ];

  dom.stnBody.innerHTML = rows
    .map((r) => {
      const tempC = r.T - 273.15;
      return `<tr class="${r.hot ? 'hot-row' : ''}">
        <td class="stn-code">${r.stn}</td>
        <td>${r.desc}</td>
        <td class="num">${r.T.toFixed(0)} K <span style="color:#7d8fa3">(${tempC >= 0 ? '+' : ''}${tempC.toFixed(0)}°)</span></td>
        <td class="num">${r.P.toFixed(1)}</td>
      </tr>`;
    })
    .join('');

  // Update SVG Brayton Station Temperature Curve (width 220 x height 42)
  const temps = [s0.T, s2.T, s3.T, s4.T, s5.T];
  const xs = [8, 58, 110, 162, 212];
  const pts = temps.map((tK, idx) => {
    const norm = Math.max(0.0, Math.min(1.0, (tK - 200.0) / 1750.0));
    const y = 38.0 - norm * 32.0;
    return `${xs[idx]},${y.toFixed(1)}`;
  });
  const dLine = `M ${pts.join(' L ')}`;
  dom.sparkPath.setAttribute('d', dLine);
  dom.sparkArea.setAttribute('d', `${dLine} L 212,41 L 8,41 Z`);
  dom.sparkPeak.textContent = `TIT ${s4.T.toFixed(0)} K / EGT ${s5.T.toFixed(0)} K`;
}

const _projVec = new THREE.Vector3();

function updateExplodedCallouts() {
  const show = brayton.explode >= 0.18 && !uiState.hudCollapsed;
  if (!show) {
    for (const el of calloutEls) el.style.opacity = '0';
    return;
  }

  const clearRect = viewportWindowEl.getBoundingClientRect();
  const liveCallouts = cad.getAssemblyCallouts();
  let prevX = -999;

  for (let i = 0; i < liveCallouts.length; i++) {
    const el = calloutEls[i];
    // Alternate odd/even vertical leader height so adjacent callouts never collide!
    const yWorldLift = i % 2 === 0 ? 0.18 : 0.52;
    _projVec.copy(liveCallouts[i].worldPos);
    _projVec.y += yWorldLift;
    _projVec.project(camera);

    const sx = (_projVec.x * 0.5 + 0.5) * window.innerWidth;
    const sy = (-_projVec.y * 0.5 + 0.5) * window.innerHeight;

    const insideClear =
      _projVec.z < 1.0 &&
      sx > clearRect.left + 58 &&
      sx < clearRect.right - 58 &&
      sy > clearRect.top + 24 &&
      sy < clearRect.bottom - 18 &&
      Math.abs(sx - prevX) > 44;

    if (insideClear) {
      el.style.left = `${sx.toFixed(1)}px`;
      el.style.top = `${sy.toFixed(1)}px`;
      el.style.opacity = '1';
      prevX = sx;
    } else {
      el.style.opacity = '0';
    }
  }
}

// ============================================================================
// 6. INTERACTIVE UI EVENT LISTENERS
// ============================================================================
document.querySelectorAll('[data-view-preset]').forEach((btn) => {
  btn.addEventListener('click', () => {
    const v = btn.getAttribute('data-view-preset');
    window.__BENCH_ACTIONS__.setView(v);
  });
});

document.querySelectorAll('[data-render-mode]').forEach((btn) => {
  btn.addEventListener('click', () => {
    const m = btn.getAttribute('data-render-mode');
    cad.setRenderMode(m);
    syncControlInputsFromEngine();
  });
});

document.querySelectorAll('[data-throttle-preset]').forEach((btn) => {
  btn.addEventListener('click', () => {
    const val = Number(btn.getAttribute('data-throttle-preset'));
    brayton.setControls({ throttle: val }, false);
    syncControlInputsFromEngine();
  });
});

dom.sliderThrottle.addEventListener('input', (e) => {
  brayton.setControls({ throttle: Number(e.target.value) }, false);
  syncControlInputsFromEngine();
});

dom.sliderAlt.addEventListener('input', (e) => {
  brayton.setControls({ altitudeFt: Number(e.target.value) }, false);
  syncControlInputsFromEngine();
});

dom.sliderMach.addEventListener('input', (e) => {
  brayton.setControls({ mach: Number(e.target.value) }, false);
  syncControlInputsFromEngine();
});

dom.sliderExplode.addEventListener('input', (e) => {
  brayton.setControls({ explode: Number(e.target.value) / 100.0 }, true);
  syncControlInputsFromEngine();
});

dom.btnStreamlines.addEventListener('click', () => {
  uiState.showStreamlines = !uiState.showStreamlines;
  dom.btnStreamlines.textContent = uiState.showStreamlines ? 'FLOW: ON' : 'FLOW: OFF';
  dom.btnStreamlines.classList.toggle('active', uiState.showStreamlines);
});

document.querySelectorAll('[data-timescale]').forEach((btn) => {
  btn.addEventListener('click', () => {
    uiState.timeScale = Number(btn.getAttribute('data-timescale'));
    document.querySelectorAll('[data-timescale]').forEach((b) => {
      b.classList.toggle('active', b === btn);
    });
  });
});

dom.btnAudio.addEventListener('click', async () => {
  const live = await audio.toggle();
  dom.btnAudio.textContent = live ? 'AUDIO: LIVE' : 'AUDIO: MUTED';
  dom.btnAudio.classList.toggle('audio-live', live);
});

dom.btnDemo.addEventListener('click', () => {
  window.__BENCH_ACTIONS__.triggerAction('demo');
});

dom.btnHudToggle.addEventListener('click', () => {
  uiState.hudCollapsed = !uiState.hudCollapsed;
  dom.shell.classList.toggle('hud-collapsed', uiState.hudCollapsed);
  dom.btnHudToggle.textContent = uiState.hudCollapsed ? 'HUD: HIDDEN' : 'HUD: DOCKED';
  applyViewportOpticalOffset();
});

window.addEventListener('resize', () => {
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setSize(window.innerWidth, window.innerHeight);
  applyViewportOpticalOffset();
});

// ============================================================================
// 7. DETERMINISTIC GATE 5.5 BENCHMARK ACTIONS (`hero`, `macro`, `alt_mode`, `demo`)
// ============================================================================
let simElapsedSec = 0.0;

function renderImmediateSyncFrame() {
  const st = brayton.state;
  cad.update(1 / 60, simElapsedSec, st, brayton.explode, uiState.timeScale, uiState.showStreamlines);
  controls.update();
  renderer.render(scene, camera);
  updateTelemetryDOM(st);
  updateExplodedCallouts();
  syncBenchMetaTelemetry(st);
}

window.__BENCH_ACTIONS__ = {
  setView: (viewName) => {
    const name = String(viewName || '').toLowerCase();
    if (name === 'hero') {
      uiState.view = 'hero';
      cad.setMacroFocus(false);
      cad.setRenderMode('solid');
      brayton.setControls({ throttle: 78.0, altitudeFt: 12000.0, mach: 0.48, explode: 0.0 }, true);
      jumpCameraToPreset('hero');
      syncControlInputsFromEngine();
      renderImmediateSyncFrame();
      return true;
    }
    if (name === 'macro') {
      uiState.view = 'macro';
      cad.setMacroFocus(true);
      cad.setRenderMode('solid');
      brayton.setControls({ throttle: 92.0, explode: 0.0 }, true);
      jumpCameraToPreset('macro');
      syncControlInputsFromEngine();
      renderImmediateSyncFrame();
      return true;
    }
    if (name === 'alt_mode') {
      uiState.view = 'alt_mode';
      cad.setMacroFocus(false);
      // Toggle between X-Ray and Thermal if clicked repeatedly in UI, defaulting deterministically to X-Ray Exploded CAD!
      const nextMode = cad.getRenderMode() === 'xray' ? 'thermal' : 'xray';
      cad.setRenderMode(nextMode);
      brayton.setControls({ explode: 0.72 }, true);
      jumpCameraToPreset('alt_mode');
      syncControlInputsFromEngine();
      renderImmediateSyncFrame();
      return true;
    }
    if (name === 'action_state' || name === 'demo') {
      window.__BENCH_ACTIONS__.triggerAction('demo');
      return true;
    }
    return false;
  },

  triggerAction: (actionName) => {
    const act = String(actionName || 'demo').toLowerCase();
    if (act === 'demo' || act === 'action_state' || act === 'toga') {
      uiState.view = 'alt_mode';
      cad.setMacroFocus(false);
      uiState.showStreamlines = true;
      dom.btnStreamlines.textContent = 'FLOW: ON';
      dom.btnStreamlines.classList.add('active');

      // TOGA 100% throttle + 55% axial explode + live Thermal cutaway highlight!
      brayton.setControls({ throttle: 100.0, altitudeFt: 0.0, mach: 0.25, explode: 0.55 }, true);
      cad.setRenderMode('thermal');
      jumpCameraToPreset('demo');
      syncControlInputsFromEngine();
      renderImmediateSyncFrame();

      const s = brayton.state;
      return `TOGA 100% engaged: Thrust=${s.netThrustKN.toFixed(1)} kN, TIT=${s.stations.s4.T.toFixed(0)} K, Explode=55%, Mode=THERMAL`;
    }
    return `Unknown action: ${actionName}`;
  }
};

// ============================================================================
// 8. SHADER PRE-WARM (`renderer.compile` + 2 WARM-UP FRAMES) & MAIN LOOP
// ============================================================================
let smoothedFps = 60.0;
let lastFrameMs = performance.now();
let hudRefreshAccum = 0.0;

function syncBenchMetaTelemetry(st) {
  const info = renderer.info.render;
  window.__BENCH_META__.drawCalls = info.calls;
  window.__BENCH_META__.triangles = info.triangles;
  window.__BENCH_META__.fps = Math.round(smoothedFps * 10) / 10;
  window.__BENCH_META__.telemetry = {
    view: uiState.view,
    renderMode: cad.getRenderMode(),
    regime: st.regime,
    throttlePct: Number(st.throttlePct.toFixed(1)),
    altitudeFt: Math.round(st.altitudeFt),
    mach: Number(st.mach.toFixed(2)),
    explodePct: Math.round(brayton.explode * 100),
    n1Pct: Number(st.n1Pct.toFixed(1)),
    n2Pct: Number(st.n2Pct.toFixed(1)),
    n1Rpm: Math.round(st.n1Rpm),
    n2Rpm: Math.round(st.n2Rpm),
    thrustKN: Number(st.netThrustKN.toFixed(1)),
    bpr: Number(st.bpr.toFixed(2)),
    epr: Number(st.epr.toFixed(2)),
    tsfc: Number(st.tsfc.toFixed(2)),
    T0_K: Number(st.stations.s0.T.toFixed(1)),
    P0_kPa: Number(st.stations.s0.P.toFixed(1)),
    T2_K: Number(st.stations.s2.T.toFixed(1)),
    T3_K: Number(st.stations.s3.T.toFixed(1)),
    T4_TIT_K: Number(st.stations.s4.T.toFixed(1)),
    T5_EGT_K: Number(st.stations.s5.T.toFixed(1))
  };
}

function bootAndPrewarm() {
  jumpCameraToPreset('hero');
  syncControlInputsFromEngine();

  const prewarmT0 = performance.now();
  // Compile all 4 shader/material modes + render 2 warm-up frames before setting ready = true!
  cad.prewarmAllModes(renderer, scene, camera);
  for (let w = 0; w < 2; w++) {
    simElapsedSec += 1 / 60;
    const st = brayton.step(1 / 60);
    cad.update(1 / 60, simElapsedSec, st, brayton.explode, uiState.timeScale, uiState.showStreamlines);
    renderer.render(scene, camera);
  }
  const prewarmEnd = performance.now();

  updateTelemetryDOM(brayton.state);
  syncBenchMetaTelemetry(brayton.state);

  dom.statFps.textContent = '60 FPS';
  dom.statCalls.textContent = `${window.__BENCH_META__.drawCalls} calls`;
  dom.statTris.textContent = `${window.__BENCH_META__.triangles.toLocaleString('en-US')} tris`;

  window.__BENCH_META__.shaderPrewarmMs = Math.round((prewarmEnd - prewarmT0) * 100) / 100;
  window.__BENCH_META__.bootMs = Math.round((prewarmEnd - bootStartMs) * 100) / 100;
  window.__BENCH_META__.ready = true;

  lastFrameMs = performance.now();
  requestAnimationFrame(animate);
}

function animate(nowMs) {
  requestAnimationFrame(animate);

  const rawDt = Math.max(0.001, (nowMs - lastFrameMs) / 1000.0);
  lastFrameMs = nowMs;
  const dt = Math.min(rawDt, 0.05);

  const instFps = 1.0 / rawDt;
  smoothedFps = smoothedFps * 0.92 + Math.min(144, instFps) * 0.08;

  simElapsedSec += dt * uiState.timeScale;
  const st = brayton.step(dt);

  cad.update(dt, simElapsedSec, st, brayton.explode, uiState.timeScale, uiState.showStreamlines);
  audio.update(st, uiState.timeScale);

  controls.update();
  renderer.render(scene, camera);

  syncBenchMetaTelemetry(st);
  updateExplodedCallouts();

  hudRefreshAccum += dt;
  if (hudRefreshAccum >= 0.08) {
    hudRefreshAccum = 0.0;
    updateTelemetryDOM(st);
    dom.statFps.textContent = `${Math.round(smoothedFps)} FPS`;
    dom.statCalls.textContent = `${window.__BENCH_META__.drawCalls} calls`;
    dom.statTris.textContent = `${window.__BENCH_META__.triangles.toLocaleString('en-US')} tris`;
  }
}

bootAndPrewarm();
