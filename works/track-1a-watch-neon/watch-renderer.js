/**
 * Chronos Calibre N-4 — Procedural SVG Movement & 6-Layer Exploded CAD Renderer
 * Renders an exhibition-grade Swiss open-worked skeleton tourbillon movement with
 * true Litvin & Fuentes involute gear teeth, Côtes de Genève bridges, circular Perlage
 * mainplate, gold chatons, pigeon-blood ruby bearings, thermally blued slotted screws,
 * breathing spiral hairspring, coiling mainspring, and live 6-layer isometric CAD explode.
 */

import {
  CALIBRE,
  DEG,
  RAD,
  generateInvoluteGear,
  generateSwissEscapeWheel,
  generatePalletForkGeometry,
  generateHairspringPath,
  generateMainspringPath,
} from "./involute-math.js";

const SVG_NS = "http://www.w3.org/2000/svg";

/**
 * Computes the exact pre-isometric local (dx, dy) offset that projects strictly
 * vertically downward by `depthScreen` SVG units along the orthographic Z-axis
 * under `scale(0.86, 0.4472) rotate(-30deg)`.
 */
function zExtrudeShift(depthScreen) {
  const L = depthScreen / 0.4472;
  return `translate(${(-0.5 * L).toFixed(2)}, ${(0.866 * L).toFixed(2)})`;
}

function el(tag, attrs = {}, parent = null) {
  const node = document.createElementNS(SVG_NS, tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v !== undefined && v !== null) node.setAttribute(k, String(v));
  }
  if (parent) parent.appendChild(node);
  return node;
}

/**
 * Draws a precision thermally blued slotted steel screw with specular highlight
 * and realistic varied slot orientation.
 */
function addBluedScrew(parent, x, y, r = 4.6, slotAngleDeg = 32) {
  const g = el("g", { transform: `translate(${x.toFixed(2)}, ${y.toFixed(2)})` }, parent);
  // Countersunk chamfer recess
  el("circle", { r: (r + 1.35).toFixed(2), fill: "#121419", stroke: "rgba(235,240,248,0.28)", "stroke-width": "0.55" }, g);
  // Blued screw head
  el("circle", { r: r.toFixed(2), fill: "url(#grad-blued-steel)", stroke: "#0c1936", "stroke-width": "0.45" }, g);
  // Specular rim kiss
  el("path", {
    d: `M${(-r * 0.65).toFixed(2)} ${(-r * 0.45).toFixed(2)} A${(r * 0.8).toFixed(2)} ${(r * 0.8).toFixed(2)} 0 0 1 ${(r * 0.45).toFixed(2)} ${(-r * 0.65).toFixed(2)}`,
    fill: "none",
    stroke: "rgba(182,216,255,0.65)",
    "stroke-width": "0.65",
    "stroke-linecap": "round",
  }, g);
  // Machined screwdriver slot
  const sg = el("g", { transform: `rotate(${slotAngleDeg})` }, g);
  el("rect", {
    x: (-r * 0.88).toFixed(2),
    y: (-r * 0.17).toFixed(2),
    width: (r * 1.76).toFixed(2),
    height: (r * 0.34).toFixed(2),
    rx: "0.35",
    fill: "#070c18",
  }, sg);
  el("line", {
    x1: (-r * 0.84).toFixed(2),
    y1: (r * 0.21).toFixed(2),
    x2: (r * 0.84).toFixed(2),
    y2: (r * 0.21).toFixed(2),
    stroke: "rgba(148,195,255,0.45)",
    "stroke-width": "0.38",
  }, sg);
  return g;
}

/**
 * Draws a synthetic pigeon-blood ruby bearing seated inside a raised 18k gold chaton
 * with optional micro-fastening blued chaton screws (hallmark of Geneva haute horlogerie).
 */
function addRubyBearing(parent, x, y, rubyR = 5.4, { chaton = true, chatonScrews = false, pivot = true } = {}) {
  const g = el("g", { transform: `translate(${x.toFixed(2)}, ${y.toFixed(2)})` }, parent);
  if (chaton) {
    const cr = rubyR + 2.8;
    el("circle", { r: (cr + 1.0).toFixed(2), fill: "rgba(0,0,0,0.48)" }, g);
    el("circle", {
      r: cr.toFixed(2),
      fill: "url(#grad-gold-chaton)",
      stroke: "#543817",
      "stroke-width": "0.55",
    }, g);
    el("circle", {
      r: (rubyR + 0.9).toFixed(2),
      fill: "#20060e",
      stroke: "rgba(255,232,188,0.45)",
      "stroke-width": "0.45",
    }, g);
    if (chatonScrews) {
      for (let i = 0; i < 3; i++) {
        const a = (i * 120 - 30) * DEG;
        const sx = (cr + 1.1) * Math.cos(a);
        const sy = (cr + 1.1) * Math.sin(a);
        el("circle", { cx: sx.toFixed(2), cy: sy.toFixed(2), r: "1.45", fill: "url(#grad-blued-steel)", stroke: "#091228", "stroke-width": "0.3" }, g);
      }
    }
  }
  // Pigeon-blood ruby body
  el("circle", { r: rubyR.toFixed(2), fill: "url(#grad-ruby-jewel)" }, g);
  // Crisp curved ruby internal specular glint
  el("path", {
    d: `M${(-rubyR * 0.56).toFixed(2)} ${(-rubyR * 0.36).toFixed(2)} A${(rubyR * 0.68).toFixed(2)} ${(rubyR * 0.68).toFixed(2)} 0 0 1 ${(rubyR * 0.32).toFixed(2)} ${(-rubyR * 0.58).toFixed(2)}`,
    fill: "none",
    stroke: "rgba(255, 206, 222, 0.78)",
    "stroke-width": Math.max(0.7, rubyR * 0.22).toFixed(2),
    "stroke-linecap": "round",
  }, g);
  if (pivot) {
    // Polished steel pivot arbor tip inside oil sink
    el("circle", { r: (rubyR * 0.38).toFixed(2), fill: "url(#grad-gear-steel)", stroke: "#280510", "stroke-width": "0.45" }, g);
  }
  return g;
}

/**
 * Main Watch SVG Builder & Dynamic Frame Animator.
 */
export class ChronosWatchRenderer {
  constructor(svgPlanes, textures) {
    // Support 5-plane GPU-composited object (isolates ultra-fast 60-FPS 6 o'clock tourbillon from slow gears!)
    if (svgPlanes && svgPlanes.movement) {
      this.defsSvg = svgPlanes.defs;
      this.baseSvg = svgPlanes.base;
      this.trainSvg = svgPlanes.train || svgPlanes.movement;
      this.svg = svgPlanes.movement;
      this.bridgesSvg = svgPlanes.bridges;
      this.topSvg = svgPlanes.top;
      this.allPlanes = [this.baseSvg, this.trainSvg, this.svg, this.bridgesSvg, this.topSvg];
    } else {
      this.defsSvg = svgPlanes;
      this.baseSvg = svgPlanes;
      this.trainSvg = svgPlanes;
      this.svg = svgPlanes;
      this.bridgesSvg = svgPlanes;
      this.topSvg = svgPlanes;
      this.allPlanes = [svgPlanes];
    }

    this.textures = textures;
    // Track every layer-tagged <g> (multiple planes may hold parts of the same architectural Z-layer!)
    this.layerBindings = [];   // [{ layerIdx, node }]
    this.extrudeBindings = []; // [{ layerIdx, node }]
    this.nodes = {};
    this.totalGeometrySegments = 0;
    this.totalSvgElements = 0;
    this._lastMainspringKey = "";
    this._lastViewBoxKey = "";
    this._lastExplodeKey = "";
    this._lastRot = Object.create(null);

    this._buildDefs();
    this._buildLayers();
    this._countMetrics();
  }

  _makeLayerGroup(plane, layerIdx, suffix = "") {
    const g = el("g", { id: `watch-layer-${layerIdx}${suffix}`, "data-layer": layerIdx }, plane);
    this.layerBindings.push({ layerIdx, node: g });
    return g;
  }

  _makeExtrudeGroup(plane, layerIdx, suffix = "") {
    const g = el("g", { id: `watch-layer-${layerIdx}${suffix}-extrude`, class: "cad-extrusion", style: "display:none" }, plane);
    this.extrudeBindings.push({ layerIdx, node: g });
    return g;
  }

  _setRotIfChanged(key, node, deg, step = 0.04) {
    const q = Math.round(deg / step) * step;
    if (this._lastRot[key] === q) return;
    this._lastRot[key] = q;
    node.setAttribute("transform", `rotate(${q.toFixed(2)})`);
  }

