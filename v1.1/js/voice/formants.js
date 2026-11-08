// Wire Choir spectral envelope of the current tract (chain-matrix), used for the live sonagram.
import { tractShape, SOUND_SPEED } from './engine.js';

const N = 44;
const SEC = 0.17 / N;
const diam = new Float32Array(N);

export function envelope(params, freqs, out) {
  tractShape(params, N, diam);
  for (let fi = 0; fi < freqs.length; fi++) {
    const f = freqs[fi];
    const th = 2 * Math.PI * f / SOUND_SPEED * SEC;
    const ct = Math.cos(th), st = Math.sin(th);
    let a = 1, b = 0, c = 0, d = 1, ai = 0, bi = 0, ci = 0, di = 0;
    const loss = 0.012 + f * 0.0000025;
    for (let i = 0; i < N; i++) {
      const A = diam[i] * diam[i] + 1e-4;
      const Z = 1 / A;
      const na = a * ct - b * st / Z, nb = a * Z * st + b * ct;
      const nc = c * ct + d * st / Z, nd = -c * Z * st + d * ct;
      a = na; b = nb; c = nc; d = nd;
      void ai; void bi; void ci; void di;
    }
    const mag = 1 / Math.sqrt(d * d + loss * loss * (1 + c * c));
    out[fi] = mag;
  }
  return out;
}
