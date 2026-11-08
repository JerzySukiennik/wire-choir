// Wire Choir audio graph: worklet loading, per-head voice nodes, reverb, master bus and state buffering for visuals.
import { NPAR, REST_PARAMS } from './voice/engine.js';

let moduleUrl = null;

async function workletSource() {
  if (moduleUrl) return moduleUrl;
  const base = new URL('./voice/', import.meta.url);
  const [eng, wk] = await Promise.all([
    fetch(new URL('engine.js', base)).then((r) => r.text()),
    fetch(new URL('worklet.js', base)).then((r) => r.text()),
  ]);
  const strip = (s) => s.replace(/^import .*$/gm, '').replace(/^export \{[^}]*\};?$/gm, '').replace(/^export (const|let|function|class) /gm, '$1 ');
  moduleUrl = URL.createObjectURL(new Blob([strip(eng) + '\n' + strip(wk)], { type: 'text/javascript' }));
  return moduleUrl;
}

function makeImpulse(ctx, secs, decay) {
  const len = Math.round(ctx.sampleRate * secs);
  const buf = ctx.createBuffer(2, len, ctx.sampleRate);
  for (let c = 0; c < 2; c++) {
    const d = buf.getChannelData(c);
    let lp = 0, seed = 1234 + c * 999;
    for (let i = 0; i < len; i++) {
      seed = (seed * 1664525 + 1013904223) >>> 0;
      const n = seed / 2147483648 - 1;
      const t = i / len;
      const a = 0.6 - 0.5 * t;
      lp += (n - lp) * a;
      const pre = i < ctx.sampleRate * 0.012 ? 0 : 1;
      d[i] = lp * Math.pow(1 - t, decay) * pre;
    }
  }
  return buf;
}

export class Voice {
  constructor(sys, opts) {
    this.sys = sys;
    const ctx = sys.ctx;
    this.node = new AudioWorkletNode(ctx, 'wire-voice', {
      numberOfInputs: 0, numberOfOutputs: 1, outputChannelCount: [1],
      processorOptions: { steps: opts.steps || sys.steps, seed: opts.seed || Math.floor(Math.random() * 1e9), cfg: opts.cfg },
    });
    this.gain = ctx.createGain();
    this.pan = ctx.createStereoPanner();
    this.send = ctx.createGain();
    this.node.connect(this.gain).connect(this.pan);
    this.pan.connect(sys.dry);
    this.pan.connect(this.send).connect(sys.wetIn);
    this.send.gain.value = 0.35;
    this.states = [];
    this.params = Float32Array.from(REST_PARAMS);
    this.f0 = 130;
    this.level = 0;
    this.onWord = null;
    this.node.port.onmessage = (e) => this._msg(e.data);
  }
  _msg(m) {
    if (m.t === 's') {
      this.states.push(m);
      if (this.states.length > 40) this.states.shift();
    } else if (m.t === 'ev') {
      for (const ev of m.ev) if (ev.t === 'w' && this.onWord) this.onWord(ev.id, ev.f / this.sys.ctx.sampleRate);
    }
  }
  sample() {
    const ctx = this.sys.ctx;
    const lat = (ctx.outputLatency || 0) + (ctx.baseLatency || 0);
    const f = (ctx.currentTime - lat) * ctx.sampleRate;
    const st = this.states;
    if (!st.length) return this;
    let a = st[0], b = st[st.length - 1];
    for (let i = st.length - 1; i >= 0; i--) if (st[i].f <= f) { a = st[i]; b = st[Math.min(i + 1, st.length - 1)]; break; }
    const k = b.f > a.f ? Math.min(1, Math.max(0, (f - a.f) / (b.f - a.f))) : 0;
    for (let i = 0; i < NPAR; i++) this.params[i] = a.p[i] + (b.p[i] - a.p[i]) * k;
    this.f0 = a.f0 + (b.f0 - a.f0) * k;
    this.level = a.lvl + (b.lvl - a.lvl) * k;
    return this;
  }
  configure(cfg) {
    this.node.port.postMessage({ t: 'cfg', cfg });
    if (cfg.volume !== undefined) this.gain.gain.setTargetAtTime(cfg.volume, this.sys.ctx.currentTime, 0.02);
    if (cfg.pan !== undefined) this.pan.pan.setTargetAtTime(cfg.pan, this.sys.ctx.currentTime, 0.02);
  }
  scheduleAt(segs, t0, replace) {
    this.node.port.postMessage({ t: 'segs', mode: 'abs', replace: !!replace, segs: segs.map((s) => ({ ...s, at: s.at + t0, p: Array.from(s.p) })) });
  }
  live(segs) {
    this.node.port.postMessage({ t: 'segs', mode: 'now', segs: segs.map((s) => ({ ...s, p: Array.from(s.p) })) });
  }
  release() { this.node.port.postMessage({ t: 'release' }); }
  stop() { this.node.port.postMessage({ t: 'clear' }); }
  dispose() {
    this.node.port.postMessage({ t: 'kill' });
    try { this.node.disconnect(); this.pan.disconnect(); this.send.disconnect(); } catch (e) {}
  }
}

export class AudioSystem {
  constructor() {
    this.ctx = null;
    this.ready = null;
    this.steps = 2;
  }
  async start(ctx) {
    if (this.ready) return this.ready;
    this.ready = (async () => {
      if (!ctx) {
        try { if (navigator.audioSession) navigator.audioSession.type = 'playback'; } catch (e) {}
        ctx = new (window.AudioContext || window.webkitAudioContext)({ latencyHint: 'interactive' });
      }
      this.ctx = ctx;
      const mobile = typeof navigator !== 'undefined' && /iPhone|iPad|Android/i.test(navigator.userAgent || '');
      this.steps = mobile ? 1 : 2;
      await ctx.audioWorklet.addModule(await workletSource());
      this.master = ctx.createGain();
      this.master.gain.value = 0.9;
      this.comp = ctx.createDynamicsCompressor();
      this.comp.threshold.value = -14; this.comp.knee.value = 10; this.comp.ratio.value = 4;
      this.comp.attack.value = 0.004; this.comp.release.value = 0.2;
      this.dry = ctx.createGain();
      this.wetIn = ctx.createGain();
      this.verb = ctx.createConvolver();
      this.verb.buffer = makeImpulse(ctx, 2.6, 3.2);
      this.wet = ctx.createGain();
      this.wet.gain.value = 0.55;
      this.dry.connect(this.master);
      this.wetIn.connect(this.verb).connect(this.wet).connect(this.master);
      this.master.connect(this.comp);
      this.comp.connect(ctx.destination);
      if (ctx.createMediaStreamDestination) this.stream = ctx.createMediaStreamDestination();
      if (this.stream) this.comp.connect(this.stream);
      return this;
    })();
    return this.ready;
  }
  resume() { if (this.ctx && this.ctx.state !== 'running') return this.ctx.resume(); }
  voice(opts) { return new Voice(this, opts || {}); }
  now() { return this.ctx.currentTime; }
}
