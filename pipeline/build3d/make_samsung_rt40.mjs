// Samsung RT40H28W1CPNL, 236 L double door, Camellia Purple (flat doors with the camellia print).
// Built to Samsung India's published size for this code, 555 W x 1545 H x 657 D mm (the manual for RT40H28* gives
// 555 x 1545 x 657; the page rounds the height to 1.54 m and gives 572 mm deep without the door), and to Samsung's
// photos of this code: the straight-on front (the print, the SAMSUNG wordmark, the silver strip along the fridge door's
// top), the front with the model's own BEE label, the 3/4 views (teal-navy sides, the doors' purple edges with the
// silver deco line), the rear and the open doors. Freezer on top (53 L), fridge below (183 L), both doors hinged on the
// right with recessed handles in the free edge, opening 110 and 115 degrees (manual).
// Samsung's open-door photos of this code read about 8% narrower for their height than the body (they are not used for
// widths); heights inside are read off them with the camera corrected, the freezer's off its close-up (NOTES.md).
// Inside, as those photos and the manual's "Refrigerator at a glance" show it: in the freezer a clear shelf, the
// Movable (twist) Ice Maker at the front left, the slider control, a grille along the floor's front; in the fridge the
// top LED, three glass shelves, the dial on the back wall, the deodorizer, the cover over the Big Box (Big Veg Box) and
// the Big Box; two bins on the freezer door, and on the fridge door a wide bin, the egg and variety bins and the bottle
// bin. The manual says the shelves and the twist ice maker come out without a tool, so the shelves, the cover and the
// Big Box are one part (FridgeTrays) and the ice tray slides out with its bin (IceMaker). Stocked for a south Indian
// kitchen (stock_lg.mjs, fit: true), re-laid for this narrower cabinet as the Haier HRF-2902 builder does.
// usage: node make_samsung_rt40.mjs <entry .json, never products.json> <tex dir> <out.glb>
import fs from "node:fs";
import { LGStock } from "./stock_lg.mjs";
import { THREE, mat, mesh, box, faced, group, flipV, stateClips, exportGLB, productParts, saveZones } from "./lib.mjs";

const [PRODUCTS, TEX, OUT] = process.argv.slice(2);
const ID = "samsung-rt40h28w1cpnl";
const T = `${TEX}/samsung_rt40`;

// ── size (metres) ──
const W = 0.555, H = 1.545, D = 0.657;                 // Samsung India / the manual: 555 x 1545 x 657 mm
const cabTop = 1.535;                                  // the cabinet's and the doors' top (front and rear photos: 1535 mm);
                                                       // the top hinge's cover makes the published 1545 ("with hinge")
const Dc = 0.572;                                      // Samsung India: 57.2 cm deep without the door
const seal = 0.025, doorT = 0.06;                      // the 85 mm left for the door: its gasket and liner (25 mm, ESTIMATED)
                                                       // and its body, 60 mm (the open-door photo's free edge, ESTIMATED)
const zBack = -D / 2, zFront = zBack + Dc;
const wall = 0.03, base = 0.04, floorTop = 0.072;      // the cabinet's underside 40 mm up (front photo: the grey band
                                                       // under the doors 40-48 mm, the feet below); the fridge floor (ESTIMATED)
// doors on Samsung's front (0.805 px per mm, floor row 1258): the fridge door 51-1011 mm with its 7.4 mm silver strip
// along the top, the gap 1011-1023 mm, the freezer door 1023-1535 mm
const frBot = 0.051, frTop = 1.0114, fzBot = 1.0226, stripH = 0.0074;
const yGap = (frTop + fzBot) / 2;
// inside, ESTIMATED (NOTES.md): the fridge's off the open-door photo (eye 0.662 m up at row 749; the cabinet's front at
// 0.735 px per mm, the shelves' rims 0.717, the back wall 0.666), the freezer's off its close-up g_551092221
const fzCeil = 1.004, fzFloor = 1.065, fzTop = 1.495;  // fridge ceiling; freezer floor and ceiling
const fzShelfTop = 1.325;                              // the freezer's clear shelf
const s1 = 0.844, s2 = 0.657, s3 = 0.512, sCover = 0.388; // the three glass shelves' tops, the Big Box cover's top
const bbBottom = 0.078, bbTop = 0.361;                 // the Big Box
// door bins (open-door photo, ESTIMATED): floor above the door's bottom edge, end-wall height, depth out from the liner
const BINS = {
  FridgeDoor: [{ f: 0.035, h: 0.1, d: 0.095 }, { f: 0.345, h: 0.06, d: 0.085, twin: true }, { f: 0.573, h: 0.12, d: 0.095 }],
  FreezerDoor: [{ f: 0.069, h: 0.088, d: 0.075 }, { f: 0.255, h: 0.1, d: 0.08 }],
};
const linerFace = 0.012;                               // the door liner's face, 12 mm inside the cabinet's front
const reach = (name) => Math.max(...BINS[name].map((b) => b.d)) + linerFace;
const frontFridge = zFront - reach("FridgeDoor") - 0.01;   // shelves, cover and Big Box end here
const frontFreezer = zFront - reach("FreezerDoor") - 0.01;

