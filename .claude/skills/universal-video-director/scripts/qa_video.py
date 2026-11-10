#!/usr/bin/env python3
"""Check technical properties of an exported video using ffprobe.
Usage: python scripts/qa_video.py output.mp4 --expect-width 1080 --expect-height 1920
Only asserts measurable properties. Playback, copyright, Thai spelling and artistic quality require separate review.
"""
import argparse
import json
from pathlib import Path
import shutil
import subprocess
import sys


def main():
    p = argparse.ArgumentParser()
    p.add_argument("video", type=Path)
    p.add_argument("--expect-width", type=int, default=1080)
    p.add_argument("--expect-height", type=int, default=1920)
    p.add_argument("--expect-fps", type=float, default=30)
    p.add_argument("--silent-intentional", action="store_true", help="Do not fail on missing audio if video was intended silent")
    args = p.parse_args()
    if not args.video.is_file():
        print("FAIL: Video file does not exist:", args.video)
        return 2
    if not shutil.which("ffprobe"):
        print("NOT CHECKED: ffprobe is unavailable; do not claim technical QA passed")
        return 2
    cmd = ["ffprobe", "-v", "error", "-show_streams", "-show_format", "-of", "json", str(args.video)]
    r = subprocess.run(cmd, capture_output=True, text=True)
    if r.returncode:
        print("FAIL: ffprobe failed:", r.stderr.strip())
        return 2
    try:
        info = json.loads(r.stdout)
    except ValueError:
        print("FAIL: invalid ffprobe output")
        return 2
    vids = [s for s in info.get("streams", []) if s.get("codec_type") == "video"]
    auds = [s for s in info.get("streams", []) if s.get("codec_type") == "audio"]
    errors, warnings = [], []
    if not vids:
        errors.append("No video stream")
    else:
        v = vids[0]
        w, h = v.get("width"), v.get("height")
        print("Video:", f"{w}x{h}", v.get("codec_name"), v.get("pix_fmt"), "fps=", v.get("avg_frame_rate"))
        if w != args.expect_width or h != args.expect_height:
            errors.append(f"Expected {args.expect_width}x{args.expect_height}, got {w}x{h}")
        frac = v.get("avg_frame_rate", "0/0")
        try:
            n, d = frac.split("/")
            fps = float(n)/float(d)
            if abs(fps-args.expect_fps) > 0.1:
                errors.append(f"Expected {args.expect_fps} FPS; got {fps:.3f}")
        except (ValueError, ZeroDivisionError, AttributeError):
            warnings.append("FPS unavailable")
        if v.get("pix_fmt") not in ("yuv420p", "yuvj420p"):
            warnings.append("Pixel format is not yuv420p; consider broad compatibility")
        if v.get("codec_name") != "h264":
            warnings.append("Video codec is not H.264; check target platform compatibility")
    print("Audio streams:", len(auds))
    if not auds and not args.silent_intentional:
        errors.append("No audio stream (use --silent-intentional only if deliberately silent)")
    duration = info.get("format", {}).get("duration")
    if duration:
        print("Duration (s):", duration)
    else:
        warnings.append("No container duration available")
    for w in warnings:
        print("WARN:", w)
    for e in errors:
        print("FAIL:", e)
    print("RESULT:", "FAIL" if errors else "TECHNICAL PASS — visual/audio listening QC still required")
    return 1 if errors else 0


if __name__ == "__main__":
    sys.exit(main())
