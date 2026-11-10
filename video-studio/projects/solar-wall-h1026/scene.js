// Overlay for the MD-SOLAR-H1026 solar wall-light review (rendered with --overlay on base.mp4).
// Footage sits full-width at y 300–1476 over a blurred fill (data.fit = "blur"); graphics live mostly in the
// title strip above it and in small chips, keeping well under 50% of the frame and inside the safe zone.
(function () {
  const { clamp, lerp, prog, ease } = window.L;
  const W = 1080, H = 1920;
  const INK = "#14161c", AMB = "#ffb547", WHITE = "#ffffff", RED = "#e5484d", GREEN = "#1fa463", NAVY = "#101a33";
  const F = { b: (s) => `700 ${s}px "IBM Plex Sans Thai"`, m: (s) => `600 ${s}px "IBM Plex Sans Thai"`, d: (s) => `700 ${s}px "Chakra Petch"` };
  let g, TL, C, D;
  const MK = (k, i) => (i === 0 ? C[k].start : C[k].marks[i - 1] ?? C[k].end);
  const END = (k) => { const ks = Object.keys(C), i = ks.indexOf(k); return i + 1 < ks.length ? C[ks[i + 1]].start - 0.15 : TL.duration; };

  function setup(canvas, tl) { g = canvas.getContext("2d"); TL = tl; C = tl.cues; D = tl.data || {}; }
  function rr(x, y, w, h, r) { g.beginPath(); g.roundRect(x, y, w, h, r); }
  function txt(s, x, y, font, col, align = "center") { g.font = font; g.fillStyle = col; g.textAlign = align; g.textBaseline = "middle"; g.fillText(s, x, y); }
  function shadow(fn, blur = 30, oy = 10, col = "rgba(0,0,0,0.4)") { g.save(); g.shadowColor = col; g.shadowBlur = blur; g.shadowOffsetY = oy; fn(); g.restore(); }
  const vis = (t, a, b) => prog(t, a, a + 0.25) * (1 - prog(t, b - 0.2, b));

  function pill(s, x, y, size, bg, fg, t0, t1, t, icon) {
    const a = vis(t, t0, t1); if (a <= 0) return;
    const k = ease.outBack(prog(t, t0, t0 + 0.35), 2);
    g.font = F.b(size); const iw = icon ? size * 1.1 : 0, w = g.measureText(s).width + size * 1.1 + iw, h = size * 1.7;
    g.save(); g.globalAlpha = a; g.translate(x + w / 2, y); g.scale(k, k);
    shadow(() => { rr(-w / 2, -h / 2, w, h, h / 2); g.fillStyle = bg; g.fill(); });
    if (icon) icon(-w / 2 + size * 0.95, 0, size * 0.42);
    txt(s, iw / 2, 3, F.b(size), fg);
    g.restore();
  }
  // tiny vector icons
  const sun = (col) => (x, y, r) => { g.save(); g.translate(x, y); g.fillStyle = col; g.beginPath(); g.arc(0, 0, r * 0.55, 0, 7); g.fill(); g.strokeStyle = col; g.lineWidth = r * 0.18; g.lineCap = "round"; for (let i = 0; i < 8; i++) { const a = i * Math.PI / 4; g.beginPath(); g.moveTo(Math.cos(a) * r * 0.8, Math.sin(a) * r * 0.8); g.lineTo(Math.cos(a) * r * 1.1, Math.sin(a) * r * 1.1); g.stroke(); } g.restore(); };
  const moon = (col, bg) => (x, y, r) => { g.save(); g.translate(x, y); g.fillStyle = col; g.beginPath(); g.arc(0, 0, r, 0, 7); g.fill(); g.fillStyle = bg; g.beginPath(); g.arc(r * 0.45, -r * 0.3, r * 0.85, 0, 7); g.fill(); g.restore(); };
  const check = (col) => (x, y, r) => { g.save(); g.translate(x, y); g.strokeStyle = col; g.lineWidth = r * 0.35; g.lineCap = "round"; g.lineJoin = "round"; g.beginPath(); g.moveTo(-r * 0.7, 0); g.lineTo(-r * 0.15, r * 0.55); g.lineTo(r * 0.8, -r * 0.6); g.stroke(); g.restore(); };
  const bang = (col) => (x, y, r) => { g.save(); g.translate(x, y); g.fillStyle = col; g.beginPath(); g.arc(0, 0, r, 0, 7); g.fill(); txt("!", 0, 2, F.b(r * 1.6), INK); g.restore(); };

  function titleStrip(t) {   // product name above the footage, from the intro on
    const a = prog(t, C.intro.start - 0.2, C.intro.start + 0.2);
    if (a <= 0) return;
    g.save(); g.globalAlpha = a;
    txt("ไฟติดผนังโซล่าเซลล์", 60, 150, F.b(66), WHITE, "left");
    g.font = F.d(40); const w = g.measureText("MD-SOLAR-H1026").width + 40;
    shadow(() => { rr(60, 205, w, 60, 30); g.fillStyle = AMB; g.fill(); }, 16, 4);
    txt("MD-SOLAR-H1026", 60 + w / 2, 237, F.d(40), INK);
    g.restore();
  }

  function hook(t) {
    const t0 = C.hook.start - 0.2, t1 = END("hook"), a = vis(t, t0, t1);
    if (a <= 0) return;
    const k = ease.outBack(prog(t, t0, t0 + 0.4), 2.2);
    g.save(); g.globalAlpha = a; g.translate(540, 170); g.rotate(-0.03); g.scale(k, k);
    shadow(() => { rr(-380, -95, 760, 190, 34); g.fillStyle = AMB; g.fill(); });
    txt("รั้วบ้านมืด?", 0, 6, F.b(110), INK);
    g.restore();
    const m = MK("hook", 1), mk = ease.outBack(prog(t, m - 0.1, m + 0.3), 2.2);
    if (mk > 0) {
      g.save(); g.globalAlpha = a; g.translate(540, 1340); g.scale(mk, mk);
      shadow(() => { rr(-400, -70, 800, 140, 70); g.fillStyle = INK; g.fill(); });
      txt("ไม่ต้องเดินสายไฟ!", 0, 4, F.b(68), AMB);
      g.restore();
    }
  }

  function stopwatchBadge(t, t0, t1, label) {
    const a = vis(t, t0, t1); if (a <= 0) return;
    const k = ease.outBack(prog(t, t0, t0 + 0.4), 2.4);
    g.save(); g.globalAlpha = a; g.translate(540, 420); g.scale(k, k);
    shadow(() => { rr(-360, -85, 720, 170, 40); g.fillStyle = RED; g.fill(); });
    g.strokeStyle = WHITE; g.lineWidth = 9; g.beginPath(); g.arc(-255, 8, 44, 0, 7); g.stroke();
    g.fillStyle = WHITE; g.fillRect(-267, -54, 24, 14);
    const ang = -Math.PI / 2 + (t - t0) * 4; g.beginPath(); g.moveTo(-255, 8); g.lineTo(-255 + Math.cos(ang) * 30, 8 + Math.sin(ang) * 30); g.stroke();
    txt(label, 55, 6, F.b(70), WHITE);
    g.restore();
  }

  function priceTag(t) {
    const t0 = C.price.start - 0.1, t1 = END("price"), a = vis(t, t0, t1);
    if (a <= 0) return;
    const k = ease.outBack(prog(t, t0, t0 + 0.45), 2.2), wob = Math.sin(t * 6) * 0.03;
    g.save(); g.globalAlpha = a; g.translate(540, 520); g.rotate(-0.06 + wob); g.scale(k, k);
    shadow(() => {
      g.beginPath(); g.moveTo(-330, -110); g.lineTo(270, -110); g.lineTo(350, 0); g.lineTo(270, 110); g.lineTo(-330, 110); g.closePath();
      g.fillStyle = RED; g.fill();
    });
    g.fillStyle = WHITE; g.beginPath(); g.arc(250, 0, 16, 0, 7); g.fill();
    txt("ราคาถูก!", -40, 6, F.b(120), WHITE);
    g.restore();
    pill("เช็กราคาล่าสุดในตะกร้า", 60, 1350, 46, INK, AMB, MK("price", 1), t1, t);
  }

  function cta(t) {
    const t0 = C.cta.start - 0.1, a = prog(t, t0, t0 + 0.3);
    if (a <= 0) return;
    const s = 1 + 0.04 * Math.sin(t * 6);
    g.save(); g.globalAlpha = a; g.translate(540, 1300); g.scale(s, s);
    shadow(() => { rr(-400, -80, 800, 160, 80); g.fillStyle = AMB; g.fill(); });
    g.strokeStyle = INK; g.lineWidth = 9; g.lineCap = "round"; g.lineJoin = "round";
    g.beginPath(); g.moveTo(-320, -34); g.lineTo(-304, -34); g.lineTo(-288, 22); g.lineTo(-238, 22); g.lineTo(-226, -14); g.lineTo(-296, -14); g.stroke();
    g.fillStyle = INK; g.beginPath(); g.arc(-280, 40, 9, 0, 7); g.arc(-244, 40, 9, 0, 7); g.fill();
    txt("กดตะกร้าด้านล่าง", 50, 4, F.b(62), INK);
    g.restore();
    const bob = Math.sin(t * 7) * 10;
    g.save(); g.globalAlpha = a; g.translate(540, 1440 + bob); g.fillStyle = AMB; g.strokeStyle = INK; g.lineWidth = 5;
    g.beginPath(); g.moveTo(0, 60); g.lineTo(-45, 10); g.lineTo(-18, 10); g.lineTo(-18, -40); g.lineTo(18, -40); g.lineTo(18, 10); g.lineTo(45, 10); g.closePath(); g.fill(); g.stroke(); g.restore();
    const n = prog(t, MK("cta", 1), MK("cta", 1) + 0.4);
    if (n > 0) { g.save(); g.globalAlpha = n * 0.9; txt("* ราคา ณ วันที่ทำคลิป อาจเปลี่ยนตามโปรร้าน", 540, 1520, F.m(30), WHITE); g.restore(); }
  }

  function captions(t) {
    if (t > C.cta.start - 0.1) return;   // CTA area takes over the bottom
    let seg = null;
    for (const k of Object.keys(C)) {
      const c = C[k];
      c.parts.forEach((p, i) => {
        const s = i === 0 ? c.start - 0.05 : c.marks[i - 1], e = i < c.parts.length - 1 ? c.marks[i] : c.end + 0.2;
        if (t >= s && t < e) seg = { p, s, e };
      });
    }
    if (!seg) return;
    let p = seg.p; (D.capfix || []).forEach(([a, b]) => (p = p.split(a).join(b)));
    const a = prog(t, seg.s, seg.s + 0.08) * (1 - prog(t, seg.e - 0.08, seg.e));
    g.font = F.b(50);
    const words = p.split(" "), lines = [""];
    for (const w of words) { const tt = (lines[lines.length - 1] + " " + w).trim(); if (g.measureText(tt).width > 940 && lines[lines.length - 1]) lines.push(w); else lines[lines.length - 1] = tt; }
    g.save(); g.globalAlpha = a; g.lineJoin = "round"; g.textAlign = "center"; g.textBaseline = "middle";
    lines.slice(0, 2).forEach((l, i) => {
      const y = 1560 + i * 66 - (lines.length > 1 ? 33 : 0);
      g.lineWidth = 12; g.strokeStyle = INK; g.strokeText(l, 540, y); g.fillStyle = WHITE; g.fillText(l, 540, y);
    });
    g.restore();
  }

  function draw(t) {
    g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, W, H); g.globalAlpha = 1;
    // thin frame around the footage window
    g.strokeStyle = "rgba(255,181,71,0.55)"; g.lineWidth = 4; g.strokeRect(2, 300, W - 4, 1176);
    hook(t);
    if (t >= C.intro.start - 0.2 && t < C.price.start - 0.1) titleStrip(t);
    // intro: day charge / night light
    pill("กลางวันชาร์จแดด", 50, 380, 46, "rgba(16,26,51,0.9)", WHITE, MK("intro", 1) - 0.1, END("intro"), t, sun(AMB));
    pill("กลางคืนสว่างเอง", 50, 485, 46, "rgba(16,26,51,0.9)", AMB, MK("intro", 1) + 0.6, END("intro"), t, moon(AMB, NAVY));
    // f1: install
    stopwatchBadge(t, C.f1.start - 0.1, END("f1"), "ติดตั้งไม่ถึง 5 นาที");
    pill("① เจาะ 2 รู", 50, 1150, 44, "rgba(16,26,51,0.9)", WHITE, MK("f1", 1), END("f1"), t);
    pill("② แขวน", 50, 1250, 44, "rgba(16,26,51,0.9)", WHITE, MK("f1", 1) + 0.6, END("f1"), t);
    pill("③ กดสวิตช์", 50, 1350, 44, "rgba(16,26,51,0.9)", AMB, MK("f1", 1) + 1.2, END("f1"), t);
    // f2: auto on at dusk
    pill("ติดเองอัตโนมัติ", 50, 420, 54, AMB, INK, MK("f2", 1) - 0.1, END("f2"), t, moon(INK, AMB));
    // f3: spec chips
    pill("กันน้ำ IP65", 50, 400, 46, "rgba(16,26,51,0.9)", WHITE, MK("f3", 0) + 0.3, END("f3"), t);
    pill("แบต 600 mAh", 50, 505, 46, "rgba(16,26,51,0.9)", WHITE, MK("f3", 1), END("f3"), t);
    pill("แสงเหลือง / RGB", 50, 610, 46, "rgba(16,26,51,0.9)", AMB, MK("f3", 2), END("f3"), t);
    { const a = vis(t, C.f3.start, END("f3")); if (a > 0) { g.save(); g.globalAlpha = a; txt("* ตามสเปกร้าน", 1030, 1500, F.m(30), WHITE, "right"); g.restore(); } }
    // verdict
    pill("ไม่ต้องเดินสายไฟ", 50, 400, 44, GREEN, WHITE, MK("verdict", 0) + 0.2, END("verdict"), t, check(WHITE));
    pill("แสงส่องผนังสวย", 50, 500, 44, GREEN, WHITE, MK("verdict", 0) + 0.9, END("verdict"), t, check(WHITE));
    pill("ต้องติดจุดที่โดนแดด", 50, 1250, 42, "rgba(20,22,28,0.9)", AMB, MK("verdict", 1), END("verdict"), t, bang(AMB));
    pill("สว่างนานแค่ไหน ขึ้นกับแดดแต่ละวัน", 50, 1350, 38, "rgba(20,22,28,0.9)", WHITE, MK("verdict", 1) + 0.8, END("verdict"), t, bang(AMB));
    priceTag(t); cta(t); captions(t);
  }
  function events() {
    return { pen: [], pops: [MK("hook", 1), MK("intro", 1), MK("f1", 1), MK("f2", 1), MK("f3", 1), MK("f3", 2), MK("verdict", 1)],
      whoosh: Object.keys(C).slice(1).map((k) => C[k].start - 0.25), cta: C.cta.start, price: C.price.start - 0.4 };
  }
  window.scene = { setup, draw, events };
})();
