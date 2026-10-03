// 01 — the record of the year: 365 day-bars grow on a spinning record while the counter runs to 365.
// Scroll turns it a full 360°, the bars play like an equaliser, drag spins it, click blows the year apart.
import * as THREE from 'three';
import { Chapter } from '../world.js';
import { yearValues, range, easeOut, easeInOut, damp } from '../lib/kit.js';
import { YearRecord } from '../lib/objects.js';

export class Ring extends Chapter {
  constructor(world, el) {
    super(world, el);
    this.rec = new YearRecord(yearValues());
    this.scene.add(this.rec.group);
    this.num = [...el.querySelectorAll('.t')].find(t => t.textContent.trim() === '365');
    if (this.num) this.num.classList.remove('cnt');
    this.a = 0; this.rot = 0;
  }
  update(p, info, dt) {
    this.t += dt;
    const b = this.box('ring'); if (!b) return;
    const W = this.world, P = W.pointer, D = this.grab('ring'), kick = W.kick, T = this.t;
    const R = b.w * 0.34;
    this.a = damp(this.a, easeOut(range(p, 0.02, 0.62)), 4, dt);
    this.rot = damp(this.rot, easeInOut(range(p, 0.05, 1)) * Math.PI * 2, 3, dt);
    const g = this.rec.group;
    g.position.set(b.x, b.y - b.h * 0.04 + Math.sin(T * 0.7) * R * 0.03, 0);
    g.scale.setScalar(R);
    g.rotation.set(0.5 + Math.sin(T * 0.45) * 0.08 + P.y * 0.06 + D.y, this.rot - 0.3 + D.x, Math.sin(T * 0.3) * 0.05 - P.x * 0.04);
    this.rec.update(dt, T, this.a, kick, this.burst('ring'));
    if (this.num) this.num.textContent = String(Math.round(365 * this.a)).padStart(3, '0');
    info.strip && info.strip(this.a);
    this.rimA.intensity = 11 + Math.sin(T * 3.2) * 3 + kick * 8;
  }
}
