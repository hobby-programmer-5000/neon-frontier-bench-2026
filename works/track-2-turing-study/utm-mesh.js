/**
 * 1936 Cambridge Universal Tape Machine — Procedural 3D Apparatus (`utm-mesh.js`)
 * 100% procedural Three.js geometry & crisp CanvasTextures (zero external assets).
 *
 * Bounding envelope (verified):
 *   Bottom of beveled walnut plinth at y = 0.000
 *   Width  <= 0.70 m (approx 0.66 m)
 *   Depth  <= 0.42 m (approx 0.38 m)
 *   Height <= 0.35 m (approx 0.336 m)
 *   Front console & spoked reels face +Z.
 */

const BLANK_SYMS = new Set(['␣', '_', ' ', '']);

function createCanvas(width, height) {
  if (typeof document === 'undefined') return null;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  return canvas;
}

function makeCanvasTexture(THREE, canvas, { srgb = true, repeatX = 1, repeatY = 1, anisotropy = 8 } = {}) {
  if (!canvas) return null;
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  if (repeatX !== 1 || repeatY !== 1) {
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(repeatX, repeatY);
  }
  tex.anisotropy = anisotropy;
  tex.needsUpdate = true;
  return tex;
}

/** Deterministic pseudo-random helper for repeatable procedural textures. */
function makeRng(seed) {
  let s = seed >>> 0;
  return () => {
    s ^= s << 13;
    s ^= s >>> 17;
    s ^= s << 5;
    return (s >>> 0) / 0xffffffff;
  };
}

function createWalnutTextures(THREE) {
  const c = createCanvas(512, 256);
  const r = createCanvas(512, 256);
  if (!c || !r) return { map: null, roughnessMap: null };

  const ctx = c.getContext('2d');
  const rctx = r.getContext('2d');
  const rng = makeRng(0x1936a1);

  ctx.fillStyle = '#362013';
  ctx.fillRect(0, 0, 512, 256);
  rctx.fillStyle = '#686868';
  rctx.fillRect(0, 0, 512, 256);

  // Flowing dark English walnut grain bands
  for (let y = 0; y < 256; y += 2) {
    const wave = Math.sin(y * 0.085) * 8 + Math.cos(y * 0.025) * 14;
    const tone = 0.5 + 0.5 * Math.sin((y + wave) * 0.24);
    const rv = Math.round(44 + tone * 28 + rng() * 6);
    const gv = Math.round(25 + tone * 16 + rng() * 4);
    const bv = Math.round(14 + tone * 9 + rng() * 3);
    ctx.fillStyle = `rgb(${rv},${gv},${bv})`;
    ctx.fillRect(0, y, 512, 2);

    const rough = Math.round(92 + (1 - tone) * 42);
    rctx.fillStyle = `rgb(${rough},${rough},${rough})`;
    rctx.fillRect(0, y, 512, 2);
  }

  // Fine dark wood pores & warm burl highlights
  for (let i = 0; i < 420; i += 1) {
    const x = rng() * 512;
    const y = rng() * 256;
    const len = 18 + rng() * 75;
    const dark = rng() > 0.35;
    ctx.strokeStyle = dark ? 'rgba(18, 9, 4, 0.26)' : 'rgba(116, 74, 42, 0.14)';
    ctx.lineWidth = 0.6 + rng() * 1.4;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.bezierCurveTo(
      x + len * 0.33,
      y + (rng() - 0.5) * 4,
      x + len * 0.66,
      y + (rng() - 0.5) * 4,
      x + len,
      y + (rng() - 0.5) * 2
    );
    ctx.stroke();
  }

  return {
    map: makeCanvasTexture(THREE, c, { srgb: true }),
    roughnessMap: makeCanvasTexture(THREE, r, { srgb: false }),
  };
}

function createBrushedBrassTexture(THREE) {
  const c = createCanvas(256, 256);
  if (!c) return null;
  const ctx = c.getContext('2d');
  const rng = makeRng(0x1936b2);

  const grad = ctx.createLinearGradient(0, 0, 256, 256);
  grad.addColorStop(0, '#c8a156');
  grad.addColorStop(0.5, '#b68c42');
  grad.addColorStop(1, '#9c7432');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 256, 256);

  // Horizontal brushed satin hairline streaks
  for (let y = 0; y < 256; y += 1) {
    const a = 0.04 + rng() * 0.1;
    ctx.fillStyle = rng() > 0.5 ? `rgba(255,236,184,${a})` : `rgba(64,44,14,${a})`;
    ctx.fillRect(0, y, 256, 1);
  }
  // Subtle aged patina mottling
  for (let i = 0; i < 60; i += 1) {
    const x = rng() * 256;
    const y = rng() * 256;
    const rad = 8 + rng() * 24;
    const g = ctx.createRadialGradient(x, y, 0, x, y, rad);
    g.addColorStop(0, 'rgba(72, 52, 20, 0.09)');
    g.addColorStop(1, 'rgba(72, 52, 20, 0)');
    ctx.fillStyle = g;
    ctx.fillRect(x - rad, y - rad, rad * 2, rad * 2);
  }
  return makeCanvasTexture(THREE, c, { srgb: true });
}

function createCopperCoilTexture(THREE) {
  const c = createCanvas(128, 128);
  const b = createCanvas(128, 128);
  if (!c || !b) return { map: null, bumpMap: null };

  const ctx = c.getContext('2d');
  const bctx = b.getContext('2d');

  for (let y = 0; y < 128; y += 1) {
    const phase = ((y % 4) / 4) * Math.PI * 2;
    const s = 0.5 + 0.5 * Math.sin(phase);
    const rv = Math.round(115 + s * 102);
    const gv = Math.round(52 + s * 56);
    const bv = Math.round(24 + s * 28);
    ctx.fillStyle = `rgb(${rv},${gv},${bv})`;
    ctx.fillRect(0, y, 128, 1);

    const bvVal = Math.round(60 + s * 195);
    bctx.fillStyle = `rgb(${bvVal},${bvVal},${bvVal})`;
    bctx.fillRect(0, y, 128, 1);
  }

  return {
    map: makeCanvasTexture(THREE, c, { srgb: true, repeatX: 1, repeatY: 2 }),
    bumpMap: makeCanvasTexture(THREE, b, { srgb: false, repeatX: 1, repeatY: 2 }),
  };
}

function createPaperRollTexture(THREE) {
  const c = createCanvas(256, 256);
  if (!c) return null;
  const ctx = c.getContext('2d');
  const cx = 128;
  const cy = 128;

  ctx.fillStyle = '#e7dbb9';
  ctx.fillRect(0, 0, 256, 256);

  // Tightly wound archival paper layers
  for (let rad = 22; rad <= 126; rad += 2.2) {
    const shade = rad % 6 < 2 ? 'rgba(136, 114, 78, 0.34)' : 'rgba(252, 245, 224, 0.24)';
    ctx.strokeStyle = shade;
    ctx.lineWidth = 1.0;
    ctx.beginPath();
    ctx.arc(cx, cy, rad, 0, Math.PI * 2);
    ctx.stroke();
  }

  return makeCanvasTexture(THREE, c, { srgb: true });
}

