import Lenis from 'lenis';
import { World } from './world.js';
import { Scroller } from './scroll.js';
import { loadModels, yearValues } from './lib/kit.js';
import { Hero } from './chapters/c00_hero.js';
import { Ring } from './chapters/c01_ring.js';
import { History } from './chapters/c02_history.js';
import { Data } from './chapters/c03_data.js';
import { Lab } from './chapters/c04_lab.js';
import { Story } from './chapters/c05_story.js';
import { Social } from './chapters/c06_social.js';
import { Algo } from './chapters/c07_algo.js';
import { Final } from './chapters/c08_final.js';

const body = document.body;
const sections = [...document.querySelectorAll('.ch')];
const loader = document.getElementById('loader');
const VALS = yearValues();

// ---------- data canvases (equaliser, year strip, emblem) ----------
const bulks = [...document.querySelectorAll('.bulk')].map(el => ({ el, kind: el.dataset.bulk, cv: el.querySelector('canvas') }));
function sizeCanvas(b) {
  const r = b.el.getBoundingClientRect(), d = Math.min(devicePixelRatio, 2);
  b.cv.width = Math.max(1, r.width * d); b.cv.height = Math.max(1, r.height * d); b.w = r.width; b.h = r.height; b.d = d;
}
function drawBulk(b, t, amt = 1) {
  const g = b.cv.getContext('2d'), W = b.cv.width, H = b.cv.height;
  g.clearRect(0, 0, W, H);
  if (b.kind === 'signal') {                       // hero: the year as an idle equaliser
    for (let i = 0; i < 365; i++) {
      const v = VALS[i], live = 0.72 + 0.28 * Math.sin(t * 2.4 + i * 0.35) * Math.sin(t * 0.9 + i * 0.05);
      const h = (0.1 + v * 0.9) * H * live, x = i / 365 * W;
      g.fillStyle = 'rgba(138,143,152,.55)';
      g.fillRect(x, H - h, Math.max(1, b.d), h);
    }
  } else if (b.kind === 'strip') {                 // 01: the year unrolled — month bands, bars, weekly average
    const n = Math.round(365 * amt), base = H * 0.84, md = [0, 31, 59, 90, 120, 151, 181, 212, 243, 273, 304, 334, 365];
    const months = ['ЯНВ', 'ФЕВ', 'МАР', 'АПР', 'МАЙ', 'ИЮН', 'ИЮЛ', 'АВГ', 'СЕН', 'ОКТ', 'НОЯ', 'ДЕК'];
    for (let m = 0; m < 12; m++) if (m % 2 === 0) { g.fillStyle = 'rgba(243,243,240,.035)'; g.fillRect(md[m] / 365 * W, 0, (md[m + 1] - md[m]) / 365 * W, base); }
    const bw = W / 365;
    for (let i = 0; i < n; i++) {
      const v = VALS[i], h = (0.05 + v * 0.95) * base * 0.92, x = i * bw;
      const grad = g.createLinearGradient(0, base - h, 0, base);
      if (v > 0.82) { grad.addColorStop(0, '#1F2BFF'); grad.addColorStop(1, 'rgba(31,43,255,.35)'); }
      else { grad.addColorStop(0, 'rgba(201,204,209,.75)'); grad.addColorStop(1, 'rgba(138,143,152,.15)'); }
      g.fillStyle = grad; g.fillRect(x + bw * 0.18, base - h, bw * 0.64, h);
    }
    g.strokeStyle = '#A9B2FF'; g.lineWidth = 1.6 * b.d; g.beginPath();      // weekly average
    for (let i = 0; i < n; i++) {
      let s = 0, c = 0; for (let k = Math.max(0, i - 3); k <= Math.min(364, i + 3); k++) { s += VALS[k]; c++; }
      const y = base - (0.05 + s / c * 0.95) * base * 0.92, x = (i + 0.5) * bw;
      i ? g.lineTo(x, y) : g.moveTo(x, y);
    }
    g.stroke();
    g.fillStyle = 'rgba(138,143,152,.5)'; g.fillRect(0, base, W, b.d);
    g.font = `${10 * b.d}px Unbounded`; g.fillStyle = '#8A8F98';
    for (let i = 0; i < 12; i++) { const x = md[i] / 365 * W; g.fillRect(x, base, b.d, 6 * b.d); g.fillText(months[i], x + 4 * b.d, base + 18 * b.d); }
  } else if (b.kind === 'emblem') {                // 08: the year closes, dot by dot
    const n = Math.round(365 * amt), cx = W / 2, cy = H / 2, R = Math.min(W, H) * 0.4;
    for (let d = 0; d < 365; d++) {
      const a = -Math.PI / 2 + d / 365 * Math.PI * 2, v = VALS[d], on = d < n;
      const rr = R + Math.sin(d / 365 * Math.PI * 4) * R * 0.05, s = (1.6 + v * 4) * b.d;
      g.fillStyle = !on ? 'rgba(243,243,240,.08)' : v > 0.9 ? '#1F2BFF' : 'rgba(243,243,240,.75)';
      g.beginPath(); g.arc(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr, s / 2, 0, Math.PI * 2); g.fill();
    }
    g.font = `500 ${13 * b.d}px Unbounded`; g.fillStyle = '#F3F3F0'; g.textAlign = 'center';
    g.fillText(`${String(n).padStart(3, '0')} / 365`, cx, cy + 5 * b.d);
  }
}

