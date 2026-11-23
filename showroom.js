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
import { Reflector } from "three/addons/objects/Reflector.js";
import { esc, cm, partAt, needsOf, CATEGORIES, finishPath, finishSlug } from "/site.js";
import { shownProducts } from "/live.js";
import { radialTexture, roundRect, wrapText, makeTooltip, makeCard } from "/xr.js";
import { loadPrices, mopOf, mopText } from "/prices.js";

const NAVY = "#0E0E0F", COPPER = "#F58A29", COPPER_DK = "#B85A12", SLATE = "#5E6066", HAIR = "#E3E3E6";
const FONT = "Outfit, Arial, sans-serif";
const $ = (id) => document.getElementById(id);
const pricesReady = loadPrices(); // (MOP: from the server's prices file when it has one; never in this repo)
let prices = new Map();
pricesReady.then((m) => { prices = m; });
const params = new URLSearchParams(location.search);
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const Y = new THREE.Vector3(0, 1, 0);
const AXES = { x: new THREE.Vector3(1, 0, 0), y: Y, z: new THREE.Vector3(0, 0, 1) };
// with "reduce motion" on, nothing eases: flights, the view sliding aside for the card and doors all move at once
const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
const SWING_MS = reduceMotion ? 1 : 900;
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
const FASCIA = 2.8;    // the charcoal band along the top of the hall's walls starts here
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
// No WebGL (switched off, or an old or locked-down browser): say so plainly and offer the catalogue, and stop here.
let renderer = null;
try {
  const probe = document.createElement("canvas");
  if (probe.getContext("webgl2") || probe.getContext("webgl")) renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
} catch { renderer = null; }
if (!renderer) {
  $("loading").innerHTML = `<div class="nogl glass" id="nogl"><h2>This browser can’t show the 3D showroom</h2>3D graphics (WebGL) are switched off or not available here. Every product is still in the catalogue, with its photos and details.<br><a href="/">See every product</a></div>`;
  $("dock").classList.add("hide"); $("tools").classList.add("hide"); $("hint").classList.add("hide"); $("minimap").classList.add("hide");
  await new Promise(() => {}); // (the rest of the page needs WebGL)
}
renderer.setPixelRatio(Math.min(devicePixelRatio, light ? 1.5 : 2));
renderer.setSize(stage.clientWidth, stage.clientHeight, false);
// Khronos PBR Neutral tone mapping, as the product pages (model-viewer) and xr.js: the products keep their true
// colours; a warm key light over a neutral studio environment, as a lit shop floor
renderer.toneMapping = THREE.NeutralToneMapping;
renderer.toneMappingExposure = 0.85;
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
let polished = null, plainFloor = null; // the polished (mirror) floor, on a laptop inside the hall, and the plain one
world.add(hall);
scene.add(world);
const FOV = 55; // degrees, up and down, in the part of the view the dock and card leave clear
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
// The room's fixtures (signs, panels, talkers, the reception, the room sets, plants, the shop front), each piece's box
// under its kind: the layout checks keep products and fixtures apart however the catalogue grows.
const fixtures = [];
let fixtureTag = null;
function put(mat, geo, pos, rot = [0, 0, 0], frame = null) {
  geo.applyMatrix4(M4.compose(new THREE.Vector3(...pos), Q.setFromEuler(E.set(...rot)), ONE));
  if (frame) geo.applyMatrix4(frame);
  if (fixtureTag) { geo.computeBoundingBox(); fixtures.push({ tag: fixtureTag, box: geo.boundingBox.clone() }); }
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
// The client's palette for the walls (sRGB, as given): greige on the walls and partitions, champagne behind the room
// sets, ice blue as the air conditioners' accent, charcoal on the feature surfaces and bands, ivory on the ceiling and
// trim. The surfaces painted in it are drawn unlit and outside tone mapping, so on screen they are these very colours
// wherever the wall-wash light doesn't add to them; the products keep the shop's lights.
const PAL = { greige: "#D9D2C5", champagne: "#EEE8DC", ice: "#C8DCE7", charcoal: "#343A40", ivory: "#F7F6F2" };
const CHARCOAL = PAL.charcoal;
// an unlit surface in the palette (with the screen-space dither that keeps its gradients from banding)
const paint = (map, color = 0xffffff) => new THREE.MeshBasicMaterial({ map, color, toneMapped: false, dithering: true });
const mats = {
  floor: null,
  wall: null,
  part: null,
  trim: new THREE.MeshStandardMaterial({ color: 0x343a40, roughness: 0.45, metalness: 0.2 }),
  skirt: paint(null, new THREE.Color(PAL.ivory)),       // skirting along the walls and partitions
  charcoal: paint(null, new THREE.Color(PAL.charcoal)), // the logo wall's face
  warm: onTop(new THREE.MeshBasicMaterial({ color: 0xffd7a6, toneMapped: false }), 2), // warm LED lines (about 2800 K)
  plinth: new THREE.MeshStandardMaterial({ color: 0xf6f4f0, roughness: 0.38, metalness: 0 }),
  copper: new THREE.MeshStandardMaterial({ color: 0xf58a29, roughness: 0.4, metalness: 0.1 }),
  counterTop: new THREE.MeshStandardMaterial({ color: 0xfbfaf8, roughness: 0.25, metalness: 0 }),
  light: new THREE.MeshBasicMaterial({ color: 0xffffff, toneMapped: false }),
  ground: new THREE.MeshBasicMaterial({ color: BG, toneMapped: false }),
};
mats.trim.userData.block = false;
{
  const { W, D, LEN } = L;
  // the porcelain floor: large-format 120 cm tiles, each a shade of its own with faint clouding, and fine grout
  const T = 1024, TILE = 1.2;
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
  // On a laptop, inside the hall, the floor is polished: a mirror image of the hall, softened (drawn small and
  // read from a blurred level) and stronger at a glancing angle, over the same tiles. It costs a second drawing of
  // the hall, so phones, headsets and the view from above keep the plain floor.
  if (!light) {
    const shader = {
      name: "PolishedFloor",
      uniforms: { color: { value: null }, tDiffuse: { value: null }, textureMatrix: { value: null }, tFloor: { value: floorTex }, rep: { value: floorTex.repeat.clone() }, lightK: { value: 1.0 }, k0: { value: 0.1 }, k1: { value: 0.55 } },
      vertexShader: `uniform mat4 textureMatrix; uniform vec2 rep; varying vec4 vUv; varying vec2 vMap; varying vec3 vWorld;
        void main() { vUv = textureMatrix * vec4(position, 1.0); vMap = uv * rep; vec4 w = modelMatrix * vec4(position, 1.0); vWorld = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`,
      fragmentShader: `uniform vec3 color; uniform sampler2D tDiffuse; uniform sampler2D tFloor; uniform float lightK, k0, k1;
        varying vec4 vUv; varying vec2 vMap; varying vec3 vWorld;
        void main() {
          vec3 base = texture2D(tFloor, vMap).rgb * lightK;
          vec3 refl = texture2DProj(tDiffuse, vUv, 1.2).rgb;
          float c = clamp(normalize(cameraPosition - vWorld).y, 0.0, 1.0);
          float f = k0 + (k1 - k0) * pow(1.0 - c, 4.0);
          gl_FragColor = vec4(mix(base, refl, f), 1.0);
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
        }`,
    };
    const rw = Math.round(Math.min(1024, stage.clientWidth * 0.5)), rh = Math.round(Math.min(640, stage.clientHeight * 0.5));
    polished = new Reflector(new THREE.PlaneGeometry(FW, FD), { textureWidth: rw, textureHeight: rh, clipBias: 0.002, multisample: 0, shader });
    const rt = polished.getRenderTarget();
    rt.texture.generateMipmaps = true;
    rt.texture.minFilter = THREE.LinearMipmapLinearFilter;
    polished.rotation.x = -Math.PI / 2;
    polished.position.set(0, 0, (APRON - D) / 2);
    polished.visible = false;
    hall.add(polished);
  }
  // round the hall: a plain ground a step lower, the colour of the sky, with a soft shadow round the hall
  put(mats.ground, flat(400, 400), [0, -0.03, -D / 2]);
  const pad = onTop(new THREE.MeshBasicMaterial({ map: softRect(40, 60, 0.35), transparent: true, depthWrite: false, toneMapped: false }), 1);
  put(pad, flat(W + 5, FD + 5), [0, -0.029, (APRON - D) / 2]);
  // the step's edge round the apron
  put(mats.trim, new THREE.BoxGeometry(W + 0.02, 0.03, 0.02), [0, -0.015, APRON]);
  for (const sx of [-1, 1]) put(mats.trim, new THREE.BoxGeometry(0.02, 0.03, APRON + SINK), [sx * (W / 2 + 0.01), -0.015, (APRON - SINK) / 2]);

  // walls: greige, a little darker just above the floor, a charcoal fascia along the top over a thin orange line
  mats.wall = paint(stripTexture(WALL_H + SINK, -SINK, (g, w) => {
    g.fillStyle = PAL.greige; g.fillRect(0, -SINK, w, WALL_H + SINK);
    const ao = g.createLinearGradient(0, 0, 0, 0.6); ao.addColorStop(0, "rgba(70,58,44,0.12)"); ao.addColorStop(1, "rgba(70,58,44,0)");
    g.fillStyle = ao; g.fillRect(0, 0, w, 0.6);
    g.fillStyle = "#F58A29"; g.fillRect(0, FASCIA - 0.03, w, 0.03);
    g.fillStyle = CHARCOAL; g.fillRect(0, FASCIA, w, WALL_H - FASCIA + 0.01);
  }));
  mats.wall.userData.block = true;
  // single-sided: the back, and the two sides from the entrance to the back
  const wall = (w, x, z, ry) => put(mats.wall, new THREE.PlaneGeometry(w, WALL_H + SINK), [x, (WALL_H - SINK) / 2, z], [0, ry, 0]);
  wall(W + 2 * SINK, 0, -D, 0);
  wall(D + SINK, -W / 2, -(D + SINK) / 2, Math.PI / 2);
  wall(D + SINK, W / 2, -(D + SINK) / 2, -Math.PI / 2);
  // skirting along the walls
  const SK = 0.1;
  put(mats.skirt, new THREE.BoxGeometry(W, SK + 0.02, 0.016), [0, (SK - 0.02) / 2, -D + 0.006]);
  for (const sx of [-1, 1]) put(mats.skirt, new THREE.BoxGeometry(0.016, SK + 0.02, D), [sx * (W / 2 - 0.006), (SK - 0.02) / 2, -D / 2]);

  // display partitions between the aisles: a pale panel, darker near the floor, a charcoal cap, skirting both sides,
  // and a charcoal trim on each end
  // (a charcoal band 16 cm deep along the top over a thin orange line; one material per partition height)
  const partMats = new Map();
  const partMat = (H) => {
    if (!partMats.has(H)) {
      // (greige, as the walls)
      const m = paint(stripTexture(H + 0.02, -0.02, (g, w) => {
        g.fillStyle = PAL.greige; g.fillRect(0, -0.02, w, H + 0.02);
        const ao = g.createLinearGradient(0, 0, 0, 0.6); ao.addColorStop(0, "rgba(70,58,44,0.12)"); ao.addColorStop(1, "rgba(70,58,44,0)");
        g.fillStyle = ao; g.fillRect(0, 0, w, 0.6);
        g.fillStyle = "#F58A29"; g.fillRect(0, H - 0.18, w, 0.018);
        g.fillStyle = CHARCOAL; g.fillRect(0, H - 0.162, w, 0.2);
      }));
      m.userData.block = true;
      partMats.set(H, m);
    }
    return partMats.get(H);
  };
  L.partH = L.aisles.slice(0, -1).map((a, i) => L.places.some((pl) => pl.p.placement === "wall" && ((pl.aisle === a && pl.side === "R") || (pl.aisle === L.aisles[i + 1] && pl.side === "L"))) ? PART_TALL : PART_H);
  L.aisles.slice(0, -1).forEach((a, i) => {
    const H = L.partH[i];
    put(partMat(H), new THREE.BoxGeometry(PT, H + 0.02, LEN), [a.x1, (H - 0.02) / 2, -LEN / 2]);
    put(mats.trim, new THREE.BoxGeometry(PT + 0.02, 0.045, LEN - 0.01), [a.x1, H + 0.0125, -LEN / 2]); // the cap
    for (const zc of [-0.021, -LEN + 0.021]) put(mats.trim, new THREE.BoxGeometry(PT + 0.032, H + 0.08, 0.05), [a.x1, (H + 0.06) / 2, zc]);
    for (const sx of [-1, 1]) put(mats.skirt, new THREE.BoxGeometry(0.016, SK + 0.02, LEN - 0.02), [a.x1 + sx * (PT / 2 + 0.006), (SK - 0.02) / 2, -LEN / 2]);
    // a warm LED line up the middle of the partition's end, towards the entrance
    put(mats.warm, new THREE.PlaneGeometry(0.012, H - 0.1), [a.x1, (H - 0.1) / 2 + 0.06, 0.005]);
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
    g.fillStyle = PAL.ivory; g.fillRect(0, 0, 256, 256);
    g.fillStyle = "rgba(150,140,125,0.3)"; g.fillRect(0, 0, 256, 2); g.fillRect(0, 0, 2, 256); g.fillRect(0, 127, 256, 2); g.fillRect(127, 0, 2, 256);
  });
  ceilTex.wrapS = ceilTex.wrapT = THREE.RepeatWrapping;
  ceilTex.repeat.set((W + 2 * SINK) / 1.2, (D + SINK) / 1.2);
  const ceilMat = paint(ceilTex);
  L.paint = { wall: mats.wall, partitions: [...partMats.values()], ceiling: ceilMat }; // (for the palette check)
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
  // the glow each strip throws on the ceiling round it (a soft warm band, added to what is there)
  const haloTex = canvasTexture(8, 128, (g) => {
    const gr = g.createLinearGradient(0, 0, 0, 128);
    gr.addColorStop(0, "rgba(255,236,205,0)"); gr.addColorStop(0.5, "rgba(255,236,205,0.55)"); gr.addColorStop(1, "rgba(255,236,205,0)");
    g.fillStyle = gr; g.fillRect(0, 0, 8, 128);
  });
  const haloMat = onTop(new THREE.MeshBasicMaterial({ map: haloTex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false }), 1);
  for (const a of L.aisles) {
    const len = Math.max(1, a.len - 1.6);
    put(haloMat, new THREE.PlaneGeometry(len + 0.6, 1.3), [a.mid, WALL_H - 0.003, -a.len / 2 - 0.2], [Math.PI / 2, 0, Math.PI / 2]);
  }
  for (const z of [-LEN - (D - LEN) * 0.3, -LEN - (D - LEN) * 0.7]) put(haloMat, new THREE.PlaneGeometry(W - 1.2, 1.0), [0, WALL_H - 0.003, z], [Math.PI / 2, 0, 0]);
  // black track rails along each walkway's edges, with spotlights aimed at the products on that side
  for (const a of L.aisles) {
    const len = Math.max(1, a.len - 1.2), zc = -a.len / 2 - 0.1;
    for (const [sx, xr] of [[-1, a.walk[0] + 0.35], [1, a.walk[1] - 0.35]]) {
      put(mats.trim, new THREE.BoxGeometry(0.035, 0.03, len), [xr, WALL_H - 0.03, zc]);
      for (let z = zc + len / 2 - 0.8; z > zc - len / 2 + 0.3; z -= 2.2) {
        put(mats.trim, new THREE.CylinderGeometry(0.008, 0.008, 0.12, 6), [xr, WALL_H - 0.1, z]);
        // the head leans out over the walkway and points down at the side's products
        put(mats.trim, new THREE.CylinderGeometry(0.03, 0.024, 0.12, 12), [xr - sx * 0.035, WALL_H - 0.18, z], [0, 0, sx * 0.75]);
        put(mats.light, new THREE.CircleGeometry(0.02, 12), [xr - sx * 0.035 + sx * 0.0615 * Math.sin(0.75), WALL_H - 0.18 - 0.0615 * Math.cos(0.75), z], [Math.PI / 2, 0, sx * 0.75, "ZYX"]);
      }
    }
  }
  // Wall-wash: warm light (about 2800 K) from small recessed washers in the ceiling by the walls, spreading down each
  // wall in a soft scallop, as in a lit shop: over every product's bay (on the hall's walls and the partitions),
  // over the air conditioners, along the room sets and across the logo wall. One scallop texture (its falloff
  // smooth, the dither on the material keeping it from banding), added to what is there; the lit walls take the
  // warmth, the products keep their true colour.
  // (eps, gp, fp: how tight the hot spot under the washer is and how fast the light falls off down the wall)
  const scallopOf = (eps, gp, fp) => {
    const w = 128, h = 256, c = document.createElement("canvas"); c.width = w; c.height = h;
    const g = c.getContext("2d"), img = g.createImageData(w, h);
    let peak = 0;
    const v = new Float32Array(w * h);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      // the washer sits a little above the top edge and out from the wall; the light grazes down the wall
      const dx = (x + 0.5) / w - 0.5, dy = (y + 0.5) / h + 0.05, r = Math.hypot(dx * 1.9, dy), cone = Math.atan2(Math.abs(dx) * 1.9, dy);
      const edge = Math.min(1, Math.max(0, (0.95 - cone) / 0.5)), beam = edge * edge * (3 - 2 * edge);
      const graze = dy / Math.pow(r * r + eps, gp), foot = Math.pow(1 - (y + 0.5) / h, fp);
      v[y * w + x] = beam * graze * foot; peak = Math.max(peak, v[y * w + x]);
    }
    for (let k = 0; k < w * h; k++) {
      const a = Math.min(1, v[k] / peak * 1.1);
      img.data.set([255, 180, 107, Math.round(a * 255)], k * 4); // (3000 K)
    }
    g.putImageData(img, 0, 0);
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
    return t;
  };
  const scallopTex = scallopOf(0.04, 1.1, 1.4), fanTex = scallopOf(0.14, 0.7, 0.8); // (a fuller fan for the air conditioners' wall)
  const washMat = (k, map = scallopTex) => onTop(new THREE.MeshBasicMaterial({ map, color: new THREE.Color(k, k, k), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false, dithering: true }), 1);
  // (additive blending happens after the shader turns the colour to sRGB, so these small factors already add a lot)
  const wash = washMat(0.2), washDark = washMat(0.5); // (on charcoal, more light to show the same glow)
  // (over the air conditioners: the units hide the middle of a scallop, so theirs go between and beside them, stronger)
  const washAC = washMat(0.42, fanTex); // (about as strong as the logo wall's)
  const unitGaps = (units) => {
    const u = [...units].sort((p, q) => q.pos[2] - p.pos[2]), hw = (pl) => sizeOf(pl.p).w / 2, out = [u[0].pos[2] + hw(u[0]) + 0.3];
    for (let i = 0; i + 1 < u.length; i++) out.push((u[i].pos[2] - hw(u[i]) + u[i + 1].pos[2] + hw(u[i + 1])) / 2);
    out.push(u.at(-1).pos[2] - hw(u.at(-1)) - 0.3);
    return out;
  };
  L.paint.wash = wash;
  // a scallop on a face: centred at u along it, its top at y; nx, nz: the face's direction
  const scallop = (mat, x, z, ry, top, w = 1.3, h = 2.1) => put(mat, new THREE.PlaneGeometry(w, h), [x, top - h / 2, z], [0, ry, 0]);
  L.wash = [];
  const scallopAt = (mat, x, z, ry, top, w, h) => { scallop(mat, x, z, ry, top, w, h); L.wash.push([x, top - h * 0.55, z]); };
  // the hall's own walls: one every 1.6 m or so, and one over each product standing against that wall instead
  const LWALL = Math.min(7, W * 0.4);
  const along = (from, to, at) => {
    const n = Math.max(1, Math.round(Math.abs(to - from) / 1.6)), out = [];
    for (let i = 0; i < n; i++) out.push(from + (to - from) * (i + 0.5) / n);
    return out.filter((u) => !at.some((c) => Math.abs(c - u) < 0.9)).concat(at);
  };
  const onWall = (side) => L.places.filter((pl) => (side === "L" ? pl.aisle === L.aisles[0] : pl.aisle === L.aisles.at(-1)) && pl.side === side);
  for (const [side, x, ry] of [["L", -W / 2 + 0.004, Math.PI / 2], ["R", W / 2 - 0.004, -Math.PI / 2]]) {
    const units = onWall(side).filter((pl) => pl.p.placement === "wall");
    for (const z of along(-0.6, -D + 0.6, onWall(side).filter((pl) => pl.p.placement !== "wall").map((pl) => pl.pos[2]).concat(units.length ? unitGaps(units) : []))) {
      const ac = units.some((pl) => Math.abs(pl.pos[2] - z) < sizeOf(pl.p).w / 2 + 0.75);
      scallopAt(ac ? washAC : wash, x, z, ry, FASCIA, ac ? 1.1 : 1.3, 2.1);
    }
  }
  for (const x of along(-W / 2 + 0.6, W / 2 - 0.6, []).filter((u) => Math.abs(u) > LWALL / 2 + 0.5)) scallopAt(wash, x, -D + 0.004, 0, FASCIA, 1.3, 2.1);
  // the logo wall: four across its face, the logo between the middle two
  for (const f of [-0.375, -0.125, 0.125, 0.375]) scallopAt(washDark, f * LWALL, -D + 0.0805, 0, WALL_H - 0.05, 1.5, 2.6);
  // the partitions: over each product's bay, on its own side, from just under the charcoal band
  L.aisles.slice(0, -1).forEach((a, i) => {
    const H = L.partH[i], top = H - 0.2;
    for (const [isLeft, units] of [[true, L.places.filter((pl) => pl.aisle === a && pl.side === "R" && pl.p.placement === "wall")], [false, L.places.filter((pl) => pl.aisle === L.aisles[i + 1] && pl.side === "L" && pl.p.placement === "wall")]]) {
      if (units.length) for (const z of unitGaps(units)) scallopAt(washAC, a.x1 + (isLeft ? -1 : 1) * (PT / 2 + 0.004), z, isLeft ? -Math.PI / 2 : Math.PI / 2, H - 0.2, 1.1, Math.min(1.9, H - 0.25));
    }
    for (const pl of L.places) {
      const left = pl.aisle === a && pl.side === "R", right = pl.aisle === L.aisles[i + 1] && pl.side === "L";
      if ((!left && !right) || pl.p.placement === "wall") continue;
      const sw = Math.min(1.4, sizeOf(pl.p).w + 0.55);
      scallopAt(wash, a.x1 + (left ? -1 : 1) * (PT / 2 + 0.004), pl.pos[2], left ? -Math.PI / 2 : Math.PI / 2, top, sw, Math.min(1.9, top - 0.05));
    }
  });
  // the washers themselves: a small round light in the ceiling over each scallop on the hall's walls
  const washer = new THREE.CircleGeometry(0.045, 16).rotateX(Math.PI / 2);
  for (const [x, , z] of L.wash) {
    const ix = Math.abs(x) > W / 2 - 0.1 ? x - Math.sign(x) * 0.35 : x, iz = z < -D + 0.1 ? z + 0.35 : z;
    if (Math.abs(x) > W / 2 - 0.1 || z < -D + 0.1) put(mats.warm, washer.clone(), [ix, WALL_H - 0.004, iz]);
  }

  fixtureTag = "aisle sign";
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
      g.fillStyle = COPPER; roundRect(g, 30, 30, 226, 226, 30); g.fill();
      g.fillStyle = NAVY; g.textAlign = "center"; g.textBaseline = "middle";
      g.font = `600 28px ${FONT}`; if (g.letterSpacing !== undefined) g.letterSpacing = "4px"; g.fillText("AISLE", 145, 70);
      if (g.letterSpacing !== undefined) g.letterSpacing = "0px";
      g.font = `700 150px ${FONT}`; g.fillText(String(a.n), 143, 166);
      // the line under the title names every brand: smaller, then without "Part x of y", then on two lines;
      // never cut short
      const models = `${count} model${count === 1 ? "" : "s"} · ${brands.join(", ")}`;
      const tries = a.of > 1 ? [`Part ${a.part} of ${a.of} · ${models}`, models] : [models];
      let lines = null, size = 38;
      for (; size >= 30 && !lines; size -= 2) {
        g.font = `500 ${size}px ${FONT}`;
        lines = tries.map((t) => [t]).find(([t]) => g.measureText(t).width <= 690) || null;
      }
      if (!lines) for (size = 34; size >= 24; size -= 2) { g.font = `500 ${size}px ${FONT}`; lines = wrapText(g, models, 690); if (lines.length <= 2) break; }
      g.textAlign = "left"; g.textBaseline = "alphabetic"; g.fillStyle = "#FFFFFF";
      const two = lines.length > 1, ty = two ? 126 : 148;
      g.font = `600 ${two ? 86 : 96}px ${FONT}`; g.fillText(a.title, 290, ty, 700);
      g.fillStyle = "#B9B9BE"; g.font = `500 ${size}px ${FONT}`;
      lines.forEach((l, i) => g.fillText(l, 292, ty + 62 + i * (size + 8)));
      g.fillStyle = COPPER; g.fillRect(292, ty + 62 + (lines.length - 1) * (size + 8) + 22, 72, 5);
    });
    const sw = Math.min(2.3, a.walk[1] - a.walk[0] - 0.1), sh = sw * 0.28, y = 2.68, z = -0.5;
    const face = new THREE.MeshBasicMaterial({ map: tex, toneMapped: false });
    const TILT = 0.2; // its front leans back a little, so it reads from the overview as well as from the door
    put(mats.trim, new THREE.BoxGeometry(sw + 0.04, sh + 0.04, 0.05), [a.mid, y, z], [-TILT, 0, 0]);
    const topY = y + Math.cos(TILT) * (sh / 2 + 0.02), topZ = z - Math.sin(TILT) * (sh / 2 + 0.02);
    for (const sx of [-1, 1]) put(mats.trim, new THREE.CylinderGeometry(0.006, 0.006, WALL_H - topY + 0.01, 8), [a.mid + sx * (sw / 2 - 0.15), (WALL_H + topY) / 2, topZ]);
    for (const ry of [0, Math.PI]) {
      const s = new THREE.Mesh(new THREE.PlaneGeometry(sw, sh), onTop(face.clone(), 1));
      s.material.map = tex;
      s.position.set(a.mid, y + Math.sin(TILT) * (ry ? -0.027 : 0.027), z + Math.cos(TILT) * (ry ? -0.027 : 0.027));
      s.rotation.set(-TILT, ry, 0, "XYZ");
      s.userData.aisle = a;
      hall.add(s); signs.push(s);
    }
  });

  fixtureTag = null;
  // the aisle's number and category on the floor at its entrance, for the view from above (the hanging sign is
  // nearly edge-on from there)
  {
    const FK = HQ ? 1 : 0.5, rows = 2 ** Math.ceil(Math.log2(L.aisles.length));
    const ftex = canvasTexture(1024 * FK, 256 * rows * FK, (g) => {
      g.scale(FK, FK);
      L.aisles.forEach((a, i) => {
        const y = i * 256 + 128;
        let fs = 150;
        for (g.font = `600 ${fs}px ${FONT}`; g.measureText(a.title).width > 1024 - 290 && fs > 60; fs -= 4) g.font = `600 ${fs - 4}px ${FONT}`;
        const tw = g.measureText(a.title).width, x0 = (1024 - (220 + 40 + tw)) / 2;
        g.fillStyle = COPPER; g.beginPath(); g.arc(x0 + 110, y, 108, 0, Math.PI * 2); g.fill();
        g.fillStyle = "#FFFFFF"; g.textAlign = "center"; g.textBaseline = "middle"; g.font = `700 140px ${FONT}`; g.fillText(String(a.n), x0 + 110, y + 8);
        g.fillStyle = "#2A2A2D"; g.textAlign = "left"; g.font = `600 ${fs}px ${FONT}`; g.fillText(a.title, x0 + 260, y + 6);
      });
    });
    const fmat = onTop(new THREE.MeshBasicMaterial({ map: ftex, transparent: true, depthWrite: false, opacity: 0.92 }), 3);
    fmat.userData.order = 1;
    L.aisles.forEach((a, i) => {
      const fw = Math.min(2.8, a.walk[1] - a.walk[0] - 0.2), g = flat(fw, fw / 4), uv = g.attributes.uv;
      for (let k = 0; k < uv.count; k++) uv.setY(k, 1 - (i + (uv.getY(k) ? 0 : 1)) / rows);
      put(fmat, g, [a.mid, 0.002, -0.75]);
    });
  }

  fixtureTag = "reception";
  // the logo wall at the far end, with a counter in front of it
  const LW = Math.min(7, W * 0.4), LH = WALL_H;
  put(mats.charcoal, new THREE.BoxGeometry(LW, LH + 0.02, 0.08), [0, (LH - 0.02) / 2, -D + 0.04]);
  // warm LED lines down both its sides, in the reveal against the greige wall
  for (const sx of [-1, 1]) put(mats.warm, new THREE.PlaneGeometry(0.014, LH - 0.3), [sx * (LW / 2 + 0.001), (LH - 0.3) / 2 + 0.15, -D + 0.05], [0, sx * Math.PI / 2, 0]);
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
  // the reception counter: a charcoal front with a raised white ledge over a strip of light, short returns at both
  // ends, and a lower white desk behind the front for the staff side
  const CW = Math.min(3, LW * 0.5), cz = -D + Math.min(1.3, (D - LEN) * 0.6), RD = 0.62, CFD = 0.32;
  const front = cz + RD / 2 - CFD / 2; // the front run's middle
  put(mats.trim, new THREE.BoxGeometry(CW, 1.06, CFD), [0, 0.53, front]);
  put(mats.counterTop, new THREE.BoxGeometry(CW + 0.05, 0.035, CFD + 0.05), [0, 1.075, front + 0.015]);
  put(mats.light, new THREE.BoxGeometry(CW - 0.02, 0.012, 0.004), [0, 1.045, front + CFD / 2 + 0.002]);
  put(mats.copper, new THREE.BoxGeometry(CW - 0.04, 0.016, 0.006), [0, 0.09, front + CFD / 2 + 0.002]);
  for (const sx of [-1, 1]) {
    put(mats.trim, new THREE.BoxGeometry(0.3, 1.06, RD - CFD + 0.01), [sx * (CW / 2 - 0.15), 0.53, cz - CFD / 2 - 0.005]);
    put(mats.counterTop, new THREE.BoxGeometry(0.35, 0.035, RD - CFD - 0.02), [sx * (CW / 2 - 0.15 + 0.025), 1.07, cz - CFD / 2 - 0.015]);
  }
  put(mats.counterTop, new THREE.BoxGeometry(CW - 0.62, 0.03, RD - CFD - 0.02), [0, 0.76, cz - CFD / 2 - 0.01]);
  const counter = new THREE.Mesh(new THREE.BoxGeometry(CW + 0.05, 1.1, RD + 0.05), new THREE.MeshBasicMaterial({ visible: false }));
  counter.position.set(0, 0.55, cz + 0.01);
  hall.add(counter); blockers.push(counter);
  L.counter = { x: [-(CW + 0.05) / 2, (CW + 0.05) / 2], z: [cz - RD / 2 - 0.02, cz + RD / 2 + 0.04] };
}

