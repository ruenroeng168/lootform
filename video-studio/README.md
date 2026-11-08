# LOOTFORM Video Studio

Code-generated videos: vector graphics, an animated character, Thai voice-over, music and SFX, rendered to a finished MP4.

```
python3 video-studio/engine/build.py video-studio/projects/teaser
# -> video-studio/projects/teaser/out/video.mp4  (1080x1920, 30fps, H.264 + AAC, -14 LUFS)
```

## Pipeline

| Step | What it does | File |
|---|---|---|
| 1. Voice | **Gemini TTS** (default voice `Puck`, storytelling style): the whole script is read in one request, then split into lines at the pauses and verified with `engine/verify_vo.py`. `--engine=piper` uses the offline voice for previews | `engine/build.py`, `engine/tts.py` |
| 2. Timeline | Line timings become **cues** (`hello`, `legendary`, ...) that the visuals and sound sync to | `engine/build.py` |
| 3. Score | Procedural music bed (pad / arp / bass / drums) and SFX (whoosh, riser, boom, sparkle...), ducked under the voice | `projects/*/score.py`, `engine/synth.py` |
| 4. Lip-sync | Voice loudness per frame drives the character's LED mouth | `engine/build.py` |
| 5. Render | `scene.js` draws each frame on a canvas in headless Chromium, then ffmpeg encodes it | `engine/render.mjs`, `projects/*/scene.js` |

## Making a new video

1. Copy `projects/teaser` to `projects/<name>`.
2. Edit `script.json`: voice lines, start time (`at`) or gap (`gap`), on-screen captions (`caption`), voice speed (`speed`).
3. Edit `scene.js`: the visuals as a function of time `draw(t, frame)`, using the cues from `TL.cues`.
4. Edit `score.py`: the music and SFX arrangement.
5. `build.py <project>` builds everything. Options: `--audio-only`, `--stills` (review frames every 1.5 s), `--frames=300-420` (render a preview range).

## Requirements

- `ffmpeg`, Node and Playwright Chromium, Python 3 with numpy and scipy
- `pip install piper-tts unicode-rbnf sklearn-crfsuite gensim nltk && pip install --no-deps tltk` (the Thai phonemizer for Piper)
- The voice model is downloaded into `voices/` automatically on the first run (not committed)
- Brand fonts (OFL) are in `assets/fonts/`: Chakra Petch, IBM Plex Sans Thai, IBM Plex Mono

## Gemini key

Add it to the environment's Network secrets: Host `generativelanguage.googleapis.com`, Header `x-goog-api-key`
(or set `$GEMINI_API_KEY`). Free tier: about 10 requests/day per model; 1 video = 1 request.

## Templates & skills

- `python3 engine/new_project.py --list` / `new_project.py product-review <slug>` creates a project from `projects/_templates/`.
- **product-review**: a vertical affiliate ("ปักตะกร้า") review. Product data goes in `data.json` (photos in `assets/`), voice lines in `script.json`. Example: `projects/demo-bottle` (fictional product, uses placeholder photos).
- Skills for Claude sessions live in `../.claude/skills/`: `product-review-video` (workflow + honesty/compliance rules) and `sports-news-clip` (news research + clip workflow).
- `data.json` in any project is passed to `scene.js` as `TL.data`; image paths in `data.images` are inlined at render time.
- `engine/cutout.py`: local AI background removal (BiRefNet; `--fast` uses ISNet) that writes transparent PNGs for floating product shots. Models are downloaded into `models/` (gitignored). Requires `pip install "rembg[cpu]"`.
- **photo-story** (`projects/_templates/photo-story`): a cinematic tribute or recap built from full-screen photos (Ken Burns), year stamps, count-up stats, and a per-photo CC credit with the year the photo was taken. Example: `projects/cr7-tribute`. Photos come from Wikimedia Commons (CC BY / BY-SA); put the author, license and year in `data.json → credits`.
- **Edit real footage** (product review for basket-pinning): put the clips in the project's `assets/` folder, write `data.json → edl` (which clip/time range goes with which voice line), then run
  `build.py <proj> --audio-only` → `engine/footage.py <proj>` (cuts and fits the footage to the voice-over) → `render.mjs <proj> --overlay` (overlays transparent graphics on the footage and mixes in the clips' own sound). Example: `projects/winch-review`.
- **Visual styles** for the storybook scenes (`engine/sketch.js`): set `data.json → "style"` to `ink | watercolor | paper | silhouette | flat | comic | chalk`. Use `node engine/render.mjs <proj> --still=<frame> --style=<x>` to preview one frame. Scenes call `SK.STYLE_BG` for palettes, texture and panel frames. The hand is shown only in `ink` and `chalk`.
