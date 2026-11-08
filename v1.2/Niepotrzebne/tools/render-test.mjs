// Offline render of test phrases through the voice engine: writes WAVs and prints realtime factor.
import { writeFileSync } from 'node:fs';
import { VoiceEngine } from '../../js/voice/engine.js';
import { planNotes, planDrums } from '../../js/voice/planner.js';

const FS = 48000;
const OUT = new URL('../out/', import.meta.url);

function wav(data, path) {
  const b = Buffer.alloc(44 + data.length * 2);
  b.write('RIFF', 0); b.writeUInt32LE(36 + data.length * 2, 4); b.write('WAVE', 8); b.write('fmt ', 12);
  b.writeUInt32LE(16, 16); b.writeUInt16LE(1, 20); b.writeUInt16LE(1, 22); b.writeUInt32LE(FS, 24); b.writeUInt32LE(FS * 2, 28);
  b.writeUInt16LE(2, 32); b.writeUInt16LE(16, 34); b.write('data', 36); b.writeUInt32LE(data.length * 2, 40);
  let peak = 0;
  for (const x of data) peak = Math.max(peak, Math.abs(x));
  for (let i = 0; i < data.length; i++) b.writeInt16LE(Math.max(-32767, Math.min(32767, Math.round(data[i] / Math.max(peak, 1e-6) * 0.9 * 32767))), 44 + i * 2);
  writeFileSync(path, b);
  return peak;
}

function render(segs, secs, cfg, steps = 2) {
  const e = new VoiceEngine(FS, steps, 7);
  e.configure(cfg || {});
  e.schedule(segs.map((s) => ({ ...s, at: Math.round(s.at * FS), len: Math.max(1, Math.round(s.len * FS)) })), 'abs');
  const out = new Float32Array(Math.round(secs * FS));
  const t0 = performance.now();
  e.render(out, 0, out.length);
  const ms = performance.now() - t0;
  return { out, rtf: ms / 1000 / secs };
}

const mid = (m) => 440 * Math.pow(2, (m - 69) / 12);
function song(sylls, bpm, startMidi) {
  const beat = 60 / bpm;
  let t = 0.3;
  return sylls.map(([on, nu, co, m, beats, w]) => {
    const n = { t, d: beats * beat, f0: mid(m), amp: 0.8, syl: { on, nu, co }, w: w ?? -1 };
    t += beats * beat;
    return n;
  });
}

const vowels = song([[[], ['a'], [], 57, 1], [[], ['e'], [], 59, 1], [[], ['i'], [], 60, 1], [[], ['o'], [], 62, 1], [[], ['u'], [], 64, 1], [[], ['y'], [], 62, 2]], 90);
const pl = song([
  [['m'], ['a'], [], 57, 0.5, 0], [['m'], ['a'], [], 59, 0.5], [["s'"], ['e~'], [], 60, 1],
  [["s'", 'p', 'j'], ['e'], [], 62, 0.5, 1], [['v'], ['a'], ['m'], 64, 1.5],
  [['t'], ['a'], [], 62, 0.5, 2], [['k'], ['o'], [], 60, 0.5], [['tS'], ['y'], ['s', 't'], 59, 1],
  [['z'], ['a'], [], 57, 0.5, 3], [['l'], ['o'], ['S'], 55, 0.5], [['r'], ['o'], [], 57, 2],
], 96);
const en = song([
  [[], ['a', 'I'], [], 60, 1, 0], [['l'], ['V'], ['v'], 62, 1, 1], [['D'], ['@'], [], 64, 0.5, 2], [['n'], ['a', 'I'], ['t'], 65, 1.5, 3],
  [['h'], ['A'], ['R', 't'], 64, 1, 4], [['t'], ['u'], [], 62, 1, 5], [['S'], ['I'], ['p'], 60, 2, 6],
], 96);
const drums = planDrums([0, 0.5, 1, 1.5, 2, 2.5, 3, 3.5].flatMap((b, i) => {
  const t = 0.3 + b * 0.625;
  const h = [{ type: 'H', t: t + 0.3125, amp: 0.6 }];
  if (i % 2 === 0) h.push({ type: i % 4 === 0 ? 'K' : 'S', t, amp: 1 });
  else h.push({ type: 'H', t, amp: 0.7 });
  return h;
}));

const tests = [
  ['vowels', planNotes(vowels, 'pl'), 5.5, { tract: 17 }],
  ['pl-phrase', planNotes(pl, 'pl'), 7.5, { tract: 17 }],
  ['pl-soprano', planNotes(pl.map((n) => ({ ...n, f0: n.f0 * 2 })), 'pl'), 7.5, { tract: 14, rd: 0.9 }],
  ['en-phrase', planNotes(en, 'en'), 6, { tract: 16.5 }],
  ['drums', drums, 5.5, { tract: 17 }],
];
for (const [name, segs, secs, cfg] of tests) {
  const r = render(segs, secs, cfg);
  const peak = wav(r.out, new URL(name + '.wav', OUT));
  console.log(name.padEnd(12), 'rtf', r.rtf.toFixed(3), 'peak', peak.toFixed(3));
}
const r1 = render(planNotes(pl, 'pl'), 7.5, { tract: 17 }, 1);
wav(r1.out, new URL('pl-phrase-1x.wav', OUT));
console.log('pl 1x steps rtf', r1.rtf.toFixed(3));