function createNameplateTexture(THREE) {
  const c = createCanvas(512, 96);
  if (!c) return null;
  const ctx = c.getContext('2d');

  // Aged brushed brass field
  const grad = ctx.createLinearGradient(0, 0, 512, 96);
  grad.addColorStop(0, '#c8a258');
  grad.addColorStop(0.5, '#d7b56b');
  grad.addColorStop(1, '#a9823c');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 512, 96);

  // Subtle dark recessed etched panel
  ctx.fillStyle = 'rgba(24, 17, 9, 0.84)';
  ctx.fillRect(10, 10, 492, 76);

  // Double engraved brass border
  ctx.strokeStyle = '#d7b46a';
  ctx.lineWidth = 2;
  ctx.strokeRect(15, 15, 482, 66);
  ctx.strokeStyle = 'rgba(215, 180, 106, 0.55)';
  ctx.lineWidth = 1;
  ctx.strokeRect(20, 20, 472, 56);

  // Corner brass rosettes
  const corners = [[28, 28], [484, 28], [28, 68], [484, 68]];
  ctx.fillStyle = '#d7b46a';
  for (const [cx, cy] of corners) {
    ctx.beginPath();
    ctx.arc(cx, cy, 3, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#ecd08e';
  ctx.font = 'bold 21px Georgia, "Times New Roman", serif';
  ctx.fillText('UNIVERSAL TAPE MACHINE', 256, 39);

  ctx.fillStyle = '#cfa95e';
  ctx.font = '600 13px Georgia, "Times New Roman", serif';
  ctx.fillText('CAMBRIDGE · 1936 · MODEL X-8', 256, 63);

  return makeCanvasTexture(THREE, c, { srgb: true });
}

/**
 * Create vintage cream-enamel circular instrument dial face texture.
 * @param {'steps'|'state'|'tension'} kind
 */
function createGaugeDialTexture(THREE, kind) {
  const c = createCanvas(256, 256);
  if (!c) return null;
  const ctx = c.getContext('2d');
  const cx = 128;
  const cy = 128;

  // Warm aged ivory enamel face with subtle inner vignette
  const bg = ctx.createRadialGradient(cx, cy - 10, 14, cx, cy, 126);
  bg.addColorStop(0, '#f7f0dc');
  bg.addColorStop(0.78, '#eadcb9');
  bg.addColorStop(1, '#c8b489');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, 256, 256);

  // Outer brass-rimmed calibration ring
  ctx.strokeStyle = '#2d2318';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(cx, cy, 114, 0, Math.PI * 2);
  ctx.stroke();

  ctx.strokeStyle = 'rgba(45, 35, 24, 0.45)';
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.arc(cx, cy, 108, 0, Math.PI * 2);
  ctx.stroke();

  // Sweep arc from -135 deg (7:30) to +135 deg (4:30) in standard top=0 coords
  const startRad = (-135 * Math.PI) / 180;
  const endRad = (135 * Math.PI) / 180;
  const toCanvasAngle = (a) => a - Math.PI / 2;

  if (kind === 'state') {
    // Crimson HALT danger/completion arc on upper-right end of scale
    ctx.strokeStyle = '#9c221b';
    ctx.lineWidth = 11;
    ctx.beginPath();
    ctx.arc(cx, cy, 98, toCanvasAngle(endRad - 0.48), toCanvasAngle(endRad));
    ctx.stroke();
  } else if (kind === 'tension') {
    // Subtle sage nominal center band around 0
    ctx.strokeStyle = 'rgba(58, 106, 74, 0.35)';
    ctx.lineWidth = 10;
    ctx.beginPath();
    ctx.arc(cx, cy, 98, toCanvasAngle(-0.35), toCanvasAngle(0.35));
    ctx.stroke();
  }

  // Calibration scale ticks & numerals
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  if (kind === 'steps') {
    const majorCount = 5; // 0, 10, 20, 30, 40, 50
    const totalTicks = 25;
    for (let i = 0; i <= totalTicks; i += 1) {
      const t = i / totalTicks;
      const ang = toCanvasAngle(startRad + t * (endRad - startRad));
      const isMajor = i % 5 === 0;
      const rOuter = 104;
      const rInner = isMajor ? 84 : 94;
      ctx.strokeStyle = '#1f1812';
      ctx.lineWidth = isMajor ? 3 : 1.5;
      ctx.beginPath();
      ctx.moveTo(cx + Math.cos(ang) * rInner, cy + Math.sin(ang) * rInner);
      ctx.lineTo(cx + Math.cos(ang) * rOuter, cy + Math.sin(ang) * rOuter);
      ctx.stroke();

      if (isMajor) {
        const label = String((i / 5) * 10);
        const rTxt = 68;
        ctx.fillStyle = '#1e1610';
        ctx.font = 'bold 18px Georgia, serif';
        ctx.fillText(label, cx + Math.cos(ang) * rTxt, cy + Math.sin(ang) * rTxt);
      }
    }
    ctx.fillStyle = '#3b2d1f';
    ctx.font = 'bold 14px Georgia, serif';
    ctx.fillText('STEPS', cx, cy + 44);
    ctx.font = '11px Georgia, serif';
    ctx.fillText('CYCLE ×1', cx, cy + 62);
    void majorCount;
  } else if (kind === 'state') {
    const labels = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'H'];
    for (let i = 0; i < labels.length; i += 1) {
      const t = i / (labels.length - 1);
      const ang = toCanvasAngle(startRad + t * (endRad - startRad));
      const isHalt = i === labels.length - 1;
      ctx.strokeStyle = isHalt ? '#9c221b' : '#1f1812';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(cx + Math.cos(ang) * 84, cy + Math.sin(ang) * 84);
      ctx.lineTo(cx + Math.cos(ang) * 104, cy + Math.sin(ang) * 104);
      ctx.stroke();

      ctx.fillStyle = isHalt ? '#9c221b' : '#1e1610';
      ctx.font = 'bold 16px Georgia, serif';
      ctx.fillText(labels[i], cx + Math.cos(ang) * 67, cy + Math.sin(ang) * 67);
    }
    ctx.fillStyle = '#3b2d1f';
    ctx.font = 'bold 13px Georgia, serif';
    ctx.fillText('m-CONFIG', cx, cy + 44);
    ctx.font = '11px Georgia, serif';
    ctx.fillText('STATE INDEX', cx, cy + 62);
  } else {
    // Zero-center galvanometer tape tension dial
    const totalTicks = 20;
    for (let i = 0; i <= totalTicks; i += 1) {
      const t = i / totalTicks;
      const ang = toCanvasAngle(startRad + t * (endRad - startRad));
      const isMajor = i % 5 === 0;
      ctx.strokeStyle = i === 10 ? '#9c221b' : '#1f1812';
      ctx.lineWidth = isMajor ? 3 : 1.5;
      ctx.beginPath();
      ctx.moveTo(cx + Math.cos(ang) * (isMajor ? 84 : 94), cy + Math.sin(ang) * (isMajor ? 84 : 94));
      ctx.lineTo(cx + Math.cos(ang) * 104, cy + Math.sin(ang) * 104);
      ctx.stroke();
    }
    const marks = [
      { t: 0.0, txt: 'L' },
      { t: 0.25, txt: '5' },
      { t: 0.5, txt: '0' },
      { t: 0.75, txt: '5' },
      { t: 1.0, txt: 'R' },
    ];
    for (const m of marks) {
      const ang = toCanvasAngle(startRad + m.t * (endRad - startRad));
      ctx.fillStyle = m.txt === '0' ? '#9c221b' : '#1e1610';
      ctx.font = 'bold 18px Georgia, serif';
      ctx.fillText(m.txt, cx + Math.cos(ang) * 68, cy + Math.sin(ang) * 68);
    }
    ctx.fillStyle = '#3b2d1f';
    ctx.font = 'bold 13px Georgia, serif';
    ctx.fillText('TENSION', cx, cy + 44);
    ctx.font = '11px Georgia, serif';
    ctx.fillText('FEED · g', cx, cy + 62);
  }

  // Subtle inner decorative maker mark
  ctx.fillStyle = 'rgba(45, 35, 24, 0.55)';
  ctx.font = 'italic 10px Georgia, serif';
  ctx.fillText('CAMBRIDGE INST.', cx, cy - 30);

  return makeCanvasTexture(THREE, c, { srgb: true });
}

/**
 * Draw crisp archival cream paper tape with sprocket holes, cell dividers,
 * printed symbols (0, 1, +, drafted open-box blank), and crimson active head highlight.
 */
