// Wire Choir app: song state, floating heads, typing dock (Enter sings, Shift+Enter saves, Space plays), rail windows.
import { AudioSystem } from './audio.js';
import { Player } from './player.js';
import { Stage } from './stage/stage.js';
import { parseLyrics, prepareLang } from './lyrics.js';
import { arrange, buildParts, MOODS } from './composer.js';
import { PRESETS, midiToHz, noteName, NOTE_NAMES } from './voices.js';
import { REST_PARAMS } from './voice/engine.js';
import { Win } from './ui/windows.js';

const $ = (s) => document.querySelector(s);
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

const T = {
  pl: {
    placeholder: 'Napisz coś, co mają zaśpiewać', sing: 'zaśpiewaj', save: 'zapisz', play: 'odtwórz', stop: 'stop',
    saved: (n) => `Zapisano jako linijka ${n}`, singing: 'Śpiewa', heads: 'Głowy', song: 'Piosenka', addHead: 'Dodaj głowę',
    lines: (n) => (n === 0 ? 'Pusta piosenka' : n === 1 ? '1 linijka' : n % 10 >= 2 && n % 10 <= 4 && (n % 100 < 12 || n % 100 > 14) ? `${n} linijki` : `${n} linijek`),
    roles: { lead: 'Prowadzi', harmony: 'Harmonia', choir: 'Chór', bass: 'Bas', beatbox: 'Beatbox' },
    moods: { happy: 'Radosny', ballad: 'Ballada', sad: 'Smutny', dark: 'Mroczny', hymn: 'Hymn' },
    major: 'dur', minor: 'moll', head: 'Głowa', role: 'Rola', voice: 'Głos', register: 'Rejestr', throat: 'Gardło', breath: 'Oddech',
    soft: 'Miękkość', vib: 'Wibrato', rough: 'Chrypka', volume: 'Głośność', listen: 'Przytrzymaj, żeby posłuchać', remove: 'Usuń głowę',
    harm: 'Interwał', harms: { up3: 'Tercja wyżej', down3: 'Tercja niżej', down6: 'Seksta niżej', up5: 'Kwinta wyżej' },
    vowel: 'Samogłoska', density: 'Gęstość', dens: { calm: 'Spokojny', normal: 'Normalny', busy: 'Gęsty' },
    mood: 'Nastrój', key: 'Tonacja', tempo: 'Tempo', lang: 'Język', saved_lines: 'Linijki', playAll: 'Odtwórz całość', stopAll: 'Zatrzymaj',
    newMelody: 'Nowa melodia', emptySong: 'Napisz linijkę na dole i wciśnij Shift+Enter, żeby ją tu zapisać.', newMelodyDone: 'Nowa melodia gotowa',
    noLead: 'Żadna głowa nie prowadzi, więc tekst nie zostanie zaśpiewany. Ustaw rolę „Prowadzi” w oknie Głowy.', maxHeads: 'Maksymalnie 6 głów', all: 'wszyscy',
    keysHint: [['⏎', 'zaśpiewaj'], ['⇧⏎', 'dodaj do piosenki'], ['␣', 'odtwórz całość']], afterHint: [['⇧⏎', 'dodaj tę linijkę do piosenki'], ['↑', 'popraw']], who: 'Kto śpiewa: kliknij, żeby zmienić',
    notes: 'Nuty', play: 'Graj', exp: 'Eksport',
  },
  en: {
    placeholder: 'Type something for them to sing', sing: 'sing', save: 'save', play: 'play', stop: 'stop',
    saved: (n) => `Saved as line ${n}`, singing: 'Singing', heads: 'Heads', song: 'Song', addHead: 'Add head',
    lines: (n) => (n === 0 ? 'Empty song' : n === 1 ? '1 line' : `${n} lines`),
    roles: { lead: 'Lead', harmony: 'Harmony', choir: 'Choir', bass: 'Bass', beatbox: 'Beatbox' },
    moods: { happy: 'Happy', ballad: 'Ballad', sad: 'Sad', dark: 'Dark', hymn: 'Hymn' },
    major: 'major', minor: 'minor', head: 'Head', role: 'Role', voice: 'Voice', register: 'Register', throat: 'Throat', breath: 'Breath',
    soft: 'Softness', vib: 'Vibrato', rough: 'Rasp', volume: 'Volume', listen: 'Hold to listen', remove: 'Remove head',
    harm: 'Interval', harms: { up3: 'Third above', down3: 'Third below', down6: 'Sixth below', up5: 'Fifth above' },
    vowel: 'Vowel', density: 'Density', dens: { calm: 'Calm', normal: 'Normal', busy: 'Busy' },
    mood: 'Mood', key: 'Key', tempo: 'Tempo', lang: 'Language', saved_lines: 'Lines', playAll: 'Play all', stopAll: 'Stop',
    newMelody: 'New melody', emptySong: 'Type a line below and press Shift+Enter to save it here.', newMelodyDone: 'New melody ready',
    noLead: 'No head is set to Lead, so the words won’t be sung. Set a head to “Lead” in the Heads window.', maxHeads: 'Up to 6 heads', all: 'everyone',
    keysHint: [['⏎', 'sing'], ['⇧⏎', 'add to song'], ['␣', 'play all']], afterHint: [['⇧⏎', 'add this line to the song'], ['↑', 'edit']], who: 'Who sings: click to change',
    notes: 'Notes', play: 'Play', exp: 'Export',
  },
};

