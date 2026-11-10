// Whirlpool 22439: Intellifresh 431 L 2 star inverter convertible frost-free double door, Alpha Steel (energy label model
// NFT43127IRM1C1TE). Built to Whirlpool India's published size, 700 W x 1690 H x 767 D mm, and to Whirlpool's own photos
// of this code: the straight front (the doors, the touch panel, the fridge door's top cap, the feet), the two 3/4 views
// (the side pocket handles, the hinges, the dark grey sides, the doors' 80 mm), the open and the stocked photos (the
// inside), and the panel close-up. On the straight front the doors are 0.609 px per mm across and the body 0.612 px per
// mm down, so heights are read off it in mm (NOTES.md).
// Freezer on top, fridge below, both hinged on the right. Inside, from Whirlpool's open photo: in the freezer the shelf,
// the back's vent slots, the sensor plate, the dial and the ARCTIC FRESH ice twister on the floor at the left; in the
// fridge the light housing hanging from the ceiling, the DAIRY FRESH box on the top shelf, the air tower down the back
// (its fan box, sensor plate, slots and FRESH FLOW print), three glass shelves, the MICROBLOCK cover, the ORCHARD FRESH
// tray and the two FARM FRESH crispers (Twin Seal, SEALFRESH); on the freezer door two FROZEN FOODS bins, on the fridge
// door two EASY RACKs, the BIG BOTTLE RACK and the BOTTLE RACK.
// Whirlpool publishes no manual, rear photo or door swing for this model: the back is plain (no cord, plug or compressor
// bay is shown anywhere), and every inside depth and the doors' 135 degrees are ESTIMATED (the open photo shows 123-138) (NOTES.md).
// The glass shelves, the DAIRY FRESH box, the MICROBLOCK cover, the orchard tray and the two crispers come out with their
// food (FridgeTrays). Stocked for a south Indian kitchen
// (stock_lg.mjs, fit: true), laid out as Whirlpool's stocked photo: dairy in the DAIRY FRESH box, pots on the cover,
// oranges and lemons in the orchard tray, vegetables in both crispers.
// usage: node make_whirlpool_22439.mjs <entry .json, never products.json> <tex dir> <out.glb>
import fs from "node:fs";
import { NodeIO } from "@gltf-transform/core";
import { ALL_EXTENSIONS, KHRMaterialsVariants } from "@gltf-transform/extensions";
import { LGStock } from "./stock_lg.mjs";
import { THREE, mat, mesh, box, faced, group, flipV, stateClips, exportGLB, productParts, saveZones } from "./lib.mjs";

const [PRODUCTS, TEX, OUT] = process.argv.slice(2);
const ID = "whirlpool-22439";
const T = `${TEX}/whirlpool_22439`;

// ── size (metres): Whirlpool's 700 x 1690 x 767 mm ──
const W = 0.7, H = 1.69, D = 0.767;
const doorT = 0.08, Dc = D - doorT;                  // door thickness ESTIMATED (camera fits to the 3/4 views: 77-88 mm)
const zBack = -D / 2, zFront = zBack + Dc;
const wall = 0.028, backT = 0.045;                   // side walls (open photo: 644 mm between them) and the back (ESTIMATED)
// heights on Whirlpool's straight front (mm = (1117 - row) / 0.6115)
const cabTop = H - 0.008;                            // the cabinet's top, under the freezer door's top edge (ESTIMATED, 3/4 views)
const yFreezer = 1.1766;                             // freezer door, 1176.6-1690 mm
const frBot = 0.0466, frTop = 1.1644;                // fridge door, 46.6-1164.4 mm
const capH = 0.0188, seamH = 0.002;                  // its top cap (1145.6-1164.4) and the dark seam under it
const base = frBot;                                  // the cabinet's underside, at the doors' bottom edge
// inside heights, ESTIMATED from the open photo (0.5555 px per mm on the cabinet's front; NOTES.md)
const floorTop = 0.075;
const fzCeil = 1.13, fzFloor = 1.205;                // the mullion: fridge ceiling, freezer floor
const fzTop = 1.653;                                 // freezer ceiling
const fzShelfTop = 1.448;
const s1 = 0.997, s2 = 0.839, s3 = 0.646;            // the three glass shelves' tops
const sCover = 0.476;                                // the MICROBLOCK cover's top; its front strip 452-478 mm
const orBot = 0.345, orFloor = 0.352, orTop = 0.448; // the ORCHARD FRESH tray: its white base, floor and clear front's top
const cbBottom = 0.078, cbTop = 0.342;               // the two FARM FRESH crispers
// door bins: floor above the door's bottom edge, end-wall height, depth out from the liner (ESTIMATED, open photo); the
// print widths are the prints' own (tex_whirlpool_22439.py)
const BINS = {
  FridgeDoor: [
    { f: 0.055, h: 0.13, d: 0.1, print: "bottle", pw: 0.138 },
    { f: 0.365, h: 0.12, d: 0.1, print: "bigbottle", pw: 0.186 },
    { f: 0.76, h: 0.06, d: 0.09, print: "easy", pw: 0.128 },
    { f: 0.9, h: 0.06, d: 0.09, print: "easy", pw: 0.128, eggs: true },
  ],
  FreezerDoor: [{ f: 0.064, h: 0.07, d: 0.08, print: "frozen", pw: 0.155 }, { f: 0.237, h: 0.07, d: 0.08, print: "frozen", pw: 0.155 }],
};
const linerFace = 0.016;
const reach = (name) => Math.max(...BINS[name].map((b) => b.d)) + linerFace;
const frontFridge = zFront - reach("FridgeDoor") - 0.01;
const frontFreezer = zFront - reach("FreezerDoor") - 0.01;

// ── the four colours Whirlpool sells this body in (catalogue API, 10 Nov 2026: one spec table, one BEE label), Alpha Steel
// (the client's list) first. Each colour's doors and sides are textured from its own photos (tex_whirlpool_22439.py:
// suffix tex for the doors, side for the sides); the doors' edges and the painted top follow each colour's 3/4 views
// (the doors' 80 mm edge strip, both views averaged: Alpha 76, Illusia 84, Gravity 54, Platina 84.5; the sides: 66, 78,
// 41, 41). Gravity Black's fine speckle runs both ways (its front: 1.68 down, 0.91 across), so the soft hairline; and its
// photos show no bright studio strip at 3/4 (doors 50 straight on and at 3/4), so a thinner, rougher clear coat (with
// Alpha Steel's 0.6 / 0.3 the 3/4 doors read 75 and 68). Its doors' edges are set on the 3/4 render: by the ratio they
// read 101 against the photo's 59, a light line round the black doors.
const FINISHES = [
  { name: "Alpha Steel", tex: "", side: "", edge: 0xa4a6aa, top: 0x515256, grain: "hairline" },
  { name: "Illusia Steel", tex: "_is", side: "_is", edge: 0xb4b6bb, top: 0x5f6065, grain: "hairline" },
  { name: "Gravity Black", tex: "_gb", side: "_gb", edge: 0x3e4045, top: 0x323336, grain: "hairline_soft", coat: [0.1, 0.5], rough: 0.62 },
  { name: "Platina Illusia Steel", tex: "_pis", side: "_gb", edge: 0xb4b6bb, top: 0x323336, grain: "hairline" },
];