fixtureTag = null;
// ── the plinths, their name plates and the brand panels (from the layout) ──
// A floor-standing product stands on a plinth 6 cm high, as deep as the deepest on its side of the aisle (so their
// fronts line up), with its brand and name on the front; a product on the wall has the same plate under it. A brand
// panel hangs on the partition over each brand's run.
const PLATE = { w: 512, h: 48, cols: 4 }; // the name plates' cells in one texture
const plateTex = canvasTexture(PLATE.w * PLATE.cols, 2 ** Math.ceil(Math.log2(Math.ceil(L.places.length / PLATE.cols) * PLATE.h)), () => {});
const plateOf = new Map();
const logoCells = new Map(); // brand -> cell in the logo texture
// (four brands to a row of cells, as many rows as the brands need)
const logoTex = canvasTexture(1024, Math.max(512, 2 ** Math.ceil(Math.log2(Math.ceil(new Set(products.map((p) => p.brand)).size / 4) * 80))), () => {});
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
  const panelMat = onTop(new THREE.MeshBasicMaterial({ map: logoTex, transparent: true, alphaTest: 0.4, toneMapped: false }), 1); // lit from inside
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
  const pool = onTop(new THREE.MeshBasicMaterial({ map: canvasTexture(128, 128, (g) => {
    const gr = g.createRadialGradient(64, 40, 4, 64, 52, 66); gr.addColorStop(0, "rgba(255,240,215,0.2)"); gr.addColorStop(0.6, "rgba(255,240,215,0.06)"); gr.addColorStop(1, "rgba(255,240,215,0)");
    g.fillStyle = gr; g.fillRect(0, 0, 128, 128);
  }), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false }), 3);
  const frame = new THREE.Matrix4();
  for (const pl of L.places) {
    const s = sizeOf(pl.p), wall = pl.p.placement === "wall";
    frame.compose(new THREE.Vector3(pl.pos[0], 0, pl.pos[2]), Q.setFromEuler(E.set(0, pl.rot, 0)), ONE);
    if (wall) {
      // its plate on the wall under it (a fixture, so the layout checks keep the room sets' frames and lamps off it)
      fixtureTag = "name plate";
      put(plateMat, plate(pl.p.id, 0.48), [0, pl.pos[1] - 0.16, 0.009], [0, 0, 0], frame);
      fixtureTag = null;
      continue;
    }
    const maxD = deepest.get(`${L.aisles.indexOf(pl.aisle)}${pl.side}`), pw = s.w + 0.1, pd = maxD + 0.1;
    const zc = (-s.d + maxD + 0.02) / 2, front = zc + pd / 2;
    put(mats.plinth, new THREE.BoxGeometry(pw, PLINTH - 0.012, pd), [0, 0.012 + (PLINTH - 0.012) / 2, zc], [0, 0, 0], frame);
    put(mats.trim, new THREE.BoxGeometry(pw - 0.03, 0.014, pd - 0.03), [0, 0.006, zc], [0, 0, 0], frame);
    put(plateMat, plate(pl.p.id, Math.min(0.46, pw - 0.06)), [0, 0.012 + (PLINTH - 0.012) / 2, front + 0.0015], [0, 0, 0], frame);
    put(mats.light, new THREE.PlaneGeometry(pw - 0.05, 0.004), [0, 0.008, front - 0.015 + 0.0012], [0, 0, 0], frame); // the light under its lip
    put(contact, flat(s.w + 0.12, s.d + 0.12), [0, PLINTH + 0.001, 0], [0, 0, 0], frame);
    put(floorShade, flat(pw + 0.45, pd + 0.45), [0, 0.0012, zc], [0, 0, 0], frame);
    // the pool of light from the downlight over it, on the floor in front
    put(pool, flat(pw + 0.7, 1.3), [0, 0.0016, front + 0.6], [0, 0, 0], frame);
  }
  fixtureTag = "brand panel";
  // brand panels: one over each run of a brand along a side (floor-standing products only)
  const brands = [...new Set(products.map((p) => p.brand))];
  brands.forEach((b, i) => logoCells.set(b, [(i % 4) * 256, Math.floor(i / 4) * 80]));
  const onLogo = new Map(), logoImg = new Map(); // brand -> what to draw once its logo is in, and its image
  const lg = logoTex.image.getContext("2d");
  for (const b of brands) {
    const [x, y] = logoCells.get(b);
    lg.fillStyle = "#FFFFFF"; roundRect(lg, x + 2, y + 2, 252, 76, 14); lg.fill();
    const src = products.find((p) => p.brand === b)?.brandLogo;
    if (!src) continue;
    const img = new Image();
    logoImg.set(b, img);
    img.onload = () => {
      const k = Math.min(196 / img.naturalWidth, 44 / img.naturalHeight), w = img.naturalWidth * k, h = img.naturalHeight * k;
      lg.drawImage(img, x + (256 - w) / 2, y + (80 - h) / 2, w, h);
      logoTex.needsUpdate = true;
      for (const f of (onLogo.get(b) || [])) f(img);
      redraw();
    };
    img.src = src;
  }
  logoTex.needsUpdate = true;
  const panel = (b, w) => {
    const [x, y] = logoCells.get(b), g = new THREE.PlaneGeometry(w, w * 80 / 256), uv = g.attributes.uv;
    for (let i = 0; i < uv.count; i++) uv.setXY(i, (x + (uv.getX(i) ? 256 : 0)) / 1024, 1 - (y + (uv.getY(i) ? 0 : 80)) / logoTex.image.height);
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

  fixtureTag = "aisle panel";
  // a lit panel on the bare stretch of partition or wall between the entrance and each side's first product: the
  // aisle and category, and the logos of the brands along that side
  const LP = { w: 512, h: 340, cols: 4, rows: Math.ceil(L.aisles.length * 2 / 4) }, lk = HQ ? 1 : 0.5, LPH = Math.max(1024, 2 ** Math.ceil(Math.log2(LP.rows * LP.h)));
  const lightTex = canvasTexture(LP.w * LP.cols * lk, LPH * lk, () => {});
  const lpg = lightTex.image.getContext("2d");
  const lightMat = onTop(new THREE.MeshBasicMaterial({ map: lightTex, toneMapped: false }), 1);
  let cell = 0;
  L.aisles.forEach((a, ai) => {
    for (const side of ["L", "R"]) {
      const list = L.places.filter((pl) => pl.aisle === a && pl.side === side).sort((p, q) => q.pos[2] - p.pos[2]);
      if (!list.length || cell >= LP.cols * LP.rows) continue;
      const bare = -(list[0].pos[2] + sizeOf(list[0].p).w / 2 + 0.05);
      if (bare < 1.0) continue;
      const outer = side === "L" ? ai === 0 : ai === L.aisles.length - 1;
      const face = side === "L" ? 1 : -1, px = side === "L" ? a.x0 + (outer ? 0 : PT / 2) : a.x1 - (outer ? 0 : PT / 2);
      const pw = Math.min(1.5, bare - 0.4), ph = pw * LP.h / LP.w, z = -bare / 2, y = 1.3;
      const cx = (cell % LP.cols) * LP.w, cy = Math.floor(cell / LP.cols) * LP.h;
      cell++;
      // the panel's face
      const runBrands = [...new Set(list.map((pl) => pl.p.brand))];
      const draw = () => {
        lpg.setTransform(lk, 0, 0, lk, 0, 0);
        const bg = lpg.createLinearGradient(0, cy, 0, cy + LP.h); bg.addColorStop(0, PAL.champagne); bg.addColorStop(1, PAL.greige);
        lpg.fillStyle = bg; lpg.fillRect(cx, cy, LP.w, LP.h);
        lpg.textAlign = "center"; lpg.textBaseline = "alphabetic";
        lpg.fillStyle = COPPER_DK; lpg.font = `600 20px ${FONT}`;
        if (lpg.letterSpacing !== undefined) lpg.letterSpacing = "5px";
        lpg.fillText(`AISLE ${a.n}`, cx + LP.w / 2 + 2.5, cy + 54);
        if (lpg.letterSpacing !== undefined) lpg.letterSpacing = "0px";
        lpg.fillStyle = "#2A2A2D"; lpg.font = `600 52px ${FONT}`; lpg.fillText(a.title, cx + LP.w / 2, cy + 112, LP.w - 60);
        lpg.fillStyle = COPPER; lpg.fillRect(cx + LP.w / 2 - 30, cy + 130, 60, 4);
        const cols = runBrands.length <= 3 ? runBrands.length : 3, rows = Math.ceil(runBrands.length / cols), cw = (LP.w - 50) / cols, ch = Math.min(80, 170 / rows);
        runBrands.forEach((b, i) => {
          const img = logoImg.get(b);
          if (!img?.naturalWidth) return;
          const r = Math.floor(i / cols), inRow = Math.min(cols, runBrands.length - r * cols), x0 = cx + (LP.w - inRow * cw) / 2 + (i % cols) * cw;
          const k = Math.min((cw - 34) / img.naturalWidth, (ch - 26) / img.naturalHeight), w = img.naturalWidth * k, h = img.naturalHeight * k;
          lpg.drawImage(img, x0 + (cw - w) / 2, cy + 152 + r * ch + (ch - h) / 2, w, h);
        });
        lightTex.needsUpdate = true;
      };
      draw();
      for (const b of runBrands) { if (!onLogo.has(b)) onLogo.set(b, []); onLogo.get(b).push(draw); }
      // a charcoal frame and the panel
      put(mats.trim, new THREE.BoxGeometry(0.03, ph + 0.05, pw + 0.05), [px + face * 0.015, y, z]);
      const g = new THREE.PlaneGeometry(pw, ph), uv = g.attributes.uv, TW = LP.w * LP.cols, TH = LPH;
      for (let i = 0; i < uv.count; i++) uv.setXY(i, (cx + (uv.getX(i) ? LP.w : 0)) / TW, 1 - (cy + (uv.getY(i) ? 0 : LP.h)) / TH);
      put(lightMat, g, [px + face * 0.032, y, z], [0, face * Math.PI / 2, 0]);
    }
  });
}
fixtureTag = null;
// ── shelf talkers: a small card on the partition beside each product, where there is room: its brand, its name
// and two of its listed specs (from the catalogue, word for word) ──
const TALK = { w: 192, h: 256, cols: L.places.length > 150 ? 20 : 10 }, TALK_SPECS = {
  Refrigerator: ["Energy rating", "Compressor", "Type", "Convertible"],
  "Washing machine": ["Max spin", "Energy rating", "Motor", "Programmes"],
  "Air conditioner": ["Energy rating", "Inverter", "Capacity"],
};
{
  const tk = HQ ? 1 : 0.5, rows = Math.ceil(L.places.length / TALK.cols);
  const tex = canvasTexture(TALK.w * TALK.cols * tk, 2 ** Math.ceil(Math.log2(rows * TALK.h)) * tk, () => {});
  const g = tex.image.getContext("2d"), TW = TALK.w * TALK.cols, TH = tex.image.height / tk;
  g.scale(tk, tk);
  const mat = onTop(new THREE.MeshBasicMaterial({ map: tex, toneMapped: false }), 1);
  const CW = 0.15, CH = CW * TALK.h / TALK.w;
  const frame = new THREE.Matrix4();
  // the MOP along the card's foot: the placeholder until the server's prices arrive, then each one's own
  const MOP_H = 32, talkMop = [];
  const paintMop = (x, y, text) => {
    g.fillStyle = "#FDEBDC"; g.fillRect(x, y + TALK.h - MOP_H, TALK.w, MOP_H);
    g.fillStyle = "#1F1F21"; g.font = `600 13.5px ${FONT}`; g.textAlign = "left"; g.textBaseline = "alphabetic";
    g.fillText(text, x + 14, y + TALK.h - 11, TALK.w - 28);
  };
  pricesReady.then((prices) => {
    if (!prices.size) return;
    for (const t of talkMop) paintMop(t.x, t.y, mopText(mopOf(prices, t.p)));
    tex.needsUpdate = true; redraw();
  });
  L.places.forEach((pl, i) => {
    if (pl.p.placement === "wall") return;
    // room beside it, towards the entrance, on its own side's partition or wall
    const list = L.places.filter((q) => q.aisle === pl.aisle && q.side === pl.side && q.p.placement !== "wall").sort((a, b) => b.pos[2] - a.pos[2]);
    const k = list.indexOf(pl), s = sizeOf(pl.p), prev = list[k - 1];
    // (the first one's side towards the entrance has the aisle's lit panel)
    if (!prev) return;
    const edge = pl.pos[2] + s.w / 2 + 0.05, room = (prev.pos[2] - sizeOf(prev.p).w / 2 - 0.05) - edge;
    if (room < CW + 0.08) return;
    const x = (i % TALK.cols) * TALK.w, y = Math.floor(i / TALK.cols) * TALK.h;
    // the card
    g.fillStyle = "#FFFFFF"; g.fillRect(x, y, TALK.w, TALK.h);
    g.fillStyle = COPPER; g.fillRect(x, y, TALK.w, 8);
    g.textAlign = "left"; g.textBaseline = "alphabetic";
    g.fillStyle = COPPER_DK; g.font = `700 15px ${FONT}`; if (g.letterSpacing !== undefined) g.letterSpacing = "2px";
    g.fillText(pl.p.brand.toUpperCase(), x + 14, y + 36, TALK.w - 28);
    if (g.letterSpacing !== undefined) g.letterSpacing = "0px";
    g.fillStyle = "#1F1F21"; g.font = `600 19px ${FONT}`;
    let ty = y + 62;
    for (const line of wrapText(g, pl.p.shortName, TALK.w - 28).slice(0, 3)) { g.fillText(line, x + 14, ty); ty += 23; }
    g.fillStyle = "#E3DED6"; g.fillRect(x + 14, ty - 8, TALK.w - 28, 1.5);
    ty += 14;
    const specs = new Map(pl.p.specs || []);
    for (const key of (TALK_SPECS[pl.p.category] || []).filter((k) => specs.has(k)).slice(0, 2)) {
      g.font = `500 15px ${FONT}`;
      // two lines at most: past that, keep the clause before the first comma rather than cut a phrase
      let lines = wrapText(g, String(specs.get(key)), TALK.w - 28);
      if (lines.length > 2) lines = wrapText(g, String(specs.get(key)).split(/,\s*/)[0], TALK.w - 28);
      if (lines.length > 2) { lines = lines.slice(0, 2); lines[1] = lines[1].replace(/\s*\S*$/, "") + "…"; }
      if (ty + 6 + lines.length * 18 > y + TALK.h - MOP_H - 6) break; // (the MOP strip has the bottom)
      g.fillStyle = "#8A8378"; g.font = `600 12px ${FONT}`; g.fillText(key.toUpperCase(), x + 14, ty);
      ty += 18;
      g.fillStyle = "#2A2A2D"; g.font = `500 15px ${FONT}`;
      for (const line of lines) { g.fillText(line, x + 14, ty); ty += 18; }
      ty += 8;
    }
    talkMop.push({ x, y, p: pl.p });
    paintMop(x, y, mopText(null));
    // on the partition, beside the product on the entrance side, at eye level
    const outer = pl.side === "L" ? pl.aisle === L.aisles[0] : pl.aisle === L.aisles.at(-1);
    const face = pl.side === "L" ? 1 : -1, px = pl.side === "L" ? pl.aisle.x0 + (outer ? 0 : PT / 2) : pl.aisle.x1 - (outer ? 0 : PT / 2);
    const z = edge + Math.min(room / 2, CW / 2 + 0.06);
    frame.identity();
    fixtureTag = "talker";
    put(mats.trim, new THREE.BoxGeometry(0.012, CH + 0.016, CW + 0.016), [px + face * 0.006, 1.42, z]);
    const geo = new THREE.PlaneGeometry(CW, CH), uv = geo.attributes.uv;
    for (let j = 0; j < uv.count; j++) uv.setXY(j, (x + (uv.getX(j) ? TALK.w : 0)) / TW, 1 - (y + (uv.getY(j) ? 0 : TALK.h)) / TH);
    put(mat, geo, [px + face * 0.0135, 1.42, z], [0, face * Math.PI / 2, 0]);
    fixtureTag = null;
  });
  tex.needsUpdate = true;
}

