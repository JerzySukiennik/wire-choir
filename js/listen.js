// Wire Choir listening: beat grid, lead melody, bass line, drum pattern, key and chords from a recording.
export const LSR = 22050;
const HOP = 256;
const FPS = LSR / HOP;
const KK_MAJ = [6.35, 2.23, 3.48, 2.33, 4.38, 4.09, 2.52, 5.19, 2.39, 3.66, 2.29, 2.88];
const KK_MIN = [6.33, 2.68, 3.52, 5.38, 2.6, 3.53, 2.54, 4.75, 3.98, 2.69, 3.34, 3.17];
const MAJ = [0, 2, 4, 5, 7, 9, 11], MIN = [0, 2, 3, 5, 7, 8, 10];

function makeFFT(n) {
  const rev = new Uint32Array(n);
  const bits = Math.round(Math.log2(n));
  for (let i = 0; i < n; i++) { let r = 0; for (let b = 0; b < bits; b++) r |= ((i >> b) & 1) << (bits - 1 - b); rev[i] = r; }
  const cs = new Float32Array(n / 2), sn = new Float32Array(n / 2);
  for (let i = 0; i < n / 2; i++) { cs[i] = Math.cos((2 * Math.PI * i) / n); sn[i] = Math.sin((2 * Math.PI * i) / n); }
  return (re, im) => {
    for (let i = 0; i < n; i++) { const j = rev[i]; if (j > i) { let t = re[i]; re[i] = re[j]; re[j] = t; t = im[i]; im[i] = im[j]; im[j] = t; } }
    for (let size = 2; size <= n; size <<= 1) {
      const half = size >> 1, step = n / size;
      for (let i = 0; i < n; i += size) {
        for (let j = 0, k = 0; j < half; j++, k += step) {
          const a = i + j, b = a + half;
          const tr = re[b] * cs[k] + im[b] * sn[k], ti = im[b] * cs[k] - re[b] * sn[k];
          re[b] = re[a] - tr; im[b] = im[a] - ti; re[a] += tr; im[a] += ti;
        }
      }
    }
  };
}

function hann(n) { const w = new Float32Array(n); for (let i = 0; i < n; i++) w[i] = 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / n); return w; }

const tick = () => new Promise((r) => setTimeout(r, 0));

function percentile(arr, p) {
  const a = Array.from(arr).filter((v) => Number.isFinite(v)).sort((x, y) => x - y);
  if (!a.length) return 0;
  return a[Math.min(a.length - 1, Math.max(0, Math.floor(p * (a.length - 1))))];
}

function bandFlux(x, onProg) {
  const N = 1024, fft = makeFFT(N), win = hann(N);
  const frames = Math.max(1, Math.floor(x.length / HOP));
  const bands = { all: [1, 511], low: [2, 7], mel: [12, 140], snare: [46, 232], hat: [279, 511] };
  const out = {};
  for (const k in bands) out[k] = new Float32Array(frames);
  const re = new Float32Array(N), im = new Float32Array(N);
  let prev = new Float32Array(N / 2), cur = new Float32Array(N / 2);
  for (let f = 0; f < frames; f++) {
    const c = f * HOP - N / 2;
    for (let i = 0; i < N; i++) { const s = c + i; re[i] = s >= 0 && s < x.length ? x[s] * win[i] : 0; im[i] = 0; }
    fft(re, im);
    for (let b = 0; b < N / 2; b++) cur[b] = Math.log1p(60 * Math.hypot(re[b], im[b]));
    if (f > 0) for (const k in bands) {
      const [b0, b1] = bands[k];
      let s = 0;
      for (let b = b0; b <= b1; b++) { const d = cur[b] - prev[b]; if (d > 0) s += d; }
      out[k][f] = s / (b1 - b0 + 1);
    }
    const t = prev; prev = cur; cur = t;
    if (onProg && f % 600 === 0) onProg(f / frames);
  }
  return out;
}

function detrend(o, win) {
  const n = o.length, out = new Float32Array(n);
  const pre = new Float64Array(n + 1);
  for (let i = 0; i < n; i++) pre[i + 1] = pre[i] + o[i];
  for (let i = 0; i < n; i++) {
    const a = Math.max(0, i - win), b = Math.min(n, i + win + 1);
    const m = (pre[b] - pre[a]) / (b - a);
    out[i] = Math.max(0, o[i] - m);
  }
  return out;
}

