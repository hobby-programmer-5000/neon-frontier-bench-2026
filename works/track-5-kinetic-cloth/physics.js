import { XPBDCloth } from './xpbd-cloth.js';

export const G = 9.81;
export const FIXED_DT = 1 / 120;

export const R1 = 0.085;
export const M1 = 0.080;
export const R2 = 0.110;
export const M2 = 0.140;

export const HELIX_LEN = 5.3507;
export const CHUTE_LEN = 0.8516;
export const TOTAL_S1_LEN = HELIX_LEN + CHUTE_LEN; // 6.2023

export const LEVER_A_PIVOT = { x: -3.25, y: 0.96 };
export const LEVER_A_HALF = 0.68;
export const LEVER_A_ACTIVE_DEG = -6;
export const LEVER_A_HOLD_DEG = 12;

export const RAMP_START = { x: -2.58, y: 0.72 };
export const RAMP_END = { x: -1.72, y: 0.42 };
export const RAMP_LEN = 0.911;
export const RAMP_SIN = 0.3294;
export const RAMP_COS = 0.9442;

export const LEVER_B_PIVOT = { x: -1.38, y: 0.32 };
export const LEVER_B_HALF = 0.34;

export const DOM_COUNT = 12;
export const DOM_SPACING = 0.26;
export const DOM_X0 = -0.90;
export const DOM_H = 0.42;
export const DOM_T = 0.048;
export const DOM_W = 0.20;
export const DOM_MASS = 0.180;
export const DOM_INERTIA = (1 / 3) * DOM_MASS * (DOM_H * DOM_H + DOM_T * DOM_T);
export const DOM_HIT_ANGLE = Math.asin((DOM_SPACING - DOM_T) / DOM_H); // 0.5291 rad

export const CRADLE_COUNT = 5;
export const CRADLE_Y_PIV = 1.05;
export const CRADLE_L = 0.72;
export const CRADLE_R = 0.095;
export const CRADLE_PITCH = 0.192;
export const CRADLE_X0 = 2.30;
export const CRADLE_MASS = 0.220;

export const CAT_PIVOT = { x: 3.98, y: 0.30 };
export const CAT_ARM_L = 0.44;
export const CAT_COCK_RAD = (162 * Math.PI) / 180;
export const CAT_REL_RAD = (142 * Math.PI) / 180;
export const CAT_VX0 = 2.6957;
export const CAT_VY0 = 3.4503;

export const BELL_CROWN = { x: 5.44, y: 0.34, z: 0 };
export const DISH_REST = { x: 5.44, y: 0.125, z: 0.28 };
export const SPARK_COUNT = 96;

export const STAGE_NAMES = [
  '',
  'Spiral Helix',
  'Brass Lever A',
  'Ramp & Lever B',
  'Domino Cascade',
  "Newton's Cradle",
  'Torsion Catapult',
  'XPBD Silk Flight',
  'Funnel & Bell',
];

const DEG2RAD = Math.PI / 180;

function clamp(v, lo, hi) {
  return v < lo ? lo : v > hi ? hi : v;
}

export class KineticSimulation {
  constructor(audio = null) {
    this.audio = audio;
    this.cloth = new XPBDCloth();

    this.autoLevers = true;
    this.autoReset = true;
    this.paused = false;

    this.leverAMode = 'AUTO';
    this.leverBMode = 'AUTO';

    // Domino arrays
    this.domTheta = new Float32Array(DOM_COUNT);
    this.domOmega = new Float32Array(DOM_COUNT);
    this.domHit = new Uint8Array(DOM_COUNT);

    // Cradle arrays
    this.cradlePsi = new Float32Array(CRADLE_COUNT);
    this.cradleOmega = new Float32Array(CRADLE_COUNT);

    // 96-particle Golden Spark Burst
    this.sparkPos = new Float32Array(SPARK_COUNT * 3);
    this.sparkVel = new Float32Array(SPARK_COUNT * 3);
    this.sparkAge = new Float32Array(SPARK_COUNT);
    this.sparkLife = new Float32Array(SPARK_COUNT);
    this.sparkActive = new Uint8Array(SPARK_COUNT);

    this.energyHistory = [];
    this.maxEnergyHistory = 140;
    this.energySampleTimer = 0;

    this.reset(true);
  }