// ── materials ──
// steel film doors as the LG 343 L's (metal under 0.5, so the iPhone file's part-metal fix applies); the brushed texture
// carries the colour
const steelFz = mat("DoorFreezer", 0xffffff, { metal: 0.38, rough: 0.5 });
const steelFr = mat("DoorFridge", 0xffffff, { metal: 0.38, rough: 0.5 });
const doorEdge = mat("DoorEdge", 0xa4a6aa, { metal: 0.38, rough: 0.5 });       // the doors' sides: the steel wraps round them (3/4 views)
const doorCap = mat("DoorEndCap", 0x3c3e42, { rough: 0.55 });                   // the doors' top and bottom faces: dark grey (front, open photo)
// dark grey painted steel sides: the texture carries the colour and the fall from front to back (3/4 views: left 73 at the
// front to 60 at the back, right 68 to 48); two materials because the two faces' UVs run opposite ways
const sideL = mat("SideSteelL", 0xffffff, { metal: 0.38, rough: 0.5 });
const sideR = mat("SideSteelR", 0xffffff, { metal: 0.38, rough: 0.5 });
const topPaint = mat("TopPaint", 0x515256, { metal: 0.15, rough: 0.7 });
const backPaint = mat("BackPaint", 0x4b4c50, { metal: 0.1, rough: 0.75 });
const frame = mat("FrontFrame", 0x4a4c50, { rough: 0.6 });                      // the side walls' front edges (open photo)
const panelM = mat("TouchPanel", 0xffffff, { metal: 0.7, rough: 0.22 });        // black glass with its print
const capM = mat("FridgeCap", 0xffffff, { metal: 0.4, rough: 0.35 });           // black and silver top cap of the fridge door
const seam = mat("CapSeam", 0x0d0e10, { rough: 0.7 });
const pocket = mat("PocketHandle", 0x1a1b1e, { rough: 0.7 });                  // the side pocket handles' dark slots
const liner = mat("Liner", 0xf1f3f5, { rough: 0.6 });
const linerDk = mat("LinerGrey", 0xdde1e5, { rough: 0.62 });
const gasket = mat("Gasket", 0x6c7176, { rough: 0.85 });
const baseDark = mat("BaseDark", 0x1b1c1f, { rough: 0.8 });
const glass = mat("TemperedGlass", 0xa9cdd6, { rough: 0.05, opacity: 0.55, side: THREE.DoubleSide });
const clear = mat("ClearPlastic", 0xc3d0da, { rough: 0.12, opacity: 0.5, side: THREE.DoubleSide });
const clearLite = mat("ClearPlasticLight", 0xdfe7ee, { rough: 0.12, opacity: 0.26, side: THREE.DoubleSide });
const frosted = mat("Frosted", 0xe6edf1, { rough: 0.45, opacity: 0.78 });
const white = mat("WhitePlastic", 0xf6f7f8, { rough: 0.45 });
const honey = mat("Honeycomb", 0x9a9fa5, { rough: 0.7 });                       // the honeycomb grilles' grey (open photo)
const vent = mat("Vent", 0x6f7378, { rough: 0.7 });                             // the slots read mid grey on the white liner
const ventDk = mat("VentDark", 0x2a2c30, { rough: 0.7 });
const footM = mat("Foot", 0x131416, { rough: 0.7 });
const hingeM = mat("Hinge", 0xc9ccd0, { metal: 0.9, rough: 0.3 });
const sensorM = mat("SensorPlate", 0xffffff, { rough: 0.5 });
const dialScaleM = mat("DialScale", 0xffffff, { rough: 0.5, opacity: 0.999 });
const PRINTS = { dairy: 0.103, freshflow: 0.085, orchard: 0.121, farm: 0.08, frozen: 0.155, easy: 0.128, bigbottle: 0.186, bottle: 0.138, arctic: 0.066, microblock: 0.068, sealfresh: 0.0545, cheese: 0.124, fruits: 0.14, veg: 0.228 };
const PR = {}, printAspect = {};
const pngSize = (f) => { const b = fs.readFileSync(f); return [b.readUInt32BE(16), b.readUInt32BE(20)]; };
for (const k of Object.keys(PRINTS)) {
  PR[k] = mat("Print_" + k, 0xffffff, { rough: 0.5, opacity: 0.999 });
  const [w, h] = pngSize(`${T}/print_${k}.png`);
  printAspect[k] = w / h;
}

const root = group("Whirlpool22439");
const cab = group("Cabinet");
root.add(cab);
const plane = (name, w, h, m, x, y, z) => mesh(name, flipV(new THREE.PlaneGeometry(w, h)), m, x, y, z);
const print = (parent, name, key, x, y, z, w = PRINTS[key], back = false) => { const p = plane(name, w, w / printAspect[key], PR[key], x, y, z); if (back) p.rotation.y = Math.PI; parent.add(p); return p; };
const cyl = (name, rt, rb, h, m, x, y, z, seg = 16) => mesh(name, new THREE.CylinderGeometry(rt, rb, h, seg), m, x, y, z);

