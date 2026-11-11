// Whirlpool 22461, Luxuriem 654 L four-door French door refrigerator (Whirlpool's product type "Four Door"), Duo Noir:
// black glass fridge doors over brushed black steel freezer doors. The same body in Whirlpool's other glass colours as
// material variants (KHR_materials_variants): Nero Quartz (22460, four black glass doors), Verde Cristallo (22463, green
// marble glass) and Nero Bianco (22464, grey marble glass over black glass). Whirlpool India's catalogue gives every one
// of them 90.9 x 186.25 x 74.85 cm and 654 L; the steel bodies (22457, 22458, 22459) and the black-interior Duo Noir
// Obsidian (22462) are left out (NOTES.md).
// Built to Whirlpool's published size, 909 W x 1862.5 H x 748.5 D mm, from Whirlpool's gallery for these codes (straight
// fronts, 3/4 size pictures, the open and stocked views, the door display close-up). No manual is published, so every
// other size is read off those photos (NOTES.md: 0.564 px/mm on the straight front, 0.4715 px/mm on the open view's front
// plane). Four doors: two French doors over the fridge (424 L); under them the freezer (115 L, left) and the convertible
// compartment (115 L, right), each behind its own door, split by a fixed divider. The lower doors carry the steel handle
// strip along their tops; the left fridge door carries the "Door UI" display on its free edge, seen with the door open.
// Inside the fridge: the two ceiling LEDs, the 360° Triple Cooling panel on the back wall, two glass shelves, the glass
// cover over two crisper drawers; four baskets on the left door, three on the right. In the freezer: the ice twister over
// its ice bank on the top tray, a deep drawer and a bottom drawer; in the convertible: the beverage rack on the top tray, a
// shallow tray and a bottom drawer; three baskets on each lower door. Stocked for a south Indian kitchen.
// Moving parts (STANDARD.md allows four): both fridge doors on one button (`fridge`: LeftFridgeDoor and, through its
// `also`, RightFridgeDoor on its own hinge), the two crisper drawers with their food (FridgeTrays), the freezer door and the
// convertible door.
// usage: node make_whirlpool_22461.mjs <products.json> <tex dir> <out.glb>
import fs from "node:fs";
import { THREE, mat, mesh, box, group, flipV, stateClips, exportGLB, productParts, saveZones } from "./lib.mjs";
import { Food } from "./food.mjs";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { NodeIO } from "@gltf-transform/core";
import { ALL_EXTENSIONS, KHRMaterialsVariants, KHRMaterialsClearcoat } from "@gltf-transform/extensions";

const [PRODUCTS, TEX, OUT] = process.argv.slice(2);
const ID = "whirlpool-22461";
const T = `${TEX}/whirlpool_22461`;

// ── size (metres): Whirlpool's 909 x 1862.5 x 748.5 mm; the rest read off Whirlpool's photos (NOTES.md) ──
const W = 0.909, H = 1.8625, D = 0.7485;
const zBack = -D / 2;              // the back panel (no rear photo: flat, no spacers)
const zF0 = D / 2;                 // door fronts
const doorT = 0.072;               // door thickness: the open view's door edge, 58 mm seen at about 20 degrees (ESTIMATED)
const zDoor = zF0 - doorT;         // door back face
const zCab = zDoor - 0.012;        // cabinet front, 12 mm behind the doors (the gasket; ESTIMATED)
const eH = 0.004, zPiv = zDoor + 0.006, ANG = 115; // hinge axis 4 mm inside each side, 6 mm in front of the doors' backs
// (so the Door UI display has the left door's free edge in front of the seam fin); doors open 115 deg (open views, ESTIMATED)
const xOut = W / 2, xIn = 0.38;    // outer sides; inner walls (open view: shelves 755 mm across the front plane)
const yBot = 0.032, yTop = 1.815;  // cabinet bottom (the doors' foot) and top (open view: the top frame at 1816 mm)
const yCeil = 1.771, yFrFloor = 0.887, yRail0 = 0.793, yFzFloor = 0.110; // open view, front plane
const zIn1 = zBack + 0.07;         // the inner back wall (ESTIMATED)
const zStep = zIn1 + 0.20, yStep = 0.30; // the step over the compressor bay behind the bottom drawers (ESTIMATED)
const yBay = 0.26;                 // the bay's top: 170 mm deep behind the back wall line, 228 mm high (ESTIMATED)
// doors (straight front at 0.564 px/mm): upper 844.7 to 1862.5 mm; lower 32 to 802 mm, a 2.8 mm groove, then the
// handle strip 804.8 to 839.4 mm; the 5.3 mm gap above it
const yU0 = 0.8447, yL0 = 0.032, yL1 = 0.802, yB0 = 0.8048, yB1 = 0.8394;
const gap = 0.005;                 // each door's front stops 5 mm from the middle: a 10 mm seam (front: 625.5 to 631.5 px)
const div = 0.0345;                // the freezer's divider, 69 mm wide (open view)
const sh1 = 1.533, sh2 = 1.313, shC = 1.065; // two glass shelves and the crisper cover (open view)
const dykeU = 0.04, dykeL = 0.03, bDep = 0.10; // door liners and basket depth (ESTIMATED)
const frFront = zDoor - dykeU - bDep - 0.01;   // shelves and drawers stop 1 cm short of the shut doors' baskets
const fzFront = zDoor - dykeL - bDep - 0.01;   // the freezer's trays and drawers, 1 cm short of the lower doors' baskets
const HAIR = 0.1;                  // the hairline normal map's tile: 100 mm (lib.mjs GRAIN)
const FZL = { x0: -xIn, x1: -div }, FZR = { x0: div, x1: xIn };
// the finishes (tuned on the gate's renders against Whirlpool's photos, NOTES.md): glass is a deep base under a glass coat
// (clear coat 1.0 at 0.05); Duo Noir's lower doors are dark brushed steel (no coat, rough 0.75)
const GLASS = { metal: 0, rough: 0.6, coat: [1, 0.05] };
const DARKSTEEL = { metal: 0.38, rough: 0.75 };

