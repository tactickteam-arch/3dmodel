// Haier HRB-3152PMG-P, 265 L frost-free bottom-mount double door with glass doors, in Mirror Glass (the code Sangeetha's
// listing 21338 sells, the default) and Black Glass (HRB-3152PKG-P, listing 21323: Haier gives it the same size, weight,
// energy figure and parts), the two colours as material variants. Built to Haier's published size, 548 W x 1685 H x
// 615 D mm (Haier India's page, "548x615x1685", W x D x H; Sangeetha 54.8 x 61.5 x 168.5 cm), and to Haier's own gallery
// of each colour: the straight-on front (the two flat glass doors, the Haier wordmark, CONVERTIBLE, the gap between the
// doors, the feet and the hinges), the two 3/4 views (the dark sides, the doors' silver edge and the recess grooves down
// the left side of each door), the open-door photo empty and stocked (every shelf, box and print inside) and the back.
// Haier's photos of this fridge are drawn about 10 % wider than its published size (0.36 wide for tall against 0.325, on
// every HRB-3152 photo), so heights are read up the photos and places across as fractions of the width (private NOTES.md).
// The fridge is on top and the freezer underneath, each behind a door hinged on the right. Four parts: the fridge door,
// the fridge's trays (the three glass shelves, the FRUITBOX, the cover and the 2XBIGBOX, with their food), the freezer
// door and the FREEZEBOX drawer. Haier publishes no manual, door swing or clearances: the doors' 125 degrees and every
// inside height are ESTIMATED from the open-door photos.
// Stocked for a south Indian kitchen (stock_lg.mjs, fit: true); the fruit goes in the FRUITBOX, as Haier's stocked photo.
// usage: node make_haier_hrb3152.mjs <entry .json, never products.json> <tex dir> <out.glb>
import fs from "node:fs";
import { NodeIO } from "@gltf-transform/core";
import { ALL_EXTENSIONS, KHRMaterialsVariants, KHRMaterialsClearcoat } from "@gltf-transform/extensions";
import { LGStock } from "./stock_lg.mjs";
import { THREE, mat, mesh, box, faced, group, flipV, stateClips, exportGLB, productParts, saveZones } from "./lib.mjs";

const [PRODUCTS, TEX, OUT] = process.argv.slice(2);
const ID = "haier-hrb-3152pmg-p";
const T = `${TEX}/haier_hrb3152`;

// ── size (metres): Haier's 548 x 1685 x 615 mm ──
const W = 0.548, H = 1.685, D = 0.615;
const doorT = 0.075, Dc = D - doorT;                 // door thickness ESTIMATED (3/4 photos: the doors' silver band)
const zBack = -D / 2, zFront = zBack + Dc;
const wall = 0.03, backT = 0.05;                      // side walls and the back's insulation (ESTIMATED)
// heights on Haier's straight-on front (0.529 px per mm up; top row 153, floor row 1044)
const base = 0.045;                                   // the cabinet's underside, at the freezer door's bottom edge
const cabTop = H;                                     // the doors and the cabinet's top are flush (3/4 photos)
const frBot = 0.703, frTop = H;                       // the fridge door, 703-1685 mm
const fzTop = 0.692;                                  // the freezer door, 45-692 mm: the dark gap between them, rows 672-677,
                                                      // is 11 mm, its middle 698 mm up
// the recess grooves down each door's left side (3/4 photo: fridge door 101-586 mm above its bottom edge, freezer door
// 266-545 mm above its own; about 0.4 of the door's thickness across; their depth ESTIMATED)
const GRIP_FR = { y0: 0.101, y1: 0.586, w: 0.03, d: 0.02 };
const GRIP_FZ = { y0: 0.266, y1: 0.545, w: 0.03, d: 0.02 };
// inside heights, ESTIMATED from Haier's open-door photo (0.52 px per mm up on the cabinet's front, NOTES.md)
const frCeil = 1.64;                                  // fridge ceiling
const frFloor = 0.736, fzCeil = 0.652;                // the mullion: fridge floor, freezer ceiling
const fzFloor = 0.134;                                // freezer floor
const s1 = 1.416, s2 = 1.251, s3 = 1.126;             // the fridge's three glass shelves
const sCover = 0.966;                                 // the 2XBIGBOX's glass cover; the FRUITBOX stands on it
const fbBottom = sCover + 0.002, fbTop = 1.108;       // the FRUITBOX, under shelf 3
const vbBottom = frFloor + 0.004, vbTop = 0.95;       // the 2XBIGBOX
const fzShelfTop = 0.451;                             // the freezer's glass shelf
const drBottom = fzFloor + 0.004, drTop = 0.423;      // the FREEZEBOX drawer
// fridge door bins (ESTIMATED, open photo): floor above the door's bottom edge, end height, depth. Bottom to top: the
// low bin, the BOTTLEGUARD, the middle bin, the top bin with the egg tray
const BINS = [
  { f: 0.067, h: 0.05, d: 0.08 }, { f: 0.333, h: 0.1, d: 0.11, print: true },
  { f: 0.653, h: 0.065, d: 0.09 }, { f: 0.855, h: 0.07, d: 0.09, eggs: true },
];
const linerFace = 0.016;
const dimple = 0.006;                                 // the freezer door's moulded dimples stand 6 mm off its liner
const frontFridge = zFront - Math.max(...BINS.map((b) => b.d)) - linerFace - 0.01;   // shelves, boxes end here
const frontFreezer = zFront - dimple - linerFace - 0.012;                            // the freezer shelf and drawer end here
// the two colours (Haier India's gallery of each): the glass, the wordmark and the badge change; the dark sides and the
// doors' silver edges are the same on both (3/4 photos: sides 62, edges 136-140 on both). Mirror Glass reads a flat
// neutral grey (206 of the photo's 255 white, no tint), Black Glass a flat black (1-2): the reflections in Haier's photos
// are the studio's, so the glass gets one colour and the viewer's light makes its own reflections. Mirror Glass first
// built 0xb4b5b7 (the HRD-2103's recipe) read 223 straight on and 237 at -28 deg against Haier's 206 and 211: now 0xa6a7a9
const FINISHES = [
  { name: "Mirror Glass", slug: "mirror_glass", face: 0xa6a7a9, metal: 0.15, rough: 0.35, coat: [0.3, 0.1], logo: "logo_dark.png", badge: "badge_mg.png" },
  { name: "Black Glass", slug: "black_glass", face: 0x060607, metal: 0.3, rough: 0.3, coat: [0.6, 0.06], logo: "logo_white.png", badge: "badge_kg.png" },
];
const F0 = FINISHES[0];

