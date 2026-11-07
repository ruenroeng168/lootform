// LOOTFORM teaser — "Meet LOOTY". Pure function of time: draw(t, frame).
(function () {
  const { clamp, lerp, prog, ease, rng, noise1, hexA, mix, rrect, brackets, text } = window.L;
  const COL = {
    bg: "#0a0a0d", surface: "#131318", raised: "#1b1b22", border: "#2a2a33", borderStrong: "#3a3a45",
    fg: "#f3f2ed", muted: "#8b8b96", dim: "#5c5c66",
    common: "#a8adbb", rare: "#38c6f4", epic: "#b565f7", legendary: "#f0a93b", accent: "#38c6f4",
  };
  const F = {
    display: (s, w = 700) => `${w} ${s}px "Chakra Petch"`,
    thai: (s, w = 600) => `${w} ${s}px "IBM Plex Sans Thai"`,
    mono: (s) => `500 ${s}px "IBM Plex Mono"`,
  };
  let g, W, H, TL, C, T = {};
  const CRATE = { x: 540, y: 600 };
  const CHIPS = [
    { cue: "common", label: "COMMON", col: COL.common },
    { cue: "rare", label: "RARE", col: COL.rare },
    { cue: "epic", label: "EPIC", col: COL.epic },
    { cue: "or", label: "???", col: COL.legendary },
  ].map((c, i) => ({ ...c, x: 186 + i * 236, y: 905 }));

  // ------------------------------------------------------------ setup
  let dust = [], shards = [], blinks = [], poseKeys = [];
  const POSES = {
    idle: { R: [0.28, -0.35], L: [0.28, -0.35], lean: 0, crouch: 0, look: [0, 0], wave: 0, eyes: "normal" },
    wave: { R: [2.35, 0.55], L: [0.28, -0.35], lean: -0.03, crouch: 0, look: [0.15, 0], wave: 1, eyes: "happy" },
    point: { R: [2.75, 0.12], L: [0.62, -1.0], lean: 0.02, crouch: 0, look: [0, -1], wave: 0, eyes: "normal" },
    present: { R: [1.05, 0.55], L: [1.05, 0.55], lean: 0, crouch: 0, look: [0, -0.7], wave: 0, eyes: "normal" },
    anticip: { R: [0.42, -2.05], L: [0.42, -2.05], lean: 0, crouch: 1, look: [0, -1], wave: 0, eyes: "wow" },
    cheer: { R: [2.6, 0.2], L: [2.6, 0.2], lean: 0, crouch: 0, look: [0, -0.6], wave: 0, eyes: "happy" },
    idleHappy: { R: [0.28, -0.35], L: [0.28, -0.35], lean: 0, crouch: 0, look: [0, 0], wave: 0, eyes: "happy" },
  };

  function setup(canvas, tl) {
    g = canvas.getContext("2d"); W = tl.width; H = tl.height; TL = tl; C = tl.cues;
    T.land = 0.72;
    T.crate = C.pull.start - 0.2;
    T.burst = C.legendary.start - 0.15;
    T.rise = T.burst - 1.45;
    T.outro = C.outro.start - 0.35;
    T.end = C.outro.end + 0.3;
    const r = rng(11);
    dust = Array.from({ length: 70 }, () => ({
      x: r() * W, y: r() * H, v: 12 + r() * 30, s: 1.4 + r() * 2.4, a: 0.12 + r() * 0.3, ph: r() * 6.28,
    }));
    shards = Array.from({ length: 150 }, () => {
      const ang = r() * Math.PI * 2, sp = 500 + r() * 1500;
      return { vx: Math.cos(ang) * sp, vy: Math.sin(ang) * sp - 300, s: 3 + r() * 8, life: 0.9 + r() * 1.2,
        col: [COL.legendary, "#ffd88a", COL.fg, COL.legendary][Math.floor(r() * 4)], rot: r() * 6, spin: (r() - 0.5) * 14 };
    });
    for (let t = 2.2; t < tl.duration; t += 2.6 + r() * 1.8) blinks.push(t);
    const K = (t, pose, extra = {}) => poseKeys.push({ t, pose: { ...POSES[pose], ...extra } });
    K(0, "idle");
    K(C.hello.start - 0.1, "wave");
    K(C.intro2.end + 0.05, "idle");
    K(C.pull.start - 0.05, "point");
    K(C.maybe.start, "present");
    CHIPS.forEach((c) => K(C[c.cue].start, "present", { look: [(c.x - 540) / 400, -0.75] }));
    K(T.rise, "anticip");
    K(T.burst, "cheer");
    K(T.outro + 0.2, "idleHappy");
    K(C.outro.start + 0.5, "wave");
    K(T.end + 0.6, "idleHappy");
  }

  // ------------------------------------------------------------ helpers
  function poseAt(t) {
    let i = 0;
    while (i + 1 < poseKeys.length && poseKeys[i + 1].t <= t) i++;
    const cur = poseKeys[i], prev = poseKeys[Math.max(0, i - 1)];
    const k = ease.outBack(prog(t, cur.t, cur.t + 0.38), 1.2);
    const P = {}, a = prev.pose, b = cur.pose;
    for (const key of ["R", "L", "look"]) P[key] = [lerp(a[key][0], b[key][0], k), lerp(a[key][1], b[key][1], k)];
    for (const key of ["lean", "crouch", "wave"]) P[key] = lerp(a[key], b[key], clamp(k));
    P.eyes = k > 0.35 ? b.eyes : a.eyes;
    return P;
  }
  const mouthAt = (f) => TL.mouth[clamp(f, 0, TL.mouth.length - 1)] || 0;
  const blinkAt = (t) => {
    for (const b of blinks) { const x = (t - b) / 0.14; if (x >= 0 && x <= 1) return 1 - Math.sin(Math.PI * x); }
    return 1;
  };
  function glow(color, blur) { g.shadowColor = color; g.shadowBlur = blur; }
  function noGlow() { g.shadowBlur = 0; g.shadowColor = "transparent"; }

  function wordmark(x, y, size, t0, t, color = COL.fg) {
    const word = "LOOTFORM";
    g.font = F.display(size); g.letterSpacing = "0px";
    const sp = size * 0.12;
    const ws = [...word].map((ch) => g.measureText(ch).width);
    const total = ws.reduce((a, b) => a + b, 0) + sp * (word.length - 1);
    const p = prog(t, t0, t0 + 0.9);
    let cx = x - total / 2;
    g.textBaseline = "middle"; g.textAlign = "left";
    [...word].forEach((ch, i) => {
      const on = t - (t0 + i * 0.055);
      if (on < 0) { cx += ws[i] + sp; return; }
      const flick = on < 0.18 ? (Math.sin(on * 120 + i) > 0 ? 1 : 0.25) : 1;
      const jit = (1 - p) * 26;
      if (jit > 0.5) {
        g.globalCompositeOperation = "lighter";
        g.fillStyle = hexA(COL.rare, 0.55 * flick);
        g.fillText(ch, cx - jit * noise1(t * 30, i), y + jit * 0.2 * noise1(t * 21, i + 9));
        g.fillStyle = hexA("#ff3d7f", 0.45 * flick);
        g.fillText(ch, cx + jit * noise1(t * 27, i + 3), y);
        g.globalCompositeOperation = "source-over";
      }
      g.fillStyle = color; g.globalAlpha *= flick;
      g.fillText(ch, cx, y);
      g.globalAlpha /= flick;
      cx += ws[i] + sp;
    });
    return total;
  }

  // ------------------------------------------------------------ layers
  function background(t) {
    g.fillStyle = COL.bg; g.fillRect(0, 0, W, H);
    const gold = prog(t, T.burst, T.burst + 0.3) * (1 - 0.6 * prog(t, T.outro, T.outro + 1.2));
    let rg = g.createRadialGradient(540, 820, 50, 540, 820, 1000);
    rg.addColorStop(0, mix("#1d1d26", "#2a1e0b", gold));
    rg.addColorStop(1, "rgba(10,10,13,0)");
    g.fillStyle = rg; g.fillRect(0, 0, W, H);
    // moving HUD grid
    g.strokeStyle = hexA(COL.fg, 0.03); g.lineWidth = 1;
    const off = (t * 18) % 60;
    g.beginPath();
    for (let x = 0; x <= W; x += 60) { g.moveTo(x + 0.5, 0); g.lineTo(x + 0.5, H); }
    for (let y = -60 + off; y <= H; y += 60) { g.moveTo(0, y + 0.5); g.lineTo(W, y + 0.5); }
    g.stroke();
    // floor glow under LOOTY
    rg = g.createRadialGradient(540, 1700, 10, 540, 1700, 520);
    rg.addColorStop(0, hexA(gold > 0.1 ? COL.legendary : COL.accent, 0.13));
    rg.addColorStop(1, "rgba(0,0,0,0)");
    g.fillStyle = rg; g.fillRect(0, 1300, W, 620);
    // dust
    for (const d of dust) {
      const y = ((d.y - t * d.v) % H + H) % H;
      g.fillStyle = hexA(gold > 0.2 ? COL.legendary : COL.fg, d.a * (0.6 + 0.4 * Math.sin(t * 2 + d.ph)));
      g.beginPath(); g.arc(d.x + 10 * Math.sin(t * 0.5 + d.ph), y, d.s, 0, 7); g.fill();
    }
  }

  function topLogo(t) {
    const a = 1 - prog(t, T.outro, T.outro + 0.4);
    if (a <= 0) return;
    g.save(); g.globalAlpha = a;
    wordmark(540, 215, 92, 0.08, t);
    const sp = prog(t, 0.8, 1.3);
    g.globalAlpha = a * (1 - prog(t, T.burst, T.burst + 0.25));
    text(g, "DROP SYSTEM // ONLINE".slice(0, Math.floor(sp * 21)), 540, 290, F.mono(24), COL.muted, "center", 4);
    g.restore();
  }

  function crate(t) {
    if (t < T.crate || t > T.burst + 0.02) return;
    const s = ease.outBack(prog(t, T.crate, T.crate + 0.5), 2.2);
    const shakeP = prog(t, C.maybe.start, T.burst);
    let kick = 0;
    for (const c of CHIPS) { const x = t - C[c.cue].start; if (x > 0 && x < 0.5) kick += Math.exp(-x * 9) * Math.sin(x * 60); }
    const rot = shakeP ** 2 * 0.09 * Math.sin(t * 47) + kick * 0.06;
    const pulse = 1 + 0.12 * ease.inCubic(prog(t, T.rise, T.burst)) + 0.015 * Math.sin(t * 30) * shakeP;
    let seam = COL.accent;
    for (const c of CHIPS) if (t >= C[c.cue].start) seam = c.col;
    const lit = 0.45 + 0.55 * shakeP + kick * 0.3;
    g.save();
    g.translate(CRATE.x + shakeP ** 2 * 6 * Math.sin(t * 61), CRATE.y + 12 * Math.sin(t * 2.1));
    g.rotate(rot); g.scale(s * pulse, s * pulse);
    // light leaks during the riser
    const leak = prog(t, T.rise, T.burst);
    if (leak > 0) {
      g.save(); g.globalCompositeOperation = "lighter";
      for (let i = 0; i < 10; i++) {
        const a = i / 10 * Math.PI * 2 + t * 0.8;
        const grd = g.createLinearGradient(0, 0, Math.cos(a) * 700, Math.sin(a) * 700);
        grd.addColorStop(0, hexA(COL.legendary, 0.35 * leak)); grd.addColorStop(1, hexA(COL.legendary, 0));
        g.fillStyle = grd; g.beginPath(); g.moveTo(0, 0);
        g.arc(0, 0, 700, a - 0.05, a + 0.05); g.closePath(); g.fill();
      }
      g.restore();
    }
    // body
    glow(hexA(seam, 0.5 * lit), 50);
    const bodyG = g.createLinearGradient(0, -120, 0, 130);
    bodyG.addColorStop(0, "#22222b"); bodyG.addColorStop(1, COL.surface);
    rrect(g, -150, -110, 300, 240, 20); g.fillStyle = bodyG; g.fill(); noGlow();
    g.lineWidth = 4; g.strokeStyle = COL.borderStrong; g.stroke();
    g.fillStyle = "#17171d"; g.fillRect(-112, -110, 34, 240); g.fillRect(78, -110, 34, 240);
    brackets(g, -125, -85, 250, 190, 34, hexA(seam, 0.9), 4);
    glow(seam, 30 * lit);
    text(g, "?", 0, 12, F.display(150), seam);
    noGlow();
    text(g, "LT-CRATE // 001", 0, 106, F.mono(16), COL.dim, "center", 2);
    // lid + glowing seam
    const lidLift = 6 * shakeP * Math.abs(Math.sin(t * 23)) + 14 * leak;
    glow(seam, 40 * lit);
    g.fillStyle = hexA(seam, 0.85 * lit); g.fillRect(-146, -116 - lidLift, 292, 6 + lidLift);
    noGlow();
    rrect(g, -168, -168 - lidLift, 336, 60, 14); g.fillStyle = "#26262f"; g.fill();
    g.lineWidth = 4; g.strokeStyle = COL.borderStrong; g.stroke();
    text(g, "LOOTFORM", 0, -138 - lidLift, F.display(26), COL.muted, "center", 6);
    g.restore();
  }

  function chips(t) {
    const out = prog(t, T.burst, T.burst + 0.35);
    if (out >= 1) return;
    for (const c of CHIPS) {
      const t0 = C[c.cue].start;
      if (t < t0) continue;
      const p = ease.outBack(prog(t, t0, t0 + 0.4), 2.4);
      const hot = Math.exp(-(t - t0) * 2.2);
      const mystery = c.label === "???";
      g.save();
      g.translate(c.x, c.y + (1 - p) * 40 - out * 60);
      g.scale(p * (1 + out * 0.3), p * (1 + out * 0.3));
      g.globalAlpha = (1 - out) * clamp(p * 2);
      glow(hexA(c.col, 0.6 * hot + 0.15), 20 + 30 * hot);
      rrect(g, -105, -40, 210, 80, 10);
      g.fillStyle = hexA(c.col, 0.1 + 0.15 * hot); g.fill(); noGlow();
      g.lineWidth = 3; g.strokeStyle = mystery ? hexA(c.col, 0.5 + 0.5 * Math.abs(Math.sin(t * 9))) : c.col;
      if (mystery) g.setLineDash([12, 8]);
      g.stroke(); g.setLineDash([]);
      text(g, c.label, 0, 2, F.display(34), mystery ? COL.fg : c.col, "center", 4);
      g.restore();
    }
  }

  function rays(t) {
    const a = prog(t, T.burst, T.burst + 0.4) * (1 - prog(t, T.outro, T.outro + 0.6));
    if (a <= 0) return;
    g.save(); g.translate(CRATE.x, CRATE.y - 10); g.rotate(t * 0.25);
    g.globalCompositeOperation = "lighter";
    for (let i = 0; i < 16; i++) {
      const ang = i / 16 * Math.PI * 2;
      const grd = g.createRadialGradient(0, 0, 40, 0, 0, 1100);
      grd.addColorStop(0, hexA(COL.legendary, 0.22 * a)); grd.addColorStop(1, hexA(COL.legendary, 0));
      g.fillStyle = grd; g.beginPath(); g.moveTo(0, 0); g.arc(0, 0, 1100, ang - 0.07, ang + 0.07); g.closePath(); g.fill();
    }
    g.restore();
  }

  function hoodieIcon(scale) {
    g.save(); g.scale(scale, scale);
    const grad = g.createLinearGradient(-150, -200, 150, 170);
    grad.addColorStop(0, "#ffe2a3"); grad.addColorStop(0.45, COL.legendary); grad.addColorStop(1, "#9c5f12");
    g.fillStyle = grad;
    g.beginPath(); // sleeves + body
    g.moveTo(-70, -120); g.lineTo(-150, -70); g.lineTo(-195, 90); g.lineTo(-145, 105); g.lineTo(-115, 10);
    g.lineTo(-112, 160); g.lineTo(112, 160); g.lineTo(115, 10); g.lineTo(145, 105); g.lineTo(195, 90);
    g.lineTo(150, -70); g.lineTo(70, -120); g.closePath(); g.fill();
    g.beginPath(); g.ellipse(0, -135, 82, 70, 0, 0, Math.PI * 2); g.fill(); // hood
    g.fillStyle = "rgba(40,24,4,0.55)";
    g.beginPath(); g.ellipse(0, -128, 48, 40, 0, 0, Math.PI * 2); g.fill();
    g.beginPath(); g.moveTo(-70, 60); g.lineTo(70, 60); g.lineTo(88, 125); g.lineTo(-88, 125); g.closePath(); g.fill();
    g.fillStyle = "rgba(40,24,4,0.35)"; g.fillRect(-112, 138, 224, 22);
    g.strokeStyle = "rgba(255,240,200,0.9)"; g.lineWidth = 5; g.lineCap = "round";
    g.beginPath(); g.moveTo(-22, -92); g.lineTo(-26, -20); g.moveTo(22, -92); g.lineTo(26, -20); g.stroke();
    g.restore();
  }

  function card(t) {
    if (t < T.burst) return;
    const out = prog(t, T.outro, T.outro + 0.5);
    if (out >= 1) return;
    const p = prog(t, T.burst, T.burst + 0.9);
    const s = lerp(0.25, 1, ease.outBack(p, 1.3)) * (1 + 0.15 * ease.inCubic(out));
    const spin = (1 - ease.outCubic(p)) * Math.PI * 4;
    const sx = Math.cos(spin);
    const w = 470, h = 640;
    g.save();
    g.translate(CRATE.x, CRATE.y + 45 + 8 * Math.sin(t * 1.8));
    g.rotate(0.02 * Math.sin(t * 1.3));
    g.scale(s * Math.max(Math.abs(sx), 0.02), s);
    g.globalAlpha = 1 - out;
    if (sx < 0) { // back face
      rrect(g, -w / 2, -h / 2, w, h, 16); g.fillStyle = COL.raised; g.fill();
      g.lineWidth = 4; g.strokeStyle = COL.legendary; g.stroke();
      brackets(g, -w / 2 + 20, -h / 2 + 20, w - 40, h - 40, 60, COL.accent, 5);
      text(g, "LF", 0, 0, F.display(140), COL.accent);
      g.restore(); return;
    }
    glow(hexA(COL.legendary, 0.8), 70);
    rrect(g, -w / 2, -h / 2, w, h, 16);
    const bg = g.createLinearGradient(0, -h / 2, 0, h / 2);
    bg.addColorStop(0, "#2a1f0c"); bg.addColorStop(1, "#0f0c07");
    g.fillStyle = bg; g.fill(); noGlow();
    g.save(); g.clip();
    g.strokeStyle = hexA(COL.legendary, 0.07); g.lineWidth = 2;
    for (let i = -h; i < w + h; i += 22) { g.beginPath(); g.moveTo(-w / 2 + i, -h / 2); g.lineTo(-w / 2 + i - h, h / 2); g.stroke(); }
    const rg = g.createRadialGradient(0, -60, 10, 0, -60, 300);
    rg.addColorStop(0, hexA(COL.legendary, 0.45)); rg.addColorStop(1, hexA(COL.legendary, 0));
    g.fillStyle = rg; g.fillRect(-w / 2, -h / 2, w, h);
    g.translate(0, -60); hoodieIcon(0.95); g.translate(0, 60);
    // foil shimmer sweep
    const sw = ((t - T.burst) * 0.7) % 1.6;
    const sxp = lerp(-w, w, sw / 1.2);
    const sh = g.createLinearGradient(sxp - 120, -h / 2, sxp + 120, h / 2);
    sh.addColorStop(0, "rgba(255,255,255,0)"); sh.addColorStop(0.5, "rgba(255,245,220,0.35)"); sh.addColorStop(1, "rgba(255,255,255,0)");
    g.globalCompositeOperation = "lighter"; g.fillStyle = sh; g.fillRect(-w / 2, -h / 2, w, h);
    g.restore();
    g.lineWidth = 3; g.strokeStyle = COL.legendary; rrect(g, -w / 2 + 10, -h / 2 + 10, w - 20, h - 20, 10); g.stroke();
    g.lineWidth = 1.5; g.strokeStyle = hexA(COL.legendary, 0.6); rrect(g, -w / 2 + 22, -h / 2 + 22, w - 44, h - 44, 6); g.stroke();
    const pk = 1 + 0.25 * Math.max(0, Math.sin(t * 5));
    glow(COL.legendary, 20);
    brackets(g, -w / 2 - 14, -h / 2 - 14, w + 28, h + 28, 58 * pk, "#ffd88a", 6);
    noGlow();
    text(g, "GRADE // L", -w / 2 + 44, -h / 2 + 52, F.mono(20), hexA(COL.legendary, 0.9), "left", 2);
    text(g, "#0001", w / 2 - 44, -h / 2 + 52, F.mono(20), hexA(COL.legendary, 0.9), "right", 2);
    glow(hexA(COL.legendary, 0.9), 25);
    text(g, "LEGENDARY", 0, 168, F.display(66), "#ffd88a", "center", 6);
    noGlow();
    text(g, "LOOTFORM HOODIE", 0, 228, F.display(30, 600), COL.fg, "center", 4);
    text(g, "SERIES 01", 0, 272, F.mono(20), COL.muted, "center", 4);
    g.restore();
  }

  function burstFx(t) {
    const x = t - T.burst;
    if (x < 0 || x > 2.4) return;
    g.save(); g.globalCompositeOperation = "lighter";
    for (const [delay, max, lw] of [[0, 950, 14], [0.12, 700, 6]]) {
      const p = prog(x, delay, delay + 0.9);
      if (p <= 0 || p >= 1) continue;
      g.strokeStyle = hexA(COL.legendary, (1 - p) * 0.9); g.lineWidth = lw * (1 - p) + 1;
      g.beginPath(); g.arc(CRATE.x, CRATE.y, ease.outExpo(p) * max, 0, 7); g.stroke();
    }
    const k = 2.4;
    for (const s of shards) {
      if (x > s.life) continue;
      const d = (1 - Math.exp(-k * x)) / k;
      const px = CRATE.x + s.vx * d, py = CRATE.y + s.vy * d + 520 * x * x;
      g.save(); g.translate(px, py); g.rotate(s.rot + s.spin * x);
      g.fillStyle = hexA(s.col.startsWith("#") ? s.col : COL.legendary, 1 - x / s.life);
      g.fillRect(-s.s / 2, -s.s / 2, s.s, s.s * 0.6);
      g.restore();
    }
    g.restore();
  }

  function arm(side, a1, a2, P) {
    const sx = side * 128, sy = -335;
    const up = 125, fo = 118;
    const ex = sx + side * Math.sin(a1) * up, ey = sy + Math.cos(a1) * up;
    const a = a1 + a2;
    const hx = ex + side * Math.sin(a) * fo, hy = ey + Math.cos(a) * fo;
    g.lineCap = "round"; g.lineJoin = "round";
    for (const [lw, col] of [[66, COL.borderStrong], [58, "#20202a"]]) {
      g.lineWidth = lw; g.strokeStyle = col;
      g.beginPath(); g.moveTo(sx, sy); g.lineTo(ex, ey); g.lineTo(hx, hy); g.stroke();
    }
    g.lineWidth = 12; g.strokeStyle = hexA(COL.accent, 0.8); // cuff
    const cx = lerp(ex, hx, 0.82), cy = lerp(ey, hy, 0.82);
    const nx = Math.cos(a) * 26 * side, ny = -Math.sin(a) * 26;
    g.beginPath(); g.moveTo(cx - nx, cy - ny); g.lineTo(cx + nx, cy + ny); g.stroke();
    g.fillStyle = COL.fg; g.strokeStyle = "#c9c8c2"; g.lineWidth = 3;
    g.beginPath(); g.arc(hx, hy, 34, 0, 7); g.fill(); g.stroke();
  }

  function looty(t, f) {
    if (t < 0.22) return;
    const P = poseAt(t);
    const m = mouthAt(f);
    // entrance drop + landing squash, cheer hop
    const fall = prog(t, 0.22, T.land);
    let y = -1500 * (1 - ease.inCubic(fall));
    let sq = 0;
    const land = t - T.land;
    if (land > 0) sq += 0.2 * Math.exp(-land * 7) * Math.cos(land * 2 * Math.PI * 2.6);
    const hop = prog(t, T.burst, T.burst + 0.55);
    if (hop > 0 && hop < 1) y -= 190 * Math.sin(Math.PI * hop);
    const land2 = t - (T.burst + 0.55);
    if (land2 > 0) sq += 0.14 * Math.exp(-land2 * 7) * Math.cos(land2 * 2 * Math.PI * 2.6);
    sq += P.crouch * 0.06;
    const breathe = 0.012 * Math.sin(t * 2.4);
    const scaleY = 1 - sq + breathe, scaleX = 1 + sq * 0.7;
    const jumpH = Math.max(0, -y);

    g.save();
    g.translate(540, 1700);
    // shadow
    g.fillStyle = `rgba(0,0,0,${0.55 * (1 - clamp(jumpH / 700))})`;
    g.beginPath(); g.ellipse(0, 6, 175 * (1 - clamp(jumpH / 900) * 0.5), 26, 0, 0, 7); g.fill();
    g.translate(0, y + P.crouch * 18);
    g.rotate(P.lean);
    g.scale(scaleX, scaleY);

    // legs + sneakers
    g.fillStyle = "#15151b";
    rrect(g, -78, -125, 56, 100, 18); g.fill(); rrect(g, 22, -125, 56, 100, 18); g.fill();
    for (const s of [-1, 1]) {
      rrect(g, s === -1 ? -112 : 8, -44, 104, 50, 22); g.fillStyle = COL.fg; g.fill();
      g.fillStyle = COL.accent; g.fillRect(s === -1 ? -108 : 12, -4, 96, 7);
      g.strokeStyle = "#9a9aa3"; g.lineWidth = 3;
      for (let i = 0; i < 3; i++) { const lx = (s === -1 ? -80 : 36) + i * 14; g.beginPath(); g.moveTo(lx, -36); g.lineTo(lx + 8, -26); g.stroke(); }
    }
    // torso (hoodie)
    const tg = g.createLinearGradient(0, -380, 0, -90);
    tg.addColorStop(0, "#272731"); tg.addColorStop(1, "#17171d");
    g.beginPath();
    g.moveTo(-168, -100); g.lineTo(-152, -300);
    g.quadraticCurveTo(-145, -372, -70, -378); g.lineTo(70, -378);
    g.quadraticCurveTo(145, -372, 152, -300); g.lineTo(168, -100);
    g.quadraticCurveTo(168, -82, 150, -82); g.lineTo(-150, -82); g.quadraticCurveTo(-168, -82, -168, -100);
    g.closePath(); g.fillStyle = tg; g.fill(); g.lineWidth = 4; g.strokeStyle = COL.borderStrong; g.stroke();
    g.fillStyle = "#121217"; g.fillRect(-165, -118, 330, 34);
    g.strokeStyle = "#1f1f26"; g.lineWidth = 2;
    for (let x = -155; x < 160; x += 12) { g.beginPath(); g.moveTo(x, -116); g.lineTo(x, -86); g.stroke(); }
    g.beginPath(); g.moveTo(-95, -225); g.lineTo(95, -225); g.lineTo(118, -135); g.lineTo(-118, -135); g.closePath();
    g.fillStyle = "#1c1c23"; g.fill(); g.strokeStyle = COL.borderStrong; g.lineWidth = 3; g.stroke();
    // chest mark
    brackets(g, -44, -318, 88, 58, 14, COL.accent, 3);
    glow(COL.accent, 14); text(g, "LF", 0, -288, F.display(34), COL.accent); noGlow();
    // drawstrings
    g.strokeStyle = COL.fg; g.lineWidth = 6; g.lineCap = "round";
    const sw = Math.sin(t * 3) * 4;
    g.beginPath(); g.moveTo(-34, -372); g.lineTo(-38 + sw, -300); g.moveTo(34, -372); g.lineTo(38 + sw, -300); g.stroke();
    g.fillStyle = COL.accent; g.beginPath(); g.arc(-38 + sw, -296, 7, 0, 7); g.arc(38 + sw, -296, 7, 0, 7); g.fill();

    // head
    g.save();
    g.translate(0, -545 - 5 * m);
    g.rotate(0.035 * m * Math.sin(t * 9) + P.lean * 0.5);
    for (const s of [-1, 1]) { // hood ears
      g.save(); g.rotate(s * 0.62);
      g.beginPath(); g.moveTo(-62, -150); g.quadraticCurveTo(0, -330, 62, -150); g.closePath();
      g.fillStyle = "#1e1e26"; g.fill(); g.strokeStyle = COL.borderStrong; g.lineWidth = 4; g.stroke();
      g.beginPath(); g.moveTo(-30, -172); g.quadraticCurveTo(0, -280, 30, -172);
      g.strokeStyle = hexA(COL.accent, 0.8); g.lineWidth = 5; g.stroke();
      g.restore();
    }
    g.beginPath(); g.arc(0, 0, 188, 0, 7);
    const hg = g.createRadialGradient(-60, -80, 20, 0, 0, 200);
    hg.addColorStop(0, "#2d2d37"); hg.addColorStop(1, "#18181e");
    g.fillStyle = hg; g.fill(); g.lineWidth = 4; g.strokeStyle = COL.borderStrong; g.stroke();
    g.beginPath(); g.arc(0, 8, 152, 0, 7); g.fillStyle = "#0e0e12"; g.fill();
    g.lineWidth = 10; g.strokeStyle = "#2a2a33"; g.stroke();
    // visor
    const gold = prog(t, T.burst, T.burst + 0.25) * (1 - prog(t, T.outro, T.outro + 0.8));
    const eyeCol = mix(COL.accent, COL.legendary, gold);
    glow(hexA(COL.accent, 0.5), 28);
    rrect(g, -124, -88, 248, 196, 84); g.fillStyle = "#050507"; g.fill(); noGlow();
    g.lineWidth = 3; g.strokeStyle = hexA(COL.accent, 0.35); g.stroke();
    g.save(); rrect(g, -124, -88, 248, 196, 84); g.clip();
    const ref = g.createLinearGradient(-120, -90, 60, 40);
    ref.addColorStop(0, "rgba(255,255,255,0.10)"); ref.addColorStop(0.35, "rgba(255,255,255,0.0)");
    g.fillStyle = ref; g.fillRect(-124, -88, 248, 196);
    g.fillStyle = "rgba(255,255,255,0.025)";
    for (let yy = -88; yy < 110; yy += 6) g.fillRect(-124, yy, 248, 2); // LED scanlines
    g.restore();
    const lx = P.look[0] * 20, ly = P.look[1] * 16;
    const bl = blinkAt(t);
    glow(eyeCol, 22); g.fillStyle = eyeCol; g.strokeStyle = eyeCol; g.lineCap = "round";
    for (const s of [-1, 1]) {
      const ex = s * 50 + lx, ey = -18 + ly;
      if (P.eyes === "happy") {
        g.lineWidth = 13; g.beginPath(); g.arc(ex, ey + 14, 22, Math.PI * 1.15, Math.PI * 1.85); g.stroke();
      } else if (P.eyes === "wow") {
        g.lineWidth = 9; g.beginPath(); g.arc(ex, ey, 25 * Math.max(bl, 0.2), 0, 7); g.stroke();
        g.beginPath(); g.arc(ex, ey, 8, 0, 7); g.fill();
      } else {
        const eh = 64 * Math.max(bl, 0.12);
        rrect(g, ex - 17, ey - eh / 2, 34, eh, 17); g.fill();
      }
    }
    // LED mouth (audio-driven)
    const shape = [0.45, 0.8, 1, 0.8, 0.45];
    const smile = P.eyes === "happy" || P.eyes === "normal";
    for (let i = 0; i < 5; i++) {
      const jitter = 0.65 + 0.35 * noise1(t * 22, i * 7);
      const hh = 7 + m * 48 * shape[i] * jitter;
      const bx = (i - 2) * 17 + lx * 0.6;
      const by = 52 + ly * 0.5 + (smile ? (2 - Math.abs(i - 2)) * 4 * (1 - m) : 0);
      rrect(g, bx - 5, by - hh / 2, 10, hh, 5); g.fill();
    }
    noGlow();
    g.restore();

    // arms in front
    const wave = P.wave * 0.5 * Math.sin(t * 11);
    arm(-1, P.L[0], P.L[1], P);
    arm(1, P.R[0], P.R[1] + wave, P);
    g.restore();
  }

  function captions(t) {
    const c = TL.captions.find((c) => t >= c.start && t <= c.end);
    if (!c) return;
    const a = prog(t, c.start, c.start + 0.15) * (1 - prog(t, c.end - 0.15, c.end));
    const big = c.text === "LEGENDARY!";
    let size = big ? 64 : 48;
    const font = (s) => (big ? F.display(s) : F.thai(s));
    g.font = font(size);
    let tw = g.measureText(c.text).width;
    if (tw > 880) { size = Math.floor(size * 880 / tw); g.font = font(size); tw = g.measureText(c.text).width; }
    const bw = tw + 80, bh = size + 44, y = 1788 + (1 - a) * 14;
    g.save(); g.globalAlpha = a;
    rrect(g, 540 - bw / 2, y - bh / 2, bw, bh, 12);
    g.fillStyle = "rgba(10,10,13,0.78)"; g.fill();
    g.lineWidth = 2; g.strokeStyle = COL.border; g.stroke();
    g.fillStyle = big ? COL.legendary : COL.accent; g.fillRect(540 - bw / 2, y - bh / 2 + 12, 5, bh - 24);
    if (big) glow(COL.legendary, 20);
    text(g, c.text, 540, y + 2, font(size), big ? "#ffd88a" : COL.fg, "center", big ? 6 : 0);
    noGlow(); g.restore();
  }

  function endCard(t) {
    const p = prog(t, T.outro + 0.25, T.outro + 1.2);
    if (p <= 0) return;
    g.save();
    g.globalAlpha = clamp(p * 1.5);
    const ty = lerp(640, 600, ease.outCubic(p));
    glow(hexA(COL.accent, 0.35), 30);
    wordmark(540, ty, 150, T.outro + 0.25, t);
    noGlow();
    const segs = [COL.common, COL.rare, COL.epic, COL.legendary];
    segs.forEach((col, i) => {
      const sp = ease.outCubic(prog(t, T.outro + 0.7 + i * 0.08, T.outro + 1.1 + i * 0.08));
      g.fillStyle = col; g.fillRect(540 - 250 + i * 128, ty + 100, 116 * sp, 8);
    });
    const tp = prog(t, T.outro + 0.9, T.outro + 1.4);
    g.globalAlpha = tp;
    text(g, "เสื้อทุกตัว คือการสุ่ม 1 ครั้ง", 540, ty + 175 + (1 - tp) * 16, F.thai(46), COL.fg);
    const e = t - T.end;
    if (e > 0) {
      const sp = ease.outBack(prog(e, 0, 0.35), 2);
      g.globalAlpha = 1;
      g.save(); g.translate(540, ty + 300); g.scale(lerp(1.5, 1, sp), lerp(1.5, 1, sp));
      g.globalAlpha = clamp(e * 5);
      rrect(g, -230, -48, 460, 96, 8); g.fillStyle = hexA(COL.accent, 0.1 + 0.4 * Math.exp(-e * 5)); g.fill();
      brackets(g, -230, -48, 460, 96, 22, COL.accent, 4);
      glow(COL.accent, 18);
      text(g, "COMING SOON", -10, 2, F.display(54), COL.accent, "center", 8);
      noGlow();
      if (Math.floor(e * 2.5) % 2 === 0) { g.fillStyle = COL.accent; g.fillRect(190, -18, 16, 38); }
      g.restore();
    }
    g.restore();
  }

  function hud(t, f) {
    const a = ease.outCubic(prog(t, 0, 0.5));
    brackets(g, 40, 40, W - 80, H - 80, 70 * a, COL.borderStrong, 4);
    g.save(); g.globalAlpha = a;
    g.fillStyle = Math.floor(t * 2) % 2 ? COL.accent : hexA(COL.accent, 0.3);
    g.beginPath(); g.arc(82, 92, 7, 0, 7); g.fill();
    text(g, "LOOTFORM.TV", 100, 93, F.mono(22), COL.muted, "left", 3);
    const fr = f % TL.fps, s = Math.floor(t);
    const tc = `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}:${String(fr).padStart(2, "0")}`;
    text(g, "TC " + tc, W - 72, 93, F.mono(22), COL.muted, "right", 2);
    text(g, "LT://PULL_SEQ_001", 72, H - 58, F.mono(18), COL.dim, "left", 2);
    text(g, "SEASON 01", W - 72, H - 58, F.mono(18), COL.dim, "right", 2);
    g.restore();
  }

  function post(t) {
    const fl = t - T.burst;
    if (fl > 0 && fl < 0.6) { g.fillStyle = `rgba(255,248,230,${0.9 * (1 - fl / 0.6) ** 2})`; g.fillRect(0, 0, W, H); }
    const vg = g.createRadialGradient(540, 900, 500, 540, 960, 1250);
    vg.addColorStop(0, "rgba(0,0,0,0)"); vg.addColorStop(1, "rgba(0,0,0,0.6)");
    g.fillStyle = vg; g.fillRect(0, 0, W, H);
    const fin = Math.max(prog(t, TL.duration - 0.7, TL.duration - 0.05), 1 - prog(t, 0, 0.25));
    if (fin > 0) { g.fillStyle = `rgba(0,0,0,${fin})`; g.fillRect(0, 0, W, H); }
  }

  function draw(t, f) {
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.globalAlpha = 1; g.globalCompositeOperation = "source-over";
    // camera punch on the burst
    const sh = t - T.burst;
    const shake = sh > 0 && sh < 0.6 ? 14 * (1 - sh / 0.6) : 0;
    background(t);
    g.save();
    g.translate(shake * noise1(t * 40, 1), shake * noise1(t * 40, 2));
    topLogo(t);
    rays(t);
    crate(t);
    chips(t);
    card(t);
    burstFx(t);
    endCard(t);
    looty(t, f);
    g.restore();
    captions(t);
    hud(t, f);
    post(t);
  }

  window.scene = { setup, draw };
})();
