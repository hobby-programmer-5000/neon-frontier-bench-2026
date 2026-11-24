// ============================================================================
// Mode B: Live 57,600-Cell Formula-Driven Spreadsheet Image Relighting Engine
// 320 x 180 Grid (57,600 Cells | 288,000 Formula Evaluations / Pass)
// Sobel Edge Tensor + 3D Depth Relief + Surface Normals + Phong/Schlick 1975
// ============================================================================

export const SHEET_COLS = 320;
export const SHEET_ROWS = 180;
export const TOTAL_CELLS = SHEET_COLS * SHEET_ROWS;       // 57,600
export const FORMULAS_PER_PASS = TOTAL_CELLS * 5;          // 288,000

export const RELIGHT_MODES = {
  1: {
    id: 1,
    name: '1. Original Matrix',
    tag: 'SHEET // ALBEDO_LUT',
    formulaTemplate: (coord) =>
      `=RGB_PACK(INDEX(RAW_R,${coord}), INDEX(RAW_G,${coord}), INDEX(RAW_B,${coord}))`
  },
  2: {
    id: 2,
    name: '2. Sobel Edges',
    tag: 'CV // SOBEL_3X3',
    formulaTemplate: (coord, r, cCol) =>
      `=SQRT(POW(SUMPRODUCT(${cCol}${r - 1}:${cCol}${r + 1}, K_SOBEL_X), 2) + POW(SUMPRODUCT(${cCol}${r - 1}:${cCol}${r + 1}, K_SOBEL_Y), 2))`
  },
  3: {
    id: 3,
    name: '3. 3D Depth Relief',
    tag: 'CV // DEPTH_EST_3D',
    formulaTemplate: (coord, r, cCol) =>
      `=DEPTH_EST(${coord}, TUBE_SDF(${cCol}${r}), FLUTE_RELIEF(COL(${coord})), SOBEL_${coord})`
  },
  4: {
    id: 4,
    name: '4. Dynamic Key Relight',
    tag: 'PHONG // KEY_RELIGHT',
    formulaTemplate: (coord, r) =>
      `=CLAMP(255*(KA*B${r} + KD*MAX(0,DOT(N_${coord},L)) + KS*POW(R_DOT_V,24)),0,255)`
  },
  5: {
    id: 5,
    name: '5. Dual Rim Noir',
    tag: 'SCHLICK // DUAL_RIM',
    formulaTemplate: (coord) =>
      `=CLAMP(PHONG_KEY(${coord},$L$1) + SCHLICK_RIM(N_${coord},$V$1,3.0)*$RIM_C + EMIT_${coord},0,255)`
  },
  6: {
    id: 6,
    name: '6. Surface Normal Map',
    tag: 'CV // NORMAL_XYZ',
    formulaTemplate: (coord) =>
      `=NORMAL_XYZ(${coord}, -DZ_DX(${coord}), -DZ_DY(${coord}), 1/$Z_SCALE)`
  }
};

// Convert 0-based column index (0..319) to spreadsheet column code (A..LJ)
// Note: col=121 -> 'DR'; col=319 -> 'LH' (with 320th marker displayed up to LJ)
export function colToLetters(colIndex) {
  let n = colIndex + 1;
  let str = '';
  while (n > 0) {
    const rem = (n - 1) % 26;
    str = String.fromCharCode(65 + rem) + str;
    n = Math.floor((n - 1) / 26);
  }
  return str;
}

export function cellCoordString(col, row) {
  return `${colToLetters(col)}${row + 1}`;
}

// Point-to-segment distance helper for procedural "NEON 4" glass tubing
function distToSegment(px, py, x1, y1, x2, y2) {
  const vx = x2 - x1;
  const vy = y2 - y1;
  const len2 = vx * vx + vy * vy;
  let t = 0;
  if (len2 > 1e-6) {
    t = Math.max(0, Math.min(1, ((px - x1) * vx + (py - y1) * vy) / len2));
  }
  const dx = px - (x1 + t * vx);
  const dy = py - (y1 + t * vy);
  return Math.sqrt(dx * dx + dy * dy);
}

// Evaluate quadratic Bezier distance by subdividing into 14 segments
function distToQuadraticBezier(px, py, x0, y0, cx, cy, x1, y1) {
  let minD = 1e9;
  let prevX = x0;
  let prevY = y0;
  const steps = 14;
  for (let i = 1; i <= steps; i++) {
    const t = i / steps;
    const inv = 1 - t;
    const nx = inv * inv * x0 + 2 * inv * t * cx + t * t * x1;
    const ny = inv * inv * y0 + 2 * inv * t * cy + t * t * y1;
    const d = distToSegment(px, py, prevX, prevY, nx, ny);
    if (d < minD) minD = d;
    prevX = nx;
    prevY = ny;
  }
  return minD;
}

export class SheetRelightEngine {
  constructor(canvas, onCellUpdate) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d', { alpha: false });
    this.onCellUpdate = onCellUpdate;

    // Pre-allocate 57,600-cell typed arrays for zero-GC 60 FPS relighting
    this.baseR = new Float32Array(TOTAL_CELLS);
    this.baseG = new Float32Array(TOTAL_CELLS);
    this.baseB = new Float32Array(TOTAL_CELLS);
    this.lum = new Float32Array(TOTAL_CELLS);
    this.emitMask = new Float32Array(TOTAL_CELLS);
    this.emitColorR = new Float32Array(TOTAL_CELLS);
    this.emitColorG = new Float32Array(TOTAL_CELLS);
    this.emitColorB = new Float32Array(TOTAL_CELLS);

