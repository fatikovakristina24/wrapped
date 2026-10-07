// 02 — the history of the format is told by type alone: 2015 → 2016 → today. No 3D here on purpose.
import { Chapter } from '../world.js';

export class History extends Chapter {
  update(p, info, dt) { this.t += dt; }
}
