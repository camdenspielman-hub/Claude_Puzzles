"""Cinematic synthwave soundtrack + SFX for Cipher Loop, synced to timeline.json (segs + audio events)."""
import json, sys, wave
import numpy as np

SR = 48000
tl = json.load(open(sys.argv[1])); out_path = sys.argv[2]
TOTAL = tl["total"]; N = int((TOTAL + 1.0) * SR)
rng = np.random.default_rng(11)
segs = tl["segs"]
music = np.zeros((2, N), np.float32); drums = np.zeros((2, N), np.float32); sfx = np.zeros((2, N), np.float32)

def add(buf, t0, sig, pan=0.0, gain=1.0):
    i0 = int(round(t0 * SR))
    if sig.ndim == 1:
        sig = np.stack([sig * np.sqrt(0.5 * (1 - pan)), sig * np.sqrt(0.5 * (1 + pan))])
    if i0 < 0: sig = sig[:, -i0:]; i0 = 0
    n = min(sig.shape[1], N - i0)
    if n > 0: buf[:, i0:i0 + n] += gain * sig[:, :n].astype(np.float32)
mtof = lambda m: 440.0 * 2 ** ((m - 69) / 12)
def tt(d): return np.arange(int(d * SR)) / SR

def section_at(t):
    for s in segs:
        if s["t0"] <= t < s["t1"]: return s["type"], s.get("rules", False)
    return "final", False

# ───────── harmony: A minor neon progression, 2 bars per chord @96bpm
BPM = 96; BEAT = 60 / BPM; BAR = 4 * BEAT; CH = 2 * BAR
PROG = [[57, 60, 64, 67, 71], [53, 57, 60, 64, 69], [48, 55, 60, 64, 67], [55, 59, 62, 66, 69]]   # Am9, Fmaj7, C(add9), G6
ROOTS = [45, 41, 48, 43]

def saw(f, t, nh=9, det=0.0, ph=0.0):
    s = np.zeros_like(t)
    for h in range(1, nh + 1):
        s += np.sin(2 * np.pi * f * (1 + det) * h * t + ph * h) / h * (0.85 ** (h - 1))
    return s

nseg = int(np.ceil(TOTAL / CH)) + 1
for k in range(nseg):
    t0 = k * CH - 1.0; d = CH + 2.0; t = tt(d)
    ch = PROG[k % 4]
    env = np.clip(np.minimum(t / 1.4, (d - t) / 1.4), 0, 1) ** 1.5
    seg = np.zeros((2, len(t)))
    for j, m in enumerate(ch):
        f = mtof(m)
        for c in range(2):
            det = (0.0035 if c == 0 else -0.0031) * (1 + 0.3 * j)
            seg[c] += (saw(f, t, 7, det, rng.uniform(0, 6)) + 0.6 * saw(f, t, 5, -det * 0.7, rng.uniform(0, 6))) * (0.9 if m < 60 else 0.6)
    lfo = 0.82 + 0.18 * np.sin(2 * np.pi * 0.11 * (t + k * CH))
    add(music, t0, (seg * env * lfo / 22.0).astype(np.float32))
    # sub bass pulse on beats (only in solving chapters / final)
    for b in range(8):
        tb = k * CH + b * BEAT
        typ, rules = section_at(tb)
        if typ in ("step",) and not rules or typ == "final":
            tb_ = tt(0.5); f = mtof(ROOTS[k % 4] - 12 + (12 if b % 4 == 3 else 0))
            s = np.tanh(2.2 * np.sin(2 * np.pi * f * tb_)) * np.exp(-tb_ / 0.22) * (1 - np.exp(-tb_ / 0.004))
            add(music, tb, s, gain=0.10)

