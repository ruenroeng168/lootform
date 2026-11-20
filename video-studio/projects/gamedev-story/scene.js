// "ผู้รับเหมาที่ไม่เคยเขียนโค้ด สร้างเกมด้วย AI" — comic-style board story with a game-caster voice.
// Drawn boards (helmet/blueprint, laptop at night, boss "?" questions, trial & error, fan bubbles) cut with the
// creator's real early/late game images as taped cards. Ends on the LOOTFORM CITY card + play.lootformcity.com.
(function () {
  const { clamp, prog, ease, rng } = window.L;
  const { P, Board, STYLE_BG } = window.SK;
  const INK = "#111111", GOLD = "#ffcf4a", RED = "#e23b2e", BLUE = "#2f6fdf", GREEN = "#1f9d4c", ORANGE = "#f28c28", PAPER = "#fff8e7", SKIN = "#f2c7a5";
  const F = { h: (s) => `700 ${s}px "Kanit"`, t: (s) => `600 ${s}px "Kanit"`, cap: (s) => `700 ${s}px "Noto Sans Thai"` };
  const SP = 1400;
  let g, W, H, C, D, b, STYLE, paper; const img = {};
  const M = (cue, k) => (k === 0 ? C[cue].start : C[cue].marks[k - 1] ?? C[cue].end);

  function setup(canvas, tl) {
    g = canvas.getContext("2d"); W = tl.width; H = tl.height; C = tl.cues; D = tl.data || {}; STYLE = D.style || "comic";
    b = new Board(g, { speed: 3000, writeSpeed: 1800, color: INK, width: 7, style: STYLE });
    paper = document.createElement("canvas"); paper.width = paper.height = 512;
    const pg = paper.getContext("2d"); pg.fillStyle = PAPER; pg.fillRect(0, 0, 512, 512);
    const r = rng(5); for (let i = 0; i < 1800; i++) { pg.fillStyle = `rgba(90,60,20,${0.01 + r() * 0.02})`; pg.fillRect(r() * 512, r() * 512, 1.5, 1.5); }
    build(); b.settleCamera();
  }
  function preload() {
    return Promise.all(Object.entries(D.images || {}).map(([k, src]) => new Promise((r) => { const im = new Image(); im.onload = () => { img[k] = im; r(); }; im.onerror = r; im.src = src; })));
  }

  // ------------------------------------------------------------ helpers
  const label = (s, x, y, col = INK, size = 60) => b.write(s, { x, y, font: F.h(size), color: col, align: "center" });
  function pop(t) { b.pops.push(t); }
  // taped card with a real image; src = key, or {key, frames:[[sx,sy,sw,sh],...], fps} for a sprite-sheet animation
  function card(cx, cy, w, src, opt = {}) {
    const t0 = b.cursor, rot = opt.rot ?? -0.03; pop(t0 + 0.15);
    b.live((gg, t) => {
      const dt = t - t0, k = ease.outBack(prog(dt, 0, 0.4), 1.8); if (k <= 0) return;
      const key = typeof src === "string" ? src : src.key, im = img[key]; if (!im) return;
      let sx = 0, sy = 0, sw = im.width, sh = im.height;
      if (src.frames) [sx, sy, sw, sh] = src.frames[Math.floor(dt * (src.fps || 6)) % src.frames.length];
      const h = w * sh / sw, z = 1 + (opt.zoom ?? 0.06) * clamp(dt / 5), pad = opt.pad ?? 14;
      gg.save(); gg.translate(cx, cy); gg.rotate(rot); gg.scale(k, k);
      gg.fillStyle = opt.bg || "#fff"; gg.strokeStyle = INK; gg.lineWidth = 8;
      gg.fillRect(-w / 2 - pad, -h / 2 - pad, w + pad * 2, h + pad * 2); gg.strokeRect(-w / 2 - pad, -h / 2 - pad, w + pad * 2, h + pad * 2);
      gg.save(); gg.beginPath(); gg.rect(-w / 2, -h / 2, w, h); gg.clip();
      gg.drawImage(im, sx, sy, sw, sh, -w / 2 * z, -h / 2 * z, w * z, h * z); gg.restore();
      gg.fillStyle = "rgba(255,207,74,0.85)"; gg.save(); gg.translate(0, -h / 2 - pad); gg.rotate(0.06); gg.fillRect(-75, -20, 150, 40); gg.restore();
      if (opt.tag) {
        gg.font = F.h(40); const tw = gg.measureText(opt.tag).width + 50;
        gg.save(); gg.translate(w / 2 - tw / 2 + 10, h / 2 + pad - 6); gg.rotate(-0.05);
        gg.fillStyle = opt.tagCol || RED; gg.strokeStyle = INK; gg.lineWidth = 6; gg.beginPath(); gg.roundRect(-tw / 2, -32, tw, 64, 14); gg.fill(); gg.stroke();
        gg.fillStyle = "#fff"; gg.textAlign = "center"; gg.textBaseline = "middle"; gg.fillText(opt.tag, 0, 3); gg.restore();
      }
      gg.restore();
    }, { t0 });
  }
  function bubble(x, y, w, h, str, opt = {}) {   // comic speech bubble (tail bottom-left or right)
    const tail = opt.right ? `M${w / 2 - 70},${h / 2 - 4} L${w / 2 - 20},${h / 2 + 50} L${w / 2 - 120},${h / 2 - 4}` : `M${-w / 2 + 70},${h / 2 - 4} L${-w / 2 + 20},${h / 2 + 50} L${-w / 2 + 120},${h / 2 - 4}`;
    b.stroke(P.rrect(-w / 2, -h / 2, w, h, h / 2.4) + " " + tail, { x, y, w: 6, fill: opt.fill || "#fff", dur: 0.3 });
    b.write(str, { x, y: y + 4, font: F.h(opt.size || 52), color: opt.color || INK, align: "center" });
  }
  function burst(x, y, s, str, col = GOLD, size = 64) {
    let d = ""; for (let i = 0; i < 24; i++) { const a = i / 24 * Math.PI * 2, r = i % 2 ? 0.62 : 1; d += (i ? "L" : "M") + (Math.cos(a) * 200 * r).toFixed(1) + "," + (Math.sin(a) * 130 * r).toFixed(1) + " "; }
    b.stroke(d + "Z", { x, y, s, w: 7, fill: col, dur: 0.35 }); pop(b.cursor);
    b.write(str, { x, y: y + 4, font: F.h(size), color: INK, align: "center" });
  }
  const check = (x, y) => { const c = b.stroke("M-30,0 L-8,26 L38,-34", { x, y, color: GREEN, w: 13, dur: 0.2 }); pop(c.t0 + c.dur); };
  const cross = (x, y) => { const c = b.stroke("M-32,-32 L32,32 M32,-32 L-32,32", { x, y, color: RED, w: 13, dur: 0.2 }); pop(c.t0 + c.dur); };
  function helmet(x, y, s = 1) {
    b.stroke("M-150,40 Q-150,-130 0,-140 Q150,-130 150,40 Z", { x, y, s, w: 8, fill: GOLD });
    b.stroke("M-190,40 H190 Q200,70 170,75 H-170 Q-200,70 -190,40 Z M-20,-138 V40 M20,-138 V40", { x, y, s, w: 7, fill: ORANGE });
  }
  function laptop(x, y, s = 1, fill = "#1d2b4a") {
    b.stroke(P.rrect(-230, -170, 460, 300, 18), { x, y, s, w: 8, fill });
    b.stroke("M-290,150 H290 L260,190 H-260 Z", { x, y, s, w: 8, fill: "#c9ced8" });
  }

  // ------------------------------------------------------------ boards
  function build() {
    const keys = ["hook", "tools", "week", "boss", "trial", "grow", "proud", "cta"];
    keys.forEach((k, i) => b.scene(i === 0 ? 0 : C[k].start - 0.15, i * SP, 0));
    const at = (i) => { const s = b.scenes[i]; b.ox = s.x; b.oy = s.y; };

    // 0 — contractor who can't code
    at(0); b.go(0.25);
    b.stroke(P.rrect(-300, -200, 600, 400, 10), { x: 540, y: 620, w: 7, fill: "#dbeafe" });            // blueprint
    b.stroke("M-240,-140 H60 V60 H-240 Z M-240,-40 H60 M-90,-140 V60 M120,-140 H240 M120,-80 H240 M120,-20 H200", { x: 540, y: 620, w: 5, color: BLUE });
    helmet(540, 470, 0.9);
    b.go(M("hook", 1));
    label("เขียนโค้ด 0 บรรทัด", 540, 980, RED, 82);
    b.stroke("M-230,0 H230", { x: 540, y: 1040, w: 9, color: RED });
    b.go(M("hook", 2));
    burst(540, 1270, 1.25, "อยากสร้าง MMORPG!", GOLD, 58);

    // 1 — Claude + YouTube after work
    at(1); b.go(C.tools.start + 0.05);
    b.stroke(P.circle(860, 330, 70) , { w: 7, fill: "#fde68a" });                                        // moon
    b.stroke(P.circle(895, 305, 60), { w: 0.01, fill: PAPER });
    label("หลังเลิกงาน", 330, 330, INK, 72);
    laptop(540, 760, 1.05);
    b.go(M("tools", 1));
    bubble(380, 690, 330, 120, "Claude", { color: ORANGE, size: 60 });
    b.stroke(P.rrect(-120, -80, 240, 160, 36), { x: 730, y: 840, w: 7, fill: RED });
    b.stroke("M-30,-45 L50,0 L-30,45 Z", { x: 730, y: 840, w: 6, fill: "#fff" });
    label("YouTube", 730, 970, RED, 50);
    b.go(M("tools", 2));
    label("เวลาว่างเท่านั้น!", 540, 1280, BLUE, 88);

    // 2 — week 1: the first character moves
    at(2); b.go(C.week.start + 0.05);
    burst(540, 300, 1.0, "สัปดาห์ที่ 1", GOLD, 64);
    const cells = []; for (let r = 0; r < 2; r++) for (let c = 0; c < 4; c++) cells.push([c * 384, r * 512, 384, 512]);
    b.go(M("week", 1) - 0.2);
    card(540, 900, 520, { key: "sprite", frames: [cells[0], cells[1], cells[2], cells[7], cells[6], cells[5]], fps: 6 }, { rot: -0.02, tag: "ขยับได้แล้ว!", tagCol: GREEN, zoom: 0 });

    // 3 — the real boss: fun / unique / ไทบ้าน
    at(3); b.go(C.boss.start + 0.05);
    label("บอสตัวจริง", 540, 300, RED, 96);
    b.stroke("M-90,-80 Q-90,-170 0,-170 Q90,-170 90,-90 Q90,-30 20,0 Q0,15 0,60 M0,120 V130", { x: 540, y: 640, s: 1.4, w: 16, color: INK });
    pop(b.cursor);
    b.go(M("boss", 1)); burst(290, 1060, 0.85, "สนุก?", GOLD, 70);
    b.go(M("boss", 2)); burst(790, 1180, 0.85, "ไม่ซ้ำใคร?", "#93c5fd", 60);
    b.go(M("boss", 3)); burst(420, 1420, 0.95, "ไทบ้านแท้ๆ?", "#86efac", 64);

    // 4 — ask the groups, trial & error
    at(4); b.go(C.trial.start + 0.05);
    b.stroke(P.rrect(-170, -300, 340, 600, 40), { x: 330, y: 650, w: 8, fill: "#fff" });             // phone
    b.stroke("M-120,-220 H120 M-120,-170 H60", { x: 330, y: 650, w: 7, color: BLUE });
    bubble(730, 470, 380, 110, "แบบไหนสนุก?", { size: 50 });
    bubble(760, 640, 330, 100, "ใส่ไก่ชน!", { size: 46, fill: "#fef3c7", right: true });
    bubble(740, 800, 360, 100, "ทำตลาดสิ!", { size: 46, fill: "#dcfce7", right: true });
    b.go(M("trial", 1));
    cross(200, 1120); check(400, 1120); cross(600, 1120); check(800, 1120);
    label("ลองผิด ลองถูก", 540, 1260, INK, 80);
    b.go(M("trial", 2));
    label("ล้มแล้วลุก!", 540, 1420, RED, 96);

    // 5 — two months later: from one character to a whole town
    at(5); b.go(C.grow.start + 0.05);
    burst(540, 260, 1.0, "2 เดือนต่อมา", GOLD, 66);
    card(540, 620, 760, "early", { rot: -0.03, tag: "ช่วงแรก", tagCol: BLUE });
    b.go(M("grow", 1) - 0.1);
    card(330, 1000, 420, "tiles1", { rot: 0.05, zoom: 0.1 });
    card(760, 1030, 420, "tiles2", { rot: -0.04, zoom: 0.1 });
    b.go(M("grow", 2) - 0.1);
    card(540, 1300, 900, "town2", { rot: 0.015, tag: "วันนี้", tagCol: RED });

    // 6 — proudest moment: real players like it
    at(6); b.go(C.proud.start + 0.05);
    b.stroke("M0,60 C-120,-30 -110,-150 -40,-150 C-10,-150 0,-120 0,-100 C0,-120 10,-150 40,-150 C110,-150 120,-30 0,60 Z", { x: 540, y: 520, s: 1.6, w: 9, fill: RED });
    pop(b.cursor);
    b.go(M("proud", 1));
    card(540, 1000, 760, "town1", { rot: -0.02, zoom: 0.08 });
    b.go(M("proud", 2));
    bubble(380, 1360, 520, 130, "ชอบเกมนี้มาก!", { size: 64, fill: "#fef3c7" });
    bubble(740, 1520, 430, 110, "สนุกดีครับ!", { size: 52, right: true });

    // 7 — never stop + play
    at(7); b.go(C.cta.start + 0.05);
    label("ผมจะไม่หยุดพัฒนา!", 540, 330, INK, 86);
    b.go(M("cta", 1) - 0.1);
    card(540, 760, 820, "logo", { rot: 0, zoom: 0, pad: 10, bg: "#2b1a0e" });
    b.go(M("cta", 2) - 0.2);
    b.stroke(P.rrect(-420, -80, 840, 160, 80), { x: 540, y: 1130, w: 8, fill: GOLD });
    b.write("play.lootformcity.com", { x: 540, y: 1134, font: F.h(66), color: INK, align: "center" });
    label("เล่นฟรี ไม่ต้องโหลด!", 540, 1330, RED, 80);
  }

  // ------------------------------------------------------------ frame
  function captions(t) {
    let seg = null;
    for (const k of Object.keys(C)) {
      const c = C[k];
      c.parts.forEach((p, i) => { const s = i === 0 ? c.start - 0.05 : c.marks[i - 1], e = i < c.parts.length - 1 ? c.marks[i] : c.end + 0.3; if (t >= s && t < e) seg = { p, s, e }; });
    }
    if (!seg) return;
    let p = seg.p; (D.capfix || []).forEach(([a, bb]) => (p = p.split(a).join(bb)));
    const a = prog(t, seg.s, seg.s + 0.1) * (1 - prog(t, seg.e - 0.1, seg.e));
    let size = 52; g.font = F.cap(size); let w = g.measureText(p).width;
    if (w > 940) { size = Math.floor(size * 940 / w); g.font = F.cap(size); w = g.measureText(p).width; }
    g.save(); g.globalAlpha = a; g.fillStyle = INK; g.strokeStyle = GOLD; g.lineWidth = 5;
    g.beginPath(); g.roundRect(540 - w / 2 - 34, 1660 - size / 2 - 22, w + 68, size + 44, 18); g.fill(); g.stroke();
    g.fillStyle = "#fff"; g.textAlign = "center"; g.textBaseline = "middle"; g.fillText(p, 540, 1662); g.restore();
  }
  function tagLine() {
    g.save(); g.fillStyle = INK; g.beginPath(); g.roundRect(W - 360, 80, 300, 62, 31); g.fill();
    g.font = F.h(32); g.fillStyle = GOLD; g.textAlign = "center"; g.textBaseline = "middle"; g.fillText("LOOTFORM CITY", W - 210, 112); g.restore();
  }
  function draw(t) {
    g.setTransform(1, 0, 0, 1, 0, 0); g.globalAlpha = 1;
    const cam = b.camera(t);
    g.save(); g.translate(-((cam.x % 512) + 512) % 512, -((cam.y % 512) + 512) % 512);
    g.fillStyle = g.createPattern(paper, "repeat"); g.fillRect(0, 0, W + 1024, H + 1024); g.restore();
    b.draw(t, "world", cam); b.draw(t, "screen", cam);
    STYLE_BG.overlay(g, STYLE, W, H, t);
    tagLine(); captions(t);
    STYLE_BG.frame(g, STYLE, W, H);
    const fin = 1 - prog(t, 0, 0.25); if (fin > 0) { g.fillStyle = `rgba(255,248,231,${fin})`; g.fillRect(0, 0, W, H); }
  }
  function events() { return { pen: b.penIntervals(), pops: b.pops, pans: b.scenes.slice(1).map((s) => s.t - 0.6) }; }
  window.scene = { setup, preload, draw, events };
})();