  reset(resetCloth = true) {
    this.stage = 1;
    this.simTimeSec = 0;
    this.settledTimer = 0;

    // Marble 1 (steel)
    this.phase1 = 'S1_DROP';
    this.m1 = { x: -4.80, y: 2.40, z: 0, vx: 0, vy: 0, vz: 0, rotZ: 0 };
    this.s1 = 0;
    this.v1 = 0;
    this.uA = 0;
    this.vuA = 0;
    this.sRamp = 0;
    this.vRamp = 0;
    this.uB = 0;
    this.vuB = 0;
    this.pocketTimer = 0;

    // Levers
    this.phiA = (this.leverAMode === 'HOLD' ? LEVER_A_HOLD_DEG : LEVER_A_ACTIVE_DEG) * DEG2RAD;
    this.omegaA = 0;
    this.phiB = (this.leverBMode === 'HOLD' ? 14 : -10) * DEG2RAD;
    this.omegaB = 0;
    this.leverBBoost = false;
    this.bumperCooldown = 0;

    // Dominoes
    this.domTheta.fill(0);
    this.domOmega.fill(0);
    this.domHit.fill(0);
    this.dominoToCradleFired = false;

    // Newton's cradle
    this.cradlePsi.fill(0);
    this.cradleOmega.fill(0);
    this.cradlePingCooldown = 0;

    // Catapult & Marble 2 (gold)
    this.phase2 = 'S6_COCKED';
    this.catapultTriggered = false;
    this.catapultAngle = CAT_COCK_RAD;
    this.catapultOmega = 0;
    this.m2 = {
      x: CAT_PIVOT.x + CAT_ARM_L * Math.cos(CAT_COCK_RAD),
      y: CAT_PIVOT.y + CAT_ARM_L * Math.sin(CAT_COCK_RAD),
      z: 0,
      vx: 0,
      vy: 0,
      vz: 0,
      rotZ: 0,
    };
    this.funnelT = 0;
    this.bounceT = 0;
    this.clothWhooshed = false;

    // Bell & sparks
    this.bellStruck = false;
    this.bellAge = 99;
    this.bellOscAngle = 0;
    this.bellGlowIntensity = 0.35;
    this.sparkActive.fill(0);

    if (resetCloth) {
      this.cloth.reset();
    }

    this.energyHistory = [];
    this.energySampleTimer = 0;
    this.energy = this.computeEnergy();
    this.energyHistory.push(this.energy);
    this.audio?.setRollHum(0);
  }

  toggleLeverA() {
    this.leverAMode = this.leverAMode === 'AUTO' ? 'HOLD' : 'AUTO';
    this.audio?.playLeverClink(0.6);
    return this.leverAMode;
  }

  toggleLeverB() {
    this.leverBMode = this.leverBMode === 'AUTO' ? 'HOLD' : 'AUTO';
    this.audio?.playLeverClink(0.6);
    return this.leverBMode;
  }

  setAutoLevers(enabled) {
    this.autoLevers = !!enabled;
    if (this.autoLevers) {
      this.leverAMode = 'AUTO';
      this.leverBMode = 'AUTO';
    }
  }

  triggerCatapultDemo(fastSnap = false) {
    // Jump cleanly to Stage 6 launch (all prior stages resolved cleanly)
    this.reset(false);
    this.stage = 6;
    this.simTimeSec = 0;

    // Park Marble 1 in recessed catch pocket
    this.phase1 = 'S4_DOMINOES';
    this.m1.x = -1.02;
    this.m1.y = R1;
    this.m1.z = 0;
    this.m1.vx = 0;
    this.m1.vy = 0;
    this.v1 = 0;

    // All 12 dominoes toppled cleanly
    this.domTheta[DOM_COUNT - 1] = 1.32;
    for (let i = DOM_COUNT - 2; i >= 0; i--) {
      this.domTheta[i] = 1.28;
      this.domOmega[i] = 0;
      this.domHit[i] = 1;
    }
    this.domHit[DOM_COUNT - 1] = 1;
    this.domOmega[DOM_COUNT - 1] = 0;
    this.dominoToCradleFired = true;

    // Cradle Sphere 4 rebounding cleanly after sear trip
    this.cradlePsi[4] = 0.24;
    this.cradleOmega[4] = -1.2;

    // Start catapult snapping right now
    this.catapultTriggered = true;
    this.phase2 = 'S6_CATAPULT';
    if (fastSnap) {
      // Pre-advance 20 real 120 Hz substeps (~0.17 s) so cloth billow, emerald bell strike,
      // and concentrated 96-spark fountain are all live at the 900 ms QA capture.
      this.catapultAngle = 148 * DEG2RAD;
      this.catapultOmega = -11.5;
      this.audio?.playCatapultTwang();
      for (let i = 0; i < 20; i++) {
        this.step(FIXED_DT);
      }
      return;
    } else {
      this.catapultAngle = CAT_COCK_RAD;
      this.catapultOmega = -1.2;
    }
    this.m2.x = CAT_PIVOT.x + CAT_ARM_L * Math.cos(this.catapultAngle);
    this.m2.y = CAT_PIVOT.y + CAT_ARM_L * Math.sin(this.catapultAngle);
    this.m2.z = 0;
    this.audio?.playCatapultTwang();
  }

