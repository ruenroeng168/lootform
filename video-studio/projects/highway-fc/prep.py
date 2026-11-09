#!/usr/bin/env python3
"""Base video + footage audio for the overlay render (run after `build.py --audio-only`):
  0 - clip1           : black (logo intro is drawn by scene.js)
  clip1 - clip2       : match footage, speed-ramped (120 fps source -> real slow motion), graded
  clip2 - clip2_end   : interview, graded, comic zoom-punch on the punchline
  clip2_end - end     : black (outro drawn by scene.js)
"""
import json
import subprocess
from pathlib import Path

HERE = Path(__file__).resolve().parent
OUT = HERE / "out"; SEG = OUT / "segs"; SEG.mkdir(parents=True, exist_ok=True)
tl = json.loads((OUT / "timeline.json").read_text()); D = json.loads((HERE / "data.json").read_text())
W, H, FPS, DUR = tl["width"], tl["height"], tl["fps"], tl["duration"]
c1, c2, c2e, gag = D["clip1"], D["clip2"], D["clip2_end"], D["gag"]
GRADE = "hqdn3d=3:2:5:4,eq=gamma=1.12:contrast=1.06:saturation=1.18:brightness=0.01,unsharp=5:5:0.4"
FIT = f"scale={W}:{H}:force_original_aspect_ratio=increase,crop={W}:{H},setsar=1"
ENC = ["-c:v", "libx264", "-preset", "medium", "-crf", "17", "-pix_fmt", "yuv420p", "-r", str(FPS), "-an"]


def run(args):
    subprocess.run(["ffmpeg", "-v", "error", "-y"] + args, check=True)


def black(path, dur):
    run(["-f", "lavfi", "-i", f"color=c=black:s={W}x{H}:r={FPS}:d={dur:.3f}"] + ENC + [str(path)])


# 1. black intro
black(SEG / "0.mp4", c1)
# 2. match: 0-1.2 s real time, 1.2-4.0 s at 1/3 speed, 4.0-5.33 s real time  (= 11.0 s)
fc = (f"[0:v]trim=0:1.2,setpts=PTS-STARTPTS,fps={FPS}[a];"
      f"[0:v]trim=1.2:4.0,setpts=(PTS-STARTPTS)*3,fps={FPS}[b];"
      f"[0:v]trim=4.0:5.33,setpts=PTS-STARTPTS,fps={FPS}[c];"
      f"[a][b][c]concat=n=3:v=1:a=0,{FIT},{GRADE},trim=duration={c2 - c1:.3f}[v]")
run(["-i", str(HERE / "assets" / "match.mp4"), "-filter_complex", fc, "-map", "[v]"] + ENC + [str(SEG / "1.mp4")])
# 3. interview with a zoom punch on the punchline (gag time relative to the clip)
g0, g1 = gag - c2 - 0.05, gag - c2 + 1.7
zp = (f"zoompan=z='if(between(in_time,{g0:.2f},{g1:.2f}),1.28,1)':x='iw/2-iw/zoom/2':y='ih*0.36-ih/zoom/2'"
      f":d=1:s={W}x{H}:fps={FPS}")
run(["-i", str(HERE / "assets" / "interview.mp4"), "-vf", f"{FIT},{GRADE},{zp},trim=duration={c2e - c2:.3f}"] + ENC + [str(SEG / "2.mp4")])
# 4. black outro
black(SEG / "3.mp4", DUR - c2e + 0.2)
(SEG / "list.txt").write_text("".join(f"file '{SEG / f'{i}.mp4'}'\n" for i in range(4)))
run(["-f", "concat", "-safe", "0", "-i", str(SEG / "list.txt"), "-c", "copy", str(OUT / "base.mp4")])

# footage audio: match ambience (low) + interview voice (normalised)
run(["-i", str(HERE / "assets" / "match.mp4"), "-i", str(HERE / "assets" / "interview.mp4"), "-filter_complex",
     f"[0:a]highpass=f=80,volume=0.35,adelay={int(c1 * 1000)}|{int(c1 * 1000)},apad[a0];"
     f"[1:a]highpass=f=90,afftdn=nf=-28,loudnorm=I=-15:TP=-2,adelay={int(c2 * 1000)}|{int(c2 * 1000)},apad[a1];"
     f"[a0][a1]amix=inputs=2:normalize=0,atrim=duration={DUR:.3f}",
     "-ar", "48000", "-ac", "2", str(OUT / "footage.wav")])
print("[prep] base.mp4 + footage.wav", DUR)
