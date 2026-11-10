// LG GLT4626TMPZ.DPZZEBN, 466 L double-door refrigerator, Shiny Steel (VCM doors).
// Built to LG's published size, 700 W x 1845 H x 725 D mm (LG's page and Sangeetha listing 21041), from LG's gallery photos
// of this model (front, 3/4, sides, open, stocked, rear): freezer on top (103 L) with an LED display on its door, a spun-steel
// Convertible plate, one glass shelf and a manual ice maker (lever and two trays); fridge below (363 L) with a pull-out
// Fresh 0 Zone tray, a Hygiene Fresh plate, three tempered-glass shelves and a Fresh Zone drawer; 2 baskets in the freezer
// door and 4 in the fridge door; both doors hinged on the right; a black pocket grip across the top of the fridge door.
// As on the LG 343 L, the shelves, the Fresh 0 Zone tray and the vegetable drawer are one part (FridgeTrays) that slides
// out with its food when the fridge door is open.
// Heights are read off LG's photos (private research notes give each number and how it was measured).
// Stocked for a south Indian kitchen. usage: node make_lg_glt4626.mjs <products.json> <tex dir> <out.glb>
import fs from "node:fs";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { THREE, mat, mesh, box, faced, group, flipV, stateClips, exportGLB, productParts, saveZones } from "./lib.mjs";
import { LGStock } from "./stock_lg.mjs";

const [PRODUCTS, TEX, OUT] = process.argv.slice(2);
const ID = "lg-glt4626tmpz";
const T = `${TEX}/lg_glt4626`;

// ── size (metres) ──
const W = 0.700, H = 1.845, D = 0.725;
const doorT = 0.045, Dc = D - doorT;
const zBack = -D / 2, zFront = zBack + Dc;
const wall = 0.036, feet = 0.022;
const inW = W - 2 * wall, zIn1 = zBack + 0.06, inD = zFront - zIn1;
// vertical layout, measured on LG's front photo (1.84 mm a pixel) and its open-door photo (50 mm grid on the cabinet's front)
const fy0 = 1.365, fy1 = 1.800;              // freezer cavity floor and ceiling
const gy0 = 0.075, gy1 = 1.275;              // fridge cavity floor and ceiling
const fzBot = 1.306;                         // freezer door bottom edge
const frTop = 1.301, frLow = 0.027;          // fridge door top and bottom
const lipTop = 1.292, bandBot = 1.262, lowLip = 1.250, groove = 1.242; // silver lip, black grip, silver lip, dark groove
// With the doors shut their baskets reach into the cabinet (the bottle basket 105 mm), so the shelves, the drawer and its
// cover end 1 cm short of them, and the freezer shelf and the ice maker short of the freezer's baskets.
const shelfFront = zFront - 0.115, drawerFront = zFront - 0.115, fzShelfFront = zFront - 0.09;
const s1 = 0.894, s2 = 0.723, s3 = 0.501;    // glass shelves (front rims on the open-door photo)
const fzShelfY = 1.548;                      // freezer glass shelf
const f0Y = 1.095;                           // Fresh 0 Zone tray floor
const coverY = 0.395, drawerY = 0.105;       // Fresh Zone glass cover and drawer floor

