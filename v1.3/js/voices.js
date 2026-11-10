// Wire Choir voice presets and helpers shared by the lab and the app.

export const PRESETS = {
  bass: { pl: 'Bas', en: 'Bass', lo: 40, hi: 60, tract: 18.6, rd: 1.25, breath: 0.12, vib: 26, rough: 0.14 },
  baritone: { pl: 'Baryton', en: 'Baritone', lo: 45, hi: 64, tract: 17.6, rd: 1.1, breath: 0.14, vib: 30, rough: 0.1 },
  tenor: { pl: 'Tenor', en: 'Tenor', lo: 48, hi: 69, tract: 16.6, rd: 0.95, breath: 0.14, vib: 34, rough: 0.08 },
  alto: { pl: 'Alt', en: 'Alto', lo: 53, hi: 74, tract: 14.9, rd: 1.05, breath: 0.24, vib: 34, rough: 0.06 },
  soprano: { pl: 'Sopran', en: 'Soprano', lo: 60, hi: 81, tract: 14.1, rd: 0.9, breath: 0.22, vib: 42, rough: 0.05 },
  child: { pl: 'Dziecko', en: 'Child', lo: 60, hi: 79, tract: 12.2, rd: 1.2, breath: 0.32, vib: 12, rough: 0.04 },
};

export const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
export function midiToHz(m) { return 440 * Math.pow(2, (m - 69) / 12); }
export function hzToMidi(f) { return 69 + 12 * Math.log2(f / 440); }
export function noteName(m) { const r = Math.round(m); return NOTE_NAMES[((r % 12) + 12) % 12] + (Math.floor(r / 12) - 1); }

export const LOOKS = {
  wire: { pl: 'Wireframe', en: 'Wireframe', fx: 0, send: 0.35 },
  jurek: { pl: 'Jurek', en: 'Jurek', fx: 0, send: 0.3, voice: { lo: 50, hi: 69, tract: 15.8, rd: 1.05, breath: 0.2, vib: 22, vibRate: 5.4, rough: 0.08 } },
  robot: { pl: 'Robot', en: 'Robot', fx: 1, send: 0.22, voice: { rd: 0.32, vib: 0, rough: 0, breath: 0.04 } },
  ghost: { pl: 'Duch', en: 'Ghost', fx: 2, send: 0.85, voice: { breath: 0.9, vib: 42, vibRate: 4.2, rough: 0.15 } },
};

export const INSTS = {
  synth: { pl: 'Syntezator', en: 'Synth', lo: 55, hi: 79, tract: 14.8, rd: 0.45, breath: 0.05, vib: 0, vibRate: 5.6, rough: 0.04, look: 'robot' },
  guitar: { pl: 'Gitara', en: 'Guitar', lo: 52, hi: 74, tract: 15.6, rd: 0.7, breath: 0.08, vib: 6, vibRate: 5.6, rough: 0.06 },
  keys: { pl: 'Klawisze', en: 'Keys', lo: 55, hi: 77, tract: 15.2, rd: 0.75, breath: 0.1, vib: 0, vibRate: 5.6, rough: 0.03 },
  brass: { pl: 'Dęte', en: 'Brass', lo: 52, hi: 74, tract: 16.4, rd: 0.34, breath: 0.06, vib: 22, vibRate: 5.8, rough: 0.14 },
  strings: { pl: 'Smyczki', en: 'Strings', lo: 57, hi: 81, tract: 14.4, rd: 1.15, breath: 0.28, vib: 38, vibRate: 5.4, rough: 0.03 },
  organ: { pl: 'Organy', en: 'Organ', lo: 48, hi: 72, tract: 16, rd: 0.95, breath: 0.04, vib: 55, vibRate: 6.8, rough: 0.02 },
  flute: { pl: 'Flet', en: 'Flute', lo: 69, hi: 88, tract: 12.4, rd: 1.45, breath: 0.7, vib: 24, vibRate: 5.2, rough: 0 },
  bird: { pl: 'Ptak', en: 'Songbird', lo: 60, hi: 84, tract: 12, rd: 1, breath: 0.1, vib: 0, vibRate: 5.6, rough: 0, creature: true },
  seal: { pl: 'Foka', en: 'Seal', lo: 55, hi: 79, tract: 15, rd: 1, breath: 0.1, vib: 0, vibRate: 5.6, rough: 0, creature: true },
  gator: { pl: 'Aligator', en: 'Alligator', lo: 48, hi: 67, tract: 19, rd: 1, breath: 0.1, vib: 0, vibRate: 5.6, rough: 0, creature: true },
  elephant: { pl: 'Słoń', en: 'Elephant', lo: 55, hi: 76, tract: 20, rd: 1, breath: 0.1, vib: 0, vibRate: 5.6, rough: 0, creature: true },
};

export function applyInst(h, type) {
  const p = INSTS[type] || INSTS.synth;
  Object.assign(h, { inst: type, lo: p.lo, hi: p.hi, tract: p.tract, rd: p.rd, breath: p.breath, vib: p.vib, vibRate: p.vibRate, rough: p.rough, shift: 0 });
  if (p.look) h.look = p.look;
  const lv = (LOOKS[h.look] || {}).voice;
  if (lv && h.look === 'robot') Object.assign(h, { rd: Math.min(h.rd, lv.rd ?? h.rd), vib: 0 });
  return h;
}

export function engineCfg(h) {
  const look = LOOKS[h.look] || LOOKS.wire;
  return { tract: h.tract, rd: h.rd, breath: h.breath, vib: h.vib, vibRate: h.vibRate || 5.6, rough: h.rough, gain: 1, fx: look.fx, send: look.send };
}
