// Fits articulation params per vowel so the tract's formants (chain-matrix roots) match reference F1-F3.
import { tractShape, SOUND_SPEED, NPAR, REST_PARAMS } from '../../js/voice/engine.js';

const FS = 48000, STEPS = 2, LEN = 17;
const sec = SOUND_SPEED / (FS * STEPS);
const N = Math.round(LEN / 100 / sec);

export function formants(p, n = N, secLen = sec) {
  const d = new Float32Array(n);
  tractShape(p, n, d);
  const A = Array.from(d, (x) => x * x + 1e-5);
  const out = [];
  let prev = null, prevF = 0;
  for (let f = 60; f <= 4200; f += 10) {
    const th = 2 * Math.PI * f / SOUND_SPEED * secLen;
    const ct = Math.cos(th), st = Math.sin(th);
    let a = 1, b = 0, c = 0, dd = 1;
    for (let i = 0; i < n; i++) {
      const Z = 1 / A[i];
      const na = a * ct - b * st / Z;
      const nb = a * Z * st + b * ct;
      const nc = c * ct + dd * st / Z;
      const nd = -c * Z * st + dd * ct;
      a = na; b = nb; c = nc; dd = nd;
    }
    if (prev !== null && Math.sign(dd) !== Math.sign(prev)) {
      out.push(prevF + 10 * prev / (prev - dd));
      if (out.length >= 3) break;
    }
    prev = dd; prevF = f;
  }
  while (out.length < 3) out.push(5000);
  return out;
}

const T = {
  i: [290, 2280, 2950], I: [410, 1950, 2650], y: [370, 1650, 2450], e: [550, 1800, 2550], ae: [660, 1720, 2500],
  a: [720, 1300, 2500], A: [750, 1150, 2550], V: [630, 1200, 2500], o: [540, 960, 2450], O: [620, 950, 2550],
  U: [450, 1080, 2400], u: [320, 800, 2280], '@': [500, 1450, 2450], '3': [480, 1350, 1750],
};
const PRIOR = {
  i: [0.74, 0.5, 0.25, 1.3, 0], I: [0.7, 0.75, 0.3, 1.3, 0], y: [0.66, 0.7, 0.3, 1.2, 0], e: [0.68, 0.95, 0.5, 1.5, 0],
  ae: [0.6, 1.2, 0.8, 1.8, 0], a: [0.38, 1.0, 0.95, 2.0, 0], A: [0.32, 0.9, 0.9, 1.8, 0.1], V: [0.42, 1.2, 0.7, 1.5, 0],
  o: [0.42, 0.9, 0.55, 0.9, 0.7], O: [0.36, 0.85, 0.7, 1.1, 0.5], U: [0.56, 1.0, 0.35, 0.9, 0.5], u: [0.58, 0.75, 0.25, 0.6, 1],
  '@': [0.5, 1.5, 0.45, 1.4, 0.1], '3': [0.55, 1.2, 0.4, 1.1, 0.4],
};
const RANGE = [[0.25, 0.85], [0.35, 2.4], [0, 1], [0.3, 2.3], [0, 1]];
const CON = {
  u: { 2: [0, 0.35], 4: [0.75, 1], 3: [0.3, 0.9] }, U: { 2: [0.1, 0.45], 4: [0.4, 0.9] }, o: { 2: [0.3, 0.65], 4: [0.5, 1] },
  O: { 2: [0.45, 0.85], 4: [0.3, 0.8] }, i: { 2: [0, 0.3], 4: [0, 0.15], 0: [0.65, 0.85] }, I: { 2: [0.15, 0.45], 4: [0, 0.15] },
  y: { 2: [0.15, 0.45], 4: [0, 0.2] }, e: { 2: [0.3, 0.6], 4: [0, 0.15] }, ae: { 2: [0.6, 0.95], 4: [0, 0.1] },
  a: { 2: [0.75, 1], 4: [0, 0.1] }, A: { 2: [0.75, 1], 4: [0, 0.25] }, V: { 2: [0.5, 0.8], 4: [0, 0.15] },
  '@': { 2: [0.3, 0.55], 4: [0, 0.2] }, '3': { 2: [0.25, 0.5], 4: [0.2, 0.6] },
};

function paramsOf(v, tip) {
  const p = Float32Array.from(REST_PARAMS);
  p[0] = v[0]; p[1] = v[1]; p[2] = v[2]; p[3] = v[3]; p[4] = v[4];
  if (tip) { p[5] = v[5]; p[6] = v[6]; } else { p[6] = 3; }
  return p;
}

function cost(v, key, tip) {
  const F = formants(paramsOf(v, tip));
  const t = T[key];
  let c = 0;
  const w = [1.2, 1, 0.35];
  for (let k = 0; k < 3; k++) { const e = Math.log(F[k] / t[k]); c += w[k] * e * e; }
  const pr = PRIOR[key];
  for (let k = 0; k < 5; k++) { const s = RANGE[k][1] - RANGE[k][0]; const e = (v[k] - pr[k]) / s; c += 0.02 * e * e; }
  return c;
}

function fit(key, tip) {
  const dims = tip ? 7 : 5;
  const rng = (tip ? [...RANGE, [0.6, 0.9], [0.3, 1.6]] : RANGE).map((r) => r.slice());
  for (const [k, r] of Object.entries(CON[key] || {})) rng[k] = r;
  let best = PRIOR[key].slice();
  if (tip) best.push(0.78, 0.8);
  best = best.map((x, k) => Math.min(rng[k][1], Math.max(rng[k][0], x)));
  let bc = cost(best, key, tip);
  let step = rng.map((r) => (r[1] - r[0]) * 0.25);
  for (let it = 0; it < 70; it++) {
    let improved = false;
    for (let k = 0; k < dims; k++) {
      for (const s of [1, -1]) {
        const v = best.slice();
        v[k] = Math.min(rng[k][1], Math.max(rng[k][0], v[k] + s * step[k]));
        const c = cost(v, key, tip);
        if (c < bc) { bc = c; best = v; improved = true; }
      }
    }
    if (!improved) step = step.map((x) => x * 0.6);
  }
  return { v: best, c: bc, F: formants(paramsOf(best, tip)) };
}

const res = {};
for (const key of Object.keys(T)) {
  const tip = key === '3';
  const r = fit(key, tip);
  res[key] = r.v.map((x) => +x.toFixed(3));
  console.log(key.padEnd(3), 'target', T[key].join('/'), ' got', r.F.map((x) => Math.round(x)).join('/'), ' cost', r.c.toFixed(4), ' v', res[key].join(', '));
}
console.log('N=', N);
console.log(JSON.stringify(res));
