// 07 — the algorithm's view: a cold, smoky cassette is being scanned; its tape spills out and writhes,
// and the data it holds rises out of it as grey pixels. Everything here moves at half speed.
import * as THREE from 'three';
import { Chapter } from '../world.js';
import { model, find, Ribbon, rng, clamp, range, damp } from '../lib/kit.js';

export class Algo extends Chapter {
  constructor(world, el) {
    super(world, el, { cold: true, env: 0.75 });
    this.group = new THREE.Group(); this.scene.add(this.group);
    // a real cassette, but drained of colour: smoked shell, grey labels, visible reels
    this.cas = model('cassette', { ultra: 'clay_dark', tape: 'clay_dark', white: 'clay' });
    this.group.add(this.cas);
    this.reels = [...find(this.cas, 'cassette_reel'), ...find(this.cas, 'cassette_hub'), ...find(this.cas, 'cassette_pack')];
    // tape: one smooth ribbon spilling down in loose loops
    const pts = [];
    for (let i = 0; i < 900; i++) {
      const t = i / 899, a = t * Math.PI * 7, rad = 0.15 + 1.35 * t;
      pts.push(new THREE.Vector3(Math.cos(a) * rad * 1.2, -0.3 - 2.0 * t + 0.25 * Math.sin(a * 1.3), Math.sin(a * 0.8) * rad * 0.55));
    }
    this.tape = new Ribbon(pts, 0.11, Math.PI * 5, new THREE.MeshPhysicalMaterial({ color: 0x9aa0a6, metalness: 0.45, roughness: 0.3, side: THREE.DoubleSide }));
    this.group.add(this.tape.mesh);
    this.idx = this.tape.geo.index.count; this.f = 0;
    // data pixels rising out of the cassette
    const r = rng(31), N = 260;
    this.px = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshPhysicalMaterial({ color: 0xffffff, roughness: 0.35, metalness: 0.2 }), N);
    this.px.frustumCulled = false; this.group.add(this.px);
    this.pix = Array.from({ length: N }, (_, i) => {
      const c = r(); this.px.setColorAt(i, new THREE.Color(c < 0.12 ? 0xf3f3f0 : c < 0.55 ? 0xc9ccd1 : 0x6e747a));
      return { a: r() * 6.283, rad: 0.3 + r() * 1.8, ph: r(), sp: 0.04 + r() * 0.06, s: 0.025 + r() * 0.05, spin: r() * 6, w: (r() - 0.5) * 2 };
    });
    // scanner: a thin frame + faint plane sweeping over the cassette
    const plane = new THREE.PlaneGeometry(3.4, 2.3);
    this.scan = new THREE.Group(); this.group.add(this.scan);
    this.scan.add(new THREE.Mesh(plane, new THREE.MeshBasicMaterial({ color: 0xdfe1e4, transparent: true, opacity: 0.06, side: THREE.DoubleSide, depthWrite: false })));
    this.scan.add(new THREE.LineSegments(new THREE.EdgesGeometry(plane), new THREE.LineBasicMaterial({ color: 0xf3f3f0, transparent: true, opacity: 0.7 })));
    this.scan.rotation.x = -Math.PI / 2;
    this.m = new THREE.Matrix4(); this.q = new THREE.Quaternion(); this.e = new THREE.Euler(); this.p = new THREE.Vector3(); this.s = new THREE.Vector3();
  }
  update(p, info, dt) {
    this.t += dt;
    const b = this.box('algo'); if (!b) return;
    const W = this.world, P = W.pointer, D = this.grab('algo'), T = this.t * 0.5;     // half speed
    const u = b.w * 0.24;
    this.group.position.set(b.x - b.w * 0.08, b.y + b.h * 0.22 + Math.sin(T * 0.8) * u * 0.05, 0);
    this.group.scale.setScalar(u);
    this.group.rotation.set(0.15 + Math.sin(T * 0.5) * 0.08 + P.y * 0.05 + D.y, -0.15 + T * 0.25 + p * Math.PI + D.x, Math.sin(T * 0.4) * 0.05);
    this.cas.rotation.set(1.18 + Math.sin(T * 0.7) * 0.08, -0.1 + Math.sin(T * 0.45) * 0.25, -0.16);
    this.cas.scale.setScalar(1.3);
    this.f = damp(this.f, range(b.vis * 0.6 + p * 0.6, 0.1, 1), 2, dt);
    this.tape.geo.setDrawRange(0, Math.floor(this.idx * clamp(this.f) / 6) * 6);
    this.tape.animate((i, base, out) => {
      const k = i / 900;
      out.set(base.x + Math.sin(i * 0.012 + T * 1.1) * 0.12 * k, base.y + Math.sin(i * 0.009 - T * 0.9) * 0.08 * k, base.z + Math.cos(i * 0.011 + T * 0.8) * 0.12 * k);
    });
    for (const r of this.reels) r.rotation.y -= dt * 0.8;
    // pixels: leave the cassette and rise in a slow spiral, fading out at the top
    this.pix.forEach((it, i) => {
      const h = (it.ph + T * it.sp) % 1, a = it.a + h * 3 + T * 0.2;
      const rad = it.rad * (0.35 + h * 0.9);
      this.p.set(Math.cos(a) * rad, -0.2 + h * 3.6, Math.sin(a) * rad * 0.7);
      this.e.set(it.spin + T * it.w, it.spin * 0.5 + T * it.w * 0.7, 0); this.q.setFromEuler(this.e);
      const s = it.s * Math.sin(h * Math.PI) * clamp(this.f * 1.5);
      this.s.setScalar(Math.max(s, 1e-4)); this.m.compose(this.p, this.q, this.s); this.px.setMatrixAt(i, this.m);
    });
    this.px.instanceMatrix.needsUpdate = true;
    // the scanner sweeps up and down across the cassette
    const sw = Math.sin(T * 1.1);
    this.scan.position.set(0, sw * 1.1, 0);
    this.scan.rotation.z = Math.sin(T * 0.4) * 0.1;
  }
}