// ── cabinet: dark grey painted steel outside, white inside ──
const shellH = cabTop - base, shellMid = base + shellH / 2, zMid = zBack + Dc / 2;
cab.add(faced("SideLeft", wall, shellH, Dc, [liner, sideL, topPaint, baseDark, frame, backPaint], -W / 2 + wall / 2, shellMid, zMid));
cab.add(faced("SideRight", wall, shellH, Dc, [sideR, liner, topPaint, baseDark, frame, backPaint], W / 2 - wall / 2, shellMid, zMid));
cab.add(faced("Top", W - 2 * wall, cabTop - fzTop, Dc, [liner, liner, topPaint, liner, frame, backPaint], 0, (cabTop + fzTop) / 2, zMid));
cab.add(faced("Base", W - 2 * wall, floorTop - base, Dc, [liner, liner, liner, baseDark, linerDk, backPaint], 0, base + (floorTop - base) / 2, zMid));
cab.add(faced("BackWall", W - 2 * wall, fzTop - floorTop, backT, [liner, liner, liner, liner, liner, backPaint], 0, (fzTop + floorTop) / 2, zBack + backT / 2));
cab.add(faced("Divider", W - 2 * wall, fzFloor - fzCeil, Dc - backT, [liner, liner, liner, liner, linerDk, liner], 0, (fzCeil + fzFloor) / 2, zMid + backT / 2));
// the back: the walls' backs, plain. Whirlpool publishes no rear photo or manual for this model, so no cord, plug,
// compressor bay or rating plate is modelled (NOTES.md)
// feet (straight front): a round foot 30-61 mm in from the left edge, and on the right an adjustable foot 10-31 mm in
// from the edge, under the bottom hinge's bracket; the two at the back are ESTIMATED (not shown)
const brT = 0.007, brY = base - 0.0005 - brT / 2;     // the bottom hinge bracket, just under the cabinet
cab.add(cyl("FootFrontL", 0.0145, 0.0155, base, footM, -W / 2 + 0.0455, base / 2, zFront - 0.04));
const ftR = brY - brT / 2 - 0.0005;
cab.add(cyl("FootFrontR", 0.017, 0.018, ftR, hingeM, W / 2 - 0.0205, ftR / 2, zFront - 0.012));
for (const sx of [-1, 1]) cab.add(cyl("FootRear", 0.0145, 0.0155, base, footM, sx * (W / 2 - 0.045), base / 2, zBack + 0.06));
// hinges on the right: the bottom bracket over the right foot, the middle hinge in the doors' gap, the top cover
cab.add(box("HingeBottom", 0.04, brT, 0.075, hingeM, W / 2 - 0.022, brY, zFront + 0.0));
cab.add(box("HingeMid", 0.03, yFreezer - frTop - 0.001, 0.036, hingeM, W / 2 - 0.02, (yFreezer + frTop) / 2, zFront + 0.009));
{ // the top hinge's cover: dark, stepped, on the cabinet top behind the freezer door's right corner (3/4 views)
  const ch = H - 0.001 - cabTop;
  cab.add(box("HingeCoverTop", 0.06, ch, 0.05, topPaint, W / 2 - 0.035, cabTop + ch / 2, zFront - 0.027));
  cab.add(box("HingeCoverStep", 0.035, ch * 0.6, 0.03, topPaint, W / 2 - 0.035, cabTop + ch * 0.3, zFront - 0.067));
}

// ── inside ──
const inW = W - 2 * wall;
const zIn = zBack + backT;
const rails = (parent, name, yTop, z0, z1) => { for (const sx of [-1, 1]) parent.add(box(name, 0.01, 0.012, z1 - z0, linerDk, sx * (inW / 2 - 0.005), yTop - 0.012, (z0 + z1) / 2)); };
const slot = (parent, name, x, y, w, z, m = vent) => parent.add(box(name, w, 0.007, 0.003, m, x, y, z + 0.0015));
// the sensor plate (a grey square with its dot and arcs): a raised plate with its print
function sensorPlate(name, x, y, z) {
  cab.add(box(name, 0.04, 0.04, 0.003, white, x, y, z + 0.0015));
  cab.add(plane(name + "Face", 0.038, 0.038, sensorM, x, y, z + 0.0037));
}
// the freezer: three vent slots across the back over the shelf and three under it, the sensor plate, the dial with its
// scale, the floor's slots and the darker grille, the shelf, and the ARCTIC FRESH ice twister on the floor at the left
const fzX = [-0.13, 0.003, 0.136];
for (const x of fzX) { slot(cab, "FreezerVentTop", x, 1.538, 0.097, zIn); slot(cab, "FreezerVent", x, 1.39, 0.097, zIn); }
sensorPlate("FreezerSensor", 0.007, 1.349, zIn);
{
  const x = 0.018, y = 1.274;
  const knob = cyl("FreezerDial", 0.023, 0.023, 0.014, white, x, y, zIn + 0.007, 32); knob.rotation.x = Math.PI / 2; cab.add(knob);
  const tick = box("FreezerDialMark", 0.003, 0.014, 0.0015, ventDk, x + 0.006, y + 0.006, zIn + 0.0148); tick.rotation.z = -0.8; cab.add(tick);
  cab.add(plane("FreezerDialScale", 0.068, 0.068, dialScaleM, x, y, zIn + 0.0008));
}
for (const [x0, x1] of [[-0.132, -0.035], [0.042, 0.138]]) for (let i = 0; i < 3; i++) slot(cab, "FreezerFloorVent", x0 + (x1 - x0) * (i + 0.5) / 3, 1.245, (x1 - x0) / 3 - 0.006, zIn);
cab.add(box("FreezerGrille", 0.107, 0.01, 0.003, ventDk, 0.1245, 1.262, zIn + 0.0015));
cab.add(box("FreezerRib", 0.008, 0.066, 0.006, white, 0.191, 1.315, zIn + 0.003));   // the upright rib at the right (open photo)
{ // the shelf: glass in a white frame with a deep white front
  const z0 = zIn + 0.002, z1 = frontFreezer, w = inW - 0.012;
  cab.add(box("FreezerShelf", w, 0.006, z1 - 0.014 - z0, glass, 0, fzShelfTop - 0.003, (z0 + z1 - 0.014) / 2));
  cab.add(box("FreezerShelfTrim", w, 0.014, 0.014, white, 0, fzShelfTop - 0.007, z1 - 0.007));
  for (const sx of [-1, 1]) cab.add(box("FreezerShelfSide", 0.008, 0.012, z1 - z0, white, sx * (w / 2 - 0.004), fzShelfTop - 0.006, (z0 + z1) / 2));
  rails(cab, "FreezerShelfRail", fzShelfTop - 0.012, zIn, z1 - 0.01);
}
// the ice twister: a white lid over a clear box, 160 mm wide and 95 mm tall (open photo); its depth is ESTIMATED
const ibW = 0.16, ibH = 0.095, ibD = 0.24, ibX = -0.127, ibZ1 = frontFreezer - 0.012, ibZ0 = ibZ1 - ibD;
{
  const g = group("IceTwister", ibX, fzFloor, 0), lid = 0.045, bh = ibH - lid, bz = (ibZ0 + ibZ1) / 2;
  g.add(box("IceTwisterFloor", ibW - 0.01, 0.004, ibD - 0.01, clear, 0, 0.002, bz));
  for (const sx of [-1, 1]) g.add(box("IceTwisterSide", 0.004, bh, ibD - 0.01, clear, sx * (ibW / 2 - 0.007), bh / 2, bz));
  g.add(box("IceTwisterFront", ibW - 0.014, bh, 0.004, clearLite, 0, bh / 2, ibZ1 - 0.007));
  g.add(box("IceTwisterBack", ibW - 0.014, bh, 0.004, clear, 0, bh / 2, ibZ0 + 0.007));
  g.add(box("IceTwisterLid", ibW, lid, ibD, white, 0, bh + lid / 2, bz));
  print(g, "PrintArctic", "arctic", 0, 0.05, ibZ1 - 0.0045);
  cab.add(g);
}

