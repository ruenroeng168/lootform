"""Molam / e-luk-thung style bed: khaen-like drone (A + E), phin riff on the A-minor pentatonic, fast ching/chap,
four-on-the-floor kick. Intro is drone + phin only (hook), the beat drops on the first gameplay line, breaks for
the boss reveal. SFX: hits, snake hiss, whooshes, pops on callouts, coins on the shop, riser + chime into the end."""
import numpy as np
import synth as S


def phin(f, dur=0.32):
    t = S.tt(dur)
    x = sum(np.sin(2 * np.pi * f * k * t) / k ** 1.3 for k in range(1, 7)) * np.exp(-t * 9)
    return x * 0.5 + S.pluck(f, dur, 1.2) * 0.5


def khaen(freqs, dur):
    t = S.tt(dur)
    x = sum(S.saw(f, t, 8) * 0.25 + S.saw(f * 1.004, t, 8) * 0.25 for f in freqs)
    x = S.lowpass(x, 1800) * (0.85 + 0.15 * np.sin(2 * np.pi * 5.2 * t))
    a = np.minimum(1, t / 0.08) * np.minimum(1, (dur - t) / 0.12)
    return x * a


def ching(open_=True):
    t = S.tt(0.25 if open_ else 0.06)
    x = sum(np.sin(2 * np.pi * f * t) for f in (2650, 3720, 5180)) * np.exp(-t * (14 if open_ else 60))
    return x * 0.3


def build(duration, D):
    bpm = 136; beat = 60 / bpm; bar = beat * 4
    A = [57, 60, 62, 64, 67, 69, 72, 74, 76]            # A C D E G pentatonic
    riffs = [[5, 4, 3, 4, 5, 6, 5, 4], [3, 4, 5, 3, 2, 1, 2, 3], [5, 6, 7, 6, 5, 4, 3, 4], [3, 2, 1, 0, 1, 2, 3, 3]]
    drone, lead, bass, drums = (S.Track(duration) for _ in range(4))
    for b in range(int(duration / bar) + 2):
        t0 = b * bar
        drone.add(t0, khaen([S.midi(45 + 12), S.midi(52 + 12), S.midi(57 + 12)], bar + 0.05), 0.10)
        r = riffs[b % 4]
        for i, k in enumerate(r):
            lead.add(t0 + i * beat / 2, phin(S.midi(A[k])), 0.16 if i % 2 == 0 else 0.11)
        for i in range(4):
            tb = t0 + i * beat
            drums.add(tb, S.kick(0.28), 0.5)
            drums.add(tb + beat / 2, ching(True), 0.5); drums.add(tb, ching(False), 0.35)
            drums.add(tb + beat / 4, S.hat(0.03), 0.08); drums.add(tb + 3 * beat / 4, S.hat(0.03), 0.08)
            if i % 2: drums.add(tb, S.clap(0.18), 0.22)
            bass.add(tb, S.bass(S.midi(33 if i % 2 == 0 else 40), beat * 0.45), 0.3)
    st = D["starts"]; end = D["end"]; drop = st["combat"] - 0.1
    for tr in (drums, bass):
        tr.gate([(0, 0), (drop - 0.05, 0), (drop, 1), (7.0, 1), (7.1, 0), (7.6, 0), (7.7, 1),
                 (end - 0.1, 1), (end, 0.35), (duration - 1.0, 0.35), (duration, 0), (duration + 1, 0)])
    for tr in (drone, lead):
        tr.gate([(0, 0), (0.1, 0.9), (7.0, 1), (7.1, 0.3), (7.6, 0.3), (7.7, 1), (duration - 1.0, 1), (duration, 0), (duration + 1, 0)])
    music = (drone.buf + lead.buf + bass.buf + drums.buf) * 0.5

    fx = S.Track(duration)
    fx.add(0.05, S.boom(1.6), 0.25)
    fx.add(drop - 0.35, S.riser(0.35), 0.15)
    for t in D["hits"]:
        fx.add(t, S.thump(0.3), 0.45); fx.add(t, S.bandpass(S.noise(0.12), 800, 5000) * np.exp(-S.tt(0.12) * 30), 0.35)
    fx.add(7.15, S.boom(2.0), 0.35)
    hiss = S.bandpass(S.noise(0.9), 3000, 9000) * np.exp(-S.tt(0.9) * 2.5); fx.add(7.8, hiss, 0.18)
    for name, t in D["sections"].items():
        if t > 0.5: fx.add(t - 0.12, S.whoosh(0.45), 0.25)
    for t in D["pops"]: fx.add(t, S.pop(0.14), 0.35)
    coin = S.bell(S.midi(91), 0.5) * 0.7 + np.pad(S.bell(S.midi(96), 0.42), (int(0.08 * S.SR), 0))[: int(0.5 * S.SR)] * 0.7
    fx.add(D["notax"][0] + 0.05, coin, 0.3); fx.add(st["town"] + 0.4, coin, 0.22)
    fx.add(end - 0.6, S.riser(0.6), 0.2)
    for i, n in enumerate((76, 81, 84, 88)): fx.add(end + i * 0.08, S.bell(S.midi(n), 0.9), 0.18)
    for i, n in enumerate((79, 84, 88)): fx.add(st["try"] + 1.2 + i * 0.09, S.bell(S.midi(n), 0.9), 0.16)
    return music, fx.buf
