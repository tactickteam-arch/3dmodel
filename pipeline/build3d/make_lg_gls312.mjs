// LG GL-S312SPZY, 272 L double-door frost-free convertible refrigerator, Shiny Steel.
// Built to LG's published size, 555 W x 1680 H x 637 D mm (LG's page, its owner's manual MFL71853701 and Sangeetha listing
// 21469), from LG's gallery photos of this model (front, 3/4, sides, open, stocked, rear): freezer on top (58 L) with the
// word Convertible on its back wall, a clear shelf and LG's Moving Icemaker hanging under it on the left; fridge below
// (214 L) with a clear Pull-out Tray under the ceiling, the touch control plate on the back wall, two tempered-glass shelves,
// a glass cover and a clear Fresh Zone drawer; 2 baskets in the freezer door and 4 in the fridge door; both doors hinged on
// the right; a recessed pocket grip across the top of the fridge door over a bright silver lip. As on the LG 251 L and
// 343 L, the trays (the Pull-out Tray, the shelves, the drawer's glass cover and the drawer) are one part (FridgeTrays) that
// slides out with its food when the fridge door is open.
// Heights are read off LG's photos (private research notes give each number and how it was measured).
// Stocked for a south Indian kitchen. usage: node make_lg_gls312.mjs <products.json> <tex dir> <out.glb>
import fs from "node:fs";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { THREE, mat, mesh, box, faced, group, flipV, stateClips, exportGLB, productParts, saveZones } from "./lib.mjs";
import { LGStock } from "./stock_lg.mjs";

const [PRODUCTS, TEX, OUT] = process.argv.slice(2);
const ID = "lg-gl-s312spzy";
const T = `${TEX}/lg_gls312`;

// ── size (metres) ──
const W = 0.555, H = 1.680, D = 0.637;
const doorT = 0.045, Dc = D - doorT;
const zBack = -D / 2, zFront = zBack + Dc;
const wall = 0.036, feet = 0.022;
const inW = W - 2 * wall, zIn1 = zBack + 0.06, inD = zFront - zIn1;
// vertical layout, measured on LG's front photo (1.51 mm a pixel) and its open-door photo DZ-6 (1.90 mm a pixel on the
// cabinet's front, 1.81 on the open doors' hinge edge)
const fy0 = 1.235, fy1 = 1.640;              // freezer cavity floor and ceiling
const gy0 = 0.065, gy1 = 1.150;              // fridge cavity floor and ceiling
const fzBot = 1.194;                         // freezer door bottom edge
const frTop = 1.180, frLow = 0.032;          // fridge door top and bottom
const bandBot = 1.151, lipBot = 1.133;       // the recessed pocket grip at the top, then the bright silver lip under it
// With the doors shut their baskets reach into the cabinet, so the shelves, the drawer and its cover end 1 cm short of
// them, and the freezer shelf and the ice maker short of the freezer's baskets.
const shelfFront = zFront - 0.115, drawerFront = zFront - 0.112, fzShelfFront = zFront - 0.09;
const s1 = 0.795, s2 = 0.608;                // the two glass shelves
const coverY = 0.333, drawerY = 0.088;       // the drawer's glass cover (food stands on it) and the drawer's floor
const topY = 0.980;                          // the Pull-out Tray's floor
const fzShelfY = 1.41;                       // freezer shelf

