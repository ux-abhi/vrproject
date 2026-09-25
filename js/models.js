import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';

// Real 3D models, sampled into particles on their actual surfaces (credited on the page).
// Rigged, posed at runtime (three.js example library):
//  - Xbot and Soldier: humans from mixamo.com
//  - "Infinite, 3D Head Scan" by Lee Perry-Smith, CC BY 3.0
// Pre-baked surface samples (models/baked/*.bin, made with models/source/bake.html):
//  - "Destroyed Car 07 (Raw Scan)" by Renafox, CC BY 4.0
//  - "Shvan '92 Ambulance" by Daniel Zhabotinsky, CC BY 4.0
//  - "Administering CPR curso XR" by xcampos91, CC BY 4.0
const BASE = 'https://cdn.jsdelivr.net/gh/mrdoob/three.js@r170/examples/models/gltf/';
const BAKED = '/models/baked/';

// Baked format: Uint32 count | Float32 w,h,d | Int16 xyz | Int8 normal xyz | Uint8 albedo
async function loadBaked(name) {
  const buf = await (await fetch(BAKED + name + '.bin')).arrayBuffer();
  const count = new DataView(buf).getUint32(0, true);
  return {
    count,
    pos: new Int16Array(buf, 16, count * 3),
    nrm: new Int8Array(buf, 16 + count * 6, count * 3),
    alb: new Uint8Array(buf, 16 + count * 9, count),
  };
}

let models = null;
const triCache = new Map(); // posed / rotated geometry, reused across samples

export async function loadModels() {
  if (models) return models;
  const draco = new DRACOLoader();
  draco.setDecoderPath('https://unpkg.com/three@0.170.0/examples/jsm/libs/draco/gltf/');
  const loader = new GLTFLoader();
  loader.setDRACOLoader(draco);
  const [xbot, soldier, head, car, ambulance, cpr] = await Promise.all([
    loader.loadAsync(BASE + 'Xbot.glb'),
    loader.loadAsync(BASE + 'Soldier.glb'),
    loader.loadAsync(BASE + 'LeePerrySmith/LeePerrySmith.glb'),
    loadBaked('car'),
    loadBaked('ambulance'),
    loadBaked('cpr'),
  ]);
  const character = (g) => ({ scene: g.scene, clips: g.animations, mixer: new THREE.AnimationMixer(g.scene), standHeight: null });
  models = {
    xbot: character(xbot),
    soldier: character(soldier),
    head: head.scene,
    baked: { car, ambulance, cpr },
  };
  return models;
}

// ── Triangles of a (possibly skinned) model, in world space ─────────────────

const _v = new THREE.Vector3();

function collectTriangles(root) {
  root.updateMatrixWorld(true);
  const tris = [];
  root.traverse((o) => {
    if (!o.isMesh || !o.visible) return;
    const g = o.geometry;
    const pos = g.attributes.position;
    const n = pos.count;
    const world = new Float32Array(n * 3);
    if (o.isSkinnedMesh) o.skeleton.update();
    for (let i = 0; i < n; i++) {
      if (o.isSkinnedMesh) o.getVertexPosition(i, _v); else _v.fromBufferAttribute(pos, i);
      _v.applyMatrix4(o.matrixWorld);
      world[i * 3] = _v.x; world[i * 3 + 1] = _v.y; world[i * 3 + 2] = _v.z;
    }
    const index = g.index ? g.index.array : null;
    const triCount = index ? index.length / 3 : n / 3;
    for (let t = 0; t < triCount; t++) {
      const a = index ? index[t * 3] : t * 3;
      const b = index ? index[t * 3 + 1] : t * 3 + 1;
      const c = index ? index[t * 3 + 2] : t * 3 + 2;
      tris.push(
        world[a * 3], world[a * 3 + 1], world[a * 3 + 2],
        world[b * 3], world[b * 3 + 1], world[b * 3 + 2],
        world[c * 3], world[c * 3 + 1], world[c * 3 + 2],
      );
    }
  });
  return new Float32Array(tris);
}

