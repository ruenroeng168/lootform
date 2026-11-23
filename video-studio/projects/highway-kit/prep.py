#!/usr/bin/env python3
"""ทางหลวง FC — new kit 2027 launch (fashion-campaign trailer, players as brand ambassadors, no names/blur).
Night photos are graded (deep blacks, kit white/green pop) and the hero shots are cut out (assets/cut, BiRefNet)
onto a designed dark stage (green glow, light streaks, giant outlined HIGHWAY). Phone clips (540x960) are
upscaled, denoised, sharpened and graded; turns in slow motion. Music: dark trailer hybrid synth (synth.py).

Writes out/base.mp4, out/footage.wav (silence), out/mix.wav, out/timeline.json, then
    node engine/render.mjs projects/highway-kit --overlay --footage-vol=0
"""
import json, subprocess, sys
from pathlib import Path
import numpy as np, cv2
from scipy.io import wavfile

HERE = Path(__file__).resolve().parent; OUT = HERE / "out"; A = HERE / "assets"; RAW = A / "raw"; CUT = A / "cut"
sys.path.insert(0, str(HERE.parent.parent / "engine"))
import synth as S  # noqa: E402

W, H, FPS, BPM = 1080, 1920, 30, 120
BEAT = 60 / BPM



def fn(n): return n + "_0" if n.startswith("22") else n


def sm(u): u = min(1.0, max(0.0, u)); return u * u * (3 - 2 * u)


def grade(img):
    """night campaign grade: deep blacks, lifted whites, punchy kit green, cool-green shadows."""
    x = img.astype(np.float32) / 255
    x = np.clip((x - 0.01) / 0.9, 0, 1) ** 0.8                       # lift exposure / midtones
    x = x * x * (3 - 2 * x) * 0.3 + x * 0.7                          # gentle S-curve
    hsv = cv2.cvtColor((x * 255).astype(np.uint8), cv2.COLOR_BGR2HSV).astype(np.float32)
    green = ((hsv[..., 0] > 35) & (hsv[..., 0] < 95)).astype(np.float32)
    hsv[..., 1] = np.clip(hsv[..., 1] * (1.1 + 0.25 * green), 0, 255)
    x = cv2.cvtColor(hsv.astype(np.uint8), cv2.COLOR_HSV2BGR).astype(np.float32) / 255
    lum = x.mean(-1, keepdims=True); sh = (1 - lum) ** 3
    x = x + sh * np.array([0.01, 0.02, -0.003], np.float32)          # BGR: teal-green shadows
    return (np.clip(x, 0, 1) * 255).astype(np.uint8)


def vignette(img, k=0.55):
    yy, xx = np.mgrid[0:H, 0:W].astype(np.float32)
    d = np.sqrt(((xx - W / 2) / (W * 0.62)) ** 2 + ((yy - H / 2) / (H * 0.62)) ** 2)
    return (img * (1 - k * np.clip(d - 0.45, 0, 1) ** 1.5)[..., None]).astype(np.uint8)


def cover(img, cy=0.5):
    h, w = img.shape[:2]; s = max(W / w, H / h)
    r = cv2.resize(img, (int(w * s + 1), int(h * s + 1)), interpolation=cv2.INTER_LANCZOS4)
    y0 = int((r.shape[0] - H) * cy); x0 = (r.shape[1] - W) // 2
    return r[y0:y0 + H, x0:x0 + W].copy()


def zoom(img, z, cx=540, cy=960):
    if abs(z - 1) < 1e-3: return img
    vw, vh = W / z, H / z; x0 = min(max(cx - vw / 2, 0), W - vw); y0 = min(max(cy - vh / 2, 0), H - vh)
    M = np.float32([[z, 0, -x0 * z], [0, z, -y0 * z]])
    return cv2.warpAffine(img, M, (W, H), flags=cv2.INTER_CUBIC, borderMode=cv2.BORDER_REFLECT)


