"""Energetic sports-recap bed + pen scribbles + crowd roars on goals."""
import importlib.util
from pathlib import Path

import numpy as np
import synth as S

_wb = importlib.util.spec_from_file_location("wb", Path(__file__).parent.parent / "whiteboard-demo" / "score.py")
wb = importlib.util.module_from_spec(_wb); _wb.loader.exec_module(wb)


def crowd(dur=2.4, seed=0):
    t = S.tt(dur)
    rng = np.random.default_rng(seed)
    x = S.bandpass(S.noise(dur), 250, 2600) * 0.7 + S.bandpass(S.noise(dur), 2000, 6000) * 0.25
    swell = np.minimum(1, t / 0.25) * np.exp(-np.maximum(0, t - 0.6) * 1.6)
    flutter = 1 + 0.15 * np.sin(2 * np.pi * rng.uniform(3, 5) * t)
    return x * swell * flutter * 0.8


def build(c, duration, spec, events):
    beat = 60 / spec["bpm"]
    bar = beat * 4
    prog = [(45, [57, 60, 64]), (41, [57, 60, 65]), (48, [55, 60, 64]), (43, [55, 59, 62])]  # Am F C G
    keys, bassT, drums, pads = (S.Track(duration) for _ in range(4))
    for b in range(int(duration / bar) + 2):
        t0 = b * bar
        root, ch = prog[b % 4]
        pads.add(t0, S.pad([S.midi(n) for n in ch], bar, 0.5, 0.8), 0.3)
        for i in range(8):
            keys.add(t0 + i * beat / 2, S.pluck(S.midi(ch[[0, 1, 2, 1][i % 4]] + 12), 0.25, 0.9), 0.13)
        for i in range(8):
            bassT.add(t0 + i * beat / 2, S.bass(S.midi(root - 12 + (12 if i % 4 == 3 else 0)), beat / 2 * 0.85), 0.32)
        for i in range(4):
            tb = t0 + i * beat
            drums.add(tb, S.kick(0.35), 0.6)
            if i % 2:
                drums.add(tb, S.clap(0.2), 0.3)
            drums.add(tb + beat / 2, S.hat(0.05), 0.2)
            drums.add(tb + beat / 4, S.hat(0.03), 0.08)
            drums.add(tb + 3 * beat / 4, S.hat(0.03), 0.08)
    end = duration - 0.4
    gate = [(0, 0), (0.8, 1), (end - 2.5, 1), (end, 0), (duration + 1, 0)]
    for tr in (keys, bassT, drums, pads):
        tr.gate(gate)
    pads.buf = S.lowpass(pads.buf, 2000)
    music = (keys.buf + bassT.buf + drums.buf + pads.buf) * 0.7

    fx = S.Track(duration)
    for i, (a, b, kind) in enumerate(events["pen"]):
        if b - a > 0.08:
            fx.add(a, wb.scribble(b - a, kind == "write", i), 0.2 if kind == "write" else 0.24)
    for i, t in enumerate(events.get("goals", [])):
        fx.add(t - 0.05, crowd(2.6, i), 0.55)
        fx.add(t, S.bell(S.midi(84), 0.8), 0.15)
    for t in events["pans"]:
        fx.add(t, S.whoosh(0.8), 0.3)
    return music, fx.buf
