#!/usr/bin/env python3
"""LOOTFORM video studio — end-to-end build.

    python3 video-studio/engine/build.py video-studio/projects/<name> [--audio-only] [--stills] [--frames=a-b]

Pipeline:
  1. Voice-over per line (Gemini TTS, or Piper offline), cached
  2. Timeline: line cues + in-line marks ("|" in the text) snapped to speech pauses
  3. Scene events (when the pen draws, transitions...) exported from scene.js
  4. Score (project score.py): music bed + SFX, ducked under the voice
  5. Lip-sync curve, then frame render in headless Chromium -> H.264 + AAC MP4
"""
import importlib.util
import inspect
import json
import subprocess
import sys
from pathlib import Path

import numpy as np

sys.path.insert(0, str(Path(__file__).parent))
import synth as S  # noqa: E402
import tts  # noqa: E402

ENGINE = Path(__file__).parent
STUDIO = ENGINE.parent


def log(*a):
    print("[studio]", *a, flush=True)


def piper_model(name):
    p = STUDIO / "voices" / f"{name}.onnx"
    if not p.exists():
        p.parent.mkdir(exist_ok=True)
        lang, speaker, quality = name.split("-")
        base = ("https://huggingface.co/rhasspy/piper-voices/resolve/main/"
                f"{lang.split('_')[0]}/{lang}/{speaker}/{quality}/{name}")
        for ext in (".onnx", ".onnx.json"):
            log("downloading voice", name + ext)
            subprocess.run(["curl", "-sSfL", "-o", str(p.parent / (name + ext)), base + ext], check=True)
    return p


def load_audio(path):
    r = subprocess.run(["ffmpeg", "-v", "error", "-i", str(path), "-f", "f32le", "-ac", "1",
                        "-ar", str(S.SR), "-"], capture_output=True, check=True)
    return np.frombuffer(r.stdout, dtype=np.float32).astype(np.float64)


def write_wav(path, x):
    pcm = (np.clip(x, -1, 1) * 32767).astype("<i2").tobytes()
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-f", "s16le", "-ar", str(S.SR), "-ac", "1",
                    "-i", "-", str(path)], input=pcm, check=True)


def trim(x, thr=0.008, pad=0.04):
    idx = np.where(np.abs(x) > thr)[0]
    if not len(idx):
        return x
    p = int(pad * S.SR)
    return x[max(0, idx[0] - p): idx[-1] + p]


def process_voice(x, engine, gain=1.0):
    x = S.highpass(x, 75)
    if engine == "piper":
        x = x / (np.max(np.abs(x)) + 1e-9) * 0.8
        return S.softclip(x * 1.6, 1.2) * 0.85 * gain
    rms = np.sqrt(np.mean(x[np.abs(x) > 0.01] ** 2)) + 1e-9   # loudness-match lines
    return S.softclip(x * (0.16 / rms), 1.0) * 0.9 * gain


def marks_for(parts, x, start):
    """Place in-line marks proportionally to text length, snapped to the nearest pause."""
    lens = [len(p.replace(" ", "")) for p in parts]
    total, dur = sum(lens), len(x) / S.SR
    win = int(0.03 * S.SR)
    env = np.sqrt(np.convolve(x ** 2, np.ones(win) / win, mode="same"))
    marks, acc = [], 0
    for L in lens[:-1]:
        acc += L
        est = acc / total * dur
        lo, hi = int(max(0, est - 0.45) * S.SR), int(min(dur, est + 0.45) * S.SR)
        seg = env[lo:hi]
        if len(seg):
            # prefer quiet spots close to the estimate
            dist = np.abs(np.arange(lo, hi) / S.SR - est)
            est = (lo + int(np.argmin(seg / (seg.max() + 1e-9) + dist * 0.6))) / S.SR
        marks.append(round(start + est, 3))
    return marks