// ── lifestyle touches: a kitchen along the back wall on the fridges' side, a laundry corner on the washers' side,
// a living-room wall under the air conditioners, and plants at the entrance and the reception ──
const decor = [];  // footprints [x0, x1, z0, z1] you can't walk through
{
  const { W, D } = L, LW = Math.min(7, W * 0.4);
  const m = {
    white: new THREE.MeshStandardMaterial({ color: 0xeeebe5, roughness: 0.55 }),
    wood: new THREE.MeshStandardMaterial({ color: 0x9a7150, roughness: 0.6 }),
    stone: new THREE.MeshStandardMaterial({ color: 0xdcd6cc, roughness: 0.25 }),
    tile: new THREE.MeshStandardMaterial({ roughness: 0.4, map: canvasTexture(256, 256, (g) => {
      g.fillStyle = "#C9C3B8"; g.fillRect(0, 0, 256, 256);
      g.fillStyle = "#EFECE6"; for (let r = 0; r < 4; r++) for (let c = 0; c < 2; c++) g.fillRect(c * 128 + 2 + (r % 2) * 64, r * 64 + 2, 124, 60);
      g.fillRect(-62, 66, 124, 60); g.fillRect(-62, 194, 124, 60);
    }) }),
    leaf: new THREE.MeshStandardMaterial({ color: 0x3f6b3a, roughness: 0.6, side: THREE.DoubleSide }),
    leaf2: new THREE.MeshStandardMaterial({ color: 0x5d8a4a, roughness: 0.6, side: THREE.DoubleSide }),
    pot: new THREE.MeshStandardMaterial({ color: 0x2c2c2f, roughness: 0.5 }),
    towel: [0xd9cfc0, 0xb7c4c9, 0xe8e2d8].map((c) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.9 })),
  };
  m.tile.map.wrapS = m.tile.map.wrapT = THREE.RepeatWrapping;
  const box = (mat, w, h, d, x, y, z) => put(mat, new THREE.BoxGeometry(w, h, d), [x, y, z]);
  // more materials for the room sets: oak with a grain, veined stone, steel, black glass, fabrics, fruit
  const grain = (base, dark, light) => canvasTexture(256, 512, (g) => {
    g.fillStyle = base; g.fillRect(0, 0, 256, 512);
    for (let i = 0; i < 70; i++) {
      const x = rnd() * 256, w = 0.6 + rnd() * 2.2, amp = 2 + rnd() * 6, f = 0.004 + rnd() * 0.01, ph = rnd() * 9;
      g.strokeStyle = rnd() < 0.6 ? dark : light; g.globalAlpha = 0.12 + rnd() * 0.25; g.lineWidth = w;
      g.beginPath(); for (let y = 0; y <= 512; y += 8) g.lineTo(x + Math.sin(y * f + ph) * amp, y); g.stroke();
    }
    g.globalAlpha = 1;
  });
  Object.assign(m, {
    oak: new THREE.MeshStandardMaterial({ roughness: 0.55, map: grain("#B98D62", "#7A5434", "#D8B48A") }),
    gloss: new THREE.MeshStandardMaterial({ color: 0xf3f1ec, roughness: 0.18 }),
    vein: new THREE.MeshStandardMaterial({ roughness: 0.2, map: canvasTexture(512, 256, (g) => {
      g.fillStyle = "#ECE8E1"; g.fillRect(0, 0, 512, 256);
      for (let i = 0; i < 9; i++) {
        g.strokeStyle = `rgba(120,112,104,${0.12 + rnd() * 0.2})`; g.lineWidth = 0.6 + rnd() * 1.6;
        let x = rnd() * 512, y = rnd() * 256; g.beginPath(); g.moveTo(x, y);
        for (let k = 0; k < 6; k++) { x += 40 + rnd() * 60; y += (rnd() - 0.5) * 70; g.lineTo(x, y); }
        g.stroke();
      }
    }) }),
    steel: new THREE.MeshStandardMaterial({ color: 0xc9ccd0, roughness: 0.28, metalness: 0.85 }),
    steelDark: new THREE.MeshStandardMaterial({ color: 0x6d7175, roughness: 0.35, metalness: 0.8 }),
    black: new THREE.MeshStandardMaterial({ color: 0x141416, roughness: 0.12, metalness: 0.1 }),
    burner: new THREE.MeshStandardMaterial({ color: 0x55575b, roughness: 0.5 }),
    ceramic: new THREE.MeshStandardMaterial({ color: 0xf7f5f0, roughness: 0.3 }),
    board: new THREE.MeshStandardMaterial({ roughness: 0.6, map: grain("#C9A273", "#94693F", "#E3C59A") }),
    fruit: [0xe8862a, 0x9cbf3b, 0xc23b2e, 0xf0c53a].map((c) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.45 })),
    wicker: new THREE.MeshStandardMaterial({ roughness: 1, map: canvasTexture(128, 128, (g) => {
      g.fillStyle = "#A9814F"; g.fillRect(0, 0, 128, 128);
      for (let y = 0; y < 128; y += 8) for (let x = 0; x < 128; x += 16) { g.fillStyle = (x / 16 + y / 8) % 2 ? "#8C6A3F" : "#C49A63"; g.fillRect(x + ((y / 8) % 2) * 8, y, 14, 6); }
    }) }),
    sofa: new THREE.MeshStandardMaterial({ color: 0x77706a, roughness: 0.95 }),
    sofa2: new THREE.MeshStandardMaterial({ color: 0x8a837c, roughness: 0.95 }),
    cushion: [0xd9772b, 0xe9e1d3, 0x3f5d5c].map((c) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.95 })),
    shade: new THREE.MeshBasicMaterial({ color: 0xfff1d8, toneMapped: false }),
    rug: onTop(new THREE.MeshStandardMaterial({ roughness: 1, map: canvasTexture(512, 512, (g) => {
      g.fillStyle = "#CDBFA9"; g.fillRect(0, 0, 512, 512);
      g.strokeStyle = "#7E6450"; g.lineWidth = 18; g.strokeRect(24, 24, 464, 464);
      g.strokeStyle = "#E7DCCB"; g.lineWidth = 4; g.strokeRect(52, 52, 408, 408);
      g.fillStyle = "rgba(126,100,80,0.18)"; for (let y = 70; y < 442; y += 12) g.fillRect(70, y, 372, 3);
      for (let i = 0; i < 3000; i++) { g.fillStyle = `rgba(${rnd() < 0.5 ? "255,255,255" : "90,70,50"},0.06)`; g.fillRect(rnd() * 512, rnd() * 512, 2, 2); }
    }) }), 2),
    print: new THREE.MeshStandardMaterial({ roughness: 0.7, map: canvasTexture(512, 340, (g) => {
      g.fillStyle = "#EFE7DA"; g.fillRect(0, 0, 512, 340);
      g.fillStyle = "#F58A29"; g.beginPath(); g.arc(190, 190, 110, 0, Math.PI * 2); g.fill();
      g.fillStyle = "#28282B"; g.fillRect(250, 60, 150, 220);
      g.fillStyle = "#D9C2A0"; g.beginPath(); g.arc(330, 240, 80, Math.PI, 0); g.fill();
      g.strokeStyle = "#28282B"; g.lineWidth = 5; g.beginPath(); g.arc(120, 110, 60, 0.2, 2.6); g.stroke();
    }) }),
    towel2: [0xc8704a, 0x4f8a8b, 0xd6a83c, 0xf1ede6, 0x8fa58a].map((c) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.95 })),
    glow: onTop(new THREE.MeshBasicMaterial({ transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false, map: canvasTexture(8, 128, (g) => {
      const gr = g.createLinearGradient(0, 0, 0, 128); gr.addColorStop(0, "rgba(255,226,180,0.75)"); gr.addColorStop(0.35, "rgba(255,226,180,0.25)"); gr.addColorStop(1, "rgba(255,226,180,0)");
      g.fillStyle = gr; g.fillRect(0, 0, 8, 128);
    }) }), 2),
  });
  const cyl = (mat, rt, rb, h, x, y, z, seg = 20, rot = [0, 0, 0]) => put(mat, new THREE.CylinderGeometry(rt, rb, h, seg), [x, y, z], rot);
  const ball = (mat, r, x, y, z) => put(mat, new THREE.SphereGeometry(r, 14, 10), [x, y, z]);
  const boxR = (mat, w, h, d, pos, rot) => put(mat, new THREE.BoxGeometry(w, h, d), pos, rot);
  const TOP = 0.92; // worktops' height
  fixtureTag = "kitchen";
  // the kitchen: oak base cabinets with steel handles under a veined stone top, a sink and tap, a black glass hob,
  // a tiled splashback lit from under gloss-white wall cabinets, and a few things on the counter
  const k0 = -W / 2 + 0.4, k1 = Math.min(-LW / 2 - 0.5, k0 + 4.2), kw = k1 - k0, kx = (k0 + k1) / 2;
  // (the room sets stand against champagne: a panel on the greige wall, floor to the orange line)
  const backdrop = onTop(paint(stripTexture(2.77, 0, (g, w) => {
    g.fillStyle = PAL.champagne; g.fillRect(0, 0, w, 2.77);
    const ao = g.createLinearGradient(0, 0, 0, 0.6); ao.addColorStop(0, "rgba(70,58,44,0.12)"); ao.addColorStop(1, "rgba(70,58,44,0)");
    g.fillStyle = ao; g.fillRect(0, 0, w, 0.6);
  })), 1);
  L.paint.backdrop = backdrop; L.backdrops = [];
  const backdropAt = (x0, x1) => { L.backdrops.push([x0, x1]); put(backdrop, new THREE.PlaneGeometry(x1 - x0, 2.77), [(x0 + x1) / 2, 2.77 / 2, -D + 0.002]); };
  if (kw > 2) {
    backdropAt(k0 - 0.25, k1 + 0.25);
    const zb = -D + 0.3, front = -D + 0.59;
    box(mats.trim, kw - 0.04, 0.1, 0.52, kx, 0.05, zb);
    box(m.white, kw, 0.78, 0.58, kx, 0.49, zb);
    const nd = Math.round(kw / 0.6), dw = kw / nd;
    for (let i = 0; i < nd; i++) {
      const x = k0 + dw * (i + 0.5);
      box(m.oak, dw - 0.006, 0.74, 0.02, x, 0.49, front + 0.01);
      box(m.steel, 0.2, 0.012, 0.018, x, 0.8, front + 0.03);
    }
    box(m.vein, kw + 0.02, 0.04, 0.64, kx, TOP - 0.02, -D + 0.32);
    const st = new THREE.PlaneGeometry(kw, 0.62); const uv = st.attributes.uv; for (let j = 0; j < uv.count; j++) uv.setXY(j, uv.getX(j) * kw / 0.5, uv.getY(j) * 0.62 / 0.25);
    put(m.tile, st, [kx, 1.23, -D + 0.012]);
    put(m.glow, new THREE.PlaneGeometry(kw - 0.1, 0.55), [kx, 1.565 - 0.275, -D + 0.02]); // the under-cabinet light on the tiles
    box(m.gloss, kw, 0.7, 0.34, kx, 1.92, -D + 0.18);
    for (let i = 1; i < nd; i++) box(mats.trim, 0.006, 0.66, 0.005, k0 + dw * i, 1.92, -D + 0.352);
    for (let i = 0; i < nd; i++) box(m.steel, 0.012, 0.16, 0.016, k0 + dw * (i + 0.5) + (i % 2 ? -1 : 1) * (dw / 2 - 0.06), 1.66, -D + 0.36);
    box(mats.warm, kw - 0.1, 0.008, 0.02, kx, 1.565, -D + 0.3); // the warm LED line under the wall cabinets
    // the sink, its tap, the hob
    const sx = kx - kw * 0.22, hx = kx + kw * 0.24, zc = -D + 0.32;
    box(m.steel, 0.64, 0.006, 0.46, sx, TOP + 0.001, zc);
    box(m.steelDark, 0.54, 0.004, 0.36, sx, TOP + 0.0035, zc + 0.01);
    cyl(m.steel, 0.016, 0.02, 0.3, sx, TOP + 0.15, -D + 0.08);
    cyl(m.steel, 0.013, 0.013, 0.2, sx, TOP + 0.3, -D + 0.17, 12, [Math.PI / 2, 0, 0]);
    cyl(m.steel, 0.013, 0.013, 0.06, sx, TOP + 0.27, -D + 0.265, 12);
    box(m.black, 0.6, 0.008, 0.5, hx, TOP + 0.003, zc);
    for (const [dx, dz, r] of [[-0.15, -0.11, 0.08], [0.15, -0.11, 0.06], [-0.15, 0.11, 0.06], [0.15, 0.11, 0.09]]) {
      put(m.burner, new THREE.TorusGeometry(r, 0.004, 4, 32), [hx + dx, TOP + 0.0075, zc + dz], [Math.PI / 2, 0, 0]);
    }
    // a kettle by the hob, a bowl of fruit, a chopping board against the tiles, three canisters
    const kx2 = hx + 0.48;
    cyl(m.steel, 0.075, 0.095, 0.2, kx2, TOP + 0.1, zc + 0.05, 24);
    ball(m.black, 0.018, kx2, TOP + 0.21, zc + 0.05);
    put(m.black, new THREE.TorusGeometry(0.07, 0.01, 6, 16, Math.PI), [kx2, TOP + 0.2, zc + 0.05], [0, Math.PI / 2, 0]);
    cyl(m.steel, 0.012, 0.02, 0.12, kx2 + 0.1, TOP + 0.09, zc + 0.05, 8, [0, 0, -0.9]);
    const bx = (sx + hx) / 2, bz = -D + 0.38;
    cyl(m.ceramic, 0.16, 0.09, 0.09, bx, TOP + 0.045, bz, 28);
    [[0, 0, 0], [0.06, 0.03, 1], [-0.06, 0.02, 2], [0.02, -0.06, 3], [-0.04, -0.05, 0], [0.05, -0.04, 2]].forEach(([dx, dz, f], i) => ball(m.fruit[f], 0.042, bx + dx, TOP + 0.1 + (i ? 0 : 0.035), bz + dz));
    boxR(m.board, 0.42, 0.3, 0.02, [bx - 0.05, TOP + 0.15, -D + 0.05], [-0.16, 0, 0]);
    [0.22, 0.18, 0.14].forEach((h, i) => {
      const x = k0 + 0.22 + i * 0.13;
      cyl(m.ceramic, 0.05, 0.05, h, x, TOP + h / 2, -D + 0.14, 20);
      cyl(m.oak, 0.052, 0.052, 0.03, x, TOP + h + 0.015, -D + 0.14, 20);
    });
    decor.push([k0, k1, -D, -D + 0.65]);
  }
  fixtureTag = "laundry";
  // the laundry corner: a tall cabinet, a worktop over a washer bay and a dryer bay, baskets, shelves of
  // folded towels in colour and a rail of hanging ones
  const l1 = W / 2 - 0.4, l0 = Math.max(LW / 2 + 0.5, l1 - 3.4), lx = (l0 + l1) / 2;
  if (l1 - l0 > 2) {
    backdropAt(l0 - 0.25, l1 + 0.25);
    box(m.gloss, 0.6, 2.2, 0.6, l1 - 0.3, 1.1, -D + 0.31);
    box(m.steel, 0.012, 0.3, 0.016, l1 - 0.56, 1.1, -D + 0.62);
    box(m.vein, l1 - l0 - 0.6, 0.04, 0.62, lx - 0.3, TOP, -D + 0.31);
    box(m.white, 0.04, 0.9, 0.58, l0 + 0.02, 0.45, -D + 0.3);
    const bay0 = l0 + 0.04, bay1 = l1 - 0.6, dr = Math.min(0.5, (bay1 - bay0) * 0.25), mid = bay0 + dr + (bay1 - bay0 - dr) / 2;
    box(m.pot, bay1 - bay0 - dr, 0.88, 0.01, (bay0 + dr + bay1) / 2, 0.46, -D + 0.012);
    box(m.white, 0.03, 0.88, 0.56, mid, 0.46, -D + 0.29);
    box(m.oak, dr, 0.86, 0.56, bay0 + dr / 2, 0.45, -D + 0.29);
    for (const y of [0.3, 0.6]) box(mats.trim, dr - 0.02, 0.006, 0.005, bay0 + dr / 2, y, -D + 0.572);
    for (const y of [0.45, 0.75]) box(m.steel, 0.16, 0.012, 0.016, bay0 + dr / 2, y, -D + 0.58);
    // a round basket with a towel in it in one bay, a square one in the other
    const b1 = (mid + bay1) / 2, b0 = (bay0 + dr + mid) / 2;
    cyl(m.wicker, 0.22, 0.19, 0.34, b1, 0.17, -D + 0.33, 24);
    boxR(m.towel2[0], 0.3, 0.08, 0.22, [b1, 0.35, -D + 0.33], [0.1, 0.4, 0.15]);
    box(m.wicker, 0.46, 0.3, 0.36, b0, 0.15, -D + 0.33);
    boxR(m.towel2[1], 0.34, 0.06, 0.24, [b0, 0.31, -D + 0.33], [0, -0.2, 0.08]);
    // shelves of folded towels, two to a stack
    for (const [s, y] of [[0, 1.5], [1, 1.88]]) {
      box(m.oak, l1 - l0 - 0.7, 0.03, 0.28, lx - 0.3, y, -D + 0.14);
      box(mats.warm, l1 - l0 - 0.8, 0.006, 0.012, lx - 0.3, y - 0.018, -D + 0.25); // a warm LED line under the shelf
      put(m.glow, new THREE.PlaneGeometry(l1 - l0 - 0.8, 0.4), [lx - 0.3, y - 0.2, -D + 0.006]);
      let x = l0 + 0.15;
      for (let n = 0; x < l1 - 0.95; n++) {
        const tw = 0.3;
        for (let k = 0; k < 2; k++) box(m.towel2[(n * 2 + k + s * 3) % 5], tw - k * 0.01, 0.055, 0.24 - k * 0.01, x + tw / 2, y + 0.015 + 0.0275 + k * 0.055, -D + 0.14);
        x += tw + 0.12;
      }
    }
    // a steel rail under the shelves with towels hung over it
    const r0 = l0 + 0.15, r1 = l1 - 0.75;
    cyl(m.steel, 0.01, 0.01, r1 - r0, (r0 + r1) / 2, 1.36, -D + 0.33, 10, [0, 0, Math.PI / 2]);
    for (const x of [r0, r1]) box(m.steel, 0.012, 0.012, 0.33, x, 1.36, -D + 0.165);
    [0, 2, 4].forEach((c, i) => { const x = r0 + (r1 - r0) * (0.2 + i * 0.3); box(m.towel2[c], 0.36, 0.32, 0.012, x, 1.36 - 0.16, -D + 0.33); });
    decor.push([l0, l1, -D, -D + 0.65]);
  }
  fixtureTag = "living room";
  // Under the air conditioners, a living room on every wall that carries them, as in the client's reference: each
  // unit at its mounting height on the greige wall, an ice-blue band above the run, framed botanical line prints
  // between the units, and below them a light linen sofa with cushions, a rug, a side table with a cream-shaded lamp
  // and a plant (on the right-hand wall), or a low oak sideboard with a lamp and a vase (facing it). All of it stays
  // under the units' name plates.
  Object.assign(m, {
    linen: new THREE.MeshStandardMaterial({ color: 0xcfc4b3, roughness: 0.96 }),
    lightOak: new THREE.MeshStandardMaterial({ color: 0xd8bf99, roughness: 0.6 }),
    linen2: new THREE.MeshStandardMaterial({ color: 0xdcd3c5, roughness: 0.96 }),
    cushion: [0xf3efe7, 0xb6aa98, new THREE.Color(PAL.ice).getHex(), 0xefe9df].map((c) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.97 })),
    shade: new THREE.MeshBasicMaterial({ color: 0xfbefd9, toneMapped: false }),
    urn: new THREE.MeshStandardMaterial({ color: 0xf6f4ef, roughness: 0.25 }),
    ice: onTop(paint(null, new THREE.Color(PAL.ice)), 1),
    lampGlow: onTop(new THREE.MeshBasicMaterial({ transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false, dithering: true, map: canvasTexture(128, 128, (g) => {
      const gr = g.createRadialGradient(64, 64, 4, 64, 64, 64); gr.addColorStop(0, "rgba(255,214,160,0.55)"); gr.addColorStop(0.5, "rgba(255,214,160,0.16)"); gr.addColorStop(1, "rgba(255,214,160,0)");
      g.fillStyle = gr; g.fillRect(0, 0, 128, 128);
    }) }), 2),
    rug: onTop(new THREE.MeshStandardMaterial({ roughness: 1, map: canvasTexture(512, 512, (g) => {
      g.fillStyle = "#E4DCCD"; g.fillRect(0, 0, 512, 512);
      g.strokeStyle = "#C9BBA5"; g.lineWidth = 10; g.strokeRect(22, 22, 468, 468);
      for (let i = 0; i < 4000; i++) { g.fillStyle = `rgba(${rnd() < 0.5 ? "255,255,255" : "120,100,80"},0.07)`; g.fillRect(rnd() * 512, rnd() * 512, 2, 2); }
    }) }), 2),
  });
  // three botanical line prints on cream, a cell each in one texture
  m.prints = new THREE.MeshStandardMaterial({ roughness: 0.8, map: canvasTexture(768, 512, (g) => {
    for (let c = 0; c < 3; c++) {
      const x0 = c * 256;
      g.fillStyle = "#EFE9DE"; g.fillRect(x0, 0, 256, 512);
      g.fillStyle = "#F7F3EC"; g.fillRect(x0 + 34, 40, 188, 432);
      g.strokeStyle = "#6F6A60"; g.lineWidth = 2.2; g.lineCap = "round";
      const cx = x0 + 128, bend = (c - 1) * 18;
      g.beginPath(); g.moveTo(cx, 430); g.quadraticCurveTo(cx + bend, 260, cx - bend * 0.5, 110); g.stroke();
      for (let k = 0; k < 7; k++) {
        const t = 0.15 + k * 0.11, y = 430 - t * 320, x = cx + bend * Math.sin(t * 3) * 0.6, sd = k % 2 ? 1 : -1, len = 46 - k * 3;
        g.beginPath(); g.moveTo(x, y);
        g.quadraticCurveTo(x + sd * len * 0.7, y - 16, x + sd * len, y - 34);
        g.quadraticCurveTo(x + sd * len * 0.35, y - 26, x, y); g.stroke();
      }
    }
  }) });
  const prints = (cell, w, h) => { const g = new THREE.PlaneGeometry(w, h), uv = g.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setX(i, (cell + uv.getX(i)) / 3); return g; };
  let printN = 0;
  L.paint.ice = m.ice; L.iceBands = [];
  for (const a of L.aisles) {
    const sides = ["L", "R"].map((side) => ({ side, units: L.places.filter((pl) => pl.aisle === a && pl.side === side && pl.p.placement === "wall").sort((p, q) => q.pos[2] - p.pos[2]) })).filter((x) => x.units.length);
    const sofaSide = sides.some((x) => x.side === "R") ? "R" : sides[0]?.side;
    for (const { side, units } of sides) {
      const ai = L.aisles.indexOf(a), face = side === "L" ? 1 : -1;
      const outer = side === "L" ? ai === 0 : ai === L.aisles.length - 1;
      const px = side === "L" ? a.x0 + (outer ? 0 : PT / 2) : a.x1 - (outer ? 0 : PT / 2), X = (d) => px + face * d, ry = face * Math.PI / 2;
      const half = (pl) => sizeOf(pl.p).w / 2;
      const zA = units[0].pos[2] + half(units[0]), zB = units.at(-1).pos[2] - half(units.at(-1)), zc = (zA + zB) / 2, run = zA - zB;
      const plates = Math.min(...units.map((pl) => pl.pos[1])) - 0.2; // the bottom of the lowest name plate
      // the ice-blue band over the run, between the units' tops and the wall's top line
      const unitTop = Math.max(...units.map((pl) => pl.pos[1] + sizeOf(pl.p).h)), lineY = outer ? FASCIA - 0.03 : L.partH[side === "L" ? ai - 1 : ai] - 0.18;
      const b0 = unitTop + 0.05, b1 = Math.min(lineY - 0.02, b0 + 0.3);
      if (b1 - b0 > 0.08) { put(m.ice, new THREE.PlaneGeometry(run + 0.8, b1 - b0), [X(0.002), (b0 + b1) / 2, zc], [0, ry, 0]); L.iceBands.push({ x: X(0.002), y: (b0 + b1) / 2, z0: zc - run / 2 - 0.4, z1: zc + run / 2 + 0.4, face }); }
      // a large botanical print (about 60 x 75 cm, light oak frame, cream mat) over the furniture, under the units'
      // name plates; moved along the wall, or left out, where a plate or talker is in the way
      const framed = (zc0, y0) => {
        const FH = Math.min(0.75, plates - 0.12 - y0), FW = FH * 0.8;
        if (FH < 0.4) return;
        for (const dz of [0, 0.1, -0.1, 0.2, -0.2, 0.3, -0.3, 0.4, -0.4]) {
          const z = zc0 + dz, b = { min: [Math.min(px, X(0.04)), y0, z - FW / 2 - 0.04], max: [Math.max(px, X(0.04)), y0 + FH + 0.08, z + FW / 2 + 0.04] };
          if (fixtures.some((f) => f.tag !== "living room" && f.box.min.x < b.max[0] && b.min[0] < f.box.max.x && f.box.min.y < b.max[1] && b.min[1] < f.box.max.y && f.box.min.z < b.max[2] && b.min[2] < f.box.max.z)) continue;
          const y = y0 + 0.04 + FH / 2;
          box(m.lightOak, 0.03, FH + 0.07, FW + 0.07, X(0.015), y, z);
          put(m.prints, prints(printN++ % 3, FW, FH), [X(0.031), y, z], [0, ry, 0]);
          return;
        }
      };
      if (side === sofaSide) {
        // the sofa: light linen, low arms, two seat cushions and four soft ones against the back
        const SL = clamp(run - 1.5, 1.2, 2.4), sz = zc;
        for (const t of SL >= 1.9 ? [-0.25, 0.25] : [-0.2]) framed(sz + t * SL, 0.92);
        box(m.linen, 0.88, 0.3, SL, X(0.5), 0.25, sz);
        box(mats.trim, 0.8, 0.08, SL - 0.1, X(0.5), 0.04, sz);
        box(m.linen, 0.2, 0.46, SL, X(0.16), 0.62, sz);
        for (const k of [-1, 1]) box(m.linen, 0.88, 0.22, 0.15, X(0.5), 0.51, sz + k * (SL / 2 - 0.075));
        for (const k of [-1, 1]) box(m.linen2, 0.64, 0.12, SL / 2 - 0.16, X(0.58), 0.46, sz + k * (SL / 4 - 0.04));
        [[-0.66, 0, 0.1], [-0.36, 1, -0.06], [0.34, 2, 0.08], [0.64, 3, -0.1]].forEach(([t, c, r]) =>
          boxR(m.cushion[c], 0.13, 0.34, 0.34, [X(0.34), 0.66, sz + t * (SL / 2 - 0.2)], [r, 0, -face * 0.22]));
        put(m.rug, flat(1.5, SL + 0.5), [X(1.15), 0.003, sz]);
        decor.push([Math.min(px, X(0.95)), Math.max(px, X(0.95)), sz - SL / 2 - 0.02, sz + SL / 2 + 0.02]);
        // the side table and lamp past the far arm, a plant past the near one, where the run has room
        const tz = sz - SL / 2 - 0.32;
        if (tz - 0.26 > zB - 0.35) {
          cyl(m.oak, 0.24, 0.24, 0.03, X(0.34), 0.56, tz, 28);
          cyl(mats.trim, 0.018, 0.018, 0.54, X(0.34), 0.27, tz, 8);
          cyl(mats.trim, 0.16, 0.16, 0.012, X(0.34), 0.006, tz, 20);
          put(m.urn, new THREE.SphereGeometry(0.09, 20, 14).scale(1, 1.35, 1), [X(0.34), 0.575 + 0.12, tz]);
          cyl(m.urn, 0.03, 0.05, 0.05, X(0.34), 0.6, tz, 16);
          cyl(mats.trim, 0.007, 0.007, 0.12, X(0.34), 0.86, tz, 6);
          cyl(m.shade, 0.13, 0.17, 0.24, X(0.34), 1.0, tz, 28);
          put(m.lampGlow, new THREE.PlaneGeometry(1.1, 1.1), [X(0.006), 1.02, tz], [0, ry, 0]);
          decor.push([Math.min(px, X(0.6)), Math.max(px, X(0.6)), tz - 0.26, tz + 0.26]);
        }
        const pz = sz + SL / 2 + 0.34;
        if (pz + 0.26 < zA + 0.35) {
          cyl(m.urn, 0.17, 0.13, 0.36, X(0.3), 0.18, pz, 20);
          for (let n = 0; n < 9; n++) {
            const ang = (n / 9) * Math.PI * 2 + rnd(), lh = 0.55 + rnd() * 0.3, tilt = 0.15 + rnd() * 0.3;
            const leaf = new THREE.ConeGeometry(0.045, lh, 3).scale(1, 1, 0.25);
            leaf.translate(0, lh / 2, 0);
            leaf.applyMatrix4(new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(tilt, ang, 0, "YXZ")));
            put(n % 2 ? m.leaf : m.leaf2, leaf, [X(0.3) + Math.sin(ang) * 0.04, 0.34, pz + Math.cos(ang) * 0.04]);
          }
          decor.push([Math.min(px, X(0.56)), Math.max(px, X(0.56)), pz - 0.26, pz + 0.26]);
        }
      } else {
        // a low oak sideboard on a charcoal plinth, a lamp at one end, a vase and books at the other
        const SB = clamp(run - 1.2, 1.0, 1.8), sz = zc;
        framed(sz + SB / 4, 0.95);
        box(mats.trim, 0.38, 0.08, SB - 0.06, X(0.22), 0.04, sz);
        box(m.oak, 0.42, 0.56, SB, X(0.23), 0.36, sz);
        for (let k = 1; k < 3; k++) box(mats.trim, 0.004, 0.5, 0.004, X(0.442), 0.36, sz - SB / 2 + (SB * k) / 3);
        const lz = sz - SB / 2 + 0.22;
        put(m.urn, new THREE.SphereGeometry(0.08, 20, 14).scale(1, 1.3, 1), [X(0.23), 0.64 + 0.1, lz]);
        cyl(mats.trim, 0.007, 0.007, 0.1, X(0.23), 0.88, lz, 6);
        cyl(m.shade, 0.12, 0.155, 0.22, X(0.23), 1.0, lz, 28);
        put(m.lampGlow, new THREE.PlaneGeometry(1.0, 1.0), [X(0.006), 1.02, lz], [0, ry, 0]);
        const vz = sz + SB / 2 - 0.25;
        cyl(m.ceramic, 0.06, 0.08, 0.26, X(0.25), 0.64 + 0.13, vz, 20);
        box(m.cushion[1], 0.2, 0.05, 0.26, X(0.24), 0.665, vz - 0.22);
        box(m.cushion[2], 0.18, 0.04, 0.24, X(0.24), 0.71, vz - 0.22);
        decor.push([Math.min(px, X(0.5)), Math.max(px, X(0.5)), sz - SB / 2 - 0.02, sz + SB / 2 + 0.02]);
      }
    }
  }
  fixtureTag = "shop front";
  // the shop front, seen from inside: glass between slim charcoal mullions, an open door across each walkway
  // with its sliding leaves parked behind the fixed glass, and a lit header with the orange line. Every face looks
  // into the hall only, so from the entrance, the step in and the view from above it isn't there (the dollhouse).
  {
    const ZF = 0.03, HT = 2.55, inward = [0, Math.PI, 0];
    const glass = new THREE.MeshStandardMaterial({ color: 0x8fb3b8, roughness: 0.05, metalness: 0.4, transparent: true, opacity: 0.3, depthWrite: false });
    glass.userData.order = 2;
    const pane = (x0, x1, z, y0 = 0.06, y1 = HT) => put(glass, new THREE.PlaneGeometry(x1 - x0, y1 - y0), [(x0 + x1) / 2, (y0 + y1) / 2, z], inward);
    const mull = (x, w = 0.06, y0 = 0, y1 = HT) => put(mats.trim, new THREE.PlaneGeometry(w, y1 - y0), [x, (y0 + y1) / 2, ZF - 0.008], inward);
    const bandTex = canvasTexture(256, 32, (g) => {
      g.fillStyle = "rgba(255,255,255,0.55)"; g.fillRect(0, 0, 256, 32);
      g.fillStyle = "#F58A29"; for (let x = 8; x < 256; x += 16) { g.beginPath(); g.arc(x, 16, 4, 0, Math.PI * 2); g.fill(); }
    });
    bandTex.wrapS = THREE.RepeatWrapping;
    const band = new THREE.MeshBasicMaterial({ map: bandTex, transparent: true, depthWrite: false, toneMapped: false });
    band.userData.order = 3;
    const header = canvasTexture(4, 256, (g) => {
      g.fillStyle = CHARCOAL; g.fillRect(0, 0, 4, 256);
      g.fillStyle = "#F58A29"; g.fillRect(0, 248, 4, 8);
    });
    put(new THREE.MeshStandardMaterial({ map: header, roughness: 0.6 }), new THREE.PlaneGeometry(W + 2 * SINK, WALL_H - HT + SINK), [0, (HT + WALL_H + SINK) / 2, ZF], inward);
    // the header's underside (faces down), with a light strip along it
    put(new THREE.MeshBasicMaterial({ color: 0x2a2a2d }), new THREE.PlaneGeometry(W + 2 * SINK, 0.14), [0, HT, ZF - 0.07], [Math.PI / 2, 0, 0]);
    put(mats.light, new THREE.PlaneGeometry(W - 0.4, 0.035), [0, HT - 0.003, ZF - 0.08], [Math.PI / 2, 0, 0]);
    put(mats.trim, new THREE.PlaneGeometry(W + 2 * SINK, 0.06), [0, 0.03, ZF - 0.008], inward); // the sill
    // fixed glass beside each walkway (in front of the products' zones and the partitions), doors open across it
    const xs = [-W / 2];
    for (const a of L.aisles) xs.push(a.walk[0], a.walk[1]);
    xs.push(W / 2);
    for (let i = 0; i < xs.length; i += 2) {
      const x0 = xs[i], x1 = xs[i + 1];
      pane(x0, x1, ZF);
      const bg = new THREE.PlaneGeometry(x1 - x0 - 0.1, 0.12), buv = bg.attributes.uv;
      for (let j = 0; j < buv.count; j++) buv.setX(j, buv.getX(j) * (x1 - x0 - 0.1) / 0.5);
      put(band, bg, [(x0 + x1) / 2, 1.05, ZF - 0.003], inward);
      for (let k = 1, n = Math.max(1, Math.round((x1 - x0) / 1.4)); k < n; k++) mull(x0 + (x1 - x0) * k / n, 0.04);
      mull(x0 + (i ? 0.04 : 0.06), i ? 0.08 : 0.12); mull(x1 - (i < xs.length - 2 ? 0.04 : 0.06), i < xs.length - 2 ? 0.08 : 0.12);
    }
    // the doors' leaves, parked open: a glass leaf in a thin frame either side of each walkway, behind the fixed glass
    for (const a of L.aisles) {
      for (const [e, s] of [[a.walk[0], -1], [a.walk[1], 1]]) {
        const lw = Math.min(0.9, Math.abs(e - (s < 0 ? a.x0 : a.x1)) - 0.1), c = e + s * (lw / 2 + 0.02);
        pane(c - lw / 2, c + lw / 2, ZF + 0.06, 0.08, HT - 0.06);
        for (const dx of [-lw / 2, lw / 2]) put(mats.trim, new THREE.PlaneGeometry(0.03, HT - 0.1), [c + dx, HT / 2, ZF + 0.052], inward);
        for (const y of [0.09, HT - 0.07]) put(mats.trim, new THREE.PlaneGeometry(lw, 0.03), [c, y, ZF + 0.052], inward);
      }
    }
  }
  fixtureTag = "plant";
  // plants: a tall leafy one in a dark pot, standing where there is room
  const plant = (x, z, h = 1.1) => {
    put(m.pot, new THREE.CylinderGeometry(0.2, 0.16, 0.42, 20), [x, 0.21, z]);
    for (let n = 0; n < 11; n++) {
      const a = (n / 11) * Math.PI * 2 + rnd(), lh = h * (0.55 + rnd() * 0.45), tilt = 0.12 + rnd() * 0.3;
      const leaf = new THREE.ConeGeometry(0.05, lh, 3).scale(1, 1, 0.25);
      leaf.translate(0, lh / 2, 0);
      leaf.applyMatrix4(new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(tilt, a, 0, "YXZ")));
      put(n % 2 ? m.leaf : m.leaf2, leaf, [x + Math.sin(a) * 0.05, 0.4, z + Math.cos(a) * 0.05]);
    }
    decor.push([x - 0.3, x + 0.3, z - 0.3, z + 0.3]);
  };
  const c = L.counter;
  plant(c.x[0] - 0.7, -D + 0.75); plant(c.x[1] + 0.7, -D + 0.75); // (far enough off the logo wall for the leaves)
  plant(-W / 2 + 0.45, 0.9, 1.2); plant(W / 2 - 0.45, 0.9, 1.2);
}

