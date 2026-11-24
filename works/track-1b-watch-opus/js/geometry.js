/*
 * Chronos Calibre O-5 — geometry kernel
 * ------------------------------------------------------------
 * Involute spur-gear generation after Litvin & Fuentes, "Gear Geometry and
 * Applied Theory" (2nd ed., 2004), ch. 10: the flank is the involute of the
 * base circle r_b = r·cos(α). At radius ρ ≥ r_b the half-tooth angle is
 *     ψ(ρ) = π/(2z) + inv(α) − inv(α_ρ),   inv(x) = tan x − x,   cos α_ρ = r_b/ρ
 * Below the base circle the flank continues radially to the root circle.
 *
 * Also: skeletonised wheel crossings, Archimedean spirals, the Swiss-lever
 * club-tooth escape wheel and the external-mesh phasing law used to keep every
 * tooth pair interleaved while the train runs.
 */
(function (root) {
  'use strict';

  const TAU = Math.PI * 2;
  const DEG = Math.PI / 180;
  const stats = { teeth: 0, segments: 0 };

  const n2 = (v) => {
    const r = Math.round(v * 100) / 100;
    return (r === 0 ? 0 : r).toString();
  };
  const polar = (r, a, cx = 0, cy = 0) => [cx + r * Math.cos(a), cy + r * Math.sin(a)];
  const pt = (p) => n2(p[0]) + ' ' + n2(p[1]);
  const inv = (a) => Math.tan(a) - a;

  /**
   * Involute spur gear outline (closed path, centred on origin).
   * @param {number} z  tooth count
   * @param {number} m  module
   * @param {object} o  { pressure°, addendum, dedendum, backlash, flankSteps, phase }
   */
  function involuteGear(z, m, o = {}) {
    const alpha = (o.pressure || 20) * DEG;
    const r = (m * z) / 2;
    const rb = r * Math.cos(alpha);
    let ra = r + m * (o.addendum ?? 1.0);
    const rf = r - m * (o.dedendum ?? 1.25);
    const back = o.backlash ?? 0.05;
    const tp = (Math.PI / (2 * z)) * (1 - back);
    const psi = (rr) => (rr <= rb ? tp + inv(alpha) : tp + inv(alpha) - inv(Math.acos(rb / rr)));
    // Small pinions: shorten the addendum until the tip land is not knife-edged.
    while (psi(ra) < 0.18 * tp && ra > r + 0.2 * m) ra -= 0.02 * m;
    const r0 = Math.max(rb, rf);
    const N = o.flankSteps || 6;
    const pitch = TAU / z;
    const ph = o.phase || 0;
    let d = '';
    let first = null;
    for (let k = 0; k < z; k++) {
      const c = ph + k * pitch;
      const aR = c - psi(r0);
      const pRoot = polar(rf, aR);
      if (k === 0) {
        first = pRoot;
        d += 'M' + pt(pRoot);
      } else {
        d += 'A' + n2(rf) + ' ' + n2(rf) + ' 0 0 1 ' + pt(pRoot);
      }
      if (rf < r0 - 1e-6) d += 'L' + pt(polar(r0, aR));
      for (let i = 1; i <= N; i++) {
        const rr = r0 + (ra - r0) * (i / N);
        d += 'L' + pt(polar(rr, c - psi(rr)));
      }
      d += 'A' + n2(ra) + ' ' + n2(ra) + ' 0 0 1 ' + pt(polar(ra, c + psi(ra)));
      for (let i = N - 1; i >= 0; i--) {
        const rr = r0 + (ra - r0) * (i / N);
        d += 'L' + pt(polar(rr, c + psi(rr)));
      }
      if (rf < r0 - 1e-6) d += 'L' + pt(polar(rf, c + psi(r0)));
    }
    d += 'A' + n2(rf) + ' ' + n2(rf) + ' 0 0 1 ' + pt(first) + 'Z';
    stats.teeth += z;
    stats.segments += z * (2 * N + 4);
    return { d, r, ra, rf, rb, z, m };
  }

  /** Full circle as a closed sub-path. */
  function circle(r, cx = 0, cy = 0) {
    stats.segments += 2;
    return (
      'M' + n2(cx + r) + ' ' + n2(cy) +
      'A' + n2(r) + ' ' + n2(r) + ' 0 1 1 ' + n2(cx - r) + ' ' + n2(cy) +
      'A' + n2(r) + ' ' + n2(r) + ' 0 1 1 ' + n2(cx + r) + ' ' + n2(cy) + 'Z'
    );
  }

  /**
   * Skeletonised crossings: n windows between rim and hub with swept spokes.
   * Combine with the wheel outline under fill-rule="evenodd".
   */
  function crossings(n, rRim, rHub, spokeW, o = {}) {
    const twist = o.twist ?? 0.22;
    const bend = o.bend ?? 0.14;
    const rot = o.rot ?? 0;
    const half = Math.PI / n;
    const hwo = half - spokeW / 2 / rRim;
    const hwh = Math.max(0.05, half - (spokeW * 0.75) / 2 / rHub);
    const rm = (rRim + rHub) / 2;
    let d = '';
    for (let i = 0; i < n; i++) {
      const c = rot + (i + 0.5) * 2 * half;
      const a1 = c - hwo, a2 = c + hwo, a3 = c + hwh - twist, a4 = c - hwh - twist;
      const p1 = polar(rRim, a1), p2 = polar(rRim, a2), p3 = polar(rHub, a3), p4 = polar(rHub, a4);
      const q23 = polar(rm, (a2 + a3) / 2 + bend), q41 = polar(rm, (a4 + a1) / 2 + bend);
      d +=
        'M' + pt(p1) +
        'A' + n2(rRim) + ' ' + n2(rRim) + ' 0 0 1 ' + pt(p2) +
        'Q' + pt(q23) + ' ' + pt(p3) +
        'A' + n2(rHub) + ' ' + n2(rHub) + ' 0 0 0 ' + pt(p4) +
        'Q' + pt(q41) + ' ' + pt(p1) + 'Z';
    }
    stats.segments += n * 4;
    return d;
  }

  /** Archimedean spiral polyline (open path). */
  function spiral(rIn, rOut, turns, a0, perTurn = 36, cx = 0, cy = 0) {
    const n = Math.max(8, Math.round(turns * perTurn));
    let d = '';
    for (let i = 0; i <= n; i++) {
      const s = i / n;
      const a = a0 + s * turns * TAU;
      const p = polar(rIn + (rOut - rIn) * s, a, cx, cy);
      d += (i === 0 ? 'M' : 'L') + pt(p);
    }
    stats.segments += n;
    return d;
  }

  /**
   * Mainspring inside the barrel. f = state of wind (0 let down … 1 fully wound).
   * The strip has constant length L; a fraction f is coiled tightly round the
   * arbor, the rest lies against the barrel wall, joined by one free span.
   */
  function mainspring(f, geo) {
    const { ra, rw, s, L } = geo;
    const L1 = Math.max(1, f * L), L2 = Math.max(1, (1 - f) * L);
    // inner pack: 2π n1 (ra + n1 s/2) = L1  →  π s n1² + 2π ra n1 − L1 = 0
    const n1 = (-2 * Math.PI * ra + Math.sqrt(4 * Math.PI * Math.PI * ra * ra + 4 * Math.PI * s * L1)) / (2 * Math.PI * s);
    // outer pack: 2π n2 (rw − n2 s/2) = L2  →  π s n2² − 2π rw n2 + L2 = 0
    const disc = 4 * Math.PI * Math.PI * rw * rw - 4 * Math.PI * s * L2;
    const n2t = (2 * Math.PI * rw - Math.sqrt(Math.max(0, disc))) / (2 * Math.PI * s);
    const r1 = ra + n1 * s;
    const r2 = rw - n2t * s;
    const per = 30;
    const pts = [];
    let a = 0;
    const steps1 = Math.max(4, Math.round(n1 * per));
    for (let i = 0; i <= steps1; i++) {
      const t = i / steps1;
      pts.push(polar(ra + (r1 - ra) * t, a + t * n1 * TAU));
    }
    a += n1 * TAU;
    const span = 1.0;
    const stepsS = Math.round(span * per);
    for (let i = 1; i <= stepsS; i++) {
      const t = i / stepsS;
      const e = t * t * (3 - 2 * t);
      pts.push(polar(r1 + (r2 - r1) * e, a + t * span * TAU));
    }
    a += span * TAU;
    const steps2 = Math.max(4, Math.round(n2t * per));
    for (let i = 1; i <= steps2; i++) {
      const t = i / steps2;
      pts.push(polar(r2 + (rw - r2) * t, a + t * n2t * TAU));
    }
    let d = 'M' + pt(pts[0]);
    for (let i = 1; i < pts.length; i++) d += 'L' + pt(pts[i]);
    return { d, segments: pts.length - 1, coilsInner: n1, coilsOuter: n2t };
  }

  /**
   * Swiss-lever club-tooth escape wheel, teeth leaning in the (clockwise)
   * direction of rotation. Tooth tip k sits at angle k·2π/z.
   */
  function escapeWheel(z, R, o = {}) {
    const rr = o.root ?? R * 0.69;
    const pitch = TAU / z;
    let d = '';
    let first = null;
    for (let k = 0; k < z; k++) {
      const c = k * pitch;
      const backRoot = polar(rr, c - 0.34);
      const ctrl = polar(R * 0.82, c - 0.31);
      const heel = polar(R * 0.962, c - 0.088);
      const tip = polar(R, c);
      const frontRoot = polar(rr, c - 0.105);
      if (k === 0) {
        first = backRoot;
        d += 'M' + pt(backRoot);
      } else {
        d += 'A' + n2(rr) + ' ' + n2(rr) + ' 0 0 1 ' + pt(backRoot);
      }
      d += 'Q' + pt(ctrl) + ' ' + pt(heel) + 'L' + pt(tip) + 'L' + pt(frontRoot);
    }
    d += 'A' + n2(rr) + ' ' + n2(rr) + ' 0 0 1 ' + pt(first) + 'Z';
    stats.teeth += z;
    stats.segments += z * 5;
    return { d, R, rr };
  }

  /**
   * External mesh phasing law. Gear 1 (z1, rotation θ1) drives gear 2 (z2)
   * whose centre lies in direction ψ from gear 1. All angles in degrees.
   * A tooth of gear 1 pointing along ψ always faces a space of gear 2.
   */
  function meshAngle(theta1, z1, z2, psiDeg) {
    return -(z1 / z2) * (theta1 - psiDeg) + psiDeg + 180 + 180 / z2;
  }

  /** Circle–circle intersection; returns the solution on the requested side. */
  function intersect(c1, r1, c2, r2, preferPositiveX = true) {
    const dx = c2[0] - c1[0], dy = c2[1] - c1[1];
    const d = Math.hypot(dx, dy);
    const a = (r1 * r1 - r2 * r2 + d * d) / (2 * d);
    const h = Math.sqrt(Math.max(0, r1 * r1 - a * a));
    const mx = c1[0] + (a * dx) / d, my = c1[1] + (a * dy) / d;
    const s1 = [mx + (h * dy) / d, my - (h * dx) / d];
    const s2 = [mx - (h * dy) / d, my + (h * dx) / d];
    if (preferPositiveX) return s1[0] >= s2[0] ? s1 : s2;
    return s1[0] < s2[0] ? s1 : s2;
  }

  root.CO5 = root.CO5 || {};
  root.CO5.geo = { TAU, DEG, stats, n2, pt, polar, inv, involuteGear, circle, crossings, spiral, mainspring, escapeWheel, meshAngle, intersect };
})(typeof window !== 'undefined' ? window : globalThis);
