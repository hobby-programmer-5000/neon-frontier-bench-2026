/**
 * Cambridge Study 1936 — King's College Room X.8 Architectural 3D Scene & Studio HUD
 * Track 2A (@turing-arch) — Round 2 RLAIF Refined Clean-Room Three.js r187
 * Zero external assets/CDNs · Static Geometry Batching (<150 draw calls) · Baked Contact AO · Exterior Atmospheric Haze
 * Integrates @turing-utm modules: utm-core.js, utm-mesh.js, utm-audio.js
 */

import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { PROGRAMS, UniversalTuringMachine } from './utm-core.js';
import { createUTMApparatus } from './utm-mesh.js';
import { UTMAudio } from './utm-audio.js';

const DESK_TOP_Y = 0.76;
const ROOM_W = 6.4;
const ROOM_D = 5.8;
const ROOM_H = 3.55;
const BACK_WALL_Z = -2.35;
const SUN_DIR_WORLD = new THREE.Vector3(-0.34, 0.34, -0.88).normalize();

// ============================================================================
// 1. Deterministic PRNG, Static Geometry Batcher & Fast Procedural Textures
// ============================================================================

function mulberry32(seed) {
  let a = seed >>> 0;
  return function next() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function makeCanvas(w, h) {
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  return { canvas, ctx: canvas.getContext('2d') };
}

function toColorTexture(canvas, repeatX = 1, repeatY = 1) {
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = repeatX > 1 ? THREE.RepeatWrapping : THREE.ClampToEdgeWrapping;
  tex.wrapT = repeatY > 1 ? THREE.RepeatWrapping : THREE.ClampToEdgeWrapping;
  if (repeatX !== 1 || repeatY !== 1) {
    tex.repeat.set(repeatX, repeatY);
  }
  tex.anisotropy = 4;
  return tex;
}

/**
 * Normalizes a BufferGeometry to plain non-indexed Float32 attributes (position, normal, uv[, color])
 * baked into target space so BufferGeometryUtils.mergeGeometries succeeds cleanly with zero warnings.
 */
function normalizeGeometryForMerge(rawGeo, matrix, bakeColor = null) {
  const g = rawGeo.index ? rawGeo.toNonIndexed() : rawGeo.clone();
  for (const attrName of Object.keys(g.attributes)) {
    if (attrName !== 'position' && attrName !== 'normal' && attrName !== 'uv' && attrName !== 'color') {
      g.deleteAttribute(attrName);
    }
  }
  g.applyMatrix4(matrix);
  if (!g.getAttribute('normal')) {
    g.computeVertexNormals();
  }
  const count = g.getAttribute('position').count;
  if (!g.getAttribute('uv')) {
    g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(count * 2), 2));
  }
  if (bakeColor) {
    const cArr = new Float32Array(count * 3);
    for (let i = 0; i < count; i += 1) {
      cArr[i * 3] = bakeColor.r;
      cArr[i * 3 + 1] = bakeColor.g;
      cArr[i * 3 + 2] = bakeColor.b;
    }
    g.setAttribute('color', new THREE.BufferAttribute(cArr, 3));
  } else if (g.getAttribute('color')) {
    g.deleteAttribute('color');
  }
  for (const name of ['position', 'normal', 'uv', 'color']) {
    const attr = g.getAttribute(name);
    if (attr && (attr.isInterleavedBufferAttribute || !(attr.array instanceof Float32Array))) {
      const arr = new Float32Array(attr.count * attr.itemSize);
      for (let i = 0; i < attr.count; i += 1) {
        arr[i * attr.itemSize] = attr.getX(i);
        arr[i * attr.itemSize + 1] = attr.getY(i);
        if (attr.itemSize > 2) arr[i * attr.itemSize + 2] = attr.getZ(i);
      }
      g.setAttribute(name, new THREE.BufferAttribute(arr, attr.itemSize));
    }
  }
  g.morphAttributes = {};
  return g;
}

/**
 * Merges static single-material THREE.Mesh objects inside a root container by
 * (material, castShadow, receiveShadow, renderOrder) into one batched mesh per bucket.
 */
function batchStaticMeshes(root, candidateMeshes) {
  root.updateMatrixWorld(true);
  const invRoot = root.matrixWorld.clone().invert();
  const buckets = new Map();
  const localMat = new THREE.Matrix4();

  for (const mesh of candidateMeshes) {
    if (!mesh || !mesh.isMesh || mesh.isInstancedMesh || !mesh.geometry) continue;
    if (Array.isArray(mesh.material) || !mesh.material) continue;
    if (!mesh.parent) continue;

    const key = `${mesh.material.uuid}|${mesh.castShadow ? 1 : 0}|${mesh.receiveShadow ? 1 : 0}|${mesh.renderOrder}`;
    let bucket = buckets.get(key);
    if (!bucket) {
      bucket = {
        material: mesh.material,
        castShadow: mesh.castShadow,
        receiveShadow: mesh.receiveShadow,
        renderOrder: mesh.renderOrder,
        meshes: [],
      };
      buckets.set(key, bucket);
    }
    bucket.meshes.push(mesh);
  }

  for (const bucket of buckets.values()) {
    if (bucket.meshes.length < 2) continue;
    const prepared = [];
    const usesVC = Boolean(bucket.material.vertexColors);
    for (const m of bucket.meshes) {
      localMat.multiplyMatrices(invRoot, m.matrixWorld);
      const col = usesVC ? (m.userData.vColor || new THREE.Color(1, 1, 1)) : null;
      prepared.push(normalizeGeometryForMerge(m.geometry, localMat, col));
    }
    const merged = mergeGeometries(prepared, false);
    for (const g of prepared) g.dispose();
    if (!merged) continue;

    const batched = new THREE.Mesh(merged, bucket.material);
    batched.castShadow = bucket.castShadow;
    batched.receiveShadow = bucket.receiveShadow;
    batched.renderOrder = bucket.renderOrder;
    root.add(batched);

    for (const m of bucket.meshes) {
      m.parent.remove(m);
    }
  }
}

/**
 * Safely merges strictly non-animated static structural sub-meshes AND rigid children
 * inside moving pivots of @turing-utm's UTM apparatus at runtime (without modifying utm-mesh.js
 * or disrupting any animation reference!). Cuts UTM draw calls drastically for locked 60 FPS.
 */
function optimizeUTMApparatusDrawCalls(utmGroup) {
  const staticMeshes = [];
  utmGroup.updateMatrixWorld(true);

  const plinth = utmGroup.getObjectByName('WalnutPlinth');
  if (plinth) {
    for (const ch of plinth.children) {
      if (ch.isMesh && !ch.isInstancedMesh) {
        staticMeshes.push(ch);
      } else if (ch.isInstancedMesh) {
        ch.castShadow = false;
      }
    }
  }

  const consoleGrp = utmGroup.getObjectByName('FrontInstrumentConsole');
  if (consoleGrp) {
    for (const ch of consoleGrp.children) {
      if (ch.isMesh && !ch.isInstancedMesh) {
        staticMeshes.push(ch);
      } else if (ch.isGroup) {
        let knobIdx = 0;
        for (const fc of ch.children) {
          if (fc.isMesh && !fc.isInstancedMesh) {
            staticMeshes.push(fc);
          } else if (fc.isGroup) {
            // Identify knob groups (1 direct skirtMesh + 1 child rotor with 3 meshes) vs gauge/toggle groups
            let directMeshes = [];
            let nestedGroups = [];
            for (const sub of fc.children) {
              if (sub.isMesh && !sub.isInstancedMesh) directMeshes.push(sub);
              else if (sub.isGroup) nestedGroups.push(sub);
            }
            for (const dm of directMeshes) staticMeshes.push(dm);

            if (nestedGroups.length === 1) {
              const piv = nestedGroups[0];
              const pivMeshes = piv.children.filter((x) => x.isMesh && !x.isInstancedMesh);
              if (directMeshes.length === 1 && pivMeshes.length === 3) {
                // Rotary knob: utm-mesh.js only animates rotaryKnobs[2] & rotaryKnobs[3]
                if (knobIdx !== 2 && knobIdx !== 3) {
                  for (const pm of pivMeshes) staticMeshes.push(pm);
                }
                knobIdx += 1;
              } else if (pivMeshes.length >= 2) {
                // Toggle lever (bat + tip share polishedSteelMat) -> merge rigid children inside pivot
                batchStaticMeshes(piv, pivMeshes);
              }
            }
          }
        }
      }
    }
  }

  for (const reelName of ['LeftTapeReelAssembly', 'RightTapeReelAssembly']) {
    const reelAsm = utmGroup.getObjectByName(reelName);
    if (!reelAsm) continue;
    for (const ch of reelAsm.children) {
      if (ch.isMesh && !ch.isInstancedMesh) {
        staticMeshes.push(ch);
      } else if (ch.isGroup) {
        // Inside spinning reel rotor: merge rigid non-instanced single-material meshes (rims, hub, nut) inside rotor!
        const rotorStatic = ch.children.filter((m) => m.isMesh && !m.isInstancedMesh && !Array.isArray(m.material));
        batchStaticMeshes(ch, rotorStatic);
      }
    }
  }

  const bridge = utmGroup.getObjectByName('PaperTapeBridge');
  if (bridge) {
    for (const ch of bridge.children) {
      if (ch.isMesh && !ch.isInstancedMesh && ch.material && ch.material.side !== THREE.DoubleSide) {
        staticMeshes.push(ch);
      } else if (ch.isGroup) {
        // Guide roller pivot: merge drum+pin (steel) and 2 flanges (bright brass) rigidly inside pivot
        const rMeshes = ch.children.filter((m) => m.isMesh && !m.isInstancedMesh);
        batchStaticMeshes(ch, rMeshes);
      }
    }
  }

  const gantry = utmGroup.getObjectByName('ReadWriteGantry');
  if (gantry) {
    for (const ch of gantry.children) {
      if (ch.isMesh && !ch.isInstancedMesh) {
        staticMeshes.push(ch);
      } else if (ch.isGroup) {
        let hasLight = false;
        let groupCount = 0;
        let meshCount = 0;
        for (const sc of ch.children) {
          if (sc.isLight) hasLight = true;
          else if (sc.isGroup) groupCount += 1;
          else if (sc.isMesh) meshCount += 1;
        }
        if (!hasLight && groupCount === 1 && meshCount === 6) {
          for (const sc of ch.children) {
            if (sc.isMesh && !sc.isInstancedMesh) staticMeshes.push(sc);
          }
        } else if (!hasLight && groupCount === 0 && meshCount >= 2) {
          // Rigid animated hammerGroup or camShaftPivot: merge same-material meshes inside pivot!
          const pMeshes = ch.children.filter((m) => m.isMesh && !m.isInstancedMesh);
          batchStaticMeshes(ch, pMeshes);
        }
      }
    }
  }

  // Keep crisp shadows ONLY on primary UTM silhouettes (>6cm radius) to minimize shadow-pass draw calls
  utmGroup.traverse((obj) => {
    if (!obj.isMesh || !obj.geometry) return;
    if (!obj.geometry.boundingSphere) obj.geometry.computeBoundingSphere();
    const r = obj.geometry.boundingSphere ? obj.geometry.boundingSphere.radius : 0;
    if (r < 0.065) {
      obj.castShadow = false;
    }
  });

  batchStaticMeshes(utmGroup, staticMeshes);
}

function createWoodTexture({
  base = '#593922',
  dark = '#3a2212',
  light = '#744d30',
  seed = 101,
  repeatX = 1,
  repeatY = 1,
} = {}) {
  const { canvas, ctx } = makeCanvas(512, 512);
  const rand = mulberry32(seed);

  ctx.fillStyle = base;
  ctx.fillRect(0, 0, 512, 512);

  for (let y = 0; y < 512; y += 3) {
    const wave = Math.sin(y * 0.045 + seed) * 0.5 + Math.sin(y * 0.13) * 0.3;
    ctx.strokeStyle = wave > 0.1 ? light : dark;
    ctx.globalAlpha = 0.08 + Math.abs(wave) * 0.12;
    ctx.lineWidth = 2.0;
    ctx.beginPath();
    ctx.moveTo(0, y);
    for (let x = 64; x <= 512; x += 64) {
      ctx.lineTo(x, y + Math.sin(x * 0.015 + y * 0.04 + seed) * 2.4);
    }
    ctx.stroke();
  }

  for (let i = 0; i < 300; i += 1) {
    ctx.fillStyle = rand() > 0.45 ? dark : light;
    ctx.globalAlpha = 0.06 + rand() * 0.08;
    ctx.fillRect(rand() * 512, rand() * 512, 12 + rand() * 44, 1.4);
  }
  ctx.globalAlpha = 1;
  return toColorTexture(canvas, repeatX, repeatY);
}

function createParquetTexture() {
  const { canvas, ctx } = makeCanvas(512, 512);
  const rand = mulberry32(404);
  ctx.fillStyle = '#3b2515';
  ctx.fillRect(0, 0, 512, 512);

  const tones = ['#5a3a21', '#654227', '#4e311c', '#6e492c', '#53341d', '#5f3d23'];
  const plankW = 128;
  const plankH = 32;

  for (let row = 0; row < 16; row += 1) {
    for (let col = -1; col < 5; col += 1) {
      const isAlt = (row + col) % 2 === 0;
      const x = col * plankW + (isAlt ? 0 : plankW * 0.35);
      const y = row * plankH;
      ctx.fillStyle = tones[Math.floor(rand() * tones.length)];
      ctx.fillRect(x + 1, y + 1, plankW - 2, plankH - 2);

      ctx.strokeStyle = 'rgba(26, 14, 6, 0.22)';
      ctx.lineWidth = 1;
      for (let g = 6; g < plankH - 4; g += 8) {
        ctx.beginPath();
        ctx.moveTo(x + 2, y + g);
        ctx.lineTo(x + plankW - 2, y + g + (rand() - 0.5) * 1.8);
        ctx.stroke();
      }
      ctx.strokeStyle = 'rgba(220, 175, 118, 0.08)';
      ctx.strokeRect(x + 2, y + 2, plankW - 4, plankH - 4);
    }
  }
  return toColorTexture(canvas, 4.2, 3.8);
}