fixtureTag = null;
bakeAll();
plainFloor = hall.children.find((m) => m.material === mats.floor);
// the polished floor shows only from inside the hall, under the ceiling (the view from above keeps the plain floor)
function pickFloor(cam) {
  if (!polished) return;
  const c = cam.position, inside = !xr && c.y < WALL_H - 0.2 && c.z < APRON && c.z > -L.D && Math.abs(c.x) < L.W / 2;
  polished.visible = inside; plainFloor.visible = !inside;
}

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
    if (s.again) { s.again = false; reload(s); }
    if (selected === s) renderCard();
    planSoon();
  }
}
// A product's model again: in another colour, filled or emptied, or after it failed. (One already on its way is
// loaded again as soon as it lands.)
function reload(s) {
  s.failed = false;
  if (s.loading) { s.again = true; return; }
  unload(s);
  load(s);
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
  // its colour: the first, as the product page opens it, or the one picked on its card (KHR_materials_variants, as xr.js)
  const variants = gltf.userData.gltfExtensions?.KHR_materials_variants?.variants?.map((v) => v.name) || [];
  const vi = variants.indexOf(s.p.finishes[s.finish || 0]?.variant);
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
  s.hasStock = stock.length > 0;
  const dropped = new THREE.Group();
  if (!s.filled) for (const o of stock) if (!stock.includes(o.parent)) dropped.add(o);
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
  : "<b>Drag</b> to look around · <b>arrow keys</b> to walk · <b>/</b> to search · <b>click</b> a product to walk up to it, then a door to open it"}</span>`;
let hintTimer = 0;
const hintGone = () => { clearTimeout(hintTimer); hintTimer = setTimeout(() => $("hint").classList.add("gone"), 400); };

// chips in the hall's order: aisle by aisle, front to back
const order = [...slots].sort((a, b) => L.aisles.indexOf(a.aisle) - L.aisles.indexOf(b.aisle) || b.home.pos[2] - a.home.pos[2] || a.home.pos[0] - b.home.pos[0]);
const cats = [[null, "All"], ...[...new Set(L.aisles.map((a) => a.cat))].map((c) => [c, L.aisles.find((a) => a.cat === c).title])];
let catFilter = null;
$("cats").innerHTML = cats.map(([c, label]) => `<button class="cat" type="button" data-cat="${esc(c ?? "")}" aria-pressed="${c === null}">${esc(label)}<span class="n">${slots.filter((s) => !c || s.p.category === c).length}</span></button>`).join("");
$("chips").innerHTML = order.map((s) => `<button class="chip" type="button" data-id="${esc(s.p.id)}" aria-pressed="false"><img src="${esc(s.p.thumb)}" alt="" loading="lazy" width="40" height="40"><span><b>${esc(s.p.brand)}</b><span class="nm">${esc(s.p.shortName)}</span><i class="mop">${esc(mopText(null))}</i></span></button>`).join("");
pricesReady.then((m) => { if (m.size) $("chips").querySelectorAll(".chip").forEach((b) => { b.querySelector(".mop").textContent = mopText(mopOf(m, byId.get(b.dataset.id).p)); }); });
$("cats").querySelectorAll(".cat").forEach((b) => b.addEventListener("click", () => {
  setFilter(b.dataset.cat || null);
  if (catFilter) flyToAisle(L.aisles.find((a) => a.cat === catFilter)); else flyHome();
}));
function setFilter(c) {
  catFilter = c;
  $("cats").querySelectorAll(".cat").forEach((b) => b.setAttribute("aria-pressed", String((b.dataset.cat || null) === c)));
  $("chips").querySelectorAll(".chip").forEach((b) => b.classList.toggle("hide", !!c && byId.get(b.dataset.id).p.category !== c));
  $("chips").scrollLeft = 0;
  if (!$("filters").classList.contains("hide")) renderFilters();
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
const FIXED = ["hint", "tools", "pcard", "dock", "minimap", "tourbar", "filters", "results", "progress"];
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
  const inside = c.z < 1.2 && c.z > -L.D && Math.abs(c.x) < L.W / 2 && c.y < PART_H - 0.1;
  const mine = inside ? L.aisles.find((a) => c.x >= a.x0 && c.x <= a.x1) : null;
  const near = [];
  for (const s of slots) {
    s.labelAt ??= new THREE.Vector3();
    s.labelAt.set(0, s.size.h + 0.14, s.wall ? s.size.d / 2 : 0);
    s.group.localToWorld(s.labelAt);
    const d = s.labelAt.distanceTo(c);
    if (d > LABEL_RANGE || (inside && s.aisle !== mine) || !s.group.visible) continue;
    if (selected) continue; // a product open: its card names it, and tags would only crowd the top of the view
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
  if (filterCount()) applyFilters();
  mmDirty = true;
  if (!s) return;
  if (catFilter && s.p.category !== catFilter) setFilter(null);
  const chip = $("chips").querySelector(`.chip[data-id="${CSS.escape(s.p.id)}"]`);
  if (chip) $("chips").scrollTo({ left: chip.offsetLeft - ($("chips").clientWidth - chip.offsetWidth) / 2, behavior: reduceMotion ? "auto" : "smooth" });
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
  const fi = s.finish || 0, fins = p.finishes || [];
  $("pcMop").textContent = mopText(mopOf(prices, p, fi));
  // its colours: the one picked is shown in place (its model loads again in that colour)
  $("pcSwatches").classList.toggle("hide", fins.length < 2);
  $("pcSwatches").innerHTML = fins.length < 2 ? "" : fins.map((f, i) => `<button type="button" data-i="${i}" aria-pressed="${i === fi}" aria-label="${esc(f.name)}" title="${esc(f.name)}" style="background:${esc(f.swatchColor || "#ddd")}"></button>`).join("") + `<span>${esc(fins[fi]?.name || "")}</span>`;
  $("pcSwatches").querySelectorAll("button").forEach((b) => b.addEventListener("click", () => chooseFinish(s, +b.dataset.i)));
  // the product page for this colour: its "View in your room" is the AR every phone and headset knows
  $("pcLink").href = finishPath(p, fi);
  $("pcParts").innerHTML = (p.parts || []).map((x) => `<button type="button" data-key="${esc(x.key)}" aria-pressed="${!!s.state[x.key]}" ${s.model ? "" : "disabled"}>${esc(partText(x, !!s.state[x.key]))}</button>`).join("")
    + (s.hasStock ? `<button type="button" data-fill="1" aria-pressed="${!!s.filled}" ${s.model && !s.loading ? "" : "disabled"}>${s.filled ? "Empty the fridge" : "Fill the fridge"}</button>` : "");
  $("pcParts").querySelectorAll("button[data-key]").forEach((b) => b.addEventListener("click", () => pressPart(s, b.dataset.key)));
  $("pcParts").querySelector("button[data-fill]")?.addEventListener("click", () => { s.filled = !s.filled; reload(s); renderCard(); });
  $("pcRetry").classList.toggle("hide", !s.failed);
  const other = compareWith && compareWith !== s && byId.get(compareWith.p.id) ? compareWith : null;
  $("pcCompare").querySelector("span").textContent = other ? `Compare with ${other.p.brand} ${other.p.shortName}` : compareWith === s ? "Picked to compare · pick another" : "Compare";
  $("pcCompare").setAttribute("aria-pressed", String(compareWith === s));
}
// a colour picked on the card
function chooseFinish(s, i) {
  if ((s.finish || 0) === i) return;
  s.finish = i;
  reload(s);
  renderCard();
}
$("pcRetry").addEventListener("click", () => { if (selected) { reload(selected); renderCard(); } });
// Compare: the first product picked waits; on a second one's card the button opens the two side by side
let compareWith = null;
$("pcCompare").addEventListener("click", () => {
  const s = selected;
  if (!s) return;
  if (compareWith && compareWith !== s) {
    const u = new URL("/compare", location.origin);
    u.searchParams.set("a", compareWith.p.id); u.searchParams.set("b", s.p.id);
    if (compareWith.finish) u.searchParams.set("fa", finishSlug(compareWith.p.finishes[compareWith.finish].name));
    if (s.finish) u.searchParams.set("fb", finishSlug(s.p.finishes[s.finish].name));
    location.href = u.pathname + u.search;
    return;
  }
  compareWith = compareWith === s ? null : s;
  if (compareWith) toast("Now pick another product to compare it with");
  renderCard();
});
// Share this spot: a link that opens the showroom in front of this product
$("pcShare").addEventListener("click", async () => {
  const s = selected;
  if (!s) return;
  const url = `${location.origin}/showroom?focus=${encodeURIComponent(s.p.id)}`;
  try { await navigator.clipboard.writeText(url); toast("Link copied: it opens the showroom right here"); }
  catch { toast(url, 8000); }
});
$("pcClose").addEventListener("click", () => select(null));
pricesReady.then((m) => { if (m.size && selected) renderCard(); });

