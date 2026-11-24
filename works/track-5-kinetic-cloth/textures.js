import * as THREE from 'three';

function makeRand(seed) {
  let s = seed | 0;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) | 0;
    return (s >>> 0) / 4294967296;
  };
}

export function createWalnutTextures() {
  const w = 512;
  const h = 512;
  const rand = makeRand(4201);

  const colorCanvas = document.createElement('canvas');
  colorCanvas.width = w;
  colorCanvas.height = h;
  const ctx = colorCanvas.getContext('2d');

  const roughCanvas = document.createElement('canvas');
  roughCanvas.width = w;
  roughCanvas.height = h;
  const rCtx = roughCanvas.getContext('2d');

  const bumpCanvas = document.createElement('canvas');
  bumpCanvas.width = w;
  bumpCanvas.height = h;
  const bCtx = bumpCanvas.getContext('2d');

  // Base warm espresso-walnut fill
  ctx.fillStyle = '#331c11';
  ctx.fillRect(0, 0, w, h);

  rCtx.fillStyle = '#8c8c8c';
  rCtx.fillRect(0, 0, w, h);

  bCtx.fillStyle = '#808080';
  bCtx.fillRect(0, 0, w, h);

  const planks = 4;
  const ph = h / planks;

  for (let p = 0; p < planks; p++) {
    const py = p * ph;
    const toneShift = (rand() - 0.5) * 14;
    const baseR = Math.round(52 + toneShift);
    const baseG = Math.round(29 + toneShift * 0.55);
    const baseB = Math.round(18 + toneShift * 0.35);

    const grad = ctx.createLinearGradient(0, py, w, py + ph);
    grad.addColorStop(0, `rgb(${baseR},${baseG},${baseB})`);
    grad.addColorStop(0.5, `rgb(${baseR + 10},${baseG + 6},${baseB + 4})`);
    grad.addColorStop(1, `rgb(${baseR - 4},${baseG - 2},${baseB - 1})`);
    ctx.fillStyle = grad;
    ctx.fillRect(0, py, w, ph);

    // Roughness variation per plank (0.46 .. 0.64)
    const rTone = Math.round(122 + (rand() - 0.5) * 24);
    rCtx.fillStyle = `rgb(${rTone},${rTone},${rTone})`;
    rCtx.fillRect(0, py, w, ph);

    // Rich longitudinal wood grain fibers & subtle cathedrals
    for (let i = 0; i < 65; i++) {
      const gy = py + 3 + rand() * (ph - 6);
      const amp = 1.5 + rand() * 5.5;
      const freq = 0.012 + rand() * 0.018;
      const phase = rand() * Math.PI * 2;
      const dark = rand() > 0.35;

      ctx.strokeStyle = dark
        ? `rgba(22, 11, 6, ${(0.18 + rand() * 0.25).toFixed(2)})`
        : `rgba(104, 62, 34, ${(0.12 + rand() * 0.18).toFixed(2)})`;
      ctx.lineWidth = 0.8 + rand() * 1.8;

      rCtx.strokeStyle = dark ? 'rgba(170,170,170,0.22)' : 'rgba(90,90,90,0.22)';
      rCtx.lineWidth = ctx.lineWidth;

      bCtx.strokeStyle = dark ? 'rgba(55,55,55,0.28)' : 'rgba(190,190,190,0.20)';
      bCtx.lineWidth = ctx.lineWidth;

      ctx.beginPath();
      rCtx.beginPath();
      bCtx.beginPath();
      for (let x = 0; x <= w; x += 32) {
        const yy = gy + Math.sin(x * freq + phase) * amp;
        if (x === 0) {
          ctx.moveTo(x, yy);
          rCtx.moveTo(x, yy);
          bCtx.moveTo(x, yy);
        } else {
          ctx.lineTo(x, yy);
          rCtx.lineTo(x, yy);
          bCtx.lineTo(x, yy);
        }
      }
      ctx.stroke();
      rCtx.stroke();
      bCtx.stroke();
    }

    // Subtle dark plank seam & staggered butt joint
    ctx.fillStyle = 'rgba(12, 6, 4, 0.78)';
    ctx.fillRect(0, py, w, 2);
    rCtx.fillStyle = 'rgb(215,215,215)';
    rCtx.fillRect(0, py, w, 2);
    bCtx.fillStyle = 'rgb(30,30,30)';
    bCtx.fillRect(0, py, w, 2);

    const jointX = Math.round(((p * 0.37 + 0.22) % 0.85) * w);
    ctx.fillRect(jointX, py, 2, ph);
    bCtx.fillRect(jointX, py, 2, ph);
  }

  const map = new THREE.CanvasTexture(colorCanvas);
  map.colorSpace = THREE.SRGBColorSpace;
  map.wrapS = THREE.RepeatWrapping;
  map.wrapT = THREE.RepeatWrapping;
  map.repeat.set(6, 2); // 1:1 isotropic grain across 12m x 4m bench
  map.anisotropy = 4;

  const roughnessMap = new THREE.CanvasTexture(roughCanvas);
  roughnessMap.wrapS = THREE.RepeatWrapping;
  roughnessMap.wrapT = THREE.RepeatWrapping;
  roughnessMap.repeat.set(6, 2);
  roughnessMap.anisotropy = 4;

  const bumpMap = new THREE.CanvasTexture(bumpCanvas);
  bumpMap.wrapS = THREE.RepeatWrapping;
  bumpMap.wrapT = THREE.RepeatWrapping;
  bumpMap.repeat.set(6, 2);
  bumpMap.anisotropy = 4;

  return { map, roughnessMap, bumpMap };
}

