---
name: product-review-video
description: Make vertical product-review videos for TikTok Shop / Shopee / Lazada affiliate ("ปักตะกร้า") with the video-studio pipeline — product photos, feature callouts, pros/cons, price tag, "กดตะกร้า" CTA, Thai AI voice-over and music. Use whenever the user wants a product review, ปักตะกร้า, affiliate, รีวิวสินค้า, ป้ายยา, unboxing-style or "ขายของ" clip, or gives a product link/photos/spec sheet to turn into a video.
---

# Product review video (ปักตะกร้า)

Pipeline lives in `video-studio/` (see its README). Template: `video-studio/projects/_templates/product-review/`.

## 1. Collect inputs (ask only for what's missing)

| Need | Why |
|---|---|
| Product name, brand, variant/size | On-screen title |
| 2–6 photos (seller-approved or own photos) → `projects/<name>/assets/` | Hero images; no photos = stylised placeholder |
| Spec / product page text (pasted or screenshot) | The **only** basis for feature claims |
| Price now + normal price, date checked | Price tag; prices change, always add `price_note` |
| Owner's own test notes (optional) | Only these may be phrased as first-hand experience |
| Platform (TikTok Shop / Shopee / Lazada) | CTA wording ("กดตะกร้าด้านล่าง" / "กดลิงก์ในโปรไฟล์") |

This environment usually can't open shop pages (network policy) — ask the user to paste the spec or screenshots.

## 0. Platform fit — read first

**TikTok Shop "ปักตะกร้า" rejects fully generated clips.** A slideshow of product photos + graphics + AI voice was flagged (Nov 2026) for: no creator on screen, relying on still images/screenshots, stills covering >50% of the screen, no real usage or first-hand experience. For basket-linked TikTok Shop videos:
- The video must be built on **real footage the user films**: their face/hands on screen, the actual product being opened/used/demonstrated, ideally their own voice sharing real experience.
- Our job becomes **editing**: cut the clips, captions, small corner callouts (keep overlays well under 50% of the frame), price tag, basket CTA, music/SFX. Give the user a shot list (hook to camera → unboxing → setup → feature demos in motion → real result → personal verdict + point to basket).
- Never try to dodge the review (e.g. adding fake motion, stock "hands", re-uploading the same clip). Don't advise appealing when the clip really matches the rule.
- The photo/graphics template below is still fine for teasers without a basket, or other platforms after checking their rules.

## 2. Honesty & compliance rules (non-negotiable)

- **Never invent** specs, test results, sales numbers, ratings, reviews or quotes. Every feature line must come from the spec/page or the owner's notes; mark spec-based claims `"source": "spec"` (renders "* ตามสเปกผู้ผลิต").
- **No fake first-hand experience.** The AI voice must not say "ผมใช้มาแล้ว/ลองมาแล้ว" unless the owner actually tested it and gave notes. Default framing: "สเปกบอกว่า…", "ตามหน้าร้าน…".
- **Disclosure:** the owner chose **no on-screen ad tag** (template default `"disclosure": ""`). Disclosure still has to happen: every hand-over must remind the user to switch on the platform's commercial-content / paid-partnership disclosure when posting and to put #โฆษณา (or #affiliate) in the caption. Set `disclosure` to text only if the user asks for the tag back. Always include cons/ข้อควรรู้ — honest reviews convert better and protect the account.
- **Health / beauty / food / supplements:** no cure, treat, prevent, whiten-guarantee or weight-loss promises; use only wording on the label/อย. registration. Flag anything that needs an อย. number and ask the user to confirm it.
- **Electrical / kids' products:** mention มอก./safety marks only if the user confirms them.
- **Price:** say "ราคา ณ วันที่ทำคลิป อาจเปลี่ยนตามโปรร้าน"; never invent a discount or "เหลือชิ้นสุดท้าย"-style scarcity.
- **AI labelling:** remind the user to switch on the platform's AI-generated content label (the voice is synthetic).
- **Images & brands:** use photos the seller allows or the user shot; no competitor logos, celebrity faces or copyrighted music. The pipeline's music is procedurally generated (safe).
- Platform rules change — tell the user to check the current TikTok Shop / Shopee affiliate content policy before scaling up.

## 3. Background removal (floating product shots)

```bash
python3 video-studio/engine/cutout.py projects/<slug>/assets/*.jpg --preview        # BiRefNet, best edges
python3 video-studio/engine/cutout.py img.jpg --crop 0,400,800,900 --fast           # crop first; ISNet = faster
```
- Writes transparent PNGs to `assets/cut/` (trimmed + padded) and `_preview.jpg` (checkerboard + dark bg) — **look at the preview** before using them.
- Use in `data.json`: `"images": [{"src": "assets/cut/x.png", "cutout": true}, "assets/scene.jpg"]` → cut-outs float with a theme glow and a shape-following shadow; normal photos stay in a rounded card.
- Pick per-feature photos with `features[i].image` (index into `images`) and the closing shot with `hero_image`.
- Limits: text/stickers printed over the product can't be removed (crop around them first); white product on white background may lose parts; lifestyle/scene photos (product in use) usually look better left as photos.
- Crop away misleading seller text (e.g. impossible wattage) before cutting out.

## 4. Build

```bash
python3 video-studio/engine/new_project.py product-review <slug>
# edit projects/<slug>/data.json (product) and script.json (voice lines)
python3 video-studio/engine/build.py video-studio/projects/<slug> --stills   # review frames first
python3 video-studio/engine/build.py video-studio/projects/<slug>            # final MP4
```

`data.json` keys: `name, brand, theme (hex), images[], hook_text, features[{cue,title,detail,source}], pros[], cons[], price, price_before, currency, price_note, cta, disclosure, credits, demo` (set `demo:false` for real products — `true` stamps "ตัวอย่าง · ข้อมูลสมมติ").

`script.json` cues the scene expects: `hook, intro, f1, f2, f3, verdict ("ข้อดี | ข้อควรรู้"), price ("ปกติ… | ตอนนี้…"), cta`. Use `|` inside a line to split it into sync points (verdict → cons appear at the `|`; price → strike-through + new price at the `|`).

## 5. Script formula (30–45 s)

1. **Hook ≤3 s** — a question or problem the buyer has ("เย็นทั้งวันจริงไหม?"), never a false claim.
2. **Intro** — what it is, for whom.
3. **3 features** — benefit first, spec second ("ดื่มสะดวกตอนขับรถ — ฝาเปิดมือเดียว").
4. **Verdict** — 2 ข้อดี + 1–2 ข้อควรรู้ (real ones).
5. **Price** — normal → now, with the note.
6. **CTA** — "กดตะกร้าด้านล่าง" + price-may-change line.

Give the user: 3 hook options, the script, caption ×2 (each with #โฆษณา), 5–8 hashtags (#รีวิว #ปักตะกร้า #TikTokShop + category tags), and the AI-label + disclosure-toggle reminder.

## 6. Check before handing over

- Look at `out/stills` contact sheet: no overlap, text inside safe zone (x 60–940, y 150–1500; bottom/right are covered by app UI).
- Voice split check runs automatically (per-line transcription); if a line shows ⚠, look at `out/vo_lines/`.
- Every claim on screen traceable to the spec/notes; `demo` is `false`; caption includes #โฆษณา and the reply reminds about the platform disclosure toggle.
