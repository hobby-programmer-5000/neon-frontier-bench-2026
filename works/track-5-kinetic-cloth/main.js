import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { KineticAudio } from './audio.js';
import { KineticSimulation, FIXED_DT, STAGE_NAMES } from './physics.js';
import { buildKineticScene } from './scene-builder.js';

const bootStart = performance.now();

const canvas = document.getElementById('viewport');
const sparkCanvas = document.getElementById('energy-sparkline');
const sparkCtx = sparkCanvas.getContext('2d');

const stagePillEl = document.getElementById('stage-pill');
const energyReadoutEl = document.getElementById('energy-readout');
const drawerEl = document.getElementById('control-drawer');
const drawerToggleBtn = document.getElementById('drawer-toggle');
const btnPlay = document.getElementById('btn-play');
const btnReset = document.getElementById('btn-reset');
const btnLaunch = document.getElementById('btn-launch');
const btnLeverA = document.getElementById('btn-lever-a');
const btnLeverB = document.getElementById('btn-lever-b');
const chkAutoLevers = document.getElementById('chk-auto-levers');
const sliderBreeze = document.getElementById('slider-breeze');
const breezeValEl = document.getElementById('breeze-val');
const btnWindBurst = document.getElementById('btn-wind-burst');
const btnAudio = document.getElementById('btn-audio');
const viewButtons = Array.from(document.querySelectorAll('[data-view]'));

// WebGL2 Renderer Setup (Three.js r187 safe)
const renderer = new THREE.WebGLRenderer({
  canvas,
  antialias: true,
  powerPreference: 'high-performance',
});
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.15;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFShadowMap;

const camera = new THREE.PerspectiveCamera(42, window.innerWidth / window.innerHeight, 0.1, 60);
camera.position.set(-0.1, 3.55, 9.45);

const controls = new OrbitControls(camera, canvas);
controls.enableDamping = true;
controls.dampingFactor = 0.07;
controls.target.set(0.20, 0.82, 0.0);
controls.maxPolarAngle = Math.PI * 0.48;
controls.minDistance = 1.1;
controls.maxDistance = 16.0;
controls.update();

const audio = new KineticAudio();
const sim = new KineticSimulation(audio);
const sceneHandle = buildKineticScene(renderer, sim);
const { scene } = sceneHandle;

let viewMode = 'hero';
let clothWireframe = false;
let followCam = false;
let userOrbiting = false;
let drawerUserPinned = false;

controls.addEventListener('start', () => {
  userOrbiting = true;
});
controls.addEventListener('end', () => {
  userOrbiting = false;
});

function setView(name) {
  if (name === 'hero') {
    viewMode = 'hero';
    clothWireframe = false;
    followCam = false;
    camera.fov = 42;
    camera.updateProjectionMatrix();
    camera.position.set(-0.1, 3.55, 9.45);
    controls.target.set(0.20, 0.82, 0.0);
    controls.update();
  } else if (name === 'macro') {
    viewMode = 'macro';
    clothWireframe = false;
    followCam = false;
    camera.fov = 38;
    camera.updateProjectionMatrix();
    camera.position.set(3.35, 1.55, 2.55);
    controls.target.set(4.65, 1.05, 0.0);
    controls.update();
  } else if (name === 'alt_mode') {
    viewMode = 'alt_mode';
    clothWireframe = true;
    followCam = true;
    camera.fov = 40;
    camera.updateProjectionMatrix();
    camera.position.set(3.75, 1.72, 2.75);
    controls.target.set(4.72, 1.08, 0.0);
    controls.update();
  } else {
    return false;
  }

  for (const btn of viewButtons) {
    btn.classList.toggle('is-active', btn.dataset.view === viewMode);
  }
  window.__BENCH_META__.telemetry.viewMode = viewMode;
  return true;
}

function updateHudControls() {
  btnPlay.textContent = sim.paused ? 'Resume' : 'Pause';
  btnLeverA.textContent = `Lever A [1]: ${sim.leverAMode}`;
  btnLeverA.classList.toggle('is-hold', sim.leverAMode === 'HOLD');
  btnLeverB.textContent = `Lever B [2]: ${sim.leverBMode}`;
  btnLeverB.classList.toggle('is-hold', sim.leverBMode === 'HOLD');
  chkAutoLevers.checked = sim.autoLevers;
  btnAudio.textContent = audio.userUnlocked && !audio.muted ? 'Audio: On' : 'Audio: Off';
}

