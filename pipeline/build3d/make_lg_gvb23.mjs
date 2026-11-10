// LG GV-B23FFGMB, 574 L French door refrigerator (LG's product type "Multi Door"), glass doors in Black Mirror, with the
// same body in Prime Silver (GV-B23FFLMB, VCM doors) as a material variant (KHR_materials_variants). LG India sells this
// body in these two colours (LG's French door range page; the owner's manual MFL72119811 covers both codes).
// Built to LG's published size, 835 W x 1777 H x 736 D mm (LG's page and the owner's manual's table, Type B), from LG's
// gallery photos of both codes (straight fronts with their energy labels, three-quarter views, sides, open and close-ups)
// and the owner's manual (sizes D 635, F 1057 and G 1290 mm, the interior drawing on page 25 and the control panel on
// page 27). Four doors and no handles: two French doors over the fridge (401 L), the left one carrying the door mullion,
// each with a finger grip along its lower edge; two doors over the freezer (173 L), split by a fixed divider. Inside the
// fridge, as LG's open photos show: the DoorCooling+ outlet and Top LED in the ceiling, the air filter ("Multi Air Flow")
// on the back wall, two tempered glass shelves, the bottom shelf over the two Big Fresh Zone boxes, the Fresh Converter+
// pantry drawer under them, the control panel on the right wall and three clear baskets on each door. In each half of the
// freezer, a sliding tray over a drawer. Stocked for a south Indian kitchen.
// Moving parts (STANDARD.md allows four): both fridge doors, the right Big Fresh Zone box with its food (FridgeTrays: the
// only tray that can come out with one French door open; the shelves and the pantry drawer span both doors) and both
// freezer doors: the `freezer` part swings FreezerDoorL and, through its `also`, FreezerDoorR on its own hinge.
// usage: node make_lg_gvb23.mjs <products.json> <tex dir> <out.glb>
import fs from "node:fs";
import { THREE, mat, mesh, box, faced, group, flipV, stateClips, exportGLB, productParts, saveZones } from "./lib.mjs";
import { Food } from "./food.mjs";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { NodeIO } from "@gltf-transform/core";
import { ALL_EXTENSIONS, KHRMaterialsVariants, KHRMaterialsClearcoat } from "@gltf-transform/extensions";

const [PRODUCTS, TEX, OUT] = process.argv.slice(2);
const ID = "lg-gv-b23ffgmb";
const T = `${TEX}/lg_gvb23`;

// ── size (metres): LG's 835 x 1777 x 736 mm; the rest from the manual and LG's photos (NOTES.md) ──
const W = 0.835, H = 1.777, D = 0.736;
const zBack = -D / 2;              // the rear spacers at the top corners: the manual measures D and E from them
const zBody = zBack + 0.009;       // the back panel; the spacers stand 9 mm proud of it (side photo, ESTIMATED)
const zCab = zBack + 0.635;        // cabinet front: the manual's D, 635 mm (side photo: 639)
const zDoor = zCab + 0.016;        // door back face behind the gasket; the doors are 85 mm thick (side photo, 0.637 px/mm)
const zF0 = D / 2;                 // door fronts: the manual's E, 736 mm
// hinge axis 4 mm inside each outer side and 22 mm in front of the door's back face, doors open 115 degrees: together
// they give the manual's 1290 mm across and 1057 mm deep with the doors open (checked below); the side photo puts the
// top hinge pin about 67 mm behind the door front (this gives 63)
const eH = 0.004, zPiv = zDoor + 0.022, ANG = 115;
const xOut = W / 2, xIn = 0.36;    // outer sides; inner walls (open photo: opening about 720 mm wide)
const yBot = 0.021, yTop = 1.744;  // cabinet bottom and top (side photo: the doors stand 33 mm above the cabinet's top)
const yCeil = 1.692, yFrFloor = 0.713, yLip = 0.690, yRail0 = 0.632, yFzFloor = 0.077; // open photo, front plane
const zIn1 = zBody + 0.065;        // the inner back wall (ESTIMATED, as the LG GL-B257)
const zStep = zBody + 0.24, yStep = 0.30; // the compressor bay behind the freezer's lower drawers (ESTIMATED)
// doors: upper 685 to 1777 mm with the grip's bevel from 685 to 707 mm (front and side photos); lower 28 to 664 mm
const yU0 = 0.685, yUf = 0.707, yL0 = 0.028, yL1 = 0.664;
const pw = W / 2 - 0.0015;         // each door; a 3 mm seam between them (front photo)
const grip = 0.012;                // the grip's bevel runs 12 mm back under the door (side photo)
const div = 0.0225;                // the freezer's divider, 45 mm wide (open photo)
const sh1 = 1.471, sh2 = 1.264, shB = 1.005; // shelf levels (open photo): two glass shelves and the bottom shelf
const dykeU = 0.04, dykeL = 0.03, bDep = 0.10; // door liners and basket depth (ESTIMATED)
const frFront = zDoor - dykeU - bDep - 0.01;   // shelves and boxes stop 1 cm short of the shut doors' baskets
const pantryFront = zDoor - dykeU - 0.01;      // the pantry drawer sits under the lowest baskets
const fzFront = zDoor - dykeL - 0.004 - 0.01;  // freezer trays: 1 cm short of the door liner's ribs
const HAIR = 0.1;                  // the hairline normal map's tile: 100 mm (lib.mjs GRAIN.hairline_soft)
const FZL = { x0: -xIn, x1: -div }, FZR = { x0: div, x1: xIn };
// the doors' finishes (tuned on the gate's renders against LG's photos, NOTES.md): Black Mirror glass and Prime Silver's
// polished steel
const BM = { metal: 0, rough: 0.6, coat: [1, 0.05] };
const PS = { metal: 0.38, rough: 0.5, coat: [0.6, 0.3] };

