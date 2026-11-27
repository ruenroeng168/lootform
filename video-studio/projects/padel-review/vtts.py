import sys, json; from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "engine")); import tts
L = json.loads((Path(__file__).parent / "ubon.json").read_text())
VOICE = {"engine": "gemini", "model": "gemini-3.8-flash-tts", "voice": "Puck",
         "style": "Read exactly the given Thai text and nothing else. Do not add, improvise or repeat anything. A friendly, warm young man from Ubon Ratchathani (Isan) recommending a local service to friends; natural, clear, upbeat but not salesy. The brand name อุบลเด้อ is said the Isan way (เด้อ as in ไปเด้อ), never like the English word 'der'.",
         "notes": "Read the two paragraphs in order with a one-second pause between them."}
print(tts.synth("\n\n".join(l[1] for l in L), VOICE, Path(__file__).parent / "out" / "u", None, print))
