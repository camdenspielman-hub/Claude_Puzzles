/* Ninefold — procedural sound. Every digit is a note; growth, dusk and dawn get their own swells;
   each act has a quiet ambient bed. Nothing plays until the player interacts. */
(function () {
  let ctx = null, master = null, bedGain = null, bedNodes = [], muted = false, act = 0;
  const SCALE = [0, 261.63, 293.66, 329.63, 392.0, 440.0, 523.25, 587.33, 659.25, 783.99];

  function unlock() {
    if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return; }
    try {
      ctx = new (window.AudioContext || window.webkitAudioContext)();
      master = ctx.createGain();
      master.gain.value = muted ? 0 : 0.55;
      const comp = ctx.createDynamicsCompressor();
      master.connect(comp); comp.connect(ctx.destination);
      // shared reverb
      A.verb = ctx.createConvolver();
      A.verb.buffer = impulse(2.8, 2.2);
      const vg = ctx.createGain(); vg.gain.value = 0.35;
      A.verb.connect(vg); vg.connect(master);
      bedGain = ctx.createGain(); bedGain.gain.value = 0; bedGain.connect(master);
      startBed(act);
    } catch (e) { ctx = null; }
  }

  function impulse(sec, decay) {
    const len = ctx.sampleRate * sec;
    const buf = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let ch = 0; ch < 2; ch++) {
      const d = buf.getChannelData(ch);
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, decay);
    }
    return buf;
  }

  function tone(freq, t0, dur, opts) {
    if (!ctx) return;
    opts = opts || {};
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = opts.type || 'sine';
    o.frequency.setValueAtTime(freq, t0);
    if (opts.glide) o.frequency.exponentialRampToValueAtTime(opts.glide, t0 + dur);
    const peak = opts.gain || 0.18;
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(peak, t0 + (opts.attack || 0.008));
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(g);
    g.connect(master);
    if (opts.verb !== false && A.verb) g.connect(A.verb);
    o.start(t0); o.stop(t0 + dur + 0.05);
  }

  function noise(t0, dur, opts) {
    if (!ctx) return;
    opts = opts || {};
    const len = Math.floor(ctx.sampleRate * dur);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    const src = ctx.createBufferSource(); src.buffer = buf;
    const f = ctx.createBiquadFilter(); f.type = opts.filter || 'bandpass'; f.frequency.value = opts.freq || 800; f.Q.value = opts.q || 0.8;
    if (opts.sweep) f.frequency.exponentialRampToValueAtTime(opts.sweep, t0 + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(opts.gain || 0.1, t0 + (opts.attack || dur * 0.3));
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    src.connect(f); f.connect(g); g.connect(master);
    if (A.verb) g.connect(A.verb);
    src.start(t0);
  }

  function startBed(i) {
    if (!ctx) return;
    bedNodes.forEach(n => { try { n.stop(); } catch (e) { } });
    bedNodes = [];
    const t = ctx.currentTime;
    bedGain.gain.cancelScheduledValues(t);
    bedGain.gain.setTargetAtTime(0, t, 0.5);
    if (i === 0) return; // paper is silent
    const layers = {
      1: { notes: [130.81, 196.0, 293.66], wind: 0, type: 'sine', vol: 0.05 },
      2: { notes: [110.0, 164.81, 246.94], wind: 0.06, type: 'triangle', vol: 0.045 },
      3: { notes: [146.83, 220.0, 329.63], wind: 0.02, type: 'sine', vol: 0.045 },
      4: { notes: [130.81, 196.0, 261.63, 392.0], wind: 0.05, type: 'sine', vol: 0.04 },
    }[i];
    if (!layers) return;
    layers.notes.forEach((f, k) => {
      const o = ctx.createOscillator();
      o.type = layers.type; o.frequency.value = f;
      const lfo = ctx.createOscillator(); lfo.frequency.value = 0.05 + k * 0.031;
      const lg = ctx.createGain(); lg.gain.value = layers.vol * 0.5;
      const g = ctx.createGain(); g.gain.value = layers.vol * 0.5;
      lfo.connect(lg); lg.connect(g.gain);
      o.connect(g); g.connect(bedGain);
      o.start(); lfo.start();
      bedNodes.push(o, lfo);
    });
    if (layers.wind) {
      const len = ctx.sampleRate * 4;
      const buf = ctx.createBuffer(1, len, ctx.sampleRate);
      const d = buf.getChannelData(0);
      let last = 0;
      for (let k = 0; k < len; k++) { last = (last + 0.02 * (Math.random() * 2 - 1)) / 1.02; d[k] = last * 3; }
      const src = ctx.createBufferSource(); src.buffer = buf; src.loop = true;
      const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 600;
      const lfo = ctx.createOscillator(); lfo.frequency.value = 0.07;
      const lg = ctx.createGain(); lg.gain.value = 300;
      lfo.connect(lg); lg.connect(f.frequency);
      const g = ctx.createGain(); g.gain.value = layers.wind;
      src.connect(f); f.connect(g); g.connect(bedGain);
      src.start(); lfo.start();
      bedNodes.push(src, lfo);
    }
    bedGain.gain.setTargetAtTime(1, t + 0.5, 3);
  }

  const A = {
    unlock,
    setMuted(m) { muted = m; if (master) master.gain.setTargetAtTime(m ? 0 : 0.55, ctx.currentTime, 0.1); },
    setAct(i) { act = i; if (ctx) startBed(i); },
    tick(d, mode) {
      unlock();
      if (!ctx || muted) return;
      const t = ctx.currentTime;
      if (mode === 'normal') {
        tone(SCALE[d] || 440, t, 0.9, { type: act === 2 ? 'triangle' : 'sine', gain: 0.16 });
        tone((SCALE[d] || 440) * 2, t, 0.35, { gain: 0.03 });
      } else {
        tone((SCALE[d] || 440) * 2, t, 0.12, { gain: 0.04, verb: false });
      }
    },
    grow() {
      if (!ctx || muted) return;
      const t = ctx.currentTime;
      [0, 2, 4, 7, 9].forEach((k, j) => tone(SCALE[1] * Math.pow(2, k / 12) * 2, t + j * 0.09, 1.6, { gain: 0.09, type: 'triangle' }));
      noise(t, 1.6, { freq: 5000, sweep: 9000, q: 2, gain: 0.03, filter: 'highpass' });
    },
    unfold() {
      if (!ctx || muted) return;
      const t = ctx.currentTime;
      [130.81, 196.0, 261.63, 329.63, 392.0, 523.25].forEach((f, j) => tone(f, t + j * 0.12, 3.2, { gain: 0.07, type: 'sine', attack: 0.3 }));
    },
    complete() {
      if (!ctx || muted) return;
      const t = ctx.currentTime;
      [261.63, 329.63, 392.0, 493.88, 587.33, 783.99].forEach((f, j) => tone(f, t + j * 0.06, 4.5, { gain: 0.06, attack: 0.6 }));
      tone(65.41, t, 5, { gain: 0.08, attack: 1.2 });
    },
    leaves() {
      if (!ctx || muted) return;
      const t = ctx.currentTime;
      for (let k = 0; k < 22; k++) noise(t + Math.random() * 3, 0.25 + Math.random() * 0.3, { freq: 2500 + Math.random() * 3000, q: 4, gain: 0.02 });
    },
    dusk() {
      if (!ctx || muted) return;
      const t = ctx.currentTime;
      tone(220, t, 6, { glide: 110, gain: 0.05, attack: 2 });
      noise(t, 6, { filter: 'lowpass', freq: 300, sweep: 1200, gain: 0.06, attack: 3 });
    },
    dawn() {
      if (!ctx || muted) return;
      const t = ctx.currentTime;
      [196, 246.94, 293.66, 392].forEach((f, j) => tone(f, t + j * 0.4, 5, { gain: 0.05, attack: 1.5 }));
    },
    swell() {
      if (!ctx || muted) return;
      const t = ctx.currentTime;
      [65.41, 130.81, 196.0, 261.63, 329.63, 392.0, 523.25].forEach((f, j) => tone(f, t + j * 0.25, 7, { gain: 0.05, attack: 2.5 }));
    },
    whoosh() {
      if (!ctx || muted) return;
      noise(ctx.currentTime, 0.9, { filter: 'bandpass', freq: 400, sweep: 2200, q: 0.7, gain: 0.05 });
    },
    line(k) {
      if (!ctx || muted) return;
      tone(SCALE[1 + (k % 9)] * 2, ctx.currentTime, 0.18, { gain: 0.035, type: 'triangle' });
    },
    panelOk() {
      if (!ctx || muted) return;
      const t = ctx.currentTime;
      [523.25, 659.25, 783.99, 1046.5].forEach((f, j) => tone(f, t + j * 0.07, 1.4, { gain: 0.07 }));
    },
    panelBad() {
      if (!ctx || muted) return;
      tone(160, ctx.currentTime, 0.5, { type: 'sawtooth', gain: 0.03, glide: 90 });
    },
  };
  NF.Audio = A;
  ['pointerdown', 'keydown'].forEach(ev => window.addEventListener(ev, () => unlock(), { once: true }));
})();
