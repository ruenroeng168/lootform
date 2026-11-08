// Transparent overlay — OSUKA rotary hammer review (real footage) (rendered with --overlay on top of base.mp4).
// Keeps graphics small (well under 50% of the frame) and inside the app safe zone.
(function () {
  const { clamp, lerp, prog, ease } = window.L;
  const W = 1080, H = 1920;
  const INK = "#14161c", YEL = "#ffd23f", WHITE = "#ffffff", RED = "#e5484d", GREEN = "#1fa463";
  const F = { b: (s) => `700 ${s}px "IBM Plex Sans Thai"`, m: (s) => `600 ${s}px "IBM Plex Sans Thai"`, d: (s) => `700 ${s}px "Chakra Petch"` };
  let g, TL, C, D, img, img2;
  const MK = (k, i) => (i === 0 ? C[k].start : C[k].marks[i - 1] ?? C[k].end);
  const END = (k) => { const ks = Object.keys(C), i = ks.indexOf(k); return i + 1 < ks.length ? C[ks[i + 1]].start - 0.15 : TL.duration; };

  function setup(canvas, tl) { g = canvas.getContext("2d"); TL = tl; C = tl.cues; D = tl.data || {}; }
  function preload() {
    const load = (e) => new Promise((res) => { if (!e) return res(null); const im = new Image(); im.onload = () => res(im); im.onerror = () => res(null); im.src = typeof e === "string" ? e : e.src; });
    return Promise.all([load((D.images || [])[0]), load((D.images || [])[1])]).then(([a, b]) => { img = a; img2 = b; });
  }
  function card(im, cx, cy, w, h, label, t0, t1, t) {
    const a = vis(t, t0, t1); if (a <= 0 || !im) return;
    const k = ease.outBack(prog(t, t0, t0 + 0.4), 1.7);
    g.save(); g.globalAlpha = a; g.translate(cx, cy); g.scale(k, k);
    shadow(() => { rr(-w / 2, -h / 2, w, h, 32); g.fillStyle = "rgba(255,255,255,0.96)"; g.fill(); }, 40, 14);
    const s = Math.min((w - 50) / im.width, (h - (label ? 110 : 50)) / im.height) * (1 + 0.025 * Math.sin(t * 1.6));
    g.save(); g.shadowColor = "rgba(0,0,0,0.25)"; g.shadowBlur = 24; g.shadowOffsetY = 14;
    g.drawImage(im, -im.width * s / 2, -im.height * s / 2 - (label ? 30 : 0), im.width * s, im.height * s); g.restore();
    if (label) { rr(-w / 2 + 24, h / 2 - 84, w - 48, 62, 31); g.fillStyle = INK; g.fill(); txt(label, 0, h / 2 - 51, F.b(34), YEL); }
    g.restore();
  }
  function rr(x, y, w, h, r) { g.beginPath(); g.roundRect(x, y, w, h, r); }
  function txt(s, x, y, font, col, align = "center") { g.font = font; g.fillStyle = col; g.textAlign = align; g.textBaseline = "middle"; g.fillText(s, x, y); }
  function shadow(fn, blur = 30, oy = 10, col = "rgba(0,0,0,0.35)") { g.save(); g.shadowColor = col; g.shadowBlur = blur; g.shadowOffsetY = oy; fn(); g.restore(); }
  const vis = (t, a, b) => prog(t, a, a + 0.25) * (1 - prog(t, b - 0.2, b));

  function pill(s, x, y, size, bg, fg, t0, t1, t, align = "left") {
    const a = vis(t, t0, t1); if (a <= 0) return;
    const k = ease.outBack(prog(t, t0, t0 + 0.35), 2);
    g.font = F.b(size); const w = g.measureText(s).width + size * 1.1, h = size * 1.7;
    const x0 = align === "left" ? x : x - w / 2;
    g.save(); g.globalAlpha = a; g.translate(x0 + w / 2, y); g.scale(k, k);
    shadow(() => { rr(-w / 2, -h / 2, w, h, h / 2); g.fillStyle = bg; g.fill(); });
    txt(s, 0, 3, F.b(size), fg);
    g.restore();
  }
  function warnTri(x, y, s) {
    g.save(); g.translate(x, y); g.scale(s, s);
    g.fillStyle = YEL; g.strokeStyle = INK; g.lineWidth = 4;
    g.beginPath(); g.moveTo(0, -22); g.lineTo(24, 20); g.lineTo(-24, 20); g.closePath(); g.fill(); g.stroke();
    txt("!", 0, 5, F.b(26), INK); g.restore();
  }

  function captions(t) {
    let seg = null;
    for (const k of Object.keys(C)) {
      const c = C[k];
      c.parts.forEach((p, i) => {
        const s = i === 0 ? c.start - 0.05 : c.marks[i - 1];
        const e = i < c.parts.length - 1 ? c.marks[i] : c.end + 0.2;
        if (t >= s && t < e) seg = { p, s, e };
      });
    }
    if (!seg) return;
    const a = prog(t, seg.s, seg.s + 0.08) * (1 - prog(t, seg.e - 0.08, seg.e));
    g.font = F.b(50);
    const words = seg.p.split(" "), lines = [""];
    for (const w of words) { const tt = (lines[lines.length - 1] + " " + w).trim(); if (g.measureText(tt).width > 860 && lines[lines.length - 1]) lines.push(w); else lines[lines.length - 1] = tt; }
    g.save(); g.globalAlpha = a; g.lineJoin = "round"; g.textAlign = "center"; g.textBaseline = "middle";
    lines.slice(0, 2).forEach((l, i) => {
      const y = 1420 + i * 66 - (lines.length > 1 ? 33 : 0);
      g.lineWidth = 12; g.strokeStyle = INK; g.strokeText(l, 540, y); g.fillStyle = WHITE; g.fillText(l, 540, y);
    });
    g.restore();
  }

  function draw(t) {
    g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, W, H); g.globalAlpha = 1;
    // hook
    {
      const t0 = C.hook.start - 0.2, t1 = END("hook"), a = vis(t, t0, t1);
      if (a > 0) {
        const k = ease.outBack(prog(t, t0, t0 + 0.4), 2.2);
        g.save(); g.globalAlpha = a; g.translate(540, 330); g.rotate(-0.04); g.scale(k, k);
        shadow(() => { rr(-400, -95, 800, 190, 34); g.fillStyle = YEL; g.fill(); });
        txt("เจาะปูนไหวไหม?", 0, 6, F.b(100), INK);
        g.restore();
      }
    }
    pill("สว่านโรตารี่ไร้สาย 20V", 60, 260, 54, INK, YEL, C.intro.start, END("intro"), t);
    // 3 modes
    pill("ปรับได้ 3 ระบบ", 60, 250, 52, INK, YEL, MK("modes", 0), END("modes"), t);
    pill("① เจาะ", 60, 360, 48, "rgba(20,22,28,0.85)", WHITE, MK("modes", 1), END("modes"), t);
    pill("② เจาะกระแทก", 60, 460, 48, "rgba(20,22,28,0.85)", WHITE, MK("modes", 2), END("modes"), t);
    pill("③ สกัด", 60, 560, 48, "rgba(20,22,28,0.85)", WHITE, MK("modes", 3), END("modes"), t);
    // real test
    pill("ลองใช้จริง · เสาอัดแรง", 60, 250, 42, GREEN, WHITE, C.test.start, END("test"), t);
    {
      const t0 = MK("test", 1), t1 = END("test"), a = vis(t, t0, t1);
      if (a > 0) {
        const k = ease.outBack(prog(t, t0, t0 + 0.4), 2.4);
        g.save(); g.globalAlpha = a; g.translate(540, 450); g.rotate(-0.03); g.scale(k, k);
        shadow(() => { rr(-330, -90, 660, 180, 40); g.fillStyle = RED; g.fill(); });
        txt("เจาะได้สบาย ๆ", 0, 6, F.b(84), WHITE);
        g.restore();
      }
    }
    pill("โหมดสกัด", 60, 260, 54, INK, YEL, C.chisel.start, END("chisel"), t);
    // spec card
    card(img, 540, 640, 800, 520, null, C.spec.start - 0.2, END("spec"), t);
    pill("20V · 4.0Ah", 60, 1000, 48, INK, YEL, MK("spec", 0) + 0.4, END("spec"), t);
    pill("มอเตอร์บัสเลส (Brushless)", 60, 1110, 46, INK, WHITE, MK("spec", 1), END("spec"), t);
    if (vis(t, C.spec.start, END("spec")) > 0) { g.save(); g.globalAlpha = vis(t, C.spec.start, END("spec")); txt("* ตามสเปกร้าน", 1000, 1190, F.m(30), WHITE, "right"); g.restore(); }
    // CTA: two variants + button + safety
    card(img2, 290, 640, 440, 420, "เฉพาะตัวเครื่อง", MK("cta", 0) + 0.1, TL.duration + 1, t);
    card(img, 790, 640, 440, 420, "ชุดพร้อมแบต", MK("cta", 0) + 0.6, TL.duration + 1, t);
    {
      const t0 = MK("cta", 1) - 0.1, a = prog(t, t0, t0 + 0.3);
      if (a > 0) {
        const s = 1 + 0.04 * Math.sin(t * 6);
        g.save(); g.globalAlpha = a; g.translate(540, 1150); g.scale(s, s);
        shadow(() => { rr(-400, -80, 800, 160, 80); g.fillStyle = YEL; g.fill(); });
        g.strokeStyle = INK; g.lineWidth = 9; g.lineCap = "round"; g.lineJoin = "round";
        g.beginPath(); g.moveTo(-330, -34); g.lineTo(-314, -34); g.lineTo(-298, 22); g.lineTo(-248, 22); g.lineTo(-236, -14); g.lineTo(-306, -14); g.stroke();
        g.fillStyle = INK; g.beginPath(); g.arc(-290, 40, 9, 0, 7); g.arc(-254, 40, 9, 0, 7); g.fill();
        txt("ดูรุ่นและราคาในตะกร้า", 40, 4, F.b(56), INK);
        g.restore();
        const bob = Math.sin(t * 7) * 10;
        g.save(); g.globalAlpha = a; g.translate(230, 1290 + bob); g.rotate(0.35); g.fillStyle = YEL; g.strokeStyle = INK; g.lineWidth = 5;
        g.beginPath(); g.moveTo(0, 70); g.lineTo(-50, 10); g.lineTo(-20, 10); g.lineTo(-20, -50); g.lineTo(20, -50); g.lineTo(20, 10); g.lineTo(50, 10); g.closePath(); g.fill(); g.stroke(); g.restore();
      }
      const w0 = MK("cta", 2) - 0.1, wa = prog(t, w0, w0 + 0.3);
      if (wa > 0) {
        g.save(); g.globalAlpha = wa;
        shadow(() => { rr(60, 220, 640, 90, 45); g.fillStyle = "rgba(20,22,28,0.88)"; g.fill(); });
        warnTri(115, 265, 1); txt("สวมแว่นนิรภัยขณะใช้งาน", 160, 268, F.b(42), YEL, "left");
        g.restore();
      }
    }
    captions(t);
  }
  function events() {
    return { pen: [], pops: [MK("modes", 1), MK("modes", 2), MK("modes", 3), MK("test", 1), MK("spec", 1)],
      whoosh: Object.keys(C).slice(1).map((k) => C[k].start - 0.25), cta: MK("cta", 1), price: null };
  }
  window.scene = { setup, preload, draw, events };
})();
