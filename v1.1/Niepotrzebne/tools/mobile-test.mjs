// Mobile check (iPhone XR profile) in Chromium and WebKit: layout, typing + Enter sings, touch save button, windows, avatar.
import { createRequire } from 'node:module';
const [engine, outDir, pwDir] = process.argv.slice(2);
const require = createRequire(pwDir + '/');
const pw = require('playwright-core');
const dev = pw.devices['iPhone XR'];
const browser = engine === 'webkit'
  ? await pw.webkit.launch({ headless: true })
  : await pw.chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true, args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required'] });
const ctx = await browser.newContext({ ...dev });
const page = await ctx.newPage();
const errs = [];
page.on('console', (m) => { if (m.type() === 'error' && !/404/.test(m.text())) errs.push(m.text().slice(0, 200)); });
page.on('pageerror', (e) => errs.push('pageerror ' + e.message.slice(0, 200)));
await page.addInitScript(() => { if (!sessionStorage.getItem('s')) { localStorage.clear(); sessionStorage.setItem('s', '1'); } });
await page.goto('http://localhost:8817/');
await page.waitForTimeout(3500);
await page.screenshot({ path: `${outDir}/m-${engine}-1.png` });
await page.tap('#input');
await page.keyboard.type('Mam w głowie drut i światło');
await page.keyboard.press('Enter');
await page.waitForTimeout(1600);
const sing = await page.evaluate(() => {
  const w = window.__wc;
  return { ctx: w && w.sys.ctx ? w.sys.ctx.state : 'none', steps: w ? w.sys.steps : null, lvl: w ? Math.max(0, ...[...w.player.voices.values()].map((v) => v.level)) : 0, kara: document.body.classList.contains('kara-on'), input: document.getElementById('input').value, save: getComputedStyle(document.getElementById('save')).display };
});
await page.screenshot({ path: `${outDir}/m-${engine}-2.png` });
let saved = null;
if (sing.save !== 'none') { await page.tap('#save'); await page.waitForTimeout(300); saved = await page.evaluate(() => window.__wc.app.song.lines.length); }
await page.tap('#rail [data-open="heads"]');
await page.waitForTimeout(600);
await page.screenshot({ path: `${outDir}/m-${engine}-3.png` });
const win = await page.evaluate(() => { const r = document.querySelector('.win').getBoundingClientRect(); return { x: Math.round(r.x), w: Math.round(r.width), h: Math.round(r.height), vw: innerWidth, vh: innerHeight }; });
const avatar = await page.evaluate(async () => { const { avatarAvailable } = await import('/js/stage/avatar.js'); return avatarAvailable(); });
console.log(engine, JSON.stringify({ sing, saved, win, avatar, errs }));
await browser.close();