// ── materials ──
const sidePaint = mat("SidePaint", 0xffffff, { metal: 0.3, rough: 0.5 });       // teal-navy (photo texture)
const topPaint = mat("TopPaint", 0x16252e, { metal: 0.15, rough: 0.7 });        // the top: the sides' paint (ESTIMATED, no photo shows it)
const navy = mat("CabinetNavy", 0x22323c, { metal: 0.2, rough: 0.55 });         // the front frame round the openings (open-door photo 40/57/67)
// the print: satin, part metal, no grain. At metalness 0 the studio's tall light at 28 deg washed the dark print pale grey
// in the default view (door median 95 against 42 in Samsung's 3/4 photos); here 51 / 43 / 47 at -28 / 0 / 28 deg (NOTES.md)
const freezerFront = mat("FreezerFront", 0xffffff, { metal: 0.5, rough: 0.5 });
const fridgeFront = mat("FridgeFront", 0xffffff, { metal: 0.5, rough: 0.5 });
const doorEdge = mat("DoorEdge", 0x22052c, { rough: 0.3 });                     // the doors' purple edges (open-door photo 31/4/44)
const deco = mat("SilverDeco", 0xc9ccd2, { metal: 0.85, rough: 0.3 });          // the silver deco line and strip
const recess = mat("Recess", 0x03121b, { rough: 0.6 });                         // the handle slots (photo 1/13/21)
const labelM = mat("LabelBEE", 0xffffff, { rough: 0.5, opacity: 0.999 });
const markM = mat("SamsungMark", 0xffffff, { rough: 0.45, opacity: 0.999 });
const liner = mat("Liner", 0xdfe2e5, { rough: 0.72, emissive: 0x7d8186, emissiveIntensity: 0.55 });
const glass = mat("Glass", 0xcfe3ea, { rough: 0.05, opacity: 0.45 });
const binMat = mat("Bin", 0xcfe0ea, { rough: 0.15, opacity: 0.62 });
const frosted = mat("Frosted", 0xe6edf1, { rough: 0.45, opacity: 0.78 });
const clearLite = mat("ClearLight", 0xdfe7ee, { rough: 0.12, opacity: 0.3, side: THREE.DoubleSide });
const gasket = mat("Gasket", 0x55595f, { rough: 0.85 });
const light = mat("Light", 0xffffff, { emissive: 0xf4f8ff, emissiveIntensity: 1.4 });
const backFz = mat("BackFreezer", 0xffffff, { rough: 0.7 }), backFr = mat("BackFridge", 0xffffff, { rough: 0.7 });
const bigBoxPrint = mat("BigBoxPrint", 0xffffff, { rough: 0.5, opacity: 0.999 });
const railGrey = mat("Rail", 0xdfe2e6, { rough: 0.5 });
const white = mat("WhitePlastic", 0xf1f3f5, { rough: 0.45 });
const iceGrip = mat("IceGrip", 0xe4e7ea, { rough: 0.4 });
const iceCube = mat("IceCube", 0xe3f4ff, { rough: 0.08, opacity: 0.72 });
const grille = mat("Grille", 0xbfc3c8, { rough: 0.6 });
const deoGrey = mat("Deodorizer", 0xc8ccd1, { rough: 0.55 });
const foot = mat("Foot", 0x18191d, { rough: 0.7 });
const plinth = mat("Plinth", 0xb5b7ba, { metal: 0.3, rough: 0.5 });             // the grey band under the doors (photo 189/190/192)
const rearMat = mat("Rear", 0xffffff, { metal: 0.35, rough: 0.55 });
const bayMat = mat("Bay", 0xffffff, { rough: 0.7 });
const baseRear = mat("BaseRear", 0xffffff, { metal: 0.3, rough: 0.6 });
const bayDark = mat("BayDark", 0x0f1012, { rough: 0.85 });
const cordMat = mat("Cord", 0x2b2d31, { rough: 0.6 });
const plugMat = mat("Plug", 0x2f3135, { rough: 0.5 });
const pinMat = mat("Pin", 0xb7bbc0, { metal: 0.9, rough: 0.3 });
const silver = mat("Silver", 0xc9ccd0, { metal: 0.9, rough: 0.25 });

const rp = JSON.parse(fs.readFileSync(`${T}/cord_path.json`, "utf8"));
const bayTop = rp.bay_top, bayD = 0.15;      // the compressor bay opens at the rear up to 274 mm (rear photo); its depth ESTIMATED

const root = group("SamsungRT40");
const cab = group("Cabinet");
root.add(cab);
const plane = (name, w, h, m, x, y, z) => mesh(name, flipV(new THREE.PlaneGeometry(w, h)), m, x, y, z);
const cyl = (name, rt, rb, h, m, x, y, z, seg = 20) => mesh(name, new THREE.CylinderGeometry(rt, rb, h, seg), m, x, y, z);

