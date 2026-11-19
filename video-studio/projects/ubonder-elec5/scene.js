// อุบลเด้อ — "5 สัญญาณไฟฟ้าในบ้าน ที่ห้ามมองข้าม": vertical ink whiteboard explainer (hand + marker draws
// every board, camera pans board to board). Brand: cream paper, dark-brown ink, brick orange + turmeric
// yellow accents, Kanit headings / Noto Sans Thai captions. Ends on the อุบลเด้อ card + ubonder.com.
(function () {
  const { clamp, lerp, prog, ease, rng } = window.L;
  const { P, Board, drawHand } = window.SK;
  const INK = "#2b1a12", OR = "#c2410c", YEL = "#fbbf24", CREAM = "#fff7ed", RED = "#dc2626", GREEN = "#15803d", BLUE = "#2563eb", MUTED = "#8a6f60";
  const F = { h: (s) => `700 ${s}px "Kanit"`, t: (s) => `600 ${s}px "Kanit"`, cap: (s) => `700 ${s}px "Noto Sans Thai"`, b: (s) => `500 ${s}px "Noto Sans Thai"` };
  const SP = 1400;                                   // board spacing (world x)
  let g, W, H, TL, C, D, b, paper, logo;
  const M = (cue, k) => (k === 0 ? C[cue].start : C[cue].marks[k - 1] ?? C[cue].end);

  function setup(canvas, tl) {
    g = canvas.getContext("2d"); W = tl.width; H = tl.height; TL = tl; C = tl.cues; D = tl.data || {};
    b = new Board(g, { speed: 2700, writeSpeed: 1600, color: INK, width: 7, style: D.style || "ink" });
    paper = document.createElement("canvas"); paper.width = paper.height = 512;
    const pg = paper.getContext("2d"); pg.fillStyle = CREAM; pg.fillRect(0, 0, 512, 512);
    const r = rng(7); for (let i = 0; i < 2600; i++) { pg.fillStyle = `rgba(80,40,10,${0.01 + r() * 0.02})`; pg.fillRect(r() * 512, r() * 512, 1 + r() * 1.5, 1 + r() * 1.5); }
    build(); b.settleCamera();
  }
  function preload() { return new Promise((r) => { logo = new Image(); logo.onload = r; logo.onerror = r; logo.src = (D.images || {}).logo; }); }

  // ------------------------------------------------------------ helpers
  function header(n, str, cue, col = OR) {
    b.go(M(cue, 0) + 0.05);
    b.stroke(P.circle(150, 250, 62), { color: col, w: 9 });
    b.write(String(n), { x: 150, y: 256, font: F.h(84), color: col, align: "center" });
    g.font = F.h(64); const w = Math.min(780, g.measureText(str).width);
    b.highlight(232, 262, w + 24, 36, { color: "rgba(251,191,36,0.55)", gapAfter: 0 });
    b.write(str, { x: 240, y: 250, font: F.h(str.length > 16 ? 56 : 64), color: INK });
  }
  function label(str, x, y, col = INK, size = 52, t0) { return b.write(str, { x, y, font: F.t(size), color: col, align: "center", t0 }); }
  function warnSign(x, y, s = 1) {
    b.stroke("M0,-90 L95,75 L-95,75 Z", { x, y, s, color: INK, w: 8, fill: YEL });
    b.stroke("M0,-35 V20 M0,42 V48", { x, y, s, color: INK, w: 12 });
  }
  function bolt(x, y, s = 1, col = YEL) { b.stroke("M20,-60 L-25,8 H8 L-14,62 L34,-12 H2 L22,-60 Z", { x, y, s, color: INK, w: 6, fill: col }); }
  function check(x, y, col = GREEN) { const ck = b.stroke("M-26,-2 L-6,22 L34,-30", { x, y, color: col, w: 11, dur: 0.22 }); b.pops.push(ck.t0 + ck.dur); }
  function cross(x, y, s = 1, col = RED) { const c = b.stroke("M-60,-60 L60,60 M60,-60 L-60,60", { x, y, s, color: col, w: 14, dur: 0.3 }); b.pops.push(c.t0 + c.dur); }

  // ------------------------------------------------------------ boards
  function build() {
    const keys = ["hook", "s1", "s2", "s3", "s4", "s5", "safe", "ubon", "cta"];
    keys.forEach((k, i) => b.scene(i === 0 ? 0 : C[k].start - 0.15, i * SP, 0));
    const at = (i) => { const s = b.scenes[i]; b.ox = s.x; b.oy = s.y; };

    // 0 — hook: house with a warning inside
    at(0); b.go(M("hook", 0) + 0.05);
    b.stroke("M-300,40 L0,-230 L300,40", { x: 540, y: 720, w: 10 });
    b.stroke("M-240,0 V330 H240 V0", { x: 540, y: 720, w: 10, fill: "#ffedd5" });
    b.stroke(P.rrect(-60, 170, 120, 160, 10), { x: 540, y: 720, w: 8 });
    warnSign(540, 820, 1.05);
    bolt(360, 470, 0.9); bolt(730, 450, 0.75);
    b.go(M("hook", 1));
    label("5 อาการ", 540, 1200, OR, 110);
    label("ห้ามมองข้าม!", 540, 1330, INK, 84);
    b.go(M("hook", 2));
    b.stroke(P.arrow(760, 1450, 900, 1350, -0.3), { color: RED, w: 9 });
    b.write("ข้อสุดท้าย…", { x: 700, y: 1500, font: F.t(56), color: RED, align: "center" });

    // 1 — flickering light
    at(1); header(1, "ไฟกระพริบ / หรี่ลงเอง", "s1");
    b.stroke("M0,-260 V-160", { x: 540, y: 700, w: 7 });
    b.stroke("M-50,-160 H50 V-110 H-50 Z", { x: 540, y: 700, w: 7, fill: "#d6c6b8" });
    b.stroke("M-50,-110 Q-130,-40 -110,60 Q-90,140 0,150 Q90,140 110,60 Q130,-40 50,-110", { x: 540, y: 700, w: 8 });
    const flickT = b.cursor;
    b.live((gg, t) => flicker(gg, t, 540, 770, flickT), { t0: flickT });
    b.stroke("M-170,-60 L-230,-80 M170,-60 L230,-80 M-150,80 L-220,110 M150,80 L220,110", { x: 540, y: 700, color: OR, w: 8 });
    b.go(M("s1", 1));
    label("จุดต่อหลวม?", 300, 1130, OR, 56); label("สายไฟเสื่อม?", 780, 1130, OR, 56);
    b.stroke("M-150,0 Q-100,-40 -50,0 T40,0 M70,10 L110,-25 L100,20 L150,-10", { x: 300, y: 1250, w: 7 });
    b.stroke("M-150,0 Q-80,30 -10,0 Q40,-20 70,10 M90,-20 L110,-50 M110,10 L140,30", { x: 780, y: 1250, w: 7 });

    // 2 — hot / scorched outlet
    at(2); header(2, "ปลั๊ก/สวิตช์ร้อน มีรอยไหม้", "s2");
    b.stroke(P.rrect(-190, -230, 380, 460, 40), { x: 540, y: 760, w: 9, fill: "#ffffff" });
    for (const yy of [-90, 90]) {
      b.stroke(P.rrect(-90, -55, 180, 110, 26), { x: 540, y: 760 + yy, w: 7 });
      b.stroke("M-28,-24 V10 M28,-24 V10 M0,28 V36", { x: 540, y: 760 + yy, w: 10 });
    }
    b.stroke("M-70,-150 Q-120,-100 -60,-40 Q-20,-80 30,-50 Q80,-110 20,-160 Q-20,-120 -70,-150 Z", { x: 520, y: 760, w: 4, fill: "#3b2a20", fillAlpha: 0.55 });
    const heatT = b.cursor;
    b.live((gg, t) => heat(gg, t, 540, 470, heatT), { t0: heatT });
    b.go(M("s2", 1));
    label("ต่อหลวม", 290, 1080, OR, 60); label("ใช้ไฟเกิน", 790, 1080, OR, 60);
    b.stroke(P.rrect(-140, -30, 280, 60, 14), { x: 790, y: 1290, w: 6 });
    b.stroke("M-100,-30 V-90 M-30,-30 V-100 M40,-30 V-85 M110,-30 V-95", { x: 790, y: 1290, w: 6 });
    b.stroke("M-100,-90 Q-130,-150 -80,-180 M-30,-100 Q-40,-160 0,-190 M40,-85 Q60,-150 100,-160", { x: 790, y: 1290, w: 5, color: MUTED });

    // 3 — breaker trips
    at(3); header(3, "เบรกเกอร์ตัดบ่อย", "s3");
    b.stroke(P.rrect(-260, -260, 520, 520, 24), { x: 540, y: 760, w: 9, fill: "#e7e0d8" });
    for (let i = 0; i < 4; i++) {
      const x = -180 + i * 120, down = i === 2;
      b.stroke(P.rrect(-40, -110, 80, 220, 10), { x: 540 + x, y: 760, w: 6, fill: "#ffffff", gapAfter: 0.02 });
      b.stroke(P.rrect(-24, down ? 10 : -80, 48, 70, 8), { x: 540 + x, y: 760, w: 6, fill: down ? RED : INK, gapAfter: 0.02 });
    }
    b.go(M("s3", 1));
    b.stroke(P.arrow(0, 120, 0, -60, 0, 24), { x: 600, y: 1150, color: INK, w: 9 });
    b.stroke("M-30,0 Q-40,-60 0,-70 Q40,-60 30,0 L30,70 H-30 Z", { x: 600, y: 1300, w: 6, fill: "#f2c7a5" });
    cross(600, 1220, 1.4);
    label("อย่าดันขึ้นซ้ำๆ", 540, 1460, RED, 64);
    b.go(M("s3", 2));
    label("ไฟเกิน?", 230, 1150, OR, 54); label("ไฟรั่ว?", 870, 1150, OR, 54);

    // 4 — burning smell / crackling
    at(4); header(4, "กลิ่นไหม้ / เสียงเปาะแปะ", "s4");
    b.stroke("M0,-120 Q-30,-20 -60,60 Q-50,110 0,100 Q20,120 40,100", { x: 330, y: 760, w: 9 });
    const smokeT = b.cursor;
    b.live((gg, t) => smoke(gg, t, 560, 760, smokeT), { t0: smokeT });
    b.stroke(P.star(800, 640, 60) + " " + P.star(880, 780, 40) + " " + P.star(760, 860, 34), { color: OR, w: 7 });
    b.write("เปาะ! แปะ!", { x: 820, y: 980, font: F.t(56), color: OR, align: "center" });
    b.go(M("s4", 1));
    label("ตัดไฟทันที!", 540, 1460, RED, 92);
    b.stroke(P.rrect(-130, -90, 260, 180, 20), { x: 540, y: 1250, w: 8, fill: "#ffffff" });
    b.stroke(P.rrect(-30, -50, 60, 100, 10), { x: 540, y: 1250, w: 7, fill: RED });
    b.stroke(P.arrow(200, -60, 200, 60, 0, 22), { x: 540, y: 1250, color: RED, w: 9 });

    // 5 — tingling touch
    at(5); header(5, "จับแล้วรู้สึกซ่า", "s5", RED);
    b.stroke(P.rrect(-150, -270, 300, 540, 26), { x: 380, y: 760, w: 9, fill: "#ffffff" });
    b.stroke("M-150,-90 H150 M100,-200 V-130 M100,-40 V60", { x: 380, y: 760, w: 8 });
    b.stroke("M0,0 Q40,-30 90,-10 L180,20 Q200,40 180,60 L80,50 Q40,70 0,40 Z", { x: 520, y: 700, w: 6, fill: "#f2c7a5" });
    bolt(560, 600, 0.8, YEL); bolt(640, 820, 0.6, YEL);
    b.go(M("s5", 1));
    label("ไฟรั่ว!", 830, 640, RED, 84);
    b.go(M("s5", 2));
    b.stroke("M0,-70 V0 M-60,0 H60 M-40,25 H40 M-20,50 H20", { x: 300, y: 1250, w: 9, color: GREEN });
    label("สายดิน", 300, 1390, GREEN, 56);
    b.stroke(P.rrect(-110, -80, 220, 160, 18), { x: 780, y: 1240, w: 8, fill: "#ecfdf5" });
    b.stroke(P.circle(-40, 0, 22) + " M30,-40 H70 M30,0 H70 M30,40 H70", { x: 780, y: 1240, w: 6, color: GREEN });
    label("เครื่องตัดไฟรั่ว", 780, 1390, GREEN, 56);

    // 6 — don't DIY
    at(6); b.go(M("safe", 0) + 0.05);
    b.stroke("M-90,160 L-110,-60 Q-110,-90 -85,-90 Q-60,-90 -60,-60 L-55,-160 Q-55,-190 -28,-190 Q0,-190 0,-160 L2,-180 Q2,-210 30,-210 Q58,-210 58,-180 L60,-150 Q62,-178 88,-178 Q114,-178 114,-150 L110,40 Q100,160 0,180 Q-60,185 -90,160 Z",
      { x: 540, y: 720, s: 1.5, w: 8, fill: "#fee2e2" });
    label("อย่าซ่อมเอง!", 540, 1140, RED, 100);
    b.go(M("safe", 1));
    b.stroke("M-70,40 L40,-70 Q70,-110 110,-90 L80,-60 L90,-40 L120,-50 Q130,-10 90,20 L-20,130 Z", { x: 170, y: 1340, w: 7, fill: "#e5e7eb" });
    b.write("ให้ช่างไฟฟ้าตรวจ", { x: 610, y: 1340, font: F.t(64), color: GREEN, align: "center" });

    // 7 — อุบลเด้อ
    at(7); b.go(M("ubon", 0) + 0.05);
    b.stroke(P.rrect(-210, -380, 420, 760, 50), { x: 540, y: 720, w: 9, fill: "#ffffff" });
    b.stroke("M-50,-345 H50", { x: 540, y: 720, w: 7 });
    const logoT = b.cursor;
    b.live((gg, t) => drawLogo(gg, t, 540, 610, logoT), { t0: logoT });
    b.write("อุบลเด้อ", { x: 540, y: 840, font: F.h(84), color: OR, align: "center" });
    b.write("แจ้งงานช่างฟรี", { x: 540, y: 940, font: F.t(52), color: INK, align: "center" });
    b.go(M("ubon", 1));
    check(170, 1210); b.write("ช่างผ่านการตรวจสอบตัวตน", { x: 230, y: 1212, font: F.t(54), color: INK });
    b.go(M("ubon", 2));
    check(170, 1340); b.write("แอดมินตรวจราคา ก่อนส่งให้เลือก", { x: 230, y: 1342, font: F.t(50), color: INK });

    // 8 — save + link
    at(8); b.go(M("cta", 0) + 0.05);
    b.stroke("M-110,-170 H110 V170 L0,90 L-110,170 Z", { x: 540, y: 640, w: 10, fill: YEL });
    label("เซฟคลิปนี้ไว้!", 540, 960, OR, 96);
    b.go(M("cta", 1));
    label("เผื่อวันหนึ่ง บ้านคุณต้องใช้", 540, 1090, INK, 56);
    b.stroke(P.rrect(-330, -70, 660, 140, 70), { x: 540, y: 1300, w: 8, fill: OR });
    b.write("ubonder.com", { x: 540, y: 1300, font: F.h(76), color: "#ffffff", align: "center" });
  }

  // ------------------------------------------------------------ living details
  function flicker(gg, t, x, y, t0) {
    const on = (Math.sin(t * 23) + Math.sin(t * 7.3) * 0.7) > -0.2 ? 1 : 0.15;
    const a = prog(t, t0, t0 + 0.3) * on;
    const gr = gg.createRadialGradient(x, y, 0, x, y, 230); gr.addColorStop(0, `rgba(251,191,36,${0.55 * a})`); gr.addColorStop(1, "rgba(251,191,36,0)");
    gg.fillStyle = gr; gg.beginPath(); gg.arc(x, y, 230, 0, 7); gg.fill();
  }
  function heat(gg, t, x, y, t0) {
    const a = prog(t, t0, t0 + 0.4); gg.save(); gg.globalAlpha = a; gg.strokeStyle = RED; gg.lineWidth = 6; gg.lineCap = "round";
    for (let i = -1; i <= 1; i++) { gg.beginPath(); for (let k = 0; k <= 20; k++) { const yy = y - k * 8, xx = x + i * 70 + Math.sin(k * 0.6 - t * 6 + i) * 14; k ? gg.lineTo(xx, yy) : gg.moveTo(xx, yy); } gg.stroke(); }
    gg.restore();
  }
  function smoke(gg, t, x, y, t0) {
    const a = prog(t, t0, t0 + 0.4); gg.save(); gg.strokeStyle = MUTED; gg.lineWidth = 7; gg.lineCap = "round";
    for (let i = 0; i < 3; i++) { const p = ((t - t0) * 0.5 + i / 3) % 1; gg.globalAlpha = a * (1 - p);
      gg.beginPath(); for (let k = 0; k <= 16; k++) { const yy = y + 60 - k * 14 - p * 120, xx = x - 120 + k * 4 + Math.sin(k * 0.7 - t * 3 + i * 2) * 26; k ? gg.lineTo(xx, yy) : gg.moveTo(xx, yy); } gg.stroke(); }
    gg.restore();
  }
  function drawLogo(gg, t, x, y, t0) {
    if (!logo) return; const k = ease.outBack(prog(t, t0, t0 + 0.45), 2); if (k <= 0) return;
    gg.save(); gg.translate(x, y); gg.scale(k, k); gg.beginPath(); gg.roundRect(-130, -130, 260, 260, 56); gg.clip(); gg.drawImage(logo, -130, -130, 260, 260); gg.restore();
  }

  // ------------------------------------------------------------ frame
  function captions(t) {
    let seg = null;
    for (const k of Object.keys(C)) {
      const c = C[k];
      c.parts.forEach((p, i) => { const s = i === 0 ? c.start - 0.05 : c.marks[i - 1], e = i < c.parts.length - 1 ? c.marks[i] : c.end + 0.3; if (t >= s && t < e) seg = { p, s, e }; });
    }
    if (!seg) return;
    let p = seg.p; (D.capfix || []).forEach(([a, bb]) => (p = p.split(a).join(bb)));
    const a = prog(t, seg.s, seg.s + 0.1) * (1 - prog(t, seg.e - 0.1, seg.e));
    let size = 50; g.font = F.cap(size); let w = g.measureText(p).width;
    if (w > 960) { size = Math.floor(size * 960 / w); g.font = F.cap(size); w = g.measureText(p).width; }
    g.save(); g.globalAlpha = a; g.fillStyle = "rgba(43,26,18,0.9)";
    g.beginPath(); g.roundRect(540 - w / 2 - 34, 1640 - size / 2 - 22, w + 68, size + 44, 18); g.fill();
    g.fillStyle = "#fff"; g.textAlign = "center"; g.textBaseline = "middle"; g.fillText(p, 540, 1642); g.restore();
  }
  function brandStrip() {   // small brand tag top-right on every board
    g.save(); g.globalAlpha = 0.9; g.fillStyle = OR; g.beginPath(); g.roundRect(W - 300, 70, 250, 64, 32); g.fill();
    g.font = F.t(34); g.fillStyle = "#fff"; g.textAlign = "center"; g.textBaseline = "middle"; g.fillText("อุบลเด้อ", W - 175, 104); g.restore();
  }
  function draw(t) {
    g.setTransform(1, 0, 0, 1, 0, 0); g.globalAlpha = 1;
    const cam = b.camera(t);
    g.save(); g.translate(-((cam.x % 512) + 512) % 512, -((cam.y % 512) + 512) % 512);
    g.fillStyle = g.createPattern(paper, "repeat"); g.fillRect(0, 0, W + 1024, H + 1024); g.restore();
    b.draw(t, "world", cam); b.draw(t, "screen", cam);
    const h = b.hand(t, cam); if (b.showHand) drawHand(g, h.pos[0], h.pos[1], h.down, t, INK);
    brandStrip(); captions(t);
    const vg = g.createRadialGradient(W / 2, H / 2, H * 0.5, W / 2, H / 2, H * 0.95);
    vg.addColorStop(0, "rgba(0,0,0,0)"); vg.addColorStop(1, "rgba(120,60,20,0.14)"); g.fillStyle = vg; g.fillRect(0, 0, W, H);
    const fin = 1 - prog(t, 0, 0.3); if (fin > 0) { g.fillStyle = `rgba(255,247,237,${fin})`; g.fillRect(0, 0, W, H); }
  }
  function events() { return { pen: b.penIntervals(), pops: b.pops, pans: b.scenes.slice(1).map((s) => s.t - 0.6) }; }
  window.scene = { setup, preload, draw, events };
})();