  _spawnSparks() {
    for (let i = 0; i < SPARK_COUNT; i++) {
      // Deterministic quasi-random distribution for consistent exhibition burst
      const h1 = ((i * 2654435761) >>> 0) / 4294967296;
      const h2 = (((i + 37) * 2246822519) >>> 0) / 4294967296;
      const h3 = (((i + 73) * 3266489917) >>> 0) / 4294967296;

      const az = h1 * Math.PI * 2;
      const speed = 1.2 + h2 * 2.2;
      const vy = 1.4 + h3 * 2.4;

      const p3 = i * 3;
      this.sparkPos[p3] = BELL_CROWN.x + Math.cos(az) * 0.03;
      this.sparkPos[p3 + 1] = BELL_CROWN.y + 0.02;
      this.sparkPos[p3 + 2] = BELL_CROWN.z + Math.sin(az) * 0.03;

      this.sparkVel[p3] = Math.cos(az) * speed;
      this.sparkVel[p3 + 1] = vy;
      this.sparkVel[p3 + 2] = Math.sin(az) * speed;

      this.sparkAge[i] = 0;
      this.sparkLife[i] = 1.15 + h2 * 0.45;
      this.sparkActive[i] = 1;
    }
  }

  step(dt = FIXED_DT) {
    if (this.paused) return;

    this.simTimeSec += dt;
    if (this.bumperCooldown > 0) this.bumperCooldown -= dt;
    if (this.cradlePingCooldown > 0) this.cradlePingCooldown -= dt;

    // 1. Update Marble 1 (Stages 1..3 + catch pocket)
    this._stepMarble1AndLevers(dt);

    // 2. Update 12 Dominoes (Stage 4)
    this._stepDominoes(dt);

    // 3. Update 5-Sphere Newton's Cradle (Stage 5)
    this._stepCradle(dt);

    // 4. Update Catapult & Marble 2 (Stages 6..8) + XPBD Cloth
    this._stepCatapultAndMarble2(dt);

    // 5. Update Bell oscillation & 96 Golden Sparks
    this._stepBellAndSparks(dt);

    // 6. Roll hum audio
    const rollSpeed =
      this.phase1 === 'S1_HELIX' || this.phase1 === 'S1_CHUTE' || this.phase1 === 'S3_RAMP'
        ? Math.abs(this.v1)
        : this.phase1 === 'S2_LEVER_A'
          ? Math.abs(this.vuA)
          : this.phase1 === 'S3_LEVER_B'
            ? Math.abs(this.vuB)
            : 0;
    this.audio?.setRollHum(rollSpeed);

    // 7. Energy Ledger sampled at 30 Hz
    this.energy = this.computeEnergy();
    this.energySampleTimer += dt;
    if (this.energySampleTimer >= 1 / 30) {
      this.energySampleTimer -= 1 / 30;
      this.energyHistory.push(this.energy);
      if (this.energyHistory.length > this.maxEnergyHistory) {
        this.energyHistory.shift();
      }
    }

    // 8. Auto-reset after 3.0s hold in velvet dish
    if (this.phase2 === 'S8_SETTLED') {
      this.settledTimer += dt;
      if (this.autoReset && this.settledTimer >= 3.0) {
        this.reset(false);
      }
    }
  }

