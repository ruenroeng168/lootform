// Illustrated storybook — "เจ้าหงอน ไก่ขันตามมือถือ" (original fable). Full-bleed painted scenes,
// hand-drawn coloured characters, living details (clouds, stars, steam, sound waves), no host.
(function () {
  const { clamp, lerp, prog, ease, rng, noise1, hexA } = window.L;
  const { P, Board, drawHand } = window.SK;
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
  let g, TL, C, b, paper;
  const M = (cue, k) => (k === 0 ? C[cue].start : C[cue].marks[k - 1] ?? C[cue].end);
  const crows = [], crashes = [], pops = [];

  function setup(canvas, tl) {
    g = canvas.getContext("2d"); TL = tl; C = tl.cues;
    b = new Board(g, { speed: 2100, writeSpeed: 1100 });
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
    }[kind];
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
    if (kind !== "night" && kind !== "room") clouds(g, t, kind === "dawn" ? 0.7 : 1);
    if (kind !== "room") {
      // distant hills + field
      g.fillStyle = kind === "night" ? "#22406a" : "#9fd38a";
      g.beginPath(); g.moveTo(0, 1250); g.quadraticCurveTo(250, 1120, 520, 1230); g.quadraticCurveTo(800, 1110, 1080, 1220); g.lineTo(1080, 1400); g.lineTo(0, 1400); g.fill();
      const fg = g.createLinearGradient(0, 1300, 0, H);
      fg.addColorStop(0, kind === "night" ? "#2d5a4a" : COL.field); fg.addColorStop(1, kind === "night" ? "#1c3b33" : COL.fieldD);
      g.fillStyle = fg; g.fillRect(0, 1320, W, H - 1320);
      g.strokeStyle = kind === "night" ? "rgba(255,255,255,0.05)" : "rgba(40,90,30,0.18)"; g.lineWidth = 4;
      for (let i = 0; i < 14; i++) { g.beginPath(); g.moveTo(-200 + i * 110, H); g.lineTo(380 + i * 30, 1330); g.stroke(); }
    } else {
      g.fillStyle = "#c89a62"; g.fillRect(0, 1380, W, H - 1380);
      g.fillStyle = "rgba(120,80,40,0.25)"; for (let x = 0; x < W; x += 120) g.fillRect(x, 1380, 4, H - 1380);
    }
    g.restore();
  }
  function sun(g, x, y, r, col, t) {
    const gl = g.createRadialGradient(x, y, r * 0.4, x, y, r * 2.4);
    gl.addColorStop(0, hexA(col.length === 7 ? col : "#ffe27a", 0.55)); gl.addColorStop(1, "rgba(255,240,180,0)");
    g.fillStyle = gl; g.beginPath(); g.arc(x, y, r * 2.4, 0, 7); g.fill();
    g.fillStyle = col; g.beginPath(); g.arc(x, y, r * (1 + 0.02 * Math.sin(t * 2)), 0, 7); g.fill();
  }
  function clouds(g, t, a) {
    g.fillStyle = `rgba(255,255,255,${0.85 * a})`;
    [[120, 330, 1], [620, 420, 0.8], [980, 560, 0.7]].forEach(([x, y, s], i) => {
      const cx = ((x + t * (12 + i * 5)) % 1300) - 110;
      g.beginPath(); g.ellipse(cx, y, 110 * s, 42 * s, 0, 0, 7); g.ellipse(cx + 60 * s, y - 30 * s, 70 * s, 50 * s, 0, 0, 7);
      g.ellipse(cx - 60 * s, y - 14 * s, 60 * s, 38 * s, 0, 0, 7); g.fill();
    });
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

  // ------------------------------------------------------------ scenes
  function buildScenes() {
    const keys = ["village", "phone", "night", "meeting", "audition", "plea", "noon", "moral"];
    const kinds = ["dawn", "day", "night", "day", "room", "day", "noon", "room"];
    keys.forEach((k, i) => b.scene(i === 0 ? 0 : C[k].start - 0.2, i * 1300, 0));
    const at = (i) => {
      const s = b.scenes[i]; b.ox = s.x; b.oy = s.y;
      const t0 = i === 0 ? 0.1 : s.t - 0.45;
      b.live((g, t) => sky(g, t, t0, kinds[i]), { t0 });
    };

    // 1 — dawn village + title
    at(0); b.go(0.5);
    b.stroke(P.rrect(140, 150, 800, 230, 40), { w: 7, fill: CREAM, color: "#a9561c", dur: 0.4 });
    b.write("นิทานตลก", { x: 540, y: 205, font: F.t(44), color: "#a9561c", align: "center", dur: 0.3 });
    b.write("เจ้าหงอน ไก่ขันตามมือถือ", { x: 540, y: 300, font: F.h(60), color: INK, align: "center", dur: 0.8 });
    house(185, 1360, 0.95);
    coconut(960, 1420, 1.0);
    b.go(M("village", 0) + 0.2);
    b.stroke("M40,1330 H700 M60,1330 V1450 M200,1330 V1450 M340,1330 V1450 M480,1330 V1450 M620,1330 V1450 M40,1390 H700", { w: 9, color: COL.woodD, dur: 0.4 });
    rooster(590, 1330, 1.3, { crowAt: [M("village", 1) + 0.3] });
    b.stroke(P.rrect(50, 540, 340, 90, 14), { w: 6, fill: CREAM, color: COL.woodD, dur: 0.25 });
    b.write("หมู่บ้านบางขี้เกียจ", { x: 220, y: 587, font: F.t(40), color: COL.woodD, align: "center" });
    b.go(M("village", 2));
    b.stroke(P.circle(820, 700, 95) + " M760,610 L730,575 M880,610 L910,575", { w: 7, fill: "#fff", color: INK, dur: 0.35 });
    b.stroke("M820,700 V640 M820,700 L860,720", { w: 7, color: RED, dur: 0.12 });
    b.write("นาฬิกาปลุกมีชีวิต", { x: 700, y: 860, font: F.h(56), color: "#a9561c", align: "center" });

    // 2 — the coop & the phone from Japan
    at(1); b.go(M("phone", 0));
    b.stroke("M90,1400 V700 L540,450 L990,700 V1400", { w: 9, color: COL.woodD, fill: "#e9c592", fillAlpha: 0.55, dur: 0.6 });
    b.stroke("M90,1400 H990", { w: 10, color: COL.woodD, dur: 0.2 });
    b.stroke("M120,1400 Q300,1340 540,1390 Q760,1340 960,1400 Z", { w: 5, color: "#b8902f", fill: COL.straw, dur: 0.3 });
    person(150, 1380, 0.7, { hat: "cap", shirt: "#3a3f58", noArms: false });
    rooster(540, 1395, 1.2, { starEyesAt: M("phone", 1) });
    phone(850, 1290, 0.7, "jp", "05:00");
    b.go(M("phone", 1) + 0.3);
    bubble(140, 300, 800, 200, "ไก่ยุคดิจิทัล!", F.h(72), "#a9561c");
    b.go(M("phone", 2));
    b.stroke(P.rrect(130, 560, 820, 210, 30), { w: 6, fill: "#fff", color: INK, dur: 0.3 });
    b.write("ญี่ปุ่น 05:00", { x: 330, y: 665, font: F.h(62), color: "#d7263d", align: "center" });
    b.write("ไทย 03:00", { x: 760, y: 665, font: F.h(62), color: "#2f6fde", align: "center" });
    b.write("เร็วกว่า 2 ชั่วโมง!", { x: 540, y: 850, font: F.hand(52), color: RED, align: "center" });

    // 3 — 3 a.m. chaos
    at(2); b.go(M("night", 0));
    b.stroke("M560,1400 H1060 M590,1400 V1490 M740,1400 V1490 M890,1400 V1490 M1040,1400 V1490", { w: 8, color: "#6b4a30", dur: 0.3 });
    rooster(820, 1400, 1.15, { flip: true, crowAt: [M("night", 1) - 1.3] });
    house(200, 1300, 0.85, M("night", 1));
    house(470, 1260, 0.7, M("night", 1) + 0.25);
    phone(960, 1570, 0.45, "jp", "05:00");
    b.go(M("night", 1));
    b.write("ตีสาม!", { x: 330, y: 560, font: F.h(120), color: "#ffd84d", align: "center" });
    b.go(M("night", 2));
    b.stroke(P.circle(780, 820, 150, 1.05), { w: 7, fill: "#fff7e6", color: "#ffd84d", dur: 0.3 });
    b.stroke("M710,850 Q710,780 780,780 Q850,780 850,850 Z M700,850 H860 V900 H700 Z", { ...O(0, 0, 1), fill: "#d9dde6", dur: 0.25 });
    b.live((g, t) => {
      g.strokeStyle = "rgba(255,255,255,0.9)"; g.lineWidth = 6; g.lineCap = "round";
      for (let i = 0; i < 3; i++) { const e = (t * 0.8 + i / 3) % 1; g.globalAlpha = 1 - e; g.beginPath(); g.moveTo(750 + i * 30, 770 - e * 90); g.quadraticCurveTo(735 + i * 30, 740 - e * 90, 750 + i * 30, 710 - e * 90); g.stroke(); }
      g.globalAlpha = 1;
    }, { t0: b.cursor });
    b.write("03:30 ข้าวสุก!", { x: 780, y: 1010, font: F.h(46), color: "#fff", align: "center" });
    b.go(M("night", 3));
    tractor(330, 1760, 0.9);
    person(310, 1630, 0.55, { hat: "ngob", shirt: "#5b8f3a", sleepUntil: 1e9, mouth: "flat", noArms: true });
    coconut(560, 1790, 0.8);
    burst(560, 1500, 0.75, "โครม!", M("night", 4) + 0.5);
    crashes.push(M("night", 4) + 0.5);

    // 4 — village meeting
    at(3); b.go(M("meeting", 0));
    b.stroke("M60,640 L540,420 L1020,640 Z", { w: 7, fill: COL.roof, dur: 0.35 });
    b.stroke("M120,640 V1400 M960,640 V1400 M100,640 H980", { w: 12, color: COL.woodD, dur: 0.3 });
    person(540, 1400, 1.2, { shirt: "#c9a46a", mustache: true, hair: "#9aa0ad", armUp: true, mouth: "o" });
    bubble(140, 140, 800, 190, "ใครขันตีสาม!", F.h(80), RED, "right");
    b.go(M("meeting", 1));
    person(180, 1820, 0.7, { hat: "ngob", shirt: "#5b8f3a" });
    person(380, 1830, 0.7, { shirt: "#d17aa5", hair: "#2a2420" });
    rooster(870, 1530, 0.85, { flip: true });
    b.stroke(P.arrow(250, 1480, 720, 1300, -0.2, 30) + " " + P.arrow(430, 1490, 740, 1340, -0.15, 30), { w: 7, color: RED, dur: 0.4 });
    b.go(M("meeting", 2));
    phone(700, 1080, 0.55, "jp", "05:00");
    b.write("\"ตีห้าเป๊ะ!\"", { x: 760, y: 870, font: F.h(60), color: "#a9561c", align: "center" });
    b.go(M("meeting", 3));
    b.stroke("M610,980 Q600,1010 615,1025 Q630,1010 620,980 Z", { w: 4, color: "#3b82c4", fill: "#9fd0ff", dur: 0.12 });
    b.write("หาคนขันแทน…", { x: 250, y: 1000, font: F.hand(58), color: INK, align: "center" });

    // 5 — the audition (duck / dog / cat)
    at(4); b.go(M("audition", 0) - 0.3);
    b.stroke("M0,0 H1080 V140 Q540,220 0,140 Z", { w: 6, color: "#7a1f1f", fill: "#b3282d", dur: 0.4 });
    b.write("ออดิชัน: คนปลุกหมู่บ้าน", { x: 540, y: 70, font: F.h(56), color: "#fff6dd", align: "center" });
    const card = (y) => b.stroke(P.rrect(70, y, 940, 400, 36), { w: 6, fill: "#fffdf6", color: COL.woodD, dur: 0.25 });
    card(260);
    duck(300, 600, 1.3);
    b.write("\"ก๊าบ…\"", { x: 640, y: 420, font: F.hand(60), color: MUTED, align: "center" });
    zzz(820, 560, b.cursor);
    b.write("นอนต่อสบายใจ", { x: 760, y: 610, font: F.t(42), color: "#3b5fa0", align: "center" });
    b.go(M("audition", 1));
    card(720);
    dog(330, 1060, 1.2);
    b.write("โฮ่ง! โฮ่ง!", { x: 760, y: 840, font: F.h(76), color: RED, align: "center" });
    b.write("20:00 – 06:00", { x: 760, y: 960, font: F.t(46), color: INK, align: "center" });
    b.go(M("audition", 2));
    card(1180);
    cat(380, 1520, 1.15);
    zzz(560, 1380, b.cursor);
    fish(700, 1340, 0.9); fish(820, 1360, 0.9); fish(760, 1440, 0.9);
    b.write("ค่าจ้าง: ปลาทู 3 ตัว/วัน", { x: 700, y: 1250, font: F.t(42), color: INK, align: "center" });
    b.write("ตื่นเที่ยง!", { x: 800, y: 1525, font: F.h(56), color: RED, align: "center" });

    // 6 — begging the rooster back; wrong time zone
    at(5); b.go(M("plea", 0));
    person(190, 1520, 0.8, { hat: "ngob", shirt: "#5b8f3a", mouth: "o" });
    person(380, 1540, 0.8, { shirt: "#c9a46a", mustache: true, hair: "#9aa0ad", mouth: "o" });
    rooster(760, 1520, 1.3, { flip: true, armsCrossed: true });
    b.go(M("plea", 1));
    bubble(160, 200, 820, 260, "ขอเงื่อนไขเดียว!", F.h(76), "#a9561c", "right");
    b.write("ตั้งเวลาเป็นเวลาไทยด้วย", { x: 570, y: 560, font: F.hand(52), color: INK, align: "center" });
    b.go(M("plea", 2));
    person(560, 1560, 0.72, { hat: "cap", shirt: "#3a3f58", armUp: true });
    phone(560, 880, 0.75, "uk", "05:00");
    b.write("กดผิด!", { x: 780, y: 830, font: F.h(84), color: RED, align: "center" });

    // 7 — noon nap + punchline
    at(6); b.go(M("noon", 0));
    coconut(860, 1450, 1.1);
    b.stroke("M80,1530 Q330,1600 600,1530", { w: 9, color: "#8a5a32", dur: 0.3 });
    person(240, 1720, 0.7, { hat: "ngob", shirt: "#5b8f3a", sleepUntil: 1e9, mouth: "flat" });
    person(470, 1730, 0.7, { shirt: "#c9a46a", mustache: true, hair: "#9aa0ad", sleepUntil: M("noon", 3), mouth: "flat" });
    b.go(M("noon", 1));
    b.stroke(P.circle(540, 640, 120, 1.04) + " M540,640 V545 M540,640 V560", { w: 8, fill: "#fff", color: INK, dur: 0.35 });
    b.write("12:00", { x: 540, y: 820, font: `700 64px "Chakra Petch"`, color: INK, align: "center" });
    zzz(330, 1270, M("noon", 1), M("noon", 2));
    b.go(M("noon", 2) - 0.5);
    rooster(780, 1250, 0.95, { flip: true, crowAt: [M("noon", 2) + 0.2] });
    b.go(M("noon", 3) + 0.4);
    bubble(160, 960, 760, 230, "เอาเถอะ… ดีกว่าตีสาม", F.h(56), INK, "left");

    // 8 — moral + CTA (storybook page)
    at(7); b.go(M("moral", 0));
    b.stroke("M90,360 Q300,300 540,370 Q780,300 990,360 V1180 Q780,1120 540,1190 Q300,1120 90,1180 Z M540,370 V1190", { w: 7, fill: "#fffaf0", color: COL.woodD, dur: 0.6 });
    b.write("ข้อคิด", { x: 315, y: 470, font: F.h(70), color: "#a9561c", align: "center" });
    b.write("ของใหม่ดีแค่ไหน", { x: 315, y: 640, font: F.t(46), color: INK, align: "center" });
    b.write("ถ้าตั้งค่าผิด", { x: 315, y: 730, font: F.t(46), color: INK, align: "center" });
    b.write("ก็เพี้ยนทั้งหมู่บ้าน", { x: 315, y: 820, font: F.t(46), color: RED, align: "center" });
    rooster(800, 980, 0.95, { flip: true });
    b.go(M("moral", 1));
    bubble(120, 1320, 840, 220, "ใครเป็นนาฬิกาปลุกประจำบ้าน?", F.h(54), INK, "right");
    b.write("คอมเมนต์เลย!", { x: 540, y: 1700, font: F.h(84), color: ORANGE, align: "center" });
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
    const h = b.hand(t, cam);
    drawHand(g, h.pos[0], h.pos[1], h.down, t, "#2a2420");
    g.restore();
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