// ── cabinet: teal-navy painted steel outside, white inside, the front frame navy ──
const shellH = cabTop - base, shellMid = base + shellH / 2, zMid = zBack + Dc / 2;
cab.add(faced("SideLeft", wall, shellH, Dc, [liner, sidePaint, topPaint, foot, navy, sidePaint], -W / 2 + wall / 2, shellMid, zMid));
cab.add(faced("SideRight", wall, shellH, Dc, [sidePaint, liner, topPaint, foot, navy, sidePaint], W / 2 - wall / 2, shellMid, zMid));
cab.add(faced("Top", W - 2 * wall, cabTop - fzTop, Dc, [liner, liner, topPaint, liner, navy, topPaint], 0, (cabTop + fzTop) / 2, zMid));
// the base, in front of the compressor bay; its front is the grey band under the doors
cab.add(faced("Base", W - 2 * wall, floorTop - base, Dc - bayD - 0.012, [liner, liner, liner, foot, plinth, foot], 0, base + (floorTop - base) / 2, zFront - (Dc - bayD - 0.012) / 2));
const wallH = fzTop - bayTop;
cab.add(faced("BackWall", W - 2 * wall, wallH, wall, [liner, liner, liner, liner, liner, rearMat], 0, bayTop + wallH / 2, zBack + 0.004 + wall / 2));
// the rear: Samsung's embossed silver panel above the compressor bay, 3.2 mm narrower and 1.6 mm shorter than the body so
// the exporter's 0.8 mm separation keeps the published width (as on the RT45)
const rearH = cabTop - bayTop;
cab.add(mesh("RearPanel", flipV(new THREE.BoxGeometry(W - 0.0032, rearH - 0.0032, 0.004)), [foot, foot, foot, foot, foot, rearMat], 0, bayTop + rearH / 2, zBack + 0.002));
// the open bay: dark walls and ceiling, the photographed machinery on its back wall, and the grey base plate under it
const bayH = bayTop - base, bayW = W - 2 * wall;
cab.add(faced("BayCeiling", bayW, 0.01, bayD, [bayDark, bayDark, liner, bayDark, bayDark, bayDark], 0, bayTop + 0.005, zBack + bayD / 2));
cab.add(box("BayFloor", bayW, 0.004, bayD, bayDark, 0, base + 0.002, zBack + bayD / 2));
for (const sx of [-1, 1]) cab.add(box("BaySide", 0.004, bayH - 0.0012, bayD, bayDark, sx * (bayW / 2 - 0.002), base + (bayH - 0.0012) / 2, zBack + bayD / 2));
cab.add(mesh("BayBack", flipV(new THREE.BoxGeometry(bayW, bayH, 0.012)), [liner, liner, liner, liner, liner, bayMat], 0, base + bayH / 2, zBack + bayD + 0.006));
cab.add(mesh("BasePlateRear", flipV(new THREE.BoxGeometry(W - 0.004, base - 0.004, 0.004)), [foot, foot, foot, foot, foot, baseRear], 0, 0.002 + (base - 0.004) / 2, zBack + 0.002));
{ // the power cord from its connector on the rear cover down to the three-pin plug. Samsung's rear photo of this code
  // shows the connector but no cord: route ESTIMATED (see cord_path.json); cord 8 mm, plug 45 x 42 x 16 mm
  const pts = rp.cord.map(([x, y]) => new THREE.Vector3(x, y, zBack - 0.004));
  cab.add(mesh("PowerCord", new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts, false, "centripetal"), 100, rp.cord_d / 2, 6, false), cordMat));
  const [px, py] = rp.plug;
  const sh = new THREE.Shape(), w = 0.045, h = 0.042, r = 0.012;
  sh.moveTo(-w / 2 + r, -h / 2); sh.lineTo(w / 2 - r, -h / 2); sh.quadraticCurveTo(w / 2, -h / 2, w / 2, -h / 2 + r);
  sh.lineTo(w / 2, h / 2 - r); sh.quadraticCurveTo(w / 2, h / 2, w / 2 - r, h / 2); sh.lineTo(-w / 2 + r, h / 2);
  sh.quadraticCurveTo(-w / 2, h / 2, -w / 2, h / 2 - r); sh.lineTo(-w / 2, -h / 2 + r); sh.quadraticCurveTo(-w / 2, -h / 2, -w / 2 + r, -h / 2);
  const plug = mesh("Plug", new THREE.ExtrudeGeometry(sh, { depth: 0.016, bevelEnabled: true, bevelSize: 0.002, bevelThickness: 0.002, bevelSegments: 2, curveSegments: 8 }), plugMat, px, py, zBack - 0.004);
  plug.rotation.y = Math.PI;
  cab.add(plug);
  for (const [dx, dy] of [[0, 0.0105], [-0.0095, -0.0065], [0.0095, -0.0065]]) {
    const pin = mesh("PlugPin", new THREE.CylinderGeometry(0.0026, 0.0026, 0.016, 10), pinMat, px + dx, py + dy, zBack - 0.004 - 0.016 - 0.008);
    pin.rotation.x = Math.PI / 2; cab.add(pin);
  }
}
cab.add(faced("Divider", W - 2 * wall, fzFloor - fzCeil, Dc - wall - 0.004, [liner, liner, liner, liner, liner, liner], 0, (fzCeil + fzFloor) / 2, zMid + (wall + 0.004) / 2));
// hinges on the right: the middle one in the doors' gap, the bottom bracket over the right foot (front photo: silver,
// x 1110-1140, rows 1218-1232), the top one's cover on the cabinet's top behind the freezer door (10 mm: "with hinge")
cab.add(box("HingeMid", 0.03, fzBot - frTop - 0.002, 0.05, silver, W / 2 - 0.022, yGap, zFront + 0.026));
cab.add(box("HingeBottom", 0.036, 0.008, 0.07, silver, W / 2 - 0.03, base + 0.004, zFront + 0.03));
cab.add(box("HingeCoverTop", 0.07, H - cabTop - 0.0008, 0.06, topPaint, W / 2 - 0.045, cabTop + (H - cabTop - 0.0008) / 2, zFront - 0.035));
// under the doors, the feet: on the front a round foot at the left,
// the adjustable one under the hinge at the right and a black block in the middle (photo); two at the back (ESTIMATED)
cab.add(cyl("FootFrontL", 0.0215, 0.0215, base, foot, -W / 2 + 0.039, base / 2, zFront - 0.04));
cab.add(cyl("FootFrontR", 0.019, 0.021, base - 0.009, foot, W / 2 - 0.042, (base - 0.009) / 2, zFront - 0.0));
cab.add(box("FootBlock", 0.037, 0.026, 0.03, foot, 0, base - 0.013, zFront - 0.02));
for (const sx of [-1, 1]) cab.add(cyl("FootRear", 0.017, 0.019, base, foot, sx * (W / 2 - 0.045), base / 2, zBack + 0.05));

