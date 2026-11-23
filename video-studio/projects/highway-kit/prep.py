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

# (beats, kind, source, opts)
SHOTS = [
    (6, "intro", None, {}),
    (4, "clip", "v1", {"ss": 0.2, "speed": 0.55}),           # NEO 11 back, slow
    (3, "clip", "v1", {"ss": 5.2, "speed": 0.6}),            # sleeve badge
    (3, "photo", "s15", {"zoom": (1.35, 1.5), "cy": 0.55}),  # hand on the crest
    (4, "clip", "v2", {"ss": 0.0, "speed": 0.75}),           # arms crossed turn
    (3, "poster", "s17", {}),                                 # back 47 + LOOTFORM CITY
    (3, "clip", "v3", {"ss": 5.4, "speed": 0.7}),            # back 10 under the floodlight
    (2, "clip", "v3", {"ss": 9.4, "speed": 0.8}),            # back 47 walking
    (2, "poster", "220302", {}), (2, "poster", "220304", {}), (2, "poster", "s09", {}),
    (2, "poster", "220306", {}), (2, "poster", "s11", {}), (2, "poster", "220305", {}),
    (2, "poster", "s13", {}), (2, "poster", "220303", {}), (2, "poster", "s10", {}), (2, "poster", "s14", {}),
    (3, "photo", "220307", {"zoom": (1.05, 1.15), "cy": 0.45}),
    (4, "clip", "v3", {"ss": 14.2, "speed": 0.8}),           # duo, thumbs up
    (3, "clip", "v4", {"ss": 0.3, "speed": 0.8}),
    (8, "end", "s16", {}),
]


def fn(n): return n + "_0" if n.startswith("22") else n


def sm(u): u = min(1.0, max(0.0, u)); return u * u * (3 - 2 * u)


def grade(img):
    """night campaign grade: deep blacks, lifted whites, punchy kit green, cool-green shadows."""
    x = img.astype(np.float32) / 255
    x = np.clip((x - 0.03) / 0.95, 0, 1)
    x = x * x * (3 - 2 * x) * 0.55 + x * 0.45                      # S-curve
    hsv = cv2.cvtColor((x * 255).astype(np.uint8), cv2.COLOR_BGR2HSV).astype(np.float32)
    green = ((hsv[..., 0] > 35) & (hsv[..., 0] < 95)).astype(np.float32)
    hsv[..., 1] = np.clip(hsv[..., 1] * (1.1 + 0.25 * green), 0, 255)
    x = cv2.cvtColor(hsv.astype(np.uint8), cv2.COLOR_HSV2BGR).astype(np.float32) / 255
    lum = x.mean(-1, keepdims=True); sh = (1 - lum) ** 3
    x = x + sh * np.array([0.015, 0.03, -0.005], np.float32)          # BGR: teal-green shadows
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
    bg += np.array([8, 14, 6], np.float32) * (1 - yy / H)[..., None]
    glow = np.exp(-(((xx - 540) / 520) ** 2 + ((yy - 900) / 760) ** 2))
    bg += glow[..., None] * np.array([30, 85, 22], np.float32)
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


def poster(name, seed):
    cut = cv2.imread(str(CUT / f"{fn(name)}.png"), cv2.IMREAD_UNCHANGED)
    rgb, al = cut[..., :3], cut[..., 3:].astype(np.float32) / 255
    rgb = grade(rgb)
    h, w = rgb.shape[:2]; s = min(980 / w, 1500 / h)
    rgb = cv2.resize(rgb, (int(w * s), int(h * s)), interpolation=cv2.INTER_LANCZOS4); al = cv2.resize(al, (rgb.shape[1], rgb.shape[0]))[..., None]
    bg = stage(seed).astype(np.float32)
    x0 = (W - rgb.shape[1]) // 2; y0 = 1720 - rgb.shape[0]
    # rim light: green edge glow around the cut
    edge = cv2.GaussianBlur(al, (0, 0), 18); edge = edge[..., None] if edge.ndim == 2 else edge
    sub = bg[y0:y0 + rgb.shape[0], x0:x0 + rgb.shape[1]]
    sub += edge * np.array([40, 150, 50], np.float32) * 0.8
    shadow = cv2.GaussianBlur(al, (0, 0), 30); shadow = shadow[..., None] if shadow.ndim == 2 else shadow
    sub *= 1 - 0.35 * shadow
    bg[y0:y0 + rgb.shape[0], x0:x0 + rgb.shape[1]] = sub * (1 - al) + rgb.astype(np.float32) * al
    return vignette(np.clip(bg, 0, 255).astype(np.uint8), 0.4)


def clip_frames(name, ss, n, speed):
    dur = n / FPS * speed + 0.2
    vf = (f"setpts={1 / speed:.4f}*PTS,minterpolate=fps={FPS}:mi_mode=blend," if speed < 0.99 else f"fps={FPS},") + \
         f"scale={W}:{H}:flags=lanczos,hqdn3d=3:3:6:6,unsharp=7:7:1.1:5:5:0.0"
    raw = subprocess.run(["ffmpeg", "-v", "error", "-ss", str(ss), "-t", f"{dur:.3f}", "-i", str(RAW / f"{name}.mp4"), "-vf", vf, "-an",
                          "-f", "rawvideo", "-pix_fmt", "bgr24", "-"], capture_output=True, check=True).stdout
    fr = np.frombuffer(raw, np.uint8).reshape(-1, H, W, 3)
    return fr


