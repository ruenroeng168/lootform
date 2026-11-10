#!/usr/bin/env python3
"""AI-creator intro: cut the 5 talking-head clips into a tight edit (dead air removed, alternating
"two-camera" zooms, punch-ins), insert real portfolio b-roll with the speaker as an inset, clean the voice,
then write out/base.mp4, out/footage.wav, out/mix.wav and out/timeline.json for render.mjs --overlay.

Pieces are (clip, in, out, zoom[, extra]); captions/events are given in SOURCE time (clip, t) and mapped.
"""
import json, subprocess, sys
from pathlib import Path
import numpy as np

HERE = Path(__file__).resolve().parent
A, OUT = HERE / "assets", HERE / "out"; SEG = OUT / "segs"; SEG.mkdir(parents=True, exist_ok=True)
PROJ = HERE.parent
sys.path.insert(0, str(PROJ.parent / "engine"))
import synth as S  # noqa: E402

W, H, FPS = 1080, 1920, 30
END_CARD = 2.6

# (clip, in, out, zoom, broll)   zoom: 1.0 wide / 1.12 medium / 1.25 close
PIECES = [
    ("c1", 1.05, 3.20, 1.00, None),
    ("c1", 3.20, 4.85, 1.24, None),          # "ไม่ใช่คนที่เก่ง AI" — closer
    ("c2", 1.05, 2.46, 1.00, None),
    ("c2", 2.46, 3.95, 1.30, None),          # punch-in: "และดันขยันด้วย"
    ("c3", 0.62, 2.80, 1.00, None),
    ("c3", 3.40, 7.05, 1.12, None),          # roles
    ("c3", 7.80, 8.70, 1.25, None),          # "แต่ตอนนี้"
    ("c3", 9.45, 14.80, 1.00, "works"),      # b-roll montage of real AI-made work
    ("c4", 0.70, 3.30, 1.12, None),
    ("c4", 5.80, 6.55, 1.00, None),
    ("c4", 6.55, 8.25, 1.00, "fail"),        # "ทำให้งานผมพัง" — the comic test that failed
    ("c5", 1.00, 3.35, 1.12, None),
    ("c5", 4.25, 8.10, 1.00, None),
    ("c5", 8.55, 11.55, 1.20, None),
]
WORKS = [  # (project, start s) — clips we made together with AI tools
    ("fathers-watch", 57.5, "นาฬิกาของพ่อ · ภาพวาด AI + เสียงพากย์ AI"),
    ("mod-49", 2.0, "มด เบอร์ 49 · การ์ตูนล้อเลียนทีม"),
    ("osuka-ochd804", 15.5, "รีวิวสว่าน · ตัดต่อ + กราฟิก"),
    ("highway-fc", 1.0, "ทางหลวง FC · โลโก้ + ผลการแข่งขัน"),
]
FAIL = ("sample-comic-dorgu", 3.6)
CAPS = [  # (clip, start, end, text)
    ("c1", 1.10, 3.20, "ผมว่าคนที่น่ากลัวที่สุดในยุคนี้"),
    ("c1", 3.20, 4.80, "ไม่ใช่คนที่เก่ง AI นะครับ"),
    ("c2", 1.10, 2.46, "แต่เป็นคนที่ใช้ AI เป็น"),
    ("c2", 2.46, 3.90, "และดันขยันด้วย"),
    ("c3", 0.70, 2.80, "เมื่อก่อน อยากทำคลิป ต้องมีคน…"),
    ("c3", 3.45, 4.60, "คนเขียนบท"), ("c3", 4.80, 5.80, "คนตัดต่อ"), ("c3", 6.10, 7.05, "คนทำภาพ"),
    ("c3", 7.85, 8.70, "แต่ตอนนี้…"),
    ("c3", 9.50, 11.10, "ผมใช้ AI ช่วยทำงานพวกนี้"),
    ("c3", 11.10, 14.75, "แล้วมาดูกันว่ามันทำงานให้ผมจริงได้แค่ไหนนะครับ"),
    ("c4", 0.80, 3.25, "ผมไม่ได้บอกว่า AI มันทำได้ทุกอย่างนะครับ"),
    ("c4", 5.85, 6.55, "เพราะบางอย่าง…"),
    ("c4", 6.55, 8.20, "มันก็ทำให้งานผมพังได้เหมือนกัน"),
    ("c5", 1.05, 3.30, "ช่องนี้ผมจะลองของจริงให้คุณดู"),
    ("c5", 4.30, 6.15, "แล้วมาดูกันว่า AI จะทำให้ธุรกิจเรา"),
    ("c5", 6.15, 8.05, "เวิร์ก หรือไม่เวิร์กนะครับ"),
    ("c5", 8.60, 10.32, "อย่าลืมกดติดตามไว้ด้วย"),
    ("c5", 10.32, 11.50, "แล้วมาลองไปด้วยกัน"),
]
EVENTS = {  # name: (clip, t)
    "hook": ("c1", 1.10), "notAI": ("c1", 3.20), "diligent": ("c2", 2.46),
    "role1": ("c3", 3.45), "role2": ("c3", 4.80), "role3": ("c3", 6.10), "now": ("c3", 7.85), "works": ("c3", 9.45),
    "honest": ("c4", 0.80), "fail": ("c4", 6.55), "real": ("c5", 1.05),
    "work_ok": ("c5", 6.20), "work_no": ("c5", 6.95), "follow": ("c5", 8.60), "together": ("c5", 10.32),
}
GRADE = ("hqdn3d=4:3:6:4,colorbalance=rs=-0.02:gs=-0.02:bs=0.05:rm=0.02:bm=0.02,"
         "eq=gamma=1.28:contrast=1.08:saturation=1.12:brightness=0.02,unsharp=5:5:0.6")