export function createAtelierFloorTextures() {
  const size = 256;
  const rand = makeRand(9183);

  const cCanvas = document.createElement('canvas');
  cCanvas.width = size;
  cCanvas.height = size;
  const ctx = cCanvas.getContext('2d');

  const tiles = 4;
  const ts = size / tiles;

  for (let ty = 0; ty < tiles; ty++) {
    for (let tx = 0; tx < tiles; tx++) {
      const darkTile = (tx + ty) % 2 === 0;
      const x0 = tx * ts;
      const y0 = ty * ts;

      ctx.fillStyle = darkTile ? '#14121b' : '#201c29';
      ctx.fillRect(x0, y0, ts, ts);

      const horiz = (tx + ty) % 2 === 0;
      for (let i = 0; i < 10; i++) {
        ctx.strokeStyle = darkTile ? 'rgba(42, 36, 54, 0.28)' : 'rgba(18, 15, 22, 0.28)';
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        const off = rand() * ts;
        if (horiz) {
          ctx.moveTo(x0, y0 + off);
          ctx.lineTo(x0 + ts, y0 + off);
        } else {
          ctx.moveTo(x0 + off, y0);
          ctx.lineTo(x0 + off, y0 + ts);
        }
        ctx.stroke();
      }

      ctx.strokeStyle = '#09080d';
      ctx.lineWidth = 2;
      ctx.strokeRect(x0 + 0.5, y0 + 0.5, ts - 1, ts - 1);
    }
  }

  const map = new THREE.CanvasTexture(cCanvas);
  map.colorSpace = THREE.SRGBColorSpace;
  map.wrapS = THREE.RepeatWrapping;
  map.wrapT = THREE.RepeatWrapping;
  map.repeat.set(14, 10);
  map.anisotropy = 4;

  return { map };
}

