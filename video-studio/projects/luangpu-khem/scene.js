// Illustrated storytelling — the 'Luang Pu Khem' gag (original by Noo Khlong Toei), retold
(function () {
  const { clamp, lerp, prog, ease, rng } = window.L;
  const { P, Board, drawHand } = window.SK;
  const INK = "#1f2430", RED = "#e0483e", GREEN = "#2e9e5b", ORANGE = "#f08a24", MUTED = "#6b7080",
    CYAN = "#38c6f4", EVE = "#1d4fd6", COV = "#3aa9e8", YEL = "#ffd84d";
  const F = {
    h: (s = 72) => `700 ${s}px "Mali"`, t: (s = 50) => `600 ${s}px "Mali"`,
    hand: (s = 44) => `400 ${s}px "Sriracha"`, cap: (s = 42) => `600 ${s}px "IBM Plex Sans Thai"`,
  };
  const HOST = { x: 165, y: 1735, s: 0.72 };
  let g, W, H, TL, C, b, paper, hostDone = 0;
  const goals = [];
  const M = (cue, k) => (k === 0 ? C[cue].start : C[cue].marks[k - 1] ?? C[cue].end);

  function setup(canvas, tl) {
    g = canvas.getContext("2d"); W = tl.width; H = tl.height; TL = tl; C = tl.cues;
    b = new Board(g, { speed: 1800, writeSpeed: 950 });
    paper = document.createElement("canvas"); paper.width = paper.height = 512;
    const pg = paper.getContext("2d"); pg.fillStyle = "#f8f7f3"; pg.fillRect(0, 0, 512, 512);
    const r = rng(9);
    for (let i = 0; i < 2600; i++) { pg.fillStyle = `rgba(0,0,0,${0.012 + r() * 0.02})`; pg.fillRect(r() * 512, r() * 512, 1 + r() * 1.5, 1 + r() * 1.5); }
    buildHost();
    buildBoards();
    b.settleCamera(0.2, 0.5);
  }

  // ------------------------------------------------------------ host
  function buildHost() {
    b.space = "screen"; b.ox = HOST.x; b.oy = HOST.y; b.go(0.2);
    const o = { w: 5 / HOST.s, s: HOST.s, gapAfter: 0.02 };
    b.stroke("M-92,-222 Q-108,-218 -110,-190 L-118,-38 Q-118,-24 -104,-24 H104 Q118,-24 118,-38 L110,-190 Q108,-218 92,-222 Z", { ...o, fill: "#cfe0ff", dur: 0.35 });
    b.stroke("M-55,-112 H55 L66,-56 H-66 Z", { ...o, dur: 0.14 });
    b.stroke("M-82,-372 Q-110,-450 -38,-420 M82,-372 Q110,-450 38,-420", { ...o, fill: "#eef0f5", dur: 0.18 });
    b.stroke(P.circle(0, -330, 100, 1.04, -1.9), { ...o, fill: "#eef0f5", dur: 0.3 });
    b.stroke(P.rrect(-70, -376, 140, 94, 40), { ...o, fill: INK, dur: 0.2 });
    b.stroke("M-50,-24 V-4 M50,-24 V-4 M-92,0 H-14 M14,0 H92", { ...o, dur: 0.15 });
    hostDone = b.cursor;
    b.live(drawHostLive, { t0: hostDone });
    b.space = "world";
  }

  function drawHostLive(g, t) {
    const appear = prog(t, hostDone, hostDone + 0.25);
    const m = TL.mouth[clamp(Math.round(t * TL.fps), 0, TL.mouth.length - 1)] || 0;
    const pen = b.hand(t, b.camera(t)).pos;
    const lx = clamp((pen[0] - HOST.x) / 700, -1, 1) * 9, ly = clamp((pen[1] - (HOST.y - 240)) / 900, -1, 1) * 8;
    let blink = 1;
    for (let bt = 2.9; bt < TL.duration; bt += 3.5) { const x = (t - bt) / 0.14; if (x >= 0 && x <= 1) blink = 1 - Math.sin(Math.PI * x); }
    let gest = 0;
    for (const k of Object.keys(C)) { const s = C[k].start; gest = Math.max(gest, prog(t, s - 0.1, s + 0.25) * (1 - prog(t, s + 1.6, s + 2.1))); }
    let cheer = 0;
    for (const gt of goals) cheer = Math.max(cheer, prog(t, gt, gt + 0.2) * (1 - prog(t, gt + 1.3, gt + 1.7)));
    const cta = prog(t, M("cta", 0), M("cta", 0) + 0.3);
    g.save(); g.globalAlpha = appear; g.scale(HOST.s, HOST.s);
    g.translate(0, Math.sin(t * 2.4) * 3 - cheer * 18 * Math.abs(Math.sin(t * 9)));
    const arm = (side, a1, a2) => {
      const sx = side * 98, sy = -196;
      const ex = sx + side * Math.sin(a1) * 78, ey = sy + Math.cos(a1) * 78;
      const hx = ex + side * Math.sin(a1 + a2) * 72, hy = ey + Math.cos(a1 + a2) * 72;
      g.lineCap = "round"; g.lineJoin = "round";
      g.strokeStyle = INK; g.lineWidth = 30; g.beginPath(); g.moveTo(sx, sy); g.lineTo(ex, ey); g.lineTo(hx, hy); g.stroke();
      g.strokeStyle = "#cfe0ff"; g.lineWidth = 20; g.stroke();
      g.fillStyle = "#fff"; g.strokeStyle = INK; g.lineWidth = 4.5; g.beginPath(); g.arc(hx, hy, 20, 0, 7); g.fill(); g.stroke();
    };
    const up = Math.max(cheer, cta);
    arm(-1, lerp(0.32, 2.6, ease.outBack(cheer, 1.5)), lerp(-0.25, 0.2, cheer));
    arm(1, lerp(lerp(0.32, 2.2, ease.outBack(gest, 1.6)), 2.6, up), lerp(lerp(-0.25, 0.15, gest), 0.4 + 0.4 * Math.sin(t * 11) * cta, up));
    g.shadowColor = CYAN; g.shadowBlur = 10; g.fillStyle = CYAN; g.strokeStyle = CYAN;
    const happy = cheer > 0.2 || cta > 0.2;
    for (const s of [-1, 1]) {
      const ex = s * 28 + lx, ey = -338 + ly;
      if (happy) { g.lineWidth = 7; g.lineCap = "round"; g.beginPath(); g.arc(ex, ey + 8, 12, Math.PI * 1.15, Math.PI * 1.85); g.stroke(); }
      else { const eh = 32 * Math.max(blink, 0.14); g.beginPath(); g.roundRect(ex - 9, ey - eh / 2, 18, eh, 9); g.fill(); }
    }
    const mh = 4 + m * 20;
    g.beginPath(); g.roundRect(-16 + lx * 0.5, -302 + ly * 0.4 - mh / 2, 32, mh, 3); g.fill();
    g.restore();
  }

  // ------------------------------------------------------------ helpers
  const tw = (str, font) => { g.font = font; return g.measureText(str).width; };
  function hlWrite(str, x, y, font, color, align = "center", hl = "rgba(255,216,77,0.6)") {
    const w = tw(str, font), left = align === "center" ? x - w / 2 : x;
    const size = parseInt(font.match(/(\d+)px/)[1]);
    b.highlight(left - 10, y + size * 0.05, w + 20, size * 0.5, { color: hl, gapAfter: 0 });
    b.write(str, { x, y, font, color, align, t0: b.cursor - 0.3 });
  }
  function header(num, str, cue, k, col) {
    b.go(M(cue, k) + 0.02);
    b.stroke(P.circle(120, 260, 46), { color: col, w: 7 });
    b.write(String(num), { x: 120, y: 264, font: F.h(60), color: col, align: "center" });
    hlWrite(str, 190, 262, F.h(62), INK, "left");
  }
  function ball(x, y, r = 28) {
    b.stroke(P.circle(x, y, r), { w: 5, fill: "#fff" });
    const pent = []; for (let i = 0; i <= 5; i++) { const a = -Math.PI / 2 + (i / 5) * Math.PI * 2; pent.push([x + Math.cos(a) * r * 0.38, y + Math.sin(a) * r * 0.38]); }
    b.stroke(P.poly(pent, true), { w: 4, fill: INK, dur: 0.15 });
  }
  function bar(y, label, l, r, max, cue, k) {
    b.cursor = Math.max(b.cursor, M(cue, k) + 0.05);
    b.write(label, { x: 540, y, font: F.t(44), color: INK, align: "center" });
    const by = y + 70, full = 400;
    const lw = (l / max) * full, rw = (r / max) * full;
    b.write(String(l), { x: 120, y: by, font: F.h(56), color: EVE, align: "center" });
    b.write(String(r), { x: 960, y: by, font: F.h(56), color: COV, align: "center" });
    b.stroke(P.rrect(530 - lw, by - 22, lw, 44, 10), { w: 4, color: EVE, fill: EVE, fillAlpha: 0.85 });
    b.stroke(P.rrect(550, by - 22, rw, 44, 10), { w: 4, color: COV, fill: COV, fillAlpha: 0.85 });
  }

  // ------------------------------------------------------------ boards
  const SKIN = "#f2c7a5", ROBE = "#f08a24", ROBE_D = "#c96a12", FIRE = "#ff7a1a", FIRE_Y = "#ffd84d";
  // old monk character (original drawing): x,y = feet centre
  function monk(x, y, s = 1, opts = {}) {
    const o = { x, y, s, w: 6 / s };
    b.stroke("M-95,0 L-80,-230 Q-70,-275 -20,-285 L20,-285 Q70,-275 80,-230 L95,0 Z", { ...o, fill: ROBE, dur: 0.35 });
    b.stroke("M-80,-230 Q0,-160 85,-250", { ...o, color: ROBE_D, w: 5 / s, dur: 0.15 });
    b.stroke(P.circle(0, -350, 72, 1.04, -1.9), { ...o, fill: SKIN, dur: 0.3 });
    b.stroke("M-30,-360 Q-20,-368 -10,-360 M10,-360 Q20,-368 30,-360", { ...o, dur: 0.12 });
    b.stroke(opts.worried ? "M-22,-318 Q0,-330 22,-318" : "M-28,-325 Q0,-300 28,-325", { ...o, dur: 0.12 });
    b.stroke("M-40,-395 Q0,-415 40,-395", { ...o, color: "#9aa0ad", dur: 0.1 });       // eyebrows/wrinkle
    b.stroke("M-40,20 L-40,0 M40,20 L40,0 M-65,22 H-15 M15,22 H65", { ...o, dur: 0.12 });
  }
  function medal(x, y, s = 1) {
    b.stroke(P.circle(0, 0, 46), { x, y, s, w: 6, color: "#b8860b", fill: "#ffd84d" });
    b.write("เค็ม", { x, y: y + 4, font: F.h(30 * s), color: "#8a5a00", align: "center", dur: 0.25 });
  }
  function boxer(x, y, s = 1, ko = false) {
    const o = { x, y, s, w: 6 / s };
    if (!ko) {
      b.stroke("M-55,0 L-45,-150 Q-40,-190 0,-195 Q40,-190 45,-150 L55,0 Z", { ...o, fill: "#cfe0ff", dur: 0.25 });
      b.stroke("M-60,-60 H60 V0 H-60 Z", { ...o, fill: "#2f6fde", dur: 0.15 });
      b.stroke(P.circle(0, -240, 50), { ...o, fill: SKIN, dur: 0.2 });
      b.stroke("M-18,-248 V-242 M18,-248 V-242 M-15,-220 Q0,-212 15,-220", { ...o, dur: 0.1 });
      b.stroke(P.circle(-95, -160, 32) + " " + P.circle(110, -190, 32), { ...o, color: INK, fill: RED, dur: 0.25 });
      b.stroke("M-45,-150 L-80,-160 M45,-150 L85,-185", { ...o, w: 12 / s, dur: 0.12 });
    } else {
      b.stroke("M-190,-20 Q-100,-70 60,-60 L170,-55 L170,-5 L-190,0 Z", { ...o, fill: "#cfe0ff", dur: 0.3 });
      b.stroke(P.circle(-230, -35, 50), { ...o, fill: SKIN, dur: 0.2 });
      b.stroke("M-250,-45 L-235,-30 M-235,-45 L-250,-30 M-225,-45 L-210,-30 M-210,-45 L-225,-30", { ...o, dur: 0.15 });
    }
  }
  function flames(x0, x1, y, t0) {
    b.live((g, t) => {
      for (let x = x0; x <= x1; x += 46) {
        const h = 60 + 30 * Math.sin(t * 9 + x * 0.07) + 15 * Math.sin(t * 14 + x);
        const gr = g.createLinearGradient(0, y - h, 0, y);
        gr.addColorStop(0, FIRE_Y); gr.addColorStop(1, FIRE);
        g.fillStyle = gr; g.beginPath(); g.moveTo(x - 24, y); g.quadraticCurveTo(x - 20, y - h * 0.6, x + 4 * Math.sin(t * 7 + x), y - h);
        g.quadraticCurveTo(x + 22, y - h * 0.5, x + 24, y); g.closePath(); g.fill();
      }
    }, { t0 });
  }
  function buildBoards() {
    const keys = ["intro", "legend", "fire", "boxing", "mic", "exam", "credit", "cta"];
    const offY = [0, 80, -60, 70, -50, 60, -40, 0];
    keys.forEach((k, i) => b.scene(i === 0 ? 0 : C[k].start - 0.15, i * 1300, offY[i]));
    const at = (i) => { const s = b.scenes[i]; b.ox = s.x; b.oy = s.y; };

    // 0 — title: temple on the hill + flying duck
    at(0); b.go(M("intro", 0));
    b.write("ตำนาน", { x: 540, y: 150, font: F.t(54), color: MUTED, align: "center" });
    b.write("หลวงปู่เค็ม", { x: 540, y: 255, font: F.h(120), color: ROBE_D, align: "center" });
    b.write("มุกต้นตำรับ: หนู คลองเตย", { x: 540, y: 355, font: F.hand(42), color: INK, align: "center" });
    b.go(M("intro", 1));
    b.stroke("M60,1050 Q300,700 540,720 Q800,700 1020,1050 Z", { w: 7, color: GREEN, fill: "#cfeccf" });
    b.stroke("M400,720 L540,620 L680,720 Z M430,720 H650 V820 H430 Z M520,820 V760 H560 V820", { w: 6, color: "#8a3b12", fill: "#ffd0a8" });
    b.stroke(P.rrect(330, 900, 420, 90, 14), { w: 5, fill: "#fff7e0" });
    b.write("วัดเขาอีโต้ขว้างเป็ด", { x: 540, y: 947, font: F.t(46), color: "#8a3b12", align: "center" });
    b.stroke("M0,0 Q20,-30 50,-20 Q60,-45 80,-35 Q75,-15 60,-10 Q70,10 40,15 Q10,18 0,0 Z M80,-35 L100,-32", { x: 800, y: 560, s: 1.2, w: 5, fill: "#ffffff" });
    b.stroke(P.arrow(700, 640, 790, 560, -0.3, 18), { w: 5, color: MUTED });

    // 1 — legend: monk + glowing medal
    at(1); b.go(M("legend", 0));
    monk(540, 1250, 1.6);
    b.go(M("legend", 1));
    b.live((g, t) => {
      g.save(); g.translate(840, 760); g.rotate(t * 0.6);
      g.strokeStyle = "rgba(255,200,40,0.7)"; g.lineWidth = 6;
      for (let i = 0; i < 12; i++) { g.rotate(Math.PI / 6); g.beginPath(); g.moveTo(70, 0); g.lineTo(110, 0); g.stroke(); }
      g.restore();
    }, { t0: M("legend", 1) });
    medal(840, 760, 1.5);
    b.write("ศักดิ์สิทธิ์ (มั้ง)", { x: 540, y: 220, font: F.h(76), color: INK, align: "center" });

    // 2 — fire walk
    at(2); b.go(M("fire", 0));
    b.write("ลุยไฟ 15 เมตร!", { x: 540, y: 170, font: F.h(84), color: RED, align: "center" });
    b.stroke(P.rrect(60, 1150, 960, 60, 20), { w: 6, color: "#5a3a2a", fill: "#7a4a2a" });
    flames(90, 990, 1160, b.cursor);
    monk(330, 1150, 1.3);
    b.go(M("fire", 1));
    b.write("ก้าวแรก… ชิล", { x: 700, y: 560, font: F.t(60), color: GREEN, align: "center" });
    b.go(M("fire", 2));
    b.live((g, t) => {   // robe hem on fire + sweat
      const k = Math.min(1, (t - M("fire", 2)) * 2);
      for (let i = -3; i <= 3; i++) {
        const fx = 330 + i * 30, h = (40 + 20 * Math.sin(t * 12 + i)) * k;
        g.fillStyle = i % 2 ? FIRE : FIRE_Y;
        g.beginPath(); g.moveTo(fx - 16, 1150 - 70); g.quadraticCurveTo(fx, 1150 - 70 - h * 1.4, fx + 16, 1150 - 70); g.fill();
      }
      g.fillStyle = "#6ec6ff";
      for (let i = 0; i < 3; i++) { const yy = 1150 - 520 + ((t * 120 + i * 40) % 90); g.beginPath(); g.ellipse(250 + i * 70, yy, 9, 15, 0, 0, 7); g.fill(); }
    }, { t0: M("fire", 2) });
    b.write("สบงไหม้!!", { x: 760, y: 760, font: F.h(100), color: RED, align: "center" });

    // 3 — boxing with the chant
    at(3); b.go(M("boxing", 0));
    b.stroke("M80,700 H1000 M80,820 H1000 M80,940 H1000 M80,600 V1220 M1000,600 V1220", { w: 8, color: RED, dur: 0.6 });
    b.stroke("M60,1220 H1020", { w: 10, color: INK, dur: 0.3 });
    b.write("ท่องคาถาหลวงปู่", { x: 540, y: 200, font: F.h(76), color: ROBE_D, align: "center" });
    boxer(540, 1220, 1.4);
    b.go(M("boxing", 1));
    b.write("ยกแรก ต่อยขวา!", { x: 540, y: 420, font: F.t(64), color: "#2f6fde", align: "center" });
    b.go(M("boxing", 2));
    b.live((g, t) => {   // white-out over the standing boxer, then KO pose drawn after
      const k = Math.min(1, (t - M("boxing", 2)) * 4);
      g.fillStyle = `rgba(248,247,243,${k})`; g.fillRect(250, 740, 600, 475);
      g.globalAlpha = k; g.strokeStyle = RED; g.lineWidth = 8; g.lineCap = "round";   // redraw the ropes
      g.beginPath(); for (const ry of [820, 940]) { g.moveTo(250, ry); g.lineTo(850, ry); } g.stroke(); g.globalAlpha = 1;
    }, { t0: M("boxing", 2) });
    boxer(640, 1215, 1.2, true);
    b.live((g, t) => {
      for (let i = 0; i < 4; i++) {
        const a = t * 3 + i * Math.PI / 2;
        g.fillStyle = FIRE_Y; g.font = F.h(46); g.textAlign = "center"; g.fillText("★", 364 + Math.cos(a) * 70, 1150 + Math.sin(a) * 26);
      }
    }, { t0: M("boxing", 2) + 0.4 });
    b.write("ยกสอง น็อก!", { x: 540, y: 560, font: F.h(100), color: RED, align: "center" });

    // 4 — grabs the MC's mic
    at(4); b.go(M("mic", 0));
    boxer(360, 1250, 1.3);
    b.stroke("M0,0 L30,-10 L40,30 L10,40 Z M30,-10 Q60,-60 40,-90", { x: 520, y: 950, s: 1.4, w: 6, fill: "#3a4252" });
    b.stroke("M-40,0 L-35,-160 Q-30,-195 0,-200 Q30,-195 35,-160 L40,0 Z", { x: 820, y: 1250, s: 1.3, w: 6, fill: "#e7eaf0" });
    b.stroke(P.circle(0, -240, 45), { x: 820, y: 1250, s: 1.3, w: 6, fill: SKIN });
    b.write("เอ๊ะ ไมค์ผม!", { x: 840, y: 700, font: F.hand(48), color: MUTED, align: "center" });
    b.go(M("mic", 1));
    b.stroke(P.rrect(80, 260, 920, 260, 40) + " M330,520 L300,610 L430,520", { w: 7, fill: "#fff" });
    b.write("หลวงปู่ช่วยแล้วครับ", { x: 540, y: 345, font: F.h(62), color: INK, align: "center" });
    b.write("แค่ช่วยช้าไปหนึ่งยก!", { x: 540, y: 435, font: F.h(62), color: RED, align: "center" });

    // 5 — exam (original gag)
    at(5); b.go(M("exam", 0));
    b.write("ปาฏิหาริย์ใหม่ (แต่งเพิ่ม)", { x: 540, y: 160, font: F.hand(44), color: MUTED, align: "center" });
    b.stroke(P.rrect(200, 300, 680, 820, 20), { w: 7, fill: "#ffffff" });
    b.write("ข้อสอบ 100 ข้อ", { x: 540, y: 380, font: F.h(60), color: INK, align: "center" });
    medal(800, 330, 1.0);
    b.go(M("exam", 1));
    let ticks = ""; for (let i = 0; i < 5; i++) ticks += `M260,${490 + i * 110} L290,${520 + i * 110} L340,${460 + i * 110} M380,${495 + i * 110} H820 `;
    b.stroke(ticks, { w: 7, color: GREEN, dur: 0.9 });
    b.write("ชื่อ: ______", { x: 260, y: 1060, font: F.hand(44), color: MUTED });
    b.go(M("exam", 2));
    b.write("0", { x: 760, y: 1000, font: F.h(220), color: RED, align: "center", dur: 0.3 });
    b.write("ลืมเขียนชื่อ!", { x: 540, y: 1240, font: F.h(80), color: RED, align: "center" });

    // 6 — credit: egret (his trademark walk) + thanks
    at(6); b.go(M("credit", 0));
    b.stroke("M0,0 Q-30,-60 10,-120 Q40,-170 20,-230 Q15,-260 45,-265 L110,-255 L50,-245 Q60,-200 50,-150 Q100,-110 120,-40 Q60,-10 0,0 Z M30,0 L20,140 L-20,140 M70,-10 L90,140 L130,140", { x: 470, y: 900, s: 1.5, w: 6, fill: "#ffffff" });
    b.write("ล้อเลียนความเชื่อ แบบขำ ๆ", { x: 540, y: 220, font: F.h(66), color: INK, align: "center" });
    b.go(M("credit", 1));
    b.stroke(P.rrect(80, 1170, 920, 200, 30), { w: 6, fill: "#fff7e0", color: ROBE_D });
    b.write("ขอบคุณความฮาจาก หนู คลองเตย", { x: 540, y: 1240, font: F.h(52), color: ROBE_D, align: "center" });
    b.write("วันชาติ พึ่งฉ่ำ (2506–2548)", { x: 540, y: 1315, font: F.hand(40), color: MUTED, align: "center" });

    // 7 — CTA
    at(7); b.go(M("cta", 0));
    b.stroke(P.rrect(90, 250, 900, 330, 50) + " M380,580 L330,690 L500,580", { w: 8, fill: "#fff" });
    b.write("ได้ยินมุกหลวงปู่เค็ม", { x: 540, y: 365, font: F.h(60), color: INK, align: "center" });
    b.write("ครั้งแรกจากไหน?", { x: 540, y: 460, font: F.h(60), color: ROBE_D, align: "center" });
    b.go(M("cta", 1));
    b.write("คอมเมนต์เลย!", { x: 600, y: 1000, font: F.h(84), color: ORANGE, align: "center" });
    b.write("มุกต้นฉบับ: หนู คลองเตย · เรียบเรียงใหม่โดยช่อง", { x: 980, y: 1400, font: F.hand(28), color: MUTED, align: "right" });
  }

  // ------------------------------------------------------------ frame
  function captions(t) {
    let seg = null;
    for (const k of Object.keys(C)) {
      const c = C[k];
      c.parts.forEach((p, i) => {
        const s = i === 0 ? c.start - 0.05 : c.marks[i - 1];
        const e = i < c.parts.length - 1 ? c.marks[i] : c.end + 0.3;
        if (t >= s && t < e) seg = { p, s, e };
      });
    }
    if (!seg) return;
    const a = prog(t, seg.s, seg.s + 0.12) * (1 - prog(t, seg.e - 0.1, seg.e));
    // wrap into max 2 lines on spaces
    let size = 46; g.font = F.cap(size);
    const words = seg.p.split(" "); const lines = [""];
    for (const w of words) {
      const test = (lines[lines.length - 1] + " " + w).trim();
      if (g.measureText(test).width > 900 && lines[lines.length - 1]) lines.push(w); else lines[lines.length - 1] = test;
    }
    const lh = size * 1.35, bw = Math.max(...lines.map((l) => g.measureText(l).width)) + 60, bh = lines.length * lh + 30;
    const cy = 1835 - (lines.length - 1) * lh / 2;
    g.save(); g.globalAlpha = a;
    g.fillStyle = "rgba(31,36,48,0.9)"; g.beginPath(); g.roundRect(540 - bw / 2, cy - bh / 2, bw, bh, 16); g.fill();
    g.fillStyle = "#fff"; g.textAlign = "center"; g.textBaseline = "middle";
    lines.forEach((l, i) => g.fillText(l, 540, cy - (lines.length - 1) * lh / 2 + i * lh + 2));
    g.restore();
  }

  function goalFlash(t) {
    for (const gt of goals) {
      const x = t - gt;
      if (x < 0 || x > 1.2) continue;
      const a = Math.sin(Math.PI * clamp(x / 1.2));
      g.save(); g.globalAlpha = a; g.translate(760, 1480);
      g.rotate(-0.05); g.scale(0.8 + 0.2 * ease.outBack(clamp(x * 3), 2), 0.8 + 0.2 * ease.outBack(clamp(x * 3), 2));
      g.fillStyle = YEL; g.strokeStyle = INK; g.lineWidth = 5;
      g.beginPath(); g.roundRect(-190, -55, 380, 110, 20); g.fill(); g.stroke();
      g.font = F.h(72); g.fillStyle = INK; g.textAlign = "center"; g.textBaseline = "middle"; g.fillText("GOAL!", 0, 4);
      g.restore();
    }
  }

  function draw(t) {
    g.setTransform(1, 0, 0, 1, 0, 0); g.globalAlpha = 1;
    const cam = b.camera(t);
    g.save(); g.translate(-((cam.x % 512) + 512) % 512, -((cam.y % 512) + 512) % 512);
    g.fillStyle = g.createPattern(paper, "repeat"); g.fillRect(0, 0, W + 1024, H + 1024); g.restore();
    b.draw(t, "world", cam);
    b.draw(t, "screen", cam);
    goalFlash(t);
    const h = b.hand(t, cam);
    drawHand(g, h.pos[0], h.pos[1], h.down, t);
    captions(t);
    const vg = g.createRadialGradient(W / 2, H / 2, H * 0.4, W / 2, H / 2, H * 0.85);
    vg.addColorStop(0, "rgba(0,0,0,0)"); vg.addColorStop(1, "rgba(60,50,30,0.14)");
    g.fillStyle = vg; g.fillRect(0, 0, W, H);
    const fin = Math.max(prog(t, TL.duration - 0.8, TL.duration - 0.05), 1 - prog(t, 0, 0.3));
    if (fin > 0) { g.fillStyle = `rgba(248,247,243,${fin})`; g.fillRect(0, 0, W, H); }
  }

  function events() {
    return { pen: b.penIntervals(), pops: [], goals, pans: b.scenes.slice(1).map((s) => s.t - 0.6) };
  }
  window.scene = { setup, draw, events };
})();
