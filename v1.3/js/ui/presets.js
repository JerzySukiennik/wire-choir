// Wire Choir building-blocks window: starter sets, ready phrases to hear and add, beatbox patterns with an editable pattern line, and bass patterns.
import { CATS, PHRASES, BEATS, BEAT_KIT, BASSES, STARTERS } from '../presets.js';

export function mountPresets(body, app) {
  let armed = null, armTimer = 0;
  const el = (tag, cls, html) => { const d = document.createElement(tag); if (cls) d.className = cls; if (html != null) d.innerHTML = html; return d; };
  function draw() {
    const L = app.t(), lang = app.song.lang;
    body.innerHTML = '';
    body.appendChild(el('div', 'lbl', `<span>${L.pStarters}</span>`)).style.marginTop = '0';
    const st = el('div', 'chips');
    for (const s of STARTERS) {
      const b = el('button', armed === s.id ? 'on' : '', armed === s.id ? L.pConfirm : s.name[lang]);
      b.addEventListener('click', () => {
        if (app.song.lines.length && armed !== s.id) {
          armed = s.id;
          clearTimeout(armTimer);
          armTimer = setTimeout(() => { armed = null; draw(); }, 3500);
          draw();
          return;
        }
        armed = null;
        app.applyStarter(s);
      });
      st.appendChild(b);
    }
    body.appendChild(st);
    body.appendChild(el('p', 'note', L.pNote));
    for (const cat of Object.keys(CATS)) {
      body.appendChild(el('div', 'lbl', `<span>${CATS[cat][lang]}</span>`));
      const list = el('div', 'plist');
      for (const p of PHRASES.filter((x) => x.cat === cat)) {
        const row = el('div', 'prow');
        const play = el('button', 'pplay', `<i>▶</i><span>${p.name[lang]}</span><em>${p[lang]}</em>`);
        play.addEventListener('click', () => app.previewPhrase(p));
        const add = el('button', 'padd', '+');
        add.setAttribute('aria-label', L.pAdd);
        add.title = L.pAdd;
        add.addEventListener('click', () => app.addPhrase(p));
        row.append(play, add);
        list.appendChild(row);
      }
      body.appendChild(list);
    }
    body.appendChild(el('div', 'lbl', `<span>${L.pBeats}</span>`));
    const cur = app.song.beat && app.song.beat.text ? app.song.beat : null;
    const bc = el('div', 'chips');
    for (const b of BEATS) {
      const on = cur ? cur.id === b.id : b.id === 'auto';
      const btn = el('button', on ? 'on' : '', b.name[lang]);
      btn.addEventListener('click', () => { app.setBeat(b); draw(); });
      bc.appendChild(btn);
    }
    body.appendChild(bc);
    const inp = document.createElement('input');
    inp.className = 'ptext'; inp.type = 'text'; inp.spellcheck = false; inp.value = cur ? cur.text : ''; inp.placeholder = L.pBeatPh;
    inp.setAttribute('aria-label', L.pBeats);
    inp.addEventListener('keydown', (e) => { e.stopPropagation(); if (e.key === 'Enter') inp.blur(); });
    inp.addEventListener('change', () => { app.setBeat({ id: 'custom', text: inp.value.trim(), swing: cur ? cur.swing : 0 }); draw(); });
    body.appendChild(inp);
    body.appendChild(el('p', 'note', L.pBeatKit + ' ' + BEAT_KIT.map(([id, n]) => `<kbd>${id.replace('<', '&lt;')}</kbd> ${n[lang]}`).join(' · ') + ' · <kbd>.</kbd> ' + L.pRest));
    body.appendChild(el('div', 'lbl', `<span>${L.pBass}</span>`));
    const bs = el('div', 'chips');
    for (const b of BASSES) {
      const btn = el('button', (app.song.bassPat || '') === b.id ? 'on' : '', b.name[lang]);
      btn.addEventListener('click', () => { app.setBass(b.id); draw(); });
      bs.appendChild(btn);
    }
    body.appendChild(bs);
  }
  draw();
  return { refresh() { draw(); }, frame() {}, destroy() { clearTimeout(armTimer); } };
}
