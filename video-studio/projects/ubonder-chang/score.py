"""Upbeat, clean e-commerce bed + UI pops, whooshes, price 'cha-ching' and CTA chime."""
import numpy as np
import synth as S


def cash(dur=0.9):
    """Register 'cha-ching': two bright bells + a short noise shimmer."""
    t = S.tt(dur)
    x = S.bell(S.midi(88), dur) * 0.7
    y = np.zeros_like(x); b2 = S.bell(S.midi(93), dur - 0.08) * 0.7
    y[int(0.08 * S.SR): int(0.08 * S.SR) + len(b2)] = b2[: len(y) - int(0.08 * S.SR)]
    sh = S.highpass(S.noise(dur), 6000) * np.exp(-t * 6) * 0.25
    return x + y + sh


def build(c, duration, spec, events):
    beat = 60 / spec["bpm"]
    bar = beat * 4
    prog = [(48, [60, 64, 67, 71]), (45, [60, 64, 69]), (41, [60, 65, 69]), (43, [59, 62, 67])]  # Cmaj7 Am F G
    keys, bassT, drums, pads = (S.Track(duration) for _ in range(4))
    for b in range(int(duration / bar) + 2):
        t0 = b * bar
        root, ch = prog[b % 4]
        pads.add(t0, S.pad([S.midi(n) for n in ch[:3]], bar, 0.4, 0.8), 0.25)
        for i in range(8):
            if i in (2, 5):
                keys.add(t0 + i * beat / 2, S.pluck(S.midi(ch[i % len(ch)] + 12), 0.3, 1.0), 0.16)
            elif i % 2 == 0:
                keys.add(t0 + i * beat / 2, S.pluck(S.midi(ch[0] + 24), 0.2, 0.7), 0.08)
        for i in (0, 3, 4, 6):
            bassT.add(t0 + i * beat / 2, S.bass(S.midi(root - 12), beat / 2 * 0.9), 0.35)
        for i in range(4):
            tb = t0 + i * beat
            drums.add(tb, S.kick(0.3), 0.5 if i % 2 == 0 else 0.35)
            if i % 2:
                drums.add(tb, S.clap(0.18), 0.28)
            drums.add(tb + beat / 2, S.hat(0.04), 0.16)
    end = duration - 0.3
    for tr in (keys, bassT, drums, pads):
        tr.gate([(0, 0), (0.4, 1), (end - 2.0, 1), (end, 0), (duration + 1, 0)])
    pads.buf = S.lowpass(pads.buf, 2200)
    music = (keys.buf + bassT.buf + drums.buf + pads.buf) * 0.7

    fx = S.Track(duration)
    for t in events.get("whoosh", []):
        if 0 < t < duration:
            fx.add(t, S.whoosh(0.5), 0.3)
    for t in events.get("pops", []):
        fx.add(t, S.pop(), 0.45)
    if events.get("price"):
        fx.add(events["price"] + 0.55, cash(), 0.5)
    if events.get("boom"):
        fx.add(events["boom"], S.boom(1.8), 0.32); fx.add(events["boom"], S.thump(0.35), 0.4)
    for t in events.get("taps", []):
        fx.add(t, S.click(), 0.6); fx.add(t + 0.01, S.pop(0.1), 0.3)
    if events.get("done"):
        fx.add(events["done"], cash(), 0.45); fx.add(events["done"] + 0.1, S.sparkle(1.4), 0.15)
    if events.get("cta"):
        for i, n in enumerate((79, 84, 88)):
            fx.add(events["cta"] + i * 0.09, S.bell(S.midi(n), 0.9), 0.22)
    return music, fx.buf