// ── materials (base finish: Black Mirror; Prime Silver swaps the ones listed at the end) ──
// glass doors (LG: "Door (Material) Glass"): a deep black base under a glass coat (1.0 at roughness 0.05, set in the
// variants pass below), so the studio and the room show in them as a sharp reflection, as glass does. No grain, and no
// light baked in. Straight on they match LG's front; at the page's 3/4 the coat mirrors its studio light (NOTES.md)
const doorM = mat("DoorFront", 0x141416, { metal: BM.metal, rough: BM.rough });
const doorEdge = mat("DoorEdge", 0x1d1e21, { metal: 0.3, rough: 0.45 });
// the black trim (Black Mirror) that is silver on Prime Silver: door backs, the rails and divider fronts, the hinge covers
const trimM = mat("TrimDark", 0x1f2023, { metal: 0.25, rough: 0.5 });
const doorBack = mat("DoorLiner", 0xeef0f2, { rough: 0.55 });
const sideSteel = mat("SideSteel", 0x2e2f33, { metal: 0.3, rough: 0.5 });
const topSteel = mat("TopSteel", 0x2c2d30, { metal: 0.15, rough: 0.7 });
const frameM = mat("CabFrame", 0x2a2b2e, { metal: 0.2, rough: 0.6 });
const rearM = mat("RearPanel", 0x2b2c2f, { metal: 0.1, rough: 0.7 });
const darkM = mat("HingeDark", 0x26272a, { rough: 0.6 });
const pinM = mat("Pin", 0xc4c7cb, { metal: 0.9, rough: 0.3 });
const hingeM = mat("HingeSilver", 0xb9bcc0, { metal: 0.85, rough: 0.3 });
const labelM = mat("LabelBEE", 0xffffff, { rough: 0.5, opacity: 0.999 });
const logoM = mat("LgMark", 0xffffff, { rough: 0.5, opacity: 0.999 });
const liner = mat("Liner", 0xf1f3f5, { rough: 0.6 });
const linerSide = mat("LinerSide", 0xe4e8ec, { rough: 0.65 });
const linerGrey = mat("LinerGrey", 0xd3d7dc, { rough: 0.6 });
const gasket = mat("Gasket", 0x34363a, { rough: 0.85 });
const ventBlack = mat("VentBlack", 0x1c1d20, { rough: 0.7 });
const clear = mat("ClearPlastic", 0xc3d0da, { rough: 0.12, opacity: 0.5, side: THREE.DoubleSide });
const clearLight = mat("ClearPlasticLight", 0xdfe7ee, { rough: 0.12, opacity: 0.26, side: THREE.DoubleSide });
const clearRib = mat("ClearRib", 0xeef3f7, { rough: 0.3 });
const glass = mat("TemperedGlass", 0xa9cdd6, { rough: 0.05, opacity: 0.55, side: THREE.DoubleSide });
const glassRim = mat("ShelfRim", 0xe3e7ea, { rough: 0.45 });
const edgeGreen = mat("GlassEdge", 0x7fa7b0, { rough: 0.3 });
const white = mat("WhitePlastic", 0xf6f7f8, { rough: 0.45 });
const lightM = mat("Led", 0xffffff, { emissive: 0xf4f8ff, emissiveIntensity: 1.5 });
const footM = mat("Foot", 0x131416, { rough: 0.7 });
const skidM = mat("Skid", 0xb8babd, { metal: 0.5, rough: 0.4 });
const cordM = mat("Cord", 0x1d1e20, { rough: 0.6 });
const printMaf = mat("print_maf", 0xffffff, { rough: 0.45 });
const printBig = mat("print_bigfresh", 0xffffff, { rough: 0.6, opacity: 0.999 });
const printConv = mat("print_freshconv", 0xffffff, { rough: 0.6, opacity: 0.999 });
const printPanel = mat("print_panel", 0xffffff, { rough: 0.3 });

