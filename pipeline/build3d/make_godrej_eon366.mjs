// Godrej RT EONVIBE 366BN RCIT (Eon Vibe Convertible, 330 L, 2 star), double door, frost free, in Godrej's three colours:
// Matt Black (RT EONVIBE 366BN RCIT MT BK, first), Champagne Gold (... CH GD) and Steel Rush (... ST RH), as material
// variants (KHR_materials_variants) of the one model.
// Built to Godrej's published size, 652 W x 1750 H x 676 D mm ("1.75m X 65.20cm X 67.60cm"), and Godrej's own photos of
// the three codes (straight front and 3/4 of each; the Matt Black with both doors open and a close-up of the control
// panel). Freezer on top, fridge below, both doors hinged on the right, a grip pocket in each door's free edge (the left),
// the Godrej script on the freezer door, the control panel on the cabinet's top frame behind the freezer door.
// Inside, as the open-door photo shows it: in the freezer a glass shelf with the Movable Ice Maker on it at the left and
// the vented back panel; in the fridge the Cool Shower duct and light unit at the back, a clear top tray, three
// toughened-glass shelves ("Number of Shelves 3"), the Quick Access Box over the 33 litre vegetable tray; two bins on the
// freezer door, and on the fridge door two Utility Shelves, a small bin and the bottle bin above the dimpled liner.
// Godrej publishes no manual, rear photo or clearances for this code: the back is plain (no compressor bay, cord or
// plate is shown anywhere), and every inside size is ESTIMATED from the open-door photo (NOTES.md).
// Moving parts: freezer door, the ice maker (slides out on its shelf: "Move or even remove the ice maker"), fridge door,
// and the trays (the three glass shelves, the Quick Access Box and the vegetable tray, with their food).
// For another Godrej Eon fridge: the sizes are all in the "size" block, the colours in FINISHES; the texture folder T.
// usage: node make_godrej_eon366.mjs <entry .json, never products.json> <tex dir> <out.glb>
import fs from "node:fs";
import { NodeIO } from "@gltf-transform/core";
import { ALL_EXTENSIONS, KHRMaterialsVariants, KHRMaterialsClearcoat } from "@gltf-transform/extensions";
import { LGStock } from "./stock_lg.mjs";
import { THREE, mat, mesh, box, faced, group, stateClips, exportGLB, productParts, saveZones, GRAIN } from "./lib.mjs";

const [PRODUCTS, TEX, OUT] = process.argv.slice(2);
const ID = "godrej-rt-eonvibe-366bn-rcit-mt-bk";
const T = `${TEX}/godrej_eon366`;

// ── the colours: the first is the model's own materials, the others are variants of the materials named here ──
// door: the photo texture of each colour's straight front (tex_godrej_eon366.py), its roughness and metalness and grain;
// side: the cabinet's painted sides and top, as each colour's 3/4 photo shows them (sRGB); edge: the doors' edges;
// logo: the script's ink (white on the black and the steel, dark on the champagne: Godrej's fronts);
// grain null: no surface grain on that colour (the Matt Black's door grain is taken off its copy); coat: [amount,
// roughness] of a clear glossy film on top
const FINISHES = [
  { name: "Matt Black", key: "mtbk", door: { rough: 0.62, metal: 0, grain: "peel" }, side: 0x3b3c3e, top: 0x333436,
    edge: { color: 0x252628, rough: 0.6, metal: 0 }, grip: 0x121315, logo: "logo_light.png" },
  // Champagne Gold: a satin metal. Its front and 3/4 photos show a soft, broad sheen down the middle of the doors in the
  // same place, and no brushing at 0.7 px per mm: the sheen is kept in the door texture (tex FALL), a fine
  // non-directional grain on the surface
  { name: "Champagne Gold", key: "chgd", door: { rough: 0.36, metal: 0.3, grain: "peel_soft" }, side: 0x6b6763, top: 0x5f5c58,
    edge: { color: 0x5a5753, rough: 0.5, metal: 0 }, grip: 0x46433f, logo: "logo_dark.png" },
  // Steel Rush: a near-mirror film over a printed steel look (both photos: a broad diagonal reflection with a hard edge,
  // a bright edge strip; the faint hairlines, ~1.3 of 180 levels on the front photo, are printed under the film). So a
  // plain printed base with the lines in its texture only, no surface grain, and a full clear coat at roughness 0.03
  { name: "Steel Rush", key: "strh", door: { rough: 0.4, metal: 0, grain: null, coat: [1, 0.03] }, side: 0x9da1a4, top: 0x8e9194,
    edge: { color: 0xbfc2c4, rough: 0.3, metal: 0.6 }, grip: 0x8d9193, logo: "logo_light.png" },
];
const F0 = FINISHES[0];

