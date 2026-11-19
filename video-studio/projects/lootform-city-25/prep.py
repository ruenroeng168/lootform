#!/usr/bin/env python3
"""LOOTFORM CITY 25-second intro: Gemini key art (hero / cobra / market, labelled ภาพประกอบ) cut with the real
gameplay promo (assets/src.mp4 -> lootform-city-promo), Puck voice (out/vo/*.wav split by spans.json).
Writes out/base.mp4, out/footage.wav, out/mix.wav, out/timeline.json, then
    node engine/render.mjs projects/lootform-city-25 --overlay --footage-vol=1
"""
import json, subprocess, sys, importlib.util
from pathlib import Path
import numpy as np, cv2
from scipy.io import wavfile

HERE = Path(__file__).resolve().parent; OUT = HERE / "out"; A = HERE / "assets"
sys.path.insert(0, str(HERE.parent.parent / "engine"))
import synth as S  # noqa: E402

W, H, FPS = 1080, 1920, 30
VO_AF = "highpass=f=80,equalizer=f=3500:t=q:w=1:g=1.5,acompressor=threshold=-20dB:ratio=3:attack=5:release=120:makeup=2,loudnorm=I=-15:TP=-1.5:LRA=6"
OFF = 0.25  # voice offset


def sm(u): u = min(1.0, max(0.0, u)); return u * u * (3 - 2 * u)


def cover(img):
    h, w = img.shape[:2]; s = max(W / w, H / h) * 1.0
    r = cv2.resize(img, (int(w * s + 1), int(h * s + 1)), interpolation=cv2.INTER_CUBIC)
    y0 = (r.shape[0] - H) // 2; x0 = (r.shape[1] - W) // 2
    return r[y0:y0 + H, x0:x0 + W].copy()


def zoom(img, z, cx=540, cy=960, sx=0.0, sy=0.0):
    vw, vh = W / z, H / z; x0 = min(max(cx - vw / 2, 0), W - vw); y0 = min(max(cy - vh / 2, 0), H - vh)
    M = np.float32([[z, 0, -x0 * z + sx], [0, z, -y0 * z + sy]])
    return cv2.warpAffine(img, M, (W, H), flags=cv2.INTER_LINEAR, borderMode=cv2.BORDER_REFLECT)


def src_frames(ss, dur):
    raw = subprocess.run(["ffmpeg", "-v", "error", "-ss", str(ss), "-t", str(dur + 0.2), "-i", str(A / "src.mp4"), "-vf", f"fps={FPS},scale={W}:{H}",
                          "-f", "rawvideo", "-pix_fmt", "bgr24", "-"], capture_output=True, check=True).stdout
    return np.frombuffer(raw, np.uint8).reshape(-1, H, W, 3)


def main():
    L = json.loads((HERE / "lines.json").read_text()); keys = [l[0] for l in L]
    wav = next((OUT / "vo").glob("*.wav")); spans = json.loads((OUT / "vo" / "spans.json").read_text())
    take = np.frombuffer(subprocess.run(["ffmpeg", "-v", "error", "-i", str(wav), "-af", VO_AF, "-ac", "1", "-ar", str(S.SR), "-f", "f32le", "-"],
                                        capture_output=True, check=True).stdout, np.float32).astype(np.float64)
    st = {k: round(a + OFF, 3) for k, (a, b) in zip(keys, spans)}; en = {k: round(b + OFF, 3) for k, (a, b) in zip(keys, spans)}
    total = round(en["end"] + 1.6, 2); n = int(round(total * FPS))
    voice = S.Track(total + 1); voice.add(OFF, take[:int((total - OFF) * S.SR)])
    # picture plan: (t0, t1, kind, arg)
    cut = lambda k: st[k] - 0.3
    PLAN = [(0, cut("combat"), "img", "hero"),
            (cut("combat"), cut("boss"), "src", 1.0),
            (cut("boss"), cut("boss") + 1.9, "img", "cobra"),
            (cut("boss") + 1.9, cut("shop"), "src", 10.0),
            (cut("shop"), cut("market"), "src", 25.0),
            (cut("market"), cut("end"), "img", "market"),
            (cut("end"), total, "src", 47.6)]
    pics = {k: cover(cv2.imread(str(A / f"{k}.jpg"))) for k in ("hero", "cobra", "market")}
    enc = subprocess.Popen(["ffmpeg", "-v", "error", "-y", "-f", "rawvideo", "-pix_fmt", "bgr24", "-s", f"{W}x{H}", "-r", str(FPS), "-i", "-",
                            "-c:v", "libx264", "-preset", "medium", "-crf", "16", "-pix_fmt", "yuv420p", str(OUT / "base.mp4")], stdin=subprocess.PIPE)
    nf = 0; hits = []
    for t0, t1, kind, arg in PLAN:
        a, b = int(round(t0 * FPS)), int(round(t1 * FPS)) if t1 < total else n
        fr = src_frames(arg, (b - a) / FPS) if kind == "src" else None
        for j in range(a, b):
            u = (j - a) / max(1, b - a - 1); dt = (j - a) / FPS
            if kind == "src":
                img = fr[min(j - a, len(fr) - 1)]
                p = 1 - sm(dt / 0.25); img = zoom(img, 1 + 0.08 * p) if p > 0.01 else img     # punch-in at each cut
            elif arg == "hero": img = zoom(pics["hero"], 1.18 - 0.12 * sm(u), 540, 900)
            elif arg == "cobra":
                k = max(0, 1 - dt / 0.5) ** 2 * 18; img = zoom(pics["cobra"], 1.0 + 0.22 * sm(u), 540, 620, k * np.sin(dt * 90), k * np.cos(dt * 70))
            else: img = zoom(pics["market"], 1.12, 540 - 60 + 120 * sm(u), 1000 - 100 * sm(u))
            enc.stdin.write(np.ascontiguousarray(img).tobytes()); nf += 1
    enc.stdin.close(); enc.wait()
    D = {"images": {"logo": "assets/logo.png"}, "starts": st, "ends": en, "total": total,
         "ai": [[p[0], p[1]] for p in PLAN if p[2] == "img"], "cuts": [p[0] for p in PLAN[1:]],
         "lines": {l[0]: l[2] for l in L}}
    vo = voice.buf[:int(total * S.SR)]
    wavfile.write(OUT / "footage.wav", S.SR, (np.clip(np.stack([vo, vo], 1), -1, 1) * 32767).astype(np.int16))
    sp = importlib.util.spec_from_file_location("score", HERE / "score.py"); sc = importlib.util.module_from_spec(sp); sp.loader.exec_module(sc)
    music, fx = sc.build(total, D)
    duck = np.clip(S.follower(vo, 0.02, 0.3) / 0.08, 0, 1)
    mix = music[:len(vo)] * (1 - 0.62 * duck) + fx[:len(vo)]
    wavfile.write(OUT / "mix.wav", S.SR, (np.clip(np.stack([mix, mix], 1), -1, 1) * 32767).astype(np.int16))
    (OUT / "timeline.json").write_text(json.dumps({"width": W, "height": H, "fps": FPS, "frames": nf, "duration": total, "cues": {}, "data": D}, ensure_ascii=False))
    print(f"[prep] {total:.2f}s {nf} frames; starts {st}")


if __name__ == "__main__":
    main()
