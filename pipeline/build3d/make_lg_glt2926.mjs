// LG GLT2926PDPZ, 288 L double-door frost-free convertible refrigerator, Shiny Steel.
// Built to LG's published size, 585 W x 1675 H x 669 D mm (LG's page, its owner's manual MFL72023402 for GLT29*, and
// Sangeetha listing 21326), from LG's gallery photos of this model (front, 3/4, sides, open, stocked, rear): freezer on top
// (59 L) with the word Convertible on its raised back panel under a row of air slots, a clear shelf and LG's 2 lever 2 tray
// Ice Maker hanging under it on the left; fridge below (229 L) with a top LED, an air duct down the back wall carrying the
// inner dot display (LG's Type A buttons), four toughened-glass shelves and a Fresh Zone drawer under a frosted cover;
// 2 baskets in the freezer door, 2 half and 3 full baskets in the fridge door; both doors hinged on the right; a pocket
// handle with black décor across the top of the fridge door: a bright silver top edge, the black recess with curved ends,
// and a silver lip under it. As on the LG 272 L, 251 L and 343 L, the trays (the shelves, the drawer and its cover) are one
// part (FridgeTrays) that slides out with its food when the fridge door is open.
// Heights are read off LG's photos (private research notes give each number and how it was measured).
// Stocked for a south Indian kitchen. usage: node make_lg_glt2926.mjs <products.json> <tex dir> <out.glb>
import fs from "node:fs";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { THREE, mat, mesh, box, faced, group, flipV, stateClips, exportGLB, productParts, saveZones } from "./lib.mjs";
import { LGStock } from "./stock_lg.mjs";

const [PRODUCTS, TEX, OUT] = process.argv.slice(2);
const ID = "lg-gl-t2926pdpz";
const T = `${TEX}/lg_glt2926`;

// ── size (metres) ──
const W = 0.585, H = 1.675, D = 0.669;
const doorT = 0.045, Dc = D - doorT;
const zBack = -D / 2, zFront = zBack + Dc;
const wall = 0.036, feet = 0.022;
const inW = W - 2 * wall, zIn1 = zBack + 0.06, inD = zFront - zIn1;
// vertical layout, measured on LG's straight front photo (1.675 mm a pixel up, 1.65 across) and the open-door photos
// DZ-04 (freezer) and DZ-05 (fridge) on the cabinet's front plane (1.455 and 1.447 mm a pixel)
const fy0 = 1.245, fy1 = 1.639;              // freezer cavity floor and ceiling
const gy0 = 0.065, gy1 = 1.165;              // fridge cavity floor and ceiling
const fzBot = 1.201;                         // freezer door bottom edge
const frTop = 1.197, frLow = 0.027;          // fridge door top and bottom
const stripBot = 1.1876;                     // the bright top edge of the fridge door, then the black pocket under it
const shelfFront = zFront - 0.115, drawerFront = zFront - 0.112, fzShelfFront = zFront - 0.09;
const s1 = 1.034, s2 = 0.848, s3 = 0.664, s4 = 0.548;   // the four glass shelves (their front rims on DZ-05)
const coverY = 0.4, drawerY = 0.085;         // the drawer's frosted cover and the drawer's floor
const fzShelfY = 1.394;                      // freezer shelf

