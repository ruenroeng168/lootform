"""Molam bed reused from lootform-city-promo (khaen drone + phin riff + ching), short-form arrangement:
drone/phin only on the hook, beat drops on gameplay, break + boom on the cobra, riser + chimes into the end card."""
import importlib.util
from pathlib import Path
import numpy as np
import synth as S

_sp = importlib.util.spec_from_file_location("old_score", Path(__file__).resolve().parent.parent / "lootform-city-promo" / "score.py")
O = importlib.util.module_from_spec(_sp); _sp.loader.exec_module(O)


def build(duration, D):
    bpm = 136; beat = 60 / bpm; bar = beat * 4
    A = [57, 60, 62, 64, 67, 69, 72, 74, 76]
    riffs = [[5, 4, 3, 4, 5, 6, 5, 4], [3, 4, 5, 3, 2, 1, 2, 3], [5, 6, 7, 6, 5, 4, 3, 4], [3, 2, 1, 0, 1, 2, 3, 3]]
    drone, lead, bass, drums = (S.Track(duration) for _ in range(4))
    for b in range(int(duration / bar) + 2):
        t0 = b * bar
        drone.add(t0, O.khaen([S.midi(57), S.midi(64), S.midi(69)], bar + 0.05), 0.10)
        for i, k in enumerate(riffs[b % 4]): lead.add(t0 + i * beat / 2, O.phin(S.midi(A[k])), 0.16 if i % 2 == 0 else 0.11)
        for i in range(4):
            tb = t0 + i * beat
            drums.add(tb, S.kick(0.28), 0.5); drums.add(tb + beat / 2, O.ching(True), 0.5); drums.add(tb, O.ching(False), 0.35)
            drums.add(tb + beat / 4, S.hat(0.03), 0.08); drums.add(tb + 3 * beat / 4, S.hat(0.03), 0.08)
            if i % 2: drums.add(tb, S.clap(0.18), 0.22)
            bass.add(tb, S.bass(S.midi(33 if i % 2 == 0 else 40), beat * 0.45), 0.3)
    c = D["cuts"]; drop, cob, cob2, endc = c[0], c[1], c[2], c[-1]
    for tr in (drums, bass):
        tr.gate([(0, 0), (drop - 0.05, 0), (drop, 1), (cob - 0.05, 1), (cob, 0), (cob2 - 0.05, 0), (cob2, 1),
                 (endc - 0.1, 1), (endc, 0.4), (duration - 1.0, 0.4), (duration, 0), (duration + 1, 0)])
    for tr in (drone, lead):
        tr.gate([(0, 0), (0.1, 0.9), (cob - 0.05, 1), (cob, 0.3), (cob2, 1), (duration - 1.0, 1), (duration, 0), (duration + 1, 0)])
    music = (drone.buf + lead.buf + bass.buf + drums.buf) * 0.5
    fx = S.Track(duration)
    fx.add(0.05, S.boom(1.6), 0.22); fx.add(drop - 0.35, S.riser(0.35), 0.15)
    for t in c: fx.add(t - 0.12, S.whoosh(0.45), 0.25)
    fx.add(cob, S.boom(2.0), 0.4); fx.add(cob, S.thump(0.3), 0.5)
    fx.add(cob + 0.1, S.bandpass(S.noise(0.9), 3000, 9000) * np.exp(-S.tt(0.9) * 2.5), 0.2)
    coin = S.bell(S.midi(91), 0.5) * 0.7 + np.pad(S.bell(S.midi(96), 0.42), (int(0.08 * S.SR), 0))[: int(0.5 * S.SR)] * 0.7
    fx.add(c[3] + 0.6, coin, 0.28); fx.add(c[4] + 0.5, coin, 0.22)
    fx.add(endc - 0.6, S.riser(0.6), 0.2)
    for i, nn in enumerate((76, 81, 84, 88)): fx.add(endc + i * 0.08, S.bell(S.midi(nn), 0.9), 0.18)
    return music, fx.buf
