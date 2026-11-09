// Comic-style sample (8.6 s): 90+6' last corner -> Dorgu header -> 4-4.
// Characters are generic cartoon footballers identified by kit colour, number and caption — no club crests,
// sponsor or kit-maker logos, no likeness caricature. Kits: home colours (sample; real match kit to be verified).
(function () {
  const { clamp, lerp, prog, ease, rng } = window.L;
  const W = 1080, H = 1920, INK = "#111014";
  const F = { c: (s) => `700 ${s}px "Mali"`, d: (s) => `700 ${s}px "Chakra Petch"`, b: (s) => `700 ${s}px "IBM Plex Sans Thai"` };
  const KIT = {
    mu:  { shirt: "#d7261e", sleeve: "#d7261e", shorts: "#ffffff", socks: "#1a1a1a", skin: "#8a5a3c", hair: "#1c1410" },
    mu2: { shirt: "#d7261e", sleeve: "#d7261e", shorts: "#ffffff", socks: "#1a1a1a", skin: "#e7b48f", hair: "#5a3a22" },
    avl: { shirt: "#6b1235", sleeve: "#8fc3ea", shorts: "#ffffff", socks: "#8fc3ea", skin: "#d9a07a", hair: "#2a1d14" },
    gk:  { shirt: "#3fd16b", sleeve: "#3fd16b", shorts: "#1c6b3a", socks: "#3fd16b", skin: "#e8c09a", hair: "#121212", gloves: "#f4f4f4" },
  };
  let g, TL, C, dots;

  function setup(canvas, tl) {
    g = canvas.getContext("2d"); TL = tl; C = tl.cues;
    dots = document.createElement("canvas"); dots.width = dots.height = 16;
    const d = dots.getContext("2d"); d.fillStyle = "#000"; d.beginPath(); d.arc(8, 8, 3.2, 0, 7); d.fill();
  }
  const T = (k) => C[k].start;

  // ------------------------------------------------------------ drawing helpers
  function limb(pts, w, col) {
    g.lineCap = "round"; g.lineJoin = "round";
    g.strokeStyle = INK; g.lineWidth = w + 12; g.beginPath(); pts.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y))); g.stroke();
    g.strokeStyle = col; g.lineWidth = w; g.stroke();
  }
  function seg(x, y, a, len) { return [x + Math.sin(a) * len, y + Math.cos(a) * len]; }   // a = 0 points down
  function blob(path, fill, lw = 8) { g.beginPath(); path(); g.fillStyle = fill; g.fill(); g.lineWidth = lw; g.strokeStyle = INK; g.lineJoin = "round"; g.stroke(); }
  function halftone(alpha = 0.12) {
    g.save(); g.globalAlpha = alpha; g.globalCompositeOperation = "multiply"; g.fillStyle = g.createPattern(dots, "repeat"); g.fillRect(-W, -H, W * 3, H * 3); g.restore();
  }
  function speedLines(cx, cy, t, col = "rgba(255,255,255,0.75)", n = 46, r0 = 260) {
    const r = rng(Math.floor(t * 12));
    g.save(); g.strokeStyle = col;
    for (let k = 0; k < n; k++) {
      const a = (k / n) * Math.PI * 2 + r() * 0.1, rr = r0 + r() * 120;
      g.lineWidth = 3 + r() * 10; g.beginPath(); g.moveTo(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr); g.lineTo(cx + Math.cos(a) * 2000, cy + Math.sin(a) * 2000); g.stroke();
    }
    g.restore();
  }
  function sfx(s, x, y, size, k, rot = -0.12, fill = "#ffd400") {
    if (k <= 0) return;
    g.save(); g.translate(x, y); g.rotate(rot); g.scale(k, k);
    g.font = F.c(size); g.textAlign = "center"; g.textBaseline = "middle"; g.lineJoin = "round";
    g.lineWidth = size * 0.32; g.strokeStyle = INK; g.strokeText(s, 0, 0);
    g.lineWidth = size * 0.16; g.strokeStyle = "#ffffff"; g.strokeText(s, 0, 0);
    g.fillStyle = fill; g.fillText(s, 0, 0); g.restore();
  }
  function burst(x, y, r, k, fill = "#ffffff", spikes = 14) {
    if (k <= 0) return;
    g.save(); g.translate(x, y); g.scale(k, k);
    blob(() => { for (let i = 0; i <= spikes * 2; i++) { const a = (i / (spikes * 2)) * Math.PI * 2, rr = i % 2 ? r * 0.62 : r; g.lineTo(Math.cos(a) * rr, Math.sin(a) * rr); } g.closePath(); }, fill, 10);
    g.restore();
  }
  function capBox(s, x, y, size = 46, bg = "#ffe45c") {
    g.font = F.c(size); const w = g.measureText(s).width + 50, h = size * 1.6;
    g.save(); g.translate(x, y); g.rotate(-0.015);
    blob(() => g.rect(0, 0, w, h), bg, 7);
    g.fillStyle = INK; g.textAlign = "left"; g.textBaseline = "middle"; g.fillText(s, 25, h / 2 + 2);
    g.restore();
  }
  function ball(x, y, r, spin) {
    g.save(); g.translate(x, y); g.rotate(spin);
    blob(() => g.arc(0, 0, r, 0, 7), "#ffffff", 7);
    g.fillStyle = INK; g.beginPath();
    for (let j = 0; j < 5; j++) { const a = (j / 5) * Math.PI * 2; g.lineTo(Math.cos(a) * r * 0.36, Math.sin(a) * r * 0.36); } g.fill();
    for (let j = 0; j < 5; j++) { const a = (j / 5) * Math.PI * 2 + 0.6; g.beginPath(); g.arc(Math.cos(a) * r * 0.86, Math.sin(a) * r * 0.86, r * 0.2, 0, 7); g.fill(); }
    g.restore();
  }

  // ------------------------------------------------------------ cartoon footballer (hip at origin, s = scale)
  // pose: { lean, lArm:[sh,el], rArm:[sh,el], lLeg:[hip,knee], rLeg:[hip,knee], mouth, num }
  function player(x, y, s, kit, P) {
    g.save(); g.translate(x, y); g.scale(s, s); g.rotate(P.lean || 0);
    const sh = [[-44, -150], [44, -150]], hp = [[-24, 0], [24, 0]];
    const arm = (o, a) => { const e = seg(o[0], o[1], a[0], 62), h = seg(e[0], e[1], a[0] + a[1], 58); return [o, e, h]; };
    const leg = (o, a) => { const k = seg(o[0], o[1], a[0], 78), f = seg(k[0], k[1], a[0] + a[1], 78); return [o, k, f]; };
    const L = leg(hp[0], P.lLeg), R = leg(hp[1], P.rLeg), LA = arm(sh[0], P.lArm), RA = arm(sh[1], P.rArm);
    const drawLeg = (pts) => {
      limb([pts[0], pts[1]], 38, kit.skin); limb([pts[1], pts[2]], 34, kit.socks);
      const f = pts[2]; blob(() => g.ellipse(f[0] + 12, f[1] + 6, 26, 14, 0, 0, 7), INK, 2);
    };
    const drawArm = (pts) => {
      limb([pts[0], pts[1]], 34, kit.sleeve); limb([pts[1], pts[2]], 30, kit.skin);
      blob(() => g.arc(pts[2][0], pts[2][1], kit.gloves ? 24 : 17, 0, 7), kit.gloves || kit.skin, 6);
    };
    drawLeg(L); drawArm(LA);
    blob(() => { g.moveTo(-34, -6); g.lineTo(34, -6); g.lineTo(40, 44); g.lineTo(-40, 44); g.closePath(); }, kit.shorts, 8);   // shorts
    blob(() => { g.moveTo(-50, -162); g.quadraticCurveTo(0, -176, 50, -162); g.lineTo(42, 6); g.lineTo(-42, 6); g.closePath(); }, kit.shirt, 8);   // shirt
    g.fillStyle = "rgba(0,0,0,0.18)"; g.beginPath(); g.moveTo(10, -165); g.lineTo(46, -160); g.lineTo(40, 4); g.lineTo(18, 4); g.fill();   // cel shade
    if (P.num) { g.font = F.d(64); g.textAlign = "center"; g.textBaseline = "middle"; g.lineWidth = 8; g.strokeStyle = INK; g.strokeText(P.num, 0, -78); g.fillStyle = "#fff"; g.fillText(P.num, 0, -78); }
    drawLeg(R); drawArm(RA);
    // head
    g.save(); g.translate(0, -212); g.rotate(P.head || 0);
    limb([[0, 30], [0, 52]], 26, kit.skin);
    blob(() => g.arc(0, 0, 50, 0, 7), kit.skin, 8);
    blob(() => { g.moveTo(-50, -2); g.quadraticCurveTo(-48, -62, 6, -60); g.quadraticCurveTo(56, -58, 52, -6); g.quadraticCurveTo(20, -30, -50, -2); }, kit.hair, 7);
    g.fillStyle = INK;
    g.beginPath(); g.ellipse(-18 + (P.look || 0), 4, 6, 9, 0, 0, 7); g.ellipse(18 + (P.look || 0), 4, 6, 9, 0, 0, 7); g.fill();
    g.lineWidth = 6; g.beginPath(); g.moveTo(-30, -14); g.lineTo(-8, -8); g.moveTo(30, -14); g.lineTo(8, -8); g.stroke();   // determined brows
    if (P.mouth === "open") blob(() => g.ellipse(0, 26, 14, 16, 0, 0, 7), "#5a1414", 5);
    else { g.beginPath(); g.moveTo(-14, 26); g.lineTo(14, 26); g.stroke(); }
    g.restore();
    g.restore();
  }

  // ------------------------------------------------------------ panel 1: last corner
  function panel1(t) {
    const kick = T("dorgu") - 0.9;
    // night stadium
    let gr = g.createLinearGradient(0, 0, 0, 900); gr.addColorStop(0, "#0b1440"); gr.addColorStop(1, "#24307a");
    g.fillStyle = gr; g.fillRect(0, 0, W, 900);
    // stands + crowd dots
    blob(() => { g.moveTo(-20, 900); g.lineTo(-20, 420); g.quadraticCurveTo(540, 300, 1100, 420); g.lineTo(1100, 900); g.closePath(); }, "#3a2a5a", 8);
    const r = rng(4);
    for (let k = 0; k < 520; k++) {
      const x = r() * W, y = 440 + r() * 430, bob = Math.sin(t * 9 + k) * 3;
      g.fillStyle = ["#d7261e", "#ffffff", "#6b1235", "#8fc3ea", "#f2c14e"][k % 5]; g.beginPath(); g.arc(x, y + bob, 7, 0, 7); g.fill();
    }
    // floodlights
    for (const fx of [120, 960]) {
      g.save(); g.globalAlpha = 0.25; g.fillStyle = "#fffbd0"; g.beginPath(); g.moveTo(fx, 200); g.lineTo(fx - 300, 1300); g.lineTo(fx + 300, 1300); g.fill(); g.restore();
      blob(() => g.rect(fx - 60, 170, 120, 50), "#fffde8", 6);
    }
    // pitch
    gr = g.createLinearGradient(0, 880, 0, H); gr.addColorStop(0, "#2f9e44"); gr.addColorStop(1, "#1d7a33");
    g.fillStyle = gr; g.fillRect(0, 880, W, H - 880);
    g.strokeStyle = "rgba(255,255,255,0.9)"; g.lineWidth = 8;
    g.beginPath(); g.moveTo(0, 1560); g.lineTo(W, 1080); g.stroke();      // touchline
    g.beginPath(); g.arc(40, 1540, 70, -1.2, 0.3); g.stroke();           // corner arc
    // corner flag
    limb([[40, 1540], [40, 1330]], 8, "#f2f2f2");
    blob(() => { g.moveTo(44, 1332); g.lineTo(44 + 110 + Math.sin(t * 8) * 14, 1360); g.lineTo(44, 1400); g.closePath(); }, "#ffd400", 6);
    // taker (MU) — run-up then kick
    const run = ease.inOutCubic(prog(t, 0.2, kick));
    const sw = prog(t, kick - 0.15, kick + 0.2);
    const px = lerp(300, 150, run), py = lerp(1660, 1580, run);
    player(px, py, 1.1, KIT.mu2, {
      lean: -0.1, num: "", lArm: [0.9, -0.4], rArm: [-1.1, 0.5],
      lLeg: [lerp(0.2, 0.1, sw), 0.3], rLeg: [lerp(-0.6, 1.6, ease.outCubic(sw)), lerp(-0.9, -0.1, sw)], mouth: sw > 0 ? "open" : "", look: -6,
    });
    // ball
    if (t < kick) ball(85, 1585, 26, 0);
    else {
      const p = prog(t, kick, kick + 1.1), bx = lerp(85, 1180, p), by = 1585 - Math.sin(p * Math.PI) * 900 - p * 500;
      for (let k = 1; k <= 6; k++) { const q = Math.max(0, p - k * 0.03); g.fillStyle = `rgba(255,255,255,${0.5 - k * 0.07})`; g.beginPath(); g.arc(lerp(85, 1180, q), 1585 - Math.sin(q * Math.PI) * 900 - q * 500, 24 - k * 2, 0, 7); g.fill(); }
      ball(bx, by, 26, t * 14);
    }
    halftone(0.1);
    // captions
    capBox("ทดเจ็บนาทีที่ 6", 70, 90, 50);
    capBox("ลูกเตะมุมลูกสุดท้าย!", 70, 200, 50, "#ffffff");
    const ck = ease.outBack(prog(t, 0.3, 0.7), 2);
    if (ck > 0) {
      g.save(); g.translate(860, 150); g.rotate(0.06); g.scale(ck, ck);
      blob(() => g.roundRect(-140, -62, 280, 124, 22), "#e01f2d", 9);
      g.font = F.d(86); g.fillStyle = "#fff"; g.textAlign = "center"; g.textBaseline = "middle"; g.fillText("90+6'", 0, 6);
      g.restore();
    }
    const sb = ease.outCubic(prog(t, 0.6, 1.0));
    if (sb > 0) { g.save(); g.globalAlpha = sb; capBox("MUN 3-4 AVL", 640, 270, 40, "#111014"); g.fillStyle = "#fff"; g.restore(); g.save(); g.globalAlpha = sb; g.font = F.c(40); g.fillStyle = "#fff"; g.textBaseline = "middle"; g.fillText("MUN 3-4 AVL", 665, 270 + 34); g.restore(); }
  }

  // ------------------------------------------------------------ panel 2: the header
  function panel2(t) {
    const t0 = T("dorgu") - 0.1, th = T("header");
    g.fillStyle = "#3b2bd6"; g.fillRect(0, 0, W, H);
    speedLines(560, 760, t, "rgba(255,255,255,0.55)", 60, 150);
    const rise = ease.outCubic(prog(t, t0, th)), hit = t >= th;
    // GK flapping (behind)
    const fl = Math.sin(t * 22) * 0.35;
    player(860, lerp(1420, 1260, rise), 1.2, KIT.gk, { lean: -0.15, lArm: [-2.6 + fl, -0.3], rArm: [-2.9 - fl, 0.2], lLeg: [0.2, 0.6], rLeg: [-0.3, 0.9], mouth: "open", look: -10, head: -0.1 });
    // Villa defender
    player(260, lerp(1650, 1520, rise * 0.8), 1.3, KIT.avl, { lean: 0.15, lArm: [-2.2, -0.4], rArm: [-1.2, 0.6], lLeg: [0.4, 0.9], rLeg: [-0.2, 1.1], mouth: "open", look: 8 });
    // Dorgu leaping header (front)
    const jy = lerp(1720, 1180, rise) + (hit ? Math.sin(prog(t, th, th + 0.2) * Math.PI) * 18 : 0);
    player(520, jy, 1.75, KIT.mu, { lean: lerp(0, -0.25, rise), lArm: [-2.1, -0.5], rArm: [-1.0, 0.9], lLeg: [0.9, 1.4], rLeg: [0.3, 1.8], mouth: "open", look: -8, head: -0.25, num: "" });
    // ball: comes from the left, meets the head, then flies down-right
    const ln = lerp(0, -0.25, rise), hx = 520 + 212 * 1.75 * Math.sin(ln) - 30, hy = jy - 212 * 1.75 * Math.cos(ln) - 20;   // top-front of the head
    if (!hit) { const p = prog(t, th - 0.55, th); ball(lerp(-60, hx, p), lerp(520, hy, p), 34, t * 18); }
    else { const p = prog(t, th, th + 0.4); ball(lerp(hx, 1200, p), lerp(hy, hy + 380, p), 34, t * 24); }
    halftone(0.13);
    const k = ease.outBack(prog(t, th - 0.02, th + 0.22), 2.5) * (1 - prog(t, th + 0.4, th + 0.55) * 0.15);
    burst(hx, hy, 150, k * (hit ? 1 : 0), "#ffd400");
    sfx("โป๊ก!", hx + 60, hy - 190, 150, k * (hit ? 1 : 0), -0.18, "#ffffff");
    const dn = ease.outBack(prog(t, t0 + 0.15, t0 + 0.5), 1.8);
    if (dn > 0) { g.save(); g.globalAlpha = clamp(dn); capBox("แพทริก ดอร์กู", 60, 90, 60); g.restore(); }
  }

  // ------------------------------------------------------------ panel 3: goal + 4-4
  function panel3(t) {
    const tg = T("goal");
    g.fillStyle = "#ffcf1f"; g.fillRect(0, 0, W, H);
    speedLines(540, 820, t, "rgba(255,255,255,0.7)", 50, 200);
    // goal frame + bulging net
    const bul = Math.sin(prog(t, tg, tg + 0.5) * Math.PI) * 60 * (1 - prog(t, tg + 0.5, tg + 1.2));
    g.save(); g.translate(540, 720);
    g.strokeStyle = "rgba(255,255,255,0.9)"; g.lineWidth = 4;
    for (let i = -6; i <= 6; i++) { g.beginPath(); g.moveTo(i * 70, -260); g.quadraticCurveTo(i * 70 * 1.05, bul * (1 - Math.abs(i) / 7), i * 70, 260); g.stroke(); }
    for (let j = -4; j <= 4; j++) { g.beginPath(); g.moveTo(-430, j * 62); g.quadraticCurveTo(0, j * 62 + bul * (1 - Math.abs(j) / 5), 430, j * 62); g.stroke(); }
    limb([[-450, 280], [-450, -280], [450, -280], [450, 280]], 26, "#ffffff");
    ball(lerp(-200, 40, prog(t, tg - 0.3, tg)), lerp(-60, 20, prog(t, tg - 0.3, tg)) + bul * 0.5, 40, t * 10);
    g.restore();
    // celebrating Dorgu (knee slide in from the left)
    const sl = ease.outCubic(prog(t, tg + 0.5, tg + 1.3));
    if (sl > 0) player(lerp(-200, 540, sl), 1700, 1.45, KIT.mu, { lean: 0.05, lArm: [-2.5, 0.2], rArm: [2.5, -0.2], lLeg: [0.35, -1.9], rLeg: [-0.35, 1.9], mouth: "open", look: 0, head: 0 });
    halftone(0.12);
    const k = ease.outBack(prog(t, tg + 0.05, tg + 0.45), 2.2);
    burst(540, 1060, 300, k, "#e01f2d", 16);
    sfx("4-4!", 540, 1060, 210, k, -0.08, "#ffffff");
    sfx("ตุ้ม!!", 870, 380, 120, ease.outBack(prog(t, tg - 0.02, tg + 0.2), 2.5) * (1 - prog(t, tg + 1.0, tg + 1.3)), 0.15);
    // confetti
    const r = rng(7);
    for (let i = 0; i < 70; i++) {
      const st = tg + r() * 0.6, p = (t - st) / 3; if (p < 0) continue;
      g.save(); g.translate(r() * W + Math.sin(t * 3 + i) * 30, -40 + p * 2100); g.rotate(t * 6 + i);
      g.fillStyle = ["#d7261e", "#ffffff", "#111014", "#3b2bd6"][i % 4]; g.fillRect(-10, -6, 20, 12); g.restore();
    }
    const cp = ease.outCubic(prog(t, tg + 1.3, tg + 1.7));
    if (cp > 0) { g.save(); g.globalAlpha = cp; capBox("ดอร์กู 90+6' · โหม่งตีเสมอ!", 60, 90, 54); g.restore(); }
  }

  // ------------------------------------------------------------ panel frames & transitions
  function inPanel(fn, t, k, rot = 0) {
    g.save(); g.translate(W / 2, H / 2); g.rotate(rot); g.scale(k, k); g.translate(-W / 2, -H / 2);
    g.beginPath(); g.rect(30, 30, W - 60, H - 60); g.save(); g.clip(); fn(t); g.restore();
    g.lineWidth = 14; g.strokeStyle = INK; g.strokeRect(30, 30, W - 60, H - 60);
    g.restore();
  }
  function draw(t) {
    g.setTransform(1, 0, 0, 1, 0, 0); g.globalAlpha = 1;
    g.fillStyle = "#fafafa"; g.fillRect(0, 0, W, H);
    const c2 = T("dorgu") - 0.1, c3 = T("goal") - 0.05;
    if (t < c2) inPanel(panel1, t, 1);
    else if (t < c3) { const k = ease.outBack(prog(t, c2, c2 + 0.25), 1.6); inPanel(panel2, t, lerp(0.85, 1, k), lerp(0.05, 0.015, k)); }
    else {
      const k = ease.outBack(prog(t, c3, c3 + 0.25), 1.6);
      const sh = Math.max(0, 1 - (t - c3) / 0.5) * 22;
      g.translate(Math.sin(t * 80) * sh, Math.cos(t * 70) * sh);
      inPanel(panel3, t, lerp(0.85, 1, k), lerp(-0.05, 0, k));
    }
    g.setTransform(1, 0, 0, 1, 0, 0);
    // flash on the header and the goal
    for (const tt of [T("header"), T("goal")]) { const f = 1 - prog(t, tt, tt + 0.15); if (t >= tt && f > 0) { g.fillStyle = `rgba(255,255,255,${0.6 * f})`; g.fillRect(0, 0, W, H); } }
    // sample tag
    g.save(); g.globalAlpha = 0.85; g.font = F.b(26); g.fillStyle = INK; g.textAlign = "center"; g.fillText("ตัวอย่างแนวภาพ comic · สีชุดเหย้า (ยังไม่ยืนยันชุดที่ใส่จริง)", W / 2, H - 50); g.restore();
    const fin = Math.max(prog(t, TL.duration - 0.4, TL.duration), 1 - prog(t, 0, 0.25));
    if (fin > 0) { g.fillStyle = `rgba(0,0,0,${fin})`; g.fillRect(0, 0, W, H); }
  }
  window.scene = { setup, draw, events: () => ({}) };
})();
