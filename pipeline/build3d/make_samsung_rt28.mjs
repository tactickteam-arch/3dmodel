// Samsung RT28C3053S8, 236 L double door (Digital Inverter), Elegant Inox.
// Built to the published size, 555 W x 1545 H x 637 D mm (Sangeetha's listing for this code: 154.5 cm high, 63.7 cm deep;
// Samsung's own size picture on that listing: 55.50 cm wide, 1.54 m high, 63.70 cm deep), 572 mm deep without the door
// (Samsung India's spec table for RT28C3052S8, the same body: NOTES.md), and to Samsung's photos of this model (the 3/4
// views, the open doors empty and stocked, the close-ups and the rear; Sangeetha's listing for RT28C3053S8 shows the same
// pictures). Freezer on top (53 L), fridge below (183 L), both doors hinged on the right and opening 135 degrees (Samsung's
// manual for RT28, DA68-03374A, Clearance table). The doors' face is Elegant Inox (a brushed steel look); along the
// freezer door's foot runs a chrome lip with the Digital Inverter Technology badge, and the fridge door's top has the
// recessed handle pocket under it.
// Inside, as the open-door photos and the manual's "Refrigerator at a glance" show it: in the freezer the blue Cool Pack
// shelf, the Movable (twist) Ice Maker at the front left, the slider control, a grille along the floor's front; in the
// fridge the LED at the ceiling's front, the Fresh Room tray, the Temp. Control dial on the back wall, the Easy Slide
// shelf, the Deodorizing Filter, a toughened glass shelf, the Big Box cover with its MoistFresh Zone plate and the Big
// Box; two bins on the freezer door, and on the fridge door the Tall Bottle Guard bin, two small (egg) bins side by side
// and the bottle bin. The Fresh Room, the shelves, the cover and the Big Box come out (FridgeTrays); the ice tray slides
// out with its bin (IceMaker). Stocked for a south Indian kitchen (stock_lg.mjs, fit: true), re-laid for this narrower
// cabinet as the RT40H28 builder (the same 555 mm cabinet) does.
// usage: node make_samsung_rt28.mjs <entry .json, never products.json> <tex dir> <out.glb>
import fs from "node:fs";
import { LGStock } from "./stock_lg.mjs";
import { THREE, mat, mesh, box, faced, group, flipV, stateClips, exportGLB, productParts, saveZones } from "./lib.mjs";

const [PRODUCTS, TEX, OUT] = process.argv.slice(2);
const ID = "samsung-rt28c3053s8";
const T = `${TEX}/samsung_rt28`;

// ── size (metres) ──
const W = 0.555, H = 1.545, D = 0.637;                 // 55.5 x 154.5 x 63.7 cm (Sangeetha's listing; Samsung's size picture)
const cabTop = 1.535;                                  // the cabinet's and the doors' top (the 3/4 views and the rear, ESTIMATED);
                                                       // the top hinge's cover makes the published 1545 ("with hinge")
const Dc = 0.572;                                      // 57.2 cm deep without the door (Samsung India, the same body)
const seal = 0.018, doorT = 0.0434;                    // the 65 mm left for the door: gasket and liner 18 mm, its body 43.4 mm and
                                                       // the freezer's chrome lip 3.6 mm proud of it with its badge (ESTIMATED)
const zBack = -D / 2, zFront = zBack + Dc;
const wall = 0.03, base = 0.025, floorTop = 0.072;     // the cabinet's underside 25 mm up (rear photo); the fridge floor (ESTIMATED)
// doors on Samsung's two 3/4 views (0.77 px per mm up at the near edge, NOTES.md): the fridge door 36-1004 mm, the gap,
// the freezer door 1021-1535 mm; along the freezer door's foot a chrome lip 17 mm tall reaching 3 mm below it, and in the
// fridge door's top the handle pocket 36 mm deep; both run from 68.5 to 477 mm from the free (left) edge
const frBot = 0.036, frTop = 1.004, fzBot = 1.021;
const yGap = (frTop + fzBot) / 2;
const LIP = { x0: 0.0685, x1: 0.477, h: 0.017, drop: 0.003, proud: 0.003 }, POCKET = { x0: 0.0685, x1: 0.477, h: 0.036, dep: 0.03 };
// inside, ESTIMATED (NOTES.md), off the open-door photo g52_535050747: the cabinet's front at 0.7394 px per mm up, the
// rims 0.7213, the back wall 0.670, eye 0.662 m up at row 744; the freezer off its close-up g52_535050750
const fzCeil = 1.004, fzFloor = 1.065, fzTop = 1.495;  // fridge ceiling; freezer floor and ceiling
const coolTop = 1.318, coolT = 0.03;                   // the Cool Pack shelf
const sFresh = 0.848, freshTop = 0.979;                // the Fresh Room tray's floor and its rails under the ceiling
const sSlide = 0.636, slideLip = 0.697;                // the Easy Slide shelf's floor and its white front's top
const s3 = 0.518, sCover = 0.376;                      // the glass shelf's top, the Big Box cover's top
const bbBottom = 0.081, bbTop = 0.36;                  // the Big Box
// door bins (open-door photo, ESTIMATED): floor above the door's bottom edge, end-wall height, depth out from the liner
const BINS = {
  FridgeDoor: [{ f: 0.042, h: 0.09, d: 0.095 }, { f: 0.337, h: 0.07, d: 0.085, twin: true }, { f: 0.574, h: 0.118, d: 0.095, tall: true }],
  FreezerDoor: [{ f: 0.05, h: 0.088, d: 0.075 }, { f: 0.245, h: 0.1, d: 0.08 }],
};
const linerFace = 0.012;                               // the door liner's face, 12 mm inside the cabinet's front
const reach = (name) => Math.max(...BINS[name].map((b) => b.d)) + linerFace;
const frontFridge = zFront - reach("FridgeDoor") - 0.01;   // shelves, trays, cover and Big Box end here
const frontFreezer = zFront - reach("FreezerDoor") - 0.01;

