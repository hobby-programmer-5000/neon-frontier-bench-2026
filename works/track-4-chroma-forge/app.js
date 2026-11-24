// ============================================================================
// ChromaForge — Studio Application Controller & Gate 5.5 Benchmark Harness
// Track 04 · Gemini 4 Argon (High) · Iterative Visual-Refinement Agent
// ============================================================================

import { HexFlameEngine, FLAME_PRESETS } from './hex-flame.js';
import {
  SheetRelightEngine,
  RELIGHT_MODES,
  TOTAL_CELLS,
  FORMULAS_PER_PASS
} from './sheet-relight.js';

const BOOT_START_MS = performance.now();

// Initialize Global Benchmark Telemetry Contract immediately
window.__BENCH_META__ = {
  id: 'track-4-chroma-forge',
  title: 'ChromaForge — Hex Flame & 57.6K Formula Relight',
  domain: 'Generative Shader Art & Spreadsheet CV',
  model: 'gemini-4-argon',
  effort: 'high',
  technique: 'Iterative Visual-Refinement Agent',
  ready: false,
  bootMs: 0,
  shaderPrewarmMs: 0,
  drawCalls: 1,
  triangles: 2,
  fps: 60,
  telemetry: {
    activeMode: 'Mode A · Hex Flame (Solar Forge)',
    activeCells: TOTAL_CELLS,
    liveFormulas: FORMULAS_PER_PASS,
    relightMode: '4. Dynamic Key Relight',
    lightPos: '(0.42, 0.34, 0.62)',
    activeCell: 'DR84',
    activeFormula: '=CLAMP(255*(KA*B84 + KD*MAX(0,DOT(N_DR84,L)) + KS*POW(R_DOT_V,24)),0,255)'
  }
};

class ChromaForgeStudio {
  constructor() {
    this.activeStudioMode = 'flame'; // 'flame' (Mode A) | 'sheet' (Mode B)
    this.activeCanonicalView = 'hero';

    // DOM References
    this.elModeA = document.getElementById('btn-mode-a');
    this.elModeB = document.getElementById('btn-mode-b');
    this.elViewHero = document.getElementById('btn-view-hero');
    this.elViewMacro = document.getElementById('btn-view-macro');
    this.elViewAlt = document.getElementById('btn-view-alt');
    this.elBtnDemo = document.getElementById('btn-trigger-demo');
    this.elBtnDrawer = document.getElementById('btn-toggle-drawer');

    this.elStageFlame = document.getElementById('stage-flame');
    this.elStageSheet = document.getElementById('stage-sheet');
    this.elDrawer = document.getElementById('studio-drawer');
    this.elControlsFlame = document.getElementById('controls-flame');
    this.elControlsSheet = document.getElementById('controls-sheet');

    // Formula Bar (fx)
    this.elFxBadge = document.getElementById('fx-cell-badge');
    this.elFxTag = document.getElementById('fx-op-tag');
    this.elFxExpr = document.getElementById('fx-expression');
    this.elFxEval = document.getElementById('fx-eval-readout');

    // Status Bar
    this.elStEngine = document.getElementById('st-engine');
    this.elStCells = document.getElementById('st-cells');
    this.elStFormulas = document.getElementById('st-formulas');
    this.elStLight = document.getElementById('st-light');
    this.elStFps = document.getElementById('st-fps');

    // Instantiate Engines
    const flameCanvas = document.getElementById('flame-canvas');
    const sheetCanvas = document.getElementById('sheet-canvas');

    this.flameEngine = new HexFlameEngine(flameCanvas);
    this.sheetEngine = new SheetRelightEngine(sheetCanvas, (cellInfo) => {
      this._onSheetCellUpdated(cellInfo);
    });

    this.latestCellInfo = this.sheetEngine.getSelectedCellTelemetry();

    // Update pre-warm telemetry
    document.getElementById('kv-prewarm-ms').textContent = `${this.flameEngine.prewarmMs} ms`;
    window.__BENCH_META__.shaderPrewarmMs = this.flameEngine.prewarmMs;

    // FPS tracking
    this.lastFrameTime = performance.now();
    this.smoothedFps = 60;

    this._bindUI();
    this._syncFlameSlidersFromParams();
    this._updateFormulaBar();

    // Render initial warm frame for both canvases and mark ready = true
    this.flameEngine.resize();
    this.sheetEngine.resize();
    this.flameEngine.render(0.016);
    this.sheetEngine.render(0.016);

    window.__BENCH_META__.bootMs = Number((performance.now() - BOOT_START_MS).toFixed(2));
    window.__BENCH_META__.ready = true;
    this._syncBenchTelemetry();

    window.addEventListener('resize', () => {
      this.flameEngine.resize();
      this.sheetEngine.resize();
      this._renderActiveImmediate();
    });

    requestAnimationFrame((ts) => this._loop(ts));
  }

