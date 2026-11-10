// Measures real AudioWorklet render cost of the voice engine in headless Chrome (OfflineAudioContext).
import { createRequire } from 'node:module';
const require = createRequire('/Users/jurek/Downloads/Claude/Projects/CivicForge/node_modules/');
const { chromium } = require('playwright-core');
const browser = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true, args: ['--autoplay-policy=no-user-gesture-required'] });
const page = await browser.newPage({ viewport: { width: 400, height: 300 } });
await page.goto('http://localhost:8817/lab.html');
const res = await page.evaluate(async () => {
  const base = new URL('/js/voice/', location.href);
  const [eng, wk] = await Promise.all([fetch(base + 'engine.js').then((r) => r.text()), fetch(base + 'worklet.js').then((r) => r.text())]);
  const strip = (s) => s.replace(/^import .*$/gm, '').replace(/^export \{[^}]*\};?$/gm, '').replace(/^export (const|let|function|class) /gm, '$1 ');
  const url = URL.createObjectURL(new Blob([strip(eng) + '\n' + strip(wk)], { type: 'text/javascript' }));
  const { vowelParams } = await import('/js/voice/phonemes.js');
  async function bench(steps, secs) {
    const oc = new OfflineAudioContext(1, 48000 * secs, 48000);
    await oc.audioWorklet.addModule(url);
    for (const st of steps) {
      const n = new AudioWorkletNode(oc, 'wire-voice', { numberOfInputs: 0, numberOfOutputs: 1, outputChannelCount: [1], processorOptions: { steps: st, seed: 3 } });
      n.connect(oc.destination);
      n.port.postMessage({ t: 'segs', mode: 'abs', segs: [{ at: 0.01, len: secs, p: Array.from(vowelParams('a', 0.8)), f0: 150, burst: 0, burstX: 0, w: -1 }] });
    }
    await new Promise((r) => setTimeout(r, 50));
    const t0 = performance.now();
    await oc.startRendering();
    return +((performance.now() - t0) / 1000 / secs).toFixed(3);
  }
  return { one2x: await bench([2], 3), one1x: await bench([1], 3), mix5: await bench([2, 2, 1, 1, 1], 3), six2x: await bench([2, 2, 2, 2, 2, 2], 3) };
});
console.log(JSON.stringify(res));
await browser.close();
