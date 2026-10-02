// 08 — the record from the cover returns as glass: memory. It slowly tumbles through a full turn,
// small glass records orbit it, each spinning; drag to turn it yourself.
import * as THREE from 'three';
import { Chapter } from '../world.js';
import { model, rng, clamp, range, easeOut, easeInOut, lerp, damp } from '../lib/kit.js';

export class Final extends Chapter {
  constructor(world, el) {
    super(world, el, { env: 0.45 });
    this.pivot = new THREE.Group(); this.scene.add(this.pivot);
    this.disc = model('vinyl_glass'); this.pivot.add(this.disc);
    const r = rng(4);
    this.orbit = Array.from({ length: 14 }, (_, i) => {
      const m = model('vinyl_glass', i % 3 ? {} : { ultra_matte: 'white' });
      this.scene.add(m);
      return { m, a: r() * 6.28, rx: 0.75 + r() * 0.55, ry: 0.3 + r() * 0.4, z: -1 - r() * 3, s: 0.08 + r() * 0.12, w: (0.12 + r() * 0.2) * (i % 2 ? 1 : -1), q: new THREE.Euler(r() * 6, r() * 6, 0), sp: 0.4 + r() * 1.2 };
    });
    this.spin = 0; this.turn = 0;
    this.last = [...el.querySelectorAll('.t')].find(t => t.textContent === 'ПАМЯТЬ');
  }
  update(p, info, dt) {
    this.t += dt;
    const b = this.box('final'); if (!b) return;
    const W = this.world, P = W.pointer, D = W.drag, kick = W.kick, T = this.t;
    const R = b.w * 0.37, v = easeOut(range(b.vis, 0, 0.9));
    this.spin += dt * (0.2 + kick * 2);
    this.turn = damp(this.turn, easeInOut(range(p, 0.05, 0.85)) * Math.PI * 2, 2, dt);
    this.disc.rotation.y = this.spin;
    this.disc.scale.setScalar(R * 2 * lerp(0.8, 1, v));
    this.pivot.position.set(b.x, b.y + Math.sin(T * 0.6) * R * 0.04, 0);
    this.pivot.rotation.set(1.08 + Math.sin(T * 0.35) * 0.18 + P.y * 0.15 + D.y, -0.14 + this.turn + D.x, 0.38 - P.x * 0.18 + Math.sin(T * 0.25) * 0.1);
    this.orbit.forEach(o => {
      const a = o.a + T * o.w * (1 + kick * 2);
      o.m.position.set(b.x + Math.cos(a) * R * 1.6 * o.rx, b.y + Math.sin(a) * R * 1.3 * o.ry + Math.sin(T + o.a) * R * 0.05, o.z * R * 0.4 + Math.sin(a) * R * 0.3);
      o.m.scale.setScalar(R * 2 * o.s * v);
      o.m.rotation.set(o.q.x + T * o.sp, o.q.y + T * o.sp * 0.7, a);
    });
    if (this.last) this.last.style.transform = `translate3d(0, ${(1 - p) * 40}px, 0)`;
  }
}
