#!/usr/bin/env python3
"""LOOTFORM video studio — end-to-end build.

    python3 video-studio/engine/build.py video-studio/projects/teaser

Pipeline:
  1. Thai voice-over per line (Piper TTS, offline neural voice)
  2. Timeline from line timings (cues the scene + score can sync to)
  3. Score (project score.py): music bed + SFX, ducked under the voice
  4. Lip-sync curve (voice loudness per video frame)
  5. Frame render (project scene.js in headless Chromium) -> H.264 + AAC MP4
"""
import importlib.util
import json
import subprocess
import sys
from pathlib import Path

import numpy as np

sys.path.insert(0, str(Path(__file__).parent))
import synth as S  # noqa: E402

ENGINE = Path(__file__).parent
STUDIO = ENGINE.parent


def log(*a):
    print("[studio]", *a, flush=True)


def voice_model(name):
    p = STUDIO / "voices" / f"{name}.onnx"
    if not p.exists():
        p.parent.mkdir(exist_ok=True)
        lang, speaker, quality = name.split("-")  # e.g. th_TH, tsync2, medium
        base = ("https://huggingface.co/rhasspy/piper-voices/resolve/main/"
                f"{lang.split('_')[0]}/{lang}/{speaker}/{quality}/{name}")
        for ext in (".onnx", ".onnx.json"):
            log("downloading voice", name + ext)
            subprocess.run(["curl", "-sSfL", "-o", str(p.parent / (name + ext)), base + ext],
                           check=True)
    return p


def load_audio(path):
    r = subprocess.run(["ffmpeg", "-v", "error", "-i", str(path), "-f", "f32le", "-ac", "1",
                        "-ar", str(S.SR), "-"], capture_output=True, check=True)
    return np.frombuffer(r.stdout, dtype=np.float32).astype(np.float64)


def write_wav(path, x):
    pcm = (np.clip(x, -1, 1) * 32767).astype("<i2").tobytes()
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-f", "s16le", "-ar", str(S.SR), "-ac", "1",
                    "-i", "-", str(path)], input=pcm, check=True)


def trim(x, thr=0.01, pad=0.03):
    idx = np.where(np.abs(x) > thr)[0]
    if not len(idx):
        return x
    p = int(pad * S.SR)
    return x[max(0, idx[0] - p): idx[-1] + p]


def tts(text, out, model, speed=1.0):
    subprocess.run([sys.executable, "-m", "piper", "-m", str(model), "-f", str(out),
                    "--length-scale", str(speed)], input=text.encode(), check=True,
                   capture_output=True)


def process_voice(x, gain=1.0):
    x = S.highpass(x, 90)
    x = x / (np.max(np.abs(x)) + 1e-9) * 0.8
    return S.softclip(x * 1.6, 1.2) * 0.85 * gain


def main(project):
    project = Path(project).resolve()
    spec = json.loads((project / "script.json").read_text())
    out = project / "out"
    (out / "vo").mkdir(parents=True, exist_ok=True)
    fps = spec["fps"]
    model = voice_model(spec["voice"])

    # 1–2. voice-over + timeline -------------------------------------------
    clips, cues, t = [], {}, 0.0
    for ln in spec["lines"]:
        wav = out / "vo" / f"{ln['cue']}.wav"
        key = out / "vo" / f"{ln['cue']}.txt"
        sig = f"{ln['text']}|{ln.get('speed', 1.0)}"
        if not wav.exists() or not key.exists() or key.read_text() != sig:
            log("tts:", ln["text"])
            tts(ln["text"], wav, model, ln.get("speed", 1.0))
            key.write_text(sig)
        x = process_voice(trim(load_audio(wav)), ln.get("gain", 1.0))
        start = ln["at"] if "at" in ln else t + ln.get("gap", 0.3)
        end = start + len(x) / S.SR
        cues[ln["cue"]] = {"start": round(start, 3), "end": round(end, 3)}
        clips.append((start, x))
        t = end
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

    # 3. score -------------------------------------------------------------
    sspec = importlib.util.spec_from_file_location("score", project / "score.py")
    score = importlib.util.module_from_spec(sspec)
    sspec.loader.exec_module(score)
    log("scoring music + sfx")
    music, sfx = score.build(cues, duration, spec)

    duck = np.clip(S.follower(vo.buf, 0.02, 0.35) / 0.12, 0, 1)
    mix = music * (1 - 0.6 * duck) + sfx + vo.buf
    mix = S.softclip(mix * 0.9, 1.1)
    n = int(duration * S.SR)
    write_wav(out / "mix_raw.wav", mix[:n])
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", str(out / "mix_raw.wav"),
                    "-af", "loudnorm=I=-14:TP=-1.5:LRA=11", "-ar", "48000", "-ac", "2",
                    str(out / "mix.wav")], check=True)

    # 4. lip-sync curve ----------------------------------------------------
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

    # 5. render + mux ------------------------------------------------------
    if "--audio-only" in sys.argv:
        return
    extra = [a for a in sys.argv[2:] if a.startswith("--frames=") or a == "--stills"]
    subprocess.run(["node", str(ENGINE / "render.mjs"), str(project), *extra], check=True)


if __name__ == "__main__":
    main(sys.argv[1] if len(sys.argv) > 1 else STUDIO / "projects" / "teaser")