// ── small builders ──
const cyl = (name, rt, rb, h, m, x, y, z, seg = 14) => mesh(name, new THREE.CylinderGeometry(rt, rb, h, seg), m, x, y, z);
const plane = (name, w, h, m, x, y, z) => mesh(name, flipV(new THREE.PlaneGeometry(w, h)), m, x, y, z);
const span = (name, x0, x1, y0, y1, z0, z1, m) => mesh(name, new THREE.BoxGeometry(x1 - x0, y1 - y0, z1 - z0), m, (x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2);
function joined(name, boxes, m) {
  const geos = boxes.map(([x0, x1, y0, y1, z0, z1]) => new THREE.BoxGeometry(x1 - x0, y1 - y0, z1 - z0).translate((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2));
  return mesh(name, mergeGeometries(geos), m);
}
// the doors' inside parts lean 2 degrees in plan, their backs toward the hinge (a basket's 100 mm depth moves 3.5 mm),
// and so do the freezer drawers' inner walls, their backs into the divider. A side square to the doors and a few cm off
// the middle, seen exactly head-on, came through the shut door as a thin light line in headless Chrome's renders (sides
// within 0.5 degrees of the line of sight; gone at 0.8). The lean keeps every such side 2 degrees off
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
// a rounded rectangle Shape (u, v) with corner radius r
function rrect(u0, u1, v0, v1, r, sh = new THREE.Shape()) {
  sh.moveTo(u0 + r, v0); sh.lineTo(u1 - r, v0); sh.quadraticCurveTo(u1, v0, u1, v0 + r); sh.lineTo(u1, v1 - r);
  sh.quadraticCurveTo(u1, v1, u1 - r, v1); sh.lineTo(u0 + r, v1); sh.quadraticCurveTo(u0, v1, u0, v1 - r); sh.lineTo(u0, v0 + r);
  sh.quadraticCurveTo(u0, v0, u0 + r, v0);
  return sh;
}

const root = group("LGGVB23");
const cab = group("Cabinet");
root.add(cab);

// ── cabinet shell ──
// each side: a core 1.5 mm inside the outer face, and the painted skin over it with four slots cut through, so the
// slots LG's side photos show low at the back of both sides are 1.5 mm recesses (the photo lights them as recesses: dark
// along the top, light along the bottom). Slots measured on the side photo (0.637 px/mm across, 0.654 down): two long ones
// (176 mm) at 258-281 and 208-231 mm, two short ones (96 mm) at 156-180 and 106-130 mm, all from 444 mm behind the front
const SLOTS = [[0.258, 0.281, 0.176], [0.208, 0.231, 0.176], [0.156, 0.180, 0.096], [0.106, 0.130, 0.096]];
for (const s of [-1, 1]) {
  const xo = s * xOut, xs = s * (xOut - 0.0015);
  cab.add(span(s > 0 ? "SideRight" : "SideLeft", s > 0 ? xIn : -xOut + 0.0015, s > 0 ? xOut - 0.0015 : -xIn, yBot, yTop, zBody, zCab,
    s > 0 ? [sideSteel, linerSide, topSteel, footM, trimM, frameM] : [linerSide, sideSteel, topSteel, footM, trimM, frameM]));
  // the skin: drawn in (u, v) = (-z or z, y), extruded 1.5 mm outward along x by a quarter turn about y
  const u = (z) => (s > 0 ? -z : z);
  const sh = new THREE.Shape();
  sh.moveTo(u(zBody), yBot); sh.lineTo(u(zCab), yBot); sh.lineTo(u(zCab), yTop); sh.lineTo(u(zBody), yTop); sh.lineTo(u(zBody), yBot);
  const zs0 = zF0 - 0.444;
  for (const [y0, y1, len] of SLOTS) {
    const a = u(zs0), b = u(zs0 - len);
    sh.holes.push(rrect(Math.min(a, b), Math.max(a, b), y0, y1, 0.0105, new THREE.Path()));
  }
  const g = new THREE.ExtrudeGeometry(sh, { depth: 0.0015, bevelEnabled: false, curveSegments: 6 }).rotateY(s * Math.PI / 2);
  cab.add(mesh(s > 0 ? "SideSkinR" : "SideSkinL", g, sideSteel, xs, 0, 0));
}
cab.add(span("Top", -xIn, xIn, yCeil, yTop, zBody, zCab, [topSteel, topSteel, topSteel, liner, trimM, frameM]));
cab.add(span("MidRail", -xIn, xIn, yRail0, yLip, zBody, zCab, [liner, liner, liner, liner, trimM, frameM]));
cab.add(span("FridgeFloor", -xIn, xIn, yLip, yFrFloor, zBody, zCab, [liner, liner, liner, liner, liner, frameM]));
cab.add(span("Base", -xIn, xIn, yBot, yFzFloor, zBody, zCab, [liner, liner, liner, footM, trimM, frameM]));
cab.add(span("BackWallFz", -xIn, xIn, yFzFloor, yRail0, zBody, zIn1, [liner, liner, liner, liner, liner, frameM]));
cab.add(span("BackWallFr", -xIn, xIn, yFrFloor, yCeil, zBody, zIn1, [liner, liner, liner, liner, liner, frameM]));
cab.add(span("FreezerDivider", -div, div, yFzFloor, yRail0, zIn1, zCab, [linerSide, linerSide, liner, liner, trimM, liner]));
cab.add(span("CompressorStep", -xIn, xIn, yFzFloor, yStep, zIn1, zStep, liner));
// the back: no photo of it (LG publishes none for this model): a plain dark panel, the rear spacers at the top corners
// (the manual's top view), rollers under the back (side photo)
cab.add(span("RearPanel", -xOut, xOut, yBot, yTop, zBody - 0.003, zBody, [frameM, frameM, frameM, frameM, frameM, rearM]));
for (const s of [-1, 1]) cab.add(span("RearSpacer", s > 0 ? xOut - 0.13 : -xOut, s > 0 ? xOut : -xOut + 0.13, yTop - 0.043, yTop, zBack, zBody - 0.003, darkM));
// top hinge covers on the cabinet's top at the outer corners, level with the door tops (side photo: 126 mm long; 70 mm
// wide on the open photo), and the hinge arm in the gasket gap
for (const s of [-1, 1]) {
  const xa = s > 0 ? xOut - 0.07 : -xOut, xb = s > 0 ? xOut : -xOut + 0.07;
  cab.add(span("HingeTop", xa, xb, yTop, H - 0.0005, zCab - 0.126, zCab, trimM));
  cab.add(span("HingeTopArm", xa + 0.01, xb - 0.01, yTop + 0.004, H - 0.006, zCab, zDoor - 0.003, darkM));
}
// the middle hinges on the rail between the doors (open photos): a silver plate with two screws on the rail's face and a
// pin between the upper and lower doors at each outer corner
for (const s of [-1, 1]) {
  const xc = s * (xOut - 0.095);
  cab.add(span("HingeMidPlate", xc - 0.03, xc + 0.03, 0.643, 0.676, zCab, zCab + 0.003, hingeM));
  for (const dx of [-0.015, 0.015]) cab.add(cyl("HingeMidScrew", 0.0045, 0.0045, 0.003, pinM, xc + dx, 0.6595, zCab + 0.0045, 12).rotateX(Math.PI / 2));
  cab.add(span("HingeMidArm", s > 0 ? xOut - 0.07 : -xOut + 0.003, s > 0 ? xOut - 0.003 : -xOut + 0.07, yL1 + 0.004, yU0 - 0.004, zCab, zPiv + 0.012, darkM));
  cab.add(cyl("HingeMidPin", 0.0035, 0.0035, yU0 - yL1 - 0.002, pinM, s * (xOut - eH), (yL1 + yU0) / 2, zPiv, 14));
  // the lower hinge under each freezer door, and the levelling foot under it (front photo: 40 mm in from each side)
  cab.add(span("HingeLow", s > 0 ? xOut - 0.07 : -xOut + 0.003, s > 0 ? xOut - 0.003 : -xOut + 0.07, yBot + 0.0015, yL0 - 0.001, zCab + 0.002, zPiv + 0.02, darkM));
  cab.add(cyl("FootFront", 0.022, 0.024, yBot + 0.0015, footM, s * (xOut - 0.04), (yBot + 0.0015) / 2, zPiv - 0.015, 18));
  // at the back: a roller under a silver skid each side (side photo)
  cab.add(span("RollerSkid", s > 0 ? xOut - 0.05 : -xOut + 0.01, s > 0 ? xOut - 0.01 : -xOut + 0.05, 0.012, yBot, zBody, zBody + 0.15, skidM));
  cab.add(cyl("Roller", 0.0115, 0.0115, 0.016, footM, s * (xOut - 0.03), 0.0115, zBody + 0.08, 14).rotateZ(Math.PI / 2));
}
// the support under the lower doors' seam (front photo: 28 mm wide, from the floor to the doors' foot)
cab.add(span("CentreSupport", -0.014, 0.014, 0.004, yBot, zCab - 0.04, zCab + 0.05, footM));
// power cord: no photo of the back (LG publishes none for this model), so the route is ESTIMATED: out of the back high on
// the right and straight down the back panel to the floor, inside the rear spacers' 9 mm, on its way to the socket. No
// plug is drawn: lying behind the fridge it showed at the eye-level side view (36 mm tall with its pins), as did a cord
// run back along the floor; nothing of the cord shows from the front, at 3/4, over the top or from the side
{
  const zc = zBody - 0.0075;
  const pts = [[0.2, 1.6, zBody - 0.002], [0.2, 1.585, zc], [0.2, 1.2, zc], [0.2, 0.6, zc], [0.2, 0.1, zc], [0.2, 0.004, zc - 0.001]]
    .map(([x, y, z]) => new THREE.Vector3(x, y, z));
  cab.add(mesh("PowerCord", new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts, false, "centripetal"), 80, 0.004, 6, false), cordM));
}

