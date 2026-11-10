#!/usr/bin/env python3
"""Offline forced alignment of known script lines to an audio take (Thai OK), no API quota.

faster-whisper (model 'small', int8 CPU) transcribes with word timestamps, prompted with the script;
script characters are matched to the heard characters (difflib), and each line's start/end is snapped
to the nearest pause in the audio.

    from align import align_lines
    spans = align_lines("take.wav", ["บรรทัด 1", "บรรทัด 2", ...])   # -> [(start, end), ...] seconds

    python3 engine/align.py take.wav lines.txt        # one line per row; prints the spans
Model files are cached in video-studio/models/hf (gitignored).
"""
import difflib
import os
import re
import subprocess
import sys
from pathlib import Path

import numpy as np

ROOT = Path(__file__).resolve().parent.parent
os.environ.setdefault("HF_HOME", str(ROOT / "models" / "hf"))
_MODEL = None
SR = 16000


def _norm_chars(s):
    s = s.lower().replace("work", "เวิร์ก")
    return [c for c in s if not re.match(r"[\s.,!?…“”\"'()\-:;]", c)]


def _load(path):
    return np.frombuffer(subprocess.run(["ffmpeg", "-v", "error", "-i", str(path), "-ac", "1", "-ar", str(SR), "-f", "f32le", "-"],
                                        capture_output=True, check=True).stdout, np.float32)


def _pauses(x, min_len=0.12):
    hop = SR // 100
    db = 20 * np.log10(np.array([np.sqrt(np.mean(x[k:k + hop] ** 2)) for k in range(0, len(x) - hop, hop)]) + 1e-9)
    db = np.convolve(db, np.ones(3) / 3, "same"); sil = db < np.percentile(db, 95) - 30
    out, k = [], 0
    while k < len(sil):
        if sil[k]:
            j = k
            while j < len(sil) and sil[j]: j += 1
            if (j - k) / 100 >= min_len: out.append((k / 100, j / 100))
            k = j
        else: k += 1
    return out


def heard_chars(x, prompt=""):
    global _MODEL
    from faster_whisper import WhisperModel
    if _MODEL is None:
        _MODEL = WhisperModel("small", device="cpu", compute_type="int8")
    segs, _ = _MODEL.transcribe(x, language="th", word_timestamps=True, beam_size=5, temperature=0.0,
                                initial_prompt=prompt[:600] or None, condition_on_previous_text=bool(prompt))
    chars, times = [], []
    for s in segs:
        for w in s.words or []:
            cs = _norm_chars(w.word)
            for i, c in enumerate(cs):
                chars.append(c); times.append(w.start + (w.end - w.start) * (i + 0.5) / max(1, len(cs)))
    return chars, times


def align_lines(audio, lines, log=print):
    x = _load(audio); dur = len(x) / SR
    sc, owner = [], []
    for li, l in enumerate(lines):
        cs = _norm_chars(l); sc += cs; owner += [li] * len(cs)
    best = None
    for prompt in (" ".join(lines), "", " ".join(lines[: len(lines) // 2])):   # deterministic decoding, keep the best match
        hc, ht = heard_chars(x, prompt)
        sm = difflib.SequenceMatcher(None, sc, hc, autojunk=False)
        cov = sum(n for _, _, n in sm.get_matching_blocks()) / max(1, len(sc))
        log(f"[align] try prompt={'yes' if prompt else 'no '} len={len(prompt):3}: {cov:.0%}")
        if best is None or cov > best[0]:
            best = (cov, hc, ht, sm)
        if cov >= 0.85:
            break
    _, hc, ht, sm = best
    t_of = [None] * len(sc)
    for a, b, n in sm.get_matching_blocks():
        for k in range(n):
            t_of[a + k] = ht[b + k]
    first = [None] * len(lines); last = [None] * len(lines)
    for i, t in enumerate(t_of):
        if t is None: continue
        li = owner[i]
        if first[li] is None: first[li] = t
        last[li] = t
    cover = sum(t is not None for t in t_of) / max(1, len(t_of))
    log(f"[align] matched {cover:.0%} of script characters")
    # fill gaps by interpolation on line index
    idx = [i for i in range(len(lines)) if first[i] is not None]
    if not idx:
        raise RuntimeError("alignment failed: nothing matched")
    for arr in (first, last):
        known = [(i, arr[i]) for i in idx]
        for i in range(len(lines)):
            if arr[i] is None:
                arr[i] = float(np.interp(i, [k for k, _ in known], [v for _, v in known]))
    # boundaries between consecutive lines: snap to the pause between last[i] and first[i+1]
    P = _pauses(x)
    starts, ends = [0.0] * len(lines), [dur] * len(lines)
    starts[0] = max(0.0, first[0] - 0.25)
    for i in range(len(lines) - 1):
        lo, hi = last[i], first[i + 1]
        cand = [p for p in P if p[1] > lo - 0.15 and p[0] < hi + 0.15]
        if cand:
            p = max(cand, key=lambda p: p[1] - p[0]); cut_a, cut_b = p[0], p[1]
        else:
            cut_a = cut_b = (lo + hi) / 2
        ends[i] = min(cut_a + 0.05, cut_b); starts[i + 1] = max(cut_b - 0.05, ends[i])
    for p in P:   # trim trailing silence of the last line
        if p[0] > last[-1] - 0.1 and p[1] >= dur - 0.05: ends[-1] = p[0] + 0.05
    return [(round(a, 3), round(b, 3)) for a, b in zip(starts, ends)]


if __name__ == "__main__":
    lines = [l.strip() for l in Path(sys.argv[2]).read_text().splitlines() if l.strip()]
    for (a, b), l in zip(align_lines(sys.argv[1], lines), lines):
        print(f"{a:7.2f} {b:7.2f}  {l}")
