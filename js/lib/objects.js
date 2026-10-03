// Procedural 3D objects built in the browser: the record of the year and the hourglass of minutes.
import * as THREE from 'three';
import { model, materials, Records, clamp, easeOut, C } from './kit.js';

/** A spinning record with the year standing on it: 365 bars (minutes per day) + a tonearm. */
export class YearRecord {
  constructor(vals) {
    this.vals = vals; this.top = vals.indexOf(Math.max(...vals));
    const M = materials();
    this.group = new THREE.Group();                 // placed / scaled by the chapter
    this.tilt = new THREE.Group(); this.group.add(this.tilt);
    this.spinner = new THREE.Group(); this.tilt.add(this.spinner);
    const disc = model('vinyl'); disc.scale.setScalar(2); this.spinner.add(disc);   // radius 1
    const geo = new THREE.BoxGeometry(1, 1, 1); geo.translate(0, 0.5, 0);
    const mat = new THREE.MeshPhysicalMaterial({ color: 0xffffff, metalness: 0.55, roughness: 0.22, clearcoat: 1, clearcoatRoughness: 0.05 });
    this.bars = new THREE.InstancedMesh(geo, mat, 365); this.bars.frustumCulled = false;
    vals.forEach((v, i) => this.bars.setColorAt(i, new THREE.Color(i === this.top ? C.white : v > 0.55 ? C.ultra : 0x9aa0a8)));
    this.spinner.add(this.bars);
    // tonearm (does not spin with the record)
    const arm = new THREE.Group(); this.tilt.add(arm);
    const base = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.13, 0.12, 48), M.chrome_brushed); base.position.set(1.22, 0.06, -0.62); arm.add(base);
    const p0 = new THREE.Vector3(1.22, 0.16, -0.62), p1 = new THREE.Vector3(0.62, 0.2, 0.35);
    const tube = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, p0.distanceTo(p1), 16), M.chrome);
    tube.position.copy(p0).add(p1).multiplyScalar(0.5); tube.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), p1.clone().sub(p0).normalize()); arm.add(tube);
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.04, 0.08), M.ultra); head.position.copy(p1).add(new THREE.Vector3(-0.02, -0.03, 0.03)); arm.add(head);
    const w = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.12, 32), M.black_gloss); w.position.set(1.32, 0.17, -0.82); w.rotation.x = 1.2; arm.add(w);
    this.arm = arm;
    this.m = new THREE.Matrix4(); this.q = new THREE.Quaternion(); this.p = new THREE.Vector3(); this.s = new THREE.Vector3(); this.Y = new THREE.Vector3(0, 1, 0);
    this.ang = 0;
  }
  /** a: 0..1 how much of the year is built, kick: scroll energy, burst: click explosion */
  update(dt, t, a, kick = 0, burst = 0) {
    this.ang -= dt * (0.55 + kick * 3);
    this.spinner.rotation.y = this.ang;
    this.arm.rotation.y = -0.06 * Math.sin(t * 0.7) - a * 0.05;
    for (let i = 0; i < 365; i++) {
      const th = Math.PI / 2 - 2 * Math.PI * i / 365;
      const on = easeOut(clamp((a - i / 365 * 0.85) / 0.15));
      const v = this.vals[i];
      const live = 0.82 + 0.18 * Math.sin(t * 4 - i * 0.21) * Math.sin(t * 1.3 + i * 0.05) + kick * 0.25;   // it plays
      const h = (0.05 + v * 0.42) * live * on;
      const r = 0.83 + burst * (0.6 + v * 0.8);
      this.p.set(Math.cos(th) * r, burst * v * 0.9 * Math.sin(i * 7.1) ** 2, Math.sin(th) * r);
      this.q.setFromAxisAngle(this.Y, -th + burst * i * 0.3);
      this.s.set(0.012 + burst * 0.01, Math.max(h, 1e-4), 0.034);
      this.m.compose(this.p, this.q, this.s); this.bars.setMatrixAt(i, this.m);
    }
    this.bars.instanceMatrix.needsUpdate = true;
  }
}

/** An hourglass where tiny records fall instead of sand — minutes running. */
export class Hourglass {
  constructor() {
    const M = materials();
    this.group = new THREE.Group();
    const prof = [[0.13, 0], [0.35, 0.25], [0.8, 0.75], [1.05, 1.35], [1.0, 1.9], [0.7, 2.25], [0.05, 2.32]];
    const pts = [...prof.slice().reverse().map(([r, y]) => new THREE.Vector2(r, -y)), ...prof.map(([r, y]) => new THREE.Vector2(r, y))];
    const glass = new THREE.Mesh(new THREE.LatheGeometry(pts, 96), M.glass); this.group.add(glass);
    for (const y of [2.42, -2.42]) { const c = new THREE.Mesh(new THREE.CylinderGeometry(1.22, 1.22, 0.16, 96), M.chrome); c.position.y = y; this.group.add(c); }
    for (let k = 0; k < 3; k++) { const a = k * 2 * Math.PI / 3 + 0.4, p = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 4.7, 24), M.chrome); p.position.set(1.17 * Math.cos(a), 0, 1.17 * Math.sin(a)); this.group.add(p); }
    const N = 190; this.N = N;
    this.rec = new Records(N); this.group.add(this.rec.group);
    const rnd = (() => { let s = 9; return () => (s = (s * 16807) % 2147483647) / 2147483647; })();
    this.parts = Array.from({ length: N }, (_, i) => {
      const yT = 0.35 + rnd() * 1.15, rT = (yT - 0.2) * 0.6 * Math.sqrt(rnd()), aT = rnd() * 6.283;
      const yB = -2.2 + Math.pow(rnd(), 1.6) * 1.0, rB = (1 - (yB + 2.2) / 1.1) * 0.9 * Math.sqrt(rnd()), aB = rnd() * 6.283;
      this.rec.color(i, rnd() < 0.58 ? C.ultra : rnd() < 0.5 ? C.white : 0x18181c);
      return { top: new THREE.Vector3(rT * Math.cos(aT), yT, rT * Math.sin(aT)), bot: new THREE.Vector3(rB * Math.cos(aB), yB, rB * Math.sin(aB)), ph: i / N, e: new THREE.Euler(rnd() * 6, rnd() * 6, rnd() * 6), w: 0.5 + rnd() * 2 };
    });
    this.q = new THREE.Quaternion(); this.p = new THREE.Vector3(); this.e = new THREE.Euler();
  }
  /** fill: 0..1 how much is visible, speed: flow multiplier */
  update(t, fill = 1, speed = 1) {
    const P = 10 / speed;
    this.parts.forEach((it, i) => {
      const u = (it.ph + t / P) % 1;
      let pos, s = 0.12;
      if (u < 0.62) pos = it.top;                                       // waiting up top
      else if (u < 0.7) {                                                // falling through the neck
        const k = (u - 0.62) / 0.08;
        this.p.set(Math.sin(i) * 0.03, 0.3 - k * k * (0.3 - it.bot.y), Math.cos(i) * 0.03); pos = this.p; s = 0.09;
      } else pos = it.bot;                                               // already listened
      this.e.set(it.e.x + t * it.w * (u > 0.62 && u < 0.7 ? 3 : 0.1), it.e.y, it.e.z); this.q.setFromEuler(this.e);
      this.rec.set(i, pos, this.q, s * clamp(fill * 2 - i / this.N));
    });
    this.rec.commit();
  }
}
