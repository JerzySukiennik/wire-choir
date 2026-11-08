// Wire Choir voice lab: presets, sliders, test phrases, live vowel pad and tract view.
import { AudioSystem } from './audio.js';
import { tractShape, TX, TD, OPEN, LIPD, LIPR, VEL, VOICE } from './voice/engine.js';
import { vowelParams, VOWELS } from './voice/phonemes.js';
import { planNotes, planDrums, planLiveOn } from './voice/planner.js';
import { PRESETS, midiToHz, noteName, engineCfg } from './voices.js';
import { Stage } from './stage/stage.js';
import { REST_PARAMS } from './voice/engine.js';

const $ = (id) => document.getElementById(id);
const sys = new AudioSystem();
let voice = null;
const extra = [];

const STEPS = [
  ['Silnik głosu: fizyczny model gardła', 1], ['Głoski PL/EN', 1], ['Laboratorium', 1],
  ['Tekst → sylaby', 1], ['Kompozytor melodii', 1], ['Głowy 3D', 1], ['Tryby Auto / Nuty / Graj', 0], ['Edytor głów', 0], ['Eksport: link, WAV, wideo', 0],
];
$('progress').innerHTML = STEPS.map(([t, ok]) => `<span class="${ok ? 'ok' : ''}">${ok ? '✓' : '○'} ${t}</span>`).join('');

const state = Object.assign({ preset: 'baritone', pitch: 57 }, PRESETS.baritone);
const SL = [
  ['pitch', 'Wysokość', 36, 84, 1, (v) => noteName(v)],
  ['tract', 'Gardło (cm)', 11, 20, 0.1, (v) => v.toFixed(1)],
  ['breath', 'Oddech', 0, 1, 0.01, (v) => Math.round(v * 100) + '%'],
  ['rd', 'Miękkość głosu', 0.4, 2.4, 0.01, (v) => v.toFixed(2)],
  ['vib', 'Wibrato (centy)', 0, 90, 1, (v) => v],
  ['rough', 'Chrypka', 0, 1, 0.01, (v) => Math.round(v * 100) + '%'],
];

function renderPresets() {
  $('presets').innerHTML = Object.entries(PRESETS).map(([k, p]) => `<button data-p="${k}" class="${state.preset === k ? 'on' : ''}">${p.pl}</button>`).join('');
}
function renderSliders() {
  $('sliders').innerHTML = SL.map(([k, name, lo, hi, st, fmt]) =>
    `<div class="row"><label>${name}<b id="v-${k}">${fmt(state[k])}</b></label><input type="range" id="s-${k}" min="${lo}" max="${hi}" step="${st}" value="${state[k]}"></div>`).join('');
  for (const [k, , , , , fmt] of SL) {
    $('s-' + k).addEventListener('input', (e) => {
      state[k] = +e.target.value;
      $('v-' + k).textContent = fmt(state[k]);
      applyCfg();
      if (k === 'pitch' && padDown) liveVowel();
    });
  }
}
$('presets').addEventListener('click', (e) => {
  const k = e.target.dataset.p;
  if (!k) return;
  const p = PRESETS[k];
  Object.assign(state, p, { preset: k, pitch: Math.round((p.lo + p.hi) / 2) });
  renderPresets(); renderSliders(); applyCfg();
});
renderPresets(); renderSliders();

function applyCfg() { if (voice) voice.configure(engineCfg(state)); }

