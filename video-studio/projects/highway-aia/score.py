"""Upbeat stadium anthem (four-on-the-floor, claps, bright chords), riser into set 4 and a big hit on "5-1",
music drops under the team's Happy Birthday singing, chime on the end card."""
import numpy as np
import synth as S


def build(duration, D):
    bpm = 126; beat = 60 / bpm; bar = beat * 4
    prog = [(45, [57, 60, 64]), (41, [53, 57, 60]), (48, [55, 60, 64]), (43, [55, 59, 62])]
    keys, low, drums = S.Track(duration), S.Track(duration), S.Track(duration)
    for b in range(int(duration / bar) + 2):
        t0 = b * bar; r, ch = prog[b % 4]
        for i in range(8):
            keys.add(t0 + i * beat / 2, S.pluck(S.midi(ch[i % 3] + 12), 0.25, 1.1), 0.1 if i % 2 == 0 else 0.07)
        keys.add(t0, S.pad([S.midi(n) for n in ch], bar, 0.2, 0.5), 0.1)
        for i in range(4):
            tb = t0 + i * beat
            drums.add(tb, S.kick(0.3), 0.5); drums.add(tb + beat / 2, S.hat(0.05), 0.12)
            if i % 2: drums.add(tb, S.clap(0.2), 0.28)
            low.add(tb + beat / 2, S.bass(S.midi(r - 12), beat * 0.45), 0.3)
    sg = D["segs"]; b0, b1 = sg["bday"][0] + 3.0, sg["bday"][1]
    g = [(0, 0), (0.1, 0.9), (sg["s4"][0] - 0.6, 0.9), (sg["s4"][0] - 0.05, 0.0), (sg["s4"][0] + 0.15, 1.0),
         (b0 - 0.3, 1.0), (b0 + 0.5, 0.18), (b1, 0.18), (b1 + 0.4, 0.9), (duration - 0.6, 0.9), (duration, 0), (duration + 1, 0)]
    for tr in (keys, low, drums): tr.gate(g)
    music = S.lowpass(keys.buf, 6000) + low.buf + drums.buf
    fx = S.Track(duration)
    fx.add(0.03, S.boom(1.6), 0.3)
    for k in sg:
        if sg[k][0] > 0.3: fx.add(sg[k][0] - 0.12, S.whoosh(0.4), 0.2)
    t = S.tt(0.5); whistle = np.sin(2 * np.pi * (2900 + 120 * np.sin(2 * np.pi * 28 * t)) * t) * np.exp(-t * 2.5) * 0.4
    fx.add(sg["intro"][0] + 0.1, whistle, 0.3)
    for when, k, a, b in D["scores"]: fx.add(when + 0.9, S.pop(0.14), 0.4)
    s4 = sg["s4"][0]; fx.add(s4 - 0.6, S.riser(0.6), 0.25); fx.add(s4 + 1.6, S.boom(2.0), 0.4); fx.add(s4 + 1.6, S.sparkle(1.4), 0.2)
    for i, n in enumerate((79, 84, 88)): fx.add(D["end"] + i * 0.09, S.bell(S.midi(n), 0.9), 0.18)
    def scratch(d=0.4):
        t = S.tt(d); return S.sweep_lowpass(S.noise(d), 5000, 300) * np.exp(-t * 5) * (0.6 + 0.4 * np.sign(np.sin(2 * np.pi * 9 * t)))
    for a, b in D["freezes"]: fx.add(a, scratch(), 0.45)
    for a, b, _ in D["labels"]: fx.add(a + 0.05, S.pop(0.14), 0.4)
    for a, b, _ in D["stickers"]:
        t = S.tt(0.35); fx.add(a, np.sin(2 * np.pi * (300 + 900 * t) * t) * np.exp(-t * 6) * 0.5, 0.35)        # boing
    for a, b in D["live"]: fx.add(max(0, a - 0.1), S.whoosh(0.35), 0.15)
    return music * 0.5, fx.buf
