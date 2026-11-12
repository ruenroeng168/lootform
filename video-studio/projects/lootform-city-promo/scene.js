// Overlay for the LOOTFORM CITY promo (render.mjs --overlay on out/base.mp4 from prep.py).
// Hook headline over the gameplay window, voice captions in a band over the bottom logo (small logo redrawn),
// callouts that follow prep.py's zoom (auto button, boss, no-tax line, player shops), the game-mode icons, and
// pulsing rings on the end card's play button and URL.
(function () {
  const { clamp, prog, ease } = window.L;
  const W = 1080, H = 1920;
  const INK = "#1e130b", GOLD = "#ffcf4a", CREAM = "#fff6e3", RED = "#d7362a", GREEN = "#2fa65a", WHITE = "#fff";
  const F = { b: (s) => `700 ${s}px "IBM Plex Sans Thai"`, m: (s) => `600 ${s}px "IBM Plex Sans Thai"`, d: (s) => `700 ${s}px "Chakra Petch"` };
  let g, TL, D, img = {};

  function setup(c, tl) { g = c.getContext("2d"); TL = tl; D = tl.data; }
  function preload() {
    return Promise.all(Object.entries(D.images).map(([k, s]) => new Promise((r) => { const im = new Image(); im.onload = () => { img[k] = im; r(); }; im.onerror = r; im.src = s; })));
  }
  const sm = (u) => { u = clamp(u); return u * u * (3 - 2 * u); };
  function view(t) {
    const P = D.zoomPts; let z = 1, cx = D.win[2] / 2, cy = D.win[3] / 2;
    for (let i = 0; i + 1 < P.length; i++) if (t >= P[i][0] && t < P[i + 1][0]) {
      const u = sm((t - P[i][0]) / Math.max(1e-3, P[i + 1][0] - P[i][0]));
      z = P[i][1] + (P[i + 1][1] - P[i][1]) * u; cx = P[i][2] + (P[i + 1][2] - P[i][2]) * u; cy = P[i][3] + (P[i + 1][3] - P[i][3]) * u; break;
    }
    const [X, Y, w, h] = D.win, vw = w / z, vh = h / z, x0 = clamp(cx - vw / 2, 0, w - vw), y0 = clamp(cy - vh / 2, 0, h - vh);
    return { z, map: (wx, wy) => [X + (wx - x0) * z, Y + (wy - y0) * z] };
  }
  function rr(x, y, w, h, r) { g.beginPath(); g.roundRect(x, y, w, h, r); }
  function txt(s, x, y, font, col, align = "center") { g.font = font; g.fillStyle = col; g.textAlign = align; g.textBaseline = "middle"; g.fillText(s, x, y); }
  function shadow(fn, blur = 26, oy = 8, col = "rgba(0,0,0,0.5)") { g.save(); g.shadowColor = col; g.shadowBlur = blur; g.shadowOffsetY = oy; fn(); g.restore(); }
  const vis = (t, a, b) => prog(t, a, a + 0.2) * (1 - prog(t, b - 0.18, b));
  function pill(s, cx, y, size, bg, fg, t0, t1, t) {
    const a = vis(t, t0, t1); if (a <= 0) return;
    const k = ease.outBack(prog(t, t0, t0 + 0.32), 2.2);
    g.font = F.b(size); const w = g.measureText(s).width + size * 1.3, h = size * 1.7;
    g.save(); g.globalAlpha = a; g.translate(cx, y); g.scale(k, k);
    shadow(() => { rr(-w / 2, -h / 2, w, h, h / 2); g.fillStyle = bg; g.fill(); }); g.strokeStyle = GOLD; g.lineWidth = 4; rr(-w / 2, -h / 2, w, h, h / 2); g.stroke();
    txt(s, 0, 3, F.b(size), fg); g.restore();
  }
  function ring(x, y, w, h, t, t0, t1, col = GOLD) {
    const a = vis(t, t0, t1); if (a <= 0) return; const p = ((t - t0) % 0.9) / 0.9;
    g.save(); g.globalAlpha = a; g.strokeStyle = col; g.lineWidth = 7; rr(x - 8, y - 8, w + 16, h + 16, 18); g.stroke();
    g.globalAlpha = a * (1 - p); g.lineWidth = 4; rr(x - 8 - 20 * p, y - 8 - 20 * p, w + 16 + 40 * p, h + 16 + 40 * p, 18 + 20 * p); g.stroke(); g.restore();
  }
  function outlined(s, x, y, size, fill, k = 1) {
    g.save(); g.translate(x, y); g.scale(k, k); g.font = F.b(size); g.textAlign = "center"; g.textBaseline = "middle"; g.lineJoin = "round";
    g.lineWidth = size * 0.2; g.strokeStyle = INK; g.strokeText(s, 0, 0); g.fillStyle = fill; g.fillText(s, 0, 0); g.restore();
  }

  function hook(t) {
    const [t0, t1] = D.hook; if (t > t1 + 0.2) return;
    const a = 1 - prog(t, t1 - 0.1, t1 + 0.2);
    g.save(); g.globalAlpha = a; g.fillStyle = "rgba(20,10,4,0.45)"; g.fillRect(D.win[0], D.win[1], D.win[2], D.win[3]);
    const k1 = ease.outBack(prog(t, t0, t0 + 0.35), 2.2), k2 = ease.outBack(prog(t, t0 + 1.25, t0 + 1.6), 2.6);
    if (k1 > 0) outlined("เกมไทยบ้านทุ่ง…", 540, 880, 104, CREAM, k1);
    if (k2 > 0) { const sh = (1 - prog(t, t0 + 1.25, t0 + 1.7)) * Math.sin(t * 80) * 8; outlined("แต่ระบบไม่บ้าน!", 540 + sh, 1030, 112, GOLD, k2); }
    g.restore();
  }
  function band(t) {   // captions band over the source's bottom logo while gameplay runs
    if (t >= D.end + 0.25) return;
    const a = 1 - prog(t, D.end - 0.05, D.end + 0.25);
    g.save(); g.globalAlpha = a;
    const gr = g.createLinearGradient(0, 1368, 0, 1730); gr.addColorStop(0, "#2a1708"); gr.addColorStop(1, "#140b04");
    g.fillStyle = gr; g.fillRect(0, 1368, W, 362);
    if (img.logo) { const w = 300, h = w * img.logo.height / img.logo.width; g.drawImage(img.logo, 540 - w / 2, 1615, w, h); }
    g.restore();
  }
  function captions(t) {
    const c = D.caps.find(([s, e, , k]) => k !== "hook" && t >= s - 0.04 && t < e + 0.1); if (!c) return;
    const [s, e, p] = c, a = prog(t, s - 0.04, s + 0.06) * (1 - prog(t, e, e + 0.1));
    let z = 66; g.font = F.b(z); while (g.measureText(p).width > 990 && z > 44) { z -= 2; g.font = F.b(z); }
    const y = t < D.end ? 1500 : 1500;
    g.save(); g.globalAlpha = a; g.lineJoin = "round"; g.textAlign = "center"; g.textBaseline = "middle";
    g.lineWidth = 12; g.strokeStyle = INK; g.strokeText(p, 540, y); g.fillStyle = WHITE; g.fillText(p, 540, y); g.restore();
  }
  function callouts(t) {
    const v = view(t);
    const [a0, a1, ax, ay] = D.auto; { const [x, y] = v.map(ax, ay); ring(x - 46, y - 40, 92, 80, t, a0, a1); pill("ออโต้ ON", Math.min(x - 40, 900), y - 110, 40, INK, GOLD, a0 + 0.1, a1, t); }
    pill("บอส Lv.20 · พญางูจงอางเก้าศอก", 540, D.win[1] + 90, 44, RED, WHITE, D.boss[0], D.boss[1], t);
    const [n0, n1, nx, ny, nw, nh] = D.notax; { const [x, y] = v.map(nx, ny), [x2, y2] = v.map(nx + nw, ny + nh); ring(x, y, x2 - x, y2 - y, t, n0, n1); pill("ขายได้ ไม่เสียภาษี", 540, D.win[1] + D.win[3] - 90, 46, GREEN, WHITE, n0 + 0.2, n1, t); }
    pill("ร้านของผู้เล่น ตั้งเรียงกลางเมือง", 540, D.win[1] + 80, 44, INK, GOLD, D.town[0], D.town[1], t);
  }
  function modes(t) {
    const end = D.modesEnd; if (t < D.modes[0][0] - 0.1 || t > end) return;
    const a = 1 - prog(t, end - 0.25, end);
    const n = D.modes.length, cw = 220, x0 = 540 - (n * cw) / 2 + cw / 2, y = D.win[1] + D.win[3] / 2;
    g.save(); g.globalAlpha = a * prog(t, D.modes[0][0] - 0.1, D.modes[0][0] + 0.15); g.fillStyle = "rgba(20,10,4,0.55)"; g.fillRect(D.win[0], D.win[1], D.win[2], D.win[3]); g.restore();
    D.modes.forEach(([t0, key, label], i) => {
      if (t < t0) return; const k = ease.outBack(prog(t, t0, t0 + 0.35), 2.4), im = img[key];
      g.save(); g.globalAlpha = a; g.translate(x0 + i * cw, y); g.scale(k, k);
      shadow(() => { rr(-95, -120, 190, 240, 30); g.fillStyle = CREAM; g.fill(); }); g.strokeStyle = GOLD; g.lineWidth = 6; rr(-95, -120, 190, 240, 30); g.stroke();
      if (im) g.drawImage(im, 0, 0, im.width, 62, -70, -100, 140, 108);
      txt(label, 0, 70, F.b(40), INK); g.restore();
    });
  }
  function endRings(t) { D.endRings.forEach(([t0, t1, x, y, w, h]) => ring(x, y, w, h, t, t0, t1)); }

  function draw(t) {
    g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, W, H); g.globalAlpha = 1;
    band(t); hook(t); callouts(t); modes(t); endRings(t); captions(t);
  }
  window.scene = { setup, preload, draw, events: () => ({ pen: [], pops: [], whoosh: [] }) };
})();
