// พระยาอีสาน tool clip overlay: channel tag, big hook title, readable Thai captions, reading chips
// (°C/°F values shown on the device), and the อุบลเด้อ card (brand colours, logo, ubonder.com).
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
    const c = D.caps.find(([a, b]) => t >= a - 0.05 && t < b + 0.35); if (!c) return;
    const a = vis(t, c[0] - 0.05, c[1] + 0.35, 0.08, 0.1);
    if (c[3]) {   // hook title
      const k = ease.outBack(prog(t, c[0], c[0] + 0.35), 1.8); g.save(); g.globalAlpha = a; g.translate(540, 1300); g.scale(k, k);
      const lines = c[2].split("… "); g.textAlign = "center"; g.textBaseline = "middle"; g.lineJoin = "round";
      lines.forEach((l, i) => { g.font = TH(i ? 104 : 84); g.lineWidth = 16; g.strokeStyle = "rgba(0,0,0,0.85)"; const y = i * 130; g.strokeText(l + (i < lines.length - 1 ? "…" : ""), 0, y); g.fillStyle = i ? YEL : "#fff"; g.fillText(l + (i < lines.length - 1 ? "…" : ""), 0, y); });
      g.restore(); return;
    }
    let size = 60; const lines = wrap(c[2], TH(size), 940);
    g.font = TH(size); const mw = Math.max(...lines.map((l) => g.measureText(l).width)); if (mw > 940) size = Math.floor(size * 940 / mw);
    g.font = TH(size); const w = Math.max(...lines.map((l) => g.measureText(l).width)), lh = size * 1.45, h = lines.length * lh + 34, y = 1500 - h / 2;
    g.save(); g.globalAlpha = a; g.fillStyle = "rgba(15,10,8,0.8)"; rr(540 - w / 2 - 34, y, w + 68, h, 22); g.fill();
    g.fillStyle = "#fff"; g.textAlign = "center"; g.textBaseline = "middle"; lines.forEach((l, i) => g.fillText(l, 540, y + 17 + lh * (i + 0.5) + 2)); g.restore();
  }
  function chips(t) {
    for (const [t0, t1, s] of D.chips) {
      const a = vis(t, t0, t1, 0.15, 0.2); if (a <= 0) continue; const k = ease.outBack(prog(t, t0, t0 + 0.35), 2.2);
      g.save(); g.globalAlpha = a; g.translate(540, 330); g.scale(k, k); g.font = KA(72); const w = g.measureText(s).width + 90;
      g.fillStyle = OR; rr(-w / 2, -62, w, 124, 62); g.fill(); g.strokeStyle = YEL; g.lineWidth = 6; rr(-w / 2, -62, w, 124, 62); g.stroke();
      g.fillStyle = "#fff"; g.textAlign = "center"; g.textBaseline = "middle"; g.fillText(s, 0, 4); g.restore();
    }
  }
  function tag(t) {
    if (t > D.ubon[0]) return; g.save(); g.globalAlpha = 0.92; g.fillStyle = "rgba(15,10,8,0.65)"; rr(50, 120, 470, 66, 33); g.fill();
    g.fillStyle = "#fff"; g.font = TH(34); g.textAlign = "left"; g.textBaseline = "middle"; g.fillText("พระยาอีสาน · ช่างไฟฟ้าอุบล", 82, 154); g.restore();
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
    g.globalAlpha = a * l1; g.fillStyle = BROWN; g.font = TH(66); g.fillText("เจอปัญหาไฟฟ้าในอุบลฯ", 540, 860);
    g.globalAlpha = a * l2; g.fillStyle = OR; g.font = KA(140); g.fillText("อุบลเด้อ", 540, 1080);
    g.fillStyle = BROWN; g.font = TH(62); g.fillText("แจ้งงานช่างไฟฟ้าได้ฟรี ในอุบลฯ", 540, 1205);
    const kp = ease.outBack(prog(t, mid + 0.6, mid + 1.0), 1.8);
    if (kp > 0) { g.save(); g.translate(540, 1390); g.scale(kp, kp); g.fillStyle = OR; rr(-330, -72, 660, 144, 72); g.fill(); g.fillStyle = "#fff"; g.font = KA(76); g.fillText("ubonder.com", 0, 4); g.restore(); }
    g.restore();
  }
  function draw(t) {
    g.clearRect(0, 0, W, H);
    tag(t); chips(t);
    if (t < D.ubon[0]) caption(t);
    ubon(t);
    const fo = prog(t, D.ubon[1] - 0.5, D.ubon[1]); if (fo > 0) { g.fillStyle = `rgba(0,0,0,${fo})`; g.fillRect(0, 0, W, H); }
  }
  window.scene = { setup, preload, draw, events: () => ({ pen: [], pops: [], whoosh: [] }) };
})();