function createPlasterTexture() {
  const { canvas, ctx } = makeCanvas(512, 512);
  const rand = mulberry32(707);

  ctx.fillStyle = '#bca989';
  ctx.fillRect(0, 0, 512, 512);

  for (let i = 0; i < 150; i += 1) {
    const x = rand() * 512;
    const y = rand() * 512;
    const r = 28 + rand() * 82;
    const grad = ctx.createRadialGradient(x, y, 2, x, y, r);
    const warm = rand() > 0.5 ? 'rgba(154, 134, 102, 0.16)' : 'rgba(206, 190, 160, 0.14)';
    grad.addColorStop(0, warm);
    grad.addColorStop(1, 'rgba(188, 169, 137, 0)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }

  for (let i = 0; i < 450; i += 1) {
    ctx.fillStyle = rand() > 0.5 ? 'rgba(74, 58, 40, 0.07)' : 'rgba(244, 232, 206, 0.05)';
    ctx.fillRect(rand() * 512, rand() * 512, 2.5, 2.5);
  }
  return toColorTexture(canvas, 2, 1.5);
}

function createPersianRugTexture() {
  const { canvas, ctx } = makeCanvas(768, 576);
  ctx.scale(0.75, 0.75);

  ctx.fillStyle = '#1d2738';
  ctx.fillRect(0, 0, 1024, 768);

  ctx.strokeStyle = '#c09a58';
  ctx.lineWidth = 10;
  ctx.strokeRect(24, 24, 976, 720);

  ctx.fillStyle = '#6c221d';
  ctx.fillRect(48, 48, 928, 672);

  ctx.strokeStyle = '#d9bf89';
  ctx.lineWidth = 4;
  ctx.strokeRect(66, 66, 892, 636);

  ctx.fillStyle = '#1b2636';
  ctx.fillRect(82, 82, 860, 604);

  for (let x = 104; x <= 920; x += 48) {
    for (const y of [104, 664]) {
      ctx.fillStyle = '#c89e56';
      ctx.beginPath();
      ctx.arc(x, y, 10, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#8b2d24';
      ctx.beginPath();
      ctx.arc(x, y, 5, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  for (let y = 148; y <= 620; y += 48) {
    for (const x of [104, 920]) {
      ctx.fillStyle = '#c89e56';
      ctx.beginPath();
      ctx.arc(x, y, 10, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#8b2d24';
      ctx.beginPath();
      ctx.arc(x, y, 5, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  ctx.fillStyle = '#5d1d1a';
  ctx.fillRect(130, 130, 764, 508);
  ctx.strokeStyle = '#cfa763';
  ctx.lineWidth = 4;
  ctx.strokeRect(138, 138, 748, 492);

  const corners = [
    [138, 138, 1, 1],
    [886, 138, -1, 1],
    [138, 630, 1, -1],
    [886, 630, -1, -1],
  ];
  for (const [cx, cy, sx, sy] of corners) {
    ctx.fillStyle = '#213042';
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(cx + sx * 120, cy);
    ctx.lineTo(cx, cy + sy * 96);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = '#c9a15a';
    ctx.lineWidth = 3;
    ctx.stroke();
  }

  const cx = 512;
  const cy = 384;
  const drawDiamond = (rx, ry, fill, stroke) => {
    ctx.beginPath();
    ctx.moveTo(cx, cy - ry);
    ctx.lineTo(cx + rx, cy);
    ctx.lineTo(cx, cy + ry);
    ctx.lineTo(cx - rx, cy);
    ctx.closePath();
    ctx.fillStyle = fill;
    ctx.fill();
    if (stroke) {
      ctx.strokeStyle = stroke;
      ctx.lineWidth = 4;
      ctx.stroke();
    }
  };
  drawDiamond(210, 142, '#1e2c3e', '#d6b26d');
  drawDiamond(156, 104, '#882b23', '#e2c992');
  drawDiamond(96, 64, '#c49b54', '#223042');
  drawDiamond(46, 32, '#1d2738', '#efe0be');

  for (let y = 0; y < 768; y += 5) {
    ctx.fillStyle = y % 10 === 0 ? 'rgba(255, 240, 210, 0.045)' : 'rgba(12, 8, 6, 0.075)';
    ctx.fillRect(0, y, 1024, 2);
  }
  return toColorTexture(canvas, 1, 1);
}

function createLeatherBlotterTexture() {
  const { canvas, ctx } = makeCanvas(768, 384);
  const rand = mulberry32(314);
  ctx.scale(0.75, 0.75);

  const grad = ctx.createRadialGradient(512, 256, 40, 512, 256, 560);
  grad.addColorStop(0, '#1e4633');
  grad.addColorStop(0.7, '#153626');
  grad.addColorStop(1, '#0e261b');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 1024, 512);

  for (let i = 0; i < 650; i += 1) {
    ctx.fillStyle = rand() > 0.5 ? 'rgba(255, 248, 224, 0.035)' : 'rgba(4, 12, 8, 0.08)';
    ctx.fillRect(rand() * 1024, rand() * 512, 3, 3);
  }

  ctx.strokeStyle = 'rgba(210, 172, 96, 0.72)';
  ctx.lineWidth = 3;
  ctx.strokeRect(20, 18, 984, 476);

  ctx.strokeStyle = 'rgba(210, 172, 96, 0.44)';
  ctx.lineWidth = 1.5;
  ctx.strokeRect(32, 30, 960, 452);

  for (const [x, y] of [[32, 30], [992, 30], [32, 482], [992, 482]]) {
    ctx.fillStyle = 'rgba(212, 176, 102, 0.65)';
    ctx.beginPath();
    ctx.arc(x, y, 6, 0, Math.PI * 2);
    ctx.fill();
  }
  return toColorTexture(canvas, 1, 1);
}

function createContactShadowTexture() {
  const { canvas, ctx } = makeCanvas(256, 256);
  const grad = ctx.createRadialGradient(128, 128, 18, 128, 128, 124);
  grad.addColorStop(0.0, 'rgba(14, 9, 5, 0.78)');
  grad.addColorStop(0.42, 'rgba(16, 10, 6, 0.52)');
  grad.addColorStop(0.72, 'rgba(18, 11, 6, 0.18)');
  grad.addColorStop(1.0, 'rgba(18, 11, 6, 0.0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 256, 256);
  return toColorTexture(canvas, 1, 1);
}

function createParchmentTexture(variant = 0) {
  const { canvas, ctx } = makeCanvas(640, 800);
  const rand = mulberry32(variant === 0 ? 1936 : 1937);
  ctx.scale(640 / 768, 800 / 960);

  const bg = ctx.createLinearGradient(0, 0, 768, 960);
  bg.addColorStop(0, '#dfd0ae');
  bg.addColorStop(0.55, '#d6c39a');
  bg.addColorStop(1, '#c8b285');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, 768, 960);

  for (let i = 0; i < 360; i += 1) {
    ctx.fillStyle = rand() > 0.5 ? 'rgba(116, 86, 48, 0.07)' : 'rgba(255, 246, 224, 0.06)';
    ctx.fillRect(rand() * 768, rand() * 960, 4, 2);
  }

  ctx.strokeStyle = 'rgba(120, 96, 62, 0.18)';
  ctx.lineWidth = 1.2;
  for (let y = 70; y < 920; y += 34) {
    ctx.beginPath();
    ctx.moveTo(44, y);
    ctx.lineTo(724, y);
    ctx.stroke();
  }

  ctx.fillStyle = '#1d140d';
  ctx.strokeStyle = '#22170f';

  if (variant === 0) {
    ctx.font = 'italic bold 30px Georgia, serif';
    ctx.fillText("King's College, Cambridge · 1936", 54, 68);
    ctx.font = 'bold 26px Georgia, serif';
    ctx.fillText('On Computable Numbers (§3–§6)', 54, 112);

    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(54, 126);
    ctx.lineTo(540, 126);
    ctx.stroke();

    ctx.font = 'italic 22px Georgia, serif';
    ctx.fillText('Application to the Entscheidungsproblem:', 54, 168);
    ctx.font = '21px "Courier New", monospace';
    ctx.fillText('m-config   sym   operations   final', 58, 220);
    ctx.beginPath();
    ctx.moveTo(54, 232);
    ctx.lineTo(680, 232);
    ctx.stroke();

    const rows = [
      '  b        None   P0, R         c',
      '  c        None   R             e',
      '  e        None   P1, R         f',
      '  f        None   R             b',
      '  q0       1      P1, R         q0',
      '  q0       _      L             carry',
    ];
    rows.forEach((line, idx) => {
      ctx.fillText(line, 58, 272 + idx * 42);
    });

    ctx.font = 'italic 22px Georgia, serif';
    ctx.fillText('Tape Configuration (F-squares & E-squares):', 54, 560);
    const tapeCells = ['0', ' ', '1', ' ', '0', ' ', '1', ' ', '1'];
    for (let i = 0; i < tapeCells.length; i += 1) {
      const x = 60 + i * 68;
      ctx.strokeRect(x, 586, 68, 62);
      ctx.font = 'bold 30px "Courier New", monospace';
      ctx.fillText(tapeCells[i], x + 23, 628);
    }
    ctx.strokeStyle = '#992f22';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.ellipse(60 + 4 * 68 + 34, 617, 42, 38, -0.08, 0, Math.PI * 2);
    ctx.stroke();

    ctx.fillStyle = '#1d140d';
    ctx.font = 'italic 23px Georgia, serif';
    ctx.fillText('Universal Machine U simulates D.N.(M):', 54, 718);
    ctx.font = '24px Georgia, serif';
    ctx.fillText('β(n) = 1 − φₙ(n)  ⇒  No machine H decides K', 54, 766);
    ctx.fillText('Standard Description S.D. → Description Number D.N.', 54, 816);
    ctx.font = 'italic 20px Georgia, serif';
    ctx.fillStyle = '#5b3926';
    ctx.fillText('— A.M.T., Room X.8, Gibbs Building', 330, 895);
  } else {
    ctx.font = 'italic bold 28px Georgia, serif';
    ctx.fillText('Entscheidungsproblem — Diagonal Proof Notes', 52, 74);
    ctx.font = '22px "Courier New", monospace';
    ctx.fillText('Let K be the set of circle-free D.N.', 52, 134);
    ctx.fillText('Assume machine D tests M for circle-free:', 52, 178);
    ctx.fillText('  D(R) = u (unsatisfactory) or s (satisfactory)', 52, 224);
    ctx.fillText('Construct β using U + D:', 52, 282);
    ctx.fillText('  R(K) computes N-th figure of K-th sequence', 52, 326);
    ctx.fillText('  Contradiction at N = K!  ∴ D cannot exist.', 52, 376);

    ctx.lineWidth = 2.5;
    const nodes = [
      [180, 560, 'b'],
      [390, 510, 'c'],
      [580, 580, 'e'],
      [370, 710, 'f'],
    ];
    for (const [nx, ny, lbl] of nodes) {
      ctx.beginPath();
      ctx.arc(nx, ny, 38, 0, Math.PI * 2);
      ctx.stroke();
      ctx.font = 'italic bold 32px Georgia, serif';
      ctx.fillText(lbl, nx - 10, ny + 10);
    }
    ctx.beginPath();
    ctx.moveTo(216, 548);
    ctx.lineTo(352, 518);
    ctx.moveTo(426, 522);
    ctx.lineTo(544, 566);
    ctx.moveTo(552, 608);
    ctx.lineTo(405, 694);
    ctx.moveTo(335, 690);
    ctx.lineTo(206, 588);
    ctx.stroke();

    ctx.font = 'italic 22px Georgia, serif';
    ctx.fillText("Hilbert's Entscheidungsproblem is unsolvable.", 52, 845);
  }
  return toColorTexture(canvas, 1, 1);
}

function createBlackboardTexture() {
  const { canvas, ctx } = makeCanvas(1280, 800);
  const rand = mulberry32(193605);
  ctx.scale(1280 / 1536, 800 / 960);

  const bg = ctx.createLinearGradient(0, 0, 1536, 960);
  bg.addColorStop(0, '#1c2421');
  bg.addColorStop(0.5, '#202925');
  bg.addColorStop(1, '#171f1c');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, 1536, 960);

  for (let i = 0; i < 45; i += 1) {
    const x = rand() * 1536;
    const y = rand() * 960;
    const rx = 50 + rand() * 140;
    const ry = 22 + rand() * 55;
    const grad = ctx.createRadialGradient(x, y, 4, x, y, rx);
    grad.addColorStop(0, 'rgba(225, 232, 224, 0.045)');
    grad.addColorStop(1, 'rgba(225, 232, 224, 0)');
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(1, ry / rx);
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(0, 0, rx, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  ctx.fillStyle = 'rgba(244, 240, 228, 0.94)';
  ctx.font = 'bold 38px Georgia, serif';
  ctx.fillText('ON COMPUTABLE NUMBERS (1936)  —  UNIVERSAL MACHINE U', 62, 88);

  ctx.strokeStyle = 'rgba(232, 214, 168, 0.55)';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(60, 110);
  ctx.lineTo(1474, 110);
  ctx.stroke();

  ctx.strokeStyle = 'rgba(235, 230, 215, 0.22)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(768, 134);
  ctx.lineTo(768, 895);
  ctx.stroke();

  ctx.fillStyle = 'rgba(245, 225, 168, 0.92)';
  ctx.font = 'italic bold 26px Georgia, serif';
  ctx.fillText('§3. Sequence 010101... (m-configurations)', 62, 168);

  ctx.strokeStyle = 'rgba(235, 235, 225, 0.45)';
  ctx.lineWidth = 2.5;
  ctx.strokeRect(62, 194, 672, 355);
  ctx.beginPath();
  ctx.moveTo(62, 252);
  ctx.lineTo(734, 252);
  ctx.moveTo(212, 194);
  ctx.lineTo(212, 549);
  ctx.moveTo(342, 194);
  ctx.lineTo(342, 549);
  ctx.moveTo(558, 194);
  ctx.lineTo(558, 549);
  ctx.stroke();

  ctx.fillStyle = 'rgba(246, 242, 232, 0.94)';
  ctx.font = 'bold 23px "Courier New", monospace';
  ctx.fillText('m-config', 76, 232);
  ctx.fillText('symb.', 232, 232);
  ctx.fillText('operations', 364, 232);
  ctx.fillText('final', 588, 232);

  const tableRows = [
    ['  b', 'None', 'P0, R', '  c'],
    ['  c', 'None', 'R', '  e'],
    ['  e', 'None', 'P1, R', '  f'],
    ['  f', 'None', 'R', '  b'],
    ['  U', 'S.D.', 'sim(M, w)', ' HALT'],
  ];
  ctx.font = '25px "Courier New", monospace';
  tableRows.forEach((r, idx) => {
    const y = 300 + idx * 56;
    ctx.fillStyle = idx === 4 ? 'rgba(248, 218, 146, 0.95)' : 'rgba(238, 238, 230, 0.88)';
    ctx.fillText(r[0], 78, y);
    ctx.fillText(r[1], 232, y);
    ctx.fillText(r[2], 364, y);
    ctx.fillText(r[3], 586, y);
  });

  ctx.fillStyle = 'rgba(245, 225, 168, 0.92)';
  ctx.font = 'italic bold 26px Georgia, serif';
  ctx.fillText('Infinite Tape & Read/Write Head:', 62, 628);

  const syms = ['␣', '1', '0', '1', '1', '1', '␣', '0'];
  for (let i = 0; i < syms.length; i += 1) {
    const x = 62 + i * 83;
    ctx.strokeStyle = i === 3 ? 'rgba(248, 190, 128, 0.95)' : 'rgba(235, 235, 225, 0.6)';
    ctx.lineWidth = i === 3 ? 4 : 2.5;
    ctx.strokeRect(x, 656, 83, 84);
    ctx.fillStyle = i === 3 ? 'rgba(255, 216, 152, 0.98)' : 'rgba(242, 240, 232, 0.88)';
    ctx.font = 'bold 40px "Courier New", monospace';
    ctx.fillText(syms[i], x + 26, 712);
  }
  ctx.strokeStyle = 'rgba(248, 190, 128, 0.95)';
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(62 + 3 * 83 + 41, 812);
  ctx.lineTo(62 + 3 * 83 + 41, 754);
  ctx.lineTo(62 + 3 * 83 + 27, 772);
  ctx.moveTo(62 + 3 * 83 + 41, 754);
  ctx.lineTo(62 + 3 * 83 + 55, 772);
  ctx.stroke();
  ctx.fillStyle = 'rgba(248, 190, 128, 0.94)';
  ctx.font = '23px "Courier New", monospace';
  ctx.fillText('HEAD  δ(q, s) → (s′, D, q′)', 186, 860);

  ctx.fillStyle = 'rgba(245, 225, 168, 0.92)';
  ctx.font = 'italic bold 26px Georgia, serif';
  ctx.fillText('§6–§8. Universal Machine & Diagonal Proof', 804, 168);

  ctx.fillStyle = 'rgba(240, 240, 232, 0.9)';
  ctx.font = '24px Georgia, serif';
  const proofLines = [
    '1. Encode table M as Standard Description S.D.(M)',
    '2. Map S.D.(M) → Description Number D.N. ∈ ℕ',
    '3. Universal Machine U reads D.N. on tape:',
    '      U( D.N.(M),  x )  =  M(x)',
    '4. Suppose D decides whether M is circle-free:',
    '      β(n) = 1 − φₙ(n)  for circle-free n',
    '5. Let K = D.N.(β). Evaluating at n = K:',
    '      β(K) = 1 − β(K)   ⇒   Contradiction!',
  ];
  proofLines.forEach((txt, i) => {
    ctx.fillStyle = i === 3 || i === 7 ? 'rgba(250, 214, 144, 0.96)' : 'rgba(238, 238, 230, 0.88)';
    ctx.fillText(txt, 804, 232 + i * 54);
  });

  ctx.strokeStyle = 'rgba(246, 206, 134, 0.78)';
  ctx.lineWidth = 3;
  ctx.strokeRect(804, 680, 660, 170);
  ctx.fillStyle = 'rgba(250, 226, 172, 0.96)';
  ctx.font = 'bold 28px Georgia, serif';
  ctx.fillText('THEOREM (Entscheidungsproblem):', 830, 736);
  ctx.font = 'italic 26px Georgia, serif';
  ctx.fillText('No general mechanical procedure can', 830, 782);
  ctx.fillText('decide provability in first-order logic.', 830, 822);

  return toColorTexture(canvas, 1, 1);
}

function createBookSpineTexture() {
  const { canvas, ctx } = makeCanvas(128, 256);
  ctx.scale(0.5, 0.5);
  ctx.fillStyle = '#d4cdc2';
  ctx.fillRect(0, 0, 256, 512);

  for (let y = 0; y < 512; y += 6) {
    ctx.fillStyle = y % 12 === 0 ? 'rgba(0,0,0,0.07)' : 'rgba(255,255,255,0.04)';
    ctx.fillRect(0, y, 256, 2);
  }

  const sideGrad = ctx.createLinearGradient(0, 0, 256, 0);
  sideGrad.addColorStop(0, 'rgba(0,0,0,0.28)');
  sideGrad.addColorStop(0.14, 'rgba(255,255,255,0.08)');
  sideGrad.addColorStop(0.86, 'rgba(0,0,0,0.04)');
  sideGrad.addColorStop(1, 'rgba(0,0,0,0.32)');
  ctx.fillStyle = sideGrad;
  ctx.fillRect(0, 0, 256, 512);

  ctx.fillStyle = '#e7cf93';
  for (const y of [44, 62, 168, 182, 412, 428]) {
    ctx.fillRect(14, y, 228, 7);
  }
  ctx.fillStyle = 'rgba(34, 24, 16, 0.42)';
  ctx.fillRect(28, 86, 200, 68);
  ctx.strokeStyle = '#e8cf95';
  ctx.lineWidth = 3;
  ctx.strokeRect(28, 86, 200, 68);

  return toColorTexture(canvas, 1, 1);
}

function createCampusEtchingTexture() {
  const { canvas, ctx } = makeCanvas(256, 320);
  ctx.scale(0.5, 0.5);
  ctx.fillStyle = '#e8ddc4';
  ctx.fillRect(0, 0, 512, 640);

  ctx.fillStyle = '#dfd0b0';
  ctx.fillRect(58, 66, 396, 480);
  ctx.strokeStyle = '#6f5a3e';
  ctx.lineWidth = 2;
  ctx.strokeRect(58, 66, 396, 480);

  ctx.strokeStyle = 'rgba(72, 54, 36, 0.22)';
  ctx.lineWidth = 1;
  for (let y = 78; y < 310; y += 8) {
    ctx.beginPath();
    ctx.moveTo(64, y);
    ctx.lineTo(448, y);
    ctx.stroke();
  }

  ctx.fillStyle = '#473626';
  ctx.fillRect(108, 290, 296, 130);
  for (const sx of [104, 152, 344, 392]) {
    ctx.fillRect(sx, 205, 16, 215);
    ctx.beginPath();
    ctx.moveTo(sx - 2, 205);
    ctx.lineTo(sx + 8, 166);
    ctx.lineTo(sx + 18, 205);
    ctx.closePath();
    ctx.fill();
  }
  ctx.fillStyle = '#5c4732';
  ctx.fillRect(62, 420, 388, 122);
  ctx.fillStyle = '#3c2d1e';
  ctx.font = 'italic 18px Georgia, serif';
  ctx.fillText("King's College Chapel, Cambridge", 124, 588);

  return toColorTexture(canvas, 1, 1);
}

// ============================================================================
// 2. Custom GLSL Shaders (Strict WebGL2 Hygiene — Zero Early Returns!)
// ============================================================================

function createCambridgeSkyMaterial() {
  return new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    uniforms: {
      uSunDir: { value: SUN_DIR_WORLD.clone() },
      uTime: { value: 0 },
    },
    vertexShader: /* glsl */ `
      varying vec3 vWorldDir;
      void main() {
        vec4 wp = modelMatrix * vec4(position, 1.0);
        vWorldDir = normalize(wp.xyz);
        gl_Position = projectionMatrix * viewMatrix * wp;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform vec3 uSunDir;
      uniform float uTime;
      varying vec3 vWorldDir;

      void main() {
        vec3 dir = normalize(vWorldDir);
        float elev = clamp(dir.y, -0.15, 1.0);
        float h = smoothstep(-0.08, 0.58, elev);

        vec3 horizonCol = vec3(0.98, 0.78, 0.50);
        vec3 midCol     = vec3(0.91, 0.83, 0.69);
        vec3 zenithCol  = vec3(0.39, 0.56, 0.74);

        vec3 sky = mix(horizonCol, midCol, smoothstep(0.0, 0.28, h));
        sky = mix(sky, zenithCol, smoothstep(0.24, 0.94, h));

        // Warm late-afternoon Cambridge sun glow & atmospheric scatter
        float sunDot = max(dot(dir, normalize(uSunDir)), 0.0);
        float sunHalo = pow(sunDot, 7.0) * 0.45 + pow(sunDot, 48.0) * 0.68;
        float sunCore = smoothstep(0.9965, 0.9992, sunDot) * 1.1;
        sky += vec3(1.0, 0.86, 0.56) * (sunHalo + sunCore);

        // Soft high English cirrus bands
        float cloudWave = sin(dir.x * 9.0 + uTime * 0.025) * cos(dir.z * 7.0 - dir.x * 3.0);
        float cloudBand = smoothstep(0.14, 0.36, elev) * (1.0 - smoothstep(0.45, 0.82, elev));
        float cloudAmt = smoothstep(0.25, 0.85, cloudWave * 0.5 + 0.5) * cloudBand * 0.14;
        sky = mix(sky, vec3(0.99, 0.92, 0.78), cloudAmt);

        gl_FragColor = vec4(sky, 1.0);
      }
    `,
  });
}

/**
 * Unified Vertex-Colored Exterior Atmospheric Shader for King's College Chapel & Courtyard.
 * Renders the entire exterior diorama in ONE single GLSL shader compile & ONE single draw call!
 */
function createExteriorAtmosphericMaterial() {
  return new THREE.ShaderMaterial({
    vertexColors: true,
    uniforms: {
      uSunDir: { value: new THREE.Vector3(-0.55, 0.46, 0.69).normalize() },
      uHazeColor: { value: new THREE.Color('#f4d299') },
    },
    vertexShader: /* glsl */ `
      varying vec3 vWorldPos;
      varying vec3 vNormalW;
      varying vec3 vColor;
      void main() {
        vec4 wp = modelMatrix * vec4(position, 1.0);
        vWorldPos = wp.xyz;
        vNormalW = normalize(mat3(modelMatrix) * normal);
        vColor = color;
        gl_Position = projectionMatrix * viewMatrix * wp;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform vec3 uSunDir;
      uniform vec3 uHazeColor;
      varying vec3 vWorldPos;
      varying vec3 vNormalW;
      varying vec3 vColor;

      void main() {
        vec3 n = normalize(vNormalW);
        float ndl = dot(n, normalize(uSunDir));
        float sunWrap = smoothstep(-0.22, 0.82, ndl);

        // Subtle Cotswold ashlar stonework variation
        float course = sin(vWorldPos.y * 14.0) * 0.5 + 0.5;
        float block = sin(vWorldPos.x * 5.5 + floor(vWorldPos.y * 4.5) * 1.7) * 0.5 + 0.5;
        float grain = 1.0 + ((course * 0.6 + block * 0.4) - 0.5) * 0.09;

        vec3 coolShadow = vColor * vec3(0.50, 0.55, 0.68);
        vec3 warmLit = vColor * vec3(1.12, 1.02, 0.86);
        vec3 baseCol = mix(coolShadow, warmLit, sunWrap) * grain;

        // Warm golden afternoon crown rim on upper Chapel buttresses, lanterns & finials
        float crown = smoothstep(0.6, 5.4, vWorldPos.y) * (0.35 + 0.65 * sunWrap);
        baseCol += vec3(1.0, 0.83, 0.52) * crown * 0.24;

        // Exponential warm afternoon aerial-perspective depth haze
        float dist = length(cameraPosition - vWorldPos);
        float distFog = 1.0 - exp(-max(dist - 7.0, 0.0) * 0.044);
        float verticalMist = 1.0 - smoothstep(-1.8, 5.8, vWorldPos.y) * 0.48;
        float hazeFactor = clamp(distFog * verticalMist * 0.65, 0.0, 0.74);

        vec3 finalCol = mix(baseCol, uHazeColor, hazeFactor);
        gl_FragColor = vec4(finalCol, 1.0);
      }
    `,
  });
}

function createWindowHazeCurtainMaterial() {
  return new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    uniforms: {
      uColor: { value: new THREE.Color('#ffdfa4') },
    },
    vertexShader: /* glsl */ `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      uniform vec3 uColor;
      varying vec2 vUv;
      void main() {
        // Gentle golden atmospheric glow strongest near lower horizon and sunlit upper-left window scatter
        float lowerMist = (1.0 - smoothstep(0.0, 0.72, vUv.y)) * 0.22;
        float upperSunGlow = smoothstep(0.35, 1.0, vUv.y) * (1.0 - smoothstep(0.0, 0.85, vUv.x)) * 0.14;
        float alpha = lowerMist + upperSunGlow;
        gl_FragColor = vec4(uColor, alpha);
      }
    `,
  });
}

function createSunbeamMaterial() {
  return new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending,
    uniforms: {
      uTime: { value: 0 },
      uColor: { value: new THREE.Color('#ffd382') },
      uIntensity: { value: 0.135 },
    },
    vertexShader: /* glsl */ `
      varying vec2 vUv;
      varying vec3 vNormalW;
      varying vec3 vViewDir;

      void main() {
        vUv = uv;
        vec4 worldPos = modelMatrix * vec4(position, 1.0);
        vNormalW = normalize(mat3(modelMatrix) * normal);
        vViewDir = normalize(cameraPosition - worldPos.xyz);
        gl_Position = projectionMatrix * viewMatrix * worldPos;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform float uTime;
      uniform vec3 uColor;
      uniform float uIntensity;
      varying vec2 vUv;
      varying vec3 vNormalW;
      varying vec3 vViewDir;

      void main() {
        float along = smoothstep(0.0, 0.32, vUv.y) * (1.0 - smoothstep(0.86, 1.0, vUv.y));
        float across = pow(max(sin(vUv.x * 3.14159265), 0.0), 1.45);
        float ndv = abs(dot(normalize(vNormalW), normalize(vViewDir)));
        float fresnel = smoothstep(0.04, 0.65, ndv);
        float streak = 0.84 + 0.16 * sin(vUv.x * 18.0 + vUv.y * 4.0 + uTime * 0.25);

        float alpha = along * across * fresnel * streak * uIntensity;
        gl_FragColor = vec4(uColor, alpha);
      }
    `,
  });
}

function createDustMotesSystem() {
  const count = 175;
  const rand = mulberry32(8088);
  const positions = new Float32Array(count * 3);
  const seeds = new Float32Array(count * 3);

  for (let i = 0; i < count; i += 1) {
    const t = rand();
    positions[i * 3 + 0] = -1.48 + t * 1.65 + (rand() - 0.5) * 0.82;
    positions[i * 3 + 1] = Math.max(0.58, 2.35 - t * 1.48 + (rand() - 0.5) * 0.52);
    positions[i * 3 + 2] = -2.12 + t * 2.45 + (rand() - 0.5) * 0.62;

    seeds[i * 3 + 0] = rand() * 6.2831;
    seeds[i * 3 + 1] = 0.35 + rand() * 0.85;
    seeds[i * 3 + 2] = 0.55 + rand() * 1.05;
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geo.setAttribute('aSeed', new THREE.BufferAttribute(seeds, 3));

  const mat = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    uniforms: {
      uTime: { value: 0 },
      uPixelRatio: { value: Math.min(window.devicePixelRatio || 1, 2) },
    },
    vertexShader: /* glsl */ `
      attribute vec3 aSeed;
      uniform float uTime;
      uniform float uPixelRatio;
      varying float vAlpha;

      void main() {
        vec3 p = position;
        float ph = aSeed.x;
        float sp = aSeed.y;
        p.x += sin(uTime * 0.28 * sp + ph) * 0.05;
        p.y += cos(uTime * 0.22 * sp + ph * 1.3) * 0.04;
        p.z += sin(uTime * 0.24 * sp + ph * 0.7) * 0.05;

        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        gl_Position = projectionMatrix * mv;
        float dist = max(-mv.z, 0.5);
        gl_PointSize = clamp((7.0 * aSeed.z * uPixelRatio) / dist, 1.1, 3.5);

        float twinkle = 0.45 + 0.55 * sin(uTime * 1.1 * sp + ph * 2.1);
        vAlpha = twinkle * 0.28;
      }
    `,
    fragmentShader: /* glsl */ `
      varying float vAlpha;
      void main() {
        vec2 c = gl_PointCoord - vec2(0.5);
        float soft = 1.0 - smoothstep(0.05, 0.5, length(c));
        gl_FragColor = vec4(1.0, 0.86, 0.58, soft * vAlpha);
      }
    `,
  });

  const points = new THREE.Points(geo, mat);
  points.frustumCulled = false;
  return { points, material: mat };
}

// ============================================================================
// 3. Architectural Room X.8 & King's College Chapel (Batched Static Geometry)
// ============================================================================

function buildGothicWindowAndChapel(staticRoot, mats) {
  const group = new THREE.Group();
  const winCenterX = -1.42;
  const winW = 1.72;
  const winSillY = 0.68;
  const winSpringY = 2.18;
  const winApexY = 2.74;
  const wallDepth = 0.36;

  // Pointed Gothic arch spandrel mask extruded cleanly above spring line
  const archShape = new THREE.Shape();
  const hw = winW * 0.5;
  const archH = winApexY - winSpringY;
  archShape.moveTo(-hw - 0.06, 0);
  archShape.lineTo(hw + 0.06, 0);
  archShape.lineTo(hw + 0.06, archH + 0.08);
  archShape.lineTo(-hw - 0.06, archH + 0.08);
  archShape.closePath();

  const archHole = new THREE.Path();
  archHole.moveTo(-hw, 0);
  archHole.quadraticCurveTo(-hw * 0.88, archH * 0.72, 0, archH);
  archHole.quadraticCurveTo(hw * 0.88, archH * 0.72, hw, 0);
  archHole.closePath();
  archShape.holes.push(archHole);

  const archGeo = new THREE.ExtrudeGeometry(archShape, {
    depth: wallDepth,
    bevelEnabled: false,
    curveSegments: 22,
  });
  const archMesh = new THREE.Mesh(archGeo, mats.limestone);
  archMesh.position.set(winCenterX, winSpringY, BACK_WALL_Z - wallDepth);
  archMesh.castShadow = true;
  archMesh.receiveShadow = true;
  group.add(archMesh);

  // Carved stone window sill & splayed jambs
  const sill = new THREE.Mesh(new THREE.BoxGeometry(winW + 0.24, 0.08, wallDepth + 0.14), mats.limestone);
  sill.position.set(winCenterX, winSillY - 0.02, BACK_WALL_Z - wallDepth * 0.45);
  sill.castShadow = true;
  sill.receiveShadow = true;
  group.add(sill);

  const jambGeo = new THREE.BoxGeometry(0.09, winSpringY - winSillY + 0.06, wallDepth + 0.04);
  for (const side of [-1, 1]) {
    const jamb = new THREE.Mesh(jambGeo, mats.limestone);
    jamb.position.set(winCenterX + side * (hw + 0.04), (winSillY + winSpringY) * 0.5, BACK_WALL_Z - wallDepth * 0.5);
    jamb.castShadow = true;
    jamb.receiveShadow = true;
    group.add(jamb);
  }

  // Vertical mullions & horizontal transoms (cast shadows into Room X.8)
  const mullionZ = BACK_WALL_Z - wallDepth * 0.52;
  for (const mx of [-winW / 6, winW / 6]) {
    const h = winSpringY - winSillY + 0.22;
    const m = new THREE.Mesh(new THREE.BoxGeometry(0.048, h, 0.075), mats.limestone);
    m.position.set(winCenterX + mx, winSillY + h * 0.5, mullionZ);
    m.castShadow = true;
    m.receiveShadow = true;
    group.add(m);
  }
  for (const ty of [1.38, 2.08]) {
    const tr = new THREE.Mesh(new THREE.BoxGeometry(winW, 0.044, 0.07), mats.limestone);
    tr.position.set(winCenterX, ty, mullionZ);
    tr.castShadow = true;
    tr.receiveShadow = true;
    group.add(tr);
  }

  // Gothic rose/quatrefoil stone tracery in pointed arch head
  const roseRing = new THREE.Mesh(new THREE.TorusGeometry(0.145, 0.019, 10, 26), mats.limestone);
  roseRing.position.set(winCenterX, winSpringY + 0.25, mullionZ);
  roseRing.castShadow = true;
  roseRing.receiveShadow = true;
  group.add(roseRing);

  for (const sx of [-0.34, 0.34]) {
    const subRing = new THREE.Mesh(new THREE.TorusGeometry(0.095, 0.015, 8, 20), mats.limestone);
    subRing.position.set(winCenterX + sx, winSpringY + 0.09, mullionZ);
    subRing.castShadow = true;
    subRing.receiveShadow = true;
    group.add(subRing);
  }

  // Subtle tinted crown glass + warm golden afternoon atmospheric haze curtain behind glass
  const glassPlane = new THREE.Mesh(
    new THREE.PlaneGeometry(winW - 0.04, winApexY - winSillY),
    new THREE.MeshStandardMaterial({
      color: '#fff4de',
      transparent: true,
      opacity: 0.1,
      roughness: 0.16,
      metalness: 0.06,
      depthWrite: false,
    })
  );
  glassPlane.position.set(winCenterX, (winSillY + winApexY) * 0.5, mullionZ - 0.01);
  group.add(glassPlane);

  const hazeCurtain = new THREE.Mesh(
    new THREE.PlaneGeometry(winW + 0.4, winApexY - winSillY + 0.3),
    createWindowHazeCurtainMaterial()
  );
  hazeCurtain.position.set(winCenterX, (winSillY + winApexY) * 0.5, BACK_WALL_Z - 0.85);
  group.add(hazeCurtain);

  // Delicate instanced dark-lead diamond quarry cames (1 draw call)
  const leadBarGeo = new THREE.BoxGeometry(0.0055, 0.28, 0.009);
  const leadMatrices = [];
  const dummy = new THREE.Object3D();
  for (const pc of [-0.57, 0.0, 0.57]) {
    for (let row = 0; row < 6; row += 1) {
      const py = winSillY + 0.14 + row * 0.23;
      if (py > 1.98) continue;
      for (const tilt of [-0.62, 0.62]) {
        for (const ox of [-0.11, 0.11]) {
          dummy.position.set(winCenterX + pc + ox, py, mullionZ - 0.005);
          dummy.rotation.set(0, 0, tilt);
          dummy.scale.set(1, 1, 1);
          dummy.updateMatrix();
          leadMatrices.push(dummy.matrix.clone());
        }
      }
    }
  }
  const leadInst = new THREE.InstancedMesh(leadBarGeo, mats.leadMetal, leadMatrices.length);
  leadMatrices.forEach((m, idx) => leadInst.setMatrixAt(idx, m));
  leadInst.instanceMatrix.needsUpdate = true;
  group.add(leadInst);

  // --- Exterior King's College Chapel Diorama (Unified Vertex-Color Shader -> 1 Draw Call!) ---
  const chapel = new THREE.Group();
  chapel.position.set(-8.2, -1.65, -19.5);
  chapel.rotation.y = 0.26;
  chapel.scale.setScalar(0.72);

  const chapelMat = createExteriorAtmosphericMaterial();
  const cStoneExt = new THREE.Color('#efd6a6');
  const cStoneShadow = new THREE.Color('#cbb286');
  const cStained = new THREE.Color('#4a5f78');
  const cRoofLead = new THREE.Color('#707a84');
  const cLawn = new THREE.Color('#6f804e');
  const cFoliage = new THREE.Color('#4d613d');

  const addChapelPart = (geo, col, x, y, z, rx = 0, ry = 0, rz = 0, sx = 1, sy = 1, sz = 1) => {
    const m = new THREE.Mesh(geo, chapelMat);
    m.userData.vColor = col;
    m.position.set(x, y, z);
    m.rotation.set(rx, ry, rz);
    m.scale.set(sx, sy, sz);
    chapel.add(m);
    return m;
  };

  const naveW = 12.6;
  const naveH = 5.4;
  const naveD = 4.2;
  addChapelPart(new THREE.BoxGeometry(naveW, naveH, naveD), cStoneExt, 0, naveH * 0.5, 0);
  addChapelPart(new THREE.CylinderGeometry(2.1, 2.1, naveW - 0.4, 3), cRoofLead, 0, naveH + 0.65, 0, 0, 0, Math.PI * 0.5, 0.65, 1, 1);

  const bayCount = 9;
  for (let i = 0; i <= bayCount; i += 1) {
    const bx = -naveW * 0.48 + (i / bayCount) * (naveW * 0.96);
    addChapelPart(new THREE.BoxGeometry(0.36, 2.9, 0.72), cStoneShadow, bx, 1.45, naveD * 0.5 + 0.26);
    addChapelPart(new THREE.BoxGeometry(0.26, 2.7, 0.44), cStoneExt, bx, 4.15, naveD * 0.5 + 0.16);
    addChapelPart(new THREE.ConeGeometry(0.16, 1.15, 6), cStoneExt, bx, naveH + 0.62, naveD * 0.5 + 0.14);

    if (i < bayCount) {
      const wx = bx + (naveW * 0.96) / (bayCount * 2);
      addChapelPart(new THREE.BoxGeometry(0.82, 3.4, 0.14), cStained, wx, 3.1, naveD * 0.5 + 0.02);
    }
  }

  for (const [tx, tz] of [
    [-naveW * 0.5, naveD * 0.5],
    [naveW * 0.5, naveD * 0.5],
    [-naveW * 0.5, -naveD * 0.5],
    [naveW * 0.5, -naveD * 0.5],
  ]) {
    addChapelPart(new THREE.CylinderGeometry(0.54, 0.62, 7.6, 8), cStoneExt, tx, 3.8, tz);
    addChapelPart(new THREE.CylinderGeometry(0.66, 0.62, 0.34, 8), cStoneShadow, tx, 7.55, tz);
    addChapelPart(new THREE.CylinderGeometry(0.46, 0.5, 1.05, 8), cStoneExt, tx, 8.2, tz);
    addChapelPart(new THREE.ConeGeometry(0.52, 1.25, 8), cRoofLead, tx, 9.3, tz);
    addChapelPart(new THREE.CylinderGeometry(0.03, 0.05, 0.85, 6), cStoneExt, tx, 10.25, tz);
  }

  addChapelPart(new THREE.PlaneGeometry(46, 28), cLawn, 0, 0.01, 2, -Math.PI * 0.5, 0, 0);
  addChapelPart(new THREE.BoxGeometry(26, 1.1, 0.4), cStoneShadow, 0, 0.55, 8.8);

  for (const [fx, fy, fz, fr] of [
    [-11.2, 2.0, 2.2, 2.2],
    [-9.4, 1.5, 4.2, 1.5],
    [10.4, 2.2, 2.4, 2.3],
    [12.0, 1.6, 4.4, 1.6],
  ]) {
    addChapelPart(new THREE.SphereGeometry(fr, 12, 10), cFoliage, fx, fy, fz, 0, 0, 0, 1.2, 0.85, 1.0);
  }

  group.add(chapel);
  staticRoot.add(group);
}

function buildRoomArchitecture(staticRoot, mats) {
  const room = new THREE.Group();

  // Parquet floor (oversized slightly beyond walls for 100% light-tight seams)
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(ROOM_W + 0.8, ROOM_D + 0.8), mats.parquet);
  floor.rotation.x = -Math.PI * 0.5;
  floor.receiveShadow = true;
  room.add(floor);

  // Woven Persian Study Rug & Fringes
  const rug = new THREE.Mesh(new THREE.BoxGeometry(3.25, 0.01, 2.35), mats.persianRug);
  rug.position.set(0.0, 0.005, 0.22);
  rug.receiveShadow = true;
  room.add(rug);

  const fringeMat = new THREE.MeshStandardMaterial({ color: '#d7c8aa', roughness: 0.92 });
  for (const sx of [-1.655, 1.655]) {
    const fringe = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.005, 2.31), fringeMat);
    fringe.position.set(sx, 0.003, 0.22);
    fringe.receiveShadow = true;
    room.add(fringe);
  }

  // Ceiling + Transverse Dark Oak Tudor Beams
  const ceiling = new THREE.Mesh(new THREE.PlaneGeometry(ROOM_W + 0.4, ROOM_D + 0.4), mats.plaster);
  ceiling.rotation.x = Math.PI * 0.5;
  ceiling.position.y = ROOM_H;
  room.add(ceiling);

  for (let i = 0; i < 5; i += 1) {
    const beam = new THREE.Mesh(new THREE.BoxGeometry(ROOM_W, 0.18, 0.22), mats.darkOak);
    beam.position.set(0, ROOM_H - 0.09, -1.9 + i * 1.15);
    beam.receiveShadow = true;
    room.add(beam);
  }

  const addWallBox = (w, h, d, x, y, z, mat, cast = false) => {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    mesh.position.set(x, y, z);
    mesh.receiveShadow = true;
    mesh.castShadow = cast;
    room.add(mesh);
    return mesh;
  };

  // Back wall framing Gothic window (casts clean sunlight aperture shadow!)
  const wallT = 0.36;
  const bz = BACK_WALL_Z - wallT * 0.5;
  addWallBox(0.92, ROOM_H, wallT, -2.74, ROOM_H * 0.5, bz, mats.plaster, true);
  addWallBox(3.76, ROOM_H, wallT, 1.32, ROOM_H * 0.5, bz, mats.plaster, true);
  addWallBox(1.74, 0.68, wallT, -1.42, 0.34, bz, mats.plaster, true);
  addWallBox(1.74, ROOM_H - 2.74, wallT, -1.42, 2.74 + (ROOM_H - 2.74) * 0.5, bz, mats.plaster, true);

  // Side & front walls
  const leftWall = new THREE.Mesh(new THREE.PlaneGeometry(ROOM_D + 0.8, ROOM_H + 0.2), mats.plaster);
  leftWall.rotation.y = Math.PI * 0.5;
  leftWall.position.set(-ROOM_W * 0.5, ROOM_H * 0.5, 0.55);
  leftWall.receiveShadow = true;
  room.add(leftWall);

  const rightWall = new THREE.Mesh(new THREE.PlaneGeometry(ROOM_D + 0.8, ROOM_H + 0.2), mats.plaster);
  rightWall.rotation.y = -Math.PI * 0.5;
  rightWall.position.set(ROOM_W * 0.5, ROOM_H * 0.5, 0.55);
  rightWall.receiveShadow = true;
  room.add(rightWall);

  const frontWall = new THREE.Mesh(new THREE.PlaneGeometry(ROOM_W, ROOM_H), mats.plaster);
  frontWall.rotation.y = Math.PI;
  frontWall.position.set(0, ROOM_H * 0.5, 3.45);
  room.add(frontWall);

  // Dark Oak Wainscoting Paneling + Dado Rail + Raised Stiles
  const wainH = 1.06;
  addWallBox(3.76, wainH, 0.04, 1.32, wainH * 0.5, BACK_WALL_Z + 0.02, mats.darkOak);
  addWallBox(3.76, 0.055, 0.075, 1.32, wainH + 0.02, BACK_WALL_Z + 0.035, mats.oakDesk);
  addWallBox(0.92, wainH, 0.04, -2.74, wainH * 0.5, BACK_WALL_Z + 0.02, mats.darkOak);
  addWallBox(0.92, 0.055, 0.075, -2.74, wainH + 0.02, BACK_WALL_Z + 0.035, mats.oakDesk);
  addWallBox(1.74, 0.64, 0.04, -1.42, 0.32, BACK_WALL_Z + 0.02, mats.darkOak);

  for (let x = -0.35; x <= 2.95; x += 0.55) {
    addWallBox(0.06, wainH - 0.14, 0.02, x, wainH * 0.5, BACK_WALL_Z + 0.045, mats.oakDesk);
  }
  addWallBox(0.04, wainH, ROOM_D, -ROOM_W * 0.5 + 0.02, wainH * 0.5, 0.55, mats.darkOak);
  addWallBox(0.04, wainH, ROOM_D, ROOM_W * 0.5 - 0.02, wainH * 0.5, 0.55, mats.darkOak);
  addWallBox(ROOM_W, 0.11, 0.11, 0, ROOM_H - 0.055, BACK_WALL_Z + 0.055, mats.darkOak);

  // Wall-Mounted Mathematical Slate Blackboard
  const boardGroup = new THREE.Group();
  boardGroup.position.set(1.06, 1.98, BACK_WALL_Z + 0.045);

  const bw = 1.9;
  const bh = 1.18;
  const slate = new THREE.Mesh(new THREE.BoxGeometry(bw, bh, 0.024), mats.blackboard);
  slate.receiveShadow = true;
  boardGroup.add(slate);

  const fT = 0.065;
  const fD = 0.055;
  const topFrame = new THREE.Mesh(new THREE.BoxGeometry(bw + fT * 2, fT, fD), mats.oakDesk);
  topFrame.position.set(0, bh * 0.5 + fT * 0.5, 0.01);
  boardGroup.add(topFrame);

  const botFrame = new THREE.Mesh(new THREE.BoxGeometry(bw + fT * 2, fT, fD + 0.05), mats.oakDesk);
  botFrame.position.set(0, -bh * 0.5 - fT * 0.5, 0.032);
  boardGroup.add(botFrame);

  for (const sx of [-1, 1]) {
    const sideF = new THREE.Mesh(new THREE.BoxGeometry(fT, bh, fD), mats.oakDesk);
    sideF.position.set(sx * (bw * 0.5 + fT * 0.5), 0, 0.01);
    boardGroup.add(sideF);
  }

  const chalkMat = new THREE.MeshStandardMaterial({ color: '#f2efe6', roughness: 0.95 });
  for (let c = 0; c < 3; c += 1) {
    const chalk = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.075, 8), chalkMat);
    chalk.rotation.z = Math.PI * 0.5;
    chalk.rotation.y = (c - 1) * 0.14;
    chalk.position.set(-0.45 + c * 0.11, -bh * 0.5 - 0.018, 0.062);
    boardGroup.add(chalk);
  }
  const dusterWood = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.032, 0.048), mats.oakDesk);
  dusterWood.position.set(0.42, -bh * 0.5 - 0.012, 0.064);
  boardGroup.add(dusterWood);
  const dusterFelt = new THREE.Mesh(
    new THREE.BoxGeometry(0.136, 0.012, 0.044),
    new THREE.MeshStandardMaterial({ color: '#3b3632', roughness: 0.96 })
  );
  dusterFelt.position.set(0.42, -bh * 0.5 - 0.03, 0.064);
  boardGroup.add(dusterFelt);
  room.add(boardGroup);

  // Framed Cambridge Campus Etching on Left Pier
  const frameGroup = new THREE.Group();
  frameGroup.position.set(-2.74, 1.88, BACK_WALL_Z + 0.03);
  const etchingArt = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.58, 0.015), mats.etching);
  frameGroup.add(etchingArt);
  const picFrame = new THREE.Mesh(new THREE.BoxGeometry(0.52, 0.64, 0.028), mats.darkOak);
  picFrame.position.z = -0.01;
  frameGroup.add(picFrame);
  room.add(frameGroup);

  // Floor-to-Ceiling Mahogany Library Bookshelves (merged to 1 draw call!) + 1 InstancedMesh for ~380 Books!
  const bookTransforms = [];
  const bookColors = [];
  const rand = mulberry32(193611);
  const vintagePalette = [
    new THREE.Color('#6b221c'),
    new THREE.Color('#1d3b2b'),
    new THREE.Color('#20314a'),
    new THREE.Color('#7a5328'),
    new THREE.Color('#5a4632'),
    new THREE.Color('#8c6b35'),
    new THREE.Color('#393532'),
    new THREE.Color('#a49272'),
    new THREE.Color('#4d2429'),
  ];

  function addBookcase({ x, z, rotY, width, height, depth, shelves }) {
    const bc = new THREE.Group();
    bc.position.set(x, 0, z);
    bc.rotation.y = rotY;

    const back = new THREE.Mesh(new THREE.BoxGeometry(width, height, 0.025), mats.mahogany);
    back.position.set(0, height * 0.5, -depth * 0.5 + 0.012);
    back.receiveShadow = true;
    bc.add(back);

    const sideGeo = new THREE.BoxGeometry(0.05, height, depth);
    for (const sx of [-width * 0.5 + 0.025, 0, width * 0.5 - 0.025]) {
      const side = new THREE.Mesh(sideGeo, mats.mahogany);
      side.position.set(sx, height * 0.5, 0);
      side.receiveShadow = true;
      bc.add(side);
    }

    const crown = new THREE.Mesh(new THREE.BoxGeometry(width + 0.08, 0.11, depth + 0.06), mats.mahogany);
    crown.position.set(0, height - 0.04, 0.02);
    bc.add(crown);

    const plinth = new THREE.Mesh(new THREE.BoxGeometry(width + 0.04, 0.12, depth + 0.02), mats.mahogany);
    plinth.position.set(0, 0.06, 0.01);
    bc.add(plinth);

    const shelfGap = (height - 0.28) / shelves;
    const dummy = new THREE.Object3D();
    bc.updateMatrixWorld(true);

    for (let s = 0; s < shelves; s += 1) {
      const sy = 0.14 + s * shelfGap;
      const shelf = new THREE.Mesh(new THREE.BoxGeometry(width - 0.06, 0.032, depth - 0.02), mats.mahogany);
      shelf.position.set(0, sy, 0);
      shelf.receiveShadow = true;
      bc.add(shelf);

      for (const [xStart, xEnd] of [
        [-width * 0.5 + 0.065, -0.04],
        [0.04, width * 0.5 - 0.065],
      ]) {
        let cursor = xStart + 0.01;
        while (cursor < xEnd - 0.04) {
          if (rand() < 0.09) {
            cursor += 0.045 + rand() * 0.05;
            continue;
          }
          const thick = 0.026 + rand() * 0.032;
          if (cursor + thick > xEnd) break;
          const bhBook = Math.min(shelfGap - 0.06, 0.2 + rand() * 0.12);
          const bdBook = depth * (0.64 + rand() * 0.22);
          const tilt = rand() < 0.08 ? (rand() - 0.5) * 0.14 : 0;

          dummy.position.set(cursor + thick * 0.5, sy + 0.016 + bhBook * 0.5, -depth * 0.5 + 0.04 + bdBook * 0.5);
          dummy.rotation.set(0, 0, tilt);
          dummy.scale.set(thick, bhBook, bdBook);
          dummy.updateMatrix();

          bookTransforms.push(new THREE.Matrix4().multiplyMatrices(bc.matrixWorld, dummy.matrix));
          const baseCol = vintagePalette[Math.floor(rand() * vintagePalette.length)].clone();
          baseCol.offsetHSL((rand() - 0.5) * 0.03, (rand() - 0.5) * 0.08, (rand() - 0.5) * 0.06);
          bookColors.push(baseCol);
          cursor += thick + 0.003;
        }
      }
    }
    room.add(bc);
  }

  addBookcase({ x: ROOM_W * 0.5 - 0.2, z: -0.95, rotY: -Math.PI * 0.5, width: 2.15, height: 3.15, depth: 0.36, shelves: 7 });
  addBookcase({ x: ROOM_W * 0.5 - 0.2, z: 1.3, rotY: -Math.PI * 0.5, width: 2.15, height: 3.15, depth: 0.36, shelves: 7 });
  addBookcase({ x: -ROOM_W * 0.5 + 0.2, z: -0.35, rotY: Math.PI * 0.5, width: 2.35, height: 2.88, depth: 0.36, shelves: 6 });

  const bookInst = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), mats.bookSpine, bookTransforms.length);
  bookInst.castShadow = false;
  bookInst.receiveShadow = true;
  for (let i = 0; i < bookTransforms.length; i += 1) {
    bookInst.setMatrixAt(i, bookTransforms[i]);
    bookInst.setColorAt(i, bookColors[i]);
  }
  bookInst.instanceMatrix.needsUpdate = true;
  if (bookInst.instanceColor) bookInst.instanceColor.needsUpdate = true;
  room.add(bookInst);

  // Hanging antique brass study pendant
  const pendant = new THREE.Group();
  pendant.position.set(0.35, ROOM_H, -0.15);
  const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.58, 10), mats.antiqueBrass);
  rod.position.y = -0.29;
  pendant.add(rod);
  const canopy = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.05, 0.05, 16), mats.antiqueBrass);
  canopy.position.y = -0.025;
  pendant.add(canopy);
  const domeShade = new THREE.Mesh(
    new THREE.SphereGeometry(0.18, 18, 12, 0, Math.PI * 2, 0, Math.PI * 0.58),
    new THREE.MeshStandardMaterial({
      color: '#f2e0b8',
      emissive: '#ffcf7d',
      emissiveIntensity: 0.45,
      roughness: 0.38,
    })
  );
  domeShade.position.y = -0.62;
  pendant.add(domeShade);
  room.add(pendant);

  staticRoot.add(room);
}

