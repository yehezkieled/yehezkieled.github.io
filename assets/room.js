/*
  The 3D room. Everything here is built from primitives and canvas-drawn
  pixel textures at load time; nothing is downloaded except three.js.

  Hotspots (clickable section objects):
    PC on the desk        -> about
    badge case on wall    -> work
    TV + console          -> projects
    red handheld on desk  -> posts
    phone on nightstand   -> online
  Plush creatures and the shelf balls are decorative and react when clicked.
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
  "Tucking in the plushies",
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
function makeTex(w, h, draw, repeat) {
  const c = document.createElement("canvas");
  c.width = w; c.height = h;
  const ctx = c.getContext("2d");
  ctx.imageSmoothingEnabled = false;
  draw(ctx, w, h);
  const t = new THREE.CanvasTexture(c);
  t.magFilter = THREE.NearestFilter;
  t.minFilter = THREE.NearestFilter;
  t.generateMipmaps = false;
  t.colorSpace = THREE.SRGBColorSpace;
  if (repeat) {
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(repeat[0], repeat[1]);
  }
  return t;
}

const hour = new Date().getHours();
const NIGHT = hour < 7 || hour >= 18;

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

  TEX.sky = makeTex(64, 56, (ctx) => {
    if (NIGHT) {
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
    } else {
      const g = ctx.createLinearGradient(0, 0, 0, 56);
      g.addColorStop(0, "#5fa8ff"); g.addColorStop(1, "#bfe4ff");
      ctx.fillStyle = g; ctx.fillRect(0, 0, 64, 56);
      ctx.fillStyle = "#fff8ee";
      for (const [x, y, w] of [[6, 10, 14], [30, 6, 18], [44, 20, 12], [12, 26, 10]]) {
        ctx.fillRect(x, y, w, 4); ctx.fillRect(x + 3, y - 3, w - 6, 3); ctx.fillRect(x + 2, y + 4, w - 4, 2);
      }
      ctx.fillStyle = "#6fcf7f";
      for (let x = 0; x < 64; x += 6) { const h = 5 + ((x * 5) % 7); ctx.fillRect(x, 56 - h, 6, h); }
    }
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
const toys = [];       // { group, kind, line, baseY, t }
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
  MAT.sky = new THREE.MeshBasicMaterial({ map: TEX.sky });
  MAT.pc = new THREE.MeshBasicMaterial({ map: TEX.pc });
  MAT.tv = new THREE.MeshBasicMaterial({ map: TEX.tv });
  MAT.dex = new THREE.MeshBasicMaterial({ map: TEX.dex });
  MAT.poster = mat("#ffffff", { map: TEX.poster });
  MAT.felt = mat("#ffffff", { map: TEX.caseFelt });
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
  win.add(plane(1.3, 1.1, MAT.sky, 0, 0, 0));
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
    toys.push({ group: b, kind: "ball", baseY: 0.13, t: 0 });
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

function buildPlushies() {
  // Sprout: teal, leaf ears
  const sprout = new THREE.Group();
  sprout.position.set(-2.25, 0.73, -1.35);
  sprout.add(ball(0.19, MAT.tealLight, 0, 0.17, 0));
  const belly = ball(0.11, MAT.cream, 0, 0.12, 0.12, 8);
  belly.scale.set(1, 1.1, 0.5);
  sprout.add(belly);
  const earL = cyl(0.0, 0.05, 0.16, MAT.green, -0.09, 0.4, 0, 5);
  earL.rotation.z = 0.35;
  const earR = cyl(0.0, 0.05, 0.16, MAT.green, 0.09, 0.4, 0, 5);
  earR.rotation.z = -0.35;
  sprout.add(earL, earR);
  sprout.add(ball(0.025, MAT.ink, -0.07, 0.22, 0.165, 6), ball(0.025, MAT.ink, 0.07, 0.22, 0.165, 6));
  sprout.add(ball(0.03, MAT.coral, -0.12, 0.16, 0.14, 6), ball(0.03, MAT.coral, 0.12, 0.16, 0.14, 6));
  sprout.rotation.y = 0.5;
  scene.add(sprout);
  toys.push({ group: sprout, kind: "plush", line: "Sprout: bwee!", baseY: 0.73, t: 0 });

  // Ember: coral with a flame tuft and pointy ears
  const ember = new THREE.Group();
  ember.position.set(-1.55, 0.73, -1.05);
  ember.add(ball(0.17, MAT.coral, 0, 0.15, 0));
  const tuft = cyl(0.0, 0.06, 0.18, MAT.amber, 0, 0.38, 0, 5);
  ember.add(tuft);
  const eL = cyl(0.0, 0.045, 0.12, MAT.coral, -0.11, 0.3, 0, 4);
  eL.rotation.z = 0.5;
  const eR = cyl(0.0, 0.045, 0.12, MAT.coral, 0.11, 0.3, 0, 4);
  eR.rotation.z = -0.5;
  ember.add(eL, eR);
  ember.add(ball(0.022, MAT.ink, -0.06, 0.19, 0.15, 6), ball(0.022, MAT.ink, 0.06, 0.19, 0.15, 6));
  ember.add(box(0.05, 0.02, 0.02, MAT.ink, 0, 0.12, 0.165));
  ember.rotation.y = -0.4;
  scene.add(ember);
  toys.push({ group: ember, kind: "plush", line: "Ember: ...zzz", baseY: 0.73, t: 0 });
}

function buildLights() {
  scene.add(new THREE.AmbientLight("#c7c2ff", NIGHT ? 0.55 : 0.8));
  const hemi = new THREE.HemisphereLight("#9aa0e0", "#5a3a2a", NIGHT ? 0.5 : 0.7);
  scene.add(hemi);

  const key = new THREE.DirectionalLight(NIGHT ? "#d8dcff" : "#fff4dc", NIGHT ? 1.6 : 2.4);
  key.position.set(4.5, 6.5, 4);
  key.target.position.set(-0.5, 0, -0.5);
  key.castShadow = true;
  key.shadow.mapSize.set(1024, 1024);
  key.shadow.bias = -0.0015;
  key.shadow.normalBias = 0.02;
  const s = key.shadow.camera;
  s.left = -5; s.right = 5; s.top = 5; s.bottom = -5; s.near = 1; s.far = 20;
  scene.add(key, key.target);

  const lamp = new THREE.PointLight("#ffd27a", NIGHT ? 3.2 : 1.5, 3.5, 2);
  lamp.position.set(2.45, 1.3, -2.55);
  scene.add(lamp);

  const glow = new THREE.PointLight("#9ad8ff", NIGHT ? 2.2 : 0, 3, 2);
  glow.position.set(-1.9, 1.9, -2.5);
  scene.add(glow);
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
}

function goHome() {
  const h = homePose();
  setGoal(h.pos, h.target);
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
  const target = new THREE.Vector3(...spot.pose.target);
  const pos = new THREE.Vector3(...spot.pose.pos);
  const scale = Math.max(1, Math.pow(1.45 / camera.aspect, 0.9));
  pos.sub(target).multiplyScalar(scale).add(target);
  setGoal(pos, target, panelShift());
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

function showHint(x, y, spot) {
  hint.innerHTML = PA.esc(spot.label) + "<small>" + PA.esc(spot.title) + " · click</small>";
  const pad = 16;
  const w = hint.offsetWidth, h = hint.offsetHeight;
  const px = Math.min(x + pad, window.innerWidth - w - 8);
  const py = Math.min(y + pad, window.innerHeight - h - 8);
  hint.style.transform = "translate(" + px + "px," + py + "px)";
}
function hideHint() { hint.style.transform = "translate(-9999px,-9999px)"; }

function onMove(e) {
  if (e.pointerType === "touch") return;
  const W = window.innerWidth, H = window.innerHeight;
  parallax.x = (e.clientX / W - 0.5) * 2;
  parallax.y = (e.clientY / H - 0.5) * 2;
  if (loader && !loader.hidden) return;
  const hit = pick(e.clientX, e.clientY);
  if (hit && hit.kind === "spot") {
    const spot = hotspots.find((h) => h.key === hit.key);
    setHover(spot);
    showHint(e.clientX, e.clientY, spot);
  } else {
    setHover(null);
    hideHint();
    renderer.domElement.style.cursor = hit && hit.kind === "toy" ? "pointer" : "";
  }
}

function onDown(e) { pressAt = { x: e.clientX, y: e.clientY, t: performance.now() }; }
function onUp(e) {
  if (!pressAt) return;
  const moved = Math.hypot(e.clientX - pressAt.x, e.clientY - pressAt.y);
  const dt = performance.now() - pressAt.t;
  pressAt = null;
  if (moved > 8 || dt > 600) return;
  const hit = pick(e.clientX, e.clientY);
  if (hit && hit.kind === "spot") open(hit.key);
  else if (hit && hit.kind === "toy") poke(hit.toy);
  else if (current) close();
}

let toastTimer = 0;
function poke(toy) {
  toy.t = 1;
  if (toy.kind === "plush") {
    toast.textContent = toy.line;
    toast.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.remove("show"), 1600);
  }
}

/* ------------------------------------------------------------------ */
/* Keyboard                                                            */
/* ------------------------------------------------------------------ */
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && current) { close(); e.preventDefault(); return; }
  if (e.target && (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA")) return;
  const n = parseInt(e.key, 10);
  if (n >= 1 && n <= PA.order.length && !e.metaKey && !e.ctrlKey && !e.altKey) open(PA.order[n - 1]);
});

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
const CAPTURE = new URLSearchParams(location.search).get("capture") === "1";
function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  step(dt);
  if (!CAPTURE) requestAnimationFrame(frame);
}
function step(dt) {

  const k = REDUCED ? 1 : 1 - Math.pow(0.0025, dt); // smooth exponential approach
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
      if (toy.kind === "plush") {
        toy.group.position.y = toy.baseY + Math.abs(b) * 0.18;
        toy.group.scale.set(1 + b * 0.08, 1 - b * 0.08, 1 + b * 0.08);
      } else {
        toy.group.rotation.z = b * 0.5;
        toy.group.position.y = toy.baseY + Math.abs(b) * 0.05;
      }
    }
  }

  renderer.render(scene, camera);
}

