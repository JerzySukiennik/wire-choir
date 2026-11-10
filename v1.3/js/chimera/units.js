// Wire Choir arrangement to render units: cuts every head's part into cacheable phrases and bars, maps head settings to the engine's body and source, and engine telemetry to head animation.
import { toSyllable, toSegments } from './ipa.js';
import { TELE_SIZE } from './core.js';
import { TX, TD, OPEN, LIPD, LIPR, TIPX, TIPD, VEL, VOICE, ASP, REST_PARAMS, NPAR } from '../voice/engine.js';

export const ENGINE_TAG = 'chimera-eed4a5f-2';
const FEMALE = { alto: 1, soprano: 1 }, CHILD = { child: 1 };
export const BEAT_IDS = { K: 'B', S: 'Pf', H: 't', O: 'tss' };
export const CREATURES = {
  bird: { id: 'songbird', shift: 24, hold: 0.8, gain: 1.2, params: { voices: 0.25, purity: 0.9 }, pitchKeys: ['pitch'] },
  seal: { id: 'seal', shift: 12, hold: 0.9, gain: 1, params: { pulse: 0.2 }, pitchKeys: ['pitch'] },
  gator: { id: 'alligator', shift: -24, hold: 0.95, gain: 0.5, params: { chaos: 0.5, mouth: 0.3 }, pitchKeys: ['pitch'] },
  elephant: { id: 'elephant', shift: 0, hold: 0.85, gain: 2.2, params: { mode: 1, trunk: 1, chaos: 0.15 }, pitchKeys: ['lipPitch'] },
};

export function headBody(h) {
  return { female: +(h.fem ?? FEMALE[h.preset] ?? 0), child: +(h.kid ?? CHILD[h.preset] ?? 0) };
}

export function headSource(h) {
  const robot = h.look === 'robot', ghost = h.look === 'ghost';
  const rd = h.rd ?? 1;
  return {
    breathiness: ghost ? 0.92 : Math.max(0.02, Math.min(1, 0.04 + (h.breath ?? 0.15) * 0.8)),
    tension: ghost ? 0.3 : Math.max(0.2, Math.min(0.85, 0.77 - (rd - 0.4) * 0.26)),
    roughness: robot ? 0 : Math.max(0, Math.min(0.9, (h.rough ?? 0.1) * 0.9)),
    vibratoRate: h.vibRate || 5.6,
    drift: robot ? 0 : 5,
    pressure: ghost ? 7 : 9,
  };
}

export function headFx(h) { return h.look === 'robot' ? 1 : h.look === 'ghost' ? 2 : 0; }

function roleGain(h) { return h.look === 'ghost' ? 1.5 : 1; }

function sungUnits(h, notes, lang, arr, cuts, minLen, fs, words) {
  const spb = arr.spb, out = [];
  const body = headBody(h), source = headSource(h), fx = headFx(h), vib = h.look === 'robot' ? 0 : Math.round(h.vib ?? 20);
  let cur = null, ci = 0;
  const flush = () => {
    if (!cur || !cur.list.length) return;
    const t0 = cur.list[0].t;
    const last = cur.list[cur.list.length - 1];
    out.push({
      head: h.id, at: t0, len: last.t + last.d - t0,
      spec: {
        tag: ENGINE_TAG, fs, kind: 'sing', bpm: +(60 / spb).toFixed(4), vibrato: vib, body, source, fx, gain: roleGain(h),
        notes: cur.list.map((n, k) => {
          const nx = cur.list[k + 1];
          const wordEnd = !words || !nx || nx.w >= 0;
          return { b: +((n.t - t0) / spb).toFixed(4), d: +(n.d / spb).toFixed(4), midi: +n.m.toFixed(2), syl: toSyllable(n.syl, lang, wordEnd, false) };
        }),
      },
    });
    cur = null;
  };
  for (const n of notes) {
    while (ci < cuts.length && cuts[ci] <= n.t + 1e-6) ci++;
    const prev = cur && cur.list[cur.list.length - 1];
    const gap = prev ? n.t - (prev.t + prev.d) : 0;
    const crossed = prev && ci > cur.ci;
    if (cur && (gap >= 0.25 || (crossed && prev.t + prev.d - cur.list[0].t >= minLen))) flush();
    if (!cur) cur = { list: [], ci };
    cur.ci = Math.max(cur.ci, ci);
    cur.list.push(n);
  }
  flush();
  return out;
}

