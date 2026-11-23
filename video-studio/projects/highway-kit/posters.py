#!/usr/bin/env python3
"""Static launch posters for the 2027 kit (same look as the video): out/poster_main.jpg (4:5 lineup),
out/poster_back.jpg (4:5 back 47 + giant 2027), out/poster_story.jpg (9:16 ambassador)."""
import numpy as np, cv2
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont, ImageFilter
import prep

HERE = Path(__file__).resolve().parent; OUT = HERE / "out"; FONTS = HERE.parent.parent / "assets" / "fonts"
TH = str(FONTS / "IBMPlexSansThai-Bold.ttf"); EN = str(FONTS / "ChakraPetch-Bold.ttf")
GREEN = (61, 220, 132); WHITE = (255, 255, 255)


def stage(w, h, seed):
    rng = np.random.default_rng(seed); yy, xx = np.mgrid[0:h, 0:w].astype(np.float32)
    bg = np.zeros((h, w, 3), np.float32) + np.array([18, 40, 22], np.float32) * (1 - 0.5 * yy / h)[..., None]
    bg += np.exp(-(((xx - w / 2) / (w * 0.5)) ** 2 + ((yy - h * 0.48) / (h * 0.42)) ** 2))[..., None] * np.array([40, 135, 50], np.float32)
    for _ in range(4):
        x0 = rng.uniform(-0.2 * w, w); a = rng.uniform(0.25, 0.5); d = np.abs((xx - x0) - yy * a)
        bg += (np.exp(-(d / rng.uniform(16, 38)) ** 2) * 50)[..., None] * np.array([0.7, 1.0, 0.75], np.float32)
    for _ in range(30):
        cx, cy, r = rng.uniform(0, w), rng.uniform(0, h * 0.5), rng.uniform(5, 20)
        bg += (np.exp(-(((xx - cx) ** 2 + (yy - cy) ** 2) / (r * r))) * rng.uniform(40, 110))[..., None] * np.array([0.8, 0.95, 1.0], np.float32)
    d = np.sqrt(((xx - w / 2) / (w * 0.6)) ** 2 + ((yy - h / 2) / (h * 0.6)) ** 2)
    bg *= (1 - 0.35 * np.clip(d - 0.5, 0, 1) ** 1.5)[..., None]
    return Image.fromarray(np.clip(bg, 0, 255).astype(np.uint8)[..., ::-1].copy()).convert("RGBA")


def player(name, height):
    cut = cv2.imread(str(prep.CUT / f"{prep.fn(name)}.png"), cv2.IMREAD_UNCHANGED)
    rgb = prep.grade(cut[..., :3]); im = Image.fromarray(np.dstack([rgb[..., ::-1], cut[..., 3]]))
    s = height / im.height; return im.resize((int(im.width * s), height), Image.LANCZOS)


def paste_glow(base, im, x, y):
    a = im.split()[3]; glow = Image.new("RGBA", im.size, GREEN + (0,)); glow.putalpha(a.filter(ImageFilter.GaussianBlur(18)).point(lambda v: int(v * 0.7)))
    shadow = Image.new("RGBA", im.size, (0, 0, 0, 0)); shadow.putalpha(a.filter(ImageFilter.GaussianBlur(30)).point(lambda v: int(v * 0.5)))
    base.alpha_composite(shadow, (x + 12, y + 18)); base.alpha_composite(glow, (x, y)); base.alpha_composite(im, (x, y))


def text(d, xy, s, size, fill, font=EN, anchor="mm", spacing=0, stroke=0):
    f = ImageFont.truetype(font, size)
    if spacing and font == EN:
        w = sum(d.textlength(c, font=f) for c in s) + spacing * (len(s) - 1); x = xy[0] - w / 2 if anchor[0] == "m" else xy[0]
        for c in s: d.text((x, xy[1]), c, font=f, fill=fill, anchor="l" + anchor[1]); x += d.textlength(c, font=f) + spacing
    else:
        d.text(xy, s, font=f, fill=fill, anchor=anchor, stroke_width=stroke, stroke_fill=(0, 0, 0, 200))


def logo(h):
    im = Image.open(HERE / "assets" / "logo.png").convert("RGBA"); s = h / im.height
    return im.resize((int(im.width * s), h), Image.LANCZOS)


