# Art direction and reusable asset design

## Style brief
Collect: audience, format, trust level, brand, platform, footage, supplied references, output ratio, font/language, palette, visual accessibility and originality. Choose style on purpose, not because one model is trendy.

## Typical approaches
- **Actual products / reviews:** authentic photos and footage plus clean charts, labels and measurements; never invent functional evidence.
- **Sales ads:** consistent product hero, factual value cards, clear price/terms/CTA and brand identity.
- **Educational:** precise infographics, diagrams, SVG/code charts, screencasts, step highlighting, glossary.
- **Comedy/fantasy:** character sheet, expressions/poses, layered backgrounds, controlled camera and playful graphic vocabulary.
- **Documentary/interview:** credited photo/footage, truthful archival dates, subtle lower-thirds, accessible subtitles.
- **Brand film:** cohesive color grade, deliberate typography, product truth, fewer overlays.

## Asset manifest fields
`asset_id,path,type,source_or_creator,license_or_permission,usage_scope,credit_required,status,notes`. Keep assets you truly have separate from assets proposed for production. `status`: `VERIFIED`, `PENDING`, `REJECTED`.

## Image options
- Code-drawn: SVG with editable layers/text; Python Pillow for title cards/infographics; CSS/React for vector-ish motion.
- Image generator: only if available and authorized, use reference sheets, stable art direction and asset naming; check all results visually.
- Stock/personal footage: use only with permission/licensing; a web-visible image is not a license.
- 3D/technical: use consistent coordinates and camera rules, label diagrams as conceptual when not measured.

## QA visual checklist
Thai font coverage, line-break and fallback; color contrast; product/color/logo correctness; crop and safe zone; realistic anatomy if relevant; frame-to-frame continuity; no invented labels; visuals must not contradict spoken facts. Keep a thumbnail/contact sheet for systematic review.
