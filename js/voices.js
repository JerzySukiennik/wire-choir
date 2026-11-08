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

export function engineCfg(h) {
  return { tract: h.tract, rd: h.rd, breath: h.breath, vib: h.vib, vibRate: h.vibRate || 5.6, rough: h.rough, gain: 1 };
}
