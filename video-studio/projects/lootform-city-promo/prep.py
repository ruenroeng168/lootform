#!/usr/bin/env python3
"""LOOTFORM CITY promo: the creator's own promo_play_v3.mp4 (assets/src.mp4, silent) + Thai voice-over (Puck,
out/vo/take.wav split by out/vo/spans.json), zoom/shake inside the gameplay window only (the headline and frame
stay put), molam-style bed + game sfx. The end card is held until the last line finishes.

Writes out/base.mp4, out/footage.wav (voice), out/mix.wav (music+sfx, ducked), out/timeline.json; then
    node engine/render.mjs projects/lootform-city-promo --overlay --footage-vol=1
"""
import json, subprocess, sys, importlib.util
from pathlib import Path
import numpy as np, cv2
from PIL import Image

HERE = Path(__file__).resolve().parent; OUT = HERE / "out"; A = HERE / "assets"
sys.path.insert(0, str(HERE.parent.parent / "engine"))
import synth as S  # noqa: E402

W, H, FPS = 1080, 1920, 30
WIN = (8, 588, 1064, 766)            # gameplay area inside the gold frame (x, y, w, h) in the source
VO_AF = "highpass=f=80,equalizer=f=3500:t=q:w=1:g=1.5,acompressor=threshold=-20dB:ratio=3:attack=5:release=120:makeup=2,loudnorm=I=-15:TP=-1.5:LRA=6"
SECTIONS = {"combat": 0.0, "boss": 7.1, "party": 14.8, "shop": 25.0, "town": 31.8, "farm": 35.3, "end": 48.0}
SRC_END = 51.9
# zoom keys inside the window: (start, end, zoom, cx, cy) in window coords
ZOOM = [(2.8, 5.0, 1.3, 560, 420), (5.6, 7.0, 1.25, 640, 470),
        (8.0, 11.2, 1.35, 500, 330), (11.6, 14.6, 1.45, 450, 360),
        (17.3, 20.5, 1.35, 520, 380), (21.0, 24.4, 1.3, 560, 400),
        (25.8, 28.0, 1.35, 700, 300), (28.3, 31.5, 1.2, 540, 360),
        (32.0, 33.6, 1.6, 880, 380), (33.6, 35.1, 1.6, 830, 650),
        (36.0, 40.4, 1.25, 400, 380), (41.4, 47.6, 1.2, 560, 420)]
HITS = [3.0, 3.6, 4.4, 6.0, 12.1, 12.9, 13.6]


def sm(u): u = min(1.0, max(0.0, u)); return u * u * (3 - 2 * u)


def zoom_points():
    I = (1.0, WIN[2] / 2, WIN[3] / 2); pts = [(0.0, I)]
    for i, (t0, t1, z, cx, cy) in enumerate(ZOOM):
        K = (z, cx, cy); adj_prev = i and abs(ZOOM[i - 1][1] - t0) < 0.05; adj_next = i + 1 < len(ZOOM) and abs(ZOOM[i + 1][0] - t1) < 0.05
        if not adj_prev: pts.append((t0, I))
        pts.append((t0 + 0.4, K))
        if not adj_next: pts += [(t1 - 0.35, K), (t1, I)]
        else: pts.append((t1, K))
    return pts


PTS = zoom_points()


def view_at(t):
    for (ta, a), (tb, b) in zip(PTS, PTS[1:]):
        if ta <= t < tb:
            u = sm((t - ta) / max(1e-3, tb - ta)); return tuple(a[k] + (b[k] - a[k]) * u for k in range(3))
    return PTS[-1][1]


def load_audio(f, af=None, ss=None):
    cmd = ["ffmpeg", "-v", "error"] + (["-ss", str(ss)] if ss else []) + ["-i", str(f)] + (["-af", af] if af else []) + ["-ac", "1", "-ar", str(S.SR), "-f", "f32le", "-"]
    return np.frombuffer(subprocess.run(cmd, capture_output=True, check=True).stdout, np.float32).astype(np.float64)


def crops():
    fr = Image.open(A / "logoframe.png"); fr.crop((250, 1435, 830, 1605)).save(A / "logo.png")
    m = Image.open(A / "menuframe.png")
    for name, cx in (("kaichon", 383), ("gacha", 455), ("arena", 738), ("dungeon", 808)):
        m.crop((cx - 40, 596, cx + 40, 680)).save(A / f"ic_{name}.png")


