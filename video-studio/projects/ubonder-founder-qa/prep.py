#!/usr/bin/env python3
"""อุบลเด้อ founder Q&A intro: an AI host asks (Gemini TTS, out/q), Mack answers on camera (assets/a*.mp4),
technician photos (assets/ph*.jpg, cleaned by photos.py) with Mack as picture-in-picture, then a tour of the
real web app (assets/web, captured from ubonder.vercel.app) and an end card.

Writes out/base.mp4 (picture), out/footage.wav (all voices), out/mix.wav (music + sfx, ducked), out/timeline.json
(everything scene.js needs). Then:  node engine/render.mjs projects/ubonder-founder-qa --overlay --footage-vol=1
"""
import json, subprocess, sys, importlib.util
from pathlib import Path
import numpy as np, cv2

HERE = Path(__file__).resolve().parent; OUT = HERE / "out"; A = HERE / "assets"; WEB = A / "web"
sys.path.insert(0, str(HERE.parent.parent / "engine"))
import synth as S  # noqa: E402

W, H, FPS = 1080, 1920, 30
GRADE = ("hqdn3d=4:3:6:4,colorbalance=rs=-0.02:gs=-0.02:bs=0.05:rm=0.02:bm=0.02,"
         "eq=gamma=1.22:contrast=1.08:saturation=1.12:brightness=0.02,unsharp=5:5:0.6")
VOICE = ("highpass=f=80,adeclip,afftdn=nr=20:nf=-38:tn=1,afftdn=nr=8:nf=-42,"
         "agate=threshold=0.015:ratio=2.5:range=0.2:attack=4:release=140,"
         "equalizer=f=150:t=q:w=1:g=1.5,equalizer=f=380:t=q:w=1.2:g=-2.5,equalizer=f=2800:t=q:w=1:g=1.5,"
         "deesser=i=0.7:m=0.6:f=0.45,equalizer=f=6800:t=q:w=1.4:g=-4,highshelf=f=9000:g=-3,lowpass=f=12000,"
         "acompressor=threshold=-24dB:ratio=4:attack=4:release=130:makeup=3,alimiter=limit=0.89,loudnorm=I=-14:TP=-1.5:LRA=5")
HOST = "highpass=f=90,equalizer=f=3000:t=q:w=1:g=1,acompressor=threshold=-22dB:ratio=3:makeup=2,loudnorm=I=-15:TP=-1.5"

# answers: pieces (source in/out s), captions in source time, photos for the b-roll montage
ANS = {
    "a1": {"pieces": [(0.85, 4.55)], "caps": [(0.85, 2.60, "สวัสดีครับ ผมแม็กครับ"), (2.60, 4.55, "เป็นคนทำแอปอุบลเด้อ")]},
    "a2": {"pieces": [(0.40, 3.10)], "caps": [(0.40, 3.10, "ผมเป็นคนอุบลฯ เจอปัญหาเดียวกับหลายคนครับ")]},
    "a3": {"pieces": [(0.55, 4.05)], "caps": [(0.55, 2.75, "บ้านชำรุด อยากได้ช่างใกล้บ้าน"), (2.75, 4.05, "แต่ไม่รู้จะเรียกใคร")],
           "photos": [5, 1, 2]},
    "a4": {"pieces": [(1.30, 6.95)], "caps": [(1.30, 3.38, "ช่างฝีมือดีหลายคนนะครับ"), (3.38, 5.45, "ก็อยากได้ลูกค้า"), (5.45, 6.95, "แต่ก็หาลูกค้าไม่เจอ")],
           "photos": [3, 4, 6, 7, 8]},
    "a5": {"pieces": [(0.20, 1.60)], "caps": [(0.20, 1.60, "ผมเลยทำแอปนี้ขึ้นมา")]},
    "a7": {"pieces": [(1.75, 4.75), (6.20, 12.0)],
           "caps": [(1.75, 3.45, "สมัครเป็นช่างได้เลยครับ"), (3.45, 4.75, "สมัครหน้าเดียวจบ"),
                    (6.20, 8.85, "ส่งผลงาน ส่งเอกสารรับรอง"), (8.85, 10.57, "ที่คุณเคยทำงานมาให้ผมดู"), (10.57, 12.0, "เดี๋ยวคัดกรองให้ครับ")]},
    "a8": {"pieces": [(1.45, 4.00)], "caps": [(1.45, 2.35, "ได้เลยครับ"), (2.35, 4.00, "นี่คือหน้าแรกของอุบลเด้อ")]},
}
ORDER = [("q", 0), "a1", ("q", 1), "a2", ("q", 2), "a3", ("q", 3), "a4", ("q", 4), "a5", ("q", 5), "a7", ("q", 6), "a8"]
PIP = (40, 150, 270, 480)        # x, y, w, h of Mack's picture-in-picture over the photos
SC = 1080 / 390                  # css px -> video px for the web captures
TOUR = [  # (page, duration, scroll from, scroll to)  scroll in video px
    ("home", 2.0, 0, 0), ("home", 2.0, 0, 970), ("home", 1.4, 970, 970),
    ("chang", 2.4, 0, 0), ("chang", 2.6, 0, 2100), ("chang", 1.8, 2100, 2700), ("join", 2.4, 0, 520)]