const PALETTE = [['#4fd2ff', '#7dffb6'], ['#a58bff', '#ffc6f1'], ['#7dffb6', '#9fe8ff'], ['#ffb454', '#fff0c8'], ['#ff7ad9', '#d7c8ff'], ['#dfe8ff', '#7fe3ff']];
const ROLES = ['lead', 'harmony', 'choir', 'bass', 'beatbox'];
const ROLE_PRESET = { lead: 'baritone', harmony: 'alto', choir: 'tenor', bass: 'bass', beatbox: 'baritone' };

function newHead(role, idx) {
  const preset = ROLE_PRESET[role], p = PRESETS[preset];
  const [color, wordColor] = PALETTE[idx % PALETTE.length];
  return { id: 'h' + Math.random().toString(36).slice(2, 8), role, preset, lo: p.lo, hi: p.hi, tract: p.tract, rd: p.rd, breath: p.breath, vib: p.vib, rough: p.rough, shift: 0, volume: 1, color, wordColor, harm: 'up3', vowel: 'u', density: 'normal' };
}
const DEFAULT = () => ({ v: 1, lang: (navigator.languages || [navigator.language || '']).some((l) => /^pl/i.test(l)) ? 'pl' : 'en', mood: 'happy', key: 0, bpm: null, seed: 7, lines: [], heads: [newHead('lead', 0)] });

function load() { try { const s = JSON.parse(localStorage.getItem('wc.song')); return s && s.v === 1 && s.heads && s.heads.length ? s : null; } catch (e) { return null; } }
function save() { try { localStorage.setItem('wc.song', JSON.stringify(song)); } catch (e) {} }
let song = load() || DEFAULT();
const t = () => T[song.lang] || T.pl;

const sys = new AudioSystem();
const player = new Player(sys);
let audioReady = false;
async function ensureAudio() {
  await sys.start();
  await sys.resume();
  if (!audioReady) { audioReady = true; player.sync(song.heads); }
}

