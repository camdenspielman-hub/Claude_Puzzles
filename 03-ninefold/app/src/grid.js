/* Ninefold — SVG sudoku grid engine.
   Cells, selection, SudokuPad-style input (normal / corner / centre / colour),
   undo/redo, conflict + same-digit highlighting, seeds, fog mask hooks. */
(function () {
  const NS = 'http://www.w3.org/2000/svg';
  const S = 64; // cell size in svg units
  // corner-mark slots, in fill order: TL, TR, BL, BR, top, bottom, left, right, centre
  const CORNER_POS = [[0.2, 0.24], [0.8, 0.24], [0.2, 0.8], [0.8, 0.8], [0.5, 0.24], [0.5, 0.8], [0.2, 0.52], [0.8, 0.52], [0.5, 0.52]];
  // when more marks than free slots: a compact lattice clear of the corners and edges
  const COMPACT_POS = [[0.33, 0.33], [0.5, 0.33], [0.67, 0.33], [0.33, 0.5], [0.5, 0.5], [0.67, 0.5], [0.33, 0.67], [0.5, 0.67], [0.67, 0.67]];

  function el(tag, attrs, parent) {
    const e = document.createElementNS(NS, tag);
    if (attrs) for (const k in attrs) e.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(e);
    return e;
  }

  const COLOURS = ['#f2a3a3', '#f6c89a', '#f3e48c', '#b9e3a0', '#9fd3e6', '#a9b6f0', '#d2a9ee', '#c9c9c9', '#7c7c7c'];

  class Grid {
    constructor(host, opts) {
      this.host = host;
      this.opts = Object.assign({ size: 9, margin: 0, boxH: 3, boxW: 3 }, opts || {});
      this.listeners = {};
      this.mode = 'normal';
      this.history = [];
      this.future = [];
      this.locked = false;
      this.build(this.opts.size, this.opts.margin);
    }

    on(ev, fn) { (this.listeners[ev] = this.listeners[ev] || []).push(fn); }
    emit(ev, d) { (this.listeners[ev] || []).forEach(f => f(d)); }

    /* ------------------------------------------------------------- build */
    build(size, margin) {
      this.N = size;
      this.M = margin * S;
      this.boxH = size === 4 ? 2 : size === 6 ? 2 : 3;
      this.boxW = size === 4 ? 2 : 3;
      const W = size * S + 2 * this.M;
      if (this.svg) this.svg.remove();
      if (this.topSvg) { this.topSvg.remove(); this.topSvg = null; }
      this.reserved = new Map();
      const svg = el('svg', { viewBox: `0 0 ${W} ${W}`, class: 'nf-grid', 'aria-label': 'Sudoku grid. Type digits to fill selected cells; arrow keys move.', role: 'grid', tabindex: '0', focusable: 'true' });
      this.svg = svg;
      this.W = W;
      const defs = el('defs', null, svg);
      this.defs = defs;
      const root = el('g', { class: 'root' }, svg);
      this.root = root;
      this.gBack = el('g', { class: 'g-back' }, root);
      this.gArea = el('g', { class: 'g-area' }, root); // area tints (lakes) sit under the player's colours
      this.gColour = el('g', { class: 'g-colour' }, root);
      this.gSel = el('g', { class: 'g-sel' }, root);
      this.gUnder = el('g', { class: 'g-under' }, root);
      this.gLines = el('g', { class: 'g-lines' }, root);
      this.gSeeds = el('g', { class: 'g-seeds' }, root); // above vines, below cage dashes, contours, X and dots
      this.gOver = el('g', { class: 'g-over' }, root);
      this.gDigits = el('g', { class: 'g-digits' }, root);
      this.gOutside = el('g', { class: 'g-outside' }, root);
      this.gFog = el('g', { class: 'g-fog' }, root);
      this.gFx = el('g', { class: 'g-fx' }, root);

      // backgrounds per cell (for hit area + highlight)
      this.cells = [];
      for (let r = 0; r < size; r++) {
        for (let c = 0; c < size; c++) {
          const i = r * size + c;
          const x = this.M + c * S, y = this.M + r * S;
          const bg = el('rect', { x, y, width: S, height: S, class: 'cell-bg' }, this.gBack);
          const col = el('rect', { x: x, y: y, width: S, height: S, class: 'cell-colour', fill: 'transparent' }, this.gColour);
          const sel = el('rect', { x: x + 2, y: y + 2, width: S - 4, height: S - 4, class: 'cell-sel', rx: 3 }, this.gSel);
          const g = el('g', { class: 'cell-digits', transform: `translate(${x},${y})` }, this.gDigits);
          const val = el('text', { x: S / 2, y: S / 2 + 1, class: 'd-val' }, g);
          const centre = el('text', { x: S / 2, y: S / 2 + 1, class: 'd-centre' }, g);
          const corners = [];
          this.cells.push({
            r, c, i, x, y, bg, col, sel, g, val, centre, corners,
            v: 0, given: false, corner: [], centreMarks: [], colour: [], seed: false,
          });
        }
      }
      // grid lines
      this.drawGridLines();
      this.host.appendChild(svg);
      this.bindPointer();
      this.selection = new Set();
      this.cursor = null;
      this.constraints = [];
      this.solution = null;
      this.refresh();
    }

    drawGridLines() {
      const g = this.gLines;
      while (g.firstChild) g.firstChild.remove();
      const N = this.N, M = this.M;
      const thin = el('g', { class: 'lines-thin' }, g);
      const thick = el('g', { class: 'lines-thick' }, g);
      this.lineEls = [];
      for (let k = 1; k < N; k++) {
        const boxRow = k % this.boxH === 0;
        const boxCol = k % this.boxW === 0;
        const h = el('line', { x1: M, x2: M + N * S, y1: M + k * S, y2: M + k * S }, boxRow ? thick : thin);
        const v = el('line', { y1: M, y2: M + N * S, x1: M + k * S, x2: M + k * S }, boxCol ? thick : thin);
        this.lineEls.push(h, v);
      }
      this.frame = el('rect', { x: M, y: M, width: N * S, height: N * S, class: 'frame' }, thick);
    }

    /* custom regions (jigsaw) — draws thick borders between differing regions */
    setRegions(regions) {
      this.regions = regions;
    }

    /* ------------------------------------------------------------- geometry */
    cx(c) { return this.M + c * S + S / 2; }
    cy(r) { return this.M + r * S + S / 2; }
    idx(r, c) { return r * this.N + c; }
    cellAt(evt) {
      const pt = this.svg.createSVGPoint();
      pt.x = evt.clientX; pt.y = evt.clientY;
      const m = this.svg.getScreenCTM();
      if (!m) return null;
      const p = pt.matrixTransform(m.inverse());
      const c = Math.floor((p.x - this.M) / S), r = Math.floor((p.y - this.M) / S);
      if (r < 0 || c < 0 || r >= this.N || c >= this.N) return null;
      // forgiving drag: ignore points near cell corners for diagonal smoothness
      return r * this.N + c;
    }

    /* ------------------------------------------------------------- pointer */
    bindPointer() {
      const svg = this.svg;
      let dragging = false, adding = true;
      let lastTap = 0, lastCell = -1;
      // Tabbing into the grid with nothing selected puts the cursor on the first cell, so the
      // selection itself shows where keyboard input goes (the grid draws no focus ring).
      svg.addEventListener('focus', () => {
        if (this.pointerFocus || this.locked || this.selection.size) return;
        this.select([0]);
      });
      svg.addEventListener('pointerdown', (e) => {
        // preventDefault below suppresses the browser's own focus change, which inside the
        // artifact's iframe would leave the keyboard pointed at the host page; take focus explicitly
        this.pointerFocus = true;
        this.focusSelf();
        this.pointerFocus = false;
        if (this.locked) return;
        const i = this.cellAt(e);
        if (i === null) { if (!e.shiftKey && !e.ctrlKey && !e.metaKey) this.select([]); return; }
        e.preventDefault();
        svg.setPointerCapture && svg.setPointerCapture(e.pointerId);
        dragging = true;
        const now = performance.now();
        if (now - lastTap < 320 && lastCell === i) {
          // double tap: select all cells with the same digit / same marks
          const v = this.cells[i].v;
          if (v) this.select(this.cells.filter(c => c.v === v).map(c => c.i));
          else this.select([i]);
          dragging = false;
          lastTap = 0;
          return;
        }
        lastTap = now; lastCell = i;
        if (e.shiftKey || e.ctrlKey || e.metaKey) {
          adding = !this.selection.has(i);
          if (adding) this.selection.add(i); else this.selection.delete(i);
          this.cursor = i;
          this.refreshSelection();
        } else {
          adding = true;
          this.select([i]);
        }
        this.emit('focus');
      });
      svg.addEventListener('pointermove', (e) => {
        if (!dragging) return;
        const i = this.cellAt(e);
        if (i === null) return;
        // only accept when pointer is reasonably inside the cell (diagonal drags)
        if (adding && !this.selection.has(i)) { this.selection.add(i); this.cursor = i; this.refreshSelection(); }
        if (!adding && this.selection.has(i)) { this.selection.delete(i); this.refreshSelection(); }
      });
      const end = () => { dragging = false; };
      svg.addEventListener('pointerup', end);
      svg.addEventListener('pointercancel', end);
    }

    focusSelf() {
      try { this.svg.focus({ preventScroll: true }); } catch (err) { /* older browsers */ }
      if (!document.hasFocus()) { try { window.focus(); } catch (err) { } }
    }

    select(list) {
      this.selection = new Set(list);
      this.cursor = list.length ? list[list.length - 1] : null;
      this.refreshSelection();
    }

    moveCursor(dr, dc, extend) {
      const N = this.N;
      let i = this.cursor == null ? 0 : this.cursor;
      let r = Math.floor(i / N), c = i % N;
      r = (r + dr + N) % N; c = (c + dc + N) % N;
      const j = r * N + c;
      if (extend) { this.selection.add(j); this.cursor = j; this.refreshSelection(); }
      else this.select([j]);
    }

    /* ------------------------------------------------------------- state */
    snapshot() {
      return this.cells.map(c => [c.v, c.corner.slice(), c.centreMarks.slice(), c.colour.slice()]);
    }
    restore(snap) {
      snap.forEach((s, i) => {
        const c = this.cells[i];
        if (c.given) return;
        c.v = s[0]; c.corner = s[1].slice(); c.centreMarks = s[2].slice(); c.colour = s[3].slice();
      });
      this.refresh();
      this.emit('change', { undo: true });
    }
    pushHistory() {
      this.history.push(this.snapshot());
      if (this.history.length > 400) this.history.shift();
      this.future = [];
    }
    // a locked grid (growth, act change) ignores undo/redo: replaying history mid-transition
    // would rewrite seeds the growth already consumed
    undo() { if (this.locked || !this.history.length) return; this.future.push(this.snapshot()); this.restore(this.history.pop()); }
    redo() { if (this.locked || !this.future.length) return; this.history.push(this.snapshot()); this.restore(this.future.pop()); }

    setGiven(i, v) {
      const c = this.cells[i];
      c.v = v; c.given = true; c.corner = []; c.centreMarks = [];
      this.renderCell(c);
    }

    /* apply a digit according to the current mode to the selection */
    input(d, modeOverride) {
      if (this.locked) return;
      const mode = modeOverride || this.mode;
      const sel = [...this.selection].map(i => this.cells[i]).filter(c => !c.given);
      if (!sel.length) return;
      if (d > this.N && mode !== 'colour') return;
      this.pushHistory();
      if (mode === 'normal') {
        const allSame = sel.every(c => c.v === d);
        sel.forEach(c => { c.v = allSame ? 0 : d; });
        if (!allSame) this.autoClearMarks(sel, d);
      } else if (mode === 'corner' || mode === 'centre') {
        const key = mode === 'corner' ? 'corner' : 'centreMarks';
        const targets = sel.filter(c => !c.v);
        if (!targets.length) { this.history.pop(); return; }
        const allHave = targets.every(c => c[key].includes(d));
        targets.forEach(c => {
          if (allHave) c[key] = c[key].filter(x => x !== d);
          else if (!c[key].includes(d)) { c[key].push(d); c[key].sort((a, b) => a - b); }
        });
      } else if (mode === 'colour') {
        const allHave = sel.every(c => c.colour.includes(d));
        sel.forEach(c => {
          if (allHave) c.colour = c.colour.filter(x => x !== d);
          else if (!c.colour.includes(d)) c.colour.push(d);
        });
      }
      sel.forEach(c => this.renderCell(c));
      this.refreshHighlights();
      this.emit('change', { cells: sel.map(c => c.i), mode, d });
    }

    autoClearMarks(sel, d) {
      // when a digit is placed, remove it from pencil marks of peers (gentle assist)
      if (!this.autoPencil) return;
      sel.forEach(c => {
        this.peers(c.i).forEach(j => {
          const p = this.cells[j];
          p.corner = p.corner.filter(x => x !== d);
          p.centreMarks = p.centreMarks.filter(x => x !== d);
          this.renderCell(p);
        });
      });
    }

    clear() {
      if (this.locked) return;
      const sel = [...this.selection].map(i => this.cells[i]).filter(c => !c.given);
      if (!sel.length) return;
      this.pushHistory();
      // SudokuPad order: digit first, then marks, then colours
      const hasV = sel.some(c => c.v);
      const hasMarks = sel.some(c => c.corner.length || c.centreMarks.length);
      sel.forEach(c => {
        if (hasV) c.v = 0;
        else if (hasMarks) { c.corner = []; c.centreMarks = []; }
        else c.colour = [];
      });
      sel.forEach(c => this.renderCell(c));
      this.refreshHighlights();
      this.emit('change', { cells: sel.map(c => c.i), mode: 'clear' });
    }

    peers(i) {
      const N = this.N, r = Math.floor(i / N), c = i % N;
      const out = new Set();
      for (let k = 0; k < N; k++) { out.add(r * N + k); out.add(k * N + c); }
      const br = Math.floor(r / this.boxH) * this.boxH, bc = Math.floor(c / this.boxW) * this.boxW;
      for (let a = 0; a < this.boxH; a++) for (let b = 0; b < this.boxW; b++) out.add((br + a) * N + bc + b);
      out.delete(i);
      return [...out];
    }

    /* ------------------------------------------------------------- render */
    renderCell(c) {
      const showVal = c.v > 0;
      if (c.seed && c.seedEl) c.seedEl.classList.toggle('filled', showVal);
      c.val.textContent = showVal ? String(c.v) : '';
      c.val.setAttribute('class', 'd-val' + (c.given ? ' given' : ' user') + (this.lastConflicts && this.lastConflicts.has(c.i) && showVal ? ' conflict' : ''));
      c.centre.textContent = (!showVal && c.centreMarks.length) ? c.centreMarks.join('') : '';
      const len = c.centreMarks.length;
      c.centre.setAttribute('class', 'd-centre' + (len > 5 ? ' tiny' : len > 3 ? ' small' : ''));
      // corners
      c.corners.forEach(t => t.remove());
      c.corners = [];
      if (!showVal && c.corner.length) {
        // slots a clue glyph already occupies (cage total, quad circle, edge dot, summit, sprout...)
        // are skipped, so a pencil mark is never printed over a clue or hidden under one
        const taken = this.reservedSlots(c);
        const free = CORNER_POS.map((p, k) => k).filter(k => !taken.has(k));
        const compact = c.corner.length > free.length;
        // marks always read in order (top row left to right, then down); if they outnumber the
        // free slots they shrink onto a compact lattice rather than print over a clue
        let slots = compact ? COMPACT_POS : free.slice(0, c.corner.length).sort((a, b) => (CORNER_POS[a][1] - CORNER_POS[b][1]) || (CORNER_POS[a][0] - CORNER_POS[b][0])).map(k => CORNER_POS[k]);
        if (compact) {
          const dx = c.seed && this.showSeeds ? -0.07 : 0; // clear of the sprout in the bottom-right corner
          slots = slots.map(([x, y], k) => (k === 4 && taken.has(8)) ? [0.5, 0.84] : [x + dx, y + dx]); // a spring ring holds the centre
        }
        c.corner.forEach((d, k) => {
          const p = slots[k] || slots[slots.length - 1];
          const t = el('text', { x: p[0] * S, y: p[1] * S, class: 'd-corner' + (compact ? ' compact' : '') }, c.g);
          t.textContent = String(d);
          c.corners.push(t);
        });
      }
      // colours (split cell into slices when multiple)
      const colLayer = (c.fogged && this.gTopColour) ? this.gTopColour : this.gColour;
      if (c.col.parentNode !== colLayer) colLayer.appendChild(c.col);
      if (c.colour.length) {
        if (c.colour.length === 1) {
          c.col.setAttribute('fill', COLOURS[(c.colour[0] - 1) % 9]);
          c.col.setAttribute('opacity', '0.55');
          if (c.colParts) { c.colParts.forEach(p => p.remove()); c.colParts = null; }
        } else {
          c.col.setAttribute('fill', 'transparent');
          if (c.colParts) c.colParts.forEach(p => p.remove());
          c.colParts = [];
          const k = c.colour.length;
          c.colour.forEach((col, j) => {
            const x0 = c.x + (j / k) * S;
            const p = el('rect', { x: x0, y: c.y, width: S / k, height: S, fill: COLOURS[(col - 1) % 9], opacity: 0.55 }, colLayer);
            c.colParts.push(p);
          });
        }
      } else {
        c.col.setAttribute('fill', 'transparent');
        if (c.colParts) { c.colParts.forEach(p => p.remove()); c.colParts = null; }
      }
    }

    refresh() {
      this.cells.forEach(c => this.renderCell(c));
      this.refreshSelection();
    }

    refreshSelection() {
      this.cells.forEach(c => c.sel.classList.toggle('on', this.selection.has(c.i)));
      this.refreshHighlights();
      this.emit('select', [...this.selection]);
    }

    refreshHighlights() {
      // same-digit highlight
      let v = 0;
      if (this.selection.size === 1) {
        const c = this.cells[[...this.selection][0]];
        v = c.v;
      }
      const conflicts = this.findConflicts();
      this.lastConflicts = conflicts; // renderCell re-applies it, so a re-render never drops the red
      this.cells.forEach(c => {
        c.bg.classList.toggle('same', v > 0 && c.v === v);
        c.sel.classList.toggle('same', v > 0 && c.v === v); // shows above the fog (Act III overlay)
        c.bg.classList.toggle('peer', false);
        c.val.classList.toggle('conflict', conflicts.has(c.i));
      });
    }

    findConflicts() {
      const bad = new Set();
      if (!this.showConflicts) return bad;
      const N = this.N;
      const houses = [];
      for (let r = 0; r < N; r++) houses.push([...Array(N)].map((_, c) => r * N + c));
      for (let c = 0; c < N; c++) houses.push([...Array(N)].map((_, r) => r * N + c));
      for (let br = 0; br < N; br += this.boxH) for (let bc = 0; bc < N; bc += this.boxW) {
        const h = [];
        for (let a = 0; a < this.boxH; a++) for (let b = 0; b < this.boxW; b++) h.push((br + a) * N + bc + b);
        houses.push(h);
      }
      houses.forEach(h => {
        const seen = {};
        h.forEach(i => { const v = this.cells[i].v; if (!v) return; (seen[v] = seen[v] || []).push(i); });
        Object.values(seen).forEach(list => { if (list.length > 1) list.forEach(i => bad.add(i)); });
      });
      return bad;
    }

    values() { return this.cells.map(c => c.v); }

    /* ------------------------------------------------------------- reserved corner slots */
    reservedSlots(c) {
      const set = new Set(this.reserved.get(c.i) || []);
      if (c.seed && this.showSeeds) set.add(3); // the sprout sits in the bottom-right corner (only when seed hints show)
      return set;
    }
    /* map: cell index -> array of slot indices (see CORNER_POS) */
    setReserved(map) {
      const before = this.reserved;
      this.reserved = map;
      this.cells.forEach(c => {
        const a = (before.get(c.i) || []).join(), b = (map.get(c.i) || []).join();
        if (a !== b && c.corner.length) this.renderCell(c);
      });
    }

    /* ------------------------------------------------------------- fog overlay */
    /* Fog of war hides the puzzle, never the player's own work. The fog canvas sits above this
       SVG, so the selection, digits, pencil marks and fogged cells' colours move into a second,
       click-through SVG stacked above the fog. Givens never sit in fog, and hidden clues are
       switched off in the grid itself, so nothing the fog hides is exposed by this. */
    liftPlayerLayers(container) {
      if (this.topSvg) return;
      const top = el('svg', { viewBox: `0 0 ${this.W} ${this.W}`, class: 'nf-grid nf-top', 'aria-hidden': 'true' });
      const root = el('g', { class: 'root' }, top);
      // the grid's own lines, faint, so cells can be counted inside the fog (their positions are
      // fixed and known, so this shows nothing the fog hides)
      const tg = el('g', { class: 'top-grid' }, root);
      const N = this.N, M = this.M;
      for (let k = 1; k < N; k++) {
        const thick = k % this.boxH === 0;
        el('line', { x1: M, x2: M + N * S, y1: M + k * S, y2: M + k * S, class: thick ? 'tg-thick' : 'tg-thin' }, tg);
        el('line', { y1: M, y2: M + N * S, x1: M + k * S, x2: M + k * S, class: thick ? 'tg-thick' : 'tg-thin' }, tg);
      }
      el('rect', { x: M, y: M, width: N * S, height: N * S, class: 'tg-thick' }, tg);
      this.gTopColour = el('g', { class: 'g-colour' }, root);
      root.appendChild(this.gSel);
      this.gTopClues = el('g', { class: 'g-top-clues' }, root);
      root.appendChild(this.gDigits);
      container.appendChild(top);
      this.topSvg = top;
    }

    /* ------------------------------------------------------------- seeds */
    setSeeds(list) {
      while (this.gSeeds.firstChild) this.gSeeds.firstChild.remove();
      this.cells.forEach(c => { c.seed = false; });
      list.forEach(([r, c]) => {
        const cell = this.cells[this.idx(r, c)];
        cell.seed = true;
        // position on an outer group; the pulse animation lives on the inner one (a CSS transform
        // on the same element would replace the SVG translate and pile every sprout into r1c1)
        const holder = el('g', { class: 'seed-pos', transform: `translate(${cell.x + S - 11},${cell.y + S - 12}) scale(1.45)` }, this.gSeeds);
        // a paper-coloured disc lifts the sprout off vines, leaves and lines beneath it
        el('circle', { cx: 0, cy: 0, r: 7.2, class: 'seed-halo' }, holder);
        const g = el('g', { class: 'seed' }, holder);
        // an upright seedling: a stem with a leaf on each side (the old curl read as a tick)
        el('path', { d: 'M-0.65,5.5 L-0.65,-1.2 L0.65,-1.2 L0.65,5.5 Z', class: 'seed-leaf' }, g);
        el('path', { d: 'M0,-0.6 C-1.2,-1.4 -3.8,-1.6 -5.4,-4.4 C-2.6,-4.9 -0.6,-3.4 0,-0.6 Z', class: 'seed-leaf' }, g);
        el('path', { d: 'M0,-0.6 C1.2,-1.4 3.8,-1.6 5.4,-4.4 C2.6,-4.9 0.6,-3.4 0,-0.6 Z', class: 'seed-leaf' }, g);
        el('circle', { cx: 0, cy: 5.6, r: 1.4, class: 'seed-dot' }, g);
        cell.seedEl = holder;
        holder.classList.toggle('filled', cell.v > 0);
      });
      this.cells.forEach(c => { if (c.corner.length) this.renderCell(c); });
    }
  }

  window.NF = window.NF || {};
  NF.Grid = Grid;
  NF.S = S;
  NF.svgEl = el;
  NF.COLOURS = COLOURS;
  NF.CORNER_POS = CORNER_POS;
})();
