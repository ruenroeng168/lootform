#!/usr/bin/env python3
"""Prepare the selfie footage for the overlay render:
  1. face track (Haar, equalised) per frame -> outlier rejection, gap fill, smoothing
  2. grade + denoise + scale to 1080x1920, per-frame punch-in zoom -> out/base.mp4
  3. voice loudness-normalised -> out/footage.wav
  4. out/timeline.json (cues, captions, track in output coordinates, zoom) for scene.js
  5. out/mix.wav (music + sfx from score.py)

    python3 video-studio/projects/claude-edit-demo/prep.py
"""
import json
import subprocess
import sys
from pathlib import Path

import cv2
import numpy as np

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE.parent.parent / "engine"))
import synth as S  # noqa: E402

SRC = HERE / "assets" / "selfie.mp4"
OUT = HERE / "out"
W, H, FPS, DUR = 1080, 1920, 30, 16.6
N = int(DUR * FPS)
SW, SH = 360, 640  # tracking resolution

# --- timeline (seconds), from per-chunk transcription of the speech --------------
CUES = {
    "hello": 0.3, "today": 1.3, "order": 3.3,
    "type1": 4.7, "send1": 8.7, "fan": 9.6,
    "type2": 11.2, "laptop": 12.55,
    "type3": 12.6, "can": 14.45,
    "end": 14.9,
}
CAPTIONS = [
    (0.3, 1.25, "สวัสดีครับเพื่อน ๆ"),
    (1.25, 3.25, "วันนี้ผมจะมาตัดคลิปด้วย AI นะครับ"),
    (3.3, 4.4, "ผมจะสั่งมันว่า…"),
    (4.7, 8.75, "ช่วยเอาพัดลมขึ้นมาไว้บนหัวผมหน่อยนะครับ"),
    (9.1, 11.05, "คอยดูนะครับ มันจะทำให้ผมได้ไหม"),
    (11.2, 12.5, "แล้วก็เปลี่ยนเป็นโน้ตบุ๊ก"),
    (12.6, 14.45, "แล้วก็เปลี่ยนเป็นกระป๋อง"),
    (14.9, 16.1, "ขอบคุณครับ แค่นี้แหละ"),
]
PROMPTS = [  # chat bubble: typing window -> reveal
    {"text": "ช่วยเอาพัดลมขึ้นไปไว้บนหัวผมหน่อย", "show": 3.3, "t0": 4.7, "t1": 8.6, "reveal": CUES["fan"], "obj": "fan"},
    {"text": "เปลี่ยนเป็นโน้ตบุ๊ก", "show": 11.1, "t0": 11.2, "t1": 12.2, "reveal": CUES["laptop"], "obj": "laptop"},
    {"text": "เปลี่ยนเป็นกระป๋อง", "show": 12.75, "t0": 12.8, "t1": 14.0, "reveal": CUES["can"], "obj": "can"},
]
REVEALS = [p["reveal"] for p in PROMPTS]
ZC = (540, 820)  # zoom centre


def zoom(t):
    z = 1.0 + 0.03 * t / DUR
    for r in REVEALS:
        if t >= r - 0.05:
            z += 0.085 * np.exp(-(t - r) * 2.2) * min(1, (t - r + 0.05) / 0.12)
    return float(z)


def decode(vf, w, h, pix="rgb24"):
    p = subprocess.Popen(["ffmpeg", "-v", "error", "-i", str(SRC), "-t", str(DUR), "-vf", vf + f",fps={FPS}",
                          "-f", "rawvideo", "-pix_fmt", pix, "-"], stdout=subprocess.PIPE)
    ch = 3 if pix == "rgb24" else 1
    while True:
        b = p.stdout.read(w * h * ch)
        if len(b) < w * h * ch:
            break
        yield np.frombuffer(b, np.uint8).reshape(h, w, ch) if ch == 3 else np.frombuffer(b, np.uint8).reshape(h, w)


