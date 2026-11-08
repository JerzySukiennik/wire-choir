// Wire Choir UI variants page: one live stage rendered offscreen, blitted into four styled app mockups.
import * as THREE from 'three';
import { Stage } from './stage/stage.js';
import { parseLyrics } from './lyrics.js';
import { arrange, buildParts } from './composer.js';
import { planNotes } from './voice/planner.js';
import { PRESETS, midiToHz } from './voices.js';
import { REST_PARAMS, NPAR, VOICE, FRIC, FRICF, LIPR } from './voice/engine.js';
import { envelope } from './voice/formants.js';

const LYRICS = 'Mam w głowie drut i światło\nśpiewam, choć nie mam serca\nkażde słowo to iskra\nlecę z ust prosto do ciebie';
const heads = [
  { id: 'a', role: 'lead', ...PRESETS.tenor, shift: 0 },
  { id: 'b', role: 'harmony', harm: 'up3', ...PRESETS.alto, shift: 0 },
];
const parsed = parseLyrics(LYRICS, 'pl');
const arr = arrange({ mood: 'happy', key: 0, seed: 7 }, parsed, heads);
const parts = buildParts(arr, heads);
const LOOP = arr.duration + 1.2;
const notes = arr.notes.map((n) => ({ ...n, t0: n.b * arr.spb, t1: (n.b + n.d) * arr.spb }));
const IPA = { a: 'a', e: 'ɛ', i: 'i', o: 'ɔ', u: 'u', y: 'ɨ', 'o~': 'ɔ̃', 'e~': 'ɛ̃', I: 'ɪ', V: 'ʌ', '@': 'ə', A: 'ɑ', O: 'ɔ', U: 'ʊ', ae: 'æ', '3': 'ɝ' };
const TAU = [0.05, 0.05, 0.06, 0.018, 0.05, 0.02, 0.012, 0.03, 0.014, 0.012, 0.01, 0.02, 0.02];

class Puppet {
  constructor(segs, center) {
    this.segs = segs;
    this.end = segs.length ? segs[segs.length - 1].at + segs[segs.length - 1].len : 0;
    this.i = 0; this.cur = Float32Array.from(REST_PARAMS); this.target = REST_PARAMS;
    this.f0 = midiToHz(center); this.f0t = this.f0; this.center = center; this.level = 0; this.last = 0;
  }
  update(t, dt, onWord) {
    if (t < this.last) { this.i = 0; this.target = REST_PARAMS; }
    this.last = t;
    while (this.i < this.segs.length && this.segs[this.i].at <= t) {
      const s = this.segs[this.i++];
      this.target = s.p;
      if (s.f0 > 0) this.f0t = s.f0;
      if (s.w >= 0) onWord(s.w);
    }
    if (t > this.end + 0.1) this.target = REST_PARAMS;
    for (let k = 0; k < NPAR; k++) this.cur[k] += (this.target[k] - this.cur[k]) * (1 - Math.exp(-dt / TAU[k]));
    this.f0 += (this.f0t - this.f0) * (1 - Math.exp(-dt / 0.04));
    this.level = this.cur[VOICE] * 0.19;
    return { params: this.cur, level: this.level, f0Rel: Math.log2(this.f0 / midiToHz(this.center)) };
  }
}
const puppets = heads.map((h) => new Puppet(planNotes(parts[h.id].notes, 'pl'), (h.lo + h.hi) / 2));

const src = document.createElement('canvas');
const stage = new Stage(src, { maxPr: 1.5 });
stage.gap = 0;
stage.setSize(1280, 620);
const states = [null, null];
const panels = [
  stage.addPanel({ id: 'a', color: '#4fd2ff', wordColor: '#7dffb6', phase: 0, source: () => states[0] }),
  stage.addPanel({ id: 'b', color: '#a58bff', wordColor: '#ffc6f1', phase: 2.2, source: () => states[1] }),
];

const fmt = (s) => { const m = Math.floor(s / 60), r = s - m * 60; return String(m).padStart(2, '0') + ':' + r.toFixed(1).padStart(4, '0'); };
document.querySelectorAll('[data-dur]').forEach((e) => { e.textContent = '/ ' + fmt(arr.duration); });

function fitFrames() {
  document.querySelectorAll('.fit').forEach((f) => {
    const s = f.clientWidth / 1280;
    f.style.height = 760 * s + 'px';
    f.firstElementChild.style.transform = `scale(${s})`;
  });
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  document.querySelectorAll('canvas[data-p], #aSpec').forEach((c) => {
    const w = Math.round(c.offsetWidth * dpr), h = Math.round(c.offsetHeight * dpr);
    if (c.width !== w || c.height !== h) { c.width = w; c.height = h; }
  });
}
window.addEventListener('resize', fitFrames);