// ── materials ──
const steelDoorF = mat("DoorFreezer", 0xd6d6d6, { metal: 0.38, rough: 0.5 });
const steelDoorR = mat("DoorFridge", 0xd6d6d6, { metal: 0.38, rough: 0.5 });
const sideSteel = mat("SideSteel", 0xd2d2d2, { metal: 0.38, rough: 0.5 });
const sideSteelL = mat("SideSteelL", 0xd2d2d2, { metal: 0.38, rough: 0.5 });
const sideEmboss = mat("SideEmboss", 0x8c8c8d, { metal: 0.38, rough: 0.5 });
const steelEdge = mat("SteelEdge", 0x9a9b9d, { metal: 0.2, rough: 0.6 });
const topSteel = mat("TopSteel", 0x7e8083, { metal: 0.15, rough: 0.7 });
// the pocket: a recessed mid-grey metallic band (LG's front photo: about 100 grey, against 150-160 on the doors and 220-250
// on the lip under it)
const pocket = mat("GripPocket", 0x85888e, { metal: 0.5, rough: 0.4 });
const silverLip = mat("SilverLip", 0xb4b5b7, { metal: 0.8, rough: 0.3 });
const logoM = mat("LgMark", 0xffffff, { rough: 0.5, opacity: 0.999 });
const rearM = mat("RearPlate", 0xffffff, { metal: 0.3, rough: 0.55 });
const liner = mat("Liner", 0xf1f3f5, { rough: 0.6 });
const linerSide = mat("LinerSide", 0xe4e8ec, { rough: 0.65 });
const linerDk = mat("LinerGrey", 0xcfd3d8, { rough: 0.6 });
const gasket = mat("Gasket", 0x6c7176, { rough: 0.85 });
const plinth = mat("Plinth", 0x1a1b1d, { rough: 0.8 });
const coverM = mat("HingeCover", 0x3a3c40, { rough: 0.55 });
const clear = mat("ClearPlastic", 0xc3d0da, { rough: 0.12, opacity: 0.5, side: THREE.DoubleSide });
const clearLight = mat("ClearPlasticLight", 0xdfe7ee, { rough: 0.12, opacity: 0.26, side: THREE.DoubleSide });
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
const plateM = mat("ControlPlate", 0xffffff, { metal: 0.5, rough: 0.35 });
const ringM = mat("ControlRing", 0x9fa3a8, { metal: 0.9, rough: 0.25 });
const printConv = mat("print_convertible", 0xffffff, { rough: 0.6, opacity: 0.999 });
const printPull = mat("print_pullout", 0xffffff, { rough: 0.6, opacity: 0.999 });
const printFresh = mat("print_freshzone", 0xffffff, { rough: 0.6, opacity: 0.999 });
const printTop = mat("print_topcover", 0xffffff, { rough: 0.6, opacity: 0.999 });
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

const root = group("LGGLS312");
const cab = group("Cabinet");
root.add(cab);

