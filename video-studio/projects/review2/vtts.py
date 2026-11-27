import sys, json; from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "engine")); import tts
L = json.loads((Path(__file__).parent / "edl.json").read_text())
VOICE = {"engine": "gemini", "model": "gemini-3.8-flash-tts", "voice": "Puck",
         "style": "Read exactly the given Thai text and nothing else. Do not add, improvise or repeat anything. A friendly, confident Thai electrician from Ubon Ratchathani showing useful tools on a short video; lively, clear, natural pacing. The brand name อุบลเด้อ is said the Isan way (เด้อ as in ไปเด้อ), never like the English word 'der'.",
         "notes": "Read the paragraphs in order. After every paragraph pause silently for about one second."}
print(tts.synth("\n\n".join(l["text"] for l in L), VOICE, Path(__file__).parent / "out" / "vo", None, print))
