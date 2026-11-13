#!/usr/bin/env python3
"""Interview with ช่างแต็ก (real อุบลเด้อ electrician): AI host (Puck, out/q) asks, Tak answers on camera
(assets/t_*.mp4, phone clips 448x960). Pauses inside answers are tightened (jump cuts with an alternating
punch-in), his work photos (from ubonder-founder-qa) cover the "jobs" answer, the real sign-up page covers the
sign-up answer, step chips on the workflow answer.

Two cuts from one shoot:
    python3 prep.py A   # for technicians (recruit) -> ends on ubonder.vercel.app/chang/join
    python3 prep.py B   # for customers (trust)     -> ends on ubonder.vercel.app/chang
then  node engine/render.mjs projects/chang-tak-interview --overlay --footage-vol=1
"""
import json, subprocess, sys, importlib.util
from pathlib import Path
import numpy as np, cv2

HERE = Path(__file__).resolve().parent; OUT = HERE / "out"; A = HERE / "assets"
QA = HERE.parent / "ubonder-founder-qa" / "assets"
sys.path.insert(0, str(HERE.parent.parent / "engine"))
import synth as S  # noqa: E402
from align import _pauses  # noqa: E402

W, H, FPS = 1080, 1920, 30
GRADE = "hqdn3d=3:3:5:4,eq=gamma=1.08:contrast=1.06:saturation=1.1,unsharp=5:5:0.9"
VOICE = ("highpass=f=90,afftdn=nr=8:nf=-50,equalizer=f=450:t=q:w=1:g=-5,equalizer=f=850:t=q:w=1:g=-3,"
         "equalizer=f=2800:t=q:w=1:g=6,highshelf=f=4300:g=8,deesser=i=0.3:f=0.5,"
         "acompressor=threshold=-20dB:ratio=3:attack=5:release=120:makeup=2,alimiter=limit=0.89,loudnorm=I=-15:TP=-1.5:LRA=6")
HOST = "highpass=f=80,equalizer=f=200:t=q:w=1:g=1.5,acompressor=threshold=-22dB:ratio=2.5:makeup=1,loudnorm=I=-15:TP=-1.5:LRA=6"

