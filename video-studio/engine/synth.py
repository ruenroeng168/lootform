"""Small procedural-audio toolkit (numpy/scipy) for music beds and SFX.

Everything is mono float32 at SR. Functions return arrays you place on a
timeline with `Track.add(t_seconds, samples)`.
"""
import numpy as np
from scipy.signal import butter, lfilter, sosfilt

SR = 48000
_rng = np.random.default_rng(7)


def midi(n):
    return 440.0 * 2 ** ((n - 69) / 12)


def tt(dur):
    return np.arange(int(dur * SR)) / SR


class Track:
    def __init__(self, duration):
        self.buf = np.zeros(int(duration * SR) + SR, dtype=np.float64)

    def add(self, t, x, gain=1.0):
        i = int(t * SR)
        if i >= len(self.buf) or i + len(x) <= 0:
            return
        if i < 0:
            x, i = x[-i:], 0
        n = min(len(x), len(self.buf) - i)
        self.buf[i:i + n] += x[:n] * gain

    def gate(self, points):
        """Multiply by a piecewise-linear gain curve [(t, g), ...]."""
        ts = np.arange(len(self.buf)) / SR
        pts = sorted(points)
        self.buf *= np.interp(ts, [p[0] for p in pts], [p[1] for p in pts])
        return self


# ---------------------------------------------------------------- filters
def lowpass(x, hz, order=2):
    return sosfilt(butter(order, hz, "low", fs=SR, output="sos"), x)


def highpass(x, hz, order=2):
    return sosfilt(butter(order, hz, "high", fs=SR, output="sos"), x)


def bandpass(x, lo, hi, order=2):
    return sosfilt(butter(order, [lo, hi], "band", fs=SR, output="sos"), x)


def sweep_lowpass(x, f0, f1):
    """Cheap time-varying one-pole lowpass (exponential cutoff sweep)."""
    n = len(x)
    f = f0 * (f1 / f0) ** (np.arange(n) / max(n - 1, 1))
    a = np.exp(-2 * np.pi * f / SR)
    y = np.empty(n)
    acc = 0.0
    for i in range(0, n, 64):  # block-wise coefficient update
        ai = a[i]
        seg, zi = lfilter([1 - ai], [1, -ai], x[i:i + 64], zi=[acc * ai])
        y[i:i + 64] = seg
        acc = seg[-1]
    return y


def noise(dur):
    return _rng.uniform(-1, 1, int(dur * SR))


# ---------------------------------------------------------------- instruments
def saw(f, t, harmonics=10):
    out = np.zeros_like(t)
    for k in range(1, harmonics + 1):
        if f * k > SR / 2.2:
            break
        out += np.sin(2 * np.pi * f * k * t) / k
    return out * 0.6


def pad(freqs, dur, attack=0.6, release=0.8):
    t = tt(dur + release)
    x = np.zeros_like(t)
    for f in freqs:
        for det in (-0.006, 0.0, 0.0065):
            x += saw(f * (1 + det), t, 7)
    env = np.minimum(1, t / attack) * np.clip((dur + release - t) / release, 0, 1)
    return x * env / (3 * len(freqs))


def pluck(f, dur=0.35, bright=1.0):
    t = tt(dur)
    x = np.sin(2 * np.pi * f * t) + 0.35 * bright * np.sin(4 * np.pi * f * t) \
        + 0.12 * bright * np.sin(6 * np.pi * f * t)
    return x * np.exp(-t * 9) * np.minimum(1, t / 0.003)


def bass(f, dur):
    t = tt(dur)
    x = np.sin(2 * np.pi * f * t) + 0.4 * np.sign(np.sin(2 * np.pi * f * t)) * 0.35
    x = lowpass(x, 420)
    return x * np.exp(-t * 2.5) * np.minimum(1, t / 0.005) * np.clip((dur - t) / 0.02, 0, 1)


def kick(dur=0.45):
    t = tt(dur)
    f = 45 + 110 * np.exp(-t * 28)
    ph = 2 * np.pi * np.cumsum(f) / SR
    click = noise(dur) * np.exp(-t * 300) * 0.3
    return (np.sin(ph) * np.exp(-t * 7) + click) * 0.95


