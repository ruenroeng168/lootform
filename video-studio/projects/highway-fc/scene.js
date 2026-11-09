// Highway FC match-night promo — overlay on out/base.mp4 (render.mjs --overlay).
// Logo intro with lightning + light sweep, MATCH NIGHT card, slow-mo tag, interview lower third + Isan captions,
// "ยิงไปกี่ลูก?" gag (goal counter spins, lands on "?"), logo outro with follow button.
(function () {
  const { clamp, lerp, prog, ease, rng } = window.L;
  const W = 1080, H = 1920, GOLD = "#f5c542", BLUE = "#1e8bff", NAVY = "#050b1f", INK = "#0b0d14";
  const F = { b: (s) => `700 ${s}px "IBM Plex Sans Thai"`, d: (s) => `700 ${s}px "Chakra Petch"`, m: (s) => `600 ${s}px "IBM Plex Sans Thai"` };
  let g, TL, C, D, img = {};

  function setup(canvas, tl) { g = canvas.getContext("2d"); TL = tl; C = tl.cues; D = tl.data; }
  function preload() {
    return Promise.all(Object.entries(D.images).map(([k, s]) => new Promise((r) => { const im = new Image(); im.onload = () => { img[k] = im; r(); }; im.onerror = r; im.src = s; })));
  }
  const MK = (k, i) => (i === 0 ? C[k].start : C[k].marks[i - 1] ?? C[k].end);

  function txt(s, x, y, font, color, align = "center", ls = 0) {
    g.font = font; g.fillStyle = color; g.textAlign = align; g.textBaseline = "middle"; g.letterSpacing = ls + "px"; g.fillText(s, x, y); g.letterSpacing = "0px";
  }
  function outlined(s, x, y, font, color, lw = 12, stroke = INK, align = "center") {
    g.save(); g.font = font; g.textAlign = align; g.textBaseline = "middle"; g.lineJoin = "round";
    g.lineWidth = lw; g.strokeStyle = stroke; g.strokeText(s, x, y); g.fillStyle = color; g.fillText(s, x, y); g.restore();
  }
  function fit(s, font, size, maxW) { g.font = font(size); const w = g.measureText(s).width; return w > maxW ? Math.floor(size * maxW / w) : size; }
  function goldGrad(y0, y1) { const gr = g.createLinearGradient(0, y0, 0, y1); gr.addColorStop(0, "#fff3b0"); gr.addColorStop(0.45, GOLD); gr.addColorStop(1, "#a8741a"); return gr; }

  // ------------------------------------------------------------ lightning / sparks / stage
  function bolt(x0, y0, x1, y1, seed, w) {
    const r = rng(seed), n = 12; g.beginPath(); g.moveTo(x0, y0);
    for (let i = 1; i <= n; i++) { const p = i / n; g.lineTo(lerp(x0, x1, p) + (r() - 0.5) * 120 * (1 - Math.abs(p - 0.5)), lerp(y0, y1, p) + (r() - 0.5) * 40); }
    g.save(); g.shadowColor = BLUE; g.shadowBlur = 40; g.strokeStyle = "#cfe8ff"; g.lineWidth = w; g.lineJoin = "round"; g.stroke(); g.restore();
  }
  function stage(t, a) {
    if (a <= 0) return;
    g.save(); g.globalAlpha = a;
    g.fillStyle = NAVY; g.fillRect(0, 0, W, H);
    const rg = g.createRadialGradient(W / 2, 860, 50, W / 2, 860, 900);
    rg.addColorStop(0, "rgba(40,120,255,0.55)"); rg.addColorStop(0.5, "rgba(20,60,160,0.25)"); rg.addColorStop(1, "rgba(0,0,0,0)");
    g.fillStyle = rg; g.fillRect(0, 0, W, H);
    // flickering bolts
    const k = Math.floor(t * 9);
    if (k % 3 !== 1) { bolt(-40, 300 + (k % 5) * 60, 330, 800, k, 5); bolt(W + 40, 420 + (k % 4) * 70, 760, 900, k + 50, 4); }
    // drifting sparks
    const r = rng(17);
    for (let i = 0; i < 70; i++) {
      const sp = 0.15 + r() * 0.3, ph = (r() + t * sp) % 1, x = r() * W + Math.sin(t * 2 + i) * 20, y = H * (1 - ph);
      g.fillStyle = i % 3 ? `rgba(255,190,90,${0.8 * (1 - ph)})` : `rgba(140,200,255,${0.8 * (1 - ph)})`;
      g.beginPath(); g.arc(x, y, 2 + r() * 3, 0, 7); g.fill();
    }
    g.restore();
  }
  function shield(t, cx, cy, size, k, sweepAt) {
    const im = img.shield; if (!im || k <= 0) return;
    const w = size, h = size * im.height / im.width;
    g.save(); g.translate(cx, cy); g.scale(k, k);
    g.shadowColor = "rgba(60,150,255,0.9)"; g.shadowBlur = 70; g.drawImage(im, -w / 2, -h / 2, w, h); g.shadowBlur = 0;
    // light sweep clipped to the shield
    const sp = prog(t, sweepAt, sweepAt + 0.8);
    if (sp > 0 && sp < 1) {
      const off = document.createElement("canvas"); off.width = Math.ceil(w); off.height = Math.ceil(h);
      const o = off.getContext("2d"); o.drawImage(im, 0, 0, w, h); o.globalCompositeOperation = "source-in";
      const x = lerp(-w * 0.6, w * 1.6, sp), gr = o.createLinearGradient(x - 160, 0, x + 160, h * 0.4);
      gr.addColorStop(0, "rgba(255,255,255,0)"); gr.addColorStop(0.5, "rgba(255,255,240,0.85)"); gr.addColorStop(1, "rgba(255,255,255,0)");
      o.fillStyle = gr; o.fillRect(0, 0, w, h);
      g.globalCompositeOperation = "lighter"; g.drawImage(off, -w / 2, -h / 2); g.globalCompositeOperation = "source-over";
    }
    g.restore();
  }

  // ------------------------------------------------------------ sections
  function intro(t) {
    const end = D.clip1, a = 1 - prog(t, end - 0.35, end);
    if (a <= 0) return;
    stage(t, a);
    g.save(); g.globalAlpha = a;
    const hit = 0.55, k = ease.outBack(prog(t, hit - 0.25, hit + 0.25), 1.8) * lerp(1.0, 1.06, prog(t, hit, end));
    const sh = Math.max(0, 1 - (t - hit) / 0.45) * (t > hit ? 16 : 0);
    g.translate(Math.sin(t * 90) * sh, Math.cos(t * 80) * sh);
    shield(t, W / 2, 820, 760, k, hit + 0.5);
    const p = ease.outCubic(prog(t, 1.3, 1.8));
    if (p > 0) {
      g.save(); g.globalAlpha *= p; g.translate(0, (1 - p) * 30);
      g.font = F.b(110); g.lineJoin = "round"; g.textAlign = "center"; g.textBaseline = "middle";
      g.lineWidth = 14; g.strokeStyle = "#0a1a40"; g.strokeText("ทางหลวง FC", W / 2, 1350);
      g.fillStyle = goldGrad(1290, 1410); g.fillText("ทางหลวง FC", W / 2, 1350);
      txt("MATCH NIGHT", W / 2, 1445, F.d(46), "#cfe3ff", "center", 14);
      g.restore();
    }
    g.restore();
    // white flash at the logo slam
    const f = 1 - prog(t, hit, hit + 0.2); if (t >= hit && f > 0) { g.fillStyle = `rgba(255,255,255,${0.7 * f})`; g.fillRect(0, 0, W, H); }
  }

  function logoBug(t) {   // small shield top-left while footage plays
    const a = prog(t, D.clip1 + 0.3, D.clip1 + 0.7) * (1 - prog(t, D.clip2_end - 0.3, D.clip2_end));
    if (a <= 0) return;
    g.save(); g.globalAlpha = a * 0.95; shield(t, 120, 175, 150, 1, -9); g.restore();
  }

  function matchCard(t) {
    const t0 = D.clip1 + 0.35, t1 = D.clip1 + 3.3;
    const p = ease.outCubic(prog(t, t0, t0 + 0.4)), o = prog(t, t1, t1 + 0.35);
    if (p <= 0 || o >= 1) return;
    g.save(); g.globalAlpha = 1 - o; g.translate((1 - p) * -400, 0);
    g.fillStyle = "rgba(5,11,31,0.85)"; g.beginPath(); g.moveTo(0, 300); g.lineTo(780, 300); g.lineTo(740, 470); g.lineTo(0, 470); g.fill();
    g.fillStyle = GOLD; g.fillRect(0, 300, 14, 170);
    txt("MATCH NIGHT", 50, 340, F.d(64), "#ffffff", "left", 6);
    txt(`ทางหลวง FC  vs  ${D.opponent}`, 52, 397, F.b(38), GOLD, "left");
    txt(D.venue, 52, 445, F.m(28), "#cfe3ff", "left");
    g.restore();
    // slow-motion tag while the 1/3-speed section plays
    const s0 = D.clip1 + 1.2, s1 = D.clip1 + 9.6, sa = prog(t, s0, s0 + 0.3) * (1 - prog(t, s1, s1 + 0.3));
    if (sa > 0) {
      g.save(); g.globalAlpha = sa * (0.75 + 0.25 * Math.sin(t * 6));
      g.fillStyle = "#e0263b"; g.beginPath(); g.arc(W - 230, 175, 12, 0, 7); g.fill();
      txt("SLOW MOTION", W - 70, 177, F.d(34), "#ffffff", "right", 4);
      g.restore();
    }
  }

  function lowerThird(t) {
    const t0 = D.clip2 + 0.4, t1 = D.clip2 + 3.6;
    const p = ease.outCubic(prog(t, t0, t0 + 0.45)), o = prog(t, t1, t1 + 0.4);
    if (p <= 0 || o >= 1) return;
    g.save(); g.globalAlpha = 1 - o; g.translate((1 - p) * -500, 0);
    g.fillStyle = GOLD; g.beginPath(); g.moveTo(0, 1250); g.lineTo(560, 1250); g.lineTo(530, 1320); g.lineTo(0, 1320); g.fill();
    txt("สัมภาษณ์หลังเกม", 40, 1286, F.b(44), INK, "left");
    g.fillStyle = "rgba(5,11,31,0.9)"; g.beginPath(); g.moveTo(0, 1320); g.lineTo(620, 1320); g.lineTo(595, 1385); g.lineTo(0, 1385); g.fill();
    txt("นักเตะทางหลวง FC", 40, 1353, F.m(36), "#ffffff", "left");
    g.restore();
  }

  function gag(t) {   // "ยิงไปกี่ลูก?" -> goal counter spins -> "ยิงลูกไหน?" lands on "?"
    const q = D.gag - 1.2, ans = D.gag;
    if (t < q - 0.05 || t > ans + 2.0) return;
    const pin = ease.outBack(prog(t, q, q + 0.3), 2), out = prog(t, ans + 1.6, ans + 2.0);
    g.save(); g.globalAlpha = 1 - out; g.translate(830, 360); g.rotate(0.05); g.scale(pin, pin);
    g.shadowColor = "rgba(30,139,255,0.8)"; g.shadowBlur = 30;
    g.fillStyle = "rgba(5,11,31,0.92)"; g.beginPath(); g.roundRect(-170, -150, 340, 300, 26); g.fill(); g.shadowBlur = 0;
    g.lineWidth = 6; g.strokeStyle = GOLD; g.stroke();
    txt("GOALS", 0, -100, F.d(46), GOLD, "center", 8);
    const landed = t >= ans, wob = landed ? Math.sin((t - ans) * 30) * Math.exp(-(t - ans) * 5) * 0.25 : 0;
    g.save(); g.translate(0, 30); g.rotate(wob);
    if (!landed) {   // rolling digits
      const k = Math.floor(t * 22) % 10, f = (t * 22) % 1;
      g.beginPath(); g.rect(-120, -90, 240, 180); g.clip();
      txt(String(k), 0, -f * 150, F.d(170), "#ffffff"); txt(String((k + 1) % 10), 0, 150 - f * 150, F.d(170), "#ffffff");
    } else txt("?", 0, 0, F.d(190), "#ffe066");
    g.restore(); g.restore();
    const a = ease.outBack(prog(t, ans + 0.05, ans + 0.35), 2.2) * (1 - out);
    if (a > 0) { g.save(); g.translate(W / 2, 1270); g.rotate(-0.06); g.scale(a, a); outlined("ยิงลูกไหน!?", 0, 0, F.b(124), GOLD, 18); g.restore(); }
  }

  function captions(t) {
    // voice-over lines (intro / match / outro)
    let seg = null;
    for (const k of Object.keys(C)) {
      const c = C[k];
      c.parts.forEach((p, i) => {
        const s = i === 0 ? c.start - 0.05 : c.marks[i - 1], e = i < c.parts.length - 1 ? c.marks[i] : c.end + 0.25;
        if (t >= s && t < e) seg = { p, s, e };
      });
    }
    // interview lines (real voice)
    D.interview.forEach(([s, e, p]) => { if (t >= s && t < e) seg = { p, s, e, isan: true }; });
    if (!seg) return;
    const a = prog(t, seg.s, seg.s + 0.1) * (1 - prog(t, seg.e - 0.08, seg.e));
    const fs = fit(seg.p, F.b, 56, 960);
    g.save(); g.globalAlpha = a;
    let cp = seg.p.replace("…", "… "); (D.capfix || []).forEach(([a, b]) => (cp = cp.split(a).join(b)));
    outlined(cp, W / 2, 1560, F.b(fs), seg.isan ? "#ffe066" : "#ffffff", 13);
    g.restore();
  }

  function results(t) {   // 5-set results board (scores from the team), between the interview and the outro
    const t0 = D.clip2_end, t1 = C.outro.start - 0.5;
    const a = prog(t, t0 - 0.15, t0 + 0.3) * (1 - prog(t, t1 - 0.2, t1 + 0.1));
    if (a <= 0) return;
    stage(t, a);
    g.save(); g.globalAlpha = a;
    shield(t, 150, 190, 170, 1, -9);
    const hp = ease.outCubic(prog(t, t0 + 0.1, t0 + 0.5));
    g.save(); g.globalAlpha *= hp;
    g.font = F.b(84); g.textAlign = "center"; g.textBaseline = "middle"; g.lineJoin = "round";
    g.lineWidth = 12; g.strokeStyle = "#0a1a40"; g.strokeText("ผลการแข่งขัน", W / 2 + 60, 175);
    g.fillStyle = goldGrad(130, 220); g.fillText("ผลการแข่งขัน", W / 2 + 60, 175);
    txt(D.venue, W / 2 + 60, 255, F.m(30), "#cfe3ff");
    // header
    g.fillStyle = "rgba(5,11,31,0.85)"; g.beginPath(); g.roundRect(70, 320, 940, 110, 22); g.fill();
    g.fillStyle = "#e9b923"; g.beginPath(); g.roundRect(70, 320, 330, 110, [22, 0, 0, 22]); g.fill();
    g.fillStyle = "#1c4fd8"; g.beginPath(); g.roundRect(680, 320, 330, 110, [0, 22, 22, 0]); g.fill();
    txt("ทางหลวง FC", 235, 377, F.b(46), INK); txt(D.opponent, 845, 377, F.b(46), "#ffffff"); txt("VS", 540, 377, F.d(54), "#ffffff", "center", 4);
    g.restore();
    // set rows
    D.sets.forEach(([h, o], i) => {
      const ts = MK("results", i + 1) - 0.1, p = ease.outBack(prog(t, ts, ts + 0.35), 1.7);
      if (p <= 0) return;
      const y = 470 + i * 150, res = h > o ? "ชนะ" : h < o ? "แพ้" : "เสมอ";
      const col = h > o ? "#1fae5b" : h < o ? "#e0263b" : "#6b7280";
      g.save(); g.translate((1 - p) * -200, 0); g.globalAlpha *= clamp(p * 2);
      g.fillStyle = "rgba(10,22,58,0.96)"; g.beginPath(); g.roundRect(70, y, 940, 126, 20); g.fill();
      g.lineWidth = 3; g.strokeStyle = "rgba(245,197,66,0.5)"; g.stroke();
      txt(`เซ็ต ${i + 1}`, 110, y + 64, F.b(46), "#cfe3ff", "left");
      txt(`${h} - ${o}`, 540, y + 66, F.d(84), "#ffffff", "center", 4);
      g.fillStyle = col; g.beginPath(); g.roundRect(800, y + 26, 180, 76, 38); g.fill();
      txt(res, 890, y + 66, F.b(44), "#ffffff");
      g.restore();
    });
    // summary
    const sp = ease.outBack(prog(t, MK("results", 6) - 0.1, MK("results", 6) + 0.4), 1.8);
    if (sp > 0) {
      const W2 = D.sets.filter(([h, o]) => h > o).length, Dr = D.sets.filter(([h, o]) => h === o).length, L2 = D.sets.length - W2 - Dr;
      const gf = D.sets.reduce((s, [h]) => s + h, 0), ga = D.sets.reduce((s, [, o]) => s + o, 0);
      g.save(); g.translate(W / 2, 1300); g.scale(sp, sp);
      g.shadowColor = "rgba(245,197,66,0.7)"; g.shadowBlur = 40;
      g.fillStyle = "rgba(5,11,31,0.95)"; g.beginPath(); g.roundRect(-470, -95, 940, 190, 30); g.fill(); g.shadowBlur = 0;
      g.lineWidth = 6; g.strokeStyle = GOLD; g.stroke();
      txt(`ชนะ ${W2} · เสมอ ${Dr} · แพ้ ${L2}`, 0, -30, F.b(66), GOLD);
      txt(`ประตูรวม ${gf} - ${ga}`, 0, 50, F.b(42), "#ffffff");
      g.restore();
    }
    g.restore();
  }

  function outro(t) {
    const t0 = C.outro.start - 0.5, a = prog(t, t0 - 0.15, t0 + 0.3);
    if (a <= 0) return;
    stage(t, a);
    g.save(); g.globalAlpha = a;
    const k = ease.outBack(prog(t, t0, t0 + 0.5), 1.7);
    shield(t, W / 2, 760, 680, k, t0 + 0.6);
    const p = ease.outCubic(prog(t, MK("outro", 1) - 0.2, MK("outro", 1) + 0.3));
    if (p > 0) {
      g.save(); g.globalAlpha *= p;
      g.font = F.b(64); g.textAlign = "center"; g.textBaseline = "middle"; g.lineJoin = "round";
      g.lineWidth = 10; g.strokeStyle = "#0a1a40"; g.strokeText("เตะเพื่อเพื่อน เตะเพื่อความสุข", W / 2, 1230);
      g.fillStyle = goldGrad(1190, 1270); g.fillText("เตะเพื่อเพื่อน เตะเพื่อความสุข", W / 2, 1230);
      g.restore();
    }
    const b = ease.outBack(prog(t, MK("outro", 2) - 0.2, MK("outro", 2) + 0.25), 2) * (1 + 0.05 * Math.sin(t * 8));
    if (b > 0) {
      g.save(); g.translate(W / 2, 1385); g.scale(b, b);
      g.shadowColor = BLUE; g.shadowBlur = 40; g.fillStyle = "#e0263b"; g.beginPath(); g.roundRect(-260, -60, 520, 120, 60); g.fill(); g.shadowBlur = 0;
      g.lineWidth = 6; g.strokeStyle = "#ffffff"; g.stroke();
      txt("กดติดตามทีมเรา", 0, 4, F.b(54), "#ffffff");
      g.restore();
    }
    g.restore();
  }

  function draw(t) {
    g.setTransform(1, 0, 0, 1, 0, 0); g.globalAlpha = 1; g.clearRect(0, 0, W, H);
    // light cinematic vignette on footage
    if (t > D.clip1 - 0.2 && t < D.clip2_end + 0.2) {
      const vg = g.createRadialGradient(W / 2, H * 0.45, H * 0.35, W / 2, H * 0.45, H * 0.85);
      vg.addColorStop(0, "rgba(0,0,0,0)"); vg.addColorStop(1, "rgba(0,0,10,0.45)"); g.fillStyle = vg; g.fillRect(0, 0, W, H);
    }
    intro(t); logoBug(t); matchCard(t); lowerThird(t); gag(t); results(t); outro(t); captions(t);
    // flash on cuts into each clip
    for (const tc of [D.clip1, D.clip2]) { const f = 1 - prog(t, tc, tc + 0.18); if (t >= tc && f > 0) { g.fillStyle = `rgba(255,255,255,${0.5 * f})`; g.fillRect(0, 0, W, H); } }
    const fin = Math.max(prog(t, TL.duration - 0.45, TL.duration), 1 - prog(t, 0, 0.2));
    if (fin > 0) { g.fillStyle = `rgba(0,0,0,${fin})`; g.fillRect(0, 0, W, H); }
  }
  function events() { return { pen: [], clip1: D.clip1, clip2: D.clip2, clip2_end: D.clip2_end, gag: D.gag, outro: C.outro.start - 0.5,
    sets: D.sets.map((_, i) => MK("results", i + 1)), summary: MK("results", 6) }; }
  window.scene = { setup, preload, draw, events };
})();
