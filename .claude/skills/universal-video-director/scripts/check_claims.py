#!/usr/bin/env python3
"""Check that a video claims ledger has no unresolved material claims.

Standard library only. Does not validate the truth of the evidence; a human must.
"""
import argparse
import csv
from pathlib import Path
import sys

REQUIRED = {"claim_id", "claim", "evidence", "status", "material", "on_screen_treatment"}
ALLOWED = {"VERIFIED", "UNVERIFIED", "REJECTED", "OMITTED"}


def check(path):
    errors, warnings = [], []
    with path.open(encoding="utf-8-sig", newline="") as f:
        reader = csv.DictReader(f)
        fields = set(reader.fieldnames or [])
        if REQUIRED - fields:
            return [f"Missing columns: {', '.join(sorted(REQUIRED-fields))}"], warnings, 0
        ids = set()
        count = 0
        for i, row in enumerate(reader, start=2):
            if not any(v.strip() for v in row.values() if isinstance(v, str)):
                continue
            count += 1
            claim_id = (row.get("claim_id") or "").strip()
            claim = (row.get("claim") or "").strip()
            evidence = (row.get("evidence") or "").strip()
            material = (row.get("material") or "").strip().lower()
            status = (row.get("status") or "").strip().upper()
            if not claim_id or not claim:
                errors.append(f"row {i}: claim_id and claim required")
            if claim_id in ids:
                errors.append(f"row {i}: duplicate claim_id {claim_id}")
            ids.add(claim_id)
            if material not in ("yes", "no"):
                errors.append(f"row {i}: material must be yes or no")
            if status not in ALLOWED:
                errors.append(f"row {i}: invalid status {status!r}")
            if material == "yes" and status not in ("VERIFIED", "OMITTED"):
                errors.append(f"row {i}: material claim {claim_id} is {status}; not release-ready")
            if status == "VERIFIED" and not evidence:
                errors.append(f"row {i}: VERIFIED claim {claim_id} missing evidence")
            if material == "no" and status in ("UNVERIFIED", "REJECTED"):
                warnings.append(f"row {i}: non-material claim {claim_id} unresolved; omit or resolve")
        if count == 0:
            warnings.append("No claims in ledger; ensure factual project really has none")
    return errors, warnings, count


def main():
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument("ledger", type=Path)
    args = p.parse_args()
    try:
        errors, warnings, count = check(args.ledger)
    except (OSError, UnicodeError, csv.Error) as exc:
        print(f"FAIL: cannot read claims ledger: {exc}")
        return 2
    print(f"CLAIMS LEDGER: {args.ledger} ({count} rows)")
    for w in warnings:
        print("WARN:", w)
    for e in errors:
        print("FAIL:", e)
    print("RESULT:", "FAIL" if errors else "STRUCTURE PASS (evidence authenticity not checked)")
    return 1 if errors else 0


if __name__ == "__main__":
    sys.exit(main())
