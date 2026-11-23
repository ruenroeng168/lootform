// ทางหลวง FC — 2027 kit launch overlay (render.mjs --overlay on out/base.mp4 from prep.py).
// Logo reveal with a light sweep + letterbox in the intro, voice-over lines as campaign typography,
// "2027" stamp on the back-47 poster, lower third during the ambassador run, logo end card. No player names.
(function () {
  const { clamp, prog, ease, rng } = window.L;
  const W = 1080, H = 1920, GREEN = "#3ddc84", WHITE = "#ffffff", GOLD = "#f5c451";
  const F = { h: (s) => `700 ${s}px "Kanit"`, t: (s) => `600 ${s}px "Kanit"`, e: (s) => `700 ${s}px "Chakra Petch"` };
  let g, D, S, grain, logo, shine;
  function setup(c, tl) {
    g = c.getContext("2d"); D = tl.data; S = D.segs;
    grain = document.createElement("canvas"); grain.width = grain.height = 256;
    const gg = grain.getContext("2d"), r = rng(3), id = gg.createImageData(256, 256);
    for (let i = 0; i < id.data.length; i += 4) { const v = r() * 255; id.data[i] = id.data[i + 1] = id.data[i + 2] = v; id.data[i + 3] = 20; }
    gg.putImageData(id, 0, 0);
    shine = document.createElement("canvas"); shine.width = 700; shine.height = 800;
  }
  function preload() { return new Promise((r) => { logo = new Image(); logo.onload = r; logo.onerror = r; logo.src = D.images.logo; }); }
  const vis = (t, a, b, fi = 0.25, fo = 0.25) => prog(t, a, a + fi) * (1 - prog(t, b - fo, b));
  function spaced(s, x, y, font, col, sp, a = 1) {
    g.font = font; const chars = [...s]; const w = chars.reduce((n, c) => n + g.measureText(c).width, 0) + sp * (chars.length - 1);
    let cx = x - w / 2; g.globalAlpha = a; g.fillStyle = col; g.textAlign = "left"; g.textBaseline = "middle";
    for (const c of chars) { g.fillText(c, cx, y); cx += g.measureText(c).width + sp; }
    g.globalAlpha = 1; return w;
  }
  function title(s, y, size, t, a0, a1, col = WHITE, sp = 4, font = F.h) {
    const a = vis(t, a0, a1); if (a <= 0) return;
    const k = 1 + 0.06 * (1 - ease.outCubic(prog(t, a0, a0 + 0.7)));
    g.save(); g.translate(540, y); g.scale(k, k); g.translate(-540, -y);
    g.shadowColor = "rgba(0,0,0,0.85)"; g.shadowBlur = 28; spaced(s, 540, y, font(size), col, sp, a); g.restore();
  }
  function voLine(key, y, size, t, col = WHITE, rows) {   // voice-over line as rows (default: split at the first "…")
    const v = D.vo[key]; if (!v) return; const [a0, a1, txt] = v;
    if (!rows) { const k = txt.indexOf("…"); rows = k < 0 ? [txt] : [txt.slice(0, k + 1), txt.slice(k + 1).trim()]; }
    const step = (a1 - a0) / rows.length;
    rows.forEach((p, i) => title(p, y + i * (size * 1.35), size, t, a0 + i * step * 0.85, a1 + 0.5, i === rows.length - 1 ? col : WHITE));
  }
  function drawLogo(cx, cy, w, t, t0, sweep = true, a = 1) {
    if (!logo || a <= 0) return;
    const h = w * logo.height / logo.width, k = 0.86 + 0.14 * ease.outBack(prog(t, t0, t0 + 0.9), 1.6);
    const sc = shine.getContext("2d"); shine.width = Math.ceil(w); shine.height = Math.ceil(h);
    sc.clearRect(0, 0, w, h); sc.drawImage(logo, 0, 0, w, h);
    if (sweep) {
      const p = prog(t, t0 + 0.5, t0 + 1.7); if (p > 0 && p < 1) {
        sc.globalCompositeOperation = "source-atop"; const x = -w * 0.6 + p * w * 2.2;
        const gr = sc.createLinearGradient(x - 120, 0, x + 120, 0); gr.addColorStop(0, "rgba(255,255,255,0)"); gr.addColorStop(0.5, "rgba(255,255,255,0.75)"); gr.addColorStop(1, "rgba(255,255,255,0)");
        sc.fillStyle = gr; sc.save(); sc.translate(w / 2, h / 2); sc.rotate(0.35); sc.translate(-w / 2, -h / 2); sc.fillRect(-w, -h, w * 3, h * 3); sc.restore(); sc.globalCompositeOperation = "source-over";
      }
    }
    g.save(); g.globalAlpha = a * prog(t, t0, t0 + 0.5); g.translate(cx, cy); g.scale(k, k);
    const gl = g.createRadialGradient(0, 0, 0, 0, 0, w * 0.75); gl.addColorStop(0, "rgba(61,140,255,0.35)"); gl.addColorStop(1, "rgba(61,140,255,0)");
    g.fillStyle = gl; g.fillRect(-w, -w, w * 2, w * 2);
    g.shadowColor = "rgba(0,0,0,0.8)"; g.shadowBlur = 40; g.drawImage(shine, -w / 2, -h / 2, w, h); g.restore();
  }
  function letterbox(t, a0, a1) { const a = ease.inOutCubic(vis(t, a0, a1, 0.6, 0.6)); if (a <= 0) return; g.fillStyle = "#000"; g.fillRect(0, 0, W, 170 * a); g.fillRect(0, H - 170 * a, W, 170 * a); }

  function draw(t) {
    g.clearRect(0, 0, W, H);
    const i0 = S[0], last = S[S.length - 1];
    // ---- intro: logo reveal + first line
    if (t < i0.t1 + 0.3) {
      const a = 1 - prog(t, i0.t1 - 0.3, i0.t1 + 0.1);
      const sw = W * ease.outCubic(prog(t, 0.3, 1.2));
      const gr = g.createLinearGradient(0, 0, W, 0); gr.addColorStop(0, "rgba(61,220,132,0)"); gr.addColorStop(0.5, `rgba(210,255,225,${0.9 * a})`); gr.addColorStop(1, "rgba(61,220,132,0)");
      g.fillStyle = gr; g.fillRect(540 - sw / 2, 1215, sw, 3);
      drawLogo(540, 820, 560, t, 0.35, true, a);
      voLine("intro", 1320, 64, t);
      if (t < i0.t1 + 0.3) letterbox(t, 0, i0.t1 + 0.4);
    }
    voLine("tease", 1480, 78, t, GREEN, ["สีเขียว… คือหัวใจ", "สีขาว… คือศักดิ์ศรี"]);
    // reveal line + 2027 stamp on the back-47 poster
    voLine("reveal", 1540, 88, t, WHITE);
    const p47 = S[6]; if (t >= p47.t0 && t < p47.t1) spaced("2027", 540, 330, F.e(170), GREEN, 22, vis(t, p47.t0 + 0.1, p47.t1));
    // ---- ambassador run lower third
    const run = S.filter((x, i) => x.kind === "poster" && i > 8);
    if (run.length && t >= run[0].t0 && t < run[run.length - 1].t1) {
      const a = vis(t, run[0].t0, run[run.length - 1].t1, 0.3, 0.2);
      spaced("HIGHWAY FC", 540, 1785, F.e(56), WHITE, 18, a);
      spaced("2027  HOME  KIT", 540, 1845, F.e(34), GREEN, 14, a);
      g.globalAlpha = a; g.fillStyle = GREEN; g.fillRect(170, 1782, 90, 3); g.fillRect(820, 1782, 90, 3); g.globalAlpha = 1;
      if (logo) { g.globalAlpha = a * 0.95; const lw = 120, lh = lw * logo.height / logo.width; g.drawImage(logo, W - lw - 60, 70, lw, lh); g.globalAlpha = 1; }
    }
    voLine("we", 1520, 116, t, GREEN);
    // ---- end card
    if (t >= last.t0 - 0.1) {
      letterbox(t, last.t0, D.total + 2);
      drawLogo(540, 700, 520, t, last.t0 + 0.1, true, 1);
      title("ทางหลวง FC", 1140, 120, t, last.t0 + 0.6, D.total + 2, WHITE, 8);
      const a = vis(t, last.t0 + 1.0, D.total + 2); g.globalAlpha = a; g.fillStyle = GREEN; g.fillRect(540 - 260 * a, 1225, 520 * a, 4); g.globalAlpha = 1;
      spaced("NEW KIT  2027", 540, 1300, F.e(72), GREEN, 26, vis(t, last.t0 + 1.2, D.total + 2));
      spaced("NEW KIT • NEW ERA", 540, 1440, F.e(48), WHITE, 16, vis(t, last.t0 + 2.2, D.total + 2));
    }
    // ---- flash on cuts, grain, fade out
    for (const x of S.slice(1)) { const u = t - x.t0; if (u >= 0 && u < 0.1) { g.fillStyle = `rgba(220,255,230,${0.28 * (1 - u / 0.1)})`; g.fillRect(0, 0, W, H); } }
    g.save(); const o = Math.floor(t * 30) % 4; g.translate(-o * 37, -o * 53); g.fillStyle = g.createPattern(grain, "repeat"); g.fillRect(0, 0, W + 256, H + 256); g.restore();
    const fo = prog(t, D.total - 0.7, D.total); if (fo > 0) { g.fillStyle = `rgba(0,0,0,${fo})`; g.fillRect(0, 0, W, H); }
  }
  window.scene = { setup, preload, draw, events: () => ({ pen: [], pops: [], whoosh: [] }) };
})();
