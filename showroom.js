// The 3D showroom (/showroom): every product on show, standing in one hall.
// - The hall is laid out from products.json each time the page opens, so a new product finds its place with
//   nothing to change here: an aisle per category (a long one is split in two or more), the products along both
//   sides facing the walkway on low plinths with their names, a hanging sign at each aisle's entrance, brand panels
//   over each brand's run, a cross aisle at the back and the Sangeetha logo wall with a counter at the far end. Walls
//   and the ceiling are single-sided, so from outside and above the hall reads as a dollhouse.
// - Phone and laptop: drag to look round (OrbitControls); a chip or a name flies the camera to a product; a tap on
//   a door opens it (the mesh's part, else the parts' zones: partAt in site.js).
// - Meta Quest and Vision Pro ("immersive-vr"): point at the floor and pull the trigger (or look and pinch) to go
//   there; point at a door to open it; a panel by your side jumps to an aisle. The thumbstick turns you.
// - Meta Quest passthrough ("immersive-ar"): the hall is hidden and one category at a time stands in a ring about
//   2.4 m round you, facing you; air conditioners hang on small wall panels.
// Only the models near you are loaded, CAP at most at once, nearest and most in front first; the rest stand as a
// box of their real size in their colour, with their photo on the front, until you come close (then the box fades
// away round the model; a slim bar at the top says how many of those near you are in). A model left behind is
// disposed. Each fridge's food (the "Fill the fridge" stock) is dropped and its fixed parts merged, so a headset
// draws a few dozen meshes per product instead of hundreds.
// ?focus=<id> (or /showroom/<id>) opens with that product in front of you; ?cap=<n> sets how many load at once.
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { esc, cm, partAt, needsOf, CATEGORIES } from "/site.js";
import { shownProducts } from "/live.js";
import { radialTexture, roundRect, wrapText, makeTooltip, makeCard } from "/xr.js";

const NAVY = "#0E0E0F", COPPER = "#F58A29", COPPER_DK = "#B85A12", SLATE = "#5E6066", HAIR = "#E3E3E6";
const FONT = "Outfit, Arial, sans-serif";
const $ = (id) => document.getElementById(id);
const params = new URLSearchParams(location.search);
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const Y = new THREE.Vector3(0, 1, 0);
const AXES = { x: new THREE.Vector3(1, 0, 0), y: Y, z: new THREE.Vector3(0, 0, 1) };
const SWING_MS = 900;
function toast(text, ms = 3500) {
  const t = $("toast");
  t.textContent = text;
  t.classList.add("show");
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => t.classList.remove("show"), ms);
}

