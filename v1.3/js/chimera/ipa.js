// Wire Choir phonemes to IPA for the CHIMERA engine: syllables (onset, nucleus, coda) for singing and segments for speech.
const V_EN = { i: 'i', I: 'ɪ', e: 'ɛ', ae: 'æ', a: 'a', A: 'ɑ', V: 'ʌ', o: 'o', O: 'ɔ', U: 'ʊ', u: 'u', '@': 'ə', '3': 'ɝ', y: 'ɨ', M: 'm', 'o~': 'ɔ', 'e~': 'ɛ' };
const V_PL = { i: 'i', I: 'ɪ', e: 'ɛ', ae: 'æ', a: 'a', A: 'ɑ', V: 'ʌ', o: 'ɔ', O: 'ɔ', U: 'ʊ', u: 'u', '@': 'ə', '3': 'ɝ', y: 'ɨ', M: 'm', 'o~': 'ɔ', 'e~': 'ɛ' };
const DIPH = { 'a|I': 'aɪ', 'a|U': 'aʊ', 'O|I': 'ɔɪ', 'e|I': 'eɪ', 'o|U': 'oʊ' };
const GLIDE = { I: 'j', i: 'j', U: 'w', u: 'w', y: 'j' };
const C_EN = {
  p: ['p'], b: ['b'], t: ['t'], d: ['d'], k: ['k'], g: ['g'], f: ['f'], v: ['v'], T: ['θ'], D: ['ð'], s: ['s'], z: ['z'], S: ['ʃ'], Z: ['ʒ'],
  "s'": ['ʃ'], "z'": ['ʒ'], x: ['x'], h: ['h'], ts: ['ts'], dz: ['dz'], tS: ['tʃ'], dZ: ['dʒ'], "ts'": ['tʃ'], "dz'": ['dʒ'],
  m: ['m'], n: ['n'], "n'": ['ɲ'], N: ['ŋ'], l: ['l'], R: ['ɹ'], w: ['w'], j: ['j'], r: ['ɾ'],
};
const C_PL = {
  ...C_EN, S: ['ʂ'], Z: ['ʐ'], "s'": ['ʃ'], "z'": ['ʒ'], tS: ['t', 'ʂ'], dZ: ['d', 'ʐ'], "ts'": ['tʃ'], "dz'": ['dʒ'], r: ['r'], R: ['r'], h: ['x'],
};

function cons(list, lang) {
  const map = lang === 'pl' ? C_PL : C_EN;
  const out = [];
  for (const s of list || []) for (const ipa of map[s] || []) out.push({ ipa });
  return out;
}

export function toSyllable(syl, lang, wordEnd = false, phraseEnd = false) {
  const V = lang === 'pl' ? V_PL : V_EN;
  const nu = syl.nu && syl.nu.length ? syl.nu : ['@'];
  const onset = cons(syl.on, lang), coda = cons(syl.co, lang);
  let nucleus = V[nu[0]] || 'ə';
  if (nu.length > 1) {
    const d = DIPH[nu[0] + '|' + nu[1]];
    if (d) nucleus = d;
    else if (GLIDE[nu[1]]) coda.unshift({ ipa: GLIDE[nu[1]] });
  }
  if (nu[0] === 'o~' || nu[0] === 'e~') coda.unshift({ ipa: 'w' });
  if (nucleus === 'm') return { text: syl.text || '', onset: [], nucleus: { ipa: 'ə' }, coda: [], hum: true, wordEnd, phraseEnd };
  return { text: syl.text || '', onset, nucleus: { ipa: nucleus }, coda, wordEnd, phraseEnd };
}

export function toSegments(syls, lang) {
  const out = [];
  syls.forEach((s, i) => {
    const e = toSyllable(s, lang);
    const last = i === syls.length - 1 || syls[i + 1].word !== s.word;
    for (const c of e.onset) out.push({ ipa: c.ipa });
    out.push({ ipa: e.nucleus.ipa, stress: s.stress >= 1 ? 1 : s.stress > 0 ? 2 : 0 });
    e.coda.forEach((c, k) => out.push({ ipa: c.ipa, wordEnd: last && k === e.coda.length - 1 ? true : undefined }));
    if (last && !e.coda.length) out[out.length - 1].wordEnd = true;
  });
  return out;
}
