// Godrej RT EONREGALIS 477AN RCI (Eon Regalis, 436 L, 1 star), double door, frost free, in Godrej's two colours: Matt
// Black (RT EONREGALIS 477AN RCI MT BK, first) and Champagne Gold (... CH GD), as material variants (KHR_materials_variants)
// of the one model.
// Built to Godrej's published size, 737.5 W x 1730 H x 739 D mm ("1.73m X 73.75cmX 73.9cm"), and Godrej's own photos of the
// two codes (straight front and 3/4 of each; the Matt Black with both doors open, empty and stocked). Godrej's photos show
// a body about 1.85 m tall (the 472 L Regalis): the freezer door is the same 510 mm on every front, so the heights from the
// cabinet's top down to the freezer's floor are taken at the photo's own scale and those under it are fitted to the 436 L's
// published height (NOTES.md). Freezer on top, fridge below, both doors hinged on the right, a grey grip insert in each
// door's free edge (the left), the Godrej script and the display with its Nano Shield badge on the freezer door, and the
// slatted vent on the lower back of each side.
// Inside, as the open-door photo shows it: in the freezer the vented back panel, a glass shelf and the Movable Ice Maker on
// the floor at the right; in the fridge the Cool Shower light unit and duct, a clear top tray, three toughened-glass
// shelves ("Number of Shelves 3", the top one the Easy Slide Shelf in its clear frame), the vegetable tray's grid cover and
// the 38 L "Farm Fresh" tray; two bins on the freezer door and four on the fridge door (the egg tray in the top one).
// Godrej publishes no manual, rear photo or clearances for this code: the back is plain, and every inside size is
// ESTIMATED from the open-door photo (NOTES.md).
// Moving parts: freezer door, the ice maker ("Move or even remove the ice maker as needed"), fridge door, and the trays
// (the three glass shelves, the cover and the vegetable tray, with their food).
// For another Godrej Eon fridge: the sizes are all in the "size" block, the colours in FINISHES; the texture folder T.
// usage: node make_godrej_eon477.mjs <entry .json, never products.json> <tex dir> <out.glb>
import fs from "node:fs";
import { NodeIO } from "@gltf-transform/core";
import { ALL_EXTENSIONS, KHRMaterialsVariants, KHRMaterialsClearcoat } from "@gltf-transform/extensions";
import { LGStock } from "./stock_lg.mjs";
import { THREE, mat, mesh, box, faced, group, stateClips, exportGLB, productParts, saveZones, GRAIN } from "./lib.mjs";

const [PRODUCTS, TEX, OUT] = process.argv.slice(2);
const ID = "godrej-rt-eonregalis-477an-rci-mt-bk";
const T = `${TEX}/godrej_eon477`;

// ── the colours: the first is the model's own materials, the others are variants of the materials named here ──
// door: the photo texture of each colour's straight front (tex_godrej_eon477.py), its roughness, metalness and grain;
// side, top: the cabinet's painted sides and top as each colour's 3/4 photo shows them (sRGB); edge: the doors' edges;
// display: the display's frame (dark on the Matt Black, bright silver on the Champagne Gold: Godrej's fronts)
const FINISHES = [
  { name: "Matt Black", key: "mtbk", door: { rough: 0.62, metal: 0, grain: "peel" }, side: 0x3e3f44, top: 0x37383c,
    edge: { color: 0x2b2c30, rough: 0.6, metal: 0 }, display: "display_mtbk.png" },
  { name: "Champagne Gold", key: "chgd", door: { rough: 0.36, metal: 0.3, grain: "hairline_soft" }, side: 0x777571, top: 0x6e6c68,
    edge: { color: 0x8c8985, rough: 0.45, metal: 0.2 }, display: "display_chgd.png" },
];
const F0 = FINISHES[0];

