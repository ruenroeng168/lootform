"""Suspenseful mystery bed (minor, sparse) + pen scribbles + low hits on the verdict."""
import importlib.util
from pathlib import Path
import numpy as np
import synth as S

_wb = importlib.util.spec_from_file_location("wb", Path(__file__).parent.parent / "whiteboard-demo" / "score.py")
wb = importlib.util.module_from_spec(_wb); _wb.loader.exec_module(wb)


def build(c, duration, spec, events):
    beat = 60 / spec["bpm"]; bar = beat * 4
    prog = [(45, [57, 60, 64]), (41, [57, 60, 65]), (38, [57, 62, 65]), (40, [56, 59, 64])]  # Am F Dm E
    pads, keys, low, tick = (S.Track(duration) for _ in range(4))
    for b in range(int(duration / bar) + 2):
        t0 = b * bar; root, ch = prog[b % 4]
        pads.add(t0, S.pad([S.midi(n) for n in ch], bar, 1.0, 1.2), 0.35)
        low.add(t0, S.bass(S.midi(root - 12), bar * 0.9), 0.3)
        for i, n in enumerate([ch[0] + 12, ch[2] + 12, ch[1] + 24]):
            keys.add(t0 + i * beat * 1.5, S.bell(S.midi(n), 1.4), 0.09)
        for i in range(8):
            tick.add(t0 + i * beat / 2, S.hat(0.03), 0.07 if i % 2 else 0.11)
        tick.add(t0, S.kick(0.35), 0.3); tick.add(t0 + beat * 2, S.kick(0.35), 0.22)
    end = duration - 0.4
    for tr in (pads, keys, low, tick):
        tr.gate([(0, 0), (0.6, 1), (end - 2, 1), (end, 0), (duration + 1, 0)])
    v = c["verdict"]["start"]
    tick.gate([(0, 1), (v - 0.2, 1), (v, 0), (v + 2.5, 0), (v + 3.5, 1), (duration + 1, 1)])
    pads.buf = S.lowpass(pads.buf, 1600)
    music = (pads.buf + keys.buf + low.buf + tick.buf) * 0.8
    fx = S.Track(duration)
    for i, (a, b2, kind) in enumerate(events["pen"]):
        if b2 - a > 0.08:
            fx.add(a, wb.scribble(b2 - a, kind == "write", i), 0.2 if kind == "write" else 0.24)
    for t in events["pans"]:
        fx.add(t, S.whoosh(0.8), 0.3)
    fx.add(0.2, S.riser(1.3), 0.25)
    fx.add(c["hook"]["marks"][1] if c["hook"]["marks"] else 3, S.boom(1.8), 0.35)
    fx.add(v + 0.9, S.boom(2.0), 0.45)
    return music, fx.buf