// ── size (metres) ──
const W = 0.652, H = 1.75, D = 0.676;                   // Godrej: 65.20 cm x 1.75 m x 67.60 cm
const doorT = 0.058, Dc = D - doorT;                    // the door 58 mm thick (3/4 photo, ESTIMATED)
const zBack = -D / 2, zFront = zBack + Dc;
const wall = 0.045, backT = 0.045, topT = 0.075;         // side walls (open photo: the liner starts 45-50 mm in), back (ESTIMATED, as the sides), top frame 70-75 mm (open photo)
const feet = 0.034, floorTop = 0.092;                   // nothing but the feet shows under the doors (front photo); the fridge floor's front edge (open photo)
// doors (front photo, 0.435 px per mm): the fridge door from 34 mm to 1252 mm, the freezer door from 1264 mm to the top
const doorBottom = 0.034, gap = 0.012, yFreezer = 1.264;
const freezerH = H - yFreezer, fridgeH = yFreezer - gap - doorBottom, yDiv = yFreezer - gap / 2;
// heights inside, ESTIMATED from the open-door photo (0.415 px per mm from the cabinet's top, row 195, to the floor under
// the feet, row 921): the edges as the photo shows them at the cabinet's front
const fzTop = H - topT;                                 // the freezer's ceiling
const fzCeil = 1.229, fzFloor = 1.302;                  // the mullion: fridge ceiling and freezer floor
const fzShelfTop = 1.439;                               // the freezer's glass shelf
const trayTop = 1.070;                                  // the clear top tray under the Cool Shower light unit
const sA = 0.940, sB = 0.790, sC = 0.555;               // the three glass shelves, top to bottom
const qabTop = 0.410, vegTop = 0.371, vegBottom = 0.105; // the Quick Access Box (its top) and the vegetable tray under it
const unitBottom = 1.097;                               // the light unit's lower edge
const ductBottom = 0.56;                                // the Cool Shower duct runs down the back wall to behind shelf 3
// door bins, from the door's bottom edge (open photo, ESTIMATED): on the fridge door the bottle bin, Utility Shelf 2, the
// small bin on the free-edge half and Utility Shelf 1 at the top; on the freezer door two bins
const BINS = {
  FridgeDoor: [{ f: 0.236, h: 0.13, d: 0.10 }, { f: 0.717, h: 0.084, d: 0.095, label: true }, { f: 0.917, h: 0.066, d: 0.065, small: true }, { f: 1.075, h: 0.084, d: 0.095, label: true, eggs: true }],
  FreezerDoor: [{ f: 0.069, h: 0.08, d: 0.085 }, { f: 0.25, h: 0.08, d: 0.085 }],
};
const linerFace = 0.016;                                // the door liner's face, behind the door's back edge
// with the doors shut the bins reach into the cabinet: everything inside ends 1 cm short of the bin in front of it
const reach = (name) => Math.max(...BINS[name].map((b) => b.d)) + linerFace;
const frontFridge = zFront - reach("FridgeDoor") - 0.01;
const frontFreezer = zFront - reach("FreezerDoor") - 0.01;

// ── materials ──
const flipV = (geo) => { const uv = geo.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setY(i, 1 - uv.getY(i)); return geo; };
const frame = mat("Frame", 0x1c1d20, { rough: 0.6 });                     // the black front frame round the doors' openings (open photo)
const sidePaint = mat("SidePaint", F0.side, { rough: 0.62 });
const topSkin = mat("TopSkin", F0.top, { rough: 0.7 });
const freezerFront = mat("FreezerFront", 0xffffff, { metal: F0.door.metal, rough: F0.door.rough });
const fridgeFront = mat("FridgeFront", 0xffffff, { metal: F0.door.metal, rough: F0.door.rough });
const doorEdge = mat("DoorEdge", F0.edge.color, { rough: F0.edge.rough, metal: F0.edge.metal });
const grip = mat("Grip", F0.grip, { rough: 0.7 });
const logoM = mat("GodrejLogo", 0xffffff, { rough: 0.45, opacity: 0.999 });
const panelM = mat("ControlPanel", 0xffffff, { rough: 0.2, opacity: 0.999 });
const recess = mat("Recess", 0x0b0b0d, { rough: 0.7 });
const liner = mat("Liner", 0xe3e6e9, { rough: 0.72, emissive: 0x7d8186, emissiveIntensity: 0.55 });
const glass = mat("Glass", 0xcfe3ea, { rough: 0.05, opacity: 0.45 });
const glassEdge = mat("GlassEdge", 0x1d2124, { rough: 0.3 });              // the glass shelves' dark front edge (open photo)
const binMat = mat("Bin", 0xcfe0ea, { rough: 0.15, opacity: 0.62 });
const clearLite = mat("ClearLight", 0xdfe7ee, { rough: 0.12, opacity: 0.3, side: THREE.DoubleSide });
const frosted = mat("Frosted", 0xe9eef1, { rough: 0.45, opacity: 0.8 });
const qabWhite = mat("QabWhite", 0xf1f3f5, { rough: 0.5 });
const gasket = mat("Gasket", 0x2a2b2e, { rough: 0.85 });                    // black gaskets on the black doors (open photo)
const light = mat("Light", 0xffffff, { emissive: 0xf4f8ff, emissiveIntensity: 1.4 });
const unitWhite = mat("UnitWhite", 0xf3f5f7, { rough: 0.45 });
const iceWhite = mat("IceMakerWhite", 0xeef1f4, { rough: 0.4 });
const iceBin = mat("IceBin", 0xb9cbe6, { rough: 0.15, opacity: 0.7 });     // the ice box's blue-tinted clear front (open photo)
const iceCube = mat("IceCube", 0xe3f4ff, { rough: 0.08, opacity: 0.72 });
const backFz = mat("BackFreezer", 0xffffff, { rough: 0.7 }), ductM = mat("DuctFridge", 0xffffff, { rough: 0.7 });
const printQab = mat("PrintQab", 0xffffff, { rough: 0.5, opacity: 0.999 }), printUtil = mat("PrintUtility", 0xffffff, { rough: 0.5, opacity: 0.999 });
const printIce = mat("PrintIceMaker", 0xffffff, { rough: 0.5, opacity: 0.999 });
const dimples = mat("LinerDimples", 0xffffff, { rough: 0.72, emissive: 0x7d8186, emissiveIntensity: 0.55 });
const back = mat("Back", 0x2f3033, { rough: 0.8 });                         // the back: plain (no rear photo), dark (ESTIMATED)
const foot = mat("Foot", 0x17181a, { rough: 0.7 });
const hingeM = mat("Hinge", 0x232427, { metal: 0.4, rough: 0.45 });
const screw = mat("Screw", 0xb8bcc0, { metal: 0.9, rough: 0.3 });