function interp(a, x) {
  const i = Math.floor(x);
  if (i < 0 || i + 1 >= a.length) return 0;
  const f = x - i;
  return a[i] * (1 - f) + a[i + 1] * f;
}

function peakNear(a, x, r) {
  let m = 0;
  const i0 = Math.max(0, Math.floor(x - r)), i1 = Math.min(a.length - 1, Math.ceil(x + r));
  for (let i = i0; i <= i1; i++) if (a[i] > m) m = a[i];
  return m;
}

function findTempo(oss) {
  const n = oss.length;
  const minLag = Math.floor((60 / 170) * FPS), maxLag = Math.ceil((60 / 62) * FPS) * 4 + 4;
  const ac = new Float32Array(maxLag + 1);
  let mean = 0;
  for (let i = 0; i < n; i++) mean += oss[i];
  mean /= n;
  for (let L = minLag; L <= maxLag; L++) {
    let s = 0;
    for (let i = L; i < n; i++) s += (oss[i] - mean) * (oss[i - L] - mean);
    ac[L] = s / (n - L);
  }
  const cands = [];
  for (let bpm = 62; bpm <= 170; bpm += 0.5) {
    const lag = (60 / bpm) * FPS;
    let s = 0;
    for (let k = 1; k <= 4; k++) s += interp(ac, lag * k) / k;
    s += 0.5 * interp(ac, lag / 2);
    const prior = Math.exp(-0.5 * Math.pow(Math.log2(bpm / 118) / 0.55, 2));
    cands.push({ bpm, s: s * (0.4 + prior) });
  }
  cands.sort((a, b) => b.s - a.s);
  let best = { bpm: cands[0].bpm, phase: 0, s: -1e9 };
  for (let bpm = cands[0].bpm - 1.5; bpm <= cands[0].bpm + 1.5; bpm += 0.02) {
    const P = (60 / bpm) * FPS;
    const steps = 48;
    for (let k = 0; k < steps; k++) {
      const ph = (k / steps) * P;
      let s = 0, c = 0;
      for (let t = ph; t < n - 1; t += P) { s += peakNear(oss, t, 1); c++; }
      s /= Math.max(1, c);
      if (s > best.s) best = { bpm, phase: ph, s };
    }
  }
  const P = (60 / best.bpm) * FPS;
  let ph = best.phase;
  for (let it = 0; it < 2; it++) {
    let bestOff = 0, bs = -1;
    for (let off = -2; off <= 2; off += 0.25) {
      let s = 0;
      for (let t = ph + off; t < n - 1; t += P) s += interp(oss, t);
      if (s > bs) { bs = s; bestOff = off; }
    }
    ph += bestOff;
  }
  return { bpm: best.bpm, period: P, phase: ph };
}

function f2m(f) { return 69 + 12 * Math.log2(f / 440); }