// ============================================================================
// 4. Aged Oak Desk (y = 0.76), Banker's Lamp, Desk Props, Contact AO & Chair
// ============================================================================

function buildStudyDeskAndProps(staticRoot, mats) {
  const desk = new THREE.Group();

  const deskW = 1.88;
  const deskD = 0.96;
  const topThickness = 0.052;
  const topSlab = new THREE.Mesh(new THREE.BoxGeometry(deskW, topThickness, deskD), mats.oakDesk);
  topSlab.position.set(0, DESK_TOP_Y - topThickness * 0.5 - 0.0015, 0);
  topSlab.castShadow = true;
  topSlab.receiveShadow = true;
  desk.add(topSlab);

  const trimT = 0.026;
  const trimH = 0.036;
  const frontTrim = new THREE.Mesh(new THREE.BoxGeometry(deskW + 0.04, trimH, trimT), mats.darkOak);
  frontTrim.position.set(0, DESK_TOP_Y - 0.022, deskD * 0.5 + trimT * 0.35);
  frontTrim.castShadow = true;
  frontTrim.receiveShadow = true;
  desk.add(frontTrim);

  const backTrim = frontTrim.clone();
  backTrim.position.z = -deskD * 0.5 - trimT * 0.35;
  desk.add(backTrim);

  for (const sx of [-1, 1]) {
    const sideTrim = new THREE.Mesh(new THREE.BoxGeometry(trimT, trimH, deskD + 0.04), mats.darkOak);
    sideTrim.position.set(sx * (deskW * 0.5 + trimT * 0.35), DESK_TOP_Y - 0.022, 0);
    sideTrim.castShadow = true;
    sideTrim.receiveShadow = true;
    desk.add(sideTrim);
  }

  // Inlaid Forest-Green Morocco Leather Blotter
  const blotter = new THREE.Mesh(new THREE.BoxGeometry(1.16, 0.0024, 0.62), mats.leatherBlotter);
  blotter.position.set(0.0, DESK_TOP_Y - 0.0012, 0.02);
  blotter.receiveShadow = true;
  desk.add(blotter);

  // Pedestals & Drawers
  const pedW = 0.46;
  const pedH = DESK_TOP_Y - topThickness - 0.01;
  const pedD = 0.84;
  for (const sx of [-1, 1]) {
    const px = sx * 0.65;
    const ped = new THREE.Mesh(new THREE.BoxGeometry(pedW, pedH, pedD), mats.oakDesk);
    ped.position.set(px, pedH * 0.5 + 0.01, 0);
    ped.castShadow = true;
    ped.receiveShadow = true;
    desk.add(ped);

    const plinth = new THREE.Mesh(new THREE.BoxGeometry(pedW + 0.04, 0.055, pedD + 0.04), mats.darkOak);
    plinth.position.set(px, 0.032, 0);
    plinth.castShadow = true;
    plinth.receiveShadow = true;
    desk.add(plinth);

    for (const dy of [0.57, 0.38, 0.19]) {
      const face = new THREE.Mesh(new THREE.BoxGeometry(pedW - 0.06, 0.155, 0.024), mats.oakDesk);
      face.position.set(px, dy, pedD * 0.5 + 0.008);
      face.receiveShadow = true;
      desk.add(face);

      const plate = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.028, 0.008), mats.antiqueBrass);
      plate.position.set(px, dy, pedD * 0.5 + 0.022);
      desk.add(plate);

      const pull = new THREE.Mesh(new THREE.TorusGeometry(0.032, 0.0055, 8, 14, Math.PI), mats.antiqueBrass);
      pull.rotation.z = Math.PI;
      pull.rotation.x = 0.35;
      pull.position.set(px, dy + 0.002, pedD * 0.5 + 0.028);
      desk.add(pull);
    }
  }

  const centerDrawer = new THREE.Mesh(new THREE.BoxGeometry(0.84, 0.09, 0.78), mats.oakDesk);
  centerDrawer.position.set(0, DESK_TOP_Y - 0.1, -0.02);
  desk.add(centerDrawer);

  const centerPull = new THREE.Mesh(new THREE.TorusGeometry(0.028, 0.005, 8, 12, Math.PI), mats.antiqueBrass);
  centerPull.rotation.z = Math.PI;
  centerPull.rotation.x = 0.35;
  centerPull.position.set(0, DESK_TOP_Y - 0.1, 0.38);
  desk.add(centerPull);

  const modesty = new THREE.Mesh(new THREE.BoxGeometry(0.88, 0.56, 0.03), mats.darkOak);
  modesty.position.set(0, 0.36, -0.38);
  modesty.receiveShadow = true;
  desk.add(modesty);

  // --- Glowing Emerald-Glass Banker's Desk Lamp ---
  const lamp = new THREE.Group();
  lamp.position.set(-0.68, DESK_TOP_Y, -0.25);
  lamp.rotation.y = 0.86;

  const basePts = [
    new THREE.Vector2(0.001, 0.0),
    new THREE.Vector2(0.095, 0.0),
    new THREE.Vector2(0.095, 0.016),
    new THREE.Vector2(0.078, 0.026),
    new THREE.Vector2(0.062, 0.036),
    new THREE.Vector2(0.024, 0.052),
    new THREE.Vector2(0.015, 0.065),
  ];
  const lampBase = new THREE.Mesh(new THREE.LatheGeometry(basePts, 24), mats.antiqueBrass);
  lampBase.castShadow = true;
  lampBase.receiveShadow = true;
  lamp.add(lampBase);

  const stemCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0, 0.06, 0),
    new THREE.Vector3(0, 0.22, -0.02),
    new THREE.Vector3(0, 0.34, 0.02),
    new THREE.Vector3(0, 0.38, 0.065),
  ]);
  const stem = new THREE.Mesh(new THREE.TubeGeometry(stemCurve, 18, 0.01, 10, false), mats.antiqueBrass);
  stem.castShadow = true;
  lamp.add(stem);

  const shadeGroup = new THREE.Group();
  shadeGroup.position.set(0, 0.355, 0.075);
  shadeGroup.rotation.x = 0.34;

  const shadeOuter = new THREE.Mesh(
    new THREE.CylinderGeometry(0.064, 0.078, 0.22, 22, 1, true, -Math.PI * 0.45, Math.PI * 0.9),
    new THREE.MeshPhysicalMaterial({
      color: '#0b5832',
      emissive: '#094525',
      emissiveIntensity: 0.65,
      roughness: 0.14,
      metalness: 0.06,
      clearcoat: 0.9,
      clearcoatRoughness: 0.08,
      side: THREE.FrontSide,
    })
  );
  shadeOuter.rotation.z = Math.PI * 0.5;
  shadeOuter.castShadow = true;
  shadeGroup.add(shadeOuter);

  const shadeInner = new THREE.Mesh(
    new THREE.CylinderGeometry(0.061, 0.075, 0.216, 18, 1, true, -Math.PI * 0.44, Math.PI * 0.88),
    new THREE.MeshStandardMaterial({
      color: '#fff2cc',
      emissive: '#ffd584',
      emissiveIntensity: 1.45,
      roughness: 0.35,
      side: THREE.BackSide,
    })
  );
  shadeInner.rotation.z = Math.PI * 0.5;
  shadeGroup.add(shadeInner);

  for (const sx of [-0.112, 0.112]) {
    const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.014, 12), mats.antiqueBrass);
    cap.rotation.z = Math.PI * 0.5;
    cap.position.set(sx, 0.01, 0);
    shadeGroup.add(cap);
  }

  const bulb = new THREE.Mesh(
    new THREE.SphereGeometry(0.025, 12, 10),
    new THREE.MeshStandardMaterial({
      color: '#fff6da',
      emissive: '#ffcf76',
      emissiveIntensity: 2.2,
      roughness: 0.2,
    })
  );
  bulb.position.set(0, -0.01, 0.005);
  shadeGroup.add(bulb);

  const chain = new THREE.Mesh(new THREE.CylinderGeometry(0.0022, 0.0022, 0.095, 6), mats.antiqueBrass);
  chain.position.set(0.028, -0.075, -0.01);
  shadeGroup.add(chain);
  const acorn = new THREE.Mesh(new THREE.SphereGeometry(0.0065, 8, 8), mats.antiqueBrass);
  acorn.position.set(0.028, -0.125, -0.01);
  shadeGroup.add(acorn);

  lamp.add(shadeGroup);
  desk.add(lamp);

  // --- Handwritten 1936 Entscheidungsproblem Parchment Sheets ---
  function makeCurledSheet(w, h, mat) {
    const geo = new THREE.PlaneGeometry(w, h, 8, 8);
    const pos = geo.attributes.position;
    for (let i = 0; i < pos.count; i += 1) {
      const px = pos.getX(i);
      const py = pos.getY(i);
      const corner = Math.max(0, (Math.abs(px) / (w * 0.5)) * (Math.abs(py) / (h * 0.5)) - 0.45);
      pos.setZ(i, corner * 0.0045);
    }
    geo.computeVertexNormals();
    const sheet = new THREE.Mesh(geo, mat);
    sheet.rotation.x = -Math.PI * 0.5;
    sheet.receiveShadow = true;
    return sheet;
  }

  const sheetMain = makeCurledSheet(0.28, 0.36, mats.parchmentA);
  sheetMain.position.set(0.62, DESK_TOP_Y + 0.0038, 0.14);
  sheetMain.rotation.z = -0.16;
  desk.add(sheetMain);

  const sheetSecond = makeCurledSheet(0.26, 0.34, mats.parchmentB);
  sheetSecond.position.set(0.65, DESK_TOP_Y + 0.0024, -0.06);
  sheetSecond.rotation.z = 0.22;
  desk.add(sheetSecond);

  const underSheet = new THREE.Mesh(
    new THREE.BoxGeometry(0.27, 0.002, 0.35),
    new THREE.MeshStandardMaterial({ color: '#dccaa4', roughness: 0.92 })
  );
  underSheet.position.set(0.63, DESK_TOP_Y + 0.0014, 0.12);
  underSheet.rotation.y = -0.09;
  desk.add(underSheet);

  // --- Brass Inkwell, Faceted Glass Inkpot & Goose-Feather Quill ---
  const inkGroup = new THREE.Group();
  inkGroup.position.set(0.75, DESK_TOP_Y, -0.27);

  const tray = new THREE.Mesh(new THREE.CylinderGeometry(0.072, 0.064, 0.01, 20), mats.antiqueBrass);
  tray.position.y = 0.005;
  tray.receiveShadow = true;
  inkGroup.add(tray);

  const inkBottle = new THREE.Mesh(
    new THREE.CylinderGeometry(0.032, 0.036, 0.056, 8),
    new THREE.MeshStandardMaterial({
      color: '#181e2a',
      roughness: 0.14,
      metalness: 0.24,
    })
  );
  inkBottle.position.y = 0.038;
  inkBottle.castShadow = true;
  inkGroup.add(inkBottle);

  const collarBrass = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.024, 0.016, 14), mats.antiqueBrass);
  collarBrass.position.y = 0.072;
  inkGroup.add(collarBrass);

  const openLid = new THREE.Mesh(new THREE.CylinderGeometry(0.021, 0.021, 0.007, 14), mats.antiqueBrass);
  openLid.position.set(-0.024, 0.09, -0.006);
  openLid.rotation.z = 1.25;
  inkGroup.add(openLid);

  const quillGroup = new THREE.Group();
  quillGroup.position.set(0.004, 0.068, 0.004);
  quillGroup.rotation.set(0.18, 0.4, -0.44);

  const quillMat = new THREE.MeshStandardMaterial({ color: '#f5efe0', roughness: 0.74, side: THREE.DoubleSide });
  const shaftCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0, -0.03, 0),
    new THREE.Vector3(0.006, 0.07, 0.002),
    new THREE.Vector3(0.022, 0.17, 0.005),
    new THREE.Vector3(0.048, 0.25, 0.012),
  ]);
  const rachis = new THREE.Mesh(new THREE.TubeGeometry(shaftCurve, 14, 0.0028, 6, false), quillMat);
  quillGroup.add(rachis);

  const vaneShape = new THREE.Shape();
  vaneShape.moveTo(0, 0.07);
  vaneShape.quadraticCurveTo(0.034, 0.15, 0.048, 0.25);
  vaneShape.quadraticCurveTo(0.008, 0.21, -0.012, 0.13);
  vaneShape.closePath();
  const vane = new THREE.Mesh(new THREE.ShapeGeometry(vaneShape), quillMat);
  quillGroup.add(vane);
  inkGroup.add(quillGroup);
  desk.add(inkGroup);

  // --- Stacked Reference Books, Cambridge Teacup & Boxwood Slide Rule ---
  const deskBookA = new THREE.Mesh(
    new THREE.BoxGeometry(0.22, 0.042, 0.29),
    new THREE.MeshStandardMaterial({ color: '#5b1f1c', roughness: 0.75 })
  );
  deskBookA.position.set(-0.74, DESK_TOP_Y + 0.021, 0.14);
  deskBookA.rotation.y = 0.22;
  deskBookA.castShadow = true;
  deskBookA.receiveShadow = true;
  desk.add(deskBookA);

  const deskBookB = new THREE.Mesh(
    new THREE.BoxGeometry(0.19, 0.034, 0.25),
    new THREE.MeshStandardMaterial({ color: '#1d3848', roughness: 0.74 })
  );
  deskBookB.position.set(-0.73, DESK_TOP_Y + 0.059, 0.15);
  deskBookB.rotation.y = -0.14;
  deskBookB.castShadow = true;
  desk.add(deskBookB);

  const cupGroup = new THREE.Group();
  cupGroup.position.set(-0.56, DESK_TOP_Y, 0.34);
  const ceramicMat = new THREE.MeshStandardMaterial({ color: '#efe7d6', roughness: 0.22, metalness: 0.05 });
  const saucer = new THREE.Mesh(new THREE.CylinderGeometry(0.062, 0.042, 0.012, 20), ceramicMat);
  saucer.position.y = 0.006;
  saucer.castShadow = true;
  cupGroup.add(saucer);
  const cupBody = new THREE.Mesh(new THREE.CylinderGeometry(0.041, 0.029, 0.052, 20), ceramicMat);
  cupBody.position.y = 0.036;
  cupBody.castShadow = true;
  cupGroup.add(cupBody);
  const teaDisk = new THREE.Mesh(
    new THREE.CircleGeometry(0.037, 16),
    new THREE.MeshStandardMaterial({ color: '#4c260d', roughness: 0.12, metalness: 0.1 })
  );
  teaDisk.rotation.x = -Math.PI * 0.5;
  teaDisk.position.y = 0.057;
  cupGroup.add(teaDisk);
  const cupHandle = new THREE.Mesh(new THREE.TorusGeometry(0.016, 0.004, 8, 12, Math.PI * 1.25), ceramicMat);
  cupHandle.rotation.z = -Math.PI * 0.6;
  cupHandle.position.set(0.04, 0.038, 0);
  cupGroup.add(cupHandle);
  desk.add(cupGroup);

  const slideRule = new THREE.Mesh(
    new THREE.BoxGeometry(0.28, 0.008, 0.036),
    new THREE.MeshStandardMaterial({ color: '#d7be8e', roughness: 0.48 })
  );
  slideRule.position.set(0.42, DESK_TOP_Y + 0.0045, 0.36);
  slideRule.rotation.y = 0.18;
  desk.add(slideRule);

  // --- Soft Baked Radial Contact-Shadow AO Planes (1 single merged draw call!) ---
  // No polygonOffset so contact shadows NEVER bleed upward through thin desk manuscripts!
  const aoGroup = new THREE.Group();
  const addContactShadow = (x, y, z, sx, sz, rotY = 0) => {
    const p = new THREE.Mesh(new THREE.PlaneGeometry(sx, sz), mats.contactShadow);
    p.rotation.order = 'YXZ';
    p.rotation.x = -Math.PI * 0.5;
    p.rotation.y = rotY;
    p.position.set(x, y, z);
    aoGroup.add(p);
  };
  // Grounded AO directly beneath UTM walnut plinth
  addContactShadow(0.0, DESK_TOP_Y + 0.0005, 0.0, 0.78, 0.48);
  // Banker's lamp brass base
  addContactShadow(-0.68, DESK_TOP_Y + 0.0007, -0.25, 0.27, 0.27);
  // Teacup & saucer
  addContactShadow(-0.56, DESK_TOP_Y + 0.0008, 0.34, 0.18, 0.18);
  // Stacked reference volumes
  addContactShadow(-0.74, DESK_TOP_Y + 0.0007, 0.14, 0.33, 0.41, 0.22);
  // Brass inkwell tray
  addContactShadow(0.75, DESK_TOP_Y + 0.0008, -0.27, 0.21, 0.21);
  // Boxwood slide rule
  addContactShadow(0.42, DESK_TOP_Y + 0.0007, 0.36, 0.33, 0.075, 0.18);
  // Desk pedestals & study chair grounding shadows on Persian rug
  addContactShadow(-0.65, 0.011, 0.0, 0.68, 1.06);
  addContactShadow(0.65, 0.011, 0.0, 0.68, 1.06);
  addContactShadow(-0.82, 0.011, 0.88, 0.62, 0.60, 0.62);
  desk.add(aoGroup);

  staticRoot.add(desk);

  // --- Wooden Cambridge Banker's / Windsor Study Chair ---
  const chair = new THREE.Group();
  chair.position.set(-0.82, 0.008, 0.88);
  chair.rotation.y = 0.62;

  const seatY = 0.45;
  const seat = new THREE.Mesh(new THREE.BoxGeometry(0.48, 0.042, 0.45), mats.oakDesk);
  seat.position.set(0, seatY, 0);
  seat.castShadow = true;
  seat.receiveShadow = true;
  chair.add(seat);

  for (const [lx, lz, rx, rz] of [
    [-0.19, -0.18, 0.06, -0.06],
    [0.19, -0.18, -0.06, -0.06],
    [-0.19, 0.18, 0.06, 0.06],
    [0.19, 0.18, -0.06, 0.06],
  ]) {
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.015, seatY, 10), mats.darkOak);
    leg.position.set(lx, seatY * 0.5, lz);
    leg.rotation.set(rz, 0, rx);
    chair.add(leg);
  }

  for (const lx of [-0.19, 0.19]) {
    const rail = new THREE.Mesh(new THREE.CylinderGeometry(0.011, 0.011, 0.36, 8), mats.darkOak);
    rail.rotation.x = Math.PI * 0.5;
    rail.position.set(lx, 0.18, 0);
    chair.add(rail);
  }
  const crossRail = new THREE.Mesh(new THREE.CylinderGeometry(0.011, 0.011, 0.38, 8), mats.darkOak);
  crossRail.rotation.z = Math.PI * 0.5;
  crossRail.position.set(0, 0.18, 0);
  chair.add(crossRail);

  const crest = new THREE.Mesh(new THREE.TorusGeometry(0.24, 0.024, 10, 22, Math.PI * 1.08), mats.oakDesk);
  crest.rotation.x = Math.PI * 0.5;
  crest.rotation.z = -0.12;
  crest.position.set(0, seatY + 0.38, -0.02);
  chair.add(crest);

  for (let i = 0; i < 7; i += 1) {
    const angle = 0.2 + (i / 6) * (Math.PI - 0.4);
    const spindle = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 0.009, 0.37, 8), mats.darkOak);
    spindle.position.set(Math.cos(angle) * 0.22, seatY + 0.19, Math.sin(angle) * 0.22 - 0.02);
    chair.add(spindle);
  }
  staticRoot.add(chair);
}