const canvas = $('#stage');
const stage = new Stage(canvas, { layout: 'row' });
stage.gap = 0;
const idle = { params: Float32Array.from(REST_PARAMS), level: 0, f0Rel: 0 };
const panelOf = new Map();
function syncPanels() {
  const ids = new Set(song.heads.map((h) => h.id));
  for (const [id, p] of panelOf) if (!ids.has(id)) { stage.removePanel(p); panelOf.delete(id); }
  song.heads.forEach((h, i) => {
    let p = panelOf.get(h.id);
    if (p && p.color !== h.color) { stage.removePanel(p); panelOf.delete(h.id); p = null; }
    if (!p) {
      p = stage.addPanel({ id: h.id, color: h.color, wordColor: h.wordColor, phase: i * 1.9, scale: 0.86 + (h.tract - 12) * 0.02, source: () => {
        const v = player.voiceOf(h.id);
        if (!v) return idle;
        v.sample();
        return { params: v.params, level: v.level, f0Rel: Math.log2(v.f0 / midiToHz((h.lo + h.hi) / 2 + (h.shift || 0))) };
      } });
      p.color = h.color;
      panelOf.set(h.id, p);
    }
    p.head.group.scale.setScalar(0.86 + (h.tract - 12) * 0.02);
  });
  stage.panels.sort((a, b) => song.heads.findIndex((h) => h.id === a.id) - song.heads.findIndex((h) => h.id === b.id));
  stage.relayout();
}
new ResizeObserver(() => stage.setSize(canvas.clientWidth, canvas.clientHeight)).observe(canvas);
stage.setSize(canvas.clientWidth, canvas.clientHeight);
syncPanels();

let dragP = null, dragX = 0;
canvas.addEventListener('pointerdown', (e) => {
  const r = canvas.getBoundingClientRect();
  dragP = stage.panelAt(e.clientX - r.left, e.clientY - r.top);
  if (!dragP) return;
  dragX = e.clientX;
  canvas.setPointerCapture(e.pointerId);
  if (dragP.yawOverride === null) dragP.yawOverride = -1.1;
  dragP.overrideT = 5;
});
canvas.addEventListener('pointermove', (e) => { if (!dragP) return; dragP.yawOverride += (e.clientX - dragX) * 0.008; dragX = e.clientX; dragP.overrideT = 5; });
canvas.addEventListener('pointerup', () => { dragP = null; });

let current = null;
player.onWord = (hid, w) => {
  const p = panelOf.get(hid);
  const word = current && current.parsed.words[w];
  if (p && word) stage.emitWord(p, word.text);
};
let karaToken = 0;
function karaShow() { karaToken++; document.body.classList.remove('kara-fade'); document.body.classList.add('kara-on'); }
function karaHide(fade) {
  const tok = ++karaToken;
  if (!fade) { document.body.classList.remove('kara-on', 'kara-fade'); return; }
  document.body.classList.add('kara-fade');
  setTimeout(() => { if (tok === karaToken) document.body.classList.remove('kara-on', 'kara-fade'); }, 900);
}
player.onEnd = () => { karaHide(true); current = null; renderHistory(); updateStatus(); };

const input = $('#input'), kara = $('#kara');
let lastSung = '', lastSaved = true;
function autosize() { input.style.height = 'auto'; input.style.height = input.scrollHeight + 'px'; }

function singersFor(lines) {
  const out = {};
  lines.forEach((l, i) => { if (l.singers && l.singers.length) out[i] = l.singers; });
  return out;
}

function karaokeHTML(text, notes) {
  let html = '', pos = 0;
  const low = text.toLowerCase();
  notes.forEach((n, i) => {
    const s = (n.syl.text || '').trim().toLowerCase();
    if (!s) return;
    const at = low.indexOf(s, pos);
    if (at < 0) return;
    html += esc(text.slice(pos, at)) + `<span class="syl" data-n="${i}">${esc(text.slice(at, at + s.length))}</span>`;
    pos = at + s.length;
  });
  return html + esc(text.slice(pos));
}

