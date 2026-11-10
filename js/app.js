// Wire Choir app: song state, floating heads, typing dock (Enter sings, Shift+Enter saves, Space plays), rail windows.
import { AudioSystem } from './audio.js';
import { Player, pool } from './player.js';
import { Stage } from './stage/stage.js';
import { parseLyrics, prepareLang } from './lyrics.js';
import { arrange, buildParts, MOODS, stepToMidi } from './composer.js';
import { PRESETS, LOOKS, INSTS, applyInst, midiToHz, noteName, NOTE_NAMES } from './voices.js';
import { avatarAvailable } from './stage/avatar.js';
import { REST_PARAMS } from './voice/engine.js';
import { Win } from './ui/windows.js';
import { mountNotes } from './ui/notes.js';
import { mountPlay } from './ui/play.js';
import { mountExport } from './ui/export.js';
import { mountListen } from './ui/listen.js';
import { mountPresets } from './ui/presets.js';
import { PHRASES, BEATS, phraseSyllables, phraseMelody } from './presets.js';
import { decodeSong, videoMime } from './share.js';
import { lineIds } from './composer.js';

const $ = (s) => document.querySelector(s);
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

const T = {
  pl: {
    placeholder: 'Napisz coś, co mają zaśpiewać', sing: 'zaśpiewaj', save: 'zapisz', play: 'odtwórz', stop: 'stop',
    saved: (n) => `Zapisano jako linijka ${n}`, singing: 'Śpiewa', heads: 'Głowy', song: 'Piosenka', addHead: 'Dodaj głowę',
    lines: (n) => (n === 0 ? 'Pusta piosenka' : n === 1 ? '1 linijka' : n % 10 >= 2 && n % 10 <= 4 && (n % 100 < 12 || n % 100 > 14) ? `${n} linijki` : `${n} linijek`),
    roles: { lead: 'Prowadzi', harmony: 'Harmonia', choir: 'Chór', bass: 'Bas', beatbox: 'Beatbox', inst: 'Instrument' }, instLbl: 'Instrument',
    moods: { happy: 'Radosny', ballad: 'Ballada', sad: 'Smutny', dark: 'Mroczny', hymn: 'Hymn' },
    major: 'dur', minor: 'moll', head: 'Głowa', role: 'Rola', look: 'Wygląd i brzmienie', voice: 'Głos', register: 'Rejestr', throat: 'Gardło', fem: 'Ciało kobiece', kid: 'Ciało dziecka', modeTip: 'Śpiew albo mowa', spokenShort: 'mowa', breath: 'Oddech',
    soft: 'Miękkość', vib: 'Wibrato', rough: 'Chrypka', volume: 'Głośność', listen: 'Posłuchaj tej głowy', remove: 'Usuń głowę',
    harm: 'Interwał', harms: { up3: 'Tercja wyżej', down3: 'Tercja niżej', down6: 'Seksta niżej', up5: 'Kwinta wyżej' },
    vowel: 'Samogłoska', density: 'Gęstość', dens: { calm: 'Spokojny', normal: 'Normalny', busy: 'Gęsty' },
    mood: 'Nastrój', key: 'Tonacja', tempo: 'Tempo', lang: 'Język', saved_lines: 'Linijki', playAll: 'Odtwórz całość', stopAll: 'Zatrzymaj',
    newMelody: 'Nowa melodia', emptySong: 'Napisz linijkę na dole i wciśnij Shift+Enter, żeby ją tu zapisać.', newMelodyDone: 'Nowa melodia gotowa',
    noLead: 'Żadna głowa nie prowadzi, więc tekst nie zostanie zaśpiewany. Ustaw rolę „Prowadzi” w oknie Głowy.', maxHeads: 'Maksymalnie 6 głów', all: 'wszyscy',
    keysHint: [['⏎', 'zaśpiewaj'], ['⇧⏎', 'dodaj do piosenki'], ['␣', 'odtwórz całość'], ['>', 'powiedz']], afterHint: [['⇧⏎', 'dodaj tę linijkę do piosenki'], ['↑', 'popraw']], who: 'Kto śpiewa: kliknij, żeby zmienić',
    notes: 'Nuty', play: 'Graj', exp: 'Eksport', listenWin: 'Słuchaj', rendering: 'Głowy ćwiczą', presetsWin: 'Gotowce',
    pStarters: 'Zestawy startowe', pConfirm: 'Zastąpić piosenkę? Kliknij jeszcze raz', pNote: 'Kliknij frazę, żeby ją usłyszeć. Plus dodaje ją do piosenki z gotową melodią w Twojej tonacji.', pAdd: 'Dodaj do piosenki',
    pBeats: 'Bity (beatbox)', pBeatPh: 'własny wzór, np. B . t . | Pf . t .', pBeatKit: 'Dźwięki:', pRest: 'pauza', pBass: 'Bas',
    lsNote: 'Puść piosenkę obok mikrofonu albo wybierz plik. Chór usłyszy tempo, melodię, bas, rytm, akordy, instrumenty, słowa i język, a potem sam ustawi głowy i to zagra.',
    lsRecognize: 'Rozpoznaj', lsWordsOpt: 'Słowa i język', lsHeadsOpt: 'Instrumenty i głowy', lsAuto: 'Auto', lsHeard: 'Słyszę', lsDrumsHeard: 'Perkusja',
    lsVoice: { robot: 'Wokal robota', ghost: 'Szept', low: 'Niski wokal', voice: 'Wokal' },
    lsStageBeat: 'Słucham rytmu i melodii…', lsStageInst: 'Rozpoznaję instrumenty…', lsStageModel: 'Pobieram model słów', lsStageWords: 'Słucham słów…', lsStageBuild: 'Ustawiam głowy…',
    lsMic: 'Nagrywaj z mikrofonu', lsStop: 'Zatrzymaj', lsFile: 'Wybierz plik', lsMicName: 'Nagranie z mikrofonu',
    lsNoMic: 'Brak dostępu do mikrofonu. Zezwól na niego w przeglądarce albo wybierz plik.', lsBadFile: 'Nie da się odczytać tego dźwięku. Spróbuj MP3, M4A albo WAV.',
    lsShort: 'Za krótko: potrzeba co najmniej 6 sekund.', lsPart: 'Fragment', lsDrag: 'przesuń po fali', lsWords: 'Słowa do melodii',
    lsWordsPh: 'Puste: słowa rozpozna Whisper. Możesz też wpisać własne, np. around the world.', lsLang: 'Język słów', lsAlso: 'Co jeszcze zaśpiewać', lsBass: 'Bas', lsDrums: 'Rytm',
    lsGo: 'Odtwórz w chórze', lsBusy: 'Słucham…', lsUndo: 'Cofnij', lsUndone: 'Przywrócono poprzednią piosenkę', lsReady: 'Chór odtworzył utwór',
    lsReplace: 'Zastępuje obecną piosenkę i głowy. Model słów (ok. 80 MB) pobiera się tylko za pierwszym razem.', lsQuiet: 'Za cicho, nic nie słychać. Podgłośnij albo podejdź bliżej.',
    lsNoMelody: 'W tym fragmencie nie słychać melodii. Wybierz inny.',
    lsDone: (a, n) => `${Math.round(a.bpm)} BPM · ${['C', 'C#', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B'][a.key]}-${a.mode === 'minor' ? 'moll' : 'dur'} · ${a.bars} taktów · ${n} ${n === 1 ? 'linijka' : n % 10 >= 2 && n % 10 <= 4 && (n % 100 < 12 || n % 100 > 14) ? 'linijki' : 'linijek'} · ${a.melody.length} nut melodii, ${a.bass.length} basu`,
    notesEmpty: 'Zapisz linijki (Shift+Enter), żeby zobaczyć ich nuty.', manual: 'Melodia ręczna', autoMelody: 'Melodia automatyczna', dragHint: 'przeciągaj nuty, krawędź zmienia długość', backToAuto: 'Wróć do automatu',
    playNote: 'Każdy klawisz śpiewa kolejną sylabę piosenki. Harmonia dośpiewuje sama. Nagrane nuty zastępują melodię zaśpiewanych linijek.', playEmpty: 'Zapisz linijki albo wpisz tekst na dole, żeby było co śpiewać.',
    midiNone: 'Brak MIDI: graj myszką albo klawiaturą', recording: 'Nagrywanie…', keysOn: 'Klawiatura komputera: wł.', keysOff: 'Klawiatura komputera: wył.', fromStart: 'Od początku', record: 'Nagrywaj', stopRec: 'Zakończ nagranie',
    recorded: (n) => (n ? `Nagrano ${n} ${n === 1 ? 'linijkę' : n < 5 ? 'linijki' : 'linijek'} jako melodię ręczną` : 'Nagranie nie objęło całej linijki, nic nie zmieniono'),
    expLink: 'Link', expLinkNote: 'Tekst, melodia i głowy w jednym linku.', copyLink: 'Kopiuj link', linkCopied: 'Skopiowano link do piosenki',
    expWav: 'Dźwięk', expWavNote: 'Cała piosenka w pełnej jakości jako plik WAV.', downloadWav: 'Pobierz WAV', wavDone: 'Plik WAV gotowy',
    expVideo: 'Wideo', expVideoNote: 'Piosenka gra od początku i nagrywa się razem z głowami i tekstem. Nie przełączaj karty w trakcie.', noVideo: 'Ta przeglądarka nie nagrywa wideo.',
    vertical: 'Pion 9:16', horizontal: 'Poziom 16:9', recordVideo: 'Nagraj wideo', videoDone: 'Wideo gotowe', needLines: 'Najpierw zapisz linijki piosenki (Shift+Enter).', exportFail: 'Eksport się nie udał:', loadedLink: 'Wczytano piosenkę z linku',
  },
  en: {
    placeholder: 'Type something for them to sing', sing: 'sing', save: 'save', play: 'play', stop: 'stop',
    saved: (n) => `Saved as line ${n}`, singing: 'Singing', heads: 'Heads', song: 'Song', addHead: 'Add head',
    lines: (n) => (n === 0 ? 'Empty song' : n === 1 ? '1 line' : `${n} lines`),
    roles: { lead: 'Lead', harmony: 'Harmony', choir: 'Choir', bass: 'Bass', beatbox: 'Beatbox', inst: 'Instrument' }, instLbl: 'Instrument',
    moods: { happy: 'Happy', ballad: 'Ballad', sad: 'Sad', dark: 'Dark', hymn: 'Hymn' },
    major: 'major', minor: 'minor', head: 'Head', role: 'Role', look: 'Look and sound', voice: 'Voice', register: 'Register', throat: 'Throat', fem: 'Female body', kid: 'Child body', modeTip: 'Sung or spoken', spokenShort: 'spoken', breath: 'Breath',
    soft: 'Softness', vib: 'Vibrato', rough: 'Rasp', volume: 'Volume', listen: 'Hear this head', remove: 'Remove head',
    harm: 'Interval', harms: { up3: 'Third above', down3: 'Third below', down6: 'Sixth below', up5: 'Fifth above' },
    vowel: 'Vowel', density: 'Density', dens: { calm: 'Calm', normal: 'Normal', busy: 'Busy' },
    mood: 'Mood', key: 'Key', tempo: 'Tempo', lang: 'Language', saved_lines: 'Lines', playAll: 'Play all', stopAll: 'Stop',
    newMelody: 'New melody', emptySong: 'Type a line below and press Shift+Enter to save it here.', newMelodyDone: 'New melody ready',
    noLead: 'No head is set to Lead, so the words won’t be sung. Set a head to “Lead” in the Heads window.', maxHeads: 'Up to 6 heads', all: 'everyone',
    keysHint: [['⏎', 'sing'], ['⇧⏎', 'add to song'], ['␣', 'play all'], ['>', 'speak']], afterHint: [['⇧⏎', 'add this line to the song'], ['↑', 'edit']], who: 'Who sings: click to change',
    notes: 'Notes', play: 'Play', exp: 'Export', listenWin: 'Listen', rendering: 'The heads are rehearsing', presetsWin: 'Blocks',
    pStarters: 'Starter sets', pConfirm: 'Replace the song? Click again', pNote: 'Click a phrase to hear it. Plus adds it to the song with its melody in your key.', pAdd: 'Add to the song',
    pBeats: 'Beats (beatbox)', pBeatPh: 'your own pattern, e.g. B . t . | Pf . t .', pBeatKit: 'Sounds:', pRest: 'rest', pBass: 'Bass',
    lsNote: 'Play a song next to the microphone or pick a file. The choir hears the tempo, melody, bass, beat, chords, instruments, words and language, then sets up the heads and plays it.',
    lsRecognize: 'Recognize', lsWordsOpt: 'Words and language', lsHeadsOpt: 'Instruments and heads', lsAuto: 'Auto', lsHeard: 'Heard', lsDrumsHeard: 'Drums',
    lsVoice: { robot: 'Robot vocal', ghost: 'Whisper', low: 'Low vocal', voice: 'Vocal' },
    lsStageBeat: 'Listening to beat and melody…', lsStageInst: 'Recognizing instruments…', lsStageModel: 'Downloading the words model', lsStageWords: 'Listening to the words…', lsStageBuild: 'Setting up the heads…',
    lsMic: 'Record from microphone', lsStop: 'Stop', lsFile: 'Choose a file', lsMicName: 'Microphone recording',
    lsNoMic: 'No microphone access. Allow it in the browser or pick a file.', lsBadFile: 'This audio cannot be read. Try MP3, M4A or WAV.',
    lsShort: 'Too short: at least 6 seconds are needed.', lsPart: 'Excerpt', lsDrag: 'slide along the wave', lsWords: 'Words for the melody',
    lsWordsPh: 'Empty: Whisper hears the words. You can also type your own, e.g. around the world.', lsLang: 'Language of the words', lsAlso: 'Also sing', lsBass: 'Bass', lsDrums: 'Beat',
    lsGo: 'Rebuild with the choir', lsBusy: 'Listening…', lsUndo: 'Undo', lsUndone: 'Previous song restored', lsReady: 'The choir rebuilt the track',
    lsReplace: 'Replaces the current song and heads. The words model (about 80 MB) downloads only the first time.', lsQuiet: 'Too quiet to hear anything. Turn it up or move closer.',
    lsNoMelody: 'No melody can be heard in this excerpt. Pick another one.',
    lsDone: (a, n) => `${Math.round(a.bpm)} BPM · ${['C', 'C#', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B'][a.key]} ${a.mode} · ${a.bars} bars · ${n} line${n === 1 ? '' : 's'} · ${a.melody.length} melody notes, ${a.bass.length} bass`,
    notesEmpty: 'Save lines (Shift+Enter) to see their notes.', manual: 'Hand-made melody', autoMelody: 'Automatic melody', dragHint: 'drag notes, the edge changes length', backToAuto: 'Back to automatic',
    playNote: 'Every key sings the next syllable of the song. Harmony follows on its own. Recorded notes replace the melody of the lines you sang.', playEmpty: 'Save lines or type text below so there is something to sing.',
    midiNone: 'No MIDI: play with the mouse or keyboard', recording: 'Recording…', keysOn: 'Computer keys: on', keysOff: 'Computer keys: off', fromStart: 'From the start', record: 'Record', stopRec: 'Finish recording',
    recorded: (n) => (n ? `Recorded ${n} line${n === 1 ? '' : 's'} as a hand-made melody` : 'The take did not cover a whole line, nothing changed'),
    expLink: 'Link', expLinkNote: 'Words, melody and heads in one link.', copyLink: 'Copy link', linkCopied: 'Song link copied',
    expWav: 'Audio', expWavNote: 'The whole song in full quality as a WAV file.', downloadWav: 'Download WAV', wavDone: 'WAV file ready',
    expVideo: 'Video', expVideoNote: 'The song plays from the start and records with the heads and words. Stay on this tab meanwhile.', noVideo: 'This browser cannot record video.',
    vertical: 'Vertical 9:16', horizontal: 'Horizontal 16:9', recordVideo: 'Record video', videoDone: 'Video ready', needLines: 'Save song lines first (Shift+Enter).', exportFail: 'Export failed:', loadedLink: 'Song loaded from the link',
  },
};

