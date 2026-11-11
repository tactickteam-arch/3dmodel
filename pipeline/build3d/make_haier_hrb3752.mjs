// Haier HRB-3752BNSA-P, 325 L frost-free bottom-mount double door (Magic Convertible series), in Nickel Steel (the code
// Sangeetha's listing 20623 sells) and Graphite Black (HRB-3752BGKA-P, the same fridge in Haier's other colour), the two
// colours as material variants. Built to Haier's published size, 623 W x 1640 H x 665 D mm (Haier India's page,
// "623*665*1640", W x D x H; Sangeetha 62.3 x 66.5 x 164.0 cm), and to Haier's own gallery of each colour: the straight-on
// front (the doors, the Haier wordmark, the control panel, MAGICCONVERTIBLE, the freezer's recess handle with its bar, the
// feet and the bottom hinge), the two 3/4 views (the sides, the door edges, the grip down the fridge door's left side), the
// open-door photo empty and stocked (every shelf, bin, box and print inside) and the straight-on back.
// The fridge is on top and the freezer underneath. Haier's photos show the freezer closed by a hinged door, hinged on the
// right like the fridge's, with a glass shelf, the movable ice maker and the FREEZEBOX drawer inside: so four parts, the
// fridge door, the fridge's trays (the three glass shelves, the cover and the 2XBIGBOX, with their food), the freezer door
// and the freezer drawer. Haier publishes no manual, door swing or clearances: the doors' 140 degrees and every inside
// height are ESTIMATED from the open-door photos (private NOTES.md).
// Stocked for a south Indian kitchen (stock_lg.mjs, fit: true).
// Everything that changes from one model of this family to the next (size, heights, door bins, colours, texture folder)
// is in the constants up to "materials"; the HRB-4052 (355 L) can start from a copy with its own numbers there.
// usage: node make_haier_hrb3752.mjs <entry .json, never products.json> <tex dir> <out.glb>
import fs from "node:fs";
import { NodeIO } from "@gltf-transform/core";
import { ALL_EXTENSIONS, KHRMaterialsVariants } from "@gltf-transform/extensions";
import { LGStock } from "./stock_lg.mjs";
import { THREE, mat, mesh, box, faced, group, flipV, stateClips, exportGLB, productParts, saveZones } from "./lib.mjs";

const [PRODUCTS, TEX, OUT] = process.argv.slice(2);
const ID = "haier-hrb-3752bnsa-p";
const T = `${TEX}/haier_hrb3752`;

// ── size (metres): Haier's 623 x 1640 x 665 mm ──
const W = 0.623, H = 1.64, D = 0.665;
const doorT = 0.071, Dc = D - doorT;                 // door thickness ESTIMATED (3/4 photos: the doors' edge band)
const zBack = -D / 2, zFront = zBack + Dc;
const boxT = 0.01;                                    // the control box stands 10 mm off the back plate (ESTIMATED)
const zPlate = zBack + boxT;                          // the back plate
const wall = 0.035, backT = 0.05;                     // side walls and the back's insulation (ESTIMATED)
// heights on Haier's straight-on fronts (0.657 px per mm up; door top row 61.5, floor row 1139.5)
const base = 0.0245;                                  // the cabinet's underside, at the freezer door's bottom edge
const cabTop = H - 0.012;                             // the fridge door stands about 12 mm above the cabinet's top (3/4 photos)
const frBot = 0.6375, frTop = H;                      // the fridge door, 637.5-1640 mm
const fzTop = 0.6335;                                 // the freezer door, 24.5-633.5 mm (its top hidden in the 4 mm gap)
const faceTop = 0.5765, lipTop = 0.5935;              // its steel face ends at 576.5; the handle's bar to 593.5; the channel above
const recessDepth = 0.025;                            // how far the channel goes into the door (ESTIMATED)
const endW = 0.022;                                   // the channel's end blocks (front photo: 15 and 14.5 px)
// the grip down the fridge door's left side (3/4 photo: 90-336 mm above the door's bottom edge, about half the door's
// thickness across; its depth ESTIMATED)
const GRIP = { y0: 0.09, y1: 0.336, w: 0.035, d: 0.02 };
// inside heights, ESTIMATED from Haier's open-door photo (0.571 px per mm up on the cabinet's front, NOTES.md)
const frCeil = 1.593;                                 // fridge ceiling
const frFloor = 0.655, fzCeil = 0.568;                // the mullion: fridge floor, freezer ceiling
const fzFloor = 0.1;                                  // freezer floor
const s1 = 1.37, s2 = 1.188, s3 = 1.009;              // the fridge's three glass shelves
const sCover = 0.857;                                 // the 2XBIGBOX's glass cover
const vbBottom = frFloor + 0.004, vbTop = 0.83;       // the 2XBIGBOX
const fzShelfTop = 0.392;                             // the freezer's glass shelf
const drBottom = fzFloor + 0.004, drTop = 0.335;      // the FREEZEBOX drawer
// fridge door bins (ESTIMATED, same photo, at the bins' hinge ends): floor above the door's bottom edge, end height, depth.
// Bottom to top: the low bin, the BOTTLEGUARD, the middle bin, the egg bin
const BINS = [
  { f: 0.0425, h: 0.06, d: 0.09 }, { f: 0.2595, h: 0.075, d: 0.105, print: true },
  { f: 0.6155, h: 0.05, d: 0.09 }, { f: 0.8675, h: 0.065, d: 0.085, eggs: true },
];
const linerFace = 0.016;
const relief = 0.035;                                 // the freezer door's moulded inner panel stands 35 mm off its liner (ESTIMATED)
const frontFridge = zFront - Math.max(...BINS.map((b) => b.d)) - linerFace - 0.01;   // shelves, cover and 2XBIGBOX end here
const frontFreezer = zFront - relief - linerFace - 0.01;                             // the freezer shelf and drawer end here
// the two colours (Haier India's gallery of each): the door textures, prints and paint that change; Nickel Steel first.
// Colours are sRGB; the doors' colour is in their textures (tex_haier_hrb3752.py). The steel is tuned as a ratio to the
// wordmark's white at the gate's straight-on and 3/4 views together (REVIEW.md): the usual steel-door recipe (metal 0.38,
// rough 0.5, clear coat 0.6 / 0.12) read 0.80 straight on and 0.92 at 3/4 against Haier's 0.72 and 0.69, so the doors'
// brightness comes from their colour and the brushed grain, with little metal and a soft clear coat
const FINISHES = [
  { name: "Nickel Steel", tex: "ns", edge: 0x8e9093, side: 0x797b7e, top: 0x74767a, metal: 0.38, rough: 0.5, grain: "hairline", coat: [0.6, 0.3] },
  { name: "Graphite Black", tex: "gb", edge: 0x272c3b, side: 0x3c3d3e, top: 0x36373a, metal: 0.1, rough: 0.7, grain: "hairline_soft", coat: [0.2, 0.3] },
];
const F0 = FINISHES[0];

