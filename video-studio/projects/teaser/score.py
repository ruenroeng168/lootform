"""Music bed + SFX for the LOOTY teaser, synced to voice cues.

build(cues, duration, spec) -> (music, sfx) numpy arrays at synth.SR
"""
import numpy as np
import synth as S


def build(c, duration, spec):
    beat = 60 / spec["bpm"]
    bar = beat * 4
    burst = c["legendary"]["start"] - 0.15          # crate explodes
    rise0 = burst - 1.45                              # tension riser start
    groove0 = c["pull"]["start"] - 0.2                # drums + bass in
    outro = c["outro"]["start"]
    end_hit = c["outro"]["end"] + 0.3
    fade_end = duration - 0.2

    # Am – F – C – G  (i – VI – III – VII), dark but hopeful
    prog = [(57, [57, 60, 64]), (53, [53, 57, 60]), (48, [55, 60, 64]), (55, [55, 59, 62])]

    pad, arp, bass_t, drums = (S.Track(duration) for _ in range(4))
    nbars = int(duration / bar) + 2
    for b in range(nbars):
        t0 = b * bar
        root, chord = prog[b % 4]
        pad.add(t0, S.pad([S.midi(n) for n in chord] + [S.midi(chord[0] - 12)], bar), 0.55)
        pattern = [0, 1, 2, 1, 0, 2, 1, 2]
        for i in range(16):
            n = chord[pattern[i % 8]] + 12 + (12 if i % 8 == 7 else 0)
            arp.add(t0 + i * beat / 4, S.pluck(S.midi(n), 0.3, 0.8), 0.22 if i % 4 == 0 else 0.15)
        for i in range(8):  # bass on 8ths, root + octave bounce
            n = root - 24 + (12 if i % 4 == 3 else 0)
            bass_t.add(t0 + i * beat / 2, S.bass(S.midi(n), beat / 2 * 0.9), 0.55)
        for i in range(4):
            tb = t0 + i * beat
            post = tb >= burst
            if i % 2 == 0 or post:
                drums.add(tb, S.kick(), 0.9)
            if post and i % 2 == 1:
                drums.add(tb, S.clap(), 0.55)
            drums.add(tb + beat / 2, S.hat(open_=post and i == 3), 0.5)
            if post:
                drums.add(tb + beat / 4, S.hat(), 0.18)
                drums.add(tb + 3 * beat / 4, S.hat(), 0.18)

    # arrangement gates
    pad.gate([(0, 0.0), (0.6, 0.7), (rise0, 0.8), (burst - 0.05, 0.25), (burst, 1.0),
              (fade_end - 2.5, 1.0), (fade_end, 0.0), (duration + 1, 0)])
    arp.gate([(0, 0.0), (0.9, 0.0), (1.6, 0.8), (rise0, 0.8), (rise0 + 0.4, 0.0),
              (burst, 0.0), (burst + 0.01, 1.0), (outro, 0.9), (fade_end - 1.5, 0.5),
              (fade_end, 0), (duration + 1, 0)])
    bass_t.gate([(0, 0), (groove0 - 0.01, 0), (groove0, 1), (rise0, 1), (rise0 + 0.05, 0),
                 (burst, 0), (burst + 0.01, 1.1), (end_hit, 1.0), (end_hit + 0.05, 0),
                 (duration + 1, 0)])
    drums.gate([(0, 0), (groove0 - 0.01, 0), (groove0, 0.85), (rise0, 0.85), (rise0 + 0.05, 0),
                (burst, 0), (burst + 0.01, 1.0), (end_hit, 1.0), (end_hit + 0.05, 0),
                (duration + 1, 0)])
    pad.buf = S.lowpass(pad.buf, 2400)
    music = pad.buf + arp.buf + bass_t.buf + drums.buf

    # SFX ----------------------------------------------------------------
    fx = S.Track(duration)
    fx.add(0.05, S.glitch(0.5), 0.6)                    # logo glitch-in
    fx.add(0.2, S.whoosh(0.5, up=False), 0.6)           # LOOTY drops in
    fx.add(0.72, S.thump(), 0.9)                        # landing
    fx.add(groove0, S.pop(), 0.8)                       # crate pops in
    fx.add(groove0 + 0.02, S.bell(S.midi(84), 0.8), 0.25)
    for i, (cue, note) in enumerate([("common", 76), ("rare", 79), ("epic", 83), ("or", 86)]):
        t = c[cue]["start"]
        fx.add(t, S.pop(), 0.5)
        fx.add(t, S.bell(S.midi(note), 1.0), 0.45)
    rng = np.random.default_rng(3)
    t = c["maybe"]["start"]
    while t < burst:                                     # crate rattles, faster toward burst
        p = (t - c["maybe"]["start"]) / (burst - c["maybe"]["start"])
        fx.add(t, S.click(), 0.25 + 0.4 * p)
        t += max(0.035, 0.28 * (1 - p) ** 1.5 * rng.uniform(0.6, 1.3))
    fx.add(rise0, S.riser(burst - rise0), 0.75)
    fx.add(burst, S.boom(), 1.0)
    fx.add(burst + 0.05, S.sparkle(2.4, 1600, 34), 0.8)
    fx.add(outro - 0.35, S.whoosh(0.6), 0.45)
    fx.add(end_hit, S.thump(0.6), 0.7)
    fx.add(end_hit, S.bell(S.midi(81), 2.0), 0.4)
    fx.add(end_hit, S.bell(S.midi(88), 2.0), 0.25)
    return music, fx.buf
