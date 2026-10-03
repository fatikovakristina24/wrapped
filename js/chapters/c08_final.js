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
    // memory: glowing points drifting on invisible orbits around the record
    const dot = document.createElement('canvas'); dot.width = dot.height = 64;
    const g = dot.getContext('2d'), gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.25, 'rgba(200,206,255,.6)'); gr.addColorStop(1, 'rgba(169,178,255,0)');
    g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
    const glow = new THREE.CanvasTexture(dot);
    this.threads = Array.from({ length: 40 }, (_, i) => {
      const spark = new THREE.Mesh(new THREE.SphereGeometry(0.018, 16, 12), new THREE.MeshBasicMaterial({ color: 0xffffff }));
      const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: glow, color: 0xc9ceff, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false })); halo.scale.setScalar(0.1 + r() * 0.14);
      const grp = new THREE.Group(); grp.add(spark, halo); grp.rotation.set(r() * 3, r() * 6.28, (r() - 0.5) * 1.2); spark.scale.setScalar(0.5 + r() * 0.9); this.scene.add(grp);
      return { grp, spark, halo, rx: 0.9 + r() * 1.1, rz: 0.4 + r() * 0.8, sp: (0.15 + r() * 0.35) * (i % 2 ? 1 : -1), ph: r() * 6.28 };
    });
    this.last = [...el.querySelectorAll('.t')].find(t => t.textContent === 'ПАМЯТЬ');
  }
  update(p, info, dt) {
    this.t += dt;
    const b = this.box('final'); if (!b) return;
    const W = this.world, P = W.pointer, D = this.grab('final'), kick = W.kick, T = this.t;
    const R = b.w * 0.27, v = easeOut(range(b.vis, 0, 0.9));
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
    // threads live around the record, scaled to it
    this.threads.forEach(th => {
      th.grp.position.set(b.x, b.y, 0); th.grp.scale.setScalar(R * 1.35 * v);
      th.grp.rotation.y += 0.0015 * Math.sign(th.sp);
      const a = th.ph + T * th.sp; th.spark.position.set(Math.cos(a) * th.rx, 0, Math.sin(a) * th.rz); th.halo.position.copy(th.spark.position);
      th.halo.material.opacity = 0.55 + Math.sin(T * 2.4 + th.ph * 3) * 0.45;
    });
    if (this.last) this.last.style.transform = `translate3d(0, ${(1 - p) * 40}px, 0)`;
  }
}
