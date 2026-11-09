"""Comedy mock-documentary score: tiptoe pizzicato bed (bouncy bass + plucks), crime-doc stings,
camera flash/shutter, stamp thumps, sad trombone 'wah-wah-wah-waaah', fly buzz, cricket chirps,
tumbleweed wind, heartbeat + epic swell for the 'mystery bag', record-scratch cut to the cliffhanger."""
import numpy as np
import synth as S


def trombone(dur=2.6):   # sad trombone: 3 short falling notes + long wobbly one
    out = np.zeros(int(dur * S.SR))
    notes = [(0.0, 0.42, 311), (0.45, 0.42, 294), (0.9, 0.42, 277), (1.35, 1.2, 262)]
    for t0, d, f in notes:
        t = S.tt(d)
        ff = f * (1 + (0.03 * np.sin(2 * np.pi * 6 * t) if d > 1 else 0)) * (1 - (0.06 * t / d if d > 1 else 0))
        ph = 2 * np.pi * np.cumsum(ff) / S.SR
        x = sum(np.sin(ph * k) / k for k in range(1, 8)) * np.minimum(1, t / 0.04) * np.minimum(1, (d - t) / 0.08)
        i = int(t0 * S.SR); out[i:i + len(x)] += S.lowpass(x, 1800) * 0.35
    return out


def buzz(dur=1.6):
    t = S.tt(dur)
    f = 220 + 40 * np.sin(2 * np.pi * 3 * t) + 25 * np.sin(2 * np.pi * 7.3 * t)
    x = np.sign(np.sin(2 * np.pi * np.cumsum(f) / S.SR)) * 0.2
    return S.bandpass(x, 200, 2500) * (0.5 + 0.5 * np.sin(2 * np.pi * 1.5 * t) ** 2)


def cricket(dur=1.6):
    t = S.tt(dur)
    gate = (np.sin(2 * np.pi * 30 * t) > 0) * (np.sin(2 * np.pi * 2.5 * t) > 0.2)
    return np.sin(2 * np.pi * 4300 * t) * gate * 0.25


def heartbeat(n=4, gap=0.7):
    out = S.Track(n * gap + 1)
    for i in range(n):
        out.add(i * gap, S.kick(0.3), 0.9); out.add(i * gap + 0.18, S.kick(0.25), 0.6)
    return S.lowpass(out.buf, 200)


def shutter():
    x = S.highpass(S.noise(0.08), 2000) * np.exp(-S.tt(0.08) * 60)
    c = S.click(0.03); x[:len(c)] += c
    return x


def scratch(dur=0.45):
    t = S.tt(dur)
    return S.bandpass(S.noise(dur), 500, 4000) * np.abs(np.sin(2 * np.pi * 7 * t)) * np.exp(-t * 3)


def build(c, duration, spec, events):
    beat = 60 / spec.get("bpm", 100); bar = beat * 4
    roots = [48, 53, 55, 48]
    bass, pl, perc = S.Track(duration), S.Track(duration), S.Track(duration)
    for b in range(int(duration / bar) + 2):
        t0 = b * bar; r = roots[b % 4]
        for i, step in enumerate([0, 7, 12, 7]):          # tiptoe walking bass
            bass.add(t0 + i * beat, S.pluck(S.midi(r - 12 + step), 0.25, 0.5), 0.35)
        for i, n in enumerate([12, 16, 19, 16, 24, 19, 16, 19]):
            if i % 2 == 0 or b % 2:
                pl.add(t0 + i * beat / 2, S.pluck(S.midi(r + n), 0.18, 1.2), 0.12)
        perc.add(t0 + beat, S.click(0.03), 0.2); perc.add(t0 + 3 * beat, S.click(0.03), 0.2)
    e = events; end = duration - 0.3
    today, cta = e["today"], e["cta"]
    gate = [(0, 0), (0.3, 1), (today - 0.3, 1), (today, 0), (cta - 0.2, 0), (cta, 1), (end - 0.5, 1), (end, 0), (duration + 1, 0)]
    for tr in (bass, pl, perc):
        tr.gate(gate)
    music = bass.buf + pl.buf + perc.buf

    fx = S.Track(duration)
    fx.add(0.55, S.boom(1.8), 0.35); fx.add(0.6, S.pop(0.14), 0.3)
    fx.add(e["noshot"], S.thump(0.35), 0.4)                        # X on "ยิงเก่ง"
    fx.add(e["promise"], S.sparkle(1.4), 0.2)
    fx.add(e["file"] - 0.05, shutter(), 0.5); fx.add(e["file"], S.boom(1.4), 0.25)   # mugshot flash
    fx.add(e["stamp0"], S.thump(0.35), 0.5)
    fx.add(e["quote"], S.pop(0.14), 0.3)
    for t in (e["case1"], e["case2"]):
        fx.add(t - 0.3, S.whoosh(0.5), 0.2)
    k = e["clock"]
    for i in range(16):
        fx.add(k + i * 0.08, S.click(0.03), 0.18)
    fx.add(e["empty"], buzz(), 0.3)
    fx.add(e["stamp1"], S.thump(0.4), 0.55); fx.add(e["stamp1"] + 0.25, trombone(), 0.55)
    for t in e["checks"]:
        fx.add(t, S.pop(0.14), 0.35)
    fx.add(e["norice"], S.thump(0.4), 0.5)
    fx.add(e["norice"] + 0.1, cricket(1.8), 0.4)
    fx.add(e["norice"] + 0.1, S.bandpass(S.noise(2.0), 300, 1500) * np.exp(-S.tt(2.0) * 1.0), 0.18)   # tumbleweed wind
    fx.add(e["stamp2"] + 0.2, trombone(), 0.5)
    # mystery bag: epic swell + heartbeat
    swell = S.Track(duration)
    for i in range(3):
        swell.add(today + i * 2.0, S.pad([S.midi(45 + i), S.midi(52 + i), S.midi(57 + i)], 2.2, 0.8, 0.6), 0.25)
    fx.add(0, swell.buf, 1.0)
    fx.add(e["breath"], heartbeat(5, 0.62), 0.6)
    fx.add(e["bag"], S.riser(1.6), 0.3)
    fx.add(cta - 0.35, scratch(), 0.5)
    fx.add(cta, S.pop(0.14), 0.3)
    return music * 0.55, fx.buf
