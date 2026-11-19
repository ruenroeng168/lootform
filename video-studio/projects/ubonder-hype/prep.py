#!/usr/bin/env python3
"""อุบลเด้อ hype reel (technicians only, no founder face): hook = a drawn generic "group post" asking for an
electrician that only gets useless comments, slam question, logo slam, 3 real features (web page + AI stills),
ช่างแต็ก's real sound bite with his work photos, punchy ending + end card.  Voice: Puck (out/n).

Writes out/base.mp4, out/footage.wav, out/mix.wav, out/timeline.json, then
    node engine/render.mjs projects/ubonder-hype --overlay --footage-vol=1
"""
import json, subprocess, sys, importlib.util
from pathlib import Path
import numpy as np, cv2

HERE = Path(__file__).resolve().parent; OUT = HERE / "out"; A = HERE / "assets"
sys.path.insert(0, str(HERE.parent.parent / "engine"))
import synth as S  # noqa: E402

W, H, FPS = 1080, 1920, 30
NARR = "highpass=f=80,equalizer=f=3200:t=q:w=1:g=1.5,acompressor=threshold=-20dB:ratio=3:makeup=2,loudnorm=I=-15:TP=-1.5:LRA=6"
TAK = ("highpass=f=90,afftdn=nr=8:nf=-50,equalizer=f=450:t=q:w=1:g=-5,equalizer=f=850:t=q:w=1:g=-3,equalizer=f=2800:t=q:w=1:g=6,"
       "highshelf=f=4300:g=8,acompressor=threshold=-20dB:ratio=3:makeup=2,alimiter=limit=0.89,loudnorm=I=-15:TP=-1.5")
# (key, lead before the line, tail after it, pictures [(fraction of the segment where it starts, source)])
PLAN = [("hook", 0.7, 0.35, [(0, "hookbg")]),
        ("brand", 0.05, 0.45, [(0, "orange")]),
        ("f1", 0.1, 0.2, [(0, "web")]),
        ("f2", 0.1, 0.2, [(0, "ai2"), (0.5, "ai5")]),
        ("f3", 0.1, 0.25, [(0, "ai3"), (0.5, "ai6")]),
        ("real", 0.1, 0.2, [(0, "ph4"), (0.55, "ph1")]),
        ("tak", 0.0, 0.0, [(0, "tak")]),
        ("end", 0.15, 2.4, [(0, "ai7"), (0.62, "black")])]
TAK_CLIP = (0.75, 5.45)
TAK_CAPS = [(0.75, 3.1, "การหาลูกค้าของเราก็จะง่ายขึ้น"), (3.1, 5.45, "แล้วลูกค้าก็จะหาเราง่ายขึ้นนะครับ")]
SHOW = {"hook": "คนอุบลฯ ยังต้องหาช่าง จากโพสต์ในกลุ่มอยู่อีกเหรอ?", "brand": "มี อุบลเด้อ แล้ว!"}


def sm(u): u = min(1.0, max(0.0, u)); return u * u * (3 - 2 * u)


def load_audio(f, af=None, ss=None, t=None):
    cmd = ["ffmpeg", "-v", "error"] + (["-ss", str(ss)] if ss is not None else []) + (["-t", str(t)] if t else []) + ["-i", str(f)] + \
          (["-af", af] if af else []) + ["-ac", "1", "-ar", str(S.SR), "-f", "f32le", "-"]
    return np.frombuffer(subprocess.run(cmd, capture_output=True, check=True).stdout, np.float32).astype(np.float64)


def cover(img, ybias=0.4):
    h, w = img.shape[:2]; s = max(W / w, H / h)
    r = cv2.resize(img, (int(w * s + 1), int(h * s + 1)), interpolation=cv2.INTER_AREA if s < 1 else cv2.INTER_CUBIC)
    y0 = int((r.shape[0] - H) * ybias); x0 = (r.shape[1] - W) // 2
    return r[y0:y0 + H, x0:x0 + W].copy()