const syl = (on, nu, co) => ({ on, nu, co });
function notesFrom(list, bpm, transpose, lang) {
  const beat = 60 / bpm;
  let t = 0.15, w = 0;
  return list.map(([s, m, b, word]) => {
    const n = { t, d: b * beat, f0: midiToHz(m + transpose), amp: 0.8, syl: s, w: word ? w++ : -1 };
    t += b * beat;
    return n;
  });
}
const PL_PHRASE = [
  [syl(["s'", 'p', 'j'], ['e'], []), 0, 0.5, 1], [syl(['v'], ['a'], ['m']), 2, 1],
  [syl(['z', 'd', 'r'], ['u'], []), 4, 0.5, 1], [syl(['t'], ['u'], []), 2, 1],
  [syl([], ['i'], []), 0, 0.5, 1], [syl(["s'", 'f', 'j'], ['a'], []), 4, 1, 1], [syl(['t', 'w'], ['a'], []), 2, 2],
  [syl(['k'], ['a'], ['Z']), 4, 0.5, 1], [syl(['d'], ['e'], []), 5, 0.5],
  [syl(['s', 'w'], ['o'], []), 4, 0.5, 1], [syl(['v'], ['o'], []), 2, 1],
  [syl(['t'], ['o'], []), 0, 0.5, 1], [syl([], ['i'], ['s']), 2, 0.5, 1], [syl(['k', 'r'], ['a'], []), 0, 2],
];
const EN = [
  [syl([], ['a', 'I'], []), 0, 1, 1], [syl(['l'], ['V'], ['v']), 2, 1, 1], [syl(['D'], ['@'], []), 4, 0.5, 1], [syl(['n'], ['a', 'I'], ['t']), 5, 1.5],
  [syl(['h'], ['A'], ['R', 't']), 4, 1, 1], [syl(['t'], ['u'], []), 2, 1, 1], [syl(['S'], ['I'], ['p']), 0, 2],
];
const VOW = ['a', 'e', 'i', 'o', 'u', 'y'].map((v, i) => [syl([], [v], []), [0, 2, 4, 5, 4, 2][i], 1, 1]);

const TESTS = [
  ['Samogłoski', 'a e i o u y', () => sing(notesFrom(VOW, 84, state.pitch - 2, 'pl'), 'pl', ['a', 'e', 'i', 'o', 'u', 'y'])],
  ['Fraza PL', 'śpiewam z drutu i światła, każde słowo to iskra', () => sing(notesFrom(PL_PHRASE, 100, state.pitch - 2, 'pl'), 'pl', ['śpiewam', 'z drutu', 'i', 'światła', 'każde', 'słowo', 'to', 'iskra'])],
  ['Fraza EN', 'I love the night, heart to ship', () => sing(notesFrom(EN, 96, state.pitch - 2, 'en'), 'en', ['I', 'love', 'the', 'night', 'heart', 'to', 'ship'])],
  ['Beatbox', '2 takty', () => beat()],
  ['Akord', '4 głosy na „a”', () => chord()],
  ['Stop', 'cisza', () => stopAll()],
];
$('tests').innerHTML = TESTS.map(([t, s], i) => `<button data-t="${i}">${t}<small>${s}</small></button>`).join('');
$('tests').addEventListener('click', async (e) => {
  const b = e.target.closest('button');
  if (!b) return;
  await ensure();
  TESTS[+b.dataset.t][2]();
});

async function ensure() {
  await sys.start();
  await sys.resume();
  if (!voice) {
    voice = sys.voice({ cfg: engineCfg(state) });
    voice.configure({ volume: 1, pan: 0 });
    voice.onWord = (id) => stage.emitWord(panel, wordList[id]);
  }
}
$('go').addEventListener('click', async () => { await ensure(); $('start').remove(); });