function beatUnits(h, drums, arr, fs) {
  const bar = arr.spb * 4, out = [], body = headBody(h);
  const byBar = new Map();
  for (const d of drums) {
    const b = Math.max(0, Math.floor((d.t + 1e-6) / bar));
    if (!byBar.has(b)) byBar.set(b, []);
    byBar.get(b).push({ t: +(d.t - b * bar).toFixed(4), id: BEAT_IDS[d.type] || d.type, note: d.note, accent: d.amp >= 0.95 ? 1 : undefined });
  }
  for (const [b, hits] of byBar) {
    out.push({ head: h.id, at: b * bar, len: bar, spec: { tag: ENGINE_TAG, fs, kind: 'beat', body, hits, dur: +bar.toFixed(4), tail: 0.35, gain: 1.25 } });
  }
  return out;
}

function creatureUnits(h, notes, arr, fs) {
  const c = CREATURES[h.inst];
  const bar = arr.spb * 4, out = [];
  const byBar = new Map();
  for (const n of notes) {
    const b = Math.max(0, Math.floor((n.t + 1e-6) / bar));
    if (!byBar.has(b)) byBar.set(b, []);
    byBar.get(b).push({ t: +(n.t - b * bar).toFixed(4), d: +n.d.toFixed(4), midi: +(n.m + c.shift).toFixed(2) });
  }
  for (const [b, list] of byBar) {
    out.push({ head: h.id, at: b * bar, len: bar, spec: { tag: ENGINE_TAG, fs, kind: 'creature', creature: c.id, params: c.params, pitchKeys: c.pitchKeys, hold: c.hold, notes: list, dur: +bar.toFixed(4), tail: 0.3, gain: c.gain } });
  }
  return out;
}

function speechUnits(h, speech, lang, fs) {
  const body = headBody(h), source = headSource(h), fx = headFx(h);
  const center = (h.lo + h.hi) / 2 + (h.shift || 0);
  const f0 = +(440 * Math.pow(2, (center - 7 - 69) / 12)).toFixed(1);
  return speech.map((sp) => ({
    head: h.id, at: sp.t, len: sp.dur,
    spec: { tag: ENGINE_TAG, fs, kind: 'speak', body, source: { ...source, pressure: 8 }, fx, gain: roleGain(h), f0, rate: 1, phrases: [{ segments: toSegments(sp.syls, lang), intonation: sp.question ? 'question' : 'statement', pause: 0.1 }] },
  }));
}

export function buildUnits(arr, parts, heads, lang, fs) {
  const units = [];
  const bars = [];
  for (let b = 0; b <= arr.chords.length; b++) bars.push(b * 4 * arr.spb);
  const lineStarts = arr.lines.map((l) => {
    let t = Infinity;
    for (const n of arr.notes) if (n.line === l.i && n.b * arr.spb < t) t = n.b * arr.spb;
    return t;
  }).filter(Number.isFinite).sort((a, b) => a - b);
  for (const h of heads) {
    const p = parts[h.id];
    if (!p) continue;
    if (p.drums && p.drums.length) { units.push(...beatUnits(h, p.drums, arr, fs)); continue; }
    if (p.speech && p.speech.length) units.push(...speechUnits(h, p.speech, lang, fs));
    if (!p.notes || !p.notes.length) continue;
    const notes = p.notes.slice().sort((a, b) => a.t - b.t);
    if (h.role === 'inst' && CREATURES[h.inst]) { units.push(...creatureUnits(h, notes, arr, fs)); continue; }
    const lead = h.role === 'lead' || h.role === 'harmony';
    units.push(...sungUnits(h, notes, lang, arr, lead ? lineStarts : bars, lead ? 2.5 : arr.spb * 3.5, fs, lead));
  }
  return units;
}

