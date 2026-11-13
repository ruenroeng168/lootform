"""Tense hook (low drone + ticking + heartbeat) that breaks on "ไฟดูด!" (zap + boom + red flash), then a warm,
reassuring bed for the safety tip and the service steps, chime on the end card."""
import numpy as np
import synth as S


def build(duration, D):
    segs = {s["key"]: s for s in D["segs"]}
    calm0 = segs["safety"]["t0"] - 0.15
    tense = S.Track(duration)
    t = 0.0
    while t < calm0:
        tense.add(t, S.kick(0.25), 0.32); tense.add(t + 0.22, S.kick(0.2), 0.18)      # heartbeat
        t += 0.86
    tk = 0.0
    while tk < calm0:
        tense.add(tk, S.hat(0.02), 0.06); tk += 0.43
    tense.add(0, S.pad([S.midi(38), S.midi(45), S.midi(50)], calm0 + 0.5, 0.6, 0.5), 0.28)
    tense.gate([(0, 1), (D["zap"] - 0.05, 1), (D["zap"] + 0.3, 0.25), (calm0, 0), (duration + 1, 0)])

    bpm = 96; beat = 60 / bpm; bar = beat * 4
    prog = [(48, [60, 64, 67, 71]), (45, [57, 60, 64, 67]), (41, [57, 60, 65, 69]), (43, [55, 59, 62, 67])]
    keys, low, drums = S.Track(duration), S.Track(duration), S.Track(duration)
    for b in range(int((duration - calm0) / bar) + 2):
        t0 = calm0 + b * bar; r, ch = prog[b % 4]
        keys.add(t0, S.pad([S.midi(n) for n in ch[:3]], bar, 0.5, 0.8), 0.13)
        for i, n in enumerate([ch[0], ch[2], ch[1], ch[3]]):
            keys.add(t0 + i * beat, S.pluck(S.midi(n + 12), 0.5, 0.7), 0.11)
        low.add(t0, S.bass(S.midi(r - 12), beat * 3.5), 0.2)
        for i in range(4):
            drums.add(t0 + i * beat, S.kick(0.3), 0.26 if i % 2 == 0 else 0)
            drums.add(t0 + i * beat + beat / 2, S.hat(0.04), 0.06)
            if i % 2: drums.add(t0 + i * beat, S.clap(0.18), 0.09)
    for tr in (keys, low, drums):
        tr.gate([(0, 0), (calm0, 0), (calm0 + 0.6, 1), (duration - 0.8, 1), (duration, 0), (duration + 1, 0)])
    music = tense.buf + S.lowpass(keys.buf, 4500) + low.buf + drums.buf

    fx = S.Track(duration)
    fx.add(0.02, S.boom(1.8), 0.25)
    t = S.tt(0.5); beep = np.sign(np.sin(2 * np.pi * 880 * t)) * ((t % 0.25) < 0.12) * np.exp(-t * 2)
    fx.add(D["warn"], beep, 0.12)
    zap = S.bandpass(S.noise(0.45), 1500, 9000) * (np.abs(np.sin(2 * np.pi * 60 * S.tt(0.45))) ** 3) * np.exp(-S.tt(0.45) * 5)
    fx.add(D["zap"], zap, 0.55); fx.add(D["zap"], S.thump(0.4), 0.5); fx.add(D["zap"] + 0.02, S.glitch(0.3), 0.3)
    for sg in D["segs"][1:]:
        fx.add(max(0, sg["t0"] - 0.25), S.whoosh(0.4), 0.18)
    sp = segs["safety"]["parts"]
    for p in sp: fx.add(p[0] + 0.05, S.pop(0.14), 0.32)
    fx.add(segs["s1"]["parts"][0][0] + 1.2, S.click(), 0.6)
    fx.add(D["end"] + 0.1, S.bell(S.midi(84), 1.0), 0.2)
    for i, n in enumerate((79, 84, 88)): fx.add(D["end"] + 0.5 + i * 0.09, S.bell(S.midi(n), 0.9), 0.16)
    return music * 0.5, fx.buf