// ── search: brand, name, model or a colour's item code, as you type; a pick walks you to it, as its chip does ──
const searchIndex = slots.map((s) => {
  const p = s.p, codes = [p.model, ...(p.finishes || []).flatMap((f) => [f.itemCode, f.code])].filter(Boolean);
  const words = [p.brand, p.name, p.shortName, p.category, p.id, ...codes].join(" ").toLowerCase();
  return { s, codes: [...new Set(codes.map((c) => String(c).toLowerCase()))], words, flat: words.replace(/[^a-z0-9]/g, "") };
});
function findProducts(q) {
  const toks = q.toLowerCase().split(/\s+/).filter(Boolean);
  if (!toks.length) return [];
  const out = [];
  for (const it of searchIndex) {
    if (!toks.every((t) => it.words.includes(t) || it.flat.includes(t.replace(/[^a-z0-9]/g, "")))) continue;
    const q1 = toks.join("").replace(/[^a-z0-9]/g, ""), b = it.s.p.brand.toLowerCase();
    const code = it.codes.find((c) => c.replace(/[^a-z0-9]/g, "") === q1) || it.codes.find((c) => c.replace(/[^a-z0-9]/g, "").startsWith(q1));
    out.push({ it, code, score: (code ? (code.replace(/[^a-z0-9]/g, "") === q1 ? 0 : 1) : 2) + (b.startsWith(toks[0]) ? 0 : 0.5) });
  }
  return out.sort((a, b) => a.score - b.score || order.indexOf(a.it.s) - order.indexOf(b.it.s)).slice(0, 8);
}
{
  const q = $("q"), list = $("results");
  if (isPhone || matchMedia("(max-width: 900px)").matches) q.placeholder = "Search brand or model code";
  let found = [], active = -1;
  const mark = (text, toks) => {
    let html = esc(text);
    for (const t of toks) if (t.length > 1) html = html.replace(new RegExp(`(${t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")})`, "ig"), "<mark>$1</mark>");
    return html;
  };
  const close = () => { list.classList.add("hide"); q.setAttribute("aria-expanded", "false"); active = -1; };
  const show = () => {
    const v = q.value.trim();
    if (!v) { close(); return; }
    found = findProducts(v);
    const toks = v.split(/\s+/).filter(Boolean);
    list.innerHTML = found.length ? found.map(({ it, code }, i) => {
      const p = it.s.p, f = (p.finishes || []).find((x) => code && [x.itemCode, x.code].some((c) => c && String(c).toLowerCase() === code));
      return `<button class="res" type="button" role="option" id="res${i}" data-i="${i}" aria-selected="${i === active}"><img src="${esc(p.thumb)}" alt="" width="38" height="38"><span><b>${esc(p.brand)}</b>${mark(p.shortName, toks)}<small>Model ${mark(p.model, toks)}${f && f.itemCode && f.itemCode !== p.model ? ` · ${esc(f.name)} ${mark(f.itemCode, toks)}` : ""}</small></span></button>`;
    }).join("") : `<p>Nothing in the showroom matches “${esc(v)}”.</p>`;
    list.querySelectorAll(".res").forEach((b) => b.addEventListener("click", () => pickFound(+b.dataset.i)));
    list.classList.remove("hide"); q.setAttribute("aria-expanded", "true");
  };
  const setActive = (i) => {
    active = found.length ? (i + found.length) % found.length : -1;
    list.querySelectorAll(".res").forEach((b, k) => b.setAttribute("aria-selected", String(k === active)));
    if (active >= 0) { q.setAttribute("aria-activedescendant", `res${active}`); $(`res${active}`).scrollIntoView({ block: "nearest" }); }
  };
  function pickFound(i) {
    const hit = found[i];
    if (!hit) return;
    q.value = ""; close(); q.blur();
    select(hit.it.s, { fly: true });
  }
  q.addEventListener("input", () => { active = -1; show(); hintGone(); });
  q.addEventListener("focus", () => { if (q.value.trim()) show(); });
  q.addEventListener("keydown", (e) => {
    if (e.key === "ArrowDown") { e.preventDefault(); setActive(active + 1); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setActive(active - 1); }
    else if (e.key === "Enter") { e.preventDefault(); pickFound(active >= 0 ? active : 0); }
    else if (e.key === "Escape") { e.preventDefault(); if (q.value) { q.value = ""; close(); } else q.blur(); }
  });
  // "/" anywhere on the page goes to the search
  addEventListener("keydown", (e) => {
    if (e.key !== "/" || xr || e.metaKey || e.ctrlKey || e.altKey || e.target.closest?.("input, textarea, select, [contenteditable]")) return;
    e.preventDefault(); keys.clear(); q.focus();
  });
  // a click or tap anywhere else closes the list
  addEventListener("pointerdown", (e) => { if (!e.target.closest?.("#results, #search")) close(); });
  q.addEventListener("focus", () => keys.clear());
}