// ── materials (the first finish's; the others are variants made after export) ──
const doorFz = mat("DoorFreezer", 0xffffff, { metal: F0.metal, rough: F0.rough });   // brushed steel textures
const doorFr = mat("DoorFridge", 0xffffff, { metal: F0.metal, rough: F0.rough });
const doorEdge = mat("DoorEdge", F0.edge, { metal: F0.metal, rough: F0.rough });      // the doors' edges: the same steel, wrapped round
const gripM = mat("GripInside", 0x3a3c40, { metal: 0.2, rough: 0.6 });                // inside the grip, in shadow (3/4 photo)
const lipM = mat("HandleLip", 0xdfe1e4, { metal: 0.5, rough: 0.3 });                  // the handle's bar: bright steel (front photo 244)
const channelM = mat("HandleChannel", 0xffffff, { rough: 0.6 });                      // its channel, light read off the photo
const endM = mat("HandleEnd", 0x76787c, { rough: 0.5 });                              // the channel's end blocks (photo 112-120)
const capM = mat("HandleCap", 0x9fa1a5, { rough: 0.45 });                             // their rounded inner ends
const sidePaint = mat("SidePaint", F0.side, { metal: 0.3, rough: 0.5 });
const topPaint = mat("TopPaint", F0.top, { metal: 0.15, rough: 0.7 });
const frontEdge = mat("FrontEdge", 0xe4e6e9, { rough: 0.55 });                        // the cabinet's face round the openings: white (open photo)
const rearM = mat("RearPlate", 0xffffff, { metal: 0.3, rough: 0.55 });                // Haier's rear photo
const ctrlM = mat("ControlBox", 0xffffff, { metal: 0.4, rough: 0.45 });
const logoM = mat("HaierMark", 0xffffff, { rough: 0.35, opacity: 0.999 });
const magicM = mat("PrintMagic", 0xffffff, { rough: 0.35, opacity: 0.999 });
const displayM = mat("Display", 0xffffff, { metal: 0.72, rough: 0.25 });             // the control panel: gloss black glass with its print
const displayEdge = mat("DisplayGlass", 0x0b0b0d, { metal: 0.72, rough: 0.25 });
const liner = mat("Liner", 0xf1f3f5, { rough: 0.6 });
const linerDk = mat("LinerGrey", 0xdde1e5, { rough: 0.62 });
const gasket = mat("Gasket", 0x8d9196, { rough: 0.85 });
const baseDark = mat("BaseDark", 0x1b1c1f, { rough: 0.8 });
const glass = mat("TemperedGlass", 0xa9cdd6, { rough: 0.05, opacity: 0.55, side: THREE.DoubleSide });
const glassRim = mat("ShelfRim", 0xe9ecee, { rough: 0.45 });
const edgeGreen = mat("GlassEdge", 0x7fa7b0, { rough: 0.3 });
const clear = mat("ClearPlastic", 0xc3d0da, { rough: 0.12, opacity: 0.5, side: THREE.DoubleSide });
const clearLite = mat("ClearPlasticLight", 0xdfe7ee, { rough: 0.12, opacity: 0.26, side: THREE.DoubleSide });
const frosted = mat("Frosted", 0xe6edf1, { rough: 0.45, opacity: 0.78 });
const white = mat("WhitePlastic", 0xf6f7f8, { rough: 0.45 });
const vent = mat("Vent", 0x3c3f44, { rough: 0.7 });
const ledHousing = mat("LedHousing", 0x8a8d92, { metal: 0.4, rough: 0.4 });          // the LED bar's grey housing (Haier's LED image)
const lightM = mat("Led", 0xffffff, { emissive: 0xf4f8ff, emissiveIntensity: 1.5 });
const ice = mat("IceCube", 0xe3f4ff, { rough: 0.08, opacity: 0.72 });
const iceGrey = mat("IceMakerGrey", 0xa9adb3, { rough: 0.5 });
const footM = mat("Foot", 0x131416, { rough: 0.7 });
const hingeM = mat("Hinge", 0xc9ccd0, { metal: 0.9, rough: 0.3 });
const cordM = mat("Cord", 0x16171a, { rough: 0.6 });
const printIce = mat("PrintIcemaker", 0xffffff, { rough: 0.5, opacity: 0.999 });
const printBigbox = mat("PrintBigbox", 0xffffff, { rough: 0.5, opacity: 0.999 });
const printFreeze = mat("PrintFreezebox", 0xffffff, { rough: 0.5, opacity: 0.999 });
const printBottle = mat("PrintBottleguard", 0xffffff, { rough: 0.5, opacity: 0.999 });
const printCooling = mat("PrintCooling", 0xffffff, { rough: 0.5, opacity: 0.999 });
const printLed = mat("PrintLed", 0xffffff, { rough: 0.5, opacity: 0.999 });

