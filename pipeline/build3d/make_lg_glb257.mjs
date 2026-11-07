// LG GL-B257JDS3, 650 L side-by-side refrigerator, Dazzle Steel.
// Built to LG's published size, 913 W x 1790 H x 735 D mm (LG's page, the owner's manual's table and the Sangeetha listing),
// from LG's gallery photos of this model (straight front with its energy label, three-quarter views, both sides, open, stocked
// and rear): the freezer on the left (234 L) and the fridge on the right (416 L), each behind one full-height door in dark
// Dazzle Steel film with a horizontal pocket across both doors; no display or dispenser outside. Inside, as LG's open photo
// shows: four glass shelves and a glass cover over the Freezing Zone drawer in the freezer, with the "Ice Tray with Box" on
// the third shelf; three glass shelves, a glass cover over the upper Fresh Zone drawer and a grid cover over the lower one in
// the fridge; four clear baskets on each door. The fridge's shelves and drawers lift out (FridgeTrays) and the freezer drawer
// slides out (FreezerDrawer). Stocked for a south Indian kitchen.
// usage: node make_lg_glb257.mjs <products.json> <tex dir> <out.glb>
import fs from "node:fs";
import { THREE, mat, mesh, box, faced, group, flipV, stateClips, exportGLB, productParts, saveZones } from "./lib.mjs";
import { Food } from "./food.mjs";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";

const [PRODUCTS, TEX, OUT] = process.argv.slice(2);
const ID = "lg-gl-b257jds3";
const T = `${TEX}/lg_glb257`;

// ── size (metres): LG's 913 x 1790 x 735 mm; the rest measured on LG's photos (NOTES.md) ──
const W = 0.913, H = 1.790, D = 0.735;
const zBack = -D / 2;              // the back corner brackets: the 735 mm runs from them to the door fronts
const zBody = zBack + 0.009;       // the back panel; the brackets stand 9 mm proud of it (side photo)
const zCab = zBack + 0.620;        // cabinet front: the manual's D, 620 mm from the back
const zDoor = zCab + 0.017;        // door back face, behind a 17 mm gasket (side photo)
const zPiv = zDoor + 0.027;        // hinge axis: gives the manual's 1180 mm depth with the doors at 90 degrees
const zF = D / 2 - zPiv, zB = zDoor - zPiv; // a door's front and back in its own frame
const xOut = W / 2, xIn = 0.414;   // outer side; inner wall faces (open photo, 42.5 mm walls)
const mul0 = -0.101, mul1 = -0.041; // the mullion between freezer and fridge (open photo)
const yBot = 0.023, yTop = 1.749, yCeil = 1.712, yFloor = 0.098;
const zIn1 = zBody + 0.065;        // the inner back wall (ESTIMATED)
const yD0 = 0.022, yD1 = H, doorH = yD1 - yD0;
const band0 = 0.793, lip1 = 0.807, band1 = 0.847, pocketD = 0.035; // the pocket across both doors (front photo)
const FZ = { x0: -xIn, x1: mul0 }, FR = { x0: mul1, x1: xIn };
for (const c of [FZ, FR]) { c.cx = (c.x0 + c.x1) / 2; c.hw = (c.x1 - c.x0) / 2; }
// shelf heights, measured on LG's open photo (front plane 0.627 px/mm): the same four levels in both compartments
const sh1 = 1.407, sh2 = 1.150, sh3 = 0.909, sh4 = 0.659;
const fzCover = 0.410;             // the glass over the Freezing Zone drawer
// With the doors shut their baskets reach 0.1445 (freezer) and 0.1345 (fridge): shelves and drawers stop 1 cm short
const fzFront = 0.1325, frFront = 0.1225;

// ── materials ──
// PET film doors: rougher than the LG 343 L recipe (0.5) and a thinner clear coat, tuned on renders against LG's three-quarter
// photos (at 0.45 with a 0.6 coat the doors read 1.3 to 1.5 times too bright there; the straight front is the same either way)
const doorFzM = mat("DoorFreezer", 0x7a7a7d, { metal: 0.38, rough: 0.62 });
const doorFrM = mat("DoorFridge", 0x7a7a7d, { metal: 0.38, rough: 0.62 });
const doorEdge = mat("DoorEdge", 0x6e7074, { metal: 0.4, rough: 0.5 });
// the pocket's inside is dark grey, not black: LG's photos read it at 0.57 of the door front head-on and 0.25 to 0.5 at 3/4
const pocketM = mat("PocketGrey", 0x3a3b3f, { metal: 0.45, rough: 0.5 });
const lipM = mat("PocketLip", 0x38393d, { metal: 0.45, rough: 0.4 });
const doorBack = mat("DoorLiner", 0xeef0f2, { rough: 0.55 });
// painted sides: mid grey, set on renders against LG's side photos (0xa9abae read 1.18 times too light)
const sideSteel = mat("SideSteel", 0x909194, { metal: 0.38, rough: 0.5 });
const topSteel = mat("TopSteel", 0x7e8083, { metal: 0.15, rough: 0.7 });
const frameM = mat("CabFrame", 0x6f7175, { metal: 0.2, rough: 0.6 });
const coverM = mat("TopCover", 0x9a9ca0, { metal: 0.1, rough: 0.6 });
const darkM = mat("HingeDark", 0x34363a, { rough: 0.6 });
const pinM = mat("Pin", 0xc4c7cb, { metal: 0.9, rough: 0.3 });
const labelM = mat("LabelBEE", 0xffffff, { rough: 0.5, opacity: 0.999 });
const logoM = mat("LgMark", 0xffffff, { rough: 0.5, opacity: 0.999 });
const rearM = mat("RearPlate", 0xffffff, { metal: 0.05, rough: 0.6 });
const liner = mat("Liner", 0xf1f3f5, { rough: 0.6 });
const linerSide = mat("LinerSide", 0xe4e8ec, { rough: 0.65 });
const linerGrey = mat("LinerGrey", 0xd3d7dc, { rough: 0.6 });
const gasket = mat("Gasket", 0x8e9297, { rough: 0.85 });
const ventBlack = mat("VentBlack", 0x1c1d20, { rough: 0.7 });
const ventGrey = mat("VentGrey", 0xb9bec4, { rough: 0.6 });
const clear = mat("ClearPlastic", 0xc3d0da, { rough: 0.12, opacity: 0.5, side: THREE.DoubleSide });
const clearLight = mat("ClearPlasticLight", 0xdfe7ee, { rough: 0.12, opacity: 0.26, side: THREE.DoubleSide });
const clearRib = mat("ClearRib", 0xeef3f7, { rough: 0.3 });
const glass = mat("TemperedGlass", 0xa9cdd6, { rough: 0.05, opacity: 0.55, side: THREE.DoubleSide });
const glassRim = mat("ShelfRim", 0xe3e7ea, { rough: 0.45 });
const edgeGreen = mat("GlassEdge", 0x7fa7b0, { rough: 0.3 });
const white = mat("WhitePlastic", 0xf6f7f8, { rough: 0.45 });
const gridM = mat("GridCover", 0xc9ced4, { rough: 0.5 });
const lightM = mat("Led", 0xffffff, { emissive: 0xf4f8ff, emissiveIntensity: 1.5 });
const footM = mat("Foot", 0x131416, { rough: 0.7 });
const skidM = mat("Skid", 0xb8babd, { metal: 0.5, rough: 0.4 });
const cordM = mat("Cord", 0x1d1e20, { rough: 0.6 });
const plugM = mat("Plug", 0x2a2b2e, { rough: 0.5 });
const printConv = mat("print_convertible", 0xffffff, { rough: 0.6, opacity: 0.999 });
const printMaf = mat("print_multiairflow", 0xffffff, { rough: 0.6, opacity: 0.999 });
const printFresh = mat("print_freshzone", 0xffffff, { rough: 0.6, opacity: 0.999 });
const printFreeze = mat("print_freezingzone", 0xffffff, { rough: 0.6, opacity: 0.999 });