let wordList = [];
function sing(notes, lang, words) {
  stopAll();
  wordList = words || [];
  const segs = planNotes(notes, lang);
  voice.scheduleAt(segs, sys.now() + 0.08, true);
}
function beat() {
  stopAll();
  const hits = [];
  const bt = 60 / 92;
  for (let bar = 0; bar < 2; bar++) for (let s = 0; s < 8; s++) {
    const t = 0.1 + (bar * 8 + s) * bt / 2;
    if (s === 0 || s === 5) hits.push({ type: 'K', t, amp: 1 });
    if (s === 2 || s === 6) hits.push({ type: 'S', t, amp: 0.9 });
    if (s % 2 === 1 && s !== 5) hits.push({ type: 'H', t, amp: 0.6 });
    if (s === 7 && bar === 1) hits.push({ type: 'O', t, amp: 0.7 });
  }
  voice.scheduleAt(planDrums(hits), sys.now() + 0.08, true);
}
function chord() {
  stopAll();
  const parts = [['soprano', 72, -0.5], ['alto', 67, 0.5], ['tenor', 64, -0.2], ['bass', 48, 0.2]];
  while (extra.length < parts.length) extra.push(sys.voice({}));
  const t0 = sys.now() + 0.1;
  const prog = [[0, 0, 0, 0], [0, 2, 1, 5], [-1, 0, 1, 7], [0, 0, 0, 0]];
  parts.forEach(([p, m, pan], i) => {
    const v = extra[i];
    v.configure(Object.assign(engineCfg(PRESETS[p]), { volume: 0.7, pan }));
    const notes = prog.map((d, j) => ({ t: j * 1.3, d: 1.3, f0: midiToHz(m + d[i]), amp: 0.7, syl: syl([], ['a'], []), w: -1 }));
    v.scheduleAt(planNotes(notes, 'pl'), t0, true);
  });
}
function stopAll() {
  if (voice) voice.stop();
  for (const v of extra) v.stop();
}

let pad = { x: 0.5, y: 0.45 }, padDown = false, round = false, nasal = false;
const VOW_LBL = { i: VOWELS.i, e: VOWELS.e, a: VOWELS.a, o: VOWELS.o, u: VOWELS.u, y: VOWELS.y };
for (const [k, v] of Object.entries(VOW_LBL)) {
  const s = document.createElement('span');
  s.className = 'lbl';
  s.style.cssText = `left:${((v[0] - 0.25) / 0.47) * 88 + 4}%;top:${Math.min(0.92, (v[2] - 0.05) / 0.95) * 80 + 8}%;color:#9fb3c4;font-size:12px`;
  s.textContent = k;
  $('pad').appendChild(s);
}
function padParams(amp) {
  const p = vowelParams('@', amp);
  p[TX] = 0.25 + pad.x * 0.47;
  p[OPEN] = 0.05 + pad.y * 0.95;
  p[TD] = 0.5 + pad.y * 1.1 + (1 - Math.abs(pad.x - 0.5) * 2) * 0.4;
  p[LIPD] = round ? 0.55 : 1.2 + pad.y;
  p[LIPR] = round ? 0.9 : 0;
  p[VEL] = nasal ? 0.8 : 0;
  return p;
}
function placeDot() { $('dot').style.left = pad.x * 100 + '%'; $('dot').style.top = pad.y * 100 + '%'; }
placeDot();
let liveMidi = null;
function liveVowel(m) {
  if (m !== undefined) liveMidi = m;
  const midi = liveMidi ?? state.pitch;
  voice.live([{ len: 1e9, hold: true, p: padParams(0.85), f0: midiToHz(midi), burst: 0, burstX: 0, w: -1 }]);
}
function liveOff() { voice.live([{ len: 0.3, p: vowelParams('@', 0), f0: 0, burst: 0, burstX: 0, w: -1, rest: true }]); }
function padMove(e) {
  const r = $('pad').getBoundingClientRect();
  pad.x = Math.min(1, Math.max(0, (e.clientX - r.left) / r.width));
  pad.y = Math.min(1, Math.max(0, (e.clientY - r.top) / r.height));
  placeDot();
}
$('pad').addEventListener('pointerdown', async (e) => {
  await ensure();
  $('pad').setPointerCapture(e.pointerId);
  padDown = true; padMove(e); liveMidi = null; liveVowel();
});
$('pad').addEventListener('pointermove', (e) => { if (!padDown && !held.size) return; padMove(e); if (padDown || held.size) liveVowel(); });
$('pad').addEventListener('pointerup', () => { padDown = false; if (!held.size) liveOff(); });
$('round').addEventListener('click', (e) => { round = !round; e.target.classList.toggle('on', round); if (padDown || held.size) liveVowel(); });
$('nasal').addEventListener('click', (e) => { nasal = !nasal; e.target.classList.toggle('on', nasal); if (padDown || held.size) liveVowel(); });