def stage(seed=0):
    """dark campaign backdrop: black-green gradient, glow behind the player, light streaks, floodlight bokeh, HIGHWAY."""
    rng = np.random.default_rng(seed)
    yy, xx = np.mgrid[0:H, 0:W].astype(np.float32)
    bg = np.zeros((H, W, 3), np.float32)
    bg += np.array([22, 40, 18], np.float32) * (1 - 0.5 * yy / H)[..., None]
    glow = np.exp(-(((xx - 540) / 520) ** 2 + ((yy - 900) / 760) ** 2))
    bg += glow[..., None] * np.array([45, 125, 35], np.float32)
    for _ in range(3):                                                   # diagonal light streaks
        x0 = rng.uniform(-200, 1100); a = rng.uniform(0.25, 0.45)
        d = np.abs((xx - x0) - (yy - 0) * a) ; bg += (np.exp(-(d / rng.uniform(18, 40)) ** 2) * 55)[..., None] * np.array([0.6, 1.0, 0.7], np.float32)
    for _ in range(26):                                                  # floodlight bokeh
        cx, cy, r = rng.uniform(0, W), rng.uniform(0, H * 0.55), rng.uniform(6, 22)
        bg += (np.exp(-(((xx - cx) ** 2 + (yy - cy) ** 2) / (r * r))) * rng.uniform(40, 110))[..., None] * np.array([0.75, 0.95, 1.0], np.float32)
    img = np.clip(bg, 0, 255).astype(np.uint8)
    from PIL import Image, ImageDraw, ImageFont
    pil = Image.fromarray(img); d = ImageDraw.Draw(pil)
    f = ImageFont.truetype(str(HERE.parent.parent / "assets" / "fonts" / "ChakraPetch-Bold.ttf"), 380)
    txt = Image.new("RGBA", (H, 520), (0, 0, 0, 0)); td = ImageDraw.Draw(txt)
    td.text((H // 2, 260), "HIGHWAY", font=f, anchor="mm", fill=(0, 0, 0, 0), stroke_width=5, stroke_fill=(90, 200, 110, 90))
    txt = txt.rotate(90, expand=True); pil.paste(txt, ((W - txt.width) // 2, 0), txt)
    return np.array(pil)


def poster_layers(name, seed):
    """returns (bg float32 HxWx3 with rim glow + shadow, subject rgb, alpha, x0, y0)."""
    cut = cv2.imread(str(CUT / f"{fn(name)}.png"), cv2.IMREAD_UNCHANGED)
    rgb, al = grade(cut[..., :3]), cut[..., 3].astype(np.float32) / 255
    h, w = rgb.shape[:2]; s = min(960 / w, 1480 / h)
    rgb = cv2.resize(rgb, (int(w * s), int(h * s)), interpolation=cv2.INTER_LANCZOS4); al = cv2.resize(al, (rgb.shape[1], rgb.shape[0]))
    bg = stage(seed).astype(np.float32)
    x0 = (W - rgb.shape[1]) // 2; y0 = 1700 - rgb.shape[0]
    full = np.zeros((H, W), np.float32); full[y0:y0 + al.shape[0], x0:x0 + al.shape[1]] = al
    bg += cv2.GaussianBlur(full, (0, 0), 22)[..., None] * np.array([40, 150, 50], np.float32) * 0.7
    bg *= 1 - 0.3 * cv2.GaussianBlur(full, (0, 0), 40)[..., None]
    return np.clip(bg, 0, 255), rgb.astype(np.float32), al, x0, y0


def poster_frame(L, u, VIG):
    """parallax: background drifts/zooms slowly, player pushes in a touch faster; a white light sweep crosses the kit."""
    bg, rgb, al, x0, y0 = L
    zb = 1.03 + 0.05 * u; frame = zoom(bg.astype(np.uint8), zb, 540 - 30 * u, 1000).astype(np.float32)
    zs = 1.0 + 0.06 * u + 0.05 * (1 - sm(u * 6))
    h, w = al.shape; nw, nh = int(w * zs), int(h * zs)
    r2 = cv2.resize(rgb, (nw, nh), interpolation=cv2.INTER_LINEAR); a2 = cv2.resize(al, (nw, nh))
    cx = x0 + w / 2 + 25 * u; by = y0 + h + 10 * (1 - u)
    xa, ya = int(cx - nw / 2), int(by - nh)
    xs0, ys0 = max(0, -xa), max(0, -ya); xs1, ys1 = min(nw, W - xa), min(nh, H - ya)
    a = a2[ys0:ys1, xs0:xs1, None]; sub = frame[ya + ys0:ya + ys1, xa + xs0:xa + xs1]
    pr = r2[ys0:ys1, xs0:xs1].copy()
    # light sweep (diagonal band crossing the player between u = 0.15 .. 0.75)
    yy, xx = np.mgrid[ys0:ys1, xs0:xs1].astype(np.float32)
    pos = (-0.3 + 1.6 * sm((u - 0.12) / 0.6)) * (nw + nh)
    band = np.exp(-(((xx + yy * 0.6) - pos) / 70) ** 2)[..., None]
    pr = pr + band * 120
    frame[ya + ys0:ya + ys1, xa + xs0:xa + xs1] = sub * (1 - a) + np.clip(pr, 0, 255) * a
    return (np.clip(frame, 0, 255) * VIG).astype(np.uint8)


def trio_frames(names, seed, n, VIG):
    """lineup: three cut-out players side by side on one stage, sliding up one after another, thin green dividers."""
    bg = stage(seed).astype(np.float32)
    subs = []
    for k, nm in enumerate(names):
        cut = cv2.imread(str(CUT / f"{fn(nm)}.png"), cv2.IMREAD_UNCHANGED)
        rgb, al = grade(cut[..., :3]).astype(np.float32), cut[..., 3].astype(np.float32) / 255
        h, w = al.shape; s_ = min(350 / w, 1180 / h)
        subs.append((cv2.resize(rgb, (int(w * s_), int(h * s_)), interpolation=cv2.INTER_AREA), cv2.resize(al, (int(w * s_), int(h * s_)))))
    out = []
    for j in range(n):
        u = j / n; f = zoom(bg.astype(np.uint8), 1.02 + 0.04 * u).astype(np.float32)
        for k, (rgb, al) in enumerate(subs):
            p = sm((u - k * 0.1) / 0.28); 
            if p <= 0: continue
            cx = 190 + k * 350; h, w = al.shape; x0 = int(cx - w / 2); y0 = int(1640 - h + 160 * (1 - p))
            ys0 = max(0, -y0); a = al[ys0:, :, None] * p; sub = f[y0 + ys0:y0 + h, x0:x0 + w]
            f[y0 + ys0:y0 + h, x0:x0 + w] = sub * (1 - a) + rgb[ys0:] * a
        for k in (1, 2):
            a = sm((u - 0.3) / 0.2); x = 15 + k * 350; f[420:1640, x - 1:x + 2] = f[420:1640, x - 1:x + 2] * (1 - 0.7 * a) + np.array([132, 220, 61], np.float32) * 0.7 * a
        out.append((np.clip(f, 0, 255) * VIG).astype(np.uint8))
    return out


def clip_frames(name, ss, dur):
    vf = f"fps={FPS},scale={W}:{H}:flags=lanczos,hqdn3d=3:3:6:6,unsharp=7:7:1.1:5:5:0.0"
    raw = subprocess.run(["ffmpeg", "-v", "error", "-ss", str(ss), "-t", f"{dur:.3f}", "-i", str(RAW / f"{name}.mp4"), "-vf", vf, "-an",
                          "-f", "rawvideo", "-pix_fmt", "bgr24", "-"], capture_output=True, check=True).stdout
    return np.frombuffer(raw, np.uint8).reshape(-1, H, W, 3)


def sample(fr, n, speed, ramp=False):
    """map n output frames onto source frames; ramp = fast start (2x) easing into slow-mo (0.35x), frame-blended."""
    out = []
    if ramp:
        sp = lambda u: 2.0 - 1.65 * sm(u * 1.6)
        pos = 0.0
        for j in range(n): out.append(pos); pos += sp(j / n)
    else:
        out = [j * speed for j in range(n)]
    res = []
    for p in out:
        i = min(int(p), len(fr) - 2); f = p - i
        res.append(cv2.addWeighted(fr[i], 1 - f, fr[i + 1], f, 0) if f > 0.05 else fr[i])
    return res


def glitch(f, k):
    """RGB split + slice offsets for the first frames of a cut (k 1..0)."""
    if k <= 0: return f
    o = int(28 * k); g = f.copy()
    g[..., 2] = np.roll(f[..., 2], o, 1); g[..., 0] = np.roll(f[..., 0], -o, 1)
    rng = np.random.default_rng(int(k * 1000))
    for _ in range(int(6 * k)):
        y = rng.integers(0, H - 60); hh = rng.integers(10, 60); g[y:y + hh] = np.roll(g[y:y + hh], rng.integers(-80, 80), 1)
    return g


# (beats, kind, source, opts)
SHOTS = [
    (10, "intro", None, {}),
    (4, "clip", "v1", {"ss": 0.2, "speed": 0.5}),            # NEO 11 back, slow
    (3, "clip", "v1", {"ss": 5.2, "speed": 0.55}),           # sleeve badge
    (3, "photo", "s15", {"zoom": (1.45, 1.6), "cy": 0.5}),   # hand on the crest
    (2, "photo", "220307", {"zoom": (2.3, 2.45), "cy": 0.62, "cx": 760}),  # crest detail
    (4, "clip", "v2", {"ss": 0.0, "ramp": True}),            # arms-crossed turn, speed ramp
    (3, "poster", "s17", {}),                                 # back 47
    (3, "clip", "v3", {"ss": 5.3, "speed": 0.6}),            # back 10 under the floodlight
    (2, "clip", "v3", {"ss": 9.4, "speed": 0.8}),            # back 47 walking
    (2, "poster", "220302", {}), (2, "poster", "s09", {}), (2, "poster", "220306", {}), (2, "poster", "s13", {}),
    (4, "trio", ["220304", "s11", "220305"], {}), (4, "trio", ["s10", "220303", "s14"], {}),
    (4, "photo", "220307", {"zoom": (1.05, 1.16), "cy": 0.45}),
    (4, "clip", "v3", {"ss": 14.2, "speed": 0.75}),           # duo, thumbs up
    (14, "end", "s16", {}),
]
VO_AT = {"intro": 0.9, "tease": "s1+0.25", "reveal": "s5+0.3", "we": "s15+0.15", "end": "s17+0.6"}
SECTION = {1, 5, 9, 15}   # shots that open a section: the only cuts that get the glitch
NARR = "highpass=f=70,lowshelf=f=160:g=3,equalizer=f=3000:t=q:w=1:g=1.5,acompressor=threshold=-20dB:ratio=3.5:makeup=2,aecho=0.8:0.5:60:0.12,loudnorm=I=-14:TP=-1.5:LRA=6"


def main():
    OUT.mkdir(exist_ok=True)
    yy, xx = np.mgrid[0:H, 0:W].astype(np.float32)
    VIG = (1 - 0.22 * np.clip(np.sqrt(((xx - W / 2) / (W * 0.62)) ** 2 + ((yy - H / 2) / (H * 0.62)) ** 2) - 0.45, 0, 1) ** 1.5)[..., None]
    enc = subprocess.Popen(["ffmpeg", "-v", "error", "-y", "-f", "rawvideo", "-pix_fmt", "bgr24", "-s", f"{W}x{H}", "-r", str(FPS), "-i", "-",
                            "-c:v", "libx264", "-preset", "medium", "-crf", "15", "-pix_fmt", "yuv420p", str(OUT / "base.mp4")], stdin=subprocess.PIPE)
    nf = 0; segs = []; beat_t = 0.0
    for si, (beats, kind, src, o) in enumerate(SHOTS):
        t0 = beat_t; beat_t += beats * BEAT; n = int(round(beat_t * FPS)) - nf
        segs.append({"t0": round(t0, 3), "t1": round(beat_t, 3), "kind": kind, "src": src})
        frames = []
        if kind == "intro":
            frames = [np.zeros((H, W, 3), np.uint8)] * n
        elif kind == "clip":
            fr = clip_frames(src, o["ss"], n / FPS * (2.2 if o.get("ramp") else o["speed"]) + 0.3)
            for j, f in enumerate(sample(fr, n, o.get("speed", 1), o.get("ramp", False))):
                p = 1 - sm(j / 6); frames.append((zoom(grade(f), 1.0 + 0.07 * p + 0.04 * j / n) * VIG).astype(np.uint8))
        elif kind == "photo":
            base = grade(cover(cv2.imread(str(RAW / f"{fn(src)}.jpg")), o.get("cy", 0.5))); z0, z1 = o["zoom"]
            for j in range(n):
                frames.append((zoom(base, z0 + (z1 - z0) * sm(j / n), o.get("cx", 540), 1920 * o.get("cy", 0.5)) * VIG).astype(np.uint8))
        elif kind == "poster":
            L = poster_layers(src, si)
            frames = [poster_frame(L, j / n, VIG) for j in range(n)]
        elif kind == "trio":
            frames = trio_frames(src, si, n, VIG)
        elif kind == "end":
            bg, rgb, al, x0, y0 = poster_layers(src, si)
            img = bg.copy(); a = al[..., None]; sub = img[y0:y0 + al.shape[0], x0:x0 + al.shape[1]]
            img[y0:y0 + al.shape[0], x0:x0 + al.shape[1]] = sub * (1 - a) + rgb * a
            img = (cv2.GaussianBlur(img, (0, 0), 9) * 0.5).astype(np.uint8)
            frames = [zoom(img, 1.04 + 0.05 * j / n) for j in range(n)]
        for j, f in enumerate(frames):
            if si in SECTION: f = glitch(f, 1 - j / 3)
            enc.stdin.write(np.ascontiguousarray(f).tobytes())
        nf += n
    enc.stdin.close(); enc.wait()
    total = nf / FPS
    # ---- voice
    L = json.loads((HERE / "narr.json").read_text()); spans = json.loads((OUT / "n" / "spans.json").read_text())
    wav = next((OUT / "n").glob("*.wav"))
    na = np.frombuffer(subprocess.run(["ffmpeg", "-v", "error", "-i", str(wav), "-af", NARR, "-ac", "1", "-ar", str(S.SR), "-f", "f32le", "-"],
                                      capture_output=True, check=True).stdout, np.float32).astype(np.float64)
    voice = S.Track(total + 1); vo = {}
    for (k, txt), (a, b) in zip(L, spans):
        at = VO_AT[k]
        if isinstance(at, str): si, off = at[1:].split("+"); at = segs[int(si)]["t0"] + float(off)
        c = na[int(max(0, a - 0.03) * S.SR):int((b + 0.25) * S.SR)]; m = np.arange(len(c))
        voice.add(at, c * np.minimum(1, np.minimum(m / 300, (len(c) - m) / 2000))); vo[k] = [round(at, 3), round(at + len(c) / S.SR, 3), txt]
    D = {"segs": segs, "beat": BEAT, "total": round(total, 3), "vo": vo, "images": {"logo": "assets/logo.png"}}
    v = voice.buf[:int(total * S.SR)]
    music, fx = score(total, D)
    duck = np.clip(S.follower(v, 0.02, 0.3) / 0.08, 0, 1)
    mix = music[:len(v)] * (1 - 0.55 * duck) + fx[:len(v)]
    wavfile.write(OUT / "mix.wav", S.SR, (np.clip(np.stack([mix, mix], 1), -1, 1) * 32767).astype(np.int16))
    wavfile.write(OUT / "footage.wav", S.SR, (np.clip(np.stack([v, v], 1), -1, 1) * 32767).astype(np.int16))
    (OUT / "timeline.json").write_text(json.dumps({"width": W, "height": H, "fps": FPS, "frames": nf, "duration": round(total, 3), "cues": {}, "data": D}, ensure_ascii=False))
    print(f"[prep] {total:.2f}s {nf} frames; vo {vo}")


# ---------------------------------------------------------------- music: phonk / drift
def cowbell(f, dur=0.22):
    t = S.tt(dur)
    sq = lambda ff: np.sign(np.sin(2 * np.pi * ff * t))
    x = (sq(f) + sq(f * 1.48)) * np.exp(-t * 14) * 0.5
    return S.bandpass(x, 450, 5000) * 0.9


def b808(f, dur=0.9, glide=0.0):
    t = S.tt(dur)
    fr = f * (1 + 1.5 * np.exp(-t * 40)) * (2 ** (glide * np.minimum(1, t / dur)))
    ph = 2 * np.pi * np.cumsum(fr) / S.SR
    x = np.sin(ph) * np.exp(-t * 2.2) * np.minimum(1, t / 0.005)
    return np.tanh(x * 3.0) * 0.7


def score(dur, D):
    beat = D["beat"]; bar = beat * 4; sx = beat / 4
    segs = D["segs"]; tease = segs[1]["t0"]; drop = segs[5]["t0"]; run = segs[9]["t0"]; we = segs[15]["t0"]; end = segs[-1]["t0"]
    bell, bass, drums, pad, fx = (S.Track(dur + 3) for _ in range(5))
    # D minor phonk riff (16 sixteenths per bar, None = rest)
    riff = [74, None, 74, 77, 74, None, 72, None, 74, None, 74, 77, 79, 77, 74, 72]
    riff2 = [74, None, 74, 77, 74, None, 72, None, 70, None, 70, 72, 74, 72, 70, 69]
    roots = [38, 38, 34, 36]
    for b in range(int(dur / bar) + 2):
        t0 = b * bar; r = riff if b % 2 == 0 else riff2
        for i, n in enumerate(r):
            if n is not None: bell.add(t0 + i * sx, cowbell(S.midi(n) * 1.0), 0.28 if i % 4 == 0 else 0.2)
        bass.add(t0, b808(S.midi(roots[b % 4]), bar * 0.48), 0.75)
        bass.add(t0 + beat * 2.5, b808(S.midi(roots[b % 4]), beat * 1.4, -0.15), 0.6)
        pad.add(t0, S.lowpass(S.pad([S.midi(roots[b % 4] + 24), S.midi(roots[b % 4] + 31), S.midi(roots[b % 4] + 27)], bar + 0.1, 0.5, 0.7), 1400), 0.22)
        for i in range(4):
            tb = t0 + i * beat
            if i == 0 or (i == 1 and b % 2): drums.add(tb + (beat / 2 if i == 1 else 0), S.kick(0.35), 0.75)
            if i == 2: drums.add(tb, S.clap(0.25), 0.5); drums.add(tb, S.bandpass(S.noise(0.18), 1500, 7000) * np.exp(-S.tt(0.18) * 18), 0.35)
            roll = (b % 4 == 3 and i == 3)
            for j in range(6 if roll else 2):
                drums.add(tb + j * beat / (6 if roll else 2), S.hat(0.025), 0.1)
    # arrangement
    bell.buf = np.concatenate([S.sweep_lowpass(bell.buf[:int(drop * S.SR)], 400, 3500), bell.buf[int(drop * S.SR):]])
    bell.gate([(0, 0), (tease - 0.05, 0), (tease, 0.8), (we - 0.05, 1), (we, 0), (we + 4 * beat - 0.05, 0), (we + 4 * beat, 1), (end, 1), (end + 0.05, 0), (dur + 3, 0)])
    bass.gate([(0, 0), (drop - 0.05, 0), (drop, 1), (we - 0.05, 1), (we, 0), (we + 4 * beat - 0.05, 0), (we + 4 * beat, 1), (end, 1), (end + 0.05, 0), (dur + 3, 0)])
    drums.gate([(0, 0), (drop - 0.05, 0), (drop, 1), (we - 0.05, 1), (we, 0), (we + 4 * beat - 0.05, 0), (we + 4 * beat, 1), (end - 0.05, 1), (end, 0), (dur + 3, 0)])
    pad.gate([(0, 0), (0.4, 0.9), (drop, 0.6), (end, 1), (dur - 0.2, 0.5), (dur + 1, 0), (dur + 3, 0)])
    fx.add(0.4, S.boom(3.0), 0.55)
    fx.add(tease - 1.0, S.riser(1.0), 0.18); fx.add(tease, S.thump(0.4), 0.45)
    fx.add(drop - 1.6, S.riser(1.6), 0.3); fx.add(drop, S.boom(2.2), 0.6); fx.add(drop, b808(S.midi(38), 1.2), 0.7)
    fx.add(run, S.boom(1.4), 0.35)
    fx.add(we, S.boom(2.4), 0.55)
    fx.add(end - 1.4, S.riser(1.4), 0.3); fx.add(end, S.boom(3.2), 0.75); fx.add(end, b808(S.midi(38), 2.5, -0.3), 0.8)
    for x in segs[1:]:
        if x["kind"] not in ("end",): fx.add(x["t0"] - 0.12, S.whoosh(0.35), 0.14)
    n = int(dur * S.SR)
    music = (bell.buf[:n] * 0.8 + bass.buf[:n] + drums.buf[:n] + pad.buf[:n]) * 0.55
    return music, fx.buf[:n]


if __name__ == "__main__":
    main()