// ── size (metres) ──
const W = 0.7375, H = 1.73, D = 0.739;                  // Godrej: 1.73m X 73.75cm X 73.9cm
const doorT = 0.058, Dc = D - doorT;                    // the door 58 mm thick (ESTIMATED, as the Eon Vibe's)
const zBack = -D / 2, zFront = zBack + Dc;
const wall = 0.045, backT = 0.045, topT = 0.028;         // side walls and back (ESTIMATED), the top frame over the freezer's opening (open photo)
const feet = 0.037, floorTop = 0.0935;                  // the feet under the doors (both fronts); the fridge floor's front edge (open photo)
// doors (the open photo's free edges: 221 px freezer, 5 px gap, 507 px fridge, fitted to 37-1730 mm): the fridge door
// from 37 mm to 1208 mm, the freezer door from 1220 mm to the top (510 mm, as on both fronts at 0.401 px per mm)
const doorBottom = 0.037, gap = 0.012, yFreezer = 1.22;
const freezerH = H - yFreezer, fridgeH = yFreezer - gap - doorBottom, yDiv = yFreezer - gap / 2;
// heights inside, ESTIMATED from the open-door photo: from the top to the mullion at 0.3847 px per mm (the freezer door's
// gap on the mullion's middle), under it at 0.4073 px per mm (down to the feet at the published height)
const fzTop = H - topT;                                 // the freezer's ceiling (1702 mm)
const fzCeil = 1.169, fzFloor = 1.259;                  // the mullion: fridge ceiling and freezer floor
const fzShelfTop = 1.439;                               // the freezer's glass shelf
const trayTop = 1.050;                                  // the clear top tray under the Cool Shower light unit
const esTop = 0.911, esRail = 0.03, esWall = 0.03;      // the Easy Slide Shelf: its glass, the frosted front rail under it, the clear walls over it
const sB = 0.727, sC = 0.535;                           // the other two glass shelves
const coverTop = 0.372, vegTop = 0.349, vegBottom = 0.104; // the vegetable tray's grid cover (its front) and the "Farm Fresh" tray under it
const unitBottom = 1.083, unitW = 0.254;                // the light unit hangs from the ceiling, as wide as the duct
const ductTop = trayTop, ductBottom = 0.418;            // the Cool Shower duct runs down the back wall to the cover
// door bins, from the door's bottom edge (open photo, ESTIMATED): on the fridge door the low bin, the bottle bin, the jar
// bin and the top bin with the egg tray (measured 845 and 986 mm, +-5 mm: set 840 and 990 so the jar bin's tallest pouch
// clears the egg bin by 1 cm); on the freezer door two bins
const BINS = {
  FridgeDoor: [{ f: 0.067, h: 0.118, d: 0.10 }, { f: 0.333, h: 0.12, d: 0.11 }, { f: 0.84, h: 0.051, d: 0.095 }, { f: 0.99, h: 0.051, d: 0.095, eggs: true }],
  FreezerDoor: [{ f: 0.058, h: 0.06, d: 0.09 }, { f: 0.217, h: 0.062, d: 0.09 }],
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
const recess = mat("GripRecess", 0x161719, { rough: 0.7 });                // the pocket in the free edge
const insert = mat("GripInsert", 0xa9abae, { rough: 0.4, metal: 0.2 });   // its light grey insert (open photo: the free edges)
const logoM = mat("GodrejLogo", 0xffffff, { rough: 0.45, opacity: 0.999 });
const displayM = mat("Display", 0xffffff, { rough: 0.35, opacity: 0.999 });   // glass, but no mirror: the photos show it black from every angle
const grilleM = mat("SideGrille", 0xffffff, { rough: 0.6 });
const liner = mat("Liner", 0xe3e6e9, { rough: 0.72, emissive: 0x7d8186, emissiveIntensity: 0.55 });
const glass = mat("Glass", 0xcfe3ea, { rough: 0.05, opacity: 0.45 });
const glassEdge = mat("GlassEdge", 0x1d2124, { rough: 0.3 });              // the glass shelves' dark front edge (open photo)
const binMat = mat("Bin", 0xcfe0ea, { rough: 0.15, opacity: 0.62 });
const clearLite = mat("ClearLight", 0xdfe7ee, { rough: 0.12, opacity: 0.3, side: THREE.DoubleSide });
const frosted = mat("Frosted", 0xe9eef1, { rough: 0.45, opacity: 0.8 });
const coverM = mat("CoverGrid", 0xffffff, { rough: 0.5 });
const gasket = mat("Gasket", 0x2a2b2e, { rough: 0.85 });                    // black gaskets (open photo)
const light = mat("Light", 0xffffff, { emissive: 0xf4f8ff, emissiveIntensity: 1.4 });
const unitWhite = mat("UnitWhite", 0xf3f5f7, { rough: 0.45 });
const iceWhite = mat("IceMakerWhite", 0xeef1f4, { rough: 0.4 });
const iceBin = mat("IceBin", 0xd6e2ee, { rough: 0.15, opacity: 0.7 });     // the ice box's clear front (open photo)
const iceCube = mat("IceCube", 0xe3f4ff, { rough: 0.08, opacity: 0.72 });
const backFz = mat("BackFreezer", 0xffffff, { rough: 0.7 }), ductM = mat("DuctFridge", 0xffffff, { rough: 0.7 });
const printES = mat("PrintEasySlide", 0xffffff, { rough: 0.5, opacity: 0.999 }), printFF = mat("PrintFarmFresh", 0xffffff, { rough: 0.5, opacity: 0.999 });
const printIce = mat("PrintIceMaker", 0xffffff, { rough: 0.5, opacity: 0.999 });
const back = mat("Back", 0x2f3033, { rough: 0.8 });                         // the back: plain (no rear photo), dark (ESTIMATED)
const foot = mat("Foot", 0x17181a, { rough: 0.7 });
const hingeM = mat("Hinge", 0x232427, { metal: 0.4, rough: 0.45 });
const screw = mat("Screw", 0xb8bcc0, { metal: 0.9, rough: 0.3 });

const root = group("GodrejEonRegalis");
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
  cab.add(mesh("HingeScrew", new THREE.CylinderGeometry(0.004, 0.004, 0.002, 10), screw, x, yDiv + gap / 2 - 0.001, z));
}
// feet: four black levelling feet, 37 mm (both fronts)
for (const [fx, fz] of [[-1, 1], [1, 1], [-1, -1], [1, -1]]) {
  cab.add(mesh("Foot", new THREE.CylinderGeometry(0.015, 0.018, feet, 18), foot, fx * (W / 2 - 0.04), feet / 2, fz > 0 ? zFront - 0.04 : zBack + 0.05));
}
// the slatted vent on the lower back of each side, 120 x 135 mm, 15 mm from the back and 37 mm above the cabinet's bottom
// (the 3/4 photos of both colours, ESTIMATED)
for (const sx of [-1, 1]) {
  const g = mesh("SideGrille", flipV(new THREE.PlaneGeometry(0.12, 0.135)), grilleM, sx * (W / 2 + 0.0004), feet + 0.037 + 0.0675, zBack + 0.015 + 0.06);
  g.rotation.y = sx * Math.PI / 2;
  cab.add(g);
}