let octave = 0;
const KEYMAP = 'awsedftgyhujk';
const WHITE = [0, 2, 4, 5, 7, 9, 11, 12, 14, 16, 17, 19, 21, 23, 24];
const BLACK = [1, 3, 6, 8, 10, 13, 15, 18, 20, 22];
function baseMidi() { return 48 + octave * 12 + (state.pitch >= 60 ? 12 : 0); }
function buildKeys() {
  const k = $('keys');
  k.innerHTML = '';
  WHITE.forEach((s, i) => { const d = document.createElement('div'); d.className = 'key'; d.dataset.s = s; d.textContent = s % 12 === 0 ? noteName(baseMidi() + s) : ''; k.appendChild(d); });
  BLACK.forEach((s) => {
    const d = document.createElement('div');
    d.className = 'key black'; d.dataset.s = s;
    const wi = WHITE.indexOf(s - 1);
    d.style.left = `calc(${(wi + 1) * 100 / 15}% - ${100 / 15 * 0.31}%)`;
    k.appendChild(d);
  });
}
buildKeys();
const held = new Map();
function noteOn(s, src) {
  if (held.has(src)) return;
  held.set(src, s);
  document.querySelector(`.key[data-s="${s}"]`)?.classList.add('down');
  liveVowel(baseMidi() + s);
}
function noteOff(src) {
  const s = held.get(src);
  if (s === undefined) return;
  held.delete(src);
  document.querySelector(`.key[data-s="${s}"]`)?.classList.remove('down');
  if (held.size) liveVowel(baseMidi() + [...held.values()].pop());
  else if (!padDown) liveOff();
}
$('keys').addEventListener('pointerdown', async (e) => {
  const k = e.target.closest('.key');
  if (!k) return;
  await ensure();
  noteOn(+k.dataset.s, 'p' + e.pointerId);
});
for (const ev of ['pointerup', 'pointercancel']) window.addEventListener(ev, (e) => noteOff('p' + e.pointerId));
window.addEventListener('keydown', async (e) => {
  if (e.repeat || e.target.tagName === 'INPUT') return;
  const k = e.key.toLowerCase();
  if (k === 'z') { octave = Math.max(-2, octave - 1); buildKeys(); return; }
  if (k === 'x') { octave = Math.min(2, octave + 1); buildKeys(); return; }
  const i = KEYMAP.indexOf(k);
  if (i < 0) return;
  await ensure();
  noteOn(i, 'k' + k);
});
window.addEventListener('keyup', (e) => noteOff('k' + e.key.toLowerCase()));