def main(project):
    project = Path(project).resolve()
    spec = json.loads((project / "script.json").read_text())
    out = project / "out"
    out.mkdir(parents=True, exist_ok=True)
    fps = spec["fps"]
    base_voice = spec.get("tts") or {"engine": "piper", "voice": spec.get("voice", "th_TH-tsync2-medium")}
    if any(a.startswith("--engine=") for a in sys.argv):  # e.g. --engine=piper for offline previews
        eng = [a for a in sys.argv if a.startswith("--engine=")][0][9:]
        base_voice = {"engine": eng, "voice": "th_TH-tsync2-medium"} if eng == "piper" else {**base_voice, "engine": eng}
        for ln in spec["lines"]:
            ln.pop("voice", None); ln.pop("engine", None)
    pmodel = piper_model(base_voice["voice"]) if base_voice.get("engine", "piper") == "piper" else None

    # 1–2. voice-over + timeline -------------------------------------------
    clips, cues, t = [], {}, 0.0
    for ln in spec["lines"]:
        cfg = {**base_voice, **{k: ln[k] for k in ("voice", "style", "engine", "speed") if k in ln}}
        parts = [p.strip() for p in ln["text"].split("|")]
        spoken = " ".join(parts)
        wav = tts.synth(spoken, cfg, out / "vo", pmodel, log)
        x = process_voice(trim(load_audio(wav)), cfg.get("engine", "piper"), ln.get("gain", 1.0))
        start = ln["at"] if "at" in ln else t + ln.get("gap", 0.3)
        end = start + len(x) / S.SR
        cues[ln["cue"]] = {"start": round(start, 3), "end": round(end, 3),
                           "marks": marks_for(parts, x, start) if len(parts) > 1 else [], "parts": parts}
        clips.append((start, x))
        t = end + ln.get("hold", 0)
        cues[ln["cue"]]["hold_end"] = round(t, 3)
    duration = t + spec.get("tail", 3.0)

    captions, cur = [], None
    for ln in spec["lines"]:
        c = cues[ln["cue"]]
        if "caption" in ln:
            cur = {"text": ln["caption"], "start": c["start"] - 0.1, "end": c["end"] + 0.35}
            captions.append(cur)
        elif cur:
            cur["end"] = c["end"] + 0.35

    vo = S.Track(duration)
    for st, x in clips:
        vo.add(st, x)

    # lip-sync curve -------------------------------------------------------
    spf = S.SR // fps
    frames = int(np.ceil(duration * fps))
    v = vo.buf[: frames * spf]
    v = np.pad(v, (0, frames * spf - len(v)))
    rms = np.sqrt((v.reshape(frames, spf) ** 2).mean(axis=1))
    rms = np.clip(rms / (np.percentile(rms[rms > 1e-3], 90) + 1e-9), 0, 1) ** 0.7
    mouth = np.convolve(rms, [0.25, 0.5, 0.25], mode="same")

    timeline = {"fps": fps, "width": spec["width"], "height": spec["height"],
                "duration": round(duration, 3), "frames": frames, "cues": cues,
                "captions": captions, "mouth": [round(float(m), 3) for m in mouth]}
    (out / "timeline.json").write_text(json.dumps(timeline, ensure_ascii=False, indent=1))
    log(f"timeline: {duration:.2f}s, {frames} frames")

    # 3. scene events (pen strokes etc.) ----------------------------------
    subprocess.run(["node", str(ENGINE / "render.mjs"), str(project), "--events"], check=True)
    events = json.loads((out / "events.json").read_text())

    # 4. score -------------------------------------------------------------
    sspec = importlib.util.spec_from_file_location("score", project / "score.py")
    score = importlib.util.module_from_spec(sspec)
    sspec.loader.exec_module(score)
    log("scoring music + sfx")
    kw = {"events": events} if "events" in inspect.signature(score.build).parameters else {}
    music, sfx = score.build(cues, duration, spec, **kw)

    duck = np.clip(S.follower(vo.buf, 0.02, 0.35) / 0.12, 0, 1)
    mix = music * (1 - spec.get("duck", 0.6) * duck) + sfx + vo.buf
    mix = S.softclip(mix * 0.9, 1.1)
    n = int(duration * S.SR)
    write_wav(out / "mix_raw.wav", mix[:n])
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", str(out / "mix_raw.wav"),
                    "-af", "loudnorm=I=-14:TP=-1.5:LRA=11", "-ar", "48000", "-ac", "2",
                    str(out / "mix.wav")], check=True)
    write_wav(out / "vo_only.wav", vo.buf[:n])

    # 5. render + mux ------------------------------------------------------
    if "--audio-only" in sys.argv:
        return
    extra = [a for a in sys.argv[2:] if a.startswith("--frames=") or a == "--stills"]
    subprocess.run(["node", str(ENGINE / "render.mjs"), str(project), *extra], check=True)


if __name__ == "__main__":
    main(sys.argv[1] if len(sys.argv) > 1 else STUDIO / "projects" / "teaser")