const PALETTE = [['#4fd2ff', '#7dffb6'], ['#a58bff', '#ffc6f1'], ['#7dffb6', '#9fe8ff'], ['#ffb454', '#fff0c8'], ['#ff7ad9', '#d7c8ff'], ['#dfe8ff', '#7fe3ff']];
const ROLES = ['lead', 'harmony', 'choir', 'bass', 'beatbox', 'inst'];
const ROLE_PRESET = { lead: 'baritone', harmony: 'alto', choir: 'tenor', bass: 'bass', beatbox: 'baritone', inst: 'tenor' };

function newHead(role, idx, inst) {
  const preset = ROLE_PRESET[role], p = PRESETS[preset];
  const [color, wordColor] = PALETTE[idx % PALETTE.length];
  const h = { id: 'h' + Math.random().toString(36).slice(2, 8), role, preset, look: 'wire', lo: p.lo, hi: p.hi, tract: p.tract, rd: p.rd, breath: p.breath, vib: p.vib, vibRate: 5.6, rough: p.rough, shift: 0, volume: 1, color, wordColor, harm: 'up3', vowel: 'u', density: 'normal' };
  if (role === 'inst') applyInst(h, inst || 'synth');
  return h;
}
const DEFAULT = () => ({ v: 1, lang: (navigator.languages || [navigator.language || '']).some((l) => /^pl/i.test(l)) ? 'pl' : 'en', mood: 'happy', key: 0, bpm: null, seed: 7, lines: [], heads: [newHead('lead', 0)] });