export function auditionSpec(h, fs, beatText) {
  const body = headBody(h);
  if (h.role === 'beatbox') {
    const ids = (beatText || 'B . t . | Pf . t . | B . t . | Pf . t t').replace(/\|/g, ' ').split(/\s+/).filter(Boolean).slice(0, 16);
    const hits = [];
    ids.forEach((tok, i) => { const m = /^(.+?)(?::(\d+))?>?$/.exec(tok); if (tok !== '.' && tok !== '-' && m) hits.push({ t: +(i * 0.15).toFixed(3), id: m[1], note: m[2] ? +m[2] : undefined }); });
    return { tag: ENGINE_TAG, fs, kind: 'beat', body, hits, dur: 2.4, tail: 0.35, gain: 1.25 };
  }
  const center = Math.round((h.lo + h.hi) / 2 + (h.shift || 0));
  if (h.role === 'inst' && CREATURES[h.inst]) {
    const c = CREATURES[h.inst];
    return { tag: ENGINE_TAG, fs, kind: 'creature', creature: c.id, params: c.params, pitchKeys: c.pitchKeys, hold: c.hold, notes: [0, 4, 7].map((st, i) => ({ t: i * 0.35, d: 0.35, midi: center + st + c.shift })), dur: 1.2, tail: 0.3, gain: c.gain };
  }
  const vowel = h.role === 'choir' ? (h.vowel || 'u') : 'a';
  const syl = (on, nu) => toSyllable({ on, nu: [nu], co: [] }, 'pl', true, false);
  const notes = h.role === 'choir' ? [{ b: 0, d: 3, midi: center, syl: syl([], vowel) }] : [{ b: 0, d: 1, midi: center, syl: syl(['l'], 'a') }, { b: 1, d: 1, midi: center + 4, syl: syl(['l'], 'a') }, { b: 2, d: 2, midi: center + 7, syl: syl(['l'], 'a') }];
  return { tag: ENGINE_TAG, fs, kind: 'sing', bpm: 132, vibrato: h.look === 'robot' ? 0 : Math.round(h.vib ?? 20), body, source: headSource(h), fx: headFx(h), gain: roleGain(h), notes };
}

export function teleToParams(tele, i, out) {
  const o = i * TELE_SIZE;
  if (tele[o] === 1) {
    for (let k = 0; k < NPAR; k++) out[k] = REST_PARAMS[k];
    const lv = Math.min(1, tele[o + 1] * 6);
    out[OPEN] = 0.1 + 0.8 * lv * (0.4 + 0.6 * tele[o + 4]);
    out[LIPD] = 0.4 + 1.6 * lv;
    out[VOICE] = lv > 0.05 ? 1 : 0;
    return;
  }
  const a = o + 7;
  const jaw = tele[a], tbX = tele[a + 1], tbY = tele[a + 2], ttX = tele[a + 3], ttY = tele[a + 4], lipAp = tele[a + 7], lipProt = tele[a + 8], lipWidth = tele[a + 9], labio = tele[a + 10];
  out[OPEN] = Math.max(0, Math.min(1, (jaw - 0.2) / 1.5));
  out[LIPD] = lipAp <= 0 ? 0 : Math.min(2.6, (0.12 + lipAp * 1.03) * (1 - 0.6 * labio));
  out[LIPR] = Math.max(0, Math.min(1, (lipProt / 1.4) * (1.1 - lipWidth)));
  out[TX] = Math.max(0.1, Math.min(0.9, 0.25 + (tbX - 2.3) * 0.33));
  let td = 1.0 - (tbY - 5.67) * (0.155 + 0.15 * Math.max(0, 3 - tbX));
  if (tbY > 7.9) td *= Math.max(0, Math.min(1, (8.3 - tbY) / 0.4));
  out[TD] = Math.max(0, Math.min(1.6, td));
  out[TIPX] = Math.max(0.74, Math.min(0.97, 0.88 + (ttX - 6.25) * 0.15));
  out[TIPD] = Math.max(0, Math.min(3, (9.3 - ttY) * 1.4));
  out[VEL] = Math.max(0, Math.min(1, tele[o + 6] * 1.2));
  out[VOICE] = Math.max(0, Math.min(1, tele[o + 4]));
  out[ASP] = Math.max(0, Math.min(1, tele[o + 5] * 4));
}
