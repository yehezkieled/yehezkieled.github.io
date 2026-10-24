/*
  The 3D room. Everything here is built from primitives and canvas-drawn
  pixel textures at load time; nothing is downloaded except three.js.

  Hotspots (clickable section objects):
    PC on the desk        -> about
    badge case on wall    -> work
    TV + console          -> projects
    red handheld on desk  -> posts
    phone on nightstand   -> online
  The shelf balls are decorative and wobble when clicked.
  See README.md for pet interactions and camera controls.
*/
import * as THREE from "../vendor/three/three.module.min.js";

const SITE = window.SITE || {};
const PA = window.PA;
const REDUCED = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const RENDER_SCALE = 0.62; // internal resolution vs CSS pixels: chunky, fast, retro

/* ------------------------------------------------------------------ */
/* DOM                                                                 */
/* ------------------------------------------------------------------ */
const $ = (id) => document.getElementById(id);
const stage = $("stage");
const hint = $("hint");
const toast = $("toast");
const panel = $("panel");
const panelTitle = $("panel-title");
const panelBody = $("panel-body");
const panelClose = $("panel-close");
const loader = $("loader");
const barFill = $("bar-fill");
const loaderPct = $("loader-pct");
const loaderStatus = $("loader-status");
const announce = $("announce");
const navLinks = Array.from(document.querySelectorAll("[data-go]"));

document.title = (SITE.name || "Site") + " · Pocket Room";

/* ------------------------------------------------------------------ */
/* Loader                                                              */
/* ------------------------------------------------------------------ */
const STEPS = [
  "Warming up the TV",
  "Painting pixel textures",
  "Building the room",
  "Moving the furniture in",
  "Plugging in the PC and TV",
  "Waking up Piplup and Gible",
  "Turning on the lights",
  "Tuning the picture",
];
let stepIndex = 0;
function progress(label) {
  stepIndex++;
  const pct = Math.min(100, Math.round((stepIndex / STEPS.length) * 100));
  barFill.style.width = pct + "%";
  loaderPct.textContent = String(pct);
  loaderStatus.textContent = label || STEPS[stepIndex] || "Ready";
  return new Promise((r) => requestAnimationFrame(() => setTimeout(r, REDUCED ? 0 : 60)));
}

function failToPlain(why) {
  loaderStatus.textContent = why;
  loaderStatus.style.color = "#ff6b57";
  setTimeout(() => location.replace("plain/" + location.hash), 1200);
}

/* ------------------------------------------------------------------ */
/* Pixel font (3x5) for in-scene screens                               */
/* ------------------------------------------------------------------ */
const GLYPHS = {
  A: "010101111101101", B: "110101110101110", C: "011100100100011", D: "110101101101110",
  E: "111100110100111", F: "111100110100100", G: "011100101101011", H: "101101111101101",
  I: "111010010010111", J: "001001001101010", K: "101101110101101", L: "100100100100111",
  M: "101111111101101", N: "110101101101101", O: "010101101101010", P: "110101110100100",
  Q: "010101101110011", R: "110101110101101", S: "011100010001110", T: "111010010010010",
  U: "101101101101111", V: "101101101101010", W: "101101111111101", X: "101101010101101",
  Y: "101101010010010", Z: "111001010100111", "0": "111101101101111", "1": "010110010010111",
  "2": "111001111100111", "3": "111001111001111", "4": "101101111001001", "5": "111100111001111",
  "6": "111100111101111", "7": "111001001001001", "8": "111101111101111", "9": "111101111001111",
  " ": "000000000000000", ".": "000000000000010", "-": "000000111000000", ">": "100010001010100",
  "!": "010010010000010", ":": "000010000010000", "/": "001001010100100", "'": "010010000000000",
};
function drawText(ctx, text, x, y, s, color) {
  ctx.fillStyle = color;
  let cx = x;
  for (const chRaw of String(text).toUpperCase()) {
    const g = GLYPHS[chRaw] || GLYPHS[" "];
    for (let i = 0; i < 15; i++) {
      if (g[i] === "1") ctx.fillRect(cx + (i % 3) * s, y + Math.floor(i / 3) * s, s, s);
    }
    cx += 4 * s;
  }
}

/* ------------------------------------------------------------------ */
/* Textures                                                            */
/* ------------------------------------------------------------------ */
function makeTex(w, h, draw, repeat, smoothed) {
  const c = document.createElement("canvas");
  c.width = w; c.height = h;
  const ctx = c.getContext("2d");
  ctx.imageSmoothingEnabled = false;
  draw(ctx, w, h);
  const t = new THREE.CanvasTexture(c);
  // room textures stay chunky pixels; pet skins are sampled smoothly
  t.magFilter = smoothed ? THREE.LinearFilter : THREE.NearestFilter;
  t.minFilter = smoothed ? THREE.LinearMipmapLinearFilter : THREE.NearestFilter;
  t.generateMipmaps = !!smoothed;
  t.colorSpace = THREE.SRGBColorSpace;
  if (repeat) {
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(repeat[0], repeat[1]);
  }
  return t;
}

/* Day or night: the visitor's clock decides unless they toggled it before. */
const DAYLIGHT_KEY = "pa-daylight";
function storedDaylight() {
  try { return localStorage.getItem(DAYLIGHT_KEY); } catch (_) { return null; }
}
const hour = new Date().getHours();
let night = storedDaylight() ? storedDaylight() === "night" : hour < 7 || hour >= 18;
let nightMix = night ? 1 : 0;   // 0 = day, 1 = night; eases toward `night`

const TEX = {};
function buildTextures() {
  TEX.wall = makeTex(32, 32, (ctx) => {
    ctx.fillStyle = "#8d93d6"; ctx.fillRect(0, 0, 32, 32);
    ctx.fillStyle = "#9aa0e0";
    for (let y = 0; y < 32; y += 8) for (let x = 0; x < 32; x += 8) {
      ctx.fillRect(x + 3, y + 2, 2, 1); ctx.fillRect(x + 2, y + 3, 4, 1);
      ctx.fillRect(x + 3, y + 4, 2, 1);
    }
    ctx.fillStyle = "#7f86cc";
    for (let y = 4; y < 32; y += 8) for (let x = 4; x < 32; x += 8) ctx.fillRect(x + 3, y + 3, 1, 1);
  }, [6, 3]);

  TEX.floor = makeTex(64, 64, (ctx) => {
    const tones = ["#b47a4c", "#ad7244", "#b98052", "#b07548", "#bb8355", "#aa6f42", "#b67c4e", "#b17647"];
    for (let r = 0; r < 8; r++) {
      const y = r * 8;
      ctx.fillStyle = tones[r]; ctx.fillRect(0, y, 64, 8);
      ctx.fillStyle = "#7d4f2c"; ctx.fillRect(0, y + 7, 64, 1);
      const joint = (r * 23 + 9) % 64;
      ctx.fillRect(joint, y, 1, 7);
      ctx.fillStyle = "#c48a5a";
      ctx.fillRect((joint + 12) % 64, y + 2, 6, 1);
      ctx.fillRect((joint + 40) % 64, y + 4, 4, 1);
      ctx.fillStyle = "#9c6238";
      ctx.fillRect((joint + 26) % 64, y + 5, 3, 1);
    }
  }, [3, 3]);

  TEX.rug = makeTex(64, 64, (ctx) => {
    const cols = ["#ff6b57", "#fff8ee", "#1f9c8e", "#fff8ee", "#ffd24d", "#fff8ee", "#ff6b57"];
    for (let i = 0; i < 7; i++) {
      ctx.fillStyle = cols[i];
      ctx.beginPath(); ctx.arc(32, 32, 32 - i * 4, 0, Math.PI * 2); ctx.fill();
    }
    ctx.fillStyle = "#2b2640";
    for (let a = 0; a < 16; a++) {
      const x = Math.round(32 + Math.cos((a / 16) * Math.PI * 2) * 22);
      const y = Math.round(32 + Math.sin((a / 16) * Math.PI * 2) * 22);
      ctx.fillRect(x, y, 2, 2);
    }
  });

  TEX.blanket = makeTex(32, 32, (ctx) => {
    for (let y = 0; y < 32; y += 8) for (let x = 0; x < 32; x += 8) {
      ctx.fillStyle = ((x + y) / 8) % 2 ? "#ff6b57" : "#ffb3a7";
      ctx.fillRect(x, y, 8, 8);
    }
    ctx.fillStyle = "#fff8ee";
    for (let y = 2; y < 32; y += 8) for (let x = 2; x < 32; x += 8) ctx.fillRect(x + 2, y + 2, 1, 1);
  }, [3, 4]);

  TEX.skyNight = makeTex(64, 56, (ctx) => {
    const g = ctx.createLinearGradient(0, 0, 0, 56);
    g.addColorStop(0, "#0b0a2a"); g.addColorStop(1, "#2a2460");
    ctx.fillStyle = g; ctx.fillRect(0, 0, 64, 56);
    ctx.fillStyle = "#fff8ee";
    const stars = [[5, 6], [14, 3], [22, 10], [31, 5], [40, 12], [52, 4], [58, 14], [9, 20], [27, 22], [47, 24], [60, 30], [18, 30]];
    for (const [x, y] of stars) ctx.fillRect(x, y, 1, 1);
    ctx.fillStyle = "#ffe9a8";
    ctx.beginPath(); ctx.arc(46, 14, 7, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "#1c1848";
    ctx.beginPath(); ctx.arc(49, 12, 6, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "#2f2a68";
    for (let x = 0; x < 64; x += 6) { const h = 6 + ((x * 7) % 11); ctx.fillRect(x, 56 - h, 5, h); }
    ctx.fillStyle = "#ffd24d";
    for (let x = 2; x < 64; x += 6) if ((x * 3) % 5 !== 0) ctx.fillRect(x, 48 + (x % 4), 1, 1);
  });
  TEX.skyDay = makeTex(64, 56, (ctx) => {
    const g = ctx.createLinearGradient(0, 0, 0, 56);
    g.addColorStop(0, "#5fa8ff"); g.addColorStop(1, "#bfe4ff");
    ctx.fillStyle = g; ctx.fillRect(0, 0, 64, 56);
    ctx.fillStyle = "#fff8ee";
    for (const [x, y, w] of [[6, 10, 14], [30, 6, 18], [44, 20, 12], [12, 26, 10]]) {
      ctx.fillRect(x, y, w, 4); ctx.fillRect(x + 3, y - 3, w - 6, 3); ctx.fillRect(x + 2, y + 4, w - 4, 2);
    }
    ctx.fillStyle = "#6fcf7f";
    for (let x = 0; x < 64; x += 6) { const h = 5 + ((x * 5) % 7); ctx.fillRect(x, 56 - h, 6, h); }
  });

  TEX.pc = screenTex(["PLAYER", "PROFILE", "", "> ABOUT"], "#4fd1c5", "#0d1b2a");
  TEX.tv = screenTex(["ROSTER", "", "PRESS A", "> PROJECTS"], "#ffd24d", "#1c1040");
  TEX.dex = screenTex(["LOG", "", "> POSTS"], "#ff6b57", "#101418");

  TEX.poster = makeTex(48, 64, (ctx) => {
    ctx.fillStyle = "#1c1040"; ctx.fillRect(0, 0, 48, 64);
    ctx.fillStyle = "#ffd24d";
    for (let i = 0; i < 48; i += 4) ctx.fillRect(i, 0, 2, 2);
    drawText(ctx, "RUMBLE", 5, 6, 1, "#fff8ee");
    drawText(ctx, "ARENA", 7, 13, 1, "#ff6b57");
    // two fighters: teal blob vs coral blob, hand-drawn blocks
    ctx.fillStyle = "#4fd1c5";
    ctx.fillRect(8, 30, 10, 12); ctx.fillRect(6, 34, 2, 4); ctx.fillRect(18, 32, 3, 3);
    ctx.fillRect(10, 42, 3, 6); ctx.fillRect(14, 42, 3, 6);
    ctx.fillStyle = "#ff6b57";
    ctx.fillRect(30, 28, 10, 12); ctx.fillRect(27, 30, 3, 3); ctx.fillRect(40, 32, 2, 4);
    ctx.fillRect(31, 40, 3, 7); ctx.fillRect(36, 40, 3, 7);
    ctx.fillStyle = "#2b2640";
    ctx.fillRect(11, 33, 2, 2); ctx.fillRect(15, 33, 2, 2); ctx.fillRect(33, 31, 2, 2); ctx.fillRect(37, 31, 2, 2);
    drawText(ctx, "VS", 20, 34, 1, "#ffd24d");
    drawText(ctx, "FAN MADE", 7, 54, 1, "#9aa0e0");
  });

  TEX.caseFelt = makeTex(16, 16, (ctx) => {
    ctx.fillStyle = "#1f3b44"; ctx.fillRect(0, 0, 16, 16);
    ctx.fillStyle = "#244a52";
    for (let y = 0; y < 16; y += 4) for (let x = 0; x < 16; x += 4) ctx.fillRect(x + (y / 4) % 2, y, 1, 1);
  }, [4, 3]);

  buildPetTextures();
}

/*
  Pet skins are small pixel-art canvases, sampled with nearest filtering so the
  pixels stay crisp up close (mipmaps keep them calm at a distance). Body skins
  wrap a SphereGeometry: canvas x runs around the body (u = 0.25 is the front,
  0.75 the back), canvas y runs top to bottom.
*/
const PIP = { light: "#9bd8ee", dark: "#2d62b5", edge: "#214c95", eye: "#15285e", eyeLit: "#2f6cc8", beak: "#f2c23c", white: "#f7fbff", ring: "#4a86c4", mouth: "#b8323f" };
const GIB = { blue: "#4f84a3", dark: "#3b6682", belly: "#d8402e", bellyEdge: "#b2302a", mouth: "#4d1522", tongue: "#f06a8a", eye: "#1e2538", spot: "#f2d14a" };
const PINK = "#f49ab2";

function pixelTex(w, h, draw) {
  const t = makeTex(w, h, draw);
  t.minFilter = THREE.LinearMipmapLinearFilter;
  t.generateMipmaps = true;
  return t;
}
// Pixel-art helpers: everything is whole pixels on a small canvas.
function pxEllipse(ctx, cx, cy, rx, ry, fill, outline) {
  const inside = (x, y, ax, ay) => ((x + 0.5 - cx) / ax) ** 2 + ((y + 0.5 - cy) / ay) ** 2 <= 1;
  for (let y = Math.floor(cy - ry - 1); y <= Math.ceil(cy + ry + 1); y++) {
    for (let x = Math.floor(cx - rx - 1); x <= Math.ceil(cx + rx + 1); x++) {
      if (inside(x, y, rx, ry)) { ctx.fillStyle = fill; ctx.fillRect(x, y, 1, 1); }
      else if (outline && inside(x, y, rx + 1, ry + 1)) { ctx.fillStyle = outline; ctx.fillRect(x, y, 1, 1); }
    }
  }
}
function pxStar(ctx, x, y, arm, color) {   // a four-point sparkle
  ctx.fillStyle = color;
  ctx.fillRect(x - arm, y, arm * 2 + 1, 1);
  ctx.fillRect(x, y - arm, 1, arm * 2 + 1);
}
// A big sparkle eye: outline ring, dark iris, a lighter lower half and starry catchlights. `s` mirrors it.
function eyeTex(w, h, s, c) {
  return pixelTex(w, h, (ctx) => {
    ctx.clearRect(0, 0, w, h);
    const cx = w / 2, cy = h / 2;
    pxEllipse(ctx, cx, cy, w / 2 - 1.5, h / 2 - 1.5, c.iris, c.ring);
    pxEllipse(ctx, cx + s * 1, cy + h * 0.16, w * 0.26, h * 0.24, c.lit);
    pxStar(ctx, Math.round(cx - s * 2.5), Math.round(cy - h * 0.2), 2, c.spark);
    ctx.fillStyle = c.spark;
    ctx.fillRect(Math.round(cx - s * 3), Math.round(cy - h * 0.2) - 1, 2, 2);
    pxStar(ctx, Math.round(cx + s * 2.5), Math.round(cy + h * 0.2), 1, c.spark);
  });
}
function blushTex() {
  return pixelTex(12, 8, (ctx, w, h) => { ctx.clearRect(0, 0, w, h); pxEllipse(ctx, 6, 4, 4.5, 2.5, PINK); });
}

function buildPetTextures() {
  // Piplup head: dark cap and sides, white face with a zigzag edge and a dark peak between the eyes.
  TEX.pipHead = pixelTex(128, 64, (ctx, w, h) => {
    ctx.fillStyle = PIP.dark; ctx.fillRect(0, 0, w, h);
    const zig = [0, 1, 2, 1];
    for (let x = 4; x < 61; x++) {
      const d = Math.abs(x - 32);
      let top = 22 + zig[x % 4];
      if (d < 6) top = Math.max(top, 34 - d * 2);            // the peak dips to the beak
      if (d > 22) top += (d - 22) * 2;                        // cheeks round off toward the ears
      const bottom = 56 - Math.max(0, d - 18) * 1.4;
      if (bottom <= top) continue;
      ctx.fillStyle = PIP.edge; ctx.fillRect(x, top - 1, 1, 1);
      ctx.fillStyle = PIP.white; ctx.fillRect(x, top, 1, bottom - top);
    }
  });

  // Piplup body: light blue with a scalloped dark collar, a cape down the back and two ringed chest marks.
  TEX.pipBody = pixelTex(128, 64, (ctx, w, h) => {
    ctx.fillStyle = PIP.light; ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = PIP.dark; ctx.fillRect(0, 0, w, 11);
    for (let i = 0; i < 13; i++) pxEllipse(ctx, i * 10 + 5, 11, 4.5, 4.5, PIP.dark);
    for (let x = 66; x < 126; x++) {                          // cape: a pointed dark panel on the back
      const d = Math.abs(x - 96);
      const bottom = 42 - Math.max(0, d - 8) * 1.6;
      if (bottom > 11) ctx.fillRect(x, 11, 1, bottom - 11);
    }
    for (const cx of [24, 40]) pxEllipse(ctx, cx, 36, 5, 5, PIP.white, PIP.ring);
  });
  TEX.pipEyeL = eyeTex(14, 18, -1, { iris: PIP.eye, ring: "#c8e9f8", lit: PIP.eyeLit, spark: PIP.white });
  TEX.pipEyeR = eyeTex(14, 18, 1, { iris: PIP.eye, ring: "#c8e9f8", lit: PIP.eyeLit, spark: PIP.white });
  TEX.blush = blushTex();

  // Gible jaw: the whole lower front is red, with a blue rim at the hinges.
  TEX.gibJaw = pixelTex(64, 32, (ctx, w, h) => {
    ctx.fillStyle = GIB.blue; ctx.fillRect(0, 0, w, h);
    for (let y = 0; y < h; y++) {
      const rim = Math.max(0, 7 - Math.floor(y / 3));
      ctx.fillStyle = GIB.bellyEdge; ctx.fillRect(rim, y, 1, 1); ctx.fillRect(w - rim - 1, y, 1, 1);
      ctx.fillStyle = GIB.belly; ctx.fillRect(rim + 1, y, w - rim * 2 - 2, 1);
    }
  });
  // Gible teeth: a strip of pixel triangles, drawn pointing down; the lower row flips it.
  TEX.gibTeeth = pixelTex(128, 8, (ctx, w, h) => {
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = "#fff8ee";
    for (let x = 0; x < w; x++) {
      const t = x % 8, half = t < 4 ? t + 1 : 8 - t;      // 1,2,3,4,4,3,2,1 pixels tall
      ctx.fillRect(x, 0, 1, half * 2 - 1);
    }
  });
  // Gible side jets: slate with two yellow spots on the outer side.
  TEX.gibJet = pixelTex(64, 32, (ctx, w, h) => {
    ctx.fillStyle = GIB.blue; ctx.fillRect(0, 0, w, h);
    pxEllipse(ctx, 32, 11, 3, 3, GIB.spot);
    pxEllipse(ctx, 33, 21, 2.5, 2, GIB.spot);
  });
  // the anger mark: four red lobes around a gap
  TEX.angry = pixelTex(16, 16, (ctx, w, h) => {
    ctx.clearRect(0, 0, w, h);
    for (const [x, y] of [[5, 5], [11, 5], [5, 11], [11, 11]]) pxEllipse(ctx, x, y, 2.5, 2.5, "#e0423a", "#8e1f1f");
    ctx.clearRect(7, 0, 2, h); ctx.clearRect(0, 7, w, 2);
  });
  TEX.gibEyeL = eyeTex(14, 14, -1, { iris: GIB.eye, ring: "#2f3d58", lit: "#3a4668", spark: PIP.white });
  TEX.gibEyeR = eyeTex(14, 14, 1, { iris: GIB.eye, ring: "#2f3d58", lit: "#3a4668", spark: PIP.white });
}

function screenTex(lines, accent, bg) {
  return makeTex(64, 48, (ctx) => {
    ctx.fillStyle = bg; ctx.fillRect(0, 0, 64, 48);
    ctx.fillStyle = accent; ctx.fillRect(0, 0, 64, 7);
    drawText(ctx, "POCKET", 3, 1, 1, bg);
    ctx.fillStyle = "rgba(255,255,255,0.06)";
    for (let y = 8; y < 48; y += 2) ctx.fillRect(0, y, 64, 1);
    lines.forEach((l, i) => drawText(ctx, l, 4, 11 + i * 8, 1, i === lines.length - 1 ? accent : "#d7ecff"));
    ctx.fillStyle = accent; ctx.fillRect(56, 40, 4, 5);
  });
}

/* ------------------------------------------------------------------ */
/* Scene                                                               */
/* ------------------------------------------------------------------ */
let renderer, scene, camera;
const hotspots = [];   // { key, group, label, pose }
const toys = [];       // shelf balls: { group, baseY, t }
const MAT = {};

function mat(color, opts) {
  return new THREE.MeshLambertMaterial(Object.assign({ color }, opts || {}));
}
function box(w, h, d, material, x, y, z) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
  m.position.set(x || 0, y || 0, z || 0);
  m.castShadow = true; m.receiveShadow = true;
  return m;
}
function cyl(rt, rb, h, material, x, y, z, seg) {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg || 10), material);
  m.position.set(x || 0, y || 0, z || 0);
  m.castShadow = true; m.receiveShadow = true;
  return m;
}
function ball(r, material, x, y, z, seg, hseg) {
  const m = new THREE.Mesh(new THREE.SphereGeometry(r, seg || 10, hseg || seg || 8), material);
  m.position.set(x || 0, y || 0, z || 0);
  m.castShadow = true; m.receiveShadow = true;
  return m;
}
function plane(w, h, material, x, y, z) {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), material);
  m.position.set(x || 0, y || 0, z || 0);
  m.receiveShadow = true;
  return m;
}