function buildVolumetricSunbeams(staticRoot) {
  const beamMat = createSunbeamMaterial();
  const group = new THREE.Group();

  for (const s of [
    { x: -1.68, y: 1.48, z: -1.1, w: 0.72, h: 3.1, rotY: 0.34 },
    { x: -1.16, y: 1.44, z: -1.04, w: 0.82, h: 3.25, rotY: 0.36 },
    { x: -0.66, y: 1.4, z: -0.98, w: 0.68, h: 3.0, rotY: 0.38 },
  ]) {
    const holder = new THREE.Group();
    holder.position.set(s.x, s.y, s.z);
    holder.rotation.set(0.68, s.rotY, -0.34);

    const p1 = new THREE.Mesh(new THREE.PlaneGeometry(s.w, s.h), beamMat);
    const p2 = new THREE.Mesh(new THREE.PlaneGeometry(s.w * 0.9, s.h), beamMat);
    p2.rotation.y = Math.PI * 0.5;
    holder.add(p1, p2);
    group.add(holder);
  }

  staticRoot.add(group);
  return beamMat;
}

// ============================================================================
// 5. Scene Bootstrap, Batching, Lighting, UTM Wiring & Camera Presets
// ============================================================================

const bootStart = performance.now();

window.__BENCH_META__ = {
  id: 'track-2-turing-study',
  title: 'Cambridge Study 1936 — Universal Tape Machine',
  domain: '3D Architecture & Interactive Computing',
  model: 'gemini-4-neon',
  effort: 'xhigh',
  technique: '2-Worker Clean-Room Specialist Swarm',
  ready: false,
  bootMs: 0,
  shaderPrewarmMs: 0,
  drawCalls: 0,
  triangles: 0,
  fps: 0,
  telemetry: {
    programId: '',
    utmSteps: 0,
    utmState: '',
    headPos: 0,
    halted: false,
    activeView: 'hero',
  },
};