const root = group("HaierHRB3752");
const cab = group("Cabinet");
root.add(cab);
// the printed words are drawn at 7.2 px per mm (tex_haier_hrb3752.py): a decal's size in metres is its PNG's size / 7200
const png = (f) => { const b = fs.readFileSync(`${T}/${f}`); return [b.readUInt32BE(16) / 7200, b.readUInt32BE(20) / 7200]; };
const PAD = 4 / 7200;                                 // the 4 px of margin round each word
const plane = (name, w, h, m, x, y, z) => mesh(name, flipV(new THREE.PlaneGeometry(w, h)), m, x, y, z);
const cyl = (name, rt, rb, h, m, x, y, z, seg = 16) => mesh(name, new THREE.CylinderGeometry(rt, rb, h, seg), m, x, y, z);
// A box from its corners. frame [x0, x1, y0, y1]: its front (+z) face takes that part of a texture laid over the whole
// frame (a door built in pieces shows one photo). drop: faces left out (BoxGeometry order +x, -x, +y, -y, +z, -z), where
// a face lies against another piece and would flicker
function slab(name, [x0, x1], [y0, y1], [z0, z1], mats, { frame = null, drop = [] } = {}) {
  const g = new THREE.BoxGeometry(x1 - x0, y1 - y0, z1 - z0);
  g.translate((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2);
  flipV(g);
  if (frame) {
    const p = g.attributes.position, uv = g.attributes.uv;
    for (let i = 16; i < 20; i++) uv.setXY(i, (p.getX(i) - frame[0]) / (frame[1] - frame[0]), 1 - (p.getY(i) - frame[2]) / (frame[3] - frame[2]));
  }
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

// ── cabinet: painted steel outside, white inside ──
const shellH = cabTop - base, shellMid = base + shellH / 2, cD = zFront - zPlate - 0.004, zMid = (zFront + zPlate + 0.004) / 2;
// the sides' paint wraps round their front edges (the open photo's dark outer frame; seen past the doors at 3/4)
cab.add(faced("SideLeft", wall, shellH, cD, [liner, sidePaint, topPaint, baseDark, sidePaint, sidePaint], -W / 2 + wall / 2, shellMid, zMid));
cab.add(faced("SideRight", wall, shellH, cD, [sidePaint, liner, topPaint, baseDark, sidePaint, sidePaint], W / 2 - wall / 2, shellMid, zMid));
cab.add(faced("Top", W - 2 * wall, cabTop - frCeil, cD, [liner, liner, topPaint, liner, frontEdge, topPaint], 0, (cabTop + frCeil) / 2, zMid));
cab.add(faced("Base", W - 2 * wall, fzFloor - base, cD, [liner, liner, liner, baseDark, frontEdge, baseDark], 0, base + (fzFloor - base) / 2, zMid));
cab.add(faced("BackWall", W - 2 * wall, frCeil - fzFloor, backT - 0.0045 - boxT, [liner, liner, liner, liner, liner, liner], 0, (frCeil + fzFloor) / 2, zBack + backT - (backT - 0.0045 - boxT) / 2));
cab.add(faced("Divider", W - 2 * wall, frFloor - fzCeil, zFront - (zBack + backT), [liner, liner, liner, liner, frontEdge, liner], 0, (fzCeil + frFloor) / 2, (zFront + zBack + backT) / 2));
// the back: Haier's rear photo (the embossed plate and the open compressor bay) on a 4 mm plate, cropped to the cabinet
cab.add(mesh("RearPlate", flipV(new THREE.BoxGeometry(W, shellH, 0.004)), [sidePaint, sidePaint, topPaint, baseDark, liner, rearM], 0, shellMid, zPlate + 0.002));
// the control box on the back (rear photo x 648-770, rows 500-760; the body x 381.5-802 for 623 mm, rows 72-1136 from
// the top to the underside), and its cable down into the compressor bay, traced on the same photo
const rx = (px) => W / 2 - ((px - 381.5) / 420.5) * W, ry = (py) => base + ((1136 - py) / 1064) * (cabTop - base);
{
  const x0 = rx(770), x1 = rx(648), y0 = ry(760), y1 = ry(500);
  cab.add(mesh("ControlBox", flipV(new THREE.BoxGeometry(x1 - x0, y1 - y0, boxT)), [sidePaint, sidePaint, sidePaint, sidePaint, sidePaint, ctrlM], (x0 + x1) / 2, (y0 + y1) / 2, zBack + boxT / 2));
  const pts = [[711, 745, 0.003], [711, 760, -0.002], [711, 790, -0.0035], [709, 835, -0.0035], [707, 880, -0.0035], [706, 940, -0.0035], [706, 990, -0.003], [706, 1000, 0.01]]
    .map(([px, py, dz]) => new THREE.Vector3(rx(px), ry(py), zPlate + dz - 0.0001));
  pts[0].z = zBack + 0.002;                               // it leaves the box's foot
  cab.add(mesh("CordToBay", new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts, false, "centripetal"), 60, 0.0032, 6, false), cordM));
}
// feet: on Haier's front the left one 33 mm in, the right one under the bottom hinge 31 mm in, both about 38 mm across;
// the two at the back are not shown on any photo: ESTIMATED, as the front left
cab.add(cyl("FootFrontL", 0.018, 0.019, base, footM, -W / 2 + 0.033, base / 2, zFront - 0.06));
cab.add(cyl("FootFrontR", 0.018, 0.019, base - 0.006, footM, W / 2 - 0.031, (base - 0.006) / 2, zFront - 0.015));
for (const sx of [-1, 1]) cab.add(cyl("FootRear", 0.018, 0.019, base, footM, sx * (W / 2 - 0.053), base / 2, zPlate + 0.06));
// hinges on the right: the silver bracket over the right foot (front photo), the middle hinge between the doors (open
// photo), and the cover on the cabinet's top behind the fridge door (3/4 photos)
cab.add(box("HingeBottom", 0.036, 0.006, 0.075, hingeM, W / 2 - 0.031, base - 0.003, zFront + 0.015));
cab.add(box("HingeMid", 0.045, 0.003, 0.06, hingeM, W / 2 - 0.03, (fzTop + frBot) / 2, zFront + 0.03));
cab.add(box("HingeCoverTop", 0.07, H - cabTop - 0.001, 0.05, topPaint, W / 2 - 0.04, cabTop + (H - cabTop - 0.001) / 2, zFront - 0.026));