export function createWainscotTexture() {
  const w = 512;
  const h = 256;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');

  ctx.fillStyle = '#1b1416';
  ctx.fillRect(0, 0, w, h);

  const panels = 4;
  const pw = w / panels;
  for (let i = 0; i < panels; i++) {
    const x0 = i * pw;
    ctx.fillStyle = '#23191b';
    ctx.fillRect(x0 + 12, 18, pw - 24, h - 36);

    ctx.strokeStyle = '#392822';
    ctx.lineWidth = 3;
    ctx.strokeRect(x0 + 12, 18, pw - 24, h - 36);

    ctx.strokeStyle = '#120d0e';
    ctx.lineWidth = 2;
    ctx.strokeRect(x0 + 22, 28, pw - 44, h - 56);
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.ClampToEdgeWrapping;
  tex.repeat.set(8, 1);
  return tex;
}

export function createBrassTextures() {
  const size = 256;
  const rand = makeRand(3017);

  const colorCanvas = document.createElement('canvas');
  colorCanvas.width = size;
  colorCanvas.height = size;
  const ctx = colorCanvas.getContext('2d');

  const roughCanvas = document.createElement('canvas');
  roughCanvas.width = size;
  roughCanvas.height = size;
  const rCtx = roughCanvas.getContext('2d');

  const grad = ctx.createLinearGradient(0, 0, 0, size);
  grad.addColorStop(0, '#cfa14b');
  grad.addColorStop(0.5, '#dfb563');
  grad.addColorStop(1, '#c2923c');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, size, size);

  rCtx.fillStyle = '#525252';
  rCtx.fillRect(0, 0, size, size);

  // Fine horizontal anisotropic brush streaks
  for (let i = 0; i < 180; i++) {
    const y = rand() * size;
    const x = rand() * size * 0.5;
    const len = 40 + rand() * size * 0.7;
    const bright = rand() > 0.45;
    ctx.strokeStyle = bright ? 'rgba(248, 224, 152, 0.14)' : 'rgba(110, 76, 22, 0.15)';
    ctx.lineWidth = 0.8 + rand() * 1.4;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + len, y);
    ctx.stroke();

    rCtx.strokeStyle = bright ? 'rgba(65,65,65,0.25)' : 'rgba(135,135,135,0.25)';
    rCtx.lineWidth = ctx.lineWidth;
    rCtx.beginPath();
    rCtx.moveTo(x, y);
    rCtx.lineTo(x + len, y);
    rCtx.stroke();
  }

  const map = new THREE.CanvasTexture(colorCanvas);
  map.colorSpace = THREE.SRGBColorSpace;
  map.wrapS = THREE.RepeatWrapping;
  map.wrapT = THREE.RepeatWrapping;
  map.repeat.set(2, 2);
  map.anisotropy = 4;

  const roughnessMap = new THREE.CanvasTexture(roughCanvas);
  roughnessMap.wrapS = THREE.RepeatWrapping;
  roughnessMap.wrapT = THREE.RepeatWrapping;
  roughnessMap.repeat.set(2, 2);
  roughnessMap.anisotropy = 4;

  return { map, roughnessMap };
}

