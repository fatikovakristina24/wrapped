// 00 — my interpretation of the year: one record turning slowly behind the title,
// next to a real Wrapped card. Nothing else moves, so the title and the first lines can be read.
import * as THREE from 'three';
import { Chapter } from '../world.js';
import { model, clamp, lerp, easeOutExpo } from '../lib/kit.js';

export class Hero extends Chapter {
  constructor(world, el) {
    super(world, el);
    this.pivot = new THREE.Group();
    this.disc = model('vinyl');
    this.pivot.add(this.disc);
    this.scene.add(this.pivot);
    this.t0 = performance.now(); this.spin = 0;
  }
  update(p, info, dt) {
    this.t += dt;
    const b = this.box('hero'); if (!b) return;
    const D = this.grab('hero');
    const R = Math.min(b.w * 0.36, this.viewport().w * 0.5);   // on a phone the record fits the screen width
    const intro = clamp((performance.now() - this.t0 - 250) / 2600);
    this.spin += dt * 0.12;                                    // a slow turntable, independent of scrolling
    this.disc.rotation.y = this.spin;
    this.disc.scale.setScalar(R * 2 * lerp(0.85, 1, easeOutExpo(intro)));
    this.pivot.position.set(b.x, b.y + R * 0.05, 0);
    this.pivot.rotation.set(1.05 + D.y, -0.12 + D.x, 0.42);
  }
}