function load() { try { const s = JSON.parse(localStorage.getItem('wc.song')); return s && s.v === 1 && s.heads && s.heads.length ? s : null; } catch (e) { return null; } }
function save() { try { localStorage.setItem('wc.song', JSON.stringify(song)); } catch (e) {} }
let song = load() || DEFAULT();
const t = () => T[song.lang] || T.pl;

const sys = new AudioSystem();
const player = new Player(sys);
let audioReady = false;
async function ensureAudio() {
  await sys.start();
  await sys.resume();
  if (!audioReady) { audioReady = true; player.sync(song.heads); pool.init().catch((e) => toast(t().exportFail + ' ' + e.message, 5000)); schedulePrepare(); }
}

let hasAvatar = false;
const canvas = $('#stage');
const stage = new Stage(canvas, { layout: 'row' });
stage.gap = 0;
const idle = { params: Float32Array.from(REST_PARAMS), level: 0, f0Rel: 0 };
const panelOf = new Map();
function syncPanels() {
  const ids = new Set(song.heads.map((h) => h.id));
  for (const [id, p] of panelOf) if (!ids.has(id)) { stage.removePanel(p); panelOf.delete(id); }
  song.heads.forEach((h, i) => {
    let p = panelOf.get(h.id);
    const look = h.look === 'jurek' && !hasAvatar ? 'wire' : h.look || 'wire';
    if (p && (p.color !== h.color || p.look !== look)) { stage.removePanel(p); panelOf.delete(h.id); p = null; }
    if (!p) {
      p = stage.addPanel({ id: h.id, look, color: h.color, wordColor: h.wordColor, phase: i * 1.9, scale: 0.86 + (h.tract - 12) * 0.02, source: () => {
        const v = player.voiceOf(h.id);
        if (!v) return idle;
        v.sample();
        return { params: v.params, level: v.level, f0Rel: Math.log2(v.f0 / midiToHz((h.lo + h.hi) / 2 + (h.shift || 0))) };
      } });
      p.color = h.color;
      p.look = look;
      panelOf.set(h.id, p);
    }
    p.head.group.scale.setScalar(0.86 + (h.tract - 12) * 0.02);
  });
  stage.panels.sort((a, b) => song.heads.findIndex((h) => h.id === a.id) - song.heads.findIndex((h) => h.id === b.id));
  stage.relayout();
}
new ResizeObserver(() => { if (!stage.recording) stage.setSize(canvas.clientWidth, canvas.clientHeight); }).observe(canvas);
stage.setSize(canvas.clientWidth, canvas.clientHeight);
syncPanels();

let dragP = null, dragX = 0;
canvas.addEventListener('pointerdown', (e) => {
  const r = canvas.getBoundingClientRect();
  dragP = stage.panelAt(e.clientX - r.left, e.clientY - r.top);
  if (!dragP) return;
  dragX = e.clientX;
  canvas.setPointerCapture(e.pointerId);
  if (dragP.yawOverride === null) dragP.yawOverride = -1.1;
  dragP.overrideT = 5;
});
canvas.addEventListener('pointermove', (e) => { if (!dragP) return; dragP.yawOverride += (e.clientX - dragX) * 0.008; dragX = e.clientX; dragP.overrideT = 5; });
canvas.addEventListener('pointerup', () => { dragP = null; });

let current = null, liveParsed = null;
player.onWord = (hid, w) => {
  const p = panelOf.get(hid);
  const src = current ? current.parsed : liveParsed;
  const word = src && src.words[w];
  if (p && word) stage.emitWord(p, word.text);
};
let karaToken = 0;
function karaShow() { karaToken++; document.body.classList.remove('kara-fade'); document.body.classList.add('kara-on'); }
function karaHide(fade) {
  const tok = ++karaToken;
  if (!fade) { document.body.classList.remove('kara-on', 'kara-fade'); return; }
  document.body.classList.add('kara-fade');
  setTimeout(() => { if (tok === karaToken) document.body.classList.remove('kara-on', 'kara-fade'); }, 900);
}
player.onEnd = () => { karaHide(true); current = null; renderHistory(); updateStatus(); };

const input = $('#input'), kara = $('#kara');
let lastSung = '', lastSaved = true;
function autosize() { input.style.height = 'auto'; input.style.height = input.scrollHeight + 'px'; }

function lineOpts(lines) {
  const lineSpoken = {};
  lines.forEach((l, i) => { if (l.spoken) lineSpoken[i] = true; });
  return { lineSingers: singersFor(lines), lineSpoken };
}
const body3 = (h) => {
  const fem = +(h.fem ?? ({ alto: 1, soprano: 1 }[h.preset] || 0)), kid = +(h.kid ?? (h.preset === 'child' ? 1 : 0));
  return 17.6 - 2.7 * fem - (5.4 - 2.7 * fem) * kid;
};
function singersFor(lines) {
  const out = {};
  lines.forEach((l, i) => { if (l.singers && l.singers.length) out[i] = l.singers; });
  return out;
}

function karaokeHTML(text, notes) {
  let html = '', pos = 0;
  const low = text.toLowerCase();
  notes.forEach((n, i) => {
    const s = (n.syl.text || '').trim().toLowerCase();
    if (!s) return;
    const at = low.indexOf(s, pos);
    if (at < 0) return;
    html += esc(text.slice(pos, at)) + `<span class="syl" data-n="${i}">${esc(text.slice(at, at + s.length))}</span>`;
    pos = at + s.length;
  });
  return html + esc(text.slice(pos));
}

