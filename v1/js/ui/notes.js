// Wire Choir notes window: piano roll of the lead melody; drag to move, drag the right edge to resize, click to hear.
import { snapToScale } from '../composer.js';
import { noteName } from '../voices.js';

export function mountNotes(body, app) {
  const L = app.t();
  body.innerHTML = '';
  const bar = document.createElement('div');
  bar.className = 'rollbar';
  const roll = document.createElement('div');
  roll.className = 'roll';
  const cv = document.createElement('canvas');
  roll.appendChild(cv);
  body.append(bar, roll);
  const g = cv.getContext('2d');
  let data = null;
  const view = { pxb: 30, sx: 0 };
  let geo = null, drag = null, hover = null, dirty = true, lastHead = -1;

  async function refresh() {
    data = await app.arrangement();
    if (data) {
      const ms = data.notes.map((n) => n.m);
      data.lo = Math.min(...ms) - 3; data.hi = Math.max(...ms) + 3;
      while (data.hi - data.lo < 15) { data.lo--; data.hi++; }
    }
    renderBar();
    dirty = true;
  }

  function renderBar() {
    bar.innerHTML = '';
    const tag = document.createElement('span');
    tag.className = 'tag';
    if (!data) { tag.textContent = L.notesEmpty; bar.append(tag); return; }
    const manual = data.arr.lines.filter((l) => l.explicit).length;
    tag.innerHTML = manual ? `<b>${L.manual}</b> · ${manual}/${data.arr.lines.length}` : `<b>${L.autoMelody}</b> · ${L.dragHint}`;
    const play = document.createElement('button');
    play.className = 'btn';
    play.textContent = app.playing() ? L.stopAll : '▶ ' + L.playAll;
    play.addEventListener('click', () => { app.toggleSong(); setTimeout(renderBar, 60); });
    bar.append(tag, play);
    if (manual) {
      const back = document.createElement('button');
      back.className = 'btn quiet';
      back.textContent = L.backToAuto;
      back.addEventListener('click', () => { app.song.melody = {}; app.commit({ keepWins: true }); refresh(); });
      bar.append(back);
    }
  }

  function size() {
    const r = roll.getBoundingClientRect();
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const w = Math.max(10, Math.round(r.width)), h = Math.max(10, Math.round(r.height));
    if (cv.width !== w * dpr || cv.height !== h * dpr) { cv.width = w * dpr; cv.height = h * dpr; }
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    return { w, h };
  }

  function layout() {
    const { w, h } = size();
    const top = 22, left = 38;
    const rows = data.hi - data.lo + 1;
    const rowH = Math.max(6, (h - top - 6) / rows);
    const X = (b) => left + (b - view.sx) * view.pxb;
    const Y = (m) => top + (data.hi - m) * rowH;
    geo = { w, h, top, left, rowH, X, Y };
    return geo;
  }

  function colorOfLine(li) {
    const ln = data.arr.lines.find((l) => l.i === li);
    return app.headColor(ln && ln.singers[0]);
  }

  function draw(headBeat) {
    if (!data) { const { w, h } = size(); g.clearRect(0, 0, w, h); return; }
    const { w, h, top, left, rowH, X, Y } = layout();
    g.clearRect(0, 0, w, h);
    for (let m = data.lo; m <= data.hi; m++) {
      const pc = ((m % 12) + 12) % 12;
      if ([1, 3, 6, 8, 10].includes(pc)) { g.fillStyle = 'rgba(255,255,255,0.025)'; g.fillRect(left, Y(m), w - left, rowH); }
      if (pc === 0) {
        g.fillStyle = 'rgba(255,255,255,0.06)'; g.fillRect(left, Y(m) + rowH - 1, w - left, 1);
        g.fillStyle = '#48484a'; g.font = '10px -apple-system, system-ui, sans-serif'; g.fillText(noteName(m), 6, Y(m) + rowH - 2);
      }
    }
    const total = data.arr.totalBeats;
    for (let b = 0; b <= total; b++) {
      const x = X(b);
      if (x < left - 1 || x > w) continue;
      g.fillStyle = b % 4 === 0 ? 'rgba(255,255,255,0.12)' : 'rgba(255,255,255,0.04)';
      g.fillRect(Math.round(x), top, 1, h - top);
    }
    g.font = 'italic 11px -apple-system, system-ui, sans-serif';
    for (const ch of data.arr.chords) {
      const x = X(ch.b);
      if (x > w || x + 40 < left) continue;
      g.fillStyle = '#8e8e93';
      g.fillText(ch.name, x + 4, 14);
    }
    g.font = '11px -apple-system, system-ui, sans-serif';
    for (const n of data.notes) {
      const x = X(n.b), y = Y(n.m), nw = Math.max(4, n.d * view.pxb - 2);
      if (x > w || x + nw < left) continue;
      const c = colorOfLine(n.line);
      const on = headBeat !== undefined && headBeat >= n.b && headBeat < n.b + n.d;
      g.globalAlpha = drag && drag.n === n ? 1 : on ? 1 : 0.78;
      g.fillStyle = c;
      roundRect(x + 1, y + 1, nw, rowH - 2, Math.min(4, rowH / 2));
      g.fill();
      if (n.edited) { g.strokeStyle = '#f5f5f7'; g.lineWidth = 1; g.stroke(); }
      g.globalAlpha = 1;
      if (nw > 18 && rowH >= 10) {
        g.fillStyle = '#000';
        g.save(); g.beginPath(); g.rect(x + 1, y, nw, rowH); g.clip();
        g.fillText(n.syl.text.trim(), x + 5, y + rowH / 2 + 4);
        g.restore();
      }
    }
    if (headBeat !== undefined) {
      const x = X(headBeat);
      g.fillStyle = '#f5f5f7';
      g.fillRect(Math.round(x), top - 4, 1.5, h - top + 4);
    }
    g.fillStyle = '#000'; g.fillRect(0, top, left - 2, h);
    for (let m = data.lo; m <= data.hi; m++) if (((m % 12) + 12) % 12 === 0) { g.fillStyle = '#48484a'; g.fillText(noteName(m), 6, Y(m) + rowH - 2); }
  }

  function roundRect(x, y, w, h, r) {
    g.beginPath();
    g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r);
    g.closePath();
  }

  function hit(px, py) {
    if (!data || !geo) return null;
    const { X, Y, rowH } = geo;
    for (let i = data.notes.length - 1; i >= 0; i--) {
      const n = data.notes[i];
      const x = X(n.b), y = Y(n.m), nw = Math.max(4, n.d * view.pxb - 2);
      if (px >= x && px <= x + nw + 2 && py >= y && py <= y + rowH) return { n, edge: px > x + nw - 7 };
    }
    return null;
  }

  function commitNote(n, nb, nd, nm) {
    const ln = data.arr.lines.find((l) => l.i === n.line);
    if (!ln) return;
    const rel = data.notes.filter((x) => x.line === n.line).sort((a, b) => a.li - b.li).map((x) => ({ i: x.li, b: x.b - ln.b0, d: x.d, m: x.m }));
    const t = rel.find((r) => r.i === n.li);
    t.b = Math.max(0, nb - ln.b0); t.d = Math.max(0.25, nd); t.m = nm;
    const bars = Math.max(ln.bars, Math.ceil(Math.max(...rel.map((r) => r.b + r.d)) / 4));
    app.song.melody = { ...(app.song.melody && !Array.isArray(app.song.melody) ? app.song.melody : {}), [ln.id]: { bars, notes: rel } };
    app.commit({ keepWins: true });
    refresh();
  }

  cv.addEventListener('pointerdown', (e) => {
    const r = cv.getBoundingClientRect();
    const px = e.clientX - r.left, py = e.clientY - r.top;
    const h = hit(px, py);
    cv.setPointerCapture(e.pointerId);
    if (!h) { drag = { pan: true, x0: e.clientX, sx0: view.sx }; return; }
    drag = { n: h.n, edge: h.edge, x0: e.clientX, y0: e.clientY, b0: h.n.b, d0: h.n.d, m0: h.n.m, moved: false };
    app.previewNote(h.n);
  });
  cv.addEventListener('pointermove', (e) => {
    if (!drag) {
      const r = cv.getBoundingClientRect();
      const h = hit(e.clientX - r.left, e.clientY - r.top);
      cv.style.cursor = h ? (h.edge ? 'ew-resize' : 'grab') : 'default';
      return;
    }
    if (drag.pan) { view.sx = Math.max(0, drag.sx0 - (e.clientX - drag.x0) / view.pxb); dirty = true; return; }
    const db = (e.clientX - drag.x0) / view.pxb, dm = -(e.clientY - drag.y0) / geo.rowH;
    const q = e.shiftKey ? 0.25 : 0.5;
    if (Math.abs(e.clientX - drag.x0) + Math.abs(e.clientY - drag.y0) > 3) drag.moved = true;
    const n = drag.n;
    if (drag.edge) n.d = Math.max(q, Math.round((drag.d0 + db) / q) * q);
    else {
      n.b = Math.max(0, Math.round((drag.b0 + db) / q) * q);
      const nm = snapToScale(drag.m0 + Math.round(dm), data.arr.key, data.arr.mode);
      if (nm !== n.m) { n.m = nm; app.previewNote(n); }
    }
    dirty = true;
  });
  const end = () => {
    if (!drag) return;
    const d = drag;
    drag = null;
    if (d.n && d.moved) commitNote(d.n, d.n.b, d.n.d, d.n.m);
    dirty = true;
  };
  cv.addEventListener('pointerup', end);
  cv.addEventListener('pointercancel', end);
  cv.addEventListener('wheel', (e) => {
    e.preventDefault();
    if (e.ctrlKey || e.metaKey) view.pxb = Math.max(10, Math.min(90, view.pxb * (e.deltaY > 0 ? 0.9 : 1.1)));
    else view.sx = Math.max(0, view.sx + (e.deltaX || e.deltaY) / view.pxb);
    dirty = true;
  }, { passive: false });
  const ro = new ResizeObserver(() => { dirty = true; });
  ro.observe(roll);

  refresh();
  return {
    refresh,
    frame() {
      const hb = app.songBeat();
      if (hb !== null && data && geo) {
        const x = geo.X(hb);
        if (x > geo.w - 40) { view.sx = hb - 2; dirty = true; }
      }
      if (hb !== null && Math.abs(hb - lastHead) > 0.02) { lastHead = hb; dirty = true; }
      if (hb === null && lastHead !== -1) { lastHead = -1; dirty = true; }
      if (dirty) { dirty = false; draw(hb === null ? undefined : hb); renderBarOnce(); }
    },
    destroy() { ro.disconnect(); },
  };

  function renderBarOnce() {
    const playing = app.playing();
    if (playing !== renderBarOnce.last) { renderBarOnce.last = playing; renderBar(); }
  }
}
