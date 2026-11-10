// Wire Choir render pool: a few workers running the CHIMERA engine, a priority queue, and a unit cache in memory and IndexedDB.
const WASM_URL = new URL('../../assets/chimera/chimera.wasm', import.meta.url);
const WORKER_URL = new URL('./worker.js', import.meta.url);
const DB = 'wc-units', STORE = 'u', DB_KEEP = 320;

function hash(str) {
  let a = 2166136261, b = 5381;
  for (let i = 0; i < str.length; i++) { const c = str.charCodeAt(i); a = Math.imul(a ^ c, 16777619); b = (Math.imul(b, 33) + c) | 0; }
  return (a >>> 0).toString(36) + (b >>> 0).toString(36) + str.length.toString(36);
}

function openDb() {
  return new Promise((res) => {
    try {
      const rq = indexedDB.open(DB, 1);
      rq.onupgradeneeded = () => { const s = rq.result.createObjectStore(STORE, { keyPath: 'k' }); s.createIndex('t', 't'); };
      rq.onsuccess = () => res(rq.result);
      rq.onerror = () => res(null);
      rq.onblocked = () => res(null);
    } catch (e) { res(null); }
  });
}

export class RenderPool {
  constructor() {
    const cores = (typeof navigator !== 'undefined' && navigator.hardwareConcurrency) || 4;
    const mobile = typeof navigator !== 'undefined' && /iPhone|iPad|Android/i.test(navigator.userAgent || '');
    this.size = mobile ? 2 : Math.max(2, Math.min(4, Math.floor(cores / 3)));
    this.memCap = (mobile ? 10 : 28) * 1e6;
    this.workers = [];
    this.queue = [];
    this.cache = new Map();
    this.jobs = new Map();
    this.nextId = 1;
    this.bytes = null;
    this.ready = null;
    this.db = null;
    this.speed = 0;
    this.onChange = null;
    this.failed = null;
  }
  init() {
    if (this.ready) return this.ready;
    this.ready = (async () => {
      const [res, db] = await Promise.all([fetch(WASM_URL), openDb()]);
      if (!res.ok) throw new Error('chimera.wasm ' + res.status);
      this.bytes = await res.arrayBuffer();
      this.db = db;
      this._trimDb();
    })();
    this.ready.catch((e) => { this.failed = e; });
    return this.ready;
  }
  key(spec) { return hash(JSON.stringify(spec)); }
  peek(spec) { const c = this.cache.get(this.key(spec)); return c && c.unit ? c.unit : null; }
  pending() { return this.queue.length + this.workers.filter((w) => w.job).length; }
  request(spec, prio = 0) {
    const k = this.key(spec);
    let c = this.cache.get(k);
    if (c) {
      c.last = performance.now();
      if (!c.unit && prio > c.prio) { c.prio = prio; this._sort(); }
      return c.promise;
    }
    c = { k, prio, last: performance.now(), unit: null };
    c.promise = (async () => {
      await this.init();
      const hit = await this._dbGet(k);
      if (hit) return hit;
      const u = await new Promise((resolve, reject) => {
        this.queue.push({ id: this.nextId++, k, spec, entry: c, resolve, reject });
        this._sort();
        this._pump();
      });
      this._dbPut(k, u);
      return u;
    })().then((u) => { c.unit = u; this._trim(); this._changed(); return u; }, (e) => { this.cache.delete(k); this._changed(); throw e; });
    this.cache.set(k, c);
    this._changed();
    return c.promise;
  }
  drop(maxPrio) {
    const keep = [];
    for (const j of this.queue) {
      if (j.entry.prio <= maxPrio) { this.cache.delete(j.k); j.reject(new Error('dropped')); } else keep.push(j);
    }
    this.queue = keep;
    this._changed();
  }
  _changed() { if (this.onChange) this.onChange(); }
  _sort() { this.queue.sort((a, b) => b.entry.prio - a.entry.prio || a.id - b.id); }
  _spawn() {
    const w = { worker: new Worker(WORKER_URL, { type: 'module' }), job: null, ready: false };
    w.worker.onmessage = (e) => this._msg(w, e.data);
    w.worker.onerror = (e) => { if (w.job) { const j = w.job; w.job = null; this.cache.delete(j.k); j.reject(new Error(e.message || 'worker error')); } w.dead = true; this._pump(); };
    w.worker.postMessage({ t: 'init', bytes: this.bytes.slice(0) });
    this.workers.push(w);
    return w;
  }
  _msg(w, m) {
    if (m.t === 'ready') { w.ready = true; this._pump(); return; }
    if (m.t === 'fail') { w.dead = true; this.failed = new Error(m.message); return; }
    const j = w.job;
    if (!j || j.id !== m.id) return;
    w.job = null;
    if (m.t === 'done') {
      const secs = m.pcm.length / m.fs;
      const sp = secs / Math.max(0.001, m.ms / 1000);
      this.speed = this.speed ? this.speed * 0.7 + sp * 0.3 : sp;
      j.resolve({ k: j.k, pcm: m.pcm, tele: m.tele, hop: m.hop, fs: m.fs, lead: m.lead, dur: m.dur, buffer: null });
    } else { this.cache.delete(j.k); j.reject(new Error(m.message)); }
    this._pump();
  }
  _pump() {
    if (!this.bytes) return;
    this.workers = this.workers.filter((w) => !w.dead);
    while (this.queue.length) {
      let w = this.workers.find((x) => x.ready && !x.job);
      if (!w) {
        const starting = this.workers.filter((x) => !x.ready).length;
        if (this.workers.length < this.size && starting < this.queue.length) this._spawn();
        return;
      }
      const j = this.queue.shift();
      w.job = j;
      w.worker.postMessage({ t: 'render', id: j.id, spec: j.spec });
    }
  }
  _trim() {
    let total = 0;
    for (const c of this.cache.values()) if (c.unit) total += c.unit.pcm.length;
    if (total <= this.memCap) return;
    const list = [...this.cache.values()].filter((c) => c.unit && !c.pin).sort((a, b) => a.last - b.last);
    for (const c of list) {
      if (total <= this.memCap * 0.8) break;
      total -= c.unit.pcm.length;
      this.cache.delete(c.k);
    }
  }
  pin(spec, on) { const c = this.cache.get(this.key(spec)); if (c) c.pin = on; }
  _dbGet(k) {
    if (!this.db) return Promise.resolve(null);
    return new Promise((res) => {
      try {
        const rq = this.db.transaction(STORE, 'readonly').objectStore(STORE).get(k);
        rq.onsuccess = () => {
          const r = rq.result;
          if (!r) { res(null); return; }
          const i16 = new Int16Array(r.pcm), pcm = new Float32Array(i16.length);
          for (let i = 0; i < i16.length; i++) pcm[i] = i16[i] / 32767 * r.peak;
          res({ k, pcm, tele: new Float32Array(r.tele), hop: r.hop, fs: r.fs, lead: r.lead, dur: r.dur, buffer: null });
        };
        rq.onerror = () => res(null);
      } catch (e) { res(null); }
    });
  }
  _dbPut(k, u) {
    if (!this.db) return;
    try {
      let peak = 1e-6;
      for (let i = 0; i < u.pcm.length; i++) { const a = Math.abs(u.pcm[i]); if (a > peak) peak = a; }
      const i16 = new Int16Array(u.pcm.length);
      for (let i = 0; i < i16.length; i++) i16[i] = Math.round(u.pcm[i] / peak * 32767);
      const tele = u.tele.slice();
      this.db.transaction(STORE, 'readwrite').objectStore(STORE).put({ k, t: Date.now(), pcm: i16.buffer, tele: tele.buffer, peak, hop: u.hop, fs: u.fs, lead: u.lead, dur: u.dur });
    } catch (e) {}
  }
  _trimDb() {
    if (!this.db) return;
    try {
      const st = this.db.transaction(STORE, 'readwrite').objectStore(STORE);
      let n = 0;
      st.index('t').openKeyCursor(null, 'prev').onsuccess = (e) => {
        const cur = e.target.result;
        if (!cur) return;
        if (++n > DB_KEEP) st.delete(cur.primaryKey);
        cur.continue();
      };
    } catch (e) {}
  }
}
