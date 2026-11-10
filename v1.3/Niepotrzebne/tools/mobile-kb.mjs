// WebKit iPhone XR: words stay on screen while singing, and the layout with a simulated on-screen keyboard.
import { createRequire } from 'node:module';
const [outDir] = process.argv.slice(2);
const require = createRequire('/Users/jurek/Downloads/Claude/Projects/Flop/node_modules/');
const pw = require('playwright-core');
const browser = await pw.webkit.launch({ headless: true });
const ctx = await browser.newContext({ ...pw.devices['iPhone XR'] });
const page = await ctx.newPage();
const errs = [];
page.on('pageerror', (e) => errs.push(e.message));
await page.goto('http://localhost:8817/');
await page.waitForTimeout(3000);
await page.tap('#input');
await page.keyboard.type('Mam w głowie drut i światło');
await page.keyboard.press('Enter');
await page.waitForTimeout(1900);
await page.screenshot({ path: outDir + '/kb-1.png' });
await page.evaluate(() => {
  const r = document.documentElement;
  r.style.setProperty('--kb', '336px'); r.style.setProperty('--vvh', '560px'); r.classList.add('kb-open');
  const i = document.getElementById('input'); i.value = 'lecę z ust prosto do ciebie'; i.dispatchEvent(new Event('input'));
});
await page.waitForTimeout(700);
await page.screenshot({ path: outDir + '/kb-2.png' });
const box = await page.evaluate(() => { const r = document.getElementById('input').getBoundingClientRect(); const s = document.getElementById('stage').getBoundingClientRect(); return { inputBottom: Math.round(r.bottom), keyboardTop: 896 - 336, stageH: Math.round(s.height) }; });
console.log(JSON.stringify({ box, errs }));
await browser.close();