// ── materials ──
const steelDoorF = mat("DoorFreezer", 0xd6d6d6, { metal: 0.38, rough: 0.5 });
const steelDoorR = mat("DoorFridge", 0xd6d6d6, { metal: 0.38, rough: 0.5 });
const sideSteel = mat("SideSteel", 0xd2d2d2, { metal: 0.38, rough: 0.5 });
const sideSteelL = mat("SideSteelL", 0xd2d2d2, { metal: 0.38, rough: 0.5 });
const steelEdge = mat("SteelEdge", 0x9a9b9d, { metal: 0.2, rough: 0.6 });
const topSteel = mat("TopSteel", 0x7e8083, { metal: 0.15, rough: 0.7 });
const black = mat("GripBlack", 0x151516, { rough: 0.5 });
const silverLip = mat("SilverLip", 0xb4b5b7, { metal: 0.8, rough: 0.3 });
const labelM = mat("LabelBEE", 0xffffff, { rough: 0.5, opacity: 0.999 });
const logoM = mat("LgMark", 0xffffff, { rough: 0.5, opacity: 0.999 });
const displayM = mat("Display", 0xffffff, { rough: 0.25, opacity: 0.999 });
const rearM = mat("RearPlate", 0xffffff, { metal: 0.3, rough: 0.55 });
const liner = mat("Liner", 0xf1f3f5, { rough: 0.6 });
const linerSide = mat("LinerSide", 0xe4e8ec, { rough: 0.65 });
const linerDk = mat("LinerGrey", 0xcfd3d8, { rough: 0.6 });
const gasket = mat("Gasket", 0x6c7176, { rough: 0.85 });
const plinth = mat("Plinth", 0x1a1b1d, { rough: 0.8 });
const clear = mat("ClearPlastic", 0xc3d0da, { rough: 0.12, opacity: 0.5, side: THREE.DoubleSide });
const clearLight = mat("ClearPlasticLight", 0xdfe7ee, { rough: 0.12, opacity: 0.26, side: THREE.DoubleSide });
const clearRib = mat("ClearRib", 0xffffff, { rough: 0.3, opacity: 0.92 });
const glass = mat("TemperedGlass", 0xa9cdd6, { rough: 0.05, opacity: 0.55, side: THREE.DoubleSide });
const glassRim = mat("ShelfRim", 0xe3e7ea, { rough: 0.45 });
const edgeGreen = mat("GlassEdge", 0x7fa7b0, { rough: 0.3 });
const white = mat("WhitePlastic", 0xf6f7f8, { rough: 0.45 });
const greyPlastic = mat("GreyPlastic", 0xa9adb2, { rough: 0.5 });
const ice = mat("IceCube", 0xe3f4ff, { rough: 0.08, opacity: 0.72 });
const lightM = mat("Led", 0xffffff, { emissive: 0xf4f8ff, emissiveIntensity: 1.5 });
const footM = mat("Foot", 0x131416, { rough: 0.7 });
const cordM = mat("Cord", 0x1e1f21, { rough: 0.6 });
const plugM = mat("Plug", 0x232427, { rough: 0.5 });
const pinM = mat("Pin", 0xb7bbc0, { metal: 0.9, rough: 0.3 });
const hingeM = mat("Hinge", 0xc9ccd0, { metal: 0.9, rough: 0.3 });
const plateConv = mat("PlateConvertible", 0xffffff, { metal: 0.5, rough: 0.4 });
const plateHyg = mat("PlateHygiene", 0xffffff, { metal: 0.5, rough: 0.4 });
const printF0 = mat("print_fresh0", 0xffffff, { rough: 0.6, opacity: 0.999 });
const printFz = mat("print_freshzone", 0xffffff, { rough: 0.6, opacity: 0.999 });
const stock = LGStock({ T3: `${TEX}/lg_glt3426`, TF: `${TEX}/food`, BR: `${TEX}/brands`, BRT: `${TEX}/brands/small` });

// ── small builders ──
const cyl = (name, rt, rb, h, m, x, y, z, seg = 12) => mesh(name, new THREE.CylinderGeometry(rt, rb, h, seg), m, x, y, z);
const plane = (name, w, h, m, x, y, z) => mesh(name, flipV(new THREE.PlaneGeometry(w, h)), m, x, y, z);
// many small boxes of one material as one mesh: [w, h, d, x, y, z] each
const boxes = (name, list, m) => mesh(name, mergeGeometries(list.map(([w, h, d, x, y, z]) => new THREE.BoxGeometry(w, h, d).translate(x, y, z))), m);
// a clear door basket, open at the top; origin at its floor, its back on the face of the door's liner (10 mm in)
function basket(name, w, dep, h, y, front = true) {
  const g = group(name, 0, y, -0.01);
  g.add(box(name + "Floor", w, 0.004, dep, clear, 0, 0.002, -dep / 2));
  g.add(box(name + "Back", w, h, 0.004, clear, 0, h / 2, -0.002));
  if (front) g.add(box(name + "Lip", w, h * 0.85, 0.004, clear, 0, h * 0.425, -dep + 0.002));
  g.add(box(name + "EndL", 0.004, h, dep, clear, -w / 2 + 0.002, h / 2, -dep / 2));
  g.add(box(name + "EndR", 0.004, h, dep, clear, w / 2 - 0.002, h / 2, -dep / 2));
  g.add(box(name + "Rim", w, 0.006, 0.006, clearRib, 0, h - 0.003, -dep + 0.003));
  return g;
}
// leave out what doesn't fit (never scaled): any stock item in grp that reaches into one of the keep-out boxes
function leaveOut(grp, keep, why) {
  if (!grp) return;
  grp.updateMatrixWorld(true);
  const out = [];
  for (const c of [...grp.children]) if (keep.some((k) => new THREE.Box3().setFromObject(c).intersectsBox(k))) { out.push(c.name); c.removeFromParent(); }
  if (out.length) console.log(`left out (${why}): ${out.join(", ")}`);
}
const B3 = (x0, y0, z0, x1, y1, z1) => new THREE.Box3(new THREE.Vector3(x0, y0, z0), new THREE.Vector3(x1, y1, z1));

