#!/usr/bin/env python3
"""Make the post-ready deliverables from out/video.mp4:

  out/video_post.mp4  H.264 High, size-targeted (default ≤ 22 MB), loudness -14 LUFS / -1.5 dBTP, faststart
  out/cover.jpg       1080x1920 cover: the sharpest, best-exposed frame + title (script.json "cover" or "title")

    python3 engine/publish.py <project> [--mb=22] [--cover-at=12.5] [--no-cover]

render.mjs calls this automatically after a full render.
"""
import json
import subprocess
import sys
from pathlib import Path

import numpy as np

ROOT = Path(__file__).resolve().parent.parent
FONT = ROOT / "assets" / "fonts" / "IBMPlexSansThai-Bold.ttf"


def probe_duration(f):
    return float(subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", str(f)],
                                capture_output=True, text=True, check=True).stdout)


def post_version(src, dst, mb):
    dur = probe_duration(src)
    audio_k = 128
    video_k = int(min(6000, max(1200, mb * 8 * 1000 / dur * 0.94 - audio_k)))   # 6% container/VBV headroom
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", str(src),
                    "-c:v", "libx264", "-preset", "slow", "-profile:v", "high", "-pix_fmt", "yuv420p",
                    "-b:v", f"{video_k}k", "-maxrate", f"{int(video_k * 1.5)}k", "-bufsize", f"{video_k * 2}k",
                    "-af", "loudnorm=I=-14:TP=-1.5:LRA=11", "-c:a", "aac", "-b:a", f"{audio_k}k", "-ar", "48000",
                    "-movflags", "+faststart", str(dst)], check=True)
    size = dst.stat().st_size / 1e6
    if size > mb * 1.04:   # rare: re-encode tighter
        return post_version(src, dst, mb * mb / size * 0.97)
    return size, video_k


def frame_at(src, t, w=1080, h=1920):
    raw = subprocess.run(["ffmpeg", "-v", "error", "-ss", f"{t:.2f}", "-i", str(src), "-frames:v", "1",
                          "-vf", f"scale={w}:{h}", "-f", "rawvideo", "-pix_fmt", "rgb24", "-"], capture_output=True).stdout
    return np.frombuffer(raw, np.uint8).reshape(h, w, 3) if len(raw) == w * h * 3 else None


def pick_cover_time(src, dur):
    """Score ~16 candidate frames: sharpness (Laplacian variance) x good exposure, skip first/last 8 %."""
    best, best_t = -1, dur * 0.3
    for t in np.linspace(dur * 0.08, dur * 0.85, 16):
        f = frame_at(src, t, 270, 480)
        if f is None:
            continue
        gray = f.mean(axis=2)
        lap = np.abs(gray[1:-1, 1:-1] * 4 - gray[:-2, 1:-1] - gray[2:, 1:-1] - gray[1:-1, :-2] - gray[1:-1, 2:]).var()
        expo = 1 - abs(gray.mean() - 120) / 120
        sat = (f.max(axis=2).astype(int) - f.min(axis=2)).mean() / 255
        score = lap * max(expo, 0.05) * (0.6 + sat)
        if score > best:
            best, best_t = score, t
    return best_t


MARKS = set(range(0x0E31, 0x0E32)) | set(range(0x0E34, 0x0E3B)) | set(range(0x0E47, 0x0E4F))
LEAD = set("เแโใไ")


def wrap(d, text, font, maxw):
    """Greedy wrap that works for Thai (no spaces): break before any base character, never before a
    combining vowel/tone mark or right after a leading vowel; prefer spaces when there are any."""
    lines, cur, last_ok = [], "", -1
    for ch in text:
        test = cur + ch
        if d.textlength(test, font=font) > maxw and cur:
            cut = last_ok if last_ok > 0 else len(cur)
            lines.append(cur[:cut].rstrip()); cur = cur[cut:].lstrip() + ch
            last_ok = -1
        else:
            cur = test
        if ch == " ":
            last_ok = len(cur)
        elif ord(ch) not in MARKS and len(cur) > 1 and cur[-2] not in LEAD and last_ok < len(cur) - 6:
            last_ok = len(cur) - 1   # can break before this base character
    if cur:
        lines.append(cur)
    return lines


def cover(project, src, dst, at=None):
    from PIL import Image, ImageDraw, ImageFilter, ImageFont
    spec = json.loads((project / "script.json").read_text()) if (project / "script.json").exists() else {}
    title = spec.get("cover") or spec.get("title", "")
    title = title.split("(")[0].split("—")[0].strip()
    clean = project / "out" / "base.mp4"          # overlay projects: pick from the footage without graphics
    pick_src = clean if clean.exists() else src
    dur = probe_duration(pick_src)
    t = at if at is not None else pick_cover_time(pick_src, dur)
    f = frame_at(pick_src, t)
    if f is None:
        return None
    im = Image.fromarray(f).convert("RGB")
    W, H = im.size
    if title:
        # darken top for legibility
        grad = Image.new("L", (1, H))
        for y in range(H):
            grad.putpixel((0, y), int(max(0, 200 * (1 - y / (H * 0.42)))))
        im = Image.composite(Image.new("RGB", (W, H), (0, 0, 0)), im, grad.resize((W, H)))
        d = ImageDraw.Draw(im)
        size = 120
        while True:
            font = ImageFont.truetype(str(FONT), size)
            lines = wrap(d, title, font, W - 140)
            if len(lines) <= 3 or size <= 64:
                break
            size -= 8
        y = 190
        for ln in lines[:3]:
            d.text((W // 2, y), ln, font=font, fill=(255, 214, 64), anchor="mm", stroke_width=10, stroke_fill=(10, 10, 14))
            y += int(size * 1.25)
    im.save(dst, quality=92)
    return t


def main(project, mb=22.0, cover_at=None, do_cover=True):
    project = Path(project).resolve()
    src = project / "out" / "video.mp4"
    if not src.exists():
        raise SystemExit(f"no {src}")
    size, vk = post_version(src, project / "out" / "video_post.mp4", mb)
    print(f"[publish] video_post.mp4  {size:.1f} MB  ({vk} kb/s video, -14 LUFS)")
    if do_cover:
        t = cover(project, src, project / "out" / "cover.jpg", cover_at)
        if t is not None:
            print(f"[publish] cover.jpg  (frame at {t:.1f}s)")


if __name__ == "__main__":
    a = sys.argv[1:]
    opt = {x.split("=")[0]: (x.split("=", 1)[1] if "=" in x else True) for x in a[1:]}
    main(a[0], float(opt.get("--mb", 22)), float(opt["--cover-at"]) if "--cover-at" in opt else None, "--no-cover" not in opt)