// ── the catalogue: every product on show, read when the page opens ──
const products = await shownProducts(); // on show: products.json and the team's decisions (live.js)
const focusId = decodeURIComponent(params.get("focus") || location.pathname.match(/^\/showroom\/([^/?#]+)/)?.[1] || "").toLowerCase();
const model = (url) => `${url}?v=7`; // the same files and cache key as product.html

// ── this device (as product.html) ──
const ua = navigator.userAgent;
const xrSupport = async (mode) => { try { return !!(await navigator.xr?.isSessionSupported(mode)); } catch { return false; } };
const [xrVR, xrAR] = await Promise.all([xrSupport("immersive-vr"), xrSupport("immersive-ar")]);
const hasQuickLook = !!document.createElement("a").relList?.supports?.("ar");
const isHeadset = /OculusBrowser|Quest|Pico|Wolvic/i.test(ua);
const isVisionPro = hasQuickLook && xrVR && !/iPhone|iPod/.test(ua);
const isIPadOS = navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1;
const isPhone = !isHeadset && !isVisionPro && (/Android|iPhone|iPad|iPod/i.test(ua) || isIPadOS);
const canVR = xrVR && !isPhone;                 // Quest, Vision Pro, PC headsets
const canAR = xrAR && !isPhone && !hasQuickLook; // Meta Quest passthrough
const light = isPhone || isHeadset || isVisionPro;
// how many models may be loaded at once, how near they must be, and how big a texture may stay
const CAP = clamp(Math.round(+params.get("cap") || (light ? 6 : 10)), 1, 40);
const CAP_XR = clamp(Math.round(+params.get("cap") || 6), 1, 40);
const NEAR = light ? 10 : 14, NEAR_XR = 8, HYST = 3;
// on a screen, a model loads only once the camera itself is this near it: from the whole-hall view a phone shows the
// boxes with their photos (each model would be a few dozen pixels), and spends its data on the ones you go to
const SEE = light ? 12 : 26;
const TEX_MAX = light || canVR ? 1024 : 4096;
const PARALLEL = light ? 1 : 2;

// ── layout, in metres: x across the hall, z into it (the entrance is at z = 0, the hall runs to -D) ──
const GAP = 0.34;      // between neighbours
const CLEAR = 0.05;    // between an open door and anything next to it, open or shut
const WALK = 2.4;      // an aisle's walkway: two fridge doors open across it still leave room
// a floor unit's back to the partition: as in a shop, and room for what a model carries behind its published depth
// (the cord and plug hang up to 13 cm behind some fridges); a model that still reaches the partition is stood
// forward when it loads (fitSlot)
const BACK = 0.16;
const PT = 0.1;        // partition thickness
const ENTRY = 1.4;     // floor inside an aisle before its first product
const END = 0.8, CROSS = 2.2;       // after an aisle's last product; the cross aisle along the back wall
const MAX_RUN = 12;    // the longest row of products along one side of an aisle
// partitions are low enough to see over from the overview; the one by a wall of air conditioners stands taller
const PART_H = 2.05, PART_TALL = 2.6, WALL_H = 3.2;
const AC_Y = 2.05;     // an air conditioner's centre height, as in xr.js
const RING_R = 2.4;    // passthrough: the ring round you
const sizeOf = (p) => ({ w: cm(p.size.w) / 100, h: cm(p.size.h) / 100, d: cm(p.size.d) / 100 });
// What a product takes up, in its own model space (x across it, y up, z out of its front): its body, and each
// part's box when open (the zones in products.json, measured from the model). A wall unit's origin is the middle of
// its back at the bottom; a floor unit's the middle of its footprint.
function boxesOf(p) {
  const s = sizeOf(p), wall = p.placement === "wall";
  const body = { min: [-s.w / 2, 0, wall ? 0 : -s.d / 2], max: [s.w / 2, s.h, wall ? s.d : s.d / 2], open: false };
  const open = (p.parts || []).filter((q) => q.zone?.open).map((q) => ({ min: q.zone.open[0], max: q.zone.open[1], open: true }));
  return [body, ...open];
}
// Two neighbours on a line, B further along than A (`along` +1: B on A's +x side, -1: on its -x side): how far apart
// their middles must be so that no door of either, open or shut, comes within CLEAR of the other or its open doors,
// and the bodies keep GAP. `depth(p, z)` turns a model z into a distance out from the line both backs stand on;
// `squeeze(t)` (a ring) how much nearer the two are at depth t than at the line itself.
function spacing(A, B, along, depth, squeeze = () => 1) {
  let need = 0;
  for (const a of boxesOf(A)) for (const b of boxesOf(B)) {
    if (a.min[1] >= b.max[1] || b.min[1] >= a.max[1]) continue; // one above the other
    const [a0, a1] = [depth(A, a.min[2]), depth(A, a.max[2])], [b0, b1] = [depth(B, b.min[2]), depth(B, b.max[2])];
    if (a0 >= b1 || b0 >= a1) continue; // one in front of the other
    const aEdge = along > 0 ? a.max[0] : -a.min[0], bEdge = along > 0 ? -b.min[0] : b.max[0];
    const k = squeeze(Math.max(a1, b1));
    need = Math.max(need, (aEdge + bEdge + (a.open || b.open ? CLEAR : GAP)) / k);
  }
  return need;
}
// distance out from the partition (floor units stand BACK off it, wall units on it)
const depthOut = (p, z) => z + (p.placement === "wall" ? 0.005 : BACK + sizeOf(p).d / 2);
// One aisle's products along its two sides: each goes on the side that ends nearer the entrance, as close to the one
// before as its doors allow. at[side][i] is how far into the aisle its middle stands; end, where each side's last
// door reaches. On the left side the product's +x points into the aisle, on the right its -x.
function fillAisle(items) {
  const sides = { L: [], R: [] }, at = { L: [], R: [] }, end = { L: 0, R: 0 };
  for (const p of items) {
    const side = end.L <= end.R ? "L" : "R", along = side === "L" ? 1 : -1, list = sides[side];
    const s = sizeOf(p), bx = boxesOf(p);
    let u = ENTRY + Math.max(s.w / 2 + GAP / 2, ...bx.map((b) => (along > 0 ? -b.min[0] : b.max[0]))); // its reach back to the entrance
    list.forEach((q, i) => { u = Math.max(u, at[side][i] + spacing(q, p, along, depthOut)); });
    list.push(p); at[side].push(u);
    end[side] = Math.max(end[side], u + Math.max(s.w / 2 + GAP / 2, ...bx.map((b) => (along > 0 ? b.max[0] : -b.min[0]))));
  }
  return { sides, at, len: Math.max(end.L, end.R) + END };
}

function makeLayout() {
  // categories in the catalogue's order, then any new one; in each, brand by brand, smallest first
  const known = CATEGORIES.filter(([v]) => products.some((p) => p.category === v));
  const other = [...new Set(products.map((p) => p.category))].filter((c) => !CATEGORIES.some(([v]) => v === c)).map((c) => [c, c]);
  const aisles = [];
  for (const [cat, title] of [...known, ...other]) {
    const items = products.filter((p) => p.category === cat)
      .sort((a, b) => a.brand.localeCompare(b.brand) || cm(a.size.h) - cm(b.size.h) || a.model.localeCompare(b.model));
    // as few aisles as keep each one's sides within MAX_RUN
    let n = 1, split;
    for (;; n++) {
      const per = Math.ceil(items.length / n);
      split = [...Array(n)].map((_, i) => items.slice(i * per, (i + 1) * per)).filter((x) => x.length);
      if (split.every((x) => fillAisle(x).len <= ENTRY + MAX_RUN + END) || per === 1) break;
    }
    split.forEach((list, i) => aisles.push({ cat, title, part: i + 1, of: split.length, items: list }));
  }
  const places = [];
  let x = 0;
  for (const [ai, a] of aisles.entries()) {
    const { sides, at, len } = fillAisle(a.items);
    a.sides = sides;
    const zone = (list) => Math.max(0.5, ...list.map((p) => sizeOf(p).d + (p.placement === "wall" ? 0.05 : BACK + 0.12)));
    a.x0 = x;
    a.x1 = x + PT / 2 + zone(a.sides.L) + WALK + zone(a.sides.R) + PT / 2;
    a.walk = [a.x0 + PT / 2 + zone(a.sides.L), a.x1 - PT / 2 - zone(a.sides.R)];
    a.len = len;
    x = a.x1;
    for (const side of ["L", "R"]) {
      // backs to the partition's face, or to the hall's own wall at either end
      const outer = side === "L" ? ai === 0 : ai === aisles.length - 1;
      const face = side === "L" ? 1 : -1, back = side === "L" ? a.x0 + (outer ? 0 : PT / 2) : a.x1 - (outer ? 0 : PT / 2);
      a.sides[side].forEach((p, i) => {
        const s = sizeOf(p), wall = p.placement === "wall";
        // floor units stand by the middle of their footprint; wall units hang by their back (the builders' origin)
        places.push({ p, aisle: a, side, pos: [wall ? back + face * 0.005 : back + face * (BACK + s.d / 2), wall ? AC_Y - s.h / 2 : 0, -at[side][i]], rot: face * Math.PI / 2 });
      });
    }
  }
  const W = x, shift = -W / 2;
  for (const a of aisles) { a.x0 += shift; a.x1 += shift; a.walk = a.walk.map((v) => v + shift); a.mid = (a.walk[0] + a.walk[1]) / 2; }
  for (const pl of places) pl.pos[0] += shift;
  const LEN = Math.max(...aisles.map((a) => a.len));
  return { aisles, places, W, LEN, D: LEN + CROSS };
}
const L = makeLayout();

// ── renderer and scene ──
const stage = $("stage");
const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, light ? 1.5 : 2));
renderer.setSize(stage.clientWidth, stage.clientHeight, false);
// filmic tone mapping and a warm key light over a neutral studio environment, as a lit shop floor
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 0.92;
renderer.setClearColor(0x000000, 0); // see-through where nothing is drawn: passthrough shows the room
renderer.xr.enabled = true;
renderer.domElement.style.touchAction = "none";
stage.prepend(renderer.domElement);
const scene = new THREE.Scene();
const BG = new THREE.Color(0xeeebe6);
scene.background = BG;
const pmrem = new THREE.PMREMGenerator(renderer);
scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
scene.environmentIntensity = 0.9;
scene.add(new THREE.HemisphereLight(0xfff7ec, 0xb8aa96, 0.5));
const sun = new THREE.DirectionalLight(0xffeed6, 1.35); // the warm key, from the front left and above
sun.position.set(-5, 10, 7);
const fill = new THREE.DirectionalLight(0xe9eef8, 0.4);  // a cool fill from the other side
fill.position.set(6, 5, -3);
scene.add(sun, fill);
const world = new THREE.Group(); // everything; lowered in a headset that can't find the floor
const hall = new THREE.Group();  // the room itself, hidden in passthrough
world.add(hall);
scene.add(world);
const FOV = 50; // degrees, up and down, in the part of the view the dock and card leave clear
const camera = new THREE.PerspectiveCamera(FOV, stage.clientWidth / Math.max(1, stage.clientHeight), 0.05, 200);
let dirty = 2;
const redraw = () => { dirty = 2; };
let xr = null; // the headset session's state, while there is one

await Promise.race([document.fonts?.load(`600 40px Outfit`), new Promise((r) => setTimeout(r, 2000))]).catch(() => {});

// ── the hall ──
// A finished shop floor, built once from the layout: polished porcelain tiles; walls with a charcoal fascia over a
// thin orange line; display partitions with a charcoal cap, end trims and skirting; a ceiling with a light strip over
// every walkway (seen only from inside: from above the hall stays open, as a dollhouse); a hanging sign at each
// aisle's entrance; a brand panel over each brand's run; a low plinth with a name plate under every floor-standing
// product; and a logo wall with a counter at the far end. The fixed pieces are merged by material, so the whole room
// is a couple of dozen draw calls.
const HQ = !light; // a laptop's signs and plates are drawn at twice a phone's resolution
function canvasTexture(w, h, draw) {
  const c = document.createElement("canvas");
  c.width = w; c.height = h;
  draw(c.getContext("2d"), c);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = renderer.capabilities.getMaxAnisotropy();
  return t;
}
// Flat things laid on another surface (runners, shadows, plates, the logo) are drawn as if a little nearer, so from
// across the hall the two never flicker through each other (z-fighting).
const onTop = (m, k = 1) => Object.assign(m, { polygonOffset: true, polygonOffsetFactor: -k, polygonOffsetUnits: -4 * k });
const blockers = []; // walls, partitions, the counter: a pointer stops at them
const signs = [];
const PLINTH = 0.06;   // the plinth under a floor-standing product (its top is where the product stands)
const APRON = 2;       // finished floor in front of the hall, where you come in
const SINK = 0.05;     // walls and partitions run this far under the floor and past the corners: no hairline gaps
// a texture painted from the floor up, in metres (for the walls and partitions: their bands run along them)
function stripTexture(height, from, paint) {
  return canvasTexture(4, 1024, (g) => { g.setTransform(1, 0, 0, -1024 / height, 0, 1024); g.translate(0, -from); paint(g, 4); });
}
// a soft-edged dark rectangle, for the shadows on the floor and under each product
const softRect = (inset, blur, alpha) => canvasTexture(256, 256, (g) => {
  g.shadowColor = `rgba(20,16,12,${alpha})`; g.shadowBlur = blur; g.shadowOffsetX = 1000;
  g.fillStyle = "#000"; roundRect(g, inset - 1000, inset, 256 - 2 * inset, 256 - 2 * inset, 18); g.fill();
});
// one mesh per material for everything that never moves
const bins = new Map();
const M4 = new THREE.Matrix4(), Q = new THREE.Quaternion(), E = new THREE.Euler(), ONE = new THREE.Vector3(1, 1, 1);
function put(mat, geo, pos, rot = [0, 0, 0], frame = null) {
  geo.applyMatrix4(M4.compose(new THREE.Vector3(...pos), Q.setFromEuler(E.set(...rot)), ONE));
  if (frame) geo.applyMatrix4(frame);
  if (!bins.has(mat)) bins.set(mat, []);
  bins.get(mat).push(geo);
}
function bakeAll() {
  for (const [mat, geos] of bins) {
    const mesh = new THREE.Mesh(mergeGeometries(geos.map((g) => (g.index ? g.toNonIndexed() : g)), false), mat);
    geos.forEach((g) => g.dispose());
    mesh.renderOrder = mat.userData.order || 0;
    hall.add(mesh);
    if (mat.userData.block) blockers.push(mesh);
  }
  bins.clear();
}
const flat = (w, d) => new THREE.PlaneGeometry(w, d).rotateX(-Math.PI / 2); // on the floor, facing up
let seed = 11;
const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
const CHARCOAL = "#28282B";
const mats = {
  floor: null,
  wall: null,
  part: null,
  trim: new THREE.MeshStandardMaterial({ color: 0x29292c, roughness: 0.45, metalness: 0.2 }),
  plinth: new THREE.MeshStandardMaterial({ color: 0xf6f4f0, roughness: 0.38, metalness: 0 }),
  copper: new THREE.MeshStandardMaterial({ color: 0xf58a29, roughness: 0.4, metalness: 0.1 }),
  counterTop: new THREE.MeshStandardMaterial({ color: 0xfbfaf8, roughness: 0.25, metalness: 0 }),
  light: new THREE.MeshBasicMaterial({ color: 0xffffff, toneMapped: false }),
  ground: new THREE.MeshBasicMaterial({ color: BG, toneMapped: false }),
};
mats.trim.userData.block = false;
{
  const { W, D, LEN } = L;
  // the porcelain floor: 60 cm tiles, each a shade of its own with faint clouding, and fine grout
  const T = 1024, TILE = 0.6;
  const floorTex = canvasTexture(T, T, (g) => {
    const n = T / 2;
    for (let i = 0; i < 4; i++) {
      const x = (i % 2) * n, y = (i >> 1) * n, v = Math.round((rnd() - 0.5) * 5);
      g.fillStyle = `rgb(${221 + v},${215 + v},${206 + v})`; g.fillRect(x, y, n, n);
      g.save(); g.beginPath(); g.rect(x, y, n, n); g.clip();
      for (let k = 0; k < 26; k++) {
        const cx = x + rnd() * n, cy = y + rnd() * n, r = n * (0.08 + rnd() * 0.35);
        const gr = g.createRadialGradient(cx, cy, 0, cx, cy, r);
        const dark = rnd() < 0.5;
        gr.addColorStop(0, dark ? "rgba(150,138,120,0.05)" : "rgba(255,255,255,0.10)"); gr.addColorStop(1, "rgba(0,0,0,0)");
        g.fillStyle = gr; g.fillRect(cx - r, cy - r, 2 * r, 2 * r);
      }
      g.restore();
    }
    g.fillStyle = "rgba(140,128,112,0.7)";
    const gw = Math.max(1, T / 512);
    g.fillRect(0, 0, T, gw); g.fillRect(0, n - gw / 2, T, gw); g.fillRect(0, 0, gw, T); g.fillRect(n - gw / 2, 0, gw, T);
  });
  floorTex.wrapS = floorTex.wrapT = THREE.RepeatWrapping;
  floorTex.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy()); // it covers most of the view
  const FW = W, FD = D + APRON;
  floorTex.repeat.set(FW / (2 * TILE), FD / (2 * TILE));
  mats.floor = new THREE.MeshStandardMaterial({ map: floorTex, roughness: 0.34, metalness: 0 });
  put(mats.floor, flat(FW, FD), [0, 0, (APRON - D) / 2]);
  // round the hall: a plain ground a step lower, the colour of the sky, with a soft shadow round the hall
  put(mats.ground, flat(400, 400), [0, -0.03, -D / 2]);
  const pad = onTop(new THREE.MeshBasicMaterial({ map: softRect(40, 60, 0.35), transparent: true, depthWrite: false, toneMapped: false }), 1);
  put(pad, flat(W + 5, FD + 5), [0, -0.029, (APRON - D) / 2]);
  // the step's edge round the apron
  put(mats.trim, new THREE.BoxGeometry(W + 0.02, 0.03, 0.02), [0, -0.015, APRON]);
  for (const sx of [-1, 1]) put(mats.trim, new THREE.BoxGeometry(0.02, 0.03, APRON + SINK), [sx * (W / 2 + 0.01), -0.015, (APRON - SINK) / 2]);

  // walls: warm white, darker just above the floor, a charcoal fascia along the top over a thin orange line
  const FASCIA = 2.8;
  mats.wall = new THREE.MeshStandardMaterial({ roughness: 0.92, map: stripTexture(WALL_H + SINK, -SINK, (g, w) => {
    g.fillStyle = "#F2EFEA"; g.fillRect(0, -SINK, w, WALL_H + SINK);
    const ao = g.createLinearGradient(0, 0, 0, 0.8); ao.addColorStop(0, "rgba(70,58,44,0.14)"); ao.addColorStop(1, "rgba(70,58,44,0)");
    g.fillStyle = ao; g.fillRect(0, 0, w, 0.8);
    g.fillStyle = "#F58A29"; g.fillRect(0, FASCIA - 0.03, w, 0.03);
    g.fillStyle = CHARCOAL; g.fillRect(0, FASCIA, w, WALL_H - FASCIA + 0.01);
  }) });
  mats.wall.userData.block = true;
  // single-sided: the back, and the two sides from the entrance to the back
  const wall = (w, x, z, ry) => put(mats.wall, new THREE.PlaneGeometry(w, WALL_H + SINK), [x, (WALL_H - SINK) / 2, z], [0, ry, 0]);
  wall(W + 2 * SINK, 0, -D, 0);
  wall(D + SINK, -W / 2, -(D + SINK) / 2, Math.PI / 2);
  wall(D + SINK, W / 2, -(D + SINK) / 2, -Math.PI / 2);
  // skirting along the walls
  const SK = 0.1;
  put(mats.trim, new THREE.BoxGeometry(W, SK + 0.02, 0.016), [0, (SK - 0.02) / 2, -D + 0.006]);
  for (const sx of [-1, 1]) put(mats.trim, new THREE.BoxGeometry(0.016, SK + 0.02, D), [sx * (W / 2 - 0.006), (SK - 0.02) / 2, -D / 2]);

  // display partitions between the aisles: a pale panel, darker near the floor, a charcoal cap, skirting both sides,
  // and a charcoal trim on each end
  mats.part = new THREE.MeshStandardMaterial({ roughness: 0.85, map: stripTexture(PART_H + 0.02, -0.02, (g, w) => {
    g.fillStyle = "#E7E2DA"; g.fillRect(0, -0.02, w, PART_H + 0.02);
    const ao = g.createLinearGradient(0, 0, 0, 0.7); ao.addColorStop(0, "rgba(70,58,44,0.13)"); ao.addColorStop(1, "rgba(70,58,44,0)");
    g.fillStyle = ao; g.fillRect(0, 0, w, 0.7);
  }) });
  mats.part.userData.block = true;
  L.partH = L.aisles.slice(0, -1).map((a, i) => L.places.some((pl) => pl.p.placement === "wall" && ((pl.aisle === a && pl.side === "R") || (pl.aisle === L.aisles[i + 1] && pl.side === "L"))) ? PART_TALL : PART_H);
  L.aisles.slice(0, -1).forEach((a, i) => {
    const H = L.partH[i];
    put(mats.part, new THREE.BoxGeometry(PT, H + 0.02, LEN), [a.x1, (H - 0.02) / 2, -LEN / 2]);
    put(mats.trim, new THREE.BoxGeometry(PT + 0.02, 0.045, LEN - 0.01), [a.x1, H + 0.0125, -LEN / 2]); // the cap
    for (const zc of [-0.021, -LEN + 0.021]) put(mats.trim, new THREE.BoxGeometry(PT + 0.032, H + 0.08, 0.05), [a.x1, (H + 0.06) / 2, zc]);
    for (const sx of [-1, 1]) put(mats.trim, new THREE.BoxGeometry(0.016, SK + 0.02, LEN - 0.02), [a.x1 + sx * (PT / 2 + 0.006), (SK - 0.02) / 2, -LEN / 2]);
  });
  // a soft shadow on the floor along every wall and partition
  const aoTex = canvasTexture(4, 128, (g) => { const gr = g.createLinearGradient(0, 0, 0, 128); gr.addColorStop(0, "rgba(30,24,18,0.22)"); gr.addColorStop(1, "rgba(30,24,18,0)"); g.fillStyle = gr; g.fillRect(0, 0, 4, 128); });
  const aoMat = onTop(new THREE.MeshBasicMaterial({ map: aoTex, transparent: true, depthWrite: false }), 2);
  const AO = 0.45;
  // (the gradient's dark edge, v = 1, is the strip's -z side; turned by ry it meets the wall)
  const aoStrip = (len, x, z, ry) => put(aoMat, flat(len, AO), [x, 0.001, z], [0, ry, 0]);
  aoStrip(W, 0, -D + AO / 2 + 0.01, 0);
  aoStrip(D, -W / 2 + AO / 2 + 0.01, -D / 2, Math.PI / 2);
  aoStrip(D, W / 2 - AO / 2 - 0.01, -D / 2, -Math.PI / 2);
  for (const a of L.aisles.slice(0, -1)) {
    aoStrip(LEN, a.x1 - PT / 2 - AO / 2, -LEN / 2, -Math.PI / 2);
    aoStrip(LEN, a.x1 + PT / 2 + AO / 2, -LEN / 2, Math.PI / 2);
  }

  // the ceiling (faces down only) with a light strip down each walkway and two across the back
  const ceilTex = canvasTexture(256, 256, (g) => {
    g.fillStyle = "#F4F2EE"; g.fillRect(0, 0, 256, 256);
    g.fillStyle = "rgba(150,140,125,0.35)"; g.fillRect(0, 0, 256, 2); g.fillRect(0, 0, 2, 256); g.fillRect(0, 127, 256, 2); g.fillRect(127, 0, 2, 256);
  });
  ceilTex.wrapS = ceilTex.wrapT = THREE.RepeatWrapping;
  ceilTex.repeat.set((W + 2 * SINK) / 1.2, (D + SINK) / 1.2);
  const ceilMat = new THREE.MeshBasicMaterial({ map: ceilTex, color: 0xe6e2dc });
  put(ceilMat, new THREE.PlaneGeometry(W + 2 * SINK, D + SINK), [0, WALL_H, -(D + SINK) / 2], [Math.PI / 2, 0, 0]);
  // (each in a charcoal frame; all of them face down, so from above they vanish with the ceiling)
  const frameMat = new THREE.MeshBasicMaterial({ color: 0x3a3a3d });
  for (const a of L.aisles) {
    const len = Math.max(1, a.len - 1.6);
    put(frameMat, new THREE.PlaneGeometry(0.26, len + 0.1), [a.mid, WALL_H - 0.006, -a.len / 2 - 0.2], [Math.PI / 2, 0, 0]);
    put(mats.light, new THREE.PlaneGeometry(0.16, len), [a.mid, WALL_H - 0.012, -a.len / 2 - 0.2], [Math.PI / 2, 0, 0]);
  }
  for (const z of [-LEN - (D - LEN) * 0.3, -LEN - (D - LEN) * 0.7]) {
    put(frameMat, new THREE.PlaneGeometry(W - 1.5, 0.2), [0, WALL_H - 0.006, z], [Math.PI / 2, 0, 0]);
    put(mats.light, new THREE.PlaneGeometry(W - 1.6, 0.12), [0, WALL_H - 0.012, z], [Math.PI / 2, 0, 0]);
  }

  // a hanging sign at each aisle's entrance, both faces: its number, the category, how many and which brands
  L.aisles.forEach((a, i) => {
    a.n = i + 1;
    const brands = [...new Set(a.items.map((p) => p.brand))];
    const count = a.items.length;
    const SW = HQ ? 2048 : 1024, SH = SW * 0.28, k = SW / 1024;
    const tex = canvasTexture(SW, SH, (g) => {
      g.scale(k, k);
      const w = 1024, h = 286.72;
      g.fillStyle = "#1F1F21"; g.fillRect(0, 0, w, h);
      g.fillStyle = COPPER; roundRect(g, 40, 40, 206, 206, 28); g.fill();
      g.fillStyle = NAVY; g.textAlign = "center"; g.textBaseline = "middle";
      g.font = `600 30px ${FONT}`; if (g.letterSpacing !== undefined) g.letterSpacing = "4px"; g.fillText("AISLE", 143, 86);
      if (g.letterSpacing !== undefined) g.letterSpacing = "0px";
      g.font = `700 112px ${FONT}`; g.fillText(String(a.n), 143, 170);
      g.textAlign = "left"; g.textBaseline = "alphabetic"; g.fillStyle = "#FFFFFF";
      g.font = `600 96px ${FONT}`; g.fillText(a.title, 290, 148, 700);
      g.fillStyle = "#B9B9BE"; g.font = `500 38px ${FONT}`;
      const part = a.of > 1 ? `Part ${a.part} of ${a.of} · ` : "";
      const line = wrapText(g, `${part}${count} model${count === 1 ? "" : "s"} · ${brands.join(", ")}`, 700);
      g.fillText(line[0] + (line.length > 1 ? "…" : ""), 292, 212, 700);
      g.fillStyle = COPPER; g.fillRect(292, 236, 72, 5);
    });
    const sw = Math.min(2.3, a.walk[1] - a.walk[0] - 0.1), sh = sw * 0.28, y = 2.68, z = -1.0;
    const face = new THREE.MeshBasicMaterial({ map: tex, toneMapped: false });
    put(mats.trim, new THREE.BoxGeometry(sw + 0.04, sh + 0.04, 0.05), [a.mid, y, z]);
    for (const sx of [-1, 1]) put(mats.trim, new THREE.CylinderGeometry(0.006, 0.006, WALL_H - (y + sh / 2), 8), [a.mid + sx * (sw / 2 - 0.15), (WALL_H + y + sh / 2) / 2, z]);
    for (const ry of [0, Math.PI]) {
      const s = new THREE.Mesh(new THREE.PlaneGeometry(sw, sh), onTop(face.clone(), 1));
      s.material.map = tex;
      s.position.set(a.mid, y, z + (ry ? -0.027 : 0.027));
      s.rotation.y = ry;
      s.userData.aisle = a;
      hall.add(s); signs.push(s);
    }
  });

  // the logo wall at the far end, with a counter in front of it
  const LW = Math.min(7, W * 0.4), LH = WALL_H;
  put(mats.trim, new THREE.BoxGeometry(LW, LH + 0.02, 0.08), [0, (LH - 0.02) / 2, -D + 0.04]);
  const logo = new Image();
  const logoTex = canvasTexture(HQ ? 2048 : 1024, HQ ? 1024 : 512, () => {});
  const drawLogo = () => {
    const c = logoTex.image, g = c.getContext("2d"), k = c.width / 1024;
    g.setTransform(k, 0, 0, k, 0, 0);
    g.clearRect(0, 0, 1024, 512);
    const glow = g.createRadialGradient(512, 230, 20, 512, 230, 520); glow.addColorStop(0, "rgba(255,255,255,0.07)"); glow.addColorStop(1, "rgba(255,255,255,0)");
    g.fillStyle = glow; g.fillRect(0, 0, 1024, 512);
    if (logo.naturalWidth) { const w = 640, h = w * logo.naturalHeight / logo.naturalWidth; g.drawImage(logo, (1024 - w) / 2, 250 - h / 2 - 40, w, h); }
    g.fillStyle = COPPER; g.font = `600 40px ${FONT}`; g.textAlign = "center"; g.textBaseline = "alphabetic";
    if (g.letterSpacing !== undefined) g.letterSpacing = "14px";
    g.fillText("3D SHOWROOM", 512 + 7, 410);
    logoTex.needsUpdate = true;
    redraw();
  };
  drawLogo();
  logo.onload = drawLogo;
  logo.src = "/logos/sangeetha.png";
  const lm = new THREE.Mesh(new THREE.PlaneGeometry(LW * 0.78, LW * 0.39), onTop(new THREE.MeshBasicMaterial({ map: logoTex, transparent: true, toneMapped: false, depthWrite: false }), 2));
  lm.position.set(0, 1.95, -D + 0.081);
  lm.renderOrder = 2;
  hall.add(lm);
  // a strip of light along the top and bottom of the logo wall
  put(mats.light, new THREE.PlaneGeometry(LW - 0.1, 0.025), [0, LH - 0.12, -D + 0.081]);
  put(mats.copper, new THREE.BoxGeometry(LW - 0.1, 0.02, 0.006), [0, 0.12, -D + 0.083]);
  // the counter: a white top on a charcoal body with an orange line
  const CW = Math.min(2.6, LW * 0.45), cz = -D + Math.min(1.25, (D - LEN) * 0.55);
  put(mats.trim, new THREE.BoxGeometry(CW, 0.98, 0.56), [0, 0.49, cz]);
  put(mats.counterTop, new THREE.BoxGeometry(CW + 0.06, 0.04, 0.64), [0, 1.0, cz]);
  put(mats.copper, new THREE.BoxGeometry(CW + 0.002, 0.018, 0.562), [0, 0.86, cz]);
  const counter = new THREE.Mesh(new THREE.BoxGeometry(CW + 0.06, 1.02, 0.64), new THREE.MeshBasicMaterial({ visible: false }));
  counter.position.set(0, 0.51, cz);
  hall.add(counter); blockers.push(counter);
  L.counter = { x: [-(CW + 0.06) / 2, (CW + 0.06) / 2], z: [cz - 0.32, cz + 0.32] };
}

// ── the plinths, their name plates and the brand panels (from the layout) ──
// A floor-standing product stands on a plinth 6 cm high, as deep as the deepest on its side of the aisle (so their
// fronts line up), with its brand and name on the front; a product on the wall has the same plate under it. A brand
// panel hangs on the partition over each brand's run.
const PLATE = { w: 512, h: 48, cols: 4 }; // the name plates' cells in one texture
const plateTex = canvasTexture(PLATE.w * PLATE.cols, 2 ** Math.ceil(Math.log2(Math.ceil(L.places.length / PLATE.cols) * PLATE.h)), () => {});
const plateOf = new Map();
const logoCells = new Map(); // brand -> cell in the logo texture
const logoTex = canvasTexture(1024, 512, () => {});
{
  const pg = plateTex.image.getContext("2d");
  L.places.forEach((pl, i) => {
    const x = (i % PLATE.cols) * PLATE.w, y = Math.floor(i / PLATE.cols) * PLATE.h;
    plateOf.set(pl.p.id, [x, y]);
    const brand = pl.p.brand.toUpperCase();
    let name = pl.p.shortName, size = 30;
    const widths = () => { pg.font = `700 ${size * 0.8}px ${FONT}`; const bw = pg.measureText(brand).width + size * 0.55; pg.font = `500 ${size}px ${FONT}`; return [bw, bw + pg.measureText(name).width]; };
    let [bw, all] = widths();
    while (all > PLATE.w - 24 && size > 20) { size--; [bw, all] = widths(); }
    while (all > PLATE.w - 24 && name.length > 6) { name = name.slice(0, -2).trimEnd() + "…"; [bw, all] = widths(); }
    const x0 = x + (PLATE.w - all) / 2, mid = y + PLATE.h / 2 + 1;
    pg.textBaseline = "middle"; pg.textAlign = "left";
    pg.fillStyle = COPPER_DK; pg.font = `700 ${size * 0.8}px ${FONT}`; pg.fillText(brand, x0, mid);
    pg.fillStyle = "#2A2A2D"; pg.font = `500 ${size}px ${FONT}`; pg.fillText(name, x0 + bw, mid);
  });
  plateTex.needsUpdate = true;
  const plateMat = onTop(new THREE.MeshBasicMaterial({ map: plateTex, transparent: true, depthWrite: false }), 2);
  plateMat.userData.order = 1;
  const panelMat = onTop(new THREE.MeshStandardMaterial({ map: logoTex, transparent: true, alphaTest: 0.4, roughness: 0.5 }), 1);
  // a plate's quad, with its cell's corner of the texture
  const plate = (id, w) => {
    const [x, y] = plateOf.get(id), g = new THREE.PlaneGeometry(w, w * PLATE.h / PLATE.w), uv = g.attributes.uv, TW = plateTex.image.width, TH = plateTex.image.height;
    const u0 = x / TW, u1 = (x + PLATE.w) / TW, v0 = 1 - (y + PLATE.h) / TH, v1 = 1 - y / TH;
    for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) ? u1 : u0, uv.getY(i) ? v1 : v0);
    return g;
  };
  // the depth of the plinths on each side of each aisle: the deepest product there
  const deepest = new Map();
  for (const pl of L.places) if (pl.p.placement !== "wall") { const k = `${L.aisles.indexOf(pl.aisle)}${pl.side}`; deepest.set(k, Math.max(deepest.get(k) || 0, sizeOf(pl.p).d)); }
  const contact = onTop(new THREE.MeshBasicMaterial({ map: softRect(30, 26, 0.55), transparent: true, depthWrite: false }), 2);
  const floorShade = onTop(new THREE.MeshBasicMaterial({ map: softRect(50, 50, 0.3), transparent: true, depthWrite: false }), 2);
  const frame = new THREE.Matrix4();
  for (const pl of L.places) {
    const s = sizeOf(pl.p), wall = pl.p.placement === "wall";
    frame.compose(new THREE.Vector3(pl.pos[0], 0, pl.pos[2]), Q.setFromEuler(E.set(0, pl.rot, 0)), ONE);
    if (wall) {
      // its plate on the wall under it
      put(plateMat, plate(pl.p.id, 0.48), [0, pl.pos[1] - 0.16, 0.009], [0, 0, 0], frame);
      continue;
    }
    const maxD = deepest.get(`${L.aisles.indexOf(pl.aisle)}${pl.side}`), pw = s.w + 0.1, pd = maxD + 0.1;
    const zc = (-s.d + maxD + 0.02) / 2, front = zc + pd / 2;
    put(mats.plinth, new THREE.BoxGeometry(pw, PLINTH - 0.012, pd), [0, 0.012 + (PLINTH - 0.012) / 2, zc], [0, 0, 0], frame);
    put(mats.trim, new THREE.BoxGeometry(pw - 0.03, 0.014, pd - 0.03), [0, 0.006, zc], [0, 0, 0], frame);
    put(plateMat, plate(pl.p.id, Math.min(0.46, pw - 0.06)), [0, 0.012 + (PLINTH - 0.012) / 2, front + 0.0015], [0, 0, 0], frame);
    put(contact, flat(s.w + 0.12, s.d + 0.12), [0, PLINTH + 0.001, 0], [0, 0, 0], frame);
    put(floorShade, flat(pw + 0.45, pd + 0.45), [0, 0.0012, zc], [0, 0, 0], frame);
  }
  // brand panels: one over each run of a brand along a side (floor-standing products only)
  const brands = [...new Set(products.map((p) => p.brand))];
  brands.forEach((b, i) => logoCells.set(b, [(i % 4) * 256, Math.floor(i / 4) * 80]));
  const lg = logoTex.image.getContext("2d");
  for (const b of brands) {
    const [x, y] = logoCells.get(b);
    lg.fillStyle = "#FFFFFF"; roundRect(lg, x + 2, y + 2, 252, 76, 14); lg.fill();
    const src = products.find((p) => p.brand === b)?.brandLogo;
    if (!src) continue;
    const img = new Image();
    img.onload = () => {
      const k = Math.min(196 / img.naturalWidth, 44 / img.naturalHeight), w = img.naturalWidth * k, h = img.naturalHeight * k;
      lg.drawImage(img, x + (256 - w) / 2, y + (80 - h) / 2, w, h);
      logoTex.needsUpdate = true;
      redraw();
    };
    img.src = src;
  }
  logoTex.needsUpdate = true;
  const panel = (b, w) => {
    const [x, y] = logoCells.get(b), g = new THREE.PlaneGeometry(w, w * 80 / 256), uv = g.attributes.uv;
    for (let i = 0; i < uv.count; i++) uv.setXY(i, (x + (uv.getX(i) ? 256 : 0)) / 1024, 1 - (y + (uv.getY(i) ? 0 : 80)) / 512);
    return g;
  };
  // (on a partition: a charcoal header board on its cap, on that side's half of it, so the two sides' boards never
  // share a face; on the hall's own wall: the card on the wall)
  const PW = 0.78, PH = PW * 80 / 256;
  L.aisles.forEach((a, ai) => {
    for (const side of ["L", "R"]) {
      const list = L.places.filter((pl) => pl.aisle === a && pl.side === side).sort((p, q) => q.pos[2] - p.pos[2]);
      if (!list.length || list.some((pl) => pl.p.placement === "wall")) continue;
      const outer = side === "L" ? ai === 0 : ai === L.aisles.length - 1;
      const face = side === "L" ? 1 : -1, px = side === "L" ? a.x0 : a.x1, H = outer ? 0 : L.partH[side === "L" ? ai - 1 : ai];
      for (let i = 0; i < list.length;) {
        let j = i;
        while (j + 1 < list.length && list[j + 1].p.brand === list[i].p.brand) j++;
        const z = (list[i].pos[2] + list[j].pos[2]) / 2;
        if (outer) put(panelMat, panel(list[i].p.brand, PW), [px + face * 0.012, 2.25, z], [0, face * Math.PI / 2, 0]);
        else {
          const y = H + 0.03 + (PH + 0.03) / 2;
          put(mats.trim, new THREE.BoxGeometry(0.03, PH + 0.03, PW + 0.03), [px + face * 0.016, y, z]);
          put(panelMat, panel(list[i].p.brand, PW), [px + face * 0.034, y, z], [0, face * Math.PI / 2, 0]);
        }
        i = j + 1;
      }
    }
  });
}
bakeAll();

