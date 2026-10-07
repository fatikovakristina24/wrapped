// 01 — the record of the year: 365 day-bars grow as you scroll, while the counter runs to 365.
// One move only: the year builds up. The record turns slowly; drag spins it, a click blows the year apart.
import { Chapter } from '../world.js';
import { yearValues, range, easeOut, damp } from '../lib/kit.js';
import { YearRecord } from '../lib/objects.js';

export class Ring extends Chapter {
  constructor(world, el) {
    super(world, el);
    this.rec = new YearRecord(yearValues()); this.rec.calm = true;
    this.scene.add(this.rec.group);
    this.num = [...el.querySelectorAll('.t')].find(t => t.textContent.trim() === '365');
    if (this.num) this.num.classList.remove('cnt');
    this.a = 0;
  }
  update(p, info, dt) {
    this.t += dt;
    const b = this.box('ring'); if (!b) return;
    const D = this.grab('ring'), T = this.t;
    const R = b.w * 0.34;
    this.a = damp(this.a, easeOut(range(p, 0.02, 0.62)), 3, dt);
    const g = this.rec.group;
    g.position.set(b.x, b.y - b.h * 0.04, 0);
    g.scale.setScalar(R);
    g.rotation.set(0.5 + D.y, -0.3 + D.x, 0);
    this.rec.update(dt, T, this.a, 0, this.burst('ring'));
    if (this.num) this.num.textContent = String(Math.round(365 * this.a)).padStart(3, '0');
    info.strip && info.strip(this.a);
  }
}