def main():
    OUT.mkdir(exist_ok=True)
    enc = subprocess.Popen(["ffmpeg", "-v", "error", "-y", "-f", "rawvideo", "-pix_fmt", "bgr24", "-s", f"{W}x{H}", "-r", str(FPS), "-i", "-",
                            "-c:v", "libx264", "-preset", "medium", "-crf", "16", "-pix_fmt", "yuv420p", str(OUT / "base.mp4")], stdin=subprocess.PIPE)
    nf = 0; segs = []; beat_t = 0.0; vig = None
    for si, (beats, kind, src, o) in enumerate(SHOTS):
        t0 = beat_t; beat_t += beats * BEAT; n = int(round(beat_t * FPS)) - nf
        segs.append({"t0": round(t0, 3), "t1": round(beat_t, 3), "kind": kind, "src": src})
        if kind == "intro":
            for j in range(n): enc.stdin.write(np.zeros((H, W, 3), np.uint8).tobytes())
        elif kind == "clip":
            fr = clip_frames(src, o["ss"], n, o["speed"])
            for j in range(n):
                f = grade(fr[min(j, len(fr) - 1)]); p = 1 - sm(j / 6)
                f = zoom(f, 1.0 + 0.07 * p + 0.04 * j / n)
                enc.stdin.write(vignette(f, 0.45).tobytes())
        elif kind == "photo":
            base = grade(cover(cv2.imread(str(RAW / f"{fn(src)}.jpg")), o.get("cy", 0.5))); z0, z1 = o["zoom"]
            for j in range(n):
                f = zoom(base, z0 + (z1 - z0) * sm(j / n), 540, 1920 * o.get("cy", 0.5))
                enc.stdin.write(vignette(f, 0.45).tobytes())
        elif kind in ("poster", "end"):
            pimg = poster(src, si)
            if kind == "end": pimg = (cv2.GaussianBlur(pimg, (0, 0), 7) * 0.32).astype(np.uint8)
            for j in range(n):
                z = (1.0 + 0.09 * (1 - sm(j / 5)) + 0.03 * j / n) if kind == "poster" else 1.04 + 0.05 * j / n
                enc.stdin.write(zoom(pimg, z, 540, 1000).tobytes())
        nf += n
    enc.stdin.close(); enc.wait()
    total = nf / FPS
    D = {"segs": segs, "beat": BEAT, "total": round(total, 3)}
    music, fx = score(total, D)
    mix = music + fx
    mix = mix / (np.max(np.abs(mix)) + 1e-9) * 0.9
    wavfile.write(OUT / "mix.wav", S.SR, (np.clip(np.stack([mix, mix], 1), -1, 1) * 32767).astype(np.int16))
    sil = np.zeros(len(mix)); wavfile.write(OUT / "footage.wav", S.SR, np.stack([sil, sil], 1).astype(np.int16))
    (OUT / "timeline.json").write_text(json.dumps({"width": W, "height": H, "fps": FPS, "frames": nf, "duration": round(total, 3), "cues": {}, "data": D}, ensure_ascii=False))
    print(f"[prep] {total:.2f}s {nf} frames")


def score(dur, D):
    """dark trailer hybrid: sub drone + pulse from the reveal, trap hats + big kick/clap on the poster run,
    booms on section hits, risers into sections, a final impact + tail."""
    beat = D["beat"]; bar = beat * 4
    drone, pulse, drums, fx = (S.Track(dur + 2) for _ in range(4))
    roots = [38, 38, 41, 36]                                            # D D F C (minor, dark)
    for b in range(int(dur / bar) + 2):
        t0 = b * bar; r = roots[b % 4]
        drone.add(t0, S.lowpass(S.pad([S.midi(r), S.midi(r + 7), S.midi(r + 12)], bar + 0.1, 0.4, 0.6), 900), 0.35)
        for i in range(8):
            pulse.add(t0 + i * beat / 2, S.lowpass(S.bass(S.midi(r), beat * 0.45), 700), 0.32 if i % 2 == 0 else 0.22)
        for i in range(4):
            tb = t0 + i * beat
            drums.add(tb, S.kick(0.4), 0.7 if i in (0, 2) else 0.0)
            if i in (1, 3): drums.add(tb, S.clap(0.22), 0.35)
            for j in range(4 if b % 2 else 2):
                drums.add(tb + j * beat / (4 if b % 2 else 2), S.hat(0.03), 0.09)
    segs = D["segs"]; s = {i: x for i, x in enumerate(segs)}
    reveal = segs[1]["t0"]; run = next(x["t0"] for x in segs if x["kind"] == "poster" and x["src"] == "220302"); end = segs[-1]["t0"]
    pulse.gate([(0, 0), (reveal - 0.05, 0), (reveal, 1), (end, 1), (end + 0.05, 0), (dur + 2, 0)])
    drums.gate([(0, 0), (run - 0.05, 0), (run, 1), (end - beat * 2, 1), (end - beat * 2 + 0.05, 0), (dur + 2, 0)])
    drone.gate([(0, 0), (0.3, 0.7), (end, 1), (dur - 0.3, 0.6), (dur + 0.5, 0), (dur + 2, 0)])
    fx.add(0.35, S.boom(2.6), 0.6)
    fx.add(reveal - 1.4, S.riser(1.4), 0.25); fx.add(reveal, S.boom(2.0), 0.5)
    fx.add(run - 1.0, S.riser(1.0), 0.25); fx.add(run, S.boom(1.6), 0.45)
    fx.add(end - 1.2, S.riser(1.2), 0.3); fx.add(end, S.boom(2.8), 0.7); fx.add(end, S.thump(0.4), 0.6)
    for x in segs[1:]:
        if x["kind"] != "end": fx.add(x["t0"] - 0.15, S.whoosh(0.4), 0.18)
    music = (drone.buf + pulse.buf + drums.buf)[: int(dur * S.SR)] * 0.6
    return music, fx.buf[: int(dur * S.SR)]


if __name__ == "__main__":
    main()
