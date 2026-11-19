// Overlay for the อุบลเด้อ hype reel: generic "group post" mock (hook), slam question, logo slam, feature chips,
// ring on the real "แจ้งงานช่าง (ฟรี)" button, ช่างแต็ก name tag + captions, AI label, punchy end + end card.
(function () {
  const { clamp, prog, ease } = window.L;
  const W = 1080, H = 1920;
  const INK = "#22140c", OR = "#f15a24", YEL = "#ffc928", WHITE = "#fff", GREEN = "#22a565", RED = "#e2231a", CREAM = "#fff7ed", GREY = "#65676b";
  const F = { b: (s) => `700 ${s}px "IBM Plex Sans Thai"`, m: (s) => `600 ${s}px "IBM Plex Sans Thai"`, d: (s) => `700 ${s}px "Chakra Petch"` };
  let g, D, logo;
  function setup(c, tl) { g = c.getContext("2d"); D = tl.data; }
  function preload() { return new Promise((r) => { logo = new Image(); logo.onload = r; logo.onerror = r; logo.src = D.images.logo; }); }
  function rr(x, y, w, h, r) { g.beginPath(); g.roundRect(x, y, w, h, r); }
  function txt(s, x, y, font, col, align = "center") { g.font = font; g.fillStyle = col; g.textAlign = align; g.textBaseline = "middle"; g.fillText(s, x, y); }
  function shadow(fn, blur = 30, oy = 10, col = "rgba(0,0,0,0.5)") { g.save(); g.shadowColor = col; g.shadowBlur = blur; g.shadowOffsetY = oy; fn(); g.restore(); }
  const vis = (t, a, b) => prog(t, a, a + 0.18) * (1 - prog(t, b - 0.15, b));
  function fit(s, size, maxW) { g.font = F.b(size); while (g.measureText(s).width > maxW && size > 28) { size -= 2; g.font = F.b(size); } return size; }
  function outlined(s, x, y, size, fill, k = 1, stroke = INK) {
    g.save(); g.translate(x, y); g.scale(k, k); g.font = F.b(size); g.textAlign = "center"; g.textBaseline = "middle"; g.lineJoin = "round";
    g.lineWidth = size * 0.22; g.strokeStyle = stroke; g.strokeText(s, 0, 0); g.fillStyle = fill; g.fillText(s, 0, 0); g.restore();
  }
  const COMMENTS = [["ดันๆ", ""], ["ไม่รู้จ้า", ""], ["ช่างพี่คิวเต็มถึงเดือนหน้าครับ", ""], ["ดันจ้า", ""], ["ได้ช่างยังคะ?", ""], ["ทักแชทได้ค่ะ 🛍️", ""]];
  function hook(t) {
    const [a, b] = D.segs.hook; if (t > b + 0.1) return; const al = 1 - prog(t, b - 0.1, b + 0.1);
    const k = ease.outBack(prog(t, a, a + 0.3), 1.6);
    g.save(); g.globalAlpha = al; g.translate(540, 250); g.scale(k, k);
    shadow(() => { rr(-470, 0, 940, 860, 28); g.fillStyle = WHITE; g.fill(); }, 40, 14);
    g.fillStyle = "#d8dadf"; g.beginPath(); g.arc(-400, 70, 40, 0, 7); g.fill();
    txt("สมาชิกในกลุ่ม", -345, 56, F.b(34), "#050505", "left"); txt("ชุมชนคนอุบลฯ · 3 ชม. · 🌐", -345, 96, F.m(26), GREY, "left");
    txt("ด่วน!! ใครรู้จักช่างไฟแถวในเมืองบ้างคะ", -430, 175, F.b(40), "#050505", "left");
    txt("ไฟดับทั้งบ้านเลย 😭😭", -430, 230, F.b(40), "#050505", "left");
    g.fillStyle = "#e4e6eb"; g.fillRect(-440, 280, 880, 2);
    txt("👍 12   💬 47 ความคิดเห็น", -430, 315, F.m(28), GREY, "left");
    COMMENTS.forEach(([c], i) => {
      const t0 = a + 0.35 + i * 0.42; if (t < t0) return; const kk = ease.outBack(prog(t, t0, t0 + 0.2), 2), y = 380 + i * 78;
      g.save(); g.translate(0, y); g.scale(1, kk);
      g.fillStyle = "#d8dadf"; g.beginPath(); g.arc(-410, 0, 24, 0, 7); g.fill();
      g.font = F.m(32); const w = g.measureText(c).width + 40; rr(-375, -30, w, 60, 30); g.fillStyle = "#f0f2f5"; g.fill();
      txt(c, -355, 2, F.m(32), "#050505", "left"); g.restore();
    });
    const tt = a + 0.35 + 6 * 0.42; if (t > tt) { const q = prog(t, tt, tt + 0.2); g.globalAlpha = al * q; txt("⏳ ผ่านไป 3 ชม. … ยังไม่ได้ช่าง", 0, 830, F.b(36), RED); }
    g.restore();
    const c = D.ncaps.find((x) => x[3] === "hook");
    if (t > c[0] - 0.05) { const kq = ease.outBack(prog(t, c[0], c[0] + 0.3), 2.2), sh = (1 - prog(t, c[0], c[0] + 0.5)) * Math.sin(t * 70) * 10;
      g.save(); g.globalAlpha = al; outlined("คนอุบลฯ ยังต้องหาช่าง", 540 + sh, 1300, 88, WHITE, kq); outlined("จากโพสต์ในกลุ่มอยู่อีกเหรอ?", 540 + sh, 1420, fit("จากโพสต์ในกลุ่มอยู่อีกเหรอ?", 88, 1000), YEL, kq); g.restore(); }
  }
  function brand(t) {
    const [a, b] = D.segs.brand, al = vis(t, a, b + 0.1); if (al <= 0) return;
    const k = ease.outBack(prog(t, a, a + 0.35), 2.6), ring = prog(t, a, a + 0.7);
    g.save(); g.globalAlpha = al;
    g.globalAlpha = al * (1 - ring); g.strokeStyle = YEL; g.lineWidth = 16; g.beginPath(); g.arc(540, 760, 180 + 260 * ring, 0, 7); g.stroke(); g.globalAlpha = al;
    g.translate(540, 760); g.scale(k, k);
    shadow(() => { rr(-170, -170, 340, 340, 74); g.fillStyle = WHITE; g.fill(); }, 50, 14);
    if (logo) { g.save(); rr(-160, -160, 320, 320, 68); g.clip(); g.drawImage(logo, -160, -160, 320, 320); g.restore(); }
    outlined("มี อุบลเด้อ แล้ว!", 0, 300, 110, WHITE);
    g.restore();
  }
  const CHIPS = { f1: [["📝 แจ้งงานฟรี", 0.1], ["เล่าปัญหา · แนบรูป · ปักหมุด", 0.45]], f2: [["📞 ช่างในพื้นที่โทรถาม", 0.1], ["💬 เสนอราคาก่อนทำ", 0.5]],
                  f3: [["🤝 ตกลงราคาก่อนเริ่มงาน", 0.1], ["✅ งานเสร็จ ค่อยจ่าย", 0.5]] };
  function chips(t) {
    for (const k of Object.keys(CHIPS)) {
      const [a, b] = D.segs[k]; if (t < a || t > b + 0.15) continue;
      CHIPS[k].forEach(([s, f], i) => {
        const t0 = a + (b - a) * f, al = vis(t, t0, b + 0.15); if (al <= 0) return; const kk = ease.outBack(prog(t, t0, t0 + 0.3), 2.2);
        g.save(); g.globalAlpha = al; g.translate(540, 1180 + i * 130); g.scale(kk, kk); g.rotate(i ? 0.02 : -0.02);
        const z = fit(s, 58, 900); g.font = F.b(z); const w = g.measureText(s).width + 80;
        shadow(() => { rr(-w / 2, -56, w, 112, 56); g.fillStyle = i ? YEL : OR; g.fill(); }); txt(s, 0, 3, F.b(z), i ? INK : WHITE); g.restore();
      });
    }
    const [a, b] = D.segs.f1, [x, y, w, h] = D.report;
    const u = prog(t, a, a + (b - a) / 1.5), z = 1 + 0.18 * (u * u * (3 - 2 * u)), vw = W / z, vh = H / z, x0 = clamp(540 - vw / 2, 0, W - vw), y0 = clamp(940 - vh / 2, 0, H - vh);
    const al = vis(t, a + 0.2, b); if (al > 0) { const X = (x - x0) * z, Y = (y - y0) * z, p = ((t - a) % 0.9) / 0.9;
      g.save(); g.globalAlpha = al; g.strokeStyle = YEL; g.lineWidth = 10; rr(X - 10, Y - 10, w * z + 20, h * z + 20, 44); g.stroke();
      g.globalAlpha = al * (1 - p); g.lineWidth = 6; rr(X - 10 - 26 * p, Y - 10 - 26 * p, w * z + 20 + 52 * p, h * z + 20 + 52 * p, 44); g.stroke(); g.restore(); }
  }
  function real(t) {
    const [a, b] = D.segs.real, al = vis(t, a, b); if (al <= 0) return; const k = ease.outBack(prog(t, a + 0.1, a + 0.4), 2);
    g.save(); g.globalAlpha = al; outlined("ช่างตัวจริง", 540, 330, 120, WHITE, k); outlined("ในอุบลฯ", 540, 470, 120, YEL, k); g.restore();
  }
  function tak(t) {
    const [a, b] = D.segs.tak, al = vis(t, a, b); if (al > 0) {
      const k = ease.outCubic(prog(t, a + 0.1, a + 0.45));
      g.save(); g.globalAlpha = al; g.translate((1 - k) * -600, 0);
      shadow(() => { rr(40, 1150, 380, 110, 20); g.fillStyle = OR; g.fill(); }); txt("ช่างแต็ก", 75, 1207, F.b(66), WHITE, "left");
      shadow(() => { rr(40, 1266, 500, 66, 16); g.fillStyle = INK; g.fill(); }); txt("ช่างไฟฟ้า · อุบลราชธานี", 70, 1300, F.b(36), YEL, "left");
      g.restore(); }
    const c = D.tcaps.find(([x, y]) => t >= x - 0.04 && t < y + 0.1); if (!c) return;
    const z = fit(c[2], 62, 960); g.font = F.b(z); const bw = g.measureText(c[2]).width + 70, a2 = prog(t, c[0] - 0.04, c[0] + 0.06) * (1 - prog(t, c[1], c[1] + 0.1));
    g.save(); g.globalAlpha = a2; rr(540 - bw / 2, 1480, bw, 110, 30); g.fillStyle = "rgba(0,0,0,0.78)"; g.fill(); txt(c[2], 540, 1537, F.b(z), YEL); g.restore();
  }
  function narr(t) {
    const c = D.ncaps.find(([x, y, , k]) => t >= x - 0.05 && t < y + 0.15 && !["hook", "brand", "f1", "f2", "f3"].includes(k)); if (!c) return;
    const [x, y, s, k] = c, al = prog(t, x - 0.05, x + 0.08) * (1 - prog(t, y, y + 0.15));
    const parts = s.split("…").map((p) => p.trim()).filter(Boolean), tot = parts.reduce((n, p) => n + p.length, 0); let acc = 0, cur = parts[0];
    for (const p of parts) { if (t >= x + (y - x) * acc / tot - 0.05) cur = p; acc += p.length; }
    const big = k === "end", z = fit(cur, big ? 84 : 58, 980);
    g.save(); g.globalAlpha = al;
    if (big) outlined(cur, 540, 1300, z, cur.includes("อุบลเด้อ") ? YEL : WHITE, ease.outBack(prog(t, x, x + 0.25), 2));
    else { g.font = F.b(z); const bw = g.measureText(cur).width + 70; rr(540 - bw / 2, 1590, bw, 104, 28); g.fillStyle = "rgba(0,0,0,0.72)"; g.fill(); txt(cur, 540, 1644, F.b(z), WHITE); }
    g.restore();
  }
  function aiLabel(t) {
    if (!D.ai.some(([a, b]) => t >= a && t < b)) return;
    g.save(); g.globalAlpha = 0.85; rr(40, 170, 270, 50, 25); g.fillStyle = "rgba(0,0,0,0.5)"; g.fill(); txt("ภาพจำลองโดย AI", 175, 196, F.m(28), WHITE); g.restore();
  }
  function endCard(t) {
    const a = D.endcard; if (t < a) return; const al = prog(t, a, a + 0.2);
    g.save(); g.globalAlpha = al; const gr = g.createLinearGradient(0, 0, 0, H); gr.addColorStop(0, OR); gr.addColorStop(1, "#5c1d08"); g.fillStyle = gr; g.fillRect(0, 0, W, H);
    const k = ease.outBack(prog(t, a, a + 0.4), 2.4);
    g.save(); g.translate(540, 600); g.scale(k, k); shadow(() => { rr(-150, -150, 300, 300, 66); g.fillStyle = WHITE; g.fill(); }, 50, 14);
    if (logo) { g.save(); rr(-140, -140, 280, 280, 60); g.clip(); g.drawImage(logo, -140, -140, 280, 280); g.restore(); } g.restore();
    g.globalAlpha = al * prog(t, a + 0.2, a + 0.5);
    outlined("แจ้งงานช่าง", 540, 880, 104, WHITE); outlined("ที่ อุบลเด้อ!", 540, 1000, 120, YEL);
    const c = ease.outBack(prog(t, a + 0.5, a + 0.85), 2), s = c * (1 + 0.035 * Math.sin((t - a) * 6));
    g.globalAlpha = al * clamp(c); g.translate(540, 1190); g.scale(s, s); shadow(() => { rr(-430, -70, 860, 140, 70); g.fillStyle = WHITE; g.fill(); });
    txt("ubonder.com/chang", 0, 4, F.d(64), INK);
    g.restore();
  }
  function flash(t) { for (const c of D.cuts) { const u = t - c; if (c > 0.2 && u >= 0 && u < 0.08) { g.fillStyle = `rgba(255,255,255,${0.35 * (1 - u / 0.08)})`; g.fillRect(0, 0, W, H); } } }
  function draw(t) {
    g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, W, H); g.globalAlpha = 1;
    flash(t); hook(t); brand(t); chips(t); real(t); tak(t); aiLabel(t); narr(t); endCard(t);
  }
  window.scene = { setup, preload, draw, events: () => ({ pen: [], pops: [], whoosh: [] }) };
})();
