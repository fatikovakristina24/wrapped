// 06 — the result leaves the person: speakers burst out of the microphone and orbit it,
// woofers kick in sync, records swirl; the microphone turns full circles.
import * as THREE from 'three';
import { Chapter } from '../world.js';
import { model, find, Records, rng, clamp, range, easeOut, easeInOut, C } from '../lib/kit.js';

const SPOTS = [[-8.5, 3.2, -7], [8.5, 3.5, -6], [-6.5, -3.5, -2], [7.0, -3.8, -1], [-12, -1, -14], [13, 0.5, -15], [1, 6.0, -12], [-3.5, 5.0, -4], [4.0, -6.0, -4], [-10, 6.5, -9], [11, -6.5, -8]];

export class Social extends Chapter {
  constructor(world, el) {
    super(world, el);
    const r = rng(21);
    this.mic = model('microphone'); this.scene.add(this.mic);
    this.boxes = SPOTS.map((s, i) => {
      const m = model('speaker_box', i % 3 ? {} : { black_gloss: 'white' });
      const to = new THREE.Vector3(...s);
      m.userData = { a: Math.atan2(to.y, to.x), rad: Math.hypot(to.x, to.y), z: to.z, rot: new THREE.Euler(1.5708 + (r() - 0.5) * 0.8, (r() - 0.5) * 0.8, (r() - 0.5) * 1.2), s: 1.6 + r() * 1.4, d: i * 0.05, sp: (0.08 + r() * 0.1) * (i % 2 ? 1 : -1), cones: find(m, 'box_woof_cone') };
      this.scene.add(m); return m;
    });
    this.rec = new Records(40); this.scene.add(this.rec.group);
    this.recs = Array.from({ length: 40 }, (_, i) => { this.rec.color(i, r() < 0.6 ? C.ultra : C.white); return { a: r() * 6.28, r: 5 + r() * 11, z: (r() - 0.5) * 10, sp: 0.15 + r() * 0.35, s: 0.35 + r() * 0.5, q: new THREE.Euler(r() * 6, r() * 6, 0), w: 0.8 + r() * 2 }; });
    this.lines = [...el.querySelectorAll('.link')];
    this.shares = [...el.querySelectorAll('.share')];
    this.spin = 0;
  }
  update(p, info, dt) {
    this.t += dt;
    const b = this.box('social'); if (!b) return;
    const W = this.world, P = W.pointer, D = this.spin('social'), kick = W.kick, T = this.t;
    const v = range(b.vis, 0.1, 1);
    const beat = Math.pow(Math.max(0, Math.sin(T * 7.5)), 5);
    // microphone: full turns, faster when scrolling
    this.spin += dt * (0.5 + kick * 4);
    this.mic.position.set(b.x, b.y - b.h * 0.02 + Math.sin(T * 1.1) * b.h * 0.015, 2);
    this.mic.scale.setScalar(b.h * 0.62 * (1 + beat * 0.02));
    this.mic.rotation.set(0.1 + Math.sin(T * 0.7) * 0.12 + P.y * 0.1 + D.y, this.spin + p * Math.PI * 2 + D.x, -0.22 + Math.sin(T * 0.5) * 0.08);
    // speakers: burst out, then orbit the microphone
    const unit = b.w / 34, orbit = T * (1 + kick * 3) + p * 3;
    this.boxes.forEach((m, i) => {
      const u = m.userData, e = easeOut(clamp((v * 1.3 - u.d) / 0.6));
      const a = u.a + orbit * u.sp;
      m.position.set(b.x + Math.cos(a) * u.rad * unit * e, b.y + Math.sin(a) * u.rad * unit * 0.85 * e, u.z * e + Math.sin(T + i) * 0.5);
      m.scale.setScalar(unit * u.s * Math.max(e, 0.001) * (1 + beat * 0.06));
      m.rotation.set(u.rot.x + Math.sin(T * 0.9 + i) * 0.25, u.rot.y + T * 0.4 * (i % 2 ? 1 : -1), u.rot.z + Math.sin(T * 0.6 + i) * 0.2);
      for (const c of u.cones) c.scale.y = 1 + beat * 1.2;
    });
    // records swirl around in a slow vortex
    const q = new THREE.Quaternion(), pos = new THREE.Vector3(), eu = new THREE.Euler();
    this.recs.forEach((it, i) => {
      const s = easeOut(clamp((v * 1.4 - 0.2 - i * 0.008) / 0.6));
      const a = it.a + T * it.sp * (1 + kick * 2);
      pos.set(Math.cos(a) * it.r * unit * s + b.x, Math.sin(a) * it.r * unit * 0.7 * s + b.y, it.z * s);
      eu.set(it.q.x + T * it.w, it.q.y + T * it.w * 0.6, a); q.setFromEuler(eu);
      this.rec.set(i, pos, q, Math.max(unit * it.s * s, 1e-4));
    });
    this.rec.commit();
    this.rimA.intensity = 11 + beat * 12;
    // DOM: lines draw, shared frames fly out of the hub and keep floating
    this.lines.forEach((l, i) => l.style.setProperty('--k', easeOut(clamp((v * 1.4 - i * 0.07) / 0.5)).toFixed(3)));
    const hub = this.anchors.social.getBoundingClientRect();
    const hx = hub.left + hub.width * 0.49, hy = hub.top + hub.height * 0.49;
    this.shares.forEach((s, i) => {
      const e2 = easeOut(clamp((v * 1.3 - 0.15 - i * 0.06) / 0.55));
      const r = s.getBoundingClientRect();
      const cx = r.left + r.width / 2 - (parseFloat(s.style.getPropertyValue('--dx')) || 0), cy = r.top + r.height / 2 - (parseFloat(s.style.getPropertyValue('--dy')) || 0);
      const fx = Math.sin(T * 0.8 + i * 1.7) * 10, fy = Math.cos(T * 0.7 + i) * 12;
      s.style.setProperty('--dx', ((hx - cx) * (1 - e2) + fx * e2).toFixed(1) + 'px');
      s.style.setProperty('--dy', ((hy - cy) * (1 - e2) + fy * e2).toFixed(1) + 'px');
      s.style.setProperty('--e', e2.toFixed(3));
    });
  }
}