async function singLine(text, mel) {
  text = text.trim();
  const spoken = text.startsWith('>');
  if (spoken) text = text.slice(1).trim();
  if (!text) return;
  await ensureAudio();
  await prepareLang(song.lang);
  const parsed = parseLyrics(text, song.lang);
  if (!parsed.syls.length) return;
  const leads = song.heads.filter((h) => h.role === 'lead').map((h) => h.id);
  if (!leads.length) toast(t().noLead, 4200);
  const base = mel && mel.notes.length === parsed.syls.length ? { ...song, melody: { [lineIds(parsed)[0]]: mel } } : song;
  const arr = arrange({ ...base, track: null, lineSingers: { 0: leads }, lineSpoken: spoken ? { 0: true } : {} }, parsed, song.heads, { intro: false });
  const parts = buildParts(arr, song.heads);
  const notes = arr.notes.map((n) => ({ ...n, t0: n.b * arr.spb, t1: (n.b + n.d) * arr.spb }));
  const backing = song.heads.some((h) => h.role === 'choir' || h.role === 'bass' || h.role === 'beatbox' || h.role === 'inst');
  const dur = backing ? arr.duration : Math.max(...notes.map((n) => n.t1)) + (spoken ? 1.2 : 0.7);
  if (spoken) text = '> ' + text;
  lastSung = text;
  lastSaved = song.lines.some((l) => (l.spoken ? '> ' + l.text : l.text) === text);
  renderHint();
  current = null;
  if (!(await startPlay(arr, parts, song.heads, dur))) return;
  current = { mode: 'line', parsed, arr: { ...arr, duration: dur }, notes, color: colorOf(leads[0]) };
  kara.innerHTML = karaokeHTML(spoken ? text.slice(2) : text, notes);
  if (!input.value) karaShow(); else karaHide(false);
  updateStatus();
}

async function playSong() {
  if (!song.lines.length) { input.focus(); return; }
  await ensureAudio();
  await prepareLang(song.lang);
  const parsed = parseLyrics(song.lines.map((l) => l.text).join('\n'), song.lang);
  const arr = arrange({ ...song, ...lineOpts(song.lines) }, parsed, song.heads);
  const parts = buildParts(arr, song.heads);
  current = null;
  if (!(await startPlay(arr, parts, song.heads))) return;
  const notes = arr.notes.map((n) => ({ ...n, t0: n.b * arr.spb, t1: (n.b + n.d) * arr.spb }));
  current = { mode: 'song', parsed, arr, notes, line: -1 };
  kara.innerHTML = '';
  if (!input.value) karaShow(); else karaHide(false);
  updateStatus();
}

async function startPlay(arr, parts, heads, dur) {
  try { return await player.play(arr, parts, song.lang, heads, dur); }
  catch (e) { toast(t().exportFail + ' ' + (e && e.message), 5000); return false; }
}
player.onProgress = () => updateStatus();

let prepTimer = 0;
function schedulePrepare(ms = 700) {
  clearTimeout(prepTimer);
  prepTimer = setTimeout(async () => {
    if (!audioReady || player.loading || !song.lines.length) return;
    try {
      await prepareLang(song.lang);
      const parsed = parseLyrics(song.lines.map((l) => l.text).join('\n'), song.lang);
      if (!parsed.syls.length) return;
      const arr = arrange({ ...song, ...lineOpts(song.lines) }, parsed, song.heads);
      player.prepare(arr, buildParts(arr, song.heads), song.lang, song.heads);
    } catch (e) {}
  }, ms);
}
let typeTimer = 0;
function scheduleTyped() {
  clearTimeout(typeTimer);
  typeTimer = setTimeout(async () => {
    const text = input.value.trim();
    if (!audioReady || player.loading || player.playing || text.length < 2) return;
    try {
      await prepareLang(song.lang);
      const parsed = parseLyrics(text.replace(/^>\s*/, ''), song.lang);
      if (!parsed.syls.length) return;
      const leads = song.heads.filter((h) => h.role === 'lead').map((h) => h.id);
      const sp = text.startsWith('>');
      const arr = arrange({ ...song, track: null, lineSingers: { 0: leads }, lineSpoken: sp ? { 0: true } : {} }, parsed, song.heads, { intro: false });
      player.prepare(arr, buildParts(arr, song.heads), song.lang, song.heads);
    } catch (e) {}
  }, 450);
}

function stopAll() { player.stop(); }
function toggleSong() { if (player.playing || player.loading) stopAll(); else playSong(); }
function colorOf(id) { const h = song.heads.find((x) => x.id === id); return h ? h.wordColor : '#f5f5f7'; }

function saveLine(text) {
  text = text.trim();
  if (!text) return;
  const was = text;
  const spoken = text.startsWith('>');
  if (spoken) text = text.slice(1).trim();
  if (!text) return;
  song.lines.push(spoken ? { text, singers: [], spoken: true } : { text, singers: [] });
  if (was === lastSung) lastSaved = true;
  commit();
  renderHint();
  toast(t().saved(song.lines.length));
}
function saveNow() {
  if (input.value.trim()) { saveLine(input.value); input.value = ''; autosize(); }
  else if (lastSung && !lastSaved) saveLine(lastSung);
}

input.addEventListener('keydown', (e) => {
  if (e.isComposing) return;
  if (e.key === 'Enter' && !e.shiftKey && !e.metaKey && !e.ctrlKey) {
    e.preventDefault();
    send();
  } else if (e.key === 'Enter' && e.shiftKey) {
    e.preventDefault();
    saveNow();
  } else if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
    e.preventDefault(); toggleSong();
  } else if (e.key === ' ' && !input.value) {
    e.preventDefault(); toggleSong();
  } else if (e.key === 'Escape') {
    stopAll();
  } else if (e.key === 'ArrowUp' && !input.value && (lastSung || song.lines.length)) {
    e.preventDefault(); input.value = lastSung || song.lines[song.lines.length - 1].text; autosize(); karaHide(false);
  }
});
function send() {
  const v = input.value;
  if (!v.trim()) { toggleSong(); return; }
  input.value = '';
  autosize();
  singLine(v);
}
input.addEventListener('input', () => { autosize(); if (input.value) karaHide(false); scheduleTyped(); });
window.addEventListener('pointerdown', function wake() { window.removeEventListener('pointerdown', wake); ensureAudio().catch(() => {}); }, { once: true });
$('#save').addEventListener('click', () => { saveNow(); input.focus(); });
$('#dock').addEventListener('pointerdown', (e) => { if (!e.target.closest('button')) setTimeout(() => input.focus(), 0); });
window.addEventListener('keydown', (e) => {
  const tag = (e.target.tagName || '').toLowerCase();
  if (tag === 'textarea' || tag === 'input' || tag === 'select' || e.target.isContentEditable) return;
  if (e.key === ' ' && tag !== 'button') { e.preventDefault(); toggleSong(); return; }
  if (e.key === 'Escape') { stopAll(); return; }
  if (e.key.length === 1 && !e.metaKey && !e.ctrlKey && !e.altKey) input.focus();
});

let toastTimer = 0;
function toast(msg, ms = 2200) {
  const el = $('#toast');
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), ms);
}

function fmt(s) { s = Math.max(0, s); return Math.floor(s / 60) + ':' + String(Math.floor(s % 60)).padStart(2, '0'); }
function keyName() { const m = MOODS[song.mood] || MOODS.happy; return NOTE_NAMES[song.key] + (song.lang === 'pl' ? '-' : ' ') + (m.mode === 'minor' ? t().minor : t().major); }
function bpm() { return song.bpm || (MOODS[song.mood] || MOODS.happy).bpm; }
function updateStatus() {
  const s = $('#status');
  if (player.loading && !player.playing) s.textContent = `${t().rendering} · ${player.loading.done}/${player.loading.total}`;
  else if (current && player.playing) s.textContent = `${t().singing} · ${fmt(Math.max(0, player.time()))} / ${fmt(current.arr.duration)}`;
  else s.textContent = [t().lines(song.lines.length), t().moods[song.mood], keyName(), bpm() + ' BPM', song.lang.toUpperCase()].join(' · ');
}
function renderChrome() {
  document.documentElement.lang = song.lang;
  input.placeholder = t().placeholder;
  renderHint();
  const labels = { heads: t().heads, song: t().song, notes: t().notes, play: t().play, presets: t().presetsWin, listen: t().listenWin, export: t().exp };
  document.querySelectorAll('#rail button').forEach((b) => { b.querySelector('span').textContent = labels[b.dataset.open]; b.setAttribute('aria-label', labels[b.dataset.open]); });
  updateStatus();
}