const root = group("LGGLT4626");
const cab = group("Cabinet");
root.add(cab);

// ── cabinet shell ──
const sideH = H - feet, sideMid = feet + sideH / 2, zMid = zBack + Dc / 2;
cab.add(mesh("SideLeft", flipV(new THREE.BoxGeometry(wall, sideH, Dc)), [linerSide, sideSteelL, topSteel, plinth, sideSteelL, sideSteelL], -W / 2 + wall / 2, sideMid, zMid));
cab.add(mesh("SideRight", flipV(new THREE.BoxGeometry(wall, sideH, Dc)), [sideSteel, linerSide, topSteel, plinth, sideSteel, sideSteel], W / 2 - wall / 2, sideMid, zMid));
cab.add(faced("Top", inW, 0.045, Dc, [topSteel, topSteel, topSteel, liner, topSteel, topSteel], 0, H - 0.0225, zMid));
cab.add(faced("Divider", inW, fy0 - gy1, inD, [liner, liner, liner, liner, liner, liner], 0, (fy0 + gy1) / 2, zIn1 + inD / 2));
cab.add(faced("Base", inW, gy0 - feet, Dc, [liner, liner, liner, liner, liner, liner], 0, feet + (gy0 - feet) / 2, zMid));
cab.add(box("Kickplate", inW, 0.026, 0.012, plinth, 0, feet + 0.013, zFront - 0.006));
cab.add(faced("BackFreezer", inW, fy1 - fy0, 0.012, [linerDk, linerDk, linerDk, linerDk, linerDk, linerDk], 0, (fy0 + fy1) / 2, zIn1 + 0.006));
cab.add(faced("BackFridge", inW, gy1 - gy0, 0.012, [liner, liner, liner, liner, liner, liner], 0, (gy0 + gy1) / 2, zIn1 + 0.006));
// the real back: LG's rear photo (cropped to the cabinet's full-width rows, the cord painted out) on a thin plate, from
// 14 mm above the floor to 8 mm under the top, as the crop runs on the photo
const rearBot = 0.014, rearTop = H - 0.008;
cab.add(mesh("RearPlate", flipV(new THREE.BoxGeometry(W, rearTop - rearBot, 0.004)), [steelEdge, steelEdge, steelEdge, steelEdge, steelEdge, rearM], 0, (rearTop + rearBot) / 2, zBack + 0.002));
// feet: two adjustable at the front (a black knob on a threaded stem), two rollers at the back
for (const fx of [-1, 1]) {
  cab.add(cyl("FootFront", 0.019, 0.02, 0.016, footM, fx * (W / 2 - 0.042), 0.008, zFront - 0.04, 16));
  cab.add(cyl("FootThread", 0.006, 0.006, feet - 0.016, pinM, fx * (W / 2 - 0.042), 0.016 + (feet - 0.016) / 2, zFront - 0.04, 10));
  cab.add(cyl("Roller", 0.017, 0.017, 0.018, footM, fx * (W / 2 - 0.045), 0.017, zBack + 0.06).rotateZ(Math.PI / 2));
}
// hinges on the right: the middle one a steel plate in the gap between the doors with two bolt heads; a dark cover on top
cab.add(box("HingeMid", 0.034, 0.0035, doorT + 0.012, hingeM, W / 2 - 0.02, (fzBot + frTop) / 2, zFront + (doorT + 0.012) / 2 - 0.012));
for (const dz of [0.008, 0.028]) cab.add(cyl("HingeBolt", 0.0045, 0.0045, 0.001, hingeM, W / 2 - 0.02, (fzBot + frTop) / 2 + 0.0022, zFront + dz, 10));
cab.add(box("HingeCoverTop", 0.065, 0.012, 0.05, plinth, W / 2 - 0.04, H - 0.0052, zFront - 0.022));
// power cord: its route on the back traced on LG's rear photo (rear_paths.json); past the cabinet's edge the photo does
// not show it, so it is drawn hanging to the floor with its three-pin plug lying there (estimated)
{
  const RP = JSON.parse(fs.readFileSync(`${T}/rear_paths.json`, "utf8"));
  const zc = zBack - 0.0045, V = (x, y, z) => new THREE.Vector3(x, y, z);
  // (kept 8 mm inside the cabinet's edge, so the cord doesn't widen the model)
  const pts = RP.cord.map(([u, v]) => V(Math.min(W / 2 - u * W, W / 2 - 0.008), rearTop - v * (rearTop - rearBot), zc));
  const end = pts[pts.length - 1], px = W / 2 - 0.04, py = 0.023, pz = zBack - 0.1;
  pts.push(V(W / 2 - 0.011, end.y - 0.04, zBack - 0.012), V(W / 2 - 0.014, 0.16, zBack - 0.022), V(W / 2 - 0.022, 0.045, zBack - 0.042), V(px, py, pz + 0.006));
  cab.add(mesh("PowerCord", new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts, false, "centripetal"), 110, 0.0035, 6, false), cordM));
  const sh = new THREE.Shape(), w = 0.045, h = 0.042, r = 0.012;
  sh.moveTo(-w / 2 + r, -h / 2); sh.lineTo(w / 2 - r, -h / 2); sh.quadraticCurveTo(w / 2, -h / 2, w / 2, -h / 2 + r);
  sh.lineTo(w / 2, h / 2 - r); sh.quadraticCurveTo(w / 2, h / 2, w / 2 - r, h / 2); sh.lineTo(-w / 2 + r, h / 2);
  sh.quadraticCurveTo(-w / 2, h / 2, -w / 2, h / 2 - r); sh.lineTo(-w / 2, -h / 2 + r); sh.quadraticCurveTo(-w / 2, -h / 2, -w / 2 + r, -h / 2);
  const plug = mesh("Plug", new THREE.ExtrudeGeometry(sh, { depth: 0.016, bevelEnabled: true, bevelSize: 0.002, bevelThickness: 0.002, bevelSegments: 2, curveSegments: 8 }), plugM, px, py, pz);
  plug.rotation.y = Math.PI;
  cab.add(plug);
  for (const [dx, dy] of [[0, 0.0105], [-0.0095, -0.0065], [0.0095, -0.0065]]) {
    const pin = cyl("PlugPin", 0.0026, 0.0026, 0.016, pinM, px + dx, py + dy, pz - 0.016 - 0.008, 10);
    pin.rotation.x = Math.PI / 2; cab.add(pin);
  }
}

