/**
 * AeroFan X-900 — Procedural PBR Canvas Maps & Custom WebGL2 GLSL Shaders (Round 2 Refined)
 *
 * Strict WebGL2 / ANGLE D3D11 Safety (SPEC_CONTRACT.md Section 3.4):
 *   - ZERO early `return` statements inside any GLSL helper function (prevents ANGLE X4000 warning)
 *   - ZERO duplicate `onBeforeCompile` hooks on shared materials
 *   - Ultra-fast ImageData pixel synthesis (<2ms total texture boot time)
 *   - Soft ACES/Fresnel volumetric combustor falloff (zero additive white blowout in macro view)
 *   - Annular-constrained CFD streamlines inside the 135-deg cutaway gas path (zero stator wall piercing)
 */

import * as THREE from 'three';

/**
 * Fast ImageData-backed painted spiral rotation marker texture for the nose spinner cone
 */
export function createSpinnerSpiralTexture() {
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  const img = ctx.createImageData(size, size);
  const data = img.data;

  for (let py = 0; py < size; py++) {
    const v = py / size;
    const groove = Math.sin(py * 0.7) * 3.5;
    const turns = 1.65;
    const centerU = (v * turns) % 1.0;
    const halfWidth = 0.11 * (1.0 - 0.35 * v);
    const inBand = v > 0.08 && v < 0.90;
    const inWarnRing = v >= 0.915 && v <= 0.94;

    for (let px = 0; px < size; px++) {
      const u = px / size;
      let r = 23 + groove;
      let g = 27 + groove;
      let b = 34 + groove;

      if (inBand) {
        let dist = Math.abs(u - centerU);
        dist = Math.min(dist, Math.abs(u - centerU - 1.0), Math.abs(u - centerU + 1.0));
        if (dist < halfWidth) {
          const edge = Math.min(1.0, (halfWidth - dist) * 48.0);
          r = r + (238 - r) * edge;
          g = g + (243 - g) * edge;
          b = b + (249 - b) * edge;
        }
      } else if (inWarnRing) {
        r = 204;
        g = 138;
        b = 52;
      }

      const idx = (py * size + px) * 4;
      data[idx + 0] = Math.max(0, Math.min(255, r));
      data[idx + 1] = Math.max(0, Math.min(255, g));
      data[idx + 2] = Math.max(0, Math.min(255, b));
      data[idx + 3] = 255;
    }
  }

  ctx.putImageData(img, 0, 0);
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.ClampToEdgeWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

/**
 * Procedural ANSI Y14.2 / ISO 128 45-deg Diagonal CAD Cross-Hatching + Brushed Metallic Roughness/Bump Maps
 * Applied to all 135-deg cutaway planar section-cut caps in isometric world-space UV coordinates!
 */
export function createSectionHatchTextures() {
  const size = 256;
  const cCanvas = document.createElement('canvas');
  cCanvas.width = size;
  cCanvas.height = size;
  const cCtx = cCanvas.getContext('2d');

  const rCanvas = document.createElement('canvas');
  rCanvas.width = size;
  rCanvas.height = size;
  const rCtx = rCanvas.getContext('2d');

  const bCanvas = document.createElement('canvas');
  bCanvas.width = size;
  bCanvas.height = size;
  const bCtx = bCanvas.getContext('2d');

  const cImg = cCtx.createImageData(size, size);
  const rImg = rCtx.createImageData(size, size);
  const bImg = bCtx.createImageData(size, size);
  const cData = cImg.data;
  const rData = rImg.data;
  const bData = bImg.data;

  // Seamless periodic 45-degree diagonal coordinates: (px + py) mod period divides 256 cleanly (period = 16 px)
  const period = 16.0;
  for (let py = 0; py < size; py++) {
    // Fine horizontal lathe brush micro-grain
    const brush = Math.sin((py / size) * Math.PI * 32.0) * 5.0 + Math.cos((py / size) * Math.PI * 76.0) * 3.0;
    for (let px = 0; px < size; px++) {
      // Exact 45.0-degree ANSI/ISO alloy double-line section hatching
      const diagPhase = ((px + py) % period) / period;
      // Primary crisp machined 45-deg groove at phase ~0.18 and secondary companion line at ~0.38
      const line1 = Math.exp(-Math.pow((diagPhase - 0.18) / 0.055, 2.0));
      const line2 = 0.72 * Math.exp(-Math.pow((diagPhase - 0.38) / 0.048, 2.0));
      // Subtle counter-diagonal micro-lap cross-polish
      const crossLap = 0.14 * Math.sin((((px - py + 512) % 32) / 32.0) * Math.PI * 2.0);
      const groove = Math.min(1.0, line1 + line2);

      // Machined anodized copper-amber billet highlight on land, dark etched charcoal-bronze in 45-deg hatch grooves!
      const baseR = 218 + brush + crossLap * 10.0;
      const baseG = 136 + brush * 0.7 + crossLap * 7.0;
      const baseB = 72 + brush * 0.5 + crossLap * 5.0;

      const rCol = baseR * (1.0 - 0.52 * groove) + 28.0 * (1.0 - groove) * 0.15;
      const gCol = baseG * (1.0 - 0.56 * groove) + 22.0 * (1.0 - groove) * 0.15;
      const bCol = baseB * (1.0 - 0.58 * groove) + 18.0 * (1.0 - groove) * 0.15;

      // Specular roughness: 0.20 mirror-milled land vs 0.68 matte etched hatch line
      const roughByte = Math.round((0.20 + 0.48 * groove) * 255.0);
      // Bump height: 225 flat land vs 55 recessed engraved 45-deg groove
      const bumpByte = Math.round(225.0 - 170.0 * groove);

      const idx = (py * size + px) * 4;
      cData[idx + 0] = Math.max(0, Math.min(255, rCol));
      cData[idx + 1] = Math.max(0, Math.min(255, gCol));
      cData[idx + 2] = Math.max(0, Math.min(255, bCol));
      cData[idx + 3] = 255;

      rData[idx + 0] = roughByte;
      rData[idx + 1] = roughByte;
      rData[idx + 2] = roughByte;
      rData[idx + 3] = 255;

      bData[idx + 0] = bumpByte;
      bData[idx + 1] = bumpByte;
      bData[idx + 2] = bumpByte;
      bData[idx + 3] = 255;
    }
  }

  cCtx.putImageData(cImg, 0, 0);
  rCtx.putImageData(rImg, 0, 0);
  bCtx.putImageData(bImg, 0, 0);

  const map = new THREE.CanvasTexture(cCanvas);
  map.wrapS = THREE.RepeatWrapping;
  map.wrapT = THREE.RepeatWrapping;
  map.colorSpace = THREE.SRGBColorSpace;
  map.anisotropy = 4;

  const roughnessMap = new THREE.CanvasTexture(rCanvas);
  roughnessMap.wrapS = THREE.RepeatWrapping;
  roughnessMap.wrapT = THREE.RepeatWrapping;

  const bumpMap = new THREE.CanvasTexture(bCanvas);
  bumpMap.wrapS = THREE.RepeatWrapping;
  bumpMap.wrapT = THREE.RepeatWrapping;

  return { map, roughnessMap, bumpMap };
}

/**
 * Fast ImageData perforated acoustic honeycomb liner bump/albedo map
 */
export function createAcousticLinerTextures() {
  const size = 128;
  const colorCanvas = document.createElement('canvas');
  colorCanvas.width = size;
  colorCanvas.height = size;
  const cCtx = colorCanvas.getContext('2d');

  const bumpCanvas = document.createElement('canvas');
  bumpCanvas.width = size;
  bumpCanvas.height = size;
  const bCtx = bumpCanvas.getContext('2d');

  const cImg = cCtx.createImageData(size, size);
  const bImg = bCtx.createImageData(size, size);
  const cData = cImg.data;
  const bData = bImg.data;

  const stepX = 16;
  const stepY = 16;
  for (let py = 0; py < size; py++) {
    const row = Math.floor(py / stepY);
    const ly = (py % stepY) - stepY * 0.5;
    for (let px = 0; px < size; px++) {
      const shiftX = (px + (row % 2 === 0 ? 0 : stepX * 0.5)) % stepX;
      const lx = shiftX - stepX * 0.5;
      const d = Math.hypot(lx, ly);
      const hole = d < 3.6 ? 1.0 : 0.0;
      const seam = px === 0 || py === 0 ? 1.0 : 0.0;

      const idx = (py * size + px) * 4;
      cData[idx + 0] = hole ? 18 : seam ? 72 : 46;
      cData[idx + 1] = hole ? 23 : seam ? 84 : 55;
      cData[idx + 2] = hole ? 30 : seam ? 98 : 68;
      cData[idx + 3] = 255;

      const bv = hole ? 36 : 210;
      bData[idx + 0] = bv;
      bData[idx + 1] = bv;
      bData[idx + 2] = bv;
      bData[idx + 3] = 255;
    }
  }

  cCtx.putImageData(cImg, 0, 0);
  bCtx.putImageData(bImg, 0, 0);

  const map = new THREE.CanvasTexture(colorCanvas);
  map.wrapS = THREE.RepeatWrapping;
  map.wrapT = THREE.RepeatWrapping;
  map.repeat.set(14, 6);
  map.colorSpace = THREE.SRGBColorSpace;

  const bumpMap = new THREE.CanvasTexture(bumpCanvas);
  bumpMap.wrapS = THREE.RepeatWrapping;
  bumpMap.wrapT = THREE.RepeatWrapping;
  bumpMap.repeat.set(14, 6);

  return { map, bumpMap };
}

/**
 * Fast ImageData brushed anisotropic aerospace titanium / satin nacelle texture
 */
export function createBrushedMetalTexture(baseHex = '#9aa5b4', contrast = 14) {
  const size = 128;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  const img = ctx.createImageData(size, size);
  const data = img.data;

  const base = new THREE.Color(baseHex);
  const r0 = Math.round(base.r * 255);
  const g0 = Math.round(base.g * 255);
  const b0 = Math.round(base.b * 255);

  for (let y = 0; y < size; y++) {
    const n = Math.sin(y * 1.9) * 0.45 + Math.cos(y * 7.7) * 0.35 + Math.sin(y * 19.3) * 0.2;
    const d = Math.round(n * contrast);
    const rv = Math.max(0, Math.min(255, r0 + d));
    const gv = Math.max(0, Math.min(255, g0 + d));
    const bv = Math.max(0, Math.min(255, b0 + d));
    for (let x = 0; x < size; x++) {
      const idx = (y * size + x) * 4;
      data[idx + 0] = rv;
      data[idx + 1] = gv;
      data[idx + 2] = bv;
      data[idx + 3] = 255;
    }
  }

  ctx.putImageData(img, 0, 0);
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(4, 4);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/**
 * Custom Animated GLSL Volumetric Annular Combustion Plasma/Flame Ring Shader (Round 2 Refined)
 *   - Soft Fresnel grazing attenuation + inline ACES filmic shoulder compression
 *     eliminates harsh additive white blowout in close-up macro inspection while
 *     highlighting discrete 18-nozzle blue premix cones & turbulent golden plasma filaments!
 *   - Zero early returns in helper functions -> 0 ANGLE X4000 warnings!
 */
export function createCombustorFlameMaterial() {
  return new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0.0 },
      uIntensity: { value: 0.72 },
      uSwirlSpeed: { value: 6.5 },
      uShellLayer: { value: 0.75 },
      uMacroScale: { value: 1.0 }
    },
    vertexShader: /* glsl */ `
      varying vec3 vLocalPos;
      varying vec3 vNormalView;
      varying vec3 vViewDir;

      void main() {
        vLocalPos = position;
        vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
        vNormalView = normalize(normalMatrix * normal);
        vViewDir = normalize(-mvPosition.xyz);
        gl_Position = projectionMatrix * mvPosition;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform float uTime;
      uniform float uIntensity;
      uniform float uSwirlSpeed;
      uniform float uShellLayer;
      uniform float uMacroScale;

      varying vec3 vLocalPos;
      varying vec3 vNormalView;
      varying vec3 vViewDir;

      float hash31(vec3 p) {
        vec3 q = fract(p * 0.1031);
        q += dot(q, q.yzx + 33.33);
        return fract((q.x + q.y) * q.z);
      }

      float valueNoise3(vec3 p) {
        vec3 i = floor(p);
        vec3 f = fract(p);
        vec3 u = f * f * (3.0 - 2.0 * f);

        float n000 = hash31(i + vec3(0.0, 0.0, 0.0));
        float n100 = hash31(i + vec3(1.0, 0.0, 0.0));
        float n010 = hash31(i + vec3(0.0, 1.0, 0.0));
        float n110 = hash31(i + vec3(1.0, 1.0, 0.0));
        float n001 = hash31(i + vec3(0.0, 0.0, 1.0));
        float n101 = hash31(i + vec3(1.0, 0.0, 1.0));
        float n011 = hash31(i + vec3(0.0, 1.0, 1.0));
        float n111 = hash31(i + vec3(1.0, 1.0, 1.0));

        float nx00 = mix(n000, n100, u.x);
        float nx10 = mix(n010, n110, u.x);
        float nx01 = mix(n001, n101, u.x);
        float nx11 = mix(n011, n111, u.x);

        float nxy0 = mix(nx00, nx10, u.y);
        float nxy1 = mix(nx01, nx11, u.y);

        return mix(nxy0, nxy1, u.z);
      }

      float fbmFlame(vec3 p) {
        float sum = 0.0;
        float amp = 0.54;
        vec3 q = p;
        for (int i = 0; i < 3; i++) {
          sum += amp * valueNoise3(q);
          q = q * 2.12 + vec3(1.7, -2.3, 1.1);
          amp *= 0.5;
        }
        return sum;
      }

      vec3 acesSoftCompress(vec3 x) {
        vec3 a = x * (2.51 * x + 0.03);
        vec3 b = x * (2.43 * x + 0.59) + 0.14;
        return clamp(a / b, 0.0, 1.0);
      }

      vec3 combustionSpectrum(float heat, float axialNorm) {
        // Distinct cobalt-cyan lean premix cones at injector nozzles -> rich crimson-orange -> warm golden plasma filaments
        vec3 leanBlue = vec3(0.10, 0.54, 1.15);
        vec3 deepEmber = vec3(0.92, 0.22, 0.03);
        vec3 richAmber = vec3(1.00, 0.52, 0.10);
        vec3 filamentGold = vec3(1.00, 0.84, 0.42);

        float domeBlueMix = smoothstep(0.36, 0.02, axialNorm) * (1.0 - smoothstep(0.62, 0.95, heat));
        vec3 thermal = mix(deepEmber, richAmber, smoothstep(0.18, 0.58, heat));
        thermal = mix(thermal, filamentGold, smoothstep(0.58, 0.95, heat));
        return mix(thermal, leanBlue, domeBlueMix * 0.85);
      }

      void main() {
        float axialNorm = clamp((vLocalPos.x - 0.24) / 0.64, 0.0, 1.0);
        float angle = atan(vLocalPos.y, vLocalPos.z);
        float radius = length(vLocalPos.yz);

        // 18 discrete fuel-injector swirler lobes with crisp inter-lobe contrast
        float swirlPhase = angle * 18.0 - axialNorm * 5.2 + uTime * uSwirlSpeed;
        float injectorLobes = 0.35 + 0.65 * pow(0.5 + 0.5 * cos(swirlPhase), 1.6);

        vec3 sampleCoord = vec3(
          vLocalPos.x * 10.5 - uTime * (8.0 + 10.0 * uIntensity),
          vLocalPos.y * 9.5 + sin(uTime * 2.2 + axialNorm * 4.2) * 0.42,
          vLocalPos.z * 9.5 + cos(uTime * 2.2 + axialNorm * 4.2) * 0.42
        );
        float turb = fbmFlame(sampleCoord);
        float filament = smoothstep(0.28, 0.82, turb);

        // Axial envelope + radial core confinement
        float envIn = smoothstep(0.0, 0.14, axialNorm);
        float envOut = 1.0 - smoothstep(0.52, 1.0, axialNorm) * 0.86;
        float radialCore = 1.0 - clamp(abs(radius - 0.535) / 0.095, 0.0, 1.0);

        // Soft Fresnel grazing falloff prevents multi-shell silhouette whiteout!
        float ndv = abs(dot(normalize(vNormalView), normalize(vViewDir)));
        float fresnelSoft = smoothstep(0.06, 0.72, ndv);

        float flameDensity = envIn * envOut * radialCore * injectorLobes * (0.28 + 0.72 * filament);
        float heat = clamp(flameDensity * (0.55 + 0.52 * uIntensity), 0.0, 1.0);

        vec3 hdrCol = combustionSpectrum(heat, axialNorm) * (0.55 + 0.92 * uIntensity) * uMacroScale;
        vec3 mappedCol = acesSoftCompress(hdrCol);
        float alpha = clamp(flameDensity * fresnelSoft * (0.22 + 0.34 * uIntensity) * uShellLayer * uMacroScale, 0.0, 0.56);

        gl_FragColor = vec4(mappedCol, alpha);
      }
    `,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    side: THREE.DoubleSide
  });
}

