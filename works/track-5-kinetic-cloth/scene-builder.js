import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import {
  createWalnutTextures,
  createAtelierFloorTextures,
  createWainscotTexture,
  createBrassTextures,
  createSilkTexture,
  createContactShadowTexture,
  createSparkSpriteTexture,
  createPlaquesAtlasTexture,
  createArcadeAtlasTextures,
} from './textures.js';
import {
  R1,
  R2,
  DOM_COUNT,
  DOM_SPACING,
  DOM_X0,
  DOM_H,
  DOM_T,
  DOM_W,
  CRADLE_COUNT,
  CRADLE_Y_PIV,
  CRADLE_L,
  CRADLE_R,
  CRADLE_PITCH,
  CRADLE_X0,
  CAT_PIVOT,
  CAT_ARM_L,
  SPARK_COUNT,
} from './physics.js';

function remapAtlasUV(geom, idx, cols, rows) {
  const col = idx % cols;
  const row = Math.floor(idx / cols);
  const uMin = col / cols;
  const uSpan = 1 / cols;
  const vMax = 1 - row / rows;
  const vSpan = 1 / rows;
  const vMin = vMax - vSpan;

  const uv = geom.attributes.uv;
  for (let i = 0; i < uv.count; i++) {
    uv.setXY(i, uMin + uv.getX(i) * uSpan, vMin + uv.getY(i) * vSpan);
  }
  uv.needsUpdate = true;
}

function createRailPair(points, halfGap, radius, material, parent) {
  const curve = new THREE.CatmullRomCurve3(points);
  const segs = Math.min(88, Math.max(12, points.length * 2));
  const frames = curve.computeFrenetFrames(segs, false);

  const leftPts = [];
  const rightPts = [];
  const up = new THREE.Vector3(0, 1, 0);
  const side = new THREE.Vector3();

  for (let i = 0; i <= segs; i++) {
    const t = i / segs;
    const p = curve.getPointAt(t);
    const tangent = frames.tangents[i];
    side.crossVectors(tangent, up);
    if (side.lengthSq() < 1e-4) side.set(0, 0, 1);
    else side.normalize();

    leftPts.push(p.clone().addScaledVector(side, -halfGap));
    rightPts.push(p.clone().addScaledVector(side, halfGap));
  }

  for (const railPts of [leftPts, rightPts]) {
    const railCurve = new THREE.CatmullRomCurve3(railPts);
    const geom = new THREE.TubeGeometry(railCurve, segs, radius, 7, false);
    const mesh = new THREE.Mesh(geom, material);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    parent.add(mesh);
  }
}

function createVolumetricConeMaterial() {
  return new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.FrontSide,
    uniforms: {
      uColor: { value: new THREE.Color(0xffe7c2) },
      uIntensity: { value: 0.095 },
    },
    vertexShader: `
      varying vec2 vUv;
      varying vec3 vNormalView;
      varying vec3 vViewPos;
      void main() {
        vUv = uv;
        vec4 mvPos = modelViewMatrix * vec4(position, 1.0);
        vViewPos = -mvPos.xyz;
        vNormalView = normalize(normalMatrix * normal);
        gl_Position = projectionMatrix * mvPos;
      }
    `,
    fragmentShader: `
      uniform vec3 uColor;
      uniform float uIntensity;
      varying vec2 vUv;
      varying vec3 vNormalView;
      varying vec3 vViewPos;
      void main() {
        vec3 n = normalize(vNormalView);
        vec3 v = normalize(vViewPos);
        float edgeFade = pow(max(0.0, abs(dot(n, v))), 1.55);
        float axialFade = smoothstep(0.0, 0.35, vUv.y) * smoothstep(1.0, 0.85, vUv.y);
        float alpha = edgeFade * axialFade * uIntensity;
        gl_FragColor = vec4(uColor, alpha);
      }
    `,
  });
}