// ── freezer inside ──
const xL = -inW / 2, xR = inW / 2;
cab.add(box("FreezerLedL", 0.1, 0.006, 0.014, lightM, -0.1, fy1 - 0.006, zIn1 + 0.05));
cab.add(box("FreezerLedR", 0.1, 0.006, 0.014, lightM, 0.1, fy1 - 0.006, zIn1 + 0.05));
// cold-air grilles high on the back wall (two panels), a row of return slots along its foot, and an air guide (a grey
// strip over a black slot) under the shelf on the right, as on LG's open-door photo
cab.add(boxes("FreezerGrille", [[0.19, 0.035, 0.008, -0.16, fy1 - 0.065, zIn1 + 0.016], [0.25, 0.035, 0.008, 0.15, fy1 - 0.065, zIn1 + 0.016]], white));
cab.add(boxes("FreezerGrilleSlot", [-0.16, 0.15].flatMap((x, k) => [0, 1, 2, 3].map((i) => [k ? 0.22 : 0.16, 0.003, 0.002, x, fy1 - 0.078 + i * 0.0085, zIn1 + 0.0205])), plinth));
cab.add(boxes("FreezerVent", [0, 1, 2, 3, 4, 5, 6, 7].map((i) => [0.05, 0.006, 0.004, -0.245 + i * 0.07, fy0 + 0.012, zIn1 + 0.014]), plinth));
cab.add(box("FreezerAirGuide", 0.1, 0.009, 0.006, greyPlastic, 0.114, 1.52, zIn1 + 0.015));
cab.add(box("FreezerAirSlot", 0.1, 0.012, 0.004, plinth, 0.114, 1.495, zIn1 + 0.014));
// the spun-steel Convertible plate on the back wall
cab.add(plane("PlateConvertible", 0.163, 0.074, plateConv, 0.015, 1.61, zIn1 + 0.0125));
// freezer glass shelf across the cavity, with its rims and rails
{
  const g = group("FreezerShelf", 0, fzShelfY, 0), bd = fzShelfFront - 0.005 - zIn1 - 0.02;
  g.add(box("FzShelfGlass", inW - 0.012, 0.005, bd, glass, 0, 0, zIn1 + bd / 2 + 0.02));
  g.add(box("FzShelfRimF", inW - 0.008, 0.012, 0.01, glassRim, 0, 0.004, fzShelfFront - 0.005));
  g.add(box("FzShelfRimB", inW - 0.008, 0.01, 0.008, glassRim, 0, 0.003, zIn1 + 0.03));
  g.add(box("FzShelfRailL", 0.008, 0.012, bd, glassRim, xL + 0.01, 0.003, zIn1 + bd / 2 + 0.02));
  g.add(box("FzShelfRailR", 0.008, 0.012, bd, glassRim, xR - 0.01, 0.003, zIn1 + bd / 2 + 0.02));
  cab.add(g);
}
// the ice maker hangs under the shelf on the left (the photo: 190 mm wide, bucket floor at 1.40 m); its front stays
// 95 mm behind the door's face so the lower door basket clears it
const icX = -0.104, icW = 0.18, icZ = zFront - 0.095, icDY = 0.22;
cab.add(box("IceHousingTop", icW + 0.01, 0.006, 0.2, white, icX, 1.317 + icDY, icZ - 0.1));
cab.add(box("IceHousingSideL", 0.005, 0.14, 0.2, white, icX - icW / 2 - 0.0025, 1.247 + icDY, icZ - 0.1));
cab.add(box("IceHousingSideR", 0.005, 0.14, 0.2, white, icX + icW / 2 + 0.0025, 1.247 + icDY, icZ - 0.1));

