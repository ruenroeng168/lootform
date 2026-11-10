# Edit Suite — timeline, typography, motion, finishing

## Editing tool selection
- Existing NLE project (Premiere, Resolve, CapCut or other): inspect and continue with the actual available tool and export method; preserve native project if possible.
- Footage processing/simple sequence: FFmpeg can inspect, trim, transcode, composite and export; use quality controls and source timecodes.
- Reusable motion/graphics/templated clips: prefer Remotion + React/TypeScript if installed and licensed for intended use. Official guidance: https://www.remotion.dev/docs/ai/skills
- Hybrid: use footage and overlays in the existing editor or Remotion, preserving originals and keeping source-to-final traceability.

## Editorial rhythm — NOT one universal preset
- **Comedy:** setup, escalation, interrupt, reaction/hold, punchline; use selective punch zooms/SFX.
- **Review:** product visible; credible evidence; comparisons at matching scale; enough hold to read specifications.
- **Sales:** pain or use-case, real demo/benefit, proof, terms, clear CTA; clean product framing.
- **Tutorial:** explain a step → demonstrate → annotate → recap; do not rush the key step.
- **Interview/documentary:** meaning-preserving selects, context, natural pauses, J/L cuts and restrained b-roll.
- **Brand/cinematic:** visual rhythm, light, continuity, mood, music and hero holds.

## Technical implementation
- Probe actual video and voice duration; align cuts and captions to source. Converting seconds to frames: choose consistent rounding and watch for drift.
- Keep all source assets separately and retain source timecodes for actual footage.
- For motion designs, use deterministic frame-driven animation rather than runtime random/timers.
- Captions and essential action stay away from platform UI; preview per destination.
- Avoid noise, broken fonts, scaling blur, abrupt audio clipping, overly flashy transitions or unstated synthesized source clips.
- Export specs come from brief, e.g. 1080x1920 for vertical, 1920x1080 for landscape, requested fps/container/codec, not automatically portrait for every edit.

## Validation
Inspect actual contact-sheet frames at hook, proof/demo, midpoint, chapter transition, CTA/end. Review full playable video with sound if possible. Run `qa_video.py` with the real target dimensions. ffprobe validates file metadata, not audience impact or factual truth.
