// Overlay for the "สั่ง AI เสกของขึ้นหัว" selfie edit: hook title, chat prompt that types along with the
// speaker, poof + sparkle reveals, sticker-style objects (fan / laptop / can) tracked on the head,
// captions and an end card. Drawn on a transparent canvas over out/base.mp4.
(function () {
  const { clamp, lerp, prog, ease, rng } = window.L;
  const W = 1080, H = 1920;
  const F = { b: (s) => `700 ${s}px "IBM Plex Sans Thai"`, m: (s) => `600 ${s}px "IBM Plex Sans Thai"`, d: (s) => `700 ${s}px "Chakra Petch"` };
  const ACC = "#ff7a45", YEL = "#ffd23f", INK = "#14161f";
  let g, TL, D, C;

  function setup(canvas, tl) { g = canvas.getContext("2d"); TL = tl; D = tl.data; C = tl.cues; }

  function txt(s, x, y, font, color, align = "center") {
    g.font = font; g.fillStyle = color; g.textAlign = align; g.textBaseline = "middle"; g.fillText(s, x, y);
  }
  function outlined(s, x, y, font, color, lw = 12, stroke = INK, align = "center") {
    g.save(); g.font = font; g.textAlign = align; g.textBaseline = "middle"; g.lineJoin = "round";
    g.lineWidth = lw; g.strokeStyle = stroke; g.strokeText(s, x, y); g.fillStyle = color; g.fillText(s, x, y); g.restore();
  }
  function fit(s, font, size, maxW) { g.font = font(size); const w = g.measureText(s).width; return w > maxW ? Math.floor(size * maxW / w) : size; }
  // sticker: build path with fn(), fill + thick white outline + soft shadow
  function sticker(fn, fill, lw = 14) {
    g.save(); g.shadowColor = "rgba(0,0,0,0.35)"; g.shadowBlur = 18; g.shadowOffsetY = 8;
    fn(); g.lineJoin = "round"; g.lineWidth = lw; g.strokeStyle = "#fff"; g.stroke(); g.restore();
    g.save(); fn(); g.fillStyle = fill; g.fill(); g.restore();
  }
  function face(i) { const f = D.face[clamp(i, 0, D.face.length - 1)]; return { cx: f[0], top: f[1], w: f[2] }; }

  // ---------------------------------------------------------------- objects (origin = base on head, unit = s)
  function drawFan(t, s) {
    // base + neck
    sticker(() => { g.beginPath(); g.ellipse(0, -0.04 * s, 0.32 * s, 0.09 * s, 0, 0, Math.PI * 2); }, "#3a8fd6", 10);
    sticker(() => { g.beginPath(); g.roundRect(-0.05 * s, -0.42 * s, 0.1 * s, 0.4 * s, 0.04 * s); }, "#2f7cc0", 10);
    const cy = -0.78 * s, R = 0.42 * s;
    // cage back
    sticker(() => { g.beginPath(); g.arc(0, cy, R, 0, Math.PI * 2); }, "rgba(190,232,255,0.55)", 14);
    // spinning blades (motion blur: a few ghosted copies)
    const a0 = t * 22;
    for (let k = 3; k >= 0; k--) {
      g.save(); g.translate(0, cy); g.rotate(a0 - k * 0.12); g.globalAlpha = k ? 0.18 : 0.95;
      for (let b = 0; b < 3; b++) {
        g.rotate((Math.PI * 2) / 3);
        g.beginPath(); g.ellipse(0, -R * 0.48, R * 0.2, R * 0.44, 0.35, 0, Math.PI * 2);
        g.fillStyle = "#ffffff"; g.fill(); g.lineWidth = 3; g.strokeStyle = "#7cc6ef"; g.stroke();
      }
      g.restore();
    }
    // cage wires + rim + hub
    g.save(); g.translate(0, cy); g.strokeStyle = "rgba(40,90,140,0.55)"; g.lineWidth = 3;
    for (let k = 0; k < 12; k++) { const a = (k / 12) * Math.PI * 2; g.beginPath(); g.moveTo(0, 0); g.lineTo(Math.cos(a) * R, Math.sin(a) * R); g.stroke(); }
    g.beginPath(); g.arc(0, 0, R * 0.62, 0, Math.PI * 2); g.stroke();
    g.lineWidth = 9; g.strokeStyle = "#3a8fd6"; g.beginPath(); g.arc(0, 0, R, 0, Math.PI * 2); g.stroke();
    g.fillStyle = "#3a8fd6"; g.beginPath(); g.arc(0, 0, R * 0.14, 0, Math.PI * 2); g.fill();
    g.fillStyle = "#fff"; g.beginPath(); g.arc(-R * 0.04, -R * 0.04, R * 0.05, 0, Math.PI * 2); g.fill();
    g.restore();
    // wind lines on both sides
    g.save(); g.strokeStyle = "rgba(255,255,255,0.9)"; g.lineWidth = 7; g.lineCap = "round";
    for (let k = 0; k < 6; k++) {
      const side = k % 2 ? 1 : -1, ph = (t * 1.6 + k * 0.37) % 1, y = cy - R * 0.5 + (k >> 1) * R * 0.5;
      const x0 = side * (R + 30 + ph * 140), len = 70 * (1 - ph);
      g.globalAlpha = Math.sin(ph * Math.PI);
      g.beginPath(); g.moveTo(x0, y); g.quadraticCurveTo(x0 + side * len * 0.5, y - 14, x0 + side * len, y); g.stroke();
    }
    g.restore();
  }

  function drawLaptop(t, s) {
    const bw = 0.9 * s, sh = 0.62 * s;
    // keyboard base (sits on the head)
    sticker(() => { g.beginPath(); g.moveTo(-bw / 2, 0); g.lineTo(bw / 2, 0); g.lineTo(bw / 2 - 0.06 * s, -0.1 * s); g.lineTo(-bw / 2 + 0.06 * s, -0.1 * s); g.closePath(); }, "#c9ced8", 12);
    g.fillStyle = "#9aa1ae"; g.fillRect(-0.12 * s, -0.045 * s, 0.24 * s, 0.025 * s);
    // screen
    const sx = -bw / 2 + 0.06 * s, sy = -0.1 * s - sh, sw = bw - 0.12 * s;
    sticker(() => { g.beginPath(); g.roundRect(sx, sy, sw, sh, 0.035 * s); }, "#2b2f3a", 12);
    const ix = sx + 0.03 * s, iy = sy + 0.03 * s, iw = sw - 0.06 * s, ih = sh - 0.06 * s;
    const gr = g.createLinearGradient(0, iy, 0, iy + ih); gr.addColorStop(0, "#1b2140"); gr.addColorStop(1, "#0e1226");
    g.fillStyle = gr; g.fillRect(ix, iy, iw, ih);
    // code lines typing in
    const cols = ["#ff7a45", "#7ee0ff", "#c3f08a", "#ffd23f", "#d9a6ff", "#7ee0ff", "#ff7a45", "#c3f08a"];
    const lines = [0.55, 0.8, 0.4, 0.7, 0.6, 0.35, 0.75, 0.5], lh = ih / 10, rel = t - C.laptop.start;
    const shown = rel * 9;
    g.save(); g.beginPath(); g.rect(ix, iy, iw, ih); g.clip();
    const scroll = Math.max(0, shown - 8) * lh;
    lines.concat(lines).forEach((l, k) => {
      const p = clamp(shown - k); if (p <= 0) return;
      const y = iy + lh * (1 + k) - scroll, ind = (k % 3) * 0.06 * iw;
      g.fillStyle = cols[k % cols.length]; g.globalAlpha = 0.9;
      g.beginPath(); g.roundRect(ix + 0.05 * iw + ind, y - lh * 0.22, (l * iw * 0.8 - ind) * p, lh * 0.44, lh * 0.22); g.fill();
    });
    g.restore();
    // screen glow + highlight
    g.save(); g.globalAlpha = 0.18; g.fillStyle = "#ffffff";
    g.beginPath(); g.moveTo(ix, iy); g.lineTo(ix + iw * 0.35, iy); g.lineTo(ix + iw * 0.15, iy + ih); g.lineTo(ix, iy + ih); g.fill(); g.restore();
  }

  function drawCan(t, s) {
    const cw = 0.46 * s, ch = 0.82 * s, x = -cw / 2, y = -ch;
    const body = () => { g.beginPath(); g.moveTo(x, y + 0.06 * s); g.lineTo(x, -0.04 * s); g.ellipse(0, -0.04 * s, cw / 2, 0.05 * s, 0, Math.PI, 0, true); g.lineTo(x + cw, y + 0.06 * s); g.ellipse(0, y + 0.06 * s, cw / 2, 0.05 * s, 0, 0, Math.PI, true); g.closePath(); };
    sticker(body, "#e8344a", 14);
    g.save(); body(); g.clip();
    // white wave band
    g.fillStyle = "#ffffff"; g.beginPath(); g.moveTo(x - 5, y + ch * 0.45);
    for (let k = 0; k <= 20; k++) { const xx = x + (cw * k) / 20; g.lineTo(xx, y + ch * 0.45 + Math.sin(k * 0.6 + 1) * 0.03 * s); }
    for (let k = 20; k >= 0; k--) { const xx = x + (cw * k) / 20; g.lineTo(xx, y + ch * 0.6 + Math.sin(k * 0.6 + 2.2) * 0.03 * s); }
    g.fill();
    // shading + shine
    const sh = g.createLinearGradient(x, 0, x + cw, 0);
    sh.addColorStop(0, "rgba(0,0,0,0.25)"); sh.addColorStop(0.3, "rgba(255,255,255,0.0)"); sh.addColorStop(0.42, "rgba(255,255,255,0.45)");
    sh.addColorStop(0.55, "rgba(255,255,255,0)"); sh.addColorStop(1, "rgba(0,0,0,0.3)");
    g.fillStyle = sh; g.fillRect(x, y, cw, ch + 10);
    g.restore();
    // lid + tab
    g.save(); g.fillStyle = "#d9dde4"; g.strokeStyle = "#9aa1ae"; g.lineWidth = 3;
    g.beginPath(); g.ellipse(0, y + 0.06 * s, cw / 2, 0.05 * s, 0, 0, Math.PI * 2); g.fill(); g.stroke();
    g.fillStyle = "#aeb4bf"; g.beginPath(); g.ellipse(0.02 * s, y + 0.055 * s, 0.07 * s, 0.022 * s, 0, 0, Math.PI * 2); g.fill();
    g.restore();
    // droplets
    g.fillStyle = "rgba(255,255,255,0.75)";
    [[0.3, 0.3], [0.7, 0.2], [0.2, 0.75], [0.8, 0.7], [0.55, 0.85]].forEach(([u, v]) => { g.beginPath(); g.ellipse(x + u * cw, y + v * ch, 0.012 * s, 0.018 * s, 0, 0, Math.PI * 2); g.fill(); });
    // fizz bubbles above
    const r = rng(9);
    for (let k = 0; k < 14; k++) {
      const ph = (t * (0.6 + r() * 0.5) + r()) % 1, bx = (r() - 0.5) * cw * 0.7 + Math.sin(t * 4 + k) * 6;
      g.globalAlpha = 1 - ph; g.strokeStyle = "#ffffff"; g.lineWidth = 3;
      g.beginPath(); g.arc(bx, y - ph * 0.35 * s, 0.012 * s + r() * 0.012 * s, 0, Math.PI * 2); g.stroke();
    }
    g.globalAlpha = 1;
  }
  const OBJ = { fan: drawFan, laptop: drawLaptop, can: drawCan };

  function poof(t, r, x, y, s) {
    const p = (t - r) / 0.6; if (p < 0 || p > 1) return;
    const rr = rng(Math.round(r * 100));
    g.save();
    for (let k = 0; k < 10; k++) {
      const a = rr() * Math.PI * 2, d = s * (0.15 + 0.45 * ease.outCubic(p)) * (0.6 + rr() * 0.5);
      g.globalAlpha = (1 - p) * 0.95; g.fillStyle = "#ffffff";
      g.beginPath(); g.arc(x + Math.cos(a) * d, y + Math.sin(a) * d * 0.8, s * (0.1 + 0.08 * rr()) * (1 - p * 0.4), 0, Math.PI * 2); g.fill();
    }
    for (let k = 0; k < 9; k++) {   // sparkles
      const a = (k / 9) * Math.PI * 2 + 0.3, d = s * (0.3 + 0.55 * ease.outCubic(p)), sz = 22 * (1 - p) + 6;
      const sx = x + Math.cos(a) * d, sy = y + Math.sin(a) * d;
      g.globalAlpha = 1 - p; g.fillStyle = k % 2 ? YEL : "#ffffff";
      g.beginPath(); g.moveTo(sx, sy - sz); g.quadraticCurveTo(sx, sy, sx + sz, sy); g.quadraticCurveTo(sx, sy, sx, sy + sz);
      g.quadraticCurveTo(sx, sy, sx - sz, sy); g.quadraticCurveTo(sx, sy, sx, sy - sz); g.fill();
    }
    g.restore();
  }

  function headObjects(t, i) {
    const P = D.prompts, f = face(i);
    const s = clamp(f.w * 0.8, 320, 500);
    const bx = f.cx, by = f.top - f.w * 0.16 + Math.sin(t * 3) * 4;
    P.forEach((p, k) => {
      const r = p.reveal, next = P[k + 1] ? P[k + 1].reveal : 1e9;
      if (t < r - 0.02 || t > next + 0.2) return;
      const pin = ease.outBack(prog(t, r, r + 0.4), 2.2), pout = 1 - ease.inCubic(prog(t, next - 0.02, next + 0.12));
      const k2 = pin * pout; if (k2 <= 0.001) return;
      const top = { fan: 1.22, laptop: 0.76, can: 0.9 }[p.obj] * s + 30;   // keep the whole object in frame
      g.save(); g.translate(bx, Math.max(by, top)); g.rotate(Math.sin(t * 2.2) * 0.03); g.scale(k2, k2);
      OBJ[p.obj](t, s); g.restore();
    });
    P.forEach((p) => poof(t, p.reveal - 0.05, bx, by - s * 0.45, s));
  }

  function hook(t) {
    const a = 1 - prog(t, 3.0, 3.3); if (a <= 0) return;
    const p1 = ease.outBack(prog(t, 0.15, 0.55), 1.8), p2 = ease.outBack(prog(t, 0.45, 0.85), 1.8), p3 = ease.outBack(prog(t, C.today.start, C.today.start + 0.4), 2);
    g.save(); g.globalAlpha = a;
    if (p1 > 0) { g.save(); g.translate(W / 2, 250); g.scale(p1, p1); outlined("ให้ AI ตัดต่อคลิป", 0, 0, F.b(92), "#ffffff", 16); g.restore(); }
    if (p2 > 0) { g.save(); g.translate(W / 2, 365); g.rotate(-0.03); g.scale(p2, p2); outlined("ทำได้จริงไหม?", 0, 0, F.b(104), YEL, 16); g.restore(); }
    if (p3 > 0) {
      g.save(); g.translate(W / 2, 485); g.scale(p3, p3);
      g.fillStyle = ACC; g.beginPath(); g.roundRect(-230, -40, 460, 80, 40); g.fill();
      txt("ตัดต่อด้วย Claude", 0, 2, F.b(44), "#ffffff"); g.restore();
    }
    g.restore();
  }

  function chat(t) {
    const P = D.prompts;
    let cur = null; P.forEach((p) => { if (t >= p.show - 0.1) cur = p; });
    if (!cur || t > C.end.start) return;
    const nxt = P[P.indexOf(cur) + 1];
    const hide = Math.max(prog(t, cur.reveal + 0.9, cur.reveal + 1.15), prog(t, C.end.start - 0.25, C.end.start));
    const pin = ease.outBack(prog(t, cur.show - 0.1, cur.show + 0.25), 1.7);
    const k = pin * (1 - hide); if (k <= 0) return;
    if (nxt && t >= nxt.show - 0.1) return;
    const y = 1560;
    g.save(); g.translate(W / 2, y); g.scale(lerp(0.85, 1, k), lerp(0.85, 1, k)); g.globalAlpha = clamp(k * 1.5);
    g.shadowColor = "rgba(0,0,0,0.35)"; g.shadowBlur = 30; g.shadowOffsetY = 10;
    g.fillStyle = "#ffffff"; g.beginPath(); g.roundRect(-460, -95, 920, 190, 34); g.fill(); g.shadowColor = "transparent";
    // header
    g.fillStyle = ACC; g.beginPath(); g.arc(-410, -52, 16, 0, Math.PI * 2); g.fill();
    txt("สั่ง Claude", -382, -52, F.b(30), "#5b6070", "left");
    // typed text
    const n = [...cur.text].length, tp = clamp((t - cur.t0) / (cur.t1 - cur.t0));
    const shown = [...cur.text].slice(0, Math.round(n * tp)).join("");
    const fs = fit(cur.text, F.b, 46, 760);
    txt(shown, -420, 22, F.b(fs), INK, "left");
    g.font = F.b(fs); const cw = g.measureText(shown).width;
    if (t < cur.t1 + 0.2 && Math.floor(t * 3) % 2 === 0) { g.fillStyle = ACC; g.fillRect(-416 + cw, -6, 5, 56); }
    // send button
    const sent = prog(t, cur.t1 + 0.05, cur.t1 + 0.3), bp = 1 + 0.25 * Math.sin(sent * Math.PI);
    g.save(); g.translate(400, 22); g.scale(bp, bp);
    g.fillStyle = tp >= 1 ? ACC : "#d5d8df"; g.beginPath(); g.arc(0, 0, 36, 0, Math.PI * 2); g.fill();
    g.strokeStyle = "#fff"; g.lineWidth = 7; g.lineCap = "round"; g.lineJoin = "round";
    g.beginPath(); g.moveTo(0, 16); g.lineTo(0, -15); g.moveTo(-13, -2); g.lineTo(0, -15); g.lineTo(13, -2); g.stroke();
    g.restore();
    g.restore();
    // status chip under the box
    const st = prog(t, cur.t1 + 0.25, cur.t1 + 0.45);
    if (st > 0 && k > 0) {
      const done = t >= cur.reveal;
      g.save(); g.globalAlpha = st * (1 - hide); g.translate(W / 2, y - 140);
      const label = done ? "✓ เรียบร้อย!" : "กำลังเสก" + ".".repeat(1 + (Math.floor(t * 6) % 3));
      g.font = F.b(36); const w = 300;
      g.fillStyle = done ? "#22b573" : INK; g.beginPath(); g.roundRect(-w / 2, -34, w, 68, 34); g.fill();
      txt(label, done ? 0 : -110, 2, F.b(36), "#ffffff", done ? "center" : "left");
      g.restore();
    }
  }

  function chatOn(t) {   // chat box (or its pop-in) on screen -> captions step aside
    return D.prompts.some((p) => t >= p.show - 0.1 && t < p.reveal + 1.15);
  }
  function captions(t) {
    const cap = D.captions.find(([a, b]) => t >= a && t < b);
    if (!cap || chatOn(t) || t >= C.end.start) return;
    const [a, b, s] = cap, k = ease.outBack(prog(t, a, a + 0.18), 2) * (1 - prog(t, b - 0.08, b));
    const fs = fit(s, F.b, 60, 960);
    g.save(); g.translate(W / 2, 1545); g.scale(lerp(0.8, 1, k), lerp(0.8, 1, k)); g.globalAlpha = clamp(k * 1.5);
    outlined(s, 0, 0, F.b(fs), "#ffffff", 13);
    g.restore();
  }

  function endCard(t) {
    const p = ease.outBack(prog(t, C.end.start, C.end.start + 0.45), 1.6); if (p <= 0) return;
    g.save(); g.translate(W / 2, 1580); g.scale(p, p);
    g.shadowColor = "rgba(0,0,0,0.35)"; g.shadowBlur = 30; g.shadowOffsetY = 10;
    g.fillStyle = INK; g.beginPath(); g.roundRect(-470, -120, 940, 240, 36); g.fill(); g.shadowColor = "transparent";
    txt("ทั้งหมดนี้ Claude เขียนโค้ดตัดต่อให้", 0, -52, F.b(fit("ทั้งหมดนี้ Claude เขียนโค้ดตัดต่อให้", F.b, 54, 860)), "#ffffff");
    const bp = 1 + 0.05 * Math.sin(t * 8);
    g.save(); g.translate(0, 44); g.scale(bp, bp);
    g.fillStyle = ACC; g.beginPath(); g.roundRect(-230, -40, 460, 80, 40); g.fill();
    txt("กดติดตาม ดูคลิปต่อไป", 0, 2, F.b(40), "#ffffff");
    g.restore(); g.restore();
  }

  function draw(t, i) {
    g.setTransform(1, 0, 0, 1, 0, 0); g.globalAlpha = 1; g.clearRect(0, 0, W, H);
    // soft vignette to lift the subject
    const vg = g.createRadialGradient(W / 2, H * 0.45, H * 0.35, W / 2, H * 0.45, H * 0.8);
    vg.addColorStop(0, "rgba(0,0,0,0)"); vg.addColorStop(1, "rgba(0,0,0,0.4)");
    g.fillStyle = vg; g.fillRect(0, 0, W, H);
    headObjects(t, i);
    // flash on each reveal
    D.prompts.forEach((p) => { const f = 1 - prog(t, p.reveal - 0.03, p.reveal + 0.18); if (f < 1 && t >= p.reveal - 0.03) { g.fillStyle = `rgba(255,255,255,${0.35 * f})`; g.fillRect(0, 0, W, H); } });
    hook(t); chat(t); endCard(t); captions(t);
    const fin = prog(t, TL.duration - 0.35, TL.duration);
    if (fin > 0) { g.fillStyle = `rgba(0,0,0,${fin})`; g.fillRect(0, 0, W, H); }
  }
  window.scene = { setup, draw, events: () => ({}) };
})();