// ── inside ──
const inW = W - 2 * wall;
const xIn = W / 2 - wall;
const zIn = zBack + 0.004 + wall;                     // the back wall's inner face
const zDuct = zIn + 0.012;                            // the front of the raised back-wall panels
const rails = (name, yTop, z0, z1) => { for (const sx of [-1, 1]) cab.add(box(name, 0.01, 0.012, z1 - z0, railGrey, sx * (inW / 2 - 0.005), yTop - 0.012, (z0 + z1) / 2)); };
const backWall = (name, x0, x1, y0, y1, m) =>
  cab.add(mesh(name, flipV(new THREE.BoxGeometry(x1 - x0, y1 - y0, 0.012)), [liner, liner, liner, liner, m, liner], (x0 + x1) / 2, (y0 + y1) / 2, zIn + 0.006));
// the raised panels, at the sizes tex_samsung_rt40.py drew them (measured on the close-up and the open-door photo)
backWall("FreezerDuct", -0.21, 0.21, 1.071, 1.489, backFz);
backWall("FridgeDuct", -0.13, 0.13, 0.607, 0.945, backFr);
// the fridge: the LED along the ceiling's front (photo: 160 mm), the dial (a white knob, 40 mm across, on the panel),
// the deodorizer under the panel (a grey bar with grilles, 134 x 30 mm, photo)
cab.add(box("FridgeLed", 0.16, 0.008, 0.04, light, 0, fzCeil - 0.004, frontFridge - 0.03));
{
  const knob = cyl("DialKnob", 0.02, 0.02, 0.018, white, 0, 0.79, zDuct + 0.009, 32);
  knob.rotation.x = Math.PI / 2; cab.add(knob);
  const rib = box("DialRib", 0.004, 0.026, 0.004, white, 0, 0.79, zDuct + 0.02);
  cab.add(rib);
}
cab.add(box("DeodorizerBody", 0.134, 0.03, 0.022, deoGrey, 0.005, 0.537, zIn + 0.011));
for (const sx of [-1, 1]) cab.add(box("DeodorizerGrille", 0.026, 0.02, 0.003, grille, 0.005 + sx * 0.048, 0.537, zIn + 0.0235));

// ── the parts that come out (FridgeTrays): the three glass shelves, the cover and the Big Box, with their food ──
const trays = group("FridgeTrays");
cab.add(trays);
function glassShelf(name, yTop, z0) {                 // a glass shelf with its thin frosted front rim
  const z1 = frontFridge, w = inW - 0.012;
  trays.add(box(name, w, 0.006, z1 - 0.009 - z0, glass, 0, yTop - 0.003, (z0 + z1 - 0.009) / 2));
  trays.add(box(name + "Rim", w, 0.012, 0.009, frosted, 0, yTop - 0.004, z1 - 0.0045));
  rails(name + "Rail", yTop - 0.006, zIn, z1 - 0.01);
}
glassShelf("Shelf1", s1, zDuct + 0.002);
glassShelf("Shelf2", s2, zDuct + 0.002);
glassShelf("Shelf3", s3, zIn + 0.002);
{ // the Big Box cover: a glass plate with a frosted front 28 mm tall (photo)
  const z0 = zIn + 0.002, z1 = frontFridge, w = inW - 0.012;
  trays.add(box("VegCover", w, 0.006, z1 - 0.012 - z0, glass, 0, sCover - 0.003, (z0 + z1 - 0.012) / 2));
  trays.add(box("VegCoverFront", w, 0.028, 0.012, frosted, 0, sCover - 0.014, z1 - 0.006));
  rails("VegCoverRail", sCover - 0.006, zIn, z1 - 0.01);
}
// the Big Box (FzBox* are the names qa_bounds reads): one clear drawer, "Big Box" and three fruit icons on its front;
// it stops short of the compressor bay's step at the back
const bbW = inW - 0.014, bbZ0 = zBack + bayD + 0.012 + 0.012, bbZ1 = frontFridge, bbD = bbZ1 - bbZ0, bbZ = (bbZ0 + bbZ1) / 2;
{
  const hh = bbTop - bbBottom;
  trays.add(box("FzBoxFloor", bbW, 0.004, bbD, binMat, 0, bbBottom + 0.002, bbZ));
  trays.add(box("FzBoxBack", bbW, hh, 0.004, binMat, 0, bbBottom + hh / 2, bbZ0 + 0.002));
  trays.add(box("FzBoxL", 0.004, hh, bbD, binMat, -bbW / 2 + 0.002, bbBottom + hh / 2, bbZ));
  trays.add(box("FzBoxR", 0.004, hh, bbD, binMat, bbW / 2 - 0.002, bbBottom + hh / 2, bbZ));
  trays.add(box("FzBoxFront", bbW, hh - 0.012, 0.004, clearLite, 0, bbBottom + (hh - 0.012) / 2, bbZ1 - 0.002));
  trays.add(box("FzBoxRim", bbW + 0.006, 0.012, 0.008, frosted, 0, bbTop - 0.006, bbZ1 - 0.002));
  trays.add(box("FzBoxFootRim", bbW, 0.01, 0.008, frosted, 0, bbBottom + 0.005, bbZ1 - 0.002));
  // the print: 155 x 91 mm, its middle 160 mm up (photo: the panel behind the words, rows 1050-1100)
  trays.add(plane("PrintBigBox", 0.155, 0.091, bigBoxPrint, 0, 0.2, bbZ1 + 0.0003));
}

