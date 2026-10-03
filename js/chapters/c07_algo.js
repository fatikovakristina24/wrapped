// 07 — the algorithm's view: a grey cassette; its tape spills out and writhes, never settling.
// Everything here moves at half the speed of the rest of the page.
import * as THREE from 'three';
import { Chapter } from '../world.js';
import { model, find, Ribbon, rng, clamp, range, damp } from '../lib/kit.js';

export class Algo extends Chapter {
  constructor(world, el) {
    super(world, el, { cold: true, env: 0.7 });
    this.group = new THREE.Group(); this.scene.add(this.group);
    this.cas = model('cassette', { smoke: 'clay', white: 'clay', ultra: 'clay_dark', tape: 'clay_dark', chrome: 'clay_dark' });
    this.group.add(this.cas);
    this.reels = [...find(this.cas, 'cassette_reel'), ...find(this.cas, 'cassette_hub')];
    const r = rng(31), pts = [];
    for (let i = 0; i < 1000; i++) {
      const t = i / 999, a = t * Math.PI * 11, rad = 0.12 + 1.5 * t;
      pts.push(new THREE.Vector3(Math.cos(a) * rad * 1.25 + (r() - 0.5) * 0.03, -0.35 - 2.1 * t + 0.32 * Math.sin(a * 1.3), Math.sin(a * 0.7) * rad * 0.55));
    }
    this.tape = new Ribbon(pts, 0.12, Math.PI * 30, new THREE.MeshPhysicalMaterial({ color: 0x8e959a, roughness: 0.45, metalness: 0.2, side: THREE.DoubleSide }));
    this.group.add(this.tape.mesh);
    this.idx = this.tape.geo.index.count; this.f = 0;
  }
  update(p, info, dt) {
    this.t += dt;
    const b = this.box('algo'); if (!b) return;
    const W = this.world, P = W.pointer, D = this.spin('algo'), T = this.t * 0.5;     // half speed
    const u = b.w * 0.24;
    this.group.position.set(b.x - b.w * 0.08, b.y + b.h * 0.22 + Math.sin(T * 0.8) * u * 0.05, 0);
    this.group.scale.setScalar(u);
    this.group.rotation.set(0.15 + Math.sin(T * 0.5) * 0.08 + P.y * 0.05 + D.y, -0.15 + T * 0.25 + p * Math.PI + D.x, Math.sin(T * 0.4) * 0.05);
    this.cas.rotation.set(1.18 + Math.sin(T * 0.7) * 0.1, -0.1 + Math.sin(T * 0.45) * 0.3, -0.16);
    this.cas.scale.setScalar(1.25);
    this.f = damp(this.f, range(b.vis * 0.6 + p * 0.6, 0.1, 1), 2, dt);
    this.tape.geo.setDrawRange(0, Math.floor(this.idx * clamp(this.f) / 6) * 6);
    // the tangle writhes: slow noise-like waves that grow towards the loose end
    this.tape.animate((i, base, out) => {
      const k = i / 1000;
      out.set(base.x + Math.sin(i * 0.031 + T * 1.3) * 0.12 * k, base.y + Math.sin(i * 0.017 - T * 1.1) * 0.1 * k, base.z + Math.cos(i * 0.023 + T * 0.9) * 0.14 * k);
    });
    for (const r of this.reels) r.rotation.y -= dt * 0.6 * (1 - this.f);
  }
}