// ── fridge inside ──
const trays = group("FridgeTrays");
cab.add(trays);
cab.add(box("FridgeLed", 0.2, 0.006, 0.016, lightM, 0, gy1 - 0.006, zFront - 0.16));
// Fresh 0 Zone: a pull-out tray at the top, a clear box on side rails with LG's printed words on its front
const f0 = { bw: inW - 0.012, bd: 0.40, bh: 0.14 };
f0.zc = zIn1 + f0.bd / 2 + 0.012;
{
  const { bw, bd, bh, zc } = f0, g = group("Fresh0Zone", 0, f0Y, 0);
  g.add(box("F0Floor", bw, 0.004, bd, clear, 0, 0, zc));
  g.add(box("F0Back", bw, bh, 0.004, clearLight, 0, bh / 2, zIn1 + 0.014));
  g.add(box("F0SideL", 0.004, bh, bd, clear, -bw / 2, bh / 2, zc));
  g.add(box("F0SideR", 0.004, bh, bd, clear, bw / 2, bh / 2, zc));
  g.add(box("F0FrontLow", bw, 0.05, 0.004, clearLight, 0, 0.025, zc + bd / 2));
  g.add(box("F0FrontHigh", bw - 0.02, 0.085, 0.004, clearLight, 0, 0.0975, zc + bd / 2 - 0.004));
  g.add(box("F0Rim", bw, 0.008, 0.01, clearRib, 0, bh - 0.003, zc + bd / 2 - 0.004));
  g.add(box("F0Handle", 0.2, 0.012, 0.014, clearRib, 0, 0.05, zc + bd / 2 + 0.006));
  g.add(plane("PrintFresh0", 0.212, 0.047, printF0, 0, 0.112, zc + bd / 2 - 0.0015));
  trays.add(g);
}
stock.fresh0(trays, { y: f0Y + 0.002, z: f0.zc + 0.03 });
// the Hygiene Fresh plate on the back wall, and the sensor panel on the left wall
cab.add(plane("PlateHygiene", 0.163, 0.075, plateHyg, 0.015, 0.98, zIn1 + 0.0125));
cab.add(box("WallPanel", 0.004, 0.2, 0.028, greyPlastic, xL + 0.002, 0.93, zIn1 + 0.33));
for (const sy of [1.0, 0.86]) cab.add(cyl("WallSensor", 0.011, 0.011, 0.004, white, xL + 0.006, sy, zIn1 + 0.33).rotateZ(Math.PI / 2));
// three tempered-glass shelves with white rims
function shelf(name, y) {
  const g = group(name, 0, y, 0), bd = shelfFront - 0.0085 - zIn1 - 0.014;
  g.add(box(name + "Glass", inW - 0.01, 0.006, bd, glass, 0, 0, zIn1 + bd / 2 + 0.014));
  g.add(box(name + "Rim", inW - 0.01, 0.014, 0.012, glassRim, 0, 0.004, shelfFront - 0.0085));
  g.add(box(name + "Edge", inW - 0.01, 0.004, 0.003, edgeGreen, 0, -0.002, shelfFront - 0.0015));
  g.add(box(name + "RimBack", inW - 0.01, 0.01, 0.01, glassRim, 0, 0.002, zIn1 + 0.02));
  g.add(box(name + "RailL", 0.01, 0.014, bd, glassRim, xL + 0.012, 0, zIn1 + bd / 2 + 0.014));
  g.add(box(name + "RailR", 0.01, 0.014, bd, glassRim, xR - 0.012, 0, zIn1 + bd / 2 + 0.014));
  trays.add(g);
}
shelf("Shelf1", s1);
shelf("Shelf2", s2);
shelf("Shelf3", s3);
// Fresh Zone: a glass cover (fixed) over a big clear drawer (it lifts out) with LG's printed words on its front
const fzD = drawerFront - zIn1 - 0.016, fzW = inW - 0.02, fzC = zIn1 + fzD / 2 + 0.016, fzH = 0.25;
{
  const g = group("FreshZoneCover", 0, 0, 0);
  g.add(box("FzGlassCover", inW - 0.01, 0.006, fzD, glass, 0, coverY, fzC));
  g.add(box("FzCoverRim", inW - 0.01, 0.012, 0.012, glassRim, 0, coverY + 0.003, drawerFront - 0.006));
  cab.add(g);
}
{
  const g = group("FreshZone", 0, 0, 0), bd = fzD, bw = fzW, zc = fzC, yc = drawerY + fzH / 2;
  g.add(box("FzBoxFloor", bw, 0.004, bd, clear, 0, drawerY, zc));
  g.add(box("FzBoxBack", bw, fzH, 0.004, clear, 0, yc, zIn1 + 0.018));
  g.add(box("FzBoxL", 0.004, fzH, bd, clear, -bw / 2, yc, zc));
  g.add(box("FzBoxR", 0.004, fzH, bd, clear, bw / 2, yc, zc));
  g.add(box("FzBoxFront", bw, fzH, 0.004, clearLight, 0, yc, zc + bd / 2));
  g.add(box("FzBoxRim", bw, 0.008, 0.008, clearRib, 0, drawerY + fzH - 0.004, zc + bd / 2));
  g.add(box("FzBoxFootRim", bw, 0.008, 0.008, clearRib, 0, drawerY + 0.003, zc + bd / 2));
  g.add(plane("PrintFreshZone", 0.208, 0.0509, printFz, 0, 0.255, zc + bd / 2 + 0.0023));
  trays.add(g);
}