const canvas = document.getElementById('study-canvas');
const renderer = new THREE.WebGLRenderer({
  canvas,
  antialias: true,
  powerPreference: 'high-performance',
});
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
renderer.setSize(window.innerWidth, window.innerHeight, false);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFShadowMap; // Three.js r187 warning-free PCF shadow map
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.08;
renderer.outputColorSpace = THREE.SRGBColorSpace;

const scene = new THREE.Scene();
scene.background = new THREE.Color('#1a140e');
scene.fog = new THREE.FogExp2('#271e15', 0.015);

// Subtle procedural IBL environment for realistic antique brass & leather reflections
const pmrem = new THREE.PMREMGenerator(renderer);
const roomEnv = new RoomEnvironment();
const envRT = pmrem.fromScene(roomEnv, 0.04);
scene.environment = envRT.texture;
scene.environmentIntensity = 0.28;
roomEnv.dispose();
pmrem.dispose();

// Camera & OrbitControls
const camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.05, 95);
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.07;
controls.maxPolarAngle = Math.PI * 0.495;
controls.minPolarAngle = 0.14;
controls.minDistance = 0.48;
controls.maxDistance = 3.55;
controls.panSpeed = 0.65;

const CAMERA_PRESETS = {
  hero: {
    pos: new THREE.Vector3(1.06, 1.38, 1.94),
    target: new THREE.Vector3(-0.14, 1.06, -0.18),
    fov: 45,
  },
  macro: {
    pos: new THREE.Vector3(0.36, 1.12, 0.78),
    target: new THREE.Vector3(0.07, 0.91, 0.02),
    fov: 42,
  },
  alt_mode: {
    pos: new THREE.Vector3(-0.34, 1.44, 2.54),
    target: new THREE.Vector3(0.02, 1.24, -1.12),
    fov: 47,
  },
};