async function singLine(text) {
  text = text.trim();
  if (!text) return;
  await ensureAudio();
  await prepareLang(song.lang);
  const parsed = parseLyrics(text, song.lang);
  if (!parsed.syls.length) return;
  const leads = song.heads.filter((h) => h.role === 'lead').map((h) => h.id);
  if (!leads.length) toast(t().noLead, 4200);
  const arr = arrange({ ...song, melody: null, lineSingers: { 0: leads } }, parsed, song.heads, { intro: false });
  const parts = buildParts(arr, song.heads);
  const notes = arr.notes.map((n) => ({ ...n, t0: n.b * arr.spb, t1: (n.b + n.d) * arr.spb }));
  const backing = song.heads.some((h) => h.role === 'choir' || h.role === 'bass' || h.role === 'beatbox');
  const dur = backing ? arr.duration : Math.max(...notes.map((n) => n.t1)) + 0.7;
  player.play(arr, parts, song.lang, song.heads, dur);
  current = { mode: 'line', parsed, arr: { ...arr, duration: dur }, notes, color: colorOf(leads[0]) };
  lastSung = text;
  lastSaved = song.lines.some((l) => l.text === text);
  renderHint();
  kara.innerHTML = karaokeHTML(text, notes);
  if (!input.value) karaShow(); else karaHide(false);
  updateStatus();
}

async function playSong() {
  if (!song.lines.length) { input.focus(); return; }
  await ensureAudio();
  await prepareLang(song.lang);
  const parsed = parseLyrics(song.lines.map((l) => l.text).join('\n'), song.lang);
  const arr = arrange({ ...song, lineSingers: singersFor(song.lines) }, parsed, song.heads);
  const parts = buildParts(arr, song.heads);
  player.play(arr, parts, song.lang, song.heads);
  const notes = arr.notes.map((n) => ({ ...n, t0: n.b * arr.spb, t1: (n.b + n.d) * arr.spb }));
  current = { mode: 'song', parsed, arr, notes, line: -1 };
  kara.innerHTML = '';
  if (!input.value) karaShow(); else karaHide(false);
  updateStatus();
}

function stopAll() { player.stop(); }
function toggleSong() { if (player.playing) stopAll(); else playSong(); }
function colorOf(id) { const h = song.heads.find((x) => x.id === id); return h ? h.wordColor : '#f5f5f7'; }

function saveLine(text) {
  text = text.trim();
  if (!text) return;
  song.lines.push({ text, singers: [] });
  if (text === lastSung) lastSaved = true;
  commit();
  renderHint();
  toast(t().saved(song.lines.length));
}
function saveNow() {
  if (input.value.trim()) { saveLine(input.value); input.value = ''; autosize(); }
  else if (lastSung && !lastSaved) saveLine(lastSung);
}

input.addEventListener('keydown', (e) => {
  if (e.isComposing) return;
  if (e.key === 'Enter' && !e.shiftKey && !e.metaKey && !e.ctrlKey) {
    e.preventDefault();
    send();
  } else if (e.key === 'Enter' && e.shiftKey) {
    e.preventDefault();
    saveNow();
  } else if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
    e.preventDefault(); toggleSong();
  } else if (e.key === ' ' && !input.value) {
    e.preventDefault(); toggleSong();
  } else if (e.key === 'Escape') {
    stopAll();
  } else if (e.key === 'ArrowUp' && !input.value && (lastSung || song.lines.length)) {
    e.preventDefault(); input.value = lastSung || song.lines[song.lines.length - 1].text; autosize(); karaHide(false);
  }
});
function send() {
  const v = input.value;
  if (!v.trim()) { toggleSong(); return; }
  input.value = '';
  autosize();
  singLine(v);
}
input.addEventListener('input', () => { autosize(); if (input.value) karaHide(false); });
$('#save').addEventListener('click', () => { saveNow(); input.focus(); });
$('#dock').addEventListener('pointerdown', (e) => { if (!e.target.closest('button')) setTimeout(() => input.focus(), 0); });
window.addEventListener('keydown', (e) => {
  const tag = (e.target.tagName || '').toLowerCase();
  if (tag === 'textarea' || tag === 'input' || tag === 'select' || e.target.isContentEditable) return;
  if (e.key === ' ' && tag !== 'button') { e.preventDefault(); toggleSong(); return; }
  if (e.key === 'Escape') { stopAll(); return; }
  if (e.key.length === 1 && !e.metaKey && !e.ctrlKey && !e.altKey) input.focus();
});