// ── materials ──
const sidePaint = mat("SidePaint", 0xffffff, { metal: 0.3, rough: 0.5 });       // dark grey (photo texture)
const topPaint = mat("TopPaint", 0x3f4145, { metal: 0.15, rough: 0.7 });        // the top: the sides' paint (ESTIMATED, no photo shows it)
const frame = mat("CabinetFrame", 0x55575b, { metal: 0.2, rough: 0.55 });       // the front frame round the openings (open-door photo)
// Elegant Inox: a brushed steel look, horizontal hairlines (as the RT45's EZ Clean Steel)
const freezerFront = mat("FreezerFront", 0xffffff, { metal: 0.15, rough: 0.35 });
const fridgeFront = mat("FridgeFront", 0xffffff, { metal: 0.15, rough: 0.35 });
const doorEdge = mat("DoorEdge", 0x76787c, { metal: 0.3, rough: 0.45 });      // the doors' edges: grey, as the 3/4 views show them
const chrome = mat("ChromeLip", 0xb4b7bc, { metal: 0.7, rough: 0.25 });       // the freezer door's lip (photo 169-228)
const groove = mat("LipGroove", 0x2a2c30, { rough: 0.6 });
const pocketMat = mat("Pocket", 0x16171a, { metal: 0.3, rough: 0.25 });        // the handle pocket: glossy black (photo 22-75)
const markM = mat("SamsungMark", 0xffffff, { rough: 0.45, opacity: 0.999 });
const badgeM = mat("BadgePrint", 0xffffff, { rough: 0.4, opacity: 0.999 });
const liner = mat("Liner", 0xdfe2e5, { rough: 0.72, emissive: 0x7d8186, emissiveIntensity: 0.55 });
const glass = mat("Glass", 0xcfe3ea, { rough: 0.05, opacity: 0.45 });
const binMat = mat("Bin", 0xcfe0ea, { rough: 0.15, opacity: 0.62 });
const frosted = mat("Frosted", 0xe6edf1, { rough: 0.45, opacity: 0.78 });
const clearLite = mat("ClearLight", 0xdfe7ee, { rough: 0.12, opacity: 0.3, side: THREE.DoubleSide });
const gasket = mat("Gasket", 0x8d9196, { rough: 0.85 });
const light = mat("Light", 0xffffff, { emissive: 0xf4f8ff, emissiveIntensity: 1.4 });
const backFz = mat("BackFreezer", 0xffffff, { rough: 0.7 }), backFr = mat("BackFridge", 0xffffff, { rough: 0.7 });
const deoM = mat("DeodorizerPrint", 0xffffff, { rough: 0.5 });
const coolTopM = mat("CoolPackTop", 0xffffff, { rough: 0.45 });
const coolBlue = mat("CoolPack", 0x8cb8e6, { rough: 0.45 });                    // the Cool Pack's sides (close-up 149/192/237)
const pr = (n) => mat(n, 0xffffff, { rough: 0.5, opacity: 0.999 });
const bigBoxPrint = pr("BigBoxPrint"), icePrint = pr("IceMakerPrint"), freshPrint = pr("FreshRoomPrint"), slidePrint = pr("EasySlidePrint");
const tallPrint = pr("TallBottlePrint"), moistPrint = pr("MoistFreshPrint");
const railGrey = mat("Rail", 0xdfe2e6, { rough: 0.5 });
const white = mat("WhitePlastic", 0xf1f3f5, { rough: 0.45 });
const iceGrip = mat("IceGrip", 0xe4e7ea, { rough: 0.4 });
const iceCube = mat("IceCube", 0xe3f4ff, { rough: 0.08, opacity: 0.72 });
const grille = mat("Grille", 0xbfc3c8, { rough: 0.6 });
const foot = mat("Foot", 0x18191d, { rough: 0.7 });
const plinth = mat("Plinth", 0x2a2b2e, { rough: 0.6 });                         // the dark band under the doors (photo 35-50)
const rearMat = mat("Rear", 0xffffff, { metal: 0.05, rough: 0.6 });         // the rear photo reads light silver (median 235): little metal
const bayMat = mat("Bay", 0xffffff, { rough: 0.7 });
const baseRear = mat("BaseRear", 0xffffff, { metal: 0.05, rough: 0.6 });
const bayDark = mat("BayDark", 0x0f1012, { rough: 0.85 });
const cordMat = mat("Cord", 0x2b2d31, { rough: 0.6 });
const plugMat = mat("Plug", 0x2f3135, { rough: 0.5 });
const pinMat = mat("Pin", 0xb7bbc0, { metal: 0.9, rough: 0.3 });
const silver = mat("Silver", 0xc9ccd0, { metal: 0.9, rough: 0.25 });

