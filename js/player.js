// Wire Choir player: renders every head's part as cached CHIMERA units, schedules them sample-accurately, animates the heads from telemetry, and keeps the light engine for live keys and previews.
import { planLiveOn, planLiveOff } from './voice/planner.js';
import { engineCfg, midiToHz } from './voices.js';
import { vowelParams } from './voice/phonemes.js';
import { REST_PARAMS, NPAR } from './voice/engine.js';
import { RenderPool } from './chimera/pool.js';
import { buildUnits, teleToParams, auditionSpec } from './chimera/units.js';
import { TELE_SIZE } from './chimera/core.js';

export const pool = new RenderPool();

export function voiceMix(heads, i, h) {
  const n = heads.length;
  const pan = n === 1 ? 0 : (i / (n - 1) - 0.5) * 0.9;
  const share = Math.min(1.25, 1.25 / Math.sqrt(Math.max(1, n)));
  const role = h.role === 'lead' ? (n > 1 ? 1.35 : 1) : h.role === 'beatbox' ? 1.1 : h.role === 'choir' ? 0.85 : h.role === 'inst' ? 0.78 : 1;
  return { volume: share * (h.volume ?? 1) * role, pan: h.pan ?? pan };
}

export function unitBuffer(ctx, u) {
  if (u.buffer && u.bufferCtx === ctx) return u.buffer;
  const b = ctx.createBuffer(1, u.pcm.length, u.fs);
  b.copyToChannel(u.pcm, 0);
  u.buffer = b; u.bufferCtx = ctx;
  return b;
}

class HeadOut {
  constructor(sys, h) {
    this.sys = sys;
    this.id = h.id;
    this.strip = sys.strip();
    this.live = null;
    this.liveSteps = 0;
    this.timeline = [];
    this.params = Float32Array.from(REST_PARAMS);
    this.tmp = new Float32Array(NPAR);
    this.f0 = 130;
    this.level = 0;
    this.restF0 = 130;
  }
  liveVoice(h) {
    const steps = this.sys.steps;
    if (this.live && this.liveSteps !== steps) { this.live.dispose(); this.live = null; }
    if (!this.live) {
      this.live = this.sys.voice({ cfg: engineCfg(h), steps, out: this.strip.gain });
      this.live.onWord = (w) => this.wordCb && this.wordCb(w);
      this.liveSteps = steps;
    }
    this.live.configure(engineCfg(h));
    this.liveUntil = performance.now() + 4000;
    return this.live;
  }
  clear() {
    for (const it of this.timeline) { try { it.src.stop(); } catch (e) {} try { it.src.disconnect(); } catch (e) {} }
    this.timeline = [];
  }
  sample() {
    const ctx = this.sys.ctx;
    const now = ctx.currentTime - ((ctx.outputLatency || 0) + (ctx.baseLatency || 0));
    let hit = null;
    for (let i = this.timeline.length - 1; i >= 0; i--) {
      const it = this.timeline[i];
      if (now >= it.start && now < it.end) { hit = it; break; }
    }
    if (hit) {
      const u = hit.unit;
      const frames = u.tele.length / TELE_SIZE;
      const x = ((now - hit.start) * u.fs) / u.hop - 1;
      const i0 = Math.max(0, Math.min(frames - 1, Math.floor(x))), i1 = Math.min(frames - 1, i0 + 1), k = Math.max(0, Math.min(1, x - i0));
      teleToParams(u.tele, i0, this.params);
      teleToParams(u.tele, i1, this.tmp);
      for (let p = 0; p < NPAR; p++) this.params[p] += (this.tmp[p] - this.params[p]) * k;
      const o0 = i0 * TELE_SIZE, o1 = i1 * TELE_SIZE;
      this.level = (u.tele[o0 + 1] + (u.tele[o1 + 1] - u.tele[o0 + 1]) * k) * (u.tele[o0] === 1 ? 1.2 : 0.55);
      const f = u.tele[o0 + 3];
      if (f > 20 && u.tele[o0] !== 1) this.f0 = f;
      return this;
    }
    if (this.live && (this.live.level > 0.0005 || performance.now() < (this.liveUntil || 0))) {
      this.live.sample();
      this.params.set(this.live.params);
      this.level = this.live.level;
      this.f0 = this.live.f0;
      return this;
    }
    for (let p = 0; p < NPAR; p++) this.params[p] += (REST_PARAMS[p] - this.params[p]) * 0.18;
    this.level *= 0.8;
    return this;
  }
  dispose() {
    this.clear();
    if (this.live) this.live.dispose();
    this.strip.dispose();
  }
}

