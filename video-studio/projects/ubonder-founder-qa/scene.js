// Overlay for the อุบลเด้อ founder Q&A (render.mjs --overlay on out/base.mp4 from prep.py).
// Question cards for the AI host, Mack's name tag + captions, PiP frame over the technician photos, the logo
// reveal, sign-up chips, labels / rings / taps on the real web app tour, and the end card.
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
  function wrap(s, font, maxW) {
    g.font = font; const words = s.split(" "), lines = [""];
    for (const w of words) { const tt = (lines[lines.length - 1] + " " + w).trim(); if (g.measureText(tt).width > maxW && lines[lines.length - 1]) lines.push(w); else lines[lines.length - 1] = tt; }
    return lines;
  }
  function fit(s, size, maxW, maxLines = 2) {   // wrap on spaces; shrink the font until every line fits
    for (let z = size; z > size * 0.6; z -= 2) { const L = wrap(s, F.b(z), maxW); g.font = F.b(z); if (L.length <= maxLines && L.every((l) => g.measureText(l).width <= maxW)) return [L, z]; }
    const z = Math.round(size * 0.6); return [wrap(s, F.b(z), maxW).slice(0, maxLines), z];
  }
  function pill(s, cx, y, size, bg, fg, t0, t1, t) {
    const a = vis(t, t0, t1); if (a <= 0) return;
    const k = ease.outBack(prog(t, t0, t0 + 0.35), 2);
    g.font = F.b(size); const w = g.measureText(s).width + size * 1.3, h = size * 1.75;
    g.save(); g.globalAlpha = a; g.translate(cx, y); g.scale(k, k);
    shadow(() => { rr(-w / 2, -h / 2, w, h, h / 2); g.fillStyle = bg; g.fill(); });
    txt(s, 0, 3, F.b(size), fg); g.restore();
  }
  function hand(x, y, s) {
    g.save(); g.translate(x, y); g.scale(s, s); g.rotate(-0.35);
    shadow(() => { g.fillStyle = WHITE; g.strokeStyle = INK; g.lineWidth = 5; g.beginPath(); g.roundRect(-14, 0, 28, 80, 14); g.roundRect(-40, 52, 80, 78, 26); g.fill(); g.stroke(); g.beginPath(); g.roundRect(-14, 0, 28, 80, 14); g.fill(); }, 18, 6);
    g.restore();
  }

  // ---------------------------------------------------------------- question cards
  function questions(t) {
    D.q.forEach(([t0, t1, q, qi], n) => {
      const a = vis(t, t0, t1 + 0.05); if (a <= 0) return;
      const k = ease.outBack(prog(t, t0 + 0.05, t0 + 0.4), 1.8);
      if (n === 0) {   // series title on the very first card
        const ta = vis(t, t0, t1);
        g.save(); g.globalAlpha = ta; if (logo) { shadow(() => { rr(410, 300, 120, 120, 28); g.fillStyle = WHITE; g.fill(); }); g.drawImage(logo, 414, 304, 112, 112); }
        txt("คุยกับคนทำแอป", 560, 330, F.b(60), WHITE, "left"); txt("อุบลเด้อ", 560, 398, F.b(60), YEL, "left"); g.restore();
      }
      const [lines, qz] = fit(q, 70, 800, 2), h = 230 + lines.length * 92;
      g.save(); g.globalAlpha = a; g.translate(540, 900); g.scale(k, k);
      shadow(() => { rr(-450, -h / 2, 900, h, 44); g.fillStyle = CREAM; g.fill(); }, 50, 16);
      // speaker chip
      rr(-400, -h / 2 + 40, 250, 64, 32); g.fillStyle = ORANGE; g.fill();
      g.save(); g.translate(-365, -h / 2 + 72); g.fillStyle = WHITE; rr(-9, -18, 18, 26, 9); g.fill(); g.strokeStyle = WHITE; g.lineWidth = 4; g.beginPath(); g.arc(0, -2, 15, 0.15 * Math.PI, 0.85 * Math.PI); g.stroke(); g.beginPath(); g.moveTo(0, 13); g.lineTo(0, 20); g.stroke(); g.restore();
      txt("คำถาม", -255, -h / 2 + 74, F.b(38), WHITE);
      txt(`${n + 1}/${D.q.length}`, 400, -h / 2 + 72, F.d(38), "#c9a48d", "right");
      lines.forEach((l, i) => txt(l, 0, -h / 2 + 170 + i * 92, F.b(qz), INK));
      // waveform while the host talks
      const bars = 23, by = h / 2 - 50;
      for (let i = 0; i < bars; i++) {
        const live = t > t0 + 0.35 && t < t1 - 0.25 ? 1 : 0.15;
        const v = (0.35 + 0.65 * Math.abs(Math.sin(t * 11 + i * 1.7) * Math.sin(t * 4.3 + i * 0.6))) * live;
        rr(-264 + i * 24, by - 4 - 30 * v, 12, 8 + 60 * v, 6); g.fillStyle = i % 2 ? ORANGE : "#f7a072"; g.fill();
      }
      g.restore();
    });
  }

  // ---------------------------------------------------------------- answers
  function nameTag(t) {
    const s = D.segs.find((x) => x[0] === "a1")[1], e = D.segs.find((x) => x[0] === "a1" ? false : x[1] > s)[1];
    const a = vis(t, s + 0.3, e); if (a <= 0) return;
    const k = ease.outCubic(prog(t, s + 0.3, s + 0.7));
    g.save(); g.globalAlpha = a; g.translate((1 - k) * -600, 0);
    shadow(() => { rr(40, 1180, 470, 110, 20); g.fillStyle = ORANGE; g.fill(); });
    txt("แม็ก", 75, 1237, F.b(66), WHITE, "left");
    shadow(() => { rr(40, 1296, 520, 66, 16); g.fillStyle = INK; g.fill(); });
    txt("ผู้สร้างแอป อุบลเด้อ", 70, 1330, F.b(40), YEL, "left");
    g.restore();
  }
  function captions(t) {
    const all = D.caps.map((c) => [...c, 0]).concat(D.outro ? [[D.outro[0], D.outro[1] + 0.2, D.outro[2], 1]] : []);
    const c = all.find(([s, e]) => t >= s - 0.04 && t < e); if (!c) return;
    const [s, e, p, host] = c, a = prog(t, s - 0.04, s + 0.06) * (1 - prog(t, e - 0.08, e));
    const [lines, cz] = fit(p, 56, 900, 2), y0 = 1500 - (lines.length > 1 ? 37 : 0);
    g.font = F.b(cz); const bw = Math.max(...lines.map((l) => g.measureText(l).width)) + 70, bh = lines.length * 74 + 34;
    g.save(); g.globalAlpha = a; rr(540 - bw / 2, y0 - 54, bw, bh, 26); g.fillStyle = host ? "rgba(241,90,36,0.92)" : "rgba(20,12,8,0.74)"; g.fill();
    lines.forEach((l, i) => txt(l, 540, y0 + i * 74 + 2, F.b(cz), WHITE));
    g.restore();
  }
  function pip(t) {
    const [x, y, w, h] = D.pipRect;
    D.pip.forEach(([s, e]) => {
      const a = vis(t, s, e + 0.15); if (a <= 0) return;
      g.save(); g.globalAlpha = a; g.strokeStyle = WHITE; g.lineWidth = 8; rr(x - 4, y - 4, w + 8, h + 8, 18); g.stroke();
      rr(x + 14, y + h - 56, 92, 42, 21); g.fillStyle = ORANGE; g.fill(); txt("แม็ก", x + 60, y + h - 34, F.b(28), WHITE); g.restore();
    });
  }
  function logoPop(t) {
    const t0 = D.logo, e = D.segs.find((x) => x[1] > t0)[1]; if (t < t0 - 0.05 || t > e + 0.2 || !logo) return;
    const k = ease.outBack(prog(t, t0, t0 + 0.45), 2.2), a = 1 - prog(t, e - 0.05, e + 0.2), ring = prog(t, t0, t0 + 0.8);
    g.save(); g.globalAlpha = a;
    g.globalAlpha = a * (1 - ring); g.strokeStyle = YEL; g.lineWidth = 14; g.beginPath(); g.arc(540, 640, 160 + 200 * ring, 0, 7); g.stroke(); g.globalAlpha = a;
    g.translate(540, 640); g.scale(k, k);
    shadow(() => { rr(-150, -150, 300, 300, 66); g.fillStyle = WHITE; g.fill(); }, 50, 14);
    g.save(); rr(-140, -140, 280, 280, 60); g.clip(); g.drawImage(logo, -140, -140, 280, 280); g.restore();
    g.lineJoin = "round"; g.font = F.b(96); g.textAlign = "center"; g.lineWidth = 16; g.strokeStyle = INK; g.strokeText("อุบลเด้อ", 0, 250); g.fillStyle = WHITE; g.fillText("อุบลเด้อ", 0, 250);
    g.restore();
  }
  function chips(t) {
    D.chips.forEach(([s, e, label], i) => {
      const a = vis(t, s, e); if (a <= 0) return;
      const k = ease.outBack(prog(t, s, s + 0.35), 2), y = 1060 + i * 112;
      g.save(); g.globalAlpha = a; g.translate(60 + (1 - k) * -300, y);
      g.font = F.b(46); const w = g.measureText(label).width + 130;
      shadow(() => { rr(0, -44, w, 88, 44); g.fillStyle = i === 2 ? GREEN : WHITE; g.fill(); });
      g.fillStyle = i === 2 ? WHITE : GREEN; g.beginPath(); g.arc(46, 0, 26, 0, 7); g.fill();
      g.strokeStyle = i === 2 ? GREEN : WHITE; g.lineWidth = 7; g.lineCap = g.lineJoin = "round"; g.beginPath(); g.moveTo(34, 1); g.lineTo(43, 11); g.lineTo(59, -10); g.stroke();
      txt(label, 90, 3, F.b(46), i === 2 ? WHITE : INK, "left"); g.restore();
    });
  }

  // ---------------------------------------------------------------- web tour
  function tour(t) {
    const T = D.tour; if (t < T.start) return;
    const live = T.labels.filter(([s, e]) => t >= s && t < e + 0.2);
    T.labels.forEach(([s, e, label]) => { const slot = live.findIndex((l) => l[0] === s); pill(label, 540, 1360 - (live.length - 1 - Math.max(0, slot)) * 112, 46, label.startsWith("✓") ? GREEN : INK, WHITE, s, e, t); });
    T.rings.forEach(([s, e, x, y, w, h]) => {
      const a = vis(t, s, e); if (a <= 0) return; const p = (t - s) % 1 / 1;
      g.save(); g.globalAlpha = a; g.strokeStyle = YEL; g.lineWidth = 9; rr(x - 8, y - 8, w + 16, h + 16, 30); g.stroke();
      g.globalAlpha = a * (1 - p); g.lineWidth = 5; rr(x - 8 - 24 * p, y - 8 - 24 * p, w + 16 + 48 * p, h + 16 + 48 * p, 30 + 24 * p); g.stroke(); g.restore();
    });
    T.taps.forEach(([t0, x, y]) => {
      if (t < t0 - 0.45 || t > t0 + 0.7) return;
      if (t >= t0) { const u = prog(t, t0, t0 + 0.6);
        for (const d of [0, 0.15]) { const v = clamp(u - d); if (v <= 0) continue; g.save(); g.globalAlpha = 1 - v; g.strokeStyle = YEL; g.lineWidth = 10 * (1 - v) + 2; g.beginPath(); g.arc(x, y, 20 + 90 * ease.outCubic(v), 0, 7); g.stroke(); g.restore(); } }
      const ap = prog(t, t0 - 0.45, t0 - 0.2) * (1 - prog(t, t0 + 0.45, t0 + 0.7)), press = t < t0 ? 1 - 0.12 * prog(t, t0 - 0.1, t0) : 0.88 + 0.12 * prog(t, t0, t0 + 0.15);
      if (ap > 0) { g.save(); g.globalAlpha = ap; hand(x + 6, y + 10, press * 1.15); g.restore(); }
    });
  }
  function endCard(t) {
    const t0 = D.end; if (t < t0) return;
    const a = prog(t, t0, t0 + 0.25), gr = g.createLinearGradient(0, 0, 0, H);
    gr.addColorStop(0, ORANGE); gr.addColorStop(1, "#5c1d08");
    g.save(); g.globalAlpha = a; g.fillStyle = gr; g.fillRect(0, 0, W, H);
    const k = ease.outBack(prog(t, t0 + 0.1, t0 + 0.55), 2);
    g.save(); g.translate(540, 640); g.scale(k, k); shadow(() => { rr(-150, -150, 300, 300, 66); g.fillStyle = WHITE; g.fill(); }, 50, 14);
    if (logo) { g.save(); rr(-140, -140, 280, 280, 60); g.clip(); g.drawImage(logo, -140, -140, 280, 280); g.restore(); } g.restore();
    const b = prog(t, t0 + 0.35, t0 + 0.7);
    g.globalAlpha = a * b; txt("อุบลเด้อ", 540, 920, F.b(120), WHITE); txt("สั่งอาหาร หาช่าง ในอุบลฯ ครบในแอปเดียว", 540, 1030, F.b(46), CREAM);
    const c = ease.outBack(prog(t, t0 + 0.6, t0 + 0.95), 2), s = c * (1 + 0.035 * Math.sin((t - t0) * 6));
    g.globalAlpha = a * clamp(c); g.translate(540, 1210); g.scale(s, s);
    shadow(() => { rr(-390, -72, 780, 144, 72); g.fillStyle = YEL; g.fill(); });
    txt("ubonder.vercel.app", 0, 4, F.d(64), INK);
    g.setTransform(1, 0, 0, 1, 0, 0); g.globalAlpha = a * prog(t, t0 + 0.9, t0 + 1.2);
    txt("ฟรี · ไม่ต้องโหลดจาก Store", 540, 1350, F.m(40), CREAM);
    g.restore();
  }
  function flash(t) {
    for (const c of D.cuts.concat(D.photo_cuts)) { const u = t - c; if (c > 0.1 && u >= 0 && u < 0.12) { g.fillStyle = `rgba(255,255,255,${0.28 * (1 - u / 0.12)})`; g.fillRect(0, 0, W, H); } }
  }

  function draw(t) {
    g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, W, H); g.globalAlpha = 1;
    flash(t); pip(t); questions(t); nameTag(t); logoPop(t); chips(t); tour(t); captions(t); endCard(t);
  }
  window.scene = { setup, preload, draw, events: () => ({ pen: [], pops: [], whoosh: [] }) };
})();
