// Vertical whiteboard 'mystery check' — hairless creature claim (US–Mexico border, Oct 2026)
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
  // stylised "hairless creature" silhouette (drawn, not from the footage)
  const CREATURE = "M-120,40 Q-150,-40 -80,-80 Q-20,-110 40,-90 Q80,-140 120,-110 Q150,-90 135,-60 Q120,-40 95,-45 Q90,0 70,30 L85,120 L65,122 L45,40 Q0,55 -40,45 L-30,120 L-50,122 L-70,40 Q-140,70 -230,40 Q-170,45 -120,40 Z";
  const CHICKEN = "M-40,10 Q-50,-40 0,-45 Q10,-75 35,-60 Q55,-50 45,-30 Q70,-20 60,10 Q50,45 0,45 Q-40,45 -40,10 Z M-10,45 L-15,75 M15,45 L20,75 M45,-55 L62,-50 L48,-42";
  function buildBoards() {
    const keys = ["hook", "what", "claims", "facts", "explain", "maussan", "verdict", "cta"];
    const offY = [0, 90, -70, 80, -60, 70, -40, 0];
    keys.forEach((k, i) => b.scene(i === 0 ? 0 : C[k].start - 0.15, i * 1300, offY[i]));
    const at = (i) => { const s = b.scenes[i]; b.ox = s.x; b.oy = s.y; };
    const PURPLE = "#8e5bd8", CAM = "#3a4252";

    // 0 — hook: creature + chicken + "alien?!"
    at(0); b.go(M("hook", 0));
    b.stroke(CREATURE, { x: 560, y: 560, s: 1.7, w: 7, fill: "#e9e3da" });
    b.stroke(P.circle(560 + 1.7 * 105, 560 - 1.7 * 85, 9), { w: 6, fill: INK, dur: 0.12 });
    b.stroke(CHICKEN, { x: 880, y: 820, s: 1.1, w: 6, fill: "#fff4d6" });
    b.go(M("hook", 1));
    b.write("เอเลี่ยน?!", { x: 540, y: 230, font: F.h(110), color: RED, align: "center" });
    b.stroke(P.star(250, 170, 34) + " " + P.star(840, 160, 28), { color: ORANGE, w: 6 });
    b.go(M("hook", 2));
    b.stroke(P.circle(540, 1080, 120, 1.05), { color: PURPLE, w: 9 });
    b.write("?", { x: 540, y: 1090, font: F.h(170), color: PURPLE, align: "center" });

    // 1 — where/who: border map, camera trap, name card
    at(1); b.go(M("what", 0));
    hlWrite("เกิดอะไรขึ้น?", 540, 160, F.h(70), INK);
    b.stroke(P.squiggle(80, 470, 920, 14, 4), { color: INK, w: 7, dur: 0.6 });
    b.write("สหรัฐฯ", { x: 300, y: 380, font: F.t(56), color: MUTED, align: "center" });
    b.write("เม็กซิโก", { x: 300, y: 580, font: F.t(56), color: MUTED, align: "center" });
    b.stroke("M0,-50 Q35,-50 35,-15 Q35,20 0,60 Q-35,20 -35,-15 Q-35,-50 0,-50 Z", { x: 700, y: 560, w: 6, color: RED, fill: "#ffe3e0" });
    b.write("หุบเขาฮัวเรซ (ชิวาวา)", { x: 700, y: 660, font: F.hand(40), color: RED, align: "center" });
    b.go(M("what", 1));
    b.stroke(P.rrect(-110, -90, 220, 180, 26) + " " + P.circle(0, 0, 48), { x: 300, y: 900, w: 7, fill: "#e7eaf0", color: CAM });
    b.write("กล้องดักถ่าย", { x: 300, y: 1035, font: F.t(44), color: INK, align: "center" });
    b.stroke(P.rrect(470, 820, 520, 200, 24), { w: 6, fill: "#ffffff" });
    b.write("ไฮเม เมาส์ซาน", { x: 730, y: 885, font: F.h(52), color: INK, align: "center" });
    b.write("นักวิจัย UFO ชาวเม็กซิกัน", { x: 730, y: 960, font: F.hand(38), color: MUTED, align: "center" });
    b.go(M("what", 2));
    b.write("อ้างว่าถ่ายได้ 14 ต.ค.", { x: 540, y: 1200, font: F.h(60), color: PURPLE, align: "center" });

    // 2 — claims
    at(2); b.go(M("claims", 0));
    hlWrite("คำกล่าวอ้าง", 540, 160, F.h(70), INK, "center", "rgba(142,91,216,0.35)");
    b.stroke(P.rrect(90, 300, 900, 190, 40) + " M300,490 L260,560 L380,490", { w: 7, fill: "#f3ecff", color: PURPLE });
    b.write("\"มันเดินสองขา\"", { x: 540, y: 395, font: F.h(66), color: PURPLE, align: "center" });
    b.go(M("claims", 1));
    b.stroke(P.rrect(90, 660, 900, 190, 40) + " M700,850 L760,920 L620,850", { w: 7, fill: "#f3ecff", color: PURPLE });
    b.write("\"ล่าไก่ กระต่าย และม้า\"", { x: 540, y: 755, font: F.h(60), color: PURPLE, align: "center" });
    b.stroke(CHICKEN, { x: 300, y: 1080, s: 1.0, w: 6, fill: "#fff4d6" });
    b.stroke(CHICKEN, { x: 520, y: 1100, s: 0.8, w: 6, fill: "#fff4d6" });
    b.write("ยังไม่มีการพิสูจน์", { x: 760, y: 1100, font: F.hand(46), color: RED, align: "center" });

    // 3 — facts check
    at(3); b.go(M("facts", 0));
    hlWrite("แต่พอดูให้ดี…", 540, 160, F.h(70), INK);
    const row = (y, s1, s2, k) => {
      b.go(M("facts", k));
      b.stroke(P.rrect(-34, -34, 68, 68, 10), { x: 130, y, w: 6 });
      b.write(s1, { x: 200, y: y - 12, font: F.t(52), color: INK });
      if (s2) b.write(s2, { x: 202, y: y + 50, font: F.hand(38), color: MUTED });
      b.stroke("M-22,-22 L22,22 M22,-22 L-22,22", { x: 130, y, w: 9, color: RED, dur: 0.2 });
    };
    row(420, "คลิปไม่เห็นยืนสองขา", "ตามรายงานของสื่อต่างประเทศ", 1);
    row(690, "ขนาดตัวรายงานไม่ตรงกัน", "ราว 60 ซม. ถึงเกือบ 2 เมตร", 2);
    row(960, "ทางการยังไม่ยืนยัน", "ยังไม่พบสัตว์อันตรายในพื้นที่", 3);

    // 4 — what could it be?
    at(4); b.go(M("explain", 0));
    hlWrite("แล้วมันคืออะไร?", 540, 160, F.h(70), INK);
    b.stroke("M-150,20 Q-100,-40 0,-30 Q60,-60 110,-40 Q140,-20 120,0 L60,10 Q20,40 -40,30 L-60,60 M-20,35 L0,65 M40,25 L55,60 M-150,20 Q-230,40 -290,10", { x: 560, y: 470, s: 1.2, w: 6, color: GREEN, fill: "#e4f4ea" });
    b.write("อิกัวน่าขาดเม็ดสี?", { x: 540, y: 640, font: F.t(54), color: GREEN, align: "center" });
    b.write("(ความเห็นชาวเน็ต)", { x: 540, y: 705, font: F.hand(36), color: MUTED, align: "center" });
    b.go(M("explain", 1));
    b.stroke("M-120,0 Q-110,-50 -40,-50 L60,-50 Q90,-90 120,-80 L150,-60 Q160,-30 130,-25 L110,-25 Q100,20 80,40 L85,110 M-90,30 L-100,110 M-40,40 L-35,110 M50,40 L45,110 M-120,0 Q-160,-30 -190,-60", { x: 560, y: 960, s: 1.2, w: 6, color: ORANGE, fill: "#fff1e0" });
    b.write("หมาที่เป็นโรคขี้เรื้อน", { x: 540, y: 1150, font: F.t(52), color: ORANGE, align: "center" });
    b.write("(คำตอบของกรณี \"ชูปาคาบรา\" ในอดีต)", { x: 540, y: 1215, font: F.hand(36), color: MUTED, align: "center" });

    // 5 — who is Maussan
    at(5); b.go(M("maussan", 0));
    hlWrite("ควรรู้ไว้", 540, 160, F.h(70), INK);
    b.stroke(P.rrect(-90, -170, 180, 340, 80) + " M-90,-60 H90 M-90,0 H90 M-90,60 H90 M-90,120 H90", { x: 300, y: 600, w: 6, fill: "#efe6d2" });
    b.write("2023", { x: 700, y: 470, font: F.h(110), color: RED, align: "center" });
    b.write("\"มัมมี่เอเลี่ยน\"", { x: 700, y: 600, font: F.t(56), color: INK, align: "center" });
    b.write("โชว์ต่อสภาเม็กซิโก", { x: 700, y: 680, font: F.hand(44), color: MUTED, align: "center" });
    b.go(M("maussan", 1));
    b.stroke(P.rrect(130, 900, 820, 160, 30), { w: 7, color: RED });
    b.write("นักวิทยาศาสตร์โต้แย้งหนัก", { x: 540, y: 982, font: F.h(56), color: RED, align: "center" });

    // 6 — verdict stamp
    at(6); b.go(M("verdict", 0));
    hlWrite("สรุป", 540, 200, F.h(84), INK);
    b.go(M("verdict", 1));
    b.stroke(P.rrect(-400, -120, 800, 240, 30), { x: 540, y: 600, w: 12, color: RED });
    b.write("ยังไม่มีหลักฐาน", { x: 540, y: 605, font: F.h(100), color: RED, align: "center", dur: 0.6 });
    b.go(M("verdict", 2));
    b.write("= คำกล่าวอ้าง รอพิสูจน์", { x: 540, y: 860, font: F.t(62), color: INK, align: "center" });

    // 7 — CTA
    at(7); b.go(M("cta", 0));
    b.stroke(P.rrect(90, 250, 900, 330, 50) + " M380,580 L330,690 L500,580", { w: 8, fill: "#fff" });
    b.write("คุณคิดว่ามันคือตัวอะไร?", { x: 540, y: 415, font: F.h(60), color: INK, align: "center" });
    b.go(M("cta", 1));
    b.write("อย่าเพิ่งแชร์ว่าเป็นเอเลี่ยน", { x: 540, y: 900, font: F.h(66), color: RED, align: "center" });
    b.write("แหล่ง: Mexico News Daily · Gazeta Express · Science Times · Sanook", { x: 980, y: 1400, font: F.hand(28), color: MUTED, align: "right" });
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