function resize() {
  const W = window.innerWidth, H = window.innerHeight;
  camera.aspect = W / H;
  camera.updateProjectionMatrix();
  renderer.setSize(Math.floor(W * RENDER_SCALE), Math.floor(H * RENDER_SCALE), false);
  if (!current) goHome();
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
    buildPlushies();
    await progress();
    buildLights();
    await progress();

    resize();
    cam.pos.copy(cam.goalPos);
    cam.target.copy(cam.goalTarget);
    window.addEventListener("resize", resize);
    renderer.domElement.addEventListener("pointermove", onMove);
    renderer.domElement.addEventListener("pointerdown", onDown);
    renderer.domElement.addEventListener("pointerup", onUp);
    renderer.domElement.addEventListener("pointerleave", () => { setHover(null); hideHint(); });

    renderer.render(scene, camera);
    await progress("Ready");
    requestAnimationFrame(frame);

    applyHash();
    const hide = () => { loader.classList.add("hide"); setTimeout(() => { loader.hidden = true; }, REDUCED ? 0 : 420); };
    if (REDUCED) hide(); else setTimeout(hide, 380);
    window.PA_READY = true;
    if (CAPTURE) window.PA_STEP = (ms) => step(ms / 1000);
  } catch (err) {
    console.error(err);
    failToPlain("This browser could not draw the room. Taking you to the plain version.");
  }
}

boot();