let toastTimer = 0;
function toast(msg, ms = 2200) {
  const el = $('#toast');
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), ms);
}

function fmt(s) { s = Math.max(0, s); return Math.floor(s / 60) + ':' + String(Math.floor(s % 60)).padStart(2, '0'); }
function keyName() { const m = MOODS[song.mood] || MOODS.happy; return NOTE_NAMES[song.key] + (song.lang === 'pl' ? '-' : ' ') + (m.mode === 'minor' ? t().minor : t().major); }
function bpm() { return song.bpm || (MOODS[song.mood] || MOODS.happy).bpm; }
function updateStatus() {
  const s = $('#status');
  if (current && player.playing) s.textContent = `${t().singing} · ${fmt(player.time())} / ${fmt(current.arr.duration)}`;
  else s.textContent = [t().lines(song.lines.length), t().moods[song.mood], keyName(), bpm() + ' BPM', song.lang.toUpperCase()].join(' · ');
}
function renderChrome() {
  document.documentElement.lang = song.lang;
  input.placeholder = t().placeholder;
  renderHint();
  const labels = { heads: t().heads, song: t().song, notes: t().notes, play: t().play, export: t().exp };
  document.querySelectorAll('#rail button').forEach((b) => { b.querySelector('span').textContent = labels[b.dataset.open]; b.setAttribute('aria-label', labels[b.dataset.open]); });
  updateStatus();
}

function renderHint() {
  const after = lastSung && !lastSaved;
  document.body.classList.toggle('can-save', after);
  $('#hint').innerHTML = (after ? t().afterHint : t().keysHint).map(([k, v]) => `<span><kbd>${k}</kbd>${v}</span>`).join('');
}

function renderHistory() {
  const h = $('#history');
  const playingLine = current && current.mode === 'song' ? current.line : -1;
  h.innerHTML = song.lines.map((l, k) => {
    const who = (l.singers && l.singers[0]) || (song.heads.find((x) => x.role === 'lead') || {}).id;
    const c = (song.heads.find((x) => x.id === who) || {}).color || '#4fd2ff';
    return `<button class="verse${k === playingLine ? ' on' : ''}" data-l="${k}"><i style="background:${c}"></i>${esc(l.text)}</button>`;
  }).join('');
  h.scrollTop = h.scrollHeight;
}
$('#history').addEventListener('click', (e) => {
  const b = e.target.closest('[data-l]');
  if (!b) return;
  const l = song.lines[+b.dataset.l];
  if (l) singLine(l.text);
});


const wins = {};
function openWin(name) {
  if (wins[name]) { wins[name].close(); return; }
  const cfg = { heads: { title: t().heads, w: 340, h: 520, x: 60, y: 50 }, song: { title: t().song, w: 380, h: 470, x: Math.max(60, window.innerWidth - 440), y: 50 } }[name];
  const w = new Win(name, cfg.title, cfg);
  w.onClose = () => { delete wins[name]; document.querySelector(`#rail [data-open="${name}"]`)?.classList.remove('on'); };
  wins[name] = w;
  document.querySelector(`#rail [data-open="${name}"]`)?.classList.add('on');
  renderWin(name);
}
function renderWin(name) {
  const w = wins[name];
  if (!w) return;
  w.el.querySelector('.win-t').textContent = name === 'heads' ? t().heads : t().song;
  if (name === 'heads') renderHeads(w.body); else renderSong(w.body);
}
document.querySelectorAll('[data-open]').forEach((b) => b.addEventListener('click', () => openWin(b.dataset.open)));

function commit(opts = {}) {
  save();
  syncPanels();
  if (audioReady) player.sync(song.heads);
  if (!opts.keepWins) { renderWin('heads'); renderWin('song'); }
  renderHistory();
  renderChrome();
}

