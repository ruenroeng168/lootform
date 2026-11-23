// ทางหลวง FC — 2027 kit launch overlay (render.mjs --overlay on out/base.mp4 from prep.py).
// Campaign typography only (no player names): title flare intro, NEW KIT / ชุดใหม่ ฤดูกาลใหม่ lines,
// a lower-third during the ambassador poster run, white flash on hard cuts, light grain, end card.
(function () {
  const { clamp, prog, ease, rng } = window.L;
  const W = 1080, H = 1920, GREEN = "#3ddc84", WHITE = "#ffffff";
  const F = { h: (s) => `700 ${s}px "Kanit"`, t: (s) => `600 ${s}px "Kanit"`, e: (s) => `700 ${s}px "Chakra Petch"` };
  let g, D, S, grain;
  function setup(c, tl) {
    g = c.getContext("2d"); D = tl.data; S = D.segs;
    grain = document.createElement("canvas"); grain.width = grain.height = 256;
    const gg = grain.getContext("2d"), r = rng(3), id = gg.createImageData(256, 256);
    for (let i = 0; i < id.data.length; i += 4) { const v = r() * 255; id.data[i] = id.data[i + 1] = id.data[i + 2] = v; id.data[i + 3] = 22; }
    gg.putImageData(id, 0, 0);
  }
  const vis = (t, a, b, fi = 0.25, fo = 0.2) => prog(t, a, a + fi) * (1 - prog(t, b - fo, b));
  function spaced(s, x, y, font, col, sp, a = 1) {   // letter-spaced centred text
    g.font = font; const chars = [...s]; const w = chars.reduce((n, c) => n + g.measureText(c).width, 0) + sp * (chars.length - 1);
    let cx = x - w / 2; g.globalAlpha = a; g.fillStyle = col; g.textAlign = "left"; g.textBaseline = "middle";
    for (const c of chars) { g.fillText(c, cx, y); cx += g.measureText(c).width + sp; }
    g.globalAlpha = 1; return w;
  }
  function line(x, y, w, a) { g.globalAlpha = a; g.fillStyle = GREEN; g.fillRect(x - w / 2, y, w, 4); g.globalAlpha = 1; }
  function title(s, y, size, t, a0, a1, col = WHITE, sp = 6) {
    const a = vis(t, a0, a1); if (a <= 0) return;
    const k = 1 + 0.08 * (1 - ease.outCubic(prog(t, a0, a0 + 0.6)));
    g.save(); g.translate(540, y); g.scale(k, k); g.translate(-540, -y);
    g.shadowColor = "rgba(0,0,0,0.7)"; g.shadowBlur = 30; spaced(s, 540, y, F.h(size), col, sp, a); g.restore();
  }
  function draw(t) {
    g.clearRect(0, 0, W, H);
    const seg = (i) => S[i], last = S[S.length - 1];
    // ---- intro: horizontal light streak + title
    const i0 = seg(0);
    if (t < i0.t1 + 0.2) {
      const p = prog(t, 0.3, 1.1), a = vis(t, 0.3, i0.t1 + 0.15, 0.1, 0.3);
      const gr = g.createLinearGradient(0, 0, W, 0); gr.addColorStop(0, "rgba(61,220,132,0)"); gr.addColorStop(0.5, `rgba(200,255,220,${0.9 * a})`); gr.addColorStop(1, "rgba(61,220,132,0)");
      g.fillStyle = gr; const sw = W * ease.outCubic(p); g.fillRect(540 - sw / 2, 958, sw, 4);
      const rg = g.createRadialGradient(540, 960, 0, 540, 960, 420); rg.addColorStop(0, `rgba(61,220,132,${0.35 * a})`); rg.addColorStop(1, "rgba(61,220,132,0)");
      g.fillStyle = rg; g.fillRect(0, 500, W, 920);
      title("ทางหลวง FC", 860, 150, t, 0.6, i0.t1 + 0.1, WHITE, 10);
      const a2 = vis(t, 1.4, i0.t1 + 0.1); if (a2 > 0) spaced("NEW KIT  2027", 540, 1080, F.e(64), GREEN, 26, a2);
    }
    // ---- teasers
    const s1 = seg(1), s3 = seg(3), s4 = seg(4), s5 = seg(5);
    if (t >= s1.t0 && t < s3.t1) { const a = vis(t, s1.t0 + 0.2, s3.t1); spaced("NEW KIT", 540, 1560, F.e(96), WHITE, 30, a); line(540, 1630, 260 * a, a); }
    if (t >= s4.t0 && t < s4.t1) title("ชุดใหม่ ฤดูกาลใหม่", 1520, 96, t, s4.t0 + 0.15, s4.t1);
    if (t >= s5.t0 && t < s5.t1) { const a = vis(t, s5.t0 + 0.1, s5.t1); spaced("2027", 540, 300, F.e(150), GREEN, 20, a); }
    // ---- ambassador poster run: lower third
    const run = S.filter((x) => x.kind === "poster" && S.indexOf(x) > 7);
    if (run.length && t >= run[0].t0 && t < run[run.length - 1].t1) {
      const a = vis(t, run[0].t0, run[run.length - 1].t1, 0.3, 0.2);
      spaced("HIGHWAY FC", 540, 1785, F.e(56), WHITE, 18, a);
      spaced("2027  HOME  KIT", 540, 1845, F.e(34), GREEN, 14, a);
      g.globalAlpha = a; g.fillStyle = GREEN; g.fillRect(170, 1782, 90, 3); g.fillRect(820, 1782, 90, 3); g.globalAlpha = 1;
    }
    // ---- we are highway
    const pw = S.find((x) => x.kind === "photo" && x.src === "220307");
    if (pw && t >= pw.t0 && t < pw.t1) title("เราคือ ทางหลวง", 1560, 110, t, pw.t0 + 0.1, pw.t1);
    // ---- end card
    if (t >= last.t0) {
      title("ทางหลวง FC", 820, 160, t, last.t0 + 0.15, D.total + 1, WHITE, 10);
      const a = vis(t, last.t0 + 0.7, D.total + 1); line(540, 930, 520 * a, a);
      spaced("NEW KIT  2027", 540, 1010, F.e(70), GREEN, 26, vis(t, last.t0 + 0.9, D.total + 1));
      spaced("NEW KIT • NEW ERA", 540, 1200, F.e(52), WHITE, 16, vis(t, last.t0 + 1.6, D.total + 1));
    }
    // ---- white flash on hard cuts
    for (const x of S.slice(1)) { const u = t - x.t0; if (u >= 0 && u < 0.12) { g.fillStyle = `rgba(255,255,255,${0.35 * (1 - u / 0.12)})`; g.fillRect(0, 0, W, H); } }
    // ---- grain + fade out
    g.save(); const o = Math.floor(t * 30) % 4; g.translate(-o * 37, -o * 53); g.fillStyle = g.createPattern(grain, "repeat"); g.fillRect(0, 0, W + 256, H + 256); g.restore();
    const fo = prog(t, D.total - 0.6, D.total); if (fo > 0) { g.fillStyle = `rgba(0,0,0,${fo})`; g.fillRect(0, 0, W, H); }
  }
  window.scene = { setup, preload: () => Promise.resolve(), draw, events: () => ({ pen: [], pops: [], whoosh: [] }) };
})();
