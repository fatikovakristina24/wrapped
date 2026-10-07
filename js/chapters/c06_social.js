// 06 — sharing is speaking about yourself: the microphone is my voice, the speakers carry it to others.
// They come out of the mic once and stay; the shared cards fly out along the network and settle.
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
    this.lines = [...el.querySelectorAll('.link')];
    this.shares = [...el.querySelectorAll('.share')];
    this.spin = 0;
  }
  update(p, info, dt) {
    this.t += dt;
    const b = this.box('social'); if (!b) return;
    const W = this.world, P = W.pointer, D = this.grab('social'), kick = W.kick, T = this.t;
    const v = range(b.vis, 0.1, 1);
    // microphone: a slow, steady turn
    this.spin += dt * 0.12;
    this.mic.position.set(b.x, b.y - b.h * 0.02, 2);
    this.mic.scale.setScalar(b.h * 0.42);
    this.mic.rotation.set(0.1 + D.y, this.spin + D.x, -0.22);
    // speakers: come out of the mic once, then stay where they landed
    const unit = b.w / 34, orbit = 0;
    this.boxes.forEach((m, i) => {
      const u = m.userData, e = easeOut(clamp((v * 1.3 - u.d) / 0.6));
      const a = u.a + orbit * u.sp;
      m.position.set(b.x + Math.cos(a) * u.rad * unit * e, b.y + Math.sin(a) * u.rad * unit * 0.85 * e, u.z * e);
      m.scale.setScalar(unit * u.s * Math.max(e, 0.001));
      m.rotation.set(u.rot.x, u.rot.y, u.rot.z);
    });
    // DOM: lines draw, shared frames fly out of the hub and keep floating
    this.lines.forEach((l, i) => l.style.setProperty('--k', easeOut(clamp((v * 1.4 - i * 0.07) / 0.5)).toFixed(3)));
    const hub = this.anchors.social.getBoundingClientRect();
    const hx = hub.left + hub.width * 0.49, hy = hub.top + hub.height * 0.49;
    this.shares.forEach((s, i) => {
      const e2 = easeOut(clamp((v * 1.3 - 0.15 - i * 0.06) / 0.55));
      const r = s.getBoundingClientRect();
      const cx = r.left + r.width / 2 - (parseFloat(s.style.getPropertyValue('--dx')) || 0), cy = r.top + r.height / 2 - (parseFloat(s.style.getPropertyValue('--dy')) || 0);
      const fx = 0, fy = 0;                                  // once they land, the cards stay put
      s.style.setProperty('--dx', ((hx - cx) * (1 - e2) + fx * e2).toFixed(1) + 'px');
      s.style.setProperty('--dy', ((hy - cy) * (1 - e2) + fy * e2).toFixed(1) + 'px');
      s.style.setProperty('--e', e2.toFixed(3));
    });
  }
}