function buildMaterials() {
  MAT.wood = mat("#b47a4c");
  MAT.woodDark = mat("#7d4f2c");
  MAT.cream = mat("#fff8ee");
  MAT.ink = mat("#2b2640");
  MAT.grey = mat("#8a86a3");
  MAT.greyDark = mat("#5e5a7a");
  MAT.teal = mat("#1f9c8e");
  MAT.tealLight = mat("#4fd1c5");
  MAT.coral = mat("#ff6b57");
  MAT.amber = mat("#ffd24d");
  MAT.red = mat("#e0423a");
  MAT.green = mat("#4fae63");
  MAT.greenDark = mat("#2f7d47");
  MAT.pot = mat("#c96a4a");
  MAT.wall = mat("#ffffff", { map: TEX.wall });
  MAT.floor = mat("#ffffff", { map: TEX.floor });
  MAT.rug = mat("#ffffff", { map: TEX.rug, transparent: true, alphaTest: 0.5 });
  MAT.blanket = mat("#ffffff", { map: TEX.blanket });
  MAT.skyDay = new THREE.MeshBasicMaterial({ map: TEX.skyDay });
  MAT.skyNight = new THREE.MeshBasicMaterial({ map: TEX.skyNight, transparent: true, opacity: nightMix });
  MAT.pc = new THREE.MeshBasicMaterial({ map: TEX.pc });
  MAT.tv = new THREE.MeshBasicMaterial({ map: TEX.tv });
  MAT.dex = new THREE.MeshBasicMaterial({ map: TEX.dex });
  MAT.poster = mat("#ffffff", { map: TEX.poster });
  MAT.felt = mat("#ffffff", { map: TEX.caseFelt });
  // pets: flat-shaded facets, pixel skins
  const pmat = (color, opts) => mat(color, Object.assign({ flatShading: true }, opts || {}));
  const decal = (map) => pmat("#ffffff", { map, transparent: true, alphaTest: 0.5, side: THREE.DoubleSide });
  MAT.pipBody = pmat("#ffffff", { map: TEX.pipBody });
  MAT.pipHead = pmat("#ffffff", { map: TEX.pipHead });
  MAT.pipLight = pmat(PIP.light);
  MAT.pipDark = pmat(PIP.dark);
  MAT.pipMouth = pmat(PIP.mouth);
  MAT.pipEyeL = decal(TEX.pipEyeL);
  MAT.pipEyeR = decal(TEX.pipEyeR);
  MAT.blush = decal(TEX.blush);
  MAT.beak = pmat(PIP.beak);
  MAT.gibBlue = pmat(GIB.blue);
  MAT.gibDark = pmat(GIB.dark);
  MAT.gibJaw = pmat("#ffffff", { map: TEX.gibJaw });
  MAT.gibJet = pmat("#ffffff", { map: TEX.gibJet });
  MAT.gibMouth = pmat(GIB.mouth, { side: THREE.DoubleSide });
  MAT.gibTongue = pmat(GIB.tongue);
  MAT.gibTeeth = decal(TEX.gibTeeth);
  MAT.gibEyeL = decal(TEX.gibEyeL);
  MAT.gibEyeR = decal(TEX.gibEyeR);
  MAT.angry = new THREE.SpriteMaterial({ map: TEX.angry, transparent: true, alphaTest: 0.5 });
  MAT.water = pmat("#5fc8ff", { transparent: true, opacity: 0.85 });
  MAT.spark = pmat("#fff3c4", { emissive: new THREE.Color("#ffd24d"), emissiveIntensity: 0.6 });
}

function buildRoom() {
  const floor = plane(6, 6, MAT.floor, 0, 0, 0);
  floor.rotation.x = -Math.PI / 2;
  scene.add(floor);

  const back = plane(6, 3, MAT.wall, 0, 1.5, -3);
  scene.add(back);
  const left = plane(6, 3, MAT.wall, -3, 1.5, 0);
  left.rotation.y = Math.PI / 2;
  scene.add(left);

  // baseboards
  scene.add(box(6, 0.12, 0.04, MAT.cream, 0, 0.06, -2.98));
  scene.add(box(0.04, 0.12, 6, MAT.cream, -2.98, 0.06, 0));

  // rug
  const rug = plane(2.4, 2.4, MAT.rug, 0.3, 0.012, 0.3);
  rug.rotation.x = -Math.PI / 2;
  scene.add(rug);

  // window above the bed (back wall)
  const win = new THREE.Group();
  win.position.set(-1.9, 1.95, -2.99);
  win.add(plane(1.3, 1.1, MAT.skyDay, 0, 0, 0));
  win.add(plane(1.3, 1.1, MAT.skyNight, 0, 0, 0.004));   // fades in over the day sky
  win.add(box(1.42, 0.08, 0.06, MAT.cream, 0, 0.59, 0.02));
  win.add(box(1.42, 0.08, 0.06, MAT.cream, 0, -0.59, 0.02));
  win.add(box(0.08, 1.26, 0.06, MAT.cream, -0.67, 0, 0.02));
  win.add(box(0.08, 1.26, 0.06, MAT.cream, 0.67, 0, 0.02));
  win.add(box(0.05, 1.1, 0.03, MAT.cream, 0, 0, 0.015));
  win.add(box(1.3, 0.05, 0.03, MAT.cream, 0, 0, 0.015));
  // curtains
  win.add(box(0.26, 1.4, 0.1, MAT.tealLight, -0.82, 0, 0.06));
  win.add(box(0.26, 1.4, 0.1, MAT.tealLight, 0.82, 0, 0.06));
  win.add(cyl(0.025, 0.025, 1.95, MAT.woodDark, 0, 0.72, 0.08).rotateZ(Math.PI / 2));
  scene.add(win);

  // poster on the left wall above the TV
  const poster = plane(0.6, 0.8, MAT.poster, -2.985, 1.9, 1.1);
  poster.rotation.y = Math.PI / 2;
  scene.add(poster);

  // small shelf on the back wall with three balls
  const shelf = new THREE.Group();
  shelf.position.set(-0.2, 2.05, -2.85);
  shelf.add(box(1.2, 0.05, 0.28, MAT.wood, 0, 0, 0));
  shelf.add(box(0.05, 0.14, 0.2, MAT.woodDark, -0.5, -0.09, 0.02));
  shelf.add(box(0.05, 0.14, 0.2, MAT.woodDark, 0.5, -0.09, 0.02));
  [-0.38, 0, 0.38].forEach((x, i) => {
    const b = monsterBall(i);
    b.position.set(x, 0.13, 0.02);
    shelf.add(b);
    toys.push({ group: b, baseY: 0.13, t: 0 });
  });
  scene.add(shelf);

  // potted plant in the front-left corner
  const plant = new THREE.Group();
  plant.position.set(-2.45, 0, 2.35);
  plant.add(cyl(0.2, 0.15, 0.32, MAT.pot, 0, 0.16, 0, 8));
  plant.add(cyl(0.21, 0.21, 0.05, MAT.pot, 0, 0.32, 0, 8));
  plant.add(cyl(0.03, 0.03, 0.5, MAT.greenDark, 0, 0.55, 0, 6));
  [[0.15, 0.78, 0.05, 0.14], [-0.14, 0.72, -0.04, 0.13], [0.02, 0.9, -0.12, 0.12], [0, 0.95, 0.12, 0.11]].forEach(([x, y, z, r]) => {
    const leaf = ball(r, MAT.green, x, y, z, 7);
    leaf.scale.set(1.3, 0.6, 1);
    plant.add(leaf);
  });
  scene.add(plant);
}