const root = group("GodrejEonVibe");
const cab = group("Cabinet");
root.add(cab);

// ── cabinet: painted sides and top, a black front frame, white inside ──
const shellH = H - feet, shellMid = feet + shellH / 2, zMid = zBack + Dc / 2;
cab.add(faced("SideLeft", wall, shellH, Dc, [liner, sidePaint, topSkin, frame, frame, back], -W / 2 + wall / 2, shellMid, zMid));
cab.add(faced("SideRight", wall, shellH, Dc, [sidePaint, liner, topSkin, frame, frame, back], W / 2 - wall / 2, shellMid, zMid));
cab.add(faced("Top", W - 2 * wall, topT, Dc, [frame, frame, topSkin, liner, frame, back], 0, H - topT / 2, zMid));
cab.add(faced("Base", W - 2 * wall, floorTop - feet, Dc, [frame, frame, liner, frame, frame, back], 0, feet + (floorTop - feet) / 2, zMid));
const wallH = fzTop - floorTop;
cab.add(faced("BackWall", W - 2 * wall, wallH, backT, [liner, liner, liner, liner, liner, back], 0, floorTop + wallH / 2, zBack + backT / 2));
const zIn = zBack + backT;                              // the inner face of the back wall
cab.add(box("Divider", W - 2 * wall, fzFloor - fzCeil, Dc - backT, liner, 0, (fzCeil + fzFloor) / 2, zIn + (Dc - backT) / 2));
// the mullion's front: the centre hinge at the right and the spare mounting plate at the left (open photo), in the gap
cab.add(box("CenterHinge", 0.07, gap - 0.002, 0.03, hingeM, W / 2 - 0.045, yDiv, zFront + 0.006));
// the gap between the closed doors reads black on Godrej's fronts (the gaskets): a dark strip on the mullion's face behind it
cab.add(box("GapShade", W - 2 * wall, gap, 0.003, frame, 0, yDiv, zFront + 0.0015));
cab.add(box("SparePlate", 0.05, gap - 0.002, 0.012, hingeM, -W / 2 + 0.035, yDiv, zFront + 0.002));
for (const [x, z] of [[W / 2 - 0.03, zFront + 0.015], [-W / 2 + 0.03, zFront + 0.005]]) {
  const s = mesh("HingeScrew", new THREE.CylinderGeometry(0.004, 0.004, 0.002, 10), screw, x, yDiv + gap / 2 - 0.001, z);
  cab.add(s);
}
// feet: four black levelling feet, 34 mm (front photo)
for (const [fx, fz] of [[-1, 1], [1, 1], [-1, -1], [1, -1]]) {
  cab.add(mesh("Foot", new THREE.CylinderGeometry(0.014, 0.017, feet, 18), foot, fx * (W / 2 - 0.035), feet / 2, fz > 0 ? zFront - 0.04 : zBack + 0.045));
}

// ── inside ──
const inW = W - 2 * wall - 0.006;                       // between the side ribs
const xIn = W / 2 - wall;
const zDuct = zIn + 0.012;                              // the front of the raised back panels
const rails = (name, yTop, z0, z1) => { for (const sx of [-1, 1]) cab.add(box(name, 0.008, 0.012, z1 - z0, liner, sx * (xIn - 0.004), yTop - 0.012, (z0 + z1) / 2)); };
// the control panel on the top frame, 188 x 41.5 mm, centred, its middle 23 mm under the top (open photo, close-up)
cab.add(mesh("ControlPanelFace", flipV(new THREE.PlaneGeometry(0.188, 0.0415)), panelM, 0, H - 0.023, zFront + 0.0006));
// the freezer's back panel: raised 12 mm, 460 x 250 mm, with its rows of vents (open photo)
cab.add(mesh("FreezerBackPanel", flipV(new THREE.BoxGeometry(0.46, 0.25, 0.012)), [liner, liner, liner, liner, backFz, liner], 0, fzFloor + 0.008 + 0.125, zIn + 0.006));
// the fridge's Cool Shower duct down the middle of the back wall, and the light unit under the ceiling in front of it
cab.add(mesh("CoolShowerDuct", flipV(new THREE.BoxGeometry(0.2, fzCeil - ductBottom, 0.012)), [liner, liner, liner, liner, ductM, liner], 0, (fzCeil + ductBottom) / 2, zIn + 0.006));
{
  const uw = 0.17, uh = fzCeil - unitBottom, ud = 0.075, uz = zDuct + ud / 2;
  cab.add(box("LightUnit", uw, uh, ud, unitWhite, 0, fzCeil - uh / 2, uz));
  cab.add(box("LightLens", uw - 0.03, 0.012, 0.004, light, 0, unitBottom + 0.02, zDuct + ud + 0.002));
  const sensor = mesh("UnitSensor", new THREE.CylinderGeometry(0.008, 0.008, 0.004, 16), unitWhite, 0, fzCeil - 0.025, zDuct + ud + 0.002);
  sensor.rotation.x = Math.PI / 2; cab.add(sensor);
}
// the clear top tray across the fridge under the light unit, with its tall clear ends (open photo); it stays in
{
  const z0 = zDuct + 0.004, z1 = frontFridge, td = z1 - z0, tz = (z0 + z1) / 2, tw = inW - 0.01;
  cab.add(box("TopTrayFloor", tw, 0.004, td, binMat, 0, trayTop - 0.002, tz));
  for (const sx of [-1, 1]) cab.add(box("TopTrayEnd", 0.004, 0.09, td, clearLite, sx * (tw / 2 - 0.002), trayTop + 0.045, tz));
  cab.add(box("TopTrayRim", tw, 0.014, 0.006, frosted, 0, trayTop + 0.005, z1 - 0.003));
}
cab.add(box("FridgeLedStrip", 0.004, 0.18, 0.02, light, -xIn + 0.003, fzCeil - 0.2, zFront - 0.12));

