import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { chromium } from "playwright-core";

const ROOT = path.resolve("C:/Users/ckstn/.gemini/antigravity/scratch/neon-frontier-bench-2026");
const CHROME_EXE = "C:/Program Files/Google/Chrome/Application/chrome.exe";

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
      const urlPath = decodeURIComponent((req.url || "/").split("?")[0]);
      let filePath = path.join(ROOT, urlPath === "/" ? "index.html" : urlPath);
      if (fs.existsSync(filePath) && fs.statSync(filePath).isDirectory()) {
        filePath = path.join(filePath, "index.html");
      }
      if (!fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) {
        res.writeHead(404);
        res.end("Not Found: " + urlPath);
        return;
      }
      const ext = path.extname(filePath).toLowerCase();
      res.writeHead(200, { "Content-Type": MIME[ext] || "application/octet-stream" });
      fs.createReadStream(filePath).pipe(res);
    });
    server.listen(0, "127.0.0.1", () => {
      const addr = server.address();
      resolve({ server, port: addr.port });
    });
  });
}

function countDirCode(dir) {
  let files = 0, lines = 0, bytes = 0;
  if (!fs.existsSync(dir)) return { files, lines, bytes };
  const walk = (d) => {
    for (const ent of fs.readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, ent.name);
      if (ent.isDirectory()) walk(p);
      else if (/\.(html|js|mjs|css|glsl|wgsl|json)$/i.test(ent.name)) {
        const txt = fs.readFileSync(p, "utf8");
        files++;
        bytes += Buffer.byteLength(txt, "utf8");
        lines += txt.split("\n").length;
      }
    }
  };
  walk(dir);
  return { files, lines, bytes };
}

async function samplePerformance(page, sampleFrames = 90) {
  return await page.evaluate(async (n) => {
    const deltas = [];
    let prev = performance.now();
    await new Promise((resolve) => {
      let count = 0;
      function step(now) {
        deltas.push(now - prev);
        prev = now;
        count++;
        if (count >= n) resolve();
        else requestAnimationFrame(step);
      }
      requestAnimationFrame(step);
    });
    const sorted = [...deltas].sort((a, b) => a - b);
    const medianDt = sorted[Math.floor(sorted.length * 0.5)] || 16.67;
    const p90Dt = sorted[Math.floor(sorted.length * 0.9)] || 16.67;
    const maxDt = sorted[sorted.length - 1] || 16.67;
    const fpsMedian = Math.min(240, 1000 / Math.max(1, medianDt));
    const fpsP10 = Math.min(240, 1000 / Math.max(1, p90Dt));
    const mem = performance.memory ? performance.memory.usedJSHeapSize / (1024 * 1024) : null;
    return {
      fpsMedian: Number(fpsMedian.toFixed(1)),
      fpsP10: Number(fpsP10.toFixed(1)),
      frameTimeMedianMs: Number(medianDt.toFixed(2)),
      frameTimeMaxMs: Number(maxDt.toFixed(2)),
      jsHeapMB: mem !== null ? Number(mem.toFixed(1)) : null,
    };
  }, sampleFrames);
}

async function checkHudOverlaps(page) {
  return await page.evaluate(() => {
    const els = Array.from(document.querySelectorAll("button, input, select, [data-hud-card]")).filter((el) => {
      const st = getComputedStyle(el);
      if (st.display === "none" || st.visibility === "hidden" || parseFloat(st.opacity) < 0.05) return false;
      const r = el.getBoundingClientRect();
      return r.width > 4 && r.height > 4;
    });
    let overlaps = 0;
    const pairs = [];
    for (let i = 0; i < els.length; i++) {
      const a = els[i].getBoundingClientRect();
      for (let j = i + 1; j < els.length; j++) {
        if (els[i].contains(els[j]) || els[j].contains(els[i])) continue;
        const b = els[j].getBoundingClientRect();
        const ox = Math.min(a.right, b.right) - Math.max(a.left, b.left);
        const oy = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top);
        if (ox > 4 && oy > 4) {
          overlaps++;
          if (pairs.length < 5) pairs.push(`${els[i].tagName}.${els[i].className} x ${els[j].tagName}.${els[j].className}`);
        }
      }
    }
    const overflowX = document.documentElement.scrollWidth > window.innerWidth + 2;
    return { overlaps, overflowX, samplePairs: pairs };
  });
}

