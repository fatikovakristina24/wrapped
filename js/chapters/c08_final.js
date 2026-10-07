// 08 — the year closes as a circle of 365 days (a canvas, drawn in main.js), then the reader's own turn.
// No 3D here on purpose: this is where the reader writes, not watches.
import { Chapter } from '../world.js';

export class Final extends Chapter {
  constructor(world, el) {
    super(world, el);
    this.last = [...el.querySelectorAll('.t')].find(t => t.textContent === 'ПАМЯТЬ');
  }
  update(p, info, dt) {
    this.t += dt;
    if (this.last) this.last.style.transform = `translate3d(0, ${(1 - p) * 40}px, 0)`;
  }
}