function renderTapeCanvas(canvas, utmState) {
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const W = canvas.width;
  const H = canvas.height;

  // Warm archival cream rag paper base
  const paperGrad = ctx.createLinearGradient(0, 0, 0, H);
  paperGrad.addColorStop(0, '#e5d8b8');
  paperGrad.addColorStop(0.15, '#f2e8ce');
  paperGrad.addColorStop(0.85, '#efe4c8');
  paperGrad.addColorStop(1, '#dfd0ae');
  ctx.fillStyle = paperGrad;
  ctx.fillRect(0, 0, W, H);

  // Subtle fine paper grain lines
  ctx.fillStyle = 'rgba(130, 108, 72, 0.08)';
  for (let y = 6; y < H; y += 9) {
    ctx.fillRect(0, y, W, 1);
  }

  // Top & bottom sepia rule borders separating sprocket tracks
  ctx.strokeStyle = 'rgba(110, 88, 56, 0.55)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(0, 28);
  ctx.lineTo(W, 28);
  ctx.moveTo(0, H - 28);
  ctx.lineTo(W, H - 28);
  ctx.stroke();

  const cells =
    utmState && Array.isArray(utmState.tapeWindow) && utmState.tapeWindow.length === 15
      ? utmState.tapeWindow
      : Array.from({ length: 15 }, (_, idx) => ({
          pos: idx - 7,
          sym: '␣',
          isHead: idx === 7,
        }));

  const cellW = W / cells.length;

  for (let i = 0; i < cells.length; i += 1) {
    const cell = cells[i];
    const x0 = i * cellW;
    const cx = x0 + cellW * 0.5;

    // Active head cell crimson ink wash & registration frame
    if (cell.isHead) {
      ctx.fillStyle = utmState && utmState.halted
        ? 'rgba(42, 128, 76, 0.22)'
        : 'rgba(176, 36, 26, 0.19)';
      ctx.fillRect(x0 + 2, 30, cellW - 4, H - 60);

      ctx.strokeStyle = utmState && utmState.halted ? '#267346' : '#a81e16';
      ctx.lineWidth = 4;
      ctx.strokeRect(x0 + 4, 33, cellW - 8, H - 66);

      // Small crimson top & bottom triangular head registration notches
      ctx.fillStyle = utmState && utmState.halted ? '#267346' : '#a81e16';
      ctx.beginPath();
      ctx.moveTo(cx, 33);
      ctx.lineTo(cx - 8, 22);
      ctx.lineTo(cx + 8, 22);
      ctx.closePath();
      ctx.fill();

      ctx.beginPath();
      ctx.moveTo(cx, H - 33);
      ctx.lineTo(cx - 8, H - 22);
      ctx.lineTo(cx + 8, H - 22);
      ctx.closePath();
      ctx.fill();
    }

    // Vertical cell grid dividers
    ctx.strokeStyle = 'rgba(92, 74, 48, 0.45)';
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.moveTo(x0, 28);
    ctx.lineTo(x0, H - 28);
    ctx.stroke();

    // Punched sprocket perforations (top & bottom tracks)
    for (const py of [14, H - 14]) {
      ctx.fillStyle = '#2d2218';
      ctx.beginPath();
      ctx.arc(cx, py, 5.2, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = 'rgba(255, 245, 220, 0.45)';
      ctx.lineWidth = 1;
      ctx.stroke();
    }

    // Small tape cell position index along lower margin
    ctx.fillStyle = cell.isHead ? '#8f1d16' : 'rgba(84, 66, 44, 0.65)';
    ctx.font = 'bold 13px "Courier New", monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(String(cell.pos), cx, H - 42);

    // Printed tape symbol (bold iron-gall charcoal, or crimson at active head)
    const inkColor = cell.isHead
      ? (utmState && utmState.halted ? '#1b5e36' : '#9c1710')
      : '#1f1a15';

    const sym = cell.sym ?? '␣';
    if (BLANK_SYMS.has(sym)) {
      // Crisp drafted open-cup blank glyph (␣) — immune to font-fallback glitches
      ctx.strokeStyle = cell.isHead ? inkColor : 'rgba(68, 56, 42, 0.48)';
      ctx.lineWidth = cell.isHead ? 4.5 : 3.2;
      ctx.lineCap = 'square';
      ctx.beginPath();
      ctx.moveTo(cx - 14, H * 0.48 - 2);
      ctx.lineTo(cx - 14, H * 0.48 + 14);
      ctx.lineTo(cx + 14, H * 0.48 + 14);
      ctx.lineTo(cx + 14, H * 0.48 - 2);
      ctx.stroke();
    } else {
      ctx.fillStyle = inkColor;
      ctx.font = 'bold 74px Georgia, "Times New Roman", serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(String(sym), cx, H * 0.47);
    }
  }
}

/**
 * Create a toothed involute-style procedural brass spur gear geometry.
 */
function createGearGeometry(THREE, teeth, outerR, rootR, holeR, thickness) {
  const shape = new THREE.Shape();
  const step = (Math.PI * 2) / teeth;

  for (let i = 0; i < teeth; i += 1) {
    const a0 = i * step;
    const a1 = a0 + step * 0.18;
    const a2 = a0 + step * 0.34;
    const a3 = a0 + step * 0.56;
    const a4 = a0 + step * 0.72;

    const p0x = Math.cos(a0) * rootR;
    const p0y = Math.sin(a0) * rootR;
    if (i === 0) shape.moveTo(p0x, p0y);
    else shape.lineTo(p0x, p0y);

    shape.lineTo(Math.cos(a1) * rootR, Math.sin(a1) * rootR);
    shape.lineTo(Math.cos(a2) * outerR, Math.sin(a2) * outerR);
    shape.lineTo(Math.cos(a3) * outerR, Math.sin(a3) * outerR);
    shape.lineTo(Math.cos(a4) * rootR, Math.sin(a4) * rootR);
  }
  shape.closePath();

  const hole = new THREE.Path();
  hole.absarc(0, 0, holeR, 0, Math.PI * 2, true);
  shape.holes.push(hole);

  const geo = new THREE.ExtrudeGeometry(shape, {
    depth: thickness,
    bevelEnabled: true,
    bevelThickness: 0.0008,
    bevelSize: 0.0006,
    bevelSegments: 2,
    curveSegments: 16,
  });
  geo.center();
  return geo;
}

/**
 * Build a smooth ribbon BufferGeometry arching cleanly from the left paper roll,
 * over the left & right guide rollers, flat across the central read/write bridge,
 * and onto the right paper roll.
 */
function createTapeRibbonGeometry(THREE, tapeWidth) {
  // Control points in XY (all coplanar around z = 0 in ribbon local space)
  const pathPts = [
    new THREE.Vector3(-0.218, 0.15, 0),
    new THREE.Vector3(-0.17, 0.157, 0),
    new THREE.Vector3(-0.118, 0.165, 0),
    new THREE.Vector3(-0.102, 0.1665, 0),
    new THREE.Vector3(0.0, 0.1665, 0),
    new THREE.Vector3(0.102, 0.1665, 0),
    new THREE.Vector3(0.118, 0.165, 0),
    new THREE.Vector3(0.17, 0.157, 0),
    new THREE.Vector3(0.218, 0.15, 0),
  ];

  // Sample densely along piecewise-smooth segments so central platen is razor-flat
  const samples = [];
  const curveL = new THREE.CatmullRomCurve3(pathPts.slice(0, 4));
  const curveR = new THREE.CatmullRomCurve3(pathPts.slice(5, 9));

  const leftSamples = curveL.getPoints(18);
  const flatSteps = 24;
  const rightSamples = curveR.getPoints(18);

  for (let i = 0; i < leftSamples.length - 1; i += 1) samples.push(leftSamples[i]);
  for (let i = 0; i <= flatSteps; i += 1) {
    const t = i / flatSteps;
    samples.push(new THREE.Vector3(-0.102 + t * 0.204, 0.1665, 0));
  }
  for (let i = 1; i < rightSamples.length; i += 1) samples.push(rightSamples[i]);

  // Compute cumulative arc length for distortion-free UVs
  const cumLen = [0];
  let totalLen = 0;
  for (let i = 1; i < samples.length; i += 1) {
    totalLen += samples[i].distanceTo(samples[i - 1]);
    cumLen.push(totalLen);
  }

  const halfW = tapeWidth * 0.5;
  const positions = [];
  const normals = [];
  const uvs = [];
  const indices = [];

  for (let i = 0; i < samples.length; i += 1) {
    const p = samples[i];
    const pPrev = samples[Math.max(0, i - 1)];
    const pNext = samples[Math.min(samples.length - 1, i + 1)];
    const tx = pNext.x - pPrev.x;
    const ty = pNext.y - pPrev.y;
    const tLen = Math.hypot(tx, ty) || 1;
    // Upward normal in XY plane
    const nx = -ty / tLen;
    const ny = tx / tLen;

    const u = cumLen[i] / totalLen;

    // Back edge (z = -halfW, v = 1 -> top of canvas) and front edge (z = +halfW, v = 0 -> bottom of canvas)
    positions.push(p.x, p.y, -halfW);
    normals.push(nx, ny, 0);
    uvs.push(u, 1);

    positions.push(p.x, p.y, halfW);
    normals.push(nx, ny, 0);
    uvs.push(u, 0);

    if (i < samples.length - 1) {
      const a = i * 2;
      const b = a + 1;
      const c = a + 2;
      const d = a + 3;
      indices.push(a, b, c, b, d, c);
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geo.setIndex(indices);
  return geo;
}

function setShadow(mesh, cast = true, receive = true) {
  mesh.castShadow = cast;
  mesh.receiveShadow = receive;
  return mesh;
}

/**
 * Create the complete 1936 Cambridge Universal Turing Machine 3D apparatus.
 * @param {typeof import('three')} THREE
 * @returns {{ group: THREE.Group, update: (dt: number, utmState: object, elapsed?: number) => void, triggerStepPulse: (moveDir: number) => void }}
 */
export function createUTMApparatus(THREE) {
  const group = new THREE.Group();
  group.name = 'UTMApparatus1936';

  // -------------------------------------------------------------------------
  // 1. Shared Procedural PBR Materials (zero duplicate shader hooks)
  // -------------------------------------------------------------------------
  const walnutTex = createWalnutTextures(THREE);
  const brassTex = createBrushedBrassTexture(THREE);
  const copperTex = createCopperCoilTexture(THREE);
  const paperRollTex = createPaperRollTexture(THREE);
  const nameplateTex = createNameplateTexture(THREE);

  const walnutMat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    map: walnutTex.map,
    roughnessMap: walnutTex.roughnessMap,
    roughness: 0.44,
    metalness: 0.04,
  });
  if (!walnutTex.map) walnutMat.color.setHex(0x3a2214);

  const antiqueBrassMat = new THREE.MeshStandardMaterial({
    color: 0xd9b366,
    map: brassTex,
    roughness: 0.31,
    metalness: 0.88,
  });

  const brightBrassMat = new THREE.MeshStandardMaterial({
    color: 0xe6c373,
    roughness: 0.22,
    metalness: 0.92,
  });

  const darkPatinaBrassMat = new THREE.MeshStandardMaterial({
    color: 0x8a6b35,
    roughness: 0.46,
    metalness: 0.82,
  });

  const blackenedSteelMat = new THREE.MeshStandardMaterial({
    color: 0x26292e,
    roughness: 0.42,
    metalness: 0.78,
  });

  const polishedSteelMat = new THREE.MeshStandardMaterial({
    color: 0xcbd0d6,
    roughness: 0.19,
    metalness: 0.94,
  });

  const bakeliteMat = new THREE.MeshStandardMaterial({
    color: 0x1c1512,
    roughness: 0.28,
    metalness: 0.08,
  });

  const copperCoilMat = new THREE.MeshStandardMaterial({
    color: 0xd47d46,
    map: copperTex.map,
    bumpMap: copperTex.bumpMap,
    bumpScale: 0.0022,
    roughness: 0.32,
    metalness: 0.86,
  });

  const braidedWireMat = new THREE.MeshStandardMaterial({
    color: 0x5c2b22,
    roughness: 0.78,
    metalness: 0.08,
  });

  const paperRollSideMat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    map: paperRollTex,
    roughness: 0.84,
    metalness: 0.0,
  });
  if (!paperRollTex) paperRollSideMat.color.setHex(0xe8dcb8);

  const paperRollEdgeMat = new THREE.MeshStandardMaterial({
    color: 0xefe4c6,
    roughness: 0.86,
    metalness: 0.0,
  });

  const crystalGlassMat = new THREE.MeshPhysicalMaterial({
    color: 0xf7fbff,
    roughness: 0.07,
    metalness: 0.05,
    clearcoat: 1.0,
    clearcoatRoughness: 0.06,
    transparent: true,
    opacity: 0.24,
    depthWrite: false,
  });

  const crimsonNeedleMat = new THREE.MeshStandardMaterial({
    color: 0xa81f16,
    roughness: 0.35,
    metalness: 0.3,
  });

  const bluedNeedleMat = new THREE.MeshStandardMaterial({
    color: 0x1a2842,
    roughness: 0.24,
    metalness: 0.85,
  });

  const nameplateMat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    map: nameplateTex,
    roughness: 0.34,
    metalness: 0.78,
  });
  if (!nameplateTex) nameplateMat.color.setHex(0xc8a258);

  // Live updating paper tape canvas texture
  const tapeCanvas = createCanvas(1024, 192);
  renderTapeCanvas(tapeCanvas, null);
  const tapeTexture = makeCanvasTexture(THREE, tapeCanvas, { srgb: true, anisotropy: 8 });
  if (tapeTexture) {
    tapeTexture.wrapS = THREE.ClampToEdgeWrapping;
    tapeTexture.wrapT = THREE.ClampToEdgeWrapping;
  }

  const tapeMat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    map: tapeTexture,
    roughness: 0.82,
    metalness: 0.0,
    side: THREE.DoubleSide,
  });
  if (!tapeTexture) tapeMat.color.setHex(0xf0e4c6);

  // -------------------------------------------------------------------------
  // 2. Beveled English Walnut Base Plinth (bottom strictly at y = 0.000)
  // -------------------------------------------------------------------------
  const plinthGroup = new THREE.Group();
  plinthGroup.name = 'WalnutPlinth';

  // Lower skirt (y: 0.000 .. 0.014, W: 0.660, D: 0.380)
  const skirt = setShadow(new THREE.Mesh(new THREE.BoxGeometry(0.66, 0.014, 0.38), walnutMat));
  skirt.position.set(0, 0.007, 0);
  plinthGroup.add(skirt);

  // Middle beveled molding step (y: 0.014 .. 0.024, W: 0.644, D: 0.364)
  const midStep = setShadow(new THREE.Mesh(new THREE.BoxGeometry(0.644, 0.01, 0.364), walnutMat));
  midStep.position.set(0, 0.019, 0);
  plinthGroup.add(midStep);

  // Brass inlay trim bead around step (y: 0.0235)
  const trimBeadF = setShadow(new THREE.Mesh(new THREE.BoxGeometry(0.634, 0.0025, 0.003), brightBrassMat));
  trimBeadF.position.set(0, 0.0245, 0.1765);
  const trimBeadB = trimBeadF.clone();
  trimBeadB.position.z = -0.1765;
  const trimBeadL = setShadow(new THREE.Mesh(new THREE.BoxGeometry(0.003, 0.0025, 0.356), brightBrassMat));
  trimBeadL.position.set(-0.3165, 0.0245, 0);
  const trimBeadR = trimBeadL.clone();
  trimBeadR.position.x = 0.3165;
  plinthGroup.add(trimBeadF, trimBeadB, trimBeadL, trimBeadR);

  // Main upper walnut plinth body (y: 0.024 .. 0.056, W: 0.630, D: 0.350)
  const mainPlinth = setShadow(new THREE.Mesh(new THREE.BoxGeometry(0.63, 0.032, 0.35), walnutMat));
  mainPlinth.position.set(0, 0.04, 0);
  plinthGroup.add(mainPlinth);

  // Cast antique-brass corner brackets (all 4 corners)
  const cornerSideGeoX = new THREE.BoxGeometry(0.042, 0.033, 0.004);
  const cornerSideGeoZ = new THREE.BoxGeometry(0.004, 0.033, 0.042);
  const cornerTopGeo = new THREE.BoxGeometry(0.042, 0.003, 0.042);
  const cornerSigns = [
    [-1, -1],
    [1, -1],
    [-1, 1],
    [1, 1],
  ];
  const screwPositions = [];

  for (const [sx, sz] of cornerSigns) {
    const cx = sx * 0.315;
    const cz = sz * 0.175;

    const plateX = setShadow(new THREE.Mesh(cornerSideGeoX, antiqueBrassMat));
    plateX.position.set(cx - sx * 0.02, 0.04, cz + sz * 0.0015);
    plinthGroup.add(plateX);

    const plateZ = setShadow(new THREE.Mesh(cornerSideGeoZ, antiqueBrassMat));
    plateZ.position.set(cx + sx * 0.0015, 0.04, cz - sz * 0.02);
    plinthGroup.add(plateZ);

    const cap = setShadow(new THREE.Mesh(cornerTopGeo, antiqueBrassMat));
    cap.position.set(cx - sx * 0.019, 0.0568, cz - sz * 0.019);
    plinthGroup.add(cap);

    // Track rivet/screw locations on top of brackets
    screwPositions.push([cx - sx * 0.012, 0.059, cz - sz * 0.012]);
    screwPositions.push([cx - sx * 0.031, 0.059, cz - sz * 0.012]);
    screwPositions.push([cx - sx * 0.012, 0.059, cz - sz * 0.031]);
  }

  // Engraved antique-brass nameplate on front face (+Z)
  const plaqueBevel = setShadow(new THREE.Mesh(new THREE.BoxGeometry(0.244, 0.028, 0.004), darkPatinaBrassMat));
  plaqueBevel.position.set(0, 0.04, 0.176);
  plinthGroup.add(plaqueBevel);

  const plaqueFace = setShadow(new THREE.Mesh(new THREE.PlaneGeometry(0.236, 0.024), nameplateMat), false, true);
  plaqueFace.position.set(0, 0.04, 0.1783);
  plinthGroup.add(plaqueFace);

  // Recessed blackened-steel chassis deck plate (y: 0.056 .. 0.064)
  const deckPlate = setShadow(new THREE.Mesh(new THREE.BoxGeometry(0.588, 0.008, 0.316), blackenedSteelMat));
  deckPlate.position.set(0, 0.06, 0);
  plinthGroup.add(deckPlate);

  // Brass perimeter deck bolts (collected for InstancedMesh)
  for (const bx of [-0.278, -0.14, 0, 0.14, 0.278]) {
    screwPositions.push([bx, 0.0655, -0.146]);
    screwPositions.push([bx, 0.0655, 0.146]);
  }

  const screwGeo = new THREE.CylinderGeometry(0.0032, 0.0032, 0.003, 8);
  const screwInst = new THREE.InstancedMesh(screwGeo, brightBrassMat, screwPositions.length);
  screwInst.castShadow = true;
  screwInst.receiveShadow = true;
  const dummy = new THREE.Object3D();
  for (let i = 0; i < screwPositions.length; i += 1) {
    dummy.position.set(screwPositions[i][0], screwPositions[i][1], screwPositions[i][2]);
    dummy.rotation.set(0, 0, 0);
    dummy.scale.set(1, 1, 1);
    dummy.updateMatrix();
    screwInst.setMatrixAt(i, dummy.matrix);
  }
  screwInst.instanceMatrix.needsUpdate = true;
  plinthGroup.add(screwInst);

  group.add(plinthGroup);

  // -------------------------------------------------------------------------
  // 3. Angled Brushed-Brass Front Instrument Console (+Z face)
  //    3 Analog Circular Gauges, 6 Knurled Brass Knobs, 4 Toggle Switches
  // -------------------------------------------------------------------------
  const consoleGroup = new THREE.Group();
  consoleGroup.name = 'FrontInstrumentConsole';

  // Extruded trapezoidal side housing profile in YZ plane, then rotated to span X
  const consoleProfile = new THREE.Shape();
  consoleProfile.moveTo(0.048, 0.064); // rear bottom
  consoleProfile.lineTo(0.156, 0.064); // front bottom
  consoleProfile.lineTo(0.156, 0.072); // front lip
  consoleProfile.lineTo(0.064, 0.136); // upper front edge
  consoleProfile.lineTo(0.048, 0.136); // rear top lip
  consoleProfile.closePath();

  const consoleBodyGeo = new THREE.ExtrudeGeometry(consoleProfile, {
    depth: 0.546,
    bevelEnabled: true,
    bevelThickness: 0.002,
    bevelSize: 0.002,
    bevelSegments: 2,
  });
  // ExtrudeGeometry extrudes along +Z from XY shape; remap so shape(X=z, Y=y) maps to world(X=depth, Y=y, Z=z)
  consoleBodyGeo.rotateY(-Math.PI / 2);
  consoleBodyGeo.translate(0.273, 0, 0);
  const consoleBody = setShadow(new THREE.Mesh(consoleBodyGeo, blackenedSteelMat));
  consoleGroup.add(consoleBody);

  // Tilted brushed-brass front instrument faceplate frame (offset cleanly outside beveled body)
  const faceTilt = -Math.atan2(0.092, 0.064); // ~ -0.963 rad (pitches local +Z forward & upward)
  const facePanel = new THREE.Group();
  facePanel.position.set(0, 0.1068, 0.1124);
  facePanel.rotation.x = faceTilt;
  consoleGroup.add(facePanel);

  const plateMesh = setShadow(new THREE.Mesh(new THREE.BoxGeometry(0.532, 0.104, 0.004), antiqueBrassMat));
  facePanel.add(plateMesh);

  // Dark engraved inner panel border strips
  const borderT = setShadow(new THREE.Mesh(new THREE.BoxGeometry(0.514, 0.0022, 0.0018), darkPatinaBrassMat));
  borderT.position.set(0, 0.047, 0.0025);
  const borderB = borderT.clone();
  borderB.position.y = -0.047;
  const borderMid = setShadow(new THREE.Mesh(new THREE.BoxGeometry(0.51, 0.0014, 0.0014), darkPatinaBrassMat));
  borderMid.position.set(0, -0.011, 0.0024);
  facePanel.add(borderT, borderB, borderMid);

  // Build 3 Procedural Analog Circular Gauges
  const gaugeConfigs = [
    { kind: 'steps', x: -0.168, needleMat: bluedNeedleMat },
    { kind: 'state', x: 0.0, needleMat: crimsonNeedleMat },
    { kind: 'tension', x: 0.168, needleMat: bluedNeedleMat },
  ];
  const gaugeNeedles = {};

  const bezelGeo = new THREE.TorusGeometry(0.0285, 0.0036, 12, 32);
  const bezelInnerGeo = new THREE.TorusGeometry(0.0255, 0.0016, 8, 28);
  const dialFaceGeo = new THREE.CircleGeometry(0.0256, 32);
  const glassLensGeo = new THREE.CircleGeometry(0.0265, 28);
  const needleHubGeo = new THREE.CylinderGeometry(0.0032, 0.0038, 0.004, 12);
  needleHubGeo.rotateX(Math.PI / 2);

  // Tapered needle geometry pivoting cleanly at (0,0,0), pointing toward +Y
  const needleShape = new THREE.Shape();
  needleShape.moveTo(-0.0016, -0.005);
  needleShape.lineTo(0.0016, -0.005);
  needleShape.lineTo(0.0005, 0.0205);
  needleShape.lineTo(0, 0.0225);
  needleShape.lineTo(-0.0005, 0.0205);
  needleShape.closePath();
  const needleGeo = new THREE.ExtrudeGeometry(needleShape, { depth: 0.0009, bevelEnabled: false });

  for (const cfg of gaugeConfigs) {
    const gWrap = new THREE.Group();
    gWrap.position.set(cfg.x, 0.0175, 0.0025);

    const dialTex = createGaugeDialTexture(THREE, cfg.kind);
    const dialMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      map: dialTex,
      roughness: 0.48,
      metalness: 0.04,
    });
    if (!dialTex) dialMat.color.setHex(0xefe4c6);

    const face = setShadow(new THREE.Mesh(dialFaceGeo, dialMat), false, true);
    face.position.z = 0.0012;
    gWrap.add(face);

    const bezel = setShadow(new THREE.Mesh(bezelGeo, brightBrassMat));
    bezel.position.z = 0.0038;
    gWrap.add(bezel);

    const innerRing = setShadow(new THREE.Mesh(bezelInnerGeo, darkPatinaBrassMat));
    innerRing.position.z = 0.0032;
    gWrap.add(innerRing);

    const needlePivot = new THREE.Group();
    needlePivot.position.z = 0.0026;
    const needleMesh = setShadow(new THREE.Mesh(needleGeo, cfg.needleMat), false, false);
    needlePivot.add(needleMesh);
    gWrap.add(needlePivot);
    gaugeNeedles[cfg.kind] = needlePivot;

    const hub = setShadow(new THREE.Mesh(needleHubGeo, brightBrassMat), false, false);
    hub.position.z = 0.0044;
    gWrap.add(hub);

    const crystal = setShadow(new THREE.Mesh(glassLensGeo, crystalGlassMat), false, false);
    crystal.position.z = 0.0062;
    gWrap.add(crystal);

    facePanel.add(gWrap);
  }

  // 6 Knurled Brass Rotary Knobs (3 left bank + 3 right bank on lower console row)
  const knobXs = [-0.224, -0.174, -0.124, 0.124, 0.174, 0.224];
  const knobSkirtGeo = new THREE.CylinderGeometry(0.0135, 0.0148, 0.0045, 20);
  knobSkirtGeo.rotateX(Math.PI / 2);

  // Single 20-flute lathe-knurled brass knob body (replaces 12 separate rib meshes per knob!)
  const knurlShape = new THREE.Shape();
  const flutes = 20;
  for (let f = 0; f < flutes; f += 1) {
    const a0 = (f / flutes) * Math.PI * 2;
    const a1 = ((f + 0.5) / flutes) * Math.PI * 2;
    const rOut = 0.0117;
    const rIn = 0.0103;
    const px = Math.cos(a0) * rOut;
    const py = Math.sin(a0) * rOut;
    if (f === 0) knurlShape.moveTo(px, py);
    else knurlShape.lineTo(px, py);
    knurlShape.lineTo(Math.cos(a1) * rIn, Math.sin(a1) * rIn);
  }
  knurlShape.closePath();
  const knobBodyGeo = new THREE.ExtrudeGeometry(knurlShape, {
    depth: 0.012,
    bevelEnabled: true,
    bevelThickness: 0.0008,
    bevelSize: 0.0006,
    bevelSegments: 2,
  });
  knobBodyGeo.translate(0, 0, -0.006);

  const knobCapGeo = new THREE.CylinderGeometry(0.0082, 0.0096, 0.0025, 18);
  knobCapGeo.rotateX(Math.PI / 2);
  const knobPointerGeo = new THREE.BoxGeometry(0.0016, 0.0075, 0.0014);

  const rotaryKnobs = [];
  for (let i = 0; i < knobXs.length; i += 1) {
    const kGroup = new THREE.Group();
    kGroup.position.set(knobXs[i], -0.0295, 0.0025);

    const skirtMesh = setShadow(new THREE.Mesh(knobSkirtGeo, bakeliteMat));
    skirtMesh.position.z = 0.0022;
    kGroup.add(skirtMesh);

    const rotor = new THREE.Group();
    rotor.rotation.z = -0.9 + i * 0.42;

    const body = setShadow(new THREE.Mesh(knobBodyGeo, antiqueBrassMat));
    body.position.z = 0.01;
    rotor.add(body);

    const cap = setShadow(new THREE.Mesh(knobCapGeo, brightBrassMat));
    cap.position.z = 0.0172;
    rotor.add(cap);

    const pointer = setShadow(new THREE.Mesh(knobPointerGeo, blackenedSteelMat), false, false);
    pointer.position.set(0, 0.004, 0.0187);
    rotor.add(pointer);

    kGroup.add(rotor);
    facePanel.add(kGroup);
    rotaryKnobs.push(rotor);
  }

  // 4 Machined Metal Toggle Switches (center lower row)
  const toggleXs = [-0.054, -0.018, 0.018, 0.054];
  const toggleNutGeo = new THREE.CylinderGeometry(0.0062, 0.0062, 0.0036, 6);
  toggleNutGeo.rotateX(Math.PI / 2);
  const toggleCollarGeo = new THREE.CylinderGeometry(0.0038, 0.0044, 0.006, 12);
  toggleCollarGeo.rotateX(Math.PI / 2);
  const toggleBatGeo = new THREE.CylinderGeometry(0.0024, 0.0014, 0.018, 10);
  toggleBatGeo.rotateX(Math.PI / 2);
  const toggleTipGeo = new THREE.SphereGeometry(0.0025, 10, 8);

  const toggleLevers = [];
  for (let i = 0; i < toggleXs.length; i += 1) {
    const tWrap = new THREE.Group();
    tWrap.position.set(toggleXs[i], -0.0295, 0.0025);

    const nut = setShadow(new THREE.Mesh(toggleNutGeo, brightBrassMat));
    nut.position.z = 0.002;
    tWrap.add(nut);

    const collar = setShadow(new THREE.Mesh(toggleCollarGeo, darkPatinaBrassMat));
    collar.position.z = 0.0055;
    tWrap.add(collar);

    const leverPivot = new THREE.Group();
    leverPivot.position.z = 0.0075;
    leverPivot.rotation.x = i % 2 === 0 ? -0.42 : 0.42;

    const bat = setShadow(new THREE.Mesh(toggleBatGeo, polishedSteelMat));
    bat.position.z = 0.009;
    leverPivot.add(bat);

    const tip = setShadow(new THREE.Mesh(toggleTipGeo, polishedSteelMat));
    tip.position.z = 0.018;
    leverPivot.add(tip);

    tWrap.add(leverPivot);
    facePanel.add(tWrap);
    toggleLevers.push(leverPivot);
  }

  group.add(consoleGroup);

  // -------------------------------------------------------------------------
  // 4. Two Large 8-Spoked Antique-Brass Tape Reels + Rear Cast Stanchions
  // -------------------------------------------------------------------------
  const REEL_X = 0.218;
  const REEL_Y = 0.212;
  const REEL_Z = -0.016;
  const REEL_OUTER_R = 0.086;
  const REEL_PAPER_R = 0.062;

  const reels = [];

  function buildSpokedReel(sideSign) {
    const mountGroup = new THREE.Group();
    mountGroup.name = sideSign < 0 ? 'LeftTapeReelAssembly' : 'RightTapeReelAssembly';
    const xPos = sideSign * REEL_X;

    // Rear cast blackened-steel A-frame stanchion rising cleanly from deck (z = -0.098 .. -0.056)
    const stanchionBase = setShadow(new THREE.Mesh(new THREE.BoxGeometry(0.068, 0.012, 0.062), blackenedSteelMat));
    stanchionBase.position.set(xPos, 0.07, -0.088);
    mountGroup.add(stanchionBase);

    const legGeo = new THREE.BoxGeometry(0.014, 0.148, 0.022);
    const legL = setShadow(new THREE.Mesh(legGeo, blackenedSteelMat));
    legL.position.set(xPos - 0.016, 0.142, -0.086);
    legL.rotation.z = -0.09;
    const legR = setShadow(new THREE.Mesh(legGeo, blackenedSteelMat));
    legR.position.set(xPos + 0.016, 0.142, -0.086);
    legR.rotation.z = 0.09;
    mountGroup.add(legL, legR);

    // Brass pillow-block bearing housing + horizontal steel axle shaft
    const bearingHousing = setShadow(
      new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.02, 0.044, 18), antiqueBrassMat)
    );
    bearingHousing.rotation.x = Math.PI / 2;
    bearingHousing.position.set(xPos, REEL_Y, -0.076);
    mountGroup.add(bearingHousing);

    // Brass oil cup atop pillow block
    const oilCup = setShadow(new THREE.Mesh(new THREE.CylinderGeometry(0.0045, 0.0032, 0.011, 10), brightBrassMat));
    oilCup.position.set(xPos, REEL_Y + 0.022, -0.076);
    mountGroup.add(oilCup);

    const axleShaft = setShadow(new THREE.Mesh(new THREE.CylinderGeometry(0.0072, 0.0072, 0.122, 16), polishedSteelMat));
    axleShaft.rotation.x = Math.PI / 2;
    axleShaft.position.set(xPos, REEL_Y, -0.04);
    mountGroup.add(axleShaft);

    // Spinning spoked brass reel + coiled paper roll
    const rotor = new THREE.Group();
    rotor.position.set(xPos, REEL_Y, REEL_Z);

    const flangeRimGeo = new THREE.TorusGeometry(REEL_OUTER_R - 0.004, 0.004, 12, 44);
    const flangeInnerRimGeo = new THREE.TorusGeometry(0.023, 0.0026, 8, 24);
    const spokeGeo = new THREE.BoxGeometry(0.0064, REEL_OUTER_R - 0.024, 0.0032);
    const spokeCollarGeo = new THREE.CylinderGeometry(0.004, 0.004, 0.0044, 8);
    spokeCollarGeo.rotateX(Math.PI / 2);

    // Front (+0.025) and Rear (-0.025) 8-spoked machined brass flanges (instanced spokes & rivets)
    const spokeInst = new THREE.InstancedMesh(spokeGeo, antiqueBrassMat, 16);
    spokeInst.castShadow = true;
    spokeInst.receiveShadow = true;
    const rivetInst = new THREE.InstancedMesh(spokeCollarGeo, brightBrassMat, 16);
    rivetInst.castShadow = true;
    rivetInst.receiveShadow = true;
    const instObj = new THREE.Object3D();
    let idx = 0;

    for (const fz of [-0.025, 0.025]) {
      const outerRim = setShadow(new THREE.Mesh(flangeRimGeo, antiqueBrassMat));
      outerRim.position.z = fz;
      rotor.add(outerRim);

      const innerRim = setShadow(new THREE.Mesh(flangeInnerRimGeo, brightBrassMat));
      innerRim.position.z = fz;
      rotor.add(innerRim);

      for (let s = 0; s < 8; s += 1) {
        const ang = (s / 8) * Math.PI * 2;
        const midR = 0.021 + (REEL_OUTER_R - 0.024) * 0.5;
        instObj.position.set(Math.cos(ang) * midR, Math.sin(ang) * midR, fz);
        instObj.rotation.set(0, 0, ang - Math.PI / 2);
        instObj.scale.set(1, 1, 1);
        instObj.updateMatrix();
        spokeInst.setMatrixAt(idx, instObj.matrix);

        instObj.position.set(Math.cos(ang) * (REEL_OUTER_R - 0.005), Math.sin(ang) * (REEL_OUTER_R - 0.005), fz);
        instObj.rotation.set(0, 0, 0);
        instObj.updateMatrix();
        rivetInst.setMatrixAt(idx, instObj.matrix);
        idx += 1;
      }
    }
    spokeInst.instanceMatrix.needsUpdate = true;
    rivetInst.instanceMatrix.needsUpdate = true;
    rotor.add(spokeInst, rivetInst);

    // Central brass hub drum & front hex retaining nut
    const hub = setShadow(new THREE.Mesh(new THREE.CylinderGeometry(0.021, 0.021, 0.056, 20), brightBrassMat));
    hub.rotation.x = Math.PI / 2;
    rotor.add(hub);

    const lockNut = setShadow(new THREE.Mesh(new THREE.CylinderGeometry(0.011, 0.011, 0.01, 6), darkPatinaBrassMat));
    lockNut.rotation.x = Math.PI / 2;
    lockNut.position.z = 0.032;
    rotor.add(lockNut);

    // Coiled cream archival paper roll sandwiched cleanly between the flanges
    const rollR = sideSign < 0 ? REEL_PAPER_R : REEL_PAPER_R - 0.003;
    const paperRoll = setShadow(
      new THREE.Mesh(
        new THREE.CylinderGeometry(rollR, rollR, 0.044, 36),
        [paperRollEdgeMat, paperRollSideMat, paperRollSideMat]
      )
    );
    paperRoll.rotation.x = Math.PI / 2;
    rotor.add(paperRoll);

    mountGroup.add(rotor);
    group.add(mountGroup);
    return rotor;
  }

  reels.push(buildSpokedReel(-1), buildSpokedReel(1));

  // -------------------------------------------------------------------------
  // 5. Tensioned Cream Paper Tape Bridge & Flanged Steel Guide Rollers
  // -------------------------------------------------------------------------
  const bridgeGroup = new THREE.Group();
  bridgeGroup.name = 'PaperTapeBridge';

  // Machined brass central read/write platen bed (supports tape at y = 0.1665)
  const platenTop = setShadow(new THREE.Mesh(new THREE.BoxGeometry(0.208, 0.009, 0.052), antiqueBrassMat));
  platenTop.position.set(0, 0.161, REEL_Z);
  bridgeGroup.add(platenTop);

  // Front beveled brass registration lip with center crimson head pointer mark
  const platenFrontLip = setShadow(new THREE.Mesh(new THREE.BoxGeometry(0.212, 0.012, 0.006), brightBrassMat));
  platenFrontLip.position.set(0, 0.158, REEL_Z + 0.028);
  bridgeGroup.add(platenFrontLip);

  const headTickPointer = setShadow(new THREE.Mesh(new THREE.ConeGeometry(0.0045, 0.012, 4), crimsonNeedleMat));
  headTickPointer.position.set(0, 0.167, REEL_Z + 0.027);
  headTickPointer.rotation.y = Math.PI / 4;
  bridgeGroup.add(headTickPointer);

  // Twin turned brass support columns anchoring platen bed solidly to steel deck
  const colGeo = new THREE.CylinderGeometry(0.0075, 0.01, 0.094, 14);
  const colBaseGeo = new THREE.CylinderGeometry(0.015, 0.016, 0.007, 14);
  for (const cx of [-0.09, 0.09]) {
    const col = setShadow(new THREE.Mesh(colGeo, antiqueBrassMat));
    col.position.set(cx, 0.111, REEL_Z);
    bridgeGroup.add(col);

    const colBase = setShadow(new THREE.Mesh(colBaseGeo, darkPatinaBrassMat));
    colBase.position.set(cx, 0.0675, REEL_Z);
    bridgeGroup.add(colBase);
  }

  // Polished steel flanged guide rollers flanking the platen (clear of reel flanges at ±0.132!)
  const guideRollers = [];
  const rollerConfigs = [
    { x: -0.118, y: 0.157 },
    { x: 0.118, y: 0.157 },
  ];
  const rollerDrumGeo = new THREE.CylinderGeometry(0.0075, 0.0075, 0.048, 18);
  rollerDrumGeo.rotateX(Math.PI / 2);
  const rollerFlangeGeo = new THREE.CylinderGeometry(0.011, 0.011, 0.0022, 18);
  rollerFlangeGeo.rotateX(Math.PI / 2);
  const rollerBracketGeo = new THREE.BoxGeometry(0.01, 0.096, 0.01);

  for (const rc of rollerConfigs) {
    // Rear bracket holding the guide roller from the deck
    const bracket = setShadow(new THREE.Mesh(rollerBracketGeo, blackenedSteelMat));
    bracket.position.set(rc.x, 0.112, REEL_Z - 0.031);
    bridgeGroup.add(bracket);

    const rPivot = new THREE.Group();
    rPivot.position.set(rc.x, rc.y, REEL_Z);

    const drum = setShadow(new THREE.Mesh(rollerDrumGeo, polishedSteelMat));
    rPivot.add(drum);

    for (const fz of [-0.024, 0.024]) {
      const fl = setShadow(new THREE.Mesh(rollerFlangeGeo, brightBrassMat));
      fl.position.z = fz;
      rPivot.add(fl);
    }
    // End axle pin into bracket
    const pin = setShadow(new THREE.Mesh(new THREE.CylinderGeometry(0.003, 0.003, 0.068, 10), polishedSteelMat));
    pin.rotation.x = Math.PI / 2;
    pin.position.z = -0.006;
    rPivot.add(pin);

    bridgeGroup.add(rPivot);
    guideRollers.push(rPivot);
  }

  // Tensioned live CanvasTexture paper tape ribbon
  const tapeGeo = createTapeRibbonGeometry(THREE, 0.042);
  const tapeMesh = setShadow(new THREE.Mesh(tapeGeo, tapeMat), true, true);
  tapeMesh.position.set(0, 0.0005, REEL_Z);
  bridgeGroup.add(tapeMesh);

  group.add(bridgeGroup);

  // -------------------------------------------------------------------------
  // 6. Central C-Frame Read/Write Head Carriage, Reciprocating Stamp Hammer,
  //    Mechanical Cam Shaft, Toothed Brass Gears, Copper Relay Coils & Vacuum Tube
  // -------------------------------------------------------------------------
  const gantryGroup = new THREE.Group();
  gantryGroup.name = 'ReadWriteGantry';

  // Rear heavy blackened-steel C-frame column (z: -0.118 .. -0.058, y: 0.064 .. 0.258)
  const gantryBase = setShadow(new THREE.Mesh(new THREE.BoxGeometry(0.118, 0.014, 0.072), blackenedSteelMat));
  gantryBase.position.set(0, 0.071, -0.088);
  gantryGroup.add(gantryBase);

  const gantrySpine = setShadow(new THREE.Mesh(new THREE.BoxGeometry(0.088, 0.184, 0.044), blackenedSteelMat));
  gantrySpine.position.set(0, 0.164, -0.084);
  gantryGroup.add(gantrySpine);

  // Machined brass side cheek plates on gantry tower
  for (const sx of [-1, 1]) {
    const cheek = setShadow(new THREE.Mesh(new THREE.BoxGeometry(0.005, 0.168, 0.052), antiqueBrassMat));
    cheek.position.set(sx * 0.046, 0.166, -0.082);
    gantryGroup.add(cheek);
  }

  // Overhead cantilevered head bridge arm extending forward over active tape cell
  const headArm = setShadow(new THREE.Mesh(new THREE.BoxGeometry(0.076, 0.024, 0.106), blackenedSteelMat));
  headArm.position.set(0, 0.244, -0.044);
  gantryGroup.add(headArm);

  const headCap = setShadow(new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.005, 0.11), brightBrassMat));
  headCap.position.set(0, 0.257, -0.044);
  gantryGroup.add(headCap);

  // Front brass optical reading aperture frame hovering directly over the head cell
  const apertureCollar = setShadow(
    new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.018, 0.022, 20), antiqueBrassMat)
  );
  apertureCollar.position.set(0, 0.236, REEL_Z);
  gantryGroup.add(apertureCollar);

  // Reciprocating Vertical Stamp Hammer Assembly (animates sharply on triggerStepPulse)
  const hammerGroup = new THREE.Group();
  const HAMMER_REST_Y = 0.0;
  hammerGroup.position.set(0, HAMMER_REST_Y, REEL_Z);

  const hammerShaft = setShadow(new THREE.Mesh(new THREE.CylinderGeometry(0.0044, 0.0044, 0.094, 14), polishedSteelMat));
  hammerShaft.position.set(0, 0.228, 0);
  hammerGroup.add(hammerShaft);

  const hammerHeadCrown = setShadow(
    new THREE.Mesh(new THREE.CylinderGeometry(0.0095, 0.0075, 0.01, 16), brightBrassMat)
  );
  hammerHeadCrown.position.set(0, 0.276, 0);
  hammerGroup.add(hammerHeadCrown);

  const hammerCollar = setShadow(new THREE.Mesh(new THREE.CylinderGeometry(0.011, 0.011, 0.008, 16), brightBrassMat));
  hammerCollar.position.set(0, 0.194, 0);
  hammerGroup.add(hammerCollar);

  // Typewriter ink-stamp striker foot positioned just above active head cell
  const stampFoot = setShadow(new THREE.Mesh(new THREE.BoxGeometry(0.016, 0.007, 0.024), blackenedSteelMat));
  stampFoot.position.set(0, 0.184, 0);
  hammerGroup.add(stampFoot);

  const stampPad = setShadow(new THREE.Mesh(new THREE.BoxGeometry(0.012, 0.003, 0.018), crimsonNeedleMat));
  stampPad.position.set(0, 0.1795, 0);
  hammerGroup.add(stampPad);

  // Helical coiled steel return spring around hammer shaft
  const springPts = [];
  const springTurns = 6;
  for (let i = 0; i <= 72; i += 1) {
    const t = i / 72;
    const ang = t * springTurns * Math.PI * 2;
    springPts.push(new THREE.Vector3(Math.cos(ang) * 0.0085, 0.197 + t * 0.032, Math.sin(ang) * 0.0085));
  }
  const springGeo = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(springPts), 72, 0.0012, 6, false);
  const springMesh = setShadow(new THREE.Mesh(springGeo, polishedSteelMat));
  hammerGroup.add(springMesh);

  gantryGroup.add(hammerGroup);

  // Mechanical Cam Shaft & Interlocking Toothed Brass Gears (y = 0.214, z = -0.064)
  const camShaftPivot = new THREE.Group();
  camShaftPivot.position.set(0, 0.214, -0.062);

  const camRod = setShadow(new THREE.Mesh(new THREE.CylinderGeometry(0.0046, 0.0046, 0.164, 14), polishedSteelMat));
  camRod.rotation.z = Math.PI / 2;
  camShaftPivot.add(camRod);

  // Eccentric brass cam lobe in center
  const camLobe = setShadow(new THREE.Mesh(new THREE.CylinderGeometry(0.013, 0.013, 0.012, 18), brightBrassMat));
  camLobe.rotation.z = Math.PI / 2;
  camLobe.position.set(0, 0.0045, 0);
  camShaftPivot.add(camLobe);

  // Primary 16-tooth brass spur gear on right side of cam shaft
  const gear16Geo = createGearGeometry(THREE, 16, 0.025, 0.02, 0.005, 0.006);
  const mainGear = setShadow(new THREE.Mesh(gear16Geo, brightBrassMat));
  mainGear.rotation.y = Math.PI / 2;
  mainGear.position.set(0.058, 0, 0);
  camShaftPivot.add(mainGear);

  // Secondary brass flywheel disc on left side of cam shaft
  const flywheel = setShadow(new THREE.Mesh(new THREE.CylinderGeometry(0.024, 0.024, 0.006, 24), antiqueBrassMat));
  flywheel.rotation.z = Math.PI / 2;
  flywheel.position.set(-0.058, 0, 0);
  camShaftPivot.add(flywheel);

  gantryGroup.add(camShaftPivot);

  // Meshed 12-tooth brass pinion gear turning counter-rotationally below mainGear
  const pinionPivot = new THREE.Group();
  pinionPivot.position.set(0.058, 0.1755, -0.062);
  const gear12Geo = createGearGeometry(THREE, 12, 0.0175, 0.0135, 0.0042, 0.006);
  const pinionGear = setShadow(new THREE.Mesh(gear12Geo, antiqueBrassMat));
  pinionGear.rotation.y = Math.PI / 2;
  pinionPivot.add(pinionGear);
  gantryGroup.add(pinionPivot);

  // Twin Copper Electromagnetic Relay Coils flanking the central gantry
  const relayArmatures = [];
  const coilBobbinFlangeGeo = new THREE.CylinderGeometry(0.021, 0.021, 0.004, 20);
  const coilWindingGeo = new THREE.CylinderGeometry(0.0185, 0.0185, 0.064, 22);
  const coilCoreGeo = new THREE.CylinderGeometry(0.007, 0.007, 0.078, 14);

  for (const sx of [-1, 1]) {
    const rx = sx * 0.098;
    const rz = -0.104;
    const rGroup = new THREE.Group();
    rGroup.position.set(rx, 0.064, rz);

    const basePlate = setShadow(new THREE.Mesh(new THREE.BoxGeometry(0.048, 0.006, 0.048), darkPatinaBrassMat));
    basePlate.position.y = 0.003;
    rGroup.add(basePlate);

    const botFlange = setShadow(new THREE.Mesh(coilBobbinFlangeGeo, brightBrassMat));
    botFlange.position.y = 0.01;
    rGroup.add(botFlange);

    const winding = setShadow(new THREE.Mesh(coilWindingGeo, copperCoilMat));
    winding.position.y = 0.044;
    rGroup.add(winding);

    const topFlange = setShadow(new THREE.Mesh(coilBobbinFlangeGeo, brightBrassMat));
    topFlange.position.y = 0.078;
    rGroup.add(topFlange);

    const core = setShadow(new THREE.Mesh(coilCoreGeo, polishedSteelMat));
    core.position.y = 0.046;
    rGroup.add(core);

    // Brass binding posts & cloth-insulated copper lead wires
    const post = setShadow(new THREE.Mesh(new THREE.CylinderGeometry(0.0035, 0.0035, 0.014, 10), brightBrassMat));
    post.position.set(sx * 0.017, 0.012, 0.018);
    rGroup.add(post);

    // Pivoting blackened-steel electromagnetic relay clapper bar
    const clapperPivot = new THREE.Group();
    clapperPivot.position.set(sx * 0.018, 0.091, 0);
    const clapperBar = setShadow(new THREE.Mesh(new THREE.BoxGeometry(0.036, 0.004, 0.012), blackenedSteelMat));
    clapperBar.position.set(-sx * 0.016, 0, 0);
    clapperPivot.add(clapperBar);
    rGroup.add(clapperPivot);
    relayArmatures.push({ pivot: clapperPivot, side: sx });

    // Curved braided lead wire routing into rear gantry base
    const wireCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(rx + sx * 0.017, 0.076, rz + 0.018),
      new THREE.Vector3(rx - sx * 0.008, 0.072, rz + 0.036),
      new THREE.Vector3(sx * 0.048, 0.076, -0.078),
    ]);
    const wireMesh = setShadow(new THREE.Mesh(new THREE.TubeGeometry(wireCurve, 16, 0.0022, 6, false), braidedWireMat));
    gantryGroup.add(wireMesh);

    gantryGroup.add(rGroup);
  }

  // -------------------------------------------------------------------------
  // 7. Glowing 1936 Triode Vacuum Tube Indicator (Apex y = 0.336 <= 0.35)
  //    Warm amber while active/ready; shifts to luminous jade on HALT / crimson on REJECT
  // -------------------------------------------------------------------------
  const tubeGroup = new THREE.Group();
  tubeGroup.name = 'VacuumTubeIndicator';
  tubeGroup.position.set(0, 0.258, -0.074);

  // Phenolic bakelite octal socket & brass collar
  const socketBase = setShadow(new THREE.Mesh(new THREE.CylinderGeometry(0.0175, 0.019, 0.013, 20), bakeliteMat));
  socketBase.position.y = 0.0065;
  tubeGroup.add(socketBase);

  const socketCollar = setShadow(new THREE.Mesh(new THREE.CylinderGeometry(0.0155, 0.0165, 0.006, 20), brightBrassMat));
  socketCollar.position.y = 0.015;
  tubeGroup.add(socketCollar);

  // Internal blackened-steel anode cage & mica discs
  const anodePlate = setShadow(new THREE.Mesh(new THREE.CylinderGeometry(0.0068, 0.0068, 0.032, 6, 1, true), blackenedSteelMat));
  anodePlate.material = blackenedSteelMat.clone();
  anodePlate.material.side = THREE.DoubleSide;
  anodePlate.position.y = 0.037;
  tubeGroup.add(anodePlate);

  const micaGeo = new THREE.CylinderGeometry(0.009, 0.009, 0.0014, 12);
  const micaBot = setShadow(new THREE.Mesh(micaGeo, darkPatinaBrassMat), false, false);
  micaBot.position.y = 0.022;
  const micaTop = micaBot.clone();
  micaTop.position.y = 0.052;
  tubeGroup.add(micaBot, micaTop);

  // Glowing tungsten filament & inner luminous halo
  const filamentMat = new THREE.MeshStandardMaterial({
    color: 0xffc670,
    emissive: 0xff8c24,
    emissiveIntensity: 3.4,
    roughness: 0.2,
    metalness: 0.1,
  });
  const filamentMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.0022, 0.0022, 0.038, 10), filamentMat);
  filamentMesh.position.y = 0.038;
  tubeGroup.add(filamentMesh);

  const glowCoreMat = new THREE.MeshBasicMaterial({
    color: 0xff9a34,
    transparent: true,
    opacity: 0.44,
    depthWrite: false,
  });
  const glowCore = new THREE.Mesh(new THREE.SphereGeometry(0.0115, 16, 12), glowCoreMat);
  glowCore.scale.set(0.85, 1.55, 0.85);
  glowCore.position.y = 0.04;
  tubeGroup.add(glowCore);

  // Classic 1936 shouldered ST-bulb glass envelope (LatheGeometry, height 0.062 -> apex y = 0.336)
  const bulbPts = [
    new THREE.Vector2(0.0138, 0.016),
    new THREE.Vector2(0.0156, 0.026),
    new THREE.Vector2(0.0164, 0.042),
    new THREE.Vector2(0.0145, 0.054),
    new THREE.Vector2(0.0102, 0.063),
    new THREE.Vector2(0.0082, 0.07),
    new THREE.Vector2(0.0045, 0.0755),
    new THREE.Vector2(0.0, 0.0775),
  ];
  const bulbGeo = new THREE.LatheGeometry(bulbPts, 24);
  const bulbGlassMat = new THREE.MeshPhysicalMaterial({
    color: 0xfff4e2,
    roughness: 0.06,
    metalness: 0.04,
    clearcoat: 1.0,
    clearcoatRoughness: 0.05,
    transparent: true,
    opacity: 0.28,
    depthWrite: false,
  });
  const bulbMesh = new THREE.Mesh(bulbGeo, bulbGlassMat);
  bulbMesh.castShadow = false;
  bulbMesh.receiveShadow = false;
  tubeGroup.add(bulbMesh);

  // Subtle warm local point light (non-shadow for zero render-pass cost)
  const tubeLight = new THREE.PointLight(0xff922e, 0.32, 0.36, 2.0);
  tubeLight.position.set(0, 0.046, 0.008);
  tubeLight.castShadow = false;
  tubeGroup.add(tubeLight);

  gantryGroup.add(tubeGroup);
  group.add(gantryGroup);

  // -------------------------------------------------------------------------
  // 8. Live Mechanical Kinematics & Animation State
  // -------------------------------------------------------------------------
  const REEL_RAD_PER_CELL = 0.44;
  const ROLLER_RAD_PER_CELL = 1.95;
  const MIN_DIAL_RAD = (135 * Math.PI) / 180; // -135 deg visual (left stop = +135 deg Z rotation)
  const MAX_DIAL_RAD = (-135 * Math.PI) / 180; // +135 deg visual (right stop = -135 deg Z rotation)

  let internalElapsed = 0;
  let pulsePhase = 0; // 1 -> 0 after triggerStepPulse
  let pulseDir = 0;
  let camAngle = 0;
  let camTargetAngle = 0;

  let reelAngle = 0;
  let targetReelAngle = 0;
  let rollerAngle = 0;
  let targetRollerAngle = 0;

  // Spring-damped gauge needles
  let stepNeedleAngle = MIN_DIAL_RAD;
  let stateNeedleAngle = MIN_DIAL_RAD;
  let tensionAngle = 0;
  let tensionVel = 0;

  // Tape update caching
  let lastTapeSignature = '';
  let lastHead = null;
  let lastStepCount = 0;
  let tapeSlideOffset = 0;

  // Smooth vacuum tube tint blending
  const colorAmber = new THREE.Color(0xff8c24);
  const colorJade = new THREE.Color(0x3ce882);
  const colorRuby = new THREE.Color(0xff3b30);
  const activeTubeColor = colorAmber.clone();

  function triggerStepPulse(moveDir = 0) {
    const dir = moveDir > 0 ? 1 : moveDir < 0 ? -1 : 0;
    pulsePhase = 1.0;
    pulseDir = dir;
    camTargetAngle += Math.PI * 0.5;
    if (dir !== 0) {
      tensionVel += dir * 13.5;
      tapeSlideOffset = dir * 0.018;
    } else {
      tensionVel += 4.2;
    }
  }

  function update(dt, utmState, elapsed) {
    const safeDt = Math.min(Math.max(Number.isFinite(dt) ? dt : 0.016, 0), 0.1);
    internalElapsed = Number.isFinite(elapsed) ? elapsed : internalElapsed + safeDt;

    // 1. Synchronize live tape canvas, reels & needles from utmState
    let isHalted = false;
    let isRejected = false;
    let stepTargetRad = MIN_DIAL_RAD;
    let stateTargetRad = MIN_DIAL_RAD;

    if (utmState) {
      isHalted = Boolean(utmState.halted);
      isRejected = utmState.state === 'REJECT';

      const head = Number.isFinite(utmState.head) ? utmState.head : 0;
      const stepCount = Number.isFinite(utmState.stepCount) ? utmState.stepCount : 0;

      // Keep reels locked to exact head displacement (works even without triggerStepPulse)
      if (lastHead === null) {
        lastHead = head;
        targetReelAngle = -head * REEL_RAD_PER_CELL;
        reelAngle = targetReelAngle;
        targetRollerAngle = -head * ROLLER_RAD_PER_CELL;
        rollerAngle = targetRollerAngle;
      } else if (head !== lastHead) {
        const delta = head - lastHead;
        targetReelAngle = -head * REEL_RAD_PER_CELL;
        targetRollerAngle = -head * ROLLER_RAD_PER_CELL;
        if (pulsePhase < 0.15 && stepCount > lastStepCount) {
          triggerStepPulse(delta > 0 ? 1 : -1);
        }
        lastHead = head;
      }

      if (stepCount === 0 && lastStepCount > 0) {
        // Program reset: rewind cam gently
        tensionVel -= tensionAngle * 6.0;
      }
      lastStepCount = stepCount;

      // Redraw live CanvasTexture ONLY when visible tape symbols / head / halt status change
      const win = Array.isArray(utmState.tapeWindow) ? utmState.tapeWindow : [];
      const sig = `${utmState.programId || ''}|${head}|${isHalted ? 1 : 0}|${win.map((c) => c.sym).join('')}`;
      if (sig !== lastTapeSignature) {
        lastTapeSignature = sig;
        renderTapeCanvas(tapeCanvas, utmState);
        if (tapeTexture) {
          tapeTexture.needsUpdate = true;
        }
      }

      // Compute analog dial target angles
      const stepFrac = (stepCount % 50) / 50;
      stepTargetRad = MIN_DIAL_RAD + stepFrac * (MAX_DIAL_RAD - MIN_DIAL_RAD);

      let stateFrac = 0;
      if (isHalted) {
        stateFrac = 1.0;
      } else if (Number.isFinite(utmState.stateIndex) && Number.isFinite(utmState.stateCount) && utmState.stateCount > 1) {
        stateFrac = Math.min(0.86, utmState.stateIndex / (utmState.stateCount - 1));
      } else if (typeof utmState.state === 'string') {
        let h = 0;
        for (let i = 0; i < utmState.state.length; i += 1) h = (h * 31 + utmState.state.charCodeAt(i)) % 7;
        stateFrac = h / 7;
      }
      stateTargetRad = MIN_DIAL_RAD + stateFrac * (MAX_DIAL_RAD - MIN_DIAL_RAD);

      // Subtly articulate console toggle switches to mirror machine state bits
      const stateBits = (utmState.stateIndex ?? 0) ^ (isHalted ? 0b1111 : 0b0101);
      for (let i = 0; i < toggleLevers.length; i += 1) {
        const bitOn = ((stateBits >> i) & 1) === 1;
        const targetTilt = bitOn ? -0.44 : 0.44;
        toggleLevers[i].rotation.x += (targetTilt - toggleLevers[i].rotation.x) * Math.min(1, safeDt * 14);
      }

      // Subtly turn inner tuning knobs with step & state
      if (rotaryKnobs.length >= 6) {
        const kTargetA = -0.8 + stepFrac * 2.2;
        const kTargetB = -0.6 + stateFrac * 2.0;
        rotaryKnobs[2].rotation.z += (kTargetA - rotaryKnobs[2].rotation.z) * Math.min(1, safeDt * 8);
        rotaryKnobs[3].rotation.z += (kTargetB - rotaryKnobs[3].rotation.z) * Math.min(1, safeDt * 8);
      }
    }

    // 2. Smoothly spin spoked reels, guide rollers & tape micro-slide
    const reelLerp = Math.min(1, safeDt * 14.0);
    reelAngle += (targetReelAngle - reelAngle) * reelLerp;
    rollerAngle += (targetRollerAngle - rollerAngle) * reelLerp;

    for (let i = 0; i < reels.length; i += 1) {
      reels[i].rotation.z = reelAngle;
    }
    for (let i = 0; i < guideRollers.length; i += 1) {
      guideRollers[i].rotation.z = rollerAngle;
    }

    if (tapeTexture) {
      tapeSlideOffset += (0 - tapeSlideOffset) * Math.min(1, safeDt * 18.0);
      tapeTexture.offset.x = tapeSlideOffset;
    }

    // 3. Reciprocating Vertical Stamp Hammer, Cam Shaft, Gears & Relay Clappers
    if (pulsePhase > 0) {
      pulsePhase = Math.max(0, pulsePhase - safeDt * 4.2);
    }

    // Sharp downward strike peaking near pulsePhase = 0.72, then damped return
    let hammerDrop = 0;
    if (pulsePhase > 0.001) {
      const p = 1.0 - pulsePhase; // 0 -> 1
      if (p < 0.28) {
        hammerDrop = Math.sin((p / 0.28) * Math.PI * 0.5);
      } else {
        const r = (p - 0.28) / 0.72;
        hammerDrop = Math.cos(r * Math.PI * 0.5) * Math.exp(-r * 2.2);
      }
    }
    hammerGroup.position.y = HAMMER_REST_Y - hammerDrop * 0.0155;

    // Cam shaft & interlocking spur gears
    camAngle += (camTargetAngle - camAngle) * Math.min(1, safeDt * 16.0);
    camShaftPivot.rotation.x = camAngle;
    pinionPivot.rotation.x = -camAngle * (16 / 12);

    // Electromagnetic relay armature clappers snap tightly during step strike
    for (let i = 0; i < relayArmatures.length; i += 1) {
      const ra = relayArmatures[i];
      const kick = pulsePhase > 0.35 ? (pulseDir === ra.side || pulseDir === 0 ? 0.16 : 0.07) : 0;
      const targetRot = -ra.side * (0.06 - kick);
      ra.pivot.rotation.z += (targetRot - ra.pivot.rotation.z) * Math.min(1, safeDt * 24);
    }

    // 4. Analog Gauge Needle Kinematics
    const dialLerp = Math.min(1, safeDt * 11.0);
    stepNeedleAngle += (stepTargetRad - stepNeedleAngle) * dialLerp;
    stateNeedleAngle += (stateTargetRad - stateNeedleAngle) * dialLerp;

    // Second-order damped harmonic oscillator for Tape Tension galvanometer needle
    const springK = 88.0;
    const damping = 9.5;
    const accel = -springK * tensionAngle - damping * tensionVel;
    tensionVel += accel * safeDt;
    tensionAngle = Math.max(-1.85, Math.min(1.85, tensionAngle + tensionVel * safeDt));

    const microJitter = pulsePhase > 0.1 ? Math.sin(internalElapsed * 55) * 0.04 * pulsePhase : 0;
    if (gaugeNeedles.steps) gaugeNeedles.steps.rotation.z = stepNeedleAngle + microJitter * 0.4;
    if (gaugeNeedles.state) gaugeNeedles.state.rotation.z = stateNeedleAngle;
    if (gaugeNeedles.tension) gaugeNeedles.tension.rotation.z = -tensionAngle + microJitter;

    // 5. Glowing Triode Vacuum Tube Indicator (warm amber -> luminous jade on HALT / ruby on REJECT)
    const targetColor = isHalted ? (isRejected ? colorRuby : colorJade) : colorAmber;
    activeTubeColor.lerp(targetColor, Math.min(1, safeDt * 6.0));

    const breathe = 0.92 + 0.08 * Math.sin(internalElapsed * 3.1) + 0.03 * Math.sin(internalElapsed * 11.7);
    const pulseSurge = 1.0 + pulsePhase * 0.42;

    filamentMat.emissive.copy(activeTubeColor);
    filamentMat.emissiveIntensity = (isHalted ? 4.0 : 3.2) * breathe * pulseSurge;
    glowCoreMat.color.copy(activeTubeColor);
    glowCoreMat.opacity = (isHalted ? 0.52 : 0.42) * breathe;
    tubeLight.color.copy(activeTubeColor);
    tubeLight.intensity = (isHalted ? 0.42 : 0.3) * breathe * pulseSurge;
  }

  return {
    group,
    update,
    triggerStepPulse,
  };
}
