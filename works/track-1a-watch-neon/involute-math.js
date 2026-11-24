/**
 * Chronos Calibre N-4 — Precision Horology Geometry & Kinematic Solver
 * Implements exact Litvin & Fuentes (2004) involute gear profiles,
 * 15-tooth Swiss lever club-tooth escapement geometry, phase-locked
 * gear train kinematics, 60-second planetary tourbillon ratios,
 * breathing Phillips overcoil hairspring, and coiling mainspring curves.
 */

export const DEG = Math.PI / 180;
export const RAD = 180 / Math.PI;
export const TAU = Math.PI * 2;

/**
 * Exact Swiss Calibre N-4 kinematic layout.
 * All center-to-center distances satisfy d = m * (Z1 + Z2) / 2 identically.
 * Center Wheel -> Third Wheel -> Tourbillon Cage ratio: (80/10) * (75/10) = 60:1 exact.
 * Tourbillon Cage -> Escape Wheel planetary ratio: 96 / 6 = 16:1 exact.
 * 16 rev/min * 15 teeth * 2 beats/tooth = 480 beats/min = 8 Hz = 28,800 vph (4.0 Hz balance).
 */
export function buildCalibreGeometry() {
  // 1. Mainspring Barrel (Great Wheel) -> Center Pinion
  const m1 = 2.0;
  const Z_barrel = 80;
  const Z_centerPinion = 12;
  const rp_barrel = (m1 * Z_barrel) / 2;           // 80.0
  const rp_centerPinion = (m1 * Z_centerPinion) / 2; // 12.0
  const d_BC = rp_barrel + rp_centerPinion;          // 92.0
  const angB = -105 * DEG;
  const barrel = {
    x: d_BC * Math.cos(angB),
    y: d_BC * Math.sin(angB),
    teeth: Z_barrel,
    module: m1,
    rp: rp_barrel,
  };

  // 2. Center Wheel (Minute axis) at origin (0, 0)
  const m2 = 1.45;
  const Z_center = 80;
  const Z_thirdPinion = 10;
  const rp_center = (m2 * Z_center) / 2;             // 58.0
  const rp_thirdPinion = (m2 * Z_thirdPinion) / 2;   // 7.25
  const d_CT = rp_center + rp_thirdPinion;           // 65.25
  const center = {
    x: 0,
    y: 0,
    teeth: Z_center,
    module: m2,
    rp: rp_center,
    pinionTeeth: Z_centerPinion,
    pinionModule: m1,
    pinionRp: rp_centerPinion,
  };

  // 3. Tourbillon Carriage (Fourth/Seconds axis) at 6 o'clock (0, 104)
  const m3 = 1.45;
  const Z_third = 75;
  const Z_tourbillonPinion = 10;
  const rp_third = (m3 * Z_third) / 2;                       // 54.375
  const rp_tourbillonPinion = (m3 * Z_tourbillonPinion) / 2; // 7.25
  const d_TQ = rp_third + rp_tourbillonPinion;               // 61.625
  const tourbillon = {
    x: 0,
    y: 104,
    pinionTeeth: Z_tourbillonPinion,
    pinionModule: m3,
    pinionRp: rp_tourbillonPinion,
    cageRadius: 72,
    apertureRadius: 80,
  };

  // Circle-circle intersection placing Third Wheel cleanly at ~7:45 (left side)
  const d_CQ = tourbillon.y; // 104
  const yT = (d_CT * d_CT + d_CQ * d_CQ - d_TQ * d_TQ) / (2 * d_CQ);
  const xT = -Math.sqrt(Math.max(1, d_CT * d_CT - yT * yT));
  const third = {
    x: xT,
    y: yT,
    teeth: Z_third,
    module: m3,
    rp: rp_third,
    pinionTeeth: Z_thirdPinion,
    pinionModule: m2,
    pinionRp: rp_thirdPinion,
  };

  // 4. Ratchet Wheel (concentric with barrel) -> Crown Wheel -> Intermediate Winding Wheel -> 3 o'clock Stem
  const mRat = 1.65;
  const Z_ratchet = 52;
  const Z_crownWheel = 34;
  const Z_windingInter = 26;
  const rp_ratchet = (mRat * Z_ratchet) / 2;           // 42.9
  const rp_crownWheel = (mRat * Z_crownWheel) / 2;     // 28.05
  const rp_windingInter = (mRat * Z_windingInter) / 2; // 21.45
  const d_RatCw = rp_ratchet + rp_crownWheel;          // 70.95
  const angCw = 24 * DEG;
  const crownWheel = {
    x: barrel.x + d_RatCw * Math.cos(angCw),
    y: barrel.y + d_RatCw * Math.sin(angCw),
    teeth: Z_crownWheel,
    module: mRat,
    rp: rp_crownWheel,
  };

  // Intermediate winding wheel descending cleanly toward the 3 o'clock winding stem (y = 0)
  const d_CwWi = rp_crownWheel + rp_windingInter; // 49.5
  const angWi = 46 * DEG;
  const windingInter = {
    x: crownWheel.x + d_CwWi * Math.cos(angWi),
    y: crownWheel.y + d_CwWi * Math.sin(angWi),
    teeth: Z_windingInter,
    module: mRat,
    rp: rp_windingInter,
  };

  // 5. Power Reserve Differential Sector (4 o'clock balance opposite Third Wheel)
  const mPR = 1.35;
  const Z_prDrive = 28;
  const Z_prSector = 44;
  const rp_prDrive = (mPR * Z_prDrive) / 2;
  const rp_prSector = (mPR * Z_prSector) / 2;
  const prCenter = {
    x: 102,
    y: 44,
    radius: 52,
    rpDrive: rp_prDrive,
    rpSector: rp_prSector,
  };

  // 6. Tourbillon Internal Planetary Escapement (in cage-local coordinates, balance coaxial at 0,0)
  const m4 = 0.78;
  const Z_fixedFourth = 96;
  const Z_escapePinion = 6;
  const rp_fixedFourth = (m4 * Z_fixedFourth) / 2;   // 37.44
  const rp_escapePinion = (m4 * Z_escapePinion) / 2; // 2.34
  const d_QE = rp_fixedFourth + rp_escapePinion;     // 39.78
  const angEscLocal = -142 * DEG;                    // Upper-left clear window inside tourbillon cage
  const escapeLocal = {
    x: d_QE * Math.cos(angEscLocal),
    y: d_QE * Math.sin(angEscLocal),
    teeth: 15,
    radius: 21.0,
    pinionTeeth: Z_escapePinion,
    pinionModule: m4,
    pinionRp: rp_escapePinion,
    angleFromCageCenter: angEscLocal,
  };

  // Pallet fork pivot in cage-local coordinates: forms exact Swiss lever triangle with Escape & Balance (0,0)
  const palletLocal = {
    x: -25.5,
    y: 16.0,
  };

  return {
    barrel,
    ratchet: { x: barrel.x, y: barrel.y, teeth: Z_ratchet, module: mRat, rp: rp_ratchet },
    crownWheel,
    windingInter,
    prCenter,
    center,
    third,
    tourbillon,
    fixedFourth: {
      x: tourbillon.x,
      y: tourbillon.y,
      teeth: Z_fixedFourth,
      module: m4,
      rp: rp_fixedFourth,
    },
    escapeLocal,
    palletLocal,
    balanceRadius: 54,
    // Exact ratios
    ratios: {
      barrelToCenter: Z_barrel / Z_centerPinion,         // 6.6667
      centerToThird: Z_center / Z_thirdPinion,           // 8.0
      thirdToTourbillon: Z_third / Z_tourbillonPinion,   // 7.5
      centerToTourbillon: (Z_center / Z_thirdPinion) * (Z_third / Z_tourbillonPinion), // 60.0 exact
      tourbillonToEscape: Z_fixedFourth / Z_escapePinion, // 16.0 exact
      escapeTeeth: 15,
      beatRateHz: 8,   // 8 half-oscillations (beats) per second
      freqHz: 4,       // 4 full oscillations per second
      vph: 28800,      // 28,800 vibrations per hour
    },
  };
}