const rp = JSON.parse(fs.readFileSync(`${T}/cord_path.json`, "utf8"));
const bayTop = rp.bay_top, bayD = 0.15;      // the compressor bay opens at the rear up to 257 mm (rear photo); its depth ESTIMATED

const root = group("SamsungRT28");
const cab = group("Cabinet");
root.add(cab);
const plane = (name, w, h, m, x, y, z) => mesh(name, flipV(new THREE.PlaneGeometry(w, h)), m, x, y, z);
const cyl = (name, rt, rb, h, m, x, y, z, seg = 20) => mesh(name, new THREE.CylinderGeometry(rt, rb, h, seg), m, x, y, z);

// ── cabinet: dark grey painted steel outside, white inside, the front frame grey ──
const shellH = cabTop - base, shellMid = base + shellH / 2, zMid = zBack + Dc / 2;
cab.add(faced("SideLeft", wall, shellH, Dc, [liner, sidePaint, topPaint, foot, frame, sidePaint], -W / 2 + wall / 2, shellMid, zMid));
cab.add(faced("SideRight", wall, shellH, Dc, [sidePaint, liner, topPaint, foot, frame, sidePaint], W / 2 - wall / 2, shellMid, zMid));
cab.add(faced("Top", W - 2 * wall, cabTop - fzTop, Dc, [liner, liner, topPaint, liner, frame, topPaint], 0, (cabTop + fzTop) / 2, zMid));
cab.add(faced("Base", W - 2 * wall, floorTop - base, Dc - bayD - 0.012, [liner, liner, liner, foot, plinth, foot], 0, base + (floorTop - base) / 2, zFront - (Dc - bayD - 0.012) / 2));
const wallH = fzTop - bayTop;
cab.add(faced("BackWall", W - 2 * wall, wallH, wall, [liner, liner, liner, liner, liner, rearMat], 0, bayTop + wallH / 2, zBack + 0.004 + wall / 2));
// the rear: Samsung's dimpled silver panel above the compressor bay, 3.2 mm narrower and 1.6 mm shorter than the body so
// the exporter's 0.8 mm separation keeps the published width (as on the RT40H28)
const rearH = cabTop - bayTop;
cab.add(mesh("RearPanel", flipV(new THREE.BoxGeometry(W - 0.0032, rearH - 0.0032, 0.004)), [foot, foot, foot, foot, foot, rearMat], 0, bayTop + rearH / 2, zBack + 0.002));
// the open bay: dark walls and ceiling, the photographed compressor and tray on its back wall, the grey base plate under it
const bayH = bayTop - base, bayW = W - 2 * wall;
cab.add(faced("BayCeiling", bayW, 0.01, bayD, [bayDark, bayDark, liner, bayDark, bayDark, bayDark], 0, bayTop + 0.005, zBack + bayD / 2));
cab.add(box("BayFloor", bayW, 0.004, bayD, bayDark, 0, base + 0.002, zBack + bayD / 2));
for (const sx of [-1, 1]) cab.add(box("BaySide", 0.004, bayH - 0.0012, bayD, bayDark, sx * (bayW / 2 - 0.002), base + (bayH - 0.0012) / 2, zBack + bayD / 2));
cab.add(mesh("BayBack", flipV(new THREE.BoxGeometry(bayW, bayH, 0.012)), [liner, liner, liner, liner, liner, bayMat], 0, base + bayH / 2, zBack + bayD + 0.006));
cab.add(mesh("BasePlateRear", flipV(new THREE.BoxGeometry(W - 0.004, base - 0.004, 0.004)), [foot, foot, foot, foot, foot, baseRear], 0, 0.002 + (base - 0.004) / 2, zBack + 0.002));
{ // the power cord down the back to its three-pin plug. Samsung's rear photo shows no cord: route ESTIMATED (cord_path.json,
  // as the RT40H28 of the same cabinet); cord 8 mm, plug 45 x 42 x 16 mm
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
cab.add(faced("Divider", W - 2 * wall, fzFloor - fzCeil, Dc - wall - 0.004, [liner, liner, liner, liner, frame, liner], 0, (fzCeil + fzFloor) / 2, zMid + (wall + 0.004) / 2));
// the frame's flange under the divider, down to 995 mm: the fridge door's top gasket closes on it (ESTIMATED: the photos
// show the gap between the doors dark)
cab.add(box("DividerFlange", W - 2 * wall, fzCeil - 0.995, 0.004, frame, 0, (fzCeil + 0.995) / 2, zFront - 0.002));
// hinges on the right: the middle one in the doors' gap (open-door photo: silver, two pins), the bottom bracket over the
// right foot (close-up g52_535050749), the top one's cover on the cabinet's top behind the freezer door ("with hinge")
cab.add(box("HingeMid", 0.03, fzBot - frTop - 0.002, 0.05, silver, W / 2 - 0.022, yGap, zFront + 0.026));
cab.add(box("HingeBottom", 0.036, 0.008, 0.06, silver, W / 2 - 0.03, base + 0.004, zFront + 0.025));
cab.add(box("HingeCoverTop", 0.07, H - cabTop - 0.0008, 0.06, topPaint, W / 2 - 0.045, cabTop + (H - cabTop - 0.0008) / 2, zFront - 0.035));
// the feet: two adjustable front feet (the 3/4 views: ribbed, black), two at the back (ESTIMATED)
cab.add(cyl("FootFrontL", 0.019, 0.021, base, foot, -W / 2 + 0.042, base / 2, zFront - 0.03));
cab.add(cyl("FootFrontR", 0.019, 0.021, base, foot, W / 2 - 0.042, base / 2, zFront - 0.03));
for (const sx of [-1, 1]) cab.add(cyl("FootRear", 0.017, 0.019, base, foot, sx * (W / 2 - 0.045), base / 2, zBack + 0.05));

// ── inside ──
const inW = W - 2 * wall;
const zIn = zBack + 0.004 + wall;                     // the back wall's inner face
const zDuct = zIn + 0.012;                            // the front of the raised back-wall panels
const rails = (name, yTop, z0, z1) => { for (const sx of [-1, 1]) cab.add(box(name, 0.01, 0.012, z1 - z0, railGrey, sx * (inW / 2 - 0.005), yTop - 0.012, (z0 + z1) / 2)); };
const backWall = (name, x0, x1, y0, y1, m) =>
  cab.add(mesh(name, flipV(new THREE.BoxGeometry(x1 - x0, y1 - y0, 0.012)), [liner, liner, liner, liner, m, liner], (x0 + x1) / 2, (y0 + y1) / 2, zIn + 0.006));
// the raised panels, at the sizes tex_samsung_rt28.py drew them
backWall("FreezerDuct", -0.21, 0.21, 1.071, 1.489, backFz);
backWall("FridgeDuct", -0.134, 0.134, 0.69, 0.86, backFr);
// the fridge: the LED along the ceiling's front, the Temp. Control knob (45 mm across, open-door photo), the Deodorizing
// Filter housing (135 x 35 mm, its middle 540 mm up)
cab.add(box("FridgeLed", 0.16, 0.008, 0.04, light, 0, fzCeil - 0.004, frontFridge - 0.03));
{
  const knob = cyl("DialKnob", 0.0225, 0.0225, 0.018, white, 0, 0.787, zDuct + 0.009, 32);
  knob.rotation.x = Math.PI / 2; cab.add(knob);
  cab.add(box("DialRib", 0.004, 0.028, 0.004, white, 0, 0.787, zDuct + 0.02));
}
cab.add(mesh("Deodorizer", flipV(new THREE.BoxGeometry(0.135, 0.035, 0.016)), [white, white, white, white, deoM, white], 0, 0.54, zIn + 0.008));

// ── the parts that come out (FridgeTrays): the Fresh Room, the Easy Slide shelf, the glass shelf, the cover and the Big
// Box, with their food ──
const trays = group("FridgeTrays");
cab.add(trays);
const tw = inW - 0.012;
{ // the Fresh Room: a clear tray hung from rails under the ceiling, "Fresh Room" on its front (open-door photo: the tray
  // 845-979 mm, the print's middle 910 mm up)
  const z0 = zIn + 0.03, z1 = frontFridge, d = z1 - z0, zc = (z0 + z1) / 2, wallH = 0.085;
  trays.add(box("FreshRoomFloor", tw - 0.01, 0.004, d, binMat, 0, sFresh - 0.002, zc));
  trays.add(box("FreshRoomFront", tw - 0.01, wallH, 0.004, clearLite, 0, sFresh + wallH / 2 - 0.004, z1 - 0.002));
  trays.add(box("FreshRoomBack", tw - 0.01, wallH * 0.6, 0.004, binMat, 0, sFresh + wallH * 0.3 - 0.004, z0 + 0.002));
  for (const sx of [-1, 1]) trays.add(box("FreshRoomSide", 0.004, wallH, d, binMat, sx * ((tw - 0.01) / 2 - 0.002), sFresh + wallH / 2 - 0.004, zc));
  trays.add(box("FreshRoomRim", tw - 0.004, 0.01, 0.008, frosted, 0, sFresh + wallH - 0.009, z1 - 0.004));
  for (const sx of [-1, 1]) trays.add(box("FreshRoomHanger", 0.008, freshTop - sFresh - wallH + 0.01, d, frosted, sx * (tw / 2 - 0.004), (freshTop + sFresh + wallH - 0.01) / 2, zc));
  trays.add(plane("PrintFreshRoom", 0.14, 0.022, freshPrint, 0, 0.905, z1 + 0.0006));
}
{ // the Easy Slide shelf: a glass floor in a white frame, its white front 61 mm tall with "Easy Slide" (photo), on rollers
  const z0 = zDuct + 0.002, z1 = frontFridge, d = z1 - z0, zc = (z0 + z1) / 2;
  trays.add(box("EasySlideGlass", tw - 0.02, 0.006, d - 0.012, glass, 0, sSlide - 0.003, zc - 0.006));
  for (const sx of [-1, 1]) trays.add(box("EasySlideSide", 0.01, 0.03, d, white, sx * (tw / 2 - 0.005), sSlide + 0.009, zc));
  trays.add(box("EasySlideFront", tw, slideLip - sSlide + 0.012, 0.012, white, 0, (slideLip + sSlide - 0.012) / 2, z1 - 0.006));
  trays.add(plane("PrintEasySlide", 0.1, 0.02, slidePrint, 0, (slideLip + sSlide - 0.012) / 2, z1 + 0.0006));
  rails("EasySlideRail", sSlide - 0.006, zIn, z1 - 0.01);
}
{ // the toughened glass shelf with its thin frosted front rim
  const z0 = zIn + 0.002, z1 = frontFridge;
  trays.add(box("Shelf3", tw, 0.006, z1 - 0.009 - z0, glass, 0, s3 - 0.003, (z0 + z1 - 0.009) / 2));
  trays.add(box("Shelf3Rim", tw, 0.012, 0.009, frosted, 0, s3 - 0.004, z1 - 0.0045));
  rails("Shelf3Rail", s3 - 0.006, zIn, z1 - 0.01);
}
{ // the Big Box cover: a glass plate with a frosted front 16 mm tall and the MoistFresh Zone plate under its middle
  const z0 = zIn + 0.002, z1 = frontFridge;
  trays.add(box("VegCover", tw, 0.006, z1 - 0.012 - z0, glass, 0, sCover - 0.003, (z0 + z1 - 0.012) / 2));
  trays.add(box("VegCoverFront", tw, 0.016, 0.012, frosted, 0, sCover - 0.008, z1 - 0.006));
  trays.add(plane("PrintMoistFresh", 0.12, 0.0256, moistPrint, 0, sCover - 0.0095, z1 + 0.0006));
  rails("VegCoverRail", sCover - 0.006, zIn, z1 - 0.01);
}
// the Big Box (FzBox* are the names qa_bounds reads): one clear drawer, "Big Box" and three fruit icons on its front; it
// stops short of the compressor bay's step at the back
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
  // the print: 155 x 91 mm, "Big Box" 222 mm up and the icons 192 (open-door photo)
  trays.add(plane("PrintBigBox", 0.155, 0.091, bigBoxPrint, 0, 0.199, bbZ1 + 0.0003));
}

