// Node check of the whole chain for a Polish line with creature instruments: lyrics, arrangement, parts, units, one rendered unit per head.
import { readFileSync } from 'node:fs';
import { Chimera } from '../../js/chimera/core.js';
import { renderUnit } from '../../js/chimera/render.js';
import { buildUnits } from '../../js/chimera/units.js';
import { parseLyrics } from '../../js/lyrics.js';
import { arrange, buildParts } from '../../js/composer.js';
import { INSTS, PRESETS } from '../../js/voices.js';
const core = new Chimera(new WebAssembly.Module(readFileSync('assets/chimera/chimera.wasm')));
const mk = (id, role, extra = {}) => ({ id, role, preset: 'tenor', look: 'wire', lo: 48, hi: 69, tract: 16.6, rd: 0.95, breath: 0.14, vib: 30, rough: 0.08, shift: 0, volume: 1, harm: 'up3', vowel: 'u', density: 'normal', ...extra });
const heads = [mk('L', 'lead'), ...['bird', 'seal', 'gator', 'elephant'].map((k) => mk(k, 'inst', { inst: k, lo: INSTS[k].lo, hi: INSTS[k].hi })), mk('B', 'beatbox'), mk('C', 'choir', { vowel: 'M' })];
const song = { lang: 'pl', mood: 'happy', key: 0, bpm: 100, seed: 7, beat: { text: 'B . ! . | P! . t . | B m:43 . ^K | kch . K tss' }, lineSpoken: { 1: true } };
const parsed = parseLyrics('la la la la\nczy mnie słychać?', 'pl');
const arr = arrange(song, parsed, heads);
const parts = buildParts(arr, heads);
const units = buildUnits(arr, parts, heads, 'pl', 48000);
const kinds = {};
for (const u of units) { const k = u.head + ':' + u.spec.kind; kinds[k] = (kinds[k] || 0) + 1; }
console.log('bars', arr.chords.length, 'units', units.length, JSON.stringify(kinds));
const seen = new Set();
for (const u of units) {
  if (seen.has(u.head + u.spec.kind)) continue;
  seen.add(u.head + u.spec.kind);
  const t0 = performance.now();
  const r = renderUnit(core, u.spec);
  let pk = 0, e = 0; for (const v of r.pcm) { pk = Math.max(pk, Math.abs(v)); e += v * v; }
  const extra = u.spec.kind === 'creature' ? 'midi ' + u.spec.notes.slice(0, 3).map((n) => n.midi).join(',') : u.spec.kind === 'beat' ? u.spec.hits.map((h) => h.id).join(' ') : u.spec.kind === 'speak' ? u.spec.phrases[0].segments.map((s) => s.ipa).join('') + ' ' + u.spec.phrases[0].intonation : '';
  console.log(u.head.padEnd(9), u.spec.kind.padEnd(9), 'at', u.at.toFixed(2), 'audio', (r.pcm.length / 48000).toFixed(2), 's peak', pk.toFixed(3), 'rms', Math.sqrt(e / r.pcm.length).toFixed(4), Math.round(performance.now() - t0) + 'ms', extra);
}
