// Photo-story template: cinematic full-bleed photos (Ken Burns), year stamps, count-up stats,
// per-photo credits (CC attribution) and synced captions. Content: data.json "segments".
//
// segment = { cue, img, img2?, year?, title?, sub?, stats?: [{value, suffix?, label}], statsMode?: "swap"|"stack",
//             kb?: "in"|"out"|"left"|"right" }
// Stats appear one per sync mark ("|") of the cue's voice line; extra marks after the stats reveal the title.
(function () {
  const { clamp, lerp, prog, ease, rng, hexA } = window.L;
  const W = 1080, H = 1920;
  const F = { b: (s) => `700 ${s}px "IBM Plex Sans Thai"`, m: (s) => `600 ${s}px "IBM Plex Sans Thai"`, d: (s) => `700 ${s}px "Chakra Petch"` };
  let g, TL, C, D, A1, A2, GOLD, photos = {}, credits = {}, grain;

  const MK = (k, i) => (C[k] ? (i === 0 ? C[k].start : C[k].marks[i - 1] ?? C[k].end) : 1e9);

  function setup(canvas, tl) {
    g = canvas.getContext("2d"); TL = tl; C = tl.cues; D = tl.data || {};
    A1 = D.accent || "#d4122b"; A2 = D.accent2 || "#0a7a3e"; GOLD = D.gold || "#f2c14e";
    (D.credits || []).forEach((c) => (credits[c.key] = c));
    grain = document.createElement("canvas"); grain.width = grain.height = 256;
    const gg = grain.getContext("2d"), r = rng(3), id = gg.createImageData(256, 256);
    for (let i = 0; i < id.data.length; i += 4) { const v = 128 + (r() - 0.5) * 90; id.data[i] = id.data[i + 1] = id.data[i + 2] = v; id.data[i + 3] = 22; }
    gg.putImageData(id, 0, 0);
  }
  function preload() {
    const imgs = D.images || {};
    return Promise.all(Object.entries(imgs).map(([k, src]) => new Promise((res) => {
      const im = new Image(); im.onload = () => { photos[k] = im; res(); }; im.onerror = () => res();
      im.src = src.startsWith("data:") ? src : "../" + src;
    })));
  }

  // ------------------------------------------------------------ helpers
  function txt(s, x, y, font, color, align = "center", ls = 0) {
    g.font = font; g.fillStyle = color; g.textAlign = align; g.textBaseline = "middle"; g.letterSpacing = ls + "px";
    g.fillText(s, x, y); g.letterSpacing = "0px";
  }
  function shadowText(s, x, y, font, color, align = "center", ls = 0) {
    g.save(); g.shadowColor = "rgba(0,0,0,0.55)"; g.shadowBlur = 24; g.shadowOffsetY = 4; txt(s, x, y, font, color, align, ls); g.restore();
  }
  function fit(s, font, size, maxW) { g.font = font(size); const w = g.measureText(s).width; return w > maxW ? Math.floor(size * maxW / w) : size; }

  function drawPhoto(key, t, t0, t1, kb, alpha) {
    const im = photos[key];
    if (!im || alpha <= 0) return;
    const p = clamp((t - t0) / Math.max(1, t1 - t0));
    let z = 1.06, dx = 0, dy = 0;
    if (kb === "out") z = lerp(1.16, 1.04, p); else z = lerp(1.04, 1.16, ease.inOutCubic(p));
    if (kb === "left") dx = lerp(40, -40, p); if (kb === "right") dx = lerp(-40, 40, p);
    const sc = Math.max(W / im.width, H / im.height) * z;
    const fx = (D.focus && D.focus[key]) || [0.5, 0.4];                 // focal point (0..1) to keep in frame
    const iw = im.width * sc, ih = im.height * sc;
    const x = clamp(W / 2 - iw * fx[0], W - iw, 0) + dx, y = clamp(H * 0.42 - ih * fx[1], H - ih, 0) + dy;
    g.save(); g.globalAlpha = alpha; g.filter = "saturate(0.92) contrast(1.06)";
    g.drawImage(im, x, y, iw, ih); g.restore();
  }

  function segWindow(i) {
    const S = D.segments, s = S[i];
    const t0 = C[s.cue].start - 0.45, t1 = (S[i + 1] ? C[S[i + 1].cue].start - 0.45 : TL.duration + 1);
    return [t0, t1];
  }

  function grade() {
    let gr = g.createLinearGradient(0, 0, 0, H);
    gr.addColorStop(0, "rgba(0,0,0,0.55)"); gr.addColorStop(0.22, "rgba(0,0,0,0.05)");
    gr.addColorStop(0.55, "rgba(0,0,0,0.15)"); gr.addColorStop(1, "rgba(0,0,0,0.88)");
    g.fillStyle = gr; g.fillRect(0, 0, W, H);
    const vg = g.createRadialGradient(W / 2, H / 2, H * 0.3, W / 2, H / 2, H * 0.75);
    vg.addColorStop(0, "rgba(0,0,0,0)"); vg.addColorStop(1, "rgba(0,0,0,0.45)");
    g.fillStyle = vg; g.fillRect(0, 0, W, H);
  }

  function segmentText(s, i, t) {
    const [t0, t1] = segWindow(i);
    const a = prog(t, t0 + 0.3, t0 + 0.8) * (1 - prog(t, t1 - 0.35, t1));
    if (a <= 0) return;
    const nStats = (s.stats || []).length;
    g.save(); g.globalAlpha = a;
    if (s.year) {
      const yp = ease.outCubic(prog(t, t0 + 0.3, t0 + 1.2));
      g.save(); g.globalAlpha = a * 0.9;
      g.font = F.d(190); g.lineWidth = 4; g.strokeStyle = hexA("#ffffff", 0.85); g.textAlign = "left"; g.textBaseline = "middle";
      g.letterSpacing = lerp(60, 18, yp) + "px"; g.strokeText(s.year, 120, 985); g.letterSpacing = "0px";  // left-aligned, above the title
      g.restore();
    }
    // title reveal: after the stats (if any) — at mark index nStats
    const off = s.statsFrom || 0;  // stats start at this sync mark (0 = line start)
    const tt = nStats ? MK(s.cue, nStats + off) : C[s.cue].start + 0.1;
    const tp = ease.outCubic(prog(t, tt - 0.1, tt + 0.5));
    if (s.title && tp > 0) {
      g.save(); g.globalAlpha = a * tp; g.translate(0, (1 - tp) * 30);
      const ts = fit(s.title, F.b, 92, 880);
      g.fillStyle = A1; g.fillRect(90, 1150 - ts * 0.55, 10, ts * 1.1);
      shadowText(s.title, 125, 1150, F.b(ts), "#ffffff", "left");
      if (s.sub) shadowText(s.sub, 128, 1150 + ts * 0.62 + 34, F.m(fit(s.sub, F.m, 44, 860)), hexA("#ffffff", 0.88), "left");
      g.restore();
    }
    if (nStats) drawStats(s, t, t1);
    g.restore();
  }

  function drawStats(s, t, t1) {
    const stats = s.stats, swap = (s.statsMode || "stack") === "swap", off = s.statsFrom || 0;
    stats.forEach((st, j) => {
      const ts = MK(s.cue, j + off) + (j + off === 0 ? 0.05 : 0);
      const te = swap ? MK(s.cue, j + off + 1) : t1;
      const p = prog(t, ts, ts + 0.45), out = swap ? prog(t, te - 0.15, te + 0.1) : 0;
      if (p <= 0 || out >= 1) return;
      const k = ease.outBack(p, 1.6);
      const y = swap ? 1000 : 520 + j * 240;
      const val = Math.round(lerp(0, st.value, ease.outExpo(prog(t, ts, ts + 0.9))));
      g.save(); g.globalAlpha *= (1 - out) * clamp(p * 2);
      g.translate(W / 2, y); g.scale(lerp(0.7, 1, k), lerp(0.7, 1, k));
      if (!swap) {
        g.fillStyle = "rgba(10,10,14,0.55)"; g.beginPath(); g.roundRect(-430, -105, 860, 210, 28); g.fill();
        g.fillStyle = GOLD; g.fillRect(-430, -105, 10, 210);
        txt(`${val.toLocaleString()}${st.suffix || ""}`, -380, -8, F.d(150), GOLD, "left");
        g.font = F.d(150); const nw = g.measureText(`${st.value.toLocaleString()}${st.suffix || ""}`).width;
        const lx = -380 + nw + 30;
        txt(st.label, lx, -24, F.b(fit(st.label, F.b, 46, 380 - nw + 380)), "#ffffff", "left");
        if (st.note) txt(st.note, lx, 34, F.m(fit(st.note, F.m, 32, 380 - nw + 380)), hexA("#ffffff", 0.75), "left");
      } else {
        shadowText(`${val.toLocaleString()}${st.suffix || ""}`, 0, -40, F.d(300), GOLD);
        shadowText(st.label, 0, 150, F.b(72), "#ffffff");
      }
      g.restore();
    });
  }

  function creditLine(key, t, a) {
    const c = credits[key];
    if (!c || a <= 0) return;
    g.save(); g.globalAlpha = a * 0.85;
    txt(`ภาพ${c.year ? ` (${c.year})` : ""}: ${c.author} · ${c.license} · ${c.site || "Wikimedia Commons"}`, 60, 120, F.m(24), "#ffffff", "left");
    g.restore();
  }

  function captions(t) {
    let seg = null;
    for (const k of Object.keys(C)) {
      const c = C[k];
      c.parts.forEach((p, i) => {
        const s = i === 0 ? c.start - 0.05 : c.marks[i - 1];
        const e = i < c.parts.length - 1 ? c.marks[i] : c.end + 0.25;
        if (t >= s && t < e) seg = { p, s, e };
      });
    }
    if (!seg) return;
    const a = prog(t, seg.s, seg.s + 0.12) * (1 - prog(t, seg.e - 0.1, seg.e));
    g.font = F.b(44);
    const words = seg.p.split(" "), lines = [""];
    for (const w of words) { const tt = (lines[lines.length - 1] + " " + w).trim(); if (g.measureText(tt).width > 900 && lines[lines.length - 1]) lines.push(w); else lines[lines.length - 1] = tt; }
    g.save(); g.globalAlpha = a;
    lines.slice(0, 2).forEach((l, i) => shadowText(l, W / 2, 1530 + i * 60 - (lines.length > 1 ? 30 : 0), F.b(44), "#ffffff"));
    g.restore();
  }

  function draw(t) {
    g.setTransform(1, 0, 0, 1, 0, 0); g.globalAlpha = 1;
    g.fillStyle = "#000"; g.fillRect(0, 0, W, H);
    const S = D.segments || [];
    S.forEach((s, i) => {
      const [t0, t1] = segWindow(i);
      if (t < t0 - 0.1 || t > t1 + 0.7) return;
      const a = prog(t, t0, t0 + 0.7);
      // optional second photo from the cue's 2nd mark on
      const t2 = s.img2 ? MK(s.cue, s.img2At || 1) - 0.2 : 1e9;
      drawPhoto(s.img, t, t0, t1 + 0.7, s.kb || "in", a * (1 - prog(t, t2, t2 + 0.6)));
      if (s.img2) drawPhoto(s.img2, t, t2, t1 + 0.7, "out", prog(t, t2, t2 + 0.6));
    });
    grade();
    let cur = 0; S.forEach((s, i) => { if (t >= segWindow(i)[0] + 0.35) cur = i; });
    S.forEach((s, i) => segmentText(s, i, t));
    const s = S[cur];
    if (s) {
      const t2 = s.img2 ? MK(s.cue, s.img2At || 1) - 0.2 : 1e9;
      const [t0, t1] = segWindow(cur);
      creditLine(t >= t2 ? s.img2 : s.img, t, prog(t, t0 + 0.4, t0 + 0.8) * (1 - prog(t, t1 - 0.3, t1)));
    }
    captions(t);
    // end card credits
    if (D.end_credits) {
      const e = prog(t, TL.duration - 2.6, TL.duration - 2.1);
      if (e > 0) {
        g.save(); g.globalAlpha = e;
        g.fillStyle = "rgba(0,0,0,0.65)"; g.fillRect(0, 1640, W, 200);
        D.end_credits.forEach((l, i) => txt(l, W / 2, 1690 + i * 38, F.m(26), hexA("#ffffff", 0.85)));
        g.restore();
      }
    }
    g.save(); g.globalCompositeOperation = "overlay"; g.fillStyle = g.createPattern(grain, "repeat");
    g.translate((t * 97) % 256, (t * 53) % 256); g.fillRect(-256, -256, W + 512, H + 512); g.restore();
    const fin = Math.max(prog(t, TL.duration - 0.9, TL.duration - 0.05), 1 - prog(t, 0, 0.5));
    if (fin > 0) { g.fillStyle = `rgba(0,0,0,${fin})`; g.fillRect(0, 0, W, H); }
  }

  function events() {
    const hits = [], cuts = [];
    (D.segments || []).forEach((s, i) => {
      cuts.push(segWindow(i)[0]);
      (s.stats || []).forEach((st, j) => hits.push(MK(s.cue, j + (s.statsFrom || 0))));
    });
    return { pen: [], hits, cuts, swell: C[(D.segments || []).slice(-1)[0]?.cue]?.start };
  }
  window.scene = { setup, preload, draw, events };
})();
