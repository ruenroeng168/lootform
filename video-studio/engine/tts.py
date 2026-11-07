"""Text-to-speech backends: Gemini TTS (natural, style-promptable) and Piper (offline fallback).

Gemini: the API key is injected by the environment's network secret
(header x-goog-api-key for generativelanguage.googleapis.com) or read from
$GEMINI_API_KEY. Output is cached by (engine, model, voice, style, text).
"""
import base64
import hashlib
import json
import os
import subprocess
import sys
import time
import urllib.error
import urllib.request
import wave
from pathlib import Path

GEMINI_URL = "https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent"


def _cache_name(cfg, text):
    key = json.dumps([cfg.get("engine"), cfg.get("model"), cfg.get("voice"), cfg.get("style"),
                      cfg.get("speed"), text], ensure_ascii=False)
    return hashlib.sha1(key.encode()).hexdigest()[:16] + ".wav"


def gemini(text, out, voice="Charon", style="", model="gemini-3.8-flash-tts", retries=4):
    prompt = f"{style.strip()}\n\n{text}" if style else text
    body = {
        "contents": [{"parts": [{"text": prompt}]}],
        "generationConfig": {
            "responseModalities": ["AUDIO"],
            "speechConfig": {"voiceConfig": {"prebuiltVoiceConfig": {"voiceName": voice}}},
        },
    }
    # The proxy replaces this placeholder with the stored secret.
    key = os.environ.get("GEMINI_API_KEY", "proxy-injected")
    req = urllib.request.Request(GEMINI_URL.format(model=model), data=json.dumps(body).encode(),
                                 headers={"Content-Type": "application/json", "x-goog-api-key": key})
    for attempt in range(retries):
        try:
            with urllib.request.urlopen(req, timeout=120) as r:
                data = json.load(r)
            part = data["candidates"][0]["content"]["parts"][0]["inlineData"]
            pcm = base64.b64decode(part["data"])
            rate = 24000
            for kv in part.get("mimeType", "").split(";"):
                if kv.strip().startswith("rate="):
                    rate = int(kv.split("=")[1])
            with wave.open(str(out), "wb") as w:
                w.setnchannels(1); w.setsampwidth(2); w.setframerate(rate); w.writeframes(pcm)
            return
        except urllib.error.HTTPError as e:
            msg = e.read().decode(errors="replace")[:400]
            if e.code in (429, 500, 503) and attempt < retries - 1:
                time.sleep(4 * 2 ** attempt); continue
            raise RuntimeError(f"Gemini TTS HTTP {e.code}: {msg}") from None
        except (KeyError, IndexError):
            if attempt < retries - 1:
                time.sleep(2); continue
            raise RuntimeError(f"Gemini TTS returned no audio: {json.dumps(data)[:400]}")


def piper(text, out, model_path, speed=1.0):
    subprocess.run([sys.executable, "-m", "piper", "-m", str(model_path), "-f", str(out),
                    "--length-scale", str(speed)], input=text.encode(), check=True, capture_output=True)


def synth(text, cfg, cache_dir, piper_model=None, log=print):
    """Return path to a wav for `text` using voice config `cfg` (cached)."""
    cache_dir = Path(cache_dir); cache_dir.mkdir(parents=True, exist_ok=True)
    out = cache_dir / _cache_name(cfg, text)
    if out.exists():
        return out
    eng = cfg.get("engine", "piper")
    log(f"tts[{eng}:{cfg.get('voice', '')}]: {text[:60]}")
    tmp = out.with_suffix(".tmp.wav")
    if eng == "gemini":
        gemini(text, tmp, cfg.get("voice", "Charon"), cfg.get("style", ""),
               cfg.get("model", "gemini-3.8-flash-tts"))
    else:
        piper(text, tmp, piper_model, cfg.get("speed", 1.0))
    tmp.rename(out)
    return out