  _buildDefs() {
    const defs = el("defs", {}, this.defsSvg);

    // 1. Procedural Horological Surface Texture Patterns
    const addImgPattern = (id, url, size, angle = 0) => {
      const p = el("pattern", {
        id,
        patternUnits: "userSpaceOnUse",
        width: size,
        height: size,
        patternTransform: angle ? `rotate(${angle})` : undefined,
      }, defs);
      el("image", { href: url, width: size, height: size, preserveAspectRatio: "none" }, p);
    };

    addImgPattern("pat-cotes-rhodium", this.textures.cotesRhodium, 160, -18);
    addImgPattern("pat-cotes-rosegold", this.textures.cotesRoseGold, 160, -18);
    addImgPattern("pat-perlage-dark", this.textures.perlageDark, 150, 0);
    addImgPattern("pat-sunray-steel", this.textures.sunraySteel, 140, 0);
    addImgPattern("pat-sunray-champagne", this.textures.sunrayChampagne, 140, 0);
    addImgPattern("pat-leather-dark", this.textures.leatherDark, 110, 0);

    // Centered radial sunray pattern helper (objectBoundingBox for wheels)
    const addObjSunray = (id, url) => {
      const p = el("pattern", {
        id,
        patternUnits: "objectBoundingBox",
        patternContentUnits: "objectBoundingBox",
        width: "1",
        height: "1",
      }, defs);
      el("image", { href: url, width: "1", height: "1", preserveAspectRatio: "none" }, p);
    };
    addObjSunray("pat-wheel-steel", this.textures.sunraySteel);
    addObjSunray("pat-wheel-champagne", this.textures.sunrayChampagne);

    // 2. Calibrated Metallic Linear & Radial Gradients
    const addLinGrad = (id, x1, y1, x2, y2, stops) => {
      const g = el("linearGradient", { id, x1, y1, x2, y2 }, defs);
      for (const [offset, color, opacity] of stops) {
        el("stop", { offset, "stop-color": color, "stop-opacity": opacity }, g);
      }
    };
    const addRadGrad = (id, cx, cy, r, fx, fy, stops) => {
      const g = el("radialGradient", { id, cx, cy, r, fx, fy }, defs);
      for (const [offset, color, opacity] of stops) {
        el("stop", { offset, "stop-color": color, "stop-opacity": opacity }, g);
      }
    };

    // 18k 5N Rose Gold Case Band
    addLinGrad("grad-case-rosegold", "12%", "8%", "88%", "92%", [
      ["0%", "#f3d4ac"],
      ["16%", "#d7a974"],
      ["34%", "#9a6c3f"],
      ["52%", "#ecc799"],
      ["72%", "#b48150"],
      ["88%", "#6d4827"],
      ["100%", "#9d7044"],
    ]);

    // Polished Titanium / Rhodium Bezel & Tourbillon Bridge
    addLinGrad("grad-bezel-rhodium", "14%", "10%", "86%", "90%", [
      ["0%", "#eceff5"],
      ["22%", "#b2b9c6"],
      ["46%", "#5a616d"],
      ["64%", "#d5dbe6"],
      ["84%", "#69717f"],
      ["100%", "#323740"],
    ]);

    // Black-Polished Rhodium Tourbillon Bridge Specular
    addLinGrad("grad-black-polish", "0%", "0%", "100%", "100%", [
      ["0%", "#e2e6ef"],
      ["28%", "#aeb5c2"],
      ["50%", "#ffffff"],
      ["68%", "#7b8290"],
      ["100%", "#c8ceda"],
    ]);

    // Warm Horological Gilded Brass Gears
    addLinGrad("grad-gear-brass", "15%", "10%", "85%", "90%", [
      ["0%", "#ecd2a0"],
      ["26%", "#caa063"],
      ["55%", "#99703c"],
      ["78%", "#d8b377"],
      ["100%", "#77552b"],
    ]);

    // Machined Polished Steel Gears & Pinions
    addLinGrad("grad-gear-steel", "12%", "12%", "88%", "88%", [
      ["0%", "#e7ecf5"],
      ["30%", "#adb5c2"],
      ["58%", "#6a7280"],
      ["82%", "#c8d0dc"],
      ["100%", "#4c525e"],
    ]);

    // 300°C Thermally Blued Steel (Screws, Mainspring, Hairspring, PR Hand)
    addLinGrad("grad-blued-steel", "15%", "10%", "85%", "90%", [
      ["0%", "#8ec2ff"],
      ["24%", "#366fd0"],
      ["55%", "#173c84"],
      ["82%", "#2558b2"],
      ["100%", "#0a1733"],
    ]);

    // Synthetic Pigeon-Blood Ruby Bearing (Al2O3:Cr)
    addRadGrad("grad-ruby-jewel", "50%", "50%", "52%", "34%", "32%", [
      ["0%", "#ff89ab"],
      ["24%", "#dc1e58"],
      ["62%", "#8e0830"],
      ["100%", "#3d0213"],
    ]);

    // 18k Gold Chaton Ring
    addLinGrad("grad-gold-chaton", "15%", "15%", "85%", "85%", [
      ["0%", "#fae3b8"],
      ["36%", "#cf9d59"],
      ["72%", "#754f22"],
      ["100%", "#e5be80"],
    ]);

    // Faceted 5N Rose Gold Hands (Light & Dark Halves)
    addLinGrad("grad-hand-light", "0%", "0%", "0%", "100%", [
      ["0%", "#fae4c5"],
      ["55%", "#dab07c"],
      ["100%", "#b4824f"],
    ]);
    addLinGrad("grad-hand-dark", "0%", "0%", "0%", "100%", [
      ["0%", "#a87948"],
      ["55%", "#775029"],
      ["100%", "#533519"],
    ]);

    // Exhibition Tourbillon Aperture Dark Well
    addRadGrad("grad-well-depth", "50%", "50%", "50%", "50%", "50%", [
      ["0%", "#07080a"],
      ["72%", "#0c0e12"],
      ["92%", "#171a21"],
      ["100%", "#2a2e38"],
    ]);

    // Leather Strap Fade Gradients (Top & Bottom)
    addLinGrad("grad-strap-fade-top", "0%", "0%", "0%", "100%", [
      ["0%", "#0d0e11", "1"],
      ["35%", "#0d0e11", "0.78"],
      ["72%", "#0d0e11", "0.18"],
      ["100%", "#0d0e11", "0"],
    ]);
    addLinGrad("grad-strap-fade-bot", "0%", "0%", "0%", "100%", [
      ["0%", "#0d0e11", "0"],
      ["28%", "#0d0e11", "0.18"],
      ["65%", "#0d0e11", "0.78"],
      ["100%", "#0d0e11", "1"],
    ]);

    // Fluted Winding Crown Metallic Gradient
    addLinGrad("grad-crown-metal", "0%", "0%", "0%", "100%", [
      ["0%", "#674627"],
      ["16%", "#d7ab76"],
      ["36%", "#f6ddc0"],
      ["56%", "#b58453"],
      ["80%", "#704c2a"],
      ["100%", "#442c17"],
    ]);

    // Chapter Ring Satin Flange Gradient
    addRadGrad("grad-chapter-ring", "50%", "50%", "50%", "42%", "38%", [
      ["85%", "#1b1d23"],
      ["93%", "#23262e"],
      ["98%", "#17191f"],
      ["100%", "#2d313a"],
    ]);

    // 3D Exploded CAD Extruded Side-Wall Metallic Gradients (cylindrical wrap lighting)
    addLinGrad("grad-extrude-rosegold", "0%", "0%", "100%", "0%", [
      ["0%", "#452b15"],
      ["18%", "#8f6239"],
      ["38%", "#e2ba88"],
      ["56%", "#b88755"],
      ["78%", "#634020"],
      ["100%", "#321e0e"],
    ]);
    addLinGrad("grad-extrude-rhodium", "0%", "0%", "100%", "0%", [
      ["0%", "#282c34"],
      ["22%", "#6b7382"],
      ["44%", "#c7cedb"],
      ["66%", "#626977"],
      ["88%", "#2d323c"],
      ["100%", "#1b1e25"],
    ]);
    addLinGrad("grad-extrude-anthracite", "0%", "0%", "100%", "0%", [
      ["0%", "#121419"],
      ["25%", "#363b47"],
      ["48%", "#596070"],
      ["74%", "#262a33"],
      ["100%", "#101217"],
    ]);
    addLinGrad("grad-extrude-brass", "0%", "0%", "100%", "0%", [
      ["0%", "#4c3518"],
      ["25%", "#9e743c"],
      ["48%", "#dfb97c"],
      ["75%", "#7e592b"],
      ["100%", "#3d2a13"],
    ]);
    addRadGrad("grad-sapphire-dome-cad", "44%", "36%", "58%", "38%", "30%", [
      ["0%", "rgba(230, 240, 255, 0.20)"],
      ["55%", "rgba(182, 206, 238, 0.06)"],
      ["88%", "rgba(162, 192, 234, 0.14)"],
      ["100%", "rgba(235, 242, 255, 0.28)"],
    ]);

    // Clip path for open-worked mainspring barrel interior
    const barrelClip = el("clipPath", { id: "clip-barrel-interior" }, defs);
    el("circle", { cx: "0", cy: "0", r: "63" }, barrelClip);

    // Clip path for crown fluting animation
    const crownClip = el("clipPath", { id: "clip-crown-flutes" }, defs);
    el("rect", { x: "252", y: "-26", width: "26", height: "52", rx: "5" }, crownClip);
  }

  _buildLayers() {
    // Plane 1 (Static GPU-cached Base): L0 Mainplate + Straps, L1 Static Extrusions & Fixed 4th Wheel
    const ext0 = this._makeExtrudeGroup(this.baseSvg, 0);
    const lyr0 = this._makeLayerGroup(this.baseSvg, 0);
    const ext1 = this._makeExtrudeGroup(this.baseSvg, 1);
    const lyr1Static = this._makeLayerGroup(this.baseSvg, 1, "-static");

    // Plane 2 (Slow Going Train — updates ~3x/sec, keeps 2,500 involute teeth off the 60 FPS tourbillon plane!):
    const lyr1Dyn = this._makeLayerGroup(this.trainSvg, 1, "-dyn");

    // Plane 3 (Active 60-FPS Tourbillon & Escapement ONLY — ~55 light vector nodes, ZERO slow gears or PNG patterns!):
    const ext2 = this._makeExtrudeGroup(this.svg, 2);
    const lyr2 = this._makeLayerGroup(this.svg, 2);

    // Plane 4 (Static GPU-cached Côtes de Genève Bridges): L3 Bridges, Cartouche, Chatons, Blued Screws, Tourbillon Bridge
    const ext3 = this._makeExtrudeGroup(this.bridgesSvg, 3);
    const lyr3Static = this._makeLayerGroup(this.bridgesSvg, 3, "-bridges");

    // Plane 5 (Top Complications, Dial & Sculpted Case — static except rare winding/minute ticks):
    const lyr3Comp = this._makeLayerGroup(this.topSvg, 3, "-comp");
    const ext4 = this._makeExtrudeGroup(this.topSvg, 4);
    const lyr4 = this._makeLayerGroup(this.topSvg, 4);
    const ext5 = this._makeExtrudeGroup(this.topSvg, 5);
    const lyr5 = this._makeLayerGroup(this.topSvg, 5);

    this._buildLayer0Mainplate(lyr0, ext0);
    this._buildLayer1GoingTrain(lyr1Dyn, lyr1Static, ext1);
    this._buildLayer2TourbillonEscapement(lyr2, ext2);
    this._buildLayer3BridgesAndComplications(lyr3Static, lyr3Comp, ext3);
    this._buildLayer4DialAndHands(lyr4, ext4);
    this._buildLayer5CaseBezelCrown(lyr5, ext5);
  }

  /**
   * Layer 0 (Z = 0.00 mm): Alligator Strap Stubs (auto-fade in CAD), Caseback Flank,
   * Open-Worked Anthracite Ruthenium Perlage Mainplate, and Recessed Tourbillon Well.
   */
  _buildLayer0Mainplate(layer, extLayer) {
    // 3D Machined Extruded Side-Wall for Layer 0 (solid 1.4mm anthracite German silver mainplate + caseback base)
    const qx0 = CALIBRE.tourbillon.x;
    const qy0 = CALIBRE.tourbillon.y;
    const qr0 = CALIBRE.tourbillon.apertureRadius - 1.5;
    const extPlateD =
      "M 256 0 A 256 256 0 1 0 -256 0 A 256 256 0 1 0 256 0 Z " +
      `M ${qx0 + qr0} ${qy0} A ${qr0} ${qr0} 0 1 1 ${qx0 - qr0} ${qy0} A ${qr0} ${qr0} 0 1 1 ${qx0 + qr0} ${qy0} Z`;
    for (let s = 5; s >= 1; s--) {
      el("path", {
        d: extPlateD,
        "fill-rule": "evenodd",
        fill: s === 5 ? "rgba(0,0,0,0.58)" : "url(#grad-extrude-anthracite)",
        stroke: s === 4 ? "rgba(213, 176, 116, 0.34)" : "none",
        "stroke-width": s === 4 ? "1.1" : "0",
        transform: zExtrudeShift(s * 2.2),
      }, extLayer);
    }

    // 1. Hand-stitched matte alligator leather strap stubs (fade smoothly into obsidian)
    const straps = el("g", { id: "group-straps" }, layer);
    this.nodes.straps = straps;

    const buildStrap = (isTop) => {
      const y0 = isTop ? -318 : 226;
      const h = 94;
      const g = el("g", {}, straps);
      const pathD = isTop
        ? "M-78 -318 L78 -318 L86 -226 L-86 -226 Z"
        : "M-86 226 L86 226 L78 318 L-78 318 Z";
      el("path", { d: pathD, fill: "url(#pat-leather-dark)" }, g);

      // Subtle curved side bolster shading
      el("path", {
        d: pathD,
        fill: "none",
        stroke: "rgba(0,0,0,0.65)",
        "stroke-width": "2.5",
      }, g);

      // Fine warm taupe hand-saddle stitching along left & right edges
      const stitchX = [-71, 71];
      for (const sx of stitchX) {
        const xStart = isTop ? sx : sx * 1.07;
        const xEnd = isTop ? sx * 1.07 : sx;
        el("line", {
          x1: xStart.toFixed(1),
          y1: (y0 + 10).toFixed(1),
          x2: xEnd.toFixed(1),
          y2: (y0 + h - 10).toFixed(1),
          stroke: "rgba(186, 158, 120, 0.32)",
          "stroke-width": "1.2",
          "stroke-dasharray": "4.2 3.8",
          "stroke-linecap": "round",
        }, g);
      }

      // Smooth fade mask into studio obsidian backdrop
      el("path", {
        d: pathD,
        fill: isTop ? "url(#grad-strap-fade-top)" : "url(#grad-strap-fade-bot)",
      }, g);
    };
    buildStrap(true);
    buildStrap(false);

    // 2. Sculpted Caseback Outer Flank Shadow Ring
    el("circle", { cx: "0", cy: "0", r: "256", fill: "#101216", stroke: "#48331e", "stroke-width": "1.6" }, layer);
    el("circle", { cx: "0", cy: "0", r: "226", fill: "#0b0c0f" }, layer);

    // 3. Anthracite Perlage Mainplate with Open-Worked Exhibition Cutouts (evenodd)
    const qx = CALIBRE.tourbillon.x;
    const qy = CALIBRE.tourbillon.y;
    const qr = CALIBRE.tourbillon.apertureRadius - 1.5;

    // Outer plate circle r=216 minus circular Tourbillon aperture + sculptural skeleton windows
    const platePath = [
      "M 216 0 A 216 216 0 1 0 -216 0 A 216 216 0 1 0 216 0 Z",
      // 6 o'clock open tourbillon aperture
      `M ${qx + qr} ${qy} A ${qr} ${qr} 0 1 1 ${qx - qr} ${qy} A ${qr} ${qr} 0 1 1 ${qx + qr} ${qy} Z`,
      // Left sculptural open-work kidney window (around 9:30)
      "M -154 -56 C -168 -18 -164 26 -138 56 C -122 66 -102 52 -106 32 C -114 4 -116 -22 -108 -44 C -102 -62 -140 -76 -154 -56 Z",
      // Upper-right winding skeleton cutout (around 2:00)
      "M 96 -138 C 138 -114 166 -74 172 -28 C 168 -14 146 -12 138 -28 C 130 -60 108 -90 80 -108 C 66 -118 78 -146 96 -138 Z",
    ].join(" ");

    el("path", {
      d: platePath,
      "fill-rule": "evenodd",
      fill: "url(#pat-perlage-dark)",
      stroke: "#363b46",
      "stroke-width": "1.2",
    }, layer);

    // Chamfered satin-gold bevel rim framing the 6 o'clock Tourbillon Well
    el("circle", { cx: qx, cy: qy, r: qr + 1.5, fill: "url(#grad-well-depth)", stroke: "#9c7b4d", "stroke-width": "1.4" }, layer);
    el("circle", { cx: qx, cy: qy, r: qr - 2.5, fill: "none", stroke: "rgba(244, 219, 174, 0.25)", "stroke-width": "0.8" }, layer);

    // Subtle machined concentric plate step rings & movement hallmarks
    el("circle", { cx: "0", cy: "0", r: "184", fill: "none", stroke: "rgba(186, 194, 208, 0.14)", "stroke-width": "0.8" }, layer);
    el("circle", { cx: "0", cy: "0", r: "136", fill: "none", stroke: "rgba(186, 194, 208, 0.08)", "stroke-width": "0.7" }, layer);

    // Recessed jewel bearings visible on the mainplate
    addRubyBearing(layer, -118, 72, 3.6, { chaton: true, pivot: true });
    addRubyBearing(layer, 134, -4, 3.8, { chaton: true, pivot: true });
    addBluedScrew(layer, -172, -16, 4.1, 48);
    addBluedScrew(layer, 174, -22, 4.1, -24);
    addBluedScrew(layer, 154, 108, 4.1, 72);
    addBluedScrew(layer, -154, 108, 4.1, 14);
  }

