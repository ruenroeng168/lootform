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

# House voice: Gemini "Puck", warm storyteller (chosen by the channel owner).
DEFAULT_VOICE = {
    "engine": "gemini",
    "model": "gemini-3.8-flash-tts",
    "voice": "Puck",
    "style": "Speak in Thai as a warm, friendly YouTube storyteller talking to a friend, smooth natural pacing:",
}

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


def _norm(s):
    import re
    return re.sub(r"[\s\d\-–.,!?'\"()]+", "", s)


def asr_boundaries(wav, texts, out):
    """Find where each paragraph starts (seconds) by matching a timestamped transcript to the script."""
    import base64, difflib, os, urllib.request
    cache = out / "vo" / (Path(wav).stem + ".phrases.json")
    if cache.exists():
        phrases = json.loads(cache.read_text())
    else:
        mp3 = subprocess.run(["ffmpeg", "-v", "error", "-i", str(wav), "-ac", "1", "-b:a", "64k", "-f", "mp3", "-"],
                             capture_output=True, check=True).stdout
        prompt = ("Transcribe this Thai narration verbatim as short phrases (2-6 words each), covering the whole "
                  "audio in order. Return only a JSON array of objects {\"t\": start time in seconds (decimal), "
                  "\"text\": the phrase}.")
        body = {"contents": [{"parts": [{"text": prompt},
                                        {"inlineData": {"mimeType": "audio/mp3", "data": base64.b64encode(mp3).decode()}}]}],
                "generationConfig": {"responseMimeType": "application/json", "temperature": 0}}
        key = os.environ.get("GEMINI_API_KEY", "proxy-injected")
        phrases = None
        for model in ("gemini-3.5-flash", "gemini-2.5-flash", "gemini-flash-latest"):
            try:
                req = urllib.request.Request(
                    f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent",
                    data=json.dumps(body).encode(), headers={"Content-Type": "application/json", "x-goog-api-key": key})
                with urllib.request.urlopen(req, timeout=240) as r:
                    phrases = json.loads(json.load(r)["candidates"][0]["content"]["parts"][0]["text"])
                break
            except Exception as e:
                log(f"transcribe via {model} failed: {e}")
        if not phrases:
            return None
        cache.write_text(json.dumps(phrases, ensure_ascii=False))
    dur = float(subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", str(wav)],
                               capture_output=True, text=True).stdout)

    def secs(t):  # models sometimes write 1:00.6 as 100.6
        t = float(t)
        return (t // 100) * 60 + t % 100 if t > dur + 1 and t % 100 < 60 else t
    P = [(_norm(p["text"]), secs(p["t"])) for p in phrases]
    # running transcript (normalized) with the time at which each phrase begins
    starts, j0 = [0.0], 0
    for tx in texts[1:]:
        head = _norm(tx)[:14]
        best, bj = -1, None
        for j in range(j0 + 1, len(P)):
            window = "".join(p[0] for p in P[j:j + 3])[: len(head) + 4]
            r = difflib.SequenceMatcher(None, head, window).ratio()
            if r > best:
                best, bj = r, j
        if bj is None:
            return None
        starts.append(P[bj][1]); j0 = bj
    log("transcript paragraph starts:", ", ".join(f"{t:.1f}" for t in starts))
    return starts


def split_take(x, n, expected=None, min_gap=0.15, starts=None):
    """Split one continuous take into n paragraphs.

    Picks n-1 ordered pauses that are long AND close to the expected boundaries
    (relative paragraph lengths, e.g. from a quick offline TTS pass), via DP.
    """
    if n == 1:
        return [x]
    dur = len(x) / S.SR
    win = int(0.03 * S.SR)
    env = np.sqrt(np.convolve(x ** 2, np.ones(win) / win, mode="same"))
    quiet = env < 0.035 * env.max()
    gaps, i = [], 0
    while i < len(quiet):
        if quiet[i]:
            j = i
            while j < len(quiet) and quiet[j]:
                j += 1
            if (j - i) / S.SR >= min_gap and i > 0 and j < len(quiet):
                gaps.append(((i + j) / 2 / S.SR, (j - i) / S.SR))
            i = j
        else:
            i += 1
    if len(gaps) < n - 1:
        raise RuntimeError(f"take has {len(gaps)} pauses, need {n - 1}; set tts.batch=false")
    if starts:  # boundaries heard by ASR: trust position strongly
        exp, lam = np.array(starts[1:], dtype=float) - 0.15, 0.6
    else:
        w = np.array(expected if expected else [1] * n, dtype=float)
        exp, lam = np.cumsum(w)[:-1] / w.sum() * dur, 0.12
    G, K = len(gaps), n - 1
    score = lambda k, g: gaps[g][1] - lam * abs(gaps[g][0] - exp[k])
    dp = np.full((K, G), -1e9); back = np.zeros((K, G), dtype=int)
    for g in range(G):
        dp[0, g] = score(0, g)
    for k in range(1, K):
        best, arg = -1e9, -1
        for g in range(G):
            if g > 0 and dp[k - 1, g - 1] > best:
                best, arg = dp[k - 1, g - 1], g - 1
            if arg >= 0:
                dp[k, g] = best + score(k, g); back[k, g] = arg
    g = int(np.argmax(dp[K - 1])); picks = [g]
    for k in range(K - 1, 0, -1):
        g = back[k, g]; picks.append(g)
    cuts = [int(gaps[g][0] * S.SR) for g in reversed(picks)]
    log("take split at", ", ".join(f"{c / S.SR:.1f}s" for c in cuts),
        "| expected", ", ".join(f"{e:.1f}" for e in exp))
    return [x[a:b] for a, b in zip([0] + cuts, cuts + [len(x)])]


def estimate_lengths(texts, out):
    """Relative spoken length per paragraph from a fast offline Piper pass (no quota)."""
    try:
        model = piper_model("th_TH-tsync2-medium")
        cfg = {"engine": "piper", "voice": "th_TH-tsync2-medium"}
        return [len(trim(load_audio(tts.synth(t, cfg, out / "vo_est", model, lambda *a: None)))) for t in texts]
    except Exception as e:  # fall back to character counts
        log("length estimate fallback:", e)
        return [len(t.replace(" ", "")) for t in texts]


def best_split(x, wav, texts, out):
    """Try candidate splits (length-estimate DP, transcript DP); keep the one whose clips,
    transcribed one by one, best match the script lines."""
    import difflib, hashlib
    from concurrent.futures import ThreadPoolExecutor
    import verify_vo
    est = estimate_lengths(texts, out)
    cands = [("estimate", split_take(x, len(texts), est))]
    if "--no-verify" in sys.argv or "--split=estimate" in sys.argv:
        return cands[0][1]
    starts = asr_boundaries(wav, texts, out)
    if starts:
        alt = split_take(x, len(texts), est, starts=starts)
        if "--split=transcript" in sys.argv:  # skip per-line verification (e.g. rate-limited)
            return alt
        if [len(c) for c in alt] != [len(c) for c in cands[0][1]]:
            cands.append(("transcript", alt))
    tdir = out / "vo" / "verify"; tdir.mkdir(parents=True, exist_ok=True)

    def heard(chunk):
        h = hashlib.sha1(chunk.tobytes()).hexdigest()[:16]
        txt = tdir / f"{h}.txt"
        if not txt.exists():
            w = tdir / f"{h}.wav"; write_wav(w, chunk)
            got = verify_vo.transcribe(w)
            if got is None:
                return ""
            txt.write_text(got)
        return txt.read_text()

    best = None
    for name, chunks in cands:
        with ThreadPoolExecutor(2) as ex:
            got = list(ex.map(heard, chunks))
        r = [difflib.SequenceMatcher(None, _norm(t), _norm(h)).ratio() for t, h in zip(texts, got)]
        log(f"split '{name}': match per line", " ".join(f"{v:.2f}" for v in r))
        if best is None or min(r) + np.mean(r) > best[0]:
            best = (min(r) + np.mean(r), name, chunks, r)
    log(f"using split '{best[1]}'" + ("" if min(best[3]) > 0.6 else "  ⚠ some lines may be mis-split — check vo_lines/"))
    return best[2]


def main(project):
    project = Path(project).resolve()
    spec = json.loads((project / "script.json").read_text())
    out = project / "out"
    out.mkdir(parents=True, exist_ok=True)
    fps = spec["fps"]
    if "tts" in spec:
        base_voice = {**DEFAULT_VOICE, **spec["tts"]}
    elif "voice" in spec:  # legacy offline projects (e.g. teaser)
        base_voice = {"engine": "piper", "voice": spec["voice"]}
    else:
        base_voice = dict(DEFAULT_VOICE)
    if any(a.startswith("--engine=") for a in sys.argv):  # e.g. --engine=piper for offline previews
        eng = [a for a in sys.argv if a.startswith("--engine=")][0][9:]
        base_voice = {"engine": eng, "voice": "th_TH-tsync2-medium"} if eng == "piper" else {**base_voice, "engine": eng}
        for ln in spec["lines"]:
            ln.pop("voice", None); ln.pop("engine", None)
    pmodel = piper_model(base_voice["voice"]) if base_voice.get("engine", "piper") == "piper" else None

    # 1–2. voice-over + timeline -------------------------------------------
    for a in sys.argv:
        if a.startswith("--model="):
            base_voice = {**base_voice, "model": a[8:]}
    batched = None
    if base_voice.get("engine") == "gemini" and base_voice.get("batch", True):
        # One request for the whole script: a single continuous take, 1 quota unit per video.
        texts = [" ".join(p.strip() for p in ln["text"].split("|")) for ln in spec["lines"]]
        cfg = {**base_voice, "notes": "Read the paragraphs in order. Pause about one second between paragraphs."}
        wav = tts.synth("\n\n".join(texts), cfg, out / "vo", pmodel, log)
        batched = best_split(load_audio(wav), wav, texts, out)
    clips, cues, t = [], {}, 0.0
    for li, ln in enumerate(spec["lines"]):
        cfg = {**base_voice, **{k: ln[k] for k in ("voice", "style", "engine", "speed") if k in ln}}
        parts = [p.strip() for p in ln["text"].split("|")]
        spoken = " ".join(parts)
        raw = batched[li] if batched else load_audio(tts.synth(spoken, cfg, out / "vo", pmodel, log))
        x = process_voice(trim(raw), cfg.get("engine", "piper"), ln.get("gain", 1.0))
        (out / "vo_lines").mkdir(exist_ok=True)
        write_wav(out / "vo_lines" / f"{li:02d}_{ln['cue']}.wav", x)
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
                "captions": captions, "mouth": [round(float(m), 3) for m in mouth],
                # project data (e.g. product info) for scene.js; image paths are made page-relative
                "data": json.loads((project / "data.json").read_text()) if (project / "data.json").exists() else {}}
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
