/* Deterministic animation engine: window.renderAt(t) draws the frame at time t (seconds). */
(function () {
'use strict';
const S = 80, NS = 'http://www.w3.org/2000/svg';
const $ = id => document.getElementById(id);
function E(tag, attrs, parent) {
  const e = document.createElementNS(NS, tag);
  if (attrs) for (const k in attrs) e.setAttribute(k, attrs[k]);
  if (parent) parent.appendChild(e);
  return e;
}
const clamp = (x, a = 0, b = 1) => Math.max(a, Math.min(b, x));
const ease = x => { x = clamp(x); return x < .5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2; };
const easeOut = x => { x = clamp(x); return 1 - Math.pow(1 - x, 3); };
const backOut = x => { x = clamp(x); const c1 = 1.9, c3 = c1 + 1; return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2); };
const lerp = (a, b, k) => a + (b - a) * k;
function mixHex(h1, h2, k) {
  const p = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16));
  const a = p(h1), b = p(h2);
  return '#' + a.map((v, i) => Math.round(lerp(v, b[i], clamp(k))).toString(16).padStart(2, '0')).join('');
}

// ───────── geometry & naming
function rc(id) {
  if (id[0] === 'r') return [+id[1], +id[3]];
  const k = +id.slice(1);
  return ({ T: [0, k], B: [10, k], L: [k, 0], R: [k, 10] })[id[0]];
}
const X = c => (c + 0.5) * S, Y = r => (r + 0.5) * S;
function ringPos(id) { const k = +id.slice(1); return ({ T: k, R: 9 + k, B: 28 - k, L: 37 - k })[id[0]]; }
function ringLabel(id) { const k = id.slice(1); return ({ T: '↓C', B: '↑C', L: '→R', R: '←R' })[id[0]] + k; }
const RING = [];
for (let c = 1; c <= 9; c++) RING.push('T' + c);
for (let r = 1; r <= 9; r++) RING.push('R' + r);
for (let c = 9; c >= 1; c--) RING.push('B' + c);
for (let r = 9; r >= 1; r--) RING.push('L' + r);
const CELLS = [];
for (let r = 1; r <= 9; r++) for (let c = 1; c <= 9; c++) CELLS.push(`r${r}c${c}`);
const ALL = CELLS.concat(RING);
function readingCells(id) {
  const k = +id.slice(1), out = [];
  for (let i = 1; i <= 9; i++) {
    if (id[0] === 'T') out.push(`r${i}c${k}`);
    if (id[0] === 'B') out.push(`r${10 - i}c${k}`);
    if (id[0] === 'L') out.push(`r${k}c${i}`);
    if (id[0] === 'R') out.push(`r${k}c${10 - i}`);
  }
  return out;
}
const LINES = {
  outer: { type: 'index', pts: (() => { const p = []; for (let c = 1; c <= 9; c++) p.push([0, c]); for (let r = 1; r <= 9; r++) p.push([r, 10]); for (let c = 9; c >= 1; c--) p.push([10, c]); for (let r = 9; r >= 1; r--) p.push([r, 0]); return p; })() },
  inner: { type: 'index', pts: [[4, 3], [4, 2], [5, 3], [5, 4], [5, 5], [4, 5], [3, 5], [4, 4], [3, 3]] },
  z1: { type: 'zip', pts: [[1, 1], [1, 2], [1, 3], [1, 4], [1, 5], [1, 6], [1, 7], [1, 8], [1, 9]], c: [1, 5] },
  z2: { type: 'zip', pts: [[2, 7], [3, 8], [4, 9], [3, 9], [2, 10]], c: [4, 9] },
  z3: { type: 'zip', pts: [[3, 1], [4, 1], [5, 0]], c: [4, 1] },
  z4: { type: 'zip', pts: [[6, 2], [7, 2], [8, 3], [9, 3], [9, 4], [9, 5], [8, 6], [8, 7], [8, 8]], c: [9, 4] },
  z5: { type: 'zip', pts: [[6, 5], [7, 5], [7, 6]], c: [7, 5] },
  z6: { type: 'zip', pts: [[8, 1], [7, 1], [8, 0], [9, 1], [8, 2]], c: [8, 0] },
  z7: { type: 'zip', pts: [[9, 7], [9, 8], [9, 9]], c: [9, 8] },
};
const COL = { turq: '#5fd6f7', lav: '#cd9bf0', ink: '#1e2448', teal: '#0b6f8c', gold: '#d98a00' };
const HL = { gold: '#ffc23d', red: '#ff5d73', green: '#34d399', blue: '#6aa6ff', purple: '#b98bff', teal: '#3cc9ee' };
const BUCKET_COL = ['#ff8fa3', '#ffb86b', '#ffd166', '#c5e86c', '#5be3a8', '#4fd6d0', '#62b7fa', '#9b9cff', '#cf9ef0'];
const pathD = pts => pts.map((p, i) => (i ? 'L' : 'M') + X(p[1]).toFixed(1) + ' ' + Y(p[0]).toFixed(1)).join(' ');

// ───────── text markup
function md(s) {
  s = s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  s = s.replace(/\[(r\dc\d)\]/g, (m, id) => `<span class="pill cell">${id.toUpperCase()}</span>`);
  s = s.replace(/\{([TBLR]\d)\}/g, (m, id) => `<span class="pill clue">${ringLabel(id)}</span>`);
  s = s.replace(/\*\*(.+?)\*\*/g, '<b>$1</b>');
  s = s.replace(/\^(.+?)\^/g, '<span class="hi">$1</span>');
  s = s.replace(/!!(.+?)!!/g, '<span class="bad">$1</span>');
  s = s.replace(/%%(.+?)%%/g, '<span class="ok">$1</span>');
  return s;
}
const plain = s => s.replace(/\[(r\dc\d)\]/g, 'R0C0').replace(/\{([TBLR]\d)\}/g, 'xx0').replace(/\*\*|\^|!!|%%/g, '');

