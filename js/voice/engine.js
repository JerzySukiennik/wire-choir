// Wire Choir voice engine: LF glottis, Kelly-Lochbaum vocal tract with nasal branch, segment sequencer.
// Shared by the AudioWorklet (concatenated at runtime), offline WAV export and Node test tools.

export const SOUND_SPEED = 350;
export const NPAR = 13;
export const TX = 0, TD = 1, OPEN = 2, LIPD = 3, LIPR = 4, TIPX = 5, TIPD = 6, VEL = 7, VOICE = 8, ASP = 9, FRIC = 10, FRICX = 11, FRICF = 12;
export const REST_PARAMS = [0.5, 1.7, 0.12, 0.5, 0.15, 0.86, 3, 0.35, 0, 0, 0, 0.9, 3000];
export const NOSE_POS = 0.52;

const TAU = [0.05, 0.05, 0.06, 0.018, 0.05, 0.02, 0.012, 0.03, 0.014, 0.012, 0.01, 0.02, 0.02];
const GLOTTAL_REFL = 0.75;
const LIP_REFL = -0.85;
const NOSE_REFL = -0.85;

function clamp(x, a, b) { return x < a ? a : x > b ? b : x; }
function smooth01(x) { x = clamp(x, 0, 1); return x * x * (3 - 2 * x); }

export function tractShape(p, n, out) {
  const tx = p[TX], td = p[TD], open = p[OPEN], lipD = p[LIPD], lipR = p[LIPR], tipX = p[TIPX], tipD = p[TIPD];
  const front = clamp((tx - 0.42) / 0.33, 0, 1);
  const phar = 0.85 + 0.45 * front;
  const oral = 0.72 + 0.6 * open;
  const lipStart = 0.935 - 0.08 * lipR;
  for (let i = 0; i < n; i++) {
    const x = (i + 0.5) / n;
    let d;
    if (x < 0.07) d = 0.8 + 0.7 * (x / 0.07);
    else if (x < 0.16) d = 1.5 + 0.5 * smooth01((x - 0.07) / 0.09);
    else d = 2.0;
    if (x > 0.1) {
      const ow = smooth01((x - 0.42) / 0.16);
      d *= (1 - ow) * phar + ow * oral;
      const u = (x - tx) / 0.2;
      if (u > -1 && u < 1) {
        const t = 0.5 + 0.5 * Math.cos(Math.PI * u);
        d += (td - d) * t;
      }
    }
    if (tipD < 2.5) {
      const v = (x - tipX) / 0.05;
      if (v > -1 && v < 1) {
        const t = 0.5 + 0.5 * Math.cos(Math.PI * v);
        const dd = d + (tipD - d) * t;
        if (dd < d) d = dd;
      }
    }
    const ls = lipStart - 0.035;
    if (x > ls) {
      const t = smooth01((x - ls) / 0.05);
      d += (lipD - d) * t;
    }
    out[i] = d > 0 ? d : 0;
  }
  return out;
}

export function lfTable() {
  const tab = [];
  for (let r = 0; r <= 240; r++) {
    const Rd = 0.3 + r * 0.01;
    const Ra = (-1 + 4.8 * Rd) / 100;
    const Rk = (22.4 + 11.8 * Rd) / 100;
    const Rg = Rk / (4 * ((0.11 * Rd) / (0.5 + 1.2 * Rk) - Ra));
    const Ta = Ra, Tp = 1 / (2 * Rg), Te = Tp * (1 + Rk);
    let eps = 1 / Ta;
    for (let k = 0; k < 40; k++) eps = (1 - Math.exp(-eps * (1 - Te))) / Ta;
    const shift = Math.exp(-eps * (1 - Te));
    const I2 = -(1 / (eps * Ta)) * ((1 - shift) / eps - shift * (1 - Te));
    const w = Math.PI / Tp;
    const swe = Math.sin(w * Te), cwe = Math.cos(w * Te);
    const f = (a) => {
      const E0 = -1 / (Math.exp(a * Te) * swe);
      return E0 * (Math.exp(a * Te) * (a * swe - w * cwe) + w) / (a * a + w * w) + I2;
    };
    let lo = -10, hi = 60;
    const flo = f(lo);
    for (let k = 0; k < 60; k++) {
      const mid = 0.5 * (lo + hi);
      const fm = f(mid);
      if ((fm > 0) === (flo > 0)) lo = mid; else hi = mid;
    }
    const alpha = 0.5 * (lo + hi);
    const E0 = -1 / (Math.exp(alpha * Te) * swe);
    tab.push({ Te, Tp, Ta, eps, shift, alpha, E0, w });
  }
  return tab;
}