// ── stock: vegetarian South Indian food, eggs, juices, water and soft drinks (stock_lg.mjs, food.mjs) ──
stock.shelves(trays, {
  zIn1, inW, inD, s1, s2, s3, fz: drawerY + 0.002, fit: true, vk: 0.8,
  shelfB: { hw: inW / 2 - 0.03, z0: zIn1 + 0.034, z1: shelfFront - 0.015 },
  drawerB: { hw: fzW / 2 - 0.014, z0: zIn1 + 0.04, z1: drawerFront - 0.006, y0: drawerY + 0.002 },
  drawerCeil: coverY - 0.003 - 0.01 - (drawerY + 0.002), // the heap stays 1 cm under the drawer's glass cover
});
// The freezer floor is 18 cm under the shelf, short of the two stacked tubs (17.4 cm) and the standing packs (18.1 cm)
// with 1 cm of air, so they stand on the glass shelf, as in LG's stocked photo, and the flat packs lie on the floor
// behind the ice maker (stock_lg.mjs's "floor" and "top" given the other way round).
stock.freezer(cab, { fit: true, zIn1, floor: fzShelfY + 0.0025, top: fy0, box: { hw: inW / 2 - 0.03, z0: zIn1 + 0.038, z1: icZ - 0.21 } });
leaveOut(cab.getObjectByName("OnFreezerShelf"), [B3(icX - icW / 2 - 0.02, fy0 - 0.01, icZ - 0.215, icX + icW / 2 + 0.02, fzShelfY, zFront)], "under the ice maker");