export class Player {
  constructor(sys) {
    this.sys = sys;
    this.voices = new Map();
    this.t0 = 0;
    this.dur = 0;
    this.playing = false;
    this.loading = null;
    this.onWord = null;
    this.onEnd = null;
    this.onProgress = null;
    this.endTimer = 0;
    this.token = 0;
    this.words = [];
    this.wordAt = 0;
    this.pinned = [];
  }

  sync(heads) {
    const ids = new Set(heads.map((h) => h.id));
    for (const [id, v] of this.voices) if (!ids.has(id)) { v.dispose(); this.voices.delete(id); }
    heads.forEach((h, i) => {
      let v = this.voices.get(h.id);
      if (!v) { v = new HeadOut(this.sys, h); v.wordCb = (w) => this.onWord && this.onWord(h.id, w); this.voices.set(h.id, v); }
      v.restF0 = midiToHz((h.lo + h.hi) / 2 + (h.shift || 0));
      v.strip.set(Object.assign({ send: engineCfg(h).send }, voiceMix(heads, i, h)));
      if (v.live) v.live.configure(engineCfg(h));
    });
  }

  units(arr, parts, lang, heads) { return buildUnits(arr, parts, heads, lang, this.sys.ctx.sampleRate); }

  prepare(arr, parts, lang, heads) {
    if (!this.sys.ctx || this.loading) return;
    pool.drop(1);
    for (const u of this.units(arr, parts, lang, heads)) pool.request(u.spec, 1).catch(() => {});
  }

  async play(arr, parts, lang, heads, dur) {
    this.stop(true);
    const token = ++this.token;
    const ctx = this.sys.ctx;
    const units = this.units(arr, parts, lang, heads).sort((a, b) => a.at - b.at);
    const got = new Array(units.length).fill(null);
    let done = 0, started = false, failed = null;
    this.loading = { done: 0, total: units.length };
    const report = () => { if (token === this.token && this.loading) { this.loading.done = done; if (this.onProgress) this.onProgress(done, units.length); } };
    report();
    pool.drop(1);
    const place = (i) => {
      const u = units[i], unit = got[i], out = this.voices.get(u.head);
      if (!out || !unit) return;
      const now = ctx.currentTime;
      const start = this.t0 + u.at - unit.lead, end = start + unit.pcm.length / unit.fs;
      if (end <= now + 0.02) return;
      const src = ctx.createBufferSource();
      src.buffer = unitBuffer(ctx, unit);
      src.connect(out.strip.gain);
      let when = start, off = 0;
      if (when < now + 0.01) { off = now + 0.01 - when; when = now + 0.01; }
      src.start(when, off);
      out.timeline.push({ src, unit, start, end });
    };
    const ready = () => {
      if (done === units.length) return true;
      if (!pool.speed) return false;
      const rate = pool.speed * Math.max(1, Math.min(pool.size, units.length - done));
      let work = 0;
      for (let i = 0; i < units.length; i++) {
        if (got[i]) continue;
        work += units[i].len + 0.7;
        if ((work / rate) * 1.3 + 0.4 > 0.32 + units[i].at - 0.3) return false;
      }
      return true;
    };
    const begin = () => {
      if (started || token !== this.token) return;
      started = true;
      const now = ctx.currentTime;
      this.t0 = now + 0.32;
      this.dur = dur || arr.duration;
      for (let i = 0; i < units.length; i++) place(i);
      this.words = [];
      for (const h of heads) {
        const p = parts[h.id];
        if (!p || !p.notes) continue;
        for (const n of p.notes) if (n.w >= 0) this.words.push({ t: n.t, head: h.id, w: n.w });
        for (const m of p.marks || []) this.words.push({ t: m.t, head: h.id, w: m.w });
      }
      this.words.sort((a, b) => a.t - b.t);
      this.wordAt = 0;
      this.playing = true;
      clearTimeout(this.endTimer);
      this.endTimer = setTimeout(() => { this.playing = false; if (this.onEnd) this.onEnd(); }, (this.t0 - now + this.dur + 0.3) * 1000);
    };
    for (const sp of this.pinned) pool.pin(sp, false);
    this.pinned = units.map((u) => u.spec);
    return new Promise((resolve, reject) => {
      const check = () => {
        if (token !== this.token) { resolve(false); return true; }
        if (failed) { this.loading = null; if (this.onProgress) this.onProgress(0, 0); reject(failed); return true; }
        if (!started && ready()) { begin(); resolve(true); }
        if (done === units.length) { this.loading = null; if (this.onProgress) this.onProgress(done, done); return true; }
        return false;
      };
      units.forEach((u, i) => {
        pool.request(u.spec, 10 - Math.min(9, u.at * 0.05)).then((unit) => {
          if (token !== this.token) return;
          got[i] = unit; done++;
          pool.pin(u.spec, true);
          report();
          if (started) place(i);
          check();
        }, (e) => { if (token === this.token && !(e && e.message === 'dropped')) failed = e; check(); });
      });
      if (!units.length) { begin(); this.loading = null; resolve(true); }
    });
  }