const headCv = $('head');
const stage = new Stage(headCv);
const idle = { params: Float32Array.from(REST_PARAMS), level: 0, f0Rel: 0 };
const panel = stage.addPanel({ id: 'lab', color: '#4fd2ff', wordColor: '#7dffb6', source: () => (voice ? { params: voice.params, level: voice.level, f0Rel: (Math.log2(voice.f0 / midiToHz(state.pitch))) } : idle) });
window.__lab = { stage, panel };
function sizeStage() { stage.setSize(headCv.clientWidth, headCv.clientHeight); }
new ResizeObserver(sizeStage).observe(headCv);
sizeStage();
let dragX = null;
headCv.addEventListener('pointerdown', (e) => { dragX = e.clientX; headCv.setPointerCapture(e.pointerId); panel.yawOverride = panel.yawOverride ?? -1.0; panel.overrideT = 4; });
headCv.addEventListener('pointermove', (e) => { if (dragX === null) return; panel.yawOverride += (e.clientX - dragX) * 0.01; dragX = e.clientX; panel.overrideT = 4; });
headCv.addEventListener('pointerup', () => { dragX = null; });
let lastT = performance.now();
const cv = $('tract'), g = cv.getContext('2d');
const diam = new Float32Array(64);
loop();
function loop() {
  requestAnimationFrame(loop);
  const now = performance.now();
  const dt = Math.min(0.05, (now - lastT) / 1000);
  lastT = now;
  if (voice) voice.sample();
  stage.frame(dt);
  if (!voice) return;
  const dpr = Math.min(2, devicePixelRatio || 1);
  const W = cv.clientWidth, H = cv.clientHeight;
  if (cv.width !== W * dpr) { cv.width = W * dpr; cv.height = H * dpr; }
  g.setTransform(dpr, 0, 0, dpr, 0, 0);
  g.clearRect(0, 0, W, H);
  const n = 44;
  tractShape(voice.params, n, diam);
  const x0 = 40, x1 = W - 30, cy = H * 0.6, sc = Math.min(34, H * 0.11);
  const lvl = Math.min(1, voice.level * 6);
  g.lineWidth = 1;
  g.strokeStyle = '#16212c';
  for (let i = 0; i <= 10; i++) { const x = x0 + (x1 - x0) * i / 10; g.beginPath(); g.moveTo(x, 20); g.lineTo(x, H - 20); g.stroke(); }
  const grad = g.createLinearGradient(x0, 0, x1, 0);
  grad.addColorStop(0, '#b48cff'); grad.addColorStop(0.45, '#5fd4ff'); grad.addColorStop(1, '#7dffb6');
  g.fillStyle = `rgba(95,212,255,${0.06 + lvl * 0.2})`;
  g.beginPath();
  for (let i = 0; i < n; i++) { const x = x0 + (x1 - x0) * (i + 0.5) / n; g.lineTo(x, cy - diam[i] * sc); }
  for (let i = n - 1; i >= 0; i--) { const x = x0 + (x1 - x0) * (i + 0.5) / n; g.lineTo(x, cy + diam[i] * sc); }
  g.closePath(); g.fill();
  g.strokeStyle = grad; g.lineWidth = 1.6; g.shadowColor = '#5fd4ff'; g.shadowBlur = 8 + lvl * 14;
  for (const s of [-1, 1]) {
    g.beginPath();
    for (let i = 0; i < n; i++) { const x = x0 + (x1 - x0) * (i + 0.5) / n; g[i ? 'lineTo' : 'moveTo'](x, cy + s * diam[i] * sc); }
    g.stroke();
  }
  const vx = x0 + (x1 - x0) * 0.52, vel = voice.params[VEL];
  g.strokeStyle = '#ffb454'; g.shadowColor = '#ffb454';
  g.beginPath(); g.moveTo(vx - 6, cy - 2.2 * sc); g.lineTo(vx - 6 - vel * 10, cy - 2.2 * sc - 40); g.stroke();
  g.beginPath(); g.moveTo(vx + 6 + vel * 8, cy - 2.2 * sc); g.lineTo(vx + 6 + vel * 8, cy - 2.2 * sc - 40); g.stroke();
  g.shadowBlur = 0;
  g.fillStyle = '#6d8294'; g.font = '10px "Geist Mono", monospace';
  g.fillText('KRTAŃ', x0 - 8, H - 8); g.fillText('USTA', x1 - 26, H - 8); g.fillText('NOS', vx - 8, cy - 2.2 * sc - 48);
  g.fillText('GARDŁO · PRZEKRÓJ NA ŻYWO', 14, 18);
  $('rf0').textContent = Math.round(voice.f0) + ' Hz';
  $('rnote').textContent = noteName(12 * Math.log2(voice.f0 / 440) + 69);
  $('rlvl').textContent = voice.params[VOICE] > 0.02 ? Math.round(lvl * 100) + '%' : '-';
  $('rn').textContent = sys.steps === 2 ? '2× próbkowanie' : '1×';
}