// ── inside ──
const inW = W - 2 * wall - 0.006;                       // between the side ribs
const xIn = W / 2 - wall;
const zDuct = zIn + 0.012;                              // the front of the raised back panels
const rails = (name, yTop, z0, z1) => { for (const sx of [-1, 1]) cab.add(box(name, 0.008, 0.012, z1 - z0, liner, sx * (xIn - 0.004), yTop - 0.012, (z0 + z1) / 2)); };
// the freezer's back panel: raised 12 mm, 500 x 341 mm from the freezer's floor, with its vent slots (open photo)
cab.add(mesh("FreezerBackPanel", flipV(new THREE.BoxGeometry(0.5, 0.341, 0.012)), [liner, liner, liner, liner, backFz, liner], 0, fzFloor + 0.1705, zIn + 0.006));
// the fridge's Cool Shower duct down the middle of the back wall, and the light unit under the ceiling over it
cab.add(mesh("CoolShowerDuct", flipV(new THREE.BoxGeometry(unitW, ductTop - ductBottom, 0.012)), [liner, liner, liner, liner, ductM, liner], 0, (ductTop + ductBottom) / 2, zIn + 0.006));
{
  const uh = fzCeil - unitBottom, ud = 0.08, uz = zDuct + ud / 2;
  cab.add(box("LightUnit", unitW, uh, ud, unitWhite, 0, fzCeil - uh / 2, uz));
  cab.add(box("LightLens", unitW - 0.03, 0.012, 0.004, light, 0, unitBottom + 0.018, zDuct + ud + 0.002));
  for (const sx of [-1, 1]) {   // the two round windows in the unit's face (open photo)
    const s = mesh("UnitSensor", new THREE.CylinderGeometry(0.007, 0.007, 0.004, 16), recess, sx * 0.03, unitBottom + 0.05, zDuct + ud + 0.002);
    s.rotation.x = Math.PI / 2; cab.add(s);
  }
}
// the clear top tray across the fridge under the light unit, with its tall clear ends (open photo); it stays in
{
  const z0 = zDuct + 0.004, z1 = frontFridge, td = z1 - z0, tz = (z0 + z1) / 2, tw = inW - 0.01;
  cab.add(box("TopTrayFloor", tw, 0.004, td, binMat, 0, trayTop - 0.002, tz));
  for (const sx of [-1, 1]) cab.add(box("TopTrayEnd", 0.004, 0.1, td, clearLite, sx * (tw / 2 - 0.002), trayTop + 0.05, tz));
  cab.add(box("TopTrayRim", tw, 0.014, 0.006, frosted, 0, trayTop + 0.005, z1 - 0.003));
}

