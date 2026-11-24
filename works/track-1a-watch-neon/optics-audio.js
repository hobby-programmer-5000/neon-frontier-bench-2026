/**
 * Chronos Calibre N-4 — Procedural Horology Textures, Hybrid Optics & 8 Hz Swiss Audio
 * Zero external assets. All Côtes de Genève stripes, circular perlage, sunray brushing,
 * sapphire crystal reflections, kinematic torque flow vectors, and Swiss lever acoustics
 * are synthesized 100% procedurally.
 */

import { CALIBRE, DEG } from "./involute-math.js";

/**
 * Deterministic fast PRNG for crisp procedural brushed metal micro-grain
 * without temporal shimmer or external noise textures.
 */
function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Generates procedural horological surface patterns as offscreen Canvas PNG data URLs
 * for GPU-cached SVG <pattern> fills at locked 60 FPS.
 */
export function generateProceduralTextures() {
  return {
    cotesRhodium: makeCotesDeGeneve("rhodium"),
    cotesRoseGold: makeCotesDeGeneve("rosegold"),
    perlageDark: makePerlageAnthracite(),
    sunraySteel: makeSunrayMetal("steel"),
    sunrayChampagne: makeSunrayMetal("champagne"),
    leatherDark: makeAlligatorLeather(),
  };
}

function makeCotesDeGeneve(variant) {
  const size = 128;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  const rng = mulberry32(variant === "rhodium" ? 4019 : 7321);

  const bands = 4;
  const bw = size / bands;

  const palette =
    variant === "rhodium"
      ? { dark: [92, 97, 106], mid: [152, 158, 168], light: [204, 210, 220], ridge: [228, 232, 240] }
      : { dark: [126, 93, 60], mid: [186, 145, 98], light: [228, 194, 146], ridge: [246, 221, 179] };

  for (let b = 0; b < bands; b++) {
    const x0 = b * bw;
    const grad = ctx.createLinearGradient(x0, 0, x0 + bw, 0);
    grad.addColorStop(0.0, `rgb(${palette.dark.join(",")})`);
    grad.addColorStop(0.1, `rgb(${palette.mid.join(",")})`);
    grad.addColorStop(0.42, `rgb(${palette.light.join(",")})`);
    grad.addColorStop(0.54, `rgb(${palette.ridge.join(",")})`);
    grad.addColorStop(0.84, `rgb(${palette.mid.join(",")})`);
    grad.addColorStop(0.97, `rgb(${palette.dark.join(",")})`);
    grad.addColorStop(1.0, `rgba(18, 20, 24, 0.85)`);
    ctx.fillStyle = grad;
    ctx.fillRect(x0, 0, bw, size);

    ctx.save();
    ctx.beginPath();
    ctx.rect(x0, 0, bw, size);
    ctx.clip();
    for (let i = 0; i < 28; i++) {
      const y = (i / 28) * size;
      const alpha = 0.035 + rng() * 0.05;
      ctx.strokeStyle = i % 2 === 0 ? `rgba(255,252,246,${alpha})` : `rgba(14,16,20,${alpha * 1.15})`;
      ctx.lineWidth = 0.7;
      ctx.beginPath();
      ctx.moveTo(x0 - 2, y + 3);
      ctx.quadraticCurveTo(x0 + bw * 0.5, y - 3.5, x0 + bw + 2, y + 2);
      ctx.stroke();
    }
    ctx.restore();
  }

  for (let i = 0; i < 48; i++) {
    const x = rng() * size;
    ctx.fillStyle = rng() > 0.5 ? "rgba(255,255,255,0.025)" : "rgba(0,0,0,0.03)";
    ctx.fillRect(x, 0, 0.8, size);
  }

  return canvas.toDataURL("image/png");
}

function makePerlageAnthracite() {
  const size = 128;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");

  const stampSize = 32;
  const stamp = document.createElement("canvas");
  stamp.width = stampSize;
  stamp.height = stampSize;
  const sctx = stamp.getContext("2d");
  const sc = stampSize / 2;
  const radius = 14.5;
  const g = sctx.createRadialGradient(sc - 2.2, sc - 2.2, 0.8, sc, sc, radius);
  g.addColorStop(0.0, "rgba(74, 80, 92, 0.44)");
  g.addColorStop(0.35, "rgba(44, 48, 56, 0.28)");
  g.addColorStop(0.7, "rgba(62, 67, 78, 0.36)");
  g.addColorStop(0.92, "rgba(20, 22, 27, 0.52)");
  g.addColorStop(1.0, "rgba(18, 20, 25, 0)");
  sctx.fillStyle = g;
  sctx.beginPath();
  sctx.arc(sc, sc, radius, 0, Math.PI * 2);
  sctx.fill();

  sctx.strokeStyle = "rgba(180, 188, 202, 0.095)";
  sctx.lineWidth = 0.55;
  for (const rr of [4.2, 8.2, 12.0]) {
    sctx.beginPath();
    sctx.arc(sc, sc, rr, -0.9, 1.3);
    sctx.stroke();
  }
  sctx.strokeStyle = "rgba(8, 9, 12, 0.26)";
  sctx.beginPath();
  sctx.arc(sc, sc, 13.4, 1.8, 4.1);
  sctx.stroke();

  ctx.fillStyle = "#17191e";
  ctx.fillRect(0, 0, size, size);

  const step = 22;
  for (let row = -1; row <= Math.ceil(size / (step * 0.82)) + 1; row++) {
    const y = row * step * 0.82;
    const offset = (row & 1) ? step * 0.5 : 0;
    for (let col = -1; col <= Math.ceil(size / step) + 1; col++) {
      const x = col * step + offset;
      ctx.drawImage(stamp, x - sc, y - sc);
    }
  }

  return canvas.toDataURL("image/png");
}