def giant(base, s, cx, cy, size, alpha=70, outline=True):
    layer = Image.new("RGBA", base.size, (0, 0, 0, 0)); d = ImageDraw.Draw(layer); f = ImageFont.truetype(EN, size)
    if outline: d.text((cx, cy), s, font=f, anchor="mm", fill=(0, 0, 0, 0), stroke_width=4, stroke_fill=(130, 230, 160, alpha))
    else: d.text((cx, cy), s, font=f, anchor="mm", fill=(120, 235, 160, alpha))
    base.alpha_composite(layer)


def bottom_fade(base, y0, strength=200):
    w, h = base.size; g = Image.new("L", (1, h - y0)); g.putdata([int(strength * (i / (h - y0)) ** 1.2) for i in range(h - y0)])
    base.alpha_composite(Image.merge("RGBA", [Image.new("L", (w, h - y0), 0)] * 3 + [g.resize((w, h - y0))]), (0, y0))


def main_poster():
    W, H = 1080, 1350; base = stage(W, H, 1); giant(base, "HIGHWAY", W // 2, 600, 300)
    lineup = [("s13", 900, 120), ("220306", 960, 290), ("220302", 1060, 540), ("220304", 960, 790), ("s09", 900, 960)]
    order = [0, 4, 1, 3, 2]
    for i in order:
        nm, ht, cx = lineup[i]; im = player(nm, ht); paste_glow(base, im, int(cx - im.width / 2), H + 40 - ht)
    bottom_fade(base, 760, 245)
    lg = logo(230); base.alpha_composite(lg, ((W - lg.width) // 2, 30))
    d = ImageDraw.Draw(base)
    text(d, (W // 2, 1020), "ทางหลวง FC", 104, WHITE, TH, stroke=3)
    d.rectangle([W // 2 - 230, 1092, W // 2 + 230, 1096], fill=GREEN)
    text(d, (W // 2, 1150), "NEW KIT 2027", 70, GREEN, spacing=14)
    text(d, (W // 2, 1250), "NEW KIT • NEW ERA", 40, WHITE, spacing=10)
    base.convert("RGB").save(OUT / "poster_main.jpg", quality=94)


def back_poster():
    W, H = 1080, 1350; base = stage(W, H, 7); giant(base, "2027", W // 2, 560, 470, 60, outline=False)
    im = player("s17", 1150); paste_glow(base, im, (W - im.width) // 2, H - 1150 + 60)
    bottom_fade(base, 950, 230)
    lg = logo(190); base.alpha_composite(lg, (45, 35))
    d = ImageDraw.Draw(base)
    text(d, (W - 60, 95), "HOME KIT", 44, GREEN, anchor="rm"); text(d, (W - 60, 150), "2027", 44, WHITE, anchor="rm")
    text(d, (W // 2, 1175), "ฤดูกาลใหม่ เป้าหมายเดิม", 76, WHITE, TH, stroke=3)
    text(d, (W // 2, 1270), "HIGHWAY FC", 46, GREEN, spacing=14)
    base.convert("RGB").save(OUT / "poster_back.jpg", quality=94)


def story_poster():
    W, H = 1080, 1920; base = stage(W, H, 3); giant(base, "HIGHWAY", W // 2, 900, 330)
    im = player("220302", 1500); paste_glow(base, im, (W - im.width) // 2, H + 60 - 1500)
    bottom_fade(base, 1180, 240)
    lg = logo(250); base.alpha_composite(lg, ((W - lg.width) // 2, 70))
    d = ImageDraw.Draw(base)
    text(d, (W // 2, 1480), "เราคือ… ทางหลวง", 100, WHITE, TH, stroke=3)
    d.rectangle([W // 2 - 220, 1560, W // 2 + 220, 1564], fill=GREEN)
    text(d, (W // 2, 1630), "NEW KIT 2027", 76, GREEN, spacing=16)
    text(d, (W // 2, 1730), "NEW KIT • NEW ERA", 42, WHITE, spacing=10)
    base.convert("RGB").save(OUT / "poster_story.jpg", quality=94)


if __name__ == "__main__":
    main_poster(); back_poster(); story_poster(); print("ok")