// ── small builders ──
const cyl = (name, rt, rb, h, m, x, y, z, seg = 14) => mesh(name, new THREE.CylinderGeometry(rt, rb, h, seg), m, x, y, z);
const plane = (name, w, h, m, x, y, z) => mesh(name, flipV(new THREE.PlaneGeometry(w, h)), m, x, y, z);
// a box from corner to corner (world or group coordinates)
const span = (name, x0, x1, y0, y1, z0, z1, m) => mesh(name, new THREE.BoxGeometry(x1 - x0, y1 - y0, z1 - z0), m, (x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2);
// several boxes joined into one mesh (one material): ribs, bars, slots
function joined(name, boxes, m) {
  const geos = boxes.map(([x0, x1, y0, y1, z0, z1]) => new THREE.BoxGeometry(x1 - x0, y1 - y0, z1 - z0).translate((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2));
  return mesh(name, mergeGeometries(geos), m);
}

const root = group("LGGLB257");
const cab = group("Cabinet");
root.add(cab);

// ── cabinet shell ──
const sideMats = (outer) => (outer > 0 ? [sideSteel, linerSide, topSteel, footM, linerSide, frameM] : [linerSide, sideSteel, topSteel, footM, linerSide, frameM]);
cab.add(span("SideLeft", -xOut, -xIn, yBot, yTop, zBody, zCab, sideMats(-1)));
cab.add(span("SideRight", xIn, xOut, yBot, yTop, zBody, zCab, sideMats(1)));
// the painted side wraps round the cabinet's front edge (seen past the door's edge from the side)
for (const s of [-1, 1]) cab.add(span("SideWrap", s > 0 ? xOut - 0.015 : -xOut + 0.0005, s > 0 ? xOut - 0.0005 : -xOut + 0.015, yBot + 0.003, yTop - 0.003, zCab + 0.0002, zCab + 0.0012, sideSteel));
cab.add(span("Top", -xIn, xIn, 1.728, yTop, zBody, zCab, [topSteel, topSteel, topSteel, liner, frameM, frameM]));
cab.add(span("TopLiner", -xIn, xIn, yCeil, 1.728, zIn1, zCab - 0.002, liner));
cab.add(span("Base", -xIn, xIn, yBot, yFloor, zBody, zCab, [liner, liner, liner, footM, liner, frameM]));
cab.add(span("BackWall", -xIn, xIn, yFloor, yCeil, zBody, zIn1, [liner, liner, liner, liner, liner, frameM]));
cab.add(span("DividerMullion", mul0, mul1, yFloor, yCeil, zIn1, zCab, liner));
// LG's front photo shows the 4 mm seam between the doors black: the 115 mm deep slot is in shadow, which the viewers don't
// compute, so the strip of mullion behind the seam is painted dark (6 mm wide; open, it is a thin line on the white mullion)
cab.add(span("DividerSeamShade", -0.0655, -0.0595, yBot + 0.01, yTop - 0.01, zCab, zCab + 0.001, mat("SeamShade", 0x2a2c30, { rough: 0.85 })));
// embossed bars low at the back of each side, 1 mm proud (both side photos)
for (const s of [-1, 1]) {
  const bars = [0.145, 0.196, 0.245, 0.294].map((y) => [s > 0 ? xOut : -xOut - 0.001, s > 0 ? xOut + 0.001 : -xOut, y - 0.0075, y + 0.0075, zBack + 0.107, zBack + 0.282]);
  cab.add(joined(s > 0 ? "SideBarsR" : "SideBarsL", bars, sideSteel));
}
// the back: LG's rear photo on a thin plate (the compressor bay and its vents are in the photo), dark brackets at the top corners
cab.add(mesh("RearPlate", flipV(new THREE.BoxGeometry(W - 0.002, yTop - 0.026, 0.003)), [frameM, frameM, frameM, frameM, frameM, rearM], 0, (yTop + 0.026) / 2, zBody - 0.0015));
for (const s of [-1, 1]) cab.add(span("RearBracket", s > 0 ? xOut - 0.025 : -xOut, s > 0 ? xOut : -xOut + 0.025, yTop - 0.035, yTop, zBack, zBody - 0.003, darkM));
// the top cover over the controls (side and rear photos): 517 mm wide, 32 mm tall, 175 mm deep from the cabinet front
cab.add(span("TopCover", -0.183, 0.334, yTop, 1.776, zCab - 0.175, zCab, coverM));
cab.add(span("TopCoverPanel", -0.173, 0.324, 1.776, 1.781, zCab - 0.165, zCab - 0.01, coverM));
// hinges: dark covers at the top outer corners with a round pin cap; brackets under the doors with the levelling feet
for (const s of [-1, 1]) {
  cab.add(span("HingeTop", s > 0 ? xOut - 0.075 : -xOut, s > 0 ? xOut : -xOut + 0.075, yTop, 1.781, zCab - 0.07, zDoor - 0.001, darkM));
  cab.add(cyl("HingePin", 0.009, 0.009, 0.003, pinM, s * (xOut - 0.03), 1.7825, zCab - 0.03, 18));
  cab.add(span("HingeLow", s > 0 ? xOut - 0.07 : -xOut, s > 0 ? xOut : -xOut + 0.07, 0.014, 0.021, zCab - 0.02, zPiv + 0.03, darkM));
  cab.add(cyl("FootFront", 0.017, 0.018, 0.014, footM, s * (xOut - 0.04), 0.007, zBack + 0.658, 16));
  // at the back: a silver skid over a roller each side (side photos)
  cab.add(span("RollerSkid", s > 0 ? xOut - 0.05 : -xOut + 0.01, s > 0 ? xOut - 0.01 : -xOut + 0.05, 0.012, yBot, zBody, zBody + 0.15, skidM));
  cab.add(cyl("Roller", 0.0115, 0.0115, 0.016, footM, s * (xOut - 0.03), 0.0115, zBody + 0.08, 14).rotateZ(Math.PI / 2));
}
// power cord: LG's rear photo shows it leaving the top cover and running back over the top, not down the back; the
// manual has the plug hooked "at the rear or on top of the appliance", so here it lies on the top (route ESTIMATED)
{
  const px = 0.0, pz = -0.24;
  const pts = [[0.13, 1.768, zCab - 0.176], [0.128, 1.758, zCab - 0.2], [0.12, yTop + 0.004, zCab - 0.26], [0.09, yTop + 0.004, -0.12], [0.03, yTop + 0.005, -0.18], [px, yTop + 0.008, pz + 0.024]].map(([x, y, z]) => new THREE.Vector3(x, y, z));
  cab.add(mesh("PowerCord", new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts, false, "centripetal"), 60, 0.004, 6, false), cordM));
  // the three-pin plug (the LG 343 L's: 45 x 42 x 16 mm, pins 5.2 mm) lying on its back, pins up: standing on an edge
  // it would rise above the doors
  const sh = new THREE.Shape(), w = 0.045, h = 0.042, r = 0.012;
  sh.moveTo(-w / 2 + r, -h / 2); sh.lineTo(w / 2 - r, -h / 2); sh.quadraticCurveTo(w / 2, -h / 2, w / 2, -h / 2 + r);
  sh.lineTo(w / 2, h / 2 - r); sh.quadraticCurveTo(w / 2, h / 2, w / 2 - r, h / 2); sh.lineTo(-w / 2 + r, h / 2);
  sh.quadraticCurveTo(-w / 2, h / 2, -w / 2, h / 2 - r); sh.lineTo(-w / 2, -h / 2 + r); sh.quadraticCurveTo(-w / 2, -h / 2, -w / 2 + r, -h / 2);
  const plugG = new THREE.ExtrudeGeometry(sh, { depth: 0.016, bevelEnabled: true, bevelSize: 0.002, bevelThickness: 0.002, bevelSegments: 2, curveSegments: 8 }).rotateX(-Math.PI / 2);
  cab.add(mesh("Plug", plugG, plugM, px, yTop + 0.0021, pz));
  for (const [dx, dy] of [[0, 0.0105], [-0.0095, -0.0065], [0.0095, -0.0065]]) cab.add(cyl("PlugPin", 0.0026, 0.0026, 0.016, pinM, px + dx, yTop + 0.0021 + 0.018 + 0.008, pz - dy, 10));
}