function makeSunrayMetal(variant) {
  const size = 128;
  const cx = size / 2;
  const cy = size / 2;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  const rng = mulberry32(variant === "steel" ? 911 : 5507);

  const base = variant === "steel" ? "#a5acb6" : "#caa570";
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, size, size);

  const segments = 90;
  for (let i = 0; i < segments; i++) {
    const a0 = (i / segments) * Math.PI * 2;
    const a1 = ((i + 1.2) / segments) * Math.PI * 2;
    const lobe = Math.cos(2 * (a0 - 0.65));
    const jitter = (rng() - 0.5) * 0.12;
    const lum = 0.5 + lobe * 0.34 + jitter;

    if (variant === "steel") {
      const v = Math.round(115 + lum * 115);
      ctx.fillStyle = `rgb(${v}, ${Math.min(255, v + 3)}, ${Math.min(255, v + 9)})`;
    } else {
      const r = Math.round(150 + lum * 95);
      const g = Math.round(115 + lum * 84);
      const b = Math.round(68 + lum * 62);
      ctx.fillStyle = `rgb(${r}, ${g}, ${b})`;
    }
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.arc(cx, cy, size * 0.75, a0, a1);
    ctx.closePath();
    ctx.fill();
  }

  for (let r = 8; r < size * 0.68; r += 3.5) {
    ctx.strokeStyle = r % 7 < 3.5 ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.05)";
    ctx.lineWidth = 0.5;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.stroke();
  }

  return canvas.toDataURL("image/png");
}

function makeAlligatorLeather() {
  const size = 128;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  const rng = mulberry32(2026);

  ctx.fillStyle = "#141213";
  ctx.fillRect(0, 0, size, size);

  // Subtle matte alligator tile embossing
  const rows = 5;
  const cols = 4;
  const rw = size / cols;
  const rh = size / rows;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const x = c * rw + 2;
      const y = r * rh + 2;
      const w = rw - 4;
      const h = rh - 4;
      const g = ctx.createLinearGradient(x, y, x + w, y + h);
      g.addColorStop(0, "rgba(42, 37, 36, 0.7)");
      g.addColorStop(0.5, "rgba(26, 23, 23, 0.85)");
      g.addColorStop(1, "rgba(12, 11, 12, 0.95)");
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.roundRect(x, y, w, h, 4);
      ctx.fill();
      ctx.strokeStyle = "rgba(6, 5, 6, 0.85)";
      ctx.lineWidth = 1.4;
      ctx.stroke();
    }
  }
  // Micro pore grain
  for (let i = 0; i < 80; i++) {
    ctx.fillStyle = rng() > 0.5 ? "rgba(255,245,230,0.025)" : "rgba(0,0,0,0.08)";
    ctx.fillRect(rng() * size, rng() * size, 1.2, 1.2);
  }
  return canvas.toDataURL("image/png");
}

/**
 * Dual-Layer Canvas Hybrid Optics Engine:
 * - Background Canvas: matte obsidian gallery backdrop, micro-grain, studio contact shadow,
 *   and isometric CAD elevation guides + vertical alignment datum lines in alt_mode.
 * - Foreground Canvas: domed sapphire crystal specular reflection + AR edge glint,
 *   kinematic torque flow particles along exact meshing axes, and crisp editorial callouts.
 */
export class StudioOpticsEngine {
  constructor(bgCanvas, fgCanvas, svgElement) {
    this.bgCanvas = bgCanvas;
    this.fgCanvas = fgCanvas;
    this.bgCtx = bgCanvas.getContext("2d");
    this.fgCtx = fgCanvas.getContext("2d");
    this.svg = svgElement;

    this.width = 1;
    this.height = 1;
    this.dpr = 1;
    this.pointerX = 0.35;
    this.pointerY = 0.28;

    // Pre-baked micro-noise tile for zero-banding obsidian matte surface
    this.noisePattern = null;
    this._buildNoiseTile();

    // Cached SVG layout metrics + dirty keys (eliminates layout reflows & redundant static repaints!)
    this.svgBox = { left: 0, top: 0, width: 1, height: 1 };
    this._lastBgKey = "";
    this._lastFgKey = "";
  }

  _buildNoiseTile() {
    const c = document.createElement("canvas");
    c.width = 128;
    c.height = 128;
    const ctx = c.getContext("2d");
    const img = ctx.createImageData(128, 128);
    const rng = mulberry32(1337);
    for (let i = 0; i < img.data.length; i += 4) {
      const v = Math.floor(rng() * 26);
      img.data[i] = v;
      img.data[i + 1] = v;
      img.data[i + 2] = Math.min(255, v + 3);
      img.data[i + 3] = 16;
    }
    ctx.putImageData(img, 0, 0);
    this.noiseTile = c;
  }

  refreshSvgBox() {
    const svgRect = this.svg.getBoundingClientRect();
    const hostRect = this.fgCanvas.getBoundingClientRect();
    this.svgBox = {
      left: svgRect.left - hostRect.left,
      top: svgRect.top - hostRect.top,
      width: Math.max(1, svgRect.width),
      height: Math.max(1, svgRect.height),
    };
  }