// ── groceries (stock_lg.mjs, food.mjs): vegetarian South Indian food, eggs, juices, water and soft drinks ──
const stock = LGStock({ T3: `${TEX}/lg_glt3426`, TF: `${TEX}/food`, BR: `${TEX}/brands`, BRT: `${TEX}/brands/small` });
const bbFloor = bbBottom + 0.004;
stock.shelves(trays, {
  // stock_lg.mjs stands the food 3 mm over the height it is given: give it each top less 2.5 mm
  zIn1: zIn, inW, inD: frontFridge - zIn, s1: s1 - 0.0025, s2: s2 - 0.0025, s3: s3 - 0.0025, fz: bbFloor, fit: true,
  vz0: bbZ0 + 0.02, vk: 0.7,
  shelfB: { hw: inW / 2 - 0.03, z0: zDuct + 0.02, z1: frontFridge - 0.015 },
  drawerB: { hw: bbW / 2 - 0.014, z0: bbZ0 + 0.02, z1: bbZ1 - 0.008, y0: bbFloor },
  drawerCeil: sCover - 0.006 - 0.01 - bbFloor,      // the heap stays 1 cm under the cover
});
// the cover over the Big Box: butter, cheese and curd cups (the LG 343 L's Fresh 0 Zone set), as Samsung's stocked
// photo has small tubs there
stock.fresh0(trays, { y: sCover, z: (zIn + frontFridge) / 2 + 0.01 });

// ── freezer inside: the clear shelf, the Movable Ice Maker at the front left, the grille along the floor's front ──
{
  const z0 = zDuct + 0.002, z1 = frontFreezer, w = inW - 0.012;
  cab.add(box("FreezerShelf", w, 0.006, z1 - 0.009 - z0, clearLite, 0, fzShelfTop - 0.003, (z0 + z1 - 0.009) / 2));
  cab.add(box("FreezerShelfRim", w, 0.02, 0.009, frosted, 0, fzShelfTop - 0.008, z1 - 0.0045));
  rails("FreezerShelfRail", fzShelfTop - 0.006, zIn, z1 - 0.01);
}
// the Movable Ice Maker (close-up: 190 mm wide, its left side 45 mm in from the wall, 180 mm tall): a white housing; the
// ice tray (its white front with the pill-shaped grip) and the clear bin under it slide out together
const icW = 0.188, icX = -inW / 2 + 0.045 + icW / 2, icH = 0.18, icD = 0.2, icZ1 = frontFreezer - 0.015, icZ0 = icZ1 - icD;
{
  const y0 = fzFloor, zc = (icZ0 + icZ1) / 2;
  cab.add(box("IceHousingTop", icW, 0.008, icD, white, icX, y0 + icH - 0.004, zc));
  for (const sx of [-1, 1]) cab.add(box("IceHousingSide", 0.005, icH - 0.008, icD, white, icX + sx * (icW / 2 - 0.0025), y0 + (icH - 0.008) / 2, zc));
  cab.add(box("IceHousingBack", icW - 0.01, icH - 0.008, 0.005, white, icX, y0 + (icH - 0.008) / 2, icZ0 + 0.0025));
  // the floor grille (close-up: 410 mm along the floor's front, from x -0.175)
  for (let i = 0; i < 11; i++) cab.add(box("FloorGrille", 0.03, 0.003, 0.005, grille, -0.16 + i * 0.037, fzFloor + 0.0015, frontFreezer - 0.008));
}
const ice = group("IceMaker", icX, fzFloor, 0);
{
  const iw = icW - 0.012, zf = icZ1;
  ice.add(box("IceTrayFace", iw, 0.062, 0.006, white, 0, 0.142, zf - 0.003));
  ice.add(box("IceTrayGrip", 0.062, 0.019, 0.006, iceGrip, 0, 0.142, zf + 0.003));
  ice.add(box("IceTrayBody", iw - 0.004, 0.03, icD - 0.03, white, 0, 0.145, zf - 0.006 - (icD - 0.03) / 2));
  const bd = icD - 0.02, bz = zf - bd / 2, bh = 0.104;
  ice.add(box("IceBinFloor", iw, 0.004, bd, binMat, 0, 0.004, bz));
  ice.add(box("IceBinFront", iw, bh, 0.004, clearLite, 0, 0.002 + bh / 2, zf - 0.002));
  ice.add(box("IceBinRim", iw, 0.01, 0.01, frosted, 0, 0.002 + bh - 0.005, zf - 0.005));
  for (const sx of [-1, 1]) ice.add(box("IceBinSide", 0.004, bh, bd, binMat, sx * (iw / 2 - 0.002), 0.002 + bh / 2, bz));
  ice.add(box("IceBinBack", iw - 0.008, bh, 0.004, binMat, 0, 0.002 + bh / 2, zf - bd + 0.002));
  const cube = new THREE.BoxGeometry(0.028, 0.024, 0.028);
  for (let i = 0; i < 14; i++) {
    const c = mesh("IceCube", cube, iceCube, -0.055 + (i % 4) * 0.036 + (Math.floor(i / 4) % 2) * 0.012, 0.022 + Math.floor(i / 8) * 0.023, zf - 0.04 - Math.floor((i % 8) / 4) * 0.06 - (i % 3) * 0.012);
    c.rotation.set(0.2 * (i % 3), 0.5 * i, 0.15 * (i % 4));
    ice.add(c);
  }
}
cab.add(ice);
stock.freezer(cab, { fit: true, zIn1: zIn, floor: fzFloor, top: fzShelfTop + 0.0005, box: { hw: inW / 2 - 0.03, z0: zDuct + 0.02, z1: icZ0 - 0.01 } });