// ---------- counters + typewriter ----------
function runCounter(el) {
  const to = +el.dataset.to, pre = el.dataset.pre, suf = el.dataset.suf, sep = el.dataset.sep === '1', t0 = performance.now(), dur = 1400;
  const fmt = n => (sep ? n.toLocaleString('ru-RU').replace(/ /g, ' ') : String(n));
  const step = now => { const k = Math.min(1, (now - t0) / dur), e = 1 - Math.pow(1 - k, 4); el.textContent = pre + fmt(Math.round(to * e)) + suf; if (k < 1) requestAnimationFrame(step); };
  requestAnimationFrame(step);
}
function runTyper(el) {
  const full = el.dataset.full || (el.dataset.full = el.textContent); let i = 0;
  const step = () => { i += 2; el.textContent = full.slice(0, i); if (i < full.length) setTimeout(step, 14); };
  step();
}

// ---------- reveal: text, bars, cards, counters ----------
const revealers = sections.map(s => [...s.querySelectorAll('.inner .rv, .inner .shape, .inner .card')]);
let revealPos = [];                                  // per element: top / bottom relative to its untransformed column
function measureReveal() {
  revealPos = sections.map((s, i) => {
    const inner = s.querySelector('.inner'), ir = inner.getBoundingClientRect();
    return revealers[i].map(el => { const r = el.getBoundingClientRect(); return [r.top - ir.top, r.bottom - ir.top]; });
  });
}
function reveal(i, vh, base, ty) {
  const pos = revealPos[i];
  for (let j = 0; j < revealers[i].length; j++) {
    const el = revealers[i][j], r = { top: base + ty + pos[j][0], bottom: base + ty + pos[j][1] };
    const isIn = r.top < vh * 0.9 && r.bottom > -vh * 0.2;
    if (isIn && !el.classList.contains('in')) {
      el.classList.add('in');
      if (el.classList.contains('shape')) el.style.setProperty('--k', 1);
      if (el.classList.contains('cnt') && !el.dataset.done) { el.dataset.done = 1; runCounter(el); }
      if (el.classList.contains('typer') && !el.dataset.typed) { el.dataset.typed = 1; runTyper(el); }
    } else if (!isIn && r.top > vh && el.classList.contains('in')) {
      el.classList.remove('in');
      if (el.classList.contains('shape')) el.style.setProperty('--k', 0);
    }
  }
}

// ---------- static fallback (no WebGL / reduced motion) ----------
function goStatic() {
  body.classList.add('static', 'ready');
  loader.classList.add('done');
  document.querySelectorAll('.rv, .card').forEach(el => el.classList.add('in'));
  bulks.forEach(b => { sizeCanvas(b); drawBulk(b, 0, 1); });
}

// ---------- the reader's own track (kept only in this browser) + the Spotify player ----------
function setupPersonal() {
  const KEY = 'wrapped.myTrack';
  let saved = {}; try { saved = JSON.parse(localStorage.getItem(KEY) || '{}'); } catch (e) {}
  const fields = [...document.querySelectorAll('.field[data-k]')];
  fields.forEach(f => { if (saved[f.dataset.k]) f.value = saved[f.dataset.k]; });
  const btn = document.querySelector('[data-save]');
  if (btn) {
    const label = btn.textContent;
    btn.addEventListener('click', () => {
      const v = {}; fields.forEach(f => { v[f.dataset.k] = f.value.trim(); });
      try { localStorage.setItem(KEY, JSON.stringify(v)); btn.textContent = 'Сохранено — только у вас'; }
      catch (e) { btn.textContent = 'Не получилось сохранить'; }
      setTimeout(() => { btn.textContent = label; }, 2600);
    });
  }
  window.__track = { playing: false };                    // the record of chapter 03 turns only while this is true
  const host = document.querySelector('.embed-host');
  if (host) {
    window.onSpotifyIframeApiReady = api => api.createController(host, { uri: host.dataset.uri, width: '100%', height: host.parentElement.clientHeight },
      c => c.addListener('playback_update', e => { window.__track.playing = !e.data.isPaused; }));
    const s = document.createElement('script'); s.src = 'https://open.spotify.com/embed/iframe-api/v1'; s.async = true; document.head.appendChild(s);
  }
}
setupPersonal();