// ── materials (the first finish's; the other is a variant made after export) ──
const doorFace = mat("DoorFace", F0.face, { metal: F0.metal, rough: F0.rough });
const doorEdge = mat("DoorEdge", 0x8c8e92, { metal: 0.45, rough: 0.4 });            // the doors' silver edge band
const gripM = mat("GripInside", 0x111214, { rough: 0.7 });                          // inside the groove (3/4 photo: black)
const sidePaint = mat("SidePaint", 0x4a4b4d, { metal: 0.3, rough: 0.5 });
const topPaint = mat("TopPaint", 0x464749, { metal: 0.15, rough: 0.7 });
const frontEdge = mat("FrontEdge", 0xe4e6e9, { rough: 0.55 });                       // the cabinet's face round the openings: white (open photo)
const rearM = mat("RearPlate", 0xffffff, { metal: 0.3, rough: 0.55 });
const logoM = mat("HaierMark", 0xffffff, { rough: 0.35, opacity: 0.999 });
const badgeM = mat("Badge", 0xffffff, { rough: 0.35, opacity: 0.999 });
const displayM = mat("Display", 0xffffff, { rough: 0.3 });
const ductM = mat("Duct", 0xffffff, { rough: 0.6 });
const liner = mat("Liner", 0xf1f3f5, { rough: 0.6 });
const linerDk = mat("LinerGrey", 0xdde1e5, { rough: 0.62 });
const gasket = mat("Gasket", 0x8d9196, { rough: 0.85 });
const baseDark = mat("BaseDark", 0x1b1c1f, { rough: 0.8 });
const glass = mat("TemperedGlass", 0xa9cdd6, { rough: 0.05, opacity: 0.55, side: THREE.DoubleSide });
const glassRim = mat("ShelfRim", 0x2a2b2e, { rough: 0.45 });                        // the shelves' thin dark front trim (open photo)
const clear = mat("ClearPlastic", 0xc3d0da, { rough: 0.12, opacity: 0.5, side: THREE.DoubleSide });
const clearLite = mat("ClearPlasticLight", 0xdfe7ee, { rough: 0.12, opacity: 0.26, side: THREE.DoubleSide });
const frosted = mat("Frosted", 0xe6edf1, { rough: 0.45, opacity: 0.78 });
const white = mat("WhitePlastic", 0xf6f7f8, { rough: 0.45 });
const vent = mat("Vent", 0x6a6e74, { rough: 0.7 });
const ice = mat("IceCube", 0xe3f4ff, { rough: 0.08, opacity: 0.72 });
const iceGrey = mat("IceMakerGrey", 0xa9adb3, { rough: 0.5 });
const footM = mat("Foot", 0x131416, { rough: 0.7 });
const hingeM = mat("Hinge", 0xc9ccd0, { metal: 0.9, rough: 0.3 });
const printFruit = mat("PrintFruitbox", 0xffffff, { rough: 0.5, opacity: 0.999 });
const printIce = mat("PrintIcemaker", 0xffffff, { rough: 0.5, opacity: 0.999 });
const printBigbox = mat("PrintBigbox", 0xffffff, { rough: 0.5, opacity: 0.999 });
const printFreeze = mat("PrintFreezebox", 0xffffff, { rough: 0.5, opacity: 0.999 });
const printBottle = mat("PrintBottleguard", 0xffffff, { rough: 0.5, opacity: 0.999 });

