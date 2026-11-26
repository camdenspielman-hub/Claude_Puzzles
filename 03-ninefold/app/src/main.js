/* Ninefold — game controller: acts, stages, seeds, manuscript, input, saving, transitions. */
(function () {
  const $ = (s) => document.querySelector(s);
  const app = $('#app');
  const D = NF.DATA;
  const sleep = (ms) => new Promise(r => setTimeout(r, ms));
  // One save slot per act, so visiting another act never costs the current one its progress.
  // v1 kept a single slot; it is migrated on first load.
  const SAVE_KEY = 'ninefold-save-v2';
  const OLD_SAVE_KEY = 'ninefold-save-v1';

  const Game = {
    act: 0, stage: 0, grid: null, busy: false, rendered: [], fog: null,
    unlocked: 0, started: performance.now(),
  };
  NF.Game = Game;

  /* ------------------------------------------------------------------ storage */
  function migrate(old) {
    const s = { v: 2, act: old.act || 0, unlocked: Math.max(old.unlocked || 0, old.act || 0), sound: old.sound !== false, panels: old.panels || null, acts: {} };
    for (let j = 0; j < Math.max(s.act, s.unlocked); j++) if (j !== s.act) s.acts[j] = { solved: true };
    if (old.stage != null) s.acts[s.act] = { stage: old.stage, cells: old.cells || null, size: old.size || 0, fog: old.fog || null };
    return s;
  }
  // a copy in memory: with storage blocked (private windows, blocked site data) the acts still
  // keep their progress for as long as the page is open
  let mem = null, warnedStorage = false;
  function load() {
    const fromMem = () => (mem ? JSON.parse(JSON.stringify(mem)) : null);
    if (mem && mem.unsaved) return fromMem();
    try {
      const raw = localStorage.getItem(SAVE_KEY);
      if (raw) { const s = JSON.parse(raw); if (s && s.v === 2) { s.acts = s.acts || {}; return s; } }
      const old = JSON.parse(localStorage.getItem(OLD_SAVE_KEY) || 'null');
      if (old && old.act != null) return migrate(old);
    } catch (e) { return fromMem(); }
    return fromMem();
  }
  function store(s) {
    mem = JSON.parse(JSON.stringify(s));
    try {
      localStorage.setItem(SAVE_KEY, JSON.stringify(s));
      localStorage.removeItem(OLD_SAVE_KEY);
    } catch (e) {
      mem.unsaved = true; // storage unavailable: keep playing from memory
      if (!warnedStorage) { warnedStorage = true; setTimeout(() => toast('Progress can\u2019t be saved in this window; it lasts until you close it.', 5200), 1200); }
    }
  }
  function save() {
    const s = load() || { v: 2, acts: {} };
    s.v = 2;
    if (!Game.leaving) s.act = Game.act; // mid-transition the save already points at the next act
    s.unlocked = Math.max(Game.unlocked, s.unlocked || 0);
    s.sound = !app.classList.contains('muted');
    s.seedHints = seedHints();
    const act = D.acts[Game.act];
    if (act && act.island) {
      if (NF.Island && NF.Island.active) s.panels = NF.Island.saveState();
    } else if (Game.grid && !Game.leaving) {
      const g = Game.grid;
      const slot = s.acts[Game.act] || {};
      slot.stage = Game.prelude ? -1 : Game.stage;
      slot.size = g.N;
      slot.cells = g.cells.map(c => c.given ? null : [c.v, c.corner, c.centreMarks, c.colour]);
      slot.fog = Game.fog ? [...Game.fog.cleared] : null;
      s.acts[Game.act] = slot;
    }
    store(s);
  }
  /* the in-progress state of act i, or null to start it fresh */
  function progressOf(i) {
    const s = load();
    const slot = s && s.acts[i];
    return slot && slot.stage != null ? slot : null;
  }
  function markSolved(i, next) {
    const s = load() || { v: 2, acts: {} };
    s.acts[i] = { solved: true };
    s.act = next;
    s.unlocked = Math.max(s.unlocked || 0, next, Game.unlocked);
    s.sound = !app.classList.contains('muted');
    s.seedHints = seedHints();
    store(s);
  }
  function markActSolved(i) {
    const s = load() || { v: 2, acts: {} };
    s.acts[i] = Object.assign(s.acts[i] || {}, { solved: true });
    store(s);
  }
  NF.markActSolved = markActSolved;
  function wipe() { mem = null; try { localStorage.removeItem(SAVE_KEY); localStorage.removeItem(OLD_SAVE_KEY); } catch (e) { } }
  NF.save = save;

  /* ------------------------------------------------------------------ ui helpers */
  let toastTimer = null;
  function toast(msg, ms) {
    const t = $('#toast');
    t.textContent = msg;
    t.classList.add('on');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => t.classList.remove('on'), ms || 3200);
  }
  NF.toast = toast;
  /* Seed hints are optional (menu): off by default, because marking the cells you can already
     work out gives away half the puzzle. Progress works the same either way: a stage grows once its
     seed cells hold the right digits; with hints off you just aren't told which cells they are. */
  const seedHints = () => app.classList.contains('seed-hints');
  function stageHint(text) {
    if (seedHints() || !text) return text;
    return text.replace('Sprouts mark the cells you can already work out. Fill every one and see what grows.',
      'Work out what the 1–9 rule settles now. Once those digits are in, the puzzle grows. (Stuck? Menu → Seed hints.)');
  }
  function setSeedHints(on, quiet) {
    app.classList.toggle('seed-hints', on);
    if (Game.grid) { Game.grid.showSeeds = on; Game.grid.cells.forEach(c => { if (c.corner.length) Game.grid.renderCell(c); }); }
    const li = document.querySelector('#ruleList li[data-rule="seeds"] .txt');
    if (li) li.innerHTML = NF.RULES.seeds.t;
    $('#seedHintBtn').textContent = on ? 'Seed hints: on' : 'Seed hints: off';
    $('#seedHintBtn').setAttribute('aria-pressed', on ? 'true' : 'false');
    updateStageLabel();
    if (Game.grid && D.acts[Game.act].stages) { const st = D.acts[Game.act].stages[Game.stage]; if (st && st.hint && !Game.prelude) hint(stageHint(st.hint)); }
    if (!quiet) save();
  }
  function hint(msg) {
    const h = $('#hint');
    h.style.opacity = 0;
    setTimeout(() => { h.innerHTML = msg || ''; h.style.opacity = 1; }, 250);
  }
  NF.hint = hint;

  async function card(num, title, line, hold) {
    const c = $('#card');
    $('#cardNum').textContent = num;
    $('#cardTitle').textContent = title;
    $('#cardLine').textContent = line || '';
    c.hidden = false;
    const inner = c.querySelector('.card-inner');
    inner.animate([{ opacity: 0, transform: 'translateY(14px) scale(.98)', filter: 'blur(8px)' }, { opacity: 1, transform: 'none', filter: 'blur(0)' }], { duration: 1200, easing: 'cubic-bezier(.2,.7,.2,1)', fill: 'forwards' });
    await sleep(hold || 2600);
    const a = inner.animate([{ opacity: 1, filter: 'blur(0)' }, { opacity: 0, filter: 'blur(10px)', transform: 'translateY(-10px)' }], { duration: 900, easing: 'ease-in', fill: 'forwards' });
    await a.finished.catch(() => { });
    c.hidden = true;
  }
  NF.card = card;

  /* ------------------------------------------------------------------ manuscript */
  // rule -> constraint types it governs (for lighting a rule's clues on the grid)
  const RULE_TYPES = {
    killer: ['killer'], thermo: ['thermo'], arrow: ['arrow'], xv: ['x', 'v'], kropki: ['kwhite', 'kblack'],
    whisper: ['whisper'], dutch: ['dutch'], renban: ['renban'], regionsum: ['regionsum'], palindrome: ['palindrome'],
    between: ['between'], entropic: ['entropic'], modular: ['modular'], zipper: ['zipper'], parity: ['parity'], nabner: ['nabner'],
    sandwich: ['sandwich'], xsum: ['xsum'], skyscraper: ['skyscraper'], littlekiller: ['littlekiller'], quad: ['quad'],
    parity1: ['even', 'odd'], contour: ['contour'], river: ['river'], peak: ['peak'], hollow: ['hollow'], lake: ['lake'], sun: ['sun', 'shade'],
  };
  function ruleItem(key, opts) {
    const r = NF.RULES[key];
    if (!r) return null;
    const li = document.createElement('li');
    li.dataset.rule = key;
    li.innerHTML = `<span class="glyph">${r.g}</span><span class="txt">${r.t}</span>`;
    if (RULE_TYPES[key]) li.classList.add('hlable');
    if (opts && opts.fresh) li.classList.add('new');
    $('#ruleList').appendChild(li);
    if (opts && opts.reveal) revealRule(li);
    rulesFade();
    return li;
  }
  /* bring a rule added mid-act into view, scrolling only the rules box itself (never the page:
     on phones the page scroll would carry the board under the header) */
  function revealRule(li) {
    requestAnimationFrame(() => {
      const box = $('#ruleList');
      if (box.scrollHeight <= box.clientHeight + 1) return;
      const br = box.getBoundingClientRect(), lr = li.getBoundingClientRect();
      if (lr.bottom > br.bottom - 4) box.scrollTo({ top: box.scrollTop + (lr.bottom - br.bottom) + 14, behavior: 'smooth' });
    });
  }
  function setRules(keys, freshKeys) {
    $('#ruleList').innerHTML = '';
    keys.forEach(k => ruleItem(k, { fresh: freshKeys && freshKeys.includes(k) }));
    $('#ruleList').scrollTop = 0; // an act opens on its first rules
    rulesFade();
  }
  /* a soft fade at the bottom edge says the list scrolls */
  function rulesFade() {
    const box = $('#ruleList');
    requestAnimationFrame(() => {
      const more = box.scrollHeight - box.clientHeight - box.scrollTop > 6;
      box.classList.toggle('more-below', more);
      box.classList.toggle('more-above', box.scrollTop > 6);
    });
  }
  $('#ruleList').addEventListener('scroll', rulesFade, { passive: true });
  $('#ruleList').addEventListener('animationend', rulesFade); // entry animations change the height
  window.addEventListener('resize', rulesFade);

  function stageLabel() {
    const act = D.acts[Game.act];
    if (!act.stages) return '';
    const n = act.stages.length;
    let t = n > 1 ? `growth ${Math.min(Game.stage + 1, n)} of ${n}` : '';
    const st = act.stages[Game.stage];
    if (seedHints() && !Game.prelude && Game.grid && st && st.seeds && st.seeds.length && Game.stage < n - 1) {
      const s = seedsDone();
      t += (t ? ' · ' : '') + `seeds ${s.filled}/${s.total}`;
    }
    return t;
  }
  function updateStageLabel() { $('#msStage').textContent = Game.prelude ? '' : stageLabel(); }

  // Hovering (or tapping) a rule lights up every clue it governs and dims the rest, so line
  // types can be told apart without relying on colour.
  let hlTimer = null, lastPointer = 'mouse';
  function highlightRule(key, ms) {
    clearTimeout(hlTimer);
    const g = Game.grid;
    if (!g) return;
    const types = key ? RULE_TYPES[key] : null;
    // only clues on show count: a rule whose clues are all still in the fog lights nothing
    const on = !!(types && Game.rendered.some(rd => types.includes(rd.data.type) && !rd.g.classList.contains('fogged-hide')));
    [g.svg, g.topSvg].forEach(svg => svg && svg.classList.toggle('hl-on', on));
    Game.rendered.forEach(rd => {
      const hit = on && types.includes(rd.data.type);
      [rd.g].concat(rd.extraEls || []).forEach(n => n.classList.toggle('hl', hit));
    });
    document.querySelectorAll('#ruleList li').forEach(li => li.classList.toggle('lit', on && li.dataset.rule === key));
    if (on && ms) hlTimer = setTimeout(() => highlightRule(null), ms);
  }
  $('#ruleList').addEventListener('pointerdown', (e) => { lastPointer = e.pointerType || 'mouse'; });
  $('#ruleList').addEventListener('pointerover', (e) => {
    if (e.pointerType !== 'mouse') return;
    const li = e.target.closest('li');
    highlightRule(li ? li.dataset.rule : null);
  });
  $('#ruleList').addEventListener('pointerleave', (e) => { if (e.pointerType === 'mouse') highlightRule(null); });
  $('#ruleList').addEventListener('click', (e) => {
    if (lastPointer === 'mouse') return;
    const li = e.target.closest('li');
    if (!li) return;
    const already = li.classList.contains('lit');
    const narrow = window.innerWidth <= 860;
    highlightRule(already ? null : li.dataset.rule, narrow ? 0 : 3200);
    if (!already && narrow && li.classList.contains('lit') && Game.grid) {
      // the rules sit below the keypad here: bring the lit clues into view
      const r = Game.grid.svg.getBoundingClientRect();
      const seen = Math.max(0, Math.min(r.bottom, window.innerHeight) - Math.max(r.top, 58)) / Math.max(1, r.height);
      if (seen < 0.5) $('#stage').scrollTo({ top: 0, behavior: 'smooth' });
    }
    const types = RULE_TYPES[li.dataset.rule] || [];
    if (!already && types.length && Game.rendered.some(rd => types.includes(rd.data.type)) && !li.classList.contains('lit')) toast('None of these clues has appeared yet.', 2200);
  });
  NF.highlightRule = highlightRule;
  // touching the grid again ends a tapped highlight
  document.addEventListener('pointerdown', (e) => { if (e.target.closest && e.target.closest('.nf-grid') && document.querySelector('#ruleList li.lit')) highlightRule(null); }, true);

  /* ------------------------------------------------------------------ keypad */
  function buildPad(n) {
    const pad = $('#pad');
    pad.innerHTML = '';
    for (let d = 1; d <= 9; d++) {
      const b = document.createElement('button');
      b.textContent = d;
      b.dataset.d = d;
      b.setAttribute('aria-label', 'Digit ' + d);
      if (d > n) b.disabled = true, b.style.opacity = 0.25;
      // pointerdown only keeps focus and the selection; the digit goes in on click, which a swipe
      // that starts on a key (to scroll the page on a phone) never produces
      b.addEventListener('pointerdown', (e) => { e.preventDefault(); });
      b.addEventListener('click', () => padPress(d));
      pad.appendChild(b);
    }
  }
  function padPress(d) {
    if (!Game.grid) return;
    if (!Game.grid.selection.size) {
      if (performance.now() - selectNudgeAt > 6000) { selectNudgeAt = performance.now(); toast('Tap a cell first, then a digit.'); }
      return;
    }
    Game.grid.input(d);
    NF.Audio && NF.Audio.tick(d, Game.grid.mode);
  }
  function setMode(m) {
    if (!Game.grid) return;
    Game.grid.mode = m;
    document.querySelectorAll('.modes button').forEach(b => {
      const on = b.dataset.mode === m;
      b.classList.toggle('on', on);
      b.setAttribute('aria-checked', on ? 'true' : 'false');
    });
    // colour mode shows swatches on the pad
    document.querySelectorAll('#pad button').forEach((b, i) => {
      b.querySelector('.sw') && b.querySelector('.sw').remove();
      if (m === 'colour') {
        const s = document.createElement('span');
        s.className = 'sw'; s.style.background = NF.COLOURS[i];
        b.appendChild(s);
      }
    });
  }
  document.querySelectorAll('.modes button').forEach(b => b.addEventListener('click', () => setMode(b.dataset.mode)));
  document.querySelectorAll('#preludePad button').forEach(b => {
    b.addEventListener('pointerdown', (e) => { e.preventDefault(); });
    b.addEventListener('click', () => {
      const d = +b.dataset.d;
      if (!Game.grid) return;
      if (!d) Game.grid.clear(); else padPress(d);
    });
  });
  const viewLabel = (on) => window.innerWidth <= 860 ? (on ? 'Map' : 'Land') : (on ? 'Back to the map' : 'View the land');
  $('#viewBtn').addEventListener('click', () => {
    const on = app.classList.toggle('terrain-view');
    $('#viewBtn').textContent = viewLabel(on);
    NF.World && NF.World.toggleTerrainHero && NF.World.toggleTerrainHero(on);
  });
  const idle = () => Game.grid && !Game.busy && !(Game.transitioning > 0);
  $('#undoBtn').addEventListener('click', () => idle() && Game.grid.undo());
  $('#redoBtn').addEventListener('click', () => idle() && Game.grid.redo());
  $('#delBtn').addEventListener('click', () => idle() && Game.grid.clear());

  /* ------------------------------------------------------------------ keyboard */
  // Any press inside the page must leave keyboard focus inside it. The keypad buttons cancel
  // pointerdown (so the selection survives), and inside the artifact iframe that would otherwise
  // leave the host page focused and swallow every keystroke.
  document.addEventListener('pointerdown', (e) => {
    if (e.target.closest && e.target.closest('input, textarea, select, .nf-grid')) return;
    if (!document.hasFocus() || document.activeElement === document.body || !document.activeElement) {
      try { app.focus({ preventScroll: true }); } catch (err) { }
    }
  }, true);
  let selectNudgeAt = 0;
  document.addEventListener('keydown', (e) => {
    if (!$('#menu').hidden) { if (e.key === 'Escape') closeMenu(); return; }
    if (NF.Island && NF.Island.active) { NF.Island.key(e); return; }
    const g = Game.grid;
    if (!g || g.locked) return;
    const k = e.key;
    const ctrl = e.ctrlKey || e.metaKey;
    // with the map hidden behind the land view, an editing key first brings the map back
    // instead of silently changing cells nobody can see
    if (app.classList.contains('terrain-view') && (/^(Digit|Numpad)[1-9]$/.test(e.code) || /^(Backspace|Delete|Arrow)/.test(k))) {
      e.preventDefault(); $('#viewBtn').click(); return;
    }
    if (ctrl && (k === 'z' || k === 'Z')) { e.preventDefault(); if (Game.busy) return; if (e.shiftKey) g.redo(); else g.undo(); return; }
    if (ctrl && (k === 'y' || k === 'Y')) { e.preventDefault(); if (Game.busy) return; g.redo(); return; }
    let d = 0;
    if (/^Digit[1-9]$/.test(e.code)) d = +e.code.slice(5);
    else if (/^Numpad[1-9]$/.test(e.code)) d = +e.code.slice(6);
    if (d) {
      e.preventDefault();
      if (!g.selection.size) {
        if (performance.now() - selectNudgeAt > 6000) { selectNudgeAt = performance.now(); toast('Click a cell first, then type.'); }
        return;
      }
      let mode = g.mode;
      if (e.shiftKey) mode = 'corner';
      if (ctrl) mode = 'centre';
      if (e.altKey) mode = 'colour';
      g.input(d, mode);
      NF.Audio && NF.Audio.tick(d, mode);
      return;
    }
    if (k === 'Backspace' || k === 'Delete') { e.preventDefault(); g.clear(); return; }
    if (k === 'Escape') { g.select([]); return; }
    if (k === 'z' || k === 'Z') setMode('normal');
    else if (k === 'x' || k === 'X') setMode('corner');
    else if (k === 'c' || k === 'C') setMode('centre');
    else if (k === 'v' || k === 'V') setMode('colour');
    else if (k === ' ') { e.preventDefault(); const order = ['normal', 'corner', 'centre', 'colour']; setMode(order[(order.indexOf(g.mode) + 1) % 4]); }
    else if (k.startsWith('Arrow')) {
      e.preventDefault();
      const dir = { ArrowUp: [-1, 0], ArrowDown: [1, 0], ArrowLeft: [0, -1], ArrowRight: [0, 1] }[k];
      g.moveCursor(dir[0], dir[1], e.shiftKey || ctrl);
    }
  });

  /* ------------------------------------------------------------------ sizing */
  function layout() {
    const wrap = $('#gridWrap');
    const W = window.innerWidth, H = window.innerHeight;
    const g = Game.grid;
    const narrow = W <= 860;
    const marginCells = g ? g.M / NF.S : 0;
    const n = g ? g.N : 9;
    let size;
    if (app.classList.contains('prelude')) {
      size = Math.min(W - 40, H * 0.5, 340);
    } else if (narrow) {
      size = Math.min(W - 32, H * 0.66);
    } else {
      const side = $('#side').getBoundingClientRect().width || 330;
      let availW = W - side - 120;
      if (Game.act === 3 && !(NF.World && NF.World.failed)) availW = Math.min(availW, W * 0.4);
      size = Math.min(availW, H - 150, 820);
    }
    size = Math.max(240, Math.floor(size));
    wrap.style.width = size + 'px';
    wrap.style.height = size + 'px';
    if (Game.fog) Game.fog.resize();
    NF.World && NF.World.resize && NF.World.resize();
  }
  window.addEventListener('resize', layout);
  NF.layout = layout;
  // the Act IV camera frames the terrain beside the rules panel, whose width animates between
  // acts: re-frame once it has settled
  // widths animate between layouts (rotation, resize, act changes): when the side panel settles,
  // size the grid again; when the grid settles, the fog canvas and the Act IV camera follow it
  $('#side').addEventListener('transitionend', (e) => { if (e.target.id === 'side' && e.propertyName === 'width') layout(); });
  $('#gridWrap').addEventListener('transitionend', (e) => {
    if (e.target.id !== 'gridWrap' || e.propertyName !== 'width') return;
    if (Game.fog) Game.fog.resize();
    if (Game.act === 3) NF.World && NF.World.resize && NF.World.resize();
  });

  /* ------------------------------------------------------------------ grid setup */
  function makeGrid(size, margin) {
    const host = $('#gridHost');
    host.innerHTML = '';
    document.querySelectorAll('#gridWrap > .nf-top').forEach(n => n.remove());
    if (!NF.Transitions || !NF.Transitions.pendingFogRoll) document.querySelectorAll('#gridWrap > .fog-roll').forEach(n => n.remove());
    const g = new NF.Grid(host, { size, margin: margin || 0 });
    g.showConflicts = true;
    g.showSeeds = seedHints();
    g.vineMode = D.acts[Game.act] && D.acts[Game.act].key === 'vines';
    g.on('change', onChange);
    g.on('focus', () => NF.Audio && NF.Audio.unlock());
    Game.grid = g;
    Game.rendered = [];
    setMode('normal');
    buildPad(size);
    return g;
  }

  function sol(i) { return +Game.solution[i]; }

  function renderConstraints(list, animate, baseDelay) {
    const g = Game.grid;
    const out = [];
    list.forEach((k, j) => {
      const r = NF.renderConstraint(g, k);
      if (!r) return;
      r.extraEls = (r.extra || []).map(x => x.g);
      [r.g].concat(r.extraEls).forEach(n => { n.classList.add('c-any'); n.dataset.type = k.type; });
      Game.rendered.push(r);
      out.push(r);
      if (animate) r.grow((baseDelay || 0) + j * 260);
      else r.grow(-100000); // jump to end state
    });
    if (Game.fog) Game.fog.applyVisibility();
    updateReserved();
    return out;
  }

  /* corner-mark slots that visible clue glyphs occupy (hidden fog clues reserve nothing, so the
     marks never hint at what the fog hides) */
  function updateReserved() {
    const g = Game.grid;
    if (!g || !g.setReserved) return;
    const map = new Map();
    Game.rendered.forEach(rd => {
      if (!rd.reserve || rd.g.classList.contains('fogged-hide')) return;
      rd.reserve.forEach(([r, c, slot]) => {
        if (r < 0 || c < 0 || r >= g.N || c >= g.N) return;
        const i = r * g.N + c;
        if (!map.has(i)) map.set(i, []);
        if (!map.get(i).includes(slot)) map.get(i).push(slot);
      });
    });
    map.forEach(list => list.sort((a, b) => a - b));
    g.setReserved(map);
  }
  Game.updateReserved = updateReserved;

  /* ------------------------------------------------------------------ progress */
  function onChange(info) {
    if (Game.busy) return;
    if (Game.fog && info && info.cells) Game.fog.onPlace(info.cells);
    if (NF.World && Game.act === 3) NF.World.updateTerrain(Game.grid.values(), Game.solution);
    checkProgress();
    updateStageLabel();
    save();
  }

  function seedsDone() {
    const act = D.acts[Game.act];
    const st = act.stages[Game.stage];
    const g = Game.grid;
    const N = g.N;
    const seeds = st.seeds || [];
    let filled = 0, right = 0;
    seeds.forEach(([r, c]) => {
      const cell = g.cells[r * N + c];
      if (cell.v) filled++;
      if (cell.v === (Game.prelude ? +act.prelude.solution[r * N + c] : sol(r * N + c))) right++;
    });
    return { total: seeds.length, filled, right };
  }

  function fullDone() {
    const g = Game.grid;
    return g.cells.every((c, i) => c.v === sol(i));
  }

  let wrongNoticeAt = 0;
  async function checkProgress() {
    const act = D.acts[Game.act];
    if (!act.stages) return;
    if (Game.prelude) {
      const g = Game.grid;
      if (g.cells.every((c, i) => c.v === +act.prelude.solution[i])) return grow();
      if (g.cells.every(c => c.v) && performance.now() - wrongNoticeAt > 8000) { wrongNoticeAt = performance.now(); toast('Every cell is filled, but something isn’t right yet.'); }
      return;
    }
    const st = act.stages[Game.stage];
    const last = Game.stage === act.stages.length - 1 && !Game.prelude;
    if (last) {
      const g = Game.grid;
      const allFilled = g.cells.every(c => c.v);
      if (allFilled && fullDone()) return completeAct();
      if (allFilled && performance.now() - wrongNoticeAt > 8000) { wrongNoticeAt = performance.now(); toast('Every cell is filled, but something isn’t right yet.'); }
      return;
    }
    const s = seedsDone();
    if (s.right === s.total) return grow();
    if (s.filled === s.total && performance.now() - wrongNoticeAt > 8000) {
      wrongNoticeAt = performance.now();
      toast(seedHints() ? 'The seeds are all planted, but not every one has taken root.' : 'Something you have placed isn\u2019t right yet.');
    }
  }

  /* ------------------------------------------------------------------ growth */
  async function grow() {
    if (Game.busy) return;
    Game.busy = true;
    Game.transitioning = (Game.transitioning || 0) + 1;
    try { await growInner(); } finally { Game.transitioning--; }
  }
  async function growInner() {
    const gen = Game.gen;
    const act = D.acts[Game.act];
    Game.grid.locked = true;
    const fromSeed = Game.prelude;
    if (fromSeed) {
      await NF.Transitions.unfold(Game);
      if (Game.gen !== gen) return;
      Game.prelude = false;
      Game.stage = 0;
    } else {
      NF.Audio && NF.Audio.grow();
      if (seedHints()) rippleSeeds();
      await sleep(700);
      if (Game.gen !== gen) return; // the act changed underneath this growth
      Game.stage++;
    }
    const g = Game.grid;
    const st = act.stages[Game.stage];
    if (st.event === 'evening' && NF.World) NF.World.eveningSun(true);
    if (st.givens) st.givens.forEach(([r, c, v], j) => {
      const i = r * g.N + c;
      g.cells[i].v = v; g.cells[i].given = true; g.cells[i].corner = []; g.cells[i].centreMarks = [];
      g.renderCell(g.cells[i]);
      // ink settles into the paper: each new given blooms from its own centre
      g.cells[i].val.animate([
        { opacity: 0, transform: 'scale(1.35)', filter: 'blur(3px)' },
        { opacity: 1, transform: 'scale(1)', filter: 'blur(0px)' },
      ], { duration: 720, delay: (fromSeed ? 250 : 0) + j * 170, easing: 'cubic-bezier(.2,.7,.2,1)', fill: 'backwards' });
    });
    renderConstraints(st.add || [], true, 200);
    // manuscript: add rule entries for this stage
    (st.rules || []).forEach((k, j) => setTimeout(() => { if (Game.gen === gen) ruleItem(k, { fresh: true, reveal: true }); }, 600 + j * 500));
    if ((st.rules || []).length && window.innerWidth <= 860) {
      // on the stacked layout the rules sit below the keypad, out of sight
      const names = st.rules.map(k => NF.RULES[k] && NF.RULES[k].n).filter(Boolean);
      if (names.length) setTimeout(() => { if (Game.gen === gen) toast('New rule' + (names.length > 1 ? 's' : '') + ' below the keypad: ' + names.join(', ') + '.', 4200); }, 1400);
    }
    g.setSeeds(st.seeds || []);
    updateStageLabel();
    if (fromSeed && g.gSeeds) g.gSeeds.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 900, delay: 1100, easing: 'ease-out', fill: 'backwards' });
    if (st.hint) hint(stageHint(st.hint));
    await sleep(900 + (st.add || []).length * 260);
    if (Game.gen !== gen) return;
    g.locked = false;
    Game.busy = false;
    save();
    checkProgress();
  }

  function rippleSeeds() {
    const g = Game.grid;
    const fx = NF.svgEl('g', { class: 'ripple' }, g.gFx);
    g.cells.filter(c => c.seed).forEach((c, j) => {
      const circ = NF.svgEl('circle', { cx: c.x + NF.S / 2, cy: c.y + NF.S / 2, r: 6, fill: 'none', stroke: 'var(--seed)', 'stroke-width': 3 }, fx);
      circ.animate([{ r: 6, opacity: 0.9 }, { r: NF.S * 2.4, opacity: 0 }], { duration: 1400, delay: j * 40, easing: 'ease-out', fill: 'forwards' });
    });
    setTimeout(() => fx.remove(), 2200);
  }

  /* ------------------------------------------------------------------ acts */
  async function startAct(i, opts) {
    opts = opts || {};
    // leaving an act: its fog must stop animating (and clear) whichever act comes next
    if (Game.fog) { Game.fog.stop(); Game.fog = null; }
    highlightRule(null);
    Game.leaving = false;
    Game.gen = (Game.gen || 0) + 1;
    const myGen = Game.gen;
    if (opts.saved === undefined) opts.saved = progressOf(i);
    Game.act = i;
    Game.unlocked = Math.max(Game.unlocked, i);
    const act = D.acts[i];
    // per-act page state must be reset for every branch below (the 4x4 and the island return early)
    $('#stage').scrollTop = 0;
    app.classList.remove('terrain-view');
    $('#viewBtn').textContent = viewLabel(false);
    $('#viewToggle').hidden = !act.terrain || !NF.World || !!NF.World.failed;
    app.classList.toggle('outside-margin', (act.margin || 0) > 0);
    app.classList.toggle('world-on', i >= 1); // Act I is paper; later acts sit in the world
    const cr = document.getElementById('credits'); if (cr) cr.remove();
    app.dataset.act = String(i + 1);
    $('#actTag').textContent = (act.prelude && (!opts.saved || opts.saved.stage < 0)) ? 'No. 1' : act.n + ' · ' + act.title;
    NF.World && NF.World.setAct(i, opts.instant);
    NF.Audio && NF.Audio.setAct(i);
    if (act.island) {
      app.classList.remove('prelude');
      $('#stage').setAttribute('aria-hidden', 'true');
      if (!opts.skipCard) await card(act.n, act.title, act.line, 2400);
      if (Game.gen !== myGen) return; // another chapter was chosen during the card
      const s = load();
      NF.Island.start({ panels: s ? s.panels : null });
      save();
      return;
    }
    $('#stage').removeAttribute('aria-hidden');
    Game.solution = act.solution;
    Game.fog = null;
    const saved = opts.saved;
    if (act.prelude && (!saved || saved.stage < 0)) {
      // the small 4x4 seed
      Game.prelude = true;
      Game.stage = -1;
      app.classList.add('prelude');
      makeGrid(4, 0);
      Game.solution = act.solution;
      act.prelude.givens.forEach(([r, c, v]) => Game.grid.setGiven(r * 4 + c, v));
      layout();
      setRules(['classic4']);
      updateStageLabel();
      hint(matchMedia('(pointer: coarse)').matches ? 'Fill each row, column and 2×2 box with the digits 1 to 4.' : 'Fill each row, column and 2×2 box with the digits 1 to 4. Click a cell and type a number.');
      if (saved && saved.cells && saved.size === 4) restoreCells(saved.cells);
      Game.grid.select([]);
      laterCheck();
      return;
    }
    Game.prelude = false;
    app.classList.remove('prelude');
    $('#stage').scrollTop = 0;
    const margin = act.margin || 0;
    makeGrid(9, margin);
    if (act.fog) Game.grid.liftPlayerLayers($('#gridWrap'));
    layout();
    const stage = saved ? Math.max(0, saved.stage) : 0;
    Game.stage = act.stages ? stage : 0;
    // givens + constraints for all stages up to the current one
    const allRules = [];
    const upto = act.stages ? act.stages.slice(0, Game.stage + 1) : [];
    (act.givens || []).forEach(([r, c, v]) => Game.grid.setGiven(r * 9 + c, v));
    upto.forEach(st => (st.givens || []).forEach(([r, c, v]) => Game.grid.setGiven(r * 9 + c, v)));
    (act.baseRules || []).forEach(k => allRules.push(k));
    upto.forEach(st => (st.rules || []).forEach(k => allRules.push(k)));
    setRules(allRules, opts.fresh ? allRules : null);
    if (opts.fresh && window.innerWidth <= 860) {
      // phones: an act's defining rules sit below the keypad, out of sight
      const names = allRules.filter(k => k !== 'classic9' && k !== 'seeds').map(k => NF.RULES[k] && NF.RULES[k].n).filter(Boolean);
      if (names.length) setTimeout(() => { if (Game.gen === myGen) toast('New rules below the keypad: ' + names.join(', ') + '.', 5200); }, 1600);
    }
    if (act.fog) {
      Game.fog = new NF.Fog(Game, act);
      if (saved && saved.fog) Game.fog.restore(saved.fog);
    }
    const cons = [];
    if (act.constraints) cons.push(...act.constraints);
    upto.forEach(st => cons.push(...(st.add || [])));
    if (saved && saved.cells && saved.size === 9) restoreCells(saved.cells);
    renderConstraints(cons, !!opts.animate, 400);
    const st = act.stages ? act.stages[Game.stage] : null;
    Game.grid.setSeeds(st && Game.stage < act.stages.length - 1 ? st.seeds : []);
    updateStageLabel();
    if (st && st.hint) hint(stageHint(st.hint)); else hint(act.hint || '');
    if (Game.fog) Game.fog.start();
    if (act.terrain && NF.World) {
      // the layout settles over ~1.4 s (grid and side panel widths animate): frame the land again then
      setTimeout(() => { if (Game.gen === myGen && NF.World.resize) NF.World.resize(); }, 1600);
      NF.World.updateTerrain(Game.grid.values(), Game.solution);
      if (act.stages[Game.stage] && Game.stage >= act.stages.findIndex(s => s.event === 'evening') && act.stages.some(s => s.event === 'evening')) NF.World.eveningSun(true, 0);
    }
    save();
    laterCheck();
  }
  NF.startAct = startAct;

  /* A save can hold a stage whose seeds are all solved (a reload during a growth or an act's
     outro): once the act is on screen, let it grow or complete instead of sitting still. */
  function laterCheck() {
    const gen = Game.gen;
    let tries = 0;
    const tick = () => {
      if (Game.gen !== gen) return;
      if (!$('#menu').hidden) { setTimeout(tick, 500); return; }
      if (Game.busy || Game.transitioning > 0) { if (++tries < 40) setTimeout(tick, 500); return; }
      checkProgress();
    };
    setTimeout(tick, 700);
  }

  function restoreCells(cells) {
    const g = Game.grid;
    cells.forEach((s, i) => {
      if (!s || !g.cells[i] || g.cells[i].given) return;
      const c = g.cells[i];
      c.v = s[0]; c.corner = s[1] || []; c.centreMarks = s[2] || []; c.colour = s[3] || [];
    });
    g.refresh();
  }

  async function completeAct() {
    if (Game.busy) return;
    Game.busy = true;
    Game.transitioning = (Game.transitioning || 0) + 1; // a counter: one growth can chain into the next
    try { await completeActInner(); } finally { Game.transitioning--; }
  }
  async function completeActInner() {
    Game.grid.locked = true;
    Game.grid.select([]);
    NF.Audio && NF.Audio.complete();
    const sv0 = load();
    const replay = !!(sv0 && sv0.acts[Game.act] && sv0.acts[Game.act].solved);
    let next = Game.act + 1;
    // finishing a replayed act returns the player to the furthest act they had reached
    if (replay && Game.unlocked > next) next = Game.unlocked;
    // from here the grid on screen is a finished one: never write it back into this act's slot
    Game.leaving = true;
    markSolved(Game.act, Math.min(next, D.acts.length - 1));
    const gen = Game.gen;
    await NF.Transitions.actOut(Game);
    if (Game.gen !== gen) { Game.busy = false; return; }
    if (next < D.acts.length) {
      Game.stage = 0;
      // stay busy until the next act is built: undo/redo/reveal during its title card would
      // otherwise act on the finished grid of the act just left
      try { await NF.Transitions.actIn(Game, next); } finally { Game.busy = false; }
      save();
    } else Game.busy = false;
  }
  NF.completeAct = completeAct;

  /* ------------------------------------------------------------------ menu */
  function openMenu() {
    const m = $('#menu');
    m.hidden = false;
    $('#confirm').hidden = true;
    $('#how').hidden = true;
    const list = $('#menuActs');
    list.innerHTML = '';
    const sv = load() || { acts: {} };
    D.acts.forEach((a, i) => {
      const b = document.createElement('button');
      const slot = sv.acts[i] || {};
      const started = slot.stage > 0 || (slot.cells || []).some(c => c && (c[0] || (c[1] || []).length || (c[2] || []).length)) || (i === 4 && sv.panels && Object.keys(sv.panels.solved || {}).length);
      const state = i === Game.act ? 'here' : slot.solved ? 'solved' : started ? 'in progress' : '';
      b.innerHTML = `<span class="n">${a.n}</span><span class="t">${a.title}</span><span class="s">${state}</span>`;
      b.disabled = i > Game.unlocked || Game.transitioning > 0 || !!(NF.Island && NF.Island.inFinale); // no chapter jumps mid-transition
      b.addEventListener('click', () => {
        if (i === Game.act) return closeMenu();
        if (Game.transitioning > 0 || (NF.Island && NF.Island.inFinale)) { toast('One moment: the puzzle is still changing.'); return; }
        closeMenu();
        jumpTo(i);
      });
      list.appendChild(b);
    });
    const busy = Game.busy || Game.transitioning > 0;
    $('#revealBtn').hidden = busy || (!!D.acts[Game.act].island && !NF.Island?.canReveal());
    const open = !D.acts[Game.act].island && !busy ? selectedOpen().length : 0;
    $('#revealCellBtn').hidden = !open;
    $('#revealCellBtn').textContent = open > 1 ? 'Reveal selected cells' : 'Reveal selected cell';
  }
  function closeMenu() { $('#menu').hidden = true; }
  $('#menuBtn').addEventListener('click', openMenu);
  $('#menuClose').addEventListener('click', closeMenu);
  $('#menu').addEventListener('click', (e) => { if (e.target.id === 'menu') closeMenu(); });
  $('#howBtn').addEventListener('click', () => {
    $('#how').hidden = !$('#how').hidden;
    if (!$('#how').hidden) $('#how').scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  });
  let confirmAction = null;
  function ask(text, fn) {
    $('#confirmText').textContent = text;
    $('#confirm').hidden = false;
    $('#confirm').scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    confirmAction = fn;
  }
  $('#confirmNo').addEventListener('click', () => { $('#confirm').hidden = true; confirmAction = null; });
  $('#confirmYes').addEventListener('click', () => { const f = confirmAction; confirmAction = null; $('#confirm').hidden = true; closeMenu(); f && f(); });
  $('#resetBtn').addEventListener('click', () => ask('Erase all progress and return to the first page?', () => { wipe(); location.hash = ''; location.reload(); }));
  function finalStage() {
    const act = D.acts[Game.act];
    return !Game.prelude && (!act.stages || Game.stage >= act.stages.length - 1);
  }
  // every selected cell the player may change, right or wrong: offering the reveal only for wrong
  // digits would turn the menu into a correctness checker
  function selectedOpen() {
    const g = Game.grid;
    return g ? [...g.selection].map(i => g.cells[i]).filter(c => !c.given) : [];
  }
  $('#revealBtn').addEventListener('click', () => ask(
    D.acts[Game.act].island ? (NF.Island.lastOpen && NF.Island.lastOpen() ? 'Draw the last panel\u2019s line? That completes the island.' : 'Draw this panel\u2019s line? The other panels stay unsolved.')
      : Game.prelude ? 'Fill in the 4\u00d74? The puzzle then grows.'
        : finalStage() ? 'Fill in every remaining cell? That completes this act.'
          : 'Fill in the cells this stage needs? The puzzle grows and you can keep solving afterwards.', reveal));
  $('#revealCellBtn').addEventListener('click', () => {
    const n = selectedOpen().length;
    ask(`Fill in the correct digit${n > 1 ? 's' : ''} for the ${n > 1 ? n + ' selected cells' : 'selected cell'}?`, revealSelected);
  });

  function revealSelected() {
    const g = Game.grid;
    if (!g || Game.busy || Game.transitioning > 0) return;
    const cells = selectedOpen();
    if (!cells.length) return;
    g.pushHistory();
    const act = D.acts[Game.act];
    cells.forEach(c => { c.v = Game.prelude ? +act.prelude.solution[c.i] : sol(c.i); c.corner = []; c.centreMarks = []; });
    g.refresh();
    onChange({ cells: cells.map(c => c.i) });
  }

  function reveal() {
    const act = D.acts[Game.act];
    if (act.island) { NF.Island.reveal(); return; }
    if (Game.busy || Game.transitioning > 0) return;
    const g = Game.grid;
    g.pushHistory(); // one undo takes the reveal back, and only the reveal
    if (Game.prelude) {
      g.cells.forEach((c, i) => { if (!c.given) c.v = +act.prelude.solution[i]; });
    } else {
      const st = act.stages ? act.stages[Game.stage] : null;
      const last = !st || Game.stage === act.stages.length - 1;
      const targets = last ? g.cells.map(c => [c.r, c.c]) : st.seeds;
      targets.forEach(([r, c]) => { const cell = g.cells[r * g.N + c]; if (!cell.given) { cell.v = sol(r * g.N + c); cell.corner = []; cell.centreMarks = []; } });
      if (Game.fog) Game.fog.onPlace(targets.map(([r, c]) => r * 9 + c));
    }
    g.refresh();
    onChange({ cells: [] });
  }

  async function jumpTo(i) {
    if (Game.transitioning > 0 || (NF.Island && NF.Island.inFinale)) return; // never mid-transition
    if (!Game.leaving) save(); // the act being left keeps its progress in its own slot
    Game.busy = false;
    Game.transitioning = (Game.transitioning || 0) + 1; // chapter buttons stay disabled during the jump and its card
    try {
      await NF.Transitions.fadeSwap(async () => {
        NF.Island && NF.Island.stop();
        if (NF.Island) NF.Island.busy = false;
        $('#island').hidden = true;
        await startAct(i, { skipCard: false, instant: true });
      });
    } finally { Game.transitioning--; }
  }
  NF.jumpTo = jumpTo;

  $('#seedHintBtn').addEventListener('click', () => {
    const on = !seedHints();
    setSeedHints(on);
    toast(on ? 'Seed hints on: sprouts mark the cells you can already work out.' : 'Seed hints off.');
  });

  /* ------------------------------------------------------------------ sound toggle */
  $('#soundBtn').addEventListener('click', () => {
    const muted = app.classList.toggle('muted');
    NF.Audio && NF.Audio.setMuted(muted);
    if (!muted) NF.Audio && NF.Audio.unlock();
    save();
  });

  /* ------------------------------------------------------------------ boot */
  function settle() {
    // let the first layout land without animating, then allow transitions again
    requestAnimationFrame(() => requestAnimationFrame(() => app.classList.remove('booting')));
  }

  async function boot() {
    if (NF.World && !window.NF_NO3D) {
      try { await NF.World.init($('#world')); } catch (e) { console.warn('3D unavailable', e); NF.World.failed = true; }
    } else if (NF.World) NF.World.failed = true;
    let saved = load();
    // the island shows a plateau for every act solved so far (a replay of an early act or a
    // hash route must not leave later plateaus unbuilt)
    const builtTo = (i) => {
      let b = i;
      if (saved) for (let k = 0; k < 4; k++) if (saved.acts && saved.acts[k] && saved.acts[k].solved) b = Math.max(b, k + 1);
      return b;
    };
    const hash = (location.hash || '').replace('#', '');
    const m = /^act([1-5])$/.exec(hash);
    if (saved && saved.sound === false) { app.classList.add('muted'); NF.Audio && NF.Audio.setMuted(true); }
    setSeedHints(!!(saved && saved.seedHints), true);
    if (m) {
      const i = +m[1] - 1;
      Game.unlocked = Math.max(i, saved ? saved.unlocked || 0 : 0);
      NF.World && NF.World.buildUpTo && NF.World.buildUpTo(builtTo(i));
      await startAct(i, { instant: true, skipCard: true });
      settle();
      return;
    }
    if (saved && saved.act != null) {
      Game.unlocked = Math.max(saved.unlocked || 0, saved.act);
      NF.World && NF.World.buildUpTo && NF.World.buildUpTo(builtTo(saved.act));
      await startAct(saved.act, { instant: true, skipCard: true });
    } else {
      await startAct(0, {});
    }
    settle();
  }
  NF.boot = boot;
  NF.helpers = { sleep, card, hint, toast, setRules, ruleItem, makeGrid, renderConstraints, layout, setMode, save, stageLabel, updateStageLabel, buildPad, load };
})();
