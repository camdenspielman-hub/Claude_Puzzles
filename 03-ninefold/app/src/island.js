/* Ninefold — Act V: the island. Stone panels stand on the plateaus you built.
   Draw a line from the circle to the notch; the line cuts the panel into regions. */
(function () {
  const $ = (s) => document.querySelector(s);
  const app = $('#app');
  const NS = 'http://www.w3.org/2000/svg';
  const sleep = (ms) => new Promise(r => setTimeout(r, ms));
  const I = { active: false, solved: {}, objs: [], open: null };
  NF.Island = I;

  function el(tag, attrs, parent) {
    const e = document.createElementNS(NS, tag);
    if (attrs) for (const k in attrs) e.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(e);
    return e;
  }
  const key = (x, y) => x + ',' + y;
  const ekey = (a, b) => { const A = key(a[0], a[1]), B = key(b[0], b[1]); return A < B ? A + '|' + B : B + '|' + A; };

  /* ------------------------------------------------------------------ rule checking */
  function regions(p, pathNodes) {
    const used = new Set();
    for (let i = 0; i < pathNodes.length - 1; i++) used.add(ekey(pathNodes[i], pathNodes[i + 1]));
    const seen = {};
    const regs = [];
    for (let r = 0; r < p.R; r++) for (let c = 0; c < p.C; c++) {
      if (seen[key(r, c)] != null) continue;
      const stack = [[r, c]]; seen[key(r, c)] = regs.length; const reg = [];
      while (stack.length) {
        const [rr, cc] = stack.pop(); reg.push([rr, cc]);
        // neighbours: crossing the edge between cells
        const nb = [
          [rr - 1, cc, [cc, rr], [cc + 1, rr]], [rr + 1, cc, [cc, rr + 1], [cc + 1, rr + 1]],
          [rr, cc - 1, [cc, rr], [cc, rr + 1]], [rr, cc + 1, [cc + 1, rr], [cc + 1, rr + 1]],
        ];
        nb.forEach(([a, b, e1, e2]) => {
          if (a < 0 || b < 0 || a >= p.R || b >= p.C) return;
          if (used.has(ekey(e1, e2))) return;
          if (seen[key(a, b)] != null) return;
          seen[key(a, b)] = regs.length; stack.push([a, b]);
        });
      }
      regs.push(reg);
    }
    return { regs, used };
  }

  function check(p, pathNodes) {
    const bad = { cells: new Set(), dots: new Set(), edots: new Set() };
    const onPath = new Set(pathNodes.map(n => key(n[0], n[1])));
    (p.dots || []).forEach(d => { if (!onPath.has(key(d[0], d[1]))) bad.dots.add(key(d[0], d[1])); });
    const { regs, used } = regions(p, pathNodes);
    (p.edots || []).forEach(e => { if (!used.has(ekey(e[0], e[1]))) bad.edots.add(ekey(e[0], e[1])); });
    const dig = {}; (p.digits || []).forEach(([r, c, d]) => { dig[key(r, c)] = d; });
    const col = {}; (p.colors || []).forEach(([r, c, k]) => { col[key(r, c)] = k; });
    (p.counts || []).forEach(([r, c, k]) => {
      const sides = [[[c, r], [c + 1, r]], [[c, r + 1], [c + 1, r + 1]], [[c, r], [c, r + 1]], [[c + 1, r], [c + 1, r + 1]]];
      const n = sides.filter(([a, b]) => used.has(ekey(a, b))).length;
      if (n !== k) bad.cells.add(key(r, c));
    });
    regs.forEach(reg => {
      if (p.target != null) {
        const ds = reg.filter(([r, c]) => dig[key(r, c)] != null).map(([r, c]) => dig[key(r, c)]);
        const s = ds.reduce((a, b) => a + b, 0);
        if (ds.length && s !== p.target) reg.forEach(([r, c]) => { if (dig[key(r, c)] != null) bad.cells.add(key(r, c)); });
      }
      if (p.colors) {
        const ks = new Set(reg.filter(([r, c]) => col[key(r, c)] != null).map(([r, c]) => col[key(r, c)]));
        if (ks.size > 1) reg.forEach(([r, c]) => { if (col[key(r, c)] != null) bad.cells.add(key(r, c)); });
      }
    });
    const ok = !bad.cells.size && !bad.dots.size && !bad.edots.size;
    return { ok, bad };
  }
  I.check = check;

  /* the sum badge goes in the corner farthest from the start circle and the exit */
  function badgeCorner(p, Wd, Ht) {
    const corners = [[0, 0], [p.C, 0], [0, p.R], [p.C, p.R]];
    let best = corners[0], bd = -1;
    corners.forEach(([x, y]) => {
      const d = Math.min(Math.hypot(x - p.start[0], y - p.start[1]), Math.hypot(x - p.end[0], y - p.end[1]));
      if (d > bd) { bd = d; best = [x, y]; }
    });
    return [best[0] ? Wd - 58 : 58, best[1] ? Ht - 38 : 38];
  }
  I.badgeCorner = badgeCorner;

  /* ------------------------------------------------------------------ panel svg */
  const U = 100; // lattice spacing
  function buildPanelSVG(p, host, opts) {
    opts = opts || {};
    const pad = 70;
    const Wd = p.C * U + pad * 2, Ht = p.R * U + pad * 2;
    const svg = el('svg', { viewBox: `0 0 ${Wd} ${Ht}`, class: 'panel-svg' });
    const X = (x) => pad + x * U, Y = (y) => pad + y * U;
    el('rect', { x: 0, y: 0, width: Wd, height: Ht, rx: 26, class: 'pn-slab' }, svg);
    el('rect', { x: 10, y: 10, width: Wd - 20, height: Ht - 20, rx: 20, class: 'pn-inset' }, svg);
    const gaps = new Set((p.gaps || []).map(([a, b]) => ekey(a, b)));
    const lat = el('g', { class: 'pn-lattice' }, svg);
    for (let y = 0; y <= p.R; y++) for (let x = 0; x <= p.C; x++) {
      if (x < p.C) {
        if (gaps.has(ekey([x, y], [x + 1, y]))) {
          el('line', { x1: X(x), y1: Y(y), x2: X(x) + U * 0.38, y2: Y(y) }, lat);
          el('line', { x1: X(x + 1) - U * 0.38, y1: Y(y), x2: X(x + 1), y2: Y(y) }, lat);
        } else el('line', { x1: X(x), y1: Y(y), x2: X(x + 1), y2: Y(y) }, lat);
      }
      if (y < p.R) {
        if (gaps.has(ekey([x, y], [x, y + 1]))) {
          el('line', { x1: X(x), y1: Y(y), x2: X(x), y2: Y(y) + U * 0.38 }, lat);
          el('line', { x1: X(x), y1: Y(y + 1) - U * 0.38, x2: X(x), y2: Y(y + 1) }, lat);
        } else el('line', { x1: X(x), y1: Y(y), x2: X(x), y2: Y(y + 1) }, lat);
      }
    }
    // exit notch
    const [ex, ey] = p.end;
    const dir = ex === 0 ? [-1, 0] : ex === p.C ? [1, 0] : ey === 0 ? [0, -1] : [0, 1];
    el('line', { x1: X(ex), y1: Y(ey), x2: X(ex) + dir[0] * U * 0.32, y2: Y(ey) + dir[1] * U * 0.32, class: 'pn-exit' }, lat);
    // start circle
    el('circle', { cx: X(p.start[0]), cy: Y(p.start[1]), r: 24, class: 'pn-start' }, svg);
    // cell symbols
    const sym = el('g', { class: 'pn-sym' }, svg);
    const cellC = (r, c) => [X(c + 0.5), Y(r + 0.5)];
    const symEls = {};
    (p.digits || []).forEach(([r, c, d]) => {
      const [cx, cy] = cellC(r, c);
      let t;
      if (p.heights) {
        // elevation glyph: a column with notches, read off the land behind the panel
        const g = el('g', { class: 'pn-height' }, sym);
        const h = d * 7;
        el('rect', { x: cx - 9, y: cy + 32 - h, width: 18, height: h, rx: 2 }, g);
        for (let k = 1; k < d; k++) el('line', { x1: cx - 9, x2: cx + 9, y1: cy + 32 - k * 7, y2: cy + 32 - k * 7 }, g);
        t = g;
      } else {
        t = el('text', { x: cx, y: cy + 2, class: 'pn-digit' }, sym);
        t.textContent = d;
      }
      symEls[key(r, c)] = t;
    });
    (p.colors || []).forEach(([r, c, k]) => {
      const [cx, cy] = cellC(r, c);
      let s;
      if (p.stoneStyle === 'light') {
        s = el('g', { class: 'pn-stone pn-light-' + k }, sym);
        if (k) {
          el('circle', { cx, cy, r: 10 }, s);
          for (let a = 0; a < 8; a++) {
            const ang = a * Math.PI / 4;
            el('line', { x1: cx + Math.cos(ang) * 15, y1: cy + Math.sin(ang) * 15, x2: cx + Math.cos(ang) * 22, y2: cy + Math.sin(ang) * 22 }, s);
          }
        } else {
          el('circle', { cx, cy, r: 18, class: 'ring' }, s);
          el('path', { d: `M${cx},${cy - 18} A18,18 0 0,0 ${cx},${cy + 18} Z` }, s);
        }
      } else {
        s = el('rect', { x: cx - 17, y: cy - 17, width: 34, height: 34, rx: 9, class: 'pn-stone pn-stone-' + k }, sym);
      }
      symEls[key(r, c)] = s;
    });
    (p.counts || []).forEach(([r, c, k]) => {
      const [cx, cy] = cellC(r, c);
      const g = el('g', { class: 'pn-petals' }, sym);
      if (k === 0) el('circle', { cx, cy, r: 8, class: 'pn-petal-zero' }, g);
      for (let j = 0; j < k; j++) {
        const a = (j / k) * Math.PI * 2 - Math.PI / 4; // diagonal start: petals count sides, they don't point at them
        el('ellipse', { cx: cx + Math.cos(a) * 12, cy: cy + Math.sin(a) * 12, rx: 10, ry: 5.5, transform: `rotate(${a * 180 / Math.PI} ${cx + Math.cos(a) * 12} ${cy + Math.sin(a) * 12})` }, g);
      }
      el('circle', { cx, cy, r: 4.2, class: 'pn-petal-heart' }, g);
      symEls[key(r, c)] = g;
    });
    const dotEls = {};
    (p.dots || []).forEach(([x, y]) => {
      dotEls[key(x, y)] = el('path', { d: `M${X(x)},${Y(y) - 11} L${X(x) + 10},${Y(y)} L${X(x)},${Y(y) + 11} L${X(x) - 10},${Y(y)} Z`, class: 'pn-dot' }, svg);
    });
    (p.edots || []).forEach(([a, b]) => {
      const mx = (X(a[0]) + X(b[0])) / 2, my = (Y(a[1]) + Y(b[1])) / 2;
      dotEls[ekey(a, b)] = el('path', { d: `M${mx},${my - 11} L${mx + 10},${my} L${mx},${my + 11} L${mx - 10},${my} Z`, class: 'pn-dot' }, svg);
    });
    if (p.target != null) {
      const g = el('g', { class: 'pn-target' }, svg);
      const bc = badgeCorner(p, Wd, Ht);
      el('rect', { x: bc[0] - 40, y: bc[1] - 20, width: 80, height: 40, rx: 20 }, g);
      const t = el('text', { x: bc[0], y: bc[1] + 1 }, g);
      t.textContent = 'Σ ' + p.target;
    }
    const pathG = el('g', { class: 'pn-path' }, svg);
    const line = el('polyline', { points: '', class: 'pn-line' }, pathG);
    const head = el('circle', { r: 24, class: 'pn-head', cx: X(p.start[0]), cy: Y(p.start[1]), opacity: 0 }, pathG);
    host.appendChild(svg);
    return { svg, X, Y, line, head, symEls, dotEls, gaps, pad, Wd, Ht };
  }
  I.buildPanelSVG = buildPanelSVG;

  /* ------------------------------------------------------------------ drawing interaction */
  function attachDrawing(p, view, onDone) {
    const { svg, X, Y, line, head } = view;
    let drawing = false;
    let path = [];
    let tip = null; // pointer position projected on current edge
    const gaps = view.gaps;
    function toLocal(e) {
      const pt = svg.createSVGPoint(); pt.x = e.clientX; pt.y = e.clientY;
      const m = svg.getScreenCTM(); if (!m) return null;
      const q = pt.matrixTransform(m.inverse());
      return [(q.x - view.pad) / U, (q.y - view.pad) / U];
    }
    function render() {
      const pts = path.map(([x, y]) => `${X(x)},${Y(y)}`);
      if (tip) pts.push(`${X(tip[0])},${Y(tip[1])}`);
      line.setAttribute('points', pts.join(' '));
      const last = tip || path[path.length - 1];
      if (last) { head.setAttribute('cx', X(last[0])); head.setAttribute('cy', Y(last[1])); }
    }
    function canStep(a, b) {
      if (b[0] < 0 || b[1] < 0 || b[0] > p.C || b[1] > p.R) return false;
      if (gaps.has(ekey(a, b))) return false;
      return true;
    }
    function step(q) {
      // move the head toward q along the lattice, possibly several nodes
      for (let guard = 0; guard < 40; guard++) {
        const h = path[path.length - 1];
        const dx = q[0] - h[0], dy = q[1] - h[1];
        const ax = Math.abs(dx), ay = Math.abs(dy);
        const prev = path.length > 1 ? path[path.length - 2] : null;
        // retreat if pointer is back along the previous edge
        if (prev) {
          const bx = prev[0] - h[0], by = prev[1] - h[1];
          const proj = dx * bx + dy * by;
          if (proj > 0.5) { path.pop(); NF.Audio && NF.Audio.line(path.length); continue; }
        }
        if (h[0] === p.end[0] && h[1] === p.end[1]) {
          // the exit is the end of the line: no path can carry on past it (nodes can't repeat),
          // so a pointer that drifts on only pokes the stub out through the exit notch
          const ev = exitVector();
          const along = dx * ev[0] + dy * ev[1];
          tip = along > 0.02 ? [h[0] + ev[0] * Math.min(along, 0.32), h[1] + ev[1] * Math.min(along, 0.32)] : null;
          return;
        }
        let dir = ax >= ay ? [Math.sign(dx), 0] : [0, Math.sign(dy)];
        let amt = ax >= ay ? ax : ay;
        if (amt < 0.02) { tip = null; return; }
        let nxt = [h[0] + dir[0], h[1] + dir[1]];
        const blocked = (n) => !canStep(h, n) || path.some(([x, y]) => x === n[0] && y === n[1]);
        if (blocked(nxt)) {
          // try the other axis
          const alt = ax >= ay ? [0, Math.sign(dy) || 1] : [Math.sign(dx) || 1, 0];
          const altAmt = ax >= ay ? ay : ax;
          const n2 = [h[0] + alt[0], h[1] + alt[1]];
          if (altAmt > 0.15 && !blocked(n2)) { dir = alt; amt = altAmt; nxt = n2; }
          else {
            // partial tip stops at a short stub before a blocked node
            const lim = path.some(([x, y]) => x === nxt[0] && y === nxt[1]) ? 0.7 : 0.38;
            tip = canStep(h, nxt) || nxt[0] < 0 || nxt[1] < 0 || nxt[0] > p.C || nxt[1] > p.R ? null : null;
            const exitDir = p.end[0] === h[0] && p.end[1] === h[1] ? exitVector() : null;
            if (exitDir && dir[0] === exitDir[0] && dir[1] === exitDir[1]) { tip = [h[0] + dir[0] * Math.min(amt, 0.32), h[1] + dir[1] * Math.min(amt, 0.32)]; return; }
            tip = (amt > 0 && !(nxt[0] < 0 || nxt[1] < 0 || nxt[0] > p.C || nxt[1] > p.R)) ? [h[0] + dir[0] * Math.min(amt, lim), h[1] + dir[1] * Math.min(amt, lim)] : null;
            return;
          }
        }
        if (amt >= 0.5) {
          path.push(nxt);
          NF.Audio && NF.Audio.line(path.length);
          continue;
        }
        tip = [h[0] + dir[0] * amt, h[1] + dir[1] * amt];
        return;
      }
    }
    function exitVector() {
      const [ex, ey] = p.end;
      return ex === 0 ? [-1, 0] : ex === p.C ? [1, 0] : ey === 0 ? [0, -1] : [0, 1];
    }
    function atExit() {
      const h = path[path.length - 1];
      return h && h[0] === p.end[0] && h[1] === p.end[1];
    }
    let activeId = null, failTimer = null;
    function down(e) {
      if (I.lockedPanel) return;
      const q = toLocal(e); if (!q) return;
      const s = p.start;
      if (!drawing) {
        if (Math.hypot(q[0] - s[0], q[1] - s[1]) > 0.35) return;
        drawing = true;
        activeId = e.pointerId;
        clearTimeout(failTimer);
        line.getAnimations().forEach(a => a.cancel());
        line.style.opacity = 1;
        svg.setPointerCapture && svg.setPointerCapture(e.pointerId);
        path = [[s[0], s[1]]]; tip = null;
        head.setAttribute('opacity', 1);
        svg.classList.add('drawing');
        svg.classList.remove('failed', 'solved');
        clearBad();
        NF.Audio && NF.Audio.unlock();
        render();
        e.preventDefault();
      }
    }
    function move(e) {
      if (!drawing || e.pointerId !== activeId) return;
      const q = toLocal(e); if (!q) return;
      step(q); render();
    }
    function up(e) {
      if (!drawing || (e && e.pointerId !== activeId)) return;
      drawing = false;
      activeId = null;
      svg.classList.remove('drawing');
      if (atExit() && tip && Math.hypot(tip[0] - p.end[0], tip[1] - p.end[1]) > 0.15) finish();
      else if (atExit()) finish();
      else { // abandon
        line.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 500 }).finished.then(() => { if (!drawing) { path = []; tip = null; render(); line.style.opacity = 1; head.setAttribute('opacity', 0); } }, () => { /* cancelled by a new stroke */ });
      }
    }
    function clearBad() { svg.querySelectorAll('.bad').forEach(n => n.classList.remove('bad')); }
    function finish() {
      const res = check(p, path);
      if (res.ok) {
        svg.classList.add('solved');
        NF.Audio && NF.Audio.panelOk();
        onDone(path.slice());
      } else {
        svg.classList.add('failed');
        NF.Audio && NF.Audio.panelBad();
        res.bad.cells.forEach(k => view.symEls[k] && view.symEls[k].classList.add('bad'));
        res.bad.dots.forEach(k => view.dotEls[k] && view.dotEls[k].classList.add('bad'));
        res.bad.edots.forEach(k => view.dotEls[k] && view.dotEls[k].classList.add('bad'));
        failTimer = setTimeout(() => {
          if (drawing) return;
          line.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 700 }).finished.then(() => { if (!drawing) { path = []; tip = null; render(); line.style.opacity = 1; head.setAttribute('opacity', 0); svg.classList.remove('failed'); } }, () => { /* cancelled by a new stroke */ });
        }, 900);
      }
    }
    svg.addEventListener('pointerdown', down);
    svg.addEventListener('pointermove', move);
    svg.addEventListener('pointerup', up);
    svg.addEventListener('pointercancel', up);
    return {
      showSolved(nodes) {
        path = nodes.map(n => n.slice()); tip = null; render();
        head.setAttribute('opacity', 1);
        svg.classList.add('solved');
      },
    };
  }

  /* ------------------------------------------------------------------ 3D panels */
  function panelTexture(p, solvedPath) {
    const cnv = document.createElement('canvas');
    const pad = 70;
    const Wd = p.C * U + pad * 2, Ht = p.R * U + pad * 2;
    const scale = 512 / Math.max(Wd, Ht);
    cnv.width = Math.round(Wd * scale); cnv.height = Math.round(Ht * scale);
    const ctx = cnv.getContext('2d');
    ctx.scale(scale, scale);
    ctx.fillStyle = '#1f2a33'; ctx.fillRect(0, 0, Wd, Ht);
    ctx.fillStyle = '#26333e'; ctx.fillRect(10, 10, Wd - 20, Ht - 20);
    const X = (x) => pad + x * U, Y = (y) => pad + y * U;
    ctx.strokeStyle = solvedPath ? '#3c5160' : '#4b6577'; ctx.lineWidth = 22; ctx.lineCap = 'round';
    const gaps = new Set((p.gaps || []).map(([a, b]) => ekey(a, b)));
    for (let y = 0; y <= p.R; y++) for (let x = 0; x <= p.C; x++) {
      if (x < p.C && !gaps.has(ekey([x, y], [x + 1, y]))) { ctx.beginPath(); ctx.moveTo(X(x), Y(y)); ctx.lineTo(X(x + 1), Y(y)); ctx.stroke(); }
      if (y < p.R && !gaps.has(ekey([x, y], [x, y + 1]))) { ctx.beginPath(); ctx.moveTo(X(x), Y(y)); ctx.lineTo(X(x), Y(y + 1)); ctx.stroke(); }
    }
    ctx.fillStyle = '#4b6577'; ctx.beginPath(); ctx.arc(X(p.start[0]), Y(p.start[1]), 24, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#e8eef2'; ctx.font = '600 44px "Libre Franklin", sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    (p.digits || []).forEach(([r, c, d]) => { if (!p.heights) ctx.fillText(String(d), X(c + 0.5), Y(r + 0.5) + 2); });
    (p.colors || []).forEach(([r, c, k]) => {
      if (p.stoneStyle === 'light') {
        ctx.fillStyle = k ? '#ffd36b' : '#0d1218';
        ctx.beginPath(); ctx.arc(X(c + 0.5), Y(r + 0.5), k ? 12 : 18, 0, Math.PI * 2); ctx.fill();
      } else {
        ctx.fillStyle = k ? '#f4f1e6' : '#07090b'; ctx.fillRect(X(c + 0.5) - 17, Y(r + 0.5) - 17, 34, 34);
        if (!k) { ctx.strokeStyle = '#c9d6de'; ctx.lineWidth = 3.5; ctx.strokeRect(X(c + 0.5) - 17, Y(r + 0.5) - 17, 34, 34); }
      }
    });
    (p.counts || []).forEach(([r, c, k]) => {
      ctx.fillStyle = '#f2a7c3';
      for (let j = 0; j < k; j++) { const a = (j / k) * Math.PI * 2 - Math.PI / 4; ctx.beginPath(); ctx.ellipse(X(c + 0.5) + Math.cos(a) * 12, Y(r + 0.5) + Math.sin(a) * 12, 10, 5.5, a, 0, Math.PI * 2); ctx.fill(); }
      ctx.fillStyle = '#ffe08a'; ctx.beginPath(); ctx.arc(X(c + 0.5), Y(r + 0.5), 4.2, 0, Math.PI * 2); ctx.fill();
    });
    (p.dots || []).forEach(([x, y]) => { ctx.fillStyle = '#8fb3c4'; ctx.beginPath(); ctx.moveTo(X(x), Y(y) - 11); ctx.lineTo(X(x) + 10, Y(y)); ctx.lineTo(X(x), Y(y) + 11); ctx.lineTo(X(x) - 10, Y(y)); ctx.fill(); });
    if (p.target != null) { const bc = badgeCorner(p, Wd, Ht); ctx.fillStyle = '#e9c46a'; ctx.fillRect(bc[0] - 40, bc[1] - 20, 80, 40); ctx.fillStyle = '#22303a'; ctx.font = '700 22px "Libre Franklin", sans-serif'; ctx.fillText('Σ ' + p.target, bc[0], bc[1] + 1); }
    if (solvedPath) {
      ctx.strokeStyle = '#ffe9a6'; ctx.lineWidth = 22; ctx.shadowColor = '#ffd36b'; ctx.shadowBlur = 30;
      ctx.beginPath(); solvedPath.forEach(([x, y], i) => i ? ctx.lineTo(X(x), Y(y)) : ctx.moveTo(X(x), Y(y))); ctx.stroke();
    }
    return { cnv, aspect: Wd / Ht };
  }

  function makePanelObject(p, idx) {
    const W = NF.World, T = W.T;
    const { cnv, aspect } = panelTexture(p, I.solved[p.id]);
    const tex = new T.CanvasTexture(cnv);
    tex.encoding = T.LinearEncoding;
    const h = 2.0, w = h * aspect;
    const grp = new T.Group();
    const stone = new T.Mesh(new T.BoxGeometry(w + 0.3, h + 0.3, 0.28), new T.MeshStandardMaterial({ color: 0xd8d2c4, roughness: 0.9, flatShading: true }));
    stone.castShadow = true; stone.receiveShadow = true;
    const face = new T.Mesh(new T.PlaneGeometry(w, h), new T.MeshBasicMaterial({ map: tex, toneMapped: false }));
    face.position.z = 0.142;
    const post = new T.Mesh(new T.BoxGeometry(0.35, 1.4, 0.35), new T.MeshStandardMaterial({ color: 0xbfb7a6, roughness: 1 }));
    post.position.y = -h / 2 - 0.7; post.castShadow = true;
    const glow = new T.Mesh(new T.PlaneGeometry(w + 0.9, h + 0.9), new T.MeshBasicMaterial({ color: 0xffe9a6, transparent: true, opacity: 0, depthWrite: false, side: T.DoubleSide }));
    glow.position.z = -0.16;
    grp.add(stone, face, post, glow);
    const pl = p.place;
    const baseY = W.ISLAND_Y + (pl.y || 0) + h / 2 + 1.4;
    grp.position.set(pl.x, baseY, pl.z);
    grp.rotation.y = pl.rot || 0;
    grp.userData = { id: p.id, idx, face, glow, tex };
    face.userData.panel = idx;
    stone.userData.panel = idx;
    W.scene.add(grp);
    return grp;
  }

  function refreshPanelTexture(i) {
    const p = PANELS()[i];
    const o = I.objs[i];
    const { cnv } = panelTexture(p, I.solved[p.id]);
    const T = NF.World.T;
    o.userData.tex.image = cnv;
    o.userData.tex.needsUpdate = true;
  }

  const PANELS = () => NF.DATA.acts[4].panels;

  /* ------------------------------------------------------------------ camera */
  const camState = { pos: null, look: null };
  function camTween(pos, look, dur) {
    if (!I.active) return Promise.resolve(); // no frames run once the island has stopped
    const W = NF.World, T = W.T, camera = W.camera;
    const p0 = camera.position.clone();
    const l0 = camState.look ? camState.look.clone() : new T.Vector3(0, 1, 0);
    const p1 = new T.Vector3(...pos), l1 = new T.Vector3(...look);
    const t0 = performance.now();
    return new Promise(res => {
      I.tweenDone = res;
      I.tween = (now) => {
        let t = Math.min(1, (now - t0) / dur);
        const e = t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
        const arc = Math.sin(Math.PI * t) * 2.2;
        camera.position.lerpVectors(p0, p1, e); camera.position.y += arc;
        const l = l0.clone().lerp(l1, e);
        camera.lookAt(l);
        camState.look = l;
        if (t >= 1) { I.tween = null; I.tweenDone = null; res(); }
      };
    });
  }

  const overview = { yaw: 0.6, pitch: 0.5, dist: 36 };
  function overviewPose() {
    const cp = Math.cos(overview.pitch);
    const asp = window.innerWidth / Math.max(1, window.innerHeight);
    const dist = overview.dist * (asp < 1 ? Math.min(1.5, Math.sqrt(1 / asp)) : 1);
    return {
      pos: [Math.sin(overview.yaw) * cp * dist, 1 + Math.sin(overview.pitch) * dist, Math.cos(overview.yaw) * cp * dist],
      look: [0, 1.2, 0],
    };
  }
  function panelPose(i) {
    const p = PANELS()[i];
    const o = I.objs[i];
    const ry = o.rotation.y;
    const n = [Math.sin(ry), 0, Math.cos(ry)];
    const c = o.position;
    const d = 4.6;
    return { pos: [c.x + n[0] * d, c.y + 0.15, c.z + n[2] * d], look: [c.x, c.y, c.z] };
  }

  /* ------------------------------------------------------------------ flow */
  function unlockedIndex() {
    const ps = PANELS();
    let k = 0;
    while (k < ps.length && I.solved[ps[k].id]) k++;
    return k; // first unsolved
  }

  I.saveState = () => ({ solved: I.solved });
  function endingSeen() {
    const s = NF.helpers && NF.helpers.load ? NF.helpers.load() : null;
    return !!(s && s.acts && s.acts[4] && s.acts[4].solved);
  }
  I.canReveal = () => !!I.open && !I.solved[PANELS()[I.open.i].id];
  I.lastOpen = () => !!I.open && PANELS().every((p, i) => i === I.open.i || I.solved[p.id]);

  I.start = async function (saved) {
    const W = NF.World;
    app.dataset.act = '5';
    app.classList.add('world-on');
    I.active = true;
    $('#island').hidden = false;
    $('#stage').setAttribute('aria-hidden', 'true');
    if (saved && saved.panels && saved.panels.solved) I.solved = saved.panels.solved;
    if (W.failed || !W.scene) { return I.flat(); }
    W.buildUpTo(4);
    W.setEnv(W.ENV[4], 2);
    W.cam.user = true;
    PANELS().forEach((p, i) => { if (!I.objs[i]) I.objs[i] = makePanelObject(p, i); });
    I.objs.forEach(o => { if (o) o.visible = true; });
    (I.extras || []).forEach(m => { m.visible = true; });
    camState.look = new W.T.Vector3(0, 1.2, 0);
    // start looking across the island towards the panel to open next (on a portrait phone the
    // fixed starting angle left it off-screen)
    const next = unlockedIndex();
    if (next < PANELS().length && I.objs[next]) { const pp = I.objs[next].position; overview.yaw = Math.atan2(pp.x, pp.z); }
    const ov = overviewPose();
    W.camera.position.set(...ov.pos);
    W.camera.lookAt(0, 1.2, 0);
    W.onFrame = frameHook;
    bindWorldInput();
    updateGlows();
    const k = unlockedIndex();
    if (k >= PANELS().length) {
      if (!endingSeen()) return finale(); // a reload interrupted the ending: play it once
      hint('Every panel is lit.'); return;
    }
    hint(k === 0 ? 'The island is yours. Click the panel under the light.' : 'Click the panel under the light.');
  };

  I.stop = function () {
    I.active = false;
    I.run = (I.run || 0) + 1; // cancels a finale in progress
    I.inFinale = false;
    if (I.tween) { I.tween = null; const d = I.tweenDone; I.tweenDone = null; d && d(); }
    closePanel(true);
    (I.objs || []).forEach(o => { if (o) o.visible = false; });
    if (I.marker) I.marker.visible = false;
    (I.extras || []).forEach(m => { m.visible = false; });
    const W = NF.World;
    if (W && W.cam) W.cam.user = null;
    if (W) W.onFrame = null;
    $('#island').hidden = true;
  };

  function hint(t) { $('#islandHint').textContent = (t || '').replace(/\bClick\b/g, matchMedia('(pointer: coarse)').matches ? 'Tap' : 'Click'); }

  let dragging = null;
  function bindWorldInput() {
    if (I.bound) return;
    I.bound = true;
    const cv = document.getElementById('world');
    const layer = document.getElementById('island');
    // the island layer catches pointer events when no panel is open; touch drags turn the
    // island instead of panning the page
    layer.style.pointerEvents = 'auto';
    layer.style.touchAction = 'none';
    layer.addEventListener('pointerdown', (e) => {
      if (I.open || !I.active || I.busy) return;
      if (e.target.closest('.panel-wrap')) return;
      dragging = { x: e.clientX, y: e.clientY, yaw: overview.yaw, pitch: overview.pitch, moved: false };
    });
    window.addEventListener('pointermove', (e) => {
      if (!dragging) return;
      const dx = e.clientX - dragging.x, dy = e.clientY - dragging.y;
      if (Math.abs(dx) + Math.abs(dy) > 4) dragging.moved = true;
      overview.yaw = dragging.yaw - dx * 0.005;
      overview.pitch = Math.max(0.15, Math.min(1.2, dragging.pitch + dy * 0.004));
    });
    window.addEventListener('pointerup', (e) => {
      if (!dragging) return;
      const d = dragging; dragging = null;
      if (!d.moved) pick(e);
    });
    window.addEventListener('pointercancel', () => { dragging = null; });
    layer.addEventListener('wheel', (e) => {
      if (I.open) return;
      overview.dist = Math.max(18, Math.min(60, overview.dist * (1 + Math.sign(e.deltaY) * 0.08)));
    }, { passive: true });
  }

  function pick(e) {
    const W = NF.World, T = W.T;
    const ray = new T.Raycaster();
    const m = new T.Vector2((e.clientX / window.innerWidth) * 2 - 1, -(e.clientY / window.innerHeight) * 2 + 1);
    ray.setFromCamera(m, W.camera);
    if (I.marker && I.marker.visible && ray.intersectObject(I.marker, false).length) { openPanel(unlockedIndex()); return; } // the light itself
    const hits = ray.intersectObjects(I.objs.map(o => o.children).flat(), false);
    const h = hits.find(x => x.object.userData.panel != null);
    if (!h) return;
    const i = h.object.userData.panel;
    if (i > unlockedIndex()) { NF.toast('That panel is still dark. Follow the light.'); return; }
    openPanel(i);
  }

  function frameHook(t) {
    const W = NF.World;
    if (I.tween) { I.tween(performance.now()); return; }
    if (!I.open && !I.busy) {
      if (!dragging) overview.yaw += 0.0006;
      const ov = overviewPose();
      W.camera.position.lerp(new W.T.Vector3(...ov.pos), 0.05);
      camState.look = camState.look ? camState.look.lerp(new W.T.Vector3(...ov.look), 0.05) : new W.T.Vector3(...ov.look);
      W.camera.lookAt(camState.look);
    }
    // glows pulse; a marker bobs over the next panel
    const k = unlockedIndex();
    if (I.marker) {
      const o = I.objs[k];
      I.marker.visible = !!o && !I.open;
      if (o) {
        I.marker.position.set(o.position.x, o.position.y + 2.0 + Math.sin(t * 2.2) * 0.22, o.position.z);
        I.marker.rotation.y = t * 1.4;
      }
    }
    I.objs.forEach((o, i) => {
      const g = o.userData.glow.material;
      const target = I.solved[PANELS()[i].id] ? 0.35 : i === k ? 0.25 + 0.2 * Math.sin(t * 2.4) : 0;
      g.opacity += (target - g.opacity) * 0.08;
    });
    if (I.cable) I.cable(t);
  }

  function updateGlows() {
    const W = NF.World, T = W.T;
    if (!I.marker) {
      I.marker = new T.Mesh(new T.OctahedronGeometry(0.55, 0), new T.MeshBasicMaterial({ color: 0xfff6cf }));
      W.scene.add(I.marker);
    }
  }

  async function openPanel(i) {
    if (I.busy) return;
    I.busy = true;
    const p = PANELS()[i];
    hint('');
    const pose = panelPose(i);
    await camTween(pose.pos, pose.look, 1500);
    const host = $('#panelHost');
    host.innerHTML = '';
    const wrap = document.createElement('div');
    wrap.className = 'panel-wrap';
    const back = document.createElement('button');
    back.className = 'panel-back'; back.textContent = 'Back to the island';
    back.addEventListener('click', () => closePanel());
    const title = document.createElement('div');
    title.className = 'panel-title';
    title.innerHTML = `<span class="pt-n">${i + 1} / ${PANELS().length}</span><span class="pt-t">${p.title}</span>`;
    const legend = document.createElement('p');
    legend.className = 'panel-legend';
    legend.innerHTML = p.legend || '';
    const box = document.createElement('div');
    box.className = 'panel-box';
    wrap.append(title, box, legend, back);
    host.appendChild(wrap);
    host.style.pointerEvents = 'auto';
    const view = buildPanelSVG(p, box);
    const done = (path) => solved(i, path, ctl);
    const ctl = attachDrawing(p, view, done);
    if (I.solved[p.id]) ctl.showSolved(I.solved[p.id]);
    wrap.animate([{ opacity: 0, transform: 'translate(-50%, -50%) scale(.96)' }, { opacity: 1, transform: 'translate(-50%, -50%)' }], { duration: 500, easing: 'ease-out' });
    I.open = { i, wrap, ctl, done };
    I.objs[i].visible = false;
    I.busy = false;
  }

  async function closePanel(instant) {
    const o = I.open;
    if (!o) return;
    I.open = null;
    if (I.objs[o.i]) I.objs[o.i].visible = true;
    const host = $('#panelHost');
    if (!instant) await o.wrap.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 350 }).finished.catch(() => { });
    host.innerHTML = '';
    host.style.pointerEvents = 'none';
    if (instant) return;
    const W = NF.World;
    if (!W || W.failed || !W.camera) { I.flat(); return; }
    I.busy = true;
    const k = unlockedIndex();
    if (k < PANELS().length && I.objs[k]) { const pp = I.objs[k].position; overview.yaw = Math.atan2(pp.x, pp.z); }
    const ov = overviewPose();
    await camTween(ov.pos, ov.look, 1400);
    I.busy = false;
    if (k < PANELS().length) hint('Click the panel under the light.');
  }
  I.closePanel = closePanel;

  async function solved(i, path, ctl) {
    const p = PANELS()[i];
    const first = !I.solved[p.id];
    I.solved[p.id] = path;
    NF.save();
    refreshPanelTexture(i);
    if (!first) return;
    const ps = PANELS();
    await sleep(900);
    if (!I.active) return; // the player left the island meanwhile
    if (i === ps.length - 1) { await closePanel(); if (!I.active) return; return finale(); }
    NF.toast(i === ps.length - 2 ? 'One panel left. It stands at the centre.' : 'A light runs to the next panel.');
    await closePanel();
    if (!I.active) return;
    runCable(i, i + 1);
  }

  function runCable(a, b) {
    const W = NF.World, T = W.T;
    const A = I.objs[a].position, B = I.objs[b].position;
    const y = W.ISLAND_Y + 0.1;
    const pts = [new T.Vector3(A.x, y, A.z), new T.Vector3((A.x + B.x) / 2, y + 0.05, (A.z + B.z) / 2 + (A.x - B.x) * 0.15), new T.Vector3(B.x, y, B.z)];
    const curve = new T.CatmullRomCurve3(pts);
    const geo = new T.TubeGeometry(curve, 80, 0.06, 6, false);
    const mat = new T.MeshBasicMaterial({ color: 0xffe9a6, transparent: true, opacity: 0.95 });
    const mesh = new T.Mesh(geo, mat);
    geo.setDrawRange(0, 0);
    W.scene.add(mesh);
    (I.extras = I.extras || []).push(mesh);
    const total = geo.index ? geo.index.count : geo.attributes.position.count;
    const t0 = performance.now();
    I.cable = () => {
      const t = Math.min(1, (performance.now() - t0) / 2600);
      geo.setDrawRange(0, Math.floor(total * t));
      if (t >= 1) I.cable = null;
    };
  }

  I.reveal = function () {
    if (!I.open) return;
    const p = PANELS()[I.open.i];
    I.open.ctl.showSolved(p.solution);
    I.open.done(p.solution);
  };

  I.key = function (e) {
    const W = NF.World;
    if (!W || W.failed || !W.scene) return; // flat fallback: the panel is the whole view
    if (e.key === 'Escape' && I.open) closePanel();
  };

  /* fallback without WebGL: a simple list of panels */
  I.flat = function () {
    const host = $('#panelHost');
    host.style.pointerEvents = 'auto';
    const k = unlockedIndex();
    if (k >= PANELS().length) {
      if (!endingSeen()) return finale();
      host.innerHTML = ''; hint('Every panel is lit.'); return;
    }
    const p = PANELS()[k];
    host.innerHTML = '';
    const wrap = document.createElement('div'); wrap.className = 'panel-wrap';
    const title = document.createElement('div'); title.className = 'panel-title';
    title.innerHTML = `<span class="pt-n">${k + 1} / ${PANELS().length}</span><span class="pt-t">${p.title}</span>`;
    const box = document.createElement('div'); box.className = 'panel-box';
    const legend = document.createElement('p'); legend.className = 'panel-legend'; legend.innerHTML = p.legend || '';
    wrap.append(title, box, legend); host.appendChild(wrap);
    const view = buildPanelSVG(p, box);
    const done = (path) => { I.solved[p.id] = path; NF.save(); I.open = null; setTimeout(() => I.flat(), 1200); };
    const ctl = attachDrawing(p, view, done);
    I.open = { i: k, wrap, ctl, done };
  };

  /* ------------------------------------------------------------------ finale */
  async function finale() {
    if (!I.active) return;
    I.busy = true;
    I.inFinale = true;
    const run = I.run = (I.run || 0) + 1;
    hint('');
    const host = $('#panelHost'); host.innerHTML = ''; host.style.pointerEvents = 'none';
    const W = NF.World;
    NF.Audio && NF.Audio.swell();
    if (W && W.scene && !W.failed) {
      W.setEnv(Object.assign({}, W.ENV[4], { top: 0x35477a, horizon: 0xf7a86a, bottom: 0x2b3456, fog: 0xe8a77a, sun: [-0.9, 0.12, 0.3], sunCol: 0xff9a55, sunI: 1.7, hemiSky: 0xffc9a0, hemiI: 0.4, deep: 0x23466e, shallow: 0x6a8fb0, sea: 0xf0a878, bloom: 0.9, flies: 0.9, fliesCol: 0xffd27a }), 7);
      drawFinalPath();
      await camTween([0, 34, 26], [0, 0.5, 0], 5200);
    }
    await sleep(3200);
    I.inFinale = false;
    if (I.run !== run || !I.active) return; // the player left the island meanwhile
    credits();
  }
  I.finale = finale;

  function drawFinalPath() {
    const W = NF.World, T = W.T;
    const ps = PANELS();
    const fp = ps[ps.length - 1];
    const path = I.solved[fp.id] || fp.solution;
    // scale the last panel's line across the whole island
    const span = 21;
    const sx = span / fp.C, sz = span / fp.R;
    const pts = path.map(([x, y]) => new T.Vector3(-span / 2 + x * sx, 0, -span / 2 + y * sz));
    // lift the line over the plateaus
    const heightAt = (v) => {
      let best = W.ISLAND_Y + 0.3;
      W.plateaus.forEach((P) => {
        if (!P) return;
        const [px, pz] = W.POS[P.k];
        const c = Math.round(v.x - px + 4), r = Math.round(v.z - pz + 4);
        if (r >= 0 && c >= 0 && r < 9 && c < 9) best = Math.max(best, W.ISLAND_Y + P.h[r * 9 + c] + 0.35);
      });
      return best;
    };
    const dense = [];
    for (let i = 0; i < pts.length - 1; i++) {
      for (let k = 0; k < 12; k++) {
        const v = pts[i].clone().lerp(pts[i + 1], k / 12);
        v.y = heightAt(v);
        dense.push(v);
      }
    }
    const last = pts[pts.length - 1].clone(); last.y = heightAt(last); dense.push(last);
    const curve = new T.CatmullRomCurve3(dense, false, 'catmullrom', 0.1);
    const geo = new T.TubeGeometry(curve, dense.length * 3, 0.26, 10, false);
    const mat = new T.MeshBasicMaterial({ color: 0xfff4cc });
    const mesh = new T.Mesh(geo, mat);
    const glowGeo = new T.TubeGeometry(curve, dense.length * 3, 0.75, 10, false);
    const glow = new T.Mesh(glowGeo, new T.MeshBasicMaterial({ color: 0xffc35a, transparent: true, opacity: 0.28, blending: T.AdditiveBlending, depthWrite: false }));
    geo.setDrawRange(0, 0); glowGeo.setDrawRange(0, 0);
    W.scene.add(mesh, glow);
    (I.extras = I.extras || []).push(mesh, glow);
    const total = geo.index.count, totalG = glowGeo.index.count;
    const t0 = performance.now();
    I.cable = (tt) => {
      const t = Math.min(1, (performance.now() - t0) / 6500);
      const e = t * t * (3 - 2 * t);
      geo.setDrawRange(0, Math.floor(total * e));
      glowGeo.setDrawRange(0, Math.floor(totalG * e));
      glow.material.opacity = 0.22 + 0.08 * Math.sin(performance.now() / 300);
    };
  }

  function credits() {
    NF.markActSolved && NF.markActSolved(4);
    const c = document.createElement('div');
    c.id = 'credits';
    // cells the player actually fills: the 4x4's blanks, then every non-given cell of Acts I-IV
    const acts = NF.DATA.acts;
    let placed = 16 - ((acts[0].prelude && acts[0].prelude.givens) || []).length;
    for (let k = 0; k < 4; k++) {
      let g = (acts[k].givens || []).length;
      (acts[k].stages || []).forEach(st => { g += (st.givens || []).length; });
      placed += 81 - g;
    }
    c.innerHTML = `
      <div class="cr-inner">
        <p class="cr-kicker">The island is complete.</p>
        <h1>Ninefold</h1>
        <p class="cr-line">A sudoku that grew: from a 4×4 seed, through ink, vines, fog and survey, to a line drawn across the land you made.</p>
        <dl class="cr-stats">
          <div><dt>Grids</dt><dd>5</dd></div>
          <div><dt>Cells solved</dt><dd>${placed}</dd></div>
          <div><dt>Panels lit</dt><dd>${PANELS().length}</dd></div>
          <div><dt>Rule types</dt><dd>${NF.DATA.ruleCount || 30}</dd></div>
        </dl>
        <div class="cr-actions"><button id="crExplore">Keep exploring</button><button id="crMenu">Chapters</button></div>
      </div>`;
    app.appendChild(c);
    c.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 2400, fill: 'forwards' });
    c.querySelector('#crExplore').addEventListener('click', () => { c.remove(); I.busy = false; hint('Drag to look around.'); });
    if (!NF.World || NF.World.failed || !NF.World.scene) c.querySelector('#crExplore').hidden = true; // nothing to look around without 3D
    c.querySelector('#crMenu').addEventListener('click', () => { c.remove(); I.busy = false; hint('Every panel is lit.'); document.getElementById('menuBtn').click(); });
  }
})();