// The fitted stock is laid out for the LG 343 L's trays (about 540 mm between the walls; this one has 495 and a
// shallower cabinet): the trays are laid out again in rows inside their rims, as the Haier HRF-2902 builder does
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
const drop = (...os) => os.forEach((o) => o && o.parent.remove(o));
{
  const g = trays.getObjectByName("Shelf2Stock"), hw = inW / 2 - 0.03, z0 = zDuct + 0.02;
  drop(g.getObjectByName("RnrBiryani"));
  const d1 = row([g.getObjectByName("CoconutHalf"), g.getObjectByName("WatermelonHalf")], -hw, hw, z0);
  row([g.getObjectByName("NandhanaPalace"), g.getObjectByName("NandhanaPalace2")], -hw, hw, z0 + d1 + 0.03);
}
{
  const g = trays.getObjectByName("Shelf3Stock"), hw = inW / 2 - 0.03, z0 = zIn + 0.035;   // in front of the deodorizer
  const [a0, a1, a2, a3, a4] = kids(g, "Apple"), [o0, o1, o2] = kids(g, "Orange"), [l0, l1] = kids(g, "Lemon");
  drop(g.getObjectByName("AmulMastiDahi"), a1, a4, o1, o2, l0);
  const d1 = row([g.getObjectByName("Bananas"), g.getObjectByName("Grapes"), l1], -hw, hw, z0);
  row([a0, o0, a2, a3], -hw, hw, z0 + d1 + 0.03);
}
{ // the freezer shelf: the three lying packs in one pile at the right, against the back wall's panel
  const g = cab.getObjectByName("OnFreezerShelf");
  const pile = ["ViswasParotta2", "AmulPaneer", "FreshoGreenPeas2"].map((n) => g.getObjectByName(n));
  const x0 = 0.0, x1 = inW / 2 - 0.02, xm = (x0 + x1) / 2, zb = zDuct + 0.03;
  let top = null;
  pile.forEach((o, i) => {
    const b = bbox(o);
    o.position.x += xm + [0, 0.008, -0.006][i] - (b.min.x + b.max.x) / 2;
    o.position.z += zb + [0, 0.01, 0.004][i] - b.min.z;
    if (top != null) o.position.y += top - b.min.y;
    top = (top ?? b.min.y) + (b.max.y - b.min.y);
  });
}
// The Big Box is 28 cm deep at its floor (it stops at the compressor bay's step), so the 34 cm drumsticks lie across it
// at the back instead of along it, and the heap is dropped in again around them (the cauliflower's tilted leaves go into
// its geometry first, as on the Haier HRF-2902, so its box is its real extent). The dropping is stock_lg.mjs's own
// method, copied here because stock_lg.mjs keeps it to itself (as the Samsung RS76 builder does)
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
  settle(v.children.slice().sort((a, b) => HEAP.indexOf(a.name) - HEAP.indexOf(b.name)), { tries: 30, spread: 0.08, bounds: drawerB, ceil: sCover - 0.028 - 0.01 - bbFloor });
}