export const CALIBRE = buildCalibreGeometry();

/**
 * Involute function: inv(phi) = tan(phi) - phi
 */
export function involuteFn(phi) {
  return Math.tan(phi) - phi;
}

/**
 * Compute exact zero-slip phase-locked driven gear rotation (radians)
 * given driver rotation, tooth counts, and line-of-centers angle.
 */
export function computeMeshedAngle(driverAngleRad, zDriver, zDriven, lineOfCentersRad) {
  return (
    lineOfCentersRad +
    Math.PI -
    Math.PI / zDriven -
    (zDriver / zDriven) * (driverAngleRad - lineOfCentersRad)
  );
}

/**
 * Formats numbers compactly for crisp, fast-parsing SVG path strings.
 */
function fmt(n) {
  return Math.abs(n) < 1e-4 ? "0" : Number(n.toFixed(2)).toString();
}

/**
 * Generates an exact Litvin & Fuentes (2004) involute spur gear SVG path.
 * Supports optional Breguet curved spokes or radial chamfered spokes using evenodd fill-rule.
 *
 * Returns { d, outerRadius, pitchRadius, baseRadius, rootRadius, segmentCount }.
 */
export function generateInvoluteGear({
  teeth,
  module: m,
  pressureAngleDeg = 20,
  addendumFactor = 1.0,
  dedendumFactor = 1.25,
  backlash = 0.045,
  involuteSteps = 3,
  spokeCount = 0,
  spokeStyle = "breguet",
  rimRatio = 0.78,
  hubRatio = 0.24,
  boreRadius = 0,
}) {
  const alpha = pressureAngleDeg * DEG;
  const rp = (m * teeth) / 2;
  const rb = rp * Math.cos(alpha);
  const ra = rp + addendumFactor * m;
  const rf = Math.max(1.2, rp - dedendumFactor * m);

  // Half angular tooth thickness on pitch circle and base circle
  const pitchHalfTooth = (Math.PI - 2 * backlash) / (2 * teeth);
  const baseHalfTooth = pitchHalfTooth + involuteFn(alpha);

  // Parameter t on involute: r(t) = rb * sqrt(1 + t^2)
  const rStart = Math.max(rb, rf);
  const tStart = rStart > rb ? Math.sqrt((rStart / rb) * (rStart / rb) - 1) : 0;
  const tEnd = Math.sqrt(Math.max(0, (ra / rb) * (ra / rb) - 1));

  // Precompute single flank involute sample points (radius, polar offset from tooth center)
  const flankSamples = [];
  for (let s = 0; s <= involuteSteps; s++) {
    const u = s / involuteSteps;
    const t = tStart + (tEnd - tStart) * u;
    const r = rb * Math.sqrt(1 + t * t);
    const invAngle = t - Math.atan(t);
    const thetaOffset = baseHalfTooth - invAngle; // > 0 on +side, < 0 on -side
    flankSamples.push({ r, thetaOffset });
  }

  // Root fillet offset angle slightly wider than baseHalfTooth to create smooth trochoidal transition
  const rootBlendExtra = Math.min(0.18 / teeth, Math.max(0.015 / teeth, ((rb - rf) / Math.max(rb, 1)) * 0.22));
  const rootFlankAngle = baseHalfTooth + rootBlendExtra;

  const parts = [];
  let segmentCount = 0;
  const pitchAngle = TAU / teeth;

  for (let k = 0; k < teeth; k++) {
    const phi = k * pitchAngle;

    // 1. Root fillet start on trailing (-theta) side of tooth k
    const aRootNeg = phi - rootFlankAngle;
    const rx0 = rf * Math.cos(aRootNeg);
    const ry0 = rf * Math.sin(aRootNeg);

    if (k === 0) {
      parts.push(`M${fmt(rx0)} ${fmt(ry0)}`);
    } else {
      // Smooth circular root arc from previous tooth's +root to this tooth's -root
      parts.push(`A${fmt(rf)} ${fmt(rf)} 0 0 1 ${fmt(rx0)} ${fmt(ry0)}`);
      segmentCount++;
    }

    // 2. Ascending involute flank (-side of tooth) from root to tip
    for (let s = 0; s < flankSamples.length; s++) {
      const { r, thetaOffset } = flankSamples[s];
      const ang = phi - thetaOffset;
      const x = r * Math.cos(ang);
      const y = r * Math.sin(ang);
      if (s === 0 && rf < rb) {
        // Quadratic trochoidal fillet from rf to rb
        const midR = (rf + r) * 0.5;
        const midA = phi - (rootFlankAngle + thetaOffset) * 0.52;
        parts.push(`Q${fmt(midR * Math.cos(midA))} ${fmt(midR * Math.sin(midA))} ${fmt(x)} ${fmt(y)}`);
      } else {
        parts.push(`L${fmt(x)} ${fmt(y)}`);
      }
      segmentCount++;
    }

    // 3. Tip addendum arc across top land of tooth k
    const tipEndAngle = phi + flankSamples[flankSamples.length - 1].thetaOffset;
    parts.push(`A${fmt(ra)} ${fmt(ra)} 0 0 1 ${fmt(ra * Math.cos(tipEndAngle))} ${fmt(ra * Math.sin(tipEndAngle))}`);
    segmentCount++;

    // 4. Descending involute flank (+side of tooth) from tip back to base/root
    for (let s = flankSamples.length - 2; s >= 0; s--) {
      const { r, thetaOffset } = flankSamples[s];
      const ang = phi + thetaOffset;
      parts.push(`L${fmt(r * Math.cos(ang))} ${fmt(r * Math.sin(ang))}`);
      segmentCount++;
    }

    // 5. Trailing root fillet down to root circle
    const aRootPos = phi + rootFlankAngle;
    const rx1 = rf * Math.cos(aRootPos);
    const ry1 = rf * Math.sin(aRootPos);
    if (rf < rb) {
      const midR = (rf + flankSamples[0].r) * 0.5;
      const midA = phi + (rootFlankAngle + flankSamples[0].thetaOffset) * 0.52;
      parts.push(`Q${fmt(midR * Math.cos(midA))} ${fmt(midR * Math.sin(midA))} ${fmt(rx1)} ${fmt(ry1)}`);
    } else {
      parts.push(`L${fmt(rx1)} ${fmt(ry1)}`);
    }
    segmentCount++;
  }

  // Close final root arc back to tooth 0
  const aFirst = -rootFlankAngle;
  parts.push(`A${fmt(rf)} ${fmt(rf)} 0 0 1 ${fmt(rf * Math.cos(aFirst))} ${fmt(rf * Math.sin(aFirst))}Z`);
  segmentCount++;

  // Optional open-worked skeleton cutouts (spokes)
  if (spokeCount > 0) {
    const rOuter = rf * rimRatio;
    const rInner = Math.max(boreRadius + 2.5, rf * hubRatio);
    if (rOuter > rInner + 4) {
      const sector = TAU / spokeCount;
      // Angular margin for each spoke arm (wider near hub, slender toward rim)
      const spokeHalfInner = Math.min(sector * 0.24, 3.2 / rInner + 0.08);
      const spokeHalfOuter = Math.min(sector * 0.14, 2.3 / rOuter + 0.045);
      const curveTwist = spokeStyle === "breguet" ? 0.24 : 0;

      for (let i = 0; i < spokeCount; i++) {
        const a0 = i * sector;
        const a1 = (i + 1) * sector;

        const inStart = a0 + spokeHalfInner;
        const inEnd = a1 - spokeHalfInner;
        const outStart = a0 + spokeHalfOuter + curveTwist;
        const outEnd = a1 - spokeHalfOuter + curveTwist;

        if (inEnd <= inStart + 0.05 || outEnd <= outStart + 0.05) continue;

        const p1x = rInner * Math.cos(inStart);
        const p1y = rInner * Math.sin(inStart);
        const p2x = rOuter * Math.cos(outStart);
        const p2y = rOuter * Math.sin(outStart);
        const p3x = rOuter * Math.cos(outEnd);
        const p3y = rOuter * Math.sin(outEnd);
        const p4x = rInner * Math.cos(inEnd);
        const p4y = rInner * Math.sin(inEnd);

        const midR = (rInner + rOuter) * 0.52;
        const c1A = (inStart + outStart) * 0.5 - curveTwist * 0.35;
        const c2A = (inEnd + outEnd) * 0.5 - curveTwist * 0.35;

        const largeArcOuter = outEnd - outStart > Math.PI ? 1 : 0;
        const largeArcInner = inEnd - inStart > Math.PI ? 1 : 0;

        parts.push(
          `M${fmt(p1x)} ${fmt(p1y)}` +
          `Q${fmt(midR * Math.cos(c1A))} ${fmt(midR * Math.sin(c1A))} ${fmt(p2x)} ${fmt(p2y)}` +
          `A${fmt(rOuter)} ${fmt(rOuter)} 0 ${largeArcOuter} 1 ${fmt(p3x)} ${fmt(p3y)}` +
          `Q${fmt(midR * Math.cos(c2A))} ${fmt(midR * Math.sin(c2A))} ${fmt(p4x)} ${fmt(p4y)}` +
          `A${fmt(rInner)} ${fmt(rInner)} 0 ${largeArcInner} 0 ${fmt(p1x)} ${fmt(p1y)}Z`
        );
        segmentCount += 4;
      }
    }
  }

  // Optional central arbor bore hole
  if (boreRadius > 0.5) {
    const r = boreRadius;
    parts.push(`M${fmt(r)} 0A${fmt(r)} ${fmt(r)} 0 1 0 ${fmt(-r)} 0A${fmt(r)} ${fmt(r)} 0 1 0 ${fmt(r)} 0Z`);
    segmentCount += 2;
  }

  return {
    d: parts.join(""),
    teeth,
    module: m,
    pitchRadius: rp,
    baseRadius: rb,
    outerRadius: ra,
    rootRadius: rf,
    segmentCount,
  };
}

