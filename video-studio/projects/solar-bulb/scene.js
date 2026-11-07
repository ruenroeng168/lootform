// Vertical product-review template for TikTok Shop / Shopee affiliate ("ปักตะกร้า").
// Content comes from data.json (TL.data) + voice cues from script.json.
// Safe zones: keep key content inside x 60..940 and y 150..1500 (platform UI covers
// the right edge and the bottom). The CTA arrow points at the basket area bottom-left.
(function () {
  const { clamp, lerp, prog, ease, rng, noise1, hexA } = window.L;
  const W = 1080, H = 1920;
  const INK = "#1d1f27", MUTED = "#6b7080", GOOD = "#1fa463", BAD = "#e5484d", WHITE = "#ffffff";
  const F = {
    b: (s) => `700 ${s}px "IBM Plex Sans Thai"`, m: (s) => `600 ${s}px "IBM Plex Sans Thai"`,
    d: (s) => `700 ${s}px "Chakra Petch"`, hand: (s) => `400 ${s}px "Sriracha"`,
  };
  let g, TL, C, D, THEME, imgs = [], blobs = [];
  const has = (k) => !!(C && C[k]);
  const T0 = (k) => (has(k) ? C[k].start : 1e9);
  const T1 = (k) => (has(k) ? C[k].end : 1e9);
  const MK = (k, i) => (has(k) ? (i === 0 ? C[k].start : C[k].marks[i - 1] ?? C[k].end) : 1e9);

  function setup(canvas, tl) {
    g = canvas.getContext("2d"); TL = tl; C = tl.cues; D = tl.data || {};
    THEME = D.theme || "#ff6b4a";
    const r = rng(4);
    blobs = Array.from({ length: 6 }, () => ({ x: r() * W, y: r() * H, r: 220 + r() * 260, p: r() * 6, s: 0.2 + r() * 0.3 }));
  }
  function preload() {
    return Promise.all((D.images || []).map((src) => new Promise((res) => {
      const im = new Image(); im.onload = () => res(im); im.onerror = () => { console.error("image failed: " + src); res(null); };
      im.src = src.startsWith("data:") ? src : "../" + src;
    }))).then((list) => { imgs = list.filter(Boolean); });
  }

  // ------------------------------------------------------------ helpers
  function rr(x, y, w, h, r) { g.beginPath(); g.roundRect(x, y, w, h, r); }
  function txt(s, x, y, font, color, align = "center") { g.font = font; g.fillStyle = color; g.textAlign = align; g.textBaseline = "middle"; g.fillText(s, x, y); }
  function fit(s, font, size, maxW) { g.font = font(size); const w = g.measureText(s).width; return w > maxW ? Math.floor(size * maxW / w) : size; }
  function wrap(s, font, maxW) {
    g.font = font; const words = s.split(" "), lines = [""];
    for (const w of words) { const t = (lines[lines.length - 1] + " " + w).trim(); if (g.measureText(t).width > maxW && lines[lines.length - 1]) lines.push(w); else lines[lines.length - 1] = t; }
    return lines;
  }
  function shadowed(fn, blur = 50, col = "rgba(20,20,40,0.22)", oy = 24) {
    g.save(); g.shadowColor = col; g.shadowBlur = blur; g.shadowOffsetY = oy; fn(); g.restore();
  }

  // stylised placeholder product when no photo is provided
  function placeholderProduct(cx, cy, s, t) {
    g.save(); g.translate(cx, cy); g.scale(s, s);
    const body = g.createLinearGradient(-110, 0, 110, 0);
    body.addColorStop(0, "#c9ced8"); body.addColorStop(0.35, "#f4f6fa"); body.addColorStop(0.6, "#d9dde6"); body.addColorStop(1, "#aeb4c0");
    rr(-110, -170, 220, 430, 60); g.fillStyle = body; g.fill();
    rr(-110, -40, 220, 210, 20); g.fillStyle = hexA(THEME, 0.9); g.fill();
    rr(-80, -250, 160, 95, 30); g.fillStyle = INK; g.fill();
    rr(-26, -300, 52, 60, 14); g.fillStyle = "#3a3d48"; g.fill();
    g.globalAlpha = 0.35; rr(-80, -150, 26, 380, 13); g.fillStyle = WHITE; g.fill(); g.globalAlpha = 1;
    txt("1L", 0, 70, F.d(64), WHITE);
    g.restore();
  }
  function productImage(k, x, y, w, h, t, alpha = 1) {
    g.save(); g.globalAlpha *= alpha;
    shadowed(() => { rr(x, y, w, h, 48); g.fillStyle = WHITE; g.fill(); });
    rr(x, y, w, h, 48); g.clip();
    g.fillStyle = WHITE; g.fillRect(x, y, w, h);
    const im = imgs.length ? imgs[k % imgs.length] : null;
    const kb = 1.04 + 0.04 * Math.sin(t * 0.35 + k);            // slow Ken Burns zoom
    if (im) {
      const ar = im.width / im.height, car = w / h;
      if (Math.abs(ar / car - 1) > 0.25) {
        // very different aspect: blurred cover backdrop + whole image contained (nothing cropped away)
        const cs = Math.max(w / im.width, h / im.height) * 1.1;
        g.save(); g.filter = "blur(28px) brightness(1.05)";
        g.drawImage(im, x + w / 2 - (im.width * cs) / 2, y + h / 2 - (im.height * cs) / 2, im.width * cs, im.height * cs);
        g.restore();
        const sc = Math.min(w / im.width, h / im.height) * (kb - 0.02);
        g.drawImage(im, x + w / 2 - (im.width * sc) / 2, y + h / 2 - (im.height * sc) / 2, im.width * sc, im.height * sc);
      } else {
        const sc = Math.max(w / im.width, h / im.height) * kb;
        g.drawImage(im, x + w / 2 - (im.width * sc) / 2 + 10 * Math.sin(t * 0.3), y + h / 2 - (im.height * sc) / 2, im.width * sc, im.height * sc);
      }
    } else {
      const bg = g.createRadialGradient(x + w / 2, y + h * 0.45, 20, x + w / 2, y + h / 2, w * 0.7);
      bg.addColorStop(0, hexA(THEME, 0.18)); bg.addColorStop(1, hexA(THEME, 0.04));
      g.fillStyle = bg; g.fillRect(x, y, w, h);
      placeholderProduct(x + w / 2, y + h * 0.52 + 8 * Math.sin(t * 1.6), Math.min(w, h) / 760 * kb, t);
    }
    g.restore();
  }

  // ------------------------------------------------------------ layers
  function background(t) {
    const bg = g.createLinearGradient(0, 0, 0, H);
    bg.addColorStop(0, "#fff7f2"); bg.addColorStop(1, "#ffe9e0");
    g.fillStyle = bg; g.fillRect(0, 0, W, H);
    for (const b of blobs) {
      const x = b.x + 80 * Math.sin(t * b.s + b.p), y = b.y + 60 * Math.cos(t * b.s * 0.8 + b.p);
      const rg = g.createRadialGradient(x, y, 10, x, y, b.r);
      rg.addColorStop(0, hexA(THEME, 0.16)); rg.addColorStop(1, hexA(THEME, 0));
      g.fillStyle = rg; g.fillRect(x - b.r, y - b.r, b.r * 2, b.r * 2);
    }
    g.fillStyle = hexA(INK, 0.03);
    for (let y = 0; y < H; y += 48) for (let x = (y / 48) % 2 ? 24 : 0; x < W; x += 48) g.fillRect(x, y, 3, 3);
  }

  function topBar(t) {
    const a = prog(t, 0.1, 0.5);
    g.save(); g.globalAlpha = a;
    if (D.disclosure) {
      g.font = F.m(28); const w = g.measureText(D.disclosure).width + 40;
      rr(60, 96, w, 52, 26); g.fillStyle = hexA(INK, 0.75); g.fill();
      txt(D.disclosure, 60 + w / 2, 123, F.m(28), WHITE);
    }
    if (D.demo) {
      rr(640, 96, 300, 52, 26); g.fillStyle = hexA(BAD, 0.9); g.fill();
      txt("ตัวอย่าง · ข้อมูลสมมติ", 790, 123, F.m(26), WHITE);
    }
    g.restore();
  }

  // product card position by phase
  function cardState(t) {
    const enter = ease.outBack(prog(t, 0.15, 0.9), 1.4);
    const feat = clamp(prog(t, T0("f1") - 0.3, T0("f1") + 0.3) * (1 - prog(t, T0("verdict") - 0.3, T0("verdict") + 0.2)));
    const small = clamp(prog(t, T0("verdict") - 0.3, T0("verdict") + 0.3));
    const ctaP = clamp(prog(t, T0("price") - 0.3, T0("price") + 0.3));
    const k = ease.inOutCubic(feat), s2 = ease.inOutCubic(small), c2 = ease.inOutCubic(ctaP);
    let w = lerp(820, 700, k), y = lerp(330, 250, k);
    w = lerp(w, 420, s2); y = lerp(y, 220, s2);
    w = lerp(w, 640, c2); y = lerp(y, 260, c2);
    const x = 540 - w / 2;
    return { x, y: y + (1 - enter) * 900, w, h: w * 1.05, a: clamp(enter * 1.5) };
  }

  function featureIndexAt(t) {
    const fs = D.features || [];
    let k = 0;
    fs.forEach((f, i) => { if (t >= T0(f.cue) - 0.3) k = i + 1; });
    return k;
  }

  function hook(t) {
    const a = prog(t, T0("hook") - 0.2, T0("hook") + 0.2) * (1 - prog(t, T0("f1") - 0.4, T0("f1")));
    if (a <= 0 || !D.hook_text) return;
    const s = ease.outBack(prog(t, T0("hook") - 0.1, T0("hook") + 0.35), 2.2);
    g.save(); g.globalAlpha = a; g.translate(540, 1330); g.rotate(-0.03); g.scale(s, s);
    const size = fit(D.hook_text, F.b, 104, 900);
    g.font = F.b(size); const w = g.measureText(D.hook_text).width + 70;
    shadowed(() => { rr(-w / 2, -size * 0.75, w, size * 1.5, 30); g.fillStyle = THEME; g.fill(); }, 30, hexA(THEME, 0.45), 14);
    txt(D.hook_text, 0, 4, F.b(size), WHITE);
    g.restore();
    // product name under the hook during intro
    const na = prog(t, T0("intro") - 0.1, T0("intro") + 0.3) * (1 - prog(t, T0("f1") - 0.4, T0("f1")));
    if (na > 0 && D.name) {
      g.save(); g.globalAlpha = na;
      txt(D.name, 540, 1450, F.m(fit(D.name, F.m, 46, 900)), INK);
      if (D.brand) txt(D.brand, 540, 1505, F.m(30), MUTED);
      g.restore();
    }
  }

  function features(t) {
    const fs = D.features || [];
    fs.forEach((f, i) => {
      const t0 = T0(f.cue), t1 = (fs[i + 1] ? T0(fs[i + 1].cue) : T0("verdict")) - 0.25;
      const a = prog(t, t0 - 0.15, t0 + 0.2) * (1 - prog(t, t1 - 0.05, t1 + 0.2));
      if (a <= 0) return;
      const slide = (1 - ease.outCubic(prog(t, t0 - 0.15, t0 + 0.35))) * 80;
      g.save(); g.globalAlpha = a; g.translate(0, slide);
      shadowed(() => { rr(70, 1040, 940, 360, 40); g.fillStyle = WHITE; g.fill(); }, 40);
      g.beginPath(); g.arc(160, 1130, 52, 0, 7); g.fillStyle = THEME; g.fill();
      txt(String(i + 1), 160, 1134, F.d(60), WHITE);
      const ts = fit(f.title, F.b, 58, 740);
      txt(f.title, 240, 1130, F.b(ts), INK, "left");
      g.font = F.b(ts); const tw = Math.min(g.measureText(f.title).width, 740);
      const hp = ease.outCubic(prog(t, t0 + 0.2, t0 + 0.7));
      g.fillStyle = hexA(THEME, 0.25); g.fillRect(236, 1150, tw * hp, 16);
      wrap(f.detail || "", F.m(44), 820).slice(0, 3).forEach((l, j) => txt(l, 120, 1235 + j * 58, F.m(44), MUTED, "left"));
      const srcLabel = { spec: "* ตามสเปกผู้ผลิต", shop: "* ตามข้อมูลหน้าร้าน", tested: "* จากการทดลองใช้จริง" }[f.source];
      if (srcLabel) txt(srcLabel, 980, 1370, F.m(26), MUTED, "right");
      g.restore();
    });
  }

  function verdict(t) {
    const t0 = T0("verdict"), t1 = T0("price") - 0.3;
    const a = prog(t, t0 - 0.2, t0 + 0.2) * (1 - prog(t, t1, t1 + 0.3));
    if (a <= 0) return;
    g.save(); g.globalAlpha = a;
    const col = (items, x, y0, color, mark, start) => {
      items.forEach((s, i) => {
        const ti = start + i * 0.45;
        const p = ease.outBack(prog(t, ti, ti + 0.35), 1.8);
        if (p <= 0) return;
        g.save(); g.translate(x, y0 + i * 120); g.scale(p, p);
        shadowed(() => { rr(-40, -50, 980 - 80, 100, 26); g.fillStyle = WHITE; g.fill(); }, 24);
        g.beginPath(); g.arc(20, 0, 30, 0, 7); g.fillStyle = color; g.fill();
        txt(mark, 20, 2, F.b(38), WHITE);
        const sz = fit(s, F.m, 44, 760);
        txt(s, 75, 2, F.m(sz), INK, "left");
        g.restore();
      });
    };
    const pros = D.pros || [];
    g.save(); g.globalAlpha = prog(t, t0, t0 + 0.3); txt("ข้อดี", 120, 730, F.b(56), GOOD, "left"); g.restore();
    col(pros, 120, 820, GOOD, "✓", t0 + 0.2);
    const consY = 820 + pros.length * 120 + 170;
    if (t >= MK("verdict", 1) - 0.2) {
      g.save(); g.globalAlpha = prog(t, MK("verdict", 1) - 0.2, MK("verdict", 1) + 0.1);
      txt("ข้อควรรู้", 120, consY - 90, F.b(56), BAD, "left"); g.restore();
    }
    col(D.cons || [], 120, consY, BAD, "!", MK("verdict", 1));
    g.restore();
  }

  function priceTag(t) {
    const t0 = T0("price");
    const a = prog(t, t0 - 0.1, t0 + 0.3);
    if (a <= 0) return;
    if (D.price == null) {  // no fixed price: show the shop's promo (if any) + "check price in basket"
      g.save(); g.globalAlpha = a;
      const pk = ease.outBack(prog(t, MK("price", 0) + 0.1, MK("price", 0) + 0.6), 2);
      if (D.promo && pk > 0) {
        g.save(); g.translate(540, 1150); g.rotate(-0.03); g.scale(pk, pk);
        const ps = fit(D.promo, F.b, 110, 640);
        shadowed(() => { rr(-360, -110, 720, 220, 50); g.fillStyle = THEME; g.fill(); }, 40, hexA(THEME, 0.5), 18);
        txt(D.promo, 0, 4, F.b(ps), WHITE);
        g.restore();
      }
      const p2 = prog(t, MK("price", 1) - 0.1, MK("price", 1) + 0.3);
      if (p2 > 0) { g.globalAlpha = a * p2; txt("เช็กราคาล่าสุดในตะกร้า", 540, 1320, F.b(54), INK); }
      g.globalAlpha = a;
      if (D.price_note) txt(D.price_note, 540, 1385, F.m(30), MUTED);
      g.restore();
      return;
    }
    const cur = D.currency || "฿";
    g.save(); g.globalAlpha = a;
    const y = 1040;
    if (D.price_before) {
      txt(`ปกติ ${D.price_before.toLocaleString()}${cur}`, 540, y, F.m(54), MUTED);
      g.font = F.m(54); const w = g.measureText(`ปกติ ${D.price_before.toLocaleString()}${cur}`).width;
      const sp = ease.outCubic(prog(t, MK("price", 1) - 0.3, MK("price", 1)));
      g.strokeStyle = BAD; g.lineWidth = 7; g.lineCap = "round";
      g.beginPath(); g.moveTo(540 - w / 2 - 10, y + 4); g.lineTo(540 - w / 2 - 10 + (w + 20) * sp, y - 6); g.stroke();
    }
    const pk = prog(t, MK("price", 1), MK("price", 1) + 0.7);
    if (pk > 0) {
      const shown = Math.round(lerp(D.price_before || D.price, D.price, ease.outCubic(pk)));
      const s = ease.outBack(clamp(pk * 1.6), 2);
      g.save(); g.translate(540, y + 165); g.scale(s, s);
      shadowed(() => { rr(-330, -120, 660, 240, 50); g.fillStyle = THEME; g.fill(); }, 40, hexA(THEME, 0.5), 18);
      txt(`${shown.toLocaleString()}${cur}`, 0, 6, F.d(170), WHITE);
      g.restore();
      if (D.price_before) {
        const off = Math.round((1 - D.price / D.price_before) * 100);
        const bs = ease.outBack(prog(t, MK("price", 1) + 0.5, MK("price", 1) + 0.9), 2.5);
        if (bs > 0) {
          g.save(); g.translate(880, y + 50); g.rotate(0.25 + 0.05 * Math.sin(t * 3)); g.scale(bs, bs);
          g.beginPath();
          for (let i = 0; i < 24; i++) { const r = i % 2 ? 92 : 112, an = (i / 24) * Math.PI * 2; g.lineTo(Math.cos(an) * r, Math.sin(an) * r); }
          g.closePath(); g.fillStyle = "#ffd23f"; g.fill();
          txt(`-${off}%`, 0, 4, F.d(60), INK);
          g.restore();
        }
      }
    }
    if (D.price_note) txt(D.price_note, 540, y + 315, F.m(30), MUTED);
    g.restore();
  }

  function cta(t) {
    const t0 = T0("cta");
    const a = prog(t, t0 - 0.2, t0 + 0.2);
    if (a <= 0) return;
    g.save(); g.globalAlpha = a;
    const bob = Math.sin(t * 7) * 10;
    // button
    const s = 1 + 0.04 * Math.sin(t * 6);
    g.save(); g.translate(540, 1480); g.scale(s, s);
    shadowed(() => { rr(-380, -80, 760, 160, 80); g.fillStyle = "#ffcf33"; g.fill(); }, 30, "rgba(200,140,0,0.4)", 12);
    // cart icon
    g.save(); g.translate(-270, 0); g.strokeStyle = INK; g.lineWidth = 9; g.lineCap = "round"; g.lineJoin = "round";
    g.beginPath(); g.moveTo(-40, -36); g.lineTo(-24, -36); g.lineTo(-8, 22); g.lineTo(42, 22); g.lineTo(54, -16); g.lineTo(-16, -16); g.stroke();
    g.fillStyle = INK; g.beginPath(); g.arc(0, 40, 9, 0, 7); g.arc(36, 40, 9, 0, 7); g.fill();
    g.restore();
    txt(D.cta || "กดตะกร้าด้านล่าง", 40, 4, F.b(fit(D.cta || "กดตะกร้าด้านล่าง", F.b, 62, 560)), INK);
    g.restore();
    // arrow to the basket area (bottom-left)
    g.save(); g.translate(250, 1650 + bob); g.rotate(0.35);
    g.fillStyle = THEME; g.beginPath();
    g.moveTo(0, 70); g.lineTo(-50, 10); g.lineTo(-20, 10); g.lineTo(-20, -60); g.lineTo(20, -60); g.lineTo(20, 10); g.lineTo(50, 10); g.closePath(); g.fill();
    g.restore();
    const ring = (t * 1.2) % 1;
    g.strokeStyle = hexA(THEME, 1 - ring); g.lineWidth = 6; g.beginPath(); g.arc(200, 1765, 30 + ring * 70, 0, 7); g.stroke();
    if (D.credits) txt(D.credits, 540, 975, F.m(26), MUTED);
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
    if (!seg || t >= T0("cta") - 0.2) return; // CTA screen keeps the bottom clear
    if (t >= T0("intro") - 0.1 && t < T0("f1") - 0.4) return; // product name occupies this area
    const a = prog(t, seg.s, seg.s + 0.1) * (1 - prog(t, seg.e - 0.1, seg.e));
    const lines = wrap(seg.p, F.b(44), 880).slice(0, 2);
    const lh = 58, y0 = 1610 - (lines.length - 1) * lh / 2;
    g.save(); g.globalAlpha = a;
    lines.forEach((l, i) => {
      g.font = F.b(44); g.lineWidth = 10; g.strokeStyle = INK; g.lineJoin = "round";
      g.textAlign = "center"; g.textBaseline = "middle";
      g.strokeText(l, 540, y0 + i * lh); g.fillStyle = WHITE; g.fillText(l, 540, y0 + i * lh);
    });
    g.restore();
  }

  function draw(t) {
    g.setTransform(1, 0, 0, 1, 0, 0); g.globalAlpha = 1;
    background(t);
    const cs = cardState(t);
    const k = featureIndexAt(t);
    const prevK = Math.max(0, k - 1);
    const sw = (D.features || [])[k - 1];
    const fade = sw ? prog(t, T0(sw.cue) - 0.3, T0(sw.cue) + 0.1) : 1;
    if (fade < 1) productImage(prevK, cs.x, cs.y, cs.w, cs.h, t, cs.a);
    productImage(k, cs.x, cs.y, cs.w, cs.h, t, cs.a * fade);
    hook(t);
    features(t);
    verdict(t);
    priceTag(t);
    cta(t);
    topBar(t);
    captions(t);
    const fin = Math.max(prog(t, TL.duration - 0.6, TL.duration - 0.05), 1 - prog(t, 0, 0.2));
    if (fin > 0) { g.fillStyle = `rgba(255,247,242,${fin})`; g.fillRect(0, 0, W, H); }
  }

  function events() {
    const pops = [];
    (D.features || []).forEach((f) => pops.push(T0(f.cue)));
    if (has("price")) pops.push(MK("price", 1) + 0.5);
    return { pen: [], pops, pans: [], whoosh: [0.2, T0("f1") - 0.3, T0("verdict") - 0.3, T0("price") - 0.3], cta: T0("cta"),
      price: has("price") ? MK("price", 1) : null };
  }
  window.scene = { setup, preload, draw, events };
})();