  _bindUI() {
    // Mode Tabs
    this.elModeA.addEventListener('click', () => this.switchStudioMode('flame'));
    this.elModeB.addEventListener('click', () => this.switchStudioMode('sheet'));

    // Canonical View Buttons
    this.elViewHero.addEventListener('click', () => this.setView('hero'));
    this.elViewMacro.addEventListener('click', () => this.setView('macro'));
    this.elViewAlt.addEventListener('click', () => this.setView('alt_mode'));
    this.elBtnDemo.addEventListener('click', () => this.triggerAction('demo'));

    // Collapsible Right Drawer
    this.elBtnDrawer.addEventListener('click', () => {
      const collapsed = this.elDrawer.classList.toggle('collapsed');
      this.elBtnDrawer.setAttribute('aria-expanded', String(!collapsed));
      this.elBtnDrawer.classList.toggle('active', !collapsed);
      this.flameEngine.resize();
      this.sheetEngine.resize();
      this._renderActiveImmediate();
    });

    // Mode A Preset Buttons
    const presetBtns = document.querySelectorAll('.preset-btn');
    presetBtns.forEach((btn) => {
      btn.addEventListener('click', () => {
        const key = btn.getAttribute('data-preset');
        this._applyFlamePresetUI(key);
      });
    });

    // Mode A Vortex Pulse
    document.getElementById('btn-flame-impulse').addEventListener('click', () => {
      this.flameEngine.triggerImpulse(1.45);
    });

    // Mode A Parameter Sliders
    const bindFlameSlider = (id, outId, paramKey, fmt = (v) => v.toFixed(2)) => {
      const sl = document.getElementById(id);
      const out = document.getElementById(outId);
      sl.addEventListener('input', () => {
        const val = parseFloat(sl.value);
        this.flameEngine.params[paramKey] = val;
        out.textContent = fmt(val);
        this.flameEngine._updateHexEstimate();
        document.getElementById('kv-hex-count').textContent = `~${this.flameEngine.hexCountEstimate.toLocaleString()} Hexes`;
      });
    };

    bindFlameSlider('sl-speed', 'val-speed', 'speed');
    bindFlameSlider('sl-turbulence', 'val-turbulence', 'turbulence');
    bindFlameSlider('sl-viscosity', 'val-viscosity', 'viscosity');
    bindFlameSlider('sl-flamesize', 'val-flamesize', 'flameSize');
    bindFlameSlider('sl-sparks', 'val-sparks', 'sparks');
    bindFlameSlider('sl-glow', 'val-glow', 'ambientGlow');
    bindFlameSlider('sl-hexscale', 'val-hexscale', 'hexScale', (v) => String(Math.round(v)));

    // Mode B Relight Mode Buttons (1..6)
    const relightBtns = document.querySelectorAll('.relight-btn');
    relightBtns.forEach((btn) => {
      btn.addEventListener('click', () => {
        const mId = parseInt(btn.getAttribute('data-rmode'), 10);
        this._applySheetRelightModeUI(mId);
      });
    });

    // Mode B Orbit Toggle
    const orbitBtn = document.getElementById('btn-sheet-orbit');
    orbitBtn.addEventListener('click', () => {
      this.sheetEngine.light.orbiting = !this.sheetEngine.light.orbiting;
      orbitBtn.textContent = this.sheetEngine.light.orbiting ? 'PAUSE L1' : 'ORBIT L1';
    });

    // Mode B Parameter Sliders
    const bindSheetSlider = (id, outId, key, fmt = (v) => v.toFixed(2)) => {
      const sl = document.getElementById(id);
      const out = document.getElementById(outId);
      sl.addEventListener('input', () => {
        const val = parseFloat(sl.value);
        out.textContent = fmt(val);
        if (key === 'showLoupe') {
          this.sheetEngine.showLoupe = val >= 0.5;
        } else {
          this.sheetEngine.light[key] = val;
          this.sheetEngine.evaluateRelightPass();
        }
        this._syncBenchTelemetry();
      });
    };

    bindSheetSlider('sl-light-z', 'val-light-z', 'z');
    bindSheetSlider('sl-kd', 'val-kd', 'kd');
    bindSheetSlider('sl-ks', 'val-ks', 'ks');
    bindSheetSlider('sl-shininess', 'val-shininess', 'shininess', (v) => String(Math.round(v)));
    bindSheetSlider('sl-neon-emit', 'val-neon-emit', 'neonEmit');
    bindSheetSlider('sl-grid-zoom', 'val-grid-zoom', 'showLoupe', (v) => (v >= 0.5 ? 'ON' : 'OFF'));
  }