async function start() {
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  let world;
  try { if (reduce) throw new Error('reduced motion'); world = new World(document.getElementById('gl')); }
  catch (e) { goStatic(); return; }

  const num = loader.querySelector('.ld-num'), bar = loader.querySelector('.ld-bar i');
  let shown = 0;
  const progress = k => { const v = Math.round(k * 365); num.textContent = String(v).padStart(3, '0'); bar.style.width = `${k * 100}%`; shown = k; };
  try { await Promise.all([loadModels(progress), document.fonts.ready]); }
  catch (e) { console.error(e); goStatic(); return; }

  const C = [Hero, Ring, History, Data, Lab, Story, Social, Algo, Final].map((K, i) => new K(world, sections[i]));
  // warm-up: compile every shader and upload every texture now, so a chapter never stutters the first time it appears
  const R = world.renderer;
  for (const c of C) c.scene.traverse(o => { const ms = o.material ? [].concat(o.material) : []; for (const m of ms) for (const v of Object.values(m)) if (v && v.isTexture) R.initTexture(v); });
  try { await Promise.all(C.map(c => R.compileAsync(c.scene, c.camera))); } catch (e) { C.forEach(c => R.compile(c.scene, c.camera)); }
  window.__wrapped = { world, C };                                  // handy for debugging in the console
  const scroller = new Scroller(sections);
  const layout = () => { world.resize(); C.forEach(c => c.resize()); scroller.layout(); bulks.forEach(b => { sizeCanvas(b); b.drawn = -1; }); measureReveal();
    const em = bulks.find(b => b.kind === 'emblem'); if (em) em.rel = em.el.getBoundingClientRect().top - scroller.secs[8].inner.getBoundingClientRect().top; };
  layout();
  addEventListener('resize', layout);

  const lenis = new Lenis({ lerp: 0.085, wheelMultiplier: 0.9, smoothWheel: true });
  const hash = location.hash.match(/chapter-(\d+)/);
  if (hash) lenis.scrollTo(scroller.startOf(Math.min(8, +hash[1])), { immediate: true });
  const at = new URLSearchParams(location.search).get('at');   // review helper: ?at=3.5 = middle of chapter 03
  if (at !== null) { const i = Math.floor(+at), s = scroller.secs[Math.min(8, i)]; lenis.scrollTo(s.start + (+at - i) * (s.end - s.start + (i < 8 ? scroller.T : 0)), { immediate: true }); }

  body.classList.add('gl');
  progress(1);
  setTimeout(() => { loader.classList.add('done'); body.classList.add('ready'); }, 350);

  const hud = document.querySelector('.hud-num');
  const strip = bulks.find(b => b.kind === 'strip'), signal = bulks.find(b => b.kind === 'signal'), emblem = bulks.find(b => b.kind === 'emblem');
  let last = performance.now(), emblemAmt = 0;
  const emblemSec = scroller.secs[8];
  const drawStrip = a => { if (strip && Math.abs(a - strip.drawn) > 0.002) { strip.drawn = a; drawBulk(strip, 0, a); } };
  const loop = now => {
    const dt = Math.min(0.05, (now - last) / 1000); last = now;
    lenis.raf(now);
    world.tick(dt, lenis.velocity);
    const frame = scroller.frame(lenis.scroll);
    scroller.apply(frame);
    const layers = [];
    for (const f of frame) {
      const i = f.s.i, ch = C[i];
      reveal(i, scroller.vh, f.s.base, f.s.inner._ty || 0);
      ch.update(f.p, { travel: f.s.travel, sp: f.sp, intro: f.intro, v: lenis.velocity, strip: drawStrip }, dt);
      const top = f.role === 'b' ? 1 - f.t : 0, bottom = f.role === 'a' ? 1 - f.t : 1;
      layers.push({ chapter: ch, top, bottom });
      if (i === 0 && signal) drawBulk(signal, now / 1000);
      if (i === 8 && emblem) {
        const top = emblemSec.base + (emblemSec.inner._ty || 0) + emblem.rel, target = Math.min(1, Math.max(0, (innerHeight - top) / (innerHeight * 0.7)));
        emblemAmt += (target - emblemAmt) * Math.min(1, dt * 3);
        if (Math.round(emblemAmt * 365) !== emblem.drawn) { emblem.drawn = Math.round(emblemAmt * 365); drawBulk(emblem, 0, emblemAmt); }
      }
    }
    world.render(layers);
    const cur = frame[frame.length - 1];
    hud.textContent = String((cur.t > 0.5 || frame.length === 1 ? cur : frame[0]).s.i).padStart(2, '0');
    requestAnimationFrame(loop);
  };
  requestAnimationFrame(loop);
}
start();