// the parts that come out (FridgeTrays): three glass shelves, the Quick Access Box and the vegetable tray, with their food
const trays = group("FridgeTrays");
cab.add(trays);
function glassShelf(name, yTop) {                       // toughened glass with a dark front edge
  const z0 = zDuct + 0.002, z1 = frontFridge, w = inW - 0.01;
  trays.add(box(name, w, 0.006, z1 - 0.006 - z0, glass, 0, yTop - 0.003, (z0 + z1 - 0.006) / 2));
  trays.add(box(name + "Edge", w, 0.008, 0.006, glassEdge, 0, yTop - 0.004, z1 - 0.003));
  rails(name + "Rail", yTop - 0.006, zIn, z1 - 0.01);
}
glassShelf("ShelfA", sA);
glassShelf("ShelfB", sB);
glassShelf("ShelfC", sC);
// the vegetable tray: one clear drawer, 33 litres (Godrej): 520 x 230 x 290 mm inside (ESTIMATED to that volume); behind it
// the step over the compressor (ESTIMATED: no photo shows the back)
const bbW = 0.53, bbZ1 = frontFridge, bbD = 0.30, bbZ0 = bbZ1 - bbD, bbZ = (bbZ0 + bbZ1) / 2;
cab.add(faced("CompressorStep", inW, 0.3 - floorTop, bbZ0 - 0.012 - zIn, [liner, liner, liner, liner, liner, liner], 0, (0.3 + floorTop) / 2, (zIn + bbZ0 - 0.012) / 2));
{
  const hh = vegTop - vegBottom;
  trays.add(box("FzBoxFloor", bbW, 0.004, bbD, binMat, 0, vegBottom + 0.002, bbZ));
  trays.add(box("FzBoxBack", bbW, hh, 0.004, binMat, 0, vegBottom + hh / 2, bbZ0 + 0.002));
  trays.add(box("FzBoxL", 0.004, hh, bbD, binMat, -bbW / 2 + 0.002, vegBottom + hh / 2, bbZ));
  trays.add(box("FzBoxR", 0.004, hh, bbD, binMat, bbW / 2 - 0.002, vegBottom + hh / 2, bbZ));
  trays.add(box("FzBoxFront", bbW, hh - 0.012, 0.004, clearLite, 0, vegBottom + (hh - 0.012) / 2, bbZ1 - 0.002));
  trays.add(box("FzBoxRim", bbW + 0.008, 0.012, 0.008, frosted, 0, vegTop - 0.006, bbZ1 - 0.002));
}
// the Quick Access Box over it: a white frosted top with its clear front lip and "Quick Access Box" printed on it
{
  const z0 = zIn + 0.004, z1 = frontFridge, w = inW - 0.01;
  trays.add(box("QabTop", w, 0.008, z1 - z0, qabWhite, 0, qabTop - 0.004, (z0 + z1) / 2));
  trays.add(box("QabLip", w, qabTop - vegTop - 0.002, 0.008, frosted, 0, (qabTop + vegTop) / 2, z1 - 0.004));
  const p = mesh("PrintQab", flipV(new THREE.PlaneGeometry(0.11, 0.014)), printQab, 0, qabTop + 0.0006, z1 - 0.09);
  p.rotation.x = -Math.PI / 2; trays.add(p);
  rails("QabRail", qabTop - 0.008, zIn, z1 - 0.01);
}

