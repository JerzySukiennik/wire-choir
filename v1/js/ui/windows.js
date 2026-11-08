// Wire Choir floating windows: black, draggable, resizable, positions remembered per window.
const KEY = 'wc.windows';
let saved = {};
try { saved = JSON.parse(localStorage.getItem(KEY) || '{}'); } catch (e) { saved = {}; }
let z = 20;

function persist() { try { localStorage.setItem(KEY, JSON.stringify(saved)); } catch (e) {} }

export class Win {
  constructor(id, title, opts = {}) {
    this.id = id;
    this.el = document.createElement('section');
    this.el.className = 'win';
    this.el.setAttribute('role', 'dialog');
    this.el.setAttribute('aria-label', title);
    this.el.innerHTML = `<header class="win-h"><span class="win-t">${title}</span><button class="win-x" aria-label="Zamknij">×</button></header><div class="win-b"></div><div class="win-r" aria-hidden="true"></div>`;
    this.body = this.el.querySelector('.win-b');
    const s = saved[id] || {};
    const W = window.innerWidth, H = window.innerHeight;
    const w = Math.min(s.w || opts.w || 360, W - 24), h = Math.min(s.h || opts.h || 420, H - 24);
    this.box = { x: Math.min(s.x ?? opts.x ?? 64, W - w - 12), y: Math.min(s.y ?? opts.y ?? 56, H - h - 12), w, h };
    this.apply();
    this.el.querySelector('.win-x').addEventListener('click', () => this.close());
    this.el.addEventListener('pointerdown', () => this.front());
    this.drag(this.el.querySelector('.win-h'), (dx, dy, b) => { this.box.x = b.x + dx; this.box.y = b.y + dy; });
    this.drag(this.el.querySelector('.win-r'), (dx, dy, b) => { this.box.w = Math.max(240, b.w + dx); this.box.h = Math.max(160, b.h + dy); });
    this.onClose = null;
    document.body.appendChild(this.el);
    this.front();
  }
  apply() {
    const b = this.box, W = window.innerWidth, H = window.innerHeight;
    b.x = Math.max(4, Math.min(b.x, W - 60)); b.y = Math.max(4, Math.min(b.y, H - 40));
    Object.assign(this.el.style, { left: b.x + 'px', top: b.y + 'px', width: b.w + 'px', height: b.h + 'px' });
  }
  drag(handle, fn) {
    handle.addEventListener('pointerdown', (e) => {
      if (e.target.closest('button') && handle.classList.contains('win-h')) return;
      e.preventDefault();
      handle.setPointerCapture(e.pointerId);
      const sx = e.clientX, sy = e.clientY, b0 = { ...this.box };
      const mv = (ev) => { fn(ev.clientX - sx, ev.clientY - sy, b0); this.apply(); };
      const up = () => { handle.removeEventListener('pointermove', mv); handle.removeEventListener('pointerup', up); saved[this.id] = { ...this.box }; persist(); };
      handle.addEventListener('pointermove', mv);
      handle.addEventListener('pointerup', up);
    });
  }
  front() { this.el.style.zIndex = ++z; }
  close() { this.el.remove(); if (this.onClose) this.onClose(); }
}