// ───────── timeline
const TL = { segs: [], events: [], beats: [], total: 0, audio: [] };
(function build() {
  let t = 0, prevCh = null, num = 0;
  const nReal = STEPS.filter(s => !s.kind && !s.chapter.startsWith('The Rules')).length;
  for (const st of STEPS) {
    if (st.kind === 'title') { TL.segs.push({ type: 'title', t0: t, t1: t + st.dur }); TL.audio.push({ t: 0.4, type: 'intro' }); t += st.dur; continue; }
    if (st.kind === 'final') { TL.segs.push({ type: 'final', t0: t, t1: t + st.dur }); TL.audio.push({ t, type: 'final' }); t += st.dur; continue; }
    if (st.chapter !== prevCh) {
      const d = 3.4;
      TL.segs.push({ type: 'chapter', t0: t, t1: t + d, name: st.chapter });
      TL.audio.push({ t, type: 'chapter' });
      t += d; prevCh = st.chapter;
    }
    const rules = st.chapter.startsWith('The Rules');
    const seg = { type: 'step', t0: t, st, beats: [], num: rules ? 0 : ++num, nReal, rules, idx: TL.segs.length };
    let hl = {}, glow = [], lad = [];
    st.beats.forEach((b, bi) => {
      if (b.hl !== undefined) hl = b.hl; else if (bi === 0) hl = {};
      if (b.glow !== undefined) glow = b.glow; else if (bi === 0) glow = [];
      if (b.lad !== undefined) lad = b.lad; else if (bi === 0) lad = [];
      const acts = b.acts || [];
      let maxOff = 0;
      const evs = acts.map((a, i) => {
        let off, arr = a;
        if (typeof a[0] === 'number') { off = a[0]; arr = a.slice(1); } else off = 1.15 + 0.42 * i;
        maxOff = Math.max(maxOff, off);
        return { off, act: arr };
      });
      const len = plain(b.t).length;
      let dur = b.dur || clamp(2.3 + len / 15.5 + 0.25 * acts.length, 5.0, 19);
      dur = Math.max(dur, maxOff + 2.4);
      const beat = { t0: t, t1: t + dur, text: b.t, hl, glow, lad, idx: bi, seg };
      for (const e of evs) TL.events.push({ t: t + e.off, act: e.act });
      TL.audio.push({ t: t + 0.05, type: 'beat' });
      seg.beats.push(beat); TL.beats.push(beat);
      t += dur;
    });
    t += 0.7;
    seg.t1 = t;
    TL.events.push({ t: t - 0.5, act: ['stepFade'] });
    TL.events.push({ t: t - 0.02, act: ['stepClear'] });
    TL.segs.push(seg);
  }
  TL.total = t;
  TL.events.sort((a, b) => a.t - b.t);
  for (const e of TL.events) {
    const k = e.act[0];
    if (['place', 'rv', 'bad', 'arc', 'x', 'ghost'].includes(k)) TL.audio.push({ t: e.t, type: k, v: e.act[2] });
  }
  TL.audio.sort((a, b) => a.t - b.t);
})();

function stateAt(t) {
  const s = { dig: {}, dAt: {}, pm: {}, ring: {}, rv: {}, rvAt: {}, ghost: {}, gAt: {}, gStyle: {}, arcs: [], xs: [], tags: {},
    arrows: [], cmp: null, ladder: false, ladderAt: -99, pos: false, posAt: -99, inner: false, innerAt: -99, badAt: -99, fadeAt: null };
  for (const e of TL.events) {
    if (e.t > t) break;
    const a = e.act;
    switch (a[0]) {
      case 'place': {
        s.dig[a[1]] = a[2]; s.dAt[a[1]] = e.t; delete s.pm[a[1]]; delete s.ghost[a[1]];
        const r = +a[1][1], c = +a[1][3], d = String(a[2]);
        for (const k in s.pm) {
          if ((+k[1] === r || +k[3] === c) && /^[0-9]+$/.test(s.pm[k]) && s.pm[k].includes(d)) {
            const rest = s.pm[k].split(d).join('');
            if (rest) s.pm[k] = rest; else delete s.pm[k];
          }
        }
        break; }
      case 'pm': s.pm[a[1]] = a[2]; break;
      case 'ring': s.ring[a[1]] = a[2]; break;
      case 'rv': s.rv[a[1]] = a[2]; s.rvAt[a[1]] = e.t; delete s.ring[a[1]]; break;
      case 'ghost': s.ghost[a[1]] = a[2]; s.gAt[a[1]] = e.t; s.gStyle[a[1]] = a[3] || 'bad'; break;
      case 'clearGhosts': s.ghost = {}; break;
      case 'arc': s.arcs.push({ a: a[1], b: a[2], t: e.t }); break;
      case 'x': s.xs.push({ c: a[1], t: e.t }); break;
      case 'bad': s.badAt = e.t; break;
      case 'tag': s.tags[a[1]] = { text: a[2], t: e.t }; break;
      case 'arrow': s.arrows.push({ id: a[1], t: e.t }); break;
      case 'cmp': s.cmp = { groups: a[1], hi: a[2] || [], t: e.t, off: null }; break;
      case 'cmpOff': if (s.cmp && s.cmp.off === null) s.cmp.off = e.t; break;
      case 'ladder': s.ladder = !!a[1]; s.ladderAt = e.t; break;
      case 'posnums': s.pos = !!a[1]; s.posAt = e.t; break;
      case 'innerNums': s.inner = !!a[1]; s.innerAt = e.t; break;
      case 'stepFade': s.fadeAt = e.t; if (s.cmp && s.cmp.off === null) s.cmp.off = e.t; break;
      case 'stepClear': s.ghost = {}; s.tags = {}; s.arrows = []; s.xs = []; s.fadeAt = null; break;
    }
  }
  return s;
}