  /**
   * Layer 1 (Z = +1.15 mm): Litvin & Fuentes Involute Going Train:
   * - Open-Worked 80T Mainspring Barrel + Live Coiling Blued Mainspring
   * - 80T Center Wheel + 12T Center Pinion
   * - 75T Third Wheel + 10T Third Pinion
   * - Stationary 96T Fixed Fourth Wheel (planetary reference for Tourbillon)
   */
  _buildLayer1GoingTrain(layer, staticLayer, extLayer) {
    // 3D Machined Extruded Drum & Gear Blank Side-Walls for Layer 1 (Barrel Drum + Going Train thickness)
    const discs1 = [
      { x: CALIBRE.barrel.x, y: CALIBRE.barrel.y, r: 80.5, fill: "url(#grad-extrude-brass)", steps: 4 },
      { x: CALIBRE.center.x, y: CALIBRE.center.y, r: 58.2, fill: "url(#grad-extrude-brass)", steps: 3 },
      { x: CALIBRE.third.x, y: CALIBRE.third.y, r: 54.4, fill: "url(#grad-extrude-brass)", steps: 3 },
      { x: CALIBRE.fixedFourth.x, y: CALIBRE.fixedFourth.y, r: 37.6, fill: "url(#grad-extrude-rhodium)", steps: 3 },
    ];
    for (const d of discs1) {
      for (let s = d.steps; s >= 1; s--) {
        el("circle", {
          cx: d.x.toFixed(2),
          cy: d.y.toFixed(2),
          r: d.r.toFixed(2),
          fill: s === d.steps ? "rgba(0,0,0,0.45)" : d.fill,
          stroke: s === d.steps - 1 ? "rgba(245, 222, 176, 0.25)" : "none",
          "stroke-width": "0.8",
          transform: zExtrudeShift(s * 1.9),
        }, extLayer);
      }
    }

    // 1. Open-Worked Mainspring Barrel (80T Great Wheel, m = 2.0)
    const bGeo = generateInvoluteGear({
      teeth: CALIBRE.barrel.teeth,
      module: CALIBRE.barrel.module,
      involuteSteps: 4,
      spokeCount: 0,
      boreRadius: 63.5, // Open hollow drum exposing live blued mainspring coils!
    });
    this.totalGeometrySegments += bGeo.segmentCount;

    const barrelGroup = el("g", {
      transform: `translate(${CALIBRE.barrel.x.toFixed(2)}, ${CALIBRE.barrel.y.toFixed(2)})`,
    }, layer);

    // Barrel cast shadow
    el("circle", { cx: "2.5", cy: "4.5", r: "81", fill: "rgba(0,0,0,0.46)" }, barrelGroup);
    // Dark barrel floor plate so blued mainspring gleams crisply
    el("circle", { r: "65", fill: "#13151a", stroke: "#5c4427", "stroke-width": "1.2" }, barrelGroup);

    // Rotating 80T involute barrel drum + 5 slender open-worked floor spokes
    const barrelRot = el("g", { id: "gear-barrel" }, barrelGroup);
    this.nodes.barrel = barrelRot;
    el("path", {
      d: bGeo.d,
      "fill-rule": "evenodd",
      fill: "url(#grad-gear-brass)",
      stroke: "#523a1c",
      "stroke-width": "0.65",
    }, barrelRot);
    // Crisp specular chamfer on barrel drum rim
    el("circle", { r: "71", fill: "none", stroke: "rgba(255,238,200,0.42)", "stroke-width": "0.85" }, barrelRot);
    el("circle", { r: "63.8", fill: "none", stroke: "rgba(255,232,190,0.34)", "stroke-width": "0.7" }, barrelRot);

    // Live Coiling Blued-Steel Mainspring inside the open-worked barrel
    const msClipGroup = el("g", { "clip-path": "url(#clip-barrel-interior)" }, barrelGroup);
    this.nodes.mainspringShadow = el("path", {
      d: generateMainspringPath(0.9, 0),
      fill: "none",
      stroke: "rgba(0,0,0,0.55)",
      "stroke-width": "3.1",
      "stroke-linecap": "round",
      transform: "translate(1.2, 1.8)",
    }, msClipGroup);
    this.nodes.mainspring = el("path", {
      id: "mainspring-spiral",
      d: generateMainspringPath(0.9, 0),
      fill: "none",
      stroke: "url(#grad-blued-steel)",
      "stroke-width": "2.45",
      "stroke-linecap": "round",
    }, msClipGroup);
    this.nodes.mainspringSheen = el("path", {
      d: generateMainspringPath(0.9, 0),
      fill: "none",
      stroke: "rgba(170, 212, 255, 0.42)",
      "stroke-width": "0.65",
      "stroke-linecap": "round",
    }, msClipGroup);
    this.totalGeometrySegments += 128;

    // Central polished steel barrel arbor (hooked to inner mainspring coil)
    el("circle", { r: "17.5", fill: "url(#grad-gear-steel)", stroke: "#282c34", "stroke-width": "0.9" }, barrelGroup);
    el("circle", { r: "11.5", fill: "none", stroke: "rgba(255,255,255,0.4)", "stroke-width": "0.6" }, barrelGroup);

    // 2. Center Wheel (80T, m = 1.45, 5 curved Breguet spokes) + 12T Center Pinion
    const cGeo = generateInvoluteGear({
      teeth: CALIBRE.center.teeth,
      module: CALIBRE.center.module,
      spokeCount: 5,
      spokeStyle: "breguet",
      rimRatio: 0.84,
      hubRatio: 0.28,
      boreRadius: 5.5,
    });
    const cpGeo = generateInvoluteGear({
      teeth: CALIBRE.center.pinionTeeth,
      module: CALIBRE.center.pinionModule,
      spokeCount: 0,
      boreRadius: 3.5,
    });
    this.totalGeometrySegments += cGeo.segmentCount + cpGeo.segmentCount;

    const centerWrap = el("g", { transform: "translate(0, 0)" }, layer);
    const centerRot = el("g", { id: "gear-center" }, centerWrap);
    this.nodes.center = centerRot;

    el("path", {
      d: cGeo.d,
      "fill-rule": "evenodd",
      fill: "rgba(0,0,0,0.38)",
      transform: "translate(2.2, 3.6)",
    }, centerRot);
    el("path", {
      d: cGeo.d,
      "fill-rule": "evenodd",
      fill: "url(#grad-gear-brass)",
      stroke: "#563d1e",
      "stroke-width": "0.55",
    }, centerRot);
    el("circle", { r: (cGeo.rootRadius * 0.91).toFixed(2), fill: "none", stroke: "rgba(255,238,200,0.38)", "stroke-width": "0.65" }, centerRot);
    // Coaxial 12T steel center pinion meshing with Barrel
    el("path", {
      d: cpGeo.d,
      "fill-rule": "evenodd",
      fill: "url(#grad-gear-steel)",
      stroke: "#2d323b",
      "stroke-width": "0.5",
    }, centerRot);

    // 3. Third Wheel (75T, m = 1.45, 5 curved Breguet spokes) + 10T Third Pinion
    const tGeo = generateInvoluteGear({
      teeth: CALIBRE.third.teeth,
      module: CALIBRE.third.module,
      spokeCount: 5,
      spokeStyle: "breguet",
      rimRatio: 0.84,
      hubRatio: 0.28,
      boreRadius: 4.5,
    });
    const tpGeo = generateInvoluteGear({
      teeth: CALIBRE.third.pinionTeeth,
      module: CALIBRE.third.pinionModule,
      spokeCount: 0,
      boreRadius: 2.5,
    });
    this.totalGeometrySegments += tGeo.segmentCount + tpGeo.segmentCount;

    const thirdWrap = el("g", {
      transform: `translate(${CALIBRE.third.x.toFixed(2)}, ${CALIBRE.third.y.toFixed(2)})`,
    }, layer);
    const thirdRot = el("g", { id: "gear-third" }, thirdWrap);
    this.nodes.third = thirdRot;

    el("path", {
      d: tGeo.d,
      "fill-rule": "evenodd",
      fill: "rgba(0,0,0,0.40)",
      transform: "translate(2.2, 3.6)",
    }, thirdRot);
    el("path", {
      d: tGeo.d,
      "fill-rule": "evenodd",
      fill: "url(#grad-gear-brass)",
      stroke: "#563d1e",
      "stroke-width": "0.55",
    }, thirdRot);
    el("circle", { r: (tGeo.rootRadius * 0.91).toFixed(2), fill: "none", stroke: "rgba(255,238,200,0.38)", "stroke-width": "0.65" }, thirdRot);
    // Coaxial 10T steel Third Pinion meshing with Center Wheel
    el("path", {
      d: tpGeo.d,
      "fill-rule": "evenodd",
      fill: "url(#grad-gear-steel)",
      stroke: "#2c313b",
      "stroke-width": "0.45",
    }, thirdRot);

    // 4. Stationary 96-Tooth Fixed Fourth Wheel (m = 0.72, bolted inside Tourbillon well)
    const f4Geo = generateInvoluteGear({
      teeth: CALIBRE.fixedFourth.teeth,
      module: CALIBRE.fixedFourth.module,
      spokeCount: 6,
      spokeStyle: "radial",
      rimRatio: 0.84,
      hubRatio: 0.34,
      boreRadius: 8.0,
      involuteSteps: 3,
    });
    this.totalGeometrySegments += f4Geo.segmentCount;

    const f4Wrap = el("g", {
      transform: `translate(${CALIBRE.fixedFourth.x.toFixed(2)}, ${CALIBRE.fixedFourth.y.toFixed(2)})`,
    }, staticLayer);
    el("path", {
      d: f4Geo.d,
      "fill-rule": "evenodd",
      fill: "rgba(0,0,0,0.48)",
      transform: "translate(1.8, 2.8)",
    }, f4Wrap);
    el("path", {
      d: f4Geo.d,
      "fill-rule": "evenodd",
      fill: "url(#grad-bezel-rhodium)",
      stroke: "#343942",
      "stroke-width": "0.45",
    }, f4Wrap);
    el("circle", { r: (f4Geo.rootRadius * 0.92).toFixed(2), fill: "none", stroke: "rgba(255,255,255,0.28)", "stroke-width": "0.55" }, f4Wrap);
  }

