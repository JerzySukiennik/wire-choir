// Wire Choir planner: turns sung syllable notes (and drum hits) into articulation segments for one voice.
import { TX, TD, OPEN, LIPD, LIPR, TIPX, TIPD, VEL, VOICE, ASP, FRIC, FRICX, FRICF } from './engine.js';
import { vowelParams, consonantPhases, restParams } from './phonemes.js';

function nucleusParts(nu, amp) {
  const parts = [];
  for (const s of nu) {
    if (s === 'o~' || s === 'e~') {
      parts.push(vowelParams(s, amp));
      const w = vowelParams('u', amp);
      w[LIPD] = 0.6; w[VEL] = 0.85; w[TX] = s === 'o~' ? 0.3 : 0.55;
      parts.push(w);
    } else parts.push(vowelParams(s, amp));
  }
  if (!parts.length) parts.push(vowelParams('@', amp));
  return parts;
}

function phasesOf(list, ctx, amp, lang, coda) {
  const out = [];
  for (const s of list) for (const ph of consonantPhases(s, ctx, amp, { lang, coda })) out.push(ph);
  return out;
}

function sum(ph) { let t = 0; for (const p of ph) t += p.len; return t; }

function scaleLens(ph, k) { for (const p of ph) p.len *= k; }

export function planNotes(notes, lang) {
  const segs = [];
  const N = notes.length;
  const prep = notes.map((n) => {
    const parts = nucleusParts(n.syl.nu, n.amp);
    const on = phasesOf(n.syl.on, parts[0], n.amp, lang, false);
    const co = phasesOf(n.syl.co, parts[parts.length - 1], n.amp, lang, true);
    return { n, parts, on, co };
  });
  for (let i = 0; i < N; i++) {
    const a = prep[i];
    const minV = Math.max(0.05, a.n.d * 0.4);
    let onL = sum(a.on), coL = sum(a.co);
    const budget = a.n.d - minV;
    const used = onL * 0.25 + coL;
    if (used > budget && used > 0) {
      const k = Math.max(0.35, budget / used);
      scaleLens(a.on, k); scaleLens(a.co, k);
      onL = sum(a.on); coL = sum(a.co);
    }
    a.onL = onL; a.coL = coL;
    a.onStart = a.n.t - onL * 0.75;
  }
  for (let i = 0; i < N; i++) {
    const a = prep[i], n = a.n;
    const next = prep[i + 1];
    let end = n.t + n.d;
    if (next && next.onStart < end) end = Math.max(n.t + 0.04 + a.coL, next.onStart);
    let t = Math.max(a.onStart, i > 0 ? prep[i - 1].realEnd : -1e9);
    let first = true;
    for (const ph of a.on) {
      segs.push({ at: t, len: ph.len, p: ph.p, f0: n.f0, burst: ph.burst || 0, burstX: ph.burstX || 0, w: first ? n.w : -1 });
      first = false;
      t += ph.len;
    }
    const vEnd = end - a.coL;
    const vLen = Math.max(0.03, vEnd - t);
    if (a.parts.length === 1) {
      segs.push({ at: t, len: vLen, p: a.parts[0], f0: n.f0, burst: 0, burstX: 0, w: first ? n.w : -1 });
    } else {
      const l1 = vLen * 0.62;
      segs.push({ at: t, len: l1, p: a.parts[0], f0: n.f0, burst: 0, burstX: 0, w: first ? n.w : -1 });
      segs.push({ at: t + l1, len: vLen - l1, p: a.parts[1], f0: n.f0, burst: 0, burstX: 0, w: -1 });
    }
    first = false;
    t += vLen;
    for (const ph of a.co) {
      segs.push({ at: t, len: ph.len, p: ph.p, f0: 0, burst: ph.burst || 0, burstX: ph.burstX || 0, w: -1 });
      t += ph.len;
    }
    a.realEnd = t;
    const gap = next ? next.onStart - t : 1;
    if (gap > 0.025) segs.push({ at: t, len: Math.min(gap, 0.5), p: restParams(), f0: 0, burst: 0, burstX: 0, w: -1, rest: true });
  }
  return segs;
}

