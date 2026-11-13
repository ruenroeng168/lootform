// Overlay for the อุบลเด้อ winter water-heater clip (render.mjs --overlay on out/base.mp4 from prep.py).
// Hook headline + warning sign + red flash on "ไฟดูด!", safety checklist, step badge 1/4–4/4, ring + tap on the
// real "แจ้งงานช่าง (ฟรี)" button, captions, "ภาพจำลองโดย AI" label on AI pictures, end card.
(function () {
  const { clamp, prog, ease } = window.L;
  const W = 1080, H = 1920;
  const INK = "#22140c", ORANGE = "#f15a24", YEL = "#ffc928", WHITE = "#fff", GREEN = "#22a565", RED = "#e2231a", CREAM = "#fff7ed", ICE = "#bfe6ff";
  const F = { b: (s) => `700 ${s}px "IBM Plex Sans Thai"`, m: (s) => `600 ${s}px "IBM Plex Sans Thai"`, d: (s) => `700 ${s}px "Chakra Petch"` };
  let g, D, S = {}, logo;
  const STEPS = { s1: "แจ้งงานฟรี", s2: "ช่างโทรถาม เสนอราคา", s3: "ตกลงราคา ช่างเข้างาน", s4: "งานเสร็จ ค่อยจ่าย" };

  function setup(c, tl) { g = c.getContext("2d"); D = tl.data; D.segs.forEach((s) => (S[s.key] = s)); }
  function preload() { return new Promise((r) => { logo = new Image(); logo.onload = r; logo.onerror = r; logo.src = D.images.logo; }); }
  function rr(x, y, w, h, r) { g.beginPath(); g.roundRect(x, y, w, h, r); }
  function txt(s, x, y, font, col, align = "center") { g.font = font; g.fillStyle = col; g.textAlign = align; g.textBaseline = "middle"; g.fillText(s, x, y); }
  function shadow(fn, blur = 30, oy = 10, col = "rgba(0,0,0,0.5)") { g.save(); g.shadowColor = col; g.shadowBlur = blur; g.shadowOffsetY = oy; fn(); g.restore(); }
  const vis = (t, a, b) => prog(t, a, a + 0.2) * (1 - prog(t, b - 0.18, b));
  function outlined(s, x, y, size, fill, k = 1, stroke = INK) {
    g.save(); g.translate(x, y); g.scale(k, k); g.font = F.b(size); g.textAlign = "center"; g.textBaseline = "middle"; g.lineJoin = "round";
    g.lineWidth = size * 0.22; g.strokeStyle = stroke; g.strokeText(s, 0, 0); g.fillStyle = fill; g.fillText(s, 0, 0); g.restore();
  }
  function fitSize(s, size, maxW) { g.font = F.b(size); while (g.measureText(s).width > maxW && size > 30) { size -= 2; g.font = F.b(size); } return size; }

  function hook(t) {
    const h = S.hook, e = S.safety.t0 - 0.15; if (t > e) return;
    const [p1, p2, p3] = h.parts;
    g.save(); const gr = g.createLinearGradient(0, 1000, 0, 1800); gr.addColorStop(0, "rgba(0,10,25,0)"); gr.addColorStop(1, "rgba(0,10,25,0.75)"); g.fillStyle = gr; g.fillRect(0, 1000, W, 920); g.restore();
    const k1 = ease.outBack(prog(t, p1[0] - 0.05, p1[0] + 0.3), 2);
    if (k1 > 0) outlined(p1[2], 540, 1180, fitSize(p1[2], 96, 960), ICE, k1);
    if (t >= p2[0] - 0.05) {
      const k = ease.outBack(prog(t, p2[0] - 0.05, p2[0] + 0.3), 2.2);
      // warning triangle
      g.save(); g.translate(540, 520); g.scale(k * (1 + 0.05 * Math.sin(t * 14)), k * (1 + 0.05 * Math.sin(t * 14)));
      shadow(() => { g.fillStyle = YEL; g.beginPath(); g.moveTo(0, -150); g.lineTo(165, 130); g.lineTo(-165, 130); g.closePath(); g.fill(); }, 40, 0, "rgba(255,200,0,0.6)");
      g.lineWidth = 14; g.strokeStyle = INK; g.lineJoin = "round"; g.beginPath(); g.moveTo(0, -150); g.lineTo(165, 130); g.lineTo(-165, 130); g.closePath(); g.stroke();
      // lightning bolt
      g.fillStyle = INK; g.beginPath(); g.moveTo(22, -80); g.lineTo(-38, 30); g.lineTo(2, 30); g.lineTo(-20, 105); g.lineTo(42, -10); g.lineTo(2, -10); g.closePath(); g.fill();
      g.restore();
      outlined(p2[2], 540, 1320, fitSize(p2[2], 74, 1000), WHITE, k);
    }
    if (t >= p3[0] - 0.05) {
      const k = ease.outBack(prog(t, p3[0] - 0.05, p3[0] + 0.25), 2.6), sh = (1 - prog(t, p3[0], p3[0] + 0.6)) * Math.sin(t * 90) * 14;
      outlined(p3[2], 540 + sh, 1470, fitSize(p3[2], 108, 1000), "#ff4a3d", k, WHITE);
      const f = 1 - prog(t, p3[0], p3[0] + 0.35);
      if (f > 0) { g.fillStyle = `rgba(255,30,20,${0.35 * f})`; g.fillRect(0, 0, W, H); }
    }
  }
  function safety(t) {
    const s = S.safety, e = S.s1.t0 - 0.15; if (t < s.t0 - 0.1 || t > e) return;
    const a = vis(t, s.t0 - 0.1, e);
    const rows = [["มีสายดิน", s.parts[1][0]], ["เบรกเกอร์กันดูด", s.parts[1][0] + (s.parts[1][1] - s.parts[1][0]) * 0.45], ["ให้ช่างไฟฟ้าติดตั้ง", s.parts[2][0]]];
    g.save(); g.globalAlpha = a;
    const k = ease.outBack(prog(t, s.t0, s.t0 + 0.35), 1.8);
    g.translate(540, 1180); g.scale(k, k);
    shadow(() => { rr(-430, -250, 860, 500, 40); g.fillStyle = "rgba(255,247,237,0.96)"; g.fill(); }, 50, 16);
    rr(-430, -250, 860, 110, [40, 40, 0, 0]); g.fillStyle = ORANGE; g.fill();
    txt("ติดเครื่องทำน้ำอุ่นให้ปลอดภัย", 0, -194, F.b(50), WHITE);
    rows.forEach(([label, t0], i) => {
      const kk = ease.outBack(prog(t, t0, t0 + 0.3), 2.2); if (kk <= 0) return;
      g.save(); g.translate(-340, -60 + i * 105); g.scale(kk, kk);
      g.fillStyle = GREEN; g.beginPath(); g.arc(0, 0, 34, 0, 7); g.fill();
      g.strokeStyle = WHITE; g.lineWidth = 9; g.lineCap = g.lineJoin = "round"; g.beginPath(); g.moveTo(-15, 1); g.lineTo(-4, 13); g.lineTo(17, -12); g.stroke();
      txt(label, 60, 3, F.b(56), INK, "left"); g.restore();
    });
    g.restore();
  }
  function steps(t) {
    Object.keys(STEPS).forEach((k, i) => {
      const s = S[k], nxt = D.segs[D.segs.indexOf(s) + 1], e = nxt.t0 - 0.15, a = vis(t, s.t0 - 0.1, e); if (a <= 0) return;
      const sl = ease.outCubic(prog(t, s.t0 - 0.1, s.t0 + 0.25));
      g.save(); g.globalAlpha = a; g.translate((1 - sl) * -500, 0);
      shadow(() => { rr(40, 150, 620, 140, 30); g.fillStyle = "rgba(34,20,12,0.92)"; g.fill(); });
      g.fillStyle = ORANGE; g.beginPath(); g.arc(120, 220, 50, 0, 7); g.fill(); txt(String(i + 1), 120, 224, F.d(62), WHITE);
      txt(`ขั้นที่ ${i + 1}/4`, 190, 186, F.m(32), YEL, "left");
      txt(STEPS[k], 190, 240, F.b(fitSize(STEPS[k], 50, 440)), WHITE, "left");
      for (let j = 0; j < 4; j++) { rr(190 + j * 110, 274, 100, 8, 4); g.fillStyle = j <= i ? ORANGE : "rgba(255,255,255,0.25)"; g.fill(); }
      g.restore();
    });
    // ring + tap on the real "แจ้งงานช่าง (ฟรี)" button
    const s1 = S.s1, [x, y, w, h] = D.report, a = vis(t, s1.t0 + 0.3, S.s2.t0 - 0.15);
    if (a > 0) {
      const p = ((t - s1.t0) % 1) / 1;
      g.save(); g.globalAlpha = a; g.strokeStyle = YEL; g.lineWidth = 10; rr(x - 10, y - 10, w + 20, h + 20, 40); g.stroke();
      g.globalAlpha = a * (1 - p); g.lineWidth = 5; rr(x - 10 - 24 * p, y - 10 - 24 * p, w + 20 + 48 * p, h + 20 + 48 * p, 40 + 24 * p); g.stroke(); g.restore();
      const tp = s1.parts[0][0] + 1.2;
      if (t > tp && t < tp + 0.6) { const u = prog(t, tp, tp + 0.6); g.save(); g.globalAlpha = 1 - u; g.strokeStyle = WHITE; g.lineWidth = 8; g.beginPath(); g.arc(x + w / 2, y + h / 2, 20 + 110 * u, 0, 7); g.stroke(); g.restore(); }
    }
  }
  function captions(t) {
    let c = null;
    D.segs.forEach((s) => { if (s.key === "hook" || s.key === "safety" || s.key === "end") return; s.parts.forEach((p) => { if (t >= p[0] - 0.05 && t < p[1] + 0.12) c = p; }); });
    if (!c) return; const [s, e, p] = c, a = prog(t, s - 0.05, s + 0.06) * (1 - prog(t, e, e + 0.12));
    const z = fitSize(p, 60, 960);
    g.font = F.b(z); const bw = g.measureText(p).width + 70;
    g.save(); g.globalAlpha = a; rr(540 - bw / 2, 1470, bw, 104, 30); g.fillStyle = "rgba(20,12,8,0.75)"; g.fill(); txt(p, 540, 1524, F.b(z), WHITE); g.restore();
  }
  function aiLabel(t) {
    for (const [a, b] of D.ai.concat([[0, S.safety.t0 - 0.15]])) if (t >= a && t < b) {
      g.save(); g.globalAlpha = 0.85; rr(40, 312, 270, 50, 25); g.fillStyle = "rgba(0,0,0,0.5)"; g.fill(); txt("ภาพจำลองโดย AI", 175, 338, F.m(28), WHITE); g.restore(); return;
    }
  }
  function endCard(t) {
    const t0 = D.end; if (t < t0) return; const e = S.end, a = prog(t, t0, t0 + 0.3);
    g.save(); g.globalAlpha = a;
    const k = ease.outBack(prog(t, t0 + 0.05, t0 + 0.5), 2);
    g.save(); g.translate(540, 520); g.scale(k, k); shadow(() => { rr(-130, -130, 260, 260, 58); g.fillStyle = WHITE; g.fill(); }, 50, 14);
    if (logo) { g.save(); rr(-120, -120, 240, 240, 52); g.clip(); g.drawImage(logo, -120, -120, 240, 240); g.restore(); } g.restore();
    g.globalAlpha = a * prog(t, e.parts[0][0], e.parts[0][0] + 0.3);
    outlined("หน้าหนาวนี้", 540, 790, 84, ICE); outlined("อาบน้ำอุ่นแบบสบายใจ", 540, 900, 84, WHITE);
    g.globalAlpha = a * prog(t, e.parts[1][0], e.parts[1][0] + 0.3);
    txt("แจ้งงานช่างในอุบลฯ ได้ฟรีที่", 540, 1050, F.b(50), CREAM);
    const c = ease.outBack(prog(t, e.parts[1][0] + 0.2, e.parts[1][0] + 0.55), 2), s = c * (1 + 0.035 * Math.sin((t - t0) * 6));
    g.translate(540, 1190); g.scale(s, s);
    shadow(() => { rr(-450, -76, 900, 152, 76); g.fillStyle = YEL; g.fill(); });
    txt("ubonder.vercel.app/chang", 0, 4, F.d(58), INK);
    g.restore();
  }

  function draw(t) {
    g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, W, H); g.globalAlpha = 1;
    hook(t); safety(t); steps(t); captions(t); aiLabel(t); endCard(t);
  }
  window.scene = { setup, preload, draw, events: () => ({ pen: [], pops: [], whoosh: [] }) };
})();
