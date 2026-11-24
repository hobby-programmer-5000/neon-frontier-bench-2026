# Kinetic Atelier — Track 5 Engineering Architecture Blueprint

**Target Directory:** `works/track-5-kinetic-cloth/`  
**Work Title:** `Kinetic Atelier — 3D Rube Goldberg + Live XPBD Cloth`  
**Pipeline:** `gemini-4-neon` (`high`, Orchestrator) → `gemini-4-hydrogen` (`xhigh`, Executor)  
**Physics Grounding:** Macklin, Müller & Chentanez (2016), *XPBD: Position-based simulation of compliant constrained dynamics* (`MIG '16`), coupled to a deterministic **120 Hz (`dt = 1/120 s`)** 8-stage rigid/constrained kinetic chain.

---

## 1. Module & File Architecture (Zero External CDNs / Assets)

All 8 files live exclusively inside `works/track-5-kinetic-cloth/`. Three.js (`v0.187.0`) loads locally via ES Module `<script type="importmap">`:

```html
<script type="importmap">
{
  "imports": {
    "three": "/node_modules/three/build/three.module.js",
    "three/addons/": "/node_modules/three/examples/jsm/"
  }
}
</script>
```

| File | Responsibility |
|---|---|
| `index.html` | Importmap, `<canvas id="viewport">`, minimal atelier header badge, collapsible right control drawer, bottom stage indicator + live Energy Sparkline `<canvas id="energy-sparkline">`. |
| `styles.css` | Warm espresso/walnut & brushed-brass editorial HUD (zero SaaS neon-purple cards). Auto-collapses control drawer at `@media (max-width: 920px)` to guarantee `0` HUD overlaps and `0` horizontal overflow at `1440×900` and `700×900`. |
| `textures.js` | Procedural `CanvasTexture` generators: dark walnut grain (+ bump), brushed machined brass (+ roughness), emerald woven silk with embroidered gold hem border, subtle retro 1980s arcade marquee silhouettes. |
| `audio.js` | Pure Web Audio API synth (lazy-created ONLY on explicit user gesture/button click — zero autoplay warnings): rolling steel hum, brass lever clink, 12 ascending mahogany domino clacks (`280 + i*24 Hz`), cradle steel ping, torsion spring twang, filtered-noise silk billow whoosh, harmonic D5 emerald-glass bell chime. |
| `xpbd-cloth.js` | `XPBDCloth` class (`24 × 16 = 384` particles, `Float32Array` zero-GC buffers, 4 solver iterations per `1/120 s` step, structural/shear/bending compliance, ambient breeze, sphere-vs-cloth impulse, wireframe constraint `LineSegments` debug overlay). |
| `physics.js` | `KineticSimulation` class: deterministic 120 Hz fixed-timestep 8-stage state machine, interactive Levers A & B, 12 dominoes, 5-sphere Newton's cradle, catapult launch, golden spark burst, and live mechanical energy ledger (`E_pot`, `E_kin`, `E_cloth`, `E_tot`). |
| `scene-builder.js` | Procedural Three.js r187 geometry & PBR lighting: 1980s dim arcade/atelier hall backdrop, `12 m × 4 m` walnut & brass workbench (`y = 0`), all 8 precision stage assemblies with exact pivot groups, `RoomEnvironment` PMREM reflections, and golden spark `InstancedMesh`. |
| `main.js` | WebGL2 renderer setup, shader pre-warm (`renderer.compile` + 2 warm-up frames), `OrbitControls`, camera preset switcher (`hero`, `macro`, `alt_mode`), 3D raycast click-to-toggle on Levers A & B, 120 Hz accumulator loop, sparkline renderer, and `window.__BENCH_META__` / `window.__BENCH_ACTIONS__`. |

---

## 2. Scene, Aesthetic & Lighting Budget (Three.js r187 Safe)

- **Renderer Config (Zero Warnings):**
  - `new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' })`
  - `renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))`
  - `renderer.outputColorSpace = THREE.SRGBColorSpace` *(never deprecated `outputEncoding`)*
  - `renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.15;`
  - `renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;`
  - Use `performance.now() * 0.001` for frame delta (clamped `<= 0.05 s`), never `useLegacyLights`.
  - Keep `depthWrite: true` on all opaque surfaces; never inject duplicate `onBeforeCompile` hooks.