// ── inside, fixed: lights, vents, the air filter, the control panel, LG's printed words ──
// the fridge's ceiling (open photos): the DoorCooling+ outlet, a dark slot across the ceiling's front (590 mm), the Top
// LED behind it (310 mm), and the vent housing at the top of the back wall (370 mm)
cab.add(span("DoorCoolingSlot", -0.295, 0.295, yCeil - 0.006, yCeil, zCab - 0.075, zCab - 0.06, ventBlack));
cab.add(span("FridgeLed", -0.155, 0.155, yCeil - 0.005, yCeil, zCab - 0.13, zCab - 0.115, lightM));
cab.add(span("FridgeVentBox", -0.185, 0.185, 1.62, yCeil, zIn1, zIn1 + 0.04, linerGrey));
// the air filter on the back wall, "Multi Air Flow" on its face: 195 x 90 mm (open photo at the back wall's scale), 20 mm proud
{
  const g = group("AirFilter", 0, 1.573, zIn1);
  g.add(span("AirFilterBody", -0.0975, 0.0975, -0.045, 0.045, 0, 0.02, white));
  g.add(mesh("AirFilterFace", flipV(new THREE.PlaneGeometry(0.195, 0.09)), printMaf, 0, 0, 0.0207));
  cab.add(g);
}
// the control panel on the right wall at the vegetable boxes, near the front (open photos; layout: manual page 27)
{
  const g = group("ControlPanel", xIn, 0.931, zCab - 0.05);
  g.add(span("PanelPlate", -0.003, 0, -0.07, 0.07, -0.02, 0.02, white));
  g.add(mesh("PanelFace", flipV(new THREE.PlaneGeometry(0.04, 0.14)), printPanel, -0.0037, 0, 0).rotateY(-Math.PI / 2));
  cab.add(g);
}
// the freezers' Top LED (LG's spec), one in each half's ceiling
for (const c of [FZL, FZR]) cab.add(span("FreezerLed", (c.x0 + c.x1) / 2 - 0.07, (c.x0 + c.x1) / 2 + 0.07, yRail0 - 0.004, yRail0, zCab - 0.1, zCab - 0.088, lightM));
// shelf ledges moulded in the side walls
for (const y of [sh1, sh2]) for (const s of [-1, 1]) cab.add(span("SideLedge", s < 0 ? -xIn : xIn - 0.006, s < 0 ? -xIn + 0.006 : xIn, y - 0.019, y - 0.0075, zIn1 + 0.01, frFront - 0.03, linerSide));

// ── shelves, boxes and drawers ──
function shelf(parent, name, x0, x1, y, front) {
  const g = group(name, 0, 0, 0);
  g.add(span(name + "Glass", x0 + 0.004, x1 - 0.004, y - 0.003, y + 0.003, zIn1 + 0.012, front - 0.012, glass));
  g.add(span(name + "Rim", x0 + 0.004, x1 - 0.004, y - 0.003, y + 0.011, front - 0.012, front, glassRim));
  g.add(span(name + "Edge", x0 + 0.004, x1 - 0.004, y - 0.005, y - 0.003, front - 0.003, front, edgeGreen));
  g.add(span(name + "RimBack", x0 + 0.004, x1 - 0.004, y - 0.003, y + 0.007, zIn1 + 0.012, zIn1 + 0.022, glassRim));
  g.add(span(name + "RailL", x0 + 0.004, x0 + 0.014, y - 0.007, y + 0.007, zIn1 + 0.012, front - 0.012, glassRim));
  g.add(span(name + "RailR", x1 - 0.014, x1 - 0.004, y - 0.007, y + 0.007, zIn1 + 0.012, front - 0.012, glassRim));
  parent.add(g);
}
// a clear box: floor at y0 (its top), walls to y1, between x0 and x1, from zb to `front`, a white foot rail along its
// front (the open photos) and LG's print; `notch` cuts the front wall down to that height across its middle 40 %
function drawer(parent, name, x0, x1, y0, y1, front, { zb = zIn1 + 0.012, printM = null, pw = 0, ph = 0, py = 0, notch = null, rail = white, leanIn = 0 } = {}) {
  const g = group(name + "Box", 0, 0, 0);
  g.add(span(name + "Floor", x0, x1, y0 - 0.004, y0, zb, front, clear));
  g.add(span(name + "Back", x0, x1, y0, y1, zb, zb + 0.004, clearLight));
  const wl = g.add(span(name + "WallL", x0, x0 + 0.004, y0, y1, zb + 0.004, front - 0.004, clear)).children.at(-1);
  const wr = g.add(span(name + "WallR", x1 - 0.004, x1, y0, y1, zb + 0.004, front - 0.004, clear)).children.at(-1);
  // the freezer's inner walls, 3 cm off the middle, lean 2 degrees toward the divider at the back (see lean())
  if (leanIn) lean(leanIn > 0 ? wr : wl, leanIn);
  if (notch) {
    const a = x0 + (x1 - x0) * 0.3, b = x1 - (x1 - x0) * 0.3;
    g.add(span(name + "FrontL", x0, a, y0, y1, front - 0.004, front, clearLight));
    g.add(span(name + "FrontR", b, x1, y0, y1, front - 0.004, front, clearLight));
    g.add(span(name + "FrontM", a, b, y0, notch, front - 0.004, front, clearLight));
  } else g.add(span(name + "Front", x0, x1, y0, y1, front - 0.004, front, clearLight));
  g.add(span(name + "Rim", x0, x1, y1 - 0.008, y1, front - 0.004, front + 0.002, clearRib));
  g.add(span(name + "FootRail", x0, x1, y0 - 0.006, y0 + 0.01, front - 0.004, front + 0.004, rail));
  if (printM) g.add(plane(name + "Print", pw, ph, printM, (x0 + x1) / 2, py, front + 0.0007));
  parent.add(g);
  return g;
}

// fridge: two glass shelves and the bottom shelf, fixed (they span both doors)
shelf(cab, "FrShelf1", -xIn, xIn, sh1, frFront);
shelf(cab, "FrShelf2", -xIn, xIn, sh2, frFront);
shelf(cab, "FrShelfLow", -xIn, xIn, shB, frFront);
// the two Big Fresh Zone boxes under the bottom shelf (861 to 1000 mm), on the pantry drawer's clear lid; the right one
// slides out with its food (FridgeTrays)
const bfY0 = 0.868, bfY1 = 0.995;
const BFL = { x0: -xIn + 0.008, x1: -0.004 }, BFR = { x0: 0.006, x1: xIn - 0.008 };
drawer(cab, "BigFreshL", BFL.x0, BFL.x1, bfY0, bfY1, frFront, { printM: printBig, pw: 0.079, ph: 0.0156, py: 0.94 });
const trays = group("FridgeTrays");
cab.add(trays);
drawer(trays, "BigFreshR", BFR.x0, BFR.x1, bfY0, bfY1, frFront, { printM: printBig, pw: 0.079, ph: 0.0156, py: 0.94 });
cab.add(span("PantryLid", -xIn + 0.004, xIn - 0.004, 0.857, 0.86, zIn1 + 0.012, pantryFront, clear));
// the Fresh Converter+ pantry drawer (718 to 860 mm), full width, "Fresh Converter+" low on its front
const pdY0 = 0.722, pdY1 = 0.852;
drawer(cab, "Pantry", -xIn + 0.006, xIn - 0.006, pdY0, pdY1, pantryFront, { printM: printConv, pw: 0.093, ph: 0.0159, py: 0.748 });

