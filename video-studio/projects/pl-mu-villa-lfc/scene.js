// Match-recap photo story: full-bleed CC photos (Ken Burns), broadcast-style scoreboard with scorer log,
// GOAL! bursts + scorer cards synced to voice marks, stoppage-time clock, relegation ladder, top-4 / bottom
// badges and a comment poll. Content in data.json: segments, matches, goals.
(function () {
  const { clamp, lerp, prog, ease, rng, hexA } = window.L;
  const W = 1080, H = 1920;
  const F = { b: (s) => `700 ${s}px "IBM Plex Sans Thai"`, m: (s) => `600 ${s}px "IBM Plex Sans Thai"`, d: (s) => `700 ${s}px "Chakra Petch"` };
  const YEL = "#ffd23f", INK = "#0b0d14";
  let g, TL, C, D, photos = {}, credits = {}, grain;

  const MK = (k, i) => (C[k] ? (i === 0 ? C[k].start : C[k].marks[i - 1] ?? C[k].end) : 1e9);

  function setup(canvas, tl) {
    g = canvas.getContext("2d"); TL = tl; C = tl.cues; D = tl.data || {};
    (D.credits || []).forEach((c) => (credits[c.key] = c));
    D.goals.forEach((gl) => (gl.t = MK(gl.cue, gl.mark) + (gl.delay || 0)));
    grain = document.createElement("canvas"); grain.width = grain.height = 256;
    const gg = grain.getContext("2d"), r = rng(11), id = gg.createImageData(256, 256);
    for (let i = 0; i < id.data.length; i += 4) { const v = 128 + (r() - 0.5) * 90; id.data[i] = id.data[i + 1] = id.data[i + 2] = v; id.data[i + 3] = 18; }
    gg.putImageData(id, 0, 0);
  }
  function preload() {
    return Promise.all(Object.entries(D.images || {}).map(([k, src]) => new Promise((res) => {
      const im = new Image(); im.onload = () => { photos[k] = im; res(); }; im.onerror = () => res();
      im.src = src.startsWith("data:") ? src : "../" + src;
    })));
  }

  // ------------------------------------------------------------ helpers
  function txt(s, x, y, font, color, align = "center", ls = 0) {
    g.font = font; g.fillStyle = color; g.textAlign = align; g.textBaseline = "middle"; g.letterSpacing = ls + "px";
    g.fillText(s, x, y); g.letterSpacing = "0px";
  }
  function stxt(s, x, y, font, color, align = "center", ls = 0) {
    g.save(); g.shadowColor = "rgba(0,0,0,0.75)"; g.shadowBlur = 22; g.shadowOffsetY = 4; txt(s, x, y, font, color, align, ls); g.restore();
  }
  function outlined(s, x, y, font, color, lw = 14, align = "center") {
    g.save(); g.font = font; g.textAlign = align; g.textBaseline = "middle"; g.lineJoin = "round";
    g.lineWidth = lw; g.strokeStyle = INK; g.strokeText(s, x, y); g.fillStyle = color; g.fillText(s, x, y); g.restore();
  }
  function fit(s, font, size, maxW) { g.font = font(size); const w = g.measureText(s).width; return w > maxW ? Math.floor(size * maxW / w) : size; }

  // ------------------------------------------------------------ photos
  const segs = () => D.segments;
  const segStart = (i) => (i === 0 ? -1 : MK(segs()[i].cue, segs()[i].mark || 0) - 0.3);
  const segEnd = (i) => (segs()[i + 1] ? segStart(i + 1) : TL.duration + 1);
  function drawPhoto(key, t, t0, t1, kb, alpha) {
    const im = photos[key]; if (!im || alpha <= 0) return;
    const p = clamp((t - t0) / Math.max(1, t1 - t0));
    const z = kb === "out" ? lerp(1.18, 1.05, ease.outCubic(p)) : lerp(1.05, 1.18, ease.inOutCubic(p));
    const sc = Math.max(W / im.width, H / im.height) * z;
    const fx = (D.focus && D.focus[key]) || [0.5, 0.35];
    const iw = im.width * sc, ih = im.height * sc;
    const dx = kb === "left" ? lerp(30, -30, p) : kb === "right" ? lerp(-30, 30, p) : 0;
    const x = clamp(W / 2 - iw * fx[0], W - iw, 0) + dx, y = clamp(H * 0.42 - ih * fx[1], H - ih, 0);
    if (D.inset && D.inset[key]) {   // low-res photo: blurred cover + sharp framed card
      g.save(); g.globalAlpha = alpha; g.filter = "blur(28px) brightness(0.6) saturate(1.2)"; g.drawImage(im, x - 40, y - 40, iw + 80, ih + 80); g.restore();
      const cw = 560, ch = cw * im.height / im.width, cy = 760 - ch / 2;
      const k = lerp(0.96, 1.04, p);
      g.save(); g.globalAlpha = alpha; g.translate(W / 2, cy + ch / 2); g.scale(k, k); g.rotate(-0.025);
      g.shadowColor = "rgba(0,0,0,0.6)"; g.shadowBlur = 40; g.fillStyle = "#fff"; g.fillRect(-cw / 2 - 14, -ch / 2 - 14, cw + 28, ch + 28);
      g.shadowBlur = 0; g.drawImage(im, -cw / 2, -ch / 2, cw, ch); g.restore();
      return;
    }
    g.save(); g.globalAlpha = alpha; g.filter = "saturate(1.08) contrast(1.08)"; g.drawImage(im, x, y, iw, ih); g.restore();
  }
  function grade() {
    const gr = g.createLinearGradient(0, 0, 0, H);
    gr.addColorStop(0, "rgba(0,0,0,0.6)"); gr.addColorStop(0.2, "rgba(0,0,0,0.1)");
    gr.addColorStop(0.5, "rgba(0,0,0,0.2)"); gr.addColorStop(0.72, "rgba(0,0,0,0.75)"); gr.addColorStop(1, "rgba(0,0,0,0.92)");
    g.fillStyle = gr; g.fillRect(0, 0, W, H);
  }

  // ------------------------------------------------------------ scoreboard
  function matchAt(t) {
    let m = null; segs().forEach((s, i) => { if (t >= segStart(i)) m = s.match || null; }); return m;
  }
  function score(mid, t) {
    let h = 0, a = 0, last = -1e9;
    D.goals.forEach((gl) => { if (gl.match === mid && t >= gl.t) { gl.team === "H" ? h++ : a++; last = Math.max(last, gl.t); } });
    return { h, a, last };
  }
  function scoreboard(t) {
    const mid = matchAt(t); if (!mid) return;
    const M = D.matches[mid];
    const first = segs().findIndex((s) => s.match === mid), t0 = segStart(first);
    let lastSeg = first; segs().forEach((s, i) => { if (s.match === mid) lastSeg = i; });
    const a = ease.outCubic(prog(t, t0, t0 + 0.4)) * (1 - prog(t, segEnd(lastSeg) - 0.25, segEnd(lastSeg)));
    if (a <= 0) return;
    const { h, a: aw, last } = score(mid, t);
    const pop = 1 + 0.35 * Math.max(0, Math.sin(clamp((t - last) / 0.45) * Math.PI)) * (t - last < 0.45 ? 1 : 0);
    g.save(); g.globalAlpha = a; g.translate(W / 2, 205 + (1 - a) * -40);
    g.shadowColor = "rgba(0,0,0,0.5)"; g.shadowBlur = 24;
    g.fillStyle = "rgba(10,12,18,0.92)"; g.beginPath(); g.roundRect(-400, -56, 800, 112, 22); g.fill(); g.shadowBlur = 0;
    g.fillStyle = M.home.color; g.beginPath(); g.roundRect(-400, -56, 260, 112, [22, 0, 0, 22]); g.fill();
    g.fillStyle = M.away.color; g.beginPath(); g.roundRect(140, -56, 260, 112, [0, 22, 22, 0]); g.fill();
    g.fillStyle = M.home.color2 || "#ffffff"; g.fillRect(-400, 46, 260, 10);
    g.fillStyle = M.away.color2 || "#ffffff"; g.fillRect(140, 46, 260, 10);
    txt(M.home.code, -270, 0, F.d(64), "#ffffff", "center", 4);
    txt(M.away.code, 270, 0, F.d(64), "#ffffff", "center", 4);
    g.save(); g.scale(pop, pop); txt(`${h} - ${aw}`, 0, 4, F.d(84), "#ffffff", "center", 2); g.restore();
    // venue / status strip
    g.fillStyle = "rgba(10,12,18,0.85)"; g.beginPath(); g.roundRect(-210, 62, 420, 46, [0, 0, 16, 16]); g.fill();
    txt(M.label, 0, 86, F.m(26), hexA("#ffffff", 0.85));
    g.restore();
    // scorer log (under each side)
    g.save(); g.globalAlpha = a;
    let ih = 0, ia = 0;
    D.goals.forEach((gl) => {
      if (gl.match !== mid || t < gl.t) return;
      const p = ease.outCubic(prog(t, gl.t + 0.3, gl.t + 0.7)); if (p <= 0) return;
      const line = `${gl.en}${gl.min ? " " + gl.min : ""}`;
      const home = gl.team === "H", k = home ? ih++ : ia++, y = 352 + k * 44;
      g.save(); g.globalAlpha *= p; g.translate((1 - p) * (home ? -30 : 30), 0);
      stxt(line, home ? 140 : W - 140, y, F.m(30), "#ffffff", home ? "left" : "right");
      g.restore();
    });
    g.restore();
  }

  // ------------------------------------------------------------ goal burst + scorer card
  function goalFx(t) {
    D.goals.forEach((gl) => {
      const p = (t - gl.t) / 1.1;
      if (p >= 0 && p < 1) {
        const M = D.matches[gl.match], col = gl.team === "H" ? M.home.color : M.away.color;
        // radial burst
        g.save(); g.translate(W / 2, 820); g.globalAlpha = 1 - p;
        for (let k = 0; k < 16; k++) {
          const a = (k / 16) * Math.PI * 2 + gl.t, r0 = 120 + p * 380, r1 = r0 + 90 * (1 - p);
          g.strokeStyle = k % 2 ? YEL : "#ffffff"; g.lineWidth = 10 * (1 - p) + 2;
          g.beginPath(); g.moveTo(Math.cos(a) * r0, Math.sin(a) * r0); g.lineTo(Math.cos(a) * r1, Math.sin(a) * r1); g.stroke();
        }
        const k2 = ease.outBack(clamp(p * 4), 2.2) * (1 - prog(p, 0.75, 1));
        g.rotate(-0.06); g.scale(k2, k2);
        g.fillStyle = col; g.beginPath(); g.roundRect(-300, -95, 600, 190, 30); g.fill();
        g.lineWidth = 10; g.strokeStyle = "#ffffff"; g.stroke();
        txt(gl.big || "GOAL!", 0, 6, F.d(gl.big ? 120 : 140), "#ffffff", "center", 6);
        g.restore();
      }
    });
  }
  function scorerCard(t) {
    let cur = null;
    D.goals.forEach((gl) => { if (t >= gl.t + 0.25) cur = gl; });
    if (!cur) return;
    // card lives until the next goal or the end of its line
    const nxt = D.goals.find((gl) => gl.t > cur.t);
    const end = Math.min(nxt ? nxt.t + 0.25 : 1e9, C[cur.cue].end + 0.6);
    const pin = ease.outBack(prog(t, cur.t + 0.25, cur.t + 0.65), 1.6), out = prog(t, end - 0.25, end);
    if (pin <= 0 || out >= 1) return;
    const M = D.matches[cur.match], col = cur.team === "H" ? M.home.color : M.away.color;
    g.save(); g.globalAlpha = (1 - out) * clamp(pin * 2); g.translate((1 - pin) * -120, 0);
    const y = 1270;
    g.fillStyle = "rgba(10,12,18,0.9)"; g.beginPath(); g.roundRect(70, y - 95, 940, 190, 26); g.fill();
    g.fillStyle = col; g.beginPath(); g.roundRect(70, y - 95, 22, 190, [26, 0, 0, 26]); g.fill();
    const fs = fit(cur.th, F.b, 68, 640);
    txt(cur.th, 130, y - 22, F.b(fs), "#ffffff", "left");
    txt(cur.en.toUpperCase() + (cur.note ? "  ·  " + cur.note : ""), 132, y + 50, F.d(32), hexA("#ffffff", 0.75), "left", 2);
    if (cur.min) {
      g.fillStyle = YEL; g.beginPath(); g.roundRect(800, y - 50, 180, 100, 20); g.fill();
      txt(cur.min, 890, y + 3, F.d(fit(cur.min, F.d, 58, 160)), INK);
    }
    g.restore();
  }

  // ------------------------------------------------------------ special beats
  function hook(t) {
    const end = C.mu1.start - 0.3, a = 1 - prog(t, end - 0.25, end); if (a <= 0) return;
    const p0 = ease.outBack(prog(t, MK("hook", 0) - 0.1, MK("hook", 0) + 0.35), 2.4);
    const p1 = ease.outCubic(prog(t, MK("hook", 1) - 0.1, MK("hook", 1) + 0.35));
    const p2 = ease.outBack(prog(t, MK("hook", 2) - 0.1, MK("hook", 2) + 0.4), 2);
    const shake = Math.max(0, 1 - (t - MK("hook", 0)) / 0.4) * (t > MK("hook", 0) ? 14 : 0);
    g.save(); g.globalAlpha = a; g.translate(Math.sin(t * 90) * shake, Math.cos(t * 77) * shake);
    if (p0 > 0) {
      g.save(); g.translate(W / 2, 700); g.scale(p0, p0);
      outlined("4 - 4", 0, 0, F.d(300), "#ffffff", 22);
      g.restore();
      // 8 balls
      for (let k = 0; k < 8; k++) {
        const pk = ease.outBack(prog(t, MK("hook", 0) + 0.15 + k * 0.07, MK("hook", 0) + 0.45 + k * 0.07), 2.5);
        if (pk <= 0) continue;
        const x = W / 2 + (k - 3.5) * 104, y = 910;
        g.save(); g.translate(x, y); g.scale(pk, pk); g.rotate(t * 2 + k);
        g.fillStyle = "#ffffff"; g.beginPath(); g.arc(0, 0, 38, 0, Math.PI * 2); g.fill();
        g.lineWidth = 5; g.strokeStyle = INK; g.stroke();
        g.fillStyle = INK; g.beginPath();
        for (let j = 0; j < 5; j++) { const a2 = (j / 5) * Math.PI * 2 - Math.PI / 2; g.lineTo(Math.cos(a2) * 14, Math.sin(a2) * 14); }
        g.fill(); g.restore();
      }
    }
    if (p1 > 0) { g.save(); g.globalAlpha *= p1; outlined("โดนนำ 2 ลูก ถึง 2 ครั้ง", W / 2, 1070, F.b(66), "#ffffff", 12); g.restore(); }
    if (p2 > 0) { g.save(); g.translate(W / 2, 1185); g.rotate(-0.04); g.scale(p2, p2); outlined("แต่แมนยู ยังไม่ตาย!", 0, 0, F.b(96), YEL, 16); g.restore(); }
    g.restore();
  }

  function stoppageClock(t) {   // mu4 mark 2: "ทดเจ็บนาทีที่หก ลูกเตะมุมลูกสุดท้าย"
    const t0 = MK("mu4", 2) - 0.1, t1 = MK("mu4", 3) + 0.1;
    const p = ease.outBack(prog(t, t0, t0 + 0.35), 2), a = 1 - prog(t, t1 - 0.15, t1);
    if (p <= 0 || a <= 0) return;
    g.save(); g.globalAlpha = a; g.translate(W / 2, 830); g.scale(p, p);
    const pulse = 1 + 0.05 * Math.sin(t * 14);
    g.scale(pulse, pulse);
    g.fillStyle = "#e01f2d"; g.beginPath(); g.roundRect(-230, -90, 460, 180, 30); g.fill();
    g.lineWidth = 10; g.strokeStyle = "#ffffff"; g.stroke();
    txt("90+6'", 0, 6, F.d(130), "#ffffff", "center", 2);
    g.restore();
    g.save(); g.globalAlpha = a * p; outlined("ลูกเตะมุม ลูกสุดท้าย!", W / 2, 1010, F.b(64), YEL, 12); g.restore();
  }

  function ladder(t) {   // mu5: relegation zone (only Man Utd's position is shown — other rows are left blank)
    const t0 = MK("mu5", 1) - 0.2, end = C.lfc1.start - 0.3;
    const a = ease.outCubic(prog(t, t0, t0 + 0.4)) * (1 - prog(t, end - 0.25, end));
    if (a <= 0) return;
    g.save(); g.globalAlpha = a;
    const x = 140, w = 800, y0 = 640, rh = 92;
    stxt("ตารางคะแนน พรีเมียร์ลีก", W / 2, y0 - 70, F.b(52), "#ffffff");
    for (let k = 0; k < 6; k++) {
      const pos = 15 + k, y = y0 + k * rh, rz = pos >= 18, mu = pos === 18;
      const pk = ease.outCubic(prog(t, t0 + 0.08 * k, t0 + 0.08 * k + 0.35));
      g.save(); g.globalAlpha *= pk; g.translate((1 - pk) * 60, 0);
      g.fillStyle = mu ? "#da291c" : rz ? "rgba(120,20,30,0.75)" : "rgba(12,14,20,0.8)";
      g.beginPath(); g.roundRect(x, y, w, rh - 12, 16); g.fill();
      txt(String(pos), x + 60, y + (rh - 12) / 2 + 2, F.d(48), "#ffffff");
      if (mu) txt("แมนยู", x + 140, y + (rh - 12) / 2 + 2, F.b(50), "#ffffff", "left");
      else { g.fillStyle = "rgba(255,255,255,0.18)"; g.beginPath(); g.roundRect(x + 140, y + 30, 260, 20, 10); g.fill(); }
      g.restore();
    }
    const zp = ease.outBack(prog(t, t0 + 0.6, t0 + 1.0), 2);
    if (zp > 0) {
      g.save(); g.translate(x + w - 150, y0 + 3 * rh + rh * 1.4); g.rotate(-0.08); g.scale(zp, zp);
      g.fillStyle = YEL; g.beginPath(); g.roundRect(-130, -38, 260, 76, 18); g.fill();
      txt("โซนตกชั้น", 0, 2, F.b(44), INK);
      g.restore();
    }
    g.restore();
  }

  function badges(t) {   // lfc2: top 4 + bottom
    const end = C.cta.start - 0.3, out = 1 - prog(t, end - 0.25, end);
    [["lfc2", 1, "ขึ้นท็อป 4", "#c8102e", W - 290], ["lfc2", 2, "จมบ๊วย", "#1b458f", 290]].forEach(([cue, m, s, col, x]) => {
      const p = ease.outBack(prog(t, MK(cue, m) - 0.1, MK(cue, m) + 0.35), 2.2);
      if (p <= 0 || out <= 0) return;
      g.save(); g.globalAlpha = out; g.translate(x, 900); g.rotate(x > W / 2 ? 0.06 : -0.06); g.scale(p, p);
      g.fillStyle = col; g.beginPath(); g.roundRect(-190, -56, 380, 112, 24); g.fill();
      g.lineWidth = 8; g.strokeStyle = "#ffffff"; g.stroke();
      txt(s, 0, 4, F.b(58), "#ffffff");
      g.restore();
    });
  }

  function poll(t) {
    const p0 = ease.outCubic(prog(t, MK("cta", 0) - 0.2, MK("cta", 0) + 0.3));
    const p1 = ease.outBack(prog(t, MK("cta", 1) - 0.1, MK("cta", 1) + 0.4), 2);
    if (p0 <= 0) return;
    g.save();
    g.save(); g.globalAlpha = p0; outlined("แมนยูจะรอดตกชั้นไหม?", W / 2, 900, F.b(84), "#ffffff", 16); g.restore();
    [["รอด", 300, "#1fae5b"], ["ไม่รอด", 780, "#e01f2d"]].forEach(([s, x, col], k) => {
      const kk = p1 * (1 + 0.05 * Math.sin(t * 7 + k * 2)); if (kk <= 0) return;
      g.save(); g.translate(x, 1110); g.scale(kk, kk);
      g.shadowColor = col; g.shadowBlur = 40; g.fillStyle = col; g.beginPath(); g.roundRect(-190, -90, 380, 180, 40); g.fill();
      g.shadowBlur = 0; g.lineWidth = 8; g.strokeStyle = "#ffffff"; g.stroke();
      txt(s, 0, 6, F.b(84), "#ffffff");
      g.restore();
    });
    g.save(); g.globalAlpha = clamp(p1); outlined("คอมเมนต์บอกกันหน่อย", W / 2, 1290, F.b(56), YEL, 12); g.restore();
    g.restore();
  }

  function credit(t) {
    let cur = 0; segs().forEach((s, i) => { if (t >= segStart(i)) cur = i; });
    const s = segs()[cur];
    let key = s.img; (s.swaps || []).forEach((w) => { if (t >= MK(s.cue, w.mark) + (w.delay || 0) - 0.15) key = w.img; });
    const c = credits[key]; if (!c) return;
    const a = prog(t, segStart(cur) + 0.3, segStart(cur) + 0.6) * (1 - prog(t, segEnd(cur) - 0.3, segEnd(cur)));
    g.save(); g.globalAlpha = a * 0.8;
    txt(`ภาพ: ${c.author} (${c.year}) · ${c.license} · Wikimedia Commons`, 60, 96, F.m(22), "#ffffff", "left");
    g.restore();
  }

  function captions(t) {
    let seg = null;
    for (const k of Object.keys(C)) {
      const c = C[k];
      c.parts.forEach((p, i) => {
        const s = i === 0 ? c.start - 0.05 : c.marks[i - 1];
        const e = i < c.parts.length - 1 ? c.marks[i] : c.end + 0.25;
        if (t >= s && t < e) seg = { p, s, e };
      });
    }
    if (!seg) return;
    let p = seg.p; (D.capfix || []).forEach(([a, b]) => (p = p.split(a).join(b)));
    const a = prog(t, seg.s, seg.s + 0.1) * (1 - prog(t, seg.e - 0.08, seg.e));
    g.font = F.b(48);
    const words = p.split(" "), lines = [""];
    for (const w of words) { const tt = (lines[lines.length - 1] + " " + w).trim(); if (g.measureText(tt).width > 940 && lines[lines.length - 1]) lines.push(w); else lines[lines.length - 1] = tt; }
    g.save(); g.globalAlpha = a;
    lines.slice(0, 2).forEach((l, i) => outlined(l, W / 2, 1530 + i * 66 - (lines.length > 1 ? 33 : 0), F.b(48), "#ffffff", 11));
    g.restore();
  }

  function draw(t) {
    g.setTransform(1, 0, 0, 1, 0, 0); g.globalAlpha = 1; g.filter = "none";
    g.fillStyle = "#000"; g.fillRect(0, 0, W, H);
    segs().forEach((s, i) => {
      const t0 = segStart(i), t1 = segEnd(i);
      if (t < t0 - 0.1 || t > t1 + 0.5) return;
      const a0 = i === 0 ? 1 : ease.outCubic(prog(t, t0, t0 + 0.3));
      const shots = [{ img: s.img, t: t0 }].concat((s.swaps || []).map((w) => ({ img: w.img, t: MK(s.cue, w.mark) + (w.delay || 0) - 0.15 })));
      shots.forEach((sh, k) => {
        const nx = shots[k + 1] ? shots[k + 1].t : 1e9;
        if (t < sh.t - 0.05 || t > nx + 0.35) return;
        const a = k === 0 ? a0 : ease.outCubic(prog(t, sh.t, sh.t + 0.3));
        drawPhoto(sh.img, t, sh.t, Math.min(nx, t1) + 0.5, k % 2 ? "out" : s.kb || "in", a);
      });
    });
    grade();
    // white flash on goals
    D.goals.forEach((gl) => { const f = 1 - prog(t, gl.t, gl.t + 0.2); if (t >= gl.t && f > 0) { g.fillStyle = `rgba(255,255,255,${0.4 * f})`; g.fillRect(0, 0, W, H); } });
    credit(t);
    scoreboard(t); hook(t); stoppageClock(t); ladder(t); badges(t);
    goalFx(t); scorerCard(t); poll(t); captions(t);
    if (D.end_credits) {
      const e = prog(t, TL.duration - 2.3, TL.duration - 1.9);
      if (e > 0) {
        g.save(); g.globalAlpha = e; g.fillStyle = "rgba(0,0,0,0.7)"; g.fillRect(0, 1660, W, 200);
        D.end_credits.forEach((l, i) => txt(l, W / 2, 1700 + i * 36, F.m(24), hexA("#ffffff", 0.85)));
        g.restore();
      }
    }
    g.save(); g.globalCompositeOperation = "overlay"; g.fillStyle = g.createPattern(grain, "repeat");
    g.translate((t * 97) % 256, (t * 53) % 256); g.fillRect(-256, -256, W + 512, H + 512); g.restore();
    const fin = Math.max(prog(t, TL.duration - 0.6, TL.duration - 0.05), 1 - prog(t, 0, 0.3));
    if (fin > 0) { g.fillStyle = `rgba(0,0,0,${fin})`; g.fillRect(0, 0, W, H); }
  }

  function events() {
    return {
      pen: [], goals: D.goals.map((gl) => ({ t: gl.t, big: !!gl.big })), cuts: segs().map((_, i) => segStart(i)).slice(1),
      hook: MK("hook", 0), clock: MK("mu4", 2), lfc: C.lfc1.start, cta: C.cta.start, mu5: MK("mu5", 1),
    };
  }
  window.scene = { setup, preload, draw, events };
})();