// ── a slot per product: where it stands, its stand-in, and its model once loaded ──
const unitPlane = new THREE.PlaneGeometry(1, 1);
// A product not loaded yet stands as a box of its real size in its first colour, with a sheen like painted metal and
// its catalogue photo, cropped to the product, on the front: from across the hall it reads as that product. The box
// is drawn in two calls (its front, and the rest). When its model arrives, the box fades away round it.
const tints = new Map(); // one material per colour, shared by the stand-ins' sides, tops and backs
const tintOf = (hex) => {
  if (!tints.has(hex)) tints.set(hex, new THREE.MeshStandardMaterial({ color: new THREE.Color(hex || "#d9d9dc"), roughness: 0.32, metalness: 0.3 }));
  return tints.get(hex);
};
function standGeometry(w, h, d) {
  // a box whose five plain faces come first and the front (+z) last, as two groups
  const g = new THREE.BoxGeometry(w, h, d), idx = g.index.array, order = [0, 1, 2, 3, 5, 4], out = [];
  for (const f of order) { const gr = g.groups[f]; for (let i = 0; i < gr.count; i++) out.push(idx[gr.start + i]); }
  g.setIndex(out);
  g.clearGroups();
  g.addGroup(0, 30, 0);
  g.addGroup(30, 6, 1);
  return g;
}
const blobMat = onTop(new THREE.MeshBasicMaterial({ map: radialTexture([[0, "rgba(0,0,0,0.4)"], [0.55, "rgba(0,0,0,0.16)"], [1, "rgba(0,0,0,0)"]]), transparent: true, depthWrite: false }), 2);
const noRay = () => {};
const probe = document.createElement("canvas");
probe.width = probe.height = 96;
function frontTexture(src, tint) {
  // the catalogue photo (the product, front on, on white), cut to the product's own outline and stretched over the
  // box's front, which has the product's proportions; 256 px is plenty and keeps 35 of them light on a headset.
  // Until the photo comes, the front is the colour of the sides.
  const tex = canvasTexture(256, 256, (g) => { g.fillStyle = tint || "#d9d9dc"; g.fillRect(0, 0, 256, 256); });
  const img = new Image();
  img.fetchPriority = "low"; // the models near you come first
  img.decoding = "async";
  img.onload = () => {
    const pg = probe.getContext("2d", { willReadFrequently: true }), n = probe.width;
    pg.clearRect(0, 0, n, n);
    pg.drawImage(img, 0, 0, n, n);
    const px = pg.getImageData(0, 0, n, n).data;
    let x0 = n, y0 = n, x1 = -1, y1 = -1;
    for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
      const i = (y * n + x) * 4;
      if (Math.min(px[i], px[i + 1], px[i + 2]) < 236) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); }
    }
    const k = img.naturalWidth / n, kh = img.naturalHeight / n;
    const [sx, sy, sw, sh] = x1 < x0 ? [0, 0, img.naturalWidth, img.naturalHeight] : [x0 * k, y0 * kh, (x1 - x0 + 1) * k, (y1 - y0 + 1) * kh];
    tex.image.getContext("2d").drawImage(img, sx, sy, sw, sh, 0, 0, 256, 256);
    tex.needsUpdate = true;
    tex.userData.cropped = true;
    redraw();
  };
  img.src = src;
  return tex;
}
const slots = L.places.map((pl, i) => {
  const { p } = pl, size = sizeOf(p), wall = p.placement === "wall";
  const group = new THREE.Group();
  const stand = new THREE.Group();
  const tint = p.finishes?.[0]?.swatchColor, body = tintOf(tint);
  const front = new THREE.MeshStandardMaterial({ map: frontTexture(p.thumb, tint), roughness: 0.35, metalness: 0.05 });
  const box = new THREE.Mesh(standGeometry(size.w, size.h, size.d), [body, front]);
  box.position.set(0, size.h / 2, wall ? size.d / 2 : 0);
  stand.add(box);
  // a soft shadow under a floor unit, behind a wall unit: in passthrough only (in the hall the plinths carry theirs)
  const blob = new THREE.Mesh(unitPlane, blobMat);
  if (wall) { blob.scale.set(size.w + 0.3, size.h + 0.3, 1); blob.position.set(0, size.h / 2, 0.003); }
  else { blob.scale.set(size.w + 0.35, size.d + 0.35, 1); blob.rotation.x = -Math.PI / 2; blob.position.y = 0.004; }
  blob.raycast = noRay;
  blob.visible = false;
  group.add(stand, blob);
  world.add(group);
  const home = { ...pl, pos: [pl.pos[0], wall ? pl.pos[1] : PLINTH, pl.pos[2]] };
  const s = { i, p, size, wall, aisle: pl.aisle, home, group, stand, box, blob, model: null, loading: false, failed: false, fade: 0,
    moving: new Map(), state: {}, center: new THREE.Vector3(), front: new THREE.Vector3(), dist: 0, score: 0, arWall: null };
  group.userData.slot = s;
  placeSlot(s, home.pos, home.rot);
  return s;
});
function placeSlot(s, pos, rot) {
  s.group.position.set(...pos);
  s.group.rotation.set(0, rot, 0);
  s.group.updateMatrixWorld(true);
  s.center.set(0, s.size.h / 2, s.wall ? s.size.d / 2 : 0);
  s.group.localToWorld(s.center);
  s.front.set(Math.sin(rot), 0, Math.cos(rot));
}
const byId = new Map(slots.map((s) => [s.p.id, s]));
// the stand-in fades out over its model, which is already in place inside it
const FADE_MS = 450;
function fadeStand(s) {
  s.fade = performance.now();
  s.box.material = s.box.material.map((m) => Object.assign(m.clone(), { transparent: true, depthWrite: false }));
}
function endFade(s) {
  if (!s.fade) return;
  s.fade = 0;
  s.box.material.forEach((m) => m.dispose());
  s.box.material = [tintOf(s.p.finishes?.[0]?.swatchColor), s.frontMat];
  s.stand.visible = !s.model;
}
function stepFades(now) {
  let any = false;
  for (const s of slots) {
    if (!s.fade) continue;
    const k = (now - s.fade) / FADE_MS;
    if (k >= 1) { endFade(s); any = true; continue; }
    for (const m of s.box.material) m.opacity = 1 - ease(k);
    any = true;
  }
  return any;
}
for (const s of slots) s.frontMat = s.box.material[1];

