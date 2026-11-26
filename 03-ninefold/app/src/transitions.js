/* Ninefold — act transitions: the 4x4 unfolding, leaf-fall, dusk, fog-lift, and the pull-back to the island. */
(function () {
  const $ = (s) => document.querySelector(s);
  const app = $('#app');
  const sleep = (ms) => new Promise(r => setTimeout(r, ms));
  const T = {};

  function digitClone(textEl, extraClass) {
    const r = textEl.getBoundingClientRect();
    const span = document.createElement('div');
    span.className = 'fly-digit ' + (extraClass || '');
    span.textContent = textEl.textContent;
    const cs = getComputedStyle(textEl);
    // the SVG's font-size is in viewBox units: scale it to screen pixels (the text's bounding box
    // is a line box, taller than the glyphs, so sizing from it made every clone ~25% too big)
    const svg = textEl.ownerSVGElement;
    const vb = svg && svg.viewBox && svg.viewBox.baseVal;
    const scale = vb && vb.width ? svg.getBoundingClientRect().width / vb.width : 1;
    const px = (parseFloat(cs.fontSize) || r.height) * scale;
    Object.assign(span.style, {
      position: 'fixed', left: (r.left + r.width / 2) + 'px', top: (r.top + r.height / 2) + 'px',
      transform: 'translate(-50%,-50%)', fontFamily: cs.fontFamily, fontWeight: cs.fontWeight, fontSize: px + 'px', lineHeight: '1',
      color: cs.fill, zIndex: 45, pointerEvents: 'none', willChange: 'transform, opacity',
    });
    app.appendChild(span);
    return { span, x: r.left + r.width / 2, y: r.top + r.height / 2, h: r.height };
  }

  /* -------------------------------------------------------------- 4x4 → 9x9
     The seed unfolds along its seams. Every line of the 4x4 splits in two and a new row or
     column grows in the gap, so 4x4 line k becomes 9x9 lines 2k and 2k+1 and 4x4 cell i lands on
     9x9 cell 2i+1. Everything (sheet, lines, line weights, digits) runs on one clock, inside the
     final 9x9 SVG, so the last frame is the real grid and nothing has to be swapped. */
  const ease = (t) => t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
  const smooth = (a, b, t) => { const x = Math.min(1, Math.max(0, (t - a) / (b - a))); return x * x * (3 - 2 * x); };
  const lerp = (a, b, t) => a + (b - a) * t;
  function rgbOf(cssColor) {
    const m = /^#([0-9a-f]{6})$/i.exec(cssColor.trim());
    if (m) { const n = parseInt(m[1], 16); return [n >> 16 & 255, n >> 8 & 255, n & 255]; }
    const k = /rgba?\(([^)]+)\)/.exec(cssColor);
    if (k) return k[1].split(',').slice(0, 3).map(Number);
    return [20, 20, 20];
  }
  const mix = (a, b, t) => `rgb(${a.map((v, i) => Math.round(lerp(v, b[i], t))).join(',')})`;

  T.unfold = async function (Game) {
    const act = NF.DATA.acts[0];
    const reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
    const S = NF.S;
    const g4 = Game.grid;
    g4.select([]);
    g4.locked = true;
    const seedDigits = g4.cells.map(c => ({ v: c.v, given: c.given }));

    // --- A. the seed is solved: a quick shimmer, and the clipping's furniture steps away
    ['#clip', '#preludePad', '#hint'].forEach(sel => {
      const n = $(sel); if (n) n.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 420, fill: 'forwards', easing: 'ease-in' });
    });
    if (!reduce) g4.cells.forEach(c => {
      c.val.style.transformBox = 'fill-box'; c.val.style.transformOrigin = 'center';
      c.val.animate([{ transform: 'scale(1)' }, { transform: 'scale(1.14)', offset: 0.45 }, { transform: 'scale(1)' }],
        { duration: 460, delay: (c.r + c.c) * 45, easing: 'ease-in-out' });
    });
    NF.Audio && NF.Audio.unfold();
    await sleep(reduce ? 120 : 560);

    // --- B. switch to the final layout in one step, with layout transitions frozen
    const F = g4.svg.getBoundingClientRect();
    app.classList.add('unfolding', 'side-hidden');
    app.classList.remove('prelude');
    const g = NF.helpers.makeGrid(9, 0);
    g.locked = true;
    NF.helpers.layout();
    const host = $('#gridHost');
    const L = g.svg.getBoundingClientRect();
    const u = (9 * S) / L.width;                       // svg units per css pixel
    const x0 = (F.left - L.left) * u, y0 = (F.top - L.top) * u, s4 = F.width * u;
    const k4 = s4 / (4 * S);                            // 4x4 cell size, as a fraction of a 9x9 cell
    const seamX = (k) => x0 + k * s4 / 4, seamY = (k) => y0 + k * s4 / 4;
    const thick4 = (k) => k % 2 === 0;                  // 4x4 lines 0, 2, 4 are box lines
    const thick9 = (j) => j % 3 === 0;                  // 9x9 lines 0, 3, 6, 9
    const css = getComputedStyle(app);
    const cThin = rgbOf(css.getPropertyValue('--grid-thin') || '#a9a9a2');
    const cThick = rgbOf(css.getPropertyValue('--grid-thick') || '#141414');

    // the real lines wait underneath; a transition layer draws the moving ones
    g.gLines.style.display = 'none';
    const gu = NF.svgEl('g', { class: 'g-unfold' });
    g.root.insertBefore(gu, g.gLines);
    const seams = NF.svgEl('g', { class: 'unfold-seams' }, gu);
    const seamRects = [];
    for (let k = 0; k < 5; k++) {
      seamRects.push({ k, axis: 'h', el: NF.svgEl('rect', { class: 'unfold-seam' }, seams) });
      seamRects.push({ k, axis: 'v', el: NF.svgEl('rect', { class: 'unfold-seam' }, seams) });
    }
    const lineEls = [];
    for (let j = 0; j <= 9; j++) {
      lineEls.push({ j, axis: 'h', el: NF.svgEl('line', { class: 'unfold-line' }, gu) });
      lineEls.push({ j, axis: 'v', el: NF.svgEl('line', { class: 'unfold-line' }, gu) });
    }
    // thick-ending lines on top
    lineEls.filter(l => thick9(l.j)).forEach(l => gu.appendChild(l.el));

    // digits ride in their own cells; the twelve the player wrote cross-fade from pen to print
    const movers = act.prelude.map.map(([r, c], k) => {
      const cell = g.cells[r * 9 + c];
      cell.v = seedDigits[k].v; cell.given = true; cell.corner = []; cell.centreMarks = [];
      g.renderCell(cell);
      let twin = null;
      if (!seedDigits[k].given) {
        twin = NF.svgEl('text', { x: S / 2, y: S / 2 + 1, class: 'd-val user' }, cell.g);
        twin.textContent = String(cell.v);
        cell.val.style.opacity = 0;
      }
      const i4 = Math.floor(k / 4), j4 = k % 4;
      return { cell, twin, i4, j4 };
    });

    const paint = (t) => {
      const e = ease(t);
      const w = smooth(0.18, 0.92, t);
      // line positions: 9x9 line j starts on 4x4 seam floor(j/2)
      const X = [], Y = [];
      for (let j = 0; j <= 9; j++) { X[j] = lerp(seamX(j >> 1), j * S, e); Y[j] = lerp(seamY(j >> 1), j * S, e); }
      // the sheet follows the grid's outer edge exactly
      const pxL = L.left + X[0] / u, pxR = L.left + X[9] / u, pxT = L.top + Y[0] / u, pxB = L.top + Y[9] / u;
      host.style.setProperty('--sheet-t', (pxT - 14 - L.top) + 'px');
      host.style.setProperty('--sheet-l', (pxL - 14 - L.left) + 'px');
      host.style.setProperty('--sheet-r', (L.right - pxR - 14) + 'px');
      host.style.setProperty('--sheet-b', (L.bottom - pxB - 14) + 'px');
      lineEls.forEach(({ j, axis, el }) => {
        const from = (thick4(j >> 1) ? 3.2 : 1.1) * k4, to = thick9(j) ? 3.2 : 1.1;
        const wa = thick4(j >> 1) ? 1 : 0, wb = thick9(j) ? 1 : 0;
        const sw = lerp(from, to, w);
        const tone = lerp(wa, wb, w);
        if (axis === 'h') { el.setAttribute('x1', X[0]); el.setAttribute('x2', X[9]); el.setAttribute('y1', Y[j]); el.setAttribute('y2', Y[j]); }
        else { el.setAttribute('y1', Y[0]); el.setAttribute('y2', Y[9]); el.setAttribute('x1', X[j]); el.setAttribute('x2', X[j]); }
        el.setAttribute('stroke-width', sw.toFixed(3));
        el.setAttribute('stroke', mix(cThin, cThick, tone));
      });
      // new growth glows in the opening seams, then settles into paper
      const glow = 0.24 * Math.pow(Math.sin(Math.PI * e), 1.4);
      seamRects.forEach(({ k, axis, el }) => {
        if (axis === 'h') { el.setAttribute('x', X[0]); el.setAttribute('width', X[9] - X[0]); el.setAttribute('y', Y[2 * k]); el.setAttribute('height', Math.max(0, Y[2 * k + 1] - Y[2 * k])); }
        else { el.setAttribute('y', Y[0]); el.setAttribute('height', Y[9] - Y[0]); el.setAttribute('x', X[2 * k]); el.setAttribute('width', Math.max(0, X[2 * k + 1] - X[2 * k])); }
        el.setAttribute('fill-opacity', glow.toFixed(3));
      });
      // digits sit in the centre of their (moving, growing) cells
      const ink = smooth(0.5, 1.0, t);
      movers.forEach(({ cell, twin, i4, j4 }) => {
        const c = 2 * j4 + 1, r = 2 * i4 + 1;
        const cx = (X[c] + X[c + 1]) / 2, cy = (Y[r] + Y[r + 1]) / 2;
        const sc = (X[c + 1] - X[c]) / S;
        cell.g.setAttribute('transform', `translate(${(cx - sc * S / 2).toFixed(2)},${(cy - sc * S / 2).toFixed(2)}) scale(${sc.toFixed(4)})`);
        if (twin) { twin.style.opacity = (1 - ink).toFixed(3); cell.val.style.opacity = ink.toFixed(3); }
      });
    };

    // side panel and manuscript arrive while the grid settles
    const sideAt = 0.68;
    let sideShown = false;
    const showSide = () => {
      if (sideShown) return; sideShown = true;
      app.classList.remove('side-hidden');
      const li = document.querySelector('#ruleList li[data-rule="classic4"]');
      if (li) setTimeout(() => {
        li.classList.add('struck');
        const hand = document.createElement('span');
        hand.className = 'hand';
        hand.textContent = 'now 1–9, in 3×3 boxes';
        li.appendChild(hand);
        hand.animate([{ opacity: 0, clipPath: 'inset(0 100% 0 0)' }, { opacity: 1, clipPath: 'inset(0 0 0 0)' }], { duration: 1100, easing: 'ease-out', fill: 'both' });
      }, 700);
      $('#actTag').textContent = 'I · Paper';
    };

    paint(0);
    if (reduce) {
      paint(1); showSide();
    } else {
      const DUR = 2600;
      await new Promise(res => {
        const t0 = performance.now();
        const step = (now) => {
          const t = Math.min(1, (now - t0) / DUR);
          paint(t);
          if (t >= sideAt) showSide();
          if (t < 1) requestAnimationFrame(step); else res();
        };
        requestAnimationFrame(step);
      });
    }

    // --- C. hand over to the real grid (identical geometry, so nothing visibly changes)
    movers.forEach(({ cell, twin }) => {
      cell.g.setAttribute('transform', `translate(${cell.x},${cell.y})`);
      cell.val.style.opacity = '';
      if (twin) twin.remove();
    });
    g.gLines.style.display = '';
    gu.remove();
    ['--sheet-t', '--sheet-l', '--sheet-r', '--sheet-b'].forEach(v => host.style.removeProperty(v));
    app.classList.remove('unfolding');
    ['#clip', '#preludePad', '#hint'].forEach(sel => { const n = $(sel); if (n) n.getAnimations().forEach(a => a.cancel()); });
    $('#hint').style.opacity = 0;
  };

  /* -------------------------------------------------------------- generic glow wave */
  async function glowWave(g, colour) {
    const cells = g.cells.slice().sort((a, b) => (Math.hypot(a.r - 4, a.c - 4) - Math.hypot(b.r - 4, b.c - 4)));
    cells.forEach((c, j) => {
      const d = Math.hypot(c.r - 4, c.c - 4);
      c.val.animate([{ transform: 'scale(1)', fill: getComputedStyle(c.val).fill }, { transform: 'scale(1.18)', fill: colour, offset: 0.4 }, { transform: 'scale(1)' }],
        { duration: 900, delay: d * 120, easing: 'ease-out' });
      c.val.style.transformBox = 'fill-box';
      c.val.style.transformOrigin = 'center';
    });
    await sleep(1600);
  }

  /* the grid steps aside while the camera visits the plateau that just rose */
  async function showcase(k) {
    const W = NF.World;
    if (!W || W.failed || !W.showcase) { await sleep(1200); return; }
    const st = $('#stage');
    st.style.transition = 'opacity 1.2s ease';
    st.style.opacity = 0;
    await sleep(500);
    W.raisePlateau(k, NF.DATA.acts[k].solution);
    await W.showcase(k, 6200);
    await sleep(600);
  }
  T.showcase = showcase;

  /* -------------------------------------------------------------- act outros */
  T.actOut = async function (Game) {
    const g = Game.grid;
    const i = Game.act;
    const acts = NF.DATA.acts;
    if (i === 0) {
      await glowWave(g, '#2f7a4f');
      NF.helpers.hint('');
      await NF.helpers.card('I', 'Paper, solved', 'The ink dries. Something stirs under the page.', 1800);
      // leaf-fall: digits not inherited by Act II fall away
      const keep = new Set((acts[1].givens || []).map(([r, c]) => r * 9 + c));
      const clones = [];
      g.cells.forEach((c, j) => {
        if (keep.has(c.i)) return;
        const cl = digitClone(c.val);
        c.val.style.opacity = 0;
        clones.push(cl);
      });
      // the side panel and constraints wither
      g.gUnder.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 1600, fill: 'forwards' });
      g.gOver.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 1600, fill: 'forwards' });
      const x0 = g.svg.getBoundingClientRect().left;
      app.dataset.act = '2';
      app.classList.add('world-on');
      // Act II's side panel is padded, which moves the board: move the falling digits with it
      const dx = g.svg.getBoundingClientRect().left - x0;
      if (dx) clones.forEach(cl => { cl.span.style.left = (parseFloat(cl.span.style.left) + dx) + 'px'; });
      NF.Audio && NF.Audio.leaves();
      const H = window.innerHeight;
      const falling = Promise.all(clones.map((cl) => {
        const drift = (Math.random() - 0.5) * 260;
        const rot = (Math.random() - 0.5) * 720;
        const dur = 2600 + Math.random() * 2200;
        return cl.span.animate([
          { transform: 'translate(-50%,-50%) rotate(0)', opacity: 1, color: cl.span.style.color },
          { transform: `translate(calc(-50% + ${drift * 0.4}px), calc(-50% + ${H * 0.15}px)) rotate(${rot * 0.3}deg)`, opacity: 1, color: '#c9a227', offset: 0.25 },
          { transform: `translate(calc(-50% + ${drift}px), calc(-50% + ${H * 1.1}px)) rotate(${rot}deg)`, opacity: 0, color: '#a0522d' },
        ], { duration: dur, delay: Math.random() * 1400, easing: 'cubic-bezier(.35,.05,.6,1)', fill: 'forwards' }).finished.then(() => cl.span.remove());
      })).catch(() => { });
      await falling;
      await showcase(0);
    } else if (i === 1) {
      await glowWave(g, '#e8f5b8');
      NF.helpers.hint('');
      await NF.helpers.card('II', 'Vines, solved', 'Night is coming in from the sea.', 1800);
      g.gUnder.animate([{ opacity: 1, filter: 'saturate(1)' }, { opacity: 0, filter: 'saturate(0)' }], { duration: 2400, fill: 'forwards' });
      app.dataset.act = '3';
      NF.Audio && NF.Audio.dusk();
      // fog rolls over the solved grid
      const fogIn = document.createElement('div');
      fogIn.className = 'fog-roll';
      $('#gridWrap').appendChild(fogIn);
      fogIn.animate([{ opacity: 0, transform: 'translateX(-30%) scale(1.2)' }, { opacity: 1, transform: 'none' }], { duration: 3200, easing: 'ease-in-out', fill: 'forwards' });
      await sleep(3300);
      g.cells.forEach(c => { c.val.style.opacity = 0; });
      await sleep(300);
      T.pendingFogRoll = fogIn;
      await showcase(1);
    } else if (i === 2) {
      await glowWave(g, '#ffd27a');
      NF.helpers.hint('');
      await NF.helpers.card('III', 'Fog, solved', 'Morning. The land wants a shape.', 1800);
      if (Game.fog) await Game.fog.liftAll();
      app.dataset.act = '4';
      NF.Audio && NF.Audio.dawn();
      await showcase(2);
    } else if (i === 3) {
      await glowWave(g, '#1d6fae');
      NF.helpers.hint('');
      $('#viewToggle').hidden = true;
      app.classList.remove('terrain-view');
      $('#stage').animate([{ opacity: 1 }, { opacity: 0 }], { duration: 1400, fill: 'forwards' });
      NF.Audio && NF.Audio.swell();
      if (NF.World && NF.World.pullBack) await NF.World.pullBack();
      else await sleep(1500);
    }
  };

  /* -------------------------------------------------------------- act intros */
  T.actIn = async function (Game, next) {
    const act = NF.DATA.acts[next];
    const showStage = () => { $('#stage').style.opacity = ''; };
    if (next === 1) {
      await NF.helpers.card(act.n, act.title, act.line, 2200);
      showStage();
      await NF.startAct(next, { animate: true, fresh: true });
      // inherited digits glow as they settle
      Game.grid.cells.filter(c => c.given).forEach((c, j) => {
        c.val.animate([{ fill: '#c9a227', transform: 'scale(1.3)' }, { transform: 'scale(1)' }], { duration: 1400, delay: j * 90, easing: 'ease-out' });
      });
      NF.helpers.hint((act.stages[Game.stage] || act.stages[0]).hint || '');
    } else if (next === 2) {
      await NF.helpers.card(act.n, act.title, act.line, 2400);
      showStage();
      await NF.startAct(next, { animate: true, fresh: true });
    } else if (next === 3) {
      await NF.helpers.card(act.n, act.title, act.line, 2400);
      showStage();
      await NF.startAct(next, { animate: true, fresh: true });
    } else if (next === 4) {
      await NF.startAct(next, {});
    }
    // the dusk fog roll from Act II's outro lifts off whatever act follows (a finished replay can
    // skip ahead past Act III)
    if (T.pendingFogRoll) {
      const f = T.pendingFogRoll;
      T.pendingFogRoll = null;
      f.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 2400, fill: 'forwards' }).finished.then(() => f.remove(), () => f.remove());
    }
    $('#stage').getAnimations().forEach(a => a.cancel());
    $('#stage').style.opacity = '';
  };

  T.fadeSwap = async function (fn) {
    const v = $('#veil');
    v.style.opacity = 1;
    await sleep(700);
    await fn();
    v.style.opacity = 0;
  };

  NF.Transitions = T;
})();