// ───────── build SVG scene
const svg = $('grid');
const G = id => $(id);
const cellEls = {};
(function scene() {
  const bg = G('gBg');
  for (let r = 0; r <= 10; r++) for (let c = 0; c <= 10; c++) {
    const corner = (r === 0 || r === 10) && (c === 0 || c === 10);
    const ring = !corner && (r === 0 || r === 10 || c === 0 || c === 10);
    E('rect', { x: c * S, y: r * S, width: S, height: S, fill: corner ? '#fbfaf7' : ring ? '#eef4f8' : '#ffffff' }, bg);
  }
  const thin = G('gLinesThin');
  for (let i = 0; i <= 11; i++) {
    E('line', { x1: i * S, y1: 0, x2: i * S, y2: 11 * S, stroke: '#cdd2de', 'stroke-width': 1.3 }, thin);
    E('line', { x1: 0, y1: i * S, x2: 11 * S, y2: i * S, stroke: '#cdd2de', 'stroke-width': 1.3 }, thin);
  }
  E('rect', { x: S, y: S, width: 9 * S, height: 9 * S, fill: 'none', stroke: COL.ink, 'stroke-width': 5, 'stroke-linejoin': 'round' }, thin);

  const gl = G('gGlow'), ln = G('gLines');
  for (const id in LINES) {
    const L = LINES[id], col = L.type === 'index' ? COL.turq : COL.lav;
    L.glowEl = E('path', { d: pathD(L.pts), fill: 'none', stroke: L.type === 'index' ? '#22c3f2' : '#b16cf0', 'stroke-width': S * 0.55, 'stroke-linecap': 'round', 'stroke-linejoin': 'round', opacity: 0 }, gl);
    L.el = E('path', { d: pathD(L.pts), fill: 'none', stroke: col, 'stroke-width': S * 0.155, 'stroke-linecap': 'round', 'stroke-linejoin': 'round', opacity: 0.92 }, ln);
    L.len = L.el.getTotalLength();
    if (L.type === 'index') {
      const [r, c] = L.pts[0], h = S * 0.37;
      L.mark = E('polygon', { points: `${X(c)},${Y(r) - h} ${X(c) + h},${Y(r)} ${X(c)},${Y(r) + h} ${X(c) - h},${Y(r)}`, fill: col }, ln);
    } else {
      L.mark = E('circle', { cx: X(L.c[1]), cy: Y(L.c[0]), r: S * 0.3, fill: col }, ln);
    }
  }
  const hlA = G('gHlA'), hlB = G('gHlB'), pos = G('gPos'), pen = G('gPencil'), gh = G('gGhost'), vals = G('gVals'), burst = G('gBurst');
  for (const id of ALL) {
    const [r, c] = rc(id), x = c * S, y = r * S;
    const o = { id, r, c, ring: id[0] !== 'r' };
    o.hA = E('rect', { x: x + 2, y: y + 2, width: S - 4, height: S - 4, rx: 9, fill: 'none', opacity: 0, 'stroke-width': 3.5 }, hlA);
    o.hB = E('rect', { x: x + 2, y: y + 2, width: S - 4, height: S - 4, rx: 9, fill: 'none', opacity: 0, 'stroke-width': 3.5 }, hlB);
    o.burst = E('circle', { cx: X(c), cy: Y(r), r: 10, fill: 'none', 'stroke-width': 4, opacity: 0 }, burst);
    o.pm = E('text', { x: X(c), y: o.ring ? Y(r) + 6 : y + 23, 'text-anchor': 'middle', 'font-size': o.ring ? 17 : 19, 'font-weight': 600,
      fill: o.ring ? '#0b6f8c' : '#3f63c9', 'font-style': o.ring ? 'italic' : 'normal', 'letter-spacing': o.ring ? 0 : 3,
      'paint-order': 'stroke', stroke: '#ffffff', 'stroke-width': 5, 'stroke-linejoin': 'round', opacity: 0 }, pen);
    o.ghRect = E('rect', { x: x + 13, y: y + 13, width: S - 26, height: S - 26, rx: 11, fill: 'none', 'stroke-width': 2.5, 'stroke-dasharray': '6 5', opacity: 0 }, gh);
    o.gh = E('text', { x: X(c), y: Y(r) + 16, 'text-anchor': 'middle', 'font-size': 44, 'font-weight': 700, 'font-style': 'italic', opacity: 0,
      'paint-order': 'stroke', stroke: '#ffffff', 'stroke-width': 6, 'stroke-linejoin': 'round' }, gh);
    o.val = E('text', { x: X(c), y: o.ring ? Y(r) + 11 : Y(r) + 16.5, 'text-anchor': 'middle', 'font-size': o.ring ? 32 : 46, 'font-weight': o.ring ? 800 : 600,
      fill: o.ring ? '#0b6f8c' : COL.ink, 'paint-order': 'stroke', stroke: o.ring ? '#eef4f8' : '#ffffff', 'stroke-width': 7, 'stroke-linejoin': 'round', opacity: 0 }, vals);
    if (o.ring) {
      o.pos = E('text', { x: x + 6, y: y + 16, 'font-size': 12.5, 'font-weight': 700, fill: '#8692ae', opacity: 0 }, pos);
      o.pos.textContent = ringPos(id);
    }
    cellEls[id] = o;
  }
  // inner index numbers
  const inn = G('gInnerNums');
  LINES.inner.numEls = LINES.inner.pts.map(([r, c], i) => {
    const e = E('text', { x: (c + 1) * S - 7, y: (r + 1) * S - 7, 'text-anchor': 'end', 'font-size': 15, 'font-weight': 800, fill: '#0e86ab', opacity: 0,
      'paint-order': 'stroke', stroke: '#fff', 'stroke-width': 4 }, inn);
    e.textContent = i + 1; return e;
  });
  // pools
  const arcs = G('gArcs');
  svg.arcPool = Array.from({ length: 8 }, () => ({
    p: E('path', { fill: 'none', stroke: '#0891b2', 'stroke-width': 5, 'stroke-linecap': 'round', opacity: 0 }, arcs),
    a: E('circle', { r: 7, fill: '#0891b2', opacity: 0 }, arcs), b: E('circle', { r: 7, fill: '#0891b2', opacity: 0 }, arcs) }));
  const fx = G('gFx');
  svg.xPool = Array.from({ length: 4 }, () => ({
    l1: E('line', { stroke: '#e5484d', 'stroke-width': 8, 'stroke-linecap': 'round', opacity: 0 }, fx),
    l2: E('line', { stroke: '#e5484d', 'stroke-width': 8, 'stroke-linecap': 'round', opacity: 0 }, fx) }));
  const tags = G('gTags');
  svg.tagPool = Array.from({ length: 3 }, () => {
    const g = E('g', { opacity: 0 }, tags);
    return { g, r: E('rect', { rx: 10, fill: '#1e2448' }, g), t: E('text', { 'text-anchor': 'middle', 'font-size': 20, 'font-weight': 800, fill: '#ffd166' }, g) };
  });
  const arr = G('gArrows');
  svg.arrowPool = Array.from({ length: 3 }, () => ({
    l: E('path', { fill: 'none', stroke: '#f2a900', 'stroke-width': 7, 'stroke-linecap': 'round', opacity: 0 }, arr),
    h: E('path', { fill: '#f2a900', opacity: 0 }, arr) }));
  const conf = G('gConfetti');
  svg.confetti = Array.from({ length: 220 }, (_, i) => {
    const rnd = k => { const x = Math.sin((i + 1) * 12.9898 + k * 78.233) * 43758.5453; return x - Math.floor(x); };
    return { el: E('rect', { width: 10 + 8 * rnd(1), height: 6 + 5 * rnd(2), rx: 2, fill: ['#ffc23d', '#5fd6f7', '#cd9bf0', '#ff5d73', '#34d399', '#6aa6ff'][i % 6], opacity: 0 }, conf),
      x0: -40 + 960 * rnd(3), delay: rnd(4) * 7.5, vy: 260 + 260 * rnd(5), sway: 20 + 40 * rnd(6), ph: rnd(7) * 6.28, spin: (rnd(8) - .5) * 720, w: rnd(9) };
  });
})();