function triggerAction(name) {
  if (name === 'demo') {
    sim.paused = false;
    sim.triggerCatapultDemo(true);
    sceneHandle.syncFromSim(clothWireframe);
    updateHudControls();
    return 'demo: catapult launched through XPBD silk -> bell chime';
  }
  if (name === 'launch') {
    sim.paused = false;
    sim.triggerCatapultDemo(false);
    sceneHandle.syncFromSim(clothWireframe);
    updateHudControls();
    return 'launch: catapult firing';
  }
  if (name === 'reset') {
    sim.paused = false;
    sim.reset(true);
    sceneHandle.syncFromSim(clothWireframe);
    updateHudControls();
    return 'reset: stage 1 initialized';
  }
  if (name === 'leverA') {
    const mode = sim.toggleLeverA();
    if (mode === 'HOLD') sim.autoLevers = false;
    updateHudControls();
    return `leverA: ${mode}`;
  }
  if (name === 'leverB') {
    const mode = sim.toggleLeverB();
    if (mode === 'HOLD') sim.autoLevers = false;
    updateHudControls();
    return `leverB: ${mode}`;
  }
  if (name === 'windBurst') {
    sim.cloth.triggerWindBurst();
    return 'windBurst: emerald silk gust';
  }
  if (name === 'wireframe') {
    clothWireframe = !clothWireframe;
    return `wireframe: ${clothWireframe ? 'on' : 'off'}`;
  }
  return `unknown: ${name}`;
}

// Explicit WebGL2 Shader Pre-Warm before ready = true
{
  const prewarmT0 = performance.now();
  sceneHandle.clothWireMesh.visible = true;
  sceneHandle.sparkMesh.visible = true;
  sim._spawnSparks();
  sceneHandle.syncFromSim(true);

  renderer.compile(scene, camera);
  renderer.render(scene, camera);
  renderer.render(scene, camera);

  sim.reset(true);
  sceneHandle.clothWireMesh.visible = false;
  sceneHandle.syncFromSim(false);

  const shaderPrewarmMs = +(performance.now() - prewarmT0).toFixed(1);
  const bootMs = +(performance.now() - bootStart).toFixed(1);

  window.__BENCH_META__ = {
    id: 'track-5-kinetic-cloth',
    title: 'Kinetic Atelier — 3D Rube Goldberg + Live XPBD Cloth',
    domain: '120 Hz Rigid Mechanics & Real-Time XPBD Cloth',
    model: 'gemini-4-neon+hydrogen',
    effort: 'high->xhigh',
    technique: 'Orchestrator-to-Executor Pipeline',
    ready: true,
    bootMs,
    shaderPrewarmMs,
    drawCalls: renderer.info.render.calls,
    triangles: renderer.info.render.triangles,
    fps: 60,
    telemetry: {
      stage: sim.stage,
      stageName: STAGE_NAMES[sim.stage],
      simTimeSec: 0,
      fixedHz: 120,
      xpbdIterations: sim.cloth.iterations,
      clothNodes: sim.cloth.nodeCount,
      clothMaxBillowM: 0,
      totalEnergyJ: +sim.energy.E_tot.toFixed(3),
      leverAMode: sim.leverAMode,
      leverBMode: sim.leverBMode,
      viewMode,
    },
  };
}

window.__BENCH_ACTIONS__ = {
  setView,
  triggerAction,
};

// Responsive HUD drawer collapse at <= 920px
function applyResponsiveDrawer() {
  if (window.innerWidth <= 920) {
    drawerEl.classList.add('is-collapsed');
    drawerToggleBtn.setAttribute('aria-expanded', 'false');
  } else if (!drawerUserPinned) {
    drawerEl.classList.remove('is-collapsed');
    drawerToggleBtn.setAttribute('aria-expanded', 'true');
  }
}
applyResponsiveDrawer();

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
  applyResponsiveDrawer();
});