// ── filters: brand, capacity and star rating, from products.json's specs alone. The products that match stay lit,
// the rest dim behind a dark veil, and their chips step aside ──
const specOf = (p, re) => (p.specs || []).find(([k]) => re.test(k))?.[1];
const capOf = (p) => {
  const v = specOf(p, /^(total )?capacity$/i) ?? specOf(p, /capacity/i);
  const m = v && String(v).match(/([\d.]+)\s*(L|litres?|kg|tons?|tonnes?)\b/i);
  if (!m) return null;
  const u = m[2].toLowerCase().startsWith("l") ? "L" : m[2].toLowerCase().startsWith("k") ? "kg" : "ton";
  return { n: +m[1], u };
};
const starsOf = (p) => { const m = String(specOf(p, /^energy rating$/i) || "").match(/(\d)\s*star/i); return m ? +m[1] : null; };
const facts = new Map(slots.map((s) => [s, { brand: s.p.brand, cap: capOf(s.p), stars: starsOf(s.p) }]));
const filt = { brands: new Set(), cap: {}, stars: 0 }; // cap: unit -> [min, max]
const filterCount = () => filt.brands.size + Object.keys(filt.cap).length + (filt.stars ? 1 : 0);
function passes(s) {
  const f = facts.get(s);
  if (filt.brands.size && !filt.brands.has(f.brand)) return false;
  if (filt.stars && !(f.stars >= filt.stars)) return false;
  for (const [u, [a, b]] of Object.entries(filt.cap)) if (f.cap?.u === u && (f.cap.n < a || f.cap.n > b)) return false;
  for (const u of Object.keys(filt.cap)) if (!f.cap || f.cap.u !== u) { if (slots.some((t) => t.p.category === s.p.category && facts.get(t).cap?.u === u)) return false; }
  return true;
}
// the veil over a product that doesn't match: one instanced box for all of them
const veil = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshBasicMaterial({ color: 0x1c1c1f, transparent: true, opacity: 0.55, depthWrite: false }), slots.length);
veil.count = 0; veil.frustumCulled = false; veil.renderOrder = 3; veil.raycast = noRay;
world.add(veil);
function applyFilters() {
  const on = filterCount() > 0, m4 = new THREE.Matrix4(), local = new THREE.Matrix4();
  let n = 0;
  for (const s of slots) {
    s.dim = on && !passes(s) && s !== selected; // (the one you picked is never veiled)
    if (!s.dim) continue;
    local.compose(new THREE.Vector3(0, s.size.h / 2, s.wall ? s.size.d / 2 : 0), new THREE.Quaternion(), new THREE.Vector3(s.size.w + 0.06, s.size.h + 0.05, s.size.d + 0.06));
    veil.setMatrixAt(n++, m4.multiplyMatrices(s.group.matrixWorld, local));
  }
  veil.count = n; veil.instanceMatrix.needsUpdate = true;
  $("chips").querySelectorAll(".chip").forEach((b) => b.classList.toggle("dimmed", !!byId.get(b.dataset.id).dim));
  $("btnFilters").classList.toggle("on", on);
  $("btnFilters").querySelector(".lbl").innerHTML = on ? `Filters <span class="n">${filterCount()}</span>` : "Filters";
  mmDirty = true;
  redraw();
}
function renderFilters() {
  const scope = slots.filter((s) => !catFilter || s.p.category === catFilter);
  const brands = [...new Set(scope.map((s) => s.p.brand))].sort((a, b) => a.localeCompare(b));
  const units = [...new Set(scope.map((s) => facts.get(s).cap?.u).filter(Boolean))];
  const catOfUnit = (u) => [...new Set(scope.filter((s) => facts.get(s).cap?.u === u).map((s) => s.p.category))].join(", ");
  const stars = [...new Set(scope.map((s) => facts.get(s).stars).filter(Boolean))].sort();
  const n = slots.filter((s) => !filterCount() || passes(s)).length;
  $("filters").innerHTML = `
    <section><h3>Brand</h3><div class="fpills">${brands.map((b) => `<button type="button" data-brand="${esc(b)}" aria-pressed="${filt.brands.has(b)}">${esc(b)}</button>`).join("")}</div></section>
    ${units.map((u) => {
      const vals = [...new Set(scope.map((s) => facts.get(s).cap).filter((c) => c?.u === u).map((c) => c.n))].sort((a, b) => a - b);
      const [a, b] = filt.cap[u] || [vals[0], vals.at(-1)];
      const opts = (sel) => vals.map((v) => `<option value="${v}" ${v === sel ? "selected" : ""}>${v} ${u}</option>`).join("");
      return `<section><h3>Capacity · ${esc(catOfUnit(u))}</h3><div class="frange"><select data-unit="${u}" data-end="0" aria-label="Smallest capacity">${opts(a)}</select> to <select data-unit="${u}" data-end="1" aria-label="Largest capacity">${opts(b)}</select></div></section>`;
    }).join("")}
    ${stars.length ? `<section><h3>Energy rating</h3><div class="fpills"><button type="button" data-stars="0" aria-pressed="${!filt.stars}">Any</button>${stars.map((k) => `<button type="button" data-stars="${k}" aria-pressed="${filt.stars === k}">${k} star${k < 5 ? " and up" : ""}</button>`).join("")}</div></section>` : ""}
    <div class="ffoot"><span id="fCount"><b>${n}</b> of ${slots.length} match</span><button type="button" id="fClear" ${filterCount() ? "" : "disabled"}>Clear filters</button></div>`;
  $("filters").querySelectorAll("[data-brand]").forEach((b) => b.addEventListener("click", () => { const k = b.dataset.brand; filt.brands.has(k) ? filt.brands.delete(k) : filt.brands.add(k); changed(); }));
  $("filters").querySelectorAll("[data-stars]").forEach((b) => b.addEventListener("click", () => { filt.stars = +b.dataset.stars; changed(); }));
  $("filters").querySelectorAll("select").forEach((sel) => sel.addEventListener("change", () => {
    const u = sel.dataset.unit, ends = [...$("filters").querySelectorAll(`select[data-unit="${u}"]`)].map((x) => +x.value).sort((a, b) => a - b);
    const vals = [...sel.options].map((o) => +o.value);
    if (ends[0] === vals[0] && ends[1] === vals.at(-1)) delete filt.cap[u]; else filt.cap[u] = ends;
    changed();
  }));
  $("fClear").addEventListener("click", () => { filt.brands.clear(); filt.cap = {}; filt.stars = 0; changed(); });
  function changed() { applyFilters(); renderFilters(); }
}
{
  const panel = $("filters"), btn = $("btnFilters");
  const open = (on) => { panel.classList.toggle("hide", !on); btn.setAttribute("aria-expanded", String(on)); if (on) { renderFilters(); $("results").classList.add("hide"); } };
  btn.addEventListener("click", () => open(panel.classList.contains("hide")));
  addEventListener("pointerdown", (e) => { if (!e.target.closest?.("#filters, #btnFilters")) open(false); });
  addEventListener("keydown", (e) => { if (e.key === "Escape" && !panel.classList.contains("hide")) { open(false); btn.focus(); } });
}

