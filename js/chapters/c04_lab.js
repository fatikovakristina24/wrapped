// 04 — the visual language is shown by the before/after card itself. No 3D here on purpose.
import { Chapter } from '../world.js';

export class Lab extends Chapter {
  update(p, info, dt) { this.t += dt; }
}