# arpeggio: 16ths, gated by section, with ping-pong delay later
arp = np.zeros((2, N), np.float32)
step16 = BEAT / 4
for i in range(int(TOTAL / step16)):
    ts = i * step16; typ, rules = section_at(ts)
    if typ == "intro" or typ == "chapter": continue
    k = int(ts // CH); ch = PROG[k % 4]
    pat = [0, 2, 4, 2, 1, 3, 4, 3]
    if rules and i % 2: continue
    if rng.random() < (0.35 if rules else 0.55):
        m = ch[pat[i % 8]] + 12 + (12 if (i // 8) % 4 == 3 else 0)
        t = tt(0.4); f = mtof(m)
        s = (np.sign(np.sin(2 * np.pi * f * t)) * 0.35 + np.sin(2 * np.pi * f * t)) * np.exp(-t / 0.09) * (1 - np.exp(-t / 0.002))
        add(arp, ts, s, pan=0.35 * np.sin(i * 0.7), gain=0.030)
# ping-pong delay (3/16 note)
dl = int(3 * step16 * SR)
for rep, g in [(1, 0.45), (2, 0.25), (3, 0.13)]:
    sh = dl * rep
    if rep % 2: arp[0, sh:] += g * arp[1, :-sh]; arp[1, sh:] += g * arp[0, :-sh]
    else: arp[:, sh:] += g * arp[:, :-sh]
music += arp

# ───────── drums (solving chapters: soft; final: full)
def kick():
    t = tt(0.45); f = 45 + 75 * np.exp(-t / 0.045); ph = 2 * np.pi * np.cumsum(f) / SR
    return np.sin(ph) * np.exp(-t / 0.24) * (1 - np.exp(-t / 0.002))
def hat(open_=False):
    t = tt(0.25 if open_ else 0.06); n = rng.standard_normal(len(t)); n = np.diff(np.concatenate([[0], n]))
    return n * np.exp(-t / (0.08 if open_ else 0.018)) * 0.5
def clap():
    t = tt(0.3); n = rng.standard_normal(len(t)); env = np.zeros_like(t)
    for o in (0, 0.012, 0.024): env += np.exp(-np.clip(t - o, 0, None) / 0.012) * (t >= o)
    env += 0.6 * np.exp(-t / 0.12)
    return np.convolve(n, [1, 0, -1], 'same') * env * 0.35
KICK = kick()
nbeats = int(TOTAL / BEAT)
duck = np.ones(N, np.float32)
for b in range(nbeats):
    tb = b * BEAT; typ, rules = section_at(tb)
    if not ((typ == "step" and not rules) or typ == "final"): continue
    full = typ == "final"
    if b % 2 == 0 or full:
        add(drums, tb, KICK, gain=0.55 if full else 0.32)
        i0 = int(tb * SR); n = int(0.35 * SR)
        if i0 + n < N: duck[i0:i0 + n] = np.minimum(duck[i0:i0 + n], 1 - 0.35 * np.exp(-np.arange(n) / SR / 0.12))
    if full and b % 4 in (1, 3): add(drums, tb, clap(), gain=0.5)
    for h in range(2):
        add(drums, tb + h * BEAT / 2, hat(open_=(h == 1 and b % 4 == 3)), pan=0.3, gain=(0.22 if full else 0.10) * (1.0 if h else 0.6))
music *= duck

# ───────── SFX
PENT = [69, 72, 74, 76, 79, 81, 84, 86, 88]
def glass(f, d=1.2):
    t = tt(d); s = np.zeros_like(t)
    for r, a, dc in [(1, 1, .6), (2.0, .4, .25), (3.01, .25, .12), (4.2, .12, .08)]: s += a * np.sin(2 * np.pi * f * r * t) * np.exp(-t / dc)
    return s * (1 - np.exp(-t / 0.002))
def tick(f=2400, dec=0.02):
    t = tt(0.12); return np.sin(2 * np.pi * f * t) * np.exp(-t / dec)
def noise_sweep(d, f0, f1, up=True):
    t = tt(d); n = rng.standard_normal(len(t)); y = np.zeros_like(n); s = 0.0
    fc = np.geomspace(f0, f1, len(t)); a = 1 - np.exp(-2 * np.pi * fc / SR)
    for i in range(len(t)): s += a[i] * (n[i] - s); y[i] = s
    env = (t / d) ** 2 if up else np.exp(-t / (d / 4))
    return y * env
def boom(d=2.5):
    t = tt(d); f = 38 + 60 * np.exp(-t / 0.12); ph = 2 * np.pi * np.cumsum(f) / SR
    return np.sin(ph) * np.exp(-t / 0.9) + 0.3 * rng.standard_normal(len(t)) * np.exp(-t / 0.15)
def glitch():
    t = tt(0.7); n = rng.standard_normal(len(t)); crush = np.round(n * 3) / 3
    gate = (np.sin(2 * np.pi * 23 * t) > 0).astype(float)
    sweep = np.sin(2 * np.pi * np.cumsum(900 * np.exp(-t / 0.15) + 60) / SR)
    return (0.4 * crush * gate + 0.8 * sweep) * np.exp(-t / 0.25)
def chime_chord(ms, spread=0.06, g=1.0):
    out = np.zeros(int((len(ms) * spread + 2.5) * SR))
    for i, m in enumerate(ms):
        s = glass(mtof(m), 2.2); i0 = int(i * spread * SR); out[i0:i0 + len(s)] += s[:len(out) - i0]
    return out * g
RISER_SAMPLES = {}
for ev in tl["audio"]:
    t, ty, v = ev["t"], ev["type"], ev.get("v")
    if ty == "place":
        d = int(v) if v is not None else 5; add(sfx, t, glass(mtof(PENT[(d - 1) % 9] + 12)), pan=rng.uniform(-.3, .3), gain=0.16)
    elif ty in ("in", "out"):
        n = ev.get("n", 1)
        for i in range(min(int(n), 8)):
            add(sfx, t + i * 0.045, tick(2800 if ty == "in" else 1500, 0.015), pan=rng.uniform(-.5, .5), gain=0.05)
    elif ty == "let":
        add(sfx, t, chime_chord([69, 76, 81, 85, 88], 0.05, 0.5), gain=0.22)
    elif ty == "arr":
        for i in range(6): add(sfx, t + i * 0.32, tick(1200 + 180 * i, 0.03), gain=0.06)
    elif ty == "bad":
        add(sfx, t, glitch(), gain=0.30); add(sfx, t, boom(1.2), gain=0.25)
    elif ty in ("ghost", "ghostin", "ghostout"):
        add(sfx, t, tick(650, 0.06), gain=0.07)
    elif ty == "beat":
        add(sfx, t, tick(3200, 0.01), gain=0.025)
    elif ty == "chapter":
        add(sfx, t - 2.2, noise_sweep(2.4, 200, 9000, True), gain=0.10)
        add(sfx, t + 0.15, boom(), gain=0.35)
        add(sfx, t + 0.3, chime_chord([57, 64, 69, 72, 76], 0.07, 0.5), gain=0.2)
    elif ty == "intro":
        add(sfx, t + 0.2, noise_sweep(6.0, 80, 3000, True), gain=0.07)
        add(sfx, t + 6.35, boom(3.0), gain=0.45)
        add(sfx, t + 6.4, chime_chord([45, 57, 64, 69, 72, 76, 81, 84], 0.06, 0.6), gain=0.25)
    elif ty == "final":
        add(sfx, t, boom(3.0), gain=0.45)
        add(sfx, t + 0.1, chime_chord([57, 64, 69, 72, 76, 79, 81, 84, 88, 91, 93], 0.08, 0.6), gain=0.3)

# ───────── reverb + master
def make_ir(dur=2.6, seed=5):
    r = np.random.default_rng(seed); n = int(dur * SR); t = np.arange(n) / SR
    ir = np.stack([np.convolve(r.standard_normal(n) * np.exp(-6.9 * t / dur), np.ones(7) / 7, 'same') for _ in range(2)])
    ir = np.concatenate([np.zeros((2, int(0.02 * SR))), ir], axis=1)
    return ir / np.sqrt((ir ** 2).sum(axis=1, keepdims=True))
def convolve(x, ir, block=2 ** 18):
    out = np.zeros((2, x.shape[1] + ir.shape[1]), np.float32); nfft = 1
    while nfft < block + ir.shape[1]: nfft *= 2
    H = [np.fft.rfft(ir[c], nfft) for c in range(2)]
    for c in range(2):
        for i0 in range(0, x.shape[1], block):
            seg = x[c, i0:i0 + block].astype(np.float64)
            y = np.fft.irfft(np.fft.rfft(seg, nfft) * H[c], nfft)[:len(seg) + ir.shape[1] - 1]
            out[c, i0:i0 + len(y)] += y.astype(np.float32)
    return out[:, :x.shape[1]]
ir = make_ir()
mix = 0.20 * music + 0.12 * convolve(music, ir) + 0.30 * drums + 0.9 * sfx + 0.28 * convolve(sfx, ir)
t = np.arange(N) / SR
mix *= np.clip(t / 0.8, 0, 1) * np.clip((TOTAL - 0.2 - t) / 3.5, 0, 1)
pk = np.abs(mix).max(); mix = np.tanh(mix / pk * 1.3) / np.tanh(1.3) * 0.89
pcm = (np.clip(mix, -1, 1) * 32767).astype('<i2').T.copy()
with wave.open(out_path, 'wb') as w:
    w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR); w.writeframes(pcm.tobytes())
print("wrote", out_path, round(TOTAL, 1))
