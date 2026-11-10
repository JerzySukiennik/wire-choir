// Headless checks: every ready phrase has as many syllables as notes in both languages; then one scenario from argv (starter id, or "speak", or "none").
import { createRequire } from 'node:module';
const require = createRequire('/Users/jurek/Downloads/Claude/Projects/CivicForge/node_modules/');
const { chromium } = require('playwright-core');
const scenario = process.argv[2] || 'none';
const browser = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true, args: ['--use-angle=metal', '--autoplay-policy=no-user-gesture-required'] });
const page = await browser.newPage({ viewport: { width: 1000, height: 700 }, locale: 'pl-PL' });
const errs = [];
page.on('console', (m) => { if (m.type() === 'error' && !/404/.test(m.text())) errs.push(m.text().slice(0, 300)); });
page.on('pageerror', (e) => errs.push('pageerror ' + e.message));
await page.addInitScript(() => { if (!sessionStorage.getItem('i')) { localStorage.clear(); sessionStorage.setItem('i', '1'); } });
await page.goto('http://localhost:8820/');
await page.waitForTimeout(1500);
const bad = await page.evaluate(async () => {
  const { PHRASES, phraseSyllables } = await import('/js/presets.js');
  const { parseLyrics, prepareLang } = await import('/js/lyrics.js');
  await prepareLang('en');
  const out = [];
  for (const p of PHRASES) for (const lang of ['pl', 'en']) {
    const n = parseLyrics(p[lang], lang).syls.length;
    if (p.n && n !== phraseSyllables(p)) out.push(`${p.id} ${lang}: ${n} syllables, ${phraseSyllables(p)} notes: ${parseLyrics(p[lang], lang).syls.map((s) => s.text).join('|')}`);
    if (!n) out.push(`${p.id} ${lang}: no syllables`);
  }
  return out;
});
console.log('phrase mismatches:', bad.length ? '\n' + bad.join('\n') : 'none');
if (scenario !== 'none') {
  await page.click('#input');
  const t0 = Date.now();
  if (scenario === 'speak') { await page.keyboard.type('> dobry wieczór wszystkim', { delay: 5 }); await page.keyboard.press('Enter'); }
  else {
    await page.click('#rail [data-open="presets"]');
    await page.waitForTimeout(300);
    await page.screenshot({ path: 'Niepotrzebne/out/presets.png' });
    await page.evaluate(async (id) => { const { STARTERS } = await import('/js/presets.js'); await window.__wc.app.applyStarter(STARTERS.find((s) => s.id === id)); }, scenario);
  }
  let started = null, maxLvl = {}, st = null, units = 0;
  for (let i = 0; i < 900; i++) {
    await page.waitForTimeout(100);
    st = await page.evaluate(() => { const p = window.__wc.player; const o = {}; for (const [id, v] of p.voices) { v.sample(); o[id] = v.level; } return { playing: p.playing, loading: p.loading, lv: o, t: p.time(), dur: p.dur, speed: window.__wc.pool.speed }; });
    if (st.loading) units = st.loading.total;
    if (st.playing && started === null) started = Date.now() - t0;
    if (st.playing) for (const k in st.lv) maxLvl[k] = Math.max(maxLvl[k] || 0, st.lv[k]);
    if (started !== null && (st.t > Math.min(9, st.dur) || !st.playing)) break;
  }
  await page.screenshot({ path: `Niepotrzebne/out/sc-${scenario}.png` });
  const info = await page.evaluate(() => ({ heads: window.__wc.app.song.heads.map((h) => h.role + (h.inst ? ':' + h.inst : '')), lines: window.__wc.app.song.lines.length, mel: Object.keys(window.__wc.app.song.melody || {}).length, status: document.querySelector('#status').textContent }));
  await page.evaluate(() => window.__wc.app.stopAll());
  console.log(JSON.stringify({ scenario, startedAfterMs: started, units, speed: +(st.speed || 0).toFixed(2), levels: Object.values(maxLvl).map((v) => +v.toFixed(3)), ...info, errs }));
}
await browser.close();