async function auditTrack(browser, baseUrl, trackId, shotsDir) {
  const trackShots = path.join(shotsDir, trackId);
  fs.mkdirSync(trackShots, { recursive: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
  const page = await context.newPage();

  const consoleErrors = [];
  const consoleWarnings = [];
  const pageErrors = [];
  const httpErrors = [];

  page.on("console", (msg) => {
    if (msg.type() === "error") consoleErrors.push(msg.text());
    else if (msg.type() === "warning") consoleWarnings.push(msg.text());
  });
  page.on("pageerror", (err) => pageErrors.push(String(err)));
  page.on("response", (resp) => {
    if (resp.status() >= 400) httpErrors.push(`${resp.status()} ${resp.url()}`);
  });

  const url = `${baseUrl}/works/${trackId}/index.html`;
  const tNav = Date.now();
  try {
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 45000 });
  } catch (e) {
    pageErrors.push("NAV_TIMEOUT: " + String(e.message || e));
  }

  // Wait for __BENCH_META__.ready === true (up to 25s)
  let readyOk = false;
  try {
    await page.waitForFunction(() => window.__BENCH_META__ && window.__BENCH_META__.ready === true, { timeout: 25000 });
    readyOk = true;
  } catch {
    readyOk = false;
  }
  const navReadyMs = Date.now() - tNav;
  await page.waitForTimeout(800);

  const perf = await samplePerformance(page, 75);
  const meta = await page.evaluate(() => window.__BENCH_META__ || {});
  const hudDesktop = await checkHudOverlaps(page);

  // Capture 1: Hero view (1440x900)
  const heroPng = path.join(trackShots, "hero_1440x900.png");
  await page.screenshot({ path: heroPng, type: "png" });

  // Capture 2: Macro view
  const macroPng = path.join(trackShots, "macro_1440x900.png");
  await page.evaluate(() => window.__BENCH_ACTIONS__?.setView?.("macro"));
  await page.waitForTimeout(600);
  await page.screenshot({ path: macroPng, type: "png" });

  // Capture 3: Alt mode (e.g., Exploded / Wireframe / Formula Relight / Follow Cam) + Interactive action
  const altPng = path.join(trackShots, "alt_mode_1440x900.png");
  const actionResult = await page.evaluate(() => {
    window.__BENCH_ACTIONS__?.setView?.("alt_mode");
    return window.__BENCH_ACTIONS__?.triggerAction?.("demo") || "triggered";
  });
  await page.waitForTimeout(900);
  await page.screenshot({ path: altPng, type: "png" });

  // Capture 4: Narrow-pane HUD check (700x900)
  await page.evaluate(() => window.__BENCH_ACTIONS__?.setView?.("hero"));
  await page.setViewportSize({ width: 700, height: 900 });
  await page.waitForTimeout(600);
  const hudNarrow = await checkHudOverlaps(page);
  const narrowPng = path.join(trackShots, "narrow_700x900.png");
  await page.screenshot({ path: narrowPng, type: "png" });

  const metaAfter = await page.evaluate(() => window.__BENCH_META__ || {});
  const codeStats = countDirCode(path.join(ROOT, "works", trackId));

  await context.close();
  const pass =
    readyOk &&
    consoleErrors.length === 0 &&
    pageErrors.length === 0 &&
    httpErrors.length === 0 &&
    perf.fpsMedian >= 25;

  return {
    trackId,
    pass,
    readyOk,
    navReadyMs,
    meta: metaAfter,
    perf,
    hudDesktop,
    hudNarrow,
    actionResult: String(actionResult),
    codeStats,
    consoleErrors,
    consoleWarnings,
    pageErrors,
    httpErrors,
    screenshots: {
      hero: heroPng,
      macro: macroPng,
      alt_mode: altPng,
      narrow: narrowPng,
    },
  };
}

