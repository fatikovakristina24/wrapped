// One WebGL canvas for the whole longread. Every chapter owns a scene + camera;
// during a chapter transition the screen is split by a horizontal edge and both scenes are drawn (scissor).
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { Pass } from 'three/addons/postprocessing/Pass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

/** A studio built for reflections: dark room, white softboxes, ultramarine light strips. */
function studio() {
  const s = new THREE.Scene(); s.background = new THREE.Color(0x040406);
  const panel = (w, h, color, k, pos, look = [0, 0, 0]) => { const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color: new THREE.Color(color).multiplyScalar(k), side: THREE.DoubleSide })); m.position.set(...pos); m.lookAt(...look); s.add(m); };
  panel(10, 6, 0xffffff, 3.2, [0, 9, 4]);          // big top softbox
  panel(3, 10, 0xffffff, 2.4, [-9, 1, 3]);         // tall strip left
  panel(5, 5, 0xffffff, 1.6, [8, 3, 6]);           // key right
  panel(1.2, 12, 0x1f2bff, 6, [9, 0, -4]);         // ultramarine strip
  panel(12, 1.2, 0xa9b2ff, 3, [0, -7, -3]);        // pale ultramarine floor line
  panel(4, 4, 0x1f2bff, 4, [-6, -4, -8]);          // blue glow behind
  return s;
}

/** Draws every visible chapter into the composer target, split by the wipe edge. */
class LayersPass extends Pass {
  constructor(world) { super(); this.world = world; this.needsSwap = false; }
  render(renderer, writeBuffer, readBuffer) {             // like RenderPass: draw into readBuffer, no swap
    const rt = readBuffer, W = rt.width, H = rt.height;
    renderer.setClearColor(0x000000, 1);                      // the page ink comes from each scene's background
    rt.scissorTest = false; renderer.setRenderTarget(rt); renderer.clear();
    for (const l of this.world.layers || []) {
      const y0 = Math.round(H * l.top), y1 = Math.round(H * l.bottom);
      if (y1 - y0 < 1) continue;
      rt.scissor.set(0, H - y1, W, y1 - y0); rt.scissorTest = true; rt.viewport.set(0, 0, W, H);
      renderer.setRenderTarget(rt); renderer.clear();
      renderer.render(l.chapter.scene, l.chapter.camera);
    }
    rt.scissorTest = false;
  }
}
import { RectAreaLightUniformsLib } from 'three/addons/lights/RectAreaLightUniformsLib.js';

export class World {
  constructor(canvas) {
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance', alpha: false });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;
    this.renderer.setClearColor(0x0a0a0b, 1);
    this.renderer.autoClear = false;
    RectAreaLightUniformsLib.init();
    const pmrem = new THREE.PMREMGenerator(this.renderer);
    this.env = pmrem.fromScene(studio(), 0.03).texture;
    this.pointer = { x: 0, y: 0, tx: 0, ty: 0 };
    // grab an object with the mouse and spin it 360° with inertia — only the object under the cursor turns
    const d = this.drag = { key: null, down: false, lx: 0, ly: 0, moved: 0 };
    this.bursts = {};                                          // per 3D anchor: time of the last click
    this.spins = {};                                           // per 3D anchor: { x, y, vx, vy }
    this.vel = 0; this.kick = 0;
    addEventListener('pointermove', e => {
      this.pointer.tx = e.clientX / innerWidth * 2 - 1; this.pointer.ty = e.clientY / innerHeight * 2 - 1;
      if (d.down && d.key) { const s = this.spins[d.key]; d.moved += Math.abs(e.clientX - d.lx) + Math.abs(e.clientY - d.ly); s.vx += (e.clientX - d.lx) * 0.0045; s.vy += (e.clientY - d.ly) * 0.003; d.lx = e.clientX; d.ly = e.clientY; }
    }, { passive: true });
    addEventListener('pointerdown', e => {
      if (e.pointerType !== 'mouse' || e.button !== 0) return;
      d.key = this.pick(e.clientX, e.clientY); if (!d.key) return;
      this.spins[d.key] ||= { x: 0, y: 0, vx: 0, vy: 0 };
      d.down = true; d.moved = 0; d.lx = e.clientX; d.ly = e.clientY; document.body.classList.add('dragging');
    });
    addEventListener('pointerup', () => {
      if (d.down && d.key && d.moved < 6) this.bursts[d.key] = performance.now();   // a click (not a drag): blow it apart
      d.down = false; document.body.classList.remove('dragging');
    });
    // post: multisampled target -> layered chapters -> soft bloom -> tone mapping
    this.pr = Math.min(window.devicePixelRatio, 2);
    const rt = new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, samples: 4 });
    this.composer = new EffectComposer(this.renderer, rt);
    this.composer.addPass(new LayersPass(this));
    this.bloom = new UnrealBloomPass(new THREE.Vector2(1, 1), 0.42, 0.65, 0.86);
    this.composer.addPass(this.bloom);
    this.composer.addPass(new OutputPass());
    this.resize();
  }
  resize() {
    this.w = innerWidth; this.h = innerHeight;
    this.renderer.setSize(this.w, this.h, false);
    this.composer.setPixelRatio(this.pr); this.composer.setSize(this.w, this.h);
  }
  tick(dt, scrollVel = 0) {
    const p = this.pointer, k = 1 - Math.exp(-dt * 4);
    p.x += (p.tx - p.x) * k; p.y += (p.ty - p.y) * k;
    const f = Math.pow(0.9, dt * 60), back = Math.pow(0.95, dt * 60);
    for (const [key, s] of Object.entries(this.spins)) {
      s.x += s.vx; s.y += s.vy; s.vx *= f; s.vy *= f;
      if (!(this.drag.down && this.drag.key === key)) s.y *= back;  // pitch springs back, yaw keeps the full turn
    }
    this.vel += (scrollVel - this.vel) * (1 - Math.exp(-dt * 6));
    this.kick = Math.min(1, Math.abs(this.vel) / 60);          // 0..1 — how hard the page is being scrolled
  }
  /** The 3D anchor under the cursor (smallest box wins when boxes overlap). */
  pick(x, y) {
    let best = null, area = Infinity;
    for (const el of document.querySelectorAll('.stage.on [data-a3d]')) {
      const r = el.getBoundingClientRect();
      if (x >= r.left && x <= r.right && y >= r.top && y <= r.bottom && r.width * r.height < area) { best = el.dataset.a3d; area = r.width * r.height; }
    }
    return best;
  }
  /** layers: [{ chapter, top, bottom }] in screen fractions (0 = top). */
  render(layers) { this.layers = layers; this.composer.render(); }
}