  _applyFlamePresetUI(presetKey) {
    if (!this.flameEngine.applyPreset(presetKey)) return;
    const p = FLAME_PRESETS[presetKey];

    document.querySelectorAll('.preset-btn').forEach((btn) => {
      btn.classList.toggle('active', btn.getAttribute('data-preset') === presetKey);
    });

    document.getElementById('preset-active-label').textContent = p.label;
    document.getElementById('flame-temp-peak').textContent = p.peakTempK;
    document.getElementById('spectrum-bar').style.background = p.spectrumCSS;
    document.getElementById('kv-hex-count').textContent = `~${this.flameEngine.hexCountEstimate.toLocaleString()} Hexes`;

    this._syncFlameSlidersFromParams();
    this._updateFormulaBar();
    this._syncBenchTelemetry();
  }

  _syncFlameSlidersFromParams() {
    const p = this.flameEngine.params;
    const setSl = (id, outId, val, fmt = (v) => v.toFixed(2)) => {
      const sl = document.getElementById(id);
      const out = document.getElementById(outId);
      if (sl && out) {
        sl.value = String(val);
        out.textContent = fmt(val);
      }
    };
    setSl('sl-speed', 'val-speed', p.speed);
    setSl('sl-turbulence', 'val-turbulence', p.turbulence);
    setSl('sl-viscosity', 'val-viscosity', p.viscosity);
    setSl('sl-flamesize', 'val-flamesize', p.flameSize);
    setSl('sl-sparks', 'val-sparks', p.sparks);
    setSl('sl-glow', 'val-glow', p.ambientGlow);
    setSl('sl-hexscale', 'val-hexscale', p.hexScale, (v) => String(Math.round(v)));
  }

  _applySheetRelightModeUI(modeId) {
    if (!this.sheetEngine.setRelightMode(modeId)) return;
    document.querySelectorAll('.relight-btn').forEach((btn) => {
      btn.classList.toggle('active', parseInt(btn.getAttribute('data-rmode'), 10) === modeId);
    });
    this._updateFormulaBar();
    this._syncBenchTelemetry();
  }