// the fridge: the light housing hanging from the ceiling at the front, the air tower down the back with its fan box,
// sensor plate, slots and print
const lhX = 0.007, lhW = 0.216, lhBot = 1.024, lhZ1 = frontFridge - 0.006, lhZ0 = lhZ1 - 0.13;   // its depth ESTIMATED
cab.add(box("LightHousing", lhW, fzCeil - lhBot, lhZ1 - lhZ0, white, lhX, (fzCeil + lhBot) / 2, (lhZ0 + lhZ1) / 2));
for (const x of [-0.054, 0.063]) cab.add(box("HousingWindow", 0.018, 0.012, 0.002, ventDk, x, 1.098, lhZ1 + 0.001));
const twX = 0.007, twW = 0.214, twD = 0.015, zTw = zIn + twD;
cab.add(box("AirTower", twW, fzCeil - sCover, twD, liner, twX, (fzCeil + sCover) / 2, zIn + twD / 2));
const fbD = 0.035, zFb = zIn + fbD;                  // the fan box under the top shelf, 889-992 mm
cab.add(box("FanBox", 0.212, 0.103, fbD - twD, liner, 0.009, 0.9405, zTw + (fbD - twD) / 2));
{
  const ring = mesh("FanRing", new THREE.TorusGeometry(0.022, 0.0015, 6, 40), linerDk, 0.011, 0.929, zFb + 0.0005);
  cab.add(ring);
  for (const [x0, x1] of [[-0.086, -0.041], [0.032, 0.077]]) slot(cab, "FanVent", (x0 + x1) / 2, 0.983, x1 - x0, zFb);
}
sensorPlate("FridgeSensor", 0.007, 0.783, zTw);
for (const y of [0.733, 0.625]) for (const [x0, x1] of [[-0.086, -0.041], [0.032, 0.077]]) slot(cab, "TowerVent", (x0 + x1) / 2, y, x1 - x0, zTw);
print(cab, "PrintFreshFlow", "freshflow", 0.007, 0.706, zTw + 0.0007);

function glassShelf(parent, name, yTop) {
  const z0 = zTw + 0.002, z1 = frontFridge, w = inW - 0.014;
  parent.add(box(name, w, 0.006, z1 - 0.012 - z0, glass, 0, yTop - 0.003, (z0 + z1 - 0.012) / 2));
  for (const sx of [-1, 1]) parent.add(box(name + "Side", 0.008, 0.014, z1 - z0, white, sx * (w / 2 - 0.004), yTop - 0.007, (z0 + z1) / 2));
  parent.add(box(name + "Trim", w, 0.016, 0.012, white, 0, yTop - 0.008 + 0.002, z1 - 0.006));
  rails(parent, name + "Rail", yTop - 0.014, zIn, z1 - 0.01);
}
glassShelf(cab, "Shelf1", s1);
glassShelf(cab, "Shelf2", s2);
glassShelf(cab, "Shelf3", s3);
// the DAIRY FRESH box on the top shelf: a clear front, tall at the sides and low under the light housing, with its
// print at the left and the cheese drawing at the right; clear sides back to the air tower
const dbHW = 0.297, dbTop = 1.105, dbLow = 1.02, dbZ1 = frontFridge - 0.004, dbZ0 = zTw + 0.004, cutL = -0.125, cutR = 0.14;
{
  const y0 = s1 + 0.0005;
  cab.add(box("DairyFrontL", cutL + dbHW, dbTop - y0, 0.004, clearLite, (-dbHW + cutL) / 2, (dbTop + y0) / 2, dbZ1 - 0.002));
  cab.add(box("DairyFrontR", dbHW - cutR, dbTop - y0, 0.004, clearLite, (cutR + dbHW) / 2, (dbTop + y0) / 2, dbZ1 - 0.002));
  cab.add(box("DairyFrontC", cutR - cutL, dbLow - y0, 0.004, clearLite, (cutL + cutR) / 2, (dbLow + y0) / 2, dbZ1 - 0.002));
  cab.add(box("DairyRim", 2 * dbHW, 0.006, 0.006, frosted, 0, y0 + 0.003, dbZ1 - 0.003));
  for (const sx of [-1, 1]) cab.add(box("DairySide", 0.004, dbTop - y0, dbZ1 - dbZ0, clear, sx * (dbHW - 0.002), (dbTop + y0) / 2, (dbZ0 + dbZ1) / 2));
  print(cab, "PrintDairy", "dairy", -0.225, 1.066, dbZ1 + 0.0007);
  print(cab, "PrintCheese", "cheese", 0.227, 1.0615, dbZ1 + 0.0007);
}
// the MICROBLOCK cover (fixed): frosted glass in a white frame, its deep front strip with the mark at the right
{
  const z0 = zTw + 0.002, z1 = frontFridge, w = inW - 0.014;
  cab.add(box("CrisperCover", w, 0.006, z1 - 0.014 - z0, frosted, 0, sCover - 0.004, (z0 + z1 - 0.014) / 2));
  cab.add(box("CrisperCoverFront", w, 0.026, 0.014, white, 0, sCover - 0.011, z1 - 0.007));
  for (const sx of [-1, 1]) cab.add(box("CrisperCoverSide", 0.008, 0.014, z1 - z0, white, sx * (w / 2 - 0.004), sCover - 0.007, (z0 + z1) / 2));
  rails(cab, "CrisperCoverRail", sCover - 0.014, zIn, z1 - 0.01);
  print(cab, "PrintMicroblock", "microblock", 0.23, 0.466, z1 + 0.0007);
}