  _stepMarble1AndLevers(dt) {
    const m1 = this.m1;
    let onLeverA = false;
    let onLeverB = false;

    if (this.phase1 === 'S1_DROP') {
      this.stage = 1;
      m1.vy -= G * dt;
      m1.y += m1.vy * dt;
      if (m1.y <= 2.20 + R1) {
        this.phase1 = 'S1_HELIX';
        this.s1 = 0;
        this.v1 = 0.40;
      }
    } else if (this.phase1 === 'S1_HELIX') {
      this.stage = 1;
      this.v1 += ((5 / 7) * G * 0.1645 - 0.45 * this.v1) * dt;
      this.s1 += this.v1 * dt;
      m1.rotZ -= (this.v1 * dt) / R1;

      if (this.s1 >= HELIX_LEN) {
        this.phase1 = 'S1_CHUTE';
      } else {
        const u = this.s1 / HELIX_LEN;
        const theta = 4 * Math.PI * u;
        m1.x = -4.80 + 0.42 * Math.sin(theta);
        m1.y = 2.20 - 0.88 * u + R1;
        m1.z = -0.42 + 0.42 * Math.cos(theta);
        m1.vx = this.v1 * Math.cos(theta);
        m1.vy = -this.v1 * 0.1645;
      }
    }

    if (this.phase1 === 'S1_CHUTE') {
      this.stage = 1;
      this.v1 += ((5 / 7) * G * 0.1645 - 0.45 * this.v1) * dt;
      this.s1 += this.v1 * dt;
      m1.rotZ -= (this.v1 * dt) / R1;

      if (this.s1 >= TOTAL_S1_LEN) {
        this.phase1 = 'S1_TO_LEVER_A';
        m1.x = -3.96 + R1 * 0.1644;
        m1.y = 1.18 + R1 * 0.9864;
        m1.z = 0;
        m1.vx = this.v1 * 0.9864;
        m1.vy = -this.v1 * 0.1644;
      } else {
        const t = (this.s1 - HELIX_LEN) / CHUTE_LEN;
        m1.x = -4.80 + t * (-3.96 - -4.80) + R1 * 0.1644;
        m1.y = 1.32 + t * (1.18 - 1.32) + R1 * 0.9864;
        m1.z = 0;
        m1.vx = this.v1 * 0.9864;
        m1.vy = -this.v1 * 0.1644;
      }
    } else if (this.phase1 === 'S1_TO_LEVER_A') {
      this.stage = 2;
      m1.vy -= G * dt;
      m1.x += m1.vx * dt;
      m1.y += m1.vy * dt;
      m1.rotZ -= (m1.vx * dt) / R1;

      const yLine = LEVER_A_PIVOT.y + (m1.x - LEVER_A_PIVOT.x) * Math.tan(this.phiA) + R1;
      if (m1.y <= yLine) {
        this.phase1 = 'S2_LEVER_A';
        this.uA = clamp((m1.x - LEVER_A_PIVOT.x) / Math.cos(this.phiA), -0.62, 0.62);
        this.vuA =
          this.leverAMode === 'HOLD'
            ? m1.vx * Math.cos(this.phiA)
            : Math.max(0.8, m1.vx * Math.cos(this.phiA));
        this.audio?.playLeverClink(0.85);
      }
    } else if (this.phase1 === 'S2_LEVER_A') {
      this.stage = 2;
      onLeverA = true;
      this.vuA += (-(5 / 7) * G * Math.sin(this.phiA) - 0.18 * this.vuA) * dt;
      this.uA += this.vuA * dt;
      m1.rotZ -= (this.vuA * dt) / R1;

      if (this.uA < -0.60) {
        this.uA = -0.60;
        if (this.vuA < -0.15 && this.bumperCooldown <= 0) {
          this.audio?.playLeverClink(0.35);
          this.bumperCooldown = 0.25;
        }
        if (this.leverAMode === 'HOLD' && Math.abs(this.vuA) < 0.08) {
          this.vuA = 0;
        } else {
          this.vuA = Math.max(0, -0.25 * this.vuA);
        }
      }

      const cosA = Math.cos(this.phiA);
      const sinA = Math.sin(this.phiA);
      m1.x = LEVER_A_PIVOT.x + this.uA * cosA - R1 * sinA;
      m1.y = LEVER_A_PIVOT.y + this.uA * sinA + R1 * cosA;
      m1.z = 0;
      m1.vx = this.vuA * cosA;
      m1.vy = this.vuA * sinA;

      if (this.uA > LEVER_A_HALF) {
        this.phase1 = 'S2_TO_RAMP';
        onLeverA = false;
        m1.vx = Math.max(1.1, this.vuA * cosA);
        m1.vy = this.vuA * sinA;
      }
    } else if (this.phase1 === 'S2_TO_RAMP') {
      this.stage = 3;
      m1.vy -= G * dt;
      m1.x += m1.vx * dt;
      m1.y += m1.vy * dt;
      m1.rotZ -= (m1.vx * dt) / R1;

      const yRamp = RAMP_START.y - 0.3488 * (m1.x - RAMP_START.x) + R1;
      if (m1.y <= yRamp && m1.x >= RAMP_START.x - 0.05) {
        this.phase1 = 'S3_RAMP';
        this.sRamp = clamp((m1.x - RAMP_START.x) / RAMP_COS, 0, RAMP_LEN * 0.5);
        this.vRamp = Math.max(1.0, m1.vx * RAMP_COS - m1.vy * RAMP_SIN);
        this.audio?.playLeverClink(0.55);
      }
    } else if (this.phase1 === 'S3_RAMP') {
      this.stage = 3;
      this.vRamp += ((5 / 7) * G * RAMP_SIN - 0.15 * this.vRamp) * dt;
      this.sRamp += this.vRamp * dt;
      m1.rotZ -= (this.vRamp * dt) / R1;

      if (this.sRamp >= RAMP_LEN) {
        this.phase1 = 'S3_LEVER_B';
        this.uB = -0.32;
        this.vuB = Math.max(1.1, this.vRamp);
        this.leverBBoost = false;
        this.audio?.playLeverClink(0.65);
      } else {
        const t = this.sRamp / RAMP_LEN;
        m1.x = RAMP_START.x + t * (RAMP_END.x - RAMP_START.x) + R1 * RAMP_SIN;
        m1.y = RAMP_START.y + t * (RAMP_END.y - RAMP_START.y) + R1 * RAMP_COS;
        m1.z = 0;
        m1.vx = this.vRamp * RAMP_COS;
        m1.vy = -this.vRamp * RAMP_SIN;
      }
    } else if (this.phase1 === 'S3_LEVER_B') {
      this.stage = 3;
      onLeverB = true;
      if (this.leverBMode === 'AUTO' && this.uB > 0 && !this.leverBBoost) {
        this.leverBBoost = true;
        this.audio?.playLeverClink(0.9);
      }

      this.vuB += (-(5 / 7) * G * Math.sin(this.phiB) - 0.14 * this.vuB) * dt;
      this.uB += this.vuB * dt;
      m1.rotZ -= (this.vuB * dt) / R1;

      if (this.uB < -0.30) {
        this.uB = -0.30;
        if (this.leverBMode === 'HOLD' && Math.abs(this.vuB) < 0.08) {
          this.vuB = 0;
        } else {
          this.vuB = Math.max(0, -0.25 * this.vuB);
        }
      }

      const cosB = Math.cos(this.phiB);
      const sinB = Math.sin(this.phiB);
      m1.x = LEVER_B_PIVOT.x + this.uB * cosB - R1 * sinB;
      m1.y = LEVER_B_PIVOT.y + this.uB * sinB + R1 * cosB;
      m1.z = 0;
      m1.vx = this.vuB * cosB;
      m1.vy = this.vuB * sinB;

      if (this.uB > LEVER_B_HALF) {
        this.phase1 = 'S3_LAUNCH';
        onLeverB = false;
        m1.y = Math.max(0.29, m1.y);
        m1.vx = Math.max(2.15, this.vuB * cosB);
        m1.vy = this.vuB * sinB;
      }
    } else if (this.phase1 === 'S3_LAUNCH') {
      this.stage = 3;
      m1.vy -= G * dt;
      m1.x += m1.vx * dt;
      m1.y += m1.vy * dt;
      m1.rotZ -= (m1.vx * dt) / R1;

      if (m1.x >= -1.009) {
        // Strike Domino #0 and rebound into recessed brass catch pocket (-1.02, 0.085, 0)
        this.domHit[0] = 1;
        this.domOmega[0] = 4.2;
        this.audio?.playDominoClack(0);
        this.stage = 4;
        this.phase1 = 'S4_POCKET';
        this.pocketTimer = 0;
        m1.vx = -0.22;
        m1.vy = 0.25;
      }
    } else if (this.phase1 === 'S4_POCKET') {
      this.pocketTimer += dt;
      if (this.pocketTimer < 0.32) {
        m1.vy -= G * dt;
        m1.x += m1.vx * dt;
        m1.y = Math.max(R1, m1.y + m1.vy * dt);
        if (m1.x < -1.04) m1.x = -1.04;
      } else {
        // Settle quietly in recessed pocket
        m1.x += (-1.02 - m1.x) * 0.18;
        m1.y = R1;
        m1.vx = 0;
        m1.vy = 0;
      }
    }

    // Update Lever A & B rotational spring-damper dynamics every substep
    const targetA = (this.leverAMode === 'HOLD' ? LEVER_A_HOLD_DEG : LEVER_A_ACTIVE_DEG) * DEG2RAD;
    const tauMarbleA = onLeverA && this.leverAMode === 'AUTO' ? -14.0 * this.uA * Math.cos(this.phiA) : 0;
    const alphaA = 42.0 * (targetA - this.phiA) - 7.5 * this.omegaA + tauMarbleA;
    this.omegaA += alphaA * dt;
    this.phiA = clamp(this.phiA + this.omegaA * dt, -0.30, 0.24);
    if (this.phiA === -0.30 || this.phiA === 0.24) this.omegaA *= 0.2;

    let targetB = -10 * DEG2RAD;
    if (this.leverBMode === 'HOLD') {
      targetB = 14 * DEG2RAD;
    } else if (onLeverB && this.uB > 0) {
      targetB = -20 * DEG2RAD;
    }
    const alphaB = 58.0 * (targetB - this.phiB) - 8.0 * this.omegaB;
    this.omegaB += alphaB * dt;
    this.phiB = clamp(this.phiB + this.omegaB * dt, -0.38, 0.28);
  }