// Area-weighted random points on the triangles, with face normals
function sampleSurface(tris, count, rand) {
  const n = tris.length / 9;
  const cum = new Float64Array(n);
  let total = 0;
  for (let t = 0; t < n; t++) {
    const o = t * 9;
    const ux = tris[o + 3] - tris[o], uy = tris[o + 4] - tris[o + 1], uz = tris[o + 5] - tris[o + 2];
    const vx = tris[o + 6] - tris[o], vy = tris[o + 7] - tris[o + 1], vz = tris[o + 8] - tris[o + 2];
    const cx = uy * vz - uz * vy, cy = uz * vx - ux * vz, cz = ux * vy - uy * vx;
    total += Math.hypot(cx, cy, cz) / 2;
    cum[t] = total;
  }
  const out = [];
  for (let k = 0; k < count; k++) {
    const r = rand() * total;
    let lo = 0;
    let hi = n - 1;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (cum[mid] < r) lo = mid + 1; else hi = mid;
    }
    const o = lo * 9;
    let s = rand();
    let t = rand();
    if (s + t > 1) { s = 1 - s; t = 1 - t; }
    const ux = tris[o + 3] - tris[o], uy = tris[o + 4] - tris[o + 1], uz = tris[o + 5] - tris[o + 2];
    const vx = tris[o + 6] - tris[o], vy = tris[o + 7] - tris[o + 1], vz = tris[o + 8] - tris[o + 2];
    let nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
    const len = Math.hypot(nx, ny, nz) || 1;
    nx /= len; ny /= len; nz /= len;
    out.push({
      x: tris[o] + ux * s + vx * t,
      y: tris[o + 1] + uy * s + vy * t,
      z: tris[o + 2] + uz * s + vz * t,
      nx, ny, nz,
    });
  }
  return out;
}

// ── Human poses: an animation frame plus a few bone adjustments ─────────────

const D = Math.PI / 180;

// [bone, x, y, z] rotations in degrees, applied on top of the clip frame.
// Mixamo axes (right side): arm +x swings forward, -z lifts sideways;
// forearm -z bends the elbow up. The left side mirrors z.
export const POSES = {
  stand: { clip: 'idle', t: 0.4, bones: [] },
  walk: { clip: 'walk', t: 0.35, bones: [] },
  frozen: { clip: 'walk', t: 0.12, bones: [['mixamorigHead', 14, 0, 0], ['mixamorigSpine2', 6, 0, 0]] },
  phone: {
    clip: 'idle', t: 0.4,
    bones: [['mixamorigRightArm', 15, 0, -30], ['mixamorigRightForeArm', 0, 0, -135], ['mixamorigHead', 6, 0, -8]],
  },
  reach: {
    clip: 'idle', t: 0.4,
    bones: [['mixamorigRightArm', 75, 0, -12], ['mixamorigRightForeArm', 0, 0, -12], ['mixamorigSpine1', 10, 0, 0]],
  },
  kneel: {
    clip: 'idle', t: 0.4,
    bones: [
      ['mixamorigLeftUpLeg', -85, 0, 0], ['mixamorigLeftLeg', 85, 0, 0],
      ['mixamorigRightUpLeg', 5, 0, 0], ['mixamorigRightLeg', 105, 0, 0],
      ['mixamorigSpine', 20, 0, 0], ['mixamorigRightArm', 55, 0, -10], ['mixamorigLeftArm', 50, 0, 10],
    ],
  },
  // Sitting on the kerb, knees up, one hand pressed to the head
  dazed: {
    clip: 'idle', t: 0.4,
    bones: [
      ['mixamorigLeftUpLeg', -95, 0, -6], ['mixamorigLeftLeg', 115, 0, 0],
      ['mixamorigRightUpLeg', -95, 0, 6], ['mixamorigRightLeg', 115, 0, 0],
      ['mixamorigSpine', 20, 0, 0], ['mixamorigSpine1', 10, 0, 0], ['mixamorigHead', 22, 0, 12],
      ['mixamorigRightArm', 35, 0, -40], ['mixamorigRightForeArm', 0, 0, -140],
      ['mixamorigLeftArm', 45, 0, 8], ['mixamorigLeftForeArm', 0, 0, 25],
    ],
  },
  // Lying flat on the back, in profile (receiving CPR)
  supine: {
    clip: 'idle', t: 0.4, lie: 88, profile: true,
    bones: [['mixamorigLeftArm', 10, 0, 20], ['mixamorigRightArm', 10, 0, -20], ['mixamorigHead', -8, 0, 0]],
  },
  // Lying back with the upper body raised (the positioning insight): shown in profile
  reclined: {
    clip: 'idle', t: 0.4, lie: 62, profile: true,
    bones: [
      ['mixamorigLeftUpLeg', -60, 0, 0], ['mixamorigLeftLeg', 80, 0, 0],
      ['mixamorigRightUpLeg', -55, 0, 0], ['mixamorigRightLeg', 75, 0, 0],
      ['mixamorigLeftArm', 20, 0, 10], ['mixamorigRightArm', 20, 0, -10],
    ],
  },
};

