// Wire Choir shared phonology helpers: sonority, voicing pairs, syllabification with letter-span tracking.

export const VOWEL_SET = new Set(['i', 'I', 'y', 'e', 'ae', 'a', 'A', 'V', 'o', 'O', 'U', 'u', '@', '3', 'o~', 'e~']);
const SON = {
  p: 1, b: 1, t: 1, d: 1, k: 1, g: 1, ts: 1.5, dz: 1.5, tS: 1.5, dZ: 1.5, "ts'": 1.5, "dz'": 1.5,
  f: 2, v: 2, T: 2, D: 2, s: 2, z: 2, S: 2, Z: 2, "s'": 2, "z'": 2, x: 2, h: 2,
  m: 3, n: 3, "n'": 3, N: 3, l: 4, r: 4, R: 4, w: 5, j: 5,
};
const SIBILANT = new Set(['s', 'z', 'S', 'Z', "s'", "z'"]);
const LIQ = new Set(['r', 'l', 'R', 'w', 'j']);

function validOnset(c) {
  if (c[0] === 'N') return false;
  if (c.length <= 1) return true;
  if (c.length > 3) return false;
  for (let i = 1; i < c.length; i++) {
    const a = c[i - 1], b = c[i];
    if (b === 'j' || b === 'w') continue;
    if (i === 1 && (SIBILANT.has(a) || a === 'v' || a === 'f')) continue;
    if ((SON[b] || 0) <= (SON[a] || 0)) return false;
  }
  return true;
}

export function syllabify(ph, stressOf) {
  const nuc = [];
  for (let i = 0; i < ph.length; i++) if (VOWEL_SET.has(ph[i].s)) nuc.push(i);
  if (!nuc.length) return [];
  const groups = [];
  const merged = [];
  for (let k = 0; k < nuc.length; k++) {
    const i = nuc[k];
    if (ph[i].glide && merged.length) { merged[merged.length - 1].push(i); continue; }
    merged.push([i]);
  }
  const bounds = [];
  for (let k = 0; k < merged.length; k++) {
    const first = merged[k][0];
    if (k === 0) { bounds.push(0); continue; }
    const prevLast = merged[k - 1][merged[k - 1].length - 1];
    const cl = [];
    for (let i = prevLast + 1; i < first; i++) cl.push(ph[i].s);
    let split = first;
    for (let take = Math.min(3, cl.length); take >= 0; take--) {
      if (take === 0 || validOnset(cl.slice(cl.length - take))) { split = first - take; break; }
    }
    if (cl.length >= 2 && split === prevLast + 1 && !(cl.length === 2 && LIQ.has(cl[1]))) split = prevLast + 2;
    bounds.push(split);
  }
  bounds.push(ph.length);
  for (let k = 0; k < merged.length; k++) {
    const a = bounds[k], b = bounds[k + 1];
    const nu = merged[k];
    const on = [], co = [], nus = [];
    for (let i = a; i < b; i++) {
      if (i < nu[0]) on.push(ph[i].s);
      else if (i > nu[nu.length - 1]) co.push(ph[i].s);
      else if (VOWEL_SET.has(ph[i].s)) nus.push(ph[i].s);
      else co.push(ph[i].s);
    }
    groups.push({ on, nu: nus, co, a, b, stress: stressOf ? stressOf(k, merged.length, nu[0]) : 0 });
  }
  return groups;
}

export function attachText(word, ph, syls) {
  for (let k = 0; k < syls.length; k++) {
    const s = syls[k];
    const start = k === 0 ? 0 : ph[s.a] ? ph[s.a].a : word.length;
    const end = k === syls.length - 1 ? word.length : ph[syls[k + 1].a] ? ph[syls[k + 1].a].a : word.length;
    s.text = word.slice(start, Math.max(start, end));
  }
  for (let k = 0; k < syls.length; k++) if (!syls[k].text && k > 0) { syls[k].text = '-'; }
  return syls;
}
