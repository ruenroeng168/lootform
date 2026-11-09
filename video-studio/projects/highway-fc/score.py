"""Match-night promo bed: driving drums/bass/synth stabs; thunder + boom on the logo, whooshes on cuts,
music ducks right down for the interview, spinning goal-counter ticks + boing on the punchline, riser into the outro."""
import numpy as np
import synth as S


def thunder(dur=3.0):
    t = S.tt(dur)
    crack = S.highpass(S.noise(dur), 1500) * np.exp(-t * 18) * 0.8
    rumble = S.lowpass(S.noise(dur), 160) * np.minimum(1, t / 0.08) * np.exp(-t * 1.3) * 3.0
    return crack + rumble


def boing(dur=0.7):   # cartoon spring
    t = S.tt(dur)
    f = 180 + 160 * np.sin(2 * np.pi * 9 * t) * np.exp(-t * 4)
    return np.sin(2 * np.pi * np.cumsum(f) / S.SR) * np.exp(-t * 4) * 0.6


def build(c, duration, spec, events):
    beat = 60 / spec.get("bpm", 120); bar = beat * 4
    roots = [45, 45, 41, 43]  # A A F G
    drums, bass, stab, pad = (S.Track(duration) for _ in range(4))
    for b in range(int(duration / bar) + 2):
        t0 = b * bar; r = roots[b % 4]
        pad.add(t0, S.pad([S.midi(r + 12), S.midi(r + 19), S.midi(r + 24)], bar, 0.5, 0.7), 0.16)
        for i in range(4):
            drums.add(t0 + i * beat, S.kick(0.4), 0.5)
            drums.add(t0 + i * beat + beat / 2, S.hat(0.05), 0.13)
            if i in (1, 3):
                drums.add(t0 + i * beat, S.clap(0.22), 0.26)
        for i in range(8):
            bass.add(t0 + i * beat / 2, S.bass(S.midi(r - 12 + (12 if i % 4 == 3 else 0)), beat / 2 * 0.85), 0.3)
        stab.add(t0, S.pluck(S.midi(r + 24), 0.35, 1.3), 0.13)
        stab.add(t0 + beat * 1.5, S.pluck(S.midi(r + 28), 0.3, 1.3), 0.09)
    c1, c2, c2e, gag = events["clip1"], events["clip2"], events["clip2_end"], events["gag"]
    end = duration - 0.3
    g = [(0, 0), (0.5, 0.6), (c1 - 0.1, 0.6), (c1, 1), (c2 - 0.4, 1), (c2, 0.12), (c2e - 0.3, 0.12), (c2e + 0.2, 0.75), (end - 0.6, 1), (end, 0), (duration + 1, 0)]
    for tr in (drums, bass, stab):
        tr.gate(g)
    pad.gate([(0, 0), (0.6, 1), (end, 0.8), (duration, 0)])
    music = drums.buf + bass.buf + stab.buf + S.lowpass(pad.buf, 2200)

    fx = S.Track(duration)
    fx.add(0.35, thunder(), 0.5)
    fx.add(0.55, S.boom(2.6), 0.45)
    fx.add(0.6, S.sparkle(1.6), 0.15)
    for t in (c1, c2, c2e):
        fx.add(t - 0.35, S.whoosh(0.5), 0.22)
    fx.add(c1, S.boom(1.8), 0.25)
    t = gag - 1.15                      # counter spinning while the question is asked
    while t < gag - 0.05:
        fx.add(t, S.click(0.03), 0.25); t += 0.05
    fx.add(gag, boing(), 0.4)           # lands on "?"
    fx.add(gag, S.pop(0.14), 0.3)
    fx.add(c2e - 0.35, S.whoosh(0.5), 0.2)          # into the results board
    for t in events.get("sets", []):
        fx.add(t, S.thump(0.3), 0.3); fx.add(t, S.click(0.03), 0.3)
    if "summary" in events:
        fx.add(events["summary"], S.boom(1.6), 0.3); fx.add(events["summary"], S.sparkle(1.3), 0.14)
    o = events.get("outro", c2e)
    fx.add(o - 1.0, S.riser(1.0), 0.22)
    fx.add(o + 0.05, thunder(2.4), 0.35)
    fx.add(o + 0.1, S.sparkle(1.4), 0.14)
    return music * 0.55, fx.buf