  resize(width, height) {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const sizeChanged = width !== this.width || height !== this.height || dpr !== this.dpr;
    if (sizeChanged) {
      this.width = Math.max(1, width);
      this.height = Math.max(1, height);
      this.dpr = dpr;

      for (const c of [this.bgCanvas, this.fgCanvas]) {
        c.width = Math.round(this.width * dpr);
        c.height = Math.round(this.height * dpr);
        c.style.width = `${this.width}px`;
        c.style.height = `${this.height}px`;
      }
      this.bgCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
      this.fgCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
      this.noisePattern = this.bgCtx.createPattern(this.noiseTile, "repeat");
    }
    this._lastBgKey = "";
    this._lastFgKey = "";
    this.refreshSvgBox();
  }

  setPointer(normX, normY) {
    const nx = Math.max(0, Math.min(1, normX));
    const ny = Math.max(0, Math.min(1, normY));
    if (Math.abs(nx - this.pointerX) > 0.002 || Math.abs(ny - this.pointerY) > 0.002) {
      this.pointerX = nx;
      this.pointerY = ny;
      this._lastFgKey = "";
    }
  }

  /**
   * Projects an SVG movement coordinate (sx, sy) on exploded layer `layerZOffset`
   * directly into canvas pixel coordinates with ZERO layout reflows.
   */
  projectToCanvas(sx, sy, layerZOffset, state) {
    const e = state.explodeProgress;
    const rotRad = (-30 * e) * DEG;
    const scaleY = 1 - 0.48 * e;
    const scaleIso = 1 - 0.14 * e;

    const rx = sx * Math.cos(rotRad) - sy * Math.sin(rotRad);
    const ry = sx * Math.sin(rotRad) + sy * Math.cos(rotRad);

    const isoX = rx * scaleIso;
    const isoY = ry * scaleY * scaleIso + layerZOffset * e;

    const vb = state.viewBox;
    const box = this.svgBox;

    // SVG preserveAspectRatio="xMidYMid meet"
    const scale = Math.min(box.width / vb.w, box.height / vb.h);
    const renderedW = vb.w * scale;
    const renderedH = vb.h * scale;
    const offsetX = box.left + (box.width - renderedW) * 0.5;
    const offsetY = box.top + (box.height - renderedH) * 0.5;

    return {
      x: offsetX + (isoX - vb.x) * scale,
      y: offsetY + (isoY - vb.y) * scale,
      scale,
    };
  }

  render(state, kinematics, nowSec) {
    // 1. Background Canvas: dirty-checked (0.00 ms/frame when camera & explode are settled!)
    const vb = state.viewBox;
    const bgKey = `${this.width}x${this.height}|${vb.x.toFixed(1)},${vb.y.toFixed(1)},${vb.w.toFixed(1)}|${state.explodeProgress.toFixed(3)}`;
    if (bgKey !== this._lastBgKey) {
      this._lastBgKey = bgKey;
      this._renderBackground(state);
    }

    // 2. Foreground Canvas: dynamic when Torque Flow or Macro live-callout tracking is active; static-cached in Hero!
    const needsDynamicFg = state.torqueOverlay || state.explodeProgress > 0.02 || state.macroProgress > 0.02;
    const fgKey = needsDynamicFg
      ? `dyn_${nowSec.toFixed(3)}`
      : `${bgKey}|p:${this.pointerX.toFixed(2)},${this.pointerY.toFixed(2)}`;
    if (fgKey !== this._lastFgKey) {
      this._lastFgKey = fgKey;
      this._renderForeground(state, kinematics, nowSec);
    }
  }

  _renderBackground(state) {
    const ctx = this.bgCtx;
    const w = this.width;
    const h = this.height;
    ctx.clearRect(0, 0, w, h);

    // 1. Warm obsidian/anthracite gallery matte backdrop
    const centerPt = this.projectToCanvas(0, 0, 0, state);
    const spotR = Math.max(w, h) * 0.72;
    const bgGrad = ctx.createRadialGradient(
      centerPt.x - w * 0.06,
      centerPt.y - h * 0.08,
      20,
      centerPt.x,
      centerPt.y,
      spotR
    );
    bgGrad.addColorStop(0.0, "#191b20");
    bgGrad.addColorStop(0.36, "#121418");
    bgGrad.addColorStop(0.75, "#0d0e11");
    bgGrad.addColorStop(1.0, "#090a0c");
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, w, h);

    if (this.noisePattern) {
      ctx.fillStyle = this.noisePattern;
      ctx.fillRect(0, 0, w, h);
    }

    // 2. Soft calibrated studio table shadow beneath watch case
    const shadowAlpha = 0.62 * (1 - 0.35 * state.explodeProgress);
    const shadowCenter = this.projectToCanvas(0, 14, 108, state);
    const rx = 285 * centerPt.scale * (1 - 0.1 * state.explodeProgress);
    const ry = rx * (1 - 0.44 * state.explodeProgress);

    ctx.save();
    ctx.translate(shadowCenter.x, shadowCenter.y);
    ctx.scale(1, Math.max(0.35, ry / Math.max(1, rx)));
    const shGrad = ctx.createRadialGradient(0, 0, rx * 0.42, 0, 0, rx * 1.18);
    shGrad.addColorStop(0, `rgba(0, 0, 0, ${shadowAlpha})`);
    shGrad.addColorStop(0.65, `rgba(0, 0, 0, ${shadowAlpha * 0.42})`);
    shGrad.addColorStop(1, "rgba(0, 0, 0, 0)");
    ctx.fillStyle = shGrad;
    ctx.beginPath();
    ctx.arc(0, 0, rx * 1.18, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // 3. Exploded Isometric CAD Datum Grid & Vertical Arbor Alignment Rails (alt_mode)
    if (state.explodeProgress > 0.02) {
      this._renderCadDatumBackdrop(ctx, state);
    }
  }

