// Transparent overlay for a real-footage product review (rendered with --overlay on top of base.mp4).
// Keeps graphics small (well under 50% of the frame) and inside the app safe zone.
(function () {
  const { clamp, lerp, prog, ease } = window.L;
  const W = 1080, H = 1920;
  const INK = "#14161c", YEL = "#ffd23f", WHITE = "#ffffff", RED = "#e5484d", GREEN = "#1fa463";
  const F = { b: (s) => `700 ${s}px "IBM Plex Sans Thai"`, m: (s) => `600 ${s}px "IBM Plex Sans Thai"`, d: (s) => `700 ${s}px "Chakra Petch"` };
  let g, TL, C, D, img;
  const MK = (k, i) => (i === 0 ? C[k].start : C[k].marks[i - 1] ?? C[k].end);
  const END = (k) => { const ks = Object.keys(C), i = ks.indexOf(k); return i + 1 < ks.length ? C[ks[i + 1]].start - 0.15 : TL.duration; };

  function setup(canvas, tl) { g = canvas.getContext("2d"); TL = tl; C = tl.cues; D = tl.data || {}; }
  function preload() {
    const e = (D.images || [])[0]; if (!e) return Promise.resolve();
    return new Promise((res) => { img = new Image(); img.onload = res; img.onerror = res; img.src = typeof e === "string" ? e : e.src; });
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
        shadow(() => { rr(-330, -95, 660, 190, 34); g.fillStyle = YEL; g.fill(); });
        txt("รถติดหล่ม?", 0, 6, F.b(110), INK);
        g.restore();
      }
    }
    // intro title (lower-third style, top)
    pill("เครื่องกว้านไฟฟ้า", 60, 260, 56, INK, YEL, C.intro.start, END("intro"), t);
    // setup callouts
    pill("① ผูกกับต้นไม้", 60, 250, 50, "rgba(20,22,28,0.85)", WHITE, MK("setup", 0), END("setup"), t);
    pill("② กดรีโมท", 60, 360, 50, "rgba(20,22,28,0.85)", YEL, MK("setup", 1), END("setup"), t);
    // result badge
    pill("ลองใช้จริง", 60, 250, 42, GREEN, WHITE, C.result.start, END("result"), t);
    {
      const t0 = MK("result", 1), t1 = END("result"), a = vis(t, t0, t1);
      if (a > 0) {
        const k = ease.outBack(prog(t, t0, t0 + 0.4), 2.4);
        g.save(); g.globalAlpha = a; g.translate(540, 470); g.scale(k, k);
        shadow(() => { rr(-360, -95, 720, 190, 40); g.fillStyle = RED; g.fill(); });
        // stopwatch icon
        g.strokeStyle = WHITE; g.lineWidth = 9; g.beginPath(); g.arc(-255, 8, 48, 0, 7); g.stroke();
        g.fillStyle = WHITE; g.fillRect(-267, -58, 24, 14);
        const ang = -Math.PI / 2 + (t - t0) * 4; g.beginPath(); g.moveTo(-255, 8); g.lineTo(-255 + Math.cos(ang) * 34, 8 + Math.sin(ang) * 34); g.stroke();
        txt("ดึงได้ใน 1 นาที", 55, 6, F.b(76), WHITE);
        g.restore();
      }
    }
    // spec card with cut-out product + chips
    {
      const t0 = C.spec.start - 0.2, t1 = END("spec"), a = vis(t, t0, t1);
      if (a > 0 && img) {
        const k = ease.outBack(prog(t, t0, t0 + 0.45), 1.6);
        g.save(); g.globalAlpha = a; g.translate(540, 640); g.scale(k, k);
        shadow(() => { rr(-400, -230, 800, 460, 40); g.fillStyle = "rgba(255,255,255,0.96)"; g.fill(); }, 50, 18);
        const s = Math.min(720 / img.width, 360 / img.height) * (1 + 0.03 * Math.sin(t * 1.5));
        g.save(); g.shadowColor = "rgba(0,0,0,0.25)"; g.shadowBlur = 30; g.shadowOffsetY = 18;
        g.drawImage(img, -img.width * s / 2, -img.height * s / 2 + 5, img.width * s, img.height * s); g.restore();
        g.restore();
      }
      pill("2000 / 4000 lb", 60, 990, 48, INK, YEL, MK("spec", 0) + 0.4, t1, t);
      pill("กันน้ำ IP67", 60, 1100, 48, INK, WHITE, MK("spec", 1), t1, t);
      pill("มอเตอร์ทองแดง", 60, 1210, 48, INK, WHITE, MK("spec", 2), t1, t);
      if (a > 0) { g.save(); g.globalAlpha = a; txt("* ตามสเปกร้าน", 1000, 1290, F.m(30), WHITE, "right"); g.restore(); }
    }
    // CTA + safety
    {
      const t0 = C.cta.start - 0.1, a = prog(t, t0, t0 + 0.3);
      if (a > 0) {
        const s = 1 + 0.04 * Math.sin(t * 6);
        g.save(); g.globalAlpha = a; g.translate(540, 1230); g.scale(s, s);
        shadow(() => { rr(-400, -80, 800, 160, 80); g.fillStyle = YEL; g.fill(); });
        g.strokeStyle = INK; g.lineWidth = 9; g.lineCap = "round"; g.lineJoin = "round";
        g.beginPath(); g.moveTo(-330, -34); g.lineTo(-314, -34); g.lineTo(-298, 22); g.lineTo(-248, 22); g.lineTo(-236, -14); g.lineTo(-306, -14); g.stroke();
        g.fillStyle = INK; g.beginPath(); g.arc(-290, 40, 9, 0, 7); g.arc(-254, 40, 9, 0, 7); g.fill();
        txt("ดูรุ่นและราคาในตะกร้า", 40, 4, F.b(56), INK);
        g.restore();
        const bob = Math.sin(t * 7) * 10;
        g.save(); g.globalAlpha = a; g.translate(230, 1360 + bob); g.rotate(0.35); g.fillStyle = YEL; g.strokeStyle = INK; g.lineWidth = 5;
        g.beginPath(); g.moveTo(0, 70); g.lineTo(-50, 10); g.lineTo(-20, 10); g.lineTo(-20, -50); g.lineTo(20, -50); g.lineTo(20, 10); g.lineTo(50, 10); g.closePath(); g.fill(); g.stroke(); g.restore();
      }
      const w0 = MK("cta", 1) - 0.1, wa = prog(t, w0, w0 + 0.3);
      if (wa > 0) {
        g.save(); g.globalAlpha = wa;
        shadow(() => { rr(60, 220, 620, 90, 45); g.fillStyle = "rgba(20,22,28,0.88)"; g.fill(); });
        warnTri(115, 265, 1); txt("ยืนห่างสลิงขณะใช้งาน", 160, 268, F.b(42), YEL, "left");
        g.restore();
      }
    }
    captions(t);
  }
  function events() {
    return { pen: [], pops: [MK("setup", 0), MK("setup", 1), MK("result", 1), MK("spec", 1), MK("spec", 2)],
      whoosh: Object.keys(C).slice(1).map((k) => C[k].start - 0.25), cta: C.cta.start, price: null };
  }
  window.scene = { setup, preload, draw, events };
})();