  /**
   * Layer 2 (Z = +2.35 mm): 60-Second Open-Worked Tourbillon Carriage & Complete Escapement:
   * - Rotating 3-arm sculpted titanium/rhodium Tourbillon Cage + 10T Carriage Pinion
   * - Orbiting 15-Tooth Club-Tooth Swiss Lever Escape Wheel + 6T Pinion
   * - Oscillating Steel Anchor Pallet Fork with Synthetic Pigeon-Blood Ruby Pallet Stones
   * - Coaxial 4 Hz Free-Sprung Glucydur Balance Wheel (12 gold micro-poising screws)
   * - Live Breathing Blued-Steel Phillips Overcoil Spiral Hairspring + Incabloc Shock Spring
   */
  _buildLayer2TourbillonEscapement(layer, extLayer) {
    // 3D Machined Extruded Cylindrical Rim for Layer 2 (60s Tourbillon Carriage & Balance Wheel Volume)
    const tx2 = CALIBRE.tourbillon.x;
    const ty2 = CALIBRE.tourbillon.y;
    for (let s = 4; s >= 1; s--) {
      el("circle", {
        cx: tx2,
        cy: ty2,
        r: "67",
        fill: "none",
        stroke: s === 4 ? "rgba(0,0,0,0.52)" : "url(#grad-extrude-rhodium)",
        "stroke-width": "4.2",
        transform: zExtrudeShift(s * 1.7),
      }, extLayer);
      el("circle", {
        cx: tx2,
        cy: ty2,
        r: String(CALIBRE.balanceRadius),
        fill: "none",
        stroke: s === 4 ? "rgba(0,0,0,0.42)" : "url(#grad-extrude-brass)",
        "stroke-width": "4.0",
        transform: zExtrudeShift(s * 1.3),
      }, extLayer);
    }

    const tRoot = el("g", {
      transform: `translate(${CALIBRE.tourbillon.x.toFixed(2)}, ${CALIBRE.tourbillon.y.toFixed(2)})`,
    }, layer);

    // Subtle fixed perimeter seconds graduation ring inside tourbillon aperture
    const secRing = el("g", { opacity: "0.78" }, tRoot);
    el("circle", { r: "76.5", fill: "none", stroke: "rgba(206, 178, 128, 0.32)", "stroke-width": "0.75" }, secRing);
    for (let s = 0; s < 60; s++) {
      const a = (s * 6 - 90) * DEG;
      const major = s % 5 === 0;
      const r0 = major ? 71.5 : 74.0;
      const r1 = 76.5;
      el("line", {
        x1: (r0 * Math.cos(a)).toFixed(2),
        y1: (r0 * Math.sin(a)).toFixed(2),
        x2: (r1 * Math.cos(a)).toFixed(2),
        y2: (r1 * Math.sin(a)).toFixed(2),
        stroke: major ? "#d9b478" : "rgba(205, 198, 186, 0.36)",
        "stroke-width": major ? "1.1" : "0.55",
      }, secRing);
    }

    // Rotating 60-Second Tourbillon Carriage
    const cage = el("g", { id: "tourbillon-cage" }, tRoot);
    this.nodes.tourbillonCage = cage;

    // 1. Tourbillon Carriage 10T Pinion (meshes with 75T Third Wheel)
    const tPinGeo = generateInvoluteGear({
      teeth: CALIBRE.tourbillon.pinionTeeth,
      module: CALIBRE.tourbillon.pinionModule,
      spokeCount: 0,
      boreRadius: 3.2,
    });
    this.totalGeometrySegments += tPinGeo.segmentCount;
    el("path", {
      d: tPinGeo.d,
      "fill-rule": "evenodd",
      fill: "url(#grad-gear-steel)",
      stroke: "#232830",
      "stroke-width": "0.45",
    }, cage);

    // 2. Lower Open-Worked 3-Arm Lyre Tourbillon Carriage Frame
    const cageR = CALIBRE.tourbillon.cageRadius - 5; // 67
    const cageRim = el("g", {}, cage);
    el("circle", { r: cageR.toFixed(1), fill: "none", stroke: "rgba(0,0,0,0.48)", "stroke-width": "5.2", transform: "translate(1.5, 2.5)" }, cageRim);
    el("circle", { r: cageR.toFixed(1), fill: "none", stroke: "url(#grad-bezel-rhodium)", "stroke-width": "3.6" }, cageRim);
    el("circle", { r: (cageR + 1.4).toFixed(1), fill: "none", stroke: "rgba(246,248,252,0.52)", "stroke-width": "0.65" }, cageRim);

    // 3 sculpted lyre carriage arms connecting outer ring to coaxial hub
    for (let i = 0; i < 3; i++) {
      const rot = i * 120 - 90;
      const armG = el("g", { transform: `rotate(${rot})` }, cageRim);
      const armPath = "M 10 -3.2 C 26 -7.5 46 -7.2 65 -2.2 L 65 2.2 C 46 7.2 26 7.5 10 3.2 Z";
      el("path", { d: armPath, fill: "rgba(0,0,0,0.42)", transform: "translate(1.2, 2)" }, armG);
      el("path", {
        d: armPath,
        fill: "url(#grad-black-polish)",
        stroke: "#3b414d",
        "stroke-width": "0.55",
      }, armG);
      // Center chamfer rib along arm
      el("line", { x1: "14", y1: "0", x2: "61", y2: "0", stroke: "rgba(255,255,255,0.48)", "stroke-width": "0.55" }, armG);
      // Tiny blued cage pillar screw at outer rim junction
      addBluedScrew(armG, cageR, 0, 2.6, 25 + i * 40);
    }

    // Thermally blued 60-second indicator hand integrated onto top arm (-90 deg)
    el("path", {
      d: "M 0 -66 L 2.2 -72 L 0 -76.5 L -2.2 -72 Z",
      fill: "url(#grad-blued-steel)",
      stroke: "#a0c8ff",
      "stroke-width": "0.4",
    }, cageRim);

    // 3. Orbiting 15-Tooth Club-Tooth Swiss Lever Escape Wheel
    const escPos = CALIBRE.escapeLocal;
    const escWrap = el("g", {
      transform: `translate(${escPos.x.toFixed(2)}, ${escPos.y.toFixed(2)})`,
    }, cage);
    const escRot = el("g", { id: "escape-wheel" }, escWrap);
    this.nodes.escapeWheel = escRot;

    const escGeo = generateSwissEscapeWheel(CALIBRE.escapeLocal.teeth, CALIBRE.escapeLocal.radius);
    const escPinGeo = generateInvoluteGear({
      teeth: CALIBRE.escapeLocal.pinionTeeth,
      module: CALIBRE.escapeLocal.pinionModule,
      spokeCount: 0,
      boreRadius: 0.9,
      involuteSteps: 3,
    });
    this.totalGeometrySegments += escGeo.segmentCount + escPinGeo.segmentCount;

    // Shadow
    el("path", { d: escGeo.d, "fill-rule": "evenodd", fill: "rgba(0,0,0,0.45)", transform: "translate(1.2, 1.8)" }, escRot);
    // 15-tooth gilded gold/brass Swiss club-tooth wheel
    el("path", {
      d: escGeo.d,
      "fill-rule": "evenodd",
      fill: "url(#grad-gear-brass)",
      stroke: "#573d1b",
      "stroke-width": "0.48",
    }, escRot);
    // 6-tooth steel escape pinion underneath/coaxial
    el("path", { d: escPinGeo.d, "fill-rule": "evenodd", fill: "url(#grad-gear-steel)" }, escRot);
    addRubyBearing(escWrap, 0, 0, 2.5, { chaton: true, pivot: true });

    // 4. Oscillating Swiss Lever Anchor Pallet Fork & Synthetic Ruby Pallet Stones
    const palPos = CALIBRE.palletLocal;
    const palGeo = generatePalletForkGeometry(palPos, escPos, { x: 0, y: 0 });
    this.totalGeometrySegments += palGeo.segmentCount;

    const palWrap = el("g", {
      transform: `translate(${palPos.x.toFixed(2)}, ${palPos.y.toFixed(2)})`,
    }, cage);

    // Twin gilded banking pins mounted on carriage plate
    el("circle", { cx: palGeo.bankingPinA.x.toFixed(2), cy: palGeo.bankingPinA.y.toFixed(2), r: "1.35", fill: "url(#grad-gold-chaton)", stroke: "#483115", "stroke-width": "0.3" }, palWrap);
    el("circle", { cx: palGeo.bankingPinB.x.toFixed(2), cy: palGeo.bankingPinB.y.toFixed(2), r: "1.35", fill: "url(#grad-gold-chaton)", stroke: "#483115", "stroke-width": "0.3" }, palWrap);

    const palOsc = el("g", { id: "pallet-fork" }, palWrap);
    this.nodes.palletFork = palOsc;
    // Steel pallet anchor body
    el("path", { d: palGeo.bodyPath, fill: "rgba(0,0,0,0.42)", transform: "translate(0.9, 1.4)" }, palOsc);
    el("path", {
      d: palGeo.bodyPath,
      fill: "url(#grad-gear-steel)",
      stroke: "#2d323b",
      "stroke-width": "0.45",
    }, palOsc);
    // Entry & Exit Pigeon-Blood Ruby Pallet Stones!
    el("path", { d: palGeo.entryStonePath, fill: "url(#grad-ruby-jewel)", stroke: "#ff8fb0", "stroke-width": "0.32" }, palOsc);
    el("path", { d: palGeo.exitStonePath, fill: "url(#grad-ruby-jewel)", stroke: "#ff8fb0", "stroke-width": "0.32" }, palOsc);
    addRubyBearing(palWrap, 0, 0, 2.2, { chaton: true, pivot: true });

    // 5. Coaxial 4.0 Hz Free-Sprung Glucydur Balance Wheel (with 12 Gold Poising Weights)
    const balR = CALIBRE.balanceRadius; // 54
    const balRot = el("g", { id: "balance-wheel" }, cage);
    this.nodes.balanceWheel = balRot;

    // Balance rim shadow
    el("circle", { r: balR, fill: "none", stroke: "rgba(0,0,0,0.44)", "stroke-width": "5.2", transform: "translate(1.4, 2.4)" }, balRot);
    // Three bevelled aerodynamic balance spokes
    for (let i = 0; i < 3; i++) {
      const a = (i * 120 + 30) * DEG;
      el("line", {
        x1: (7 * Math.cos(a)).toFixed(2),
        y1: (7 * Math.sin(a)).toFixed(2),
        x2: ((balR - 2.2) * Math.cos(a)).toFixed(2),
        y2: ((balR - 2.2) * Math.sin(a)).toFixed(2),
        stroke: "url(#grad-gear-brass)",
        "stroke-width": "2.6",
        "stroke-linecap": "round",
      }, balRot);
      el("line", {
        x1: (8 * Math.cos(a)).toFixed(2),
        y1: (8 * Math.sin(a)).toFixed(2),
        x2: ((balR - 3) * Math.cos(a)).toFixed(2),
        y2: ((balR - 3) * Math.sin(a)).toFixed(2),
        stroke: "rgba(255,244,218,0.45)",
        "stroke-width": "0.6",
      }, balRot);
    }
    // Outer Glucydur gilded balance wheel rim
    el("circle", { r: balR, fill: "none", stroke: "url(#grad-gear-brass)", "stroke-width": "4.2" }, balRot);
    el("circle", { r: (balR + 1.5).toFixed(1), fill: "none", stroke: "rgba(255,242,208,0.52)", "stroke-width": "0.65" }, balRot);
    el("circle", { r: (balR - 1.6).toFixed(1), fill: "none", stroke: "#5c411d", "stroke-width": "0.65" }, balRot);

    // 12 micro-regulated 18k gold inertia poising weights / screws around balance rim
    for (let i = 0; i < 12; i++) {
      const deg = i * 30;
      const wg = el("g", { transform: `rotate(${deg}) translate(${balR + 2.4}, 0)` }, balRot);
      el("rect", { x: "-1.1", y: "-1.5", width: "3.1", height: "3.0", rx: "0.7", fill: "url(#grad-gold-chaton)", stroke: "#5c3f1c", "stroke-width": "0.35" }, wg);
      this.totalGeometrySegments += 2;
    }

    // Coaxial roller table & ruby impulse pin (faces pallet fork notch at angle ~144 deg)
    el("circle", { r: "9.2", fill: "url(#grad-gear-steel)", stroke: "#3a404c", "stroke-width": "0.5" }, balRot);
    const impAngle = Math.atan2(palPos.y, palPos.x);
    el("circle", {
      cx: (6.8 * Math.cos(impAngle)).toFixed(2),
      cy: (6.8 * Math.sin(impAngle)).toFixed(2),
      r: "1.65",
      fill: "url(#grad-ruby-jewel)",
      stroke: "#ffa4be",
      "stroke-width": "0.3",
    }, balRot);

    // 6. Live Breathing Blued-Steel Phillips Overcoil Spiral Hairspring (single direct DOM path — zero <use> shadow-tree churn!)
    this.nodes.hairspring = el("path", {
      id: "hairspring-spiral",
      d: generateHairspringPath(0),
      fill: "none",
      stroke: "url(#grad-blued-steel)",
      "stroke-width": "1.42",
      "stroke-linecap": "round",
    }, cage);
    this.totalGeometrySegments += 56;

    // Outer hairspring stud carrier mounted to cage arm
    const studX = 26.4 * Math.cos(-0.58);
    const studY = 26.4 * Math.sin(-0.58);
    el("rect", {
      x: (studX - 2.8).toFixed(2),
      y: (studY - 2.1).toFixed(2),
      width: "5.6",
      height: "4.2",
      rx: "1.1",
      fill: "url(#grad-gold-chaton)",
      stroke: "#4d3417",
      "stroke-width": "0.45",
      transform: `rotate(${(-0.58 * RAD).toFixed(1)}, ${studX.toFixed(2)}, ${studY.toFixed(2)})`,
    }, cage);

    // Central brass collet & Incabloc lyre shock-absorber jewel
    el("circle", { r: "6.4", fill: "url(#grad-gold-chaton)", stroke: "#5c401b", "stroke-width": "0.5" }, cage);
    addRubyBearing(cage, 0, 0, 3.8, { chaton: false, pivot: true });
    // Iconic gold Incabloc lyre shock spring over the ruby cap jewel
    el("path", {
      d: "M -3.8 -3.6 C -6.0 -1.2 -5.8 3.2 -2.2 4.6 C 0 5.4 0 5.4 2.2 4.6 C 5.8 3.2 6.0 -1.2 3.8 -3.6",
      fill: "none",
      stroke: "#f4d18c",
      "stroke-width": "0.85",
      "stroke-linecap": "round",
    }, cage);
  }

