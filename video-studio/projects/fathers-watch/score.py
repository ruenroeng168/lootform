"""Emotional short-film score: a ticking clock as the motif, sparse felt piano with echo, soft strings swelling
at the drama (s5) and the reveal (s8), silence-then-heartbeat at the hospital, warm resolve at the end."""
import numpy as np
import synth as S


def piano(f, dur=2.6):
    t = S.tt(dur)
    x = sum(np.sin(2 * np.pi * f * k * t) * a * np.exp(-t * (1.0 + k * 0.8)) for k, a in ((1, 1), (2, 0.4), (3, 0.15)))
    return S.lowpass(x * np.minimum(1, t / 0.01), 2600) * 0.5


def echo(x, d=0.42, fb=0.4):
    n = int(d * S.SR); y = x.copy()
    for i in range(1, 5):
        y[n * i:] += x[:-n * i] * fb ** i
    return y


def tick(hi=True):
    t = S.tt(0.05)
    return np.sin(2 * np.pi * (3200 if hi else 2400) * t) * np.exp(-t * 120) * 0.6


def build(c, duration, spec, events):
    e = events; beat = 60 / spec.get("bpm", 66); bar = beat * 4
    prog = [(45, [57, 60, 64]), (41, [53, 57, 60]), (48, [55, 60, 64]), (43, [55, 59, 62])]   # Am F C G
    keys, strings, clock = S.Track(duration), S.Track(duration), S.Track(duration)
    for b in range(int(duration / bar) + 2):
        t0 = b * bar; r, ch = prog[b % 4]
        for i, n in enumerate([ch[0], ch[2], ch[1] + 12, ch[2]]):
            keys.add(t0 + i * beat, piano(S.midi(n + 12)), 0.2 if i == 0 else 0.13)
        keys.add(t0, piano(S.midi(r), 3.5), 0.18)
        strings.add(t0, S.pad([S.midi(n) for n in ch], bar, 1.5, 1.5), 0.3)
    for i in range(int(duration / 0.5)):
        clock.add(i * 0.5, tick(i % 2 == 0), 0.35)
    end = duration - 0.6
    s5, s6, s8, s10, s11 = e["s5"], e["s6"], e["s8"], e["s10"], e["s11"]
    keys.gate([(0, 0), (1.5, 0.8), (s5 - 0.5, 1), (s6 - 0.3, 0), (s6 + 6, 0), (e["s7"], 0.7), (end - 1, 1), (end, 0), (duration + 1, 0)])
    strings.gate([(0, 0), (s4 := e["s4"], 0.2), (s5, 0.9), (s6 - 0.3, 0.15), (s8, 0.5), (s9 := e["s9"], 1.1), (s10, 0.6), (s11, 1.0), (end, 0.6), (duration + 1, 0)])
    clock.gate([(0, 1), (s3 := e["s3"], 0.6), (s6 - 0.3, 0.9), (s7 := e["s7"], 0.25), (s11, 0.6), (end - 1, 0.6), (end, 0), (duration + 1, 0)])
    music = echo(keys.buf) + S.lowpass(strings.buf, 2000) + clock.buf * 0.5

    fx = S.Track(duration)
    fx.add(s6 - 0.2, S.boom(2.0), 0.25)                     # the call
    for i in range(6):                                       # phone vibrate
        fx.add(s6 + i * 0.35, S.bandpass(S.noise(0.2), 120, 300) * 2, 0.4)
    hb = S.Track(5)
    for i in range(6):
        hb.add(i * 0.8, S.kick(0.3), 0.7); hb.add(i * 0.8 + 0.2, S.kick(0.25), 0.45)
    fx.add(e["s10"], S.lowpass(hb.buf, 180), 0.5)
    fx.add(e["s8m"], S.sparkle(2.4, base=1400, density=12), 0.15)   # the engraving appears
    fx.add(e["squeeze"], S.bell(S.midi(84), 2.0), 0.12)
    return music * 0.55, fx.buf
