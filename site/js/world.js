// One WebGL canvas for the whole longread. Every chapter owns a scene + camera;
// during a chapter transition the screen is split by a horizontal edge and both scenes are drawn (scissor).
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
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
    this.env = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    this.pointer = { x: 0, y: 0, tx: 0, ty: 0 };
    // drag anywhere with the mouse: spin the chapter's object 360° with inertia
    const d = this.drag = { x: 0, y: 0, vx: 0, vy: 0, down: false, lx: 0, ly: 0 };
    this.vel = 0; this.kick = 0;
    addEventListener('pointermove', e => {
      this.pointer.tx = e.clientX / innerWidth * 2 - 1; this.pointer.ty = e.clientY / innerHeight * 2 - 1;
      if (d.down) { d.vx += (e.clientX - d.lx) * 0.0045; d.vy += (e.clientY - d.ly) * 0.003; d.lx = e.clientX; d.ly = e.clientY; }
    }, { passive: true });
    addEventListener('pointerdown', e => { if (e.pointerType !== 'mouse' || e.button !== 0) return; d.down = true; d.lx = e.clientX; d.ly = e.clientY; document.body.classList.add('dragging'); });
    addEventListener('pointerup', () => { d.down = false; document.body.classList.remove('dragging'); });
    this.resize();
  }
  resize() {
    this.w = innerWidth; this.h = innerHeight;
    this.renderer.setSize(this.w, this.h, false);
  }
  tick(dt, scrollVel = 0) {
    const p = this.pointer, k = 1 - Math.exp(-dt * 4);
    p.x += (p.tx - p.x) * k; p.y += (p.ty - p.y) * k;
    const d = this.drag, f = Math.pow(0.9, dt * 60);
    d.x += d.vx; d.y += d.vy; d.vx *= f; d.vy *= f;
    if (!d.down) d.y *= Math.pow(0.95, dt * 60);              // pitch springs back, yaw keeps the full turn
    this.vel += (scrollVel - this.vel) * (1 - Math.exp(-dt * 6));
    this.kick = Math.min(1, Math.abs(this.vel) / 60);          // 0..1 — how hard the page is being scrolled
  }
  /** layers: [{ chapter, top, bottom }] in screen fractions (0 = top). */
  render(layers) {
    const r = this.renderer, W = this.w, H = this.h;
    r.setScissorTest(false); r.clear();
    for (const l of layers) {
      const y0 = Math.round(H * l.top), y1 = Math.round(H * l.bottom);
      if (y1 - y0 < 1) continue;
      r.setScissorTest(true);
      r.setScissor(0, H - y1, W, y1 - y0);
      r.setViewport(0, 0, W, H);
      r.clear();
      r.render(l.chapter.scene, l.chapter.camera);
    }
    r.setScissorTest(false);
  }
}

export class Chapter {
  constructor(world, el, opts = {}) {
    this.world = world; this.el = el;
    this.scene = new THREE.Scene();
    this.scene.environment = world.env;
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
  viewport() { const cam = this.camera, d = cam.position.z, H = 2 * d * Math.tan(THREE.MathUtils.degToRad(cam.fov / 2)); return { w: H * cam.aspect, h: H }; }
  /** p: 0..1 chapter progress, info: { travel, sp (states) }, dt: seconds */
  update() {}
}
const range01 = v => Math.min(1, Math.max(0, v));