  _renderCadDatumBackdrop(ctx, state) {
    const e = state.explodeProgress;
    ctx.save();
    ctx.globalAlpha = Math.min(1, e * 1.15);

    // Isometric floor blueprint grid beneath Z = 0.00 mm mainplate
    const zBase = state.layerZ[0] + 22;
    ctx.strokeStyle = "rgba(201, 169, 110, 0.07)";
    ctx.lineWidth = 1;
    const gridSpan = 260;
    const gridStep = 52;
    for (let g = -gridSpan; g <= gridSpan; g += gridStep) {
      const a = this.projectToCanvas(g, -gridSpan, zBase, state);
      const b = this.projectToCanvas(g, gridSpan, zBase, state);
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.stroke();

      const c = this.projectToCanvas(-gridSpan, g, zBase, state);
      const d = this.projectToCanvas(gridSpan, g, zBase, state);
      ctx.beginPath();
      ctx.moveTo(c.x, c.y);
      ctx.lineTo(d.x, d.y);
      ctx.stroke();
    }

    // Precision vertical dashed brass arbor-alignment rails through key horological axes
    const arbors = [
      { pt: CALIBRE.barrel, zMin: state.layerZ[0], zMax: state.layerZ[3], label: "BARREL" },
      { pt: CALIBRE.center, zMin: state.layerZ[0], zMax: state.layerZ[4], label: "CENTER" },
      { pt: CALIBRE.third, zMin: state.layerZ[0], zMax: state.layerZ[3], label: "3RD" },
      { pt: CALIBRE.tourbillon, zMin: state.layerZ[0], zMax: state.layerZ[3], label: "TOURBILLON" },
    ];

    ctx.setLineDash([3, 4]);
    ctx.strokeStyle = "rgba(216, 184, 128, 0.34)";
    ctx.lineWidth = 1;
    for (const a of arbors) {
      const bot = this.projectToCanvas(a.pt.x, a.pt.y, a.zMin, state);
      const top = this.projectToCanvas(a.pt.x, a.pt.y, a.zMax, state);
      ctx.beginPath();
      ctx.moveTo(bot.x, bot.y);
      ctx.lineTo(top.x, top.y);
      ctx.stroke();

      // Tiny datum crosshairs at bottom & top
      ctx.setLineDash([]);
      ctx.fillStyle = "rgba(216, 184, 128, 0.55)";
      ctx.beginPath();
      ctx.arc(bot.x, bot.y, 2.2, 0, Math.PI * 2);
      ctx.arc(top.x, top.y, 2.2, 0, Math.PI * 2);
      ctx.fill();
      ctx.setLineDash([3, 4]);
    }
    ctx.setLineDash([]);
    ctx.restore();
  }

  _renderForeground(state, kinematics, nowSec) {
    const ctx = this.fgCtx;
    ctx.clearRect(0, 0, this.width, this.height);

    // 1. Domed Chamfered Sapphire Crystal Optics (Hero & Macro)
    const crystalVisibility = Math.max(0, 1 - state.explodeProgress * 1.15);
    if (crystalVisibility > 0.02) {
      this._renderSapphireCrystalOptics(ctx, state, crystalVisibility);
    }

    // 2. Kinematic Torque Flow Vectors & Pulses
    if (state.torqueOverlay || state.explodeProgress > 0.25) {
      const alpha = state.torqueOverlay ? 1.0 : Math.min(1, (state.explodeProgress - 0.25) * 1.4);
      this._renderTorqueFlowOverlay(ctx, state, kinematics, nowSec, alpha);
    }

    // 3. Exploded CAD Layer Elevation Callouts (alt_mode)
    if (state.explodeProgress > 0.35 && this.width >= 620) {
      const alpha = Math.min(1, (state.explodeProgress - 0.35) / 0.55);
      this._renderExplodedLayerLabels(ctx, state, alpha);
    }

    // 4. Macro Escapement Micro-Callouts (macro mode)
    if (state.macroProgress > 0.45 && this.width >= 640) {
      const alpha = Math.min(1, (state.macroProgress - 0.45) / 0.5);
      this._renderMacroCallouts(ctx, state, kinematics, alpha);
    }
  }