const root = group("HaierHRB3152");
const cab = group("Cabinet");
root.add(cab);
// the printed words are drawn at 7.2 px per mm (tex_haier_hrb3152.py): a decal's size in metres is its PNG's size / 7200
const png = (f) => { const b = fs.readFileSync(`${T}/${f}`); return [b.readUInt32BE(16) / 7200, b.readUInt32BE(20) / 7200]; };
const plane = (name, w, h, m, x, y, z) => mesh(name, flipV(new THREE.PlaneGeometry(w, h)), m, x, y, z);
const cyl = (name, rt, rb, h, m, x, y, z, seg = 16) => mesh(name, new THREE.CylinderGeometry(rt, rb, h, seg), m, x, y, z);
// A box from its corners; drop: faces left out (BoxGeometry order +x, -x, +y, -y, +z, -z) where a face lies against
// another piece and would flicker
function slab(name, [x0, x1], [y0, y1], [z0, z1], mats, { drop = [] } = {}) {
  const g = new THREE.BoxGeometry(x1 - x0, y1 - y0, z1 - z0);
  g.translate((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2);
  flipV(g);
  if (drop.length) {
    const idx = g.index.array, keep = [];
    g.clearGroups();
    for (let f = 0; f < 6; f++) {
      if (drop.includes(f)) continue;
      g.addGroup(keep.length, 6, f);
      keep.push(...idx.slice(f * 6, f * 6 + 6));
    }
    g.setIndex(keep);
  }
  return mesh(name, g, mats);
}

// ── cabinet: dark painted steel outside (3/4 photos), white inside ──
const shellH = cabTop - base, shellMid = base + shellH / 2, zPlate = zBack + 0.004, cD = zFront - zPlate, zMid = (zFront + zPlate) / 2;
cab.add(faced("SideLeft", wall, shellH, cD, [liner, sidePaint, topPaint, baseDark, frontEdge, sidePaint], -W / 2 + wall / 2, shellMid, zMid));
cab.add(faced("SideRight", wall, shellH, cD, [sidePaint, liner, topPaint, baseDark, frontEdge, sidePaint], W / 2 - wall / 2, shellMid, zMid));
cab.add(faced("Top", W - 2 * wall, cabTop - frCeil, cD, [liner, liner, topPaint, liner, frontEdge, topPaint], 0, (cabTop + frCeil) / 2, zMid));
cab.add(faced("Base", W - 2 * wall, fzFloor - base, cD, [liner, liner, liner, baseDark, frontEdge, baseDark], 0, base + (fzFloor - base) / 2, zMid));
cab.add(faced("BackWall", W - 2 * wall, frCeil - fzFloor, backT - 0.0045, [liner, liner, liner, liner, liner, liner], 0, (frCeil + fzFloor) / 2, zBack + backT - (backT - 0.0045) / 2));
cab.add(faced("Divider", W - 2 * wall, frFloor - fzCeil, zFront - (zBack + backT), [liner, liner, liner, liner, frontEdge, liner], 0, (fzCeil + frFloor) / 2, (zFront + zBack + backT) / 2));
// the back: Haier's rear photo (the embossed plate, CYCLOPENTANE and the open compressor bay with its wiring) on a 4 mm plate
cab.add(mesh("RearPlate", flipV(new THREE.BoxGeometry(W, shellH, 0.004)), [sidePaint, sidePaint, topPaint, baseDark, liner, rearM], 0, shellMid, zBack + 0.002));
// feet: on Haier's front the left one 48 mm in (set back: it stands higher in the photo), the right one under the bottom
// hinge 27 mm in, both about 34 mm across; the two at the back are not shown on any photo: ESTIMATED, as the front left
cab.add(cyl("FootFrontL", 0.016, 0.017, base, footM, -W / 2 + 0.048, base / 2, zFront - 0.06));
cab.add(cyl("FootFrontR", 0.016, 0.017, base - 0.012, footM, W / 2 - 0.027, (base - 0.012) / 2, zFront - 0.015));
for (const sx of [-1, 1]) cab.add(cyl("FootRear", 0.016, 0.017, base, footM, sx * (W / 2 - 0.05), base / 2, zPlate + 0.06));
// hinges on the right: the silver bracket over the right foot (front photo) and the middle hinge in the doors' gap (front
// and open photos); the top hinge is hidden under the doors' flush top
cab.add(box("HingeBottom", 0.036, 0.006, 0.07, hingeM, W / 2 - 0.027, base - 0.003, zFront + 0.02));
cab.add(box("HingeMid", 0.04, 0.003, 0.06, hingeM, W / 2 - 0.025, (fzTop + frBot) / 2, zFront + 0.03));

// ── inside ──
const inW = W - 2 * wall;
const zIn = zBack + backT;                            // the back wall's inner face
const rails = (name, yTop, z0, z1) => { for (const sx of [-1, 1]) cab.add(box(name, 0.01, 0.012, z1 - z0, linerDk, sx * (inW / 2 - 0.005), yTop - 0.012, (z0 + z1) / 2)); };

// the fridge: the control display across the ceiling (open photo: a grey housing about 230 mm wide with its black window,
// centred, about 130 mm behind the opening), the moulded air duct with NAVI on the back wall
{
  const zd = zFront - 0.13, dh = 0.034;
  cab.add(box("DisplayHousing", 0.236, dh, 0.06, linerDk, 0, frCeil - dh / 2, zd - 0.03));
  const [w, h] = [0.226, 0.226 * 84 / 464];
  cab.add(plane("DisplayWindow", w, h, displayM, 0, frCeil - dh / 2, zd + 0.0007));
  const dTop = 1.535, dH = 0.6;
  cab.add(plane("DuctPanel", 0.21, dH, ductM, 0, dTop - dH / 2, zIn + 0.0007));
}

// what slides out (FridgeTrays): the three shelves, the FRUITBOX, the cover and the 2XBIGBOX, with their food
const trays = group("FridgeTrays");
cab.add(trays);
function glassShelf(name, yTop) {
  const z0 = zIn + 0.002, z1 = frontFridge, w = inW - 0.014;
  trays.add(box(name, w, 0.006, z1 - 0.006 - z0, glass, 0, yTop - 0.003, (z0 + z1 - 0.006) / 2));
  trays.add(box(name + "Rim", w, 0.008, 0.006, glassRim, 0, yTop - 0.004, z1 - 0.003));
  rails(name + "Rail", yTop - 0.006, zIn, z1 - 0.01);
}
glassShelf("Shelf1", s1);
glassShelf("Shelf2", s2);
glassShelf("Shelf3", s3);
{ // the cover over the 2XBIGBOX: a glass plate with a dark front trim
  const z0 = zIn + 0.002, z1 = frontFridge, w = inW - 0.014;
  trays.add(box("VegCover", w, 0.006, z1 - 0.006 - z0, glass, 0, sCover - 0.003, (z0 + z1 - 0.006) / 2));
  trays.add(box("VegCoverRim", w, 0.008, 0.006, glassRim, 0, sCover - 0.004, z1 - 0.003));
  rails("VegCoverRail", sCover - 0.006, zIn, z1 - 0.01);
}
// a clear box with a frosted top rim and its word on the front
function clearBox(prefix, w, y0, y1, z0, z1, printM, file, printY, M = { floor: clear, sides: clear, front: clearLite, rim: frosted }, g = trays) {
  const hh = y1 - y0, d = z1 - z0, zc = (z0 + z1) / 2;
  g.add(box(prefix + "Floor", w, 0.004, d, M.floor, 0, y0 + 0.002, zc));
  g.add(box(prefix + "Back", w, hh, 0.004, M.sides, 0, y0 + hh / 2, z0 + 0.002));
  g.add(box(prefix + "L", 0.004, hh, d, M.sides, -w / 2 + 0.002, y0 + hh / 2, zc));
  g.add(box(prefix + "R", 0.004, hh, d, M.sides, w / 2 - 0.002, y0 + hh / 2, zc));
  g.add(box(prefix + "Front", w, hh - 0.012, 0.004, M.front, 0, y0 + (hh - 0.012) / 2, z1 - 0.002));
  g.add(box(prefix + "Rim", w + 0.006, 0.012, 0.008, M.rim, 0, y1 - 0.006, z1 - 0.002));
  const [pw, ph] = png(file);
  g.add(plane(prefix + "PrintDecal", pw, ph, printM, 0, y0 + printY, z1 + 0.0007));
}
// the FRUITBOX (open photo: on the cover, under shelf 3; its word 95 mm up); the 2XBIGBOX (FzBox* are the names qa_bounds
// reads; its word 76 mm up)
const vbW = inW - 0.016, vbZ0 = zIn + 0.01, vbZ1 = frontFridge;
clearBox("FruitBox", vbW, fbBottom, fbTop, vbZ0, vbZ1, printFruit, "print_fruit.png", 0.095);
clearBox("FzBox", vbW, vbBottom, vbTop, vbZ0, vbZ1, printBigbox, "print_bigbox.png", 0.076);

// the freezer: two vents along the back of its ceiling, the glass shelf across it, the ICEMAKER on the shelf at the left,
// the small vent on the back wall at the right, the two drawer tabs under the shelf, and the FREEZEBOX drawer (open photo)
{
  const z0 = zIn + 0.002, z1 = frontFreezer, w = inW - 0.012;
  cab.add(box("FreezerShelf", w, 0.006, z1 - 0.009 - z0, glass, 0, fzShelfTop - 0.003, (z0 + z1 - 0.009) / 2));
  cab.add(box("FreezerShelfRim", w, 0.012, 0.009, frosted, 0, fzShelfTop - 0.005, z1 - 0.0045));
  rails("FreezerShelfRail", fzShelfTop - 0.006, zIn, z1 - 0.01);
  for (const x of [-0.1, 0.1]) cab.add(box("FreezerCeilingVent", 0.1, 0.004, 0.02, vent, x, fzCeil - 0.002, zIn + 0.03));
  for (const x of [-0.09, 0.11]) cab.add(box("FreezerDrawerTab", 0.07, 0.012, 0.02, vent, x, fzShelfTop - 0.018, z1 - 0.03));
  cab.add(box("FreezerVent", 0.03, 0.06, 0.006, white, inW / 2 - 0.06, 0.51, zIn + 0.003));
  for (let i = 0; i < 5; i++) cab.add(box("FreezerVentSlot", 0.012, 0.004, 0.002, vent, inW / 2 - 0.06, 0.49 + i * 0.01, zIn + 0.0065));
}
// the ICEMAKER (open photo: about 165 mm wide, 30 mm in from the left wall; its white housing over a clear bin, 145 mm
// tall in all; depth ESTIMATED 200 mm): the two twist trays' tabs on the housing's front, the word along its top
const icW = 0.165, icH = 0.142, icD = 0.2, bh = 0.065, icX = -inW / 2 + 0.03 + icW / 2, icZ1 = frontFreezer - 0.015, icZ0 = icZ1 - icD;
const iceM = group("IceMaker", icX, fzShelfTop, 0);
{
  const bz = icZ1 - icD / 2;
  iceM.add(box("IceBinFloor", icW - 0.008, 0.004, icD, clear, 0, 0.002, bz));
  for (const sx of [-1, 1]) iceM.add(box("IceBinSide", 0.004, bh, icD, clear, sx * (icW / 2 - 0.006), bh / 2, bz));
  iceM.add(box("IceBinBack", icW - 0.016, bh, 0.004, clear, 0, bh / 2, icZ0 + 0.002));
  iceM.add(box("IceBinFront", icW - 0.016, bh, 0.004, clear, 0, bh / 2, icZ1 - 0.002));
  iceM.add(box("IceHousing", icW, icH - bh, icD, white, 0, bh + (icH - bh) / 2, bz));
  for (const sx of [-1, 1]) iceM.add(box("IceTab", 0.05, 0.012, 0.01, iceGrey, sx * 0.035, bh + 0.008, icZ1 + 0.004));
  const [pw0, ph0] = png("print_icemaker.png");
  iceM.add(plane("PrintIcemakerDecal", pw0, ph0, printIce, 0, icH - 0.016, icZ1 + 0.0007));
  const cube = new THREE.BoxGeometry(0.022, 0.018, 0.022);
  for (let i = 0; i < 8; i++) {
    const c = mesh("IceCube", cube, ice, -0.055 + (i % 4) * 0.036, 0.014, icZ1 - 0.05 - Math.floor(i / 4) * 0.07 - (i % 2) * 0.012);
    c.rotation.set(0.15 * (i % 3), 0.5 * i, 0.1 * (i % 4));
    iceM.add(c);
  }
}
cab.add(iceM);
// the FREEZEBOX drawer (open photo: its front 144-423 mm, the word 125 mm up), slides out with its food
const drawer = group("FreezerDrawer");
cab.add(drawer);
const drW = inW - 0.016, drZ0 = zIn + 0.01, drZ1 = frontFreezer;
clearBox("Drawer", drW, drBottom, drTop, drZ0, drZ1, printFreeze, "print_freezebox.png", 0.125, { floor: clear, sides: clear, front: frosted, rim: frosted }, drawer);

// ── groceries (stock_lg.mjs, food.mjs): vegetarian South Indian food, eggs, juices, water and soft drinks ──
const stock = LGStock({ T3: `${TEX}/lg_glt3426`, TF: `${TEX}/food`, BR: `${TEX}/brands`, BRT: `${TEX}/brands/small` });
const vbFloor = vbBottom + 0.004, drFloor = drBottom + 0.004, fbFloor = fbBottom + 0.004;
stock.shelves(trays, {
  // stock_lg.mjs stands the food 3 mm over the height it is given: give it each top less 2.5 mm. The third "shelf" is the
  // FRUITBOX's floor: the fruit goes in it, as Haier's stocked photo shows
  zIn1: zIn, inW, inD: frontFridge - zIn, s1: s1 - 0.0025, s2: s2 - 0.0025, s3: fbFloor - 0.0025, fz: vbFloor, fit: true,
  vz0: vbZ0 + 0.03, vk: 1.1,
  shelfB: { hw: inW / 2 - 0.03, z0: zIn + 0.02, z1: frontFridge - 0.015 },
  drawerB: { hw: vbW / 2 - 0.014, z0: vbZ0 + 0.02, z1: vbZ1 - 0.008, y0: vbFloor },
  drawerCeil: sCover - 0.006 - 0.01 - vbFloor,   // the heap stays 1 cm under the cover
});
stock.freezer(drawer, { fit: true, zIn1: zIn, floor: drFloor, top: fzShelfTop + 0.0005, box: { hw: drW / 2 - 0.014, z0: drZ0 + 0.015, z1: drZ1 - 0.012 } });
cab.add(drawer.getObjectByName("OnFreezerShelf"));

root.updateMatrixWorld(true);
const bbox = (o) => new THREE.Box3().setFromObject(o);
function row(items, x0, x1, z0) {               // spread evenly between x0 and x1, backs at z0; returns the row's depth
  const bs = items.map(bbox), w = bs.reduce((s, b) => s + b.max.x - b.min.x, 0), gap = (x1 - x0 - w) / (items.length + 1);
  if (gap < 0.006) console.warn(`row: ${items.map((o) => o.name)} leave ${(gap * 1000).toFixed(0)} mm between them`);
  let x = x0 + gap, dep = 0;
  items.forEach((o, i) => {
    const b = bs[i];
    o.position.x += x - b.min.x; o.position.z += z0 - b.min.z;
    x += b.max.x - b.min.x + gap; dep = Math.max(dep, b.max.z - b.min.z);
  });
  return dep;
}
{ // the packs on the freezer shelf: behind the ice maker and beside it
  const g = cab.getObjectByName("OnFreezerShelf"), hw = inW / 2 - 0.03;
  const d1 = row([g.getObjectByName("ViswasParotta2"), g.getObjectByName("FreshoGreenPeas2")], -hw, hw, zIn + 0.03);
  row([g.getObjectByName("AmulPaneer")], icX + icW / 2 + 0.01, hw, zIn + 0.03 + d1 + 0.015);
}
{ // the herbs lie flat on the 2XBIGBOX floor: their leaves' lowest tips go on the floor, not through it
  const g = trays.getObjectByName("FreshZoneStock");
  root.updateMatrixWorld(true);
  if (g) for (const o of g.children.filter((o) => o.name === "Coriander" || o.name === "CurryLeaves")) {
    const lo = new THREE.Box3().setFromObject(o, true).min.y;
    if (lo < vbFloor + 0.001) o.position.y += vbFloor + 0.001 - lo;
  }
}

// The 2XBIGBOX is 33.6 cm deep inside, so the 34 cm drumsticks lie across it at the back, and the heap is dropped in
// again round them (two of the three capsicums are left out: no steady spot); the fruit goes into the FRUITBOX in two rows (it is 34 cm deep and 45 cm wide inside: two apples,
// two oranges, a lemon and the curd pouch are left out). stock_lg.mjs keeps its dropping method to itself: this copy is
// the Godrej Eon 366 builder's (from the Samsung RT40's), unchanged
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
  const v = trays.getObjectByName("FreshZoneStock"), B = { hw: vbW / 2 - 0.014, z0: vbZ0 + 0.02, z1: vbZ1 - 0.008 };
  kids(v, "Capsicum").slice(1).forEach((o) => o.removeFromParent());   // two capsicums find no steady spot: left out
  kids(v, "Drumstick").forEach((o, i) => { o.rotation.y += Math.PI / 2; o.position.set(0.02 * (i % 2 ? 1 : -1), 0, B.z0 + 0.02 + i * 0.024); });
  const HEAP = ["Drumstick", "Cabbage", "Cauliflower", "Onion", "Potato", "Brinjal", "Capsicum", "Carrot", "Tomato", "LadiesFinger", "Coriander", "CurryLeaves", "GreenChilli"];
  settle(v.children.slice().sort((a, b) => HEAP.indexOf(a.name) - HEAP.indexOf(b.name)), { tries: 30, spread: 0.08, bounds: B, ceil: sCover - 0.006 - 0.01 - vbFloor, seed: 11 });
}
{
  const g = trays.getObjectByName("Shelf3Stock"), hw = vbW / 2 - 0.012, z0 = vbZ0 + 0.012;
  const [a0, a1, a2, a3, a4] = kids(g, "Apple"), [o0, o1, o2] = kids(g, "Orange"), [l0, l1] = kids(g, "Lemon");
  [a1, a4, o1, o2, l1, g.getObjectByName("AmulMastiDahi")].filter(Boolean).forEach((o) => o.removeFromParent());
  const d1 = row([g.getObjectByName("Bananas"), g.getObjectByName("Grapes")], -hw, hw, z0);
  row([a0, o0, a2, l0, a3], -hw, hw, z0 + d1 + 0.02);
  settle(g.children.slice(), { bounds: { hw, z0, z1: vbZ1 - 0.012 }, ceil: s3 - 0.006 - 0.01 - fbFloor });
}