function renderHint() {
  const after = lastSung && !lastSaved;
  document.body.classList.toggle('can-save', after);
  $('#hint').innerHTML = (after ? t().afterHint : t().keysHint).map(([k, v]) => `<span><kbd>${k}</kbd>${v}</span>`).join('');
}

function renderHistory() {
  const h = $('#history');
  const playingLine = current && current.mode === 'song' ? current.line : -1;
  h.innerHTML = song.lines.map((l, k) => {
    const who = (l.singers && l.singers[0]) || (song.heads.find((x) => x.role === 'lead') || {}).id;
    const c = (song.heads.find((x) => x.id === who) || {}).color || '#4fd2ff';
    return `<button class="verse${k === playingLine ? ' on' : ''}" data-l="${k}"><i style="background:${c}"></i>${esc(l.text)}</button>`;
  }).join('');
  h.scrollTop = h.scrollHeight;
}
$('#history').addEventListener('click', (e) => {
  const b = e.target.closest('[data-l]');
  if (!b) return;
  const l = song.lines[+b.dataset.l];
  if (l) singLine(l.spoken ? '> ' + l.text : l.text);
});


const wins = {};
const MODS = { notes: mountNotes, play: mountPlay, listen: mountListen, export: mountExport, presets: mountPresets };
const TITLE = { heads: () => t().heads, song: () => t().song, notes: () => t().notes, play: () => t().play, listen: () => t().listenWin, export: () => t().exp, presets: () => t().presetsWin };
function openWin(name) {
  if (wins[name]) { wins[name].close(); return; }
  const W = window.innerWidth, H = window.innerHeight;
  const cfg = {
    heads: { w: 340, h: 520, x: 60, y: 50 },
    song: { w: 380, h: 470, x: Math.max(60, W - 440), y: 50 },
    notes: { w: Math.min(900, W - 140), h: 330, x: 70, y: Math.max(50, H * 0.42) },
    play: { w: 520, h: 330, x: Math.max(60, W / 2 - 260), y: Math.max(50, H * 0.4) },
    export: { w: 340, h: 430, x: Math.max(60, W - 400), y: 60 },
    listen: { w: 380, h: 560, x: Math.max(60, W - 440), y: 50 },
    presets: { w: 400, h: Math.min(640, H - 90), x: Math.max(60, W - 460), y: 50 },
  }[name];
  const w = new Win(name, TITLE[name](), cfg);
  w.onClose = () => {
    if (w.ctrl) w.ctrl.destroy();
    delete wins[name];
    document.querySelector(`#rail [data-open="${name}"]`)?.classList.remove('on');
  };
  wins[name] = w;
  document.querySelector(`#rail [data-open="${name}"]`)?.classList.add('on');
  if (MODS[name]) w.ctrl = MODS[name](w.body, app);
  else renderWin(name);
}
function renderWin(name) {
  const w = wins[name];
  if (!w) return;
  w.el.querySelector('.win-t').textContent = TITLE[name]();
  if (w.ctrl) { w.ctrl.refresh(); return; }
  if (name === 'heads') renderHeads(w.body); else if (name === 'song') renderSong(w.body);
}
document.querySelectorAll('[data-open]').forEach((b) => b.addEventListener('click', () => openWin(b.dataset.open)));

function commit(opts = {}) {
  save();
  syncPanels();
  if (audioReady) player.sync(song.heads);
  schedulePrepare();
  if (!opts.keepWins) { renderWin('heads'); renderWin('song'); }
  renderWin('notes'); renderWin('play'); renderWin('listen'); renderWin('presets');
  renderHistory();
  renderChrome();
}

let expanded = song.heads[0] ? song.heads[0].id : null;
avatarAvailable().then((ok) => { hasAvatar = ok; if (ok) syncPanels(); renderWin('heads'); });
function chips(items, cur, on) {
  const d = document.createElement('div');
  d.className = 'chips';
  for (const [v, label] of items) {
    const b = document.createElement('button');
    b.textContent = label;
    if (v === cur) b.classList.add('on');
    b.addEventListener('click', () => on(v));
    d.appendChild(b);
  }
  return d;
}
function label(text, val) { const d = document.createElement('div'); d.className = 'lbl'; d.innerHTML = `<span>${text}</span><b>${val ?? ''}</b>`; return d; }

function slider(h, key, name, min, max, step, fmtv) {
  const wrap = document.createDocumentFragment();
  if (key === 'fem' && h.fem === undefined) h.fem = { alto: 1, soprano: 1 }[h.preset] || 0;
  if (key === 'kid' && h.kid === undefined) h.kid = h.preset === 'child' ? 1 : 0;
  const lb = label(name, fmtv(h[key]));
  const r = document.createElement('input');
  r.type = 'range'; r.min = min; r.max = max; r.step = step; r.value = h[key];
  r.setAttribute('aria-label', name);
  r.addEventListener('input', () => {
    h[key] = +r.value;
    lb.querySelector('b').textContent = fmtv(h[key]);
    save();
    if (audioReady) player.sync(song.heads);
    schedulePrepare(1500);
    if (key === 'fem' || key === 'kid') { h.tract = +body3(h).toFixed(2); syncPanels(); }
  });
  r.addEventListener('change', () => audition(h));
  wrap.append(lb, r);
  return wrap;
}

async function audition(h) {
  await ensureAudio();
  if (player.playing || player.loading) return;
  try { await player.audition(h, song.beat && song.beat.text); } catch (e) {}
}