// the parts that come out (FridgeTrays): three glass shelves, the cover and the vegetable tray, with their food
const trays = group("FridgeTrays");
cab.add(trays);
function glassShelf(name, yTop) {                       // toughened glass with a dark front edge
  const z0 = zDuct + 0.002, z1 = frontFridge, w = inW - 0.01;
  trays.add(box(name, w, 0.006, z1 - 0.006 - z0, glass, 0, yTop - 0.003, (z0 + z1 - 0.006) / 2));
  trays.add(box(name + "Edge", w, 0.008, 0.006, glassEdge, 0, yTop - 0.004, z1 - 0.003));
  rails(name + "Rail", yTop - 0.006, zIn, z1 - 0.01);
}
// the Easy Slide Shelf: its glass in a clear frame with low walls at the back and the ends, and the frosted front rail
// under the glass with "Easy Slide Shelf" printed on it (open photo, Godrej's close-up)
{
  const z0 = zDuct + 0.002, z1 = frontFridge, w = inW - 0.01, d = z1 - 0.006 - z0, zc = (z0 + z1 - 0.006) / 2;
  trays.add(box("EasySlideGlass", w, 0.006, d, glass, 0, esTop - 0.003, zc));
  trays.add(box("EasySlideBack", w, esWall, 0.004, clearLite, 0, esTop + esWall / 2, z0 + 0.002));
  for (const sx of [-1, 1]) trays.add(box("EasySlideEnd", 0.004, esWall, d, clearLite, sx * (w / 2 - 0.002), esTop + esWall / 2, zc));
  trays.add(box("EasySlideRail", w, esRail, 0.008, frosted, 0, esTop - esRail / 2, z1 - 0.004));
  trays.add(mesh("PrintEasySlide", flipV(new THREE.PlaneGeometry(0.12, 0.013)), printES, 0, esTop - esRail / 2, z1 + 0.0006));
  rails("EasySlideRail", esTop - esRail, zIn, z1 - 0.01);
}
glassShelf("ShelfB", sB);
glassShelf("ShelfC", sC);
// the vegetable tray: one clear drawer, 38 litres (Godrej): 600 x 245 x 280 mm outside (ESTIMATED to that volume, as wide
// as the open photo shows it); behind it the step over the compressor (ESTIMATED: no photo shows the back)
const bbW = 0.6, bbZ1 = frontFridge, bbD = 0.28, bbZ0 = bbZ1 - bbD, bbZ = (bbZ0 + bbZ1) / 2;
cab.add(faced("CompressorStep", inW, 0.3 - floorTop, bbZ0 - 0.012 - zIn, [liner, liner, liner, liner, liner, liner], 0, (0.3 + floorTop) / 2, (zIn + bbZ0 - 0.012) / 2));
{
  const hh = vegTop - vegBottom;
  trays.add(box("FzBoxFloor", bbW, 0.004, bbD, binMat, 0, vegBottom + 0.002, bbZ));
  trays.add(box("FzBoxBack", bbW, hh, 0.004, binMat, 0, vegBottom + hh / 2, bbZ0 + 0.002));
  trays.add(box("FzBoxL", 0.004, hh, bbD, binMat, -bbW / 2 + 0.002, vegBottom + hh / 2, bbZ));
  trays.add(box("FzBoxR", 0.004, hh, bbD, binMat, bbW / 2 - 0.002, vegBottom + hh / 2, bbZ));
  trays.add(box("FzBoxFront", bbW, hh - 0.012, 0.004, clearLite, 0, vegBottom + (hh - 0.012) / 2, bbZ1 - 0.002));
  trays.add(box("FzBoxRim", bbW + 0.008, 0.012, 0.008, frosted, 0, vegTop - 0.006, bbZ1 - 0.002));
  // "Farm Fresh" across its front, its middle 255 mm above the floor (open photo)
  trays.add(mesh("PrintFarmFresh", flipV(new THREE.PlaneGeometry(0.132, 0.022)), printFF, 0.01, 0.255, bbZ1 + 0.0006));
}
// the cover over it: white with a grid of small holes, a frosted front edge and the clip in its middle (open photo)
{
  const z0 = zIn + 0.004, z1 = frontFridge, w = inW - 0.01;
  const top = new THREE.BoxGeometry(w, 0.008, z1 - z0);
  const uv = top.attributes.uv;   // the hole grid at 100 mm per tile on the top face
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * w / 0.1, uv.getY(i) * (z1 - z0) / 0.1);
  trays.add(mesh("CoverTop", top, [liner, liner, coverM, liner, liner, liner], 0, coverTop - 0.004, (z0 + z1) / 2));
  trays.add(box("CoverFront", w, coverTop - vegTop - 0.002, 0.008, frosted, 0, (coverTop + vegTop) / 2, z1 - 0.004));
  trays.add(box("CoverClip", 0.06, 0.012, 0.012, unitWhite, 0, coverTop - 0.012, z1 + 0.002));
  rails("CoverRail", coverTop - 0.008, zIn, z1 - 0.01);
}

