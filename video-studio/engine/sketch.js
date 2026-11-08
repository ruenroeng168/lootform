// Whiteboard-animation engine: hand-drawn strokes revealed over time, handwriting,
// highlighter, live (procedural) elements, a drawing hand that follows the pen tip,
// and a camera that pans between boards. Pure function of time.
(function () {
  const { clamp, lerp, prog, ease, noise1, rng } = window.L;
  const NS = "http://www.w3.org/2000/svg";
  let pathEl;
  function sampler() {
    if (!pathEl) {
      const svg = document.createElementNS(NS, "svg");
      svg.style.position = "absolute"; svg.style.left = "-9999px";
      document.body.appendChild(svg);
      pathEl = document.createElementNS(NS, "path"); svg.appendChild(pathEl);
    }
    return pathEl;
  }

  // ---- path generators (return SVG d strings; absolute coords, uppercase commands)
  const P = {};
  P.poly = (pts, close = false) => "M" + pts.map((p) => p[0].toFixed(1) + "," + p[1].toFixed(1)).join(" L") + (close ? " Z" : "");
  P.circle = (cx, cy, r, turns = 1.06, start = -2.2, ry = r) => {
    const n = 60, pts = [];
    for (let i = 0; i <= n; i++) { const a = start + (i / n) * turns * Math.PI * 2; pts.push([cx + Math.cos(a) * r, cy + Math.sin(a) * ry]); }
    return P.poly(pts);
  };
  P.rrect = (x, y, w, h, r) =>
    `M${x + r},${y} H${x + w - r} Q${x + w},${y} ${x + w},${y + r} V${y + h - r} Q${x + w},${y + h} ${x + w - r},${y + h} ` +
    `H${x + r} Q${x},${y + h} ${x},${y + h - r} V${y + r} Q${x},${y} ${x + r},${y} Z`;
  P.arrow = (x1, y1, x2, y2, bend = 0, head = 26) => {
    const mx = (x1 + x2) / 2 - (y2 - y1) * bend, my = (y1 + y2) / 2 + (x2 - x1) * bend;
    const a = Math.atan2(y2 - my, x2 - mx);
    const h1 = [x2 - head * Math.cos(a - 0.45), y2 - head * Math.sin(a - 0.45)];
    const h2 = [x2 - head * Math.cos(a + 0.45), y2 - head * Math.sin(a + 0.45)];
    return `M${x1},${y1} Q${mx},${my} ${x2},${y2} M${h1[0]},${h1[1]} L${x2},${y2} L${h2[0]},${h2[1]}`;
  };
  P.star = (cx, cy, r) => `M${cx},${cy - r} Q${cx},${cy} ${cx + r},${cy} Q${cx},${cy} ${cx},${cy + r} Q${cx},${cy} ${cx - r},${cy} Q${cx},${cy} ${cx},${cy - r}`;
  P.squiggle = (x, y, w, amp = 8, waves = 6) => {
    const pts = [];
    for (let i = 0; i <= 80; i++) { const u = i / 80; pts.push([x + u * w, y + Math.sin(u * waves * Math.PI * 2) * amp]); }
    return P.poly(pts);
  };
  P.infinity = (cx, cy, a) => {
    const pts = [];
    for (let i = 0; i <= 120; i++) {
      const t = (i / 120) * Math.PI * 2, s = 1 + Math.sin(t) ** 2;
      pts.push([cx + (a * Math.cos(t)) / s, cy + (a * Math.sin(t) * Math.cos(t)) / s]);
    }
    return P.poly(pts);
  };

  // ---- visual styles ---------------------------------------------------
  const hex = (c) => (typeof c === "string" && c[0] === "#" && c.length === 7 ? [1, 3, 5].map((i) => parseInt(c.slice(i, i + 2), 16)) : null);
  const rgb = (a) => `rgb(${a.map((v) => Math.round(Math.max(0, Math.min(255, v)))).join(",")})`;
  const tint = (c, k) => { const h = hex(c); return h ? rgb(h.map((v) => v + (255 - v) * k)) : c; };   // toward white
  const shade = (c, k) => { const h = hex(c); return h ? rgb(h.map((v) => v * (1 - k))) : c; };         // toward black
  const lum = (c) => { const h = hex(c); return h ? (0.299 * h[0] + 0.587 * h[1] + 0.114 * h[2]) / 255 : 0.5; };
  let halftone = null;
  function halftonePattern(g) {
    if (!halftone) {
      const c = document.createElement("canvas"); c.width = c.height = 14; const x = c.getContext("2d");
      x.fillStyle = "rgba(0,0,0,0.9)"; x.beginPath(); x.arc(7, 7, 2.6, 0, 7); x.fill(); halftone = c;
    }
    return g.createPattern(halftone, "repeat");
  }
  function partialPath(g, it, p) {           // trace the first p of the stroke
    let rem = p * it.len;
    g.beginPath();
    for (const s of it.subs) {
      if (rem <= 0) break;
      g.moveTo(s.pts[0][0], s.pts[0][1]);
      for (let j = 1; j < s.pts.length; j++) {
        if (s.cum[j] > rem) { const k = (rem - s.cum[j - 1]) / (s.cum[j] - s.cum[j - 1] || 1);
          g.lineTo(lerp(s.pts[j - 1][0], s.pts[j][0], k), lerp(s.pts[j - 1][1], s.pts[j][1], k)); break; }
        g.lineTo(s.pts[j][0], s.pts[j][1]);
      }
      rem -= s.len;
    }
  }
  function popIn(g, it, t, dur = 0.38) {     // scale-in around the item's centre; returns alpha
    const x = prog(t, it.t0, it.t0 + Math.min(dur, it.dur + 0.15));
    const k = ease.outBack(x, 1.8);
    g.translate(it.cx, it.cy); g.scale(0.55 + 0.45 * k, 0.55 + 0.45 * k); g.translate(-it.cx, -it.cy);
    return clamp(x * 2.2);
  }
  const STYLE_STROKE = {
    watercolor(g, it, t, p) {
      if (it.fill) {
        const fa = prog(t, it.t0 + it.dur * 0.4, it.t0 + it.dur + 0.5) * it.fillAlpha;
        g.save(); g.filter = "blur(3.5px)";
        for (const [dx, dy, a] of [[-5, 3, 0.42], [5, -3, 0.38], [0, 0, 0.5], [2, 5, 0.25]]) {
          g.save(); g.translate(dx, dy); g.globalAlpha = fa * a; g.fillStyle = tint(it.fill, 0.08); g.fill(it.path2d); g.restore();
        }
        g.restore();
        g.globalAlpha = fa * 0.5; g.strokeStyle = shade(it.fill, 0.25); g.lineWidth = 3; g.stroke(it.path2d); g.globalAlpha = 1;
      }
      g.strokeStyle = it.fill ? shade(it.fill, 0.5) : it.color; g.globalAlpha = 0.5;
      g.lineWidth = Math.max(2, it.w * 0.4); g.lineCap = "round"; g.lineJoin = "round";
      partialPath(g, it, p); g.stroke();
    },
    paper(g, it, t) {
      const a = popIn(g, it, t); g.globalAlpha = a;
      g.shadowColor = "rgba(40,25,10,0.45)"; g.shadowBlur = 14; g.shadowOffsetY = 10;
      if (it.fill) { g.fillStyle = it.fill; g.fill(it.path2d); g.shadowColor = "transparent"; g.strokeStyle = "rgba(255,255,255,0.55)"; g.lineWidth = 2.5; g.stroke(it.path2d); }
      else { g.strokeStyle = it.color; g.lineWidth = it.w * 1.25; g.lineCap = "round"; g.lineJoin = "round"; partialPath(g, it, 1); g.stroke(); }
    },
    silhouette(g, it, t) {
      g.globalAlpha = prog(t, it.t0, it.t0 + Math.max(0.3, it.dur));
      const c = "#16121c";
      if (it.fill) { g.fillStyle = c; g.fill(it.path2d); g.strokeStyle = c; g.lineWidth = 3; g.stroke(it.path2d); }
      else { g.strokeStyle = c; g.lineWidth = it.w; g.lineCap = "round"; g.lineJoin = "round"; partialPath(g, it, 1); g.stroke(); }
    },
    flat(g, it, t) {
      const a = popIn(g, it, t, 0.32); g.globalAlpha = a;
      if (it.fill) { g.fillStyle = it.fill; g.fill(it.path2d); g.fillStyle = "rgba(0,0,0,0.08)"; g.save(); g.clip(it.path2d); g.translate(10, 12); g.fill(it.path2d); g.restore(); }
      else { g.strokeStyle = it.color; g.lineWidth = it.w; g.lineCap = "round"; g.lineJoin = "round"; partialPath(g, it, 1); g.stroke(); }
    },
    comic(g, it, t, p) {
      if (it.fill && p >= 1) {
        g.globalAlpha = prog(t, it.t0 + it.dur, it.t0 + it.dur + 0.2) * it.fillAlpha;
        g.fillStyle = it.fill; g.fill(it.path2d);
        g.save(); g.clip(it.path2d); g.globalAlpha *= 0.16; g.fillStyle = halftonePattern(g); g.fill(it.path2d); g.restore();
        g.globalAlpha = 1;
      }
      g.strokeStyle = "#111"; g.lineWidth = it.w * 1.6; g.lineCap = "round"; g.lineJoin = "round";
      partialPath(g, it, p); g.stroke();
    },
    chalk(g, it, t, p) {
      const c = lum(it.color) < 0.45 ? "#f2efe6" : tint(it.color, 0.35);
      if (it.fill && p >= 1) { g.globalAlpha = prog(t, it.t0 + it.dur, it.t0 + it.dur + 0.4) * 0.38; g.fillStyle = tint(it.fill, 0.3); g.fill(it.path2d); g.globalAlpha = 1; }
      g.lineCap = "round"; g.lineJoin = "round";
      for (const [dx, dy, a, w] of [[0, 0, 0.9, 1], [1.5, -1, 0.35, 0.6]]) {
        g.save(); g.translate(dx, dy); g.globalAlpha = a; g.strokeStyle = c; g.lineWidth = it.w * w;
        g.setLineDash([it.w * 2.2, it.w * 0.5]); partialPath(g, it, p); g.stroke(); g.restore();
      }
    },
  };
  const STYLE_WRITE = {
    paper(g, it, t) { const a = prog(t, it.t0, it.t0 + 0.3); g.globalAlpha = a; g.font = it.font; g.fillStyle = it.color; g.textAlign = "left"; g.textBaseline = "middle"; g.fillText(it.str, it.left, it.y); },
    flat(g, it, t) { STYLE_WRITE.paper(g, it, t); },
    silhouette(g, it, t) { g.globalAlpha = prog(t, it.t0, it.t0 + 0.4); g.font = it.font; g.fillStyle = lum(it.color) < 0.5 ? "#fff7e8" : it.color; g.textAlign = "left"; g.textBaseline = "middle"; g.shadowColor = "rgba(0,0,0,0.5)"; g.shadowBlur = 12; g.fillText(it.str, it.left, it.y); },
    comic(g, it, t, p) { g.beginPath(); g.rect(it.left - 20, it.y - it.size * 1.4, (it.w + 40) * p + 1, it.size * 2.8); g.clip(); g.font = it.font; g.textAlign = "left"; g.textBaseline = "middle"; g.lineWidth = 8; g.strokeStyle = "#fff"; g.lineJoin = "round"; g.strokeText(it.str, it.left, it.y); g.fillStyle = it.color; g.fillText(it.str, it.left, it.y); },
    chalk(g, it, t, p) { g.beginPath(); g.rect(it.left - 20, it.y - it.size * 1.4, (it.w + 40) * p + 1, it.size * 2.8); g.clip(); g.font = it.font; g.textAlign = "left"; g.textBaseline = "middle"; g.globalAlpha = 0.92; g.fillStyle = lum(it.color) < 0.45 ? "#f2efe6" : tint(it.color, 0.35); g.fillText(it.str, it.left, it.y); },
    watercolor(g, it, t, p) { g.beginPath(); g.rect(it.left - 20, it.y - it.size * 1.4, (it.w + 40) * p + 1, it.size * 2.8); g.clip(); g.font = it.font; g.textAlign = "left"; g.textBaseline = "middle"; g.fillStyle = it.color; g.globalAlpha = 0.9; g.fillText(it.str, it.left, it.y); },
  };

  // Background helpers for scenes: palette swap, texture overlay, frame.
  const STYLE_BG = {
    palette(style, kind, pal) {
      if (style === "silhouette") return kind === "storm" || kind === "night" ? ["#24163a", "#5b2f63", "#c4566a"] : ["#ff6f61", "#ffa36c", "#ffd59a"];
      if (style === "chalk") return ["#1f3a30", "#22403a", "#26463e"];
      if (style === "flat") return pal.map((c) => tint(c, 0.05));
      return pal;
    },
    ground(style, base) {
      if (style === "silhouette") return ["#16121c", "#16121c"];
      if (style === "chalk") return ["#22403a", "#1c362f"];
      return base;
    },
    overlay(g, style, W, H, t) {
      if (style === "watercolor") {
        g.save(); g.globalCompositeOperation = "multiply";
        const r = rng(17);
        for (let i = 0; i < 30; i++) { const x = r() * W, y = r() * H, rad = 120 + r() * 260; const gr = g.createRadialGradient(x, y, 10, x, y, rad); gr.addColorStop(0, `rgba(170,140,110,${0.08 + r() * 0.08})`); gr.addColorStop(1, "rgba(170,140,110,0)"); g.fillStyle = gr; g.fillRect(x - rad, y - rad, rad * 2, rad * 2); }
        g.restore();
      } else if (style === "comic") {
        g.save(); g.globalAlpha = 0.07; g.fillStyle = halftonePattern(g); g.fillRect(0, 0, W, H); g.restore();
      } else if (style === "chalk") {
        g.save(); const r = rng(23); g.fillStyle = "rgba(255,255,255,0.035)";
        for (let i = 0; i < 40; i++) { g.beginPath(); g.ellipse(r() * W, r() * H, 80 + r() * 200, 20 + r() * 50, r() * 3, 0, 7); g.fill(); }
        g.restore();
      } else if (style === "paper") {
        g.save(); const r = rng(29); g.fillStyle = "rgba(120,90,50,0.05)";
        for (let i = 0; i < 1600; i++) g.fillRect(r() * W, r() * H, 2, 2);
        g.restore();
      }
    },
    frame(g, style, W, H) {   // screen-space frame (comic panel border)
      if (style !== "comic") return;
      g.save(); g.strokeStyle = "#111"; g.lineWidth = 14; g.strokeRect(40, 40, W - 80, H - 80);
      g.fillStyle = "#fffdf6"; g.fillRect(0, 0, W, 33); g.fillRect(0, H - 33, W, 33); g.fillRect(0, 0, 33, H); g.fillRect(W - 33, 0, 33, H);
      g.restore();
    },
  };

  // ---- Board ---------------------------------------------------------
  class Board {
    constructor(g, opts = {}) {
      this.g = g; this.items = []; this.cursor = 0;
      this.speed = opts.speed || 1100;  // px per second of marker travel
      this.writeSpeed = opts.writeSpeed || 650;
      this.color = opts.color || "#1f2430";
      this.width = opts.width || 6;
      this.space = "world";
      // visual style: ink | watercolor | paper | silhouette | flat | comic | chalk
      this.style = opts.style || "ink";
      this.showHand = ["ink", "chalk"].includes(this.style);
      this.scenes = [];   // [{t, x, y}] camera keys
      this.pops = [];
    }
    go(t) { this.cursor = t; return this; }
    wait(s) { this.cursor += s; return this; }
    _place(item, dur) {
      item.t0 = item.t0 ?? this.cursor; item.dur = item.dur ?? dur;
      item.space = item.space || this.space;
      item.ox = item.ox ?? this.ox ?? 0; item.oy = item.oy ?? this.oy ?? 0;
      this.cursor = item.t0 + item.dur + (item.gapAfter ?? 0.06);
      this.items.push(item); return item;
    }
    // Delay each camera move until the previous board's pen work is done.
    settleCamera(pad = 0.2, maxDelay = 0.5) {
      for (let i = 1; i < this.scenes.length; i++) {
        const prev = this.scenes[i - 1];
        const ends = this.items.filter((it) => it.space === "world" && it.ox === prev.x && it.oy === prev.y && !it.nopen)
          .map((it) => it.t0 + it.dur);
        if (ends.length) this.scenes[i].t = Math.min(this.scenes[i].t + maxDelay, Math.max(this.scenes[i].t, Math.max(...ends) + pad));
      }
    }
    scene(t, x, y) { this.scenes.push({ t, x, y }); this.ox = x; this.oy = y; return this; }

    stroke(d, o = {}) {
      const el = sampler(), s = o.s ?? 1, x = o.x ?? 0, y = o.y ?? 0, wob = o.wob ?? 1.4;
      const subs = d.trim().split(/(?=M)/).map((sd, si) => {
        el.setAttribute("d", sd);
        const L = el.getTotalLength(), n = Math.max(2, Math.ceil((L * s) / 3)), pts = [], cum = [0];
        for (let i = 0; i <= n; i++) {
          const p = el.getPointAtLength((L * i) / n);
          const j = wob * noise1(i * 0.07 + si * 13, this.items.length);
          const k = wob * noise1(i * 0.07 + si * 13 + 50, this.items.length);
          pts.push([x + p.x * s + j, y + p.y * s + k]);
          if (i) cum.push(cum[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
        }
        return { pts, cum, len: cum[cum.length - 1] };
      });
      const len = subs.reduce((a, b) => a + b.len, 0);
      let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
      for (const sb of subs) for (const [px, py] of sb.pts) { x0 = Math.min(x0, px); y0 = Math.min(y0, py); x1 = Math.max(x1, px); y1 = Math.max(y1, py); }
      const path2d = o.fill ? (() => { const p = new Path2D(); p.addPath(new Path2D(d), new DOMMatrix([s, 0, 0, s, x, y])); return p; })() : null;
      return this._place({ type: "stroke", subs, len, path2d, cx: (x0 + x1) / 2, cy: (y0 + y1) / 2, color: o.color || this.color, w: o.w || this.width,
        fill: o.fill, fillAlpha: o.fillAlpha ?? 1, t0: o.t0, gapAfter: o.gapAfter, space: o.space, pop: o.pop },
      o.dur ?? clamp(len / this.speed, 0.18, 2.2));
    }

    write(str, o = {}) {
      const g = this.g; g.font = o.font; g.letterSpacing = "0px";
      const m = g.measureText(str), w = m.width;
      const align = o.align || "left";
      const left = align === "center" ? o.x - w / 2 : align === "right" ? o.x - w : o.x;
      return this._place({ type: "write", str, font: o.font, color: o.color || this.color, left, y: o.y, w,
        size: parseInt(o.font.match(/(\d+)px/)[1]), t0: o.t0, gapAfter: o.gapAfter, space: o.space },
      o.dur ?? clamp(w / this.writeSpeed, 0.35, 1.8));
    }

    highlight(x, y, w, h, o = {}) {
      return this._place({ type: "hl", x, y, w, h, color: o.color || "rgba(255,216,77,0.55)", t0: o.t0,
        gapAfter: o.gapAfter ?? 0, space: o.space, nopen: true }, o.dur ?? 0.35);
    }

    live(fn, o = {}) {  // procedural element drawn every frame after t0
      return this._place({ type: "live", fn, t0: o.t0, space: o.space, nopen: true, gapAfter: 0 }, o.dur ?? 0);
    }

    // ---- camera & hand
    camera(t) {
      const S = this.scenes;
      if (!S.length) return { x: 0, y: 0 };
      let i = 0;
      while (i + 1 < S.length && S[i + 1].t <= t + 0.6) i++;
      const cur = S[i], prev = S[Math.max(0, i - 1)];
      const k = ease.inOutCubic(prog(t, cur.t - 0.6, cur.t + 0.3));
      return { x: lerp(prev.x, cur.x, k), y: lerp(prev.y, cur.y, k) };
    }
    tip(it, t, cam) {
      const p = this.progress(it, t);
      let x, y;
      if (it.type === "stroke") {
        let rem = p * it.len; let last = it.subs[0].pts[0];
        for (const s of it.subs) {
          if (rem <= 0) break;
          if (rem >= s.len) { last = s.pts[s.pts.length - 1]; rem -= s.len; continue; }
          let j = 1; while (j < s.cum.length && s.cum[j] < rem) j++;
          last = s.pts[Math.min(j, s.pts.length - 1)]; rem = 0;
        }
        [x, y] = last;
      } else {
        x = it.left + p * it.w; y = it.y + it.size * (0.05 + 0.22 * Math.sin(p * it.w / 14));
      }
      x += it.ox; y += it.oy;
      if (it.space === "world") { x -= cam.x; y -= cam.y; }
      return [x, y];
    }
    progress(it, t) {
      const x = prog(t, it.t0, it.t0 + it.dur);
      return it.type === "write" ? x : 0.25 * x + 0.75 * ease.inOutCubic(x);
    }
    penIntervals() {
      if (!this.showHand) return [];
      return this.items.filter((it) => !it.nopen).map((it) => [it.t0, it.t0 + it.dur, it.type])
        .sort((a, b) => a[0] - b[0]);
    }
    hand(t, cam) {
      const pen = this.items.filter((it) => !it.nopen).sort((a, b) => a.t0 - b.t0);
      const OFF = [2150, 1300];
      let i = pen.findIndex((it) => t >= it.t0 && t <= it.t0 + it.dur);
      if (i >= 0) return { pos: this.tip(pen[i], t, cam), down: true };
      const next = pen.find((it) => it.t0 > t);
      const prevs = pen.filter((it) => it.t0 + it.dur < t);
      const prev = prevs.length ? prevs.reduce((a, b) => (a.t0 + a.dur > b.t0 + b.dur ? a : b)) : null;
      const a = prev ? this.tip(prev, prev.t0 + prev.dur, cam) : OFF;
      const b = next ? this.tip(next, next.t0, cam) : OFF;
      const ta = prev ? prev.t0 + prev.dur : -1, tb = next ? next.t0 : 1e9;
      if (tb - ta < 1.1 && prev && next) {
        const k = ease.inOutCubic(prog(t, ta, tb));
        return { pos: [lerp(a[0], b[0], k), lerp(a[1], b[1], k) - Math.sin(Math.PI * k) * 40], down: false };
      }
      if (t - ta < 0.5) { const k = ease.inCubic(prog(t, ta, ta + 0.5)); return { pos: [lerp(a[0], OFF[0], k), lerp(a[1], OFF[1], k)], down: false }; }
      if (tb - t < 0.5) { const k = ease.outCubic(prog(t, tb - 0.5, tb)); return { pos: [lerp(OFF[0], b[0], k), lerp(OFF[1], b[1], k)], down: false }; }
      return { pos: OFF, down: false };
    }

    // ---- drawing
    drawItem(it, t) {
      const g = this.g;
      if (t < it.t0) return;
      const p = this.progress(it, t);
      g.save();
      if (it.type === "stroke" && this.style !== "ink") {
        STYLE_STROKE[this.style](g, it, t, p, this);
      } else if (it.type === "write" && this.style !== "ink" && STYLE_WRITE[this.style]) {
        STYLE_WRITE[this.style](g, it, t, p, this);
      } else if (it.type === "stroke") {
        if (it.fill && p >= 1) {
          const fa = prog(t, it.t0 + it.dur, it.t0 + it.dur + 0.35);
          g.globalAlpha = fa * it.fillAlpha; g.fillStyle = it.fill; g.fill(it.path2d); g.globalAlpha = 1;
        }
        g.strokeStyle = it.color; g.lineWidth = it.w; g.lineCap = "round"; g.lineJoin = "round";
        let rem = p * it.len;
        for (const s of it.subs) {
          if (rem <= 0) break;
          g.beginPath(); g.moveTo(s.pts[0][0], s.pts[0][1]);
          for (let j = 1; j < s.pts.length; j++) {
            if (s.cum[j] > rem) {
              const k = (rem - s.cum[j - 1]) / (s.cum[j] - s.cum[j - 1] || 1);
              g.lineTo(lerp(s.pts[j - 1][0], s.pts[j][0], k), lerp(s.pts[j - 1][1], s.pts[j][1], k));
              break;
            }
            g.lineTo(s.pts[j][0], s.pts[j][1]);
          }
          g.stroke(); rem -= s.len;
        }
      } else if (it.type === "write") {
        g.beginPath(); g.rect(it.left - 20, it.y - it.size * 1.4, (it.w + 40) * p + 1, it.size * 2.8); g.clip();
        g.font = it.font; g.fillStyle = it.color; g.textAlign = "left"; g.textBaseline = "middle";
        g.fillText(it.str, it.left, it.y);
      } else if (it.type === "hl") {
        g.fillStyle = it.color; g.globalCompositeOperation = "multiply";
        const w = it.w * ease.outCubic(p);
        g.beginPath(); g.moveTo(it.x, it.y + 4); g.lineTo(it.x + w, it.y); g.lineTo(it.x + w - 6, it.y + it.h); g.lineTo(it.x + 4, it.y + it.h - 3); g.closePath(); g.fill();
      } else if (it.type === "live") {
        it.fn(g, t, t - it.t0);
      }
      g.restore();
    }
    draw(t, space, cam) {
      const g = this.g;
      g.save();
      if (space === "world") g.translate(-cam.x, -cam.y);
      for (const it of this.items) {
        if (it.space !== space || t < it.t0) continue;
        if (space === "world") {
          if (Math.abs(it.ox - cam.x) > 2400 || Math.abs(it.oy - cam.y) > 1600) continue;
          g.save(); g.translate(it.ox, it.oy); this.drawItem(it, t); g.restore();
        } else { g.save(); g.translate(it.ox, it.oy); this.drawItem(it, t); g.restore(); }
      }
      g.restore();
    }
  }

  // A cartoon hand holding a marker, pen tip at (x, y).
  function drawHand(g, x, y, down, t, markerCol = "#1f2430") {
    g.save();
    g.translate(x, y + (down ? 0 : -10));
    g.rotate(0.12 * Math.sin(t * 1.3) * (down ? 0.2 : 1));
    const a = 0.78, ca = Math.cos(a), sa = Math.sin(a);
    const ax = (d, n = 0) => [ca * d - sa * n, sa * d + ca * n];
    // soft shadow
    g.save(); g.translate(26, 34); g.globalAlpha = 0.14; g.fillStyle = "#000"; g.filter = "blur(14px)";
    g.beginPath(); g.ellipse(...ax(190), 120, 70, a, 0, 7); g.fill(); g.restore();
    // sleeve
    g.fillStyle = "#2b3a67"; g.strokeStyle = "#1f2430"; g.lineWidth = 3;
    g.beginPath(); const s1 = ax(270, -85), s2 = ax(270, 95), s3 = ax(900, 140), s4 = ax(900, -140);
    g.moveTo(...s1); g.lineTo(...s4); g.lineTo(...s3); g.lineTo(...s2); g.closePath(); g.fill(); g.stroke();
    g.fillStyle = "#f3f2ed"; g.beginPath(); g.moveTo(...s1); g.lineTo(...ax(300, -95)); g.lineTo(...ax(300, 105)); g.lineTo(...s2); g.closePath(); g.fill(); g.stroke();
    // marker
    g.save(); g.rotate(a);
    g.fillStyle = "#cfd3dc"; g.beginPath(); g.moveTo(0, 0); g.lineTo(22, -9); g.lineTo(22, 9); g.closePath(); g.fill();
    g.fillStyle = markerCol; g.beginPath(); g.moveTo(0, 0); g.lineTo(8, -3.5); g.lineTo(8, 3.5); g.closePath(); g.fill();
    g.fillStyle = "#fafafa"; g.strokeStyle = "#1f2430"; g.lineWidth = 3;
    g.beginPath(); g.roundRect(22, -17, 240, 34, 6); g.fill(); g.stroke();
    g.fillStyle = markerCol; g.fillRect(200, -17, 62, 34); g.strokeRect(200, -17, 62, 34);
    g.restore();
    // hand
    g.fillStyle = "#f2c7a5"; g.strokeStyle = "#1f2430"; g.lineWidth = 3;
    g.beginPath(); g.ellipse(...ax(175, 22), 92, 74, a, 0, 7); g.fill(); g.stroke();        // palm
    for (let i = 0; i < 3; i++) {                                                             // fingers
      g.beginPath(); g.ellipse(...ax(98 + i * 30, -26 + i * 4), 22, 15, a + 0.25, 0, 7); g.fill(); g.stroke();
    }
    g.beginPath(); g.ellipse(...ax(92, 26), 34, 16, a - 0.5, 0, 7); g.fill(); g.stroke();      // thumb
    g.restore();
  }

  window.SK = { P, Board, drawHand, STYLE_BG };
})();