def track():
    cs = [cv2.CascadeClassifier(cv2.data.haarcascades + n) for n in
          ("haarcascade_frontalface_default.xml", "haarcascade_frontalface_alt2.xml")]
    raw = []
    for g in decode(f"scale={SW}:{SH}", SW, SH, "gray"):
        g = cv2.equalizeHist(g)
        r = []
        for c in cs:
            r = c.detectMultiScale(g, 1.05, 3, minSize=(70, 70))
            if len(r):
                break
        raw.append(max(r, key=lambda x: x[2]).astype(float) if len(r) else None)
    raw = (raw + [None] * N)[:N]
    good = [r for r in raw if r is not None]
    med = np.median([r[2] for r in good])
    # reject false positives (small boxes = hands etc.)
    for i, r in enumerate(raw):
        if r is not None and not (0.75 * med < r[2] < 1.3 * med):
            raw[i] = None
    idx = [i for i, r in enumerate(raw) if r is not None]
    arr = np.array([raw[i] for i in idx])
    full = np.stack([np.interp(np.arange(N), idx, arr[:, k]) for k in range(4)], 1)
    # smooth: centred moving average 9 frames (+ a second pass)
    k = np.ones(9) / 9
    for _ in range(2):
        full = np.stack([np.convolve(np.pad(full[:, j], 4, mode="edge"), k, "valid") for j in range(4)], 1)
    print(f"[prep] face found in {len(idx)}/{N} frames, median size {med:.0f}px @360w")
    return full * (W / SW), [r is not None for r in raw]   # x, y, w, h in 1080x1920 (before zoom)


def main():
    OUT.mkdir(exist_ok=True)
    box, found = track()
    # 2. graded + zoomed base
    enc = subprocess.Popen(["ffmpeg", "-v", "error", "-y", "-f", "rawvideo", "-pix_fmt", "rgb24", "-s", f"{W}x{H}",
                            "-r", str(FPS), "-i", "-", "-c:v", "libx264", "-preset", "medium", "-crf", "16",
                            "-pix_fmt", "yuv420p", str(OUT / "base.mp4")], stdin=subprocess.PIPE)
    vf = (f"hqdn3d=3:2:6:4,scale={W}:{H}:flags=lanczos,"
          "eq=gamma=1.2:contrast=1.07:saturation=1.15:brightness=0.015,unsharp=5:5:0.5")
    zs, faces = [], []
    for i, fr in enumerate(decode(vf, W, H)):
        if i >= N:
            break
        t = i / FPS; z = zoom(t)
        x0, y0 = ZC[0] - ZC[0] / z, ZC[1] - ZC[1] / z   # ZC stays fixed on screen
        M = np.float32([[z, 0, -x0 * z], [0, z, -y0 * z]])
        out = cv2.warpAffine(fr, M, (W, H), flags=cv2.INTER_LINEAR, borderMode=cv2.BORDER_REPLICATE)
        enc.stdin.write(out.tobytes())
        bx, by, bw, bh = box[i]
        faces.append([round((bx + bw / 2 - x0) * z, 1), round((by - y0) * z, 1), round(bw * z, 1)])  # cx, top, width
        zs.append(round(z, 4))
    enc.stdin.close(); enc.wait()
    n = len(faces)
    # 3. voice
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", str(SRC), "-t", str(DUR), "-vn",
                    "-af", "highpass=f=90,afftdn=nf=-30,acompressor=threshold=-24dB:ratio=3:attack=5:release=120,"
                           "loudnorm=I=-15:TP=-2:LRA=7,afade=t=out:st=16.2:d=0.4",
                    "-ar", "48000", "-ac", "2", str(OUT / "footage.wav")], check=True)
    # 4. timeline
    tl = {"width": W, "height": H, "fps": FPS, "frames": n, "duration": n / FPS,
          "cues": {k: {"start": v} for k, v in CUES.items()},
          "data": {"face": faces, "zoom": zs, "captions": CAPTIONS, "prompts": PROMPTS}}
    (OUT / "timeline.json").write_text(json.dumps(tl, ensure_ascii=False))
    # 5. music + sfx
    import importlib.util
    spec = importlib.util.spec_from_file_location("score", HERE / "score.py"); sc = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(sc)
    music, fx = sc.build(n / FPS, PROMPTS, CUES)
    vo = S.Track(n / FPS)
    v = subprocess.run(["ffmpeg", "-v", "error", "-i", str(OUT / "footage.wav"), "-ac", "1", "-ar", str(S.SR), "-f", "f32le", "-"],
                       capture_output=True, check=True).stdout
    vo.add(0, np.frombuffer(v, np.float32))
    duck = np.clip(S.follower(vo.buf, 0.02, 0.35) / 0.1, 0, 1)
    mix = music * (1 - 0.6 * duck) + fx
    mix = np.stack([mix, mix], 1)
    from scipy.io import wavfile
    wavfile.write(OUT / "mix.wav", S.SR, (np.clip(mix, -1, 1) * 32767).astype(np.int16))
    print(f"[prep] wrote base.mp4 ({n} frames), footage.wav, mix.wav, timeline.json")


if __name__ == "__main__":
    main()
