#!/usr/bin/env python3
"""ทางหลวง FC "ศึกแย่งปลอกคอกัปตัน · น้องรักหักเหลี่ยมโหด": wildlife-documentary parody.
Real interview clips (assets/mod.mp4 = old captain มด, assets/tar.mp4 = new captain ต้าร์, 448x960 phone clips),
Puck documentary narration (out/n, split by spans.json), the old กองบิน21 match clip as slow-mo b-roll, the duo
photo with Ken-Burns pushes onto each face, a drawn "reconstruction" of the ball in the pond (scene.js), team logo.

Writes out/base.mp4, out/footage.wav, out/mix.wav, out/timeline.json, then
    node engine/render.mjs projects/highway-captain --overlay --footage-vol=1
"""
import json, subprocess, sys, importlib.util
from pathlib import Path
import numpy as np, cv2

HERE = Path(__file__).resolve().parent; OUT = HERE / "out"; A = HERE / "assets"
MATCH = HERE.parent / "highway-fc" / "assets" / "match.mp4"
sys.path.insert(0, str(HERE.parent.parent / "engine"))
import synth as S  # noqa: E402

W, H, FPS = 1080, 1920, 30
GRADE = "hqdn3d=5:4:7:5,eq=gamma=1.1:contrast=1.08:saturation=0.9,colorbalance=rs=0.04:gs=0.01:bs=-0.04,unsharp=5:5:0.8,vignette=PI/5"
VOICE = ("highpass=f=90,afftdn=nr=12:nf=-42,equalizer=f=400:t=q:w=1:g=-3,equalizer=f=3000:t=q:w=1:g=4,highshelf=f=6000:g=3,"
         "acompressor=threshold=-22dB:ratio=3:attack=5:release=120:makeup=2,alimiter=limit=0.89,loudnorm=I=-15:TP=-1.5:LRA=6")
NARR = "highpass=f=70,equalizer=f=150:t=q:w=1:g=2,acompressor=threshold=-22dB:ratio=2.5:makeup=1,loudnorm=I=-16:TP=-1.5:LRA=6"
GAP = 0.25

SEQ = [
    ("clip", "tar", [(27.55, 28.7)], [(27.55, 28.7, "โดนโหวตออกแล้วครับ")], {"freeze": 0.9, "scratch": True}),
    ("title", 3.0),
    ("narr", "n1", "match"),
    ("narr", "n2", "duo_mod"),
    ("clip", "mod", [(11.55, 13.45), (18.0, 23.0), (13.8, 17.0)],
     [(11.55, 13.45, "เขาเป็นน้องที่ผมดึงเข้ากลุ่มมา"), (18.0, 21.15, "ปั้นมากับมือ จากตำแหน่งเด็กเก็บบอล"), (21.15, 23.0, "มาเล่นกองกลาง"),
      (13.8, 17.0, "ก็คิดว่าน้องเขาคงไม่ทรยศพี่อยู่แล้วนะครับ")], {"freeze": 0.0}),
    ("narr", "n2b", "freeze_gray"),
    ("narr", "n3", "pond"),
    ("clip", "mod", [(32.0, 36.85), (45.4, 47.75)],
     [(32.0, 33.2, "ผมไม่ได้มุดน้ำนะครับ"), (33.2, 35.4, "เพราะมันไหลเข้าไปในบึง"), (35.4, 36.85, "ผมก็… ผมไม่ได้ลง"),
      (45.4, 46.6, "ใช่ เพราะผมไม่ได้ลงน้ำ"), (46.6, 47.75, "เขาก็เลยโหวตผมออก")], {"freeze": 1.4, "stamp": True, "scratch": True}),
    ("narr", "n5", "duo_tar"),
    ("clip", "tar", [(4.84, 5.72), (28.65, 33.2)],
     [(4.84, 5.72, "ฟอร์มดีอยู่ครับ"), (28.65, 30.9, "โหวตออก เพราะเรื่องลูกบอล"), (30.9, 33.2, "ไม่ไปเก็บ ไม่มุดน้ำไปเอา")], {"freeze": 0.0}),
    ("narr", "n6", "mod_still"),
    ("clip", "mod", [(23.0, 27.8)], [(23.0, 25.0, "ภูมิใจครับ ภูมิใจในน้องครับ"), (25.0, 27.8, "ตำแหน่งกัปตันให้น้องไปแล้วนะครับ")], {"freeze": 0.0, "sad": True}),
    ("narr", "n7", "pond2"),
    ("end", 3.2),
]


def sm(u): u = min(1.0, max(0.0, u)); return u * u * (3 - 2 * u)


