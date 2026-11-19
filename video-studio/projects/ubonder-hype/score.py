"""Hype beat for the อุบลเด้อ reel: phin-flavoured riff on A-minor pentatonic over a hard 4/4 (kick, clap, 16th hats,
808-ish sub). Hook = notification pings + a tense pulse that drops out for the question, beat slams with the logo,
hits on every cut, a stop before the last line and a big hit on the end card."""
import numpy as np
import synth as S


def phin(f, dur=0.3):
    t = S.tt(dur); x = sum(np.sin(2 * np.pi * f * k * t) / k ** 1.3 for k in range(1, 7)) * np.exp(-t * 9)
    return x * 0.5 + S.pluck(f, dur, 1.2) * 0.5


def build(duration, D):
    bpm = 132; beat = 60 / bpm; bar = beat * 4
    A = [57, 60, 62, 64, 67, 69, 72, 74, 76]
    riffs = [[5, 4, 3, 4, 5, 7, 5, 4], [3, 4, 5, 3, 2, 1, 2, 3]]
    lead, drums, sub = S.Track(duration), S.Track(duration), S.Track(duration)
    roots = [33, 33, 29, 31]
    for b in range(int(duration / bar) + 2):
        t0 = b * bar; r = riffs[b % 2]
        for i, k in enumerate(r): lead.add(t0 + i * beat / 2, phin(S.midi(A[k])), 0.13 if i % 2 == 0 else 0.09)
        for i in range(4):
            tb = t0 + i * beat
            drums.add(tb, S.kick(0.35), 0.6)
            if i % 2: drums.add(tb, S.clap(0.2), 0.32)
            for q in range(4): drums.add(tb + q * beat / 4, S.hat(0.03), 0.07 if q % 2 else 0.1)
        sub.add(t0, S.bass(S.midi(roots[b % 4]), bar * 0.95), 0.4)
    sg = D["segs"]; drop = sg["brand"][0]; e0 = sg["end"][0]
    for tr in (lead, drums, sub):
        tr.gate([(0, 0), (drop - 0.02, 0), (drop, 1), (e0 + 0.1, 1), (e0 + 0.3, 0.15), (D["endcard"] - 0.05, 0.15), (D["endcard"], 1.1),
                 (duration - 0.5, 1.1), (duration, 0), (duration + 1, 0)])
    music = lead.buf + drums.buf + sub.buf
    tense = S.Track(duration)                                    # hook: pulse + low drone
    t = 0.0
    while t < drop: tense.add(t, S.kick(0.2), 0.25); t += 0.5
    tense.add(0, S.pad([S.midi(45), S.midi(52)], drop + 0.2, 0.2, 0.3), 0.18)
    music = music + tense.buf
    fx = S.Track(duration)
    for i in range(6):                                           # comment notification pings
        fx.add(0.35 + i * 0.42, S.bell(S.midi(96 if i % 2 else 91), 0.25), 0.12)
    h = sg["hook"]; fx.add(h[0] + 0.7, S.whoosh(0.4), 0.2)
    fx.add(drop, S.boom(2.0), 0.5); fx.add(drop, S.thump(0.4), 0.6)
    for c in D["cuts"][2:]: fx.add(max(0, c - 0.08), S.whoosh(0.3), 0.18); fx.add(c, S.thump(0.25), 0.25)
    for k in ("f1", "f2", "f3"):
        a, b = sg[k]; fx.add(a + 0.5, S.pop(0.14), 0.35); fx.add((a + b) / 2, S.pop(0.14), 0.35)
    fx.add(D["endcard"] - 0.5, S.riser(0.5), 0.25); fx.add(D["endcard"], S.boom(2.2), 0.5)
    for i, n in enumerate((81, 88, 93)): fx.add(D["endcard"] + 0.1 + i * 0.08, S.bell(S.midi(n), 0.9), 0.18)
    return music * 0.5, fx.buf
