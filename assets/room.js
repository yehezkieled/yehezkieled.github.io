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
  Pet skins are painted for a SphereGeometry: canvas x runs around the body
  (u = 0.25 is the front, 0.75 the back), canvas y runs top to bottom. They
  are drawn larger and sampled smoothly so the edges stay clean up close.
*/
const PIP = { light: "#5fb6ea", dark: "#2a57aa", eye: "#172552", beak: "#f3c640", white: "#f7fbff" };
const GIB = { blue: "#4c84d6", navy: "#2b4a97", belly: "#e4463b", mouth: "#5e1a26", tongue: "#e86a7d", eye: "#ffd24d" };

function buildPetTextures() {
  // Piplup body: cape over the back and shoulders, white belly, two chest marks.
  TEX.pipBody = makeTex(256, 128, (ctx, w, h) => {
    ctx.fillStyle = PIP.light; ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = PIP.dark;
    ctx.beginPath();
    ctx.moveTo(0, 0); ctx.lineTo(w, 0); ctx.lineTo(w, 0.55 * h);
    ctx.quadraticCurveTo(0.92 * w, 0.84 * h, 0.75 * w, 0.84 * h);
    ctx.quadraticCurveTo(0.58 * w, 0.84 * h, 0.5 * w, 0.55 * h);
    ctx.quadraticCurveTo(0.44 * w, 0.3 * h, 0.36 * w, 0.12 * h);
    ctx.lineTo(0.14 * w, 0.12 * h);
    ctx.quadraticCurveTo(0.06 * w, 0.3 * h, 0, 0.55 * h);
    ctx.closePath(); ctx.fill();
    ctx.fillStyle = PIP.white;
    ctx.beginPath(); ctx.ellipse(0.25 * w, 0.66 * h, 0.14 * w, 0.27 * h, 0, 0, Math.PI * 2); ctx.fill();
    for (const u of [0.215, 0.285]) {
      ctx.beginPath(); ctx.arc(u * w, 0.33 * h, 0.028 * w, 0, Math.PI * 2); ctx.fill();
    }
  }, null, true);

  // Piplup head: the cape hoods the crown and back, dipping to a point between the eyes.
  TEX.pipHead = makeTex(256, 128, (ctx, w, h) => {
    ctx.fillStyle = PIP.light; ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = PIP.dark;
    ctx.beginPath();
    ctx.moveTo(0, 0); ctx.lineTo(w, 0); ctx.lineTo(w, 0.36 * h);
    ctx.lineTo(0.88 * w, 0.78 * h);
    ctx.quadraticCurveTo(0.75 * w, 0.88 * h, 0.62 * w, 0.78 * h);
    ctx.lineTo(0.5 * w, 0.36 * h);
    ctx.quadraticCurveTo(0.44 * w, 0.3 * h, 0.36 * w, 0.3 * h);
    ctx.lineTo(0.25 * w, 0.46 * h);
    ctx.lineTo(0.14 * w, 0.3 * h);
    ctx.quadraticCurveTo(0.06 * w, 0.3 * h, 0, 0.36 * h);
    ctx.closePath(); ctx.fill();
  }, null, true);
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
function ball(r, material, x, y, z, seg) {
  const m = new THREE.Mesh(new THREE.SphereGeometry(r, seg || 10, seg || 8), material);
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
  MAT.pipBody = mat("#ffffff", { map: TEX.pipBody });
  MAT.pipHead = mat("#ffffff", { map: TEX.pipHead });
  MAT.pipDark = mat(PIP.dark);
  MAT.pipEye = mat(PIP.eye);
  MAT.pipWhite = mat(PIP.white);
  MAT.beak = mat(PIP.beak);
  MAT.gibBlue = mat(GIB.blue);
  MAT.gibNavy = mat(GIB.navy);
  MAT.gibBelly = mat(GIB.belly);
  MAT.gibMouth = mat(GIB.mouth, { side: THREE.DoubleSide });
  MAT.gibTongue = mat(GIB.tongue);
  MAT.gibEye = mat(GIB.eye);
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
// floor footprints of the furniture: [x1, z1, x2, z2]
const OBSTACLES = [
  [-2.7, -3.0, -1.1, -0.78],  // bed
  [-3.0, -0.65, -2.35, -0.05], // nightstand
  [-3.0, 0.3, -2.2, 1.9],      // TV stand
  [0.75, -3.0, 2.65, -2.1],    // desk
  [0.88, -2.22, 1.42, -1.68],  // chair
  [-2.75, 2.05, -2.15, 2.65],  // plant
];

function floorClear(x, z, r) {
  if (Math.abs(x) > FLOOR_EDGE - r || Math.abs(z) > FLOOR_EDGE - r) return false;
  for (const [x1, z1, x2, z2] of OBSTACLES) {
    if (x > x1 - r && x < x2 + r && z > z1 - r && z < z2 + r) return false;
  }
  return true;
}
function pathClear(ax, az, bx, bz, r) {
  const n = Math.max(1, Math.ceil(Math.hypot(bx - ax, bz - az) / 0.08));
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    if (!floorClear(ax + (bx - ax) * t, az + (bz - az) * t, r)) return false;
  }
  return true;
}

/* Sculpting helpers: the pets are smoother than the furniture, so they get
   more segments, lathed and extruded parts, and sphere slices as decals. */
function ellipsoid(rx, ry, rz, material, x, y, z, seg) {
  const m = ball(1, material, x, y, z, seg || 16);
  m.scale.set(rx, ry, rz);
  return m;
}
function sphereSlice(r, material, phiStart, phiLen, thetaStart, thetaLen, seg) {
  const m = new THREE.Mesh(new THREE.SphereGeometry(r, seg || 28, 18, phiStart, phiLen, thetaStart, thetaLen), material);
  m.castShadow = true; m.receiveShadow = true;
  return m;
}
function disc(r, material, y, up) {
  const m = new THREE.Mesh(new THREE.CircleGeometry(r, 28), material);
  m.rotation.x = up ? -Math.PI / 2 : Math.PI / 2;
  m.position.y = y;
  return m;
}
function lathe(profile, material, seg) {
  const geo = new THREE.LatheGeometry(profile.map(([x, y]) => new THREE.Vector2(x, y)), seg || 12);
  const m = new THREE.Mesh(geo, material);
  m.castShadow = true; m.receiveShadow = true;
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
// Merge small same-material pieces (teeth, toes) into one mesh.
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
const smooth = (u) => u * u * (3 - 2 * u);

function buildPets() {
  buildPiplup();
  buildGible();
}

// Piplup: a plump little penguin. Light blue, dark cape, yellow beak and feet. Faces +z.
function buildPiplup() {
  const g = new THREE.Group();

  const body = new THREE.Group();
  body.position.y = 0.175;
  body.add(ellipsoid(0.14, 0.16, 0.135, MAT.pipBody, 0, 0, 0, 28));
  [-1, 1].forEach((s) => {   // the cape ends in two points behind the body
    const tail = cyl(0, 0.03, 0.12, MAT.pipDark, s * 0.05, -0.07, -0.12, 6);
    tail.scale.z = 0.5;
    tail.rotation.x = Math.PI + 0.55;
    tail.rotation.z = -s * 0.2;
    body.add(tail);
  });
  g.add(body);

  const head = new THREE.Group();
  head.position.set(0, 0.385, 0.01);
  head.add(ellipsoid(0.125, 0.12, 0.125, MAT.pipHead, 0, 0, 0, 28));
  const eyes = [-1, 1].map((s) => {   // big navy ovals with a catchlight
    const e = new THREE.Group();
    const a = s * 0.46;
    e.position.set(Math.sin(a) * 0.117, 0.012, Math.cos(a) * 0.117);
    e.rotation.y = a;
    e.add(ellipsoid(0.026, 0.038, 0.012, MAT.pipEye, 0, 0, 0, 14));
    e.add(ball(0.009, MAT.pipWhite, -s * 0.007, 0.014, 0.011, 8));
    head.add(e);
    return e;
  });
  const beak = new THREE.Group();
  beak.position.set(0, -0.028, 0.112);
  const upper = cyl(0, 0.032, 0.078, MAT.beak, 0, 0.004, 0.03, 8);
  upper.rotation.x = Math.PI / 2; upper.scale.z = 0.8;
  const lower = cyl(0, 0.024, 0.058, MAT.beak, 0, -0.012, 0.02, 8);
  lower.rotation.x = Math.PI / 2; lower.scale.z = 0.7;
  beak.add(upper, lower);
  head.add(beak);
  const crest = new THREE.Group();   // three-point crown
  crest.position.set(0, 0.1, -0.012);
  const mid = cyl(0, 0.028, 0.1, MAT.pipDark, 0, 0.04, 0, 6);
  mid.rotation.x = -0.25;
  crest.add(mid);
  [-1, 1].forEach((s) => {
    const side = cyl(0, 0.02, 0.07, MAT.pipDark, s * 0.036, 0.018, 0, 6);
    side.rotation.set(-0.2, 0, -s * 0.6);
    crest.add(side);
  });
  head.add(crest);
  g.add(head);

  const flipperProfile = [[0, 0], [0.55, 0.12], [0.9, 0.38], [1, 0.58], [0.75, 0.82], [0.3, 0.96], [0, 1]]
    .map(([x, y]) => [x * 0.05, -y * 0.19]).reverse();
  const flippers = [-1, 1].map((s) => {
    const f = new THREE.Group();
    f.position.set(s * 0.125, 0.255, 0.01);
    const blade = lathe(flipperProfile, MAT.pipDark, 12);
    blade.scale.x = 0.4;
    f.add(blade);
    g.add(f);
    return f;
  });

  const toe = new THREE.SphereGeometry(1, 8, 6);
  const footGeo = [placed(new THREE.SphereGeometry(1, 14, 10), 0, 0, 0, 0, 0, 0, 0.045, 0.022, 0.07)];
  [-1, 0, 1].forEach((i) => footGeo.push(placed(toe, i * 0.03, -0.002, 0.065, 0, i * 0.35, 0, 0.018, 0.016, 0.032)));
  const feet = [-1, 1].map((s) => {
    const foot = merged(footGeo, MAT.beak);
    foot.position.set(s * 0.055, 0.022, 0.035);
    g.add(foot);
    return foot;
  });

  addPet({
    name: "Piplup", group: g, x: 0.9, z: 0.9, yaw: 0.9, speed: 0.32, radius: 0.22,
    pose: posePiplup,
    idle: ["flap", "puff", "peck", "flap"],
    taps: ["hop", "puff", "flap", "spin", "peck"],
    greet: "flap",
    lines: {
      hop: "Piplup: pip-lup!", puff: "Piplup: *puffs out its chest*", flap: "Piplup: *flap flap*",
      spin: "Piplup: lup lup!", peck: "Piplup: pip!", still: "Piplup: pip-lup!",
      lift: "Piplup: lup?!", land: "Piplup: pip!",
    },
    parts: { body, head, eyes, beak, flippers, feet },
  });
}

// Gible: a big round shark head on stubby legs, almost all mouth. Faces +z.
function buildGible() {
  const g = new THREE.Group();
  const R = 0.2, TH = Math.PI * 0.6;          // mouth line sits just below the middle
  const ringR = R * Math.sin(TH), ringY = R * Math.cos(TH);

  const head = new THREE.Group();
  head.position.y = 0.255;
  head.scale.set(1.06, 0.97, 1);   // a touch wider than tall
  head.add(sphereSlice(R, MAT.gibBlue, 0, Math.PI * 2, 0, TH));                   // crown down to the upper lip
  head.add(sphereSlice(R, MAT.gibBlue, Math.PI, Math.PI, TH, Math.PI - TH));      // solid back below the lip
  head.add(sphereSlice(R - 0.008, MAT.gibMouth, Math.PI, Math.PI, TH, Math.PI - TH)); // dark inside wall
  head.add(disc(ringR, MAT.gibMouth, ringY - 0.002, false));                      // roof of the mouth

  // lower jaw: the front half below the lip, hinged at the center so it swings open as a wedge
  const jaw = new THREE.Group();
  jaw.add(sphereSlice(R, MAT.gibBlue, 0, Math.PI, TH, Math.PI - TH));
  jaw.add(sphereSlice(R + 0.004, MAT.gibBelly, Math.PI * 0.08, Math.PI * 0.84, TH + 0.08, Math.PI - TH - 0.3)); // red underside
  jaw.add(disc(ringR, MAT.gibMouth, ringY + 0.002, true));                        // floor of the mouth
  jaw.add(ellipsoid(0.075, 0.018, 0.085, MAT.gibTongue, 0, ringY + 0.01, 0.05, 14));
  head.add(jaw);

  // teeth: one merged strip hanging from the upper lip, one standing on the jaw
  const tooth = new THREE.ConeGeometry(0.013, 0.04, 5);
  const strip = (n, offset, down) => {
    const parts = [];
    for (let i = 0; i < n; i++) {
      const a = -1.75 + (3.5 * (i + offset)) / (n - 1 + offset * 2);
      const r = ringR + 0.003;
      parts.push(placed(tooth, Math.sin(a) * r, ringY + (down ? -0.012 : 0.012), Math.cos(a) * r,
        down ? Math.PI - 0.2 : 0.2, a, 0));
    }
    return merged(parts, MAT.cream);
  };
  head.add(strip(7, 0, true));
  jaw.add(strip(6, 0.5, false));

  // eyes: small yellow eyes with dark pupils, set high on the sides
  const eyes = [-1, 1].map((s) => {
    const e = new THREE.Group();
    const a = s * 0.62, th = Math.PI * 0.4;
    const dir = new THREE.Vector3(Math.sin(a) * Math.sin(th), Math.cos(th), Math.cos(a) * Math.sin(th));
    e.position.copy(dir).multiplyScalar(R - 0.004);
    e.lookAt(dir.clone().multiplyScalar(2).add(head.position));
    e.add(ellipsoid(0.036, 0.032, 0.006, MAT.gibNavy, 0, 0, 0, 14));
    e.add(ellipsoid(0.028, 0.025, 0.01, MAT.gibEye, 0, 0, 0.003, 14));
    e.add(ellipsoid(0.011, 0.016, 0.008, MAT.ink, s * 0.004, 0, 0.01, 10));
    e.add(ball(0.005, MAT.pipWhite, s * 0.008, 0.008, 0.016, 6));
    head.add(e);
    return e;
  });

  // dorsal fin with a notched trailing edge
  const fin = extruded([[0.07, 0], [0.065, 0.07], [0.02, 0.15], [-0.03, 0.2], [-0.07, 0.11], [-0.045, 0.09], [-0.085, 0.04], [-0.09, 0]], 0.05, MAT.gibNavy);
  fin.rotation.y = -Math.PI / 2;
  fin.position.set(0, R - 0.035, -0.03);
  head.add(fin);

  // side jets: tapered fins sweeping back and out from each side of the head
  [-1, 1].forEach((s) => {
    const holder = new THREE.Group();
    holder.position.set(s * (R - 0.06), 0.03, -0.02);
    holder.rotation.set(0, s * (Math.PI / 2 + 0.75), s * 0.12);   // local +z (the point) goes back and out
    const jet = cyl(0, 0.07, 0.24, MAT.gibNavy, 0, 0.06, 0, 8);
    jet.rotation.x = Math.PI / 2;   // point along local +z, which the holder turns outward
    jet.scale.set(1, 1, 0.4);       // flat
    holder.add(jet);
    head.add(holder);
  });
  g.add(head);

  const tail = new THREE.Group();
  tail.position.set(0, 0.17, -0.16);
  const cone = cyl(0, 0.06, 0.2, MAT.gibBlue, 0, 0, -0.09, 10);
  cone.rotation.x = -Math.PI / 2;
  tail.add(cone);
  const tailFin = extruded([[0.03, 0], [-0.03, 0.08], [-0.07, 0]], 0.025, MAT.gibNavy);
  tailFin.rotation.y = -Math.PI / 2;
  tailFin.position.set(0, 0.015, -0.13);
  tail.add(tailFin);
  g.add(tail);

  const legs = [-1, 1].map((s) => {
    const leg = new THREE.Group();
    leg.position.set(s * 0.085, 0, 0.02);
    leg.add(cyl(0.042, 0.05, 0.12, MAT.gibBlue, 0, 0.06, 0, 12));
    leg.add(ellipsoid(0.055, 0.02, 0.07, MAT.gibNavy, 0, 0.014, 0.025, 12));
    g.add(leg);
    return leg;
  });

  addPet({
    name: "Gible", group: g, x: 1.9, z: 1.6, yaw: -0.6, speed: 0.4, radius: 0.26,
    pose: poseGible,
    idle: ["chomp", "chomps", "wag", "wag"],
    taps: ["chomp", "spin", "chomps", "shake"],
    greet: "chomps",
    lines: {
      chomp: "Gible: *chomp!*", chomps: "Gible: gib gib gib!", spin: "Gible: gib!",
      shake: "Gible: *wiggles*", wag: "Gible: gib?", still: "Gible: gib gib!",
      lift: "Gible: gib gib?!", land: "Gible: gib!",
    },
    parts: { head, jaw, eyes, tail, legs },
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
  };
  p.group.position.set(p.x, 0.02, p.z);
  p.group.rotation.y = p.yaw;
  p.group.userData.pet = true;
  scene.add(p.group);
  pets.push(p);
}

/* Short animations. ACT_LEN sets each act's duration in seconds; p.actT runs 1 -> 0. */
const ACT_LEN = { hop: 0.9, flap: 1.1, puff: 1.6, spin: 1.0, peck: 0.9, chomp: 0.9, chomps: 1.2, shake: 1.1, wag: 1.3, yawn: 1.8, land: 0.7 };
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
  for (let i = 0; i < 24; i++) {
    const reach = 0.6 + Math.random() * 1.6;
    const a = Math.random() * Math.PI * 2;
    const x = p.x + Math.cos(a) * reach, z = p.z + Math.sin(a) * reach;
    if (!floorClear(x, z, p.radius)) continue;
    if (other && Math.hypot(other.x - x, other.z - z) < 0.6) continue;
    if (!pathClear(p.x, p.z, x, z, p.radius)) continue;
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
  if (!b || a.state !== "idle" || b.state !== "idle" || a.act || b.act || a.held || b.held || a.fall || b.fall) { meetTimer = 6; return; }
  const p = Math.random() < 0.5 ? a : b, q = p === a ? b : a;
  for (let i = 0; i < 24; i++) {
    const ang = Math.random() * Math.PI * 2, d = p.radius + q.radius + 0.12;
    const x = q.x + Math.cos(ang) * d, z = q.z + Math.sin(ang) * d;
    if (!floorClear(x, z, p.radius) || !pathClear(p.x, p.z, x, z, p.radius)) continue;
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
    if (p.cue && (p.cue.delay -= dt) <= 0) { play(p, p.cue.kind); p.cue = null; }

    if (p.held) {   // dangling under the pointer; trail it a little so it swings
      const k = REDUCED ? 1 : Math.min(1, dt * 14);
      const nx = p.x + (lift.x - p.x) * k, nz = p.z + (lift.z - p.z) * k;
      p.vx = dt > 0 ? (nx - p.x) / dt : 0; p.vz = dt > 0 ? (nz - p.z) / dt : 0;
      p.x = nx; p.z = nz;
    } else if (p.fall) {   // dropped: fall onto the landing spot, then bounce
      const f = p.fall;
      f.vy -= dt * 7;
      f.y += f.vy * dt;
      const k = Math.min(1, dt * 10);
      p.x += (f.x - p.x) * k; p.z += (f.z - p.z) * k;
      if (f.y <= 0.02) {
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
      y: p.held ? LIFT_Y : p.fall ? p.fall.y : 0.02, rx: 0, rz: 0, spin: 0, sx: 1, sy: 1, sz: 1,
      walking: p.state === "walk" && !REDUCED,
      held: p.held && !REDUCED, falling: !!p.fall,
      kind: p.act, u: p.act ? 1 - p.actT : 0,
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
    p.group.position.set(p.x, o.y, p.z);
    p.group.rotation.set(o.rx, p.yaw + o.spin, o.rz);
    p.group.scale.set(o.sx, o.sy, o.sz);
    const lid = p.blink > 0 ? 0.1 : o.sleepy ? 0.55 : 1;
    for (const e of p.parts.eyes) e.scale.y = lid;
  }
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
    f.position.y = 0.022 + (o.walking ? Math.max(0, Math.sin(ph)) * 0.03 : 0);
    f.position.z = 0.035 + (o.walking ? Math.cos(ph) * 0.03 : 0);
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
  }
  if (o.held) {   // flaps in a panic, feet dangle
    flap += (0.5 + 0.5 * Math.sin(p.age * 16)) * 1.1;
    swing = Math.sin(p.age * 16) * 0.2;
    P.feet.forEach((f, i) => { f.position.y = 0.012 + Math.sin(p.age * 9 + i) * 0.01; });
  } else if (o.sleepy && !k && !o.walking) {
    headPitch += 0.18 + Math.sin(p.age * 1.4) * 0.05;   // nodding off
  }
  // chest puff: the body swells, the head tips back, the flippers brace behind
  P.body.scale.set(1 + puff * 0.1, 1 + puff * 0.04 + o.breathe, 1 + puff * 0.1);
  P.head.rotation.set(headPitch - puff * 0.35, p.headYaw, 0);
  P.head.position.y = 0.385 + o.breathe * 1.5 + puff * 0.012;
  P.flippers.forEach((f, i) => {
    const s = i ? 1 : -1;
    f.rotation.z = s * (flap - puff * 0.2);
    f.rotation.x = swing * s + puff * 0.5;
  });
}

function poseGible(p, o) {
  const P = p.parts, k = o.kind, u = o.u, bump = o.bump;
  const g = o.walking ? p.age * 7.5 : 0;
  let open = 0.07, wag = 0, tuck = 0;
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
  P.head.position.y = 0.255 + o.breathe * 1.2;
  P.head.scale.set(1.06 + o.breathe, 0.97 + o.breathe, 1 + o.breathe);
  P.legs.forEach((l) => { l.position.y = tuck * 0.03; });
}

/* Lifting: press and drag on a pet to carry it; it dangles below the pointer and
   drops onto a nearby clear floor spot when released. */
const LIFT_Y = 0.55;        // how high the pet hangs above the floor
const LIFT_PLANE = 1.05;    // the pointer ray is cut by this horizontal plane
let lift = null;            // { pet, pointerId, x, z }
const liftPlane = new THREE.Plane(new THREE.Vector3(0, -1, 0), LIFT_PLANE);
const liftPoint = new THREE.Vector3();

function liftPet(p, pointerId, clientX, clientY) {
  lift = { pet: p, pointerId, x: p.x, z: p.z };
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
  if (!raycaster.ray.intersectPlane(liftPlane, liftPoint)) return;
  const edge = FLOOR_EDGE - lift.pet.radius;
  lift.x = clamp(liftPoint.x, -edge, edge);
  lift.z = clamp(liftPoint.z, -edge, edge);
}
// Find a clear floor spot near (x, z), sampling outward in rings.
function landingSpot(x, z, p) {
  const clear = (nx, nz) => floorClear(nx, nz, p.radius) && pets.every((q) =>
    q === p || Math.hypot(q.x - nx, q.z - nz) >= p.radius + q.radius);
  if (clear(x, z)) return [x, z];
  for (let d = 0.12; d < 6; d += 0.12) {
    for (let i = 0; i < 20; i++) {
      const a = (i / 20) * Math.PI * 2;
      const nx = x + Math.cos(a) * d, nz = z + Math.sin(a) * d;
      if (clear(nx, nz)) return [nx, nz];
    }
  }
  throw new Error("No clear pet landing spot");
}
function dropPet() {
  if (!lift) return;
  const p = lift.pet;
  lift = null;
  p.held = false;
  const [x, z] = landingSpot(p.x, p.z, p);
  if (REDUCED) {
    p.x = x; p.z = z;
    say(p.lines.land);
  } else {
    p.fall = { x, z, y: LIFT_Y, vy: 0.4 };
  }
  p.timer = 2 + Math.random() * 2;
  renderer.domElement.style.cursor = "";
}

function pokePet(p) {
  if (p.held || p.fall) return;
  p.state = "idle"; p.visiting = null;
  p.timer = 2.5 + Math.random() * 2;
  faceCamera(p);
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
