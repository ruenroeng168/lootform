# Viral Video Director — Claude Code Skill (ภาษาไทย)

ชุดทักษะสำหรับให้ **Claude Code** ทำงานเหมือนทีมสตูดิโอผลิตคลิปสั้น: ครีเอทีฟ, คนเขียน Hook, นักเขียนบท, อาร์ตไดเรกเตอร์, นักวาดภาพด้วยโค้ด, นักตัดต่อ Remotion, ซาวด์ดีไซเนอร์, นักทำซับ, QA และนักวิเคราะห์ผลลัพธ์

## ในแพ็กนี้มีอะไร

- `SKILL.md` — สมองหลักของทีม, วิธีสั่งงาน, ขั้นตอนผลิต, ข้อห้ามและ QA gates
- `references/` — 6 คู่มือย่อย: Hook/Retention, บทและมุข, ภาพ/วาดการ์ตูน/Prompt, ตัดต่อ, เสียง/ซับไทย, เผยแพร่/วัดผล
- `templates/` — Creative brief, Character bible, Storyboard, Story JSON ตัวอย่างและ Release checklist
- `examples/engineers-comedy.json` — ตัวอย่าง EP.1 วิศวกรโยธา VS วิศวกรไฟฟ้า แบบ 8 ฉาก รวม 29.8 วินาที (ไทม์ไลน์รอปรับตามเสียงจริง)
- `examples/art/*.svg` — ภาพตัวละครเวกเตอร์ **ตัวอย่างจริง** 3 ตัว วาดด้วยโค้ด (โยธา/ไฟฟ้า/เฮียเสี่ย)
- `scripts/validate_story.py` — ตรวจ JSON, ลำดับเวลาฉาก, ตัวละคร, ระยะเวลา, ช่องเสียงที่ยังไม่มี
- `scripts/draw_character_svg.py` — สร้างภาพคาแรกเตอร์แบบ SVG แยกฉากและเปลี่ยนอารมณ์ได้ (ไม่ต้องใช้ API)
- `scripts/qa_video.py` — ตรวจ MP4 โดย `ffprobe`: fps, ความละเอียด, codec, pixel format, เสียงและความยาว

## ติดตั้งเป็น Skill ของโปรเจกต์ Claude Code

1. แตกไฟล์ ZIP ที่ดาวน์โหลด จะได้โฟลเดอร์ `viral-video-director`.
2. คัดลอกทั้งโฟลเดอร์ไปวางที่ `<PROJECT_ROOT>/.claude/skills/viral-video-director/`.
3. ตรวจว่าไฟล์หลักอยู่ที่ `<PROJECT_ROOT>/.claude/skills/viral-video-director/SKILL.md`.
4. เปิด Claude Code จากโปรเจกต์ (ถ้าเปิดอยู่แล้วอาจเปิดเซสชันใหม่เพื่อให้สแกนทักษะ).
5. พิมพ์ `/viral-video-director SCRIPT ขอ 5 มุขโยธา VS ไฟฟ้า พร้อม Hook 3 แบบต่อเรื่อง`.

หากอยากใช้กับทุกโปรเจกต์ ให้วางไว้ที่ `~/.claude/skills/viral-video-director/` แทน (บน Windows ใช้โฟลเดอร์ `.claude/skills` ใน home directory ของคุณ).

## ติดตั้งสกิลทางการของ Remotion เพิ่ม (แนะนำ แต่ไม่บังคับ)

จาก terminal ในโปรเจกต์ เมื่ออนุญาตให้ติดตั้งแพ็กเกจจากภายนอกแล้ว:

```bash
npx skills add remotion-dev/skills
```

เอกสารทางการ: https://www.remotion.dev/docs/ai/skills

**หมายเหตุ:** Skill นี้เป็นคำสั่ง/คู่มือ/สคริปต์ตรวจสอบ ไม่ได้แถมภาพสมจริง AI, TTS, เสียงพากย์, โมเดลสร้างวิดีโอ หรือสิทธิใช้ API ที่มีค่าใช้จ่าย. ถ้ายังไม่มี Remotion/FFmpeg/TTS ให้ Claude Code ตรวจและแจ้งก่อนวางแผนติดตั้ง/เชื่อมต่อ.

## คำสั่งเริ่มงานที่แนะนำ

```text
/viral-video-director FACTORY
ทำซีรีส์ตลก AI วิศวกรโยธา VS วิศวกรไฟฟ้า ภาษาไทย/อีสาน
ตอนแรกความยาว 25-35 วินาที ปากจัด แต่สนุก
เริ่มจากตรวจไฟล์และเครื่องมือที่มีอยู่ก่อน
เสนอ Hook 3 แบบและเลือกอันที่แรงที่สุด
สร้าง Character Bible, บทพูด, Storyboard, ภาพ/Prompt, voice plan,
เขียนตัดต่อ Remotion, ซับไทยอ่านง่าย, คิว SFX และ QC
ถ้ายังไม่มีเสียงจริงหรือเครื่องมือภาพ ให้สร้าง prototype พร้อมระบุข้อจำกัด
ห้ามเขียนทับโปรเจกต์เดิม ห้ามใช้บริการเสียเงินหรือเผยแพร่โดยไม่ขออนุญาต
```

## เช็กไฟล์ตัวอย่าง (คำสั่งจาก root ของโฟลเดอร์ skill)

```bash
python scripts/validate_story.py examples/engineers-comedy.json
python scripts/draw_character_svg.py --role civil --expression angry --output examples/art/civil-again.svg
python scripts/qa_video.py path/to/video.mp4 --expect-width 1080 --expect-height 1920
```

## ผลลัพธ์ที่ควรคาดหวัง

- หากขอแค่คอนเทนต์: ได้ Hook, บท, storyboard, แผนภาพและรายการสิ่งที่ต้องผลิต
- หากมีระบบ Remotion/ไฟล์เสียง/ภาพครบ: Claude Code สามารถเขียนโค้ดและเรนเดอร์ MP4 พร้อม QA ที่ตรวจสอบได้
- หากไม่มีภาพ/เสียงหรือไม่มีสิทธิใช้บริการ: ได้ SVG/Prompt/placeholder + รายงานข้อจำกัด ไม่อ้างว่าวิดีโอสมบูรณ์แล้ว

## เอกสารทางการ

- Claude Code skills: https://code.claude.com/docs/en/skills
- Remotion agent skills: https://www.remotion.dev/docs/ai/skills
- Remotion video rendering: https://www.remotion.dev/docs/render
- Remotion captions: https://www.remotion.dev/docs/captions
- Remotion licensing: https://www.remotion.dev/docs/license

## หลักคิด

สร้างคอนเทนต์ที่มีคุณภาพและทดสอบจริง ไม่รับประกันไวรัล; การตัดต่อเป็นเพียงส่วนหนึ่งของผลลัพธ์ ต้องดูความสนใจของกลุ่มผู้ชมและสถิติจริงด้วย.