// ── inside ──
const inW = W - 2 * wall;
const zIn = zBack + backT;                            // the back wall's inner face
const rails = (name, yTop, z0, z1) => { for (const sx of [-1, 1]) cab.add(box(name, 0.01, 0.012, z1 - z0, linerDk, sx * (inW / 2 - 0.005), yTop - 0.012, (z0 + z1) / 2)); };

// the fridge: the LED bar across the ceiling near the back (Haier's LED Light image: a grey bar with LED LIGHT on its
// front and the light under it; the open photo shows it about 220 mm long, its place ESTIMATED), MAGIC COOLING with
// TRIPLE INVERTER & DUAL FAN TECH on the back wall between the top two shelves (open photo)
{
  const zl = zIn + 0.07;
  cab.add(box("FridgeLedHousing", 0.22, 0.014, 0.02, ledHousing, 0, frCeil - 0.007, zl));
  cab.add(box("FridgeLed", 0.2, 0.004, 0.014, lightM, 0, frCeil - 0.016, zl));
  const [w, h] = png("print_led.png");
  cab.add(plane("PrintLedDecal", w, h, printLed, 0, frCeil - 0.007, zl + 0.0107));
  const [cw, ch] = png("print_cooling.png");
  cab.add(plane("PrintCoolingDecal", cw, ch, printCooling, 0, 1.262, zIn + 0.0007));
}

// what slides out (FridgeTrays): the three shelves, the cover and the 2XBIGBOX, with their food
const trays = group("FridgeTrays");
cab.add(trays);
function glassShelf(name, yTop) {
  const z0 = zIn + 0.002, z1 = frontFridge, w = inW - 0.014;
  trays.add(box(name, w, 0.006, z1 - 0.012 - z0, glass, 0, yTop - 0.003, (z0 + z1 - 0.012) / 2));
  trays.add(box(name + "Rim", w, 0.016, 0.012, glassRim, 0, yTop - 0.006, z1 - 0.006));
  trays.add(box(name + "Edge", w, 0.004, 0.003, edgeGreen, 0, yTop - 0.012, z1 + 0.0015));
  rails(name + "Rail", yTop - 0.006, zIn, z1 - 0.01);
}
glassShelf("Shelf1", s1);
glassShelf("Shelf2", s2);
glassShelf("Shelf3", s3);
{ // the cover over the 2XBIGBOX: a glass plate with a frosted front rim
  const z0 = zIn + 0.002, z1 = frontFridge, w = inW - 0.014;
  trays.add(box("VegCover", w, 0.006, z1 - 0.014 - z0, glass, 0, sCover - 0.003, (z0 + z1 - 0.014) / 2));
  trays.add(box("VegCoverFront", w, 0.02, 0.014, frosted, 0, sCover - 0.01, z1 - 0.007));
  rails("VegCoverRail", sCover - 0.006, zIn, z1 - 0.01);
}
// the 2XBIGBOX (FzBox* are the names qa_bounds reads), its word on its front (open photo: centred, 100 mm up)
const vbW = inW - 0.016, vbZ0 = zIn + 0.01, vbZ1 = frontFridge, vbD = vbZ1 - vbZ0, vbZ = (vbZ0 + vbZ1) / 2;
{
  const hh = vbTop - vbBottom;
  trays.add(box("FzBoxFloor", vbW, 0.004, vbD, clear, 0, vbBottom + 0.002, vbZ));
  trays.add(box("FzBoxBack", vbW, hh, 0.004, clear, 0, vbBottom + hh / 2, vbZ0 + 0.002));
  trays.add(box("FzBoxL", 0.004, hh, vbD, clear, -vbW / 2 + 0.002, vbBottom + hh / 2, vbZ));
  trays.add(box("FzBoxR", 0.004, hh, vbD, clear, vbW / 2 - 0.002, vbBottom + hh / 2, vbZ));
  trays.add(box("FzBoxFront", vbW, hh - 0.012, 0.004, clearLite, 0, vbBottom + (hh - 0.012) / 2, vbZ1 - 0.002));
  trays.add(box("FzBoxRim", vbW + 0.006, 0.012, 0.008, frosted, 0, vbTop - 0.006, vbZ1 - 0.002));
  trays.add(box("FzBoxFootRim", vbW, 0.01, 0.008, frosted, 0, vbBottom + 0.005, vbZ1 - 0.002));
  const [fw, fh] = png("print_bigbox.png");
  trays.add(plane("PrintBigboxDecal", fw, fh, printBigbox, 0, vbBottom + 0.1, vbZ1 + 0.0007));
}

