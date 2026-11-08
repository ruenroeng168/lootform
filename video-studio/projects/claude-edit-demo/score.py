"""Light, playful pop bed (plucks, soft kick, hats) + UI/magic SFX: typing clicks, send whoosh,
riser into the first reveal, poof + sparkle on each object, chime on the end card."""
import numpy as np
import synth as S



def build(duration, prompts, cues):
    bpm = 112; beat = 60 / bpm; bar = beat * 4
    prog = [(48, [60, 64, 67, 71]), (45, [57, 60, 64, 67]), (41, [53, 57, 60, 64]), (43, [55, 59, 62, 67])]  # Cmaj7 Am7 Fmaj7 G
    keys, low, drums = S.Track(duration), S.Track(duration), S.Track(duration)
    for b in range(int(duration / bar) + 2):
        t0 = b * bar; root, ch = prog[b % 4]
        for i in range(8):
            n = ch[[0, 2, 1, 3, 2, 0, 3, 1][i]] + 12
            keys.add(t0 + i * beat / 2, S.pluck(S.midi(n), 0.3, 0.9), 0.1 if i % 2 else 0.14)
        low.add(t0, S.bass(S.midi(root - 12), beat * 1.8), 0.22)
        low.add(t0 + beat * 2.5, S.bass(S.midi(root - 12), beat * 1.2), 0.18)
        for i in range(4):
            drums.add(t0 + i * beat, S.kick(0.35), 0.32)
            drums.add(t0 + i * beat + beat / 2, S.hat(0.05), 0.09)
            if i in (1, 3):
                drums.add(t0 + i * beat, S.clap(0.2), 0.14)
    end = duration - 0.3
    fan = cues["fan"]
    for tr in (keys, low):
        tr.gate([(0, 0), (0.3, 1), (end - 0.8, 1), (end, 0), (duration + 1, 0)])
    drums.gate([(0, 0), (fan - 0.05, 0), (fan, 1), (end - 0.8, 1), (end, 0), (duration + 1, 0)])
    music = keys.buf + low.buf + drums.buf * 0.9

    fx = S.Track(duration)
    rnd = np.random.default_rng(7)
    for p in prompts:
        fx.add(p["show"], S.pop(0.14), 0.25)
        t = p["t0"]
        while t < p["t1"]:
            fx.add(t, S.click(0.03), 0.22 * rnd.uniform(0.6, 1.0))
            t += rnd.uniform(0.07, 0.13)
        fx.add(p["t1"] + 0.05, S.whoosh(0.4), 0.16)
        r = p["reveal"]
        if p["obj"] == "fan":
            fx.add(r - 0.9, S.riser(0.9), 0.22)
        fx.add(r, S.bandpass(S.noise(0.5), 400, 4000) * np.exp(-S.tt(0.5) * 9), 0.35)
        fx.add(r, S.thump(0.35), 0.4)
        fx.add(r + 0.02, S.sparkle(1.2), 0.16)
    fx.add(cues["end"], S.bell(S.midi(84), 1.4), 0.12)
    fx.add(cues["end"] + 0.12, S.bell(S.midi(91), 1.4), 0.1)
    return music * 0.5, fx.buf
