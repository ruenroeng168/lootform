"""Fight-night bed: driving drums + bass + stabs, boxing bell at each round, impact hits on numbers,
crowd roar on each round winner, riser into the summary."""
import numpy as np
import synth as S


def ring_bell(dur=2.4):
    t = S.tt(dur)
    x = sum(np.sin(2 * np.pi * f * t) * a * np.exp(-t * d) for f, a, d in ((1180, 1, 1.6), (1630, 0.6, 2.2), (2380, 0.45, 2.8), (3410, 0.25, 4)))
    hit = S.noise(dur) * np.exp(-t * 60) * 0.4
    return (x + hit) * 0.5


def crowd(dur=2.6):
    t = S.tt(dur)
    n = S.bandpass(S.noise(dur), 300, 3200) * 0.6 + S.bandpass(S.noise(dur), 900, 5000) * 0.25
    # many voices: slow random swells
    mod = 0.7 + 0.3 * np.sin(2 * np.pi * 3.1 * t) * np.sin(2 * np.pi * 0.7 * t + 1)
    env = np.minimum(1, t / 0.25) * np.exp(-np.maximum(0, t - 0.8) * 1.6)
    return n * mod * env


def impact(dur=1.2):
    t = S.tt(dur)
    f = 45 + 90 * np.exp(-t * 14)
    body = np.sin(2 * np.pi * np.cumsum(f) / S.SR) * np.exp(-t * 4.5)
    return body + S.highpass(S.noise(dur), 2500) * np.exp(-t * 30) * 0.35


def build(c, duration, spec, events):
    beat = 60 / spec.get("bpm", 120)
    bar = beat * 4
    roots = [40, 40, 43, 38]  # E E G D
    drums, bass, stab, pad = (S.Track(duration) for _ in range(4))
    for b in range(int(duration / bar) + 2):
        t0 = b * bar; r = roots[b % 4]
        pad.add(t0, S.pad([S.midi(r + 12), S.midi(r + 19), S.midi(r + 24)], bar, 0.4, 0.6), 0.18)
        for i in range(4):
            drums.add(t0 + i * beat, S.kick(0.4), 0.55)
            drums.add(t0 + i * beat + beat / 2, S.hat(0.06), 0.16)
            if i in (1, 3):
                drums.add(t0 + i * beat, S.clap(0.22), 0.3)
        for i in range(8):
            bass.add(t0 + i * beat / 2, S.bass(S.midi(r - 12 + (7 if i == 6 else 0)), beat / 2 * 0.9), 0.33)
        stab.add(t0, S.pluck(S.midi(r + 24), 0.3, 1.4), 0.14)
        stab.add(t0 + beat * 2.5, S.pluck(S.midi(r + 31), 0.3, 1.4), 0.1)
    end = duration - 0.4
    summ = events.get("summary", duration * 0.8)
    hook2 = events.get("hook2", 2.0)
    drums.gate([(0, 0), (hook2 - 0.1, 0), (hook2, 1), (summ - 0.6, 1), (summ, 0.35), (end - 1, 0.35), (end, 0), (duration + 1, 0)])
    bass.gate([(0, 0.4), (hook2, 1), (end - 1, 1), (end, 0), (duration + 1, 0)])
    pad.gate([(0, 0), (0.6, 1), (end, 0.8), (duration, 0)])
    stab.gate([(0, 0), (hook2, 1), (end - 1, 1), (end, 0), (duration + 1, 0)])
    music = S.lowpass(drums.buf, 9000) + bass.buf + stab.buf + S.lowpass(pad.buf, 2000)

    fx = S.Track(duration)
    fx.add(0.45, impact(), 0.5)
    fx.add(hook2 - 0.05, S.boom(2.2), 0.35)
    for t in events.get("bells", []):
        fx.add(t, ring_bell(), 0.42)
    for t in events.get("hits", []):
        fx.add(t, impact(), 0.42)
    for t in events.get("wins", []):
        fx.add(t, crowd(), 0.32)
        fx.add(t, S.sparkle(1.2), 0.12)
    for t in events.get("cuts", []):
        fx.add(t - 0.35, S.whoosh(0.5), 0.2)
    fx.add(summ - 1.2, S.riser(1.2), 0.25)
    fx.add(summ, impact(), 0.45)
    cta = events.get("cta", duration - 4)
    fx.add(cta, crowd(3.0), 0.3)
    return music * 0.62, fx.buf
