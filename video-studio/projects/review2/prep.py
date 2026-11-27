#!/usr/bin/env python3
"""พระยาอีสาน tool clip: IR thermometer (wall 34.1°C, °C/°F switch, panel ~36.5°C, hot-spot tip) + drill brush set,
real hand-held footage (4K portrait, no sound), Puck voice per edl.json, segment length = voice + breath,
light groove music, ending on an อุบลเด้อ card. Writes out/base.mp4, footage.wav, mix.wav, timeline.json, then
    node engine/render.mjs projects/review2 --overlay --footage-vol=1
"""
import json, subprocess, sys
from pathlib import Path
import numpy as np, cv2
from scipy.io import wavfile

HERE = Path(__file__).resolve().parent; OUT = HERE / "out"; RAW = HERE / "assets" / "raw"
sys.path.insert(0, str(HERE.parent.parent / "engine"))
import synth as S  # noqa: E402
sys.path.insert(0, str(HERE.parent / "padel-review"))
W, H, FPS = 1080, 1920, 30
VF = f"scale={W}:-2:flags=lanczos,crop={W}:{H}:0:(ih-{H})/2,eq=contrast=1.04:saturation=1.1,unsharp=5:5:0.4"


def sm(u): u = min(1.0, max(0.0, u)); return u * u * (3 - 2 * u)


def frames(src, ss, n):
    pr = subprocess.Popen(["ffmpeg", "-v", "error", "-ss", f"{ss:.3f}", "-i", str(src), "-frames:v", str(n), "-vf", f"fps={FPS},{VF}",
                           "-f", "rawvideo", "-pix_fmt", "bgr24", "-"], stdout=subprocess.PIPE)
    last = None
    for _ in range(n):
        buf = pr.stdout.read(W * H * 3)
        if len(buf) == W * H * 3: last = np.frombuffer(buf, np.uint8).reshape(H, W, 3)
        yield last
    pr.stdout.close(); pr.wait()


def zoom(img, z, cy=960):
    if abs(z - 1) < 1e-3: return img
    vw, vh = W / z, H / z; x0 = (W - vw) / 2; y0 = min(max(cy - vh / 2, 0), H - vh)
    return cv2.warpAffine(img, np.float32([[z, 0, -x0 * z], [0, z, -y0 * z]]), (W, H), flags=cv2.INTER_LINEAR)


def score(dur, D):
    bpm = 108; beat = 60 / bpm; bar = beat * 4
    prog = [(45, [64, 67, 71, 74]), (50, [62, 66, 69, 72]), (43, [62, 67, 71, 74]), (48, [60, 64, 67, 71])]
    keys, bass, drums = (S.Track(dur + 2) for _ in range(3))
    for b in range(int(dur / bar) + 2):
        t0 = b * bar; root, ch = prog[b % 4]
        for i in range(8): keys.add(t0 + i * beat / 2, S.pluck(S.midi(ch[[0, 2, 1, 3, 2, 1, 3, 2][i]]), 0.4, 0.6), 0.13)
        bass.add(t0, S.bass(S.midi(root - 12), beat * 1.5), 0.32); bass.add(t0 + beat * 2.5, S.bass(S.midi(root - 12), beat), 0.25)
        for i in range(4):
            tb = t0 + i * beat
            if i in (0, 2): drums.add(tb, S.kick(0.25), 0.34)
            else: drums.add(tb, S.clap(0.15), 0.15)
            for j in range(2): drums.add(tb + j * beat / 2, S.hat(0.03), 0.07)
    u0 = D["ubon"][0]
    for tr in (keys, bass, drums): tr.gate([(0, 0), (0.05, 1), (u0 - 0.2, 1), (u0, 0.35), (dur - 1.0, 0.35), (dur, 0), (dur + 2, 0)])
    fx = S.Track(dur + 2)
    for s in D["segs"][1:]: fx.add(s[0] - 0.1, S.whoosh(0.35), 0.15)
    for c in D["chips"]: fx.add(c[0], S.pop(), 0.3); fx.add(c[0], S.bell(S.midi(88), 0.6), 0.1)
    fx.add(u0, S.bell(S.midi(84), 1.0), 0.18); fx.add(u0 + 0.12, S.bell(S.midi(88), 1.0), 0.15)
    n = int(dur * S.SR)
    return (keys.buf[:n] + bass.buf[:n] + drums.buf[:n]) * 0.6, fx.buf[:n]