// ── the floor plan: the aisles, the products, where you stand and which way you look; a tap walks you there ──
let mmDirty = true;
const mm = { el: $("minimap"), cv: $("mmCanvas"), x0: -L.W / 2 - 0.3, x1: L.W / 2 + 0.3, z0: -L.D - 0.3, z1: 1.2 };
{
  const small = isPhone || matchMedia("(max-width: 900px)").matches;
  const maxW = small ? 150 : 230, maxH = small ? 120 : 160, aw = mm.x1 - mm.x0, ad = mm.z1 - mm.z0;
  mm.k = Math.min(maxW / aw, maxH / ad);
  mm.w = Math.round(aw * mm.k); mm.h = Math.round(ad * mm.k);
  const dpr = Math.min(2, devicePixelRatio || 1);
  mm.cv.width = mm.w * dpr; mm.cv.height = mm.h * dpr; mm.cv.style.width = `${mm.w}px`; mm.cv.style.height = `${mm.h}px`;
  mm.g = mm.cv.getContext("2d"); mm.g.scale(dpr, dpr);
  const setOpen = (on) => {
    mm.el.classList.toggle("closed", !on);
    $("mmToggle").setAttribute("aria-expanded", String(on));
    $("mmToggle").setAttribute("aria-label", on ? "Hide the floor plan" : "Show the floor plan");
    $("mmToggle").querySelector("path").setAttribute("d", on ? "M6 15l6-6 6 6" : "M6 9l6 6 6-6");
    mmDirty = true;
  };
  setOpen(!small);
  // (opened, it covers the hint's corner on a phone: the hint has done its job by then)
  $("mmToggle").addEventListener("click", () => { const on = mm.el.classList.contains("closed"); setOpen(on); if (on) $("hint").classList.add("gone"); });
  mm.cv.addEventListener("pointerdown", (e) => {
    e.preventDefault(); e.stopPropagation();
    const r = mm.cv.getBoundingClientRect(), x = mm.x0 + (e.clientX - r.left) / mm.k, z = mm.z0 + (e.clientY - r.top) / mm.k;
    stopTour(true);
    select(null);
    walkTo(new THREE.Vector3(x, 0, z));
    hintGone();
  });
}
const mmX = (x) => (x - mm.x0) * mm.k, mmZ = (z) => (z - mm.z0) * mm.k;
function drawMinimap() {
  if (mm.el.classList.contains("closed") || xr) return;
  const g = mm.g;
  g.clearRect(0, 0, mm.w, mm.h);
  g.fillStyle = "#F3F0EB"; g.fillRect(mmX(-L.W / 2), mmZ(-L.D), L.W * mm.k, L.D * mm.k);
  g.strokeStyle = "#2A2A2D"; g.lineWidth = 1.5; g.strokeRect(mmX(-L.W / 2), mmZ(-L.D), L.W * mm.k, L.D * mm.k);
  // partitions
  g.strokeStyle = "#8C8C92"; g.lineWidth = 1.2;
  for (const a of L.aisles.slice(0, -1)) { g.beginPath(); g.moveTo(mmX(a.x1), mmZ(0)); g.lineTo(mmX(a.x1), mmZ(-L.LEN)); g.stroke(); }
  // products: lit or dimmed, the picked one in orange
  for (const s of slots) {
    const w = (s.wall ? 0.25 : s.size.d) * mm.k, h = s.size.w * mm.k;
    g.fillStyle = s === selected ? "#F58A29" : s.dim ? "#CFCCC6" : "#55565C";
    g.fillRect(mmX(s.center.x) - w / 2, mmZ(s.center.z) - h / 2, Math.max(1.5, w), Math.max(1.5, h));
  }
  // the counter
  const c = L.counter;
  g.fillStyle = "#2A2A2D"; g.fillRect(mmX(c.x[0]), mmZ(c.z[0]), (c.x[1] - c.x[0]) * mm.k, (c.z[1] - c.z[0]) * mm.k);
  // you
  const p = camera.position, t = controls.target, ang = Math.atan2(t.x - p.x, t.z - p.z);
  const px = clamp(mmX(p.x), 4, mm.w - 4), pz = clamp(mmZ(p.z), 4, mm.h - 4);
  g.fillStyle = "rgba(245,138,41,0.28)";
  g.beginPath(); g.moveTo(px, pz); g.arc(px, pz, 22, -ang + Math.PI / 2 - 0.55, -ang + Math.PI / 2 + 0.55); g.closePath(); g.fill();
  g.fillStyle = "#F58A29"; g.strokeStyle = "#fff"; g.lineWidth = 2;
  g.beginPath(); g.arc(px, pz, 4.5, 0, Math.PI * 2); g.fill(); g.stroke();
  mmDirty = false;
}

