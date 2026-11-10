// Wire Choir binding to the CHIMERA voice engine (github.com/jamesondh/chimera-vocal-synth, MIT): wasm instance, JSON calls, gesture records, engines.
export const GESTURE_RECORD = 272;
export const STEP_RECORD = 48;
export const MAX_GESTURES = 4000;
export const MAX_RENDER = 4096;
export const CONTROL_KEYS = ['jaw', 'tbX', 'tbY', 'ttX', 'ttY', 'ttCurl', 'root', 'lipAp', 'lipProt', 'lipWidth', 'labiodental', 'velum', 'larynx', 'epilarynx', 'ventricular', 'lateral', 'dorsum', 'abduction', 'closure', 'breath', 'f0', 'vibrato'];
export const ARTIC_KEYS = CONTROL_KEYS.slice(0, 17);
export const SOURCE_KEYS = ['f0', 'glide', 'pressure', 'breathiness', 'tension', 'fry', 'roughness', 'vibratoDepth', 'vibratoRate', 'drift', 'voiced', 'brightness'];
export const TELE_HEADER = 16;
const KEY_INDEX = Object.fromEntries(CONTROL_KEYS.map((k, i) => [k, i]));
const LABEL_CAP = 24;

function utf8(s) {
  const out = [];
  for (const ch of s) {
    const c = ch.codePointAt(0);
    if (c < 0x80) out.push(c);
    else if (c < 0x800) out.push(0xc0 | (c >> 6), 0x80 | (c & 63));
    else if (c < 0x10000) out.push(0xe0 | (c >> 12), 0x80 | ((c >> 6) & 63), 0x80 | (c & 63));
    else out.push(0xf0 | (c >> 18), 0x80 | ((c >> 12) & 63), 0x80 | ((c >> 6) & 63), 0x80 | (c & 63));
  }
  return out;
}
function fromUtf8(b) {
  let s = '';
  for (let i = 0; i < b.length;) {
    const c = b[i];
    let cp;
    if (c < 0x80) { cp = c; i += 1; }
    else if (c < 0xe0) { cp = ((c & 31) << 6) | (b[i + 1] & 63); i += 2; }
    else if (c < 0xf0) { cp = ((c & 15) << 12) | ((b[i + 1] & 63) << 6) | (b[i + 2] & 63); i += 3; }
    else { cp = ((c & 7) << 18) | ((b[i + 1] & 63) << 12) | ((b[i + 2] & 63) << 6) | (b[i + 3] & 63); i += 4; }
    s += String.fromCodePoint(cp);
  }
  return s;
}

export class Chimera {
  constructor(module) {
    this.x = new WebAssembly.Instance(module, {}).exports;
    if (this.x.chimera_gesture_record_size() !== GESTURE_RECORD) throw new Error('chimera: gesture record layout changed');
    this._catalog = null;
  }
  call(fn, args = {}) {
    const x = this.x;
    const bytes = utf8(JSON.stringify({ fn, ...args }));
    const p = x.chimera_alloc(bytes.length);
    new Uint8Array(x.memory.buffer, p, bytes.length).set(bytes);
    const status = x.chimera_call(p, bytes.length);
    x.chimera_free(p, bytes.length);
    const v = JSON.parse(fromUtf8(new Uint8Array(x.memory.buffer, x.chimera_result_ptr(), x.chimera_result_len())));
    if (status !== 0) throw new Error(`chimera ${fn}: ${v.error}`);
    return v;
  }
  get catalog() { return this._catalog || (this._catalog = this.call('catalog')); }
  engine(sampleRate) { return new Engine(this, sampleRate); }
}

