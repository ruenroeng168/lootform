"""Gentle, suspenseful storybook bed (piano + strings), rain from the storm on, thunder on lightning."""
import importlib.util
from pathlib import Path
import numpy as np
import synth as S

_wb = importlib.util.spec_from_file_location("wb", Path(__file__).parent.parent / "whiteboard-demo" / "score.py")
wb = importlib.util.module_from_spec(_wb); _wb.loader.exec_module(wb)
_ps = importlib.util.spec_from_file_location("ps", Path(__file__).parent.parent / "_templates" / "photo-story" / "score.py")
ps = importlib.util.module_from_spec(_ps); _ps.loader.exec_module(ps)


def build(c, duration, spec, events):
    beat = 60 / spec["bpm"]; bar = beat * 4
    prog = [(45, [57, 60, 64]), (41, [57, 60, 65]), (48, [55, 60, 64]), (43, [55, 59, 62])]  # Am F C G
    keys, pads = S.Track(duration), S.Track(duration)
    for b in range(int(duration / bar) + 2):
        t0 = b * bar; root, ch = prog[b % 4]
        pads.add(t0, S.pad([S.midi(n) for n in ch], bar, 1.2, 1.4), 0.3)
        for i, n in enumerate([ch[0], ch[2], ch[1] + 12, ch[2]]):
            keys.add(t0 + i * beat, ps.piano(S.midi(n + 12), 1.8), 0.16 if i else 0.2)
    st, ch_ = c["storm"]["start"], c["choice"]["start"]
    end = duration - 0.4
    keys.gate([(0, 0), (0.6, 1), (st - 0.3, 1), (st, 0.35), (ch_, 0.7), (end - 1.5, 0.7), (end, 0), (duration + 1, 0)])
    pads.gate([(0, 0), (1, 1), (st, 1.3), (end - 1, 1.2), (end, 0), (duration + 1, 0)])
    pads.buf = S.lowpass(pads.buf, 1700)
    music = ps.echo(keys.buf) + pads.buf
    fx = S.Track(duration)
    for i, (a, b2, kind) in enumerate(events["pen"]):
        if b2 - a > 0.08:
            fx.add(a, wb.scribble(b2 - a, kind == "write", i), 0.14 if kind == "write" else 0.18)
    for t in events["pans"]:
        fx.add(t, S.whoosh(0.8), 0.25)
    for t in events["crashes"]:
        fx.add(t, S.boom(2.6), 0.8); fx.add(t + 0.05, S.highpass(S.noise(1.2), 2500) * np.exp(-S.tt(1.2) * 3) * 0.4, 0.6)
    rain = S.bandpass(S.noise(duration - st + 1), 800, 7000) * 0.22
    rain *= np.minimum(1, S.tt(len(rain) / S.SR) / 1.5)
    fx.add(st + 0.4, rain, 0.8)
    return music, fx.buf