// what comes out (FridgeTrays): the ORCHARD FRESH tray and the two FARM FRESH crispers, with their food
const trays = group("FridgeTrays");
cab.add(trays);
const tZ0 = zIn + 0.008, tZ1 = frontFridge, tD = tZ1 - tZ0, tZ = (tZ0 + tZ1) / 2;
// the ORCHARD FRESH tray: a white base whose front carries the two honeycomb grilles (the crispers' moisture-lock
// cover), clear sides and a clear front with its print and the fruit drawing
const orW = inW - 0.016;
{
  trays.add(box("OrchardBase", orW, orFloor - orBot, tD, white, 0, (orBot + orFloor) / 2, tZ));
  trays.add(box("OrchardBaseFront", orW, 0.394 - orBot, 0.01, white, 0, (orBot + 0.394) / 2, tZ1 - 0.005));
  for (const [x0, x1] of [[-0.246, -0.021], [0.037, 0.255]]) trays.add(box("Honeycomb", x1 - x0, 0.014, 0.003, honey, (x0 + x1) / 2, 0.378, tZ1 + 0.0015));
  trays.add(box("OrchardFront", orW, orTop - 0.394, 0.004, clearLite, 0, (0.394 + orTop) / 2, tZ1 - 0.002));
  trays.add(box("OrchardBack", orW, orTop - orFloor, 0.004, clear, 0, (orFloor + orTop) / 2, tZ0 + 0.002));
  for (const sx of [-1, 1]) trays.add(box("OrchardSide", 0.004, orTop - orFloor, tD, clear, sx * (orW / 2 - 0.002), (orFloor + orTop) / 2, tZ));
  print(trays, "PrintOrchard", "orchard", -0.205, 0.411, tZ1 + 0.0007);
  print(trays, "PrintFruits", "fruits", 0.214, 0.414, tZ1 + 0.0007);
}
// the two crispers, 292 mm wide each: clear tubs, a white rim along the top front, FARM FRESH and the vegetable drawing
// on each front, SEALFRESH on the right one's rim. FzBox* (the names qa_bounds reads) wrap the pair.
const cbW = 0.2925, cbX = [-0.1475, 0.1475], cbFloor = cbBottom + 0.004, cbH = cbTop - cbBottom;
cbX.forEach((x, i) => {
  const L = i === 0, n = L ? "" : "Right";
  trays.add(box(L ? "FzBoxFloor" : "CrisperFloorRight", cbW, 0.004, tD, clear, x, cbBottom + 0.002, tZ));
  trays.add(box(L ? "FzBoxBack" : "CrisperBackRight", cbW, cbH, 0.004, clear, x, cbBottom + cbH / 2, tZ0 + 0.002));
  trays.add(box(L ? "FzBoxL" : "CrisperMidRight", 0.004, cbH, tD, clear, x - cbW / 2 + 0.002, cbBottom + cbH / 2, tZ));
  trays.add(box(L ? "CrisperMidLeft" : "FzBoxR", 0.004, cbH, tD, clear, x + cbW / 2 - 0.002, cbBottom + cbH / 2, tZ));
  trays.add(box(L ? "FzBoxFront" : "CrisperFrontRight", cbW, cbH - 0.02, 0.004, clearLite, x, cbBottom + (cbH - 0.02) / 2, tZ1 - 0.002));
  trays.add(box("CrisperRim" + n, cbW, 0.02, 0.01, white, x, cbTop - 0.01, tZ1 - 0.005));
  print(trays, "PrintFarm" + n, "farm", x - 0.06, 0.249, tZ1 + 0.0007);
  print(trays, "PrintVeg" + n, "veg", x + 0.0145, 0.1955, tZ1 + 0.0007);
});
print(trays, "PrintSealfresh", "sealfresh", 0.235, 0.332, tZ1 + 0.0007);

// ── groceries (stock_lg.mjs, food.mjs) ──
const stock = LGStock({ T3: `${TEX}/lg_glt3426`, TF: `${TEX}/food`, BR: `${TEX}/brands`, BRT: `${TEX}/brands/small` });
const shelfB = { hw: inW / 2 - 0.03, z0: zFb + 0.02, z1: frontFridge - 0.015 };
const cbIn = cbW / 2 - 0.006;
const crisperP = (ceil, vk = 0.68, vz = 0.02) => ({
  zIn1: zIn, inW, inD: frontFridge - zIn, s1: s1 - 0.0025, s2: s2 - 0.0025, s3: s3 - 0.0025, fz: cbFloor, fit: true,
  vz0: tZ0 + vz, vk, shelfB,
  drawerB: { hw: cbIn - 0.008, z0: tZ0 + 0.02, z1: tZ1 - 0.008, y0: cbFloor },
  drawerCeil: ceil,
});
const ceilCb = orBot - 0.01 - cbFloor;
// the heaps' spread front to back (vegDrawer's vk) and start (vz0), different in the two crispers so they don't repeat
// (chosen from a few tries so that every item in both heaps rests across its middle: qa_fit.mjs)
const VK = [0.6, 0.66], VZ = [0, 0.05];
// the left crisper's heap, and the shelves' food: stocked in a group at the left crisper's middle, then the shelves'
// groups go back to the middle of the cabinet
// (stock_lg's fitAll reads world boxes against the drawer's bounds, so each heap is made at x = 0 and moved after)
const left = group("CrisperLeftStock");
trays.add(left);
stock.shelves(left, crisperP(ceilCb, VK[0], VZ[0]));
for (const n of ["Shelf1Stock", "Shelf2Stock", "Shelf3Stock"]) { const g = left.getObjectByName(n); left.remove(g); cab.add(g); }
left.position.x = cbX[0];
// the right crisper's heap: the drawer stocked again with another spread, then turned round its middle, so the two
// do not repeat
const rightPivot = group("CrisperRightStock", cbX[1], 0, tZ), right = group("CrisperRightHeap");
trays.add(right);
stock.shelves(right, crisperP(ceilCb, VK[1], VZ[1]));
for (const n of ["Shelf1Stock", "Shelf2Stock", "Shelf3Stock"]) right.remove(right.getObjectByName(n));
trays.remove(right); rightPivot.add(right); trays.add(rightPivot);
right.position.z = -tZ;
rightPivot.rotation.y = Math.PI;
stock.freezer(cab, { fit: true, zIn1: zIn, floor: fzFloor, top: fzShelfTop + 0.0005, box: { hw: inW / 2 - 0.03, z0: zIn + 0.02, z1: frontFreezer - 0.02 } });