  /**
   * Layer 3 (Z = +3.50 mm): Sculpted Côtes de Genève Skeleton Bridges, Sunray Ratchet Wheel,
   * Flexing Steel Click, Crown & Intermediate Winding Train, 72H Power Reserve Sector,
   * Gold Chaton Ruby Bearings, Thermally Blued Slotted Screws & Upper Tourbillon Bridge.
   */
  _buildLayer3BridgesAndComplications(layer, compLayer, extLayer) {
    // 1. Sculpted Côtes de Genève Main Barrel & Train Bridge (Left/Upper-Left Sweep, clearing 6 o'clock tourbillon!)
    const mainBridgeD = [
      "M -182 -56",
      "C -164 -128 -108 -178 -36 -184",
      "C 4 -187 28 -164 26 -136",
      "C 24 -116 -2 -106 -14 -98",
      "C -36 -84 -54 -64 -58 -36",
      "C -62 -8 -36 10 -14 26",
      "C -4 33 -10 52 -24 58",
      "C -44 68 -74 72 -102 60",
      "C -132 46 -140 18 -148 -4",
      "C -158 -24 -188 -26 -182 -56 Z",
      // Architectural oval skeleton cutout over barrel flank to show blued mainspring underneath!
      "M -88 -124 C -68 -144 -28 -146 -12 -124 C -2 -110 -16 -90 -38 -86 C -66 -80 -98 -106 -88 -124 Z",
    ].join(" ");

    // 2. Sculpted Rose-Gold Côtes de Genève Winding & Center Bridge (Upper-Right Sweep)
    const rightBridgeD = [
      "M 24 -158",
      "C 82 -152 138 -116 168 -64",
      "C 182 -40 184 -10 176 14",
      "C 166 28 142 26 132 10",
      "C 122 -14 102 -36 74 -44",
      "C 44 -52 24 -28 14 -6",
      "C 4 12 -18 14 -24 -2",
      "C -28 -18 -8 -44 10 -66",
      "C 24 -84 4 -144 24 -158 Z",
    ].join(" ");

    // 3D Machined CNC Slab Extrusions for Layer 3 (Rhodium Bridge, Rose-Gold Bridge, Ratchet, Tourbillon Bridge)
    const tBridgeExtD =
      "M -94 104 C -94 95 -84 91 -74 93 C -58 97 -32 100.4 -14 96.8 C -7 93 7 93 14 96.8 " +
      "C 32 100.4 58 97 74 93 C 84 91 94 95 94 104 C 94 113 84 117 74 115 " +
      "C 58 111 32 107.6 14 111.2 C 7 115 -7 115 -14 111.2 C -32 107.6 -58 111 -74 115 C -84 117 -94 113 -94 104 Z";
    for (let s = 4; s >= 1; s--) {
      const shift = zExtrudeShift(s * 2.0);
      el("path", {
        d: mainBridgeD,
        "fill-rule": "evenodd",
        fill: s === 4 ? "rgba(0,0,0,0.48)" : "url(#grad-extrude-rhodium)",
        stroke: s === 3 ? "rgba(224,232,244,0.34)" : "none",
        "stroke-width": "0.8",
        transform: shift,
      }, extLayer);
      el("path", {
        d: rightBridgeD,
        fill: s === 4 ? "rgba(0,0,0,0.48)" : "url(#grad-extrude-rosegold)",
        stroke: s === 3 ? "rgba(248,224,182,0.34)" : "none",
        "stroke-width": "0.8",
        transform: shift,
      }, extLayer);
      el("path", {
        d: tBridgeExtD,
        fill: s === 4 ? "rgba(0,0,0,0.50)" : "url(#grad-extrude-rhodium)",
        transform: shift,
      }, extLayer);
    }

    // Cast shadow
    el("path", {
      d: mainBridgeD,
      "fill-rule": "evenodd",
      fill: "rgba(0,0,0,0.50)",
      transform: "translate(3, 5)",
    }, layer);
    // Côtes de Genève Rhodium Bridge Body
    el("path", {
      d: mainBridgeD,
      "fill-rule": "evenodd",
      fill: "url(#pat-cotes-rhodium)",
      stroke: "#2d323c",
      "stroke-width": "1.6",
    }, layer);
    // Hand-beveled 45° Anglage bright specular highlight border
    el("path", {
      d: mainBridgeD,
      "fill-rule": "evenodd",
      fill: "none",
      stroke: "rgba(244, 247, 252, 0.56)",
      "stroke-width": "0.85",
    }, layer);

    el("path", { d: rightBridgeD, fill: "rgba(0,0,0,0.48)", transform: "translate(2.5, 4.5)" }, layer);
    el("path", {
      d: rightBridgeD,
      fill: "url(#pat-cotes-rosegold)",
      stroke: "#573c1f",
      "stroke-width": "1.4",
    }, layer);
    el("path", {
      d: rightBridgeD,
      fill: "none",
      stroke: "rgba(255, 236, 200, 0.58)",
      "stroke-width": "0.85",
    }, layer);

    // 3. Geneva Manufacture Cartouche Plaque engraved cleanly onto Left Main Bridge (9:30)
    const plaque = el("g", { transform: "translate(-128, -28)" }, layer);
    el("rect", {
      x: "-38",
      y: "-21",
      width: "76",
      height: "42",
      rx: "3",
      fill: "#14161b",
      stroke: "#c59d63",
      "stroke-width": "0.9",
    }, plaque);
    el("rect", {
      x: "-35.5",
      y: "-18.5",
      width: "71",
      height: "37",
      rx: "2",
      fill: "none",
      stroke: "rgba(230, 198, 146, 0.25)",
      "stroke-width": "0.5",
    }, plaque);
    const tBrand = el("text", {
      x: "0",
      y: "-6.5",
      "text-anchor": "middle",
      fill: "#ecdcc0",
      "font-family": "'Didot', 'Bodoni MT', 'Garamond', Georgia, serif",
      "font-size": "8.2",
      "letter-spacing": "2.1",
      "font-weight": "600",
    }, plaque);
    tBrand.textContent = "CHRONOS";
    const tCal = el("text", {
      x: "0",
      y: "4.8",
      "text-anchor": "middle",
      fill: "#cca56a",
      "font-family": "'SF Mono', 'Cascadia Mono', Consolas, monospace",
      "font-size": "6.3",
      "letter-spacing": "1.1",
    }, plaque);
    tCal.textContent = "CAL. N-4";
    const tGen = el("text", {
      x: "0",
      y: "14.2",
      "text-anchor": "middle",
      fill: "#8f8a82",
      "font-family": "'Didot', 'Garamond', Georgia, serif",
      "font-size": "5.4",
      "letter-spacing": "1.8",
    }, plaque);
    tGen.textContent = "GENÈVE";

    // 4. Sunray Barrel Ratchet Wheel (52T) + Flexing Steel Click & Spring
    const ratGeo = generateInvoluteGear({
      teeth: CALIBRE.ratchet.teeth,
      module: CALIBRE.ratchet.module,
      spokeCount: 5,
      spokeStyle: "radial",
      rimRatio: 0.80,
      hubRatio: 0.36,
      boreRadius: 6.5,
      involuteSteps: 4,
    });
    this.totalGeometrySegments += ratGeo.segmentCount;

    const ratWrap = el("g", {
      transform: `translate(${CALIBRE.ratchet.x.toFixed(2)}, ${CALIBRE.ratchet.y.toFixed(2)})`,
    }, compLayer);
    const ratRot = el("g", { id: "gear-ratchet" }, ratWrap);
    this.nodes.ratchet = ratRot;

    el("path", { d: ratGeo.d, "fill-rule": "evenodd", fill: "rgba(0,0,0,0.44)", transform: "translate(1.8, 3)" }, ratRot);
    el("path", {
      d: ratGeo.d,
      "fill-rule": "evenodd",
      fill: "url(#pat-wheel-steel)",
      stroke: "#363c48",
      "stroke-width": "0.6",
    }, ratRot);
    el("circle", { r: "34", fill: "none", stroke: "rgba(255,255,255,0.34)", "stroke-width": "0.6" }, ratRot);
    // Barrel arbor ratchet cap + 3 micro-screws
    el("circle", { r: "12.5", fill: "url(#grad-gear-steel)", stroke: "#2b303a", "stroke-width": "0.7" }, ratWrap);
    addBluedScrew(ratWrap, 0, 0, 5.2, -38);

    // Flexing Polished Steel Click & Curved Click Spring engaging Ratchet Wheel at 9:30 of ratchet
    const clickAnchorX = CALIBRE.ratchet.x - 44;
    const clickAnchorY = CALIBRE.ratchet.y - 26;
    const clickWrap = el("g", {
      transform: `translate(${clickAnchorX.toFixed(2)}, ${clickAnchorY.toFixed(2)})`,
    }, compLayer);
    // Slender curved steel click spring wire
    el("path", {
      d: "M -14 14 C -24 -4 -14 -24 6 -24",
      fill: "none",
      stroke: "url(#grad-blued-steel)",
      "stroke-width": "1.6",
      "stroke-linecap": "round",
    }, clickWrap);
    const clickArm = el("g", { id: "barrel-click" }, clickWrap);
    this.nodes.clickArm = clickArm;
    el("path", {
      d: "M -6 -4 C 6 -8 18 -2 22 9 L 15 13 C 10 6 0 4 -8 4 Z",
      fill: "url(#grad-gear-steel)",
      stroke: "#2d323b",
      "stroke-width": "0.55",
    }, clickArm);
    addBluedScrew(clickWrap, -2, 0, 3.6, 52);

    // 5. Crown Winding Wheel (34T) & Intermediate Winding Wheel (26T) + Winding Stem Clutch
    const cwGeo = generateInvoluteGear({
      teeth: CALIBRE.crownWheel.teeth,
      module: CALIBRE.crownWheel.module,
      spokeCount: 0,
      boreRadius: 9.5,
      involuteSteps: 4,
    });
    const wiGeo = generateInvoluteGear({
      teeth: CALIBRE.windingInter.teeth,
      module: CALIBRE.windingInter.module,
      spokeCount: 5,
      spokeStyle: "radial",
      rimRatio: 0.78,
      hubRatio: 0.34,
      boreRadius: 4.0,
      involuteSteps: 4,
    });
    this.totalGeometrySegments += cwGeo.segmentCount + wiGeo.segmentCount;

    const cwWrap = el("g", {
      transform: `translate(${CALIBRE.crownWheel.x.toFixed(2)}, ${CALIBRE.crownWheel.y.toFixed(2)})`,
    }, compLayer);
    const cwRot = el("g", { id: "gear-crown-wheel" }, cwWrap);
    this.nodes.crownWheel = cwRot;
    el("path", { d: cwGeo.d, "fill-rule": "evenodd", fill: "rgba(0,0,0,0.42)", transform: "translate(1.6, 2.6)" }, cwRot);
    el("path", { d: cwGeo.d, "fill-rule": "evenodd", fill: "url(#pat-wheel-steel)", stroke: "#313640", "stroke-width": "0.55" }, cwRot);
    el("circle", { r: "18.5", fill: "none", stroke: "rgba(255,255,255,0.4)", "stroke-width": "0.65" }, cwRot);
    // Double-slotted crown wheel core cap
    el("circle", { r: "10.2", fill: "url(#grad-gear-steel)", stroke: "#282c36", "stroke-width": "0.65" }, cwWrap);
    addBluedScrew(cwWrap, -4.4, 0, 2.3, 18);
    addBluedScrew(cwWrap, 4.4, 0, 2.3, 18);

    const wiWrap = el("g", {
      transform: `translate(${CALIBRE.windingInter.x.toFixed(2)}, ${CALIBRE.windingInter.y.toFixed(2)})`,
    }, compLayer);
    const wiRot = el("g", { id: "gear-winding-inter" }, wiWrap);
    this.nodes.windingInter = wiRot;
    el("path", { d: wiGeo.d, "fill-rule": "evenodd", fill: "rgba(0,0,0,0.4)", transform: "translate(1.5, 2.2)" }, wiRot);
    el("path", { d: wiGeo.d, "fill-rule": "evenodd", fill: "url(#grad-gear-steel)", stroke: "#333844", "stroke-width": "0.5" }, wiRot);
    addRubyBearing(wiWrap, 0, 0, 3.2, { chaton: true, pivot: true });

    // Horizontal Machined Steel Winding Stem & Sliding Clutch (y = 0, x = 114..252)
    const stemG = el("g", {}, compLayer);
    el("rect", { x: "118", y: "-3.6", width: "136", height: "7.2", rx: "1.4", fill: "url(#grad-gear-steel)", stroke: "#2b303a", "stroke-width": "0.55" }, stemG);
    // Sliding clutch pinion sleeve
    el("rect", { x: "134", y: "-8.2", width: "18", height: "16.4", rx: "2", fill: "url(#grad-gear-steel)", stroke: "#282c36", "stroke-width": "0.65" }, stemG);
    for (let sx = 138; sx <= 148; sx += 3.3) {
      el("line", { x1: sx, y1: "-7.6", x2: sx, y2: "7.6", stroke: "#20242c", "stroke-width": "0.9" }, stemG);
    }

    // 6. 72-Hour Power Reserve Complication Sector (4 o'clock: (102, +44))
    const pr = CALIBRE.prCenter;
    const prWrap = el("g", { transform: `translate(${pr.x}, ${pr.y})` }, compLayer);

    // Exposed gilded differential gear underneath Power Reserve sector
    const prGearGeo = generateInvoluteGear({
      teeth: 36,
      module: 1.12,
      spokeCount: 5,
      spokeStyle: "breguet",
      rimRatio: 0.80,
      hubRatio: 0.32,
      boreRadius: 4.0,
      involuteSteps: 3,
    });
    this.totalGeometrySegments += prGearGeo.segmentCount;
    this.nodes.prGear = el("path", {
      d: prGearGeo.d,
      "fill-rule": "evenodd",
      fill: "url(#grad-gear-brass)",
      stroke: "#573d1d",
      "stroke-width": "0.45",
      opacity: "0.92",
    }, prWrap);

    // Open-worked Power Reserve Fan Bridge & Engraved Scale (sweeps -62° to +62°, i.e. 0h bottom -> 72h top!)
    const prArcOuter = 54;
    const prArcInner = 34;
    const startA = -64 * DEG; // 72H (top)
    const endA = 64 * DEG;    // 0H (bottom)
    const fanPath = [
      `M ${(prArcInner * Math.cos(startA)).toFixed(2)} ${(prArcInner * Math.sin(startA)).toFixed(2)}`,
      `L ${(prArcOuter * Math.cos(startA)).toFixed(2)} ${(prArcOuter * Math.sin(startA)).toFixed(2)}`,
      `A ${prArcOuter} ${prArcOuter} 0 0 1 ${(prArcOuter * Math.cos(endA)).toFixed(2)} ${(prArcOuter * Math.sin(endA)).toFixed(2)}`,
      `L ${(prArcInner * Math.cos(endA)).toFixed(2)} ${(prArcInner * Math.sin(endA)).toFixed(2)}`,
      `A ${prArcInner} ${prArcInner} 0 0 0 ${(prArcInner * Math.cos(startA)).toFixed(2)} ${(prArcInner * Math.sin(startA)).toFixed(2)} Z`,
    ].join(" ");

    el("path", { d: fanPath, fill: "rgba(0,0,0,0.48)", transform: "translate(1.8, 2.8)" }, prWrap);
    el("path", { d: fanPath, fill: "#17191f", stroke: "#c49c62", "stroke-width": "1.0" }, prWrap);

    // Subtle red reserve warning zone near 0–12h (bottom end of sector)
    const warnStart = 42 * DEG;
    const warnEnd = 58 * DEG;
    el("path", {
      d: `M ${(49 * Math.cos(warnStart)).toFixed(2)} ${(49 * Math.sin(warnStart)).toFixed(2)} A 49 49 0 0 1 ${(49 * Math.cos(warnEnd)).toFixed(2)} ${(49 * Math.sin(warnEnd)).toFixed(2)}`,
      fill: "none",
      stroke: "#b82842",
      "stroke-width": "2.6",
      "stroke-linecap": "round",
    }, prWrap);

    // Fine Power Reserve graduations (0, 12, 24, 36, 48, 60, 72 H)
    for (let i = 0; i <= 12; i++) {
      const frac = i / 12; // 0 = 0h (bottom +58°), 1 = 72h (top -58°)
      const a = (58 - frac * 116) * DEG;
      const major = i % 2 === 0;
      const r0 = major ? 45.5 : 48.0;
      const r1 = 51.8;
      el("line", {
        x1: (r0 * Math.cos(a)).toFixed(2),
        y1: (r0 * Math.sin(a)).toFixed(2),
        x2: (r1 * Math.cos(a)).toFixed(2),
        y2: (r1 * Math.sin(a)).toFixed(2),
        stroke: i <= 2 ? "#d94a64" : (major ? "#ebd6b4" : "rgba(216,198,170,0.45)"),
        "stroke-width": major ? "1.05" : "0.55",
      }, prWrap);

      if (i % 4 === 0) {
        const hrVal = i * 6;
        const tx = 39.8 * Math.cos(a);
        const ty = 39.8 * Math.sin(a);
        const lbl = el("text", {
          x: tx.toFixed(1),
          y: (ty + 2.3).toFixed(1),
          "text-anchor": "middle",
          fill: i === 0 ? "#d9556c" : "#d8c3a0",
          "font-family": "'SF Mono', Consolas, monospace",
          "font-size": "6.5",
          "font-weight": "600",
        }, prWrap);
        lbl.textContent = String(hrVal);
      }
    }

    const prTitle = el("text", {
      x: "16",
      y: "2.5",
      "text-anchor": "middle",
      fill: "#a99a82",
      "font-family": "'SF Mono', Consolas, monospace",
      "font-size": "5.2",
      "letter-spacing": "0.9",
    }, prWrap);
    prTitle.textContent = "72H PR";

    // Thermally blued Lancet Power Reserve Hand
    const prHand = el("g", { id: "pr-hand" }, prWrap);
    this.nodes.prHand = prHand;
    el("path", {
      d: "M -9 0 L -4 -2.2 L 48.5 0 L -4 2.2 Z",
      fill: "rgba(0,0,0,0.45)",
      transform: "translate(1, 1.8)",
    }, prHand);
    el("path", {
      d: "M -9 0 L -4 -2.1 L 48.5 0 L -4 2.1 Z",
      fill: "url(#grad-blued-steel)",
      stroke: "#98c6ff",
      "stroke-width": "0.38",
    }, prHand);
    el("circle", { r: "4.2", fill: "url(#grad-gold-chaton)", stroke: "#483014", "stroke-width": "0.5" }, prWrap);
    el("circle", { r: "1.6", fill: "#1a2030" }, prWrap);

    // 7. Gold Chaton Ruby Bearings & Thermally Blued Slotted Screws on Bridges
    addRubyBearing(layer, CALIBRE.center.x, CALIBRE.center.y, 6.2, { chaton: true, chatonScrews: true, pivot: false });
    addRubyBearing(layer, CALIBRE.third.x, CALIBRE.third.y, 5.2, { chaton: true, chatonScrews: true, pivot: true });
    addRubyBearing(layer, 56, -124, 3.8, { chaton: true, pivot: true });
    addRubyBearing(layer, -94, -142, 4.0, { chaton: true, pivot: true });

    addBluedScrew(layer, -144, -92, 4.9, 28);
    addBluedScrew(layer, -44, -166, 4.9, -42);
    addBluedScrew(layer, -74, 60, 4.8, 65);
    addBluedScrew(layer, 36, -138, 4.7, -15);
    addBluedScrew(layer, 118, -96, 4.7, 44);
    addBluedScrew(layer, 152, -16, 4.6, 82);

    // 8. Iconic Upper Black-Polished Rhodium Tourbillon Bridge (6 o'clock)
    const tBridgeWrap = el("g", {
      transform: `translate(${CALIBRE.tourbillon.x}, ${CALIBRE.tourbillon.y})`,
    }, layer);
    // Slender double-curved Geneva lyre-waist bridge leaving escapement crystal clear!
    const tBridgeD = [
      "M -94 0",
      "C -94 -9 -84 -13 -74 -11",
      "C -58 -7 -32 -3.6 -14 -7.2",
      "C -7 -11 7 -11 14 -7.2",
      "C 32 -3.6 58 -7 74 -11",
      "C 84 -13 94 -9 94 0",
      "C 94 9 84 13 74 11",
      "C 58 7 32 3.6 14 7.2",
      "C 7 11 -7 11 -14 7.2",
      "C -32 3.6 -58 7 -74 11",
      "C -84 13 -94 9 -94 0 Z",
    ].join(" ");

    el("path", { d: tBridgeD, fill: "rgba(0,0,0,0.52)", transform: "translate(2, 4.5)" }, tBridgeWrap);
    el("path", {
      d: tBridgeD,
      fill: "url(#grad-black-polish)",
      stroke: "#2f343e",
      "stroke-width": "1.0",
    }, tBridgeWrap);
    // Crisp specular center bevel ridge along upper tourbillon bridge
    el("path", {
      d: "M -76 0 L -14 0 M 14 0 L 76 0",
      stroke: "rgba(255,255,255,0.68)",
      "stroke-width": "0.85",
      "stroke-linecap": "round",
    }, tBridgeWrap);
    // Outer pillar thermally blued screws & center gold chaton diamond-capped ruby
    addBluedScrew(tBridgeWrap, -82, 0, 4.4, -30);
    addBluedScrew(tBridgeWrap, 82, 0, 4.4, 30);
    addRubyBearing(tBridgeWrap, 0, 0, 5.2, { chaton: true, chatonScrews: false, pivot: true });
  }