export function buildKineticScene(renderer, sim) {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x0b0a10);
  scene.fog = new THREE.FogExp2(0x0b0a10, 0.032);

  // PMREM studio reflections via RoomEnvironment
  const pmrem = new THREE.PMREMGenerator(renderer);
  const roomEnv = new RoomEnvironment();
  const envTarget = pmrem.fromScene(roomEnv, 0.04);
  scene.environment = envTarget.texture;
  scene.environmentIntensity = 0.42;
  roomEnv.dispose();
  pmrem.dispose();

  // Studio & Moody Atelier Lighting
  const hemi = new THREE.HemisphereLight(0xffe6c7, 0x261d2b, 0.64);
  scene.add(hemi);

  const spotSpecs = [
    { pos: [-3.8, 4.3, 1.8], target: [-3.8, 0.7, 0], shadow: false, fov: 48 },
    { pos: [0.6, 4.4, 1.9], target: [0.6, 0.4, 0], shadow: true, fov: 52 },
    { pos: [4.7, 4.3, 1.8], target: [4.7, 0.9, 0], shadow: true, fov: 50 },
  ];

  const pendantGroup = new THREE.Group();
  scene.add(pendantGroup);
  const coneMat = createVolumetricConeMaterial();

  // Procedural PBR Materials
  const { map: walnutMap, roughnessMap: walnutRough, bumpMap: walnutBump } = createWalnutTextures();
  const { map: floorMap } = createAtelierFloorTextures();
  const wainscotMap = createWainscotTexture();
  const { map: brassMap, roughnessMap: brassRough } = createBrassTextures();
  const silkTex = createSilkTexture();
  const contactShadowTex = createContactShadowTexture();
  const sparkSpriteTex = createSparkSpriteTexture();

  const walnutMat = new THREE.MeshStandardMaterial({
    map: walnutMap,
    roughnessMap: walnutRough,
    bumpMap: walnutBump,
    bumpScale: 0.015,
    roughness: 0.56,
    metalness: 0.05,
  });

  const brassMat = new THREE.MeshStandardMaterial({
    color: 0xd4a853,
    map: brassMap,
    roughnessMap: brassRough,
    metalness: 0.88,
    roughness: 0.26,
  });

  const darkBrassMat = new THREE.MeshStandardMaterial({
    color: 0x7c5d26,
    map: brassMap,
    roughnessMap: brassRough,
    metalness: 0.84,
    roughness: 0.36,
  });

  const steelMat = new THREE.MeshStandardMaterial({
    color: 0xe8edf2,
    metalness: 0.96,
    roughness: 0.09,
  });

  const goldMat = new THREE.MeshStandardMaterial({
    color: 0xf4c44e,
    metalness: 0.94,
    roughness: 0.14,
  });

  const mahoganyMat = new THREE.MeshStandardMaterial({
    color: 0x5c2216,
    roughness: 0.42,
    metalness: 0.08,
  });

  const velvetMat = new THREE.MeshStandardMaterial({
    color: 0x16382b,
    roughness: 0.92,
    metalness: 0.02,
  });

  const silkMat = new THREE.MeshPhysicalMaterial({
    color: 0x0b6e4f,
    map: silkTex,
    side: THREE.DoubleSide,
    sheen: 0.92,
    sheenColor: new THREE.Color(0x52ffb8),
    sheenRoughness: 0.3,
    roughness: 0.44,
    metalness: 0.05,
  });

  const bellMat = new THREE.MeshPhysicalMaterial({
    color: 0x10b981,
    emissive: 0x05402b,
    emissiveIntensity: 0.35,
    metalness: 0.12,
    roughness: 0.12,
    clearcoat: 1.0,
    clearcoatRoughness: 0.08,
    side: THREE.DoubleSide,
  });

  const shadeMat = new THREE.MeshStandardMaterial({
    color: 0x1c1715,
    roughness: 0.45,
    metalness: 0.65,
    side: THREE.DoubleSide,
  });
  const bulbMat = new THREE.MeshBasicMaterial({ color: 0xffe4b5 });

  // Overhead Spotlights + Volumetric Light Cones + Spun Pendant Shades
  for (const s of spotSpecs) {
    const spot = new THREE.SpotLight(0xfff1dc, 46, 18, Math.PI / 4, 0.65, 1.5);
    spot.position.set(s.pos[0], s.pos[1], s.pos[2]);
    spot.target.position.set(s.target[0], s.target[1], s.target[2]);
    if (s.shadow) {
      spot.castShadow = true;
      spot.shadow.mapSize.set(768, 768);
      spot.shadow.bias = -0.0005;
      spot.shadow.normalBias = 0.015;
      spot.shadow.camera.near = 1.5;
      spot.shadow.camera.far = 14.0;
      spot.shadow.camera.fov = s.fov;
    }
    scene.add(spot);
    scene.add(spot.target);

    // Pendant hood & glowing bulb oriented toward spot target
    const sPos = new THREE.Vector3(...s.pos);
    const tPos = new THREE.Vector3(...s.target);
    const dir = tPos.clone().sub(sPos).normalize();
    const quat = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, -1, 0), dir);

    const hood = new THREE.Mesh(new THREE.ConeGeometry(0.24, 0.28, 14, 1, true), shadeMat);
    hood.position.copy(sPos);
    hood.quaternion.copy(quat);
    scene.add(hood);

    const cord = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 1.8, 6), darkBrassMat);
    cord.position.set(s.pos[0], s.pos[1] + 0.9, s.pos[2]);
    scene.add(cord);

    const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.055, 8, 6), bulbMat);
    bulb.position.copy(sPos).addScaledVector(dir, 0.08);
    scene.add(bulb);

    // Sleek volumetric spotlight cone (transparent, depthWrite: false)
    const coneLen = 3.85;
    const coneGeom = new THREE.CylinderGeometry(0.16, 1.28, coneLen, 16, 1, true);
    const cone = new THREE.Mesh(coneGeom, coneMat);
    cone.position.copy(sPos).addScaledVector(dir, coneLen * 0.5 + 0.14);
    cone.quaternion.copy(quat);
    pendantGroup.add(cone);
  }

  // Cool emerald rim fill to illuminate silk sheen
  const emeraldRim = new THREE.PointLight(0x28c78a, 4.8, 6.5);
  emeraldRim.position.set(4.62, 1.4, -1.1);
  scene.add(emeraldRim);

  // 1. Grounded Workshop-Arcade Room Backdrop
  const hallGroup = new THREE.Group();
  scene.add(hallGroup);

  const floorMat = new THREE.MeshStandardMaterial({
    map: floorMap,
    roughness: 0.74,
    metalness: 0.14,
  });
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(24, 18), floorMat);
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = -1.10;
  floor.receiveShadow = true;
  hallGroup.add(floor);

  // Upper plaster wall + lower wood wainscoting + baseboard trim
  const upperWallMat = new THREE.MeshStandardMaterial({
    color: 0x13111c,
    roughness: 0.90,
    metalness: 0.06,
  });
  const upperWall = new THREE.Mesh(new THREE.PlaneGeometry(32, 7.2), upperWallMat);
  upperWall.position.set(0, 4.05, -6.80);
  hallGroup.add(upperWall);

  const wainscotMat = new THREE.MeshStandardMaterial({
    map: wainscotMap,
    roughness: 0.64,
    metalness: 0.08,
  });
  const wainscot = new THREE.Mesh(new THREE.PlaneGeometry(32, 1.55), wainscotMat);
  wainscot.position.set(0, -0.325, -6.78);
  hallGroup.add(wainscot);

  const baseboard = new THREE.Mesh(new THREE.BoxGeometry(32, 0.16, 0.08), walnutMat);
  baseboard.position.set(0, -1.02, -6.74);
  hallGroup.add(baseboard);

  const dado = new THREE.Mesh(new THREE.BoxGeometry(32, 0.10, 0.12), darkBrassMat);
  dado.position.set(0, 0.45, -6.73);
  hallGroup.add(dado);

  // Architectural wall pilasters framing the arcade cabinets
  for (let px = -8.4; px <= 8.5; px += 2.4) {
    const pilaster = new THREE.Mesh(new THREE.BoxGeometry(0.22, 6.2, 0.12), walnutMat);
    pilaster.position.set(px, 2.0, -6.74);
    hallGroup.add(pilaster);
  }

  // Contact shadow collector for grounded bench stages, trestle legs & arcade cabinets
  const contactShadowGeoms = [];
  const addContactShadow = (x, y, z, sx, sz, rotY = 0) => {
    const g = new THREE.PlaneGeometry(sx, sz);
    g.rotateX(-Math.PI / 2);
    if (rotY !== 0) g.rotateY(rotY);
    g.translate(x, y, z);
    contactShadowGeoms.push(g);
  };

  // 7 Grounded 1980s Retro Arcade Cabinets along back wall (Atlas-batched!)
  const cabBodyMat = new THREE.MeshStandardMaterial({
    color: 0x191522,
    roughness: 0.62,
    metalness: 0.22,
  });
  const cabTrimMat = new THREE.MeshStandardMaterial({
    color: 0x332a40,
    roughness: 0.46,
    metalness: 0.38,
  });

  const { marqueeAtlas, screenAtlas, cols: aCols, rows: aRows } = createArcadeAtlasTextures();
  const screenAtlasMat = new THREE.MeshStandardMaterial({
    color: 0x070b12,
    map: screenAtlas,
    emissiveMap: screenAtlas,
    emissive: 0xffffff,
    emissiveIntensity: 0.48,
    roughness: 0.72,
    metalness: 0.02,
  });
  const marqueeAtlasMat = new THREE.MeshStandardMaterial({
    map: marqueeAtlas,
    emissiveMap: marqueeAtlas,
    emissive: 0xffffff,
    emissiveIntensity: 0.56,
    roughness: 0.3,
    metalness: 0.05,
  });

  for (let i = 0; i < 7; i++) {
    const x = -7.2 + i * 2.4;
    const yaw = (0 - x) * 0.032;
    const cab = new THREE.Group();
    cab.position.set(x, -1.10, -5.85);
    cab.rotation.y = yaw;

    // Grounding kick-plate plinth
    const kick = new THREE.Mesh(new THREE.BoxGeometry(0.90, 0.08, 0.82), darkBrassMat);
    kick.position.y = 0.04;
    cab.add(kick);

    const base = new THREE.Mesh(new THREE.BoxGeometry(0.86, 1.00, 0.78), cabBodyMat);
    base.position.y = 0.54;
    cab.add(base);

    const deck = new THREE.Mesh(new THREE.BoxGeometry(0.88, 0.10, 0.90), cabTrimMat);
    deck.position.set(0, 1.09, 0.06);
    cab.add(deck);

    const upper = new THREE.Mesh(new THREE.BoxGeometry(0.86, 0.95, 0.64), cabBodyMat);
    upper.position.set(0, 1.56, -0.07);
    cab.add(upper);

    const screenGeom = new THREE.PlaneGeometry(0.68, 0.54);
    remapAtlasUV(screenGeom, i, aCols, aRows);
    const screen = new THREE.Mesh(screenGeom, screenAtlasMat);
    screen.position.set(0, 1.48, 0.255);
    screen.rotation.x = -0.22;
    cab.add(screen);

    const marqueeGeom = new THREE.PlaneGeometry(0.76, 0.24);
    remapAtlasUV(marqueeGeom, i, aCols, aRows);
    const marquee = new THREE.Mesh(marqueeGeom, marqueeAtlasMat);
    marquee.position.set(0, 1.93, 0.275);
    marquee.rotation.x = 0.18;
    cab.add(marquee);

    hallGroup.add(cab);
    addContactShadow(x, -1.097, -5.85, 1.35, 1.25, yaw);
  }

  // 2. Walnut & Brushed Brass Workbench (top y = 0.0)
  const benchGroup = new THREE.Group();
  scene.add(benchGroup);

  const slab = new THREE.Mesh(new THREE.BoxGeometry(12.0, 0.18, 4.0), walnutMat);
  slab.position.set(0, -0.09, 0);
  slab.receiveShadow = true;
  slab.castShadow = true;
  benchGroup.add(slab);

  const frontRail = new THREE.Mesh(new THREE.BoxGeometry(12.08, 0.075, 0.045), brassMat);
  frontRail.position.set(0, -0.02, 2.02);
  benchGroup.add(frontRail);

  const backRail = new THREE.Mesh(new THREE.BoxGeometry(12.08, 0.075, 0.045), brassMat);
  backRail.position.set(0, -0.02, -2.02);
  benchGroup.add(backRail);

  const leftRail = new THREE.Mesh(new THREE.BoxGeometry(0.045, 0.075, 4.04), brassMat);
  leftRail.position.set(-6.02, -0.02, 0);
  benchGroup.add(leftRail);

  const rightRail = new THREE.Mesh(new THREE.BoxGeometry(0.045, 0.075, 4.04), brassMat);
  rightRail.position.set(6.02, -0.02, 0);
  benchGroup.add(rightRail);

  const datumLine = new THREE.Mesh(new THREE.BoxGeometry(11.4, 0.004, 0.018), darkBrassMat);
  datumLine.position.set(0, 0.001, 0);
  datumLine.receiveShadow = true;
  benchGroup.add(datumLine);

  // 4 Trestle Legs down to y = -1.10 m + cross stretchers + floor contact shadows
  for (const lx of [-5.1, 5.1]) {
    for (const lz of [-1.45, 1.45]) {
      const leg = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.92, 0.18), walnutMat);
      leg.position.set(lx, -0.64, lz);
      leg.castShadow = true;
      benchGroup.add(leg);

      const shoe = new THREE.Mesh(new THREE.BoxGeometry(0.20, 0.09, 0.20), brassMat);
      shoe.position.set(lx, -1.055, lz);
      benchGroup.add(shoe);

      addContactShadow(lx, -1.097, lz, 0.56, 0.56);
    }
    const crossZ = new THREE.Mesh(new THREE.BoxGeometry(0.10, 0.10, 2.9), walnutMat);
    crossZ.position.set(lx, -0.82, 0);
    benchGroup.add(crossZ);
  }
  const longStretcher = new THREE.Mesh(new THREE.BoxGeometry(10.2, 0.09, 0.11), darkBrassMat);
  longStretcher.position.set(0, -0.82, 0);
  benchGroup.add(longStretcher);

  // Engraved Stage Index Plaques (I - VIII) packed into 1 single atlas texture
  const plaqueData = [
    [-4.6, 'I', 'Helix'],
    [-3.25, 'II', 'Lever A'],
    [-1.75, 'III', 'Lever B'],
    [0.5, 'IV', 'Dominoes'],
    [2.68, 'V', 'Cradle'],
    [3.76, 'VI', 'Catapult'],
    [4.62, 'VII', 'XPBD Silk'],
    [5.44, 'VIII', 'Bell'],
  ];
  const plaqueAtlasTex = createPlaquesAtlasTexture(plaqueData);
  const plaqueAtlasMat = new THREE.MeshStandardMaterial({
    map: plaqueAtlasTex,
    roughness: 0.35,
    metalness: 0.65,
  });
  plaqueData.forEach(([px], idx) => {
    const frame = new THREE.Mesh(new THREE.BoxGeometry(0.47, 0.022, 0.18), darkBrassMat);
    frame.position.set(px, 0.011, 1.84);
    frame.rotation.x = 0.22;
    benchGroup.add(frame);

    const faceGeom = new THREE.PlaneGeometry(0.45, 0.168);
    remapAtlasUV(faceGeom, idx, 4, 2);
    const face = new THREE.Mesh(faceGeom, plaqueAtlasMat);
    face.position.set(px, 0.023, 1.842);
    face.rotation.x = -Math.PI / 2 + 0.22;
    benchGroup.add(face);
    addContactShadow(px, 0.002, 1.84, 0.56, 0.26);
  });

  // 3. Stage 1: Dropper Hopper + Spiral Helix + Exit Chute
  const stage1Group = new THREE.Group();
  scene.add(stage1Group);

  const hopperPts = [
    new THREE.Vector2(0.095, 0.0),
    new THREE.Vector2(0.11, 0.08),
    new THREE.Vector2(0.24, 0.28),
    new THREE.Vector2(0.25, 0.32),
  ];
  const hopper = new THREE.Mesh(new THREE.LatheGeometry(hopperPts, 24), brassMat);
  hopper.position.set(-4.80, 2.40, 0);
  hopper.castShadow = true;
  stage1Group.add(hopper);

  const mainMast = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.048, 2.66, 12), darkBrassMat);
  mainMast.position.set(-4.80, 1.33, -0.96);
  mainMast.castShadow = true;
  stage1Group.add(mainMast);

  const mastBase = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.13, 0.06, 16), brassMat);
  mastBase.position.set(-4.80, 0.03, -0.96);
  stage1Group.add(mastBase);
  addContactShadow(-4.80, 0.002, -0.96, 0.34, 0.34);

  const hopperArm = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.05, 0.96), brassMat);
  hopperArm.position.set(-4.80, 2.55, -0.48);
  stage1Group.add(hopperArm);

  const helixPts = [];
  const helixSteps = 72;
  for (let i = 0; i <= helixSteps; i++) {
    const u = i / helixSteps;
    const th = u * Math.PI * 4;
    const hx = -4.80 + 0.42 * Math.sin(th);
    const hy = 2.20 - 0.88 * u;
    const hz = -0.42 + 0.42 * Math.cos(th);
    helixPts.push(new THREE.Vector3(hx, hy, hz));
  }
  createRailPair(helixPts, 0.048, 0.014, brassMat, stage1Group);

  for (const ang of [0, (2 * Math.PI) / 3, (4 * Math.PI) / 3]) {
    const sx = -4.80 + 0.50 * Math.sin(ang);
    const sz = -0.42 + 0.50 * Math.cos(ang);
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.026, 2.24, 10), darkBrassMat);
    post.position.set(sx, 1.12, sz);
    post.castShadow = true;
    stage1Group.add(post);

    const foot = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.065, 0.04, 14), brassMat);
    foot.position.set(sx, 0.02, sz);
    stage1Group.add(foot);
    addContactShadow(sx, 0.002, sz, 0.20, 0.20);
  }

  createRailPair(
    [new THREE.Vector3(-4.80, 1.32, 0), new THREE.Vector3(-4.38, 1.25, 0), new THREE.Vector3(-3.96, 1.18, 0)],
    0.048,
    0.014,
    brassMat,
    stage1Group
  );
  const chutePost = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.026, 1.17, 10), darkBrassMat);
  chutePost.position.set(-4.02, 0.585, 0);
  stage1Group.add(chutePost);
  addContactShadow(-4.02, 0.002, 0, 0.16, 0.16);

  // 4. Stage 2: Interactive Brass Lever A
  const leverAPedestal = new THREE.Mesh(new THREE.CylinderGeometry(0.036, 0.055, 0.96, 12), darkBrassMat);
  leverAPedestal.position.set(-3.25, 0.48, -0.14);
  leverAPedestal.castShadow = true;
  scene.add(leverAPedestal);

  const leverABase = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.13, 0.045, 16), brassMat);
  leverABase.position.set(-3.25, 0.0225, -0.14);
  scene.add(leverABase);
  addContactShadow(-3.25, 0.002, -0.14, 0.34, 0.34);

  const leverAGroup = new THREE.Group();
  leverAGroup.position.set(-3.25, 0.96, 0);
  scene.add(leverAGroup);

  const leverABed = new THREE.Mesh(new THREE.BoxGeometry(1.36, 0.024, 0.21), brassMat);
  leverABed.position.y = -0.012;
  leverABed.name = 'leverA';
  leverABed.castShadow = true;
  leverAGroup.add(leverABed);

  for (const rz of [-0.095, 0.095]) {
    const sideWall = new THREE.Mesh(new THREE.BoxGeometry(1.36, 0.055, 0.018), darkBrassMat);
    sideWall.position.set(0, 0.022, rz);
    sideWall.name = 'leverA';
    leverAGroup.add(sideWall);
  }

  const bumperA = new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.08, 0.21), darkBrassMat);
  bumperA.position.set(-0.66, 0.04, 0);
  bumperA.name = 'leverA';
  leverAGroup.add(bumperA);

  const pivotHubA = new THREE.Mesh(new THREE.CylinderGeometry(0.042, 0.042, 0.30, 14), goldMat);
  pivotHubA.rotation.x = Math.PI / 2;
  pivotHubA.position.z = -0.04;
  pivotHubA.name = 'leverA';
  leverAGroup.add(pivotHubA);

  // 5. Stage 3: Terraced Ramp, Lever B & Recessed Catch Pocket
  createRailPair(
    [new THREE.Vector3(-2.58, 0.72, 0), new THREE.Vector3(-2.15, 0.57, 0), new THREE.Vector3(-1.72, 0.42, 0)],
    0.048,
    0.014,
    brassMat,
    scene
  );

  for (const [rx, rh] of [[-2.48, 0.68], [-2.12, 0.55], [-1.78, 0.43]]) {
    const riser = new THREE.Mesh(new THREE.BoxGeometry(0.07, rh, 0.18), darkBrassMat);
    riser.position.set(rx, rh * 0.5, 0);
    riser.castShadow = true;
    scene.add(riser);
    addContactShadow(rx, 0.002, 0, 0.18, 0.28);
  }

  const leverBPedestal = new THREE.Mesh(new THREE.CylinderGeometry(0.028, 0.042, 0.32, 12), darkBrassMat);
  leverBPedestal.position.set(-1.38, 0.16, -0.13);
  scene.add(leverBPedestal);
  addContactShadow(-1.38, 0.002, -0.13, 0.22, 0.22);

  const leverBGroup = new THREE.Group();
  leverBGroup.position.set(-1.38, 0.32, 0);
  scene.add(leverBGroup);

  const leverBBed = new THREE.Mesh(new THREE.BoxGeometry(0.68, 0.022, 0.21), brassMat);
  leverBBed.position.y = -0.011;
  leverBBed.name = 'leverB';
  leverBBed.castShadow = true;
  leverBGroup.add(leverBBed);

  for (const rz of [-0.095, 0.095]) {
    const sideWall = new THREE.Mesh(new THREE.BoxGeometry(0.68, 0.05, 0.016), darkBrassMat);
    sideWall.position.set(0, 0.02, rz);
    sideWall.name = 'leverB';
    leverBGroup.add(sideWall);
  }

  const pivotHubB = new THREE.Mesh(new THREE.CylinderGeometry(0.036, 0.036, 0.28, 14), goldMat);
  pivotHubB.rotation.x = Math.PI / 2;
  pivotHubB.position.z = -0.03;
  pivotHubB.name = 'leverB';
  leverBGroup.add(pivotHubB);

  const pocketRim = new THREE.Mesh(new THREE.TorusGeometry(0.11, 0.016, 10, 22), brassMat);
  pocketRim.rotation.x = Math.PI / 2;
  pocketRim.position.set(-1.02, 0.016, 0);
  scene.add(pocketRim);

  const pocketPad = new THREE.Mesh(new THREE.CylinderGeometry(0.105, 0.105, 0.01, 18), velvetMat);
  pocketPad.position.set(-1.02, 0.005, 0);
  scene.add(pocketPad);
  addContactShadow(-1.02, 0.002, 0, 0.28, 0.28);

  // 6. Stage 4: 12 Weighted Mahogany Dominoes (InstancedMesh -> 3 draw calls total!)
  const domBodyGeom = new THREE.BoxGeometry(DOM_T, DOM_H, DOM_W);
  domBodyGeom.translate(-DOM_T * 0.5, DOM_H * 0.5, 0);
  const domShoeGeom = new THREE.BoxGeometry(DOM_T + 0.004, 0.048, DOM_W + 0.004);
  domShoeGeom.translate(-DOM_T * 0.5, 0.024, 0);
  const domCapGeom = new THREE.BoxGeometry(DOM_T + 0.003, 0.020, DOM_W + 0.003);
  domCapGeom.translate(-DOM_T * 0.5, DOM_H - 0.01, 0);

  const domBodyInst = new THREE.InstancedMesh(domBodyGeom, mahoganyMat, DOM_COUNT);
  domBodyInst.castShadow = true;
  domBodyInst.receiveShadow = true;
  scene.add(domBodyInst);

  const domShoeInst = new THREE.InstancedMesh(domShoeGeom, brassMat, DOM_COUNT);
  scene.add(domShoeInst);

  const domCapInst = new THREE.InstancedMesh(domCapGeom, brassMat, DOM_COUNT);
  scene.add(domCapInst);

  for (let i = 0; i < DOM_COUNT; i++) {
    const xi = DOM_X0 + i * DOM_SPACING;
    addContactShadow(xi, 0.002, 0, 0.14, 0.28);
  }

  // 7. Stage 5: 5-Sphere Chrome Newton's Cradle
  const cradleGroup = new THREE.Group();
  scene.add(cradleGroup);

  const cradlePosts = [
    [2.12, -0.26],
    [2.12, 0.26],
    [3.24, -0.26],
    [3.24, 0.26],
  ];
  for (const [cx, cz] of cradlePosts) {
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.026, CRADLE_Y_PIV, 10), brassMat);
    post.position.set(cx, CRADLE_Y_PIV * 0.5, cz);
    post.castShadow = true;
    cradleGroup.add(post);

    const foot = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.065, 0.036, 14), darkBrassMat);
    foot.position.set(cx, 0.018, cz);
    cradleGroup.add(foot);
    addContactShadow(cx, 0.002, cz, 0.20, 0.20);
  }

  for (const cz of [-0.26, 0.26]) {
    const topBar = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, 1.16, 10), brassMat);
    topBar.rotation.z = Math.PI / 2;
    topBar.position.set(2.68, CRADLE_Y_PIV, cz);
    cradleGroup.add(topBar);
  }

  const cradlePivots = [];
  const wireLen = Math.hypot(CRADLE_L - CRADLE_R * 0.8, 0.26);
  const wireTilt = Math.atan2(0.26, CRADLE_L - CRADLE_R * 0.8);
  const wireLeft = new THREE.CylinderGeometry(0.004, 0.004, wireLen, 6);
  wireLeft.rotateX(-wireTilt);
  wireLeft.translate(0, -(CRADLE_L - CRADLE_R * 0.8) * 0.5, -0.13);
  const wireRight = new THREE.CylinderGeometry(0.004, 0.004, wireLen, 6);
  wireRight.rotateX(wireTilt);
  wireRight.translate(0, -(CRADLE_L - CRADLE_R * 0.8) * 0.5, 0.13);
  const mergedWireGeom = mergeGeometries([wireLeft, wireRight], false);
  wireLeft.dispose();
  wireRight.dispose();

  const sphereGeom = new THREE.SphereGeometry(CRADLE_R, 22, 16);

  for (let k = 0; k < CRADLE_COUNT; k++) {
    const pivot = new THREE.Group();
    pivot.position.set(CRADLE_X0 + k * CRADLE_PITCH, CRADLE_Y_PIV, 0);

    const wires = new THREE.Mesh(mergedWireGeom, steelMat);
    pivot.add(wires);

    const ball = new THREE.Mesh(sphereGeom, steelMat);
    ball.position.set(0, -CRADLE_L, 0);
    ball.castShadow = true;
    ball.receiveShadow = true;
    pivot.add(ball);

    cradleGroup.add(pivot);
    cradlePivots.push(pivot);
  }

  // 8. Stage 6: Cocked Torsion Brass Catapult
  const catapultBaseGroup = new THREE.Group();
  scene.add(catapultBaseGroup);

  const catBasePlate = new THREE.Mesh(new THREE.BoxGeometry(0.84, 0.04, 0.36), darkBrassMat);
  catBasePlate.position.set(3.74, 0.02, 0);
  catBasePlate.receiveShadow = true;
  catapultBaseGroup.add(catBasePlate);
  addContactShadow(3.74, 0.002, 0, 1.02, 0.54);

  for (const cz of [-0.14, 0.14]) {
    const cheek = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.34, 0.03), brassMat);
    cheek.position.set(CAT_PIVOT.x, 0.18, cz);
    cheek.castShadow = true;
    catapultBaseGroup.add(cheek);
  }

  const catAxle = new THREE.Mesh(new THREE.CylinderGeometry(0.024, 0.024, 0.34, 12), steelMat);
  catAxle.rotation.x = Math.PI / 2;
  catAxle.position.set(CAT_PIVOT.x, CAT_PIVOT.y, 0);
  catapultBaseGroup.add(catAxle);

  for (const rz of [-0.08, -0.05, 0.05, 0.08]) {
    const coil = new THREE.Mesh(new THREE.TorusGeometry(0.042, 0.008, 7, 16), goldMat);
    coil.position.set(CAT_PIVOT.x, CAT_PIVOT.y, rz);
    catapultBaseGroup.add(coil);
  }

  const searPost = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.024, 0.35, 10), brassMat);
  searPost.position.set(3.36, 0.175, -0.10);
  catapultBaseGroup.add(searPost);

  const searLatch = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.08, 0.20), goldMat);
  searLatch.position.set(3.36, 0.35, -0.02);
  catapultBaseGroup.add(searLatch);

  const stopX = CAT_PIVOT.x + 0.30 * Math.cos((142 * Math.PI) / 180);
  const stopY = CAT_PIVOT.y + 0.30 * Math.sin((142 * Math.PI) / 180);
  const stopBar = new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.016, 0.32, 10), darkBrassMat);
  stopBar.rotation.x = Math.PI / 2;
  stopBar.position.set(stopX, stopY + 0.03, 0);
  catapultBaseGroup.add(stopBar);

  const catapultArmGroup = new THREE.Group();
  catapultArmGroup.position.set(CAT_PIVOT.x, CAT_PIVOT.y, 0);
  scene.add(catapultArmGroup);

  const armShaft = new THREE.Mesh(new THREE.BoxGeometry(CAT_ARM_L, 0.032, 0.048), brassMat);
  armShaft.position.set(CAT_ARM_L * 0.5, 0, 0);
  armShaft.castShadow = true;
  catapultArmGroup.add(armShaft);

  const cupPts = [
    new THREE.Vector2(0.01, -0.03),
    new THREE.Vector2(0.08, -0.02),
    new THREE.Vector2(0.115, 0.045),
    new THREE.Vector2(0.105, 0.05),
    new THREE.Vector2(0.07, -0.005),
    new THREE.Vector2(0.0, -0.012),
  ];
  const cup = new THREE.Mesh(new THREE.LatheGeometry(cupPts, 20), goldMat);
  cup.position.set(CAT_ARM_L, 0, 0);
  cup.rotation.z = Math.PI * 0.28;
  catapultArmGroup.add(cup);

  // 9. Stage 7: Twin Brass Banner Arch (+25 deg yaw facing front-left cameras) + XPBD Cloth + Wireframe
  const bannerYaw = (25 * Math.PI) / 180;
  const bannerArchGroup = new THREE.Group();
  bannerArchGroup.position.set(4.62, 0, 0);
  bannerArchGroup.rotation.y = bannerYaw;
  scene.add(bannerArchGroup);

  for (const pz of [-0.72, 0.72]) {
    const pillar = new THREE.Mesh(new THREE.CylinderGeometry(0.026, 0.034, 1.88, 12), brassMat);
    pillar.position.set(0, 0.94, pz);
    pillar.castShadow = true;
    bannerArchGroup.add(pillar);

    const pBase = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.085, 0.045, 14), darkBrassMat);
    pBase.position.set(0, 0.0225, pz);
    bannerArchGroup.add(pBase);

    const finial = new THREE.Mesh(new THREE.SphereGeometry(0.044, 14, 10), goldMat);
    finial.position.set(0, 1.91, pz);
    bannerArchGroup.add(finial);

    const wx = 4.62 + pz * Math.sin(bannerYaw);
    const wz = pz * Math.cos(bannerYaw);
    addContactShadow(wx, 0.002, wz, 0.24, 0.24);
  }

  const topRod = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, 1.50, 12), brassMat);
  topRod.rotation.x = Math.PI / 2;
  topRod.position.set(0, 1.82, 0);
  topRod.castShadow = true;
  bannerArchGroup.add(topRod);

  const clothMesh = new THREE.Mesh(sim.cloth.geometry, silkMat);
  clothMesh.castShadow = true;
  clothMesh.receiveShadow = true;
  scene.add(clothMesh);

  const wireMat = new THREE.LineBasicMaterial({
    color: 0xf4cf6b,
    transparent: true,
    opacity: 0.88,
  });
  const clothWireMesh = new THREE.LineSegments(sim.cloth.wireGeometry, wireMat);
  clothWireMesh.visible = false;
  scene.add(clothWireMesh);

  // Subtle ambient emerald/gold silk breeze motes (24 soft floating motes around Stage 7)
  const MOTE_COUNT = 24;
  const moteGeom = new THREE.PlaneGeometry(0.036, 0.036);
  const moteMat = new THREE.MeshBasicMaterial({
    map: sparkSpriteTex,
    color: 0x8ef7ce,
    transparent: true,
    opacity: 0.48,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
  const moteMesh = new THREE.InstancedMesh(moteGeom, moteMat, MOTE_COUNT);
  moteMesh.frustumCulled = false;
  scene.add(moteMesh);

  // 10. Stage 8: Brass Funnel + Emerald Glass Bell + Velvet Dish + Glowing Sparks
  const stage8Group = new THREE.Group();
  scene.add(stage8Group);

  const funnelPts = [
    new THREE.Vector2(0.115, 0.44),
    new THREE.Vector2(0.145, 0.52),
    new THREE.Vector2(0.24, 0.68),
    new THREE.Vector2(0.255, 0.69),
    new THREE.Vector2(0.23, 0.675),
    new THREE.Vector2(0.135, 0.52),
    new THREE.Vector2(0.105, 0.44),
  ];
  const funnel = new THREE.Mesh(new THREE.LatheGeometry(funnelPts, 28), brassMat);
  funnel.position.set(5.44, 0, 0);
  funnel.castShadow = true;
  stage8Group.add(funnel);

  const funnelMast = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.028, 0.60, 10), darkBrassMat);
  funnelMast.position.set(5.44, 0.30, -0.34);
  stage8Group.add(funnelMast);
  addContactShadow(5.44, 0.002, -0.34, 0.16, 0.16);

  const funnelArm = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.032, 0.16), brassMat);
  funnelArm.position.set(5.44, 0.55, -0.25);
  stage8Group.add(funnelArm);

  const bellGroup = new THREE.Group();
  bellGroup.position.set(5.44, 0.35, 0);
  stage8Group.add(bellGroup);

  const bellPts = [
    new THREE.Vector2(0.0, -0.01),
    new THREE.Vector2(0.055, -0.012),
    new THREE.Vector2(0.11, -0.045),
    new THREE.Vector2(0.135, -0.12),
    new THREE.Vector2(0.175, -0.21),
    new THREE.Vector2(0.165, -0.215),
    new THREE.Vector2(0.125, -0.125),
    new THREE.Vector2(0.095, -0.052),
    new THREE.Vector2(0.0, -0.025),
  ];
  const bellShell = new THREE.Mesh(new THREE.LatheGeometry(bellPts, 28), bellMat);
  bellShell.castShadow = true;
  bellGroup.add(bellShell);

  const bellCrownRing = new THREE.Mesh(new THREE.CylinderGeometry(0.032, 0.046, 0.024, 16), goldMat);
  bellCrownRing.position.set(0, -0.004, 0);
  bellGroup.add(bellCrownRing);

  const bellMount = new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.022, 0.14, 10), darkBrassMat);
  bellMount.position.set(5.44, 0.07, 0);
  stage8Group.add(bellMount);
  addContactShadow(5.44, 0.002, 0, 0.42, 0.42);

  const dishRim = new THREE.Mesh(new THREE.TorusGeometry(0.18, 0.022, 10, 26), brassMat);
  dishRim.rotation.x = Math.PI / 2;
  dishRim.position.set(5.44, 0.022, 0.28);
  stage8Group.add(dishRim);

  const dishPad = new THREE.Mesh(new THREE.CylinderGeometry(0.175, 0.175, 0.018, 24), velvetMat);
  dishPad.position.set(5.44, 0.009, 0.28);
  dishPad.receiveShadow = true;
  stage8Group.add(dishPad);
  addContactShadow(5.44, 0.002, 0.28, 0.44, 0.44);

  // Merge all contact shadows into 1 single draw call
  if (contactShadowGeoms.length > 0) {
    const mergedShadows = mergeGeometries(contactShadowGeoms, false);
    for (const g of contactShadowGeoms) g.dispose();
    const shadowMat = new THREE.MeshBasicMaterial({
      map: contactShadowTex,
      transparent: true,
      opacity: 0.72,
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: -2,
    });
    const contactShadowMesh = new THREE.Mesh(mergedShadows, shadowMat);
    scene.add(contactShadowMesh);
  }

  // 11. Marbles
  const m1Geom = new THREE.SphereGeometry(R1, 24, 18);
  const marble1Mesh = new THREE.Mesh(m1Geom, steelMat);
  marble1Mesh.castShadow = true;
  marble1Mesh.receiveShadow = true;
  const m1Band = new THREE.Mesh(new THREE.TorusGeometry(R1 * 0.99, 0.005, 7, 22), darkBrassMat);
  m1Band.rotation.y = Math.PI / 2;
  marble1Mesh.add(m1Band);
  scene.add(marble1Mesh);

  const m2Geom = new THREE.SphereGeometry(R2, 24, 18);
  const marble2Mesh = new THREE.Mesh(m2Geom, goldMat);
  marble2Mesh.castShadow = true;
  marble2Mesh.receiveShadow = true;
  const m2Band = new THREE.Mesh(new THREE.TorusGeometry(R2 * 0.99, 0.006, 7, 22), brassMat);
  m2Band.rotation.y = Math.PI / 2;
  marble2Mesh.add(m2Band);
  scene.add(marble2Mesh);

  // 12. 96-particle Radial Glowing Ember Sparks (crossed soft radial sprite quads, zero polygonal aliasing!)
  const q1 = new THREE.PlaneGeometry(0.11, 0.11);
  const q2 = new THREE.PlaneGeometry(0.11, 0.11);
  q2.rotateY(Math.PI / 2);
  const q3 = new THREE.PlaneGeometry(0.11, 0.11);
  q3.rotateX(Math.PI / 2);
  const sparkGeom = mergeGeometries([q1, q2, q3], false);
  q1.dispose();
  q2.dispose();
  q3.dispose();

  const sparkMat = new THREE.MeshBasicMaterial({
    map: sparkSpriteTex,
    color: 0xffffff,
    transparent: true,
    opacity: 0.95,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
  const sparkMesh = new THREE.InstancedMesh(sparkGeom, sparkMat, SPARK_COUNT);
  sparkMesh.frustumCulled = false;
  scene.add(sparkMesh);

  const sparkColor = new THREE.Color();
  for (let i = 0; i < SPARK_COUNT; i++) {
    sparkColor.setHSL(0.10 + (i % 7) * 0.008, 0.95, 0.68);
    sparkMesh.setColorAt(i, sparkColor);
  }
  if (sparkMesh.instanceColor) sparkMesh.instanceColor.needsUpdate = true;

  // Merge static non-animated opaque meshes by material & shadow flags to minimize draw calls
  scene.updateMatrixWorld(true);
  const dynamicRoots = new Set([
    leverAGroup,
    leverBGroup,
    domBodyInst,
    domShoeInst,
    domCapInst,
    ...cradlePivots,
    catapultArmGroup,
    bellGroup,
    clothMesh,
    clothWireMesh,
    marble1Mesh,
    marble2Mesh,
    sparkMesh,
    moteMesh,
    pendantGroup,
  ]);
  const isDynamicBranch = (obj) => {
    let cur = obj;
    while (cur) {
      if (dynamicRoots.has(cur)) return true;
      cur = cur.parent;
    }
    return false;
  };
  const staticBuckets = new Map();
  const toRemove = [];
  scene.traverse((obj) => {
    if (!obj.isMesh || obj.isInstancedMesh || isDynamicBranch(obj)) return;
    const mat = obj.material;
    if (!mat || Array.isArray(mat) || mat.transparent) return;
    if (!obj.geometry || !obj.geometry.index) return;
    const key = `${mat.uuid}|${obj.castShadow ? 1 : 0}|${obj.receiveShadow ? 1 : 0}`;
    if (!staticBuckets.has(key)) {
      staticBuckets.set(key, {
        mat,
        castShadow: obj.castShadow,
        receiveShadow: obj.receiveShadow,
        geoms: [],
      });
    }
    const g = obj.geometry.clone();
    g.applyMatrix4(obj.matrixWorld);
    staticBuckets.get(key).geoms.push(g);
    toRemove.push(obj);
  });
  for (const obj of toRemove) {
    obj.parent?.remove(obj);
    obj.geometry.dispose();
  }
  for (const bucket of staticBuckets.values()) {
    if (bucket.geoms.length === 0) continue;
    const merged = mergeGeometries(bucket.geoms, false);
    for (const g of bucket.geoms) g.dispose();
    if (merged) {
      const batchMesh = new THREE.Mesh(merged, bucket.mat);
      batchMesh.castShadow = bucket.castShadow;
      batchMesh.receiveShadow = bucket.receiveShadow;
      scene.add(batchMesh);
    }
  }

  const dummy = new THREE.Object3D();

  function syncFromSim(showWireframe) {
    marble1Mesh.position.set(sim.m1.x, sim.m1.y, sim.m1.z);
    marble1Mesh.rotation.z = sim.m1.rotZ;

    marble2Mesh.position.set(sim.m2.x, sim.m2.y, sim.m2.z);
    marble2Mesh.rotation.z = sim.m2.rotZ;

    leverAGroup.rotation.z = sim.phiA;
    leverBGroup.rotation.z = sim.phiB;

    // Update 12 instanced dominoes in 1 loop
    for (let i = 0; i < DOM_COUNT; i++) {
      const xi = DOM_X0 + i * DOM_SPACING;
      dummy.position.set(xi + DOM_T * 0.5, 0, 0);
      dummy.rotation.set(0, 0, -sim.domTheta[i]);
      dummy.scale.set(1, 1, 1);
      dummy.updateMatrix();
      domBodyInst.setMatrixAt(i, dummy.matrix);
      domShoeInst.setMatrixAt(i, dummy.matrix);
      domCapInst.setMatrixAt(i, dummy.matrix);
    }
    domBodyInst.instanceMatrix.needsUpdate = true;
    domShoeInst.instanceMatrix.needsUpdate = true;
    domCapInst.instanceMatrix.needsUpdate = true;

    for (let k = 0; k < CRADLE_COUNT; k++) {
      cradlePivots[k].rotation.z = sim.cradlePsi[k];
    }

    catapultArmGroup.rotation.z = sim.catapultAngle;

    bellGroup.rotation.z = sim.bellOscAngle;
    bellMat.emissiveIntensity = sim.bellGlowIntensity;

    clothWireMesh.visible = showWireframe;
    sim.cloth.syncGeometry(showWireframe);

    // Update 24 soft ambient silk breeze motes drifting through Stage 7 banner
    const t = sim.cloth.simTime;
    const windRatio = Math.min(2.2, 0.35 + sim.cloth.windStrength * 0.25);
    for (let i = 0; i < MOTE_COUNT; i++) {
      const phase = ((t * 0.32 * windRatio + i / MOTE_COUNT) % 1.0);
      const u = ((i * 0.6180339887) % 1.0 - 0.5) * 1.16;
      const travel = -0.35 + phase * 1.05;
      const mx = 4.62 + u * Math.sin(bannerYaw) + travel * Math.cos(bannerYaw);
      const my = 0.95 + ((i * 0.37) % 0.82) + Math.sin(t * 2.1 + i) * 0.06;
      const mz = u * Math.cos(bannerYaw) - travel * Math.sin(bannerYaw);
      const fade = Math.sin(phase * Math.PI);
      const ms = (0.45 + 0.55 * fade) * (0.65 + 0.2 * windRatio);
      dummy.position.set(mx, my, mz);
      dummy.rotation.set(0, bannerYaw, 0);
      dummy.scale.set(ms, ms, ms);
      dummy.updateMatrix();
      moteMesh.setMatrixAt(i, dummy.matrix);
    }
    moteMesh.instanceMatrix.needsUpdate = true;

    // Update 96 radial glowing ember sparks
    for (let i = 0; i < SPARK_COUNT; i++) {
      if (!sim.sparkActive[i]) {
        dummy.scale.set(0, 0, 0);
        dummy.position.set(5.44, -10, 0);
        dummy.rotation.set(0, 0, 0);
      } else {
        const lifeFrac = 1 - sim.sparkAge[i] / sim.sparkLife[i];
        const s = Math.max(0.02, lifeFrac * 1.25);
        const p3 = i * 3;
        dummy.position.set(sim.sparkPos[p3], sim.sparkPos[p3 + 1], sim.sparkPos[p3 + 2]);
        dummy.scale.set(s, s, s);
        dummy.rotation.set(sim.sparkAge[i] * 3, sim.sparkAge[i] * 2, 0);
      }
      dummy.updateMatrix();
      sparkMesh.setMatrixAt(i, dummy.matrix);
    }
    sparkMesh.instanceMatrix.needsUpdate = true;
  }

  return {
    scene,
    leverAGroup,
    leverBGroup,
    clothWireMesh,
    sparkMesh,
    syncFromSim,
  };
}