// ── materials (base finish: Duo Noir; the other colours swap the ones listed in FINISHES) ──
const doorU = mat("DoorUpper", 0x0b0b0c, { metal: GLASS.metal, rough: GLASS.rough });
const doorL = mat("DoorLower", 0x3a3b3e, { metal: DARKSTEEL.metal, rough: DARKSTEEL.rough });
const doorEdge = mat("DoorEdge", 0x1b1c1e, { metal: 0.3, rough: 0.45 });
const barM = mat("HandleStrip", 0x55575b, { metal: 0.6, rough: 0.32 });
const grooveM = mat("HandleGroove", 0x101012, { rough: 0.7 });
const doorBack = mat("DoorLiner", 0xeef0f2, { rough: 0.55 });
const sideSteel = mat("SideSteel", 0x26272a, { metal: 0.3, rough: 0.5 });
const topSteel = mat("TopSteel", 0x262729, { metal: 0.15, rough: 0.7 });
const frameM = mat("CabFrame", 0x1e1f21, { metal: 0.2, rough: 0.6 });
const rearM = mat("RearPanel", 0x232426, { metal: 0.1, rough: 0.7 });
const darkM = mat("HingeDark", 0x1f2022, { rough: 0.6 });
const pinM = mat("Pin", 0xc4c7cb, { metal: 0.9, rough: 0.3 });
const hingeM = mat("HingeSilver", 0xb9bcc0, { metal: 0.85, rough: 0.3 });
const markM = mat("WhirlpoolMark", 0xffffff, { rough: 0.5, opacity: 0.999 });
const sixthM = mat("SixthSenseMark", 0xffffff, { rough: 0.5, opacity: 0.999 });
const uiM = mat("DoorUI", 0xffffff, { metal: 0.4, rough: 0.3 });
const liner = mat("Liner", 0xf1f3f5, { rough: 0.6 });
const linerSide = mat("LinerSide", 0xe4e8ec, { rough: 0.65 });
const linerGrey = mat("LinerGrey", 0xd3d7dc, { rough: 0.6 });
const gasket = mat("Gasket", 0x2c2e31, { rough: 0.85 });
const ventBlack = mat("VentBlack", 0x1c1d20, { rough: 0.7 });
const clear = mat("ClearPlastic", 0xc3d0da, { rough: 0.12, opacity: 0.5, side: THREE.DoubleSide });
const clearLight = mat("ClearPlasticLight", 0xdfe7ee, { rough: 0.12, opacity: 0.26, side: THREE.DoubleSide });
const clearRib = mat("ClearRib", 0xeef3f7, { rough: 0.3 });
const glass = mat("TemperedGlass", 0xa9cdd6, { rough: 0.05, opacity: 0.55, side: THREE.DoubleSide });
const chrome = mat("ChromeTrim", 0xc4c7cb, { metal: 1, rough: 0.2 });
const edgeGreen = mat("GlassEdge", 0x7fa7b0, { rough: 0.3 });
const white = mat("WhitePlastic", 0xf6f7f8, { rough: 0.45 });
const panel360 = mat("Panel360", 0xffffff, { rough: 0.45 });
const woodM = mat("BeverageRackWood", 0xd6a85c, { rough: 0.6 });
const lightM = mat("Led", 0xffffff, { emissive: 0xf4f8ff, emissiveIntensity: 1.5 });
const footM = mat("Foot", 0x131416, { rough: 0.7 });
const cordM = mat("Cord", 0x1d1e20, { rough: 0.6 });
const plugM = mat("PlugBody", 0x1a1b1d, { rough: 0.55 });
const grilleM = mat("BayGrille", 0x18191b, { rough: 0.8 });
const printCrisp = mat("print_crisper", 0xffffff, { rough: 0.6, opacity: 0.999 });
const printFz = mat("print_fzdrawer", 0xffffff, { rough: 0.6, opacity: 0.999 });
const printArctic = mat("print_arctic", 0xffffff, { rough: 0.6, opacity: 0.999 });

// ── small builders ──
const cyl = (name, rt, rb, h, m, x, y, z, seg = 14) => mesh(name, new THREE.CylinderGeometry(rt, rb, h, seg), m, x, y, z);
const plane = (name, w, h, m, x, y, z) => mesh(name, flipV(new THREE.PlaneGeometry(w, h)), m, x, y, z);
const span = (name, x0, x1, y0, y1, z0, z1, m) => mesh(name, new THREE.BoxGeometry(x1 - x0, y1 - y0, z1 - z0), m, (x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2);
// the doors' inside parts lean 2 degrees in plan, their backs toward the hinge, so no side is seen exactly edge-on through
// a shut door (the LG GV-B23's lesson: headless Chrome drew such sides as thin light lines)
const LEAN = Math.tan(THREE.MathUtils.degToRad(2));
function lean(o, dir) {
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
function rrect(u0, u1, v0, v1, r, sh = new THREE.Shape()) {
  sh.moveTo(u0 + r, v0); sh.lineTo(u1 - r, v0); sh.quadraticCurveTo(u1, v0, u1, v0 + r); sh.lineTo(u1, v1 - r);
  sh.quadraticCurveTo(u1, v1, u1 - r, v1); sh.lineTo(u0 + r, v1); sh.quadraticCurveTo(u0, v1, u0, v1 - r); sh.lineTo(u0, v0 + r);
  sh.quadraticCurveTo(u0, v0, u0 + r, v0);
  return sh;
}

const root = group("Whirlpool22461");
const cab = group("Cabinet");
root.add(cab);

// ── cabinet shell: black painted steel sides and top (Whirlpool's 3/4 views), the white liner inside ──
for (const s of [-1, 1]) {
  cab.add(span(s > 0 ? "SideRight" : "SideLeft", s > 0 ? xIn : -xOut, s > 0 ? xOut : -xIn, yBot, yTop, zBack, zCab,
    s > 0 ? [sideSteel, linerSide, topSteel, footM, frameM, rearM] : [linerSide, sideSteel, topSteel, footM, frameM, rearM]));
}
cab.add(span("Top", -xIn, xIn, yCeil, yTop, zBack, zCab, [topSteel, topSteel, topSteel, liner, frameM, rearM]));
cab.add(span("MidRail", -xIn, xIn, yRail0, yFrFloor, zIn1, zCab, [liner, liner, liner, liner, liner, liner]));
// a dark band on the rail's face behind the 5 mm gap between the door pairs (and where it crosses the seam), as Whirlpool's
// front reads there; the white liner lit through the gap showed as a bright spot at the doors' meeting point
cab.add(span("MidRailGapBand", -xIn, xIn, yB1 - 0.006, yU0 + 0.006, zCab + 0.0002, zCab + 0.0008, frameM));
cab.add(span("Base", -xIn, xIn, yBot, yFzFloor, zIn1 + 0.1, zCab, [liner, liner, liner, footM, liner, liner]));
cab.add(span("BackWall", -xIn, xIn, yBay, yCeil, zBack + 0.012, zIn1, [liner, liner, liner, liner, liner, rearM]));
cab.add(span("DividerFz", -div, div, yFzFloor, yRail0, zIn1, zCab, [linerSide, linerSide, liner, liner, liner, liner]));
cab.add(span("CompressorStep", -xIn, xIn, yBay, yStep, zIn1 - 0.002, zStep, liner));          // 2 mm into the back wall: no shared face
cab.add(span("CompressorStepFront", -xIn + 0.001, xIn - 0.001, yFzFloor - 0.002, yBay + 0.002, zIn1 + 0.098, zStep, liner)); // 2 mm into the base, the step and the bay's back: no shared face
// the cabinet's front: the black top frame over the fridge (open view: 1771 to 1816 mm) with its two small door
// sensors, the black plinth under the freezer (32 to 77 mm) and a white sill over it (77 to 110 mm)
for (const x of [-0.31, 0.31]) cab.add(cyl("DoorSensor", 0.003, 0.003, 0.002, ventBlack, x, 1.802, zCab + 0.0008, 10).rotateX(Math.PI / 2));
cab.add(span("Plinth", -xIn, xIn, yBot, 0.077, zCab, zCab + 0.002, footM));
// the back: no photo of it (Whirlpool publishes none): a flat dark panel with the compressor bay low down behind a
// grille, the cord coming out at the bay's top right and the plug clipped beside it inside the bay (route ESTIMATED;
// nothing of it shows from the front, 3/4 or side)
cab.add(span("RearPanel", -xIn, xIn, yBay, yTop, zBack, zBack + 0.012, rearM));
cab.add(span("BayBack", -xIn, xIn, yBot, yBay, zIn1 + 0.096, zIn1 + 0.1, rearM));
cab.add(span("BayFloor", -xIn, xIn, yBot, yBot + 0.003, zBack, zIn1 + 0.096, rearM));
{
  const bay = group("CompressorBay", 0, 0, 0);
  bay.add(span("BayCompressorBase", -0.27, -0.05, yBot + 0.003, yBot + 0.013, zBack + 0.03, zIn1 + 0.08, darkM));
  bay.add(cyl("BayCompressor", 0.07, 0.07, 0.14, darkM, -0.16, yBot + 0.083, (zBack + zIn1 + 0.11) / 2, 18));
  // the grille across the bay's back: slats 8 mm high, 10 mm apart (ESTIMATED; the bay itself is the usual layout)
  for (let y = yBot + 0.012; y < yBay - 0.02; y += 0.018) bay.add(span("BayGrilleSlat", -xIn + 0.02, xIn - 0.02, y, y + 0.008, zBack, zBack + 0.006, grilleM));
  bay.add(span("BayGrilleFrame", -xIn, -xIn + 0.02, yBot + 0.003, yBay, zBack, zBack + 0.008, grilleM));
  bay.add(span("BayGrilleFrame", xIn - 0.02, xIn, yBot + 0.003, yBay, zBack, zBack + 0.008, grilleM));
  bay.add(span("BayGrilleFrame", -xIn + 0.02, xIn - 0.02, yBay - 0.012, yBay, zBack, zBack + 0.008, grilleM));
  cab.add(bay);
  const pts = [[0.24, yBay - 0.03, zIn1 + 0.096], [0.24, yBay - 0.05, zIn1 + 0.07], [0.25, 0.15, zIn1 + 0.05], [0.27, 0.06, zIn1 + 0.03], [0.3, yBot + 0.012, zBack + 0.13]]
    .map(([x, y, z]) => new THREE.Vector3(x, y, z));
  cab.add(mesh("PowerCord", new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts, false, "centripetal"), 40, 0.004, 6, false), cordM));
  // the Indian 3-pin plug (as the LG 343 L's): a 45 x 42 mm body, 16 mm deep with its bevel, lying face up on the bay
  // floor, its three pins (r 2.6 mm) up
  const pg = group("Plug", 0.30, yBot + 0.003, zBack + 0.09);
  const sh = rrect(-0.0205, 0.0205, -0.019, 0.019, 0.006);
  pg.add(mesh("PlugBody", new THREE.ExtrudeGeometry(sh, { depth: 0.012, bevelEnabled: true, bevelSize: 0.002, bevelThickness: 0.002, bevelSegments: 2, curveSegments: 5 }).rotateX(Math.PI / 2), plugM, 0, 0.014, 0));
  for (const [px, pz] of [[0, 0.0105], [-0.0095, -0.0065], [0.0095, -0.0065]]) pg.add(cyl("PlugPin", 0.0026, 0.0026, 0.018, pinM, px, 0.016 + 0.009, pz, 10));
  cab.add(pg);
}
// top hinge covers over the outer corners (3/4 size picture: standing 19 mm under the doors' top, sloping back), the
// hinge arm into the gasket gap
for (const s of [-1, 1]) {
  const xa = s > 0 ? xOut - 0.075 : -xOut, xb = s > 0 ? xOut : -xOut + 0.075;
  const sh = new THREE.Shape();
  sh.moveTo(0, 0); sh.lineTo(0.15, 0); sh.lineTo(0.15, 0.012); sh.lineTo(0.06, H - 0.019 - yTop); sh.lineTo(0, H - 0.019 - yTop); sh.lineTo(0, 0);
  const g = new THREE.ExtrudeGeometry(sh, { depth: xb - xa, bevelEnabled: false }).rotateY(Math.PI / 2).translate(xa, yTop, zCab);
  cab.add(mesh("HingeTop", g, darkM));
  cab.add(span("HingeTopArm", xa + 0.012, xb - 0.012, yTop + 0.004, H - 0.024, zCab, zDoor - 0.003, darkM));
}
// the middle hinges between the upper and lower doors at each outer corner (open view: a silver plate on the rail) and the
// lower hinge brackets with the front feet under them (front: brackets 375 to 435 mm out, feet r 16 mm at 416 mm, 31 mm tall)
for (const s of [-1, 1]) {
  const xc = s * (xOut - 0.06);
  cab.add(span("HingeMidPlate", xc - 0.028, xc + 0.028, 0.828, 0.85, zCab, zCab + 0.003, hingeM));
  for (const dx of [-0.014, 0.014]) cab.add(cyl("HingeMidScrew", 0.0042, 0.0042, 0.003, pinM, xc + dx, 0.839, zCab + 0.0045, 12).rotateX(Math.PI / 2));
  cab.add(span("HingeMidArm", s > 0 ? xOut - 0.07 : -xOut + 0.003, s > 0 ? xOut - 0.003 : -xOut + 0.07, yB1 + 0.0012, yU0 - 0.0012, zCab, zPiv + 0.012, darkM));
  cab.add(cyl("HingeMidPin", 0.0035, 0.0035, yU0 - yB1 - 0.0004, pinM, s * (xOut - eH), (yB1 + yU0) / 2, zPiv, 14));
  cab.add(span("HingeLow", s > 0 ? 0.375 : -0.435, s > 0 ? 0.435 : -0.375, 0.0115, yL0 - 0.001, zCab - 0.05, zPiv + 0.02, darkM));
  cab.add(cyl("FootFront", 0.016, 0.017, 0.0115, footM, s * 0.416, 0.00575, zCab - 0.01, 18));
  cab.add(cyl("FootRear", 0.016, 0.017, yBot, footM, s * 0.40, yBot / 2, zBack + 0.06, 18));
}

