// AI-creator intro overlay (render.mjs --overlay over out/base.mp4). Everything keyed to measured events
// in data.ev (output seconds). Clean, modern creator style: white/black type, electric-violet accent.
(function () {
  const { clamp, lerp, prog, ease } = window.L;
  const W = 1080, H = 1920, INK = "#0d0f14", VIO = "#7c5cff", LIME = "#c6ff3d", WHITE = "#ffffff", RED = "#ff3b47", GREEN = "#1fd17a";
  const F = { b: (s) => `700 ${s}px "IBM Plex Sans Thai"`, m: (s) => `600 ${s}px "IBM Plex Sans Thai"`, d: (s) => `700 ${s}px "Chakra Petch"` };
  let g, TL, D, E;

  function setup(canvas, tl) { g = canvas.getContext("2d"); TL = tl; D = tl.data; E = D.ev; }
  function rr(x, y, w, h, r) { g.beginPath(); g.roundRect(x, y, w, h, r); }
  function txt(s, x, y, font, col, align = "center") { g.font = font; g.fillStyle = col; g.textAlign = align; g.textBaseline = "middle"; g.fillText(s, x, y); }
  function out(s, x, y, font, col, lw = 12, stroke = INK, align = "center") {
    g.save(); g.font = font; g.textAlign = align; g.textBaseline = "middle"; g.lineJoin = "round";
    g.lineWidth = lw; g.strokeStyle = stroke; g.strokeText(s, x, y); g.fillStyle = col; g.fillText(s, x, y); g.restore();
  }
  function shadow(fn, blur = 30, oy = 10) { g.save(); g.shadowColor = "rgba(0,0,0,0.45)"; g.shadowBlur = blur; g.shadowOffsetY = oy; fn(); g.restore(); }
  function fit(s, font, size, maxW) { g.font = font(size); const w = g.measureText(s).width; return w > maxW ? Math.floor(size * maxW / w) : size; }
  const vis = (t, a, b) => prog(t, a, a + 0.2) * (1 - prog(t, b - 0.15, b));
  const pop = (t, a, k = 2.2) => ease.outBack(prog(t, a, a + 0.35), k);

  // ------------------------------------------------------------ beats
  function hook(t) {
    const a = vis(t, E.hook - 0.1, E.diligent);
    if (a <= 0) return;
    g.save(); g.globalAlpha = a;
    const k1 = pop(t, E.hook);
    g.save(); g.translate(540, 1190); g.scale(k1, k1); out("คนที่น่ากลัวที่สุด", 0, 0, F.b(96), WHITE, 16); g.restore();
    const k2 = pop(t, E.notAI);
    if (k2 > 0) {
      g.save(); g.translate(540, 1330); g.rotate(-0.03); g.scale(k2, k2);
      shadow(() => { rr(-330, -62, 660, 124, 24); g.fillStyle = VIO; g.fill(); });
      txt("≠ คนเก่ง AI", 0, 4, F.b(78), WHITE);
      g.restore();
    }
    g.restore();
  }
  function diligent(t) {
    const a = vis(t, E.diligent - 0.6, E.role1 - 1.6);
    if (a <= 0) return;
    g.save(); g.globalAlpha = a;
    const k1 = pop(t, E.diligent - 0.6), k2 = pop(t, E.diligent);
    g.save(); g.translate(540, 1180); g.scale(k1, k1); out("ใช้ AI เป็น", 0, 0, F.b(100), WHITE, 16); g.restore();
    if (k2 > 0) {
      g.save(); g.translate(540, 1320); g.scale(k2, k2); out("+ ขยัน", 0, 0, F.b(120), LIME, 18);
      const u = ease.outCubic(prog(t, E.diligent + 0.15, E.diligent + 0.5));
      g.fillStyle = LIME; g.fillRect(-190, 70, 380 * u, 14); g.restore();
    }
    g.restore();
  }
  function person(x, y, s) {   // minimal person icon
    g.save(); g.translate(x, y); g.scale(s, s); g.fillStyle = WHITE;
    g.beginPath(); g.arc(0, -36, 26, 0, 7); g.fill(); rr(-40, -2, 80, 70, 30); g.fill(); g.restore();
  }
  function roles(t) {
    const t1 = E.now + 0.05, a = vis(t, E.role1 - 0.1, t1);
    if (a <= 0) return;
    const R = [["เขียนบท", E.role1], ["ตัดต่อ", E.role2], ["ทำภาพ", E.role3]];
    g.save(); g.globalAlpha = a;
    R.forEach(([s, ts], i) => {
      const k = pop(t, ts); if (k <= 0) return;
      const x = 200 + i * 340;
      g.save(); g.translate(x, 1240); g.scale(k, k);
      shadow(() => { rr(-140, -130, 280, 260, 30); g.fillStyle = "rgba(13,15,20,0.85)"; g.fill(); });
      person(0, -20, 1.1); txt(s, 0, 85, F.b(44), WHITE);
      g.restore();
    });
    // "แต่ตอนนี้" — all three get crossed out, replaced by one badge
    const x = prog(t, E.now - 0.05, E.now + 0.25);
    if (x > 0) {
      g.strokeStyle = RED; g.lineWidth = 16; g.lineCap = "round";
      R.forEach((_, i) => { const cx = 200 + i * 340, p = clamp(x * 3 - i * 0.6); if (p <= 0) return; g.beginPath(); g.moveTo(cx - 110, 1140); g.lineTo(cx - 110 + 220 * p, 1140 + 200 * p); g.stroke(); });
    }
    g.restore();
  }
  function nowBadge(t) {
    const a = vis(t, E.now, E.works + 0.3);
    if (a <= 0) return;
    const k = pop(t, E.now + 0.15, 2.6);
    g.save(); g.globalAlpha = a; g.translate(540, 1250); g.scale(k, k);
    shadow(() => { rr(-300, -80, 600, 160, 80); g.fillStyle = VIO; g.fill(); });
    txt("1 คน + AI", 0, 6, F.b(88), WHITE);
    g.restore();
  }
  function works(t) {
    const B = D.brolls.works; if (!B) return;
    const a = vis(t, B[0], B[B.length - 1]);
    if (a <= 0) return;
    g.save(); g.globalAlpha = a;
    // frame around the speaker inset (696,150 344x612)
    g.strokeStyle = WHITE; g.lineWidth = 8; rr(692, 146, 352, 620, 18); g.stroke();
    // label + counter
    shadow(() => { rr(40, 150, 360, 80, 40); g.fillStyle = LIME; g.fill(); });
    txt("ทำด้วย AI จริง", 220, 192, F.b(44), INK);
    for (let k = 0; k < B.length - 1; k++) {
      const v = vis(t, B[k], B[k + 1]); if (v <= 0) continue;
      const s = D.works[k];
      g.save(); g.globalAlpha = a * v;
      const fs = fit(s, F.m, 38, 940); g.font = F.m(fs); const w = g.measureText(s).width + 50;
      shadow(() => { rr(40, 1320, w, 76, 38); g.fillStyle = "rgba(13,15,20,0.88)"; g.fill(); });
      txt(s, 65, 1360, F.m(fs), WHITE, "left");
      txt(`${k + 1}/${B.length - 1}`, 1040, 192, F.d(40), WHITE, "right");
      g.restore();
    }
    g.restore();
  }
  function honest(t) {
    pillTop(t, "AI ไม่ได้ทำได้ทุกอย่าง", E.honest + 0.4, E.fail - 0.75, WHITE, INK);
  }
  function fail(t) {
    const B = D.brolls.fail; if (!B) return;
    const a = vis(t, B[0], B[1]);
    if (a <= 0) return;
    g.save(); g.globalAlpha = a;
    g.strokeStyle = WHITE; g.lineWidth = 8; rr(692, 146, 352, 620, 18); g.stroke();
    const k = ease.outBack(prog(t, B[0] + 0.1, B[0] + 0.4), 2.2), sc = lerp(2.4, 1, ease.outCubic(clamp(prog(t, B[0] + 0.1, B[0] + 0.35))));
    g.save(); g.translate(330, 980); g.rotate(-0.16); g.scale(sc, sc); g.globalAlpha *= clamp(k * 2);
    g.fillStyle = "rgba(255,255,255,0.9)"; g.fillRect(-260, -95, 520, 190);
    g.strokeStyle = RED; g.lineWidth = 12; g.strokeRect(-260, -95, 520, 190); g.lineWidth = 5; g.strokeRect(-244, -79, 488, 158);
    txt("งานพัง ✗", 0, 6, F.b(100), RED);
    g.restore();
    shadow(() => { rr(40, 150, 420, 80, 40); g.fillStyle = RED; g.fill(); });
    txt("ภาพทดลองที่ไม่ผ่าน", 250, 192, F.b(40), WHITE);
    g.restore();
  }
  function pillTop(t, s, t0, t1, bg, fg) {
    const a = vis(t, t0, t1); if (a <= 0) return;
    const k = pop(t, t0, 2);
    g.save(); g.globalAlpha = a; g.translate(540, 1290); g.scale(k, k);
    g.font = F.b(62); const w = g.measureText(s).width + 80;
    shadow(() => { rr(-w / 2, -60, w, 120, 60); g.fillStyle = bg; g.fill(); });
    txt(s, 0, 5, F.b(62), fg); g.restore();
  }
  function realTest(t) {
    pillTop(t, "ลองของจริง ให้ดู", E.real + 0.2, E.work_ok - 1.2, LIME, INK);
    const a = vis(t, E.work_ok - 0.1, E.follow - 0.1);
    if (a <= 0) return;
    [["เวิร์ก", E.work_ok, GREEN, "✓", 300], ["ไม่เวิร์ก", E.work_no, RED, "✗", 780]].forEach(([s, ts, col, mk, x]) => {
      const k = pop(t, ts, 2.4); if (k <= 0) return;
      g.save(); g.globalAlpha = a; g.translate(x, 1260); g.scale(k, k);
      shadow(() => { rr(-200, -95, 400, 190, 36); g.fillStyle = col; g.fill(); });
      txt(mk, -110, 4, F.b(96), WHITE); txt(s, 40, 6, F.b(64), WHITE);
      g.restore();
    });
  }
  function follow(t) {
    const t0 = E.follow, a = prog(t, t0 - 0.05, t0 + 0.25);
    if (a <= 0) return;
    const k = pop(t, t0, 2) * (1 + 0.04 * Math.sin(t * 6));
    g.save(); g.globalAlpha = a; g.translate(540, 1340); g.scale(k, k);
    shadow(() => { rr(-330, -85, 660, 170, 85); g.fillStyle = RED; g.fill(); });
    g.fillStyle = WHITE; g.beginPath(); g.arc(-235, 0, 46, 0, 7); g.fill();
    g.fillStyle = RED; g.fillRect(-258, -7, 46, 14); g.fillRect(-242, -23, 14, 46);
    txt("กดติดตาม", 40, 6, F.b(76), WHITE);
    g.restore();
    const b = pop(t, E.together, 2);
    if (b > 0) { g.save(); g.globalAlpha = a; g.translate(540, 1160); g.scale(b, b); out("มาลองไปด้วยกัน", 0, 0, F.b(92), LIME, 16); g.restore(); }
  }
  function endCard(t) {
    const a = ease.outCubic(prog(t, E.end, E.end + 0.4));
    if (a <= 0) return;
    g.save(); g.globalAlpha = a * 0.55; g.fillStyle = INK; g.fillRect(0, 0, W, H); g.restore();
    g.save(); g.globalAlpha = a;
    out("ใช้ AI ทำงานจริง", 540, 760, F.b(96), WHITE, 16);
    out("ทุกตอน · ไม่อวย · ไม่เวอร์", 540, 880, F.b(58), LIME, 12);
    g.restore();
  }
  function captions(t) {
    const inB0 = Object.values(D.brolls).some((B) => t >= B[0] && t < B[B.length - 1]);
    if (inB0) { g.fillStyle = "rgba(13,15,20,0.92)"; g.fillRect(0, 1450, W, 260); }
    const cap = D.captions.find(([a, b]) => t >= a && t < b + 0.1);
    if (!cap || t >= E.end) return;
    const [a0, b0, s] = cap, a = prog(t, a0, a0 + 0.1) * (1 - prog(t, b0, b0 + 0.1));
    const fs = fit(s, F.b, 58, 960);
    const inB = Object.values(D.brolls).some((B) => t >= B[0] && t < B[B.length - 1]);
    if (inB) { g.fillStyle = "rgba(13,15,20,0.92)"; g.fillRect(0, 1450, W, 260); }
    g.save(); g.globalAlpha = a; out(s, 540, 1540, F.b(fs), WHITE, 13); g.restore();
  }
  function draw(t) {
    g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, W, H); g.globalAlpha = 1;
    // subtle bottom gradient for caption legibility
    const gr = g.createLinearGradient(0, 1380, 0, H); gr.addColorStop(0, "rgba(0,0,0,0)"); gr.addColorStop(1, "rgba(0,0,0,0.45)");
    g.fillStyle = gr; g.fillRect(0, 1380, W, H - 1380);
    // white flash on each zoom change (camera-cut feel)
    D.zooms.forEach(([s], i) => { if (!i) return; const f = 1 - prog(t, s, s + 0.08); if (t >= s && f > 0) { g.fillStyle = `rgba(255,255,255,${0.12 * f})`; g.fillRect(0, 0, W, H); } });
    hook(t); diligent(t); roles(t); nowBadge(t); works(t); honest(t); fail(t); realTest(t); follow(t); endCard(t); captions(t);
    const fin = prog(t, TL.duration - 0.35, TL.duration);
    if (fin > 0) { g.fillStyle = `rgba(0,0,0,${fin})`; g.fillRect(0, 0, W, H); }
  }
  window.scene = { setup, draw, events: () => ({}) };
})();
