#!/usr/bin/env python3
"""Validate format-agnostic video timeline JSON (stdlib only).

Examples:
  python scripts/validate_story.py examples/engineers-comedy.json
  python scripts/validate_story.py examples/product-review.json

Checks structure and time; does not validate creative quality, assets or audio playback.
Backward-compatible with old comedy/story documents.
"""
import argparse
import json
from pathlib import Path
import sys


def number(value):
    return isinstance(value, (int, float)) and not isinstance(value, bool)


def validate(data):
    errors, warnings = [], []
    if not isinstance(data, dict):
        return ["JSON root must be an object"], warnings
    for field in ("id", "title", "language", "video", "shots"):
        if field not in data:
            errors.append(f"Missing required field: {field}")
    for field in ("id", "title", "language"):
        if field in data and (not isinstance(data[field], str) or not data[field].strip()):
            errors.append(f"{field} must be nonempty string")

    video = data.get("video", {})
    if not isinstance(video, dict):
        errors.append("video must be object")
        video = {}
    for key in ("fps", "width", "height"):
        val = video.get(key)
        if not isinstance(val, int) or isinstance(val, bool) or val <= 0:
            errors.append(f"video.{key} must be positive integer")
    target = video.get("duration_target_seconds")
    if target is not None and (not number(target) or target <= 0):
        errors.append("video.duration_target_seconds must be positive number when provided")

    kind = data.get("content_type", "unspecified")
    if not isinstance(kind, str):
        errors.append("content_type must be string when provided")
        kind = "unspecified"

    chars = data.get("characters", [])
    if not isinstance(chars, list):
        errors.append("characters must be array when provided")
        chars = []
    char_ids = set()
    for i, char in enumerate(chars):
        if not isinstance(char, dict):
            errors.append(f"characters[{i}] must be object")
            continue
        ident = char.get("id")
        if not isinstance(ident, str) or not ident.strip():
            errors.append(f"characters[{i}].id missing or invalid")
        elif ident in char_ids:
            errors.append(f"Duplicate character ID: {ident}")
        else:
            char_ids.add(ident)

    hook = data.get("hook")
    if hook is not None and not isinstance(hook, dict):
        errors.append("hook must be object when provided")
    elif isinstance(hook, dict) and not hook.get("first_frame"):
        warnings.append("Hook has no first-frame plan; consider one if relevant")

    shots = data.get("shots", [])
    if not isinstance(shots, list) or not shots:
        errors.append("shots must be a nonempty array")
        shots = []
    prev_end = 0.0
    shot_ids = set()
    voiced_shots = 0
    dialogue_without_voice = 0
    fps = video.get("fps")
    for i, shot in enumerate(shots):
        prefix = f"shots[{i}]"
        if not isinstance(shot, dict):
            errors.append(f"{prefix} must be object")
            continue
        sid = shot.get("id")
        if not isinstance(sid, str) or not sid.strip():
            errors.append(f"{prefix}.id missing or invalid")
        elif sid in shot_ids:
            errors.append(f"Duplicate shot ID: {sid}")
        else:
            shot_ids.add(sid)
        start, end = shot.get("start_seconds"), shot.get("end_seconds")
        if not all(number(t) for t in (start, end)):
            errors.append(f"{prefix}: start_seconds/end_seconds must be numbers")
            continue
        if start < 0 or end <= start:
            errors.append(f"{prefix}: invalid time range {start}..{end}")
        if i == 0 and abs(start) > 0.0334:
            errors.append("First shot must start at 0 seconds")
        if i > 0:
            if start < prev_end - 0.035 and not shot.get("allow_overlap", False):
                errors.append(f"{prefix}: overlapping shots without allow_overlap: {start:.3f} < {prev_end:.3f}")
            elif start > prev_end + 0.035:
                warnings.append(f"{prefix}: timeline gap {start-prev_end:.2f}s; verify intentional")
        prev_end = max(prev_end, end)
        speaker = shot.get("speaker")
        if speaker is not None and (not isinstance(speaker, str) or not speaker.strip()):
            errors.append(f"{prefix}: speaker must be nonempty string or null")
        # Speaker can refer to a supplied voiceover/person not listed as recurring 'character'.
        elif speaker and char_ids and speaker not in char_ids:
            warnings.append(f"{prefix}: speaker {speaker!r} not in characters; confirm external voice")
        dialogue = shot.get("dialogue", "")
        if dialogue is not None and not isinstance(dialogue, str):
            errors.append(f"{prefix}.dialogue must be string or null")
        elif isinstance(dialogue, str) and dialogue.strip():
            voiced_shots += 1
            if not shot.get("voice_asset"):
                dialogue_without_voice += 1
        for key in ("subtitle", "visual", "purpose", "camera", "on_screen_text"):
            value = shot.get(key)
            if value is not None and not isinstance(value, str):
                errors.append(f"{prefix}.{key} must be string when provided")
        if not isinstance(shot.get("purpose"), str) or not shot["purpose"].strip():
            errors.append(f"{prefix}: missing purpose")
        if fps and isinstance(fps, int) and not isinstance(fps, bool):
            if round(end*fps) <= round(start*fps):
                errors.append(f"{prefix} spans zero frames at {fps} fps")
        for key in ("image_asset", "video_asset", "voice_asset", "sfx"):
            if shot.get(key) is not None and not isinstance(shot[key], str):
                errors.append(f"{prefix}.{key} must be path string or null")

    if shots and number(target) and target > 0 and abs(prev_end-target) > 4:
        warnings.append(f"Timeline {prev_end:.1f}s differs from target {target}s; retime from source media")
    if voiced_shots and dialogue_without_voice:
        warnings.append(f"{dialogue_without_voice}/{voiced_shots} spoken shots lack voice_asset; timing provisional")
    if kind in ("product_review", "product_sales", "education", "documentary"):
        if not data.get("claims_ledger"):
            warnings.append("Fact/claim-sensitive content has no claims_ledger path; add and check before release")
    return errors, warnings


def main():
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument("story", type=Path)
    args = p.parse_args()
    try:
        data = json.loads(args.story.read_text(encoding="utf-8"))
    except (OSError, ValueError) as exc:
        print(f"FAIL: cannot load story: {exc}")
        return 2
    errors, warnings = validate(data)
    print(f"STORY: {args.story}")
    print(f"Content type: {data.get('content_type', 'unspecified') if isinstance(data, dict) else 'invalid'}")
    print(f"Shots: {len(data.get('shots', [])) if isinstance(data, dict) and isinstance(data.get('shots', []), list) else 0}")
    for msg in warnings:
        print("WARN:", msg)
    for msg in errors:
        print("FAIL:", msg)
    print("RESULT:", "FAIL" if errors else "STRUCTURE PASS (NOT a creative/media/claims approval)")
    return 1 if errors else 0


if __name__ == "__main__":
    sys.exit(main())