// ── inside, fixed: lights, the 360 panel, shelves, the freezer lights ──
// two LED bars across the ceiling near the front (open view), the fan housing at the top of the back wall
for (const dz of [0.07, 0.1]) cab.add(span("FridgeLed", -0.19, 0.19, yCeil - 0.005, yCeil, zCab - dz - 0.008, zCab - dz, lightM));
// the 360° Triple Cooling panel standing out of the back wall, 351 mm wide, 1077 to 1696 mm (open view at the back
// wall's scale, 441 px/m), "360°" and "TRIPLE COOLING" printed on it; white here, brushed steel on Verde Cristallo and
// Nero Bianco (their open views)
{
  const pw = 0.351, ph = 1.696 - 1.077, yc = (1.077 + 1.696) / 2;
  const g = group("TripleCoolingPanel", 0, yc, zIn1);
  g.add(mesh("PanelBody", new THREE.ExtrudeGeometry(rrect(-pw / 2, pw / 2, -ph / 2, ph / 2, 0.012), { depth: 0.018, bevelEnabled: false, curveSegments: 4 }), white));
  g.add(plane("PanelFace", pw - 0.004, ph - 0.004, panel360, 0, 0, 0.0186));
  cab.add(g);
}
// shelf supports moulded in the side walls, at four heights (open view)
for (const y of [sh1, sh2, 1.42, 1.2]) for (const s of [-1, 1]) cab.add(span("SideLedge", s < 0 ? -xIn : xIn - 0.008, s < 0 ? -xIn + 0.008 : xIn, y - 0.02, y - 0.0075, zIn1 + 0.02, frFront - 0.03, linerSide));
function shelf(parent, name, x0, x1, y, front) {
  const g = group(name, 0, 0, 0);
  // the glass starts in front of the 360 panel (18 mm out of the back wall)
  g.add(span(name + "Glass", x0 + 0.004, x1 - 0.004, y - 0.003, y + 0.003, zIn1 + 0.022, front - 0.01, glass));
  g.add(span(name + "Trim", x0 + 0.004, x1 - 0.004, y - 0.006, y + 0.006, front - 0.01, front, chrome));
  g.add(span(name + "Edge", x0 + 0.004, x1 - 0.004, y - 0.005, y - 0.003, zIn1 + 0.022, zIn1 + 0.03, edgeGreen));
  g.add(span(name + "RailL", x0 + 0.004, x0 + 0.012, y - 0.007, y - 0.003, zIn1 + 0.03, front - 0.01, linerGrey));
  g.add(span(name + "RailR", x1 - 0.012, x1 - 0.004, y - 0.007, y - 0.003, zIn1 + 0.03, front - 0.01, linerGrey));
  parent.add(g);
}
shelf(cab, "FrShelf1", -xIn, xIn, sh1, frFront);
shelf(cab, "FrShelf2", -xIn, xIn, sh2, frFront);
shelf(cab, "CrisperCover", -xIn, xIn, shC, frFront);
// the freezer's and the convertible's lights: two in each ceiling (open view; Whirlpool: "dedicated freezer lights")
for (const c of [FZL, FZR]) for (const k of [0.3, 0.7]) {
  const xm = c.x0 + (c.x1 - c.x0) * k;
  cab.add(span("FreezerLed", xm - 0.032, xm + 0.032, yRail0 - 0.004, yRail0, zIn1 + 0.12, zIn1 + 0.14, lightM));
}