def main():
    for t, n in ((3, "logoframe"), (10, "menuframe")):
        if not (A / f"{n}.png").exists():
            subprocess.run(["ffmpeg", "-v", "error", "-y", "-ss", str(t), "-i", str(A / "src.mp4"), "-frames:v", "1", str(A / f"{n}.png")], check=True)
    crops()
    L = json.loads((HERE / "lines.json").read_text()); spans = json.loads((OUT / "vo" / "spans.json").read_text())
    take = load_audio(OUT / "vo" / "take.wav", VO_AF)
    clips = []
    for a, b in spans:
        c = take[int(max(0, a - 0.04) * S.SR):int((b + 0.1) * S.SR)]; m = np.arange(len(c))
        clips.append(c * np.minimum(1, np.minimum(m / 300, (len(c) - m) / 1500)))
    starts = []
    for i, (l, c) in enumerate(zip(L, clips)):
        prev_end = starts[-1] + len(clips[i - 1]) / S.SR if i else 0
        starts.append(max(l[1], prev_end + 0.2) if l[1] >= 0 else prev_end + 0.45)   # never overlap the previous line
    total = round(starts[-1] + len(clips[-1]) / S.SR + 1.3, 2)
    voice = S.Track(total + 1)
    for s, c in zip(starts, clips): voice.add(s, c)

    # ---- picture
    n = int(round(total * FPS)); x, y, w, h = WIN
    src = subprocess.Popen(["ffmpeg", "-v", "error", "-i", str(A / "src.mp4"), "-vf", f"fps={FPS}", "-f", "rawvideo", "-pix_fmt", "bgr24", "-"], stdout=subprocess.PIPE)
    enc = subprocess.Popen(["ffmpeg", "-v", "error", "-y", "-f", "rawvideo", "-pix_fmt", "bgr24", "-s", f"{W}x{H}", "-r", str(FPS), "-i", "-",
                            "-c:v", "libx264", "-preset", "medium", "-crf", "16", "-pix_fmt", "yuv420p", str(OUT / "base.mp4")], stdin=subprocess.PIPE)
    frame = None
    for j in range(n):
        t = j / FPS
        if t < SRC_END or frame is None:
            buf = src.stdout.read(W * H * 3)
            if len(buf) == W * H * 3: frame = np.frombuffer(buf, np.uint8).reshape(H, W, 3)
        img = frame.copy()
        if t < SECTIONS["end"]:
            z, cx, cy = view_at(t)
            sx = sy = 0.0
            for th in HITS:
                u = t - th
                if 0 <= u < 0.28: k = (1 - u / 0.28) ** 2 * 11; sx += k * np.sin(u * 95); sy += k * np.cos(u * 77)
            vw, vh = w / z, h / z; x0 = min(max(cx - vw / 2, 0), w - vw); y0 = min(max(cy - vh / 2, 0), h - vh)
            if z > 1.001 or sx or sy:
                M = np.float32([[z, 0, -x0 * z + sx], [0, z, -y0 * z + sy]])
                img[y:y + h, x:x + w] = cv2.warpAffine(np.ascontiguousarray(frame[y:y + h, x:x + w]), M, (w, h), flags=cv2.INTER_CUBIC, borderMode=cv2.BORDER_REPLICATE)
        enc.stdin.write(img.tobytes())
    enc.stdin.close(); enc.wait(); src.kill()

    # ---- data for scene.js
    caps = []
    for l, s, c in zip(L, starts, clips):
        d = len(c) / S.SR; words = l[3].split(" "); parts, cur = [], ""
        for wd in words:
            if cur and len(cur + " " + wd) > 30: parts.append(cur); cur = wd
            else: cur = (cur + " " + wd).strip()
        parts.append(cur); tot = sum(len(p) for p in parts); t0 = s
        for p in parts:
            t1 = t0 + d * len(p) / tot; caps.append([round(t0, 3), round(t1, 3), p, l[0]]); t0 = t1
    st = dict(zip([l[0] for l in L], starts))
    D = {"win": list(WIN), "zoomPts": [[t, *v] for t, v in PTS], "caps": caps, "starts": st, "end": SECTIONS["end"],
         "images": {"logo": "assets/logo.png", "kaichon": "assets/ic_kaichon.png", "gacha": "assets/ic_gacha.png", "arena": "assets/ic_arena.png", "dungeon": "assets/ic_dungeon.png"},
         "hook": [0.15, st["combat"] - 0.1],
         "auto": [st["combat"] + 2.3, 7.0, 967, 717],
         "boss": [8.4, 11.2],
         "notax": [26.3, 28.1, 532, 312, 200, 36],
         "town": [32.1, 35.1],
         "modes": [[st["modes"] + 0.75, "kaichon", "ไก่ชน"], [st["modes"] + 1.45, "arena", "อารีนา"], [st["modes"] + 2.1, "dungeon", "ดันเจี้ยน"], [st["modes"] + 2.75, "gacha", "กาชา"]],
         "modesEnd": SECTIONS["end"] - 0.2,
         "endRings": [[st["end"] + 2.0, st["try"] - 0.1, 225, 855, 630, 92], [st["try"] + 1.2, total, 175, 1205, 730, 80]],
         "hits": HITS, "sections": SECTIONS}
    D["pops"] = [D["auto"][0], D["boss"][0], D["notax"][0], D["town"][0]] + [m[0] for m in D["modes"]]
    vo = voice.buf[:int(total * S.SR)]
    from scipy.io import wavfile
    wavfile.write(OUT / "footage.wav", S.SR, (np.clip(np.stack([vo, vo], 1), -1, 1) * 32767).astype(np.int16))
    spec = importlib.util.spec_from_file_location("score", HERE / "score.py"); sc = importlib.util.module_from_spec(spec); spec.loader.exec_module(sc)
    music, fx = sc.build(total, D)
    duck = np.clip(S.follower(vo, 0.02, 0.3) / 0.08, 0, 1)
    mix = music[:len(vo)] * (1 - 0.62 * duck) + fx[:len(vo)]
    wavfile.write(OUT / "mix.wav", S.SR, (np.clip(np.stack([mix, mix], 1), -1, 1) * 32767).astype(np.int16))
    (OUT / "timeline.json").write_text(json.dumps({"width": W, "height": H, "fps": FPS, "frames": n, "duration": total, "cues": {}, "data": D}, ensure_ascii=False))
    print(f"[prep] {total:.2f}s, {n} frames; voice starts {[round(s, 2) for s in starts]}")


if __name__ == "__main__":
    main()
