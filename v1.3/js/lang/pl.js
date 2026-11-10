// Wire Choir Polish grapheme-to-phoneme: digraphs, softening, nasal vowels, voicing assimilation, penultimate stress.
import { syllabify, attachText } from './common.js';

const VOW_L = 'aąeęioóuy';
const SINGLE = {
  a: 'a', ą: 'o~', b: 'b', c: 'ts', ć: "ts'", d: 'd', e: 'e', ę: 'e~', f: 'f', g: 'g', h: 'x', i: 'i', j: 'j', k: 'k', l: 'l',
  ł: 'w', m: 'm', n: 'n', ń: "n'", o: 'o', ó: 'u', p: 'p', r: 'r', s: 's', ś: "s'", t: 't', u: 'u', w: 'v', y: 'y', z: 'z',
  ź: "z'", ż: 'Z', q: 'k', v: 'v', x: 'ks',
};
const SOFT = { s: "s'", c: "ts'", z: "z'", n: "n'", dz: "dz'" };
const PAIR = { b: 'p', d: 't', g: 'k', v: 'f', z: 's', Z: 'S', "z'": "s'", dz: 'ts', dZ: 'tS', "dz'": "ts'" };
const UNPAIR = Object.fromEntries(Object.entries(PAIR).map(([a, b]) => [b, a]));
const OBSTR = new Set(['p', 'b', 't', 'd', 'k', 'g', 'f', 'v', 's', 'z', 'S', 'Z', "s'", "z'", 'x', 'ts', 'dz', 'tS', 'dZ', "ts'", "dz'"]);
const VOICED = new Set(Object.keys(PAIR));
const WEAK = new Set(['i', 'w', 'z', 'na', 'do', 'się', 'to', 'a', 'o', 'że', 'by', 'ze', 'we', 'od', 'po', 'za', 'u', 'ten', 'ta', 'mi', 'ci', 'go', 'mu', 'je', 'się,', 'jak', 'bo']);

function letters(word) {
  const w = word.toLowerCase();
  const out = [];
  let i = 0;
  const isV = (c) => c !== undefined && VOW_L.includes(c);
  while (i < w.length) {
    const c = w[i], n = w[i + 1], n2 = w[i + 2];
    if (c === 'd' && n === 'z' && n2 === 'i') {
      if (isV(w[i + 3])) { out.push({ s: "dz'", a: i, b: i + 3 }); i += 3; }
      else { out.push({ s: "dz'", a: i, b: i + 2 }); i += 2; }
      continue;
    }
    if (c === 'd' && (n === 'ż' || n === 'ź' || n === 'z')) { out.push({ s: n === 'ż' ? 'dZ' : n === 'ź' ? "dz'" : 'dz', a: i, b: i + 2 }); i += 2; continue; }
    if (c === 'c' && n === 'h') { out.push({ s: 'x', a: i, b: i + 2 }); i += 2; continue; }
    if (c === 'c' && n === 'z') { out.push({ s: 'tS', a: i, b: i + 2 }); i += 2; continue; }
    if (c === 's' && n === 'z') { out.push({ s: 'S', a: i, b: i + 2 }); i += 2; continue; }
    if (c === 'r' && n === 'z') { out.push({ s: 'Z', a: i, b: i + 2 }); i += 2; continue; }
    if (SOFT[c] && n === 'i') {
      if (isV(n2)) { out.push({ s: SOFT[c], a: i, b: i + 2 }); i += 2; }
      else { out.push({ s: SOFT[c], a: i, b: i + 1 }); i += 1; }
      continue;
    }
    if (c === 'i' && i > 0 && !isV(w[i - 1]) && isV(n) && out.length) {
      out.push({ s: 'j', a: i, b: i + 1 }); i += 1; continue;
    }
    const p = SINGLE[c];
    if (p === 'ks') { out.push({ s: 'k', a: i, b: i + 1 }, { s: 's', a: i, b: i + 1 }); i++; continue; }
    if (p) out.push({ s: p, a: i, b: i + 1 });
    i++;
  }
  return out;
}

function nasals(ph) {
  const out = [];
  for (let i = 0; i < ph.length; i++) {
    const p = ph[i];
    if (p.s === 'o~' || p.s === 'e~') {
      const nx = ph[i + 1] ? ph[i + 1].s : null;
      const oral = p.s === 'o~' ? 'o' : 'e';
      if (nx === null) { out.push(p.s === 'e~' ? { ...p, s: 'e' } : p); continue; }
      if (['p', 'b'].includes(nx)) { out.push({ ...p, s: oral }, { ...p, s: 'm' }); continue; }
      if (['t', 'd', 'ts', 'dz', 'tS', 'dZ'].includes(nx)) { out.push({ ...p, s: oral }, { ...p, s: 'n' }); continue; }
      if (["ts'", "dz'"].includes(nx)) { out.push({ ...p, s: oral }, { ...p, s: "n'" }); continue; }
      if (['k', 'g'].includes(nx)) { out.push({ ...p, s: oral }, { ...p, s: 'N' }); continue; }
      if (['l', 'w'].includes(nx)) { out.push({ ...p, s: oral }); continue; }
    }
    out.push(p);
  }
  return out;
}

function voicing(ph) {
  const n = ph.length;
  const ob = ph.map((p) => OBSTR.has(p.s));
  let i = 0;
  while (i < n) {
    if (!ob[i]) { i++; continue; }
    let j = i;
    while (j + 1 < n && ob[j + 1]) j++;
    const final = j === n - 1;
    for (let k = j; k >= i; k--) {
      let target;
      if (final) target = false;
      else if (k === j) target = VOICED.has(ph[k].s);
      else {
        let m = k + 1;
        while (m <= j && (ph[m].s === 'v' || ph[m].s === 'Z' || ph[m].s === 'f' || ph[m].s === 'S') && (ph[m].orig === 'v' || ph[m].orig === 'Z')) m++;
        target = m <= j ? VOICED.has(ph[m].s) : VOICED.has(ph[k].s);
      }
      const cur = ph[k].s;
      ph[k].orig = ph[k].orig || cur;
      if (target && UNPAIR[cur] && cur !== 'x') ph[k] = { ...ph[k], s: UNPAIR[cur] };
      if (!target && PAIR[cur]) ph[k] = { ...ph[k], s: PAIR[cur] };
    }
    for (let k = i + 1; k <= j; k++) {
      const o = ph[k].orig;
      if ((o === 'v' || o === 'Z') && !VOICED.has(ph[k - 1].s) && PAIR[ph[k].s]) ph[k] = { ...ph[k], s: PAIR[ph[k].s] };
    }
    i = j + 1;
  }
  return ph;
}

export function plWord(word) {
  let ph = letters(word);
  for (const p of ph) p.orig = p.s;
  ph = nasals(ph);
  ph = voicing(ph);
  const lw = word.toLowerCase();
  const syls = syllabify(ph, (k, n) => (n === 1 ? (WEAK.has(lw) ? 0 : 1) : k === n - 2 ? 1 : 0));
  return attachText(word, ph, syls);
}

export function plHasVowel(word) {
  for (const c of word.toLowerCase()) if (VOW_L.includes(c)) return true;
  return false;
}

const DIGITS = ['zero', 'jeden', 'dwa', 'trzy', 'cztery', 'pięć', 'sześć', 'siedem', 'osiem', 'dziewięć'];
export function plDigits(s) { return s.split('').map((d) => DIGITS[+d] || '').join(' '); }
