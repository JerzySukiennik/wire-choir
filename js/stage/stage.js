// Wire Choir stage: one WebGL canvas, a panel per head (scissor viewports), flying words, slow orbit cameras, no post-processing.
import * as THREE from 'three';
import { WireHead } from './head.js';

const texCache = new Map();
function wordTexture(text, color) {
  const key = text + '|' + color;
  if (texCache.has(key)) return texCache.get(key);
  const c = document.createElement('canvas');
  const fs = 64;
  const g = c.getContext('2d');
  g.font = `500 ${fs}px "Geist Mono", ui-monospace, monospace`;
  const w = Math.ceil(g.measureText(text).width) + 24;
  c.width = w; c.height = fs + 24;
  g.font = `500 ${fs}px "Geist Mono", ui-monospace, monospace`;
  g.fillStyle = color;
  g.textBaseline = 'middle';
  g.fillText(text, 12, c.height / 2 + 2);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  const v = { tex: t, aspect: c.width / c.height };
  if (texCache.size > 300) { const k = texCache.keys().next().value; texCache.get(k).tex.dispose(); texCache.delete(k); }
  texCache.set(key, v);
  return v;
}

export class Stage {
  constructor(canvas, opts = {}) {
    this.canvas = canvas;
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false, preserveDrawingBuffer: !!opts.preserve, powerPreference: 'high-performance' });
    this.renderer.setClearColor(0x000000, 1);
    this.pr = Math.min(opts.maxPr || 2, window.devicePixelRatio || 1);
    this.renderer.setPixelRatio(this.pr);
    this.panels = [];
    this.width = 1; this.height = 1;
    this.renderer.autoClear = false;
    this.layoutMode = opts.layout || 'auto';
    this.tmpV = new THREE.Vector3();
    this.time = 0;
  }

  addPanel(opts) {
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(28, 1, 0.1, 50);
    const head = new WireHead({ color: opts.color, wordColor: opts.wordColor });
    head.group.scale.setScalar(opts.scale || 1);
    scene.add(head.group);
    const p = { id: opts.id, scene, camera, head, rect: { x: 0, y: 0, w: 1, h: 1 }, phase: opts.phase ?? this.panels.length * 1.7, words: [], yawOverride: null, overrideT: 0, source: opts.source || null, wordColor: opts.wordColor || '#7dffb6', drag: 0 };
    this.panels.push(p);
    this.relayout();
    return p;
  }

  removePanel(p) {
    const i = this.panels.indexOf(p);
    if (i < 0) return;
    this.panels.splice(i, 1);
    for (const w of p.words) { p.scene.remove(w.sprite); w.sprite.material.dispose(); }
    p.head.dispose();
    this.relayout();
  }

  setSize(w, h) {
    if (w < 2 || h < 2) return;
    this.width = Math.max(1, Math.round(w)); this.height = Math.max(1, Math.round(h));
    this.renderer.setSize(this.width, this.height, false);
    this.relayout();
  }

  relayout() {
    const n = this.panels.length;
    if (!n) return;
    const W = this.width, H = this.height, gap = this.gap ?? 10;
    const portrait = H > W * 1.15;
    let cols, rows;
    if (this.layoutMode === 'row') {
      const maxC = portrait ? 2 : W / H > 2.2 ? 6 : 4;
      cols = Math.min(n, maxC); rows = Math.ceil(n / cols);
    } else if (n === 1) { cols = 1; rows = 1; }
    else if (n === 2) { cols = portrait ? 1 : 2; rows = portrait ? 2 : 1; }
    else if (n <= 4) { cols = portrait && n === 3 ? 1 : 2; rows = Math.ceil(n / cols); if (!portrait && n === 3) { cols = 3; rows = 1; } }
    else { cols = portrait ? 2 : 3; rows = Math.ceil(n / cols); }
    const pw = Math.max(1, (W - gap * (cols + 1)) / cols), ph = Math.max(1, (H - gap * (rows + 1)) / rows);
    this.panels.forEach((p, i) => {
      const r = Math.floor(i / cols), c = i % cols;
      const inRow = Math.min(cols, n - r * cols);
      const offset = (cols - inRow) * (pw + gap) / 2;
      p.rect = { x: gap + c * (pw + gap) + offset, y: gap + r * (ph + gap), w: pw, h: ph };
      p.camera.aspect = pw / ph;
      p.camera.updateProjectionMatrix();
    });
  }

  project(p, v, out) {
    const w = v.clone();
    p.head.inner.localToWorld(w);
    w.project(p.camera);
    out.x = p.rect.x + (w.x * 0.5 + 0.5) * p.rect.w;
    out.y = p.rect.y + (-w.y * 0.5 + 0.5) * p.rect.h;
    return out;
  }

  panelAt(x, y) {
    for (const p of this.panels) { const r = p.rect; if (x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h) return p; }
    return null;
  }

  emitWord(p, text) {
    if (!text) return;
    const { tex, aspect } = wordTexture(text.toUpperCase(), p.wordColor);
    const mat = new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0 });
    const s = new THREE.Sprite(mat);
    const h = 0.15;
    s.scale.set(h * aspect, h, 1);
    s.center.set(0, 0.5);
    p.scene.add(s);
    for (const w of p.words) w.push += 1;
    p.words.push({ sprite: s, age: 0, life: 1.5, h, aspect, push: 0 });
    if (p.words.length > 6) { const o = p.words.shift(); p.scene.remove(o.sprite); o.sprite.material.dispose(); }
  }

  frame(dt) {
    this.time += dt;
    const t = this.time;
    for (const p of this.panels) {
      const src = p.source ? p.source() : null;
      if (src) p.head.update(src.params, src.level, t, dt, src.f0Rel || 0);
      let yaw = -1.12 + Math.sin(t * 0.11 + p.phase) * 0.42 + Math.sin(t * 0.047 + p.phase * 2.3) * 0.2;
      if (p.yawOverride !== null) {
        p.overrideT -= dt;
        const k = Math.min(1, Math.max(0, p.overrideT / 1.5));
        yaw = p.yawOverride * k + yaw * (1 - k);
        if (p.overrideT <= 0) p.yawOverride = null;
      }
      const pitch = 0.08 + Math.sin(t * 0.07 + p.phase) * 0.06;
      const aspect = p.camera.aspect;
      const vfov = (p.camera.fov * Math.PI) / 180;
      const needH = 3.35, needW = 2.9;
      const dist = Math.max(needH / 2 / Math.tan(vfov / 2), needW / 2 / (Math.tan(vfov / 2) * aspect)) * 1.04 / (p.zoom || 1);
      const cy = p.focusY ?? -0.38;
      p.camera.position.set(Math.sin(yaw) * Math.cos(pitch) * dist, cy + Math.sin(pitch) * dist, (p.focusZ || 0) + Math.cos(yaw) * Math.cos(pitch) * dist);
      p.camera.lookAt(0, cy, p.focusZ || 0);
      const sc = p.head.group.scale.x;
      p.head.setDepth(dist - 1.25 * sc, dist + 1.25 * sc);
      const mouth = p.head.mouthPoint(this.tmpV);
      for (let i = p.words.length - 1; i >= 0; i--) {
        const w = p.words[i];
        w.age += dt;
        const a = w.age / w.life;
        if (a >= 1) { p.scene.remove(w.sprite); w.sprite.material.dispose(); p.words.splice(i, 1); continue; }
        const fadeIn = Math.min(1, w.age / 0.08), fadeOut = 1 - Math.max(0, (a - 0.55) / 0.45);
        w.sprite.material.opacity = fadeIn * fadeOut;
        const out = 0.06 + Math.min(1, w.age * 3) * 0.12 + w.age * 0.06;
        w.sprite.position.set(mouth.x, mouth.y + 0.02 + w.push * 0.16 + w.age * 0.04, mouth.z + out);
        const right = new THREE.Vector3(Math.cos(yaw), 0, -Math.sin(yaw));
        w.sprite.position.addScaledVector(right, 0.05);
        const sc = 1 + w.age * 0.15;
        w.sprite.scale.set(w.h * w.aspect * sc, w.h * sc, 1);
      }
    }
    this.render();
  }

  render() {
    const r = this.renderer, H = this.height;
    r.setScissorTest(false);
    r.clear();
    r.setScissorTest(true);
    for (const p of this.panels) {
      const q = p.rect, y = H - q.y - q.h;
      r.setViewport(q.x, y, q.w, q.h);
      r.setScissor(q.x, y, q.w, q.h);
      r.render(p.scene, p.camera);
    }
    r.setScissorTest(false);
  }
}