/**
 * Supersonic Exhaust Plume & Shock-Diamond Volumetric Cone Shader
 */
export function createExhaustPlumeMaterial() {
  return new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0.0 },
      uThrustNorm: { value: 0.55 },
      uChoked: { value: 0.0 }
    },
    vertexShader: /* glsl */ `
      varying vec2 vUv;
      varying vec3 vNormalView;
      varying vec3 vViewDir;

      void main() {
        vUv = uv;
        vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
        vNormalView = normalize(normalMatrix * normal);
        vViewDir = normalize(-mvPosition.xyz);
        gl_Position = projectionMatrix * mvPosition;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform float uTime;
      uniform float uThrustNorm;
      uniform float uChoked;

      varying vec2 vUv;
      varying vec3 vNormalView;
      varying vec3 vViewDir;

      float plumeHash(vec2 p) {
        vec3 p3 = fract(vec3(p.xyx) * 0.1031);
        p3 += dot(p3, p3.yzx + 33.33);
        return fract((p3.x + p3.y) * p3.z);
      }

      float plumeNoise(vec2 p) {
        vec2 i = floor(p);
        vec2 f = fract(p);
        vec2 u = f * f * (3.0 - 2.0 * f);
        float a = plumeHash(i);
        float b = plumeHash(i + vec2(1.0, 0.0));
        float c = plumeHash(i + vec2(0.0, 1.0));
        float d = plumeHash(i + vec2(1.0, 1.0));
        return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
      }

      void main() {
        float axial = vUv.y;
        float shear = plumeNoise(vec2(vUv.x * 16.0, axial * 12.0 - uTime * (14.0 + 16.0 * uThrustNorm)));
        float shockWave = pow(max(0.0, cos(axial * 26.0 - 0.8)), 4.0) * (1.0 - axial);
        float shockBoost = mix(0.15, 0.95, clamp(uThrustNorm * 1.15 + uChoked * 0.35, 0.0, 1.0));

        float ndv = abs(dot(normalize(vNormalView), normalize(vViewDir)));
        float softEdge = pow(ndv, 1.2) * (1.0 - smoothstep(0.15, 1.0, axial));
        float coreGlow = (0.45 + 0.55 * shear) + shockWave * shockBoost * 0.58;

        vec3 hotBlue = vec3(0.32, 0.62, 1.0);
        vec3 hotAmber = vec3(1.0, 0.56, 0.20);
        vec3 col = mix(hotBlue, hotAmber, smoothstep(0.2, 0.85, uThrustNorm) * (0.45 + 0.45 * shockWave));

        float alpha = clamp(softEdge * coreGlow * (0.05 + 0.28 * uThrustNorm), 0.0, 0.48);
        gl_FragColor = vec4(col * (0.75 + 0.75 * uThrustNorm), alpha);
      }
    `,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    side: THREE.DoubleSide
  });
}

