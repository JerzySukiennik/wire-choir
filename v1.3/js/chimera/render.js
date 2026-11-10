// Wire Choir render units: one sung phrase, spoken line, beatbox bar or creature part rendered offline through the CHIMERA engine, with 60 Hz telemetry for the heads.
import { TELE_SIZE } from './core.js';

export const LEAD = 0.3;
const GAP_FILL = 0.25;
const midiHz = (m) => 440 * Math.pow(2, (m - 69) / 12);

const leadIns = new Map();
function leadIn(core, id, body) {
  const k = id + '|' + body.female + '|' + body.child;
  if (!leadIns.has(k)) leadIns.set(k, core.call('leadIn', { id, body }));
  return leadIns.get(k);
}

function singGestures(core, spec, body) {
  const beat = 60 / spec.bpm;
  const notes = spec.notes.slice().sort((a, b) => a.b - b.b);
  const gestures = [];
  let end = 0, i = 0;
  while (i < notes.length) {
    let j = i;
    while (j < notes.length - 1 && !notes[j].syl.phraseEnd && (notes[j + 1].b - (notes[j].b + notes[j].d)) * beat < GAP_FILL) j++;
    const phrase = [];
    for (let k = i; k <= j; k++) {
      const n = notes[k];
      const beats = k < j ? Math.max(0.05, notes[k + 1].b - n.b) : Math.max(0.05, n.d);
      const syl = n.syl.hum ? { ...n.syl, onset: [], nucleus: { ipa: 'm' }, coda: [] } : n.syl;
      phrase.push({ midi: n.midi, beats, syl: { text: syl.text || '', onset: syl.onset, nucleus: syl.nucleus, coda: syl.coda, melisma: syl.melisma || undefined, wordEnd: !!syl.wordEnd, phraseEnd: k === j } });
    }
    const plan = core.call('planSong', { notes: phrase, options: { body, bpm: spec.bpm, t0: LEAD + notes[i].b * beat, vibrato: spec.vibrato ?? 20 } });
    for (const g of plan.gestures) gestures.push(g);
    end = Math.max(end, plan.end);
    i = j + 1;
  }
  return { gestures, end };
}

function applyFx(pcm, fs, fx) {
  if (fx === 1) {
    const comb = new Float32Array(1024);
    const dl = Math.round((280 * fs) / 48000), hold = Math.max(1, Math.round((4 * fs) / 48000));
    let ci = 0, ph = 0, hn = 0, hv = 0;
    for (let i = 0; i < pcm.length; i++) {
      ph += 62 / fs; if (ph > 1) ph -= 1;
      let v = pcm[i] * (0.5 + 0.5 * Math.sin(ph * 6.283185307));
      if (++hn >= hold) { hn = 0; hv = Math.round(v * 40) / 40; }
      v = hv;
      const c = v + comb[(ci + 1024 - dl) & 1023] * 0.5;
      comb[ci] = c; ci = (ci + 1) & 1023;
      pcm[i] = (0.55 * v + 0.45 * c) * 1.9;
    }
  } else if (fx === 2) {
    let ph = 0;
    for (let i = 0; i < pcm.length; i++) {
      ph += 4.3 / fs; if (ph > 1) ph -= 1;
      pcm[i] *= 0.75 + 0.25 * Math.sin(ph * 6.283185307);
    }
  }
}

export function renderUnit(core, spec) {
  const fs = spec.fs;
  const body = { female: spec.body?.female || 0, child: spec.body?.child || 0 };
  const e = core.engine(fs);
  try {
    if (body.female || body.child) e.setBody(body.female, body.child);
    const events = [];
    let gestures = [], dur = spec.dur || 0, firstHz = 110;
    if (spec.kind === 'sing') {
      const r = singGestures(core, spec, body);
      gestures = r.gestures;
      dur = Math.max(dur, r.end - LEAD);
      const first = spec.notes.reduce((a, n) => (n.b < a.b ? n : a), spec.notes[0]);
      firstHz = midiHz(first.midi);
      e.setSource({ ...(spec.source || {}), f0: firstHz, voiced: spec.source?.voiced ?? true, pressure: spec.source?.pressure ?? 9, tension: spec.source?.tension ?? 0.55 });
    } else if (spec.kind === 'speak') {
      const plan = core.call('planPhrases', { phrases: spec.phrases, options: { body, t0: LEAD - 0.06, rate: spec.rate || 1, f0: spec.f0 || undefined, accent: spec.accent ?? undefined } });
      gestures = plan.gestures;
      dur = Math.max(dur, plan.end - LEAD);
      e.setSource({ ...(spec.source || {}), f0: spec.f0 || 120, voiced: spec.source?.voiced ?? true });
    } else if (spec.kind === 'beat') {
      e.setArtic(core.call('beatReady', { body }));
      e.setSource({ ...(spec.source || {}), f0: 100, voiced: true, pressure: 8 });
      e.setGate(0);
      for (const h of spec.hits) events.push({ t: LEAD + h.t - leadIn(core, h.id, body), run: () => e.beatHit(h.id, h.note, h.accent) });
    } else if (spec.kind === 'creature') {
      e.setCreature(spec.creature, spec.params || {});
      e.setGate(0);
      for (const n of spec.notes || []) {
        const hz = midiHz(n.midi);
        events.push({ t: LEAD + n.t, run: () => { for (const k of spec.pitchKeys || ['pitch']) e.creatureParam(k, hz); e.setGate(n.amp ?? 1); } });
        events.push({ t: LEAD + n.t + Math.max(0.03, n.d * (spec.hold ?? 0.85)), run: () => e.setGate(0) });
      }
      for (const c of spec.calls || []) events.push({ t: LEAD + c.t, run: () => e.playCall(c.id, c.pitch, c.amp ?? 1) });
    }
    if (gestures.length) e.schedule(gestures, 0, false);
    events.sort((a, b) => a.t - b.t);
    const tail = spec.tail ?? 0.25;
    const total = Math.ceil((LEAD + dur + tail) * fs);
    const hop = Math.round(fs / 60);
    const pcm = new Float32Array(total);
    const frames = Math.ceil(total / hop);
    const tele = new Float32Array(frames * TELE_SIZE);
    let pos = 0, ev = 0, f = 0;
    while (pos < total) {
      while (ev < events.length && Math.round(events[ev].t * fs) <= pos) events[ev++].run();
      let n = Math.min(total - pos, hop - (pos % hop));
      if (ev < events.length) n = Math.min(n, Math.max(1, Math.round(events[ev].t * fs) - pos));
      pcm.set(e.render(n), pos);
      pos += n;
      if (pos % hop === 0 || pos === total) { if (f < frames) e.telemetry(tele, f * TELE_SIZE); f++; }
    }
    const g = spec.gain ?? 1;
    if (g !== 1) for (let i = 0; i < total; i++) pcm[i] *= g;
    if (spec.fx) applyFx(pcm, fs, spec.fx);
    const fade = Math.min(total, Math.round(0.02 * fs));
    for (let i = 0; i < fade; i++) pcm[total - 1 - i] *= i / fade;
    return { pcm, tele, hop, fs, lead: LEAD, dur };
  } finally {
    e.free();
  }
}