// The fitted stock is laid out for the LG 343 L; Whirlpool's stocked photo puts the dairy in the DAIRY FRESH box,
// pots on the cover and the citrus in the orchard tray, so the groups are laid out again in rows
root.updateMatrixWorld(true);
const bbox = (o) => new THREE.Box3().setFromObject(o);
function row(items, x0, x1, z0) {
  const bs = items.map(bbox), w = bs.reduce((s, b) => s + b.max.x - b.min.x, 0), gap = (x1 - x0 - w) / (items.length + 1);
  if (gap < 0.006) console.warn(`row: ${items.map((o) => o.name)} leave ${(gap * 1000).toFixed(0)} mm between them`);
  let x = x0 + gap, dep = 0;
  items.forEach((o, i) => { const b = bs[i]; o.position.x += x - b.min.x; o.position.z += z0 - b.min.z; x += b.max.x - b.min.x + gap; dep = Math.max(dep, b.max.z - b.min.z); });
  root.updateMatrixWorld(true);
  return dep;
}
const kids = (g, name) => g.children.filter((o) => o.name === name);
const drop = (...os) => os.forEach((o) => o && o.parent.remove(o));
// move an item to another group (all are only moved, never turned) and stand it on that group's floor
const _v = new THREE.Vector3();
const place = (o, to) => { o.parent.remove(o); to.add(o); root.updateMatrixWorld(true); o.position.y += to.getWorldPosition(_v).y - bbox(o).min.y; root.updateMatrixWorld(true); return o; };
const floorAll = (g) => { root.updateMatrixWorld(true); const y = g.getWorldPosition(_v).y; for (const o of g.children) o.position.y += y - bbox(o).min.y; root.updateMatrixWorld(true); };
{ // the top shelf holds the DAIRY FRESH box: butter, cheese and curd cups in it, kept out from under the light housing
  const g = cab.getObjectByName("Shelf1Stock");
  stock.fresh0(cab, { y: s1 - 0.0025 + 0.003, z: 0 });
  root.updateMatrixWorld(true);
  const f = cab.getObjectByName("F0Stock"), [c0, c1, c2] = kids(f, "AmulMastiCup");
  const hw = dbHW - 0.012, z0 = dbZ0 + 0.012;
  floorAll(f);
  const d1 = row([f.getObjectByName("AmulButter1"), f.getObjectByName("AmulCheese"), c0, c1], -hw, hw, z0);
  row([f.getObjectByName("AmulButter2")], -hw, cutL - 0.01, z0 + d1 + 0.02);
  row([c2], cutR + 0.01, hw, z0 + d1 + 0.02);
  // what was on the LG's top shelf: the steel tiffin, the batter and the buttermilk stand on the cover (Whirlpool's photo
  // has pots there), the milk sachets and the biryani box go to the second shelf
  const onCover = group("CoverStock", 0, sCover + 0.0005, 0);
  cab.add(onCover);
  const tiffin = g.getObjectByName("Tiffin"), batter = g.getObjectByName("IdBatterPouch1"), bm = g.getObjectByName("MastiButtermilk");
  for (const o of [tiffin, batter, bm]) place(o, onCover);
  row([tiffin, batter, bm], -shelfB.hw, shelfB.hw, shelfB.z0 + 0.03);
}
{ // the second shelf: the coconut and melon at the back, the takeaway tubs in front
  const g = cab.getObjectByName("Shelf2Stock"), hw = shelfB.hw, z0 = shelfB.z0;
  drop(g.getObjectByName("RnrBiryani"));
  const d1 = row([g.getObjectByName("CoconutHalf"), g.getObjectByName("WatermelonHalf")], -hw, hw, z0);
  row([g.getObjectByName("NandhanaPalace"), g.getObjectByName("NandhanaPalace2")], -hw, hw, z0 + d1 + 0.03);
}
{ // the third shelf: bananas, grapes and apples; the oranges and lemons go to the orchard tray
  const g = cab.getObjectByName("Shelf3Stock"), hw = shelfB.hw, z0 = shelfB.z0;
  const apples = kids(g, "Apple"), oranges = kids(g, "Orange"), lemons = kids(g, "Lemon");
  drop(g.getObjectByName("AmulMastiDahi"));
  const d1 = row([g.getObjectByName("Bananas"), g.getObjectByName("Grapes")], -hw, hw, z0);
  row(apples.slice(0, 4), -hw, hw, z0 + d1 + 0.03);
  drop(...apples.slice(4));
  const orch = group("OrchardStock", 0, orFloor + 0.0005, 0);
  trays.add(orch);
  for (const o of [...oranges, ...lemons]) place(o, orch);
  const oh = orW / 2 - 0.012;
  row([oranges[0], lemons[0], oranges[1], lemons[1], oranges[2]].filter(Boolean), -oh, oh, tZ0 + 0.06);
}
{ // the second shelf also takes the milk sachets and the biryani box from the LG's top shelf
  const g = cab.getObjectByName("Shelf1Stock"), to = cab.getObjectByName("Shelf2Stock");
  const items = ["NandiniMilk", "AavinMilk", "AmulTaazaPouch", "RnrBiryaniBox"].map((n) => g.getObjectByName(n)).filter(Boolean);
  drop(...items.filter((o) => o.name !== "NandiniMilk" && o.name !== "RnrBiryaniBox"));
  const keep = items.filter((o) => o.name === "NandiniMilk" || o.name === "RnrBiryaniBox");
  for (const o of keep) place(o, to);
  const b2 = new THREE.Box3(); to.children.filter((o) => !keep.includes(o)).forEach((o) => b2.union(bbox(o)));
  // a third row only if it fits in front of the other two; what doesn't fit is left out
  const fits = keep.filter((o) => { const b = bbox(o); return b2.max.z + 0.015 + (b.max.z - b.min.z) <= shelfB.z1; });
  drop(...keep.filter((o) => !fits.includes(o)));
  if (fits.length) row(fits, -shelfB.hw, shelfB.hw, b2.max.z + 0.015);
  console.log("second shelf, third row:", fits.map((o) => o.name).join(", ") || "none", "| left out:", keep.filter((o) => !fits.includes(o)).map((o) => o.name).join(", ") || "none");
  if (!g.children.length) cab.remove(g);
}
{ // the frozen packs on the freezer shelf: in one row at the back
  const g = cab.getObjectByName("OnFreezerShelf");
  row(g.children.slice(), -inW / 2 + 0.03, inW / 2 - 0.03, zIn + 0.03);
}

// what slides out with the trays (BENCHMARK 13, as the LG 343 L and the other fridges): the three glass shelves, the DAIRY
// FRESH box and the MICROBLOCK cover with everything on them, together with the orchard tray and the crispers; their
// rails stay in the cabinet. The dairy goes in the top shelf's food group, so that group comes out with its shelf.
{
  let g1 = cab.getObjectByName("Shelf1Stock");
  if (!g1) { g1 = group("Shelf1Stock", 0, s1 + 0.003, 0); cab.add(g1); }
  root.updateMatrixWorld(true);
  const f0 = cab.getObjectByName("F0Stock");
  if (f0) g1.attach(f0);
  const SLIDE = /^(Shelf[123](Side|Trim|Stock)?|Dairy(FrontL|FrontR|FrontC|Rim|Side)|PrintDairy|PrintCheese|CrisperCover(Front|Side)?|PrintMicroblock|CoverStock)$/;
  for (const o of cab.children.filter((o) => SLIDE.test(o.name))) trays.attach(o);
  root.updateMatrixWorld(true);
}

