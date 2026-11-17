#!/usr/bin/env python3
"""ทางหลวง FC vs AIA (สนามกองบิน 21, อุบลฯ) post-match atmosphere clip: sports-commentator narration (Puck, out/n),
the team's night clips (assets/c1..c6.mp4, 448x960), a set-by-set scoreboard (2-1, 1-1, 0-1, 5-1), the team's
real "Happy Birthday" singing as the closer, summary + logo end card.

Writes out/base.mp4, out/footage.wav (voice + live sound), out/mix.wav, out/timeline.json, then
    node engine/render.mjs projects/highway-aia --overlay --footage-vol=1
"""
import json, subprocess, sys, importlib.util
from pathlib import Path
import numpy as np, cv2

HERE = Path(__file__).resolve().parent; OUT = HERE / "out"; A = HERE / "assets"
sys.path.insert(0, str(HERE.parent.parent / "engine"))
import synth as S  # noqa: E402

W, H, FPS = 1080, 1920, 30
GRADE = "hqdn3d=4:3:6:4,eq=gamma=1.12:contrast=1.1:saturation=1.25,colorbalance=rs=0.03:bs=-0.02,unsharp=5:5:0.8"
NARR = "highpass=f=80,equalizer=f=3000:t=q:w=1:g=1.5,acompressor=threshold=-20dB:ratio=3:makeup=2,loudnorm=I=-15:TP=-1.5:LRA=6"
LIVE = "highpass=f=100,loudnorm=I=-20:TP=-2"
LIVE_TALK = "highpass=f=90,afftdn=nr=10:nf=-40,equalizer=f=3000:t=q:w=1:g=4,acompressor=threshold=-22dB:ratio=3:makeup=2,loudnorm=I=-15:TP=-1.5"
SHOW = {"intro": "ทางหลวง FC ปะทะ AIA ที่สนามกองบิน 21 อุบลฯ", "s1": "เซ็ตแรก ทางหลวงเปิดหัว ชนะ 2-1", "s2": "เซ็ตสอง สูสี เสมอ 1-1",
        "s3": "เซ็ตสาม โดน AIA แซงไป 0-1", "s4": "แต่เซ็ตสุดท้าย… ทางหลวงจัดหนัก 5-1!", "end": "ขอบคุณทีม AIA สำหรับเกมสนุก ๆ แล้วเจอกันนัดหน้า!"}
SCORES = [("s1", 2, 1), ("s2", 1, 1), ("s3", 0, 1), ("s4", 5, 1)]
# Segments.  narr: (key, [(clip, src start, src dur)], live gain under voice, extra s after the line, live gain in extra)
#            live: interview / chatter with its own sound, captions in source seconds, optional freeze + label
PLAN = [
    ("live", "c6", 8.84, 11.1, [(8.84, 10.4, "กองกลางไม่แทงให้แบ็คซ้ายเลยครับ", "a"), (10.4, 11.1, "เลยไม่ค่อยเหนื่อย", "a")],
     {"pre": "cold", "freeze": 0.9, "label": "แบ็คซ้ายสายชิล 😎"}),
    ("narr", "hook", [("c2", 0.0, 5.6)], 0.25, 0.25, 0.25),
    ("narr", "intro", [("c1", 0.3, 4.6)], 0.25, 0.2, 0.25),
    ("narr", "s1", [("c2", 4.5, 2.6)], 0.25, 0.3, 0.25),
    ("narr", "s2", [("c5", 0.2, 3.0)], 0.25, 0.3, 0.25),
    ("narr", "s3", [("c4", 0.0, 3.2)], 0.25, 0.3, 0.25),
    ("narr", "s4", [("c3", 13.0, 5.0)], 0.25, 1.9, 0.4),
    ("narr", "post", [("c4", 3.3, 3.0)], 0.2, 0.25, 0.2),
    ("live", "c2", 0.0, 5.4, [(0.0, 1.68, "ความรู้สึกสำหรับเซ็ตแรกวันนี้?", "q"), (1.68, 2.7, "สุดยอดเลย!", "a"), (4.44, 5.4, "เฮ้ย!", "a")],
     {"sticker": [2.7, "ป๊อกแป๊ก ป๊อกแป๊ก 🤟"]}),
    ("live", "c6", 0.3, 11.1, [(0.3, 4.08, "ความรู้สึกเซ็ตแรก เป็นไง?", "q"), (5.92, 8.84, "กำลังดีครับ", "a"),
                               (8.84, 10.4, "กองกลางไม่แทงให้แบ็คซ้ายเลยครับ", "a"), (10.4, 11.1, "เลยไม่ค่อยเหนื่อย", "a")],
     {"freeze": 1.0, "label": "แบ็คซ้ายสายชิล 😎"}),
    ("live", "c4", 0.0, 7.4, [(0.0, 1.6, "วันนี้ยิงกี่ลูก?", "q")], {"sticker": [1.8, "ตอบไม่ได้ หัวเราะอย่างเดียว 😂"]}),
    ("live", "c1", 0.88, 6.4, [(0.88, 3.36, "อะไร ๆ คุณเนี่ย", "q"), (3.36, 6.34, "เดี๋ยวผมเอาคลิปคุณลงอีกครับ", "q")],
     {"label": "โดนขู่ลงคลิป 📱"}),
    ("narr", "abs", [("c5", 3.0, 5.0)], 0.4, 2.2, 0.6),
    ("narr", "bday", [("c3", 1.0, 10.5)], 0.35, 7.4, 1.0),
    ("narr", "end", [("c2", 4.5, 2.6)], 0.2, 1.0, 0.0)]



