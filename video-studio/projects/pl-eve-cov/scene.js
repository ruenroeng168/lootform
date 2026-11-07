// Vertical whiteboard match recap — Everton 3-1 Coventry (PL, 6 Nov 2026)
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
  function buildBoards() {
    const keys = ["hook", "goals1", "a1", "a2", "a3", "table", "cta"];
    const offY = [0, 100, -80, 80, -60, 60, 0];
    keys.forEach((k, i) => b.scene(i === 0 ? 0 : C[k].start - 0.15, i * 1300, offY[i]));
    const at = (i) => { const s = b.scenes[i]; b.ox = s.x; b.oy = s.y; };

    // 0 — scoreboard
    at(0); b.go(M("hook", 0));
    b.write("พรีเมียร์ลีกเมื่อคืน", { x: 540, y: 190, font: F.t(58), color: MUTED, align: "center" });
    b.stroke(P.squiggle(300, 250, 480, 6, 5), { color: RED, w: 5 });
    b.go(M("hook", 1));
    b.stroke(P.rrect(70, 340, 940, 520, 40), { w: 8, fill: "#ffffff" });
    b.stroke("M540,380 V820", { w: 4, color: "#c9ccd6" });
    b.write("EVERTON", { x: 305, y: 430, font: F.h(66), color: EVE, align: "center" });
    b.write("COVENTRY", { x: 775, y: 430, font: F.h(66), color: COV, align: "center" });
    b.write("0", { x: 305, y: 640, font: F.h(190), color: "#9aa0ad", align: "center", t0: M("hook", 1) + 0.9 });
    b.write("1", { x: 775, y: 640, font: F.h(190), color: "#9aa0ad", align: "center" });
    b.write("โดนนำก่อน!", { x: 540, y: 940, font: F.hand(56), color: RED, align: "center" });
    b.go(M("hook", 2));
    b.stroke("M215,560 L395,730 M685,560 L865,730", { color: RED, w: 9 });
    b.go(M("hook", 3) - 0.75);
    const wipeT = b.cursor;
    b.live((g, t) => {  // board eraser wipes the old score
      const p = ease.inOutCubic(prog(t, wipeT, wipeT + 0.35));
      g.fillStyle = "#ffffff";
      g.fillRect(190, 520, 240 * p, 250); g.fillRect(660, 520, 240 * p, 250);
    }, { t0: wipeT });
    b.go(wipeT + 0.4);
    b.write("3", { x: 305, y: 650, font: F.h(220), color: EVE, align: "center", dur: 0.3 });
    b.write("1", { x: 775, y: 650, font: F.h(220), color: COV, align: "center", dur: 0.25 });
    b.stroke(P.star(150, 330, 40) + " " + P.star(950, 880, 34) + " " + P.star(960, 320, 26), { color: ORANGE, w: 6 });
    b.write("จบเกม · ศ. 6 พ.ย. 2569", { x: 540, y: 1080, font: F.t(46), color: INK, align: "center" });
    b.write("ฮิลล์ ดิกคินสัน สเตเดียม", { x: 540, y: 1150, font: F.hand(44), color: MUTED, align: "center" });

    // 1 — goal timeline (goals1 + goals2)
    at(1); b.go(M("goals1", 0));
    hlWrite("ไทม์ไลน์ประตู", 540, 170, F.h(70), INK);
    const X = 210, ys = { ht: 330, g1: 530, g2: 760, g3: 990, g4: 1220 };
    b.stroke(`M${X},270 V1300`, { w: 6, color: "#9aa0ad", dur: 0.5 });
    const node = (y, min, who, note, col, score, t0) => {
      b.go(t0);
      b.stroke(P.circle(X, y, 34), { color: col, w: 7, fill: col === INK ? "#fff" : col, fillAlpha: col === INK ? 1 : 0.25 });
      b.write(min, { x: X, y: y + 3, font: F.h(min.length > 3 ? 30 : 36), color: col === INK ? INK : col, align: "center" });
      b.write(who, { x: X + 75, y: y - 22, font: F.t(48), color: col === INK ? INK : col });
      if (note) b.write(note, { x: X + 78, y: y + 42, font: F.hand(36), color: MUTED });
      if (score) {
        b.stroke(P.rrect(840, y - 46, 170, 84, 16), { w: 5, fill: "#fff" });
        b.write(score, { x: 925, y: y - 2, font: F.h(50), color: INK, align: "center" });
      }
    };
    node(ys.ht, "HT", "ครึ่งแรก", "ยังไม่มีประตู", INK, "0-0", M("goals1", 0) + 0.3);
    node(ys.g1, "52'", "กโบโฮ", "โคเวนทรีออกนำ", COV, "0-1", M("goals1", 1) + 0.3); goals.push(M("goals1", 1) + 1.2);
    node(ys.g2, "56'", "บาร์รี (โหม่ง)", "บอลเปิด: มิโคเลนโก", EVE, "1-1", M("goals1", 2) + 0.6); goals.push(M("goals1", 2) + 1.4);
    node(ys.g3, "61'", "บาร์รี", "พลิกขึ้นนำ", EVE, "2-1", M("goals2", 0) + 0.2); goals.push(M("goals2", 0) + 1.0);
    node(ys.g4, "81'", "ดิวส์บิวรี-ฮอลล์", "แอสซิสต์: บาร์รี", EVE, "3-1", M("goals2", 1) + 0.3); goals.push(M("goals2", 1) + 1.3);

    // 2 — analysis 1: Barry
    at(2); b.go(M("a1", 0));
    b.write("วิเคราะห์หลังเกม", { x: 540, y: 140, font: F.h(56), color: MUTED, align: "center" });
    header(1, "บาร์รี = ตัวเปลี่ยนเกม", "a1", 1, EVE);
    b.go(M("a1", 1) + 0.9);
    b.stroke("M-150,-170 L-60,-210 Q0,-180 60,-210 L150,-170 L215,-60 L150,-25 L130,-70 V210 H-130 V-70 L-150,-25 L-215,-60 Z",
      { x: 540, y: 640, w: 7, fill: "#dbe6ff" });
    b.write("BARRY", { x: 540, y: 560, font: F.h(56), color: EVE, align: "center" });
    b.write("9", { x: 540, y: 690, font: F.h(150), color: EVE, align: "center" });
    b.go(M("a1", 2));
    ball(190, 990); ball(270, 990);
    b.write("2 ประตู", { x: 330, y: 992, font: F.t(52), color: INK });
    b.stroke(P.arrow(150, 1130, 300, 1130, 0, 22), { w: 6, color: ORANGE });
    b.write("1 แอสซิสต์", { x: 330, y: 1132, font: F.t(52), color: INK });
    b.write("มีส่วนทั้ง 3 ประตู!", { x: 650, y: 1290, font: F.h(60), color: RED, align: "center" });

    // 3 — analysis 2: stats
    at(3);
    header(2, "เกมสูสีกว่าสกอร์", "a2", 0, ORANGE);
    b.go(M("a2", 0) + 1.2);
    b.write("EVE", { x: 120, y: 400, font: F.h(44), color: EVE, align: "center" });
    b.write("COV", { x: 960, y: 400, font: F.h(44), color: COV, align: "center" });
    bar(480, "ครองบอล (%)", 50, 50, 60, "a2", 1);
    bar(700, "ยิงทั้งหมด", 16, 15, 16, "a2", 1);
    b.cursor = Math.max(b.cursor, M("a2", 2));
    bar(920, "ยิงตรงกรอบ", 7, 4, 7, "a2", 2);
    b.stroke(P.circle(120, 990, 62, 1.1), { color: RED, w: 6 });
    b.go(M("a2", 3));
    hlWrite("ความคม ตัดสินเกม", 620, 1200, F.h(64), INK);
    b.write("สถิติ: bet365", { x: 980, y: 1300, font: F.hand(30), color: MUTED, align: "right" });

    // 4 — analysis 3: VAR
    at(4);
    header(3, "VAR ประเด็นร้อน", "a3", 0, RED);
    b.go(M("a3", 0) + 1.0);
    b.stroke(P.rrect(340, 360, 400, 250, 26) + " M470,610 L440,680 M610,610 L640,680 M400,680 H680", { w: 7, fill: "#eef0f5" });
    b.write("VAR", { x: 540, y: 490, font: F.h(110), color: INK, align: "center" });
    b.go(M("a3", 1) + 0.2);
    b.write("แลมพาร์ดชี้:", { x: 100, y: 760, font: F.t(48), color: MUTED });
    b.stroke(P.rrect(-26, -26, 52, 52, 8), { x: 130, y: 860, w: 5 });
    b.write("ควรได้จุดโทษ", { x: 190, y: 845, font: F.t(50), color: INK });
    b.write("(ทาร์คอฟสกีดึงผม)", { x: 190, y: 905, font: F.hand(40), color: MUTED });
    b.write("?", { x: 130, y: 862, font: F.h(46), color: RED, align: "center" });
    b.go(M("a3", 2) + 0.2);
    b.stroke(P.rrect(-26, -26, 52, 52, 8), { x: 130, y: 1010, w: 5 });
    b.write("บาร์รีแฮนด์บอล", { x: 190, y: 995, font: F.t(50), color: INK });
    b.write("(ก่อนประตูที่ 2)", { x: 190, y: 1055, font: F.hand(40), color: MUTED });
    b.write("?", { x: 130, y: 1012, font: F.h(46), color: RED, align: "center" });
    b.go(M("a3", 3) + 0.1);
    b.stroke(P.rrect(-230, -70, 460, 140, 20), { x: 640, y: 1230, w: 9, color: GREEN });
    b.write("ประตูยืน ✓", { x: 640, y: 1232, font: F.h(66), color: GREEN, align: "center" });

    // 5 — table
    at(5); b.go(M("table", 0));
    hlWrite("ตารางคะแนน", 540, 200, F.h(70), INK);
    const rows = [3, 4, 5, 6, 7];
    rows.forEach((n, i) => {
      const y = 380 + i * 150, me = n === 5;
      b.stroke(P.rrect(130, y - 55, 820, 110, 18), { w: me ? 8 : 4, color: me ? EVE : "#b9bdc7", fill: me ? "#dbe6ff" : null, dur: 0.18, gapAfter: 0.02 });
      b.write(String(n), { x: 200, y, font: F.h(56), color: me ? EVE : "#9aa0ad", align: "center", dur: 0.15 });
      b.write(me ? "EVERTON" : "· · ·", { x: 280, y, font: F.h(52), color: me ? EVE : "#b9bdc7", dur: me ? 0.4 : 0.15, t0: me ? M("table", 1) : undefined });
    });
    b.go(M("table", 1) + 0.5);
    b.stroke(P.arrow(1000, 1000, 1000, 720, 0, 30), { w: 9, color: GREEN });
    b.write("ทีมของเดวิด มอยส์", { x: 600, y: 1170, font: F.hand(48), color: MUTED, align: "center" });

    // 6 — CTA
    at(6); b.go(M("cta", 0));
    b.stroke(P.rrect(90, 250, 900, 330, 50) + " M380,580 L330,690 L500,580", { w: 8, fill: "#fff" });
    b.write("เห็นด้วยกับแลมพาร์ดไหม?", { x: 540, y: 365, font: F.h(58), color: INK, align: "center" });
    b.write("VAR ตัดสินพลาด?", { x: 540, y: 470, font: F.t(54), color: RED, align: "center" });
    b.go(M("cta", 1) + 0.2);
    [["พลาด", 800], ["ถูกแล้ว", 950]].forEach(([s, y]) => {
      b.stroke(P.rrect(-32, -32, 64, 64, 10), { x: 400, y, w: 6 });
      b.write(s, { x: 470, y, font: F.t(56), color: INK });
    });
    b.go(M("cta", 2));
    b.write("คอมเมนต์เลย!", { x: 600, y: 1150, font: F.h(84), color: ORANGE, align: "center" });
    b.stroke(P.arrow(860, 1220, 960, 1330, -0.2), { color: ORANGE, w: 8 });
    b.write("ข้อมูล: ESPN · bet365 · Sky Sports", { x: 980, y: 1400, font: F.hand(30), color: MUTED, align: "right" });
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