// ── loading: the nearest models, CAP at most, one or two at a time ──
const gltfLoader = new GLTFLoader();
const ldr = { cap: CAP, near: NEAR, inFlight: 0, maxSeen: 0, loads: 0, unloads: 0, log: [] };
const busyCount = () => slots.reduce((n, s) => n + (s.model || s.loading ? 1 : 0), 0);
const seen = () => { ldr.maxSeen = Math.max(ldr.maxSeen, busyCount()); };
const tmpV = new THREE.Vector3();
// where you are and which way you look: the head in a headset; on a screen, the point the camera turns round
// (for distance) and the camera itself (for direction)
function eye() {
  if (xr) return { at: xr.head, from: xr.head, fwd: xr.fwd };
  const fwd = camera.getWorldDirection(new THREE.Vector3()).setY(0);
  if (fwd.lengthSq() < 1e-6) fwd.set(0, 0, -1);
  return { at: controls.target, from: camera.position, fwd: fwd.normalize() };
}
function planLoads() {
  const { at, from, fwd } = eye();
  for (const s of slots) {
    if (!s.group.visible) { s.dist = s.score = Infinity; continue; }
    s.dist = s.center.distanceTo(at);
    tmpV.subVectors(s.center, from).setY(0);
    const ang = tmpV.lengthSq() < 1e-6 ? 0 : Math.acos(clamp(tmpV.normalize().dot(fwd), -1, 1));
    // nearer first, then what is in front of you; one already loaded keeps its place unless clearly beaten
    s.score = s.dist + 2.5 * ang / Math.PI - (s.model || s.loading ? 1 : 0);
  }
  const ranked = slots.filter((s) => s.dist < ldr.near && (xr || s.center.distanceTo(from) < SEE)).sort((a, b) => a.score - b.score);
  const wanted = new Set(ranked.slice(0, ldr.cap));
  // far ones go; and while there are more than the cap allows (the cap is lower in a headset), the worst ones
  for (const s of slots) if (s.model && !wanted.has(s) && s.dist > ldr.near + HYST) unload(s);
  const spare = slots.filter((s) => s.model && !wanted.has(s)).sort((a, b) => b.score - a.score);
  const worst = () => spare.shift() || slots.filter((s) => s.model).sort((a, b) => b.score - a.score)[0];
  while (busyCount() > ldr.cap) { const out = worst(); if (!out) break; unload(out); }
  for (const s of ranked) {
    if (!wanted.has(s) || s.model || s.loading || s.failed) continue;
    if (ldr.inFlight >= PARALLEL) break;
    if (busyCount() >= ldr.cap) { const out = spare.shift(); if (!out) break; unload(out); }
    load(s);
  }
  seen();
  progress(wanted);
}
// a slim bar at the top of the view while the models near you load
let progressTimer = 0;
function progress(wanted) {
  const el = $("progress");
  if (!el || xr) return;
  const n = wanted.size, done = [...wanted].filter((s) => s.model || s.failed).length;
  const busy = n > 0 && done < n;
  if (busy) {
    clearTimeout(progressTimer);
    el.classList.remove("gone");
    el.querySelector("i").style.transform = `scaleX(${(0.08 + 0.92 * done / n).toFixed(3)})`;
    el.querySelector("span").textContent = `Loading 3D models near you · ${done} of ${n}`;
  } else if (!el.classList.contains("gone")) {
    el.querySelector("i").style.transform = "scaleX(1)";
    progressTimer = setTimeout(() => el.classList.add("gone"), 500);
  }
}
let planTimer = 0;
const planSoon = () => { clearTimeout(planTimer); planTimer = setTimeout(planLoads, 60); };

async function load(s) {
  s.loading = true;
  ldr.inFlight++; ldr.loads++;
  seen();
  try {
    const gltf = await gltfLoader.loadAsync(model(s.p.glb));
    await prepare(s, gltf);
    // its shaders are made before it is shown, so the swap from the stand-in costs no frame
    await renderer.compileAsync(gltf.scene, xr ? xr.cam : camera, scene).catch(() => {});
    fitSlot(s, gltf.scene);
    s.model = gltf.scene;
    s.group.add(s.model);
    fadeStand(s);
    ldr.log.push(`+${s.p.id}`);
    if (selected === s) renderCard();
    if (xr) xr.card.current = null; // its card in the headset says it can be opened now
    redraw();
  } catch (err) {
    console.warn("showroom: couldn't load", s.p.id, err);
    s.failed = true;
  } finally {
    s.loading = false;
    ldr.inFlight--;
    planSoon();
  }
}
// A model that reaches further back than its slot allows (a cord or hose behind its published depth) is stood forward
// just enough, so nothing goes into the partition or the wall behind it.
function fitSlot(s, root) {
  root.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(root);
  const limit = s.wall ? -0.004 : -(s.size.d / 2 + BACK - 0.02);
  s.shift = box.min.z < limit ? limit - box.min.z : 0;
  root.position.z += s.shift;
}
function unload(s) {
  if (!s.model) return;
  endFade(s);
  s.model.removeFromParent();
  disposeTree(s.model);
  s.model = null;
  s.moving.clear();
  s.stand.visible = true;
  ldr.unloads++;
  ldr.log.push(`-${s.p.id}`);
  if (selected === s) renderCard();
  redraw();
}
const TEX_KEYS = ["map", "normalMap", "roughnessMap", "metalnessMap", "aoMap", "emissiveMap", "alphaMap", "bumpMap", "clearcoatMap", "clearcoatNormalMap", "clearcoatRoughnessMap", "specularColorMap", "specularIntensityMap", "sheenColorMap", "sheenRoughnessMap", "transmissionMap", "thicknessMap", "iridescenceMap", "iridescenceThicknessMap", "anisotropyMap", "lightMap", "displacementMap"];
const texturesOf = (m) => TEX_KEYS.map((k) => m[k]).filter(Boolean);
// an ImageBitmap's memory goes at once, not at the next GC; an image another texture still shows stays
function freeTexture(t, keepSources) { t.dispose(); if (!keepSources?.has(t.source)) t.source?.data?.close?.(); }
function disposeTree(root, keep = null) {
  const geos = new Set(), mats = new Set();
  root.traverse((o) => { if (o.geometry) geos.add(o.geometry); for (const m of [].concat(o.material || [], o.userData.originalMaterial || [])) mats.add(m); });
  geos.forEach((g) => g.dispose());
  const texs = new Set();
  for (const m of mats) { if (keep?.mats.has(m)) continue; texturesOf(m).forEach((t) => texs.add(t)); m.dispose(); }
  const sources = keep && new Set([...keep.texs].map((t) => t.source));
  for (const t of texs) if (!keep?.texs.has(t)) freeTexture(t, sources);
}
// the materials and textures still in use under root
function inUse(root) {
  const mats = new Set(), texs = new Set();
  root.traverse((o) => { if (o.isMesh) for (const m of [].concat(o.material)) { mats.add(m); texturesOf(m).forEach((t) => texs.add(t)); } });
  return { mats, texs };
}