  _stepDominoes(dt) {
    const kDom = (3 * G) / (DOM_H * DOM_H + DOM_T * DOM_T);
    for (let i = 0; i < DOM_COUNT; i++) {
      if (!this.domHit[i] && this.domTheta[i] <= 0) continue;

      const th = this.domTheta[i];
      const om = this.domOmega[i];
      const alpha = kDom * (0.5 * DOM_H * Math.sin(th) - 0.5 * DOM_T * Math.cos(th)) - 0.35 * om;
      this.domOmega[i] = om + alpha * dt;
      this.domTheta[i] = th + this.domOmega[i] * dt;

      if (this.domTheta[i] < 0) {
        this.domTheta[i] = 0;
        this.domOmega[i] = 0;
      }

      // Neighbor strike at theta_hit = 0.5291 rad
      if (i < DOM_COUNT - 1 && !this.domHit[i + 1] && this.domTheta[i] >= DOM_HIT_ANGLE) {
        this.domHit[i + 1] = 1;
        this.domOmega[i + 1] = Math.max(3.1, 0.90 * this.domOmega[i]);
        this.domOmega[i] *= 0.48;
        this.audio?.playDominoClack(i + 1);
      }

      // Rest clamps (only apply once i+1 has been reached/tipped so Domino i can always strike i+1 at DOM_HIT_ANGLE)
      const maxAngle =
        i < DOM_COUNT - 1
          ? Math.min(1.28, Math.max(DOM_HIT_ANGLE + 0.012, this.domTheta[i + 1] + 0.165))
          : 1.32;
      if (this.domTheta[i] > maxAngle) {
        this.domTheta[i] = maxAngle;
        if (this.domOmega[i] > 0) this.domOmega[i] *= 0.12;
      }
    }

    // Domino 11 strikes Newton's Cradle Sphere 0 at theta_11 >= 0.5585 rad (32 deg)
    if (!this.dominoToCradleFired && this.domTheta[DOM_COUNT - 1] >= 0.5585) {
      this.dominoToCradleFired = true;
      this.cradleOmega[0] = 2.75;
      if (this.stage < 5) this.stage = 5;
      this.audio?.playCradlePing(1.0);
    }
  }

