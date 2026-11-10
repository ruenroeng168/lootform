#!/usr/bin/env python3
"""Generate an editable title/info card SVG for ANY video genre (stdlib only).

Supports Thai text as explicit lines separated by '|'. No external fonts included.
Example:
 python scripts/draw_title_card_svg.py --title '3 อย่างก่อนซื้อ|เครื่องมือช่าง' \
   --subtitle 'คู่มือเลือกให้ตรงงาน' --width 1080 --height 1920 \
   --theme dark --output examples/art/universal-title-card.svg
"""
import argparse
from html import escape
from pathlib import Path
import xml.etree.ElementTree as ET

PALETTES = {
    "dark": dict(bg="#111827", foreground="#F9FAFB", muted="#CDD5DF", accent="#61C5FF", panel="#192638"),
    "light": dict(bg="#F9FAFB", foreground="#172033", muted="#526071", accent="#0065D0", panel="#E9EFF5"),
    "warm": dict(bg="#271B1B", foreground="#FFF7E7", muted="#E9CFC6", accent="#FEA44A", panel="#3C2B28"),
}


def xml_text(text):
    return escape(text, quote=True)


def make_svg(title, subtitle, footer, width, height, theme):
    pal = PALETTES[theme]
    lines = [x.strip() for x in title.split("|") if x.strip()]
    if not lines:
        raise ValueError("Title may not be empty")
    if len(lines) > 4:
        raise ValueError("Use at most 4 title lines, separated by '|'")
    portrait = height > width
    margin = round(min(width, height) * 0.08)
    title_size = round(min(width, height) * (0.075 if portrait else 0.060))
    subtitle_size = round(title_size * 0.42)
    footer_size = round(title_size * 0.28)
    title_y = round(height * (0.34 if portrait else 0.38))
    line_h = round(title_size * 1.45)
    subtitle_y = title_y + line_h*len(lines) + subtitle_size
    parts = [
        f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {width} {height}" width="{width}" height="{height}" role="img" aria-label="{xml_text(title.replace("|", " "))}">',
        f'<rect width="{width}" height="{height}" fill="{pal["bg"]}"/>',
        f'<rect x="{margin}" y="{round(height*.11)}" width="{width-2*margin}" height="{round(height*.055)}" rx="{round(height*.016)}" fill="{pal["panel"]}"/>',
        f'<rect x="{margin}" y="{round(height*.22)}" width="{round(width*.1)}" height="{max(6,round(height*.006))}" fill="{pal["accent"]}" rx="4"/>',
    ]
    for i, line in enumerate(lines):
        estimated_line_size = min(title_size, round((width-2*margin)/max(1.0, len(line)*0.65)))
        parts.append(
            f'<text x="{margin}" y="{title_y+i*line_h}" font-family="Noto Sans Thai, Sarabun, sans-serif" '
            f'font-size="{estimated_line_size}" font-weight="700" fill="{pal["foreground"]}" '
            f'xml:space="preserve">{xml_text(line)}</text>'
        )
    if subtitle:
        parts.append(f'<text x="{margin}" y="{subtitle_y}" font-family="Noto Sans Thai, Sarabun, sans-serif" '
                     f'font-size="{subtitle_size}" fill="{pal["muted"]}" xml:space="preserve">{xml_text(subtitle)}</text>')
    if footer:
        parts.append(f'<text x="{margin}" y="{height-margin}" font-family="Noto Sans Thai, Sarabun, sans-serif" '
                     f'font-size="{footer_size}" fill="{pal["muted"]}">{xml_text(footer)}</text>')
    parts.append("</svg>")
    return "\n".join(parts) + "\n"


def main():
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument("--title", required=True, help="Separate title lines with vertical bar |")
    p.add_argument("--subtitle", default="")
    p.add_argument("--footer", default="")
    p.add_argument("--width", type=int, default=1080)
    p.add_argument("--height", type=int, default=1920)
    p.add_argument("--theme", choices=sorted(PALETTES), default="dark")
    p.add_argument("--output", type=Path, required=True)
    args = p.parse_args()
    if args.width <= 0 or args.height <= 0:
        p.error("width and height must be positive")
    try:
        result = make_svg(args.title, args.subtitle, args.footer, args.width, args.height, args.theme)
        ET.fromstring(result)
    except (ValueError, ET.ParseError) as exc:
        p.error(str(exc))
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(result, encoding="utf-8")
    print("CREATED:", args.output)


if __name__ == "__main__":
    main()