  /**
   * Layer 4 (Z = +4.45 mm): Exhibition Chapter Ring, Applied 5N Rose-Gold Faceted Indices,
   * 6 o'clock Tourbillon Framing Ring, and Skeletonized Breguet Hour & Minute Hands.
   */
  _buildLayer4DialAndHands(layer, extLayer) {
    // 1. Peripheral Brushed Anthracite Chapter Ring (r = 191..218)
    const chapterRingD =
      "M 218 0 A 218 218 0 1 0 -218 0 A 218 218 0 1 0 218 0 Z " +
      "M 191 0 A 191 191 0 1 1 -191 0 A 191 191 0 1 1 191 0 Z";

    // 3D Stepped Rehaut Cylinder Wall for Layer 4 (Chapter Ring Thickness)
    for (let s = 4; s >= 1; s--) {
      el("path", {
        d: chapterRingD,
        "fill-rule": "evenodd",
        fill: s === 4 ? "rgba(0,0,0,0.45)" : "url(#grad-extrude-anthracite)",
        stroke: s === 3 ? "rgba(213, 176, 116, 0.38)" : "none",
        "stroke-width": "0.9",
        transform: zExtrudeShift(s * 1.8),
      }, extLayer);
    }

    el("path", {
      d: chapterRingD,
      "fill-rule": "evenodd",
      fill: "url(#grad-chapter-ring)",
      stroke: "#4c4338",
      "stroke-width": "0.9",
    }, layer);
    el("circle", { r: "191", fill: "none", stroke: "rgba(218, 186, 132, 0.42)", "stroke-width": "0.85" }, layer);
    el("circle", { r: "216.5", fill: "none", stroke: "rgba(235, 226, 210, 0.22)", "stroke-width": "0.7" }, layer);

    // 240 subtle 1/4-second beat ticks (4 Hz!) + 60 crisp minute graduations (clear SWISS MADE window at 6 o'clock)
    const ticksG = el("g", {}, layer);
    for (let i = 0; i < 240; i++) {
      if (i >= 114 && i <= 126) continue; // Keep SWISS MADE at 6 o'clock razor-clean
      const a = (i * 1.5 - 90) * DEG;
      const isFive = i % 20 === 0;
      const isMin = i % 4 === 0;
      const r0 = isFive ? 195.5 : isMin ? 201.5 : 206.8;
      const r1 = 211.5;
      el("line", {
        x1: (r0 * Math.cos(a)).toFixed(2),
        y1: (r0 * Math.sin(a)).toFixed(2),
        x2: (r1 * Math.cos(a)).toFixed(2),
        y2: (r1 * Math.sin(a)).toFixed(2),
        stroke: isFive ? "#e5c795" : isMin ? "rgba(232, 224, 210, 0.72)" : "rgba(182, 176, 166, 0.26)",
        "stroke-width": isFive ? "1.35" : isMin ? "0.8" : "0.45",
      }, ticksG);
    }

    // Applied 18k 5N Rose-Gold Faceted Baton Hour Indices (skip 6 o'clock for open tourbillon!)
    for (let h = 1; h <= 12; h++) {
      if (h === 6) continue;
      if (h === 12) {
        // Refined sculpted Roman XII at 12 o'clock
        const t12 = el("text", {
          x: "0",
          y: "-197.5",
          "text-anchor": "middle",
          fill: "#edd2a4",
          "font-family": "'Didot', 'Bodoni MT', 'Garamond', Georgia, serif",
          "font-size": "18.5",
          "font-weight": "600",
          "letter-spacing": "1.2",
        }, layer);
        t12.textContent = "XII";
        continue;
      }
      const deg = h * 30 - 90;
      const ig = el("g", { transform: `rotate(${deg}) translate(197, 0)` }, layer);
      // Cast shadow
      el("polygon", { points: "-12,-2.7 13,-1.9 15,0 13,1.9 -12,2.7", fill: "rgba(0,0,0,0.45)", transform: "translate(1, 1.5)" }, ig);
      // Bright upper facet
      el("polygon", { points: "-12,-2.6 13,-1.8 15,0 -12,0", fill: "url(#grad-hand-light)" }, ig);
      // Deep lower facet
      el("polygon", { points: "-12,0 15,0 13,1.8 -12,2.6", fill: "url(#grad-hand-dark)" }, ig);
      el("polygon", { points: "-12,-2.6 13,-1.8 15,0 13,1.8 -12,2.6", fill: "none", stroke: "#5c3f1e", "stroke-width": "0.35" }, ig);
    }

    // Subtle "SWISS MADE" at bottom edge of chapter ring (6 o'clock rim)
    const tSwiss = el("text", {
      x: "0",
      y: "208.5",
      "text-anchor": "middle",
      fill: "rgba(214, 198, 170, 0.72)",
      "font-family": "'SF Mono', Consolas, monospace",
      "font-size": "6.2",
      "letter-spacing": "2.4",
    }, layer);
    tSwiss.textContent = "SWISS   MADE";

    // 2. Faceted Open-Worked Breguet/Cathedral Hour & Minute Hands
    // Hour Hand (length 118, open-worked Breguet pomme circle near tip)
    const hourHand = el("g", { id: "hand-hour" }, layer);
    this.nodes.hourHand = hourHand;
    const hLeft = "M -30 0 L -24 -4.2 L 0 -5.6 L 86 -3.8 L 116 0 L 0 0 Z";
    const hRight = "M -30 0 L -24 4.2 L 0 5.6 L 86 3.8 L 116 0 L 0 0 Z";
    const hFull = "M -30 0 L -24 -4.2 L 0 -5.6 L 86 -3.8 L 116 0 L 86 3.8 L 0 5.6 L -24 4.2 Z";
    // Shadow
    el("path", { d: hFull, fill: "rgba(0,0,0,0.48)", transform: "translate(2.5, 4.2)" }, hourHand);
    // Two-facet rose gold body
    el("path", { d: hLeft, fill: "url(#grad-hand-light)" }, hourHand);
    el("path", { d: hRight, fill: "url(#grad-hand-dark)" }, hourHand);
    // Open-worked skeleton lancet window + Breguet pomme ring
    el("path", { d: "M 18 -1.8 L 76 -1.1 L 76 1.1 L 18 1.8 Z", fill: "#0e1014", stroke: "#694823", "stroke-width": "0.4" }, hourHand);
    el("circle", { cx: "89", cy: "0", r: "6.4", fill: "#0e1014", stroke: "url(#grad-hand-light)", "stroke-width": "2.1" }, hourHand);
    el("path", { d: hFull, fill: "none", stroke: "#543719", "stroke-width": "0.5" }, hourHand);

    // Minute Hand (length 176, slender two-facet rose gold with open-worked Breguet tip)
    const minHand = el("g", { id: "hand-minute" }, layer);
    this.nodes.minuteHand = minHand;
    const mLeft = "M -38 0 L -31 -3.0 L 0 -4.2 L 138 -2.4 L 182 0 L 0 0 Z";
    const mRight = "M -38 0 L -31 3.0 L 0 4.2 L 138 2.4 L 182 0 L 0 0 Z";
    const mFull = "M -38 0 L -31 -3.0 L 0 -4.2 L 138 -2.4 L 182 0 L 138 2.4 L 0 4.2 L -31 3.0 Z";
    el("path", { d: mFull, fill: "rgba(0,0,0,0.48)", transform: "translate(3.0, 5.0)" }, minHand);
    el("path", { d: mLeft, fill: "url(#grad-hand-light)" }, minHand);
    el("path", { d: mRight, fill: "url(#grad-hand-dark)" }, minHand);
    el("path", { d: "M 22 -1.3 L 124 -0.8 L 124 0.8 L 22 1.3 Z", fill: "#0e1014", stroke: "#694823", "stroke-width": "0.38" }, minHand);
    el("circle", { cx: "139", cy: "0", r: "5.2", fill: "#0e1014", stroke: "url(#grad-hand-light)", "stroke-width": "1.8" }, minHand);
    el("path", { d: mFull, fill: "none", stroke: "#543719", "stroke-width": "0.45" }, minHand);

    // Central Polished Cannon Pinion Cap (Rose Gold Collar + Thermally Blued Pinion)
    el("circle", { r: "10.5", fill: "rgba(0,0,0,0.48)", transform: "translate(1.5, 2.2)" }, layer);
    el("circle", { r: "9.8", fill: "url(#grad-gold-chaton)", stroke: "#5c3f1c", "stroke-width": "0.7" }, layer);
    el("circle", { r: "5.4", fill: "url(#grad-blued-steel)", stroke: "#0b1936", "stroke-width": "0.5" }, layer);
    el("circle", { cx: "-1.5", cy: "-1.5", r: "1.6", fill: "rgba(215, 236, 255, 0.72)" }, layer);
  }