const visible = new Set();
const io = new IntersectionObserver((ents) => ents.forEach((e) => (e.isIntersecting ? visible.add(e.target.id) : visible.delete(e.target.id))), { rootMargin: '200px' });
document.querySelectorAll('.variant').forEach((v) => io.observe(v));

function blit(ctx, pi, dx, dy, dw, dh) {
  const p = panels[pi], pr = stage.pr;
  let sx = p.rect.x * pr, sy = p.rect.y * pr, sw = p.rect.w * pr, sh = p.rect.h * pr;
  const k = Math.min(dw / sw, dh / sh) * 1.12;
  const ow = sw * k, oh = sh * k;
  const ox = dx + (dw - ow) / 2, oy = dy + (dh - oh) / 2;
  ctx.save();
  ctx.beginPath(); ctx.rect(dx, dy, dw, dh); ctx.clip();
  ctx.drawImage(src, sx, sy, sw, sh, ox, oy, ow, oh);
  ctx.restore();
  return { sx, sy, k, dx: ox, dy: oy, pr };
}

function lyricsLines() {
  return parsed.lines.map((l) => ({ syls: l.syls, words: l.words }));
}

const aLyr = document.getElementById('aLyr');
aLyr.innerHTML = parsed.lines.map((l, i) => `<div data-l="${i}">${l.text}</div>`).join('');

const cLyr = document.getElementById('cLyr');
cLyr.innerHTML = notes.map((n, i) => {
  const next = notes[i + 1];
  const sep = next && next.line === n.line && next.w === n.w ? '' : ' ';
  return `<span class="s" data-n="${i}">${n.syl.text}</span>${sep}`;
}).join('');

function buildScore() {
  const W = 810, LH = 112, top = 36;
  let svg = `<svg viewBox="0 0 ${W} ${LH * arr.lines.length + 10}" xmlns="http://www.w3.org/2000/svg" font-family="Geist" >`;
  const els = [];
  arr.lines.forEach((ln, li) => {
    const y0 = top + li * LH;
    const bottom = y0 + 28;
    for (let k = 0; k < 5; k++) svg += `<line x1="0" x2="${W}" y1="${y0 + k * 7}" y2="${y0 + k * 7}" stroke="#9aa3ac" stroke-width="0.8"/>`;
    const b0 = ln.b0, beats = ln.b1 - ln.b0;
    const X = (b) => 30 + ((b - b0) / beats) * (W - 50);
    for (let b = b0; b <= ln.b1 + 0.01; b += 4) svg += `<line x1="${X(b) - 12}" x2="${X(b) - 12}" y1="${y0}" y2="${bottom}" stroke="#9aa3ac" stroke-width="0.8"/>`;
    for (const ch of arr.chords.filter((c) => c.b >= b0 && c.b < ln.b1)) svg += `<text x="${X(ch.b) - 6}" y="${y0 - 12}" font-family="Instrument Serif" font-style="italic" font-size="17" fill="#14171b">${ch.name}</text>`;
    const lineNotes = notes.map((n, i) => [n, i]).filter(([n]) => n.line === ln.i);
    lineNotes.forEach(([n, i], j) => {
      const pcs = [0, 2, 4, 5, 7, 9, 11];
      const pc = ((n.m % 12) + 12) % 12;
      let idx = pcs.indexOf(pc); if (idx < 0) idx = pcs.indexOf(pc - 1);
      const dia = (Math.floor(n.m / 12) - 1) * 7 + idx;
      const y = bottom - (dia - 30) * 3.5;
      const x = X(n.b);
      for (let d = 28; d >= dia; d -= 2) svg += `<line x1="${x - 9}" x2="${x + 9}" y1="${bottom - (d - 30) * 3.5}" y2="${bottom - (d - 30) * 3.5}" stroke="#9aa3ac" stroke-width="0.8"/>`;
      for (let d = 42; d <= dia; d += 2) svg += `<line x1="${x - 9}" x2="${x + 9}" y1="${bottom - (d - 30) * 3.5}" y2="${bottom - (d - 30) * 3.5}" stroke="#9aa3ac" stroke-width="0.8"/>`;
      const hollow = n.d >= 2;
      svg += `<ellipse data-n="${i}" cx="${x}" cy="${y}" rx="5.2" ry="3.8" transform="rotate(-20 ${x} ${y})" fill="${hollow ? 'none' : '#14171b'}" stroke="#14171b" stroke-width="${hollow ? 1.6 : 0}"/>`;
      const up = dia < 34;
      const sx = up ? x + 4.6 : x - 4.6;
      svg += `<line x1="${sx}" x2="${sx}" y1="${y}" y2="${up ? y - 25 : y + 25}" stroke="#14171b" stroke-width="1.1"/>`;
      if (n.d <= 0.5) svg += `<path d="M${sx} ${up ? y - 25 : y + 25} q 7 ${up ? 6 : -6} 6 ${up ? 15 : -15}" fill="none" stroke="#14171b" stroke-width="1.3"/>`;
      const next = lineNotes[j + 1];
      const hy = next && next[0].w === n.w;
      svg += `<text data-t="${i}" x="${x}" y="${bottom + 30}" text-anchor="middle" font-size="15" fill="#14171b">${n.syl.text.trim()}</text>`;
      if (hy) svg += `<text x="${(x + X(next[0].b)) / 2}" y="${bottom + 30}" text-anchor="middle" font-size="15" fill="#69717a">-</text>`;
    });
  });
  svg += '</svg>';
  document.getElementById('bScore').innerHTML = svg;
  notes.forEach((n, i) => { els[i] = [document.querySelector(`#bScore [data-n="${i}"]`), document.querySelector(`#bScore [data-t="${i}"]`)]; });
  return els;
}
const scoreEls = buildScore();

