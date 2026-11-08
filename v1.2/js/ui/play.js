// Wire Choir play window: on-screen piano, computer keys and Web MIDI; every key sings the next syllable, with recording.
import { noteName } from '../voices.js';
import { snapToScale, stepToMidi, midiToStep } from '../composer.js';

const KEYMAP = 'awsedftgyhujkolp;';
const WHITE = [0, 2, 4, 5, 7, 9, 11, 12, 14, 16, 17, 19, 21, 23, 24];
const BLACK = [1, 3, 6, 8, 10, 13, 15, 18, 20, 22];

export function mountPlay(body, app) {
  const L = app.t();
  body.innerHTML = '';
  const status = document.createElement('div');
  status.className = 'lbl';
  status.style.marginTop = '6px';
  const stream = document.createElement('div');
  stream.className = 'stream';
  const kbd = document.createElement('div');
  kbd.className = 'kbd';
  const row = document.createElement('div');
  row.className = 'row2';
  const note = document.createElement('p');
  note.className = 'note';
  note.textContent = L.playNote;
  body.append(status, stream, kbd, row, note);

  let base = 48, octave = 0, pos = 0, sylls = [], parsed = null, keysOn = false, midiState = L.midiNone;
  const held = new Map();
  let rec = null;

  async function load() {
    const r = await app.playSyllables();
    parsed = r.parsed; sylls = r.syls;
    const lead = app.song.heads.find((h) => h.role === 'lead') || app.song.heads[0];
    base = lead ? 12 * Math.floor(((lead.lo + lead.hi) / 2 - 5) / 12) : 48;
    if (pos >= sylls.length) pos = 0;
    renderStream(); buildKeys(); renderRow(); renderStatus();
  }

  function renderStatus() {
    status.innerHTML = `<span><i class="status-dot ${rec ? 'rec' : midiState === L.midiNone ? '' : 'on'}"></i>${rec ? L.recording : midiState}</span><b>${noteName(base + octave * 12)}–${noteName(base + octave * 12 + 24)}</b>`;
  }

  function renderStream() {
    if (!sylls.length) { stream.innerHTML = `<span>${L.playEmpty}</span>`; return; }
    const from = Math.max(0, pos - 3), to = Math.min(sylls.length, pos + 12);
    let html = '';
    for (let i = from; i < to; i++) {
      const s = sylls[i];
      const nx = sylls[i + 1];
      const sep = nx && nx.word === s.word ? '' : ' ';
      html += `<span data-i="${i}" class="${i === pos ? 'cur' : i < pos ? 'done' : ''}">${s.text.trim()}</span>${sep}`;
    }
    stream.innerHTML = html;
  }
  stream.addEventListener('click', (e) => { const s = e.target.closest('[data-i]'); if (s) { pos = +s.dataset.i; renderStream(); } });

  function buildKeys() {
    kbd.innerHTML = '';
    WHITE.forEach((s, i) => {
      const d = document.createElement('div');
      d.className = 'k'; d.dataset.s = s;
      const m = base + octave * 12 + s;
      d.textContent = s % 12 === 0 ? noteName(m) : keysOn && KEYMAP[s] ? KEYMAP[s].toUpperCase() : '';
      if (keysOn && KEYMAP[s] && s % 12 !== 0) d.textContent = KEYMAP[s].toUpperCase();
      kbd.appendChild(d);
    });
    BLACK.forEach((s) => {
      const d = document.createElement('div');
      d.className = 'k b'; d.dataset.s = s;
      const wi = WHITE.indexOf(s - 1);
      d.style.left = `calc(${(wi + 1) * 100 / WHITE.length}% - ${100 / WHITE.length * 0.32}%)`;
      d.style.width = `${100 / WHITE.length * 0.62}%`;
      kbd.appendChild(d);
    });
  }

  function renderRow() {
    row.innerHTML = '';
    const mk = (text, cls, fn) => { const b = document.createElement('button'); b.className = 'btn ' + (cls || ''); b.textContent = text; b.addEventListener('click', fn); row.appendChild(b); return b; };
    mk(keysOn ? L.keysOn : L.keysOff, keysOn ? 'pri' : '', () => { keysOn = !keysOn; if (keysOn) app.blurInput(); buildKeys(); renderRow(); });
    mk('−', '', () => { octave = Math.max(-2, octave - 1); buildKeys(); renderStatus(); });
    mk('+', '', () => { octave = Math.min(2, octave + 1); buildKeys(); renderStatus(); });
    mk(L.fromStart, 'quiet', () => { pos = 0; renderStream(); });
    mk(rec ? L.stopRec : '● ' + L.record, rec ? 'rec' : '', () => (rec ? stopRec() : startRec()));
  }

  function harmonyFor(midi, h) {
    const arrKey = app.song.key, mode = app.mode();
    const st = midiToStep(snapToScale(midi, arrKey, mode), arrKey, mode) + ({ up3: 2, down3: -2, down6: -5, up5: 4 }[h.harm] ?? 2);
    return stepToMidi(st, arrKey, mode);
  }
  function fit(m, h) {
    const c = (h.lo + h.hi) / 2 + (h.shift || 0);
    while (m < c - 9) m += 12;
    while (m > c + 9) m -= 12;
    return m;
  }

  async function noteOn(id, midi) {
    if (held.has(id) || !sylls.length) return;
    await app.ensureAudio();
    const s = sylls[pos];
    const prev = held.size ? null : null;
    held.set(id, { pos, midi });
    app.setLiveParsed(parsed);
    const first = pos === 0 || sylls[pos - 1].word !== s.word;
    for (const h of app.song.heads) {
      if (h.role === 'lead') app.player.liveOn(h, s, midi, app.song.lang, prev, first ? s.word : -1);
      else if (h.role === 'harmony') app.player.liveOn(h, s, fit(harmonyFor(midi, h), h), app.song.lang, prev, first ? s.word : -1);
    }
    document.querySelector(`.kbd .k[data-s="${midi - base - octave * 12}"]`)?.classList.add('down');
    if (rec) rec.ev.push({ pos, midi, t: performance.now(), end: null });
    pos = (pos + 1) % sylls.length;
    renderStream();
  }
  function noteOff(id) {
    const hd = held.get(id);
    if (!hd) return;
    held.delete(id);
    document.querySelector(`.kbd .k[data-s="${hd.midi - base - octave * 12}"]`)?.classList.remove('down');
    if (rec) { const ev = [...rec.ev].reverse().find((x) => x.pos === hd.pos && x.end === null); if (ev) ev.end = performance.now(); }
    if (held.size) return;
    const s = sylls[hd.pos];
    for (const h of app.song.heads) if (h.role === 'lead' || h.role === 'harmony') app.player.liveOff(h, s, app.song.lang);
  }

  kbd.addEventListener('pointerdown', (e) => {
    const k = e.target.closest('.k');
    if (!k) return;
    kbd.setPointerCapture(e.pointerId);
    noteOn('p' + e.pointerId, base + octave * 12 + +k.dataset.s);
  });
  const up = (e) => noteOff('p' + e.pointerId);
  kbd.addEventListener('pointerup', up);
  kbd.addEventListener('pointercancel', up);

  const onKey = (e) => {
    if (!keysOn) return;
    const tag = (e.target.tagName || '').toLowerCase();
    if (tag === 'textarea' || tag === 'input' || e.metaKey || e.ctrlKey) return;
    const i = KEYMAP.indexOf(e.key.toLowerCase());
    if (e.key === 'z' || e.key === 'x') { if (e.type === 'keydown') { octave = Math.max(-2, Math.min(2, octave + (e.key === 'z' ? -1 : 1))); buildKeys(); renderStatus(); } e.preventDefault(); e.stopPropagation(); return; }
    if (i < 0) return;
    e.preventDefault(); e.stopPropagation();
    if (e.type === 'keydown' && !e.repeat) noteOn('k' + i, base + octave * 12 + i);
    if (e.type === 'keyup') noteOff('k' + i);
  };
  window.addEventListener('keydown', onKey, true);
  window.addEventListener('keyup', onKey, true);

  let midiAccess = null;
  if (navigator.requestMIDIAccess) {
    navigator.requestMIDIAccess().then((acc) => {
      midiAccess = acc;
      const hook = () => {
        const names = [];
        acc.inputs.forEach((inp) => { names.push(inp.name); inp.onmidimessage = (m) => {
          const [st, n, v] = m.data;
          const cmd = st & 0xf0;
          if (cmd === 0x90 && v > 0) noteOn('m' + n, n);
          else if (cmd === 0x80 || (cmd === 0x90 && v === 0)) noteOff('m' + n);
        }; });
        midiState = names.length ? 'MIDI: ' + names.join(', ') : L.midiNone;
        renderStatus();
      };
      hook();
      acc.onstatechange = hook;
    }).catch(() => { midiState = L.midiNone; renderStatus(); });
  }

  async function startRec() {
    await app.ensureAudio();
    rec = { ev: [], startPos: pos, t0: null, backing: app.startBacking() };
    rec.t0 = rec.backing ? rec.backing.t0Perf : null;
    renderRow(); renderStatus();
  }
  function stopRec() {
    const r = rec;
    rec = null;
    app.stopAll();
    renderRow(); renderStatus();
    if (!r || !r.ev.length) return;
    const spb = app.spb();
    const t0 = r.t0 ?? r.ev[0].t;
    const evs = r.ev.map((e) => {
      const end = e.end ?? e.t + 400;
      const b = Math.max(0, Math.round(((e.t - t0) / 1000 / spb) * 4) / 4);
      const d = Math.max(0.25, Math.round(((end - e.t) / 1000 / spb) * 4) / 4);
      return { ...e, b, d };
    });
    const n = app.saveRecording(parsed, sylls, evs);
    app.toast(L.recorded(n));
  }

  load();
  return {
    refresh: load,
    frame() {},
    destroy() {
      window.removeEventListener('keydown', onKey, true);
      window.removeEventListener('keyup', onKey, true);
      if (midiAccess) midiAccess.inputs.forEach((i) => { i.onmidimessage = null; });
      for (const id of [...held.keys()]) noteOff(id);
      if (rec) stopRec();
    },
  };
}