// ── cabinet shell ──
const sideH = H - feet, sideMid = feet + sideH / 2, zMid = zBack + Dc / 2;
cab.add(mesh("SideLeft", flipV(new THREE.BoxGeometry(wall, sideH, Dc)), [linerSide, sideSteelL, topSteel, plinth, sideSteelL, sideSteelL], -W / 2 + wall / 2, sideMid, zMid));
cab.add(mesh("SideRight", flipV(new THREE.BoxGeometry(wall, sideH, Dc)), [sideSteel, linerSide, topSteel, plinth, sideSteel, sideSteel], W / 2 - wall / 2, sideMid, zMid));
// four pressed louvres low on each side, towards the back (LG's side photos DZ-8 and DZ-9): flat rectangles 0.6 mm proud,
// heights above the floor and distances from the back measured on DZ-8
{
  const L = [[0.270, 0.294, 0.0975], [0.212, 0.236, 0.0975], [0.163, 0.185, 0.167], [0.108, 0.130, 0.167]];
  // one mesh a side, so neither side's louvres span the cabinet's inside
  for (const [sx, n] of [[-1, "SideLouvreL"], [1, "SideLouvreR"]]) cab.add(boxes(n, L.map(([y0, y1, zb]) => [0.0006, y1 - y0, 0.258 - zb, sx * (W / 2 + 0.0003), (y0 + y1) / 2, zBack + (zb + 0.258) / 2]), sideEmboss));
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
// feet: on LG's front photo the left one is set in from the edge and back, the right one at the very edge under the
// bottom hinge, a black knob on a threaded stem; two rollers at the back
cab.add(cyl("FootFront", 0.016, 0.017, 0.016, footM, -(W / 2 - 0.031), 0.008, zFront - 0.05, 16));
cab.add(cyl("FootThread", 0.006, 0.006, feet - 0.016, pinM, -(W / 2 - 0.031), 0.016 + (feet - 0.016) / 2, zFront - 0.05, 10));
cab.add(cyl("FootFront", 0.016, 0.017, 0.016, footM, W / 2 - 0.017, 0.008, zFront - 0.004, 16));
cab.add(cyl("FootThread", 0.006, 0.006, 0.012, pinM, W / 2 - 0.017, 0.022, zFront - 0.004, 10));
for (const fx of [-1, 1]) cab.add(cyl("Roller", 0.017, 0.017, 0.018, footM, fx * (W / 2 - 0.045), 0.017, zBack + 0.06).rotateZ(Math.PI / 2));
// hinges on the right: a dark bracket under the fridge door, a steel plate with two bolt heads between the doors, and on
// top LG's dark hinge cover (DZ-3, DZ-6: about 150 mm wide, behind the freezer door) printed with the Smart Diagnosis mark
cab.add(box("HingeBottom", 0.042, 0.004, 0.045, plinth, W / 2 - 0.048, 0.026, zFront + 0.0125));
cab.add(box("HingeMid", 0.034, 0.0035, doorT + 0.012, hingeM, W / 2 - 0.02, (fzBot + frTop) / 2, zFront + (doorT + 0.012) / 2 - 0.012));
for (const dz of [0.008, 0.028]) cab.add(cyl("HingeBolt", 0.0045, 0.0045, 0.001, hingeM, W / 2 - 0.02, (fzBot + frTop) / 2 + 0.0022, zFront + dz, 10));
const hcW = 0.15, hcH = 0.024, hcD = 0.06, hcX = W / 2 - 0.004 - hcW / 2, hcY = H + 0.001 - hcH / 2, hcZ = zFront - 0.002 - hcD / 2;
cab.add(box("HingeCoverTop", hcW, hcH, hcD, coverM, hcX, hcY, hcZ));
cab.add(plane("PrintTopCover", 0.05, 0.022, printTop, hcX - hcW / 2 + 0.035, hcY, hcZ + hcD / 2 + 0.0006));
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
// on the back wall (LG's open-door photo DZ-6): the cold-air grille under the ceiling (two grey blocks either side of a
// slotted white middle), the word Convertible, and a dark slot under the shelf on the right; a slotted return strip
// across the front of the floor. No dial: this model's controls are on the fridge's plate.
const gy = 1.563, gz = zIn1 + 0.016;
cab.add(boxes("FreezerGrille", [[0.098, 0.04, 0.008, -0.079, gy, gz], [0.093, 0.04, 0.008, 0.0765, gy, gz]], linerDk));
cab.add(box("FreezerGrilleMid", 0.06, 0.04, 0.008, white, 0, gy, gz));
cab.add(boxes("FreezerGrilleSlot", [0, 1, 2].map((i) => [0.044, 0.003, 0.002, 0, gy - 0.01 + i * 0.01, gz + 0.0045]), plinth));
cab.add(box("FreezerSlot", 0.06, 0.01, 0.004, plinth, 0.092, 1.376, zIn1 + 0.014));
cab.add(plane("PrintConvertible", 0.1, 0.024, printConv, 0, 1.468, zIn1 + 0.0125));
cab.add(box("FreezerFloorVent", 0.288, 0.003, 0.025, white, 0.001, fy0 + 0.0015, zFront - 0.04));
cab.add(boxes("FreezerFloorSlot", [...Array(12)].map((_, i) => [0.016, 0.001, 0.012, -0.132 + i * 0.024, fy0 + 0.0033, zFront - 0.04]), plinth));
// the freezer shelf across the cavity: clear GPPS (LG's spec), white rims
{
  const g = group("FreezerShelf", 0, fzShelfY, 0), bd = fzShelfFront - 0.005 - zIn1 - 0.02;
  g.add(box("FzShelfBin", inW - 0.012, 0.005, bd, clear, 0, 0, zIn1 + bd / 2 + 0.02));
  g.add(box("FzShelfRimF", inW - 0.008, 0.012, 0.01, glassRim, 0, 0.004, fzShelfFront - 0.005));
  g.add(box("FzShelfRimB", inW - 0.008, 0.01, 0.008, glassRim, 0, 0.003, zIn1 + 0.03));
  g.add(box("FzShelfRailL", 0.008, 0.012, bd, glassRim, xL + 0.01, 0.003, zIn1 + bd / 2 + 0.02));
  g.add(box("FzShelfRailR", 0.008, 0.012, bd, glassRim, xR - 0.01, 0.003, zIn1 + bd / 2 + 0.02));
  cab.add(g);
}
// LG's Moving Icemaker hangs under the shelf on the left (DZ-3, DZ-6: 180 mm wide, its middle 107 mm left of centre, the
// white tray unit under the shelf, the clear bucket down to about 1.265 m); its front stays 95 mm behind the door's face so
// the lower door basket clears it
const icX = -0.107, icW = 0.17, icZ = zFront - 0.095, icDY = 0.085;
cab.add(box("IceHousingTop", icW + 0.01, 0.006, 0.2, white, icX, 1.4, icZ - 0.1));
cab.add(box("IceHousingSideL", 0.005, 0.13, 0.2, white, icX - icW / 2 - 0.0025, 1.247 + icDY, icZ - 0.1));
cab.add(box("IceHousingSideR", 0.005, 0.13, 0.2, white, icX + icW / 2 + 0.0025, 1.247 + icDY, icZ - 0.1));

// ── fridge inside ──
const trays = group("FridgeTrays");
cab.add(trays);
cab.add(box("FridgeLed", 0.11, 0.006, 0.016, lightM, 0, gy1 - 0.006, zFront - 0.16));
// the air duct's cover on the back wall under the ceiling (DZ-6): two dark outlets and two grey shelf stops
cab.add(box("DuctCover", inW - 0.02, gy1 - 0.001 - 0.985, 0.008, liner, 0, (0.985 + gy1 - 0.001) / 2, zIn1 + 0.0165));
cab.add(boxes("DuctSlot", [[0.015, 0.003, 0.002, -0.03, 1.058, zIn1 + 0.021], [0.015, 0.003, 0.002, 0.02, 1.058, zIn1 + 0.021]], plinth));
cab.add(boxes("DuctStop", [[0.048, 0.038, 0.004, -0.136, 1.058, zIn1 + 0.023], [0.048, 0.038, 0.004, 0.136, 1.058, zIn1 + 0.023]], linerDk));
// the touch control plate (DZ-5, DZ-6: 170 x 80 mm, brushed, printed from the manual's drawing) with its raised ring
{
  const py = 0.876, pz = zIn1 + 0.012;
  cab.add(mesh("ControlPlate", flipV(new THREE.BoxGeometry(0.17, 0.08, 0.004)), [linerDk, linerDk, linerDk, linerDk, plateM, linerDk], 0, py, pz + 0.002));
  const ring = mesh("ControlRingTorus", new THREE.TorusGeometry(0.028, 0.0012, 6, 48), ringM, 0.002, py, pz + 0.004);
  cab.add(ring);
}
// the Pull-out Tray (LG's name, printed on its front): a clear tray under the fridge's ceiling
const tt = { bw: inW - 0.012, bd: 0.38, bh: 0.06 };
tt.zc = zIn1 + 0.026 + tt.bd / 2;
{
  const { bw, bd, bh, zc } = tt, g = group("PullOutTray", 0, topY, 0);
  g.add(box("PtFloor", bw, 0.004, bd, clear, 0, 0, zc));
  g.add(box("PtBack", bw, bh, 0.004, clearLight, 0, bh / 2, zc - bd / 2));
  g.add(box("PtSideL", 0.004, bh, bd, clear, -bw / 2, bh / 2, zc));
  g.add(box("PtSideR", 0.004, bh, bd, clear, bw / 2, bh / 2, zc));
  g.add(box("PtFront", bw, bh, 0.004, clearLight, 0, bh / 2, zc + bd / 2));
  g.add(box("PtRim", bw, 0.008, 0.01, clearRib, 0, bh - 0.003, zc + bd / 2 - 0.004));
  g.add(plane("PrintPullOut", 0.092, 0.018, printPull, 0, 0.012, zc + bd / 2 + 0.0026));
  trays.add(g);
}
stock.fresh0(trays, { y: topY + 0.002, z: tt.zc + 0.02, bx: -0.17 });
// two tempered-glass shelves with white rims
function shelf(name, y) {
  const g = group(name, 0, y, 0), bd = shelfFront - 0.0085 - zIn1 - 0.024;
  g.add(box(name + "Glass", inW - 0.01, 0.006, bd, glass, 0, 0, zIn1 + bd / 2 + 0.024));
  g.add(box(name + "Rim", inW - 0.01, 0.014, 0.012, glassRim, 0, 0.004, shelfFront - 0.0085));
  g.add(box(name + "Edge", inW - 0.01, 0.004, 0.003, edgeGreen, 0, -0.002, shelfFront - 0.0015));
  g.add(box(name + "RimBack", inW - 0.01, 0.01, 0.01, glassRim, 0, 0.002, zIn1 + 0.03));
  g.add(box(name + "RailL", 0.01, 0.014, bd, glassRim, xL + 0.012, 0, zIn1 + bd / 2 + 0.024));
  g.add(box(name + "RailR", 0.01, 0.014, bd, glassRim, xR - 0.012, 0, zIn1 + bd / 2 + 0.024));
  trays.add(g);
}
shelf("Shelf1", s1);
shelf("Shelf2", s2);
// Fresh Zone: a glass cover over the drawer (food stands on it, as in LG's stocked photo), and the drawer, clear all
// round, its front printed Fresh Zone / Fruit & Vegetables
const fzD = drawerFront - zIn1 - 0.016, fzW = inW - 0.02, fzC = zIn1 + fzD / 2 + 0.016, fzH = 0.237;
{
  const g = group("FreshZoneCover", 0, 0, 0);
  g.add(box("FzGlassCover", inW - 0.01, 0.006, fzD, glass, 0, coverY, fzC));
  g.add(box("FzCoverRim", inW - 0.01, 0.012, 0.012, glassRim, 0, coverY + 0.003, drawerFront - 0.006));
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
  g.add(plane("PrintFreshZone", 0.08, 0.032, printFresh, 0.004, 0.2315, zc + bd / 2 + 0.0026));
  trays.add(g);
}

// ── stock: vegetarian South Indian food, eggs, juices, water and soft drinks (stock_lg.mjs, food.mjs) ──
// stock_lg.mjs fills three shelves; this fridge has two, and LG's stocked photo has food standing on the drawer's glass
// cover, so the cover is the third
stock.shelves(trays, {
  zIn1, inW, inD, s1, s2, s3: coverY, fz: drawerY + 0.002, fit: true, vk: 0.65,
  shelfB: { hw: inW / 2 - 0.03, z0: zIn1 + 0.036, z1: shelfFront - 0.015 },
  drawerB: { hw: fzW / 2 - 0.014, z0: zIn1 + 0.04, z1: drawerFront - 0.006, y0: drawerY + 0.002 },
  drawerCeil: coverY - 0.003 - 0.01 - (drawerY + 0.002), // the heap stays 1 cm under the drawer's glass cover
});
const shw = inW / 2 - 0.03;
for (const n of ["Shelf1Stock", "Shelf2Stock", "Shelf3Stock"]) leaveOut(trays.getObjectByName(n), [B3(-1, 0, shelfFront - 0.016, 1, 2, 1), B3(-1, 0, -1, -shw - 0.003, 2, 1), B3(shw + 0.003, 0, -1, 1, 2, 1)], `past ${n}'s side or front`);
// the top shelf's food stays 1 cm under the Pull-out Tray
leaveOut(trays.getObjectByName("Shelf1Stock"), [B3(-1, topY - 0.01, -1, 1, 2, 1)], "under the Pull-out Tray");
trays.getObjectByName("Cauliflower")?.traverse((m) => {
  if (!m.isMesh) return;
  m.updateMatrix(); m.geometry = m.geometry.clone().applyMatrix4(m.matrix);
  m.position.set(0, 0, 0); m.rotation.set(0, 0, 0); m.scale.set(1, 1, 1);
});
// the freezer floor: the ice maker hangs on the left, so the floor's food stays behind it (z1), and anything taller than
// the room under the shelf is left out
stock.freezer(cab, { fit: true, zIn1, floor: fy0, top: fzShelfY + 0.0025, box: { hw: inW / 2 - 0.015, z0: zIn1 + 0.038, z1: icZ - 0.21 } });
leaveOut(cab.getObjectByName("FreezerStock"), [B3(-1, fzShelfY - 0.016, -1, 1, 2, 1)], "under the freezer shelf");
{
  const t = cab.getObjectByName("OnFreezerShelf");
  t.position.z -= 0.04;
  leaveOut(t, [B3(-1, fzShelfY - 0.01, fzShelfFront - 0.012, 1, fy1, 1), B3(-1, gy - 0.03, zIn1, 1, fy1, zIn1 + 0.03)], "past the freezer shelf's front");
}

// ── ice maker: the tray unit and the bucket slide out together (a real part) ──
const ic = group("IceMaker", icX, 0, icZ);
{
  ic.add(mesh("IceFace", new THREE.BoxGeometry(icW, 0.062, 0.03), white, 0, 1.279, -0.015));
  ic.add(box("IceFaceSlot", 0.08, 0.008, 0.004, plinth, 0, 1.304, 0.001));
  ic.add(box("IceFaceGrip", 0.08, 0.012, 0.01, white, 0, 1.268, 0.004));
  ic.add(box("IceTrayBody", icW - 0.012, 0.045, 0.17, white, 0, 1.29, -0.115));
  ic.add(box("IceBucketFloor", icW - 0.01, 0.004, 0.17, clear, 0, 1.18, -0.115));
  ic.add(box("IceBucketFront", icW - 0.01, 0.065, 0.004, clear, 0, 1.2125, -0.032));
  ic.add(box("IceBucketL", 0.004, 0.065, 0.17, clear, -(icW - 0.01) / 2, 1.2125, -0.115));
  ic.add(box("IceBucketR", 0.004, 0.065, 0.17, clear, (icW - 0.01) / 2, 1.2125, -0.115));
  ic.add(box("IceBucketHandle", 0.07, 0.008, 0.01, clearRib, 0, 1.24, -0.028));
  const cubes = [];
  for (let i = 0; i < 16; i++) {
    const c = new THREE.BoxGeometry(0.03, 0.025, 0.03);
    c.applyMatrix4(new THREE.Matrix4().compose(new THREE.Vector3(-0.055 + (i % 4) * 0.037 + (Math.floor(i / 4) % 2) * 0.012, 1.196 + Math.floor(i / 8) * 0.022, -0.06 - Math.floor((i % 8) / 4) * 0.055 - (i % 3) * 0.012),
      new THREE.Quaternion().setFromEuler(new THREE.Euler(0.2 * (i % 3), 0.5 * i, 0.15 * (i % 4))), new THREE.Vector3(1, 1, 1)));
    cubes.push(c);
  }
  ic.add(mesh("IceCube", mergeGeometries(cubes), ice));
}
cab.add(ic);
ic.position.y = icDY;

// ── doors: hinged on the right, no handles, a recessed pocket at the top of the fridge door ──
const pw = W - 0.004;
const inside = (w) => (dep) => [-pw / 2 - w / 2 + 0.004, -pw / 2 + w / 2 - 0.004, -(0.01 + dep / 2)];
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
  // the LG mark, measured on LG's front photo: 54 x 25 mm, its middle 492 mm from the left and 48 mm down
  g.add(plane("LgMarkDecal", 0.054, 0.0248, logoM, -pw + 0.492, h - 0.0476, doorT + 0.0006));
  gaskets(g, "Fz", h);
  // basket floors on LG's open-door photo DZ-6 (the bottom of each basket's end at the hinge): 1.450 and 1.282 m
  const b1 = 1.450 - fzBot, b2 = 1.282 - fzBot;
  const k1 = basket("FzBasket1", pw - 0.1, 0.07, 0.062, b1, true); k1.position.x = -pw / 2; g.add(k1);
  const k2 = basket("FzBasket2", pw - 0.1, 0.07, 0.062, b2, true); k2.position.x = -pw / 2; g.add(k2);
  stock.doorFreezer(g, { fit: true, b1, b2, dep: 0.07, inside: inside(pw - 0.1) });
});
const fridgeDoor = doorShell("FridgeDoor", frLow, (g) => {
  const h = frTop - frLow, y = (v) => v - frLow;
  g.add(mesh("FrPanelLow", flipV(new THREE.BoxGeometry(pw, y(lipBot), doorT)), [steelEdge, steelEdge, steelEdge, steelEdge, steelDoorR, liner], -pw / 2, y(lipBot) / 2, doorT / 2));
  g.add(mesh("FrLip", new THREE.BoxGeometry(pw, bandBot - lipBot, doorT), [steelEdge, steelEdge, steelEdge, steelEdge, silverLip, liner], -pw / 2, (y(lipBot) + y(bandBot)) / 2, doorT / 2));
  g.add(box("GripPocket", pw, frTop - bandBot, doorT - 0.016, pocket, -pw / 2, (y(bandBot) + h) / 2, (doorT - 0.016) / 2));
  for (const sx of [-1, 1]) g.add(box("GripEnd", 0.012, frTop - bandBot - 0.0016, doorT - 0.001, silverLip, -pw / 2 + sx * (pw / 2 - 0.006), (y(bandBot) + h) / 2, doorT / 2));
  gaskets(g, "Fr", h);
  // four baskets (LG's spec), floors on LG's open-door photo DZ-6 at 0.949, 0.723, 0.452 and 0.121 m. LG moves them for its
  // stocked photo; here eggs sit at the top, cans in the second, jars in the third and the tall bottles at the foot,
  // where there is room for them
  const eggY = y(0.949), canY = y(0.723), jarY = y(0.452), botY = y(0.121);
  const add = (n, dep, hh, yy) => { const k = basket(n, pw - 0.12, dep, hh, yy, true); k.position.x = -pw / 2; g.add(k); };
  add("EggBasket", 0.075, 0.06, eggY); add("CanBasket", 0.08, 0.1, canY); add("JarBasket", 0.085, 0.06, jarY); add("BottleBasket", 0.095, 0.077, botY);
  g.add(box("EggCupsRib", pw - 0.14, 0.006, 0.05, clearRib, -pw / 2, eggY + 0.006, -0.047));
  const deps = { egg: 0.075, jar: 0.085, bottle: 0.095, can: 0.08 };
  stock.doorFridge(g, { fit: true, eggY, jarY, botY, canY, deps, inside: inside(pw - 0.12) });
  // the bottle row needs 6 mm more than the basket's width: one carton stays out and the rest are spaced again
  g.children.find((c) => c.name === "RealMixedFruit")?.removeFromParent();
  const [x0, x1] = inside(pw - 0.12)(deps.bottle);
  rowAt(g, ["Coke", "Fanta", "Bisleri", "RealMango", "AmulTaaza"].map((n) => g.children.find((c) => c.name === n)), x0, x1, -(0.01 + deps.bottle / 2));
});
root.add(freezerDoor, fridgeDoor);