// ── groceries (stock_lg.mjs, food.mjs): vegetarian South Indian food, eggs, juices, water and soft drinks ──
const stock = LGStock({ T3: `${TEX}/lg_glt3426`, TF: `${TEX}/food`, BR: `${TEX}/brands`, BRT: `${TEX}/brands/small` });
const vegFloor = vegBottom + 0.004;
// the tall things on the lowest shelf (the most room), the low ones on the top shelf, the fruit on the middle one
stock.shelves(trays, {
  zIn1: zIn, inW, inD: frontFridge - zIn, s1: sC - 0.0025, s2: sA - 0.0025, s3: sB - 0.0025, fz: vegFloor, fit: true,
  vz0: bbZ0 + 0.02, vk: 0.8 * (bbD - 0.04) / 0.454,
  shelfB: { hw: inW / 2 - 0.03, z0: zDuct + 0.02, z1: frontFridge - 0.015 },
  drawerB: { hw: bbW / 2 - 0.014, z0: bbZ0 + 0.02, z1: bbZ1 - 0.008, y0: vegFloor },
  drawerCeil: qabTop - 0.008 - 0.01 - vegFloor,          // the heap stays 1 cm under the Quick Access Box
});
// The vegetable tray is 30 cm deep (it stops at the compressor's step), so the 34 cm drumsticks lie across it at the back
// instead of along it, and the heap is dropped in again around them (the cauliflower's tilted leaves go into its geometry
// first, so its box is its real extent). stock_lg.mjs keeps its dropping method to itself: this copy is the Samsung RT40
// builder's, unchanged
const kids = (g, name) => g.children.filter((o) => o.name === name);
const wbox = (o) => { o.updateWorldMatrix(true, true); return new THREE.Box3().setFromObject(o); };
const _ray = new THREE.Raycaster(), DOWN = new THREE.Vector3(0, -1, 0), UP = new THREE.Vector3(0, 1, 0);
const meshesOf = (o) => { const m = []; o.traverse((c) => c.isMesh && m.push(c)); return m; };
const pointsOf = (meshes, n = 1000) => meshes.flatMap((m) => {
  const p = m.geometry.attributes.position, step = Math.max(1, Math.floor(p.count / n)), out = [];
  for (let i = 0; i < p.count; i += step) out.push(new THREE.Vector3().fromBufferAttribute(p, i).applyMatrix4(m.matrixWorld));
  return out;
});
const overXZ = (a, b) => a.max.x > b.min.x && a.min.x < b.max.x && a.max.z > b.min.z && a.min.z < b.max.z;
const gpos = (o) => o.parent.getWorldPosition(new THREE.Vector3());
const measure = (o) => { const b = wbox(o), p = gpos(o); b.min.sub(p); b.max.sub(p); return b; };
function dropOnto(o, placed) {
  const floorY = gpos(o).y, b = wbox(o), own = meshesOf(o), hits = [];
  const near = placed.filter((q) => overXZ(q.box, b)), under = near.flatMap((q) => q.meshes);
  for (const p of pointsOf(own)) {
    let d = p.y - floorY, floor = true;
    if (under.length) { _ray.set(p, DOWN); const h = _ray.intersectObjects(under, false)[0]; if (h && h.distance < d) { d = h.distance; floor = false; } }
    hits.push([d, p.x, p.z, floor]);
  }
  for (const q of near) for (const p of q.pts) {
    if (p.x < b.min.x || p.x > b.max.x || p.z < b.min.z || p.z > b.max.z) continue;
    _ray.set(p, UP);
    const h = _ray.intersectObjects(own, false)[0];
    if (h) hits.push([h.distance, p.x, p.z]);
  }
  let drop = Infinity;
  for (const h of hits) drop = Math.min(drop, h[0]);
  const touch = hits.filter((h) => h[0] - drop < 0.004), c = b.getCenter(new THREE.Vector3()), mx = 0.15 * (b.max.x - b.min.x), mz = 0.15 * (b.max.z - b.min.z);
  const xs = touch.map((h) => h[1]), zs = touch.map((h) => h[2]);
  const steady = touch.some((h) => h[3]) || (Math.min(...xs) - mx <= c.x && c.x <= Math.max(...xs) + mx && Math.min(...zs) - mz <= c.z && c.z <= Math.max(...zs) + mz);
  return { drop, steady };
}
function settle(items, { tries = 1, spread = 0, bounds = null, ceil = Infinity, seed = 7 } = {}) {
  let r = seed;
  const rnd = () => ((r = (r * 16807) % 2147483647) / 2147483647) * 2 - 1;
  const placed = [], left = [], tipped = [];
  for (const o of items) {
    const x0 = o.position.x, z0 = o.position.z;
    let best = null;
    for (let t = 0; t < tries; t++) {
      o.position.x = x0 + (t ? rnd() * spread : 0);
      o.position.z = z0 + (t ? rnd() * spread : 0);
      if (bounds) {
        const m = measure(o);
        o.position.x += Math.max(0, -bounds.hw - m.min.x) - Math.max(0, m.max.x - bounds.hw);
        o.position.z += Math.max(0, bounds.z0 - m.min.z) - Math.max(0, m.max.z - bounds.z1);
      }
      o.position.y += 1 - measure(o).min.y;
      const { drop, steady } = dropOnto(o, placed);
      o.position.y -= drop;
      const m = measure(o), y = (m.min.y + m.max.y) / 2, fits = m.max.y <= ceil;
      if (!best || (fits && !best.fits) || (fits === best.fits && (steady && !best.steady || steady === best.steady && y < best.y - 0.001)))
        best = { x: o.position.x, y, z: o.position.z, py: o.position.y, steady, fits };
    }
    o.position.set(best.x, best.py, best.z);
    if (!best.fits) { left.push(o.name); o.removeFromParent(); continue; }
    if (!best.steady) tipped.push(o.name);
    const meshes = meshesOf(o);
    o.updateWorldMatrix(true, true);
    placed.push({ box: wbox(o), meshes, pts: pointsOf(meshes) });
  }
  if (left.length) console.warn(`settle: no room for ${left.join(", ")}`);
  if (tipped.length) console.warn(`settle: no steady spot for ${tipped.join(", ")}`);
}
{
  const v = trays.getObjectByName("FreshZoneStock"), drawerB = { hw: bbW / 2 - 0.014, z0: bbZ0 + 0.02, z1: bbZ1 - 0.008 };
  const c = v.getObjectByName("Cauliflower");
  if (c) for (const m of c.children) if (m.isMesh && (m.rotation.x || m.rotation.z)) {
    m.updateMatrix();
    m.geometry = m.geometry.clone().applyMatrix4(m.matrix);
    m.position.set(0, 0, 0); m.rotation.set(0, 0, 0); m.scale.set(1, 1, 1);
  }
  kids(v, "Drumstick").forEach((o, i) => { o.rotation.y += Math.PI / 2; o.position.set(0.02 * (i % 2 ? 1 : -1), 0, drawerB.z0 + 0.02 + i * 0.024); });
  const HEAP = ["Drumstick", "Cabbage", "Cauliflower", "Onion", "Potato", "Brinjal", "Capsicum", "Carrot", "Tomato", "LadiesFinger", "Coriander", "CurryLeaves", "GreenChilli"];
  settle(v.children.slice().sort((a, b) => HEAP.indexOf(a.name) - HEAP.indexOf(b.name)), { tries: 30, spread: 0.08, bounds: drawerB, ceil: qabTop - 0.008 - 0.01 - vegFloor });
}
// butter, cheese and curd cups on the clear top tray, in front of the light unit
stock.fresh0(cab, { y: trayTop, z: 0.0 });

