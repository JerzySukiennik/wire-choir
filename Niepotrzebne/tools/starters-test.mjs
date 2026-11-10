// Headless check without rendering: every starter set builds a valid song (lines, hand-made melodies, heads) and its render units, and survives a song link round trip.
import { createRequire } from 'node:module';
const require = createRequire('/Users/jurek/Downloads/Claude/Projects/CivicForge/node_modules/');
const { chromium } = require('playwright-core');
const port = process.env.PORT || 8820;
const browser = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true, args: ['--autoplay-policy=no-user-gesture-required'] });
for (const lang of ['pl', 'en']) {
  const page = await browser.newPage({ viewport: { width: 900, height: 600 }, locale: lang === 'pl' ? 'pl-PL' : 'en-US' });
  const errs = [];
  page.on('console', (m) => { if (m.type() === 'error' && !/404/.test(m.text())) errs.push(m.text().slice(0, 200)); });
  page.on('pageerror', (e) => errs.push('pageerror ' + e.message));
  await page.addInitScript(() => { localStorage.clear(); });
  await page.goto(`http://localhost:${port}/`);
  await page.waitForTimeout(1200);
  await page.click('#input');
  const out = await page.evaluate(async () => {
    const { STARTERS } = await import('/js/presets.js');
    const { encodeSong, decodeSong } = await import('/js/share.js');
    const w = window.__wc, res = [];
    await w.app.ensureAudio();
    for (const st of STARTERS) {
      await w.app.applyStarter(st);
      w.app.stopAll();
      const job = await w.app.songJob();
      const units = w.player.units(job.arr, job.parts, job.lang, job.heads);
      const kinds = {};
      for (const u of units) kinds[u.spec.kind] = (kinds[u.spec.kind] || 0) + 1;
      const s = w.app.song;
      const back = await decodeSong(await encodeSong(s));
      res.push({ id: st.id, lines: s.lines.length, melodies: Object.keys(s.melody).length, heads: s.heads.length, bars: job.arr.chords.length, units: units.length, unique: new Set(units.map((u) => w.pool.key(u.spec))).size, kinds, link: !!back.heads.length && (back.beat ? back.beat.text === s.beat.text : !s.beat) && back.bassPat === s.bassPat });
    }
    await new Promise((r) => setTimeout(r, 400));
    w.app.stopAll();
    return res;
  });
  console.log(lang, JSON.stringify(out), JSON.stringify(errs));
  await page.close();
}
await browser.close();