function renderHeads(body) {
  const L = t();
  body.innerHTML = '';
  const add = document.createElement('button');
  add.className = 'btn pri';
  add.style.width = '100%';
  add.textContent = '+ ' + L.addHead;
  add.addEventListener('click', () => {
    if (song.heads.length >= 6) { toast(L.maxHeads); return; }
    const used = song.heads.map((h) => h.role);
    const role = ['harmony', 'bass', 'beatbox', 'choir', 'choir', 'lead'].find((r) => !used.includes(r) || r === 'choir') || 'choir';
    const h = newHead(role, song.heads.length);
    song.heads.push(h);
    expanded = h.id;
    commit();
  });
  body.appendChild(add);
  const list = document.createElement('div');
  list.style.marginTop = '10px';
  song.heads.forEach((h, i) => {
    const row = document.createElement('div');
    row.className = 'hrow';
    row.innerHTML = `<i style="background:${h.color}"></i><b>${L.head} ${i + 1}</b><span>${h.role === 'inst' ? (INSTS[h.inst] || INSTS.synth)[song.lang] : L.roles[h.role]} · ${(LOOKS[h.look] || LOOKS.wire)[song.lang]}</span>`;
    row.addEventListener('click', () => { expanded = expanded === h.id ? null : h.id; renderHeads(body); });
    list.appendChild(row);
    if (expanded !== h.id) return;
    const ed = document.createElement('div');
    ed.className = 'hed';
    const looks = Object.keys(LOOKS).filter((k) => k !== 'jurek' || hasAvatar);
    ed.append(label(L.look), chips(looks.map((k) => [k, LOOKS[k][song.lang]]), h.look || 'wire', (k) => {
      h.look = k;
      const p = PRESETS[h.preset] || PRESETS.baritone;
      Object.assign(h, { lo: p.lo, hi: p.hi, tract: p.tract, rd: p.rd, breath: p.breath, vib: p.vib, vibRate: 5.6, rough: p.rough }, LOOKS[k].voice || {});
      commit();
      audition(h);
    }));
    ed.append(label(L.role), chips(ROLES.map((r) => [r, L.roles[r]]), h.role, (r) => { h.role = r; if (r === 'inst' && !h.inst) applyInst(h, 'synth'); commit(); }));
    if (h.role === 'inst') ed.append(label(L.instLbl), chips(Object.keys(INSTS).map((k) => [k, INSTS[k][song.lang]]), h.inst || 'synth', (k) => { applyInst(h, k); commit(); audition(h); }));
    ed.append(label(L.voice), chips(Object.keys(PRESETS).map((k) => [k, PRESETS[k][song.lang]]), h.preset, (k) => {
      const p = PRESETS[k];
      Object.assign(h, { preset: k, lo: p.lo, hi: p.hi, tract: p.tract, rd: p.rd, breath: p.breath, vib: p.vib, rough: p.rough, shift: 0, fem: { alto: 1, soprano: 1 }[k] || 0, kid: k === 'child' ? 1 : 0 });
      commit();
      audition(h);
    }));
    if (h.role === 'harmony') ed.append(label(L.harm), chips(Object.entries(L.harms), h.harm, (v) => { h.harm = v; commit(); }));
    if (h.role === 'choir') ed.append(label(L.vowel), chips([['u', 'u'], ['o', 'o'], ['a', 'a'], ['M', 'mmm']], h.vowel, (v) => { h.vowel = v; commit(); }));
    if (h.role === 'beatbox') ed.append(label(L.density), chips(Object.entries(L.dens), h.density, (v) => { h.density = v; commit(); }));
    ed.append(
      slider(h, 'shift', L.register, -12, 12, 1, (v) => noteName((h.lo + h.hi) / 2 + v)),
      slider(h, 'fem', L.fem, 0, 1, 0.01, (v) => Math.round(v * 100) + '%'),
      slider(h, 'kid', L.kid, 0, 1, 0.01, (v) => Math.round(v * 100) + '%'),
      slider(h, 'breath', L.breath, 0, 1, 0.01, (v) => Math.round(v * 100) + '%'),
      slider(h, 'rd', L.soft, 0.4, 2.4, 0.01, (v) => v.toFixed(2)),
      slider(h, 'vib', L.vib, 0, 90, 1, (v) => v + ' c'),
      slider(h, 'rough', L.rough, 0, 1, 0.01, (v) => Math.round(v * 100) + '%'),
      slider(h, 'volume', L.volume, 0, 1.5, 0.01, (v) => Math.round(v * 100) + '%'),
    );
    const ls = document.createElement('button');
    ls.className = 'listen';
    ls.textContent = L.listen;
    ls.addEventListener('click', () => audition(h));
    ed.append(ls);
    if (song.heads.length > 1) {
      const rm = document.createElement('button');
      rm.className = 'btn quiet';
      rm.style.marginTop = '8px';
      rm.textContent = L.remove;
      rm.addEventListener('click', () => { song.heads = song.heads.filter((x) => x.id !== h.id); song.lines.forEach((l) => { l.singers = (l.singers || []).filter((id) => id !== h.id); }); expanded = null; commit(); });
      ed.append(rm);
    }
    list.appendChild(ed);
  });
  body.appendChild(list);
}

function renderSong(body) {
  const L = t();
  body.innerHTML = '';
  body.append(label(L.mood), chips(Object.keys(MOODS).map((m) => [m, L.moods[m]]), song.mood, (m) => { song.mood = m; song.bpm = null; commit(); }));
  const keyRow = label(L.key, '');
  const sel = document.createElement('select');
  sel.setAttribute('aria-label', L.key);
  NOTE_NAMES.forEach((n, i) => { const o = document.createElement('option'); o.value = i; o.textContent = n; if (i === song.key) o.selected = true; sel.appendChild(o); });
  sel.addEventListener('change', () => { song.key = +sel.value; commit({ keepWins: true }); });
  keyRow.querySelector('b').appendChild(sel);
  body.append(keyRow);
  const tl = label(L.tempo, bpm() + ' BPM');
  const tr = document.createElement('input');
  tr.type = 'range'; tr.min = 56; tr.max = 168; tr.step = 1; tr.value = bpm();
  tr.setAttribute('aria-label', L.tempo);
  tr.addEventListener('input', () => { song.bpm = +tr.value; tl.querySelector('b').textContent = song.bpm + ' BPM'; save(); updateStatus(); });
  body.append(tl, tr);
  body.append(label(L.lang), chips([['pl', 'Polski'], ['en', 'English']], song.lang, (v) => { song.lang = v; commit(); }));
  body.append(label(L.saved_lines, song.lines.length || ''));
  const list = document.createElement('div');
  if (!song.lines.length) list.innerHTML = `<p class="empty">${L.emptySong}</p>`;
  const leads = song.heads.filter((h) => h.role === 'lead');
  song.lines.forEach((l, i) => {
    const r = document.createElement('div');
    r.className = 'lrow';
    const who = l.singers && l.singers.length ? l.singers : [];
    const c = who.length === 1 ? colorOf(who[0]) && (song.heads.find((x) => x.id === who[0]) || {}).color : who.length > 1 ? '#f5f5f7' : (leads[0] || {}).color || '#4fd2ff';
    r.innerHTML = `<button aria-label="${L.sing}">▶</button><p contenteditable="true" spellcheck="false">${esc(l.text)}</p><button class="mode" title="${L.modeTip}">${l.spoken ? L.spokenShort : '♪'}</button><button class="who" title="${L.who}" style="background:${c}"></button><button aria-label="×">×</button>`;
    const [pb, , mb, wb, xb] = r.children;
    const p = r.querySelector('p');
    pb.addEventListener('click', () => singLine(l.spoken ? '> ' + l.text : l.text));
    mb.addEventListener('click', () => { if (l.spoken) delete l.spoken; else l.spoken = true; commit(); });
    p.addEventListener('blur', () => { const v = p.textContent.trim(); if (v && v !== l.text) { l.text = v; commit({ keepWins: true }); } });
    p.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); p.blur(); } });
    wb.addEventListener('click', () => {
      if (leads.length < 2) return;
      const opts = [...leads.map((h) => [h.id]), leads.map((h) => h.id)];
      const k = opts.findIndex((o) => o.join() === (who.length ? who.join() : leads[0].id));
      l.singers = opts[(k + 1) % opts.length];
      commit();
    });
    xb.addEventListener('click', () => { song.lines.splice(i, 1); commit(); });
    list.appendChild(r);
  });
  body.append(list);
  const row = document.createElement('div');
  row.className = 'row2';
  const pa = document.createElement('button');
  pa.className = 'btn pri';
  pa.textContent = player.playing && current && current.mode === 'song' ? L.stopAll : L.playAll;
  pa.addEventListener('click', () => { toggleSong(); setTimeout(() => renderWin('song'), 50); });
  const nm = document.createElement('button');
  nm.className = 'btn';
  nm.textContent = L.newMelody;
  nm.addEventListener('click', () => { song.seed = (song.seed * 7919 + 13) % 1000003; save(); toast(L.newMelodyDone); if (player.playing && current && current.mode === 'song') playSong(); });
  row.append(pa, nm);
  body.append(row);
}