// the freezer: the glass shelf across it, the movable ICEMAKER on the shelf at the front left, a four-slot vent on the
// back wall at the right (open photo and Haier's ice maker image), and the FREEZEBOX drawer on the floor
{
  const z0 = zIn + 0.002, z1 = frontFreezer, w = inW - 0.012;
  cab.add(box("FreezerShelf", w, 0.006, z1 - 0.009 - z0, glass, 0, fzShelfTop - 0.003, (z0 + z1 - 0.009) / 2));
  cab.add(box("FreezerShelfRim", w, 0.016, 0.009, frosted, 0, fzShelfTop - 0.006, z1 - 0.0045));
  rails("FreezerShelfRail", fzShelfTop - 0.006, zIn, z1 - 0.01);
  cab.add(box("FreezerVent", 0.09, 0.018, 0.004, linerDk, 0.1, 0.475, zIn + 0.002));
  for (let i = 0; i < 4; i++) cab.add(box("FreezerVentSlot", 0.016, 0.01, 0.002, vent, 0.1 - 0.0285 + i * 0.019, 0.475, zIn + 0.0045));
}
// the ICEMAKER (open photo: about 190 mm wide, 30 mm in from the left wall; its white housing 90 mm tall over a 35 mm
// clear bin; depth ESTIMATED 200 mm): two twist trays on the housing's front, the word along its top
const icW = 0.19, icH = 0.125, icD = 0.2, icX = -inW / 2 + 0.03 + icW / 2, icZ1 = frontFreezer - 0.015, icZ0 = icZ1 - icD;
const iceM = group("IceMaker", icX, fzShelfTop, 0);
{
  const bh = 0.035, bz = icZ1 - icD / 2;
  iceM.add(box("IceBinFloor", icW - 0.008, 0.004, icD, clear, 0, 0.002, bz));
  for (const sx of [-1, 1]) iceM.add(box("IceBinSide", 0.004, bh, icD, clear, sx * (icW / 2 - 0.006), bh / 2, bz));
  iceM.add(box("IceBinBack", icW - 0.016, bh, 0.004, clear, 0, bh / 2, icZ0 + 0.002));
  iceM.add(box("IceBinFront", icW - 0.016, bh, 0.004, clear, 0, bh / 2, icZ1 - 0.002));
  iceM.add(box("IceHousing", icW, icH - bh, icD, white, 0, bh + (icH - bh) / 2, bz));
  // the twist trays' round knobs (Haier's ice maker image: a grey ring round each white knob) and the two grey tabs
  // along the housing's top edge (open photo)
  for (const sx of [-1, 1]) {
    iceM.add(cyl("IceTwistRing", 0.03, 0.03, 0.006, iceGrey, sx * 0.047, bh + 0.035, icZ1 + 0.003, 28).rotateX(Math.PI / 2));
    iceM.add(cyl("IceTwistTray", 0.025, 0.025, 0.006, white, sx * 0.047, bh + 0.035, icZ1 + 0.005, 28).rotateX(Math.PI / 2));
    iceM.add(box("IceTab", 0.026, 0.008, 0.022, iceGrey, sx * 0.04, icH + 0.0035, icZ1 - 0.02));   // 0.5 mm into the housing
  }
  const [pw0, ph0] = png("print_icemaker.png");
  iceM.add(plane("PrintIcemakerDecal", pw0, ph0, printIce, 0, icH - 0.012, icZ1 + 0.0007));
  const cube = new THREE.BoxGeometry(0.022, 0.018, 0.022);
  for (let i = 0; i < 8; i++) {
    const c = mesh("IceCube", cube, ice, -0.06 + (i % 4) * 0.04, 0.014, icZ1 - 0.05 - Math.floor(i / 4) * 0.07 - (i % 2) * 0.012);
    c.rotation.set(0.15 * (i % 3), 0.5 * i, 0.1 * (i % 4));
    iceM.add(c);
  }
}
cab.add(iceM);
// the FREEZEBOX drawer (open photo: its front 105-335 mm, the word centred on it 120 mm up), slides out with its food
const drawer = group("FreezerDrawer");
cab.add(drawer);
const drW = inW - 0.016, drZ0 = zIn + 0.01, drZ1 = frontFreezer, drD = drZ1 - drZ0, drZ = (drZ0 + drZ1) / 2;
{
  const hh = drTop - drBottom;
  drawer.add(box("DrawerFloor", drW, 0.004, drD, clear, 0, drBottom + 0.002, drZ));
  drawer.add(box("DrawerBack", drW, hh, 0.004, clear, 0, drBottom + hh / 2, drZ0 + 0.002));
  for (const sx of [-1, 1]) drawer.add(box("DrawerSide", 0.004, hh, drD, clear, sx * (drW / 2 - 0.002), drBottom + hh / 2, drZ));
  drawer.add(box("DrawerFront", drW, hh - 0.012, 0.004, frosted, 0, drBottom + (hh - 0.012) / 2, drZ1 - 0.002));
  drawer.add(box("DrawerRim", drW + 0.006, 0.012, 0.008, frosted, 0, drTop - 0.006, drZ1 - 0.002));
  const [fw, fh] = png("print_freezebox.png");
  drawer.add(plane("PrintFreezeboxDecal", fw, fh, printFreeze, 0, drBottom + 0.12, drZ1 + 0.0007));
}

