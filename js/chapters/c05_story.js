// 05 — tape unspools out of a cassette and runs through five beats of the story.
// The tape is alive: waves run along it, it flutters with scroll speed; the cassette turns with each beat.
import * as THREE from 'three';
import { Chapter } from '../world.js';
import { model, find, Records, Ribbon, clamp, range, easeOut, easeInOut, lerp, damp, C } from '../lib/kit.js';

export class Story extends Chapter {
  constructor(world, el) {
    super(world, el);
    this.group = new THREE.Group(); this.scene.add(this.group);
    this.cas = model('cassette'); this.group.add(this.cas);
    this.reels = [...find(this.cas, 'cassette_reel'), ...find(this.cas, 'cassette_hub'), ...find(this.cas, 'cassette_pack')];
    const pts = [], N = 700;
    for (let i = 0; i < N; i++) {
      const t = i / (N - 1);
      pts.push(new THREE.Vector3(0.1 + t * 13.5, -0.35 + Math.sin(t * Math.PI * 2.6) * 0.55, Math.sin(t * Math.PI * 3.2 + 0.5) * 0.45 - 0.2));
    }
    this.tapeMat = new THREE.MeshPhysicalMaterial({ color: C.ultra, metalness: 0, roughness: 0.42, sheen: 0.8, sheenColor: new THREE.Color(0xa9b2ff), side: THREE.DoubleSide, emissive: C.ultra, emissiveIntensity: 0.55 });
    this.tape = new Ribbon(pts, 0.62, Math.PI * 7, this.tapeMat); this.group.add(this.tape.mesh);
    this.idx = this.tape.geo.index.count; this.N = N;
    this.ring = new Records(120); this.scene.add(this.ring.group);
    for (let i = 0; i < 120; i++) this.ring.color(i, i % 9 === 0 ? C.white : C.ultra);
    this.f = 0; this.x = 0; this.Y = new THREE.Vector3(0, 1, 0);
  }
  update(p, info, dt) {
    this.t += dt;
    const W = this.world, P = W.pointer, D = this.spin('story'), kick = W.kick, T = this.t;
    const sp = info.sp ?? 0;
    const vp = this.viewport();
    const u = Math.max(vp.w, vp.h * 1.6) / 13;
    const target = lerp(0.06, 0.3, clamp(info.intro ?? 0)) + 0.7 * clamp(sp / 4.2);
    this.f = damp(this.f, target, 3, dt);
    const shown = Math.floor(this.N * this.f);
    this.tape.geo.setDrawRange(0, Math.floor(this.idx * this.f / 6) * 6);
    // waves run down the tape; the free end flutters, faster when scrolling
    const flutter = 0.08 + kick * 0.35;
    this.tape.animate((i, base, out) => {
      const tail = clamp(1 - (shown - i) / 120);
      const w = Math.sin(i * 0.045 - T * 3.0) * flutter + Math.sin(i * 0.11 + T * 1.7) * 0.05;
      out.set(base.x, base.y + w + tail * Math.sin(T * 5 + i * 0.3) * 0.25, base.z + Math.cos(i * 0.035 - T * 2.2) * flutter * 0.8 + tail * Math.cos(T * 4 + i * 0.2) * 0.2);
    });
    this.x = damp(this.x, -clamp(sp / 4.5) * 7.2 * u, 3, dt);
    this.group.position.set(-Math.max(vp.w, vp.h * 1.2) * 0.42 + this.x, -vp.h * 0.34 + Math.sin(T * 0.8) * u * 0.08, 0);
    this.group.scale.setScalar(u);
    this.group.rotation.set(0.18 + Math.sin(T * 0.5) * 0.08 + P.y * 0.06, P.x * 0.1, Math.sin(T * 0.4) * 0.03);
    // the cassette turns with every beat — more than a full circle through the five states
    this.cas.position.set(-0.2, -0.05 + Math.sin(T * 1.3) * 0.08, 0);
    this.cas.scale.setScalar(1.6);
    this.cas.rotation.set(1.2 + Math.sin(T * 0.9) * 0.1 + D.y, easeInOut(clamp(sp / 5)) * Math.PI * 2.5 + D.x, -0.35 + Math.sin(T * 0.7) * 0.08);
    for (const r of this.reels) r.rotation.y -= dt * (2 + kick * 16);
    const flash = Math.max(0, 1 - Math.abs(sp - 3.5) * 2);
    this.tapeMat.emissiveIntensity = 0.55 + flash * (1.8 + Math.sin(T * 12) * 0.6);
    const res = easeOut(range(sp, 4.05, 4.9));
    this.tapeMat.opacity = 1 - res * 0.85; this.tapeMat.transparent = res > 0;
    const b = this.box('result');
    if (b) {
      const R = Math.min(b.w, b.h) * 0.4, q = new THREE.Quaternion(), pos = new THREE.Vector3(), tan = new THREE.Vector3();
      this.ring.group.position.set(b.x, b.y + Math.sin(T) * R * 0.04, 0);
      const DR = this.spin('result');
      this.ring.group.rotation.set(0.6 + Math.sin(T * 0.6) * 0.15 + DR.y, T * 0.6 + DR.x, 0);
      for (let i = 0; i < 120; i++) {
        const th = Math.PI * 2 * i / 120, k = easeOut(clamp((res * 1.2 - i / 120) / 0.2));
        const wave = Math.sin(th * 4 - T * 3);
        pos.set(Math.cos(th) * R, (1 - k) * R + wave * R * 0.04, Math.sin(th) * R);
        tan.set(-Math.sin(th), 0, Math.cos(th)); q.setFromUnitVectors(this.Y, tan);
        this.ring.set(i, pos, q, Math.max(R * 0.16 * (0.6 + 0.4 * Math.sin(i * 1.7) ** 2) * (1 + wave * 0.2) * k, 1e-4));
      }
      this.ring.commit();
    }
  }
}