function monsterBall(i) {
  const g = new THREE.Group();
  const tops = [MAT.coral, MAT.tealLight, MAT.amber];
  const top = new THREE.Mesh(new THREE.SphereGeometry(0.11, 12, 6, 0, Math.PI * 2, 0, Math.PI / 2), tops[i % 3]);
  const bottom = new THREE.Mesh(new THREE.SphereGeometry(0.11, 12, 6, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), MAT.cream);
  top.castShadow = bottom.castShadow = true;
  const band = new THREE.Mesh(new THREE.TorusGeometry(0.108, 0.014, 6, 16), MAT.ink);
  band.rotation.x = Math.PI / 2;
  const button = cyl(0.03, 0.03, 0.02, MAT.ink, 0, 0, 0.105, 10);
  button.rotation.x = Math.PI / 2;
  const btnIn = cyl(0.018, 0.018, 0.012, MAT.cream, 0, 0, 0.115, 10);
  btnIn.rotation.x = Math.PI / 2;
  g.add(top, bottom, band, button, btnIn);
  return g;
}

function buildFurniture() {
  // bed, head against the back wall, under the window
  const bed = new THREE.Group();
  bed.position.set(-1.9, 0, -1.9);
  bed.add(box(1.45, 0.28, 2.15, MAT.wood, 0, 0.2, 0));
  bed.add(box(1.5, 0.5, 0.08, MAT.wood, 0, 0.38, -1.07));
  bed.add(box(1.5, 0.36, 0.08, MAT.wood, 0, 0.3, 1.07));
  bed.add(box(1.32, 0.22, 2.0, MAT.cream, 0, 0.45, 0));
  const blanket = box(1.36, 0.1, 1.25, MAT.blanket, 0, 0.6, 0.35);
  bed.add(blanket);
  bed.add(box(0.86, 0.16, 0.42, MAT.cream, 0, 0.62, -0.7));
  scene.add(bed);

  // nightstand with phone (ONLINE)
  scene.add(box(0.5, 0.56, 0.5, MAT.wood, -2.65, 0.28, -0.35));
  scene.add(box(0.44, 0.04, 0.44, MAT.woodDark, -2.65, 0.3, -0.35));
  scene.add(box(0.08, 0.03, 0.03, MAT.amber, -2.4, 0.3, -0.35));
  const phone = new THREE.Group();
  phone.position.set(-2.62, 0.56, -0.35);
  phone.add(box(0.3, 0.09, 0.24, MAT.cream, 0, 0.045, 0));
  phone.add(box(0.24, 0.02, 0.18, MAT.teal, 0, 0.1, 0));
  const hs = box(0.34, 0.06, 0.09, MAT.coral, 0, 0.14, -0.06);
  phone.add(hs);
  phone.add(ball(0.045, MAT.coral, -0.15, 0.14, -0.06, 8));
  phone.add(ball(0.045, MAT.coral, 0.15, 0.14, -0.06, 8));
  for (let i = 0; i < 4; i++) phone.add(box(0.03, 0.015, 0.03, MAT.ink, -0.05 + i * 0.035, 0.1, 0.06));
  const cord = new THREE.Mesh(new THREE.TorusGeometry(0.05, 0.012, 5, 10, Math.PI), MAT.ink);
  cord.position.set(0.16, 0.03, 0.1); cord.rotation.y = Math.PI / 2;
  phone.add(cord);
  scene.add(phone);
  hotspot("online", phone, { target: [-2.6, 0.7, -0.35], pos: [-0.9, 1.6, 0.95] });

  // TV stand along the left wall with CRT and the console (PROJECTS)
  const stand = new THREE.Group();
  stand.position.set(-2.55, 0, 1.1);
  stand.add(box(0.6, 0.5, 1.5, MAT.wood, 0, 0.25, 0));
  stand.add(box(0.62, 0.05, 1.54, MAT.woodDark, 0, 0.5, 0));
  stand.add(box(0.5, 0.16, 0.45, MAT.woodDark, 0.02, 0.33, -0.25));
  stand.add(box(0.5, 0.16, 0.45, MAT.woodDark, 0.02, 0.33, 0.25));
  scene.add(stand);

  const tv = new THREE.Group();
  tv.position.set(-2.5, 0.52, 1.0);
  tv.rotation.y = -0.35;
  tv.add(box(0.6, 0.56, 0.7, MAT.greyDark, 0, 0.28, 0));
  tv.add(box(0.05, 0.5, 0.64, MAT.grey, 0.3, 0.3, 0));
  const tvScreen = plane(0.48, 0.38, MAT.tv, 0.33, 0.32, -0.06);
  tvScreen.rotation.y = Math.PI / 2;
  tv.add(tvScreen);
  tv.add(cyl(0.025, 0.025, 0.02, MAT.ink, 0.33, 0.12, 0.26, 8).rotateX(Math.PI / 2));
  tv.add(cyl(0.025, 0.025, 0.02, MAT.coral, 0.33, 0.12, 0.2, 8).rotateX(Math.PI / 2));
  for (let i = 0; i < 6; i++) tv.add(box(0.005, 0.02, 0.03, MAT.ink, 0.328, 0.5 - i * 0.06, 0.28));
  tv.add(cyl(0.012, 0.012, 0.5, MAT.ink, -0.1, 0.75, -0.2, 6).rotateZ(0.5));
  tv.add(cyl(0.012, 0.012, 0.5, MAT.ink, -0.1, 0.75, 0.2, 6).rotateZ(-0.5));
  // handheld console and two cartridges on the stand in front of the TV
  const con = new THREE.Group();
  con.position.set(0.1, 0.0, 0.5);
  con.add(box(0.32, 0.06, 0.18, MAT.cream, 0, 0.03, 0));
  con.add(box(0.14, 0.012, 0.1, MAT.ink, -0.05, 0.065, 0));
  con.add(box(0.12, 0.008, 0.08, MAT.tealLight, -0.05, 0.072, 0));
  con.add(box(0.03, 0.01, 0.07, MAT.ink, 0.07, 0.066, 0.0));
  con.add(box(0.07, 0.01, 0.03, MAT.ink, 0.07, 0.066, 0.0));
  con.add(cyl(0.014, 0.014, 0.012, MAT.coral, 0.12, 0.066, 0.03, 8));
  con.add(cyl(0.014, 0.014, 0.012, MAT.coral, 0.135, 0.066, -0.005, 8));
  tv.add(con);
  [0, 1].forEach((i) => {
    const cart = box(0.16, 0.05, 0.19, i ? MAT.coral : MAT.teal, 0.02, 0.025 + i * 0.05, -0.52 + i * 0.03);
    cart.rotation.y = i * 0.25;
    tv.add(cart);
    tv.add(box(0.1, 0.012, 0.1, MAT.cream, 0.02, 0.052 + i * 0.05, -0.52 + i * 0.03));
  });
  scene.add(tv);
  hotspot("projects", tv, { target: [-2.35, 0.8, 1.0], pos: [-0.15, 1.6, 2.1] });

  // desk against the back wall, right side
  const desk = new THREE.Group();
  desk.position.set(1.7, 0, -2.55);
  desk.add(box(1.8, 0.06, 0.8, MAT.wood, 0, 0.75, 0));
  desk.add(box(0.06, 0.72, 0.7, MAT.woodDark, -0.85, 0.36, 0));
  desk.add(box(0.06, 0.72, 0.7, MAT.woodDark, 0.85, 0.36, 0));
  desk.add(box(0.5, 0.6, 0.7, MAT.wood, 0.6, 0.3, 0));
  desk.add(box(0.4, 0.14, 0.02, MAT.woodDark, 0.6, 0.55, 0.36));
  desk.add(box(0.4, 0.14, 0.02, MAT.woodDark, 0.6, 0.35, 0.36));
  desk.add(box(0.4, 0.14, 0.02, MAT.woodDark, 0.6, 0.15, 0.36));
  [0.55, 0.35, 0.15].forEach((y) => desk.add(box(0.08, 0.02, 0.02, MAT.amber, 0.6, y, 0.37)));
  scene.add(desk);

  // chair
  const chair = new THREE.Group();
  chair.position.set(1.15, 0, -1.95);
  chair.add(box(0.46, 0.06, 0.46, MAT.teal, 0, 0.46, 0));
  chair.add(box(0.46, 0.5, 0.06, MAT.teal, 0, 0.74, -0.2));
  [[-0.19, -0.19], [0.19, -0.19], [-0.19, 0.19], [0.19, 0.19]].forEach(([x, z]) => chair.add(box(0.04, 0.44, 0.04, MAT.ink, x, 0.22, z)));
  scene.add(chair);

  // PC (ABOUT)
  const pc = new THREE.Group();
  pc.position.set(1.3, 0.78, -2.72);
  pc.add(box(0.56, 0.44, 0.42, MAT.cream, 0, 0.3, 0));
  pc.add(box(0.48, 0.36, 0.02, MAT.ink, 0, 0.31, 0.21));
  pc.add(plane(0.42, 0.3, MAT.pc, 0, 0.32, 0.222));
  pc.add(box(0.3, 0.08, 0.3, MAT.cream, 0, 0.04, 0.02));
  pc.add(box(0.5, 0.03, 0.18, MAT.cream, 0.05, 0.015, 0.48));
  for (let r = 0; r < 3; r++) for (let c = 0; c < 9; c++) pc.add(box(0.035, 0.012, 0.035, MAT.ink, -0.15 + c * 0.05, 0.035, 0.42 + r * 0.05));
  pc.add(box(0.08, 0.03, 0.12, MAT.ink, 0.42, 0.015, 0.45));
  pc.add(box(0.6, 0.06, 0.5, MAT.woodDark, 0.0, 0.0, 0.0).translateY(-0.02));
  scene.add(pc);
  hotspot("about", pc, { target: [1.3, 1.02, -2.55], pos: [1.9, 1.75, -0.3] });

  // red handheld "dex" (POSTS)
  const dex = new THREE.Group();
  dex.position.set(2.25, 0.78, -2.3);
  dex.rotation.y = -0.35;
  dex.add(box(0.22, 0.04, 0.32, MAT.red, 0, 0.02, 0));
  dex.add(box(0.11, 0.015, 0.32, MAT.red, -0.06, 0.047, 0));
  dex.add(plane(0.14, 0.11, MAT.dex, 0.03, 0.041, 0.02).rotateX(-Math.PI / 2));
  dex.add(cyl(0.03, 0.03, 0.01, MAT.tealLight, -0.06, 0.056, -0.11, 10));
  dex.add(cyl(0.012, 0.012, 0.012, MAT.ink, -0.06, 0.062, -0.11, 8));
  [0, 1, 2].forEach((i) => dex.add(box(0.025, 0.012, 0.025, MAT.ink, 0.0 + i * 0.045, 0.045, 0.12)));
  dex.add(cyl(0.02, 0.02, 0.012, MAT.amber, -0.04, 0.06, 0.1, 8));
  scene.add(dex);
  hotspot("posts", dex, { target: [2.25, 0.82, -2.3], pos: [2.45, 2.0, -0.95] });

  // desk lamp
  const lamp = new THREE.Group();
  lamp.position.set(2.45, 0.78, -2.75);
  lamp.add(cyl(0.1, 0.12, 0.03, MAT.ink, 0, 0.015, 0, 10));
  lamp.add(cyl(0.015, 0.015, 0.45, MAT.ink, 0, 0.24, 0, 6));
  const shade = cyl(0.06, 0.16, 0.18, MAT.amber, 0, 0.5, 0.05, 10);
  shade.rotation.x = 0.5;
  lamp.add(shade);
  scene.add(lamp);

  // badge case above the desk (WORK)
  const bcase = new THREE.Group();
  bcase.position.set(1.7, 1.85, -2.96);
  bcase.add(box(1.0, 0.64, 0.06, MAT.wood, 0, 0, 0));
  bcase.add(plane(0.9, 0.54, MAT.felt, 0, 0, 0.031));
  const badgeMats = [MAT.coral, MAT.tealLight, MAT.amber, MAT.green, MAT.cream, MAT.red, MAT.teal, MAT.grey];
  const shapes = [6, 4, 8, 3, 5, 6, 4, 8];
  badgeMats.forEach((m, i) => {
    const row = Math.floor(i / 4), col = i % 4;
    const b = cyl(0.07, 0.07, 0.025, m, -0.33 + col * 0.22, 0.13 - row * 0.26, 0.045, shapes[i]);
    b.rotation.x = Math.PI / 2;
    bcase.add(b);
    const pin = cyl(0.025, 0.025, 0.03, MAT.ink, -0.33 + col * 0.22, 0.13 - row * 0.26, 0.05, 6);
    pin.rotation.x = Math.PI / 2;
    bcase.add(pin);
  });
  scene.add(bcase);
  hotspot("work", bcase, { target: [1.7, 1.82, -2.9], pos: [2.0, 2.1, -0.75] });
}

/* ------------------------------------------------------------------ */
/* Pets: Piplup and Gible live on the floor                            */
/* ------------------------------------------------------------------ */
const pets = [];
const FLOOR_EDGE = 2.72;

/* Surfaces: every top a pet can stand on. A surface is a height, a rectangle
   [x1, z1, x2, z2] and the footprints of things standing on it. The floor is
   one too, with the furniture as its blocks. Positions are world coordinates
   read off buildRoom/buildFurniture; keep them in step when furniture moves. */