// ───────── ladder
const ladder = $('ladder');
const ladEls = { rows: [], slots: {} };
(function buildLadder() {
  ladder.innerHTML = `<div class="lhdr"><span>Rank ladder</span><span>first digit d  →  ranks 4d−3 … 4d</span></div>`;
  for (let d = 1; d <= 9; d++) {
    const row = document.createElement('div'); row.className = 'lrow';
    row.innerHTML = `<div class="glowbar"></div><div class="ldig" style="background:${BUCKET_COL[d - 1]}">${d}</div>`;
    for (let k = 0; k < 4; k++) {
      const rk = 4 * d - 3 + k;
      const sl = document.createElement('div'); sl.className = 'slot';
      sl.innerHTML = `<span class="rk">${rk}</span><span class="chip" style="opacity:0"></span>`;
      row.appendChild(sl); ladEls.slots[rk] = sl.querySelector('.chip');
    }
    ladder.appendChild(row); ladEls.rows.push(row);
  }
})();

// ───────── helpers for current beat
function segAt(t) { let s = TL.segs[0]; for (const g of TL.segs) { if (g.t0 <= t) s = g; else break; } return s; }
function beatAt(t) { let b = null; for (const x of TL.beats) { if (x.t0 <= t) b = x; else break; } return b; }

let lastStepIdx = -1, beatDivs = [], lastCmpKey = '', lastLadKey = '';
const panelBeats = $('beatsInner');

function renderPanel(seg, t, s) {
  if (seg.type === 'step' && seg.idx !== lastStepIdx) {
    lastStepIdx = seg.idx;
    $('chap').textContent = seg.st.chapter;
    $('stepno').textContent = seg.rules ? '' : `Step ${seg.num} of ${seg.nReal}`;
    $('title').innerHTML = md(seg.st.title);
    panelBeats.innerHTML = '';
    beatDivs = seg.beats.map(b => { const d = document.createElement('div'); d.className = 'beat'; d.innerHTML = md(b.text); panelBeats.appendChild(d); return d; });
  }
  if (seg.type !== 'step') return;
  const k0 = ease((t - seg.t0) / 0.6);
  $('title').style.opacity = k0; $('title').style.transform = `translateY(${(1 - k0) * 14}px)`;
  $('rule').style.transform = `scaleX(${ease((t - seg.t0 - 0.1) / 0.9)})`;
  // beats
  let curIdx = -1;
  seg.beats.forEach((b, i) => { if (b.t0 <= t) curIdx = i; });
  let visH = 0, curBottom = 0;
  beatDivs.forEach((d, i) => {
    const b = seg.beats[i];
    if (i > curIdx) { d.style.opacity = 0; d.style.visibility = 'hidden'; return; }
    d.style.visibility = 'visible';
    const k = easeOut((t - b.t0) / 0.6);
    const op = i === curIdx ? k : lerp(1, 0.46, ease((t - seg.beats[i + 1].t0) / 0.6));
    d.style.opacity = op;
    d.style.transform = `translateY(${(1 - k) * 16}px)`;
    d.classList.toggle('cur', i === curIdx);
    curBottom = d.offsetTop + d.offsetHeight;
  });
  const areaH = 400;
  // smooth scroll: compute target offset at this time from the current beat's layout, eased in from beat start
  let target = Math.max(0, curBottom - areaH + 6);
  let prevTarget = 0;
  if (curIdx > 0) { const pd = beatDivs[curIdx - 1]; prevTarget = Math.max(0, pd.offsetTop + pd.offsetHeight - areaH + 6); }
  const sc = curIdx >= 0 ? lerp(prevTarget, target, ease((t - seg.beats[curIdx].t0) / 0.7)) : 0;
  panelBeats.style.transform = `translateY(${-sc}px)`;
}

