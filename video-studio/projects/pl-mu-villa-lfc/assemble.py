"""Merge data_goals.json + photo plan + CREDITS.json -> data.json"""
import json
d = json.load(open("data_goals.json"))
cred = {c["key"]: c for c in json.load(open("assets/CREDITS.json"))}
short = {"Arne Müseler": "Arne Müseler"}
d["segments"] = [
    {"cue": "hook", "img": "oldtrafford", "kb": "in"},
    {"cue": "mu1", "img": "jackson", "match": "mu"},
    {"cue": "mu2", "img": "bruno", "match": "mu", "swaps": [{"mark": 2, "img": "tielemans"}]},
    {"cue": "mu3", "img": "mcginn", "match": "mu"},
    {"cue": "mu4", "img": "zirkzee", "match": "mu", "swaps": [{"mark": 3, "img": "dorgu", "delay": 0.9}]},
    {"cue": "mu5", "img": "oldtrafford", "match": "mu", "kb": "out"},
    {"cue": "lfc1", "img": "selhurst", "match": "lfc", "swaps": [{"mark": 1, "img": "macallister"}, {"mark": 2, "img": "wirtz"}, {"mark": 3, "img": "isak"}]},
    {"cue": "lfc2", "img": "wirtz", "match": "lfc", "kb": "out"},
    {"cue": "cta", "img": "oldtrafford", "kb": "out"},
]
keys = {s["img"] for s in d["segments"]} | {w["img"] for s in d["segments"] for w in s.get("swaps", [])}
missing = [k for k in keys if k not in cred]
if missing:
    raise SystemExit(f"missing photos: {missing}")
d["images"] = {k: f"assets/{k}.jpg" for k in sorted(keys)}
d["inset"] = {"dorgu": True}
d["focus"] = {"oldtrafford": [0.5, 0.45], "selhurst": [0.5, 0.5], "jackson": [0.5, 0.3], "bruno": [0.5, 0.3],
              "tielemans": [0.5, 0.3], "mcginn": [0.5, 0.3], "zirkzee": [0.5, 0.25], "macallister": [0.5, 0.3], "wirtz": [0.5, 0.3], "isak": [0.5, 0.3]}
def author(a):
    a = a.replace("\n", " ").strip()
    return a if len(a) < 40 else a[:38] + "…"
d["credits"] = [{"key": k, "author": author(c["author"]), "license": c["license"], "year": (c["date"] or "")[:4]} for k, c in cred.items()]
json.dump(d, open("data.json", "w"), ensure_ascii=False, indent=1)
print("data.json ok:", sorted(keys))