export class Engine {
  constructor(core, sampleRate) {
    this.core = core;
    this.x = core.x;
    this.fs = sampleRate;
    this.h = this.x.engine_new(sampleRate);
    this.frames = 0;
    this.creature = null;
  }
  free() { if (this.h) { this.x.engine_free(this.h); this.h = 0; } }
  get clock() { return this.x.engine_clock(this.h); }
  values() { return new Float64Array(this.x.memory.buffer, this.x.engine_values(this.h), 32).fill(NaN); }
  setBody(female, child) { this.x.engine_set_body(this.h, female, child); }
  setGate(level) { this.x.engine_set_gate(this.h, level); }
  setSource(patch) {
    const v = this.values();
    for (const [k, val] of Object.entries(patch)) {
      const i = SOURCE_KEYS.indexOf(k);
      if (i >= 0 && val !== undefined && val !== null) v[i] = typeof val === 'boolean' ? (val ? 1 : 0) : val;
    }
    this.x.engine_set_source(this.h);
  }
  setArtic(patch, tipFree) {
    const v = this.values();
    for (const [k, val] of Object.entries(patch)) {
      const i = ARTIC_KEYS.indexOf(k);
      if (i >= 0 && typeof val === 'number') v[i] = val;
    }
    this.x.engine_set_artic(this.h, tipFree === undefined ? 2 : tipFree ? 1 : 0);
  }
  schedule(gestures, lead = 0.03, replace = false) {
    let off = 0;
    for (let at = 0; at < gestures.length || at === 0; at += MAX_GESTURES) {
      const part = gestures.slice(at, at + MAX_GESTURES);
      this._write(part);
      off = this.x.engine_schedule(this.h, part.length, lead, replace && at === 0 ? 1 : 0);
      if (!gestures.length) break;
    }
    return off;
  }
  _write(gestures) {
    const buf = this.x.memory.buffer, at = this.x.engine_records(this.h), n = gestures.length;
    const dv = new DataView(buf, at, n * GESTURE_RECORD);
    const bytes = new Uint8Array(buf, at, n * GESTURE_RECORD);
    for (let i = 0; i < n; i++) {
      const g = gestures[i], o = i * GESTURE_RECORD;
      const head = [g.t0, g.t1, g.rampIn, g.rampOut, g.strength, g.speed ?? NaN, g.releaseHold ?? NaN, g.tag ?? NaN];
      for (let j = 0; j < 8; j++) dv.setFloat64(o + j * 8, head[j], true);
      for (let k = 0; k < CONTROL_KEYS.length; k++) dv.setFloat64(o + 64 + k * 8, NaN, true);
      for (const key in g.targets) {
        const k = KEY_INDEX[key], value = g.targets[key];
        if (k !== undefined && value !== undefined && value !== null) dv.setFloat64(o + 64 + k * 8, value, true);
      }
      if (g.label === undefined || g.label === null) bytes[o + 240] = 255;
      else {
        let b = utf8(g.label);
        if (b.length > LABEL_CAP) { let m = LABEL_CAP; while (m > 0 && (b[m] & 0xc0) === 0x80) m--; b = b.slice(0, m); }
        bytes[o + 240] = b.length;
        bytes.set(b, o + 241);
      }
    }
  }
  release(tag) { this.x.engine_release(this.h, tag); }
  stopSpeech() { this.x.engine_stop_speech(this.h); }
  _steps(steps) {
    const buf = this.x.memory.buffer, at = this.x.engine_records(this.h), n = Math.min(steps.length, 128);
    const dv = new DataView(buf, at, n * STEP_RECORD);
    const bytes = new Uint8Array(buf, at, n * STEP_RECORD);
    for (let i = 0; i < n; i++) {
      const s = steps[i], o = i * STEP_RECORD;
      if (!s) { bytes[o] = 255; continue; }
      const b = utf8(s.id).slice(0, LABEL_CAP);
      bytes[o] = b.length;
      bytes.set(b, o + 1);
      dv.setFloat64(o + 32, s.note ?? NaN, true);
      dv.setFloat64(o + 40, s.accent ?? NaN, true);
    }
    return n;
  }
  beatHit(id, note, accent) { this._steps([{ id, note, accent }]); this.x.engine_beat_hit(this.h); }
  setBeat(o) {
    const n = o.steps ? this._steps(o.steps) : 0;
    this.x.engine_set_beat(this.h, o.steps ? 1 : 0, n, o.bpm ?? NaN, o.swing ?? NaN, o.playing === undefined ? 2 : o.playing ? 1 : 0);
  }
  setCreature(id, params) {
    const x = this.x;
    if (!id || id === 'human') { x.engine_set_human(this.h); this.creature = null; return null; }
    const bytes = utf8(JSON.stringify({ id, params: params || {} }));
    const p = x.chimera_alloc(bytes.length);
    new Uint8Array(x.memory.buffer, p, bytes.length).set(bytes);
    const status = x.engine_set_creature(this.h, p, bytes.length);
    x.chimera_free(p, bytes.length);
    const v = JSON.parse(fromUtf8(new Uint8Array(x.memory.buffer, x.chimera_result_ptr(), x.chimera_result_len())));
    if (status !== 0) throw new Error(v.error);
    this.creature = v;
    return v;
  }
  creatureParam(key, value) { const i = this.creature ? this.creature.params.indexOf(key) : -1; if (i >= 0) this.x.engine_creature_param(this.h, i, value); }
  playCall(id, pitch, amp) { const i = this.creature ? this.creature.calls.indexOf(id) : -1; if (i >= 0) this.x.engine_play_call(this.h, i, pitch ?? NaN, amp ?? NaN); }
  stopCall() { this.x.engine_stop_call(this.h); }
  render(n) {
    const p = this.x.engine_render(this.h, n);
    this.frames += n;
    return new Float32Array(this.x.memory.buffer, p, n);
  }
  telemetry(out, o = 0) {
    const x = this.x;
    if (this.creature) {
      const c = this.creature;
      const len = 4 + c.params.length;
      const b = new Float64Array(x.memory.buffer, x.engine_creature_telemetry(this.h), len);
      out[o] = 1; out[o + 1] = b[1]; out[o + 2] = b[0];
      const pi = c.params.indexOf('pitch');
      out[o + 3] = pi >= 0 ? b[4 + pi] : 0;
      const mi = Math.max(c.params.indexOf('gape'), c.params.indexOf('mouth'));
      out[o + 4] = mi >= 0 ? b[4 + mi] : 0.5;
      return;
    }
    const b = new Float64Array(x.memory.buffer, x.engine_telemetry(this.h), TELE_HEADER + 17);
    out[o] = 0; out[o + 1] = b[6]; out[o + 2] = b[9]; out[o + 3] = b[3]; out[o + 4] = b[4]; out[o + 5] = b[7]; out[o + 6] = b[2];
    for (let i = 0; i < 17; i++) out[o + 7 + i] = b[TELE_HEADER + i];
  }
}
export const TELE_SIZE = 24;