- **Workbench (`y = 0.0` top surface):** `12.0 m` wide (`x ∈ [-6.0, +6.0]`), `4.0 m` deep (`z ∈ [-2.0, +2.0]`), `0.18 m` walnut slab (`y ∈ [-0.18, 0.0]`) framed by beveled machined-brass trim rails, engraved stage index plaques (`I`–`VIII`), and sturdy trestle legs down to hall floor (`y = -1.10 m`).
- **1980s Retro Arcade / Atelier Hall Backdrop:**
  - Deep moody charcoal-indigo ambient (`scene.background = new THREE.Color(0x0b0a10)`, `THREE.FogExp2(0x0b0a10, 0.036)`).
  - Far back wall (`z = -6.8 m`) lined with 7 low-poly silhouette 1980s arcade cabinets (`x = -7.5` to `+7.5`, angled slightly inward) with muted warm-amber, teal, and crimson procedural CRT/marquee glow strips (`emissiveIntensity: 0.55`, NOT overpowering soup!).
  - **Studio Lighting:** `PMREMGenerator` + `RoomEnvironment` (`scene.environmentIntensity = 0.42`) + `HemisphereLight(0xffe6c7, 0x1a1428, 0.45)` + 3 warm overhead studio spotlights (`SpotLight`, `0xfff1dc`, `intensity: 45`, `penumbra: 0.65`, `decay: 1.5`) aimed at `x = -3.8`, `x = +0.6`, and `x = +4.7` (only center + cloth/catapult spots cast `2048×2048` soft shadows) + subtle cool-emerald rim fill (`PointLight(0x28c78a, 4.5, 6.0)` near `(4.62, 1.4, -1.1)` to make the emerald silk sheen sing!).

---

## 3. Exact Deterministic 8-Stage Coordinate Chain (`y = 0` Bench Top, `z = 0` Primary Plane)

**Global Constants:** `g = 9.81 m/s²`, `dt = 1/120 s` (`0.0083333 s`), Marble 1 (steel) `R1 = 0.085 m`, `m1 = 0.080 kg`; Marble 2 (gold) `R2 = 0.110 m`, `m2 = 0.140 kg`.  
All track heights below are **surface contact `y`** (marble center sits at `y_surf + R` along local surface normal).