// ── the guided tour: aisle by aisle, the first product of each category with its card; ?kiosk starts it on its
// own after a minute with nobody at the screen (?idle=<seconds> to change that), and any touch stops it ──
const KIOSK = params.has("kiosk"), IDLE_S = clamp(+params.get("idle") || 60, 2, 3600), DWELL_MS = 7000;
const tourStops = [...new Set(L.aisles.map((a) => a.cat))].map((cat) => order.find((s) => s.p.category === cat)).filter(Boolean);
const tour = { on: false, playing: false, i: -1, timer: 0, kiosk: false };
function tourShow() {
  $("tourbar").classList.toggle("hide", !tour.on);
  if (!tour.on) return;
  const s = tourStops[tour.i];
  $("tourText").textContent = `Tour · ${tour.i + 1} of ${tourStops.length} · ${L.aisles.find((a) => a.cat === s.p.category).title}: ${s.p.brand} ${s.p.shortName}`;
  $("tourPlay").setAttribute("aria-label", tour.playing ? "Pause the tour" : "Play the tour");
  $("tourPlay").innerHTML = tour.playing ? '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M7 5h3v14H7zM14 5h3v14h-3z"/></svg>' : '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>';
}
function tourGo(i) {
  clearTimeout(tour.timer);
  if (i >= tourStops.length) { if (tour.kiosk) i = 0; else { stopTour(); return; } }
  tour.i = i;
  setFilter(null);
  select(tourStops[i], { fly: true });
  tourShow();
  if (tour.playing) tourWait();
}
// the next stop once it has arrived and you've had time to look
function tourWait() {
  clearTimeout(tour.timer);
  const t0 = performance.now();
  const tick = () => { if (!tour.playing) return; if (flight && performance.now() - t0 < 20000) { tour.timer = setTimeout(tick, 250); return; } tour.timer = setTimeout(() => tour.playing && tourGo(tour.i + 1), DWELL_MS); };
  tour.timer = setTimeout(tick, 250);
}
function startTour(kiosk = false) {
  if (xr || !tourStops.length) return;
  Object.assign(tour, { on: true, playing: true, kiosk });
  tourGo(0);
}
function stopTour(byUser = false) {
  if (!tour.on) return;
  clearTimeout(tour.timer);
  Object.assign(tour, { on: false, playing: false, i: -1 });
  tourShow();
  if (byUser && KIOSK) idleSoon();
}
$("btnTour").addEventListener("click", () => startTour(false));
$("tourPlay").addEventListener("click", () => { tour.playing = !tour.playing; if (tour.playing) tourWait(); else clearTimeout(tour.timer); tourShow(); });
$("tourNext").addEventListener("click", () => tourGo(tour.i + 1));
$("tourStop").addEventListener("click", () => stopTour(true));
// you take over: in a kiosk any touch ends the tour; otherwise a drag or a key pauses it
let idleTimer = 0;
const idleSoon = () => { clearTimeout(idleTimer); if (KIOSK && !xr) idleTimer = setTimeout(() => { if (!tour.on) startTour(true); }, IDLE_S * 1000); };
for (const ev of ["pointerdown", "keydown", "wheel"]) addEventListener(ev, (e) => {
  if (e.target.closest?.("#tourbar, #btnTour")) return;
  if (tour.on && (tour.kiosk || e.target === renderer.domElement || ev === "keydown")) { if (tour.kiosk) stopTour(true); else if (tour.playing) { tour.playing = false; clearTimeout(tour.timer); tourShow(); } }
  idleSoon();
}, { capture: true, passive: true });
idleSoon();

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
// On a laptop the card stands at the left instead: the picture is centred in the part right of it, the same way
// sideways (the image is wider by the card's width, its extra strip off the right edge), and slides over as the card
// comes and goes.
let covered = 0, side = 0, sideTo = 0;
function applyView() {
  const w = stage.clientWidth, h = stage.clientHeight;
  camera.aspect = (w + side) / (h + covered);
  camera.fov = THREE.MathUtils.radToDeg(2 * Math.atan(Math.tan(THREE.MathUtils.degToRad(FOV / 2)) * (h + covered) / Math.max(1, h - covered)));
  camera.setViewOffset(w + side, h + covered, 0, covered, w, h);
  camera.updateProjectionMatrix();
}
function fitCamera() {
  const w = stage.clientWidth, h = stage.clientHeight;
  if (!w || !h || xr) return; // a headset sizes its own view
  const top = (el) => el.getBoundingClientRect().top - stage.getBoundingClientRect().top;
  const card = $("pcard"), cr = card.getBoundingClientRect(), wide = cr.width > w * 0.8, shown = !card.classList.contains("gone");
  covered = clamp(Math.max(h - top($("dock")), shown && wide ? h - top(card) : 0), 0, h * 0.45);
  sideTo = shown && !wide ? clamp(cr.right - stage.getBoundingClientRect().left + 16, 0, w * 0.45) : 0;
  if (reduceMotion) side = sideTo;
  // on a short screen the card reaches up over the floor plan: the plan steps aside while the card is open
  const plan = $("minimap"), pr = plan.getBoundingClientRect();
  plan.classList.toggle("under", shown && pr.bottom > cr.top && pr.top < cr.bottom && pr.left < cr.right && cr.left < pr.right);
  renderer.setSize(w, h, false);
  applyView();
  redraw();
}
let sideAt = 0; // when the slide was last stepped
function stepSide(now) {
  if (side === sideTo) { sideAt = now; return false; }
  const k = reduceMotion ? 1 : Math.min(1, (now - sideAt) / 120); // about 0.3 s, whatever the frame rate
  sideAt = now;
  side = Math.abs(sideTo - side) < 1 ? sideTo : side + (sideTo - side) * k;
  applyView();
  return true;
}
// tan of half the view's angle, up and across, over the part of it that isn't covered
const tans = () => { const t = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)), h = stage.clientHeight, w = stage.clientWidth; return { v: t * (h - covered) / (h + covered), h: t * (w - sideTo) / (h + covered) }; };
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
// The whole hall from above the entrance, framed tight in the part of the view the page leaves clear (under the
// buttons, above the dock): on a laptop three-quarters on; on a tall phone screen square on, the aisles running up
// the screen to the logo wall.
function homeView() {
  const w = stage.clientWidth, h = stage.clientHeight, tall = h > w * 1.15;
  // a portrait screen sees the hall from its side, at three quarters: the aisles stack down the screen and the whole
  // floor fills the height (seen down the aisles, the hall is wider than deep and left a band empty above and below)
  const az = tall ? 1.3 : -0.3, el = tall ? 1.12 : 0.84;
  const dir = new THREE.Vector3(Math.sin(az) * Math.cos(el), Math.sin(el), Math.cos(az) * Math.cos(el));
  const pts = [];
  for (const x of [-L.W / 2, L.W / 2]) for (const [z, y] of [[-L.D, 0], [-L.D, WALL_H], [0, WALL_H], [APRON * 0.5, 0]]) pts.push(new THREE.Vector3(x, y, z));
  const cam = camera.clone(); // (as it will be with no card at the side)
  cam.aspect = w / (h + covered); cam.setViewOffset(w, h + covered, 0, covered, w, h); cam.updateProjectionMatrix();
  const target = new THREE.Vector3(0, 0.5, -L.D / 2);
  const top = 1 - 2 * (tall ? 64 : 76) / h, bottom = -1 + 2 * (covered + (tall ? 60 : 16)) / h, side = 1 - 2 * (tall ? 10 : 30) / w;
  const tanF = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)), kx = tanF * cam.aspect, ky = tanF * h / (h + covered);
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
// (with "reduce motion" set on the device, every move is instant)
function flyTo(pos, target, ms = 1000, lift = null) {
  if (reduceMotion) { flight = null; jumpTo({ pos: pos.clone(), target: target.clone() }); planSoon(); return; }
  const d = camera.position.distanceTo(pos);
  flight = { p0: camera.position.clone(), t0: controls.target.clone(), p1: pos, t1: target, start: performance.now(), ms, lift: lift ?? Math.min(3, d * 0.25) };
}
// just inside the entrance at eye height, looking down the middle aisle
function entranceView() {
  const a = L.aisles[Math.floor((L.aisles.length - 1) / 2)];
  return { pos: new THREE.Vector3(a.mid, EYE, 0.6), target: new THREE.Vector3(a.mid, 1.3, -8) };
}
const EYE = 1.6;
// Walking: to a spot on the floor (a tap), or with the arrow keys or WASD. You stay at eye height, in the walkways
// and the open floor round them, never through a partition, the counter or a product.
function walkable(x, z) {
  if (Math.abs(x) > L.W / 2 - 0.35 || z < -L.D + 0.45 || z > APRON + 2) return false;
  if (z < 0.25 && z > -L.LEN - 0.25 && L.aisles.slice(0, -1).some((a) => Math.abs(x - a.x1) < PT / 2 + 0.3)) return false;
  const c = L.counter;
  if (x > c.x[0] - 0.35 && x < c.x[1] + 0.35 && z > c.z[0] - 0.35 && z < c.z[1] + 0.35) return false;
  if (decor.some(([x0, x1, z0, z1]) => x > x0 - 0.3 && x < x1 + 0.3 && z > z0 - 0.3 && z < z1 + 0.3)) return false;
  return !slots.some((s) => {
    if (s.wall || !s.group.visible) return false;
    const along = Math.abs(s.front.x) > 0.5, hx = (along ? s.size.d : s.size.w) / 2, hz = (along ? s.size.w : s.size.d) / 2;
    return Math.abs(x - s.center.x) < hx + 0.3 && Math.abs(z - s.center.z) < hz + 0.3;
  });
}
function walkTo(p) {
  // the nearest walkable spot on the way there
  const from = camera.position.clone().setY(0), to = new THREE.Vector3(p.x, 0, p.z);
  let spot = null;
  for (let k = 1; k >= 0; k -= 0.05) { const q = from.clone().lerp(to, k); if (walkable(q.x, q.z)) { spot = q; break; } }
  if (!spot) return false;
  const dir = new THREE.Vector3().subVectors(controls.target, camera.position).setY(0);
  if (dir.lengthSq() < 1e-4 || camera.position.y > WALL_H) dir.subVectors(to, from).setY(0); // from above: face the way you came down
  if (dir.lengthSq() < 1e-4) dir.set(0, 0, -1);
  dir.normalize();
  const pos = new THREE.Vector3(spot.x, EYE, spot.z), d = camera.position.distanceTo(pos);
  flyTo(pos, pos.clone().addScaledVector(dir, 4).setY(1.3), clamp(500 + d * 220, 600, 1800), 0);
  return true;
}
// Walking on a laptop: up/down (or W/S) walk forward and back, left/right turn, A/D step sideways, Shift hurries.
// Eased in and out, and it slides along whatever is in the way.
const keys = new Set(), run = { on: false };
const KEYS = { ArrowUp: "f", KeyW: "f", ArrowDown: "b", KeyS: "b", KeyA: "l", KeyD: "r", ArrowLeft: "tl", ArrowRight: "tr" };
addEventListener("keydown", (e) => {
  run.on = e.shiftKey;
  if (xr || e.target.closest?.("input, textarea, select, [contenteditable]") || e.metaKey || e.ctrlKey || e.altKey) return;
  const k = KEYS[e.code];
  if (!k) return;
  e.preventDefault(); keys.add(k); flight = null; hintGone(); walkTick();
});
addEventListener("keyup", (e) => { run.on = e.shiftKey; const k = KEYS[e.code]; if (k) keys.delete(k); });
addEventListener("blur", () => keys.clear());
let walkAt = 0, walkV = 0, turnV = 0, loopAt = 0, walkTimer = 0;
// (when the page draws only now and then, as a busy or background browser does, a timer keeps the steps coming)
function walkTick() {
  if (walkTimer) return;
  walkTimer = setInterval(() => {
    const now = performance.now();
    if (now - loopAt > 150 && stepWalk(now)) { controls.update(); redraw(); }
    if (!keys.size && !walkV && !turnV) { clearInterval(walkTimer); walkTimer = 0; }
  }, 50);
}
function stepWalk(now) {
  const dt = Math.min(0.2, (now - (walkAt || now)) / 1000); // (by the clock: a slow frame still walks as far)
  walkAt = now;
  const want = keys.has("f") || keys.has("b") || keys.has("l") || keys.has("r"), turn = (keys.has("tl") ? 1 : 0) - (keys.has("tr") ? 1 : 0);
  walkV = want ? Math.min(1, walkV + dt * 3) : Math.max(0, walkV - dt * 5); // eases in and out
  turnV = turn ? clamp(turnV + turn * dt * 5, -1, 1) : Math.sign(turnV) * Math.max(0, Math.abs(turnV) - dt * 6);
  if (!walkV && !turnV) return false;
  const c = camera.position;
  if (turnV) { // turn where you stand: the point you look at swings round you
    const d = new THREE.Vector3().subVectors(controls.target, c).applyAxisAngle(new THREE.Vector3(0, 1, 0), turnV * 1.4 * dt);
    controls.target.copy(c).add(d);
  }
  if (!walkV) return true;
  if (want) stepWalk.dir = [(keys.has("r") ? 1 : 0) - (keys.has("l") ? 1 : 0), (keys.has("f") ? 1 : 0) - (keys.has("b") ? 1 : 0)];
  const [ax, az] = stepWalk.dir || [0, 0];
  const fwd = new THREE.Vector3().subVectors(controls.target, c).setY(0);
  if (fwd.lengthSq() < 1e-6) return true;
  fwd.normalize();
  const right = new THREE.Vector3(-fwd.z, 0, fwd.x);
  const step = fwd.multiplyScalar(az).addScaledVector(right, ax);
  if (step.lengthSq() > 1) step.normalize();
  step.multiplyScalar((run.on ? 3.6 : 1.8) * walkV * dt);
  if (c.y > WALL_H) { camera.position.add(step.multiplyScalar(3)); controls.target.add(step); return true; } // from above: glide
  for (const s of [step, new THREE.Vector3(step.x, 0, 0), new THREE.Vector3(0, 0, step.z)]) {
    if (walkable(c.x + s.x, c.z + s.z)) { camera.position.add(s); controls.target.add(s); return true; }
  }
  return true;
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
// a tap is timed by when the finger went down and came up (the events' own times), not when a busy page got round to them
renderer.domElement.addEventListener("pointerdown", (e) => { press = { x: e.clientX, y: e.clientY, t: e.timeStamp }; });
renderer.domElement.addEventListener("pointerup", (e) => {
  if (!press) return;
  const moved = Math.hypot(e.clientX - press.x, e.clientY - press.y), quick = e.timeStamp - press.t < 450;
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
  // nothing there but the floor: walk to that spot
  const floorAt = () => { const t = -raycaster.ray.origin.y / raycaster.ray.direction.y; return t > 0 && t < 60 ? raycaster.ray.at(t, new THREE.Vector3()) : null; };
  if (!hit) { const f = floorAt(); if (f && selected) select(null); if (f) walkTo(f); return; }
  if (hit.object.userData.aisle) return flyToAisle(hit.object.userData.aisle);
  const s = slotOf(hit.object);
  if (!s) return;
  const near = selected === s || camera.position.distanceTo(s.center) < 4.2;
  const key = s.model && inModel(s, hit.object) ? partFor(s, hit) : null;
  if (key && near) { if (selected !== s) select(s); pressPart(s, key); return; }
  select(s, { fly: true });
}

// ── frame loop and size ──
let lastPlan = 0, lastDraw = 0, lastCalls = 0;
renderer.info.autoReset = false;
// Quality: if, inside the hall, most frames take longer than 34 ms (under 30 a second), the polished floor goes and
// the picture is drawn at 1x. ?quality=full keeps everything.
const QUALITY = new URLSearchParams(location.search).get("quality");
const perf = { n: 0, slow: 0, dropped: false };
function watchPerf(dt) {
  if (perf.dropped || QUALITY === "full" || !polished?.visible) return;
  perf.n++; if (dt > 34) perf.slow++;
  if (perf.n < 90) return;
  if (perf.slow > 45) {
    perf.dropped = true;
    polished.removeFromParent(); polished = null; plainFloor.visible = true;
    renderer.setPixelRatio(1); fitCamera();
  }
  perf.n = perf.slow = 0;
}
renderer.setAnimationLoop((time, frame) => {
  veil.visible = !xr && veil.count > 0; // (the filters' veils are for the screen only)
  if (xr) return xrFrame(time, frame);
  const now = performance.now();
  let moved = stepFlight(now);
  if (!flight && controls.update()) moved = true;
  if (controls.target.y < 0) controls.target.y = 0;
  if (animateParts(now)) moved = true;
  if (stepFades(now)) moved = true;
  if (stepSide(now)) moved = true;
  if (stepWalk(now)) moved = true;
  loopAt = now;
  // not on the way: what a flight passes would load only to be dropped (it plans again when it lands)
  if (!flight && now - lastPlan > 300) { lastPlan = now; planLoads(); }
  if (moved || mmDirty) drawMinimap();
  if (moved || dirty > 0) {
    pickFloor(camera);
    if (lastDraw && now - lastDraw < 100) watchPerf(now - lastDraw);
    lastDraw = now;
    renderer.info.reset(); // (by hand: the polished floor's own drawing of the hall would reset it halfway)
    renderer.render(scene, camera);
    lastCalls = renderer.info.render.calls;
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
// ?aisle=<n>: at that aisle's entrance (its number on the signs); ?q=<words>: the search, with what it finds
const aisleN = Math.round(+params.get("aisle")), openAisle = !focus && L.aisles[aisleN - 1];
if (focus) { select(focus); jumpTo(viewFor(focus)); }
else if (openAisle) { const v = aisleView(openAisle); jumpTo(v); }
else {
  // just inside the door at eye height, after a slow step in from outside
  const v = entranceView();
  jumpTo({ pos: v.pos.clone().add(new THREE.Vector3(0, 0.5, 4)), target: v.target });
  flyTo(v.pos, v.target, 2600, 0);
  // once the hall is on screen: building it can hold up the page longer than a toast lasts
  if (focusId) requestAnimationFrame(() => requestAnimationFrame(() => toast("That product isn’t in the showroom. Here is everything that is.", 6000)));
}
planLoads();
$("loading").remove();
if (params.get("q") && !focus) {
  $("q").value = params.get("q").slice(0, 80);
  $("q").dispatchEvent(new Event("input"));
  const found = findProducts($("q").value);
  if (found.length === 1) { $("q").value = ""; $("results").classList.add("hide"); select(found[0].it.s, { fly: true }); }
}

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
  renderer.info.reset();
  if (polished) { polished.visible = false; plainFloor.visible = true; }
  renderer.render(scene, xr.cam);
  lastCalls = renderer.info.render.calls;
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
  dimmed: () => slots.filter((s) => s.dim).map((s) => s.p.id),
  veils: () => veil.count,
  tour: () => ({ on: tour.on, playing: tour.playing, kiosk: tour.kiosk, at: tour.on ? tourStops[tour.i].p.id : null, stops: tourStops.map((s) => s.p.id) }),
  // where a spot on the floor is on the floor plan, in page pixels (null when the plan is folded away)
  mmPoint: (x, z) => { if (mm.el.classList.contains("closed")) return null; const r = mm.cv.getBoundingClientRect(); return [r.left + mmX(x), r.top + mmZ(z)]; },
  finish: (id) => byId.get(id)?.finish || 0,
  // how many of the fridge's food pieces its model shows
  stock: (id) => { let n = 0; byId.get(id)?.model?.traverse((o) => { if (o.userData.stock) n++; }); return n; },
  // every product's planned boxes in the hall (its body, and each part's reach when open), from products.json alone
  plan: () => L.places.map((pl) => {
    const m = new THREE.Matrix4().compose(new THREE.Vector3(...pl.pos), new THREE.Quaternion().setFromEuler(new THREE.Euler(0, pl.rot, 0)), ONE);
    return { id: pl.p.id, aisle: L.aisles.indexOf(pl.aisle), side: pl.side, wall: pl.p.placement === "wall",
      boxes: boxesOf(pl.p).map((b) => { const x = new THREE.Box3(new THREE.Vector3(...b.min), new THREE.Vector3(...b.max)).applyMatrix4(m); return { open: b.open, min: v3(x.min), max: v3(x.max) }; }) };
  }),
  // points in the hall to where they fall in the view the dock and card leave clear (-1..1 across and up)
  project: (pts) => pts.map((p) => new THREE.Vector3(...p).project(camera).toArray().slice(0, 2).map((n) => +n.toFixed(3))),
  // the fixtures' pieces, by kind
  fixtures: () => fixtures.map((f) => ({ tag: f.tag, min: v3(f.box.min), max: v3(f.box.max) })),
  // the hall's own size, as built (walls, floor and ceiling)
  hallBox: () => { const b = new THREE.Box3(); hall.children.filter((m) => m.material === mats.wall || m.material === mats.floor).forEach((m) => b.expandByObject(m)); return { min: v3(b.min), max: v3(b.max) }; },
  layout: () => ({ W: +L.W.toFixed(2), D: +L.D.toFixed(2), LEN: +L.LEN.toFixed(2), PT, PART_H, PART_TALL, partH: L.partH, WALL_H, aisles: L.aisles.map((a) => ({ cat: a.cat, part: a.part, of: a.of, n: a.items.length, x: [+a.x0.toFixed(2), +a.x1.toFixed(2)], walk: a.walk.map((v) => +v.toFixed(2)), mid: +a.mid.toFixed(2), len: +a.len.toFixed(2) })) }),
  slots: () => slots.map((s) => {
    let meshes = 0;
    s.model?.traverse((o) => { if (o.isMesh) meshes++; });
    return { id: s.p.id, cat: s.p.category, loaded: !!s.model, loading: s.loading, visible: s.group.visible, center: v3(s.center), front: v3(s.front), state: { ...s.state }, meshes,
      stand: { shown: s.stand.visible && !s.fade, tint: `#${s.box.material[0].color.getHexString()}`, photo: !!s.frontMat.map.userData.cropped } };
  }),
  loader: () => ({ cap: ldr.cap, near: ldr.near, loaded: slots.filter((s) => s.model).length, loading: slots.filter((s) => s.loading).length, maxSeen: ldr.maxSeen, loads: ldr.loads, unloads: ldr.unloads, failed: slots.filter((s) => s.failed).map((s) => s.p.id) }),
  resetMax: () => { ldr.maxSeen = busyCount(); },
  camera: () => ({ pos: v3(camera.position), target: v3(controls.target), flying: !!flight || side !== sideTo }),
  look: (pos, target) => { flight = null; jumpTo({ pos: new THREE.Vector3(...pos), target: new THREE.Vector3(...target) }); planLoads(); },
  selected: () => selected?.p.id || null,
  card: () => ({ shown: !$("pcard").classList.contains("gone"), name: $("pcName").textContent, link: $("pcLink").getAttribute("href") }),
  // a point in a product's own model space, on the screen
  screenOf: (id, p) => { const s = byId.get(id); const v = s.group.localToWorld(new THREE.Vector3(...p)).project(camera); const r = renderer.domElement.getBoundingClientRect(); return v.z > 1 ? null : [r.left + (v.x + 1) / 2 * r.width, r.top + (1 - v.y) / 2 * r.height]; },
  // The palette as it shows on screen. For each painted surface, spots on it are tried until one has nothing in front
  // of it from 2 m away; the view from there is drawn to the screen and the colour at the middle read back (the median
  // of a 5x5 patch, sRGB). `clear`: a spot no wall-wash or lamp glow adds to; `washed`: one under a scallop's beam
  // (the greige walls only), to see the light warms the wall and doesn't hide it.
  swatches: () => {
    const { W, D } = L, S = [];
    const zs = (z0, z1, st = 0.2) => { const o = []; for (let z = z0; z >= z1; z -= st) o.push(z); return o; };
    const xs = (x0, x1, st = 0.2) => { const o = []; for (let x = x0; x <= x1; x += st) o.push(x); return o; };
    const walls = (y) => [...zs(-0.8, -D + 0.8).flatMap((z) => [[[-W / 2, y, z], [1, 0, 0]], [[W / 2, y, z], [-1, 0, 0]]]), ...xs(-W / 2 + 0.8, W / 2 - 0.8).map((x) => [[x, y, -D], [0, 0, 1]])];
    S.push({ name: "greige wall", hex: PAL.greige, mats: [L.paint.wall], spots: [1.2, 1.5, 1.8].flatMap(walls) });
    S.push({ name: "greige partition", hex: PAL.greige, mats: L.paint.partitions, spots: L.aisles.slice(0, -1).flatMap((a) => zs(-0.6, -L.LEN + 0.6).flatMap((z) => [1.2, 1.6].flatMap((y) => [[[a.x1 - PT / 2, y, z], [-1, 0, 0]], [[a.x1 + PT / 2, y, z], [1, 0, 0]]]))) });
    S.push({ name: "charcoal fascia", hex: PAL.charcoal, mats: [L.paint.wall], spots: walls((FASCIA + WALL_H) / 2) });
    S.push({ name: "ivory ceiling", hex: PAL.ivory, mats: [L.paint.ceiling], spots: xs(-W / 2 + 1, W / 2 - 1, 0.37).flatMap((x) => zs(-1, -D + 1, 0.53).map((z) => [[x, WALL_H, z], [0, -1, 0]])) });
    S.push({ name: "champagne backdrop", hex: PAL.champagne, mats: [L.paint.backdrop], spots: L.backdrops.flatMap(([x0, x1]) => xs(x0 + 0.1, x1 - 0.1, 0.15).flatMap((x) => [1.0, 1.3, 2.2, 2.5].map((y) => [[x, y, -D], [0, 0, 1]]))) });
    S.push({ name: "ice band", hex: PAL.ice, mats: [L.paint.ice], spots: L.iceBands.flatMap((b) => zs(b.z1 - 0.05, b.z0 + 0.05, 0.1).map((z) => [[b.x, b.y, z], [b.face, 0, 0]])) });
    const gl = renderer.getContext(), cam = new THREE.PerspectiveCamera(40, gl.drawingBufferWidth / gl.drawingBufferHeight, 0.05, 60);
    const extra = (m) => m.blending === THREE.AdditiveBlending, px = new Uint8Array(5 * 5 * 4);
    const read = (pos, n) => {
      cam.position.set(pos[0] + 2 * n[0], pos[1] + 2 * n[1], pos[2] + 2 * n[2]);
      if (n[1]) cam.up.set(0, 0, -1); else cam.up.set(0, 1, 0);
      cam.lookAt(...pos); cam.updateMatrixWorld(true);
      renderer.setRenderTarget(null); renderer.render(scene, cam);
      gl.readPixels((gl.drawingBufferWidth >> 1) - 2, (gl.drawingBufferHeight >> 1) - 2, 5, 5, gl.RGBA, gl.UNSIGNED_BYTE, px);
      return [0, 1, 2].map((c) => { const v = []; for (let i = 0; i < 25; i++) v.push(px[i * 4 + c]); v.sort((a, b) => a - b); return v[12]; });
    };
    const hits = (pos, n) => {
      const o = new THREE.Vector3(pos[0] + 2 * n[0], pos[1] + 2 * n[1], pos[2] + 2 * n[2]);
      raycaster.set(o, new THREE.Vector3(-n[0], -n[1], -n[2])); raycaster.camera = camera;
      return raycaster.intersectObjects(scene.children, true).filter((h) => (h.object.isMesh || h.object.isSprite) && shown(h.object) && h.object.material);
    };
    const out = S.map((s) => {
      const r = { name: s.name, hex: s.hex, want: [1, 3, 5].map((i) => parseInt(s.hex.slice(i, i + 2), 16)), tried: s.spots.length };
      for (const [pos, n] of s.spots) {
        const hs = hits(pos, n), first = hs.find((h) => !extra(h.object.material));
        if (!first || !s.mats.includes(first.object.material) || Math.abs(first.distance - 2) > 0.03) continue;
        const lit = hs.filter((h) => h.distance < first.distance && extra(h.object.material));
        if (!lit.length) { r.clear = { at: pos, got: read(pos, n) }; break; }
      }
      // in a scallop's beam on the hall's side walls, a little over halfway down it
      for (const [x, y, z] of s.name === "greige wall" ? L.wash.filter(([x]) => Math.abs(x) > W / 2 - 0.1) : []) {
        const pos = [Math.sign(x) * W / 2, y, z], n = [-Math.sign(x), 0, 0], hs = hits(pos, n), first = hs.find((h) => !extra(h.object.material));
        if (first?.object.material !== L.paint.wall || Math.abs(first.distance - 2) > 0.03) continue;
        if (hs.some((h) => h.distance < first.distance && h.object.material === L.paint.wash)) { r.washed = { at: pos, got: read(pos, n) }; break; }
      }
      return r;
    });
    redraw();
    return out;
  },
  // products with no wall-wash scallop over their bay, on the wall or partition behind them (beside it, for a unit on the wall)
  unwashed: () => L.places.filter((pl) => !L.wash.some(([x, , z]) => Math.abs(z - pl.pos[2]) < (pl.p.placement === "wall" ? sizeOf(pl.p).w / 2 + 0.35 : 0.05) && Math.abs(x - pl.pos[0]) < 1 && Math.sign(x - pl.pos[0]) === (pl.side === "L" ? -1 : 1))).map((pl) => pl.p.id),
  draws: () => lastCalls, // in the last frame, the polished floor's mirror image included
  // the time to draw a frame here and wait for it, in ms (the average of n), and whether the effects were dropped
  frameTime: (n = 20) => { pickFloor(camera); const gl = renderer.getContext(); renderer.render(scene, camera); gl.finish(); const t0 = performance.now(); for (let i = 0; i < n; i++) { renderer.render(scene, camera); gl.finish(); } return { ms: +((performance.now() - t0) / n).toFixed(1), polished: !!polished?.visible, dropped: perf.dropped }; },
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
