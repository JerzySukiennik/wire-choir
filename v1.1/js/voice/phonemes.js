// Wire Choir phoneme inventory: fitted vowel articulations and consonant gestures (shared symbols for PL and EN).
import { NPAR, TX, TD, OPEN, LIPD, LIPR, TIPX, TIPD, VEL, VOICE, ASP, FRIC, FRICX, FRICF, REST_PARAMS } from './engine.js';

export const VOWELS = {
  i: [0.701, 0.679, 0.075, 1.844, 0.03], I: [0.68, 1.25, 0.319, 1.746, 0], y: [0.62, 0.908, 0.3, 1.199, 0],
  e: [0.585, 1.571, 0.6, 2.3, 0.032], ae: [0.42, 2.239, 0.839, 2.3, 0], a: [0.25, 1, 0.98, 2.191, 0],
  A: [0.25, 0.718, 1, 2.3, 0.054], V: [0.295, 0.98, 0.742, 1.55, 0], o: [0.285, 0.592, 0.56, 1.219, 0.662],
  O: [0.266, 0.519, 0.808, 1.631, 0.478], U: [0.325, 0.892, 0.336, 0.839, 0.459], u: [0.281, 0.448, 0.193, 0.528, 0.955],
  '@': [0.444, 1.824, 0.428, 1.163, 0.096], '3': [0.338, 1.16, 0.5, 1.451, 0.365, 0.645, 0.447],
  M: [0.45, 1.6, 0.05, 0, 0.2],
};

export function isVowel(s) { return s in VOWELS || s === 'o~' || s === 'e~'; }

const C = {
  p: { c: 'stop', v: 0, pl: 'lab' }, b: { c: 'stop', v: 1, pl: 'lab' },
  t: { c: 'stop', v: 0, pl: 'alv' }, d: { c: 'stop', v: 1, pl: 'alv' },
  k: { c: 'stop', v: 0, pl: 'vel' }, g: { c: 'stop', v: 1, pl: 'vel' },
  f: { c: 'fric', v: 0, pl: 'labdent' }, v: { c: 'fric', v: 1, pl: 'labdent' },
  T: { c: 'fric', v: 0, pl: 'dent' }, D: { c: 'fric', v: 1, pl: 'dent' },
  s: { c: 'fric', v: 0, pl: 'alv' }, z: { c: 'fric', v: 1, pl: 'alv' },
  S: { c: 'fric', v: 0, pl: 'post' }, Z: { c: 'fric', v: 1, pl: 'post' },
  "s'": { c: 'fric', v: 0, pl: 'alvpal' }, "z'": { c: 'fric', v: 1, pl: 'alvpal' },
  x: { c: 'fric', v: 0, pl: 'vel' }, h: { c: 'h', v: 0 },
  ts: { c: 'affr', v: 0, pl: 'alv' }, dz: { c: 'affr', v: 1, pl: 'alv' },
  tS: { c: 'affr', v: 0, pl: 'post' }, dZ: { c: 'affr', v: 1, pl: 'post' },
  "ts'": { c: 'affr', v: 0, pl: 'alvpal' }, "dz'": { c: 'affr', v: 1, pl: 'alvpal' },
  m: { c: 'nasal', v: 1, pl: 'lab' }, n: { c: 'nasal', v: 1, pl: 'alv' },
  "n'": { c: 'nasal', v: 1, pl: 'pal' }, N: { c: 'nasal', v: 1, pl: 'vel' },
  l: { c: 'approx', v: 1, pl: 'lat' }, R: { c: 'approx', v: 1, pl: 'retro' },
  w: { c: 'approx', v: 1, pl: 'labvel' }, j: { c: 'approx', v: 1, pl: 'pal' },
  r: { c: 'trill', v: 1, pl: 'alv' },
};
export const CONSONANTS = C;

