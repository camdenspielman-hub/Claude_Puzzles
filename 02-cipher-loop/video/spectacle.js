/* Cipher Loop — deterministic motion-graphics engine. window.renderAt(t) draws frame at t seconds. */
(function () {
'use strict';
const NS = 'http://www.w3.org/2000/svg', S = 56, N = 12, GX = 212, GY = 192;
const $ = id => document.getElementById(id);
const E = (tag, attrs, parent) => { const e = document.createElementNS(NS, tag); if (attrs) for (const k in attrs) e.setAttribute(k, attrs[k]); if (parent) parent.appendChild(e); return e; };
const clamp = (x, a = 0, b = 1) => Math.max(a, Math.min(b, x));
const ease = x => { x = clamp(x); return x < .5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2; };
const eout = x => { x = clamp(x); return 1 - Math.pow(1 - x, 3); };
const expo = x => { x = clamp(x); return x === 1 ? 1 : 1 - Math.pow(2, -10 * x); };
const back = x => { x = clamp(x); const c1 = 1.9, c3 = c1 + 1; return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2); };
const lerp = (a, b, k) => a + (b - a) * k;
const rnd = (i, k) => { const x = Math.sin((i + 1) * 12.9898 + k * 78.233) * 43758.5453; return x - Math.floor(x); };

// ───────────── puzzle data
const COLS = {1:['?','H','?E','?E'],2:['H','J?'],3:['?B','C'],4:['?','C','C','?','?'],5:['JH','?','?G'],6:['D','?','?'],7:['A?'],8:['D','?','?','?'],9:['C','C','C','C'],10:['A','?','I','?'],11:['?','F','?','F?','?'],12:['JA','?','?I']};
const ROWS = {1:['??','?I','JC'],3:['??','?','H','D'],6:['?'],8:['??','??','??'],10:['?B','?','F'],12:['I','?','?','?']};
const LETTERS = 'ABCDEFGHIJ';
const LCOL = {A:'#ff5d8f',B:'#ff9a3d',C:'#ffd23f',D:'#a6e85a',E:'#2ee6a6',F:'#36d6ff',G:'#5b8cff',H:'#a477ff',I:'#ea6bff',J:'#ff6b6b'};
const PALETTES = {
  cyan:  [[0.10,0.80,1.00],[0.62,0.30,1.00],[1.00,0.30,0.70]],
  amber: [[1.00,0.55,0.15],[1.00,0.22,0.55],[0.45,0.30,1.00]],
  violet:[[0.55,0.30,1.00],[0.15,0.75,1.00],[1.00,0.45,0.85]],
  mint:  [[0.15,1.00,0.70],[0.20,0.55,1.00],[0.80,0.40,1.00]],
  rose:  [[1.00,0.30,0.55],[0.55,0.25,1.00],[1.00,0.70,0.25]],
  gold:  [[1.00,0.78,0.25],[0.30,0.85,1.00],[1.00,0.35,0.75]],
};
const cellId = (r, c) => `r${r}c${c}`;
const parseCell = id => { const m = id.match(/^r(\d+)c(\d+)$/); return [+m[1], +m[2]]; };
function expandCells(spec) {
  if (/^r\d+c\d+$/.test(spec)) return [spec];
  let m = spec.match(/^C(\d+)$/); if (m) return Array.from({ length: N }, (_, i) => cellId(i + 1, +m[1]));
  m = spec.match(/^R(\d+)$/); if (m) return Array.from({ length: N }, (_, i) => cellId(+m[1], i + 1));
  m = spec.match(/^r(\d+)c(\d+):r(\d+)c(\d+)$/);
  if (m) { const o = []; for (let r = +m[1]; r <= +m[3]; r++) for (let c = +m[2]; c <= +m[4]; c++) o.push(cellId(r, c)); return o; }
  return [];
}
const lineName = tag => tag[0] === 'C' ? 'Column ' + tag.slice(1) : 'Row ' + tag.slice(1);

// ───────────── markup
function md(s) {
  s = s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  s = s.replace(/\[(r\d+c\d+)\]/g, (m, id) => `<span class="pill cellp">${id.toUpperCase()}</span>`);
  s = s.replace(/\{([CR]\d+)\}/g, (m, id) => `<span class="pill linep">${id}</span>`);
  s = s.replace(/\$([A-J])/g, (m, L) => `<span class="pill letp" style="background:${LCOL[L]}">${L}</span>`);
  s = s.replace(/\*\*(.+?)\*\*/g, '<b>$1</b>');
  s = s.replace(/\^(.+?)\^/g, '<span class="hi">$1</span>');
  s = s.replace(/!!(.+?)!!/g, '<span class="bad">$1</span>');
  s = s.replace(/%%(.+?)%%/g, '<span class="ok">$1</span>');
  return s;
}
const plain = s => s.replace(/\[(r\d+c\d+)\]/g, 'R0C0').replace(/\{([CR]\d+)\}/g, 'C00').replace(/\$([A-J])/g, '$1').replace(/\*\*|\^|!!|%%/g, '');

// ───────────── timeline
const TL = { segs: [], events: [], beats: [], total: 0, audio: [] };
(function build() {
  let t = 0, prevCh = null, num = 0;
  const nReal = STEPS.filter(s => !s.kind && !s.rules).length;
  for (const st of STEPS) {
    if (st.kind === 'intro') { TL.segs.push({ type: 'intro', t0: t, t1: t + st.dur }); TL.audio.push({ t, type: 'intro' }); t += st.dur; continue; }
    if (st.kind === 'final') { TL.segs.push({ type: 'final', t0: t, t1: t + st.dur }); TL.audio.push({ t, type: 'final' }); t += st.dur; continue; }
    if (st.chapter !== prevCh) {
      const d = 3.6;
      TL.segs.push({ type: 'chapter', t0: t, t1: t + d, name: st.chapter, sub: st.chapterSub || '', pal: st.pal || 'cyan' });
      TL.audio.push({ t, type: 'chapter' });
      t += d; prevCh = st.chapter;
    }
    const seg = { type: 'step', t0: t, st, beats: [], num: st.rules ? 0 : ++num, nReal, idx: TL.segs.length, pal: st.pal || 'cyan' };
    let hl = {}, cam = 'all', diag = null, tok = [];
    st.beats.forEach((b, bi) => {
      if (b.hl !== undefined) hl = b.hl; else if (bi === 0) hl = {};
      if (b.cam !== undefined) cam = b.cam; else if (bi === 0) cam = st.cam || 'all';
      if (b.tok !== undefined) tok = b.tok; else if (bi === 0) tok = [];
      const acts = b.acts || [];
      let maxOff = 0;
      const evs = acts.map((a, i) => {
        let off, arr = a;
        if (typeof a[0] === 'number') { off = a[0]; arr = a.slice(1); } else off = 1.1 + 0.38 * i;
        maxOff = Math.max(maxOff, off);
        return { off, act: arr };
      });
      const len = plain(b.t).length;
      let dur = b.dur || (b.feed ? clamp(1.6 + len / 30 + 0.12 * acts.length, 2.4, 6) : clamp(2.4 + len / 15.5 + 0.22 * acts.length, 5.0, 19));
      dur = Math.max(dur, maxOff + 2.2);
      const beat = { t0: t, t1: t + dur, text: b.t, hl, cam, tok, idx: bi, seg, feed: !!b.feed, icon: b.icon, iconCol: b.iconCol };
      for (const e of evs) TL.events.push({ t: t + e.off, act: e.act });
      TL.audio.push({ t: t + 0.05, type: 'beat' });
      seg.beats.push(beat); TL.beats.push(beat);
      t += dur;
    });
    t += 0.6;
    seg.t1 = t;
    TL.events.push({ t: t - 0.5, act: ['stepFade'] });
    TL.events.push({ t: t - 0.02, act: ['stepClear'] });
    TL.segs.push(seg);
  }
  TL.total = t;
  TL.events.sort((a, b) => a.t - b.t);
  for (const e of TL.events) {
    const k = e.act[0];
    if (k === 'd') TL.audio.push({ t: e.t, type: 'place', v: e.act[2] });
    else if (k === 'in' || k === 'out') TL.audio.push({ t: e.t, type: k, n: e.act.length - 1 });
    else if (['let', 'bad', 'arr', 'ghost', 'ghostin', 'ghostout', 'demo'].includes(k)) TL.audio.push({ t: e.t, type: k, v: e.act[2] });
  }
  TL.audio.sort((a, b) => a.t - b.t);
})();

function stateAt(t) {
  const s = { st: {}, stAt: {}, dig: {}, dAt: {}, pm: {}, lv: {}, lvAt: {}, lc: {}, ghost: {}, gAt: {}, gin: {}, gout: {}, demo: {}, demoAt: -99,
    diag: null, badAt: -99, fadeAt: null, tags: [] };
  for (const e of TL.events) {
    if (e.t > t) break;
    const a = e.act;
    switch (a[0]) {
      case 'in': case 'out': {
        const cells = a.slice(1).flatMap(expandCells);
        cells.forEach((c, i) => { if (!s.st[c]) { s.st[c] = a[0]; s.stAt[c] = e.t + i * 0.045; } });
        break; }
      case 'd': s.dig[a[1]] = a[2]; s.dAt[a[1]] = e.t; delete s.pm[a[1]]; delete s.ghost[a[1]];
        if (!s.st[a[1]]) { s.st[a[1]] = 'in'; s.stAt[a[1]] = e.t; } break;
      case 'pm': s.pm[a[1]] = a[2]; break;
      case 'let': s.lv[a[1]] = a[2]; s.lvAt[a[1]] = e.t; break;
      case 'lc': s.lc[a[1]] = a[2]; break;
      case 'ghost': s.ghost[a[1]] = a[2]; s.gAt[a[1]] = e.t; break;
      case 'ghostin': a.slice(1).flatMap(expandCells).forEach((c, i) => { s.gin[c] = e.t + i * 0.04; }); break;
      case 'ghostout': a.slice(1).flatMap(expandCells).forEach((c, i) => { s.gout[c] = e.t + i * 0.04; }); break;
      case 'clearGhosts': s.ghost = {}; s.gin = {}; s.gout = {}; break;
      case 'demo': a.slice(1).flatMap(expandCells).forEach(c => { s.demo[c] = true; }); s.demoAt = e.t; break;
      case 'demoClear': s.demo = {}; break;
      case 'diag': s.diag = { spec: a[1], t: e.t, off: null }; break;
      case 'diagOff': if (s.diag && s.diag.off === null) s.diag.off = e.t; break;
      case 'bad': s.badAt = e.t; break;
      case 'tag': s.tags.push({ cell: a[1], text: a[2], t: e.t }); break;
      case 'stepFade': s.fadeAt = e.t; if (s.diag && s.diag.off === null) s.diag.off = e.t; break;
      case 'stepClear': s.ghost = {}; s.gin = {}; s.gout = {}; s.tags = []; s.fadeAt = null; s.demo = {}; break;
    }
  }
  return s;
}
const segAt = t => { let s = TL.segs[0]; for (const g of TL.segs) { if (g.t0 <= t) s = g; else break; } return s; };
const beatAt = t => { let b = null; for (const x of TL.beats) { if (x.t0 <= t) b = x; else break; } return b; };

// ───────────── board construction
const svg = $('grid'), cells = {};
(function buildBoard() {
  const gIn = $('gIn'), gOut = $('gOut'), gHl = $('gHl'), gLines = $('gLines'), gPm = $('gPm'), gGh = $('gGhost'), gD = $('gDig');
  for (let r = 1; r <= N; r++) for (let c = 1; c <= N; c++) {
    const id = cellId(r, c), x = (c - 1) * S, y = (r - 1) * S;
    const o = { r, c, x, y };
    o.fill = E('rect', { x: x + 1, y: y + 1, width: S - 2, height: S - 2, rx: 6, fill: 'url(#inGrad)', opacity: 0 }, gIn);
    o.shine = E('rect', { x: x + 1, y: y + 1, width: S - 2, height: S - 2, rx: 6, fill: 'url(#cellShine)', opacity: 0 }, gIn);
    o.out = E('rect', { x: x + 2, y: y + 2, width: S - 4, height: S - 4, rx: 6, fill: '#010208', opacity: 0 }, gOut);
    o.dot = E('circle', { cx: x + S / 2, cy: y + S / 2, r: 2.6, fill: '#5a6090', opacity: 0 }, gOut);
    o.hl = E('rect', { x: x + 2.5, y: y + 2.5, width: S - 5, height: S - 5, rx: 8, fill: 'none', 'stroke-width': 3, opacity: 0 }, gHl);
    o.gfill = E('rect', { x: x + 4, y: y + 4, width: S - 8, height: S - 8, rx: 7, fill: 'none', stroke: '#ff4fd8', 'stroke-width': 2.5, 'stroke-dasharray': '6 4', opacity: 0 }, gGh);
    o.gtxt = E('text', { x: x + S / 2, y: y + S / 2 + 11, 'text-anchor': 'middle', 'font-family': 'Unbounded', 'font-weight': 700, 'font-size': 30, fill: '#ff6be0', opacity: 0 }, gGh);
    o.pm = E('text', { x: x + S / 2, y: y + 19, 'text-anchor': 'middle', 'font-family': 'Mono', 'font-weight': 700, 'font-size': 13, fill: '#9fe9ff', opacity: 0, 'letter-spacing': 1 }, gPm);
    o.dg = E('text', { x: x + S / 2, y: y + S / 2 + 12, 'text-anchor': 'middle', 'font-family': 'Unbounded', 'font-weight': 700, 'font-size': 31, fill: '#ffffff', opacity: 0,
      style: 'paint-order:stroke', stroke: 'rgba(4,6,20,.85)', 'stroke-width': 5, 'stroke-linejoin': 'round' }, gD);
    cells[id] = o;
  }
  for (let i = 0; i <= N; i++) {
    E('line', { x1: i * S, y1: 0, x2: i * S, y2: N * S, stroke: 'rgba(150,165,255,.18)', 'stroke-width': 1 }, gLines);
    E('line', { x1: 0, y1: i * S, x2: N * S, y2: i * S, stroke: 'rgba(150,165,255,.18)', 'stroke-width': 1 }, gLines);
  }
  for (let i = 0; i <= N; i++) for (let j = 0; j <= N; j++) E('circle', { cx: i * S, cy: j * S, r: 1.6, fill: 'rgba(170,185,255,.45)' }, gLines);
  svg.loopGlow = E('path', { fill: 'none', stroke: '#4ff0ff', 'stroke-width': 7, 'stroke-linecap': 'round', opacity: 0.9 }, $('gLoopGlow'));
  svg.loopCore = E('path', { fill: 'none', stroke: '#eafcff', 'stroke-width': 3.2, 'stroke-linecap': 'round' }, $('gLoop'));
  svg.loopNew = E('path', { fill: 'none', stroke: '#ffffff', 'stroke-width': 4, 'stroke-linecap': 'round' }, $('gLoop'));
  svg.demoGlow = E('path', { fill: 'none', stroke: '#ff4fd8', 'stroke-width': 7, 'stroke-linecap': 'round', opacity: 0 }, $('gLoopGlow'));
  svg.demoCore = E('path', { fill: 'none', stroke: '#ffe3fb', 'stroke-width': 3, 'stroke-linecap': 'round', opacity: 0 }, $('gLoop'));
  svg.comet = E('circle', { r: 9, fill: '#ffffff', opacity: 0, filter: 'url(#neon)' }, $('gFx'));
  svg.tagPool = Array.from({ length: 4 }, () => { const g = E('g', { opacity: 0 }, $('gTags')); return { g, r: E('rect', { rx: 9, fill: '#ffd166' }, g), t: E('text', { 'text-anchor': 'middle', 'font-family': 'Mono', 'font-weight': 800, 'font-size': 17, fill: '#0a0b20' }, g) }; });
})();

// clue tiles
const tokEls = [];
(function buildClues() {
  const host = $('clues');
  const mk = (tok, x, y, key) => {
    const d = document.createElement('div'); d.className = 'tok';
    d.style.left = x + 'px'; d.style.top = y + 'px';
    d.innerHTML = tok.split('').map(ch => ch === '?' ? '<span class="q ch">?</span>' : `<span class="ch L" data-l="${ch}" style="color:${LCOL[ch]};text-shadow:0 0 10px ${LCOL[ch]}88">${ch}</span>`).join('');
    host.appendChild(d); tokEls.push({ el: d, tok, key, letters: [...d.querySelectorAll('.L')] });
    return d;
  };
  for (const c in COLS) {
    const toks = COLS[c], k = toks.length;
    toks.forEach((tk, i) => {
      const w = 18 + 14 * tk.length;
      mk(tk, GX + (c - 1) * S + S / 2 - w / 2, GY - 8 - 36 * (k - i), `C${c}:${i + 1}`).style.width = w + 'px';
    });
  }
  for (const r in ROWS) {
    const toks = ROWS[r], k = toks.length;
    toks.forEach((tk, i) => {
      const w = 18 + 14 * tk.length;
      mk(tk, GX - 10 - 50 * (k - i) + (50 - w), GY + (r - 1) * S + S / 2 - 16, `R${r}:${i + 1}`).style.width = w + 'px';
    });
  }
})();

// cipher strip
const ctiles = {};
(function buildCipher() {
  const host = $('cipher');
  for (const L of LETTERS) {
    const d = document.createElement('div'); d.className = 'ctile';
    d.innerHTML = `<div class="cface cfront"><div class="clet" style="color:${LCOL[L]};text-shadow:0 0 18px ${LCOL[L]}">${L}</div><div class="ccand"></div></div>
      <div class="cface cback" style="border-color:${LCOL[L]};box-shadow:0 0 22px ${LCOL[L]}66 inset, 0 0 18px ${LCOL[L]}55"><div class="cdig"></div><div class="clet2" style="color:${LCOL[L]}">${L}</div></div>`;
    host.appendChild(d);
    ctiles[L] = { el: d, front: d.querySelector('.cfront'), back: d.querySelector('.cback'), cand: d.querySelector('.ccand'), dig: d.querySelector('.cdig') };
  }
})();

// ───────────── camera
const VIEW = { x: 498, y: 556 };
function camTarget(spec) {
  // returns {fx, fy, z} in board coordinates
  const full = { fx: 470, fy: 440, z: 1.0 };
  if (!spec || spec === 'all') return full;
  let x0, y0, x1, y1;
  let m;
  if ((m = spec.match(/^C(\d+)$/))) { const c = +m[1]; x0 = GX + (c - 2) * S; x1 = GX + (c + 1) * S; y0 = 0; y1 = GY + N * S; }
  else if ((m = spec.match(/^R(\d+)$/))) { const r = +m[1]; x0 = 0; x1 = GX + N * S; y0 = GY + (r - 3) * S; y1 = GY + (r + 2) * S; }
  else if ((m = spec.match(/^r(\d+)c(\d+):r(\d+)c(\d+)$/))) { x0 = GX + (+m[2] - 1) * S - 30; y0 = GY + (+m[1] - 1) * S - 30; x1 = GX + +m[4] * S + 30; y1 = GY + +m[3] * S + 30; }
  else if ((m = spec.match(/^r(\d+)c(\d+)$/))) { x0 = GX + (+m[2] - 3) * S; y0 = GY + (+m[1] - 3) * S; x1 = GX + (+m[2] + 2) * S; y1 = GY + (+m[1] + 2) * S; }
  else return full;
  const w = x1 - x0, h = y1 - y0;
  const z = clamp(Math.min(900 / w, 980 / h), 1.0, 1.55);
  return { fx: (x0 + x1) / 2, fy: (y0 + y1) / 2, z };
}
function cameraAt(t) {
  // find current and previous camera spec by beats
  const b = beatAt(t);
  const seg = segAt(t);
  if (!b || seg.type === 'intro') return { fx: 470, fy: 440, z: 1.0, rx: 0, ry: 0 };
  const i = TL.beats.indexOf(b);
  const prev = i > 0 ? TL.beats[i - 1] : null;
  let cur = camTarget(seg.type === 'step' ? b.cam : 'all');
  if (seg.type === 'final') cur = camTarget('all');
  const pv = camTarget(prev ? prev.cam : 'all');
  const t0 = seg.type === 'step' ? b.t0 : seg.t0;
  const k = ease((t - t0) / 1.6);
  let fx = lerp(pv.fx, cur.fx, k), fy = lerp(pv.fy, cur.fy, k), z = lerp(pv.z, cur.z, k);
  // keep the board framed inside the view box [20,980]x[30,1046]
  const fit = (f, size, V, lo, hi) => {
    if (size * z <= hi - lo) return size / 2 + (V - (lo + hi) / 2) / z;
    return clamp(f, (V - lo) / z, size - (hi - V) / z);
  };
  fx = fit(fx, 884, VIEW.x, 20, 980); fy = fit(fy, 864, VIEW.y, 30, 1046);
  const ry = (fx - 470) / 450 * -7 + 1.2 * Math.sin(t * 0.21);
  const rx = (fy - 440) / 440 * 5 + 1.0 * Math.cos(t * 0.17) + 2.5;
  return { fx, fy, z, rx, ry };
}

// ───────────── particles (deterministic)
const fx = $('fx'), fctx = fx.getContext('2d');
const BURSTS = [];
function cellScreen(id) { const r = cells[id].fill.getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; }

// ───────────── HUD
let lastStep = -1, beatDivs = [], lastDiagKey = '';
function renderHUD(seg, t, s) {
  if (seg.type === 'step' && seg.idx !== lastStep) {
    lastStep = seg.idx;
    $('chap').textContent = seg.st.chapter;
    $('stepno').textContent = seg.st.rules ? 'The rules' : `Step ${seg.num} / ${seg.nReal}`;
    $('title').innerHTML = md(seg.st.title);
    const bi = $('beatsInner'); bi.innerHTML = '';
    beatDivs = seg.beats.map(b => { const d = document.createElement('div'); d.className = 'beat' + (b.feed ? ' feed' : ''); d.innerHTML = (b.icon ? `<span class="ic" style="color:${b.iconCol || '#4ff0ff'}">${b.icon}</span>` : '') + md(b.text); bi.appendChild(d); return d; });
  }
  if (seg.type !== 'step') return;
  const k0 = expo((t - seg.t0) / 0.8);
  $('title').style.opacity = k0; $('title').style.transform = `translateX(${(1 - k0) * -30}px)`;
  let cur = -1; seg.beats.forEach((b, i) => { if (b.t0 <= t) cur = i; });
  let curBottom = 0;
  beatDivs.forEach((d, i) => {
    const b = seg.beats[i];
    if (i > cur) { d.style.opacity = 0; d.style.visibility = 'hidden'; return; }
    d.style.visibility = 'visible';
    const k = eout((t - b.t0) / 0.6);
    d.style.opacity = i === cur ? k : lerp(1, b.feed ? 0.62 : 0.45, ease((t - seg.beats[i + 1].t0) / 0.6));
    d.style.transform = `translateY(${(1 - k) * 18}px)`; d.style.filter = `blur(${(1 - k) * 4}px)`;
    d.classList.toggle('cur', i === cur);
    curBottom = d.offsetTop + d.offsetHeight;
  });
  const H = 380;
  let target = Math.max(0, curBottom - H + 4), prevT = 0;
  if (cur > 0) { const pd = beatDivs[cur - 1]; prevT = Math.max(0, pd.offsetTop + pd.offsetHeight - H + 4); }
  const sc = cur >= 0 ? lerp(prevT, target, ease((t - seg.beats[cur].t0) / 0.7)) : 0;
  $('beatsInner').style.transform = `translateY(${-sc}px)`;
}

function renderDiagram(t, s) {
  const host = $('diagram');
  if (!s.diag) { host.style.opacity = 0; return; }
  const vis = s.diag.off === null ? eout((t - s.diag.t) / 0.6) : 1 - ease((t - s.diag.off) / 0.5);
  host.style.opacity = vis; host.style.transform = `translateY(${(1 - vis) * 20}px)`;
  const sp = s.diag.spec, u = t - s.diag.t;
  if (sp.type === 'arr') {
    const nShow = Math.min(sp.pats.length, Math.floor(u / 0.32) + 1);
    const showForced = u > sp.pats.length * 0.32 + 0.6;
    const key = sp.tag + nShow + showForced + s.diag.t;
    if (key !== lastDiagKey) {
      lastDiagKey = key;
      let h = `<div class="dhdr"><span>${lineName(sp.tag)} · every way to fit ${sp.clueText || ''}</span><span>${sp.pats.length}${sp.more ? '+' : ''} arrangement${sp.pats.length === 1 ? '' : 's'}</span></div>`;
      const maxRows = 7;
      const rows = sp.pats.slice(0, Math.min(nShow, maxRows));
      rows.forEach((p, i) => {
        h += `<div class="arow"><div class="alab">#${i + 1}</div>` + p.split('').map((ch, j) => `<div class="acell ${ch === '1' ? 'i' : 'o'}">${sp.digs && sp.digs[i] && sp.digs[i][j] ? sp.digs[i][j] : ''}</div>`).join('') + '</div>';
      });
      if (sp.pats.length > maxRows && nShow > maxRows) h += `<div class="arow"><div class="alab">…</div><div style="color:#8f95c4;font-size:15px">+${sp.pats.length - maxRows} more</div></div>`;
      if (showForced) {
        h += `<div class="arow" style="margin-top:12px"><div class="alab" style="color:#ffd166">FORCED</div>` + sp.forced.split('').map(ch => `<div class="acell ${ch === '1' ? 'fi' : ch === '0' ? 'fo' : 'u'}">${ch === '0' ? '×' : ch === '1' ? '●' : '?'}</div>`).join('') + '</div>';
      }
      host.innerHTML = h;
    }
  } else if (sp.type === 'eq') {
    const n = Math.min(sp.lines.length, Math.floor(u / 0.9) + 1);
    const key = 'eq' + n + s.diag.t;
    if (key !== lastDiagKey) {
      lastDiagKey = key;
      host.innerHTML = `<div class="dhdr"><span>${sp.title || 'Working'}</span><span></span></div><div class="eqcard">` +
        sp.lines.slice(0, n).map(l => `<div>${md(l)}</div>`).join('') + '</div>';
    }
  } else if (sp.type === 'html') {
    const key = 'html' + s.diag.t;
    if (key !== lastDiagKey) { lastDiagKey = key; host.innerHTML = sp.html; }
  }
}

function compactCand(str) {
  if (/[^0-9]/.test(str)) return str;
  const d = [...new Set(str.split('').map(Number))].sort((a, b) => a - b), out = [];
  for (let i = 0; i < d.length;) { let k = i; while (k + 1 < d.length && d[k + 1] === d[k] + 1) k++; out.push(k - i >= 2 ? `${d[i]}–${d[k]}` : d.slice(i, k + 1).join(',')); i = k + 1; }
  return out.join(',');
}
function renderCipher(t, s) {
  for (const L of LETTERS) {
    const T = ctiles[L];
    const v = s.lv[L];
    if (v !== undefined) {
      const u = t - s.lvAt[L];
      const ang = 180 * ease(u / 0.9);
      T.front.style.transform = `rotateY(${ang}deg)`; T.back.style.transform = `rotateY(${ang - 180}deg)`;
      T.dig.textContent = v;
      const pop = u < 1.4 ? 1 + 0.12 * Math.sin(clamp(u / 1.4) * Math.PI) : 1;
      T.el.style.transform = `scale(${pop}) translateY(${-10 * Math.sin(clamp(u / 0.9) * Math.PI)}px)`;
    } else {
      T.front.style.transform = 'rotateY(0deg)'; T.back.style.transform = 'rotateY(-180deg)'; T.el.style.transform = '';
      T.cand.textContent = s.lc[L] ? compactCand(s.lc[L]) : '0–9';
    }
  }
  // clue token letters -> digits
  for (const tk of tokEls) {
    for (const sp of tk.letters) {
      const L = sp.dataset.l, v = s.lv[L];
      if (v !== undefined) {
        const u = t - s.lvAt[L] - 0.5 - (tk.el.offsetLeft + tk.el.offsetTop) / 2400;
        if (u < 0) { sp.textContent = L; sp.style.transform = ''; continue; }
        const sy = u < 0.25 ? Math.cos(u / 0.25 * Math.PI / 2) : Math.sin(clamp((u - 0.25) / 0.25) * Math.PI / 2);
        sp.textContent = u < 0.25 ? L : String(v);
        sp.style.transform = `scaleY(${Math.max(0.02, sy)})`;
        sp.style.color = u < 0.25 ? LCOL[L] : '#ffffff';
        sp.style.textShadow = `0 0 ${u < 2 ? 22 : 10}px ${LCOL[L]}`;
      } else { sp.textContent = L; sp.style.transform = ''; sp.style.color = LCOL[L]; }
    }
    // finale: every clue resolves to its true total
    const fseg = TL.segs[TL.segs.length - 1];
    if (window.CLUE_VALUES && fseg.type === 'final') {
      const val = window.CLUE_VALUES[tk.key], chars = [...tk.el.querySelectorAll('.ch')];
      const u = t - fseg.t0 - 1.2 - (tk.el.offsetLeft + tk.el.offsetTop) / 900;
      chars.forEach((sp, i) => {
        if (!sp.classList.contains('q')) return;
        if (u < 0) { sp.textContent = '?'; sp.style.color = ''; sp.style.transform = ''; return; }
        const sy = u < 0.2 ? Math.cos(u / 0.2 * Math.PI / 2) : Math.sin(clamp((u - 0.2) / 0.2) * Math.PI / 2);
        sp.textContent = u < 0.2 ? '?' : val[i]; sp.style.transform = `scaleY(${Math.max(0.02, sy)})`;
        sp.style.color = u < 0.2 ? '' : '#ffd166'; sp.style.textShadow = u < 0.2 ? '' : '0 0 12px rgba(255,209,102,.8)';
      });
    } else { for (const sp of tk.el.querySelectorAll('.q')) { if (sp.textContent !== '?') { sp.textContent = '?'; sp.style.color = ''; sp.style.transform = ''; sp.style.textShadow = ''; } } }
  }
}

// ───────────── main board render
const DIRS = [[-1, 0, 'T'], [1, 0, 'B'], [0, -1, 'L'], [0, 1, 'R']];
function statusOf(s, r, c) { if (r < 1 || c < 1 || r > N || c > N) return 'out'; return s.st[cellId(r, c)] || null; }
function edgeSeg(r, c, dir) {
  const x = (c - 1) * S, y = (r - 1) * S;
  if (dir === 'T') return [x, y, x + S, y];
  if (dir === 'B') return [x, y + S, x + S, y + S];
  if (dir === 'L') return [x, y, x, y + S];
  return [x + S, y, x + S, y + S];
}
function loopEdges(s, t, useDemo) {
  const out = [];
  for (let r = 1; r <= N; r++) for (let c = 1; c <= N; c++) {
    const id = cellId(r, c);
    const me = useDemo ? (s.demo[id] ? 'in' : 'out') : statusOf(s, r, c);
    if (me !== 'in') continue;
    for (const [dr, dc, dir] of DIRS) {
      const nr = r + dr, nc = c + dc;
      const nb = useDemo ? (s.demo[cellId(nr, nc)] && nr >= 1 && nc >= 1 && nr <= N && nc <= N ? 'in' : 'out') : statusOf(s, nr, nc);
      if (nb === 'out') {
        let tt = s.stAt[id] || 0;
        if (!useDemo && nr >= 1 && nc >= 1 && nr <= N && nc <= N) tt = Math.max(tt, s.stAt[cellId(nr, nc)] || 0);
        out.push({ seg: edgeSeg(r, c, dir), t: useDemo ? s.demoAt : tt });
      }
    }
  }
  return out;
}

function renderBoard(t, s, seg, curBeat, prevBeat, kCur) {
  const fadeK = s.fadeAt !== null ? 1 - clamp((t - s.fadeAt) / 0.45) : 1;
  const hc = { gold: '#ffd166', cyan: '#4ff0ff', pink: '#ff4fd8', red: '#ff4f6e', green: '#5effc0', violet: '#a477ff' };
  const curH = {}, prevH = {};
  if (curBeat) for (const k in curBeat.hl) for (const sp of curBeat.hl[k]) for (const id of expandCells(sp)) curH[id] = hc[k];
  if (prevBeat) for (const k in prevBeat.hl) for (const sp of prevBeat.hl[k]) for (const id of expandCells(sp)) prevH[id] = hc[k];
  const pulse = 0.75 + 0.25 * Math.sin(t * 3.6);
  for (const id in cells) {
    const o = cells[id], st = s.st[id];
    // fills
    if (st === 'in') {
      const u = t - s.stAt[id];
      const k = back(u / 0.55);
      o.fill.setAttribute('opacity', 0.34 * clamp(u / 0.2) + 0.5 * Math.max(0, 1 - u / 0.8) * clamp(u / 0.1));
      o.fill.setAttribute('transform', `translate(${o.x + S / 2} ${o.y + S / 2}) scale(${lerp(0.2, 1, k)}) translate(${-o.x - S / 2} ${-o.y - S / 2})`);
      o.shine.setAttribute('opacity', clamp(u / 0.3));
      o.out.setAttribute('opacity', 0); o.dot.setAttribute('opacity', 0);
    } else if (st === 'out') {
      const u = t - s.stAt[id];
      o.fill.setAttribute('opacity', 0); o.shine.setAttribute('opacity', 0);
      o.out.setAttribute('opacity', 0.62 * clamp(u / 0.4)); o.dot.setAttribute('opacity', clamp(u / 0.4));
    } else { o.fill.setAttribute('opacity', 0); o.shine.setAttribute('opacity', 0); o.out.setAttribute('opacity', 0); o.dot.setAttribute('opacity', 0); }
    // highlights
    const a = curH[id], b = prevH[id];
    let col = null, op = 0;
    if (a && a === b) { col = a; op = curBeat ? 1 : 1 - kCur; }
    else if (a && kCur > 0.5) { col = a; op = kCur; }
    else if (b) { col = b; op = 1 - kCur; }
    if (col) { o.hl.setAttribute('stroke', col); o.hl.setAttribute('opacity', op * pulse); o.hl.setAttribute('fill', col + '22'); }
    else o.hl.setAttribute('opacity', 0);
    // digits
    const d = s.dig[id];
    if (d !== undefined) {
      const u = t - s.dAt[id];
      o.dg.textContent = d;
      o.dg.setAttribute('opacity', clamp(u / 0.12));
      const sc = lerp(0.2, 1, back(u / 0.5));
      o.dg.setAttribute('transform', `translate(${o.x + S / 2} ${o.y + S / 2}) scale(${sc}) translate(${-o.x - S / 2} ${-o.y - S / 2})`);
      o.dg.setAttribute('fill', u < 1.6 ? `rgb(255,${Math.round(lerp(209, 255, clamp((u - 0.4) / 1.2)))},${Math.round(lerp(102, 255, clamp((u - 0.4) / 1.2)))})` : '#ffffff');
    } else o.dg.setAttribute('opacity', 0);
    // pencil
    if (s.pm[id] !== undefined && d === undefined && s.ghost[id] === undefined) { o.pm.textContent = s.pm[id]; o.pm.setAttribute('opacity', 1); }
    else o.pm.setAttribute('opacity', 0);
    // ghosts
    const g = s.ghost[id];
    if (g !== undefined) { const u = t - s.gAt[id]; o.gtxt.textContent = g; o.gtxt.setAttribute('font-size', String(g).length > 2 ? 15 : String(g).length > 1 ? 20 : 30); o.gtxt.setAttribute('y', o.y + S / 2 + (String(g).length > 1 ? 7 : 11)); o.gtxt.setAttribute('opacity', clamp(u / 0.3) * fadeK); }
    else o.gtxt.setAttribute('opacity', 0);
    if (s.gin[id] !== undefined) { o.gfill.setAttribute('opacity', clamp((t - s.gin[id]) / 0.3) * fadeK); o.gfill.setAttribute('fill', 'rgba(255,79,216,.25)'); }
    else if (s.gout[id] !== undefined) { o.gfill.setAttribute('opacity', clamp((t - s.gout[id]) / 0.3) * fadeK); o.gfill.setAttribute('fill', 'rgba(0,0,0,.55)'); }
    else if (g !== undefined) { o.gfill.setAttribute('opacity', clamp((t - s.gAt[id]) / 0.3) * fadeK); o.gfill.setAttribute('fill', 'none'); }
    else o.gfill.setAttribute('opacity', 0);
  }
  // loop
  const edges = loopEdges(s, t, false);
  let dOld = '', dNew = '';
  for (const e of edges) {
    const u = t - e.t;
    if (u < 0) continue;
    const [x1, y1, x2, y2] = e.seg;
    if (u > 0.6) dOld += `M${x1} ${y1}L${x2} ${y2}`;
    else { const k = eout(u / 0.6), mx = (x1 + x2) / 2, my = (y1 + y2) / 2; dNew += `M${lerp(mx, x1, k)} ${lerp(my, y1, k)}L${lerp(mx, x2, k)} ${lerp(my, y2, k)}`; }
  }
  svg.loopCore.setAttribute('d', dOld); svg.loopGlow.setAttribute('d', dOld + dNew); svg.loopNew.setAttribute('d', dNew);
  // demo loop
  const demoEdges = Object.keys(s.demo).length ? loopEdges(s, t, true) : [];
  if (demoEdges.length) {
    const k = ease((t - s.demoAt) / 0.8);
    const dd = demoEdges.map(e => `M${e.seg[0]} ${e.seg[1]}L${e.seg[2]} ${e.seg[3]}`).join('');
    svg.demoGlow.setAttribute('d', dd); svg.demoCore.setAttribute('d', dd);
    svg.demoGlow.setAttribute('opacity', 0.9 * k * fadeK); svg.demoCore.setAttribute('opacity', k * fadeK);
  } else { svg.demoGlow.setAttribute('opacity', 0); svg.demoCore.setAttribute('opacity', 0); }
  // tags
  svg.tagPool.forEach((P, i) => {
    const T = s.tags[i];
    if (!T) { P.g.setAttribute('opacity', 0); return; }
    const [r, c] = parseCell(T.cell), u = t - T.t, w = 20 + 10.5 * T.text.length;
    const x = (c - 0.5) * S, y = (r - 1) * S - 6;
    P.r.setAttribute('x', x - w / 2); P.r.setAttribute('y', y - 28); P.r.setAttribute('width', w); P.r.setAttribute('height', 28);
    P.t.textContent = T.text; P.t.setAttribute('x', x); P.t.setAttribute('y', y - 8);
    P.g.setAttribute('opacity', clamp(u / 0.2) * fadeK);
    P.g.setAttribute('transform', `translate(${x} ${y}) scale(${0.4 + 0.6 * back(u / 0.45)}) translate(${-x} ${-y})`);
  });
  // token highlights
  const tk = new Set(curBeat ? curBeat.tok : []);
  for (const T of tokEls) {
    const on = tk.has(T.key) || tk.has(T.key.split(':')[0]);
    T.el.classList.toggle('hl', on);
  }
}

// ───────────── intro (three.js)
let three = null;
function initThree() {
  if (three || typeof THREE === 'undefined') return three;
  const cv = $('intro3d');
  const renderer = new THREE.WebGLRenderer({ canvas: cv, alpha: true, antialias: true, preserveDrawingBuffer: true });
  renderer.setPixelRatio(1); renderer.setSize(1920, 1080, false); renderer.setClearColor(0x000000, 0);
  const scene = new THREE.Scene();
  const cam = new THREE.PerspectiveCamera(42, 1920 / 1080, 0.1, 200);
  // grid
  const gm = new THREE.LineBasicMaterial({ color: 0x4ff0ff, transparent: true, opacity: 0.55, blending: THREE.AdditiveBlending });
  const pts = [];
  for (let i = 0; i <= 12; i++) { pts.push(i - 6, 0, -6, i - 6, 0, 6, -6, 0, i - 6, 6, 0, i - 6); }
  const gg = new THREE.BufferGeometry(); gg.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
  const grid = new THREE.LineSegments(gg, gm); scene.add(grid);
  // glowing trail along a rectilinear path (abstract, not the solution)
  const path = [[-6, -6], [-6, -2], [-3, -2], [-3, 1], [-5, 1], [-5, 5], [-1, 5], [-1, 3], [2, 3], [2, 6], [6, 6], [6, 0], [3, 0], [3, -3], [5, -3], [5, -6], [1, -6], [1, -4], [-2, -4], [-2, -6], [-6, -6]];
  const curvePts = path.map(([x, z]) => new THREE.Vector3(x, 0.02, z));
  const trailGeo = new THREE.BufferGeometry().setFromPoints(curvePts);
  const trail = new THREE.Line(trailGeo, new THREE.LineBasicMaterial({ color: 0xff4fd8, transparent: true, opacity: 0.95, blending: THREE.AdditiveBlending }));
  scene.add(trail);
  const sprTex = (() => { const c = document.createElement('canvas'); c.width = c.height = 128; const x = c.getContext('2d'); const g = x.createRadialGradient(64, 64, 0, 64, 64, 64);
    g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.25, 'rgba(255,120,240,.8)'); g.addColorStop(1, 'rgba(255,79,216,0)'); x.fillStyle = g; x.fillRect(0, 0, 128, 128); return new THREE.CanvasTexture(c); })();
  const head = new THREE.Sprite(new THREE.SpriteMaterial({ map: sprTex, blending: THREE.AdditiveBlending, transparent: true, depthWrite: false })); head.scale.set(1.6, 1.6, 1); scene.add(head);
  // letter cubes
  const cubes = [];
  for (let i = 0; i < 10; i++) {
    const L = LETTERS[i];
    const c = document.createElement('canvas'); c.width = c.height = 256; const x = c.getContext('2d');
    const g = x.createLinearGradient(0, 0, 256, 256); g.addColorStop(0, '#141a44'); g.addColorStop(1, '#080a20'); x.fillStyle = g; x.fillRect(0, 0, 256, 256);
    x.strokeStyle = LCOL[L]; x.lineWidth = 10; x.strokeRect(8, 8, 240, 240);
    x.fillStyle = LCOL[L]; x.font = '900 150px Unbounded'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.shadowColor = LCOL[L]; x.shadowBlur = 30; x.fillText(L, 128, 140);
    const tex = new THREE.CanvasTexture(c);
    const m = new THREE.Mesh(new THREE.BoxGeometry(1.1, 1.1, 1.1), new THREE.MeshBasicMaterial({ map: tex }));
    scene.add(m); cubes.push(m);
  }
  // dust
  const dp = []; for (let i = 0; i < 600; i++) dp.push((rnd(i, 1) - .5) * 40, (rnd(i, 2) - .2) * 16, (rnd(i, 3) - .5) * 40);
  const dg = new THREE.BufferGeometry(); dg.setAttribute('position', new THREE.Float32BufferAttribute(dp, 3));
  const dust = new THREE.Points(dg, new THREE.PointsMaterial({ color: 0x9fdfff, size: 0.06, transparent: true, opacity: 0.7, blending: THREE.AdditiveBlending }));
  scene.add(dust);
  three = { renderer, scene, cam, grid, trail, trailGeo, curvePts, head, cubes, dust, gm };
  return three;
}
function renderIntro(t, seg) {
  const T = initThree(); if (!T) return;
  const u = t - seg.t0, D = seg.t1 - seg.t0;
  // camera: orbit + descend to top-down
  const k = ease(u / (D - 1.5));
  const ang = lerp(-0.9, 0.0, k) + 0.15 * Math.sin(u * 0.4);
  const radius = lerp(17, 0.01, k), hgt = lerp(6, 21, k);
  T.cam.position.set(Math.sin(ang) * radius, hgt, Math.cos(ang) * radius + lerp(0, 0.01, k));
  T.cam.up.set(0, 1, 0); if (k > 0.98) T.cam.up.set(0, 0, -1);
  T.cam.lookAt(0, 0, 0);
  // trail draw
  const total = T.curvePts.length - 1, prog = clamp((u - 0.5) / 5.5) * total;
  const n = Math.floor(prog); T.trailGeo.setDrawRange(0, n + 1);
  const a = T.curvePts[Math.min(n, total)], b = T.curvePts[Math.min(n + 1, total)], f = prog - n;
  T.head.position.set(lerp(a.x, b.x, f), 0.1, lerp(a.z, b.z, f));
  T.head.material.opacity = clamp(u / 0.5) * (1 - clamp((u - 6.2) / 0.8));
  T.trail.material.opacity = 0.95 * (1 - clamp((u - 7) / 1.5));
  T.gm.opacity = 0.55 * clamp(u / 1.0);
  // cubes orbit then align in a row above grid
  T.cubes.forEach((m, i) => {
    const th = i / 10 * Math.PI * 2 + u * 0.55;
    const orbit = new THREE.Vector3(Math.cos(th) * 7.5, 2.5 + Math.sin(u * 1.3 + i) * 0.6, Math.sin(th) * 7.5);
    const row = new THREE.Vector3((i - 4.5) * 1.35, 3.5, -7.6);
    const kk = ease((u - 4.2 - i * 0.06) / 2.2);
    m.position.lerpVectors(orbit, row, kk);
    m.rotation.set(u * 1.1 * (1 - kk) + i, u * 0.9 * (1 - kk) + i * 0.5, 0);
    if (kk > 0.99) m.rotation.set(-Math.PI / 2 * clamp((u - 6.5) / 0.8), 0, 0);
    m.scale.setScalar(clamp(u / 0.8 - i * 0.05) * 1.0);
  });
  T.dust.rotation.y = u * 0.03;
  T.renderer.render(T.scene, T.cam);
}