// ── groceries (stock_lg.mjs, food.mjs): vegetarian South Indian food, eggs, juices, water and soft drinks ──
const stock = LGStock({ T3: `${TEX}/lg_glt3426`, TF: `${TEX}/food`, BR: `${TEX}/brands`, BRT: `${TEX}/brands/small` });
const vbFloor = vbBottom + 0.004, drFloor = drBottom + 0.004;
stock.shelves(trays, {
  // stock_lg.mjs stands the food 3 mm over the height it is given: give it each top less 2.5 mm
  zIn1: zIn, inW, inD: frontFridge - zIn, s1: s1 - 0.0025, s2: s2 - 0.0025, s3: s3 - 0.0025, fz: vbFloor, fit: true,
  // the 2XBIGBOX heap: start 3 cm in, spread 1.15 (swept; one capsicum is left out, the rest lie steady)
  vz0: vbZ0 + 0.03, vk: 1.15,
  shelfB: { hw: inW / 2 - 0.03, z0: zIn + 0.02, z1: frontFridge - 0.015 },
  drawerB: { hw: vbW / 2 - 0.014, z0: vbZ0 + 0.02, z1: vbZ1 - 0.008, y0: vbFloor },
  drawerCeil: sCover - 0.006 - 0.01 - vbFloor,   // the heap stays 1 cm under the cover
});
// the drawer's food goes in the drawer (FreezerStock); what lies on the glass shelf (OnFreezerShelf) stays in the cabinet
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
const kids = (g, name) => g.children.filter((o) => o.name === name);
const drop = (...os) => os.forEach((o) => o.parent.remove(o));
{ // the packs on the freezer shelf: two behind the ice maker, the paneer beside it
  const g = cab.getObjectByName("OnFreezerShelf"), hw = inW / 2 - 0.03;
  const d1 = row([g.getObjectByName("ViswasParotta2"), g.getObjectByName("FreshoGreenPeas2")], -hw, hw, zIn + 0.03);
  row([g.getObjectByName("AmulPaneer")], icX + icW / 2 + 0.01, hw, zIn + 0.03 + d1 + 0.015);
}
{ // shelf 3 is 378 mm deep: its fruit in two rows (bananas, grapes and curd, then apples, an orange and a lemon)
  const g = trays.getObjectByName("Shelf3Stock"), hw = inW / 2 - 0.03, z0 = zIn + 0.02;
  const [a0, a1, a2, a3, a4] = kids(g, "Apple"), [o0, o1, o2] = kids(g, "Orange"), [l0, l1] = kids(g, "Lemon");
  drop(a1, a4, o1, o2, l1);
  const d1 = row([g.getObjectByName("Bananas"), g.getObjectByName("Grapes"), g.getObjectByName("AmulMastiDahi")], -hw, hw, z0);
  row([a0, o0, a2, l0, a3], -hw, hw, z0 + d1 + 0.03);
}
{ // the herbs lie flat on the 2XBIGBOX floor: their leaves' lowest tips go on the floor, not through it
  const g = trays.getObjectByName("FreshZoneStock");
  root.updateMatrixWorld(true);
  for (const o of [...kids(g, "Coriander"), ...kids(g, "CurryLeaves")]) {
    const lo = new THREE.Box3().setFromObject(o, true).min.y;
    if (lo < vbFloor + 0.001) o.position.y += vbFloor + 0.001 - lo;
  }
}