/**
 * Generates an authentic 15-tooth Swiss Lever Club-Tooth Escape Wheel.
 * Features raked forward-slanted locking faces, angled club impulse tips,
 * deep curved undercut gullets, and delicate 3-spoke skeletonized crossing.
 */
export function generateSwissEscapeWheel(teeth = 15, outerR = 21.5) {
  const innerRimR = outerR * 0.62;
  const gulletR = outerR * 0.66;
  const hubR = outerR * 0.24;
  const step = TAU / teeth;
  const parts = [];
  let segmentCount = 0;

  for (let k = 0; k < teeth; k++) {
    const a = k * step;
    // Asymmetric Swiss lever club-tooth vertices (clockwise rotation)
    const aGulletLead = a - step * 0.08;
    const aLockFoot = a + step * 0.06;
    const aLockTip = a + step * 0.44;    // forward raked tip (locking edge)
    const aClubHeel = a + step * 0.58;   // angled club impulse plane heel
    const aBackCurve = a + step * 0.26;  // concave hollowed tooth back

    const p0x = gulletR * Math.cos(aGulletLead);
    const p0y = gulletR * Math.sin(aGulletLead);
    const p1x = (gulletR + 1.4) * Math.cos(aLockFoot);
    const p1y = (gulletR + 1.4) * Math.sin(aLockFoot);
    const p2x = outerR * Math.cos(aLockTip);
    const p2y = outerR * Math.sin(aLockTip);
    const p3x = (outerR * 0.94) * Math.cos(aClubHeel);
    const p3y = (outerR * 0.94) * Math.sin(aClubHeel);
    const p4x = (gulletR * 1.08) * Math.cos(aBackCurve);
    const p4y = (gulletR * 1.08) * Math.sin(aBackCurve);
    const pNext = a + step - step * 0.08;
    const p5x = gulletR * Math.cos(pNext);
    const p5y = gulletR * Math.sin(pNext);

    if (k === 0) parts.push(`M${fmt(p0x)} ${fmt(p0y)}`);
    // Leading flank (draw-angled locking face)
    parts.push(`L${fmt(p1x)} ${fmt(p1y)}`);
    parts.push(`L${fmt(p2x)} ${fmt(p2y)}`);
    // Club impulse plane
    parts.push(`L${fmt(p3x)} ${fmt(p3y)}`);
    // Undercut rear hollow into root gullet
    parts.push(`Q${fmt(p4x)} ${fmt(p4y)} ${fmt(p5x)} ${fmt(p5y)}`);
    segmentCount += 4;
  }
  parts.push("Z");

  // 3 delicate skeleton cutouts between hub and inner rim
  const spokes = 3;
  const sector = TAU / spokes;
  for (let i = 0; i < spokes; i++) {
    const a0 = i * sector + 0.16;
    const a1 = (i + 1) * sector - 0.16;
    const p1x = hubR * Math.cos(a0);
    const p1y = hubR * Math.sin(a0);
    const p2x = innerRimR * Math.cos(a0 + 0.08);
    const p2y = innerRimR * Math.sin(a0 + 0.08);
    const p3x = innerRimR * Math.cos(a1 - 0.08);
    const p3y = innerRimR * Math.sin(a1 - 0.08);
    const p4x = hubR * Math.cos(a1);
    const p4y = hubR * Math.sin(a1);
    parts.push(
      `M${fmt(p1x)} ${fmt(p1y)}` +
      `L${fmt(p2x)} ${fmt(p2y)}` +
      `A${fmt(innerRimR)} ${fmt(innerRimR)} 0 0 1 ${fmt(p3x)} ${fmt(p3y)}` +
      `L${fmt(p4x)} ${fmt(p4y)}` +
      `A${fmt(hubR)} ${fmt(hubR)} 0 0 0 ${fmt(p1x)} ${fmt(p1y)}Z`
    );
    segmentCount += 4;
  }

  return { d: parts.join(""), segmentCount, teeth, outerRadius: outerR };
}