// a model, made ready for a room full of them
async function prepare(s, gltf) {
  const root = gltf.scene;
  // full anisotropic filtering on every texture, as xr.js: print and grain stay sharp at a slant
  const aniso = renderer.capabilities.getMaxAnisotropy();
  const sharpen = (m) => texturesOf(m).forEach((t) => (t.anisotropy = aniso));
  // its first finish, as the product page opens it (KHR_materials_variants, as xr.js)
  const variants = gltf.userData.gltfExtensions?.KHR_materials_variants?.variants?.map((v) => v.name) || [];
  const vi = variants.indexOf(s.p.finishes[0]?.variant);
  if (vi >= 0) {
    const jobs = [];
    root.traverse((o) => {
      const ext = o.isMesh && o.userData.gltfExtensions?.KHR_materials_variants;
      const mapping = ext?.mappings.find((m) => m.variants.includes(vi));
      if (mapping) jobs.push(gltf.parser.getDependency("material", mapping.material).then((m) => { o.material = m; gltf.parser.assignFinalMaterial(o); }));
    });
    await Promise.all(jobs);
  }
  root.traverse((o) => { if (o.isMesh) [].concat(o.material).forEach(sharpen); });
  // the fridge's food ("Fill the fridge" on the product page) stays out of the showroom, as the page starts empty
  const stock = [];
  root.traverse((o) => { if (o.userData.stock) stock.push(o); });
  const dropped = new THREE.Group();
  for (const o of stock) if (!stock.includes(o.parent)) dropped.add(o);
  // the moving parts, as xr.js swings them
  const nodes = new Map();
  for (const part of s.p.parts || []) { const n = root.getObjectByName(part.node); if (n) nodes.set(n, part); }
  // the other nodes a part moves (`also`: both freezer doors on one button)
  const alsoNodes = new Map();
  for (const part of s.p.parts || []) for (const a of part.also || []) { const n = root.getObjectByName(a.node); if (n) alsoNodes.set(n, [part, a]); }
  compact(root, new Set([...nodes.keys(), ...alsoNodes.keys()]));
  const keep = inUse(root);
  disposeTree(dropped, keep);
  // textures no bigger than a headset or phone needs
  if (TEX_MAX < 4096) for (const t of keep.texs) shrink(t);
  root.traverse((o) => {
    if (!o.isMesh) return;
    for (let n = o; n && n !== root; n = n.parent) if (nodes.has(n) || alsoNodes.has(n)) { o.userData.partKey = (nodes.get(n) || alsoNodes.get(n)[0]).key; break; }
  });
  s.moving.clear();
  for (const [node, part] of nodes) {
    const closed = node.quaternion.clone();
    const open = part.slide ? closed.clone() : closed.clone().multiply(new THREE.Quaternion().setFromAxisAngle(AXES[part.axis], THREE.MathUtils.degToRad(part.angle)));
    const at = node.position.clone();
    const out = part.slide ? at.clone().add(new THREE.Vector3(...part.slide)) : at.clone();
    const isOpen = !!s.state[part.key]; // a door left open stays open when the model comes back
    node.quaternion.copy(isOpen ? open : closed);
    node.position.copy(isOpen ? out : at);
    s.moving.set(part.key, { part, node, closed, open, at, out, isOpen, t: isOpen ? 1 : 0, from: 0, to: isOpen ? 1 : 0, start: 0, also: [] });
  }
  for (const [node, [part, a]] of alsoNodes) {
    const m = s.moving.get(part.key);
    if (!m) continue;
    const c = { node, closed: node.quaternion.clone(), at: node.position.clone() };
    c.open = a.slide ? c.closed.clone() : c.closed.clone().multiply(new THREE.Quaternion().setFromAxisAngle(AXES[a.axis || part.axis], THREE.MathUtils.degToRad(a.angle)));
    c.out = a.slide ? c.at.clone().add(new THREE.Vector3(...a.slide)) : c.at.clone();
    node.quaternion.copy(m.isOpen ? c.open : c.closed); node.position.copy(m.isOpen ? c.out : c.at);
    m.also.push(c);
  }
}
function shrink(t) {
  const img = t.image;
  if (!img?.width || Math.max(img.width, img.height) <= TEX_MAX) return;
  const k = TEX_MAX / Math.max(img.width, img.height);
  const c = document.createElement("canvas");
  c.width = Math.max(1, Math.round(img.width * k)); c.height = Math.max(1, Math.round(img.height * k));
  c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
  img.close?.();
  t.image = c;
  t.needsUpdate = true;
}
// Merges the fixed meshes that share a material into one, inside the model and inside each moving part, so a
// fridge is drawn in a few dozen calls. Anything that can't be merged safely (see-through and depth-writing, mirrored, with
// children or of another vertex layout) is left as it was. The builders' files interleave their vertex data,
// which mergeGeometries can't take, so each is copied out plainly first.
function plainCopy(g) {
  const out = new THREE.BufferGeometry();
  for (const [name, a] of Object.entries(g.attributes)) {
    const arr = new a.array.constructor(a.count * a.itemSize);
    for (let i = 0; i < a.count; i++) for (let k = 0; k < a.itemSize; k++) arr[i * a.itemSize + k] = a.getComponent(i, k);
    out.setAttribute(name, new THREE.BufferAttribute(arr, a.itemSize, a.normalized));
  }
  if (g.index) out.setIndex(new THREE.BufferAttribute(g.index.array.slice(), 1));
  return out;
}
function compact(root, movers) {
  root.updateMatrixWorld(true);
  const ownerOf = (o) => { for (let n = o.parent; n; n = n.parent) if (n === root || movers.has(n)) return n; return root; };
  const layout = (g) => Object.entries(g.attributes).map(([k, a]) => `${k}:${a.itemSize}:${a.normalized}:${a.array?.constructor.name}:${a.gpuType}`).sort().join() + (g.index ? "|i" : "");
  const groups = new Map(), local = new THREE.Matrix4(), inv = new THREE.Matrix4();
  root.traverse((o) => {
    // see-through pieces that don't write depth (bins, frosted covers) blend the same in any order, so they merge too
    if (!o.isMesh || !o.visible || o.isSkinnedMesh || o.children.length || movers.has(o) || Array.isArray(o.material) || (o.material.transparent && o.material.depthWrite)) return;
    const g = o.geometry;
    if (Object.keys(g.morphAttributes).length || !g.attributes.position || g.groups.length > 1) return;
    const owner = ownerOf(o);
    local.copy(inv.copy(owner.matrixWorld).invert()).multiply(o.matrixWorld);
    if (local.determinant() < 0) return;
    const key = `${owner.uuid}|${o.material.uuid}|${layout(g)}`;
    if (!groups.has(key)) groups.set(key, { owner, material: o.material, meshes: [] });
    groups.get(key).meshes.push([o, local.clone()]);
  });
  for (const { owner, material, meshes } of groups.values()) {
    if (meshes.length < 2) continue;
    const geos = meshes.map(([o, m]) => plainCopy(o.geometry).applyMatrix4(m));
    const merged = mergeGeometries(geos, false);
    geos.forEach((g) => g.dispose());
    if (!merged) continue;
    const mesh = new THREE.Mesh(merged, material);
    mesh.name = "merged";
    owner.add(mesh);
    for (const [o] of meshes) { o.removeFromParent(); o.geometry.dispose(); }
  }
}

// ── moving parts (as xr.js) ──
const partText = (part, open) => (part.text ? part.text[open ? 1 : 0] : `${open ? "Close" : "Open"} ${part.label}`);
function togglePart(s, key) {
  const m = s.moving.get(key);
  if (!m) return;
  // a part inside another opens its outer part with it, and shuts before the outer part does
  if (!m.isOpen) for (const k of needsOf(m.part)) if (!s.moving.get(k)?.isOpen) togglePart(s, k);
  if (m.isOpen) for (const [k, o] of s.moving) if (needsOf(o.part).includes(key) && o.isOpen) togglePart(s, k);
  m.isOpen = !m.isOpen;
  s.state[key] = m.isOpen;
  m.from = m.t; m.to = m.isOpen ? 1 : 0; m.start = performance.now();
}
function pressPart(s, key) {
  if (!s.moving.has(key)) return;
  if (!s.moving.get(key).isOpen) window.s3dTrack?.("PART", s.p.id, key); // usage counts (/track.js)
  togglePart(s, key);
  if (selected === s) renderCard();
  hintGone();
  redraw();
}
function animateParts(now) {
  let any = false;
  for (const s of slots) for (const m of s.moving.values()) {
    if (m.t === m.to) continue;
    const k = Math.min(1, (now - m.start) / SWING_MS);
    m.t = k >= 1 ? m.to : m.from + (m.to - m.from) * ease(k);
    m.node.quaternion.slerpQuaternions(m.closed, m.open, m.t);
    m.node.position.lerpVectors(m.at, m.out, m.t);
    for (const c of m.also) { c.node.quaternion.slerpQuaternions(c.closed, c.open, m.t); c.node.position.lerpVectors(c.at, c.out, m.t); }
    any = true;
  }
  return any;
}
// a hit on a moving part's own mesh names it; a hit on the cabinet goes by the parts' zones
function partFor(s, hit) {
  if (hit.object.userData.partKey) return hit.object.userData.partKey;
  if (!s.model) return null;
  return partAt(s.p, s.state, s.model.worldToLocal(hit.point.clone()));
}
const slotOf = (o) => { for (; o; o = o.parent) if (o.userData.slot) return o.userData.slot; return null; };
const shown = (o) => { for (; o; o = o.parent) if (!o.visible) return false; return true; }; // a ray ignores what is hidden
const inModel = (s, o) => { for (; o && o !== s.group; o = o.parent) if (o === s.model) return true; return false; };

// ── the page: hint, aisle tabs, product chips, names over the products, the product card ──
const svg = (d) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;
const touch = matchMedia("(pointer: coarse)").matches || isPhone;
$("hint").innerHTML = `${svg('<path d="M9 11V5.5a1.5 1.5 0 0 1 3 0V10"/><path d="M12 9.5a1.5 1.5 0 0 1 3 0V11"/><path d="M15 10.5a1.5 1.5 0 0 1 3 0V15a6 6 0 0 1-6 6h-.5a6 6 0 0 1-4.6-2.2L4.6 16a1.6 1.6 0 0 1 2.4-2.1L9 15.5"/>')}<span>${touch
  ? "<b>Drag</b> to look around · <b>pinch</b> to zoom · <b>tap</b> a product, then a door to open it"
  : "<b>Drag</b> to look around · <b>scroll</b> to zoom · <b>click</b> a product to walk up to it, then a door to open it"}</span>`;
let hintTimer = 0;
const hintGone = () => { clearTimeout(hintTimer); hintTimer = setTimeout(() => $("hint").classList.add("gone"), 400); };

// chips in the hall's order: aisle by aisle, front to back
const order = [...slots].sort((a, b) => L.aisles.indexOf(a.aisle) - L.aisles.indexOf(b.aisle) || b.home.pos[2] - a.home.pos[2] || a.home.pos[0] - b.home.pos[0]);
const cats = [[null, "All"], ...[...new Set(L.aisles.map((a) => a.cat))].map((c) => [c, L.aisles.find((a) => a.cat === c).title])];
let catFilter = null;
$("cats").innerHTML = cats.map(([c, label]) => `<button class="cat" type="button" data-cat="${esc(c ?? "")}" aria-pressed="${c === null}">${esc(label)}<span class="n">${slots.filter((s) => !c || s.p.category === c).length}</span></button>`).join("");
$("chips").innerHTML = order.map((s) => `<button class="chip" type="button" data-id="${esc(s.p.id)}" aria-pressed="false"><img src="${esc(s.p.thumb)}" alt="" loading="lazy" width="40" height="40"><span><b>${esc(s.p.brand)}</b><span class="nm">${esc(s.p.shortName)}</span></span></button>`).join("");
$("cats").querySelectorAll(".cat").forEach((b) => b.addEventListener("click", () => {
  setFilter(b.dataset.cat || null);
  if (catFilter) flyToAisle(L.aisles.find((a) => a.cat === catFilter)); else flyHome();
}));
function setFilter(c) {
  catFilter = c;
  $("cats").querySelectorAll(".cat").forEach((b) => b.setAttribute("aria-pressed", String((b.dataset.cat || null) === c)));
  $("chips").querySelectorAll(".chip").forEach((b) => b.classList.toggle("hide", !!c && byId.get(b.dataset.id).p.category !== c));
  $("chips").scrollLeft = 0;
}
$("chips").querySelectorAll(".chip").forEach((b) => b.addEventListener("click", () => select(byId.get(b.dataset.id), { fly: true })));

