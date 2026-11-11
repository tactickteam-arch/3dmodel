// Whirlpool 22457, Luxuriem 654 L four-door French door refrigerator (convertible, inverter, 360 degree Triple Cooling) in
// Rhodium Steel, with the same body in Cosmos Black (22458) as a material variant (KHR_materials_variants). Whirlpool
// India sells this steel body in these two colours as their own products (catalogue RefIds 22457 and 22458: the same
// size, weight, spec table and energy label; the steel Dark Quantum Obsidian, 22459, has a different, black interior).
// Built to Whirlpool's published size, 909 W x 1862.5 H x 748.5 D mm (spec table, "without box"; the size picture marks
// 1862.5 and 748.5 mm), from Whirlpool's gallery for both codes: the straight fronts (0.5633 px/mm), the 3/4 photos in a
// room, the open and stocked renders, the convertible and freezer close-ups and the display close-up. No manual and no
// rear photo are published (NOTES.md). Four doors: two French doors over the fridge (424 L), each with a stainless steel
// lip along its lower edge, the left one with the door display on its inner edge; the freezer (115 L) behind the lower
// left door and the convertible compartment (115 L) behind the lower right door, each lower door with a dark grip along
// its top. Inside the fridge: two LED strips in the ceiling, the 360 degree air panel on the back wall, two glass shelves
// and the crisper cover, two crispers. In the freezer: the ice twister and ice bank on a tray, two drawers; in the
// convertible: a tray, a shallow tray and a drawer. Clear bins on every door (7 on the fridge doors, 3 on each lower door).
// Stocked for a south Indian kitchen.
// Moving parts (STANDARD.md allows four): the fridge doors (FridgeDoorL, with FridgeDoorR through `also`: they open
// together), the two crispers with their food (FridgeTrays), the freezer door and the convertible door.
// usage: node make_whirlpool_22457.mjs <products.json> <tex dir> <out.glb>
import fs from "node:fs";
import { THREE, mat, mesh, box, group, flipV, stateClips, exportGLB, productParts, saveZones } from "./lib.mjs";
import { Food } from "./food.mjs";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { NodeIO } from "@gltf-transform/core";
import { ALL_EXTENSIONS, KHRMaterialsVariants } from "@gltf-transform/extensions";

const [PRODUCTS, TEX, OUT] = process.argv.slice(2);
const ID = "whirlpool-22457";
const T = `${TEX}/whirlpool_22457`;

// ── size (metres): Whirlpool's 909 x 1862.5 x 748.5 mm; every other number from Whirlpool's photos (NOTES.md) ──
const W = 0.909, H = 1.8625, D = 0.7485;
const zBack = -D / 2, zF0 = D / 2;
const zBody = zBack + 0.004;        // the back panel's face (a 4 mm panel)
const doorT = 0.082;                // the doors: 82 mm thick (3/4 photo: the door's side 10 px against the cabinet's 61)
const zDoor = zF0 - doorT;          // the doors' back faces
const zCab = zDoor - 0.012;         // the cabinet's front, 12 mm behind the doors (the gasket)
const eH = 0.004, zPiv = zDoor + 0.022, ANG = 115; // hinge axis 4 mm inside each side, 22 mm in front of the door back
const xOut = W / 2, xIn = 0.381;    // fridge opening 762 mm (open photo at 0.466 px/mm)
const xInL = 0.366, div = 0.035;    // the lower compartments: 331 mm each, a 70 mm divider (open photo)
const yBot = 0.02, yTop = H - 0.02; // the cabinet: on its feet; its top 20 mm under the doors' (open photo: 1848 mm)
const yCeil = 1.796, yFrFloor = 0.86, yRail0 = 0.815, yLoFloor = 0.09; // open photo, front plane
const zIn1 = zBody + 0.066;         // the inner back wall (ESTIMATED: 70 mm of back, as the LG GV-B23's 65 + panel)
const zStep = zBody + 0.25, yStep = 0.30; // the compressor bay behind the lower drawers (ESTIMATED, as the LG GV-B23)
// doors (front photo): upper 856 mm (the steel lip 856-873) to the top; lower 34.6 to 841.5 mm, the grip 804-841.5
const yU0 = 0.856, yUf = 0.873, yL0 = 0.0346, yLg = 0.804, yL1 = 0.8415;
const seam = 0.004;                 // half the 8 mm seam between the doors (front photo: a 16 mm dark line with the edges)
const lipD = 0.014;                 // the steel lip runs 14 mm back under the upper doors (3/4 photo)
const gripD = 0.010;                // the lower doors' grip leans 10 mm back over its 37.5 mm (convertible photo)
const sh1 = 1.558, sh2 = 1.339, shB = 1.082; // glass shelves and the crisper cover (open photo)
const dykeU = 0.04, dykeL = 0.035, bDep = 0.10, bDepL = 0.09; // door liners and bin depths (ESTIMATED)
const frFront = zDoor - dykeU - bDep - 0.01;    // shelves and crispers stop 1 cm short of the shut doors' bins
const fzFront = zDoor - dykeL - bDepL - 0.01;   // and the freezer's and convertible's trays and drawers
const FZ = { x0: -xInL, x1: -div }, CV = { x0: div, x1: xInL };

