"""Bouncy comedy bed (major, staccato, oom-pah bass) + scribbles + cartoon SFX on punchlines."""
import importlib.util
from pathlib import Path
import numpy as np
import synth as S

_wb = importlib.util.spec_from_file_location("wb", Path(__file__).parent.parent / "whiteboard-demo" / "score.py")
wb = importlib.util.module_from_spec(_wb); _wb.loader.exec_module(wb)


def boing(dur=0.7):
    t = S.tt(dur)
    f = 220 * (1 + 0.6 * np.exp(-t * 4) * np.sin(2 * np.pi * 9 * t)) * np.exp(-t * 0.8)
    return np.sin(2 * np.pi * np.cumsum(f) / S.SR) * np.exp(-t * 3) * 0.7


def slide(dur=0.6, up=False):
    t = S.tt(dur); p = t / dur
    f = 400 * (2.5 ** (p if up else 1 - p)) + 300
    return np.sin(2 * np.pi * np.cumsum(f) / S.SR) * np.sin(np.pi * p) * 0.45


def woodblock():
    t = S.tt(0.08)
    return np.sin(2 * np.pi * 1800 * t) * np.exp(-t * 90) * 0.5


def build(c, duration, spec, events):
    beat = 60 / spec["bpm"]; bar = beat * 4
    prog = [(48, [60, 64, 67]), (53, [60, 65, 69]), (55, [59, 62, 67]), (48, [60, 64, 67])]  # C F G C
    keys, bass, perc = (S.Track(duration) for _ in range(3))
    for b in range(int(duration / bar) + 2):
        t0 = b * bar; root, ch = prog[b % 4]
        for i in range(4):
            tb = t0 + i * beat
            bass.add(tb, S.bass(S.midi(root - 12 + (7 if i % 2 else 0)), beat * 0.45), 0.4)   # oom-pah
            keys.add(tb + beat / 2, sum(S.pluck(S.midi(n + 12), 0.18, 1.0) for n in ch) / 2, 0.16)
            perc.add(tb, woodblock(), 0.18 if i % 2 == 0 else 0.1)
            perc.add(tb + beat / 2, S.hat(0.03), 0.08)
    end = duration - 0.4
    for tr in (keys, bass, perc):
        tr.gate([(0, 0), (0.6, 1), (end - 2, 1), (end, 0), (duration + 1, 0)])
    music = (keys.buf + bass.buf + perc.buf) * 0.75
    fx = S.Track(duration)
    for i, (a, b2, kind) in enumerate(events["pen"]):
        if b2 - a > 0.08:
            fx.add(a, wb.scribble(b2 - a, kind == "write", i), 0.18 if kind == "write" else 0.22)
    for t in events["pans"]:
        fx.add(t, S.whoosh(0.7), 0.28)
    M = lambda k, i: c[k]["marks"][i - 1] if i and c[k]["marks"] else c[k]["start"]
    fx.add(M("fire", 2), slide(0.7, up=True), 0.5); fx.add(M("fire", 2) + 0.2, S.noise(0.4) * 0, 0)
    fx.add(M("boxing", 1), S.thump(), 0.6)
    fx.add(M("boxing", 2), S.boom(1.2), 0.45); fx.add(M("boxing", 2) + 0.3, boing(), 0.5)
    fx.add(M("mic", 1), slide(0.5), 0.35)
    fx.add(M("exam", 2), slide(0.9), 0.5); fx.add(M("exam", 2) + 0.8, boing(0.5), 0.4)
    fx.add(M("legend", 1), S.sparkle(1.2, 1800, 20), 0.5)
    return music, fx.buf
