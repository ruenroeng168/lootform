# LOOTFORM Video Studio

Code-generated videos: vector graphics, an animated character, Thai voice-over, music and SFX, rendered to a finished MP4.

```
python3 video-studio/engine/build.py video-studio/projects/teaser
# -> video-studio/projects/teaser/out/video.mp4  (1080x1920, 30fps, H.264 + AAC, -14 LUFS)
```

## Pipeline

| Step | What it does | File |
|---|---|---|
| 1. Voice | Thai neural TTS (Piper `th_TH-tsync2-medium`, runs offline). One clip per script line, trimmed and compressed | `engine/build.py` |
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
