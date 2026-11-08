// Frame-accurate renderer: drives a project's scene.js inside headless Chromium,
// captures every frame from the canvas and pipes it into ffmpeg with the mix.
//
//   node render.mjs <projectDir> [--stills] [--frames=a-b]
import { createRequire } from "node:module";
import { spawn } from "node:child_process";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const require = createRequire(import.meta.url);
const { chromium } = require("playwright");
const ENGINE = path.dirname(fileURLToPath(import.meta.url));
const project = path.resolve(process.argv[2]);
const out = path.join(project, "out");
const args = process.argv.slice(3);
const tl = JSON.parse(readFileSync(path.join(out, "timeline.json"), "utf8"));
// Inline project images as data URLs (file:// images would taint the canvas).
const MIME = { ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".png": "image/png", ".webp": "image/webp" };
if (tl.data && Array.isArray(tl.data.images)) {
  tl.data.images = tl.data.images.map((entry) => {
    const src = typeof entry === "string" ? entry : entry.src;
    const file = path.join(project, src);
    const mime = MIME[path.extname(file).toLowerCase()] || "image/png";
    const url = `data:${mime};base64,` + readFileSync(file).toString("base64");
    return typeof entry === "string" ? url : { ...entry, src: url };
  });
}
if (tl.data && tl.data.images && !Array.isArray(tl.data.images)) {  // {key: path} map (photo-story)
  for (const [k, src] of Object.entries(tl.data.images)) {
    const file = path.join(project, src);
    const mime = MIME[path.extname(file).toLowerCase()] || "image/png";
    tl.data.images[k] = `data:${mime};base64,` + readFileSync(file).toString("base64");
  }
}
const styleArg = args.find((a) => a.startsWith("--style="));
if (styleArg) { tl.data = tl.data || {}; tl.data.style = styleArg.slice(8); }   // try a visual style without editing data.json
const stills = args.includes("--stills");
const range = (args.find((a) => a.startsWith("--frames=")) || "").slice(9);

const html = `<!doctype html><html><head><meta charset="utf-8">
<style>
@font-face{font-family:"Chakra Petch";font-weight:700;src:url(../../../assets/fonts/ChakraPetch-Bold.ttf)}
@font-face{font-family:"Chakra Petch";font-weight:600;src:url(../../../assets/fonts/ChakraPetch-SemiBold.ttf)}
@font-face{font-family:"IBM Plex Sans Thai";font-weight:600;src:url(../../../assets/fonts/IBMPlexSansThai-SemiBold.ttf)}
@font-face{font-family:"IBM Plex Sans Thai";font-weight:700;src:url(../../../assets/fonts/IBMPlexSansThai-Bold.ttf)}
@font-face{font-family:"IBM Plex Mono";font-weight:500;src:url(../../../assets/fonts/IBMPlexMono-Medium.ttf)}
@font-face{font-family:"Sriracha";font-weight:400;src:url(../../../assets/fonts/Sriracha-Regular.ttf)}
@font-face{font-family:"Mali";font-weight:600;src:url(../../../assets/fonts/Mali-SemiBold.ttf)}
@font-face{font-family:"Mali";font-weight:700;src:url(../../../assets/fonts/Mali-Bold.ttf)}
html,body{margin:0;background:${args.some((x) => x.startsWith("--overlay")) ? "transparent" : "#000"}}</style></head><body>
<canvas id="c" width="${tl.width}" height="${tl.height}"></canvas>
<script src="../../../engine/lib.js"></script>
<script src="../../../engine/sketch.js"></script>
<script src="../scene.js"></script></body></html>`;
const pagePath = path.join(out, "_render.html");
writeFileSync(pagePath, html);

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: tl.width, height: tl.height } });
page.on("pageerror", (e) => { console.error("scene error:", e.message); process.exit(1); });
await page.goto(pathToFileURL(pagePath).href);
await page.evaluate(async (tl) => {
  await Promise.all([
    '700 10px "Chakra Petch"', '600 10px "Chakra Petch"', '600 10px "IBM Plex Sans Thai"',
    '700 10px "IBM Plex Sans Thai"', '500 10px "IBM Plex Mono"', '400 10px "Sriracha"',
    '600 10px "Mali"', '700 10px "Mali"',
  ].map((f) => document.fonts.load(f, "ABCกขค")));
  window.TL = tl;
  window.scene.setup(document.getElementById("c"), tl);
  if (window.scene.preload) await window.scene.preload();  // e.g. product photos
}, tl);

if (args.includes("--events")) {
  const ev = await page.evaluate(() => (window.scene.events ? window.scene.events() : {}));
  writeFileSync(path.join(out, "events.json"), JSON.stringify(ev));
  await browser.close();
  process.exit(0);
}