// freezer: in each half a tray (its front cut down in the middle, as on the photos and the manual's drawing) over a drawer
// that stops at the compressor bay; the open photo puts the tray at 415 to 612 mm and the drawer at 110 to 367 mm
const ftY0 = 0.419, ftY1 = 0.612, fdY0 = 0.114, fdY1 = 0.367;
for (const [c, nm] of [[FZL, "L"], [FZR, "R"]]) {
  const leanIn = nm === "L" ? 1 : -1;
  drawer(cab, "FzTray" + nm, c.x0 + 0.006, c.x1 - 0.006, ftY0, ftY1, fzFront, { notch: 0.544, leanIn });
  drawer(cab, "FzDrawer" + nm, c.x0 + 0.006, c.x1 - 0.006, fdY0, fdY1, fzFront, { zb: zStep + 0.01, leanIn });
}
// ── stock: vegetarian South Indian food, juices, water and soft drinks (the fitting helpers of the LG GL-B257's builder) ──
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
  const B = { hw: (dr.x1 - dr.x0) / 2 - 0.012, z0: (dr.zb ?? zIn1) + 0.03, z1: dr.front - 0.012 };
  items.forEach((o) => g.add(o));
  settle(items.slice().sort((a, b) => HEAP.indexOf(a.name.replace(/\d+$/, "")) - HEAP.indexOf(b.name.replace(/\d+$/, ""))), { tries: 30, spread: 0.08, bounds: B, ceil: dr.ceil - dr.y0 });
  return g;
}
const ring = (n, cx, cz, r, k) => [...Array(n)].map((_, i) => [cx + Math.cos(i * 2.4 + k) * r * Math.sqrt(i / n), cz + Math.sin(i * 2.4 + k) * r * Math.sqrt(i / n)]);
const at = (o, x, z) => { o.position.x = x; o.position.z = z; return o; };

// the fridge: snacks, batter and milk up top, the melon and the tubs on the second shelf, fruit on the bottom shelf;
// vegetables in the right Big Fresh Zone box, onions, potatoes, brinjal and drumsticks in the left, dairy in the Fresh Converter+ drawer
{
  const SH = { hw: xIn - 0.02, z0: zIn1 + 0.03, z1: frFront - 0.0125 };
  const rnr = carton("RnrBiryaniBox", "rnr_box_front", 0); rnr.rotation.x = -Math.PI / 2;
  const milk = pouch("NandiniMilk", "nandini_toned_milk");
  // the vent housing stands 4 cm out of the back wall over the top shelf: its back row starts in front of it
  tray(cab, "FrShelf1Stock", 0, sh1 + 0.003, { ...SH, z0: zIn1 + 0.05 }, [
    [tiffin("Tiffin"), pouch("IdBatterPouch", "id_batter", true, 0.85), carton("MastiButtermilk", "amul_masti_buttermilk", 4)],
    [rnr, milk],
  ], (g) => ["aavin_milk", "amul_taaza_pouch"].forEach((k, i) => g.add(at(pouch(i ? "AmulTaazaPouch" : "AavinMilk", k), milk.position.x, milk.position.z))));
  tray(cab, "FrShelf2Stock", 0, sh2 + 0.003, SH, [
    [food.coconutHalf("CoconutHalf", 0, 0, 0, 1), food.melonHalf("WatermelonHalf", 0, 0, 0, 1)],
    [tin("RnrBiryani", "rnr_tin_lid", 0.075, 0.06), paperTub("NandhanaPalace", "nandana_tub_wrap", 0.0525, 0.075), paperTub("NandhanaPalace2", "nandana_tub_wrap", 0.0525, 0.075)],
  ]);
  tray(cab, "FrShelfLowStock", 0, shB + 0.003, SH, [
    [food.bananaBunch("Bananas", 0, 0, 0, 5, 1), food.grapes("Grapes", 0, 0, 0, 1), food.lemon("Lemon", 0, 0, 0, 1)],
    [...[1, 2].map((i) => food.apple("Apple", 0, 0, 0, i)), ...[3, 4].map((i) => food.orange("Orange", 0, 0, 0, i))],
  ]);
  // the right box (it slides out: FridgeTrays). Its stock is split in two groups, "FreshZoneStock" (the heap) and
  // "Shelf1Stock" (the herbs and chillies on top): the trays page test finds both by name (NOTES.md)
  const ceil = shB - 0.007 - 0.003;
  const v = [];
  for (let i = 0; i < 4; i++) v.push(at(food.carrot("Carrot", 0, 0, 0, i + 1), -0.13 + i * 0.03, -0.16));
  for (let i = 0; i < 6; i++) v.push(at(food.okra("LadiesFinger", 0, 0, 0, i + 1), 0.06 + (i % 3) * 0.025, 0.02 + Math.floor(i / 3) * 0.025));
  ["green", "red"].forEach((k, i) => v.push(at(food.capsicum("Capsicum", 0, 0, 0, k, i + 1), -0.1 + i * 0.09, 0.07)));
  ring(4, -0.08, 0.0, 0.06, 3).forEach(([x, z], i) => v.push(at(food.tomato("Tomato", 0, 0, 0, i + 1), x, z)));
  for (let i = 0; i < 6; i++) v.push(at(food.chilli("GreenChilli", 0, 0, 0, i + 1), 0.1 + i * 0.006, 0.09));
  v.push(at(food.herb("Coriander", 0, 0, 0, "coriander", 1), -0.08, -0.24));
  v.push(at(food.herb("CurryLeaves", 0, 0, 0, "curry", 2), 0.06, -0.22));
  const fz = heap(trays, "FreshZoneStock", (BFR.x0 + BFR.x1) / 2, { ...BFR, y0: bfY0, front: frFront, ceil }, v);
  const top = group("Shelf1Stock", fz.position.x, fz.position.y, fz.position.z);
  trays.add(top);
  for (const o of fz.children.filter((c) => /^(Coriander|CurryLeaves|GreenChilli)/.test(c.name))) top.add(o);
  const w = [];
  for (let i = 0; i < 6; i++) w.push(at(food.onion("Onion", 0, 0, 0, i + 1), -0.1 + (i % 3) * 0.08, -0.2 + Math.floor(i / 3) * 0.07));
  for (let i = 0; i < 4; i++) w.push(at(food.potato("Potato", 0, 0, 0, i + 1), -0.1 + (i % 2) * 0.08, 0.0 + Math.floor(i / 2) * 0.06));
  for (let i = 0; i < 2; i++) { const b = at(food.brinjal("Brinjal", 0, 0, 0, i + 1), 0.06, -0.02 + i * 0.075); b.rotation.y = Math.PI / 2; w.push(b); }
  for (let i = 0; i < 2; i++) w.push(at(food.drumstick("Drumstick", 0, 0, 0, i + 1), 0.11 + i * 0.025, -0.1));
  heap(cab, "FrBoxLStock", (BFL.x0 + BFL.x1) / 2, { ...BFL, y0: bfY0, front: frFront, ceil }, w);
  // the Fresh Converter+ drawer: butter, cheese, paneer, curd and milk
  tray(cab, "PantryStock", 0, pdY0, { hw: xIn - 0.006 - 0.02, z0: zIn1 + 0.03, z1: pantryFront - 0.0125 }, [
    [brick("AmulButter1", "amul_butter", 0.085, 0.032, 0.055, K.butter), brick("AmulButter2", "amul_butter", 0.085, 0.032, 0.055, K.butter), brick("AmulCheese", "amul_cheese_slices", 0.12, 0.03, 0.12, K.cheese), pouch("AmulPaneerFr", "amul_paneer", false, 0.8)],
    [1, 2, 3].map((i) => cupWithLid("AmulMastiCup" + i, "amul_masti_dahi_lid", 0.04, 0.05)).concat([pouch("AavinMilk2", "aavin_milk"), pouch("NandiniMilk2", "nandini_toned_milk")]),
  ]);
}
// the freezer's left half (its door opens): ice cream and packs in the tray, more packs in the drawer
{
  const x0 = FZL.x0 + 0.006, x1 = FZL.x1 - 0.006, cx = (x0 + x1) / 2;
  tray(cab, "FzTrayStock", cx, ftY0, { hw: (x1 - x0) / 2 - 0.012, z0: zIn1 + 0.03, z1: fzFront - 0.0125 }, [
    [iceTub("AmulVanillaMagic", "amul_vanilla_magic_lid", 0.16, 0.085, 0.16), pouch("FreshoGreenPeas", "fresho_green_peas", false, 0.6)],
    [iceTub("AmulRajbhog", "amul_rajbhog_lid", 0.16, 0.085, 0.16), pouch("AmulPaneer", "amul_paneer", false, 0.6)],
  ]);
  const f = [];
  f.push(at(pouch("FreshoGreenPeas2", "fresho_green_peas", false, 0.9), -0.05, -0.05));
  f.push(at(pouch("ViswasParotta", "viswas_parotta", false, 0.8), 0.03, 0.05));
  f.push(at(pouch("NityaParotta", "nitya_parotta", false, 0.8), -0.03, 0.0));
  f.push(at(pouch("AmulPaneer2", "amul_paneer", false, 0.8), 0.0, 0.12));
  f.push(at(pouch("FreshoGreenPeas3", "fresho_green_peas", false, 0.9), 0.05, -0.04));
  heap(cab, "FzDrawerStock", cx, { x0, x1, y0: fdY0, front: fzFront, zb: zStep + 0.01, ceil: ftY0 - 0.006 - 0.004 }, f);
}

