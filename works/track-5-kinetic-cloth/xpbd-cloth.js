import * as THREE from 'three';

const NX = 24;
const NY = 16;
const NODE_COUNT = NX * NY; // 384
const NODE_MASS = 0.004;
const INV_MASS_FREE = 250.0;

const ALPHA_STRUCTURAL = 1.5e-5;
const ALPHA_SHEAR = 8.0e-5;
const ALPHA_BEND = 3.5e-2;

const ARCH_CENTER_X = 4.62;
const ARCH_TOP_Y = 1.82;
const CLOTH_WIDTH = 1.28;
const CLOTH_HEIGHT = 0.88;
const YAW_RAD = (25 * Math.PI) / 180;
const SIN_YAW = Math.sin(YAW_RAD); // 0.42262
const COS_YAW = Math.cos(YAW_RAD); // 0.90631
const NORM_X = COS_YAW;  // +0.90631
const NORM_Z = -SIN_YAW; // -0.42262

const COLLISION_RADIUS = 0.148;
const GRAVITY = -9.81;

export class XPBDCloth {
  constructor() {
    this.nx = NX;
    this.ny = NY;
    this.nodeCount = NODE_COUNT;
    this.iterations = 4;

    this.pos = new Float32Array(NODE_COUNT * 3);
    this.prevPos = new Float32Array(NODE_COUNT * 3);
    this.vel = new Float32Array(NODE_COUNT * 3);
    this.restPos = new Float32Array(NODE_COUNT * 3);
    this.invMass = new Float32Array(NODE_COUNT);

    this.windStrength = 2.4;
    this.windBurstTimer = 0;
    this.simTime = 0;
    this.maxBillowM = 0;
    this.kineticEnergyJ = 0;

    this._buildConstraints();
    this._buildGeometries();
    this.reset();
  }

  _idx(i, j) {
    return j * NX + i;
  }

  _buildConstraints() {
    const aList = [];
    const bList = [];
    const restList = [];
    const alphaList = [];
    const wirePairs = [];

    const du = CLOTH_WIDTH / (NX - 1);
    const dv = CLOTH_HEIGHT / (NY - 1);
    const diag = Math.hypot(du, dv);

    const pushConstraint = (i1, j1, i2, j2, restLen, alpha, addToWire) => {
      const a = this._idx(i1, j1);
      const b = this._idx(i2, j2);
      aList.push(a);
      bList.push(b);
      restList.push(restLen);
      alphaList.push(alpha);
      if (addToWire) {
        wirePairs.push(a, b);
      }
    };

    // 1. Structural constraints
    for (let j = 0; j < NY; j++) {
      for (let i = 0; i < NX; i++) {
        if (i + 1 < NX) pushConstraint(i, j, i + 1, j, du, ALPHA_STRUCTURAL, true);
        if (j + 1 < NY) pushConstraint(i, j, i, j + 1, dv, ALPHA_STRUCTURAL, true);
      }
    }

    // 2. Shear constraints
    for (let j = 0; j < NY - 1; j++) {
      for (let i = 0; i < NX - 1; i++) {
        pushConstraint(i, j, i + 1, j + 1, diag, ALPHA_SHEAR, true);
        pushConstraint(i + 1, j, i, j + 1, diag, ALPHA_SHEAR, true);
      }
    }

    // 3. Bending constraints (2-hop)
    for (let j = 0; j < NY; j++) {
      for (let i = 0; i < NX; i++) {
        if (i + 2 < NX) pushConstraint(i, j, i + 2, j, du * 2, ALPHA_BEND, false);
        if (j + 2 < NY) pushConstraint(i, j, i, j + 2, dv * 2, ALPHA_BEND, false);
      }
    }

    this.constraintCount = aList.length;
    this.cA = new Uint16Array(aList);
    this.cB = new Uint16Array(bList);
    this.cRest = new Float32Array(restList);
    this.cAlpha = new Float32Array(alphaList);
    this.lambda = new Float32Array(this.constraintCount);

    this.wirePairs = new Uint16Array(wirePairs);
    this.wireSegmentCount = wirePairs.length / 2;
    this.wirePos = new Float32Array(this.wireSegmentCount * 2 * 3);
  }

