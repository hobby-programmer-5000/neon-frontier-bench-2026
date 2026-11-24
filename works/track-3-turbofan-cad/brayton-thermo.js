/**
 * AeroFan X-900 — Real-Gas Parametric & Off-Design Brayton Cycle Solver
 * Reference: J. D. Mattingly (2006), "Elements of Propulsion: Gas Turbines and Rockets"
 *
 * Computes station-by-station total temperatures & pressures (Stn 0, 2, 2.5, 3, 4, 4.5, 5),
 * dual-spool speeds (N1 LP, N2 HP), Bypass Ratio (BPR), Engine Pressure Ratio (EPR),
 * Net Thrust (kN), and Thrust Specific Fuel Consumption (TSFC, g/(kN*s)) across:
 *   - Throttle: 22% (Idle) -> 78% (Cruise) -> 100% (TOGA)
 *   - Altitude: 0 -> 42,000 ft (ISA Troposphere + Lower Stratosphere)
 *   - Mach:     0.00 -> 0.88
 */

const FT_TO_M = 0.3048;
const R_AIR = 287.053;         // J/(kg*K)
const GAMMA_C = 1.40;          // Cold section specific heat ratio
const CP_C = 1004.5;           // Cold section Cp, J/(kg*K)
const GAMMA_T = 1.33;          // Hot gas specific heat ratio
const CP_T = 1156.0;           // Hot gas Cp, J/(kg*K)
const H_PR = 43.15e6;          // Jet-A1 lower heating value, J/kg

// AeroFan X-900 design reference constants (380-415 kN high-bypass class)
export const ENGINE_CONSTANTS = Object.freeze({
  fanBlades: 22,
  n1DesignRpm: 2680,           // 100% LP spool speed (RPM)
  n2DesignRpm: 11450,          // 100% HP spool speed (RPM, counter-rotating)
  designMassFlowKgS: 1345.0,   // Corrected fan-face mass flow at 100% N1corr (kg/s)
  designBpr: 9.5,
  coreNozzleAreaM2: 0.56,
  bypassNozzleAreaM2: 4.48
});

function clamp(v, lo, hi) {
  return v < lo ? lo : v > hi ? hi : v;
}

function lerp(a, b, t) {
  return a + (b - a) * t;
}

/**
 * International Standard Atmosphere (ISA, 0 - 45,000 ft)
 */
export function computeISA(altitudeFt) {
  const altM = clamp(altitudeFt, 0, 45000) * FT_TO_M;
  let T0;
  let P0; // kPa

  if (altM <= 11000.0) {
    T0 = 288.15 - 0.0065 * altM;
    P0 = 101.325 * Math.pow(T0 / 288.15, 5.255876);
  } else {
    T0 = 216.65;
    const P11 = 101.325 * Math.pow(216.65 / 288.15, 5.255876); // 22.6321 kPa
    P0 = P11 * Math.exp((-9.80665 * (altM - 11000.0)) / (R_AIR * 216.65));
  }

  const a0 = Math.sqrt(GAMMA_C * R_AIR * T0);
  const rho0 = (P0 * 1000.0) / (R_AIR * T0);
  return { altM, T0, P0, a0, rho0 };
}

/**
 * Evaluate convergent nozzle expansion (choked or unchoked)
 */
function solveConvergentNozzle(PtKpa, Tt, P0Kpa, gamma, R, areaM2, piNozzle) {
  const PtExit = PtKpa * piNozzle;
  const critRatio = Math.pow((gamma + 1.0) * 0.5, gamma / (gamma - 1.0));
  const npr = Math.max(1.0005, PtExit / P0Kpa);

  let machExit;
  let PExitKpa;
  let TExit;

  if (npr >= critRatio) {
    // Choked nozzle throat (M = 1.0)
    machExit = 1.0;
    PExitKpa = PtExit / critRatio;
    TExit = Tt / ((gamma + 1.0) * 0.5);
  } else {
    // Unchoked subsonic expansion to ambient P0
    PExitKpa = P0Kpa;
    machExit = Math.sqrt(
      (2.0 / (gamma - 1.0)) * (Math.pow(npr, (gamma - 1.0) / gamma) - 1.0)
    );
    TExit = Tt / (1.0 + 0.5 * (gamma - 1.0) * machExit * machExit);
  }

  const VExit = machExit * Math.sqrt(gamma * R * TExit);
  const pressureThrustN = Math.max(0.0, (PExitKpa - P0Kpa) * 1000.0) * areaM2;

  return { machExit, PExitKpa, TExit, VExit, pressureThrustN, choked: npr >= critRatio };
}

