/*
 * Chronos Calibre O-5 ??procedural canvas optics
 * Every surface finish is synthesised here at boot: Côtes de Genève striping,
 * circular perlage grain, anisotropic polished rose-gold bezel, obsidian
 * sunray back field, alligator-grain leather and the warm studio backdrop.
 * Nothing is loaded from disk or network.
 */
(function (root) {
  'use strict';

  function mk(w, h) {
    const c = document.createElement('canvas');
    c.width = w;
    c.height = h;
    return c;
  }
  function rng(seed) {
    let s = seed >>> 0;
    return () => {
      s = (s * 1664525 + 1013904223) >>> 0;
      return s / 4294967296;
    };
  }
  const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);

  /** Côtes de Genève: parallel stripes, each cut by a rotating lap ??curved arcs. */
  function cotes(o) {
    const S = o.size || 256;
    const n = o.stripes || 4;
    const w = S / n;
    const c = mk(S, S);
    const ctx = c.getContext('2d', { willReadFrequently: true });
    const img = ctx.createImageData(S, S);
    const d = img.data;
    const R = rng(o.seed || 11);
    const streak = new Float32Array(S);
    for (let i = 0; i < S; i++) streak[i] = R() - 0.5;
    for (let i = 0; i < S; i++) streak[i] = (streak[i] + streak[(i + 1) % S] + streak[(i + 2) % S]) / 3;
    const period = S / 18;
    const [dr, dg, db] = o.dark, [lr, lg, lb] = o.light;
    for (let y = 0; y < S; y++) {
      for (let x = 0; x < S; x++) {
        const s = Math.floor(x / w);
        const u = (x - s * w) / w;
        const arc = (u - 0.5) * (u - 0.5) * w * 1.7;
        const ph = (((y + arc) / period) % 1 + 1) % 1;
        let v = 0.36 + 0.54 * Math.exp(-Math.pow((u - 0.34) / 0.27, 2));
        v += 0.06 * Math.cos(ph * Math.PI * 2);
        if (u > 0.9) v -= (u - 0.9) * 2.4;
        if (u < 0.04) v -= (0.04 - u) * 3.5;
        const si = (((Math.floor(y + arc * 1.4) + s * 53) % S) + S) % S;
        v += streak[si] * 0.09 + (R() - 0.5) * 0.045;
        v = clamp01(v);
        const i = (y * S + x) * 4;
        d[i] = dr + (lr - dr) * v;
        d[i + 1] = dg + (lg - dg) * v;
        d[i + 2] = db + (lb - db) * v;
        d[i + 3] = 255;
      }
    }
    ctx.putImageData(img, 0, 0);
    return c.toDataURL('image/jpeg', 0.9);
  }

  /** Perlage: overlapping circular-grained spots with anisotropic bow-tie sheen. */
  function perlage(o) {
    const S = o.size || 256;
    const c = mk(S, S);
    const ctx = c.getContext('2d', { willReadFrequently: true });
    ctx.fillStyle = o.base;
    ctx.fillRect(0, 0, S, S);
    const cols = 8, rows = 10;
    const sx = S / cols, sy = S / rows, rad = sx * 0.74;
    const R = rng(o.seed || 5);
    const spot = (x, y, rot) => {
      if (x < -rad || y < -rad || x > S + rad || y > S + rad) return;
      const g = ctx.createConicGradient(rot, x, y);
      const L = o.light, M = o.mid, D = o.dark;
      g.addColorStop(0.0, L);
      g.addColorStop(0.125, M);
      g.addColorStop(0.25, D);
      g.addColorStop(0.375, M);
      g.addColorStop(0.5, L);
      g.addColorStop(0.625, M);
      g.addColorStop(0.75, D);
      g.addColorStop(0.875, M);
      g.addColorStop(1.0, L);
      ctx.beginPath();
      ctx.arc(x, y, rad, 0, Math.PI * 2);
      ctx.fillStyle = g;
      ctx.fill();
      const rg = ctx.createRadialGradient(x - rad * 0.2, y - rad * 0.25, 0, x, y, rad);
      rg.addColorStop(0, 'rgba(255,255,255,0.07)');
      rg.addColorStop(0.7, 'rgba(0,0,0,0.04)');
      rg.addColorStop(1, 'rgba(0,0,0,0.30)');
      ctx.fillStyle = rg;
      ctx.fill();
      ctx.lineWidth = 0.6;
      for (let rr = 2.5; rr < rad; rr += 2.1) {
        ctx.beginPath();
        ctx.arc(x, y, rr, 0, Math.PI * 2);
        ctx.strokeStyle = rr % 4.2 < 2.1 ? 'rgba(255,255,255,0.045)' : 'rgba(0,0,0,0.05)';
        ctx.stroke();
      }
      ctx.beginPath();
      ctx.arc(x, y, rad - 0.4, 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(0,0,0,0.35)';
      ctx.lineWidth = 0.8;
      ctx.stroke();
    };
    for (let r = 0; r < rows; r++) {
      for (let k = 0; k < cols; k++) {
        const x = k * sx + (r % 2 ? sx / 2 : 0);
        const y = r * sy;
        const rot = -0.6 + (R() - 0.5) * 0.25;
        for (const ox of [-S, 0, S]) for (const oy of [-S, 0, S]) spot(x + ox, y + oy, rot);
      }
    }
    return c.toDataURL('image/jpeg', 0.9);
  }

  /** Polished rose-gold bezel: conic anisotropic reflection + bevel shading. */
  function bezel(size) {
    const S = size || 768;
    const c = mk(S, S);
    const ctx = c.getContext('2d', { willReadFrequently: true });
    const cx = S / 2;
    const g = ctx.createConicGradient(-0.55, cx, cx);
    const stops = [
      [0.0, '#f7d7c1'], [0.06, '#c88466'], [0.15, '#f3c9ad'], [0.24, '#7a4632'], [0.33, '#dca183'],
      [0.42, '#a5674c'], [0.5, '#f8dcc8'], [0.58, '#b9765a'], [0.68, '#f0c0a2'], [0.77, '#6f3f2d'],
      [0.86, '#d99c7e'], [0.94, '#b06f53'], [1.0, '#f7d7c1'],
    ];
    for (const [o, col] of stops) g.addColorStop(o, col);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, S, S);
    const rg = ctx.createRadialGradient(cx, cx, S * 0.4, cx, cx, S * 0.5);
    rg.addColorStop(0, 'rgba(255,240,228,0.25)');
    rg.addColorStop(0.45, 'rgba(255,240,228,0.0)');
    rg.addColorStop(0.85, 'rgba(40,18,10,0.15)');
    rg.addColorStop(1, 'rgba(30,12,6,0.55)');
    ctx.fillStyle = rg;
    ctx.fillRect(0, 0, S, S);
    return c.toDataURL('image/jpeg', 0.9);
  }

  /** Obsidian sunray field seen through the open-worked movement. */
  function sunray(size) {
    const S = size || 768;
    const c = mk(S, S);
    const ctx = c.getContext('2d', { willReadFrequently: true });
    const cx = S / 2;
    const g = ctx.createConicGradient(0, cx, cx);
    const N = 180;
    for (let i = 0; i <= N; i++) {
      const v = i % 2 ? 0 : 1;
      const tone = 18 + v * 7 + 4 * Math.sin(i * 0.11);
      g.addColorStop(i / N, `rgb(${tone + 3},${tone},${tone - 2})`);
    }
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, S, S);
    const sheen = ctx.createConicGradient(-2.3, cx, cx);
    sheen.addColorStop(0, 'rgba(255,230,200,0.10)');
    sheen.addColorStop(0.18, 'rgba(255,230,200,0)');
    sheen.addColorStop(0.5, 'rgba(255,230,200,0.07)');
    sheen.addColorStop(0.68, 'rgba(255,230,200,0)');
    sheen.addColorStop(1, 'rgba(255,230,200,0.10)');
    ctx.fillStyle = sheen;
    ctx.fillRect(0, 0, S, S);
    const rg = ctx.createRadialGradient(cx, cx, 0, cx, cx, cx);
    rg.addColorStop(0, 'rgba(0,0,0,0)');
    rg.addColorStop(0.75, 'rgba(0,0,0,0.25)');
    rg.addColorStop(1, 'rgba(0,0,0,0.7)');
    ctx.fillStyle = rg;
    ctx.fillRect(0, 0, S, S);
    return c.toDataURL('image/jpeg', 0.9);
  }

  /** Dark tobacco alligator-grain leather tile. */
  function leather(size) {
    const S = size || 256;
    const c = mk(S, S);
    const ctx = c.getContext('2d', { willReadFrequently: true });
    ctx.fillStyle = '#21160f';
    ctx.fillRect(0, 0, S, S);
    const R = rng(23);
    const cols = 7, rows = 9;
    for (let r = 0; r < rows; r++) {
      for (let k = 0; k < cols; k++) {
        const w = S / cols, h = S / rows;
        const x = k * w + (r % 2 ? w / 2 : 0) + (R() - 0.5) * 4;
        const y = r * h + (R() - 0.5) * 3;
        const rx = w * 0.42 + R() * 3, ry = h * 0.4 + R() * 2;
        for (const ox of [-S, 0, S]) for (const oy of [-S, 0, S]) {
          const X = x + ox, Y = y + oy;
          if (X < -w || Y < -h || X > S + w || Y > S + h) continue;
          const g = ctx.createRadialGradient(X - rx * 0.3, Y - ry * 0.35, 1, X, Y, rx);
          g.addColorStop(0, '#4a3122');
          g.addColorStop(0.7, '#2d1e14');
          g.addColorStop(1, '#170e09');
          ctx.beginPath();
          ctx.ellipse(X, Y, rx, ry, 0, 0, Math.PI * 2);
          ctx.fillStyle = g;
          ctx.fill();
          ctx.strokeStyle = 'rgba(8,4,2,0.8)';
          ctx.lineWidth = 1.4;
          ctx.stroke();
        }
      }
    }
    const img = ctx.getImageData(0, 0, S, S);
    for (let i = 0; i < img.data.length; i += 4) {
      const n = (R() - 0.5) * 10;
      img.data[i] += n;
      img.data[i + 1] += n;
      img.data[i + 2] += n;
    }
    ctx.putImageData(img, 0, 0);
    return c.toDataURL('image/jpeg', 0.9);
  }

  /** Warm obsidian/anthracite studio backdrop painted onto the fixed canvas. */
  function paintBackdrop(canvas) {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const W = Math.max(1, Math.floor(window.innerWidth));
    const H = Math.max(1, Math.floor(window.innerHeight));
    canvas.width = Math.floor(W * dpr);
    canvas.height = Math.floor(H * dpr);
    canvas.style.width = W + 'px';
    canvas.style.height = H + 'px';
    const ctx = canvas.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const base = ctx.createLinearGradient(0, 0, 0, H);
    base.addColorStop(0, '#191512');
    base.addColorStop(0.55, '#110e0c');
    base.addColorStop(1, '#0a0807');
    ctx.fillStyle = base;
    ctx.fillRect(0, 0, W, H);
    const narrow = W < 900;
    const cx = narrow ? W * 0.5 : (W - 280) * 0.5;
    const cy = narrow ? H * 0.36 : H * 0.5;
    const key = ctx.createRadialGradient(cx - W * 0.08, cy - H * 0.12, 0, cx, cy, Math.max(W, H) * 0.62);
    key.addColorStop(0, 'rgba(120,92,64,0.30)');
    key.addColorStop(0.35, 'rgba(70,52,38,0.16)');
    key.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = key;
    ctx.fillRect(0, 0, W, H);
    const vig = ctx.createRadialGradient(cx, cy, Math.min(W, H) * 0.35, cx, cy, Math.max(W, H) * 0.8);
    vig.addColorStop(0, 'rgba(0,0,0,0)');
    vig.addColorStop(1, 'rgba(0,0,0,0.55)');
    ctx.fillStyle = vig;
    ctx.fillRect(0, 0, W, H);
    // film grain
    const t = mk(128, 128);
    const tc = t.getContext('2d');
    const gi = tc.createImageData(128, 128);
    const R = rng(97);
    for (let i = 0; i < gi.data.length; i += 4) {
      const v = 128 + (R() - 0.5) * 70;
      gi.data[i] = v;
      gi.data[i + 1] = v * 0.97;
      gi.data[i + 2] = v * 0.92;
      gi.data[i + 3] = 14;
    }
    tc.putImageData(gi, 0, 0);
    ctx.fillStyle = ctx.createPattern(t, 'repeat');
    ctx.fillRect(0, 0, W, H);
  }

  function buildAll() {
    const t0 = performance.now();
    const timings = {};
    const time = (k, fn) => {
      const a = performance.now();
      const v = fn();
      timings[k] = Math.round(performance.now() - a);
      return v;
    };
    const tex = {
      cotesRhodium: time('cotesRhodium', () => cotes({ size: 256, stripes: 4, seed: 11, dark: [104, 108, 114], light: [240, 242, 244] })),
      perlageRuth: time('perlageRuth', () => perlage({ size: 256, seed: 5, base: '#2b2b2e', light: '#6c6d72', mid: '#45464b', dark: '#28292c' })),
      perlageGold: time('perlageGold', () => perlage({ size: 256, seed: 8, base: '#6d5430', light: '#e9cf94', mid: '#b08d55', dark: '#6f5530' })),
      bezel: time('bezel', () => bezel(640)),
      sunray: time('sunray', () => sunray(640)),
      leather: time('leather', () => leather(256)),
    };
    tex.timings = timings;
    tex.ms = performance.now() - t0;
    return tex;
  }

  root.CO5 = root.CO5 || {};
  root.CO5.textures = { buildAll, paintBackdrop };
})(window);