let activeView = 'hero';
const camAnim = {
  active: false,
  elapsed: 0,
  duration: 0.65,
  startPos: new THREE.Vector3(),
  endPos: new THREE.Vector3(),
  startTarget: new THREE.Vector3(),
  endTarget: new THREE.Vector3(),
  startFov: 45,
  endFov: 45,
};

function computeResponsiveFov(baseFov) {
  const aspect = window.innerWidth / Math.max(1, window.innerHeight);
  return aspect < 1.0 ? Math.min(56, baseFov + 7) : baseFov;
}

function setView(viewName, instant = false) {
  const key = CAMERA_PRESETS[viewName] ? viewName : 'hero';
  const preset = CAMERA_PRESETS[key];
  activeView = key;
  window.__BENCH_META__.telemetry.activeView = key;

  const targetFov = computeResponsiveFov(preset.fov);
  if (instant) {
    camAnim.active = false;
    camera.position.copy(preset.pos);
    controls.target.copy(preset.target);
    camera.fov = targetFov;
    camera.updateProjectionMatrix();
    controls.update();
  } else {
    camAnim.active = true;
    camAnim.elapsed = 0;
    camAnim.startPos.copy(camera.position);
    camAnim.endPos.copy(preset.pos);
    camAnim.startTarget.copy(controls.target);
    camAnim.endTarget.copy(preset.target);
    camAnim.startFov = camera.fov;
    camAnim.endFov = targetFov;
  }

  document.querySelectorAll('[data-view]').forEach((btn) => {
    btn.classList.toggle('is-active', btn.getAttribute('data-view') === key);
  });
  return true;
}