  _onSheetCellUpdated(info) {
    this.latestCellInfo = info;

    document.getElementById('insp-cell-id').textContent = info.coord;
    document.getElementById('cm-base-rgb').textContent = info.baseRGB.join(', ');
    document.getElementById('cm-relit-rgb').textContent = info.relitRGB.join(', ');
    document.getElementById('cm-sobel').textContent = info.sobel;
    document.getElementById('cm-depth').textContent = info.depth;
    document.getElementById('cm-normal').textContent = info.normal;

    // Populate 3x3 Live Neighborhood Mini Spreadsheet
    const gridEl = document.getElementById('mini-sheet-grid');
    if (gridEl && info.neighbors) {
      gridEl.innerHTML = info.neighbors
        .map((n) => {
          const textCol = n.lum > 140 ? '#090a0d' : '#f2f4f8';
          const cls = n.isCenter ? 'mini-cell center-cell' : 'mini-cell';
          return `<div class="${cls}" style="background:rgb(${n.r},${n.g},${n.b});color:${textCol}">
            <span class="mc-coord">${n.coord}</span>
            <span class="mc-val">${n.r},${n.g},${n.b}</span>
          </div>`;
        })
        .join('');
    }

    if (this.activeStudioMode === 'sheet') {
      this._updateFormulaBar();
    }
  }

  _updateFormulaBar() {
    if (this.activeStudioMode === 'flame') {
      const p = FLAME_PRESETS[this.flameEngine.activePreset] || FLAME_PRESETS.solar_forge;
      const zoomTag = this.flameEngine.params.zoom > 1.2 ? 'MACRO 1.55x' : 'FULL 1.0x';
      this.elFxBadge.textContent = `HEX(${this.flameEngine.params.hexScale})`;
      this.elFxTag.textContent = `GLSL // ${p.label}`;
      this.elFxExpr.textContent = p.formula;
      this.elFxEval.textContent = `T_max: ${p.peakTempK} · ${zoomTag}`;
      this.elStEngine.textContent = 'WEBGL2 // GLSL 300 ES';
    } else {
      const info = this.latestCellInfo || this.sheetEngine.getSelectedCellTelemetry();
      this.elFxBadge.textContent = info.coord;
      this.elFxTag.textContent = info.tag;
      this.elFxExpr.textContent = info.formula;
      this.elFxEval.textContent = `RGB(${info.relitRGB.join(',')}) · Z:${info.depth}`;
      this.elStEngine.textContent = 'SHEET-CV // 57.6K CELLS';
    }
  }

  switchStudioMode(mode) {
    this.activeStudioMode = mode === 'sheet' ? 'sheet' : 'flame';
    const isFlame = this.activeStudioMode === 'flame';

    this.elModeA.classList.toggle('active', isFlame);
    this.elModeB.classList.toggle('active', !isFlame);

    this.elStageFlame.classList.toggle('active', isFlame);
    this.elStageSheet.classList.toggle('active', !isFlame);

    this.elControlsFlame.classList.toggle('active', isFlame);
    this.elControlsSheet.classList.toggle('active', !isFlame);

    this.flameEngine.resize();
    this.sheetEngine.resize();
    this._updateFormulaBar();
    this._renderActiveImmediate();
    this._syncBenchTelemetry();
  }

  setView(viewName) {
    const v = String(viewName || 'hero').toLowerCase();
    this.activeCanonicalView = v;

    this.elViewHero.classList.toggle('active', v === 'hero');
    this.elViewMacro.classList.toggle('active', v === 'macro');
    this.elViewAlt.classList.toggle('active', v === 'alt_mode');

    if (v === 'hero') {
      this.switchStudioMode('flame');
      this._applyFlamePresetUI('solar_forge');
      this.flameEngine.params.zoom = 1.0;
      this.flameEngine.triggerImpulse(0.6);
      this._renderActiveImmediate();
      return true;
    }

    if (v === 'macro') {
      this.switchStudioMode('flame');
      this._applyFlamePresetUI('argon_plasma');
      this.flameEngine.params.zoom = 1.65;
      this.flameEngine.params.turbulence = 1.75;
      this.flameEngine.triggerImpulse(1.2);
      this._syncFlameSlidersFromParams();
      this._updateFormulaBar();
      this._renderActiveImmediate();
      return true;
    }

    if (v === 'alt_mode' || v === 'action_state') {
      this.switchStudioMode('sheet');
      this._applySheetRelightModeUI(4); // 4. Dynamic Key Relight
      this.sheetEngine.selectCell(121, 83); // DR84
      this.sheetEngine.setLightPos(0.42, 0.34, 0.62);
      this._updateFormulaBar();
      this._renderActiveImmediate();
      return true;
    }

    return false;
  }