let LF_TABLE = null;

export class Glottis {
  constructor(fs) {
    this.fs = fs;
    if (!LF_TABLE) LF_TABLE = lfTable();
    this.phase = 0;
    this.lf0 = Math.log(130);
    this.lf0t = this.lf0;
    this.porta = 1 - Math.exp(-1 / (fs * 0.035));
    this.vibPhase = 0;
    this.vibEnv = 0;
    this.sinceNote = 0;
    this.drift = 0;
    this.driftT = 0;
    this.rd = 1.0;
    this.rdBase = 1.0;
    this.vibDepth = 30;
    this.vibRate = 5.6;
    this.rough = 0.1;
    this.shimmer = 1;
    this.sub = 0;
    this.periodIdx = 0;
    this.lf = LF_TABLE[70];
    this.flow = 0;
  }
  setTarget(f0, scoop) {
    if (!(f0 > 0)) return;
    const l = Math.log(f0);
    if (Math.abs(l - this.lf0t) > 0.01) {
      this.sinceNote = 0;
      if (scoop) this.lf0 = l - 0.06;
    }
    this.lf0t = l;
  }
  newPeriod(loud, rnd) {
    this.periodIdx++;
    const rd = clamp(this.rdBase + (0.55 - loud) * 0.5, 0.3, 2.7);
    this.rd = rd;
    this.lf = LF_TABLE[Math.round((rd - 0.3) * 100)];
    this.shimmer = 1 + (rnd() - 0.5) * 0.12 * this.rough;
    this.sub = this.rough > 0.5 ? (this.periodIdx & 1 ? -1 : 1) * (this.rough - 0.5) * 0.5 : 0;
  }
  step(loud, rnd) {
    this.lf0 += (this.lf0t - this.lf0) * this.porta;
    this.sinceNote += 1 / this.fs;
    const ve = this.sinceNote < 0.18 ? 0 : Math.min(1, (this.sinceNote - 0.18) / 0.45);
    this.vibEnv += (ve - this.vibEnv) * 0.001;
    this.vibPhase += this.vibRate / this.fs;
    if (this.vibPhase > 1) this.vibPhase -= 1;
    this.driftT -= 1;
    if (this.driftT <= 0) { this.driftT = this.fs * 0.05; this.driftGoal = (rnd() - 0.5) * (6 + 30 * this.rough); }
    this.drift += ((this.driftGoal || 0) - this.drift) * 0.0005;
    const cents = Math.sin(this.vibPhase * 6.283185307) * this.vibDepth * this.vibEnv + this.drift;
    const f = Math.exp(this.lf0 + cents * 0.000577623);
    this.phase += f / this.fs;
    if (this.phase >= 1) { this.phase -= 1; this.newPeriod(loud, rnd); }
    const L = this.lf, t = this.phase;
    let v;
    if (t <= L.Te) {
      v = L.E0 * Math.exp(L.alpha * t) * Math.sin(L.w * t);
      this.flow = Math.sin(Math.PI * t / L.Te);
    } else {
      v = -(1 / (L.eps * L.Ta)) * (Math.exp(-L.eps * (t - L.Te)) - L.shift);
      this.flow = 0;
    }
    return v * (this.shimmer + this.sub);
  }
}