let expanded = song.heads[0] ? song.heads[0].id : null;
function chips(items, cur, on) {
  const d = document.createElement('div');
  d.className = 'chips';
  for (const [v, label] of items) {
    const b = document.createElement('button');
    b.textContent = label;
    if (v === cur) b.classList.add('on');
    b.addEventListener('click', () => on(v));
    d.appendChild(b);
  }
  return d;
}
function label(text, val) { const d = document.createElement('div'); d.className = 'lbl'; d.innerHTML = `<span>${text}</span><b>${val ?? ''}</b>`; return d; }

function slider(h, key, name, min, max, step, fmtv) {
  const wrap = document.createDocumentFragment();
  const lb = label(name, fmtv(h[key]));
  const r = document.createElement('input');
  r.type = 'range'; r.min = min; r.max = max; r.step = step; r.value = h[key];
  r.setAttribute('aria-label', name);
  r.addEventListener('input', () => {
    h[key] = +r.value;
    lb.querySelector('b').textContent = fmtv(h[key]);
    save();
    if (audioReady) player.sync(song.heads);
    if (key === 'tract') syncPanels();
    if (previewing === h.id && audioReady) player.preview(h, true);
  });
  r.addEventListener('pointerdown', () => startPreview(h));
  r.addEventListener('pointerup', stopPreview);
  r.addEventListener('pointercancel', stopPreview);
  wrap.append(lb, r);
  return wrap;
}

let previewing = null;
async function startPreview(h) {
  await ensureAudio();
  previewing = h.id;
  if (h.role === 'beatbox') return;
  player.preview(h, true);
}
function stopPreview() {
  if (!previewing) return;
  const h = song.heads.find((x) => x.id === previewing);
  previewing = null;
  if (h && h.role !== 'beatbox') player.preview(h, false);
}

function renderHeads(body) {
  const L = t();
  body.innerHTML = '';
  const add = document.createElement('button');
  add.className = 'btn pri';
  add.style.width = '100%';
  add.textContent = '+ ' + L.addHead;
  add.addEventListener('click', () => {
    if (song.heads.length >= 6) { toast(L.maxHeads); return; }
    const used = song.heads.map((h) => h.role);
    const role = ['harmony', 'bass', 'beatbox', 'choir', 'choir', 'lead'].find((r) => !used.includes(r) || r === 'choir') || 'choir';
    const h = newHead(role, song.heads.length);
    song.heads.push(h);
    expanded = h.id;
    commit();
  });
  body.appendChild(add);
  const list = document.createElement('div');
  list.style.marginTop = '10px';
  song.heads.forEach((h, i) => {
    const row = document.createElement('div');
    row.className = 'hrow';
    row.innerHTML = `<i style="background:${h.color}"></i><b>${L.head} ${i + 1}</b><span>${L.roles[h.role]} · ${PRESETS[h.preset] ? PRESETS[h.preset][song.lang] : ''}</span>`;
    row.addEventListener('click', () => { expanded = expanded === h.id ? null : h.id; renderHeads(body); });
    list.appendChild(row);
    if (expanded !== h.id) return;
    const ed = document.createElement('div');
    ed.className = 'hed';
    ed.append(label(L.role), chips(ROLES.map((r) => [r, L.roles[r]]), h.role, (r) => { h.role = r; commit(); }));
    ed.append(label(L.voice), chips(Object.keys(PRESETS).map((k) => [k, PRESETS[k][song.lang]]), h.preset, (k) => {
      const p = PRESETS[k];
      Object.assign(h, { preset: k, lo: p.lo, hi: p.hi, tract: p.tract, rd: p.rd, breath: p.breath, vib: p.vib, rough: p.rough, shift: 0 });
      commit();
      startPreview(h); setTimeout(stopPreview, 700);
    }));
    if (h.role === 'harmony') ed.append(label(L.harm), chips(Object.entries(L.harms), h.harm, (v) => { h.harm = v; commit(); }));
    if (h.role === 'choir') ed.append(label(L.vowel), chips([['u', 'u'], ['o', 'o'], ['a', 'a'], ['M', 'mmm']], h.vowel, (v) => { h.vowel = v; commit(); }));
    if (h.role === 'beatbox') ed.append(label(L.density), chips(Object.entries(L.dens), h.density, (v) => { h.density = v; commit(); }));
    ed.append(
      slider(h, 'shift', L.register, -12, 12, 1, (v) => noteName((h.lo + h.hi) / 2 + v)),
      slider(h, 'tract', L.throat, 11, 20, 0.1, (v) => v.toFixed(1) + ' cm'),
      slider(h, 'breath', L.breath, 0, 1, 0.01, (v) => Math.round(v * 100) + '%'),
      slider(h, 'rd', L.soft, 0.4, 2.4, 0.01, (v) => v.toFixed(2)),
      slider(h, 'vib', L.vib, 0, 90, 1, (v) => v + ' c'),
      slider(h, 'rough', L.rough, 0, 1, 0.01, (v) => Math.round(v * 100) + '%'),
      slider(h, 'volume', L.volume, 0, 1.5, 0.01, (v) => Math.round(v * 100) + '%'),
    );
    const ls = document.createElement('button');
    ls.className = 'listen';
    ls.textContent = L.listen;
    ls.addEventListener('pointerdown', (e) => { ls.setPointerCapture(e.pointerId); ls.classList.add('on'); startPreview(h); });
    const off = () => { ls.classList.remove('on'); stopPreview(); };
    ls.addEventListener('pointerup', off); ls.addEventListener('pointercancel', off);
    ed.append(ls);
    if (song.heads.length > 1) {
      const rm = document.createElement('button');
      rm.className = 'btn quiet';
      rm.style.marginTop = '8px';
      rm.textContent = L.remove;
      rm.addEventListener('click', () => { song.heads = song.heads.filter((x) => x.id !== h.id); song.lines.forEach((l) => { l.singers = (l.singers || []).filter((id) => id !== h.id); }); expanded = null; commit(); });
      ed.append(rm);
    }
    list.appendChild(ed);
  });
  body.appendChild(list);
}