// ── doors: hinged on the right; flat glass faces on a silver edge band, a recess groove down each door's left side ──
const pw = W - 0.002, bw = pw - 0.09;
// gapSide: the door's face towards the other door, dark as the gap reads on Haier's front and 3/4 photos
function door(pivot, prefix, h, g, gapSide) {
  const gz0 = doorT / 2 - g.w / 2, gz1 = doorT / 2 + g.w / 2, xg = -pw + g.d, E = doorEdge, F = doorFace;
  pivot.add(slab(prefix + "PanelLow", [-pw, 0], [0, g.y0], [0, doorT], [E, E, gripM, gapSide === "bottom" ? gripM : E, F, liner]));
  pivot.add(slab(prefix + "PanelHigh", [-pw, 0], [g.y1, h], [0, doorT], [E, E, gapSide === "top" ? gripM : E, gripM, F, liner]));
  pivot.add(slab(prefix + "PanelMid", [xg, 0], [g.y0, g.y1], [0, doorT], [E, gripM, E, E, F, liner], { drop: [2, 3] }));
  pivot.add(slab(prefix + "GripFront", [-pw, xg], [g.y0, g.y1], [gz1, doorT], [E, E, gripM, gripM, F, gripM], { drop: [0] }));
  pivot.add(slab(prefix + "GripBack", [-pw, xg], [g.y0, g.y1], [0, gz0], [E, E, gripM, gripM, gripM, liner], { drop: [0] }));
  // the gasket round the inside and the liner the bins hang on
  pivot.add(box(prefix + "GasketT", pw - 0.02, 0.014, 0.014, gasket, -pw / 2, h - 0.012, -0.007));
  pivot.add(box(prefix + "GasketB", pw - 0.02, 0.014, 0.014, gasket, -pw / 2, 0.012, -0.007));
  pivot.add(box(prefix + "GasketL", 0.014, h - 0.02, 0.014, gasket, -pw + 0.012, h / 2, -0.007));
  pivot.add(box(prefix + "GasketR", 0.014, h - 0.02, 0.014, gasket, -0.012, h / 2, -0.007));
  pivot.add(box(prefix + "Liner", pw - 0.05, h - 0.05, 0.012, liner, -pw / 2, h / 2, -0.01));
}
// the fridge door: the Haier wordmark (60 mm, its middle 87 mm under the top, 3 mm right of the middle) and CONVERTIBLE
// (79 x 17 mm, its right end 33 mm in from the hinge edge, its foot 10 mm above the door's bottom edge), front photo
const fridgeDoor = group("FridgeDoor", W / 2, frBot, zFront);
{
  const h = frTop - frBot;
  door(fridgeDoor, "Fridge", h, GRIP_FR, "bottom");
  const [lw, lh] = png("logo_dark.png"), [cw, ch] = png("badge_mg.png");
  fridgeDoor.add(plane("HaierMarkDecal", lw, lh, logoM, -pw / 2 + 0.003, h - 0.087, doorT + 0.0007));
  fridgeDoor.add(plane("BadgeDecal", cw, ch, badgeM, -0.033 - cw / 2, 0.01 + ch / 2, doorT + 0.0007));
  BINS.forEach((b, i) => {
    const zc = -linerFace - b.d / 2, zl = -linerFace - b.d, nm = `FridgeDoorBin${i}`;
    fridgeDoor.add(box(nm + "Floor", bw, 0.004, b.d, clear, -pw / 2, b.f + 0.002, zc));
    fridgeDoor.add(box(nm + "Lip", bw, b.h * 0.8, 0.004, clear, -pw / 2, b.f + b.h * 0.4, zl + 0.002));
    fridgeDoor.add(box(nm + "Rim", bw, 0.007, 0.005, frosted, -pw / 2, b.f + b.h * 0.8 - 0.0035, zl + 0.0025));
    for (const sx of [-1, 1]) fridgeDoor.add(box(nm + "End", 0.004, b.h, b.d, clear, -pw / 2 + sx * (bw / 2 - 0.002), b.f + b.h / 2, zc));
    // BOTTLEGUARD on its bin's front, towards the free end (open photo); it faces the room when the door is open
    if (b.print) { const [w, hh] = png("print_bottle.png"); fridgeDoor.add(plane("PrintBottleguardDecal", w, hh, printBottle, -pw / 2 - bw / 2 + 0.05 + w / 2, b.f + b.h * 0.5, zl - 0.0007).rotateY(Math.PI)); }
  });
}
const EGGS = [0, 1, 2, 3, 4, 5].map((i) => -pw / 2 + bw / 2 - 0.004 - 0.03 - i * 0.05);
{ const b = BINS[3], zc = -linerFace - b.d / 2; for (const x of EGGS) { const c = mesh("EggCup", new THREE.SphereGeometry(0.02, 12, 4, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), clear, x, b.f, zc); c.scale.y = 0.7; fridgeDoor.add(c); } }
// the freezer door: the same glass face; inside, its liner moulded with five rows of five round dimples (open photo)
const freezerDoor = group("FreezerDoor", W / 2, base, zFront);
{
  const h = fzTop - base;
  door(freezerDoor, "Freezer", h, GRIP_FZ, "top");
  const dg = new THREE.SphereGeometry(0.019, 16, 4, 0, Math.PI * 2, 0, Math.PI / 2).rotateX(-Math.PI / 2);
  for (let r = 0; r < 5; r++) for (let c = 0; c < 5; c++) {
    const d = mesh("FreezerDoorDimple", dg, linerDk, -pw / 2 + (c - 2) * 0.082, 0.1 + r * 0.105, -linerFace + 0.0005);
    d.scale.z = dimple / 0.019;
    d.rotation.y = Math.PI;
    freezerDoor.add(d);
  }
}
// the 11 mm gap between the doors: dark fins carried by each door into the gap, so the white mullion behind does not
// show as a light line (as on the HRB-3752), overlapping 0.4 mm in the middle, 2 mm short of the sides
{
  const mid = (fzTop + frBot) / 2, ov = 0.0002, fin = 0.008, K = Array(6).fill(baseDark);
  freezerDoor.add(slab("SeamFinFreezer", [-pw + 0.002, -0.002], [fzTop - base - 0.001, mid + ov - base], [0.002, 0.002 + fin], K));
  fridgeDoor.add(slab("SeamFinFridge", [-pw + 0.002, -0.002], [mid - ov - frBot, 0.001], [0.012, 0.012 + fin], K));
}
{ // what sits in the door bins, so it swings out with the door
  const [b0, b1, b2, b3] = BINS;
  const inside = (dep) => [-pw / 2 - bw / 2 + 0.004, -pw / 2 + bw / 2 - 0.004, -(linerFace + dep / 2)];
  stock.doorFridge(fridgeDoor, { fit: true, eggY: b3.f, eggX: EGGS, eggDY: 0, eggTurn: Math.PI / 2, jarY: b2.f, botY: b1.f, canY: b0.f, deps: { egg: b3.d, jar: b2.d, bottle: b1.d, can: b0.d }, inside });
  // what is taller than its bin's space (to the bin over it, less 1 cm) is left out
  fridgeDoor.updateMatrixWorld(true);
  const inv = new THREE.Matrix4().copy(fridgeDoor.matrixWorld).invert();
  const tops = [[b0.f, b1.f - 0.01], [b1.f, b2.f - 0.01], [b2.f, b3.f - 0.01], [b3.f, frTop - frBot - 0.035]];
  const out = [];
  for (const o of [...fridgeDoor.children]) {
    if (!o.isGroup && !o.isMesh) continue;
    if (/Bin|Gasket|Fridge|Grip|Haier|Badge|Egg(Cup)?$|Seam|Print/.test(o.name)) continue;
    const b = new THREE.Box3().setFromObject(o).applyMatrix4(inv);
    const t = tops.find(([f]) => Math.abs(b.min.y - f) < 0.02);
    if (t && b.max.y > t[1]) { out.push(o.name); o.removeFromParent(); }
  }
  if (out.length) console.log(`left out (taller than its bin's space): ${out.join(", ")}`);
}
root.add(fridgeDoor, freezerDoor);