// ── doors: four, no handles. Each door's body is its side section run across the door: the glass front, the black
// frame round the back, the edges; the upper doors' section has the grip's bevel along the bottom ──
function body(name, sec, xl0, xl1, mats, xH) {
  const sh = new THREE.Shape(sec.map(([z, y]) => new THREE.Vector2(-(z - zPiv), y)));
  let geo = new THREE.ExtrudeGeometry(sh, { depth: xl1 - xl0, bevelEnabled: false }).rotateY(Math.PI / 2).translate(xl0, 0, 0);
  if (geo.index) geo = geo.toNonIndexed();
  const pos = geo.attributes.position, uv = geo.attributes.uv, lists = [[], [], []];
  const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3();
  for (let t = 0; t < pos.count / 3; t++) {
    a.fromBufferAttribute(pos, 3 * t); b.fromBufferAttribute(pos, 3 * t + 1); c.fromBufferAttribute(pos, 3 * t + 2);
    const nz = b.sub(a).cross(c.sub(a)).normalize().z;
    lists[nz > 0.9 ? 0 : nz < -0.9 ? 1 : 2].push(t);
  }
  const P = [], U = [], U1 = [], out = new THREE.BufferGeometry();
  let start = 0;
  lists.forEach((list, mi) => {
    for (const t of list) for (let k = 0; k < 3; k++) {
      const i = 3 * t + k, x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
      P.push(x, y, z);
      // the front: its own part of the colour's whole-front texture (835 x 1777 mm, top row first), so the light LG's
      // photo shows across the four doors stays where it is; the hairline (second UV set) in metres, running up the doors
      if (mi === 0) U.push((x + xH + W / 2) / W, (H - y) / H); else U.push(uv.getX(i), uv.getY(i));
      U1.push((mi === 2 ? z : x + xH) / HAIR, y / HAIR);
    }
    out.addGroup(start, list.length * 3, mi);
    start += list.length * 3;
  });
  out.setAttribute("position", new THREE.Float32BufferAttribute(P, 3));
  out.setAttribute("uv", new THREE.Float32BufferAttribute(U, 2));
  out.setAttribute("uv1", new THREE.Float32BufferAttribute(U1, 2));
  out.computeVertexNormals();
  return mesh(name, out, mats);
}
const y0Of = (sec) => Math.min(...sec.map(([, y]) => y));
// a door hinged at its outer side s (-1 left, +1 right), between heights y0 and y1; the door's group sits on the hinge
// axis, and its parts are given in world x and z
function door(name, s, sec, y1, build) {
  const xH = s * (xOut - eH);
  const g = group(name, xH, 0, zPiv);
  const ls = (nm, x0, x1, ya, yb, z0, z1, m) => { const o = lean(span(nm, x0 - xH, x1 - xH, ya, yb, z0 - zPiv, z1 - zPiv, m), s); g.add(o); return o; };
  const xa = s > 0 ? 0.0015 : -xOut, xb = s > 0 ? xOut : -0.0015;
  g.add(body(name + "Body", sec, xa - xH, xb - xH, [doorM, trimM, doorEdge], xH));
  // a dark fin in the seam, level with the hinge axis, where the door neither gains nor loses ground on the other as it
  // swings: the left door's to 0.5 mm right of the middle, the right door's (4 mm further forward) from 0.7 mm. Rigid
  // doors cannot overlap across the seam without striking each other, so 0.2 mm stays open (0.1 px on the gate's front),
  // and the inside's white no longer shows down the seam (LG's photos: a dark line). Clearances: NOTES.md
  const fin = s < 0 ? [-0.0017, 0.0005, zPiv - 0.003, zPiv + 0.003] : [0.0007, 0.0017, zPiv + 0.004, zPiv + 0.008];
  g.add(span(name + "SeamFin", fin[0] - xH, fin[1] - xH, y0Of(sec), y1, fin[2] - zPiv, fin[3] - zPiv, ventBlack));
  build(g, { xH, ls, X: (x) => x - xH, Z: (z) => z - zPiv });
  return g;
}
// the gasket: a ring 16 mm wide round the opening, from the door's back to just short of the cabinet's front
function gaskets(ls, xs0, xs1, xh0, xh1, yb0, yt1) {
  const z0 = zCab + 0.0005, z1 = zDoor;
  const lo = Math.min(xs0, xh0), hi = Math.max(xs1, xh1);
  ls("GasketTop", lo, hi, yt1 - 0.016, yt1, z0, z1, gasket);
  ls("GasketBottom", lo, hi, yb0, yb0 + 0.016, z0, z1, gasket);
  ls("GasketSeam", xs0, xs1, yb0 + 0.016, yt1 - 0.016, z0, z1, gasket);
  ls("GasketHinge", xh0, xh1, yb0 + 0.016, yt1 - 0.016, z0, z1, gasket);
}
// a clear door basket on the door liner's face, between world x0 and x1, its floor at height y
const zDykeU = zDoor - dykeU;
function basket(g, xH, name, x0, x1, y, dep, h) {
  const zD = zDykeU - zPiv, b = group(name, (x0 + x1) / 2 - xH, y, zD), w = x1 - x0;
  b.add(box(name + "Floor", w, 0.004, dep, clear, 0, 0.002, -dep / 2));
  b.add(box(name + "Back", w, h, 0.004, clear, 0, h / 2, -0.002));
  b.add(box(name + "Lip", w, h * 0.85, 0.004, clear, 0, h * 0.425, -dep + 0.002));
  b.add(box(name + "EndL", 0.004, h, dep - 0.008, clear, -w / 2 + 0.002, h / 2, -dep / 2));
  b.add(box(name + "EndR", 0.004, h, dep - 0.008, clear, w / 2 - 0.002, h / 2, -dep / 2));
  b.add(box(name + "Rim", w, 0.006, 0.006, clearRib, 0, h - 0.003, -dep + 0.003));
  for (const c of b.children) lean(c, Math.sign(xH));
  g.add(b);
  // the inside of the basket in the door's frame: x range, the middle of its depth, the floor
  return { x0: x0 - xH + 0.006, x1: x1 - xH - 0.006, zm: zD - dep / 2, y: y + 0.004 };
}
const row = (g, inside, items) => { items.forEach((o) => { face(o); o.position.y = inside.y; g.add(o); }); lineUp(items, inside.x0, inside.x1, inside.zm, { middle: true }); };