END_CARD = 3.0


def ff(a): subprocess.run(["ffmpeg", "-v", "error", "-y"] + a, check=True)
def sm(u): u = min(1.0, max(0.0, u)); return u * u * (3 - 2 * u)


def load_audio(f, af=None):
    cmd = ["ffmpeg", "-v", "error", "-i", str(f)] + (["-af", af] if af else []) + ["-ac", "1", "-ar", str(S.SR), "-f", "f32le", "-"]
    return np.frombuffer(subprocess.run(cmd, capture_output=True, check=True).stdout, np.float32).astype(np.float64)


def frames(clip, a, d):
    """Graded 1080x1920 frames of an answer clip from a for d seconds."""
    n = int(round(d * FPS))
    p = subprocess.run(["ffmpeg", "-v", "error", "-ss", f"{a:.3f}", "-i", str(A / f"{clip}.mp4"), "-t", f"{d + 0.2:.3f}",
                        "-vf", f"fps={FPS},scale={W}:{H}:force_original_aspect_ratio=increase,crop={W}:{H},{GRADE}",
                        "-f", "rawvideo", "-pix_fmt", "bgr24", "-"], capture_output=True, check=True).stdout
    fr = np.frombuffer(p, np.uint8).reshape(-1, H, W, 3)
    return [fr[min(i, len(fr) - 1)] for i in range(n)]


def zoom(img, z, cx=540, cy=760):
    M = np.float32([[z, 0, cx - z * cx], [0, z, cy - z * cy]])
    return cv2.warpAffine(img, M, (W, H), flags=cv2.INTER_LINEAR, borderMode=cv2.BORDER_REFLECT)


def photo_canvas(i):
    im = cv2.imread(str(A / f"ph{i}.jpg")); h, w = im.shape[:2]
    if h / w >= 1.3:                                       # portrait: cover
        s = max(W / w, H / h); r = cv2.resize(im, (int(w * s + 1), int(h * s + 1)), interpolation=cv2.INTER_AREA)
        y0 = (r.shape[0] - H) // 3; x0 = (r.shape[1] - W) // 2
        return r[y0:y0 + H, x0:x0 + W].copy()
    s = H / h; bg = cv2.resize(im, (int(w * s), H), interpolation=cv2.INTER_AREA); x0 = (bg.shape[1] - W) // 2
    bg = cv2.GaussianBlur(bg[:, x0:x0 + W], (0, 0), 30); bg = (bg * 0.55).astype(np.uint8)
    s = W / w; fg = cv2.resize(im, (W, int(h * s)), interpolation=cv2.INTER_AREA)
    y = 1060 - fg.shape[0] // 2; bg[y:y + fg.shape[0]] = fg
    return bg


def web_page(n):
    pg = cv2.imread(str(WEB / f"{n}_page.png"))[:, :W]
    return pg, cv2.imread(str(WEB / f"{n}_hdr.png")), (cv2.imread(str(WEB / f"{n}_fx1.png")) if (WEB / f"{n}_fx1.png").exists() else None)