const parts = productParts(PRODUCTS, ID);
const clips = stateClips(root, parts);
saveZones(PRODUCTS, ID, root, parts);
// tilted leaves: their tilt goes into their geometry, so a box round each one is its real extent (qa_bounds)
root.traverse((o) => {
  if (o.name !== "Cauliflower" && o.name !== "Cabbage") return;
  for (const m of o.children) if (m.isMesh && (m.rotation.x || m.rotation.z)) {
    m.updateMatrix();
    m.geometry = m.geometry.clone().applyMatrix4(m.matrix);
    m.position.set(0, 0, 0); m.rotation.set(0, 0, 0); m.scale.set(1, 1, 1);
  }
});
root.updateMatrixWorld(true);
const herbs = [];
root.traverse((o) => (o.name === "Coriander" || o.name === "CurryLeaves") && herbs.push(o));
for (const g of herbs) {
  const inv = g.matrixWorld.clone().invert(), ms = [];
  g.traverse((m) => m.isMesh && ms.push(m));
  for (const m of ms) {
    m.geometry = m.geometry.clone().applyMatrix4(inv.clone().multiply(m.matrixWorld));
    m.removeFromParent(); m.position.set(0, 0, 0); m.rotation.set(0, 0, 0); m.scale.set(1, 1, 1);
    g.add(m);
  }
  g.children.filter((c) => !c.isMesh).forEach((c) => g.remove(c));
}
const used = new Set();
root.traverse((o) => o.material && [].concat(o.material).forEach((m) => used.add(m.name)));
const only = (t) => Object.fromEntries(Object.entries(t).filter(([k]) => used.has(k)));
// Grain: the painted sides and top and the doors' edge band a soft peel; none on the glass, prints, display or rear photo
await exportGLB(root, clips, OUT, only({
  HaierMark: `${T}/${F0.logo}`,
  Badge: `${T}/${F0.badge}`,
  Display: `${T}/display.jpg`,
  Duct: `${T}/duct.jpg`,
  RearPlate: `${T}/rear.jpg`,
  PrintFruitbox: `${T}/print_fruit.png`,
  PrintIcemaker: `${T}/print_icemaker.png`,
  PrintBigbox: `${T}/print_bigbox.png`,
  PrintFreezebox: `${T}/print_freezebox.png`,
  PrintBottleguard: `${T}/print_bottle.png`,
  ...stock.textures(),
}), { dir: `${TEX}/grain`, materials: {
  SidePaint: { type: "peel_soft" }, TopPaint: { type: "peel_soft" }, DoorEdge: { type: "peel_soft" },
} });

