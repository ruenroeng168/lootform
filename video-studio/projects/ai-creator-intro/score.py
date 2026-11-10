"""Modern creator bed: soft lo-fi keys + sub + light hats (stays under the voice), a tension drop on the hook,
role 'ticks', a glitch on "แต่ตอนนี้", whooshes into b-roll, a record-scratch on "งานพัง", ding/buzz on
เวิร์ก/ไม่เวิร์ก, and a bright riser + chime into the follow end card."""
import numpy as np
import synth as S


def build(duration, ev, brolls):
    bpm = 96; beat = 60 / bpm; bar = beat * 4
    prog = [(45, [57, 60, 64, 67]), (41, [53, 57, 60, 64]), (48, [55, 60, 64, 67]), (43, [55, 59, 62, 66])]
    keys, low, drums = S.Track(duration), S.Track(duration), S.Track(duration)
    for b in range(int(duration / bar) + 2):
        t0 = b * bar; r, ch = prog[b % 4]
        for i, n in enumerate([ch[0], ch[2], ch[3], ch[1]]):
            keys.add(t0 + i * beat, S.pluck(S.midi(n + 12), 0.5, 0.6), 0.11)
        keys.add(t0, S.pad([S.midi(n) for n in ch[:3]], bar, 0.8, 0.8), 0.12)
        low.add(t0, S.bass(S.midi(r - 12), beat * 3.5), 0.22)
        for i in range(4):
            drums.add(t0 + i * beat, S.kick(0.3), 0.28 if i % 2 == 0 else 0.0)
            drums.add(t0 + i * beat + beat / 2, S.hat(0.04), 0.07)
            if i % 2:
                drums.add(t0 + i * beat, S.clap(0.18), 0.1)
    end = duration - 0.3
    now = ev["now"]
    g = [(0, 0), (0.2, 0.7), (ev["diligent"] - 0.1, 0.7), (now - 0.2, 0.9), (now, 0.0), (ev["works"], 1.0),
         (end - 0.8, 1.0), (end, 0), (duration + 1, 0)]
    for tr in (keys, low, drums):
        tr.gate(g)
    music = S.lowpass(keys.buf, 4000) + low.buf + drums.buf

    fx = S.Track(duration)
    fx.add(ev["hook"] + 0.05, S.boom(1.8), 0.3)
    fx.add(ev["notAI"], S.thump(0.35), 0.4)
    fx.add(ev["diligent"], S.whoosh(0.35), 0.25); fx.add(ev["diligent"] + 0.05, S.thump(0.35), 0.45)
    for k in ("role1", "role2", "role3"):
        fx.add(ev[k], S.pop(0.14), 0.35)
    fx.add(now, S.glitch(0.35), 0.35)
    for t in brolls.get("works", [])[:-1]:
        fx.add(t - 0.12, S.whoosh(0.4), 0.2)
    fx.add(ev["fail"], S.bandpass(S.noise(0.45), 500, 4000) * np.abs(np.sin(2 * np.pi * 7 * S.tt(0.45))) * np.exp(-S.tt(0.45) * 3), 0.5)
    fx.add(ev["fail"] + 0.05, S.thump(0.4), 0.4)
    fx.add(ev["real"], S.sparkle(1.0), 0.12)
    fx.add(ev["work_ok"], S.bell(S.midi(84), 0.8), 0.18)
    t = S.tt(0.35); fx.add(ev["work_no"], np.sign(np.sin(2 * np.pi * 110 * t)) * np.exp(-t * 6) * 0.25, 0.4)
    fx.add(ev["follow"] - 0.6, S.riser(0.6), 0.2)
    fx.add(ev["follow"], S.pop(0.14), 0.35)
    for i, n in enumerate((79, 84, 88)):
        fx.add(ev["end"] + i * 0.09, S.bell(S.midi(n), 0.9), 0.2)
    return music * 0.45, fx.buf
