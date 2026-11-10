"""Regressions for a universal (not comedy-only) video production Skill."""
import csv
import importlib.util
import json
from pathlib import Path
import tempfile
import unittest

ROOT = Path(__file__).resolve().parents[1]


def load(name, relative):
    spec = importlib.util.spec_from_file_location(name, ROOT / relative)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


story_mod = load("validate_story", "scripts/validate_story.py")
claims_mod = load("check_claims", "scripts/check_claims.py")


class VideoSkillTests(unittest.TestCase):
    def test_all_genres_validate(self):
        examples = (
            "engineers-comedy.json",
            "product-review.json",
            "product-sales.json",
            "education-explainer.json",
            "interview-highlight.json",
        )
        for filename in examples:
            with self.subTest(filename=filename):
                data = json.loads((ROOT / "examples" / filename).read_text(encoding="utf-8"))
                errors, warnings = story_mod.validate(data)
                self.assertEqual(errors, [], f"{filename}: {errors}, {warnings}")

    def test_silent_landscape_video_without_characters(self):
        data = {
            "id":"silent-demo", "title":"motion infographic", "language":"th-TH",
            "video":{"width":1920, "height":1080, "fps":30},
            "shots":[{"id":"s1", "start_seconds":0, "end_seconds":10,
                      "purpose":"explain a chart", "on_screen_text":"ตัวอย่าง"}]
        }
        errors, warnings = story_mod.validate(data)
        self.assertEqual(errors, [])
        self.assertEqual(warnings, [])

    def test_duplicate_ids_detected(self):
        data = {"id":"v", "title":"x", "language":"th-TH", "video":{"width":1080,"height":1920,"fps":30},
                "shots":[{"id":"x", "start_seconds":0,"end_seconds":5,"purpose":"start"},
                         {"id":"x", "start_seconds":5,"end_seconds":10,"purpose":"end"}]}
        errors, _ = story_mod.validate(data)
        self.assertTrue(any("Duplicate shot ID" in e for e in errors))

    def test_explicit_overlap_allowed(self):
        data = {"id":"v", "title":"x", "language":"th-TH", "video":{"width":1080,"height":1920,"fps":30},
                "shots":[{"id":"x", "start_seconds":0,"end_seconds":5,"purpose":"start"},
                         {"id":"y", "start_seconds":4.75,"end_seconds":10,"purpose":"crossfade","allow_overlap":True}]}
        errors, _ = story_mod.validate(data)
        self.assertEqual(errors, [])

    def test_overlap_without_flag_rejected(self):
        data = {"id":"v", "title":"x", "language":"th-TH", "video":{"width":1080,"height":1920,"fps":30},
                "shots":[{"id":"x", "start_seconds":0,"end_seconds":5,"purpose":"start"},
                         {"id":"y", "start_seconds":4.75,"end_seconds":10,"purpose":"crossfade"}]}
        errors, _ = story_mod.validate(data)
        self.assertTrue(any("overlapping" in e for e in errors))

    def test_unverified_material_claim_blocks(self):
        with tempfile.TemporaryDirectory() as temp:
            p = Path(temp) / "claims.csv"
            with p.open("w", newline="", encoding="utf-8") as f:
                writer = csv.DictWriter(f, fieldnames=["claim_id","claim","evidence","status","material","on_screen_treatment"])
                writer.writeheader()
                writer.writerow({"claim_id":"C1", "claim":"fastest product", "evidence":"", "status":"UNVERIFIED", "material":"yes", "on_screen_treatment":"show"})
            errors, _, _ = claims_mod.check(p)
            self.assertTrue(any("not release-ready" in e for e in errors))

    def test_omitted_claim_passes(self):
        errors, warnings, count = claims_mod.check(ROOT / "examples/claims/product-review.csv")
        self.assertEqual(errors, [])
        self.assertEqual(count, 1)

    def test_verified_requires_evidence(self):
        with tempfile.TemporaryDirectory() as temp:
            p = Path(temp) / "claims.csv"
            p.write_text("claim_id,claim,evidence,status,material,on_screen_treatment\nC1,has feature,,VERIFIED,yes,show\n", encoding="utf-8")
            errors, _, _ = claims_mod.check(p)
            self.assertTrue(any("missing evidence" in e for e in errors))


if __name__ == "__main__":
    unittest.main()
