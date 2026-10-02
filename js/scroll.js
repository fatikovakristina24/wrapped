// Chapter gating: every chapter is pinned; the next one stays completely hidden
// until the current one is scrolled to 100%. Then a split-screen wipe reveals it.
const ease = t => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));

export class Scroller {
  constructor(sections) {
    this.secs = sections.map((el, i) => ({
      el, i, stage: el.querySelector('.stage'), inner: el.querySelector('.inner'),
      states: [...el.querySelectorAll('.state')],
    }));
    this.track = document.getElementById('track');
  }
  layout() {
    const vh = this.vh = innerHeight;
    this.T = vh * 0.9;                                   // length of a chapter-to-chapter wipe
    let y = 0;
    this.secs.forEach((s, i) => {
      s.innerH = s.inner.offsetHeight;
      s.travel = Math.max(0, s.innerH - vh);
      s.hs = i === 0 ? 0 : vh * 0.1;                     // a breath after the wipe
      s.statesLen = s.states.length ? s.states.length * vh * 0.95 : 0;
      s.he = vh * (i === 0 ? 0.9 : 0.45);                // hold at the end: the 3D finishes its move
      s.L = s.hs + s.travel + s.statesLen + s.he;
      s.start = y; y += s.L;
      s.end = y; y += i < this.secs.length - 1 ? this.T : 0;
      s.stage.style.zIndex = 10 + i;
    });
    this.total = y;
    this.track.style.height = `${y + vh}px`;
  }
  startOf(i) { return this.secs[i].start; }
  /** Returns the visible chapters with their progress for scroll position y. */
  frame(y) {
    const out = [];
    for (let i = 0; i < this.secs.length; i++) {
      const s = this.secs[i];
      if (y < s.end || i === this.secs.length - 1) {
        out.push(this.state(s, clamp(y - s.start, 0, s.L), 0, 'a'));
        break;
      }
      const next = this.secs[i + 1];
      if (y < s.end + this.T) {
        const t = ease(clamp((y - s.end) / this.T));
        out.push(this.state(s, s.L, t, 'a'));
        out.push(this.state(next, 0, t, 'b'));
        break;
      }
    }
    return out;
  }
  state(s, local, t, role) {
    const innerY = clamp(local - s.hs, 0, s.travel);
    const sp = s.states.length ? clamp((local - s.hs - s.travel) / (this.vh * 0.95), -1, s.states.length) : null;
    return { s, p: s.L ? local / s.L : 0, innerY, sp, intro: s.travel ? innerY / s.travel : 1, t, role };
  }
  /** Applies the DOM side of a frame: visibility, wipe clip, inner travel, states. */
  apply(list) {
    const vh = this.vh;
    const on = new Set(list.map(f => f.s));
    for (const s of this.secs) if (!on.has(s) && s.stage.classList.contains('on')) s.stage.classList.remove('on');
    for (const f of list) {
      const st = f.s.stage;
      st.classList.add('on');
      let clip = 'none', shift = 0;
      if (f.t > 0 || f.role === 'b') {
        if (f.role === 'a') { clip = `inset(0 0 ${(f.t * 100).toFixed(3)}% 0)`; shift = -f.t * vh * 0.22; }
        else { clip = `inset(${((1 - f.t) * 100).toFixed(3)}% 0 0 0)`; shift = (1 - f.t) * vh * 0.22; }
      }
      st.style.clipPath = clip;
      let introFade = 1, introShift = 0;
      if (f.sp !== null && f.sp > -1) { const k = clamp(f.sp + 0.35); introFade = 1 - k; introShift = -k * vh * 0.25; }
      f.s.inner.style.transform = `translate3d(0, ${(-f.innerY + shift + introShift).toFixed(2)}px, 0)`;
      f.s.inner.style.opacity = introFade;
      if (f.s.states.length) this.applyStates(f.s, f.sp, shift);
    }
  }
  applyStates(s, sp, shift) {
    const n = s.states.length;
    s.states.forEach((el, k) => {
      const local = sp - k;
      const visible = local > -0.0001 && (local < 1 || k === n - 1) && sp > -0.65;
      el.style.visibility = visible ? 'visible' : 'hidden';
      if (!visible) { el.classList.remove('in'); el.querySelectorAll('.rv').forEach(r => r.classList.remove('in')); return; }
      const enter = ease(clamp(local / 0.22));
      const exit = k === n - 1 ? 0 : ease(clamp((local - 0.8) / 0.2));
      el.style.clipPath = `inset(${((1 - enter) * 100).toFixed(2)}% 0 0 0)`;
      el.style.transform = `translate3d(0, ${(-exit * this.vh * 0.2 + shift).toFixed(1)}px, 0)`;
      el.style.opacity = 1 - exit;
      if (enter > 0.2) el.querySelectorAll('.rv').forEach(r => r.classList.add('in'));
    });
  }
}