// ───────────── chapter / title / finale
function renderChapter(t, seg) {
  const cc = $('chapterCard');
  if (!seg || seg.type !== 'chapter') { cc.style.opacity = 0; return; }
  const u = t - seg.t0, D = seg.t1 - seg.t0;
  cc.style.opacity = ease(u / 0.4) * (1 - ease((u - (D - 0.5)) / 0.5));
  const parts = seg.name.split(' · ');
  const num = parts.length > 1 ? parts[0] : '', name = parts.length > 1 ? parts[1] : parts[0];
  if ($('ccName').dataset.n !== name) {
    $('ccName').dataset.n = name;
    $('ccName').innerHTML = name.split('').map(ch => `<span>${ch === ' ' ? '&nbsp;' : ch}</span>`).join('');
    $('ccNum').textContent = num.toUpperCase(); $('ccSub').textContent = seg.sub || '';
  }
  [...$('ccName').children].forEach((sp, i) => {
    const k = back((u - 0.15 - i * 0.035) / 0.6);
    sp.style.opacity = clamp((u - 0.15 - i * 0.035) / 0.25);
    sp.style.transform = `translateY(${(1 - k) * 60}px) rotateX(${(1 - k) * 70}deg)`;
  });
  $('ccNum').style.letterSpacing = `${lerp(1.2, 0.5, expo(u / 1.2))}em`;
  $('ccBar').style.transform = `scaleX(${expo((u - 0.3) / 1.2)})`;
  $('ccSub').style.opacity = clamp((u - 0.9) / 0.6);
}
function renderTitle(t, seg) {
  const to = $('titleOver');
  if (seg.type !== 'intro') { to.style.opacity = 0; return; }
  const u = t - seg.t0, D = seg.t1 - seg.t0;
  const vis = clamp((u - 6.3) / 0.6) * (1 - clamp((u - (D - 0.7)) / 0.7));
  to.style.opacity = vis;
  if (!$('tMain').children.length) $('tMain').innerHTML = 'CIPHER LOOP'.split('').map(ch => `<span>${ch === ' ' ? '&nbsp;' : ch}</span>`).join('');
  [...$('tMain').children].forEach((sp, i) => {
    const k = back((u - 6.4 - i * 0.05) / 0.7);
    sp.style.transform = `translateY(${(1 - k) * 80}px) scale(${lerp(1.6, 1, k)})`; sp.style.opacity = clamp((u - 6.4 - i * 0.05) / 0.3);
    sp.style.color = '#fff'; sp.style.textShadow = `0 0 ${30 + 20 * Math.sin(u * 3 + i)}px rgba(79,240,255,.7), 0 0 80px rgba(255,79,216,.5)`;
  });
  $('tKick').style.letterSpacing = `${lerp(1.4, 0.6, expo((u - 6.3) / 1.4))}em`;
}

