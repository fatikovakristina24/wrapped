// 01 — 365 records assemble into the loop of the year; size = minutes that day.
// The loop never stands still: an equaliser wave runs around it, scroll turns it a full 360°.
import * as THREE from 'three';
import { Chapter } from '../world.js';
import { Records, yearValues, clamp, range, easeOut, easeInOut, lerp, damp, C } from '../lib/kit.js';

export class Ring extends Chapter {
  constructor(world, el) {
    super(world, el);
    this.vals = yearValues();
    this.top = this.vals.indexOf(Math.max(...this.vals));
    this.rec = new Records(365);
    this.group = new THREE.Group(); this.group.add(this.rec.group); this.scene.add(this.group);
    this.vals.forEach((v, i) => this.rec.color(i, i === this.top ? C.white : v > 0.55 ? C.ultra : 0x18181c));
    this.num = [...el.querySelectorAll('.t')].find(t => t.textContent.trim() === '365');
    if (this.num) this.num.classList.remove('cnt');
    this.a = 0; this.rot = 0;
    this.Y = new THREE.Vector3(0, 1, 0); this.pos = new THREE.Vector3(); this.tan = new THREE.Vector3(); this.q = new THREE.Quaternion(); this.q2 = new THREE.Quaternion();
  }
  update(p, info, dt) {
    this.t += dt;
    const b = this.box('ring'); if (!b) return;
    const W = this.world, P = W.pointer, D = W.drag, kick = W.kick;
    const R = b.w * 0.36;
    this.a = damp(this.a, easeOut(range(p, 0.02, 0.62)), 4, dt);
    this.rot = damp(this.rot, easeInOut(range(p, 0.05, 1)) * Math.PI * 2, 3, dt);   // full turn through the chapter
    this.group.position.set(b.x, b.y + b.h * 0.02 + Math.sin(this.t * 0.7) * R * 0.03, 0);
    this.group.rotation.set(0.62 + Math.sin(this.t * 0.45) * 0.14 + P.y * 0.06 + D.y, this.rot + this.t * 0.12 + D.x, Math.sin(this.t * 0.3) * 0.06 - P.x * 0.05);
    const amp = 0.18 + kick * 0.45;
    for (let i = 0; i < 365; i++) {
      const th = Math.PI / 2 + Math.PI * 2 * i / 365;
      const e = easeOut(clamp((this.a - i / 365 * 0.82) / 0.18));
      const out = lerp(2.4, 1, e);
      // the equaliser wave travelling around the year
      const wave = Math.sin(th * 5 - this.t * 3.2) * 0.5 + Math.sin(th * 11 + this.t * 1.7) * 0.5;
      this.pos.set(Math.cos(th) * R * out, (1 - e) * R * 1.6 + wave * R * 0.035, Math.sin(th) * R * out);
      this.tan.set(-Math.sin(th), 0, Math.cos(th));
      this.q.setFromUnitVectors(this.Y, this.tan);
      this.q2.setFromAxisAngle(this.tan, wave * 0.18); this.q.premultiply(this.q2);
      const s = R / 6 * (0.4 + 1.15 * this.vals[i]) * (1 + wave * amp) * e;
      this.rec.set(i, this.pos, this.q, Math.max(s, 1e-4));
    }
    this.rec.commit();
    if (this.num) this.num.textContent = String(Math.round(365 * this.a)).padStart(3, '0');
    info.strip && info.strip(this.a);
    this.rimA.intensity = 11 + Math.sin(this.t * 3.2) * 3 + kick * 8;
  }
}