# answers: clip, pieces (source s), captions (source s)
ANS = {
    "intro": ("intro", [(0.62, 4.35)], [(0.62, 2.54, "สวัสดีครับ ผมแต็ก ช่างไฟฟ้า"), (2.54, 4.35, "อยู่อุบลราชธานีครับ")]),
    "jobs": ("jobs", [(0.22, 12.3)], [(0.22, 2.9, "ปกติรับงานระบบไฟฟ้าครับ"), (2.95, 4.16, "ติดตั้งโคมไฟแชนเดอเลียร์"),
                                     (4.18, 7.3, "แล้วก็ติดตั้งอุปกรณ์ไฟฟ้าครับ"), (7.7, 9.6, "ติดตั้งเครื่องใช้ไฟฟ้า"),
                                     (9.62, 12.3, "แล้วก็รับเหมาเดินสายไฟฟ้าครับ")]),
    "before": ("before", [(2.15, 12.0), (15.0, 19.42)], [(2.15, 7.05, "แต่ก่อนผมทำนามบัตร ไปแจกตามหมู่บ้าน"), (7.05, 12.0, "แล้วก็หางานทั้งเฟซ ทั้งติ๊กต็อก"),
                                                        (15.0, 18.2, "จนมาเจอแอป อุบลเด้อนี้นะครับ"), (18.2, 19.42, "ที่พี่เขาช่วยหางานให้")]),
    "signup": ("signup", [(0.68, 1.72), (10.15, 16.45), (16.7, 20.5)],
               [(0.68, 1.72, "ก็ไม่ยากนะครับ"), (3.08, 4.7, "โหลดแอปมาเสร็จแล้ว"), (4.86, 8.15, "เข้าหน้าหลัก แล้วก็เข้าไปสมัคร"),
                (10.15, 14.8, "มีหลักฐานอะไร เช่นการอบรม ก็ใส่เข้าไป"), (14.85, 16.45, "มีผลงาน ก็ใส่เข้าไป"), (16.7, 20.5, "ง่ายนะครับ แค่ใส่อีเมล ยืนยัน จบเลย")]),
    "flow": ("flow", [(0.72, 6.5), (12.62, 20.28), (22.84, 25.66)],
             [(0.72, 6.5, "สมัครทิ้งไว้ แล้วงานไฟฟ้าก็เด้งเข้ามา"), (6.6, 9.85, "เราก็กด พอกดปุ๊บ"), (12.62, 15.6, "ก็โทรสอบถามกับลูกค้า"),
              (15.9, 18.2, "เรื่องรายละเอียดงานนะครับ"), (18.22, 20.28, "แล้วก็เสนอราคาผ่านแอป"), (22.84, 25.66, "แล้วก็นัดวันลงงานกับทางแอปได้เลย")]),
    "flow_b": ("flow", [(12.62, 20.28), (22.84, 25.66)],
               [(12.62, 15.6, "ช่างโทรสอบถามกับลูกค้า"), (15.9, 18.2, "เรื่องรายละเอียดงานนะครับ"), (18.22, 20.28, "แล้วก็เสนอราคาผ่านแอป"),
                (22.84, 25.66, "แล้วก็นัดวันลงงานกับทางแอปได้เลย")]),
    "msg_hook": ("msg", [(0.75, 5.45)], [(0.75, 3.1, "การหาลูกค้าของเราก็จะง่ายขึ้น"), (3.1, 5.45, "แล้วลูกค้าก็จะหาเราง่ายขึ้นนะครับ")]),
    "msg_end": ("msg", [(5.9, 11.2)], [(5.9, 7.95, "สำหรับการเปลี่ยนแปลงครั้งนี้"), (8.0, 11.2, "ผมรอพี่ ๆ ช่างทุกคน มาเป็นครอบครัวเดียวกันนะครับ")]),
    "heater": ("heater", [(1.2, 8.95)], [(1.2, 5.45, "ใครสนใจติดตั้งเครื่องทำน้ำอุ่นนะครับ"), (5.7, 8.1, "ติดต่อผ่านแอปได้เลยนะครับ"), (8.1, 8.95, "แล้วเจอกันนะครับ")]),
}
CUTS = {
    "A": {"seq": ["msg_hook", "qa_intro", "intro", "qa_jobs", "jobs", "qa_before", "before", "qa_signup", "signup", "qa_flow", "flow", "qa_msg", "msg_end"],
          "out": "out_a", "url": "ubonder.vercel.app/chang/join", "title": ["ช่างไฟฟ้าอุบลฯ เล่าเอง", "รับงานผ่านแอป เป็นยังไง?"]},
    "B": {"seq": ["intro", "qa_jobs", "jobs", "qb_flow", "flow_b", "qb_heater", "heater"],
          "out": "out_b", "url": "ubonder.vercel.app/chang", "title": ["ช่างไฟฟ้าตัวจริงในอุบลฯ", "เรียกช่างผ่านแอป เป็นยังไง?"]},
}
BROLL = {"jobs": [("ph1", 0.0), ("ph4", 2.95), ("ph3", 4.18), ("ph2", 7.7)], "signup": "web_join"}
PIP = (40, 150, 270, 480)
STEPS = {"flow": [(2.54, "งานเด้งเข้ามาในแอป"), (12.62, "โทรถามรายละเอียด"), (18.22, "เสนอราคาผ่านแอป"), (22.84, "นัดวันลงงาน")],
         "flow_b": [(12.62, "ช่างโทรถามรายละเอียด"), (18.22, "เสนอราคาผ่านแอป"), (22.84, "นัดวันลงงาน")]}
END_HOLD = 1.4


def sm(u): u = min(1.0, max(0.0, u)); return u * u * (3 - 2 * u)


def load_audio(f, af=None, sr=S.SR):
    cmd = ["ffmpeg", "-v", "error", "-i", str(f)] + (["-af", af] if af else []) + ["-ac", "1", "-ar", str(sr), "-f", "f32le", "-"]
    return np.frombuffer(subprocess.run(cmd, capture_output=True, check=True).stdout, np.float32).astype(np.float64)


def frames(clip, a, d):
    n = int(round(d * FPS))
    p = subprocess.run(["ffmpeg", "-v", "error", "-ss", f"{a:.3f}", "-i", str(A / f"t_{clip}.mp4"), "-t", f"{d + 0.2:.3f}",
                        "-vf", f"fps={FPS},scale={W}:-2:flags=lanczos,crop={W}:{H}:0:(ih-{H})*0.3,setsar=1,{GRADE}",
                        "-f", "rawvideo", "-pix_fmt", "bgr24", "-"], capture_output=True, check=True).stdout
    fr = np.frombuffer(p, np.uint8).reshape(-1, H, W, 3)
    return [fr[min(i, len(fr) - 1)] for i in range(n)]


