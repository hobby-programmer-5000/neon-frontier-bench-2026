import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { chromium } from "playwright-core";

const ROOT = path.resolve("C:/Users/ckstn/.gemini/antigravity/scratch/neon-frontier-bench-2026");
const TMP_DIR = path.join(ROOT, "tmp_video");
const CHROME_EXE = "C:/Program Files/Google/Chrome/Application/chrome.exe";

fs.mkdirSync(TMP_DIR, { recursive: true });

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".mjs": "application/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".wasm": "application/wasm",
};

function startServer() {
  return new Promise((resolve) => {
    const server = http.createServer((req, res) => {
      const u = decodeURIComponent((req.url || "/").split("?")[0]);
      let p = path.join(ROOT, u === "/" ? "index.html" : u);
      if (fs.existsSync(p) && fs.statSync(p).isDirectory()) p = path.join(p, "index.html");
      if (!fs.existsSync(p) || !fs.statSync(p).isFile()) {
        res.writeHead(404);
        res.end("404");
        return;
      }
      res.writeHead(200, { "Content-Type": MIME[path.extname(p).toLowerCase()] || "application/octet-stream" });
      fs.createReadStream(p).pipe(res);
    });
    server.listen(0, "127.0.0.1", () => resolve({ server, port: server.address().port }));
  });
}

async function recordClip(browser, baseUrl, cfg) {
  const { name, trackId, width, height, choreography } = cfg;
  const clipDir = path.join(TMP_DIR, name);
  fs.mkdirSync(clipDir, { recursive: true });

  const ctx = await browser.newContext({
    viewport: { width, height },
    deviceScaleFactor: 1,
    recordVideo: { dir: clipDir, size: { width, height } },
  });
  const page = await ctx.newPage();
  const url = `${baseUrl}/works/${trackId}/index.html`;
  await page.goto(url, { waitUntil: "domcontentloaded", timeout: 45000 });
  await page.waitForFunction(() => window.__BENCH_META__ && window.__BENCH_META__.ready === true, { timeout: 30000 });

  // Mark start of clean ready footage so ffmpeg trims boot frames accurately
  const tStart = Date.now();
  await page.waitForTimeout(300);

  for (const step of choreography) {
    if (step.view) {
      await page.evaluate((v) => window.__BENCH_ACTIONS__?.setView?.(v), step.view);
    }
    if (step.action) {
      await page.evaluate((a) => window.__BENCH_ACTIONS__?.triggerAction?.(a), step.action);
    }
    if (step.evalFn) {
      await page.evaluate(step.evalFn);
    }
    await page.waitForTimeout(step.ms);
  }

  const video = page.video();
  await ctx.close();
  const rawPath = await video.path();
  const destPath = path.join(TMP_DIR, `${name}.webm`);
  fs.copyFileSync(rawPath, destPath);
  const totalElapsedMs = Date.now() - tStart;
  console.log(`[CLIP] ${name.padEnd(20)} | ${width}x${height} | ready-footage=${(totalElapsedMs / 1000).toFixed(2)}s -> ${destPath}`);
  return { name, destPath, readyDurationSec: Number((totalElapsedMs / 1000).toFixed(2)) };
}

async function main() {
  const { server, port } = await startServer();
  const baseUrl = `http://127.0.0.1:${port}`;
  const browser = await chromium.launch({
    executablePath: CHROME_EXE,
    headless: true,
    args: ["--no-sandbox", "--enable-webgl", "--ignore-gpu-blocklist"],
  });

  const clips = [
    // Showdown pair: recorded at crisp 960x940 so left+right fit EXACTLY into 1920x940 between top/bottom 70px bars!
    {
      name: "showdown_neon",
      trackId: "track-1a-watch-neon",
      width: 960,
      height: 940,
      choreography: [
        { view: "hero", ms: 4600 },
        { view: "macro", ms: 4400 },
        { view: "alt_mode", action: "demo", ms: 5200 },
      ],
    },
    {
      name: "showdown_opus",
      trackId: "track-1b-watch-opus",
      width: 960,
      height: 940,
      choreography: [
        { view: "hero", ms: 4600 },
        { view: "macro", ms: 4400 },
        { view: "alt_mode", action: "demo", ms: 5200 },
      ],
    },
    // Sequential full-frame showcase (1920x980 leaving 100px bottom studio banner inside 1920x1080!)
    {
      name: "seq_turing",
      trackId: "track-2-turing-study",
      width: 1440,
      height: 810,
      choreography: [
        { view: "hero", ms: 2600 },
        { view: "macro", ms: 2800 },
        { view: "alt_mode", action: "demo", ms: 3200 },
      ],
    },
    {
      name: "seq_turbofan",
      trackId: "track-3-turbofan-cad",
      width: 1440,
      height: 810,
      choreography: [
        { view: "hero", ms: 3000 },
        { view: "macro", ms: 2400 },
        { view: "alt_mode", action: "demo", ms: 3400 },
      ],
    },
    {
      name: "seq_chroma",
      trackId: "track-4-chroma-forge",
      width: 1440,
      height: 810,
      choreography: [
        { view: "hero", ms: 3000 },
        { view: "macro", ms: 2200 },
        { view: "alt_mode", action: "demo", ms: 3600 },
      ],
    },
    {
      name: "seq_kinetic",
      trackId: "track-5-kinetic-cloth",
      width: 1440,
      height: 810,
      choreography: [
        { view: "hero", ms: 2800 },
        { view: "macro", ms: 1800 },
        { view: "alt_mode", action: "demo", ms: 4400 },
      ],
    },
  ];

  const manifest = [];
  try {
    for (const c of clips) {
      manifest.push(await recordClip(browser, baseUrl, c));
    }
    fs.writeFileSync(path.join(TMP_DIR, "clips_manifest.json"), JSON.stringify(manifest, null, 2));
    console.log("ALL 6 LIVE CLIPS RECORDED SUCCESSFULLY.");
  } finally {
    await browser.close();
    server.close();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
