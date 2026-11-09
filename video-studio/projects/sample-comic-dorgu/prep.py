"""Short comic-style sample: reuse the Dorgu voice line from pl-mu-villa-lfc, build timeline.json + mix.wav."""
import json, subprocess, sys
from pathlib import Path
import numpy as np
from scipy.io import wavfile
HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE.parent.parent / "engine"))
import synth as S
SRC = HERE.parent / "pl-mu-villa-lfc" / "out"
tl0 = json.loads((SRC / "timeline.json").read_text())
c = tl0["cues"]["mu4"]
a, b = c["marks"][1] - c["start"] - 0.05, c["end"] - c["start"] + 0.2      # "ทดเจ็บนาทีที่หก ... สี่ต่อสี่!"
LEAD, DUR, FPS = 0.4, 8.6, 30
v = subprocess.run(["ffmpeg", "-v", "error", "-ss", str(a), "-to", str(b), "-i", str(SRC / "vo_lines" / "04_mu4.wav"),
                    "-ac", "1", "-ar", str(S.SR), "-f", "f32le", "-"], capture_output=True, check=True).stdout
vo = np.frombuffer(v, np.float32)
dorgu = c["marks"][2] - c["marks"][1] + LEAD + 0.05   # "แพทริก ดอร์กู ..." starts
voice_end = LEAD + len(vo) / S.SR
cues = {"corner": LEAD, "dorgu": dorgu, "header": dorgu + 0.95, "goal": dorgu + 1.35, "end": voice_end}
# audio
T = S.Track(DUR)
T.add(LEAD, vo.astype(np.float64), 1.0)
mus = S.Track(DUR); beat = 60 / 128
for i in range(int(DUR / beat) + 1):
    t = i * beat
    if t > cues["goal"] - 0.1 or t < cues["dorgu"] - 0.4:
        mus.add(t, S.kick(0.35), 0.4); mus.add(t + beat / 2, S.hat(0.05), 0.1)
crowd = S.bandpass(S.noise(DUR + 1), 250, 3000)
fx = S.Track(DUR); fx.add(0, crowd, 0.05)
fx.add(cues["dorgu"] - 0.9, S.whoosh(0.6), 0.25)       # corner kicked
fx.add(cues["dorgu"] - 0.2, S.riser(1.1), 0.25)
fx.add(cues["header"], S.thump(0.35), 0.7)
fx.add(cues["goal"], S.boom(2.4), 0.5)
fx.add(cues["goal"], S.bandpass(S.noise(3), 250, 4000) * np.minimum(1, S.tt(3) / 0.15) * np.exp(-S.tt(3) * 0.6), 0.45)
fx.add(cues["goal"] + 0.05, S.sparkle(1.5), 0.15)
duck = np.clip(S.follower(T.buf, 0.02, 0.3) / 0.1, 0, 1)
mix = T.buf + mus.buf * 0.5 * (1 - 0.5 * duck) + fx.buf
mix *= np.interp(np.arange(len(mix)) / S.SR, [0, DUR - 0.5, DUR], [1, 1, 0])
mix = mix / max(1, np.abs(mix).max() / 0.95)
(HERE / "out").mkdir(exist_ok=True)
wavfile.write(HERE / "out" / "mix.wav", S.SR, (np.stack([mix, mix], 1) * 32767).astype(np.int16))
subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", str(HERE / "out" / "mix.wav"), "-af", "loudnorm=I=-14:TP=-1.5",
                "-ar", "48000", str(HERE / "out" / "mix_n.wav")], check=True)
(HERE / "out" / "mix_n.wav").replace(HERE / "out" / "mix.wav")
n = int(DUR * FPS)
(HERE / "out" / "timeline.json").write_text(json.dumps({"width": 1080, "height": 1920, "fps": FPS, "frames": n, "duration": DUR,
    "cues": {k: {"start": v} for k, v in cues.items()}, "data": {}}))
print(cues)