// ── inside, fixed: lights, vents, ribs and LG's printed words on the back walls ──
const zWall = zIn1 + 0.0007;
// Top LED (LG's spec) on each ceiling, and the freezer's lamp housing at the top of its back wall
cab.add(span("FreezerLed", FZ.cx - 0.1, FZ.cx + 0.1, yCeil - 0.005, yCeil, zIn1 + 0.07, zIn1 + 0.085, lightM));
cab.add(span("FreezerLampBox", FZ.cx - 0.105, FZ.cx + 0.105, 1.64, yCeil, zIn1, zIn1 + 0.05, linerGrey));
cab.add(span("FridgeLed", FR.cx - 0.1, FR.cx + 0.1, yCeil - 0.005, yCeil, zIn1 + 0.07, zIn1 + 0.085, lightM));
// the words, set again in PT Sans at the size the open photo shows (NOTES.md)
cab.add(plane("PrintConvertible", 0.1655, 0.0368, printConv, FZ.cx, 1.56, zWall));
cab.add(plane("PrintMultiAirFlow", 0.1753, 0.0351, printMaf, FR.cx - 0.008, 1.56, zWall));
// cold-air vents under the shelves on the back walls: black slots in the freezer, grey in the fridge (open photo)
cab.add(joined("FreezerVents", [
  [-0.302, -0.285, sh1 - 0.03, sh1 - 0.018, zIn1, zIn1 + 0.004], [-0.224, -0.207, sh1 - 0.03, sh1 - 0.018, zIn1, zIn1 + 0.004],
  [-0.359, -0.276, sh2 - 0.03, sh2 - 0.02, zIn1, zIn1 + 0.004], [-0.224, -0.143, sh2 - 0.03, sh2 - 0.02, zIn1, zIn1 + 0.004],
], ventBlack));
cab.add(joined("FridgeVents", [sh1, sh2].flatMap((y) => [[0.051, 0.102], [0.162, 0.188], [0.257, 0.309]].map(([a, b]) => [a, b, y - 0.028, y - 0.018, zIn1, zIn1 + 0.004])), ventGrey));
// the fridge's back wall between the third shelf and the drawer cover: a raised duct panel with vertical ribs
cab.add(span("BackDuctPanel", 0.068, 0.343, 0.675, 0.89, zIn1, zIn1 + 0.005, liner));
cab.add(joined("BackRibs", [-0.015, 0.042, 0.099, 0.157, 0.206, 0.266, 0.318].map((x) => [x - 0.004, x + 0.004, 0.69, 0.85, zIn1, zIn1 + 0.004]), linerSide));
// shelf ledges moulded in the side walls (what the shelves rest on)
for (const c of [FZ, FR]) for (const y of [sh1, sh2, sh3, sh4]) for (const s of [-1, 1]) {
  const x = s < 0 ? c.x0 : c.x1;
  cab.add(span("SideLedge", s < 0 ? x : x - 0.006, s < 0 ? x + 0.006 : x, y - 0.019, y - 0.007, zIn1 + 0.01, (c === FZ ? fzFront : frFront) - 0.03, linerSide));
}

// ── shelves, drawers and covers ──
// a tempered-glass shelf between x0 and x1, its glass top at y + 0.003, its rim's front at `front`
function shelf(parent, name, x0, x1, y, front) {
  const g = group(name, 0, 0, 0), bd = front - 0.012 - (zIn1 + 0.012);
  g.add(span(name + "Glass", x0 + 0.004, x1 - 0.004, y - 0.003, y + 0.003, zIn1 + 0.012, front - 0.012, glass));
  g.add(span(name + "Rim", x0 + 0.004, x1 - 0.004, y - 0.003, y + 0.011, front - 0.012, front, glassRim));
  g.add(span(name + "Edge", x0 + 0.004, x1 - 0.004, y - 0.005, y - 0.003, front - 0.003, front, edgeGreen));
  g.add(span(name + "RimBack", x0 + 0.004, x1 - 0.004, y - 0.003, y + 0.007, zIn1 + 0.012, zIn1 + 0.022, glassRim));
  g.add(span(name + "RailL", x0 + 0.004, x0 + 0.014, y - 0.007, y + 0.007, zIn1 + 0.012, front - 0.012, glassRim));
  g.add(span(name + "RailR", x1 - 0.014, x1 - 0.004, y - 0.007, y + 0.007, zIn1 + 0.012, front - 0.012, glassRim));
  parent.add(g);
  return bd;
}
// a clear drawer: floor at y0 (its top), walls to y1, between x0 and x1, from the back wall to `front`, with LG's print
function drawer(parent, name, x0, x1, y0, y1, front, printM, pw, ph, py) {
  const g = group(name + "Box", 0, 0, 0), zb = zIn1 + 0.012;
  g.add(span(name + "Floor", x0, x1, y0 - 0.004, y0, zb, front, clear));
  g.add(span(name + "Back", x0, x1, y0, y1, zb, zb + 0.004, clearLight));
  g.add(span(name + "WallL", x0, x0 + 0.004, y0, y1, zb + 0.004, front - 0.004, clear));
  g.add(span(name + "WallR", x1 - 0.004, x1, y0, y1, zb + 0.004, front - 0.004, clear));
  g.add(span(name + "Front", x0, x1, y0, y1, front - 0.004, front, clearLight));
  g.add(span(name + "Rim", x0, x1, y1 - 0.008, y1, front - 0.004, front + 0.004, clearRib));
  g.add(span(name + "FootRim", x0, x1, y0 - 0.004, y0 + 0.008, front - 0.004, front + 0.004, clearRib));
  g.add(plane(name + "Print", pw, ph, printM, (x0 + x1) / 2, py, front + 0.0007));
  parent.add(g);
}

