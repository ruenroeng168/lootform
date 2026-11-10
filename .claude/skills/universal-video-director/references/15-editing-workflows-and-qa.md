# Professional edit pipeline: footage, code, audio, QA

## Decision tree
1. **Existing editable project?** Back up version and inspect before changes. Prefer its native timeline; don't blindly re-create with code.
2. **Primary material is footage?** ffprobe media, derive EDL/paper edit, trim/crop/normalize/subtitle/composite with existing editor or FFmpeg.
3. **Primary material is templated animation/graphics?** Remotion+React+TypeScript compositions, structured inputs and stable render. Official Remotion skills are complementary; do not reimplement their API guidance from memory.
4. **Both?** Keep a source timecode map; use Remotion to composite original footage, graphics, captions and audio in a reusable composition.

## Recommended folders per deliverable
`project/source/` (read-only originals); `project/working/` (proxies, source log, EDL); `project/assets/` (approved art, music, voice, fonts); `project/exports/` (versioned); `project/qa/` (report and frame contact sheet). Never claim a source file is available before inspection.

## Preflight
- `ffprobe`: width, height, fps, duration, pixel aspect ratio, channels, audio codec, color metadata when available.
- Verify no duplicate frame-rate conversion by accident; handle VFR sources, silent tracks, mismatched timebases carefully.
- Confirm display safe areas for target platform UI, subtitle readability and accessibility.
- Music license, intended speaker consent/permissions, file naming and brand compliance.

## Edit craft
- Rhythm map per goal: punchy comedy, demonstration-first review, explanatory holds, trust-building UGC, documentary pauses, cinematic reveals.
- Cuts grounded in action, idea and emotion; avoid effect fatigue. Use cutaways only when they clarify or preserve continuity.
- Strong lower thirds, legible mobile captions, non-obstructive product footage.
- Dialogue priority in mix, proper fades and room tone; duck music under narration if needed.
- Frame-accurate timeline, consistent speaker identity, exact numbers/units and meaningful subtitle grouping.

## QA matrix (mark PASS/FAIL/NOT CHECKED)
- **Narrative:** fit for intended audience, truthful hook, format payoff, CTA/disclosure.
- **Factual/marketing:** verified claims, actual product/price, source logs, no fake UGC, comparisons fair.
- **Visual:** contact sheet frames, real playback if available, crop, color, stability, text and safe zones.
- **Audio:** voice intelligibility, clipped syllables, audio transition/fade, stereo/mono, safe peaks/loudness if measured.
- **Technical:** correct video width/height/fps/duration/codec/container, unexpected black/blank frames, missing font/glyph, missing media.
- **Rights:** asset manifest, permission for voices/likeness, music and claims.
- **Delivery:** actual files exist, editable timeline retained, correct version, honest description of outstanding gaps.

## Helpful local commands (only if installed)
- `python scripts/validate_story.py examples/education-explainer.json`
- `python scripts/check_claims.py templates/claims-ledger.csv`
- `python scripts/qa_video.py path/to/export.mp4 --expect-width 1920 --expect-height 1080`

`qa_video.py` cannot prove quality by itself. Inspect representative frames plus a full playback with sound when possible. Distinguish preview/staged video from approved client-ready master.