// ── groceries (stock_lg.mjs, food.mjs): vegetarian South Indian food, eggs, juices, water and soft drinks ──
const stock = LGStock({ T3: `${TEX}/lg_glt3426`, TF: `${TEX}/food`, BR: `${TEX}/brands`, BRT: `${TEX}/brands/small` });
const vegFloor = vegBottom + 0.004;
// the tall things on the lowest shelf (the most room), the low ones on the Easy Slide Shelf, the fruit on the middle one
stock.shelves(trays, {
  zIn1: zIn, inW, inD: frontFridge - zIn, s1: sC - 0.0025, s2: esTop - 0.0025, s3: sB - 0.0025, fz: vegFloor, fit: true,
  vz0: bbZ0 + 0.02, vk: 0.8 * (bbD - 0.04) / 0.454,
  shelfB: { hw: inW / 2 - 0.03, z0: zDuct + 0.02, z1: frontFridge - 0.015 },
  drawerB: { hw: bbW / 2 - 0.014, z0: bbZ0 + 0.02, z1: bbZ1 - 0.008, y0: vegFloor },
  drawerCeil: coverTop - 0.008 - 0.01 - vegFloor,        // the heap stays 1 cm under the cover
});
// The vegetable tray is 28 cm deep (it stops at the compressor's step), so the 34 cm drumsticks lie across it at the back
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
  settle(v.children.slice().sort((a, b) => HEAP.indexOf(a.name) - HEAP.indexOf(b.name)), { tries: 30, spread: 0.08, bounds: drawerB, ceil: coverTop - 0.008 - 0.01 - vegFloor });
}
// butter, cheese and curd cups on the clear top tray, in front of the light unit
stock.fresh0(cab, { y: trayTop, z: 0.0 });