let last = performance.now(), statusT = 0, lastActive = 0;
function loop() {
  requestAnimationFrame(loop);
  const now = performance.now();
  const active = player.playing || player.loading || dragP || stage.recording || wins.notes || [...player.voices.values()].some((v) => v.level > 0.001);
  player.frame();
  if (active) lastActive = now;
  if (now - lastActive > 1500 && now - last < 40) return;
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  stage.frame(dt);
  if (onFrame) onFrame();
  for (const k of ['notes', 'play']) if (wins[k] && wins[k].ctrl) wins[k].ctrl.frame();
  if (current && player.playing) {
    const tt = player.time();
    if (current.mode === 'song') {
      let li = -1;
      for (let k = 0; k < current.arr.lines.length; k++) if (tt >= current.arr.lines[k].b0 * current.arr.spb - 0.5) li = k;
      if (li !== current.line) {
        current.line = li;
        const ln = current.arr.lines[li];
        if (ln) {
          const idx = [];
          current.notes.forEach((n, i) => { if (n.line === ln.i) idx.push(i); });
          const text = current.parsed.lines[ln.i].text;
          const sub = idx.map((i) => current.notes[i]);
          kara.innerHTML = karaokeHTML(text, sub).replace(/data-n="(\d+)"/g, (m, k) => `data-n="${idx[+k]}"`);
          current.color = colorOf(ln.singers[0]);
        } else kara.innerHTML = '';
        renderHistory();
      }
    }
    const host = kara;
    host.querySelectorAll('.syl').forEach((s) => {
      const n = current.notes[+s.dataset.n];
      if (!n) return;
      const pr = Math.max(0, Math.min(1, (tt - n.t0) / Math.max(0.08, n.t1 - n.t0)));
      s.style.backgroundImage = `linear-gradient(90deg, ${current.color} ${pr * 100}%, ${current.mode === 'song' ? '#3a3a3c' : '#f5f5f7'} ${pr * 100}%)`;
      s.style.color = 'transparent';
    });
    statusT += dt;
    if (statusT > 0.25) { statusT = 0; updateStatus(); }
  }
}

document.body.style.setProperty('--head', (song.heads.find((h) => h.role === 'lead') || song.heads[0]).color);
renderChrome();
renderHistory();
autosize();
window.addEventListener('resize', autosize);
if (document.fonts) document.fonts.ready.then(autosize);
setTimeout(autosize, 250);
input.focus();
let onFrame = null;

function karaSegments(tt) {
  if (!current) return [];
  let ln;
  if (current.mode === 'song') ln = current.arr.lines[current.line];
  const idx = [];
  current.notes.forEach((n, i) => { if (!ln || n.line === ln.i) idx.push(i); });
  const text = ln ? current.parsed.lines[ln.i].text : current.parsed.lines[0] ? current.parsed.lines[0].text : '';
  const segs = [];
  let pos = 0;
  const low = text.toLowerCase();
  for (const i of idx) {
    const n = current.notes[i];
    const sx = (n.syl.text || '').trim().toLowerCase();
    if (!sx) continue;
    const at = low.indexOf(sx, pos);
    if (at < 0) continue;
    if (at > pos) segs.push({ text: text.slice(pos, at), pr: tt >= n.t0 ? 1 : 0 });
    segs.push({ text: text.slice(at, at + sx.length), pr: Math.max(0, Math.min(1, (tt - n.t0) / Math.max(0.08, n.t1 - n.t0))) });
    pos = at + sx.length;
  }
  if (pos < text.length) segs.push({ text: text.slice(pos), pr: 0 });
  return segs;
}

async function recordVideo(fmt, onProg) {
  await ensureAudio();
  const W = fmt === '9:16' ? 1080 : 1920, H = fmt === '9:16' ? 1920 : 1080;
  const sh = Math.round(H * (fmt === '9:16' ? 0.7 : 0.76));
  const comp = document.createElement('canvas');
  comp.width = W; comp.height = H;
  const g = comp.getContext('2d');
  stage.beginRecord(W, sh);
  document.body.classList.add('recording');
  const stream = comp.captureStream(30);
  sys.stream.stream.getAudioTracks().forEach((tr) => stream.addTrack(tr));
  const mime = videoMime();
  const mr = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: 9000000, audioBitsPerSecond: 192000 });
  const chunks = [];
  mr.ondataavailable = (e) => { if (e.data.size) chunks.push(e.data); };
  const fs = fmt === '9:16' ? 62 : 56;
  onFrame = () => {
    g.fillStyle = '#000'; g.fillRect(0, 0, W, H);
    g.drawImage(stage.canvas, 0, 0, W, sh);
    g.font = `500 ${Math.round(fs * 0.42)}px -apple-system, BlinkMacSystemFont, "SF Pro Display", Helvetica, sans-serif`;
    g.fillStyle = '#8e8e93'; g.textBaseline = 'top';
    g.fillText('Wire Choir', Math.round(W * 0.05), Math.round(H * 0.025));
    const tt = player.time();
    const segs = karaSegments(tt);
    g.font = `400 ${fs}px -apple-system, BlinkMacSystemFont, "SF Pro Display", Helvetica, sans-serif`;
    g.textBaseline = 'alphabetic';
    const maxW = W * 0.88;
    const words = [];
    for (const sg of segs) words.push(sg);
    let lines = [[]], lw = 0;
    for (const sg of words) { const w = g.measureText(sg.text).width; if (lw + w > maxW && lines[lines.length - 1].length) { lines.push([]); lw = 0; } lines[lines.length - 1].push(sg); lw += w; }
    const c = current ? current.color || '#7dffb6' : '#7dffb6';
    let y = sh + (H - sh) * 0.42;
    for (const ln of lines) {
      let x = W * 0.06;
      for (const sg of ln) {
        const w = g.measureText(sg.text).width;
        g.fillStyle = '#3a3a3c'; g.fillText(sg.text, x, y);
        if (sg.pr > 0) { g.save(); g.beginPath(); g.rect(x, y - fs, w * sg.pr, fs * 1.4); g.clip(); g.fillStyle = c; g.fillText(sg.text, x, y); g.restore(); }
        x += w;
      }
      y += fs * 1.25;
    }
    if (current) onProg && onProg(Math.max(0, Math.min(1, tt / current.arr.duration)));
  };
  const job = await app.songJob();
  if (job) await Promise.all(player.units(job.arr, job.parts, job.lang, job.heads).map((u) => pool.request(u.spec, 10)));
  mr.start(250);
  const done = new Promise((res) => { const prev = player.onEnd; player.onEnd = () => { player.onEnd = prev; prev && prev(); res(); }; });
  await playSong();
  if (!current) { player.onEnd && player.onEnd(); }
  await done;
  await new Promise((r) => setTimeout(r, 700));
  const stopped = new Promise((r) => { mr.onstop = r; });
  mr.stop();
  await stopped;
  onFrame = null;
  document.body.classList.remove('recording');
  stage.endRecord();
  stage.setSize(canvas.clientWidth, canvas.clientHeight);
  return new Blob(chunks, { type: mime.split(';')[0] });
}

function saveRecording(parsed, sylls, evs) {
  const ids = lineIds(parsed);
  const byLine = new Map();
  for (const e of evs) {
    const syl = sylls[e.pos];
    if (!syl) continue;
    const li = parsed.lines.findIndex((l) => l.syls.includes(syl));
    if (li < 0) continue;
    if (!byLine.has(li)) byLine.set(li, new Map());
    byLine.get(li).set(syl, e);
  }
  const mel = { ...(song.melody && !Array.isArray(song.melody) ? song.melody : {}) };
  let n = 0;
  for (const [li, m] of byLine) {
    const l = parsed.lines[li];
    if (m.size !== l.syls.length) continue;
    const evl = l.syls.map((s) => m.get(s));
    const start = Math.floor(Math.min(...evl.map((e) => e.b)) / 4) * 4;
    const notes = evl.map((e, i) => ({ i, b: e.b - start, d: e.d, m: snapRec(e.midi) }));
    const bars = Math.max(1, Math.ceil(Math.max(...notes.map((x) => x.b + x.d)) / 4));
    mel[ids[li]] = { bars, notes };
    n++;
  }
  if (n) { song.melody = mel; commit({ keepWins: true }); }
  return n;
}
function snapRec(m) {
  const lead = song.heads.find((h) => h.role === 'lead');
  let x = m;
  if (lead) { const c = (lead.lo + lead.hi) / 2 + (lead.shift || 0); while (x - 60 > 7) x -= 12; while (x - 60 < -10) x += 12; void c; }
  return x;
}

