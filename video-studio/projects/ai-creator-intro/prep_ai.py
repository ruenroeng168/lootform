#!/usr/bin/env python3
"""AI-voice version of the intro (preview): the creator's exact words read by Gemini TTS (voice closest to his,
chosen by F0/centroid), tone-matched, and the talking-head/b-roll pictures retimed caption by caption to the
new voice. Writes into out_ai/ (the real-voice edit in out/ is untouched); render with:
    node engine/render.mjs projects/ai-creator-intro --overlay --out=out_ai   (see README; we symlink)
"""
import json, subprocess, sys, importlib.util
from pathlib import Path
import numpy as np

HERE = Path(__file__).resolve().parent
ENG = HERE.parent.parent / "engine"; sys.path.insert(0, str(ENG))
spec = importlib.util.spec_from_file_location("prep", HERE / "prep.py"); P = importlib.util.module_from_spec(spec); spec.loader.exec_module(P)
import tts, synth as S  # noqa: E402

OUT = HERE.parent / "ai-creator-intro-aivoice" / "out"; SEG = OUT / "segs"; SEG.mkdir(parents=True, exist_ok=True)
W, H, FPS, END_CARD = P.W, P.H, P.FPS, P.END_CARD
VOICE = {"engine": "gemini", "model": "gemini-3.8-flash-tts", "voice": "Puck",
         "style": "A young Thai man in his late 20s talking straight to camera; calm, sincere, confident and firm; "
                  "natural conversational Thai, medium-low relaxed pitch, not announcer-like",
         "notes": "Read the paragraphs in order. After every paragraph stay completely silent for two full seconds before the next one."}
TONE = ("highpass=f=80,rubberband=pitch=0.93:formant=preserved,equalizer=f=160:t=q:w=1:g=1.5,highshelf=f=2600:g=-4,deesser=i=0.5:f=0.45,"
        "acompressor=threshold=-22dB:ratio=3:attack=5:release=130:makeup=2")
UNITS = [[0, 1], [2, 3], [4, 5, 6, 7], [8], [9, 10], [11], [12, 13], [14], [15, 16], [17, 18]]
GAP, BEAT = 0.16, 0.38
BEAT_BEFORE = {1, 3, 8, 9, 13, 14, 17}           # caption indices that get a dramatic beat before them
BROLL_CAPS = {9: "works", 10: "works", 13: "fail"}


def run(a): subprocess.run(["ffmpeg", "-v", "error", "-y"] + a, check=True)


def load(f):
    return np.frombuffer(subprocess.run(["ffmpeg", "-v", "error", "-i", str(f), "-ac", "1", "-ar", str(S.SR), "-f", "f32le", "-"],
                                        capture_output=True, check=True).stdout, np.float32).astype(np.float64)


def env_db(x, hop):
    return 20 * np.log10(np.array([np.sqrt(np.mean(x[k:k + hop] ** 2)) for k in range(0, len(x) - hop, hop)]) + 1e-9)


def silences(x, min_len=0.22):
    hop = int(S.SR * 0.01); db = np.convolve(env_db(x, hop), np.ones(3) / 3, "same"); thr = np.percentile(db, 95) - 30
    sil, out, k = db < thr, [], 0
    while k < len(sil):
        if sil[k]:
            j = k
            while j < len(sil) and sil[j]: j += 1
            if (j - k) * 0.01 >= min_len: out.append((k * 0.01, j * 0.01))
            k = j
        else: k += 1
    return out