export class Tract {
  constructor(fs, lengthCm, steps) {
    this.fs = fs;
    this.steps = steps;
    this.secLen = SOUND_SPEED / (fs * steps);
    this.n = Math.max(14, Math.round(lengthCm / 100 / this.secLen));
    this.nn = Math.max(8, Math.round(0.105 / this.secLen));
    this.ns = Math.round(this.n * NOSE_POS);
    const n = this.n, nn = this.nn;
    this.R = new Float32Array(n); this.L = new Float32Array(n);
    this.jR = new Float32Array(n + 1); this.jL = new Float32Array(n + 1);
    this.diam = new Float32Array(n);
    this.A0 = new Float32Array(n); this.A1 = new Float32Array(n);
    this.k0 = new Float32Array(n + 1); this.k1 = new Float32Array(n + 1);
    this.damp = new Float32Array(n);
    this.nR = new Float32Array(nn); this.nL = new Float32Array(nn);
    this.njR = new Float32Array(nn + 1); this.njL = new Float32Array(nn + 1);
    this.nk = new Float32Array(nn + 1);
    this.ndamp = new Float32Array(nn);
    this.velA0 = 0; this.velA1 = 0;
    this.noseActive = 0;
    const nd = new Float32Array(nn);
    for (let i = 0; i < nn; i++) {
      const x = i / nn;
      let d = x < 0.5 ? 0.4 + 1.6 * (x / 0.5) : 1.5 + 0.5 * (2 - 2 * x);
      d = Math.min(d, 1.9);
      nd[i] = d;
      this.ndamp[i] = 1 - 0.0016 / Math.max(d, 0.3) - 0.0004;
    }
    for (let i = 1; i < nn; i++) {
      const a = nd[i - 1] * nd[i - 1], b = nd[i] * nd[i];
      this.nk[i] = (a - b) / (a + b);
    }
    this.noseA0 = nd[0] * nd[0];
    this.first = true;
    this.radA = 1;
  }
  setShape(p) {
    const n = this.n;
    tractShape(p, n, this.diam);
    const A0 = this.A0, A1 = this.A1, k0 = this.k0, k1 = this.k1;
    for (let i = 0; i < n; i++) {
      A0[i] = A1[i];
      const d = this.diam[i];
      A1[i] = d * d + 1e-5;
      this.damp[i] = 1 - 0.0012 / Math.max(d, 0.25) - 0.0003;
    }
    for (let i = 1; i < n; i++) {
      k0[i] = k1[i];
      k1[i] = (A1[i - 1] - A1[i]) / (A1[i - 1] + A1[i]);
    }
    this.radA = A1[n - 1] / 4;
    this.velA0 = this.velA1;
    const v = p[VEL];
    this.velA1 = v * v * 0.9 + 0.0005;
    if (this.first) {
      this.first = false;
      A0.set(A1); k0.set(k1); this.velA0 = this.velA1;
    }
    if (this.velA1 > 0.01) this.noseActive = this.fs * 0.25;
  }
  step(src, lam, nIdx, nVal, nIdx2, nVal2) {
    const n = this.n, R = this.R, L = this.L, jR = this.jR, jL = this.jL, k0 = this.k0, k1 = this.k1, ns = this.ns;
    jR[0] = L[0] * GLOTTAL_REFL + src;
    jL[n] = R[n - 1] * LIP_REFL;
    for (let i = 1; i < n; i++) {
      if (i === ns && this.noseActive > 0) continue;
      const k = k0[i] + (k1[i] - k0[i]) * lam;
      const w = k * (R[i - 1] - L[i]);
      jR[i] = R[i - 1] + w;
      jL[i] = L[i] + w;
    }
    let noseOut = 0;
    if (this.noseActive > 0) {
      this.noseActive--;
      const a1 = this.A0[ns - 1] + (this.A1[ns - 1] - this.A0[ns - 1]) * lam;
      const a2 = this.A0[ns] + (this.A1[ns] - this.A0[ns]) * lam;
      const a3 = this.velA0 + (this.velA1 - this.velA0) * lam;
      const nR = this.nR, nL = this.nL, njR = this.njR, njL = this.njL, nk = this.nk, nn = this.nn;
      const pj = 2 * (a1 * R[ns - 1] + a2 * L[ns] + a3 * nL[0]) / (a1 + a2 + a3);
      jR[ns] = pj - L[ns];
      jL[ns] = pj - R[ns - 1];
      njR[0] = pj - nL[0];
      njL[nn] = nR[nn - 1] * NOSE_REFL;
      for (let i = 1; i < nn; i++) {
        const w = nk[i] * (nR[i - 1] - nL[i]);
        njR[i] = nR[i - 1] + w;
        njL[i] = nL[i] + w;
      }
      const nd = this.ndamp;
      for (let i = 0; i < nn; i++) { nR[i] = njR[i] * nd[i]; nL[i] = njL[i + 1] * nd[i]; }
      noseOut = nR[nn - 1];
    }
    if (nVal !== 0) { jR[nIdx] += nVal; jL[nIdx] += nVal; }
    if (nVal2 !== 0) { jR[nIdx2] += nVal2; jL[nIdx2] += nVal2; }
    const damp = this.damp;
    for (let i = 0; i < n; i++) { R[i] = jR[i] * damp[i]; L[i] = jL[i + 1] * damp[i]; }
    return R[n - 1] * this.radA + noseOut * 0.35;
  }
}

