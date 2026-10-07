// 05 — five screens in Spotify's own voice, one after another (the screens are the move).
// The only 3D is the gift on the last screen: the year, wrapped.
import { Chapter } from '../world.js';
import { clamp, range, easeOut } from '../lib/kit.js';
import { GiftBox } from '../lib/objects.js';

export class Story extends Chapter {
  constructor(world, el) {
    super(world, el);
    this.gift = new GiftBox(); this.scene.add(this.gift.group);
  }
  update(p, info, dt) {
    this.t += dt;
    const sp = info.sp ?? 0, T = this.t;
    const res = easeOut(range(sp, 4.05, 4.9));
    const b = this.box('result'); if (!b) return;
    const DR = this.grab('result'), S = Math.min(b.w, b.h) * 0.62, g = this.gift.group;
    g.position.set(b.x, b.y - b.h * 0.12, 0);
    g.scale.setScalar(Math.max(S * easeOut(clamp(res * 3)), 1e-4));
    g.rotation.set(0.32 + DR.y, -0.55 + T * 0.12 + DR.x, 0);
    this.gift.update(T * 0.4, res, 0, this.burst('result', 0.4, 0.9, 1.2));
  }
}