const parts = productParts(PRODUCTS, ID);
const clips = stateClips(root, parts);
saveZones(PRODUCTS, ID, root, parts);
const textures = {
  DoorFreezer: `${T}/door_freezer.jpg`, DoorFridge: `${T}/door_fridge.jpg`, SideSteel: `${T}/side.jpg`, SideSteelL: `${T}/side_l.jpg`, RearPlate: `${T}/rear.jpg`,
  LgMark: `${T}/lgmark.png`, ControlPlate: `${T}/plate_control.jpg`, print_convertible: `${T}/print_convertible.png`, print_pullout: `${T}/print_pullout.png`,
  print_freshzone: `${T}/print_freshzone.png`, print_topcover: `${T}/print_topcover.png`,
};
Object.assign(textures, stock.textures());
{ const used = new Set(); root.traverse((o) => o.isMesh && [].concat(o.material).forEach((m) => used.add(m.name))); for (const k of Object.keys(textures)) if (!used.has(k)) delete textures[k]; }
// Grain (BENCHMARK.md section 10), as the LG 251 L and 343 L: Shiny Steel is a printed steel look with fine vertical
// hairlines under a clear glossy film (PET door, LG's spec); the sides are smooth factory paint with a soft peel.
await exportGLB(root, clips, OUT, textures, { dir: `${TEX}/grain`, materials: {
  DoorFreezer: { type: "hairline", dir: "v", clearcoat: [0.6, 0.12] },
  DoorFridge: { type: "hairline", dir: "v", clearcoat: [0.6, 0.12] },
  SideSteel: { type: "peel_soft" }, SideSteelL: { type: "peel_soft" }, TopSteel: { type: "peel_soft" },
} });