export async function analyze(x, opts = {}) {
  const onProg = opts.onProgress || (() => {});
  const dur = x.length / LSR;
  let peak = 0;
  for (let i = 0; i < x.length; i++) { const a = Math.abs(x[i]); if (a > peak) peak = a; }
  if (peak < 1e-4) throw new Error('silent');
  const g = 0.9 / peak;
  const y = new Float32Array(x.length);
  for (let i = 0; i < x.length; i++) y[i] = x[i] * g;
  onProg(0.02);
  const flux = bandFlux(y, (p) => onProg(0.02 + p * 0.18));
  await tick();
  const oss = detrend(flux.all, Math.round(FPS * 0.25));
  const tempo = findTempo(oss);
  let bpm = tempo.bpm;
  const beatF = tempo.period;
  onProg(0.24);
  await tick();

  const N = 4096, fft = makeFFT(N), win = hann(N), bins = N / 2, binHz = LSR / N;
  const frames = Math.floor(y.length / HOP);
  const re = new Float32Array(N), im = new Float32Array(N), mag = new Float32Array(bins);
  const MEL_LO = 50, MEL_HI = 86, BAS_LO = 28, BAS_HI = 52;
  const SUB = 5, GRID_LO = 24, GRID = (96 - GRID_LO) * SUB;
  const melSal = new Float32Array(frames * 37), basSal = new Float32Array(frames * 25);
  const chromaF = new Float32Array(frames * 12), lowE = new Float32Array(frames);
  const sal = new Float32Array(GRID), salB = new Float32Array(GRID);
  const pk = [];
  for (let f = 0; f < frames; f++) {
    const c = f * HOP - N / 2;
    for (let i = 0; i < N; i++) { const s = c + i; re[i] = s >= 0 && s < y.length ? y[s] * win[i] : 0; im[i] = 0; }
    fft(re, im);
    let fmax = 0;
    for (let b = 0; b < bins; b++) { const m = Math.hypot(re[b], im[b]); mag[b] = m; if (m > fmax) fmax = m; }
    let le = 0;
    for (let b = Math.floor(35 / binHz); b <= Math.ceil(260 / binHz); b++) le += mag[b] * mag[b];
    lowE[f] = Math.sqrt(le);
    pk.length = 0;
    const floor = fmax * 0.006;
    for (let b = 2; b < Math.min(bins - 1, Math.floor(5000 / binHz)); b++) {
      const m = mag[b];
      if (m > floor && m > mag[b - 1] && m >= mag[b + 1]) {
        const l = Math.log(mag[b - 1] + 1e-9), cc = Math.log(m + 1e-9), r = Math.log(mag[b + 1] + 1e-9);
        const den = l - 2 * cc + r;
        const d = den !== 0 ? Math.max(-0.5, Math.min(0.5, (0.5 * (l - r)) / den)) : 0;
        pk.push({ f: (b + d) * binHz, a: m });
      }
    }
    pk.sort((p, q) => q.a - p.a);
    if (pk.length > 50) pk.length = 50;
    sal.fill(0); salB.fill(0);
    for (const p of pk) {
      const a = Math.pow(p.a / (fmax + 1e-9), 0.6);
      const mp = f2m(p.f);
      if (p.f > 80 && p.f < 2500) {
        const pc = ((Math.round(mp) % 12) + 12) % 12;
        chromaF[f * 12 + pc] += a;
      }
      if (p.f >= 170) {
        for (let h = 1; h <= 8; h++) {
          const m0 = mp - 12 * Math.log2(h);
          if (m0 < MEL_LO - 1) break;
          if (m0 > MEL_HI + 1) continue;
          const gi = (m0 - GRID_LO) * SUB;
          const wgt = a * Math.pow(0.82, h - 1);
          for (let k = Math.floor(gi - 2); k <= Math.ceil(gi + 2); k++) {
            if (k < 0 || k >= GRID) continue;
            const d = Math.abs(k - gi) / 2.5;
            if (d < 1) sal[k] += wgt * Math.cos((d * Math.PI) / 2) ** 2;
          }
        }
      }
      if (p.f <= 800) {
        for (let h = 1; h <= 6; h++) {
          const m0 = mp - 12 * Math.log2(h);
          if (m0 < BAS_LO - 1) break;
          if (m0 > BAS_HI + 1) continue;
          const gi = (m0 - GRID_LO) * SUB;
          const wgt = a * Math.pow(0.75, h - 1);
          for (let k = Math.floor(gi - 2); k <= Math.ceil(gi + 2); k++) {
            if (k < 0 || k >= GRID) continue;
            const d = Math.abs(k - gi) / 2.5;
            if (d < 1) salB[k] += wgt * Math.cos((d * Math.PI) / 2) ** 2;
          }
        }
      }
    }
    for (let m = MEL_LO; m <= MEL_HI; m++) {
      const gi = (m - GRID_LO) * SUB;
      let v = 0;
      for (let k = gi - 2; k <= gi + 2; k++) if (sal[k] > v) v = sal[k];
      melSal[f * 37 + (m - MEL_LO)] = v;
    }
    for (let m = BAS_LO; m <= BAS_HI; m++) {
      const gi = (m - GRID_LO) * SUB;
      let v = 0;
      for (let k = gi - 2; k <= gi + 2; k++) if (k >= 0 && salB[k] > v) v = salB[k];
      basSal[f * 25 + (m - BAS_LO)] = v;
    }
    if (f % 300 === 0) { onProg(0.26 + 0.6 * (f / frames)); await tick(); }
  }

  const beatsTotal = Math.floor((frames - tempo.phase) / beatF);
  const beatChroma = [];
  for (let j = 0; j < beatsTotal; j++) {
    const v = new Float32Array(12);
    const a = Math.floor(tempo.phase + j * beatF), b = Math.floor(tempo.phase + (j + 1) * beatF);
    for (let f = Math.max(0, a); f < Math.min(frames, b); f++) for (let k = 0; k < 12; k++) v[k] += chromaF[f * 12 + k];
    beatChroma.push(v);
  }
  const cosd = (u, v) => { let d = 0, nu = 0, nv = 0; for (let k = 0; k < 12; k++) { d += u[k] * v[k]; nu += u[k] * u[k]; nv += v[k] * v[k]; } return nu && nv ? d / Math.sqrt(nu * nv) : 1; };
  const lowO = detrend(flux.low, Math.round(FPS * 0.25));
  const lp95 = percentile(lowO, 0.95) || 1;
  const phaseScore = [0, 0, 0, 0];
  for (let j = 2; j < beatsTotal - 2; j++) {
    const add = (u, v) => u.map((x2, k) => x2 + v[k]);
    const before = add(beatChroma[j - 2], beatChroma[j - 1]), after = add(beatChroma[j], beatChroma[j + 1]);
    const nov = 1 - cosd(before, after);
    const kick = peakNear(lowO, tempo.phase + j * beatF, 2) / lp95;
    phaseScore[j % 4] += nov * 2 + 0.25 * Math.min(1.5, kick);
  }
  const down = phaseScore.indexOf(Math.max(...phaseScore));
  const startF = tempo.phase + down * beatF;
  const bars = Math.max(1, Math.floor((frames - startF) / (beatF * 4)));
  const slots = bars * 16;
  const slotF = beatF / 4;
  const slotOf = (s) => startF + s * slotF;
  onProg(0.88);
  await tick();

  const aggregate = (S, width) => {
    const out = [];
    for (let s = 0; s < slots; s++) {
      const a = Math.round(slotOf(s) + slotF * 0.15), b = Math.round(slotOf(s + 1) - slotF * 0.1);
      const v = new Float32Array(width);
      let c = 0;
      for (let f = Math.max(0, a); f < Math.min(frames, Math.max(a + 1, b)); f++) { for (let k = 0; k < width; k++) v[k] += S[f * width + k]; c++; }
      if (c) for (let k = 0; k < width; k++) v[k] /= c;
      out.push(v);
    }
    return out;
  };
  const melSlots = aggregate(melSal, 37);
  const basSlots = aggregate(basSal, 25);

  const track = (sl, width, lo, jump, vth, onsetCurve) => {
    const mx = sl.map((v) => Math.max(...v));
    const ref = percentile(mx, 0.9) || 1;
    const E = sl.map((v) => Array.from(v, (x2) => x2 / ref));
    const n = sl.length;
    const score = new Float32Array(width), back = [];
    for (let k = 0; k < width; k++) score[k] = E[0][k];
    back.push(new Int16Array(width));
    for (let s = 1; s < n; s++) {
      const nb = new Int16Array(width), ns = new Float32Array(width);
      for (let k = 0; k < width; k++) {
        let best = -1e9, bi = 0;
        for (let j = 0; j < width; j++) {
          const d = Math.abs(j - k);
          const pen = d === 0 ? 0 : jump * (0.4 + d * 0.06) + (d === 12 ? jump * 0.6 : 0);
          const v = score[j] - pen;
          if (v > best) { best = v; bi = j; }
        }
        ns[k] = best + E[s][k];
        nb[k] = bi;
      }
      score.set(ns);
      back.push(nb);
    }
    let k = 0;
    for (let j = 1; j < width; j++) if (score[j] > score[k]) k = j;
    const path = new Int16Array(n);
    for (let s = n - 1; s >= 0; s--) { path[s] = k; k = back[s][k]; }
    const voiced = mx.map((m) => m / ref > vth);
    const notes = [];
    let cur = null;
    for (let s = 0; s < n; s++) {
      if (!voiced[s]) { cur = null; continue; }
      const m = lo + path[s];
      const on = onsetCurve ? onsetCurve[s] : 0;
      if (cur && cur.m === m && on < 0.55) { cur.d += 0.25; cur.e = Math.max(cur.e, mx[s] / ref); continue; }
      cur = { b: s / 4, d: 0.25, m, e: mx[s] / ref };
      notes.push(cur);
    }
    return notes;
  };
  const slotOnset = (curve) => {
    const o = detrend(curve, Math.round(FPS * 0.2));
    const ref = percentile(o, 0.96) || 1;
    const out = new Float32Array(slots);
    for (let s = 0; s < slots; s++) out[s] = peakNear(o, slotOf(s), 2) / ref;
    return out;
  };
  const melOn = slotOnset(flux.mel);
  const lowOn = slotOnset(flux.low);
  let melody = track(melSlots, 37, MEL_LO, 0.35, 0.42, melOn);
  let bass = track(basSlots, 25, BAS_LO, 0.3, 0.38, lowOn);
  const clean = (ns, minD) => {
    const out = [];
    for (const n of ns) {
      const prev = out[out.length - 1];
      if (n.d < minD && prev && Math.abs(prev.b + prev.d - n.b) < 1e-6 && n.e < 0.9) { prev.d += n.d; continue; }
      out.push(n);
    }
    return out.filter((n) => n.d >= minD || n.e > 0.7);
  };
  melody = clean(melody, 0.25);
  bass = clean(bass, 0.25);
  onProg(0.93);
  await tick();

  const kick = slotOnset(flux.low), snare = slotOnset(flux.snare), hat = slotOnset(flux.hat);
  const barEnergy = [];
  for (let b = 0; b < bars; b++) { let e = 0; for (let s = b * 16; s < b * 16 + 16; s++) e += kick[s] + snare[s] + hat[s]; barEnergy.push(e); }
  const medE = percentile(barEnergy, 0.5) || 1;
  const avgOf = (arr) => {
    const avg = new Float32Array(16);
    let used = 0;
    for (let b = 0; b < bars; b++) { if (barEnergy[b] < medE * 0.4) continue; used++; for (let p = 0; p < 16; p++) avg[p] += arr[b * 16 + p]; }
    for (let p = 0; p < 16; p++) avg[p] /= Math.max(1, used);
    const top = Math.max(...avg) || 1;
    const mean = avg.reduce((a, b2) => a + b2, 0) / 16;
    return { v: Array.from(avg, (x2) => x2 / top), clear: top > 0.25 && top > mean * 1.5 };
  };
  const aK = avgOf(kick), aS = avgOf(snare), aH = avgOf(hat);
  const pattern = { K: [], S: [], H: [], O: [] };
  for (let p = 0; p < 16; p++) {
    if (aK.clear && aK.v[p] > 0.45) pattern.K.push({ p, v: aK.v[p] });
    const sv = aS.clear ? aS.v[p] : 0, hv = aH.clear ? aH.v[p] : 0;
    if (sv > 0.55 && sv > hv * 1.15) pattern.S.push({ p, v: sv });
    else if (hv > 0.4 && !(aK.clear && aK.v[p] > 0.45)) pattern[p % 4 === 2 && hv > 0.7 ? 'O' : 'H'].push({ p, v: hv });
  }
  const drums = [];
  const amps = { K: 0.8, S: 0.8, H: 0.3, O: 0.34 };
  for (let b = 0; b < bars; b++) {
    if (barEnergy[b] < medE * 0.4) continue;
    for (const type of ['K', 'S', 'H', 'O']) for (const o of pattern[type]) drums.push({ b: b * 4 + o.p / 4, type, amp: +(amps[type] * (0.75 + 0.25 * o.v)).toFixed(2) });
  }
  drums.sort((a, b2) => a.b - b2.b);

  const total = new Float32Array(12);
  const barChroma = [];
  for (let b = 0; b < bars; b++) {
    const v = new Float32Array(12);
    for (let j = b * 4 + down; j < b * 4 + down + 4 && j < beatChroma.length; j++) for (let k = 0; k < 12; k++) v[k] += beatChroma[j][k];
    for (const n of bass) if (n.b >= b * 4 && n.b < b * 4 + 4) v[((n.m % 12) + 12) % 12] += n.d * 0.6 * (percentile(v, 0.9) || 1);
    barChroma.push(v);
    for (let k = 0; k < 12; k++) total[k] += v[k];
  }
  for (const n of melody) total[((n.m % 12) + 12) % 12] += n.d * 0.15 * (percentile(total, 0.9) || 1) / Math.max(1, bars);
  const corr = (prof, rot) => {
    let mx2 = 0, my = 0;
    for (let k = 0; k < 12; k++) { mx2 += prof[k]; my += total[(k + rot) % 12]; }
    mx2 /= 12; my /= 12;
    let s = 0, sx = 0, sy = 0;
    for (let k = 0; k < 12; k++) { const a = prof[k] - mx2, c = total[(k + rot) % 12] - my; s += a * c; sx += a * a; sy += c * c; }
    return s / Math.sqrt(sx * sy + 1e-12);
  };
  let key = 0, mode = 'major', bk = -2;
  for (let r = 0; r < 12; r++) {
    const a = corr(KK_MAJ, r), c = corr(KK_MIN, r);
    if (a > bk) { bk = a; key = r; mode = 'major'; }
    if (c > bk) { bk = c; key = r; mode = 'minor'; }
  }
  const scale = (mode === 'major' ? MAJ : MIN).map((d) => (d + key) % 12);
  const inKey = (m) => scale.includes(((m % 12) + 12) % 12);
  const tidy = (ns) => {
    const out = [];
    for (const n of ns) {
      const prev = out[out.length - 1];
      if (!inKey(n.m) && n.d <= 0.25) {
        if (prev && Math.abs(prev.b + prev.d - n.b) < 1e-6) { prev.d += n.d; continue; }
        let best = n.m, bd = 9;
        for (const c of [n.m - 1, n.m + 1]) if (inKey(c) && Math.abs(c - n.m) < bd) { bd = Math.abs(c - n.m); best = c; }
        n.m = best;
      }
      if (prev && prev.m === n.m && Math.abs(prev.b + prev.d - n.b) < 1e-6 && n.d <= 0.25 && prev.d <= 0.25) { prev.d += n.d; continue; }
      out.push(n);
    }
    return out;
  };
  const dropFlat = (ns) => {
    const out = [];
    let i = 0;
    while (i < ns.length) {
      let j = i + 1;
      while (j < ns.length && ns[j].b - (ns[j - 1].b + ns[j - 1].d) < 1) j++;
      const ph = ns.slice(i, j);
      const pcs = new Set(ph.map((n) => n.m));
      const offKey = ph.filter((n) => !inKey(n.m)).length / ph.length;
      if (!(ph.length >= 4 && (pcs.size === 1 || offKey > 0.6))) out.push(...ph);
      i = j;
    }
    return out;
  };
  const octaves = (ns) => {
    for (let i = 0; i < ns.length; i++) {
      const nb = [];
      for (let k = Math.max(0, i - 4); k <= Math.min(ns.length - 1, i + 4); k++) if (k !== i && Math.abs(ns[k].b - ns[i].b) <= 4) nb.push(ns[k].m);
      if (nb.length < 2) continue;
      nb.sort((x, y) => x - y);
      const ref = nb[Math.floor(nb.length / 2)];
      while (ns[i].m - ref > 8.5) ns[i].m -= 12;
      while (ref - ns[i].m > 8.5) ns[i].m += 12;
    }
    return ns;
  };
  melody = dropFlat(tidy(octaves(melody)));
  bass = tidy(bass);
  const hush = (ns, offs) => {
    for (const n of ns) for (let sl = Math.round(n.b * 4); sl < Math.round((n.b + n.d) * 4) && sl < slots; sl++) {
      const v = melSlots[sl];
      for (const o of offs) for (let k = n.m + o - 1 - MEL_LO; k <= n.m + o + 1 - MEL_LO; k++) if (k >= 0 && k < 37) v[k] = 0;
    }
  };
  hush(melody, [-12, 0, 12, 19, 24]);
  hush(bass, [12, 19, 24, 28, 31, 36]);
  let riff = clean(track(melSlots, 37, MEL_LO, 0.35, 0.5, melOn), 0.25);
  riff = dropFlat(tidy(octaves(riff)));
  riff = riff.filter((n) => { const sl = Math.round(n.b * 4); return inKey(n.m) && !(sl < slots && hat[sl] > 0.45 && n.d <= 0.5 && melOn[sl] < hat[sl] * 1.2); });
  const repeats = (ns) => {
    const key2 = new Set(ns.map((n) => Math.round(n.b * 4) + ':' + (((n.m % 12) + 12) % 12)));
    let best = 0;
    for (const lag of [1, 2, 4]) {
      let hit = 0, tot = 0;
      for (const n of ns) { const sl = Math.round(n.b * 4); if (sl + lag * 16 >= slots) continue; tot++; if (key2.has(sl + lag * 16 + ':' + (((n.m % 12) + 12) % 12))) hit++; }
      if (tot >= 6) best = Math.max(best, hit / tot);
    }
    return best;
  };
  const riffRep = riff.length >= 8 ? repeats(riff) : 0;
  if (riff.length < 8 || riffRep < 0.45) riff = [];
  const chords = [];
  let prevC = null;
  for (let b = 0; b < bars; b++) {
    const v = barChroma[b];
    let best = null, bs = -1e9;
    for (let r = 0; r < 12; r++) for (const q of [0, 1]) {
      const pcs = [r, (r + (q ? 3 : 4)) % 12, (r + 7) % 12];
      let s = v[pcs[0]] * 1.0 + v[pcs[1]] * 0.8 + v[pcs[2]] * 0.8;
      let others = 0;
      for (let k = 0; k < 12; k++) if (!pcs.includes(k)) others += v[k];
      s -= others * 0.12;
      if (pcs.every((p) => scale.includes(p))) s *= 1.12;
      if (prevC && prevC[0] === r && prevC[1] === q) s *= 1.06;
      if (s > bs) { bs = s; best = [r, q]; }
    }
    chords.push(best);
    prevC = best;
  }
  if (bpm > 168) bpm /= 2;
  onProg(1);
  return {
    bpm: +bpm.toFixed(2), key, mode, bars, start: (startF * HOP) / LSR, duration: dur,
    melody: melody.map(({ b, d, m }) => ({ b, d, m })),
    bass: bass.map(({ b, d, m }) => ({ b, d, m })),
    riff: riff.map(({ b, d, m }) => ({ b, d, m })), riffRep: +riffRep.toFixed(2), melRep: +repeats(melody).toFixed(2),
    drums, chords, pattern: Object.fromEntries(Object.entries(pattern).map(([k, v]) => [k, v.map((o) => o.p)])),
  };
}

