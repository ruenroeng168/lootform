#!/usr/bin/env python3
"""Generate illustrations with Gemini image models (for storybook / comic panels).

    python3 engine/imagegen.py out.png "prompt" [--ref ref1.png --ref ref2.png] [--aspect 9:16] [--model m]

--ref passes earlier images (e.g. the character sheet) so the same character stays consistent across panels.
Key: $GEMINI_API_KEY or the environment's network secret for generativelanguage.googleapis.com.
Rules: generic fictional characters only — no real-person likeness, no club crests, sponsor or brand logos.
"""
import argparse
import base64
import json
import os
import sys
import time
import urllib.request

MODELS = ["gemini-3-pro-image", "gemini-3.1-flash-image", "nano-banana-pro-preview", "gemini-2.5-flash-image"]


def generate(prompt, out, refs=(), aspect="9:16", model=None):
    parts = [{"text": prompt}]
    for r in refs:
        mime = "image/png" if r.lower().endswith(".png") else "image/jpeg"
        parts.append({"inlineData": {"mimeType": mime, "data": base64.b64encode(open(r, "rb").read()).decode()}})
    body = {"contents": [{"parts": parts}],
            "generationConfig": {"responseModalities": ["IMAGE"], "imageConfig": {"aspectRatio": aspect}}}
    last = None
    for m in ([model] if model else MODELS):
        for attempt in range(3):
            try:
                req = urllib.request.Request(
                    f"https://generativelanguage.googleapis.com/v1beta/models/{m}:generateContent",
                    data=json.dumps(body).encode(),
                    headers={"Content-Type": "application/json", "x-goog-api-key": os.environ.get("GEMINI_API_KEY", "proxy-injected")})
                with urllib.request.urlopen(req, timeout=240) as r:
                    d = json.load(r)
                for p in d["candidates"][0]["content"]["parts"]:
                    if "inlineData" in p:
                        open(out, "wb").write(base64.b64decode(p["inlineData"]["data"]))
                        print(f"[imagegen] {m} -> {out}")
                        return m
                last = f"{m}: no image in response"
                break
            except urllib.error.HTTPError as e:
                last = f"{m}: HTTP {e.code} {e.read()[:200]!r}"
                if e.code == 429 and attempt < 2:
                    time.sleep(20 * (attempt + 1)); continue
                break
            except Exception as e:  # noqa: BLE001
                last = f"{m}: {e}"; break
        print(f"[imagegen] {last}", file=sys.stderr)
    raise SystemExit(f"image generation failed: {last}")


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("out"); ap.add_argument("prompt")
    ap.add_argument("--ref", action="append", default=[]); ap.add_argument("--aspect", default="9:16"); ap.add_argument("--model")
    a = ap.parse_args()
    generate(a.prompt, a.out, a.ref, a.aspect, a.model)
