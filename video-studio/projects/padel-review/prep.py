#!/usr/bin/env python3
"""Venue review: badminton / pickleball / padel at สวนน้ำทองหล่อวิสต้า (near ตลาดดอนกลาง), host พระยาอีสาน.
Cuts the interview per edl.json (stumbles, fillers and the off-topic part removed), cut points snapped to the
nearest quiet spot, alternating 1.0 / 1.07 framing on jump cuts, b-roll cutaways over the voice, cleaned
dialogue (high-pass, denoise, presence, compression), light groove music ducked under speech, then an
อุบลเด้อ card with a Puck voice line. Phone footage is portrait 1080x2320 (rotation flag) -> 1080x1920.

Writes out/base.mp4, out/footage.wav, out/mix.wav, out/timeline.json, then
    node engine/render.mjs projects/padel-review --overlay --footage-vol=1
"""
import json, subprocess, sys
from pathlib import Path
import numpy as np, cv2
from scipy.io import wavfile

HERE = Path(__file__).resolve().parent; OUT = HERE / "out"; RAW = HERE / "assets" / "raw"
sys.path.insert(0, str(HERE.parent.parent / "engine"))
import synth as S  # noqa: E402

W, H, FPS = 1080, 1920, 30
DIALOG = ("highpass=f=90,afftdn=nr=10:nf=-45,equalizer=f=300:t=q:w=1:g=-3,equalizer=f=3000:t=q:w=1.2:g=3,"
          "acompressor=threshold=-22dB:ratio=3:attack=5:release=150:makeup=3,alimiter=limit=0.9")
VF = f"scale={W}:-2:flags=lanczos,crop={W}:{H}:0:(ih-{H})*0.45,eq=contrast=1.05:saturation=1.12:gamma=1.02,unsharp=5:5:0.5"
UBON_DUR = 10.5


def sm(u): u = min(1.0, max(0.0, u)); return u * u * (3 - 2 * u)


def audio(src, ss=None, t=None, af=DIALOG):
    cmd = ["ffmpeg", "-v", "error"] + (["-ss", f"{ss:.3f}"] if ss is not None else []) + (["-t", f"{t:.3f}"] if t else []) + \
          ["-i", str(src)] + (["-af", af] if af else []) + ["-ac", "1", "-ar", str(S.SR), "-f", "f32le", "-"]
    return np.frombuffer(subprocess.run(cmd, capture_output=True, check=True).stdout, np.float32).astype(np.float64)


def frames(src, ss, n):
    """stream n frames (generator, constant memory); repeats the last frame if the source runs short."""
    pr = subprocess.Popen(["ffmpeg", "-v", "error", "-ss", f"{ss:.3f}", "-i", str(src), "-frames:v", str(n), "-vf", f"fps={FPS},{VF}",
                           "-f", "rawvideo", "-pix_fmt", "bgr24", "-"], stdout=subprocess.PIPE)
    last = None
    for _ in range(n):
        buf = pr.stdout.read(W * H * 3)
        if len(buf) == W * H * 3: last = np.frombuffer(buf, np.uint8).reshape(H, W, 3)
        yield last
    pr.stdout.close(); pr.wait()


def zoom(img, z, cy=860):
    if abs(z - 1) < 1e-3: return img
    vw, vh = W / z, H / z; x0 = (W - vw) / 2; y0 = min(max(cy - vh / 2, 0), H - vh)
    M = np.float32([[z, 0, -x0 * z], [0, z, -y0 * z]])
    return cv2.warpAffine(img, M, (W, H), flags=cv2.INTER_LINEAR)


def snap(full, t, rad=0.22):
    """move a cut point to the quietest 20 ms window within ±rad s."""
    hop = int(0.01 * S.SR); a = int(max(0, t - rad) * S.SR); b = int(min(len(full) / S.SR, t + rad) * S.SR)
    seg = full[a:b]
    if len(seg) < hop * 3: return t
    e = np.convolve(seg ** 2, np.ones(hop * 2) / (hop * 2), "same")[::hop]
    idx = int(np.argmin(e))
    return a / S.SR + idx * 0.01


