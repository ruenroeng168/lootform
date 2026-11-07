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
html,body{margin:0;background:#000}</style></head><body>
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
}, tl);

if (args.includes("--events")) {
  const ev = await page.evaluate(() => (window.scene.events ? window.scene.events() : {}));
  writeFileSync(path.join(out, "events.json"), JSON.stringify(ev));
  await browser.close();
  process.exit(0);
}

const frameAt = (i) => page.evaluate((i) => {
  window.scene.draw(i / window.TL.fps, i);
  return document.getElementById("c").toDataURL("image/jpeg", 0.95).slice(23);
}, i);

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
