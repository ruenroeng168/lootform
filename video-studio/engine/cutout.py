#!/usr/bin/env python3
"""Remove image backgrounds (local AI, no upload) for floating product shots.

    python3 video-studio/engine/cutout.py <img> [<img> ...] [-o OUTDIR] [--fast] [--crop x0,y0,x1,y1]
                                         [--pad 0.06] [--preview]

- Default model: BiRefNet (birefnet-general-lite) — best edges (hooks, cables, hair); ~10-30 s/img on CPU.
- --fast: ISNet (isnet-general-use) — ~1-2 s/img, may lose thin parts.
- Output: <OUTDIR>/<name>.png (RGBA, trimmed to the subject + padding). Default OUTDIR: <img dir>/cut
- --preview writes <OUTDIR>/_preview.jpg (cutouts on checkerboard + dark background) to inspect quality.

Limits: text/stickers printed over the product stay (they are part of the pixels);
white product on white backdrop can be partly lost — check the preview.
Models download once into video-studio/models/ (gitignored).
"""
import argparse
import os
import sys
from pathlib import Path

STUDIO = Path(__file__).resolve().parent.parent
os.environ.setdefault("U2NET_HOME", str(STUDIO / "models"))

from PIL import Image, ImageFilter  # noqa: E402


def trim(im, pad=0.06):
    a = im.split()[-1].point(lambda v: 255 if v > 12 else 0)
    box = a.getbbox()
    if not box:
        return im
    x0, y0, x1, y1 = box
    p = int(max(x1 - x0, y1 - y0) * pad)
    out = Image.new("RGBA", (x1 - x0 + 2 * p, y1 - y0 + 2 * p), (0, 0, 0, 0))
    out.paste(im.crop(box), (p, p))
    return out


def clean_alpha(im):
    """Light matte cleanup: drop faint speckles, soften the edge by ~1 px."""
    r, g, b, a = im.split()
    a = a.point(lambda v: 0 if v < 10 else v).filter(ImageFilter.GaussianBlur(0.6))
    return Image.merge("RGBA", (r, g, b, a))


def preview(paths, out):
    tiles = []
    for p in paths:
        c = Image.open(p); c.thumbnail((420, 420))
        for bg in ("checker", (24, 26, 34)):
            if bg == "checker":
                t = Image.new("RGB", c.size, (255, 255, 255)); px = t.load()
                for y in range(c.height):
                    for x in range(c.width):
                        if (x // 20 + y // 20) % 2:
                            px[x, y] = (218, 220, 228)
            else:
                t = Image.new("RGB", c.size, bg)
            t.paste(c, (0, 0), c); tiles.append(t)
    W = sum(t.width for t in tiles) + 16 * len(tiles)
    sheet = Image.new("RGB", (W, max(t.height for t in tiles)), "white"); x = 0
    for t in tiles:
        sheet.paste(t, (x, 0)); x += t.width + 16
    sheet.save(out, quality=90)


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("images", nargs="+")
    ap.add_argument("-o", "--outdir")
    ap.add_argument("--fast", action="store_true", help="ISNet instead of BiRefNet")
    ap.add_argument("--crop", help="crop box x0,y0,x1,y1 applied before matting")
    ap.add_argument("--pad", type=float, default=0.06)
    ap.add_argument("--preview", action="store_true")
    a = ap.parse_args()
    from rembg import new_session, remove
    model = "isnet-general-use" if a.fast else "birefnet-general-lite"
    sess = new_session(model)
    written = []
    for src in a.images:
        src = Path(src)
        outdir = Path(a.outdir) if a.outdir else src.parent / "cut"
        outdir.mkdir(parents=True, exist_ok=True)
        im = Image.open(src).convert("RGB")
        if a.crop:
            im = im.crop(tuple(int(v) for v in a.crop.split(",")))
        cut = remove(im, session=sess, post_process_mask=True)
        cut = trim(clean_alpha(cut), a.pad)
        dst = outdir / (src.stem + ".png")
        cut.save(dst)
        cover = sum(1 for v in cut.split()[-1].getdata() if v > 128) / (cut.width * cut.height)
        print(f"[cutout:{model}] {src.name} -> {dst}  ({cut.width}x{cut.height}, subject {cover:.0%})")
        written.append(dst)
    if a.preview and written:
        pv = written[0].parent / "_preview.jpg"
        preview(written, pv)
        print("[cutout] preview:", pv)


if __name__ == "__main__":
    sys.exit(main())