def score(dur, D):
    """light, bright groove: plucked major-7 keys, soft kick/clap, shaker; stops under the ubon card except a pad."""
    bpm = 104; beat = 60 / bpm; bar = beat * 4
    prog = [(45, [64, 67, 71, 74]), (50, [62, 66, 69, 72]), (43, [62, 67, 71, 74]), (48, [60, 64, 67, 71])]
    keys, bass, drums = (S.Track(dur + 2) for _ in range(3))
    for b in range(int(dur / bar) + 2):
        t0 = b * bar; root, ch = prog[b % 4]
        for i in range(8):
            if i in (1, 5) and b % 2: continue
            keys.add(t0 + i * beat / 2, S.pluck(S.midi(ch[[0, 2, 1, 3, 2, 1, 3, 2][i]]), 0.4, 0.55), 0.13)
        bass.add(t0, S.bass(S.midi(root - 12), beat * 1.5), 0.32); bass.add(t0 + beat * 2.5, S.bass(S.midi(root - 12), beat), 0.25)
        for i in range(4):
            tb = t0 + i * beat
            drums.add(tb, S.kick(0.25), 0.32 if i in (0, 2) else 0.0)
            if i in (1, 3): drums.add(tb, S.clap(0.15), 0.14)
            for j in range(2): drums.add(tb + j * beat / 2, S.hat(0.03), 0.06)
    u0 = D["ubon"][0]
    for tr in (keys, bass, drums): tr.gate([(0, 0), (0.05, 1), (u0 - 0.3, 1), (u0, 0.25), (dur - 1.2, 0.25), (dur, 0), (dur + 2, 0)])
    fx = S.Track(dur + 2)
    fx.add(0.0, S.whoosh(0.5), 0.25)
    for t in D["chapters"]: fx.add(t[0] - 0.05, S.whoosh(0.45), 0.18); fx.add(t[0] + 0.1, S.pop(), 0.2)
    fx.add(u0, S.bell(S.midi(84), 1.0), 0.18); fx.add(u0 + 0.12, S.bell(S.midi(88), 1.0), 0.15)
    n = int(dur * S.SR)
    return (keys.buf[:n] + bass.buf[:n] + drums.buf[:n]) * 0.6, fx.buf[:n]