export function planLiveOn(syl, f0, amp, lang, prevSyl, prevAmp, w) {
  const segs = [];
  if (prevSyl) {
    const pp = nucleusParts(prevSyl.nu, prevAmp);
    if (pp.length > 1) segs.push({ len: 0.06, p: pp[1], f0: 0, burst: 0, burstX: 0, w: -1 });
    for (const ph of phasesOf(prevSyl.co, pp[pp.length - 1], prevAmp, lang, true)) segs.push({ len: ph.len * 0.8, p: ph.p, f0: 0, burst: ph.burst || 0, burstX: ph.burstX || 0, w: -1 });
  }
  const parts = nucleusParts(syl.nu, amp);
  let first = true;
  for (const ph of phasesOf(syl.on, parts[0], amp, lang, false)) {
    segs.push({ len: ph.len * 0.75, p: ph.p, f0, burst: ph.burst || 0, burstX: ph.burstX || 0, w: first ? w : -1 });
    first = false;
  }
  segs.push({ len: 1e9, hold: true, p: parts[0], f0, burst: 0, burstX: 0, w: first ? w : -1 });
  return segs;
}

export function planLiveOff(syl, amp, lang) {
  const segs = [];
  const pp = nucleusParts(syl.nu, amp);
  if (pp.length > 1) segs.push({ len: 0.07, p: pp[1], f0: 0, burst: 0, burstX: 0, w: -1 });
  for (const ph of phasesOf(syl.co, pp[pp.length - 1], amp, lang, true)) segs.push({ len: ph.len, p: ph.p, f0: 0, burst: ph.burst || 0, burstX: ph.burstX || 0, w: -1 });
  segs.push({ len: 0.3, p: restParams(), f0: 0, burst: 0, burstX: 0, w: -1, rest: true });
  return segs;
}

function drumSegs(type, t, amp) {
  const s = [];
  const push = (at, len, p, f0, burst, burstX) => s.push({ at, len, p, f0: f0 || 0, burst: burst || 0, burstX: burstX || 0, w: -1 });
  if (type === 'K') {
    const cl = vowelParams('u', 0); cl[LIPD] = 0; cl[VOICE] = 0.15 * amp; cl[VEL] = 0.15;
    push(t - 0.03, 0.03, cl, 75);
    const b = vowelParams('u', amp * 0.95); b[LIPD] = 0.25; b[OPEN] = 0.05;
    push(t, 0.05, b, 62, 3.2 * amp, 0.985);
    const b2 = vowelParams('u', amp * 0.4); b2[LIPD] = 0.1;
    push(t + 0.05, 0.05, b2, 45);
  } else if (type === 'S') {
    const cl = vowelParams('@', 0); cl[TX] = 0.64; cl[TD] = 0;
    push(t - 0.025, 0.025, cl);
    const f = vowelParams('@', 0); f[TIPX] = 0.83; f[TIPD] = 0.19; f[OPEN] = 0.2; f[LIPR] = 0.6; f[LIPD] = 1.0;
    f[FRIC] = 18 * amp; f[FRICX] = 0.9; f[FRICF] = 3600; f[ASP] = 0.3 * amp;
    push(t, 0.1, f, 0, 4 * amp, 0.7);
  } else if (type === 'H' || type === 'O') {
    const cl = vowelParams('i', 0); cl[TIPX] = 0.87; cl[TIPD] = 0; cl[OPEN] = 0.1;
    push(t - 0.015, 0.015, cl);
    const f = vowelParams('i', 0); f[TIPX] = 0.87; f[TIPD] = 0.1; f[OPEN] = 0.1;
    f[FRIC] = (type === 'O' ? 7 : 6) * amp; f[FRICX] = 0.92; f[FRICF] = 7000;
    push(t, type === 'O' ? 0.17 : 0.04, f, 0, 2.2 * amp, 0.92);
  }
  const r = restParams(); r[OPEN] = 0.1;
  const end = s[s.length - 1];
  push(end.at + end.len, 0.03, r);
  return s;
}

export function planDrums(hits) {
  const segs = [];
  for (const h of hits) for (const s of drumSegs(h.type, h.t, h.amp)) segs.push(s);
  segs.sort((a, b) => a.at - b.at);
  for (let i = 0; i < segs.length - 1; i++) {
    const a = segs[i], b = segs[i + 1];
    if (a.at + a.len > b.at) a.len = Math.max(0.005, b.at - a.at);
  }
  return segs;
}

export function previewSyllables(lang) {
  return lang === 'pl' ? ['la', 'la', 'la', 'la'] : ['la', 'la', 'la', 'la'];
}
export { TX, TD, OPEN, LIPD, LIPR, TIPX, TIPD, VEL, VOICE, ASP, FRIC, FRICX, FRICF };
