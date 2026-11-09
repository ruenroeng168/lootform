// AI-illustrated comic sample (panels generated in Canva, exported 1080x1920): camera moves, impact FX,
// comic SFX lettering, captions and flashes on top of the panels. Audio = Dorgu voice line + crowd/SFX.
(function () {
  const { clamp, lerp, prog, ease, rng } = window.L;
  const W = 1080, H = 1920, INK = "#111014";
  const F = { c: (s) => `700 ${s}px "Mali"`, d: (s) => `700 ${s}px "Chakra Petch"` };
  let g, TL, C, D, img = {}, dots;

  function setup(canvas, tl) {
    g = canvas.getContext("2d"); TL = tl; C = tl.cues; D = tl.data;
    dots = document.createElement("canvas"); dots.width = dots.height = 14;
    const d = dots.getContext("2d"); d.fillStyle = "#000"; d.beginPath(); d.arc(7, 7, 2.6, 0, 7); d.fill();
  }
  function preload() {
    return Promise.all(Object.entries(D.images).map(([k, s]) => new Promise((r) => { const im = new Image(); im.onload = () => { img[k] = im; r(); }; im.onerror = r; im.src = s; })));
  }
  const T = (k) => C[k].start;

  // camera: zoom z around focus point (fx, fy) in image space, plus offset
  function shot(key, z, fx, fy, dx = 0, dy = 0) {
    const im = img[key]; if (!im) return;
    g.save(); g.translate(W / 2 + dx, H / 2 + dy); g.scale(z, z); g.translate(-fx, -fy);
    g.drawImage(im, 0, 0, W, H); g.restore();
  }
  function blob(path, fill, lw = 8) { g.beginPath(); path(); g.fillStyle = fill; g.fill(); g.lineWidth = lw; g.strokeStyle = INK; g.lineJoin = "round"; g.stroke(); }
  function sfx(s, x, y, size, k, rot = -0.12, fill = "#ffd400") {
    if (k <= 0) return;
    g.save(); g.translate(x, y); g.rotate(rot); g.scale(k, k);
    g.font = F.c(size); g.textAlign = "center"; g.textBaseline = "middle"; g.lineJoin = "round";
    g.lineWidth = size * 0.3; g.strokeStyle = INK; g.strokeText(s, 0, 0);
    g.lineWidth = size * 0.14; g.strokeStyle = "#ffffff"; g.strokeText(s, 0, 0);
    g.fillStyle = fill; g.fillText(s, 0, 0); g.restore();
  }
  function burst(x, y, r, k, fill, spikes = 14) {
    if (k <= 0) return;
    g.save(); g.translate(x, y); g.scale(k, k);
    blob(() => { for (let i = 0; i <= spikes * 2; i++) { const a = (i / (spikes * 2)) * Math.PI * 2, rr = i % 2 ? r * 0.6 : r; g.lineTo(Math.cos(a) * rr, Math.sin(a) * rr); } g.closePath(); }, fill, 10);
    g.restore();
  }
  function speedLines(cx, cy, t, a, n = 54, r0 = 380) {
    if (a <= 0) return;
    const r = rng(Math.floor(t * 14));
    g.save(); g.globalAlpha = a; g.strokeStyle = "#ffffff";
    for (let k = 0; k < n; k++) {
      const ang = (k / n) * Math.PI * 2 + r() * 0.12, rr = r0 + r() * 160;
      g.lineWidth = 2 + r() * 9; g.beginPath(); g.moveTo(cx + Math.cos(ang) * rr, cy + Math.sin(ang) * rr); g.lineTo(cx + Math.cos(ang) * 2200, cy + Math.sin(ang) * 2200); g.stroke();
    }
    g.restore();
  }
  function capBox(s, x, y, size, bg = "#ffe45c", fg = INK, k = 1) {
    if (k <= 0) return;
    g.font = F.c(size); const w = g.measureText(s).width + 50, h = size * 1.6;
    g.save(); g.globalAlpha = clamp(k); g.translate(x + (1 - k) * -60, y); g.rotate(-0.015);
    blob(() => g.rect(0, 0, w, h), bg, 7);
    g.fillStyle = fg; g.textAlign = "left"; g.textBaseline = "middle"; g.fillText(s, 25, h / 2 + 2);
    g.restore();
  }
  function frame() { g.lineWidth = 16; g.strokeStyle = INK; g.strokeRect(8, 8, W - 16, H - 16); }
  function halftone(a) { g.save(); g.globalAlpha = a; g.globalCompositeOperation = "multiply"; g.fillStyle = g.createPattern(dots, "repeat"); g.fillRect(0, 0, W, H); g.restore(); }

  function draw(t) {
    g.setTransform(1, 0, 0, 1, 0, 0); g.globalAlpha = 1; g.fillStyle = "#000"; g.fillRect(0, 0, W, H);
    const kick = T("dorgu") - 0.9, c2 = T("dorgu") - 0.1, th = T("header"), tg = T("goal");
    if (t < c2) {
      // panel 1: slow push-in on the taker, quick punch toward the ball as he strikes it
      const p = prog(t, 0, kick), q = ease.outCubic(prog(t, kick, kick + 0.35));
      shot("p1", lerp(1.0, 1.1, ease.inOutCubic(p)) + 0.05 * q, lerp(500, 600, p), lerp(920, 1080, q));
      speedLines(780, 1500, t, prog(t, kick, kick + 0.1) * (1 - prog(t, kick + 0.5, c2)), 40, 300);
      halftone(0.06); frame();
      capBox("ทดเจ็บนาทีที่ 6", 50, 70, 52, "#ffe45c", INK, ease.outBack(prog(t, 0.3, 0.7), 1.6));
      capBox("ลูกเตะมุมลูกสุดท้าย!", 50, 175, 52, "#ffffff", INK, ease.outBack(prog(t, 1.4, 1.8), 1.6));
      const ck = ease.outBack(prog(t, 0.6, 1.0), 2);
      if (ck > 0) {
        g.save(); g.translate(880, 1620); g.rotate(0.05); g.scale(ck, ck);
        blob(() => g.roundRect(-140, -60, 280, 120, 22), "#e01f2d", 9);
        g.font = F.d(84); g.fillStyle = "#fff"; g.textAlign = "center"; g.textBaseline = "middle"; g.fillText("90+6'", 0, 6);
        g.restore();
      }
      sfx("ฟิ้ว!", 760, 1340, 110, ease.outBack(prog(t, kick, kick + 0.2), 2.5) * (1 - prog(t, kick + 0.6, kick + 0.8)), -0.2, "#ffffff");
    } else if (t < tg - 0.05) {
      // panel 2: slam in, drift up toward the header, hard punch on contact
      const pin = ease.outBack(prog(t, c2, c2 + 0.25), 1.5), hit = prog(t, th, th + 0.12);
      const sh = t > th ? Math.max(0, 1 - (t - th) / 0.35) * 18 : 0;
      shot("p2", lerp(1.25, 1.08, pin) + 0.14 * ease.outCubic(hit), lerp(560, 600, prog(t, c2, th)), lerp(900, 520, ease.inOutCubic(prog(t, c2, th))),
        Math.sin(t * 90) * sh, Math.cos(t * 70) * sh);
      speedLines(560, 520, t, 0.5 + 0.4 * hit, 60, 420);
      halftone(0.05); frame();
      capBox("แพทริก ดอร์กู", 50, 70, 62, "#ffe45c", INK, ease.outBack(prog(t, c2 + 0.1, c2 + 0.4), 1.6));
      const k = ease.outBack(prog(t, th - 0.02, th + 0.2), 2.6);
      const z2 = lerp(1.25, 1.08, pin) + 0.14 * ease.outCubic(hit), fx2 = lerp(560, 600, prog(t, c2, th)), fy2 = lerp(900, 520, ease.inOutCubic(prog(t, c2, th)));
      const hx = W / 2 + (520 - fx2) * z2, hy = H / 2 + (230 - fy2) * z2;   // the header: top of the head in panel 2
      burst(hx + 170, hy - 90, 105, k, "#ffd400", 12);   // impact star between head and ball, head stays visible
      sfx("โป๊ก!", hx + 120, hy - 250, 130, k, -0.16, "#ffffff");
    } else {
      // panel 3: shake, then slow push on the celebration
      const sh = Math.max(0, 1 - (t - tg) / 0.6) * 24;
      shot("p3", lerp(1.22, 1.05, ease.outCubic(prog(t, tg, tg + 0.5))) + 0.04 * prog(t, tg + 0.5, TL.duration), 540, 1000,
        Math.sin(t * 85) * sh, Math.cos(t * 75) * sh);
      speedLines(540, 900, t, 0.55 * (1 - prog(t, tg + 1.5, tg + 2.5)), 50, 520);
      halftone(0.05); frame();
      const k = ease.outBack(prog(t, tg + 0.05, tg + 0.45), 2.2);
      burst(300, 330, 210, k, "#e01f2d", 16);
      sfx("4-4!", 300, 330, 150, k, -0.08, "#ffffff");
      sfx("ตุ้ม!!", 860, 760, 110, ease.outBack(prog(t, tg - 0.02, tg + 0.2), 2.5) * (1 - prog(t, tg + 0.9, tg + 1.2)), 0.16);
      capBox("ดอร์กู 90+6' · โหม่งตีเสมอ!", 50, 1480, 54, "#ffe45c", INK, ease.outBack(prog(t, tg + 1.2, tg + 1.6), 1.6));
    }
    g.setTransform(1, 0, 0, 1, 0, 0);
    for (const tt of [th, tg]) { const f = 1 - prog(t, tt, tt + 0.16); if (t >= tt && f > 0) { g.fillStyle = `rgba(255,255,255,${0.65 * f})`; g.fillRect(0, 0, W, H); } }
    const fin = Math.max(prog(t, TL.duration - 0.4, TL.duration), 1 - prog(t, 0, 0.25));
    if (fin > 0) { g.fillStyle = `rgba(0,0,0,${fin})`; g.fillRect(0, 0, W, H); }
  }
  window.scene = { setup, preload, draw, events: () => ({}) };
})();