controls.addEventListener('start', () => {
  camAnim.active = false;
});
setView('hero', true);

// --- Materials Palette ---
const materials = {
  parquet: new THREE.MeshStandardMaterial({
    map: createParquetTexture(),
    roughness: 0.56,
    metalness: 0.04,
  }),
  plaster: new THREE.MeshStandardMaterial({
    map: createPlasterTexture(),
    roughness: 0.92,
    metalness: 0.0,
  }),
  oakDesk: new THREE.MeshStandardMaterial({
    map: createWoodTexture({ base: '#5f3c22', dark: '#3b2211', light: '#784e2e', seed: 12 }),
    roughness: 0.6,
    metalness: 0.03,
  }),
  darkOak: new THREE.MeshStandardMaterial({
    map: createWoodTexture({ base: '#432917', dark: '#29160a', light: '#583720', seed: 33 }),
    roughness: 0.52,
    metalness: 0.04,
  }),
  mahogany: new THREE.MeshStandardMaterial({
    map: createWoodTexture({ base: '#4a2419', dark: '#2c120b', light: '#643424', seed: 77 }),
    roughness: 0.46,
    metalness: 0.05,
  }),
  limestone: new THREE.MeshStandardMaterial({
    color: '#c8bc9f',
    roughness: 0.88,
    metalness: 0.01,
  }),
  leadMetal: new THREE.MeshStandardMaterial({
    color: '#2b2d30',
    roughness: 0.55,
    metalness: 0.72,
  }),
  antiqueBrass: new THREE.MeshStandardMaterial({
    color: '#c9a155',
    roughness: 0.28,
    metalness: 0.88,
  }),
  persianRug: new THREE.MeshStandardMaterial({
    map: createPersianRugTexture(),
    roughness: 0.94,
    metalness: 0.0,
  }),
  leatherBlotter: new THREE.MeshStandardMaterial({
    map: createLeatherBlotterTexture(),
    roughness: 0.48,
    metalness: 0.04,
  }),
  contactShadow: new THREE.MeshBasicMaterial({
    map: createContactShadowTexture(),
    transparent: true,
    depthWrite: false,
  }),
  parchmentA: new THREE.MeshStandardMaterial({
    map: createParchmentTexture(0),
    roughness: 0.88,
    metalness: 0.0,
    side: THREE.DoubleSide,
  }),
  parchmentB: new THREE.MeshStandardMaterial({
    map: createParchmentTexture(1),
    roughness: 0.88,
    metalness: 0.0,
    side: THREE.DoubleSide,
  }),
  blackboard: new THREE.MeshStandardMaterial({
    map: createBlackboardTexture(),
    roughness: 0.86,
    metalness: 0.02,
  }),
  bookSpine: new THREE.MeshStandardMaterial({
    map: createBookSpineTexture(),
    roughness: 0.68,
    metalness: 0.08,
  }),
  etching: new THREE.MeshStandardMaterial({
    map: createCampusEtchingTexture(),
    roughness: 0.78,
    metalness: 0.0,
  }),
};

// --- Build Static Architectural World & Merge by Material (<40 Draw Calls!) ---
const skyMat = createCambridgeSkyMaterial();
const skyDome = new THREE.Mesh(new THREE.SphereGeometry(52, 28, 18), skyMat);
scene.add(skyDome);

const staticWorld = new THREE.Group();
scene.add(staticWorld);

buildGothicWindowAndChapel(staticWorld, materials);
buildRoomArchitecture(staticWorld, materials);
buildStudyDeskAndProps(staticWorld, materials);
const sunbeamMat = buildVolumetricSunbeams(staticWorld);

// Batch ALL static meshes across Room X.8, Chapel, Desk, Props, Contact Shadows & Sunbeams by material!
const staticCandidates = [];
staticWorld.traverse((obj) => {
  if (obj.isMesh && !obj.isInstancedMesh) {
    staticCandidates.push(obj);
  }
});
batchStaticMeshes(staticWorld, staticCandidates);

const dustMotes = createDustMotesSystem();
scene.add(dustMotes.points);

// Calibrated 1936 Study Lighting Rig
const hemiLight = new THREE.HemisphereLight('#c3d8ee', '#4b3420', 0.56);
scene.add(hemiLight);

const sunLight = new THREE.DirectionalLight('#ffd99e', 2.95);
sunLight.position.set(-3.7, 4.15, -6.1);
sunLight.target.position.set(0.25, 0.72, 0.2);
sunLight.castShadow = true;
sunLight.shadow.mapSize.set(1024, 1024);
sunLight.shadow.radius = 2.4;
sunLight.shadow.camera.near = 1.5;
sunLight.shadow.camera.far = 14.0;
sunLight.shadow.camera.left = -4.4;
sunLight.shadow.camera.right = 4.4;
sunLight.shadow.camera.top = 3.4;
sunLight.shadow.camera.bottom = -2.4;
sunLight.shadow.bias = -0.0005;
sunLight.shadow.normalBias = 0.02;
scene.add(sunLight);
scene.add(sunLight.target);

const bankerLight = new THREE.PointLight('#ffc870', 2.25, 3.8, 1.9);
bankerLight.position.set(-0.58, DESK_TOP_Y + 0.3, -0.18);
scene.add(bankerLight);

const studyFillLight = new THREE.PointLight('#ffd29c', 1.12, 8.2, 1.85);
studyFillLight.position.set(1.45, 2.38, 1.35);
scene.add(studyFillLight);

// --- Mount @turing-utm Universal Turing Machine Apparatus squarely at (0, 0.76, 0) ---
const utm = new UniversalTuringMachine();
const utmApparatus = createUTMApparatus(THREE);
utmApparatus.group.position.set(0, DESK_TOP_Y, 0);
scene.add(utmApparatus.group);

// Safely batch static structural chassis pieces & trim tiny shadow-pass calls on UTM apparatus
optimizeUTMApparatusDrawCalls(utmApparatus.group);