def load_audio(f, af=None):
    cmd = ["ffmpeg", "-v", "error", "-i", str(f)] + (["-af", af] if af else []) + ["-ac", "1", "-ar", str(S.SR), "-f", "f32le", "-"]
    return np.frombuffer(subprocess.run(cmd, capture_output=True, check=True).stdout, np.float32).astype(np.float64)


def frames(clip, a, d, extra=""):
    n = int(round(d * FPS))
    p = subprocess.run(["ffmpeg", "-v", "error", "-ss", f"{a:.3f}", "-i", str(A / f"{clip}.mp4"), "-t", f"{d + 0.2:.3f}",
                        "-vf", f"fps={FPS},scale={W}:-2:flags=lanczos,crop={W}:{H}:0:(ih-{H})*0.3,setsar=1,{GRADE}{extra}",
                        "-f", "rawvideo", "-pix_fmt", "bgr24", "-"], capture_output=True, check=True).stdout
    fr = np.frombuffer(p, np.uint8).reshape(-1, H, W, 3)
    return [fr[min(i, len(fr) - 1)] for i in range(n)]


def zoom(img, z, cx=540, cy=760):
    if abs(z - 1) < 1e-3: return img
    vw, vh = W / z, H / z; x0 = min(max(cx - vw / 2, 0), W - vw); y0 = min(max(cy - vh / 2, 0), H - vh)
    M = np.float32([[z, 0, -x0 * z], [0, z, -y0 * z]])
    return cv2.warpAffine(img, M, (W, H), flags=cv2.INTER_LINEAR, borderMode=cv2.BORDER_REFLECT)


def duo():
    im = cv2.imread(str(A / "duo.jpg")); h, w = im.shape[:2]; s = max(W / w, H / h)
    r = cv2.resize(im, (int(w * s + 1), int(h * s + 1)), interpolation=cv2.INTER_AREA); x0 = (r.shape[1] - W) // 2
    r = r[:H, x0:x0 + W].copy()
    face_mod = (0.33 * w * s - x0, 0.50 * h * s); face_tar = (0.79 * w * s - x0, 0.23 * h * s)   # face centres as fractions of the photo
    return r, face_mod, face_tar


def match_frames(d):
    n = int(round(d * FPS)); f = d / 5.4
    p = subprocess.run(["ffmpeg", "-v", "error", "-i", str(MATCH), "-vf",
                        f"setpts={f:.3f}*PTS,fps={FPS},scale={W}:-2,crop={W}:{H},eq=saturation=0.75:contrast=1.08,colorbalance=rs=0.05:bs=-0.05,vignette=PI/4",
                        "-f", "rawvideo", "-pix_fmt", "bgr24", "-"], capture_output=True, check=True).stdout
    fr = np.frombuffer(p, np.uint8).reshape(-1, H, W, 3)
    return [fr[min(i, len(fr) - 1)] for i in range(n)]


