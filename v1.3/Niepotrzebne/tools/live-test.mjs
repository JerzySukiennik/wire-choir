// Smoke test of the live site: sing a line on desktop Chromium and iPhone XR WebKit (waits for the heads to render), check assets and the v1 snapshot.
import { createRequire } from 'node:module';
const URL_ = process.argv[2] || 'https://choir.gzowo.fun/';
const require = createRequire('/Users/jurek/Downloads/Claude/Projects/Flop/node_modules/');
const pw = require('playwright-core');
async function run(name, launch, ctxOpts) {
  const browser = await launch();
  const ctx = await browser.newContext(ctxOpts);
  const page = await ctx.newPage();
  const errs = [];
  page.on('console', (m) => { if (m.type() === 'error' && !/favicon|404/.test(m.text())) errs.push(m.text().slice(0, 160)); });
  page.on('pageerror', (e) => errs.push('pageerror ' + e.message.slice(0, 160)));
  await page.goto(URL_);
  await page.waitForTimeout(3500);
  if (ctxOpts.hasTouch) await page.tap('#input'); else await page.click('#input');
  await page.keyboard.type('Mam w głowie drut i światło');
  await page.keyboard.press('Enter');
  const t0 = Date.now();
  let lvl = 0, startMs = null;
  for (let i = 0; i < 600; i++) {
    await page.waitForTimeout(100);
    const st = await page.evaluate(() => { const p = window.__wc.player; let m = 0; for (const v of p.voices.values()) { v.sample(); m = Math.max(m, v.level); } return { playing: p.playing, m }; });
    if (st.playing && startMs === null) startMs = Date.now() - t0;
    lvl = Math.max(lvl, st.m);
    if (startMs !== null && (lvl > 0.03 || Date.now() - t0 - startMs > 4000)) break;
  }
  const r = await page.evaluate(async () => {
    const w = window.__wc;
    const { avatarAvailable } = await import('./js/stage/avatar.js');
    const dict = await fetch('./data/en-dict.txt', { method: 'HEAD' }).then((x) => x.status);
    const v1 = await fetch('./v1/index.html', { method: 'HEAD' }).then((x) => x.status);
    return { ctx: w.sys.ctx && w.sys.ctx.state, kara: document.body.classList.contains('kara-on'), avatar: await avatarAvailable(), dict, v1 };
  });
  console.log(name, JSON.stringify({ startMs, lvl: +lvl.toFixed(3), ...r, errs }));
  await browser.close();
}
await run('desktop-chromium', () => pw.chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true, args: ['--use-angle=metal', '--autoplay-policy=no-user-gesture-required'] }), { viewport: { width: 1280, height: 800 } });
await run('iphone-webkit', () => pw.webkit.launch({ headless: true }), { ...pw.devices['iPhone XR'] });
