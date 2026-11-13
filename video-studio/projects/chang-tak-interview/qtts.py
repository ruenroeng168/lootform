import sys, json; from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "engine")); import tts
Q = json.loads(Path("questions.json").read_text())
VOICE = {"engine": "gemini", "model": "gemini-3.8-flash-tts", "voice": "Puck",
         "style": "Read exactly the given Thai text and nothing else. A friendly, curious young Thai male podcast host interviewing a local electrician; warm, upbeat, clear.",
         "notes": "Read the paragraphs in order, word for word, with a short silent pause between paragraphs. Do not add, improvise or repeat anything."}
print(tts.synth("\n\n".join(q[1] for q in Q), VOICE, Path("out/q"), None, print))
