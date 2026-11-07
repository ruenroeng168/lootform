---
name: sports-news-clip
description: Find fresh sports news (last 24 h, Asia/Bangkok), score virality, write Thai short-video scripts with hooks, and render them as vertical whiteboard clips with the video-studio pipeline. Use for ข่าวกีฬา, ผลบอล, มวยไทย/UFC/มวยสากล, NBA, F1/MotoGP, นักกีฬาไทย, กระแสกีฬาในไทย, TikTok/Reels/Shorts sports content, or "วิเคราะห์หลังเกม".
---

# Sports news → short clip

## Research rules
- Time window in **Asia/Bangkok**; convert kick-off times (UK GMT+7 in winter, US ET +12).
- Every fact from **≥2 sources** (league/club/federation/athlete sites and major outlets first). Label each item **ยืนยันแล้ว / ข่าวลือ / กำลังตรวจสอบ**; social-only info = "ข้อมูลจากโซเชียล รอการยืนยัน".
- Never invent scores, minutes, stats, quotes or table positions. When sources disagree (e.g. goal minute 56' vs 57'), pick the official one or avoid the exact number, and tell the user.
- WebFetch is usually blocked by the network policy; use WebSearch (extended for recency) and cite every URL.
- For "ดังในไทย" requests, search Thai outlets (สยามสปอร์ต, ไทยรัฐ, มติชน, เดลินิวส์, ThaiPBS, บ้านกีฬา) and check how many outlets carry the story.

## Output (when asked for a content plan)
Table 1 (rank, headline, sport, when, 2-sentence summary, sources, status, viral 1–10 — freshness, shock, emotion, drama, simplicity, visuals, shareability) → Table 2 (top picks: why, audience, angle, data/copyright risk) → per clip: 5 hooks (ตกใจ/คำถาม/ดราม่า/ตัวเลข/ทิ้งปม, ≤3 s, no exaggeration) + chosen hook, timed script (0–3 / 3–10 / 10–30 / 30–45 / CTA), editing notes, captions ×2, comment question, 5–8 hashtags, source credits.

## Safety
- Harassment/threat stories: stand against the abuse, never guess the sender, don't show the threats verbatim, don't link a player/club's fans without a source.
- Ongoing legal cases: avoid, or report only what's confirmed with attribution.
- No broadcast footage, club crests or league logos; use the pipeline's graphics, team colours, licensed photos or official social embeds.

## Render
Copy the closest project (`video-studio/projects/pl-eve-cov` = vertical whiteboard match recap) and edit `script.json` (`|` marks sync points) + `scene.js`:
```bash
python3 video-studio/engine/build.py video-studio/projects/<slug> --stills
python3 video-studio/engine/build.py video-studio/projects/<slug>
```
House voice: Gemini `Puck`; one TTS request per video; the build verifies each voice line by transcription. Check the stills contact sheet before the final render, and list in the reply anything that couldn't be verified (names the TTS may mispronounce, conflicting stats).