const dPrev = document.getElementById('dPrev'), dLine = document.getElementById('dLine'), dNext = document.getElementById('dNext');
let dLineIdx = -1;
function setKaraokeLine(li) {
  dLineIdx = li;
  const L = arr.lines;
  dPrev.textContent = li > 0 ? parsed.lines[L[li - 1].i].text : '';
  dNext.textContent = li >= 0 && li < L.length - 1 ? parsed.lines[L[li + 1].i].text : '';
  if (li < 0) { dLine.innerHTML = ''; return; }
  const ln = notes.map((n, i) => [n, i]).filter(([n]) => n.line === L[li].i);
  dLine.innerHTML = ln.map(([n, i], j) => {
    const nx = ln[j + 1];
    return `<span data-n="${i}">${n.syl.text.trim()}</span>${nx && nx[0].w !== n.w ? ' ' : ''}`;
  }).join('');
}

const specCv = document.getElementById('aSpec');
const specCtx = specCv.getContext('2d');
const FREQS = new Float32Array(96).map((_, i) => 40 + (i / 95) * 5000);
const ENV = new Float32Array(96);
const RAMP = [[12, 12, 10], [60, 34, 10], [190, 108, 18], [255, 181, 71], [255, 241, 207]];
function ramp(v) {
  v = Math.max(0, Math.min(0.999, v)) * (RAMP.length - 1);
  const i = Math.floor(v), f = v - i, a = RAMP[i], b = RAMP[i + 1];
  return [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f, a[2] + (b[2] - a[2]) * f];
}
function specColumn(st, f0) {
  const W = specCv.width, H = specCv.height;
  if (!W) return;
  const step = Math.max(2, Math.round(W / 420));
  specCtx.drawImage(specCv, step, 0, W - step, H, 0, 0, W - step, H);
  const img = specCtx.createImageData(step, H);
  const p = st.params;
  envelope(p, FREQS, ENV);
  let mx = 0;
  for (let i = 0; i < 96; i++) mx = Math.max(mx, ENV[i]);
  const voice = p[VOICE], fric = p[FRIC], ff = p[FRICF];
  for (let y = 0; y < H; y++) {
    const f = 40 + (1 - y / H) * 5000;
    const fi = Math.min(95, Math.max(0, Math.round(((f - 40) / 5000) * 95)));
    const e = Math.pow(ENV[fi] / (mx || 1), 0.5);
    const comb = Math.pow(0.5 + 0.5 * Math.cos((2 * Math.PI * f) / f0), 10);
    let v = voice * e * (0.18 + 0.82 * comb) * 1.25;
    if (fric > 0.02 && f > ff * 0.55) v += fric * 0.45 * (0.6 + Math.random() * 0.4);
    const c = ramp(v);
    for (let x = 0; x < step; x++) { const o = (y * step + x) * 4; img.data[o] = c[0]; img.data[o + 1] = c[1]; img.data[o + 2] = c[2]; img.data[o + 3] = 255; }
  }
  specCtx.putImageData(img, W - step, 0);
}

