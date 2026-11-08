// Wire Choir composer: chords, melody rhythm and pitch from lyrics, plus per-role parts (lead, harmony, choir, bass, beatbox).
import { midiToHz } from './voices.js';

export const SCALES = { major: [0, 2, 4, 5, 7, 9, 11], minor: [0, 2, 3, 5, 7, 8, 10] };
export const MOODS = {
  happy: { mode: 'major', bpm: 104, feel: 8, progs: [[0, 4, 5, 3], [0, 3, 5, 4], [5, 3, 0, 4]], drums: 'pop', bass: 'pop' },
  ballad: { mode: 'major', bpm: 76, feel: 4, progs: [[0, 5, 3, 4], [0, 2, 5, 3], [3, 0, 4, 5]], drums: 'ballad', bass: 'ballad' },
  sad: { mode: 'minor', bpm: 82, feel: 4, progs: [[0, 5, 2, 6], [0, 3, 5, 4], [0, 6, 5, 6]], drums: 'half', bass: 'sad' },
  dark: { mode: 'minor', bpm: 94, feel: 8, progs: [[0, 5, 6, 0], [0, 3, 0, 4], [0, 6, 3, 4]], drums: 'half', bass: 'pulse' },
  hymn: { mode: 'major', bpm: 70, feel: 4, progs: [[0, 3, 4, 0], [0, 5, 3, 4], [3, 4, 2, 5]], drums: 'none', bass: 'hymn' },
};
const NAMES = ['C', 'C#', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B'];

export function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function stepToMidi(step, key, mode) {
  const sc = SCALES[mode];
  const o = Math.floor(step / 7), d = ((step % 7) + 7) % 7;
  return 60 + key + sc[d] + 12 * o;
}
export function midiToStep(m, key, mode) {
  const sc = SCALES[mode];
  const rel = m - 60 - key;
  const o = Math.floor(rel / 12), pc = ((rel % 12) + 12) % 12;
  let best = 0, bd = 99;
  for (let i = 0; i < 7; i++) { const dd = Math.abs(sc[i] - pc); if (dd < bd) { bd = dd; best = i; } }
  return o * 7 + best;
}

function chordInfo(deg, key, mode, harmonicV) {
  const sc = SCALES[mode];
  const pcs = [deg, deg + 2, deg + 4].map((s) => {
    let pc = sc[s % 7] + (s >= 7 ? 12 : 0);
    if (mode === 'minor' && harmonicV && deg === 4 && s % 7 === 6) pc += 1;
    return (pc + key) % 12;
  });
  const third = (pcs[1] - pcs[0] + 12) % 12, fifth = (pcs[2] - pcs[0] + 12) % 12;
  const q = third === 4 ? '' : fifth === 6 ? '°' : 'm';
  return { deg, root: pcs[0], pcs, steps: [deg % 7, (deg + 2) % 7, (deg + 4) % 7], name: NAMES[pcs[0]] + q };
}

export function trackChord(c, key, mode) {
  const sc = SCALES[mode];
  const r = ((c[0] % 12) + 12) % 12;
  const pcs = [r, (r + (c[1] ? 3 : 4)) % 12, (r + 7) % 12];
  const steps = pcs.map((pc) => {
    let best = 0, bd = 99;
    for (let d = 0; d < 7; d++) { const x = Math.abs((((sc[d] + key - pc) % 12) + 18) % 12 - 6); if (x < bd) { bd = x; best = d; } }
    return best;
  });
  return { deg: steps[0], root: r, pcs, steps, name: NAMES[r] + (c[1] ? 'm' : '') };
}

export function validTrack(t) {
  return t && typeof t === 'object' && t.bars > 0 ? t : null;
}

function bestRhythm(syls, bars, feel, R) {
  const S = syls.length, T = bars * 8;
  let best = null, bs = -1e9;
  for (let c = 0; c < 48; c++) {
    const off = S > 9 ? 0 : [0, 0, 0, 1, 1, 2][Math.floor(R() * 6)];
    let rest = 2 + Math.floor(R() * 3);
    let A = T - off - rest;
    if (A < S) { rest = Math.max(1, T - off - S); A = T - off - rest; }
    if (A < S) continue;
    const base = feel === 4 && A >= 2 * S ? 2 : 1;
    const dur = new Array(S).fill(base);
    let extra = A - S * base;
    const fin = Math.min(extra, Math.max(1, Math.round(extra * (0.2 + 0.25 * R()))));
    dur[S - 1] += fin; extra -= fin;
    const w = syls.map((s, i) => (i === S - 1 ? 0 : 0.6 + 2 * s.stress + (s.wordEnd ? 0.6 : 0) + R() * 0.8));
    const tw = w.reduce((a, b) => a + b, 0) || 1;
    while (extra > 0) {
      let r = R() * tw, i = 0;
      while (i < S - 1 && r > w[i]) { r -= w[i]; i++; }
      dur[Math.min(i, S - 1)]++; extra--;
    }
    let p = off, sc = 0;
    for (let i = 0; i < S; i++) {
      const q = p % 8, on = q % 2 === 0, down = q === 0 || q === 4;
      if (syls[i].stress >= 1) sc += (on ? 2 : -1.6) + (down ? 1.4 : 0);
      else if (syls[i].stress > 0) sc += on ? 0.8 : 0;
      else if (down && syls.length > 2) sc -= 0.7;
      if (!on && dur[i] >= 3) sc -= 0.5;
      if (i > 0 && dur[i] === dur[i - 1]) sc += 0.15;
      p += dur[i];
    }
    if ((p - dur[S - 1]) % 2 === 0) sc += 1;
    sc += R() * 1.2;
    if (sc > bs) { bs = sc; best = { off, dur }; }
  }
  if (!best) best = { off: 0, dur: new Array(S).fill(Math.max(1, Math.floor(T / S))) };
  return best;
}

function genPitches(syls, starts, chordAt, R, isLastLine, lo, hi) {
  const S = syls.length;
  const shape = ['arch', 'arch', 'fall', 'rise', 'wave'][Math.floor(R() * 5)];
  const base = 1 + Math.floor(R() * 3), amp = 2 + Math.floor(R() * 3);
  const target = (i) => {
    const x = S > 1 ? i / (S - 1) : 0;
    if (shape === 'arch') return base + amp * Math.sin(Math.PI * Math.min(1, x * 1.15));
    if (shape === 'fall') return base + amp * (1 - x);
    if (shape === 'rise') return base + amp * Math.min(1, x * 1.4) - (x > 0.8 ? 1.5 : 0);
    return base + amp * 0.6 * Math.sin(x * Math.PI * 2);
  };
  const out = [];
  let prev = null, rep = 0, lastLeap = 0;
  for (let i = 0; i < S; i++) {
    const ch = chordAt(starts[i]);
    const beatPos = starts[i] % 1 === 0;
    let best = 0, bs = -1e9;
    const lo2 = prev === null ? lo : Math.max(lo, prev - 4), hi2 = prev === null ? hi : Math.min(hi, prev + 4);
    for (let s = lo2; s <= hi2; s++) {
      const d7 = ((s % 7) + 7) % 7;
      const ct = ch.steps.includes(d7);
      let sc = -Math.abs(s - target(i)) * 0.7;
      if (ct) sc += beatPos || syls[i].stress >= 1 ? 2 : 0.6;
      else if (beatPos && syls[i].stress >= 1) sc -= 1;
      if (prev !== null) {
        const dv = s - prev;
        if (Math.abs(dv) === 1) sc += 0.9;
        if (Math.abs(dv) === 2) sc += 0.3;
        if (dv === 0) sc += rep >= 1 ? -1.4 : 0;
        sc -= 0.55 * Math.max(0, Math.abs(dv) - 2);
        if (Math.abs(lastLeap) >= 3 && Math.sign(dv) === -Math.sign(lastLeap) && Math.abs(dv) <= 2) sc += 1;
      }
      if (i === S - 1) {
        if (ct) sc += 2;
        if (d7 === ch.steps[0]) sc += 1;
        if (isLastLine && d7 === 0) sc += 6;
      }
      sc += R() * 0.9;
      if (sc > bs) { bs = sc; best = s; }
    }
    rep = prev === best ? rep + 1 : 0;
    lastLeap = prev === null ? 0 : best - prev;
    prev = best;
    out.push(best);
  }
  return out;
}

export function lineIds(parsed) {
  const seen = {};
  return parsed.lines.map((l) => { const k = l.key; seen[k] = (seen[k] || 0) + 1; return k + '#' + seen[k]; });
}

export function arrange(song, parsed, heads, opts = {}) {
  const mood = MOODS[song.mood] || MOODS.happy;
  const mode = mood.mode, key = song.key, bpm = song.bpm || mood.bpm, spb = 60 / bpm;
  const R0 = rng(song.seed);
  const prog = mood.progs[Math.floor(R0() * mood.progs.length)];
  const backing = heads.some((h) => h.role === 'choir' || h.role === 'bass' || h.role === 'beatbox');
  const tr = validTrack(song.track);
  const introBars = !tr && backing && opts.intro !== false ? 1 : 0;
  const leads = heads.filter((h) => h.role === 'lead');
  const ids = lineIds(parsed);
  const mel = song.melody && typeof song.melody === 'object' && !Array.isArray(song.melody) ? song.melody : {};
  const cap = mood.feel === 8 ? 12 : 9;
  const lines = [];
  let bar = introBars;
  parsed.lines.forEach((l, li) => {
    const S = l.syls.length;
    const ex = mel[ids[li]];
    const explicit = !!(ex && ex.notes && ex.notes.length === S);
    const bars = explicit ? Math.max(1, ex.bars || 1) : S <= (mood.feel === 8 ? 5 : 3) ? 1 : 2 * Math.ceil(S / cap);
    lines.push({ i: li, id: ids[li], b0: bar * 4, b1: (bar + bars) * 4, key: l.key, bars, explicit });
    bar += bars;
  });
  const lastLine = lines.length ? lines[lines.length - 1] : null;
  const endBar = lastLine ? Math.ceil(lastLine.b1 / 4) : introBars;
  const songBars = tr ? Math.max(tr.bars, endBar) : Math.max(1, endBar + (backing ? 1 : 0));
  const chordForBar = (b) => {
    if (tr && tr.chords && tr.chords[b]) return trackChord(tr.chords[b], key, mode);
    if (b < introBars) return chordInfo(0, key, mode, true);
    if (lastLine && b >= endBar - 1) return chordInfo(0, key, mode, true);
    if (lastLine && b === endBar - 2 && lastLine.bars >= 2) return chordInfo(4, key, mode, true);
    return chordInfo(prog[(b - introBars) % prog.length], key, mode, mode === 'minor' && song.mood !== 'dark');
  };
  const chords = [];
  for (let b = 0; b < songBars; b++) chords.push({ ...chordForBar(b), b: b * 4, d: 4 });
  const chordAt = (b) => chords[Math.max(0, Math.min(chords.length - 1, Math.floor(b / 4)))];
  const notes = [];
  lines.forEach((ln, li) => {
    const l = parsed.lines[ln.i];
    const S = l.syls.length;
    const first = (i) => i === 0 || l.syls[i - 1].word !== l.syls[i].word;
    if (ln.explicit) {
      for (const n of mel[ln.id].notes) {
        const syl = l.syls[n.i];
        notes.push({ s: syl.id, line: ln.i, syl, b: ln.b0 + n.b, d: n.d, m: n.m, step: midiToStep(n.m, key, mode), stress: syl.stress, w: syl.word, first: first(n.i), li: n.i, edited: true });
      }
      return;
    }
    const R = rng((song.seed * 31 + l.key) >>> 0);
    const syls = l.syls.map((s, i) => ({ ...s, wordEnd: i === S - 1 || l.syls[i + 1].word !== s.word }));
    const rh = bestRhythm(syls, ln.bars, mood.feel, R);
    const starts = [];
    let p = rh.off;
    for (let i = 0; i < S; i++) { starts.push(ln.b0 + p / 2); p += rh.dur[i]; }
    const steps = genPitches(syls, starts, chordAt, R, li === lines.length - 1, -2, 9);
    for (let i = 0; i < S; i++) {
      notes.push({ s: l.syls[i].id, line: ln.i, syl: l.syls[i], b: starts[i], d: rh.dur[i] / 2, step: steps[i], m: stepToMidi(steps[i], key, mode), stress: l.syls[i].stress, w: l.syls[i].word, first: first(i), li: i, edited: false });
    }
  });
  notes.sort((x, y) => x.b - y.b);
  const singersOf = (li, idx) => {
    const set = song.lineSingers && song.lineSingers[li];
    const valid = set ? set.filter((id) => leads.some((h) => h.id === id)) : [];
    if (valid.length) return valid;
    if (!leads.length) return [];
    if (leads.length === 1) return [leads[0].id];
    if (idx === lines.length - 1 && lines.length > 2) return leads.map((h) => h.id);
    return [leads[idx % leads.length].id];
  };
  lines.forEach((l, idx) => { l.singers = singersOf(l.i, idx); });
  return { bpm, spb, key, mode, mood: song.mood, introBars, totalBeats: songBars * 4, duration: songBars * 4 * spb + 1.5, chords, notes, lines, lang: parsed.lang, explicit: lines.some((l) => l.explicit), track: tr };
}

export function snapToScale(m, key, mode) {
  const sc = SCALES[mode];
  const pc = (((Math.round(m) - key) % 12) + 12) % 12;
  if (sc.includes(pc)) return Math.round(m);
  return Math.round(m) + (sc.includes((pc + 1) % 12) ? 1 : -1);
}

function isFirst(parsed, syl) {
  const w = parsed.words[syl.word];
  return !w || w.syls[0] === syl || w.syls[0].id === syl.id;
}

function fitOctave(midis, lo, hi, shift) {
  if (!midis.length) return 0;
  const sorted = midis.slice().sort((a, b) => a - b);
  const med = sorted[Math.floor(sorted.length / 2)];
  const center = (lo + hi) / 2 + (shift || 0);
  return 12 * Math.round((center - med) / 12);
}

const HARM = { up3: 2, down3: -2, down6: -5, up5: 4, oct: -7 };

export function buildParts(arr, heads) {
  const spb = arr.spb;
  const parts = {};
  const chordAt = (b) => arr.chords[Math.max(0, Math.min(arr.chords.length - 1, Math.floor(b / 4)))];
  for (const h of heads) parts[h.id] = { notes: [], drums: [], role: h.role };
  for (const h of heads.filter((x) => x.role === 'lead')) {
    for (const l of arr.lines) {
      if (!l.singers.includes(h.id)) continue;
      const ns = arr.notes.filter((n) => n.line === l.i);
      const sh = fitOctave(ns.map((n) => n.m), h.lo, h.hi, h.shift);
      for (const n of ns) parts[h.id].notes.push({ t: n.b * spb, d: n.d * spb, f0: midiToHz(n.m + sh), m: n.m + sh, amp: 0.82 + 0.06 * Math.min(1, n.stress), syl: n.syl, w: n.first ? n.w : -1, s: n.s });
    }
  }
  for (const h of heads.filter((x) => x.role === 'harmony')) {
    const iv = HARM[h.harm || 'up3'] ?? 2;
    for (const l of arr.lines) {
      const ns = arr.notes.filter((n) => n.line === l.i);
      const hm = ns.map((n) => {
        let st = n.step + iv;
        const ch = chordAt(n.b);
        const d7 = (x) => ((x % 7) + 7) % 7;
        if (!ch.steps.includes(d7(st)) && (n.b % 1 === 0)) {
          for (const alt of [st + 1, st - 1]) if (ch.steps.includes(d7(alt)) && alt !== n.step) { st = alt; break; }
        }
        return stepToMidi(st, arr.key, arr.mode);
      });
      const sh = fitOctave(hm, h.lo, h.hi, h.shift);
      ns.forEach((n, i) => parts[h.id].notes.push({ t: n.b * spb, d: n.d * spb, f0: midiToHz(hm[i] + sh), m: hm[i] + sh, amp: 0.68, syl: n.syl, w: n.first ? n.w : -1, s: n.s }));
    }
  }
  const choir = heads.filter((x) => x.role === 'choir').sort((a, b) => (a.lo + a.hi) - (b.lo + b.hi));
  if (choir.length) {
    const prev = choir.map((h) => (h.lo + h.hi) / 2 + (h.shift || 0));
    for (const ch of arr.chords) {
      const used = new Set();
      choir.forEach((h, hi) => {
        const cands = [];
        for (const pc of ch.pcs) for (let m = h.lo - 2; m <= h.hi + 2; m++) if (((m % 12) + 12) % 12 === pc) cands.push(m);
        cands.sort((a, b) => Math.abs(a - prev[hi]) - Math.abs(b - prev[hi]) + (used.has(a % 12) ? 3 : 0) - (used.has(b % 12) ? 3 : 0));
        let m = cands[0] ?? prev[hi];
        if (choir.length >= 3 && hi === 0) m = cands.find((x) => x % 12 === ch.root) ?? m;
        used.add(m % 12);
        prev[hi] = m;
        const list = parts[h.id].notes;
        const last = list[list.length - 1];
        const t = ch.b * spb, d = ch.d * spb;
        if (last && Math.abs(last.m - m) < 0.1 && Math.abs(last.t + last.d - t) < 1e-6) last.d += d;
        else list.push({ t, d, f0: midiToHz(m), m, amp: 0.5, syl: { on: [], nu: [h.vowel || 'u'], co: [] }, w: -1 });
      });
    }
  }
  const mood = MOODS[arr.mood] || MOODS.happy;
  for (const h of heads.filter((x) => x.role === 'bass')) {
    const center = (h.lo + h.hi) / 2 + (h.shift || 0) - 4;
    const near = (pc) => { let best = 0, bd = 99; for (let m = 24; m < 84; m++) if (m % 12 === pc && Math.abs(m - center) < bd) { bd = Math.abs(m - center); best = m; } return best; };
    const pat = {
      pop: [[0, 1.4, 0], [1.5, 0.45, 0], [2, 0.9, 2], [3, 0.9, 0]],
      ballad: [[0, 1.9, 0], [2, 1.9, 2]], sad: [[0, 2.9, 0], [3, 0.9, 2]],
      pulse: [[0, 0.4, 0], [0.5, 0.4, 0], [1, 0.4, 0], [1.5, 0.4, 0], [2, 0.4, 0], [2.5, 0.4, 0], [3, 0.4, 0], [3.5, 0.4, 2]],
      hymn: [[0, 1.95, 0], [2, 1.95, 1]],
    }[mood.bass];
    const syl = mood.bass === 'hymn' ? { on: [], nu: ['o'], co: [] } : mood.bass === 'pulse' ? { on: ['d'], nu: ['@'], co: [] } : mood.bass === 'pop' ? { on: ['d'], nu: ['U'], co: ['m'] } : { on: ['d'], nu: ['u'], co: ['m'] };
    const lastBar = arr.chords.length - 1;
    const tb = arr.track && Array.isArray(arr.track.bass) && arr.track.bass.length ? arr.track.bass : null;
    const autoFrom = tb ? arr.track.bars : 0;
    if (tb) {
      const sh = fitOctave(tb.map((n) => n[2]), h.lo, h.hi, (h.shift || 0) - 4);
      for (const [b, d, m0] of tb) {
        let m = m0 + sh;
        while (m < h.lo - 3) m += 12;
        while (m > h.hi + 3) m -= 12;
        parts[h.id].notes.push({ t: b * spb, d: d * spb, f0: midiToHz(m), m, amp: 0.8, syl: d < 0.4 ? { on: ['d'], nu: ['@'], co: [] } : { on: ['d'], nu: ['U'], co: ['m'] }, w: -1 });
      }
    }
    arr.chords.forEach((ch, bi) => {
      if (bi < autoFrom) return;
      const p = bi === lastBar ? [[0, 3.5, 0]] : pat;
      for (const [b, d, ti] of p) {
        const m = near(ch.pcs[ti]);
        parts[h.id].notes.push({ t: (ch.b + b) * spb, d: d * spb, f0: midiToHz(m), m, amp: 0.78, syl, w: -1 });
      }
    });
  }
  const SYL = {
    synth: [{ on: ['d'], nu: ['@'], co: ['n'] }, { on: ['w'], nu: ['a', 'u'], co: [] }],
    guitar: [{ on: ['dZ'], nu: ['i'], co: ['n'] }, { on: ['dZ'], nu: ['a', 'u'], co: ['n'] }],
    keys: [{ on: ['d'], nu: ['a'], co: ['m'] }, { on: ['d'], nu: ['a'], co: ['m'] }],
    brass: [{ on: ['p'], nu: ['a'], co: [] }, { on: ['t'], nu: ['a'], co: [] }],
    strings: [{ on: [], nu: ['a'], co: [] }, { on: [], nu: ['a'], co: [] }],
    organ: [{ on: [], nu: ['o'], co: [] }, { on: [], nu: ['o'], co: [] }],
    flute: [{ on: ['t'], nu: ['u'], co: [] }, { on: ['t'], nu: ['u'], co: [] }],
  };
  const leadNotes = arr.notes;
  for (const h of heads.filter((x) => x.role === 'inst')) {
    const type = SYL[h.inst] ? h.inst : 'synth';
    const [shortS, longS] = SYL[type];
    const center = (h.lo + h.hi) / 2 + (h.shift || 0);
    const near = (pc, c = center) => { let best = 60, bd = 99; for (let m = 24; m < 100; m++) if (((m % 12) + 12) % 12 === pc && Math.abs(m - c) < bd) { bd = Math.abs(m - c); best = m; } return best; };
    const list = parts[h.id].notes;
    const push = (b, d, m, amp = 0.7) => list.push({ t: b * spb, d: d * spb, f0: midiToHz(m), m, amp, syl: d < 0.6 ? shortS : longS, w: -1 });
    const riff = h.riff && arr.track && Array.isArray(arr.track.riff) && arr.track.riff.length ? arr.track.riff : null;
    if (riff) {
      const sh = fitOctave(riff.map((n) => n[2]), h.lo, h.hi, h.shift);
      for (const [b, d, m0] of riff) { let m = m0 + sh; while (m < h.lo - 3) m += 12; while (m > h.hi + 3) m -= 12; push(b, d, m, 0.74); }
      continue;
    }
    if (type === 'flute') {
      const sh = fitOctave(leadNotes.map((n) => n.m), h.lo, h.hi, h.shift);
      for (const n of leadNotes) push(n.b, n.d, n.m + sh, 0.6);
      continue;
    }
    let prev = center;
    const lastBar = arr.chords.length - 1;
    arr.chords.forEach((ch, bi) => {
      const b0 = ch.b;
      if (bi === lastBar) { push(b0, 3.5, near(ch.pcs[0]), 0.6); return; }
      if (type === 'synth') {
        const tones = [ch.pcs[0], ch.pcs[1], ch.pcs[2], ch.pcs[1]];
        for (let k = 0; k < 8; k++) push(b0 + k * 0.5, 0.42, near(tones[k % 4], center + (k % 4 === 2 ? 3 : 0)), 0.62);
      } else if (type === 'guitar') {
        for (let k = 0; k < 4; k++) push(b0 + k + 0.5, 0.32, near(ch.pcs[k % 2 ? 2 : 1]), 0.6);
      } else if (type === 'keys') {
        for (const [o, d] of [[0, 0.4], [0.75, 0.35], [1.5, 0.45], [2.5, 0.4], [3.25, 0.35]]) push(b0 + o, d, near(ch.pcs[1], center + 2), 0.58);
      } else if (type === 'brass') {
        const hits = bi % 2 ? [[2.5, 0.45], [3.5, 0.45]] : [[0, 0.8], [1.5, 0.45], [3, 0.5]];
        for (const [o, d] of hits) push(b0 + o, d, near(ch.pcs[o % 1 ? 2 : 0]), 0.72);
      } else {
        let best = ch.pcs[0], bd = 99;
        for (const pc of ch.pcs) { const m = near(pc, prev); if (Math.abs(m - prev) < bd) { bd = Math.abs(m - prev); best = m; } }
        prev = best;
        if (type === 'organ') { push(b0, 1.95, best, 0.55); push(b0 + 2, 1.95, near(ch.pcs[2], best), 0.55); }
        else push(b0, 3.9, best, 0.55);
      }
    });
  }
  for (const h of heads.filter((x) => x.role === 'beatbox')) {
    const dens = h.density || 'normal';
    const P = {
      pop: { K: [0, 8, 10], S: [4, 12], H: [2, 6, 14], O: [] },
      ballad: { K: [0, 8], S: [4, 12], H: [2, 6, 10, 14], O: [] },
      half: { K: [0, 6], S: [8], H: [4, 12], O: [14] },
      none: { K: [0, 8], S: [], H: [4, 12], O: [] },
    }[mood.drums];
    const amps = { K: 1, S: mood.drums === 'ballad' ? 0.7 : 0.9, H: 0.55, O: 0.6 };
    const lastBar = arr.chords.length - 1;
    const td = arr.track && Array.isArray(arr.track.drums) && arr.track.drums.length ? arr.track.drums : null;
    const autoFrom = td ? arr.track.bars : 0;
    if (td) {
      const kit = heads.filter((x) => x.role === 'beatbox');
      const idx = kit.indexOf(h);
      const mine = kit.length === 1 ? 'KSHO' : idx === 0 ? 'K' : kit.length === 2 || idx === 1 ? (kit.length === 2 ? 'SHO' : 'S') : 'HO';
      const PRI = { S: 4, K: 3, O: 2, H: 1 };
      const at = new Map();
      for (const [b, type, amp] of td) {
        if (!mine.includes(type)) continue;
        if (dens === 'calm' && (type === 'H' || type === 'O')) continue;
        const k = Math.round(b * 1000);
        const prev = at.get(k);
        if (!prev || PRI[type] > PRI[prev.type]) at.set(k, { type, t: b * spb, amp });
      }
      for (const v of at.values()) parts[h.id].drums.push(v);
    }
    arr.chords.forEach((ch, bi) => {
      if (bi < autoFrom) return;
      if (bi === lastBar) { parts[h.id].drums.push({ type: 'K', t: ch.b * spb, amp: 1 }); return; }
      const hits = { K: P.K.slice(), S: P.S.slice(), H: P.H.slice(), O: P.O.slice() };
      if (dens === 'calm') { hits.H = []; hits.O = []; }
      if (dens === 'busy') { hits.H = [1, 2, 3, 5, 6, 7, 9, 10, 11, 13, 14, 15].filter((x) => !hits.K.includes(x) && !hits.S.includes(x)); hits.K.push(7); }
      if (bi % 4 === 3 && dens !== 'calm') hits.O = [14];
      for (const [type, list] of Object.entries(hits)) for (const s of list) {
        if (type === 'H' && hits.O.includes(s)) continue;
        parts[h.id].drums.push({ type, t: (ch.b + s / 4) * spb, amp: amps[type] * (type === 'H' && s % 4 !== 2 ? 0.75 : 1) });
      }
    });
    parts[h.id].drums.sort((a, b) => a.t - b.t);
  }
  return parts;
}
