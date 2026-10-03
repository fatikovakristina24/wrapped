// 03 — maximal structure, constantly alive: an hourglass of falling records (minutes), cassettes (tracks)
// and records (artists) drifting behind the text — click one and it flies somewhere else — and a pulsing ring of stacks (genres).
import * as THREE from 'three';
import { Chapter } from '../world.js';
import { model, Records, rng, clamp, range, easeOut, easeOutBack, easeInOut, C } from '../lib/kit.js';
import { Hourglass } from '../lib/objects.js';

export class Data extends Chapter {
  constructor(world, el) {
    super(world, el);
    const r = rng(8);
    this.hg = new Hourglass(); this.scene.add(this.hg.group);
    // background floaters: each one drifts on its own; a click sends it flying to a new spot
    const spot = () => new THREE.Vector2((r() - 0.5) * 0.96, (r() - 0.5) * 0.9);
    const ext = {};                                          // half extents of each model, at scale 1, in its face-on view
    const floater = (m, key, size) => { const h = spot(), f = { m, key, size, at: h.clone(), from: h.clone(), to: h.clone(), t0: -9, z: -1 - r() * 2.5, ph: r() * 6.283, sp: 0.15 + r() * 0.25, e: new THREE.Euler(1.35 + (r() - 0.5) * 0.9, (r() - 0.5) * 1.0, (r() - 0.5) * 1.3, 'XZY'), w: 0.3 + r() * 0.5, flip: new THREE.Vector3(r() - 0.5, r() - 0.5, r() - 0.5).normalize(), spot };
      if (!ext[key]) { const d = new THREE.Box3().setFromObject(m).getSize(new THREE.Vector3()).toArray().sort((a, b) => b - a); ext[key] = [d[0] / 2, d[1] / 2]; }
      f.ext = ext[key]; m.traverse(o => { o.userData.fl = f; }); this.scene.add(m); return f; };
    this.floaters = [
      ...Array.from({ length: 16 }, () => floater(model('cassette'), 'tracks', 0.7 + r() * 0.5)),
      ...Array.from({ length: 22 }, (_, i) => floater(model('vinyl', i % 4 === 0 ? { ultra_matte: 'white' } : i % 3 === 0 ? { ultra_matte: 'black_matte' } : {}), 'artists', 0.55 + r() * 0.6)),
    ];
    this.ray = new THREE.Raycaster(); this.ndc = new THREE.Vector2(); this.qf = new THREE.Quaternion();
    let down = null;
    addEventListener('pointerdown', ev => { down = [ev.clientX, ev.clientY]; });
    addEventListener('pointerup', ev => {
      if (!down || Math.abs(ev.clientX - down[0]) + Math.abs(ev.clientY - down[1]) > 6) return;
      if (!(this.world.layers || []).some(l => l.chapter === this)) return;
      this.ndc.set(ev.clientX / innerWidth * 2 - 1, -(ev.clientY / innerHeight) * 2 + 1);
      this.ray.setFromCamera(this.ndc, this.camera);
      const hit = this.ray.intersectObjects(this.floaters.map(f => f.m), true)[0];
      const f = hit && hit.object.userData.fl; if (!f) return;
      f.from.copy(f.at); f.to.copy(this.freeSpot(f, f.at)); f.t0 = this.t;
    });
    const shares = Array.from({ length: 18 }, () => Math.pow(r(), 2.2)).sort((a, b) => b - a);
    this.gen = []; let total = 0;
    shares.forEach((s, i) => { const h = Math.max(1, Math.round(14 * Math.pow(s / shares[0], 0.7))); this.gen.push({ i, h, start: total }); total += h; });
    this.genre = new Records(total); this.scene.add(this.genre.group);
    this.gen.forEach(g => { for (let k = 0; k < g.h; k++) this.genre.color(g.start + k, g.i < 3 ? C.ultra : g.i < 5 ? C.white : 0x18181c); });
    this.tmp = new THREE.Vector3(); this.Y = new THREE.Vector3(0, 1, 0); this.q = new THREE.Quaternion(); this.q2 = new THREE.Quaternion(); this.e = new THREE.Euler(); this.pos = new THREE.Vector3();
  }
  /** Screen boxes of all text / bars near each floater area, stored relative to the area's anchor top. */
  keepOut() {
    const items = [...this.el.querySelectorAll('.it.t, .it.shape')].map(e => e.getBoundingClientRect()).filter(r => r.width > 0);
    this.kept = Object.assign(this.kept || {}, { w: this.world.w });
    for (const key of ['tracks', 'artists']) {
      const a = this.anchors[key]; if (!a) { this.kept[key] = []; continue; }
      const ar = a.getBoundingClientRect(), cy = (ar.top + ar.bottom) / 2, half = ar.height * 1.15 / 2 + 200;
      this.kept[key] = items.filter(r => r.bottom > cy - half && r.top < cy + half).map(r => [r.left - 6, r.top - 6 - ar.top, r.right + 6, r.bottom + 6 - ar.top]);
    }
  }
  /** A random spot (normalised area coords) where the floater, with its drift, stays clear of the text. */
  freeSpot(f, away) {
    const a = this.anchors[f.key], ar = a.getBoundingClientRect(), Wp = this.world.w, Hp = ar.height * 1.15, rects = (this.kept && this.kept[f.key]) || [];
    const vp = this.viewport(), k = vp.h / this.world.h, S = f.size * (vp.w / 1440) * (f.key === 'tracks' ? 120 : 110);
    const rx = f.ext[0] * S / k + 0.09 * Wp, ry = f.ext[1] * S / k + 0.09 * Hp;
    for (let n = 0; n < 200; n++) {
      const u = (Math.random() - 0.5) * 0.96, v = (Math.random() - 0.5) * 0.9;
      if (away && Math.hypot(u - away.x, v - away.y) < 0.3 && n < 150) continue;
      const X = u * Wp + Wp / 2, Y = ar.height / 2 - v * Hp, g = n < 120 ? 1 : 0.4;
      if (!rects.some(q => X > q[0] - rx * g && X < q[2] + rx * g && Y > q[1] - ry * g && Y < q[3] + ry * g)) return new THREE.Vector2(u, v);
    }
    return new THREE.Vector2((Math.random() > 0.5 ? 0.42 : -0.42), (Math.random() - 0.5) * 0.8);
  }
  update(p, info, dt) {
    this.t += dt;
    const W = this.world, P = W.pointer, kick = W.kick, T = this.t;
    let D;
    const q = this.q, pos = this.pos, e = this.e;
    // hourglass — tiny records fall like sand; it turns a full circle as it scrolls in
    // parts of this tall chapter that are off screen are not drawn at all (the glass cassettes force a second scene pass)
    const Hs = this.world.h, near = (top, bottom, m = 150) => bottom > -m && top < Hs + m;
    const a = this.box('minutes');
    this.hg.group.visible = !!a && near(a.top, a.bottom);
    if (a && this.hg.group.visible) {
      D = this.grab('minutes');
      const v = range(a.vis, 0.05, 1);
      this.hg.group.position.set(a.x, a.y + Math.sin(T * 0.8) * a.h * 0.015, 0);
      this.hg.group.scale.setScalar(Math.min(a.h / 5.1, a.w / 2.6));
      this.hg.group.rotation.set(0.12 + P.y * 0.05 + D.y, T * 0.25 + D.x, easeInOut(range(a.vis, 0.1, 0.9)) * Math.PI * 2);
      this.hg.update(T, v, 1 + kick * 3);
    }
    // cassettes and records drifting behind the text; a clicked one arcs over to its new spot, flipping once
    const vp = this.viewport(), U = vp.w / 1440, Wp = this.world.w, cz = this.camera.position.z;
    if (!this.kept || this.kept.w !== Wp || (this.frame = (this.frame || 0) + 1) % 180 === 0) this.keepOut();
    for (const key of ['tracks', 'artists']) {
      const c = this.box(key), mid = c && (c.top + c.bottom) / 2, half = c && (c.bottom - c.top) * 0.6 + 120;
      const show = !!c && near(mid - half, mid + half);
      for (const f of this.floaters) if (f.key === key) f.m.visible = show;
      if (!show) continue;
      const v = easeOut(range(c.vis, 0.05, 0.9)), H = c.h * 1.15, rects = this.kept[key].map(q => [q[0], q[1] + c.top, q[2], q[3] + c.top]);
      if (!this.kept[key + 'Placed']) { this.kept[key + 'Placed'] = 1; for (const f of this.floaters) if (f.key === key) { const s0 = this.freeSpot(f); f.at.copy(s0); f.from.copy(s0); f.to.copy(s0); } }
      for (const f of this.floaters) {
        if (f.key !== key) continue;
        const k = clamp((T - f.t0) / 1.2), e2 = easeInOut(k), arc = Math.sin(k * Math.PI);
        f.at.lerpVectors(f.from, f.to, e2);
        const dx = Math.sin(T * f.sp * 1.6 + f.ph) * 0.06 + Math.sin(T * 0.23 + f.ph * 2) * 0.03, dy = Math.cos(T * f.sp * 1.3 + f.ph * 1.3) * 0.09;
        const S = f.size * U * (key === 'tracks' ? 120 : 110);
        // keep clear of every line of text: work in screen pixels, push the object out of any text box it touches
        const z = f.z * S + arc * S * 2.5, persp = cz / (cz - z), rx = f.ext[0] * S / c.k * persp + 8, ry = f.ext[1] * S / c.k * persp + 8;
        let X = (f.at.x + dx) * Wp + Wp / 2, Y = (c.top + c.bottom) / 2 - (f.at.y + dy) * H / c.k;
        for (let it = 0; it < 3; it++) for (const q of rects) {
          if (X > q[0] - rx && X < q[2] + rx && Y > q[1] - ry && Y < q[3] + ry) {
            const m = [X - (q[0] - rx), (q[2] + rx) - X, Y - (q[1] - ry), (q[3] + ry) - Y], i = m.indexOf(Math.min(...m));
            if (i === 0) X = q[0] - rx; else if (i === 1) X = q[2] + rx; else if (i === 2) Y = q[1] - ry; else Y = q[3] + ry;
          }
        }
        f.m.position.set((X - Wp / 2) * c.k / persp, -(Y - this.world.h / 2) * c.k / persp, z);
        this.e.set(f.e.x + Math.sin(T * f.w * 1.4 + f.ph) * 0.45, key === 'artists' ? f.e.y + T * f.w * 2.2 : f.e.y + Math.sin(T * f.w) * 0.5, f.e.z + Math.sin(T * f.w * 0.8 + f.ph) * 0.4, 'XZY'); f.m.quaternion.setFromEuler(this.e);
        if (k > 0 && k < 1) { this.qf.setFromAxisAngle(f.flip, e2 * Math.PI * 2); f.m.quaternion.premultiply(this.qf); }
        f.m.scale.setScalar(Math.max(S * v, 1e-4));
      }
    }
    // genre ring — stacks rise, then pulse like an equaliser while the ring turns
    const d = this.box('genres');
    this.genre.group.visible = !!d && near(d.top, d.bottom);
    if (d && this.genre.group.visible) {
      D = this.grab('genres');
      const R = d.w * 0.33, v = easeOut(range(d.vis, 0.05, 0.9));
      this.genre.group.position.set(d.x, d.y - d.h * 0.06, 0);
      this.genre.group.rotation.set(0.62 + Math.sin(T * 0.5) * 0.1 + D.y, T * 0.35 + D.x, 0);
      this.gen.forEach(g => {
        const th = 2 * Math.PI * g.i / 18, eq = 0.75 + 0.25 * Math.sin(T * 3 + g.i * 0.9) + kick * 0.3;
        for (let k = 0; k < g.h; k++) {
          const on = clamp((v * g.h * eq - k) * 1.5);
          pos.set(Math.cos(th) * R, k * R * 0.045, Math.sin(th) * R);
          q.setFromAxisAngle(this.Y, k * 0.7 + g.i + T * 1.5);
          this.genre.set(g.start + k, pos, q, Math.max(R * 0.19 * on, 1e-4));
        }
      });
      this.genre.commit();
    }
  }
}