def run(a): subprocess.run(["ffmpeg", "-v", "error", "-y"] + a, check=True)


def speaker_vf(z, d):
    # cover-fit, then zoom around the face (face sits ~32% from the top)
    zw, zh = int(W * z) // 2 * 2, int(H * z) // 2 * 2
    x, y = (zw - W) // 2, int((zh - H) * 0.30)
    return (f"scale={zw}:{zh}:force_original_aspect_ratio=increase,crop={W}:{H}:{x}:{y},setsar=1,{GRADE},"
            f"fps={FPS},tpad=stop_mode=clone:stop_duration=1,trim=duration={d:.3f}")


def src_of(proj):
    for n in ("video_post.mp4", "video_small.mp4", "video.mp4"):
        if (PROJ / proj / "out" / n).exists():
            return PROJ / proj / "out" / n


def main():
    starts, t, segs = [], 0.0, []
    brolls = {}
    for i, (c, a, b, z, br) in enumerate(PIECES):
        d = round(b - a, 3); last = i == len(PIECES) - 1
        dd = d + (END_CARD if last else 0)
        out = SEG / f"{i:02d}.mp4"
        src = ["-ss", f"{a}", "-t", f"{d}", "-i", str(A / f"{c}.mp4")]
        if br is None:
            run(src + ["-vf", speaker_vf(z, dd), "-an", "-c:v", "libx264", "-preset", "medium", "-crf", "17", "-pix_fmt", "yuv420p", str(out)])
        else:
            items = [(p, s) for p, s, _ in WORKS] if br == "works" else [FAIL]
            each = d / len(items)
            inputs, fc = [], []
            for k, (p, s) in enumerate(items):
                inputs += ["-ss", f"{s}", "-t", f"{each:.3f}", "-i", str(src_of(p))]
                fc.append(f"[{k + 1}:v]scale={W}:{H},setsar=1,fps={FPS},trim=duration={each:.3f},setpts=PTS-STARTPTS[b{k}]")
            fc.append("".join(f"[b{k}]" for k in range(len(items))) + f"concat=n={len(items)}:v=1:a=0[bb]")
            fc.append(f"[0:v]{speaker_vf(1.0, d)},scale=344:612[sp]")
            fc.append("[bb][sp]overlay=696:150[v]")
            run(src + inputs + ["-filter_complex", ";".join(fc), "-map", "[v]", "-an", "-c:v", "libx264", "-preset", "medium",
                                "-crf", "17", "-pix_fmt", "yuv420p", str(out)])
            brolls[br] = [round(t + k * each, 3) for k in range(len(items) + 1)]
        starts.append(t); segs.append(out); t += d
    total = t + END_CARD
    (SEG / "v.txt").write_text("".join(f"file '{s}'\n" for s in segs))
    run(["-f", "concat", "-safe", "0", "-i", str(SEG / "v.txt"), "-c", "copy", str(OUT / "base.mp4")])

    # voice: concat source audio pieces with tiny fades, then clean once
    aw = []
    for i, (c, a, b, z, br) in enumerate(PIECES):
        f = SEG / f"{i:02d}.wav"; d = b - a
        run(["-ss", f"{a}", "-t", f"{d}", "-i", str(A / f"{c}.mp4"), "-vn", "-ac", "1", "-ar", "48000",
             "-af", f"afade=t=in:d=0.02,afade=t=out:st={d - 0.03:.3f}:d=0.03", str(f)])
        aw.append(f)
    (SEG / "a.txt").write_text("".join(f"file '{s}'\n" for s in aw))
    run(["-f", "concat", "-safe", "0", "-i", str(SEG / "a.txt"), "-af",
         "highpass=f=90,adeclip,afftdn=nf=-28,equalizer=f=3000:t=q:w=1:g=2.5,"
         "acompressor=threshold=-20dB:ratio=3.5:attack=5:release=150,loudnorm=I=-15:TP=-2:LRA=6,apad",
         "-t", f"{total:.3f}", "-ac", "2", str(OUT / "footage.wav")])

    def m(c, x):  # source time -> output time
        for (pc, a, b, *_), s in zip(PIECES, starts):
            if pc == c and a - 0.05 <= x <= b + 0.05:
                return round(s + max(0, x - a), 3)
        for (pc, a, b, *_), s in zip(PIECES, starts):   # nearest piece of that clip
            if pc == c and x < a:
                return round(s, 3)
        raise ValueError((c, x))
    caps = [[m(c, s), m(c, e), txt] for c, s, e, txt in CAPS]
    ev = {k: m(c, x) for k, (c, x) in EVENTS.items()}
    ev["end"] = round(t, 3)
    tl = {"width": W, "height": H, "fps": FPS, "frames": int(round(total * FPS)), "duration": round(total, 3), "cues": {},
          "data": {"captions": caps, "ev": ev, "brolls": brolls, "works": [w[2] for w in WORKS],
                   "zooms": [[s, p[3]] for s, p in zip(starts, PIECES)]}}
    (OUT / "timeline.json").write_text(json.dumps(tl, ensure_ascii=False))

    # music + sfx
    import importlib.util
    sp = importlib.util.spec_from_file_location("score", HERE / "score.py"); sc = importlib.util.module_from_spec(sp); sp.loader.exec_module(sc)
    music, fx = sc.build(total, ev, brolls)
    vo = S.Track(total)
    v = subprocess.run(["ffmpeg", "-v", "error", "-i", str(OUT / "footage.wav"), "-ac", "1", "-ar", str(S.SR), "-f", "f32le", "-"], capture_output=True, check=True).stdout
    vo.add(0, np.frombuffer(v, np.float32).astype(np.float64))
    duck = np.clip(S.follower(vo.buf, 0.02, 0.35) / 0.08, 0, 1)
    mix = music * (1 - 0.7 * duck) + fx
    from scipy.io import wavfile
    wavfile.write(OUT / "mix.wav", S.SR, (np.clip(np.stack([mix, mix], 1), -1, 1) * 32767).astype(np.int16))
    print(f"[prep] {len(PIECES)} pieces, {total:.2f}s; events", ev)


if __name__ == "__main__":
    main()