| Stage | Name | X Span (m) | Key Anchors `(x, y, z)` | Exact Entry → Exit / Handoff Condition |
|---|---|---|---|---|
| **1** | Dropper & Spiral Helix + Exit Chute | `[-5.22, -3.96]` | Hopper `(-4.80, 2.55, 0)`; Helix axis `(-4.80, y, -0.42)`, `r_h = 0.42`, 2 turns `θ ∈ [0, 4π]`; Chute `(-4.80, 1.32, 0) → (-3.96, 1.18, 0)` | Drop from `(-4.80, 2.40, 0)` into `θ=0` at `(-4.80, 2.20, 0)`. 1D curve-constrained rolling: `a_t = (5/7)*g*sin(α) - 0.45*v` (`sin α = 0.1645`, `L_helix = 5.3507 m`, `L_chute = 0.8516 m`). Exits at `(-3.96, 1.18, 0)` (`v ≈ 1.85 m/s`, `t ≈ 3.7 s`) → Stage 2. |
| **2** | Interactive Tilting Brass **Lever A** | `[-3.93, -2.57]` | Pivot `P_A = (-3.25, 0.96, 0)`, half-length `L_A = 0.68 m`, U-trough width `0.21 m` | Active resting `φ_A = -6°` (left `(-3.926, 1.031)` → right `(-2.574, 0.889)`). Marble coordinate `u ∈ [-0.68, +0.68]`: `a_u = -(5/7)*g*sin(φ_A) - 0.18*v_u`. Marble torque `τ = -14.0*u*cos(φ_A)` tips lever to `-16°` (right tip `(-2.596, 0.773)`). **User Hold mode (`+12°`):** traps marble at left stop `u = -0.60` until released. Exits at `u > +0.68` → Stage 3. |
| **3** | Terraced Ramp & Interactive **Lever B** | `[-2.58, -1.04]` | Ramp `(-2.58, 0.72, 0) → (-1.72, 0.42, 0)` (`L = 0.911 m`, `-19.2°`); Lever B pivot `P_B = (-1.38, 0.32, 0)`, `L_B = 0.34 m` | Marble rolls ramp onto Lever B (`φ_B = -10°`, left `(-1.715, 0.379)` → right `(-1.045, 0.261)`). Crossing `u_B > 0` in Active mode snaps `φ_B → -20°` (Hold mode `+14°`), firing Marble 1 at `vx = +2.15 m/s`, `y_c = 0.29 m` into Domino #0 (`x = -0.90`). On hit (`x >= -1.009`), triggers Domino #0 (`ω_0 = 4.2 rad/s`) and parks Marble 1 in recessed pocket `(-1.02, 0.085, 0)`. |
| **4** | 12-Piece Weighted **Domino Cascade** | `[-0.90, +1.96]` | 12 pieces (`i=0..11`), **exact spacing `d = 0.26 m`**, `x_i = -0.90 + i*0.26`; `H = 0.42`, `T = 0.048`, `W = 0.20 m` | Pivot group at `(x_i + T/2, 0, 0)`, child offset `(-T/2, H/2, 0)`, `rotation.z = -θ_i`. Gravity accel `α_i = (3g/(H²+T²))*((H/2)sin θ_i - (T/2)cos θ_i) - 0.35*ω_i`. Neighbor strike at **`θ_hit = asin((d-T)/H) = 0.5291 rad (30.32°)`**: triggers `i+1` with `ω_{i+1} = max(3.1, 0.90*ω_i)`, `ω_i *= 0.48`. Rest clamp: `θ_i <= min(1.28, θ_{i+1} + 0.165)` (`i < 11`), `θ_11 <= 1.32`. At `θ_11 >= 0.5585 rad (32°)`, tip `(2.207, 0.356)` strikes Cradle Sphere 0 (`Ω_0 = +2.75 rad/s`). |
| **5** | 5-Sphere Chrome **Newton's Cradle** | `[+2.20, +3.16]` | Brass arch `y_piv = 1.05 m`, `L_c = 0.72 m`, `r_c = 0.095 m`, `pitch = 0.192 m`; centers `x_ck = 2.30 + k*0.192` (`y_c = 0.330`) | Pendulum `dΩ_k/dt = -(g/L_c)sin ψ_k - 0.12*Ω_k`. Pairwise elastic impulse (`e = 0.985`, 2 passes/substep) whenever `x_{k+1} - x_k < 2*r_c` and `Ω_k > Ω_{k+1}` + positional separation. Sphere 4 swings to `ψ_4 >= +0.279 rad (+16°)` reaching right face `(3.362, 0.358, 0)` → strikes Catapult Trigger Sear at `(3.36, 0.35, 0)`. |
| **6** | Cocked Torsion **Brass Catapult** | `[+3.36, +4.15]` | Pivot `P_cat = (3.98, 0.30, 0)`, `L_arm = 0.44 m`; Cocked `α_cock = 162°` cup `(3.562, 0.436)`; Release `α_rel = 142°` cup `(3.633, 0.571)` | Torsion spring snaps arm CW (`d²α/dt² = -135 rad/s²`) from `162°` to stop-bar `142°` (`~0.10 s`), releasing Marble 2 at **exact verified velocity `v0 = 4.3785 m/s` (`vx = +2.6957`, `vy = +3.4503`, `elev = 52°`)**. Pure ballistic 120 Hz flight (`vy -= g*dt`): **Apex** `(4.581, 1.178)` at `t = 0.352 s`, **Cloth** `(4.620, 1.177)` at `t = 0.366 s`, **Funnel** `(5.440, 0.680)` at `t = 0.670 s`. |
| **7** | Live **XPBD Silk Cloth Banner** | `[+4.40, +4.84]` | Twin brass arch at `(4.62, 0, 0)` rotated **`-20°` around Y**; top rod `y = 1.82 m`, free hem `y = 0.94 m`, width `1.28 m` | `24 × 16` (`384`) XPBD particles (`Macklin et al. 2016`), 4 iterations per `1/120 s` step. Flying Marble 2 crosses `x = 4.62, y = 1.177` (lower-middle third), imparting one-way collision + momentum billow (`R_col = 0.148 m`) so silk billows dramatically (`+0.50 m`) and parts cleanly around the sphere without deflecting it off-target! |
| **8** | Brass Funnel → **Emerald Glass Bell** | `[+5.20, +5.68]` | Funnel rim `(5.44, 0.68, 0)` (`r = 0.24 m`) → spout `y = 0.44 m`; Emerald Glass & Brass Bell crown `(5.44, 0.34, 0)` | At `x >= 5.24` & descending into funnel (`y <= 0.68`), Marble 2 spirals inward (`0.18 s`), drops onto Bell crown (`y = 0.34`), triggers bell damped oscillation (`exp(-2.8t)sin(42t)`), emissive emerald glow, harmonic D5 chime, and **96-particle Golden Spark Burst**, then settles in velvet dish `(5.44, 0.11, 0.28)`. Holds `3.0 s` before optional auto-reset. |