const FOOT = 0.05;
const SURFACES = [];
function surface(name, y, rect, blocks, floor) {
  const s = { name, y, rect, blocks: blocks || [], floor: !!floor };
  SURFACES.push(s);
  return s;
}
// footprint of a w by d box centred at (x, z), turned by yaw, grown by pad
function footprint(x, z, w, d, yaw, pad) {
  const c = Math.abs(Math.cos(yaw || 0)), s = Math.abs(Math.sin(yaw || 0));
  const ex = (w * c + d * s) / 2 + (pad || 0), ez = (w * s + d * c) / 2 + (pad || 0);
  return [x - ex, z - ez, x + ex, z + ez];
}
const FLOOR = surface("floor", 0, [-FLOOR_EDGE, -FLOOR_EDGE, FLOOR_EDGE, FLOOR_EDGE], [
  [-2.7, -3.0, -1.1, -0.78, 0.65],  // bed
  [-3.0, -0.65, -2.35, -0.05, 0.56], // nightstand
  [-3.0, 0.3, -2.2, 1.9, 0.525],      // TV stand
  [0.75, -3.0, 2.65, -2.1, 0.78],    // desk
  [0.88, -2.22, 1.42, -1.68, 0.49],  // chair
  [-2.75, 2.05, -2.15, 2.65, 1.016],  // plant
], true);
surface("blanket", 0.65, [-2.58, -2.18, -1.22, -0.92]);
surface("bed", 0.56, [-2.56, -2.9, -1.24, -0.9], [
  [-2.65, -3.01, -1.15, -2.93, 0.63],
  [...footprint(-1.9, -2.6, 0.86, 0.42), 0.70],            // pillow
  [-2.6, -2.18, -1.2, -0.9, 0.65],                    // blanket (its own surface)
]);
surface("nightstand", 0.56, [-2.9, -0.6, -2.4, -0.1], [[...footprint(-2.62, -0.35, 0.34, 0.24), 0.73]]);   // phone
surface("tv stand", 0.525, [-2.86, 0.33, -2.24, 1.87], [
  [...footprint(-2.5, 1.0, 0.6, 0.7, -0.35), 1.125],        // TV
  [...footprint(-2.33, 1.47, 0.32, 0.18, -0.35), 0.605],    // handheld
  [...footprint(-2.67, 0.51, 0.16, 0.22, -0.35), 0.637],    // cartridges
]);
surface("chair", 0.49, [0.92, -2.18, 1.38, -1.72], [[0.9, -2.2, 1.4, -2.12, 0.99]]);   // backrest
surface("desk", 0.78, [0.8, -2.95, 2.6, -2.15], [
  [...footprint(1.3, -2.72, 0.6, 0.5), 1.30],              // PC
  [...footprint(1.35, -2.24, 0.5, 0.18), 0.827],            // keyboard
  [...footprint(1.72, -2.27, 0.08, 0.12), 0.81],           // mouse
  [...footprint(2.25, -2.3, 0.22, 0.32, -0.35), 0.835],     // red handheld
  [...footprint(2.45, -2.75, 0.32, 0.32), 1.41],           // lamp
]);
surface("shelf", 2.075, [-0.8, -2.99, 0.4, -2.71], [-0.58, -0.2, 0.18].map((x) => [...footprint(x, -2.83, 0.22, 0.22), 2.29]));
SURFACES.sort((a, b) => b.y - a.y);   // highest first: the one under the pointer wins

// can a pet whose centre may come no closer than r stand at (x, z) on surface s?
function inRect(rect, x, z, r = 0) {
  const [x1, z1, x2, z2] = rect;
  return x >= x1 + r && x <= x2 - r && z >= z1 + r && z <= z2 - r;
}
function onSurface(s, x, z, r, obstacleRadius = r) {
  if (!inRect(s.rect, x, z, r)) return false;
  for (const [bx1, bz1, bx2, bz2] of s.blocks) {
    if (x > bx1 - obstacleRadius && x < bx2 + obstacleRadius && z > bz1 - obstacleRadius && z < bz2 + obstacleRadius) return false;
  }
  return true;
}
function standClear(p, x, z, s) {
  s = s || p.surface;
  return inRect([-3, -3, 3, 3], x, z, p.radius) &&
    onSurface(s, x, z, s.floor ? p.radius : FOOT, p.radius);
}
function pathClear(p, ax, az, bx, bz) {
  const n = Math.max(1, Math.ceil(Math.hypot(bx - ax, bz - az) / 0.08));
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    if (!standClear(p, ax + (bx - ax) * t, az + (bz - az) * t)) return false;
  }
  return true;
}
/* Sculpting helpers: the pets are low-poly, so every part keeps its segment
   count small and its material flat-shaded, and faces are painted as pixel decals. */
