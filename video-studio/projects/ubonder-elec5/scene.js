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
  const img = {};
  function preload() {
    return Promise.all(Object.entries(D.images || {}).map(([k, src]) => new Promise((r) => { const im = new Image(); im.onload = () => { img[k] = im; if (k === "logo") logo = im; r(); }; im.onerror = r; im.src = src; })));
  }
  // illustrative photo / video card pinned on the board (world space via b.live), label "ภาพประกอบ"
  function cardAt(cx, cy, w, src, opt = {}) {
    const t0 = b.cursor, rot = opt.rot ?? -0.03;
    b.live((gg, t) => {
      const dt = t - t0, k = ease.outBack(prog(dt, 0, 0.45), 1.7); if (k <= 0) return;
      const im = Array.isArray(src) ? img[src[Math.min(src.length - 1, Math.floor(dt * 12) % src.length)]] : img[src]; if (!im) return;
      const h = w * im.height / im.width, z = 1 + 0.05 * clamp(dt / 6);
      gg.save(); gg.translate(cx, cy); gg.rotate(rot); gg.scale(k, k);
      gg.save(); gg.shadowColor = "rgba(60,30,10,0.35)"; gg.shadowBlur = 30; gg.shadowOffsetY = 12; gg.fillStyle = "#fff"; gg.fillRect(-w / 2 - 16, -h / 2 - 16, w + 32, h + 32); gg.restore();
      gg.save(); gg.beginPath(); gg.rect(-w / 2, -h / 2, w, h); gg.clip(); gg.drawImage(im, -w / 2 * z, -h / 2 * z, w * z, h * z);
      if (opt.flicker) { const on = (Math.sin(t * 23) + Math.sin(t * 7.3) * 0.7) > -0.2 ? 0 : 0.55; gg.fillStyle = `rgba(0,0,0,${on})`; gg.fillRect(-w / 2, -h / 2, w, h); }
      gg.restore();
      gg.fillStyle = "rgba(251,191,36,0.75)"; gg.save(); gg.translate(0, -h / 2 - 10); gg.rotate(0.05); gg.fillRect(-80, -22, 160, 44); gg.restore();
      gg.fillStyle = "rgba(43,26,18,0.75)"; gg.beginPath(); gg.roundRect(-w / 2 + 14, h / 2 - 58, 170, 44, 22); gg.fill();
      gg.font = F.cap(24); gg.fillStyle = "#fff"; gg.textAlign = "center"; gg.textBaseline = "middle"; gg.fillText("ภาพประกอบ", -w / 2 + 99, h / 2 - 35);
      gg.restore();
    }, { t0 });
  }
  const FR = (v) => Array.from({ length: 60 }, (_, i) => `f${v}_${i + 1}`);

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

    // 0 — hook: full-screen photos first (drawn in draw()), then the house board
    at(0); b.go(M("hook", 1) - 0.25);
    b.stroke("M-300,40 L0,-230 L300,40", { x: 540, y: 720, w: 10 });
    b.stroke("M-240,0 V330 H240 V0", { x: 540, y: 720, w: 10, fill: "#ffedd5" });
    warnSign(540, 820, 1.05);
    bolt(360, 470, 0.9); bolt(730, 450, 0.75);
    label("5 อาการ", 540, 1200, OR, 110);
    label("ห้ามมองข้าม!", 540, 1330, INK, 84);
    b.go(M("hook", 2));
    b.stroke(P.arrow(760, 1450, 900, 1350, -0.3), { color: RED, w: 9 });
    b.write("ข้อสุดท้าย…", { x: 700, y: 1500, font: F.t(56), color: RED, align: "center" });

    // 1 — flickering light
    at(1); header(1, "ไฟกระพริบ / หรี่ลงเอง", "s1");
    cardAt(540, 770, 500, "p3", { flicker: true, rot: -0.03 });
    b.go(M("s1", 1));
    label("จุดต่อหลวม?", 290, 1320, OR, 58); label("สายไฟเสื่อม?", 790, 1320, OR, 58);

    // 2 — hot / scorched outlet
    at(2); header(2, "ปลั๊ก/สวิตช์ร้อน มีรอยไหม้", "s2");
    cardAt(540, 770, 500, "p4", { rot: 0.03 });
    const heatT = b.cursor;
    b.live((gg, t) => heat(gg, t, 860, 420, heatT), { t0: heatT });
    b.go(M("s2", 1));
    label("ต่อหลวม", 290, 1320, OR, 62); label("ใช้ไฟเกิน", 790, 1320, OR, 62);

    // 3 — breaker trips (video card)
    at(3); header(3, "เบรกเกอร์ตัดบ่อย", "s3");
    cardAt(540, 760, 480, FR(1), { rot: -0.02 });
    b.go(M("s3", 1));
    cross(200, 1300, 0.7);
    label("อย่าดันขึ้นซ้ำๆ", 600, 1300, RED, 64);
    b.go(M("s3", 2));
    label("ไฟเกิน?", 300, 1430, OR, 56); label("ไฟรั่ว?", 780, 1430, OR, 56);

    // 4 — burning smell / crackling (video card)
    at(4); header(4, "กลิ่นไหม้ / เสียงเปาะแปะ", "s4");
    cardAt(540, 760, 480, FR(2), { rot: 0.025 });
    b.go(M("s4", 1));
    label("ตัดไฟทันที!", 540, 1330, RED, 96);

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

    // 6 — don't DIY -> electrician photo
    at(6); b.go(M("safe", 0) + 0.05);
    b.stroke("M-90,160 L-110,-60 Q-110,-90 -85,-90 Q-60,-90 -60,-60 L-55,-160 Q-55,-190 -28,-190 Q0,-190 0,-160 L2,-180 Q2,-210 30,-210 Q58,-210 58,-180 L60,-150 Q62,-178 88,-178 Q114,-178 114,-150 L110,40 Q100,160 0,180 Q-60,185 -90,160 Z",
      { x: 540, y: 720, s: 1.5, w: 8, fill: "#fee2e2" });
    label("อย่าซ่อมเอง!", 540, 1140, RED, 100);
    b.go(M("safe", 1));
    cardAt(540, 720, 480, "p5", { rot: 0.02 });
    b.write("ให้ช่างไฟฟ้าตรวจ", { x: 540, y: 1330, font: F.t(70), color: GREEN, align: "center" });

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

  function hookPhotos(t) {
    const end = M("hook", 1) - 0.1; if (t > end + 0.35) return;
    const al = 1 - prog(t, end, end + 0.35), sw = 1.4;
    const key = t < sw ? "p1" : "p2", im = img[key]; if (!im) return;
    const t0 = key === "p1" ? 0 : sw, z = 1.05 + 0.06 * (t - t0) / 3;
    const s = Math.max(W / im.width, H / im.height) * z, w = im.width * s, h = im.height * s;
    g.save(); g.globalAlpha = al; g.drawImage(im, (W - w) / 2, (H - h) / 2 - 40 * (t - t0) / 3, w, h);
    if (key === "p2") { const on = (Math.sin(t * 21) + Math.sin(t * 6.1) * 0.8) > -0.1 ? 0 : 0.5; g.fillStyle = `rgba(0,0,0,${on})`; g.fillRect(0, 0, W, H); }
    if (key === "p1" && t > sw - 0.12) { g.fillStyle = `rgba(255,255,255,${(t - (sw - 0.12)) / 0.12 * 0.6})`; g.fillRect(0, 0, W, H); }
    g.fillStyle = "rgba(43,26,18,0.7)"; g.beginPath(); g.roundRect(40, 170, 200, 50, 25); g.fill();
    g.font = F.cap(26); g.fillStyle = "#fff"; g.textAlign = "center"; g.textBaseline = "middle"; g.fillText("ภาพประกอบ", 140, 196);
    const k = ease.outBack(prog(t, 0.2, 0.55), 2);
    if (k > 0) { g.save(); g.translate(540, 1200); g.scale(k, k); g.font = F.h(92); g.textAlign = "center"; g.lineJoin = "round"; g.lineWidth = 18; g.strokeStyle = INK; g.fillStyle = "#fff";
      g.strokeText("ไฟในบ้านคุณ…", 0, 0); g.fillText("ไฟในบ้านคุณ…", 0, 0); g.fillStyle = YEL; g.strokeText("กำลังเตือนอะไรอยู่?", 0, 120); g.fillText("กำลังเตือนอะไรอยู่?", 0, 120); g.restore(); }
    g.restore();
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
    hookPhotos(t);
    brandStrip(); captions(t);
    const vg = g.createRadialGradient(W / 2, H / 2, H * 0.5, W / 2, H / 2, H * 0.95);
    vg.addColorStop(0, "rgba(0,0,0,0)"); vg.addColorStop(1, "rgba(120,60,20,0.14)"); g.fillStyle = vg; g.fillRect(0, 0, W, H);
    const fin = 1 - prog(t, 0, 0.3); if (fin > 0) { g.fillStyle = `rgba(255,247,237,${fin})`; g.fillRect(0, 0, W, H); }
  }
  function events() { return { pen: b.penIntervals(), pops: b.pops, pans: b.scenes.slice(1).map((s) => s.t - 0.6) }; }
  window.scene = { setup, preload, draw, events };
})();