// ── groceries (stock_lg.mjs, food.mjs): vegetarian South Indian food, eggs, juices, water and soft drinks ──
const stock = LGStock({ T3: `${TEX}/lg_glt3426`, TF: `${TEX}/food`, BR: `${TEX}/brands`, BRT: `${TEX}/brands/small` });
const bbFloor = bbBottom + 0.004;
stock.shelves(trays, {
  // stock_lg.mjs stands the food 3 mm over the height it is given: give it each top less 2.5 mm
  zIn1: zIn, inW, inD: frontFridge - zIn, s1: sFresh - 0.0025, s2: sSlide - 0.0025, s3: s3 - 0.0025, fz: bbFloor, fit: true,
  vz0: bbZ0 + 0.02, vk: 0.7,
  shelfB: { hw: inW / 2 - 0.03, z0: zDuct + 0.02, z1: frontFridge - 0.025 },
  drawerB: { hw: bbW / 2 - 0.014, z0: bbZ0 + 0.02, z1: bbZ1 - 0.008, y0: bbFloor },
  drawerCeil: sCover - 0.006 - 0.01 - bbFloor,      // the heap stays 1 cm under the cover
});
stock.fresh0(trays, { y: sCover, z: (zIn + frontFridge) / 2 + 0.01 });

// ── freezer inside: the Cool Pack shelf, the Movable Ice Maker at the front left, the grille along the floor's front ──
{
  const z0 = zDuct + 0.002, z1 = frontFreezer, w = inW - 0.016, d = z1 - z0;
  cab.add(mesh("CoolPack", flipV(new THREE.BoxGeometry(w, coolT, d)), [coolBlue, coolBlue, coolTopM, coolBlue, coolBlue, coolBlue], 0, coolTop - coolT / 2, (z0 + z1) / 2));
  rails("CoolPackRail", coolTop - coolT + 0.004, zIn, z1 - 0.01);
}
// the Movable Ice Maker (close-up: 190 mm wide, its left side 45 mm in from the wall, 180 mm tall): a white housing; the
// ice tray (its white front with the pill-shaped grip) and the clear bin under it, "Movable Ice Maker" on the bin, slide
// out together
const icW = 0.188, icX = -inW / 2 + 0.045 + icW / 2, icH = 0.18, icD = 0.2, icZ1 = frontFreezer - 0.015, icZ0 = icZ1 - icD;
{
  const y0 = fzFloor, zc = (icZ0 + icZ1) / 2;
  cab.add(box("IceHousingTop", icW, 0.008, icD, white, icX, y0 + icH - 0.004, zc));
  for (const sx of [-1, 1]) cab.add(box("IceHousingSide", 0.005, icH - 0.008, icD, white, icX + sx * (icW / 2 - 0.0025), y0 + (icH - 0.008) / 2, zc));
  cab.add(box("IceHousingBack", icW - 0.01, icH - 0.008, 0.005, white, icX, y0 + (icH - 0.008) / 2, icZ0 + 0.0025));
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
  // "Movable Ice Maker" on the bin's front, 108 mm wide, its middle 75 mm up (close-up)
  ice.add(plane("PrintIceMaker", 0.12, 0.0192, icePrint, 0, 0.075, zf + 0.0006));
  const cube = new THREE.BoxGeometry(0.028, 0.024, 0.028);
  for (let i = 0; i < 14; i++) {
    const c = mesh("IceCube", cube, iceCube, -0.055 + (i % 4) * 0.036 + (Math.floor(i / 4) % 2) * 0.012, 0.022 + Math.floor(i / 8) * 0.023, zf - 0.04 - Math.floor((i % 8) / 4) * 0.06 - (i % 3) * 0.012);
    c.rotation.set(0.2 * (i % 3), 0.5 * i, 0.15 * (i % 4));
    ice.add(c);
  }
}
cab.add(ice);
stock.freezer(cab, { fit: true, zIn1: zIn, floor: fzFloor, top: coolTop + 0.0005, box: { hw: inW / 2 - 0.03, z0: zDuct + 0.02, z1: icZ0 - 0.01 } });