export async function toMono(buffer) {
  const len = Math.ceil(buffer.duration * LSR);
  const oc = new OfflineAudioContext(1, Math.max(1, len), LSR);
  const src = oc.createBufferSource();
  src.buffer = buffer;
  src.connect(oc.destination);
  src.start();
  const out = await oc.startRendering();
  return out.getChannelData(0);
}

export function overview(x, n) {
  const out = new Float32Array(n);
  const step = x.length / n;
  for (let i = 0; i < n; i++) {
    let m = 0;
    const a = Math.floor(i * step), b = Math.min(x.length, Math.floor((i + 1) * step));
    for (let k = a; k < b; k += 4) { const v = Math.abs(x[k]); if (v > m) m = v; }
    out[i] = m;
  }
  return out;
}

export function busiestWindow(x, len) {
  const sec = Math.floor(x.length / LSR);
  if (sec <= len) return 0;
  const e = new Float32Array(sec);
  for (let s = 0; s < sec; s++) { let a = 0; for (let k = s * LSR; k < (s + 1) * LSR; k += 8) a += x[k] * x[k]; e[s] = a; }
  let best = 0, bs = -1;
  for (let s = 0; s + len <= sec; s++) { let a = 0; for (let k = s; k < s + len; k++) a += e[k]; if (a > bs * 1.02) { bs = a; best = s; } }
  return best;
}
