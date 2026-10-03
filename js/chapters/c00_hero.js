// 00 — a giant record turns behind SPOTIFY WRAPPED inside a vortex of the year's records.
// Scroll: the record makes a full 360° flip and the vortex tightens into the ring of chapter 01.
// Mouse drag: spin it yourself.
import * as THREE from 'three';
import { Chapter } from '../world.js';
import { model, Records, rng, clamp, range, easeOutExpo, easeInOut, lerp, damp, C } from '../lib/kit.js';

export class Hero extends Chapter {
  constructor(world, el) {
    super(world, el);
    this.pivot = new THREE.Group();
    this.disc = model('vinyl');
    this.pivot.add(this.disc);
    this.scene.add(this.pivot);
    const r = rng(11), n = 64;
    this.rec = new Records(n); this.scene.add(this.rec.group);
    this.items = [];
    for (let i = 0; i < n; i++) {
      this.items.push({
        a: r() * Math.PI * 2, rad: 0.62 + r() * 0.95, z: -3.2 + r() * 3.4, sp: (0.12 + r() * 0.3) * (r() < 0.2 ? -1 : 1),
        s: 0.07 + r() * 0.15, q: new THREE.Euler(r() * 6, r() * 6, r() * 6), w: 0.6 + r() * 2.4, d: i * 0.014 + r() * 0.25, bob: r() * 6,
      });
      this.rec.color(i, r() < 0.78 ? C.ultra : C.white);
    }
    this.t0 = performance.now(); this.spin = 0; this.flip = 0;
    this.q = new THREE.Quaternion(); this.e = new THREE.Euler(); this.pos = new THREE.Vector3();
  }
  update(p, info, dt) {
    this.t += dt;
    const b = this.box('hero'); if (!b) return;
    const W = this.world, P = W.pointer, D = this.grab('hero'), kick = W.kick;
    const R = Math.min(b.w * 0.36, this.viewport().w * 0.5);   // on a phone the record fits the screen width
    const intro = clamp((performance.now() - this.t0 - 250) / 2600);
    // turntable spin — faster with scroll speed
    this.spin += dt * (0.45 + p * 3.5 + kick * 6);
    this.disc.rotation.y = this.spin;
    this.disc.scale.setScalar(R * 2 * lerp(0.6, 1, easeOutExpo(intro)));
    // full 360° flip through the cover, plus the mouse
    this.flip = damp(this.flip, easeInOut(range(p, 0.08, 0.9)) * Math.PI * 2, 4, dt);
    this.pivot.position.set(b.x, b.y + R * 0.05 + Math.sin(this.t * 0.8) * R * 0.03, -p * R * 0.6);
    this.pivot.rotation.set(1.05 + P.y * 0.12 + D.y + Math.sin(this.t * 0.5) * 0.05, -0.12 + this.flip + D.x, 0.42 - P.x * 0.12);
    // vortex: every record orbits the big one and tumbles; scroll pulls the vortex into a ring
    const gather = easeInOut(range(p, 0.62, 1));
    this.items.forEach((it, i) => {
      const k = easeOutExpo(clamp((intro - it.d) / 0.55));
      const a = it.a + this.t * it.sp * (1 + kick * 3) + p * 2.2;
      const rad = lerp(it.rad * (1 + p * 0.35), 1.15, gather);
      this.pos.set(Math.cos(a) * rad * 1.4, Math.sin(a) * rad * lerp(0.75, 0.42, gather) + Math.sin(this.t * 1.3 + it.bob) * 0.06, lerp(it.z, 0, gather));
      this.pos.z = lerp(-45, this.pos.z, k);
      this.pos.multiplyScalar(R); this.pos.x += b.x; this.pos.y += b.y;
      this.pos.x -= P.x * (this.pos.z / R + 3) * R * 0.05; this.pos.y += P.y * (this.pos.z / R + 3) * R * 0.04;
      this.e.set(it.q.x + this.t * it.w, it.q.y + this.t * it.w * 0.7, it.q.z + a);
      this.q.setFromEuler(this.e);
      this.rec.set(i, this.pos, this.q, R * it.s * k);
    });
    this.rec.commit();
    this.rimA.intensity = 11 + Math.sin(this.t * 1.3) * 4 + kick * 10;
  }
}