for (const s of slots) {
  const b = document.createElement("button");
  b.className = "tag";
  b.type = "button";
  b.tabIndex = -1; // the chips are the keyboard's way in
  b.setAttribute("aria-pressed", "false");
  b.innerHTML = `<b>${esc(s.p.brand)}</b> ${esc(s.p.shortName)}`;
  b.style.display = "none";
  b.addEventListener("click", () => select(s, { fly: true }));
  $("labels").appendChild(b);
  s.tag = b;
}
const LABEL_RANGE = 8, LABEL_MAX = light ? 3 : 4; // only the nearest few; those further off fade
const proj = new THREE.Vector3();
// A tag never sits under the page's own buttons, card or dock, or half off the view: one that would is left out. Each tag's size is
// measured once (again when the font arrives); the fixed parts are measured each time the tags move.
const tagSize = new Map();
function measureTags() {
  for (const s of slots) {
    const was = s.tag.style.display;
    s.tag.style.display = "";
    tagSize.set(s, [s.tag.offsetWidth, s.tag.offsetHeight]);
    s.tag.style.display = was;
  }
}
measureTags();
document.fonts?.ready.then(() => { measureTags(); redraw(); });
const FIXED = ["hint", "btnOverview", "btnVR", "btnAR", "pcard", "dock"];
function fixedRects() {
  const st = stage.getBoundingClientRect();
  return FIXED.map((id) => $(id)).filter((e) => e && e.offsetParent && !e.classList.contains("gone") && getComputedStyle(e).opacity !== "0")
    .map((e) => { const r = e.getBoundingClientRect(); return [r.left - st.left - 6, r.top - st.top - 6, r.right - st.left + 6, r.bottom - st.top + 6]; });
}
function updateLabels() {
  const W = stage.clientWidth, H = stage.clientHeight;
  const blocked = fixedRects();
  const c = camera.position;
  // inside the hall, below the partitions: only the names in your own aisle (the others are behind a partition)
  const inside = c.z < 0.2 && c.z > -L.D && Math.abs(c.x) < L.W / 2 && c.y < PART_H - 0.1;
  const mine = inside ? L.aisles.find((a) => c.x >= a.x0 && c.x <= a.x1) : null;
  const near = [];
  for (const s of slots) {
    s.labelAt ??= new THREE.Vector3();
    s.labelAt.set(0, s.size.h + 0.14, s.wall ? s.size.d / 2 : 0);
    s.group.localToWorld(s.labelAt);
    const d = s.labelAt.distanceTo(c);
    if (d > LABEL_RANGE || (inside && s.aisle !== mine) || !s.group.visible) continue;
    proj.copy(s.labelAt).project(camera);
    if (proj.z > 1 || proj.x < -1.05 || proj.x > 1.05 || proj.y < -1.05) continue; // above the view is handled below
    const [tw, th] = tagSize.get(s) || [160, 28], x = (proj.x + 1) / 2 * W;
    // the tag hangs above its point, centred; for a product taller than the view, at the view's top edge
    let y = (1 - proj.y) / 2 * H;
    if (y < th + 6) {
      const mid = tmpV.copy(s.center).project(camera);
      if (mid.y > 1 || mid.y < -1) continue; // the product itself is out of view
      y = th + 6;
    }
    const box = [x - tw / 2, y - th, x + tw / 2, y];
    if (box[0] < 4 || box[2] > W - 4) continue; // cut off at a side
    if (blocked.some((r) => box[0] < r[2] && r[0] < box[2] && box[1] < r[3] && r[1] < box[3])) continue;
    near.push([s, s === selected ? -1 : d, x, y, box]);
  }
  // nearest first (the chosen one before all); one that would cover a tag already placed is left out
  near.sort((a, b) => a[1] - b[1]);
  const placed = [];
  for (const n of near) {
    if (placed.length >= LABEL_MAX) break;
    const b = n[4];
    if (!placed.some(([, , , , r]) => b[0] < r[2] + 4 && r[0] < b[2] + 4 && b[1] < r[3] + 2 && r[1] < b[3] + 2)) placed.push(n);
  }
  const show = new Set(placed.map((n) => n[0]));
  for (const s of slots) if (!show.has(s)) s.tag.style.display = "none";
  for (const [s, d, x, y] of placed) {
    s.tag.style.display = "";
    s.tag.style.opacity = d < 0 ? "1" : clamp((LABEL_RANGE - d) / 3, 0.25, 1).toFixed(2);
    s.tag.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px) translate(-50%, -100%)`;
  }
}

let selected = null;
function select(s, { fly = false } = {}) {
  selected = s;
  for (const t of slots) t.tag.setAttribute("aria-pressed", String(t === s));
  $("chips").querySelectorAll(".chip").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.id === s?.p.id)));
  renderCard();
  if (!s) return;
  if (catFilter && s.p.category !== catFilter) setFilter(null);
  const chip = $("chips").querySelector(`.chip[data-id="${CSS.escape(s.p.id)}"]`);
  if (chip) $("chips").scrollTo({ left: chip.offsetLeft - ($("chips").clientWidth - chip.offsetWidth) / 2, behavior: "smooth" });
  if (fly) { const v = viewFor(s); flyTo(v.pos, v.target); }
  hintGone();
}
function renderCard() {
  const s = selected, card = $("pcard");
  card.classList.toggle("gone", !s);
  card.setAttribute("aria-hidden", String(!s));
  card.inert = !s;
  $("tools").classList.toggle("carded", !!s);
  fitCamera();
  if (!s) return;
  const p = s.p;
  $("pcLogo").src = p.brandLogo; $("pcLogo").alt = p.brand;
  $("pcCat").textContent = `${p.brand} · ${p.category}`;
  $("pcName").textContent = p.shortName;
  $("pcMeta").textContent = `Model ${p.model} · W ${parseFloat(p.size.w)} × H ${parseFloat(p.size.h)} × D ${parseFloat(p.size.d)} cm${s.model ? "" : s.failed ? " · its 3D model couldn’t load" : " · loading its 3D model…"}`;
  $("pcLink").href = `/p/${encodeURIComponent(p.id)}`;
  $("pcParts").innerHTML = (p.parts || []).map((x) => `<button type="button" data-key="${esc(x.key)}" aria-pressed="${!!s.state[x.key]}" ${s.model ? "" : "disabled"}>${esc(partText(x, !!s.state[x.key]))}</button>`).join("");
  $("pcParts").querySelectorAll("button").forEach((b) => b.addEventListener("click", () => pressPart(s, b.dataset.key)));
}
$("pcClose").addEventListener("click", () => select(null));

// ── the camera: where it goes for a product, an aisle and the whole hall, and how it flies there ──
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.09;
controls.maxPolarAngle = Math.PI * 0.495; // never under the floor
controls.minDistance = 0.4;
controls.maxDistance = 70;
controls.screenSpacePanning = true;
controls.addEventListener("change", redraw);
controls.addEventListener("start", () => { flight = null; hintGone(); });
// The dock (and on a phone the product card) covers the bottom of the 3D view, so the picture is centred in the
// part above it: the camera renders a taller image (setViewOffset) whose lower strip is under the dock. Its lens
// widens with what is covered, so the clear part always sees FOV degrees: on a phone the card covers nearly half
// the screen, and a fridge must still fit above it from across the walkway.
let covered = 0;
function fitCamera() {
  const w = stage.clientWidth, h = stage.clientHeight;
  if (!w || !h || xr) return; // a headset sizes its own view
  const top = (el) => el.getBoundingClientRect().top - stage.getBoundingClientRect().top;
  const card = $("pcard"), wide = card.getBoundingClientRect().width > w * 0.8;
  covered = clamp(Math.max(h - top($("dock")), !card.classList.contains("gone") && wide ? h - top(card) : 0), 0, h * 0.45);
  renderer.setSize(w, h, false);
  camera.aspect = w / (h + covered);
  camera.fov = THREE.MathUtils.radToDeg(2 * Math.atan(Math.tan(THREE.MathUtils.degToRad(FOV / 2)) * (h + covered) / Math.max(1, h - covered)));
  camera.setViewOffset(w, h + covered, 0, covered, w, h);
  camera.updateProjectionMatrix();
  redraw();
}
// tan of half the view's angle, up and across, over the part of it that isn't covered
const tans = () => { const t = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)), h = stage.clientHeight; return { v: t * (h - covered) / (h + covered), h: t * camera.aspect }; };
function viewFor(s) {
  // three-quarters on, at eye height, near enough to fill the screen and never past the walkway
  const tan = tans();
  const fit = Math.max(s.size.h * 1.2 / (2 * tan.v), s.size.w * 1.5 / (2 * tan.h));
  const dist = clamp(fit, 1.3, 2.35);
  const dir = s.front.clone().applyAxisAngle(Y, -0.38);
  const target = s.center.clone();
  const pos = target.clone().addScaledVector(dir, dist);
  pos.y = s.wall ? 1.55 : clamp(s.size.h * 0.95, 1.2, 1.7);
  return { pos, target };
}
// The whole hall from a corner above the entrance, three-quarters on, framed tight in the part of the view the page
// leaves clear (under the buttons, above the dock): on a tall phone screen, more from the side and from higher up.
function homeView() {
  const w = stage.clientWidth, h = stage.clientHeight, tall = h > w * 1.15;
  const az = tall ? -1.22 : -0.3, el = tall ? 1.2 : 0.84;
  const dir = new THREE.Vector3(Math.sin(az) * Math.cos(el), Math.sin(el), Math.cos(az) * Math.cos(el));
  const pts = [];
  for (const x of [-L.W / 2, L.W / 2]) for (const [z, y] of [[-L.D, 0], [-L.D, WALL_H], [0, WALL_H], [tall ? 0.3 : APRON * 0.5, 0]]) pts.push(new THREE.Vector3(x, y, z));
  const cam = camera.clone();
  const target = new THREE.Vector3(0, 0.5, -L.D / 2);
  const top = 1 - 2 * (tall ? 64 : 76) / h, bottom = -1 + 2 * (covered + (tall ? 60 : 16)) / h, side = 1 - 2 * (tall ? 10 : 30) / w;
  const tanF = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)), kx = tanF * camera.aspect, ky = tanF * h / (h + covered);
  let dist = Math.max(L.W, L.D) * 1.4;
  for (let i = 0; i < 14; i++) {
    cam.position.copy(target).addScaledVector(dir, dist);
    cam.lookAt(target);
    cam.updateMatrixWorld(true);
    let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
    for (const p of pts) { const v = p.clone().project(cam); x0 = Math.min(x0, v.x); x1 = Math.max(x1, v.x); y0 = Math.min(y0, v.y); y1 = Math.max(y1, v.y); }
    const right = new THREE.Vector3().setFromMatrixColumn(cam.matrixWorld, 0), up = new THREE.Vector3().setFromMatrixColumn(cam.matrixWorld, 1);
    target.addScaledVector(right, ((x0 + x1) / 2) * dist * kx).addScaledVector(up, ((y0 + y1) / 2 - (top + bottom) / 2) * dist * ky);
    dist *= Math.max((x1 - x0) / (2 * side), (y1 - y0) / (top - bottom));
  }
  return { pos: target.clone().addScaledVector(dir, dist), target };
}
function aisleView(a) {
  return { pos: new THREE.Vector3(a.mid, 3.4, 3.2), target: new THREE.Vector3(a.mid, 0.6, -a.len * 0.5) };
}
let flight = null;
function flyTo(pos, target, ms = 1000) {
  const d = camera.position.distanceTo(pos);
  flight = { p0: camera.position.clone(), t0: controls.target.clone(), p1: pos, t1: target, start: performance.now(), ms, lift: Math.min(3, d * 0.25) };
}
const flyHome = () => { const v = homeView(); flyTo(v.pos, v.target); };
const flyToAisle = (a) => { const v = aisleView(a); flyTo(v.pos, v.target); };
function jumpTo(v) { camera.position.copy(v.pos); controls.target.copy(v.target); camera.lookAt(v.target); controls.update(); redraw(); }
function stepFlight(now) {
  if (!flight) return false;
  const k = Math.min(1, (now - flight.start) / flight.ms), e = ease(k);
  camera.position.lerpVectors(flight.p0, flight.p1, e);
  camera.position.y += Math.sin(Math.PI * e) * flight.lift; // up and over the partitions
  controls.target.lerpVectors(flight.t0, flight.t1, e);
  camera.lookAt(controls.target);
  if (k >= 1) { flight = null; controls.update(); planLoads(); }
  return true;
}
$("btnOverview").addEventListener("click", () => { select(null); setFilter(null); flyHome(); });

// a tap (not a drag): on a door of a product you are near, open it; on any other product, walk up to it; on a
// sign, go to its aisle
const raycaster = new THREE.Raycaster();
const ndc = new THREE.Vector2();
let press = null;
renderer.domElement.addEventListener("pointerdown", (e) => { press = { x: e.clientX, y: e.clientY, t: Date.now() }; });
renderer.domElement.addEventListener("pointerup", (e) => {
  if (!press) return;
  const moved = Math.hypot(e.clientX - press.x, e.clientY - press.y), quick = Date.now() - press.t < 450;
  press = null;
  if (moved > 6 || !quick) return;
  tapAt(e.clientX, e.clientY);
});
function pickables() { return [...slots.filter((s) => s.group.visible).map((s) => s.group), ...signs, ...blockers]; }
function tapAt(x, y) {
  const r = renderer.domElement.getBoundingClientRect();
  ndc.set(((x - r.left) / r.width) * 2 - 1, -((y - r.top) / r.height) * 2 + 1);
  raycaster.setFromCamera(ndc, camera);
  const hit = raycaster.intersectObjects(pickables(), true).find((h) => shown(h.object));
  if (!hit) return;
  if (hit.object.userData.aisle) return flyToAisle(hit.object.userData.aisle);
  const s = slotOf(hit.object);
  if (!s) return;
  const near = selected === s || camera.position.distanceTo(s.center) < 4.2;
  const key = s.model && inModel(s, hit.object) ? partFor(s, hit) : null;
  if (key && near) { if (selected !== s) select(s); pressPart(s, key); return; }
  select(s, { fly: true });
}

// ── frame loop and size ──
let lastPlan = 0;
renderer.setAnimationLoop((time, frame) => {
  if (xr) return xrFrame(time, frame);
  const now = performance.now();
  let moved = stepFlight(now);
  if (!flight && controls.update()) moved = true;
  if (controls.target.y < 0) controls.target.y = 0;
  if (animateParts(now)) moved = true;
  if (stepFades(now)) moved = true;
  // not on the way: what a flight passes would load only to be dropped (it plans again when it lands)
  if (!flight && now - lastPlan > 300) { lastPlan = now; planLoads(); }
  if (moved || dirty > 0) {
    renderer.render(scene, camera);
    updateLabels();
    dirty = Math.max(0, dirty - 1);
  }
});
new ResizeObserver(() => { if (!xr) fitCamera(); }).observe(stage);
// the card, the buttons and the progress bar sit just above the dock, however tall it is
const dockFit = () => stage.style.setProperty("--dock-h", `${Math.round(stage.getBoundingClientRect().bottom - $("dock").getBoundingClientRect().top)}px`);
new ResizeObserver(dockFit).observe($("dock"));
dockFit();
fitCamera();

// ── where it opens: ?focus=<id> in front of that product, else the whole hall ──
const focus = focusId ? byId.get(focusId) : null;
if (focus) { select(focus); jumpTo(viewFor(focus)); }
else {
  jumpTo(homeView());
  // once the hall is on screen: building it can hold up the page longer than a toast lasts
  if (focusId) requestAnimationFrame(() => requestAnimationFrame(() => toast("That product isn’t in the showroom. Here is everything that is.", 6000)));
}
planLoads();
$("loading").remove();

// ── headsets ──
$("btnVR").classList.toggle("hide", !canVR);
$("btnAR").classList.toggle("hide", !canAR);
$("btnVR").addEventListener("click", () => enterXR("vr"));
$("btnAR").addEventListener("click", () => enterXR("ar"));
async function enterXR(mode) {
  if (xr) return;
  let session;
  try {
    // the first thing the tap does, as browsers require
    session = await navigator.xr.requestSession(mode === "ar" ? "immersive-ar" : "immersive-vr", { optionalFeatures: ["local-floor"] });
    await startXR(session, mode);
  } catch (err) {
    console.warn("showroom: headset", err);
    session?.end?.().catch(() => {});
    toast("The headset view couldn’t start. Try again.");
  }
}

async function startXR(session, mode) {
  const ar = mode === "ar";
  let type = "local-floor";
  try { await session.requestReferenceSpace("local-floor"); } catch { type = "local"; }
  renderer.xr.setReferenceSpaceType(type);
  renderer.xr.setFoveation?.(0.5);
  await renderer.xr.setSession(session);
  const xrCam = new THREE.PerspectiveCamera(60, 1, 0.03, 120);
  xr = {
    session, ar, base: renderer.xr.getReferenceSpace(), cam: xrCam, yaw: 0, T: new THREE.Vector3(),
    head: new THREE.Vector3(0, 1.6, 0), headBase: new THREE.Vector3(0, 1.6, 0), fwd: new THREE.Vector3(0, 0, -1),
    started: false, sources: new Map(), placeMenu: true, lastPlan: 0, poseOnly: false,
    floorY: type === "local" ? -1.5 : 0, sets: [], set: 0, ringCenter: new THREE.Vector3(), ringFwd: new THREE.Vector3(0, 0, -1),
  };
  world.position.y = xr.floorY; // no floor tracking: assume a standing eye height
  world.updateMatrixWorld(true);
  for (const s of slots) placeSlot(s, [s.group.position.x, s.group.position.y, s.group.position.z], s.group.rotation.y); // centres move with the floor
  document.body.classList.add("in-xr");
  ldr.cap = CAP_XR; ldr.near = NEAR_XR;
  $("progress")?.classList.add("gone");
  if (ar) { scene.background = null; hall.visible = false; for (const s of slots) s.blob.visible = true; }
  else scene.fog = new THREE.Fog(BG, 24, 46); // the far floor fades into the sky, past the hall's far corner

  // the pointer, its tooltip on a door, the product card and the panel by your side
  xr.tooltip = makeTooltip();
  xr.card = makeCard();
  xr.reticle = new THREE.Mesh(new THREE.RingGeometry(0.11, 0.135, 48), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.9, depthWrite: false }));
  xr.reticle.visible = false;
  xr.menu = makeMenu();
  scene.add(xr.tooltip.sprite, xr.card.mesh, xr.reticle, xr.menu.mesh);
  xr.anchor = new THREE.Object3D(); // where a product's card hangs
  scene.add(xr.anchor);
  if (ar) {
    // one category at a time, as many as fit the ring; a long one over two or more rings
    const room = 2 * Math.PI * RING_R * 0.9;
    for (const a of L.aisles) {
      const list = order.filter((s) => s.aisle === a);
      let cur = [];
      for (const s of list) { if (cur.length && ringArcs([...cur, s]).span > room) { xr.sets.push({ title: a.title, slots: cur }); cur = []; } cur.push(s); }
      if (cur.length) xr.sets.push({ title: a.title, slots: cur });
    }
    const n = {};
    xr.sets.forEach((st) => { n[st.title] = (n[st.title] || 0) + 1; st.n = n[st.title]; });
    xr.sets.forEach((st) => { if (n[st.title] > 1) st.title = `${st.title} ${st.n}`; });
    for (const s of slots) if (s.wall) {
      s.arWall ??= new THREE.Mesh(new THREE.PlaneGeometry(s.size.w + 0.4, s.size.h + 0.55), new THREE.MeshStandardMaterial({ color: 0xf2eee7, roughness: 0.95 }));
      s.arWall.position.set(0, s.size.h / 2, -0.004);
      s.group.add(s.arWall);
    }
  }
  drawMenu();

  for (const src of session.inputSources) addSource(src);
  session.addEventListener("inputsourceschange", (e) => { e.removed.forEach(removeSource); e.added.forEach(addSource); });
  session.addEventListener("select", (ev) => {
    const e = xr.sources.get(ev.inputSource);
    // tracked pointers act on what the ray showed in the last frame; gaze-and-pinch (Vision Pro's
    // transient-pointer) is only known at the moment of the pinch
    if (e?.line && !xr.poseOnly && performance.now() - e.hoverAt < 150) return act(e.hover, ev.inputSource);
    const pose = ev.frame.getPose(ev.inputSource.targetRaySpace, renderer.xr.getReferenceSpace());
    if (!pose) return;
    rayFromPose(pose);
    act(pick(), ev.inputSource);
  });
  session.addEventListener("end", endXR);
  redraw();
}

// You stand where the rig puts you: the world is the headset's own space turned by yaw about the vertical and
// moved by T. Teleporting and turning set a new offset reference space (getOffsetReferenceSpace).
function setRig(T, yaw) {
  xr.T.copy(T).setY(0);
  xr.yaw = yaw;
  const q = new THREE.Quaternion().setFromAxisAngle(Y, -yaw);
  const p = xr.T.clone().negate().applyQuaternion(q);
  renderer.xr.setReferenceSpace(xr.base.getOffsetReferenceSpace(new XRRigidTransform({ x: p.x, y: p.y, z: p.z }, { x: q.x, y: q.y, z: q.z, w: q.w })));
}
function teleport(point, yaw = xr.yaw) {
  const hb = new THREE.Vector3(xr.headBase.x, 0, xr.headBase.z).applyAxisAngle(Y, yaw);
  setRig(new THREE.Vector3(point.x - hb.x, 0, point.z - hb.z), yaw);
  xr.head.set(point.x, xr.head.y, point.z);
  xr.placeMenu = true;
  xr.lastPlan = 0;
}
const facing = (dir) => Math.atan2(dir.x, dir.z); // the yaw that looks along -dir
function standBefore(s) {
  const d = s.wall ? 1.7 : s.size.d / 2 + 1.25;
  const at = s.center.clone().addScaledVector(s.front, d);
  teleport(at, facing(s.front));
}
function goToAisle(a) { teleport(new THREE.Vector3(a.mid, 0, 0.6), 0); }
function startPose() {
  if (xr.ar) {
    xr.ringCenter.set(xr.head.x, 0, xr.head.z);
    xr.ringFwd.copy(xr.fwd);
    const at = focus ? xr.sets.findIndex((st) => st.slots.includes(focus)) : 0;
    setRing(Math.max(0, at));
    xr.placeMenu = true;
  } else if (focus) standBefore(focus);
  else teleport(new THREE.Vector3(0, 0, 1.4), 0);
}
// Where each of a ring's products stands, as a length along the ring from the first one's outer edge, and the whole
// ring's length: neighbours as far apart as their open doors need (spacing), measured where the ring is tightest,
// since everything in it faces the middle.
function ringArcs(list) {
  const depth = (p, z) => z - (p.placement === "wall" ? 0.15 : 0); // towards you from the ring's line
  const squeeze = (t) => Math.max(0.3, (RING_R - t) / RING_R);
  const at = [];
  list.forEach((s, i) => {
    const edge = s.size.w / 2 + 0.225;
    at.push(i ? Math.max(at[i - 1] + list[i - 1].size.w / 2 + 0.45 + s.size.w / 2, at[i - 1] + spacing(list[i - 1].p, s.p, 1, depth, squeeze)) : edge);
  });
  const span = list.length ? at.at(-1) + list.at(-1).size.w / 2 + 0.225 : 0;
  return { at, span };
}
// passthrough: the set's products in a ring round where you stood, each facing you, centred on your view
function setRing(k) {
  xr.set = k;
  const set = xr.sets[k], f = xr.ringFwd, right = new THREE.Vector3(-f.z, 0, f.x);
  for (const s of slots) s.group.visible = set.slots.includes(s);
  const { at, span } = ringArcs(set.slots);
  for (const [i, s] of set.slots.entries()) {
    const a = (at[i] - span / 2) / RING_R;
    const out = right.clone().multiplyScalar(Math.sin(a)).addScaledVector(f, Math.cos(a));
    const pos = xr.ringCenter.clone().addScaledVector(out, s.wall ? RING_R + 0.15 : RING_R);
    placeSlot(s, [pos.x, s.wall ? AC_Y - s.size.h / 2 : 0, pos.z], Math.atan2(-out.x, -out.z));
  }
  xr.lastPlan = 0;
  drawMenu();
}

function addSource(src) {
  const e = { hover: null, hoverAt: 0, turned: false };
  if (src.targetRayMode === "tracked-pointer") {
    const geo = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3(0, 0, 1)]);
    e.line = new THREE.Line(geo, new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.65 }));
    e.dot = new THREE.Mesh(new THREE.SphereGeometry(0.006, 12, 8), new THREE.MeshBasicMaterial({ color: 0xffffff }));
    scene.add(e.line, e.dot);
  }
  xr.sources.set(src, e);
}
function removeSource(src) {
  const e = xr?.sources.get(src);
  if (!e) return;
  if (e.line) { scene.remove(e.line, e.dot); e.line.geometry.dispose(); e.dot.geometry.dispose(); }
  xr.sources.delete(src);
}
const mtx = new THREE.Matrix4();
function rayFromPose(pose) {
  mtx.fromArray(pose.transform.matrix);
  raycaster.ray.origin.setFromMatrixPosition(mtx);
  raycaster.ray.direction.set(0, 0, -1).transformDirection(mtx);
}
// what a ray points at: the panel, a part or a product, a sign, a wall, or (in VR) the floor to stand on
function pick() {
  raycaster.far = 14;
  const ui = raycaster.intersectObject(xr.menu.mesh, false)[0];
  if (ui) return { type: "ui", point: ui.point, button: xr.menu.buttonAt(ui.uv), distance: ui.distance };
  const hit = raycaster.intersectObjects(pickables(), true).find((h) => shown(h.object));
  if (hit) {
    if (hit.object.userData.aisle) return { type: "sign", aisle: hit.object.userData.aisle, point: hit.point, distance: hit.distance };
    const s = slotOf(hit.object);
    if (s) {
      let key = s.model && inModel(s, hit.object) ? partFor(s, hit) : null;
      if (!s.moving.has(key)) key = null;
      return { type: key ? "part" : "product", slot: s, key, point: hit.point, distance: hit.distance };
    }
    return { type: "wall", point: hit.point, distance: hit.distance };
  }
  if (xr.ar) return null;
  const t = raycaster.ray.direction.y < -0.02 ? (xr.floorY - raycaster.ray.origin.y) / raycaster.ray.direction.y : -1;
  if (t > 0 && t < 14) {
    const p = raycaster.ray.at(t, new THREE.Vector3());
    if (Math.abs(p.x) < L.W / 2 - 0.25 && p.z < 4 && p.z > -L.D + 0.3) return { type: "floor", point: p, distance: t };
  }
  return null;
}
function act(hit, src) {
  if (!hit) return;
  if (hit.type === "ui" && hit.button) xr.menu.press(hit.button);
  else if (hit.type === "part") pressPart(hit.slot, hit.key);
  else if (hit.type === "product" && !xr.ar) standBefore(hit.slot);
  else if (hit.type === "sign") goToAisle(hit.aisle);
  else if (hit.type === "floor") teleport(hit.point);
  else return;
  src?.gamepad?.hapticActuators?.[0]?.pulse?.(0.35, 28);
}

function xrFrame(time, frame) {
  const now = performance.now();
  const pose = frame?.getViewerPose(renderer.xr.getReferenceSpace());
  const poseB = frame?.getViewerPose(xr.base);
  if (pose) {
    mtx.fromArray(pose.transform.matrix);
    xr.head.setFromMatrixPosition(mtx);
    const f = new THREE.Vector3(0, 0, -1).transformDirection(mtx).setY(0);
    if (f.lengthSq() > 1e-6) xr.fwd.copy(f.normalize());
  }
  if (poseB) xr.headBase.setFromMatrixPosition(mtx.fromArray(poseB.transform.matrix));
  if (!xr.started && pose && poseB) { xr.started = true; startPose(); }
  if (xr.placeMenu && pose && xr.started) { xr.placeMenu = false; placeMenu(); }
  animateParts(now);
  stepFades(now);
  if (now - xr.lastPlan > 300) { xr.lastPlan = now; planLoads(); }

  let tip = null, card = null, ret = null, hoverButton = null;
  for (const [src, e] of xr.sources) {
    if (!e.line) continue;
    const p = frame?.getPose(src.targetRaySpace, renderer.xr.getReferenceSpace());
    e.line.visible = e.dot.visible = !!p;
    if (!p) continue;
    rayFromPose(p);
    const hit = pick();
    e.hover = hit; e.hoverAt = now;
    const len = hit ? hit.distance : 2.5;
    e.line.position.copy(raycaster.ray.origin);
    e.line.lookAt(tmpV.copy(raycaster.ray.origin).add(raycaster.ray.direction));
    e.line.scale.set(1, 1, len);
    e.dot.position.copy(raycaster.ray.at(len, tmpV));
    if (hit?.type === "part") { tip = { text: partText(hit.slot.moving.get(hit.key).part, hit.slot.moving.get(hit.key).isOpen), point: hit.point }; card = hit.slot; }
    else if (hit?.type === "product") card = hit.slot;
    else if (hit?.type === "ui") hoverButton = hit.button;
    else if (hit?.type === "floor") ret = hit.point;
    // the thumbstick turns you 30 degrees at a time
    const ax = src.gamepad?.axes;
    const x = ax && ax.length >= 4 ? ax[2] : 0;
    if (Math.abs(x) > 0.7 && !e.turned) { e.turned = true; teleport(xr.head, xr.yaw - Math.sign(x) * Math.PI / 6); }
    else if (Math.abs(x) < 0.3) e.turned = false;
  }
  xr.menu.setHover(hoverButton);
  xr.tooltip.show(tip, xr.head);
  if (card) {
    xr.anchor.position.set(0, card.size.h + 0.22, card.wall ? card.size.d : card.size.d / 2);
    card.group.add(xr.anchor);
    xr.anchor.updateMatrixWorld(true);
    const size = `${parseFloat(card.p.size.w)} × ${parseFloat(card.p.size.h)} × ${parseFloat(card.p.size.d)} cm`;
    const how = card.p.parts?.length ? (card.model ? "Point at a door and pull the trigger, or look at it and pinch." : "Loading its 3D model…") : "";
    xr.card.show({ h: { title: `${card.p.brand} ${card.p.shortName}`, text: `${size}. ${how}` }, dot: xr.anchor }, xr.head);
  } else xr.card.show(null, xr.head);
  xr.reticle.visible = !!ret;
  if (ret) { xr.reticle.position.copy(ret).setY(xr.floorY + 0.005); xr.reticle.quaternion.setFromUnitVectors(AXES.z, Y); }
  renderer.render(scene, xr.cam);
}

function endXR() {
  const was = xr;
  if (!was) return;
  for (const src of [...was.sources.keys()]) removeSource(src);
  scene.remove(was.tooltip.sprite, was.card.mesh, was.reticle, was.menu.mesh, was.anchor);
  was.anchor.removeFromParent();
  for (const o of [was.tooltip.sprite, was.card.mesh, was.reticle, was.menu.mesh]) { o.geometry?.dispose(); o.material.map?.dispose(); o.material.dispose(); }
  xr = null;
  world.position.y = 0;
  world.updateMatrixWorld(true);
  for (const s of slots) { s.group.visible = true; s.blob.visible = false; if (s.arWall) s.arWall.removeFromParent(); placeSlot(s, s.home.pos, s.home.rot); }
  hall.visible = true;
  scene.background = BG;
  scene.fog = null;
  ldr.cap = CAP; ldr.near = NEAR;
  document.body.classList.remove("in-xr");
  fitCamera();
  planLoads();
  redraw();
}

// ── the panel by your side: aisles to jump to (VR) or the ring's category (passthrough), and Exit ──
function drawMenu() {
  const items = xr.ar
    ? xr.sets.map((st, i) => ({ id: `set:${i}`, label: st.title, pressed: i === xr.set, act: () => setRing(i) }))
    : [...L.aisles.map((a, i) => ({ id: `aisle:${i}`, label: a.of > 1 ? `${a.title} ${a.part}` : a.title, act: () => goToAisle(a) })),
      { id: "home", label: "Entrance", act: () => teleport(new THREE.Vector3(0, 0, 1.4), 0) }];
  items.push({ id: "exit", label: "Exit", act: () => xr.session.end(), wide: true });
  xr.menu.draw(xr.ar ? "Show in the ring" : "Go to an aisle", xr.ar ? "Point and pull the trigger, or pinch" : "Or point at the floor and pull the trigger", items);
}
function placeMenu() {
  const f = xr.fwd, left = new THREE.Vector3(f.z, 0, -f.x);
  const m = xr.menu.mesh;
  m.position.copy(xr.head).addScaledVector(f, 0.6).addScaledVector(left, 0.42);
  m.position.y = xr.head.y - 0.5;
  m.lookAt(xr.head);
}
function makeMenu() {
  const W = 1024, M = 0.44 / W;
  const c = document.createElement("canvas");
  c.width = W; c.height = 1024;
  const g = c.getContext("2d");
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: tex, transparent: true, toneMapped: false }));
  mesh.renderOrder = 10;
  let buttons = [], hover = null, last = null, sizedH = 0;
  function paint() {
    const { title, sub, items } = last;
    const bh = 104, gap = 18, colW = (W - 128 - gap) / 2;
    const rows = Math.ceil(items.filter((i) => !i.wide).length / 2) + items.filter((i) => i.wide).length;
    const H = 230 + rows * (bh + gap) + 40;
    if (sizedH !== H) { sizedH = c.height = H; mesh.geometry.dispose(); mesh.geometry = new THREE.PlaneGeometry(W * M, H * M); tex.dispose(); }
    g.clearRect(0, 0, W, H);
    g.fillStyle = "rgba(253,252,249,0.97)"; roundRect(g, 0, 0, W, H, 44); g.fill();
    g.fillStyle = COPPER; g.fillRect(64, 58, 72, 6);
    g.textAlign = "left"; g.textBaseline = "alphabetic";
    g.fillStyle = NAVY; g.font = `600 52px ${FONT}`; g.fillText(title, 64, 138);
    g.fillStyle = SLATE; g.font = `400 32px ${FONT}`; g.fillText(wrapText(g, sub, W - 128)[0] || "", 64, 190);
    buttons = [];
    let y = 230, col = 0;
    for (const it of items) {
      if (it.wide && col) { y += bh + gap; col = 0; }
      const x = 64 + col * (colW + gap), w = it.wide ? W - 128 : colW;
      const on = hover === it.id;
      g.fillStyle = it.pressed ? NAVY : on ? "#FDEBDC" : "#FFFFFF";
      roundRect(g, x, y, w, bh, 26); g.fill();
      if (!it.pressed) { g.lineWidth = 3; g.strokeStyle = on ? NAVY : HAIR; g.stroke(); }
      g.fillStyle = it.pressed ? "#FFFFFF" : it.id === "exit" ? COPPER_DK : NAVY;
      let fs = 40;
      do g.font = `600 ${fs}px ${FONT}`; while (g.measureText(it.label).width > w - 60 && --fs > 24);
      g.textBaseline = "middle";
      g.fillText(it.label, x + 30, y + bh / 2 + 1, w - 60);
      g.textBaseline = "alphabetic";
      buttons.push({ ...it, x, y, w, h: bh });
      if (it.wide || col === 1) { y += bh + gap; col = 0; } else col = 1;
    }
    tex.needsUpdate = true;
  }
  return {
    mesh,
    draw(title, sub, items) { last = { title, sub, items }; paint(); },
    buttonAt(uv) { if (!uv) return null; const x = uv.x * W, y = (1 - uv.y) * c.height; return buttons.find((b) => x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h) || null; },
    setHover(b) { const id = b?.id || null; if (id === hover) return; hover = id; paint(); },
    press(b) { b.act(); },
    buttonWorld(id) {
      const b = buttons.find((x) => x.id === id);
      if (!b) return null;
      mesh.updateMatrixWorld(true);
      return mesh.localToWorld(new THREE.Vector3(((b.x + b.w / 2) / W - 0.5) * W * M, (0.5 - (b.y + b.h / 2) / c.height) * c.height * M, 0));
    },
  };
}

// ── read-only views for automated checks ──
const v3 = (v) => v.toArray().map((n) => +n.toFixed(3));
window.__showroom = {
  layout: () => ({ W: +L.W.toFixed(2), D: +L.D.toFixed(2), LEN: +L.LEN.toFixed(2), PT, PART_H, PART_TALL, partH: L.partH, WALL_H, aisles: L.aisles.map((a) => ({ cat: a.cat, part: a.part, of: a.of, n: a.items.length, x: [+a.x0.toFixed(2), +a.x1.toFixed(2)], walk: a.walk.map((v) => +v.toFixed(2)), mid: +a.mid.toFixed(2), len: +a.len.toFixed(2) })) }),
  slots: () => slots.map((s) => {
    let meshes = 0;
    s.model?.traverse((o) => { if (o.isMesh) meshes++; });
    return { id: s.p.id, cat: s.p.category, loaded: !!s.model, loading: s.loading, visible: s.group.visible, center: v3(s.center), front: v3(s.front), state: { ...s.state }, meshes,
      stand: { shown: s.stand.visible && !s.fade, tint: `#${s.box.material[0].color.getHexString()}`, photo: !!s.frontMat.map.userData.cropped } };
  }),
  loader: () => ({ cap: ldr.cap, near: ldr.near, loaded: slots.filter((s) => s.model).length, loading: slots.filter((s) => s.loading).length, maxSeen: ldr.maxSeen, loads: ldr.loads, unloads: ldr.unloads, failed: slots.filter((s) => s.failed).map((s) => s.p.id) }),
  resetMax: () => { ldr.maxSeen = busyCount(); },
  camera: () => ({ pos: v3(camera.position), target: v3(controls.target), flying: !!flight }),
  look: (pos, target) => { flight = null; jumpTo({ pos: new THREE.Vector3(...pos), target: new THREE.Vector3(...target) }); planLoads(); },
  selected: () => selected?.p.id || null,
  card: () => ({ shown: !$("pcard").classList.contains("gone"), name: $("pcName").textContent, link: $("pcLink").getAttribute("href") }),
  // a point in a product's own model space, on the screen
  screenOf: (id, p) => { const s = byId.get(id); const v = s.group.localToWorld(new THREE.Vector3(...p)).project(camera); const r = renderer.domElement.getBoundingClientRect(); return v.z > 1 ? null : [r.left + (v.x + 1) / 2 * r.width, r.top + (1 - v.y) / 2 * r.height]; },
  draws: () => renderer.info.render.calls,
  // what a tap at a point on the page would land on: a product's id, an aisle's sign, or a wall
  hitAt: (x, y) => {
    const r = renderer.domElement.getBoundingClientRect();
    ndc.set(((x - r.left) / r.width) * 2 - 1, -((y - r.top) / r.height) * 2 + 1);
    raycaster.setFromCamera(ndc, camera);
    const hit = raycaster.intersectObjects(pickables(), true).find((h) => shown(h.object));
    return !hit ? null : hit.object.userData.aisle ? "sign" : slotOf(hit.object)?.p.id || "wall";
  },
  // Z-fighting and holes in the hall: from camera position `pos` looking at `target`, the hall alone (products hidden)
  // is drawn on magenta, then again from 1 mm away, each at twice the size and averaged down, as a 2x screen shows it.
  // flicker: the share of pixels that change a lot (two faces fighting for the same depth flip between frames; an
  // edge only slides a fraction of a pixel). holes: magenta pixels in the lower 60% of the
  // view (with no ceiling the sky is above the walls; below them it can only show through a gap).
  flicker: (pos, target, png = false) => {
    const was = slots.map((s) => s.group.visible);
    slots.forEach((s) => (s.group.visible = false));
    const bg = scene.background;
    scene.background = new THREE.Color(0xff00ff);
    const w = 640, h = 400, rt = new THREE.WebGLRenderTarget(2 * w, 2 * h, { samples: 4 }), buf = [new Uint8Array(w * h * 4), new Uint8Array(w * h * 4)];
    const big = new Uint8Array(16 * w * h);
    const cam = new THREE.PerspectiveCamera(FOV, w / h, camera.near, camera.far);
    let changed = 0;
    for (const off of [0, 0.001]) {
      cam.position.set(...pos).add(new THREE.Vector3(off * 0.7, off * 0.5, off * 0.5));
      cam.lookAt(...target);
      cam.updateMatrixWorld(true);
      renderer.setRenderTarget(rt);
      renderer.render(scene, cam);
      renderer.readRenderTargetPixels(rt, 0, 0, 2 * w, 2 * h, big);
      const out = buf[off ? 1 : 0];
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) for (let c = 0; c < 4; c++) {
        const i = (2 * y * 2 * w + 2 * x) * 4 + c, j = i + 2 * w * 4;
        out[(y * w + x) * 4 + c] = (big[i] + big[i + 4] + big[j] + big[j + 4] + 2) >> 2;
      }
    }
    renderer.setRenderTarget(null);
    let holes = 0;
    for (let i = 0; i < w * h * 4; i += 4) {
      if (Math.max(Math.abs(buf[0][i] - buf[1][i]), Math.abs(buf[0][i + 1] - buf[1][i + 1]), Math.abs(buf[0][i + 2] - buf[1][i + 2])) > 48) changed++;
      if (i / 4 < w * h * 0.6 && buf[0][i] > 235 && buf[0][i + 1] < 30 && buf[0][i + 2] > 235) holes++; // rows from the bottom
    }
    rt.dispose();
    scene.background = bg;
    slots.forEach((s, i) => (s.group.visible = was[i]));
    redraw();
    let image;
    if (png) { // the first frame, upright, with the changed pixels in red
      const c = document.createElement("canvas"); c.width = w; c.height = h;
      const g = c.getContext("2d"), im = g.createImageData(w, h);
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
        const i = ((h - 1 - y) * w + x) * 4, o = (y * w + x) * 4;
        const hot = Math.max(Math.abs(buf[0][i] - buf[1][i]), Math.abs(buf[0][i + 1] - buf[1][i + 1]), Math.abs(buf[0][i + 2] - buf[1][i + 2])) > 48;
        im.data.set(hot ? [255, 0, 0, 255] : [buf[0][i], buf[0][i + 1], buf[0][i + 2], 255], o);
      }
      g.putImageData(im, 0, 0); image = c.toDataURL();
    }
    return { flicker: +(changed / (w * h)).toFixed(5), holes, image };
  },
  memory: () => ({ ...renderer.info.memory }),
  labels: () => slots.filter((s) => s.tag.style.display !== "none").map((s) => s.p.id),
  // a loaded product's boxes in the hall: its body (all but the moving parts), and each part as it stands when open
  boxes: (id) => {
    const s = byId.get(id);
    if (!s?.model) return null;
    // in the product's own frame (its slot's), so a product turned to face you in the ring is measured square
    s.group.updateMatrixWorld(true);
    const inv = s.group.matrixWorld.clone().invert(), m4 = new THREE.Matrix4(), v = new THREE.Vector3();
    const box = (objs) => {
      const b = new THREE.Box3();
      for (const o of objs) o.traverse((x) => {
        if (!x.isMesh || !shown(x)) return;
        m4.multiplyMatrices(inv, x.matrixWorld);
        const p = x.geometry.attributes.position;
        for (let i = 0; i < p.count; i++) b.expandByPoint(v.fromBufferAttribute(p, i).applyMatrix4(m4));
      });
      return [v3(b.min), v3(b.max)];
    };
    const movers = new Set([...s.moving.values()].flatMap((m) => [m.node, ...m.also.map((c) => c.node)]));
    const fixed = [];
    s.model.traverse((o) => { if (!o.isMesh || !shown(o)) return; for (let n = o; n && n !== s.model; n = n.parent) if (movers.has(n)) return; fixed.push(o); });
    const parts = {};
    for (const [key, m] of s.moving) {
      const pose = (t) => { for (const c of [m, ...m.also]) { c.node.quaternion.slerpQuaternions(c.closed, c.open, t); c.node.position.lerpVectors(c.at, c.out, t); } };
      const outer = needsOf(m.part).map((k) => s.moving.get(k)).filter(Boolean);
      for (const o of outer) for (const c of [o, ...o.also]) { c.node.quaternion.copy(c.open); c.node.position.copy(c.out); }
      pose(1);
      s.model.updateMatrixWorld(true);
      parts[key] = box([m.node, ...m.also.map((c) => c.node)]);
      pose(m.t);
      for (const o of outer) for (const c of [o, ...o.also]) { c.node.quaternion.slerpQuaternions(c.closed, c.open, o.t); c.node.position.lerpVectors(c.at, c.out, o.t); }
      s.model.updateMatrixWorld(true);
    }
    return { at: v3(s.group.getWorldPosition(new THREE.Vector3())), rot: +s.group.rotation.y.toFixed(5), body: box(fixed), parts, shift: +(s.shift || 0).toFixed(3) };
  },
  caps: { canVR, canAR, light, CAP, CAP_XR, TEX_MAX },
};
window.__showroomXR = {
  info: () => xr && ({ mode: xr.ar ? "ar" : "vr", started: xr.started, head: v3(xr.head), yaw: +xr.yaw.toFixed(3), set: xr.set, sets: xr.sets.map((s) => s.title), ring: v3(xr.ringCenter), hallVisible: hall.visible,
    hovers: [...xr.sources.values()].map((e) => e.hover && { type: e.hover.type, id: e.hover.slot?.p.id, key: e.hover.key, button: e.hover.button?.id }) }),
  // a world point in the headset's own space, where the emulator's controllers live
  toDevice: (p) => { const v = new THREE.Vector3(...p).sub(xr.T).applyAxisAngle(Y, -xr.yaw); return v3(v); },
  partWorld: (id, key) => { const m = byId.get(id)?.moving.get(key); if (!m) return null; return v3(new THREE.Box3().setFromObject(m.node).getCenter(new THREE.Vector3())); },
  slotCenter: (id) => v3(byId.get(id).center),
  worldOf: (id, p) => v3(byId.get(id).group.localToWorld(new THREE.Vector3(...p))), // a point in a product's own model space
  menuShown: () => xr.menu.mesh.visible,
  menuButton: (id) => { const v = xr.menu.buttonWorld(id); return v && v3(v); },
  poseOnly: (on) => { xr.poseOnly = !!on; }, // select by the pose at the pinch, as Vision Pro's transient-pointer does
};
