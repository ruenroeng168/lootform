#!/usr/bin/env python3
"""Check that each voice-over line contains the right words.

Transcribes each per-line clip written by build.py (out/vo_lines/*.wav) separately
with a Gemini model and prints it next to the script.

    python3 video-studio/engine/verify_vo.py video-studio/projects/<name>
"""
import base64
import json
import os
import subprocess
import sys
import urllib.request
from pathlib import Path

MODEL = os.environ.get("VERIFY_MODEL", "gemini-3.5-flash")


def transcribe(clip):
    mp3 = subprocess.run(["ffmpeg", "-v", "error", "-i", str(clip), "-ac", "1", "-b:a", "48k", "-f", "mp3", "-"],
                         capture_output=True, check=True).stdout
    body = {"contents": [{"parts": [
        {"text": "Transcribe this Thai audio clip verbatim. Return only the transcript text."},
        {"inlineData": {"mimeType": "audio/mp3", "data": base64.b64encode(mp3).decode()}}]}],
        "generationConfig": {"temperature": 0}}
    import time
    for attempt, model in enumerate([MODEL, "gemini-3.5-flash", MODEL, "gemini-3.7-flash", MODEL, "gemini-3.5-flash"]):
        if attempt:
            time.sleep(min(30, 6 * attempt))
        try:
            req = urllib.request.Request(
                f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent",
                data=json.dumps(body).encode(),
                headers={"Content-Type": "application/json",
                         "x-goog-api-key": os.environ.get("GEMINI_API_KEY", "proxy-injected")})
            with urllib.request.urlopen(req, timeout=120) as r:
                return json.load(r)["candidates"][0]["content"]["parts"][0]["text"].strip()
        except Exception as e:
            print(f"verify via {model} failed: {e}", file=sys.stderr)
    return None


def main(project):
    """Transcribe every clip on its own (in parallel) and print it next to the script line."""
    from concurrent.futures import ThreadPoolExecutor
    project = Path(project)
    spec = json.loads((project / "script.json").read_text())
    clips = sorted((project / "out" / "vo_lines").glob("*.wav"))
    with ThreadPoolExecutor(2) as ex:
        got = list(ex.map(transcribe, clips))
    for ln, heard in zip(spec["lines"], got):
        print(f"[{ln['cue']}]\n  script: {ln['text'].replace('|', '')}\n  heard : {heard}")


if __name__ == "__main__":
    main(sys.argv[1])
