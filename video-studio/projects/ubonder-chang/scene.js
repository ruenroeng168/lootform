// Overlay for "สมัครเป็นช่างกับ อุบลเด้อ" (render.mjs --overlay on out/base.mp4 made by prep.py).
// Hook headline, intro chips, a 1/5…5/5 step HUD, tap ripples on the fields being filled (positions follow the
// same zoom maths as prep.py), tips, confetti on "done", a pulsing ring + pointer on the URL, and captions.
// The source's own heading band (y 40–330) is left clear whenever the picture is not zoomed.
(function () {
  const { clamp, lerp, prog, ease } = window.L;
  const W = 1080, H = 1920;
  const INK = "#1b1410", ORANGE = "#e8611a", RED = "#c8361b", YEL = "#ffc928", WHITE = "#ffffff", GREEN = "#22a565";
  const F = { b: (s) => `700 ${s}px "IBM Plex Sans Thai"`, m: (s) => `600 ${s}px "IBM Plex Sans Thai"` };
  let g, TL, C, D, KEYS, W0;
  const STEPS = ["s1", "s2", "s3", "s4", "s5"];

  function setup(canvas, tl) {
    g = canvas.getContext("2d"); TL = tl; C = tl.cues; D = tl.data || {}; KEYS = Object.keys(C);
    W0 = KEYS.map((k, i) => (i === 0 ? 0 : C[k].start - 0.15)).concat([TL.duration]);
  }
  const at = (k, st) => C[k].start + (typeof st === "string" ? C[k].marks[+st.slice(1) - 1] - C[k].start : st);
  const winEnd = (k) => W0[KEYS.indexOf(k) + 1];
  const sm = (u) => { u = clamp(u); return u * u * (3 - 2 * u); };
  function view(k, t) {   // mirror of prep.py view() + cut punch-in
    let z = 1, cx = 540, cy = 960; const rel = t - C[k].start;
    for (const [st, du, kz, kx, ky] of (D.zoom || {})[k] || []) {
      const s0 = at(k, st) - C[k].start, u = sm((rel - s0) / du);
      z += (kz - z) * u; cx += (kx - cx) * u; cy += (ky - cy) * u;
    }
    const i = KEYS.indexOf(k); if (i) z *= 1 + 0.06 * (1 - sm((t - W0[i]) / 0.3));
    const vw = W / z, vh = H / z, x0 = clamp(cx - vw / 2, 0, W - vw), y0 = clamp(cy - vh / 2, 0, H - vh);
    return { z, map: (sx, sy) => [(sx - x0) * z, (sy - y0) * z] };
  }
  const cueAt = (t) => { let k = KEYS[0]; KEYS.forEach((q, i) => { if (t >= W0[i]) k = q; }); return k; };

  function rr(x, y, w, h, r) { g.beginPath(); g.roundRect(x, y, w, h, r); }
  function txt(s, x, y, font, col, align = "center") { g.font = font; g.fillStyle = col; g.textAlign = align; g.textBaseline = "middle"; g.fillText(s, x, y); }
  function shadow(fn, blur = 30, oy = 10, col = "rgba(0,0,0,0.45)") { g.save(); g.shadowColor = col; g.shadowBlur = blur; g.shadowOffsetY = oy; fn(); g.restore(); }
  const vis = (t, a, b) => prog(t, a, a + 0.22) * (1 - prog(t, b - 0.18, b));

  function pill(s, cx, y, size, bg, fg, t0, t1, t, icon) {
    const a = vis(t, t0, t1); if (a <= 0) return;
    const k = ease.outBack(prog(t, t0, t0 + 0.35), 2);
    g.font = F.b(size); const iw = icon ? size * 1.05 : 0, w = g.measureText(s).width + size * 1.2 + iw, h = size * 1.75;
    g.save(); g.globalAlpha = a; g.translate(cx, y); g.scale(k, k);
    shadow(() => { rr(-w / 2, -h / 2, w, h, h / 2); g.fillStyle = bg; g.fill(); });
    if (icon) icon(-w / 2 + size * 0.95, 0, size * 0.42, fg);
    txt(s, iw / 2, 3, F.b(size), fg);
    g.restore();
  }
  // tiny vector icons (no emoji font in headless chromium)
  const ic = {
    check: (x, y, r, c) => { g.save(); g.translate(x, y); g.strokeStyle = c; g.lineWidth = r * 0.4; g.lineCap = g.lineJoin = "round"; g.beginPath(); g.moveTo(-r * 0.7, 0); g.lineTo(-r * 0.15, r * 0.55); g.lineTo(r * 0.8, -r * 0.6); g.stroke(); g.restore(); },
    pin: (x, y, r, c) => { g.save(); g.translate(x, y - r * 0.2); g.fillStyle = c; g.beginPath(); g.arc(0, -r * 0.2, r * 0.75, Math.PI, 0); g.lineTo(0, r * 1.1); g.closePath(); g.fill(); g.fillStyle = "rgba(0,0,0,0.35)"; g.beginPath(); g.arc(0, -r * 0.2, r * 0.3, 0, 7); g.fill(); g.restore(); },
    baht: (x, y, r, c) => { g.save(); g.strokeStyle = c; g.lineWidth = r * 0.22; g.beginPath(); g.arc(x, y, r * 0.95, 0, 7); g.stroke(); txt("฿", x, y + 2, F.b(r * 1.3), c); g.restore(); },
    share: (x, y, r, c) => { g.save(); g.translate(x, y); g.fillStyle = c; g.strokeStyle = c; g.lineWidth = r * 0.22; const p = [[r * 0.6, -r * 0.65], [-r * 0.6, 0], [r * 0.6, r * 0.65]]; g.beginPath(); g.moveTo(...p[0]); g.lineTo(...p[1]); g.lineTo(...p[2]); g.stroke(); p.forEach(([a, b]) => { g.beginPath(); g.arc(a, b, r * 0.32, 0, 7); g.fill(); }); g.restore(); },
    bolt: (x, y, r, c) => { g.save(); g.translate(x, y); g.fillStyle = c; g.beginPath(); g.moveTo(r * 0.25, -r); g.lineTo(-r * 0.6, r * 0.15); g.lineTo(-r * 0.05, r * 0.15); g.lineTo(-r * 0.25, r); g.lineTo(r * 0.6, -r * 0.15); g.lineTo(r * 0.05, -r * 0.15); g.closePath(); g.fill(); g.restore(); },
    snow: (x, y, r, c) => { g.save(); g.translate(x, y); g.strokeStyle = c; g.lineWidth = r * 0.2; g.lineCap = "round"; for (let i = 0; i < 3; i++) { g.rotate(Math.PI / 3); g.beginPath(); g.moveTo(-r, 0); g.lineTo(r, 0); g.moveTo(r * 0.6, -r * 0.25); g.lineTo(r * 0.8, 0); g.lineTo(r * 0.6, r * 0.25); g.moveTo(-r * 0.6, -r * 0.25); g.lineTo(-r * 0.8, 0); g.lineTo(-r * 0.6, r * 0.25); g.stroke(); } g.restore(); },
  };
  function hand(x, y, s) {   // pointing finger (tip at x,y)
    g.save(); g.translate(x, y); g.scale(s, s); g.rotate(-0.35);
    shadow(() => {
      g.fillStyle = WHITE; g.strokeStyle = INK; g.lineWidth = 5; g.lineJoin = "round";
      g.beginPath(); g.roundRect(-14, 0, 28, 80, 14); g.roundRect(-40, 52, 80, 78, 26); g.fill(); g.stroke();
      g.beginPath(); g.roundRect(-14, 0, 28, 80, 14); g.fill();
    }, 18, 6);
    g.restore();
  }

  // ------------------------------------------------------------------ hook
  function hook(t) {
    const k = "hook", e = winEnd(k); if (t >= e) return;
    const a = 1 - prog(t, e - 0.2, e);
    g.save(); g.globalAlpha = a;
    const gr = g.createLinearGradient(0, 0, 0, 900); gr.addColorStop(0, "rgba(20,10,5,0.82)"); gr.addColorStop(0.75, "rgba(20,10,5,0.55)"); gr.addColorStop(1, "rgba(20,10,5,0)");
    g.fillStyle = gr; g.fillRect(0, 0, W, 900);
    const t0 = C[k].start - 0.1, m = C[k].marks[0];
    const l1 = ease.outBack(prog(t, t0, t0 + 0.35), 2), l2 = ease.outBack(prog(t, t0 + 0.55, t0 + 0.9), 2);
    g.lineJoin = "round";
    [[l1, "ช่างแอร์ ช่างไฟ", 250, WHITE], [l2, "ในอุบลฯ…", 375, YEL]].forEach(([s, str, y, col]) => {
      if (s <= 0) return; g.save(); g.translate(540, y); g.scale(s, s); g.font = F.b(104); g.textAlign = "center"; g.textBaseline = "middle";
      g.lineWidth = 16; g.strokeStyle = INK; g.strokeText(str, 0, 0); g.fillStyle = col; g.fillText(str, 0, 0); g.restore();
    });
    // trade icons bouncing beside line 1
    const bob = Math.sin(t * 6) * 6;
    if (l1 > 0) { g.save(); g.globalAlpha *= clamp(l1); shadow(() => { g.fillStyle = "#2f8fd8"; g.beginPath(); g.arc(110, 250 + bob, 52, 0, 7); g.fill(); }); ic.snow(110, 250 + bob, 30, WHITE);
      shadow(() => { g.fillStyle = YEL; g.beginPath(); g.arc(970, 250 - bob, 52, 0, 7); g.fill(); }); ic.bolt(970, 250 - bob, 32, INK); g.restore(); }
    // question
    const q = ease.outBack(prog(t, m - 0.05, m + 0.3), 2.2);
    if (q > 0) {
      const sh = (1 - prog(t, m, m + 0.4)) * Math.sin(t * 70) * 8;
      g.save(); g.translate(540 + sh, 540); g.scale(q, q); g.rotate(-0.02);
      shadow(() => { rr(-430, -82, 860, 164, 40); g.fillStyle = RED; g.fill(); });
      txt("อยากได้งานเพิ่ม?", 0, 4, F.b(92), WHITE); g.restore();
      pill("แบบไม่ต้องรอใครแนะนำ", 540, 690, 50, WHITE, INK, m + 0.7, e, t);
    }
    g.restore();
  }

  // ------------------------------------------------------------------ intro
  function intro(t) {
    const k = "intro", e = winEnd(k), m1 = C[k].marks[0], m2 = C[k].marks[1];
    pill("อุบลเด้อ · แอปหาช่างของคนอุบลฯ", 540, 1250, 50, ORANGE, WHITE, C[k].start + 0.1, m1, t);
    pill("ลูกค้าในพื้นที่แจ้งงาน", 540, 1160, 52, WHITE, INK, m1, m2, t, ic.pin);
    pill("คุณเสนอราคาเอง", 540, 1290, 52, YEL, INK, m1 + 1.3, m2, t, ic.baht);
    pill(D.url || "", 540, 200, 46, INK, YEL, m2 + 0.55, e, t);
  }

  // ------------------------------------------------------------------ steps HUD
  function hud(t) {
    const k = cueAt(t), n = STEPS.indexOf(k); if (n < 0) return;
    const t0 = C[k].start + 0.45, e = winEnd(k), a = vis(t, t0, e + 0.2); if (a <= 0) return;
    const sl = ease.outCubic(prog(t, t0, t0 + 0.35));
    g.save(); g.globalAlpha = a; g.translate(0, (1 - sl) * -160);
    shadow(() => { rr(60, 64, 960, 176, 34); g.fillStyle = "rgba(27,20,16,0.92)"; g.fill(); });
    const pk = ease.outBack(prog(t, t0 + 0.1, t0 + 0.45), 2.5);
    g.save(); g.translate(150, 136); g.scale(pk, pk); g.fillStyle = YEL; g.beginPath(); g.arc(0, 0, 56, 0, 7); g.fill(); txt(String(n + 1), 0, 4, F.b(70), INK); g.restore();
    txt(n === 4 ? "ขั้นสุดท้าย" : `ขั้นที่ ${n + 1}/5`, 232, 104, F.m(34), YEL, "left");
    g.font = F.b(52); let lab = (D.steps || [])[n] || ""; txt(lab, 232, 156, F.b(lab.length > 20 ? 46 : 52), WHITE, "left");
    for (let i = 0; i < 5; i++) {
      const x = 232 + i * 152, f = i < n ? 1 : i === n ? ease.outCubic(prog(t, t0 + 0.2, t0 + 0.8)) : 0;
      rr(x, 206, 140, 14, 7); g.fillStyle = "rgba(255,255,255,0.22)"; g.fill();
      if (f > 0) { rr(x, 206, 140 * f, 14, 7); g.fillStyle = i === n ? YEL : GREEN; g.fill(); }
    }
    g.restore();
    const tip = (D.tips || {})[k];
    if (tip) pill(tip, 540, 300, 46, GREEN, WHITE, C[k].marks[0], e, t, ic.check);
  }

  // ------------------------------------------------------------------ taps
  function taps(t) {
    for (const k of Object.keys(D.taps || {})) for (const [st, off, sx, sy] of D.taps[k]) {
      const t0 = at(k, st) + off; if (t < t0 - 0.45 || t > t0 + 0.7 || t >= winEnd(k)) continue;
      const [x, y] = view(k, t).map(sx, sy);
      if (t >= t0) {
        const u = prog(t, t0, t0 + 0.6);
        for (const d of [0, 0.15]) { const v = clamp(u - d); if (v <= 0) continue;
          g.save(); g.globalAlpha = 1 - v; g.strokeStyle = YEL; g.lineWidth = 10 * (1 - v) + 2; g.beginPath(); g.arc(x, y, 20 + 90 * ease.outCubic(v), 0, 7); g.stroke(); g.restore(); }
        g.save(); g.globalAlpha = 0.55 * (1 - u); g.fillStyle = WHITE; g.beginPath(); g.arc(x, y, 34, 0, 7); g.fill(); g.restore();
      }
      const ap = prog(t, t0 - 0.45, t0 - 0.2) * (1 - prog(t, t0 + 0.45, t0 + 0.7));
      const press = t < t0 ? 1 - 0.12 * prog(t, t0 - 0.1, t0) : 0.88 + 0.12 * prog(t, t0, t0 + 0.15);
      if (ap > 0) { g.save(); g.globalAlpha = ap; hand(x + 6, y + 10 + (1 - ap) * 60, press * 1.15); g.restore(); }
    }
  }

  // ------------------------------------------------------------------ done: confetti
  const CONF = Array.from({ length: 140 }, (_, i) => { const r = (n) => { const x = Math.sin(i * 127.1 + n * 311.7) * 43758.5453; return x - Math.floor(x); };
    return { ang: -Math.PI / 2 + (r(1) - 0.5) * 2.4, sp: 900 + r(2) * 1400, rot: r(3) * 6, vr: (r(4) - 0.5) * 14, c: [YEL, ORANGE, GREEN, "#2f8fd8", WHITE, RED][i % 6], w: 14 + r(5) * 14, side: i % 2 }; });
  function confetti(t) {
    const t0 = C.done.start - 0.05, u = t - t0; if (u < 0 || u > 3.2) return;
    g.save(); g.globalAlpha = 1 - prog(u, 2.4, 3.2);
    for (const p of CONF) {
      const ox = p.side ? 980 : 100, oy = 1500, vx = Math.cos(p.ang) * p.sp * (p.side ? -0.45 : 0.45) + (p.side ? -120 : 120), vy = Math.sin(p.ang) * p.sp;
      const drag = (1 - Math.exp(-2.2 * u)) / 2.2, x = ox + vx * drag, y = oy + vy * drag + 520 * u * u;
      g.save(); g.translate(x, y); g.rotate(p.rot + p.vr * u); g.scale(1, Math.cos(u * 9 + p.rot)); g.fillStyle = p.c; g.fillRect(-p.w / 2, -p.w / 4, p.w, p.w / 2); g.restore();
    }
    g.restore();
  }

  // ------------------------------------------------------------------ cta
  function cta(t) {
    const k = "cta", t0 = C[k].start + 0.5; if (t < t0) return;
    const v = view(k, t), [x1, y1] = v.map(70, 1078), [x2, y2] = v.map(1010, 1252);
    const a = prog(t, t0, t0 + 0.3), pulse = (t - t0) % 1.1 / 1.1;
    g.save(); g.globalAlpha = a; g.strokeStyle = WHITE; g.lineWidth = 9;
    rr(x1 - 6, y1 - 6, x2 - x1 + 12, y2 - y1 + 12, (y2 - y1) / 2 + 6); g.stroke();
    g.globalAlpha = a * (1 - pulse); g.lineWidth = 6; const gr = 30 * pulse;
    rr(x1 - 6 - gr, y1 - 6 - gr, x2 - x1 + 12 + 2 * gr, y2 - y1 + 12 + 2 * gr, (y2 - y1) / 2 + 6 + gr); g.stroke(); g.restore();
    const bob = Math.sin(t * 7) * 16;
    g.save(); g.globalAlpha = a; g.translate(0, 0); hand(700, y2 + 20 + bob, 1.2); g.restore();
  }

  // ------------------------------------------------------------------ captions
  function captions(t) {
    let seg = null;
    for (const k of KEYS) {
      if (k === "hook") continue;
      const c = C[k];
      c.parts.forEach((p, i) => { const s = i === 0 ? c.start - 0.05 : c.marks[i - 1], e = i < c.parts.length - 1 ? c.marks[i] : c.end + 0.2; if (t >= s && t < e) seg = { p, s, e }; });
    }
    if (!seg) return;
    let p = seg.p; (D.capfix || []).forEach(([a, b]) => (p = p.split(a).join(b)));
    const a = prog(t, seg.s, seg.s + 0.08) * (1 - prog(t, seg.e - 0.08, seg.e));
    g.font = F.b(54);
    const words = p.split(" "), lines = [""];
    for (const w of words) { const tt = (lines[lines.length - 1] + " " + w).trim(); if (g.measureText(tt).width > 900 && lines[lines.length - 1]) lines.push(w); else lines[lines.length - 1] = tt; }
    const L2 = lines.slice(0, 2), y0 = 1500 - (L2.length > 1 ? 36 : 0);
    const bw = Math.max(...L2.map((l) => g.measureText(l).width)) + 70, bh = L2.length * 72 + 34;
    g.save(); g.globalAlpha = a;
    rr(540 - bw / 2, y0 - 36 - 17, bw, bh, 26); g.fillStyle = "rgba(20,12,8,0.72)"; g.fill();
    g.textAlign = "center"; g.textBaseline = "middle";
    L2.forEach((l, i) => { txt(l, 540, y0 + i * 72 + 2, F.b(54), WHITE); });
    g.restore();
  }

  function flash(t) {
    for (let i = 1; i < KEYS.length; i++) { const u = t - W0[i]; if (u >= 0 && u < 0.14) { g.fillStyle = `rgba(255,255,255,${0.32 * (1 - u / 0.14)})`; g.fillRect(0, 0, W, H); } }
  }

  function draw(t) {
    g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, W, H); g.globalAlpha = 1;
    flash(t); hook(t); intro(t); hud(t); taps(t); confetti(t); cta(t); captions(t);
  }
  function events() {
    const taps = [];
    for (const k of Object.keys(D.taps || {})) for (const [st, off] of D.taps[k]) taps.push(at(k, st) + off);
    return { pen: [], pops: STEPS.map((k) => C[k].start + 0.55).concat(Object.keys(D.tips || {}).map((k) => C[k].marks[0]),
               [C.intro.marks[0], C.intro.marks[0] + 1.3, C.hook.start + 0.45, C.cta.marks[0]]),
      whoosh: W0.slice(1, -1).map((x) => x - 0.12), taps, boom: C.hook.marks[0] - 0.05, done: C.done.start - 0.05,
      cta: C.cta.start + 0.5, price: null };
  }
  window.scene = { setup, draw, events };
})();
