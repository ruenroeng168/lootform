// "นาฬิกาของพ่อ" — emotional illustrated short story. 11 ink+watercolour panels (Canva) brought to life:
// slow Ken Burns, soft dissolves, flickering bulb glow, rain, phone vibration rings, the engraving revealed
// on the back of the watch, a hand-squeeze glow, title card, and a paper end card with the call-to-action.
(function () {
  const { clamp, lerp, prog, ease, rng, hexA } = window.L;
  const W = 1080, H = 1920, CREAM = "#f6ecd9", INKC = "#2b2118";
  const F = { b: (s) => `700 ${s}px "IBM Plex Sans Thai"`, m: (s) => `600 ${s}px "IBM Plex Sans Thai"`, h: (s) => `700 ${s}px "Mali"` };
  let g, TL, C, D, img = {}, grain;

  // per-scene camera: [zoomFrom, zoomTo, focus from [x,y], focus to [x,y]] in image pixels (1080x1920)
  const CAM = {
    s1: [1.18, 1.04, [520, 1000], [540, 900]],
    s2: [1.05, 1.15, [540, 960], [620, 860]],
    s3: [1.04, 1.16, [540, 900], [600, 1250]],
    s4: [1.12, 1.03, [380, 820], [460, 960]],
    s5: [1.04, 1.14, [560, 960], [760, 1000]],
    s6: [1.15, 1.04, [500, 1000], [540, 960]],
    s7: [1.04, 1.18, [540, 1000], [520, 1300]],
    s8: [1.08, 1.32, [520, 900], [430, 830]],
    s9: [1.12, 1.03, [420, 900], [540, 960]],
    s10: [1.04, 1.16, [540, 960], [640, 1060]],
    s11: [1.15, 1.04, [560, 900], [540, 960]],
  };
  const ORDER = ["s1", "s2", "s3", "s4", "s5", "s6", "s7", "s8", "s9", "s10", "s11", "end"];
  const MK = (k, i) => (i === 0 ? C[k].start : C[k].marks[i - 1] ?? C[k].end);
  const segStart = (k) => (k === "s1" ? -1 : C[k].start - 0.7);
  const segEnd = (k) => { const i = ORDER.indexOf(k); return ORDER[i + 1] ? segStart(ORDER[i + 1]) : TL.duration + 1; };

  function setup(canvas, tl) {
    g = canvas.getContext("2d"); TL = tl; C = tl.cues; D = tl.data;
    grain = document.createElement("canvas"); grain.width = grain.height = 256;
    const gg = grain.getContext("2d"), r = rng(21), id = gg.createImageData(256, 256);
    for (let i = 0; i < id.data.length; i += 4) { const v = 128 + (r() - 0.5) * 110; id.data[i] = id.data[i + 1] = id.data[i + 2] = v; id.data[i + 3] = 20; }
    gg.putImageData(id, 0, 0);
  }
  function preload() {
    return Promise.all(Object.entries(D.images).map(([k, s]) => new Promise((r) => { const im = new Image(); im.onload = () => { img[k] = im; r(); }; im.onerror = r; im.src = s; })));
  }
  function txt(s, x, y, font, color, align = "center") { g.font = font; g.fillStyle = color; g.textAlign = align; g.textBaseline = "middle"; g.fillText(s, x, y); }
  function softText(s, x, y, font, color, a = 1) {
    g.save(); g.globalAlpha *= a; g.shadowColor = "rgba(0,0,0,0.85)"; g.shadowBlur = 26; g.shadowOffsetY = 3; txt(s, x, y, font, color); g.restore();
  }
  function fit(s, font, size, maxW) { g.font = font(size); const w = g.measureText(s).width; return w > maxW ? Math.floor(size * maxW / w) : size; }

  // camera transform for a scene at time t -> {z, fx, fy}; also maps image points to screen
  function cam(k, t) {
    const [z0, z1, f0, f1] = CAM[k], p = ease.inOutCubic(prog(t, segStart(k), segEnd(k) + 0.8));
    const z = lerp(z0, z1, p);
    let fx = lerp(f0[0], f1[0], p), fy = lerp(f0[1], f1[1], p);
    fx = clamp(fx, W / (2 * z), W - W / (2 * z)); fy = clamp(fy, H / (2 * z), H - H / (2 * z));
    return { z, fx, fy, map: (x, y) => [W / 2 + (x - fx) * z, H / 2 + (y - fy) * z] };
  }
  function drawScene(k, t, a) {
    const im = img[k]; if (!im || a <= 0) return;
    const c = cam(k, t);
    g.save(); g.globalAlpha = a; g.translate(W / 2, H / 2); g.scale(c.z, c.z); g.translate(-c.fx, -c.fy);
    g.drawImage(im, 0, 0, W, H); g.restore();
    g.save(); g.globalAlpha = a; FX[k] && FX[k](t, c); g.restore();
  }

  // ------------------------------------------------------------ per-scene living details
  function bulb(c, x, y, t, r = 240) {
    const [sx, sy] = c.map(x, y), fl = 0.75 + 0.15 * Math.sin(t * 13) + 0.1 * Math.sin(t * 31.7);
    const gr = g.createRadialGradient(sx, sy, 0, sx, sy, r * c.z);
    gr.addColorStop(0, `rgba(255,214,140,${0.55 * fl})`); gr.addColorStop(1, "rgba(255,214,140,0)");
    g.save(); g.globalCompositeOperation = "lighter"; g.fillStyle = gr; g.fillRect(0, 0, W, H); g.restore();
  }
  function rings(c, x, y, t, col = "255,255,255") {
    const [sx, sy] = c.map(x, y);
    for (let i = 0; i < 3; i++) {
      const p = ((t * 1.4) + i / 3) % 1;
      g.strokeStyle = `rgba(${col},${0.6 * (1 - p)})`; g.lineWidth = 5; g.beginPath(); g.arc(sx, sy, (40 + p * 140) * c.z, 0, 7); g.stroke();
    }
  }
  function rain(t, n = 140, a = 0.5) {
    const r = rng(9); g.save(); g.strokeStyle = `rgba(220,230,255,${a})`; g.lineWidth = 2;
    for (let i = 0; i < n; i++) {
      const sp = 1400 + r() * 700, x = (r() * W + t * 120) % W, y = ((r() * H + t * sp) % (H + 200)) - 100;
      g.beginPath(); g.moveTo(x, y); g.lineTo(x - 10, y + 38); g.stroke();
    }
    g.restore();
  }
  const FX = {
    s1: (t, c) => bulb(c, 856, 208, t, 300),
    s2: (t, c) => bulb(c, 367, 224, t, 320),
    s3: (t, c) => { if (t < MK("s3", 1) + 1.5) rings(c, 623, 1472, t, "120,255,160"); },
    s6: (t, c) => { if (t > MK("s6", 0) - 0.3 && t < MK("s6", 1) + 0.8) rings(c, 600, 1180, t, "180,220,255"); },
    s8: (t, c) => engraving(t, c),
    s9: (t, c) => { bulb(c, 210, 340, t, 260); rain(t); },
    s10: (t, c) => {
      const sq = MK("s10", 1), p = prog(t, sq, sq + 0.6) * (1 - prog(t, sq + 2.2, sq + 3.2));
      if (p > 0) {
        const [sx, sy] = c.map(660, 1080), gr = g.createRadialGradient(sx, sy, 0, sx, sy, 260 * c.z);
        gr.addColorStop(0, `rgba(255,236,190,${0.5 * p})`); gr.addColorStop(1, "rgba(255,236,190,0)");
        g.save(); g.globalCompositeOperation = "lighter"; g.fillStyle = gr; g.fillRect(0, 0, W, H); g.restore();
      }
    },
    s11: (t, c) => bulb(c, 367, 224, t, 320),
  };
  function engraving(t, c) {   // engraved message appears on the blank back of the watch
    const t0 = MK("s8", 1) - 0.2, p = prog(t, t0, t0 + 2.2);
    if (p <= 0) return;
    const [sx, sy] = c.map(415, 815), r = 128 * c.z;
    g.save(); g.translate(sx, sy); g.rotate(-0.08);
    const glow = g.createRadialGradient(0, 0, 0, 0, 0, r * 1.4);
    glow.addColorStop(0, `rgba(255,240,200,${0.35 * clamp(p * 2)})`); glow.addColorStop(1, "rgba(255,240,200,0)");
    g.fillStyle = glow; g.fillRect(-r * 2, -r * 2, r * 4, r * 4);
    g.beginPath(); g.rect(-r, -r, 2 * r * clamp(p * 1.2), 2 * r); g.clip();
    const lines = ["เวลาทั้งหมด", "ของพ่อ", "เป็นของลูก"], fs = 34 * c.z;
    lines.forEach((l, i) => {
      const y = (i - 1) * fs * 1.25;
      g.font = F.h(fs); g.textAlign = "center"; g.textBaseline = "middle";
      g.fillStyle = "rgba(255,255,255,0.55)"; g.fillText(l, 1.5, y + 1.5);      // engraved highlight
      g.fillStyle = "rgba(60,48,36,0.85)"; g.fillText(l, 0, y);
    });
    g.restore();
  }

  // ------------------------------------------------------------ title, captions, end card
  function title(t) {
    const a = prog(t, 0.4, 1.4) * (1 - prog(t, 3.2, 4.0));
    if (a <= 0) return;
    g.save(); g.globalAlpha = a;
    const gr = g.createLinearGradient(0, 120, 0, 520); gr.addColorStop(0, "rgba(0,0,0,0.55)"); gr.addColorStop(1, "rgba(0,0,0,0)");
    g.fillStyle = gr; g.fillRect(0, 0, W, 560);
    softText("นาฬิกาของพ่อ", W / 2, 300, F.h(120), "#fff4dc");
    g.strokeStyle = "rgba(255,244,220,0.7)"; g.lineWidth = 3; g.beginPath(); g.moveTo(W / 2 - 160, 395); g.lineTo(W / 2 + 160, 395); g.stroke();
    softText("เรื่องสั้น", W / 2, 440, F.m(38), "#f2ddb0");
    g.restore();
  }
  function captions(t) {
    let seg = null;
    for (const k of Object.keys(C)) {
      if (k === "end") continue;
      const c = C[k];
      c.parts.forEach((p, i) => { const s = i === 0 ? c.start - 0.05 : c.marks[i - 1], e = i < c.parts.length - 1 ? c.marks[i] : c.end + 0.35; if (t >= s && t < e) seg = { p, s, e }; });
    }
    if (!seg) return;
    let p = seg.p; (D.capfix || []).forEach(([a, b]) => (p = p.split(a).join(b)));
    const a = prog(t, seg.s, seg.s + 0.25) * (1 - prog(t, seg.e - 0.2, seg.e));
    // wrap long lines into two (split at the space closest to the middle)
    g.font = F.b(52); let lines = [p];
    if (g.measureText(p).width > 940) {
      const sp = [...p.matchAll(/ /g)].map((m) => m.index);
      if (sp.length) { const cut = sp.reduce((b, i) => (Math.abs(i - p.length / 2) < Math.abs(b - p.length / 2) ? i : b)); lines = [p.slice(0, cut), p.slice(cut + 1)]; }
    }
    const fs = Math.min(...lines.map((l) => fit(l, F.b, 52, 960)));
    g.save(); g.globalAlpha = a;
    const gr = g.createLinearGradient(0, 1440, 0, 1760); gr.addColorStop(0, "rgba(0,0,0,0)"); gr.addColorStop(0.5, "rgba(0,0,0,0.45)"); gr.addColorStop(1, "rgba(0,0,0,0)");
    g.fillStyle = gr; g.fillRect(0, 1440, W, 320);
    lines.forEach((l, i) => softText(l, W / 2, 1600 + (i - (lines.length - 1) / 2) * fs * 1.35, F.b(fs), "#fff8ea"));
    g.restore();
  }
  function endCard(t) {
    const t0 = segStart("end"), a = ease.inOutCubic(prog(t, t0, t0 + 1.0));
    if (a <= 0) return;
    g.save(); g.globalAlpha = a;
    g.fillStyle = CREAM; g.fillRect(0, 0, W, H);
    // watercolour wash blobs
    const r = rng(4);
    for (let i = 0; i < 7; i++) {
      const x = r() * W, y = 300 + r() * 1300, rr = 200 + r() * 260, gr = g.createRadialGradient(x, y, 0, x, y, rr);
      gr.addColorStop(0, i % 2 ? "rgba(233,190,120,0.22)" : "rgba(150,180,210,0.18)"); gr.addColorStop(1, "rgba(0,0,0,0)");
      g.fillStyle = gr; g.fillRect(0, 0, W, H);
    }
    // ink clock
    const cx = W / 2, cy = 640;
    g.strokeStyle = INKC; g.lineWidth = 6; g.beginPath(); g.arc(cx, cy, 130, 0, 7); g.stroke();
    for (let i = 0; i < 12; i++) { const an = i / 12 * Math.PI * 2; g.beginPath(); g.moveTo(cx + Math.sin(an) * 110, cy - Math.cos(an) * 110); g.lineTo(cx + Math.sin(an) * 122, cy - Math.cos(an) * 122); g.stroke(); }
    const sec = (t - t0) * Math.PI * 2 / 6;
    g.lineCap = "round"; g.lineWidth = 8; g.beginPath(); g.moveTo(cx, cy); g.lineTo(cx + Math.sin(sec / 12) * 60, cy - Math.cos(sec / 12) * 60); g.stroke();
    g.lineWidth = 4; g.beginPath(); g.moveTo(cx, cy); g.lineTo(cx + Math.sin(sec) * 100, cy - Math.cos(sec) * 100); g.stroke();
    const l1 = prog(t, MK("end", 0), MK("end", 0) + 0.8), l2 = prog(t, MK("end", 1), MK("end", 1) + 0.6), l3 = prog(t, MK("end", 1) + 1.2, MK("end", 1) + 1.8);
    g.globalAlpha = a * l1; txt("ถ้าวันนี้ ยังโทรหาพ่อแม่ได้…", W / 2, 930, F.h(66), INKC);
    g.globalAlpha = a * l2; txt("โทรเถอะครับ", W / 2, 1050, F.h(92), "#a0441f");
    g.globalAlpha = a * l3;
    g.strokeStyle = "rgba(43,33,24,0.4)"; g.lineWidth = 2; g.beginPath(); g.moveTo(W / 2 - 200, 1170); g.lineTo(W / 2 + 200, 1170); g.stroke();
    txt("คุณโทรหาพ่อแม่ล่าสุดเมื่อไหร่?", W / 2, 1250, F.m(46), INKC);
    txt("คอมเมนต์บอกกันหน่อย", W / 2, 1320, F.m(40), "#6b5a48");
    g.restore();
  }

  function draw(t) {
    g.setTransform(1, 0, 0, 1, 0, 0); g.globalAlpha = 1; g.fillStyle = "#000"; g.fillRect(0, 0, W, H);
    ORDER.forEach((k, i) => {
      if (k === "end") return;
      const s0 = segStart(k), s1 = segEnd(k);
      if (t < s0 - 0.05 || t > s1 + 1.0) return;
      const a = i === 0 ? 1 : ease.inOutCubic(prog(t, s0, s0 + 0.9));
      drawScene(k, t, a);
    });
    // warm cinematic grade + vignette
    const vg = g.createRadialGradient(W / 2, H * 0.48, H * 0.3, W / 2, H * 0.48, H * 0.8);
    vg.addColorStop(0, "rgba(0,0,0,0)"); vg.addColorStop(1, "rgba(20,10,0,0.5)"); g.fillStyle = vg; g.fillRect(0, 0, W, H);
    title(t); captions(t); endCard(t);
    g.save(); g.globalCompositeOperation = "overlay"; g.fillStyle = g.createPattern(grain, "repeat");
    g.translate((t * 97) % 256, (t * 53) % 256); g.fillRect(-256, -256, W + 512, H + 512); g.restore();
    const fin = Math.max(prog(t, TL.duration - 1.0, TL.duration), 1 - prog(t, 0, 0.8));
    if (fin > 0) { g.fillStyle = `rgba(0,0,0,${fin})`; g.fillRect(0, 0, W, H); }
  }
  function events() {
    const e = { pen: [] };
    ["s3", "s4", "s5", "s6", "s7", "s8", "s9", "s10", "s11"].forEach((k) => (e[k] = C[k].start));
    e.s8m = MK("s8", 1); e.squeeze = MK("s10", 1);
    return e;
  }
  window.scene = { setup, preload, draw, events };
})();