def hat(dur=0.08, open_=False):
    t = tt(0.3 if open_ else dur)
    x = highpass(noise(len(t) / SR), 7000)
    return x * np.exp(-t * (12 if open_ else 55)) * 0.35


def clap(dur=0.25):
    t = tt(dur)
    x = bandpass(noise(dur), 900, 3500)
    env = np.exp(-t * 18) * (1 + 0.6 * (np.sin(2 * np.pi * 90 * t) > 0) * (t < 0.03))
    return x * env * 0.6


def bell(f, dur=1.2):
    t = tt(dur)
    x = np.sin(2 * np.pi * f * t) + 0.5 * np.sin(2 * np.pi * f * 2.76 * t) * np.exp(-t * 4) \
        + 0.25 * np.sin(2 * np.pi * f * 5.4 * t) * np.exp(-t * 7)
    return x * np.exp(-t * 3.2) * np.minimum(1, t / 0.002) * 0.5


# ---------------------------------------------------------------- SFX
def whoosh(dur=0.55, up=True):
    n = noise(dur)
    x = sweep_lowpass(n, 300 if up else 6000, 6000 if up else 300)
    t = tt(dur)
    env = np.sin(np.pi * np.clip(t / dur, 0, 1)) ** 2
    return highpass(x, 150) * env * 0.9


def thump(dur=0.35):
    t = tt(dur)
    f = 40 + 80 * np.exp(-t * 20)
    return np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * 10) * 0.9


def pop(dur=0.14):
    t = tt(dur)
    f = 300 + 900 * np.exp(-t * 40)
    return np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * 28) * 0.6


def glitch(dur=0.35):
    t = tt(dur)
    x = noise(dur)
    hold = 1 + (np.arange(len(x)) // 1200 % 7) * 9  # stepped sample-and-hold
    idx = (np.arange(len(x)) // hold) * hold
    x = x[np.minimum(idx, len(x) - 1)]
    gate = (np.sin(2 * np.pi * 23 * t) > -0.2).astype(float)
    return bandpass(x, 600, 5000) * gate * np.exp(-t * 6) * 0.45


def click(dur=0.03):
    t = tt(dur)
    return bandpass(noise(dur), 1500, 6000) * np.exp(-t * 180) * 0.7


def riser(dur):
    t = tt(dur)
    p = t / dur
    nz = sweep_lowpass(noise(dur), 400, 12000) * p ** 2
    f = 180 * (8 ** p)
    tone = saw(1, t, 1) * 0  # placeholder for clarity
    tone = np.sin(2 * np.pi * np.cumsum(f) / SR) * 0.25 * p ** 1.5
    return (nz * 0.7 + tone) * np.minimum(1, (dur - t) / 0.01)


def boom(dur=2.6):
    t = tt(dur)
    f = 30 + 70 * np.exp(-t * 6)
    low = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * 2.2)
    crash = highpass(noise(dur), 3000) * np.exp(-t * 2.8) * 0.35
    mid = bandpass(noise(dur), 200, 1500) * np.exp(-t * 9) * 0.6
    return low + crash + mid


def sparkle(dur=2.0, base=1800, density=28):
    out = np.zeros(int(dur * SR) + SR)
    for _ in range(int(dur * density)):
        st = _rng.uniform(0, dur)
        f = base * 2 ** (_rng.integers(0, 24) / 12)
        b = bell(f, 0.6) * _rng.uniform(0.1, 0.35) * (1 - st / dur)
        i = int(st * SR)
        out[i:i + len(b)] += b
    return out


# ---------------------------------------------------------------- mastering
def follower(x, attack=0.01, release=0.25):
    """Envelope follower, returns smoothed |x|."""
    a_a, a_r = np.exp(-1 / (attack * SR)), np.exp(-1 / (release * SR))
    ax = np.abs(x)
    # decimate for speed, then upsample
    step = 48
    d = ax[: len(ax) // step * step].reshape(-1, step).max(axis=1)
    env = np.empty_like(d)
    e = 0.0
    aa, ar = a_a ** step, a_r ** step
    for i, v in enumerate(d):
        e = aa * e + (1 - aa) * v if v > e else ar * e + (1 - ar) * v
        env[i] = e
    return np.interp(np.arange(len(x)), np.arange(len(env)) * step, env)


def softclip(x, drive=1.0):
    return np.tanh(x * drive) / np.tanh(drive)
