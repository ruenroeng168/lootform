"""Intense football-drama score: driving minor ostinato + war drums, cut dead on every freeze (record scratch),
'dun dun dun' + timpani on the title, a sad minor waltz for "ภูมิใจในน้อง", mysterious pond, grand end chord."""
import numpy as np
import synth as S


def scratch(d=0.45):
    t = S.tt(d); n = S.noise(d)
    x = S.sweep_lowpass(n, 5000, 300) * np.exp(-t * 5) * (0.6 + 0.4 * np.sign(np.sin(2 * np.pi * 9 * t)))
    return x


def build(duration, D):
    epic, sad = S.Track(duration), S.Track(duration)
    bpm = 118; beat = 60 / bpm; bar = beat * 4
    prog = [45, 41, 43, 40]                                   # A F G E roots, minor and driving
    for b in range(int(duration / bar) + 2):
        t0 = b * bar; r = prog[b % 4]
        epic.add(t0, S.pad([S.midi(r), S.midi(r + 7), S.midi(r + 12)], bar + 0.2, 0.3, 0.6), 0.14)
        for i in range(16):                                   # string-like 16th ostinato
            n = (r + 24, r + 24 + 7, r + 24 + 12, r + 24 + 7)[i % 4]
            epic.add(t0 + i * beat / 4, S.pluck(S.midi(n), 0.18, 1.2), 0.06 if i % 4 else 0.09)
        for i in range(4):                                    # war drums
            epic.add(t0 + i * beat, S.kick(0.35), 0.5 if i in (0, 2) else 0.3)
            epic.add(t0 + i * beat + beat * 0.75, S.thump(0.25), 0.25 if i % 2 else 0.12)
            if i % 2: epic.add(t0 + i * beat, S.clap(0.2), 0.16)
        epic.add(t0, S.bass(S.midi(r - 12), bar * 0.95), 0.18)
    sprog = [[45, 57, 60, 64], [38, 57, 62, 65], [40, 56, 59, 64], [45, 57, 60, 64]]
    for b in range(int(duration / 2.2) + 2):
        t0 = b * 2.2; ch = sprog[b % 4]
        sad.add(t0, S.pad([S.midi(n) for n in ch], 2.4, 0.6, 0.8), 0.15)
        for i, n in enumerate((ch[3] + 12, ch[2] + 12, ch[1] + 12)):
            sad.add(t0 + i * 0.73, S.pluck(S.midi(n), 1.0, 0.4), 0.09)
    ge = [(0, 0)]; gs = [(0, 0)]
    for a, b in D["sad"]:
        ge += [(a - 0.3, 1), (a, 0), (b, 0), (b + 0.4, 1)]; gs += [(a - 0.3, 0), (a + 0.2, 1), (b, 1), (b + 0.4, 0)]
    for a, b in D["freezes"]:
        ge += [(a - 0.02, 1), (a, 0), (b, 0), (b + 0.3, 1)]
    ge += [(D["title"][0] - 0.05, 1), (D["title"][0], 0.3), (D["title"][1], 0.3), (D["title"][1] + 0.3, 1)]
    ge = sorted(ge) + [(D["end"] + 2.5, 1), (duration, 0), (duration + 1, 0)]
    ge = [(0, 0.0), (0.05, 0.0)] + [p for p in ge if p[0] > 0.05]
    epic.gate(sorted(ge, key=lambda p: p[0])); sad.gate(sorted(gs + [(duration + 1, 0)], key=lambda p: p[0]))
    music = S.lowpass(epic.buf, 7000) + sad.buf
    braam = lambda d: S.lowpass(sum(S.saw(S.midi(n), S.tt(d), 12) for n in (33, 40, 45)) * np.exp(-S.tt(d) * 1.2), 900)
    fx = S.Track(duration)
    for t in D["scratch"]: fx.add(t, scratch(), 0.5)
    for t in D["stamps"]: fx.add(t, braam(1.8), 0.25); fx.add(t, S.thump(0.4), 0.6); fx.add(t + 0.01, S.bandpass(S.noise(0.08), 300, 3000) * np.exp(-S.tt(0.08) * 40), 0.4)
    t0 = D["title"][0]
    for i, n in enumerate((40, 40, 36)):                       # dun dun dun
        fx.add(t0 + 0.1 + i * 0.42, S.bass(S.midi(n), 0.38 if i < 2 else 1.0), 0.5); fx.add(t0 + 0.1 + i * 0.42, S.thump(0.4), 0.35)
    fx.add(t0 + 0.94, S.boom(2.2), 0.4); fx.add(t0 + 0.94, braam(2.4), 0.3)
    for c in D["cards"]: fx.add(c[1], S.pop(0.14), 0.3)
    for a, b, _ in D["pond"]:
        fx.add(a + 0.1, S.sparkle(1.6, 900, 14), 0.08)
        t = S.tt(0.6); fx.add(a + 1.0, S.bandpass(S.noise(0.6), 200, 1200) * np.exp(-t * 6), 0.25)    # splash
    end = D["end"]
    fx.add(end, S.boom(2.0), 0.3)
    for i, n in enumerate((69, 76, 81)): fx.add(end + 0.1 + i * 0.12, S.bell(S.midi(n), 1.4), 0.15)
    return music * 0.55, fx.buf
