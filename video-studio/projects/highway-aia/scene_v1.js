// Overlay for ทางหลวง FC vs AIA atmosphere clip: hook headline, match card, set-by-set scoreboard, confetti on 5-1,
// birthday banner, commentator captions, summary + logo end card.
(function () {
  const { clamp, prog, ease } = window.L;
  const W = 1080, H = 1920;
  const INK = "#14110a", YEL = "#ffd21f", WHITE = "#fff", GREEN = "#22b35a", RED = "#e23b2e", GREY = "#8a8a8a", NAVY = "#101a33";
  const F = { b: (s) => `700 ${s}px "IBM Plex Sans Thai"`, m: (s) => `600 ${s}px "IBM Plex Sans Thai"`, d: (s) => `700 ${s}px "Chakra Petch"` };
  let g, D, logo;
  function setup(c, tl) { g = c.getContext("2d"); D = tl.data; }
  function preload() { return new Promise((r) => { logo = new Image(); logo.onload = r; logo.onerror = r; logo.src = D.images.logo; }); }
  function rr(x, y, w, h, r) { g.beginPath(); g.roundRect(x, y, w, h, r); }
  function txt(s, x, y, font, col, align = "center") { g.font = font; g.fillStyle = col; g.textAlign = align; g.textBaseline = "middle"; g.fillText(s, x, y); }
  function shadow(fn, blur = 30, oy = 10, col = "rgba(0,0,0,0.5)") { g.save(); g.shadowColor = col; g.shadowBlur = blur; g.shadowOffsetY = oy; fn(); g.restore(); }
  const vis = (t, a, b) => prog(t, a, a + 0.22) * (1 - prog(t, b - 0.2, b));
  function fit(s, size, maxW, font = F.b) { g.font = font(size); while (g.measureText(s).width > maxW && size > 28) { size -= 2; g.font = font(size); } return size; }
  function outlined(s, x, y, size, fill, k = 1) {
    g.save(); g.translate(x, y); g.scale(k, k); g.font = F.b(size); g.textAlign = "center"; g.textBaseline = "middle"; g.lineJoin = "round";
    g.lineWidth = size * 0.2; g.strokeStyle = INK; g.strokeText(s, 0, 0); g.fillStyle = fill; g.fillText(s, 0, 0); g.restore();
  }
  function hook(t) {
    const [a, b] = D.segs.hook; if (t > b) return; const al = 1 - prog(t, b - 0.2, b);
    const gr = g.createLinearGradient(0, 0, 0, 720); gr.addColorStop(0, "rgba(0,0,0,0.75)"); gr.addColorStop(1, "rgba(0,0,0,0)");
    g.save(); g.globalAlpha = al; g.fillStyle = gr; g.fillRect(0, 0, W, 720);
    const k1 = ease.outBack(prog(t, a + 0.1, a + 0.45), 2), k2 = ease.outBack(prog(t, a + 2.6, a + 3.0), 2.6);
    if (k1 > 0) outlined("โดน AIA เอาคืนเซ็ต 3…", 540, 250, fit("โดน AIA เอาคืนเซ็ต 3…", 84, 980), WHITE, k1);
    if (k2 > 0) { outlined("เซ็ตสุดท้าย ตอบกลับ", 540, 370, 76, YEL, k2); const s = k2 * (1 + 0.05 * Math.sin(t * 12)); outlined("5-1!", 540, 520, 170, YEL, s); }
    g.restore();
  }
  function matchCard(t) {
    const [a, b] = D.segs.intro, al = vis(t, a, b); if (al <= 0) return;
    const k = ease.outBack(prog(t, a, a + 0.4), 1.6);
    g.save(); g.globalAlpha = al; g.translate(540, 360); g.scale(k, k);
    shadow(() => { rr(-470, -170, 940, 345, 30); g.fillStyle = "rgba(16,26,51,0.92)"; g.fill(); });
    g.fillStyle = YEL; g.fillRect(-470, 115, 940, 60);
    if (logo) { g.save(); rr(-410, -150, 180, 180, 26); g.clip(); g.drawImage(logo, -410, -150, 180, 180); g.restore(); }
    txt("VS", 0, -60, F.d(90), YEL);
    rr(230, -150, 180, 180, 26); g.fillStyle = "#e9eef7"; g.fill(); txt("AIA", 320, -60, F.d(72), NAVY);
    txt("ทางหลวง FC", -320, 100 - 8, F.b(32), WHITE); txt("ทีม AIA", 320, 100 - 8, F.b(32), WHITE);
    txt("สนามกองบิน 21 · จ.อุบลราชธานี", 0, 141, F.b(34), INK);
    g.restore();
  }
  function board(t) {
    const a = D.scores[0][0] - 0.1, b = D.segs.s4[1] + 0.1, al = vis(t, a, b); if (al <= 0) return;
    const x = 90, y = 1060, w = 900;
    g.save(); g.globalAlpha = al;
    shadow(() => { rr(x, y, w, 420, 26); g.fillStyle = "rgba(12,16,30,0.9)"; g.fill(); });
    rr(x, y, w, 76, [26, 26, 0, 0]); g.fillStyle = YEL; g.fill();
    txt("เซ็ต", x + 90, y + 39, F.b(34), INK); txt("ทางหลวง", x + 400, y + 39, F.b(34), INK); txt("AIA", x + 640, y + 39, F.b(34), INK); txt("ผล", x + 820, y + 39, F.b(34), INK);
    D.scores.forEach(([when, k, s1, s2], i) => {
      if (t < when) return; const kk = ease.outBack(prog(t, when, when + 0.35), 2), yy = y + 120 + i * 84;
      const res = s1 > s2 ? ["ชนะ", GREEN] : s1 === s2 ? ["เสมอ", GREY] : ["แพ้", RED];
      const big = i === 3, flash = big ? 1 + 0.08 * Math.sin((t - when) * 10) * (1 - prog(t, when + 1.6, when + 2.6)) : 1;
      g.save(); g.translate(0, yy); g.globalAlpha = al * clamp(kk);
      if (big) { rr(x + 12, -38, w - 24, 76, 14); g.fillStyle = "rgba(255,210,31,0.18)"; g.fill(); }
      txt(String(i + 1), x + 90, 2, F.d(44), WHITE);
      g.save(); g.translate(x + 520, 0); g.scale(flash * kk, flash * kk); txt(`${s1}`, -120, 2, F.d(big ? 66 : 54), big ? YEL : WHITE); txt("-", 0, 2, F.d(50), WHITE); txt(`${s2}`, 120, 2, F.d(54), WHITE); g.restore();
      rr(x + 760, -26, 120, 52, 26); g.fillStyle = res[1]; g.fill(); txt(res[0], x + 820, 2, F.b(30), WHITE);
      g.restore();
    });
    g.restore();
  }
  const CONF = Array.from({ length: 150 }, (_, i) => { const r = (n) => { const x = Math.sin(i * 91.7 + n * 47.3) * 43758.5; return x - Math.floor(x); };
    return { x: r(1) * W, vy: 500 + r(2) * 700, vx: (r(3) - 0.5) * 300, rot: r(4) * 6, vr: (r(5) - 0.5) * 12, c: [YEL, WHITE, GREEN, "#2e7bff", RED][i % 5], w: 14 + r(6) * 14, d: r(7) * 0.6 }; });
  function confetti(t, t0, dur) {
    const u = t - t0; if (u < 0 || u > dur) return; g.save(); g.globalAlpha = 1 - prog(u, dur - 0.6, dur);
    for (const p of CONF) { const uu = u - p.d; if (uu < 0) continue; g.save(); g.translate(p.x + p.vx * uu, -40 + p.vy * uu); g.rotate(p.rot + p.vr * uu); g.scale(1, Math.cos(uu * 8 + p.rot)); g.fillStyle = p.c; g.fillRect(-p.w / 2, -p.w / 4, p.w, p.w / 2); g.restore(); }
    g.restore();
  }
  function bday(t) {
    const [a, b] = D.segs.bday, al = vis(t, a + 0.1, b); if (al <= 0) return;
    const k = ease.outBack(prog(t, a + 0.2, a + 0.6), 2);
    g.save(); g.globalAlpha = al; g.translate(540, 300); g.scale(k, k); g.rotate(-0.03);
    shadow(() => { rr(-400, -90, 800, 180, 90); g.fillStyle = "#ff4f8b"; g.fill(); });
    txt("🎂", -320, 4, F.b(80), WHITE); txt("Happy Birthday!", 40, 4, F.d(84), WHITE);
    g.restore();
    const bal = [[160, "#ff4f8b"], [920, YEL], [260, "#2e7bff"], [840, GREEN]];
    bal.forEach(([x, c], i) => { const y = H + 100 - ((t - a) * (180 + i * 30)) % (H + 400); g.save(); g.globalAlpha = al * 0.9; g.fillStyle = c; g.beginPath(); g.ellipse(x + Math.sin(t * 2 + i) * 20, y, 55, 70, 0, 0, 7); g.fill();
      g.strokeStyle = "rgba(255,255,255,0.7)"; g.lineWidth = 2; g.beginPath(); g.moveTo(x, y + 70); g.lineTo(x + Math.sin(t * 3 + i) * 10, y + 220); g.stroke(); g.restore(); });
  }
  function caps(t) {
    const c = D.caps.find(([a, b]) => t >= a - 0.05 && t < b + 0.15); if (!c || c[0] < D.segs.intro[0]) return;
    const [a, b, s] = c, al = prog(t, a - 0.05, a + 0.08) * (1 - prog(t, b, b + 0.15));
    const z = fit(s, 54, 980); g.font = F.b(z); const bw = Math.min(1040, g.measureText(s).width + 70);
    g.save(); g.globalAlpha = al; rr(540 - bw / 2, 1560, bw, 100, 26); g.fillStyle = "rgba(0,0,0,0.72)"; g.fill(); txt(s, 540, 1612, F.b(z), WHITE); g.restore();
  }
  function endCard(t) {
    const a = D.blackout - 0.2; if (t < a) return; const al = prog(t, a, a + 0.3);
    g.save(); g.globalAlpha = al; const gr = g.createLinearGradient(0, 0, 0, H); gr.addColorStop(0, "#1b2a55"); gr.addColorStop(1, "#06090f"); g.fillStyle = gr; g.fillRect(0, 0, W, H);
    const k = ease.outBack(prog(t, a + 0.1, a + 0.5), 1.8);
    if (logo) { const s = 420 * k; g.save(); rr(540 - s / 2, 560 - s / 2, s, s, 36); g.clip(); g.drawImage(logo, 540 - s / 2, 560 - s / 2, s, s); g.restore(); }
    g.globalAlpha = al * prog(t, a + 0.4, a + 0.8);
    txt("ทางหลวง FC  8 – 4  AIA", 540, 880, F.d(70), YEL);
    txt("ชนะ 2 · เสมอ 1 · แพ้ 1", 540, 975, F.b(46), WHITE);
    txt("สนามกองบิน 21 · จ.อุบลราชธานี", 540, 1050, F.m(36), "#c8d2e8");
    txt("ขอบคุณทีม AIA · เจอกันนัดหน้า!", 540, 1160, F.b(44), WHITE);
    g.restore();
  }
  function draw(t) {
    g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, W, H); g.globalAlpha = 1;
    hook(t); matchCard(t); board(t); confetti(t, D.segs.s4[0] + 1.6, 3.0); bday(t); caps(t); endCard(t);
  }
  window.scene = { setup, preload, draw, events: () => ({ pen: [], pops: [], whoosh: [] }) };
})();
