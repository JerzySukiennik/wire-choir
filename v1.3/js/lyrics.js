// Wire Choir lyrics parser: lines -> words -> sung syllables (phonemes, display text, stress) for PL and EN.
import { plWord, plHasVowel, plDigits } from './lang/pl.js';
import { enWord, enHasVowel, enDigits, enLoad } from './lang/en.js';

export function hashStr(s) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}

export async function prepareLang(lang) { if (lang === 'en') await enLoad(); }

const WORD_RE = /[\p{L}\p{N}'’]+/gu;

export function parseLyrics(text, lang) {
  const G = lang === 'en' ? enWord : plWord;
  const hasV = lang === 'en' ? enHasVowel : plHasVowel;
  const digits = lang === 'en' ? enDigits : plDigits;
  const lines = [];
  let wordId = 0, sylId = 0;
  for (const raw of text.split('\n')) {
    const line = raw.trim();
    if (!line) continue;
    const toks = [];
    for (const m of line.matchAll(WORD_RE)) {
      let t = m[0];
      if (/^\d+$/.test(t)) for (const d of digits(t).split(' ')) toks.push(d);
      else toks.push(t);
    }
    const words = [];
    let carry = '';
    for (let i = 0; i < toks.length; i++) {
      const t = toks[i];
      if (!hasV(t)) {
        if (i < toks.length - 1) { carry += t + ' '; continue; }
        if (words.length) {
          const last = words[words.length - 1];
          const gl = G(last.raw + t);
          if (gl.length) { last.syls = gl; last.text += ' ' + t; last.raw += t; }
        }
        continue;
      }
      const raw2 = carry.replace(/ /g, '') + t;
      const syls = G(raw2);
      if (!syls.length) { carry = ''; continue; }
      if (carry) {
        const k = carry.replace(/ /g, '').length;
        syls[0].text = carry + syls[0].text.slice(k);
      }
      words.push({ text: carry + t, raw: raw2, syls });
      carry = '';
    }
    if (!words.length) continue;
    for (const w of words) {
      w.id = wordId++;
      for (const s of w.syls) { s.id = sylId++; s.word = w.id; }
    }
    lines.push({ text: line, words, key: hashStr(line.toLowerCase()), syls: words.flatMap((w) => w.syls) });
  }
  return { lang, lines, words: lines.flatMap((l) => l.words), syls: lines.flatMap((l) => l.syls) };
}