def main():
    OUT.mkdir(exist_ok=True)
    Q = json.loads((HERE / "questions.json").read_text())
    qwav = next((OUT / "q").glob("*.wav"))
    qa = load_audio(qwav, HOST); spans = json.loads((OUT / "q" / "spans.json").read_text())
    qclip = [qa[int(a * S.SR):int(b * S.SR)] for a, b in spans]
    clean = {k: load_audio(A / f"{k}.mp4", VOICE) for k in ANS}

    enc = subprocess.Popen(["ffmpeg", "-v", "error", "-y", "-f", "rawvideo", "-pix_fmt", "bgr24", "-s", f"{W}x{H}", "-r", str(FPS), "-i", "-",
                            "-c:v", "libx264", "-preset", "medium", "-crf", "17", "-pix_fmt", "yuv420p", str(OUT / "base.mp4")], stdin=subprocess.PIPE)
    voice = S.Track(200); t = 0.0; nfr = 0
    D = {"q": [], "caps": [], "pip": [], "cuts": [], "photo_cuts": [], "segs": [], "tour": {}, "images": {"logo": "assets/web/icon512.png"}, "pipRect": PIP}

    def put(img):
        nonlocal nfr; enc.stdin.write(img.tobytes()); nfr += 1

    for item in ORDER:
        t = nfr / FPS
        if isinstance(item, tuple):                      # ---- question card over a blurred freeze of the next answer
            qi = item[1]; nxt = ORDER[ORDER.index(item) + 1]; a0 = ANS[nxt]["pieces"][0][0]
            fz = frames(nxt, a0, 0.05)[0]; fz = (cv2.GaussianBlur(fz, (0, 0), 28) * 0.42).astype(np.uint8)
            lead = 0.35; d = lead + len(qclip[qi]) / S.SR + 0.3
            voice.add(t + lead, qclip[qi])
            for j in range(int(round(d * FPS))): put(zoom(fz, 1.04 + 0.03 * j / (d * FPS)))
            D["q"].append([round(t, 3), round(t + d, 3), Q[qi][1], qi]); D["cuts"].append(round(t, 3)); D["segs"].append(["q", round(t, 3)])
            continue
        k = item; info = ANS[k]; D["segs"].append([k, round(t, 3)])
        for pi, (a, b) in enumerate(info["pieces"]):     # ---- answer pieces
            t0 = nfr / FPS; d = b - a; fr = frames(k, a, d); n = len(fr)
            seg = clean[k][int(a * S.SR):int(b * S.SR)]; m = np.arange(len(seg))
            voice.add(t0, seg * np.minimum(1, np.minimum(m / 400, (len(seg) - m) / 800)))
            for c0, c1, txt in info["caps"]:
                if a - 1e-3 <= c0 < b: D["caps"].append([round(t0 + c0 - a, 3), round(t0 + min(c1, b) - a, 3), txt])
            D["cuts"].append(round(t0, 3))
            if "photos" in info:                          # b-roll montage with Mack as PiP
                ph = info["photos"]; each = n / len(ph); canv = [photo_canvas(i) for i in ph]
                D["pip"].append([round(t0, 3), round(t0 + d, 3)])
                x, y, w, h = PIP
                for j in range(n):
                    pi2 = min(len(ph) - 1, int(j / each)); u = (j - pi2 * each) / each
                    if j and int(j / each) != int((j - 1) / each): D["photo_cuts"].append(round(t0 + j / FPS, 3))
                    img = zoom(canv[pi2], 1.0 + 0.07 * u, 540, 900)
                    sp = cv2.resize(fr[j][120:1507, 150:930], (w, h), interpolation=cv2.INTER_AREA)
                    img[y:y + h, x:x + w] = sp; put(img)
            else:
                for j in range(n):
                    z = 1.0 + 0.05 * j / max(1, n) + (0.06 * (1 - sm(j / 9)) if pi or k != "a1" else 0)
                    put(zoom(fr[j], z))
    # ---- web tour (real pages captured from ubonder.vercel.app)
    t_tour = nfr / FPS; D["tour"]["start"] = round(t_tour, 3); shots = []
    pages = {n: web_page(n) for n in ("home", "chang", "join")}
    org = np.zeros((H, W, 3), np.uint8); g = np.linspace(0, 1, H)[:, None]
    org[:] = (np.stack([26 + 0 * g, 97 - 60 * g, 232 - 140 * g], -1)).astype(np.uint8)      # orange -> brown (BGR)
    for si, (pg, d, s0, s1) in enumerate(TOUR):
        t0 = nfr / FPS; shots.append([pg, round(t0, 3), round(t0 + d, 3), s0, s1]); D["cuts"].append(round(t0, 3))
        page, hdr, nav = pages[pg]; n = int(round(d * FPS))
        for j in range(n):
            u = sm((j / FPS - 0.25) / max(0.01, d - 0.7)); s = int(s0 + (s1 - s0) * u)
            img = page[s:s + H].copy()
            if img.shape[0] < H: img = np.vstack([img, np.full((H - img.shape[0], W, 3), 245, np.uint8)])
            img[:hdr.shape[0]] = hdr
            if nav is not None: img[H - nav.shape[0]:] = nav
            if si == 0 and j < 18:                         # app flies in from the answer: scale + tilt over orange
                e = sm(j / 17); sc = 0.55 + 0.45 * e; ang = -8 * (1 - e)
                M = cv2.getRotationMatrix2D((540, 960), ang, sc); img = cv2.warpAffine(img, M, (W, H), borderValue=(0, 0, 0))
                mask = cv2.warpAffine(np.full((H, W), 255, np.uint8), M, (W, H)); img = np.where(mask[..., None] > 0, img, org)
            put(img)
    D["tour"]["shots"] = shots
    t_end = nfr / FPS
    for j in range(int(END_CARD * FPS)): put(org)
    enc.stdin.close(); enc.wait()
    total = nfr / FPS
    # host outro over the end of the tour, finishing as the end card lands
    outro = qclip[7]; to = max(t_end - len(outro) / S.SR + 0.6, shots[4][1]); voice.add(to, outro)
    D["outro"] = [round(to, 3), round(to + len(outro) / S.SR, 3), Q[7][1]]
    D["end"] = round(t_end, 3)
    seg = dict((k, t) for k, t in D["segs"] if k != "q")
    D["logo"] = round(seg["a5"] + 0.45, 3)
    a7caps = [c for c in D["caps"] if seg["a7"] - 0.01 <= c[0] < seg["a8"]]
    a7end = next(t for k, t in D["segs"][D["segs"].index(["a7", seg["a7"]]) + 1:])
    D["chips"] = [[a7caps[1][0], a7end, "สมัครหน้าเดียวจบ"], [a7caps[2][0], a7end, "ส่งผลงาน + เอกสารรับรอง"], [a7caps[4][0], a7end, "ผู้ดูแลคัดกรองให้"]]
    sh = shots
    D["tour"]["labels"] = [[sh[0][1] + 0.6, sh[1][2], "หน้าแรก · สั่งอาหาร หาช่าง ครบในแอปเดียว"],
                           [sh[3][1] + 0.3, sh[3][2], "แจ้งงานช่างได้ฟรี"],
                           [sh[4][1] + 0.9, sh[4][2] + 0.3, "✓ ช่างเสนอราคาก่อนทำ"], [sh[4][1] + 1.5, sh[4][2] + 0.3, "✓ งานเสร็จแล้วค่อยจ่าย"],
                           [sh[6][1] + 0.3, sh[6][2], "ช่างสมัครหน้าเดียวจบ"]]
    D["tour"]["rings"] = [[sh[3][1] + 0.3, sh[3][2], 100, 875, 881, 133]]
    D["tour"]["taps"] = [[sh[2][1] + 0.7, 405, 1800], [sh[5][2] - 0.55, 540, 640]]
    D["taps"] = [x[0] for x in D["tour"]["taps"]]
    D["pops"] = [seg["a1"] + 0.3] + [c[0] for c in D["chips"]] + [l[0] for l in D["tour"]["labels"]]
    vo = voice.buf[:int(total * S.SR)]
    from scipy.io import wavfile
    wavfile.write(OUT / "footage.wav", S.SR, (np.clip(np.stack([vo, vo], 1), -1, 1) * 32767).astype(np.int16))
    # music + sfx
    spec = importlib.util.spec_from_file_location("score", HERE / "score.py"); sc = importlib.util.module_from_spec(spec); spec.loader.exec_module(sc)
    music, fx = sc.build(total, D)
    duck = np.clip(S.follower(vo, 0.02, 0.35) / 0.08, 0, 1)
    mix = music[:len(vo)] * (1 - 0.72 * duck) + fx[:len(vo)]
    wavfile.write(OUT / "mix.wav", S.SR, (np.clip(np.stack([mix, mix], 1), -1, 1) * 32767).astype(np.int16))
    tl = {"width": W, "height": H, "fps": FPS, "frames": nfr, "duration": round(total, 3), "cues": {}, "data": D}
    (OUT / "timeline.json").write_text(json.dumps(tl, ensure_ascii=False))
    print(f"[prep] {total:.2f}s, {nfr} frames; tour at {t_tour:.2f}s, end card at {t_end:.2f}s")


if __name__ == "__main__":
    main()
