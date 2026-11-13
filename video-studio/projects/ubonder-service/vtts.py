import sys, json; from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "engine")); import tts
L = json.loads(Path("lines.json").read_text())
VOICE = {"engine": "gemini", "model": "gemini-3.8-flash-tts", "voice": "Puck",
         "style": "Read exactly the given Thai text and nothing else. Warm, friendly, trustworthy young Thai man explaining a local handyman service to neighbours; clear, calm and natural.",
         "notes": "Read the paragraphs in order, word for word, with a short silent pause between paragraphs. Do not add, improvise or repeat anything."}
print(tts.synth("\n\n".join(l[1] for l in L), VOICE, Path("out/vo"), None, print))
