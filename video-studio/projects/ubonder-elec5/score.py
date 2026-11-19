"""Light, friendly explainer bed + marker scribbles synced to the pen."""
import numpy as np
import synth as S


def scribble(dur, fast=False, seed=0):
    rng = np.random.default_rng(seed)
    t = S.tt(dur)
    rate = rng.uniform(9, 13) if fast else rng.uniform(5, 8)
    am = np.abs(np.sin(2 * np.pi * rate * t + rng.uniform(0, 6))) ** 1.5
    am *= 0.6 + 0.4 * np.abs(np.sin(2 * np.pi * rate * 0.37 * t))
    x = S.bandpass(S.noise(dur), 1800, 7000) * am
    edge = np.minimum(1, np.minimum(t / 0.03, (dur - t) / 0.05))
    return x * edge * 0.5


def build(c, duration, spec, events):
    beat = 60 / spec["bpm"]
    bar = beat * 4
    # Cmaj7 – Am7 – Fmaj7 – G6
    prog = [(48, [60, 64, 67, 71]), (45, [57, 60, 64, 67]), (41, [57, 60, 65, 69]), (43, [55, 59, 62, 64])]
    keys, bassT, drums, pads = (S.Track(duration) for _ in range(4))
    for b in range(int(duration / bar) + 2):
        t0 = b * bar
        root, ch = prog[b % 4]
        pads.add(t0, S.pad([S.midi(n) for n in ch[:3]], bar, 0.8, 1.0), 0.3)
        pat = [0, 2, 1, 3, 2, 1, 3, 2]
        for i in range(8):
            if i in (3, 7) and b % 2:  # leave space
                continue
            keys.add(t0 + i * beat / 2, S.pluck(S.midi(ch[pat[i]] + 12), 0.45, 0.6), 0.16 if i % 2 else 0.2)
        bassT.add(t0, S.bass(S.midi(root - 12), beat * 1.6), 0.45)
        bassT.add(t0 + beat * 2.5, S.bass(S.midi(root - 12), beat * 1.2), 0.35)
        for i in range(4):
            tb = t0 + i * beat
            if i in (0, 2):
                drums.add(tb, S.kick(0.3), 0.45)
            else:
                drums.add(tb, S.clap(0.18), 0.22)
            for j in range(4):
                drums.add(tb + j * beat / 4, S.hat(0.04), 0.1 if j % 2 else 0.16)
    end = duration - 0.4
    gate = [(0, 0), (1.0, 1), (end - 2.5, 1), (end, 0), (duration + 1, 0)]
    for tr in (keys, bassT, drums, pads):
        tr.gate(gate)
    pads.buf = S.lowpass(pads.buf, 1800)
    music = (keys.buf + bassT.buf + drums.buf + pads.buf) * 0.85

    fx = S.Track(duration)
    for i, (a, b, kind) in enumerate(events["pen"]):
        if b - a > 0.08:
            fx.add(a, scribble(b - a, kind == "write", i), 0.22 if kind == "write" else 0.26)
    for t in events["pops"]:
        fx.add(t, S.pop(), 0.45)
        fx.add(t, S.bell(S.midi(84), 0.7), 0.18)
    for t in events["pans"]:
        fx.add(t, S.whoosh(0.8), 0.32)
    return music, fx.buf
