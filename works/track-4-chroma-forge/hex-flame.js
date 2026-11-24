// ============================================================================
// Mode A: GPU Hex-Voxel Curl-Noise Flame & Ethereal Smoke Sculpture (R2)
// Bridson et al. 2007 Analytical Curl-Noise Advection + Hexagonal Lattice
// Ultra-Fast Unrolled Analytical Derivative Curl (<50ms Compile, Zero Loops)
// + ACES Filmic Tonemapping with Razor-Sharp Core Hexagonal Cell Facets
// ============================================================================

const VERTEX_SHADER_SRC = `#version 300 es
precision highp float;

layout(location = 0) in vec2 a_pos;
out vec2 v_uv;

void main() {
  v_uv = a_pos * 0.5 + 0.5;
  gl_Position = vec4(a_pos, 0.0, 1.0);
}
`;

// Strict GLSL Hygiene: Zero early returns, zero loops -> instant D3D11 ANGLE compile
const FRAGMENT_SHADER_SRC = `#version 300 es
precision highp float;

in vec2 v_uv;
out vec4 fragColor;

uniform vec2 u_res;
uniform float u_time;
uniform float u_speed;
uniform float u_turbulence;
uniform float u_viscosity;
uniform float u_flameSize;
uniform float u_sparks;
uniform float u_ambientGlow;
uniform float u_hexScale;
uniform float u_zoom;
uniform int u_paletteMode;
uniform vec4 u_pointer;     // xy = normalized coords (-aspect..aspect, -1..1), zw = velocity
uniform float u_impulse;    // thermal vortex pulse boost

// Fast deterministic scalar hash
float hash21(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}

// Analytical 2D Value Noise with exact partial derivatives (Quilez)
// Returns: x = noise value (-1..1), y = dNoise/dx, z = dNoise/dy
vec3 noised(vec2 x) {
  vec2 i = floor(x);
  vec2 f = fract(x);

  // Quintic interpolation u and analytical derivative du
  vec2 u = f * f * f * (f * (f * 6.0 - 15.0) + 10.0);
  vec2 du = 30.0 * f * f * (f * (f - 2.0) + 1.0);

  float a = hash21(i + vec2(0.0, 0.0)) * 2.0 - 1.0;
  float b = hash21(i + vec2(1.0, 0.0)) * 2.0 - 1.0;
  float c = hash21(i + vec2(0.0, 1.0)) * 2.0 - 1.0;
  float d = hash21(i + vec2(1.0, 1.0)) * 2.0 - 1.0;

  float k0 = a;
  float k1 = b - a;
  float k2 = c - a;
  float k3 = a - b - c + d;

  float val = k0 + k1 * u.x + k2 * u.y + k3 * u.x * u.y;
  vec2 grad = du * vec2(k1 + k3 * u.y, k2 + k3 * u.x);
  return vec3(val, grad);
}

// Bridson et al. 2007 Analytical 2-Octave Curl & Potential (Zero Loops!)
// Returns: x = potential Psi, yz = divergence-free curl velocity (dPsi/dy, -dPsi/dx)
vec3 analyticalCurl2(vec2 p, float t) {
  vec2 p1 = p + vec2(t * 0.16, -t * 0.54);
  vec3 n1 = noised(p1);

  // 2nd octave rotated & scaled (chain-rule Jacobian applied to gradient)
  mat2 m = mat2(0.80, -0.60, 0.60, 0.80);
  vec2 p2 = (m * p) * 2.15 + vec2(-t * 0.28, -t * 0.92);
  vec3 n2 = noised(p2);
  vec2 g2 = vec2(
    0.80 * n2.y + 0.60 * n2.z,
   -0.60 * n2.y + 0.80 * n2.z
  ) * 2.15;

  float psi = n1.x * 0.65 + n2.x * 0.35;
  vec2 gradPsi = n1.yz * 0.65 + g2 * 0.35;
  vec2 curlV = vec2(gradPsi.y, -gradPsi.x);

  return vec3(psi, curlV);
}

// Analytical Hexagonal Grid Decomposition
// Returns: xy = hex center in world space, z = hex edge SDF (0 at center, 1 at border), w = cell hash ID
vec4 hexGrid(vec2 p, float scale) {
  const vec2 s = vec2(1.0, 1.7320508);
  vec2 sp = p * scale;

  vec4 hC = floor(vec4(sp, sp - vec2(0.5, 1.0)) / s.xyxy) + 0.5;
  vec4 hP = vec4(sp - hC.xy * s, sp - (hC.zw + 0.5) * s);

  bool pickFirst = dot(hP.xy, hP.xy) < dot(hP.zw, hP.zw);
  vec2 localP = pickFirst ? hP.xy : hP.zw;
  vec2 cellId = pickFirst ? hC.xy : hC.zw + 0.5;

  vec2 worldCenter = (sp - localP) / scale;
  vec2 ap = abs(localP);
  float hexDist = max(ap.x * 0.8660254 + ap.y * 0.5, ap.y) * 2.0;
  float idHash = hash21(cellId * 1.17 + vec2(19.3, 47.1));

  return vec4(worldCenter, hexDist, idHash);
}

// Calibrated HDR Blackbody & Studio Palettes (prevents core white blowout)
vec3 evaluatePalette(float temp, int mode) {
  float t = clamp(temp, 0.0, 1.25);
  vec3 col = vec3(0.0);

  if (mode == 1) {
    // Preset 2: Argon Plasma (Deep Indigo -> Violet -> Electric Cobalt -> Cyan Core)
    vec3 c0 = vec3(0.025, 0.028, 0.055);
    vec3 c1 = vec3(0.22, 0.06, 0.54);
    vec3 c2 = vec3(0.06, 0.46, 0.96);
    vec3 c3 = vec3(0.24, 0.86, 1.00);
    vec3 c4 = vec3(0.82, 0.96, 1.00);
    vec3 m1 = mix(c0, c1, smoothstep(0.02, 0.28, t));
    vec3 m2 = mix(m1, c2, smoothstep(0.24, 0.56, t));
    vec3 m3 = mix(m2, c3, smoothstep(0.52, 0.86, t));
    col = mix(m3, c4, smoothstep(0.84, 1.22, t));
  } else if (mode == 2) {
    // Preset 3: Ethereal Silk (II - Smoke: Rose Titanium -> Champagne Gold -> Pearl)
    vec3 c0 = vec3(0.035, 0.035, 0.052);
    vec3 c1 = vec3(0.30, 0.14, 0.22);
    vec3 c2 = vec3(0.74, 0.42, 0.24);
    vec3 c3 = vec3(0.95, 0.74, 0.46);
    vec3 c4 = vec3(0.98, 0.92, 0.82);
    vec3 m1 = mix(c0, c1, smoothstep(0.02, 0.26, t));
    vec3 m2 = mix(m1, c2, smoothstep(0.22, 0.55, t));
    vec3 m3 = mix(m2, c3, smoothstep(0.50, 0.84, t));
    col = mix(m3, c4, smoothstep(0.82, 1.18, t));
  } else if (mode == 3) {
    // Preset 4: Obsidian Ember (Basalt -> Deep Crimson -> Magma Orange -> Amber Core)
    vec3 c0 = vec3(0.018, 0.018, 0.026);
    vec3 c1 = vec3(0.36, 0.02, 0.01);
    vec3 c2 = vec3(0.84, 0.14, 0.02);
    vec3 c3 = vec3(0.98, 0.50, 0.04);
    vec3 c4 = vec3(1.00, 0.86, 0.52);
    vec3 m1 = mix(c0, c1, smoothstep(0.05, 0.34, t));
    vec3 m2 = mix(m1, c2, smoothstep(0.30, 0.64, t));
    vec3 m3 = mix(m2, c3, smoothstep(0.60, 0.90, t));
    col = mix(m3, c4, smoothstep(0.86, 1.22, t));
  } else {
    // Preset 1 (Default): Solar Forge Planckian Blackbody (Crimson -> Vermilion -> Molten Amber -> Solar Gold)
    vec3 c0 = vec3(0.032, 0.032, 0.042);
    vec3 c1 = vec3(0.38, 0.035, 0.015);
    vec3 c2 = vec3(0.86, 0.18, 0.03);
    vec3 c3 = vec3(0.98, 0.54, 0.07);
    vec3 c4 = vec3(1.00, 0.89, 0.62);
    vec3 m1 = mix(c0, c1, smoothstep(0.03, 0.28, t));
    vec3 m2 = mix(m1, c2, smoothstep(0.24, 0.56, t));
    vec3 m3 = mix(m2, c3, smoothstep(0.52, 0.85, t));
    col = mix(m3, c4, smoothstep(0.82, 1.20, t));
  }

  return col;
}

// Compute Advected Flame Thermal Field + Smoke Ribbon Density in one fast pass
// Returns: x = flame temperature, y = smoke ribbon density
vec2 sampleFlameAndSmoke(vec2 pos, float t, float turb, float visc, float sizeScale, vec4 ptr, float impulse) {
  vec2 toPtr = pos - ptr.xy;
  float ptrDist2 = dot(toPtr, toPtr);
  float ptrInfluence = exp(-ptrDist2 * 8.0);
  vec2 vortexSwirl = vec2(-toPtr.y, toPtr.x) * (1.1 + impulse * 1.6) * ptrInfluence;
  vec2 dragPush = ptr.zw * 0.50 * ptrInfluence;

  // Stage 1: Analytical Curl-Noise Lagrangian Back-Advection
  vec2 q0 = pos - dragPush - vortexSwirl * 0.16;
  vec3 c1 = analyticalCurl2(q0 * 1.75 + vec2(0.0, -t * 0.85), t * 0.85);
  vec2 advP = q0 + c1.yz * (0.20 * turb);

  // Stage 2: Fine curl octave
  vec3 c2 = analyticalCurl2(advP * 3.20 + vec2(0.0, -t * 1.40), t * 1.25);
  vec2 fineP = advP + c2.yz * (0.10 * turb);

  // Plume envelope geometry
  float yNorm = clamp((fineP.y + 0.88) * 0.56, 0.0, 1.4);
  float plumeWidth = mix(0.45, 0.085, pow(clamp(yNorm * 0.78, 0.0, 1.0), 0.75)) * sizeScale;

  float spineWave = c1.x * 0.18 * turb * yNorm;
  float radialDist = abs(fineP.x - spineWave);

  float coreMask = smoothstep(plumeWidth * 1.42, plumeWidth * 0.14, radialDist);
  float verticalDecay = smoothstep(-0.92, -0.58, fineP.y) * (1.0 - smoothstep(0.24, 0.95 * sizeScale, fineP.y));

  float tongues = smoothstep(-0.35, 0.55, c2.x + coreMask * 0.68 - yNorm * 0.26);
  float hearthCore = exp(-dot(fineP - vec2(0.0, -0.56), fineP - vec2(0.0, -0.56)) * (5.6 / (sizeScale * sizeScale)));
  float ptrHeat = ptrInfluence * (0.34 + impulse * 0.40);

  float thermal = clamp(coreMask * verticalDecay * (0.68 + 0.60 * tongues) + hearthCore * 0.56 + ptrHeat, 0.0, 1.22);

  // Ethereal Swirling Smoke-Ribbon Field ("II - Smoke" tribute) from analytical curl streamfunction
  vec2 sWarp = pos + c1.yz * (0.28 * turb / max(0.35, visc));
  float psiStream = c1.x * 0.7 + c2.x * 0.3;
  float ribbonA = exp(-abs(sin(psiStream * 8.5 + sWarp.y * 3.0 - t * 0.85)) * (3.0 * visc + 1.35));
  float ribbonB = exp(-abs(cos(psiStream * 5.5 - sWarp.x * 3.8 + t * 0.55)) * (3.6 * visc + 1.15));
  float envX = exp(-sWarp.x * sWarp.x * 2.0);
  float envY = smoothstep(-0.78, -0.15, pos.y) * smoothstep(1.15, 0.12, pos.y);
  float smoke = clamp((ribbonA * 0.65 + ribbonB * 0.42) * envX * envY, 0.0, 1.0);

  return vec2(thermal, smoke);
}

// Stephen Hill ACES Fitted Filmic Tonemapping Curve
vec3 acesTonemap(vec3 x) {
  const float a = 2.51;
  const float b = 0.03;
  const float c = 2.43;
  const float d = 0.59;
  const float e = 0.14;
  return clamp((x * (a * x + b)) / (x * (c * x + d) + e), 0.0, 1.0);
}

void main() {
  float aspect = u_res.x / max(u_res.y, 1.0);
  vec2 p = (v_uv * 2.0 - 1.0) * vec2(aspect, 1.0);

  vec2 focalOffset = (u_zoom > 1.2) ? vec2(0.0, -0.14) : vec2(0.0, 0.0);
  vec2 worldP = p / max(u_zoom, 0.5) + focalOffset;

  float t = u_time * u_speed;

  // 1. Evaluate Analytical Hexagonal Lattice at worldP
  vec4 hex = hexGrid(worldP, u_hexScale);
  vec2 hexCenter = hex.xy;
  float hexEdge = hex.z;      // 0.0 at hex centroid -> 1.0 at hex boundary
  float cellRand = hex.w;     // 0..1 per-cell deterministic variation

  // 2. Quantized Hex-Voxel Thermal Field (at hexCenter) + Continuous Sub-Hex Field
  vec2 hexField = sampleFlameAndSmoke(hexCenter, t, u_turbulence, u_viscosity, u_flameSize, u_pointer, u_impulse);
  vec2 contField = sampleFlameAndSmoke(worldP, t, u_turbulence, u_viscosity, u_flameSize, u_pointer, u_impulse);

  float T_hex = hexField.x;
  float T_cont = contField.x;
  float smokeDensity = contField.y;

  // Per-cell discrete temperature modulation so every hex tile in the hot core has distinct contrast
  float cellVariation = 0.84 + 0.30 * sin(t * 3.8 + cellRand * 6.28318);
  float T_voxel = T_hex * cellVariation;

  // 3. Discrete Rising Hex Spark Particles
  vec2 sparkGridP = hexCenter * vec2(1.0, 0.65) + vec2(sin(t * 0.8 + cellRand * 12.0) * 0.14, -t * 0.55);
  vec4 sparkHex = hexGrid(sparkGridP, u_hexScale * 0.62);
  float sparkSeed = sparkHex.w;
  float sparkLife = fract(sparkSeed * 13.7 + t * (0.45 + 0.35 * sparkSeed));
  float sparkEnvelope = exp(-hexCenter.x * hexCenter.x * 4.2) * smoothstep(-0.55, 0.80, hexCenter.y);
  float isSpark = step(0.955 - 0.032 * clamp(u_sparks, 0.0, 2.0), sparkSeed)
                * sin(sparkLife * 3.14159)
                * sparkEnvelope
                * clamp(u_sparks, 0.0, 2.0);

  // 4. Crisp Hexagonal Voxel Facet Geometry (Preserved even in hottest core!)
  // Dark inter-hex mortar channel (hexEdge: 0.86..1.0) + machined chamfer bevel ring (0.64..0.86)
  float mortarMask = smoothstep(0.95, 0.84, hexEdge);
  float bevelRing = smoothstep(0.62, 0.83, hexEdge) * mortarMask;
  float innerGroove = smoothstep(0.54, 0.68, hexEdge) * (1.0 - smoothstep(0.68, 0.82, hexEdge));
  float innerDome = 1.0 - 0.32 * hexEdge * hexEdge;

  // Directional 3D facet normal on each hex cell
  vec2 localOffset = (worldP - hexCenter) * u_hexScale;
  vec2 lightDir = normalize(vec2(0.0, -0.38) - hexCenter + 0.0001);
  float facetDirLight = clamp(dot(normalize(localOffset + 0.0001), lightDir), -0.6, 1.0);
  float bevelSpec = max(0.0, facetDirLight) * bevelRing;

  // 5. Cold Architectural Honeycomb Base
  vec3 bgBase = vec3(0.034, 0.038, 0.048) * (0.62 + 0.38 * innerDome) * mortarMask;

  // 6. Voxel Flame Emission with Distinct Facet Relief & Dark Inter-Hex Channels
  float effectiveTemp = clamp(T_voxel * innerDome * (1.0 - 0.24 * innerGroove) + isSpark * 0.85, 0.0, 1.22);
  vec3 voxelColor = evaluatePalette(effectiveTemp, u_paletteMode);

  // Directional 3D bevel shading on hot hex tiles (bright windward bevel, dark leeward bevel + dark mortar gap)
  vec3 facetShadedVoxel = voxelColor * (0.86 + 0.26 * facetDirLight * bevelRing - 0.22 * innerGroove);
  // Keep mortar gap dark-amber/indigo (never white!) so every hexagon outline stays razor-sharp in the core
  vec3 coreMortarColor = evaluatePalette(clamp(T_hex * 0.42, 0.0, 0.55), u_paletteMode) * 0.38;

  float activeHexMask = smoothstep(0.05, 0.22, effectiveTemp);
  vec3 ambientTint = evaluatePalette(0.50, u_paletteMode);
  vec3 litHoneycomb = bgBase
                    + ambientTint * (bevelSpec * 0.22 * u_ambientGlow)
                    + evaluatePalette(T_cont * 0.48, u_paletteMode) * (0.14 * u_ambientGlow * mortarMask);

  vec3 hotHexTile = mix(coreMortarColor, facetShadedVoxel, mortarMask);
  hotHexTile += evaluatePalette(effectiveTemp + 0.16, u_paletteMode) * (bevelSpec * 0.32);

  vec3 hexLayer = mix(litHoneycomb, hotHexTile, activeHexMask);

  // 7. Ethereal Swirling Smoke-Ribbon Overlay (Attenuated over hot core to preserve crisp hex facets)
  float smokeBoost = (u_paletteMode == 2) ? 1.45 : 0.82;
  vec3 smokeBaseTint = (u_paletteMode == 1)
    ? vec3(0.38, 0.64, 0.92)
    : vec3(0.72, 0.68, 0.64);
  vec3 smokeLit = mix(smokeBaseTint * 0.24, evaluatePalette(clamp(T_cont * 0.72 + 0.18, 0.12, 0.88), u_paletteMode), clamp(T_cont * 0.95 + 0.15, 0.0, 1.0));

  // Protect the hot hexagonal core from smoke washout
  float coreClarityGuard = 1.0 - smoothstep(0.38, 0.78, T_voxel) * 0.75;
  float smokeAlpha = clamp(smokeDensity * smokeBoost * 0.52 * coreClarityGuard, 0.0, 0.72);

  vec3 hdrColor = mix(hexLayer, smokeLit + hexLayer * 0.35, smokeAlpha);

  // Subtle ambient glow halo outside the core (masked away from mortar lines inside the core)
  vec3 outerHalo = evaluatePalette(T_cont * 0.62, u_paletteMode)
                 * pow(clamp(T_cont, 0.0, 0.85), 2.2)
                 * (0.20 * u_ambientGlow * (0.35 + 0.65 * mortarMask));
  hdrColor += outerHalo;

  // 8. Calibrated Exposure + ACES Filmic Tonemapping + Gallery Vignette
  vec3 mapped = acesTonemap(hdrColor * 0.88);
  float vig = 1.0 - dot(v_uv - 0.5, v_uv - 0.5) * 0.34;
  mapped *= clamp(vig, 0.74, 1.0);

  // Gamma 2.2 Output
  mapped = pow(max(mapped, vec3(0.0)), vec3(1.0 / 2.2));
  fragColor = vec4(mapped, 1.0);
}
`;