// ── freezer: the glass shelf, and the Movable Ice Maker on the floor at the right ──
{
  const z0 = zDuct + 0.002, z1 = frontFreezer, w = inW - 0.01;
  cab.add(box("FreezerShelf", w, 0.006, z1 - 0.006 - z0, glass, 0, fzShelfTop - 0.003, (z0 + z1 - 0.006) / 2));
  cab.add(box("FreezerShelfEdge", w, 0.008, 0.006, glassEdge, 0, fzShelfTop - 0.004, z1 - 0.003));
  rails("FreezerShelfRail", fzShelfTop - 0.006, zIn, z1 - 0.01);
}
// the ice maker (open photo, ESTIMATED): 286 mm wide and 141 mm tall, its middle 132 mm right of the cabinet's; at its left
// a 51 mm column with the round dial, then the white housing of the two twist trays with their round grips over the clear
// ice box with "Movable Ice Maker" across it
const icX = 0.132, icW = 0.286, icH = 0.141, icD = 0.2, icZ1 = frontFreezer - 0.01, icZ0 = icZ1 - icD;
const ice = group("IceMaker", icX, fzFloor, 0);
{
  const zc = (icZ0 + icZ1) / 2, upH = 0.073, binH = icH - upH, dialW = 0.051, tw = icW - dialW, tx = dialW / 2;
  ice.add(box("IceDialColumn", dialW, icH, icD, iceWhite, -icW / 2 + dialW / 2, icH / 2, zc));
  const dial = mesh("IceDial", new THREE.CylinderGeometry(0.012, 0.012, 0.006, 20), iceWhite, -icW / 2 + dialW / 2, icH * 0.38, icZ1 + 0.003);
  dial.rotation.x = Math.PI / 2; ice.add(dial);
  ice.add(box("IceDialMark", 0.002, 0.008, 0.002, recess, -icW / 2 + dialW / 2, icH * 0.38 + 0.006, icZ1 + 0.0065));
  ice.add(box("IceTrayHousing", tw, upH, icD, iceWhite, tx, binH + upH / 2, zc));
  for (const sx of [-1, 1]) {
    const k = mesh("TwistGrip", new THREE.CylinderGeometry(0.022, 0.022, 0.008, 20), iceWhite, tx + sx * 0.061, binH + upH / 2, icZ1 + 0.004);
    k.rotation.x = Math.PI / 2; ice.add(k);
  }
  const bw = tw - 0.006, bd = icD - 0.01, bz = icZ1 - bd / 2;
  ice.add(box("IceBinFloor", bw, 0.004, bd, iceBin, tx, 0.002, bz));
  ice.add(box("IceBinFront", bw, binH - 0.002, 0.004, iceBin, tx, binH / 2, icZ1 - 0.002));
  for (const sx of [-1, 1]) ice.add(box("IceBinSide", 0.004, binH - 0.002, bd, iceBin, tx + sx * (bw / 2 - 0.002), binH / 2, bz));
  ice.add(mesh("PrintIceMaker", flipV(new THREE.PlaneGeometry(0.11, 0.012)), printIce, tx, binH * 0.7, icZ1 + 0.0006));
  const cube = new THREE.BoxGeometry(0.026, 0.022, 0.026);
  for (let i = 0; i < 10; i++) {
    const c = mesh("IceCube", cube, iceCube, tx - 0.09 + (i % 5) * 0.045, 0.016 + Math.floor(i / 5) * 0.018, icZ1 - 0.05 - (i % 3) * 0.045);
    c.rotation.set(0.2 * (i % 3), 0.5 * i, 0.15 * (i % 4));
    ice.add(c);
  }
}
cab.add(ice);
// the freezer's food: the ice-cream tubs and standing packs on the glass shelf (262 mm under the ceiling), three packs lying
// on the freezer's floor behind the ice maker
stock.freezer(cab, { fit: true, zIn1: zIn, floor: fzShelfTop + 0.0005, top: fzFloor, box: { hw: inW / 2 - 0.03, z0: zDuct + 0.02, z1: icZ0 - 0.01 } });
// stock_lg.mjs lays the three packs in two rows across the whole floor, where the ice maker stands: here they lie in one
// row behind it, left to right, and are dropped again
{
  const t = cab.getObjectByName("OnFreezerShelf"), items = t.children.slice(), zc = (zDuct + 0.02 + icZ0 - 0.01) / 2;
  let x = -(inW / 2 - 0.03);
  for (const o of items) {
    const m = measure(o);
    o.position.x += x - m.min.x; o.position.z += zc - (m.min.z + m.max.z) / 2;
    x += m.max.x - m.min.x + 0.012;
  }
  if (x - 0.012 > inW / 2 - 0.03) console.warn(`freezer floor: the packs need ${((x - 0.012 + inW / 2 - 0.03) * 1000).toFixed(0)} mm across`);
  settle(items);
}