### 3.1 Exact Sub-Step State Machine (`physics.js`, `dt = 1/120 s`)

To guarantee **zero derailment and zero missed collisions**, Marble 1 and Marble 2 advance through explicit deterministic phases:

1. **`S1_DROP` → `S1_HELIX` → `S1_CHUTE` → `S1_TO_LEVER_A`:**
   - `S1_DROP`: `vy -= g*dt; y += vy*dt` from `(-4.80, 2.40, 0)` until `y <= 2.20 + R1` → enter `S1_HELIX` (`s = 0`, `v = 0.40`).
   - `S1_HELIX` (`0 <= s < 5.3507`): `θ = 4π * (s / 5.3507)`, `x = -4.80 + 0.42*sin(θ)`, `y = 2.20 - 0.88*(s/5.3507) + R1`, `z = -0.42 + 0.42*cos(θ)`. Integrate `v += ((5/7)*g*0.1645 - 0.45*v)*dt; s += v*dt`.
   - `S1_CHUTE` (`5.3507 <= s < 6.2023`): linear lerp from `(-4.80, 1.32, 0)` to `(-3.96, 1.18, 0)` with `+R1` along normal `(0.1644, 0.9864, 0)`. At `s >= 6.2023`, enter `S1_TO_LEVER_A` with `(vx, vy) = (v*0.9864, -v*0.1644)`.
   - `S1_TO_LEVER_A`: free ballistic fall (`vy -= g*dt`) until Marble 1 crosses Lever A surface line `y_line(x) = 0.96 + (x + 3.25)*tan(φ_A) + R1`. Project onto lever local coordinate `u = clamp((x + 3.25)/cos(φ_A), -0.62, +0.62)`, `v_u = max(0.8, vx*cos(φ_A))`, fire lever clink audio, enter `S2_LEVER_A`.
2. **`S2_LEVER_A` → `S2_TO_RAMP` → `S3_RAMP` → `S3_LEVER_B` → `S3_LAUNCH`:**
   - `S2_LEVER_A`: Lever angle spring-damper `α_A = 42*(φ_A_target - φ_A) - 7.5*ω_A + τ_marble`, where `τ_marble = -14.0 * u * cos(φ_A)` in Active mode (clamped `φ_A ∈ [-0.30, +0.24]`). Marble slides `v_u += (-(5/7)*g*sin(φ_A) - 0.18*v_u)*dt; u += v_u*dt`. If `u < -0.60`, clamp `u = -0.60; v_u = max(0, -0.25*v_u)` (safe catch bumper!). If `u > +0.68`, exit into `S2_TO_RAMP` ballistic transfer (`vx = max(1.1, v_u*cos(φ_A))`) until contacting Stage 3 Ramp line `y_ramp(x) = 0.72 - 0.3488*(x + 2.58) + R1` → enter `S3_RAMP`.
   - `S3_RAMP`: 1D rolling along ramp `s_r ∈ [0, 0.911]` (`a = (5/7)*g*0.329 - 0.15*v`), entering `S3_LEVER_B` at `u_B = -0.32`.
   - `S3_LEVER_B`: Same lever physics (`P_B = (-1.38, 0.32)`, `L_B = 0.34`, Active target `-10°`, boost `-20°` when `u_B > 0`, Hold `+14°`). Exiting `u_B > +0.34` enters `S3_LAUNCH` with `vx = Math.max(2.15, v_u*cos(φ_B))`, `vy = v_u*sin(φ_B)`.
   - `S3_LAUNCH`: When `x >= -1.009`, trigger Domino #0 (`ω_0 = 4.2`), set `stage = 4`, rebound Marble 1 cleanly into recessed brass catch pocket `(-1.02, 0.085, 0)` (`S4_DOMINOES`).