  _buildGeometries() {
    // Main cloth BufferGeometry (690 triangles)
    const geom = new THREE.BufferGeometry();
    const posAttr = new THREE.BufferAttribute(this.pos, 3);
    posAttr.setUsage(THREE.DynamicDrawUsage);
    geom.setAttribute('position', posAttr);

    const uvs = new Float32Array(NODE_COUNT * 2);
    for (let j = 0; j < NY; j++) {
      const v = 1 - j / (NY - 1);
      for (let i = 0; i < NX; i++) {
        const k = this._idx(i, j);
        uvs[k * 2] = i / (NX - 1);
        uvs[k * 2 + 1] = v;
      }
    }
    geom.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));

    const indices = new Uint16Array((NX - 1) * (NY - 1) * 6);
    let ptr = 0;
    for (let j = 0; j < NY - 1; j++) {
      for (let i = 0; i < NX - 1; i++) {
        const a = this._idx(i, j);
        const b = this._idx(i + 1, j);
        const c = this._idx(i, j + 1);
        const d = this._idx(i + 1, j + 1);
        indices[ptr++] = a;
        indices[ptr++] = b;
        indices[ptr++] = c;
        indices[ptr++] = b;
        indices[ptr++] = d;
        indices[ptr++] = c;
      }
    }
    geom.setIndex(new THREE.BufferAttribute(indices, 1));
    this.geometry = geom;

    // Wireframe constraint LineSegments BufferGeometry
    const wireGeom = new THREE.BufferGeometry();
    const wireAttr = new THREE.BufferAttribute(this.wirePos, 3);
    wireAttr.setUsage(THREE.DynamicDrawUsage);
    wireGeom.setAttribute('position', wireAttr);
    this.wireGeometry = wireGeom;
  }

  reset() {
    this.simTime = 0;
    this.windBurstTimer = 0;
    this.maxBillowM = 0;
    this.kineticEnergyJ = 0;

    const dv = CLOTH_HEIGHT / (NY - 1);
    for (let j = 0; j < NY; j++) {
      const y = ARCH_TOP_Y - j * dv;
      for (let i = 0; i < NX; i++) {
        const k = this._idx(i, j);
        const u = (i / (NX - 1) - 0.5) * CLOTH_WIDTH;
        const x = ARCH_CENTER_X + u * SIN_YAW;
        const z = u * COS_YAW;

        const p3 = k * 3;
        this.restPos[p3] = x;
        this.restPos[p3 + 1] = y;
        this.restPos[p3 + 2] = z;

        // Slight organic initial ripple on free nodes so cloth settles gracefully
        const ripple = j === 0 ? 0 : 0.008 * Math.sin(i * 0.65) * (j / (NY - 1));
        this.pos[p3] = x + ripple * NORM_X;
        this.pos[p3 + 1] = y;
        this.pos[p3 + 2] = z + ripple * NORM_Z;

        this.prevPos[p3] = this.pos[p3];
        this.prevPos[p3 + 1] = this.pos[p3 + 1];
        this.prevPos[p3 + 2] = this.pos[p3 + 2];

        this.vel[p3] = 0;
        this.vel[p3 + 1] = 0;
        this.vel[p3 + 2] = 0;

        this.invMass[k] = j === 0 ? 0.0 : INV_MASS_FREE;
      }
    }

    this.lambda.fill(0);
    this.syncGeometry(true);
  }

  triggerWindBurst() {
    this.windBurstTimer = 0.85;
  }

  step(dt, sphereActive = false, spherePos = null, sphereVel = null) {
    this.simTime += dt;
    if (this.windBurstTimer > 0) {
      this.windBurstTimer = Math.max(0, this.windBurstTimer - dt);
    }

    const burstBoost = this.windBurstTimer > 0 ? 9.5 * (this.windBurstTimer / 0.85) : 0;
    const effectiveWind = this.windStrength + burstBoost;
    const t = this.simTime;

    // 1. Predict: Gravity + Ambient Breeze + Semi-implicit Euler
    for (let k = 0; k < NODE_COUNT; k++) {
      if (this.invMass[k] === 0) continue;
      const p3 = k * 3;
      const y = this.pos[p3 + 1];
      const z = this.pos[p3 + 2];

      const windMag =
        effectiveWind *
        (0.45 + 0.35 * Math.sin(1.9 * t + 2.8 * z) + 0.2 * Math.cos(3.1 * t - 2.1 * y));

      const ax = windMag * NORM_X;
      const ay = GRAVITY;
      const az = windMag * NORM_Z;

      const vx = (this.vel[p3] + ax * dt) * 0.994;
      const vy = (this.vel[p3 + 1] + ay * dt) * 0.994;
      const vz = (this.vel[p3 + 2] + az * dt) * 0.994;

      this.vel[p3] = vx;
      this.vel[p3 + 1] = vy;
      this.vel[p3 + 2] = vz;

      this.prevPos[p3] = this.pos[p3];
      this.prevPos[p3 + 1] = this.pos[p3 + 1];
      this.prevPos[p3 + 2] = this.pos[p3 + 2];

      this.pos[p3] += vx * dt;
      this.pos[p3 + 1] += vy * dt;
      this.pos[p3 + 2] += vz * dt;
    }

    // 2. XPBD Constraint Projection (4 iterations, zero lambda once per substep)
    this.lambda.fill(0);
    const invDtSq = 1.0 / (dt * dt);
    const { pos, invMass, cA, cB, cRest, cAlpha, lambda, constraintCount } = this;

    for (let iter = 0; iter < this.iterations; iter++) {
      for (let c = 0; c < constraintCount; c++) {
        const a = cA[c];
        const b = cB[c];
        const wA = invMass[a];
        const wB = invMass[b];
        const wAB = wA + wB;
        if (wAB === 0) continue;

        const a3 = a * 3;
        const b3 = b * 3;
        const dx = pos[a3] - pos[b3];
        const dy = pos[a3 + 1] - pos[b3 + 1];
        const dz = pos[a3 + 2] - pos[b3 + 2];
        const len = Math.hypot(dx, dy, dz);
        if (len < 1e-6) continue;

        const C = len - cRest[c];
        const alphaTilde = cAlpha[c] * invDtSq;
        const dLambda = (-C - alphaTilde * lambda[c]) / (wAB + alphaTilde);
        lambda[c] += dLambda;

        const scale = dLambda / len;
        if (wA > 0) {
          const sA = wA * scale;
          pos[a3] += dx * sA;
          pos[a3 + 1] += dy * sA;
          pos[a3 + 2] += dz * sA;
        }
        if (wB > 0) {
          const sB = wB * scale;
          pos[b3] -= dx * sB;
          pos[b3 + 1] -= dy * sB;
          pos[b3 + 2] -= dz * sB;
        }
      }
    }

    // 3. Sphere-vs-Cloth Collision Impulse + Floor Clamp
    let billowImpact = false;
    if (sphereActive && spherePos && sphereVel) {
      const sx = spherePos.x;
      const sy = spherePos.y;
      const sz = spherePos.z;
      const impX = sphereVel.x * dt * 0.42;
      const impY = sphereVel.y * dt * 0.42;
      const impZ = sphereVel.z * dt * 0.42;

      for (let k = 0; k < NODE_COUNT; k++) {
        if (invMass[k] === 0) continue;
        const p3 = k * 3;
        const dx = pos[p3] - sx;
        const dy = pos[p3 + 1] - sy;
        const dz = pos[p3 + 2] - sz;
        const dist = Math.hypot(dx, dy, dz);
        if (dist < COLLISION_RADIUS) {
          billowImpact = true;
          const invDist = 1.0 / Math.max(dist, 1e-5);
          pos[p3] = sx + dx * invDist * COLLISION_RADIUS;
          pos[p3 + 1] = sy + dy * invDist * COLLISION_RADIUS;
          pos[p3 + 2] = sz + dz * invDist * COLLISION_RADIUS;

          this.prevPos[p3] -= impX;
          this.prevPos[p3 + 1] -= impY;
          this.prevPos[p3 + 2] -= impZ;
        }
      }
    }

    // 4. Bench floor clamp & Velocity Finalize + Billow / Energy metrics
    const invDt = 1.0 / dt;
    let maxBillow = 0;
    let keSum = 0;

    for (let k = 0; k < NODE_COUNT; k++) {
      if (invMass[k] === 0) continue;
      const p3 = k * 3;
      if (pos[p3 + 1] < 0.06) {
        pos[p3 + 1] = 0.06;
      }

      let vx = (pos[p3] - this.prevPos[p3]) * invDt;
      let vy = (pos[p3 + 1] - this.prevPos[p3 + 1]) * invDt;
      let vz = (pos[p3 + 2] - this.prevPos[p3 + 2]) * invDt;

      if (vx > 12) vx = 12;
      else if (vx < -12) vx = -12;
      if (vy > 12) vy = 12;
      else if (vy < -12) vy = -12;
      if (vz > 12) vz = 12;
      else if (vz < -12) vz = -12;

      this.vel[p3] = vx;
      this.vel[p3 + 1] = vy;
      this.vel[p3 + 2] = vz;

      keSum += 0.5 * NODE_MASS * (vx * vx + vy * vy + vz * vz);

      const ddx = pos[p3] - this.restPos[p3];
      const ddz = pos[p3 + 2] - this.restPos[p3 + 2];
      const normalDisp = Math.abs(ddx * NORM_X + ddz * NORM_Z);
      if (normalDisp > maxBillow) maxBillow = normalDisp;
    }

    this.maxBillowM = maxBillow;
    this.kineticEnergyJ = keSum;
    return billowImpact;
  }

  syncGeometry(updateWireframe = false) {
    this.geometry.attributes.position.needsUpdate = true;
    this.geometry.computeVertexNormals();
    this.geometry.computeBoundingSphere();

    if (updateWireframe) {
      const { wirePairs, wireSegmentCount, wirePos, pos } = this;
      for (let s = 0; s < wireSegmentCount; s++) {
        const a3 = wirePairs[s * 2] * 3;
        const b3 = wirePairs[s * 2 + 1] * 3;
        const w6 = s * 6;
        wirePos[w6] = pos[a3];
        wirePos[w6 + 1] = pos[a3 + 1];
        wirePos[w6 + 2] = pos[a3 + 2];
        wirePos[w6 + 3] = pos[b3];
        wirePos[w6 + 4] = pos[b3 + 1];
        wirePos[w6 + 5] = pos[b3 + 2];
      }
      this.wireGeometry.attributes.position.needsUpdate = true;
      this.wireGeometry.computeBoundingSphere();
    }
  }
}