function renderLadder(t, s, curBeat, prevBeat, kCur) {
  const show = s.ladder ? ease((t - s.ladderAt) / 0.8) : 0;
  const cmpVis = s.cmp ? (s.cmp.off === null ? ease((t - s.cmp.t) / 0.5) : 1 - ease((t - s.cmp.off) / 0.5)) : 0;
  ladder.style.opacity = show * (1 - cmpVis);
  ladder.style.transform = `translateY(${(1 - show) * 20}px)`;
  // chips
  for (const id of RING) {
    const v = s.rv[id];
    if (v === undefined) continue;
    const chip = ladEls.slots[v];
    if (chip.textContent !== ringLabel(id)) chip.textContent = ringLabel(id);
    const k = backOut((t - s.rvAt[id]) / 0.55);
    chip.style.opacity = clamp((t - s.rvAt[id]) / 0.3);
    chip.style.transform = `scale(${0.4 + 0.6 * k})`;
  }
  for (const rk in ladEls.slots) {
    const chip = ladEls.slots[rk];
    const owner = RING.find(id => s.rv[id] === +rk);
    if (!owner) chip.style.opacity = 0;
  }
  // bucket highlight
  const ladCur = curBeat ? curBeat.lad : [], ladPrev = prevBeat ? prevBeat.lad : [];
  const pulse = 0.85 + 0.15 * Math.sin(t * 3.4);
  ladEls.rows.forEach((row, i) => {
    const d = i + 1;
    let a = (ladCur.includes(d) ? kCur : 0) + (ladPrev.includes(d) ? 1 - kCur : 0);
    if (ladCur.includes(d) && ladPrev.includes(d)) a = 1;
    a = clamp(a) * pulse;
    const gb = row.firstChild;
    gb.style.borderColor = `rgba(255,209,102,${0.85 * a})`;
    gb.style.background = `rgba(255,209,102,${0.10 * a})`;
  });
}

function renderCompare(t, s) {
  const cmpEl = $('compare');
  if (!s.cmp) { cmpEl.style.opacity = 0; return; }
  const vis = s.cmp.off === null ? ease((t - s.cmp.t) / 0.5) : 1 - ease((t - s.cmp.off) / 0.5);
  cmpEl.style.opacity = vis;
  cmpEl.style.transform = `translateY(${(1 - vis) * 18}px)`;
  // content signature
  const groups = s.cmp.groups.map(g => g.slice().sort((a, b) => (s.rv[a] ?? 99) - (s.rv[b] ?? 99)));
  const fresh = new Set();
  const sig = JSON.stringify(groups) + '|' + groups.flat().map(id => readingCells(id).map(c => {
    if (s.dig[c] !== undefined && t - s.dAt[c] < 1.2) fresh.add(c);
    return (s.dig[c] ?? '·') + (fresh.has(c) ? '*' : '');
  }).join('')).join('|') + '|' + groups.flat().map(id => s.rv[id] ?? '?').join(',') + s.cmp.t;
  if (sig === lastCmpKey) return;
  lastCmpKey = sig;
  let html = '<div class="lhdr"><span>Compare digit by digit</span><span>smaller rank on top</span></div>';
  groups.forEach((g, gi) => {
    if (gi) html += '<div class="cgap"></div>';
    g.forEach((id, ri) => {
      html += `<div class="crow"><div class="lt">${ri ? '&lt;' : ''}</div><div class="lab"><span class="pill clue">${ringLabel(id)}</span></div>`;
      html += `<div class="rkb">${s.rv[id] !== undefined ? '#' + s.rv[id] : ''}</div>`;
      readingCells(id).forEach((c, i) => {
        const d = s.dig[c];
        const cls = 'dbox' + (d === undefined ? ' unk' : '') + (s.cmp.hi.includes(i) ? ' hl' : '');
        const style = fresh.has(c) ? ' style="background:rgba(255,194,61,.55);border-color:#ffc23d"' : '';
        html += `<div class="${cls}"${style}>${d === undefined ? '?' : d}</div>`;
      });
      html += '</div>';
    });
  });
  cmpEl.innerHTML = html;
}