// ── freezer: the glass shelf, and the Movable Ice Maker standing on it at the left ──
{
  const z0 = zDuct + 0.002, z1 = frontFreezer, w = inW - 0.01;
  cab.add(box("FreezerShelf", w, 0.006, z1 - 0.006 - z0, glass, 0, fzShelfTop - 0.003, (z0 + z1 - 0.006) / 2));
  cab.add(box("FreezerShelfEdge", w, 0.008, 0.006, glassEdge, 0, fzShelfTop - 0.004, z1 - 0.003));
  rails("FreezerShelfRail", fzShelfTop - 0.006, zIn, z1 - 0.01);
}
// the ice maker: 170 mm wide and 130 mm tall (open photo, ESTIMATED), its two twist trays on top behind a white face with
// their round grips, the blue-tinted ice box under them with "Movable Ice Maker" across it
const icX = -0.13, icW = 0.17, icH = 0.13, icD = 0.2, icZ1 = frontFreezer - 0.01, icZ0 = icZ1 - icD;
const ice = group("IceMaker", icX, fzShelfTop, 0);
{
  const zc = (icZ0 + icZ1) / 2, upH = 0.06, binH = icH - upH;
  ice.add(box("IceTrayHousing", icW, upH, icD, iceWhite, 0, binH + upH / 2, zc));
  for (const sx of [-1, 1]) {
    const k = mesh("TwistGrip", new THREE.CylinderGeometry(0.022, 0.022, 0.008, 20), iceWhite, sx * 0.04, binH + upH / 2, icZ1 + 0.004);
    k.rotation.x = Math.PI / 2; ice.add(k);
  }
  const bw = icW - 0.006, bd = icD - 0.01, bz = icZ1 - bd / 2;
  ice.add(box("IceBinFloor", bw, 0.004, bd, iceBin, 0, 0.002, bz));
  ice.add(box("IceBinFront", bw, binH - 0.002, 0.004, iceBin, 0, binH / 2, icZ1 - 0.002));
  for (const sx of [-1, 1]) ice.add(box("IceBinSide", 0.004, binH - 0.002, bd, iceBin, sx * (bw / 2 - 0.002), binH / 2, bz));
  ice.add(mesh("PrintIceMaker", flipV(new THREE.PlaneGeometry(0.072, 0.01)), printIce, 0, binH * 0.62, icZ1 + 0.0006));
  const cube = new THREE.BoxGeometry(0.026, 0.022, 0.026);
  for (let i = 0; i < 8; i++) {
    const c = mesh("IceCube", cube, iceCube, -0.05 + (i % 4) * 0.033, 0.016 + Math.floor(i / 4) * 0.018, icZ1 - 0.04 - (i % 3) * 0.04);
    c.rotation.set(0.2 * (i % 3), 0.5 * i, 0.15 * (i % 4));
    ice.add(c);
  }
}
cab.add(ice);
// the freezer's food: the ice-cream tubs and standing packs on the glass shelf behind the ice maker (the room under the
// shelf is 137 mm, too low for the two tubs), three packs lying on the freezer's floor under it
stock.freezer(cab, { fit: true, zIn1: zIn, floor: fzShelfTop + 0.0005, top: fzFloor, box: { hw: inW / 2 - 0.03, z0: zDuct + 0.02, z1: icZ0 - 0.01 } });