// a clear box: floor at y0 (its top), walls to y1, between x0 and x1, from zb to `front`; a chrome strip along the front's
// top (`rim`) or foot (`foot`), as Whirlpool's open view shows, and the print on its front
function drawer(parent, name, x0, x1, y0, y1, front, { zb = zIn1 + 0.012, printM = null, pw = 0, ph = 0, py = 0, rim = null, foot = null, leanIn = 0 } = {}) {
  const g = group(name + "Box", 0, 0, 0);
  g.add(span(name + "Floor", x0, x1, y0 - 0.004, y0, zb, front, clear));
  g.add(span(name + "Back", x0, x1, y0, y1, zb, zb + 0.004, clearLight));
  const wl = g.add(span(name + "WallL", x0, x0 + 0.004, y0, y1, zb + 0.004, front - 0.004, clear)).children.at(-1);
  const wr = g.add(span(name + "WallR", x1 - 0.004, x1, y0, y1, zb + 0.004, front - 0.004, clear)).children.at(-1);
  if (leanIn) lean(leanIn > 0 ? wr : wl, leanIn);
  g.add(span(name + "Front", x0, x1, y0, y1, front - 0.004, front, clearLight));
  if (rim) g.add(span(name + "Rim", x0, x1, rim[0], rim[1], front - 0.002, front + 0.003, chrome));
  else g.add(span(name + "Rim", x0, x1, y1 - 0.008, y1, front - 0.004, front + 0.002, clearRib));
  if (foot) g.add(span(name + "Foot", x0, x1, foot[0], foot[1], front - 0.002, front + 0.003, chrome));
  if (printM) g.add(plane(name + "Print", pw, ph, printM, (x0 + x1) / 2, py, front + 0.0007));
  parent.add(g);
  return g;
}
// the two crisper drawers under the glass cover (open view: chrome foot 906 to 925 mm, tops at 1055); both slide out
// with their food (FridgeTrays), since the fridge's one button opens both doors
const crY0 = 0.898, crY1 = 1.055;
const CRL = { x0: -xIn + 0.008, x1: -0.004 }, CRR = { x0: 0.004, x1: xIn - 0.008 };
const trays = group("FridgeTrays");
cab.add(trays);
for (const [c, nm] of [[CRL, "CrisperL"], [CRR, "CrisperR"]]) drawer(trays, nm, c.x0, c.x1, crY0, crY1, frFront, { foot: [0.906, 0.925], printM: printCrisp, pw: 0.058, ph: 0.016, py: 0.968 });
// freezer (left): the top tray with the ice bank and the ice twister over it, the deep drawer, the bottom drawer;
// convertible (right): the top tray with the beverage rack's wooden insert, a shallow tray, the bottom drawer
// (open view: top trays' chrome 579 to 600 mm, the deep drawer 356 to 555, the shallow tray's chrome 356 to 382, the
// bottom drawers 145 to 345 with their chrome rims 329 to 350)
const tY0 = 0.566, tY1 = 0.600, mdY0 = 0.36, mdY1 = 0.555, stY1 = 0.40, bdY0 = 0.149, bdY1 = 0.345;
for (const [c, nm, leanIn] of [[FZL, "Fz", 1], [FZR, "Cv", -1]]) {
  const x0 = c.x0 + 0.008, x1 = c.x1 - 0.008;
  drawer(cab, nm + "TopTray", x0, x1, tY0, tY1, fzFront, { rim: [0.579, 0.6], leanIn });
  if (nm === "Fz") drawer(cab, "FzDeepDrawer", x0, x1, mdY0, mdY1, fzFront, { rim: [0.54, 0.555], printM: printArctic, pw: 0.12, ph: 0.008, py: 0.424, leanIn });
  else drawer(cab, "CvShallowTray", x0, x1, mdY0, stY1, fzFront, { rim: [0.362, 0.382], leanIn });
  drawer(cab, nm + "BottomDrawer", x0, x1, bdY0, bdY1, fzFront, { zb: zStep + 0.01, rim: [0.329, 0.345], printM: printFz, pw: 0.058, ph: 0.016, py: 0.197, leanIn });
}
// the ice bank (a clear bin) on the freezer's top tray and the ice twister (white, two cube trays and a twist knob) over
// it, at the back left (open view: 165 mm across, up to 728 mm; depth ESTIMATED)
{
  const xc = FZL.x0 + 0.1, z0 = zIn1 + 0.03, z1 = zIn1 + 0.27;
  const g = group("IceTwister", 0, 0, 0);
  g.add(span("IceBankFloor", xc - 0.0825, xc + 0.0825, tY0, tY0 + 0.004, z0, z1, clear));
  for (const [a, b] of [[xc - 0.0825, xc - 0.0785], [xc + 0.0785, xc + 0.0825]]) g.add(span("IceBankSide", a, b, tY0 + 0.004, 0.668, z0, z1, clear));
  g.add(span("IceBankFront", xc - 0.0825, xc + 0.0825, tY0 + 0.004, 0.668, z1 - 0.004, z1, clearLight));
  g.add(span("IceTwisterBody", xc - 0.085, xc + 0.085, 0.672, 0.728, z0, z1, white));
  for (const dx of [-0.042, 0.042]) g.add(span("IceTwisterTray", xc + dx - 0.038, xc + dx + 0.038, 0.718, 0.729, z0 + 0.02, z1 - 0.02, linerGrey));
  g.add(cyl("IceTwisterKnob", 0.012, 0.012, 0.012, white, xc - 0.042, 0.70, z1 + 0.006, 14).rotateX(Math.PI / 2));
  g.add(cyl("IceTwisterKnob", 0.012, 0.012, 0.012, white, xc + 0.042, 0.70, z1 + 0.006, 14).rotateX(Math.PI / 2));
  cab.add(g);
}
// the beverage rack: a wooden board with four ribs across it on the convertible's top tray (open view; Whirlpool:
// "Statement Beverage Rack")
{
  const x0 = FZR.x0 + 0.02, x1 = FZR.x1 - 0.02, z0 = zIn1 + 0.04, z1 = fzFront - 0.03;
  const g = group("BeverageRack", 0, 0, 0);
  g.add(span("RackBoard", x0, x1, tY0, tY0 + 0.008, z0, z1, woodM));
  for (let i = 0; i < 4; i++) { const x = x0 + (x1 - x0) * (0.14 + i * 0.24); g.add(span("RackRib", x - 0.006, x + 0.006, tY0 + 0.008, tY0 + 0.02, z0, z1, woodM)); }
  cab.add(g);
}