/**
 * Stateful Brayton Cycle Engine with realistic dual-spool transient inertia
 */
export class BraytonEngine {
  constructor() {
    this.targetThrottle = 78.0; // Cruise default (22 - 100%)
    this.liveThrottle = 78.0;
    this.altitudeFt = 12000.0;
    this.mach = 0.48;
    this.explode = 0.0;         // 0.0 - 1.0 axial CAD exploded view
    this.state = this.computeCycle(this.liveThrottle, this.altitudeFt, this.mach);
  }

  setControls({ throttle, altitudeFt, mach, explode }, immediate = false) {
    if (typeof throttle === 'number') {
      this.targetThrottle = clamp(throttle, 22.0, 100.0);
      if (immediate) this.liveThrottle = this.targetThrottle;
    }
    if (typeof altitudeFt === 'number') {
      this.altitudeFt = clamp(altitudeFt, 0.0, 42000.0);
    }
    if (typeof mach === 'number') {
      this.mach = clamp(mach, 0.0, 0.88);
    }
    if (typeof explode === 'number') {
      this.explode = clamp(explode, 0.0, 1.0);
    }
    this.state = this.computeCycle(this.liveThrottle, this.altitudeFt, this.mach);
    return this.state;
  }

  step(dtSeconds) {
    const dt = clamp(dtSeconds, 0.0, 0.1);
    // Realistic FADEC spool response (~0.45s time constant for crisp tactile studio feedback)
    const alpha = 1.0 - Math.exp(-dt * 4.2);
    this.liveThrottle += (this.targetThrottle - this.liveThrottle) * alpha;
    if (Math.abs(this.targetThrottle - this.liveThrottle) < 0.015) {
      this.liveThrottle = this.targetThrottle;
    }
    this.state = this.computeCycle(this.liveThrottle, this.altitudeFt, this.mach);
    return this.state;
  }

