// Wire Choir listen window: record from the microphone or open a file, then rebuild the song (tempo, melody, bass, beat, chords) for the heads.
import { analyze, toMono, overview, busiestWindow, LSR } from '../listen.js';
import { parseLyrics, prepareLang } from '../lyrics.js';
import { lineIds } from '../composer.js';

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
    if (!cur || it.ph || (unitStart && it.b + 1 >= (cur.mbar + target) * 4) || (wordStart && span >= 12)) {
      const mbar = Math.floor((it.b + 1) / 4);
      const prev = lines.length ? lines[lines.length - 1].bar : -1;
      cur = { items: [], mbar, bar: lines.length ? Math.max(prev + 1, mbar) : 0 };
      lines.push(cur);
    }
    cur.items.push(it);
  }
  lines.forEach((ln) => { ln.text = ln.items.filter((it) => L[it.j].first).map((it) => L[it.j].text).join(' '); });
  lines.forEach((ln, k) => {
    const end = k + 1 < lines.length ? lines[k + 1].bar : Math.max(bars, ln.bar + 1);
    ln.bars = Math.max(1, end - ln.bar);
    ln.notes = ln.items.map((it) => ({ b: it.b - ln.bar * 4, d: it.d, m: it.m }));
  });
  return lines;
}

export function songFromAnalysis(A, prev, opts) {
  const lang = opts.lang;
  const lines = buildLines(A.melody, A.bars, opts.words || '', lang);
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
    src: opts.src,
  };
  return {
    v: 1, lang, mood: A.mode === 'minor' ? 'dark' : 'happy', key: A.key, bpm, seed: prev.seed || 7,
    lines: lines.map((l) => ({ text: l.text, singers: [] })), heads: prev.heads.map((h) => ({ ...h })), melody, track,
  };
}

export function mountListen(body, app) {
  const L = app.t();
  const st = { x: null, name: '', start: 0, len: 30, words: '', lang: app.song.lang, bass: true, drums: true, busy: false, rec: null, undo: null, result: '' };
  body.innerHTML = '';
  const el = (tag, cls, html) => { const d = document.createElement(tag); if (cls) d.className = cls; if (html != null) d.innerHTML = html; return d; };
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
  const wordsLbl = lbl(L.lsWords);
  const words = document.createElement('textarea');
  words.className = 'lswords'; words.rows = 2; words.spellcheck = false; words.placeholder = L.lsWordsPh;
  words.addEventListener('input', () => { st.words = words.value; });
  words.addEventListener('keydown', (e) => e.stopPropagation());
  const langRow = el('div');
  const partRow = el('div');
  const go = el('button', 'btn pri', L.lsGo);
  const goRow = el('div', 'row2');
  const undo = el('button', 'btn quiet', L.lsUndo);
  goRow.append(go, undo);
  const prog = el('div', 'prog', '<i></i>');
  const res = el('p', 'note');
  body.append(meter, wave, waveInfo, lenRow, wordsLbl, words, langRow, partRow, goRow, res);

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
  wave.addEventListener('pointerdown', (e) => { dragW = true; wave.setPointerCapture(e.pointerId); pickAt(e); });
  wave.addEventListener('pointermove', (e) => { if (dragW) pickAt(e); });
  wave.addEventListener('pointerup', () => { dragW = false; });

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
      waveInfo.innerHTML = `<span>${st.name}</span><b>${fmt(st.start)} – ${fmt(Math.min(dur, st.start + st.len))} / ${fmt(dur)}</b>`;
      lenRow.innerHTML = '';
      lenRow.append(lbl(L.lsPart, L.lsDrag), chips([[15, '15 s'], [30, '30 s'], [45, '45 s'], [60, '60 s']], (v) => v === st.len, (v) => {
        st.len = v;
        st.start = Math.max(0, Math.min(st.start, dur - v));
      }));
      requestAnimationFrame(drawWave);
    }
    langRow.innerHTML = '';
    langRow.append(lbl(L.lsLang), chips([['pl', 'Polski'], ['en', 'English']], (v) => v === st.lang, (v) => { st.lang = v; }));
    partRow.innerHTML = '';
    partRow.append(lbl(L.lsAlso), chips([['bass', L.lsBass], ['drums', L.lsDrums]], (v) => st[v], (v) => { st[v] = !st[v]; }));
    go.disabled = !has || st.busy;
    go.textContent = st.busy ? L.lsBusy : L.lsGo;
    undo.style.display = st.undo && !st.busy ? '' : 'none';
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

  go.addEventListener('click', async () => {
    if (!st.x || st.busy) return;
    st.busy = true; st.result = ''; draw();
    body.appendChild(prog);
    const setP = (v) => { prog.firstChild.style.width = Math.round(v * 100) + '%'; };
    setP(0);
    try {
      app.stopAll();
      await prepareLang(st.lang);
      const a = Math.floor(st.start * LSR), b = Math.min(st.x.length, Math.floor((st.start + st.len) * LSR));
      const A = await analyze(st.x.subarray(a, b), { onProgress: setP });
      if (A.melody.length < 4) { st.result = L.lsNoMelody; }
      else {
        const prev = JSON.parse(JSON.stringify(app.song));
        const next = songFromAnalysis(A, prev, { words: st.words, lang: st.lang, bass: st.bass, drums: st.drums, src: st.name === L.lsMicName ? 'mic' : 'file' });
        if (!next) st.result = L.lsNoMelody;
        else {
          app.ensureRoles(next, { bass: st.bass, drums: st.drums });
          st.undo = prev;
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