def sm(u): u = min(1.0, max(0.0, u)); return u * u * (3 - 2 * u)


def load_audio(f, af=None, ss=None, t=None):
    cmd = ["ffmpeg", "-v", "error"] + (["-ss", str(ss)] if ss is not None else []) + (["-t", str(t)] if t else []) + ["-i", str(f)] + \
          (["-af", af] if af else []) + ["-ac", "1", "-ar", str(S.SR), "-f", "f32le", "-"]
    return np.frombuffer(subprocess.run(cmd, capture_output=True, check=True).stdout, np.float32).astype(np.float64)


def frames(clip, a, d, out_d):
    """d seconds of source from a, fitted (time-stretched) to out_d seconds."""
    n = int(round(out_d * FPS)); f = out_d / d
    p = subprocess.run(["ffmpeg", "-v", "error", "-ss", f"{a:.3f}", "-t", f"{d + 0.1:.3f}", "-i", str(A / f"{clip}.mp4"),
                        "-vf", f"setpts={f:.4f}*PTS,fps={FPS},scale={W}:-2:flags=lanczos,crop={W}:{H}:0:(ih-{H})*0.35,setsar=1,{GRADE}",
                        "-f", "rawvideo", "-pix_fmt", "bgr24", "-"], capture_output=True, check=True).stdout
    fr = np.frombuffer(p, np.uint8).reshape(-1, H, W, 3)
    return [fr[min(i, len(fr) - 1)] for i in range(n)]


def zoom(img, z):
    if abs(z - 1) < 1e-3: return img
    M = np.float32([[z, 0, 540 - z * 540], [0, z, 800 - z * 800]])
    return cv2.warpAffine(img, M, (W, H), flags=cv2.INTER_LINEAR, borderMode=cv2.BORDER_REFLECT)


