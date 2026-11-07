"""Whimsical storybook bed (pizzicato + glockenspiel + bouncy bass), quieter at night,
plus pen scribbles, page whooshes, synthetic rooster crows, crash and pops."""
import importlib.util
from pathlib import Path
import numpy as np
import synth as S

_wb = importlib.util.spec_from_file_location("wb", Path(__file__).parent.parent / "whiteboard-demo" / "score.py")
wb = importlib.util.module_from_spec(_wb); _wb.loader.exec_module(wb)


def crow(dur=1.3):
    """'เอ้ก อี เอ้ก เอ้กกก' — harmonic voice with a stepped pitch contour + formant band."""
    t = S.tt(dur)
    pts = [(0, 620), (0.12, 900), (0.2, 700), (0.32, 760), (0.4, 980), (0.55, 1080), (0.75, 1150), (1.2, 560), (dur, 480)]
    f = np.interp(t, [p[0] for p in pts], [p[1] for p in pts]) * (1 + 0.025 * np.sin(2 * np.pi * 7 * t))
    ph = 2 * np.pi * np.cumsum(f) / S.SR
    x = sum(np.sin(k * ph) / k ** 0.8 for k in range(1, 9))
    gate = np.interp(t, [0, 0.02, 0.17, 0.2, 0.23, 0.36, 0.39, 0.42, dur - 0.1, dur], [0, 1, 1, 0.15, 1, 1, 0.15, 1, 0.9, 0])
    y = S.bandpass(x, 700, 4200) * gate
    return y / (np.abs(y).max() + 1e-9) * 0.8


def build(c, duration, spec, events):
    beat = 60 / spec["bpm"]; bar = beat * 4
    prog = [(48, [60, 64, 67]), (45, [60, 64, 69]), (41, [60, 65, 69]), (43, [59, 62, 67])]  # C Am F G
    keys, glock, bass, perc = (S.Track(duration) for _ in range(4))
    for b in range(int(duration / bar) + 2):
        t0 = b * bar; root, ch = prog[b % 4]
        for i in range(8):
            keys.add(t0 + i * beat / 2, S.pluck(S.midi(ch[i % 3] + (12 if i in (3, 7) else 0)), 0.22, 0.6), 0.15)
        for i, n in enumerate([ch[2] + 24, ch[1] + 24, ch[0] + 24]):
            if (b + i) % 2 == 0:
                glock.add(t0 + (i * 1.25 + 0.5) * beat, S.bell(S.midi(n), 0.9), 0.1)
        for i in (0, 2):
            bass.add(t0 + i * beat, S.bass(S.midi(root - 12), beat * 0.8), 0.38)
            bass.add(t0 + (i + 1) * beat, S.bass(S.midi(root - 5), beat * 0.4), 0.22)
        for i in range(4):
            perc.add(t0 + i * beat + beat / 2, S.hat(0.03), 0.07)
    n0, n1 = c["night"]["start"] - 0.5, c["meeting"]["start"] - 0.4
    end = duration - 0.4
    for tr, lvl in ((keys, 1), (glock, 1), (bass, 1), (perc, 1)):
        tr.gate([(0, 0), (0.8, lvl), (n0, lvl), (n0 + 0.6, 0.35 * lvl), (n1, 0.35 * lvl), (n1 + 0.6, lvl), (end - 2, lvl), (end, 0), (duration + 1, 0)])
    music = (keys.buf + glock.buf + bass.buf + perc.buf) * 0.8
    fx = S.Track(duration)
    for i, (a, b2, kind) in enumerate(events["pen"]):
        if b2 - a > 0.08:
            fx.add(a, wb.scribble(b2 - a, kind == "write", i), 0.16 if kind == "write" else 0.2)
    for t in events["pans"]:
        fx.add(t, S.whoosh(0.8), 0.3)
    for t in events["crows"]:
        fx.add(t, crow(), 0.55)
    for t in events["crashes"]:
        fx.add(t, S.boom(1.6), 0.7); fx.add(t, S.thump(0.5), 0.6)
    for t in events["pops"]:
        fx.add(t, S.pop(), 0.4)
    return music, fx.buf
