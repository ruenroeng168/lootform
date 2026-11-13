"""Warm, light acoustic-pop bed under the interview; soft ding before each question, whooshes on photo cuts,
pops on step chips, chime + riser into the end card."""
import numpy as np
import synth as S


def build(duration, D):
    bpm = 98; beat = 60 / bpm; bar = beat * 4
    prog = [(48, [60, 64, 67, 72]), (43, [55, 59, 62, 67]), (45, [57, 60, 64, 69]), (41, [57, 60, 65, 69])]
    keys, low, drums = S.Track(duration), S.Track(duration), S.Track(duration)
    for b in range(int(duration / bar) + 2):
        t0 = b * bar; r, ch = prog[b % 4]
        keys.add(t0, S.pad([S.midi(n) for n in ch[:3]], bar, 0.5, 0.8), 0.11)
        for i, n in enumerate([ch[0], ch[2], ch[1], ch[3], ch[2], ch[1], ch[0], ch[2]]):
            keys.add(t0 + i * beat / 2, S.pluck(S.midi(n + 12), 0.35, 0.8), 0.07 if i % 2 else 0.1)
        low.add(t0, S.bass(S.midi(r - 12), beat * 1.8), 0.2); low.add(t0 + beat * 2, S.bass(S.midi(r - 12), beat * 1.8), 0.16)
        for i in range(4):
            drums.add(t0 + i * beat, S.kick(0.28), 0.22 if i % 2 == 0 else 0)
            drums.add(t0 + i * beat + beat / 2, S.hat(0.04), 0.05)
            if i % 2: drums.add(t0 + i * beat, S.clap(0.16), 0.07)
    end = D["end"]
    for tr in (keys, low, drums):
        tr.gate([(0, 0), (0.3, 0.85), (end - 0.2, 0.85), (end + 0.2, 1.4), (duration - 0.7, 1.4), (duration, 0), (duration + 1, 0)])
    music = S.lowpass(keys.buf, 4500) + low.buf + drums.buf
    fx = S.Track(duration)
    fx.add(0.02, S.boom(1.4), 0.18)
    for q in D["q"]:
        fx.add(q[0] + 0.02, S.bell(S.midi(88), 0.6), 0.11); fx.add(q[0] + 0.1, S.bell(S.midi(93), 0.6), 0.08)
    for t in D["photo_cuts"] + [p[0] for p in D["pip"]]: fx.add(max(0, t - 0.1), S.whoosh(0.35), 0.15)
    for s in D["steps"]: fx.add(s[0], S.pop(0.14), 0.3)
    fx.add(end - 0.5, S.riser(0.5), 0.15)
    for i, n in enumerate((79, 84, 88)): fx.add(end + i * 0.09, S.bell(S.midi(n), 0.9), 0.17)
    return music * 0.4, fx.buf