// ── ice maker: the tray unit and the bucket slide out together (a real part) ──
const ic = group("IceMaker", icX, 0, icZ);
{
  ic.add(mesh("IceFace", new THREE.BoxGeometry(icW, 0.06, 0.03), white, 0, 1.288, -0.015));
  ic.add(box("IceFaceSlot", 0.08, 0.008, 0.004, plinth, 0, 1.304, 0.001));
  ic.add(box("IceFaceGrip", 0.08, 0.012, 0.01, white, 0, 1.272, 0.004));
  ic.add(box("IceTrayBody", icW - 0.012, 0.045, 0.17, white, 0, 1.29, -0.115));
  ic.add(box("IceBucketFloor", icW - 0.01, 0.004, 0.17, clear, 0, 1.18, -0.115));
  ic.add(box("IceBucketFront", icW - 0.01, 0.07, 0.004, clear, 0, 1.215, -0.032));
  ic.add(box("IceBucketL", 0.004, 0.07, 0.17, clear, -(icW - 0.01) / 2, 1.215, -0.115));
  ic.add(box("IceBucketR", 0.004, 0.07, 0.17, clear, (icW - 0.01) / 2, 1.215, -0.115));
  ic.add(box("IceBucketHandle", 0.07, 0.008, 0.01, clearRib, 0, 1.248, -0.028));
  const cubes = [];
  for (let i = 0; i < 16; i++) {
    const c = new THREE.BoxGeometry(0.03, 0.025, 0.03);
    c.applyMatrix4(new THREE.Matrix4().compose(new THREE.Vector3(-0.055 + (i % 4) * 0.037 + (Math.floor(i / 4) % 2) * 0.012, 1.196 + Math.floor(i / 8) * 0.024, -0.06 - Math.floor((i % 8) / 4) * 0.055 - (i % 3) * 0.012),
      new THREE.Quaternion().setFromEuler(new THREE.Euler(0.2 * (i % 3), 0.5 * i, 0.15 * (i % 4))), new THREE.Vector3(1, 1, 1)));
    cubes.push(c);
  }
  ic.add(mesh("IceCube", mergeGeometries(cubes), ice));
}
cab.add(ic);
ic.position.y = icDY;