// ── doors: hinged on the right, Alpha Steel fronts ──
const pw = W - 0.002, bw = pw - 0.1;
const inside = (dep) => [-pw / 2 - bw / 2 + 0.004, -pw / 2 + bw / 2 - 0.004, -(linerFace + dep / 2)];
// the eggs: seven at the free end of the top EASY RACK (Whirlpool's stocked photo has seven there)
const EGGS = [0, 1, 2, 3, 4, 5, 6].map((i) => -pw / 2 - bw / 2 + 0.004 + 0.03 + i * 0.045);
// the gaskets stand 2 mm off the door's back so their faces never share its plane
function doorInside(pivot, name, h) {
  pivot.add(box(name + "GasketT", pw - 0.02, 0.014, 0.013, gasket, -pw / 2, h - 0.012, -0.0085));
  pivot.add(box(name + "GasketB", pw - 0.02, 0.014, 0.013, gasket, -pw / 2, 0.012, -0.0085));
  pivot.add(box(name + "GasketL", 0.014, h - 0.02, 0.013, gasket, -pw + 0.012, h / 2, -0.0085));
  pivot.add(box(name + "GasketR", 0.014, h - 0.02, 0.013, gasket, -0.012, h / 2, -0.0085));
  pivot.add(box(name + "Liner", pw - 0.05, h - 0.05, 0.012, liner, -pw / 2, h / 2, -0.01));
  BINS[name].forEach((b, i) => {
    const zc = -linerFace - b.d / 2, zl = -linerFace - b.d;
    pivot.add(box(`${name}Bin${i}Floor`, bw, 0.004, b.d, clear, -pw / 2, b.f + 0.002, zc));
    pivot.add(box(`${name}Bin${i}Lip`, bw, b.h * 0.8, 0.004, clear, -pw / 2, b.f + b.h * 0.4, zl + 0.002));
    pivot.add(box(`${name}Bin${i}Rim`, bw, 0.007, 0.005, frosted, -pw / 2, b.f + b.h * 0.8 - 0.0035, zl + 0.0025));
    for (const sx of [-1, 1]) pivot.add(box(`${name}Bin${i}End`, 0.004, b.h, b.d, clear, -pw / 2 + sx * (bw / 2 - 0.002), b.f + b.h / 2, zc));
    print(pivot, `${name}Bin${i}Print`, b.print, -pw / 2, b.f + b.h * 0.4, zl - 0.0007, b.pw, true);
    if (b.eggs) for (const x of EGGS) { const c = mesh("EggCup", new THREE.SphereGeometry(0.02, 12, 4, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), clear, x, b.f, zc); c.scale.y = 0.7; pivot.add(c); }
  });
}
// a side pocket handle: the dark slot in the door's left edge (3/4 views; its height on the door ESTIMATED from them)
const pocketSlot = (pivot, name, y0, y1) => pivot.add(box(name, 0.004, y1 - y0, 0.012, pocket, -pw + 0.0015, (y0 + y1) / 2, doorT * 0.55));
// the touch panel: 100 x 248.6 mm of black glass from the freezer door's top edge down, centred, its bottom corners
// rounded (6 mm)
function panelPlane(w, h, r) {
  const s = new THREE.Shape();
  s.moveTo(-w / 2, h / 2); s.lineTo(-w / 2, -h / 2 + r); s.quadraticCurveTo(-w / 2, -h / 2, -w / 2 + r, -h / 2);
  s.lineTo(w / 2 - r, -h / 2); s.quadraticCurveTo(w / 2, -h / 2, w / 2, -h / 2 + r); s.lineTo(w / 2, h / 2); s.lineTo(-w / 2, h / 2);
  const g = new THREE.ShapeGeometry(s, 6), p = g.attributes.position, uv = g.attributes.uv;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, (p.getX(i) + w / 2) / w, (h / 2 - p.getY(i)) / h);
  return g;
}
const freezerDoor = group("FreezerDoor", W / 2, yFreezer, zFront);
{
  const h = H - yFreezer;
  freezerDoor.add(mesh("FreezerPanel", flipV(new THREE.BoxGeometry(pw, h, doorT)), [doorEdge, doorEdge, doorCap, doorCap, steelFz, liner], -pw / 2, h / 2, doorT / 2));
  freezerDoor.add(mesh("TouchPanelGlass", panelPlane(0.1, 0.2486, 0.006), panelM, -pw / 2, h - 0.1243, doorT + 0.0007));
  pocketSlot(freezerDoor, "PocketHandleFreezer", 1.224 - yFreezer, 1.422 - yFreezer);
  doorInside(freezerDoor, "FreezerDoor", h);
}
const fridgeDoor = group("FridgeDoor", W / 2, frBot, zFront);
{
  const h = frTop - frBot, lowH = h - capH - seamH;
  fridgeDoor.add(mesh("FridgePanel", flipV(new THREE.BoxGeometry(pw, lowH, doorT)), [doorEdge, doorEdge, doorCap, doorCap, steelFr, liner], -pw / 2, lowH / 2, doorT / 2));
  const sd = doorT - 0.003;                              // the seam: a dark groove 3 mm deep under the cap
  fridgeDoor.add(box("CapSeam", pw, seamH, sd, seam, -pw / 2, lowH + seamH / 2, sd / 2));
  fridgeDoor.add(mesh("FridgeCapBand", flipV(new THREE.BoxGeometry(pw, capH, doorT)), [doorEdge, doorEdge, doorCap, doorCap, capM, liner], -pw / 2, lowH + seamH + capH / 2, doorT / 2));
  pocketSlot(fridgeDoor, "PocketHandleFridge", 0.91 - frBot, 1.11 - frBot);
  doorInside(fridgeDoor, "FridgeDoor", h);
}
{ // what sits in the door bins, so it swings out with the door
  const F = BINS.FridgeDoor, Z = BINS.FreezerDoor;
  stock.doorFridge(fridgeDoor, { fit: true, eggY: F[3].f, eggX: EGGS, eggDY: 0, eggTurn: Math.PI / 2, jarY: F[2].f, botY: F[1].f, canY: F[0].f, deps: { egg: F[3].d, jar: F[2].d, bottle: F[1].d, can: F[0].d }, inside });
  stock.doorFreezer(freezerDoor, { fit: true, b1: Z[1].f, b2: Z[0].f, dep: Math.min(Z[0].d, Z[1].d), inside });
  // the ghee pouch stands 133 mm in the 140 mm between the two EASY RACKs: left out (never scaled)
  drop(fridgeDoor.getObjectByName("NandiniGhee"));
}
root.add(freezerDoor, fridgeDoor);

