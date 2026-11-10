#!/usr/bin/env python3
"""Draw consistent, editable SVG character cutouts without an image API.
Usage: python scripts/draw_character_svg.py --role civil --expression angry --output art/civil.svg
This is a cartoon/vector route, not photorealistic AI image generation.
"""
import argparse
from pathlib import Path

PALETTE = {
    "civil": dict(helmet="#F9A72B", jacket="#254A68", vest="#F8B536", skin="#C98560", hair="#1D2733", eyebrow="#28323B", tie=""),
    "electric": dict(helmet="#F4D648", jacket="#365B68", vest="#51BBD6", skin="#B97750", hair="#2C2332", eyebrow="#30242D", tie=""),
    "boss": dict(helmet="", jacket="#F2F5F8", vest="#F2F5F8", skin="#B9714E", hair="#414A55", eyebrow="#414A55", tie="#B49A3C"),
}


def build(role: str, expression: str, background: bool) -> str:
    c = PALETTE[role]
    eyebrow_left = "M355 692 Q417 650 471 673" if expression == "angry" else "M355 680 Q415 665 465 681"
    eyebrow_right = "M612 674 Q668 649 727 690" if expression == "angry" else "M609 681 Q668 660 730 676"
    mouth = {
        "neutral": '<path d="M470 877 Q543 900 614 878" fill="none" stroke="#5E2B2A" stroke-width="19" stroke-linecap="round"/>',
        "angry": '<path d="M467 867 Q540 834 617 872 L599 933 Q546 962 483 928 Z" fill="#5B262D" stroke="#4B2427" stroke-width="10"/><path d="M480 893 Q547 909 604 893" stroke="#F6EEE4" stroke-width="18" fill="none"/>',
        "smug": '<path d="M475 874 Q565 935 619 856" stroke="#5E2B2A" stroke-width="19" stroke-linecap="round" fill="none"/>',
        "shocked": '<ellipse cx="542" cy="887" rx="49" ry="65" fill="#62272D"/>',
    }[expression]
    helmet = f'''<g stroke="#1D3444" stroke-width="13" stroke-linejoin="round">
    <path d="M288 612 Q310 355 542 343 Q780 361 795 610 L286 610 Z" fill="{c['helmet']}" />
    <path d="M249 607 Q541 569 833 605 Q842 629 806 640 L275 640 Q241 627 249 607 Z" fill="{c['helmet']}" />
    <path d="M530 350 L535 606" stroke="#FFFFFF" stroke-opacity="0.30" stroke-width="24" />
    </g>''' if role != "boss" else '''<path d="M302 552 Q326 340 536 347 Q746 346 770 535 L726 486 Q610 454 560 422 Q453 492 322 508 Z" fill="#42474D" stroke="#1D3444" stroke-width="14"/>'''
    eyeglass = '<path d="M342 743 Q408 723 474 743 L474 793 Q404 827 350 786 Z M604 743 Q673 722 738 743 L729 789 Q656 829 608 791 Z" fill="none" stroke="#222C38" stroke-width="16"/><path d="M471 759 Q540 744 610 759" stroke="#222C38" stroke-width="14"/>' if role == "boss" else ""
    chest = (f'<path d="M412 1221 L535 1499 L668 1221" fill="none" stroke="{c["tie"]}" stroke-width="21"/>' if role == "boss" else
             f'<path d="M390 1198 L515 1620 L565 1620 L695 1198" fill="none" stroke="{c["vest"]}" stroke-width="85" stroke-linejoin="round"/>')
    gradbg = '''<g opacity="0.94"><rect width="1080" height="1920" fill="url(#bg)"/><path d="M-50 1410 L1110 1140" stroke="#B3D1D2" stroke-opacity="0.15" stroke-width="100"/><path d="M80 250 H1000" stroke="#ECFAFB" stroke-opacity="0.08" stroke-width="20"/></g>''' if background else ""
    return f'''<svg xmlns="http://www.w3.org/2000/svg" width="1080" height="1920" viewBox="0 0 1080 1920">
<defs>
  <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#15364A"/><stop offset="1" stop-color="#45837B"/></linearGradient>
  <linearGradient id="face" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#F2B68C"/><stop offset="1" stop-color="{c['skin']}"/></linearGradient>
  <filter id="drop" x="-50%" y="-50%" width="200%" height="200%"><feDropShadow dx="0" dy="22" stdDeviation="18" flood-opacity="0.28"/></filter>
</defs>
{gradbg}
<g filter="url(#drop)" stroke-linejoin="round">
  <!-- Torso, arm silhouettes and neck -->
  <path d="M180 1790 Q154 1290 327 1184 Q429 1134 539 1151 Q669 1136 754 1192 Q933 1300 911 1790 Z" fill="{c['jacket']}" stroke="#152D3C" stroke-width="24"/>
  <path d="M475 1070 L473 1220 Q542 1300 610 1221 L605 1070" fill="{c['skin']}" stroke="#583B32" stroke-width="16"/>
  {chest}
  <path d="M219 1560 Q150 1480 136 1620 Q123 1740 212 1782 L364 1770" fill="{c['jacket']}" stroke="#172E3C" stroke-width="20"/>
  <path d="M862 1570 Q956 1478 972 1633 Q973 1758 860 1791 L713 1755" fill="{c['jacket']}" stroke="#172E3C" stroke-width="20"/>
  <!-- Ears and face -->
  <ellipse cx="307" cy="810" rx="68" ry="102" fill="{c['skin']}" stroke="#653E34" stroke-width="15"/>
  <ellipse cx="774" cy="810" rx="68" ry="102" fill="{c['skin']}" stroke="#653E34" stroke-width="15"/>
  <path d="M302 568 Q530 432 769 576 L763 904 Q736 1105 539 1114 Q338 1109 310 906 Z" fill="url(#face)" stroke="#653E34" stroke-width="19"/>
  <path d="M336 924 Q538 1029 734 923" stroke="#D77A6A" stroke-opacity="0.27" stroke-width="33" fill="none"/>
  {helmet}
  <!-- Eyebrows and eyes -->
  <path d="{eyebrow_left}" stroke="{c['eyebrow']}" stroke-width="30" stroke-linecap="round" fill="none"/>
  <path d="{eyebrow_right}" stroke="{c['eyebrow']}" stroke-width="30" stroke-linecap="round" fill="none"/>
  <ellipse cx="410" cy="769" rx="29" ry="35" fill="#fff"/><ellipse cx="667" cy="769" rx="29" ry="35" fill="#fff"/>
  <circle cx="425" cy="773" r="17" fill="#202C36"/><circle cx="652" cy="773" r="17" fill="#202C36"/>
  <path d="M536 767 L513 842 Q544 858 570 840" fill="none" stroke="#9D6249" stroke-width="15" stroke-linecap="round"/>
  {mouth}
  {eyeglass}
  <path d="M450 1620 Q546 1653 629 1620" fill="none" stroke="#FFFFFF" stroke-width="13" stroke-opacity="0.25"/>
</g>
</svg>'''


def main():
    p = argparse.ArgumentParser()
    p.add_argument("--role", choices=list(PALETTE), required=True)
    p.add_argument("--expression", choices=["neutral", "angry", "smug", "shocked"], default="neutral")
    p.add_argument("--background", action="store_true", help="Draw vector background behind the cutout")
    p.add_argument("--output", type=Path, required=True)
    args = p.parse_args()
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(build(args.role, args.expression, args.background), encoding="utf-8")
    print(f"Saved SVG: {args.output}")


if __name__ == "__main__":
    main()