function ellipsoid(rx, ry, rz, material, x, y, z, seg, hseg) {
  const m = ball(1, material, x, y, z, seg || 10, hseg);
  m.scale.set(rx, ry, rz);
  return m;
}
function sphereSlice(r, material, phiStart, phiLen, thetaStart, thetaLen, seg, hseg) {
  const m = new THREE.Mesh(new THREE.SphereGeometry(r, seg || 12, hseg || 4, phiStart, phiLen, thetaStart, thetaLen), material);
  m.castShadow = true; m.receiveShadow = true;
  return m;
}
function disc(r, material, y, up) {
  const m = new THREE.Mesh(new THREE.CircleGeometry(r, 12), material);
  m.rotation.x = up ? -Math.PI / 2 : Math.PI / 2;
  m.position.y = y;
  return m;
}
function extruded(points, depth, material) {
  const shape = new THREE.Shape(points.map(([x, y]) => new THREE.Vector2(x, y)));
  const geo = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: false });
  geo.translate(0, 0, -depth / 2);
  const m = new THREE.Mesh(geo, material);
  m.castShadow = true; m.receiveShadow = true;
  return m;
}
// Clone a geometry into a given position/rotation/scale, for merging.
function placed(geo, x, y, z, rx, ry, rz, sx, sy, sz) {
  const m = new THREE.Matrix4().compose(
    new THREE.Vector3(x, y, z),
    new THREE.Quaternion().setFromEuler(new THREE.Euler(rx || 0, ry || 0, rz || 0)),
    new THREE.Vector3(sx == null ? 1 : sx, sy == null ? 1 : sy, sz == null ? 1 : sz),
  );
  return geo.clone().applyMatrix4(m);
}
// Merge small same-material pieces (toes, teeth) into one mesh.
function merged(geos, material) {
  const pos = [], nor = [];
  for (const g of geos) {
    const n = g.index ? g.toNonIndexed() : g;
    for (const v of n.attributes.position.array) pos.push(v);
    for (const v of n.attributes.normal.array) nor.push(v);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute("normal", new THREE.Float32BufferAttribute(nor, 3));
  const m = new THREE.Mesh(geo, material);
  m.castShadow = true; m.receiveShadow = true;
  return m;
}
/* A pixel decal (eye, blush): a patch of the ellipsoid (rx, ry, rz) around
   direction phi/theta, w by h in size, carrying a pixel texture. The patch is
   centred on its own origin so blinking can squash it in place. Decals cast no
   shadow (the body already does). */
function decalPatch(rx, ry, rz, phi, theta, w, h, material) {
  const pl = w / (rx * Math.sin(theta)), tl = h / ry;
  const geo = new THREE.SphereGeometry(1, 3, 3, phi - pl / 2, pl, theta - tl / 2, tl);
  const c = new THREE.Vector3(-Math.cos(phi) * Math.sin(theta), Math.cos(theta), Math.sin(phi) * Math.sin(theta));
  geo.translate(-c.x, -c.y, -c.z);
  const m = new THREE.Mesh(geo, material);
  m.scale.set(rx, ry, rz);
  const e = new THREE.Group();
  e.position.set(c.x * rx, c.y * ry, c.z * rz);
  e.add(m);
  return e;
}
// A four-sided pyramid pointing along +z: beaks, crest spikes, cape points.
function spike(r, len, material, x, y, z) {
  const m = cyl(0, r, len, material, x, y, z, 4);
  m.rotation.set(Math.PI / 2, Math.PI / 4, 0);
  return m;
}
const smooth = (u) => u * u * (3 - 2 * u);

function buildPets() {
  buildPiplup();
  buildGible();
}

// Piplup: a big faceted head on a short egg body, flat flippers out to the sides, wide yellow feet. Faces +z.
const PIP_HEAD_Y = 0.37, PIP_FOOT_Y = 0.014, PIP_FOOT_Z = 0.03;
function buildPiplup() {
  const g = new THREE.Group();

  const body = new THREE.Group();
  body.position.y = 0.17;
  body.add(ellipsoid(0.125, 0.15, 0.12, MAT.pipBody, 0, 0, 0, 10, 7));
  const tail = spike(0.03, 0.09, MAT.pipDark, 0, -0.07, -0.12);   // the cape ends in a short tail
  tail.rotation.x = Math.PI / 2 + 0.75;
  tail.scale.x = 1.6;
  body.add(tail);
  g.add(body);

  const head = new THREE.Group();
  head.position.set(0, PIP_HEAD_Y, 0.01);
  const R = 0.15, RY = 0.145, R2 = R + 0.004;
  head.add(ellipsoid(R, RY, R, MAT.pipHead, 0, 0, 0, 12, 8));
  const eyes = [-1, 1].map((s) => {   // big navy sparkle eyes on the white face
    const e = decalPatch(R2, RY + 0.004, R2, Math.PI / 2 + s * 0.4, Math.PI / 2 - 0.02, 0.07, 0.095, s < 0 ? MAT.pipEyeL : MAT.pipEyeR);
    head.add(e);
    return e;
  });
  [-1, 1].forEach((s) => head.add(decalPatch(R2, RY + 0.004, R2, Math.PI / 2 + s * 0.78, Math.PI * 0.6, 0.05, 0.028, MAT.blush)));
  const beak = new THREE.Group();   // open in a little smile
  beak.position.set(0, -0.028, 0.128);
  beak.add(spike(0.034, 0.075, MAT.beak, 0, 0.008, 0.03));
  const lower = spike(0.03, 0.06, MAT.beak, 0, -0.026, 0.024);
  lower.rotation.x = Math.PI / 2 + 0.35;
  lower.scale.set(1.1, 1, 0.5);
  beak.add(lower);
  const mouth = ellipsoid(0.022, 0.011, 0.024, MAT.pipMouth, 0, -0.01, 0.012, 6, 3);
  beak.add(mouth);
  head.add(beak);
  const crest = new THREE.Group();   // three-point crown
  crest.position.set(0, 0.11, -0.02);
  const mid = spike(0.026, 0.1, MAT.pipDark, 0, 0.04, 0);
  mid.rotation.x = -0.2;
  crest.add(mid);
  [-1, 1].forEach((s) => {
    const side = spike(0.02, 0.07, MAT.pipDark, s * 0.04, 0.015, 0);
    side.rotation.set(-0.3, 0, -s * 0.7);
    crest.add(side);
  });
  head.add(crest);
  g.add(head);

  // flippers: flat triangular blades held out to the sides and a little down
  const flippers = [-1, 1].map((s) => {
    const f = new THREE.Group();
    f.position.set(s * 0.105, 0.215, 0.01);
    const blade = extruded([[0, 0.04], [0.08, 0.035], [0.17, -0.01], [0.07, -0.045]], 0.018, MAT.pipLight);
    blade.rotation.z = -0.7;
    blade.scale.x = s;
    f.add(blade);
    g.add(f);
    return f;
  });

  // feet: a flat wedge with three toes, merged into one yellow mesh
  const toe = new THREE.BoxGeometry(0.022, 0.016, 0.04);
  const footGeo = [placed(new THREE.BoxGeometry(0.08, 0.02, 0.07), 0, 0, 0.008)];
  [-1, 0, 1].forEach((i) => footGeo.push(placed(toe, i * 0.028, -0.002, 0.052, 0, i * 0.3, 0)));
  const feet = [-1, 1].map((s) => {
    const foot = merged(footGeo, MAT.beak);
    foot.position.set(s * 0.052, PIP_FOOT_Y, PIP_FOOT_Z);
    foot.rotation.y = s * 0.12;
    g.add(foot);
    return foot;
  });

  addPet({
    name: "Piplup", group: g, x: 0.9, z: 0.9, yaw: 0.9, speed: 0.32, radius: 0.40,
    pose: posePiplup,
    idle: ["flap", "puff", "peck", "flap"],
    taps: ["hop", "puff", "flap", "spin", "peck"],
    greet: "flap",
    lines: {
      hop: "Piplup: pip-lup!", puff: "Piplup: *puffs out its chest*", flap: "Piplup: *flap flap*",
      spin: "Piplup: lup lup!", peck: "Piplup: pip!", still: "Piplup: pip-lup!",
      lift: "Piplup: lup?!", land: "Piplup: pip!",
      tantrum: "Piplup: pip pip PIP! *stomp stomp*", move: "Piplup used Water Gun!",
    },
    move: "watergun",
    parts: { body, head, eyes, beak, flippers, feet, mark: angryMark(g, 0.13, 0.57) },
  });
}

// Gible: one tall faceted egg of a body, the lower front all mouth. Faces +z.
const GIB_BODY_Y = 0.27;
function buildGible() {
  const g = new THREE.Group();
  const RX = 0.2, RY = 0.235, RZ = 0.19, TH = Math.PI * 0.52;   // the lip line sits just below the middle
  const ringR = Math.sin(TH), ringY = Math.cos(TH);               // on the unit sphere; the body scales it

  // the body is built on a unit sphere and scaled, so every slice lines up
  const head = new THREE.Group();
  head.position.y = GIB_BODY_Y;
  const shell = new THREE.Group();
  shell.scale.set(RX, RY, RZ);
  shell.add(sphereSlice(1, MAT.gibBlue, 0, Math.PI * 2, 0, TH, 12, 5));                    // crown down to the upper lip
  shell.add(sphereSlice(1, MAT.gibBlue, Math.PI, Math.PI, TH, Math.PI - TH, 6, 4));       // solid back below the lip
  shell.add(sphereSlice(0.96, MAT.gibMouth, Math.PI, Math.PI, TH, Math.PI - TH, 6, 4));   // dark inside wall
  shell.add(disc(ringR, MAT.gibMouth, ringY - 0.01, false));                               // roof of the mouth
  head.add(shell);

  // lower jaw: the red front half below the lip, hinged at the lip line so it swings open as a wedge
  const jaw = new THREE.Group();
  jaw.position.y = ringY * RY;
  const jawShell = new THREE.Group();
  jawShell.scale.set(RX, RY, RZ);
  jawShell.position.y = -ringY * RY;
  jawShell.add(sphereSlice(1, MAT.gibJaw, 0, Math.PI, TH, Math.PI - TH, 6, 4));
  jawShell.add(disc(ringR, MAT.gibMouth, ringY + 0.01, true));                              // floor of the mouth
  jaw.add(jawShell);
  jaw.add(ellipsoid(0.08, 0.02, 0.09, MAT.gibTongue, 0, 0.012, 0.06, 6, 3));
  head.add(jaw);

  // teeth: pixel zigzag strips lining the front half of each lip
  const teeth = (down) => {
    const r = ringR * RX + 0.004;
    const geo = new THREE.CylinderGeometry(r, r, 0.024, 12, 1, true, -Math.PI / 2, Math.PI);
    geo.scale(1, 1, RZ / RX);
    const m = new THREE.Mesh(geo, MAT.gibTeeth);
    if (!down) m.rotation.z = Math.PI;
    m.position.y = down ? ringY * RY - 0.011 : 0.011;
    return m;
  };
  head.add(teeth(true));
  jaw.add(teeth(false));

  // eyes: big round sparkle eyes high on the front, blush under them
  const RX2 = RX + 0.004, RY2 = RY + 0.004, RZ2 = RZ + 0.004;
  const eyes = [-1, 1].map((s) => {
    const e = decalPatch(RX2, RY2, RZ2, Math.PI / 2 + s * 0.55, Math.PI * 0.39, 0.1, 0.1, s < 0 ? MAT.gibEyeL : MAT.gibEyeR);
    head.add(e);
    return e;
  });
  [-1, 1].forEach((s) => head.add(decalPatch(RX2, RY2, RZ2, Math.PI / 2 + s * 0.85, Math.PI * 0.48, 0.05, 0.03, MAT.blush)));

  // tall dorsal fin swept back
  const fin = extruded([[0.06, 0], [0.03, 0.1], [-0.04, 0.22], [-0.11, 0.2], [-0.1, 0.1], [-0.14, 0]], 0.05, MAT.gibBlue);
  fin.rotation.y = -Math.PI / 2;
  fin.position.set(0, RY - 0.08, -0.04);
  head.add(fin);

  // side jets: round faceted pods with yellow spots, one on each side
  [-1, 1].forEach((s) => {
    const jet = ellipsoid(0.085, 0.08, 0.1, MAT.gibJet, s * (RX + 0.02), 0.09, -0.03, 6, 4);
    jet.rotation.y = s < 0 ? Math.PI : 0;   // the spots face outward
    jet.rotation.z = s * 0.15;
    head.add(jet);
  });

  // stubby arms angled out and forward
  [-1, 1].forEach((s) => {
    const arm = cyl(0.015, 0.04, 0.13, MAT.gibBlue, s * (RX + 0.01), -0.06, 0.05, 5);
    arm.rotation.set(0.5, 0, s * 1.9);
    head.add(arm);
  });
  g.add(head);

  const tail = new THREE.Group();
  tail.position.set(0, 0.16, -0.16);
  const cone = cyl(0, 0.06, 0.2, MAT.gibBlue, 0, 0, -0.09, 6);
  cone.rotation.x = -Math.PI / 2;
  tail.add(cone);
  const tailFin = extruded([[0.03, 0], [-0.03, 0.08], [-0.07, 0]], 0.025, MAT.gibBlue);
  tailFin.rotation.y = -Math.PI / 2;
  tailFin.position.set(0, 0.015, -0.13);
  tail.add(tailFin);
  g.add(tail);

  const legs = [-1, 1].map((s) => {
    const leg = new THREE.Group();
    leg.position.set(s * 0.09, 0, 0.02);
    leg.add(cyl(0.04, 0.048, 0.1, MAT.gibBlue, 0, 0.05, 0, 6));
    leg.add(ellipsoid(0.055, 0.02, 0.07, MAT.gibDark, 0, 0.014, 0.025, 6, 3));
    g.add(leg);
    return leg;
  });

  addPet({
    name: "Gible", group: g, x: 1.9, z: 1.6, yaw: -0.6, speed: 0.4, radius: 0.46,
    pose: poseGible,
    idle: ["chomp", "chomps", "wag", "wag"],
    taps: ["chomp", "spin", "chomps", "shake"],
    greet: "chomps",
    lines: {
      chomp: "Gible: *chomp!*", chomps: "Gible: gib gib gib!", spin: "Gible: gib!",
      shake: "Gible: *wiggles*", wag: "Gible: gib?", still: "Gible: gib gib!",
      lift: "Gible: gib gib?!", land: "Gible: gib!",
      tantrum: "Gible: GIB GIB! *stomp stomp*", move: "Gible used Bite!",
    },
    move: "bite",
    parts: { head, jaw, eyes, tail, legs, mark: angryMark(g, 0.2, 0.56) },
  });
}

function addPet(o) {
  const p = {
    name: o.name, group: o.group, parts: o.parts, pose: o.pose, lines: o.lines,
    idle: o.idle, taps: o.taps, greet: o.greet, speed: o.speed, radius: o.radius,
    state: "idle", timer: 1 + Math.random() * 2, visiting: null,
    yaw: o.yaw, yawGoal: o.yaw, headYaw: 0, headGoal: 0, nextLook: 2 + Math.random() * 3,
    x: o.x, z: o.z, from: [o.x, o.z], to: [o.x, o.z], walkT: 0, walkLen: 0,
    age: Math.random() * 10, blink: 0, nextBlink: 2 + Math.random() * 4,
    act: null, actT: 0, nextAct: 3 + Math.random() * 4, cue: null, tapIdx: Math.floor(Math.random() * o.taps.length),
    held: false, fall: null, y: 0.02, vx: 0, vz: 0,
    surface: FLOOR, ground: 0, hang: LIFT_Y, move: o.move, lunge: 0, emit: 0,
  };
  p.group.position.set(p.x, 0.02, p.z);
  p.group.rotation.y = p.yaw;
  p.group.userData.pet = true;
  scene.add(p.group);
  pets.push(p);
}

/* Short animations. ACT_LEN sets each act's duration in seconds; p.actT runs 1 -> 0. */
const ACT_LEN = { hop: 0.9, flap: 1.1, puff: 1.6, spin: 1.0, peck: 0.9, chomp: 0.9, chomps: 1.2, shake: 1.1, wag: 1.3, yawn: 1.8, land: 0.7, tantrum: 1.5, watergun: 1.6, bite: 1.2 };
function play(p, kind) {
  if (p.held || p.fall) return;
  p.act = kind;
  p.actT = 1;
}

function setWalk(p, x, z) {
  p.from = [p.x, p.z]; p.to = [x, z];
  p.walkLen = Math.hypot(x - p.x, z - p.z); p.walkT = 0;
  p.state = "walk";
  p.yawGoal = Math.atan2(x - p.x, z - p.z);
  p.headGoal = 0;
}

function pickWalk(p) {
  const other = pets.find((q) => q !== p);
  const s = p.surface, span = Math.min(s.rect[2] - s.rect[0], s.rect[3] - s.rect[1]);
  for (let i = 0; i < 24; i++) {
    const reach = s.floor ? 0.6 + Math.random() * 1.6 : 0.08 + Math.random() * span * 0.5;   // short strolls on furniture
    const a = Math.random() * Math.PI * 2;
    const x = p.x + Math.cos(a) * reach, z = p.z + Math.sin(a) * reach;
    if (!standClear(p, x, z)) continue;
    if (other && other.surface === s && Math.hypot(other.x - x, other.z - z) < 0.6) continue;
    if (!pathClear(p, p.x, p.z, x, z)) continue;
    setWalk(p, x, z);
    return;
  }
  p.timer = 1 + Math.random() * 2;
}

/* Every so often one pet walks over to the other and they greet each other. */
let meetTimer = 14;
function startMeet() {
  meetTimer = 20 + Math.random() * 20;
  const [a, b] = pets;
  if (!b || a.surface !== b.surface || a.state !== "idle" || b.state !== "idle" || a.act || b.act || a.held || b.held || a.fall || b.fall) { meetTimer = 6; return; }
  const p = Math.random() < 0.5 ? a : b, q = p === a ? b : a;
  for (let i = 0; i < 24; i++) {
    const ang = Math.random() * Math.PI * 2, d = p.radius + q.radius + 0.12;
    const x = q.x + Math.cos(ang) * d, z = q.z + Math.sin(ang) * d;
    if (!standClear(p, x, z) || !pathClear(p, p.x, p.z, x, z)) continue;
    setWalk(p, x, z);
    p.visiting = q;
    q.timer = Math.max(q.timer, p.walkLen / p.speed + 2.5);   // wait for the visitor
    return;
  }
  meetTimer = 6;
}
function arriveMeet(p) {
  const q = p.visiting;
  p.visiting = null;
  const aim = (from, to) => { from.yawGoal = Math.atan2(to.x - from.x, to.z - from.z); from.headGoal = 0; };
  aim(p, q); aim(q, p);
  play(p, p.greet);
  q.cue = { kind: q.greet, delay: 0.5 };
  p.timer = 3 + Math.random() * 2; q.timer = 3.5 + Math.random() * 2;
  say(p.name === "Piplup" ? "Piplup: lup! · Gible: gib!" : "Gible: gib! · Piplup: lup!", 2200);
}

function faceCamera(p) {
  p.yawGoal = Math.atan2(camera.position.x - p.x, camera.position.z - p.z);
  p.headGoal = 0;
}

function turnToward(cur, goal, k) {
  let d = ((goal - cur + Math.PI) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2) - Math.PI;
  return cur + d * Math.min(1, k);
}

function stepPets(dt) {
  if (!REDUCED && (meetTimer -= dt) <= 0) startMeet();
  for (const p of pets) {
    if (p.act && (p.actT -= dt / ACT_LEN[p.act]) <= 0) p.act = null;
    if (p.cue && (p.cue.delay -= dt) <= 0) {
      play(p, p.cue.kind);
      if (p.cue.kind === p.move) say(p.lines.move, 2000);
      p.cue = null;
    }

    if (p.held) {   // dangling under the pointer; trail it a little so it swings
      const k = REDUCED ? 1 : Math.min(1, dt * 14);
      const nx = p.x + (lift.x - p.x) * k, nz = p.z + (lift.z - p.z) * k;
      p.vx = dt > 0 ? (nx - p.x) / dt : 0; p.vz = dt > 0 ? (nz - p.z) / dt : 0;
      p.x = nx; p.z = nz;
      p.hang += (lift.surface.y + LIFT_Y - p.hang) * k;   // rise or sink with the surface under the pointer
    } else if (p.fall) {   // dropped: fall onto the landing spot, then bounce
      const f = p.fall;
      f.vy -= dt * 7;
      f.y += f.vy * dt;
      const k = Math.min(1, dt * 10);
      p.x += (f.x - p.x) * k; p.z += (f.z - p.z) * k;
      if (f.y <= p.ground + 0.02) {
        p.fall = null; p.x = f.x; p.z = f.z;
        play(p, "land");
        say(p.lines.land);
      }
    } else if (!REDUCED && !p.act) {
      if (p.state === "idle") {
        if ((p.timer -= dt) <= 0) pickWalk(p);
        if ((p.nextAct -= dt) <= 0) {
          p.nextAct = 5 + Math.random() * 7;
          if (p.state === "idle") play(p, p.idle[Math.floor(Math.random() * p.idle.length)]);
        }
      } else if (p.state === "walk") {
        p.walkT += (dt * p.speed) / Math.max(0.05, p.walkLen);
        const t = Math.min(1, p.walkT);
        p.x = p.from[0] + (p.to[0] - p.from[0]) * t;
        p.z = p.from[1] + (p.to[1] - p.from[1]) * t;
        if (t >= 1) {
          p.state = "idle"; p.timer = 1.5 + Math.random() * 3;
          if (p.visiting) arriveMeet(p);
        }
      }
      if ((p.nextLook -= dt) <= 0) {
        p.nextLook = 2 + Math.random() * 4;
        if (p.state === "idle") {
          if (Math.random() < 0.4) faceCamera(p);
          else p.headGoal = (Math.random() - 0.5) * 1.2;
        }
      }
    }
    if (!REDUCED && (p.nextBlink -= dt) <= 0) { p.nextBlink = 2 + Math.random() * 4; p.blink = 0.13; }
    if (p.held) p.blink = 0;
    if (p.blink > 0) p.blink = Math.max(0, p.blink - dt);

    const snap = REDUCED ? 1 : dt * 7;
    p.yaw = turnToward(p.yaw, p.yawGoal, snap);
    p.headYaw = turnToward(p.headYaw, p.headGoal, snap);
    if (!REDUCED) p.age += dt;

    const o = {
      y: p.held ? p.hang : p.fall ? p.fall.y : p.ground + 0.02, rx: 0, rz: 0, spin: 0, sx: 1, sy: 1, sz: 1, lunge: 0,
      walking: p.state === "walk" && !REDUCED,
      held: p.held && !REDUCED, falling: !!p.fall,
      kind: p.act, u: p.act ? (REDUCED ? 0.5 : 1 - p.actT) : 0,
      breathe: REDUCED ? 0 : Math.sin(p.age * 2.5) * 0.015,
      sleepy: nightMix > 0.5 && !p.held && !p.fall,
    };
    o.bump = Math.sin(o.u * Math.PI);   // 0 -> 1 -> 0 over an act
    if (o.held) {   // swing with the drag, in the pet's own frame
      const c = Math.cos(p.yaw), sn = Math.sin(p.yaw);
      const lx = p.vx * c - p.vz * sn, lz = p.vx * sn + p.vz * c;
      o.rz = clamp(-lx * 0.35, -0.5, 0.5);
      o.rx = clamp(lz * 0.35, -0.5, 0.5);
      o.spin = Math.sin(p.age * 6) * 0.08;
    }
    p.pose(p, o);
    constrainLunge(p, o);
    if (p.act === p.move) stepMove(p, o, dt);
    p.group.position.set(p.x + Math.sin(p.yaw) * o.lunge, o.y, p.z + Math.cos(p.yaw) * o.lunge);
    p.group.rotation.set(o.rx, p.yaw + o.spin, o.rz);
    p.group.scale.set(o.sx, o.sy, o.sz);
    const lid = p.blink > 0 ? 0.1 : o.sleepy ? 0.55 : 1;
    for (const e of p.parts.eyes) e.scale.y = lid;
    // the angry mark pops up over a tantrum and stays through the move
    const angry = REDUCED ? 0 : o.kind === "tantrum" ? Math.min(1, o.u * 6) : o.kind === p.move ? Math.max(0, 1 - o.u * 3) : 0;
    p.parts.mark.visible = angry > 0;
    p.parts.mark.scale.setScalar(0.14 * angry * (1 + Math.sin(p.age * 14) * 0.08));
  }
  stepParticles(dt);
}

function constrainLunge(p, o) {
  if (!o.lunge) return;
  const dx = Math.sin(p.yaw) * o.lunge, dz = Math.cos(p.yaw) * o.lunge;
  let low = 0, high = 1;
  if (pathClear(p, p.x, p.z, p.x + dx, p.z + dz)) return;
  for (let i = 0; i < 12; i++) {
    const t = (low + high) / 2;
    if (pathClear(p, p.x, p.z, p.x + dx * t, p.z + dz * t)) low = t;
    else high = t;
  }
  o.lunge *= low;
}

function posePiplup(p, o) {
  const P = p.parts, k = o.kind, u = o.u, bump = o.bump;
  const g = o.walking ? p.age * 13 : 0;
  let flap = 0.28, swing = 0, headPitch = 0, puff = 0;
  if (o.walking) {   // waddle: roll side to side, feet alternate, flippers swing
    o.rz = Math.sin(g) * 0.1;
    o.y += Math.abs(Math.sin(g)) * 0.012;
    swing = Math.sin(g) * 0.35;
    headPitch = Math.sin(g * 2) * 0.03;
  }
  P.feet.forEach((f, i) => {
    const ph = g + i * Math.PI;
    f.position.y = PIP_FOOT_Y + (o.walking ? Math.max(0, Math.sin(ph)) * 0.03 : 0);
    f.position.z = PIP_FOOT_Z + (o.walking ? Math.cos(ph) * 0.03 : 0);
  });
  if (k === "hop") {
    o.y += bump * 0.2; flap += bump * 1.3;
    o.sx = o.sz = 1 - bump * 0.1; o.sy = 1 + bump * 0.15;
  } else if (k === "flap") {   // three quick flaps and a little bounce
    flap += (0.5 + 0.5 * Math.sin(u * Math.PI * 6 - Math.PI / 2)) * 1.2 * Math.min(1, bump * 2);
    o.y += bump * 0.03;
  } else if (k === "puff") {
    puff = Math.min(1, bump * 1.5);
  } else if (k === "spin") {
    o.spin = smooth(u) * Math.PI * 2; o.y += bump * 0.12; flap += bump * 0.9;
  } else if (k === "peck") {
    headPitch += Math.max(0, Math.sin(u * Math.PI * 4)) * 0.45;
  } else if (k === "yawn") {   // head back, flippers droop, slow
    puff = Math.min(1, bump * 1.3) * 0.5;
    headPitch -= bump * 0.3;
  } else if (k === "land") {   // squash on touchdown, flippers out
    o.sy = 1 - bump * 0.22; o.sx = o.sz = 1 + bump * 0.14;
    flap += bump * 1.1;
  } else if (k === "tantrum") {   // stomping, shaking, flippers beating
    const st = REDUCED ? 0 : Math.abs(Math.sin(u * Math.PI * 7));
    o.y += st * 0.025; o.rz = REDUCED ? 0 : Math.sin(u * Math.PI * 14) * 0.08;
    flap += 0.9 + st * 0.6; puff = 0.4; headPitch -= 0.2;
    P.feet.forEach((f, i) => { f.position.y = PIP_FOOT_Y + (REDUCED ? 0 : Math.max(0, Math.sin(u * Math.PI * 7 + i * Math.PI)) * 0.04); });
  } else if (k === "watergun") {   // rear back and puff, then lean in and spray
    const wind = REDUCED ? 1 : Math.min(1, u * 4), shoot = u > 0.25 && u < 0.8 ? 1 : 0;
    puff = REDUCED ? 0.4 : wind * (1 - u * 0.5);
    headPitch += REDUCED ? -0.2 : (shoot ? 0.3 + Math.sin(p.age * 40) * 0.03 : -0.25 * wind);
    o.rx = REDUCED ? 0 : -0.12 * wind + shoot * 0.25;
    flap += wind * 0.9;
  }
  if (o.held) {   // flaps in a panic, feet dangle
    flap += (0.5 + 0.5 * Math.sin(p.age * 16)) * 1.1;
    swing = Math.sin(p.age * 16) * 0.2;
    P.feet.forEach((f, i) => { f.position.y = PIP_FOOT_Y - 0.01 + Math.sin(p.age * 9 + i) * 0.01; });
  } else if (o.sleepy && !k && !o.walking) {
    headPitch += 0.18 + Math.sin(p.age * 1.4) * 0.05;   // nodding off
  }
  // chest puff: the body swells, the head tips back, the flippers brace behind
  P.body.scale.set(1 + puff * 0.1, 1 + puff * 0.04 + o.breathe, 1 + puff * 0.1);
  P.head.rotation.set(headPitch - puff * 0.35, p.headYaw, 0);
  P.head.position.y = PIP_HEAD_Y + o.breathe * 1.5 + puff * 0.012;
  P.flippers.forEach((f, i) => {
    const s = i ? 1 : -1;
    f.rotation.z = s * (flap - puff * 0.2);
    f.rotation.x = swing * s + puff * 0.5;
  });
}

function poseGible(p, o) {
  const P = p.parts, k = o.kind, u = o.u, bump = o.bump;
  const g = o.walking ? p.age * 7.5 : 0;
  let open = 0.12, wag = 0, tuck = 0;
  if (o.walking) {   // jaw-first hops: mouth drops open in the air and snaps shut on landing
    const h = Math.max(0, Math.sin(g));
    o.y += h * 0.1;
    o.rx = -Math.sin(g * 2) * 0.17 * (h > 0 ? 1 : 0);
    open += h * 0.45;
    tuck = h;
    wag = Math.sin(g) * 0.25;
  }
  if (k === "chomp") {   // one big chomp with a hop
    o.y += bump * 0.2;
    open += Math.sin(Math.min(1, u * 1.3) * Math.PI) * 0.95;
    o.rx = Math.sin(u * Math.PI * 2) * 0.2;
    o.sx = o.sz = 1 - bump * 0.08; o.sy = 1 + bump * 0.1;
  } else if (k === "chomps") {   // three quick snaps
    const c = Math.max(0, Math.sin(u * Math.PI * 6));
    open += c * 0.65 * Math.min(1, bump * 2);
    o.rx = c * 0.08;
  } else if (k === "spin") {
    o.spin = smooth(u) * Math.PI * 2; o.y += bump * 0.12; open += bump * 0.5;
  } else if (k === "shake") {
    o.rz = Math.sin(u * Math.PI * 5) * 0.22 * bump; open += bump * 0.3;
    wag = Math.sin(u * Math.PI * 5) * 0.6 * bump;
  } else if (k === "wag") {
    wag = Math.sin(u * Math.PI * 6) * 0.55 * bump; open += bump * 0.12;
  } else if (k === "yawn") {   // a slow, wide yawn
    open += Math.sin(Math.min(1, u * 1.15) * Math.PI) * 0.8;
    o.rx = -bump * 0.12;
  } else if (k === "land") {
    o.sy = 1 - bump * 0.2; o.sx = o.sz = 1 + bump * 0.12;
    open += Math.max(0, Math.sin(u * Math.PI * 2)) * 0.5;
  } else if (k === "tantrum") {   // stomping and shaking, jaw chattering
    const st = REDUCED ? 0 : Math.abs(Math.sin(u * Math.PI * 7));
    o.y += st * 0.03; o.rz = REDUCED ? 0 : Math.sin(u * Math.PI * 14) * 0.1;
    open += 0.2 + st * 0.3; wag = REDUCED ? 0 : Math.sin(u * Math.PI * 10) * 0.5;
    tuck = st;
  } else if (k === "bite") {   // crouch back, lunge with the jaw wide, snap shut
    if (REDUCED) { open += 0.6; }
    else {
      const wind = Math.min(1, u * 3.3), lungeT = smooth(clamp((u - 0.3) * 5, 0, 1)), back = smooth(clamp((u - 0.65) * 3, 0, 1));
      o.lunge = -0.05 * wind + (0.19 * lungeT) * (1 - back) + 0.05 * wind * back;
      open += u < 0.5 ? wind * 1.1 : Math.max(0, 1.1 - (u - 0.5) * 14);
      o.rx = -0.25 * wind * (1 - lungeT) + 0.3 * lungeT * (1 - back);
      o.y += lungeT * (1 - back) * 0.06;
    }
  }
  if (o.held) {   // legs kick, jaw snaps at the air
    open += (0.5 + 0.5 * Math.sin(p.age * 11)) * 0.4;
    P.legs.forEach((l, i) => { l.position.z = 0.02 + Math.sin(p.age * 10 + i * Math.PI) * 0.035; l.rotation.x = Math.sin(p.age * 10 + i * Math.PI) * 0.4; });
    wag = Math.sin(p.age * 8) * 0.4;
  } else {
    P.legs.forEach((l) => { l.position.z = 0.02; l.rotation.x = 0; });
    if (o.sleepy && !k && !o.walking) { open += 0.08; o.rx = 0.06 + Math.sin(p.age * 1.4) * 0.03; }
  }
  P.jaw.rotation.x = open;
  P.tail.rotation.y = wag;
  P.head.rotation.y = p.headYaw * 0.6;
  P.head.position.y = GIB_BODY_Y + o.breathe * 1.2;
  P.head.scale.set(1 + o.breathe, 1 + o.breathe, 1 + o.breathe);
  P.legs.forEach((l) => { l.position.y = tuck * 0.03; });
}

/* Tantrums: a tap sometimes sets a pet off. It stomps and shakes under an angry
   mark, then uses its move: Piplup sprays a Water Gun, Gible lunges with a Bite. */
const TANTRUM_CHANCE = 0.25;

// the comic anger mark: a billboard that pops up beside the head
function angryMark(group, x, y) {
  const mark = new THREE.Sprite(MAT.angry);
  mark.position.set(x, y, 0);
  mark.visible = false;
  mark.raycast = () => {};
  group.add(mark);
  return mark;
}

/* Particles: a pool of low-poly water drops and a pool of sparks, one instanced
   mesh each, so the moves cost two draw calls however many are flying. */
const DROPS = 56, SPARKS = 16;
const drops = [], sparks = [];
let dropMesh, sparkMesh;
const pM = new THREE.Matrix4(), pQ = new THREE.Quaternion(), pS = new THREE.Vector3(), pV = new THREE.Vector3();
function buildParticles() {
  const pool = (geo, material, n, list) => {
    const m = new THREE.InstancedMesh(geo, material, n);
    m.frustumCulled = false;
    m.raycast = () => {};
    for (let i = 0; i < n; i++) {
      list.push({ life: 0, ttl: 1, x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, size: 0, splash: false, s: FLOOR });
      pM.makeScale(0, 0, 0); m.setMatrixAt(i, pM);
    }
    scene.add(m);
    return m;
  };
  dropMesh = pool(new THREE.IcosahedronGeometry(0.013, 0), MAT.water, DROPS, drops);
  sparkMesh = pool(new THREE.TetrahedronGeometry(0.03, 0), MAT.spark, SPARKS, sparks);
}
function spawn(list, x, y, z, vx, vy, vz, ttl, size, splash, s) {
  const d = list.find((o) => o.life <= 0);
  if (!d) return;
  d.x = x; d.y = y; d.z = z; d.vx = vx; d.vy = vy; d.vz = vz;
  d.life = d.ttl = ttl; d.size = size; d.splash = splash; d.s = s;
}
function stepParticles(dt) {
  if (!dropMesh) return;
  let live = false;
  drops.forEach((d, i) => {
    if (d.life > 0) {
      live = true;
      d.life -= dt; d.vy -= dt * 3.2;
      d.x += d.vx * dt; d.y += d.vy * dt; d.z += d.vz * dt;
      // drops splash on the surface the pet stands on, on things standing on it, the floor and the walls
      const ground = onSurface(d.s, d.x, d.z, 0) ? d.s.y : 0;
      const hit = d.y <= ground + 0.012 || d.x < -2.95 || d.z < -2.95 || SURFACES.some((s) => d.y >= s.y && s.blocks.some(([x1, z1, x2, z2, top]) =>
        d.y < top && d.x > x1 && d.x < x2 && d.z > z1 && d.z < z2));
      if (hit && d.splash) {
        for (let k = 0; k < 3; k++) spawn(drops, d.x, Math.max(d.y, ground + 0.012), d.z, (Math.random() - 0.5) * 0.5, 0.4 + Math.random() * 0.5, (Math.random() - 0.5) * 0.5, 0.3, 0.55, false, d.s);
      }
      if (hit) d.life = 0;
    }
    pS.setScalar(d.life > 0 ? d.size * (0.6 + 0.4 * d.life / d.ttl) : 0);
    pM.compose(pV.set(d.x, d.y, d.z), pQ, pS);
    dropMesh.setMatrixAt(i, pM);
  });
  sparks.forEach((d, i) => {
    if (d.life > 0) {
      live = true;
      d.life -= dt;
      d.x += d.vx * dt; d.y += d.vy * dt; d.z += d.vz * dt;
    }
    pS.setScalar(d.life > 0 ? d.size * (d.life / d.ttl) : 0);
    pQ.setFromAxisAngle(pV.set(0, 1, 0), d.life * 9);
    pM.compose(pV.set(d.x, d.y, d.z), pQ, pS);
    sparkMesh.setMatrixAt(i, pM);
  });
  if (live || dropMesh.userData.live) {   // one extra pass clears the last survivors
    dropMesh.instanceMatrix.needsUpdate = sparkMesh.instanceMatrix.needsUpdate = true;
  }
  dropMesh.userData.live = live;
}
// a point in the pet's own frame (x right, y up, z forward), in world space
function petPoint(p, o, lx, ly, lz) {
  const c = Math.cos(p.yaw), sn = Math.sin(p.yaw);
  return [p.x + lx * c + lz * sn, o.y + ly, p.z - lx * sn + lz * c];
}
// the effects of a move, timed by o.u running 0 -> 1 over the act
function stepMove(p, o, dt) {
  if (REDUCED) return;
  const u = o.u, c = Math.cos(p.yaw), sn = Math.sin(p.yaw);
  if (p.move === "watergun") {
    if (u < 0.25 || u > 0.8) { p.emit = 0; return; }
    p.emit += dt * 60;
    while (p.emit >= 1) {
      p.emit -= 1;
      const [x, y, z] = petPoint(p, o, 0, PIP_HEAD_Y - 0.01, 0.28);
      const v = 1.7 + Math.random() * 0.3, r = () => (Math.random() - 0.5) * 0.3;
      spawn(drops, x, y, z, sn * v + r(), 0.55 + r(), c * v + r(), 1.0, 0.8 + Math.random() * 0.5, true, p.surface);
    }
  } else if (p.move === "bite") {
    if (u < 0.3) p.emit = 0;
    if (u >= 0.5 && !p.emit) {   // the snap: one burst of sparks off the jaws
      p.emit = 1;
      const [x, y, z] = petPoint(p, o, 0, GIB_BODY_Y - 0.02, 0.19 + o.lunge);
      for (let k = 0; k < 10; k++) {
        const a = Math.random() * Math.PI * 2, sp = 0.5 + Math.random() * 0.7;
        spawn(sparks, x, y, z, Math.cos(a) * sp + sn * 0.5, (Math.random() - 0.3) * 0.8, Math.sin(a) * sp + c * 0.5, 0.35, 0.7 + Math.random() * 0.6, false, p.surface);
      }
    }
  }
}

/* The landing ring: shows where a lifted pet will come down. */
let landRing;
function buildLandRing() {
  landRing = new THREE.Mesh(new THREE.RingGeometry(0.13, 0.19, 16), new THREE.MeshBasicMaterial({ color: "#ffd24d", transparent: true, opacity: 0.8, depthWrite: false, side: THREE.DoubleSide }));
  landRing.rotation.x = -Math.PI / 2;
  landRing.visible = false;
  landRing.raycast = () => {};
  scene.add(landRing);
}

/* Lifting: press and drag on a pet to carry it; it dangles below the pointer and
   drops onto a nearby clear floor spot when released. */
const LIFT_Y = 0.55;        // how high the pet hangs above the floor
const LIFT_PLANE = 1.05;    // the pointer ray is cut by this horizontal plane
let lift = null;            // { pet, pointerId, x, z }
const liftPlane = new THREE.Plane(new THREE.Vector3(0, -1, 0), LIFT_PLANE);
const liftPoint = new THREE.Vector3();

function liftPet(p, pointerId, clientX, clientY) {
  lift = { pet: p, pointerId, x: p.x, z: p.z, surface: p.surface, land: null };
  p.hang = p.ground + LIFT_Y;
  p.held = true; p.fall = null; p.act = null; p.cue = null; p.visiting = null;
  p.state = "idle"; p.timer = 2 + Math.random() * 2;
  p.vx = p.vz = 0;
  faceCamera(p);
  moveLift(clientX, clientY);
  renderer.domElement.style.cursor = "grabbing";
  say(p.lines.lift);
}
function moveLift(clientX, clientY) {
  const r = renderer.domElement.getBoundingClientRect();
  ndc.x = ((clientX - r.left) / r.width) * 2 - 1;
  ndc.y = -((clientY - r.top) / r.height) * 2 + 1;
  raycaster.setFromCamera(ndc, camera);
  // the pet hangs below the pointer; test each surface's hanging plane, highest first
  for (const s of SURFACES) {
    liftPlane.constant = s.y + LIFT_PLANE;
    if (!raycaster.ray.intersectPlane(liftPlane, liftPoint)) continue;
    if (!s.floor && !inRect(s.rect, liftPoint.x, liftPoint.z)) continue;
    lift.surface = s;
    const edge = FLOOR_EDGE - lift.pet.radius;
    lift.x = s.floor ? clamp(liftPoint.x, -edge, edge) : liftPoint.x;
    lift.z = s.floor ? clamp(liftPoint.z, -edge, edge) : liftPoint.z;
    break;
  }
  lift.land = landingSpot(lift.x, lift.z, lift.pet, lift.surface);
  landRing.position.set(lift.land.x, lift.land.s.y + 0.006, lift.land.z);
  landRing.visible = true;
}
// Find a clear spot on surface s near (x, z), sampling outward in rings; a full
// surface hands over to the floor below.
function landingSpot(x, z, p, s) {
  const clear = (nx, nz) => standClear(p, nx, nz, s) && pets.every((q) =>
    q === p || q.surface !== s || Math.hypot(q.x - nx, q.z - nz) >= p.radius + q.radius);
  if (clear(x, z)) return { x, z, s };
  const reach = s.floor ? 6 : Math.hypot(s.rect[2] - s.rect[0], s.rect[3] - s.rect[1]);
  const step = s.floor ? 0.12 : 0.02;
  for (let d = step; d < reach; d += step) {
    for (let i = 0; i < 20; i++) {
      const a = (i / 20) * Math.PI * 2;
      const nx = x + Math.cos(a) * d, nz = z + Math.sin(a) * d;
      if (clear(nx, nz)) return { x: nx, z: nz, s };
    }
  }
  if (!s.floor) return landingSpot(x, z, p, FLOOR);
  throw new Error("No clear pet landing spot");
}
function dropPet() {
  if (!lift) return;
  const p = lift.pet;
  const { x, z, s } = lift.land || landingSpot(p.x, p.z, p, lift.surface);
  lift = null;
  landRing.visible = false;
  p.held = false;
  p.surface = s; p.ground = s.y;
  if (REDUCED) {
    p.x = x; p.z = z;
    say(p.lines.land);
  } else {
    p.fall = { x, z, y: p.hang, vy: 0.4 };
  }
  p.timer = 2 + Math.random() * 2;
  renderer.domElement.style.cursor = "";
}

function pokePet(p) {
  if (p.held || p.fall) return;
  p.state = "idle"; p.visiting = null;
  p.timer = 2.5 + Math.random() * 2;
  faceCamera(p);
  if (Math.random() < TANTRUM_CHANCE) {   // sometimes a tap is one tap too many
    if (REDUCED) {   // just the move's pose and name, no wind-up or effects
      play(p, p.move); say(p.lines.move, 2000);
    } else {
      play(p, "tantrum"); say(p.lines.tantrum, 1500);
      p.cue = { kind: p.move, delay: ACT_LEN.tantrum };
    }
    return;
  }
  const kind = REDUCED ? "still" : p.taps[p.tapIdx++ % p.taps.length];
  if (!REDUCED) play(p, kind);
  say(p.lines[kind]);
  // the other pet notices when its friend is tapped nearby
  const q = pets.find((o) => o !== p);
  if (q && Math.hypot(q.x - p.x, q.z - p.z) < 1.4) {
    q.yawGoal = Math.atan2(p.x - q.x, p.z - q.z); q.headGoal = 0;
    q.timer = Math.max(q.timer, 2.5);
    if (!REDUCED && !q.act && q.state === "idle") q.cue = { kind: q.greet, delay: 0.4 };
  }
}

const LIGHTS = {};
const LIGHTING = {   // [day, night]
  ambient: [0.8, 0.42], hemi: [0.7, 0.38], key: [2.4, 1.15], lamp: [1.5, 3.6], glow: [0, 2.6],
  keyColor: [new THREE.Color("#fff4dc"), new THREE.Color("#d8dcff")],
  background: [new THREE.Color("#1c1838"), new THREE.Color("#15122b")],
};
function buildLights() {
  LIGHTS.ambient = new THREE.AmbientLight("#c7c2ff", 1);
  LIGHTS.hemi = new THREE.HemisphereLight("#9aa0e0", "#5a3a2a", 1);
  scene.add(LIGHTS.ambient, LIGHTS.hemi);

  const key = LIGHTS.key = new THREE.DirectionalLight("#ffffff", 1);
  key.position.set(4.5, 6.5, 4);
  key.target.position.set(-0.5, 0, -0.5);
  key.castShadow = true;
  key.shadow.mapSize.set(1024, 1024);
  key.shadow.bias = -0.0015;
  key.shadow.normalBias = 0.02;
  const s = key.shadow.camera;
  s.left = -5; s.right = 5; s.top = 5; s.bottom = -5; s.near = 1; s.far = 20;
  scene.add(key, key.target);

  LIGHTS.lamp = new THREE.PointLight("#ffd27a", 1, 3.5, 2);
  LIGHTS.lamp.position.set(2.45, 1.3, -2.55);
  scene.add(LIGHTS.lamp);

  LIGHTS.glow = new THREE.PointLight("#9ad8ff", 1, 3, 2);
  LIGHTS.glow.position.set(-1.9, 1.9, -2.5);
  scene.add(LIGHTS.glow);
  applyDaylight();
}

// Blend every light, the window sky and the background between day and night.
function applyDaylight() {
  const t = nightMix, mix = (pair) => pair[0] + (pair[1] - pair[0]) * t;
  LIGHTS.ambient.intensity = mix(LIGHTING.ambient);
  LIGHTS.hemi.intensity = mix(LIGHTING.hemi);
  LIGHTS.key.intensity = mix(LIGHTING.key);
  LIGHTS.key.color.copy(LIGHTING.keyColor[0]).lerp(LIGHTING.keyColor[1], t);
  LIGHTS.lamp.intensity = mix(LIGHTING.lamp);
  LIGHTS.glow.intensity = mix(LIGHTING.glow);
  MAT.skyNight.opacity = t;
  scene.background.copy(LIGHTING.background[0]).lerp(LIGHTING.background[1], t);
}

const dayNight = $("day-night");
function setNight(on, opts) {
  night = !!on;
  dayNight.setAttribute("aria-pressed", night ? "true" : "false");
  dayNight.title = (night ? "Switch to day" : "Switch to night") + " (N)";
  $("day-night-label").textContent = night ? "Night" : "Day";
  if (!opts || !opts.silent) {
    try { localStorage.setItem(DAYLIGHT_KEY, night ? "night" : "day"); } catch (_) { /* storage unavailable */ }
    announce.textContent = night ? "Night time" : "Day time";
    if (!REDUCED) {   // the pets notice: a yawn at lights-out, a stretch at sunrise
      pets.forEach((p, i) => { p.cue = { kind: night ? "yawn" : p.greet, delay: 0.3 + i * 0.5 }; });
      say(night ? "Piplup & Gible: *yawn*" : "Piplup: pip! · Gible: gib!", 2000);
    }
  }
  if (REDUCED) { nightMix = night ? 1 : 0; applyDaylight(); }
}

function hotspot(key, group, pose) {
  group.userData.key = key;
  group.traverse((o) => { o.userData.key = key; });
  const def = PA.sections[key];
  hotspots.push({ key, group, label: def.label, title: def.title(), hint: def.hint, pose });
}

/* ------------------------------------------------------------------ */
/* Camera                                                              */
/* ------------------------------------------------------------------ */
const cam = {
  pos: new THREE.Vector3(),
  target: new THREE.Vector3(),
  goalPos: new THREE.Vector3(),
  goalTarget: new THREE.Vector3(),
};
const HOME = { target: new THREE.Vector3(-0.1, 1.15, -0.55), dir: new THREE.Vector3(0.66, 0.42, 0.62).normalize(), dist: 7.3 };
const parallax = { x: 0, y: 0 };
let current = null; // open section key

function homePose() {
  const aspect = camera.aspect;
  const dist = HOME.dist * Math.max(1, Math.pow(1.45 / aspect, 0.9));
  const pos = HOME.target.clone().add(HOME.dir.clone().multiplyScalar(dist));
  return { pos, target: HOME.target.clone() };
}

function panelShift() {
  // Keep the object out from under the panel: pan the target sideways.
  const W = window.innerWidth, H = window.innerHeight;
  if (W <= 900) return { x: 0, y: -0.18 };
  const panelW = Math.min(440, W - 48) + 24;
  return { x: (panelW / W) * 0.5, y: 0 };
}

function setGoal(pos, target, shift) {
  cam.goalPos.copy(pos);
  cam.goalTarget.copy(target);
  if (shift) {
    const dir = target.clone().sub(pos);
    const dist = dir.length();
    dir.normalize();
    const right = new THREE.Vector3().crossVectors(dir, new THREE.Vector3(0, 1, 0)).normalize();
    const up = new THREE.Vector3().crossVectors(right, dir).normalize();
    const halfH = dist * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
    const halfW = halfH * camera.aspect;
    const dx = right.multiplyScalar(halfW * 2 * shift.x);
    const dy = up.multiplyScalar(halfH * 2 * shift.y);
    cam.goalPos.add(dx).add(dy);
    cam.goalTarget.add(dx).add(dy);
  }
  if (REDUCED) {
    cam.pos.copy(cam.goalPos);
    cam.target.copy(cam.goalTarget);
  }
  markMoved(false);
}

function goHome() {
  const h = homePose();
  setGoal(h.pos, h.target);
}

function frameSpot(spot) {
  const target = new THREE.Vector3(...spot.pose.target);
  const pos = new THREE.Vector3(...spot.pose.pos);
  const scale = Math.max(1, Math.pow(1.45 / camera.aspect, 0.9));
  pos.sub(target).multiplyScalar(scale).add(target);
  setGoal(pos, target, panelShift());
}

/* ------------------------------------------------------------------ */
/* Free look: orbit, pan and zoom around the current view              */
/* ------------------------------------------------------------------ */
const UP = new THREE.Vector3(0, 1, 0);
const VIEW = {
  theta: [-0.4, 1.95],   // azimuth, 0 looks along -z at the back wall; stays on the open side
  phi: [0.08, 1.3],      // elevation above the floor
  dist: [1.6, 12],
  wall: -2.8,            // the walls stand at x = -3 and z = -3
  top: 5.8,
  box: { x: [-2.5, 2.5], y: [0.15, 2.5], z: [-2.5, 2.5] },
};
const viewReset = $("view-reset");
let viewMoved = false;
let gesture = null;         // active drag: { mode: orbit | pan | pinch, ... }
const pointers = new Map(); // pointerId -> { x, y }

function markMoved(on) {
  viewMoved = on;
  viewReset.hidden = !on;
}
function orbitOf(pos, target) {
  const d = pos.clone().sub(target);
  const dist = Math.max(1e-4, d.length());
  return { dist, phi: Math.asin(THREE.MathUtils.clamp(d.y / dist, -1, 1)), theta: Math.atan2(d.x, d.z) };
}
function dirOf(theta, phi) {
  return new THREE.Vector3(Math.cos(phi) * Math.sin(theta), Math.sin(phi), Math.cos(phi) * Math.cos(theta));
}
const clamp = THREE.MathUtils.clamp;

// n: { dTheta, dPhi, zoom, panX, panY } (angles in radians, pan in CSS pixels)
function nudgeView(n) {
  const o = orbitOf(cam.goalPos, cam.goalTarget);
  const t = cam.goalTarget.clone();
  if (n.panX || n.panY) {
    const look = dirOf(o.theta, o.phi).negate();
    const right = new THREE.Vector3().crossVectors(look, UP).normalize();
    const up = new THREE.Vector3().crossVectors(right, look).normalize();
    const k = o.dist * 0.0011;
    t.addScaledVector(right, -(n.panX || 0) * k).addScaledVector(up, (n.panY || 0) * k);
    t.x = clamp(t.x, VIEW.box.x[0], VIEW.box.x[1]);
    t.y = clamp(t.y, VIEW.box.y[0], VIEW.box.y[1]);
    t.z = clamp(t.z, VIEW.box.z[0], VIEW.box.z[1]);
  }
  o.theta = clamp(o.theta + (n.dTheta || 0), VIEW.theta[0], VIEW.theta[1]);
  o.phi = clamp(o.phi + (n.dPhi || 0), VIEW.phi[0], VIEW.phi[1]);
  o.dist = clamp(o.dist * (n.zoom || 1), VIEW.dist[0], VIEW.dist[1]);
  const dir = dirOf(o.theta, o.phi);
  // never go through the walls or above the room
  if (dir.x < -1e-4) o.dist = Math.min(o.dist, (t.x - VIEW.wall) / -dir.x);
  if (dir.z < -1e-4) o.dist = Math.min(o.dist, (t.z - VIEW.wall) / -dir.z);
  if (dir.y > 1e-4) o.dist = Math.min(o.dist, (VIEW.top - t.y) / dir.y);
  o.dist = Math.max(o.dist, 0.5);
  cam.goalTarget.copy(t);
  cam.goalPos.copy(t).addScaledVector(dir, o.dist);
  if (REDUCED) {
    cam.pos.copy(cam.goalPos);
    cam.target.copy(cam.goalTarget);
  }
  markMoved(true);
}

function resetView() {
  const spot = current && hotspots.find((h) => h.key === current);
  if (spot) frameSpot(spot); else goHome();
}

/* ------------------------------------------------------------------ */
/* Panel / sections                                                    */
/* ------------------------------------------------------------------ */
function open(key, opts) {
  const spot = hotspots.find((h) => h.key === key);
  if (!spot) return;
  current = key;
  panelTitle.textContent = spot.title;
  panelBody.innerHTML = PA.render(key, true);
  panel.hidden = false;
  requestAnimationFrame(() => panel.classList.add("open"));
  panel.scrollTop = 0;
  navLinks.forEach((a) => a.classList.toggle("on", a.dataset.go === key));
  frameSpot(spot);
  if (!opts || !opts.fromHash) history.replaceState(null, "", "#" + key);
  announce.textContent = "Opened " + spot.label + ": " + spot.title;
  if (!opts || opts.focus !== false) panel.focus({ preventScroll: true });
  hideHint();
}

function close(opts) {
  if (!current) return;
  current = null;
  panel.classList.remove("open");
  const done = () => { if (!current) panel.hidden = true; };
  if (REDUCED) done(); else setTimeout(done, 230);
  navLinks.forEach((a) => a.classList.remove("on"));
  goHome();
  if (!opts || !opts.fromHash) history.replaceState(null, "", location.pathname + location.search);
  announce.textContent = "Back to the room";
}

function applyHash() {
  const key = location.hash.replace("#", "");
  if (PA.sections[key]) open(key, { fromHash: true, focus: false });
  else close({ fromHash: true });
}

/* ------------------------------------------------------------------ */
/* Pointer interaction                                                 */
/* ------------------------------------------------------------------ */
const raycaster = new THREE.Raycaster();
const ndc = new THREE.Vector2();
let hovered = null;
let pressAt = null;

function pick(clientX, clientY) {
  const r = renderer.domElement.getBoundingClientRect();
  ndc.x = ((clientX - r.left) / r.width) * 2 - 1;
  ndc.y = -((clientY - r.top) / r.height) * 2 + 1;
  raycaster.setFromCamera(ndc, camera);
  const hits = raycaster.intersectObjects(scene.children, true);
  for (const h of hits) {
    let o = h.object;
    while (o) {
      if (o.userData.key) return { kind: "spot", key: o.userData.key, point: h.point };
      const toy = toys.find((t) => t.group === o);
      if (toy) return { kind: "toy", toy, point: h.point };
      const pet = pets.find((p) => p.group === o);
      if (pet) return { kind: "pet", pet, point: h.point };
      o = o.parent;
    }
    return null; // first hit is something inert (wall, floor, furniture)
  }
  return null;
}

function setHover(spot) {
  if (hovered === spot) return;
  if (hovered) tint(hovered.group, 0);
  hovered = spot;
  if (hovered) tint(hovered.group, 1);
  renderer.domElement.style.cursor = hovered ? "pointer" : "";
}
function tint(group, on) {
  group.traverse((o) => {
    if (o.isMesh && o.material && o.material.emissive) {
      if (!o.userData.mat) o.userData.mat = o.material;
      if (on) {
        if (!o.userData.hi) {
          o.userData.hi = o.userData.mat.clone();
          o.userData.hi.emissive = new THREE.Color("#ffd24d");
          o.userData.hi.emissiveIntensity = 0.22;
        }
        o.material = o.userData.hi;
      } else {
        o.material = o.userData.mat;
      }
    }
  });
}

function showHint(x, y, label, sub) {
  hint.innerHTML = PA.esc(label) + "<small>" + PA.esc(sub) + " · click</small>";
  const pad = 16;
  const w = hint.offsetWidth, h = hint.offsetHeight;
  const px = Math.min(x + pad, window.innerWidth - w - 8);
  const py = Math.min(y + pad, window.innerHeight - h - 8);
  hint.style.transform = "translate(" + px + "px," + py + "px)";
}
function hideHint() { hint.style.transform = "translate(-9999px,-9999px)"; }

function onMove(e) {
  if (onGesture(e)) return;
  if (e.pointerType === "touch") return;
  const W = window.innerWidth, H = window.innerHeight;
  parallax.x = (e.clientX / W - 0.5) * 2;
  parallax.y = (e.clientY / H - 0.5) * 2;
  if (loader && !loader.hidden) return;
  const hit = pick(e.clientX, e.clientY);
  if (hit && hit.kind === "spot") {
    const spot = hotspots.find((h) => h.key === hit.key);
    setHover(spot);
    showHint(e.clientX, e.clientY, spot.label, spot.title);
  } else {
    setHover(null);
    if (hit && hit.kind === "pet") showHint(e.clientX, e.clientY, hit.pet.name, "tap to say hi · drag to lift");
    else hideHint();
    renderer.domElement.style.cursor = hit ? "pointer" : "";
  }
}

function pinchFrom() {
  const [a, b] = Array.from(pointers.values());
  return { mode: "pinch", span: Math.hypot(b.x - a.x, b.y - a.y), mx: (a.x + b.x) / 2, my: (a.y + b.y) / 2, dragged: true };
}

function onDown(e) {
  pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
  try { renderer.domElement.setPointerCapture(e.pointerId); } catch (_) { /* not supported */ }
  if (pointers.size === 1) {
    pressAt = { x: e.clientX, y: e.clientY, t: performance.now() };
    const mode = e.button === 2 || e.shiftKey ? "pan" : "orbit";
    gesture = { mode, x: e.clientX, y: e.clientY, dragged: false };
    if (mode === "orbit" && (!loader || loader.hidden)) {
      const hit = pick(e.clientX, e.clientY);
      if (hit && hit.kind === "pet" && !hit.pet.held && !hit.pet.fall) gesture.pet = hit.pet;   // a drag lifts it
    }
  } else {
    pressAt = null;
    dropPet();   // a second finger means a pinch, not a carry
    gesture = pinchFrom();
  }
}

// Returns true while the pointer belongs to a drag, pinch or pan.
function onGesture(e) {
  const p = pointers.get(e.pointerId);
  if (!p || !gesture) return false;
  p.x = e.clientX; p.y = e.clientY;
  if (gesture.mode === "pinch") {
    if (pointers.size < 2) return true;
    const n = pinchFrom();
    nudgeView({ zoom: gesture.span / Math.max(1, n.span), panX: n.mx - gesture.mx, panY: n.my - gesture.my });
    gesture.span = n.span; gesture.mx = n.mx; gesture.my = n.my;
    return true;
  }
  const dx = e.clientX - gesture.x, dy = e.clientY - gesture.y;
  if (!gesture.dragged) {
    if (pressAt && Math.hypot(e.clientX - pressAt.x, e.clientY - pressAt.y) < 6) return true;
    gesture.dragged = true;
    setHover(null);
    hideHint();
    if (gesture.pet) { gesture.mode = "lift"; liftPet(gesture.pet, e.pointerId, e.clientX, e.clientY); }
  }
  gesture.x = e.clientX; gesture.y = e.clientY;
  if (gesture.mode === "lift") { if (lift) moveLift(e.clientX, e.clientY); }
  else if (gesture.mode === "pan") nudgeView({ panX: dx, panY: dy });
  else nudgeView({ dTheta: -dx * 0.0045, dPhi: dy * 0.0045 });
  return true;
}

function endPointer(e) {
  pointers.delete(e.pointerId);
  if (pointers.size === 0) gesture = null;
  else if (pointers.size === 1) {
    const p = pointers.values().next().value;
    gesture = { mode: "orbit", x: p.x, y: p.y, dragged: true };
  } else gesture = pinchFrom();
}

function onUp(e) {
  const wasDrag = gesture && gesture.dragged;
  if (lift && lift.pointerId === e.pointerId) dropPet();
  endPointer(e);
  if (!pressAt) return;
  const moved = Math.hypot(e.clientX - pressAt.x, e.clientY - pressAt.y);
  const dt = performance.now() - pressAt.t;
  pressAt = null;
  if (wasDrag || pointers.size || moved > 8 || dt > 600) return;
  const hit = pick(e.clientX, e.clientY);
  if (hit && hit.kind === "spot") open(hit.key);
  else if (hit && hit.kind === "toy") poke(hit.toy);
  else if (hit && hit.kind === "pet") pokePet(hit.pet);
  else if (current) close();
}

function onCancel(e) {
  if (lift && lift.pointerId === e.pointerId) dropPet();
  endPointer(e);
  pressAt = null;
}

function onWheel(e) {
  e.preventDefault();
  const unit = e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? 400 : 1;
  // trackpad pinch arrives as a ctrl+wheel with small deltas
  nudgeView({ zoom: Math.exp(e.deltaY * unit * (e.ctrlKey ? 0.01 : 0.0012)) });
}

let toastTimer = 0;
function say(text, ms) {
  toast.textContent = text;
  toast.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove("show"), ms || 1600);
}
function poke(toy) {
  toy.t = 1;
}