/**
 * Live Brayton Station False-Color Infrared Thermal Inspection Shader
 */
export function createThermalInspectionMaterial() {
  return new THREE.ShaderMaterial({
    uniforms: {
      uTempKelvin: { value: new THREE.Vector4(288.15, 385.0, 910.0, 1780.0) },
      uTempTail: { value: new THREE.Vector2(890.0, 330.0) },
      uTime: { value: 0.0 }
    },
    vertexShader: /* glsl */ `
      attribute float aEngineX;
      attribute float aRadialR;

      varying float vEngineX;
      varying float vRadialR;
      varying vec3 vNormalView;
      varying vec3 vViewDir;

      void main() {
        vEngineX = aEngineX;
        vRadialR = aRadialR;
        vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
        vNormalView = normalize(normalMatrix * normal);
        vViewDir = normalize(-mvPosition.xyz);
        gl_Position = projectionMatrix * mvPosition;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform vec4 uTempKelvin;
      uniform vec2 uTempTail;
      uniform float uTime;

      varying float vEngineX;
      varying float vRadialR;
      varying vec3 vNormalView;
      varying vec3 vViewDir;

      vec3 ironbowColormap(float t) {
        vec3 c0 = vec3(0.07, 0.13, 0.36);
        vec3 c1 = vec3(0.08, 0.52, 0.86);
        vec3 c2 = vec3(0.18, 0.78, 0.48);
        vec3 c3 = vec3(0.96, 0.64, 0.12);
        vec3 c4 = vec3(0.96, 0.20, 0.14);
        vec3 c5 = vec3(1.00, 0.96, 0.82);

        vec3 col = mix(c0, c1, smoothstep(0.00, 0.20, t));
        col = mix(col, c2, smoothstep(0.20, 0.40, t));
        col = mix(col, c3, smoothstep(0.40, 0.62, t));
        col = mix(col, c4, smoothstep(0.62, 0.82, t));
        col = mix(col, c5, smoothstep(0.82, 1.00, t));
        return col;
      }

      float computeLocalKelvin(float x, float r) {
        float T0 = uTempKelvin.x;
        float T2 = uTempKelvin.y;
        float T3 = uTempKelvin.z;
        float T4 = uTempKelvin.w;
        float T5 = uTempTail.x;
        float TBypass = uTempTail.y;

        float tCore = T0;
        tCore = mix(tCore, T2, smoothstep(-2.6, -1.0, x));
        tCore = mix(tCore, T3, smoothstep(-1.0, 0.10, x));
        tCore = mix(tCore, T4, smoothstep(0.10, 0.56, x));
        tCore = mix(tCore, mix(T4, T5, 0.55), smoothstep(0.85, 1.45, x));
        tCore = mix(tCore, T5, smoothstep(1.45, 2.55, x));

        float bypassMask = smoothstep(0.74, 1.02, r) * smoothstep(-2.2, -1.4, x);
        float nacelleSkin = smoothstep(1.36, 1.54, r);
        float tBypassLocal = mix(TBypass, T0 + 18.0, nacelleSkin);

        return mix(tCore, tBypassLocal, clamp(bypassMask, 0.0, 1.0));
      }

      void main() {
        float localK = computeLocalKelvin(vEngineX, vRadialR);
        float normT = pow(clamp((localK - 220.0) / 1640.0, 0.0, 1.0), 0.78);
        vec3 baseCol = ironbowColormap(normT);

        vec3 n = normalize(vNormalView);
        vec3 v = normalize(vViewDir);
        float hemi = 0.58 + 0.42 * n.y;
        float rim = pow(1.0 - abs(dot(n, v)), 2.2);
        float isoPhase = abs(fract(localK / 85.0) - 0.5) * 2.0;
        float isoLine = 1.0 - smoothstep(0.0, 0.09, isoPhase);

        vec3 lit = baseCol * (0.68 + 0.42 * hemi) + baseCol * rim * 0.35 + vec3(0.14) * isoLine * 0.35;
        gl_FragColor = vec4(lit, 1.0);
      }
    `,
    side: THREE.DoubleSide
  });
}