// UI Wiring (Audio unlocked ONLY on explicit button/canvas click)
drawerToggleBtn.addEventListener('click', () => {
  const collapsed = drawerEl.classList.toggle('is-collapsed');
  drawerUserPinned = collapsed;
  drawerToggleBtn.setAttribute('aria-expanded', String(!collapsed));
});

btnPlay.addEventListener('click', () => {
  audio.unlock();
  sim.paused = !sim.paused;
  updateHudControls();
});

btnReset.addEventListener('click', () => {
  audio.unlock();
  triggerAction('reset');
});

btnLaunch.addEventListener('click', () => {
  audio.unlock();
  triggerAction('launch');
});

btnLeverA.addEventListener('click', () => {
  audio.unlock();
  triggerAction('leverA');
});

btnLeverB.addEventListener('click', () => {
  audio.unlock();
  triggerAction('leverB');
});

chkAutoLevers.addEventListener('change', () => {
  audio.unlock();
  sim.setAutoLevers(chkAutoLevers.checked);
  updateHudControls();
});

for (const btn of viewButtons) {
  btn.addEventListener('click', () => {
    audio.unlock();
    setView(btn.dataset.view);
  });
}

sliderBreeze.addEventListener('input', () => {
  const val = parseFloat(sliderBreeze.value);
  sim.cloth.windStrength = val;
  breezeValEl.textContent = `${val.toFixed(1)} m/s²`;
});

btnWindBurst.addEventListener('click', () => {
  audio.unlock();
  triggerAction('windBurst');
});

btnAudio.addEventListener('click', () => {
  audio.toggleMute();
  updateHudControls();
});

// 3D Raycast click-to-toggle on Levers A & B
const raycaster = new THREE.Raycaster();
const pointerNDC = new THREE.Vector2();
let downPos = null;

canvas.addEventListener('pointerdown', (e) => {
  downPos = { x: e.clientX, y: e.clientY };
});

canvas.addEventListener('pointerup', (e) => {
  if (!downPos) return;
  const dist = Math.hypot(e.clientX - downPos.x, e.clientY - downPos.y);
  downPos = null;
  if (dist > 6) return;

  const rect = canvas.getBoundingClientRect();
  pointerNDC.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
  pointerNDC.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
  raycaster.setFromCamera(pointerNDC, camera);

  const hits = raycaster.intersectObjects([sceneHandle.leverAGroup, sceneHandle.leverBGroup], true);
  if (hits.length > 0) {
    audio.unlock();
    const hitName = hits[0].object.name;
    if (hitName === 'leverA') triggerAction('leverA');
    else if (hitName === 'leverB') triggerAction('leverB');
  }
});

window.addEventListener('keydown', (e) => {
  if (e.key === '1') {
    audio.unlock();
    triggerAction('leverA');
  } else if (e.key === '2') {
    audio.unlock();
    triggerAction('leverB');
  } else if (e.key === 'r' || e.key === 'R') {
    audio.unlock();
    triggerAction('reset');
  } else if (e.code === 'Space') {
    e.preventDefault();
    audio.unlock();
    sim.paused = !sim.paused;
    updateHudControls();
  } else if (e.key === 'v' || e.key === 'V') {
    const order = ['hero', 'macro', 'alt_mode'];
    const next = order[(order.indexOf(viewMode) + 1) % order.length];
    setView(next);
  }
});

// Energy Conservation Sparkline Renderer
function renderSparkline() {
  const hist = sim.energyHistory;
  const w = sparkCanvas.width;
  const h = sparkCanvas.height;
  sparkCtx.clearRect(0, 0, w, h);

  sparkCtx.strokeStyle = 'rgba(212, 168, 83, 0.14)';
  sparkCtx.lineWidth = 1;
  for (let g = 1; g <= 2; g++) {
    const gy = Math.round((h * g) / 3) + 0.5;
    sparkCtx.beginPath();
    sparkCtx.moveTo(0, gy);
    sparkCtx.lineTo(w, gy);
    sparkCtx.stroke();
  }

  if (hist.length < 2) return;

  let maxE = 0.5;
  for (let i = 0; i < hist.length; i++) {
    const s = hist[i];
    if (s.E_tot > maxE) maxE = s.E_tot;
    const clothScaled = s.E_cloth * 10;
    if (clothScaled > maxE) maxE = clothScaled;
  }
  maxE *= 1.08;

  const drawSeries = (getter, color, width) => {
    sparkCtx.strokeStyle = color;
    sparkCtx.lineWidth = width;
    sparkCtx.beginPath();
    for (let i = 0; i < hist.length; i++) {
      const x = (i / Math.max(1, hist.length - 1)) * (w - 4) + 2;
      const val = getter(hist[i]);
      const y = h - 3 - (val / maxE) * (h - 6);
      if (i === 0) sparkCtx.moveTo(x, y);
      else sparkCtx.lineTo(x, y);
    }
    sparkCtx.stroke();
  };

  drawSeries((s) => s.E_pot, '#b5893a', 1.15);
  drawSeries((s) => s.E_kin, '#ef8c3b', 1.25);
  drawSeries((s) => s.E_cloth * 10, '#35d49a', 1.45);
  drawSeries((s) => s.E_tot, '#f2c65b', 1.85);
}

