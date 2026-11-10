// Wire Choir render worker: owns one CHIMERA wasm instance and renders one unit per message.
import { Chimera } from './core.js';
import { renderUnit } from './render.js';

let core = null;
self.onmessage = (e) => {
  const m = e.data;
  if (m.t === 'init') {
    try {
      core = new Chimera(new WebAssembly.Module(m.bytes));
      self.postMessage({ t: 'ready' });
    } catch (err) { self.postMessage({ t: 'fail', message: String(err && err.message || err) }); }
    return;
  }
  if (m.t === 'render') {
    try {
      const t0 = performance.now();
      const u = renderUnit(core, m.spec);
      self.postMessage({ t: 'done', id: m.id, pcm: u.pcm, tele: u.tele, hop: u.hop, fs: u.fs, lead: u.lead, dur: u.dur, ms: performance.now() - t0 }, [u.pcm.buffer, u.tele.buffer]);
    } catch (err) { self.postMessage({ t: 'error', id: m.id, message: String(err && err.message || err) }); }
  }
};