def main():
    OUT.mkdir(exist_ok=True)
    N = json.loads((HERE / "narr.json").read_text()); keys = [k for k, _ in N]; text = dict(N)
    nwav = next((OUT / "n").glob("*.wav")); na = load_audio(nwav, NARR); spans = json.loads((OUT / "n" / "spans.json").read_text())
    ncl = {}
    N2 = json.loads((HERE / "narr2.json").read_text()); text.update(dict(N2))
    na2 = load_audio(next((OUT / "n2").glob("*.wav")), NARR); sp2 = json.loads((OUT / "n2" / "spans.json").read_text())
    for k, (a, b) in zip([k for k, _ in N2], sp2):
        c = na2[int(max(0, a - 0.03) * S.SR):int((b + 0.12) * S.SR)]; m = np.arange(len(c))
        ncl[k] = c * np.minimum(1, np.minimum(m / 300, (len(c) - m) / 1200))
    for k, (a, b) in zip(keys, spans):
        c = na[int(max(0, a - 0.03) * S.SR):int((b + 0.12) * S.SR)]; m = np.arange(len(c))
        ncl[k] = c * np.minimum(1, np.minimum(m / 300, (len(c) - m) / 1200))
    enc = subprocess.Popen(["ffmpeg", "-v", "error", "-y", "-f", "rawvideo", "-pix_fmt", "bgr24", "-s", f"{W}x{H}", "-r", str(FPS), "-i", "-",
                            "-c:v", "libx264", "-preset", "medium", "-crf", "17", "-pix_fmt", "yuv420p", str(OUT / "base.mp4")], stdin=subprocess.PIPE)
    voice, live = S.Track(200), S.Track(200); nfr = 0; D = {"segs": {}, "caps": [], "lcaps": [], "labels": [], "stickers": [], "freezes": [], "live": []}
    for si, item in enumerate(PLAN):
        if item[0] == "live":
            _, clip, a0, b0, lc, opt = item; t0 = nfr / FPS
            if opt.get("pre"):                                     # host question first, over the first frame
                c = ncl[opt["pre"]]; vd = len(c) / S.SR; voice.add(t0 + 0.1, c)
                D["caps"].append([round(t0 + 0.1, 3), round(t0 + 0.1 + vd, 3), text[opt["pre"]]])
                f0 = frames(clip, a0, 0.05, 0.05)[0]
                for j in range(int(round((vd + 0.3) * FPS))): enc.stdin.write(zoom(f0, 1.0 + 0.04 * j / ((vd + 0.3) * FPS)).tobytes()); nfr += 1
                t0 = nfr / FPS
            d = b0 - a0; fr = frames(clip, a0, d, d)
            for j, f in enumerate(fr): enc.stdin.write(zoom(f, 1.0 + 0.06 * (1 - sm(j / 8)) + 0.05 * j / len(fr)).tobytes()); nfr += 1
            la = load_audio(A / f"{clip}.mp4", LIVE_TALK, a0, d); m = np.arange(len(la))
            live.add(t0, la * np.minimum(1, np.minimum(m / 400, (len(la) - m) / 800)))
            for c0, c1, tx, who in lc: D["lcaps"].append([round(t0 + c0 - a0, 3), round(t0 + c1 - a0, 3), tx, who])
            if opt.get("sticker"): D["stickers"].append([round(t0 + opt["sticker"][0], 3), round(t0 + d, 3), opt["sticker"][1]])
            t1 = nfr / FPS; D["live"].append([round(t0, 3), round(t1, 3)])
            if opt.get("freeze"):
                fz = opt["freeze"]; D["freezes"].append([round(t1, 3), round(t1 + fz, 3)])
                if opt.get("label"): D["labels"].append([round(t1, 3), round(t1 + fz, 3), opt["label"]])
                g = cv2.cvtColor(cv2.cvtColor(fr[-1], cv2.COLOR_BGR2GRAY), cv2.COLOR_GRAY2BGR)
                for j in range(int(round(fz * FPS))): enc.stdin.write(zoom(g, 1.15 + 0.05 * j / (fz * FPS)).tobytes()); nfr += 1
            elif opt.get("label"): D["labels"].append([round(t0 + 0.4, 3), round(t1, 3), opt["label"]])
            continue
        k, pieces, g_under, extra, g_extra = item[1:]
        t0 = nfr / FPS; c = ncl[k]; vd = len(c) / S.SR; seg_d = 0.15 + vd + extra
        voice.add(t0 + 0.15, c); D["caps"].append([round(t0 + 0.15, 3), round(t0 + 0.15 + vd, 3), SHOW.get(k, text[k])])
        D["segs"][k] = [round(t0, 3), round(t0 + seg_d, 3)]
        tot_src = sum(p[2] for p in pieces); written = 0
        for pi, (clip, a, d) in enumerate(pieces):
            out_d = seg_d * d / tot_src
            fr = frames(clip, a, d, out_d)
            for j, f in enumerate(fr):
                punch = 0.06 * (1 - sm(j / 8)) if si else 0
                f = zoom(f, 1.0 + punch + 0.04 * j / len(fr)); enc.stdin.write(f.tobytes()); nfr += 1
            la = load_audio(A / f"{clip}.mp4", LIVE, a, d)
            stretch = out_d / d
            if abs(stretch - 1) > 0.02:                           # keep the live sound in sync by resampling crudely
                idx = np.clip((np.arange(int(len(la) * stretch)) / stretch).astype(int), 0, len(la) - 1); la = la[idx]
            ts = t0 + written; tl = np.arange(len(la)) / S.SR + ts
            gain = np.where(tl < t0 + 0.15 + vd + 0.2, g_under, g_extra)
            m = np.arange(len(la)); fade = np.minimum(1, np.minimum(m / 800, (len(la) - m) / 800))
            live.add(ts, la * gain * fade); written += out_d
    t_end = nfr / FPS
    end_card = 3.0
    for j in range(int(end_card * FPS)): enc.stdin.write(np.zeros((H, W, 3), np.uint8).tobytes()); nfr += 1
    enc.stdin.close(); enc.wait()
    total = nfr / FPS; D["end"] = round(D["segs"]["end"][0] + 0.15 + len(ncl["end"]) / S.SR + 0.3, 3); D["blackout"] = round(t_end, 3)
    D["scores"] = [[D["segs"][k][0] + 0.15, k, a, b] for k, a, b in SCORES]
    D["images"] = {"logo": "assets/logo.jpg"}
    vo = voice.buf[:int(total * S.SR)] + live.buf[:int(total * S.SR)]
    from scipy.io import wavfile
    wavfile.write(OUT / "footage.wav", S.SR, (np.clip(np.stack([vo, vo], 1), -1, 1) * 32767).astype(np.int16))
    spec = importlib.util.spec_from_file_location("score", HERE / "score.py"); sc = importlib.util.module_from_spec(spec); spec.loader.exec_module(sc)
    music, fx = sc.build(total, D)
    duck = np.clip(S.follower(voice.buf[:int(total * S.SR)], 0.02, 0.3) / 0.08, 0, 1)
    for a, b in D["live"]: duck[int(a * S.SR):int(b * S.SR)] = np.maximum(duck[int(a * S.SR):int(b * S.SR)], 0.85)
    mix = music[:len(vo)] * (1 - 0.65 * duck) + fx[:len(vo)]
    wavfile.write(OUT / "mix.wav", S.SR, (np.clip(np.stack([mix, mix], 1), -1, 1) * 32767).astype(np.int16))
    (OUT / "timeline.json").write_text(json.dumps({"width": W, "height": H, "fps": FPS, "frames": nfr, "duration": round(total, 3), "cues": {}, "data": D}, ensure_ascii=False))
    print(f"[prep] {total:.2f}s; {D['segs']}")


if __name__ == "__main__":
    main()
