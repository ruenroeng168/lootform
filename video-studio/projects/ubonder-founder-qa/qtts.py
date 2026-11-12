import sys, json; from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "engine")); import tts
Q = json.loads(Path("questions.json").read_text())
VOICE = {"engine": "gemini", "model": "gemini-3.8-flash-tts", "voice": "Puck",
         "style": "A friendly, professional young Thai male podcast host interviewing a young app founder from Ubon Ratchathani; warm, curious, upbeat and clear, natural conversational Thai, not announcer-like",
         "notes": "Read the paragraphs in order. After every paragraph stay completely silent for two full seconds before the next one."}
w = tts.synth("\n\n".join(q[1] for q in Q), VOICE, Path("out/q"), None, print); print(w)
