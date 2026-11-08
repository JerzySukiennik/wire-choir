// Wire Choir AudioWorklet wrapper; engine.js is prepended at load time (see audio.js).

class WireVoiceProcessor extends AudioWorkletProcessor {
  constructor(opts) {
    super();
    const o = (opts && opts.processorOptions) || {};
    this.eng = new VoiceEngine(sampleRate, o.steps || 2, o.seed || 1);
    if (o.cfg) this.eng.configure(o.cfg);
    this.tick = 0;
    this.alive = true;
    this.port.onmessage = (e) => this.onMsg(e.data);
  }
  onMsg(m) {
    const e = this.eng;
    if (m.t === 'cfg') e.configure(m.cfg);
    else if (m.t === 'segs') {
      const segs = m.segs.map((s) => ({
        at: m.mode === 'abs' ? Math.round(s.at * sampleRate) : 0,
        len: Math.max(1, Math.round(Math.min(s.len, 1e5) * sampleRate)),
        p: s.p, f0: s.f0, burst: s.burst || 0, burstX: s.burstX || 0, w: s.w, hold: !!s.hold, rest: !!s.rest,
      }));
      if (m.replace) e.queue.length = 0;
      e.schedule(segs, m.mode === 'abs' ? 'abs' : 'now');
    } else if (m.t === 'release') e.release();
    else if (m.t === 'clear') e.clear(true);
    else if (m.t === 'kill') this.alive = false;
  }
  process(inputs, outputs) {
    const out = outputs[0];
    if (!out || !out[0]) return this.alive;
    const ch = out[0];
    this.eng.frame = currentFrame;
    this.eng.render(ch, 0, ch.length);
    for (let c = 1; c < out.length; c++) out[c].set(ch);
    const ev = this.eng.events;
    if (ev.length) { this.port.postMessage({ t: 'ev', ev: ev.slice() }); ev.length = 0; }
    if (++this.tick >= 4) {
      this.tick = 0;
      const e = this.eng;
      this.port.postMessage({ t: 's', f: currentFrame, p: Array.from(e.cur), f0: Math.exp(e.glottis.lf0), lvl: e.level });
    }
    return this.alive;
  }
}

registerProcessor('wire-voice', WireVoiceProcessor);
