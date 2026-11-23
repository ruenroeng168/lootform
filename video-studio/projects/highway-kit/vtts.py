import sys, json; from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "engine")); import tts
L = json.loads((Path(__file__).parent / "narr.json").read_text())
VOICE = {"engine": "gemini", "model": "gemini-3.8-flash-tts", "voice": "Puck",
         "style": "Read exactly the given Thai text and nothing else. Do not add, improvise or repeat anything. A deep, slow, powerful movie-trailer narrator for a football club's new kit launch: low register, confident, cinematic, dramatic pauses on the ellipses, intense but controlled, not shouting.",
         "notes": "Read the paragraphs in order. After every paragraph pause silently for about one and a half seconds."}
print(tts.synth("\n\n".join(l[1] for l in L), VOICE, Path(__file__).parent / "out" / "n", None, print))
