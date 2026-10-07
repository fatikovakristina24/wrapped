// 03 — my track of the year. Spotify's words, my comment, the track itself.
// One record, and it turns only while the track is actually playing in the Spotify player below.
import { Chapter } from '../world.js';
import { model, damp } from '../lib/kit.js';

export class Data extends Chapter {
  constructor(world, el) {
    super(world, el);
    this.disc = model('vinyl'); this.scene.add(this.disc);
    this.spin = 0; this.speed = 0;
  }
  update(p, info, dt) {
    this.t += dt;
    const b = this.box('track'); if (!b) return;
    const D = this.grab('track');
    const playing = !!(window.__track && window.__track.playing);
    this.speed = damp(this.speed, playing ? 1.4 : 0, 2, dt);      // eases to a stop when the music stops
    this.spin += dt * this.speed;
    this.disc.position.set(b.x, b.y, 0);
    this.disc.scale.setScalar(Math.min(b.w, b.h) * 0.92);
    this.disc.rotation.set(1.0 + D.y, this.spin + D.x, 0.3);
  }
}
