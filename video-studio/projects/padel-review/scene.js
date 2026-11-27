// Venue review overlay: hook title on the neon sign, host lower third, chapter tags, big readable Thai
// captions (IBM Plex Sans Thai, dark box), and the อุบลเด้อ card (brand colours, logo, ubonder.com).
(function () {
  const { prog, ease } = window.L;
  const W = 1080, H = 1920, OR = "#c2410c", YEL = "#fbbf24", CREAM = "#fff7ed", BROWN = "#2b1a12";
  const TH = (s, w = 700) => `${w} ${s}px "IBM Plex Sans Thai"`, KA = (s) => `700 ${s}px "Kanit"`;
  let g, D, logo;
  function setup(c, tl) { g = c.getContext("2d"); D = tl.data; }
  function preload() { return new Promise((r) => { logo = new Image(); logo.onload = r; logo.onerror = r; logo.src = D.images.ubonder; }); }
  const vis = (t, a, b, fi = 0.2, fo = 0.2) => prog(t, a, a + fi) * (1 - prog(t, b - fo, b));
  function rr(x, y, w, h, r) { g.beginPath(); g.roundRect(x, y, w, h, r); }
  function wrap(s, font, maxW) {   // split on spaces into <= 2 lines
    g.font = font; if (g.measureText(s).width <= maxW) return [s];
    const ws = s.split(" "); let best = [s], bd = 1e9;
    for (let i = 1; i < ws.length; i++) { const a = ws.slice(0, i).join(" "), b = ws.slice(i).join(" "); const d = Math.max(g.measureText(a).width, g.measureText(b).width); if (d < bd) { bd = d; best = [a, b]; } }
    return best;
  }
  function caption(t) {
    const c = D.caps.find(([a, b]) => t >= a && t < b + 0.05); if (!c) return;
    const a = vis(t, c[0], c[1] + 0.05, 0.08, 0.08); let size = 62; const lines = wrap(c[2], TH(size), 940);
    g.font = TH(size); const mw = Math.max(...lines.map((l) => g.measureText(l).width)); if (mw > 940) size = Math.floor(size * 940 / mw);
    g.font = TH(size); const w = Math.max(...lines.map((l) => g.measureText(l).width)), lh = size * 1.45, h = lines.length * lh + 34;
    const y = 1520 - h / 2;
    g.save(); g.globalAlpha = a; g.fillStyle = "rgba(15,10,8,0.78)"; rr(540 - w / 2 - 34, y, w + 68, h, 22); g.fill();
    g.fillStyle = "#fff"; g.textAlign = "center"; g.textBaseline = "middle";
    lines.forEach((l, i) => g.fillText(l, 540, y + 17 + lh * (i + 0.5) + 2)); g.restore();
  }
  function chapter(t) {
    for (const [t0, name] of D.chapters) {
      const a = vis(t, t0 + 0.1, t0 + 3.6, 0.3, 0.35); if (a <= 0) continue;
      const x = -520 * (1 - ease.outCubic(prog(t, t0 + 0.1, t0 + 0.5)));
      g.save(); g.globalAlpha = a; g.font = TH(50); const w = g.measureText(name).width + 70;
      g.fillStyle = OR; rr(60 + x, 210, w, 92, 18); g.fill(); g.fillStyle = YEL; g.fillRect(60 + x, 210, 12, 92);
      g.fillStyle = "#fff"; g.textAlign = "left"; g.textBaseline = "middle"; g.fillText(name, 60 + x + 40, 258); g.restore();
    }
  }
  function lower(t) {
    if (!D.lower) return; const [a0, a1] = D.lower; const a = vis(t, a0, a1, 0.3, 0.35); if (a <= 0) return;
    const x = 60 - 600 * (1 - ease.outCubic(prog(t, a0, a0 + 0.45)));
    g.save(); g.globalAlpha = a; g.fillStyle = "#fff"; rr(x, 1180, 560, 150, 16); g.fill(); g.fillStyle = OR; rr(x, 1180, 14, 150, 7); g.fill();
    g.fillStyle = BROWN; g.textAlign = "left"; g.textBaseline = "middle"; g.font = TH(58); g.fillText("พระยาอีสาน", x + 44, 1232);
    g.fillStyle = OR; g.font = TH(40, 600); g.fillText("ช่างไฟฟ้าอุบลฯ · พิธีกร", x + 44, 1293); g.restore();
  }
  function hook(t) {
    const [a0, a1, lines] = D.hook; const a = vis(t, 0.15, a1 + 0.1, 0.25, 0.2); if (a <= 0) return;
    g.save(); g.globalAlpha = a; g.textAlign = "center"; g.textBaseline = "middle"; g.lineJoin = "round";
    lines.forEach((l, i) => { const k = ease.outBack(prog(t, 0.15 + i * 0.35, 0.55 + i * 0.35), 1.8); if (k <= 0) return;
      g.save(); g.translate(540, 1340 + i * 120); g.scale(k, k); g.font = TH(i ? 70 : 64); g.lineWidth = 12; g.strokeStyle = "rgba(0,0,0,0.85)";
      g.strokeText(l, 0, 0); g.fillStyle = i ? YEL : "#fff"; g.fillText(l, 0, 0); g.restore(); });
    g.restore();
  }
  function ubon(t) {
    const [u0, u1] = D.ubon; if (t < u0) return; const [v0, v1] = D.uvo, mid = v0 + (v1 - v0) * 0.48;
    const a = prog(t, u0, u0 + 0.4);
    g.save(); g.globalAlpha = a * 0.55; g.fillStyle = CREAM; g.fillRect(0, 0, W, H); g.restore();
    g.save(); g.globalAlpha = a;
    const k = ease.outBack(prog(t, u0 + 0.1, u0 + 0.6), 1.6);
    if (logo && k > 0) { g.save(); g.translate(540, 560); g.scale(k, k); g.beginPath(); g.roundRect(-150, -150, 300, 300, 64); g.clip(); g.drawImage(logo, -150, -150, 300, 300); g.restore(); }
    g.textAlign = "center"; g.textBaseline = "middle";
    const l1 = vis(t, v0, u1 + 1, 0.25, 0.1), l2 = vis(t, mid, u1 + 1, 0.25, 0.1);
    g.globalAlpha = a * l1; g.fillStyle = BROWN; g.font = TH(66); g.fillText("ไฟสนามดีๆ แบบนี้", 540, 820); g.fillText("ต้องใช้ช่างไฟฟ้าที่เข้าใจงาน", 540, 910);
    g.globalAlpha = a * l2; g.fillStyle = OR; g.font = KA(140); g.fillText("อุบลเด้อ", 540, 1080);
    g.fillStyle = BROWN; g.font = TH(62); g.fillText("แจ้งงานช่างไฟฟ้าได้ฟรี ในอุบลฯ", 540, 1205);
    const kp = ease.outBack(prog(t, mid + 0.6, mid + 1.0), 1.8);
    if (kp > 0) { g.save(); g.translate(540, 1390); g.scale(kp, kp); g.fillStyle = OR; rr(-330, -72, 660, 144, 72); g.fill(); g.fillStyle = "#fff"; g.font = KA(76); g.fillText("ubonder.com", 0, 4); g.restore(); }
    g.restore();
  }
  function draw(t) {
    g.clearRect(0, 0, W, H);
    hook(t); lower(t); chapter(t);
    if (t < D.ubon[0]) caption(t);
    ubon(t);
    const fo = prog(t, D.ubon[1] - 0.5, D.ubon[1]); if (fo > 0) { g.fillStyle = `rgba(0,0,0,${fo})`; g.fillRect(0, 0, W, H); }
  }
  window.scene = { setup, preload, draw, events: () => ({ pen: [], pops: [], whoosh: [] }) };
})();