// ── doors: hinged on the right; the print on flat fronts, purple edges, the silver deco line round each front, the
// recessed handle slot in the free edge ──
const pw = W - 0.002, bw = pw - 0.1;
const inside = (dep) => [-pw / 2 - bw / 2 + 0.004, -pw / 2 + bw / 2 - 0.004, -(linerFace + dep / 2)];
// the small bins: two side by side (photo); the eggs stand in the one at the free edge, four in a row over their cups
const partX = -pw / 2;
const EGGS = [0, 1, 2, 3].map((i) => -pw / 2 - 0.03 - i * 0.05);
const z0Door = seal, zFace = seal + doorT;             // the door body's back and its face, from the cabinet's front
function door(name, y0, h, frontMat, top, openLo, openHi) {
  const pivot = group(name, W / 2, y0, zFront);
  const ph = h - top;
  pivot.add(mesh(name + "Panel", flipV(new THREE.BoxGeometry(pw, ph, doorT)), [doorEdge, doorEdge, doorEdge, doorEdge, frontMat, liner], -pw / 2, ph / 2, z0Door + doorT / 2));
  if (top) pivot.add(mesh(name + "Strip", new THREE.BoxGeometry(pw, top, doorT), [deco, deco, deco, doorEdge, deco, liner], -pw / 2, h - top / 2, z0Door + doorT / 2));
  // the silver deco line round the front (3/4 views: a thin light line at the face's edge), 1.4 mm wide
  const dl = 0.0014, dz = zFace + 0.0007;
  pivot.add(box(name + "DecoL", dl, ph, 0.0008, deco, -pw + dl / 2, ph / 2, dz));
  pivot.add(box(name + "DecoR", dl, ph, 0.0008, deco, -dl / 2, ph / 2, dz));
  if (!top) pivot.add(box(name + "DecoT", pw - 2 * dl, dl, 0.0008, deco, -pw / 2, ph - dl / 2, dz));
  pivot.add(box(name + "DecoB", pw - 2 * dl, dl, 0.0008, deco, -pw / 2, dl / 2, dz));
  // the recessed handle: a slot with round ends in the free edge, 206 mm long and 20 mm across (open-door photo,
  // ESTIMATED): the freezer's centred 174 mm above its bottom edge, the fridge's 169 mm below its top
  const rh = 0.206, ry = name === "FreezerDoor" ? 0.174 : h - 0.169;
  const pocket = mesh(name + "Handle", new THREE.CapsuleGeometry(0.006, rh - 0.012, 4, 10), recess, -pw + 0.0045, ry, z0Door + doorT / 2);
  pocket.scale.z = 0.01 / 0.006;
  pivot.add(pocket);
  // behind it: the gasket ring, the liner (inside the cabinet's opening) and the bins on the liner's face
  const g = 0.018;
  for (const [n, w, hh, x, y] of [["T", pw - 0.02, g, -pw / 2, h - 0.01 - g / 2], ["B", pw - 0.02, g, -pw / 2, 0.01 + g / 2], ["L", g, h - 0.02 - 2 * g, -pw + 0.01 + g / 2, h / 2], ["R", g, h - 0.02 - 2 * g, -0.01 - g / 2, h / 2]])
    pivot.add(box(name + "Gasket" + n, w, hh, seal - 0.002, gasket, x, y, seal / 2));
  const lo = Math.max(0.035, openLo - y0 + 0.004), hi = Math.min(h - 0.035, openHi - y0 - 0.004);
  pivot.add(box(name + "Liner", pw - 0.07, hi - lo, linerFace + seal - 0.002, liner, -pw / 2, (lo + hi) / 2, (seal - 0.002 - linerFace) / 2));
  BINS[name].forEach((b, i) => {
    const zc = -linerFace - b.d / 2, zl = -linerFace - b.d;
    pivot.add(box(`${name}Bin${i}Floor`, bw, 0.004, b.d, binMat, -pw / 2, b.f + 0.002, zc));
    pivot.add(box(`${name}Bin${i}Lip`, bw, b.h - 0.004, 0.004, binMat, -pw / 2, b.f + (b.h - 0.004) / 2, zl + 0.002));
    pivot.add(box(`${name}Bin${i}Rim`, bw, 0.007, 0.005, frosted, -pw / 2, b.f + b.h - 0.0035, zl + 0.0025));
    for (const sx of [-1, 1]) pivot.add(box(`${name}Bin${i}End`, 0.004, b.h, b.d, binMat, -pw / 2 + sx * (bw / 2 - 0.002), b.f + b.h / 2, zc));
    if (b.twin) {
      pivot.add(box(`${name}Bin${i}Part`, 0.008, b.h, b.d, binMat, partX, b.f + b.h / 2, zc));
      for (const x of EGGS) { const c = mesh("EggCup", new THREE.SphereGeometry(0.02, 12, 4, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), binMat, x, b.f, zc); c.scale.y = 0.7; pivot.add(c); }
    }
  });
  return pivot;
}
const fridgeDoor = door("FridgeDoor", frBot, frTop - frBot, fridgeFront, stripH, floorTop, fzCeil);
const freezerDoor = door("FreezerDoor", fzBot, cabTop - fzBot, freezerFront, 0, fzFloor, fzTop);
{
  const h = cabTop - fzBot;
  // the SAMSUNG wordmark, 47 mm wide, centred 86 mm below the freezer door's top (front photo)
  // (the textures carry a clear 10 px margin round the ink: mark 480 x 74 px in 500 x 94, label 633 x 1158 in 653 x 1178)
  const mw = 0.047 * 500 / 480;
  freezerDoor.add(plane("SamsungMarkDecal", mw, mw * 94 / 500, markM, -pw / 2, h - 0.086, zFace + 0.0007));
  // the model's own BEE label: 108 mm wide, its right edge 56 mm in from the hinge edge and its top 82 mm down
  // (Samsung's front with the label, 0.706 px per mm)
  const lw = 0.108, lh = lw * 1158 / 633;
  freezerDoor.add(plane("BeeLabelDecal", lw * 653 / 633, lw * 1178 / 633, labelM, -0.056 - lw / 2, h - 0.082 - lh / 2, zFace + 0.0007));
  // the fridge door's inner top: an embossed panel above the wide bin (photo), no bin
  fridgeDoor.add(box("FridgeDoorEmboss", bw - 0.04, 0.12, 0.004, liner, -pw / 2, 0.80, -linerFace - 0.002));
}
{ // what sits in the door bins, so it swings out with the door. The wide bin holds the bottles and cartons, the small
  // bins the eggs (free-edge side) and two jars (hinge side), the bottle bin at the foot water bottles (stocked photo)
  const F = BINS.FridgeDoor, Z = BINS.FreezerDoor;
  stock.doorFridge(fridgeDoor, { fit: true, eggY: F[1].f, eggX: EGGS, eggDY: 0, eggTurn: Math.PI / 2, jarY: F[1].f, botY: F[2].f, canY: null, deps: { egg: F[1].d, jar: F[1].d, bottle: F[2].d }, inside });
  stock.doorFreezer(freezerDoor, { fit: true, b1: Z[1].f, b2: Z[0].f, dep: Math.min(Z[0].d, Z[1].d), inside });
  // the jars: two in the hinge-side small bin
  drop(...["MothersPickle2", "SakthiSambar", "NandiniGhee"].map((n) => fridgeDoor.getObjectByName(n)));
  fridgeDoor.updateMatrixWorld(true);
  const jars = ["MothersPickle", "AavinGhee"].map((n) => fridgeDoor.getObjectByName(n));
  const [, , zm] = inside(F[1].d);
  const local = (o) => { const b = bbox(o), inv = new THREE.Matrix4().copy(fridgeDoor.matrixWorld).invert(); return b.applyMatrix4(inv); };
  {
    const x0 = partX + 0.004 + 0.004, x1 = -pw / 2 + bw / 2 - 0.004, bs = jars.map(local);
    const w = bs.reduce((s, b) => s + b.max.x - b.min.x, 0), gap = (x1 - x0 - w) / (jars.length + 1);
    let x = x0 + gap;
    jars.forEach((o, i) => { const b = bs[i]; o.position.x += x - b.min.x; o.position.z += zm - (b.min.z + b.max.z) / 2; x += b.max.x - b.min.x + gap; });
  }
  // water: the bottle from the wide bin and three more like it stand in the bottle bin
  const water = fridgeDoor.getObjectByName("Bisleri");
  const ws = [water, ...[2, 3, 4].map((k) => { const c = water.clone(); c.name = `Bisleri${k}`; fridgeDoor.add(c); return c; })];
  ws.forEach((o) => { o.position.y += F[0].f - F[2].f; });
  fridgeDoor.updateMatrixWorld(true);
  {
    const [x0, x1, zb] = inside(F[0].d), bs = ws.map(local);
    const w = bs.reduce((s, b) => s + b.max.x - b.min.x, 0), gap = (x1 - x0 - w) / (ws.length + 1);
    let x = x0 + gap;
    ws.forEach((o, i) => { const b = bs[i]; o.position.x += x - b.min.x; o.position.z += zb - (b.min.z + b.max.z) / 2; x += b.max.x - b.min.x + gap; });
  }
}
root.add(fridgeDoor, freezerDoor);