  computeCycle(throttlePct, altitudeFt, mach) {
    const u = clamp((throttlePct - 22.0) / 78.0, 0.0, 1.0);
    const isa = computeISA(altitudeFt);
    const { T0, P0, a0 } = isa;
    const M0 = clamp(mach, 0.0, 0.88);
    const V0 = M0 * a0;

    // Station 2: Subsonic Acoustic-Lined Nacelle Intake (MIL-E-5008B recovery)
    const tauR = 1.0 + 0.5 * (GAMMA_C - 1.0) * M0 * M0;
    const piD = 0.994 - 0.006 * M0 * M0;
    const Tt2 = T0 * tauR;
    const Pt2 = P0 * piD * Math.pow(tauR, GAMMA_C / (GAMMA_C - 1.0));

    const theta2 = Tt2 / 288.15;
    const delta2 = Pt2 / 101.325;
    const sqrtTheta2 = Math.sqrt(theta2);

    // Non-linear dual-spool schedule:
    // Idle (22%): N1 ~ 25.0%, N2 ~ 62.4%
    // Cruise (78%, u=0.7179): N1 ~ 86.4%, N2 ~ 92.8%
    // TOGA (100%, u=1.0): N1 ~ 101.2%, N2 ~ 100.8%
    const n1CorrPct = lerp(25.0, 101.2, Math.pow(u, 0.86));
    const n2CorrPct = lerp(62.4, 100.8, Math.pow(u, 0.64));

    // Physical spool speeds scale slightly with inlet total temperature (FADEC flat-rated cap)
    const tempTrim = clamp(Math.pow(theta2, 0.22), 0.88, 1.04);
    const n1Pct = clamp(n1CorrPct * tempTrim, 22.0, 103.5);
    const n2Pct = clamp(n2CorrPct * clamp(Math.pow(theta2, 0.15), 0.91, 1.03), 58.0, 102.5);

    const n1Rpm = (n1Pct / 100.0) * ENGINE_CONSTANTS.n1DesignRpm;
    const n2Rpm = (n2Pct / 100.0) * ENGINE_CONSTANTS.n2DesignRpm;

    // Fan (1-stage wide-chord) & 3-stage LP Compressor pressure ratios
    const eFan = 0.918 - 0.018 * Math.pow(1.0 - u, 2.0);
    const piFan = 1.075 + 0.615 * Math.pow(u, 1.32); // 1.075 (Idle) -> 1.69 (TOGA)
    const tauFan = Math.pow(piFan, (GAMMA_C - 1.0) / (GAMMA_C * eFan));
    const Tt13 = Tt2 * tauFan;
    const Pt13 = Pt2 * piFan;

    const eLpc = 0.906;
    const piLpc = 1.20 + 1.36 * Math.pow(u, 1.28);   // 1.20 (Idle) -> 2.56 (TOGA)
    const tauLpc = Math.pow(piLpc, (GAMMA_C - 1.0) / (GAMMA_C * eLpc));
    const Tt25 = Tt2 * tauLpc;
    const Pt25 = Pt2 * piLpc;

    // Station 3: 6-Stage High-Pressure Compressor Exit
    const eHpc = 0.910;
    const piHpc = 2.85 + 14.75 * Math.pow(u, 1.38);  // 2.85 (Idle) -> 17.60 (TOGA), OPR ~ 45.1
    const tauHpc = Math.pow(piHpc, (GAMMA_C - 1.0) / (GAMMA_C * eHpc));
    const Tt3 = Tt25 * tauHpc;
    const Pt3 = Pt25 * piHpc;
    const opr = piLpc * piHpc;

    // Off-design Bypass Ratio (higher at part-power, tighter at TOGA high core mass flow)
    const bpr = ENGINE_CONSTANTS.designBpr * lerp(1.16, 0.955, Math.pow(u, 0.85));

    // Station 4: Annular Combustor Exit / Turbine Inlet Temperature (TIT)
    // Scheduled relative to compressor exit with realistic CMC/cooled single-crystal limits
    const deltaCombustorK = lerp(345.0, 915.0, Math.pow(u, 0.92));
    const Tt4 = clamp(Tt3 + deltaCombustorK, Tt3 + 220.0, 1920.0);
    const piBurner = 0.962;
    const etaBurner = 0.996;
    const Pt4 = Pt3 * piBurner;

    // Fuel-air ratio f (Mattingly Eq. 5.21)
    const fuelAirRatio = Math.max(
      0.006,
      (CP_T * Tt4 - CP_C * Tt3) / (etaBurner * H_PR - CP_T * Tt4)
    );

    // Station 4.5: 2-Stage High-Pressure Turbine Exit (HP spool shaft power balance)
    const etaMechH = 0.992;
    const eHpt = 0.905;
    const hpcSpecificWork = CP_C * (Tt3 - Tt25);
    const deltaTtHpt = hpcSpecificWork / (etaMechH * (1.0 + fuelAirRatio) * CP_T);
    const Tt45 = Math.max(Tt2 + 180.0, Tt4 - deltaTtHpt);
    const tauHpt = Tt45 / Tt4;
    const piHpt = Math.pow(tauHpt, GAMMA_T / ((GAMMA_T - 1.0) * eHpt));
    const Pt45 = Pt4 * piHpt;

    // Station 5: 4-Stage Low-Pressure Turbine Exit / EGT (LP spool shaft power balance)
    const etaMechL = 0.994;
    const eLpt = 0.912;
    const lpSpecificWork = CP_C * ((Tt25 - Tt2) + bpr * (Tt13 - Tt2));
    const deltaTtLpt = lpSpecificWork / (etaMechL * (1.0 + fuelAirRatio) * CP_T);
    // Ensure positive core nozzle pressure head even at extreme altitude idle
    const minTt5 = Tt45 * Math.pow((P0 * 1.08) / Math.max(Pt45, P0 * 1.15), ((GAMMA_T - 1.0) * eLpt) / GAMMA_T);
    const Tt5 = Math.max(minTt5, Tt45 - deltaTtLpt);
    const tauLpt = clamp(Tt5 / Tt45, 0.45, 0.96);
    const piLpt = Math.pow(tauLpt, GAMMA_T / ((GAMMA_T - 1.0) * eLpt));
    const Pt5 = Math.max(P0 * 1.05, Pt45 * piLpt);

    // Mass Flow Rate (kg/s) via corrected fan flow curve
    const corrFlowFrac = 0.16 + 0.84 * Math.pow(n1CorrPct / 100.0, 1.35);
    const mDotTotal = ENGINE_CONSTANTS.designMassFlowKgS * corrFlowFrac * (delta2 / sqrtTheta2);
    const mDotCore = mDotTotal / (1.0 + bpr);
    const mDotBypass = mDotTotal - mDotCore;
    const mDotFuel = mDotCore * fuelAirRatio;

    // Core & Bypass Convergent Nozzle Expansion
    const RHot = ((GAMMA_T - 1.0) / GAMMA_T) * CP_T;
    const coreNozzle = solveConvergentNozzle(
      Pt5,
      Tt5,
      P0,
      GAMMA_T,
      RHot,
      ENGINE_CONSTANTS.coreNozzleAreaM2,
      0.988
    );
    const bypassNozzle = solveConvergentNozzle(
      Pt13,
      Tt13,
      P0,
      GAMMA_C,
      R_AIR,
      ENGINE_CONSTANTS.bypassNozzleAreaM2,
      0.991
    );

    const coreMomentumN = mDotCore * ((1.0 + fuelAirRatio) * coreNozzle.VExit - V0);
    const bypassMomentumN = mDotBypass * (bypassNozzle.VExit - V0);
    const netThrustN = Math.max(
      850.0,
      coreMomentumN + coreNozzle.pressureThrustN + bypassMomentumN + bypassNozzle.pressureThrustN
    );
    const netThrustKN = netThrustN / 1000.0;

    // Integrated Engine Pressure Ratio (area/stream weighted mixed EPR, classic Rolls-Royce / IAE metric)
    const eprCore = Pt5 / Pt2;
    const eprMixed = (0.35 * Pt5 + 0.65 * Pt13) / Pt2;
    const epr = Math.max(1.03, eprMixed);

    // Thrust Specific Fuel Consumption in g/(kN*s) == mg/(N*s)
    const tsfc = (mDotFuel * 1000.0) / netThrustKN;

    let regime = 'PART POWER';
    if (throttlePct <= 26.0) regime = 'GROUND / FLT IDLE';
    else if (throttlePct >= 94.0) regime = 'MAX TOGA';
    else if (throttlePct >= 72.0 && throttlePct <= 84.0) regime = 'MAX CRUISE';
    else if (throttlePct > 84.0) regime = 'MAX CLIMB';

    return {
      throttlePct,
      altitudeFt,
      mach: M0,
      regime,
      V0,
      n1Pct,
      n2Pct,
      n1Rpm,
      n2Rpm,
      netThrustKN,
      bpr,
      opr,
      epr,
      eprCore,
      tsfc,
      fuelFlowKgS: mDotFuel,
      massFlowKgS: mDotTotal,
      combustorIntensity: clamp((Tt4 - 720.0) / 1160.0, 0.08, 1.0),
      exhaustVelocityMS: bypassNozzle.VExit * 0.65 + coreNozzle.VExit * 0.35,
      coreChoked: coreNozzle.choked,
      bypassChoked: bypassNozzle.choked,
      stations: {
        s0: { code: 'STN 0', label: 'Ambient Freestream', T: T0, P: P0 },
        s2: { code: 'STN 2', label: 'Fan / LPC Delivery', T: Tt25, P: Pt25, TInlet: Tt2, PInlet: Pt2, TBypass: Tt13, PBypass: Pt13 },
        s3: { code: 'STN 3', label: 'HPC Exit (6-Stg)', T: Tt3, P: Pt3 },
        s4: { code: 'STN 4', label: 'Combustor TIT', T: Tt4, P: Pt4 },
        s5: { code: 'STN 5', label: 'LPT Exit (EGT)', T: Tt5, P: Pt5, THpt: Tt45, PHpt: Pt45 }
      }
    };
  }
}
