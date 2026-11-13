#!/usr/bin/env python3
"""อุบลเด้อ winter clip: water-heater safety hook (assets/v1.mp4, AI video, landscape -> panned 9:16 crop),
safety checklist, then the 4 service steps on the user's AI stills (assets/ai*.jpg) + the real "แจ้งงานช่าง (ฟรี)"
web page, end card. Voice: Puck takes out/vo (steps) and out/vo2 (hook, safety, end), split with align.py.

Writes out/base.mp4, out/footage.wav, out/mix.wav, out/timeline.json, then
    node engine/render.mjs projects/ubonder-service --overlay --footage-vol=1
"""
import json, subprocess, sys, importlib.util
from pathlib import Path
import numpy as np, cv2

HERE = Path(__file__).resolve().parent; OUT = HERE / "out"; A = HERE / "assets"
sys.path.insert(0, str(HERE.parent.parent / "engine"))
import synth as S  # noqa: E402
from align import align_lines  # noqa: E402

W, H, FPS = 1080, 1920, 30
VO_AF = "highpass=f=80,equalizer=f=3200:t=q:w=1:g=1.2,acompressor=threshold=-20dB:ratio=3:attack=5:release=120:makeup=2,loudnorm=I=-15:TP=-1.5:LRA=6"
GAP = 0.3
# segment plan: (line key, take, pictures: list of (part index the picture starts at, source))
PLAN = [("hook", "vo2", [(0, "v1")]),
        ("safety", "vo2", [(0, "v1blur"), (2, "ai1")]),
        ("s1", "vo", [(0, "web")]),
        ("s2", "vo", [(0, "ai2")]),
        ("s3", "vo", [(0, "ai5"), (0.5, "ai3")]),        # 0.5 = halfway through part 0
        ("s4", "vo", [(0, "ai6"), (1, "ai7")]),
        ("end", "vo2", [(0, "endbg")])]
TAIL = 1.6


def sm(u): u = min(1.0, max(0.0, u)); return u * u * (3 - 2 * u)


def load_audio(f, af=None):
    cmd = ["ffmpeg", "-v", "error", "-i", str(f)] + (["-af", af] if af else []) + ["-ac", "1", "-ar", str(S.SR), "-f", "f32le", "-"]
    return np.frombuffer(subprocess.run(cmd, capture_output=True, check=True).stdout, np.float32).astype(np.float64)


def cover(img):
    h, w = img.shape[:2]; s = max(W / w, H / h)
    r = cv2.resize(img, (int(w * s + 0.5), int(h * s + 0.5)), interpolation=cv2.INTER_CUBIC)
    y0 = (r.shape[0] - H) // 2; x0 = (r.shape[1] - W) // 2
    return r[y0:y0 + H, x0:x0 + W].copy()


def kb(img, u, z0=1.0, z1=1.08, dx=0, dy=-30):
    z = z0 + (z1 - z0) * u; cx, cy = 540 + dx * u, 900 + dy * u
    M = np.float32([[z, 0, cx - z * 540], [0, z, cy - z * 900]])
    return cv2.warpAffine(img, M, (W, H), flags=cv2.INTER_LINEAR, borderMode=cv2.BORDER_REFLECT)


def v1_frames():
    p = subprocess.run(["ffmpeg", "-v", "error", "-i", str(A / "v1.mp4"), "-f", "rawvideo", "-pix_fmt", "bgr24", "-"], capture_output=True, check=True).stdout
    return np.frombuffer(p, np.uint8).reshape(-1, 720, 1280, 3), 24.0


def v1_crop(fr, u):
    """9:16 window that pans from the heater to the reaching hand."""
    cx = 1280 * (0.36 + 0.34 * sm(u)); cw = 405
    x0 = int(min(max(cx - cw / 2, 0), 1280 - cw))
    c = cv2.resize(fr[:, x0:x0 + cw], (W, H), interpolation=cv2.INTER_CUBIC)
    return cv2.addWeighted(c, 1.35, cv2.GaussianBlur(c, (0, 0), 3), -0.35, 0)     # light sharpen after the upscale


def web_view():
    wd = A / "web"; pg = cv2.imread(str(wd / "chang_page.png"))[:H, :W].copy()
    hdr = cv2.imread(str(wd / "chang_hdr.png")); nav = cv2.imread(str(wd / "chang_fx1.png"))
    pg[:hdr.shape[0]] = hdr; pg[H - nav.shape[0]:] = nav
    return pg


