import sys, json; from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "engine")); import tts
L = json.loads(Path("lines.json").read_text())
VOICE = {"engine": "gemini", "model": "gemini-3.8-flash-tts", "voice": "Puck",
         "style": "An energetic young Thai male gamer narrating a game trailer for a Thai village-themed MMORPG; excited, punchy and genuine, casual like talking to friends, not salesy or over-hyped",
         "notes": "Read the paragraphs in order. After every paragraph pause silently for about one and a half seconds before the next one. Do not add or repeat anything."}
print(tts.synth("\n\n".join(l[2] for l in L), VOICE, Path("out/vo"), None, print))