  /**
   * Layer 5 (Z = +5.40 mm): Sculpted 18k 5N Rose-Gold & Satin Titanium Case,
   * Curved Chamfered Lugs, Interactive Fluted Winding Crown, and Chamfered Sapphire Bezel.
   */
  _buildLayer5CaseBezelCrown(layer, extLayer) {
    // 3D Machined 18k 5N Rose-Gold Case Band, Lug Walls & Stepped Bezel Side-Wall for Layer 5
    const outerCaseExtD =
      "M 258 0 A 258 258 0 1 0 -258 0 A 258 258 0 1 0 258 0 Z " +
      "M 218 0 A 218 218 0 1 1 -218 0 A 218 218 0 1 1 218 0 Z";
    const lugExtPath =
      "M 78 228 C 86 246 88 272 86 292 C 88 298 96 300 105 297 C 118 292 128 274 134 248 C 142 222 154 202 172 184 L 146 168 C 122 192 98 212 78 228 Z";
    for (let s = 6; s >= 1; s--) {
      const gSlice = el("g", { transform: zExtrudeShift(s * 2.5) }, extLayer);
      for (const { sx, sy } of [{ sx: -1, sy: -1 }, { sx: 1, sy: -1 }, { sx: -1, sy: 1 }, { sx: 1, sy: 1 }]) {
        el("path", {
          d: lugExtPath,
          transform: `scale(${sx}, ${sy})`,
          fill: s === 6 ? "rgba(0,0,0,0.46)" : "url(#grad-extrude-rosegold)",
        }, gSlice);
      }
      el("rect", {
        x: "252",
        y: "-26",
        width: "26",
        height: "52",
        rx: "5.5",
        fill: s === 6 ? "rgba(0,0,0,0.44)" : "url(#grad-extrude-rosegold)",
      }, gSlice);
      el("path", {
        d: outerCaseExtD,
        "fill-rule": "evenodd",
        fill: s === 6 ? "rgba(0,0,0,0.52)" : "url(#grad-extrude-rosegold)",
        stroke: s === 5 ? "rgba(255, 232, 194, 0.36)" : "none",
        "stroke-width": "1.0",
      }, gSlice);
    }

    // 1. Sculpted Curved Chamfered Lugs (4 architectural horns at 12 & 6 o'clock)
    const lugCoords = [
      { sx: -1, sy: -1 },
      { sx: 1, sy: -1 },
      { sx: -1, sy: 1 },
      { sx: 1, sy: 1 },
    ];
    for (const { sx, sy } of lugCoords) {
      const lg = el("g", { transform: `scale(${sx}, ${sy})` }, layer);
      // Outer sculpted lug profile
      const lugOuter = "M 78 228 C 86 246 88 272 86 292 C 88 298 96 300 105 297 C 118 292 128 274 134 248 C 142 222 154 202 172 184 L 146 168 C 122 192 98 212 78 228 Z";
      el("path", { d: lugOuter, fill: "rgba(0,0,0,0.46)", transform: "translate(2, 4)" }, lg);
      el("path", { d: lugOuter, fill: "url(#grad-case-rosegold)", stroke: "#4f341b", "stroke-width": "1.0" }, lg);
      // Polished bevel facet along outer lug spine
      el("path", {
        d: "M 92 288 C 106 278 120 256 130 226 C 138 206 148 190 162 178",
        fill: "none",
        stroke: "rgba(255, 240, 214, 0.56)",
        "stroke-width": "1.6",
        "stroke-linecap": "round",
      }, lg);
    }

    // 2. Interactive Fluted Winding Crown & Protective Crown Guards (3 o'clock: x = +252..+278)
    const crownGroup = el("g", { id: "interactive-crown", class: "interactive-crown", "aria-label": "Drag to wind mainspring" }, layer);
    this.nodes.crownGroup = crownGroup;

    // Sculpted crown guards hugging the stem
    el("path", {
      d: "M 244 -48 C 258 -40 264 -32 262 -22 L 248 -20 Z M 244 48 C 258 40 264 32 262 22 L 248 20 Z",
      fill: "url(#grad-case-rosegold)",
      stroke: "#4c3219",
      "stroke-width": "0.9",
    }, crownGroup);

    // Crown stem neck
    el("rect", { x: "242", y: "-12", width: "14", height: "24", fill: "url(#grad-bezel-rhodium)", stroke: "#3b404c", "stroke-width": "0.7" }, crownGroup);

    // Main fluted rose-gold crown body
    el("rect", {
      x: "252",
      y: "-26",
      width: "26",
      height: "52",
      rx: "5.5",
      fill: "url(#grad-crown-metal)",
      stroke: "#4c3118",
      "stroke-width": "1.1",
    }, crownGroup);

    // Animated knurling flute ridges (scroll vertically when winding!)
    const fluteClip = el("g", { "clip-path": "url(#clip-crown-flutes)" }, crownGroup);
    const fluteTrack = el("g", { id: "crown-flutes" }, fluteClip);
    this.nodes.crownFlutes = fluteTrack;
    for (let y = -48; y <= 48; y += 6.5) {
      el("line", { x1: "253", y1: y.toFixed(1), x2: "277", y2: y.toFixed(1), stroke: "rgba(38, 22, 10, 0.72)", "stroke-width": "1.6" }, fluteTrack);
      el("line", { x1: "253", y1: (y + 1.8).toFixed(1), x2: "277", y2: (y + 1.8).toFixed(1), stroke: "rgba(255, 236, 206, 0.52)", "stroke-width": "1.0" }, fluteTrack);
    }

    // Domed crown outer cap edge glint
    el("path", {
      d: "M 277 -21 C 283 -14 283 14 277 21 Z",
      fill: "url(#grad-crown-metal)",
      stroke: "#4c3118",
      "stroke-width": "0.8",
    }, crownGroup);

    // 3. Multi-Stepped Sculpted Case & Concave Bezel Ring (evenodd, r = 218..258)
    const outerCaseD =
      "M 258 0 A 258 258 0 1 0 -258 0 A 258 258 0 1 0 258 0 Z " +
      "M 232 0 A 232 232 0 1 1 -232 0 A 232 232 0 1 1 232 0 Z";
    el("path", {
      d: outerCaseD,
      "fill-rule": "evenodd",
      fill: "url(#grad-case-rosegold)",
      stroke: "#4d321a",
      "stroke-width": "1.3",
    }, layer);

    // Inner stepped brushed rhodium/titanium bezel flange (r = 218..233)
    const innerBezelD =
      "M 233 0 A 233 233 0 1 0 -233 0 A 233 233 0 1 0 233 0 Z " +
      "M 218 0 A 218 218 0 1 1 -218 0 A 218 218 0 1 1 218 0 Z";
    el("path", {
      d: innerBezelD,
      "fill-rule": "evenodd",
      fill: "url(#grad-bezel-rhodium)",
      stroke: "#343942",
      "stroke-width": "1.0",
    }, layer);

    // Crisp specular chamfers along case step boundaries
    el("circle", { r: "256.5", fill: "none", stroke: "rgba(255, 236, 206, 0.34)", "stroke-width": "1.0" }, layer);
    el("circle", { r: "233", fill: "none", stroke: "rgba(255, 248, 236, 0.56)", "stroke-width": "1.1" }, layer);
    el("circle", { r: "218.4", fill: "none", stroke: "rgba(220, 232, 248, 0.42)", "stroke-width": "0.9" }, layer);

    // Subtle domed sapphire crystal optical glass layer (visible in CAD explode!)
    this.nodes.cadSapphireDome = el("circle", {
      r: "218",
      fill: "url(#grad-sapphire-dome-cad)",
      stroke: "rgba(220, 236, 255, 0.38)",
      "stroke-width": "1.2",
      style: "display:none",
    }, layer);

    // Subtle glass sapphire bezel highlight arc visible even when exploded in CAD mode!
    el("path", {
      d: "M -178 -126 A 218 218 0 0 1 128 -176",
      fill: "none",
      stroke: "rgba(226, 238, 255, 0.36)",
      "stroke-width": "2.2",
      "stroke-linecap": "round",
    }, layer);
  }