// ───────────── particles
function renderFx(t, s, seg) {
  fctx.clearRect(0, 0, 1920, 1080);
  fctx.globalCompositeOperation = 'lighter';
  // bursts for recent digit placements and status changes
  for (const id in s.dAt) {
    const u = t - s.dAt[id]; if (u < 0 || u > 1.1) continue;
    const [cx, cy] = cellScreen(id), n = 22;
    for (let i = 0; i < n; i++) {
      const seed = parseInt(id.slice(1)) * 31 + i;
      const ang = i / n * Math.PI * 2 + rnd(seed, 1), sp = 90 + 190 * rnd(seed, 2);
      const x = cx + Math.cos(ang) * sp * u, y = cy + Math.sin(ang) * sp * u + 60 * u * u;
      const a = (1 - u / 1.1);
      fctx.fillStyle = `rgba(255,${180 + Math.round(60 * rnd(seed, 3))},${90 + Math.round(120 * rnd(seed, 4))},${a})`;
      fctx.beginPath(); fctx.arc(x, y, 2.2 + 1.5 * rnd(seed, 5), 0, Math.PI * 2); fctx.fill();
    }
  }
  for (const L in s.lvAt) {
    const u = t - s.lvAt[L]; if (u < 0 || u > 1.4) continue;
    const r = ctiles[L].el.getBoundingClientRect(), cx = r.left + r.width / 2, cy = r.top + r.height / 2;
    for (let i = 0; i < 40; i++) {
      const seed = L.charCodeAt(0) * 97 + i, ang = rnd(seed, 1) * Math.PI * 2, sp = 120 + 260 * rnd(seed, 2);
      const x = cx + Math.cos(ang) * sp * u, y = cy + Math.sin(ang) * sp * u;
      fctx.fillStyle = LCOL[L] + Math.round(255 * (1 - u / 1.4)).toString(16).padStart(2, '0');
      fctx.beginPath(); fctx.arc(x, y, 2.5, 0, Math.PI * 2); fctx.fill();
    }
  }
  // finale confetti
  if (seg.type === 'final') {
    const u = t - seg.t0;
    for (let i = 0; i < 260; i++) {
      const v = u - rnd(i, 4) * 8; if (v < 0) continue;
      const x = rnd(i, 1) * 1920 + 60 * Math.sin(v * 2 + i), y = -40 + v * (180 + 220 * rnd(i, 2));
      if (y > 1100) continue;
      const cols = ['#4ff0ff', '#ff4fd8', '#ffd166', '#5effc0', '#a477ff'];
      fctx.fillStyle = cols[i % 5]; fctx.save(); fctx.translate(x, y); fctx.rotate(v * 4 + i); fctx.fillRect(-6, -3, 12 * Math.cos(v * 6 + i), 6); fctx.restore();
    }
  }
  fctx.globalCompositeOperation = 'source-over';
}

