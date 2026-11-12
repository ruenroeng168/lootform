"""Warm podcast/lo-fi bed under the interview + UI sfx: a soft 'ding' before every question, whooshes on photo
cuts and page changes, pops on chips, a chime when the logo lands, clicks on taps and a riser + chime into the end card."""
import numpy as np
import synth as S


def build(duration, D):
    bpm = 92; beat = 60 / bpm; bar = beat * 4
    prog = [(45, [57, 60, 64, 67]), (41, [53, 57, 60, 64]), (48, [55, 60, 64, 67]), (43, [55, 59, 62, 67])]
    keys, low, drums = S.Track(duration), S.Track(duration), S.Track(duration)
    for b in range(int(duration / bar) + 2):
        t0 = b * bar; r, ch = prog[b % 4]
        for i, n in enumerate([ch[0], ch[2], ch[3], ch[1]]):
            keys.add(t0 + i * beat, S.pluck(S.midi(n + 12), 0.5, 0.6), 0.10)
        keys.add(t0, S.pad([S.midi(n) for n in ch[:3]], bar, 0.8, 0.8), 0.12)
        low.add(t0, S.bass(S.midi(r - 12), beat * 3.5), 0.2)
        for i in range(4):
            drums.add(t0 + i * beat, S.kick(0.3), 0.24 if i % 2 == 0 else 0.0)
            drums.add(t0 + i * beat + beat / 2, S.hat(0.04), 0.06)
            if i % 2: drums.add(t0 + i * beat, S.clap(0.18), 0.08)
    tour = D["tour"]["start"]; end = D["end"]
    g = [(0, 0), (0.3, 0.75), (tour - 0.2, 0.8), (tour, 1.0), (duration - 0.6, 1.0), (duration, 0), (duration + 1, 0)]
    for tr in (keys, low, drums): tr.gate(g)
    drums.gate([(0, 0), (D["segs"][2][1], 0), (D["segs"][2][1] + 0.1, 1), (duration + 1, 1)])   # beat enters at Q2
    music = S.lowpass(keys.buf, 4000) + low.buf + drums.buf

    fx = S.Track(duration)
    for t0, t1, _, qi in D["q"]:
        fx.add(t0 + 0.02, S.bell(S.midi(88), 0.6), 0.12); fx.add(t0 + 0.1, S.bell(S.midi(93), 0.6), 0.09)
    for t in D["photo_cuts"] + [p[0] for p in D["pip"]]:
        fx.add(max(0, t - 0.1), S.whoosh(0.35), 0.18)
    for s in D["tour"]["shots"]:
        fx.add(max(0, s[1] - 0.12), S.whoosh(0.4), 0.2)
    for t in D.get("pops", []): fx.add(t, S.pop(0.14), 0.32)
    for t in D.get("taps", []): fx.add(t, S.click(), 0.6); fx.add(t + 0.01, S.pop(0.1), 0.25)
    if D.get("logo"): fx.add(D["logo"], S.bell(S.midi(84), 1.0), 0.2); fx.add(D["logo"] + 0.08, S.sparkle(1.2), 0.12)
    fx.add(end - 0.6, S.riser(0.6), 0.18)
    for i, n in enumerate((79, 84, 88)): fx.add(end + i * 0.09, S.bell(S.midi(n), 0.9), 0.2)
    return music * 0.42, fx.buf
