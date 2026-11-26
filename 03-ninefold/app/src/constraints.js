/* Ninefold — constraint renderers. Each returns {g, grow(delay)} so stages can animate clues in. */
(function () {
  const S = NF.S;
  const el = NF.svgEl;

  const LINE_STYLE = {
    whisper: { cls: 'ln-whisper', w: 0.24 },
    dutch: { cls: 'ln-dutch', w: 0.24 },
    renban: { cls: 'ln-renban', w: 0.30 },
    nabner: { cls: 'ln-nabner', w: 0.26 },
    palindrome: { cls: 'ln-palindrome', w: 0.24 },
    regionsum: { cls: 'ln-regionsum', w: 0.18 },
    between: { cls: 'ln-between', w: 0.12 },
    entropic: { cls: 'ln-entropic', w: 0.22 },
    modular: { cls: 'ln-modular', w: 0.22 },
    parity: { cls: 'ln-parity', w: 0.20 },
    zipper: { cls: 'ln-zipper', w: 0.22 },
  };

  function centre(grid, rc) { return [grid.cx(rc[1]), grid.cy(rc[0])]; }

  function pathD(pts) {
    return pts.map((p, i) => (i ? 'L' : 'M') + p[0].toFixed(1) + ',' + p[1].toFixed(1)).join(' ');
  }

  function drawable(path, len) {
    // stroke draw-in animation via pathLength
    path.setAttribute('pathLength', '1');
    path.style.strokeDasharray = '1 1';
    path.style.strokeDashoffset = '1';
    return (delay, dur) => {
      path.animate([{ strokeDashoffset: 1 }, { strokeDashoffset: 0 }], {
        duration: dur || 900, delay: delay || 0, easing: 'cubic-bezier(.6,.05,.2,1)', fill: 'forwards',
      });
    };
  }

  function popIn(node, origin) {
    node.style.transformBox = 'fill-box';
    node.style.transformOrigin = 'center';
    node.style.opacity = '0';
    return (delay) => {
      node.animate([
        { transform: 'scale(0.2)', opacity: 0 },
        { transform: 'scale(1.18)', opacity: 1, offset: 0.7 },
        { transform: 'scale(1)', opacity: 1 },
      ], { duration: 520, delay: delay || 0, easing: 'cubic-bezier(.3,.7,.3,1)', fill: 'forwards' });
    };
  }

  function fadeIn(node) {
    node.style.opacity = '0';
    return (delay, dur) => node.animate([{ opacity: 0 }, { opacity: 1 }], { duration: dur || 600, delay: delay || 0, fill: 'forwards' });
  }

  /* ------------------------------------------------------------- killer cage outline */
  function cageSegments(grid, cells) {
    const set = new Set(cells.map(([r, c]) => r * 100 + c));
    const has = (r, c) => set.has(r * 100 + c);
    const d = S * 0.09;
    const segs = [];
    cells.forEach(([r, c]) => {
      const x0 = grid.M + c * S, y0 = grid.M + r * S, x1 = x0 + S, y1 = y0 + S;
      // top
      if (!has(r - 1, c)) {
        const xl = !has(r, c - 1) ? x0 + d : (has(r - 1, c - 1) ? x0 - d : x0);
        const xr = !has(r, c + 1) ? x1 - d : (has(r - 1, c + 1) ? x1 + d : x1);
        segs.push([[xl, y0 + d], [xr, y0 + d]]);
      }
      if (!has(r + 1, c)) {
        const xl = !has(r, c - 1) ? x0 + d : (has(r + 1, c - 1) ? x0 - d : x0);
        const xr = !has(r, c + 1) ? x1 - d : (has(r + 1, c + 1) ? x1 + d : x1);
        segs.push([[xl, y1 - d], [xr, y1 - d]]);
      }
      if (!has(r, c - 1)) {
        const yt = !has(r - 1, c) ? y0 + d : (has(r - 1, c - 1) ? y0 - d : y0);
        const yb = !has(r + 1, c) ? y1 - d : (has(r + 1, c - 1) ? y1 + d : y1);
        segs.push([[x0 + d, yt], [x0 + d, yb]]);
      }
      if (!has(r, c + 1)) {
        const yt = !has(r - 1, c) ? y0 + d : (has(r - 1, c + 1) ? y0 - d : y0);
        const yb = !has(r + 1, c) ? y1 - d : (has(r + 1, c + 1) ? y1 + d : y1);
        segs.push([[x1 - d, yt], [x1 - d, yb]]);
      }
    });
    return segs;
  }

  // corner-mark slots (grid.js CORNER_POS): 0 TL, 1 TR, 2 BL, 3 BR, 4 top, 5 bottom, 6 left, 7 right, 8 centre
  function edgeSlots(a, b) {
    // the two cells either side of an edge clue lose the mark slot nearest that edge
    const [p, q] = (a[0] < b[0] || a[1] < b[1]) ? [a, b] : [b, a];
    return p[0] === q[0] ? [[p[0], p[1], 7], [q[0], q[1], 6]] : [[p[0], p[1], 5], [q[0], q[1], 4]];
  }

  function topLeft(cells) {
    return cells.slice().sort((a, b) => a[0] - b[0] || a[1] - b[1])[0];
  }

  /* ------------------------------------------------------------- renderers */
  const R = {};

  R.killer = (grid, k) => {
    const g = el('g', { class: 'c-killer' });
    const segs = cageSegments(grid, k.cells);
    const d = segs.map(s => `M${s[0][0].toFixed(1)},${s[0][1].toFixed(1)} L${s[1][0].toFixed(1)},${s[1][1].toFixed(1)}`).join(' ');
    const p = el('path', { d, class: 'cage-line' }, g);
    const tl = topLeft(k.cells);
    const x = grid.M + tl[1] * S + 2.5, y = grid.M + tl[0] * S + 2.5;
    const txt = String(k.sum);
    const w = 6 + txt.length * 9.5;
    const lab = el('g', { class: 'cage-label' }, g);
    el('rect', { x, y, width: w, height: 17, class: 'cage-bg', rx: 2 }, lab);
    const t = el('text', { x: x + 3.5, y: y + 13.5, class: 'cage-sum' }, lab);
    t.textContent = txt;
    // the dashed cage is drawn in with an opacity sweep (dasharray is used by the dashes themselves)
    p.style.opacity = 0; lab.style.opacity = 0;
    const grow = (delay) => {
      p.animate([{ opacity: 0, strokeDashoffset: 40 }, { opacity: 1, strokeDashoffset: 0 }], { duration: 900, delay, fill: 'forwards', easing: 'ease-out' });
      lab.animate([{ opacity: 0, transform: 'translateY(-6px)' }, { opacity: 1, transform: 'none' }], { duration: 500, delay: delay + 450, fill: 'forwards' });
    };
    return { g, layer: 'over', grow, reserve: [[tl[0], tl[1], 0]] };
  };

  R.thermo = (grid, k) => {
    const g = el('g', { class: 'c-thermo' });
    const pts = k.cells.map(rc => centre(grid, rc));
    const line = el('path', { d: pathD(pts), class: 'thermo-line', 'stroke-width': S * 0.3 }, g);
    const bulb = el('circle', { cx: pts[0][0], cy: pts[0][1], r: S * 0.39, class: 'thermo-bulb' }, g);
    const a = drawable(line), b = popIn(bulb);
    return { g, layer: 'under', grow: (d) => { b(d); a(d + 250, 1000); } };
  };

  R.arrow = (grid, k) => {
    const g = el('g', { class: 'c-arrow' });
    const c0 = centre(grid, k.circle);
    const pts = k.cells.map(rc => centre(grid, rc));
    const rad = S * 0.39;
    const first = pts[0];
    const dx = first[0] - c0[0], dy = first[1] - c0[1];
    const L = Math.hypot(dx, dy);
    const start = [c0[0] + dx / L * rad, c0[1] + dy / L * rad];
    const all = [start].concat(pts);
    // arrowhead at the end
    const e = all[all.length - 1], p = all[all.length - 2];
    const ang = Math.atan2(e[1] - p[1], e[0] - p[0]);
    const hl = S * 0.22;
    const tip = [e[0] + Math.cos(ang) * S * 0.08, e[1] + Math.sin(ang) * S * 0.08];
    all[all.length - 1] = tip;
    const shaft = el('path', { d: pathD(all), class: 'arrow-line' }, g);
    const head = el('path', {
      d: `M${(tip[0] - Math.cos(ang - 0.6) * hl).toFixed(1)},${(tip[1] - Math.sin(ang - 0.6) * hl).toFixed(1)} L${tip[0].toFixed(1)},${tip[1].toFixed(1)} L${(tip[0] - Math.cos(ang + 0.6) * hl).toFixed(1)},${(tip[1] - Math.sin(ang + 0.6) * hl).toFixed(1)}`,
      class: 'arrow-line',
    }, g);
    const circ = el('circle', { cx: c0[0], cy: c0[1], r: rad, class: 'arrow-circle' }, g);
    const a = drawable(shaft), b = popIn(circ), h = fadeIn(head);
    return { g, layer: 'under', grow: (d) => { b(d); a(d + 200, 800); h(d + 900, 300); } };
  };

  function edgeMid(grid, cells) {
    const [a, b] = cells;
    return [(grid.cx(a[1]) + grid.cx(b[1])) / 2, (grid.cy(a[0]) + grid.cy(b[0])) / 2];
  }

  R.x = R.v = (grid, k) => {
    const g = el('g', { class: 'c-xv' });
    const [x, y] = edgeMid(grid, k.cells);
    el('circle', { cx: x, cy: y, r: S * 0.17, class: 'xv-bg' }, g);
    const t = el('text', { x, y: y + 1, class: 'xv-text' }, g);
    t.textContent = k.type.toUpperCase();
    return { g, layer: 'over', grow: popIn(g), reserve: edgeSlots(k.cells[0], k.cells[1]) };
  };

  R.kwhite = R.kblack = (grid, k) => {
    const g = el('g', { class: 'c-kropki' });
    const [x, y] = edgeMid(grid, k.cells);
    el('circle', { cx: x, cy: y, r: S * 0.125, class: k.type === 'kwhite' ? 'kropki-white' : 'kropki-black' }, g);
    return { g, layer: 'over', grow: popIn(g), reserve: edgeSlots(k.cells[0], k.cells[1]) };
  };

  function lineRenderer(type) {
    return (grid, k) => {
      const st = LINE_STYLE[type];
      const g = el('g', { class: 'c-line ' + st.cls });
      const pts = k.cells.map(rc => centre(grid, rc));
      const path = el('path', { d: pathD(pts), class: 'line-path', 'stroke-width': S * st.w }, g);
      const draw = drawable(path);
      let extras = [];
      if (type === 'between') {
        [pts[0], pts[pts.length - 1]].forEach(p => {
          const c = el('circle', { cx: p[0], cy: p[1], r: S * 0.39, class: 'between-circle' }, g);
          extras.push(popIn(c));
        });
      }
      if (grid.vineMode) {
        // decorative leaves along the vine
        const leaves = el('g', { class: 'vine-leaves' }, g);
        const leafEls = [];
        for (let i = 0; i < pts.length - 1; i++) {
          const a = pts[i], b = pts[i + 1];
          const ang = Math.atan2(b[1] - a[1], b[0] - a[0]) * 180 / Math.PI;
          const mx = (a[0] + b[0]) / 2, my = (a[1] + b[1]) / 2;
          const side = i % 2 ? 1 : -1;
          const sc = (0.8 + (i % 3) * 0.12).toFixed(2);
          const rot = (ang + side * 55).toFixed(1);
          const leaf = el('path', {
            d: 'M0,0 C4,-7 13,-8 17,-2 C11,1 5,2 0,0 Z',
            class: 'vine-leaf',
            transform: `translate(${mx.toFixed(1)},${my.toFixed(1)}) rotate(${rot}) scale(${sc})`,
          }, leaves);
          leaf.dataset.css = `translate(${mx.toFixed(1)}px,${my.toFixed(1)}px) rotate(${rot}deg) scale(${sc})`;
          leafEls.push(leaf);
        }
        leafEls.forEach(l => { l.style.opacity = 0; });
        extras.push((d) => {
          leafEls.forEach((l, j) => l.animate([{ opacity: 0, transform: l.dataset.css + ' scale(0.1)' },
            { opacity: 1, transform: l.dataset.css }], { duration: 500, delay: d + 300 + j * (900 / Math.max(1, leafEls.length)), fill: 'forwards', easing: 'ease-out' }));
        });
      }
      return { g, layer: 'under', grow: (d) => { draw(d, 1200 + pts.length * 60); extras.forEach(f => f(d)); } };
    };
  }
  Object.keys(LINE_STYLE).forEach(t => { R[t] = lineRenderer(t); });

  R.quad = (grid, k) => {
    const g = el('g', { class: 'c-quad' });
    const tl = topLeft(k.cells);
    const x = grid.M + (tl[1] + 1) * S, y = grid.M + (tl[0] + 1) * S;
    const inner = el('g', { class: 'quad-inner' }, g);
    el('circle', { cx: x, cy: y, r: S * 0.27, class: 'quad-circle' }, inner);
    const ds = k.digits;
    const pos = ds.length === 1 ? [[0, 0]] : ds.length === 2 ? [[-0.09, 0], [0.09, 0]] : ds.length === 3 ? [[-0.09, -0.08], [0.09, -0.08], [0, 0.1]] : [[-0.09, -0.08], [0.09, -0.08], [-0.09, 0.1], [0.09, 0.1]];
    ds.forEach((d, j) => {
      const t = el('text', { x: x + pos[j][0] * S, y: y + pos[j][1] * S + 1, class: 'quad-text' }, inner);
      t.textContent = d;
    });
    const [r0, c0] = tl;
    return { g, layer: 'over', grow: popIn(g), reserve: [[r0, c0, 3], [r0, c0 + 1, 2], [r0 + 1, c0, 1], [r0 + 1, c0 + 1, 0]] };
  };

  R.even = R.odd = (grid, k) => {
    const g = el('g', { class: 'c-parity1' });
    const [x, y] = centre(grid, k.cells[0]);
    if (k.type === 'even') el('rect', { x: x - S * 0.36, y: y - S * 0.36, width: S * 0.72, height: S * 0.72, class: 'even-mark', rx: 3 }, g);
    else el('circle', { cx: x, cy: y, r: S * 0.38, class: 'odd-mark' }, g);
    return { g, layer: 'under', grow: popIn(g) };
  };

  /* outside clues ------------------------------------------------------------ */
  function outsidePos(grid, side, index) {
    const M = grid.M, N = grid.N;
    if (side === 'L') return [M - S / 2, grid.cy(index)];
    if (side === 'R') return [M + N * S + S / 2, grid.cy(index)];
    if (side === 'T') return [grid.cx(index), M - S / 2];
    return [grid.cx(index), M + N * S + S / 2];
  }

  R.sandwich = (grid, k) => {
    const g = el('g', { class: 'c-out c-sandwich' });
    const [x, y] = outsidePos(grid, k.side, k.index);
    el('rect', { x: x - S * 0.32, y: y - S * 0.2, width: S * 0.64, height: S * 0.4, rx: S * 0.18, class: 'sandwich-bun' }, g);
    const t = el('text', { x, y: y + 1, class: 'out-text' }, g);
    t.textContent = k.value;
    return { g, layer: 'outside', grow: popIn(g), side: k.side, index: k.index };
  };
  R.xsum = (grid, k) => {
    const g = el('g', { class: 'c-out c-xsum' });
    const [x, y] = outsidePos(grid, k.side, k.index);
    const t = el('text', { x: x - 3, y: y + 1, class: 'out-text' }, g);
    t.textContent = k.value;
    const s = el('text', { x: x + S * 0.24, y: y - S * 0.17, class: 'out-tag' }, g);
    s.textContent = 'x';
    return { g, layer: 'outside', grow: popIn(g), side: k.side, index: k.index };
  };
  R.skyscraper = (grid, k) => {
    const g = el('g', { class: 'c-out c-sky' });
    const [x, y] = outsidePos(grid, k.side, k.index);
    const rot = { L: 90, R: -90, T: 180, B: 0 }[k.side];
    const ig = el('g', { transform: `translate(${x},${y}) rotate(${rot})` }, g);
    el('path', { d: 'M-9,10 L-9,-4 L-3,-4 L-3,-11 L4,-11 L4,-1 L9,-1 L9,10 Z', class: 'sky-icon' }, ig);
    const t = el('text', { x, y: y + 1, class: 'out-text sky-text' }, g);
    t.textContent = k.value;
    return { g, layer: 'outside', grow: popIn(g), side: k.side, index: k.index };
  };
  R.littlekiller = (grid, k) => {
    const g = el('g', { class: 'c-out c-lk' });
    const [r, c] = k.clue;
    const x = grid.M + c * S + S / 2, y = grid.M + r * S + S / 2;
    const [dr, dc] = k.dir;
    const t = el('text', { x: x - dc * S * 0.12, y: y - dr * S * 0.12 + 1, class: 'out-text lk-text' }, g);
    t.textContent = k.sum;
    const ax = x + dc * S * 0.3, ay = y + dr * S * 0.3;
    const ang = Math.atan2(dr, dc);
    const L = S * 0.16;
    const ag = el('g', { class: 'lk-arrow-g' }, g);
    el('path', {
      d: `M${ax - Math.cos(ang) * L},${ay - Math.sin(ang) * L} L${ax},${ay} M${ax - Math.cos(ang - 0.6) * L * 0.7},${ay - Math.sin(ang - 0.6) * L * 0.7} L${ax},${ay} L${ax - Math.cos(ang + 0.6) * L * 0.7},${ay - Math.sin(ang + 0.6) * L * 0.7}`,
      class: 'lk-arrow',
    }, ag);
    return { g, layer: 'outside', grow: popIn(g) };
  };

  /* terrain (Act IV) -------------------------------------------------------- */
  R.river = (grid, k) => {
    const g = el('g', { class: 'c-river' });
    const pts = k.cells.map(rc => centre(grid, rc));
    // extend the mouth to the grid edge (sea)
    const last = k.cells[k.cells.length - 1];
    const N = grid.N;
    let mouth = null;
    if (last[0] === 0) mouth = [pts[pts.length - 1][0], grid.M];
    else if (last[0] === N - 1) mouth = [pts[pts.length - 1][0], grid.M + N * S];
    else if (last[1] === 0) mouth = [grid.M, pts[pts.length - 1][1]];
    else if (last[1] === N - 1) mouth = [grid.M + N * S, pts[pts.length - 1][1]];
    const all = mouth ? pts.concat([mouth]) : pts;
    const path = el('path', { d: pathD(all), class: 'river-line' }, g);
    const flow = el('path', { d: pathD(all), class: 'river-flow' }, g);
    const spring = el('circle', { cx: pts[0][0], cy: pts[0][1], r: S * 0.13, class: 'river-spring' }, g);
    // chevrons showing direction
    for (let i = 0; i < pts.length - 1; i++) {
      const a = pts[i], b = pts[i + 1];
      const mx = (a[0] + b[0]) / 2, my = (a[1] + b[1]) / 2;
      const ang = Math.atan2(b[1] - a[1], b[0] - a[0]) * 180 / Math.PI;
      el('path', { d: 'M-4,-5 L3,0 L-4,5', class: 'river-chev', transform: `translate(${mx},${my}) rotate(${ang})` }, g);
    }
    const a = drawable(path), b = popIn(spring);
    flow.style.opacity = 0;
    return { g, layer: 'under', grow: (d) => { b(d); a(d + 200, 1400); flow.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 600, delay: d + 1400, fill: 'forwards' }); }, reserve: [[k.cells[0][0], k.cells[0][1], 8]] };
  };

  R.peak = (grid, k) => {
    const g = el('g', { class: 'c-peak' });
    const [r, c] = k.cells[0];
    const x = grid.M + c * S + S - 12, y = grid.M + r * S + 12;
    el('path', { d: `M${x - 8},${y + 6} L${x},${y - 7} L${x + 8},${y + 6} Z`, class: 'peak-mark' }, g);
    return { g, layer: 'over', grow: popIn(g), reserve: [[r, c, 1]] };
  };
  R.hollow = (grid, k) => {
    const g = el('g', { class: 'c-hollow' });
    const [r, c] = k.cells[0];
    const x = grid.M + c * S + S - 12, y = grid.M + r * S + 12;
    el('ellipse', { cx: x, cy: y, rx: 8, ry: 5.5, class: 'hollow-mark' }, g);
    el('path', { d: `M${x - 4},${y} q2,-2 4,0 t4,0`, class: 'hollow-wave' }, g);
    return { g, layer: 'over', grow: popIn(g), reserve: [[r, c, 1]] };
  };
  R.lake = (grid, k) => {
    const g = el('g', { class: 'c-lake' });
    const tint = el('g', { class: 'c-lake-tint' });
    const segs = cageSegments(grid, k.cells);
    k.cells.forEach(([r, c]) => {
      el('rect', { x: grid.M + c * S + 1, y: grid.M + r * S + 1, width: S - 2, height: S - 2, class: 'lake-fill' }, tint);
    });
    const d = segs.map(s => `M${s[0][0]},${s[0][1]} L${s[1][0]},${s[1][1]}`).join(' ');
    el('path', { d, class: 'lake-shore' }, g);
    const a = fadeIn(g), b = fadeIn(tint);
    return { g, layer: 'under', grow: (dl, dur) => { a(dl, dur); b(dl, dur); }, extra: [{ g: tint, layer: 'area' }] };
  };
  R.contour = (grid, k) => {
    const g = el('g', { class: 'c-contour' });
    // edges between each up cell and adjacent down cell
    const up = new Set(k.up.map(([r, c]) => r * 100 + c));
    const down = new Set(k.down.map(([r, c]) => r * 100 + c));
    const segs = [];
    const ticks = [];
    k.up.forEach(([r, c]) => {
      [[-1, 0], [1, 0], [0, -1], [0, 1]].forEach(([dr, dc]) => {
        const rr = r + dr, cc = c + dc;
        if (!down.has(rr * 100 + cc)) return;
        let a, b;
        const x0 = grid.M + c * S, y0 = grid.M + r * S;
        if (dr === -1) { a = [x0, y0]; b = [x0 + S, y0]; }
        if (dr === 1) { a = [x0, y0 + S]; b = [x0 + S, y0 + S]; }
        if (dc === -1) { a = [x0, y0]; b = [x0, y0 + S]; }
        if (dc === 1) { a = [x0 + S, y0]; b = [x0 + S, y0 + S]; }
        segs.push([a, b, [r, c], [rr, cc], dr, dc]);
        // hachure ticks pointing downhill (toward the down cell)
        for (const t of [0.3, 0.7]) {
          const px = a[0] + (b[0] - a[0]) * t, py = a[1] + (b[1] - a[1]) * t;
          ticks.push([[px, py], [px + dc * 7, py + dr * 7]]);
        }
      });
    });
    const d = segs.map(s => `M${s[0][0]},${s[0][1]} L${s[1][0]},${s[1][1]}`).join(' ');
    const p = el('path', { d, class: 'contour-line' }, g);
    const td = ticks.map(s => `M${s[0][0]},${s[0][1]} L${s[1][0]},${s[1][1]}`).join(' ');
    el('path', { d: td, class: 'contour-tick' }, g);
    const reserve = [];
    if (k.h != null && segs.length) {
      // a numbered contour can break into separate pieces on the map: label every piece, or a
      // piece without a number reads as a different, unnumbered contour
      const pk = (p) => p[0].toFixed(1) + ',' + p[1].toFixed(1);
      const left = new Set(segs.map((_, i) => i));
      const pieces = [];
      while (left.size) {
        const first = left.values().next().value;
        const piece = [first]; left.delete(first);
        const ends = new Set([pk(segs[first][0]), pk(segs[first][1])]);
        let grew = true;
        while (grew) {
          grew = false;
          for (const i of [...left]) {
            const a = pk(segs[i][0]), b = pk(segs[i][1]);
            if (ends.has(a) || ends.has(b)) { piece.push(i); left.delete(i); ends.add(a); ends.add(b); grew = true; }
          }
        }
        pieces.push(piece);
      }
      pieces.forEach(piece => {
        const s = segs[piece[Math.floor(piece.length / 2)]];
        const mx = (s[0][0] + s[1][0]) / 2, my = (s[0][1] + s[1][1]) / 2;
        el('rect', { x: mx - 9, y: my - 8, width: 18, height: 16, rx: 3, class: 'contour-label-bg' }, g);
        const t = el('text', { x: mx, y: my + 1, class: 'contour-label' }, g);
        t.textContent = k.h;
        reserve.push(...edgeSlots(s[2], s[3]));
      });
    }
    return { g, layer: 'over', grow: fadeIn(g), reserve };
  };
  R.sun = (grid, k) => {
    const g = el('g', { class: 'c-sun' });
    const [r, c] = k.cells[0];
    const x = grid.M + c * S + 12, y = grid.M + r * S + S - 12;
    el('circle', { cx: x, cy: y, r: 4.2, class: 'sun-disc' }, g);
    for (let a = 0; a < 8; a++) {
      const ang = a * Math.PI / 4;
      el('line', { x1: x + Math.cos(ang) * 6.5, y1: y + Math.sin(ang) * 6.5, x2: x + Math.cos(ang) * 9, y2: y + Math.sin(ang) * 9, class: 'sun-ray' }, g);
    }
    return { g, layer: 'over', grow: popIn(g), reserve: [[r, c, 2]] };
  };
  R.shade = (grid, k) => {
    const g = el('g', { class: 'c-shade' });
    const [r, c] = k.cells[0];
    const x = grid.M + c * S + 12, y = grid.M + r * S + S - 12;
    el('circle', { cx: x, cy: y, r: 7, class: 'shade-disc' }, g);
    el('path', { d: `M${x},${y - 7} A7,7 0 0,0 ${x},${y + 7} Z`, class: 'shade-half' }, g);
    return { g, layer: 'over', grow: popIn(g), reserve: [[r, c, 2]] };
  };

  function render(grid, k) {
    const fn = R[k.type];
    if (!fn) { console.warn('no renderer', k.type); return null; }
    const out = fn(grid, k);
    out.data = k;
    const layerOf = (name) => name === 'under' ? grid.gUnder : name === 'outside' ? grid.gOutside : name === 'area' ? grid.gArea : grid.gOver;
    layerOf(out.layer).appendChild(out.g);
    (out.extra || []).forEach(x => layerOf(x.layer).appendChild(x.g));
    return out;
  }

  NF.renderConstraint = render;
  NF.cageSegments = cageSegments;
})();