def zoom(img, z, cx=540, cy=720):
    if abs(z - 1) < 1e-3: return img
    M = np.float32([[z, 0, cx - z * cx], [0, z, cy - z * cy]])
    return cv2.warpAffine(img, M, (W, H), flags=cv2.INTER_LINEAR, borderMode=cv2.BORDER_REFLECT)


def photo(name):
    im = cv2.imread(str(QA / f"{name}.jpg")); h, w = im.shape[:2]; s = max(W / w, H / h)
    r = cv2.resize(im, (int(w * s + 1), int(h * s + 1)), interpolation=cv2.INTER_AREA)
    y0 = (r.shape[0] - H) // 3; x0 = (r.shape[1] - W) // 2
    return r[y0:y0 + H, x0:x0 + W].copy()


def tighten(clip, pieces, x16):
    P = _pauses(x16, 0.4); out = []
    for a, b in pieces:
        cur = a
        for p0, p1 in P:
            if p0 > cur + 0.15 and p1 < b - 0.15 and p1 - p0 > 0.45:
                out.append((cur, p0 + 0.12)); cur = p1 - 0.12
        out.append((cur, b))
    return out


def main(cut):
    C = CUTS[cut]; OUT.mkdir(exist_ok=True)
    Q = dict(json.loads((HERE / "questions.json").read_text()))
    qkeys = [k for k, _ in json.loads((HERE / "questions.json").read_text())]
    qwav = next((OUT / "q").glob("*.wav")); qa = load_audio(qwav, HOST); spans = json.loads((OUT / "q" / "spans.json").read_text())
    qclip = {}
    for k, (a, b) in zip(qkeys, spans):
        c = qa[int(max(0, a - 0.03) * S.SR):int((b + 0.1) * S.SR)]; m = np.arange(len(c))
        qclip[k] = c * np.minimum(1, np.minimum(m / 300, (len(c) - m) / 1200))
    clean, raw16 = {}, {}
    enc = subprocess.Popen(["ffmpeg", "-v", "error", "-y", "-f", "rawvideo", "-pix_fmt", "bgr24", "-s", f"{W}x{H}", "-r", str(FPS), "-i", "-",
                            "-c:v", "libx264", "-preset", "medium", "-crf", "17", "-pix_fmt", "yuv420p", str(OUT / "base.mp4")], stdin=subprocess.PIPE)
    voice = S.Track(200); nfr = 0
    D = {"cut": cut, "q": [], "caps": [], "pip": [], "cuts": [], "photo_cuts": [], "segs": [], "steps": [], "title": C["title"], "url": C["url"],
         "images": {"logo": "../ubonder-founder-qa/assets/web/icon512.png"}, "pipRect": PIP}

    def put(img):
        nonlocal nfr; enc.stdin.write(img.tobytes()); nfr += 1

    nq = sum(1 for s in C["seq"] if s.startswith("q")); qi = 0
    for idx, item in enumerate(C["seq"]):
        t = nfr / FPS
        if item.startswith("q"):
            nxt = C["seq"][idx + 1]; clip, pieces, _ = ANS[nxt]
            fz = frames(clip, pieces[0][0], 0.05)[0]; fz = (cv2.GaussianBlur(fz, (0, 0), 26) * 0.42).astype(np.uint8)
            lead = 0.3; d = lead + len(qclip[item]) / S.SR + 0.28
            voice.add(t + lead, qclip[item])
            for j in range(int(round(d * FPS))): put(zoom(fz, 1.04 + 0.03 * j / (d * FPS)))
            D["q"].append([round(t, 3), round(t + d, 3), Q[item], qi, nq]); D["cuts"].append(round(t, 3)); D["segs"].append(["q", round(t, 3)]); qi += 1
            continue
        clip, pieces, caps = ANS[item]
        if clip not in clean:
            clean[clip] = load_audio(A / f"t_{clip}.mp4", VOICE); raw16[clip] = load_audio(A / f"t_{clip}.mp4", None, 16000).astype(np.float32)
        subs = tighten(clip, pieces, raw16[clip])
        D["segs"].append([item, round(t, 3)])
        seg_t0 = t; mapping = []          # (src a, src b, out t0)
        br = BROLL.get(item)
        if br == "web_join":
            pg = cv2.imread(str(QA / "web" / "join_page.png"))[:, :W]; hdr = cv2.imread(str(QA / "web" / "join_hdr.png"))
        for si, (a, b) in enumerate(subs):
            t0 = nfr / FPS; d = b - a; fr = frames(clip, a, d); n = len(fr); mapping.append((a, b, t0))
            sg = clean[clip][int(a * S.SR):int(b * S.SR)]; m = np.arange(len(sg))
            voice.add(t0, sg * np.minimum(1, np.minimum(m / 240, (len(sg) - m) / 480)))
            if si: D["cuts"].append(round(t0, 3))
            for j in range(n):
                tt = t0 + j / FPS; src_t = a + j / FPS
                head = zoom(fr[j], 1.0 + (0.07 if si % 2 else 0.0) + 0.02 * j / max(1, n))
                if isinstance(br, list) or br == "web_join":
                    if isinstance(br, list):
                        k = max(i for i, (_, s0) in enumerate(br) if s0 <= src_t + 1e-6) if any(s0 <= src_t + 1e-6 for _, s0 in br) else 0
                        cache = D.setdefault("_ph", {})
                        if br[k][0] not in cache: cache[br[k][0]] = photo(br[k][0])
                        img = zoom(cache[br[k][0]], 1.0 + 0.05 * ((tt - seg_t0) % 3) / 3, 540, 900)
                    else:
                        tot = sum(bb - aa for aa, bb in subs); el = (tt - seg_t0) / max(0.1, tot)
                        sy = int(5200 * sm(el)); img = pg[sy:sy + H].copy(); img[:hdr.shape[0]] = hdr
                    x, y, w, h = PIP
                    img[y:y + h, x:x + w] = cv2.resize(fr[j][150:1572, 140:940], (w, h), interpolation=cv2.INTER_AREA)
                    put(img)
                else:
                    put(head)
        seg_t1 = nfr / FPS
        if br: D["pip"].append([round(seg_t0, 3), round(seg_t1, 3)])
        def m2o(s):
            for a, b, t0 in mapping:
                if s <= b: return t0 + max(0, s - a)
            return mapping[-1][2] + (mapping[-1][1] - mapping[-1][0])
        for c0, c1, txt in caps: D["caps"].append([round(m2o(c0), 3), round(min(m2o(c1), seg_t1), 3), txt])
        for s0, label in STEPS.get(item, []): D["steps"].append([round(m2o(s0), 3), round(seg_t1, 3), label])
        if isinstance(br, list):
            for name, s0 in br[1:]: D["photo_cuts"].append(round(m2o(s0), 3))
    D.pop("_ph", None)
    # end card with host outro
    t_end = nfr / FPS; oc = qclip[C["out"]]; voice.add(t_end + 0.25, oc)
    endbg = np.zeros((H, W, 3), np.uint8)
    for j in range(int(round((0.25 + len(oc) / S.SR + END_HOLD) * FPS))): put(endbg)
    enc.stdin.close(); enc.wait()
    total = nfr / FPS
    D["end"] = round(t_end, 3); D["outro"] = [round(t_end + 0.25, 3), round(t_end + 0.25 + len(oc) / S.SR, 3), Q[C["out"]]]
    vo = voice.buf[:int(total * S.SR)]
    from scipy.io import wavfile
    wavfile.write(OUT / "footage.wav", S.SR, (np.clip(np.stack([vo, vo], 1), -1, 1) * 32767).astype(np.int16))
    spec = importlib.util.spec_from_file_location("score", HERE / "score.py"); sc = importlib.util.module_from_spec(spec); spec.loader.exec_module(sc)
    music, fx = sc.build(total, D)
    duck = np.clip(S.follower(vo, 0.02, 0.35) / 0.08, 0, 1)
    mix = music[:len(vo)] * (1 - 0.72 * duck) + fx[:len(vo)]
    wavfile.write(OUT / "mix.wav", S.SR, (np.clip(np.stack([mix, mix], 1), -1, 1) * 32767).astype(np.int16))
    (OUT / "timeline.json").write_text(json.dumps({"width": W, "height": H, "fps": FPS, "frames": nfr, "duration": round(total, 3), "cues": {}, "data": D}, ensure_ascii=False))
    print(f"[prep {cut}] {total:.2f}s; segs {D['segs']}")


if __name__ == "__main__":
    main(sys.argv[1] if len(sys.argv) > 1 else "A")