// ── materials (base finish: Rhodium Steel; Cosmos Black swaps the ones listed at the end) ──
// the steel doors: the texture carries the colour and Whirlpool's light bands; metal under 0.5 so the iPhone file's
// part-metal fix applies; the hairline across them (exportGLB grain) and a soft clear coat (Rhodium)
const doorL = mat("DoorFrontL", 0xffffff, { metal: 0.38, rough: 0.5 });
const doorR = mat("DoorFrontR", 0xffffff, { metal: 0.38, rough: 0.5 });
const doorEdge = mat("DoorEdge", 0x3a3b3e, { metal: 0.3, rough: 0.5 });   // the doors' sides and tops: dark (3/4 photos)
const lipM = mat("SteelLip", 0xeceef0, { metal: 0.5, rough: 0.2 });       // the upper doors' stainless steel lip: a bright line on every photo
const gripM = mat("GripDark", 0x1c1d1f, { metal: 0.1, rough: 0.75 });     // the lower doors' dark grip (front photos: near black)
const doorBack = mat("DoorLiner", 0xeef0f2, { rough: 0.55 });
const sideSteel = mat("SideSteel", 0x3a3b3e, { metal: 0.3, rough: 0.5 });  // the cabinet's sides, dark grey (3/4 photos)
const topSteel = mat("TopSteel", 0x2c2d30, { metal: 0.15, rough: 0.7 });
const frameM = mat("CabFrame", 0x1d1e20, { metal: 0.1, rough: 0.75 });     // the cabinet front seen between the doors: black
const rearM = mat("RearPanel", 0x2b2c2f, { metal: 0.1, rough: 0.7 });
const darkM = mat("HingeDark", 0x1c1d1f, { rough: 0.6 });
const pinM = mat("Pin", 0xc4c7cb, { metal: 0.9, rough: 0.3 });
const hingeM = mat("HingeSilver", 0xb9bcc0, { metal: 0.85, rough: 0.3 });
const logoM = mat("WhirlpoolMark", 0xffffff, { rough: 0.45, opacity: 0.999 });
const sixthM = mat("SixthSense", 0xffffff, { rough: 0.45, opacity: 0.999 });
const panelM = mat("DoorDisplay", 0xffffff, { metal: 0.7, rough: 0.22 });  // black glass with its print
const liner = mat("Liner", 0xf1f3f5, { rough: 0.6 });
const linerSide = mat("LinerSide", 0xe4e8ec, { rough: 0.65 });
const linerGrey = mat("LinerGrey", 0xdde1e5, { rough: 0.55 });
const gasket = mat("Gasket", 0x6c7176, { rough: 0.85 });
const ventM = mat("VentGrey", 0x8c9096, { rough: 0.6 });
const clear = mat("ClearPlastic", 0xc3d0da, { rough: 0.12, opacity: 0.5, side: THREE.DoubleSide });
const clearLight = mat("ClearPlasticLight", 0xdfe7ee, { rough: 0.12, opacity: 0.26, side: THREE.DoubleSide });
const clearRib = mat("ClearRib", 0xeef3f7, { rough: 0.3 });
// the backs of the bins and drawers, and the walls of the fixed drawers, stand just in front of the white liner: drawn
// as the clear plastic over it, opaque (each see-through piece is its own mesh in the Apple file, and the USDZ budget
// is 450 meshes; these never stand between the eye and the food)
const binBack = mat("BinBack", 0xdbe2e8, { rough: 0.35 });
const glass = mat("TemperedGlass", 0xa9cdd6, { rough: 0.05, opacity: 0.55, side: THREE.DoubleSide });
const glassRim = mat("ShelfRim", 0xe3e7ea, { rough: 0.45 });
const chrome = mat("ChromeTrim", 0xc4c7cb, { metal: 1, rough: 0.2 });       // the shelves', trays' and drawers' bright fronts
const white = mat("WhitePlastic", 0xf6f7f8, { rough: 0.45 });
const lightM = mat("Led", 0xffffff, { emissive: 0xf4f8ff, emissiveIntensity: 1.5 });
const footM = mat("Foot", 0x131416, { rough: 0.7 });
const skidM = mat("Skid", 0xb8babd, { metal: 0.5, rough: 0.4 });
const p360 = mat("print_360", 0xffffff, { rough: 0.5, opacity: 0.999 });
const pTriple = mat("print_triple", 0xffffff, { rough: 0.5, opacity: 0.999 });
const pArctic = mat("print_arctic", 0xffffff, { rough: 0.5, opacity: 0.999 });
const pCrisp = mat("print_crisper", 0xffffff, { rough: 0.5, opacity: 0.999 });
const pDrawer = mat("print_drawer", 0xffffff, { rough: 0.5, opacity: 0.999 });