// ── materials ──
const steelDoorF = mat("DoorFreezer", 0xd6d6d6, { metal: 0.38, rough: 0.5 });
const steelDoorR = mat("DoorFridge", 0xd6d6d6, { metal: 0.38, rough: 0.5 });
const sideSteel = mat("SideSteel", 0xd2d2d2, { metal: 0.38, rough: 0.5 });
const sideSteelL = mat("SideSteelL", 0xd2d2d2, { metal: 0.38, rough: 0.5 });
const sideEmboss = mat("SideEmboss", 0x8c8c8d, { metal: 0.38, rough: 0.5 });
const steelEdge = mat("SteelEdge", 0x9a9b9d, { metal: 0.2, rough: 0.6 });
const topSteel = mat("TopSteel", 0x7e8083, { metal: 0.15, rough: 0.7 });
// the pocket: black décor in the recess (LG's spec "Pocket (Black décor)"; the front photo reads 1-14 of 255 there),
// a bright silver top edge (190-199 against 170 on the door) and a silver lip under the recess
const pocket = mat("GripPocket", 0x17181a, { metal: 0.3, rough: 0.45 });
const silverLip = mat("SilverLip", 0xc4c5c8, { metal: 0.8, rough: 0.3 });
const logoM = mat("LgMark", 0xffffff, { rough: 0.5, opacity: 0.999 });
const rearM = mat("RearPlate", 0xffffff, { metal: 0.3, rough: 0.55 });
const liner = mat("Liner", 0xf1f3f5, { rough: 0.6 });
const linerSide = mat("LinerSide", 0xe4e8ec, { rough: 0.65 });
const linerDk = mat("LinerGrey", 0xcfd3d8, { rough: 0.6 });
const gasket = mat("Gasket", 0x6c7176, { rough: 0.85 });
const plinth = mat("Plinth", 0x1a1b1d, { rough: 0.8 });
const slotM = mat("VentSlot", 0x4a4d52, { rough: 0.7 });
const coverM = mat("HingeCover", 0x3a3c40, { rough: 0.55 });
const clear = mat("ClearPlastic", 0xc3d0da, { rough: 0.12, opacity: 0.5, side: THREE.DoubleSide });
const clearLight = mat("ClearPlasticLight", 0xdfe7ee, { rough: 0.12, opacity: 0.26, side: THREE.DoubleSide });
const frosted = mat("Frosted", 0xd9e2e8, { rough: 0.35, opacity: 0.6, side: THREE.DoubleSide });
const clearRib = mat("ClearRib", 0xffffff, { rough: 0.3, opacity: 0.92 });
const glass = mat("TemperedGlass", 0xa9cdd6, { rough: 0.05, opacity: 0.55, side: THREE.DoubleSide });
const glassRim = mat("ShelfRim", 0xe3e7ea, { rough: 0.45 });
const edgeGreen = mat("GlassEdge", 0x7fa7b0, { rough: 0.3 });
const white = mat("WhitePlastic", 0xf6f7f8, { rough: 0.45 });
const ice = mat("IceCube", 0xe3f4ff, { rough: 0.08, opacity: 0.72 });
const lightM = mat("Led", 0xffffff, { emissive: 0xf4f8ff, emissiveIntensity: 1.5 });
const footM = mat("Foot", 0x131416, { rough: 0.7 });
const cordM = mat("Cord", 0xc4c6c9, { rough: 0.6 });
const plugM = mat("Plug", 0xd9dadc, { rough: 0.5 });
const pinM = mat("Pin", 0xb7bbc0, { metal: 0.9, rough: 0.3 });
const hingeM = mat("Hinge", 0xc9ccd0, { metal: 0.9, rough: 0.3 });
const displayM = mat("ControlDisplay", 0xffffff, { rough: 0.4 });
const printConv = mat("print_convertible", 0xffffff, { rough: 0.6, opacity: 0.999 });
const printIce = mat("print_icemaker", 0xffffff, { rough: 0.6, opacity: 0.999 });
const printFresh = mat("print_freshzone", 0xffffff, { rough: 0.6, opacity: 0.999 });
const stock = LGStock({ T3: `${TEX}/lg_glt3426`, TF: `${TEX}/food`, BR: `${TEX}/brands`, BRT: `${TEX}/brands/small` });

// ── small builders ──
const cyl = (name, rt, rb, h, m, x, y, z, seg = 12) => mesh(name, new THREE.CylinderGeometry(rt, rb, h, seg), m, x, y, z);
const plane = (name, w, h, m, x, y, z) => mesh(name, flipV(new THREE.PlaneGeometry(w, h)), m, x, y, z);
// many small boxes of one material as one mesh: [w, h, d, x, y, z] each
const boxes = (name, list, m) => mesh(name, mergeGeometries(list.map(([w, h, d, x, y, z]) => new THREE.BoxGeometry(w, h, d).translate(x, y, z))), m);
// a row of n vertical air slots (w x h each, pitch p) centred at (x, y), on a face at z
const slots = (n, w, h, p, x, y, z) => [...Array(n)].map((_, i) => [w, h, 0.002, x + (i - (n - 1) / 2) * p, y, z]);
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

const root = group("LGGLT2926");
const cab = group("Cabinet");
root.add(cab);

