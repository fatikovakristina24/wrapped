// 03 — maximal structure, constantly alive: a dancing tower of records (minutes), floating stacks
// of cassettes (tracks), a breathing planet of records (artists), a pulsing ring of stacks (genres).
import * as THREE from 'three';
import { Chapter } from '../world.js';
import { model, Records, rng, clamp, range, easeOut, easeOutBack, C } from '../lib/kit.js';

export class Data extends Chapter {
  constructor(world, el) {
    super(world, el);
    const r = rng(8);
    this.tower = new Records(70); this.scene.add(this.tower.group);
    for (let k = 0; k < 70; k++) this.tower.color(k, k % 10 === 9 ? C.white : C.ultra);
    this.cGroup = new THREE.Group(); this.scene.add(this.cGroup);
    const H = [3, 6, 2, 5, 4, 1, 6, 3, 2, 5, 3, 4];
    this.cas = []; let order = 0;
    for (let gx = 0; gx < 4; gx++) for (let gz = 0; gz < 3; gz++) {
      const h = H[gx * 3 + gz];
      for (let k = 0; k < h; k++) {
        const m = model('cassette'); m.userData.home = new THREE.Vector3((gx - 1.5) * 1.18, k * 0.15, (gz - 1) * 0.8);
        m.userData.o = order++; m.userData.col = gx * 3 + gz; m.userData.k = k; m.userData.ry = (r() - 0.5) * 0.12;
        this.cGroup.add(m); this.cas.push(m);
      }
    }
    this.casN = order;
    this.sphere = new Records(140); this.scene.add(this.sphere.group);
    this.sph = [];
    const ga = Math.PI * (3 - Math.sqrt(5));
    for (let i = 0; i < 140; i++) {
      const y = 1 - 2 * (i + 0.5) / 140, rr = Math.sqrt(1 - y * y), th = ga * i;
      const d = new THREE.Vector3(Math.cos(th) * rr, y, Math.sin(th) * rr);
      const big = r() < 0.05;
      this.sph.push({ d, big, from: new THREE.Vector3((r() - 0.5) * 8, (r() - 0.5) * 8, (r() - 0.5) * 6), s: big ? 0.3 : 0.16 + r() * 0.06, q: new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), d), ph: r() * 6 });
      this.sphere.color(i, big ? C.white : r() < 0.55 ? C.ultra : 0x18181c);
    }
    const shares = Array.from({ length: 18 }, () => Math.pow(r(), 2.2)).sort((a, b) => b - a);
    this.gen = []; let total = 0;
    shares.forEach((s, i) => { const h = Math.max(1, Math.round(14 * Math.pow(s / shares[0], 0.7))); this.gen.push({ i, h, start: total }); total += h; });
    this.genre = new Records(total); this.scene.add(this.genre.group);
    this.gen.forEach(g => { for (let k = 0; k < g.h; k++) this.genre.color(g.start + k, g.i < 3 ? C.ultra : g.i < 5 ? C.white : 0x18181c); });
    this.Y = new THREE.Vector3(0, 1, 0); this.q = new THREE.Quaternion(); this.q2 = new THREE.Quaternion(); this.e = new THREE.Euler(); this.pos = new THREE.Vector3();
  }
  update(p, info, dt) {
    this.t += dt;
    const W = this.world, P = W.pointer, D = W.drag, kick = W.kick, T = this.t;
    const q = this.q, pos = this.pos, e = this.e;
    // tower — records fall in, then the whole column dances like a spine
    const a = this.box('minutes');
    if (a) {
      const R = a.w * 0.36, step = a.h * 0.9 / 70, v = range(a.vis, 0.05, 1);
      this.tower.group.position.set(a.x, a.y - a.h * 0.45, 0);
      this.tower.group.rotation.set(0.32 + P.y * 0.05 + D.y, T * 0.4 + D.x, 0.04);
      for (let k = 0; k < 70; k++) {
        const kk = easeOutBack(clamp((v * 1.15 - k / 70) / 0.12));
        const sway = Math.sin(k * 0.16 - T * 2.2) * (0.07 + kick * 0.1);
        pos.set(Math.sin(k * 0.19 + T * 1.5) * R * sway, k * step + (1 - kk) * a.h * 0.3, Math.cos(k * 0.19 + T * 1.5) * R * sway);
        e.set(Math.sin(k * 0.3 - T * 2.4) * 0.22, k * 0.21 + T * 0.8, Math.cos(k * 0.3 - T * 2.4) * 0.22); q.setFromEuler(e);
        this.tower.set(k, pos, q, Math.max(R * clamp(kk * 3) * (1 + Math.max(0, Math.sin(k * 0.5 - T * 4)) ** 6 * 0.15), 1e-4));
      }
      this.tower.commit();
    }
    // cassettes — drop in, then the stacks breathe and the block turns a full circle
    const b = this.box('tracks');
    if (b) {
      this.cGroup.position.set(b.x, b.y - b.h * 0.12 + Math.sin(T * 0.9) * b.h * 0.02, 0);
      this.cGroup.scale.setScalar(b.w * 0.25);
      this.cGroup.rotation.set(0.62 + Math.sin(T * 0.5) * 0.08 + P.y * 0.06 + D.y, -0.62 + Math.sin(T * 0.35) * 0.35 + D.x, Math.sin(T * 0.4) * 0.05);
      const v = range(b.vis, 0.05, 1);
      for (const m of this.cas) {
        const u = m.userData, k = easeOutBack(clamp((v * 1.2 - u.o / this.casN) / 0.15));
        const lift = Math.max(0, Math.sin(T * 2.2 - u.col * 0.7)) ** 3 * 0.08 * (u.k + 1) * (1 + kick * 2);
        m.position.copy(u.home); m.position.y += (1 - k) * 3 + lift;
        m.scale.setScalar(Math.max(clamp(k * 2), 1e-4));
        m.rotation.set((1 - k) * 0.8 + Math.sin(T * 1.7 + u.o) * 0.03, u.ry + Math.sin(T * 1.1 + u.o * 0.5) * 0.06, 0);
      }
    }
    // planet — assembles from chaos, spins 360° with the scroll and breathes like a speaker
    const c = this.box('artists');
    if (c) {
      const R = c.w * 0.38, v = easeOut(range(c.vis, 0.05, 0.95));
      this.sphere.group.position.set(c.x, c.y, 0);
      this.sphere.group.rotation.set(0.2 + Math.sin(T * 0.4) * 0.2 + D.y, T * 0.45 + p * Math.PI * 2 + D.x, Math.sin(T * 0.3) * 0.1);
      this.sph.forEach((s, i) => {
        const breathe = 1 + Math.sin(T * 2.6 + s.d.y * 4 + s.ph * 0.2) * (0.05 + kick * 0.12) + (s.big ? 0.06 : 0);
        pos.copy(s.from).lerp(s.d, v).multiplyScalar(R * breathe);
        this.q2.setFromAxisAngle(s.d, T * 0.8 + s.ph); q.copy(s.q).premultiply(this.q2);
        this.sphere.set(i, pos, q, R * s.s * clamp(v * 1.4));
      });
      this.sphere.commit();
    }
    // genre ring — stacks rise, then pulse like an equaliser while the ring turns
    const d = this.box('genres');
    if (d) {
      const R = d.w * 0.33, v = easeOut(range(d.vis, 0.05, 0.9));
      this.genre.group.position.set(d.x, d.y - d.h * 0.06, 0);
      this.genre.group.rotation.set(0.62 + Math.sin(T * 0.5) * 0.1 + D.y, T * 0.35 + D.x, 0);
      this.gen.forEach(g => {
        const th = 2 * Math.PI * g.i / 18, eq = 0.75 + 0.25 * Math.sin(T * 3 + g.i * 0.9) + kick * 0.3;
        for (let k = 0; k < g.h; k++) {
          const on = clamp((v * g.h * eq - k) * 1.5);
          pos.set(Math.cos(th) * R, k * R * 0.045, Math.sin(th) * R);
          q.setFromAxisAngle(this.Y, k * 0.7 + g.i + T * 1.5);
          this.genre.set(g.start + k, pos, q, Math.max(R * 0.19 * on, 1e-4));
        }
      });
      this.genre.commit();
    }
  }
}
