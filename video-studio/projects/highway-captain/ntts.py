import sys, json; from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "engine")); import tts
N = json.loads(Path("narr.json").read_text())
VOICE = {"engine": "gemini", "model": "gemini-3.8-flash-tts", "voice": "Puck",
         "style": "Read exactly the given Thai text and nothing else. An intense, gritty Thai sports-documentary and movie-trailer narrator; deep, punchy and dramatic, building tension, short sharp pauses.",
         "notes": "Read the paragraphs in order, word for word, with a silent pause between paragraphs. Do not add, improvise or repeat anything."}
print(tts.synth("\n\n".join(n[1] for n in N), VOICE, Path("out/n2"), None, print))
