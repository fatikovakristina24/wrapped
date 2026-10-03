// 04 — the speaker as a specimen: it plays (bass kicks), then comes apart layer by layer
// while making a full 360° turn; every part spins on its own axis.
import * as THREE from 'three';
import { Chapter } from '../world.js';
import { MODELS, restyle, Records, rng, range, easeInOut, easeOutExpo, clamp, lerp, damp, C } from '../lib/kit.js';

const HOME = { lab_cap: 0.04, lab_surround: 0, lab_cone: 0, lab_basket: 0, lab_ring: -0.03, lab_plate: -0.47, lab_magnet: -0.62 };

export class Lab extends Chapter {
  constructor(world, el) {
    super(world, el, { env: 0.6 });
    const src = MODELS.speaker_driver.clone(true);
    const root = src.children[0]; root.position.set(0, 0, 0); root.rotation.set(0, 0, 0); root.scale.set(1, 1, 1);
    restyle(src);
    this.parts = root.children.map((o, i) => ({ o, ex: o.position.y, home: HOME[o.name] ?? 0, dir: i % 2 ? 1 : -1, sp: 0.6 + i * 0.25 }));
    this.cone = root.children.filter(o => /cone|cap/.test(o.name));
    this.inner = new THREE.Group(); this.inner.add(src); this.inner.position.y = -0.2;
    this.group = new THREE.Group(); this.group.add(this.inner); this.scene.add(this.group);
    this.e = 0; this.turn = 0;
    // sound rings: leave the cone on every kick of the bass
    this.rings = Array.from({ length: 5 }, () => {
      const m = new THREE.Mesh(new THREE.TorusGeometry(1, 0.012, 12, 128), new THREE.MeshBasicMaterial({ color: C.ultraL, transparent: true, depthWrite: false }));
      m.rotation.x = Math.PI / 2; this.inner.add(m); return m;
    });
    // vortex of records around the specimen, like on the cover
    const r = rng(17), n = 56;
    this.rec = new Records(n); this.scene.add(this.rec.group);
    this.items = Array.from({ length: n }, (_, i) => { this.rec.color(i, r() < 0.72 ? C.ultra : C.white); return { a: r() * 6.283, rad: 0.75 + r() * 0.9, y: (r() - 0.5) * 1.6, z: -2.2 + r() * 3, sp: (0.15 + r() * 0.35) * (r() < 0.25 ? -1 : 1), s: 0.05 + r() * 0.1, q: new THREE.Euler(r() * 6, r() * 6, r() * 6), w: 0.6 + r() * 2.2, d: r() * 0.4 }; });
    this.q = new THREE.Quaternion(); this.eu = new THREE.Euler(); this.pos = new THREE.Vector3();
  }
  update(p, info, dt) {
    this.t += dt;
    const b = this.box('lab'); if (!b) return;
    const W = this.world, P = W.pointer, D = this.grab('lab'), T = this.t;
    const target = easeInOut(range(p, 0.1, 0.48)) - 0.6 * easeInOut(range(p, 0.72, 1));
    this.e = damp(this.e, target, 3, dt);
    this.turn = damp(this.turn, easeInOut(range(p, 0.05, 0.95)) * Math.PI * 2, 3, dt);
    const beat = Math.pow(Math.max(0, Math.sin(T * 7.5)), 6);
    const scale = Math.min(b.h / 5.2, b.w / 2.6) * (1 + beat * 0.025 * (1 - this.e));
    this.group.position.set(b.x, b.y + Math.sin(T * 0.9) * b.h * 0.015, 0);
    this.group.scale.setScalar(scale);
    this.group.rotation.set(0.95 + Math.sin(T * 0.6) * 0.15 + P.y * 0.1 + D.y, T * 0.3 + this.turn + D.x, -0.18 + Math.sin(T * 0.45) * 0.1);
    for (const it of this.parts) {
      it.o.position.y = lerp(it.home, it.ex, this.e) + Math.sin(T * 1.6 + it.sp) * 0.06 * this.e;
      it.o.rotation.y = this.e * T * it.sp * it.dir;                     // each layer spins on its own
      it.o.rotation.x = Math.sin(T * 1.2 + it.sp) * 0.15 * this.e;
    }
    for (const c of this.cone) c.scale.y = 1 + beat * 0.9 * (1 - this.e * 0.7);
    this.rings.forEach((m, k) => {
      const ph = (T * 0.55 + k / this.rings.length) % 1;
      m.position.y = 0.25 + ph * 2.4; m.scale.setScalar(0.5 + ph * 2.6); m.material.opacity = (1 - ph) * 0.8 * (0.4 + 0.6 * (1 - this.e));
    });
    const R = b.h * 0.42, show = easeOutExpo(range(b.vis, 0, 0.8)), kick = W.kick;
    this.items.forEach((it, i) => {
      const a = it.a + T * it.sp * (1 + kick * 3) + p * 2.5, k = clamp((show - it.d) / 0.6);
      this.pos.set(b.x + Math.cos(a) * it.rad * R * 1.25, b.y + it.y * R * 0.7 + Math.sin(a) * it.rad * R * 0.35 + Math.sin(T * 1.2 + i) * R * 0.03, it.z * R * 0.45 + Math.sin(a) * R * 0.5);
      this.eu.set(it.q.x + T * it.w, it.q.y + T * it.w * 0.7, it.q.z + a); this.q.setFromEuler(this.eu);
      this.rec.set(i, this.pos, this.q, Math.max(R * it.s * k, 1e-4));
    });
    this.rec.commit();
    this.key.intensity = 4.5 + beat * 3;
    this.rimA.intensity = 11 + beat * 10;
  }
}