// ───────── main render
function renderAt(t) {
  const seg = segAt(t);
  // background drift
  $('blob1').style.transform = `translate(${-250 + 120 * Math.sin(t * 0.07)}px, ${-300 + 90 * Math.cos(t * 0.05)}px)`;
  $('blob2').style.transform = `translate(${1150 + 140 * Math.cos(t * 0.06)}px, ${300 + 110 * Math.sin(t * 0.045)}px)`;
  $('blob3').style.transform = `translate(${500 + 200 * Math.sin(t * 0.03 + 1)}px, ${520 + 80 * Math.cos(t * 0.04)}px)`;
  $('dots').style.backgroundPosition = `${(t * 3) % 28}px ${(t * 2) % 28}px`;

  const s = stateAt(t);
  const first = TL.segs[0];
  // title intro: card scale/draw
  const intro = clamp((t - 0.2) / 1.2);
  const card = $('card');
  let shake = 0;
  if (t - s.badAt < 0.7) { const u = t - s.badAt; shake = 9 * Math.sin(u * 46) * Math.exp(-u * 6.5); }
  card.style.opacity = easeOut(intro);
  card.style.transform = `translateX(${shake}px) scale(${lerp(0.94, 1, easeOut(intro))})`;
  const flash = t - s.badAt < 1.4 ? Math.exp(-(t - s.badAt) * 2.6) : 0;
  $('cardFlash').style.boxShadow = `0 0 0 ${6 * flash}px rgba(255,93,115,${0.9 * flash}), 0 0 60px ${20 * flash}px rgba(255,93,115,${0.35 * flash})`;

  // line draw-in during title
  const drawK = t < first.t1 + 1 ? ease((t - 0.8) / 3.0) : 1;
  for (const id in LINES) {
    const L = LINES[id];
    if (drawK < 1) { L.el.setAttribute('stroke-dasharray', `${L.len} ${L.len}`); L.el.setAttribute('stroke-dashoffset', L.len * (1 - drawK)); }
    else { L.el.removeAttribute('stroke-dasharray'); L.el.removeAttribute('stroke-dashoffset'); }
    L.mark.setAttribute('opacity', clamp((drawK - 0.15) * 3) * 0.95);
  }

  // overlays
  const titleSeg = TL.segs[0];
  const tb = $('titleBox');
  const tIn = ease((t - 0.6) / 1.0), tOut = 1 - ease((t - (titleSeg.t1 - 0.9)) / 0.8);
  tb.style.opacity = t < titleSeg.t1 ? tIn * tOut : 0;
  tb.style.transform = `translateY(${(1 - tIn) * 24}px)`;
  const panel = $('panel');
  const panelIn = ease((t - titleSeg.t1 + 0.1) / 0.8);
  const finalSeg = TL.segs[TL.segs.length - 1];
  const panelOut = finalSeg.type === 'final' ? 1 - ease((t - finalSeg.t0) / 0.8) : 1;
  panel.style.opacity = panelIn * panelOut;

  const cc = $('chapterCard');
  if (seg.type === 'chapter') {
    const u = t - seg.t0, d = seg.t1 - seg.t0;
    const k = ease(u / 0.55) * (1 - ease((u - (d - 0.6)) / 0.6));
    cc.style.opacity = k;
    const parts = seg.name.split(' · ');
    $('ccNum').textContent = parts.length > 1 ? parts[0] : '';
    $('ccName').textContent = parts.length > 1 ? parts[1] : parts[0];
    $('ccName').style.transform = `translateY(${(1 - ease(u / 0.8)) * 30}px)`;
    $('ccName').style.letterSpacing = `${lerp(0.06, 0, ease(u / 1.2))}em`;
    $('ccLine').style.transform = `scaleX(${ease((u - 0.2) / 1.0)})`;
  } else cc.style.opacity = 0;

  const fb = $('finalBox');
  if (seg.type === 'final') {
    const u = t - seg.t0;
    fb.style.opacity = ease((u - 0.6) / 0.8);
    fb.querySelectorAll('.fbItem').forEach((el, i) => {
      const k = ease((u - 2.0 - i * 1.3) / 0.7);
      el.style.opacity = k; el.style.transform = `translateX(${(1 - k) * 30}px)`;
    });
    $('fbThanks').style.opacity = ease((u - 8.0) / 1.0);
  } else fb.style.opacity = 0;

  // beat highlighting
  const curBeat = seg.type === 'step' ? beatAt(t) : null;
  let prevBeat = null, kCur = 1;
  if (curBeat) {
    const i = TL.beats.indexOf(curBeat);
    prevBeat = i > 0 ? TL.beats[i - 1] : null;
    kCur = ease((t - curBeat.t0) / 0.45);
  } else {
    const pb = beatAt(t);
    if (pb && seg.type !== 'title') { prevBeat = pb; kCur = ease((t - seg.t0) / 0.45); }
  }
  const curHl = {}, prevHl = {};
  if (curBeat) for (const col in curBeat.hl) for (const id of curBeat.hl[col]) curHl[id] = HL[col];
  if (prevBeat) for (const col in prevBeat.hl) for (const id of prevBeat.hl[col]) prevHl[id] = HL[col];
  const pulse = 0.40 + 0.10 * Math.sin(t * 3.4);
  const fadeK = s.fadeAt !== null ? 1 - clamp((t - s.fadeAt) / 0.45) : 1;

  for (const id of ALL) {
    const o = cellEls[id];
    const a = curHl[id], b = prevHl[id];
    if (a && b === a) { o.hA.setAttribute('fill', a); o.hA.setAttribute('stroke', a); o.hA.setAttribute('opacity', pulse * 1.0 * (curBeat ? 1 : 1 - kCur)); o.hB.setAttribute('opacity', 0); }
    else {
      if (a) { o.hA.setAttribute('fill', a); o.hA.setAttribute('stroke', a); o.hA.setAttribute('opacity', pulse * kCur); } else o.hA.setAttribute('opacity', 0);
      if (b) { o.hB.setAttribute('fill', b); o.hB.setAttribute('stroke', b); o.hB.setAttribute('opacity', pulse * (1 - kCur)); } else o.hB.setAttribute('opacity', 0);
    }
    // values
    if (!o.ring) {
      const d = s.dig[id];
      if (d !== undefined) {
        const u = t - s.dAt[id];
        o.val.textContent = d;
        o.val.setAttribute('opacity', clamp(u / 0.15));
        const sc = lerp(0.3, 1, backOut(u / 0.5));
        o.val.setAttribute('transform', `translate(${X(o.c)} ${Y(o.r)}) scale(${sc}) translate(${-X(o.c)} ${-Y(o.r)})`);
        o.val.setAttribute('fill', mixHex('#e09400', COL.ink, (u - 0.5) / 1.4));
        const bu = u / 0.7;
        if (bu < 1) { o.burst.setAttribute('r', lerp(S * 0.28, S * 0.78, easeOut(bu))); o.burst.setAttribute('stroke', '#ffb703'); o.burst.setAttribute('opacity', 0.75 * (1 - bu)); }
        else o.burst.setAttribute('opacity', 0);
      } else { o.val.setAttribute('opacity', 0); o.burst.setAttribute('opacity', 0); }
    } else {
      const v = s.rv[id];
      if (v !== undefined) {
        const u = t - s.rvAt[id];
        o.val.textContent = v;
        o.val.setAttribute('opacity', clamp(u / 0.15));
        const sc = lerp(0.3, 1, backOut(u / 0.5));
        o.val.setAttribute('transform', `translate(${X(o.c)} ${Y(o.r)}) scale(${sc}) translate(${-X(o.c)} ${-Y(o.r)})`);
        o.val.setAttribute('fill', mixHex('#e09400', '#0b6f8c', (u - 0.5) / 1.4));
        const bu = u / 0.7;
        if (bu < 1) { o.burst.setAttribute('r', lerp(S * 0.28, S * 0.8, easeOut(bu))); o.burst.setAttribute('stroke', '#22c3f2'); o.burst.setAttribute('opacity', 0.8 * (1 - bu)); }
        else o.burst.setAttribute('opacity', 0);
      } else { o.val.setAttribute('opacity', 0); o.burst.setAttribute('opacity', 0); }
      // position numbers
      const i = RING.indexOf(id);
      o.pos.setAttribute('opacity', s.pos ? clamp((t - s.posAt - i * 0.045) / 0.35) : 0);
    }
    // pencil marks
    const pmText = o.ring ? s.ring[id] : s.pm[id];
    if (pmText !== undefined && s.ghost[id] === undefined && !(o.ring ? s.rv[id] !== undefined : s.dig[id] !== undefined)) {
      o.pm.textContent = pmText; o.pm.setAttribute('opacity', 1);
    } else o.pm.setAttribute('opacity', 0);
    // ghosts
    const g = s.ghost[id];
    if (g !== undefined) {
      const u = t - s.gAt[id], col = s.gStyle[id] === 'ex' ? '#0f8fb3' : '#e5484d';
      const op = clamp(u / 0.3) * fadeK;
      o.gh.textContent = g; o.gh.setAttribute('fill', col); o.gh.setAttribute('opacity', op);
      o.ghRect.setAttribute('stroke', col); o.ghRect.setAttribute('opacity', op * 0.9);
    } else { o.gh.setAttribute('opacity', 0); o.ghRect.setAttribute('opacity', 0); }
  }
  // inner index numbers
  const innerK = s.inner ? clamp((t - s.innerAt) / 0.6) : 1 - clamp((t - s.innerAt) / 0.4);
  LINES.inner.numEls.forEach((e, i) => e.setAttribute('opacity', clamp(innerK * 1.6 - i * 0.07)));
  // glows
  const gCur = curBeat ? curBeat.glow : [], gPrev = prevBeat ? prevBeat.glow : [];
  for (const id in LINES) {
    let a = (gCur.includes(id) ? kCur : 0) + (gPrev.includes(id) ? 1 - kCur : 0);
    if (gCur.includes(id) && gPrev.includes(id)) a = curBeat ? 1 : 1 - kCur;
    LINES[id].glowEl.setAttribute('opacity', clamp(a) * (0.55 + 0.15 * Math.sin(t * 3.4)));
  }
  // arcs
  const liveArcs = s.arcs.filter(a => t - a.t < 6.2).slice(-8);
  svg.arcPool.forEach((P, i) => {
    const A = liveArcs[i];
    if (!A) { P.p.setAttribute('opacity', 0); P.a.setAttribute('opacity', 0); P.b.setAttribute('opacity', 0); return; }
    const [r1, c1] = rc(A.a), [r2, c2] = rc(A.b);
    const x1 = X(c1), y1 = Y(r1), x2 = X(c2), y2 = Y(r2);
    const mx = (x1 + x2) / 2, my = (y1 + y2) / 2;
    const ringy = A.a[0] !== 'r';
    let qx, qy;
    if (ringy) { qx = mx + 0.55 * (440 - mx); qy = my + 0.55 * (440 - my); }
    else { const dx = x2 - x1, dy = y2 - y1; qx = mx - dy * 0.35; qy = my + dx * 0.35; }
    P.p.setAttribute('d', `M${x1} ${y1} Q${qx} ${qy} ${x2} ${y2}`);
    const len = P.p.getTotalLength(), u = t - A.t;
    const draw = ease(u / 0.9), op = clamp(u / 0.2) * (1 - clamp((u - 5.0) / 1.0));
    P.p.setAttribute('stroke-dasharray', `${len} ${len}`); P.p.setAttribute('stroke-dashoffset', len * (1 - draw));
    P.p.setAttribute('opacity', 0.85 * op);
    P.a.setAttribute('cx', x1); P.a.setAttribute('cy', y1); P.a.setAttribute('opacity', op);
    P.b.setAttribute('cx', x2); P.b.setAttribute('cy', y2); P.b.setAttribute('opacity', draw > 0.98 ? op : 0);
  });
  // crosses
  svg.xPool.forEach((P, i) => {
    const xx = s.xs[i];
    if (!xx) { P.l1.setAttribute('opacity', 0); P.l2.setAttribute('opacity', 0); return; }
    const [r, c] = rc(xx.c), u = t - xx.t, k1 = ease(u / 0.3), k2 = ease((u - 0.2) / 0.3), m = S * 0.28;
    const x = X(c), y = Y(r);
    P.l1.setAttribute('x1', x - m); P.l1.setAttribute('y1', y - m); P.l1.setAttribute('x2', x - m + 2 * m * k1); P.l1.setAttribute('y2', y - m + 2 * m * k1);
    P.l2.setAttribute('x1', x + m); P.l2.setAttribute('y1', y - m); P.l2.setAttribute('x2', x + m - 2 * m * k2); P.l2.setAttribute('y2', y - m + 2 * m * k2);
    P.l1.setAttribute('opacity', (k1 > 0 ? 0.95 : 0) * fadeK); P.l2.setAttribute('opacity', (k2 > 0 ? 0.95 : 0) * fadeK);
  });
  // tags
  const tagIds = Object.keys(s.tags);
  svg.tagPool.forEach((P, i) => {
    const id = tagIds[i];
    if (!id) { P.g.setAttribute('opacity', 0); return; }
    const T = s.tags[id], [r, c] = rc(id), u = t - T.t;
    P.t.textContent = T.text;
    const w = 18 + 12 * T.text.length, h = 32;
    let x = X(c), y = r * S - 4;
    if (c === 0) x = X(c) + 8;
    if (c === 10) x = X(c) - 8;
    P.r.setAttribute('x', x - w / 2); P.r.setAttribute('y', y - h); P.r.setAttribute('width', w); P.r.setAttribute('height', h);
    P.t.setAttribute('x', x); P.t.setAttribute('y', y - 9);
    const k = backOut(u / 0.45);
    P.g.setAttribute('opacity', clamp(u / 0.2) * fadeK);
    P.g.setAttribute('transform', `translate(${x} ${y}) scale(${0.5 + 0.5 * k}) translate(${-x} ${-y})`);
  });
  // arrows
  svg.arrowPool.forEach((P, i) => {
    const A = s.arrows[i];
    if (!A) { P.l.setAttribute('opacity', 0); P.h.setAttribute('opacity', 0); return; }
    const [r, c] = rc(A.id); let x1, y1, x2, y2, dx = 0, dy = 0;
    if (A.id[0] === 'L') { x1 = S * 1.15; y1 = Y(r); x2 = S * 9.6; y2 = y1; dx = 1; }
    if (A.id[0] === 'R') { x1 = S * 9.85; y1 = Y(r); x2 = S * 1.4; y2 = y1; dx = -1; }
    if (A.id[0] === 'T') { x1 = X(c); y1 = S * 1.15; x2 = x1; y2 = S * 9.6; dy = 1; }
    if (A.id[0] === 'B') { x1 = X(c); y1 = S * 9.85; x2 = x1; y2 = S * 1.4; dy = -1; }
    const u = t - A.t, k = ease(u / 1.1);
    const xe = lerp(x1, x2, k), ye = lerp(y1, y2, k);
    P.l.setAttribute('d', `M${x1} ${y1} L${xe} ${ye}`);
    const hs = 20, px = -dy, py = dx;
    P.h.setAttribute('d', `M${xe + dx * hs} ${ye + dy * hs} L${xe + px * hs * 0.75} ${ye + py * hs * 0.75} L${xe - px * hs * 0.75} ${ye - py * hs * 0.75} Z`);
    const op = clamp(u / 0.2) * 0.8 * fadeK;
    P.l.setAttribute('opacity', op); P.h.setAttribute('opacity', op);
  });
  // confetti
  if (seg.type === 'final') {
    const u = t - seg.t0;
    svg.confetti.forEach(c => {
      const v = u - c.delay;
      if (v < 0) { c.el.setAttribute('opacity', 0); return; }
      const y = -60 + v * c.vy, x = c.x0 + c.sway * Math.sin(v * 2.2 + c.ph);
      c.el.setAttribute('x', 0); c.el.setAttribute('y', 0);
      c.el.setAttribute('transform', `translate(${x} ${y}) rotate(${c.spin * v}) scale(${Math.cos(v * 5 + c.ph)} 1)`);
      c.el.setAttribute('opacity', y > 940 ? 0 : 0.95);
    });
    // wave of colour across digits
    for (const id of CELLS) {
      const o = cellEls[id], w = Math.sin((u * 3.2) - (o.r + o.c) * 0.55);
      if (u > 1.0 && u < 9) o.val.setAttribute('fill', mixHex(COL.ink, '#e09400', clamp(w) * clamp((u - 1) / 1) * (1 - clamp((u - 8) / 1))));
    }
  } else svg.confetti.forEach(c => c.el.setAttribute('opacity', 0));

  // badge
  const bu = t - s.badAt;
  $('badge').style.opacity = bu < 3.2 ? clamp(bu / 0.15) * (1 - clamp((bu - 2.6) / 0.6)) : 0;
  $('badge').style.transform = `scale(${bu < 3.2 ? lerp(0.6, 1, backOut(bu / 0.4)) : 1})`;

  renderPanel(seg.type === 'step' ? seg : (curBeat ? curBeat.seg : seg), t, s);
  renderLadder(t, s, curBeat, prevBeat, kCur);
  renderCompare(t, s);
}

(function ticks() {
  const pr = $('prog');
  for (const g of TL.segs) if (g.type === 'chapter') {
    const d = document.createElement('div'); d.className = 'ptick'; d.style.left = (1816 * g.t0 / TL.total) + 'px'; pr.appendChild(d);
  }
})();
const _render = renderAt;
renderAt = function (t) {
  _render(t);
  $('prog').style.opacity = 0.9 * ease((t - TL.segs[0].t1 + 0.2) / 1.0);
  $('progFill').style.width = (1816 * clamp(t / TL.total)) + 'px';
};
window.TL = TL;
window.renderAt = renderAt;
window.TOTAL = TL.total;
})();