function renderSong(body) {
  const L = t();
  body.innerHTML = '';
  body.append(label(L.mood), chips(Object.keys(MOODS).map((m) => [m, L.moods[m]]), song.mood, (m) => { song.mood = m; song.bpm = null; commit(); }));
  const keyRow = label(L.key, '');
  const sel = document.createElement('select');
  sel.setAttribute('aria-label', L.key);
  NOTE_NAMES.forEach((n, i) => { const o = document.createElement('option'); o.value = i; o.textContent = n; if (i === song.key) o.selected = true; sel.appendChild(o); });
  sel.addEventListener('change', () => { song.key = +sel.value; commit({ keepWins: true }); });
  keyRow.querySelector('b').appendChild(sel);
  body.append(keyRow);
  const tl = label(L.tempo, bpm() + ' BPM');
  const tr = document.createElement('input');
  tr.type = 'range'; tr.min = 56; tr.max = 168; tr.step = 1; tr.value = bpm();
  tr.setAttribute('aria-label', L.tempo);
  tr.addEventListener('input', () => { song.bpm = +tr.value; tl.querySelector('b').textContent = song.bpm + ' BPM'; save(); updateStatus(); });
  body.append(tl, tr);
  body.append(label(L.lang), chips([['pl', 'Polski'], ['en', 'English']], song.lang, (v) => { song.lang = v; commit(); }));
  body.append(label(L.saved_lines, song.lines.length || ''));
  const list = document.createElement('div');
  if (!song.lines.length) list.innerHTML = `<p class="empty">${L.emptySong}</p>`;
  const leads = song.heads.filter((h) => h.role === 'lead');
  song.lines.forEach((l, i) => {
    const r = document.createElement('div');
    r.className = 'lrow';
    const who = l.singers && l.singers.length ? l.singers : [];
    const c = who.length === 1 ? colorOf(who[0]) && (song.heads.find((x) => x.id === who[0]) || {}).color : who.length > 1 ? '#f5f5f7' : (leads[0] || {}).color || '#4fd2ff';
    r.innerHTML = `<button aria-label="${L.sing}">▶</button><p contenteditable="true" spellcheck="false">${esc(l.text)}</p><button class="who" title="${L.who}" style="background:${c}"></button><button aria-label="×">×</button>`;
    const [pb, , wb, xb] = r.children;
    const p = r.querySelector('p');
    pb.addEventListener('click', () => singLine(l.text));
    p.addEventListener('blur', () => { const v = p.textContent.trim(); if (v && v !== l.text) { l.text = v; commit({ keepWins: true }); } });
    p.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); p.blur(); } });
    wb.addEventListener('click', () => {
      if (leads.length < 2) return;
      const opts = [...leads.map((h) => [h.id]), leads.map((h) => h.id)];
      const k = opts.findIndex((o) => o.join() === (who.length ? who.join() : leads[0].id));
      l.singers = opts[(k + 1) % opts.length];
      commit();
    });
    xb.addEventListener('click', () => { song.lines.splice(i, 1); commit(); });
    list.appendChild(r);
  });
  body.append(list);
  const row = document.createElement('div');
  row.className = 'row2';
  const pa = document.createElement('button');
  pa.className = 'btn pri';
  pa.textContent = player.playing && current && current.mode === 'song' ? L.stopAll : L.playAll;
  pa.addEventListener('click', () => { toggleSong(); setTimeout(() => renderWin('song'), 50); });
  const nm = document.createElement('button');
  nm.className = 'btn';
  nm.textContent = L.newMelody;
  nm.addEventListener('click', () => { song.seed = (song.seed * 7919 + 13) % 1000003; save(); toast(L.newMelodyDone); if (player.playing && current && current.mode === 'song') playSong(); });
  row.append(pa, nm);
  body.append(row);
}

