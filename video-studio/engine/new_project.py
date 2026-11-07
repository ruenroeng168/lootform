#!/usr/bin/env python3
"""Create a new video project from a template.

    python3 video-studio/engine/new_project.py product-review my-bottle
    python3 video-studio/engine/new_project.py --list

Copies projects/_templates/<template> to projects/<name> (with an assets/ folder for
photos). Edit data.json + script.json, then:

    python3 video-studio/engine/build.py video-studio/projects/<name>
"""
import shutil
import sys
from pathlib import Path

STUDIO = Path(__file__).resolve().parent.parent
TEMPLATES = STUDIO / "projects" / "_templates"


def main(argv):
    if not argv or argv[0] == "--list":
        print("templates:", ", ".join(sorted(p.name for p in TEMPLATES.iterdir() if p.is_dir())))
        return
    template, name = argv[0], argv[1]
    src, dst = TEMPLATES / template, STUDIO / "projects" / name
    if not src.is_dir():
        sys.exit(f"no template '{template}'")
    if dst.exists():
        sys.exit(f"{dst} already exists")
    shutil.copytree(src, dst, ignore=shutil.ignore_patterns("out"))
    (dst / "assets").mkdir(exist_ok=True)
    print(f"created {dst}\n  put photos in {dst / 'assets'} and list them in data.json \"images\"")


if __name__ == "__main__":
    main(sys.argv[1:])