const PLACE = {
  lab: { close: (p) => { p[LIPD] = 0; p[OPEN] = Math.min(p[OPEN], 0.3); }, x: 0.985, bf: 1100 },
  labdent: { narrow: (p) => { p[LIPD] = 0.16; p[LIPR] = 0; p[OPEN] = Math.min(p[OPEN], 0.25); }, x: 0.99, ff: 7500, fa: 0.4 },
  dent: { narrow: (p) => { p[TIPX] = 0.94; p[TIPD] = 0.14; p[OPEN] = Math.min(p[OPEN], 0.3); }, x: 0.97, ff: 6800, fa: 0.3 },
  alv: {
    close: (p) => { p[TIPX] = 0.87; p[TIPD] = 0; p[OPEN] = Math.min(p[OPEN], 0.35); },
    narrow: (p) => { p[TIPX] = 0.87; p[TIPD] = 0.11; p[OPEN] = Math.min(p[OPEN], 0.2); p[LIPR] = Math.min(p[LIPR], 0.2); },
    x: 0.92, bf: 4200, ff: 6200, fa: 1,
  },
  post: {
    close: (p) => { p[TIPX] = 0.83; p[TIPD] = 0; p[OPEN] = Math.min(p[OPEN], 0.3); p[LIPR] = Math.max(p[LIPR], 0.45); },
    narrow: (p) => { p[TIPX] = 0.83; p[TIPD] = 0.2; p[OPEN] = Math.min(p[OPEN], 0.25); p[LIPR] = Math.max(p[LIPR], 0.5); p[LIPD] = Math.min(p[LIPD], 1.2); },
    x: 0.9, bf: 3000, ff: 3300, fa: 1,
  },
  alvpal: {
    close: (p) => { p[TIPX] = 0.8; p[TIPD] = 0; p[TX] = 0.72; p[TD] = Math.min(p[TD], 0.7); p[OPEN] = Math.min(p[OPEN], 0.25); },
    narrow: (p) => { p[TIPX] = 0.8; p[TIPD] = 0.17; p[TX] = 0.72; p[TD] = Math.min(p[TD], 0.7); p[OPEN] = Math.min(p[OPEN], 0.2); p[LIPR] = 0; },
    x: 0.88, bf: 3800, ff: 4600, fa: 0.9,
  },
  pal: {
    close: (p) => { p[TX] = 0.73; p[TD] = 0; p[OPEN] = Math.min(p[OPEN], 0.25); },
    narrow: (p) => { p[TX] = 0.72; p[TD] = 0.42; p[OPEN] = Math.min(p[OPEN], 0.2); p[LIPR] = 0; },
    x: 0.8, bf: 3200, ff: 3800, fa: 0.4,
  },
  vel: {
    close: (p) => { p[TX] = 0.64; p[TD] = 0; p[OPEN] = Math.min(p[OPEN], 0.45); },
    narrow: (p) => { p[TX] = 0.63; p[TD] = 0.14; p[OPEN] = Math.min(p[OPEN], 0.4); },
    x: 0.7, bf: 2000, ff: 1900, fa: 0.75,
  },
  lat: { narrow: (p) => { p[TIPX] = 0.87; p[TIPD] = 0.42; p[OPEN] = Math.min(p[OPEN], 0.35); } },
  retro: { narrow: (p) => { const v = VOWELS['3']; p[TX] = v[0]; p[TD] = v[1]; p[TIPX] = 0.7; p[TIPD] = 0.36; p[LIPR] = 0.5; p[LIPD] = 1.1; p[OPEN] = Math.min(p[OPEN], 0.35); } },
  labvel: { narrow: (p) => { const v = VOWELS.u; p[TX] = v[0]; p[TD] = 0.42; p[LIPD] = 0.32; p[LIPR] = 1; p[OPEN] = 0.12; } },
};