/* ------------------------------------------------------------------ */
/* Keyboard                                                            */
/* ------------------------------------------------------------------ */
const VIEW_KEYS = {
  ArrowLeft: { dTheta: 0.12 }, ArrowRight: { dTheta: -0.12 },
  ArrowUp: { dPhi: 0.08 }, ArrowDown: { dPhi: -0.08 },
  "+": { zoom: 0.85 }, "=": { zoom: 0.85 }, "-": { zoom: 1 / 0.85 }, "_": { zoom: 1 / 0.85 },
};
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && current) { close(); e.preventDefault(); return; }
  if (e.target && (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA")) return;
  if (e.metaKey || e.ctrlKey || e.altKey) return;
  if (!panel.contains(e.target)) {
    if (VIEW_KEYS[e.key]) { nudgeView(VIEW_KEYS[e.key]); e.preventDefault(); return; }
    if (e.key === "0" || e.key === "Home") { resetView(); e.preventDefault(); return; }
    if (e.key === "n" || e.key === "N") { setNight(!night); e.preventDefault(); return; }
  }
  const n = parseInt(e.key, 10);
  if (n >= 1 && n <= PA.order.length) open(PA.order[n - 1]);
});
viewReset.addEventListener("click", () => resetView());
dayNight.addEventListener("click", () => setNight(!night));

