// Wire Choir English pronunciation: CMUdict subset (lazy-loaded) with a letter-to-sound fallback.
import { syllabify, VOWEL_SET } from './common.js';

let DICT = null;
let loading = null;

export function enLoad() {
  if (DICT) return Promise.resolve(DICT);
  if (loading) return loading;
  const url = new URL('../../data/en-dict.txt', import.meta.url);
  const src = url.protocol === 'file:' ? import('node:fs').then((fs) => fs.readFileSync(url, 'utf8')) : fetch(url).then((r) => r.text());
  loading = src.then((txt) => {
    const lines = txt.split('\n');
    const syms = lines[0].slice(1).split(' ');
    const dec = {};
    syms.forEach((s, i) => { dec[String.fromCharCode(33 + i)] = s; });
    const m = new Map();
    for (let i = 1; i < lines.length; i++) {
      const t = lines[i].indexOf('\t');
      if (t < 0) continue;
      m.set(lines[i].slice(0, t), lines[i].slice(t + 1));
    }
    DICT = { m, dec };
    return DICT;
  });
  return loading;
}

const ARPA = {
  AA: ['A'], AE: ['ae'], AO: ['O'], AW: ['a', 'U'], AY: ['a', 'I'], EH: ['e'], ER: ['3'], EY: ['e', 'I'], IH: ['I'], IY: ['i'],
  OW: ['o', 'U'], OY: ['O', 'I'], UH: ['U'], UW: ['u'],
  B: 'b', CH: 'tS', D: 'd', DH: 'D', F: 'f', G: 'g', HH: 'h', JH: 'dZ', K: 'k', L: 'l', M: 'm', N: 'n', NG: 'N', P: 'p',
  R: 'R', S: 's', SH: 'S', T: 't', TH: 'T', V: 'v', W: 'w', Y: 'j', Z: 'z', ZH: 'Z',
};

function fromArpa(list) {
  const ph = [];
  const stress = [];
  for (const a of list) {
    const base = a.replace(/\d/, '');
    const st = a.match(/\d/);
    if (st) {
      let v = ARPA[base];
      if (base === 'AH') v = st[0] === '0' ? ['@'] : ['V'];
      if (base === 'ER' && st[0] === '0') v = ['@', 'R'];
      v.forEach((s, i) => {
        if (s === 'R') ph.push({ s: 'R' });
        else ph.push({ s, glide: i > 0 });
      });
      stress.push(st[0] === '1' ? 1 : st[0] === '2' ? 0.5 : 0);
    } else ph.push({ s: ARPA[base] });
  }
  return { ph, stress };
}

const RULES = [
  ['tion', ['S', '@', 'n']], ['sion', ['Z', '@', 'n']], ['ture', ['tS', '3']], ['ough', ['O']], ['augh', ['O']], ['eigh', ['e', 'I*']],
  ['igh', ['a', 'I*']], ['tch', ['tS']], ['dge', ['dZ']], ['ph', ['f']], ['th', ['T']], ['sh', ['S']], ['ch', ['tS']], ['ck', ['k']],
  ['ng', ['N']], ['qu', ['k', 'w']], ['wh', ['w']], ['wr', ['R']], ['kn', ['n']], ['ee', ['i']], ['ea', ['i']], ['oo', ['u']],
  ['ou', ['a', 'U*']], ['ow', ['o', 'U*']], ['ai', ['e', 'I*']], ['ay', ['e', 'I*']], ['oi', ['O', 'I*']], ['oy', ['O', 'I*']],
  ['au', ['O']], ['aw', ['O']], ['ar', ['A', 'R']], ['er', ['3']], ['ir', ['3']], ['ur', ['3']], ['or', ['O', 'R']], ['ie', ['i']],
  ['ue', ['u']], ['ew', ['u']], ['oa', ['o', 'U*']],
];
const LONG = { a: ['e', 'I*'], e: ['i'], i: ['a', 'I*'], o: ['o', 'U*'], u: ['j', 'u'], y: ['a', 'I*'] };
const SHORT = { a: 'ae', e: 'e', i: 'I', o: 'A', u: 'V', y: 'I' };
const CONS = { b: 'b', d: 'd', f: 'f', h: 'h', j: 'dZ', k: 'k', l: 'l', m: 'm', n: 'n', p: 'p', r: 'R', s: 's', t: 't', v: 'v', w: 'w', z: 'z' };