/**
 * Generates exact Swiss Lever Anchor Pallet Fork & Ruby Pallet Stones
 * centered in pallet-local coordinates (pivot at 0,0), oriented so the
 * anchor arms embrace the Escape Wheel and the lever fork points directly
 * toward the Balance Wheel roller jewel.
 */
export function generatePalletForkGeometry(palletPos, escapePos, balancePos = { x: 0, y: 0 }) {
  const angToEsc = Math.atan2(escapePos.y - palletPos.y, escapePos.x - palletPos.x);
  const angToBal = Math.atan2(balancePos.y - palletPos.y, balancePos.x - palletPos.x);
  const distToEsc = Math.hypot(escapePos.x - palletPos.x, escapePos.y - palletPos.y);
  const distToBal = Math.hypot(balancePos.x - palletPos.x, balancePos.y - palletPos.y);

  // Entry & exit pallet arms reach symmetrically around the escape wheel rim
  const armSpan = 0.58; // radians (~33 deg each side)
  const armLen = Math.max(14, distToEsc - 14.5);

  const entryA = angToEsc - armSpan;
  const exitA = angToEsc + armSpan;

  const entryTip = { x: armLen * Math.cos(entryA), y: armLen * Math.sin(entryA) };
  const exitTip = { x: armLen * Math.cos(exitA), y: armLen * Math.sin(exitA) };

  // Lever shaft extending toward balance roller jewel
  const shaftLen = Math.max(15, distToBal - 7.5);
  const hornA = angToBal;
  const perp = hornA + Math.PI / 2;

  const pShaft = (d, w) => ({
    x: d * Math.cos(hornA) + w * Math.cos(perp),
    y: d * Math.sin(hornA) + w * Math.sin(perp),
  });

  // Construct sleek steel pallet anchor body + forked horns
  const ePerp = entryA + Math.PI / 2;
  const xPerp = exitA + Math.PI / 2;

  const s1 = pShaft(4.5, 1.8);
  const s2 = pShaft(shaftLen - 3.5, 1.3);
  const h1Out = pShaft(shaftLen + 1.8, 4.4);
  const h1Tip = pShaft(shaftLen + 3.2, 2.5);
  const hNotch = pShaft(shaftLen - 1.4, 0);
  const h2Tip = pShaft(shaftLen + 3.2, -2.5);
  const h2Out = pShaft(shaftLen + 1.8, -4.4);
  const s3 = pShaft(shaftLen - 3.5, -1.3);
  const s4 = pShaft(4.5, -1.8);

  const eOut = { x: entryTip.x + 1.8 * Math.cos(ePerp), y: entryTip.y + 1.8 * Math.sin(ePerp) };
  const eIn = { x: entryTip.x - 1.8 * Math.cos(ePerp), y: entryTip.y - 1.8 * Math.sin(ePerp) };
  const xIn = { x: exitTip.x + 1.8 * Math.cos(xPerp), y: exitTip.y + 1.8 * Math.sin(xPerp) };
  const xOut = { x: exitTip.x - 1.8 * Math.cos(xPerp), y: exitTip.y - 1.8 * Math.sin(xPerp) };
  const crownMid = { x: 5.2 * Math.cos(angToEsc), y: 5.2 * Math.sin(angToEsc) };

  const bodyPath =
    `M${fmt(s1.x)} ${fmt(s1.y)}` +
    `L${fmt(s2.x)} ${fmt(s2.y)}` +
    `L${fmt(h1Out.x)} ${fmt(h1Out.y)}` +
    `L${fmt(h1Tip.x)} ${fmt(h1Tip.y)}` +
    `L${fmt(hNotch.x)} ${fmt(hNotch.y)}` +
    `L${fmt(h2Tip.x)} ${fmt(h2Tip.y)}` +
    `L${fmt(h2Out.x)} ${fmt(h2Out.y)}` +
    `L${fmt(s3.x)} ${fmt(s3.y)}` +
    `L${fmt(s4.x)} ${fmt(s4.y)}` +
    `Q${fmt(xOut.x * 0.45)} ${fmt(xOut.y * 0.45)} ${fmt(xOut.x)} ${fmt(xOut.y)}` +
    `L${fmt(xIn.x)} ${fmt(xIn.y)}` +
    `Q${fmt(crownMid.x)} ${fmt(crownMid.y)} ${fmt(eIn.x)} ${fmt(eIn.y)}` +
    `L${fmt(eOut.x)} ${fmt(eOut.y)}` +
    `Q${fmt(eOut.x * 0.45)} ${fmt(eOut.y * 0.45)} ${fmt(s1.x)} ${fmt(s1.y)}Z`;

  // Synthetic pigeon-blood ruby pallet jewels projecting inward toward escape wheel teeth
  const makeStone = (tip, dirAngle, sign) => {
    const stoneAngle = dirAngle + sign * 0.52;
    const sp = stoneAngle + Math.PI / 2;
    const len = 6.2;
    const hw = 1.45;
    const b1 = { x: tip.x - 1.0 * Math.cos(stoneAngle) + hw * Math.cos(sp), y: tip.y - 1.0 * Math.sin(stoneAngle) + hw * Math.sin(sp) };
    const b2 = { x: tip.x - 1.0 * Math.cos(stoneAngle) - hw * Math.cos(sp), y: tip.y - 1.0 * Math.sin(stoneAngle) - hw * Math.sin(sp) };
    const t2 = { x: tip.x + (len - 0.8) * Math.cos(stoneAngle) - hw * Math.cos(sp), y: tip.y + (len - 0.8) * Math.sin(stoneAngle) - hw * Math.sin(sp) };
    const t1 = { x: tip.x + len * Math.cos(stoneAngle) + hw * Math.cos(sp), y: tip.y + len * Math.sin(stoneAngle) + hw * Math.sin(sp) };
    return `M${fmt(b1.x)} ${fmt(b1.y)}L${fmt(t1.x)} ${fmt(t1.y)}L${fmt(t2.x)} ${fmt(t2.y)}L${fmt(b2.x)} ${fmt(b2.y)}Z`;
  };

  return {
    bodyPath,
    entryStonePath: makeStone(entryTip, entryA, +1),
    exitStonePath: makeStone(exitTip, exitA, -1),
    bankingPinA: pShaft(shaftLen * 0.56, 5.8),
    bankingPinB: pShaft(shaftLen * 0.56, -5.8),
    segmentCount: 22,
  };
}

