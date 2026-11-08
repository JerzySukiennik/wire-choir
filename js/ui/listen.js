// Wire Choir listen window: record from the microphone or open a file, hear its instruments, words and language, then rebuild the song and the heads.
import { analyze, toMono, overview, busiestWindow, LSR } from '../listen.js';
import { instruments, words as hearWords, resample, guessLang, GENRES, INSTRUMENT_FAMILIES } from '../listen-ml.js';
import { parseLyrics, prepareLang } from '../lyrics.js';
import { lineIds } from '../composer.js';
import { PRESETS, LOOKS, INSTS, applyInst } from '../voices.js';

const MAX_REC = 60;

function lyricSyls(text, lang) {
  const p = parseLyrics(text, lang);
  const syls = [];
  p.words.forEach((w, wi) => w.syls.forEach((s, k) => syls.push({ stress: s.stress || 0, word: wi, first: k === 0, last: k === w.syls.length - 1, text: w.text })));
  return syls;
}

function accent(b, d) {
  const pos = ((b % 1) + 1) % 1;
  return Math.min(1.5, d) + (pos < 1e-6 ? 0.12 : Math.abs(pos - 0.5) < 1e-6 ? 0.08 : 0);
}

function sylScore(syl, acc) {
  return syl.stress >= 0.5 ? acc : (0.6 - acc) * 0.6;
}

function alignPhrase(ns, L, j0) {
  const N = ns.length, S = L.length;
  const NEG = -1e9;
  const score = Array.from({ length: N + 1 }, () => new Float64Array(S).fill(NEG));
  const back = Array.from({ length: N + 1 }, () => new Array(S).fill(null));
  score[0][j0] = 0;
  for (let i = 0; i < N; i++) for (let j = 0; j < S; j++) {
    const cur = score[i][j];
    if (cur === NEG) continue;
    const n = ns[i], s0 = L[j], j1 = (j + 1) % S;
    const go = (ni, nj, v, kind) => { if (v > score[ni][nj]) { score[ni][nj] = v; back[ni][nj] = { i, j, kind }; } };
    go(i + 1, j1, cur + sylScore(s0, accent(n.b, n.d)), 1);
    if (i + 1 < N && ns[i + 1].b - (n.b + n.d) < 0.3) {
      const e = ns[i + 1];
      go(i + 2, j1, cur + sylScore(s0, accent(n.b, e.b + e.d - n.b)) - 0.45, 2);
    }
    if (n.d >= 0.5) {
      const h = Math.round((n.d / 2) * 4) / 4;
      go(i + 1, (j + 2) % S, cur + sylScore(s0, accent(n.b, h)) + sylScore(L[j1], accent(n.b + h, n.d - h)) - 0.35, 3);
    }
  }
  let bj = -1, bs = NEG;
  for (let j = 0; j < S; j++) {
    if (score[N][j] === NEG) continue;
    const prevLast = L[(j - 1 + S) % S].last;
    if (!prevLast) continue;
    const v = score[N][j] + (j === 0 ? 0.6 : 0);
    if (v > bs) { bs = v; bj = j; }
  }
  if (bj < 0) return null;
  const out = [];
  let i = N, j = bj;
  while (i > 0) {
    const bk = back[i][j];
    const n = ns[bk.i];
    if (bk.kind === 1) out.push({ b: n.b, d: n.d, m: n.m, j: bk.j });
    else if (bk.kind === 2) { const e = ns[bk.i + 1]; out.push({ b: n.b, d: e.b + e.d - n.b, m: n.d >= e.d ? n.m : e.m, j: bk.j }); }
    else { const h = Math.round((n.d / 2) * 4) / 4; out.push({ b: n.b + h, d: n.d - h, m: n.m, j: (bk.j + 1) % S }, { b: n.b, d: h, m: n.m, j: bk.j }); }
    i = bk.i; j = bk.j;
  }
  out.reverse();
  return { items: out, end: bj };
}

