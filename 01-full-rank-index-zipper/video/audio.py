"""Procedural soundtrack: ambient pad + music-box arpeggio + event SFX, synced to timeline.json."""
import json, sys, wave
import numpy as np

SR = 48000
tl = json.load(open(sys.argv[1]))
out_path = sys.argv[2]
TOTAL = tl["total"] + 2.5
N = int(TOTAL * SR)
rng = np.random.default_rng(7)

def mtof(m): return 440.0 * 2 ** ((m - 69) / 12)

music = np.zeros((2, N), np.float32)
sfx = np.zeros((2, N), np.float32)

def add(buf, start_s, sig, pan=0.0, gain=1.0):
    i0 = int(start_s * SR)
    if i0 >= N: return
    if sig.ndim == 1:
        l = np.sqrt(0.5 * (1 - pan)); r = np.sqrt(0.5 * (1 + pan))
        sig = np.stack([sig * l, sig * r])
    n = min(sig.shape[1], N - i0)
    if i0 < 0:
        sig = sig[:, -i0:]; n = min(sig.shape[1], N); i0 = 0
    buf[:, i0:i0 + n] += gain * sig[:, :n]

# ───────────── pad
CHORDS = [
    [50, 57, 61, 64, 66],   # Dmaj9
    [47, 54, 57, 61, 62],   # Bm9
    [43, 50, 54, 57, 59],   # Gmaj7(9)
    [45, 52, 54, 59, 62],   # A6sus
]
L = 8.0
FADE = 3.0
nseg = int(np.ceil(TOTAL / L)) + 1
for k in range(nseg):
    ch = CHORDS[k % 4]
    t0 = k * L - FADE / 2
    dur = L + FADE
    n = int(dur * SR)
    t = np.arange(n) / SR
    env = np.ones(n)
    nf = int(FADE * SR)
    ramp = 0.5 - 0.5 * np.cos(np.linspace(0, np.pi, nf))
    env[:nf] = ramp; env[-nf:] = ramp[::-1]
    seg = np.zeros((2, n))
    for j, m in enumerate(ch):
        f = mtof(m)
        w = 1.0 if m < 52 else 0.75 if m < 60 else 0.55
        breath = 1 + 0.18 * np.sin(2 * np.pi * (0.06 + 0.013 * j) * (t + k * L) + j)
        for ci in range(2):
            v = np.zeros(n)
            for d in (-0.0019, 0.0, 0.0023):
                ph = rng.uniform(0, 2 * np.pi)
                ff = f * (1 + d * (1 if ci == 0 else -1))
                v += np.sin(2 * np.pi * ff * t + ph) + 0.28 * np.sin(4 * np.pi * ff * t + ph * 2) + 0.07 * np.sin(6 * np.pi * ff * t)
            seg[ci] += w * v * breath
    seg *= env / 15.0
    add(music, t0, seg.astype(np.float32))

# ───────────── music-box arpeggio
def pluck(f, dur=1.6, decay=0.75, bright=0.3):
    n = int(dur * SR); t = np.arange(n) / SR
    env = np.exp(-t / decay) * (1 - np.exp(-t / 0.004))
    return (np.sin(2 * np.pi * f * t) + bright * np.sin(4 * np.pi * f * t) * np.exp(-t / 0.25) + 0.06 * np.sin(6 * np.pi * f * t)) * env