def clip_dur(f):
    return float(subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", str(f)], capture_output=True, text=True).stdout)


CLIP_DUR = {f"c{i}": clip_dur(P.A / f"c{i}.mp4") for i in range(1, 6)}


def main():
    caps = P.CAPS
    texts = [c[3].replace("…", "").strip() for c in caps]
    wav = tts.synth("\n\n".join(texts), VOICE, OUT / "vo", None, print)
    x = load(wav)
    # 1–2) offline forced alignment (faster-whisper + script matching) -> one audio span per caption
    from align import align_lines
    spans = align_lines(wav, [c[3].replace("…", "") for c in caps])
    cap_audio = {ci: x[int(a * S.SR):int(b * S.SR)] for ci, (a, b) in enumerate(spans)}
    for ci, (a, b) in enumerate(spans):
        print(f"  {ci:2} {a:6.2f}-{b:6.2f} {caps[ci][3]}")
    bounds = []
    # 3) lay captions on the new timeline; retime each caption's picture to its voice length
    t, timeline, aud = 0.25, [], S.Track(200)
    for ci in range(len(caps)):
        if ci: t += BEAT if ci in BEAT_BEFORE else GAP
        clip = cap_audio[ci]; d = len(clip) / S.SR
        aud.add(t, clip); timeline.append((ci, round(t, 3), round(t + d, 3))); t += d
    total = t + 0.35 + END_CARD
    # video pieces: each caption window [start of this caption, start of next) shows its source span, speed-fitted
    segs, brolls = [], {}
    for k, (ci, s, e) in enumerate(timeline):
        nxt = timeline[k + 1][1] if k + 1 < len(timeline) else total
        if k == 0: s = 0.0
        D = round(nxt - s, 3)
        c, a, b, _ = caps[ci]
        span = max(0.3, b - a)
        z = next((p[3] for p in P.PIECES if p[0] == c and p[1] - 0.05 <= a <= p[2]), 1.0)
        # Real-time playback only (slow-motion duplicated every 3rd frame = judder, and a too-short span ended
        # in a frozen frame). If the voice runs longer than the spoken span, show neighbouring footage of the
        # same clip; slow down only if the whole clip is shorter than the window (never below 0.9x).
        cd = CLIP_DUR[c]
        a0 = a if a + D <= cd - 0.05 else max(0.0, cd - 0.05 - D)
        f = 1.0 if a0 + D <= cd - 0.05 else max(0.9, (cd - 0.05 - a0) / D)
        out = SEG / f"{k:02d}.mp4"
        vf = f"fps={FPS},setpts=(PTS-STARTPTS)/{f:.4f}," + P.speaker_vf(z, D)
        src = ["-ss", f"{a0:.3f}", "-t", f"{D * f + 0.1:.3f}", "-i", str(P.A / f"{c}.mp4")]
        br = BROLL_CAPS.get(ci)
        if not br:
            run(src + ["-vf", vf, "-an", "-c:v", "libx264", "-preset", "medium", "-crf", "17", "-pix_fmt", "yuv420p", str(out)])
        else:
            items = [(p, s0) for p, s0, _ in P.WORKS] if br == "works" else [P.FAIL]
            if br == "works":   # montage spread over both "works" captions
                w0 = [tt for cc, tt, _ in timeline if cc == 9][0]
                w1 = [timeline[j + 1][1] for j, (cc, _, _) in enumerate(timeline) if cc == 10][0]
                each = (w1 - w0) / len(items); first = int((s - w0) / each + 1e-6)
                sel = [(i2, items[i2]) for i2 in range(len(items)) if i2 * each < (nxt - w0) - 1e-3 and (i2 + 1) * each > (s - w0) + 1e-3]
                brolls.setdefault("works", [round(w0 + i2 * each, 3) for i2 in range(len(items) + 1)])
                parts = [(p, s0 + max(0, (s - w0) - i2 * each), min((i2 + 1) * each, nxt - w0) - max(i2 * each, s - w0)) for i2, (p, s0) in sel]
            else:
                brolls["fail"] = [s, nxt]; parts = [(items[0][0], items[0][1], D)]
            inputs, fc = [], []
            for j2, (p, s0, dd) in enumerate(parts):
                inputs += ["-ss", f"{s0:.3f}", "-t", f"{dd:.3f}", "-i", str(P.src_of(p))]
                fc.append(f"[{j2 + 1}:v]scale={W}:{H},setsar=1,fps={FPS},trim=duration={dd:.3f},setpts=PTS-STARTPTS[b{j2}]")
            fc.append("".join(f"[b{j2}]" for j2 in range(len(parts))) + f"concat=n={len(parts)}:v=1:a=0,trim=duration={D:.3f}[bb]")
            fc.append(f"[0:v]{vf},scale=344:612[sp]"); fc.append("[bb][sp]overlay=696:150[v]")
            run(src + inputs + ["-filter_complex", ";".join(fc), "-map", "[v]", "-an", "-c:v", "libx264", "-preset", "medium",
                                "-crf", "17", "-pix_fmt", "yuv420p", str(out)])
        segs.append(out)
    (SEG / "v.txt").write_text("".join(f"file '{s}'\n" for s in segs))
    run(["-f", "concat", "-safe", "0", "-i", str(SEG / "v.txt"), "-c", "copy", str(OUT / "base.mp4")])
    # voice track, tone-matched toward the phone-mic recording, normalised
    from scipy.io import wavfile
    raw = OUT / "vo_raw.wav"; wavfile.write(raw, S.SR, (np.clip(aud.buf[:int(total * S.SR)], -1, 1) * 32767).astype(np.int16))
    run(["-i", str(raw), "-af", TONE + ",loudnorm=I=-14:TP=-1.5:LRA=5", "-ar", "48000", "-ac", "2", str(OUT / "footage.wav")])
    # captions + events on the new timeline
    tmap = {ci: (s, e) for ci, s, e in timeline}
    capsout = [[tmap[i][0], tmap[i][1], caps[i][3]] for i in range(len(caps))]
    def m(c, xs):
        best = None
        for i, (cc, a, b, _) in enumerate(caps):
            if cc == c and a - 0.3 <= xs <= b + 0.05:
                s, e = tmap[i]; best = round(s + (e - s) * min(1, max(0, (xs - a) / max(0.01, b - a))), 3); break
        return best if best is not None else round(next(tmap[i][0] for i, (cc, a, b, _) in enumerate(caps) if cc == c and a >= xs), 3)
    ev = {k: m(c, v) for k, (c, v) in P.EVENTS.items()}
    ev["works"] = brolls["works"][0]; ev["fail"] = brolls["fail"][0]; ev["end"] = round(total - END_CARD, 3)
    zooms = [[s, 1.0] for _, s, _ in timeline]
    tl = {"width": W, "height": H, "fps": FPS, "frames": int(round(total * FPS)), "duration": round(total, 3), "cues": {},
          "data": {"captions": capsout, "ev": ev, "brolls": brolls, "works": [w[2] for w in P.WORKS], "zooms": zooms, "ai_voice": True}}
    (OUT / "timeline.json").write_text(json.dumps(tl, ensure_ascii=False))
    sp = importlib.util.spec_from_file_location("score", HERE / "score.py"); sc = importlib.util.module_from_spec(sp); sp.loader.exec_module(sc)
    music, fx = sc.build(total, ev, brolls)
    vo = load(OUT / "footage.wav"); tr = S.Track(total); tr.add(0, vo)
    duck = np.clip(S.follower(tr.buf, 0.02, 0.35) / 0.08, 0, 1)
    mix = music * (1 - 0.7 * duck) + fx
    wavfile.write(OUT / "mix.wav", S.SR, (np.clip(np.stack([mix, mix], 1), -1, 1) * 32767).astype(np.int16))
    print(f"[prep_ai] {total:.2f}s, {len(timeline)} captions")


if __name__ == "__main__":
    main()