// Main 120 Hz Fixed-Timestep Accumulator Loop
let lastTimeSec = performance.now() * 0.001;
let accumulator = 0;
let fpsEma = 60;
let lastStageDisplayed = -1;
let uiTimer = 0;

const desiredCamPos = new THREE.Vector3();
const desiredTarget = new THREE.Vector3();

function animate() {
  requestAnimationFrame(animate);

  const nowSec = performance.now() * 0.001;
  let frameDt = nowSec - lastTimeSec;
  lastTimeSec = nowSec;
  if (frameDt < 0) frameDt = 0;
  if (frameDt > 0.05) frameDt = 0.05;

  if (frameDt > 0.0005) {
    const instFps = Math.min(240, 1 / frameDt);
    fpsEma = fpsEma * 0.9 + instFps * 0.1;
  }

  if (!sim.paused) {
    accumulator += frameDt;
    let substeps = 0;
    while (accumulator >= FIXED_DT && substeps < 8) {
      sim.step(FIXED_DT);
      accumulator -= FIXED_DT;
      substeps++;
    }
    if (substeps === 8 && accumulator > FIXED_DT) {
      accumulator = 0;
    }
  }

  sceneHandle.syncFromSim(clothWireframe);

  // Action Follow-Cam in alt_mode
  if (followCam && !userOrbiting) {
    if (sim.stage >= 6) {
      desiredCamPos.set(3.75, 1.72, 2.75);
      desiredTarget.set(4.72, 1.08, 0.0);
    } else {
      const m = sim.getActiveMarblePosition();
      desiredTarget.set(m.x, Math.max(0.35, m.y), m.z);
      desiredCamPos.set(m.x - 1.1, Math.max(1.2, m.y + 0.85), 2.85);
    }
    camera.position.lerp(desiredCamPos, 0.08);
    controls.target.lerp(desiredTarget, 0.08);
  }

  controls.update();
  renderer.render(scene, camera);

  // HUD & Telemetry updates
  if (sim.stage !== lastStageDisplayed) {
    lastStageDisplayed = sim.stage;
    stagePillEl.textContent = `STAGE ${sim.stage}/8 · ${STAGE_NAMES[sim.stage].toUpperCase()}`;
  }

  uiTimer += frameDt;
  if (uiTimer >= 0.033) {
    uiTimer = 0;
    energyReadoutEl.textContent = `${sim.energy.E_tot.toFixed(2)} J`;
    renderSparkline();
  }

  const meta = window.__BENCH_META__;
  meta.drawCalls = renderer.info.render.calls;
  meta.triangles = renderer.info.render.triangles;
  meta.fps = +fpsEma.toFixed(1);
  meta.telemetry.stage = sim.stage;
  meta.telemetry.stageName = STAGE_NAMES[sim.stage];
  meta.telemetry.simTimeSec = +sim.simTimeSec.toFixed(2);
  meta.telemetry.clothMaxBillowM = +sim.cloth.maxBillowM.toFixed(3);
  meta.telemetry.totalEnergyJ = +sim.energy.E_tot.toFixed(3);
  meta.telemetry.leverAMode = sim.leverAMode;
  meta.telemetry.leverBMode = sim.leverBMode;
  meta.telemetry.viewMode = viewMode;
}

updateHudControls();
requestAnimationFrame(animate);