def main():
    OUT.mkdir(exist_ok=True)
    N = json.loads((HERE / "narr.json").read_text()); nkeys = [k for k, _ in N]; ntext = dict(N)
    nwav = next((OUT / "n").glob("*.wav")); na = load_audio(nwav, NARR); spans = json.loads((OUT / "n" / "spans.json").read_text())
    nclip = {}
    for k, (a, b) in zip(nkeys, spans):
        c = na[int(max(0, a - 0.03) * S.SR):int((b + 0.15) * S.SR)]; m = np.arange(len(c))
        nclip[k] = c * np.minimum(1, np.minimum(m / 300, (len(c) - m) / 1500))
    clean = {k: load_audio(A / f"{k}.mp4", VOICE) for k in ("mod", "tar")}
    dimg, fmod, ftar = duo()
    enc = subprocess.Popen(["ffmpeg", "-v", "error", "-y", "-f", "rawvideo", "-pix_fmt", "bgr24", "-s", f"{W}x{H}", "-r", str(FPS), "-i", "-",
                            "-c:v", "libx264", "-preset", "medium", "-crf", "17", "-pix_fmt", "yuv420p", str(OUT / "base.mp4")], stdin=subprocess.PIPE)
    voice = S.Track(200); nfr = 0
    D = {"segs": [], "caps": [], "ncaps": [], "freezes": [], "stamps": [], "scratch": [], "cards": [], "pond": [], "title": None,
         "sad": [], "letterbox": [], "images": {"logo": "assets/logo.jpg"}}
    last = None

    def put(img):
        nonlocal nfr; enc.stdin.write(img.tobytes()); nfr += 1

    for item in SEQ:
        t = nfr / FPS; kind = item[0]
        if kind == "clip":
            _, clip, pieces, caps, opt = item; D["segs"].append([clip, round(t, 3)]); mapping = []
            for pi, (a, b) in enumerate(pieces):
                t0 = nfr / FPS; fr = frames(clip, a, b - a); mapping.append((a, b, t0))
                sg = clean[clip][int(a * S.SR):int(b * S.SR)]; m = np.arange(len(sg))
                voice.add(t0, sg * np.minimum(1, np.minimum(m / 240, (len(sg) - m) / 600)))
                for j, f in enumerate(fr):
                    put(zoom(f, 1.0 + (0.08 if pi % 2 else 0.02) + 0.03 * j / len(fr), 540, 700)); last = f
            for c0, c1, txt in caps:
                for a, b, t0 in mapping:
                    if a - 1e-3 <= c0 < b: D["caps"].append([round(t0 + c0 - a, 3), round(t0 + min(c1, b) - a, 3), txt])
            if opt.get("sad"): D["sad"].append([round(t, 3), round(nfr / FPS, 3)])
            fz = opt.get("freeze", 0)
            if fz:
                tf = nfr / FPS; D["freezes"].append([round(tf, 3), round(tf + fz, 3)])
                if opt.get("scratch"): D["scratch"].append(round(tf, 3))
                if opt.get("stamp"): D["stamps"].append(round(tf + 0.1, 3))
                g = cv2.cvtColor(cv2.cvtColor(last, cv2.COLOR_BGR2GRAY), cv2.COLOR_GRAY2BGR)
                for j in range(int(round(fz * FPS))): put(zoom(g, 1.12 + 0.05 * j / (fz * FPS), 540, 650))
        elif kind == "title":
            d = item[1]; D["title"] = [round(t, 3), round(t + d, 3)]
            dark = (dimg * 0.45).astype(np.uint8)
            for j in range(int(round(d * FPS))): put(zoom(dark, 1.0 + 0.05 * j / (d * FPS), 540, 900))
        elif kind == "narr":
            _, nk, vis = item; c = nclip[nk]; d = len(c) / S.SR + 0.35
            voice.add(t + 0.15, c); D["ncaps"].append([round(t + 0.15, 3), round(t + 0.15 + len(c) / S.SR, 3), ntext[nk]])
            D["segs"].append([nk, round(t, 3)]); D["letterbox"].append([round(t, 3), round(t + d, 3)])
            n = int(round(d * FPS))
            if vis == "match":
                for f in match_frames(d): put(f)
            elif vis in ("duo_mod", "duo_tar"):
                cx, cy = fmod if vis == "duo_mod" else ftar
                D["cards"].append(["mod" if vis == "duo_mod" else "tar", round(t + 0.8, 3), round(t + d, 3)])
                for j in range(n):
                    u = sm(j / max(1, n - 1) * 1.4); put(zoom(dimg, 1.0 + 0.45 * u, 540 + (cx - 540) * u, 900 + (cy - 900) * u))
            elif vis == "freeze_gray":
                g = cv2.cvtColor(cv2.cvtColor(last, cv2.COLOR_BGR2GRAY), cv2.COLOR_GRAY2BGR)
                for j in range(n): put(zoom(g, 1.15 + 0.25 * sm(j / n), 540, 600))
            elif vis == "mod_still":
                still = frames("mod", 23.0, 0.05)[0]
                for j in range(n): put(zoom(still, 1.0 + 0.12 * j / n, 540, 650))
            else:                                    # pond / pond2: drawn by scene.js on a dark base
                D["pond"].append([round(t, 3), round(t + d, 3), vis])
                base = np.zeros((H, W, 3), np.uint8)
                for j in range(n): put(base)
        elif kind == "end":
            d = item[1]; D["end"] = round(t, 3)
            for j in range(int(round(d * FPS))): put(np.zeros((H, W, 3), np.uint8))
    enc.stdin.close(); enc.wait()
    total = nfr / FPS
    vo = voice.buf[:int(total * S.SR)]
    from scipy.io import wavfile
    wavfile.write(OUT / "footage.wav", S.SR, (np.clip(np.stack([vo, vo], 1), -1, 1) * 32767).astype(np.int16))
    spec = importlib.util.spec_from_file_location("score", HERE / "score.py"); sc = importlib.util.module_from_spec(spec); spec.loader.exec_module(sc)
    music, fx = sc.build(total, D)
    duck = np.clip(S.follower(vo, 0.02, 0.35) / 0.08, 0, 1)
    mix = music[:len(vo)] * (1 - 0.7 * duck) + fx[:len(vo)]
    wavfile.write(OUT / "mix.wav", S.SR, (np.clip(np.stack([mix, mix], 1), -1, 1) * 32767).astype(np.int16))
    (OUT / "timeline.json").write_text(json.dumps({"width": W, "height": H, "fps": FPS, "frames": nfr, "duration": round(total, 3), "cues": {}, "data": D}, ensure_ascii=False))
    print(f"[prep] {total:.2f}s; segs {D['segs']}")


if __name__ == "__main__":
    main()