// ── doors: hinged on the right; the photo-textured front, the edges, the grip in the free edge (the left) ──
const pw = W - 0.002, bw = pw - 0.12;
const inside = (dep) => [-pw / 2 - bw / 2 + 0.004, -pw / 2 + bw / 2 - 0.004, -(linerFace + dep / 2)];
const xHinge = -pw / 2 + bw / 2 - 0.004;
const EGGS = [0, 1, 2, 3, 4, 5].map((i) => xHinge - 0.03 - i * 0.05);   // the egg tray at the hinge end of the top bin (open photo)
function door(name, y0, h, frontMat) {
  const pivot = group(name, W / 2, y0, zFront);
  pivot.add(mesh(name + "Panel", flipV(new THREE.BoxGeometry(pw, h, doorT)), [doorEdge, doorEdge, doorEdge, doorEdge, frontMat, liner], -pw / 2, h / 2, doorT / 2));
  if (name === "FreezerDoor") {
    // the Godrej script, 70 mm wide, centred, its middle 92 mm under the top; the display 78 x 148 mm, its top 160 mm under
    // the top (both fronts)
    pivot.add(mesh("GodrejLogoDecal", flipV(new THREE.PlaneGeometry(0.07, 0.07 * 234 / 512)), logoM, -pw / 2, h - 0.092, doorT + 0.0006));
    pivot.add(mesh("DisplayPanel", flipV(new THREE.PlaneGeometry(0.078, 0.148)), displayM, -pw / 2, h - 0.16 - 0.074, doorT + 0.0008));
  }
  // the grip in the free edge (open photo, the free edges at 0.433 px per mm): a dark pocket with a light grey insert, the
  // freezer's 245 mm long ending 32 mm above its bottom, the fridge's 240 mm from 99 mm under its top (ESTIMATED depth)
  const rh = name === "FreezerDoor" ? 0.245 : 0.24;
  const ry = name === "FreezerDoor" ? 0.032 + rh / 2 : h - 0.099 - rh / 2;
  const pocket = mesh(name + "GripPocket", new THREE.CapsuleGeometry(0.007, rh, 4, 8), recess, -pw + 0.0045, ry, doorT * 0.5);
  pocket.scale.z = 0.022 / 0.014;
  pivot.add(pocket);
  const bar = mesh(name + "GripInsert", new THREE.CapsuleGeometry(0.004, rh - 0.008, 4, 8), insert, -pw + 0.0035, ry, doorT * 0.5);   // its face 0.5 mm out of the edge
  bar.scale.z = 0.016 / 0.008;
  pivot.add(bar);
  // inside: gasket, liner and bins standing on the liner's face
  pivot.add(box(name + "Gasket", pw - 0.018, h - 0.018, 0.008, gasket, -pw / 2, h / 2, -0.004));
  pivot.add(box(name + "Liner", pw - 0.07, h - 0.07, 0.012, liner, -pw / 2, h / 2, -0.01));
  BINS[name].forEach((b, i) => {
    const w = bw, cx = -pw / 2;
    const zc = -linerFace - b.d / 2, zl = -linerFace - b.d;
    pivot.add(box(`${name}Bin${i}Floor`, w, 0.004, b.d, binMat, cx, b.f + 0.002, zc));
    pivot.add(box(`${name}Bin${i}Lip`, w, b.h - 0.004, 0.004, binMat, cx, b.f + (b.h - 0.004) / 2, zl + 0.002));
    for (const sx of [-1, 1]) pivot.add(box(`${name}Bin${i}End`, 0.004, b.h + 0.012, b.d, binMat, cx + sx * (w / 2 - 0.002), b.f + (b.h + 0.012) / 2, zc));
    // the egg tray's cups: hollows standing in the bin, their bottoms on its floor
    if (b.eggs) for (const x of EGGS) { const c = mesh("EggCup", new THREE.SphereGeometry(0.02, 12, 4, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), binMat, x, b.f + 0.018, zc); c.scale.y = 0.7; pivot.add(c); }
  });
  if (name === "FridgeDoor") {
    // the round stop at the top of the free edge, 44 mm under the door's top (open photo)
    const dot = mesh("EdgeStop", new THREE.CylinderGeometry(0.005, 0.005, 0.003, 12), screw, -pw - 0.0005, h - 0.044, doorT * 0.5);
    dot.rotation.z = Math.PI / 2; pivot.add(dot);
  }
  return pivot;
}
const fridgeDoor = door("FridgeDoor", doorBottom, fridgeH, fridgeFront);
const freezerDoor = door("FreezerDoor", yFreezer, freezerH, freezerFront);
{ // what sits in the door bins, so it swings out with the door
  const F = BINS.FridgeDoor, Z = BINS.FreezerDoor;
  stock.doorFridge(fridgeDoor, { fit: true, eggY: F[3].f, eggX: EGGS, eggDY: 0.006, eggTurn: Math.PI / 2, jarY: F[2].f, botY: F[1].f, canY: F[0].f,
    deps: { egg: F[3].d, jar: F[2].d, bottle: F[1].d, can: F[0].d }, inside });
  stock.doorFreezer(freezerDoor, { fit: true, b1: Z[1].f, b2: Z[0].f, dep: Math.min(Z[0].d, Z[1].d), inside });
}
root.add(fridgeDoor, freezerDoor);

