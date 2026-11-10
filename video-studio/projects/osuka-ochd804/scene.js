// Overlay for the OSUKA OCHD804-D2 review (render.mjs --overlay on out/base.mp4).
// 0–7 s the creator talks (real voice, captions from data.talk); when he points up-left a details card pops
// out where he points. Then spec chips over the orbit shot, a "tested for real" badge + his own verdict over
// the drilling shot, kit / caution cards and the basket CTA. Overlays stay small (well under 50% of frame).
(function () {
  const { clamp, lerp, prog, ease } = window.L;
  const W = 1080, H = 1920;
  const INK = "#14161c", RED = "#e1251b", YEL = "#ffc928", WHITE = "#ffffff", GREEN = "#1fa463";
  const F = { b: (s) => `700 ${s}px "IBM Plex Sans Thai"`, m: (s) => `600 ${s}px "IBM Plex Sans Thai"`, d: (s) => `700 ${s}px "Chakra Petch"` };
  let g, TL, C, D, img = {};
  const MK = (k, i) => (i === 0 ? C[k].start : C[k].marks[i - 1] ?? C[k].end);
  const END = (k) => { const ks = Object.keys(C), i = ks.indexOf(k); return i + 1 < ks.length ? C[ks[i + 1]].start - 0.3 : TL.duration; };

  function setup(canvas, tl) { g = canvas.getContext("2d"); TL = tl; C = tl.cues; D = tl.data || {}; }
  function preload() {
    return Promise.all(Object.entries(D.images || {}).map(([k, s]) => new Promise((r) => { const im = new Image(); im.onload = () => { img[k] = im; r(); }; im.onerror = r; im.src = s; })));
  }
  function rr(x, y, w, h, r) { g.beginPath(); g.roundRect(x, y, w, h, r); }
  function txt(s, x, y, font, col, align = "center") { g.font = font; g.fillStyle = col; g.textAlign = align; g.textBaseline = "middle"; g.fillText(s, x, y); }
  function shadow(fn, blur = 30, oy = 10, col = "rgba(0,0,0,0.45)") { g.save(); g.shadowColor = col; g.shadowBlur = blur; g.shadowOffsetY = oy; fn(); g.restore(); }
  const vis = (t, a, b) => prog(t, a, a + 0.25) * (1 - prog(t, b - 0.2, b));

  function pill(s, x, y, size, bg, fg, t0, t1, t, lead) {
    const a = vis(t, t0, t1); if (a <= 0) return;
    const k = ease.outBack(prog(t, t0, t0 + 0.35), 2);
    g.font = F.b(size); const lw = lead ? size * 1.0 : 0, w = g.measureText(s).width + size * 1.1 + lw, h = size * 1.7;
    g.save(); g.globalAlpha = a; g.translate(x + w / 2, y); g.scale(k, k);
    shadow(() => { rr(-w / 2, -h / 2, w, h, h / 2); g.fillStyle = bg; g.fill(); });
    if (lead) lead(-w / 2 + size * 0.95, 0, size * 0.42);
    txt(s, lw / 2, 3, F.b(size), fg);
    g.restore();
  }
  const check = (col) => (x, y, r) => { g.save(); g.translate(x, y); g.strokeStyle = col; g.lineWidth = r * 0.38; g.lineCap = "round"; g.lineJoin = "round"; g.beginPath(); g.moveTo(-r * 0.7, 0); g.lineTo(-r * 0.15, r * 0.55); g.lineTo(r * 0.8, -r * 0.6); g.stroke(); g.restore(); };
  const warn = (x, y, r) => { g.save(); g.translate(x, y); g.fillStyle = YEL; g.beginPath(); g.moveTo(0, -r * 1.05); g.lineTo(r * 1.1, r * 0.85); g.lineTo(-r * 1.1, r * 0.85); g.closePath(); g.fill(); txt("!", 0, r * 0.15, F.b(r * 1.4), INK); g.restore(); };
  function card(key, cx, cy, w, t0, t1, t, rot = 0) {   // seller image as a small framed card
    const im = img[key], a = vis(t, t0, t1); if (!im || a <= 0) return;
    const k = ease.outBack(prog(t, t0, t0 + 0.4), 1.6), h = w * im.height / im.width;
    g.save(); g.globalAlpha = a; g.translate(cx, cy); g.rotate(rot); g.scale(k, k);
    shadow(() => { rr(-w / 2 - 10, -h / 2 - 10, w + 20, h + 20, 22); g.fillStyle = WHITE; g.fill(); }, 40, 14);
    g.save(); rr(-w / 2, -h / 2, w, h, 14); g.clip(); g.drawImage(im, -w / 2, -h / 2, w, h); g.restore();
    g.restore();
  }

  // ------------------------------------------------------------ 0–7 s: creator intro
  function intro(t) {
    // name strip
    const a = vis(t, 0.3, 7.0);
    if (a > 0) {
      g.save(); g.globalAlpha = a;
      const k = ease.outCubic(prog(t, 0.3, 0.7));
      g.translate((1 - k) * -500, 0);
      shadow(() => { rr(40, 1290, 640, 80, 16); g.fillStyle = RED; g.fill(); });
      txt("รีวิว: สว่านไร้สาย OSUKA", 70, 1332, F.b(46), WHITE, "left");
      shadow(() => { rr(40, 1374, 470, 60, 14); g.fillStyle = INK; g.fill(); });
      txt("OCHD804-D2", 70, 1405, F.d(40), YEL, "left");
      g.restore();
    }
    // details card where he points (upper-left)
    const p0 = D.point || 4.6, pk = ease.outBack(prog(t, p0, p0 + 0.45), 1.7), pa = 1 - prog(t, 6.75, 7.05);
    if (pk > 0 && pa > 0) {
      g.save(); g.globalAlpha = pa; g.translate(290, 330); g.scale(pk * 0.92, pk * 0.92);
      shadow(() => { rr(-240, -190, 480, 380, 28); g.fillStyle = "rgba(20,22,28,0.92)"; g.fill(); });
      g.fillStyle = RED; g.fillRect(-240, -190, 480, 70);
      txt("รายละเอียด", 0, -154, F.b(40), WHITE);
      ["ไร้แปรงถ่าน", "3 ระบบในตัวเดียว", "คลัช 18 ระดับ", "แบต 20V × 2 ก้อน"].forEach((s, i) => {
        const ip = prog(t, p0 + 0.35 + i * 0.22, p0 + 0.55 + i * 0.22);
        g.save(); g.globalAlpha *= ip; check(GREEN)(-190, -70 + i * 68, 16); txt(s, -160, -68 + i * 68, F.b(38), WHITE, "left"); g.restore();
      });
      g.restore();
      // dotted pointer toward his hand
      g.save(); g.globalAlpha = pa * pk; g.strokeStyle = YEL; g.lineWidth = 6; g.setLineDash([14, 12]); g.lineDashOffset = -t * 40;
      g.beginPath(); g.moveTo(420, 520); g.quadraticCurveTo(470, 600, 380, 660); g.stroke(); g.restore();
    }
  }

  function captions(t) {
    let seg = null;
    (D.talk || []).forEach(([s, e, p]) => { if (t >= s && t < e) seg = { p, s, e, real: true }; });
    for (const k of Object.keys(C)) {
      const c = C[k];
      c.parts.forEach((p, i) => { const s = i === 0 ? c.start - 0.05 : c.marks[i - 1], e = i < c.parts.length - 1 ? c.marks[i] : c.end + 0.2; if (t >= s && t < e) seg = { p, s, e }; });
    }
    if (!seg) return;
    let p = seg.p; (D.capfix || []).forEach(([a, b]) => (p = p.split(a).join(b)));
    const a = prog(t, seg.s, seg.s + 0.08) * (1 - prog(t, seg.e - 0.08, seg.e));
    g.font = F.b(50);
    const words = p.split(" "), lines = [""];
    for (const w of words) { const tt = (lines[lines.length - 1] + " " + w).trim(); if (g.measureText(tt).width > 940 && lines[lines.length - 1]) lines.push(w); else lines[lines.length - 1] = tt; }
    g.save(); g.globalAlpha = a; g.lineJoin = "round"; g.textAlign = "center"; g.textBaseline = "middle";
    lines.slice(0, 2).forEach((l, i) => {
      const y = 1470 + i * 66 - (lines.length > 1 ? 33 : 0);
      g.lineWidth = 12; g.strokeStyle = INK; g.strokeText(l, 540, y); g.fillStyle = seg.real ? YEL : WHITE; g.fillText(l, 540, y);
    });
    g.restore();
  }

  function note(s, x, y, a) {   // small footnote with a dark backing so it stays legible
    if (a <= 0) return;
    g.save(); g.globalAlpha = a; g.font = F.m(30); const w = g.measureText(s).width + 30;
    g.fillStyle = "rgba(0,0,0,0.6)"; rr(x - 15, y - 24, w, 48, 12); g.fill(); txt(s, x, y + 1, F.m(30), WHITE, "left"); g.restore();
  }
  function cta(t) {
    const t0 = MK("kit", 2) - 0.1, a = prog(t, t0, t0 + 0.3);
    if (a <= 0) return;
    const s = 1 + 0.04 * Math.sin(t * 6);
    g.save(); g.globalAlpha = a; g.translate(540, 1250); g.scale(s, s);
    shadow(() => { rr(-400, -80, 800, 160, 80); g.fillStyle = RED; g.fill(); });
    g.strokeStyle = WHITE; g.lineWidth = 9; g.lineCap = "round"; g.lineJoin = "round";
    g.beginPath(); g.moveTo(-320, -34); g.lineTo(-304, -34); g.lineTo(-288, 22); g.lineTo(-238, 22); g.lineTo(-226, -14); g.lineTo(-296, -14); g.stroke();
    g.fillStyle = WHITE; g.beginPath(); g.arc(-280, 40, 9, 0, 7); g.arc(-244, 40, 9, 0, 7); g.fill();
    txt("ดูราคาในตะกร้า", 50, 4, F.b(62), WHITE);
    g.restore();
    const bob = Math.sin(t * 7) * 10;
    g.save(); g.globalAlpha = a; g.translate(540, 1380 + bob); g.fillStyle = YEL; g.strokeStyle = INK; g.lineWidth = 5;
    g.beginPath(); g.moveTo(0, 55); g.lineTo(-42, 10); g.lineTo(-17, 10); g.lineTo(-17, -36); g.lineTo(17, -36); g.lineTo(17, 10); g.lineTo(42, 10); g.closePath(); g.fill(); g.stroke(); g.restore();
  }

  function draw(t) {
    g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, W, H); g.globalAlpha = 1;
    intro(t);
    // spec over the orbit shot
    pill("ไร้แปรงถ่าน", 50, 300, 52, RED, WHITE, C.spec.start, END("spec"), t);
    pill("1,500 → 2,100 RPM", 50, 410, 52, INK, YEL, MK("spec", 1), END("spec"), t);
    note("* ตามสเปกร้าน (รอบหมุน ไม่ใช่แรงบิด)", 60, 500, vis(t, MK("spec", 1), END("spec")));
    // drilling: tested badge + his own verdict
    pill("ลองเจาะจริง", 50, 300, 50, GREEN, WHITE, C.drill.start - 0.1, END("drill"), t, check(WHITE));
    pill("“เจาะง่าย เบามือ”", 50, 410, 54, WHITE, INK, MK("drill", 1), END("drill"), t);
    note("— จากผู้รีวิวที่ใช้จริง", 60, 495, vis(t, MK("drill", 1), END("drill")));
    card("sys3", 790, 760, 470, MK("drill", 2) - 0.1, MK("drill", 3) + 0.1, t, 0.03);
    card("clutch", 790, 760, 470, MK("drill", 3), END("drill"), t, -0.03);
    // kit + caution
    card("kit", 900, 700, 220, C.kit.start, MK("kit", 1) + 0.2, t, 0.03);
    pill("แบต 20V 2.0Ah × 2", 50, 300, 46, INK, WHITE, C.kit.start + 0.2, MK("kit", 1) + 0.2, t);
    pill("แท่นชาร์จ + กล่องเก็บ", 50, 400, 46, INK, WHITE, C.kit.start + 1.0, MK("kit", 1) + 0.2, t);
    pill("รับประกัน 1 ปี", 50, 500, 46, YEL, INK, C.kit.start + 2.0, MK("kit", 1) + 0.2, t);
    pill("ปล่อยสวิตช์ให้หยุดก่อนเปลี่ยนโหมด", 50, 300, 42, "rgba(20,22,28,0.92)", YEL, MK("kit", 1), TL.duration, t, warn);
    note("* ตามข้อมูลหน้าร้าน", 60, 600, vis(t, C.kit.start, TL.duration));
    cta(t); captions(t);
  }
  function events() {
    return { pen: [], pops: [D.point || 4.6, MK("spec", 1), MK("drill", 1), MK("drill", 2), MK("drill", 3), MK("kit", 1)],
      whoosh: [7.0, C.drill.start - 0.25, C.kit.start - 0.3], cta: MK("kit", 2), price: null };
  }
  window.scene = { setup, preload, draw, events };
})();