// ── doors: hinged on the right; the photo-textured front, the edges, a grip pocket in the free edge (the left) ──
const pw = W - 0.002, bw = pw - 0.12;
const inside = (dep) => [-pw / 2 - bw / 2 + 0.004, -pw / 2 + bw / 2 - 0.004, -(linerFace + dep / 2)];
const xHinge = -pw / 2 + bw / 2 - 0.004;
const EGGS = [0, 1, 2, 3, 4, 5].map((i) => xHinge - 0.03 - i * 0.05);   // a row of six from the hinge end (Godrej's stocked photo)
function door(name, y0, h, frontMat) {
  const pivot = group(name, W / 2, y0, zFront);
  pivot.add(mesh(name + "Panel", flipV(new THREE.BoxGeometry(pw, h, doorT)), [doorEdge, doorEdge, doorEdge, doorEdge, frontMat, liner], -pw / 2, h / 2, doorT / 2));
  if (name === "FreezerDoor") {
    // the Godrej script, 70 mm wide, centred, its middle 80 mm under the top (front photo)
    pivot.add(mesh("GodrejLogoDecal", flipV(new THREE.PlaneGeometry(0.07, 0.07 * 234 / 512)), logoM, -pw / 2 + 0.002, h - 0.08, doorT + 0.0006));
  }
  // grip pocket in the free edge (Godrej's stocked photo and the 3/4 view): the freezer's 258 mm long, ending 20 mm above its
  // bottom; the fridge's 251 mm, from 121 mm under its top; 14 mm wide and 22 mm deep (ESTIMATED). It is the edge's own colour
  // a shade darker: Godrej's 3/4 photos show no dark slot in the edge
  const rh = name === "FreezerDoor" ? 0.258 : 0.251;
  const ry = name === "FreezerDoor" ? 0.02 + rh / 2 : h - 0.121 - rh / 2;
  const pocket = mesh(name + "Grip", new THREE.CapsuleGeometry(0.007, rh - 0.014, 4, 8), grip, -pw + 0.0045, ry, doorT * 0.5);
  pocket.scale.z = 0.022 / 0.014;
  pivot.add(pocket);
  // inside: gasket, liner and bins standing on the liner's face
  pivot.add(box(name + "Gasket", pw - 0.018, h - 0.018, 0.008, gasket, -pw / 2, h / 2, -0.004));
  pivot.add(box(name + "Liner", pw - 0.07, h - 0.07, 0.012, liner, -pw / 2, h / 2, -0.01));
  BINS[name].forEach((b, i) => {
    const w = b.small ? 0.3 : bw, cx = b.small ? -pw * 0.66 : -pw / 2;
    const zc = -linerFace - b.d / 2, zl = -linerFace - b.d;
    pivot.add(box(`${name}Bin${i}Floor`, w, 0.004, b.d, binMat, cx, b.f + 0.002, zc));
    pivot.add(box(`${name}Bin${i}Lip`, w, b.h - 0.004, 0.004, b.label ? frosted : binMat, cx, b.f + (b.h - 0.004) / 2, zl + 0.002));
    for (const sx of [-1, 1]) pivot.add(box(`${name}Bin${i}End`, 0.004, b.h + (b.label ? 0 : 0.012), b.d, binMat, cx + sx * (w / 2 - 0.002), b.f + (b.h + (b.label ? 0 : 0.012)) / 2, zc));
    if (b.label) {   // "Utility Shelf" at the free-edge end of the lip, facing the room when the door is open
      const p = mesh("PrintUtility", flipV(new THREE.PlaneGeometry(0.046, 0.009)), printUtil, cx - w / 2 + 0.04, b.f + b.h - 0.018, zl - 0.0006);
      p.rotation.y = Math.PI; pivot.add(p);
    }
    if (b.eggs) for (const x of EGGS) { const c = mesh("EggCup", new THREE.SphereGeometry(0.02, 12, 4, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), binMat, x, b.f, zc); c.scale.y = 0.7; pivot.add(c); }
  });
  if (name === "FridgeDoor") {
    // the liner's dimpled lower panel under the bottle bin (open photo)
    const dh = BINS.FridgeDoor[0].f - 0.05;
    pivot.add(mesh("DimplePanel", flipV(new THREE.PlaneGeometry(pw - 0.09, dh)), dimples, -pw / 2, 0.04 + dh / 2, -0.0166));
    pivot.children[pivot.children.length - 1].rotation.y = Math.PI;
    // the round stop at the top of the free edge, 57 mm under the door's top (3/4 photo)
    const dot = mesh("EdgeStop", new THREE.CylinderGeometry(0.005, 0.005, 0.003, 12), screw, -pw - 0.0005, h - 0.057, doorT * 0.5);
    dot.rotation.z = Math.PI / 2; pivot.add(dot);
  }
  return pivot;
}
const fridgeDoor = door("FridgeDoor", doorBottom, fridgeH, fridgeFront);
const freezerDoor = door("FreezerDoor", yFreezer, freezerH, freezerFront);
{ // what sits in the door bins, so it swings out with the door
  const F = BINS.FridgeDoor, Z = BINS.FreezerDoor;
  stock.doorFridge(fridgeDoor, { fit: true, eggY: F[3].f, eggX: EGGS, eggDY: 0, eggTurn: Math.PI / 2, jarY: F[1].f, botY: F[0].f, canY: null, deps: { egg: F[3].d, jar: F[1].d, bottle: F[0].d }, inside });
  stock.doorFreezer(freezerDoor, { fit: true, b1: Z[1].f, b2: Z[0].f, dep: Math.min(Z[0].d, Z[1].d), inside });
  // the three cartons in the bottle bin stand a little askew, as packs do. Square to the door, a carton's side 3 cm off
  // the middle was edge-on to the straight-on camera, and headless Chrome's software renderer (SwiftShader) let that
  // 0.1 px sliver through the shut door as a thin light line; the Mac's GPU draws it correctly. Their sides are seen
  // 0.3-2.3 deg off-axis from that camera, so the turn is 5 deg, well clear of edge-on (a 2 deg turn made another sliver)
  for (const [n, deg] of [["RealMango", 5], ["RealMixedFruit", -5], ["AmulTaaza", 5]]) {
    const o = fridgeDoor.getObjectByName(n);
    if (o) o.rotation.y += (deg * Math.PI) / 180;
  }
}
root.add(fridgeDoor, freezerDoor);

