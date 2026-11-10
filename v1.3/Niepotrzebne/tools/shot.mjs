// Headless Chrome (Metal GPU) screenshot of the app with a preset song state; usage: node shot.mjs out.png [heads.json] [sing text] [delayMs] [w] [h]
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
const require = createRequire('/Users/jurek/Downloads/Claude/Projects/CivicForge/node_modules/');
const { chromium } = require('playwright-core');
const [out, headsFile, text = 'Mam w głowie drut i światło', delay = '1600', W = '1280', H = '800'] = process.argv.slice(2);
const browser = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true, args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required'] });
const page = await browser.newPage({ viewport: { width: +W, height: +H }, deviceScaleFactor: 1 });
page.on('console', (m) => { if (m.type() === 'error') console.log('console error:', m.text()); });
page.on('pageerror', (e) => console.log('page error:', e.message));
if (headsFile) {
  const song = JSON.parse(readFileSync(headsFile, 'utf8'));
  await page.addInitScript((s) => { try { localStorage.setItem('wc.song', JSON.stringify(s)); } catch (e) {} }, song);
}
await page.goto('http://localhost:8817/');
await page.waitForTimeout(2500);
if (text) {
  await page.click('#input');
  await page.keyboard.type(text);
  await page.keyboard.press('Enter');
}
await page.waitForTimeout(+delay);
await page.screenshot({ path: out });
await browser.close();