const parts = productParts(PRODUCTS, ID);
const clips = stateClips(root, parts);
saveZones(PRODUCTS, ID, root, parts);
{ // the open fridge door against everything pulled out with the trays (both open at once in the page)
  const P = Object.fromEntries(parts.map((p) => [p.key, p]));
  fridgeDoor.rotation.y = THREE.MathUtils.degToRad(P.fridge.angle);
  trays.position.z += P.trays.slide[2];
  root.updateMatrixWorld(true);
  // each door mesh as its own box turned with the door (about y only) against each pulled-out mesh's world box: the two
  // overlap only if they overlap in height and on every one of the four axes in plan (separating axes)
  const out = [], hits = [];
  trays.traverse((o) => o.isMesh && out.push([o, bbox(o)]));
  fridgeDoor.traverse((d) => {
    if (!d.isMesh) return;
    d.geometry.computeBoundingBox();
    const g = d.geometry.boundingBox, bd = bbox(d);
    const c = [[g.min.x, g.min.z], [g.max.x, g.min.z], [g.max.x, g.max.z], [g.min.x, g.max.z]].map(([x, z]) => new THREE.Vector3(x, 0, z).applyMatrix4(d.matrixWorld));
    const ax = [[1, 0], [0, 1], [c[1].x - c[0].x, c[1].z - c[0].z], [c[3].x - c[0].x, c[3].z - c[0].z]].map(([x, z]) => { const l = Math.hypot(x, z) || 1; return [x / l, z / l]; });
    for (const [t, bt] of out) {
      if (bd.max.y <= bt.min.y || bt.max.y <= bd.min.y) continue;
      const a = [[bt.min.x, bt.min.z], [bt.max.x, bt.min.z], [bt.max.x, bt.max.z], [bt.min.x, bt.max.z]];
      let pen = Infinity;
      for (const [ux, uz] of ax) {
        const pa = a.map(([x, z]) => x * ux + z * uz), pb = c.map((v) => v.x * ux + v.z * uz);
        pen = Math.min(pen, Math.min(Math.max(...pa), Math.max(...pb)) - Math.max(Math.min(...pa), Math.min(...pb)));
      }
      if (pen > 0) hits.push(`${d.name} and ${t.name} by ${(pen * 1000).toFixed(1)} mm`);
    }
  });
  console.log(hits.length ? `WARNING: the open fridge door meets the pulled-out trays: ${hits.join("; ")}` : "the open fridge door clears everything pulled out with the trays");
  fridgeDoor.rotation.y = 0; trays.position.z -= P.trays.slide[2];
  root.updateMatrixWorld(true);
}
{ // the cauliflowers' tilted leaves: bake their tilt into their geometry so qa_fit measures the real extent (as Haier)
  trays.traverse((c) => {
    if (c.name !== "Cauliflower") return;
    for (const m of c.children) if (m.isMesh && (m.rotation.x || m.rotation.z)) {
      m.updateMatrix(); m.geometry = m.geometry.clone().applyMatrix4(m.matrix);
      m.position.set(0, 0, 0); m.rotation.set(0, 0, 0); m.scale.set(1, 1, 1);
    }
  });
}
const used = new Set();
root.traverse((o) => o.material && [].concat(o.material).forEach((m) => used.add(m.name)));
const only = (t) => Object.fromEntries(Object.entries(t).filter(([k]) => used.has(k)));
// Grain: the doors are horizontally brushed steel under a glossy film (Whirlpool's photos), so the hairline across them
// with the clear coat that catches the studio's strips (roughness 0.3, as the Whirlpool 22343: at 0.12 the default view's
// tall strip washes the door out); the painted steel sides, top and back get the soft peel. No grain on the panel, cap
// or prints.
await exportGLB(root, clips, OUT, only({
  DoorFreezer: `${T}/door_freezer.jpg`,
  DoorFridge: `${T}/door_fridge.jpg`,
  SideSteelL: `${T}/side_l.jpg`,
  SideSteelR: `${T}/side_r.jpg`,
  TouchPanel: `${T}/panel.jpg`,
  FridgeCap: `${T}/cap.jpg`,
  SensorPlate: `${T}/icon_sensor.jpg`,
  DialScale: `${T}/dial_scale.png`,
  ...Object.fromEntries(Object.keys(PR).map((k) => ["Print_" + k, `${T}/print_${k}.png`])),
  ...stock.textures(),
}), { dir: `${TEX}/grain`, materials: {
  DoorFreezer: { type: "hairline", dir: "h", clearcoat: [0.6, 0.3] },
  DoorFridge: { type: "hairline", dir: "h", clearcoat: [0.6, 0.3] },
  DoorEdge: { type: "hairline_soft", dir: "h" },
  SideSteelL: { type: "peel_soft" }, SideSteelR: { type: "peel_soft" }, TopPaint: { type: "peel_soft" }, BackPaint: { type: "peel_soft" },
} });

// ── the colours as material variants (KHR_materials_variants), Alpha Steel first: each later colour gets its own copy of
// the doors', edges', sides' and top's materials with its own textures, paint and grain ──
{
  const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
  const doc = await io.readBinary(new Uint8Array(fs.readFileSync(OUT)));
  const ext = doc.createExtension(KHRMaterialsVariants);
  const vs = FINISHES.map((f) => ext.createVariant(f.name));
  const lin = (c) => [(c >> 16) & 255, (c >> 8) & 255, c & 255].map((v) => { v /= 255; return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; });
  const texs = new Map();
  const tex = (file) => {
    const bytes = fs.readFileSync(file);   // an image already in the file (a grain map) is used again, not copied
    const same = doc.getRoot().listTextures().find((t) => t.getImage() && Buffer.compare(Buffer.from(t.getImage()), bytes) === 0);
    if (same) return same;
    if (!texs.has(file)) texs.set(file, doc.createTexture(file.split("/").pop().replace(/\.\w+$/, "")).setImage(new Uint8Array(fs.readFileSync(file))).setMimeType(file.endsWith(".png") ? "image/png" : "image/jpeg"));
    return texs.get(file);
  };
  const mats = doc.getRoot().listMaterials(), named = (n) => mats.find((m) => m.getName() === n);
  const SET = {
    DoorFreezer: (m, f) => m.setBaseColorTexture(tex(`${T}/door_freezer${f.tex}.jpg`)),
    DoorFridge: (m, f) => m.setBaseColorTexture(tex(`${T}/door_fridge${f.tex}.jpg`)),
    DoorEdge: (m, f) => m.setBaseColorFactor([...lin(f.edge), 1]),
    SideSteelL: (m, f) => m.setBaseColorTexture(tex(`${T}/side_l${f.side}.jpg`)),
    SideSteelR: (m, f) => m.setBaseColorTexture(tex(`${T}/side_r${f.side}.jpg`)),
    TopPaint: (m, f) => m.setBaseColorFactor([...lin(f.top), 1]),
  };
  const GRAINED = ["DoorFreezer", "DoorFridge"];
  const alt = {};
  for (const [name, set] of Object.entries(SET)) {
    const b = named(name);
    if (!b) throw new Error(`no material ${name}`);
    alt[name] = FINISHES.map((f, i) => {
      if (!i) return b;
      const m = b.clone().setName(`${name}${f.name.replace(/\s+/g, "")}`);
      set(m, f);
      if (GRAINED.includes(name) && f.grain !== FINISHES[0].grain) {   // that colour's own brushing, on the same 100 mm tile
        m.setNormalTexture(tex(`${TEX}/grain/${f.grain}_n.jpg`)); m.getNormalTextureInfo().setTexCoord(1);
      }
      if (GRAINED.includes(name) && f.rough) m.setRoughnessFactor(f.rough);
      const coat = b.getExtension("KHR_materials_clearcoat");
      if (GRAINED.includes(name) && f.coat && coat) m.setExtension("KHR_materials_clearcoat", coat.clone().setClearcoatFactor(f.coat[0]).setClearcoatRoughnessFactor(f.coat[1]));
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
