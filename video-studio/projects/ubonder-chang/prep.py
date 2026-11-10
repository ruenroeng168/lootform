#!/usr/bin/env python3
"""Cut the silent app screen-recording (assets/app.mp4) to the voice timeline -> out/base.mp4 (+ silent footage.wav).

Each cue's window [cue.start-0.15, next cue start-0.15) shows that cue's clean slide range (data.sections, the
source's own fades cut away), time-stretched to fit (the slides are near-static, so no visible judder), with a
smooth zoom toward the field being filled (data.zoom; the same maths is mirrored in scene.js so overlays can
point at fields) and a small punch-in on every cut. Run after `build.py --audio-only` (needs out/timeline.json).
"""
import json, subprocess, sys
from pathlib import Path
import numpy as np, cv2

HERE = Path(__file__).resolve().parent; OUT = HERE / "out"
W, H, FPS = 1080, 1920, 30


def smooth(u): u = min(1.0, max(0.0, u)); return u * u * (3 - 2 * u)


def view(cue, rel, C, Z):
    z, cx, cy = 1.0, 540.0, 960.0
    for st, du, kz, kx, ky in Z.get(cue, []):
        if isinstance(st, str): st = C[cue]["marks"][int(st[1:]) - 1] - C[cue]["start"]
        u = smooth((rel - st) / du); z += (kz - z) * u; cx += (kx - cx) * u; cy += (ky - cy) * u
    return z, cx, cy


def main():
    tl = json.loads((OUT / "timeline.json").read_text()); C = tl["cues"]; D = json.loads((HERE / "data.json").read_text())
    keys = list(C); dur = tl["duration"]; n = int(round(dur * FPS))
    w0 = [0.0 if i == 0 else C[k]["start"] - 0.15 for i, k in enumerate(keys)] + [dur]
    src = subprocess.Popen(["ffmpeg", "-v", "error", "-i", str(HERE / "assets/app.mp4"), "-f", "rawvideo", "-pix_fmt", "bgr24", "-"], stdout=subprocess.PIPE)
    enc = subprocess.Popen(["ffmpeg", "-v", "error", "-y", "-f", "rawvideo", "-pix_fmt", "bgr24", "-s", f"{W}x{H}", "-r", str(FPS), "-i", "-",
                            "-c:v", "libx264", "-preset", "medium", "-crf", "16", "-pix_fmt", "yuv420p", str(OUT / "base.mp4")], stdin=subprocess.PIPE)
    fi, frame = -1, None
    for j in range(n):
        t = j / FPS
        i = max(q for q in range(len(keys)) if w0[q] <= t + 1e-9); k = keys[i]
        a, b = D["sections"][k]
        st = a + (b - a) * (t - w0[i]) / (w0[i + 1] - w0[i])
        need = int(st * FPS)
        while fi < need:
            buf = src.stdout.read(W * H * 3)
            if len(buf) < W * H * 3: break
            frame = np.frombuffer(buf, np.uint8).reshape(H, W, 3); fi += 1
        rel = t - C[k]["start"]
        z, cx, cy = view(k, rel, C, D["zoom"])
        if i: z *= 1 + 0.06 * (1 - smooth((t - w0[i]) / 0.3))     # punch-in on each cut
        vw, vh = W / z, H / z
        x0 = min(max(cx - vw / 2, 0), W - vw); y0 = min(max(cy - vh / 2, 0), H - vh)
        M = np.float32([[z, 0, -x0 * z], [0, z, -y0 * z]])
        enc.stdin.write(cv2.warpAffine(frame, M, (W, H), flags=cv2.INTER_CUBIC, borderMode=cv2.BORDER_REPLICATE).tobytes())
    enc.stdin.close(); enc.wait(); src.kill()
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-f", "lavfi", "-i", "anullsrc=r=48000:cl=stereo", "-t", f"{dur:.3f}", str(OUT / "footage.wav")], check=True)
    print(f"[prep] base.mp4 {dur:.2f}s, {n} frames")


if __name__ == "__main__":
    main()
