#!/usr/bin/env python3
"""Base video + footage audio for the OSUKA review (run after build.py --audio-only):
  0 - 7.0          talk.mp4  (real voice, cleaned + levelled)
  7.0 - DRILL      orbit.mp4 (slowed to fit, muted)
  DRILL - +9.5     drill.mp4 (real drilling sound, lower)
  then - end       orbit.mp4 again (slow push, muted) for kit / caution / CTA
"""
import json, subprocess
from pathlib import Path
HERE = Path(__file__).resolve().parent; A = HERE / "assets"; OUT = HERE / "out"; SEG = OUT / "segs"; SEG.mkdir(parents=True, exist_ok=True)
tl = json.loads((OUT / "timeline.json").read_text())
W, H, FPS, DUR = tl["width"], tl["height"], tl["fps"], tl["duration"]
T0, T1 = 7.0, tl["cues"]["drill"]["start"] - 0.25
T2 = T1 + 9.5
GRADE = "eq=contrast=1.06:saturation=1.12:gamma=1.03,unsharp=5:5:0.5"
FIT = f"scale={W}:{H}:force_original_aspect_ratio=increase,crop={W}:{H},setsar=1"
ENC = ["-c:v", "libx264", "-preset", "medium", "-crf", "17", "-pix_fmt", "yuv420p", "-r", str(FPS), "-an"]
def run(a): subprocess.run(["ffmpeg", "-v", "error", "-y"] + a, check=True)
def dur(f): return float(subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", str(f)], capture_output=True, text=True).stdout)
def seg(i, src, d, speed=1.0, extra=""):
    k = speed
    vf = f"setpts=(PTS-STARTPTS)/{k:.4f},fps={FPS},{FIT},{GRADE}{extra},tpad=stop_mode=clone:stop_duration=5,trim=duration={d:.3f}"
    run(["-i", str(src), "-vf", vf] + ENC + [str(SEG / f"{i}.mp4")])
od = dur(A / "orbit.mp4")
seg(0, A / "talk.mp4", T0)
seg(1, A / "orbit.mp4", T1 - T0, speed=od / (T1 - T0))
seg(2, A / "drill.mp4", T2 - T1)
d3 = DUR - T2 + 0.3
seg(3, A / "orbit.mp4", d3, speed=max(od / d3, 0.35), extra=f",zoompan=z='min(1+0.0009*on,1.15)':x='iw/2-iw/zoom/2':y='ih/2-ih/zoom/2':d=1:s={W}x{H}:fps={FPS}")
(SEG / "list.txt").write_text("".join(f"file '{SEG / f'{i}.mp4'}'\n" for i in range(4)))
run(["-f", "concat", "-safe", "0", "-i", str(SEG / "list.txt"), "-c", "copy", str(OUT / "base.mp4")])
run(["-i", str(A / "talk.mp4"), "-i", str(A / "drill.mp4"), "-filter_complex",
     "[0:a]atrim=0:7.0,highpass=f=90,afftdn=nf=-30,acompressor=threshold=-20dB:ratio=4:attack=5:release=150,"
     "loudnorm=I=-15:TP=-2:LRA=6,afade=t=out:st=6.75:d=0.25,apad[a0];"
     f"[1:a]atrim=0:9.5,highpass=f=60,volume=0.55,afade=t=in:d=0.1,afade=t=out:st=9.2:d=0.3,adelay={int(T1*1000)}|{int(T1*1000)},apad[a1];"
     f"[a0][a1]amix=inputs=2:normalize=0,atrim=duration={DUR:.3f}", "-ar", "48000", "-ac", "2", str(OUT / "footage.wav")])
print("[prep] base.mp4 + footage.wav", round(DUR, 2), "drill", round(T1, 2), round(T2, 2))