navLinks.forEach((a) => {
  a.addEventListener("click", (e) => {
    e.preventDefault();
    open(a.dataset.go);
  });
});
$("home-link").addEventListener("click", (e) => { e.preventDefault(); close(); });
panelClose.addEventListener("click", () => close());
window.addEventListener("hashchange", applyHash);

/* ------------------------------------------------------------------ */
/* Render loop                                                         */
/* ------------------------------------------------------------------ */
let last = performance.now();
function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  step(dt);
  requestAnimationFrame(frame);
}
function step(dt) {

  // smooth exponential approach; much tighter while a finger or mouse is dragging
  const k = REDUCED ? 1 : 1 - Math.pow(gesture ? 1e-7 : 0.0025, dt);
  cam.pos.lerp(cam.goalPos, k);
  cam.target.lerp(cam.goalTarget, k);
  camera.position.copy(cam.pos);
  if (!current && !REDUCED) {
    camera.position.x += parallax.x * 0.22;
    camera.position.y -= parallax.y * 0.12;
  }
  camera.lookAt(cam.target);

  for (const toy of toys) {
    if (toy.t > 0) {
      toy.t = Math.max(0, toy.t - dt * 1.6);
      const b = Math.sin((1 - toy.t) * Math.PI * 3) * toy.t;
      toy.group.rotation.z = b * 0.5;
      toy.group.position.y = toy.baseY + Math.abs(b) * 0.05;
    }
  }
  stepPets(dt);

  const goal = night ? 1 : 0;
  if (nightMix !== goal) {
    nightMix = REDUCED ? goal : goal + (nightMix - goal) * Math.pow(0.08, dt);
    if (Math.abs(nightMix - goal) < 0.002) nightMix = goal;
    applyDaylight();
  }

  renderer.render(scene, camera);
}

