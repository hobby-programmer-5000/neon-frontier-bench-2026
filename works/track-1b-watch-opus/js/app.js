/*
 * Chronos Calibre O-5 — kinematics, studio UI and benchmark harness
 *
 * Single source of truth: the balance phase τ. The balance swings as
 * θ(τ) = A·sin(2π·4·τ); each zero crossing is one beat (8 per second). The
 * escapement releases the escape wheel by half a tooth (12°) during the short
 * lift window around each crossing, so the beat count B is a smooth staircase.
 * Everything else is derived from B through the actual tooth ratios:
 *   escape wheel (in cage)  = 12°·B
 *   tourbillon cage         = escape / (128/8) → 0.75°·B → 6°/s → 60 s/rev
 *   third, centre, barrel   = external-mesh phasing law through 75/10, 80/10, 90/12
 * so the hands, cage seconds and wheels can never drift apart.
 */
(function () {
  'use strict';

  const META = (window.__BENCH_META__ = {
    id: 'track-1b-watch-opus',
    title: 'Chronos Calibre O-5',
    domain: 'Horology & Precision CAD',
    model: 'claude-opus-5-5',
    effort: 'high',
    technique: 'Cross-Vendor Single-Agent Control',
    ready: false,
    bootMs: 0,
    shaderPrewarmMs: 0,
    drawCalls: 0,
    triangles: 0,
    fps: 0,
    telemetry: {},
  });

  const CO5 = window.CO5;
  const G = CO5.geo;
  const TAU = Math.PI * 2;
  const DEG = Math.PI / 180;
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const r2 = (v) => (Math.round(v * 100) / 100).toFixed(2);
  const mod360 = (a) => ((a % 360) + 360) % 360;

  const $ = (id) => document.getElementById(id);
  const stage = $('stage');
  const rig = $('rig');
  const backdrop = $('backdrop');

  /* ------------------------------------------------------------ boot */
  const tBoot0 = performance.now();
  CO5.textures.paintBackdrop(backdrop);
  const tex = CO5.textures.buildAll();
  const tBoot1 = performance.now();
  const H = CO5.movement.build(rig, $('defs'), tex);
  const L = H.L;
  const D = H.dyn;
  const audio = new CO5.LeverAcoustics();

  const LAYER_Z = { case: 0, plate: 1, train: 2, flow: 2.6, fixed: 3, cage: 4, balance: 4.35, cagetop: 4.7, bridges: 5.4, top: 6.2, dial: 7, crystal: 8 };

  /* Exploded-CAD machined thickness: each static plate is extruded by stacking
   * progressively darker silhouette copies just beneath it in Z (side walls).
   * They only exist in the layout while the exploded view is active. */
  const SLAB_SPEC = { plate: 3, fixed: 2, bridges: 2, dial: 3, crystal: 1 };
  const SLAB_STEP = 3.2; // px between successive wall slices
  const slabs = [];
  for (const name of Object.keys(SLAB_SPEC)) {
    const ly = H.byName[name];
    ly.div.style.transformStyle = 'preserve-3d';
    for (let k = SLAB_SPEC[name]; k >= 1; k--) {
      const svg = ly.svg.cloneNode(true);
      svg.classList.add('slab');
      const glass = name === 'crystal';
      const b = glass ? 1.15 : Math.max(0.18, 0.56 - k * 0.12);
      svg.style.filter = glass ? 'brightness(1.15)' : `brightness(${b.toFixed(2)}) saturate(0.75)`;
      svg.style.transform = 'translateZ(' + (-k * SLAB_STEP).toFixed(1) + 'px)';
      ly.div.insertBefore(svg, ly.svg);
      slabs.push({ svg, name, dz: k * SLAB_STEP });
      H.svgs.push(svg);
    }
  }
  const tBoot2 = performance.now();

  /* ------------------------------------------------------------ state */
  const now0 = new Date();
  const S = {
    tau: 0.03,
    A: 0,
    P: 38.4,
    B: 0,
    boff: 0,
    active: true,
    paused: false,
    scale: 1,
    winding: false,
    dragWind: 0,
    demoWind: 0,
    arbor: 0,
    view: 'hero',
    lastBeat: 0,
    lastClick: 0,
    lastSpringP: -1,
    W0: now0.getHours() * 3600 + now0.getMinutes() * 60 + now0.getSeconds() + now0.getMilliseconds() / 1000,
    Bstart: 0,
    fps: 60,
    frames: 0,
  };
  const ampTarget = (P) => (P > 0 ? 195 + 110 * (1 - Math.exp(-P / 14)) : 0);
  S.A = ampTarget(S.P);

  function beatRaw(tau, A) {
    const w = Math.asin(Math.min(1, L.halfLift / Math.max(A, L.halfLift))) / (TAU * 4);
    const n = Math.round(8 * tau);
    const u = (tau - n / 8) / w;
    const f = clamp((u + 1) / 2, 0, 1);
    return n + f * f * (3 - 2 * f);
  }
  S.B = beatRaw(S.tau, S.A);
  S.Bstart = S.B;
  S.lastBeat = Math.floor(S.B);

  function torque(P) {
    const Tb = P > 0 ? 5.6 + 6.4 * Math.pow(P / 72, 0.7) : 0; // mN·m
    const eta = 0.93;
    const c = (Tb / 7.5) * eta;
    const t3 = (c / 8) * eta;
    const t4 = (t3 / 7.5) * eta;
    const te = (t4 / 16) * eta;
    return [Tb, c, t3, t4, te];
  }
  const fmtTorque = (t) => [
    t[0].toFixed(2) + ' mN·m',
    t[1].toFixed(3) + ' mN·m',
    (t[2] * 1000).toFixed(1) + ' µN·m',
    (t[3] * 1000).toFixed(2) + ' µN·m',
    (t[4] * 1000).toFixed(3) + ' µN·m',
  ];

  /* ------------------------------------------------------------ simulation */
  function simulate(dt) {
    if (dt <= 0) return;
    const At = ampTarget(S.P);
    S.A += (At - S.A) * (1 - Math.exp(-dt / (S.P > 0 ? 2.2 : 1.1)));
    S.tau += dt;
    const raw = beatRaw(S.tau, S.A);
    if (S.active) {
      S.B = raw + S.boff;
      if (S.A < L.halfLift + 3) S.active = false;
    } else if (S.P > 0 && S.A >= L.halfLift + 8) {
      S.active = true;
      S.boff = S.B - raw;
    }
    if (S.active) S.P = Math.max(0, S.P - dt / 3600);
  }

  function wind(dtReal) {
    let w = 0;
    if (S.winding) w += 9 * dtReal;
    if (S.dragWind) { w += S.dragWind; S.dragWind = 0; }
    if (S.demoWind > 0) {
      const d = Math.min(S.demoWind, 110 * dtReal);
      S.demoWind -= d;
      w += d;
    }
    if (w <= 0) return;
    const dP = Math.min(72 - S.P, w);
    if (dP <= 0) return;
    S.P += dP;
    S.arbor += (dP / 7.5) * 360;
  }

  /* ------------------------------------------------------------ rendering */
  function setT(h, str) {
    if (h.last !== str) {
      h.g.setAttribute('transform', str);
      h.last = str;
    }
  }
  function setGrad(h, a) {
    if (!h.grad) return;
    const s = 'rotate(' + r2(-a) + ')';
    if (h.gl !== s) {
      h.grad.setAttribute('gradientTransform', s);
      h.gl = s;
    }
  }
  const tr = (p) => 'translate(' + r2(p[0]) + ' ' + r2(p[1]) + ')';
  const TR = { third: tr(L.third), barrel: tr(L.barrel), T: tr(L.T), crownW: tr(L.crownW), pr: tr(L.pr), esc: 'translate(' + r2(L.escD) + ' 0)', piv: 'translate(' + r2(L.pivot) + ' 0)' };

  function hairPath(thetaDeg) {
    const hs = L.hair;
    const N = hs.turns * 16;
    const th = thetaDeg * DEG;
    const aOut = hs.stud * DEG;
    let d = '';
    for (let i = 0; i <= N; i++) {
      const s = i / N;
      const a = aOut - (1 - s) * hs.turns * TAU + th * (1 - s);
      const r = hs.rin + (hs.rout - hs.rin) * s;
      d += (i ? 'L' : 'M') + (r * Math.cos(a)).toFixed(2) + ' ' + (r * Math.sin(a)).toFixed(2);
    }
    return d;
  }

  let springSegs = 0;
  const knurlState = { last: null };
  function render() {
    const W = S.W0 + (S.B - S.Bstart) / 8;
    const cage = 6 * W;
    const theta = S.A * Math.sin(TAU * 4 * S.tau);
    const fork = -(L.rj / L.forkL) * clamp(theta, -L.halfLift, L.halfLift);
    const esc = L.esc0 + 12 * S.B;
    const escPin = G.meshAngle(-cage, L.zF, L.zEp, 0);
    const th4 = cage;
    const th3 = G.meshAngle(th4, L.z4p, L.z3, L.psiT3);
    const thC = G.meshAngle(th3, L.z3p, L.zC, L.psi3C);
    const thB = G.meshAngle(thC, L.zCp, L.zB, L.psiCB);
    const rat = -S.arbor;
    const cw = G.meshAngle(rat, L.zRat, L.zCw, L.psiRC);

    setT(D.center, 'rotate(' + r2(mod360(thC)) + ')');
    setGrad(D.center, thC);
    setT(D.centerPinion, 'rotate(' + r2(mod360(thC)) + ')');
    setT(D.third, TR.third + ' rotate(' + r2(mod360(th3)) + ')');
    setGrad(D.third, th3);
    setT(D.thirdPinion, TR.third + ' rotate(' + r2(mod360(th3)) + ')');
    setT(D.barrel, TR.barrel + ' rotate(' + r2(mod360(thB)) + ')');
    setGrad(D.barrel, thB);
    setT(D.arbor, TR.barrel + ' rotate(' + r2(mod360(rat)) + ')');
    setT(D.cagePinion, TR.T + ' rotate(' + r2(mod360(th4)) + ')');

    const cageT = TR.T + ' rotate(' + r2(mod360(cage)) + ')';
    setT(D.cage, cageT);
    setT(D.cageBal, cageT);
    setT(D.cageTop, cageT);
    setT(D.escPinion, TR.esc + ' rotate(' + r2(mod360(escPin)) + ')');
    setT(D.escWheel, TR.esc + ' rotate(' + r2(mod360(esc)) + ')');
    setGrad(D.escWheel, cage + esc);
    setT(D.pallet, TR.piv + ' rotate(' + r2(fork) + ')');
    const thS = 'rotate(' + r2(theta) + ')';
    if (D.balance.last !== thS) {
      setT(D.roller, thS);
      setT(D.balance, thS);
      D.hair.setAttribute('d', hairPath(theta));
    }

    if (Math.abs(S.P - S.lastSpringP) > 0.04) {
      const ms = G.mainspring(clamp(S.P / 72, 0, 1), L.spring);
      D.spring.setAttribute('d', ms.d);
      D.springHi.setAttribute('d', ms.d);
      springSegs = ms.segments;
      S.lastSpringP = S.P;
    }

    setT(D.ratchet, TR.barrel + ' rotate(' + r2(mod360(rat)) + ')');
    setGrad(D.ratchet, rat);
    setT(D.crownWheel, TR.crownW + ' rotate(' + r2(mod360(cw)) + ')');
    setGrad(D.crownWheel, cw);
    const pitch = 360 / L.zRat;
    const ph = (((S.arbor % pitch) + pitch) % pitch) / pitch;
    const clickA = -4.2 * ph;
    const cs = 'rotate(' + r2(clickA) + ')';
    if (D.click.last !== cs) { D.click.inner.setAttribute('transform', cs); D.click.last = cs; }

    const prA = L.prA0 + ((L.prA1 - L.prA0) * clamp(S.P, 0, 72)) / 72;
    setT(D.prHand, TR.pr + ' rotate(' + r2(prA + 90) + ')');

    const minute = mod360(W / 10);
    const hour = mod360(W / 120);
    setT(D.hour.hd, 'rotate(' + r2(hour) + ')');
    setT(D.hour.sh, 'translate(5 9) rotate(' + r2(hour) + ')');
    setT(D.minute.hd, 'rotate(' + r2(minute) + ')');
    setT(D.minute.sh, 'translate(6 11) rotate(' + r2(minute) + ')');

    // crown knurling rotates about the stem axis
    const crownRot = S.arbor * 2.25;
    if (knurlState.last !== crownRot) {
      const kn = D.crown.knurl;
      for (let i = 0; i < kn.length; i++) {
        const phi = (i / kn.length) * TAU + crownRot * DEG;
        const c = Math.cos(phi);
        const y = (37 * Math.sin(phi)).toFixed(2);
        kn[i].setAttribute('y1', y);
        kn[i].setAttribute('y2', y);
        kn[i].setAttribute('opacity', c > 0.04 ? (0.25 + 0.7 * c).toFixed(2) : '0');
      }
      knurlState.last = crownRot;
    }
    return { W, cage, theta, esc, fork };
  }

  /* ------------------------------------------------------------ views */
  const VB = {
    hero: [-560, -560, 1120, 1120],
    macro: [L.T[0] - 233.33, L.T[1] - 233.33, 466.67, 466.67],
    alt_mode: [-560, -560, 1120, 1120],
  };
  const CAPTIONS = {
    hero: ['Studio', 'Assembled · sapphire crystal up'],
    macro: ['Macro ×2.4', 'Tourbillon 60″ · Swiss lever · 28 800 vph'],
    alt_mode: ['Exploded CAD', 'Z-axis layer stack · kinematic torque flow'],
  };
  const vbState = { cur: VB.hero.slice(), from: VB.hero.slice(), to: VB.hero.slice(), t0: 0, dur: 460, active: false };
  function applyVB(v) {
    const s = v.map((x) => x.toFixed(2)).join(' ');
    for (const svg of H.svgs) svg.setAttribute('viewBox', s);
  }
  let settleTimer = 0;
  let labelsUntil = 0;
  function layoutLayers() {
    const exploded = S.view === 'alt_mode';
    const gap = Math.max(60, rig.clientHeight * 0.1);
    for (const ly of H.layers) {
      const z = exploded ? (LAYER_Z[ly.name] - 4) * gap : 0;
      ly.div.style.transform = 'translateZ(' + z.toFixed(1) + 'px)';
    }
  }
  function setView(name) {
    if (name === 'demo' || name === 'action_state') {
      runDemo();
      return true;
    }
    if (!VB[name]) return false;
    S.view = name;
    vbState.from = vbState.cur.slice();
    vbState.to = VB[name].slice();
    vbState.t0 = performance.now();
    vbState.active = true;
    stage.classList.toggle('exploded', name === 'alt_mode');
    stage.classList.remove('settled');
    clearTimeout(settleTimer);
    if (name === 'alt_mode') {
      settleTimer = setTimeout(() => stage.classList.add('settled'), 380);
      labelsUntil = performance.now() + 1200;
    }
    layoutLayers();
    document.querySelectorAll('[data-view]').forEach((b) => {
      const on = b.dataset.view === name;
      b.classList.toggle('on', on);
      b.setAttribute('aria-pressed', on ? 'true' : 'false');
    });
    $('capK').textContent = CAPTIONS[name][0];
    $('capV').textContent = CAPTIONS[name][1];
    return true;
  }
  function stepVB(t) {
    if (!vbState.active) return;
    const k = clamp((t - vbState.t0) / vbState.dur, 0, 1);
    const e = k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2;
    for (let i = 0; i < 4; i++) vbState.cur[i] = vbState.from[i] + (vbState.to[i] - vbState.from[i]) * e;
    applyVB(vbState.cur);
    if (k >= 1) vbState.active = false;
  }

  /* ------------------------------------------------------------ exploded labels */
  const LAYER_LABELS = [
    ['crystal', '08', 'Sapphire crystal', 'Glace saphir'],
    ['dial', '07', 'Chapter ring', 'Réhaut & index'],
    ['top', '06', 'Hands & winding', 'Aiguilles · remontoir'],
    ['bridges', '05', 'Bridges', 'Côtes de Genève'],
    ['cage', '04', 'Tourbillon cage', 'Cage 60″ · 4 Hz'],
    ['fixed', '03', 'Fixed 4th wheel', 'Roue fixe · 128 dents'],
    ['train', '02', 'Going train', 'Rouage · barillet'],
    ['plate', '01', 'Main plate', 'Platine perlée'],
  ];
  const TORQUE_LABELS = [
    ['flow', 'I', 'Barrel', L.barrel, 0],
    ['flow', 'II', 'Centre wheel', [0, 0], 1],
    ['flow', 'III', 'Third wheel', L.third, 2],
    ['fixed', 'IV', 'Tourbillon pinion', L.T, 3],
    ['cage', 'V', 'Escape → balance', L.T, 4],
  ];
  const xlabels = $('xlabels');
  const leaders = $('leaders');
  const anchors = [];
  function mkAnchor(layerName, pt) {
    const ly = H.byName[layerName];
    const s = document.createElement('span');
    s.style.cssText = 'position:absolute;width:1px;height:1px;left:0;top:0;';
    ly.div.appendChild(s);
    return { el: s, pt };
  }
  const LABEL_ANCHOR = {
    crystal: G.polar(398, 210 * DEG),
    dial: G.polar(394, 210 * DEG),
    top: [0, 0],
    bridges: G.polar(352, -146 * DEG),
    cage: G.polar(L.cageR, 180 * DEG, L.T[0], L.T[1]),
    fixed: G.polar(141, 180 * DEG, L.T[0], L.T[1]),
    train: G.polar(117, 180 * DEG, L.barrel[0], L.barrel[1]),
    plate: G.polar(398, 210 * DEG),
  };
  const left = LAYER_LABELS.map(([name, num, t, f]) => {
    const div = document.createElement('div');
    div.className = 'xl left';
    div.innerHTML = '<span class="xl-t">' + num + ' · ' + t + '</span><span class="xl-f">' + f + '</span>';
    xlabels.appendChild(div);
    const a = mkAnchor(name, LABEL_ANCHOR[name]);
    anchors.push(a);
    return { div, a };
  });
  const right = TORQUE_LABELS.map(([name, num, t, p, qi]) => {
    const div = document.createElement('div');
    div.className = 'xl right';
    div.innerHTML = '<span class="xl-t">' + num + ' · ' + t + '</span><span class="xl-v" data-q="' + qi + '">—</span>';
    xlabels.appendChild(div);
    const a = mkAnchor(name, p);
    anchors.push(a);
    return { div, a, val: div.querySelector('.xl-v') };
  });
  function placeAnchors() {
    const W = rig.clientWidth, Hh = rig.clientHeight;
    const s = Math.min(W / 1120, Hh / 1120);
    for (const a of anchors) {
      a.el.style.left = (W / 2 + a.pt[0] * s).toFixed(1) + 'px';
      a.el.style.top = (Hh / 2 + a.pt[1] * s).toFixed(1) + 'px';
    }
  }
  function layoutLabels() {
    const sr = stage.getBoundingClientRect();
    const W = sr.width;
    const colW = W < 900 ? 150 : 190;
    const pad = W < 900 ? 12 : 30;
    const pos = (list) => {
      // Exact CSS 3D projection: stage perspective ∘ rig matrix ∘ layer matrix.
      const rw = rig.clientWidth, rh = rig.clientHeight;
      const s = Math.min(rw / 1120, rh / 1120);
      const rigM = new DOMMatrix(getComputedStyle(rig).transform === 'none' ? undefined : getComputedStyle(rig).transform);
      const persp = parseFloat(getComputedStyle(stage).perspective) || 2600;
      const ox = sr.width * 0.5, oy = sr.height * 0.42;
      return list.map((o) => {
        const lt = getComputedStyle(o.a.el.parentNode).transform;
        const M = rigM.multiply(new DOMMatrix(lt === 'none' ? undefined : lt));
        const q = M.transformPoint(new DOMPoint(o.a.pt[0] * s, o.a.pt[1] * s, 0, 1));
        const X = q.x + rw / 2, Y = q.y + rh / 2;
        const k = persp / Math.max(1, persp - q.z);
        return { o, x: ox + (X - ox) * k, y: oy + (Y - oy) * k };
      });
    };
    const spread = (arr, minGap, keepOrder) => {
      if (!keepOrder) arr.sort((a, b) => a.y - b.y);
      for (let i = 0; i < arr.length; i++) {
        arr[i].ly = arr[i].y;
        if (i && arr[i].ly < arr[i - 1].ly + minGap) arr[i].ly = arr[i - 1].ly + minGap;
      }
      return arr;
    };
    const lp = spread(pos(left), 40, false);
    const rp = spread(pos(right), 44);
    let svg = '';
    const stroke = 'rgba(230,200,150,0.5)';
    for (const p of lp) {
      p.o.div.style.left = pad + 'px';
      p.o.div.style.top = (p.ly - 14).toFixed(1) + 'px';
      const x0 = pad + colW + 8;
      svg += `<polyline points="${x0},${p.ly.toFixed(1)} ${(x0 + 14).toFixed(1)},${p.ly.toFixed(1)} ${p.x.toFixed(1)},${p.y.toFixed(1)}" fill="none" stroke="${stroke}" stroke-width="0.8"/>`;
      svg += `<circle cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="2.2" fill="#e6c07e"/>`;
    }
    for (const p of rp) {
      const lx = W - pad - colW;
      p.o.div.style.left = lx + 'px';
      p.o.div.style.top = (p.ly - 14).toFixed(1) + 'px';
      const x0 = lx - 8;
      svg += `<polyline points="${p.x.toFixed(1)},${p.y.toFixed(1)} ${(x0 - 14).toFixed(1)},${p.ly.toFixed(1)} ${x0},${p.ly.toFixed(1)}" fill="none" stroke="${stroke}" stroke-width="0.8"/>`;
      svg += `<circle cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="2.2" fill="#e6c07e"/>`;
    }
    leaders.setAttribute('viewBox', `0 0 ${W.toFixed(0)} ${sr.height.toFixed(0)}`);
    leaders.innerHTML = svg;
  }

  /* ------------------------------------------------------------ demo / actions */
  function runDemo() {
    const before = S.P;
    S.demoWind = Math.max(0, 72 - S.P);
    if (S.paused) togglePause(false);
    setView('alt_mode');
    const t = torque(72);
    return (
      'demo: crown winding ' + before.toFixed(1) + ' h → 72.0 h (' + ((72 - before) / 7.5).toFixed(2) +
      ' arbor turns); view=alt_mode (Z-axis exploded CAD layers + kinematic torque flow); barrel torque ' +
      t[0].toFixed(2) + ' mN·m → escape ' + (t[4] * 1000).toFixed(3) + ' µN·m; 28800 vph, 60 s tourbillon'
    );
  }
  function setScale(v) {
    S.scale = v;
    document.querySelectorAll('[data-scale]').forEach((b) => {
      const on = Number(b.dataset.scale) === v;
      b.classList.toggle('on', on);
      b.setAttribute('aria-pressed', on ? 'true' : 'false');
    });
  }
  function togglePause(force) {
    S.paused = typeof force === 'boolean' ? force : !S.paused;
    const b = $('btnPause');
    b.textContent = S.paused ? 'Resume' : 'Pause';
    b.setAttribute('aria-pressed', S.paused ? 'true' : 'false');
  }
  function stepBeat() {
    if (!S.paused) togglePause(true);
    simulate(0.125);
  }
  function toggleSound() {
    const on = audio.setEnabled(!audio.enabled);
    const b = $('btnSound');
    b.setAttribute('aria-pressed', on ? 'true' : 'false');
    b.textContent = on ? 'Sound on' : 'Sound';
  }

  window.__BENCH_ACTIONS__ = {
    setView: (name) => setView(String(name)),
    triggerAction: (name) => {
      const n = String(name || '');
      if (n === 'demo' || n === 'action_state') return runDemo();
      if (VB[n]) { setView(n); return 'view=' + n; }
      if (n === 'wind') { S.demoWind += 12; return 'wind +12 h'; }
      if (n === 'pause') { togglePause(); return S.paused ? 'paused' : 'running'; }
      if (n === 'step') { stepBeat(); return 'stepped one beat (0.125 s)'; }
      if (n.startsWith('speed:')) { const v = Number(n.slice(6)); if ([0.1, 1, 10].includes(v)) { setScale(v); return 'timeScale=' + v; } }
      return 'unknown action: ' + n;
    },
  };

  /* ------------------------------------------------------------ input */
  document.querySelectorAll('[data-view]').forEach((b) => b.addEventListener('click', () => setView(b.dataset.view)));
  document.querySelectorAll('[data-scale]').forEach((b) => b.addEventListener('click', () => setScale(Number(b.dataset.scale))));
  $('btnPause').addEventListener('click', () => togglePause());
  $('btnStep').addEventListener('click', stepBeat);
  $('btnSound').addEventListener('click', toggleSound);
  const windBtn = $('btnWind');
  const windOn = (e) => {
    S.winding = true;
    windBtn.classList.add('active');
    if (e && e.pointerId !== undefined && windBtn.setPointerCapture) windBtn.setPointerCapture(e.pointerId);
  };
  const windOff = () => {
    S.winding = false;
    windBtn.classList.remove('active');
  };
  windBtn.addEventListener('pointerdown', (e) => { e.preventDefault(); windOn(e); });
  windBtn.addEventListener('pointerup', windOff);
  windBtn.addEventListener('pointercancel', windOff);
  windBtn.addEventListener('lostpointercapture', windOff);
  windBtn.addEventListener('keydown', (e) => { if ((e.key === ' ' || e.key === 'Enter') && !e.repeat) { e.preventDefault(); windOn(); } });
  windBtn.addEventListener('keyup', (e) => { if (e.key === ' ' || e.key === 'Enter') windOff(); });
  windBtn.addEventListener('contextmenu', (e) => e.preventDefault());

  const hit = D.crownHit;
  let drag = null;
  hit.addEventListener('pointerdown', (e) => {
    drag = { x: e.clientX, y: e.clientY, id: e.pointerId };
    hit.setPointerCapture(e.pointerId);
    hit.classList.add('dragging');
    e.preventDefault();
  });
  hit.addEventListener('pointermove', (e) => {
    if (!drag || e.pointerId !== drag.id) return;
    const d = Math.hypot(e.clientX - drag.x, e.clientY - drag.y);
    drag.x = e.clientX;
    drag.y = e.clientY;
    S.dragWind += d * 0.08;
  });
  const endDrag = () => { drag = null; hit.classList.remove('dragging'); };
  hit.addEventListener('pointerup', endDrag);
  hit.addEventListener('pointercancel', endDrag);
  hit.addEventListener('lostpointercapture', endDrag);

  window.addEventListener('keydown', (e) => {
    if (e.target && e.target.tagName === 'BUTTON' && (e.key === ' ' || e.key === 'Enter')) return;
    if (e.key === '1') setView('hero');
    else if (e.key === '2') setView('macro');
    else if (e.key === '3') setView('alt_mode');
    else if (e.key === ' ') { e.preventDefault(); togglePause(); }
    else if (e.key === '.') stepBeat();
    else if (e.key === 'm' || e.key === 'M') toggleSound();
    else if ((e.key === 'w' || e.key === 'W') && !e.repeat) windOn();
  });
  window.addEventListener('keyup', (e) => { if (e.key === 'w' || e.key === 'W') windOff(); });

  let resizeQueued = false;
  window.addEventListener('resize', () => {
    if (resizeQueued) return;
    resizeQueued = true;
    requestAnimationFrame(() => {
      resizeQueued = false;
      CO5.textures.paintBackdrop(backdrop);
      placeAnchors();
      layoutLayers();
      if (S.view === 'alt_mode') labelsUntil = performance.now() + 600;
    });
  });

  /* ------------------------------------------------------------ HUD */
  const ui = {
    prVal: $('prVal'), prFill: $('prFill'), prState: $('prState'),
    tFreq: $('tFreq'), tBal: $('tBal'), tBeat: $('tBeat'), tCage: $('tCage'), tTime: $('tTime'), tFps: $('tFps'),
    q: [0, 1, 2, 3, 4].map((i) => $('q' + i)),
  };
  const pad2 = (v) => String(v).padStart(2, '0');
  let elementCount = 0;
  function countElements() {
    elementCount = document.querySelectorAll('#rig svg:not(.slab) *, #defs *').length;
    return elementCount;
  }
  function hud(k) {
    const P = S.P;
    ui.prVal.textContent = P.toFixed(1);
    ui.prFill.style.width = ((P / 72) * 100).toFixed(2) + '%';
    const st = P >= 71.95 ? 'fully wound' : !S.active ? 'stopped' : S.paused ? 'paused' : S.winding || S.demoWind > 0 ? 'winding' : 'running';
    if (ui.prState.textContent !== st) {
      ui.prState.textContent = st;
      ui.prState.className = 'pr-state' + (st === 'fully wound' ? ' full' : st === 'stopped' ? ' stopped' : '');
    }
    ui.tFreq.textContent = S.active ? '28 800 vph' : '— stopped';
    ui.tBal.textContent = '4.00 Hz · ' + Math.round(S.A) + '°';
    ui.tBeat.textContent = '8 /s · ×' + (S.scale === 0.1 ? '0.1' : S.scale);
    ui.tCage.textContent = mod360(k.cage).toFixed(1) + '°';
    const w = ((Math.floor(k.W) % 86400) + 86400) % 86400;
    ui.tTime.textContent = pad2(Math.floor(w / 3600)) + ':' + pad2(Math.floor((w % 3600) / 60)) + ':' + pad2(w % 60);
    ui.tFps.textContent = Math.round(S.fps) + ' fps · ' + elementCount + ' el';
    const tq = fmtTorque(torque(P));
    for (let i = 0; i < 5; i++) ui.q[i].textContent = tq[i];
    for (const r of right) r.val.textContent = tq[Number(r.val.dataset.q)];
  }
  function updateMeta(k) {
    META.fps = Math.round(S.fps * 10) / 10;
    META.drawCalls = elementCount;
    META.triangles = G.stats.segments + springSegs + L.hair.turns * 16;
    META.telemetry = {
      vph: S.active ? 28800 : 0,
      beatRateHz: S.active ? 8 : 0,
      balanceHz: 4,
      amplitudeDeg: Math.round(S.A),
      powerReserveHrs: Math.round(S.P * 100) / 100,
      tourbillonDeg: Math.round(mod360(k.cage) * 10) / 10,
      tourbillonPeriodS: 60,
      escapeWheelDeg: Math.round(mod360(k.esc) * 10) / 10,
      leverDeg: Math.round(k.fork * 100) / 100,
      mode: S.view,
      timeScale: S.scale,
      paused: S.paused,
      running: S.active,
      beats: Math.floor(S.B - S.Bstart),
      gearTeeth: G.stats.teeth,
      jewels: CO5.counts.jewels,
      barrelTorque_mNm: Math.round(torque(S.P)[0] * 100) / 100,
      bootTexturesMs: Math.round(tBoot1 - tBoot0),
      bootTextureBreakdownMs: tex.timings,
      bootSvgBuildMs: Math.round(tBoot2 - tBoot1),
      train: 'barrel 90 → centre pinion 12 · centre 80 → third pinion 10 · third 75 → cage pinion 10 · fixed 128 → escape pinion 8 · escape 15',
    };
  }

  /* ------------------------------------------------------------ loop */
  let last = performance.now();
  let hudT = 0;
  function frame(t) {
    const dtReal = Math.min(0.1, Math.max(0, (t - last) / 1000));
    last = t;
    if (dtReal > 0) S.fps += (1 / dtReal - S.fps) * 0.08;
    wind(dtReal);
    simulate(S.paused ? 0 : dtReal * S.scale);
    stepVB(t);
    const k = render();

    // audio: one voice per completed beat
    const bi = Math.floor(S.B);
    if (bi !== S.lastBeat) {
      const n = bi - S.lastBeat;
      if (n > 0 && audio.enabled) {
        const c = Math.min(n, 12);
        const t0 = audio.now() + 0.015;
        for (let j = 0; j < c; j++) audio.beat(t0 + (j * dtReal) / c, (S.lastBeat + j + 1) % 2 === 1, S.A / 300, S.scale > 2);
      }
      S.lastBeat = bi;
    }
    const ci = Math.floor(S.arbor / (360 / L.zRat));
    if (ci !== S.lastClick) {
      if (audio.enabled) audio.click(audio.now() + 0.01);
      S.lastClick = ci;
    }

    if (S.view === 'alt_mode' && (t < labelsUntil || S.frames % 12 === 0)) layoutLabels();
    hudT += dtReal;
    if (hudT > 0.12 || S.frames < 3) {
      hudT = 0;
      hud(k);
      updateMeta(k);
    }
    S.frames++;
    if (S.frames === 2) {
      countElements();
      updateMeta(k);
      META.ready = true;
      META.bootMs = Math.round(performance.now());
    }
    requestAnimationFrame(frame);
  }

  placeAnchors();
  layoutLayers();
  applyVB(VB.hero);
  render();
  countElements();
  requestAnimationFrame(frame);
})();