  _stepCradle(dt) {
    const restRatio = G / CRADLE_L;
    for (let k = 0; k < CRADLE_COUNT; k++) {
      const alpha = -restRatio * Math.sin(this.cradlePsi[k]) - 0.12 * this.cradleOmega[k];
      this.cradleOmega[k] += alpha * dt;
      this.cradlePsi[k] += this.cradleOmega[k] * dt;
    }

    // Pairwise elastic impulse (e = 0.985, 2 passes per substep) + positional separation
    const e = 0.985;
    const minDist = 2 * CRADLE_R;
    for (let pass = 0; pass < 2; pass++) {
      for (let k = 0; k < CRADLE_COUNT - 1; k++) {
        const xk = CRADLE_X0 + k * CRADLE_PITCH + CRADLE_L * Math.sin(this.cradlePsi[k]);
        const xNext =
          CRADLE_X0 + (k + 1) * CRADLE_PITCH + CRADLE_L * Math.sin(this.cradlePsi[k + 1]);
        const dist = xNext - xk;
        if (dist < minDist) {
          const overlap = minDist - dist;
          const corr = (0.5 * overlap) / CRADLE_L;
          this.cradlePsi[k] -= corr;
          this.cradlePsi[k + 1] += corr;

          if (this.cradleOmega[k] > this.cradleOmega[k + 1]) {
            const relV = this.cradleOmega[k] - this.cradleOmega[k + 1];
            const vAvg = 0.5 * (this.cradleOmega[k] + this.cradleOmega[k + 1]);
            const halfJump = 0.5 * relV * e;
            this.cradleOmega[k] = vAvg - halfJump;
            this.cradleOmega[k + 1] = vAvg + halfJump;

            if (pass === 0 && relV > 0.65 && this.cradlePingCooldown <= 0) {
              this.audio?.playCradlePing(Math.min(1.2, relV / 2.6));
              this.cradlePingCooldown = 0.08;
            }
          }
        }
      }
    }

    // Sphere 4 trips Catapult Trigger Sear at psi_4 >= +0.279 rad (+16 deg)
    if (!this.catapultTriggered && this.cradlePsi[CRADLE_COUNT - 1] >= 0.279) {
      this.catapultTriggered = true;
      this.cradleOmega[CRADLE_COUNT - 1] = -0.55 * Math.abs(this.cradleOmega[CRADLE_COUNT - 1]);
      this.phase2 = 'S6_CATAPULT';
      this.stage = 6;
      this.audio?.playCatapultTwang();
    }
  }

