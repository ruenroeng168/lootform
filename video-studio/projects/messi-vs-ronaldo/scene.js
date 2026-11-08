// Versus stat battle: split-screen photos (Messi left / Ronaldo right), round title, count-up numbers,
// centre-out comparison bars, winner glow + check, running scoreboard, summary and M/R comment CTA.
// Cue marks per round line: |1 Messi number |2 Ronaldo number |3 winner.
(function () {
  const { clamp, lerp, prog, ease, rng, hexA } = window.L;
  const W = 1080, H = 1920, PANE_H = 1330;
  const F = { b: (s) => `700 ${s}px "IBM Plex Sans Thai"`, m: (s) => `600 ${s}px "IBM Plex Sans Thai"`, d: (s) => `700 ${s}px "Chakra Petch"` };
  let g, TL, C, D, CM, CR, GOLD, photos = {}, credits = {}, grain, segs = [];

  const MK = (k, i) => (C[k] ? (i === 0 ? C[k].start : C[k].marks[i - 1] ?? C[k].end) : 1e9);

  function setup(canvas, tl) {
    g = canvas.getContext("2d"); TL = tl; C = tl.cues; D = tl.data || {};
    CM = D.colorM || "#6cc4f0"; CR = D.colorR || "#e0283c"; GOLD = D.gold || "#f2c14e";
    (D.credits || []).forEach((c) => (credits[c.key] = c));
    segs = [{ cue: "hook", ...D.hook }, ...D.rounds, { cue: "summary", ...D.end }];
    grain = document.createElement("canvas"); grain.width = grain.height = 256;
    const gg = grain.getContext("2d"), r = rng(5), id = gg.createImageData(256, 256);
    for (let i = 0; i < id.data.length; i += 4) { const v = 128 + (r() - 0.5) * 90; id.data[i] = id.data[i + 1] = id.data[i + 2] = v; id.data[i + 3] = 20; }
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
  function stxt(s, x, y, font, color, align = "center", ls = 0, blur = 22) {
    g.save(); g.shadowColor = "rgba(0,0,0,0.7)"; g.shadowBlur = blur; g.shadowOffsetY = 4; txt(s, x, y, font, color, align, ls); g.restore();
  }
  function glowTxt(s, x, y, font, color, glow, align = "center") {
    g.save(); g.shadowColor = glow; g.shadowBlur = 40; txt(s, x, y, font, color, align); g.shadowBlur = 14; txt(s, x, y, font, color, align); g.restore();
  }
  function fit(s, font, size, maxW) { g.font = font(size); const w = g.measureText(s).width; return w > maxW ? Math.floor(size * maxW / w) : size; }

  const segStart = (i) => (i === 0 ? -1 : C[segs[i].cue].start - 0.35);
  const segEnd = (i) => (segs[i + 1] ? segStart(i + 1) : TL.duration + 1);
  function curSeg(t) { let c = 0; segs.forEach((s, i) => { if (t >= segStart(i)) c = i; }); return c; }

  // pane polygon: slanted divider from (566,0) to (514,PANE_H)
  function panePath(side, off) {
    g.beginPath();
    if (side === "M") { g.moveTo(0, 0); g.lineTo(566 + off, 0); g.lineTo(514 + off, PANE_H); g.lineTo(0, PANE_H); }
    else { g.moveTo(566 - off, 0); g.lineTo(W, 0); g.lineTo(W, PANE_H); g.lineTo(514 - off, PANE_H); }
    g.closePath();
  }
  function drawPane(side, key, t, t0, t1, slide, dim, lit) {
    const im = photos[key]; if (!im) return;
    const cx = side === "M" ? 280 : 800, pw = 600, ph = PANE_H;
    const p = clamp((t - t0) / Math.max(1, t1 - t0));
    const z = lerp(1.03, 1.13, ease.inOutCubic(p));
    const sc = Math.max(pw / im.width, ph / im.height) * z;
    const fx = (D.focus && D.focus[key]) || [0.5, 0.35];
    const iw = im.width * sc, ih = im.height * sc;
    const dir = side === "M" ? -1 : 1;
    const x = clamp(cx - iw * fx[0], cx + pw / 2 - iw, cx - pw / 2) + dir * (1 - slide) * 620;
    const y = clamp(ph * 0.4 - ih * fx[1], ph - ih, 0);
    g.save(); panePath(side, 0); g.clip();
    g.filter = `saturate(${lerp(0.95, 0.25, dim)}) brightness(${lerp(1, 0.45, dim) + lit * 0.12}) contrast(1.06)`;
    g.drawImage(im, x, y, iw, ih); g.filter = "none";
    // team tint at the bottom of each pane
    const col = side === "M" ? CM : CR;
    const gr = g.createLinearGradient(0, PANE_H * 0.55, 0, PANE_H);
    gr.addColorStop(0, hexA(col, 0)); gr.addColorStop(1, hexA(col, 0.35));
    g.fillStyle = gr; g.fillRect(0, 0, W, PANE_H);
    if (lit > 0) { g.strokeStyle = hexA(GOLD, 0.9 * lit); g.lineWidth = 14; panePath(side, 0); g.stroke(); }
    g.restore();
  }

  function scoreAt(t) {
    let m = 0, r = 0, last = -1e9;
    D.rounds.forEach((rd) => { const tw = MK(rd.cue, 3); if (t >= tw) { rd.win === "M" ? m++ : r++; last = Math.max(last, tw); } });
    return { m, r, last };
  }

  function scoreboard(t, a) {
    if (a <= 0) return;
    const { m, r, last } = scoreAt(t);
    const pop = 1 + 0.18 * Math.max(0, 1 - (t - last) / 0.5) * Math.sin(clamp((t - last) / 0.5) * Math.PI);
    g.save(); g.globalAlpha = a; g.translate(W / 2, 212);
    g.fillStyle = "rgba(8,10,16,0.82)"; g.beginPath(); g.roundRect(-330, -58, 660, 116, 58); g.fill();
    g.fillStyle = CM; g.beginPath(); g.roundRect(-330, -58, 180, 116, [58, 0, 0, 58]); g.fill();
    g.fillStyle = CR; g.beginPath(); g.roundRect(150, -58, 180, 116, [0, 58, 58, 0]); g.fill();
    txt("MESSI", -240, 2, F.d(40), "#0b1a2a", "center", 2);
    txt("RONALDO", 240, 2, F.d(36), "#ffffff", "center", 1);
    g.save(); g.scale(pop, pop); txt(`${m} : ${r}`, 0, 4, F.d(76), "#ffffff", "center", 4); g.restore();
    g.restore();
  }

  function credit(t, a, s) {
    if (a <= 0) return;
    const line = (k) => { const c = credits[k]; return c ? `${c.author} (${c.year}) · ${c.license}` : ""; };
    g.save(); g.globalAlpha = a * 0.8;
    txt(`ภาพซ้าย: ${line(s.imgM)}`, 60, 92, F.m(22), "#ffffff", "left");
    txt(`ภาพขวา: ${line(s.imgR)} · Wikimedia Commons`, 60, 120, F.m(22), "#ffffff", "left");
    g.restore();
  }

  function nameTags(t, a) {
    if (a <= 0) return;
    g.save(); g.globalAlpha = a;
    stxt("เมสซี่", 60, 850, F.b(64), "#ffffff", "left"); g.fillStyle = CM; g.fillRect(62, 895, 120, 8);
    stxt("โรนัลโด้", W - 60, 850, F.b(64), "#ffffff", "right"); g.fillStyle = CR; g.fillRect(W - 182, 895, 120, 8);
    g.restore();
  }

  function vsBadge(t, size, a) {
    if (a <= 0) return;
    g.save(); g.globalAlpha = a; g.translate(540, 640);
    const k = size * (1 + 0.04 * Math.sin(t * 6));
    g.scale(k, k); g.rotate(-0.08);
    g.fillStyle = GOLD; g.beginPath(); g.arc(0, 0, 92, 0, Math.PI * 2); g.fill();
    g.lineWidth = 10; g.strokeStyle = "#0b0d14"; g.stroke();
    txt("VS", 0, 6, F.d(96), "#0b0d14", "center", 2);
    g.restore();
  }

  function roundTitle(rd, t, a) {
    const t0 = MK(rd.cue, 0) - 0.2, p = ease.outBack(prog(t, t0, t0 + 0.45), 1.4);
    if (p <= 0 || a <= 0) return;
    g.save(); g.globalAlpha = a * clamp(p * 2); g.translate(W / 2, 1020); g.scale(lerp(0.6, 1, p), lerp(0.6, 1, p));
    const label = rd.n === 6 ? "ยกสุดท้าย" : `ยกที่ ${rd.n}`;
    g.font = F.b(40); const lw = g.measureText(label).width + 56;
    g.fillStyle = GOLD; g.beginPath(); g.roundRect(-lw / 2, -118, lw, 64, 32); g.fill();
    txt(label, 0, -84, F.b(40), "#0b0d14");
    stxt(rd.title, 0, 0, F.b(fit(rd.title, F.b, 84, 900)), "#ffffff");
    g.restore();
  }

  function numberSide(rd, side, t, a) {
    const tm = MK(rd.cue, side === "M" ? 1 : 2), tw = MK(rd.cue, 3);
    const p = prog(t, tm - 0.05, tm + 0.35); if (p <= 0) return;
    const v = side === "M" ? rd.m : rd.r, col = side === "M" ? CM : CR, x = side === "M" ? 270 : 810;
    const won = rd.win === side, wp = prog(t, tw, tw + 0.4);
    const val = Math.round(lerp(0, v, ease.outExpo(prog(t, tm, tm + 0.9))));
    const k = ease.outBack(p, 1.8) * (1 + (won ? 0.12 : -0.08) * wp);
    g.save(); g.globalAlpha = a * clamp(p * 2) * (won ? 1 : lerp(1, 0.55, wp)); g.translate(x, 1250); g.scale(k, k);
    if (won && wp > 0) glowTxt(String(val), 0, 0, F.d(170), "#ffffff", hexA(GOLD, wp));
    else stxt(String(val), 0, 0, F.d(170), "#ffffff");
    txt(rd.unit, 0, 102, F.b(40), col);
    g.restore();
    if (won && wp > 0) {   // winner chip
      const c = ease.outBack(wp, 2);
      g.save(); g.globalAlpha = a * clamp(wp * 2); g.translate(x, 1128); g.scale(c, c);
      g.fillStyle = GOLD; g.beginPath(); g.roundRect(-108, -32, 216, 64, 32); g.fill();
      g.strokeStyle = "#0b0d14"; g.lineWidth = 8; g.lineCap = "round"; g.lineJoin = "round";
      g.beginPath(); g.moveTo(-78, 0); g.lineTo(-62, 16); g.lineTo(-34, -14); g.stroke();
      txt("ชนะ", 26, 2, F.b(38), "#0b0d14");
      g.restore();
    }
  }

  function bars(rd, t, a) {
    const max = Math.max(rd.m, rd.r), y = 1430;
    g.save(); g.globalAlpha = a;
    g.fillStyle = "rgba(255,255,255,0.12)"; g.beginPath(); g.roundRect(100, y - 17, 880, 34, 17); g.fill();
    [["M", rd.m, CM, -1, 1], ["R", rd.r, CR, 1, 2]].forEach(([s, v, col, dir, mi]) => {
      const tm = MK(rd.cue, mi), len = 430 * (v / max) * ease.outExpo(prog(t, tm, tm + 0.9));
      if (len <= 0) return;
      g.fillStyle = col; g.beginPath();
      dir < 0 ? g.roundRect(540 - len, y - 17, len, 34, [17, 0, 0, 17]) : g.roundRect(540, y - 17, len, 34, [0, 17, 17, 0]); g.fill();
    });
    g.fillStyle = "#ffffff"; g.fillRect(537, y - 26, 6, 52);
    g.restore();
  }

  function listSide(rd, side, t, a) {
    const tm = MK(rd.cue, side === "M" ? 1 : 2), tw = MK(rd.cue, 3);
    const items = side === "M" ? rd.listM : rd.listR, x = side === "M" ? 270 : 810, col = side === "M" ? CM : CR;
    items.forEach((it, j) => {
      const ts = tm + j * 0.45, p = ease.outBack(prog(t, ts, ts + 0.4), 1.6);
      if (p <= 0) return;
      const hl = side === rd.win && it.includes(rd.winText) ? prog(t, tw, tw + 0.4) : 0;
      const lose = side !== rd.win ? prog(t, tw, tw + 0.4) : 0;
      g.save(); g.globalAlpha = a * clamp(p * 2) * lerp(1, 0.6, lose); g.translate(x, 1175 + j * 110); g.scale(lerp(0.7, 1, p) * (1 + 0.1 * hl), lerp(0.7, 1, p) * (1 + 0.1 * hl));
      g.fillStyle = hl ? hexA(GOLD, 0.25 + 0.75 * hl) : "rgba(8,10,16,0.75)";
      if (hl) { g.shadowColor = GOLD; g.shadowBlur = 40 * hl; }
      g.beginPath(); g.roundRect(-235, -44, 470, 88, 22); g.fill(); g.shadowBlur = 0;
      g.fillStyle = col; g.fillRect(-235, -44, 10, 88);
      txt(it, 6, 2, F.b(fit(it, F.b, 46, 420)), hl > 0.5 ? "#0b0d14" : "#ffffff");
      g.restore();
    });
    if (side === rd.win) {
      const wp = prog(t, tw + 0.3, tw + 0.8);
      if (wp > 0) {
        g.save(); g.globalAlpha = a * wp; glowTxt("ฟุตบอลโลก มีแค่เมสซี่", W / 2, 1420, F.b(58), GOLD, hexA(GOLD, 0.7)); g.restore();
      }
    }
  }

  function roundStats(rd, t, a) {
    if (rd.listM) { listSide(rd, "M", t, a); listSide(rd, "R", t, a); }
    else { numberSide(rd, "M", t, a); numberSide(rd, "R", t, a); bars(rd, t, a); }
    if (rd.note) {
      g.save(); g.globalAlpha = a * 0.75 * prog(t, MK(rd.cue, 1), MK(rd.cue, 1) + 0.5);
      txt(rd.note, W / 2, 1488, F.m(fit(rd.note, F.m, 26, 940)), "#ffffff"); g.restore();
    }
  }

  function hookText(t, a) {
    if (a <= 0) return;
    const p0 = ease.outCubic(prog(t, MK("hook", 0) - 0.2, MK("hook", 0) + 0.4));
    const p1 = ease.outBack(prog(t, MK("hook", 1) - 0.1, MK("hook", 1) + 0.4), 1.6);
    const p2 = ease.outCubic(prog(t, MK("hook", 2) - 0.1, MK("hook", 2) + 0.4));
    g.save(); g.globalAlpha = a;
    g.save(); g.globalAlpha *= p0; stxt("อำลาทีมชาติปี 2026 ทั้งคู่", W / 2, 1070, F.b(56), "#ffffff"); g.restore();
    if (p1 > 0) { g.save(); g.translate(W / 2, 1225); g.scale(p1, p1); glowTxt("ใครแน่กว่ากัน?", 0, 0, F.b(120), GOLD, hexA(GOLD, 0.6)); g.restore(); }
    if (p2 > 0) {
      g.save(); g.globalAlpha *= p2; g.translate(0, (1 - p2) * 30);
      g.fillStyle = "rgba(8,10,16,0.8)"; g.beginPath(); g.roundRect(190, 1352, 700, 86, 43); g.fill();
      txt("เทียบตัวเลขล้วน ๆ · 6 ยก", W / 2, 1396, F.b(48), "#ffffff"); g.restore();
    }
    g.restore();
  }

  function summaryText(t, a) {
    if (a <= 0) return;
    const p0 = ease.outBack(prog(t, MK("summary", 0) - 0.1, MK("summary", 0) + 0.5), 1.4);
    const p1 = ease.outCubic(prog(t, MK("summary", 1), MK("summary", 1) + 0.5));
    const p2 = ease.outCubic(prog(t, MK("summary", 2), MK("summary", 2) + 0.5));
    const { m, r } = scoreAt(t);
    g.save(); g.globalAlpha = a;
    g.save(); g.globalAlpha *= clamp(p0 * 2); stxt("สรุปตามตัวเลข", W / 2, 1010, F.b(56), GOLD); g.restore();
    if (p0 > 0) {
      g.save(); g.translate(W / 2, 1190); g.scale(p0, p0);
      g.fillStyle = "rgba(8,10,16,0.85)"; g.beginPath(); g.roundRect(-420, -110, 840, 220, 40); g.fill();
      txt(String(m), -240, 0, F.d(190), CM); txt(":", 0, -6, F.d(150), "#ffffff"); txt(String(r), 240, 0, F.d(190), CR);
      g.restore();
    }
    g.save(); g.globalAlpha *= p1; stxt("โรนัลโด้ 4 ยก · เมสซี่ 2 ยก", W / 2, 1360, F.b(50), "#ffffff"); g.restore();
    g.save(); g.globalAlpha *= p2; glowTxt("แต่ตัวเลข...บอกได้ไม่หมด", W / 2, 1450, F.b(56), GOLD, hexA(GOLD, 0.5)); g.restore();
    g.restore();
  }

  function ctaCard(t, a) {
    if (a <= 0) return;
    const p0 = ease.outCubic(prog(t, MK("cta", 0) - 0.2, MK("cta", 0) + 0.4));
    const p1 = ease.outBack(prog(t, MK("cta", 1) - 0.1, MK("cta", 1) + 0.45), 1.8);
    g.save(); g.globalAlpha = a;
    g.save(); g.globalAlpha *= p0; stxt("สำหรับคุณ ใครคือที่สุด?", W / 2, 1040, F.b(70), "#ffffff"); g.restore();
    [["M", 300, CM, "#0b1a2a", 0], ["R", 780, CR, "#ffffff", 0.5]].forEach(([l, x, col, fg, ph]) => {
      const k = p1 * (1 + 0.05 * Math.sin((t + ph) * 7));
      if (k <= 0) return;
      g.save(); g.translate(x, 1230); g.scale(k, k);
      g.shadowColor = col; g.shadowBlur = 50; g.fillStyle = col; g.beginPath(); g.roundRect(-150, -110, 300, 220, 44); g.fill();
      g.shadowBlur = 0; txt(l, 0, 8, F.d(170), fg);
      g.restore();
    });
    g.save(); g.globalAlpha *= clamp(p1); stxt("คอมเมนต์ M หรือ R", W / 2, 1420, F.b(60), GOLD); g.restore();
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
    const a = prog(t, seg.s, seg.s + 0.12) * (1 - prog(t, seg.e - 0.1, seg.e));
    const fs = fit(p, F.b, 46, 940);
    g.save(); g.globalAlpha = a; g.font = F.b(fs);
    const w = g.measureText(p).width + 60;
    g.fillStyle = "rgba(0,0,0,0.55)"; g.beginPath(); g.roundRect(W / 2 - w / 2, 1572 - 40, w, 80, 20); g.fill();
    txt(p, W / 2, 1574, F.b(fs), "#ffffff");
    g.restore();
  }

  function draw(t) {
    g.setTransform(1, 0, 0, 1, 0, 0); g.globalAlpha = 1; g.filter = "none";
    g.fillStyle = "#07090f"; g.fillRect(0, 0, W, H);
    const ci = curSeg(t);
    // panes: previous segment stays under the incoming one
    [ci - 1, ci].forEach((i) => {
      if (i < 0) return;
      const s = segs[i], t0 = segStart(i), t1 = segEnd(i);
      const sl = i === 0 ? ease.outCubic(prog(t, 0.1, 0.9)) : ease.outCubic(prog(t, t0, t0 + 0.45));
      const rd = s.win ? s : null, tw = rd ? MK(rd.cue, 3) : 1e9, wp = prog(t, tw, tw + 0.4);
      ["M", "R"].forEach((side) => {
        const won = rd && rd.win === side;
        drawPane(side, side === "M" ? s.imgM : s.imgR, t, t0, t1 + 0.5, sl, rd && !won ? wp * 0.85 : 0, won ? wp : 0);
      });
    });
    // fade panes into the stat area
    const gr = g.createLinearGradient(0, 760, 0, PANE_H);
    gr.addColorStop(0, "rgba(7,9,15,0)"); gr.addColorStop(0.55, "rgba(7,9,15,0.75)"); gr.addColorStop(1, "rgba(7,9,15,1)");
    g.fillStyle = gr; g.fillRect(0, 760, W, PANE_H - 760 + 2);
    const top = g.createLinearGradient(0, 0, 0, 330);
    top.addColorStop(0, "rgba(0,0,0,0.65)"); top.addColorStop(1, "rgba(0,0,0,0)");
    g.fillStyle = top; g.fillRect(0, 0, W, 330);
    // divider
    g.save(); g.strokeStyle = "#ffffff"; g.lineWidth = 6; g.shadowColor = GOLD; g.shadowBlur = 20;
    g.beginPath(); g.moveTo(566, 0); g.lineTo(514, PANE_H); g.stroke(); g.restore();

    // flash on each cut
    segs.forEach((s, i) => { if (i > 0) { const f = 1 - prog(t, segStart(i), segStart(i) + 0.25); if (f < 1 && t >= segStart(i)) { g.fillStyle = `rgba(255,255,255,${0.35 * f})`; g.fillRect(0, 0, W, H); } } });

    const s = segs[ci], t0 = segStart(ci), t1 = segEnd(ci);
    const a = prog(t, t0 + 0.1, t0 + 0.4) * (1 - prog(t, t1 - 0.25, t1));
    const ctaOn = t >= C.cta.start - 0.35;
    nameTags(t, ctaOn ? 1 - prog(t, C.cta.start - 0.35, C.cta.start) : prog(t, 0.6, 1.1));
    vsBadge(t, ci === 0 ? lerp(0.4, 1.35, ease.outBack(prog(t, 0.5, 1.1), 2)) : 0.9, prog(t, 0.5, 0.8));
    scoreboard(t, prog(t, C.r1.start - 0.4, C.r1.start));
    credit(t, prog(t, t0 + 0.3, t0 + 0.7) * (1 - prog(t, t1 - 0.3, t1)), s);
    if (ci === 0) hookText(t, 1 - prog(t, t1 - 0.25, t1));
    else if (s.win) { roundTitle(s, t, a); roundStats(s, t, a); }
    else if (!ctaOn) summaryText(t, prog(t, t0 + 0.1, t0 + 0.4) * (1 - prog(t, C.cta.start - 0.4, C.cta.start - 0.1)));
    if (ctaOn) ctaCard(t, 1);
    captions(t);
    if (D.end_credits) {
      const e = prog(t, TL.duration - 2.4, TL.duration - 1.9);
      if (e > 0) {
        g.save(); g.globalAlpha = e; g.fillStyle = "rgba(0,0,0,0.7)"; g.fillRect(0, 1650, W, 210);
        D.end_credits.forEach((l, i) => txt(l, W / 2, 1690 + i * 36, F.m(24), hexA("#ffffff", 0.85)));
        g.restore();
      }
    }
    g.save(); g.globalCompositeOperation = "overlay"; g.fillStyle = g.createPattern(grain, "repeat");
    g.translate((t * 97) % 256, (t * 53) % 256); g.fillRect(-256, -256, W + 512, H + 512); g.restore();
    const fin = Math.max(prog(t, TL.duration - 0.8, TL.duration - 0.05), 1 - prog(t, 0, 0.35));
    if (fin > 0) { g.fillStyle = `rgba(0,0,0,${fin})`; g.fillRect(0, 0, W, H); }
  }

  function events() {
    const bells = D.rounds.map((r) => MK(r.cue, 0) - 0.2);
    const hits = []; D.rounds.forEach((r) => { hits.push(MK(r.cue, 1), MK(r.cue, 2)); });
    const wins = D.rounds.map((r) => MK(r.cue, 3));
    return { pen: [], bells, hits, wins, cuts: segs.map((_, i) => segStart(i)).slice(1), summary: C.summary.start, cta: C.cta.start, hook2: MK("hook", 1) };
  }
  window.scene = { setup, preload, draw, events };
})();