// ── doors: hinged on the right, no handles, black pocket grip at the top of the fridge door ──
const pw = W - 0.004;
// the inside of a door basket of width w: its x range between the end walls, and the middle of a depth dep
const inside = (w) => (dep) => [-pw / 2 - w / 2 + 0.004, -pw / 2 + w / 2 - 0.004, -(0.01 + dep / 2)];
function doorShell(name, y0, parts) { const g = group(name, W / 2, y0, zFront); parts(g); return g; }
function gaskets(g, p, h) {
  g.add(box(p + "GasketT", pw - 0.02, 0.014, 0.014, gasket, -pw / 2, h - 0.012, -0.007));
  g.add(box(p + "GasketB", pw - 0.02, 0.014, 0.014, gasket, -pw / 2, 0.012, -0.007));
  g.add(box(p + "GasketL", 0.014, h - 0.02, 0.014, gasket, -pw + 0.012, h / 2, -0.007));
  g.add(box(p + "GasketR", 0.014, h - 0.02, 0.014, gasket, -0.012, h / 2, -0.007));
  g.add(box(p + "Liner", pw - 0.05, h - 0.05, 0.012, liner, -pw / 2, h / 2, -0.004));
}
const freezerDoor = doorShell("FreezerDoor", fzBot, (g) => {
  const h = H - fzBot;
  g.add(mesh("FzPanel", flipV(new THREE.BoxGeometry(pw, h, doorT)), [steelEdge, steelEdge, topSteel, steelEdge, steelDoorF, liner], -pw / 2, h / 2, doorT / 2));
  // print, measured on LG's front photo: the LG mark 40-87 mm from the left and 37-55 mm down; the energy label 34-124 mm
  // from the right and 37-208 mm down; the display window 320-376 mm from the left and 184-349 mm down
  g.add(plane("LgMarkDecal", 0.047, 0.0216, logoM, -pw + 0.0635, h - 0.046, doorT + 0.0006));
  g.add(plane("BeeLabelDecal", 0.09, 0.171, labelM, -0.079, h - 0.1225, doorT + 0.0006));
  g.add(plane("DisplayDecal", 0.057, 0.165, displayM, -pw / 2, h - 0.2665, doorT + 0.0006));
  gaskets(g, "Fz", h);
  const b1 = 1.65 - fzBot, b2 = 1.42 - fzBot;
  const k1 = basket("FzBasket1", pw - 0.1, 0.07, 0.065, b1, true); k1.position.x = -pw / 2; g.add(k1);
  const k2 = basket("FzBasket2", pw - 0.1, 0.07, 0.065, b2, true); k2.position.x = -pw / 2; g.add(k2);
  stock.doorFreezer(g, { fit: true, b1, b2, dep: 0.07, inside: inside(pw - 0.1) });
});
const fridgeDoor = doorShell("FridgeDoor", frLow, (g) => {
  const h = frTop - frLow, y = (v) => v - frLow;
  const part = (name, y0, y1, d, m) => g.add(mesh(name, new THREE.BoxGeometry(pw, y1 - y0, d), m, -pw / 2, (y(y0) + y(y1)) / 2, d / 2));
  g.add(mesh("FrPanelLow", flipV(new THREE.BoxGeometry(pw, y(groove), doorT)), [steelEdge, steelEdge, steelEdge, steelEdge, steelDoorR, liner], -pw / 2, y(groove) / 2, doorT / 2));
  part("FrGroove", groove, lowLip, doorT - 0.004, [black, black, black, black, black, liner]);
  part("FrLipLow", lowLip, bandBot, doorT, [steelEdge, steelEdge, silverLip, steelEdge, silverLip, liner]);
  part("GripBand", bandBot, lipTop, doorT - 0.016, black);
  for (const sx of [-1, 1]) g.add(box("GripEnd", 0.012, lipTop - bandBot - 0.0016, doorT - 0.001, black, -pw / 2 + sx * (pw / 2 - 0.006), (y(bandBot) + y(lipTop)) / 2, doorT / 2));
  part("FrLip", lipTop, frTop, doorT, [steelEdge, steelEdge, topSteel, steelEdge, silverLip, liner]);
  gaskets(g, "Fr", h);
  // basket floors on LG's open-door photo: 1.085, 0.865, 0.385 and 0.085 m
  const eggY = y(1.085), jarY = y(0.865), botY = y(0.385), canY = y(0.085);
  const add = (n, dep, hh, yy) => { const k = basket(n, pw - 0.12, dep, hh, yy, true); k.position.x = -pw / 2; g.add(k); };
  add("EggBasket", 0.075, 0.062, eggY); add("JarBasket", 0.085, 0.085, jarY); add("BottleBasket", 0.095, 0.17, botY); add("CanBasket", 0.08, 0.115, canY);
  g.add(box("EggCupsRib", pw - 0.14, 0.006, 0.05, clearRib, -pw / 2, eggY + 0.006, -0.047));
  stock.doorFridge(g, { fit: true, eggY, jarY, botY, canY, deps: { egg: 0.075, jar: 0.085, bottle: 0.095, can: 0.08 }, inside: inside(pw - 0.12) });
});
root.add(freezerDoor, fridgeDoor);

const parts = productParts(PRODUCTS, ID);
const clips = stateClips(root, parts);
saveZones(PRODUCTS, ID, root, parts);
const textures = {
  DoorFreezer: `${T}/door_freezer.jpg`, DoorFridge: `${T}/door_fridge.jpg`, SideSteel: `${T}/side.jpg`, SideSteelL: `${T}/side_l.jpg`, RearPlate: `${T}/rear.jpg`,
  LabelBEE: `${T}/label.png`, LgMark: `${T}/lgmark.png`, Display: `${T}/display.png`, PlateConvertible: `${T}/plate_convertible.jpg`, PlateHygiene: `${T}/plate_hygiene.jpg`,
  print_fresh0: `${T}/print_fresh0.png`, print_freshzone: `${T}/print_freshzone.png`,
};
Object.assign(textures, stock.textures());
// Grain (BENCHMARK.md section 10), as the LG 343 L: Shiny Steel is a printed steel look with fine vertical hairlines under a
// clear glossy film; the sides are smooth factory paint with a soft peel.
await exportGLB(root, clips, OUT, textures, { dir: `${TEX}/grain`, materials: {
  DoorFreezer: { type: "hairline", dir: "v", clearcoat: [0.6, 0.12] },
  DoorFridge: { type: "hairline", dir: "v", clearcoat: [0.6, 0.12] },
  SideSteel: { type: "peel_soft" }, SideSteelL: { type: "peel_soft" }, TopSteel: { type: "peel_soft" },
} });