def main():
    OUT.mkdir(exist_ok=True)
    E = json.loads((HERE / "edl.json").read_text())
    enc = subprocess.Popen(["ffmpeg", "-v", "error", "-y", "-f", "rawvideo", "-pix_fmt", "bgr24", "-s", f"{W}x{H}", "-r", str(FPS), "-i", "-",
                            "-c:v", "libx264", "-preset", "medium", "-crf", "18", "-pix_fmt", "yuv420p", str(OUT / "base.mp4")], stdin=subprocess.PIPE)
    voice = S.Track(400); nf = 0; caps = []; chapters = []; segs = []; full = {}
    # hook (neon sign, music only)
    hk = E["hook"]; n = int(round((hk["out"] - hk["in"]) * FPS))
    for j, f in enumerate(frames(RAW / f"{hk['src']}.mp4", hk["in"], n)): enc.stdin.write(zoom(f, 1.0 + 0.03 * j / n).tobytes())
    nf += n; D = {"hook": [0, round(n / FPS, 3), hk["text"]]}
    for k, it in enumerate(E["items"]):
        src = RAW / f"{it['src']}.mp4"
        if it["src"] not in full: full[it["src"]] = audio(src)
        fa = full[it["src"]]
        a = snap(fa, it["in"]) if not it.get("mute") else it["in"]; b = snap(fa, it["out"]) if not it.get("mute") else it["out"]
        t0 = nf / FPS; n = int(round((b - a) * FPS)); d = n / FPS
        if not it.get("mute"):
            c = fa[int(a * S.SR):int(a * S.SR) + int(d * S.SR)]; m = np.arange(len(c))
            voice.add(t0, c * np.minimum(1, np.minimum(m / 400, (len(c) - m) / 400)))
        fr = frames(src, a, n); z = 1.0 if k % 2 == 0 else 1.07
        rolls = [(int((s - a) * FPS), int((e - a) * FPS), bs, bss) for s, e, bs, bss in it.get("broll", [])]
        rg = {}
        for j in range(n):
            f = next(fr); zz = z + 0.02 * j / n
            for r0, r1, bs, bss in rolls:
                if r0 <= j < r1:
                    if r0 not in rg: rg[r0] = frames(RAW / f"{bs}.mp4", bss, r1 - r0)
                    f = next(rg[r0]); zz = 1.04 + 0.05 * (j - r0) / max(1, r1 - r0)
            enc.stdin.write(zoom(f, zz).tobytes())
        nf += n
        for i, (ct, tx) in enumerate(it["caps"]):
            ce = it["caps"][i + 1][0] if i + 1 < len(it["caps"]) else it["out"]
            caps.append([round(t0 + max(0, ct - a), 3), round(t0 + min(d, ce - a), 3), tx])
        if it.get("chapter"): chapters.append([round(t0, 3), it["chapter"]])
        if it.get("lower"): D["lower"] = [round(t0 + 0.6, 3), round(t0 + 6.0, 3)]
        segs.append([round(t0, 3), round(nf / FPS, 3), it["src"]])
    # อุบลเด้อ card (Puck), drawn by scene.js over a soft blurred venue frame
    t0 = nf / FPS; n = int(round(UBON_DUR * FPS))
    bg = next(frames(RAW / "a8.mp4", 1.0, 1)); bg = (cv2.GaussianBlur(bg, (0, 0), 25) * 0.45).astype(np.uint8)
    for j in range(n): enc.stdin.write(zoom(bg, 1.03 + 0.04 * j / n).tobytes())
    nf += n; enc.stdin.close(); enc.wait()
    uw = next((OUT / "u").glob("*.wav")); ua = audio(uw, af="highpass=f=70,acompressor=threshold=-20dB:ratio=3:makeup=2,loudnorm=I=-16:TP=-1.5")
    voice.add(t0 + 0.8, ua)
    total = nf / FPS
    D.update({"caps": caps, "chapters": chapters, "segs": segs, "ubon": [round(t0, 3), round(total, 3)], "uvo": [round(t0 + 0.8, 3), round(t0 + 0.8 + len(ua) / S.SR, 3)],
              "images": {"ubonder": "assets/ubonder.png"}})
    v = voice.buf[:int(total * S.SR)]
    v = v / (np.percentile(np.abs(v[np.abs(v) > 1e-3]), 99.5) + 1e-9) * 0.7
    music, fx = score(total, D)
    duck = np.clip(S.follower(v, 0.02, 0.4) / 0.06, 0, 1)
    mix = music[:len(v)] * (1 - 0.75 * duck) + fx[:len(v)]
    wavfile.write(OUT / "footage.wav", S.SR, (np.clip(np.stack([v, v], 1), -1, 1) * 32767).astype(np.int16))
    wavfile.write(OUT / "mix.wav", S.SR, (np.clip(np.stack([mix, mix], 1), -1, 1) * 32767).astype(np.int16))
    (OUT / "timeline.json").write_text(json.dumps({"width": W, "height": H, "fps": FPS, "frames": nf, "duration": round(total, 3), "cues": {}, "data": D}, ensure_ascii=False))
    print(f"[prep] {total:.2f}s {nf} frames, {len(caps)} captions, chapters {chapters}")


if __name__ == "__main__":
    main()