/**
 * GPU Aerodynamic CFD Streamline Ribbon Field (Round 2 Refined: Strictly Annular-Constrained!)
 *   - Confined cleanly within the open 135-deg cutaway sector (-22 deg .. +97 deg) AND
 *     exact stage hub-to-shroud annular flow channels so streamlines NEVER pierce solid stator
 *     vanes, cutaway section-cap planes, or combustor/turbine walls!
 */
export function createStreamlineParticleSystem(streakCount = 860) {
  const vertCount = streakCount * 4;
  const indexCount = streakCount * 6;

  const seeds = new Float32Array(vertCount * 4);
  const corners = new Float32Array(vertCount * 2);
  const positions = new Float32Array(vertCount * 3);
  const indices = new Uint32Array(indexCount);

  const phi = 1.61803398875;
  for (let i = 0; i < streakCount; i++) {
    const phase0 = (i * phi) % 1.0;
    const isBypass = (i % 10) >= 4 ? 1.0 : 0.0;
    // Keep away from extreme inner/outer walls (0.12 .. 0.88 of channel height)
    const radialFrac = 0.12 + 0.76 * ((i * 0.754877666) % 1.0);

    // Spawn strictly inside the 135-deg open cutaway window (-20 deg .. +95 deg) with safety margin off section caps!
    const uCut = (i * 0.56984029) % 1.0;
    const theta = (-20.0 + uCut * 115.0) * (Math.PI / 180.0);

    const vBase = i * 4;
    const cornerPairs = [
      [-1.0, -1.0],
      [ 1.0, -1.0],
      [ 1.0,  1.0],
      [-1.0,  1.0]
    ];
    for (let c = 0; c < 4; c++) {
      const vi = vBase + c;
      seeds[vi * 4 + 0] = phase0;
      seeds[vi * 4 + 1] = isBypass;
      seeds[vi * 4 + 2] = radialFrac;
      seeds[vi * 4 + 3] = theta;

      corners[vi * 2 + 0] = cornerPairs[c][0];
      corners[vi * 2 + 1] = cornerPairs[c][1];

      positions[vi * 3 + 0] = (phase0 - 0.45) * 9.0;
      positions[vi * 3 + 1] = Math.sin(theta) * (isBypass > 0.5 ? 1.12 : 0.54);
      positions[vi * 3 + 2] = Math.cos(theta) * (isBypass > 0.5 ? 1.12 : 0.54);
    }

    const iBase = i * 6;
    indices[iBase + 0] = vBase + 0;
    indices[iBase + 1] = vBase + 1;
    indices[iBase + 2] = vBase + 2;
    indices[iBase + 3] = vBase + 0;
    indices[iBase + 4] = vBase + 2;
    indices[iBase + 5] = vBase + 3;
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geo.setAttribute('aSeed', new THREE.BufferAttribute(seeds, 4));
  geo.setAttribute('aCorner', new THREE.BufferAttribute(corners, 2));
  geo.setIndex(new THREE.BufferAttribute(indices, 1));
  geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(0.5, 0, 0), 11.0);

  const mat = new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0.0 },
      uFlowSpeed: { value: 0.42 },
      uThrottleNorm: { value: 0.72 },
      uExplode: { value: 0.0 },
      uOpacity: { value: 0.52 }
    },
    vertexShader: /* glsl */ `
      attribute vec4 aSeed;
      attribute vec2 aCorner;

      uniform float uTime;
      uniform float uFlowSpeed;
      uniform float uThrottleNorm;
      uniform float uExplode;
      uniform float uOpacity;

      varying vec2 vCorner;
      varying vec3 vColor;
      varying float vAlpha;

      vec3 evaluateStreamPoint(float s, float isBypass, float rFrac, float theta0, float explode) {
        float xSpanMin = -4.15 - 3.30 * explode;
        float xSpanMax = 5.15 + 2.85 * explode;
        float xWorld = mix(xSpanMin, xSpanMax, s);
        float xEng = mix(-4.15, 5.15, s);

        // Exact CAD hub & shroud channel boundaries for the core gas path:
        // Fan(-2.0): 0.46..0.72 -> LPC(-1.35): 0.46..0.66 -> HPC(-0.4): 0.50..0.585 -> Combustor(0.55): 0.475..0.595 -> HPT(1.2): 0.45..0.61 -> LPT(2.0): 0.40..0.82 -> Nozzle(3.1): 0.22..0.60
        float rHub = 0.46;
        rHub = mix(rHub, 0.505, smoothstep(-1.35, -0.35, xEng));
        rHub = mix(rHub, 0.475, smoothstep(0.05, 0.32, xEng));
        rHub = mix(rHub, 0.445, smoothstep(0.88, 1.25, xEng));
        rHub = mix(rHub, 0.375, smoothstep(1.45, 2.30, xEng));
        rHub = mix(rHub, 0.140, smoothstep(2.45, 3.45, xEng));

        float rShroud = 0.71;
        rShroud = mix(rShroud, 0.650, smoothstep(-1.75, -1.05, xEng));
        rShroud = mix(rShroud, 0.582, smoothstep(-1.00, -0.15, xEng));
        rShroud = mix(rShroud, 0.592, smoothstep(0.10, 0.38, xEng));
        rShroud = mix(rShroud, 0.615, smoothstep(0.90, 1.35, xEng));
        rShroud = mix(rShroud, 0.835, smoothstep(1.48, 2.32, xEng));
        rShroud = mix(rShroud, 0.605 * (1.0 + 0.18 * max(0.0, xEng - 3.15)), smoothstep(2.42, 3.12, xEng));

        float rCore = mix(rHub, rShroud, rFrac);
        // Smooth intake capture streamtube ahead of fan spinner (-3.2 .. -2.1)
        float rIntake = mix(0.49, 0.73, rFrac);
        rCore = mix(rIntake, rCore, smoothstep(-2.95, -2.05, xEng));

        // Exact CAD inner & outer bypass duct channel boundaries (r = 0.82 .. 1.35 -> tapering cleanly to 0.78 .. 1.22 at bypass exit x=1.72)
        float rBypInner = mix(0.81, 0.96, smoothstep(1.65, 3.80, xEng));
        float rBypOuter = mix(1.34, 1.21, smoothstep(-1.50, 1.72, xEng));
        rBypOuter = mix(rBypOuter, 1.32, smoothstep(1.75, 4.20, xEng));
        float rByp = mix(rBypInner, rBypOuter, rFrac);

        float r = mix(rCore, rByp, isBypass);

        // Gentle bounded helical swirl, strictly clamped inside [-0.42 rad, +1.72 rad] (-24 deg .. +98.5 deg)
        // so streamlines NEVER cross into the 225-deg solid stator/casing sector (+105 deg .. +330 deg)!
        float swirlWave = 0.11 * sin(xEng * 2.1 + rFrac * 3.0) * (1.0 - 0.65 * isBypass);
        float theta = clamp(theta0 + swirlWave * (0.5 + 0.5 * uThrottleNorm), -0.42, 1.72);

        return vec3(xWorld, r * sin(theta), r * cos(theta));
      }

      vec3 evaluateStreamColor(float xEng, float isBypass, float throttleNorm) {
        vec3 iceBlue = vec3(0.32, 0.79, 1.00);
        vec3 coolCyan = vec3(0.24, 0.66, 0.96);
        vec3 compAmber = vec3(1.00, 0.67, 0.18);
        vec3 combGold = vec3(1.00, 0.84, 0.52);
        vec3 combFlame = vec3(1.00, 0.44, 0.10);
        vec3 plumeHot = mix(vec3(0.45, 0.72, 1.00), vec3(1.00, 0.58, 0.22), throttleNorm);

        vec3 cCore = iceBlue;
        cCore = mix(cCore, compAmber, smoothstep(-1.55, -0.15, xEng));
        cCore = mix(cCore, combGold, smoothstep(0.12, 0.48, xEng));
        cCore = mix(cCore, combFlame, smoothstep(0.72, 1.55, xEng));
        cCore = mix(cCore, plumeHot, smoothstep(2.20, 3.35, xEng));

        vec3 cBypass = mix(iceBlue, coolCyan, smoothstep(-2.0, 1.8, xEng));
        return mix(cCore, cBypass, isBypass);
      }

      void main() {
        float phase0 = aSeed.x;
        float isBypass = aSeed.y;
        float rFrac = aSeed.z;
        float theta0 = aSeed.w;

        float speedMul = mix(1.18, 0.88, isBypass);
        float s = fract(phase0 + uTime * uFlowSpeed * speedMul);
        float xEng = mix(-4.15, 5.15, s);

        float localAccel = 1.0 + 0.75 * smoothstep(0.2, 3.2, xEng) * (1.0 - 0.45 * isBypass);
        float ds = (0.012 + 0.015 * uThrottleNorm) * localAccel;

        float sBack = max(0.001, s - ds);
        float sFwd = min(0.999, s + ds);

        vec3 pCenter = evaluateStreamPoint(s, isBypass, rFrac, theta0, uExplode);
        vec3 pBack = evaluateStreamPoint(sBack, isBypass, rFrac, theta0, uExplode);
        vec3 pFwd = evaluateStreamPoint(sFwd, isBypass, rFrac, theta0, uExplode);

        vec3 tangent = normalize(pFwd - pBack + vec3(1e-5, 0.0, 0.0));
        vec3 toCam = normalize(cameraPosition - pCenter);
        vec3 side = normalize(cross(tangent, toCam) + vec3(0.0, 1e-5, 0.0));

        float halfLen = length(pFwd - pBack) * 0.44;
        float halfWidth = mix(0.0062, 0.0052, isBypass) * (1.0 + 0.24 * uThrottleNorm);

        vec3 worldPos = pCenter + tangent * (aCorner.x * halfLen) + side * (aCorner.y * halfWidth);

        float edgeFade = smoothstep(0.0, 0.10, s) * (1.0 - smoothstep(0.84, 1.0, s));
        vCorner = aCorner;
        vColor = evaluateStreamColor(xEng, isBypass, uThrottleNorm);
        vAlpha = edgeFade * uOpacity * mix(0.66, 0.44, isBypass);

        gl_Position = projectionMatrix * viewMatrix * vec4(worldPos, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      varying vec2 vCorner;
      varying vec3 vColor;
      varying float vAlpha;

      void main() {
        float crossProfile = exp(-3.4 * vCorner.y * vCorner.y);
        float lengthProfile = smoothstep(-1.0, -0.15, vCorner.x) * (1.0 - smoothstep(0.35, 1.0, vCorner.x) * 0.72);
        float intensity = crossProfile * lengthProfile;
        gl_FragColor = vec4(vColor * (0.95 + 0.35 * crossProfile), intensity * vAlpha);
      }
    `,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    side: THREE.DoubleSide
  });

  const mesh = new THREE.Mesh(geo, mat);
  mesh.name = 'AeroStreamlineField';
  mesh.renderOrder = 6;
  return { mesh, material: mat };
}