  _stepCatapultAndMarble2(dt) {
    const m2 = this.m2;
    let sphereClothActive = false;

    if (this.phase2 === 'S6_COCKED') {
      this.catapultAngle = CAT_COCK_RAD;
      m2.x = CAT_PIVOT.x + CAT_ARM_L * Math.cos(this.catapultAngle);
      m2.y = CAT_PIVOT.y + CAT_ARM_L * Math.sin(this.catapultAngle);
      m2.z = 0;
    } else if (this.phase2 === 'S6_CATAPULT') {
      this.stage = 6;
      this.catapultOmega += -135.0 * dt;
      this.catapultAngle += this.catapultOmega * dt;

      if (this.catapultAngle <= CAT_REL_RAD) {
        this.catapultAngle = CAT_REL_RAD;
        this.catapultOmega = 0;
        this.phase2 = 'S7_FLIGHT';
        this.stage = 7;

        m2.x = CAT_PIVOT.x + CAT_ARM_L * Math.cos(CAT_REL_RAD);
        m2.y = CAT_PIVOT.y + CAT_ARM_L * Math.sin(CAT_REL_RAD);
        m2.z = 0;
        m2.vx = CAT_VX0;
        m2.vy = CAT_VY0;
        m2.vz = 0;
      } else {
        m2.x = CAT_PIVOT.x + CAT_ARM_L * Math.cos(this.catapultAngle);
        m2.y = CAT_PIVOT.y + CAT_ARM_L * Math.sin(this.catapultAngle);
        m2.z = 0;
      }
    } else if (this.phase2 === 'S7_FLIGHT') {
      this.stage = 7;
      m2.vy -= G * dt;
      m2.x += m2.vx * dt;
      m2.y += m2.vy * dt;
      m2.rotZ -= (m2.vx * dt) / R2;
      sphereClothActive = true;

      // Check Stage 8 Funnel entry
      if (m2.x >= 5.24 && m2.vy < 0 && m2.y <= 0.68 + 0.04) {
        this.phase2 = 'S8_FUNNEL';
        this.stage = 8;
        this.funnelT = 0;
        this.funnelStartX = m2.x;
        this.funnelStartY = m2.y;
        this.audio?.playLeverClink(0.75);
      }
    } else if (this.phase2 === 'S8_FUNNEL') {
      this.stage = 8;
      this.funnelT += dt;
      const p = clamp(this.funnelT / 0.18, 0, 1);
      const spiralR = (1 - p) * 0.14;
      const ang = p * Math.PI * 3.0;
      m2.x = 5.44 + spiralR * Math.cos(ang);
      m2.z = spiralR * Math.sin(ang);
      m2.y = this.funnelStartY * (1 - p) + 0.44 * p;
      m2.vx = -spiralR * Math.sin(ang) * 14.0;
      m2.vy = -1.2;
      m2.rotZ -= 12.0 * dt;

      if (this.funnelT >= 0.18) {
        this.phase2 = 'S8_BELL_BOUNCE';
        this.bounceT = 0;
        this.bellStruck = true;
        this.bellAge = 0;
        this.audio?.playBellChime();
        this._spawnSparks();
      }
    } else if (this.phase2 === 'S8_BELL_BOUNCE') {
      this.stage = 8;
      this.bounceT += dt;
      const p = clamp(this.bounceT / 0.28, 0, 1);
      // Clean parabolic hop from bell crown (5.44, 0.45, 0) into velvet catch dish (5.44, 0.11, 0.28)
      m2.x = 5.44;
      m2.z = DISH_REST.z * p;
      m2.y = 0.45 * (1 - p) + DISH_REST.y * p + 0.12 * Math.sin(Math.PI * p);
      m2.vx = 0;
      m2.vy = 0;
      m2.rotZ -= 6.0 * dt;

      if (this.bounceT >= 0.28) {
        this.phase2 = 'S8_SETTLED';
        this.settledTimer = 0;
        m2.x = DISH_REST.x;
        m2.y = DISH_REST.y;
        m2.z = DISH_REST.z;
      }
    } else if (this.phase2 === 'S8_SETTLED') {
      this.stage = 8;
      m2.x = DISH_REST.x;
      m2.y = DISH_REST.y;
      m2.z = DISH_REST.z;
    }

    // Step XPBD cloth every substep
    const m2Vel = { x: m2.vx, y: m2.vy, z: m2.vz };
    const clothHit = this.cloth.step(dt, sphereClothActive, m2, m2Vel);
    if (clothHit && !this.clothWhooshed) {
      this.clothWhooshed = true;
      this.audio?.playSilkWhoosh();
    }
  }