function rulesWord(w) {
  const out = [];
  const isV = (c) => 'aeiouy'.includes(c);
  let i = 0;
  const L = w.length;
  const finalE = L > 2 && w[L - 1] === 'e' && !isV(w[L - 2]);
  while (i < L) {
    let hit = false;
    for (const [g, p] of RULES) {
      if (w.startsWith(g, i)) {
        for (const s of p) out.push({ s: s.replace('*', ''), glide: s.endsWith('*') });
        i += g.length; hit = true; break;
      }
    }
    if (hit) continue;
    const c = w[i];
    if (c === 'e' && i === L - 1 && finalE) { i++; continue; }
    if (isV(c)) {
      if (c === 'y' && i === 0) { out.push({ s: 'j' }); i++; continue; }
      const magic = finalE && i === L - 3 && !isV(w[i + 1]);
      if (c === 'y' && i === L - 1) { out.push(...(L <= 3 ? [{ s: 'a' }, { s: 'I', glide: true }] : [{ s: 'i' }])); i++; continue; }
      if (magic) for (const s of LONG[c]) out.push({ s: s.replace('*', ''), glide: s.endsWith('*') });
      else out.push({ s: SHORT[c] });
      i++; continue;
    }
    if (c === w[i + 1] && c !== 'e') { i++; continue; }
    if (c === 'c') out.push({ s: 'eiy'.includes(w[i + 1]) ? 's' : 'k' });
    else if (c === 'g') out.push({ s: 'eiy'.includes(w[i + 1]) && i > 0 ? 'dZ' : 'g' });
    else if (c === 'x') out.push({ s: 'k' }, { s: 's' });
    else if (c === 's' && i === L - 1 && i > 0 && !'ptkf'.includes(w[i - 1])) out.push({ s: 'z' });
    else if (CONS[c]) out.push({ s: CONS[c] });
    i++;
  }
  return out;
}

function splitOrtho(word, n) {
  if (n <= 1) return [word];
  const isV = (c) => 'aeiouy'.includes(c.toLowerCase());
  const groups = [];
  let i = 0;
  const L = word.length;
  const endE = L > 2 && /e$/i.test(word) && !isV(word[L - 2]);
  while (i < L) {
    if (isV(word[i]) && !(endE && i === L - 1 && groups.length)) {
      let j = i;
      while (j + 1 < L && isV(word[j + 1])) j++;
      groups.push([i, j]);
      i = j + 1;
    } else i++;
  }
  if (groups.length === n) {
    const cuts = [0];
    for (let k = 1; k < n; k++) {
      const a = groups[k - 1][1] + 1, b = groups[k][0];
      const cl = b - a;
      cuts.push(cl <= 1 ? a : a + Math.floor(cl / 2));
    }
    cuts.push(L);
    return cuts.slice(0, -1).map((c, k) => word.slice(c, cuts[k + 1]));
  }
  const out = [];
  for (let k = 0; k < n; k++) out.push(word.slice(Math.round(k * L / n), Math.round((k + 1) * L / n)));
  return out;
}

export function enWord(word) {
  const lw = word.toLowerCase().replace(/[’`]/g, "'");
  let ph, stress = null;
  const code = DICT && (DICT.m.get(lw) || DICT.m.get(lw.replace(/'/g, '')));
  if (code) {
    const r = fromArpa([...code].map((c) => DICT.dec[c]));
    ph = r.ph; stress = r.stress;
  } else if (DICT && lw.endsWith("'s") && DICT.m.get(lw.slice(0, -2))) {
    const r = fromArpa([...DICT.m.get(lw.slice(0, -2))].map((c) => DICT.dec[c]));
    ph = r.ph; stress = r.stress;
    ph.push({ s: 'z' });
  } else {
    ph = rulesWord(lw.replace(/[^a-z]/g, ''));
  }
  const syls = syllabify(ph, (k, n) => (stress ? stress[k] || 0 : n === 1 ? 1 : k === 0 ? 1 : 0));
  const parts = splitOrtho(word, syls.length);
  syls.forEach((s, k) => { s.text = parts[k] || ''; });
  return syls;
}

export function enHasVowel(word) {
  return /[aeiouy]/i.test(word);
}

const DIGITS = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine'];
export function enDigits(s) { return s.split('').map((d) => DIGITS[+d] || '').join(' '); }
export { VOWEL_SET };
