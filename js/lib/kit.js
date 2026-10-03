// Shared 3D kit: materials, model loading, instanced records, data, easing.
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

export const C = { ink: 0x0a0a0b, white: 0xf3f3f0, silver: 0xc9ccd1, steel: 0x8a8f98, ultra: 0x1f2bff, ultraL: 0xa9b2ff };

// ---------- easing / math ----------
export const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
export const lerp = (a, b, t) => a + (b - a) * t;
export const range = (v, a, b) => clamp((v - a) / (b - a));
export const easeOut = t => 1 - Math.pow(1 - t, 3);
export const easeOutExpo = t => (t >= 1 ? 1 : 1 - Math.pow(2, -10 * t));
export const easeInOut = t => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
export const easeOutBack = t => { const c = 1.6; return 1 + (c + 1) * Math.pow(t - 1, 3) + c * Math.pow(t - 1, 2); };
export const damp = (a, b, k, dt) => lerp(a, b, 1 - Math.exp(-k * dt));

export function rng(seed = 7) { // mulberry32
  return () => { seed |= 0; seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

/** Listening minutes per day — seasons, weekends, December build-up, a few obsessive days. */
export function yearValues(n = 365, seed = 7) {
  const r = rng(seed), v = [];
  for (let d = 0; d < n; d++) {
    const t = d / n;
    let b = 0.42 + 0.18 * Math.sin(t * 6.283 * 2 + 0.6) + 0.12 * Math.sin(t * 6.283 * 7.3) + 0.1 * Math.sin(t * 41);
    if (d % 7 >= 5) b += 0.12;
    if (d > 330) b += 0.2 * (d - 330) / 35;
    if (r() < 0.05) b += 0.25 + r() * 0.25;
    v.push(Math.max(0.06, b + (r() - 0.5) * 0.12));
  }
  const mx = Math.max(...v);
  return v.map(x => x / mx);
}

// ---------- vinyl grooves (procedural bump, Blender had them as a shader) ----------
function groovesTexture() {
  const S = 2048, cv = document.createElement('canvas'); cv.width = cv.height = S;
  const g = cv.getContext('2d'); g.fillStyle = '#808080'; g.fillRect(0, 0, S, S);
  const r = rng(3);
  for (let i = 0; i < 900; i++) {                         // tight spiral of grooves, tracks separated by smooth bands
    const t = i / 900, rad = (0.36 + 0.615 * t) * S / 2, track = Math.floor(t * 7);
    const band = (t * 7) % 1 < 0.035;
    const v = band ? 150 : 90 + Math.floor(r() * 70) + (i % 2 ? 30 : 0) + track * 3;
    g.strokeStyle = `rgb(${v},${v},${v})`; g.lineWidth = band ? 2.4 : 1.1;
    g.beginPath(); g.arc(S / 2, S / 2, rad, 0, Math.PI * 2); g.stroke();
  }
  g.strokeStyle = '#202020'; g.lineWidth = 6; g.beginPath(); g.arc(S / 2, S / 2, 0.355 * S / 2, 0, Math.PI * 2); g.stroke();
  const t = new THREE.CanvasTexture(cv); t.anisotropy = 16; return t;
}

/** Printed record label (grayscale, tinted by the label colour). */
function labelTexture() {
  const S = 1024, cv = document.createElement('canvas'); cv.width = cv.height = S;
  const g = cv.getContext('2d'), c = S / 2;
  g.fillStyle = '#ffffff'; g.fillRect(0, 0, S, S);
  g.strokeStyle = 'rgba(0,0,0,.45)'; g.lineWidth = 3;
  for (const k of [0.97, 0.9, 0.62]) { g.beginPath(); g.arc(c, c, k * c, 0, Math.PI * 2); g.stroke(); }
  g.fillStyle = 'rgba(10,10,20,.62)'; g.font = '500 34px Unbounded, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
  const txt = 'SPOTIFY WRAPPED · 2026 · SIDE A · 33 1/3 RPM · SPOTIFY WRAPPED · 2026 · SIDE A · 33 1/3 RPM · ';
  const R = 0.78 * c, step = (Math.PI * 2) / txt.length;
  for (let i = 0; i < txt.length; i++) { const a = -Math.PI / 2 + i * step; g.save(); g.translate(c + Math.cos(a) * R, c + Math.sin(a) * R); g.rotate(a + Math.PI / 2); g.fillText(txt[i], 0, 0); g.restore(); }
  g.fillStyle = 'rgba(10,10,20,.8)'; g.font = '900 78px Unbounded, sans-serif'; g.fillText('WRAPPED', c, c - 150);
  g.font = '300 64px Unbounded, sans-serif'; g.fillText('2026', c, c + 150);
  g.font = '500 26px Unbounded, sans-serif'; g.fillStyle = 'rgba(10,10,20,.55)'; g.fillText('ФАТИКОВА КРИСТИНА', c, c + 230);
  const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; return t;
}

/** Printed cassette sticker. */
function stickerTexture(low) {
  const W = 2048, H = low ? 160 : 270, cv = document.createElement('canvas'); cv.width = W; cv.height = H;
  const g = cv.getContext('2d'); g.fillStyle = '#f3f3f0'; g.fillRect(0, 0, W, H);
  g.fillStyle = '#0a0a0b'; g.textBaseline = 'middle';
  if (low) { g.font = '500 60px Unbounded, sans-serif'; g.textAlign = 'center'; g.globalAlpha = 0.7; g.fillText('CHROME · TYPE II · HIGH BIAS · 90', W / 2, H / 2); }
  else {
    g.font = '900 120px Unbounded, sans-serif'; g.textAlign = 'left'; g.fillText('A', 60, H / 2);
    g.font = '700 92px Unbounded, sans-serif'; g.textAlign = 'center'; g.fillText('WRAPPED 2026', W / 2, H / 2 - 10);
    g.font = '500 56px Unbounded, sans-serif'; g.textAlign = 'right'; g.globalAlpha = 0.7; g.fillText('90 MIN', W - 60, H / 2);
    g.globalAlpha = 0.25; g.fillRect(260, H - 40, W - 520, 4);
  }
  const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; return t;
}

// ---------- materials (glTF materials are replaced by name) ----------
let MATS = null;
export function materials() {
  if (MATS) return MATS;
  const P = o => new THREE.MeshPhysicalMaterial(o);
  const grooves = groovesTexture();
  MATS = {
    vinyl: P({ color: 0x050506, roughness: 0.26, metalness: 0.0, clearcoat: 1, clearcoatRoughness: 0.12, bumpMap: grooves, bumpScale: 0.9, sheen: 0.55, sheenRoughness: 0.35, sheenColor: new THREE.Color(0x3a42a0) }),
    chrome: P({ color: 0xeef0f3, metalness: 1, roughness: 0.05, clearcoat: 0.4 }),
    chrome_brushed: P({ color: 0xd6d8da, metalness: 1, roughness: 0.26 }),
    ultra: P({ color: C.ultra, roughness: 0.24, clearcoat: 1, clearcoatRoughness: 0.04, emissive: C.ultra, emissiveIntensity: 0.18 }),
    ultra_matte: P({ color: C.ultra, roughness: 0.5, emissive: C.ultra, emissiveIntensity: 0.1, map: labelTexture() }),
    sticker: P({ color: 0xffffff, roughness: 0.45, map: stickerTexture(false) }),
    sticker_low: P({ color: 0xffffff, roughness: 0.45, map: stickerTexture(true) }),
    white: P({ color: C.white, roughness: 0.3, clearcoat: 0.6 }),
    black_gloss: P({ color: 0x0b0b0c, roughness: 0.14, clearcoat: 1, clearcoatRoughness: 0.03 }),
    black_matte: P({ color: 0x141416, roughness: 0.7 }),
    rubber: P({ color: 0x18181a, roughness: 0.55, sheen: 0.6, sheenColor: new THREE.Color(0x333344) }),
    smoke: P({ color: 0xc9ccd1, metalness: 0, roughness: 0.06, transmission: 1, thickness: 0.35, ior: 1.49, transparent: true }),
    speaker_cone: P({ color: 0x111113, roughness: 0.45, sheen: 0.5, sheenColor: new THREE.Color(0x30304a) }),
    grille: P({ color: 0xcfd2d6, metalness: 1, roughness: 0.2 }),
    tape: P({ color: 0x2a2320, metalness: 0.3, roughness: 0.3 }),
    glass: P({ color: 0xeef0ff, metalness: 0, roughness: 0.03, transmission: 1, thickness: 0.6, ior: 1.45, iridescence: 0.6, iridescenceIOR: 1.35, clearcoat: 1, transparent: true }),
    clay: P({ color: 0xd3d6d8, roughness: 0.62 }),
    clay_dark: P({ color: 0x8e959a, roughness: 0.55 }),
  };
  return MATS;
}

function planarUV(geo, ax = 'x', ay = 'z') {   // fit a flat part (label / sticker) into 0..1
  geo.computeBoundingBox(); const b = geo.boundingBox, p = geo.attributes.position, uv = new Float32Array(p.count * 2);
  const g = { x: 'getX', y: 'getY', z: 'getZ' };
  for (let i = 0; i < p.count; i++) { uv[i * 2] = (p[g[ax]](i) - b.min[ax]) / (b.max[ax] - b.min[ax] || 1); uv[i * 2 + 1] = 1 - (p[g[ay]](i) - b.min[ay]) / (b.max[ay] - b.min[ay] || 1); }
  geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
}
function discUV(geo) { // planar UVs across the record face (disc radius 1 in XZ after glTF Y-up)
  const p = geo.attributes.position, uv = new Float32Array(p.count * 2);
  for (let i = 0; i < p.count; i++) { uv[i * 2] = p.getX(i) * 0.5 + 0.5; uv[i * 2 + 1] = p.getZ(i) * 0.5 + 0.5; }
  geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
}

export function restyle(root, swap = {}) {
  const M = materials();
  root.traverse(o => {
    if (!o.isMesh) return;
    const name = (o.material && o.material.name) || '';
    let key = swap[name] || name;
    if (/cassette_label$/.test(o.name) && key === 'white') { key = 'sticker'; planarUV(o.geometry); }
    if (/cassette_label_low$/.test(o.name) && key === 'white') { key = 'sticker_low'; planarUV(o.geometry); }
    if (/_label$/.test(o.name) && key === 'ultra_matte' && !o.geometry.attributes.uv) planarUV(o.geometry);
    if (M[key]) o.material = M[key];
    if (key === 'vinyl' || key === 'glass') { if (!o.geometry.attributes.uv) discUV(o.geometry); }
    o.frustumCulled = true;
  });
  return root;
}

// ---------- models ----------
const loader = new GLTFLoader();
export const MODELS = {};
export async function loadModels(onProgress) {
  const files = ['vinyl', 'vinyl_glass', 'cassette', 'headphones', 'speaker_driver', 'speaker_box', 'microphone'];
  let done = 0;
  await Promise.all(files.map(f => loader.loadAsync(`assets/models/${f}.glb`).then(g => {
    MODELS[f] = g.scene; done++; onProgress && onProgress(done / files.length);
  })));
  // vinyl parts for instancing
  const parts = {};
  MODELS.vinyl.traverse(o => { if (o.isMesh) parts[o.name.replace('vinyl_', '')] = o.geometry; });
  parts.body && discUV(parts.body);
  parts.label && planarUV(parts.label);
  MODELS.vinylParts = parts;
  return MODELS;
}

/** A clean copy of a model: root transform reset, centred, max dimension = 1. */
export function model(name, swap) {
  const src = MODELS[name].clone(true);
  src.position.set(0, 0, 0); src.rotation.set(0, 0, 0); src.scale.set(1, 1, 1);
  // exported roots carry the Blender scene pose (rotation / scale) — start from a neutral pose
  for (const c of src.children) { c.position.set(0, 0, 0); c.rotation.set(0, 0, 0); c.scale.set(1, 1, 1); }
  const holder = new THREE.Group(); holder.add(src);
  restyle(src, swap);
  src.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(src), size = new THREE.Vector3(), c = new THREE.Vector3();
  box.getSize(size); box.getCenter(c);
  const k = 1 / Math.max(size.x, size.y, size.z);
  src.position.sub(c); holder.scale.setScalar(k);
  const out = new THREE.Group(); out.add(holder); out.userData.size = size.multiplyScalar(k);
  return out;
}
export const find = (root, prefix) => { const r = []; root.traverse(o => { if (o.name && o.name.startsWith(prefix)) r.push(o); }); return r; };

/** N records as three InstancedMeshes (body / label / hole) sharing one set of matrices. */
export class Records {
  constructor(n, { body = 'vinyl', label = 'ultra_matte' } = {}) {
    const P = MODELS.vinylParts, M = materials();
    const lab = M[label].clone(); lab.color.set(0xffffff); lab.emissive.set(0x000000); lab.map = M.ultra_matte.map;
    this.body = new THREE.InstancedMesh(P.body, M[body], n);
    this.label = new THREE.InstancedMesh(P.label, lab, n);
    this.hole = new THREE.InstancedMesh(P.hole, M.chrome, n);
    this.group = new THREE.Group();
    for (const m of [this.body, this.label, this.hole]) { m.instanceMatrix.setUsage(THREE.DynamicDrawUsage); m.frustumCulled = false; this.group.add(m); }
    this.n = n; this.m = new THREE.Matrix4(); this.q = new THREE.Quaternion(); this.s = new THREE.Vector3(); this.p = new THREE.Vector3();
  }
  color(i, hex) { this.label.setColorAt(i, new THREE.Color(hex)); }
  set(i, pos, quat, scale) {
    this.s.setScalar(scale); this.m.compose(pos, quat, this.s);
    this.body.setMatrixAt(i, this.m); this.label.setMatrixAt(i, this.m); this.hole.setMatrixAt(i, this.m);
  }
  commit() {
    for (const m of [this.body, this.label, this.hole]) m.instanceMatrix.needsUpdate = true;
    if (this.label.instanceColor) this.label.instanceColor.needsUpdate = true;
  }
}

/** Live tape: a ribbon whose centre line can be animated every frame (waves, writhing). */
export class Ribbon {
  constructor(points, width, twist = 0, material) {
    this.base = points.map(p => p.clone()); this.cur = points.map(p => p.clone());
    this.width = width; this.twist = twist; this.n = points.length;
    this.geo = ribbonGeometry(points, width, twist);
    this.mesh = new THREE.Mesh(this.geo, material); this.mesh.frustumCulled = false;
    this._t = new THREE.Vector3(); this._u = new THREE.Vector3(); this._s = new THREE.Vector3(); this._nn = new THREE.Vector3(); this._up = new THREE.Vector3(0, 0, 1);
  }
  /** fn(i, base, out) writes the animated centre point. */
  animate(fn) {
    const n = this.n, P = this.geo.attributes.position.array, N = this.geo.attributes.normal.array, w = this.width / 2;
    for (let i = 0; i < n; i++) fn(i, this.base[i], this.cur[i]);
    for (let i = 0; i < n; i++) {
      const a = this.cur[Math.max(0, i - 1)], b = this.cur[Math.min(n - 1, i + 1)], p = this.cur[i];
      this._t.subVectors(b, a).normalize();
      this._u.copy(this._up).applyAxisAngle(this._t, this.twist * i / n);
      this._s.crossVectors(this._t, this._u).normalize(); this._nn.crossVectors(this._s, this._t).normalize();
      const k = i * 6;
      P[k] = p.x + this._s.x * w; P[k + 1] = p.y + this._s.y * w; P[k + 2] = p.z + this._s.z * w;
      P[k + 3] = p.x - this._s.x * w; P[k + 4] = p.y - this._s.y * w; P[k + 5] = p.z - this._s.z * w;
      N[k] = N[k + 3] = this._nn.x; N[k + 1] = N[k + 4] = this._nn.y; N[k + 2] = N[k + 5] = this._nn.z;
    }
    this.geo.attributes.position.needsUpdate = true; this.geo.attributes.normal.needsUpdate = true;
  }
}

/** Flat ribbon along a curve (cassette tape). drawRange grows to "unspool" it. */
export function ribbonGeometry(points, width, twist = 0) {
  const n = points.length, pos = new Float32Array(n * 2 * 3), nor = new Float32Array(n * 2 * 3), idx = [];
  const up = new THREE.Vector3(0, 0, 1), t = new THREE.Vector3(), side = new THREE.Vector3(), nn = new THREE.Vector3();
  for (let i = 0; i < n; i++) {
    const a = points[Math.max(0, i - 1)], b = points[Math.min(n - 1, i + 1)];
    t.subVectors(b, a).normalize();
    const ang = twist * i / n;
    const u = up.clone().applyAxisAngle(t, ang);
    side.crossVectors(t, u).normalize(); nn.crossVectors(side, t).normalize();
    const p = points[i];
    pos.set([p.x + side.x * width / 2, p.y + side.y * width / 2, p.z + side.z * width / 2], i * 6);
    pos.set([p.x - side.x * width / 2, p.y - side.y * width / 2, p.z - side.z * width / 2], i * 6 + 3);
    nor.set([nn.x, nn.y, nn.z, nn.x, nn.y, nn.z], i * 6);
    if (i < n - 1) { const k = i * 2; idx.push(k, k + 1, k + 2, k + 1, k + 3, k + 2); }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  g.setIndex(idx);
  return g;
}