// ── cabinet shell ──
const sideH = H - feet, sideMid = feet + sideH / 2, zMid = zBack + Dc / 2;
cab.add(mesh("SideLeft", flipV(new THREE.BoxGeometry(wall, sideH, Dc)), [linerSide, sideSteelL, topSteel, plinth, sideSteelL, sideSteelL], -W / 2 + wall / 2, sideMid, zMid));
cab.add(mesh("SideRight", flipV(new THREE.BoxGeometry(wall, sideH, Dc)), [sideSteel, linerSide, topSteel, plinth, sideSteel, sideSteel], W / 2 - wall / 2, sideMid, zMid));
// four pressed louvres low on each side, towards the back (LG's side photo DZ-08; DZ-09 shows the left side the same):
// flat rectangles 0.6 mm proud; two long ones over two short ones, their front ends in line. Heights read at their back
// ends on DZ-08 (about 1.6 mm a pixel there); the distances from the back are estimated from the foreshortened side.
{
  const L = [[0.261, 0.287, 0.09], [0.203, 0.231, 0.09], [0.135, 0.158, 0.16], [0.077, 0.099, 0.16]];
  for (const [sx, n] of [[-1, "SideLouvreL"], [1, "SideLouvreR"]]) cab.add(boxes(n, L.map(([y0, y1, zb]) => [0.0006, y1 - y0, 0.255 - zb, sx * (W / 2 + 0.0003), (y0 + y1) / 2, zBack + (zb + 0.255) / 2]), sideEmboss));
}
cab.add(faced("Top", inW, 0.045, Dc, [topSteel, topSteel, topSteel, liner, topSteel, topSteel], 0, H - 0.0225, zMid));
cab.add(faced("Divider", inW, fy0 - gy1, inD, [liner, liner, liner, liner, liner, liner], 0, (fy0 + gy1) / 2, zIn1 + inD / 2));
cab.add(faced("Base", inW, gy0 - feet, Dc, [liner, liner, liner, liner, liner, liner], 0, feet + (gy0 - feet) / 2, zMid));
cab.add(box("Kickplate", inW, 0.026, 0.012, plinth, 0, feet + 0.013, zFront - 0.006));
cab.add(faced("BackFreezer", inW, fy1 - fy0, 0.012, [liner, liner, liner, liner, liner, liner], 0, (fy0 + fy1) / 2, zIn1 + 0.006));
cab.add(faced("BackFridge", inW, gy1 - gy0, 0.012, [liner, liner, liner, liner, liner, liner], 0, (gy0 + gy1) / 2, zIn1 + 0.006));
// the real back: LG's rear photo (cropped to the cabinet's full-width rows, the cord painted out) on a thin plate
const rearBot = 0.015, rearTop = H;
cab.add(mesh("RearPlate", flipV(new THREE.BoxGeometry(W, rearTop - rearBot, 0.004)), [steelEdge, steelEdge, steelEdge, steelEdge, steelEdge, rearM], 0, (rearTop + rearBot) / 2, zBack + 0.002));
// feet: on LG's front photo the left one is a black puck set in from the edge (its middle 28 mm in) and further back,
// the right one at the front under the bottom hinge (26 mm in), a black knob on a threaded stem; two rollers at the back
cab.add(cyl("FootFront", 0.016, 0.017, 0.016, footM, -(W / 2 - 0.028), 0.008, zFront - 0.05, 16));
cab.add(cyl("FootThread", 0.006, 0.006, feet - 0.016, pinM, -(W / 2 - 0.028), 0.016 + (feet - 0.016) / 2, zFront - 0.05, 10));
cab.add(cyl("FootFront", 0.017, 0.018, 0.016, footM, W / 2 - 0.026, 0.008, zFront - 0.004, 16));
cab.add(cyl("FootThread", 0.006, 0.006, 0.012, pinM, W / 2 - 0.026, 0.022, zFront - 0.004, 10));
for (const fx of [-1, 1]) cab.add(cyl("Roller", 0.017, 0.017, 0.018, footM, fx * (W / 2 - 0.045), 0.017, zBack + 0.06).rotateZ(Math.PI / 2));
// hinges on the right: a dark bracket under the fridge door, a steel plate with two bolt heads in the 4 mm gap between the
// doors (DZ-03), and LG's dark hinge cover on the top behind the freezer door (DZ-03, DZ-08: no print the photos can read)
cab.add(box("HingeBottom", 0.042, 0.004, 0.045, plinth, W / 2 - 0.048, 0.02, zFront + 0.0125));
cab.add(box("HingeMid", 0.034, 0.003, doorT + 0.012, hingeM, W / 2 - 0.02, (fzBot + frTop) / 2, zFront + (doorT + 0.012) / 2 - 0.012));
const hcW = 0.13, hcH = 0.024, hcD = 0.06;
cab.add(box("HingeCoverTop", hcW, hcH, hcD, coverM, W / 2 - 0.004 - hcW / 2, H + 0.001 - hcH / 2, zFront - 0.002 - hcD / 2));
// power cord: its route on the back traced on LG's rear photo (rear_paths.json); past the cabinet's edge the photo does
// not show it, so it is drawn hanging to the floor with its three-pin plug lying there (estimated)
{
  const RP = JSON.parse(fs.readFileSync(`${T}/rear_paths.json`, "utf8"));
  const zc = zBack - 0.0045, V = (x, y, z) => new THREE.Vector3(x, y, z);
  const pts = RP.cord.map(([u, v]) => V(Math.min(W / 2 - u * W, W / 2 - 0.008), rearTop - v * (rearTop - rearBot), zc));
  const end = pts[pts.length - 1], px = W / 2 - 0.04, py = 0.023, pz = zBack - 0.1;
  pts.push(V(W / 2 - 0.011, end.y - 0.04, zBack - 0.012), V(W / 2 - 0.014, Math.min(0.16, end.y - 0.08), zBack - 0.022), V(W / 2 - 0.022, 0.045, zBack - 0.042), V(px, py, pz + 0.006));
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
// the raised back panel (DZ-04: about 0.40 m wide, from under the shelf up to near the ceiling) with a row of air slots
// along its top (three groups), the word Convertible, and four slots under the shelf on the right; a slotted return strip
// across the front of the floor (DZ-06). No dial: the controls are on the fridge's display.
const pz0 = zIn1 + 0.012, pzF = pz0 + 0.008, gy = 1.53;
cab.add(box("FreezerPanel", 0.4, 1.551 - 1.3, 0.008, liner, 0, (1.551 + 1.3) / 2, pz0 + 0.004));
cab.add(boxes("FreezerGrilleSlot", [...slots(20, 0.003, 0.01, 0.007, -0.12, gy, pzF + 0.0006), ...slots(4, 0.003, 0.01, 0.007, -0.017, gy, pzF + 0.0006), ...slots(24, 0.003, 0.01, 0.007, 0.103, gy, pzF + 0.0006)], slotM));
cab.add(boxes("FreezerSlot", slots(4, 0.004, 0.012, 0.009, 0.113, 1.355, pzF + 0.0006), slotM));
cab.add(plane("PrintConvertible", 0.132, 0.028, printConv, 0, 1.452, pzF + 0.0006));
cab.add(box("FreezerFloorVent", 0.32, 0.003, 0.025, white, 0.001, fy0 + 0.0015, zFront - 0.04));
cab.add(boxes("FreezerFloorSlot", [...Array(13)].map((_, i) => [0.016, 0.001, 0.012, -0.144 + i * 0.024, fy0 + 0.0033, zFront - 0.04]), plinth));
// the freezer shelf across the cavity: clear, white rims
{
  const g = group("FreezerShelf", 0, fzShelfY, 0), bd = fzShelfFront - 0.005 - zIn1 - 0.02;
  g.add(box("FzShelfBin", inW - 0.012, 0.005, bd, clear, 0, 0, zIn1 + bd / 2 + 0.02));
  g.add(box("FzShelfRimF", inW - 0.008, 0.012, 0.01, glassRim, 0, 0.004, fzShelfFront - 0.005));
  g.add(box("FzShelfRimB", inW - 0.008, 0.01, 0.008, glassRim, 0, 0.003, pzF + 0.006));
  g.add(box("FzShelfRailL", 0.008, 0.012, bd, glassRim, xL + 0.01, 0.003, zIn1 + bd / 2 + 0.02));
  g.add(box("FzShelfRailR", 0.008, 0.012, bd, glassRim, xR - 0.01, 0.003, zIn1 + bd / 2 + 0.02));
  cab.add(g);
}
// LG's Ice Maker hangs under the shelf on the left (DZ-04, DZ-06: about 170 mm wide, its middle 108 mm left of centre,
// the white front printed "Ice Maker" 1.33-1.39 m with the two trays' levers on top, the clear bucket down to about
// 1.26 m); its front stays 95 mm behind the door's face so the lower door basket clears it
const icX = -0.108, icW = 0.17, icZ = zFront - 0.095, icDY = 0.075;
cab.add(box("IceHousingTop", icW + 0.01, 0.006, 0.2, white, icX, fzShelfY - 0.011, icZ - 0.1));
cab.add(box("IceHousingSideL", 0.005, 0.12, 0.2, white, icX - icW / 2 - 0.0025, fzShelfY - 0.074, icZ - 0.1));
cab.add(box("IceHousingSideR", 0.005, 0.12, 0.2, white, icX + icW / 2 + 0.0025, fzShelfY - 0.074, icZ - 0.1));

// ── fridge inside ──
const trays = group("FridgeTrays");
cab.add(trays);
cab.add(box("FridgeLed", 0.11, 0.006, 0.016, lightM, 0, gy1 - 0.006, zFront - 0.16));
// the air duct down the back wall (DZ-05: about 0.27 m wide, from the ceiling to 0.53 m): the inner dot display
// (114 x 64 mm, centred at 0.958 m), four slots either side of it and three over it, a round deodoriser cap at 0.81 m and
// two groups of three slots at 0.71 m
const dz0 = zIn1 + 0.012, dzF = dz0 + 0.009;
cab.add(box("DuctCover", 0.27, gy1 - 0.001 - 0.526, 0.009, liner, 0, (0.526 + gy1 - 0.001) / 2, dz0 + 0.0045));
cab.add(mesh("ControlDisplay", flipV(new THREE.BoxGeometry(0.114, 0.064, 0.003)), [linerDk, linerDk, linerDk, linerDk, displayM, linerDk], 0, 0.958, dzF + 0.0015));
cab.add(boxes("DuctSlot", [...slots(4, 0.005, 0.024, 0.008, -0.083, 0.967, dzF + 0.0006), ...slots(4, 0.005, 0.024, 0.008, 0.083, 0.967, dzF + 0.0006),
  ...slots(4, 0.004, 0.012, 0.006, 0.004, 1.0, dzF + 0.0006), ...slots(3, 0.004, 0.018, 0.007, -0.08, 0.714, dzF + 0.0006), ...slots(3, 0.004, 0.018, 0.007, 0.08, 0.714, dzF + 0.0006)], slotM));
{ const c = cyl("Deodorizer", 0.014, 0.014, 0.004, linerDk, 0, 0.812, dzF + 0.002, 24); c.rotation.x = Math.PI / 2; cab.add(c); }
// four toughened-glass shelves with white rims
function shelf(name, y) {
  const g = group(name, 0, y, 0), bd = shelfFront - 0.0085 - dzF - 0.004;
  g.add(box(name + "Glass", inW - 0.01, 0.006, bd, glass, 0, 0, dzF + 0.004 + bd / 2));
  g.add(box(name + "Rim", inW - 0.01, 0.014, 0.012, glassRim, 0, 0.004, shelfFront - 0.0085));
  g.add(box(name + "Edge", inW - 0.01, 0.004, 0.003, edgeGreen, 0, -0.002, shelfFront - 0.0015));
  g.add(box(name + "RimBack", inW - 0.01, 0.01, 0.01, glassRim, 0, 0.002, dzF + 0.01));
  g.add(box(name + "RailL", 0.01, 0.014, bd, glassRim, xL + 0.012, 0, dzF + 0.004 + bd / 2));
  g.add(box(name + "RailR", 0.01, 0.014, bd, glassRim, xR - 0.012, 0, dzF + 0.004 + bd / 2));
  trays.add(g);
}
shelf("Shelf1", s1);
shelf("Shelf2", s2);
shelf("Shelf3", s3);
shelf("Shelf4", s4);
// Fresh Zone: a frosted cover over the drawer with its humidity slider at the front (DZ-03, DZ-05), and the drawer,
// clear all round, its front printed Fresh Zone / Fruit & Vegetables
const fzD = drawerFront - zIn1 - 0.016, fzW = inW - 0.02, fzC = zIn1 + fzD / 2 + 0.016, fzH = coverY - 0.012 - drawerY;
{
  const g = group("FreshZoneCover", 0, 0, 0);
  g.add(box("FzCover", inW - 0.01, 0.006, fzD, frosted, 0, coverY, fzC));
  g.add(box("FzCoverRim", inW - 0.01, 0.012, 0.012, glassRim, 0, coverY + 0.003, drawerFront - 0.006));
  g.add(box("HumiditySlider", 0.03, 0.006, 0.006, hingeM, 0, coverY + 0.003, drawerFront + 0.003));
  trays.add(g);
}
{
  const g = group("FreshZone", 0, 0, 0), bd = fzD, bw = fzW, zc = fzC, yc = drawerY + fzH / 2;
  g.add(box("FzBoxFloor", bw, 0.004, bd, clear, 0, drawerY, zc));
  g.add(box("FzBoxBack", bw, fzH, 0.004, clear, 0, yc, zIn1 + 0.018));
  g.add(box("FzBoxL", 0.004, fzH, bd, clear, -bw / 2, yc, zc));
  g.add(box("FzBoxR", 0.004, fzH, bd, clear, bw / 2, yc, zc));
  g.add(box("FzBoxFront", bw, fzH, 0.004, clearLight, 0, yc, zc + bd / 2));
  g.add(box("FzBoxRim", bw, 0.008, 0.008, clearRib, 0, drawerY + fzH - 0.004, zc + bd / 2));
  g.add(plane("PrintFreshZone", 0.084, 0.032, printFresh, 0, 0.195, zc + bd / 2 + 0.0026));
  trays.add(g);
}

// ── stock: vegetarian South Indian food, eggs, juices, water and soft drinks (stock_lg.mjs, food.mjs) ──
// stock_lg.mjs fills three shelves and the drawer; this fridge has four. The top shelf has only 13 cm under the ceiling,
// so it carries the low dairy (butter, cheese, curd cups: stock_lg's Fresh 0 Zone set), and stock_lg's three shelves go
// on shelves 2, 3 and 4 (the tall tiffin, batter and buttermilk on shelf 2, where there is room for them)
const shw = inW / 2 - 0.03;
stock.shelves(trays, {
  zIn1, inW, inD, s1: s2, s2: s3, s3: s4, fz: drawerY + 0.002, fit: true, vk: 0.65,
  shelfB: { hw: shw, z0: dzF + 0.016, z1: shelfFront - 0.015 },
  drawerB: { hw: fzW / 2 - 0.014, z0: zIn1 + 0.04, z1: drawerFront - 0.006, y0: drawerY + 0.002 },
  drawerCeil: coverY - 0.003 - 0.01 - (drawerY + 0.002), // the heap stays 1 cm under the drawer's cover
});
stock.fresh0(trays, { y: s1 + 0.003, z: dzF + 0.2, bx: -0.17 });
const below = { F0Stock: gy1 - 0.008, Shelf1Stock: s1 - 0.003, Shelf2Stock: s2 - 0.003, Shelf3Stock: s3 - 0.003 };
for (const [n, top] of Object.entries(below)) {
  leaveOut(trays.getObjectByName(n), [B3(-1, 0, shelfFront - 0.016, 1, 2, 1), B3(-1, 0, -1, -shw - 0.003, 2, 1), B3(shw + 0.003, 0, -1, 1, 2, 1)], `past ${n}'s side or front`);
  leaveOut(trays.getObjectByName(n), [B3(-1, top - 0.01, -1, 1, 3, 1)], `under the shelf or ceiling above ${n}`);
}
trays.getObjectByName("Cauliflower")?.traverse((m) => {
  if (!m.isMesh) return;
  m.updateMatrix(); m.geometry = m.geometry.clone().applyMatrix4(m.matrix);
  m.position.set(0, 0, 0); m.rotation.set(0, 0, 0); m.scale.set(1, 1, 1);
});
// the freezer floor: the ice maker hangs on the left, so the floor's food stays behind it (z1), and anything taller than
// the room under the shelf is left out
stock.freezer(cab, { fit: true, zIn1: pzF - 0.006, floor: fy0, top: fzShelfY + 0.0025, box: { hw: inW / 2 - 0.015, z0: pzF + 0.026, z1: icZ - 0.21 } });
leaveOut(cab.getObjectByName("FreezerStock"), [B3(-1, fzShelfY - 0.016, -1, 1, 2, 1)], "under the freezer shelf");
{
  const t = cab.getObjectByName("OnFreezerShelf");
  t.position.z -= 0.04;
  leaveOut(t, [B3(-1, fzShelfY - 0.01, fzShelfFront - 0.012, 1, fy1, 1), B3(-1, fy1 - 0.01, -1, 1, 2, 1)], "past the freezer shelf's front or under the ceiling");
}

// ── ice maker: the tray unit and the bucket slide out together (a real part) ──
const ic = group("IceMaker", icX, 0, icZ);
{
  ic.add(mesh("IceFace", new THREE.BoxGeometry(icW, 0.03, 0.02), white, 0, 1.284, -0.01));
  ic.add(plane("PrintIceMaker", 0.048, 0.012, printIce, 0.01, 1.284, 0.0006));
  for (const dx of [-0.045, 0.045]) ic.add(box("IceLever", 0.06, 0.012, 0.02, white, dx, 1.305, -0.03));
  ic.add(box("IceTrayBody", icW - 0.012, 0.04, 0.17, white, 0, 1.285, -0.11));
  ic.add(box("IceBucketFloor", icW - 0.01, 0.004, 0.17, clear, 0, 1.185, -0.115));
  ic.add(box("IceBucketFront", icW - 0.01, 0.065, 0.004, clear, 0, 1.2175, -0.032));
  ic.add(box("IceBucketL", 0.004, 0.065, 0.17, clear, -(icW - 0.01) / 2, 1.2175, -0.115));
  ic.add(box("IceBucketR", 0.004, 0.065, 0.17, clear, (icW - 0.01) / 2, 1.2175, -0.115));
  ic.add(box("IceBucketHandle", 0.07, 0.008, 0.01, clearRib, 0, 1.243, -0.028));
  const cubes = [];
  for (let i = 0; i < 16; i++) {
    const c = new THREE.BoxGeometry(0.03, 0.025, 0.03);
    c.applyMatrix4(new THREE.Matrix4().compose(new THREE.Vector3(-0.055 + (i % 4) * 0.037 + (Math.floor(i / 4) % 2) * 0.012, 1.201 + Math.floor(i / 8) * 0.022, -0.06 - Math.floor((i % 8) / 4) * 0.055 - (i % 3) * 0.012),
      new THREE.Quaternion().setFromEuler(new THREE.Euler(0.2 * (i % 3), 0.5 * i, 0.15 * (i % 4))), new THREE.Vector3(1, 1, 1)));
    cubes.push(c);
  }
  ic.add(mesh("IceCube", mergeGeometries(cubes), ice));
}
cab.add(ic);
ic.position.y = icDY;

// ── doors: hinged on the right, no handles, the pocket at the top of the fridge door ──
const pw = W - 0.004;
const inside = (w, cx = -pw / 2) => (dep) => [cx - w / 2 + 0.004, cx + w / 2 - 0.004, -(0.01 + dep / 2)];
function doorShell(name, y0, parts) { const g = group(name, W / 2, y0, zFront); parts(g); return g; }
// line items up across [x0, x1] (door space) with even gaps, their middles at depth zm
function rowAt(g, items, x0, x1, zm) {
  g.updateMatrixWorld(true);
  const p = g.position, bs = items.map((o) => new THREE.Box3().setFromObject(o));
  const gap = (x1 - x0 - bs.reduce((s, b) => s + b.max.x - b.min.x, 0)) / (items.length + 1);
  if (gap < 0) console.warn(`rowAt: ${items.map((o) => o.name)} do not fit`);
  let x = x0 + gap;
  items.forEach((o, i) => { const b = bs[i]; o.position.x += x - (b.min.x - p.x); o.position.z += zm - ((b.min.z + b.max.z) / 2 - p.z); x += b.max.x - b.min.x + gap; });
}
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
  // the LG mark, measured on LG's front photo: 63 x 29 mm, its middle 66 mm from the left and 49 mm down
  g.add(plane("LgMarkDecal", 0.063, 0.0289, logoM, -pw + 0.064, h - 0.049, doorT + 0.0006));
  gaskets(g, "Fz", h);
  // basket floors on LG's open-door photo DZ-04 (the bottom of each basket's end at the hinge): 1.479 and 1.287 m
  const b1 = 1.479 - fzBot, b2 = 1.287 - fzBot;
  const k1 = basket("FzBasket1", pw - 0.1, 0.07, 0.062, b1, true); k1.position.x = -pw / 2; g.add(k1);
  const k2 = basket("FzBasket2", pw - 0.1, 0.07, 0.062, b2, true); k2.position.x = -pw / 2; g.add(k2);
  stock.doorFreezer(g, { fit: true, b1, b2, dep: 0.07, inside: inside(pw - 0.1) });
});
// the fridge door's front: a skin with a notch for the pocket (LG's front photo, measured in mm in from each side against
// the depth below the pocket's top): the black recess narrows from 42 mm in at its top to 130 mm in at its foot 36 mm
// down, along curved ends; the silver lip runs round it, 48 mm down in the middle
const POCKET = [[0, 42], [3.4, 46], [8.4, 53], [13.4, 59], [18.4, 69], [23.5, 78], [28.5, 91], [31.8, 102], [33.5, 109], [35.2, 119], [36, 130]];
const LIP = [[0, 38], [8, 43], [16, 51], [24, 63], [31, 77], [37, 91], [42, 105], [45.5, 119], [47.7, 135]];
function uvFront(geo, hF) {
  const p = geo.attributes.position, uv = geo.attributes.uv;
  for (let i = 0; i < p.count; i++) uv.setXY(i, (p.getX(i) + pw) / pw, 1 - p.getY(i) / hF);
  return geo;
}
const fridgeDoor = doorShell("FridgeDoor", frLow, (g) => {
  const h = frTop - frLow, hF = stripBot - frLow, skin = 0.016;
  // the door's core: its sides, the liner behind, and the black of the pocket's back wall seen through the notch
  g.add(mesh("FrCore", new THREE.BoxGeometry(pw, hF, doorT - skin - 0.001), [steelEdge, steelEdge, steelEdge, steelEdge, pocket, liner], -pw / 2, hF / 2, (doorT - skin - 0.001) / 2));
  // the steel skin, notched round the lip's outline
  const sh = new THREE.Shape();
  sh.moveTo(-pw, 0); sh.lineTo(0, 0); sh.lineTo(0, hF);
  const lipR = LIP.map(([d, i]) => [-i / 1000, hF - d / 1000]), lipL = LIP.map(([d, i]) => [-pw + i / 1000, hF - d / 1000]);
  for (const p of lipR) sh.lineTo(...p);
  for (const p of lipL.slice().reverse()) sh.lineTo(...p);
  sh.lineTo(-pw, hF); sh.lineTo(-pw, 0);
  g.add(mesh("FrSkin", uvFront(new THREE.ExtrudeGeometry(sh, { depth: skin, bevelEnabled: false, curveSegments: 4 }), hF), [steelDoorR, steelEdge], 0, 0, doorT - skin));
  // the silver lip: the band between the lip's outline and the recess's, 6 mm back from the door's face
  const band = new THREE.Shape();
  const lo = LIP.map(([d, i]) => [-pw + i / 1000, hF - d / 1000]).concat(LIP.map(([d, i]) => [-i / 1000, hF - d / 1000]).reverse());
  const po = POCKET.map(([d, i]) => [-pw + i / 1000, hF - d / 1000]).concat(POCKET.map(([d, i]) => [-i / 1000, hF - d / 1000]).reverse());
  band.moveTo(...lo[0]);
  for (const p of lo.slice(1)) band.lineTo(...p);
  for (const p of po.slice().reverse()) band.lineTo(...p);
  band.lineTo(...lo[0]);
  g.add(mesh("FrLip", new THREE.ShapeGeometry(band), silverLip, 0, 0, doorT - 0.006));
  // the bright top edge over the pocket, the door's full width
  g.add(mesh("FrTopEdge", new THREE.BoxGeometry(pw, h - hF, doorT), [steelEdge, steelEdge, steelEdge, steelEdge, silverLip, liner], -pw / 2, hF + (h - hF) / 2, doorT / 2));
  gaskets(g, "Fr", h);
  // two half baskets at the top and three full ones (LG's spec "3 Full + 2 Half"); floors on LG's open-door photo DZ-05
  // at the hinge edge: 1.011, 0.628, 0.366 and 0.093 m. Eggs go in the half basket by the hinge, bottles in the tall
  // second basket (the only one with room under the next), jars in the third and cans at the foot.
  const y = (v) => v - frLow;
  const halfY = y(1.011), botY = y(0.628), jarY = y(0.366), canY = y(0.093);
  const hw = (pw - 0.12) / 2 - 0.0045, hcx = -pw / 2 + hw / 2 + 0.0045, ocx = -pw / 2 - hw / 2 - 0.0045;
  for (const [n, cx] of [["HalfBasketHinge", hcx], ["HalfBasketOuter", ocx]]) { const k = basket(n, hw, 0.075, 0.04, halfY, true); k.position.x = cx; g.add(k); }
  const add = (n, dep, hh, yy) => { const k = basket(n, pw - 0.12, dep, hh, yy, true); k.position.x = -pw / 2; g.add(k); };
  add("BottleBasket", 0.095, 0.1, botY); add("JarBasket", 0.085, 0.085, jarY); add("CanBasket", 0.08, 0.065, canY);
  const deps = { egg: 0.075, jar: 0.085, bottle: 0.095, can: 0.08 };
  const inn = inside(pw - 0.12);
  stock.doorFridge(g, {
    fit: true, eggY: halfY, jarY, botY, canY, deps, eggDY: 0.004, eggX: [-1.5, -0.5, 0.5, 1.5].map((k) => hcx + k * 0.052),
    inside: (dep) => (dep === deps.egg ? inside(hw, hcx)(dep) : inn(dep)),
  });
});
root.add(freezerDoor, fridgeDoor);