// freezer: four fixed shelves, the glass cover, the Ice Tray with Box, and the drawer (a part)
for (const [i, y] of [sh1, sh2, sh3, sh4].entries()) shelf(cab, `FzShelf${i + 1}`, FZ.x0, FZ.x1, y, fzFront);
{
  const g = group("FzCover", 0, 0, 0);
  g.add(span("FzCoverGlass", FZ.x0 + 0.004, FZ.x1 - 0.004, fzCover - 0.003, fzCover + 0.003, zIn1 + 0.012, fzFront - 0.012, glass));
  g.add(span("FzCoverRim", FZ.x0 + 0.004, FZ.x1 - 0.004, fzCover - 0.003, fzCover + 0.009, fzFront - 0.012, fzFront, glassRim));
  cab.add(g);
}
// the Ice Tray with Box (LG's catalogue): a clear box with a white tray on it, at the left of the third shelf
// (170 mm wide and 80 mm tall on LG's open photo; its depth, 110 mm, is ESTIMATED)
{
  const g = group("IceTrayBox", -0.244, sh3 + 0.003, fzFront - 0.03 - 0.055);
  const w = 0.168, d = 0.11;
  g.add(span("IceBoxFloor", -w / 2, w / 2, 0, 0.003, -d / 2, d / 2, clear));
  g.add(span("IceBoxFront", -w / 2, w / 2, 0, 0.05, d / 2 - 0.003, d / 2, clearLight));
  g.add(span("IceBoxBack", -w / 2, w / 2, 0, 0.05, -d / 2, -d / 2 + 0.003, clear));
  g.add(span("IceBoxL", -w / 2, -w / 2 + 0.003, 0, 0.05, -d / 2 + 0.003, d / 2 - 0.003, clear));
  g.add(span("IceBoxR", w / 2 - 0.003, w / 2, 0, 0.05, -d / 2 + 0.003, d / 2 - 0.003, clear));
  g.add(span("IceTray", -w / 2 + 0.004, w / 2 - 0.004, 0.05, 0.08, -d / 2 + 0.004, d / 2 - 0.004, white));
  g.add(joined("IceTrayCups", [-0.05, 0, 0.05].flatMap((x) => [-0.025, 0.025].map((z) => [x - 0.02, x + 0.02, 0.08, 0.082, z - 0.018, z + 0.018])), clearRib));
  cab.add(g);
}
const fzDrawer = group("FreezerDrawer");
cab.add(fzDrawer);
const fzDr = { x0: FZ.x0 + 0.006, x1: FZ.x1 - 0.006, y0: 0.110, y1: 0.395, front: fzFront };
drawer(fzDrawer, "FzDrawer", fzDr.x0, fzDr.x1, fzDr.y0, fzDr.y1, fzDr.front, printFreeze, 0.1508, 0.0503, 0.276);

// fridge: everything that lifts out (LG: 3 shelves, 2 vegetable boxes) is one part with its food
const trays = group("FridgeTrays");
cab.add(trays);
for (const [i, y] of [sh1, sh2, sh3].entries()) shelf(trays, `FrShelf${i + 1}`, FR.x0, FR.x1, y, frFront);
{
  const g = group("FrCover", 0, 0, 0);
  g.add(span("FrCoverGlass", FR.x0 + 0.004, FR.x1 - 0.004, sh4 - 0.003, sh4 + 0.003, zIn1 + 0.012, frFront - 0.012, glass));
  g.add(span("FrCoverRim", FR.x0 + 0.004, FR.x1 - 0.004, sh4 - 0.003, sh4 + 0.009, frFront - 0.012, frFront, glassRim));
  trays.add(g);
}
const frDr1 = { x0: FR.x0 + 0.006, x1: FR.x1 - 0.006, y0: 0.417, y1: 0.626, front: frFront };
const frDr2 = { x0: FR.x0 + 0.006, x1: FR.x1 - 0.006, y0: 0.112, y1: 0.364, front: frFront };
drawer(trays, "FrDrawerUp", frDr1.x0, frDr1.x1, frDr1.y0, frDr1.y1, frDr1.front, printFresh, 0.1463, 0.0488, 0.536);
drawer(trays, "FrDrawerLow", frDr2.x0, frDr2.x1, frDr2.y0, frDr2.y1, frDr2.front, printFresh, 0.1463, 0.0488, 0.277);
// the grid cover over the lower drawer (open photo: a frame with a fine grid, 0.372 to 0.403)
{
  const x0 = FR.x0 + 0.004, x1 = FR.x1 - 0.004, z0 = zIn1 + 0.012, z1 = frFront;
  trays.add(span("GridCoverFrame", x0, x1, 0.392, 0.403, z1 - 0.016, z1, glassRim));
  trays.add(joined("GridCoverBars", [...Array(13).keys()].map((i) => { const x = x0 + 0.02 + i * (x1 - x0 - 0.04) / 12; return [x - 0.003, x + 0.003, 0.372, 0.4, z0, z1 - 0.016]; }), gridM));
  trays.add(span("GridCoverTop", x0, x1, 0.4, 0.403, z0, z1 - 0.016, clear));
}