function placeLines(lines, bars) {
  lines.forEach((ln, k) => {
    const end = k + 1 < lines.length ? lines[k + 1].bar : Math.max(bars, ln.bar + 1);
    ln.bars = Math.max(1, end - ln.bar);
    ln.notes = ln.items.map((it) => ({ b: it.b - ln.bar * 4, d: it.d, m: it.m }));
  });
  return lines;
}

function openLine(lines, b) {
  const mbar = Math.floor((b + 1) / 4);
  const prev = lines.length ? lines[lines.length - 1].bar : -1;
  const ln = { items: [], words: [], mbar, bar: lines.length ? Math.max(prev + 1, mbar) : 0 };
  lines.push(ln);
  return ln;
}

function buildLines(melody, bars, words, lang) {
  const notes = melody.slice().sort((a, b) => a.b - b.b);
  const L = words.trim() ? lyricSyls(words.replace(/\n+/g, ' '), lang) : [{ stress: 1, word: 0, first: true, last: true, text: 'la' }];
  const S = L.length;
  const short = S <= 8;
  const items = [];
  let i = 0, jPrev = 0;
  while (i < notes.length) {
    let k = i + 1;
    while (k < notes.length && notes[k].b - (notes[k - 1].b + notes[k - 1].d) < 1) k++;
    const a = alignPhrase(notes.slice(i, k), L, short ? 0 : jPrev);
    if (a) { a.items.forEach((it, x) => items.push({ ...it, ph: x === 0 })); jPrev = a.end; }
    i = k;
  }
  const lines = [];
  const target = short ? 1 : 2;
  let cur = null;
  for (const it of items) {
    const unitStart = it.j === 0;
    const wordStart = L[it.j].first;
    const span = cur ? it.b - cur.items[0].b : 0;
    if (!cur || it.ph || (unitStart && it.b + 1 >= (cur.mbar + target) * 4) || (wordStart && span >= 12)) cur = openLine(lines, it.b);
    cur.items.push(it);
  }
  lines.forEach((ln) => { ln.text = ln.items.filter((it) => L[it.j].first).map((it) => L[it.j].text).join(' '); });
  return placeLines(lines, bars);
}

const q4 = (b) => Math.round(b * 4) / 4;