/**
 * Generates dynamic breathing spiral hairspring SVG path (Phillips overcoil terminal).
 * balanceAngleRad oscillates in [-5.1, +5.1] rad (~±295°).
 * Inner collet rotates with the balance staff; outer terminal stays pinned at the stud.
 */
export function generateHairspringPath(balanceAngleRad, {
  turns = 6.5,
  rInner = 6.4,
  rOuter = 24.0,
  samples = 56,
  studAngle = -0.58,
} = {}) {
  const totalTheta = turns * TAU;
  const parts = new Array(samples + 1);

  for (let i = 0; i <= samples; i++) {
    const u = i / samples; // 0 at inner collet -> 1 at outer stud
    // Smooth angular twist: collet rotates fully with balance, outer stud stays fixed
    const twistDecay = Math.pow(1 - u, 1.35);
    const localAngle = studAngle - totalTheta * (1 - u) + balanceAngleRad * twistDecay;

    // Breathing radial displacement: strongest in mid-coils (sin(pi * u))
    const radialBreath = Math.sin(Math.PI * u) * (balanceAngleRad * 0.28);
    // Subtle Phillips terminal overcoil lift near u > 0.90
    const terminalLift = u > 0.90 ? ((u - 0.90) / 0.10) * 1.9 : 0;
    const r = rInner + (rOuter - rInner) * u + radialBreath + terminalLift;

    const x = r * Math.cos(localAngle);
    const y = r * Math.sin(localAngle);
    parts[i] = i === 0 ? `M${fmt(x)} ${fmt(y)}` : `L${fmt(x)} ${fmt(y)}`;
  }

  return parts.join("");
}