STEP = 0.5
for i in range(int(TOTAL / STEP)):
    ts = i * STEP
    k = int(ts // L)
    ch = CHORDS[k % 4]
    upper = [m + 12 for m in ch[1:]] + [ch[2] + 24, ch[3] + 24]
    beat_in_bar = i % 16
    prob = 0.62 if beat_in_bar % 2 == 0 else 0.30
    if rng.random() < prob:
        m = upper[int(rng.integers(len(upper)))]
        add(music, ts + rng.uniform(0, 0.012), pluck(mtof(m), decay=0.9).astype(np.float32), pan=rng.uniform(-0.6, 0.6), gain=0.050)

# ───────────── SFX
PENT = [74, 76, 78, 81, 83, 86, 88, 90, 93]  # D-major pentatonic, digits 1..9

def marimba(f):
    n = int(0.9 * SR); t = np.arange(n) / SR
    body = np.sin(2 * np.pi * f * t) * np.exp(-t / 0.32)
    click = 0.35 * np.sin(2 * np.pi * 4.0 * f * t) * np.exp(-t / 0.035)
    return (body + click) * (1 - np.exp(-t / 0.002))

def bell(f):
    n = int(2.2 * SR); t = np.arange(n) / SR
    parts = [(1, 1.0, 1.4), (2.76, 0.45, 0.6), (5.40, 0.22, 0.3), (8.93, 0.10, 0.15)]
    s = sum(a * np.sin(2 * np.pi * f * r * t) * np.exp(-t / d) for r, a, d in parts)
    return s * (1 - np.exp(-t / 0.002))

def thud():
    n = int(0.9 * SR); t = np.arange(n) / SR
    fr = 70 + 150 * np.exp(-t / 0.08)
    ph = 2 * np.pi * np.cumsum(fr) / SR
    s = np.sin(ph) * np.exp(-t / 0.28)
    buzz = 0.25 * np.sign(np.sin(2 * np.pi * 98 * t)) * np.exp(-t / 0.12)
    return s + buzz * 0.5

def glide(f0, f1, dur=0.35):
    n = int(dur * SR); t = np.arange(n) / SR
    fr = f0 * (f1 / f0) ** (t / dur)
    ph = 2 * np.pi * np.cumsum(fr) / SR
    env = np.sin(np.pi * t / dur) ** 2
    return np.sin(ph) * env

def tick(f=1500, d=0.03):
    n = int(0.15 * SR); t = np.arange(n) / SR
    return np.sin(2 * np.pi * f * t) * np.exp(-t / d) * (1 - np.exp(-t / 0.001))

def lowpass_sweep(x, f_start, f_end):
    y = np.zeros_like(x); s = 0.0
    fc = np.geomspace(f_start, f_end, len(x))
    a = 1 - np.exp(-2 * np.pi * fc / SR)
    for i in range(len(x)):
        s += a[i] * (x[i] - s); y[i] = s
    return y

def whoosh(dur=2.2):
    n = int(dur * SR); t = np.arange(n) / SR
    noise = rng.standard_normal(n)
    up = int(n * 0.45)
    f = np.concatenate([np.geomspace(300, 5000, up), np.geomspace(5000, 400, n - up)])
    y = np.zeros(n); s = 0.0
    a = 1 - np.exp(-2 * np.pi * f / SR)
    for i in range(n):
        s += a[i] * (noise[i] - s); y[i] = s
    env = np.concatenate([np.linspace(0, 1, up) ** 2, np.exp(-np.linspace(0, 4, n - up))])
    boom = np.sin(2 * np.pi * 55 * t) * np.exp(-t / 0.9) * (t > 0.85 * dur * 0.45)
    return y * env * 0.9 + 0.5 * boom

def shimmer(notes, spacing=0.07, gain=1.0):
    total = int((len(notes) * spacing + 2.5) * SR)
    s = np.zeros(total)
    for i, m in enumerate(notes):
        p = bell(mtof(m)) * 0.6
        i0 = int(i * spacing * SR)
        s[i0:i0 + len(p)] += p[:total - i0]
    return s * gain

for ev in tl["audio"]:
    t, ty, v = ev["t"], ev["type"], ev.get("v")
    if ty == "place":
        d = int(v) if v is not None else 5
        add(sfx, t, marimba(mtof(PENT[(d - 1) % 9])).astype(np.float32), pan=rng.uniform(-0.3, 0.3), gain=0.20)
    elif ty == "rv":
        m = PENT[(int(v) - 1) % 9] + 12
        add(sfx, t, bell(mtof(m)).astype(np.float32), pan=rng.uniform(-0.4, 0.4), gain=0.10)
    elif ty == "bad":
        add(sfx, t, thud().astype(np.float32), gain=0.38)
    elif ty == "arc":
        add(sfx, t, glide(520, 1040, 0.5).astype(np.float32), pan=0.0, gain=0.045)
    elif ty == "ghost":
        add(sfx, t, tick(700, 0.08).astype(np.float32), gain=0.07)
    elif ty == "beat":
        add(sfx, t, tick(1800, 0.025).astype(np.float32), gain=0.03)
    elif ty == "chapter":
        add(sfx, t - 0.3, whoosh().astype(np.float32), gain=0.16)
        add(sfx, t + 0.6, shimmer([74, 78, 81, 85, 88], 0.09, 0.35).astype(np.float32), gain=0.25)
    elif ty == "intro":
        add(sfx, t + 0.4, shimmer([62, 66, 69, 73, 76, 78, 81, 85, 88], 0.11, 0.4).astype(np.float32), gain=0.25)
    elif ty == "final":
        add(sfx, t, shimmer([62, 66, 69, 73, 74, 78, 81, 85, 86, 90, 93, 97], 0.085, 0.5).astype(np.float32), gain=0.32)
        add(sfx, t + 1.2, shimmer([86, 90, 93, 97, 98], 0.06, 0.4).astype(np.float32), gain=0.2)

# ───────────── reverb (FFT overlap-add)
def make_ir(dur=2.8, seed=3):
    r = np.random.default_rng(seed)
    n = int(dur * SR); t = np.arange(n) / SR
    env = np.exp(-6.9 * t / dur)
    ir = np.zeros((2, n))
    for c in range(2):
        x = r.standard_normal(n) * env
        k = 9; x = np.convolve(x, np.ones(k) / k, mode='same')
        ir[c] = x
    pre = int(0.022 * SR)
    ir = np.concatenate([np.zeros((2, pre)), ir], axis=1)
    return ir / np.sqrt((ir ** 2).sum(axis=1, keepdims=True))

def convolve(x, ir, block=2 ** 18):
    out = np.zeros((2, x.shape[1] + ir.shape[1]), np.float32)
    nfft = 1
    while nfft < block + ir.shape[1]: nfft *= 2
    H = [np.fft.rfft(ir[c], nfft) for c in range(2)]
    for c in range(2):
        for i0 in range(0, x.shape[1], block):
            seg = x[c, i0:i0 + block].astype(np.float64)
            y = np.fft.irfft(np.fft.rfft(seg, nfft) * H[c], nfft)[:len(seg) + ir.shape[1] - 1]
            out[c, i0:i0 + len(y)] += y.astype(np.float32)
    return out[:, :x.shape[1]]

ir = make_ir()
wet_m = convolve(music, ir)
wet_s = convolve(sfx, ir)
mix = 0.17 * music + 0.10 * wet_m + 0.9 * sfx + 0.25 * wet_s

# gentle music swell for intro/outro, fades
tt = np.arange(N) / SR
fade_in = np.clip(tt / 1.5, 0, 1)
fade_out = np.clip((tl["total"] - 0.2 - tt) / 3.5, 0, 1)
mix *= fade_in * fade_out

# soft limiter + normalize
peak = np.abs(mix).max()
mix = mix / peak * 1.25
mix = np.tanh(mix) / np.tanh(1.25) * 0.89
pcm = (np.clip(mix, -1, 1) * 32767).astype('<i2').T.copy()
with wave.open(out_path, 'wb') as w:
    w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR)
    w.writeframes(pcm.tobytes())
print("wrote", out_path, f"{TOTAL:.1f}s", "music rms", float(np.sqrt((music ** 2).mean())), "sfx peak", float(np.abs(sfx).max()))