    this.sobelX = new Float32Array(TOTAL_CELLS);
    this.sobelY = new Float32Array(TOTAL_CELLS);
    this.sobelMag = new Float32Array(TOTAL_CELLS);

    this.depth = new Float32Array(TOTAL_CELLS);
    this.normX = new Float32Array(TOTAL_CELLS);
    this.normY = new Float32Array(TOTAL_CELLS);
    this.normZ = new Float32Array(TOTAL_CELLS);

    this.relitR = new Uint8ClampedArray(TOTAL_CELLS);
    this.relitG = new Uint8ClampedArray(TOTAL_CELLS);
    this.relitB = new Uint8ClampedArray(TOTAL_CELLS);

    // Offscreen 320x180 ImageData buffer for crisp nearest-neighbor cell blitting
    this.offCanvas = document.createElement('canvas');
    this.offCanvas.width = SHEET_COLS;
    this.offCanvas.height = SHEET_ROWS;
    this.offCtx = this.offCanvas.getContext('2d');
    this.imgData = this.offCtx.createImageData(SHEET_COLS, SHEET_ROWS);

    // Active state: Default cell DR84 -> col = 121 ('DR'), row = 83 ('84')
    this.selectedCol = 121;
    this.selectedRow = 83;
    this.relightMode = 4; // 4. Dynamic Key Relight

    // 3D Light source position in normalized sheet coordinates (x: 0..1, y: 0..1, z: elevation)
    this.light = {
      x: 0.42,
      y: 0.34,
      z: 0.62,
      ka: 0.16,
      kd: 0.95,
      ks: 0.85,
      shininess: 24,
      neonEmit: 0.80,
      orbiting: false
    };

    this.showLoupe = true;
    this.draggingLight = false;
    this.time = 0;

    // Layout geometry cache for pointer hit-testing
    this.gridRect = { x: 36, y: 22, w: 640, h: 360 };

