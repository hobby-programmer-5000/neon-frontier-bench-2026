/*
 * Chronos Calibre O-5 ??SVG movement builder
 * Builds nine stacked SVG depth layers (static layers rasterise once; only the
 * going train, the tourbillon cage and the hands layer repaint) plus a torque
 * flow overlay. Coordinates: movement units, dial centre at (0,0), +y down.
 */
(function (root) {
  'use strict';

  const G = root.CO5.geo;
  const { DEG, polar, pt, n2 } = G;
  const NS = 'http://www.w3.org/2000/svg';

  /* ------------------------------------------------------------------ layout */
  const L = {};
  L.T = [0, 200];
  L.m1 = 2.6; L.zB = 90; L.zCp = 12;           // barrel ??centre pinion
  L.m2 = 3.0; L.zC = 80; L.z3p = 10;           // centre wheel ??third pinion
  L.m3 = 3.0; L.z3 = 75; L.z4p = 10;           // third wheel ??tourbillon (4th) pinion
  L.mF = 1.3; L.zF = 128; L.zEp = 8;           // fixed 4th wheel ??escape pinion (planetary)
  L.zEsc = 15; L.escR = 28;
  L.zRat = 36; L.zCw = 24; L.mW = 2.0;         // ratchet & crown wheel
  L.dBC = (L.m1 * (L.zB + L.zCp)) / 2;
  L.barrel = polar(L.dBC, -100 * DEG);
  L.dC3 = (L.m2 * (L.zC + L.z3p)) / 2;
  L.d3T = (L.m3 * (L.z3 + L.z4p)) / 2;
  L.third = G.intersect([0, 0], L.dC3, L.T, L.d3T, true);
  L.escD = (L.mF * (L.zF + L.zEp)) / 2;        // 88.4: escape arbor radius inside cage
  L.pivot = L.escD - L.escR / Math.cos(30 * DEG); // pallet arbor: tangents meet escape rim at ±30°
  L.rj = 12.3;                                  // impulse-jewel radius on roller
  L.forkL = L.pivot - L.rj;                     // pallet arbor ??fork slot
  L.halfLift = 26;                              // balance lift half-angle (deg)
  L.beta = (L.rj / L.forkL) * L.halfLift;       // lever angle to banking (deg)
  L.balR = 45;
  L.cageR = 118;
  L.crownW = polar((L.mW * (L.zRat + L.zCw)) / 2, -20 * DEG, L.barrel[0], L.barrel[1]);
  L.pr = [-205, 10];
  L.prA0 = 118; L.prA1 = 242;                  // power-reserve sector (deg), 0 h ??72 h
  const ang = (a, b) => (Math.atan2(b[1] - a[1], b[0] - a[0]) * 180) / Math.PI;
  L.psiT3 = ang(L.T, L.third);
  L.psi3C = ang(L.third, [0, 0]);
  L.psiCB = ang([0, 0], L.barrel);
  L.psiRC = ang(L.barrel, L.crownW);
  // Escape-wheel phase so that a tooth tip rests on the locking face at every integer beat
  L.esc0 = 205.7;
  L.spring = { ra: 22, rw: 104, s: 3.15, L: 3065 };
  L.hair = { rin: 6.6, rout: 37.5, turns: 13, stud: 135 };

  /* ----------------------------------------------------------------- helpers */
  function el(tag, attrs, parent) {
    const e = document.createElementNS(NS, tag);
    if (attrs) for (const k in attrs) e.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(e);
    return e;
  }
  function stopList(grad, stops) {
    for (const s of stops) {
      const a = { offset: s[0], 'stop-color': s[1] };
      if (s[2] !== undefined) a['stop-opacity'] = s[2];
      el('stop', a, grad);
    }
    return grad;
  }
  let DEFS = null;
  const lin = (id, stops, attrs) => stopList(el('linearGradient', Object.assign({ id }, attrs || {}), DEFS), stops);
  const rad = (id, stops, attrs) => stopList(el('radialGradient', Object.assign({ id }, attrs || {}), DEFS), stops);

  const PAL = {
    gold: [[0, '#7c5b2a'], [0.18, '#f3dfac'], [0.36, '#b38c50'], [0.5, '#f8e9c2'], [0.66, '#8b6a34'], [0.82, '#e9cd93'], [1, '#76582a']],
    steel: [[0, '#5a6269'], [0.2, '#eef1f4'], [0.38, '#98a0a8'], [0.52, '#ffffff'], [0.68, '#69717a'], [0.84, '#dde2e6'], [1, '#565e66']],
    rose: [[0, '#6c3d2b'], [0.2, '#f2c6a9'], [0.38, '#ad6e57'], [0.52, '#f8dcc8'], [0.68, '#7b4634'], [0.84, '#e2a98a'], [1, '#673827']],
  };
  let wheelGradSeq = 0;
  function wheelGrad(r, pal) {
    const id = 'wg' + wheelGradSeq++;
    const g = lin(id, pal, { gradientUnits: 'userSpaceOnUse', x1: -r, y1: -r, x2: r, y2: r });
    return { id, g };
  }

  function buildDefs(defsSvg, tex) {
    DEFS = el('defs', null, defsSvg);
    lin('gGold', [[0, '#f7e4b5'], [0.35, '#cfa865'], [0.6, '#8e6b36'], [0.85, '#e3c387'], [1, '#a98447']]);
    lin('gRose', [[0, '#f6d3bd'], [0.4, '#cd8f70'], [0.7, '#8c533c'], [1, '#e3a98b']]);
    lin('gRhodBevel', [[0, '#ffffff'], [0.28, '#c3c8cd'], [0.52, '#f7f9fa'], [0.78, '#80878e'], [1, '#e0e3e6']]);
    lin('gRuthBevel', [[0, '#a7a8ac'], [0.4, '#4b4c50'], [0.7, '#94959a'], [1, '#3a3b3e']]);
    lin('gSteel', [[0, '#f4f6f8'], [0.3, '#a9b1b8'], [0.55, '#eef1f3'], [0.8, '#6b737a'], [1, '#c9cfd4']]);
    lin('gSteelV', [[0, '#ffffff'], [0.45, '#b9c0c6'], [1, '#5f676e']], { x1: 0, y1: 0, x2: 0, y2: 1 });
    lin('gPrPlate', [[0, '#eceef0'], [0.5, '#c9cdd1'], [1, '#a9aeb3']]);
    rad('gBlue', [[0, '#a8c6ff'], [0.25, '#4f7fe6'], [0.6, '#1f43a3'], [1, '#0a1946']], { cx: 0.36, cy: 0.3, r: 0.8 });
    rad('gRuby', [[0, '#ffc2c7'], [0.22, '#ec3b50'], [0.68, '#a01024'], [1, '#470510']], { cx: 0.36, cy: 0.3, r: 0.8 });
    rad('gChaton', [[0, '#f6e2b2'], [0.65, '#c39c5c'], [1, '#6a4e25']], { cx: 0.4, cy: 0.35, r: 0.75 });
    rad('gDrop', [[0, '#000000', 0.62], [0.72, '#000000', 0.34], [1, '#000000', 0]]);
    rad('gCaseMid', [[0, '#e2ad91'], [0.86, '#b87657'], [0.95, '#6d3a27'], [1, '#3e1d12']], { cx: 0.46, cy: 0.44, r: 0.56 });
    rad('gCapRose', [[0, '#fbe3d3'], [0.5, '#d49779'], [1, '#7a432f']], { cx: 0.38, cy: 0.32, r: 0.8 });
    rad('gGrain', [[0, '#ffffff', 0], [0.48, '#ffffff', 0.09], [0.56, '#000000', 0.07], [1, '#ffffff', 0]], {
      gradientUnits: 'userSpaceOnUse', cx: 0, cy: 0, r: 3.1, spreadMethod: 'repeat',
    });
    rad('gSapph', [[0, '#cfe0ff', 0.0], [0.82, '#cfe0ff', 0.03], [1, '#9fb6d9', 0.12]]);
    lin('gCrescent', [[0, '#ffffff', 0.16], [0.6, '#ffffff', 0.04], [1, '#ffffff', 0]], { x1: 0, y1: 0, x2: 1, y2: 1 });
    lin('gSoftbox', [[0, '#fff6ea', 0.0], [0.5, '#fff6ea', 0.06], [1, '#fff6ea', 0.0]], { x1: 0, y1: 0, x2: 1, y2: 0 });
    lin('gHandRose', [[0, '#fbe2d1'], [0.48, '#e7aa8b'], [0.5, '#9a5b42'], [1, '#c98a6b']], { x1: 0, y1: 0, x2: 1, y2: 0 });
    lin('gIndex', [[0, '#fde7d7'], [0.48, '#e6a888'], [0.52, '#8f533c'], [1, '#c4856a']], { x1: 0, y1: 0, x2: 1, y2: 0 });
    lin('gHandBlue', [[0, '#7aa2f5'], [0.5, '#2c55b8'], [0.52, '#14306f'], [1, '#2a4d9e']], { x1: 0, y1: 0, x2: 1, y2: 0 });
    lin('gStrapShade', [[0, '#000000', 0.55], [0.18, '#000000', 0.0], [0.5, '#ffffff', 0.05], [0.82, '#000000', 0.0], [1, '#000000', 0.55]], { x1: 0, y1: 0, x2: 1, y2: 0 });
    lin('gLug', [[0, '#5e3222'], [0.3, '#f1c4a6'], [0.55, '#c07d5f'], [0.8, '#f6d2bb'], [1, '#6e3b28']], { x1: 0, y1: 0, x2: 1, y2: 0 });
    lin('gCrown', [[0, '#5a2f20'], [0.25, '#f6d4bd'], [0.5, '#c88a6c'], [0.8, '#7e4532'], [1, '#3d1d12']], { x1: 0, y1: 0, x2: 0, y2: 1 });
    rad('gBezelShade', [[0, '#000000', 0], [0.9, '#000000', 0], [0.955, '#000000', 0.25], [1, '#000000', 0.55]], {
      gradientUnits: 'userSpaceOnUse', cx: 0, cy: 0, r: 398,
    });
    const pat = (id, href, size, rot) => {
      const p = el('pattern', { id, patternUnits: 'userSpaceOnUse', width: size, height: size, patternTransform: `rotate(${rot})` }, DEFS);
      el('image', { href, x: 0, y: 0, width: size, height: size, preserveAspectRatio: 'none' }, p);
    };
    pat('pCotes', tex.cotesRhodium, 150, -32);
    pat('pPerlage', tex.perlageRuth, 170, 0);
    pat('pPerlageGold', tex.perlageGold, 96, 0);
    pat('pLeather', tex.leather, 130, 0);
    const cb = el('clipPath', { id: 'clipBezel' }, DEFS);
    el('path', { d: G.circle(448) + G.circle(397), 'clip-rule': 'evenodd' }, cb);
    const cf = el('clipPath', { id: 'clipField' }, DEFS);
    el('circle', { cx: 0, cy: 0, r: 405 }, cf);
    // text paths for engraving
    el('path', { id: 'tpTop', d: 'M -336 0 A 336 336 0 0 1 336 0' }, DEFS);
    el('path', { id: 'tpBot', d: 'M -347 0 A 347 347 0 0 0 347 0' }, DEFS);
  }

  /* ------------------------------------------------------------ primitives */
  function jewel(parent, x, y, r) {
    const g = el('g', { transform: `translate(${n2(x)} ${n2(y)})` }, parent);
    el('circle', { r: r + 3.2, fill: 'url(#gChaton)', stroke: '#4a3418', 'stroke-width': 0.6 }, g);
    el('circle', { r: r + 0.8, fill: '#2a0a0e' }, g);
    el('circle', { r, fill: 'url(#gRuby)' }, g);
    el('circle', { r: Math.max(0.6, r * 0.2), fill: '#1c0306' }, g);
    el('ellipse', { cx: -r * 0.38, cy: -r * 0.42, rx: r * 0.32, ry: r * 0.18, fill: '#ffffff', opacity: 0.75, transform: 'rotate(-35)' }, g);
    root.CO5.counts.jewels++;
    return g;
  }
  function screw(parent, x, y, r, slot) {
    const g = el('g', { transform: `translate(${n2(x)} ${n2(y)})` }, parent);
    el('circle', { r: r + 1.1, fill: '#121212', opacity: 0.55 }, g);
    el('circle', { r, fill: 'url(#gBlue)', stroke: '#06102e', 'stroke-width': 0.5 }, g);
    const s = el('g', { transform: `rotate(${n2(slot)})` }, g);
    el('rect', { x: -r, y: -r * 0.16, width: r * 2, height: r * 0.32, fill: '#050b1f' }, s);
    el('rect', { x: -r * 0.9, y: r * 0.16, width: r * 1.8, height: r * 0.1, fill: '#8fb0ff', opacity: 0.55 }, s);
    el('ellipse', { cx: -r * 0.35, cy: -r * 0.45, rx: r * 0.35, ry: r * 0.18, fill: '#d8e6ff', opacity: 0.55 }, g);
    return g;
  }
  /** Bridge / plate set: soft shadow ??polished anglage ??grained body. */
  function bridgeSet(parent, parts, mat) {
    const sh = el('g', { transform: `translate(${mat.sx ?? 6} ${mat.sy ?? 10})` }, parent);
    const bev = el('g', null, parent);
    const line = el('g', null, parent);
    const body = el('g', null, parent);
    const e = mat.edge ?? 2.6;
    for (const p of parts) {
      if (p.d) {
        const common = { d: p.d, fill: 'none', 'stroke-linecap': 'round', 'stroke-linejoin': 'round' };
        if (mat.shadow !== false) {
          el('path', Object.assign({}, common, { stroke: '#000', 'stroke-width': p.w + 12, opacity: 0.18 }), sh);
          el('path', Object.assign({}, common, { stroke: '#000', 'stroke-width': p.w + 3, opacity: 0.4 }), sh);
        }
        el('path', Object.assign({}, common, { stroke: mat.bevel, 'stroke-width': p.w }), bev);
        el('path', Object.assign({}, common, { stroke: '#000', 'stroke-opacity': 0.35, 'stroke-width': p.w - 2 * e + 0.9 }), line);
        el('path', Object.assign({}, common, { stroke: mat.body, 'stroke-width': p.w - 2 * e }), body);
      } else {
        if (mat.shadow !== false) {
          el('circle', { cx: p.x, cy: p.y, r: p.r + 6, fill: '#000', opacity: 0.18 }, sh);
          el('circle', { cx: p.x, cy: p.y, r: p.r + 1.5, fill: '#000', opacity: 0.4 }, sh);
        }
        el('circle', { cx: p.x, cy: p.y, r: p.r, fill: mat.bevel }, bev);
        el('circle', { cx: p.x, cy: p.y, r: p.r - e + 0.45, fill: '#000', 'fill-opacity': 0.35 }, line);
        el('circle', { cx: p.x, cy: p.y, r: p.r - e, fill: mat.body }, body);
      }
    }
    return { sh, bev, body };
  }

  /** Skeletonised involute wheel: outline ??crossings ??arbor hole (even-odd). */
  function wheel(parent, s) {
    const gear = G.involuteGear(s.z, s.m, { backlash: s.backlash ?? 0.06, flankSteps: s.flankSteps || 5 });
    let d = gear.d;
    if (s.spokes) {
      const rRim = gear.rf - (s.rim ?? Math.max(4, gear.r * 0.085));
      d += G.crossings(s.spokes, rRim, s.hub, s.spokeW, { twist: s.twist ?? 0.24, bend: s.bend ?? 0.14 });
    } else if (s.innerR) {
      d += G.circle(s.innerR);
    }
    if (s.hole) d += G.circle(s.hole);
    const g = el('g', null, parent);
    const grad = wheelGrad(gear.ra, s.pal || PAL.gold);
    el('path', { d, fill: `url(#${grad.id})`, 'fill-rule': 'evenodd', stroke: s.edge || '#4c3716', 'stroke-width': s.edgeW ?? 0.5 }, g);
    if (s.grain !== false) el('path', { d, fill: 'url(#gGrain)', 'fill-rule': 'evenodd' }, g);
    return { g, grad: grad.g, gear, last: '' };
  }

  function counterAngles(n, start, step) {
    const out = [];
    for (let i = 0; i < n; i++) out.push(start + i * step);
    return out;
  }

  /* ---------------------------------------------------------------- layers */
  function makeLayer(rig, name, label) {
    const div = document.createElement('div');
    div.className = 'layer layer-' + name;
    div.dataset.layer = name;
    if (label) div.dataset.label = label;
    const svg = el('svg', { class: 'layer-svg', viewBox: '-560 -560 1120 1120', preserveAspectRatio: 'xMidYMid meet', 'aria-hidden': 'true' });
    div.appendChild(svg);
    rig.appendChild(div);
    const g = el('g', null, svg);
    return { div, svg, g, name };
  }

  function build(rig, defsSvg, tex) {
    root.CO5.counts = { jewels: 0 };
    buildDefs(defsSvg, tex);
    const H = { layers: [], dyn: {}, L };
    const add = (name, label) => {
      const ly = makeLayer(rig, name, label);
      H.layers.push(ly);
      return ly;
    };

    /* ---------- 0 · case, strap, back field ---------- */
    const lyCase = add('case', 'Case');
    {
      const g = lyCase.g;
      el('circle', { cx: 22, cy: 40, r: 560, fill: 'url(#gDrop)' }, g);
      for (const s of [-1, 1]) {
        const y0 = s * 430, y1 = s * 640;
        const strap = el('g', null, g);
        const d = `M -146 ${y0} L -146 ${y1} L 146 ${y1} L 146 ${y0} Z`;
        el('path', { d, fill: 'url(#pLeather)' }, strap);
        el('rect', { x: -146, y: Math.min(y0, y1), width: 292, height: 210, fill: 'url(#gStrapShade)' }, strap);
        for (const x of [-131, 131]) {
          el('line', { x1: x, y1: y0 + s * 14, x2: x, y2: y1, stroke: '#a88763', 'stroke-width': 1.5, 'stroke-dasharray': '7 6', opacity: 0.75 }, strap);
        }
        el('path', { d, fill: 'none', stroke: '#0b0604', 'stroke-width': 2 }, strap);
        for (const x of [-172, 172]) {
          const ly0 = s > 0 ? 330 : -548;
          el('rect', { x: x - 20 + 7, y: ly0 + 9, width: 40, height: 218, rx: 18, fill: '#000', opacity: 0.35 }, g);
          el('rect', { x: x - 20, y: ly0, width: 40, height: 218, rx: 18, fill: 'url(#gLug)', stroke: '#3d1e12', 'stroke-width': 1 }, g);
          el('rect', { x: x - 5, y: ly0 + 14, width: 4, height: 190, rx: 2, fill: '#fff1e6', opacity: 0.35 }, g);
        }
      }
      el('circle', { cx: 8, cy: 14, r: 462, fill: '#000', opacity: 0.4 }, g);
      el('circle', { r: 458, fill: 'url(#gCaseMid)', stroke: '#33170d', 'stroke-width': 2 }, g);
      el('circle', { r: 454.5, fill: 'none', stroke: '#ffe6d6', 'stroke-opacity': 0.35, 'stroke-width': 1.2 }, g);
      el('image', { href: tex.sunray, x: -405, y: -405, width: 810, height: 810, 'clip-path': 'url(#clipField)', preserveAspectRatio: 'none' }, g);
    }

    /* ---------- 1 · main plate (ruthenium perlage) ---------- */
    const lyPlate = add('plate', 'Platine perlée · main plate');
    {
      const g = lyPlate.g;
      // wheel shadows cast on the plate / back field (rotation-invariant rings)
      const ringShadow = (c, r, w) => el('circle', { cx: c[0] + 6, cy: c[1] + 10, r, fill: 'none', stroke: '#000', 'stroke-opacity': 0.32, 'stroke-width': w }, g);
      ringShadow([0, 0], 112, 14);
      ringShadow(L.third, 105, 12);
      ringShadow(L.barrel, 110, 18);
      ringShadow(L.T, 100, 30);
      const T = L.T, B = L.barrel, C3 = L.third;
      const arms = [
        { d: `M 0 404 C 0 330 0 270 ${T[0]} ${T[1]}`, w: 44 },
        { d: `M -70 -398 C -60 -300 ${B[0] - 30} -220 ${B[0]} ${B[1]}`, w: 40 },
        { d: `M -400 -20 C -300 -10 -150 12 0 0`, w: 30 },
        { d: `M 342 214 C 260 190 170 140 ${C3[0]} ${C3[1]}`, w: 30 },
      ];
      const ring = { d: G.circle(366), w: 76 };
      bridgeSet(g, [ring, ...arms, { x: T[0], y: T[1], r: 40 }, { x: B[0], y: B[1], r: 44 }, { x: 0, y: 0, r: 26 }, { x: C3[0], y: C3[1], r: 22 }],
        { bevel: 'url(#gRuthBevel)', body: 'url(#pPerlage)', edge: 2.4, sx: 0, sy: 0, shadow: false });
      // outer edge darkening where the plate slides under the chapter ring
      el('circle', { r: 395, fill: 'none', stroke: '#000', 'stroke-opacity': 0.35, 'stroke-width': 18 }, g);
      const eng = { 'font-family': 'Didot, "Bodoni 72", "Bodoni MT", Georgia, serif', 'font-size': 10.5, 'letter-spacing': 5.2, fill: '#cdb68a', 'text-anchor': 'middle' };
      const t1 = el('text', eng, g);
      const tp1 = el('textPath', { href: '#tpTop', startOffset: '50%' }, t1);
      tp1.textContent = 'CHRONOS  ·  CALIBRE O-5';
      const t2 = el('text', eng, g);
      const tp2 = el('textPath', { href: '#tpBot', startOffset: '50%' }, t2);
      tp2.textContent = 'TOURBILLON SQUELETTE  ·  XXI RUBIS';
      for (let i = 0; i < 12; i++) {
        const a = (i * 30 + 15) * DEG;
        const p = polar(366, a);
        if (i % 3 === 1) screw(g, p[0], p[1], 5.2, i * 37);
      }
    }

    /* ---------- 2 · going train: centre, third, barrel + mainspring ---------- */
    const lyTrain = add('train', 'Rouage · going train');
    {
      const g = lyTrain.g;
      const D = H.dyn;
      D.center = wheel(g, { z: L.zC, m: L.m2, spokes: 5, hub: 24, spokeW: 7.5, rim: 9 });
      D.third = wheel(g, { z: L.z3, m: L.m3, spokes: 5, hub: 21, spokeW: 7, rim: 8.5 });
      D.thirdPinion = wheel(g, { z: L.z3p, m: L.m3, pal: PAL.steel, hole: 2.2, edge: '#2c3238', grain: false, flankSteps: 4 });
      // barrel: drum ring, perlage floor with crossings, mainspring, arbor
      D.barrel = { g: el('g', null, g), last: '' };
      const bg = D.barrel.g;
      el('circle', { r: 104.5, fill: '#120f0c', opacity: 0.55 }, bg);
      const floorD = G.circle(104) + G.crossings(6, 96, 30, 11, { twist: 0.32, bend: 0.18 });
      el('path', { d: floorD, fill: 'url(#pPerlageGold)', 'fill-rule': 'evenodd', opacity: 0.95, stroke: '#5a4220', 'stroke-width': 0.6 }, bg);
      el('path', { d: floorD, fill: '#000', 'fill-opacity': 0.28, 'fill-rule': 'evenodd' }, bg);
      const drum = G.involuteGear(L.zB, L.m1, { backlash: 0.06, flankSteps: 5 });
      const drumGrad = wheelGrad(drum.ra, PAL.gold);
      D.barrel.grad = drumGrad.g;
      el('path', { d: drum.d + G.circle(104), fill: `url(#${drumGrad.id})`, 'fill-rule': 'evenodd', stroke: '#4c3716', 'stroke-width': 0.5 }, bg);
      el('path', { d: drum.d + G.circle(104), fill: 'url(#gGrain)', 'fill-rule': 'evenodd' }, bg);
      el('circle', { r: 104, fill: 'none', stroke: '#2b1e0c', 'stroke-width': 1.2 }, bg);
      el('circle', { r: 105.6, fill: 'none', stroke: '#fff4d8', 'stroke-opacity': 0.5, 'stroke-width': 0.8 }, bg);
      D.spring = el('path', { d: '', fill: 'none', stroke: '#d4d8dc', 'stroke-width': 2.15, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }, bg);
      D.springHi = el('path', { d: '', fill: 'none', stroke: '#ffffff', 'stroke-opacity': 0.45, 'stroke-width': 0.6, transform: 'translate(-0.5 -0.6)' }, bg);
      D.arbor = { g: el('g', null, g), last: '' };
      el('circle', { r: 22, fill: 'url(#gSteel)', stroke: '#2c3238', 'stroke-width': 0.8 }, D.arbor.g);
      el('rect', { x: 20, y: -2.5, width: 5, height: 5, fill: '#9aa2a9' }, D.arbor.g); // spring hook
      D.centerPinion = wheel(g, { z: L.zCp, m: L.m1, pal: PAL.steel, hole: 2.6, edge: '#2c3238', grain: false, flankSteps: 4 });
      D.cagePinion = wheel(g, { z: L.z4p, m: L.m3, pal: PAL.steel, hole: 2.2, edge: '#2c3238', grain: false, flankSteps: 4 });
    }

    /* ---------- 3 · fixed fourth wheel + seconds ring ---------- */
    const lyFixed = add('fixed', 'Roue fixe · fixed 4th wheel');
    {
      const g = el('g', { transform: `translate(${L.T[0]} ${L.T[1]})` }, lyFixed.g);
      el('circle', { cx: 5, cy: 9, r: 86, fill: 'none', stroke: '#000', 'stroke-opacity': 0.3, 'stroke-width': 8 }, g);
      const fw = wheel(g, { z: L.zF, m: L.mF, spokes: 6, hub: 30, spokeW: 6, rim: 6, pal: PAL.rose, edge: '#4a2618', flankSteps: 4 });
      fw.grad.setAttribute('gradientTransform', 'rotate(0)');
      // seconds ring
      const sr = el('g', null, g);
      el('path', { d: G.circle(141) + G.circle(126), 'fill-rule': 'evenodd', fill: '#000', opacity: 0.35, transform: 'translate(4 7)' }, sr);
      el('path', { d: G.circle(141) + G.circle(126), 'fill-rule': 'evenodd', fill: 'url(#gRuthBevel)' }, sr);
      el('path', { d: G.circle(139.8) + G.circle(127.2), 'fill-rule': 'evenodd', fill: '#1b1a1a' }, sr);
      for (let i = 0; i < 60; i++) {
        const a = (i * 6 - 90) * DEG;
        const major = i % 5 === 0;
        const p1 = polar(major ? 128.4 : 129.6, a), p2 = polar(132.6, a);
        el('line', { x1: n2(p1[0]), y1: n2(p1[1]), x2: n2(p2[0]), y2: n2(p2[1]), stroke: '#d8c49f', 'stroke-width': major ? 1.2 : 0.6 }, sr);
      }
      for (let i = 1; i <= 6; i++) {
        const a = (i * 60 - 90) * DEG;
        const p = polar(136, a);
        const t = el('text', {
          x: n2(p[0]), y: n2(p[1]), 'font-size': 5.4, 'font-family': '"Helvetica Neue", Arial, sans-serif', fill: '#d8c49f',
          'text-anchor': 'middle', 'dominant-baseline': 'central', transform: `rotate(${i * 60} ${n2(p[0])} ${n2(p[1])})`, 'letter-spacing': 0.4,
        }, sr);
        t.textContent = String(i * 10);
      }
    }

    /* ---------- 4 · tourbillon cage (dynamic) ---------- */
    const lyCage = add('cage', 'Cage tourbillon 60??· 4 Hz');
    {
      const D = H.dyn;
      const cage = el('g', null, lyCage.g);
      D.cage = { g: cage, last: '' };
      // lower frame
      el('path', { d: G.circle(L.cageR) + G.circle(110.5), 'fill-rule': 'evenodd', fill: 'url(#gSteel)', stroke: '#2a3036', 'stroke-width': 0.6 }, cage);
      // escape pinion & wheel
      D.escPinion = wheel(cage, { z: L.zEp, m: L.mF, pal: PAL.steel, hole: 0.9, edge: '#2c3238', grain: false, flankSteps: 4 });
      D.escWheel = { g: el('g', null, cage), last: '' };
      {
        const ew = G.escapeWheel(L.zEsc, L.escR);
        const d = ew.d + G.crossings(5, 16.6, 5.6, 2.6, { twist: 0.3, bend: 0.2 }) + G.circle(1.3);
        const gr = wheelGrad(L.escR, PAL.steel);
        D.escWheel.grad = gr.g;
        el('path', { d, fill: `url(#${gr.id})`, 'fill-rule': 'evenodd', stroke: '#30363c', 'stroke-width': 0.35 }, D.escWheel.g);
      }
      // banking pins
      for (const s of [-1, 1]) {
        el('circle', { cx: n2(L.pivot - 22), cy: n2(s * 5.6), r: 1.2, fill: 'url(#gSteel)', stroke: '#2a3036', 'stroke-width': 0.3 }, cage);
      }
      // pallet fork (anchor) in pivot-local coordinates
      D.pallet = { g: el('g', null, cage), last: '' };
      {
        const pg = D.pallet.g;
        const ex = L.escD - L.pivot; // escape centre, pivot-local
        const C1 = [ex + L.escR * Math.cos(210 * DEG), L.escR * Math.sin(210 * DEG)];
        const C2 = [ex + L.escR * Math.cos(150 * DEG), L.escR * Math.sin(150 * DEG)];
        const u1 = [Math.cos(210 * DEG), Math.sin(210 * DEG)];
        const u2 = [Math.cos(150 * DEG), Math.sin(150 * DEG)];
        const H1 = [C1[0] + 7.6 * u1[0], C1[1] + 7.6 * u1[1]];
        const H2 = [C2[0] + 7.6 * u2[0], C2[1] + 7.6 * u2[1]];
        const fx = -L.forkL;
        const body = `M ${pt(H1)} Q ${n2(-3)} ${n2(-8)} 0 0 Q ${n2(-3)} ${n2(8)} ${pt(H2)} M 0 0 L ${n2(fx + 3.4)} 0`;
        el('path', { d: body, fill: 'none', stroke: '#22282d', 'stroke-width': 5.4, 'stroke-linecap': 'round' }, pg);
        el('path', { d: body, fill: 'none', stroke: 'url(#gSteel)', 'stroke-width': 4.0, 'stroke-linecap': 'round' }, pg);
        const horns = `M ${n2(fx + 4)} -3.9 L ${n2(fx - 1.6)} -4.3 Q ${n2(fx - 2.4)} -2.6 ${n2(fx - 1.2)} -1.45 L ${n2(fx + 3.6)} -1.45 L ${n2(fx + 3.6)} 1.45 L ${n2(fx - 1.2)} 1.45 Q ${n2(fx - 2.4)} 2.6 ${n2(fx - 1.6)} 4.3 L ${n2(fx + 4)} 3.9 Z`;
        el('path', { d: horns, fill: 'url(#gSteel)', stroke: '#22282d', 'stroke-width': 0.45 }, pg);
        el('line', { x1: n2(fx + 5), y1: 0, x2: n2(fx + 8), y2: 0, stroke: '#ccd2d7', 'stroke-width': 0.8 }, pg); // guard pin
        const stone = (C, u, H) => {
          const nx = -u[1], ny = u[0], w = 1.35;
          const a = [C[0] - 0.6 * u[0] + nx * w, C[1] - 0.6 * u[1] + ny * w];
          const b = [C[0] - 0.6 * u[0] - nx * w, C[1] - 0.6 * u[1] - ny * w];
          const c = [H[0] - nx * w, H[1] - ny * w];
          const d = [H[0] + nx * w, H[1] + ny * w];
          el('path', { d: `M ${pt(a)} L ${pt(b)} L ${pt(c)} L ${pt(d)} Z`, fill: 'url(#gRuby)', stroke: '#4a0510', 'stroke-width': 0.35 }, pg);
          el('line', { x1: n2(a[0]), y1: n2(a[1]), x2: n2(d[0]), y2: n2(d[1]), stroke: '#ffd0d5', 'stroke-width': 0.4, opacity: 0.8 }, pg);
        };
        stone(C1, u1, H1);
        stone(C2, u2, H2);
        el('circle', { r: 3.4, fill: 'url(#gSteel)', stroke: '#22282d', 'stroke-width': 0.5 }, pg);
      }
      // Balance assembly lives on its own composited layer: it is the only part
      // repainted every frame, so the rest of the cage rasterises only on beats.
      const lyBal = add('balance', '');
      const balG = el('g', null, lyBal.g);
      D.cageBal = { g: balG, last: '' };
      // roller with impulse jewel
      D.roller = { g: el('g', null, balG), last: '' };
      {
        const rg = D.roller.g;
        el('path', { d: G.circle(9.2) + G.circle(1.2), 'fill-rule': 'evenodd', fill: 'url(#gSteel)', stroke: '#2a3036', 'stroke-width': 0.4 }, rg);
        el('rect', { x: 8.4, y: -1.2, width: 5.0, height: 2.4, rx: 1.1, fill: 'url(#gRuby)', stroke: '#4a0510', 'stroke-width': 0.3 }, rg);
        el('path', { d: G.circle(5.2), fill: '#aeb6bd', stroke: '#2a3036', 'stroke-width': 0.3 }, rg);
      }
      // balance wheel
      D.balance = { g: el('g', null, balG), last: '' };
      {
        const bw = D.balance.g;
        const R = L.balR;
        const gr = wheelGrad(R, PAL.gold);
        let d = G.circle(R) + G.circle(R - 3.6);
        el('circle', { cx: 2.5, cy: 4.5, r: R - 1.8, fill: 'none', stroke: '#000', 'stroke-opacity': 0.35, 'stroke-width': 4 }, bw);
        el('path', { d, fill: `url(#${gr.id})`, 'fill-rule': 'evenodd', stroke: '#5a4019', 'stroke-width': 0.4 }, bw);
        // arms
        const arm = `M -1.7 ${-(R - 3)} L 1.7 ${-(R - 3)} L 1.4 -4 L -1.4 -4 Z M -1.7 ${R - 3} L 1.7 ${R - 3} L 1.4 4 L -1.4 4 Z`;
        el('path', { d: arm, fill: `url(#${gr.id})`, stroke: '#5a4019', 'stroke-width': 0.35 }, bw);
        el('circle', { r: 4.4, fill: `url(#${gr.id})`, stroke: '#5a4019', 'stroke-width': 0.4 }, bw);
        // inertia blocks + rim screws
        for (const a of counterAngles(4, 45, 90)) {
          const g2 = el('g', { transform: `rotate(${a})` }, bw);
          el('rect', { x: R - 7.6, y: -3.2, width: 4.4, height: 6.4, rx: 1, fill: 'url(#gGold)', stroke: '#5a4019', 'stroke-width': 0.3 }, g2);
        }
        for (const a of counterAngles(16, 11.25, 22.5)) {
          const p = polar(R + 0.9, a * DEG);
          el('circle', { cx: n2(p[0]), cy: n2(p[1]), r: 1.15, fill: 'url(#gGold)', stroke: '#5a4019', 'stroke-width': 0.25 }, bw);
        }
        el('circle', { r: 1.6, fill: '#c9cfd4' }, bw);
      }
      // hairspring (path rebuilt per frame) + stud
      D.hair = el('path', { d: '', fill: 'none', stroke: '#4170d2', 'stroke-width': 0.5, 'stroke-linejoin': 'round' }, balG);
      {
        const sp = polar(L.hair.rout + 1.6, L.hair.stud * DEG);
        el('rect', { x: n2(sp[0] - 2.2), y: n2(sp[1] - 1.6), width: 4.4, height: 3.2, rx: 0.6, fill: 'url(#gSteel)', stroke: '#2a3036', 'stroke-width': 0.3, transform: `rotate(${L.hair.stud} ${n2(sp[0])} ${n2(sp[1])})` }, balG);
      }
      // upper cage bridge (polished steel), cocks, jewels, seconds pointer ??third cage layer
      const lyCageTop = add('cagetop', '');
      const up = el('g', null, lyCageTop.g);
      D.cageTop = { g: up, last: '' };
      const parts = [];
      for (const a of [60, 180, 300]) {
        const p0 = polar(9, a * DEG), c = polar(66, (a + 22) * DEG), p1 = polar(114.5, (a + 9) * DEG);
        parts.push({ d: `M ${pt(p0)} Q ${pt(c)} ${pt(p1)}`, w: 4.4 });
      }
      parts.push({ d: G.circle(115.4), w: 4.8 });
      const escC = [L.escD, 0], palC = [L.pivot, 0];
      parts.push({ d: `M ${pt(polar(114, 24 * DEG))} Q ${pt(polar(104, 9 * DEG))} ${pt(escC)}`, w: 4.6 });
      parts.push({ d: `M ${pt(polar(114, -36 * DEG))} Q ${pt([80, -38])} ${pt(palC)}`, w: 4 });
      parts.push({ x: 0, y: 0, r: 9 }, { x: escC[0], y: escC[1], r: 5.6 }, { x: palC[0], y: palC[1], r: 4.6 });
      bridgeSet(up, parts, { bevel: 'url(#gSteel)', body: 'url(#gSteelV)', edge: 1.0, sx: 2.2, sy: 3.6 });
      jewel(up, 0, 0, 3.4);
      jewel(up, escC[0], escC[1], 2.1);
      jewel(up, palC[0], palC[1], 1.6);
      for (const a of [120, 240, 0]) {
        const p = polar(114.6, (a + 30) * DEG);
        screw(up, p[0], p[1], 2.7, a);
      }
      const tip = polar(131, -90 * DEG), b1 = polar(117, -93.2 * DEG), b2 = polar(117, -86.8 * DEG);
      el('path', { d: `M ${pt(b1)} L ${pt(tip)} L ${pt(b2)} Z`, fill: 'url(#gSteel)', stroke: '#22282d', 'stroke-width': 0.5 }, up);
      el('path', { d: `M ${pt(b1)} L ${pt(tip)} L ${pt(polar(117, -90 * DEG))} Z`, fill: '#ffffff', opacity: 0.55 }, up);
    }

    /* ---------- 5 · bridges (rhodium Côtes de Genève) ---------- */
    const lyBridges = add('bridges', 'Ponts Côtes de Genève · bridges');
    {
      const g = lyBridges.g;
      const B = L.barrel, CW = L.crownW, C3 = L.third, T = L.T;
      const ringP = (a) => polar(352, a * DEG);
      const bl = ringP(-146), br = ringP(-38);
      const trn = ringP(18);
      const barrelArmL = `M ${pt(bl)} C ${n2(bl[0] + 90)} ${n2(bl[1] + 10)} ${n2(B[0] - 120)} ${n2(B[1] - 20)} ${pt(B)}`;
      const barrelArmR = `M ${pt(B)} C ${n2(B[0] + 30)} ${n2(B[1] - 10)} ${n2(CW[0] - 20)} ${n2(CW[1] + 2)} ${pt(CW)} C ${n2(CW[0] + 70)} ${n2(CW[1] - 4)} ${n2(br[0] - 90)} ${n2(br[1] + 30)} ${pt(br)}`;
      const trainArm = `M 0 0 C 30 30 ${n2(C3[0] - 40)} ${n2(C3[1] - 10)} ${pt(C3)} C ${n2(C3[0] + 70)} ${n2(C3[1] + 10)} ${n2(trn[0] - 90)} ${n2(trn[1] + 10)} ${pt(trn)}`;
      // Flying tourbillon: the cage is cantilevered from the plate below, no bridge over it.
      el('path', { id: 'tpTrain', d: `M ${pt(C3)} C ${n2(C3[0] + 70)} ${n2(C3[1] + 10)} ${n2(trn[0] - 90)} ${n2(trn[1] + 10)} ${pt(trn)}`, fill: 'none' }, DEFS);
      const mat = { bevel: 'url(#gRhodBevel)', body: 'url(#pCotes)', edge: 2.7 };
      bridgeSet(g, [
        { d: barrelArmL, w: 26 }, { d: barrelArmR, w: 24 },
        { x: B[0], y: B[1], r: 31 }, { x: CW[0], y: CW[1], r: 15 }, { x: bl[0], y: bl[1], r: 19 }, { x: br[0], y: br[1], r: 19 },
      ], mat);
      bridgeSet(g, [{ d: trainArm, w: 21 }, { x: 0, y: 0, r: 19 }, { x: C3[0], y: C3[1], r: 17 }, { x: trn[0], y: trn[1], r: 19 }], mat);
      const eng = { 'font-family': 'Didot, "Bodoni 72", "Bodoni MT", Georgia, serif', 'font-size': 8, 'letter-spacing': 2.6, 'text-anchor': 'middle', 'dominant-baseline': 'central' };
      for (const [id, txt] of [['tpTrain', 'CHRONOS · GENÈVE']]) {
        const hi = el('text', Object.assign({ fill: '#ffffff', 'fill-opacity': 0.55, transform: 'translate(0.5 0.6)' }, eng), g);
        el('textPath', { href: '#' + id, startOffset: '52%' }, hi).textContent = txt;
        const t = el('text', Object.assign({ fill: '#1b1c1f', 'fill-opacity': 0.85 }, eng), g);
        el('textPath', { href: '#' + id, startOffset: '52%' }, t).textContent = txt;
      }
      // power-reserve sector plate
      {
        const P = L.pr;
        const sg = el('g', { transform: `translate(${P[0]} ${P[1]})` }, g);
        const a0 = (L.prA0 - 8) * DEG, a1 = (L.prA1 + 8) * DEG;
        const o0 = polar(78, a0), o1 = polar(78, a1), i0 = polar(36, a0), i1 = polar(36, a1);
        const sector = `M ${pt(i0)} L ${pt(o0)} A 78 78 0 0 1 ${pt(o1)} L ${pt(i1)} A 36 36 0 0 0 ${pt(i0)} Z`;
        el('path', { d: sector, fill: '#000', opacity: 0.45, transform: 'translate(5 8)' }, sg);
        el('path', { d: sector, fill: 'url(#gRhodBevel)' }, sg);
        el('path', { d: sector, fill: 'url(#gPrPlate)', transform: 'scale(0.972)', stroke: '#000', 'stroke-opacity': 0.25, 'stroke-width': 0.6 }, sg);
        el('path', { d: `M 0 0 L ${pt(polar(36, 180 * DEG))}`, stroke: 'url(#gRhodBevel)', 'stroke-width': 16, 'stroke-linecap': 'round' }, sg);
        el('circle', { r: 11, fill: 'url(#gRhodBevel)' }, sg);
        el('circle', { r: 8.6, fill: 'url(#pCotes)' }, sg);
        for (let h = 0; h <= 72; h += 6) {
          const a = (L.prA0 + ((L.prA1 - L.prA0) * h) / 72) * DEG;
          const major = h % 24 === 0;
          const p1 = polar(major ? 52 : 56, a), p2 = polar(62, a);
          el('line', { x1: n2(p1[0]), y1: n2(p1[1]), x2: n2(p2[0]), y2: n2(p2[1]), stroke: '#1b1c1f', 'stroke-width': major ? 1.5 : 0.8 }, sg);
          if (major) {
            const p = polar(69.5, a);
            const t = el('text', { x: n2(p[0]), y: n2(p[1]), 'font-size': 7.5, 'font-family': '"Helvetica Neue", Arial, sans-serif', fill: '#1b1c1f', 'text-anchor': 'middle', 'dominant-baseline': 'central', 'font-variant-numeric': 'tabular-nums' }, sg);
            t.textContent = String(h);
          }
        }
        const arc0 = polar(44, (L.prA0 + 6) * DEG), arc1 = polar(44, (L.prA1 - 6) * DEG);
        el('path', { id: 'tpPR', d: `M ${pt(arc1)} A 44 44 0 0 0 ${pt(arc0)}`, fill: 'none' }, DEFS);
        const lab = el('text', { 'font-size': 5.6, 'letter-spacing': 1.6, 'font-family': '"Helvetica Neue", Arial, sans-serif', fill: '#3a3b40', 'text-anchor': 'middle' }, sg);
        el('textPath', { href: '#tpPR', startOffset: '50%' }, lab).textContent = 'RÉSERVE DE MARCHE';
      }
      // jewels & screws
      jewel(g, 0, 0, 4.2);
      jewel(g, C3[0], C3[1], 3.6);
      const scr = [
        [bl, 21], [br, 64], [trn, 77],
        [polar(12, 90 * DEG, C3[0], C3[1]), 15],
      ];
      for (const [p, s] of scr) screw(g, p[0], p[1], p === bl || p === br || p === trn ? 6.4 : 4.4, s);
      screw(g, CW[0], CW[1], 6, 48);
    }

    /* ---------- 6 · hands, winding works, crown (dynamic) ---------- */
    const lyTop = add('top', 'Aiguilles · remontoir');
    {
      const g = lyTop.g;
      const D = H.dyn;
      // ratchet + crown wheel on the barrel bridge
      const shadowR = el('g', { transform: `translate(${n2(L.barrel[0] + 3)} ${n2(L.barrel[1] + 5)})` }, g);
      el('circle', { r: 37, fill: '#000', opacity: 0.4 }, shadowR);
      const shadowC = el('g', { transform: `translate(${n2(L.crownW[0] + 3)} ${n2(L.crownW[1] + 5)})` }, g);
      el('circle', { r: 25, fill: '#000', opacity: 0.4 }, shadowC);
      D.ratchet = wheel(g, { z: L.zRat, m: L.mW, spokes: 5, hub: 12, spokeW: 5, rim: 5, pal: PAL.steel, edge: '#2c3238', twist: 0.4, bend: 0.2 });
      screw(D.ratchet.g, 0, 0, 9, 0);
      D.crownWheel = wheel(g, { z: L.zCw, m: L.mW, spokes: 4, hub: 8, spokeW: 4, rim: 4, pal: PAL.steel, edge: '#2c3238', twist: 0.4, bend: 0.2 });
      screw(D.crownWheel.g, 0, 0, 5, 0);
      // click (pawl) & click spring
      {
        const piv = polar(58, 202 * DEG, L.barrel[0], L.barrel[1]);
        D.click = { g: el('g', null, g), last: '', piv };
        const tipL = polar(36.5, 186 * DEG, L.barrel[0], L.barrel[1]);
        const dx = tipL[0] - piv[0], dy = tipL[1] - piv[1];
        const len = Math.hypot(dx, dy);
        const a = (Math.atan2(dy, dx) * 180) / Math.PI;
        const cg = el('g', { transform: `translate(${n2(piv[0])} ${n2(piv[1])}) rotate(${n2(a)})` }, D.click.g);
        D.click.inner = el('g', null, cg);
        const d = `M -6 -5 Q ${n2(len * 0.5)} -7 ${n2(len)} -1.2 L ${n2(len + 1.6)} 1.6 Q ${n2(len * 0.5)} 4 -6 5 A 6.2 6.2 0 0 1 -6 -5 Z`;
        el('path', { d, fill: '#000', opacity: 0.35, transform: 'translate(2 3)' }, D.click.inner);
        el('path', { d, fill: 'url(#gSteel)', stroke: '#22282d', 'stroke-width': 0.6 }, D.click.inner);
        screw(cg, 0, 0, 3.8, 30);
        const sp0 = polar(76, 215 * DEG, L.barrel[0], L.barrel[1]);
        el('path', { d: `M ${pt(sp0)} Q ${n2(piv[0] - 26)} ${n2(piv[1] + 4)} ${n2(piv[0] - 3)} ${n2(piv[1] + 9)}`, fill: 'none', stroke: '#c9d0d6', 'stroke-width': 1.6, 'stroke-linecap': 'round' }, g);
      }
      // power-reserve hand (blued)
      D.prHand = { g: el('g', null, g), last: '' };
      {
        const hg = D.prHand.g;
        el('path', { d: 'M -1.6 8 L 0 -60 L 1.6 8 Z', fill: '#000', opacity: 0.4, transform: 'translate(2 3.5)' }, hg);
        el('path', { d: 'M -1.6 8 L 0 -60 L 1.6 8 Z', fill: 'url(#gHandBlue)', stroke: '#0a1a44', 'stroke-width': 0.3 }, hg);
        el('circle', { cy: 10, r: 3.6, fill: 'url(#gBlue)' }, hg);
        el('circle', { r: 4.2, fill: 'url(#gBlue)', stroke: '#0a1a44', 'stroke-width': 0.4 }, hg);
        el('circle', { r: 1.2, fill: '#0a1a44' }, hg);
      }
      // hands: hour then minute, each with its own cast shadow
      const handShapes = (len, w, hub, tailLen) => ({
        blade: `M 0 ${-len} Q ${w} ${-len * 0.6} ${w * 0.4} -24 L ${-w * 0.4} -24 Q ${-w} ${-len * 0.6} 0 ${-len} Z` +
          `M 0 ${-(len - 18)} Q ${w * 0.6} ${-len * 0.6} ${w * 0.18} -44 L ${-w * 0.18} -44 Q ${-w * 0.6} ${-len * 0.6} 0 ${-(len - 18)} Z`,
        hub,
        tail: `M -3.2 10 L -2.2 ${tailLen} L 2.2 ${tailLen} L 3.2 10 Z`,
        tailLen,
      });
      const mkHand = (spec) => {
        const sh = el('g', null, g);
        const hd = el('g', null, g);
        for (const [grp, fill, stroke, op] of [[sh, '#000', 'none', 0.38], [hd, 'url(#gHandRose)', '#5b301f', 1]]) {
          const attrs = { fill, opacity: op };
          if (stroke !== 'none') { attrs.stroke = stroke; attrs['stroke-width'] = 0.6; }
          el('path', Object.assign({ d: spec.blade, 'fill-rule': 'evenodd' }, attrs), grp);
          el('path', Object.assign({ d: spec.tail }, attrs), grp);
          el('circle', Object.assign({ r: spec.hub }, attrs), grp);
          el('path', Object.assign({ d: G.circle(6.4, 0, spec.tailLen) + G.circle(3.2, 0, spec.tailLen), 'fill-rule': 'evenodd' }, attrs), grp);
        }
        return { sh: { g: sh, last: '' }, hd: { g: hd, last: '' } };
      };
      D.hour = mkHand(handShapes(222, 19, 15, 42));
      D.minute = mkHand(handShapes(338, 14, 11, 60));
      el('circle', { r: 8.6, fill: 'url(#gCapRose)', stroke: '#5b301f', 'stroke-width': 0.6 }, g);
      el('circle', { r: 2.2, fill: '#3b1d12' }, g);
      // crown
      D.crown = { g: el('g', { class: 'crown-group' }, g), knurl: [], last: '' };
      {
        const cg = D.crown.g;
        el('rect', { x: 452, y: -14, width: 14, height: 28, fill: 'url(#gCrown)', stroke: '#3d1d12', 'stroke-width': 0.8 }, cg);
        el('rect', { x: 468, y: -40, width: 10, height: 80, rx: 4, fill: '#000', opacity: 0.35, transform: 'translate(3 6)' }, cg);
        el('rect', { x: 464, y: -40, width: 38, height: 80, rx: 7, fill: 'url(#gCrown)', stroke: '#3d1d12', 'stroke-width': 1 }, cg);
        for (let i = 0; i < 26; i++) {
          D.crown.knurl.push(el('line', { x1: 467, x2: 499, y1: 0, y2: 0, stroke: '#3a1c11', 'stroke-width': 1.3 }, cg));
        }
        el('rect', { x: 499, y: -37, width: 5, height: 74, rx: 2.4, fill: 'url(#gCrown)', stroke: '#3d1d12', 'stroke-width': 0.6 }, cg);
        D.crownHit = el('rect', { x: 440, y: -78, width: 100, height: 156, fill: '#000', 'fill-opacity': 0, class: 'crown-hit' }, g);
      }
    }

    /* ---------- 7 · chapter ring, indices, bezel ---------- */
    const lyDial = add('dial', 'Réhaut & index · chapter ring');
    {
      const g = lyDial.g;
      el('path', { d: G.circle(397) + G.circle(351), 'fill-rule': 'evenodd', fill: '#110f0e', 'fill-opacity': 0.72 }, g);
      el('circle', { r: 351, fill: 'none', stroke: '#e8d3b0', 'stroke-opacity': 0.28, 'stroke-width': 0.9 }, g);
      el('circle', { r: 384.5, fill: 'none', stroke: '#e8d3b0', 'stroke-opacity': 0.22, 'stroke-width': 0.6 }, g);
      for (let i = 0; i < 60; i++) {
        if (i % 5 === 0) continue;
        const a = (i * 6 - 90) * DEG;
        const p1 = polar(386.5, a), p2 = polar(393.5, a);
        el('line', { x1: n2(p1[0]), y1: n2(p1[1]), x2: n2(p2[0]), y2: n2(p2[1]), stroke: '#dcc9a6', 'stroke-width': 1.1, opacity: 0.85 }, g);
      }
      for (let h = 0; h < 12; h++) {
        const ig = el('g', { transform: `rotate(${h * 30})` }, g);
        const offs = h === 0 ? [-6.2, 6.2] : [0];
        for (const ox of offs) {
          el('rect', { x: ox - 3.6 + 1.6, y: -388 + 2.6, width: 7.2, height: 31, rx: 1, fill: '#000', opacity: 0.5 }, ig);
          el('rect', { x: ox - 3.6, y: -388, width: 7.2, height: 31, rx: 1, fill: 'url(#gIndex)', stroke: '#5b301f', 'stroke-width': 0.5 }, ig);
        }
        if (h % 3 === 0) {
          el('circle', { cx: 0, cy: -393.5, r: 1.6, fill: '#e9c9b1' }, ig);
        }
      }
      el('path', { d: G.circle(398) + G.circle(372), 'fill-rule': 'evenodd', fill: 'url(#gBezelShade)' }, g);
      lyDial.bezel = el('g', { class: 'bezel-group' }, g);
      el('image', { href: tex.bezel, x: -448, y: -448, width: 896, height: 896, 'clip-path': 'url(#clipBezel)', preserveAspectRatio: 'none' }, lyDial.bezel);
      el('circle', { r: 447.5, fill: 'none', stroke: '#3a1d12', 'stroke-width': 1.6 }, lyDial.bezel);
      el('circle', { r: 398.2, fill: 'none', stroke: '#2a140c', 'stroke-width': 2.2 }, lyDial.bezel);
      el('circle', { r: 400.2, fill: 'none', stroke: '#fff0e4', 'stroke-opacity': 0.55, 'stroke-width': 0.9 }, lyDial.bezel);
      el('circle', { r: 436, fill: 'none', stroke: '#fff0e4', 'stroke-opacity': 0.2, 'stroke-width': 0.8 }, lyDial.bezel);
    }

    /* ---------- 8 · sapphire crystal ---------- */
    const lyCrystal = add('crystal', 'Glace saphir · sapphire crystal');
    {
      const g = lyCrystal.g;
      el('circle', { r: 398, fill: 'url(#gSapph)' }, g);
      const a0 = 196 * DEG, a1 = 292 * DEG;
      const p0 = polar(392, a0), p1 = polar(392, a1);
      el('path', { d: `M ${pt(p0)} A 392 392 0 0 1 ${pt(p1)} A 470 470 0 0 0 ${pt(p0)} Z`, fill: 'url(#gCrescent)' }, g);
      el('rect', { x: -250, y: -330, width: 150, height: 520, rx: 40, fill: 'url(#gSoftbox)', transform: 'rotate(38)' }, g);
      const s0 = polar(393, 206 * DEG), s1 = polar(393, 262 * DEG);
      el('path', { d: `M ${pt(s0)} A 393 393 0 0 1 ${pt(s1)}`, fill: 'none', stroke: '#ffffff', 'stroke-opacity': 0.5, 'stroke-width': 1.4, 'stroke-linecap': 'round' }, g);
      const q0 = polar(393, 22 * DEG), q1 = polar(393, 64 * DEG);
      el('path', { d: `M ${pt(q0)} A 393 393 0 0 1 ${pt(q1)}`, fill: 'none', stroke: '#ffffff', 'stroke-opacity': 0.16, 'stroke-width': 1.2, 'stroke-linecap': 'round' }, g);
      el('circle', { r: 397, fill: 'none', stroke: '#dfe8ff', 'stroke-opacity': 0.12, 'stroke-width': 2 }, g);
    }

    /* ---------- torque-flow overlay (exploded / CAD mode) ---------- */
    const lyFlow = add('flow', '');
    {
      const g = lyFlow.g;
      const nodes = [L.barrel, [0, 0], L.third, L.T];
      const d = `M ${pt(nodes[0])} L ${pt(nodes[1])} L ${pt(nodes[2])} L ${pt(nodes[3])}`;
      el('path', { d, fill: 'none', stroke: '#0d0a08', 'stroke-opacity': 0.7, 'stroke-width': 7, 'stroke-linejoin': 'round' }, g);
      el('path', { d, fill: 'none', stroke: '#e6c07e', 'stroke-width': 2.6, 'stroke-dasharray': '12 9', 'stroke-linejoin': 'round', class: 'flow-dash' }, g);
      nodes.forEach((p, i) => {
        el('circle', { cx: n2(p[0]), cy: n2(p[1]), r: 13, fill: '#0d0a08', 'fill-opacity': 0.75, stroke: '#e6c07e', 'stroke-width': 1.6 }, g);
        const t = el('text', { x: n2(p[0]), y: n2(p[1]), 'font-size': 12, 'font-family': 'Didot, Georgia, serif', fill: '#f1dcb2', 'text-anchor': 'middle', 'dominant-baseline': 'central' }, g);
        t.textContent = ['I', 'II', 'III', 'IV'][i];
      });
      // escapement node rides on the cage: drawn as ring around the tourbillon
      el('circle', { cx: L.T[0], cy: L.T[1], r: L.cageR + 8, fill: 'none', stroke: '#e6c07e', 'stroke-opacity': 0.6, 'stroke-width': 1.2, 'stroke-dasharray': '3 6', class: 'flow-dash' }, g);
    }

    H.svgs = H.layers.map((l) => l.svg);
    H.byName = {};
    for (const l of H.layers) H.byName[l.name] = l;
    return H;
  }

  root.CO5.movement = { build, layout: L, el };
})(window);