function timedLines(A, heard, lang) {
  const spb = 60 / A.bpm;
  const mel = A.melody.slice().sort((a, b) => a.b - b.b);
  const used = new Set();
  const nearPitch = (b) => {
    let best = null, bd = 1e9;
    for (const n of mel) { const d = Math.abs(n.b - b); if (d < bd) { bd = d; best = n; } }
    return best ? best.m : 57;
  };
  const items = [];
  let lastEnd = -1;
  for (const w of heard) {
    const syls = lyricSyls(w.text, lang);
    const b0 = (w.t0 - A.start) / spb, b1 = (w.t1 - A.start) / spb;
    if (b1 < -0.25 || b0 > A.bars * 4 - 0.25) continue;
    if (!syls.length) { items.push({ word: w.text, notes: [], b: q4(b0) }); continue; }
    const S = syls.length;
    let ns = mel.filter((n) => !used.has(n) && n.b >= b0 - 0.3 && n.b < Math.max(b0 + 0.2, b1 - 0.1));
    ns.forEach((n) => used.add(n));
    ns = ns.map((n) => ({ b: n.b, d: n.d, m: n.m }));
    if (!ns.length) {
      const start = Math.max(q4(b0), lastEnd), d = Math.max(0.25, q4((Math.max(b1, b0 + 0.25 * S) - start) / S));
      for (let k = 0; k < S; k++) ns.push({ b: start + k * d, d, m: nearPitch(start + k * d) });
    }
    while (ns.length > S) {
      let bi = 0, bs = 1e9;
      for (let k = 0; k < ns.length - 1; k++) { const s = ns[k].d + ns[k + 1].d; if (s < bs) { bs = s; bi = k; } }
      const a = ns[bi], c = ns[bi + 1];
      ns.splice(bi, 2, { b: a.b, d: c.b + c.d - a.b, m: a.d >= c.d ? a.m : c.m });
    }
    while (ns.length < S) {
      let bi = 0, bd = 0;
      ns.forEach((n, k) => { if (n.d > bd) { bd = n.d; bi = k; } });
      const n = ns[bi];
      if (n.d >= 0.5) { const h = q4(n.d / 2); ns.splice(bi, 1, { b: n.b, d: h, m: n.m }, { b: n.b + h, d: n.d - h, m: n.m }); }
      else { const last = ns[ns.length - 1]; ns.push({ b: last.b + last.d, d: 0.25, m: last.m }); }
    }
    for (const n of ns) {
      n.b = q4(n.b);
      if (n.b < lastEnd) n.b = lastEnd;
      n.d = Math.max(0.25, q4(n.d));
      lastEnd = n.b + n.d;
    }
    items.push({ word: w.text, notes: ns, b: ns[0].b, end: lastEnd, punct: /[,.!?;:]$/.test(w.text) });
  }
  const unit = lyricUnit(heard.map((w) => w.text));
  if (unit) {
    const Lu = lyricSyls(unit, lang);
    const sung = items.filter((it) => it.notes.length);
    const gaps = [];
    let from = -1;
    for (const it of sung) { if (it.b - from >= 2) gaps.push([from + 0.25, it.b - 0.25]); from = it.end; }
    gaps.push([from + 0.25, A.bars * 4]);
    const spans = sung.map((it) => [it.b - 0.25, it.end + 0.25]);
    const free = mel.filter((n) => !used.has(n) && gaps.some(([x, y]) => n.b >= x && n.b + Math.min(n.d, 0.5) <= y + 0.01));
    let i = 0;
    while (Lu.length && i < free.length) {
      let k = i + 1;
      while (k < free.length && free[k].b - (free[k - 1].b + free[k - 1].d) < 1 && !spans.some(([x, y]) => x > free[k - 1].b && x < free[k].b)) k++;
      if (k - i >= 3) {
        const al = alignPhrase(free.slice(i, k), Lu, 0);
        if (al) {
          let w = null;
          for (const n of al.items) {
            const sy = Lu[n.j];
            if (sy.first || !w) { w = { word: sy.text, notes: [], b: q4(n.b), filled: true }; items.push(w); }
            w.notes.push({ b: q4(n.b), d: Math.max(0.25, q4(n.d)), m: n.m });
            if (n.j === Lu.length - 1) w.punct = true;
            w.end = w.notes[w.notes.length - 1].b + w.notes[w.notes.length - 1].d;
          }
        }
      }
      i = k;
    }
    items.sort((x, y) => x.b - y.b);
  }
  const lines = [];
  let cur = null, prevEnd = -99, prevPunct = false;
  for (const it of items) {
    if (!it.notes.length) { if (cur) cur.words.push(it.word); continue; }
    const span = cur && cur.items.length ? it.b - cur.items[0].b : 0;
    if (!cur || it.b - prevEnd >= 1 || (prevPunct && span >= 3) || span >= 7.5) cur = openLine(lines, it.b);
    cur.words.push(it.word);
    for (const n of it.notes) cur.items.push(n);
    prevEnd = it.end;
    prevPunct = !!it.punct;
  }
  lines.forEach((ln) => { ln.text = ln.words.join(' ').replace(/\s+/g, ' ').trim(); });
  return placeLines(lines.filter((l) => l.items.length), A.bars);
}