// the fridge doors: the open photos give the basket floors and rims (1536/1631, 1275/1367, 898/987 mm). The left door
// carries the door mullion (LG: "the flipper on the left door"): a bar behind the seam, here built fixed and kept on
// the left door's side of the seam so it clears the right door when the left one opens (NOTES.md)
const secU = [[zDoor, yU0], [zF0 - grip, yU0], [zF0, yUf], [zF0, H], [zDoor, H]];
const BASK = [[1.536, 0.095], [1.275, 0.092], [0.898, 0.089]];
const yDy0 = 0.725, yDy1 = 1.682; // the door liner stands into the opening (fridge: 713 to 1692 mm)
const fridgeDoorL = door("FridgeDoorL", -1, secU, H, (g, { xH, ls }) => {
  gaskets(ls, -0.03, -0.014, -0.4, -0.384, 0.692, 1.716);
  ls("DoorLinerPlate", -0.384, -0.03, 0.708, 1.7, zDoor - 0.002, zDoor - 0.0002, doorBack);
  ls("FrDoorDykeL", -0.35, -0.052, yDy0, yDy1, zDykeU, zDoor - 0.002, doorBack);
  ls("Flipper", -0.054, -0.008, yDy0, yDy1, zDoor - 0.042, zDoor - 0.016, linerGrey);
  ls("FlipperGasket", -0.052, -0.010, yDy0 + 0.01, yDy1 - 0.01, zDoor - 0.016, zDoor - 0.0125, gasket);
  // the mullion's seal behind the seam (the real one turns flat across the seam when the door shuts), built fixed; with
  // the right door's strip below it backs the seam fins (each swings clear of the other door, checked point by point)
  ls("FlipperSeal", -0.014, -0.001, yDy0, yDy1, zDoor - 0.008, zDoor - 0.0005, gasket);
  g.add(plane("LgMarkDecal", 0.048, 0.022, logoM, -xOut + 0.0595 - xH, 1.7345, zF0 + 0.0007 - zPiv));
  const bs = BASK.map(([y, h], i) => basket(g, xH, `FrBasketL${i + 1}`, -0.345, -0.06, y, bDep, h));
  row(g, bs[0], [brandJar("MothersPickle", "mothers_mango_pickle", 0.036, 0.07, K.jarGreen, K.goldLid), brandJar("MothersPickle2", "mothers_mango_pickle", 0.036, 0.07, K.jarGreen, K.goldLid),
    brandJar("AavinGhee", "aavin_ghee_jar", 0.034, 0.07, K.amber, K.goldLid)]);
  row(g, bs[1], [carton("RealMango", "real_mango", 2), carton("RealMixedFruit", "real_mixed_fruit", 1), carton("AmulTaaza", "amul_taaza_carton", 3)]);
  row(g, bs[2], [petBrand("Coke", "coke_label", 0.042, 0.3, 0x2a1408, 0xc42b22), petBrand("Fanta", "fanta_label", 0.042, 0.3, 0xe8820e, 0xe07a12),
    petBrand("ThumsUp", "thumsup_label", 0.042, 0.3, 0x2a1408, 0x1b3a8c)]);
});
const fridgeDoorR = door("FridgeDoorR", 1, secU, H, (g, { xH, ls }) => {
  gaskets(ls, 0.012, 0.028, 0.384, 0.4, 0.692, 1.716);
  ls("DoorLinerPlate", 0.028, 0.384, 0.708, 1.7, zDoor - 0.002, zDoor - 0.0002, doorBack);
  ls("FrDoorDykeR", 0.032, 0.35, yDy0, yDy1, zDykeU, zDoor - 0.002, doorBack);
  ls("SeamStrip", 0.003, 0.011, yDy0, yDy1, zDoor - 0.018, zDoor - 0.0085, gasket);
  // the energy label for this colour, where LG's front photos have it (upper right)
  g.add(plane("BeeLabelDecal", 0.0908, 0.168, labelM, -xOut + 0.7565 - xH, 1.6645, zF0 + 0.0007 - zPiv));
  const bs = BASK.map(([y, h], i) => basket(g, xH, `FrBasketR${i + 1}`, 0.045, 0.345, y, bDep, h));
  row(g, bs[0], [brandJar("MothersPickle3", "mothers_mango_pickle", 0.036, 0.07, K.jarGreen, K.goldLid), pouch("SakthiSambar", "sakthi_sambar_powder", true, 0.8), brandJar("AavinGhee2", "aavin_ghee_jar", 0.034, 0.07, K.amber, K.goldLid)]);
  row(g, bs[1], [carton("MastiButtermilk2", "amul_masti_buttermilk", 4), carton("AmulTaaza2", "amul_taaza_carton", 3), pouch("NandiniGhee", "nandini_ghee_pouch", true, 0.7)]);
  const cans = [[0x1b2d72, "thumsup_can", 0.105], [0xb82a20, "coke_label", 0.06]];
  row(g, bs[2], [petBrand("Bisleri", "bisleri_label", 0.0345, 0.265, 0xcfe9f7, 0x1a6fb0, 0.6), petBrand("Bisleri2", "bisleri_label", 0.0345, 0.265, 0xcfe9f7, 0x1a6fb0, 0.6),
    ...cans.map(([col, key, lh]) => food.can("Can", col, 0, 0, 0, brand(key), arcFor(asp(key, 1) * lh, 0.033), lh))]);
});
// the freezer doors: plain liners with ribs across them (LG's open photos), no baskets ("Door Basket_Freezer: No")
const secL = [[zDoor, yL0], [zF0, yL0], [zF0, yL1], [zDoor, yL1]];
function freezerDoor(name, s) {
  return door(name, s, secL, yL1, (g, { ls }) => {
    const m = (a, b) => (s > 0 ? [a, b] : [-b, -a]);
    gaskets(ls, ...m(0.005, 0.02), ...m(0.384, 0.4), 0.036, 0.656);
    ls("DoorLinerPlate", ...m(0.02, 0.384), 0.052, 0.64, zDoor - 0.002, zDoor - 0.0002, doorBack);
    ls("FzDoorDyke", ...m(0.035, 0.35), 0.09, 0.62, zDoor - dykeL, zDoor - 0.002, doorBack);
    for (const y of [0.15, 0.25, 0.35, 0.45, 0.55]) ls("FzDoorRib", ...m(0.04, 0.345), y - 0.004, y + 0.004, zDoor - dykeL - 0.004, zDoor - dykeL, doorBack);
  });
}
const freezerDoorL = freezerDoor("FreezerDoorL", -1);
// the right freezer door: on its own hinge, shut (a fifth moving part is over STANDARD.md's four)
const freezerDoorR = freezerDoor("FreezerDoorR", 1);
root.add(fridgeDoorL, fridgeDoorR, freezerDoorL, freezerDoorR);

