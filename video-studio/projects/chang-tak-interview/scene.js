// Overlay for the ช่างแต็ก interview (both cuts): hook title, host question cards, name tag, captions, PiP frame
// over photos / the sign-up page, workflow step chips, "AI voice host" note, end card with the cut's URL.
(function () {
  const { clamp, prog, ease } = window.L;
  const W = 1080, H = 1920;
  const INK = "#22140c", ORANGE = "#f15a24", YEL = "#ffc928", WHITE = "#ffffff", GREEN = "#22a565", CREAM = "#fff7ed";
  const F = { b: (s) => `700 ${s}px "IBM Plex Sans Thai"`, m: (s) => `600 ${s}px "IBM Plex Sans Thai"`, d: (s) => `700 ${s}px "Chakra Petch"` };
  let g, TL, D, logo;
  function setup(c, tl) { g = c.getContext("2d"); TL = tl; D = tl.data; }
  function preload() { return new Promise((r) => { logo = new Image(); logo.onload = r; logo.onerror = r; logo.src = D.images.logo; }); }
  function rr(x, y, w, h, r) { g.beginPath(); g.roundRect(x, y, w, h, r); }
  function txt(s, x, y, font, col, align = "center") { g.font = font; g.fillStyle = col; g.textAlign = align; g.textBaseline = "middle"; g.fillText(s, x, y); }
  function shadow(fn, blur = 30, oy = 10, col = "rgba(0,0,0,0.45)") { g.save(); g.shadowColor = col; g.shadowBlur = blur; g.shadowOffsetY = oy; fn(); g.restore(); }
  const vis = (t, a, b) => prog(t, a, a + 0.22) * (1 - prog(t, b - 0.18, b));
  function fitSize(s, size, maxW) { g.font = F.b(size); while (g.measureText(s).width > maxW && size > 30) { size -= 2; g.font = F.b(size); } return size; }
  function outlined(s, x, y, size, fill, k = 1) {
    g.save(); g.translate(x, y); g.scale(k, k); g.font = F.b(size); g.textAlign = "center"; g.textBaseline = "middle"; g.lineJoin = "round";
    g.lineWidth = size * 0.2; g.strokeStyle = INK; g.strokeText(s, 0, 0); g.fillStyle = fill; g.fillText(s, 0, 0); g.restore();
  }
  const segStart = (k) => (D.segs.find((s) => s[0] === k) || [])[1];
  const segEnd = (k) => { const i = D.segs.findIndex((s) => s[0] === k); return i < 0 ? 0 : i + 1 < D.segs.length ? D.segs[i + 1][1] : D.end; };

  function title(t) {   // hook title over the first answer
    const e = D.segs[1][1]; if (t > e) return; const a = 1 - prog(t, e - 0.25, e);
    const k1 = ease.outBack(prog(t, 0.05, 0.4), 2), k2 = ease.outBack(prog(t, 0.45, 0.8), 2.2);
    g.save(); g.globalAlpha = a;
    const gr = g.createLinearGradient(0, 0, 0, 640); gr.addColorStop(0, "rgba(20,10,4,0.75)"); gr.addColorStop(1, "rgba(20,10,4,0)"); g.fillStyle = gr; g.fillRect(0, 0, W, 640);
    if (k1 > 0) outlined(D.title[0], 540, 250, fitSize(D.title[0], 84, 980), WHITE, k1);
    if (k2 > 0) outlined(D.title[1], 540, 365, fitSize(D.title[1], 84, 980), YEL, k2);
    g.restore();
  }
  function questions(t) {
    D.q.forEach(([t0, t1, q, qi, nq]) => {
      const a = vis(t, t0, t1 + 0.05); if (a <= 0) return;
      const k = ease.outBack(prog(t, t0 + 0.05, t0 + 0.4), 1.8);
      const z = fitSize(q, 70, 800), h = 300;
      g.save(); g.globalAlpha = a; g.translate(540, 900); g.scale(k, k);
      shadow(() => { rr(-450, -h / 2, 900, h, 44); g.fillStyle = CREAM; g.fill(); }, 50, 16);
      rr(-400, -h / 2 + 36, 250, 62, 31); g.fillStyle = ORANGE; g.fill(); txt("คำถาม", -275, -h / 2 + 68, F.b(38), WHITE);
      txt(`${qi + 1}/${nq}`, 400, -h / 2 + 68, F.d(38), "#c9a48d", "right");
      txt(q, 0, 10, F.b(z), INK);
      for (let i = 0; i < 23; i++) {
        const live = t > t0 + 0.3 && t < t1 - 0.25 ? 1 : 0.15, v = (0.35 + 0.65 * Math.abs(Math.sin(t * 11 + i * 1.7) * Math.sin(t * 4.3 + i * 0.6))) * live;
        rr(-264 + i * 24, h / 2 - 50 - 4 - 26 * v, 12, 8 + 52 * v, 6); g.fillStyle = i % 2 ? ORANGE : "#f7a072"; g.fill();
      }
      g.restore();
    });
  }
  function nameTag(t) {
    const s = segStart("intro"); if (s === undefined) return; const e = segEnd("intro"), a = vis(t, s + 0.2, e); if (a <= 0) return;
    const k = ease.outCubic(prog(t, s + 0.2, s + 0.6));
    g.save(); g.globalAlpha = a; g.translate((1 - k) * -600, 0);
    shadow(() => { rr(40, 1180, 380, 110, 20); g.fillStyle = ORANGE; g.fill(); }); txt("ช่างแต็ก", 75, 1237, F.b(66), WHITE, "left");
    shadow(() => { rr(40, 1296, 560, 66, 16); g.fillStyle = INK; g.fill(); }); txt("ช่างไฟฟ้า · อุบลราชธานี · อุบลเด้อ", 70, 1330, F.b(36), YEL, "left");
    g.restore();
  }
  function captions(t) {
    const all = D.caps.map((c) => [...c, 0]).concat([[D.outro[0], D.outro[1] + 0.2, D.outro[2], 1]]);
    const c = all.find(([s, e]) => t >= s - 0.04 && t < e); if (!c) return;
    const [s, e, p, host] = c, a = prog(t, s - 0.04, s + 0.06) * (1 - prog(t, e - 0.08, e));
    const z = fitSize(p, 58, 960); g.font = F.b(z); const bw = g.measureText(p).width + 70, y = host ? 1560 : 1500;
    g.save(); g.globalAlpha = a; rr(540 - bw / 2, y - 52, bw, 104, 28); g.fillStyle = host ? "rgba(241,90,36,0.92)" : "rgba(20,12,8,0.76)"; g.fill();
    txt(p, 540, y + 2, F.b(z), WHITE); g.restore();
  }
  function pip(t) {
    const [x, y, w, h] = D.pipRect;
    D.pip.forEach(([s, e]) => {
      const a = vis(t, s, e + 0.15); if (a <= 0) return;
      g.save(); g.globalAlpha = a; g.strokeStyle = WHITE; g.lineWidth = 8; rr(x - 4, y - 4, w + 8, h + 8, 18); g.stroke();
      rr(x + 12, y + h - 54, 112, 42, 21); g.fillStyle = ORANGE; g.fill(); txt("ช่างแต็ก", x + 68, y + h - 32, F.b(26), WHITE); g.restore();
    });
  }
  function steps(t) {
    const live = D.steps.filter(([s, e]) => t >= s && t < e + 0.15);
    live.forEach(([s, e, label], i) => {
      const a = vis(t, s, e + 0.15), k = ease.outBack(prog(t, s, s + 0.35), 2), y = 1080 + i * 100;
      g.save(); g.globalAlpha = a; g.translate(60 + (1 - k) * -300, y);
      g.font = F.b(42); const w = g.measureText(label).width + 140;
      shadow(() => { rr(0, -40, w, 80, 40); g.fillStyle = i === live.length - 1 ? ORANGE : WHITE; g.fill(); });
      g.fillStyle = i === live.length - 1 ? WHITE : ORANGE; g.beginPath(); g.arc(42, 0, 26, 0, 7); g.fill();
      txt(String(D.steps.indexOf(D.steps.find((x) => x[0] === s)) + 1), 42, 2, F.d(32), i === live.length - 1 ? ORANGE : WHITE);
      txt(label, 84, 3, F.b(42), i === live.length - 1 ? WHITE : INK, "left"); g.restore();
    });
  }
  function hostNote(t) {
    if (!D.q.some(([s, e]) => t >= s && t < e)) return;
    g.save(); g.globalAlpha = 0.8; rr(40, 1700, 300, 46, 23); g.fillStyle = "rgba(0,0,0,0.45)"; g.fill(); txt("เสียงพิธีกรโดย AI", 190, 1724, F.m(26), WHITE); g.restore();
  }
  function endCard(t) {
    const t0 = D.end; if (t < t0) return;
    const a = prog(t, t0, t0 + 0.25), gr = g.createLinearGradient(0, 0, 0, H); gr.addColorStop(0, ORANGE); gr.addColorStop(1, "#5c1d08");
    g.save(); g.globalAlpha = a; g.fillStyle = gr; g.fillRect(0, 0, W, H);
    const k = ease.outBack(prog(t, t0 + 0.1, t0 + 0.55), 2);
    g.save(); g.translate(540, 600); g.scale(k, k); shadow(() => { rr(-150, -150, 300, 300, 66); g.fillStyle = WHITE; g.fill(); }, 50, 14);
    if (logo) { g.save(); rr(-140, -140, 280, 280, 60); g.clip(); g.drawImage(logo, -140, -140, 280, 280); g.restore(); } g.restore();
    g.globalAlpha = a * prog(t, t0 + 0.35, t0 + 0.7); txt("อุบลเด้อ", 540, 880, F.b(120), WHITE);
    txt(D.cut === "A" ? "ช่างในอุบลฯ สมัครรับงานได้เลย" : "หาช่างในอุบลฯ แจ้งงานได้ฟรี", 540, 990, F.b(50), CREAM);
    const c = ease.outBack(prog(t, t0 + 0.6, t0 + 0.95), 2), s = c * (1 + 0.035 * Math.sin((t - t0) * 6));
    g.globalAlpha = a * clamp(c); g.translate(540, 1160); g.scale(s, s);
    shadow(() => { rr(-460, -72, 920, 144, 72); g.fillStyle = YEL; g.fill(); });
    txt(D.url, 0, 4, F.d(fitSize(D.url, 60, 860)), INK);
    g.restore();
  }
  function flash(t) {
    for (const c of D.cuts.concat(D.photo_cuts)) { const u = t - c; if (c > 0.1 && u >= 0 && u < 0.1) { g.fillStyle = `rgba(255,255,255,${0.18 * (1 - u / 0.1)})`; g.fillRect(0, 0, W, H); } }
  }
  function draw(t) {
    g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, W, H); g.globalAlpha = 1;
    flash(t); pip(t); title(t); questions(t); nameTag(t); steps(t); hostNote(t); captions(t); endCard(t);
  }
  window.scene = { setup, preload, draw, events: () => ({ pen: [], pops: [], whoosh: [] }) };
})();