/**
 * Generates dynamic coiled blued-steel mainspring inside the open-worked barrel.
 * powerFraction in [0, 1]:
 *   - 0.0 (unwound): coils relax outward tightly against the barrel drum wall.
 *   - 1.0 (72h wound): coils pull inward tightly around the central mainspring arbor.
 */
export function generateMainspringPath(powerFraction, arborAngleRad = 0, {
  rArbor = 17.5,
  rWall = 60.5,
  samples = 88,
} = {}) {
  const f = Math.max(0, Math.min(1, powerFraction));
  // Effective active turns increase from ~5.2 (unwound) to ~9.4 (fully wound)
  const turns = 5.2 + f * 4.2;
  const totalTheta = turns * TAU;
  // Bias exponent pulls intermediate coils toward the arbor as f increases
  const bias = 0.58 + f * 1.15;
  const parts = new Array(samples + 1);

  for (let i = 0; i <= samples; i++) {
    const u = i / samples; // 0 at arbor -> 1 at barrel outer wall hook
    const shaped = Math.pow(u, bias);
    const r = rArbor + (rWall - rArbor) * shaped;
    const theta = arborAngleRad + u * totalTheta;
    const x = r * Math.cos(theta);
    const y = r * Math.sin(theta);
    parts[i] = i === 0 ? `M${fmt(x)} ${fmt(y)}` : `L${fmt(x)} ${fmt(y)}`;
  }

  return parts.join("");
}