function makeRng(seed) {
  let s = seed >>> 0 || 1;
  return () => {
    s ^= s << 13; s >>>= 0; s ^= s >> 17; s ^= s << 5; s >>>= 0;
    return s / 4294967296;
  };
}

class Biquad {
  constructor() { this.b0 = 1; this.b1 = 0; this.b2 = 0; this.a1 = 0; this.a2 = 0; this.x1 = 0; this.x2 = 0; this.y1 = 0; this.y2 = 0; }
  bandpass(fs, f, q) {
    const w = 2 * Math.PI * clamp(f, 40, fs * 0.45) / fs, al = Math.sin(w) / (2 * q), c = Math.cos(w), a0 = 1 + al;
    this.b0 = al / a0; this.b1 = 0; this.b2 = -al / a0; this.a1 = -2 * c / a0; this.a2 = (1 - al) / a0;
  }
  run(x) {
    const y = this.b0 * x + this.b1 * this.x1 + this.b2 * this.x2 - this.a1 * this.y1 - this.a2 * this.y2;
    this.x2 = this.x1; this.x1 = x; this.y2 = this.y1; this.y1 = y;
    return y;
  }
}

export const DEFAULT_CFG = { tract: 17, rd: 1.0, breath: 0.15, vib: 30, vibRate: 5.6, rough: 0.1, gain: 1, nasal: 0 };