// Which way each rig faces at rotation 0 (so yaw 0 always means "facing the camera")
const FACING = { xbot: 0, soldier: Math.PI };

const _q = new THREE.Quaternion();
const _e = new THREE.Euler();

function applyPose(ch, name) {
  const { scene, clips, mixer } = ch;
  const p = POSES[name];
  mixer.stopAllAction();
  scene.traverse((o) => { if (o.isSkinnedMesh) o.skeleton.pose(); });
  const find = (n) => clips.find((c) => c.name.toLowerCase() === n.toLowerCase());
  const clip = find(p.clip) || find('idle');
  const action = mixer.clipAction(clip);
  action.reset().play();
  mixer.setTime(p.t);
  for (const [name2, x, y, z] of p.bones) {
    const bone = scene.getObjectByName(name2);
    if (!bone) continue;
    _q.setFromEuler(_e.set(x * D, y * D, z * D));
    bone.quaternion.multiply(_q);
  }
  scene.updateMatrixWorld(true);
}

// Sample a posed human: feet at (x, y), height h (world units), facing yaw (rad)
export function sampleFigure(pose, { who = 'xbot', x = 0, y = 0, h = 2.5, yaw = 0, count = 2000, rand = Math.random }) {
  const ch = models[who];
  const { scene } = ch;
  if (ch.standHeight === null) {
    applyPose(ch, 'stand');
    const box = new THREE.Box3().setFromObject(scene, true);
    ch.standHeight = box.max.y - box.min.y;
  }
  const p = POSES[pose] || POSES.stand;
  const key = `${who}|${pose}|${yaw.toFixed(3)}`;
  let tris = triCache.get(key);
  if (!tris) {
    scene.rotation.set(0, (FACING[who] || 0) + yaw + (p.profile ? Math.PI / 2 : 0), 0);
    applyPose(ch, pose);
    tris = collectTriangles(scene);
    scene.rotation.set(0, 0, 0);
    triCache.set(key, tris);
  }
  const pts = sampleSurface(tris, count, rand);
  if (p.lie) tiltBack(pts, p.lie * D);
  return fit(pts, h / ch.standHeight, x, y, 'feet');
}