/**
 * Generates the discrete-yet-fluid Swiss lever escapement kinematics for a given continuous
 * time in seconds (at 4.0 Hz = 8 beats/sec = 28,800 vph) and current amplitude factor [0..1].
 *
 * Returns:
 * - balanceAngleRad: harmonic oscillation +-295 deg scaled by amplitude
 * - palletAngleDeg: crisp rapid snap between +-6.2 deg banking stops during impulse phase
 * - escapeStepAngleRad: 15-tooth stepped advance (12 deg lock/impulse per beat = 24 deg per cycle)
 * - tourbillonAngleRad: 60s revolution coupled directly to escapement advance
 * - beatIndex: integer beat counter (increments 8 times per second -> drives audio tick-tock)
 * - isTick: boolean (even beat = entry pallet "tick", odd beat = exit pallet "tock")
 */
export function evaluateEscapementKinematics(simSeconds, amplitudeFactor = 1.0) {
  const freq = CALIBRE.ratios.freqHz;       // 4.0 Hz
  const beatRate = CALIBRE.ratios.beatRateHz; // 8.0 beats/sec
  const phaseCycles = simSeconds * freq;
  const beatFloat = simSeconds * beatRate;
  const beatIndex = Math.floor(beatFloat);
  const beatFrac = beatFloat - beatIndex;   // [0, 1) within current 125ms beat
  const isTick = (beatIndex & 1) === 0;

  // 1. Balance wheel sinusoidal oscillation (peaks at beatFrac = 0.5, passes zero/impulse at beatFrac = 0)
  const maxAmpRad = (295 * DEG) * amplitudeFactor;
  const balanceAngleRad = -Math.cos(phaseCycles * TAU) * maxAmpRad;

  // 2. Smooth-step impulse window (first 18% of each beat is unlock + impulse; remaining 82% is lock + rest)
  const impulseDur = 0.18;
  let impulseT;
  if (beatFrac < impulseDur) {
    const x = beatFrac / impulseDur;
    // Quintic smoothstep for crisp physical steel-on-ruby snap
    impulseT = x * x * x * (x * (x * 6 - 15) + 10);
  } else {
    impulseT = 1.0;
  }

  // 3. Pallet fork angle snaps between -6.2° and +6.2° during impulse
  const stopDeg = 6.2 * Math.min(1, amplitudeFactor * 1.4);
  const fromDeg = isTick ? -stopDeg : stopDeg;
  const toDeg = isTick ? stopDeg : -stopDeg;
  const palletAngleDeg = fromDeg + (toDeg - fromDeg) * impulseT;

  // 4. Stepped beat progress (for crisp mechanical 8 Hz Swiss lever stepping of escape wheel & cage)
  const steppedBeats = beatIndex + impulseT;
  const steppedSeconds = steppedBeats / beatRate;

  // Tourbillon Cage rotates 1 rev / 60s (driven in crisp 8 Hz escapement micro-steps)
  const tourbillonAngleRad = (steppedSeconds / 60) * TAU;

  // Escape wheel relative to cage: exact planetary mesh (+16x cage rotation, locked to Fixed 4th Wheel)
  const angE = CALIBRE.escapeLocal.angleFromCageCenter;
  const escapeLocalAngleRad =
    (angE + Math.PI) -
    Math.PI / CALIBRE.escapeLocal.pinionTeeth +
    CALIBRE.ratios.tourbillonToEscape * (tourbillonAngleRad + angE);

  // Train wheels upstream (exact zero-slip mesh back from Tourbillon Cage -> Third -> Center -> Barrel)
  const lineQT = Math.atan2(CALIBRE.third.y - CALIBRE.tourbillon.y, CALIBRE.third.x - CALIBRE.tourbillon.x);
  const thirdAngleRad = computeMeshedAngle(
    tourbillonAngleRad,
    CALIBRE.tourbillon.pinionTeeth,
    CALIBRE.third.teeth,
    lineQT
  );

  const lineTC = Math.atan2(CALIBRE.center.y - CALIBRE.third.y, CALIBRE.center.x - CALIBRE.third.x);
  const centerAngleRad = computeMeshedAngle(
    thirdAngleRad,
    CALIBRE.third.pinionTeeth,
    CALIBRE.center.teeth,
    lineTC
  );

  const lineCB = Math.atan2(CALIBRE.barrel.y - CALIBRE.center.y, CALIBRE.barrel.x - CALIBRE.center.x);
  const barrelAngleRad = computeMeshedAngle(
    centerAngleRad,
    CALIBRE.center.pinionTeeth,
    CALIBRE.barrel.teeth,
    lineCB
  );

  return {
    beatIndex,
    beatFrac,
    isTick,
    impulseT,
    balanceAngleRad,
    palletAngleDeg,
    tourbillonAngleRad,
    escapeLocalAngleRad,
    thirdAngleRad,
    centerAngleRad,
    barrelAngleRad,
    steppedSeconds,
  };
}
