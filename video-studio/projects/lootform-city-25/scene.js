// Overlay for lootform-city-25 (render.mjs --overlay on out/base.mp4 from prep.py).
// Big titles over the Gemini key art (hero / cobra / market) + "ภาพประกอบ" tag; gameplay parts carry their own headlines.
(function () {
  const { clamp, prog, ease } = window.L;
  const W = 1080, H = 1920, GOLD = "#ffcf4a", INK = "#1e130b", WHITE = "#fff";
  const F = { b: (s) => `700 ${s}px "IBM Plex Sans Thai"` };
  let g, D, img = {};
  function setup(c, tl) { g = c.getContext("2d"); D = tl.data; }
  function preload() {
    return Promise.all(Object.entries(D.images).map(([k, s]) => new Promise((r) => { const im = new Image(); im.onload = () => { img[k] = im; r(); }; im.onerror = r; im.src = s; })));
  }
  const vis = (t, a, b) => prog(t, a, a + 0.18) * (1 - prog(t, b - 0.15, b));
  function title(s, y, size, col, t, t0, t1) {
    const a = vis(t, t0, t1); if (a <= 0) return;
    const k = ease.outBack(prog(t, t0, t0 + 0.35), 2.2);
    g.save(); g.globalAlpha = a; g.translate(W / 2, y); g.scale(k, k);
    g.font = F.b(size); g.textAlign = "center"; g.textBaseline = "middle"; g.lineJoin = "round";
    g.shadowColor = "rgba(0,0,0,0.6)"; g.shadowBlur = 24; g.shadowOffsetY = 8;
    g.lineWidth = size * 0.2; g.strokeStyle = INK; g.strokeText(s, 0, 0); g.shadowColor = "transparent";
    g.fillStyle = col; g.fillText(s, 0, 0); g.restore();
  }
  function tag(t) {
    const r = D.ai.find(([a, b]) => t >= a && t < b); if (!r) return;
    g.save(); g.globalAlpha = vis(t, r[0], r[1]); g.fillStyle = "rgba(0,0,0,0.55)"; g.beginPath(); g.roundRect(40, 160, 210, 54, 27); g.fill();
    g.font = F.b(28); g.fillStyle = WHITE; g.textAlign = "center"; g.textBaseline = "middle"; g.fillText("ภาพประกอบ", 145, 188); g.restore();
  }
  function draw(t) {
    g.clearRect(0, 0, W, H);
    const S = D.starts, [h, c, m] = D.ai;
    // hook on the hero art
    if (img.logo && t < h[1]) { const a = vis(t, 0.1, h[1]), lw = 620, lh = lw * img.logo.height / img.logo.width;
      g.save(); g.globalAlpha = a; g.drawImage(img.logo, (W - lw) / 2, 330, lw, lh); g.restore(); }
    title("เกมไทยบ้านทุ่ง…", 1250, 104, WHITE, t, S.hook + 0.05, h[1]);
    title("แต่ระบบไม่บ้าน!", 1390, 112, GOLD, t, S.hook + 1.5, h[1]);
    // cobra
    title("พญางูจงอางเก้าศอก", 1300, 92, GOLD, t, c[0] + 0.1, c[1]);
    // market
    title("ราคาถูกหรือแพง", 1250, 100, WHITE, t, m[0] + 0.15, m[1]);
    title("ผู้เล่นกำหนดเอง!", 1390, 108, GOLD, t, S.market + 1.3, m[1]);
    tag(t);
  }
  window.scene = { setup, preload, draw, events: () => ({ pen: [], pops: [], whoosh: [] }) };
})();
