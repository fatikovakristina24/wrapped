// 02 — cassette (2015) → stack of records (2016) → headphones (today).
// Every object enters with a full 360° turn, keeps moving, and can be spun with the mouse.
import * as THREE from 'three';
import { Chapter } from '../world.js';
import { model, find, Records, clamp, range, easeOut, easeOutBack, easeInOut, lerp, C } from '../lib/kit.js';

export class History extends Chapter {
  constructor(world, el) {
    super(world, el);
    this.cas = model('cassette'); this.scene.add(this.cas);
    this.reels = [...find(this.cas, 'cassette_reel'), ...find(this.cas, 'cassette_hub'), ...find(this.cas, 'cassette_pack')];
    this.parts = []; this.cas.traverse(o => { if (o.isMesh) this.parts.push({ o, p: o.position.clone(), d: o.position.clone().normalize().multiplyScalar(0.6 + Math.random() * 0.8), r: (Math.random() - 0.5) * 3 }); });
    this.stack = new Records(9); this.scene.add(this.stack.group);
    for (let k = 0; k < 9; k++) this.stack.color(k, k === 8 ? C.white : C.ultra);
    this.hp = model('headphones'); this.scene.add(this.hp);
    this.band = [...find(this.hp, 'hp_band'), ...find(this.hp, 'hp_cushion')];
    this.sides = find(this.hp, 'hp_side').map(o => ({ o, x: o.position.x }));
    this.yokes = find(this.hp, 'hp_yoke');
    this.Y = new THREE.Vector3(0, 1, 0); this.q = new THREE.Quaternion(); this.e = new THREE.Euler(); this.pos = new THREE.Vector3();
  }
  update(p, info, dt) {
    this.t += dt;
    const W = this.world, P = W.pointer, kick = W.kick, T = this.t;
    let D;
    // cassette: tumbles in with a full turn, reels race with the scroll, comes apart on exit
    const a = this.box('h2015');
    if (a) {
      D = this.spin('h2015');
      const v = easeOut(a.vis), out = easeInOut(clamp((W.h * 0.2 - a.bottom) / (W.h * 0.5)));
      this.cas.position.set(a.x, a.y + Math.sin(T * 1.1) * a.h * 0.03, 0);
      this.cas.scale.setScalar(a.w * 0.92 * lerp(0.6, 1, v));
      this.cas.rotation.set(1.22 + Math.sin(T * 0.7) * 0.12 + P.y * 0.08 + D.y - out * 0.6, (1 - v) * Math.PI * 2 - 0.1 + Math.sin(T * 0.5) * 0.25 + D.x, -0.3 + Math.sin(T * 0.9) * 0.06);
      for (const r of this.reels) r.rotation.y -= dt * (2.2 + kick * 14);
      for (const it of this.parts) { it.o.position.copy(it.p).addScaledVector(it.d, out * 1.1); it.o.rotation.z = it.r * out; it.o.rotation.x = it.r * out * 0.5; }
    }
    // stack: records drop in, then the stack fans and breathes
    const s = this.box('h2016');
    if (s) {
      D = this.spin('h2016');
      const R = s.w * 0.33;
      this.stack.group.position.set(s.x - s.w * 0.02, s.y - s.h * 0.08, 0);
      this.stack.group.rotation.set(0.5 + Math.sin(T * 0.6) * 0.1 + P.y * 0.06 + D.y, T * 0.35 + D.x + (1 - easeOut(s.vis)) * Math.PI * 2, Math.sin(T * 0.8) * 0.08);
      for (let k = 0; k < 9; k++) {
        const kk = easeOutBack(clamp((s.vis * 1.25 - k / 9 * 0.8) / 0.25));
        const fan = Math.sin(T * 1.4 - k * 0.5) * (0.5 + kick);
        this.pos.set(Math.cos(T * 0.9 + k * 0.7) * R * 0.09 * k / 8, -R * 0.35 + k * R * (0.085 + 0.02 * Math.max(0, Math.sin(T * 1.6 - k * 0.6))) + (1 - kk) * R * 2.2, Math.sin(T * 0.9 + k * 0.7) * R * 0.09 * k / 8);
        this.e.set(fan * 0.12, k * 0.4 + T * (0.6 + k * 0.08), fan * 0.08); this.q.setFromEuler(this.e);
        this.stack.set(k, this.pos, this.q, Math.max(R * Math.min(1, kk + 0.001), 1e-4));
      }
      this.stack.commit();
    }
    // headphones: assemble, then keep turning — a full 360° every few seconds
    const h = this.box('hnow');
    if (h) {
      D = this.spin('hnow');
      const v = h.vis;
      this.hp.position.set(h.x + h.w * 0.02, h.y + h.h * 0.04 + Math.sin(T * 1.2) * h.h * 0.025, 0);
      this.hp.scale.setScalar(h.w * 0.78);
      this.hp.rotation.set(0.12 + Math.sin(T * 0.8) * 0.1 + P.y * 0.06 + D.y, -0.55 + T * (0.55 + kick * 2) + (1 - v) * Math.PI * 2 + D.x, Math.sin(T * 0.6) * 0.08);
      const g = easeOut(range(v, 0.0, 0.55));
      for (const o of this.band) o.scale.set(Math.max(g, 0.001), 1, 1);
      const c = easeOutBack(range(v, 0.3, 0.9));
      for (const sd of this.sides) sd.o.position.x = sd.x * lerp(3, 1, c) * (1 + Math.max(0, Math.sin(T * 6)) ** 8 * 0.04);
      for (const y of this.yokes) y.visible = c > 0.9;
    }
  }
}