export function vowelParams(sym, amp) {
  const p = Float32Array.from(REST_PARAMS);
  const base = sym === 'o~' ? 'o' : sym === 'e~' ? 'e' : sym;
  const v = VOWELS[base] || VOWELS['@'];
  p[TX] = v[0]; p[TD] = v[1]; p[OPEN] = v[2]; p[LIPD] = v[3]; p[LIPR] = v[4];
  if (v.length > 5) { p[TIPX] = v[5]; p[TIPD] = v[6]; } else { p[TIPD] = 3; }
  p[VEL] = base === 'M' ? 1 : 0;
  p[VOICE] = amp; p[ASP] = 0; p[FRIC] = 0; p[FRICX] = 0.9; p[FRICF] = 3000;
  return p;
}

function ctxCopy(ctx) {
  const p = Float32Array.from(ctx);
  p[TIPD] = 3; p[VEL] = 0; p[FRIC] = 0; p[ASP] = 0;
  return p;
}

export function consonantPhases(sym, ctx, amp, opts) {
  const c = C[sym];
  if (!c) return [];
  const pl = PLACE[c.pl] || {};
  const k = opts.speed || 1;
  const coda = !!opts.coda;
  const en = opts.lang === 'en';
  const out = [];
  if (c.c === 'stop' || c.c === 'affr') {
    const cl = ctxCopy(ctx);
    pl.close(cl);
    cl[VOICE] = c.v ? amp * 0.3 : 0;
    cl[VEL] = c.v ? 0.08 : 0;
    out.push({ len: (c.v ? 0.045 : 0.06) * k, p: cl });
    const rel = ctxCopy(ctx);
    if (c.c === 'affr') {
      pl.narrow(rel);
      rel[FRIC] = (pl.fa || 0.8) * (c.v ? 0.55 : 0.95);
      rel[FRICX] = pl.x; rel[FRICF] = pl.ff;
      rel[VOICE] = c.v ? amp * 0.55 : 0;
      out.push({ len: 0.075 * k, p: rel, burst: c.v ? 0.15 : 0.25, burstX: pl.x, });
    } else {
      rel[VOICE] = c.v ? amp * 0.8 : 0;
      const vot = !c.v && en && !coda ? 0.055 : 0.014;
      rel[ASP] = c.v ? 0 : 0.75;
      out.push({ len: (0.012 + vot) * k, p: rel, burst: c.v ? 0.3 : 0.55, burstX: pl.x });
    }
  } else if (c.c === 'fric') {
    const p = ctxCopy(ctx);
    pl.narrow(p);
    p[FRIC] = (pl.fa || 0.8) * (c.v ? 0.6 : 1);
    p[FRICX] = pl.x; p[FRICF] = pl.ff;
    p[VOICE] = c.v ? amp * 0.6 : 0;
    out.push({ len: (c.v ? 0.07 : 0.095) * k, p });
  } else if (c.c === 'nasal') {
    const p = ctxCopy(ctx);
    pl.close(p);
    p[VEL] = 1;
    p[VOICE] = amp * 0.85;
    out.push({ len: (coda ? 0.085 : 0.06) * k, p });
  } else if (c.c === 'approx') {
    const p = ctxCopy(ctx);
    pl.narrow(p);
    p[VOICE] = amp * 0.85;
    out.push({ len: (sym === 'l' ? 0.055 : 0.05) * k, p });
  } else if (c.c === 'trill') {
    const a = ctxCopy(ctx), b = ctxCopy(ctx);
    PLACE.alv.close(a);
    b[TIPX] = 0.87; b[TIPD] = 0.55; b[OPEN] = Math.min(b[OPEN], 0.35);
    a[VOICE] = amp * 0.6; b[VOICE] = amp * 0.75;
    const t = 0.022 * k;
    out.push({ len: t, p: a }, { len: t, p: b }, { len: t, p: Float32Array.from(a) });
  } else if (c.c === 'h') {
    const p = ctxCopy(ctx);
    p[ASP] = 0.8; p[VOICE] = 0;
    out.push({ len: 0.06 * k, p });
  }
  return out;
}

export function restParams() { return Float32Array.from(REST_PARAMS); }
export { NPAR };
