// "มด เบอร์ 49 กับภารกิจข้าวเหนียวที่หายไป EP.1" — comedy mock-documentary, Highway FC yellow/black.
// Scenes: hook (cut-out Mod + title) · case file (mugshot wall) · case 1 (empty kratip, flies, stamp)
// · case 2 (checklist, tumbleweed, stamp) · today (real photo, cinematic suspense on the bag) · cliffhanger CTA.
(function () {
  const { clamp, lerp, prog, ease, rng } = window.L;
  const W = 1080, H = 1920, YEL = "#ffd21f", INK = "#121212", RED = "#e0262f", GRN = "#1fae5b";
  const F = { b: (s) => `700 ${s}px "IBM Plex Sans Thai"`, m: (s) => `600 ${s}px "IBM Plex Sans Thai"`, d: (s) => `700 ${s}px "Chakra Petch"`, c: (s) => `700 ${s}px "Mali"` };
  let g, TL, C, D, img = {}, dots;

  function setup(canvas, tl) {
    g = canvas.getContext("2d"); TL = tl; C = tl.cues; D = tl.data;
    dots = document.createElement("canvas"); dots.width = dots.height = 18;
    const d = dots.getContext("2d"); d.fillStyle = "rgba(0,0,0,0.9)"; d.beginPath(); d.arc(9, 9, 3.4, 0, 7); d.fill();
  }
  function preload() {
    return Promise.all(Object.entries(D.images).map(([k, s]) => new Promise((r) => { const im = new Image(); im.onload = () => { img[k] = im; r(); }; im.onerror = r; im.src = s; })));
  }
  const MK = (k, i) => (i === 0 ? C[k].start : C[k].marks[i - 1] ?? C[k].end);
  const segStart = (k) => C[k].start - 0.35;
  const ORDER = ["hook", "file", "case1", "case2", "today", "cta"];
  const segEnd = (k) => { const i = ORDER.indexOf(k); return ORDER[i + 1] ? segStart(ORDER[i + 1]) : TL.duration + 1; };

  // ------------------------------------------------------------ helpers
  function txt(s, x, y, font, color, align = "center") { g.font = font; g.fillStyle = color; g.textAlign = align; g.textBaseline = "middle"; g.fillText(s, x, y); }
  function outlined(s, x, y, font, color, lw = 14, stroke = INK, align = "center") {
    g.save(); g.font = font; g.textAlign = align; g.textBaseline = "middle"; g.lineJoin = "round";
    g.lineWidth = lw; g.strokeStyle = stroke; g.strokeText(s, x, y); g.fillStyle = color; g.fillText(s, x, y); g.restore();
  }
  function fit(s, font, size, maxW) { g.font = font(size); const w = g.measureText(s).width; return w > maxW ? Math.floor(size * maxW / w) : size; }
  function blob(path, fill, lw = 8, stroke = INK) { g.beginPath(); path(); g.fillStyle = fill; g.fill(); if (lw) { g.lineWidth = lw; g.strokeStyle = stroke; g.lineJoin = "round"; g.stroke(); } }
  function cover(im, z, fx, fy, dx = 0, dy = 0, filter = "") {
    if (!im) return;
    const sc = Math.max(W / im.width, H / im.height) * z;
    g.save(); if (filter) g.filter = filter;
    const iw = im.width * sc, ih = im.height * sc;   // keep the image covering the frame (no black edges)
    const x = clamp(W / 2 - fx * sc, W - iw, 0) + dx, y = clamp(H / 2 - fy * sc, H - ih, 0) + dy;
    g.drawImage(im, x, y, iw, ih); g.restore();
  }
  function halftone(a) { g.save(); g.globalAlpha = a; g.fillStyle = g.createPattern(dots, "repeat"); g.fillRect(0, 0, W, H); g.restore(); }
  function burstBG(t, col1, col2) {
    g.fillStyle = col1; g.fillRect(0, 0, W, H);
    g.save(); g.translate(W / 2, 900); g.rotate(t * 0.15); g.fillStyle = col2;
    for (let k = 0; k < 18; k++) { g.beginPath(); g.moveTo(0, 0); g.arc(0, 0, 2000, (k / 18) * Math.PI * 2, ((k + 0.5) / 18) * Math.PI * 2); g.fill(); }
    g.restore();
  }
  function stamp(s, x, y, k, rot = -0.18, col = RED, size = 92) {
    if (k <= 0) return;
    const sc = lerp(2.6, 1, ease.outCubic(clamp(k)));
    g.save(); g.translate(x, y); g.rotate(rot); g.scale(sc, sc); g.globalAlpha = clamp(k * 2) * 0.92;
    g.font = F.b(size); const w = g.measureText(s).width + 70, h = size * 1.5;
    g.fillStyle = "rgba(255,255,255,0.88)"; g.fillRect(-w / 2, -h / 2, w, h);
    g.lineWidth = 10; g.strokeStyle = col; g.strokeRect(-w / 2, -h / 2, w, h); g.lineWidth = 4; g.strokeRect(-w / 2 + 12, -h / 2 + 12, w - 24, h - 24);
    txt(s, 0, 6, F.b(size), col); g.restore();
  }
  function chip(s, x, y, k, bg = INK, fg = YEL, size = 46) {
    if (k <= 0) return;
    g.save(); g.translate(x + (1 - k) * -300, y); g.font = F.b(size); const w = g.measureText(s).width + 56;
    blob(() => g.roundRect(0, -size * 0.8, w, size * 1.6, size * 0.8), bg, 0); txt(s, w / 2, 4, F.b(size), fg); g.restore();
  }
  function kratip(x, y, s, lid = 1) {   // woven sticky-rice basket sticker
    g.save(); g.translate(x, y); g.scale(s, s);
    blob(() => { g.moveTo(-70, -60); g.lineTo(70, -60); g.lineTo(58, 90); g.quadraticCurveTo(0, 110, -58, 90); g.closePath(); }, "#d9a55a", 8);
    g.save(); g.clip(); g.strokeStyle = "rgba(120,70,20,0.55)"; g.lineWidth = 4;
    for (let i = -80; i < 90; i += 16) { g.beginPath(); g.moveTo(-80, i); g.lineTo(80, i + 30); g.stroke(); g.beginPath(); g.moveTo(-80, i + 30); g.lineTo(80, i); g.stroke(); }
    g.restore();
    blob(() => g.rect(-74, -70, 148, 18), "#b9823c", 6);
    if (lid) { g.save(); g.translate(0, -78 - 40 * (1 - lid)); g.rotate(-0.5 * (1 - lid)); blob(() => g.ellipse(0, 0, 80, 22, 0, 0, 7), "#c99447", 7); g.restore(); }
    g.restore();
  }
  function fly(x, y, t, seed) {
    const a = t * 9 + seed, fx = x + Math.cos(a) * 60 + Math.sin(a * 2.3) * 20, fy = y + Math.sin(a * 1.3) * 40;
    g.save(); g.translate(fx, fy); g.scale(2.2, 2.2); g.fillStyle = INK; g.beginPath(); g.ellipse(0, 0, 10, 7, 0, 0, 7); g.fill();
    g.fillStyle = "rgba(255,255,255,0.8)"; const w = Math.sin(t * 80) * 0.5 + 0.5;
    g.beginPath(); g.ellipse(-6, -8, 9, 5 * w + 2, -0.5, 0, 7); g.ellipse(6, -8, 9, 5 * w + 2, 0.5, 0, 7); g.fill(); g.restore();
  }
  function logoBug(t, a) {
    const im = img.logo; if (!im || a <= 0) return;
    g.save(); g.globalAlpha = a; g.shadowColor = "rgba(0,0,0,0.5)"; g.shadowBlur = 16; g.drawImage(im, 40, 50, 130, 130 * im.height / im.width); g.restore();
  }
  function modCut(x, y, h, rot = 0) {   // cut-out Mod, (x, y) = feet centre
    const im = img.mod; if (!im) return;
    const w = h * im.width / im.height;
    g.save(); g.translate(x, y); g.rotate(rot);
    g.shadowColor = "rgba(0,0,0,0.45)"; g.shadowBlur = 30; g.shadowOffsetY = 12;
    g.drawImage(im, -w / 2, -h, w, h); g.restore();
  }

  // ------------------------------------------------------------ scenes
  function hook(t) {
    burstBG(t, YEL, "#ffe766"); halftone(0.08);
    const pin = ease.outBack(prog(t, 0.45, 0.9), 1.8), bob = Math.sin(t * 5) * 6;
    modCut(560, lerp(2300, 1820, pin) + bob, 1250, Math.sin(t * 3) * 0.02);
    const tk = ease.outBack(prog(t, 0.55, 0.95), 2.4);
    if (tk > 0) {
      g.save(); g.translate(W / 2, 430); g.rotate(-0.05); g.scale(tk, tk);
      g.fillStyle = INK; g.beginPath(); g.moveTo(-470, -110); g.lineTo(470, -130); g.lineTo(450, 110); g.lineTo(-460, 120); g.fill();
      outlined("มด เบอร์ 49", 0, 4, F.c(150), YEL, 12, "#ffffff");
      g.restore();
    }
    // "ไม่ใช่เพราะยิงเก่ง" -> ball with a big red X
    const n0 = MK("hook", 1), nk = ease.outBack(prog(t, n0 - 0.05, n0 + 0.3), 2), nx = 1 - prog(t, MK("hook", 2) - 0.2, MK("hook", 2));
    if (nk > 0 && nx > 0) {
      g.save(); g.globalAlpha = nx; g.translate(230, 760); g.scale(nk, nk);
      blob(() => g.arc(0, 0, 80, 0, 7), "#ffffff", 8); g.fillStyle = INK; g.beginPath();
      for (let j = 0; j < 5; j++) { const a = (j / 5) * Math.PI * 2 - Math.PI / 2; g.lineTo(Math.cos(a) * 28, Math.sin(a) * 28); } g.fill();
      g.strokeStyle = RED; g.lineWidth = 22; g.lineCap = "round"; g.beginPath(); g.moveTo(-100, -100); g.lineTo(100, 100); g.moveTo(100, -100); g.lineTo(-100, 100); g.stroke();
      outlined("ยิงเก่ง", 0, 140, F.b(56), "#ffffff", 10);
      g.restore();
    }
    // "สัญญาข้าวเหนียว!"
    const p0 = MK("hook", 2), pk = ease.outBack(prog(t, p0 + 0.3, p0 + 0.7), 2);
    if (pk > 0) {
      g.save(); g.translate(830, 760); g.rotate(0.08 + Math.sin(t * 6) * 0.04); g.scale(pk, pk); kratip(0, 0, 1.3); g.restore();
      g.save(); g.translate(W / 2, 1380); g.rotate(-0.04); g.scale(pk, pk);
      blob(() => g.roundRect(-430, -80, 860, 160, 20), RED, 8); outlined("สัญญาข้าวเหนียว!", 0, 4, F.c(96), "#ffffff", 10);
      g.restore();
    }
  }

  function caseFile(t) {
    const t0 = C.file.start;
    // mugshot wall
    g.fillStyle = "#5d6470"; g.fillRect(0, 0, W, H);
    g.strokeStyle = "rgba(255,255,255,0.55)"; g.lineWidth = 3; g.font = F.d(30); g.fillStyle = "rgba(255,255,255,0.75)"; g.textAlign = "left";
    for (let i = 0; i <= 14; i++) { const y = 300 + i * 90; g.beginPath(); g.moveTo(0, y); g.lineTo(W, y); g.stroke(); g.fillText(`${200 - i * 10}`, 20, y - 16); }
    const zoom = lerp(1.0, 1.06, prog(t, t0, segEnd("file")));
    g.save(); g.translate(W / 2, H / 2); g.scale(zoom, zoom); g.translate(-W / 2, -H / 2);
    modCut(400, 2080, 1500);
    // placard "49"
    g.save(); g.translate(400, 1180); g.rotate(-0.03);
    blob(() => g.rect(-170, -70, 340, 140), INK, 6); txt("ทางหลวง FC", 0, -30, F.b(32), "#ffffff"); txt("No. 49", 0, 26, F.d(60), YEL);
    g.restore(); g.restore();
    // case file card (right)
    const ck = ease.outCubic(prog(t, t0 + 0.4, t0 + 0.8));
    if (ck > 0) {
      g.save(); g.translate((1 - ck) * 500, 0);
      blob(() => g.rect(640, 520, 400, 420), "#f3e2b3", 6);
      txt("แฟ้มคดี #049", 840, 575, F.d(40), INK);
      txt("ชื่อ: มด", 670, 660, F.b(44), INK, "left");
      txt("เบอร์: 49", 670, 730, F.b(44), INK, "left");
      if (t > MK("file", 1) - 0.1) { txt("ฉายา:", 670, 805, F.b(40), INK, "left"); txt("ราชาคำสัญญา", 670, 870, F.b(48), RED, "left"); }
      g.restore();
    }
    stamp("ผู้ต้องสงสัย", 790, 420, prog(t, t0 + 0.9, t0 + 1.15), -0.12, RED, 64);
    // quote bubble
    const qk = ease.outBack(prog(t, MK("file", 3) - 0.1, MK("file", 3) + 0.3), 1.8);
    if (qk > 0) {
      g.save(); g.translate(560, 1430); g.scale(qk, qk);
      blob(() => { g.roundRect(-440, -120, 880, 220, 60); g.moveTo(-200, 95); g.lineTo(-260, 190); g.lineTo(-120, 98); }, "#ffffff", 8);
      txt("เดี๋ยวนัดหน้า", 0, -45, F.c(64), INK); txt("ห่อข้าวเหนียวมาให้!", 0, 40, F.c(70), RED);
      g.restore();
      g.save(); g.translate(900, 1250); g.rotate(0.2); g.scale(qk, qk); blob(() => g.roundRect(-120, -36, 240, 72, 36), YEL, 5); txt("คำสัญญา #1", 0, 3, F.b(36), INK); g.restore();
    }
    // camera flash at the start
    const f = 1 - prog(t, t0 - 0.05, t0 + 0.3); if (t >= t0 - 0.05 && f > 0) { g.fillStyle = `rgba(255,255,255,${f})`; g.fillRect(0, 0, W, H); }
  }

  function case1(t) {
    const t0 = segStart("case1"), t1 = segEnd("case1"), e = MK("case1", 2);
    const zk = ease.inOutCubic(prog(t, e - 0.3, e + 0.5));
    cover(img.A, lerp(1.05, 1.08, prog(t, t0, e)) + 0.45 * zk, lerp(540, 600, zk), lerp(900, 1450, zk));
    chip("คดีที่ 1", 40, 260, ease.outCubic(prog(t, t0 + 0.2, t0 + 0.5)));
    // time-lapse clock on "จนเตะจบ"
    const c0 = MK("case1", 1), ca = prog(t, c0 - 0.1, c0 + 0.2) * (1 - prog(t, e - 0.2, e));
    if (ca > 0) {
      g.save(); g.globalAlpha = ca; g.translate(860, 300);
      blob(() => g.arc(0, 0, 110, 0, 7), "#ffffff", 10);
      const sp = (t - c0) * 14; g.strokeStyle = INK; g.lineCap = "round";
      g.lineWidth = 12; g.beginPath(); g.moveTo(0, 0); g.lineTo(Math.sin(sp / 12) * 55, -Math.cos(sp / 12) * 55); g.stroke();
      g.lineWidth = 7; g.beginPath(); g.moveTo(0, 0); g.lineTo(Math.sin(sp) * 85, -Math.cos(sp) * 85); g.stroke();
      outlined("90 นาทีผ่านไป…", 0, 170, F.b(44), "#ffffff", 9);
      g.restore();
    }
    if (t > e) for (let i = 0; i < 4; i++) fly(480 + i * 60, 700 - (i % 2) * 70, t, i * 2);   // flies over the zoomed-in empty kratip
    stamp("ผิดหวัง ครั้งที่ 1", W / 2, 520, prog(t, e + 0.9, e + 1.15), -0.14);
  }

  function case2(t) {
    const t0 = segStart("case2"), n = MK("case2", 2);
    cover(img.B, lerp(1.04, 1.12, prog(t, t0, segEnd("case2"))), 540, 1000);
    chip("คดีที่ 2", 40, 260, ease.outCubic(prog(t, t0 + 0.2, t0 + 0.5)));
    const c0 = MK("case2", 1);
    const items = [["ส้มตำ", true, c0], ["ไก่ย่าง", true, c0 + 0.9], ["ข้าวเหนียว", false, n + 0.75]];
    const ck = ease.outCubic(prog(t, c0 - 0.2, c0 + 0.2));
    if (ck > 0) {
      g.save(); g.translate((1 - ck) * 500, 0);
      blob(() => g.rect(560, 360, 470, 390), "#fffdf5", 6);
      txt("เช็กลิสต์มื้อนี้", 795, 410, F.b(42), INK);
      items.forEach(([s, ok, ts], i) => {
        const y = 490 + i * 95; txt(s, 600, y, F.b(52), INK, "left");
        const k = ease.outBack(prog(t, ts, ts + 0.25), 2.5);
        if (k > 0) {
          g.save(); g.translate(960, y); g.scale(k, k); g.lineCap = "round"; g.lineWidth = 14;
          if (ok) { g.strokeStyle = GRN; g.beginPath(); g.moveTo(-30, 0); g.lineTo(-8, 24); g.lineTo(34, -26); g.stroke(); }
          else { g.strokeStyle = RED; g.beginPath(); g.moveTo(-30, -30); g.lineTo(30, 30); g.moveTo(30, -30); g.lineTo(-30, 30); g.stroke(); }
          g.restore();
        }
      });
      g.restore();
    }
    // tumbleweed rolls through after "ไม่มา!"
    const tw = prog(t, n + 0.8, n + 3.2);
    if (tw > 0 && tw < 1) {
      const x = lerp(-150, W + 150, tw), y = 1380 - Math.abs(Math.sin(tw * Math.PI * 4)) * 60;
      g.save(); g.translate(x, y); g.rotate(tw * 14); g.strokeStyle = "#8a6a3a"; g.lineWidth = 6;
      const r = rng(5); for (let i = 0; i < 14; i++) { g.beginPath(); g.arc((r() - 0.5) * 40, (r() - 0.5) * 40, 40 + r() * 30, r() * 6, r() * 6 + 3); g.stroke(); }
      g.restore();
    }
    stamp("ผิดหวัง ครั้งที่ 2", W / 2, 1000, prog(t, n + 1.2, n + 1.45), 0.12);
  }

  function today(t) {
    const t0 = segStart("today"), t1 = segEnd("today"), bag = MK("today", 1), br = MK("today", 2), q = MK("today", 3);
    const im = img.photo;
    const zk = ease.inOutCubic(prog(t, bag, bag + 1.2)), zq = ease.inOutCubic(prog(t, q, q + 1.4));
    const beat = t > br ? Math.max(0, Math.sin((t - br) * Math.PI / 0.62)) ** 8 * 0.03 : 0;
    cover(im, lerp(1.0, 1.08, prog(t, t0, bag)) + 0.35 * zk + 0.6 * zq + beat, lerp(620, 520, zk), lerp(900, 1300, zk) + 150 * zq, 0, 0,
      "saturate(0.8) contrast(1.15) brightness(0.95)");
    // red heartbeat vignette
    if (t > br) {
      const vg = g.createRadialGradient(W / 2, H / 2, 300, W / 2, H / 2, 1100);
      vg.addColorStop(0, "rgba(0,0,0,0)"); vg.addColorStop(1, `rgba(120,0,0,${0.35 + beat * 10})`); g.fillStyle = vg; g.fillRect(0, 0, W, H);
    }
    // cinematic bars
    g.fillStyle = "#000"; g.fillRect(0, 0, W, 210); g.fillRect(0, H - 210, W, 210);
    const tk = prog(t, t0 + 0.3, t0 + 0.8) * (1 - prog(t, bag - 0.2, bag));
    if (tk > 0) { g.save(); g.globalAlpha = tk; txt("แต่วันนี้…", W / 2, 1000, F.d(90), "#ffffff"); g.restore(); }
    // highlight the bag
    const hk = ease.outBack(prog(t, bag + 0.6, bag + 0.95), 2) * (1 - prog(t, q - 0.2, q));
    if (hk > 0) {
      g.save(); g.translate(330, 1290); g.scale(hk, hk); g.strokeStyle = YEL; g.lineWidth = 12; g.setLineDash([26, 16]); g.lineDashOffset = -t * 60;
      g.beginPath(); g.ellipse(0, 0, 230, 270, 0, 0, 7); g.stroke(); g.setLineDash([]);
      g.restore();
      g.save(); g.translate(720, 860); g.rotate(-0.06); g.scale(hk, hk); blob(() => g.roundRect(-230, -60, 460, 120, 20), YEL, 7); txt("ถุงปริศนา!?", 0, 4, F.c(66), INK); g.restore();
    }
    const bk = prog(t, br, br + 0.3) * (1 - prog(t, q - 0.1, q + 0.1));
    if (bk > 0) { g.save(); g.globalAlpha = bk; outlined("(กลั้นหายใจ…)", W / 2, 400, F.b(64), "#ffffff", 10); g.restore(); }
    const qk = ease.outBack(prog(t, q + 0.5, q + 0.9), 2.4);
    if (qk > 0) { g.save(); g.translate(W / 2, 900); g.scale(qk * (1 + 0.04 * Math.sin(t * 10)), qk * (1 + 0.04 * Math.sin(t * 10))); outlined("?", 0, 0, F.d(420), YEL, 26); g.restore(); }
  }

  function cta(t) {
    const t0 = segStart("cta");
    burstBG(t, INK, "#262626"); halftone(0.06);
    const lk = ease.outBack(prog(t, t0 + 0.2, t0 + 0.6), 1.8), im = img.logo;
    if (im && lk > 0) { const w = 380, h = w * im.height / im.width; g.save(); g.translate(W / 2, 440); g.scale(lk, lk); g.shadowColor = "rgba(60,150,255,0.9)"; g.shadowBlur = 60; g.drawImage(im, -w / 2, -h / 2, w, h); g.restore(); }
    const ep = ease.outCubic(prog(t, t0 + 0.4, t0 + 0.8));
    if (ep > 0) { g.save(); g.globalAlpha = ep; txt("ติดตามตอนต่อไป · EP.2", W / 2, 720, F.d(50), YEL); g.restore(); }
    const qk = ease.outBack(prog(t, MK("cta", 0) - 0.1, MK("cta", 0) + 0.35), 2);
    if (qk > 0) { g.save(); g.translate(W / 2, 880); g.scale(qk, qk); outlined("มีข้าวเหนียวไหม?", 0, 0, F.c(110), YEL, 16, "#000"); g.restore(); }
    [["มี!", 300, GRN], ["ไม่มีอีกแล้ว", 780, RED]].forEach(([s, x, col], i) => {
      const k = ease.outBack(prog(t, MK("cta", 1) - 0.15 + i * 0.12, MK("cta", 1) + 0.25 + i * 0.12), 2) * (1 + 0.05 * Math.sin(t * 7 + i * 2));
      if (k <= 0) return;
      g.save(); g.translate(x, 1100); g.scale(k, k);
      g.shadowColor = col; g.shadowBlur = 40; blob(() => g.roundRect(-210, -90, 420, 180, 40), col, 0); g.shadowBlur = 0;
      g.lineWidth = 8; g.strokeStyle = "#ffffff"; g.beginPath(); g.roundRect(-210, -90, 420, 180, 40); g.stroke();
      txt(s, 0, 6, F.b(fit(s, F.b, 76, 370)), "#ffffff"); g.restore();
    });
    const ck = prog(t, MK("cta", 1) + 0.4, MK("cta", 1) + 0.8);
    if (ck > 0) { g.save(); g.globalAlpha = ck; outlined("คอมเมนต์ทายกันมา!", W / 2, 1290, F.b(64), "#ffffff", 10, "#000"); g.restore(); }
    g.save(); g.globalAlpha = 0.7 * ep; txt("* เรื่องนี้แต่งเพื่อความฮาภายในทีม ทางหลวง FC", W / 2, 1440, F.m(28), "#ffffff"); g.restore();
  }

  function captions(t) {
    let seg = null;
    for (const k of Object.keys(C)) {
      if (k === "cta") continue;
      const c = C[k];
      c.parts.forEach((p, i) => { const s = i === 0 ? c.start - 0.05 : c.marks[i - 1], e = i < c.parts.length - 1 ? c.marks[i] : c.end + 0.25; if (t >= s && t < e) seg = { p, s, e }; });
    }
    if (!seg) return;
    let p = seg.p; (D.capfix || []).forEach(([a, b]) => (p = p.split(a).join(b)));
    const a = prog(t, seg.s, seg.s + 0.1) * (1 - prog(t, seg.e - 0.08, seg.e));
    g.save(); g.globalAlpha = a; outlined(p, W / 2, 1600, F.b(fit(p, F.b, 54, 960)), "#ffffff", 12); g.restore();
  }

  const SCENES = { hook, file: caseFile, case1, case2, today, cta };
  function draw(t) {
    g.setTransform(1, 0, 0, 1, 0, 0); g.globalAlpha = 1; g.filter = "none"; g.fillStyle = "#000"; g.fillRect(0, 0, W, H);
    let cur = "hook"; ORDER.forEach((k) => { if (t >= segStart(k)) cur = k; });
    // quick comic slide-in transition for each scene
    const i = ORDER.indexOf(cur), ts = segStart(cur), tp = i ? ease.outCubic(prog(t, ts, ts + 0.3)) : 1;
    if (tp < 1 && i > 0) { g.save(); SCENES[ORDER[i - 1]](t); g.restore(); }
    g.save(); g.beginPath(); g.rect(0, 0, W * tp, H); g.clip(); SCENES[cur](t); g.restore();
    if (tp < 1) { g.fillStyle = YEL; g.fillRect(W * tp - 16, 0, 32, H); }
    logoBug(t, cur === "hook" || cur === "cta" ? 0 : 1);
    if (cur === "hook") logoBug(t, prog(t, 0.9, 1.3));
    captions(t);
    const fin = Math.max(prog(t, TL.duration - 0.4, TL.duration), 1 - prog(t, 0, 0.25));
    if (fin > 0) { g.fillStyle = `rgba(0,0,0,${fin})`; g.fillRect(0, 0, W, H); }
  }
  function events() {
    return {
      pen: [], noshot: MK("hook", 1), promise: MK("hook", 2) + 0.3, file: C.file.start, stamp0: C.file.start + 0.9, quote: MK("file", 3),
      case1: C.case1.start, case2: C.case2.start, clock: MK("case1", 1), empty: MK("case1", 2), stamp1: MK("case1", 2) + 0.9,
      checks: [MK("case2", 1), MK("case2", 1) + 0.9], norice: MK("case2", 2) + 0.75, stamp2: MK("case2", 2) + 1.2,
      today: segStart("today"), breath: MK("today", 2), bag: MK("today", 3), cta: segStart("cta"),
    };
  }
  window.scene = { setup, preload, draw, events };
})();