// ── small builders ──
const cyl = (name, rt, rb, h, m, x, y, z, seg = 14) => mesh(name, new THREE.CylinderGeometry(rt, rb, h, seg), m, x, y, z);
const plane = (name, w, h, m, x, y, z) => mesh(name, flipV(new THREE.PlaneGeometry(w, h)), m, x, y, z);
const span = (name, x0, x1, y0, y1, z0, z1, m) => mesh(name, new THREE.BoxGeometry(x1 - x0, y1 - y0, z1 - z0), m, (x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2);
// the doors' inside parts lean 2 degrees in plan, their backs toward the hinge (as the LG GV-B23: a side seen exactly
// head-on through a shut door drew a thin line in headless Chrome)
const LEAN = Math.tan(THREE.MathUtils.degToRad(2));
function lean(o, dir) {   // dir: +-1 for 2 degrees; +-0.5 for 1
  o.traverse((c) => {
    if (!c.isMesh) return;
    const pos = c.geometry.attributes.position;
    c.geometry.computeBoundingBox();
    const zf = c.geometry.boundingBox.max.z;
    for (let i = 0; i < pos.count; i++) pos.setX(i, pos.getX(i) + dir * LEAN * (zf - pos.getZ(i)));
    pos.needsUpdate = true;
    c.geometry.computeVertexNormals();
  });
  return o;
}

const root = group("Whirlpool22457");
const cab = group("Cabinet");
root.add(cab);

// ── cabinet shell ──
for (const s of [-1, 1]) {
  cab.add(span(s > 0 ? "SideRight" : "SideLeft", s > 0 ? xIn : -xOut, s > 0 ? xOut : -xIn, yBot, yTop, zBody, zCab,
    s > 0 ? [sideSteel, linerSide, topSteel, footM, frameM, rearM] : [linerSide, sideSteel, topSteel, footM, frameM, rearM]));
  // the lower compartments' outer walls stand 15 mm further in than the fridge's (open photo)
  cab.add(span("LowerWall", s > 0 ? xInL : -xIn, s > 0 ? xIn : -xInL, yLoFloor, yRail0, zIn1, zCab, [linerSide, linerSide, liner, liner, frameM, liner]));
}
cab.add(span("Top", -xIn, xIn, yCeil, yTop, zBody, zCab, [topSteel, topSteel, topSteel, liner, frameM, rearM]));
cab.add(span("MidRail", -xIn, xIn, yRail0, yFrFloor, zIn1, zCab, [liner, liner, liner, liner, frameM, liner]));
cab.add(span("Base", -xIn, xIn, yBot, yLoFloor, zBody, zCab, [liner, liner, liner, footM, frameM, rearM]));
cab.add(span("BackWallLo", -xIn, xIn, yLoFloor, yRail0, zBody, zIn1, [liner, liner, liner, liner, liner, rearM]));
cab.add(span("BackWallFr", -xIn, xIn, yRail0, yCeil, zBody, zIn1, [liner, liner, liner, liner, liner, rearM]));
cab.add(span("Divider", -div, div, yLoFloor, yRail0, zIn1, zCab, [linerSide, linerSide, liner, liner, liner, liner]));
cab.add(span("CompressorStep", -xInL, xInL, yLoFloor, yStep, zIn1, zStep, liner));
// the back: no photo of it (Whirlpool publishes none): a plain dark panel, rollers under the back corners (ESTIMATED)
cab.add(span("RearPanel", -xOut, xOut, yBot, yTop, zBack, zBody, [rearM, rearM, rearM, rearM, rearM, rearM]));
// the top hinge covers at the cabinet's outer top corners, up to the doors' top (open photo: black, about 70 mm wide)
for (const s of [-1, 1]) {
  const xa = s > 0 ? xOut - 0.07 : -xOut, xb = s > 0 ? xOut : -xOut + 0.07;
  cab.add(span("HingeTop", xa, xb, yTop, H - 0.0005, zCab - 0.12, zCab, darkM));
  cab.add(span("HingeTopArm", xa + 0.01, xb - 0.01, yTop + 0.004, H - 0.006, zCab, zDoor - 0.003, darkM));
}
// the middle hinges between the upper and lower doors at the outer corners (open photo: a silver plate each), the lower
// hinges under the lower doors, the front feet under them (front photo: 32 mm wide, 37 mm in from each side)
for (const s of [-1, 1]) {
  const xc = s * (xOut - 0.095);
  cab.add(span("HingeMidPlate", xc - 0.03, xc + 0.03, yRail0 + 0.008, yFrFloor - 0.008, zCab, zCab + 0.003, hingeM));
  for (const dx of [-0.015, 0.015]) cab.add(cyl("HingeMidScrew", 0.0045, 0.0045, 0.003, pinM, xc + dx, (yRail0 + yFrFloor) / 2, zCab + 0.0045, 12).rotateX(Math.PI / 2));
  cab.add(span("HingeMidArm", s > 0 ? xOut - 0.07 : -xOut + 0.003, s > 0 ? xOut - 0.003 : -xOut + 0.07, yL1 + 0.003, yU0 - 0.003, zCab, zPiv + 0.012, darkM));
  cab.add(cyl("HingeMidPin", 0.0035, 0.0035, yU0 - yL1 - 0.002, pinM, s * (xOut - eH), (yL1 + yU0) / 2, zPiv, 14));
  cab.add(span("HingeLow", s > 0 ? xOut - 0.07 : -xOut + 0.003, s > 0 ? xOut - 0.003 : -xOut + 0.07, yBot + 0.0015, yL0 - 0.001, zCab + 0.002, zPiv + 0.02, darkM));
  cab.add(cyl("FootFront", 0.016, 0.016, yL0 - 0.0015, footM, s * (xOut - 0.037), (yL0 - 0.0015) / 2, zPiv - 0.01, 18));
  cab.add(span("RollerSkid", s > 0 ? xOut - 0.05 : -xOut + 0.01, s > 0 ? xOut - 0.01 : -xOut + 0.05, 0.012, yBot, zBody, zBody + 0.15, skidM));
  cab.add(cyl("Roller", 0.0115, 0.0115, 0.016, footM, s * (xOut - 0.03), 0.0115, zBody + 0.08, 14).rotateZ(Math.PI / 2));
}
// no power cord: Whirlpool publishes no photo of the back, so its route is unknown (as the Whirlpool 22439: none drawn)

// ── inside, fixed: lights, the air panel, vents ──
// the fridge's ceiling: two LED strips across its front (open photo: 386 mm long, 17 mm apart)
for (const dz of [0.05, 0.075]) cab.add(span("FridgeLed", -0.19, 0.196, yCeil - 0.004, yCeil, zCab - dz - 0.006, zCab - dz, lightM));
// the 360 degree air panel on the back wall: 375 mm wide (open photo, the back wall at 0.44 px/mm), from the crisper
// cover to 1700 mm, 20 mm proud, with the 360 degree mark (57 mm) and TRIPLE COOLING (170 mm) printed in grey
{
  const g = group("AirPanel", 0, 0, 0);
  g.add(span("AirPanelBody", -0.1875, 0.1875, shB + 0.006, 1.70, zIn1, zIn1 + 0.02, linerGrey));
  g.add(plane("AirPanel360", 0.057, 0.057 * 79 / 147, p360, 0.004, 1.607, zIn1 + 0.0207));
  g.add(plane("AirPanelTriple", 0.17, 0.17 * 18 / 217, pTriple, 0.004, 1.43, zIn1 + 0.0207));
  cab.add(g);
}
// the lower compartments' lights: two windows in each ceiling's front (open photo: 70-86 mm wide)
for (const [x0, x1] of [[-0.295, -0.226], [-0.149, -0.08], [0.074, 0.143], [0.22, 0.289]]) {
  cab.add(span("FreezerLed", x0, x1, yRail0 - 0.004, yRail0, zCab - 0.05, zCab - 0.035, lightM));
}
// shelf ledges moulded in the fridge's side walls
for (const y of [sh1, sh2, shB]) for (const s of [-1, 1]) cab.add(span("SideLedge", s < 0 ? -xIn : xIn - 0.006, s < 0 ? -xIn + 0.006 : xIn, y - 0.019, y - 0.0075, zIn1 + 0.01, frFront - 0.03, linerSide));
for (const y of [0.592, 0.368]) for (const s of [-1, 1]) for (const [a, b] of [[div, div + 0.006], [xInL - 0.006, xInL]])
  cab.add(span("LowLedge", s * (s > 0 ? a : b), s * (s > 0 ? b : a), y - 0.019, y - 0.0075, zIn1 + 0.01, fzFront - 0.03, linerSide));

// ── shelves, trays and drawers ──
function shelf(parent, name, x0, x1, y, front) {
  const g = group(name, 0, 0, 0);
  g.add(span(name + "Glass", x0 + 0.004, x1 - 0.004, y - 0.003, y + 0.003, zIn1 + 0.012, front - 0.012, glass));
  g.add(span(name + "Trim", x0 + 0.004, x1 - 0.004, y - 0.008, y + 0.007, front - 0.012, front, chrome));
  g.add(span(name + "RimBack", x0 + 0.004, x1 - 0.004, y - 0.003, y + 0.007, zIn1 + 0.012, zIn1 + 0.022, glassRim));
  g.add(span(name + "RailL", x0 + 0.004, x0 + 0.014, y - 0.007, y + 0.007, zIn1 + 0.012, front - 0.012, glassRim));
  g.add(span(name + "RailR", x1 - 0.014, x1 - 0.004, y - 0.007, y + 0.007, zIn1 + 0.012, front - 0.012, glassRim));
  parent.add(g);
}
// a clear box: floor at y0 (its top), walls to y1, between x0 and x1, from zb to `front`; a chrome bar along its front
// (`bar`: "top" a rim, "low" a handle along the bottom, as the crispers) and its print
function drawer(parent, name, x0, x1, y0, y1, front, { zb = zIn1 + 0.012, printM = null, pw = 0, ph = 0, py = 0, bar = "top", barH = 0.012, fixed = true } = {}) {
  const g = group(name + "Box", 0, 0, 0);
  g.add(span(name + "Floor", x0, x1, y0 - 0.004, y0, zb, front, clear));
  g.add(span(name + "Back", x0, x1, y0, y1, zb, zb + 0.004, binBack));
  // a fixed drawer's walls stand 6 mm from the compartment's own walls; the crispers' walls show once they slide out
  // the fixed drawers' walls lean 1 degree in plan, their backs inward: a wall seen exactly edge-on through a shut
  // door (the walls by the divider, from straight in front) drew a thin line in headless Chrome
  const wl = g.add(span(name + "WallL", x0, x0 + 0.004, y0, y1, zb + 0.004, front - 0.004, fixed ? binBack : clear)).children.at(-1);
  const wr = g.add(span(name + "WallR", x1 - 0.004, x1, y0, y1, zb + 0.004, front - 0.004, fixed ? binBack : clear)).children.at(-1);
  if (fixed) { lean(wl, 0.5); lean(wr, -0.5); }
  if (bar === "low") {
    g.add(span(name + "Front", x0, x1, y0 - 0.004 + barH, y1, front - 0.004, front, clearLight));
    g.add(span(name + "Handle", x0, x1, y0 - 0.006, y0 - 0.004 + barH, front - 0.008, front + 0.002, chrome));
    g.add(span(name + "Rim", x0, x1, y1 - 0.006, y1, front - 0.004, front + 0.002, clearRib));
  } else {
    g.add(span(name + "Front", x0, x1, y0 - 0.004, y1 - barH, front - 0.004, front, clearLight));
    g.add(span(name + "Rim", x0, x1, y1 - barH, y1, front - 0.006, front + 0.002, chrome));
  }
  if (printM) g.add(plane(name + "Print", pw, ph, printM, (x0 + x1) / 2, py, front + 0.0007));
  parent.add(g);
  return g;
}

// fridge: two glass shelves and the crisper cover, fixed
shelf(cab, "FrShelf1", -xIn, xIn, sh1, frFront);
shelf(cab, "FrShelf2", -xIn, xIn, sh2, frFront);
shelf(cab, "CrisperCover", -xIn, xIn, shB, frFront);
// the two crispers under the cover (868 to 1065 mm; a chrome handle along the bottom of each front, 30 mm, and the three
// line icons at 969 mm), side by side: both slide out with their food (FridgeTrays)
const crY0 = yFrFloor + 0.008, crY1 = shB - 0.017;
const CRL = { x0: -xIn + 0.006, x1: -0.003 }, CRR = { x0: 0.003, x1: xIn - 0.006 };
const trays = group("FridgeTrays");
cab.add(trays);
for (const [c, nm] of [[CRL, "CrisperL"], [CRR, "CrisperR"]])
  drawer(trays, nm, c.x0, c.x1, crY0, crY1, frFront, { printM: pCrisp, pw: 0.107, ph: 0.045, py: 0.969, bar: "low", barH: 0.03, fixed: false });

// freezer (left): a tray with the ice twister and the ice bank, then two drawers (ARCTIC FREEZE on the upper one; the
// icons low on the lower one); convertible (right): a tray, a shallow tray and a drawer (open photo, front plane)
const tyA = 0.592, tyB = 0.645;            // the top trays (both sides)
const d1A = 0.369, d1B = 0.579;            // the freezer's upper drawer
const dLA = 0.096, dLB = 0.355;            // the lower drawers (both sides), behind them the compressor bay
const stA = 0.372, stB = 0.42;             // the convertible's shallow tray
for (const [c, nm] of [[FZ, "Fz"], [CV, "Cv"]]) {
  const x0 = c.x0 + 0.006, x1 = c.x1 - 0.006;
  drawer(cab, nm + "Tray", x0, x1, tyA, tyB, fzFront, { barH: 0.026 });
  drawer(cab, nm + "DrawerLow", x0, x1, dLA, dLB, fzFront, { zb: zStep + 0.01, printM: pDrawer, pw: 0.103, ph: 0.021, py: 0.206, barH: 0.01 });
}
drawer(cab, "FzDrawerUp", FZ.x0 + 0.006, FZ.x1 - 0.006, d1A, d1B, fzFront, { printM: pArctic, pw: 0.15, ph: 0.15 * 0.0828, py: 0.438, barH: 0.01 });
drawer(cab, "CvShallow", CV.x0 + 0.006, CV.x1 - 0.006, stA, stB, fzFront, { barH: 0.022 });
// the ice twister (white, its ice tray in it) over the ice bank (clear), at the back left of the freezer's tray
{
  const x0 = FZ.x0 + 0.02, x1 = x0 + 0.17, zb0 = zIn1 + 0.03, zb1 = zb0 + 0.16;
  cab.add(span("IceBank", x0, x1, tyA, tyA + 0.05, zb0, zb1, clear));
  cab.add(span("IceTwister", x0 - 0.005, x1 + 0.005, tyA + 0.05, tyA + 0.08, zb0 - 0.005, zb1 - 0.02, white));
  cab.add(span("IceTwisterKnob", (x0 + x1) / 2 - 0.02, (x0 + x1) / 2 + 0.02, tyA + 0.055, tyA + 0.075, zb1 - 0.02, zb1 - 0.012, white));
}
// ── stock helpers (the fitting helpers of the LG GV-B23's builder) ──
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
  amber: mat("GlassAmber", 0xc9892b, { rough: 0.12 }), goldLid: mat("GoldLid", 0xd1a43a, { metal: 0.8, rough: 0.3 }), jarGreen: mat("JarGreen", 0xe2b830, { rough: 0.2 }),
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
function petBrand(name, key, r, h, liquid, cap, opacity = 1) {
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
  const B = { hw: (dr.x1 - dr.x0) / 2 - 0.012, z0: (dr.zb ?? zIn1) + 0.03, z1: dr.front - 0.012 };
  items.forEach((o) => g.add(o));
  settle(items.slice().sort((a, b) => HEAP.indexOf(a.name.replace(/\d+$/, "")) - HEAP.indexOf(b.name.replace(/\d+$/, ""))), { tries: 30, spread: 0.08, bounds: B, ceil: dr.ceil - dr.y0 });
  return g;
}
const ring = (n, cx, cz, r, k) => [...Array(n)].map((_, i) => [cx + Math.cos(i * 2.4 + k) * r * Math.sqrt(i / n), cz + Math.sin(i * 2.4 + k) * r * Math.sqrt(i / n)]);
const at = (o, x, z) => { o.position.x = x; o.position.z = z; return o; };

// the fridge: snacks, batter and milk up top, the melon and the tubs on the second shelf, fruit on the bottom shelf;

// ── stock: vegetarian South Indian food, juices, water and soft drinks, laid out where Whirlpool's stocked photo puts
// each kind of thing (the fitting helpers of the LG GV-B23's builder) ──
{
  const SH = { hw: xIn - 0.02, z0: zIn1 + 0.03, z1: frFront - 0.0125 };
  const rnr = carton("RnrBiryaniBox", "rnr_box_front", 0); rnr.rotation.x = -Math.PI / 2;
  const milk = pouch("NandiniMilk", "nandini_toned_milk");
  // the air panel stands 2 cm out of the back wall: every shelf's back row starts 12 mm in front of it
  const SHp = { ...SH, z0: zIn1 + 0.032 };
  tray(cab, "FrShelf1Stock", 0, sh1 + 0.003, SHp, [
    [pouch("IdBatterPouch", "id_batter", true, 0.8), carton("MastiButtermilk", "amul_masti_buttermilk", 4), food.coconutHalf("CoconutHalf", 0, 0, 0, 1)],
    [rnr, milk],
  ], (g) => ["aavin_milk", "amul_taaza_pouch"].forEach((k, i) => g.add(at(pouch(i ? "AmulTaazaPouch" : "AavinMilk", k), milk.position.x, milk.position.z))));
  tray(cab, "FrShelf2Stock", 0, sh2 + 0.003, SHp, [
    [food.melonHalf("WatermelonHalf", 0, 0, 0, 1), paperTub("NandhanaPalace", "nandana_tub_wrap", 0.0525, 0.075), paperTub("NandhanaPalace2", "nandana_tub_wrap", 0.0525, 0.075)],
    [tin("RnrBiryani", "rnr_tin_lid", 0.075, 0.06), food.bananaBunch("Bananas", 0, 0, 0, 5, 1)],
  ]);
  // the crisper cover: the steel tiffin where the photo has its pot, and the curd and paneer
  tray(cab, "FrShelfLowStock", 0, shB + 0.003, SHp, [
    [tiffin("Tiffin"), brick("AmulButter1", "amul_butter", 0.085, 0.032, 0.055, K.butter), brick("AmulCheese", "amul_cheese_slices", 0.12, 0.03, 0.12, K.cheese)],
    [1, 2, 3].map((i) => cupWithLid("AmulMastiCup" + i, "amul_masti_dahi_lid", 0.04, 0.05)).concat([pouch("AmulPaneerFr", "amul_paneer", false, 0.8)]),
  ]);
  // the crispers (they slide out: FridgeTrays): vegetables on the left, fruit on the right, as the photo. The left one's
  // stock is split in two groups, "FreshZoneStock" (the heap) and "Shelf1Stock" (the herbs and chillies on top): the
  // trays page test finds both by name
  const ceil = shB - 0.008 - 0.003;
  const v = [];
  for (let i = 0; i < 4; i++) v.push(at(food.carrot("Carrot", 0, 0, 0, i + 1), -0.13 + i * 0.03, -0.16));
  for (let i = 0; i < 6; i++) v.push(at(food.okra("LadiesFinger", 0, 0, 0, i + 1), 0.06 + (i % 3) * 0.025, 0.02 + Math.floor(i / 3) * 0.025));
  [1, 2].forEach((i) => v.push(at(food.capsicum("Capsicum", 0, 0, 0, "green", i), -0.1 + (i - 1) * 0.09, 0.07)));
  ring(4, -0.08, 0.0, 0.06, 3).forEach(([x, z], i) => v.push(at(food.tomato("Tomato", 0, 0, 0, i + 1), x, z)));
  for (let i = 0; i < 2; i++) { const b = at(food.brinjal("Brinjal", 0, 0, 0, i + 1), 0.08, -0.12 + i * 0.075); b.rotation.y = Math.PI / 2; v.push(b); }
  for (let i = 0; i < 6; i++) v.push(at(food.chilli("GreenChilli", 0, 0, 0, i + 1), 0.1 + i * 0.006, 0.09));
  v.push(at(food.herb("Coriander", 0, 0, 0, "coriander", 1), -0.08, -0.24));
  v.push(at(food.herb("CurryLeaves", 0, 0, 0, "curry", 2), 0.06, -0.22));
  const fz = heap(trays, "FreshZoneStock", (CRL.x0 + CRL.x1) / 2, { ...CRL, y0: crY0, front: frFront, ceil }, v);
  const top = group("Shelf1Stock", fz.position.x, fz.position.y, fz.position.z);
  trays.add(top);
  for (const o of fz.children.filter((c) => /^(Coriander|CurryLeaves|GreenChilli)/.test(c.name))) top.add(o);
  const f = [];
  for (let i = 0; i < 4; i++) f.push(at(food.apple("Apple", 0, 0, 0, i + 1), -0.12 + i * 0.06, -0.18));
  for (let i = 0; i < 4; i++) f.push(at(food.orange("Orange", 0, 0, 0, i + 1), -0.1 + (i % 2) * 0.09, -0.02 + Math.floor(i / 2) * 0.08));
  for (let i = 0; i < 2; i++) f.push(at(food.orange("Orange", 0, 0, 0, i + 5), 0.09, -0.09 + i * 0.09));
  for (let i = 0; i < 2; i++) f.push(at(food.apple("Apple", 0, 0, 0, i + 5), -0.12 + i * 0.07, 0.11));
  heap(trays, "FruitStock", (CRR.x0 + CRR.x1) / 2, { ...CRR, y0: crY0, front: frFront, ceil }, f);
}
// the freezer: ice cream in the upper drawer, frozen packs in the lower; the convertible: curd and paneer on its tray,
// butter on the shallow tray, packs in its drawer (the photo: a dessert, a cake and frozen packs)
{
  const B = (c) => ({ hw: (c.x1 - c.x0) / 2 - 0.006 - 0.012, z0: zIn1 + 0.03, z1: fzFront - 0.0125 });
  const cx = (c) => (c.x0 + c.x1) / 2;
  tray(cab, "FzDrawerUpStock", cx(FZ), d1A, B(FZ), [
    [iceTub("AmulVanillaMagic", "amul_vanilla_magic_lid", 0.16, 0.085, 0.16)],
    [iceTub("AmulRajbhog", "amul_rajbhog_lid", 0.16, 0.085, 0.16), pouch("AmulPaneer", "amul_paneer", false, 0.6)],
  ]);
  for (const [c, nm] of [[FZ, "Fz"], [CV, "Cv"]]) {
    const p = [];
    p.push(at(pouch(nm + "GreenPeas", "fresho_green_peas", false, 0.9), -0.05, -0.05));
    p.push(at(pouch(nm + "ViswasParotta", "viswas_parotta", false, 0.8), 0.03, 0.05));
    p.push(at(pouch(nm + "NityaParotta", "nitya_parotta", false, 0.8), -0.03, 0.0));
    p.push(at(pouch(nm + "GreenPeas2", "fresho_green_peas", false, 0.9), 0.05, -0.04));
    const x0 = c.x0 + 0.006, x1 = c.x1 - 0.006;
    heap(cab, nm + "DrawerLowStock", cx(c), { x0, x1, y0: dLA, front: fzFront, zb: zStep + 0.01, ceil: (nm === "Fz" ? d1A : stA) - 0.006 - 0.004 }, p);
  }
  tray(cab, "CvTrayStock", cx(CV), tyA, B(CV), [
    [1, 2].map((i) => cupWithLid("CvCurd" + i, "amul_masti_dahi_lid", 0.04, 0.05)),
  ]);
  tray(cab, "CvShallowStock", cx(CV), stA, B(CV), [
    [brick("CvButter1", "amul_butter", 0.085, 0.032, 0.055, K.butter), brick("CvButter2", "amul_butter", 0.085, 0.032, 0.055, K.butter)],
  ]);
}

// ── doors: four. Each door's body is its side section run across the door: the steel front, its stainless lip (upper
// doors) or dark grip (lower), the liner behind, the dark sides and top ──
function body(name, sec, xl0, xl1, mats, xH, yf0, yf1) {
  const sh = new THREE.Shape(sec.map(([z, y]) => new THREE.Vector2(-(z - zPiv), y)));
  let geo = new THREE.ExtrudeGeometry(sh, { depth: xl1 - xl0, bevelEnabled: false }).rotateY(Math.PI / 2).translate(xl0, 0, 0);
  if (geo.index) geo = geo.toNonIndexed();
  const pos = geo.attributes.position, uv = geo.attributes.uv, lists = [[], [], [], []];
  const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3();
  for (let t = 0; t < pos.count / 3; t++) {
    a.fromBufferAttribute(pos, 3 * t); b.fromBufferAttribute(pos, 3 * t + 1); c.fromBufferAttribute(pos, 3 * t + 2);
    const n = b.sub(a).cross(c.sub(a)).normalize();
    // 0 front, 1 back, 2 the lip or grip (leaning faces), 3 the sides, top and bottom
    lists[n.z > 0.995 ? 0 : n.z < -0.9 ? 1 : n.z > 0.2 && Math.abs(n.y) > 0.1 ? 2 : 3].push(t);
  }
  const P = [], U = [], out = new THREE.BufferGeometry();
  let start = 0;
  lists.forEach((list, mi) => {
    for (const t of list) for (let k = 0; k < 3; k++) {
      const i = 3 * t + k, x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
      P.push(x, y, z);
      // the front: the colour's door texture across the door, top row first
      if (mi === 0) U.push((x - xl0) / (xl1 - xl0), (yf1 - y) / (yf1 - yf0)); else U.push(uv.getX(i), uv.getY(i));
    }
    out.addGroup(start, list.length * 3, mi);
    start += list.length * 3;
  });
  out.setAttribute("position", new THREE.Float32BufferAttribute(P, 3));
  out.setAttribute("uv", new THREE.Float32BufferAttribute(U, 2));
  out.computeVertexNormals();
  return mesh(name, out, mats);
}
// a door hinged at its outer side s (-1 left, +1 right); the group sits on the hinge axis, parts given in world x and z
function door(name, s, sec, yf0, yf1, front, edgeM, build) {
  const xH = s * (xOut - eH);
  const g = group(name, xH, 0, zPiv);
  const ls = (nm, x0, x1, ya, yb, z0, z1, m) => { const o = lean(span(nm, x0 - xH, x1 - xH, ya, yb, z0 - zPiv, z1 - zPiv, m), s); g.add(o); return o; };
  const xa = s > 0 ? seam : -xOut, xb = s > 0 ? xOut : -seam;
  g.add(body(name + "Body", sec, xa - xH, xb - xH, [front, doorBack, edgeM, doorEdge], xH, yf0, yf1));
  build(g, { xH, ls });
  return g;
}
// the seam: dark fins in it, so the inside's white never shows down the 8 mm gap (Whirlpool's photos: a dark line). Each
// fin starts 1.5 mm inside its own door, and the two doors' fins overlap across the gap at different depths, so no
// straight line runs through the shut seam at any angle (a 0.1 to 0.3 mm slit lets the white divider through as a fine
// light line, plainest on Cosmos Black). Their ends stop 0.5 mm short of the door's top and bottom (no shared faces).
// Swept in plan view: the lower doors' fins never meet, either door alone or both; the fridge doors open together
function fin(g, xH, name, x0, x1, y0, y1, z0, z1) { g.add(span(name, x0 - xH, x1 - xH, y0, y1, z0 - zPiv, z1 - zPiv, frameM)); }
// the gasket: a ring 16 mm wide round the opening, from the door's back to just short of the cabinet's front
function gaskets(ls, xs0, xs1, xh0, xh1, yb0, yt1) {
  const z0 = zCab + 0.0005, z1 = zDoor;
  const lo = Math.min(xs0, xh0), hi = Math.max(xs1, xh1);
  ls("GasketTop", lo, hi, yt1 - 0.016, yt1, z0, z1, gasket);
  ls("GasketBottom", lo, hi, yb0, yb0 + 0.016, z0, z1, gasket);
  ls("GasketSeam", xs0, xs1, yb0 + 0.016, yt1 - 0.016, z0, z1, gasket);
  ls("GasketHinge", xh0, xh1, yb0 + 0.016, yt1 - 0.016, z0, z1, gasket);
}
// a clear door bin on the door liner's face, between world x0 and x1, its floor at height y
function basket(g, xH, name, x0, x1, y, dep, h, dyke) {
  const zD = zDoor - dyke - zPiv, b = group(name, (x0 + x1) / 2 - xH, y, zD), w = x1 - x0;
  b.add(box(name + "Floor", w, 0.004, dep, clear, 0, 0.002, -dep / 2));
  b.add(box(name + "Back", w, h, 0.004, binBack, 0, h / 2, -0.002));
  b.add(box(name + "Lip", w, h * 0.85, 0.004, clear, 0, h * 0.425, -dep + 0.002));
  b.add(box(name + "EndL", 0.004, h, dep - 0.008, clear, -w / 2 + 0.002, h / 2, -dep / 2));
  b.add(box(name + "EndR", 0.004, h, dep - 0.008, clear, w / 2 - 0.002, h / 2, -dep / 2));
  b.add(box(name + "Rim", w, 0.006, 0.006, clearRib, 0, h - 0.003, -dep + 0.003));
  for (const c of b.children) lean(c, Math.sign(xH));
  g.add(b);
  return { x0: x0 - xH + 0.006, x1: x1 - xH - 0.006, zm: zD - dep / 2, y: y + 0.004 };
}
const row = (g, inside, items) => { items.forEach((o) => { face(o); o.position.y = inside.y; g.add(o); }); lineUp(items, inside.x0, inside.x1, inside.zm, { middle: true }); };

// the fridge doors (the open photos: four bins on the left door, three on the right, floors as below)
const secU = [[zDoor, yU0], [zF0 - lipD, yU0], [zF0, yUf], [zF0, H], [zDoor, H]];
const yDy0 = 0.875, yDy1 = 1.785;   // the door liner stands into the opening (fridge: 860 to 1796 mm)
const BIN_L = [[1.624, 0.07], [1.476, 0.07], [1.259, 0.07], [0.885, 0.12]], BIN_R = [[1.624, 0.07], [1.352, 0.11], [0.885, 0.12]];
const fridgeDoorL = door("FridgeDoorL", -1, secU, yUf, H, doorL, lipM, (g, { xH, ls }) => {
  gaskets(ls, -0.026, -0.010, -0.44, -0.424, yFrFloor + 0.006, yTop - 0.004);
  ls("DoorLinerPlate", -0.424, -0.026, yU0 + 0.012, yTop - 0.02, zDoor - 0.002, zDoor - 0.0002, doorBack);
  ls("FrDoorDykeL", -0.37, -0.03, yDy0, yDy1, zDoor - dykeU, zDoor - 0.002, doorBack);
  // the seam's fin at the back of the gap (the display panel fills the rest of the door's inner edge)
  fin(g, xH, "SeamFin", -seam - 0.0015, -0.0008, yU0 + 0.0005, H - 0.0005, zDoor + 0.001, zDoor + 0.007);
  // the door display on the inner edge (64 x 250 mm, 1386 to 1636 mm: open photos), hidden while the doors are shut
  g.add(mesh("DoorDisplay", flipV(new THREE.PlaneGeometry(0.064, 0.25)), panelM, -seam + 0.0007 - xH, 1.511, zF0 - 0.009 - 0.032 - zPiv).rotateY(Math.PI / 2));
  // the 6th Sense mark at the top left (3/4 photos: 20 x 25 mm, its middle 27 mm in from the edge, 53 mm under the top)
  g.add(plane("SixthSenseMark", 0.020, 0.025, sixthM, -xOut + 0.027 - xH, H - 0.0655, zF0 + 0.0007 - zPiv));
  const bs = BIN_L.map(([y, h], i) => basket(g, xH, `FrBinL${i + 1}`, -0.365, -0.04, y, bDep, h, dykeU));
  row(g, bs[0], [brandJar("MothersPickle", "mothers_mango_pickle", 0.036, 0.07, K.jarGreen, K.goldLid), brandJar("MothersPickle2", "mothers_mango_pickle", 0.036, 0.07, K.jarGreen, K.goldLid),
    brandJar("AavinGhee", "aavin_ghee_jar", 0.034, 0.07, K.amber, K.goldLid)]);
  // (each door's food keeps to few kinds: every material a moving part holds is two meshes in the Apple file)
  row(g, bs[1], [brandJar("MothersPickle3", "mothers_mango_pickle", 0.036, 0.07, K.jarGreen, K.goldLid), brandJar("AavinGhee2", "aavin_ghee_jar", 0.034, 0.07, K.amber, K.goldLid),
    brandJar("AavinGhee6", "aavin_ghee_jar", 0.034, 0.07, K.amber, K.goldLid)]);
  row(g, bs[2], [carton("RealMango", "real_mango", 2), carton("RealMango2", "real_mango", 1), carton("AmulTaaza", "amul_taaza_carton", 3)]);
  row(g, bs[3], [petBrand("Coke", "coke_label", 0.042, 0.3, 0x2a1408, 0xc42b22), petBrand("Coke2", "coke_label", 0.042, 0.3, 0x2a1408, 0xc42b22),
    petBrand("ThumsUp", "thumsup_label", 0.042, 0.3, 0x2a1408, 0x1b3a8c)]);
});
const fridgeDoorR = door("FridgeDoorR", 1, secU, yUf, H, doorR, lipM, (g, { xH, ls }) => {
  gaskets(ls, 0.010, 0.026, 0.424, 0.44, yFrFloor + 0.006, yTop - 0.004);
  ls("DoorLinerPlate", 0.026, 0.424, yU0 + 0.012, yTop - 0.02, zDoor - 0.002, zDoor - 0.0002, doorBack);
  ls("FrDoorDykeR", 0.03, 0.37, yDy0, yDy1, zDoor - dykeU, zDoor - 0.002, doorBack);
  // its fin at the hinges' depth, across the middle of the seam
  fin(g, xH, "SeamFin", -0.0018, seam + 0.0015, yU0 + 0.0005, H - 0.0005, zPiv - 0.003, zPiv + 0.003);
  // the Whirlpool mark at the top right (front photo: 69 mm wide, its middle 366 mm right of centre, at 1793 mm)
  g.add(plane("WhirlpoolMarkDecal", 0.069, 0.023, logoM, 0.3667 - xH, 1.793, zF0 + 0.0007 - zPiv));
  const bs = BIN_R.map(([y, h], i) => basket(g, xH, `FrBinR${i + 1}`, 0.04, 0.365, y, bDep, h, dykeU));
  row(g, bs[0], [brandJar("MothersPickle4", "mothers_mango_pickle", 0.036, 0.07, K.jarGreen, K.goldLid), brandJar("AavinGhee3", "aavin_ghee_jar", 0.034, 0.07, K.amber, K.goldLid)]);
  row(g, bs[1], [carton("MastiButtermilk2", "amul_masti_buttermilk", 4), carton("AmulTaaza2", "amul_taaza_carton", 3), pouch("NandiniGhee", "nandini_ghee_pouch", true, 0.7)]);
  const cans = [[0x1b2d72, "thumsup_can", 0.105], [0xb82a20, "coke_label", 0.06]];
  row(g, bs[2], [petBrand("Bisleri", "bisleri_label", 0.0345, 0.265, 0xcfe9f7, 0x1a6fb0, 0.6), petBrand("Bisleri2", "bisleri_label", 0.0345, 0.265, 0xcfe9f7, 0x1a6fb0, 0.6),
    ...cans.map(([col, key, lh]) => food.can("Can", col, 0, 0, 0, brand(key), arcFor(asp(key, 1) * lh, 0.033), lh))]);
});
// the lower doors: three bins each (open photos: floors at 650, 357 and 90 mm)
const secL = [[zDoor, yL0], [zF0, yL0], [zF0, yLg], [zF0 - gripD, yL1], [zDoor, yL1]];
const BIN_LO = [[0.65, 0.065], [0.357, 0.065], [0.09, 0.07]];
function lowerDoor(name, s, fill) {
  return door(name, s, secL, yL0, yLg, s < 0 ? doorL : doorR, gripM, (g, { xH, ls }) => {
    const m = (a, b) => (s > 0 ? [a, b] : [-b, -a]);
    gaskets(ls, ...m(0.010, 0.026), ...m(0.424, 0.44), yLoFloor - 0.04, yRail0 + 0.02);
    ls("DoorLinerPlate", ...m(0.026, 0.424), yL0 + 0.02, yL1 - 0.015, zDoor - 0.002, zDoor - 0.0002, doorBack);
    ls("LoDoorDyke", ...m(0.045, 0.355), 0.06, 0.805, zDoor - dykeL, zDoor - 0.002, doorBack);
    // the seam's fins, near the front where a free edge swings away from the other door as it opens: the left door's
    // across the gap 20 to 26 mm deep, the right one's 12 to 16 mm deep, overlapping it by 0.2 mm (the left door alone
    // still clears it by 0.16 mm on its way open)
    if (s < 0) fin(g, xH, "SeamFin", -seam - 0.0015, 0.0027, yL0 + 0.0005, yL1 - 0.0005, zPiv + 0.034, zPiv + 0.040);
    else fin(g, xH, "SeamFin", 0.0025, seam + 0.0015, yL0 + 0.0005, yL1 - 0.0005, zPiv + 0.044, zPiv + 0.048);
    const bs = BIN_LO.map(([y, h], i) => basket(g, xH, `${name}Bin${i + 1}`, ...m(0.05, 0.35), y, bDepL, h, dykeL));
    fill(g, bs);
  });
}
const freezerDoor = lowerDoor("FreezerDoor", -1, (g, bs) => {
  row(g, bs[0], [brandJar("MothersPickle5", "mothers_mango_pickle", 0.036, 0.07, K.jarGreen, K.goldLid), brandJar("AavinGhee4", "aavin_ghee_jar", 0.034, 0.07, K.amber, K.goldLid)]);
  row(g, bs[1], [pouch("SakthiSambar2", "sakthi_sambar_powder", true, 0.8), pouch("SakthiSambar3", "sakthi_sambar_powder", true, 0.8)]);
  row(g, bs[2], [brandJar("MothersPickle6", "mothers_mango_pickle", 0.036, 0.07, K.jarGreen, K.goldLid), brandJar("MothersPickle7", "mothers_mango_pickle", 0.036, 0.07, K.jarGreen, K.goldLid)]);
});
const convertibleDoor = lowerDoor("ConvertibleDoor", 1, (g, bs) => {
  row(g, bs[0], [brick("DoorButter", "amul_butter", 0.085, 0.032, 0.055, K.butter), brandJar("AavinGhee5", "aavin_ghee_jar", 0.034, 0.07, K.amber, K.goldLid)]);
  row(g, bs[1], [pouch("NandiniGhee2", "nandini_ghee_pouch", true, 0.7), pouch("AmulTaazaPouch2", "amul_taaza_pouch", true, 0.7)]);
  row(g, bs[2], [["thumsup_can", 0x1b2d72, 0.105], ["coke_label", 0xb82a20, 0.06], ["thumsup_can", 0x1b2d72, 0.105]]
    .map(([key, col, lh]) => food.can("Can", col, 0, 0, 0, brand(key), arcFor(asp(key, 1) * lh, 0.033), lh)));
});
root.add(fridgeDoorL, fridgeDoorR, freezerDoor, convertibleDoor);

const parts = productParts(PRODUCTS, ID);
{
  const AXY = new THREE.Vector3(0, 1, 0), doors = [[fridgeDoorL, -ANG], [fridgeDoorR, ANG], [freezerDoor, -ANG], [convertibleDoor, ANG]];
  for (const [d, a] of doors) d.quaternion.setFromAxisAngle(AXY, THREE.MathUtils.degToRad(a));
  root.updateMatrixWorld(true);
  const bb = new THREE.Box3();
  for (const [d] of doors) bb.union(new THREE.Box3().setFromObject(d.getObjectByName(d.name + "Body")));
  console.log(`doors open ${ANG} deg: ${((bb.max.x - bb.min.x) * 1000).toFixed(0)} mm across, ${((bb.max.z - zBack) * 1000).toFixed(0)} mm deep`);
  for (const [d] of doors) d.quaternion.identity();
  root.updateMatrixWorld(true);
}
// what a slide may travel with its door(s) open: the open doors' bins and food stand in front of the cabinet. Points
// 1 cm apart through every mesh of the open doors (the part's own node and its `also`) against each sliding mesh's box
{
  const AXY = new THREE.Vector3(0, 1, 0);
  for (const p of parts.filter((q) => q.slide)) {
    const outer = parts.find((q) => q.key === p.needs), sn = root.getObjectByName(p.node);
    const moving = [[outer.node, outer.angle], ...(outer.also || []).map((a) => [a.node, a.angle])].map(([n, a]) => [root.getObjectByName(n), a]);
    for (const [dn, a] of moving) dn.quaternion.setFromAxisAngle(AXY, THREE.MathUtils.degToRad(a));
    root.updateMatrixWorld(true);
    const pts = [];
    for (const [dn] of moving) dn.traverse((c) => {
      if (!c.isMesh) return;
      c.geometry.computeBoundingBox();
      const b = c.geometry.boundingBox, n = [0, 1, 2].map((k) => Math.max(1, Math.ceil((b.max.getComponent(k) - b.min.getComponent(k)) / 0.01)));
      for (let i = 0; i <= n[0]; i++) for (let j = 0; j <= n[1]; j++) for (let k = 0; k <= n[2]; k++)
        pts.push(new THREE.Vector3(b.min.x + (b.max.x - b.min.x) * i / n[0], b.min.y + (b.max.y - b.min.y) * j / n[1], b.min.z + (b.max.z - b.min.z) * k / n[2]).applyMatrix4(c.matrixWorld));
    });
    const own = []; sn.traverse((c) => c.isMesh && own.push(new THREE.Box3().setFromObject(c)));
    for (const [dn] of moving) dn.quaternion.identity();
    root.updateMatrixWorld(true);
    let max = 1;
    for (const a of own) for (const v of pts) if (v.x > a.min.x - 0.002 && v.x < a.max.x + 0.002 && v.y > a.min.y - 0.002 && v.y < a.max.y + 0.002 && v.z >= a.max.z - 0.001) max = Math.min(max, v.z - a.max.z);
    console.log(`slide ${p.key}: ${p.slide[2]} m set, ${max.toFixed(3)} m before it meets the open ${outer.key} doors`);
  }
}
const clips = stateClips(root, parts);
saveZones(PRODUCTS, ID, root, parts);
const textures = {
  DoorFrontL: `${T}/door_l_rs.jpg`, DoorFrontR: `${T}/door_r_rs.jpg`, WhirlpoolMark: `${T}/logo.png`, SixthSense: `${T}/sixth.png`,
  DoorDisplay: `${T}/panel.jpg`, print_360: `${T}/print_360.png`, print_triple: `${T}/print_triple.png`, print_arctic: `${T}/print_arctic.png`,
  print_crisper: `${T}/icons_crisper.png`, print_drawer: `${T}/icons_drawer.png`,
  ...food.textures(`${TEX}/food`),
  ...Object.fromEntries(Object.keys(labelMats).map((n) => [n, `${TEX}/brands/small/${n.slice(3)}.jpg`])),
};
// Grain (BENCHMARK.md section 10): the doors are steel brushed across (Whirlpool's photos), so the hairline across them;
// Rhodium Steel's soft clear coat catches the studio's strips (Cosmos Black drops it in its variant). The doors' dark
// sides, the cabinet's painted sides and top: the soft peel. No grain on the display, the marks or the prints.
const COAT_RS = [0.5, 0.3];
await exportGLB(root, clips, OUT, textures, { dir: `${TEX}/grain`, materials: {
  DoorFrontL: { type: "hairline", dir: "h", clearcoat: COAT_RS }, DoorFrontR: { type: "hairline", dir: "h", clearcoat: COAT_RS },
  DoorEdge: { type: "peel_soft" }, SideSteel: { type: "peel_soft" }, TopSteel: { type: "peel_soft" },
} });

// ── the two colours as material variants (KHR_materials_variants): Rhodium Steel (22457, first: the base materials
// above) and Cosmos Black (22458: dark brushed steel from its own Whirlpool photos, no clear coat). The cabinet, the
// marks, the display and the inside are the same on both (Whirlpool's photos of both codes) ──
const FINISHES = [
  ["Rhodium Steel", {}],
  ["Cosmos Black", {
    DoorFrontL: { tex: `${T}/door_l_cb.jpg`, rough: 0.75, coat: null },
    DoorFrontR: { tex: `${T}/door_r_cb.jpg`, rough: 0.75, coat: null },
  }],
];
{
  const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
  const doc = await io.readBinary(new Uint8Array(fs.readFileSync(OUT)));
  const ext = doc.createExtension(KHRMaterialsVariants);
  const vs = FINISHES.map(([n]) => ext.createVariant(n));
  const mats = doc.getRoot().listMaterials(), alt = {}, texCache = new Map();
  const texOf = (file) => {
    if (!texCache.has(file)) texCache.set(file, doc.createTexture(file.split("/").pop().replace(/\.\w+$/, "")).setImage(new Uint8Array(fs.readFileSync(file))).setMimeType(file.endsWith(".png") ? "image/png" : "image/jpeg"));
    return texCache.get(file);
  };
  for (const name of new Set(FINISHES.flatMap(([, t]) => Object.keys(t)))) {
    const base = mats.find((m) => m.getName() === name);
    if (!base) throw new Error(`no material ${name}`);
    alt[name] = FINISHES.map(([fn, t]) => {
      const v = t[name];
      if (!v) return base;
      const m = base.clone().setName(`${name}${fn.replace(/\s+/g, "")}`);
      if (v.tex) m.setBaseColorTexture(texOf(v.tex));
      if (v.metal != null) m.setMetallicFactor(v.metal);
      if (v.rough != null) m.setRoughnessFactor(v.rough);
      if (v.coat === null) m.setExtension("KHR_materials_clearcoat", null);
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