const tmpV = new THREE.Vector3(), out2 = { x: 0, y: 0 };
const PIV = new THREE.Vector3(0, -0.08, -0.12);
function callouts(ctx, map, pi, now) {
  const p = panels[pi], h = p.head;
  const st = states[pi];
  const pts = [];
  const proj = (x, y, z) => { stage.project(p, tmpV.set(x, y, z), out2); return [(out2.x * map.pr - map.sx) * map.k + map.dx, (out2.y * map.pr - map.sy) * map.k + map.dy]; };
  const jc = Math.cos(h.jaw), js = Math.sin(h.jaw);
  const cy = -1.0 - PIV.y, cz = 0.86 - PIV.z;
  const t = h.tongue[4];
  const f0 = puppets[pi].f0;
  const vowel = now ? IPA[now.syl.nu[0]] || now.syl.nu[0] : '–';
  pts.push([proj(0, -1.33 + h.larynx, 0.22), `KRTAŃ ${Math.round(f0)} Hz`, -1]);
  pts.push([proj(t[20 * 3], t[20 * 3 + 1], t[20 * 3 + 2]), `JĘZYK /${vowel}/`, -1]);
  pts.push([proj(0, cy * jc - cz * js + PIV.y, cy * js + cz * jc + PIV.z), `SZCZĘKA ${Math.round(Math.sin(h.jaw) * 117)} mm`, 1]);
  pts.push([proj(0, -0.575, 1.03), `USTA ${Math.round(st.params[LIPR] * 100)}% zaokr.`, 1]);
  ctx.font = `${Math.round(11 * (ctx.canvas.width / ctx.canvas.offsetWidth))}px "IBM Plex Mono"`;
  const s = ctx.canvas.width / ctx.canvas.offsetWidth;
  for (const [[x, y], label, side] of pts) {
    const lx = side < 0 ? 18 * s : ctx.canvas.width - 18 * s;
    const ly = y;
    ctx.strokeStyle = 'rgba(255,138,42,.85)'; ctx.fillStyle = '#ff8a2a'; ctx.lineWidth = 1 * s;
    ctx.beginPath(); ctx.arc(x, y, 3 * s, 0, Math.PI * 2); ctx.stroke();
    const tw = ctx.measureText(label).width;
    const ex = side < 0 ? lx + tw + 14 * s : lx - tw - 14 * s;
    ctx.beginPath(); ctx.moveTo(x + side * -4 * s, y); ctx.lineTo(ex, ly); ctx.stroke();
    ctx.textAlign = side < 0 ? 'left' : 'right';
    ctx.textBaseline = 'middle';
    ctx.fillText(label, lx, ly - 0.5 * s);
  }
}

let t = 0, last = performance.now(), fitted = false;
function loop() {
  requestAnimationFrame(loop);
  const now = performance.now();
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  if (!fitted) { fitFrames(); fitted = true; }
  t = (t + dt) % LOOP;
  puppets.forEach((pp, i) => { states[i] = pp.update(t, dt, (w) => stage.emitWord(panels[i], parsed.words[w] ? parsed.words[w].text : '')); });
  stage.frame(dt);
  let ni = -1;
  for (let i = 0; i < notes.length; i++) if (t >= notes[i].t0 - 0.02 && t < notes[i].t1) { ni = i; break; }
  const cur = ni >= 0 ? notes[ni] : null;
  document.querySelectorAll('[data-time]').forEach((e) => { e.textContent = fmt(Math.min(t, arr.duration)); });
  for (const c of document.querySelectorAll('canvas[data-p]')) {
    const vid = c.closest('.variant').id;
    if (!visible.has(vid) || !c.width) continue;
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, c.width, c.height);
    if (c.dataset.p === 'both') { blit(ctx, 0, 0, 0, c.width / 2, c.height); blit(ctx, 1, c.width / 2, 0, c.width / 2, c.height); continue; }
    const map = blit(ctx, +c.dataset.p, 0, 0, c.width, c.height);
    if (c.dataset.callouts !== undefined) callouts(ctx, map, +c.dataset.callouts, cur);
  }
  if (visible.has('vA')) {
    specColumn(states[0], puppets[0].f0);
    document.querySelectorAll('[data-meter]').forEach((m) => { m.style.height = Math.min(100, puppets[+m.dataset.meter].level * 520) + '%'; });
    aLyr.querySelectorAll('div').forEach((d) => d.classList.toggle('now', cur && +d.dataset.l === cur.line));
  }
  if (visible.has('vB')) scoreEls.forEach((e, i) => { const on = i === ni; if (e[0]) e[0].classList.toggle('n-hi', on); if (e[1]) e[1].classList.toggle('t-hi', on); });
  if (visible.has('vC')) cLyr.querySelectorAll('.s').forEach((s) => { const i = +s.dataset.n; s.classList.toggle('hi', i === ni); s.classList.toggle('done', ni >= 0 && i < ni && notes[i].line === notes[ni].line); });
  if (visible.has('vD')) {
    let li = -1;
    for (let k = 0; k < arr.lines.length; k++) if (t >= arr.lines[k].b0 * arr.spb - 0.6) li = k;
    if (li !== dLineIdx) setKaraokeLine(li);
    dLine.querySelectorAll('span').forEach((s) => {
      const n = notes[+s.dataset.n];
      const pr = Math.max(0, Math.min(1, (t - n.t0) / Math.max(0.08, n.t1 - n.t0)));
      s.style.backgroundImage = `linear-gradient(90deg,#8be9ff ${pr * 100}%,rgba(255,255,255,.2) ${pr * 100}%)`;
      s.style.color = 'transparent';
    });
  }
}
void lyricsLines;
loop();