export const FLAME_PRESETS = {
  solar_forge: {
    id: 'solar_forge',
    label: 'SOLAR FORGE',
    paletteMode: 0,
    speed: 1.00,
    turbulence: 1.15,
    viscosity: 0.85,
    flameSize: 1.08,
    sparks: 1.15,
    ambientGlow: 1.05,
    hexScale: 44,
    zoom: 1.0,
    peakTempK: '4,820 K',
    spectrumCSS: 'linear-gradient(90deg, #0d0c10 0%, #5c0a06 24%, #d92e09 50%, #ff9319 76%, #fff8dc 100%)',
    formula: '=ACES(PLANCK_BB(CURL_ANALYTIC_2D(HEX_AXIAL(q,r), ∇×Ψ, dt) + SPARK_HEX + SMOKE_RIBBON))'
  },
  argon_plasma: {
    id: 'argon_plasma',
    label: 'ARGON PLASMA',
    paletteMode: 1,
    speed: 1.25,
    turbulence: 1.65,
    viscosity: 0.65,
    flameSize: 1.22,
    sparks: 1.60,
    ambientGlow: 1.25,
    hexScale: 34,
    zoom: 1.55,
    peakTempK: '9,640 K',
    spectrumCSS: 'linear-gradient(90deg, #070810 0%, #3d108e 26%, #1484fc 54%, #61f0ff 80%, #f5fdff 100%)',
    formula: '=ACES(ARGON_ION_LUT(CURL_MACRO_ZOOM(HEX_AXIAL(q,r), 1.55x, Ψ_TURB=1.65) + ARC_SPARKS))'
  },
  ethereal_silk: {
    id: 'ethereal_silk',
    label: 'ETHEREAL SILK',
    paletteMode: 2,
    speed: 0.80,
    turbulence: 1.30,
    viscosity: 0.45,
    flameSize: 1.00,
    sparks: 0.60,
    ambientGlow: 1.15,
    hexScale: 52,
    zoom: 1.0,
    peakTempK: '3,650 K',
    spectrumCSS: 'linear-gradient(90deg, #0b0b10 0%, #52293d 28%, #c27347 56%, #f5c78a 80%, #fff7eb 100%)',
    formula: '=ACES(SMOKE_RIBBON_2D(∇×Ψ(x,y,t), VISC=0.45) + HEX_EMBER_SCATTER(HEX_AXIAL(q,r)))'
  },
  obsidian_ember: {
    id: 'obsidian_ember',
    label: 'OBSIDIAN EMBER',
    paletteMode: 3,
    speed: 0.95,
    turbulence: 1.40,
    viscosity: 1.15,
    flameSize: 0.95,
    sparks: 1.85,
    ambientGlow: 0.90,
    hexScale: 40,
    zoom: 1.05,
    peakTempK: '4,150 K',
    spectrumCSS: 'linear-gradient(90deg, #050508 0%, #610502 30%, #db2405 58%, #ff850d 82%, #ffedb3 100%)',
    formula: '=ACES(BASALT_HEX_SDF(q,r) + MAGMA_FACET_BEVEL(∇×Ψ) + BUOYANT_SPARK_CASCADE(1.85))'
  }
};

