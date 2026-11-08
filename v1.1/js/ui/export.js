// Wire Choir export window: copy a song link, render a WAV, record a 9:16 or 16:9 video of the singing heads.
import { encodeSong, renderWav, download, videoMime } from '../share.js';

export function mountExport(body, app) {
  const L = app.t();
  let fmt = '9:16', busy = false;
  body.innerHTML = '';
  const sec = (title, text) => {
    const d = document.createElement('div');
    d.innerHTML = `<div class="lbl"><span>${title}</span></div><p class="note" style="margin-top:0">${text}</p>`;
    body.appendChild(d);
    const row = document.createElement('div');
    row.className = 'row2';
    row.style.marginTop = '8px';
    body.appendChild(row);
    return row;
  };
  const btn = (row, text, cls, fn) => { const b = document.createElement('button'); b.className = 'btn ' + (cls || ''); b.textContent = text; b.addEventListener('click', fn); row.appendChild(b); return b; };
  const prog = document.createElement('div');
  prog.className = 'prog';
  prog.innerHTML = '<i></i>';
  const setProg = (v) => { prog.firstChild.style.width = Math.round(v * 100) + '%'; };

  const r1 = sec(L.expLink, L.expLinkNote);
  btn(r1, L.copyLink, 'pri', async () => {
    const code = await encodeSong(app.song);
    const url = location.origin + location.pathname + '#s=' + code;
    try { await navigator.clipboard.writeText(url); app.toast(L.linkCopied); } catch (e) { prompt(L.copyLink, url); }
  });

  const r2 = sec(L.expWav, L.expWavNote);
  const wavBtn = btn(r2, L.downloadWav, '', async () => {
    if (busy) return;
    const job = await app.songJob();
    if (!job) { app.toast(L.needLines); return; }
    busy = true; wavBtn.disabled = true; vidBtn.disabled = true;
    body.appendChild(prog); setProg(0);
    try {
      const blob = await renderWav(job, setProg);
      download(blob, app.fileName('wav'));
      app.toast(L.wavDone);
    } catch (e) { app.toast(L.exportFail + ' ' + e.message, 4000); }
    busy = false; wavBtn.disabled = false; vidBtn.disabled = false; prog.remove();
  });

  const r3 = sec(L.expVideo, videoMime() ? L.expVideoNote : L.noVideo);
  const fmts = document.createElement('div');
  fmts.className = 'chips';
  const drawFmts = () => {
    fmts.innerHTML = '';
    for (const [k, label] of [['9:16', L.vertical], ['16:9', L.horizontal]]) {
      const b = document.createElement('button');
      b.textContent = label;
      if (k === fmt) b.classList.add('on');
      b.addEventListener('click', () => { fmt = k; drawFmts(); });
      fmts.appendChild(b);
    }
  };
  drawFmts();
  r3.appendChild(fmts);
  const vidBtn = btn(r3, '● ' + L.recordVideo, '', async () => {
    if (busy) return;
    if (!app.song.lines.length) { app.toast(L.needLines); return; }
    busy = true; wavBtn.disabled = true; vidBtn.disabled = true;
    body.appendChild(prog); setProg(0);
    try {
      const blob = await app.recordVideo(fmt, setProg);
      if (blob) { download(blob, app.fileName(blob.type.includes('mp4') ? 'mp4' : 'webm')); app.toast(L.videoDone); }
    } catch (e) { app.toast(L.exportFail + ' ' + e.message, 4000); }
    busy = false; wavBtn.disabled = false; vidBtn.disabled = !videoMime(); prog.remove();
  });
  vidBtn.disabled = !videoMime();
  return { refresh() {}, frame() {}, destroy() {} };
}