3. **`S4_DOMINOES` → `S5_CRADLE` → `S6_CATAPULT` → `S7_FLIGHT` → `S8_FUNNEL_BELL`:**
   - Each stage runs continuously inside `step(dt)` (dominoes keep settling during Stage 5, Newton's cradle keeps oscillating during Stage 6–8, XPBD cloth runs EVERY substep from `t = 0`!).
   - Visual rolling spin: `marble1Mesh.rotation.z -= (v_signed * dt) / R1`; `marble2Mesh.rotation.z -= (vx2 * dt) / R2`.
   - Golden Spark Burst (`96` instances in `InstancedMesh`): spawned at `(5.44, 0.34, 0)` on bell impact with radial speed `1.2–3.4 m/s`, upward bias `vy ∈ [1.4, 3.8]`, gravity `-7.5 m/s²`, scale fading `(1 - age/life)` over `1.4 s`, warm additive gold emissive material.

### 3.2 Mechanical Energy Conservation Ledger (Live Sparkline)
Compute every frame (in Joules, relative to bench `y = 0`):
- `E_pot = m1*g*max(0, y1) + m2*g*max(0, y2) + Σ_i m_dom*g*(H/2)*cos(θ_i) + Σ_k m_cradle*g*L_c*(1 - cos(ψ_k)) + E_spring` (where `E_spring = 1.35 J` while catapult is cocked, linearly releasing to `0` as arm snaps `162° → 142°`).
- `E_kin = 0.7*m1*v1² + 0.5*m2*v2² + Σ_i 0.5*I_dom*ω_i² + Σ_k 0.5*m_cradle*(L_c*Ω_k)²` (factor `0.7 = 1/2 + 1/5` for rolling solid sphere).
- `E_cloth = Σ_{n=0}^{383} 0.5 * 0.004 * |vel_n|²` (scaled ×10 visually on sparkline or plotted on dedicated emerald trace so cloth wave energy peaks visibly during Stage 7!).
- `E_tot = E_pot + E_kin + E_cloth`. Push `{ E_tot, E_kin, E_pot, E_cloth }` into a 140-sample ring buffer rendered onto `#energy-sparkline` at 30 Hz.

### 3.3 Procedural PBR Material Palette (Anti-AI-Slop Craft)
- **Dark Walnut Bench:** `MeshStandardMaterial({ map: walnutTex, bumpMap: walnutBump, bumpScale: 0.015, roughness: 0.58, metalness: 0.04 })`.
- **Machined Brushed Brass (Tracks, Levers, Catapult, Arches):** `MeshStandardMaterial({ color: 0xd4a853, map: brassTex, roughnessMap: brassRough, metalness: 0.88, roughness: 0.26 })`.
- **Chrome Steel (Marble 1, Cradle Spheres):** `MeshStandardMaterial({ color: 0xe8edf2, metalness: 0.96, roughness: 0.09 })`.
- **Machined Gold (Marble 2):** `MeshStandardMaterial({ color: 0xf4c44e, metalness: 0.94, roughness: 0.14 })`.
- **Weighted Mahogany Dominoes:** `MeshStandardMaterial({ color: 0x5c2216, roughness: 0.42, metalness: 0.08 })` with machined brass base weight & top cap strips.
- **Emerald Silk Cloth:** `MeshPhysicalMaterial({ color: 0x0b6e4f, map: silkTex, side: THREE.DoubleSide, sheen: 0.92, sheenColor: new THREE.Color(0x52ffb8), sheenRoughness: 0.30, roughness: 0.44, metalness: 0.05 })`.
- **Emerald Glass & Brass Bell:** `MeshPhysicalMaterial({ color: 0x10b981, emissive: 0x05402b, emissiveIntensity: 0.35, metalness: 0.12, roughness: 0.12, clearcoat: 1.0, clearcoatRoughness: 0.08 })` (pulse `emissiveIntensity` up to `2.2` on bell strike!).

---

## 4. Real-Time XPBD Cloth Solver Specification (`xpbd-cloth.js`)

- **Topology:** `NX = 24`, `NY = 16` (`N = 384` particles, `690` triangles). Flat `Float32Array` buffers: `pos[3N]`, `prevPos[3N]`, `vel[3N]`, `invMass[N]`.
  - Top row (`j = 0`): `invMass = 0` (pinned along top brass bar rotated `-20°` around Y: `u = (i / 23 - 0.5) * 1.28`, `x = 4.62 - u * Math.sin(20 * Math.PI / 180)`, `y = 1.82`, `z = u * Math.cos(20 * Math.PI / 180)`, opening the front silk face cleanly toward the front-left `hero` and `macro` cameras).
  - Free nodes (`j = 1..15`): `invMass = 250.0` (`m_node = 0.004 kg`), rest grid `du = 1.28/23 = 0.05565 m`, `dv = 0.88/15 = 0.05867 m`.
- **Constraints (`C = |p_a - p_b| - L_0`):**
  1. **Structural** (`(i,j)-(i+1,j)` & `(i,j)-(i,j+1)`): `α_dist = 1.5e-5`
  2. **Shear** (`(i,j)-(i+1,j+1)` & `(i+1,j)-(i,j+1)`): `α_shear = 8.0e-5`
  3. **Bending** (2-hop `(i,j)-(i+2,j)` & `(i,j)-(i,j+2)`): `α_bend = 3.5e-2` *(gives `α̃ = α/dt² ≈ 504` vs `wA+wB = 500` for supple, flowing silk folds rather than stiff cardboard)*
- **Per-Substep (`dt = 1/120 s`) Algorithm:**
  1. **Predict:** Add gravity `(0, -9.81, 0)` + gentle ambient breeze (`windStrength * (0.45 + 0.35*sin(1.9*t + 2.8*z) + 0.20*cos(3.1*t - 2.1*y))` along cloth normal `(0.9397, 0, 0.3420)`). Semi-implicit Euler: `vel = (vel + a*dt) * 0.994`; `prevPos = pos`; `pos += vel*dt`.
  2. **Project (4 iterations):** Zero `lambda[]` once per `1/120 s` step. For each constraint `c`:
     ```js
     const alphaTilde = alpha / (dt * dt);
     const dLambda = (-C - alphaTilde * lambda[c]) / (wA + wB + alphaTilde);
     lambda[c] += dLambda;
     // apply posA += wA * (d / len) * dLambda; posB -= wB * (d / len) * dLambda;
     ```
  3. **Sphere-vs-Cloth Collision Impulse (Active when Marble 2 is airborne):**
     - `R_col = 0.148 m`. For each free node `k`: if `dist = |pos_k - spherePos| < R_col`:
       - Project `pos_k = spherePos + (diff / max(dist, 1e-5)) * R_col`
       - Momentum transfer: `prevPos_k -= sphereVel * dt * 0.42` (creates vivid silk billowing & parting wave!)
       - Bench floor safety clamp: `pos_k.y = Math.max(0.06, pos_k.y)`.
  4. **Velocity Finalize:** `vel = clamp((pos - prevPos) / dt, -12, 12)`. Once per render frame, sync `BufferGeometry` positions & call `computeVertexNormals()`, plus update the optional `LineSegments` wireframe constraint mesh when `clothWireframe === true`.

---

## 5. Shader Pre-Warm, Camera Presets, HUD & Benchmark Harness Contract

### 5.1 Zero-Stutter Shader Pre-Warm (`@spvn` Guardrail)
Before setting `window.__BENCH_META__.ready = true`:
1. Make sure all materials (including spark `InstancedMesh` and wireframe cloth overlay) are briefly `visible = true` for compilation.
2. Measure `t0 = performance.now()`, call `renderer.compile(scene, camera)`, render **2 full warm-up frames**, restore default visibility of debug wireframe, record `shaderPrewarmMs = +(performance.now() - t0).toFixed(1)`.
3. Auto-start the simulation on boot (Stage 1 marble already released at `t = 0` + ambient breeze active on cloth) so `hero` immediately displays live motion!

### 5.2 Camera Presets & `window.__BENCH_ACTIONS__`
- **`hero`:** `pos: (-0.4, 3.35, 8.35)`, `target: (0.25, 0.85, 0.0)`, `fov: 40`, `clothWireframe = false`, `followCam = false`. Frames entire 12m bench, arcade hall glow, and emerald silk banner.
- **`macro`:** `pos: (3.35, 1.55, 2.55)`, `target: (4.65, 1.05, 0.0)`, `fov: 38`, `clothWireframe = false`. Tight exhibition close-up on Cocked Brass Catapult + shimmering XPBD Emerald Silk Banner + Brass Funnel & Emerald Bell.
- **`alt_mode`:** Enables **XPBD Wireframe Constraint Overlay** (`clothWireframe = true`, crisp gold/mint constraint mesh over translucent silk) + **Action Follow-Cam** tracking the active marble (defaulting cleanly to `(3.75, 1.72, 2.75) → (4.72, 1.08, 0.0)` during Stage 6–8 so the cloth deformation + spark burst fill the frame!).
- **`triggerAction(name)`:**
  - `"demo"` *(called by `qa/run_qa.mjs` right after `setView("alt_mode")`, followed by a `900 ms` wait!)*: Immediately advances/sets the simulation cleanly to **Stage 6 Catapult Launch** (all prior dominoes toppled, cradle fired, catapult snapping right now at `t = 0` → golden sphere pierces & billows the XPBD silk banner at `t ≈ 0.45 s` → strikes the Emerald Bell & fires the 96-spark burst right at `t ≈ 0.85–0.90 s` while the cloth is STILL dramatically billowing with visible wireframe constraints!). Returns `"demo: catapult launched through XPBD silk -> bell chime"`.
  - `"reset"`, `"leverA"`, `"leverB"`, `"windBurst"`, `"wireframe"`, `"launch"`: interactive manual controls returning short status strings.

### 5.3 Responsive Anti-AI-Slop HUD (`0` Overlaps at `1440×900` & `700×900`)
- **Top-Left Title Plaquette (`[data-hud-card]`):** Compact walnut/brass border (`max-width: 260px`), serif title `KINETIC ATELIER`, subtitle `120 Hz Rigid + XPBD Silk`, live stage pill (`STAGE 1/8 · SPIRAL HELIX`).
- **Top-Right Control Drawer (`[data-hud-card]`, width `248px`):** Toggleable via a single top-right button (`Controls`). **Auto-collapsed by default when `window.innerWidth <= 920`** (and on `resize`!) so at `700×900` ONLY the compact title badge, `Controls` toggle button, and bottom stage/sparkline bar are visible — guaranteeing **`hudNarrow.overlaps === 0`** and **`overflowX === false`**!
- **Controls inside Drawer:** Play/Pause, Reset, Launch Catapult, Lever A Toggle (`[1]`), Lever B Toggle (`[2]`), Auto-Levers checkbox, Camera Pills (`Hero` / `Macro` / `XPBD Wire`), Breeze Strength slider, Audio Mute/Unmute button.
- **Bottom-Left Compact Energy Conservation Sparkline (`[data-hud-card]`, `240×68px`):** Live `<canvas>` plotting `E_total` (gold), `E_kinetic` (amber), `E_potential` (brass), and `E_cloth` (emerald) in real time with `tabular-nums` Joules readout.

### 5.4 Exact `window.__BENCH_META__` Contract
```js
window.__BENCH_META__ = {
  id: "track-5-kinetic-cloth",
  title: "Kinetic Atelier — 3D Rube Goldberg + Live XPBD Cloth",
  domain: "120 Hz Rigid Mechanics & Real-Time XPBD Cloth",
  model: "gemini-4-neon+hydrogen",
  effort: "high->xhigh",
  technique: "Orchestrator-to-Executor Pipeline",
  ready: false,           // true ONLY after shader pre-warm + 2 frames
  bootMs: 0,
  shaderPrewarmMs: 0,
  drawCalls: 0,           // renderer.info.render.calls
  triangles: 0,           // renderer.info.render.triangles
  fps: 0,                 // EMA smoothed FPS
  telemetry: {
    stage: 1,             // 1..8
    stageName: "Spiral Helix",
    simTimeSec: 0,
    fixedHz: 120,
    xpbdIterations: 4,
    clothNodes: 384,
    clothMaxBillowM: 0,
    totalEnergyJ: 0,
    leverAMode: "AUTO",
    leverBMode: "AUTO",
    viewMode: "hero"
  }
};
```
