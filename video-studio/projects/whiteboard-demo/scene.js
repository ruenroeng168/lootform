// Whiteboard explainer — "ทำไมเราเลื่อนคลิปสั้นไม่หยุด"
(function () {
  const { clamp, lerp, prog, ease, noise1, rng } = window.L;
  const { P, Board, drawHand } = window.SK;
  const INK = "#1f2430", BLUE = "#2f6fde", RED = "#e0483e", GREEN = "#2e9e5b",
    ORANGE = "#f08a24", PURPLE = "#8e5bd8", CYAN = "#38c6f4", MUTED = "#6b7080";
  const F = {
    h: (s = 78) => `700 ${s}px "Mali"`, t: (s = 54) => `600 ${s}px "Mali"`,
    hand: (s = 44) => `400 ${s}px "Sriracha"`, cap: (s = 44) => `600 ${s}px "IBM Plex Sans Thai"`,
  };
  const HOST = { x: 240, y: 1000 };
  let g, W, H, TL, C, b, paper, hostDone = 0, clockT = 0, watchT = 0;

  const M = (cue, k) => (k === 0 ? C[cue].start : C[cue].marks[k - 1] ?? C[cue].end);

  function setup(canvas, tl) {
    g = canvas.getContext("2d"); W = tl.width; H = tl.height; TL = tl; C = tl.cues;
    b = new Board(g, { speed: 1700, writeSpeed: 900 });
    // paper texture
    paper = document.createElement("canvas"); paper.width = paper.height = 512;
    const pg = paper.getContext("2d"); pg.fillStyle = "#f8f7f3"; pg.fillRect(0, 0, 512, 512);
    const r = rng(5);
    for (let i = 0; i < 2600; i++) { pg.fillStyle = `rgba(0,0,0,${0.012 + r() * 0.02})`; pg.fillRect(r() * 512, r() * 512, 1 + r() * 1.5, 1 + r() * 1.5); }
    buildHost();
    buildBoards();
    b.settleCamera();
  }

  // ------------------------------------------------------------ host (screen space)
  function buildHost() {
    b.space = "screen"; b.ox = HOST.x; b.oy = HOST.y; b.go(0.35);
    const o = { w: 5, gapAfter: 0.02 };
    b.stroke("M-92,-222 Q-108,-218 -110,-190 L-118,-38 Q-118,-24 -104,-24 H104 Q118,-24 118,-38 L110,-190 Q108,-218 92,-222 Z", { ...o, fill: "#cfe0ff", dur: 0.45 });
    b.stroke("M-55,-112 H55 L66,-56 H-66 Z", { ...o, dur: 0.18 });
    b.stroke("M-18,-218 V-176 M18,-218 V-176", { ...o, dur: 0.12 });
    b.stroke("M-82,-372 Q-110,-450 -38,-420 M82,-372 Q110,-450 38,-420", { ...o, fill: "#eef0f5", dur: 0.22 });
    b.stroke(P.circle(0, -330, 100, 1.04, -1.9), { ...o, fill: "#eef0f5", dur: 0.38 });
    b.stroke(P.rrect(-70, -376, 140, 94, 40), { ...o, fill: INK, dur: 0.26 });
    b.stroke("M-50,-24 V-4 M50,-24 V-4 M-92,0 H-14 M14,0 H92", { ...o, dur: 0.2 });
    hostDone = b.cursor;
    b.live(drawHostLive, { t0: hostDone });
    b.space = "world";
  }

  function armPose(t) {
    // right arm gestures toward the board at each line, waves on the CTA
    let gest = 0, wave = 0;
    for (const k of Object.keys(C)) {
      const s = C[k].start;
      gest = Math.max(gest, prog(t, s - 0.1, s + 0.25) * (1 - prog(t, s + 1.8, s + 2.3)));
    }
    wave = prog(t, M("cta", 0), M("cta", 0) + 0.3) * (1 - prog(t, M("cta", 1) + 0.6, M("cta", 1) + 1.0));
    gest = Math.max(gest, wave);
    return { gest, wave };
  }

  function drawHostLive(g, t) {
    const appear = prog(t, hostDone, hostDone + 0.25);
    const m = TL.mouth[clamp(Math.round(t * TL.fps), 0, TL.mouth.length - 1)] || 0;
    const pen = b.hand(t, b.camera(t)).pos;
    const lx = clamp((pen[0] - HOST.x) / 900, -1, 1) * 9, ly = clamp((pen[1] - (HOST.y - 330)) / 600, -1, 1) * 7;
    let blink = 1;
    for (let bt = 3.1; bt < TL.duration; bt += 3.7) { const x = (t - bt) / 0.14; if (x >= 0 && x <= 1) blink = 1 - Math.sin(Math.PI * x); }
    const { gest, wave } = armPose(t);
    g.save(); g.globalAlpha = appear;
    // arms
    const arm = (side, a1, a2) => {
      const sx = side * 98, sy = -196, up = 78, fo = 72;
      const ex = sx + side * Math.sin(a1) * up, ey = sy + Math.cos(a1) * up;
      const hx = ex + side * Math.sin(a1 + a2) * fo, hy = ey + Math.cos(a1 + a2) * fo;
      g.lineCap = "round"; g.lineJoin = "round";
      g.strokeStyle = INK; g.lineWidth = 30; g.beginPath(); g.moveTo(sx, sy); g.lineTo(ex, ey); g.lineTo(hx, hy); g.stroke();
      g.strokeStyle = "#cfe0ff"; g.lineWidth = 20; g.stroke();
      g.fillStyle = "#fff"; g.strokeStyle = INK; g.lineWidth = 4.5;
      g.beginPath(); g.arc(hx, hy, 20, 0, 7); g.fill(); g.stroke();
    };
    const bob = Math.sin(t * 2.2) * 3;
    g.translate(0, bob);
    arm(-1, 0.32 + 0.03 * Math.sin(t * 1.7), -0.25);
    const ra1 = lerp(0.32, 2.2, ease.outBack(gest, 1.6));
    const ra2 = lerp(-0.25, wave > 0 ? 0.5 + 0.45 * Math.sin(t * 11) * wave : 0.15, gest);
    arm(1, ra1, ra2);
    // face LEDs
    g.shadowColor = CYAN; g.shadowBlur = 10; g.fillStyle = CYAN;
    const happy = wave > 0.2;
    for (const s of [-1, 1]) {
      const ex = s * 28 + lx, ey = -338 + ly;
      if (happy) { g.strokeStyle = CYAN; g.lineWidth = 7; g.lineCap = "round"; g.beginPath(); g.arc(ex, ey + 8, 12, Math.PI * 1.15, Math.PI * 1.85); g.stroke(); }
      else { const eh = 32 * Math.max(blink, 0.14); g.beginPath(); g.roundRect(ex - 9, ey - eh / 2, 18, eh, 9); g.fill(); }
    }
    const mh = 4 + m * 20;
    g.beginPath(); g.roundRect(-16 + lx * 0.5, -302 + ly * 0.4 - mh / 2, 32, mh, 3); g.fill();
    g.restore();
  }

  // ------------------------------------------------------------ boards (world space)
  function header(num, str, cue, col = RED) {
    b.go(M(cue, 0) + 0.05);
    b.stroke(P.circle(560, 190, 50), { color: col, w: 7 });
    b.write(String(num), { x: 560, y: 194, font: F.h(66), color: col, align: "center" });
    b.go(M(cue, 1));
    g.font = F.h(); const w = g.measureText(str).width;
    b.highlight(636, 214, w + 20, 34, { gapAfter: 0 });
    b.write(str, { x: 646, y: 190, font: F.h(), color: INK, t0: b.cursor - 0.3 });
  }

  function phone(x, y, s = 1, col = INK) {
    b.stroke(P.rrect(-120, -220, 240, 440, 32), { x, y, s, color: col, w: 7 });
    b.stroke("M-32,-190 H32", { x, y, s, color: col, w: 6 });
  }
  function face(x, y, kind) {
    b.stroke(P.circle(0, 0, 44), { x, y, w: 6 });
    b.stroke("M-16,-12 V-8 M16,-12 V-8", { x, y, w: 9 });
    if (kind === "meh") b.stroke("M-18,18 H18", { x, y, w: 6 });
    else b.stroke("M-24,6 Q0,40 24,6 Z", { x, y, w: 6, fill: ORANGE });
  }

  function buildBoards() {
    const keys = ["hook", "title", "r1", "r2", "r3", "fix", "cta"];
    const offY = [0, 140, -100, 120, 0, -120, 60];
    keys.forEach((k, i) => b.scene(i === 0 ? 0 : C[k].start - 0.15, i * 2300, offY[i]));
    const at = (i) => { const s = b.scenes[i]; b.ox = s.x; b.oy = s.y; };

    // 0 — hook
    at(0); b.go(M("hook", 0) + 0.05);
    phone(820, 470);
    b.stroke("M-30,-48 L50,0 L-30,48 Z", { x: 828, y: 455, color: BLUE, fill: BLUE, w: 6 });
    b.stroke(P.circle(0, 0, 14), { x: 820, y: 640, w: 5 });
    b.go(M("hook", 1));
    b.write("แค่ 1 คลิป", { x: 820, y: 770, font: F.t(58), color: BLUE, align: "center" });
    b.go(M("hook", 2));
    b.stroke(P.arrow(985, 360, 1215, 360, -0.18), { color: ORANGE, w: 7 });
    b.stroke(P.circle(1430, 440, 170, 1.05), { w: 8 });
    let ticks = ""; for (let i = 0; i < 12; i++) { const a = (i / 12) * Math.PI * 2; ticks += `M${Math.cos(a) * 140},${Math.sin(a) * 140} L${Math.cos(a) * 155},${Math.sin(a) * 155} `; }
    b.stroke(ticks, { x: 1430, y: 440, w: 6, dur: 0.4 });
    clockT = b.cursor;
    b.live((g, t) => clockHands(g, t, 1430, 440), { t0: clockT });
    b.go(M("hook", 3));
    b.write("1 ชั่วโมง!", { x: 1430, y: 730, font: F.h(74), color: RED, align: "center" });
    b.stroke("M1650,250 L1665,330 M1700,240 L1705,320", { color: RED, w: 9 });
    b.stroke(P.circle(1668, 365, 5) + " " + P.circle(1707, 352, 5), { color: RED, w: 8 });

    // 1 — title
    at(1); b.go(M("title", 0) + 0.05);
    b.write("ความลับของคลิปสั้น", { x: 1165, y: 300, font: F.t(56), color: MUTED, align: "center" });
    b.stroke(P.star(830, 300, 26) + " " + P.star(1500, 300, 26), { color: ORANGE, w: 5 });
    b.go(M("title", 1));
    g.font = F.h(112); const tw = g.measureText("ทำไมเราเลื่อนไม่หยุด?").width;
    b.highlight(1165 - tw / 2 - 10, 470, tw + 20, 52, { gapAfter: 0 });
    b.write("ทำไมเราเลื่อนไม่หยุด?", { x: 1165, y: 460, font: F.h(112), color: INK, align: "center", t0: b.cursor - 0.3 });
    b.stroke(P.squiggle(1165 - tw / 2, 575, tw, 7, 8), { color: RED, w: 6 });
    phone(1080, 780, 0.45);
    b.stroke(P.arrow(1210, 860, 1210, 720, 0, 20) + " " + P.arrow(1260, 880, 1260, 700, 0, 20), { color: BLUE, w: 6 });

    // 2 — unpredictable reward
    at(2); header(1, "รางวัลที่คาดเดาไม่ได้", "r1");
    b.go(M("r1", 2));
    [["meh", 650, "เฉยๆ"], ["lol", 880, "ฮามาก!"], ["meh", 1110, "เฉยๆ"]].forEach(([k, x, lab]) => {
      b.stroke(P.rrect(-85, -140, 170, 280, 22), { x, y: 510, w: 6, gapAfter: 0.02 });
      face(x, 500, k);
      b.write(lab, { x, y: 700, font: F.hand(42), color: k === "lol" ? ORANGE : MUTED, align: "center", gapAfter: 0.04 });
    });
    b.go(M("r1", 3));
    b.stroke(P.arrow(1225, 510, 1385, 510, 0.12), { color: PURPLE, w: 7 });
    b.stroke("M-95,-40 H95 V130 H-95 Z", { x: 1580, y: 500, w: 7, fill: "#efe6ff" });
    b.stroke("M-95,-40 L-45,-100 H145 L95,-40 M95,130 L145,70 V-100", { x: 1580, y: 500, w: 7 });
    b.write("?", { x: 1580, y: 548, font: F.h(120), color: PURPLE, align: "center" });
    b.stroke(P.star(1440, 380, 22) + " " + P.star(1760, 360, 28) + " " + P.star(1770, 640, 20), { color: ORANGE, w: 5 });
    b.write("= กล่องสุ่ม!", { x: 1590, y: 740, font: F.t(56), color: PURPLE, align: "center" });

    // 3 — endless feed
    at(3); header(2, "ฟีดไม่มีวันจบ", "r2", BLUE);
    b.stroke(P.infinity(820, 500, 260), { color: BLUE, w: 12, dur: 1.0 });
    b.go(M("r2", 2));
    let oct = []; for (let i = 0; i <= 8; i++) { const a = (i / 8) * Math.PI * 2 + Math.PI / 8; oct.push([Math.cos(a) * 165, Math.sin(a) * 165]); }
    b.stroke(P.poly(oct, true), { x: 1450, y: 470, color: RED, w: 9, fill: "#ffe3e0" });
    b.write("หยุด", { x: 1450, y: 470, font: F.h(84), color: RED, align: "center" });
    b.go(M("r2", 3));
    b.stroke("M-200,-200 L200,200 M200,-200 L-200,200", { x: 1450, y: 470, color: INK, w: 12 });
    b.write("ไม่มีสัญญาณให้หยุด!", { x: 1450, y: 740, font: F.t(54), color: RED, align: "center" });

    // 4 — short & fast
    at(4); header(3, "สั้นและเร็ว", "r3", ORANGE);
    b.go(M("r3", 2));
    b.stroke(P.circle(820, 520, 165, 1.04), { w: 8, fill: "#fff6e8" });
    b.stroke("M-26,-205 H26 V-182 H-26 Z M0,-182 V-166", { x: 820, y: 520, w: 7 });
    watchT = b.cursor;
    b.live((g, t) => watchHand(g, t, 820, 520), { t0: watchT });
    b.write("15 วิ", { x: 820, y: 590, font: F.h(72), color: BLUE, align: "center" });
    b.stroke("M30,-90 L-25,10 H15 L-20,100 L60,-15 H20 L45,-90 Z", { x: 1080, y: 430, color: ORANGE, fill: "#ffd84d", w: 6 });
    b.go(M("r3", 3) + 0.5);
    [["อีก!", 1290, 360, 64], ["อีก!", 1480, 520, 80], ["อีก!!", 1680, 700, 100]].forEach(([s, x, y, z], i) =>
      b.write(s, { x, y, font: F.h(z), color: ORANGE, align: "center", t0: M("r3", 3) + 0.55 + i * 0.5, dur: 0.35 }));
    b.stroke(P.arrow(1330, 410, 1430, 480, 0.3, 20) + " " + P.arrow(1540, 580, 1620, 640, 0.3, 20), { color: INK, w: 5, t0: M("r3", 3) + 1.9 });

    // 5 — fixes
    at(5); b.go(M("fix", 0) + 0.05);
    b.write("วิธีแก้ง่ายๆ", { x: 1165, y: 190, font: F.h(88), color: GREEN, align: "center" });
    b.stroke(P.squiggle(940, 265, 450, 6, 5), { color: GREEN, w: 6 });
    [["ตั้งเวลาก่อนเปิดแอป", 420, 1], ["วางมือถือให้ไกลตัว ก่อนนอน", 620, 2]].forEach(([s, y, k]) => {
      b.go(M("fix", k));
      b.stroke(P.rrect(-38, -38, 76, 76, 10), { x: 640, y, w: 6 });
      b.write(s, { x: 720, y: y + 4, font: F.t(58), color: INK });
      const ck = b.stroke("M-24,-2 L-6,20 L32,-30", { x: 640, y, color: RED, w: 10, dur: 0.22 });
      b.pops.push(ck.t0 + ck.dur);
    });
    b.go(M("fix", 1) + 1.4);
    b.stroke(P.circle(1640, 420, 56) + " M1640,420 V385 M1640,420 L1665,435", { w: 6 });
    b.go(M("fix", 2) + 1.8);
    b.stroke("M28,-52 A58,58 0 1,0 28,52 A44,44 0 1,1 28,-52 Z", { x: 1640, y: 620, color: INK, fill: "#ffd84d", w: 6 });

    // 6 — call to action
    at(6); b.go(M("cta", 0) + 0.05);
    b.write("ลองดูนะ!", { x: 1165, y: 200, font: F.h(96), color: BLUE, align: "center" });
    b.go(M("cta", 1));
    b.stroke(P.rrect(-450, -140, 900, 280, 44) + " M-120,140 L-170,215 L-40,140", { x: 1165, y: 500, w: 7, fill: "#ffffff" });
    b.write("วันนี้คุณเลื่อนไปกี่ชั่วโมง?", { x: 1165, y: 455, font: F.t(58), color: INK, align: "center" });
    b.go(M("cta", 2) + 0.2);
    b.write("____ ชั่วโมง", { x: 1165, y: 548, font: F.hand(54), color: RED, align: "center" });
    b.write("คอมเมนต์เลย!", { x: 1165, y: 790, font: F.h(76), color: ORANGE, align: "center" });
    b.stroke(P.arrow(1420, 760, 1600, 900, -0.25), { color: ORANGE, w: 8 });
  }

  function clockHands(g, t, x, y) {
    const k = ease.inOutCubic(prog(t, M("hook", 3) - 0.1, M("hook", 3) + 1.8));
    const mA = -Math.PI / 2 + (t - clockT) * 0.25 + k * Math.PI * 2 * 2;
    const hA = -Math.PI / 2 + 0.6 + k * Math.PI / 3;
    g.strokeStyle = INK; g.lineCap = "round";
    g.lineWidth = 10; g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.cos(hA) * 80, y + Math.sin(hA) * 80); g.stroke();
    g.lineWidth = 7; g.strokeStyle = RED; g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.cos(mA) * 125, y + Math.sin(mA) * 125); g.stroke();
    g.fillStyle = INK; g.beginPath(); g.arc(x, y, 12, 0, 7); g.fill();
  }
  function watchHand(g, t, x, y) {
    const a = -Math.PI / 2 + (t - watchT) * Math.PI * 1.2;
    g.strokeStyle = RED; g.lineWidth = 6; g.lineCap = "round";
    g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.cos(a) * 120, y + Math.sin(a) * 120); g.stroke();
    g.fillStyle = INK; g.beginPath(); g.arc(x, y, 10, 0, 7); g.fill();
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
    let size = 44; g.font = F.cap(size);
    let w = g.measureText(seg.p).width;
    if (w > 1250) { size = Math.floor((size * 1250) / w); g.font = F.cap(size); w = g.measureText(seg.p).width; }
    g.save(); g.globalAlpha = a;
    g.fillStyle = "rgba(31,36,48,0.88)";
    g.beginPath(); g.roundRect(1165 - w / 2 - 34, 1010 - size / 2 - 20, w + 68, size + 40, 14); g.fill();
    g.fillStyle = "#fff"; g.textAlign = "center"; g.textBaseline = "middle";
    g.fillText(seg.p, 1165, 1012);
    g.restore();
  }

  function draw(t, f) {
    g.setTransform(1, 0, 0, 1, 0, 0); g.globalAlpha = 1;
    const cam = b.camera(t);
    g.save(); g.translate(-((cam.x % 512) + 512) % 512, -((cam.y % 512) + 512) % 512);
    g.fillStyle = g.createPattern(paper, "repeat"); g.fillRect(0, 0, W + 1024, H + 1024); g.restore();
    b.draw(t, "world", cam);
    b.draw(t, "screen", cam);
    const h = b.hand(t, cam);
    drawHand(g, h.pos[0], h.pos[1], h.down, t);
    captions(t);
    const vg = g.createRadialGradient(W / 2, H / 2, H * 0.55, W / 2, H / 2, H * 1.1);
    vg.addColorStop(0, "rgba(0,0,0,0)"); vg.addColorStop(1, "rgba(60,50,30,0.16)");
    g.fillStyle = vg; g.fillRect(0, 0, W, H);
    const fin = Math.max(prog(t, TL.duration - 0.8, TL.duration - 0.05), 1 - prog(t, 0, 0.3));
    if (fin > 0) { g.fillStyle = `rgba(248,247,243,${fin})`; g.fillRect(0, 0, W, H); }
  }

  function events() {
    return { pen: b.penIntervals(), pops: b.pops, pans: b.scenes.slice(1).map((s) => s.t - 0.6) };
  }

  window.scene = { setup, draw, events };
})();