const parts = productParts(PRODUCTS, ID);
const clips = stateClips(root, parts);
saveZones(PRODUCTS, ID, root, parts);
// Grain: the Matt Black is a textured low-sheen finish: the peel map on the doors, the soft peel on the painted sides and
// top. The prints, the display and the logo are their own decals, no grain.
await exportGLB(root, clips, OUT, {
  FreezerFront: `${T}/door_${F0.key}_fz.jpg`,
  FridgeFront: `${T}/door_${F0.key}_fr.jpg`,
  GodrejLogo: `${T}/logo_light.png`,
  Display: `${T}/${F0.display}`,
  SideGrille: `${T}/side_grille.png`,
  BackFreezer: `${T}/back_freezer.png`,
  DuctFridge: `${T}/duct_fridge.png`,
  CoverGrid: `${T}/cover_grid.png`,
  PrintEasySlide: `${T}/print_easyslide.png`,
  PrintFarmFresh: `${T}/print_farmfresh.png`,
  PrintIceMaker: `${T}/print_icemaker.png`,
  ...stock.textures(),
}, { dir: `${TEX}/grain`, materials: {
  FreezerFront: { type: F0.door.grain },
  FridgeFront: { type: F0.door.grain },
  SidePaint: { type: "peel_soft" }, TopSkin: { type: "peel_soft" },
} });

// ── the other colours as material variants: each colour's own door photos, finish, grain, sides, edges and display ──
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
    SidePaint: { color: f.side }, TopSkin: { color: f.top }, DoorEdge: f.edge,
    Display: { image: `${T}/${f.display}` },
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
      }
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
