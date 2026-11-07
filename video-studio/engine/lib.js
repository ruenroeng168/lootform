// Shared motion + drawing helpers for scene.js files (plain browser JS).
(function () {
  const L = {};
  L.clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
  L.lerp = (a, b, t) => a + (b - a) * t;
  L.prog = (t, a, b) => L.clamp((t - a) / (b - a)); // 0→1 progress of t over [a,b]
  L.ease = {
    outCubic: (x) => 1 - Math.pow(1 - x, 3),
    inCubic: (x) => x * x * x,
    inOutCubic: (x) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2),
    outBack: (x, s = 1.70158) => 1 + (s + 1) * Math.pow(x - 1, 3) + s * Math.pow(x - 1, 2),
    outElastic: (x) => x === 0 ? 0 : x === 1 ? 1 :
      Math.pow(2, -10 * x) * Math.sin((x * 10 - 0.75) * (2 * Math.PI) / 3) + 1,
    outExpo: (x) => (x === 1 ? 1 : 1 - Math.pow(2, -10 * x)),
  };
  // damped spring response to a step at time t0 (0 → 1 with overshoot)
  L.spring = (t, t0, freq = 3, damp = 5) => {
    const x = t - t0;
    if (x <= 0) return 0;
    return 1 - Math.exp(-damp * x) * Math.cos(2 * Math.PI * freq * x);
  };
  L.rng = (seed) => () => {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  L.noise1 = (x, seed = 0) => { // smooth value noise, -1..1
    const h = (n) => { const s = Math.sin(n * 127.1 + seed * 311.7) * 43758.5453; return s - Math.floor(s); };
    const i = Math.floor(x), f = x - i, u = f * f * (3 - 2 * f);
    return (h(i) * (1 - u) + h(i + 1) * u) * 2 - 1;
  };
  L.hexA = (hex, a) => {
    const n = parseInt(hex.slice(1), 16);
    return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
  };
  L.mix = (h1, h2, t) => {
    const a = parseInt(h1.slice(1), 16), b = parseInt(h2.slice(1), 16);
    const c = [16, 8, 0].map((s) => Math.round(L.lerp((a >> s) & 255, (b >> s) & 255, t)));
    return `rgb(${c[0]},${c[1]},${c[2]})`;
  };
  L.rrect = (g, x, y, w, h, r) => {
    g.beginPath(); g.roundRect(x, y, w, h, r);
  };
  // HUD corner brackets (LOOTFORM .hud-frame motif)
  L.brackets = (g, x, y, w, h, len, color, lw = 3, k = 1) => {
    g.save(); g.strokeStyle = color; g.lineWidth = lw; g.lineCap = "square";
    const l = len * k;
    const c = [[x, y, 1, 1], [x + w, y, -1, 1], [x, y + h, 1, -1], [x + w, y + h, -1, -1]];
    for (const [cx, cy, sx, sy] of c) {
      g.beginPath(); g.moveTo(cx + sx * l, cy); g.lineTo(cx, cy); g.lineTo(cx, cy + sy * l); g.stroke();
    }
    g.restore();
  };
  L.text = (g, str, x, y, font, color, align = "center", spacing = 0) => {
    g.font = font; g.fillStyle = color; g.textAlign = align; g.textBaseline = "middle";
    g.letterSpacing = spacing + "px";
    g.fillText(str, x, y);
    g.letterSpacing = "0px";
  };
  window.L = L;
})();