// ── the colours as KHR_materials_variants (Mirror Glass first); the glass gets its clear coat ──
{
  const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
  const doc = await io.read(OUT);
  const R = doc.getRoot();
  const byName = (n) => R.listMaterials().find((m) => m.getName() === n);
  const texCache = new Map();
  const image = (file) => {
    const name = file.replace(/\.\w+$/, "");
    if (!texCache.has(file)) texCache.set(file, R.listTextures().find((t) => t.getName() === name) ||
      doc.createTexture(name).setImage(new Uint8Array(fs.readFileSync(`${T}/${file}`))).setMimeType(file.endsWith(".png") ? "image/png" : "image/jpeg"));
    return texCache.get(file);
  };
  const coatExt = R.listExtensionsUsed().find((e) => e.extensionName === "KHR_materials_clearcoat") || doc.createExtension(KHRMaterialsClearcoat);
  const varExt = doc.createExtension(KHRMaterialsVariants);
  const lin = (c) => [(c >> 16) & 255, (c >> 8) & 255, c & 255].map((v) => { v /= 255; return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; });
  const VARY = ["DoorFace", "HaierMark", "Badge"];
  const base0 = Object.fromEntries(VARY.map((n) => [n, byName(n)]));
  for (const n of VARY) if (!base0[n]) throw new Error(`no material ${n}`);
  base0.HaierMark.getBaseColorTexture().setName(F0.logo.replace(/\.\w+$/, ""));
  base0.Badge.getBaseColorTexture().setName(F0.badge.replace(/\.\w+$/, ""));
  const mats = FINISHES.map((f, i) => {
    const out = {};
    for (const n of VARY) {
      const m = i === 0 ? base0[n] : base0[n].clone().setName(`${n}_${f.slug}`);
      if (n === "DoorFace") {
        m.setBaseColorFactor([...lin(f.face), 1]).setMetallicFactor(f.metal).setRoughnessFactor(f.rough);
        m.setExtension("KHR_materials_clearcoat", coatExt.createClearcoat().setClearcoatFactor(f.coat[0]).setClearcoatRoughnessFactor(f.coat[1]));
      }
      if (n === "HaierMark") m.setBaseColorTexture(image(f.logo));
      if (n === "Badge") m.setBaseColorTexture(image(f.badge));
      out[n] = m;
    }
    return out;
  });
  const variants = FINISHES.map((f) => varExt.createVariant(f.name));
  let mapped = 0;
  for (const node of R.listNodes()) {
    const me = node.getMesh();
    if (!me) continue;
    for (const p of me.listPrimitives()) {
      const n = VARY.find((k) => p.getMaterial() === base0[k]);
      if (!n) continue;
      const list = varExt.createMappingList();
      FINISHES.forEach((f, i) => list.addMapping(varExt.createMapping().setMaterial(mats[i][n]).addVariant(variants[i])));
      p.setExtension("KHR_materials_variants", list);
      mapped++;
    }
  }
  fs.writeFileSync(OUT, await io.writeBinary(doc));
  console.log(`variants: ${FINISHES.map((f) => f.name).join(", ")}; ${mapped} primitives mapped;`, (fs.statSync(OUT).size / 1048576).toFixed(2), "MB");
}
