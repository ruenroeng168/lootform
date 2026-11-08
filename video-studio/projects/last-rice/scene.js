// Illustrated storybook — "ข้าวห่อสุดท้าย" choose-your-ending fable, part 1 (original). Full-bleed painted scenes,
// hand-drawn coloured characters, living details (clouds, stars, steam, sound waves), no host.
(function () {
  const { clamp, lerp, prog, ease, rng, noise1, hexA } = window.L;
  const { P, Board, drawHand, STYLE_BG } = window.SK;
  const W = 1080, H = 1920;
  const INK = "#2a2420", RED = "#e0483e", ORANGE = "#f08a24", MUTED = "#6b6258", CREAM = "#fff8ec";
  const F = {
    h: (s) => `700 ${s}px "Mali"`, t: (s) => `600 ${s}px "Mali"`, hand: (s) => `400 ${s}px "Sriracha"`,
    cap: (s) => `600 ${s}px "IBM Plex Sans Thai"`,
  };
  const COL = {
    body: "#e0822f", bodyD: "#a9561c", wing: "#b9561d", comb: "#e0322b", beak: "#f4c430", leg: "#e0a82b",
    skin: "#f1c4a0", skinD: "#c98f6a", wood: "#c8915a", woodD: "#8a5a32", roof: "#9b3d1a", leaf: "#3f9a4a",
    leafD: "#2a6e33", field: "#8cc56b", fieldD: "#6fa64f", straw: "#e8c66a",
  };
  let g, TL, C, b, paper, STYLE = "ink";
  const M = (cue, k) => (k === 0 ? C[cue].start : C[cue].marks[k - 1] ?? C[cue].end);
  const crows = [], crashes = [], pops = [];

  function setup(canvas, tl) {
    g = canvas.getContext("2d"); TL = tl; C = tl.cues;
    STYLE = (tl.data && tl.data.style) || "ink";
    b = new Board(g, { speed: 2100, writeSpeed: 1100, style: STYLE });
    paper = document.createElement("canvas"); paper.width = paper.height = 512;
    const pg = paper.getContext("2d"); pg.fillStyle = "#f6efe2"; pg.fillRect(0, 0, 512, 512);
    const r = rng(2);
    for (let i = 0; i < 3000; i++) { pg.fillStyle = `rgba(80,60,30,${0.01 + r() * 0.025})`; pg.fillRect(r() * 512, r() * 512, 1 + r() * 2, 1 + r() * 2); }
    buildScenes();
    b.settleCamera(0.15, 0.4);
  }

  // ------------------------------------------------------------ painted backgrounds (live, wash-in)
  function sky(g, t, t0, kind) {
    const p = ease.inOutCubic(prog(t, t0, t0 + 0.9));
    g.save(); g.beginPath(); g.rect(0, 0, W * p + 2, H); g.clip();
    const pal = {
      dawn: ["#ffb38a", "#ffe2b8", "#fff4dc"], day: ["#7cc8f2", "#bfe6fb", "#eef9ff"],
      night: ["#0b1633", "#1b2f5e", "#2c4a7a"], noon: ["#4fb3ef", "#a9dcfb", "#f2fbff"], room: ["#f6d9a8", "#f9e7c5", "#fdf3df"],
      evening: ["#e8875a", "#f6b98a", "#fde3c2"], storm: ["#3d4654", "#5d6877", "#8a95a3"],
    }[kind];
    const palS = STYLE_BG.palette(STYLE, kind, pal); pal.splice(0, 3, ...palS);
    const gr = g.createLinearGradient(0, 0, 0, 1350);
    gr.addColorStop(0, pal[0]); gr.addColorStop(0.6, pal[1]); gr.addColorStop(1, pal[2]);
    g.fillStyle = gr; g.fillRect(0, 0, W, H);
    if (kind === "dawn") sun(g, 820, 1180, 120, "#ffd36b", t);
    if (kind === "day") sun(g, 880, 260, 90, "#ffe27a", t);
    if (kind === "noon") sun(g, 540, 230, 110, "#fff07a", t);
    if (kind === "night") {
      const r = rng(9);
      for (let i = 0; i < 90; i++) {
        const x = r() * W, y = r() * 1150, tw = 0.5 + 0.5 * Math.sin(t * (1 + r() * 3) + i);
        g.fillStyle = `rgba(255,250,220,${0.3 + 0.6 * tw})`; g.beginPath(); g.arc(x, y, 1.2 + r() * 2.2, 0, 7); g.fill();
      }
      g.fillStyle = "#fff6cf"; g.beginPath(); g.arc(860, 260, 80, 0, 7); g.fill();
      g.fillStyle = "#1b2f5e"; g.beginPath(); g.arc(895, 235, 72, 0, 7); g.fill();
    }
    if (kind === "evening") sun(g, 900, 1150, 110, "#ffb86b", t);
    if (kind === "storm") { g.fillStyle = "rgba(60,66,78,0.9)"; [[200, 260], [620, 200], [950, 330]].forEach(([x, y], i) => { const cx = ((x + t * 25 + i * 90) % 1300) - 110; g.beginPath(); g.ellipse(cx, y, 230, 90, 0, 0, 7); g.ellipse(cx + 120, y - 50, 150, 90, 0, 0, 7); g.fill(); }); }
    else if (kind !== "night" && kind !== "room") clouds(g, t, kind === "dawn" || kind === "evening" ? 0.7 : 1);
    if (kind !== "room") {
      // distant hills + field
      g.fillStyle = STYLE === "silhouette" ? "#2a1f2e" : STYLE === "chalk" ? "#2c4a42" : kind === "night" ? "#22406a" : kind === "storm" ? "#5b7466" : kind === "evening" ? "#c9a46a" : "#9fd38a";
      if (STYLE === "paper") { g.shadowColor = "rgba(80,40,10,0.35)"; g.shadowBlur = 16; g.shadowOffsetY = -6; }
      g.beginPath(); g.moveTo(0, 1250); g.quadraticCurveTo(250, 1120, 520, 1230); g.quadraticCurveTo(800, 1110, 1080, 1220); g.lineTo(1080, 1400); g.lineTo(0, 1400); g.fill();
      const fg = g.createLinearGradient(0, 1300, 0, H);
      const road = kind === "evening" || kind === "storm";   // market lane instead of rice field
      fg.addColorStop(0, kind === "night" ? "#2d5a4a" : road ? (kind === "storm" ? "#6e6a66" : "#c9b394") : COL.field);
      fg.addColorStop(1, kind === "night" ? "#1c3b33" : road ? (kind === "storm" ? "#4e4a47" : "#a8916f") : COL.fieldD);
      const gc = STYLE_BG.ground(STYLE, null);
      if (gc) { const f2 = g.createLinearGradient(0, 1300, 0, H); f2.addColorStop(0, gc[0]); f2.addColorStop(1, gc[1]); g.fillStyle = f2; } else g.fillStyle = fg;
      g.fillRect(0, 1320, W, H - 1320);
      g.strokeStyle = kind === "night" ? "rgba(255,255,255,0.05)" : "rgba(40,90,30,0.18)"; g.lineWidth = 4;
      for (let i = 0; i < 14; i++) { g.beginPath(); g.moveTo(-200 + i * 110, H); g.lineTo(380 + i * 30, 1330); g.stroke(); }
    } else {
      g.fillStyle = "#c89a62"; g.fillRect(0, 1380, W, H - 1380);
      g.fillStyle = "rgba(120,80,40,0.25)"; for (let x = 0; x < W; x += 120) g.fillRect(x, 1380, 4, H - 1380);
    }
    STYLE_BG.overlay(g, STYLE, W, H, t);
    g.restore();
  }
  function sun(g, x, y, r, col, t) {
    if (STYLE === "chalk") { g.save(); g.strokeStyle = "rgba(255,214,150,0.85)"; g.lineWidth = 6; g.setLineDash([14, 5]); g.beginPath(); g.arc(x, y, r, 0, 7); g.stroke();
      for (let i = 0; i < 12; i++) { const a = i / 12 * Math.PI * 2; g.beginPath(); g.moveTo(x + Math.cos(a) * (r + 18), y + Math.sin(a) * (r + 18)); g.lineTo(x + Math.cos(a) * (r + 48), y + Math.sin(a) * (r + 48)); g.stroke(); } g.restore(); return; }
    if (STYLE === "paper") { g.save(); g.shadowColor = "rgba(80,40,10,0.35)"; g.shadowBlur = 14; g.shadowOffsetY = 8; g.fillStyle = col; g.beginPath(); g.arc(x, y, r, 0, 7); g.fill(); g.restore(); return; }
    const gl = g.createRadialGradient(x, y, r * 0.4, x, y, r * 2.4);
    gl.addColorStop(0, hexA(col.length === 7 ? col : "#ffe27a", 0.55)); gl.addColorStop(1, "rgba(255,240,180,0)");
    g.fillStyle = gl; g.beginPath(); g.arc(x, y, r * 2.4, 0, 7); g.fill();
    g.fillStyle = col; g.beginPath(); g.arc(x, y, r * (1 + 0.02 * Math.sin(t * 2)), 0, 7); g.fill();
  }
  function clouds(g, t, a) {
    g.fillStyle = STYLE === "silhouette" ? "rgba(255,190,170,0.55)" : `rgba(255,255,255,${0.85 * a})`;
    if (STYLE === "chalk") { g.strokeStyle = "rgba(240,240,230,0.7)"; g.lineWidth = 5; g.setLineDash([12, 5]); g.fillStyle = "rgba(0,0,0,0)"; }
    if (STYLE === "paper") { g.shadowColor = "rgba(80,40,10,0.25)"; g.shadowBlur = 10; g.shadowOffsetY = 6; }
    [[120, 330, 1], [620, 420, 0.8], [980, 560, 0.7]].forEach(([x, y, s], i) => {
      const cx = ((x + t * (12 + i * 5)) % 1300) - 110;
      g.beginPath(); g.ellipse(cx, y, 110 * s, 42 * s, 0, 0, 7); g.ellipse(cx + 60 * s, y - 30 * s, 70 * s, 50 * s, 0, 0, 7);
      g.ellipse(cx - 60 * s, y - 14 * s, 60 * s, 38 * s, 0, 0, 7); g.fill(); if (STYLE === "chalk") g.stroke();
    });
    g.setLineDash([]); g.shadowColor = "transparent";
  }

  // ------------------------------------------------------------ characters & props (coloured strokes)
  const O = (x, y, s, extra = {}) => ({ x, y, s, w: 5 / s, color: INK, ...extra });
  function rooster(x, y, s = 1, opts = {}) {
    const o = O(x, y, s);
    const flip = opts.flip ? -1 : 1;
    const X = (d) => d.replace(/(-?\d+\.?\d*),(-?\d+\.?\d*)/g, (m, a, c) => `${(flip * a).toFixed(1)},${c}`);
    b.stroke(X("M-60,-150 Q-170,-260 -130,-335 Q-110,-250 -40,-190 Z"), { ...o, fill: "#1f6b4f", dur: 0.18 });
    b.stroke(X("M-70,-130 Q-205,-200 -195,-285 Q-140,-200 -50,-160 Z"), { ...o, fill: "#2b3a67", dur: 0.18 });
    b.stroke(X("M-75,-110 Q-195,-120 -215,-205 Q-150,-150 -55,-140 Z"), { ...o, fill: "#c0392b", dur: 0.18 });
    b.stroke(X("M-92,-110 Q-102,-192 -20,-212 Q40,-222 62,-252 L82,-302 Q102,-334 127,-302 Q142,-272 122,-232 Q112,-192 122,-152 Q127,-80 40,-60 Q-60,-50 -92,-110 Z"), { ...o, fill: COL.body, dur: 0.45 });
    b.stroke(X(opts.armsCrossed ? "M-20,-150 Q40,-185 100,-150 Q60,-115 -10,-125 Z" : "M-50,-140 Q0,-175 50,-140 Q20,-95 -40,-105 Z"), { ...o, fill: COL.wing, dur: 0.2 });
    b.stroke(X("M85,-307 Q80,-347 100,-342 Q105,-372 125,-357 Q140,-377 152,-347 Q162,-332 142,-307 Z"), { ...o, fill: COL.comb, dur: 0.2 });
    b.stroke(X("M130,-292 L172,-282 L132,-272 Z"), { ...o, fill: COL.beak, dur: 0.1 });
    b.stroke(X("M128,-270 Q141,-242 126,-236 Q115,-250 120,-270 Z"), { ...o, fill: COL.comb, dur: 0.1 });
    b.stroke(X("M12,-62 L2,0 M40,-62 L46,0 M-22,2 H22 M24,2 H68"), { ...o, color: COL.leg, w: 8 / s, dur: 0.15 });
    const ex = x + flip * 112 * s, ey = y - 294 * s;
    b.live((g, t) => {   // eye (blinks; star-eyes when excited)
      const st = opts.starEyesAt && t > opts.starEyesAt;
      if (st) { g.fillStyle = "#ffd84d"; g.font = F.h(44 * s); g.textAlign = "center"; g.textBaseline = "middle"; g.fillText("★", ex, ey + 2); return; }
      const bl = (t % 3.3) < 0.12 ? 0.15 : 1;
      g.fillStyle = INK; g.beginPath(); g.ellipse(ex, ey, 8 * s, 8 * s * bl, 0, 0, 7); g.fill();
      g.fillStyle = "#fff"; g.beginPath(); g.arc(ex + 2.5 * s, ey - 3 * s, 2.5 * s, 0, 7); g.fill();
    }, { t0: b.cursor });
    if (opts.crowAt) opts.crowAt.forEach((ct) => { crows.push(ct); crowFx(x + flip * 175 * s, y - 285 * s, s, ct, flip); });
  }
  function crowFx(x, y, s, t0, flip) {
    b.live((g, t) => {
      const e = t - t0; if (e < 0 || e > 2.4) return;
      const a = 1 - prog(e, 1.8, 2.4);
      g.save(); g.globalAlpha = a; g.strokeStyle = "#fff"; g.lineCap = "round";
      for (let i = 0; i < 3; i++) {
        const r = ((e * 220 + i * 60) % 180) + 20;
        g.lineWidth = 9 * s; g.strokeStyle = i % 2 ? "rgba(255,215,90,0.95)" : "rgba(255,255,255,0.95)";
        g.beginPath(); g.arc(x, y, r * s, flip > 0 ? -0.6 : Math.PI - 0.6, flip > 0 ? 0.6 : Math.PI + 0.6); g.stroke();
      }
      g.fillStyle = COL.beak; g.strokeStyle = INK; g.lineWidth = 4;
      g.beginPath(); g.moveTo(x - flip * 43 * s, y - 2 * s); g.lineTo(x - flip * 5 * s, y + 20 * s); g.lineTo(x - flip * 41 * s, y + 18 * s); g.closePath(); g.fill(); g.stroke();
      g.restore();
    }, { t0 });
  }
  function person(x, y, s = 1, o2 = {}) {
    const o = O(x, y, s);
    const shirt = o2.shirt || "#4f86c6";
    b.stroke("M-55,0 L-48,-120 M55,0 L48,-120", { ...o, color: o2.pants || "#3d3a4a", w: 22 / s, dur: 0.12 });
    b.stroke("M-75,-110 Q-80,-250 -40,-265 L40,-265 Q80,-250 75,-110 Z", { ...o, fill: shirt, dur: 0.25 });
    if (!o2.noArms) b.stroke(o2.armUp ? "M-70,-240 L-140,-330 M70,-240 L120,-160" : "M-70,-240 L-105,-140 M70,-240 L105,-140", { ...o, color: shirt, w: 20 / s, dur: 0.14 });
    b.stroke(P.circle(0, -335, 66, 1.04, -1.9), { ...o, fill: COL.skin, dur: 0.22 });
    if (o2.hair) b.stroke("M-64,-345 Q-60,-410 0,-405 Q60,-410 64,-345 Q30,-375 -64,-345 Z", { ...o, fill: o2.hair, dur: 0.14 });
    if (o2.pigtails) b.stroke("M-64,-360 Q-115,-345 -100,-290 Q-80,-320 -62,-330 Z M64,-360 Q115,-345 100,-290 Q80,-320 62,-330 Z", { ...o, fill: o2.hair || "#2a2420", dur: 0.14 });
    if (o2.beard) b.stroke("M-50,-310 Q-45,-255 0,-245 Q45,-255 50,-310 Q25,-290 0,-292 Q-25,-290 -50,-310 Z", { ...o, fill: "#eceae4", dur: 0.14 });
    if (o2.cane) b.stroke("M95,-210 Q120,-225 125,-200 L120,0", { ...o, color: "#7a5230", w: 10 / s, dur: 0.15 });
    if (o2.hat === "ngob") b.stroke("M-120,-370 Q0,-470 120,-370 Q0,-395 -120,-370 Z", { ...o, fill: COL.straw, dur: 0.2 });
    if (o2.hat === "cap") b.stroke("M-62,-360 Q-55,-415 0,-415 Q55,-415 62,-360 Z M40,-365 L110,-358 L60,-350", { ...o, fill: "#e0483e", dur: 0.2 });
    if (o2.mustache) b.stroke("M-30,-312 Q-12,-325 0,-314 Q12,-325 30,-312 Q14,-300 0,-308 Q-14,-300 -30,-312 Z", { ...o, fill: "#5a4636", dur: 0.12 });
    b.stroke(o2.mouth === "o" ? P.circle(0, -300, 11) : o2.mouth === "flat" ? "M-16,-300 H16" : "M-22,-305 Q0,-286 22,-305", { ...o, dur: 0.1 });
    const ex = x, ey = y - 345 * s;
    b.live((g, t) => {
      const closed = o2.sleepUntil && t < o2.sleepUntil;
      g.fillStyle = INK; g.strokeStyle = INK; g.lineWidth = 4;
      for (const sx of [-22, 22]) {
        if (closed) { g.beginPath(); g.moveTo(ex + (sx - 9) * s, ey); g.quadraticCurveTo(ex + sx * s, ey + 7 * s, ex + (sx + 9) * s, ey); g.stroke(); }
        else { const bl = ((t + x * 0.01) % 3.7) < 0.12 ? 0.2 : 1; g.beginPath(); g.ellipse(ex + sx * s, ey, 6 * s, 7 * s * bl, 0, 0, 7); g.fill(); }
      }
    }, { t0: b.cursor });
  }
  function house(x, y, s = 1, litAt) {
    const o = O(x, y, s);
    b.stroke("M-120,0 V-90 M120,0 V-90 M0,0 V-90", { ...o, color: COL.woodD, w: 12 / s, dur: 0.12 });
    b.stroke("M-150,-90 H150 V-260 H-150 Z", { ...o, fill: COL.wood, dur: 0.25 });
    b.stroke("M-185,-255 L0,-390 L185,-255 Z", { ...o, fill: COL.roof, dur: 0.22 });
    b.stroke("M-90,-225 H-30 V-150 H-90 Z M30,-225 H90 V-150 H30 Z", { ...o, fill: "#5a3b22", dur: 0.18 });
    if (litAt) b.live((g, t) => {
      const k = prog(t, litAt, litAt + 0.15);
      if (k <= 0) return;
      g.save(); g.globalAlpha = k;
      const gl = g.createRadialGradient(x, y - 190 * s, 10, x, y - 190 * s, 260 * s);
      gl.addColorStop(0, "rgba(255,220,120,0.55)"); gl.addColorStop(1, "rgba(255,220,120,0)");
      g.fillStyle = gl; g.beginPath(); g.arc(x, y - 190 * s, 260 * s, 0, 7); g.fill();
      g.fillStyle = "#ffe08a"; g.fillRect(x - 88 * s, y - 223 * s, 56 * s, 71 * s); g.fillRect(x + 32 * s, y - 223 * s, 56 * s, 71 * s);
      g.fillStyle = RED; g.font = F.h(90 * s); g.textAlign = "center"; g.textBaseline = "middle";
      g.fillText("!", x + Math.sin(t * 30) * 3, y - 470 * s);
      g.restore();
    }, { t0: litAt });
  }
  function coconut(x, y, s = 1) {
    const o = O(x, y, s);
    b.stroke("M0,0 Q-30,-200 20,-420 L50,-418 Q10,-210 40,0 Z", { ...o, fill: "#9b6a3c", dur: 0.25 });
    for (const [a, c] of [[-2.6, COL.leaf], [-2.0, COL.leafD], [-1.2, COL.leaf], [-0.5, COL.leafD], [-3.1, COL.leafD]]) {
      const ex = 35 + Math.cos(a) * 230, ey = -420 + Math.sin(a) * 150 + 90;
      b.stroke(`M35,-420 Q${35 + Math.cos(a) * 120},${-470 + Math.sin(a) * 60} ${ex.toFixed(0)},${ey.toFixed(0)} Q${35 + Math.cos(a) * 110},${-430 + Math.sin(a) * 40} 35,-420 Z`, { ...o, fill: c, dur: 0.1 });
    }
    b.stroke(P.circle(25, -400, 18) + " " + P.circle(55, -395, 18), { ...o, fill: "#6b4a1a", dur: 0.12 });
  }
  function phone(x, y, s = 1, screen = "jp", shownTime = "05:00") {
    b.stroke(P.rrect(-80, -150, 160, 300, 26), { ...O(x, y, s), fill: "#24262e", dur: 0.25 });
    b.live((g) => {
      g.save(); g.translate(x, y); g.scale(s, s);
      g.fillStyle = "#e9f1ff"; g.beginPath(); g.roundRect(-66, -128, 132, 250, 14); g.fill();
      if (screen === "jp") {
        g.fillStyle = "#fff"; g.fillRect(-50, -105, 100, 66); g.strokeStyle = "#ccc"; g.lineWidth = 2; g.strokeRect(-50, -105, 100, 66);
        g.fillStyle = "#d7263d"; g.beginPath(); g.arc(0, -72, 20, 0, 7); g.fill();
      } else {
        g.fillStyle = "#1d3c8f"; g.fillRect(-50, -105, 100, 66);
        g.strokeStyle = "#fff"; g.lineWidth = 12; g.beginPath(); g.moveTo(-50, -105); g.lineTo(50, -39); g.moveTo(50, -105); g.lineTo(-50, -39); g.stroke();
        g.strokeStyle = "#d7263d"; g.lineWidth = 5; g.stroke();
        g.fillStyle = "#fff"; g.fillRect(-50, -80, 100, 16); g.fillRect(-8, -105, 16, 66);
        g.fillStyle = "#d7263d"; g.fillRect(-50, -76, 100, 8); g.fillRect(-4, -105, 8, 66);
      }
      g.fillStyle = INK; g.font = `700 46px "Chakra Petch"`; g.textAlign = "center"; g.textBaseline = "middle"; g.fillText(shownTime, 0, 20);
      g.restore();
    }, { t0: b.cursor });
  }
  function bubble(x, y, w, h, text, font, col = INK, tail = "left") {
    const tx = tail === "left" ? x + 60 : x + w - 110;
    b.stroke(P.rrect(x, y, w, h, 34) + ` M${tx},${y + h} L${tx - 20},${y + h + 70} L${tx + 60},${y + h}`, { w: 6, color: INK, fill: "#ffffff", dur: 0.3 });
    b.write(text, { x: x + w / 2, y: y + h / 2 + 2, font, color: col, align: "center" });
  }
  function zzz(x, y, t0, t1 = 1e9) {
    b.live((g, t) => {
      if (t > t1) return;
      g.fillStyle = "#3b5fa0"; g.textAlign = "center"; g.textBaseline = "middle";
      for (let i = 0; i < 3; i++) {
        const e = (t * 0.7 + i / 3) % 1;
        g.globalAlpha = Math.sin(Math.PI * e); g.font = F.h(30 + i * 10);
        g.fillText("Z", x + e * 60 + i * 10, y - e * 110);
      }
      g.globalAlpha = 1;
    }, { t0 });
  }
  function duck(x, y, s = 1) {
    const o = O(x, y, s);
    b.stroke("M-110,-40 Q-120,-130 -20,-120 Q40,-115 60,-80 Q110,-80 100,-30 Q80,10 -60,10 Q-110,0 -110,-40 Z", { ...o, fill: "#fdfdf8", dur: 0.3 });
    b.stroke(P.circle(60, -160, 48), { ...o, fill: "#fdfdf8", dur: 0.2 });
    b.stroke("M100,-165 Q150,-165 150,-148 Q120,-135 100,-145 Z", { ...o, fill: "#f4a623", dur: 0.12 });
    b.stroke(P.circle(72, -172, 6), { ...o, fill: INK, dur: 0.06 });
    b.stroke("M-20,10 L-25,40 M20,10 L25,40", { ...o, color: "#f4a623", w: 7 / s, dur: 0.1 });
  }
  function dog(x, y, s = 1) {
    const o = O(x, y, s);
    b.stroke("M-120,-30 Q-130,-130 -20,-130 L70,-130 Q110,-130 110,-60 Q110,-10 60,-10 L-80,-10 Q-120,-10 -120,-30 Z", { ...o, fill: "#c98f5a", dur: 0.3 });
    b.stroke(P.circle(110, -165, 58), { ...o, fill: "#c98f5a", dur: 0.2 });
    b.stroke("M70,-205 Q55,-260 85,-250 Q100,-220 95,-200 Z M150,-205 Q170,-255 140,-250 Q125,-225 130,-200 Z", { ...o, fill: "#7a4f2a", dur: 0.15 });
    b.stroke("M150,-150 Q185,-145 180,-125 Q160,-115 145,-130 Z", { ...o, fill: "#3a2a20", dur: 0.1 });
    b.stroke(P.circle(118, -180, 6) + " " + P.circle(146, -178, 6), { ...o, fill: INK, dur: 0.08 });
    b.stroke("M-80,-10 V40 M-30,-10 V40 M30,-10 V40 M70,-10 V40 M-120,-60 Q-170,-110 -150,-150", { ...o, w: 12 / s, color: "#a9703f", dur: 0.15 });
  }
  function cat(x, y, s = 1) {
    const o = O(x, y, s);
    b.stroke("M-150,0 Q-160,-90 -40,-95 L80,-95 Q150,-90 150,-30 Q150,0 120,0 Z", { ...o, fill: "#a8adbb", dur: 0.3 });
    b.stroke(P.circle(120, -110, 55), { ...o, fill: "#a8adbb", dur: 0.2 });
    b.stroke("M80,-150 L85,-200 L115,-160 Z M135,-160 L160,-200 L165,-150 Z", { ...o, fill: "#a8adbb", dur: 0.12 });
    b.stroke("M95,-112 Q105,-105 115,-112 M130,-112 Q140,-105 150,-112 M-60,-90 Q-50,-60 -40,-90 M0,-92 Q10,-60 20,-92", { ...o, dur: 0.12 });
    b.stroke("M-150,-20 Q-230,-40 -220,-110", { ...o, w: 14 / s, color: "#8d93a3", dur: 0.12 });
  }
  function fish(x, y, s = 1) {
    b.stroke("M-60,0 Q-20,-38 40,-8 L70,-30 L66,0 L70,30 L40,8 Q-20,38 -60,0 Z", { ...O(x, y, s), fill: "#7fb6d6", dur: 0.15 });
  }
  function tractor(x, y, s = 1) {
    const o = O(x, y, s);
    b.stroke("M-170,-60 H60 V-170 H-60 L-90,-110 H-170 Z", { ...o, fill: "#d9412b", dur: 0.3 });
    b.stroke("M-40,-170 V-260 H50 V-170", { ...o, dur: 0.15 });
    b.stroke(P.circle(10, -60, 85) + " " + P.circle(10, -60, 30), { ...o, fill: "#333", dur: 0.25 });
    b.stroke(P.circle(-140, -40, 45) + " " + P.circle(-140, -40, 15), { ...o, fill: "#333", dur: 0.2 });
  }
  function burst(x, y, s, text, t0) {
    pops.push(t0);
    b.live((g, t) => {
      const e = t - t0; if (e < 0) return;
      const k = ease.outBack(clamp(e * 4), 2.5);
      g.save(); g.translate(x + Math.sin(e * 60) * 6 * Math.max(0, 1 - e * 2), y); g.scale(k * s, k * s); g.rotate(-0.08);
      g.beginPath(); for (let i = 0; i < 24; i++) { const r = i % 2 ? 150 : 210, a = (i / 24) * Math.PI * 2; g.lineTo(Math.cos(a) * r, Math.sin(a) * r * 0.7); }
      g.closePath(); g.fillStyle = "#ffd84d"; g.fill(); g.lineWidth = 7; g.strokeStyle = INK; g.stroke();
      g.fillStyle = RED; g.font = F.h(96); g.textAlign = "center"; g.textBaseline = "middle"; g.fillText(text, 0, 6);
      g.restore();
    }, { t0 });
  }
  function title(x, y, text, size = 84, col = INK) {
    b.write(text, { x, y, font: F.h(size), color: col, align: "center" });
  }

  // ------------------------------------------------------------ props for this story
  function stall(x, y, s, stripe) {
    const o = O(x, y, s);
    b.stroke("M-150,0 V-260 M150,0 V-260", { ...o, color: COL.woodD, w: 12 / s, dur: 0.15 });
    b.stroke("M-190,-260 L-150,-340 H150 L190,-260 Z", { ...o, fill: stripe, dur: 0.22 });
    b.stroke("M-110,-340 L-130,-260 M-40,-340 L-45,-260 M40,-340 L45,-260 M110,-340 L130,-260", { ...o, color: "#ffffff", w: 14 / s, dur: 0.15 });
    b.stroke("M-170,-110 H170 V-60 H-170 Z", { ...o, fill: COL.wood, dur: 0.18 });
  }
  function crate(x, y, s, veg) {
    b.stroke("M-60,0 V-60 H60 V0 Z M-60,-30 H60", { ...O(x, y, s), fill: "#d8b07a", dur: 0.12 });
    if (veg) b.stroke(P.circle(-25, -70, 16) + " " + P.circle(10, -72, 14), { ...O(x, y, s), fill: veg, dur: 0.1 });
  }
  function riceWrap(x, y, s) {
    b.stroke("M-55,-20 Q0,-55 55,-20 L45,25 Q0,40 -45,25 Z", { ...O(x, y, s), fill: "#7fb069", dur: 0.18 });
    b.stroke("M-30,-35 Q0,-10 30,-35", { ...O(x, y, s), color: "#4f7a3c", dur: 0.08 });
  }
  function bench(x, y, s) {
    const o = O(x, y, s);
    b.stroke("M-200,-120 H200 V-90 H-200 Z", { ...o, fill: "#8a5a32", dur: 0.2 });
    b.stroke("M-170,-90 V0 M170,-90 V0", { ...o, color: "#5a3b22", w: 12 / s, dur: 0.12 });
  }
  function smoke(x, y, t0) {
    b.live((g, t) => {
      g.fillStyle = "rgba(255,255,255,0.55)";
      for (let i = 0; i < 4; i++) { const e = (t * 0.5 + i / 4) % 1; g.globalAlpha = 0.6 * (1 - e); g.beginPath(); g.arc(x + Math.sin(e * 6 + i) * 20, y - e * 220, 20 + e * 40, 0, 7); g.fill(); }
      g.globalAlpha = 1;
    }, { t0 });
  }
  function rain(t0, heavy = 1) {
    b.live((g, t) => {
      const k = prog(t, t0, t0 + 1.2) * heavy;
      g.strokeStyle = "rgba(220,230,245,0.65)"; g.lineWidth = 3; g.beginPath();
      for (let i = 0; i < 160 * k; i++) {
        const x = (i * 97.3) % 1080, y = ((i * 211.7 + t * 1400) % 2100) - 100;
        g.moveTo(x, y); g.lineTo(x - 10, y + 34);
      }
      g.stroke();
    }, { t0 });
  }
  function lightning(t0) {
    crashes.push(t0);
    b.live((g, t) => {
      const e = t - t0; if (e < 0 || e > 0.6) return;
      g.fillStyle = `rgba(255,255,255,${0.75 * (1 - e / 0.6)})`; g.fillRect(0, 0, 1080, 1920);
      g.strokeStyle = `rgba(255,250,200,${1 - e / 0.6})`; g.lineWidth = 9; g.lineJoin = "round";
      g.beginPath(); g.moveTo(760, 0); g.lineTo(700, 180); g.lineTo(770, 200); g.lineTo(680, 420); g.lineTo(740, 430); g.lineTo(660, 640); g.stroke();
    }, { t0 });
  }
  function bigCard(x, y, w, h, letter, title, col, t0) {
    b.stroke(P.rrect(x, y, w, h, 40), { w: 8, color: col, fill: "#fffdf6", dur: 0.4, t0 });
    b.live((g, t) => {
      const k = ease.outBack(prog(t, t0 + 0.3, t0 + 0.7), 2);
      g.save(); g.translate(x + w / 2, y + 120); g.scale(k, k);
      g.fillStyle = col; g.beginPath(); g.arc(0, 0, 80, 0, 7); g.fill();
      g.fillStyle = "#fff"; g.font = F.h(110); g.textAlign = "center"; g.textBaseline = "middle"; g.fillText(letter, 0, 8);
      g.restore();
    }, { t0 });
    b.write(title, { x: x + w / 2, y: y + h - 70, font: F.h(44), color: col, align: "center", t0: t0 + 0.7 });
  }

  // ------------------------------------------------------------ scenes
  function buildScenes() {
    const keys = ["hook", "market", "stall", "oldman", "thoughts", "storm", "choice"];
    const kinds = ["evening", "evening", "evening", "evening", "evening", "storm", "storm"];
    keys.forEach((k, i) => b.scene(i === 0 ? 0 : C[k].start - 0.2, i * 1300, 0));
    const at = (i) => {
      const s = b.scenes[i]; b.ox = s.x; b.oy = s.y;
      const t0 = i === 0 ? 0.1 : s.t - 0.45;
      b.live((g, t) => sky(g, t, t0, kinds[i]), { t0 });
    };
    const TON = { shirt: "#3f6fb5", hair: "#2a2420" }, TAEM = { shirt: "#e07a9a", hair: "#2a2420", pigtails: true };
    const TA = { shirt: "#8a8f7a", hair: "#eceae4", beard: true, mouth: "flat", cane: true };

    // 1 — cover / hook
    at(0); b.go(0.3);
    b.stroke(P.rrect(130, 150, 820, 240, 40), { w: 7, fill: CREAM, color: "#a9561c", dur: 0.4 });
    b.write("นิทานเลือกตอนจบ · ภาค 1", { x: 540, y: 210, font: F.t(42), color: "#a9561c", align: "center", dur: 0.3 });
    b.write("ข้าวห่อสุดท้าย", { x: 540, y: 310, font: F.h(84), color: INK, align: "center", dur: 0.6 });
    b.go(M("hook", 0) + 0.2);
    person(260, 1500, 0.95, TON);
    person(470, 1520, 0.75, { ...TAEM, armUp: true });
    riceWrap(380, 1120, 1.1);
    b.go(M("hook", 1));
    person(850, 1470, 0.85, { ...TA });
    bench(850, 1500, 1.0);
    b.go(M("hook", 2));
    b.write("ถ้าเป็นคุณ เลือกทางไหน?", { x: 540, y: 620, font: F.h(66), color: RED, align: "center" });

    // 2 — evening market, 20 baht
    at(1); b.go(M("market", 0));
    stall(250, 1380, 1.0, "#e0483e"); stall(800, 1380, 1.0, "#2f6fde");
    crate(170, 1260, 0.9, "#5b8f3a"); crate(330, 1260, 0.9); crate(720, 1260, 0.9, "#f08a24"); crate(880, 1260, 0.9);
    person(420, 1700, 0.8, TON); person(620, 1710, 0.65, TAEM);
    b.go(M("market", 1));
    b.stroke(P.circle(540, 700, 120, 1.05), { w: 8, color: "#b8860b", fill: "#ffd84d", dur: 0.35 });
    b.write("20฿", { x: 540, y: 708, font: F.h(96), color: "#8a5a00", align: "center" });
    b.write("เงินที่เหลือทั้งหมด", { x: 540, y: 880, font: F.hand(52), color: INK, align: "center" });

    // 3 — the grill stall, last parcel
    at(2); b.go(M("stall", 0));
    stall(560, 1350, 1.35, "#f08a24");
    b.stroke(P.rrect(390, 640, 340, 90, 14), { w: 6, fill: CREAM, color: COL.woodD, dur: 0.25 });
    b.write("ป้าแจ่ม หมูปิ้ง", { x: 560, y: 687, font: F.t(44), color: COL.woodD, align: "center" });
    person(560, 1210, 0.75, { shirt: "#c9a46a", hair: "#4a3a2a", mouth: "smile" });
    b.stroke("M400,1220 H720 V1260 H400 Z", { w: 6, fill: "#3a3a3a", dur: 0.15 });
    b.stroke("M430,1215 L690,1195 M430,1205 L690,1185", { w: 7, color: "#c9772f", dur: 0.12 });
    smoke(560, 1180, b.cursor);
    person(250, 1720, 0.85, TON); person(840, 1730, 0.7, { ...TAEM, armUp: true });
    b.go(M("stall", 0) + 2.6);
    riceWrap(760, 1350, 1.0);
    b.write("ห่อสุดท้าย!", { x: 830, y: 1470, font: F.h(60), color: RED, align: "center" });
    b.go(M("stall", 1));
    bubble(120, 320, 840, 200, "วันนี้เราได้กินแล้ว!", F.h(64), "#a9561c", "right");

    // 4 — Ta Sing on the bench
    at(3); b.go(M("oldman", 0));
    person(560, 1440, 1.05, { ...TA });
    bench(560, 1480, 1.25);
    b.go(M("oldman", 1));
    b.write("…", { x: 560, y: 900, font: F.h(110), color: MUTED, align: "center" });
    b.stroke(P.arrow(470, 980, 220, 1180, 0.2, 26), { w: 6, color: MUTED, dur: 0.3 });
    riceWrap(170, 1260, 1.0);

    // 5 — two whispers
    at(4); b.go(M("thoughts", 0));
    person(300, 1650, 1.05, TON);
    person(780, 1680, 0.85, TAEM);
    bubble(70, 330, 640, 230, "กลับบ้านกันเถอะ", F.h(56), "#2f6fde", "left");
    b.go(M("thoughts", 1));
    bubble(380, 720, 640, 230, "คุณตาหิวกว่าเรานะ", F.h(52), "#d0517a", "right");

    // 6 — storm: decide now
    at(5); b.go(M("storm", 0));
    lightning(M("storm", 0) + 0.3);
    rain(M("storm", 0) + 0.5, 1);
    person(330, 1650, 1.0, { ...TON, mouth: "o" });
    person(560, 1670, 0.8, { ...TAEM, mouth: "o" });
    person(860, 1600, 0.8, { ...TA });
    bench(860, 1630, 1.0);
    b.go(M("storm", 1));
    b.write("ต้องเลือกเดี๋ยวนี้!", { x: 540, y: 700, font: F.h(84), color: "#ffd84d", align: "center" });

    // 7 — the choice
    at(6);
    rain(C.choice.start - 0.4, 0.6);
    bigCard(70, 420, 450, 620, "A", "แบ่งข้าวให้คุณตา", "#2e9e5b", M("choice", 0));
    b.go(M("choice", 0) + 0.8);
    riceWrap(225, 760, 0.9); riceWrap(365, 760, 0.9);
    b.stroke("M0,30 Q-60,-20 -30,-50 Q0,-60 0,-30 Q0,-60 30,-50 Q60,-20 0,30 Z", { x: 295, y: 880, s: 1.1, w: 6, color: "#c0392b", fill: "#e0483e", dur: 0.3 });
    bigCard(560, 420, 450, 620, "B", "ทำเป็นไม่เห็น", "#e0483e", M("choice", 1));
    b.go(M("choice", 1) + 0.8);
    b.stroke("M-60,-30 Q0,-90 60,-30 Z M0,-30 V40 Q0,55 -15,50", { x: 785, y: 760, s: 1.3, w: 6, color: INK, fill: "#2f6fde", dur: 0.3 });
    b.stroke("M-70,0 Q-60,-25 -50,0 Q-60,15 -70,0 Z M-10,-20 Q0,-45 10,-20 Q0,-5 -10,-20 Z M50,0 Q60,-25 70,0 Q60,15 50,0 Z", { x: 785, y: 900, s: 1.2, w: 5, color: INK, fill: "#8a5a32", dur: 0.3 });
    b.stroke(P.arrow(700, 960, 880, 960, 0, 22), { w: 6, color: "#e0483e", dur: 0.2 });
    b.go(M("choice", 2));
    b.live((g, t) => {
      const s = 1 + 0.05 * Math.sin(t * 6);
      g.save(); g.translate(540, 1260); g.scale(s, s);
      g.fillStyle = "#ffd84d"; g.strokeStyle = INK; g.lineWidth = 6;
      g.beginPath(); g.roundRect(-400, -85, 800, 170, 85); g.fill(); g.stroke();
      g.fillStyle = INK; g.font = F.h(64); g.textAlign = "center"; g.textBaseline = "middle"; g.fillText("คอมเมนต์ A หรือ B", 0, 6);
      g.restore();
    }, { t0: M("choice", 2) });
    b.write("ตอนจบที่คนเลือกมากสุด ได้ไปต่อภาค 2", { x: 540, y: 1430, font: F.t(44), color: "#ffffff", align: "center", t0: M("choice", 2) + 0.8 });
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
    const size = 44; g.font = F.cap(size);
    const words = seg.p.split(" "), lines = [""];
    for (const w of words) { const tt = (lines[lines.length - 1] + " " + w).trim(); if (g.measureText(tt).width > 900 && lines[lines.length - 1]) lines.push(w); else lines[lines.length - 1] = tt; }
    const show = lines.slice(0, 2), lh = size * 1.35;
    const bw = Math.max(...show.map((l) => g.measureText(l).width)) + 64, bh = show.length * lh + 28, cy = 1838;
    g.save(); g.globalAlpha = a;
    g.fillStyle = "rgba(30,24,20,0.72)"; g.beginPath(); g.roundRect(540 - bw / 2, cy - bh / 2, bw, bh, 22); g.fill();
    g.fillStyle = "#fff"; g.textAlign = "center"; g.textBaseline = "middle";
    show.forEach((l, i) => g.fillText(l, 540, cy - (show.length - 1) * lh / 2 + i * lh + 2));
    g.restore();
  }

  function draw(t) {
    g.setTransform(1, 0, 0, 1, 0, 0); g.globalAlpha = 1;
    const cam = b.camera(t);
    g.save(); g.translate(-((cam.x % 512) + 512) % 512, 0);
    g.fillStyle = g.createPattern(paper, "repeat"); g.fillRect(0, 0, W + 1024, H); g.restore();
    // camera shake on crashes
    let sx = 0, sy = 0;
    for (const c of crashes) { const e = t - c; if (e > 0 && e < 0.5) { sx += noise1(t * 50, 1) * 14 * (1 - e / 0.5); sy += noise1(t * 50, 2) * 14 * (1 - e / 0.5); } }
    g.save(); g.translate(sx, sy);
    b.draw(t, "world", cam);
    if (b.showHand) { const h = b.hand(t, cam); drawHand(g, h.pos[0], h.pos[1], h.down, t, "#2a2420"); }
    g.restore();
    STYLE_BG.frame(g, STYLE, W, H);
    captions(t);
    const vg = g.createRadialGradient(W / 2, H / 2, H * 0.35, W / 2, H / 2, H * 0.8);
    vg.addColorStop(0, "rgba(0,0,0,0)"); vg.addColorStop(1, "rgba(40,25,10,0.28)");
    g.fillStyle = vg; g.fillRect(0, 0, W, H);
    const fin = Math.max(prog(t, TL.duration - 0.9, TL.duration - 0.05), 1 - prog(t, 0, 0.4));
    if (fin > 0) { g.fillStyle = `rgba(246,239,226,${fin})`; g.fillRect(0, 0, W, H); }
  }

  function events() {
    return { pen: b.penIntervals(), crows, crashes, pops, pans: b.scenes.slice(1).map((s) => s.t - 0.6) };
  }
  window.scene = { setup, draw, events };
})();
