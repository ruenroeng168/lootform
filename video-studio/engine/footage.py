#!/usr/bin/env python3
"""Cut real footage to the voice-over timeline (EDL in data.json) -> out/base.mp4 + out/footage.wav.

data.json "edl": [{ "cue": <script cue>, "clip": "assets/x.mp4", "in": s, "out": s, "blur": false, "vol": 1.0 }, ...]
Each cue's segment runs from its voice line start (minus a lead) to the next cue. If a clip
chunk is shorter than its segment it is slowed down (to 0.6x at most) and then held on the last frame.
Phone rotation metadata is honoured; footage is cover-fit to the project size, or with data.json
"fit": "blur" (+ "fit_y") shown full-width over a blurred fill (for square/landscape clips).

    python3 video-studio/engine/footage.py video-studio/projects/<slug>
"""
import json
import subprocess
import sys
from pathlib import Path

LEAD = 0.15


def main(project):
    project = Path(project).resolve()
    out = project / "out"; seg_dir = out / "segs"; seg_dir.mkdir(parents=True, exist_ok=True)
    tl = json.loads((out / "timeline.json").read_text())
    data = json.loads((project / "data.json").read_text())
    W, H, fps, dur = tl["width"], tl["height"], tl["fps"], tl["duration"]
    cues = tl["cues"]; edl = data["edl"]
    starts = [0.0] + [max(0.0, cues[e["cue"]]["start"] - LEAD) for e in edl[1:]]
    ends = starts[1:] + [dur]
    vlist, alist = [], []
    for i, (e, a, b) in enumerate(zip(edl, starts, ends)):
        D = round(b - a, 3)
        L = e["out"] - e["in"]
        k = 1.0 if L >= D else max(L / D, 0.6)
        take = min(L, D * k)
        if data.get("fit") == "blur":   # non-vertical footage: sharp copy at fit_y over a blurred cover-fill
            fy = int(data.get("fit_y", (H - W) // 2))
            vf = [f"setpts=(PTS-STARTPTS)/{k:.4f}",
                  f"split[bg][fg];[bg]scale={W}:{H}:force_original_aspect_ratio=increase,crop={W}:{H},"
                  f"boxblur=30:3,eq=brightness=-0.12:saturation=0.9[bgb];[fg]scale={W}:-2[fgs];"
                  f"[bgb][fgs]overlay=0:{fy}"]
        else:
            vf = [f"setpts=(PTS-STARTPTS)/{k:.4f}",
                  f"scale={W}:{H}:force_original_aspect_ratio=increase", f"crop={W}:{H}"]
        if e.get("blur"):
            vf += ["boxblur=22:2", "eq=brightness=-0.06:saturation=0.85"]
        vf += [f"fps={fps}", f"tpad=stop_mode=clone:stop_duration={D}", f"trim=duration={D}", "setsar=1"]
        af = ["asetpts=PTS-STARTPTS"] + ([f"atempo={k:.4f}"] if k != 1.0 else []) + \
             [f"volume={e.get('vol', 1.0)}", "apad", f"atrim=duration={D}"]   # per-segment footage level
        v = seg_dir / f"{i:02d}.mp4"; aw = seg_dir / f"{i:02d}.wav"
        src = str(project / e["clip"])
        subprocess.run(["ffmpeg", "-v", "error", "-y", "-ss", str(e["in"]), "-t", f"{take:.3f}", "-i", src,
                        "-vf", ",".join(vf), "-an", "-c:v", "libx264", "-preset", "veryfast", "-crf", "16",
                        "-pix_fmt", "yuv420p", str(v)], check=True)
        subprocess.run(["ffmpeg", "-v", "error", "-y", "-ss", str(e["in"]), "-t", f"{take:.3f}", "-i", src,
                        "-vn", "-af", ",".join(af), "-ar", "48000", "-ac", "2", str(aw)], check=True)
        vlist.append(v); alist.append(aw)
        print(f"[footage] {e['cue']:>8}: {Path(src).name} {e['in']}-{e['out']}s -> {D}s" + (f" (slow {k:.2f}x)" if k != 1 else ""))
    (seg_dir / "v.txt").write_text("".join(f"file '{p}'\n" for p in vlist))
    (seg_dir / "a.txt").write_text("".join(f"file '{p}'\n" for p in alist))
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-f", "concat", "-safe", "0", "-i", str(seg_dir / "v.txt"),
                    "-c", "copy", str(out / "base.mp4")], check=True)
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-f", "concat", "-safe", "0", "-i", str(seg_dir / "a.txt"),
                    str(out / "footage.wav")], check=True)
    print("[footage] wrote base.mp4 + footage.wav")


if __name__ == "__main__":
    main(sys.argv[1])
