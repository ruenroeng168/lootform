#!/usr/bin/env python3
"""Technical QA for a short-form export: dimensions, fps, codecs, pixel format, audio, duration,
size and EBU R128 loudness/true-peak. Prints a PASS / FAIL / WARN table; exit 1 on any FAIL.

    python3 qa_video.py video.mp4 [--expect-width 1080 --expect-height 1920 --fps 30 --max-mb 25
                                   --min-s 10 --max-s 180 --lufs -14 --lufs-tol 1.5 --max-tp -1.0]
"""
import argparse, json, re, subprocess, sys
from pathlib import Path

ap = argparse.ArgumentParser()
ap.add_argument("video"); ap.add_argument("--expect-width", type=int, default=1080); ap.add_argument("--expect-height", type=int, default=1920)
ap.add_argument("--fps", type=float, default=30); ap.add_argument("--max-mb", type=float, default=25)
ap.add_argument("--min-s", type=float, default=5); ap.add_argument("--max-s", type=float, default=180)
ap.add_argument("--lufs", type=float, default=-14); ap.add_argument("--lufs-tol", type=float, default=1.5); ap.add_argument("--max-tp", type=float, default=-1.0)
a = ap.parse_args()
f = Path(a.video)
info = json.loads(subprocess.run(["ffprobe", "-v", "error", "-show_streams", "-show_format", "-of", "json", str(f)], capture_output=True, text=True, check=True).stdout)
v = next((s for s in info["streams"] if s["codec_type"] == "video"), None)
au = next((s for s in info["streams"] if s["codec_type"] == "audio"), None)
dur = float(info["format"]["duration"]); mb = f.stat().st_size / 1e6
rows = []
def row(name, ok, val, warn=False): rows.append((("PASS" if ok else ("WARN" if warn else "FAIL")), name, val))
if v:
    w, h = v["width"], v["height"]; num, den = map(int, v["r_frame_rate"].split("/")); fps = num / den
    row("resolution", (w, h) == (a.expect_width, a.expect_height), f"{w}x{h}")
    row("fps", abs(fps - a.fps) < 0.01, f"{fps:.2f}")
    row("video codec", v["codec_name"] == "h264", v["codec_name"])
    row("pixel format", v.get("pix_fmt") == "yuv420p", v.get("pix_fmt"))
else:
    row("video stream", False, "missing")
row("audio stream", au is not None, f"{au['codec_name']} {au.get('sample_rate')} Hz {au.get('channels')} ch" if au else "missing")
row("duration", a.min_s <= dur <= a.max_s, f"{dur:.2f} s")
row("file size", mb <= a.max_mb, f"{mb:.1f} MB", warn=True)
if au:
    log = subprocess.run(["ffmpeg", "-nostats", "-i", str(f), "-filter_complex", "ebur128=peak=true", "-f", "null", "-"], capture_output=True, text=True).stderr
    tail = log[log.rfind("Summary:"):]
    I = re.search(r"I:\s+(-?[\d.]+) LUFS", tail); TP = re.search(r"Peak:\s+(-?[\d.]+) dBFS", tail)
    if I: row("integrated loudness", abs(float(I.group(1)) - a.lufs) <= a.lufs_tol, f"{float(I.group(1)):.1f} LUFS (target {a.lufs})", warn=True)
    if TP: row("true peak", float(TP.group(1)) <= a.max_tp, f"{float(TP.group(1)):.1f} dBTP (max {a.max_tp})", warn=True)
print(f"QA: {f}")
for st, n, val in rows: print(f"  {st:4}  {n:20} {val}")
print("  NOT CHECKED: visual content, captions legibility, lip/voice sync, music licensing (needs human review)")
sys.exit(1 if any(r[0] == "FAIL" for r in rows) else 0)