function lyricUnit(list) {
  const w = list.map((x) => x.toLowerCase().replace(/[^\p{L}\p{N}']/gu, '')).filter(Boolean);
  if (w.length < 3) return w.length ? list.join(' ') : '';
  for (let p = 1; p <= 8 && p * 2 <= w.length; p++) {
    let hit = 0;
    for (let i = 0; i + p < w.length; i++) if (w[i] === w[i + p]) hit++;
    if (hit / (w.length - p) >= 0.6) {
      const counts = {};
      for (let i = 0; i + p <= w.length; i++) { const k = w.slice(i, i + p).join(' '); counts[k] = (counts[k] || 0) + 1; }
      const best = Math.max(...Object.values(counts)), lead = w.slice(0, p).join(' ');
      return (counts[lead] || 0) >= best * 0.8 ? lead : Object.entries(counts).sort((a, b) => b[1] - a[1])[0][0];
    }
  }
  return '';
}

function median(a) { if (!a.length) return 57; const s = a.slice().sort((x, y) => x - y); return s[Math.floor(s.length / 2)]; }

function setVoice(h, preset) {
  const p = PRESETS[preset];
  Object.assign(h, { preset, lo: p.lo, hi: p.hi, tract: p.tract, rd: p.rd, breath: p.breath, vib: p.vib, rough: p.rough, shift: 0 });
}
function setLook(h, look) {
  h.look = look;
  const v = (LOOKS[look] || {}).voice;
  if (v) Object.assign(h, v);
}

export function autoHeads(A, heard, opts, newHead) {
  const fam = heard ? heard.fam : {};
  const vox = fam.vocals || 0;
  const heads = [];
  const add = (role, inst) => { if (heads.length >= 6) return null; const h = newHead(role, heads.length, inst); heads.push(h); return h; };
  const med = median(A.melody.map((n) => n.m));
  const lead = add('lead');
  setVoice(lead, med < 50 ? 'bass' : med < 56 ? 'baritone' : med < 61 ? 'tenor' : med < 67 ? 'alto' : 'soprano');
  const robot = heard && ((fam.robot || 0) > Math.max(0.002, vox * 0.25) || heard.electronic);
  if ((fam.whisper || 0) > Math.max(0.003, vox * 0.5)) setLook(lead, 'ghost');
  else if (robot) setLook(lead, 'robot');
  lead.volume = 1.5;
  if ((fam.choir || 0) > Math.max(0.004, vox * 0.4)) { const h = add('harmony'); if (h) { setVoice(h, med < 58 ? 'tenor' : 'alto'); h.harm = 'up3'; } }
  if (opts.bass && A.bass.length >= 8) {
    const h = add('bass');
    if (h && heard && (heard.electronic || (fam.synth || 0) > (fam.bass || 0))) setLook(h, 'robot');
    if (h) h.volume = 1.15;
  }
  if (opts.drums && A.drums.length) { add('beatbox'); if (A.drums.length > A.bars * 4) add('beatbox'); }
  if (heard) {
    const fams = INSTRUMENT_FAMILIES.map((k) => [k, fam[k] || 0]).sort((a, b) => b[1] - a[1]);
    const top = fams[0][1];
    let first = true;
    for (const [k, v] of fams) {
      if (heads.length >= 6 || v < Math.max(0.003, top * 0.3)) break;
      const h = add('inst', k);
      if (!h) break;
      if (first && A.riff && A.riff.length) h.riff = true;
      first = false;
    }
  }
  return heads;
}

export function songFromAnalysis(A, prev, opts) {
  const lang = opts.lang;
  const lines = opts.timed && opts.timed.length ? timedLines(A, opts.timed, lang) : buildLines(A.melody, A.bars, opts.words || '', lang);
  if (!lines.length) return null;
  const parsed = parseLyrics(lines.map((l) => l.text).join('\n'), lang);
  const ids = lineIds(parsed);
  const melody = {};
  lines.forEach((l, i) => {
    const pl = parsed.lines[i];
    if (!pl || pl.syls.length !== l.notes.length) return;
    melody[ids[i]] = { bars: l.bars, notes: l.notes.map((n, k) => ({ i: k, b: +n.b.toFixed(3), d: +n.d.toFixed(3), m: n.m })) };
  });
  let bpm = Math.round(A.bpm);
  while (bpm > 168) bpm = Math.round(bpm / 2);
  while (bpm < 56) bpm *= 2;
  const track = {
    bars: A.bars,
    chords: A.chords.map((c) => [c[0], c[1]]),
    bass: opts.bass ? A.bass.map((n) => [n.b, n.d, n.m]) : [],
    drums: opts.drums ? A.drums.map((d) => [d.b, d.type, d.amp]) : [],
    riff: (A.riff || []).map((n) => [n.b, n.d, n.m]),
    src: opts.src,
  };
  return {
    v: 1, lang, mood: A.mode === 'minor' ? 'dark' : 'happy', key: A.key, bpm, seed: prev.seed || 7,
    lines: lines.map((l) => ({ text: l.text, singers: [] })), heads: (opts.heads || prev.heads).map((h) => ({ ...h })), melody, track,
  };
}

export function mountListen(body, app) {
  const L = app.t();
  const st = { x: null, name: '', start: 0, len: 30, lang: 'auto', bass: true, drums: true, hearWords: true, autoHeads: true, busy: false, stage: '', rec: null, undo: null, result: '', heard: null, asr: null };
  body.innerHTML = '';
  const el = (tag, cls, html) => { const d = document.createElement(tag); if (cls) d.className = cls; if (html != null) d.innerHTML = html; return d; };
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const lbl = (text, val) => el('div', 'lbl', `<span>${text}</span><b>${val ?? ''}</b>`);
  const chips = (items, isOn, on) => {
    const d = el('div', 'chips');
    for (const [v, label] of items) {
      const b = document.createElement('button');
      b.textContent = label;
      if (isOn(v)) b.classList.add('on');
      b.addEventListener('click', () => { on(v); draw(); });
      d.appendChild(b);
    }
    return d;
  };

  body.appendChild(el('p', 'note', L.lsNote)).style.marginTop = '0';
  const src = el('div', 'row2');
  const micBtn = el('button', 'btn');
  const fileBtn = el('button', 'btn', L.lsFile);
  const fileIn = document.createElement('input');
  fileIn.type = 'file'; fileIn.accept = 'audio/*,video/mp4,video/quicktime,.mp3,.m4a,.wav,.aac,.ogg,.flac'; fileIn.hidden = true;
  src.append(micBtn, fileBtn, fileIn);
  body.appendChild(src);
  const meter = el('div', 'prog lsmeter', '<i></i>');
  const wave = document.createElement('canvas');
  wave.className = 'lswave';
  const waveInfo = el('div', 'lbl');
  const lenRow = el('div');
  const hearRow = el('div');
  const wordsLbl = lbl(L.lsWords);
  const words = document.createElement('textarea');
  words.className = 'lswords'; words.rows = 3; words.spellcheck = false; words.placeholder = L.lsWordsPh;
  words.addEventListener('keydown', (e) => e.stopPropagation());
  const langRow = el('div');
  const partRow = el('div');
  const go = el('button', 'btn pri', L.lsGo);
  const goRow = el('div', 'row2');
  const undo = el('button', 'btn quiet', L.lsUndo);
  goRow.append(go, undo);
  const prog = el('div', 'prog', '<i></i>');
  const heardBox = el('div', 'lsheard');
  const res = el('p', 'note');
  body.append(meter, wave, waveInfo, lenRow, hearRow, wordsLbl, words, langRow, partRow, goRow, heardBox, res);

  function drawWave() {
    const W = Math.max(200, wave.clientWidth || 300), H = 54, dpr = Math.min(2, window.devicePixelRatio || 1);
    wave.width = W * dpr; wave.height = H * dpr;
    const g = wave.getContext('2d');
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.clearRect(0, 0, W, H);
    if (!st.x) return;
    const ov = overview(st.x, W);
    let mx = 1e-6;
    for (const v of ov) if (v > mx) mx = v;
    const dur = st.x.length / LSR;
    const a = (st.start / dur) * W, b = (Math.min(dur, st.start + st.len) / dur) * W;
    g.fillStyle = 'rgba(255,255,255,0.06)';
    g.fillRect(a, 0, b - a, H);
    for (let i = 0; i < W; i++) {
      const h = (ov[i] / mx) * (H - 6);
      g.fillStyle = i >= a && i <= b ? app.headColor() : '#3a3a3c';
      g.fillRect(i, (H - h) / 2, 1, Math.max(1, h));
    }
  }
  let dragW = false;
  const pickAt = (e) => {
    if (!st.x) return;
    const r = wave.getBoundingClientRect();
    const dur = st.x.length / LSR;
    const t = ((e.clientX - r.left) / r.width) * dur - st.len / 2;
    st.start = Math.max(0, Math.min(Math.max(0, dur - st.len), t));
    draw();
  };
  wave.addEventListener('pointerdown', (e) => { if (st.busy) return; dragW = true; wave.setPointerCapture(e.pointerId); pickAt(e); });
  wave.addEventListener('pointermove', (e) => { if (dragW) pickAt(e); });
  wave.addEventListener('pointerup', () => { dragW = false; });

  function heardHTML() {
    const h = st.heard;
    if (!h) return '';
    const pl = L.lsHeard === 'Słyszę';
    const parts = [];
    if (h.voice) parts.push(L.lsVoice[h.voice]);
    if (h.bass) parts.push(L.lsBass);
    if (h.drums) parts.push(L.lsDrumsHeard);
    if (h.inst) {
      const fam = h.inst.fam;
      const fams = INSTRUMENT_FAMILIES.map((k) => [k, fam[k] || 0]).sort((a, b) => b[1] - a[1]);
      const top = fams[0][1];
      for (const [k, v] of fams) if (v >= Math.max(0.003, top * 0.3)) parts.push(INSTS[k][pl ? 'pl' : 'en']);
    }
    const gen = h.inst && h.inst.genres.length ? h.inst.genres.map((g) => GENRES[g][pl ? 0 : 1]).join(', ') : '';
    const lang = h.lang ? (h.lang === 'pl' ? 'Polski' : 'English') : '';
    return `<div class="lbl"><span>${L.lsHeard}</span><b>${esc([gen, lang].filter(Boolean).join(' · '))}</b></div><div class="chips">${parts.map((p) => `<button tabindex="-1">${esc(p)}</button>`).join('')}</div>`;
  }

  function fmt(s) { s = Math.max(0, s); return Math.floor(s / 60) + ':' + String(Math.floor(s % 60)).padStart(2, '0'); }
  function draw() {
    const rec = !!st.rec;
    micBtn.className = 'btn' + (rec ? ' rec' : '');
    micBtn.textContent = rec ? '■ ' + L.lsStop + ' ' + fmt(st.rec.t) : '● ' + L.lsMic;
    micBtn.disabled = st.busy;
    fileBtn.disabled = st.busy || rec;
    meter.style.display = rec ? '' : 'none';
    const has = !!st.x && !rec;
    wave.style.display = has ? '' : 'none';
    waveInfo.style.display = has ? '' : 'none';
    lenRow.style.display = has ? '' : 'none';
    if (has) {
      const dur = st.x.length / LSR;
      waveInfo.innerHTML = `<span>${esc(st.name)}</span><b>${fmt(st.start)} – ${fmt(Math.min(dur, st.start + st.len))} / ${fmt(dur)}</b>`;
      lenRow.innerHTML = '';
      lenRow.append(lbl(L.lsPart, L.lsDrag), chips([[15, '15 s'], [30, '30 s'], [45, '45 s'], [60, '60 s']], (v) => v === st.len, (v) => {
        st.len = v;
        st.start = Math.max(0, Math.min(st.start, dur - v));
      }));
      requestAnimationFrame(drawWave);
    }
    hearRow.innerHTML = '';
    hearRow.append(lbl(L.lsRecognize), chips([['hearWords', L.lsWordsOpt], ['autoHeads', L.lsHeadsOpt]], (v) => st[v], (v) => { st[v] = !st[v]; }));
    langRow.innerHTML = '';
    langRow.append(lbl(L.lsLang), chips([['auto', L.lsAuto], ['pl', 'Polski'], ['en', 'English']], (v) => v === st.lang, (v) => { st.lang = v; }));
    partRow.innerHTML = '';
    partRow.append(lbl(L.lsAlso), chips([['bass', L.lsBass], ['drums', L.lsDrums]], (v) => st[v], (v) => { st[v] = !st[v]; }));
    go.disabled = !has || st.busy;
    go.textContent = st.busy ? st.stage || L.lsBusy : L.lsGo;
    undo.style.display = st.undo && !st.busy ? '' : 'none';
    heardBox.innerHTML = heardHTML();
    res.textContent = st.result || (has ? L.lsReplace : '');
  }

  async function setAudio(buffer, name) {
    const x = await toMono(buffer);
    if (x.length < LSR * 6) { app.toast(L.lsShort, 3200); return; }
    st.x = x; st.name = name;
    st.len = Math.min(st.len, Math.max(15, Math.floor(x.length / LSR)));
    if (x.length / LSR <= st.len) st.len = Math.floor(x.length / LSR);
    st.start = busiestWindow(x, st.len);
    st.result = '';
    st.asr = null;
    st.heard = null;
    if (words.value === (st.asrText || '')) words.value = '';
    draw();
  }

  micBtn.addEventListener('click', async () => {
    if (st.rec) { st.rec.stop(); return; }
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia || typeof MediaRecorder === 'undefined') { app.toast(L.lsNoMic, 4200); return; }
    await app.ensureAudio();
    app.stopAll();
    let stream;
    try { stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false, channelCount: 1 } }); }
    catch (e) { app.toast(L.lsNoMic, 4200); return; }
    const ctx = app.sys.ctx;
    const srcNode = ctx.createMediaStreamSource(stream);
    const an = ctx.createAnalyser();
    an.fftSize = 1024;
    srcNode.connect(an);
    const buf = new Float32Array(an.fftSize);
    const types = ['audio/webm;codecs=opus', 'audio/mp4', 'audio/webm', ''];
    const mime = types.find((m) => !m || MediaRecorder.isTypeSupported(m));
    const mr = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
    const chunks = [];
    mr.ondataavailable = (e) => { if (e.data.size) chunks.push(e.data); };
    const t0 = performance.now();
    let raf = 0;
    const rec = { t: 0, stop: () => { if (mr.state !== 'inactive') mr.stop(); } };
    st.rec = rec;
    const tickRec = () => {
      an.getFloatTimeDomainData(buf);
      let pk = 0;
      for (const v of buf) pk = Math.max(pk, Math.abs(v));
      meter.firstChild.style.width = Math.min(100, Math.round(Math.sqrt(pk) * 110)) + '%';
      const t = (performance.now() - t0) / 1000;
      if (Math.floor(t) !== Math.floor(rec.t)) { rec.t = t; draw(); } else rec.t = t;
      if (t >= MAX_REC) rec.stop();
      raf = requestAnimationFrame(tickRec);
    };
    mr.onstop = async () => {
      cancelAnimationFrame(raf);
      stream.getTracks().forEach((tr) => tr.stop());
      srcNode.disconnect();
      st.rec = null;
      draw();
      try {
        const blob = new Blob(chunks, { type: mr.mimeType || mime || 'audio/webm' });
        const ab = await blob.arrayBuffer();
        const buffer = await ctx.decodeAudioData(ab);
        await setAudio(buffer, L.lsMicName);
      } catch (e) { app.toast(L.lsBadFile, 4200); }
    };
    mr.start(250);
    draw();
    tickRec();
  });

  fileBtn.addEventListener('click', () => fileIn.click());
  fileIn.addEventListener('change', async () => {
    const f = fileIn.files && fileIn.files[0];
    fileIn.value = '';
    if (!f) return;
    st.busy = true; draw();
    try {
      await app.ensureAudio();
      const buffer = await app.sys.ctx.decodeAudioData(await f.arrayBuffer());
      st.busy = false;
      await setAudio(buffer, f.name.replace(/\.[^.]+$/, ''));
    } catch (e) { st.busy = false; app.toast(L.lsBadFile, 4200); }
    draw();
  });

  const stage = (name, p, setP) => { st.stage = name; if (p != null) setP(p); draw(); };

  go.addEventListener('click', async () => {
    if (!st.x || st.busy) return;
    st.busy = true; st.result = ''; draw();
    body.insertBefore(prog, heardBox);
    const setP = (v) => { prog.firstChild.style.width = Math.round(v * 100) + '%'; };
    setP(0);
    try {
      app.stopAll();
      const a = Math.floor(st.start * LSR), b = Math.min(st.x.length, Math.floor((st.start + st.len) * LSR));
      const clip = st.x.subarray(a, b);
      const clipKey = st.name + ':' + st.start.toFixed(2) + ':' + st.len + ':' + st.lang;
      stage(L.lsStageBeat, 0, setP);
      const A = await analyze(clip, { onProgress: (v) => setP(v * 0.3) });
      let x16 = null;
      const need16 = st.autoHeads || st.hearWords;
      if (need16) x16 = await resample(new Float32Array(clip), LSR, 16000);
      let inst = null;
      if (st.autoHeads) {
        stage(L.lsStageInst, 0.32, setP);
        try { inst = await instruments(x16); } catch (e) { inst = null; }
      }
      const typed = words.value.trim();
      const edited = typed && typed !== (st.asrText || '').trim();
      let timed = null, lang = st.lang === 'auto' ? null : st.lang;
      if (st.hearWords && !edited) {
        if (st.asr && st.asr.key === clipKey) timed = st.asr.words;
        else {
          stage(L.lsStageModel, 0.4, setP);
          try {
            const w = await hearWords(x16, (v) => { if (v < 1) { st.stage = L.lsStageModel + ' ' + Math.round(v * 100) + '%'; draw(); setP(0.4 + v * 0.2); } else stage(L.lsStageWords, 0.62, setP); }, st.lang, app.song.lang === 'pl' || (navigator.languages || [navigator.language || '']).some((l) => /^pl/i.test(l)));
            st.asr = { key: clipKey, words: w.words, lang: w.lang, text: w.text };
            timed = w.words;
          } catch (e) { console.warn(e); st.asr = null; }
        }
        if (!lang && st.asr && st.asr.words.length) lang = st.asr.lang;
      }
      if (!lang) lang = typed ? guessLang(typed) : app.song.lang;
      await prepareLang(lang);
      stage(L.lsStageBuild, 0.95, setP);
      if (A.melody.length < 4 && !(timed && timed.length)) { st.result = L.lsNoMelody; }
      else {
        const prev = JSON.parse(JSON.stringify(app.song));
        const opts = { words: edited || !timed || !timed.length ? typed : '', timed: edited ? null : timed, lang, bass: st.bass, drums: st.drums, src: st.name === L.lsMicName ? 'mic' : 'file' };
        if (st.autoHeads) opts.heads = autoHeads(A, inst, opts, app.newHead);
        const next = songFromAnalysis(A, prev, opts);
        if (!next) st.result = L.lsNoMelody;
        else {
          if (!st.autoHeads) app.ensureRoles(next, { bass: st.bass, drums: st.drums });
          st.undo = prev;
          if (opts.timed && opts.timed.length) { st.asrText = next.lines.map((l) => l.text).join('\n'); words.value = st.asrText; }
          const lead = next.heads.find((h) => h.role === 'lead');
          st.heard = { inst, lang, voice: lead ? (lead.look === 'robot' ? 'robot' : lead.look === 'ghost' ? 'ghost' : lead.lo < 50 ? 'low' : 'voice') : null, bass: next.track.bass.length > 0, drums: next.track.drums.length > 0 };
          app.replaceSong(next);
          st.result = L.lsDone(A, next.lines.length);
          app.toast(L.lsReady, 2600);
          setTimeout(() => app.playFromStart(), 250);
        }
      }
    } catch (e) {
      st.result = e && e.message === 'silent' ? L.lsQuiet : L.exportFail + ' ' + (e && e.message);
    }
    prog.remove();
    st.busy = false;
    st.stage = '';
    draw();
  });

  undo.addEventListener('click', () => {
    if (!st.undo) return;
    app.stopAll();
    app.replaceSong(st.undo);
    st.undo = null;
    st.result = '';
    app.toast(L.lsUndone);
    draw();
  });

  draw();
  return {
    refresh() { draw(); },
    frame() {},
    destroy() { if (st.rec) st.rec.stop(); },
  };
}
