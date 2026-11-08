// Wire Choir player: keeps one voice per head, schedules arranged parts, reports playback time and word events.
import { planNotes, planDrums, planLiveOn, planLiveOff } from './voice/planner.js';
import { engineCfg, midiToHz } from './voices.js';
import { vowelParams } from './voice/phonemes.js';

export class Player {
  constructor(sys) {
    this.sys = sys;
    this.voices = new Map();
    this.t0 = 0;
    this.dur = 0;
    this.playing = false;
    this.onWord = null;
    this.onEnd = null;
    this.endTimer = 0;
  }

  sync(heads) {
    const ids = new Set(heads.map((h) => h.id));
    for (const [id, v] of this.voices) if (!ids.has(id)) { v.dispose(); this.voices.delete(id); }
    heads.forEach((h, i) => {
      let v = this.voices.get(h.id);
      if (!v) {
        v = this.sys.voice({ cfg: engineCfg(h) });
        v.onWord = (w) => this.onWord && this.onWord(h.id, w);
        this.voices.set(h.id, v);
      }
      const n = heads.length;
      const pan = n === 1 ? 0 : (i / (n - 1) - 0.5) * 0.9;
      v.configure(Object.assign(engineCfg(h), { volume: (h.volume ?? 1) * (h.role === 'beatbox' ? 1.1 : h.role === 'choir' ? 0.8 : 1), pan: h.pan ?? pan }));
    });
  }

  play(arr, parts, lang, heads, dur) {
    this.stop(true);
    const ctx = this.sys.ctx;
    this.t0 = ctx.currentTime + 0.12;
    this.dur = dur || arr.duration;
    for (const h of heads) {
      const v = this.voices.get(h.id), p = parts[h.id];
      if (!v || !p) continue;
      const segs = p.drums.length ? planDrums(p.drums) : planNotes(p.notes, lang);
      v.scheduleAt(segs, this.t0, true);
    }
    this.playing = true;
    clearTimeout(this.endTimer);
    this.endTimer = setTimeout(() => { this.playing = false; if (this.onEnd) this.onEnd(); }, (this.dur + 0.3) * 1000);
  }

  stop(silent) {
    clearTimeout(this.endTimer);
    for (const v of this.voices.values()) v.stop();
    const was = this.playing;
    this.playing = false;
    if (was && !silent && this.onEnd) this.onEnd();
  }

  time() {
    const ctx = this.sys.ctx;
    if (!ctx) return 0;
    const lat = (ctx.outputLatency || 0) + (ctx.baseLatency || 0);
    return ctx.currentTime - lat - this.t0;
  }

  preview(h, on, midi) {
    const v = this.voices.get(h.id);
    if (!v) return;
    if (on) {
      const m = midi ?? Math.round((h.lo + h.hi) / 2 + (h.shift || 0));
      const vowel = h.role === 'choir' ? h.vowel || 'u' : 'a';
      v.live([{ len: 1e9, hold: true, p: vowelParams(vowel, 0.8), f0: midiToHz(m), burst: 0, burstX: 0, w: -1 }]);
    } else {
      v.live([{ len: 0.3, p: vowelParams('@', 0), f0: 0, burst: 0, burstX: 0, w: -1, rest: true }]);
    }
  }

  liveOn(h, syl, midi, lang, prev, w) {
    const v = this.voices.get(h.id);
    if (v) v.live(planLiveOn(syl, midiToHz(midi), 0.85, lang, prev, 0.85, w));
  }

  liveOff(h, syl, lang) {
    const v = this.voices.get(h.id);
    if (v) v.live(planLiveOff(syl, 0.85, lang));
  }

  voiceOf(id) { return this.voices.get(id); }
}