const parts = productParts(PRODUCTS, ID);
const clips = stateClips(root, parts);
saveZones(PRODUCTS, ID, root, parts);
const textures = {
  DoorFreezer: `${T}/door_freezer.jpg`, DoorFridge: `${T}/door_fridge.jpg`, SideSteel: `${T}/side.jpg`, SideSteelL: `${T}/side_l.jpg`, RearPlate: `${T}/rear.jpg`,
  LgMark: `${T}/lgmark.png`, ControlDisplay: `${T}/display.jpg`, print_convertible: `${T}/print_convertible.png`, print_icemaker: `${T}/print_icemaker.png`,
  print_freshzone: `${T}/print_freshzone.png`,
};
Object.assign(textures, stock.textures());
{ const used = new Set(); root.traverse((o) => o.isMesh && [].concat(o.material).forEach((m) => used.add(m.name))); for (const k of Object.keys(textures)) if (!used.has(k)) delete textures[k]; }
// Grain (BENCHMARK.md section 10), as the LG 272 L, 251 L and 343 L: Shiny Steel is a printed steel look with fine
// vertical hairlines under a clear glossy film (PET door, LG's spec); the sides are smooth factory paint with a soft peel.
await exportGLB(root, clips, OUT, textures, { dir: `${TEX}/grain`, materials: {
  DoorFreezer: { type: "hairline", dir: "v", clearcoat: [0.6, 0.12] },
  DoorFridge: { type: "hairline", dir: "v", clearcoat: [0.6, 0.12] },
  SideSteel: { type: "peel_soft" }, SideSteelL: { type: "peel_soft" }, TopSteel: { type: "peel_soft" },
} });
