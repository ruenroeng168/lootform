#!/usr/bin/env python3
"""Generate an image with Gemini (Nano Banana) straight into a project.

    export GEMINI_API_KEY=...            # never commit the key
    python3 engine/gen_image.py OUT.jpg "prompt" [--ref=img.jpg ...] [--aspect=9:16] [--model=gemini-3.1-flash-image] [--size=1K|2K]

--ref passes reference images (e.g. keep the same technician / room across shots, or edit a photo).
"""
import base64, json, os, sys, urllib.request
from pathlib import Path

args = [a for a in sys.argv[1:] if not a.startswith("--")]
opt = {k: v for k, _, v in (a[2:].partition("=") for a in sys.argv[1:] if a.startswith("--") and not a.startswith("--ref="))}
refs = [a[6:] for a in sys.argv[1:] if a.startswith("--ref=")]
if len(args) < 2: sys.exit(__doc__)
out, prompt = Path(args[0]), " ".join(args[1:])
model = opt.get("model", "gemini-3.1-flash-image")
parts = [{"inlineData": {"mimeType": "image/png" if r.endswith(".png") else "image/jpeg",
                         "data": base64.b64encode(Path(r).read_bytes()).decode()}} for r in refs] + [{"text": prompt}]
body = {"contents": [{"parts": parts}],
        "generationConfig": {"responseModalities": ["IMAGE"],
                             "imageConfig": {"aspectRatio": opt.get("aspect", "9:16"), **({"imageSize": opt["size"]} if "size" in opt else {})}}}
req = urllib.request.Request(f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent",
                             data=json.dumps(body).encode(),
                             headers={"Content-Type": "application/json", "x-goog-api-key": os.environ["GEMINI_API_KEY"]})
try:
    d = json.load(urllib.request.urlopen(req, timeout=300))
except urllib.error.HTTPError as e:
    sys.exit(f"[gen_image] HTTP {e.code}: {e.read().decode()[:500]}")
for p in d.get("candidates", [{}])[0].get("content", {}).get("parts", []):
    if "inlineData" in p:
        raw = base64.b64decode(p["inlineData"]["data"]); out.parent.mkdir(parents=True, exist_ok=True)
        if out.suffix.lower() in (".jpg", ".jpeg") and p["inlineData"]["mimeType"] != "image/jpeg":
            import cv2, numpy as np
            cv2.imwrite(str(out), cv2.imdecode(np.frombuffer(raw, np.uint8), cv2.IMREAD_COLOR), [cv2.IMWRITE_JPEG_QUALITY, 92])
        else:
            out.write_bytes(raw)
        print(f"[gen_image] wrote {out}"); break
else:
    sys.exit(f"[gen_image] no image returned: {json.dumps(d, ensure_ascii=False)[:600]}")