// ── stock: vegetarian South Indian food, juices, water and soft drinks (the fitting helpers of stock_lg.mjs) ──
const food = Food({ brandDir: `${TEX}/brands/small` });
const man = {};
{
  const raw = JSON.parse(fs.readFileSync(`${TEX}/brands/manifest.json`, "utf8"));
  const list = Array.isArray(raw) ? raw : raw.items ?? Object.entries(raw).map(([name, v]) => ({ name, ...v }));
  for (const it of list) man[it.name ?? it.file.replace(/\.jpg$/, "")] = it;
}
const labelMats = {};
const brand = (k) => (labelMats["br_" + k] ||= mat("br_" + k, 0xffffff, { rough: 0.5 }));
const sz = (k, d = [100, 100, 30]) => (man[k]?.real_size_mm ?? d).map((v) => v / 1000);
const asp = (k, d = 1) => man[k]?.aspect ?? d;
const tag = food.tag;
const arcFor = (w, r) => 2 * Math.asin(Math.min(0.98, w / (2 * r)));
const wrap = (name, r, h, m, x, y, z, arc = 2.6) => mesh(name, flipV(new THREE.CylinderGeometry(r + 0.0009, r + 0.0009, h, 16, 1, true, -arc / 2, arc)), m, x, y, z);
const K = {
  cup: mat("CurdCup", 0xf4f6f8, { rough: 0.45 }), steel: mat("KitchenSteel", 0xc4c8cc, { metal: 0.95, rough: 0.28 }), steelDark: mat("KitchenSteelDark", 0x8e9296, { metal: 0.9, rough: 0.35 }),
  amber: mat("GlassAmber", 0xc9892b, { rough: 0.12, opacity: 0.88 }), goldLid: mat("GoldLid", 0xd1a43a, { metal: 0.8, rough: 0.3 }), jarGreen: mat("JarGreen", 0xe2b830, { rough: 0.2, opacity: 0.95 }),
  butter: mat("ButterWrap", 0xffd24a, { rough: 0.5 }), cheese: mat("CheeseBlock", 0xf1c765, { rough: 0.5 }),
  iceWhite: mat("IceCreamTub", 0xf1f0ec, { rough: 0.5 }), iceLid: mat("IceCreamLidRim", 0xe8e6e0, { rough: 0.5 }),
  tinNavy: mat("TinNavy", 0x0d1b3e, { metal: 0.55, rough: 0.35 }), tinGold: mat("TinGold", 0xc9a23a, { metal: 0.85, rough: 0.3 }),
};
function cupWithLid(name, key, r, h) {
  const g = group(name);
  g.add(cyl(name + "Body", r, r * 0.9, h, K.cup, 0, h / 2, 0));
  const top = new THREE.CircleGeometry(r * 1.02, 24); flipV(top);
  g.add(mesh(name + "LidPrint", top, brand(key), 0, h + 0.0022, 0).rotateX(-Math.PI / 2));
  g.add(cyl(name + "LidRim", r * 1.04, r * 1.04, 0.003, K.cup, 0, h - 0.0005, 0));
  return tag(g);
}
function brandJar(name, key, r, h, glassM, lidM) {
  const g = group(name), lh = Math.min(h * 0.8, sz(key, [95, 50, 95])[1]);
  g.add(cyl(name + "Glass", r, r, h, glassM, 0, h / 2, 0, 16));
  g.add(cyl(name + "Lid", r, r, 0.016, lidM, 0, h + 0.008, 0, 16));
  g.add(wrap(name + "Label", r, lh, brand(key), 0, h * 0.5, 0, arcFor(asp(key, 1.2) * lh, r)));
  return tag(g);
}
function paperTub(name, key, r, h) {
  const g = group(name), lh = Math.min(h * 0.8, sz(key, [105, 52, 105])[1]);
  g.add(cyl(name + "Body", r, r * 0.9, h, K.cup, 0, h / 2, 0, 18));
  g.add(cyl(name + "Lid", r * 1.04, r * 1.04, 0.012, K.cup, 0, h + 0.004, 0, 18));
  g.add(wrap(name + "Label", r, lh, brand(key), 0, h * 0.5, 0, arcFor(asp(key, 2) * lh, r)));
  return tag(g);
}
function tin(name, key, r, h) {
  const g = group(name);
  g.add(cyl(name + "Body", r, r * 0.97, h, K.tinNavy, 0, h / 2, 0, 24));
  g.add(cyl(name + "Rim", r * 1.02, r * 1.02, 0.008, K.tinGold, 0, h + 0.002, 0, 24));
  const top = new THREE.CircleGeometry(r * 0.98, 32); flipV(top);
  g.add(mesh(name + "LidArt", top, brand(key), 0, h + 0.0062, 0).rotateX(-Math.PI / 2));
  return tag(g);
}
function tiffin(name) {
  const g = group(name);
  for (let i = 0; i < 3; i++) { g.add(cyl("TiffinTier", 0.062, 0.062, 0.036, K.steel, 0, 0.018 + i * 0.036, 0, 16)); g.add(cyl("TiffinRim", 0.064, 0.064, 0.004, K.steelDark, 0, 0.036 + i * 0.036, 0, 16)); }
  g.add(cyl("TiffinKnob", 0.01, 0.01, 0.014, K.steelDark, 0, 0.115, 0, 10));
  g.add(box("TiffinBarL", 0.004, 0.14, 0.004, K.steelDark, -0.067, 0.07, 0)); g.add(box("TiffinBarR", 0.004, 0.112, 0.004, K.steelDark, 0.067, 0.056, 0));
  return tag(g);
}
const brick = (name, key, w, h, d, m) => {
  const g = group(name);
  g.add(box(name + "Body", w, h, d, m, 0, h / 2, 0));
  g.add(plane(name + "Print", w * 0.97, d * 0.97, brand(key), 0, h + 0.0007, 0).rotateX(-Math.PI / 2));
  return tag(g);
};
function iceTub(name, key, w, h, d) {
  const g = group(name);
  g.add(box(name + "Body", w, h, d, K.iceWhite, 0, h / 2, 0));
  g.add(box(name + "Rim", w + 0.006, 0.006, d + 0.006, K.iceLid, 0, h - 0.002, 0));
  g.add(plane(name + "Lid", w * 0.94, d * 0.94, brand(key), 0, h + 0.002, 0).rotateX(-Math.PI / 2));
  return tag(g);
}
const pouch = (name, key, up = false, k = 1) => { const [w, h, d] = sz(key); return food.sachet(name, key + ".jpg", 0, 0, 0, 1, { W: w * k, D: h * k, T: Math.max(0.014, d * 0.62 * k), upright: up }); };
const carton = (name, key, seed = 1) => { const [w, h, d] = sz(key, [64, 190, 40]); return food.carton(name, key + ".jpg", 0, 0, 0, seed, { W: w, H: h, D: d }); };
function petBrand(name, key, r, h, liquid, cap, opacity = 0.93) {
  const lh = key === "bisleri_label" ? 0.05 : 0.08;
  return food.petBottle(name, r, h, liquid, cap, 0, 0, 0, brand(key), lh, opacity, arcFor(asp(key, 1.2) * lh, r), 0.095);
}
const face = (o) => { o.rotation.y = Math.PI; return o; };

// fitting (BENCHMARK.md section 13): every group an item sits in is only moved, never turned
const worldBox = (o) => { o.updateWorldMatrix(true, true); return new THREE.Box3().setFromObject(o); };
const groupY = (o) => (o.parent ? o.parent.getWorldPosition(new THREE.Vector3()).y : 0);
const measure = (o) => { const b = worldBox(o); if (o.parent) { const p = o.parent.getWorldPosition(new THREE.Vector3()); b.min.sub(p); b.max.sub(p); } return b; };
function lineUp(objs, x0, x1, z, { middle = false } = {}) {
  const bs = objs.map(measure);
  const total = bs.reduce((s, b) => s + b.max.x - b.min.x, 0);
  if (total > x1 - x0) console.warn(`lineUp: ${objs.map((o) => o.name).join(", ")} need ${(total * 1000).toFixed(0)} mm, the tray has ${((x1 - x0) * 1000).toFixed(0)}`);
  const gap = Math.max(0, (x1 - x0 - total) / (objs.length + 1));
  let x = x0 + gap;
  objs.forEach((o, i) => {
    const b = bs[i];
    o.position.x += x - b.min.x;
    o.position.z += middle ? z - (b.min.z + b.max.z) / 2 : z - b.min.z;
    x += b.max.x - b.min.x + gap;
  });
  return Math.max(...bs.map((b) => b.max.z - b.min.z));
}
const _ray = new THREE.Raycaster(), DOWN = new THREE.Vector3(0, -1, 0), UP = new THREE.Vector3(0, 1, 0);
const meshesOf = (o) => { const m = []; o.traverse((c) => c.isMesh && m.push(c)); return m; };
const pointsOf = (meshes, n = 1000) => meshes.flatMap((m) => {
  const p = m.geometry.attributes.position, step = Math.max(1, Math.floor(p.count / n)), out = [];
  for (let i = 0; i < p.count; i += step) out.push(new THREE.Vector3().fromBufferAttribute(p, i).applyMatrix4(m.matrixWorld));
  return out;
});
const overXZ = (a, b) => a.max.x > b.min.x && a.min.x < b.max.x && a.max.z > b.min.z && a.min.z < b.max.z;
function dropOnto(o, placed) {
  const floorY = groupY(o), b = worldBox(o), own = meshesOf(o), hits = [];
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
      const m = measure(o), y = (m.min.y + m.max.y) / 2;
      const fits = m.max.y <= ceil;
      if (!best || (fits && !best.fits) || (fits === best.fits && (steady && !best.steady || steady === best.steady && y < best.y - 0.001)))
        best = { x: o.position.x, y, z: o.position.z, py: o.position.y, steady, fits };
    }
    o.position.set(best.x, best.py, best.z);
    if (!best.fits) { left.push(o); o.removeFromParent(); continue; }
    if (!best.steady) tipped.push(o.name);
    const meshes = meshesOf(o);
    o.updateWorldMatrix(true, true);
    placed.push({ box: worldBox(o), meshes, pts: pointsOf(meshes) });
  }
  if (left.length) console.warn(`settle: no room for ${left.map((o) => o.name).join(", ")}`);
  if (tipped.length) console.warn(`settle: no steady spot for ${tipped.join(", ")}`);
}
// a tray stocked in rows from the back, each row spaced by its items' real widths, everything dropped onto the glass
function tray(parent, name, cx, y, B, rows, after) {
  const g = group(name, cx, y, 0);
  parent.add(g);
  let z = B.z0;
  for (const row of rows) { row.forEach((o) => g.add(o)); z += lineUp(row, -B.hw, B.hw, z) + 0.012; }
  if (z - 0.012 > B.z1) console.warn(`${name}: its rows need ${((z - 0.012 - B.z0) * 1000).toFixed(0)} mm of depth, the shelf has ${((B.z1 - B.z0) * 1000).toFixed(0)}`);
  after?.(g);
  settle(g.children.slice());
  return g;
}
// a heap dropped into a drawer: each item tries 30 spots within 8 cm and keeps the lowest steady one under the ceiling
const HEAP = ["Drumstick", "Cabbage", "Cauliflower", "Onion", "Potato", "Brinjal", "Capsicum", "Carrot", "Tomato", "LadiesFinger", "Coriander", "CurryLeaves", "GreenChilli", "FreshoGreenPeas", "ViswasParotta", "NityaParotta", "AmulPaneer"];
function heap(parent, name, cx, dr, items) {
  const g = group(name, cx, dr.y0, 0);
  parent.add(g);
  const B = { hw: (dr.x1 - dr.x0) / 2 - 0.012, z0: zIn1 + 0.03, z1: dr.front - 0.012 };
  items.forEach((o) => g.add(o));
  settle(items.slice().sort((a, b) => HEAP.indexOf(a.name.replace(/\d+$/, "")) - HEAP.indexOf(b.name.replace(/\d+$/, ""))), { tries: 30, spread: 0.08, bounds: B, ceil: dr.ceil - dr.y0 });
  return g;
}
const ring = (n, cx, cz, r, k) => [...Array(n)].map((_, i) => [cx + Math.cos(i * 2.4 + k) * r * Math.sqrt(i / n), cz + Math.sin(i * 2.4 + k) * r * Math.sqrt(i / n)]);
const at = (o, x, z) => { o.position.x = x; o.position.z = z; return o; };

