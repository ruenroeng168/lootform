#!/usr/bin/env python3
"""Check that each voice-over line contains the right words.

Transcribes the per-line clips written by build.py (out/vo_lines/*.wav) with a
Gemini text model in one request and prints them next to the script.

    python3 video-studio/engine/verify_vo.py video-studio/projects/<name>
"""
import base64
import json
import os
import subprocess
import sys
import urllib.request
from pathlib import Path

MODEL = os.environ.get("VERIFY_MODEL", "gemini-flash-latest")


def main(project):
    project = Path(project)
    spec = json.loads((project / "script.json").read_text())
    clips = sorted((project / "out" / "vo_lines").glob("*.wav"))
    parts = [{"text": f"Transcribe each of the following {len(clips)} Thai audio clips verbatim. "
                      "Return only a JSON array of strings, one per clip, in order."}]
    for c in clips:
        mp3 = subprocess.run(["ffmpeg", "-v", "error", "-i", str(c), "-ac", "1", "-b:a", "48k", "-f", "mp3", "-"],
                             capture_output=True, check=True).stdout
        parts.append({"inlineData": {"mimeType": "audio/mp3", "data": base64.b64encode(mp3).decode()}})
    body = {"contents": [{"parts": parts}], "generationConfig": {"responseMimeType": "application/json"}}
    req = urllib.request.Request(
        f"https://generativelanguage.googleapis.com/v1beta/models/{MODEL}:generateContent",
        data=json.dumps(body).encode(),
        headers={"Content-Type": "application/json",
                 "x-goog-api-key": os.environ.get("GEMINI_API_KEY", "proxy-injected")})
    with urllib.request.urlopen(req, timeout=180) as r:
        got = json.loads(json.load(r)["candidates"][0]["content"]["parts"][0]["text"])
    for ln, heard in zip(spec["lines"], got):
        print(f"[{ln['cue']}]\n  script: {ln['text'].replace('|', '')}\n  heard : {heard}")


if __name__ == "__main__":
    main(sys.argv[1])