  _renderSapphireCrystalOptics(ctx, state, visibility) {
    const c = this.projectToCanvas(0, 0, 0, state);
    const r = 226 * c.scale;
    if (r < 20) return;

    ctx.save();
    ctx.globalAlpha = visibility;

    // Clip to sapphire crystal aperture
    ctx.beginPath();
    ctx.arc(c.x, c.y, r, 0, Math.PI * 2);
    ctx.clip();

    // Subtle pointer-reactive studio softbox reflection crescent across upper-left dome
    const shiftX = (this.pointerX - 0.5) * r * 0.28;
    const shiftY = (this.pointerY - 0.5) * r * 0.22;

    ctx.save();
    ctx.translate(c.x + shiftX, c.y + shiftY);
    ctx.rotate(-0.62);
    const sweepGrad = ctx.createLinearGradient(-r, -r * 0.9, r * 0.4, r * 0.6);
    sweepGrad.addColorStop(0.0, "rgba(240, 244, 252, 0.0)");
    sweepGrad.addColorStop(0.28, "rgba(232, 240, 252, 0.048)");
    sweepGrad.addColorStop(0.41, "rgba(255, 253, 248, 0.085)");
    sweepGrad.addColorStop(0.49, "rgba(210, 224, 245, 0.015)");
    sweepGrad.addColorStop(1.0, "rgba(210, 224, 245, 0.0)");
    ctx.fillStyle = sweepGrad;
    ctx.beginPath();
    ctx.ellipse(-r * 0.14, -r * 0.28, r * 1.05, r * 0.46, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // Chamfered sapphire crystal bevel edge: razor-thin AR mineral tint + warm specular kiss
    const rimGrad = ctx.createRadialGradient(c.x, c.y, r * 0.92, c.x, c.y, r);
    rimGrad.addColorStop(0.0, "rgba(176, 198, 232, 0)");
    rimGrad.addColorStop(0.55, "rgba(176, 198, 232, 0.06)");
    rimGrad.addColorStop(0.88, "rgba(235, 240, 248, 0.14)");
    rimGrad.addColorStop(1.0, "rgba(255, 244, 224, 0.22)");
    ctx.fillStyle = rimGrad;
    ctx.beginPath();
    ctx.arc(c.x, c.y, r, 0, Math.PI * 2);
    ctx.fill();

    // Delicate top-left crisp curved specular highlight on sapphire chamfer
    ctx.strokeStyle = "rgba(255, 250, 242, 0.26)";
    ctx.lineWidth = Math.max(1.2, 1.8 * c.scale);
    ctx.beginPath();
    ctx.arc(c.x, c.y, r - 2.2 * c.scale, -Math.PI * 0.84, -Math.PI * 0.36);
    ctx.stroke();

    // Subtle lower-right cool AR counter-reflection
    ctx.strokeStyle = "rgba(162, 194, 236, 0.14)";
    ctx.lineWidth = Math.max(1.0, 1.4 * c.scale);
    ctx.beginPath();
    ctx.arc(c.x, c.y, r - 2.5 * c.scale, Math.PI * 0.16, Math.PI * 0.48);
    ctx.stroke();

    ctx.restore();
  }

  _renderTorqueFlowOverlay(ctx, state, kinematics, nowSec, alpha) {
    // World coordinates of escape wheel & pallet fork inside rotating tourbillon cage
    const tc = kinematics.tourbillonAngleRad;
    const cosT = Math.cos(tc);
    const sinT = Math.sin(tc);
    const escWorld = {
      x: CALIBRE.tourbillon.x + CALIBRE.escapeLocal.x * cosT - CALIBRE.escapeLocal.y * sinT,
      y: CALIBRE.tourbillon.y + CALIBRE.escapeLocal.x * sinT + CALIBRE.escapeLocal.y * cosT,
    };
    const palWorld = {
      x: CALIBRE.tourbillon.x + CALIBRE.palletLocal.x * cosT - CALIBRE.palletLocal.y * sinT,
      y: CALIBRE.tourbillon.y + CALIBRE.palletLocal.x * sinT + CALIBRE.palletLocal.y * cosT,
    };

    // Exact mechanical power chain from mainspring to balance wheel (with exact layer Z!)
    const zTrain = state.layerZ[1];
    const zEsc = state.layerZ[2];
    const nodes = [
      { pt: CALIBRE.barrel, z: zTrain, name: "Barrel 1.00×", torqueNm: 100 },
      { pt: CALIBRE.center, z: zTrain, name: "Center 6.67×", torqueNm: 15.0 },
      { pt: CALIBRE.third, z: zTrain, name: "Third 53.3×", torqueNm: 1.88 },
      { pt: CALIBRE.tourbillon, z: zEsc, name: "Cage 400×", torqueNm: 0.25 },
      { pt: escWorld, z: zEsc, name: "Escape 6400×", torqueNm: 0.016 },
      { pt: palWorld, z: zEsc, name: "Pallet 8 Hz", torqueNm: 0.008 },
    ];

    const screenPts = nodes.map((n) => ({
      ...this.projectToCanvas(n.pt.x, n.pt.y, n.z, state),
      name: n.name,
    }));

    ctx.save();
    ctx.globalAlpha = alpha;

    // 1. Crisp dark contrast backing + warm burnished-gold kinematic torque trajectory
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.strokeStyle = "rgba(8, 10, 14, 0.72)";
    ctx.lineWidth = 4.2;
    ctx.beginPath();
    screenPts.forEach((p, idx) => {
      if (idx === 0) ctx.moveTo(p.x, p.y);
      else ctx.lineTo(p.x, p.y);
    });
    ctx.stroke();

    ctx.strokeStyle = "rgba(242, 204, 134, 0.88)";
    ctx.lineWidth = 2.0;
    ctx.setLineDash([6, 4]);
    ctx.lineDashOffset = -nowSec * 38 * Math.max(0.25, Math.min(2.5, state.timeScale));
    ctx.beginPath();
    screenPts.forEach((p, idx) => {
      if (idx === 0) ctx.moveTo(p.x, p.y);
      else ctx.lineTo(p.x, p.y);
    });
    ctx.stroke();
    ctx.setLineDash([]);

    // 2. Animated kinematic energy pulses flowing along each gear mesh segment
    const speed = state.paused ? 0 : Math.min(3.5, Math.max(0.22, state.timeScale));
    for (let i = 0; i < screenPts.length - 1; i++) {
      const a = screenPts[i];
      const b = screenPts[i + 1];
      const phase = ((nowSec * 0.95 * speed + i * 0.22) % 1 + 1) % 1;
      const px = a.x + (b.x - a.x) * phase;
      const py = a.y + (b.y - a.y) * phase;

      const pg = ctx.createRadialGradient(px, py, 0.5, px, py, 9.5);
      pg.addColorStop(0, "rgba(255, 245, 212, 0.98)");
      pg.addColorStop(0.45, "rgba(232, 186, 104, 0.65)");
      pg.addColorStop(1, "rgba(232, 186, 104, 0)");
      ctx.fillStyle = pg;
      ctx.beginPath();
      ctx.arc(px, py, 9.5, 0, Math.PI * 2);
      ctx.fill();

      // Crisp directional vector chevron at midpoint
      const mx = (a.x + b.x) * 0.5;
      const my = (a.y + b.y) * 0.5;
      const ang = Math.atan2(b.y - a.y, b.x - a.x);
      ctx.strokeStyle = "rgba(255, 232, 178, 0.95)";
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.moveTo(mx - 5.5 * Math.cos(ang - 0.55), my - 5.5 * Math.sin(ang - 0.55));
      ctx.lineTo(mx + 2.5 * Math.cos(ang), my + 2.5 * Math.sin(ang));
      ctx.lineTo(mx - 5.5 * Math.cos(ang + 0.55), my - 5.5 * Math.sin(ang + 0.55));
      ctx.stroke();
    }

    // 3. Precision arbor rings at each mechanical stage
    for (let i = 0; i < screenPts.length; i++) {
      const p = screenPts[i];
      ctx.fillStyle = "rgba(10, 12, 16, 0.72)";
      ctx.beginPath();
      ctx.arc(p.x, p.y, i < 4 ? 7.0 : 5.2, 0, Math.PI * 2);
      ctx.fill();

      ctx.strokeStyle = i === 0 ? "rgba(252, 218, 150, 0.98)" : "rgba(236, 198, 128, 0.92)";
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(p.x, p.y, i < 4 ? 5.8 : 4.2, 0, Math.PI * 2);
      ctx.stroke();

      ctx.fillStyle = "rgba(255, 244, 214, 0.98)";
      ctx.beginPath();
      ctx.arc(p.x, p.y, 2.2, 0, Math.PI * 2);
      ctx.fill();
    }

    // 4. Escapement impulse spark flash on pallet stone (8 Hz beat sync)
    if (kinematics.beatFrac < 0.25 && !state.paused && state.powerReserveHrs > 0.01) {
      const flash = 1 - kinematics.beatFrac / 0.25;
      const palP = screenPts[5];
      const fg = ctx.createRadialGradient(palP.x, palP.y, 1, palP.x, palP.y, 16 * flash);
      fg.addColorStop(0, `rgba(255, 118, 150, ${0.9 * flash})`);
      fg.addColorStop(0.55, `rgba(236, 190, 114, ${0.48 * flash})`);
      fg.addColorStop(1, "rgba(236, 190, 114, 0)");
      ctx.fillStyle = fg;
      ctx.beginPath();
      ctx.arc(palP.x, palP.y, 16 * flash, 0, Math.PI * 2);
      ctx.fill();
    }

    // 5. Compact left-margin Torque Legend Plate when in Exploded CAD mode (viewport-local coords!)
    if (state.explodeProgress > 0.35 && this.width >= 760) {
      const lx = 24;
      const ly = this.height - 112;
      const lw = 198;
      const lh = 92;
      ctx.fillStyle = "rgba(13, 14, 17, 0.84)";
      ctx.strokeStyle = "rgba(213, 176, 116, 0.28)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.roundRect(lx, ly, lw, lh, 2);
      ctx.fill();
      ctx.stroke();

      ctx.font = '600 9px "SF Mono", "Cascadia Mono", Consolas, monospace';
      ctx.textAlign = "left";
      ctx.textBaseline = "top";
      ctx.fillStyle = "#d9b478";
      ctx.fillText("KINEMATIC TORQUE CHAIN", lx + 10, ly + 9);

      ctx.font = '400 9px "SF Mono", "Cascadia Mono", Consolas, monospace';
      const rows = [
        ["BARREL -> CENTER", "80:12 (6.67×)"],
        ["CENTER -> THIRD", "80:10 (8.00×)"],
        ["THIRD  -> CAGE", "75:10 (7.50×)"],
        ["CAGE   -> ESCAPE", "96:6 (16.0×)"],
      ];
      rows.forEach(([k, v], idx) => {
        const ry = ly + 26 + idx * 15;
        ctx.fillStyle = "#9d968c";
        ctx.textAlign = "left";
        ctx.fillText(k, lx + 10, ry);
        ctx.fillStyle = "#ead4a8";
        ctx.textAlign = "right";
        ctx.fillText(v, lx + lw - 10, ry);
      });
    }

    ctx.restore();
  }

  _renderExplodedLayerLabels(ctx, state, alpha) {
    const layers = [
      { idx: 5, code: "L5", zMm: "+5.40 mm", title: "SAPPHIRE CRYSTAL & BEZEL" },
      { idx: 4, code: "L4", zMm: "+4.45 mm", title: "CHAPTER RING & BREGUET HANDS" },
      { idx: 3, code: "L3", zMm: "+3.50 mm", title: "CÔTES DE GENÈVE BRIDGES & 72H PR" },
      { idx: 2, code: "L2", zMm: "+2.35 mm", title: "60s TOURBILLON & 4 Hz ESCAPEMENT" },
      { idx: 1, code: "L1", zMm: "+1.15 mm", title: "INVOLUTE GOING TRAIN & BARREL" },
      { idx: 0, code: "L0", zMm: "0.00 mm", title: "ANTHRACITE PERLAGE MAINPLATE" },
    ];

    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.font = '500 10px "SF Mono", "Cascadia Mono", Consolas, monospace';
    ctx.textBaseline = "middle";
    ctx.textAlign = "left";

    const labelAnchorX = Math.min(this.width - 232, Math.max(this.width * 0.67, this.projectToCanvas(225, 0, 0, state).x + 24));

    for (const item of layers) {
      const zOff = state.layerZ[item.idx];
      const rimPt = this.projectToCanvas(218, -14, zOff, state);

      ctx.strokeStyle = "rgba(213, 176, 116, 0.42)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(rimPt.x, rimPt.y);
      ctx.lineTo(labelAnchorX - 10, rimPt.y);
      ctx.stroke();

      ctx.fillStyle = "#e4c286";
      ctx.beginPath();
      ctx.arc(rimPt.x, rimPt.y, 2.5, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = "#d9b478";
      ctx.fillText(`${item.code}  ${item.zMm}`, labelAnchorX, rimPt.y - 6.5);

      ctx.fillStyle = "#d6cfc2";
      ctx.fillText(item.title, labelAnchorX, rimPt.y + 7);
    }

    const capX = 24;
    const capY = 24;
    ctx.fillStyle = "rgba(218, 182, 120, 0.92)";
    ctx.fillText("ORTHOGRAPHIC Z-STACK · KINEMATIC TORQUE FLOW", capX, capY);
    ctx.fillStyle = "rgba(168, 162, 152, 0.85)";
    ctx.fillText("INVOLUTE α=20° · RATIO 60:1 (TRAIN) × 16:1 (TOURBILLON)", capX, capY + 15);

    ctx.restore();
  }

  _renderMacroCallouts(ctx, state, kinematics, alpha) {
    // Live world positions of rotating escapement organs inside the 60s Tourbillon Cage!
    const tc = kinematics.tourbillonAngleRad;
    const cosT = Math.cos(tc);
    const sinT = Math.sin(tc);
    const escWorld = {
      x: CALIBRE.tourbillon.x + CALIBRE.escapeLocal.x * cosT - CALIBRE.escapeLocal.y * sinT,
      y: CALIBRE.tourbillon.y + CALIBRE.escapeLocal.x * sinT + CALIBRE.escapeLocal.y * cosT,
    };
    const palWorld = {
      x: CALIBRE.tourbillon.x + CALIBRE.palletLocal.x * cosT - CALIBRE.palletLocal.y * sinT,
      y: CALIBRE.tourbillon.y + CALIBRE.palletLocal.x * sinT + CALIBRE.palletLocal.y * cosT,
    };

    const callouts = [
      {
        target: this.projectToCanvas(escWorld.x, escWorld.y, 0, state),
        boxX: 22,
        boxY: Math.round(this.height * 0.28),
        side: "left",
        kicker: "15T SWISS LEVER ESCAPE",
        detail: "CLUB-TOOTH · 16:1 PLANETARY",
      },
      {
        target: this.projectToCanvas(palWorld.x, palWorld.y, 0, state),
        boxX: 22,
        boxY: this.height - 62,
        side: "left",
        kicker: "RUBY PALLET ANCHOR",
        detail: "ENTRY & EXIT CORUNDUM STONES",
      },
      {
        target: this.projectToCanvas(CALIBRE.tourbillon.x + 20, CALIBRE.tourbillon.y - 12, 0, state),
        boxX: this.width - 240,
        boxY: 22,
        side: "right",
        kicker: "4.0 Hz FREE-SPRUNG BALANCE",
        detail: "BREATHING PHILLIPS OVERCOIL",
      },
      {
        target: this.projectToCanvas(CALIBRE.tourbillon.x + 56, CALIBRE.tourbillon.y + 42, 0, state),
        boxX: this.width - 240,
        boxY: this.height - 62,
        side: "right",
        kicker: "60s TOURBILLON CARRIAGE",
        detail: "96T FIXED FOURTH · 12 POISING WEIGHTS",
      },
    ];

    const boxW = 218;
    const boxH = 38;

    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.textBaseline = "middle";

    for (const c of callouts) {
      const anchorX = c.side === "left" ? c.boxX + boxW : c.boxX;
      const anchorY = c.boxY + boxH * 0.5;
      const elbowX = c.side === "left" ? anchorX + 18 : anchorX - 18;

      // Dark halo + crisp champagne leader line
      ctx.strokeStyle = "rgba(8, 10, 14, 0.72)";
      ctx.lineWidth = 2.6;
      ctx.beginPath();
      ctx.moveTo(c.target.x, c.target.y);
      ctx.lineTo(elbowX, anchorY);
      ctx.lineTo(anchorX, anchorY);
      ctx.stroke();

      ctx.strokeStyle = "rgba(220, 186, 126, 0.78)";
      ctx.lineWidth = 1.05;
      ctx.beginPath();
      ctx.moveTo(c.target.x, c.target.y);
      ctx.lineTo(elbowX, anchorY);
      ctx.lineTo(anchorX, anchorY);
      ctx.stroke();

      // Target jewel reticle dot
      ctx.fillStyle = "#0d0e11";
      ctx.beginPath();
      ctx.arc(c.target.x, c.target.y, 4.2, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#ead0a0";
      ctx.beginPath();
      ctx.arc(c.target.x, c.target.y, 2.5, 0, Math.PI * 2);
      ctx.fill();

      // Matte obsidian museum editorial callout plate
      ctx.fillStyle = "rgba(13, 14, 17, 0.88)";
      ctx.strokeStyle = "rgba(213, 176, 116, 0.36)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.roundRect(c.boxX, c.boxY, boxW, boxH, 2);
      ctx.fill();
      ctx.stroke();

      ctx.textAlign = "left";
      ctx.font = '600 9.5px "SF Mono", "Cascadia Mono", Consolas, monospace';
      ctx.fillStyle = "#e0bc80";
      ctx.fillText(c.kicker, c.boxX + 10, c.boxY + 13);

      ctx.font = '400 8.5px "SF Mono", "Cascadia Mono", Consolas, monospace';
      ctx.fillStyle = "#c8c1b4";
      ctx.fillText(c.detail, c.boxX + 10, c.boxY + 27);
    }

    ctx.restore();
  }
}

/**
 * Synthesized 8 Hz Swiss Lever Mechanical Tick-Tock & Crown Winding Audio Engine.
 * Strictly muted until user gesture; creates AudioContext lazily with zero autoplay warnings.
 */
export class HorologyAudioEngine {
  constructor() {
    this.ctx = null;
    this.enabled = false;
    this.noiseBuffer = null;
    this.lastBeatAudioTime = 0;
  }

  _ensureContext() {
    if (this.ctx) return this.ctx;
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return null;
    this.ctx = new AudioCtx();

    // Generate short crisp metallic impulse noise buffer (30ms)
    const length = Math.floor(this.ctx.sampleRate * 0.03);
    const buffer = this.ctx.createBuffer(1, length, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    const rng = mulberry32(8888);
    for (let i = 0; i < length; i++) {
      const env = Math.exp(-i / (this.ctx.sampleRate * 0.0028));
      data[i] = (rng() * 2 - 1) * env;
    }
    this.noiseBuffer = buffer;
    return this.ctx;
  }

  async toggle() {
    if (this.enabled) {
      this.enabled = false;
      return false;
    }
    const ctx = this._ensureContext();
    if (!ctx) return false;
    if (ctx.state === "suspended") {
      await ctx.resume();
    }
    this.enabled = true;
    return true;
  }

  /**
   * Triggers a single authentic Swiss lever escapement impulse (entry = tick, exit = tock).
   * Throttled softly at 10x fast-forward so audio remains crisp and non-clipping.
   */
  triggerBeat(isTick, amplitudeFactor = 1.0) {
    if (!this.enabled || !this.ctx || this.ctx.state !== "running") return;
    const now = this.ctx.currentTime;
    if (now - this.lastBeatAudioTime < 0.035) return; // cap at ~28 Hz during 10x fast-forward
    this.lastBeatAudioTime = now;

    const amp = Math.max(0.15, Math.min(1.0, amplitudeFactor));

    // 1. Primary ruby-pallet-on-escape-tooth locking click (subtle pitch asymmetry for tick vs tock)
    const src1 = this.ctx.createBufferSource();
    src1.buffer = this.noiseBuffer;

    const bp1 = this.ctx.createBiquadFilter();
    bp1.type = "bandpass";
    bp1.frequency.value = isTick ? 4250 : 3780;
    bp1.Q.value = 6.5;

    const g1 = this.ctx.createGain();
    g1.gain.setValueAtTime(0.24 * amp, now);
    g1.gain.exponentialRampToValueAtTime(0.0008, now + 0.011);

    src1.connect(bp1);
    bp1.connect(g1);
    g1.connect(this.ctx.destination);
    src1.start(now);
    src1.stop(now + 0.015);

    // 2. Secondary banking-pin / impulse-jewel resonance (+4.2ms micro-double-click signature of Swiss lever!)
    const osc = this.ctx.createOscillator();
    osc.type = "triangle";
    osc.frequency.setValueAtTime(isTick ? 6450 : 5920, now + 0.004);
    osc.frequency.exponentialRampToValueAtTime(2400, now + 0.012);

    const g2 = this.ctx.createGain();
    g2.gain.setValueAtTime(0.0001, now);
    g2.gain.setValueAtTime(0.065 * amp, now + 0.0042);
    g2.gain.exponentialRampToValueAtTime(0.0004, now + 0.014);

    osc.connect(g2);
    g2.connect(this.ctx.destination);
    osc.start(now + 0.004);
    osc.stop(now + 0.016);
  }

  /**
   * Synthesizes a tactile ratchet-and-click winding snap when rotating the crown.
   */
  triggerWindingClick() {
    if (!this.enabled || !this.ctx || this.ctx.state !== "running") return;
    const now = this.ctx.currentTime;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuffer;

    const bp = this.ctx.createBiquadFilter();
    bp.type = "bandpass";
    bp.frequency.value = 2850;
    bp.Q.value = 5.2;

    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.18, now);
    g.gain.exponentialRampToValueAtTime(0.0008, now + 0.014);

    src.connect(bp);
    bp.connect(g);
    g.connect(this.ctx.destination);
    src.start(now);
    src.stop(now + 0.018);
  }
}