// the fridge (LG's stocked photo: drinks and salad up top, the melon on the second shelf, fruit and vegetables in the drawers)
{
  const B = { hw: FR.hw - 0.02, z0: zIn1 + 0.03, z1: frFront - 0.0125 };
  // the top shelf's stock is "Shelf1Stock" and the upper drawer's "FreshZoneStock": the trays page test finds them by name
  const rnr =carton("RnrBiryaniBox", "rnr_box_front", 0); rnr.rotation.x = -Math.PI / 2;
  const milk = pouch("NandiniMilk", "nandini_toned_milk");
  tray(trays, "Shelf1Stock", FR.cx, sh1 + 0.003, B, [
    [tiffin("Tiffin"), pouch("IdBatterPouch", "id_batter", true, 0.85), carton("MastiButtermilk", "amul_masti_buttermilk", 4)],
    [rnr, milk],
  ], (g) => ["aavin_milk", "amul_taaza_pouch"].forEach((k, i) => g.add(at(pouch(i ? "AmulTaazaPouch" : "AavinMilk", k), milk.position.x, milk.position.z))));
  tray(trays, "FrShelf2Stock", FR.cx, sh2 + 0.003, B, [
    [food.coconutHalf("CoconutHalf", 0, 0, 0, 1), food.melonHalf("WatermelonHalf", 0, 0, 0, 1)],
    [tin("RnrBiryani", "rnr_tin_lid", 0.075, 0.06), paperTub("NandhanaPalace", "nandana_tub_wrap", 0.0525, 0.075), paperTub("NandhanaPalace2", "nandana_tub_wrap", 0.0525, 0.075)],
  ]);
  tray(trays, "FrShelf3Stock", FR.cx, sh3 + 0.003, B, [
    [food.bananaBunch("Bananas", 0, 0, 0, 5, 1), food.grapes("Grapes", 0, 0, 0, 1), food.lemon("Lemon", 0, 0, 0, 1)],
    [...[1, 2].map((i) => food.apple("Apple", 0, 0, 0, i)), ...[3, 4].map((i) => food.orange("Orange", 0, 0, 0, i))],
  ]);
  tray(trays, "FrCoverStock", FR.cx, sh4 + 0.003, B, [
    [brick("AmulButter1", "amul_butter", 0.085, 0.032, 0.055, K.butter), brick("AmulButter2", "amul_butter", 0.085, 0.032, 0.055, K.butter), brick("AmulCheese", "amul_cheese_slices", 0.12, 0.03, 0.12, K.cheese)],
    [1, 2, 3].map((i) => cupWithLid("AmulMastiCup" + i, "amul_masti_dahi_lid", 0.04, 0.05)).concat([pouch("AmulPaneerFr", "amul_paneer", false, 0.8)]),
  ]);
  // upper Fresh Zone: the vegetables; lower: onions, potatoes and the big heads
  const v = [];
  for (let i = 0; i < 5; i++) v.push(at(food.carrot("Carrot", 0, 0, 0, i + 1), -0.15 + i * 0.03, -0.2));
  for (let i = 0; i < 3; i++) { const b = at(food.brinjal("Brinjal", 0, 0, 0, i + 1), -0.05 + i * 0.07, -0.15); b.rotation.y = Math.PI / 2; v.push(b); }
  for (let i = 0; i < 4; i++) v.push(at(food.drumstick("Drumstick", 0, 0, 0, i + 1), 0.08 + i * 0.022, -0.24));
  for (let i = 0; i < 8; i++) v.push(at(food.okra("LadiesFinger", 0, 0, 0, i + 1), 0.11 + (i % 4) * 0.022, -0.05 + Math.floor(i / 4) * 0.02));
  ["green", "red", "yellow"].forEach((k, i) => v.push(at(food.capsicum("Capsicum", 0, 0, 0, k, i + 1), -0.15 + i * 0.075, 0.0)));
  ring(8, 0.0, -0.02, 0.1, 3).forEach(([x, z], i) => v.push(at(food.tomato("Tomato", 0, 0, 0, i + 1), x, z)));
  for (let i = 0; i < 10; i++) v.push(at(food.chilli("GreenChilli", 0, 0, 0, i + 1), 0.05 + i * 0.006, -0.08));
  v.push(at(food.herb("Coriander", 0, 0, 0, "coriander", 1), -0.1, -0.24));
  v.push(at(food.herb("CurryLeaves", 0, 0, 0, "curry", 2), 0.0, -0.22));
  heap(trays, "FreshZoneStock", FR.cx, { ...frDr1, ceil: sh4 - 0.003 - 0.012 }, v);
  const w = [];
  w.push(at(food.cabbage("Cabbage", 0, 0, 0, 1), -0.12, -0.2));
  w.push(at(food.cauliflower("Cauliflower", 0, 0, 0, 1), 0.1, -0.2));
  for (let i = 0; i < 8; i++) w.push(at(food.onion("Onion", 0, 0, 0, i + 1), -0.15 + (i % 4) * 0.07, -0.05 + Math.floor(i / 4) * 0.07));
  for (let i = 0; i < 6; i++) w.push(at(food.potato("Potato", 0, 0, 0, i + 1), 0.05 + (i % 3) * 0.06, -0.02 + Math.floor(i / 3) * 0.06));
  heap(trays, "FrDrawerLowStock", FR.cx, { ...frDr2, ceil: 0.372 - 0.012 }, w);
}
// the freezer (LG's stocked photo: packs and tubs on the shelves, the drawer full)
{
  const B = { hw: FZ.hw - 0.02, z0: zIn1 + 0.03, z1: fzFront - 0.0125 };
  // the top shelf stays low, so LG's "Convertible" on the back wall shows above it (as in LG's stocked photo)
  tray(cab, "FzShelf1Stock", FZ.cx, sh1 + 0.003, B, [[iceTub("AmulVanillaMagic", "amul_vanilla_magic_lid", 0.16, 0.085, 0.16), pouch("FreshoGreenPeas", "fresho_green_peas", false, 0.6)]]);
  tray(cab, "FzShelf2Stock", FZ.cx, sh2 + 0.003, B, [[pouch("ViswasParotta", "viswas_parotta", false, 0.75)], [pouch("NityaParotta", "nitya_parotta", false, 0.75)]]);
  // the third shelf holds the Ice Tray with Box at the front left: one pack lies behind it
  tray(cab, "FzShelf3Stock", FZ.cx, sh3 + 0.003, { ...B, z1: fzFront - 0.03 - 0.11 - 0.01 }, [[pouch("FreshoGreenPeas2", "fresho_green_peas", false, 0.9)]]);
  tray(cab, "FzShelf4Stock", FZ.cx, sh4 + 0.003, B, [[pouch("FreshoGreenPeas3", "fresho_green_peas", false, 0.75)], [pouch("AmulPaneer", "amul_paneer", false, 0.75)]]);
  const tubs = [iceTub("AmulVanillaMagic2", "amul_vanilla_magic_lid", 0.16, 0.085, 0.16), iceTub("AmulRajbhog", "amul_rajbhog_lid", 0.16, 0.085, 0.16)];
  tray(cab, "FzCoverStock", FZ.cx, fzCover + 0.003, B, [[tubs[0], pouch("AmulPaneer3", "amul_paneer", true, 0.5)]],
    (g) => { g.add(tubs[1]); tubs[1].position.set(tubs[0].position.x, 0, tubs[0].position.z); });
  const f = [];
  f.push(at(pouch("FreshoGreenPeas4", "fresho_green_peas", false, 0.9), -0.05, -0.18));
  f.push(at(pouch("ViswasParotta2", "viswas_parotta", false, 0.8), 0.03, -0.05));
  f.push(at(pouch("NityaParotta3", "nitya_parotta", false, 0.8), -0.03, -0.12));
  f.push(at(pouch("AmulPaneer2", "amul_paneer", false, 0.8), 0.0, 0.02));
  f.push(at(pouch("FreshoGreenPeas5", "fresho_green_peas", false, 0.9), 0.05, -0.2));
  heap(fzDrawer, "FzDrawerStock", FZ.cx, { ...fzDr, ceil: fzCover - 0.003 - 0.012 }, f);
}