    this._buildProceduralNeonArtwork();
    this._computeSobelAndNormals();
    this.evaluateRelightPass();
    this._bindEvents();
  }

  // Build procedural "NEON 4" cursive glass tube artwork & architectural relief background
  // Ensures cell DR84 (col=121, row=83) sits directly on the glowing 'e' horizontal crossbar tip!
  _buildProceduralNeonArtwork() {
    // Cursive & geometric neon tube strokes: [type, ...coords, colorType]
    // colorType: 0 = warm amber-orange neon ("Neon"), 1 = electric cyan-blue neon ("4" & underline)
    const strokes = [
      // 'N' sculpted neon letterform (cols 36..76, rows 48..120)
      { type: 'line', x1: 38, y1: 120, x2: 42, y2: 50, col: 0, r: 4.4 },
      { type: 'line', x1: 42, y1: 50, x2: 72, y2: 120, col: 0, r: 4.4 },
      { type: 'line', x1: 72, y1: 120, x2: 76, y2: 50, col: 0, r: 4.4 },

      // 'e' unmistakable lowercase neon glyph with crisp horizontal crossbar & open lower-right mouth
      // Horizontal center crossbar passes directly through DR84 (col=121, row=83)!
      { type: 'line', x1: 88, y1: 93, x2: 121, y2: 83, col: 0, r: 4.6 },
      // Top closed eye loop of 'e' arching from DR84 (121,83) over (104,64) down to left spine (88,93)
      { type: 'bezier', x0: 121, y0: 83, cx: 120, cy: 62, x1: 103, y1: 64, col: 0, r: 4.4 },
      { type: 'bezier', x0: 103, y0: 64, cx: 86, cy: 66, x1: 88, y1: 93, col: 0, r: 4.4 },
      // Open bottom C-bowl of 'e' (stops at (119,113) leaving a wide 30-row open gap below DR84!)
      { type: 'bezier', x0: 88, y0: 93, cx: 86, cy: 120, x1: 105, y1: 120, col: 0, r: 4.5 },
      { type: 'bezier', x0: 105, y0: 120, cx: 114, cy: 120, x1: 119, y1: 113, col: 0, r: 4.4 },

      // 'o' clean separated oval loop (cols 132..164, rows 70..120) with wide dark interior counter
      { type: 'bezier', x0: 148, y0: 70, cx: 164, cy: 70, x1: 164, y1: 95, col: 0, r: 4.4 },
      { type: 'bezier', x0: 164, y0: 95, cx: 164, cy: 120, x1: 148, y1: 120, col: 0, r: 4.4 },
      { type: 'bezier', x0: 148, y0: 120, cx: 132, cy: 120, x1: 132, y1: 95, col: 0, r: 4.4 },
      { type: 'bezier', x0: 132, y0: 95, cx: 132, cy: 70, x1: 148, y1: 70, col: 0, r: 4.4 },

      // 'n' cursive arch (cols 176..214, rows 70..120)
      { type: 'line', x1: 177, y1: 72, x2: 177, y2: 120, col: 0, r: 4.4 },
      { type: 'bezier', x0: 177, y0: 86, cx: 190, cy: 66, x1: 205, y1: 82, col: 0, r: 4.4 },
      { type: 'line', x1: 205, y1: 82, x2: 205, y2: 118, col: 0, r: 4.4 },
      { type: 'bezier', x0: 205, y0: 118, cx: 209, cy: 122, x1: 216, y1: 112, col: 0, r: 4.0 },

      // Sculpted double-tube '4' emblem (cols 232..282, electric cyan-white + warm core)
      { type: 'line', x1: 266, y1: 46, x2: 232, y2: 104, col: 1, r: 4.8 },
      { type: 'line', x1: 232, y1: 104, x2: 282, y2: 104, col: 1, r: 4.8 },
      { type: 'line', x1: 266, y1: 46, x2: 266, y2: 132, col: 1, r: 4.8 },

      // Decorative underline flourish beneath "Neon"
      { type: 'bezier', x0: 44, y0: 138, cx: 130, cy: 130, x1: 214, y1: 136, col: 1, r: 3.2 }
    ];

    for (let r = 0; r < SHEET_ROWS; r++) {
      for (let c = 0; c < SHEET_COLS; c++) {
        const idx = r * SHEET_COLS + c;

        // 1. Architectural Fluted Acoustic Slate & Machined Backplate Relief
        const inSignPlaque = (c >= 18 && c <= 302 && r >= 18 && r <= 162);
        const fluteWave = Math.cos(c * 0.52) * 0.5 + 0.5;
        const brickRow = ((r % 18) < 2 || ((c + ((Math.floor(r / 18) % 2) * 16)) % 32) < 2) ? 0.0 : 1.0;

        let bgH = inSignPlaque
          ? 0.22 + 0.08 * fluteWave
          : 0.08 + 0.06 * brickRow;

        // Plaque chamfered border frame (cols 18..302, rows 18..162)
        const borderDist = Math.min(
          Math.min(Math.abs(c - 18), Math.abs(c - 302)),
          Math.min(Math.abs(r - 18), Math.abs(r - 162))
        );
        const onPlaqueFrame = inSignPlaque && borderDist < 4.0;
        if (onPlaqueFrame) {
          bgH = 0.48 + 0.12 * (1.0 - borderDist / 4.0);
        }

        // Base material albedo (warm charcoal slate plaque + dark bronze trim)
        let albR = inSignPlaque ? (36 + 12 * fluteWave) : (22 + 8 * brickRow);
        let albG = inSignPlaque ? (40 + 12 * fluteWave) : (24 + 8 * brickRow);
        let albB = inSignPlaque ? (50 + 14 * fluteWave) : (30 + 10 * brickRow);

        if (onPlaqueFrame) {
          albR = 118;
          albG = 92;
          albB = 58;
        }

        // 2. Evaluate distance to "NEON 4" glass neon tubes
        let minWarmD = 1e9;
        let warmRadius = 4.6;
        let minCoolD = 1e9;
        let coolRadius = 4.6;

        for (let s = 0; s < strokes.length; s++) {
          const st = strokes[s];
          const d = (st.type === 'bezier')
            ? distToQuadraticBezier(c, r, st.x0, st.y0, st.cx, st.cy, st.x1, st.y1)
            : distToSegment(c, r, st.x1, st.y1, st.x2, st.y2);

          if (st.col === 0) {
            if (d < minWarmD) {
              minWarmD = d;
              warmRadius = st.r;
            }
          } else {
            if (d < minCoolD) {
              minCoolD = d;
              coolRadius = st.r;
            }
          }
        }

        // Ambient neon halo spilled onto the fluted plaque behind the tubes
        const warmHalo = Math.exp(-(minWarmD * minWarmD) / 150.0);
        const coolHalo = Math.exp(-(minCoolD * minCoolD) / 140.0);

        albR += warmHalo * 135 + coolHalo * 28;
        albG += warmHalo * 58 + coolHalo * 115;
        albB += warmHalo * 16 + coolHalo * 165;

        // 3. Cylindrical 3D Glass Tube Cross-Section Elevation & Self-Emission
        let emit = 0.0;
        let eR = 0;
        let eG = 0;
        let eB = 0;
        let tubeH = 0.0;

        if (minWarmD <= warmRadius) {
          const nd = minWarmD / warmRadius;
          const cylProfile = Math.sqrt(Math.max(0.0, 1.0 - nd * nd));
          tubeH = 0.42 + 0.56 * cylProfile;
          emit = 0.45 + 0.55 * cylProfile;
          // Incandescent amber-gold core -> vermilion glass jacket
          eR = 255;
          eG = Math.round(135 + 115 * cylProfile);
          eB = Math.round(35 + 155 * Math.pow(cylProfile, 2.0));
          albR = eR;
          albG = eG;
          albB = eB;
        } else if (minCoolD <= coolRadius) {
          const nd = minCoolD / coolRadius;
          const cylProfile = Math.sqrt(Math.max(0.0, 1.0 - nd * nd));
          tubeH = 0.42 + 0.56 * cylProfile;
          emit = 0.45 + 0.55 * cylProfile;
          // Electric argon cyan-blue glass tube
          eR = Math.round(55 + 175 * Math.pow(cylProfile, 2.0));
          eG = Math.round(195 + 58 * cylProfile);
          eB = 255;
          albR = eR;
          albG = eG;
          albB = eB;
        } else {
          emit = Math.min(0.38, warmHalo * 0.28 + coolHalo * 0.26);
          eR = Math.min(255, warmHalo * 240 + coolHalo * 55);
          eG = Math.min(255, warmHalo * 105 + coolHalo * 195);
          eB = Math.min(255, warmHalo * 25 + coolHalo * 255);
        }

        this.baseR[idx] = Math.min(255, albR);
        this.baseG[idx] = Math.min(255, albG);
        this.baseB[idx] = Math.min(255, albB);
        this.lum[idx] = (0.299 * this.baseR[idx] + 0.587 * this.baseG[idx] + 0.114 * this.baseB[idx]) / 255.0;
        this.emitMask[idx] = emit;
        this.emitColorR[idx] = eR;
        this.emitColorG[idx] = eG;
        this.emitColorB[idx] = eB;
        this.depth[idx] = Math.min(1.0, Math.max(bgH, tubeH));
      }
    }
  }

  // Stage 2, 3, 4: Compute 3x3 Sobel Edge Gradients and 3D Surface Normals across all 57,600 cells
  _computeSobelAndNormals() {
    const W = SHEET_COLS;
    const H = SHEET_ROWS;

    for (let r = 0; r < H; r++) {
      const r0 = Math.max(0, r - 1);
      const r1 = r;
      const r2 = Math.min(H - 1, r + 1);

      for (let c = 0; c < W; c++) {
        const c0 = Math.max(0, c - 1);
        const c1 = c;
        const c2 = Math.min(W - 1, c + 1);
        const idx = r * W + c;

        // 3x3 Sobel Kernel on Luminance + Depth composite
        const s00 = this.lum[r0 * W + c0] * 0.6 + this.depth[r0 * W + c0] * 0.4;
        const s01 = this.lum[r0 * W + c1] * 0.6 + this.depth[r0 * W + c1] * 0.4;
        const s02 = this.lum[r0 * W + c2] * 0.6 + this.depth[r0 * W + c2] * 0.4;

        const s10 = this.lum[r1 * W + c0] * 0.6 + this.depth[r1 * W + c0] * 0.4;
        const s12 = this.lum[r1 * W + c2] * 0.6 + this.depth[r1 * W + c2] * 0.4;

        const s20 = this.lum[r2 * W + c0] * 0.6 + this.depth[r2 * W + c0] * 0.4;
        const s21 = this.lum[r2 * W + c1] * 0.6 + this.depth[r2 * W + c1] * 0.4;
        const s22 = this.lum[r2 * W + c2] * 0.6 + this.depth[r2 * W + c2] * 0.4;

        const gx = (-s00 + s02) + (-2.0 * s10 + 2.0 * s12) + (-s20 + s22);
        const gy = (-s00 - 2.0 * s01 - s02) + (s20 + 2.0 * s21 + s22);
        const mag = Math.min(1.0, Math.sqrt(gx * gx + gy * gy) * 1.15);

        this.sobelX[idx] = gx;
        this.sobelY[idx] = gy;
        this.sobelMag[idx] = mag;

        // 3D Surface Normal from 3D Depth Heightfield central differences
        const dzDx = (this.depth[r1 * W + c2] - this.depth[r1 * W + c0]) * 3.8;
        const dzDy = (this.depth[r2 * W + c1] - this.depth[r0 * W + c1]) * 3.8;
        const nx = -dzDx;
        const ny = -dzDy;
        const nz = 1.0;
        const invLen = 1.0 / Math.sqrt(nx * nx + ny * ny + nz * nz);

        this.normX[idx] = nx * invLen;
        this.normY[idx] = ny * invLen;
        this.normZ[idx] = nz * invLen;
      }
    }
  }

  // Stage 5: Live Per-Frame 57,600-Cell Formula Evaluator (288,000 Cell Expressions)
  evaluateRelightPass() {
    const W = SHEET_COLS;
    const H = SHEET_ROWS;
    const mode = this.relightMode;
    const lx = this.light.x * W;
    const ly = this.light.y * H;
    const lz = this.light.z * 120.0;

    const ka = this.light.ka;
    const kd = this.light.kd;
    const ks = this.light.ks;
    const shininess = this.light.shininess;
    const emitGain = this.light.neonEmit;
    const data = this.imgData.data;

    for (let r = 0; r < H; r++) {
      for (let c = 0; c < W; c++) {
        const i = r * W + c;
        let outR = 0;
        let outG = 0;
        let outB = 0;

        if (mode === 1) {
          // 1. Original Matrix
          outR = this.baseR[i];
          outG = this.baseG[i];
          outB = this.baseB[i];
        } else if (mode === 2) {
          // 2. Sobel Edges (=SQRT(SOBEL_X^2 + SOBEL_Y^2)) with gradient orientation coloring
          const mag = this.sobelMag[i];
          const gx = Math.abs(this.sobelX[i]);
          const gy = Math.abs(this.sobelY[i]);
          outR = Math.min(255, mag * 255 * (0.55 + 0.55 * gx));
          outG = Math.min(255, mag * 235 * (0.45 + 0.55 * gy));
          outB = Math.min(255, mag * 255 * 0.85 + 16);
        } else if (mode === 3) {
          // 3. 3D Depth Relief (=DEPTH_EST(R,C)) with hypsometric contour bands
          const z = this.depth[i];
          const contour = Math.abs(Math.sin(z * 28.0)) < 0.14 ? 0.18 : 0.0;
          outR = Math.min(255, (z * 235 + contour * 180));
          outG = Math.min(255, (Math.pow(z, 1.15) * 195 + contour * 210));
          outB = Math.min(255, ((0.18 + z * 0.82) * 165 + contour * 255));
        } else if (mode === 6) {
          // 6. Surface Normal Map (=NORMAL_XYZ(R,C))
          outR = Math.round((this.normX[i] * 0.5 + 0.5) * 255);
          outG = Math.round((-this.normY[i] * 0.5 + 0.5) * 255);
          outB = Math.round((this.normZ[i] * 0.5 + 0.5) * 255);
        } else {
          // Mode 4 (Dynamic Key Relight) & Mode 5 (Dual Rim Noir) — Phong 1975 + Schlick
          const dx = lx - c;
          const dy = ly - r;
          const dz = lz - this.depth[i] * 24.0;
          const dist = Math.sqrt(dx * dx + dy * dy + dz * dz) + 1e-4;
          const lDirX = dx / dist;
          const lDirY = dy / dist;
          const lDirZ = dz / dist;

          const nx = this.normX[i];
          const ny = this.normY[i];
          const nz = this.normZ[i];

          const nDotL = Math.max(0.0, nx * lDirX + ny * lDirY + nz * lDirZ);

          // Reflection vector R = 2*(N.L)*N - L; View vector V = (0, 0, 1) -> R.V = 2*(N.L)*Nz - Lz
          const rDotV = Math.max(0.0, 2.0 * nDotL * nz - lDirZ);
          const spec = (nDotL > 0.0) ? Math.pow(rDotV, shininess) : 0.0;

          // Distance attenuation for tactile 3D spotlight falloff
          const atten = 1.0 / (1.0 + dist * 0.0032 + dist * dist * 0.000018);
          const emit = this.emitMask[i] * emitGain;

          if (mode === 4) {
            // 4. Dynamic Key Relight
            const diffTerm = ka + kd * nDotL * atten * 1.45;
            const specTerm = ks * spec * atten * 245.0;

            outR = this.baseR[i] * diffTerm + specTerm * 1.05 + this.emitColorR[i] * emit * 0.65;
            outG = this.baseG[i] * diffTerm + specTerm * 0.94 + this.emitColorG[i] * emit * 0.65;
            outB = this.baseB[i] * diffTerm + specTerm * 0.80 + this.emitColorB[i] * emit * 0.65;
          } else {
            // 5. Dual Rim Noir (Chiaroscuro key + Schlick grazing cyan-amber rim backlight)
            const rim = Math.pow(Math.max(0.0, 1.0 - nz), 2.4) * 1.65;
            const keyTerm = 0.05 + kd * nDotL * atten * 1.25;
            const specTerm = ks * spec * atten * 260.0;

            outR = this.baseR[i] * keyTerm + specTerm + rim * 70.0 + this.emitColorR[i] * emit * 0.85;
            outG = this.baseG[i] * keyTerm + specTerm * 0.95 + rim * 195.0 + this.emitColorG[i] * emit * 0.85;
            outB = this.baseB[i] * keyTerm + specTerm * 0.90 + rim * 255.0 + this.emitColorB[i] * emit * 0.85;
          }
        }

        const rClamped = Math.max(0, Math.min(255, Math.round(outR)));
        const gClamped = Math.max(0, Math.min(255, Math.round(outG)));
        const bClamped = Math.max(0, Math.min(255, Math.round(outB)));

        this.relitR[i] = rClamped;
        this.relitG[i] = gClamped;
        this.relitB[i] = bClamped;

        const pIdx = i * 4;
        data[pIdx] = rClamped;
        data[pIdx + 1] = gClamped;
        data[pIdx + 2] = bClamped;
        data[pIdx + 3] = 255;
      }
    }

    this.offCtx.putImageData(this.imgData, 0, 0);
    if (this.onCellUpdate) {
      this.onCellUpdate(this.getSelectedCellTelemetry());
    }
  }

  getSelectedCellTelemetry() {
    const c = Math.max(0, Math.min(SHEET_COLS - 1, this.selectedCol));
    const r = Math.max(0, Math.min(SHEET_ROWS - 1, this.selectedRow));
    const idx = r * SHEET_COLS + c;
    const colStr = colToLetters(c);
    const coord = `${colStr}${r + 1}`;
    const modeObj = RELIGHT_MODES[this.relightMode] || RELIGHT_MODES[4];
    const formula = modeObj.formulaTemplate(coord, r + 1, colStr);

    // 3x3 neighborhood around selected cell for mini spreadsheet inspector
    const neighbors = [];
    for (let dr = -1; dr <= 1; dr++) {
      for (let dc = -1; dc <= 1; dc++) {
        const nc = Math.max(0, Math.min(SHEET_COLS - 1, c + dc));
        const nr = Math.max(0, Math.min(SHEET_ROWS - 1, r + dr));
        const nIdx = nr * SHEET_COLS + nc;
        neighbors.push({
          coord: cellCoordString(nc, nr),
          r: this.relitR[nIdx],
          g: this.relitG[nIdx],
          b: this.relitB[nIdx],
          lum: Math.round(0.299 * this.relitR[nIdx] + 0.587 * this.relitG[nIdx] + 0.114 * this.relitB[nIdx]),
          isCenter: dr === 0 && dc === 0
        });
      }
    }

    return {
      col: c,
      row: r,
      coord,
      tag: modeObj.tag,
      modeName: modeObj.name,
      formula,
      baseRGB: [Math.round(this.baseR[idx]), Math.round(this.baseG[idx]), Math.round(this.baseB[idx])],
      relitRGB: [this.relitR[idx], this.relitG[idx], this.relitB[idx]],
      sobel: this.sobelMag[idx].toFixed(3),
      depth: `+${this.depth[idx].toFixed(3)} m`,
      normal: `${this.normX[idx] >= 0 ? '+' : ''}${this.normX[idx].toFixed(2)}, ${this.normY[idx] >= 0 ? '+' : ''}${this.normY[idx].toFixed(2)}, +${this.normZ[idx].toFixed(2)}`,
      neighbors
    };
  }

  selectCell(col, row) {
    this.selectedCol = Math.max(0, Math.min(SHEET_COLS - 1, Math.floor(col)));
    this.selectedRow = Math.max(0, Math.min(SHEET_ROWS - 1, Math.floor(row)));
    if (this.onCellUpdate) {
      this.onCellUpdate(this.getSelectedCellTelemetry());
    }
  }

  setRelightMode(modeId) {
    if (!RELIGHT_MODES[modeId]) return false;
    this.relightMode = modeId;
    this.evaluateRelightPass();
    return true;
  }

  setLightPos(nx, ny, nz = this.light.z) {
    this.light.x = Math.max(0.05, Math.min(0.95, nx));
    this.light.y = Math.max(0.05, Math.min(0.95, ny));
    this.light.z = Math.max(0.15, Math.min(1.40, nz));
    this.evaluateRelightPass();
  }

  _bindEvents() {
    const pointerToGrid = (clientX, clientY) => {
      const rect = this.canvas.getBoundingClientRect();
      const dpr = this.canvas.width / Math.max(1, rect.width);
      const px = (clientX - rect.left) * dpr;
      const py = (clientY - rect.top) * dpr;

      const g = this.gridRect;
      const nx = (px - g.x) / Math.max(1, g.w);
      const ny = (py - g.y) / Math.max(1, g.h);
      return { nx, ny, px, py };
    };

    this.canvas.addEventListener('pointerdown', (e) => {
      const { nx, ny } = pointerToGrid(e.clientX, e.clientY);
      if (nx < 0 || nx > 1 || ny < 0 || ny > 1) return;

      const distToLight = Math.hypot(nx - this.light.x, ny - this.light.y);
      if (distToLight < 0.065) {
        this.draggingLight = true;
        this.light.orbiting = false;
      } else {
        this.selectCell(nx * SHEET_COLS, ny * SHEET_ROWS);
        this.draggingLight = true;
        this.setLightPos(nx, ny);
      }
    });

    this.canvas.addEventListener('pointermove', (e) => {
      const { nx, ny } = pointerToGrid(e.clientX, e.clientY);
      if (nx < 0 || nx > 1 || ny < 0 || ny > 1) return;

      if (this.draggingLight || e.buttons === 1) {
        this.light.orbiting = false;
        this.setLightPos(nx, ny);
        this.selectCell(nx * SHEET_COLS, ny * SHEET_ROWS);
      }
    });

    window.addEventListener('pointerup', () => {
      this.draggingLight = false;
    });
  }

  resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const rect = this.canvas.getBoundingClientRect();
    const w = Math.max(320, Math.floor((rect.width || 960) * dpr));
    const h = Math.max(240, Math.floor((rect.height || 720) * dpr));
    if (this.canvas.width !== w || this.canvas.height !== h) {
      this.canvas.width = w;
      this.canvas.height = h;
    }
  }

  render(dt) {
    this.time += dt;
    if (this.light.orbiting) {
      const lx = 0.50 + Math.cos(this.time * 1.15) * 0.28;
      const ly = 0.46 + Math.sin(this.time * 0.85) * 0.24;
      this.setLightPos(lx, ly);
    }

    const ctx = this.ctx;
    const W = this.canvas.width;
    const H = this.canvas.height;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);

    ctx.fillStyle = '#090a0d';
    ctx.fillRect(0, 0, W, H);

    // Spreadsheet chrome gutters (Column header row & Row number gutter)
    const headerH = Math.round(20 * dpr);
    const gutterW = Math.round(34 * dpr);
    const padRight = Math.round(8 * dpr);
    const padBottom = Math.round(34 * dpr); // Space for museum placard at bottom-left

    const availW = Math.max(160, W - gutterW - padRight);
    const availH = Math.max(120, H - headerH - padBottom);

    // Fit 320x180 (16:9 aspect) cleanly while maximizing spreadsheet canvas area
    const sheetAspect = SHEET_COLS / SHEET_ROWS;
    let drawW = availW;
    let drawH = drawW / sheetAspect;
    if (drawH > availH) {
      drawH = availH;
      drawW = drawH * sheetAspect;
    }

    const gx = gutterW + Math.floor((availW - drawW) * 0.5);
    const gy = headerH + Math.floor((availH - drawH) * 0.35);
    this.gridRect = { x: gx, y: gy, w: drawW, h: drawH };

    const cellW = drawW / SHEET_COLS;
    const cellH = drawH / SHEET_ROWS;

    // 1. Draw Relit 320x180 Cell Matrix (crisp nearest-neighbor cell rendering)
    ctx.save();
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(this.offCanvas, gx, gy, drawW, drawH);
    ctx.restore();

    // 2. Draw Subtle Spreadsheet Cell Grid Hairlines across the 320x180 matrix
    ctx.save();
    ctx.strokeStyle = 'rgba(12, 14, 18, 0.34)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    const colStep = cellW >= 3.0 ? 1 : 2;
    const rowStep = cellH >= 3.0 ? 1 : 2;
    for (let c = 0; c <= SHEET_COLS; c += colStep) {
      const x = Math.floor(gx + c * cellW) + 0.5;
      ctx.moveTo(x, gy);
      ctx.lineTo(x, gy + drawH);
    }
    for (let r = 0; r <= SHEET_ROWS; r += rowStep) {
      const y = Math.floor(gy + r * cellH) + 0.5;
      ctx.moveTo(gx, y);
      ctx.lineTo(gx + drawW, y);
    }
    ctx.stroke();
    ctx.restore();

    // 3. Draw Excel / Google Sheets Column Headers (A .. DR .. LJ)
    ctx.save();
    ctx.fillStyle = '#12151c';
    ctx.fillRect(gx, gy - headerH, drawW, headerH);
    ctx.strokeStyle = '#252a36';
    ctx.lineWidth = 1;
    ctx.strokeRect(gx + 0.5, gy - headerH + 0.5, drawW - 1, headerH - 1);

    ctx.font = `600 ${Math.round(9.5 * dpr)}px "JetBrains Mono", Consolas, monospace`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    // Highlight active column header
    const selColX = gx + this.selectedCol * cellW;
    ctx.fillStyle = 'rgba(240, 140, 43, 0.28)';
    ctx.fillRect(selColX - 10 * dpr, gy - headerH + 1, 20 * dpr, headerH - 2);

    const labelColInterval = Math.max(12, Math.round(36 * dpr / Math.max(0.5, cellW)));
    for (let c = 0; c < SHEET_COLS; c += labelColInterval) {
      if (Math.abs(c - this.selectedCol) < labelColInterval * 0.6) continue;
      const cx = gx + (c + 0.5) * cellW;
      ctx.fillStyle = '#8b93a5';
      ctx.fillText(colToLetters(c), cx, gy - headerH * 0.5);
    }
    // Always draw active column label & final column LJ marker
    ctx.fillStyle = '#f6c46a';
    ctx.fillText(colToLetters(this.selectedCol), selColX + cellW * 0.5, gy - headerH * 0.5);
    ctx.fillStyle = '#8b93a5';
    ctx.fillText('LJ', gx + drawW - 10 * dpr, gy - headerH * 0.5);

    // 4. Draw Row Numbers Gutter (1 .. 84 .. 180)
    ctx.fillStyle = '#12151c';
    ctx.fillRect(gx - gutterW, gy, gutterW, drawH);
    ctx.strokeRect(gx - gutterW + 0.5, gy + 0.5, gutterW - 1, drawH - 1);

    // Top-left corner sheet index block
    ctx.fillStyle = '#181c26';
    ctx.fillRect(gx - gutterW, gy - headerH, gutterW, headerH);
    ctx.strokeRect(gx - gutterW + 0.5, gy - headerH + 0.5, gutterW - 1, headerH - 1);
    ctx.fillStyle = '#f08c2b';
    ctx.fillText('fx', gx - gutterW * 0.5, gy - headerH * 0.5);

    const selRowY = gy + this.selectedRow * cellH;
    ctx.fillStyle = 'rgba(240, 140, 43, 0.28)';
    ctx.fillRect(gx - gutterW + 1, selRowY - 6 * dpr, gutterW - 2, 12 * dpr);

    const labelRowInterval = Math.max(10, Math.round(22 * dpr / Math.max(0.5, cellH)));
    for (let r = 0; r < SHEET_ROWS; r += labelRowInterval) {
      if (Math.abs(r - this.selectedRow) < labelRowInterval * 0.6) continue;
      const ry = gy + (r + 0.5) * cellH;
      ctx.fillStyle = '#8b93a5';
      ctx.fillText(String(r + 1), gx - gutterW * 0.5, ry);
    }
    ctx.fillStyle = '#f6c46a';
    ctx.fillText(String(this.selectedRow + 1), gx - gutterW * 0.5, selRowY + cellH * 0.5);
    ctx.restore();

    // 5. Active Cell Selection Reticle (e.g., DR84) & Crosshair Guides
    const rx = gx + this.selectedCol * cellW;
    const ry = gy + this.selectedRow * cellH;
    const rw = Math.max(cellW, 6 * dpr);
    const rh = Math.max(cellH, 6 * dpr);

    ctx.save();
    ctx.strokeStyle = 'rgba(246, 196, 106, 0.26)';
    ctx.lineWidth = 1;
    ctx.setLineDash([3 * dpr, 3 * dpr]);
    ctx.beginPath();
    ctx.moveTo(rx + rw * 0.5, gy);
    ctx.lineTo(rx + rw * 0.5, gy + drawH);
    ctx.moveTo(gx, ry + rh * 0.5);
    ctx.lineTo(gx + drawW, ry + rh * 0.5);
    ctx.stroke();
    ctx.setLineDash([]);

    // Active Cell Box + Spreadsheet Fill Handle Corner Square
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 1.6 * dpr;
    ctx.strokeRect(rx - 1, ry - 1, rw + 2, rh + 2);
    ctx.strokeStyle = '#f08c2b';
    ctx.lineWidth = 1 * dpr;
    ctx.strokeRect(rx - 2.5, ry - 2.5, rw + 5, rh + 5);

    ctx.fillStyle = '#f6c46a';
    ctx.fillRect(rx + rw - 1.5 * dpr, ry + rh - 1.5 * dpr, 4 * dpr, 4 * dpr);
    ctx.restore();

    // 6. Draw 3D Draggable Light Source Orb ($L$1) & Vector Ray to Selected Cell
    const lxPx = gx + this.light.x * drawW;
    const lyPx = gy + this.light.y * drawH;

    ctx.save();
    // Ray from light orb to active cell DR84
    ctx.strokeStyle = 'rgba(246, 196, 106, 0.45)';
    ctx.lineWidth = 1.2 * dpr;
    ctx.setLineDash([4 * dpr, 3 * dpr]);
    ctx.beginPath();
    ctx.moveTo(lxPx, lyPx);
    ctx.lineTo(rx + rw * 0.5, ry + rh * 0.5);
    ctx.stroke();
    ctx.setLineDash([]);

    // Outer light aura
    const grad = ctx.createRadialGradient(lxPx, lyPx, 2 * dpr, lxPx, lyPx, 18 * dpr);
    grad.addColorStop(0, 'rgba(255, 244, 210, 0.95)');
    grad.addColorStop(0.45, 'rgba(240, 140, 43, 0.55)');
    grad.addColorStop(1, 'rgba(240, 140, 43, 0.0)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(lxPx, lyPx, 18 * dpr, 0, Math.PI * 2);
    ctx.fill();

    // Crisp light gizmo ring & label
    ctx.strokeStyle = '#fff6d6';
    ctx.lineWidth = 1.5 * dpr;
    ctx.beginPath();
    ctx.arc(lxPx, lyPx, 6.5 * dpr, 0, Math.PI * 2);
    ctx.stroke();

    ctx.fillStyle = 'rgba(11, 12, 15, 0.85)';
    ctx.strokeStyle = 'rgba(246, 196, 106, 0.6)';
    ctx.lineWidth = 1;
    const tagW = 88 * dpr;
    const tagH = 16 * dpr;
    const tagX = Math.min(gx + drawW - tagW - 4, Math.max(gx + 4, lxPx + 10 * dpr));
    const tagY = Math.max(gy + 4, lyPx - 18 * dpr);
    ctx.fillRect(tagX, tagY, tagW, tagH);
    ctx.strokeRect(tagX, tagY, tagW, tagH);

    ctx.fillStyle = '#f6c46a';
    ctx.font = `600 ${Math.round(8.5 * dpr)}px "JetBrains Mono", Consolas, monospace`;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(
      `$L$1(${this.light.x.toFixed(2)},${this.light.y.toFixed(2)},${this.light.z.toFixed(2)})`,
      tagX + 4 * dpr,
      tagY + tagH * 0.5
    );
    ctx.restore();

    // 7. Live Zoomed 7x5 Cell Formula Matrix Loupe (Bottom-Right of Sheet Stage)
    if (this.showLoupe && drawW > 280 * dpr) {
      this._renderCellLoupe(ctx, gx, gy, drawW, drawH, dpr);
    }
  }

  _renderCellLoupe(ctx, gx, gy, drawW, drawH, dpr) {
    const cols = 4;
    const rows = 4;
    const cw = Math.round(52 * dpr);
    const ch = Math.round(17 * dpr);
    const headH = Math.round(15 * dpr);
    const rowGutter = Math.round(26 * dpr);

    const boxW = rowGutter + cols * cw;
    const boxH = headH + rows * ch;
    const bx = gx + drawW - boxW - Math.round(8 * dpr);
    const by = gy + drawH - boxH - Math.round(8 * dpr);

    ctx.save();
    ctx.fillStyle = 'rgba(11, 13, 18, 0.94)';
    ctx.fillRect(bx - 2, by - 2, boxW + 4, boxH + 4);
    ctx.strokeStyle = '#383f4f';
    ctx.lineWidth = 1;
    ctx.strokeRect(bx - 1.5, by - 1.5, boxW + 3, boxH + 3);

    const startCol = Math.max(0, Math.min(SHEET_COLS - cols, this.selectedCol - 1));
    const startRow = Math.max(0, Math.min(SHEET_ROWS - rows, this.selectedRow - 1));

    ctx.font = `600 ${Math.round(7.5 * dpr)}px "JetBrains Mono", Consolas, monospace`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    // Loupe header corner
    ctx.fillStyle = '#161922';
    ctx.fillRect(bx, by, boxW, headH);
    ctx.fillStyle = '#f08c2b';
    ctx.fillText('FX', bx + rowGutter * 0.5, by + headH * 0.5);

    for (let dc = 0; dc < cols; dc++) {
      const c = startCol + dc;
      const cx = bx + rowGutter + dc * cw;
      ctx.fillStyle = (c === this.selectedCol) ? '#f6c46a' : '#8e96a8';
      ctx.fillText(colToLetters(c), cx + cw * 0.5, by + headH * 0.5);
    }

    for (let dr = 0; dr < rows; dr++) {
      const r = startRow + dr;
      const ry = by + headH + dr * ch;

      // Row number cell
      ctx.fillStyle = '#161922';
      ctx.fillRect(bx, ry, rowGutter, ch);
      ctx.fillStyle = (r === this.selectedRow) ? '#f6c46a' : '#8e96a8';
      ctx.fillText(String(r + 1), bx + rowGutter * 0.5, ry + ch * 0.5);

      for (let dc = 0; dc < cols; dc++) {
        const c = startCol + dc;
        const idx = r * SHEET_COLS + c;
        const cx = bx + rowGutter + dc * cw;

        const cr = this.relitR[idx];
        const cg = this.relitG[idx];
        const cb = this.relitB[idx];

        ctx.fillStyle = `rgb(${cr},${cg},${cb})`;
        ctx.fillRect(cx, ry, cw, ch);

        ctx.strokeStyle = 'rgba(15, 17, 23, 0.55)';
        ctx.strokeRect(cx + 0.5, ry + 0.5, cw - 1, ch - 1);

        // Print full RGB or metric inside widened 52px spreadsheet cell with zero clipping
        const lum = 0.299 * cr + 0.587 * cg + 0.114 * cb;
        ctx.fillStyle = lum > 138 ? '#090a0e' : '#f4f6fa';
        let cellText = '';
        if (this.relightMode === 2) {
          cellText = `∇${this.sobelMag[idx].toFixed(2)}`;
        } else if (this.relightMode === 3) {
          cellText = `Z:${this.depth[idx].toFixed(2)}`;
        } else {
          cellText = `${cr},${cg},${cb}`;
        }
        ctx.fillText(cellText, cx + cw * 0.5, ry + ch * 0.5);

        if (c === this.selectedCol && r === this.selectedRow) {
          ctx.strokeStyle = '#ffffff';
          ctx.lineWidth = 1.5 * dpr;
          ctx.strokeRect(cx + 1, ry + 1, cw - 2, ch - 2);
          ctx.lineWidth = 1;
        }
      }
    }
    ctx.restore();
  }
}