const parts = productParts(PRODUCTS, ID);
// the manual's sizes with the doors open: 1290 mm across both open doors, 1057 mm deep from the rear spacers
{
  const AXY = new THREE.Vector3(0, 1, 0), doors = [[fridgeDoorL, -ANG], [fridgeDoorR, ANG], [freezerDoorL, -ANG], [freezerDoorR, ANG]];
  for (const [d, a] of doors) d.quaternion.setFromAxisAngle(AXY, THREE.MathUtils.degToRad(a));
  root.updateMatrixWorld(true);
  const bb = new THREE.Box3();
  for (const [d] of doors) bb.union(new THREE.Box3().setFromObject(d.getObjectByName(d.name + "Body")));
  console.log(`doors open ${ANG} deg: ${((bb.max.x - bb.min.x) * 1000).toFixed(0)} mm across (manual 1290), ${((bb.max.z - zBack) * 1000).toFixed(0)} mm deep (manual 1057)`);
  for (const [d] of doors) d.quaternion.identity();
  root.updateMatrixWorld(true);
}
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
  DoorFront: `${T}/door_bm.jpg`, LabelBEE: `${T}/label_bm.png`, LgMark: `${T}/lgmark_bm.png`,
  print_maf: `${T}/print_maf.png`, print_bigfresh: `${T}/print_bigfresh.png`, print_freshconv: `${T}/print_freshconv.png`, print_panel: `${T}/print_panel.png`,
  ...food.textures(`${TEX}/food`),
  ...Object.fromEntries(Object.keys(labelMats).map((n) => [n, `${TEX}/brands/small/${n.slice(3)}.jpg`])),
};
// Grain (BENCHMARK.md section 10). Black Mirror doors are glass: no grain on them (or on their print). The sides and top
// are smooth factory paint: the soft peel. Prime Silver's steel doors get their fine vertical hairline (on the doors' own
// second UV set, made in body()) in the variant below.
await exportGLB(root, clips, OUT, textures, { dir: `${TEX}/grain`, materials: {
  SideSteel: { type: "peel_soft" }, TopSteel: { type: "peel_soft" },
} });

// ── the two colours as material variants (KHR_materials_variants): Black Mirror (GV-B23FFGMB, first:
// the base materials above, the glass coat added here) and Prime Silver (GV-B23FFLMB: polished silver steel doors with
// LG's own light in the texture, the hairline and a soft clear coat, a grey frame and silver-grey sides, from its own LG
// photos). Each colour carries its own energy label, which names its own code. The inside, the back and the hinges are
// the same on both ──
const FINISHES = [
  ["Black Mirror", {}],
  ["Prime Silver", {
    DoorFront: { tex: `${T}/door_ps.jpg`, metal: PS.metal, rough: PS.rough, normal: `${TEX}/grain/hairline_soft_n.jpg`, coat: PS.coat },
    // LG's Prime Silver photos: the sides read 124 (0.50 of the label's white), the rail and the door frames 132
    DoorEdge: { color: [124, 125, 127], metal: 0.5, rough: 0.4 },
    TrimDark: { color: [132, 131, 132], metal: 0.5, rough: 0.4 },
    SideSteel: { color: [124, 125, 127], metal: 0.35, rough: 0.5 },
    TopSteel: { color: [118, 119, 121], metal: 0.2, rough: 0.65 },
    CabFrame: { color: [110, 111, 113], metal: 0.2, rough: 0.6 },
    LabelBEE: { tex: `${T}/label_ps.png` },
    LgMark: { tex: `${T}/lgmark_ps.png` },
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
  // Black Mirror's glass coat on the base material
  coat(doc.getRoot().listMaterials().find((m) => m.getName() === "DoorFront"), BM.coat);
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
      if (v.color) m.setBaseColorFactor([...v.color.map(lin), base.getBaseColorFactor()[3]]);
      if (v.metal != null) m.setMetallicFactor(v.metal);
      if (v.rough != null) m.setRoughnessFactor(v.rough);
      // the hairline on the doors' second UV set (metres / 0.1: the grain tile's 100 mm)
      if (v.normal) m.setNormalTexture(texOf(v.normal)).getNormalTextureInfo().setTexCoord(1);
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