export class VoiceEngine {
  constructor(fs, steps, seed) {
    this.fs = fs;
    this.steps = steps || 2;
    this.rnd = makeRng(seed || 12345);
    this.frame = 0;
    this.cfg = Object.assign({}, DEFAULT_CFG);
    this.glottis = new Glottis(fs);
    this.tract = new Tract(fs, this.cfg.tract, this.steps);
    this.cur = Float32Array.from(REST_PARAMS);
    this.tgt = Float32Array.from(REST_PARAMS);
    this.prevVoice = 0; this.prevAsp = 0; this.prevFric = 0;
    this.queue = [];
    this.seg = null;
    this.segEnd = 0;
    this.fricF = new Biquad(); this.fricF.bandpass(fs, 3000, 1);
    this.lastFricF = 3000;
    this.burstF = new Biquad(); this.burstF.bandpass(fs, 2500, 0.7);
    this.aspHP = 0; this.aspLP = 0;
    this.burst = 0; this.burstDecay = Math.exp(-1 / (fs * 0.007)); this.burstX = 0.9;
    this.hp = 0; this.hpx = 0;
    this.events = [];
    this.level = 0;
    this.quiet = 0;
    this.B = 64;
    this.coefs = TAU.map((t) => 1 - Math.exp(-this.B / (fs * t)));
    this.configure({});
  }
  configure(c) {
    const old = this.cfg.tract;
    Object.assign(this.cfg, c);
    const g = this.glottis;
    g.rdBase = this.cfg.rd; g.vibDepth = this.cfg.vib; g.vibRate = this.cfg.vibRate; g.rough = this.cfg.rough;
    if (Math.abs(this.cfg.tract - old) > 0.05) this.tract = new Tract(this.fs, this.cfg.tract, this.steps);
  }
  clear(soft) {
    this.queue.length = 0;
    this._startSeg({ at: this.frame, len: Math.round(this.fs * 0.2), p: REST_PARAMS, f0: 0 });
    if (!soft) this.events.length = 0;
  }
  schedule(segs, mode) {
    if (mode === 'now') {
      this.queue.length = 0;
      let t = this.frame;
      for (const s of segs) { s.at = t; t += s.len; this.queue.push(s); }
      if (this.seg && this.seg.hold) { this.seg.hold = false; this.segEnd = this.frame; }
    } else {
      for (const s of segs) this.queue.push(s);
      this.queue.sort((a, b) => a.at - b.at);
    }
  }
  release() {
    if (this.seg && this.seg.hold) { this.seg.hold = false; this.segEnd = this.frame; }
  }
  _startSeg(s) {
    this.seg = s;
    this.segEnd = s.at + s.len;
    const p = s.p;
    for (let k = 0; k < NPAR; k++) this.tgt[k] = p[k];
    if (s.f0 > 0) this.glottis.setTarget(s.f0, this.cur[VOICE] < 0.05 && p[VOICE] > 0.05);
    if (s.burst > 0) { this.burst = s.burst; this.burstX = s.burstX; }
    if (s.w !== undefined && s.w >= 0) this.events.push({ t: 'w', id: s.w, f: this.frame });
  }
  _sequence() {
    const q = this.queue;
    const horizon = this.frame + (this.B >> 1);
    while (q.length && q[0].at <= horizon) this._startSeg(q.shift());
    if (this.seg && !this.seg.hold && this.frame >= this.segEnd && !q.length && this.seg.p !== REST_PARAMS && this.seg.rest !== true) {
      this._startSeg({ at: this.frame, len: 1, p: REST_PARAMS, f0: 0, rest: true });
    }
  }
  render(out, off, n) {
    let i = 0;
    while (i < n) {
      const b = Math.min(this.B, n - i);
      this._chunk(out, off + i, b);
      i += b;
    }
  }
  _chunk(out, off, B) {
    this._sequence();
    const cur = this.cur, tgt = this.tgt, cf = this.coefs;
    const pv0 = cur[VOICE], pa0 = cur[ASP], pf0 = cur[FRIC];
    for (let k = 0; k < NPAR; k++) cur[k] += (tgt[k] - cur[k]) * cf[k];
    const active = cur[VOICE] > 0.002 || cur[ASP] > 0.002 || cur[FRIC] > 0.002 || this.burst > 0.002 || tgt[VOICE] > 0 || tgt[ASP] > 0 || tgt[FRIC] > 0;
    if (!active && this.level < 1e-4) {
      this.quiet += B;
      if (this.quiet > this.fs * 0.3) {
        for (let s = 0; s < B; s++) out[off + s] = 0;
        this.frame += B;
        this.tract.setShape(cur);
        return;
      }
    } else this.quiet = 0;
    const tr = this.tract;
    tr.setShape(cur);
    if (Math.abs(cur[FRICF] - this.lastFricF) > 40) { this.fricF.bandpass(this.fs, cur[FRICF], 1.1); this.lastFricF = cur[FRICF]; }
    const n = tr.n, steps = this.steps, g = this.glottis, rnd = this.rnd, cfg = this.cfg;
    const fi = clamp(Math.round(cur[FRICX] * n), 1, n - 1);
    let fd = 9;
    for (let j = Math.max(0, fi - 5); j <= fi; j++) if (tr.diam[j] < fd) fd = tr.diam[j];
    const fricOpen = smooth01((fd - 0.02) / 0.14) * (1 - smooth01((fd - 0.55) / 0.9));
    const bi = clamp(Math.round(this.burstX * n), 1, n - 1);
    const gain = cfg.gain * 4.5;
    let lvl = 0;
    for (let s = 0; s < B; s++) {
      const lam = (s + 1) / B;
      const voice = pv0 + (cur[VOICE] - pv0) * lam;
      const asp = pa0 + (cur[ASP] - pa0) * lam;
      const fric = pf0 + (cur[FRIC] - pf0) * lam;
      const gv = g.step(voice, rnd);
      const white = rnd() * 2 - 1;
      this.aspLP += (white - this.aspLP) * 0.35;
      this.aspHP += (this.aspLP - this.aspHP) * 0.02;
      const aspN = this.aspLP - this.aspHP;
      const breathy = cfg.breath * voice * (0.25 + 0.75 * g.flow);
      const src = gv * voice + aspN * (asp * 0.9 + breathy * 0.6);
      let nv = 0;
      if (fric > 0.001) {
        const mod = voice > 0.1 ? 0.45 + 0.55 * g.flow : 1;
        nv = this.fricF.run(rnd() * 2 - 1) * fric * fricOpen * mod * 0.9;
      }
      let bv = 0;
      if (this.burst > 0.002) {
        bv = this.burstF.run(rnd() * 2 - 1) * this.burst * 1.6;
        this.burst *= this.burstDecay;
      }
      let o = 0;
      for (let k = 0; k < steps; k++) {
        const l2 = steps === 2 ? (k === 0 ? lam - 0.5 / B : lam) : lam;
        o += tr.step(k === 0 ? src : 0, l2, fi, k === 0 ? nv : 0, bi, k === 0 ? bv : 0);
      }
      o /= steps;
      const y = o - this.hpx + 0.995 * this.hp;
      this.hpx = o; this.hp = y;
      const v = y * gain;
      out[off + s] = v;
      lvl += v * v;
    }
    this.level = Math.sqrt(lvl / B);
    this.frame += B;
  }
}