async function auditEffortSweep(browser, baseUrl) {
  const sweepDir = path.join(ROOT, "results", "effort_sweep");
  if (!fs.existsSync(sweepDir)) return [];
  const htmlFiles = fs.readdirSync(sweepDir).filter((f) => f.endsWith(".html")).sort();
  const out = [];
  for (const f of htmlFiles) {
    const cid = f.replace(/\.html$/, "");
    const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
    const page = await context.newPage();
    const errs = [], warns = [], pErrs = [];
    page.on("console", (m) => {
      if (m.type() === "error") errs.push(m.text());
      else if (m.type() === "warning") warns.push(m.text());
    });
    page.on("pageerror", (e) => pErrs.push(String(e)));

    await page.goto(`${baseUrl}/results/effort_sweep/${f}`, { waitUntil: "domcontentloaded", timeout: 20000 });
    await page.waitForTimeout(1000);
    const perf = await samplePerformance(page, 60);
    const meta = await page.evaluate(() => window.__SWEEP_META__ || null);
    const hud = await checkHudOverlaps(page);
    const png = path.join(sweepDir, `${cid}.png`);
    await page.screenshot({ path: png, type: "png" });
    await context.close();
    out.push({
      cell_id: cid,
      consoleErrors: errs,
      consoleWarnings: warns,
      pageErrors: pErrs,
      meta,
      perf,
      hud,
      screenshot: png,
      runtime_pass: errs.length === 0 && pErrs.length === 0,
    });
  }
  return out;
}

async function main() {
  const mode = process.argv[2] || "works"; // "works" | "sweep" | "both"
  const round = process.argv[3] || "1";
  const targetTrack = process.argv[4] || null;

  const { server, port } = await startServer();
  const baseUrl = `http://127.0.0.1:${port}`;
  const browser = await chromium.launch({
    executablePath: CHROME_EXE,
    headless: true,
    args: ["--no-sandbox", "--enable-webgl", "--ignore-gpu-blocklist"],
  });

  try {
    if (mode === "sweep" || mode === "both") {
      const sweepRes = await auditEffortSweep(browser, baseUrl);
      const p = path.join(ROOT, "results", "effort_sweep", "effort_sweep_qa.json");
      fs.writeFileSync(p, JSON.stringify(sweepRes, null, 2));
      console.log(`Sweep QA complete (${sweepRes.length} cells) -> ${p}`);
      for (const r of sweepRes) {
        console.log(
          `  [SWEEP] ${r.cell_id.padEnd(14)} | pass=${r.runtime_pass} | fps=${r.perf.fpsMedian} | errs=${r.consoleErrors.length + r.pageErrors.length} | overlaps=${r.hud.overlaps}`
        );
      }
    }

    if (mode === "works" || mode === "both") {
      const worksDir = path.join(ROOT, "works");
      let tracks = fs.readdirSync(worksDir).filter((d) => fs.existsSync(path.join(worksDir, d, "index.html"))).sort();
      if (targetTrack) tracks = tracks.filter((t) => t === targetTrack);
      const shotsDir = path.join(ROOT, "results", `screenshots_r${round}`);
      fs.mkdirSync(shotsDir, { recursive: true });
      const results = [];
      for (const t of tracks) {
        const res = await auditTrack(browser, baseUrl, t, shotsDir);
        results.push(res);
        console.log(
          `  [QA R${round}] ${t.padEnd(24)} | pass=${res.pass} | ready=${res.readyOk} (${res.navReadyMs}ms) | ` +
          `FPS=${res.perf.fpsMedian} (p10=${res.perf.fpsP10}) | errs=${res.consoleErrors.length + res.pageErrors.length + res.httpErrors.length} | ` +
          `warns=${res.consoleWarnings.length} | hud700_overlaps=${res.hudNarrow.overlaps} | LOC=${res.codeStats.lines}`
        );
      }
      const outJson = path.join(ROOT, "results", `qa_round${round}.json`);
      fs.writeFileSync(outJson, JSON.stringify(results, null, 2));
      console.log(`Works QA R${round} complete -> ${outJson}`);
    }
  } finally {
    await browser.close();
    server.close();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
