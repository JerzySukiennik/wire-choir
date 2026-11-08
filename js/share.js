// Wire Choir sharing and rendering: song links (deflate + base64url), offline WAV render, video capture of the stage.
import { workletSource, buildChain } from './audio.js';
import { engineCfg } from './voices.js';
import { voiceMix } from './player.js';
import { planNotes, planDrums } from './voice/planner.js';

function b64url(bytes) {
  let s = '';
  for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
function unb64url(str) {
  const s = atob(str.replace(/-/g, '+').replace(/_/g, '/'));
  const out = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i);
  return out;
}

export async function encodeSong(song) {
  const data = { v: 1, lang: song.lang, mood: song.mood, key: song.key, bpm: song.bpm, seed: song.seed, lines: song.lines, heads: song.heads, melody: song.melody || {}, track: song.track || undefined };
  const bytes = new TextEncoder().encode(JSON.stringify(data));
  if (typeof CompressionStream !== 'undefined') {
    const cs = new Blob([bytes]).stream().pipeThrough(new CompressionStream('deflate-raw'));
    return 'z' + b64url(new Uint8Array(await new Response(cs).arrayBuffer()));
  }
  return 'j' + b64url(bytes);
}

export async function decodeSong(str) {
  const kind = str[0], bytes = unb64url(str.slice(1));
  let json;
  if (kind === 'z') {
    const ds = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
    json = await new Response(ds).text();
  } else json = new TextDecoder().decode(bytes);
  const d = JSON.parse(json);
  if (!d || d.v !== 1 || !Array.isArray(d.heads) || !d.heads.length) throw new Error('bad song');
  return { v: 1, lang: d.lang === 'en' ? 'en' : 'pl', mood: d.mood || 'happy', key: +d.key || 0, bpm: d.bpm || null, seed: +d.seed || 7, lines: (d.lines || []).slice(0, 80), heads: d.heads.slice(0, 6), melody: d.melody || {}, track: cleanTrack(d.track) };
}

function cleanTrack(t) {
  if (!t || typeof t !== 'object' || !(t.bars > 0)) return undefined;
  const num = (v) => (Number.isFinite(+v) ? +v : 0);
  return {
    bars: Math.min(160, Math.round(num(t.bars))),
    chords: (Array.isArray(t.chords) ? t.chords.slice(0, 160) : []).map((c) => (Array.isArray(c) ? [num(c[0]) % 12, c[1] ? 1 : 0] : null)),
    bass: (Array.isArray(t.bass) ? t.bass.slice(0, 3000) : []).filter(Array.isArray).map((n) => [num(n[0]), Math.max(0.05, num(n[1])), Math.max(20, Math.min(90, num(n[2])))]),
    drums: (Array.isArray(t.drums) ? t.drums.slice(0, 6000) : []).filter((n) => Array.isArray(n) && 'KSHO'.includes(n[1])).map((n) => [num(n[0]), n[1], Math.max(0, Math.min(1.2, num(n[2])))]),
    riff: (Array.isArray(t.riff) ? t.riff.slice(0, 3000) : []).filter(Array.isArray).map((n) => [num(n[0]), Math.max(0.05, num(n[1])), Math.max(30, Math.min(100, num(n[2])))]),
    src: t.src === 'mic' ? 'mic' : 'file',
  };
}

export async function renderWav(job, onProgress) {
  const sr = 48000;
  const dur = job.duration + 0.6;
  const oc = new OfflineAudioContext(2, Math.ceil(dur * sr), sr);
  await oc.audioWorklet.addModule(await workletSource());
  const chain = buildChain(oc);
  chain.clip.connect(oc.destination);
  job.heads.forEach((h, i) => {
    const p = job.parts[h.id];
    if (!p) return;
    const cfg = engineCfg(h);
    const mix = voiceMix(job.heads, i, h);
    const node = new AudioWorkletNode(oc, 'wire-voice', { numberOfInputs: 0, numberOfOutputs: 1, outputChannelCount: [1], processorOptions: { steps: 2, seed: 1000 + i, cfg } });
    const gain = oc.createGain(); gain.gain.value = mix.volume;
    const pan = oc.createStereoPanner(); pan.pan.value = mix.pan;
    const send = oc.createGain(); send.gain.value = cfg.send ?? 0.35;
    node.connect(gain).connect(pan);
    pan.connect(chain.dry);
    pan.connect(send).connect(chain.wetIn);
    const segs = p.drums.length ? planDrums(p.drums) : planNotes(p.notes, job.lang);
    node.port.postMessage({ t: 'segs', mode: 'abs', replace: true, segs: segs.map((s) => ({ ...s, at: s.at + 0.1, p: Array.from(s.p) })) });
  });
  await new Promise((r) => setTimeout(r, 60));
  for (let t = 1; t < dur; t += 1) oc.suspend(t).then(() => { onProgress && onProgress(t / dur); oc.resume(); });
  const buf = await oc.startRendering();
  onProgress && onProgress(1);
  return wavBlob(buf);
}

function wavBlob(buf) {
  const ch = buf.numberOfChannels, len = buf.length, sr = buf.sampleRate;
  const data = new DataView(new ArrayBuffer(44 + len * ch * 2));
  const w = (o, s) => { for (let i = 0; i < s.length; i++) data.setUint8(o + i, s.charCodeAt(i)); };
  w(0, 'RIFF'); data.setUint32(4, 36 + len * ch * 2, true); w(8, 'WAVE'); w(12, 'fmt ');
  data.setUint32(16, 16, true); data.setUint16(20, 1, true); data.setUint16(22, ch, true); data.setUint32(24, sr, true);
  data.setUint32(28, sr * ch * 2, true); data.setUint16(32, ch * 2, true); data.setUint16(34, 16, true); w(36, 'data'); data.setUint32(40, len * ch * 2, true);
  const chans = [];
  for (let c = 0; c < ch; c++) chans.push(buf.getChannelData(c));
  let o = 44;
  for (let i = 0; i < len; i++) for (let c = 0; c < ch; c++) { const v = Math.max(-1, Math.min(1, chans[c][i])); data.setInt16(o, v < 0 ? v * 32768 : v * 32767, true); o += 2; }
  return new Blob([data.buffer], { type: 'audio/wav' });
}

export function videoMime() {
  const opts = ['video/mp4;codecs=avc1.640028,mp4a.40.2', 'video/mp4;codecs=avc1,mp4a.40.2', 'video/mp4', 'video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm'];
  return opts.find((m) => typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported(m)) || '';
}

export function download(blob, name) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = name;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 4000);
}
