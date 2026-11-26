/* Ninefold — fog of war (Act III). A drifting noise fog drawn on a canvas over the grid,
   masked per cell; correct digits clear their 3x3 neighbourhood and reveal clues beneath. */
(function () {
  function makeNoise(size, seed) {
    const c = document.createElement('canvas');
    c.width = c.height = size;
    const ctx = c.getContext('2d');
    const img = ctx.createImageData(size, size);
    // tileable value noise, few octaves
    let s = seed || 1;
    const rand = () => { s = (s * 16807) % 2147483647; return (s - 1) / 2147483646; };
    const grids = [4, 8, 16, 32].map(n => { const a = []; for (let i = 0; i < n * n; i++) a.push(rand()); return { n, a }; });
    const smooth = t => t * t * (3 - 2 * t);
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        let v = 0, amp = 0.5, tot = 0;
        grids.forEach(({ n, a }) => {
          const fx = x / size * n, fy = y / size * n;
          const x0 = Math.floor(fx), y0 = Math.floor(fy);
          const tx = smooth(fx - x0), ty = smooth(fy - y0);
          const g = (i, j) => a[((j % n + n) % n) * n + ((i % n + n) % n)];
          const v0 = g(x0, y0) * (1 - tx) + g(x0 + 1, y0) * tx;
          const v1 = g(x0, y0 + 1) * (1 - tx) + g(x0 + 1, y0 + 1) * tx;
          v += (v0 * (1 - ty) + v1 * ty) * amp; tot += amp; amp *= 0.55;
        });
        v /= tot;
        const k = (y * size + x) * 4;
        const L = 150 + v * 100;
        img.data[k] = L * 0.82; img.data[k + 1] = L * 0.86; img.data[k + 2] = L * 1.02;
        img.data[k + 3] = 120 + v * 135;
      }
    }
    ctx.putImageData(img, 0, 0);
    return c;
  }

  class Fog {
    constructor(Game, act) {
      this.Game = Game;
      this.act = act;
      this.N = 9;
      this.margin = act.margin || 0;
      this.cleared = new Set();
      this.alpha = new Float32Array(81).fill(1);
      this.outAlpha = {};
      (act.startClear || []).forEach(([r, c]) => this.revealAround(r * 9 + c, true));
      (act.givens || []).forEach(([r, c]) => this.revealAround(r * 9 + c, true));
      this.canvas = document.getElementById('fogCanvas');
      this.ctx = this.canvas.getContext('2d');
      this.mask = document.createElement('canvas');
      this.noise = makeNoise(256, 7);
      this.noise2 = makeNoise(256, 99);
      this.t0 = performance.now();
      this.running = false;
      this.resize();
    }
    restore(list) {
      list.forEach(i => this.cleared.add(i));
      this.cleared.forEach(i => { this.alpha[i] = 0; });
    }
    revealAround(i, instant) {
      const r = Math.floor(i / 9), c = i % 9;
      const fresh = [];
      for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) {
        const rr = r + dr, cc = c + dc;
        if (rr < 0 || cc < 0 || rr > 8 || cc > 8) continue;
        const j = rr * 9 + cc;
        if (!this.cleared.has(j)) { this.cleared.add(j); fresh.push(j); if (instant) this.alpha[j] = 0; }
      }
      return fresh;
    }
    isClear(r, c) { return this.cleared.has(r * 9 + c); }
    visible(k) {
      const t = k.type;
      if (t === 'quad') return k.cells.some(([r, c]) => this.isClear(r, c));
      if (k.cells && k.cells.length) {
        const [r, c] = k.cells[0];
        return this.isClear(r, c);
      }
      return true;
    }
    applyVisibility() {
      const G = this.Game;
      const g = G.grid;
      (G.rendered || []).forEach(rd => {
        const vis = this.lifted || this.visible(rd.data);
        const was = !rd.g.classList.contains('fogged-hide');
        rd.g.classList.toggle('fogged-hide', !vis);
        // a revealed quadruple straddles four cells, some of which may still be fogged: draw it
        // above the fog so the clue the game has given you is fully readable
        if (rd.data.type === 'quad' && g.gTopClues) {
          if (!rd.home) rd.home = rd.g.parentNode;
          const target = vis ? g.gTopClues : rd.home;
          if (rd.g.parentNode !== target) target.appendChild(rd.g);
        }
        if (vis && !was && rd.revealedOnce) {
          rd.g.animate([{ opacity: 0, filter: 'blur(4px)' }, { opacity: 1, filter: 'blur(0)' }], { duration: 900, easing: 'ease-out' });
        }
        if (vis) rd.revealedOnce = true;
      });
      let changed = false;
      g.cells.forEach(c => {
        const f = !this.lifted && !this.cleared.has(c.i);
        if (f === c.fogged) return;
        c.fogged = f;
        c.sel.classList.toggle('fogged', f);
        c.g.classList.toggle('fogged', f);
        g.renderCell(c); // moves a fogged cell's colour above the fog, or back
        changed = true;
      });
      if (changed) g.refreshHighlights(); // re-rendering resets the conflict colouring
      G.updateReserved && G.updateReserved();
    }
    onPlace(cells) {
      const g = this.Game.grid;
      const sol = this.Game.solution;
      let any = false;
      cells.forEach(i => {
        const c = g.cells[i];
        if (c.v && c.v === +sol[i]) {
          const fresh = this.revealAround(i, false);
          if (fresh.length) any = true;
        }
      });
      if (any) {
        this.applyVisibility();
        NF.Audio && NF.Audio.whoosh();
      }
    }
    resize() {
      const wrap = document.getElementById('gridWrap');
      const w = wrap.clientWidth, h = wrap.clientHeight;
      const dpr = Math.min(1.5, window.devicePixelRatio || 1); // soft fog needs no more, and phones pay per pixel
      this.canvas.width = Math.max(1, Math.round(w * dpr));
      this.canvas.height = Math.max(1, Math.round(h * dpr));
      const cells = this.N + 2 * this.margin;
      this.mask.width = cells * 10;
      this.mask.height = cells * 10;
    }
    start() {
      this.applyVisibility();
      if (this.running) return;
      this.running = true;
      let odd = false;
      const loop = () => {
        if (!this.running) return;
        odd = !odd;
        // the drift is slow: every other frame is plenty unless the fog is clearing; nothing when hidden
        if (!document.hidden && (odd || this.moving)) this.draw();
        requestAnimationFrame(loop);
      };
      requestAnimationFrame(loop);
    }
    stop() {
      this.running = false;
      try { this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height); } catch (e) { }
    }
    async liftAll() {
      this.lifted = true;
      this.applyVisibility();
      const start = performance.now();
      await new Promise(res => {
        const step = () => {
          const t = Math.min(1, (performance.now() - start) / 2600);
          for (let i = 0; i < 81; i++) this.alpha[i] = Math.min(this.alpha[i], 1 - t);
          if (t < 1) requestAnimationFrame(step); else res();
        };
        step();
      });
      this.stop();
      this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    }
    draw() {
      const ctx = this.ctx, W = this.canvas.width, H = this.canvas.height;
      const m = this.mask, mctx = m.getContext('2d');
      const cells = this.N + 2 * this.margin;
      const px = m.width / cells;
      // ease alphas toward targets
      let moving = false;
      this.moving = false;
      for (let i = 0; i < 81; i++) {
        const target = (this.lifted || this.cleared.has(i)) ? 0 : 1;
        const a = this.alpha[i];
        if (Math.abs(a - target) > 0.002) { this.alpha[i] = a + (target - a) * 0.06; moving = true; }
        else this.alpha[i] = target;
      }
      this.moving = moving;
      mctx.clearRect(0, 0, m.width, m.height);
      for (let i = 0; i < 81; i++) {
        const a = this.alpha[i];
        if (a <= 0.003) continue;
        const r = Math.floor(i / 9), c = i % 9;
        mctx.fillStyle = `rgba(255,255,255,${a})`;
        mctx.fillRect((c + this.margin) * px - 0.5, (r + this.margin) * px - 0.5, px + 1, px + 1);
      }
      // outside clue positions: fogged until their anchor clears
      if (this.margin && !this.lifted) {
        const spot = (k) => {
          if (k.type === 'littlekiller') return k.clue;
          if (k.side === 'L') return [k.index, -1];
          if (k.side === 'R') return [k.index, 9];
          if (k.side === 'T') return [-1, k.index];
          return [9, k.index];
        };
        const outside = (this.Game.rendered || []).map(rd => rd.data).filter(k => ['sandwich', 'xsum', 'skyscraper', 'littlekiller'].includes(k.type));
        const shown = new Set(outside.filter(k => this.visible(k)).map(k => spot(k).join()));
        // Fog the WHOLE margin ring, each spot as thick as the fog on the grid cell beside it.
        // (Fogging only the spots that hold hidden clues outlined exactly where they were.)
        const N = this.N;
        for (let rr = -1; rr <= N; rr++) for (let cc = -1; cc <= N; cc++) {
          if (rr >= 0 && rr < N && cc >= 0 && cc < N) continue;
          if (shown.has(rr + ',' + cc)) continue; // a revealed clue's spot stays clear
          const a = this.alpha[Math.min(N - 1, Math.max(0, rr)) * N + Math.min(N - 1, Math.max(0, cc))];
          if (a <= 0.003) continue;
          mctx.fillStyle = `rgba(255,255,255,${(0.95 * a).toFixed(3)})`;
          mctx.fillRect((cc + this.margin) * px - 0.5, (rr + this.margin) * px - 0.5, px + 1, px + 1);
        }
      }
      // 1) fog body: opaque base + drifting noise wisps (normal blending)
      if (!this.layer) this.layer = document.createElement('canvas');
      const L = this.layer;
      if (L.width !== W || L.height !== H) { L.width = W; L.height = H; }
      const lc = L.getContext('2d');
      const t = (performance.now() - this.t0) / 1000;
      lc.globalCompositeOperation = 'source-over';
      lc.globalAlpha = 1;
      lc.fillStyle = 'rgb(122,130,172)';
      lc.fillRect(0, 0, W, H);
      const s1 = W * 0.9, s2 = W * 0.55;
      const ox1 = (t * 9) % s1, oy1 = (t * 3) % s1;
      const ox2 = (-t * 14) % s2, oy2 = (t * 6) % s2;
      lc.globalAlpha = 0.9;
      for (let x = -s1; x < W + s1; x += s1) for (let y = -s1; y < H + s1; y += s1) lc.drawImage(this.noise, x + ox1, y + oy1, s1, s1);
      lc.globalAlpha = 0.55;
      for (let x = -s2; x < W + s2; x += s2) for (let y = -s2; y < H + s2; y += s2) lc.drawImage(this.noise2, x + ox2, y + oy2, s2, s2);
      lc.globalAlpha = 1;
      // 2) mask it by the per-cell fog amount
      ctx.clearRect(0, 0, W, H);
      ctx.globalCompositeOperation = 'source-over';
      ctx.filter = `blur(${Math.round(W / cells * 0.22)}px)`;
      ctx.drawImage(m, 0, 0, W, H);
      ctx.filter = 'none';
      ctx.globalCompositeOperation = 'source-in';
      ctx.drawImage(L, 0, 0);
      ctx.globalCompositeOperation = 'source-over';
    }
  }

  NF.Fog = Fog;
})();