function resize() {
  const W = window.innerWidth, H = window.innerHeight;
  camera.aspect = W / H;
  camera.updateProjectionMatrix();
  renderer.setSize(Math.floor(W * RENDER_SCALE), Math.floor(H * RENDER_SCALE), false);
  if (viewMoved) nudgeView({});
  else if (!current) goHome();
  else open(current, { fromHash: true, focus: false });
}

/* ------------------------------------------------------------------ */
/* Boot                                                                */
/* ------------------------------------------------------------------ */
async function boot() {
  try {
    await progress();
    renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: "high-performance" });
    renderer.setPixelRatio(1);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFShadowMap;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.domElement.setAttribute("aria-hidden", "true");
    stage.appendChild(renderer.domElement);

    scene = new THREE.Scene();
    scene.background = new THREE.Color("#15122b");
    camera = new THREE.PerspectiveCamera(38, 1, 0.1, 60);

    await progress();
    buildTextures();
    buildMaterials();
    await progress();
    buildRoom();
    await progress();
    buildFurniture();
    await progress();
    buildPets();
    buildParticles();
    buildLandRing();
    await progress();
    buildLights();
    setNight(night, { silent: true });
    await progress();

    resize();
    cam.pos.copy(cam.goalPos);
    cam.target.copy(cam.goalTarget);
    window.addEventListener("resize", resize);
    const el = renderer.domElement;
    el.addEventListener("pointermove", onMove);
    el.addEventListener("pointerdown", onDown);
    el.addEventListener("pointerup", onUp);
    el.addEventListener("pointercancel", onCancel);
    el.addEventListener("pointerleave", () => { setHover(null); hideHint(); });
    el.addEventListener("wheel", onWheel, { passive: false });
    el.addEventListener("contextmenu", (e) => e.preventDefault());

    renderer.render(scene, camera);
    await progress("Ready");
    requestAnimationFrame(frame);

    applyHash();
    const hide = () => {
      loader.classList.add("hide");
      setTimeout(() => { loader.hidden = true; }, REDUCED ? 0 : 420);
      if (!current) say("Drag to look around · scroll or pinch to zoom", 3200);
    };
    if (REDUCED) hide(); else setTimeout(hide, 380);
    window.PA_READY = true;
  } catch (err) {
    console.error(err);
    failToPlain("This browser could not draw the room. Taking you to the plain version.");
  }
}

boot();
