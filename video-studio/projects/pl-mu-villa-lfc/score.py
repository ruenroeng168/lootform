"""Matchday hype bed: driving drums + bass + brass-like stabs. Stadium crowd bed, referee whistle at kick-off,
crowd roar + horn on every goal (bigger on the 96th-minute equaliser), ticking clock for stoppage time."""
import numpy as np
import synth as S


def crowd(dur, bright=1.0):
    t = S.tt(dur)
    n = S.bandpass(S.noise(dur), 250, 2800) * 0.7 + S.bandpass(S.noise(dur), 800, 4500 * bright) * 0.3
    mod = 0.75 + 0.25 * np.sin(2 * np.pi * 2.3 * t) * np.sin(2 * np.pi * 0.6 * t + 1)
    return n * mod


def roar(dur=2.8, big=False):
    t = S.tt(dur)
    env = np.minimum(1, t / 0.18) * np.exp(-np.maximum(0, t - (1.2 if big else 0.6)) * 1.4)
    return crowd(dur, 1.3) * env * (1.4 if big else 1.0)


def whistle(dur=0.7):
    t = S.tt(dur)
    f = 2900 + 120 * np.sin(2 * np.pi * 38 * t)   # pea whistle trill
    x = np.sin(2 * np.pi * np.cumsum(f) / S.SR) + 0.3 * S.bandpass(S.noise(dur), 2500, 4000)
    return x * np.minimum(1, t / 0.02) * np.minimum(1, (dur - t) / 0.05) * 0.5


def horn(f=233, dur=0.9):
    t = S.tt(dur)
    x = sum(np.sign(np.sin(2 * np.pi * f * k * t)) / k for k in (1, 2, 3)) * 0.3
    return S.lowpass(x, 2200) * np.minimum(1, t / 0.03) * np.exp(-np.maximum(0, t - 0.6) * 6)


def tick(dur=0.06):
    t = S.tt(dur)
    return np.sin(2 * np.pi * 2000 * t) * np.exp(-t * 90)


def build(c, duration, spec, events):
    beat = 60 / spec.get("bpm", 128); bar = beat * 4
    roots = [43, 43, 46, 41]  # G G Bb F
    drums, bass, stab = S.Track(duration), S.Track(duration), S.Track(duration)
    for b in range(int(duration / bar) + 2):
        t0 = b * bar; r = roots[b % 4]
        for i in range(4):
            drums.add(t0 + i * beat, S.kick(0.4), 0.5)
            drums.add(t0 + i * beat + beat / 2, S.hat(0.05), 0.14)
            if i in (1, 3):
                drums.add(t0 + i * beat, S.clap(0.22), 0.28)
        for i in range(8):
            bass.add(t0 + i * beat / 2, S.bass(S.midi(r - 12 + (12 if i in (3, 7) else 0)), beat / 2 * 0.85), 0.3)
        stab.add(t0, horn(S.midi(r + 12), beat * 0.9), 0.12)
        stab.add(t0 + beat * 1.5, horn(S.midi(r + 15), beat * 0.5), 0.08)
    end = duration - 0.3
    hook = events.get("hook", 0.7); clock = events.get("clock", duration); mu5 = events.get("mu5", duration)
    for tr in (drums, bass, stab):
        tr.gate([(0, 0), (hook - 0.05, 0), (hook, 1), (clock - 0.2, 1), (clock, 0.15),
                 (clock + 2.6, 0.15), (clock + 2.8, 1), (end - 0.6, 1), (end, 0), (duration + 1, 0)])
    music = drums.buf + bass.buf + stab.buf

    fx = S.Track(duration)
    bed = S.Track(duration); bed.add(0, crowd(duration + 1), 0.05)
    bed.gate([(0, 0.6), (1, 1), (end - 0.5, 1), (end, 0), (duration + 1, 0)])
    fx.add(0, bed.buf, 1.0)
    fx.add(hook - 0.02, S.boom(2.2), 0.45)
    fx.add(0.15, whistle(), 0.25)
    if "lfc" in events:
        fx.add(events["lfc"] - 0.2, whistle(), 0.22)
    for gl in events.get("goals", []):
        t = gl["t"]; big = gl.get("big")
        fx.add(t, roar(3.4 if big else 2.4, big), 0.42 if big else 0.3)
        fx.add(t, horn(311, 0.8), 0.18)
        fx.add(t, S.boom(1.6), 0.3 if big else 0.2)
        if big:
            fx.add(t, S.sparkle(1.6), 0.15)
    for k in range(int(2.6 / 0.5)):
        fx.add(clock + k * 0.5, tick(), 0.3)
    fx.add(clock + 2.0, S.riser(0.6), 0.2)
    for t in events.get("cuts", []):
        fx.add(t - 0.25, S.whoosh(0.4), 0.14)
    fx.add(mu5 - 0.1, S.thump(0.4), 0.3)
    fx.add(events.get("cta", end - 3), S.pop(0.14), 0.25)
    return music * 0.55, fx.buf
