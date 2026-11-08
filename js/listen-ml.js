// Wire Choir listening models, loaded only when needed: YAMNet tags instruments and genre, Whisper hears the words and the language.
const TFJS = 'https://cdn.jsdelivr.net/npm/@tensorflow/tfjs@4.22.0/+esm';
const TJS = 'https://cdn.jsdelivr.net/npm/@huggingface/transformers@4.3.1';

export const FAMILIES = {
  vocals: [0, 24, 25, 29, 30, 31, 32, 249, 250],
  robot: [5, 30],
  whisper: [12],
  choir: [25, 250],
  rap: [31],
  drums: [157, 158, 159, 160, 162, 163, 213],
  bass: [137, 189],
  guitar: [134, 135, 136, 138, 139, 141, 142, 143, 146, 194],
  keys: [147, 148, 149, 155, 175, 177],
  organ: [150, 151, 152, 203, 204],
  synth: [153, 208, 234, 239, 240],
  brass: [180, 181, 182, 183, 192],
  strings: [179, 184, 185, 186, 188],
  flute: [190, 191, 193],
};
export const INSTRUMENT_FAMILIES = ['synth', 'guitar', 'keys', 'organ', 'brass', 'strings', 'flute'];
const GENRE_W = new Set([234, 239, 240]);
export const GENRES = {
  211: ['Pop', 'Pop'], 212: ['Hip-hop', 'Hip-hop'], 214: ['Rock', 'Rock'], 215: ['Metal', 'Metal'], 216: ['Punk', 'Punk'],
  221: ['R&B', 'R&B'], 222: ['Soul', 'Soul'], 223: ['Reggae', 'Reggae'], 224: ['Country', 'Country'], 227: ['Funk', 'Funk'],
  228: ['Folk', 'Folk'], 230: ['Jazz', 'Jazz'], 231: ['Disco', 'Disco'], 232: ['Klasyczna', 'Classical'], 233: ['Opera', 'Opera'],
  234: ['Elektroniczna', 'Electronic'], 235: ['House', 'House'], 236: ['Techno', 'Techno'], 237: ['Dubstep', 'Dubstep'],
  238: ['Drum and bass', 'Drum and bass'], 241: ['Ambient', 'Ambient'], 242: ['Trance', 'Trance'], 246: ['Blues', 'Blues'],
  253: ['Religijna', 'Christian'], 254: ['Gospel', 'Gospel'], 258: ['Ska', 'Ska'], 269: ['Taneczna', 'Dance'],
};
const ELECTRONIC = new Set([231, 234, 235, 236, 237, 238, 239, 240, 242, 269]);

export async function resample(x, from, to) {
  if (from === to) return x;
  const len = Math.max(1, Math.round((x.length * to) / from));
  const oc = new OfflineAudioContext(1, len, to);
  const buf = oc.createBuffer(1, x.length, from);
  buf.copyToChannel(x, 0);
  const src = oc.createBufferSource();
  src.buffer = buf;
  src.connect(oc.destination);
  src.start();
  return (await oc.startRendering()).getChannelData(0);
}

let yam = null;
async function yamnet() {
  if (yam) return yam;
  const tf = await import(TFJS);
  try { await tf.setBackend('webgl'); } catch (e) { await tf.setBackend('cpu'); }
  await tf.ready();
  const model = await tf.loadGraphModel(new URL('../assets/yamnet/model.json', import.meta.url).href);
  yam = { tf, model };
  return yam;
}

export async function instruments(x16) {
  const { tf, model } = await yamnet();
  const out = tf.tidy(() => {
    const res = model.predict(tf.tensor1d(x16));
    const scores = Array.isArray(res) ? res[0] : res;
    return { mean: scores.mean(0).arraySync(), max: scores.max(0).arraySync() };
  });
  const sc = (i) => 0.7 * out.mean[i] + 0.3 * out.max[i];
  const fam = {};
  for (const [k, ids] of Object.entries(FAMILIES)) {
    let v = 0;
    for (const i of ids) v = Math.max(v, (GENRE_W.has(i) ? 0.5 : 1) * sc(i));
    fam[k] = +v.toFixed(4);
  }
  const genres = Object.keys(GENRES).map((i) => ({ id: +i, s: sc(+i) })).sort((a, b) => b.s - a.s);
  const top = genres.filter((g) => g.s >= genres[0].s * 0.45 && g.s > 0.004).slice(0, 3);
  const electronic = top.some((g) => ELECTRONIC.has(g.id));
  return { fam, genres: top.map((g) => g.id), electronic, music: +out.mean[132].toFixed(3) };
}