let last = performance.now(), statusT = 0, lastActive = 0;
function loop() {
  requestAnimationFrame(loop);
  const now = performance.now();
  const active = player.playing || previewing || dragP || [...player.voices.values()].some((v) => v.level > 0.001);
  if (active) lastActive = now;
  if (now - lastActive > 1500 && now - last < 40) return;
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  stage.frame(dt);
  if (current && player.playing) {
    const tt = player.time();
    if (current.mode === 'song') {
      let li = -1;
      for (let k = 0; k < current.arr.lines.length; k++) if (tt >= current.arr.lines[k].b0 * current.arr.spb - 0.5) li = k;
      if (li !== current.line) {
        current.line = li;
        const ln = current.arr.lines[li];
        if (ln) {
          const idx = [];
          current.notes.forEach((n, i) => { if (n.line === ln.i) idx.push(i); });
          const text = current.parsed.lines[ln.i].text;
          const sub = idx.map((i) => current.notes[i]);
          kara.innerHTML = karaokeHTML(text, sub).replace(/data-n="(\d+)"/g, (m, k) => `data-n="${idx[+k]}"`);
          current.color = colorOf(ln.singers[0]);
        } else kara.innerHTML = '';
        renderHistory();
      }
    }
    const host = kara;
    host.querySelectorAll('.syl').forEach((s) => {
      const n = current.notes[+s.dataset.n];
      if (!n) return;
      const pr = Math.max(0, Math.min(1, (tt - n.t0) / Math.max(0.08, n.t1 - n.t0)));
      s.style.backgroundImage = `linear-gradient(90deg, ${current.color} ${pr * 100}%, ${current.mode === 'song' ? '#3a3a3c' : '#f5f5f7'} ${pr * 100}%)`;
      s.style.color = 'transparent';
    });
    statusT += dt;
    if (statusT > 0.25) { statusT = 0; updateStatus(); }
  }
}

document.body.style.setProperty('--head', (song.heads.find((h) => h.role === 'lead') || song.heads[0]).color);
renderChrome();
renderHistory();
autosize();
window.addEventListener('resize', autosize);
if (document.fonts) document.fonts.ready.then(autosize);
setTimeout(autosize, 250);
input.focus();
window.__wc = { sys, player, stage };
loop();