export class HexFlameEngine {
  constructor(canvas) {
    this.canvas = canvas;
    this.gl = canvas.getContext('webgl2', {
      alpha: false,
      depth: false,
      stencil: false,
      antialias: false,
      powerPreference: 'high-performance',
      preserveDrawingBuffer: true
    });

    this.params = { ...FLAME_PRESETS.solar_forge };
    this.activePreset = 'solar_forge';
    this.time = 0;
    this.pointer = { x: 0.0, y: -0.22, vx: 0.0, vy: 0.0, active: false };
    this.impulse = 0.0;
    this.prewarmMs = 0;
    this.hexCountEstimate = 4200;

    this._initGL();
    this._bindPointer();
  }

  _compileShader(type, source) {
    const gl = this.gl;
    const shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      const log = gl.getShaderInfoLog(shader);
      gl.deleteShader(shader);
      throw new Error(`WebGL2 Shader Compile Error: ${log}`);
    }
    return shader;
  }

  _initGL() {
    const gl = this.gl;
    if (!gl) {
      throw new Error('WebGL2 is required for ChromaForge Mode A.');
    }

    const t0 = performance.now();

    const vs = this._compileShader(gl.VERTEX_SHADER, VERTEX_SHADER_SRC);
    const fs = this._compileShader(gl.FRAGMENT_SHADER, FRAGMENT_SHADER_SRC);

    const prog = gl.createProgram();
    gl.attachShader(prog, vs);
    gl.attachShader(prog, fs);
    gl.linkProgram(prog);

    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
      const log = gl.getProgramInfoLog(prog);
      throw new Error(`WebGL2 Program Link Error: ${log}`);
    }

    gl.deleteShader(vs);
    gl.deleteShader(fs);
    this.program = prog;

    this.vao = gl.createVertexArray();
    gl.bindVertexArray(this.vao);

    const quadVerts = new Float32Array([
      -1.0, -1.0,
       1.0, -1.0,
      -1.0,  1.0,
       1.0,  1.0
    ]);
    const vbo = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
    gl.bufferData(gl.ARRAY_BUFFER, quadVerts, gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
    gl.bindVertexArray(null);

    this.uniforms = {
      res: gl.getUniformLocation(prog, 'u_res'),
      time: gl.getUniformLocation(prog, 'u_time'),
      speed: gl.getUniformLocation(prog, 'u_speed'),
      turbulence: gl.getUniformLocation(prog, 'u_turbulence'),
      viscosity: gl.getUniformLocation(prog, 'u_viscosity'),
      flameSize: gl.getUniformLocation(prog, 'u_flameSize'),
      sparks: gl.getUniformLocation(prog, 'u_sparks'),
      ambientGlow: gl.getUniformLocation(prog, 'u_ambientGlow'),
      hexScale: gl.getUniformLocation(prog, 'u_hexScale'),
      zoom: gl.getUniformLocation(prog, 'u_zoom'),
      paletteMode: gl.getUniformLocation(prog, 'u_paletteMode'),
      pointer: gl.getUniformLocation(prog, 'u_pointer'),
      impulse: gl.getUniformLocation(prog, 'u_impulse')
    };

    // Fast non-blocking 2-frame shader pre-warm (no blocking gl.finish stall)
    this.resize();
    this.params.paletteMode = 1;
    this.render(0.016);
    this.params.paletteMode = 0;
    this.render(0.016);
    gl.flush();

    this.prewarmMs = Number((performance.now() - t0).toFixed(2));
  }

  _bindPointer() {
    const updatePointer = (clientX, clientY) => {
      const rect = this.canvas.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) return;
      const nx = (clientX - rect.left) / rect.width;
      const ny = 1.0 - (clientY - rect.top) / rect.height;
      const aspect = rect.width / Math.max(rect.height, 1);

      const wx = (nx * 2.0 - 1.0) * aspect;
      const wy = ny * 2.0 - 1.0;

      this.pointer.vx = Math.max(-2.5, Math.min(2.5, (wx - this.pointer.x) * 14.0));
      this.pointer.vy = Math.max(-2.5, Math.min(2.5, (wy - this.pointer.y) * 14.0));
      this.pointer.x = wx;
      this.pointer.y = wy;
      this.pointer.active = true;
      this.impulse = Math.min(1.5, this.impulse + 0.08);
    };

    this.canvas.addEventListener('pointerdown', (e) => {
      updatePointer(e.clientX, e.clientY);
      this.triggerImpulse(1.15);
    });

    this.canvas.addEventListener('pointermove', (e) => {
      updatePointer(e.clientX, e.clientY);
    });
  }

  triggerImpulse(amount = 1.2) {
    this.impulse = Math.min(1.8, this.impulse + amount);
  }

  applyPreset(presetKey) {
    const p = FLAME_PRESETS[presetKey];
    if (!p) return false;
    this.activePreset = presetKey;
    Object.assign(this.params, p);
    this._updateHexEstimate();
    return true;
  }

  _updateHexEstimate() {
    const aspect = (this.canvas.width || 1200) / Math.max(this.canvas.height || 800, 1);
    const s = this.params.hexScale / Math.max(this.params.zoom, 0.5);
    this.hexCountEstimate = Math.round(s * s * aspect * 2.3);
  }

  resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const rect = this.canvas.getBoundingClientRect();
    const w = Math.max(320, Math.floor((rect.width || 960) * dpr));
    const h = Math.max(240, Math.floor((rect.height || 720) * dpr));

    if (this.canvas.width !== w || this.canvas.height !== h) {
      this.canvas.width = w;
      this.canvas.height = h;
    }
    this._updateHexEstimate();
  }

  render(dt) {
    const gl = this.gl;
    if (!gl || !this.program) return;

    this.time += dt;
    this.pointer.vx *= 0.90;
    this.pointer.vy *= 0.90;
    this.impulse *= 0.93;

    if (!this.pointer.active) {
      this.pointer.x = Math.sin(this.time * 0.75) * 0.22;
      this.pointer.y = -0.22 + Math.cos(this.time * 0.55) * 0.14;
    }

    gl.viewport(0, 0, this.canvas.width, this.canvas.height);
    gl.useProgram(this.program);
    gl.bindVertexArray(this.vao);

    const u = this.uniforms;
    gl.uniform2f(u.res, this.canvas.width, this.canvas.height);
    gl.uniform1f(u.time, this.time);
    gl.uniform1f(u.speed, this.params.speed);
    gl.uniform1f(u.turbulence, this.params.turbulence);
    gl.uniform1f(u.viscosity, this.params.viscosity);
    gl.uniform1f(u.flameSize, this.params.flameSize);
    gl.uniform1f(u.sparks, this.params.sparks);
    gl.uniform1f(u.ambientGlow, this.params.ambientGlow);
    gl.uniform1f(u.hexScale, this.params.hexScale);
    gl.uniform1f(u.zoom, this.params.zoom);
    gl.uniform1i(u.paletteMode, this.params.paletteMode);
    gl.uniform4f(u.pointer, this.pointer.x, this.pointer.y, this.pointer.vx, this.pointer.vy);
    gl.uniform1f(u.impulse, this.impulse);

    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    gl.bindVertexArray(null);
  }
}