// ── doors: the freezer hinged on the left, the fridge on the right; Dazzle Steel film with the pocket across both ──
function door(name, s, pw, texM, build) {
  const xH = s * 0.456;
  const g = group(name, xH, yD0, zPiv);
  const X = (u) => -s * u; // door-local x of a point u from the hinge edge
  const xmin = Math.min(X(0), X(pw));
  // a slab of the door's front between heights y0 and y1 (world), its front face mapped so the texture runs on
  // unbroken across the upper slab, the pocket and the lower slab
  const slab = (nm, y0, y1, z0, z1, mats) => {
    const geo = new THREE.BoxGeometry(pw, y1 - y0, z1 - z0);
    geo.translate(X(pw / 2), (y0 + y1) / 2 - yD0, (z0 + z1) / 2);
    const pos = geo.attributes.position, nor = geo.attributes.normal, uv = geo.attributes.uv;
    for (let i = 0; i < pos.count; i++) if (nor.getZ(i) > 0.5) uv.setXY(i, (pos.getX(i) - xmin) / pw, (yD1 - (pos.getY(i) + yD0)) / doorH);
    return mesh(nm, geo, mats);
  };
  const ub = (nm, u0, u1, y0, y1, z0, z1, m) => mesh(nm, new THREE.BoxGeometry(u1 - u0, y1 - y0, z1 - z0), m, (X(u0) + X(u1)) / 2, (y0 + y1) / 2 - yD0, (z0 + z1) / 2);
  g.add(slab(name + "Lower", yD0, band0, zB, zF, [doorEdge, doorEdge, doorEdge, doorEdge, texM, doorBack]));
  g.add(slab(name + "Upper", band1, yD1, zB, zF, [doorEdge, doorEdge, doorEdge, pocketM, texM, doorBack]));
  g.add(slab(name + "PocketCore", band0, band1, zB, zF - pocketD, [doorEdge, doorEdge, pocketM, pocketM, pocketM, doorBack]));
  g.add(ub(name + "PocketLip", 0, pw, band0, lip1, zF - pocketD + 0.001, zF, lipM));
  // gaskets on all four sides, 16 mm wide and 17 mm deep, against the cabinet front
  const gz0 = zB - 0.017;
  g.add(ub("GasketT", 0.006, pw - 0.006, 1.719, 1.735, gz0, zB, gasket));
  g.add(ub("GasketB", 0.006, pw - 0.006, 0.035, 0.051, gz0, zB, gasket));
  g.add(ub("GasketHinge", 0.006, 0.022, 0.051, 1.719, gz0, zB, gasket));
  g.add(ub("GasketSeam", pw - 0.022, pw - 0.006, 0.051, 1.719, gz0, zB, gasket));
  build(g, { X, ub, xH });
  return g;
}
// a clear door basket on the door liner's face (local z zDyke), between u0 and u1, its floor at world height y
const zDyke = zB - 0.04;
function basket(g, X, name, u0, u1, y, dep, h) {
  const b = group(name, (X(u0) + X(u1)) / 2, y - yD0, zDyke), w = u1 - u0;
  b.add(box(name + "Floor", w, 0.004, dep, clear, 0, 0.002, -dep / 2));
  b.add(box(name + "Back", w, h, 0.004, clear, 0, h / 2, -0.002));
  b.add(box(name + "Lip", w, h * 0.85, 0.004, clear, 0, h * 0.425, -dep + 0.002));
  b.add(box(name + "EndL", 0.004, h, dep - 0.008, clear, -w / 2 + 0.002, h / 2, -dep / 2));
  b.add(box(name + "EndR", 0.004, h, dep - 0.008, clear, w / 2 - 0.002, h / 2, -dep / 2));
  b.add(box(name + "Rim", w, 0.006, 0.006, clearRib, 0, h - 0.003, -dep + 0.003));
  g.add(b);
  // the inside of the basket in the door's frame: x range and the middle of its depth
  return { x0: Math.min(X(u0), X(u1)) + 0.006, x1: Math.max(X(u0), X(u1)) - 0.006, zm: zDyke - dep / 2, y: y - yD0 + 0.004 };
}
const row = (g, inside, items) => { items.forEach((o) => { face(o); o.position.y = inside.y; g.add(o); }); lineUp(items, inside.x0, inside.x1, inside.zm, { middle: true }); };