// ───────────── master render
let curPal = null;
function palAt(t) {
  // blend palettes across segment boundaries
  const seg = segAt(t), i = TL.segs.indexOf(seg);
  const P = n => PALETTES[n] || PALETTES.cyan;
  const pn = seg.pal || (seg.type === 'intro' ? 'violet' : seg.type === 'final' ? 'gold' : 'cyan');
  const prev = i > 0 ? (TL.segs[i - 1].pal || 'violet') : pn;
  const k = ease((t - seg.t0) / 2.0);
  return [0, 1, 2].map(j => [0, 1, 2].map(c => lerp(P(prev)[j][c], P(pn)[j][c], k)));
}
function renderAt(t) {
  const seg = segAt(t);
  const s = stateAt(t);
  // background
  const inten = seg.type === 'chapter' ? lerp(0.55, 1.0, Math.sin(clamp((t - seg.t0) / (seg.t1 - seg.t0)) * Math.PI))
              : seg.type === 'intro' ? 0.85 : seg.type === 'final' ? 0.9 : 0.5;
  const flash = t - s.badAt < 0.8 ? Math.exp(-(t - s.badAt) * 5) : 0;
  BG.draw(t, palAt(t), 0.7, flash, [0.26, 0.5], inten);
  // intro
  const introSeg = TL.segs[0];
  $('intro3d').style.opacity = seg.type === 'intro' ? 1 - clamp((t - (introSeg.t1 - 1.2)) / 1.2) : 0;
  if (seg.type === 'intro') renderIntro(t, seg);
  renderTitle(t, seg);
  // world visibility
  const worldIn = clamp((t - (introSeg.t1 - 1.3)) / 1.3);
  $('world').style.opacity = worldIn; $('hud').style.opacity = clamp((t - introSeg.t1 + 0.2) / 1.0);
  // camera
  const cam = cameraAt(t);
  let jx = 0, jy = 0;
  const bu = t - s.badAt;
  if (bu < 0.7) { jx = 10 * Math.sin(bu * 55) * Math.exp(-bu * 6); jy = 6 * Math.cos(bu * 47) * Math.exp(-bu * 6); }
  const intro = 1 - ease(clamp((t - (introSeg.t1 - 1.3)) / 1.6));
  const board = $('board');
  board.style.transformOrigin = `${cam.fx}px ${cam.fy}px`;
  board.style.transform = `translate(${VIEW.x - cam.fx + jx}px, ${VIEW.y - cam.fy + jy}px) rotateX(${cam.rx + 30 * intro}deg) rotateY(${cam.ry}deg) scale(${cam.z * (1 - 0.15 * intro)})`;
  board.style.filter = bu < 0.9 ? `drop-shadow(${-8 * Math.exp(-bu * 4)}px 0 0 rgba(255,40,80,.8)) drop-shadow(${8 * Math.exp(-bu * 4)}px 0 0 rgba(40,240,255,.8))` : 'none';
  $('scan').style.opacity = bu < 1.0 ? 0.8 * Math.exp(-bu * 3) : 0;
  // beats & board
  const curBeat = seg.type === 'step' ? beatAt(t) : null;
  let prevBeat = null, kCur = 1;
  if (curBeat) { const i = TL.beats.indexOf(curBeat); prevBeat = i > 0 ? TL.beats[i - 1] : null; kCur = ease((t - curBeat.t0) / 0.45); }
  else { const pb = beatAt(t); if (pb && seg.type !== 'intro') { prevBeat = pb; kCur = ease((t - seg.t0) / 0.45); } }
  renderBoard(t, s, seg, curBeat, prevBeat, kCur);
  renderCipher(t, s);
  renderHUD(seg.type === 'step' ? seg : (curBeat ? curBeat.seg : seg), t, s);
  renderDiagram(t, s);
  $('badge').style.opacity = bu < 3 ? clamp(bu / 0.15) * (1 - clamp((bu - 2.4) / 0.6)) : 0;
  renderChapter(t, seg);
  // finale
  const fin = $('finale');
  if (seg.type === 'final') {
    const u = t - seg.t0;
    fin.style.opacity = ease((u - 0.8) / 0.8); $('card').style.opacity = 1 - ease(u / 0.8);
    fin.querySelectorAll('.fItem').forEach((el, i) => { const k = ease((u - 2.2 - i * 1.4) / 0.7); el.style.opacity = k; el.style.transform = `translateX(${(1 - k) * 40}px)`; });
    $('fCipher').textContent = LETTERS.split('').map(L => `${L}=${s.lv[L] ?? '?'}`).join(' ');
    // comet along loop
    if (window.LOOP_PATH) {
      const P = window.LOOP_PATH, n = P.length - 1, prog = ((u * 0.55) % 1) * n, i0 = Math.floor(prog), f = prog - i0;
      const a = P[i0], b = P[Math.min(i0 + 1, n)];
      svg.comet.setAttribute('cx', lerp(a[0], b[0], f)); svg.comet.setAttribute('cy', lerp(a[1], b[1], f)); svg.comet.setAttribute('opacity', clamp(u / 0.5));
    }
  } else { fin.style.opacity = 0; $('card').style.opacity = 1; svg.comet.setAttribute('opacity', 0); }
  renderFx(t, s, seg);
  $('prog').style.opacity = 0.9 * clamp((t - introSeg.t1) / 1.0);
  $('progFill').style.width = (1824 * clamp(t / TL.total)) + 'px';
}
(function ticks() { for (const g of TL.segs) if (g.type === 'chapter') { const d = document.createElement('div'); d.className = 'ptick'; d.style.left = (1824 * g.t0 / TL.total) + 'px'; $('prog').appendChild(d); } })();

window.TL = TL; window.renderAt = renderAt; window.TOTAL = TL.total;
})();