export class Chapter {
  constructor(world, el, opts = {}) {
    this.world = world; this.el = el;
    this.scene = new THREE.Scene();
    this.scene.environment = world.env;
    this.scene.background = new THREE.Color(0x0a0a0b);
    this.scene.environmentIntensity = opts.env ?? 0.55;
    this.camera = new THREE.PerspectiveCamera(30, world.w / world.h, 0.1, 400);
    this.camera.position.set(0, 0, 24);
    this.anchors = {};
    el.querySelectorAll('[data-a3d]').forEach(a => { this.anchors[a.dataset.a3d] = a; });
    this.rig(opts.cold);
    this.t = 0; this.p = 0; this.v = 0;
  }
  rig(cold) {
    const add = (color, intensity, w, h, pos) => { const l = new THREE.RectAreaLight(color, intensity, w, h); l.position.set(...pos); l.lookAt(0, 0, 0); this.scene.add(l); return l; };
    this.key = add(0xffffff, 4.5, 10, 10, [7, 9, 13]);
    add(0xffffff, 3.2, 2, 16, [-13, 0, 7]);                           // long strip -> chrome highlight line
    this.rimA = add(cold ? 0xc9ccd1 : 0x1f2bff, cold ? 3 : 11, 12, 12, [-10, 6, -8]);
    this.rimB = add(cold ? 0xb9c3cc : 0xa9b2ff, cold ? 2 : 6, 12, 12, [11, -7, -6]);
    const d = new THREE.DirectionalLight(0xffffff, 0.7); d.position.set(4, 6, 10); this.scene.add(d);
  }
  resize() { this.camera.aspect = this.world.w / this.world.h; this.camera.updateProjectionMatrix(); }
  /** Screen box of a DOM anchor -> world placement on the z=0 plane. */
  box(key) {
    const el = this.anchors[key]; if (!el) return null;
    const r = el.getBoundingClientRect();
    const cam = this.camera, d = cam.position.z;
    const H = 2 * d * Math.tan(THREE.MathUtils.degToRad(cam.fov / 2)), k = H / this.world.h;
    return { x: (r.left + r.width / 2 - this.world.w / 2) * k, y: -(r.top + r.height / 2 - this.world.h / 2) * k, w: r.width * k, h: r.height * k, k,
      top: r.top, bottom: r.bottom, vis: range01((this.world.h - r.top) / (this.world.h * 0.75)) };
  }
  /** Click explosion of one object: 0 → 1 (fly apart) → hold → 0 (reassemble). */
  burst(key, out = 0.35, hold = 0.5, back = 1.15) {
    const t0 = this.world.bursts[key]; if (!t0) return 0;
    const t = (performance.now() - t0) / 1000;
    if (t < out) { const k = t / out; return 1 - Math.pow(1 - k, 3); }
    if (t < out + hold) return 1;
    if (t < out + hold + back) { const k = (t - out - hold) / back; return 1 - (k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2); }
    return 0;
  }
  burstTime(key) { const t0 = this.world.bursts[key]; return t0 ? (performance.now() - t0) / 1000 : 0; }
  /** Mouse spin of one object (zero unless the user grabbed exactly this one). */
  grab(key) { return this.world.spins[key] || ZERO; }
  viewport() { const cam = this.camera, d = cam.position.z, H = 2 * d * Math.tan(THREE.MathUtils.degToRad(cam.fov / 2)); return { w: H * cam.aspect, h: H }; }
  /** p: 0..1 chapter progress, info: { travel, sp (states) }, dt: seconds */
  update() {}
}
const ZERO = Object.freeze({ x: 0, y: 0 });
const range01 = v => Math.min(1, Math.max(0, v));