  triggerAction(actionName = 'demo') {
    const act = String(actionName || 'demo').toLowerCase();
    if (act === 'demo' || act === 'relight' || act === 'inspect') {
      // Switch to Mode B (or stay in Mode B if already there) and dynamically move 3D light source & inspect DR84
      this.switchStudioMode('sheet');
      this._applySheetRelightModeUI(4); // 4. Dynamic Key Relight
      this.sheetEngine.selectCell(121, 83); // Exact cell DR84 (col 121 = DR, row 83 = 84)
      this.sheetEngine.setLightPos(0.56, 0.28, 0.72);
      document.getElementById('sl-light-z').value = '0.72';
      document.getElementById('val-light-z').textContent = '0.72';
      this._updateFormulaBar();
      this._renderActiveImmediate();
      this._syncBenchTelemetry();

      return `Moved 3D light source to (0.56, 0.28, 0.72) and inspected cell DR84 (${this.latestCellInfo.formula}) across 57,600 cells`;
    }

    if (act === 'vortex' || act === 'pulse') {
      this.flameEngine.triggerImpulse(1.5);
      this._renderActiveImmediate();
      return 'Injected thermal curl-noise vortex impulse into Mode A Hex Flame';
    }

    return this.triggerAction('demo');
  }

  _renderActiveImmediate() {
    if (this.activeStudioMode === 'flame') {
      this.flameEngine.render(0.016);
    } else {
      this.sheetEngine.render(0.016);
    }
  }

  _syncBenchTelemetry() {
    const l = this.sheetEngine.light;
    const lightStr = `(${l.x.toFixed(2)}, ${l.y.toFixed(2)}, ${l.z.toFixed(2)})`;
    this.elStLight.textContent = lightStr;

    const info = this.latestCellInfo || this.sheetEngine.getSelectedCellTelemetry();
    const isFlame = this.activeStudioMode === 'flame';
    const presetLabel = (FLAME_PRESETS[this.flameEngine.activePreset] || FLAME_PRESETS.solar_forge).label;

    window.__BENCH_META__.drawCalls = isFlame ? 1 : 7;
    window.__BENCH_META__.triangles = isFlame ? 2 : TOTAL_CELLS * 2;
    window.__BENCH_META__.fps = Math.round(this.smoothedFps);
    window.__BENCH_META__.telemetry = {
      activeMode: isFlame
        ? `Mode A · Hex Flame (${presetLabel})`
        : `Mode B · 57.6K Sheet Relight (${info.modeName})`,
      activeCells: TOTAL_CELLS,
      liveFormulas: FORMULAS_PER_PASS,
      relightMode: info.modeName,
      lightPos: lightStr,
      activeCell: info.coord,
      activeFormula: info.formula
    };
  }

  _loop(now) {
    const rawDt = Math.max(0.001, Math.min(0.1, (now - this.lastFrameTime) / 1000));
    this.lastFrameTime = now;

    const instFps = 1.0 / rawDt;
    this.smoothedFps = this.smoothedFps * 0.9 + instFps * 0.1;

    if (this.activeStudioMode === 'flame') {
      this.flameEngine.render(rawDt);
    } else {
      this.sheetEngine.render(rawDt);
    }

    const roundedFps = Math.min(60, Math.max(1, Math.round(this.smoothedFps)));
    this.elStFps.textContent = String(roundedFps);
    window.__BENCH_META__.fps = roundedFps;

    requestAnimationFrame((ts) => this._loop(ts));
  }
}

// Boot Studio & Expose Deterministic Gate 5.5 Actions
const studio = new ChromaForgeStudio();

window.__BENCH_ACTIONS__ = {
  setView: (viewName) => studio.setView(viewName),
  triggerAction: (actionName) => studio.triggerAction(actionName)
};