def main():
    E = json.loads((HERE / "edl.json").read_text()); spans = json.loads((OUT / "vo" / "spans.json").read_text())
    wav = next((OUT / "vo").glob("*.wav"))
    va = np.frombuffer(subprocess.run(["ffmpeg", "-v", "error", "-i", str(wav), "-af", "highpass=f=70,acompressor=threshold=-20dB:ratio=3:makeup=2,loudnorm=I=-15:TP=-1.5",
                                       "-ac", "1", "-ar", str(S.SR), "-f", "f32le", "-"], capture_output=True, check=True).stdout, np.float32).astype(np.float64)
    enc = subprocess.Popen(["ffmpeg", "-v", "error", "-y", "-f", "rawvideo", "-pix_fmt", "bgr24", "-s", f"{W}x{H}", "-r", str(FPS), "-i", "-",
                            "-c:v", "libx264", "-preset", "medium", "-crf", "18", "-pix_fmt", "yuv420p", str(OUT / "base.mp4")], stdin=subprocess.PIPE)
    voice = S.Track(120); nf = 0; caps = []; chips = []; segs = []; D = {}
    for k, (it, (a, b)) in enumerate(zip(E, spans)):
        c = va[int(max(0, a - 0.03) * S.SR):int((b + 0.15) * S.SR)]; m = np.arange(len(c)); c = c * np.minimum(1, np.minimum(m / 300, (len(c) - m) / 1200))
        vd = len(c) / S.SR; t0 = nf / FPS; lead = 0.15
        if it["src"] is None:   # อุบลเด้อ card over a blurred panel frame
            d = vd + 2.2; n = int(round(d * FPS))
            bg = next(frames(RAW / "r3.mp4", 8.0, 1)); bg = (cv2.GaussianBlur(bg, (0, 0), 25) * 0.5).astype(np.uint8)
            for j in range(n): enc.stdin.write(zoom(bg, 1.03 + 0.04 * j / n).tobytes())
            voice.add(t0 + 0.6, c); D["ubon"] = [round(t0, 3), round(t0 + d, 3)]; D["uvo"] = [round(t0 + 0.6, 3), round(t0 + 0.6 + vd, 3)]
            nf += n; segs.append([round(t0, 3), round(nf / FPS, 3), "ubon"]); continue
        d = max(2.4, min(it["max"], vd + 0.55)) if vd + 0.55 <= it["max"] else vd + 0.4
        n = int(round(d * FPS)); voice.add(t0 + lead, c)
        speed = min(1.0, it["max"] / d)
        fr = frames(RAW / f"{it['src']}.mp4", it["in"], int(n * speed) + 2); buf = [next(fr) for _ in range(int(n * speed) + 2)]
        for j in range(n):
            f = buf[min(len(buf) - 1, int(j * speed))]; p = 1 - sm(j / 6)
            enc.stdin.write(zoom(f, 1.0 + 0.05 * p + 0.04 * j / n).tobytes())
        nf += n; segs.append([round(t0, 3), round(nf / FPS, 3), it["key"]])
        caps.append([round(t0 + lead, 3), round(t0 + lead + vd, 3), it["cap"], bool(it.get("title"))])
        if it.get("chip"): chips.append([round(t0 + it["chip"][0], 3), round(nf / FPS, 3), it["chip"][1]])
    enc.stdin.close(); enc.wait(); total = nf / FPS
    D.update({"caps": caps, "chips": chips, "segs": segs, "images": {"ubonder": "assets/ubonder.png"}})
    v = voice.buf[:int(total * S.SR)]
    music, fx = score(total, D)
    duck = np.clip(S.follower(v, 0.02, 0.35) / 0.06, 0, 1)
    mix = music[:len(v)] * (1 - 0.7 * duck) + fx[:len(v)]
    wavfile.write(OUT / "footage.wav", S.SR, (np.clip(np.stack([v, v], 1), -1, 1) * 32767).astype(np.int16))
    wavfile.write(OUT / "mix.wav", S.SR, (np.clip(np.stack([mix, mix], 1), -1, 1) * 32767).astype(np.int16))
    (OUT / "timeline.json").write_text(json.dumps({"width": W, "height": H, "fps": FPS, "frames": nf, "duration": round(total, 3), "cues": {}, "data": D}, ensure_ascii=False))
    print(f"[prep] {total:.2f}s; segs {segs}")


if __name__ == "__main__":
    main()