  frame() {
    if (!this.playing || !this.onWord) return;
    const tt = this.time() + 0.03;
    while (this.wordAt < this.words.length && this.words[this.wordAt].t <= tt) {
      const w = this.words[this.wordAt++];
      this.onWord(w.head, w.w);
    }
  }

  stop(silent) {
    this.token++;
    this.audTok = (this.audTok || 0) + 1;
    if (this.loading) pool.drop(99);
    clearTimeout(this.endTimer);
    for (const v of this.voices.values()) { v.clear(); if (v.live) v.live.stop(); }
    const was = this.playing || !!this.loading;
    this.playing = false;
    if (this.loading) { this.loading = null; if (this.onProgress) this.onProgress(0, 0); }
    if (was && !silent && this.onEnd) this.onEnd();
  }

  time() {
    const ctx = this.sys.ctx;
    if (!ctx) return 0;
    const lat = (ctx.outputLatency || 0) + (ctx.baseLatency || 0);
    return ctx.currentTime - lat - this.t0;
  }

  async audition(h, beatText) {
    const out = this.voices.get(h.id);
    if (!out) return;
    const ctx = this.sys.ctx;
    const tok = (this.audTok = (this.audTok || 0) + 1);
    const unit = await pool.request(auditionSpec(h, ctx.sampleRate, beatText), 20);
    if (tok !== this.audTok || this.playing || this.loading) return;
    if (out.aud) { try { out.aud.stop(); } catch (e) {} }
    out.timeline = out.timeline.filter((it) => !it.aud);
    const src = ctx.createBufferSource();
    src.buffer = unitBuffer(ctx, unit);
    src.connect(out.strip.gain);
    const start = ctx.currentTime + 0.03 - unit.lead * 0.6;
    src.start(ctx.currentTime + 0.03, unit.lead * 0.6);
    out.aud = src;
    out.timeline.push({ src, unit, start, end: start + unit.pcm.length / unit.fs, aud: true });
  }

  preview(h, on, midi) {
    const out = this.voices.get(h.id);
    if (!out) return;
    const v = out.liveVoice(h);
    if (on) {
      const m = midi ?? Math.round((h.lo + h.hi) / 2 + (h.shift || 0));
      const vowel = h.role === 'choir' ? h.vowel || 'u' : 'a';
      v.live([{ len: 1e9, hold: true, p: vowelParams(vowel, 0.8), f0: midiToHz(m), burst: 0, burstX: 0, w: -1 }]);
    } else {
      v.live([{ len: 0.3, p: vowelParams('@', 0), f0: 0, burst: 0, burstX: 0, w: -1, rest: true }]);
    }
  }

  liveOn(h, syl, midi, lang, prev, w) {
    const out = this.voices.get(h.id);
    if (out) out.liveVoice(h).live(planLiveOn(syl, midiToHz(midi), 0.85, lang, prev, 0.85, w));
  }

  liveOff(h, syl, lang) {
    const out = this.voices.get(h.id);
    if (out) out.liveVoice(h).live(planLiveOff(syl, 0.85, lang));
  }

  voiceOf(id) { return this.voices.get(id); }
}