// Overlay mode: transparent PNG frames composited on top of real footage (out/base.mp4),
// voice/music mix + the footage's own sound (out/footage.wav).
const overlayArg = args.find((a) => a.startsWith("--overlay"));
if (overlayArg) {
  const base = path.join(out, "base.mp4"), fa = path.join(out, "footage.wav");
  const vol = (args.find((a) => a.startsWith("--footage-vol=")) || "--footage-vol=0.35").slice(14);
  const mp4o = path.join(out, "video.mp4");
  const ffo = spawn("ffmpeg", [
    "-v", "error", "-y", "-i", base, "-f", "image2pipe", "-framerate", String(tl.fps), "-c:v", "png", "-i", "-",
    "-i", path.join(out, "mix.wav"), "-i", fa,
    "-filter_complex", `[0:v][1:v]overlay=0:0:format=auto,format=yuv420p[v];[3:a]volume=${vol}[fa];[2:a][fa]amix=inputs=2:normalize=0,alimiter=limit=0.9[a]`,
    "-map", "[v]", "-map", "[a]", "-c:v", "libx264", "-preset", "slow", "-crf", "17", "-profile:v", "high",
    "-c:a", "aac", "-b:a", "192k", "-t", String(tl.duration), "-movflags", "+faststart", mp4o,
  ], { stdio: ["pipe", "inherit", "inherit"] });
  for (let i = 0; i < tl.frames; i++) {
    const png = await page.evaluate((i) => {
      window.scene.draw(i / window.TL.fps, i);
      return document.getElementById("c").toDataURL("image/png").slice(22);
    }, i);
    if (!ffo.stdin.write(Buffer.from(png, "base64"))) await new Promise((r) => ffo.stdin.once("drain", r));
    if (i % 90 === 0) process.stdout.write(`\r[studio] overlay frame ${i}/${tl.frames}`);
  }
  ffo.stdin.end(); await new Promise((r) => ffo.on("close", r)); await browser.close();
  console.log(`\n[studio] wrote ${mp4o}`); process.exit(0);
}

const frameAt = (i) => page.evaluate((i) => {
  window.scene.draw(i / window.TL.fps, i);
  return document.getElementById("c").toDataURL("image/jpeg", 0.95).slice(23);
}, i);

const stillArg = args.find((a) => a.startsWith("--still="));
if (stillArg) {   // one PNG frame: --still=<frame> [--style=x] -> out/still_<style>_<frame>.png
  const f = Number(stillArg.slice(8));
  // fast-forward so time-based reveals are complete at that frame
  const png = await page.evaluate((i) => { window.scene.draw(i / window.TL.fps, i); return document.getElementById("c").toDataURL("image/png").slice(22); }, f);
  const outp = path.join(out, `still_${(tl.data && tl.data.style) || "ink"}_${f}.png`);
  writeFileSync(outp, Buffer.from(png, "base64")); await browser.close(); console.log(outp); process.exit(0);
}
if (stills) {
  // contact sheet frames for review: one every 1.5 s
  mkdirSync(path.join(out, "stills"), { recursive: true });
  const step = Math.round(tl.fps * 1.5);
  for (let i = 0; i < tl.frames; i += step) {
    writeFileSync(path.join(out, "stills", `f${String(i).padStart(4, "0")}.jpg`),
      Buffer.from(await frameAt(i), "base64"));
  }
  await browser.close();
  console.log("[studio] stills written");
  process.exit(0);
}

let [a, b] = range ? range.split("-").map(Number) : [0, tl.frames - 1];
const mp4 = path.join(out, range ? `preview_${a}-${b}.mp4` : "video.mp4");
const ff = spawn("ffmpeg", [
  "-v", "error", "-y", "-f", "image2pipe", "-framerate", String(tl.fps), "-c:v", "mjpeg", "-i", "-",
  "-ss", String(a / tl.fps), "-i", path.join(out, "mix.wav"),
  "-map", "0:v", "-map", "1:a", "-c:v", "libx264", "-preset", "slow", "-crf", "17",
  "-pix_fmt", "yuv420p", "-profile:v", "high", "-c:a", "aac", "-b:a", "192k",
  "-shortest", "-movflags", "+faststart", mp4,
], { stdio: ["pipe", "inherit", "inherit"] });

const t0 = Date.now();
for (let i = a; i <= b; i++) {
  const buf = Buffer.from(await frameAt(i), "base64");
  if (!ff.stdin.write(buf)) await new Promise((r) => ff.stdin.once("drain", r));
  if (i % 60 === 0) process.stdout.write(`\r[studio] frame ${i}/${b}  ${((Date.now() - t0) / 1000).toFixed(0)}s`);
}
ff.stdin.end();
await new Promise((r) => ff.on("close", r));
await browser.close();
console.log(`\n[studio] wrote ${mp4}`);