const audio = new UTMAudio();
audio.setMuted(true);

// ============================================================================
// 6. Interactive UTM Studio HUD & Synchronized Simulation Controller
// ============================================================================

const ui = {
  telSteps: document.getElementById('tel-steps'),
  telState: document.getElementById('tel-state'),
  telFps: document.getElementById('tel-fps'),
  programSelect: document.getElementById('program-select'),
  programDesc: document.getElementById('program-desc'),
  btnPlay: document.getElementById('btn-play'),
  btnStep: document.getElementById('btn-step'),
  btnReset: document.getElementById('btn-reset'),
  speedSlider: document.getElementById('speed-slider'),
  speedReadout: document.getElementById('speed-readout'),
  statusBadge: document.getElementById('utm-status-badge'),
  headPosReadout: document.getElementById('head-pos-readout'),
  ruleReadout: document.getElementById('rule-readout'),
  tapeRuleInline: document.getElementById('tape-rule-inline'),
  tapeCells: document.getElementById('tape-cells'),
  btnSound: document.getElementById('btn-sound'),
  soundLabel: document.getElementById('sound-label'),
  btnDrawerToggle: document.getElementById('btn-drawer-toggle'),
  drawer: document.getElementById('utm-drawer'),
};

let isPlaying = true;
let stepsPerSec = 2.5;
let stepAccumulator = 0;
let soundEnabled = false;
let userToggledDrawer = false;

for (const prog of PROGRAMS) {
  const opt = document.createElement('option');
  opt.value = prog.id;
  opt.textContent = prog.name || prog.id;
  ui.programSelect.appendChild(opt);
}
ui.speedSlider.value = String(stepsPerSec);
ui.speedReadout.textContent = `${stepsPerSec.toFixed(1)} steps/s`;

function formatRuleText(stateObj) {
  const r = stateObj.lastRule;
  if (!r) {
    return stateObj.halted ? `Halted in state ${stateObj.state}` : `Ready · m-config ${stateObj.state}`;
  }
  if (typeof r === 'string') return r;
  if (typeof r === 'object') {
    const f = r.fromState ?? stateObj.state;
    const rd = r.readSym ?? r.read ?? '␣';
    const wr = r.writeSym ?? r.write ?? rd;
    const mv = r.moveLabel ?? r.move ?? 'N';
    const to = r.toState ?? r.nextState ?? stateObj.state;
    return `δ(${f}, ${rd}) → (${wr}, ${mv}, ${to})`;
  }
  return String(r);
}

const tapeCellNodes = [];
for (let i = 0; i < 15; i += 1) {
  const cell = document.createElement('div');
  cell.className = 'tape-cell';
  cell.setAttribute('role', 'listitem');
  const idxEl = document.createElement('span');
  idxEl.className = 'tape-idx';
  const symEl = document.createElement('span');
  symEl.className = 'tape-sym';
  cell.append(idxEl, symEl);
  ui.tapeCells.appendChild(cell);
  tapeCellNodes.push({ cell, idxEl, symEl });
}

let cachedUtmState = utm.getState();

/**
 * Single source-of-truth UI & Telemetry synchronizer.
 * Guarantees dropdown, description, badge, rule panel, tape header & all 15 tape cells remain 100% lockstep!
 */
function syncHudFromState(st) {
  cachedUtmState = st;
  const progMeta = PROGRAMS.find((p) => p.id === st.programId) || PROGRAMS[0];

  if (ui.programSelect.value !== st.programId) {
    ui.programSelect.value = st.programId;
  }

  ui.telSteps.textContent = String(st.stepCount).padStart(3, '0');
  ui.telState.textContent = st.state;
  ui.headPosReadout.textContent = `HEAD ${st.head >= 0 ? '+' : ''}${st.head}`;
  ui.programDesc.textContent = st.description || (progMeta ? progMeta.description : '');

  const progLabel = st.programName || (progMeta ? progMeta.name : st.programId);
  const ruleText = formatRuleText(st);
  ui.ruleReadout.textContent = ruleText;
  ui.tapeRuleInline.textContent = `${progLabel} · ${ruleText}`;

  ui.statusBadge.classList.remove('is-idle', 'is-running', 'is-halted');
  if (st.halted) {
    ui.statusBadge.textContent = st.state === 'ACCEPT' ? 'ACCEPTED' : 'HALTED';
    ui.statusBadge.classList.add('is-halted');
  } else if (isPlaying) {
    ui.statusBadge.textContent = 'COMPUTING';
    ui.statusBadge.classList.add('is-running');
  } else {
    ui.statusBadge.textContent = 'STANDBY';
    ui.statusBadge.classList.add('is-idle');
  }

  ui.btnPlay.textContent = isPlaying ? 'Pause' : 'Play';
  ui.btnPlay.classList.toggle('is-playing', isPlaying && !st.halted);

  const win = st.tapeWindow || [];
  for (let i = 0; i < tapeCellNodes.length; i += 1) {
    const entry = win[i];
    const node = tapeCellNodes[i];
    if (!entry) continue;
    const sym = entry.sym ?? '␣';
    const isBlank = sym === '␣' || sym === '_' || sym === ' ';
    node.idxEl.textContent = String(entry.pos);
    node.symEl.textContent = isBlank ? '␣' : sym;
    node.cell.classList.toggle('is-head', Boolean(entry.isHead));
    node.cell.classList.toggle('is-blank', isBlank);
  }

  window.__BENCH_META__.telemetry.programId = st.programId;
  window.__BENCH_META__.telemetry.utmSteps = st.stepCount;
  window.__BENCH_META__.telemetry.utmState = st.state;
  window.__BENCH_META__.telemetry.headPos = st.head;
  window.__BENCH_META__.telemetry.halted = Boolean(st.halted);
}

/**
 * Atomic program switcher: updates engine, cached state, DOM controls, tape strip & 3D apparatus immediately.
 */
function switchProgram(programId, { autoPlay = true } = {}) {
  utm.loadProgram(programId);
  stepAccumulator = 0;
  isPlaying = autoPlay;
  const st = utm.getState();
  syncHudFromState(st);
  utmApparatus.update(0.016, st, (performance.now() - bootStart) * 0.001);
  return st;
}

function executeOneStep({ silent = false } = {}) {
  // Always consult live engine state (never stale cached state!)
  const liveBefore = utm.getState();
  if (liveBefore.halted) {
    syncHudFromState(liveBefore);
    return null;
  }

  const res = utm.step();
  const moveDir = res.movedDir ?? res.moveDir ?? 0;
  const wroteChanged = Boolean(res.wroteChanged);
  const st = res.stateObj || utm.getState();

  if (typeof utmApparatus.triggerStepPulse === 'function') {
    utmApparatus.triggerStepPulse(moveDir);
  }

  if (!silent && soundEnabled) {
    audio.playStep(moveDir, wroteChanged);
    if (st.halted) {
      audio.playHalt();
    }
  }

  if (st.halted) {
    isPlaying = false;
  }
  syncHudFromState(st);
  return st;
}

// Wire HUD Controls
document.querySelectorAll('[data-view]').forEach((btn) => {
  btn.addEventListener('click', () => {
    setView(btn.getAttribute('data-view'), false);
  });
});

ui.programSelect.addEventListener('change', () => {
  switchProgram(ui.programSelect.value, { autoPlay: true });
});

ui.btnPlay.addEventListener('click', () => {
  const live = utm.getState();
  if (live.halted) {
    utm.reset();
    isPlaying = true;
  } else {
    isPlaying = !isPlaying;
  }
  stepAccumulator = 0;
  syncHudFromState(utm.getState());
});

ui.btnStep.addEventListener('click', () => {
  isPlaying = false;
  if (utm.getState().halted) {
    utm.reset();
  }
  executeOneStep({ silent: false });
});

ui.btnReset.addEventListener('click', () => {
  isPlaying = false;
  stepAccumulator = 0;
  utm.reset();
  const st = utm.getState();
  syncHudFromState(st);
  utmApparatus.update(0.016, st, (performance.now() - bootStart) * 0.001);
});

ui.speedSlider.addEventListener('input', () => {
  stepsPerSec = parseFloat(ui.speedSlider.value) || 3;
  ui.speedReadout.textContent = `${stepsPerSec.toFixed(1)} steps/s`;
});

ui.btnSound.addEventListener('click', () => {
  soundEnabled = !soundEnabled;
  if (soundEnabled) {
    audio.init();
    audio.setMuted(false);
  } else {
    audio.setMuted(true);
  }
  ui.btnSound.classList.toggle('is-sound-on', soundEnabled);
  ui.btnSound.setAttribute('aria-pressed', String(soundEnabled));
  ui.soundLabel.textContent = soundEnabled ? 'Audio On' : 'Muted';
});

function setDrawerOpen(open) {
  ui.drawer.classList.toggle('is-collapsed', !open);
  ui.btnDrawerToggle.setAttribute('aria-expanded', String(open));
  ui.btnDrawerToggle.classList.toggle('is-active', open);
}

ui.btnDrawerToggle.addEventListener('click', () => {
  userToggledDrawer = true;
  const currentlyOpen = !ui.drawer.classList.contains('is-collapsed');
  setDrawerOpen(!currentlyOpen);
});

function syncResponsiveLayout() {
  const w = window.innerWidth;
  const h = Math.max(1, window.innerHeight);
  camera.aspect = w / h;
  camera.fov = computeResponsiveFov(CAMERA_PRESETS[activeView].fov);
  camera.updateProjectionMatrix();
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setSize(w, h, false);
  dustMotes.material.uniforms.uPixelRatio.value = Math.min(window.devicePixelRatio || 1, 2);

  if (!userToggledDrawer) {
    setDrawerOpen(w > 820);
  }
}

window.addEventListener('resize', syncResponsiveLayout);
syncResponsiveLayout();
syncHudFromState(utm.getState());

// ============================================================================
// 7. Benchmark Harness Actions Contract (Gate 5.5 Deterministic QA)
// ============================================================================

window.__BENCH_ACTIONS__ = {
  setView: (viewName) => {
    const applied = setView(viewName, true);
    renderer.render(scene, camera);
    return applied;
  },
  triggerAction: (actionName) => {
    if (actionName === 'demo') {
      // Switch cleanly to 3-State Busy Beaver (if halted or past step 6) with atomic full-UI sync!
      const current = utm.getState();
      if (current.halted || current.stepCount > 6) {
        switchProgram('busy_beaver_3', { autoPlay: false });
      } else {
        isPlaying = false;
        syncHudFromState(current);
      }

      let lastSt = utm.getState();
      let executed = 0;
      for (let i = 0; i < 6; i += 1) {
        const nextSt = executeOneStep({ silent: true });
        if (!nextSt) break;
        lastSt = nextSt;
        executed += 1;
      }

      syncHudFromState(lastSt);
      const targetView = activeView === 'macro' ? 'macro' : 'alt_mode';
      setView(targetView, true);
      utmApparatus.update(0.05, lastSt, (performance.now() - bootStart) * 0.001);
      renderer.render(scene, camera);
      return `Executed ${executed} UTM steps (${lastSt.programId}: step ${lastSt.stepCount}, state ${lastSt.state}, head ${lastSt.head})`;
    }
    if (actionName === 'step') {
      const st = executeOneStep({ silent: true }) || utm.getState();
      return `Stepped to ${st.stepCount} (${st.state})`;
    }
    return `Unknown action: ${String(actionName)}`;
  },
};

// ============================================================================
// 8. Explicit WebGL2 Shader Pre-Warm & Main Render Loop
// ============================================================================

utmApparatus.update(0.016, cachedUtmState, 0);

const prewarmStart = performance.now();
renderer.compile(scene, camera);
renderer.render(scene, camera);
renderer.render(scene, camera);
const shaderPrewarmMs = Number((performance.now() - prewarmStart).toFixed(2));

window.__BENCH_META__.shaderPrewarmMs = shaderPrewarmMs;
window.__BENCH_META__.bootMs = Number((performance.now() - bootStart).toFixed(2));
window.__BENCH_META__.drawCalls = renderer.info.render.calls;
window.__BENCH_META__.triangles = renderer.info.render.triangles;
window.__BENCH_META__.ready = true;

let prevTime = performance.now();
let smoothedFps = 60;
let hudFpsTimer = 0;

function animate(now) {
  requestAnimationFrame(animate);

  const rawDt = (now - prevTime) * 0.001;
  prevTime = now;
  const dt = Math.min(Math.max(rawDt, 0.001), 0.05);
  const elapsed = (now - bootStart) * 0.001;

  const instFps = Math.min(240, 1 / Math.max(0.004, rawDt));
  smoothedFps = smoothedFps * 0.9 + instFps * 0.1;
  hudFpsTimer += dt;
  if (hudFpsTimer >= 0.25) {
    hudFpsTimer = 0;
    ui.telFps.textContent = String(Math.round(smoothedFps));
    window.__BENCH_META__.fps = Number(smoothedFps.toFixed(1));
  }

  if (camAnim.active) {
    camAnim.elapsed += dt;
    const t = Math.min(1, camAnim.elapsed / camAnim.duration);
    const ease = 1 - Math.pow(1 - t, 3);
    camera.position.lerpVectors(camAnim.startPos, camAnim.endPos, ease);
    controls.target.lerpVectors(camAnim.startTarget, camAnim.endTarget, ease);
    camera.fov = THREE.MathUtils.lerp(camAnim.startFov, camAnim.endFov, ease);
    camera.updateProjectionMatrix();
    if (t >= 1) camAnim.active = false;
  }

  controls.update();

  if (isPlaying && !cachedUtmState.halted) {
    stepAccumulator += dt * stepsPerSec;
    if (stepAccumulator >= 1.0) {
      stepAccumulator -= Math.floor(stepAccumulator);
      executeOneStep({ silent: false });
    }
  }

  utmApparatus.update(dt, cachedUtmState, elapsed);

  skyMat.uniforms.uTime.value = elapsed;
  sunbeamMat.uniforms.uTime.value = elapsed;
  dustMotes.material.uniforms.uTime.value = elapsed;
  bankerLight.intensity = 2.22 + Math.sin(elapsed * 2.1) * 0.04;

  renderer.render(scene, camera);

  window.__BENCH_META__.drawCalls = renderer.info.render.calls;
  window.__BENCH_META__.triangles = renderer.info.render.triangles;
}

requestAnimationFrame(animate);