let asr = null, asrKey = '';
async function loadAsr(onProgress) {
  const mobile = matchMedia('(pointer: coarse)').matches;
  const id = mobile ? 'onnx-community/whisper-tiny_timestamped' : 'onnx-community/whisper-base_timestamped';
  if (asr && asrKey === id) return asr;
  const T = await import(TJS);
  const files = {};
  const progress_callback = (p) => {
    if (p.status !== 'progress' || !p.total) return;
    files[p.file] = [p.loaded, p.total];
    let a = 0, b = 0;
    for (const [l, t] of Object.values(files)) { a += l; b += t; }
    if (onProgress) onProgress(a / b);
  };
  try { T.env.backends.onnx.wasm.proxy = true; } catch (e) {}
  asr = await T.pipeline('automatic-speech-recognition', id, { device: 'wasm', dtype: { encoder_model: 'q8', decoder_model_merged: 'q8' }, progress_callback });
  asrKey = id;
  return asr;
}

const GHOSTS = [['thanks', 'for', 'watching'], ['thank', 'you', 'for', 'watching'], ['please', 'subscribe'], ['subscribe', 'to', 'my', 'channel'], ['dziękuję', 'za', 'uwagę'], ['dziękuję', 'za', 'obejrzenie'], ['napisy', 'stworzone', 'przez', 'społeczność', 'amaraorg']];
const norm = (s) => s.toLowerCase().replace(/[^\p{L}\p{N}']/gu, '');

function clean(list) {
  const real = list.filter((w) => w.text && /[\p{L}\p{N}]/u.test(w.text) && Number.isFinite(w.t0));
  const at = {};
  for (const w of real) { const k = Math.round(w.t0 * 50); at[k] = (at[k] || 0) + 1; }
  const ok = real.filter((w) => at[Math.round(w.t0 * 50)] < 3);
  ok.forEach((w, i) => { if (!(w.t1 > w.t0 + 0.05)) w.t1 = Math.min(w.t0 + 0.2, ok[i + 1] ? Math.max(w.t0 + 0.06, ok[i + 1].t0) : w.t0 + 0.2); });
  const out = [];
  for (let i = 0; i < ok.length; i++) {
    const g = GHOSTS.find((ph) => ph.every((x, k) => ok[i + k] && norm(ok[i + k].text) === x));
    if (g) { i += g.length - 1; continue; }
    if (out.length && out[out.length - 1].t0 > ok[i].t0 + 0.05) continue;
    out.push(ok[i]);
  }
  return out;
}

const PLW = new Set('w z na nie się że to jest jak ja ty mnie mi co tak już dla po do ale czy jestem mój moja kocham ciebie tylko gdzie kiedy jeszcze bo by mam masz ten ta te tu tam o od za przez bez we ze'.split(' '));
function plScore(list) {
  if (!list.length) return 0;
  let n = 0;
  for (const w of list) { const t = norm(w.text); if (/[ąćęłńóśźż]/.test(t) || PLW.has(t)) n++; }
  return n / list.length;
}

export async function words(x16, onProgress, lang, plPrior) {
  const pipe = await loadAsr(onProgress);
  if (onProgress) onProgress(1);
  const SR = 16000, n = Math.max(1, Math.ceil(x16.length / (28 * SR))), step = Math.ceil(x16.length / n);
  const run = async (k, lg) => {
    const off = (k * step) / SR;
    const o = { return_timestamps: 'word', max_new_tokens: 160 };
    if (lg === 'pl' || lg === 'en') { o.language = lg === 'pl' ? 'polish' : 'english'; o.task = 'transcribe'; }
    const res = await pipe(x16.subarray(k * step, Math.min(x16.length, (k + 1) * step)), o);
    return clean((res.chunks || []).map((c) => ({ text: c.text.trim(), t0: c.timestamp[0] + off, t1: (c.timestamp[1] ?? c.timestamp[0] + 0.3) + off })));
  };
  let lg = lang === 'pl' || lang === 'en' ? lang : null;
  let first = await run(0, lg);
  if (!lg) {
    lg = guessLang(first.map((w) => w.text).join(' '));
    if (lg === 'en' && plPrior) {
      const alt = await run(0, 'pl');
      if (plScore(alt) >= 0.3) { lg = 'pl'; first = alt; }
    }
  }
  let list = first;
  for (let k = 1; k < n; k++) list = list.concat(await run(k, lg));
  list = clean(list);
  return { text: list.map((w) => w.text).join(' '), words: list, lang: lg };
}

export function guessLang(text) {
  const t = ' ' + text.toLowerCase().replace(/[^\p{L}\s']/gu, ' ') + ' ';
  if (/[ąćęłńóśźż]/.test(t)) return 'pl';
  const pl = (t.match(/ (w|z|na|nie|się|że|to|jest|jak|ja|ty|mnie|mi|co|tak|już|dla|po|do|ale|czy|jestem|mój|moja|kocham|ciebie|tylko|gdzie|kiedy)(?= )/g) || []).length;
  const en = (t.match(/ (the|and|you|to|of|a|in|my|me|is|it|on|for|we|your|love|baby|world|all|be|this|that|with|so|oh|yeah|don't|i'm|can|get)(?= )/g) || []).length;
  return pl > en ? 'pl' : 'en';
}