const app = {
  get song() { return song; },
  t, player, sys, stage, ensureAudio, toast, commit,
  playing: () => player.playing && current && current.mode === 'song',
  toggleSong, stopAll,
  mode: () => (MOODS[song.mood] || MOODS.happy).mode,
  spb: () => 60 / bpm(),
  blurInput: () => input.blur(),
  headColor: (id) => (song.heads.find((h) => h.id === id) || song.heads.find((h) => h.role === 'lead') || song.heads[0]).color,
  songBeat: () => (current && current.mode === 'song' && player.playing ? player.time() / current.arr.spb : null),
  setLiveParsed: (p) => { liveParsed = p; },
  async arrangement() {
    if (!song.lines.length) return null;
    await prepareLang(song.lang);
    const parsed = parseLyrics(song.lines.map((l) => l.text).join('\n'), song.lang);
    const arr = arrange({ ...song, ...lineOpts(song.lines) }, parsed, song.heads);
    return { parsed, arr, notes: arr.notes };
  },
  async songJob() {
    const a = await app.arrangement();
    if (!a) return null;
    return { heads: song.heads, parts: buildParts(a.arr, song.heads), lang: song.lang, duration: a.arr.duration, arr: a.arr };
  },
  async previewNote(n) {
    await ensureAudio();
    const h = song.heads.find((x) => x.role === 'lead') || song.heads[0];
    let m = n.m;
    const c = (h.lo + h.hi) / 2 + (h.shift || 0);
    while (m < c - 9) m += 12;
    while (m > c + 9) m -= 12;
    player.liveOn(h, n.syl, m, song.lang, null, -1);
    clearTimeout(app._pv);
    app._pv = setTimeout(() => player.liveOff(h, n.syl, song.lang), 380);
  },
  async playSyllables() {
    await prepareLang(song.lang);
    const text = song.lines.length ? song.lines.map((l) => l.text).join('\n') : input.value.trim() || lastSung || 'la la la la';
    const parsed = parseLyrics(text, song.lang);
    return { parsed, syls: parsed.syls };
  },
  startBacking() {
    const back = song.heads.filter((h) => h.role === 'choir' || h.role === 'bass' || h.role === 'beatbox');
    if (!back.length || !song.lines.length) return null;
    const parsed = parseLyrics(song.lines.map((l) => l.text).join('\n'), song.lang);
    const arr = arrange({ ...song, ...lineOpts(song.lines) }, parsed, song.heads);
    const parts = buildParts(arr, back);
    const out = { t0Perf: null };
    out.ready = startPlay(arr, parts, back).then((ok) => { if (ok) out.t0Perf = performance.now() + (player.t0 - sys.ctx.currentTime) * 1000; return ok; });
    return out;
  },
  saveRecording, recordVideo,
  newHead: (role, idx, inst) => newHead(role, idx, inst),
  replaceSong(s) {
    player.stop(true);
    current = null;
    song = s;
    expanded = song.heads[0] ? song.heads[0].id : null;
    kara.innerHTML = '';
    commit();
    document.body.style.setProperty('--head', (song.heads.find((h) => h.role === 'lead') || song.heads[0]).color);
  },
  ensureRoles(s, want) {
    const add = (role) => { if (s.heads.length < 6) s.heads.push(newHead(role, s.heads.length)); };
    if (!s.heads.some((h) => h.role === 'lead')) add('lead');
    if (want.bass && !s.heads.some((h) => h.role === 'bass')) add('bass');
    if (want.drums) while (s.heads.filter((h) => h.role === 'beatbox').length < 2 && s.heads.length < 6) add('beatbox');
  },
  playFromStart() { if (song.lines.length) playSong(); },
  phraseMel(p) { const mode = (MOODS[song.mood] || MOODS.happy).mode; return p.n ? phraseMelody(p, (st) => stepToMidi(st, song.key, mode)) : null; },
  previewPhrase(p) { return singLine((p.spoken ? '> ' : '') + p[song.lang], app.phraseMel(p)); },
  async addPhrase(p, quiet) {
    await prepareLang(song.lang);
    const text = p[song.lang];
    song.lines.push(p.spoken ? { text, singers: [], spoken: true } : { text, singers: [] });
    const mel = app.phraseMel(p);
    if (mel) {
      const parsed = parseLyrics(song.lines.map((l) => l.text).join('\n'), song.lang);
      const last = parsed.lines[parsed.lines.length - 1];
      if (last && last.syls.length === mel.notes.length) song.melody = { ...(song.melody && !Array.isArray(song.melody) ? song.melody : {}), [lineIds(parsed)[parsed.lines.length - 1]]: mel };
    }
    if (!quiet) { commit(); toast(t().saved(song.lines.length)); }
  },
  setBeat(b) {
    if (b.text) song.beat = { id: b.id, text: b.text, swing: b.swing || 0 }; else delete song.beat;
    if (b.text && !song.heads.some((h) => h.role === 'beatbox') && song.heads.length < 6) song.heads.push(newHead('beatbox', song.heads.length));
    commit();
  },
  setBass(id) {
    if (id) song.bassPat = id; else delete song.bassPat;
    if (id && !song.heads.some((h) => h.role === 'bass') && song.heads.length < 6) song.heads.push(newHead('bass', song.heads.length));
    commit();
  },
  async applyStarter(st) {
    player.stop(true);
    current = null;
    const heads = st.heads.map(([role, preset, look, extra], i) => {
      const h = newHead(role, i, extra && extra.inst);
      if (role !== 'inst') { const p = PRESETS[preset]; Object.assign(h, { preset, lo: p.lo, hi: p.hi, tract: p.tract, rd: p.rd, breath: p.breath, vib: p.vib, rough: p.rough, fem: { alto: 1, soprano: 1 }[preset] || 0, kid: preset === 'child' ? 1 : 0 }); }
      h.look = look;
      Object.assign(h, LOOKS[look].voice || {}, extra || {});
      return h;
    });
    const beat = BEATS.find((b) => b.id === st.beat);
    song = { v: 1, lang: song.lang, mood: st.mood, key: song.key || 0, bpm: st.bpm, seed: 7, lines: [], heads, melody: {} };
    if (beat && beat.text) song.beat = { id: beat.id, text: beat.text, swing: beat.swing || 0 };
    if (st.bass) song.bassPat = st.bass;
    for (const id of st.lines) { const p = PHRASES.find((x) => x.id === id); if (p) await app.addPhrase(p, true); }
    expanded = song.heads[0].id;
    kara.innerHTML = '';
    commit();
    document.body.style.setProperty('--head', song.heads[0].color);
    toast(st.name[song.lang]);
    setTimeout(() => playSong(), 200);
  },
  fileName: (ext) => 'wire-choir-' + ((song.lines[0] && song.lines[0].text) || 'piosenka').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/ł/g, 'l').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) + '.' + ext,
};

if (location.hash.startsWith('#s=')) {
  decodeSong(location.hash.slice(3)).then((s) => {
    song = s;
    expanded = song.heads[0] ? song.heads[0].id : null;
    history.replaceState(null, '', location.pathname);
    commit();
    toast(t().loadedLink, 3000);
  }).catch(() => {});
}
if (window.visualViewport) {
  const vv = window.visualViewport, root = document.documentElement;
  const onVV = () => {
    const kb = Math.max(0, Math.round(window.innerHeight - vv.height - vv.offsetTop));
    root.style.setProperty('--kb', kb + 'px');
    root.style.setProperty('--vvh', Math.round(vv.height) + 'px');
    root.classList.toggle('kb-open', kb > 80);
    if (kb > 80 && (window.scrollY || vv.offsetTop)) window.scrollTo(0, 0);
    autosize();
  };
  vv.addEventListener('resize', onVV);
  vv.addEventListener('scroll', onVV);
}
window.__wc = { sys, player, stage, app, pool };
loop();