  _stepBellAndSparks(dt) {
    if (this.bellStruck) {
      this.bellAge += dt;
      const decay = Math.exp(-2.8 * this.bellAge);
      this.bellOscAngle = 0.11 * decay * Math.sin(42.0 * this.bellAge);
      this.bellGlowIntensity = 0.35 + 1.85 * Math.exp(-2.2 * this.bellAge);
    } else {
      this.bellOscAngle = 0;
      this.bellGlowIntensity = 0.35;
    }

    for (let i = 0; i < SPARK_COUNT; i++) {
      if (!this.sparkActive[i]) continue;
      this.sparkAge[i] += dt;
      if (this.sparkAge[i] >= this.sparkLife[i]) {
        this.sparkActive[i] = 0;
        continue;
      }
      const p3 = i * 3;
      this.sparkVel[p3 + 1] -= 7.5 * dt;
      this.sparkPos[p3] += this.sparkVel[p3] * dt;
      this.sparkPos[p3 + 1] += this.sparkVel[p3 + 1] * dt;
      this.sparkPos[p3 + 2] += this.sparkVel[p3 + 2] * dt;
      if (this.sparkPos[p3 + 1] < 0.02) {
        this.sparkPos[p3 + 1] = 0.02;
        this.sparkVel[p3 + 1] *= -0.35;
      }
    }
  }

  computeEnergy() {
    let ePot = M1 * G * Math.max(0, this.m1.y) + M2 * G * Math.max(0, this.m2.y);

    // Catapult torsion spring stored potential (1.35 J cocked -> 0 J released)
    const cockSpan = CAT_COCK_RAD - CAT_REL_RAD;
    const springFrac = clamp((this.catapultAngle - CAT_REL_RAD) / cockSpan, 0, 1);
    ePot += 1.35 * springFrac;

    for (let i = 0; i < DOM_COUNT; i++) {
      ePot += DOM_MASS * G * (DOM_H * 0.5) * Math.cos(this.domTheta[i]);
    }
    for (let k = 0; k < CRADLE_COUNT; k++) {
      ePot += CRADLE_MASS * G * CRADLE_L * (1 - Math.cos(this.cradlePsi[k]));
    }

    const v1Sq = this.m1.vx * this.m1.vx + this.m1.vy * this.m1.vy + this.m1.vz * this.m1.vz;
    const v2Sq = this.m2.vx * this.m2.vx + this.m2.vy * this.m2.vy + this.m2.vz * this.m2.vz;
    let eKin = 0.7 * M1 * v1Sq + 0.5 * M2 * v2Sq;

    for (let i = 0; i < DOM_COUNT; i++) {
      const w = this.domOmega[i];
      eKin += 0.5 * DOM_INERTIA * w * w;
    }
    for (let k = 0; k < CRADLE_COUNT; k++) {
      const v = CRADLE_L * this.cradleOmega[k];
      eKin += 0.5 * CRADLE_MASS * v * v;
    }

    const eCloth = this.cloth.kineticEnergyJ;
    const eTot = ePot + eKin + eCloth;
    return {
      E_pot: ePot,
      E_kin: eKin,
      E_cloth: eCloth,
      E_tot: eTot,
    };
  }

  getActiveMarblePosition() {
    if (this.stage >= 6) {
      return this.m2;
    }
    if (this.stage === 5) {
      return {
        x: CRADLE_X0 + 2 * CRADLE_PITCH + CRADLE_L * Math.sin(this.cradlePsi[2]),
        y: 0.42,
        z: 0,
      };
    }
    if (this.stage === 4) {
      // Track leading falling domino
      let leadIdx = 0;
      for (let i = 0; i < DOM_COUNT; i++) {
        if (this.domHit[i]) leadIdx = i;
      }
      return { x: DOM_X0 + leadIdx * DOM_SPACING, y: 0.25, z: 0 };
    }
    return this.m1;
  }
}