// ── doors: hinged on the right, brushed steel fronts and edges ──
const pw = W - 0.002, bw = pw - 0.1;
const inside = (dep) => [-pw / 2 - bw / 2 + 0.004, -pw / 2 + bw / 2 - 0.004, -(linerFace + dep / 2)];
const EGGS = [0, 1, 2, 3, 4, 5].map((i) => -pw / 2 + bw / 2 - 0.004 - 0.03 - i * 0.05);   // at the bin's hinge end, as photographed
function gaskets(pivot, name, h) {
  pivot.add(box(name + "GasketT", pw - 0.02, 0.014, 0.014, gasket, -pw / 2, h - 0.012, -0.007));
  pivot.add(box(name + "GasketB", pw - 0.02, 0.014, 0.014, gasket, -pw / 2, 0.012, -0.007));
  pivot.add(box(name + "GasketL", 0.014, h - 0.02, 0.014, gasket, -pw + 0.012, h / 2, -0.007));
  pivot.add(box(name + "GasketR", 0.014, h - 0.02, 0.014, gasket, -0.012, h / 2, -0.007));
  pivot.add(box(name + "Liner", pw - 0.05, h - 0.05, 0.012, liner, -pw / 2, h / 2, -0.01));
}
// the fridge door: one brushed face from its bottom edge to the top, built in pieces round the grip in its left side;
// the Haier wordmark (59 mm, centred, its middle 1550 mm up), the control panel (44 x 230 mm of black glass, 1260-1489 mm,
// its middle 2 mm right of the door's) and MAGICCONVERTIBLE (122 mm, its right end 19 mm in from the hinge edge, its
// foot 20 mm above the door's bottom edge), measured on Haier's fronts
const fridgeDoor = group("FridgeDoor", W / 2, frBot, zFront);
{
  const h = frTop - frBot, g = GRIP, gz0 = doorT / 2 - g.w / 2, gz1 = doorT / 2 + g.w / 2, xg = -pw + g.d, frame = [-pw, 0, 0, h];
  const E = doorEdge;
  fridgeDoor.add(slab("FridgePanelLow", [-pw, 0], [0, g.y0], [0, doorT], [E, E, gripM, E, doorFr, liner], { frame }));
  fridgeDoor.add(slab("FridgePanelHigh", [-pw, 0], [g.y1, h], [0, doorT], [E, E, E, gripM, doorFr, liner], { frame }));
  fridgeDoor.add(slab("FridgePanelMid", [xg, 0], [g.y0, g.y1], [0, doorT], [E, gripM, E, E, doorFr, liner], { frame, drop: [2, 3] }));
  fridgeDoor.add(slab("FridgeGripFront", [-pw, xg], [g.y0, g.y1], [gz1, doorT], [E, E, E, E, doorFr, gripM], { frame, drop: [0, 2, 3] }));
  fridgeDoor.add(slab("FridgeGripBack", [-pw, xg], [g.y0, g.y1], [0, gz0], [E, E, E, E, gripM, liner], { drop: [0, 2, 3] }));
  const [lw, lh] = png("logo.png"), [mw, mh] = png("print_magic_ns.png");
  fridgeDoor.add(plane("HaierMarkDecal", lw, lh, logoM, -pw / 2, 1.55 - frBot, doorT + 0.0007));
  // the panel stands 1.1 mm proud, its back sunk into the door
  fridgeDoor.add(mesh("Display", flipV(new THREE.BoxGeometry(0.044, 0.23, 0.002)), [displayEdge, displayEdge, displayEdge, displayEdge, displayM, displayEdge], -pw / 2 + 0.002, (1.26 + 1.489) / 2 - frBot, doorT + 0.0001));
  fridgeDoor.add(plane("PrintMagicDecal", mw, mh, magicM, -0.019 + PAD - mw / 2, 0.02 - PAD + mh / 2, doorT + 0.0007));
  gaskets(fridgeDoor, "FridgeDoor", h);
  BINS.forEach((b, i) => {
    const zc = -linerFace - b.d / 2, zl = -linerFace - b.d, nm = `FridgeDoorBin${i}`;
    fridgeDoor.add(box(nm + "Floor", bw, 0.004, b.d, clear, -pw / 2, b.f + 0.002, zc));
    fridgeDoor.add(box(nm + "Lip", bw, b.h * 0.8, 0.004, clear, -pw / 2, b.f + b.h * 0.4, zl + 0.002));
    fridgeDoor.add(box(nm + "Rim", bw, 0.007, 0.005, frosted, -pw / 2, b.f + b.h * 0.8 - 0.0035, zl + 0.0025));
    for (const sx of [-1, 1]) fridgeDoor.add(box(nm + "End", 0.004, b.h, b.d, clear, -pw / 2 + sx * (bw / 2 - 0.002), b.f + b.h / 2, zc));
    // BOTTLEGUARD on its bin's front towards the hinge end (open photo); it faces the room when the door is open
    if (b.print) { const [w, hh] = png("print_bottle.png"); fridgeDoor.add(plane("PrintBottleguardDecal", w, hh, printBottle, -0.07 - w / 2, b.f + b.h * 0.42, zl - 0.0007).rotateY(Math.PI)); }
    if (b.eggs) for (const x of EGGS) { const c = mesh("EggCup", new THREE.SphereGeometry(0.02, 12, 4, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), clear, x, b.f, zc); c.scale.y = 0.7; fridgeDoor.add(c); }
  });
}
// the freezer door: the steel face, the handle's bar (rounded, bright steel), the channel above it set 25 mm back with
// its end blocks and their rounded inner ends; inside, the moulded panel with three ribs (open photo)
const freezerDoor = group("FreezerDoor", W / 2, base, zFront);
{
  const h = fzTop - base, faceH = faceTop - base, lipH = lipTop - faceTop, chH = fzTop - lipTop;
  freezerDoor.add(mesh("FreezerPanel", flipV(new THREE.BoxGeometry(pw, faceH, doorT)), [doorEdge, doorEdge, doorEdge, doorEdge, doorFz, liner], -pw / 2, faceH / 2, doorT / 2));
  const sb = doorT - 0.004;
  freezerDoor.add(mesh("HandleLip", new THREE.BoxGeometry(pw, lipH, sb), [doorEdge, doorEdge, lipM, doorEdge, lipM, liner], -pw / 2, faceH + lipH / 2, sb / 2));
  const round = mesh("HandleLipFace", new THREE.CylinderGeometry(lipH / 2, lipH / 2, pw - 0.003, 24, 1, false, -Math.PI / 2, Math.PI), lipM, -pw / 2, faceH + lipH / 2, sb);
  round.rotation.z = Math.PI / 2; round.scale.set(1, 1, 0.0035 / (lipH / 2));
  freezerDoor.add(round);
  const cd = doorT - recessDepth, yc = lipTop - base + chH / 2;
  freezerDoor.add(mesh("HandleChannel", flipV(new THREE.BoxGeometry(pw - 2 * endW, chH, cd)), [doorEdge, doorEdge, doorEdge, doorEdge, channelM, liner], -pw / 2, yc, cd / 2));
  for (const sx of [-1, 1]) {
    const x = -pw / 2 + sx * (pw / 2 - endW / 2);
    freezerDoor.add(mesh("HandleEnd", new THREE.BoxGeometry(endW, chH, doorT), [doorEdge, doorEdge, doorEdge, doorEdge, endM, liner], x, yc, doorT / 2));
    const cap = cyl("HandleCap", recessDepth / 2, recessDepth / 2, chH - 0.001, capM, x - sx * endW / 2, yc, cd + recessDepth / 2, 16);
    cap.scale.x = 0.55;
    freezerDoor.add(cap);
  }
  gaskets(freezerDoor, "FreezerDoor", h);
  const rw = pw - 0.09, rh = h - 0.1, rz = -linerFace - relief / 2;
  freezerDoor.add(box("FreezerDoorPanel", rw, rh, relief + 0.001, liner, -pw / 2, h / 2, rz + 0.0005));   // 1 mm into the liner
  for (const f of [0.27, 0.5, 0.73]) freezerDoor.add(box("FreezerDoorRib", rw - 0.06, 0.008, 0.005, linerDk, -pw / 2, h / 2 - rh / 2 + f * rh, -linerFace - relief - 0.002));
}
// the 4 mm gap between the doors: the white mullion behind it showed through as a bright line when seen from its own
// height (on Haier's fronts it reads dark, in the doors' shadow). Each door carries a dark fin (the base's near black) into the gap, the fridge
// door's in front (it opens most, and its fin swings away from the other), overlapping 0.4 mm in the gap's middle, so no
// straight line of sight reaches the mullion; each fin is set 1 mm into its own door and stops 2 mm short of the doors'
// sides, and its faces keep 1.3 mm or more from the centre hinge's (which sits in the gap)
{
  const mid = (fzTop + frBot) / 2, ov = 0.0002, fin = 0.008, K = Array(6).fill(baseDark);
  freezerDoor.add(slab("SeamFinFreezer", [-pw + 0.002, -0.002], [fzTop - base - 0.001, mid + ov - base], [0.002, 0.002 + fin], K));
  fridgeDoor.add(slab("SeamFinFridge", [-pw + 0.002, -0.002], [mid - ov - frBot, 0.001], [0.012, 0.012 + fin], K));
}
{ // what sits in the door bins, so it swings out with the door
  const [b0, b1, b2, b3] = BINS;
  stock.doorFridge(fridgeDoor, { fit: true, eggY: b3.f, eggX: EGGS, eggDY: 0, eggTurn: Math.PI / 2, jarY: b2.f, botY: b1.f, canY: b0.f, deps: { egg: b3.d, jar: b2.d, bottle: b1.d, can: b0.d }, inside });
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
// the herbs' stems and leaves (each turned inside a turned stem) go flat into the bunch's own frame, for the same reason
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
// Grain (BENCHMARK.md section 10): Haier names the door finish "Steel", brushed across the doors as both colours' photos
// show, so the doors and their edges get the hairline running across under a clear coat; the painted sides and top the
// soft peel. No grain on the prints, the control panel, the rear photo or the handle
await exportGLB(root, clips, OUT, only({
  DoorFreezer: `${T}/door_freezer_${F0.tex}.jpg`,
  DoorFridge: `${T}/door_fridge_${F0.tex}.jpg`,
  HandleChannel: `${T}/channel.jpg`,
  HaierMark: `${T}/logo.png`,
  PrintMagic: `${T}/print_magic_${F0.tex}.png`,
  Display: `${T}/display.jpg`,
  RearPlate: `${T}/rear.jpg`,
  ControlBox: `${T}/ctrlbox.jpg`,
  PrintIcemaker: `${T}/print_icemaker.png`,
  PrintBigbox: `${T}/print_bigbox.png`,
  PrintFreezebox: `${T}/print_freezebox.png`,
  PrintBottleguard: `${T}/print_bottle.png`,
  PrintCooling: `${T}/print_cooling.png`,
  PrintLed: `${T}/print_led.png`,
  ...stock.textures(),
}), { dir: `${TEX}/grain`, materials: {
  DoorFreezer: { type: F0.grain, dir: "h", clearcoat: F0.coat },
  DoorFridge: { type: F0.grain, dir: "h", clearcoat: F0.coat },
  DoorEdge: { type: F0.grain, dir: "h", clearcoat: F0.coat },
  SidePaint: { type: "peel_soft" }, TopPaint: { type: "peel_soft" },
} });

// ── the colours as material variants (KHR_materials_variants), Nickel Steel first: each later colour gets its own copy
// of the door, edge, paint and MAGICCONVERTIBLE materials, with that colour's textures, paint and steel ──
{
  const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
  const doc = await io.readBinary(new Uint8Array(fs.readFileSync(OUT)));
  const ext = doc.createExtension(KHRMaterialsVariants);
  const vs = FINISHES.map((f) => ext.createVariant(f.name));
  const lin = (c) => [(c >> 16) & 255, (c >> 8) & 255, c & 255].map((v) => { v /= 255; return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; });
  const texs = new Map();
  const tex = (file) => {
    if (!texs.has(file)) texs.set(file, doc.createTexture(file.split("/").pop().replace(/\.\w+$/, "")).setImage(new Uint8Array(fs.readFileSync(file))).setMimeType(file.endsWith(".png") ? "image/png" : "image/jpeg"));
    return texs.get(file);
  };
  const mats = doc.getRoot().listMaterials(), named = (n) => mats.find((m) => m.getName() === n);
  // what each finish sets on each material
  const SET = {
    DoorFridge: (m, f) => { m.setBaseColorTexture(tex(`${T}/door_fridge_${f.tex}.jpg`)).setMetallicFactor(f.metal).setRoughnessFactor(f.rough); },
    DoorFreezer: (m, f) => { m.setBaseColorTexture(tex(`${T}/door_freezer_${f.tex}.jpg`)).setMetallicFactor(f.metal).setRoughnessFactor(f.rough); },
    DoorEdge: (m, f) => { m.setBaseColorFactor([...lin(f.edge), 1]).setMetallicFactor(f.metal).setRoughnessFactor(f.rough); },
    SidePaint: (m, f) => { m.setBaseColorFactor([...lin(f.side), 1]); },
    TopPaint: (m, f) => { m.setBaseColorFactor([...lin(f.top), 1]); },
    PrintMagic: (m, f) => { m.setBaseColorTexture(tex(`${T}/print_magic_${f.tex}.png`)); },
  };
  const GRAINED = ["DoorFridge", "DoorFreezer", "DoorEdge"];
  const alt = {};
  for (const [name, set] of Object.entries(SET)) {
    const b = named(name);
    if (!b) throw new Error(`no material ${name}`);
    alt[name] = FINISHES.map((f, i) => {
      if (!i) return b;
      const m = b.clone().setName(`${name}${f.name.replace(/\s+/g, "")}`);
      set(m, f);
      if (GRAINED.includes(name)) {    // that colour's own hairline and clear coat
        if (f.grain !== F0.grain) { m.setNormalTexture(tex(`${TEX}/grain/${f.grain}_n.jpg`)); m.getNormalTextureInfo().setTexCoord(1); }
        const coat = b.getExtension("KHR_materials_clearcoat");
        if (coat) m.setExtension("KHR_materials_clearcoat", coat.clone().setClearcoatFactor(f.coat[0]).setClearcoatRoughnessFactor(f.coat[1]));
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