const fzPW = 0.3915, frPW = 0.5165;
const freezerDoor = door("FreezerDoor", -1, fzPW, doorFzM, (g, { X, ub }) => {
  g.add(ub("FzDoorDyke", 0.048, 0.349, 0.11, 1.69, zDyke, zB, doorBack));
  const dep = 0.085, bs = [1.468, 1.189, 0.570, 0.372].map((y, i) => basket(g, X, `FzBasket${i + 1}`, 0.052, 0.335, y, dep, 0.072));
  // small frozen packs standing in the baskets, faces to the room when the door is open
  const packs = [["fresho_green_peas", "viswas_parotta", "amul_paneer"], ["nitya_parotta", "fresho_green_peas", "amul_paneer"], ["viswas_parotta", "amul_paneer", "fresho_green_peas"], ["amul_paneer", "nitya_parotta", "fresho_green_peas"]];
  bs.forEach((b, i) => row(g, b, packs[i].map((k, j) => pouch(`FzPack${j}`, k, true, 0.5))));
});
const fridgeDoor = door("FridgeDoor", 1, frPW, doorFrM, (g, { X, ub, xH }) => {
  g.add(ub("FrDoorDyke", 0.048, 0.491, 0.11, 1.69, zDyke, zB, doorBack));
  // the LG mark and the energy label for this model, where LG's front photo has them (top right of the fridge door)
  g.add(plane("LgMarkDecal", 0.0552, 0.0253, logoM, 0.3903 - xH, 1.737 - yD0, zF + 0.0007));
  g.add(plane("BeeLabelDecal", 0.089, 0.169, labelM, 0.3755 - xH, 1.5985 - yD0, zF + 0.0007));
  const dep = 0.095;
  const b1 = basket(g, X, "FrBasket1", 0.052, 0.45, 1.457, dep, 0.08);
  const b2 = basket(g, X, "FrBasket2", 0.052, 0.45, 1.178, dep, 0.107);
  const b3 = basket(g, X, "FrBasket3", 0.052, 0.45, 0.782, dep, 0.108);
  const b4 = basket(g, X, "FrBasket4", 0.052, 0.45, 0.358, dep, 0.112);
  row(g, b1, [brandJar("MothersPickle", "mothers_mango_pickle", 0.036, 0.07, K.jarGreen, K.goldLid), brandJar("MothersPickle2", "mothers_mango_pickle", 0.036, 0.07, K.jarGreen, K.goldLid),
    brandJar("AavinGhee", "aavin_ghee_jar", 0.034, 0.07, K.amber, K.goldLid), pouch("SakthiSambar", "sakthi_sambar_powder", true, 0.8)]);
  row(g, b2, [carton("RealMango", "real_mango", 2), carton("RealMixedFruit", "real_mixed_fruit", 1), carton("AmulTaaza", "amul_taaza_carton", 3), pouch("NandiniGhee", "nandini_ghee_pouch", true, 0.7)]);
  row(g, b3, [petBrand("Coke", "coke_label", 0.042, 0.3, 0x2a1408, 0xc42b22), petBrand("Fanta", "fanta_label", 0.042, 0.3, 0xe8820e, 0xe07a12),
    petBrand("ThumsUp", "thumsup_label", 0.042, 0.3, 0x2a1408, 0x1b3a8c), petBrand("Bisleri", "bisleri_label", 0.0345, 0.265, 0xcfe9f7, 0x1a6fb0, 0.6)]);
  const cans = [[0x1b2d72, "thumsup_can", 0.105], [0xb82a20, "coke_label", 0.06], [0xe8820e, "fanta_label", 0.06]];
  row(g, b4, [petBrand("Bisleri2", "bisleri_label", 0.0345, 0.265, 0xcfe9f7, 0x1a6fb0, 0.6), petBrand("Bisleri3", "bisleri_label", 0.0345, 0.265, 0xcfe9f7, 0x1a6fb0, 0.6),
    ...cans.map(([col, key, lh]) => food.can("Can", col, 0, 0, 0, brand(key), arcFor(asp(key, 1) * lh, 0.033), lh))]);
});
root.add(freezerDoor, fridgeDoor);

const parts = productParts(PRODUCTS, ID);
// what a slide may travel with its door open: the open door's baskets and food stand in front of the cabinet. Points are
// sampled 1 cm apart through every mesh of the open door and tested against each sliding mesh's box
{
  const AXY = new THREE.Vector3(0, 1, 0);
  for (const p of parts.filter((q) => q.slide)) {
    const outer = parts.find((q) => q.key === p.needs), dn = root.getObjectByName(outer.node), sn = root.getObjectByName(p.node);
    const q0 = dn.quaternion.clone();
    dn.quaternion.setFromAxisAngle(AXY, THREE.MathUtils.degToRad(outer.angle));
    root.updateMatrixWorld(true);
    const pts = [];
    dn.traverse((c) => {
      if (!c.isMesh) return;
      c.geometry.computeBoundingBox();
      const b = c.geometry.boundingBox, n = [0, 1, 2].map((k) => Math.max(1, Math.ceil((b.max.getComponent(k) - b.min.getComponent(k)) / 0.01)));
      for (let i = 0; i <= n[0]; i++) for (let j = 0; j <= n[1]; j++) for (let k = 0; k <= n[2]; k++)
        pts.push(new THREE.Vector3(b.min.x + (b.max.x - b.min.x) * i / n[0], b.min.y + (b.max.y - b.min.y) * j / n[1], b.min.z + (b.max.z - b.min.z) * k / n[2]).applyMatrix4(c.matrixWorld));
    });
    const own = []; sn.traverse((c) => c.isMesh && own.push(new THREE.Box3().setFromObject(c)));
    dn.quaternion.copy(q0); root.updateMatrixWorld(true);
    let max = 1;
    for (const a of own) for (const v of pts) if (v.x > a.min.x - 0.002 && v.x < a.max.x + 0.002 && v.y > a.min.y - 0.002 && v.y < a.max.y + 0.002 && v.z >= a.max.z - 0.001) max = Math.min(max, v.z - a.max.z);
    console.log(`slide ${p.key}: ${p.slide[2]} m set, ${max.toFixed(3)} m before it meets the open ${outer.key} door`);
  }
}
const clips = stateClips(root, parts);
saveZones(PRODUCTS, ID, root, parts);
const textures = {
  DoorFreezer: `${T}/door_freezer.jpg`, DoorFridge: `${T}/door_fridge.jpg`, RearPlate: `${T}/rear.jpg`, LabelBEE: `${T}/label.png`, LgMark: `${T}/lgmark.png`,
  print_convertible: `${T}/print_convertible.png`, print_multiairflow: `${T}/print_multiairflow.png`, print_freshzone: `${T}/print_freshzone.png`, print_freezingzone: `${T}/print_freezingzone.png`,
  ...food.textures(`${TEX}/food`),
  ...Object.fromEntries(Object.keys(labelMats).map((n) => [n, `${TEX}/brands/small/${n.slice(3)}.jpg`])),
};
// Grain (BENCHMARK.md section 10). LG lists the doors as PET in Dazzle Steel: a printed steel look with fine horizontal
// brushing (LG's close-up) under a glossy film. The sides and top are smooth factory paint: the soft peel.
await exportGLB(root, clips, OUT, textures, { dir: `${TEX}/grain`, materials: {
  DoorFreezer: { type: "hairline", dir: "h", clearcoat: [0.3, 0.15] },
  DoorFridge: { type: "hairline", dir: "h", clearcoat: [0.3, 0.15] },
  DoorEdge: { type: "hairline", dir: "h" }, // the slabs carry DoorEdge too: its spec sets the grain of the whole slab
  SideSteel: { type: "peel_soft" }, TopSteel: { type: "peel_soft" },
} });