const parts = productParts(PRODUCTS, ID);
const clips = stateClips(root, parts);
saveZones(PRODUCTS, ID, root, parts);
// Grain: the doors are a printed glossy film (Samsung: "flat doors"), so they and their decals carry none; the painted
// sides and top get the soft peel (ESTIMATED: Samsung publishes no material)
const used = new Set();
root.traverse((o) => o.material && [].concat(o.material).forEach((m) => used.add(m.name)));
const only = (t) => Object.fromEntries(Object.entries(t).filter(([k]) => used.has(k)));
await exportGLB(root, clips, OUT, only({
  FreezerFront: `${T}/door_freezer.jpg`,
  FridgeFront: `${T}/door_fridge.jpg`,
  LabelBEE: `${T}/label.png`,
  SamsungMark: `${T}/mark.png`,
  BackFreezer: `${T}/back_freezer.png`,
  BackFridge: `${T}/back_fridge.png`,
  BigBoxPrint: `${T}/bigbox_print.png`,
  SidePaint: `${T}/side_paint.jpg`,
  Rear: `${T}/rear.jpg`,
  Bay: `${T}/bay.jpg`,
  BaseRear: `${T}/base_rear.jpg`,
  ...stock.textures(),
}), { dir: `${TEX}/grain`, materials: {
  SidePaint: { type: "peel_soft" }, TopPaint: { type: "peel_soft" },
} });
