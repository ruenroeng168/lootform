// Overlay for ทางหลวง FC "ศึกแย่งปลอกคอกัปตัน" (wildlife-documentary parody) on out/base.mp4 from prep.py.
// Letterbox + narrator captions, interview captions, title card, field-guide cards, "voted out" stamp,
// a drawn night-pond reconstruction of the lost ball, and the team-logo end card.
(function () {
  const { clamp, prog, ease } = window.L;
  const W = 1080, H = 1920;
  const INK = "#1b140c", CREAM = "#f6ecd2", YEL = "#ffd23f", RED = "#d8262b", GREEN = "#2f6b3a";
  const F = { b: (s) => `700 ${s}px "IBM Plex Sans Thai"`, m: (s) => `600 ${s}px "IBM Plex Sans Thai"`, n: (s) => `600 ${s}px "Mali"`, d: (s) => `700 ${s}px "Chakra Petch"` };
  let g, D, logo;
  function setup(c, tl) { g = c.getContext("2d"); D = tl.data; }
  function preload() { return new Promise((r) => { logo = new Image(); logo.onload = r; logo.onerror = r; logo.src = D.images.logo; }); }
  function rr(x, y, w, h, r) { g.beginPath(); g.roundRect(x, y, w, h, r); }
  function txt(s, x, y, font, col, align = "center") { g.font = font; g.fillStyle = col; g.textAlign = align; g.textBaseline = "middle"; g.fillText(s, x, y); }
  function shadow(fn, blur = 30, oy = 10, col = "rgba(0,0,0,0.5)") { g.save(); g.shadowColor = col; g.shadowBlur = blur; g.shadowOffsetY = oy; fn(); g.restore(); }
  const vis = (t, a, b) => prog(t, a, a + 0.25) * (1 - prog(t, b - 0.2, b));
  function fitSize(s, size, maxW, font = F.b) { g.font = font(size); while (g.measureText(s).width > maxW && size > 28) { size -= 2; g.font = font(size); } return size; }
  function outlined(s, x, y, size, fill, k = 1, font = F.b) {
    g.save(); g.translate(x, y); g.scale(k, k); g.font = font(size); g.textAlign = "center"; g.textBaseline = "middle"; g.lineJoin = "round";
    g.lineWidth = size * 0.22; g.strokeStyle = INK; g.strokeText(s, 0, 0); g.fillStyle = fill; g.fillText(s, 0, 0); g.restore();
  }
  function splitThai(s, maxW, size, font) {   // break on spaces / ellipses into ≤2 lines
    g.font = font(size); const words = s.split(" "), lines = [""];
    for (const w of words) { const tt = (lines[lines.length - 1] + " " + w).trim(); if (g.measureText(tt).width > maxW && lines[lines.length - 1]) lines.push(w); else lines[lines.length - 1] = tt; }
    return lines;
  }

  function letterbox(t) {
    D.letterbox.forEach(([a, b]) => { const k = vis(t, a, b); if (k <= 0) return; g.fillStyle = "#000"; g.fillRect(0, 0, W, 130 * k); g.fillRect(0, H - 130 * k, W, 130 * k); });
  }
  function narrCaps(t) {
    const c = D.ncaps.find(([a, b]) => t >= a - 0.05 && t < b + 0.3); if (!c) return;
    const [a, b, s] = c; const al = prog(t, a - 0.05, a + 0.2) * (1 - prog(t, b + 0.1, b + 0.3));
    // reveal phrase by phrase (split on "…")
    const parts = s.split("…").map((p) => p.trim()).filter(Boolean), tot = parts.reduce((n, p) => n + p.length, 0);
    let acc = 0, cur = parts[0];
    for (const p of parts) { if (t >= a + (b - a) * acc / tot - 0.05) cur = p; acc += p.length; }
    const z = 50, lines = splitThai(cur, 940, z, F.n).slice(-2);
    g.save(); g.globalAlpha = al;
    lines.forEach((l, i) => outlined(l, 540, 1630 + (i - (lines.length - 1)) * 66, fitSize(l, z, 980, F.n), CREAM, 1, F.n));
    g.restore();
  }
  function caps(t) {
    const c = D.caps.find(([a, b]) => t >= a - 0.04 && t < b + 0.08); if (!c) return;
    const [a, b, s] = c, al = prog(t, a - 0.04, a + 0.06) * (1 - prog(t, b, b + 0.08));
    const z = fitSize(s, 60, 960); g.font = F.b(z); const bw = g.measureText(s).width + 70;
    g.save(); g.globalAlpha = al; rr(540 - bw / 2, 1448, bw, 106, 26); g.fillStyle = "rgba(15,10,5,0.78)"; g.fill(); txt(s, 540, 1503, F.b(z), "#fff"); g.restore();
  }
  function title(t) {
    if (!D.title) return; const [a, b] = D.title, al = vis(t, a, b + 0.2); if (al <= 0) return;
    const beats = [0.1, 0.52, 0.94].map((x) => a + x), shake = beats.reduce((s, bt) => s + (t >= bt && t < bt + 0.25 ? (1 - (t - bt) / 0.25) * 10 : 0), 0);
    g.save(); g.globalAlpha = al; g.translate(Math.sin(t * 90) * shake, Math.cos(t * 70) * shake);
    txt("สารคดีชีวิตสัตว์ฟุตบอล · ทางหลวง FC", 540, 640, F.m(36), CREAM);
    const k1 = ease.outBack(prog(t, beats[0], beats[0] + 0.3), 2), k2 = ease.outBack(prog(t, beats[2], beats[2] + 0.35), 2.4);
    if (k1 > 0) outlined("ศึกแย่งปลอกคอกัปตัน", 540, 800, fitSize("ศึกแย่งปลอกคอกัปตัน", 104, 1000), "#fff", k1);
    if (k2 > 0) outlined("น้องรักหักเหลี่ยมโหด", 540, 950, fitSize("น้องรักหักเหลี่ยมโหด", 112, 1000), YEL, k2);
    g.restore();
  }
  const CARD = {
    mod: ["มด 49", "Formica highwayensis", [["ตำแหน่ง", "จ่าฝูง (ขณะนี้)"], ["จุดเด่น", "รับปากห่อข้าวเหนียว"], ["ผลงาน", "พาลูกฝูงเข้าฝูงเอง"]]],
    tar: ["ต้าร์", "Juvenis ballboyus", [["ตำแหน่ง", "จ่าฝูงคนใหม่"], ["ประวัติ", "อดีตเด็กเก็บบอล"], ["อาวุธ", "รอยยิ้มบริสุทธิ์"]]],
  };
  function cards(t) {
    D.cards.forEach(([who, a, b]) => {
      const al = vis(t, a, b); if (al <= 0) return; const [name, latin, rows] = CARD[who];
      const k = ease.outCubic(prog(t, a, a + 0.4));
      g.save(); g.globalAlpha = al; g.translate(60 + (1 - k) * -620, 170); g.rotate(-0.02);
      shadow(() => { rr(0, 0, 600, 330, 10); g.fillStyle = CREAM; g.fill(); }, 30, 10);
      g.strokeStyle = GREEN; g.lineWidth = 4; rr(14, 14, 572, 302, 6); g.stroke();
      txt("บันทึกภาคสนาม", 36, 52, F.m(26), GREEN, "left");
      txt(name, 36, 106, F.b(62), INK, "left");
      g.font = `italic 600 30px "IBM Plex Sans Thai"`; g.fillStyle = "#6b5a3e"; g.textAlign = "left"; g.fillText(latin, 36 + 20 + g.measureText(name).width * 0 + 230, 112);
      rows.forEach(([k2, v], i) => { txt(k2, 36, 178 + i * 46, F.m(30), GREEN, "left"); txt(v, 190, 178 + i * 46, F.b(32), INK, "left"); });
      g.restore();
    });
  }
  function stamps(t) {
    D.stamps.forEach((a) => {
      if (t < a) return; const k = 1 + 1.6 * (1 - ease.outCubic(prog(t, a, a + 0.18))), al = prog(t, a, a + 0.08) * (1 - prog(t, a + 1.2, a + 1.4));
      g.save(); g.globalAlpha = al * 0.92; g.translate(540, 900); g.rotate(-0.18); g.scale(k, k);
      g.strokeStyle = RED; g.lineWidth = 12; rr(-380, -110, 760, 220, 18); g.stroke(); g.lineWidth = 4; rr(-360, -90, 720, 180, 12); g.stroke();
      txt("โดนโหวตออก!", 0, 6, F.b(120), RED); g.restore();
    });
  }
  function pond(t) {
    D.pond.forEach(([a, b, kind]) => {
      const al = vis(t, a, b); if (al <= 0) return; const u = t - a;
      g.save(); g.globalAlpha = al;
      let gr = g.createLinearGradient(0, 0, 0, H); gr.addColorStop(0, "#0a1426"); gr.addColorStop(0.45, "#13284a"); gr.addColorStop(0.46, "#0e2a33"); gr.addColorStop(1, "#06161b");
      g.fillStyle = gr; g.fillRect(0, 0, W, H);
      g.fillStyle = "#f4ecc8"; g.beginPath(); g.arc(800, 420, 70, 0, 7); g.fill();                       // moon
      for (let i = 0; i < 6; i++) { g.globalAlpha = al * 0.25 * (1 - i / 6); g.fillRect(760 - i * 6 + Math.sin(u * 2 + i) * 10, 900 + i * 60, 80 + i * 12, 6); }
      g.globalAlpha = al;
      g.fillStyle = "#03090b";                                                                          // far shore + reeds
      g.beginPath(); g.moveTo(0, 880); for (let x = 0; x <= W; x += 60) g.lineTo(x, 870 - 30 * Math.sin(x * 0.01)); g.lineTo(W, 900); g.lineTo(0, 900); g.fill();
      for (let i = 0; i < 26; i++) { const x = (i * 97) % W, hgt = 140 + (i * 53) % 120, sw = Math.sin(u * 1.5 + i) * 8;
        g.strokeStyle = "#03090b"; g.lineWidth = 6; g.beginPath(); g.moveTo(x, H - 120); g.quadraticCurveTo(x + sw, H - 120 - hgt / 2, x + sw * 2, H - 120 - hgt); g.stroke(); }
      const far = kind === "pond2", bx = far ? 640 + u * 18 : 540, by = (far ? 1010 : 1120) + Math.sin(u * 2.2) * 10, r = far ? 34 : 70;
      for (let i = 0; i < 3; i++) { const p = ((u * 0.6 + i / 3) % 1); g.globalAlpha = al * (1 - p) * 0.6; g.strokeStyle = "#9fc4c9"; g.lineWidth = 3;
        g.beginPath(); g.ellipse(bx, by + r * 0.6, r * (1.2 + p * 2.5), r * (0.3 + p * 0.6), 0, 0, 7); g.stroke(); }
      g.globalAlpha = al;
      g.save(); g.beginPath(); g.rect(0, 0, W, by + r * 0.45); g.clip();                                // ball, half sunk
      g.fillStyle = "#f2f2f2"; g.beginPath(); g.arc(bx, by, r, 0, 7); g.fill();
      g.fillStyle = "#111"; for (const [dx, dy] of [[0, 0], [-0.55, -0.45], [0.55, -0.45], [-0.6, 0.45], [0.6, 0.45]]) { g.beginPath(); g.arc(bx + dx * r, by + dy * r, r * 0.22, 0, 7); g.fill(); }
      g.restore();
      if (far) { const q = prog(t, a + 1.0, a + 1.5); g.globalAlpha = al * q; outlined("?", bx + 70, by - 90, 110, YEL); }
      g.globalAlpha = al; rr(40, 170, 330, 54, 27); g.fillStyle = "rgba(0,0,0,0.55)"; g.fill(); txt("ภาพจำลองเหตุการณ์", 205, 198, F.m(30), CREAM);
      g.restore();
    });
  }
  function endCard(t) {
    const a = D.end; if (t < a) return; const al = prog(t, a, a + 0.3);
    g.save(); g.globalAlpha = al; g.fillStyle = "#0b0b0b"; g.fillRect(0, 0, W, H);
    const k = ease.outBack(prog(t, a + 0.1, a + 0.6), 1.8);
    if (logo) { const s = 560 * k; g.save(); rr(540 - s / 2, 720 - s / 2, s, s, 40); g.clip(); g.drawImage(logo, 540 - s / 2, 720 - s / 2, s, s); g.restore(); }
    g.globalAlpha = al * prog(t, a + 0.5, a + 0.9);
    txt("ทางหลวง FC", 540, 1100, F.b(96), YEL); txt("สารคดีชีวิตสัตว์ฟุตบอล · ติดตามตอนต่อไป", 540, 1200, F.n(40), CREAM);
    g.restore();
  }
  function draw(t) {
    g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, W, H); g.globalAlpha = 1;
    pond(t); title(t); cards(t); stamps(t); letterbox(t); caps(t); narrCaps(t); endCard(t);
  }
  window.scene = { setup, preload, draw, events: () => ({ pen: [], pops: [], whoosh: [] }) };
})();