// The fitted stock is laid out for the LG 343 L's trays (about 540 mm between the walls; this one has 495 and a
// shallower cabinet): the trays are laid out again in rows inside their rims, as the RT40H28 builder does
root.updateMatrixWorld(true);
const bbox = (o) => new THREE.Box3().setFromObject(o);
function row(items, x0, x1, z0) {               // spread evenly between x0 and x1, backs at z0; returns the row's depth
  items = items.filter(Boolean);
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
const drop = (...os) => os.forEach((o) => o && o.parent && o.parent.remove(o));
{
  const g = trays.getObjectByName("Shelf2Stock"), hw = inW / 2 - 0.03, z0 = zDuct + 0.02;
  drop(g.getObjectByName("RnrBiryani"));
  const d1 = row([g.getObjectByName("CoconutHalf"), g.getObjectByName("WatermelonHalf")], -hw, hw, z0);
  row([g.getObjectByName("NandhanaPalace"), g.getObjectByName("NandhanaPalace2")], -hw, hw, z0 + d1 + 0.03);
}
{
  const g = trays.getObjectByName("Shelf3Stock"), hw = inW / 2 - 0.03, z0 = zIn + 0.035;
  const [a0, a1, a2, a3, a4] = kids(g, "Apple"), [o0, o1, o2] = kids(g, "Orange"), [l0, l1] = kids(g, "Lemon");
  drop(g.getObjectByName("AmulMastiDahi"), a1, a4, o1, o2, l0);
  const d1 = row([g.getObjectByName("Bananas"), g.getObjectByName("Grapes"), l1], -hw, hw, z0);
  row([a0, o0, a2, a3], -hw, hw, z0 + d1 + 0.03);
}
{ // the Fresh Room tray's back stands 30 mm off the back wall (clear of the duct): its food moves forward to clear it
  const g = trays.getObjectByName("Shelf1Stock"), zb = zIn + 0.03 + 0.004 + 0.004, zf = frontFridge - 0.004 - 0.004;
  for (const o of g.children) {
    const b = bbox(o);
    if (b.min.z < zb) o.position.z += Math.min(zb - b.min.z, Math.max(0, zf - b.max.z));
  }
  root.updateMatrixWorld(true);
}
{ // the Cool Pack: the three lying packs in one pile at the right, against the back wall's panel
  const g = cab.getObjectByName("OnFreezerShelf");
  if (g) {
    const pile = ["ViswasParotta2", "AmulPaneer", "FreshoGreenPeas2"].map((n) => g.getObjectByName(n)).filter(Boolean);
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
}
// The Big Box is short at its floor (it stops at the compressor bay's step), so the drumsticks lie across it at the back
// and the heap is dropped in again around them: stock_lg.mjs's own method, copied as the RT40H28 builder does
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
  let dropBy = Infinity;
  for (const h of hits) dropBy = Math.min(dropBy, h[0]);
  const touch = hits.filter((h) => h[0] - dropBy < 0.004), c = b.getCenter(new THREE.Vector3()), mx = 0.15 * (b.max.x - b.min.x), mz = 0.15 * (b.max.z - b.min.z);
  const xs = touch.map((h) => h[1]), zs = touch.map((h) => h[2]);
  const steady = touch.some((h) => h[3]) || (Math.min(...xs) - mx <= c.x && c.x <= Math.max(...xs) + mx && Math.min(...zs) - mz <= c.z && c.z <= Math.max(...zs) + mz);
  return { drop: dropBy, steady };
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
      const { drop: dy, steady } = dropOnto(o, placed);
      o.position.y -= dy;
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
  settle(v.children.slice().sort((a, b) => HEAP.indexOf(a.name) - HEAP.indexOf(b.name)), { tries: 30, spread: 0.08, bounds: drawerB, ceil: sCover - 0.016 - 0.01 - bbFloor });
}

// ── doors: hinged on the right, the Elegant Inox face on each, the chrome lip along the freezer door's foot, the
// handle pocket in the fridge door's top ──
const pw = W - 0.002, bw = pw - 0.1;
const inside = (dep) => [-pw / 2 - bw / 2 + 0.004, -pw / 2 + bw / 2 - 0.004, -(linerFace + dep / 2)];
const partX = -pw / 2;
const EGGS = [0, 1, 2, 3].map((i) => -pw / 2 - 0.03 - i * 0.05);
const z0Door = seal, zFace = seal + doorT;             // the door body's back and its face, from the cabinet's front
// a box of the door's body whose front face shows its own part of the door's picture (door frame: x -pw..0, y 0..h)
function piece(name, x0, x1, y0, y1, z0, z1, mats, h) {
  const g = new THREE.BoxGeometry(x1 - x0, y1 - y0, z1 - z0);
  g.translate((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2);
  const p = g.attributes.position, uv = g.attributes.uv;
  for (let i = 16; i < 20; i++) uv.setXY(i, (p.getX(i) + pw) / pw, (h - p.getY(i)) / h);
  return mesh(name, g, mats);
}
function door(name, y0, h, frontMat, openLo, openHi) {
  const pivot = group(name, W / 2, y0, zFront);
  const E = doorEdge, F = frontMat, L = liner, K = pocketMat;
  if (name === "FridgeDoor") {
    // the body under the pocket band, the band either side of the pocket, and the pocket's back wall
    const yb = h - POCKET.h, xa = -pw + POCKET.x0, xb = -pw + POCKET.x1;
    pivot.add(piece(name + "Panel", -pw, 0, 0, yb, z0Door, zFace, [E, E, K, E, F, L], h));
    pivot.add(piece(name + "BandL", -pw, xa, yb, h, z0Door, zFace, [K, E, E, E, F, L], h));
    pivot.add(piece(name + "BandR", xb, 0, yb, h, z0Door, zFace, [E, K, E, E, F, L], h));
    pivot.add(piece(name + "PocketBack", xa, xb, yb, h, z0Door, zFace - POCKET.dep, [K, K, E, K, K, L], h));
  } else {
    pivot.add(piece(name + "Panel", -pw, 0, 0, h, z0Door, zFace, [E, E, E, E, F, L], h));
    // the chrome lip along the foot: rounded top corners, 3 mm proud, reaching 3 mm below the door; a dark line over it
    const lw = LIP.x1 - LIP.x0, lh = LIP.h + LIP.drop, r = 0.005, sh = new THREE.Shape();
    sh.moveTo(0, 0); sh.lineTo(lw, 0); sh.lineTo(lw, lh - r); sh.quadraticCurveTo(lw, lh, lw - r, lh); sh.lineTo(r, lh); sh.quadraticCurveTo(0, lh, 0, lh - r); sh.lineTo(0, 0);
    const lip = mesh(name + "Lip", new THREE.ExtrudeGeometry(sh, { depth: LIP.proud + 0.004, bevelEnabled: false, curveSegments: 6 }), chrome, -pw + LIP.x0, -LIP.drop, zFace - 0.004);
    pivot.add(lip);
    pivot.add(box(name + "LipGroove", lw - 2 * r, 0.0012, 0.0012, groove, -pw + (LIP.x0 + LIP.x1) / 2, LIP.h - LIP.drop + 0.0012, zFace + 0.0004));
    // the Digital Inverter Technology badge at the lip's right end: 69 mm by 12 mm, from 401 mm from the free edge
    pivot.add(plane("BadgeDecal", 0.069, 0.012, badgeM, -pw + 0.4355, (lh / 2) - LIP.drop, zFace + LIP.proud + 0.0006));
  }
  // behind it: the gasket ring, the liner (inside the cabinet's opening) and the bins on the liner's face
  const g = 0.016;
  // the fridge door's top gasket sits 3 mm under its top edge, over the flange under the divider (below), so no slot opens
  // between the doors into the fridge
  const gT = name === "FridgeDoor" ? h - 0.003 - g / 2 : h - 0.01 - g / 2;
  for (const [n, w, hh, x, y] of [["T", pw - 0.02, g, -pw / 2, gT], ["B", pw - 0.02, g, -pw / 2, 0.01 + g / 2], ["L", g, h - 0.02 - 2 * g, -pw + 0.01 + g / 2, h / 2], ["R", g, h - 0.02 - 2 * g, -0.01 - g / 2, h / 2]])
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
      for (const x of EGGS) { const c = mesh("EggCup", new THREE.SphereGeometry(0.02, 12, 4, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), binMat, x, b.f, zc); c.scale.y = 0.25; pivot.add(c); }
    }
    if (b.tall) {
      // "Tall Bottle Guard" on its front, facing into the cabinet with the door shut (it faces the room with the door open):
      // 137 mm wide, 14 mm caps, its middle 40 mm up the lip and 20 mm left of the bin's middle (close-up g52_535050752)
      const t = plane("PrintTallBottle", 0.145, 0.028, tallPrint, -pw / 2 - 0.02, b.f + 0.04, zl - 0.0006);
      t.rotation.y = Math.PI;
      pivot.add(t);
    }
  });
  return pivot;
}
const fridgeDoor = door("FridgeDoor", frBot, frTop - frBot, fridgeFront, floorTop, fzCeil);
const freezerDoor = door("FreezerDoor", fzBot, cabTop - fzBot, freezerFront, fzFloor, fzTop);
{
  const h = cabTop - fzBot;
  // the SAMSUNG wordmark, 79 mm wide, its right end 40 mm in from the hinge edge, its middle 43 mm below the door's top
  // (the 3/4 views and Samsung's size picture, NOTES.md); the texture carries a clear 10 px margin round the 1200 x 184 ink
  const mw = 0.079 * 1220 / 1200;
  freezerDoor.add(plane("SamsungMarkDecal", mw, mw * 204 / 1220, markM, -0.04 - 0.079 / 2, h - 0.043, zFace + 0.0007));
  // the fridge door's inner top: an embossed panel above the Tall Bottle Guard bin (photo), no bin
  fridgeDoor.add(box("FridgeDoorEmboss", bw - 0.04, 0.12, 0.004, liner, -pw / 2, 0.80, -linerFace - 0.002));
}
{ // what sits in the door bins, so it swings out with the door. The Tall Bottle Guard bin holds the bottles and cartons,
  // the small bins the eggs (free-edge side) and two jars (hinge side), the bottle bin at the foot water bottles
  const F = BINS.FridgeDoor, Z = BINS.FreezerDoor;
  stock.doorFridge(fridgeDoor, { fit: true, eggY: F[1].f, eggX: EGGS, eggDY: 0, eggTurn: Math.PI / 2, jarY: F[1].f, botY: F[2].f, canY: null, deps: { egg: F[1].d, jar: F[1].d, bottle: F[2].d }, inside });
  stock.doorFreezer(freezerDoor, { fit: true, b1: Z[1].f, b2: Z[0].f, dep: Math.min(Z[0].d, Z[1].d), inside });
  drop(...["MothersPickle2", "SakthiSambar", "NandiniGhee"].map((n) => fridgeDoor.getObjectByName(n)));
  fridgeDoor.updateMatrixWorld(true);
  const jars = ["MothersPickle", "AavinGhee"].map((n) => fridgeDoor.getObjectByName(n)).filter(Boolean);
  const [, , zm] = inside(F[1].d);
  const local = (o) => { const b = bbox(o), inv = new THREE.Matrix4().copy(fridgeDoor.matrixWorld).invert(); return b.applyMatrix4(inv); };
  {
    const x0 = partX + 0.004 + 0.004, x1 = -pw / 2 + bw / 2 - 0.004, bs = jars.map(local);
    const w = bs.reduce((s, b) => s + b.max.x - b.min.x, 0), gap = (x1 - x0 - w) / (jars.length + 1);
    let x = x0 + gap;
    jars.forEach((o, i) => { const b = bs[i]; o.position.x += x - b.min.x; o.position.z += zm - (b.min.z + b.max.z) / 2; x += b.max.x - b.min.x + gap; });
  }
  const water = fridgeDoor.getObjectByName("Bisleri");
  if (water) {
    const ws = [water, ...[2, 3, 4].map((k) => { const c = water.clone(); c.name = `Bisleri${k}`; fridgeDoor.add(c); return c; })];
    ws.forEach((o) => { o.position.y += F[0].f - F[2].f; });
    fridgeDoor.updateMatrixWorld(true);
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
// Grain: the doors' Elegant Inox face gets the soft horizontal hairline (Samsung's photos show horizontal brushing); the
// painted sides and top the soft peel (ESTIMATED: Samsung publishes no material). Prints, decals and the lip carry none.
const used = new Set();
root.traverse((o) => o.material && [].concat(o.material).forEach((m) => used.add(m.name)));
const only = (t) => Object.fromEntries(Object.entries(t).filter(([k]) => used.has(k)));
await exportGLB(root, clips, OUT, only({
  FreezerFront: `${T}/door_freezer.jpg`,
  FridgeFront: `${T}/door_fridge.jpg`,
  SamsungMark: `${T}/mark.png`,
  BadgePrint: `${T}/badge.png`,
  BackFreezer: `${T}/back_freezer.png`,
  BackFridge: `${T}/back_fridge.png`,
  DeodorizerPrint: `${T}/deodorizer.png`,
  CoolPackTop: `${T}/coolpack.png`,
  BigBoxPrint: `${T}/bigbox_print.png`,
  IceMakerPrint: `${T}/icemaker_print.png`,
  FreshRoomPrint: `${T}/print_freshroom.png`,
  EasySlidePrint: `${T}/print_easyslide.png`,
  TallBottlePrint: `${T}/print_tallbottle.png`,
  MoistFreshPrint: `${T}/print_moistfresh.png`,
  SidePaint: `${T}/side_paint.jpg`,
  Rear: `${T}/rear.jpg`,
  Bay: `${T}/bay.jpg`,
  BaseRear: `${T}/base_rear.jpg`,
  ...stock.textures(),
}), { dir: `${TEX}/grain`, materials: {
  FreezerFront: { type: "hairline_soft", dir: "h" }, FridgeFront: { type: "hairline_soft", dir: "h" },
  SidePaint: { type: "peel_soft" }, TopPaint: { type: "peel_soft" },
} });