def zoom(img, z, cx=540, cy=900):
    if abs(z - 1) < 1e-3: return img
    vw, vh = W / z, H / z; x0 = min(max(cx - vw / 2, 0), W - vw); y0 = min(max(cy - vh / 2, 0), H - vh)
    M = np.float32([[z, 0, -x0 * z], [0, z, -y0 * z]])
    return cv2.warpAffine(img, M, (W, H), flags=cv2.INTER_LINEAR, borderMode=cv2.BORDER_REFLECT)


def main():
    OUT.mkdir(exist_ok=True)
    N = json.loads((HERE / "narr.json").read_text()); keys = [k for k, _ in N]; text = dict(N)
    na = load_audio(next((OUT / "n").glob("*.wav")), NARR); spans = json.loads((OUT / "n" / "spans.json").read_text())
    ncl = {}
    for k, (a, b) in zip(keys, spans):
        c = na[int(max(0, a - 0.03) * S.SR):int((b + 0.12) * S.SR)]; m = np.arange(len(c))
        ncl[k] = c * np.minimum(1, np.minimum(m / 300, (len(c) - m) / 1200))
    # Isan pronunciation of "เด้อ" (user request): replace the brand + end lines with the Isan take (out/isan: b2, e2)
    iw = next((OUT / "isan").glob("*.wav")); ia = load_audio(iw, NARR); isp = dict(zip([k for k, _ in json.loads((HERE / "isan.json").read_text())],
                                                                                 json.loads((OUT / "isan" / "spans.json").read_text())))
    for key, alt in (("brand", "b2"), ("end", "e2")):
        a, b = isp[alt]; c = ia[int(max(0, a - 0.05) * S.SR):int((b + 0.2) * S.SR)]; m = np.arange(len(c))
        ncl[key] = c * np.minimum(1, np.minimum(m / 300, (len(c) - m) / 1500))
    pics = {k: cover(cv2.imread(str(A / f"{k}.jpg"))) for k in ("ai2", "ai3", "ai5", "ai6", "ai7", "ph4", "ph1")}
    pics["hookbg"] = (cv2.GaussianBlur(cover(cv2.imread(str(A / "ai1.jpg"))), (0, 0), 30) * 0.35).astype(np.uint8)
    g = np.linspace(0, 1, H)[:, None]; org = np.zeros((H, W, 3), np.uint8)
    org[:] = np.stack([26 + 0 * g, 97 - 55 * g, 241 - 150 * g], -1).astype(np.uint8)
    pics["orange"] = org; pics["black"] = np.zeros((H, W, 3), np.uint8)
    pg = cv2.imread(str(A / "chang_page.png"))[:H, :W].copy(); pg[:158] = cv2.imread(str(A / "chang_hdr.png")); nav = cv2.imread(str(A / "chang_fx1.png")); pg[H - nav.shape[0]:] = nav
    pics["web"] = pg
    tak_fr = subprocess.run(["ffmpeg", "-v", "error", "-ss", f"{TAK_CLIP[0]}", "-t", f"{TAK_CLIP[1] - TAK_CLIP[0] + 0.2}", "-i", str(A / "t_msg.mp4"),
                             "-vf", f"fps={FPS},scale={W}:-2:flags=lanczos,crop={W}:{H}:0:(ih-{H})*0.3,hqdn3d=3:3:5:4,eq=gamma=1.08:contrast=1.06:saturation=1.1,unsharp=5:5:0.8",
                             "-f", "rawvideo", "-pix_fmt", "bgr24", "-"], capture_output=True, check=True).stdout
    tak_fr = np.frombuffer(tak_fr, np.uint8).reshape(-1, H, W, 3)
    enc = subprocess.Popen(["ffmpeg", "-v", "error", "-y", "-f", "rawvideo", "-pix_fmt", "bgr24", "-s", f"{W}x{H}", "-r", str(FPS), "-i", "-",
                            "-c:v", "libx264", "-preset", "medium", "-crf", "17", "-pix_fmt", "yuv420p", str(OUT / "base.mp4")], stdin=subprocess.PIPE)
    voice = S.Track(120); nfr = 0; D = {"segs": {}, "ncaps": [], "tcaps": [], "ai": [], "cuts": []}
    for si, (k, lead, tail, shows) in enumerate(PLAN):
        t0 = nfr / FPS
        if k == "tak":
            d = TAK_CLIP[1] - TAK_CLIP[0]; la = load_audio(A / "t_msg.mp4", TAK, TAK_CLIP[0], d); m = np.arange(len(la))
            voice.add(t0, la * np.minimum(1, np.minimum(m / 300, (len(la) - m) / 800)))
            for c0, c1, tx in TAK_CAPS: D["tcaps"].append([round(t0 + c0 - TAK_CLIP[0], 3), round(t0 + c1 - TAK_CLIP[0], 3), tx])
        else:
            c = ncl[k]; vd = len(c) / S.SR; d = lead + vd + tail; voice.add(t0 + lead, c)
            D["ncaps"].append([round(t0 + lead, 3), round(t0 + lead + vd, 3), SHOW.get(k, text[k]), k])
        n = int(round(d * FPS)); D["segs"][k] = [round(t0, 3), round(t0 + d, 3)]; D["cuts"].append(round(t0, 3))
        starts = [int(f * n) for f, _ in shows] + [n]
        for pi, (f0, src) in enumerate(shows):
            a, b = starts[pi], starts[pi + 1]
            if src.startswith("ai"): D["ai"].append([round(t0 + a / FPS, 3), round(t0 + b / FPS, 3)])
            if pi: D["cuts"].append(round(t0 + a / FPS, 3))
            for j in range(a, b):
                u = (j - a) / max(1, b - a - 1)
                if src == "tak": img = zoom(tak_fr[min(j, len(tak_fr) - 1)], 1.0 + 0.06 * (1 - sm(j / 8)) + 0.05 * u, 540, 700)
                elif src == "web": img = zoom(pics["web"], 1.0 + 0.18 * sm(u * 1.5), 540, 940)
                elif src in ("hookbg", "orange", "black"): img = zoom(pics[src], 1.0 + 0.04 * u)
                else: img = zoom(pics[src], (1.0 + 0.08 * (1 - sm((j - a) / 7))) + 0.07 * u, 540 + (40 if pi % 2 else -40) * u, 860)
                enc.stdin.write(img.tobytes()); nfr += 1
    enc.stdin.close(); enc.wait()
    total = nfr / FPS
    D["endcard"] = round(D["segs"]["end"][0] + (D["segs"]["end"][1] - D["segs"]["end"][0]) * 0.62, 3)
    D["images"] = {"logo": "assets/icon512.png"}; D["report"] = [100, 875, 881, 133]
    vo = voice.buf[:int(total * S.SR)]
    from scipy.io import wavfile
    wavfile.write(OUT / "footage.wav", S.SR, (np.clip(np.stack([vo, vo], 1), -1, 1) * 32767).astype(np.int16))
    spec = importlib.util.spec_from_file_location("score", HERE / "score.py"); sc = importlib.util.module_from_spec(spec); spec.loader.exec_module(sc)
    music, fx = sc.build(total, D)
    duck = np.clip(S.follower(vo, 0.02, 0.3) / 0.08, 0, 1)
    mix = music[:len(vo)] * (1 - 0.6 * duck) + fx[:len(vo)]
    wavfile.write(OUT / "mix.wav", S.SR, (np.clip(np.stack([mix, mix], 1), -1, 1) * 32767).astype(np.int16))
    (OUT / "timeline.json").write_text(json.dumps({"width": W, "height": H, "fps": FPS, "frames": nfr, "duration": round(total, 3), "cues": {}, "data": D}, ensure_ascii=False))
    print(f"[prep] {total:.2f}s; {D['segs']}")


if __name__ == "__main__":
    main()