  _countMetrics() {
    let total = 0;
    for (const p of this.allPlanes) {
      total += p.querySelectorAll("*").length;
    }
    this.totalSvgElements = total;
  }

  /**
   * Updates only changed SVG attributes across the 4 GPU-composited planes
   * (static mainplate, bridges, dial & case stay GPU-cached at 0ms/frame in Hero & Macro!).
   */
  update(state, kinematics) {
    // 1. Apply camera viewBox across all 4 stacked SVG planes ONLY when changed!
    const vb = state.viewBox;
    const vbKey = `${vb.x.toFixed(2)} ${vb.y.toFixed(2)} ${vb.w.toFixed(2)} ${vb.h.toFixed(2)}`;
    if (vbKey !== this._lastViewBoxKey) {
      this._lastViewBoxKey = vbKey;
      for (const p of this.allPlanes) {
        p.setAttribute("viewBox", vbKey);
      }
    }

    // 2. Apply 6-Layer Exploded Isometric CAD transforms & 3D Extrusions ONLY when explode changes
    const e = state.explodeProgress;
    const eKey = e.toFixed(4);
    if (eKey !== this._lastExplodeKey) {
      this._lastExplodeKey = eKey;
      if (e > 0.0005) {
        const rotDeg = -30 * e;
        const scaleIso = 1 - 0.14 * e;
        const scaleY = (1 - 0.48 * e) * scaleIso;
        const extOpacity = Math.min(1, e * 1.45).toFixed(3);
        const xforms = state.layerZ.map(
          (z) => `translate(0, ${(z * e).toFixed(2)}) scale(${scaleIso.toFixed(4)}, ${scaleY.toFixed(4)}) rotate(${rotDeg.toFixed(2)})`
        );
        for (const b of this.layerBindings) {
          b.node.setAttribute("transform", xforms[b.layerIdx]);
        }
        for (const b of this.extrudeBindings) {
          b.node.style.display = "";
          b.node.setAttribute("opacity", extOpacity);
          b.node.setAttribute("transform", xforms[b.layerIdx]);
        }
        this.nodes.straps.setAttribute("opacity", Math.max(0, 1 - e * 2.4).toFixed(3));
        if (this.nodes.cadSapphireDome) {
          this.nodes.cadSapphireDome.style.display = "";
          this.nodes.cadSapphireDome.setAttribute("opacity", extOpacity);
        }
      } else {
        for (const b of this.layerBindings) {
          if (b.node.hasAttribute("transform")) b.node.removeAttribute("transform");
        }
        for (const b of this.extrudeBindings) {
          b.node.style.display = "none";
        }
        this.nodes.straps.setAttribute("opacity", "1");
        if (this.nodes.cadSapphireDome) {
          this.nodes.cadSapphireDome.style.display = "none";
        }
      }
    }

    // 3. Going Train Involute Gears (dirty-tracked)
    this._setRotIfChanged("barrel", this.nodes.barrel, kinematics.barrelAngleRad * RAD, 0.08);
    this._setRotIfChanged("center", this.nodes.center, kinematics.centerAngleRad * RAD, 0.06);
    this._setRotIfChanged("third", this.nodes.third, kinematics.thirdAngleRad * RAD, 0.04);

    // 4. 60-Second Tourbillon Carriage & Planetary Swiss Lever Escapement (compact 6 o'clock active region)
    this._setRotIfChanged("cage", this.nodes.tourbillonCage, kinematics.tourbillonAngleRad * RAD, 0.03);
    this._setRotIfChanged("escape", this.nodes.escapeWheel, kinematics.escapeLocalAngleRad * RAD, 0.05);
    this._setRotIfChanged("pallet", this.nodes.palletFork, kinematics.palletAngleDeg, 0.06);
    this._setRotIfChanged("balance", this.nodes.balanceWheel, kinematics.balanceAngleRad * RAD, 0.2);

    // 5. Breathing Phillips Overcoil Hairspring (1 single lightweight path DOM mutation per frame)
    const hsAngleQ = Math.round(kinematics.balanceAngleRad * 36) / 36;
    if (this._lastRot.hsAngle !== hsAngleQ) {
      this._lastRot.hsAngle = hsAngleQ;
      this.nodes.hairspring.setAttribute("d", generateHairspringPath(hsAngleQ));
    }

    // 6. Coiling Blued Mainspring & Winding Train (only mutated when winding/power reserve shifts)
    const prFrac = Math.max(0, Math.min(1, state.powerReserveHrs / 72));
    const windDeg = state.windingAngleDeg;
    const msKey = `${prFrac.toFixed(3)}_${(windDeg % 360).toFixed(1)}`;
    if (msKey !== this._lastMainspringKey) {
      this._lastMainspringKey = msKey;
      const msPath = generateMainspringPath(prFrac, (windDeg * 0.25) * DEG);
      this.nodes.mainspring.setAttribute("d", msPath);
      this.nodes.mainspringShadow.setAttribute("d", msPath);
      this.nodes.mainspringSheen.setAttribute("d", msPath);
    }

    this._setRotIfChanged("ratchet", this.nodes.ratchet, windDeg, 0.15);
    const cwDeg = -windDeg * (CALIBRE.ratchet.teeth / CALIBRE.crownWheel.teeth);
    const wiDeg = -cwDeg * (CALIBRE.crownWheel.teeth / CALIBRE.windingInter.teeth);
    this._setRotIfChanged("crownWheel", this.nodes.crownWheel, cwDeg, 0.15);
    this._setRotIfChanged("windingInter", this.nodes.windingInter, wiDeg, 0.15);

    const toothStep = 360 / CALIBRE.ratchet.teeth;
    const toothFrac = ((windDeg % toothStep) + toothStep) % toothStep / toothStep;
    const clickDeflect = state.windingVelocity > 0.05 ? -Math.sin(toothFrac * Math.PI) * 9.5 : 0;
    this._setRotIfChanged("clickArm", this.nodes.clickArm, clickDeflect, 0.2);

    const fluteShift = Math.round((((windDeg * 0.65) % 6.5 + 6.5) % 6.5 - 3.25) * 10) / 10;
    if (this._lastRot.fluteShift !== fluteShift) {
      this._lastRot.fluteShift = fluteShift;
      this.nodes.crownFlutes.setAttribute("transform", `translate(0, ${fluteShift.toFixed(1)})`);
    }

    // 7. 72-Hour Power Reserve Hand & Differential Gear (only mutates on top plane when changed!)
    const prAngleDeg = 58 - prFrac * 116;
    this._setRotIfChanged("prHand", this.nodes.prHand, prAngleDeg, 0.12);
    this._setRotIfChanged("prGear", this.nodes.prGear, prFrac * 180, 0.15);

    // 8. Skeletonized Breguet Hour & Minute Hands (quantized so top GPU plane stays cached >95% of frames!)
    const displaySec = state.baseClockSeconds + kinematics.steppedSeconds;
    const minDeg = ((displaySec / 3600) * 360 - 90) % 360;
    const hourDeg = ((displaySec / 43200) * 360 - 90) % 360;
    this._setRotIfChanged("minHand", this.nodes.minuteHand, minDeg, 0.10);
    this._setRotIfChanged("hourHand", this.nodes.hourHand, hourDeg, 0.08);
  }
}