def main():
    OUT.mkdir(exist_ok=True)
    texts = {}
    for f in ("lines.json", "lines2.json"):
        for k, spoken, shown in json.loads((HERE / f).read_text()): texts[k] = (spoken, shown)
    takes = {}
    for tk, lf in (("vo", "lines.json"), ("vo2", "lines2.json")):
        wav = next(p for p in (OUT / tk).glob("*.wav") if "spans" not in p.name)
        keys = [l[0] for l in json.loads((HERE / lf).read_text())]
        takes[tk] = (load_audio(wav, VO_AF), dict(zip(keys, json.loads((OUT / tk / "spans.json").read_text()))), wav)
    # clip each line + split it into its caption parts (aligned inside the clip)
    lines = {}
    for key, tk, _ in PLAN:
        audio, spans, wav = takes[tk]; a, b = spans[key]
        c = audio[int(max(0, a - 0.03) * S.SR):int((b + 0.12) * S.SR)]; m = np.arange(len(c))
        c = c * np.minimum(1, np.minimum(m / 300, (len(c) - m) / 1500))
        parts = [p.strip() for p in texts[key][1].split("|")]
        tmp = OUT / f"_{key}.wav"
        from scipy.io import wavfile
        wavfile.write(tmp, S.SR, (np.clip(c, -1, 1) * 32767).astype(np.int16))
        ps = align_lines(tmp, [p.replace("15", "สิบห้า") for p in parts], log=lambda *_: None) if len(parts) > 1 else [(0.0, len(c) / S.SR)]
        lines[key] = (c, parts, ps)
    # timeline
    t = 0.15; segs = []
    for key, tk, pics in PLAN:
        c, parts, ps = lines[key]; d = len(c) / S.SR
        segs.append({"key": key, "t0": round(t, 3), "t1": round(t + d, 3), "parts": [[round(t + a, 3), round(t + b, 3), p] for (a, b), p in zip(ps, parts)], "pics": pics})
        t += d + GAP
    total = round(segs[-1]["t1"] + TAIL, 3)
    voice = S.Track(total + 1)
    for sg in segs: voice.add(sg["t0"], lines[sg["key"]][0])
    # picture
    v1, vfps = v1_frames(); last_v1 = v1_crop(v1[-1], 1.0)
    pics = {f"ai{i}": cover(cv2.imread(str(A / f"ai{i}.jpg"))) for i in range(1, 8)}
    pics["web"] = web_view()
    pics["v1blur"] = (cv2.GaussianBlur(last_v1, (0, 0), 22) * 0.55).astype(np.uint8)
    pics["endbg"] = (cv2.GaussianBlur(pics["ai1"], (0, 0), 26) * 0.5).astype(np.uint8)
    enc = subprocess.Popen(["ffmpeg", "-v", "error", "-y", "-f", "rawvideo", "-pix_fmt", "bgr24", "-s", f"{W}x{H}", "-r", str(FPS), "-i", "-",
                            "-c:v", "libx264", "-preset", "medium", "-crf", "17", "-pix_fmt", "yuv420p", str(OUT / "base.mp4")], stdin=subprocess.PIPE)
    n = int(round(total * FPS)); bounds = [sg["t0"] - (0.15 if i == 0 else GAP / 2) for i, sg in enumerate(segs)] + [total]
    bounds[0] = 0.0
    shows = []                     # (start time, picture) for every picture in order
    for sg in segs:
        for p0, src in sg["pics"]:
            pi = int(p0); frac = p0 - pi; a, b = sg["parts"][pi][0], sg["parts"][pi][1]
            st = a + (b - a) * frac if (pi or frac) else bounds[segs.index(sg)]
            shows.append((st, src))
    shows.append((total, None))
    hook_end = bounds[1]
    for j in range(n):
        tt = j / FPS
        k = max(i for i in range(len(shows) - 1) if shows[i][0] <= tt + 1e-9); st, src = shows[k]; en = shows[k + 1][0]
        u = (tt - st) / max(0.01, en - st)
        if src == "v1":
            sv = 1.4 + (9.7 - 1.4) * (tt / hook_end)                       # play 1.4–9.7 s of the AI clip across the hook
            img = v1_crop(v1[min(len(v1) - 1, int(sv * vfps))], tt / hook_end)
        elif src in ("v1blur", "endbg"):
            img = kb(pics[src], u, 1.02, 1.06, 0, 0)
        else:
            img = kb(pics[src], u, 1.0 if k % 2 else 1.07, 1.07 if k % 2 else 1.0, (-30 if k % 2 else 30), -20)
        if k and tt - st < 0.25 and src not in ("v1",):            # punch-in on every cut
            img = kb(img, 0, 1 + 0.05 * (1 - sm((tt - st) / 0.25)), 1, 0, 0)
        enc.stdin.write(img.tobytes())
    enc.stdin.close(); enc.wait()
    vo = voice.buf[:int(total * S.SR)]
    from scipy.io import wavfile
    wavfile.write(OUT / "footage.wav", S.SR, (np.clip(np.stack([vo, vo], 1), -1, 1) * 32767).astype(np.int16))
    sv = {sg["key"]: sg for sg in segs}
    D = {"segs": segs, "shows": [[round(a, 3), b] for a, b in shows[:-1]], "end": sv["end"]["t0"] - GAP / 2, "total": total,
         "images": {"logo": "assets/web/icon512.png"}, "report": [100, 875, 881, 133],
         "ai": [[round(a, 3), round(b, 3)] for (a, s), (b, _) in zip(shows, shows[1:]) if s and s.startswith("ai")]}
    D["warn"] = sv["hook"]["parts"][1][0]; D["zap"] = sv["hook"]["parts"][2][0]
    spec = importlib.util.spec_from_file_location("score", HERE / "score.py"); sc = importlib.util.module_from_spec(spec); spec.loader.exec_module(sc)
    music, fx = sc.build(total, D)
    duck = np.clip(S.follower(vo, 0.02, 0.3) / 0.08, 0, 1)
    mix = music[:len(vo)] * (1 - 0.65 * duck) + fx[:len(vo)]
    wavfile.write(OUT / "mix.wav", S.SR, (np.clip(np.stack([mix, mix], 1), -1, 1) * 32767).astype(np.int16))
    (OUT / "timeline.json").write_text(json.dumps({"width": W, "height": H, "fps": FPS, "frames": n, "duration": total, "cues": {}, "data": D}, ensure_ascii=False))
    print(f"[prep] {total:.2f}s; " + ", ".join(f"{s['key']}@{s['t0']}" for s in segs))


if __name__ == "__main__":
    main()