export function createSilkTexture() {
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');

  const grad = ctx.createLinearGradient(0, 0, size, size);
  grad.addColorStop(0, '#095c41');
  grad.addColorStop(0.5, '#0e805b');
  grad.addColorStop(1, '#074833');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, size, size);

  // Subtle woven twill cross-hatch
  ctx.strokeStyle = 'rgba(82, 255, 184, 0.08)';
  ctx.lineWidth = 1;
  for (let i = -size; i < size * 2; i += 6) {
    ctx.beginPath();
    ctx.moveTo(i, 0);
    ctx.lineTo(i + size, size);
    ctx.stroke();
  }
  ctx.strokeStyle = 'rgba(4, 34, 24, 0.14)';
  for (let i = 0; i < size; i += 4) {
    ctx.beginPath();
    ctx.moveTo(0, i);
    ctx.lineTo(size, i);
    ctx.stroke();
  }

  // Atelier diamond crest in center
  ctx.save();
  ctx.translate(size * 0.5, size * 0.46);
  ctx.strokeStyle = 'rgba(219, 178, 92, 0.34)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(0, -52);
  ctx.lineTo(42, 0);
  ctx.lineTo(0, 52);
  ctx.lineTo(-42, 0);
  ctx.closePath();
  ctx.stroke();

  ctx.strokeStyle = 'rgba(130, 245, 198, 0.20)';
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.arc(0, 0, 24, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();

  // Embroidered antique-gold hem border
  ctx.strokeStyle = '#d7aa4c';
  ctx.lineWidth = 4;
  ctx.strokeRect(7, 7, size - 14, size - 14);

  ctx.strokeStyle = '#f2d079';
  ctx.lineWidth = 1.5;
  ctx.strokeRect(13, 13, size - 26, size - 26);

  ctx.fillStyle = 'rgba(218, 172, 76, 0.90)';
  for (let x = 18; x < size - 18; x += 14) {
    ctx.beginPath();
    ctx.moveTo(x, size - 24);
    ctx.lineTo(x + 5, size - 30);
    ctx.lineTo(x + 10, size - 24);
    ctx.lineTo(x + 5, size - 18);
    ctx.closePath();
    ctx.fill();
  }

  for (let i = 0; i < 8; i++) {
    const gx = 20 + (i / 7) * (size - 40);
    ctx.strokeStyle = '#e7c36a';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(gx, 11, 3.2, 0, Math.PI * 2);
    ctx.stroke();
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.ClampToEdgeWrapping;
  tex.wrapT = THREE.ClampToEdgeWrapping;
  tex.anisotropy = 4;
  return tex;
}

export function createContactShadowTexture() {
  const size = 128;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');

  const half = size * 0.5;
  const grad = ctx.createRadialGradient(half, half, 4, half, half, half);
  grad.addColorStop(0.0, 'rgba(6, 4, 3, 0.72)');
  grad.addColorStop(0.45, 'rgba(6, 4, 3, 0.38)');
  grad.addColorStop(0.8, 'rgba(6, 4, 3, 0.10)');
  grad.addColorStop(1.0, 'rgba(6, 4, 3, 0.0)');

  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, size, size);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export function createSparkSpriteTexture() {
  const size = 128;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');

  const half = size * 0.5;
  const grad = ctx.createRadialGradient(half, half, 0, half, half, half);
  grad.addColorStop(0.0, 'rgba(255, 255, 240, 1.0)');
  grad.addColorStop(0.18, 'rgba(255, 224, 130, 0.95)');
  grad.addColorStop(0.45, 'rgba(245, 165, 36, 0.48)');
  grad.addColorStop(0.75, 'rgba(217, 119, 6, 0.12)');
  grad.addColorStop(1.0, 'rgba(217, 119, 6, 0.0)');

  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, size, size);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export function createPlaquesAtlasTexture(plaqueData) {
  const cols = 4;
  const rows = 2;
  const cw = 256;
  const ch = 96;
  const canvas = document.createElement('canvas');
  canvas.width = cols * cw;
  canvas.height = rows * ch;
  const ctx = canvas.getContext('2d');

  plaqueData.forEach(([, numeral, label], idx) => {
    const col = idx % cols;
    const row = Math.floor(idx / cols);
    const ox = col * cw;
    const oy = row * ch;

    const grad = ctx.createLinearGradient(ox, oy, ox, oy + ch);
    grad.addColorStop(0, '#c79b47');
    grad.addColorStop(0.5, '#e2be71');
    grad.addColorStop(1, '#9b7229');
    ctx.fillStyle = grad;
    ctx.fillRect(ox, oy, cw, ch);

    ctx.fillStyle = '#24180e';
    ctx.fillRect(ox + 8, oy + 8, cw - 16, ch - 16);

    ctx.strokeStyle = '#d2a64f';
    ctx.lineWidth = 2;
    ctx.strokeRect(ox + 12, oy + 12, cw - 24, ch - 24);

    ctx.fillStyle = '#e8c97b';
    for (const [rx, ry] of [[20, 20], [cw - 20, 20], [20, ch - 20], [cw - 20, ch - 20]]) {
      ctx.beginPath();
      ctx.arc(ox + rx, oy + ry, 3.2, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.textAlign = 'center';
    ctx.fillStyle = '#f2d488';
    ctx.font = 'bold 26px Georgia, "Times New Roman", serif';
    ctx.fillText(numeral, ox + cw / 2, oy + 46);

    ctx.fillStyle = '#cfa960';
    ctx.font = '600 13px "Segoe UI", system-ui, sans-serif';
    ctx.fillText(label.toUpperCase(), ox + cw / 2, oy + 71);
  });

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

export function createArcadeAtlasTextures() {
  const titles = [
    ['POLYBIUS 84', '#f59e0b', '#14b8a6'],
    ['STAR RUNNER', '#ef4444', '#f59e0b'],
    ['VECTOR LAB', '#10b981', '#eab308'],
    ['ATELIER 83', '#f97316', '#2dd4bf'],
    ['CHRONO GRID', '#eab308', '#38bdf8'],
    ['TEMPEST II', '#fb7185', '#facc15'],
    ['ORBITRON', '#22d3ee', '#f59e0b'],
  ];

  const cols = 4;
  const rows = 2;
  const mw = 256;
  const mh = 96;
  const mCanvas = document.createElement('canvas');
  mCanvas.width = cols * mw;
  mCanvas.height = rows * mh;
  const mCtx = mCanvas.getContext('2d');

  const sw = 256;
  const sh = 256;
  const sCanvas = document.createElement('canvas');
  sCanvas.width = cols * sw;
  sCanvas.height = rows * sh;
  const sCtx = sCanvas.getContext('2d');

  for (let idx = 0; idx < titles.length; idx++) {
    const [title, primary, secondary] = titles[idx];
    const col = idx % cols;
    const row = Math.floor(idx / cols);

    const mx = col * mw;
    const my = row * mh;
    mCtx.fillStyle = '#120f17';
    mCtx.fillRect(mx, my, mw, mh);

    const mGrad = mCtx.createLinearGradient(mx, my, mx + mw, my + mh);
    mGrad.addColorStop(0, primary);
    mGrad.addColorStop(1, secondary);
    mCtx.strokeStyle = mGrad;
    mCtx.lineWidth = 4;
    mCtx.strokeRect(mx + 8, my + 8, mw - 16, mh - 16);

    mCtx.fillStyle = mGrad;
    mCtx.font = 'bold 24px monospace';
    mCtx.textAlign = 'center';
    mCtx.textBaseline = 'middle';
    mCtx.fillText(title, mx + mw / 2, my + 49);

    const sx = col * sw;
    const sy = row * sh;
    sCtx.fillStyle = '#05080d';
    sCtx.fillRect(sx, sy, sw, sh);

    sCtx.save();
    sCtx.beginPath();
    sCtx.rect(sx, sy, sw, sh);
    sCtx.clip();

    sCtx.strokeStyle = secondary;
    sCtx.globalAlpha = 0.52;
    sCtx.lineWidth = 1.5;
    for (let i = 0; i <= 6; i++) {
      const y = sy + 135 + i * 20;
      sCtx.beginPath();
      sCtx.moveTo(sx + 16, y);
      sCtx.lineTo(sx + 240, y);
      sCtx.stroke();
    }
    for (let i = -3; i <= 3; i++) {
      sCtx.beginPath();
      sCtx.moveTo(sx + 128 + i * 14, sy + 135);
      sCtx.lineTo(sx + 128 + i * 44, sy + 248);
      sCtx.stroke();
    }

    sCtx.strokeStyle = primary;
    sCtx.globalAlpha = 0.82;
    sCtx.lineWidth = 2;
    sCtx.beginPath();
    sCtx.arc(sx + 128, sy + 86, 36 + (idx % 3) * 6, 0, Math.PI * 2);
    sCtx.stroke();

    sCtx.beginPath();
    sCtx.moveTo(sx + 42, sy + 86);
    sCtx.lineTo(sx + 214, sy + 86);
    sCtx.stroke();

    sCtx.globalAlpha = 0.25;
    sCtx.fillStyle = '#000000';
    for (let y = 0; y < sh; y += 4) {
      sCtx.fillRect(sx, sy + y, sw, 1.5);
    }
    sCtx.restore();
  }

  const marqueeAtlas = new THREE.CanvasTexture(mCanvas);
  marqueeAtlas.colorSpace = THREE.SRGBColorSpace;
  const screenAtlas = new THREE.CanvasTexture(sCanvas);
  screenAtlas.colorSpace = THREE.SRGBColorSpace;

  return { marqueeAtlas, screenAtlas, cols, rows };
}
