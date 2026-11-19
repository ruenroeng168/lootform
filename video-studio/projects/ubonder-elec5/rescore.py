"""Re-run scene events + score + mix after scene.js changes, without regenerating the voice (uses out/vo_only.wav)."""
import json, subprocess, sys, importlib.util
from pathlib import Path
import numpy as np
HERE = Path(__file__).resolve().parent; OUT = HERE / "out"; ENGINE = HERE.parent.parent / "engine"
sys.path.insert(0, str(ENGINE)); import synth as S
from scipy.io import wavfile
tl = json.loads((OUT / "timeline.json").read_text()); spec = json.loads((HERE / "script.json").read_text())
subprocess.run(["node", str(ENGINE / "render.mjs"), str(HERE), "--events"], check=True)
events = json.loads((OUT / "events.json").read_text())
sp = importlib.util.spec_from_file_location("score", HERE / "score.py"); sc = importlib.util.module_from_spec(sp); sp.loader.exec_module(sc)
music, sfx = sc.build(tl["cues"], tl["duration"], spec, events=events)
sr, v = wavfile.read(OUT / "vo_only.wav"); vo = (v if v.ndim == 1 else v[:, 0]).astype(np.float64) / 32768
n = min(len(vo), len(music), len(sfx)); vo, music, sfx = vo[:n], music[:n], sfx[:n]
duck = np.clip(S.follower(vo, 0.02, 0.35) / 0.12, 0, 1)
mix = S.softclip((music * (1 - spec.get("duck", 0.6) * duck) + sfx + vo) * 0.9, 1.1)
wavfile.write(OUT / "mix_raw.wav", S.SR, (np.clip(mix, -1, 1) * 32767).astype(np.int16))
subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", str(OUT / "mix_raw.wav"), "-af", "loudnorm=I=-14:TP=-1.5:LRA=11", "-ar", "48000", "-ac", "2", str(OUT / "mix.wav")], check=True)
print("rescored", tl["duration"])