const parts = productParts(PRODUCTS, ID);
const clips = stateClips(root, parts);
saveZones(PRODUCTS, ID, root, parts);
// Grain: the Matt Black is a textured low-sheen finish (its photos show a fine pebble on the doors): the peel map on the
// doors, the soft peel on the painted sides and top. The prints are their own decals, no grain.
await exportGLB(root, clips, OUT, {
  FreezerFront: `${T}/door_${F0.key}_fz.jpg`,
  FridgeFront: `${T}/door_${F0.key}_fr.jpg`,
  GodrejLogo: `${T}/${F0.logo}`,
  ControlPanel: `${T}/panel.png`,
  BackFreezer: `${T}/back_freezer.png`,
  DuctFridge: `${T}/duct_fridge.png`,
  PrintQab: `${T}/print_qab.png`,
  PrintUtility: `${T}/print_utility.png`,
  PrintIceMaker: `${T}/print_icemaker.png`,
  LinerDimples: `${T}/liner_dimples.jpg`,
  ...stock.textures(),
}, { dir: `${TEX}/grain`, materials: {
  FreezerFront: { type: F0.door.grain },
  FridgeFront: { type: F0.door.grain },
  SidePaint: { type: "peel_soft" }, TopSkin: { type: "peel_soft" },
} });

// ── the other colours as material variants: each colour's own door photos, finish, grain, sides, edges and logo ink ──
{
  const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
  const doc = await io.readBinary(new Uint8Array(fs.readFileSync(OUT)));
  const ext = doc.createExtension(KHRMaterialsVariants);
  const vs = FINISHES.map((f) => ext.createVariant(f.name));
  const mats = doc.getRoot().listMaterials(), texs = new Map();
  // a texture per file, once; the grain maps the base export already holds (named grain_<file>) are reused
  const tex = (file) => {
    if (!texs.has(file)) {
      const stem = file.split("/").pop().replace(/\.\w+$/, ""), name = file.includes("/grain/") ? `grain_${stem}` : stem;
      texs.set(file, doc.getRoot().listTextures().find((t) => t.getName() === name) || doc.createTexture(name)
        .setImage(new Uint8Array(fs.readFileSync(file))).setMimeType(file.endsWith(".png") ? "image/png" : "image/jpeg"));
    }
    return texs.get(file);
  };
  const lin = (hex) => [(hex >> 16) & 255, (hex >> 8) & 255, hex & 255].map((c) => { c /= 255; return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; });
  // what each colour changes on each material
  const change = (f) => ({
    FreezerFront: { image: `${T}/door_${f.key}_fz.jpg`, ...f.door },
    FridgeFront: { image: `${T}/door_${f.key}_fr.jpg`, ...f.door },
    SidePaint: { color: f.side }, TopSkin: { color: f.top }, DoorEdge: f.edge, Grip: { color: f.grip },
    GodrejLogo: { image: `${T}/${f.logo}` },
  });
  const alt = {};
  let coatExt = null;
  for (const name of Object.keys(change(F0))) {
    const base = mats.find((m) => m.getName() === name);
    if (!base) throw new Error(`no material ${name}`);
    alt[name] = FINISHES.map((f, i) => {
      if (i === 0) return base;
      const c = change(f)[name], m = base.clone().setName(`${name}_${f.key}`);
      if (c.image && c.image !== change(F0)[name].image) m.setBaseColorTexture(tex(c.image));   // the same file: the base's own texture
      if (c.color != null) m.setBaseColorFactor([...lin(c.color), 1]);
      if (c.rough != null) m.setRoughnessFactor(c.rough).setMetallicFactor(c.metal);
      if (c.grain) {
        const g = GRAIN[c.grain];
        m.setNormalTexture(tex(`${TEX}/grain/${g.normal}`)); m.getNormalTextureInfo().setTexCoord(1);
        if (g.rough) { m.setMetallicRoughnessTexture(tex(`${TEX}/grain/${g.rough}`)); m.getMetallicRoughnessTextureInfo().setTexCoord(1); }
        else m.setMetallicRoughnessTexture(null);
      } else if (c.grain === null) { m.setNormalTexture(null); m.setMetallicRoughnessTexture(null); }
      if (c.coat) {
        coatExt ||= doc.createExtension(KHRMaterialsClearcoat);
        m.setExtension("KHR_materials_clearcoat", coatExt.createClearcoat().setClearcoatFactor(c.coat[0]).setClearcoatRoughnessFactor(c.coat[1]));
      }
      return m;
    });
  }
  for (const m of doc.getRoot().listMeshes()) for (const p of m.listPrimitives()) {
    const list0 = alt[p.getMaterial()?.getName()];
    if (!list0) continue;
    const list = ext.createMappingList();
    list0.forEach((mm, i) => list.addMapping(ext.createMapping().setMaterial(mm).addVariant(vs[i])));
    p.setExtension("KHR_materials_variants", list);
  }
  fs.writeFileSync(OUT, await io.writeBinary(doc));
  console.log(OUT, (fs.statSync(OUT).size / 1048576).toFixed(2) + " MB with", FINISHES.length, "colours");
}
