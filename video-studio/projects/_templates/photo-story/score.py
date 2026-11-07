"""Emotional documentary bed: piano-like chords with echo, string pad, soft pulse,
low hits on stats, airy swells on photo cuts, final swell into the last segment."""
import numpy as np
import synth as S


def piano(f, dur=2.2):
    t = S.tt(dur)
    x = sum(np.sin(2 * np.pi * f * k * t) * a * np.exp(-t * (1.2 + k * 0.9)) for k, a in ((1, 1), (2, 0.45), (3, 0.2), (4, 0.1)))
    return x * np.minimum(1, t / 0.004) * 0.5


def echo(x, delay=0.38, fb=0.35, mix=0.3):
    d = int(delay * S.SR); y = x.copy()
    for i in range(1, 5):
        if d * i < len(x):
            y[d * i:] += x[:-d * i] * (fb ** i) * mix / 0.35
    return y


def hit(dur=2.0):
    t = S.tt(dur)
    f = 38 + 50 * np.exp(-t * 5)
    return np.sin(2 * np.pi * np.cumsum(f) / S.SR) * np.exp(-t * 2.4) + S.lowpass(S.noise(dur), 900) * np.exp(-t * 6) * 0.3


def build(c, duration, spec, events):
    beat = 60 / spec.get("bpm", 70)
    bar = beat * 4
    prog = [(45, [57, 60, 64, 69]), (41, [53, 57, 60, 65]), (48, [55, 60, 64, 67]), (43, [55, 59, 62, 67])]  # Am F C G
    keys, pads, low, pulse = (S.Track(duration) for _ in range(4))
    swell = events.get("swell") or duration * 0.85
    for b in range(int(duration / bar) + 2):
        t0 = b * bar
        root, ch = prog[b % 4]
        pads.add(t0, S.pad([S.midi(n) for n in ch[:3]], bar, 1.2, 1.5), 0.32)
        low.add(t0, S.bass(S.midi(root - 12), bar * 0.9), 0.25)
        for i, n in enumerate([ch[0], ch[2], ch[1] + 12, ch[3]]):
            keys.add(t0 + i * beat, piano(S.midi(n + 12)), 0.22 if i == 0 else 0.15)
        for i in range(4):
            pulse.add(t0 + i * beat, S.kick(0.4), 0.22)
    end = duration - 0.5
    keys.gate([(0, 0), (0.8, 1), (end - 3, 1), (end, 0), (duration + 1, 0)])
    pads.gate([(0, 0), (1.5, 0.8), (swell, 0.8), (swell + 2, 1.3), (end - 1, 1.2), (end, 0), (duration + 1, 0)])
    low.gate([(0, 0), (3, 0), (5, 1), (end - 1, 1), (end, 0), (duration + 1, 0)])
    hits = events.get("hits", [])
    p_on = (min(hits) - 0.5) if hits else duration
    pulse.gate([(0, 0), (p_on, 0), (p_on + 1, 1), (swell - 1, 1), (swell, 0), (duration + 1, 0)])
    pads.buf = S.lowpass(pads.buf, 1800)
    music = echo(keys.buf) + pads.buf + low.buf + pulse.buf * 0.8

    fx = S.Track(duration)
    for t in hits:
        fx.add(t, hit(), 0.55)
    for t in events.get("cuts", [])[1:]:
        fx.add(t - 0.4, S.whoosh(0.9), 0.18)
    fx.add(swell - 1.2, S.riser(1.2), 0.25)
    return music * 0.8, fx.buf
