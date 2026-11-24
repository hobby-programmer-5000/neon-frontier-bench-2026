import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const DIST = path.join(ROOT, "dist");

function copyRecursive(src, dst) {
  const st = fs.statSync(src);
  if (st.isDirectory()) {
    fs.mkdirSync(dst, { recursive: true });
    for (const ent of fs.readdirSync(src)) {
      copyRecursive(path.join(src, ent), path.join(dst, ent));
    }
  } else {
    fs.mkdirSync(path.dirname(dst), { recursive: true });
    fs.copyFileSync(src, dst);
  }
}

console.log("Building static GitHub Pages bundle ->", DIST);
fs.rmSync(DIST, { recursive: true, force: true });
fs.mkdirSync(DIST, { recursive: true });

// 1. Copy root exhibition portal & assets
for (const rel of ["index.html", "portal.css", "portal.js", "works", "results", "docs", "media"]) {
  const src = path.join(ROOT, rel);
  if (fs.existsSync(src)) {
    copyRecursive(src, path.join(DIST, rel));
  }
}

// 2. Vendor minimal Three.js ES module runtime into dist/vendor/three/ (zero external CDNs!)
const threeSrc = path.join(ROOT, "node_modules", "three");
const threeDst = path.join(DIST, "vendor", "three");
for (const sub of ["build/three.module.js", "build/three.core.js", "examples/jsm"]) {
  const s = path.join(threeSrc, sub);
  if (fs.existsSync(s)) {
    copyRecursive(s, path.join(threeDst, sub));
  }
}

// 3. Rewrite /node_modules/three/... importmaps strictly inside dist/works/*/index.html to relative ../../vendor/three/...
const distWorks = path.join(DIST, "works");
let rewritten = 0;
for (const dir of fs.readdirSync(distWorks)) {
  const htmlPath = path.join(distWorks, dir, "index.html");
  if (!fs.existsSync(htmlPath)) continue;
  let html = fs.readFileSync(htmlPath, "utf8");
  if (html.includes("/node_modules/three/")) {
    html = html.replaceAll("/node_modules/three/", "../../vendor/three/");
    fs.writeFileSync(htmlPath, html, "utf8");
    rewritten++;
  }
}

// 4. Add .nojekyll so GitHub Pages serves static files directly without Jekyll filtering
fs.writeFileSync(path.join(DIST, ".nojekyll"), "", "utf8");

console.log(`Static Pages build complete: rewrote ${rewritten} Three.js importmaps to relative ../../vendor/three/.`);