// Sample a static model scaled to `size` along its longest horizontal extent
export function sampleModel(which, { x = 0, y = 0, size = 4, yaw = 0, pitch = 0, count = 3000, rand = Math.random, anchor = 'feet' }) {
  const key = `${which}|${yaw.toFixed(3)}|${pitch.toFixed(3)}`;
  let tris = triCache.get(key);
  if (!tris) {
    const root = models[which];
    root.rotation.set(pitch, yaw, 0);
    tris = collectTriangles(root);
    root.rotation.set(0, 0, 0);
    triCache.set(key, tris);
  }
  const pts = sampleSurface(tris, count, rand);
  let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity, minY = Infinity, maxY = -Infinity;
  for (const q of pts) {
    minX = Math.min(minX, q.x); maxX = Math.max(maxX, q.x);
    minZ = Math.min(minZ, q.z); maxZ = Math.max(maxZ, q.z);
    minY = Math.min(minY, q.y); maxY = Math.max(maxY, q.y);
  }
  const extent = which === 'head' ? maxY - minY : Math.max(maxX - minX, maxZ - minZ);
  return fit(pts, size / extent, x, y, anchor);
}

// Points from a baked model. Its largest extent is 1; `size` sets the world size of
// that extent, feet on y. yaw turns it about the vertical axis (radians).
export function sampleBaked(name, { x = 0, y = 0, size = 4, yaw = 0, count = 3000, rand = Math.random }) {
  const m = models.baked[name];
  const c = Math.cos(yaw);
  const s = Math.sin(yaw);
  const out = [];
  for (let k = 0; k < count; k++) {
    const i = Math.floor(rand() * m.count);
    const px = m.pos[i * 3] / 32767, py = m.pos[i * 3 + 1] / 32767, pz = m.pos[i * 3 + 2] / 32767;
    const nx = m.nrm[i * 3] / 127, ny = m.nrm[i * 3 + 1] / 127, nz = m.nrm[i * 3 + 2] / 127;
    out.push({
      x: x + (px * c + pz * s) * size,
      y: y + py * size,
      z: (-px * s + pz * c) * size,
      nx: nx * c + nz * s, ny, nz: -nx * s + nz * c,
      albedo: m.alb[i] / 255,
    });
  }
  return out;
}

// Lay a (profile) body back around its hips, in the screen plane
function tiltBack(pts, angle) {
  let minY = Infinity, maxY = -Infinity, sx = 0;
  for (const q of pts) { minY = Math.min(minY, q.y); maxY = Math.max(maxY, q.y); sx += q.x; }
  const px = sx / pts.length;
  const py = minY + (maxY - minY) * 0.45;
  const c = Math.cos(angle), s = Math.sin(angle);
  for (const q of pts) {
    const dx = q.x - px, dy = q.y - py;
    q.x = px + dx * c - dy * s;
    q.y = py + dx * s + dy * c;
    const nx = q.nx * c - q.ny * s;
    q.ny = q.nx * s + q.ny * c;
    q.nx = nx;
  }
}

// Scale, then place: 'feet' puts the lowest point at y; 'center' centres it
function fit(pts, scale, x, y, anchor) {
  let minY = Infinity, maxY = -Infinity, sx = 0, sz = 0;
  for (const q of pts) {
    minY = Math.min(minY, q.y); maxY = Math.max(maxY, q.y);
    sx += q.x; sz += q.z;
  }
  const cx = sx / pts.length;
  const cz = sz / pts.length;
  const oy = anchor === 'center' ? (minY + maxY) / 2 : minY;
  for (const q of pts) {
    q.x = (q.x - cx) * scale + x;
    q.y = (q.y - oy) * scale + y;
    q.z = (q.z - cz) * scale;
  }
  return pts;
}

// ── Lighting: key light plus rim, turned into point brightness ─────────────

const KEY = new THREE.Vector3(-0.5, 0.65, 0.55).normalize();

export function shade(n, { key = 0.55, rim = 0.85, ambient = 0.08, rimPow = 2.2 } = {}) {
  const lambert = Math.max(0, n.nx * KEY.x + n.ny * KEY.y + n.nz * KEY.z);
  const r = Math.pow(1 - Math.min(1, Math.abs(n.nz)), rimPow);
  return Math.min(1, ambient + lambert * key + r * rim);
}
