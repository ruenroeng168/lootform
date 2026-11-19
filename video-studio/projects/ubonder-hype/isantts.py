import sys, json; from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "engine")); import tts
N = json.loads(Path("isan.json").read_text())
VOICE = {"engine": "gemini", "model": "gemini-3.8-flash-tts", "voice": "Puck",
         "style": ("Read exactly the given Thai text and nothing else. A punchy, high-energy young man from Ubon Ratchathani (Isan, Northeast Thailand) doing a viral promo. "
                   "The brand name อุบลเด้อ must be said the way Isan people say the particle เด้อ in everyday Lao-Isan speech (as in ไปเด้อ, กินเข่าเด้อ): "
                   "short warm 'เด้อ' with the Isan rising-falling tone, never like the English word 'der'. Say it proudly with a local Isan accent."),
         "notes": "Read the paragraphs in order, word for word, with a short silent pause between paragraphs. Do not add, improvise or repeat anything."}
print(tts.synth("\n\n".join(n[1] for n in N), VOICE, Path("out/isan"), None, print))