// ── stock: vegetarian South Indian food, juices, water and soft drinks (the fitting helpers of the LG GV-B23's builder) ──
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
  eggTray: mat("EggTray", 0xf2f4f6, { rough: 0.5 }),
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
  const g = Math.max(0, (x1 - x0 - total) / (objs.length + 1));
  let x = x0 + g;
  objs.forEach((o, i) => {
    const b = bs[i];
    o.position.x += x - b.min.x;
    o.position.z += middle ? z - (b.min.z + b.max.z) / 2 : z - b.min.z;
    x += b.max.x - b.min.x + g;
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

// the fridge (Whirlpool's stocked view): snacks, batter and milk on the top shelf, the tiffin, tubs and melon on the second,
// fruit on the crisper cover, vegetables in the right crisper and onions, potatoes, brinjal and drumsticks in the left
{
  const SH = { hw: xIn - 0.02, z0: zIn1 + 0.03, z1: frFront - 0.0125 };
  // the 360 panel stands 18 mm out of the back wall over the middle of each shelf: the back row starts in front of it
  const SHP = { ...SH, z0: zIn1 + 0.05 };
  const rnr = carton("RnrBiryaniBox", "rnr_box_front", 0); rnr.rotation.x = -Math.PI / 2;
  const milk = pouch("NandiniMilk", "nandini_toned_milk");
  tray(cab, "FrShelf1Stock", 0, sh1 + 0.003, SHP, [
    [pouch("IdBatterPouch", "id_batter", true, 0.85), carton("MastiButtermilk", "amul_masti_buttermilk", 4), food.coconutHalf("CoconutHalf", 0, 0, 0, 1)],
    [rnr, milk],
  ], (g) => ["aavin_milk", "amul_taaza_pouch"].forEach((k, i) => g.add(at(pouch(i ? "AmulTaazaPouch" : "AavinMilk", k), milk.position.x, milk.position.z))));
  tray(cab, "FrShelf2Stock", 0, sh2 + 0.003, SHP, [
    [tiffin("Tiffin"), food.melonHalf("WatermelonHalf", 0, 0, 0, 1)],
    [tin("RnrBiryani", "rnr_tin_lid", 0.075, 0.06), paperTub("NandhanaPalace", "nandana_tub_wrap", 0.0525, 0.075), paperTub("NandhanaPalace2", "nandana_tub_wrap", 0.0525, 0.075)],
  ]);
  tray(cab, "CrisperCoverStock", 0, shC + 0.003, SHP, [
    [food.bananaBunch("Bananas", 0, 0, 0, 5, 1), food.grapes("Grapes", 0, 0, 0, 1), food.lemon("Lemon", 0, 0, 0, 1)],
    [...[1, 2].map((i) => food.apple("Apple", 0, 0, 0, i)), ...[3, 4].map((i) => food.orange("Orange", 0, 0, 0, i)),
      brick("AmulButter1", "amul_butter", 0.085, 0.032, 0.055, K.butter), brick("AmulCheese", "amul_cheese_slices", 0.12, 0.03, 0.12, K.cheese)],
  ]);
  // the crispers slide out (FridgeTrays). The right one's stock is split in two groups, "FreshZoneStock" (the heap) and
  // "Shelf1Stock" (the herbs and chillies on top): the trays page test finds both by name (as the LG GV-B23)
  const ceil = shC - 0.006 - 0.003;
  const v = [];
  for (let i = 0; i < 4; i++) v.push(at(food.carrot("Carrot", 0, 0, 0, i + 1), -0.13 + i * 0.03, -0.16));
  for (let i = 0; i < 6; i++) v.push(at(food.okra("LadiesFinger", 0, 0, 0, i + 1), 0.06 + (i % 3) * 0.025, 0.02 + Math.floor(i / 3) * 0.025));
  ["green", "green"].forEach((k, i) => v.push(at(food.capsicum("Capsicum", 0, 0, 0, k, i + 1), -0.1 + i * 0.09, 0.07)));
  ring(4, -0.08, 0.0, 0.06, 3).forEach(([x, z], i) => v.push(at(food.tomato("Tomato", 0, 0, 0, i + 1), x, z)));
  v.push(at(food.cauliflower("Cauliflower", 0, 0, 0, 1), 0.1, -0.12));
  for (let i = 0; i < 6; i++) v.push(at(food.chilli("GreenChilli", 0, 0, 0, i + 1), 0.1 + i * 0.006, 0.09));
  v.push(at(food.herb("Coriander", 0, 0, 0, "coriander", 1), -0.08, -0.24));
  const fz = heap(trays, "FreshZoneStock", (CRR.x0 + CRR.x1) / 2, { ...CRR, y0: crY0, front: frFront, ceil }, v);
  const top = group("Shelf1Stock", fz.position.x, fz.position.y, fz.position.z);
  trays.add(top);
  for (const o of fz.children.filter((c) => /^(Coriander|CurryLeaves|GreenChilli)/.test(c.name))) top.add(o);
  const w = [];
  for (let i = 0; i < 6; i++) w.push(at(food.onion("Onion", 0, 0, 0, i + 1), -0.1 + (i % 3) * 0.08, -0.2 + Math.floor(i / 3) * 0.07));
  for (let i = 0; i < 4; i++) w.push(at(food.potato("Potato", 0, 0, 0, i + 1), -0.1 + (i % 2) * 0.08, 0.0 + Math.floor(i / 2) * 0.06));
  for (let i = 0; i < 3; i++) w.push(at(food.potato("Potato", 0, 0, 0, i + 5), 0.08 + (i % 2) * 0.06, -0.02 + i * 0.05));
  heap(trays, "CrisperLStock", (CRL.x0 + CRL.x1) / 2, { ...CRL, y0: crY0, front: frFront, ceil }, w);
}
// the freezer: ice cream and peas on the top tray beside the ice bank, packs in the deep drawer and the bottom drawer;
// the convertible (Whirlpool's stocked view: bottles on the rack, a cake on the tray, frozen packs below) as the
// "Beverage Centre" its modes offer: cans and juice on the rack, paneer and curd on the shallow tray, parotta below
{
  const x0 = FZL.x0 + 0.008, x1 = FZL.x1 - 0.008, cx = (x0 + x1) / 2, hw = (x1 - x0) / 2 - 0.012;
  const icx = FZL.x0 + 0.1 + 0.0825 + 0.01; // right of the ice bank
  tray(cab, "FzTopTrayStock", (icx + x1) / 2, tY0, { hw: (x1 - icx) / 2 - 0.006, z0: zIn1 + 0.03, z1: fzFront - 0.0125 }, [
    [iceTub("AmulVanillaMagic", "amul_vanilla_magic_lid", 0.125, 0.085, 0.125)],
    [iceTub("AmulRajbhog", "amul_rajbhog_lid", 0.125, 0.085, 0.125)],
  ]);
  const f = [];
  f.push(at(pouch("FreshoGreenPeas", "fresho_green_peas", false, 0.9), -0.05, -0.08));
  f.push(at(pouch("ViswasParotta", "viswas_parotta", false, 0.8), 0.03, 0.02));
  f.push(at(pouch("NityaParotta", "nitya_parotta", false, 0.8), -0.03, -0.02));
  f.push(at(pouch("AmulPaneer", "amul_paneer", false, 0.8), 0.0, 0.1));
  heap(cab, "FzDeepDrawerStock", cx, { x0, x1, y0: mdY0, front: fzFront, ceil: tY0 - 0.006 - 0.004 }, f);
  const g = [];
  g.push(at(pouch("FreshoGreenPeas2", "fresho_green_peas", false, 0.9), -0.04, -0.02));
  g.push(at(pouch("ViswasParotta2", "viswas_parotta", false, 0.8), 0.04, 0.04));
  g.push(at(pouch("FreshoGreenPeas3", "fresho_green_peas", false, 0.9), 0.02, -0.05));
  heap(cab, "FzBottomDrawerStock", cx, { x0, x1, y0: bdY0, front: fzFront, zb: zStep + 0.01, ceil: mdY0 - 0.006 - 0.004 }, g);
  void hw;
}
{
  const x0 = FZR.x0 + 0.008, x1 = FZR.x1 - 0.008, cx = (x0 + x1) / 2;
  const cans = [[0x1b2d72, "thumsup_can", 0.105], [0xb82a20, "coke_label", 0.06], [0x1b2d72, "thumsup_can", 0.105], [0xb82a20, "coke_label", 0.06]];
  tray(cab, "CvTopTrayStock", cx, tY0 + 0.02, { hw: (x1 - x0) / 2 - 0.02, z0: zIn1 + 0.05, z1: fzFront - 0.04 }, [
    cans.map(([col, key, lh]) => food.can("Can", col, 0, 0, 0, brand(key), arcFor(asp(key, 1) * lh, 0.033), lh)),
    [carton("RealMango", "real_mango", 2), carton("RealMixedFruit", "real_mixed_fruit", 1)],
  ]);
  tray(cab, "CvShallowTrayStock", cx, mdY0, { hw: (x1 - x0) / 2 - 0.02, z0: zIn1 + 0.03, z1: fzFront - 0.0125 }, [
    [1, 2, 3].map((i) => cupWithLid("AmulMastiCup" + i, "amul_masti_dahi_lid", 0.04, 0.05)),
    [pouch("AmulPaneerCv", "amul_paneer", false, 0.8), brick("AmulButter2", "amul_butter", 0.085, 0.032, 0.055, K.butter)],
  ]);
  const f = [];
  f.push(at(pouch("NityaParotta2", "nitya_parotta", false, 0.8), -0.03, 0.0));
  f.push(at(pouch("FreshoGreenPeas4", "fresho_green_peas", false, 0.9), 0.04, -0.05));
  f.push(at(pouch("AmulPaneer2", "amul_paneer", false, 0.8), 0.0, 0.1));
  heap(cab, "CvBottomDrawerStock", cx, { x0, x1, y0: bdY0, front: fzFront, zb: zStep + 0.01, ceil: mdY0 - 0.006 - 0.004 }, f);
}

// ── doors: four. Each is a box with the colour's front (its own part of a whole-front texture, so a print or the light
// across the pair stays where Whirlpool's photo has it), dark edges and the white liner behind ──
const uvFront = (g, cx, cy, yA, yB) => {
  // BoxGeometry's +z face is vertices 16-19: u across the whole front (W), v down this region (yB at the top); the box
  // is centred on (cx, cy) in world x and y
  const pos = g.attributes.position, uv = g.attributes.uv;
  for (let i = 16; i < 20; i++) uv.setXY(i, (pos.getX(i) + cx + W / 2) / W, (yB - pos.getY(i) - cy) / (yB - yA));
  return g;
};
// a door hinged at its outer side s (-1 left, +1 right); the group sits on the hinge axis, parts are given in world x, z
function door(name, s, ya, yb, build) {
  const xH = s * (xOut - eH);
  const g = group(name, xH, 0, zPiv);
  const ls = (nm, x0, x1, y0, y1, z0, z1, m) => { const o = lean(span(nm, x0 - xH, x1 - xH, y0, y1, z0 - zPiv, z1 - zPiv, m), s); g.add(o); return o; };
  const sp = (nm, x0, x1, y0, y1, z0, z1, m) => { const o = span(nm, x0 - xH, x1 - xH, y0, y1, z0 - zPiv, z1 - zPiv, m); g.add(o); return o; };
  // a dark fin in the seam at the hinge's depth, where neither door gains on the other as it swings (the LG GV-B23's
  // method): the left door's to 0.5 mm right of the middle, the right door's from 0.7 mm; behind the 10 mm seam it
  // reads dark grey, as Whirlpool's front shows
  const fin = s < 0 ? [-gap - 0.001, 0.0005, zPiv - 0.0025, zPiv + 0.0025] : [0.0007, gap + 0.001, zPiv - 0.0025, zPiv + 0.0025];
  sp(name + "SeamFin", fin[0], fin[1], ya + 0.004, yb - 0.004, fin[2], fin[3], ventBlack);
  build(g, { xH, ls, sp, X: (x) => x - xH, Z: (z) => z - zPiv });
  return g;
}
function gaskets(ls, xs0, xs1, xh0, xh1, yb0, yt1) {
  const z0 = zCab + 0.0005, z1 = zDoor;
  const lo = Math.min(xs0, xh0), hi = Math.max(xs1, xh1);
  ls("GasketTop", lo, hi, yt1 - 0.016, yt1, z0, z1, gasket);
  ls("GasketBottom", lo, hi, yb0, yb0 + 0.016, z0, z1, gasket);
  ls("GasketSeam", xs0, xs1, yb0 + 0.016, yt1 - 0.016, z0, z1, gasket);
  ls("GasketHinge", xh0, xh1, yb0 + 0.016, yt1 - 0.016, z0, z1, gasket);
}
const zDykeU = zDoor - dykeU, zDykeL = zDoor - dykeL;
// a door basket: floor, ends and lip in clear plastic, the rib along its top. No back: it would lie on the dyke's face
// (and each see-through piece is its own mesh twice over in the Apple file, so the budget goes to the ones seen)
function basket(g, xH, name, x0, x1, y, dep, h, zD) {
  zD -= zPiv;
  const b = group(name, (x0 + x1) / 2 - xH, y, zD), w = x1 - x0;
  b.add(box(name + "Floor", w, 0.004, dep, clear, 0, 0.002, -dep / 2));
  b.add(box(name + "Lip", w, h * 0.85, 0.004, clear, 0, h * 0.425, -dep + 0.002));
  b.add(box(name + "EndL", 0.004, h, dep - 0.008, clear, -w / 2 + 0.002, h / 2, -dep / 2));
  b.add(box(name + "EndR", 0.004, h, dep - 0.008, clear, w / 2 - 0.002, h / 2, -dep / 2));
  b.add(box(name + "Rim", w, 0.006, 0.006, clearRib, 0, h - 0.003, -dep + 0.003));
  for (const c of b.children) lean(c, Math.sign(xH));
  g.add(b);
  return { x0: x0 - xH + 0.006, x1: x1 - xH - 0.006, zm: zD - dep / 2, y: y + 0.004 };
}
const row = (g, inside, items) => { items.forEach((o) => { face(o); o.position.y = inside.y; g.add(o); }); lineUp(items, inside.x0, inside.x1, inside.zm, { middle: true }); };
const mx = (s, a, b) => (s > 0 ? [a, b] : [-b, -a]);   // an x span given for the right door, mirrored for the left

// the fridge doors (upper): glass fronts; baskets read off the open view (left door: floors 1613, 1442, 1232, 926 mm;
// right door: 1607, 1334, 926), the bottom ones taller for bottles
const UPPER_BASK = { "-1": [[1.613, 0.07], [1.442, 0.07], [1.232, 0.075], [0.926, 0.11]], "1": [[1.607, 0.075], [1.334, 0.09], [0.926, 0.11]] };
function fridgeDoor(name, s) {
  return door(name, s, yU0, H, (g, { xH, ls, sp }) => {
    const xa = s > 0 ? gap : -xOut, xb = s > 0 ? xOut : -gap;
    g.add(mesh(name + "Body", uvFront(new THREE.BoxGeometry(xb - xa, H - yU0, doorT), (xa + xb) / 2, (yU0 + H) / 2, yU0, H), [doorEdge, doorEdge, doorEdge, doorEdge, doorU, doorBack], (xa + xb) / 2 - xH, (yU0 + H) / 2, (zDoor + zF0) / 2 - zPiv));
    gaskets(ls, ...mx(s, 0.012, 0.028), ...mx(s, 0.43, 0.446), 0.871, yTop - 0.004);
    ls("DoorLinerPlate", ...mx(s, 0.028, 0.43), 0.887, yTop - 0.02, zDoor - 0.002, zDoor - 0.0002, doorBack);
    ls("FrDoorDyke", ...mx(s, 0.035, 0.37), 0.9, 1.76, zDykeU, zDoor - 0.002, doorBack);
    const bs = UPPER_BASK[s].map(([y, h], i) => basket(g, xH, `FrBasket${s < 0 ? "L" : "R"}${i + 1}`, ...mx(s, 0.04, 0.365), y, bDep, h, zDykeU));
    build[s](g, bs, xH, sp);
  });
}
const build = {
  // the left fridge door: the 6th Sense mark at its top left (3/4 size pictures: the "6" 28 to 46 mm in, 59 to 83 mm down;
  // its art is 40 x 34 mm with the "6" 2 mm in and 2 mm down) and the Door UI display on its free edge (Whirlpool's open
  // view at 0.485 px/mm there, and the "100+ customisable modes" close-up): the edge's whole 60 mm in front of the seam
  // fin, 1385 to 1633 mm
  "-1": (g, bs, xH, sp) => {
    g.add(plane("SixthSenseDecal", 0.04, 0.034, sixthM, -xOut + 0.046 - xH, H - 0.074, zF0 + 0.0007 - zPiv));
    const ui = plane("DoorUIDisplay", 0.06, 0.248, uiM, -gap + 0.0007 - xH, 1.509, (zPiv + 0.0035 + zF0 - 0.0025) / 2 - zPiv);
    ui.rotation.y = Math.PI / 2;
    g.add(ui);
    row(g, bs[0], [brandJar("MothersPickle", "mothers_mango_pickle", 0.036, 0.07, K.jarGreen, K.goldLid), brandJar("MothersPickle2", "mothers_mango_pickle", 0.036, 0.07, K.jarGreen, K.goldLid),
      brandJar("AavinGhee", "aavin_ghee_jar", 0.034, 0.07, K.amber, K.goldLid)]);
    row(g, bs[1], [brandJar("MothersPickle3", "mothers_mango_pickle", 0.036, 0.07, K.jarGreen, K.goldLid), pouch("SakthiSambar", "sakthi_sambar_powder", true, 0.8), brandJar("AavinGhee2", "aavin_ghee_jar", 0.034, 0.07, K.amber, K.goldLid)]);
    row(g, bs[2], [carton("MastiButtermilk2", "amul_masti_buttermilk", 4), carton("AmulTaaza", "amul_taaza_carton", 3), pouch("SakthiSambar3", "sakthi_sambar_powder", true, 0.8)]);
    row(g, bs[3], [1, 2, 3].map((i) => petBrand("Coke" + i, "coke_label", 0.036, 0.24, 0x2a1408, 0xc42b22)));   // 750 ml: the basket above leaves 302 mm
  },
  // the right fridge door: the Whirlpool mark at its top right (straight front: 815 to 854 px, 109 to 121 px), the egg
  // tray (in the box) in its top basket
  "1": (g, bs, xH) => {
    g.add(plane("WhirlpoolMarkDecal", 0.0695, 0.0215, markM, (815 + 854) / 2 / 0.5644 / 1000 - (629 / 0.5644 / 1000) - xH, H - ((109 + 121) / 2 - 75.5) / 0.5635 / 1000, zF0 + 0.0007 - zPiv));
    const e = bs[0];
    const et = group("EggTray", (e.x0 + e.x1) / 2, e.y, e.zm);
    et.add(box("EggTrayBody", 0.25, 0.012, 0.07, K.eggTray, 0, 0.006, 0));
    g.add(et);
    for (let i = 0; i < 5; i++) { const o = food.egg("Egg", (e.x0 + e.x1) / 2 - 0.1 + i * 0.05, e.y + 0.012, e.zm, i + 1); g.add(o); }
    row(g, bs[1], [carton("RealMango2", "real_mango", 2), carton("AmulTaaza2", "amul_taaza_carton", 3), carton("RealMango3", "real_mango", 2)]);
    row(g, bs[2], [petBrand("Bisleri", "bisleri_label", 0.0345, 0.265, 0xcfe9f7, 0x1a6fb0, 0.6), petBrand("Bisleri2", "bisleri_label", 0.0345, 0.265, 0xcfe9f7, 0x1a6fb0, 0.6),
      petBrand("Bisleri3", "bisleri_label", 0.0345, 0.265, 0xcfe9f7, 0x1a6fb0, 0.6)]);
  },
};
const fridgeDoorL = fridgeDoor("LeftFridgeDoor", -1);
const fridgeDoorR = fridgeDoor("RightFridgeDoor", 1);

// the lower doors: the colour's front (Duo Noir: brushed black steel), the groove and the steel handle strip along the
// top (Whirlpool: "Door Handle Type: Glass + Stainless Steel"), standing 3 mm proud with a rounded front; three baskets
// each (open view: floors 601, 373 and 125 mm)
const LOWER_BASK = [[0.601, 0.07], [0.373, 0.07], [0.125, 0.075]];
function lowerDoor(name, s, fill) {
  return door(name, s, yL0, yB1, (g, { xH, ls, sp }) => {
    const xa = s > 0 ? gap : -xOut, xb = s > 0 ? xOut : -gap;
    g.add(mesh(name + "Body", uvFront(new THREE.BoxGeometry(xb - xa, yL1 - yL0, doorT), (xa + xb) / 2, (yL0 + yL1) / 2, yL0, yL1), [doorEdge, doorEdge, doorEdge, doorEdge, doorL, doorBack], (xa + xb) / 2 - xH, (yL0 + yL1) / 2, (zDoor + zF0) / 2 - zPiv));
    sp(name + "Groove", xa + 0.001, xb - 0.001, yL1, yB0, zDoor, zF0 - 0.006, grooveM);
    // the strip: its side profile (z, y) run across the door
    const r = 0.004, sh = new THREE.Shape();
    sh.moveTo(zDoor - zPiv, yB0); sh.lineTo(zF0 + 0.003 - r - zPiv, yB0); sh.quadraticCurveTo(zF0 + 0.003 - zPiv, yB0, zF0 + 0.003 - zPiv, yB0 + r);
    sh.lineTo(zF0 + 0.003 - zPiv, yB1 - r); sh.quadraticCurveTo(zF0 + 0.003 - zPiv, yB1, zF0 + 0.003 - r - zPiv, yB1); sh.lineTo(zDoor - zPiv, yB1); sh.lineTo(zDoor - zPiv, yB0);
    const pts = sh.getPoints(4).map((p) => new THREE.Vector2(-p.x, p.y));
    const strip = new THREE.ExtrudeGeometry(new THREE.Shape(pts), { depth: xb - xa - 0.001, bevelEnabled: false }).rotateY(Math.PI / 2).translate(xa + 0.0005 - xH, 0, 0);
    g.add(mesh(name + "HandleStrip", strip, barM));
    gaskets(ls, ...mx(s, 0.012, 0.028), ...mx(s, 0.43, 0.446), 0.088, yB1 - 0.03);
    ls("DoorLinerPlate", ...mx(s, 0.028, 0.43), 0.104, yB1 - 0.046, zDoor - 0.002, zDoor - 0.0002, doorBack);
    ls("FzDoorDyke", ...mx(s, 0.06, 0.37), 0.12, 0.775, zDykeL, zDoor - 0.002, doorBack);
    const bs = LOWER_BASK.map(([y, h], i) => basket(g, xH, `${name}Basket${i + 1}`, ...mx(s, 0.065, 0.365), y, bDep, h, zDykeL));
    fill(g, bs);
  });
}
const freezerDoor = lowerDoor("FreezerDoor", -1, (g, bs) => {
  row(g, bs[0], [brandJar("AavinGhee3", "aavin_ghee_jar", 0.034, 0.07, K.amber, K.goldLid), pouch("SakthiSambar2", "sakthi_sambar_powder", true, 0.8)]);
  row(g, bs[1], [pouch("FreshoGreenPeas5", "fresho_green_peas", true, 0.6), pouch("AmulPaneer3", "amul_paneer", true, 0.6)]);
});
const convertDoor = lowerDoor("ConvertibleDoor", 1, (g, bs) => {
  row(g, bs[0], [brick("AmulButter3", "amul_butter", 0.085, 0.032, 0.055, K.butter), brandJar("MothersPickle4", "mothers_mango_pickle", 0.036, 0.07, K.jarGreen, K.goldLid)]);
  const cans = [[0x1b2d72, "thumsup_can", 0.105], [0xb82a20, "coke_label", 0.06], [0x1b2d72, "thumsup_can", 0.105]];
  row(g, bs[2], cans.map(([col, key, lh]) => food.can("Can", col, 0, 0, 0, brand(key), arcFor(asp(key, 1) * lh, 0.033), lh)));
});
root.add(fridgeDoorL, fridgeDoorR, freezerDoor, convertDoor);

const parts = productParts(PRODUCTS, ID);
// the doors open 115 degrees: how far they reach across and forward
{
  const AXY = new THREE.Vector3(0, 1, 0), doors = [[fridgeDoorL, -ANG], [fridgeDoorR, ANG], [freezerDoor, -ANG], [convertDoor, ANG]];
  for (const [d, a] of doors) d.quaternion.setFromAxisAngle(AXY, THREE.MathUtils.degToRad(a));
  root.updateMatrixWorld(true);
  const bb = new THREE.Box3();
  for (const [d] of doors) bb.union(new THREE.Box3().setFromObject(d.getObjectByName(d.name + "Body")));
  console.log(`doors open ${ANG} deg: ${((bb.max.x - bb.min.x) * 1000).toFixed(0)} mm across, ${((bb.max.z - zBack) * 1000).toFixed(0)} mm deep`);
  for (const [d] of doors) d.quaternion.identity();
  root.updateMatrixWorld(true);
}
// what a slide may travel with its doors open: the open doors' baskets and food stand in front of the cabinet
{
  const AXY = new THREE.Vector3(0, 1, 0);
  for (const p of parts.filter((q) => q.slide)) {
    const outer = parts.find((q) => q.key === p.needs);
    const moved = [[outer.node, outer.angle], ...(outer.also || []).map((a) => [a.node, a.angle])].map(([n, a]) => [root.getObjectByName(n), a]);
    const sn = root.getObjectByName(p.node);
    for (const [dn, a] of moved) dn.quaternion.setFromAxisAngle(AXY, THREE.MathUtils.degToRad(a));
    root.updateMatrixWorld(true);
    const pts = [];
    for (const [dn] of moved) dn.traverse((c) => {
      if (!c.isMesh) return;
      c.geometry.computeBoundingBox();
      const b = c.geometry.boundingBox, n = [0, 1, 2].map((k) => Math.max(1, Math.ceil((b.max.getComponent(k) - b.min.getComponent(k)) / 0.01)));
      for (let i = 0; i <= n[0]; i++) for (let j = 0; j <= n[1]; j++) for (let k = 0; k <= n[2]; k++)
        pts.push(new THREE.Vector3(b.min.x + (b.max.x - b.min.x) * i / n[0], b.min.y + (b.max.y - b.min.y) * j / n[1], b.min.z + (b.max.z - b.min.z) * k / n[2]).applyMatrix4(c.matrixWorld));
    });
    const own = []; sn.traverse((c) => c.isMesh && own.push(new THREE.Box3().setFromObject(c)));
    for (const [dn] of moved) dn.quaternion.identity();
    root.updateMatrixWorld(true);
    let m = 1;
    for (const a of own) for (const v of pts) if (v.x > a.min.x - 0.002 && v.x < a.max.x + 0.002 && v.y > a.min.y - 0.002 && v.y < a.max.y + 0.002 && v.z >= a.max.z - 0.001) m = Math.min(m, v.z - a.max.z);
    console.log(`slide ${p.key}: ${p.slide[2]} m set, ${m.toFixed(3)} m before it meets the open ${outer.key} doors`);
  }
}
const clips = stateClips(root, parts);
saveZones(PRODUCTS, ID, root, parts);
const textures = {
  DoorLower: `${T}/door_dn_low.jpg`, WhirlpoolMark: `${T}/mark_whirlpool.png`, SixthSenseMark: `${T}/mark_6th.png`, DoorUI: `${T}/ui.jpg`,
  Panel360: `${T}/panel360_white.jpg`, print_crisper: `${T}/print_crisper.png`, print_fzdrawer: `${T}/print_fzdrawer.png`, print_arctic: `${T}/print_arctic.png`,
  ...food.textures(`${TEX}/food`),
  ...Object.fromEntries(Object.keys(labelMats).map((n) => [n, `${TEX}/brands/small/${n.slice(3)}.jpg`])),
};
// Grain (BENCHMARK.md section 10): Duo Noir's lower doors are brushed steel, the hairline running across the door (the
// straight front's streaks are horizontal); glass has none. The sides and top are smooth paint: the soft peel.
await exportGLB(root, clips, OUT, textures, { dir: `${TEX}/grain`, materials: {
  DoorLower: { type: "hairline", dir: "h" }, SideSteel: { type: "peel_soft" }, TopSteel: { type: "peel_soft" },
} });

// ── the colours as material variants (KHR_materials_variants). Duo Noir (22461, first: the base materials above, the glass
// coat added here), Nero Quartz (22460: black glass on all four doors), Verde Cristallo (22463: green marble glass, all
// four) and Nero Bianco (22464: grey marble glass over black glass), each from its own Whirlpool photos. The last two
// have the brushed steel 360 panel inside (their open views) and the 6th Sense mark with its "AI" badge (their size
// pictures); the rest of the inside, the back and the hinges are shared ──
const glassLow = (tex) => ({ tex, color: tex ? null : [11, 11, 12], metal: GLASS.metal, rough: GLASS.rough, coat: GLASS.coat, noGrain: true });
const FINISHES = [
  ["Duo Noir", {}],
  ["Nero Quartz", { DoorLower: glassLow(null) }],
  ["Verde Cristallo", {
    DoorUpper: { tex: `${T}/door_vc_up.jpg`, coat: GLASS.coat }, DoorLower: glassLow(`${T}/door_vc_low.jpg`),
    SixthSenseMark: { tex: `${T}/mark_6th_ai.png` },
    Panel360: { tex: `${T}/panel360_steel.jpg`, metal: 0.38, rough: 0.5 },
  }],
  ["Nero Bianco", {
    DoorUpper: { tex: `${T}/door_nb_up.jpg`, coat: GLASS.coat }, DoorLower: glassLow(null),
    SixthSenseMark: { tex: `${T}/mark_6th_ai.png` },
    Panel360: { tex: `${T}/panel360_steel.jpg`, metal: 0.38, rough: 0.5 },
  }],
];
{
  const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
  const doc = await io.readBinary(new Uint8Array(fs.readFileSync(OUT)));
  const ext = doc.createExtension(KHRMaterialsVariants);
  const lin = (c) => ((c / 255) <= 0.04045 ? c / 255 / 12.92 : Math.pow((c / 255 + 0.055) / 1.055, 2.4));
  const vs = FINISHES.map(([n]) => ext.createVariant(n));
  const cc = doc.createExtension(KHRMaterialsClearcoat);
  const coat = (m, [f, r]) => m.setExtension("KHR_materials_clearcoat", cc.createClearcoat().setClearcoatFactor(f).setClearcoatRoughnessFactor(r));
  coat(doc.getRoot().listMaterials().find((m) => m.getName() === "DoorUpper"), GLASS.coat);
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
      if (v.tex) { m.setBaseColorTexture(texOf(v.tex)); m.setBaseColorFactor([1, 1, 1, base.getBaseColorFactor()[3]]); }
      else if (v.color) { m.setBaseColorTexture(null); m.setBaseColorFactor([...v.color.map(lin), base.getBaseColorFactor()[3]]); }
      if (v.metal != null) m.setMetallicFactor(v.metal);
      if (v.rough != null) m.setRoughnessFactor(v.rough);
      if (v.noGrain) { m.setNormalTexture(null); m.setMetallicRoughnessTexture(null); }
      if (v.coat) coat(m, v.coat);
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
