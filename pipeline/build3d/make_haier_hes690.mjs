// Haier HES-690GK, 596 L side-by-side refrigerator, Graphite Black, with Haier's same body in Shiny Silver (HES-690SS) as
// a second colour (KHR_materials_variants).
// Built to Haier's published size, 905 W x 1775 H x 697 D mm (Haier's page and the Sangeetha listing), from Haier's gallery
// photos of this model (straight front, both three-quarter views, open, stocked and rear) and of HES-690SS (front, both
// three-quarter views, the display close-up): the freezer on the left and the fridge on the right, each behind one
// full-height door. The fridge door's left 42 mm is a step set back from its face, with the black glass control panel at
// its top; recess handles are grip slots in the two doors' facing sides (the freezer door's right side, the step's wall).
// Inside, as Haier's open photo shows: three glass shelves in each compartment under the lit MAGIC COOLING and DEO FRESH
// ducts, a glass cover with the twist ice maker in the freezer, two FREEZEBOX drawers and two FRESHBOX drawers, three bins
// on the freezer door and five on the fridge door. The fridge's shelves and drawers lift out (FridgeTrays); the freezer
// drawers slide out (FreezerDrawer). Stocked for a south Indian kitchen, eggs in the door's top bin as in Haier's photo.
// usage: node make_haier_hes690.mjs <products.json> <tex dir> <out.glb>
import fs from "node:fs";
import { THREE, mat, mesh, box, group, flipV, stateClips, exportGLB, productParts, saveZones } from "./lib.mjs";
import { Food } from "./food.mjs";
import { mergeGeometries, mergeVertices } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { NodeIO } from "@gltf-transform/core";
import { ALL_EXTENSIONS, KHRMaterialsVariants } from "@gltf-transform/extensions";

const [PRODUCTS, TEX, OUT] = process.argv.slice(2);
const ID = "haier-hes-690gk";
const T = `${TEX}/haier_hes690`;
const rp = JSON.parse(fs.readFileSync(`${T}/rear_paths.json`, "utf8"));

// ── size (metres): Haier's 905 x 1775 x 697 mm (VERIFIED); everything else measured on Haier's photos (NOTES.md, ESTIMATED) ──
const W = 0.905, H = 1.775, D = 0.697;
const xo = W / 2;
const zBack = -D / 2;                 // the rear panel
const zCab = zBack + 0.610;           // the cabinet's front: 610 mm deep (3/4 photos: the door band is 87 mm of the 697)
const zDb = zCab + 0.015;             // the doors' back, behind a 15 mm gasket
const zDf = D / 2;                    // the doors' front: 72 mm doors
const zPiv = zDb + 0.02, pivX = xo - 0.012;   // hinge pins inside each door's outer back corner
const zF = zDf - zPiv, zB = zDb - zPiv;       // a door's front and back in its own frame
const yD0 = 0.016, yD1 = 1.745, doorH = yD1 - yD0;   // doors 16 to 1745 mm up (front photo: door tops row 61, floor 1129)
const yBot = 0.025, yTop = 1.742;     // the cabinet's bottom and top
const xIn = xo - 0.051;               // inner wall faces (open photo, 51 mm walls)
const mul0 = -0.095, mul1 = -0.048;   // the mullion (open photo)
const yCeil = 1.706, yFloor = 0.080;
const zIn = zBack + 0.065;            // the inner back wall
const FZ = { x0: -xIn, x1: mul0 }, FR = { x0: mul1, x1: xIn };
for (const c of [FZ, FR]) { c.cx = (c.x0 + c.x1) / 2; c.hw = (c.x1 - c.x0) / 2; }
// the doors' faces across the front (straight-on photo, 0.612 px per mm): the freezer face to -69.3 mm and its bright
// rounded edge to -60.5; a 3.5 mm gap; the fridge door's step from -57 to -15 mm (set back 25 mm), a silver strip on the
// face's corner to -9 mm, the fridge face from there to the right edge
const fzEdge = -0.0605, fzFace1 = -0.0693, frX0 = -0.057, frStep1 = -0.015, frFace0 = -0.009, stepBack = 0.025;
// shelves (glass tops), covers and drawers, from Haier's open photo (front plane 0.5628 px per mm up, floor row 1110)
const SH = [1.395, 1.102, 0.844], cover = 0.609;
const fzUp = [0.396, 0.600], fzLow = [0.098, 0.364], frUp = [0.418, 0.604], frLow = [0.112, 0.370];
// door bins: floor heights on the open photo, end-wall heights; depths ESTIMATED
const linerFace = zCab - 0.016;       // the door liner's face, inside the opening
const BINS = {
  FreezerDoor: { d: 0.09, at: [[1.606, 0.08], [1.302, 0.08], [0.932, 0.08]] },
  FridgeDoor: { d: 0.095, at: [[1.606, 0.07], [1.297, 0.1], [0.925, 0.1], [0.556, 0.1], [0.179, 0.1]] },
};
const fzFront = linerFace - BINS.FreezerDoor.d - 0.01, frFront = linerFace - BINS.FridgeDoor.d - 0.01;
// the grip slots, with rounded ends: 494 to 1091 mm up (both three-quarter photos at the doors' front corners, 0.57 px per
// mm: rows 476-817 of g05 and 472-812 of g02 between door tops at 105/98 and bottoms at 1088/1085), 15 mm wide, 22 mm deep
const slotY = [0.494 - yD0, 1.091 - yD0], slotZ = [zF - 0.022, zF - 0.007], slotD = 0.022;
// the display: a black glass panel on the step, from the door's top down to 1319 mm at its left and 1263 mm at its right
const dispL = 1.319, dispR = 1.263;

// ── materials ──
// Graphite Black: Haier's photo on the faces (its colour), a steel film under a light clear coat (tuned on renders against
// Haier's photos as ratios to the white backdrop, NOTES.md); the Shiny Silver variant swaps the photo and the colours below
const doorFzM = mat("DoorFreezer", 0x464b5c, { metal: 0.35, rough: 0.5 });
const doorFrM = mat("DoorFridge", 0x464b5c, { metal: 0.35, rough: 0.5 });
const channelM = mat("ChannelFace", 0x464b5c, { metal: 0.35, rough: 0.5 });
const doorEdge = mat("DoorEdge", 0x3c4152, { metal: 0.35, rough: 0.45 });
const recess = mat("Recess", 0x141518, { rough: 0.7 });
const trimM = mat("TrimSilver", 0xc9ccd1, { metal: 0.9, rough: 0.25 });
const dispM = mat("DisplayGlass", 0x0b0b0d, { metal: 0.6, rough: 0.15 });
const printDisp = mat("print_display", 0xffffff, { rough: 0.4, opacity: 0.999 });
const logoM = mat("HaierMark", 0xffffff, { rough: 0.45, opacity: 0.999 });
const doorBack = mat("DoorLiner", 0xeef0f2, { rough: 0.55 });
// sides and top: near-black paint on Graphite Black (3/4 photos about 49 grey), mid grey on Shiny Silver
const sidePaint = mat("SidePaint", 0x2a2b2f, { metal: 0.3, rough: 0.5 });
const topPaint = mat("TopPaint", 0x2a2b2f, { metal: 0.3, rough: 0.55 });
const frameM = mat("CabFrame", 0x2a2b2f, { metal: 0.2, rough: 0.6 });
const hingeM = mat("HingeCover", 0xb9bcc1, { metal: 0.7, rough: 0.35 });
const rearM = mat("RearPlate", 0xffffff, { metal: 0.05, rough: 0.6 });
const bayM = mat("Bay", 0xffffff, { metal: 0.05, rough: 0.6 });
const bayDark = mat("BayDark", 0x1a1b1e, { rough: 0.8 });
const boxM = mat("TopBox", 0xb4b8be, { metal: 0.5, rough: 0.45 });
const liner = mat("Liner", 0xf1f3f5, { rough: 0.6 });
const linerSide = mat("LinerSide", 0xe4e8ec, { rough: 0.65 });
const linerGrey = mat("LinerGrey", 0xd3d7dc, { rough: 0.6 });
const seamShade = mat("SeamShade", 0x1c1d21, { rough: 0.85 });
const gasket = mat("Gasket", 0x2c2e33, { rough: 0.85 });
const ventGrey = mat("VentGrey", 0xa9aeb5, { rough: 0.6 });
const barBlack = mat("BarBlack", 0x0e0e10, { rough: 0.4 });
const clear = mat("ClearPlastic", 0xc3d0da, { rough: 0.12, opacity: 0.5, side: THREE.DoubleSide });
const clearLight = mat("ClearPlasticLight", 0xdfe7ee, { rough: 0.12, opacity: 0.26, side: THREE.DoubleSide });
const clearRib = mat("ClearRib", 0xeef3f7, { rough: 0.3 });
const glass = mat("TemperedGlass", 0xa9cdd6, { rough: 0.05, opacity: 0.55, side: THREE.DoubleSide });
const glassRim = mat("ShelfRim", 0xe3e7ea, { rough: 0.45 });
const edgeGreen = mat("GlassEdge", 0x7fa7b0, { rough: 0.3 });
const tabGrey = mat("ShelfTab", 0x9a9fa6, { rough: 0.5 });
const white = mat("WhitePlastic", 0xf6f7f8, { rough: 0.45 });
const lightM = mat("Led", 0xffffff, { emissive: 0xf4f8ff, emissiveIntensity: 1.5 });
const footM = mat("Foot", 0x131416, { rough: 0.7 });
const cordM = mat("Cord", 0x1d1e20, { rough: 0.6 });
const plugM = mat("Plug", 0x2a2b2e, { rough: 0.5 });
const pinM = mat("Pin", 0xc4c7cb, { metal: 0.9, rough: 0.3 });
const P = (n) => mat("print_" + n, 0xffffff, { rough: 0.6, opacity: 0.999 });
const printDeo = P("deofresh"), printMcBar = P("magiccooling_bar"), printZone = P("magiczone"), printMc = P("magiccooling");
const printFreeze = P("freezebox"), printFresh = P("freshbox"), printIce = P("icemaker");

// ── small builders ──
const cyl = (name, rt, rb, h, m, x, y, z, seg = 14) => mesh(name, new THREE.CylinderGeometry(rt, rb, h, seg), m, x, y, z);
const plane = (name, w, h, m, x, y, z) => mesh(name, flipV(new THREE.PlaneGeometry(w, h)), m, x, y, z);
// a box from corner to corner, its geometry in its parent's frame (so the grain's box projection runs on unbroken across
// neighbouring pieces)
const span = (name, x0, x1, y0, y1, z0, z1, m) => mesh(name, flipV(new THREE.BoxGeometry(x1 - x0, y1 - y0, z1 - z0)).translate((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2), m);
function joined(name, boxes, m) {
  const geos = boxes.map(([x0, x1, y0, y1, z0, z1]) => new THREE.BoxGeometry(x1 - x0, y1 - y0, z1 - z0).translate((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2));
  return mesh(name, mergeGeometries(geos), m);
}
// a face's uv: u across [u0, u1] and v from the top (t) to the bottom (b), on the faces looking out along +z
function frontUV(m, u0, u1, t, b) {
  const p = m.geometry.attributes.position, n = m.geometry.attributes.normal, uv = m.geometry.attributes.uv;
  for (let i = 0; i < p.count; i++) if (n.getZ(i) > 0.5) uv.setXY(i, (p.getX(i) + m.position.x - u0) / (u1 - u0), (t - (p.getY(i) + m.position.y)) / (t - b));
  return m;
}

const root = group("HaierHES690");
const cab = group("Cabinet");
root.add(cab);

// ── cabinet shell (BoxGeometry faces: +x, -x, +y, -y, +z front, -z back) ──
cab.add(span("SideLeft", -xo, -xIn, yBot, yTop, zBack + 0.004, zCab, [linerSide, sidePaint, topPaint, footM, frameM, sidePaint]));
cab.add(span("SideRight", xIn, xo, yBot, yTop, zBack + 0.004, zCab, [sidePaint, linerSide, topPaint, footM, frameM, sidePaint]));
cab.add(span("Top", -xIn, xIn, yCeil, yTop, zBack + 0.004, zCab, [liner, liner, topPaint, liner, frameM, topPaint]));
cab.add(span("Base", -xIn, xIn, yBot, yFloor, zBack + 0.004, zCab, [liner, liner, liner, footM, liner, footM]));
cab.add(span("BackWall", -xIn, xIn, yFloor, yCeil, zBack + 0.004, zIn, liner));
cab.add(span("Mullion", mul0, mul1, yFloor, yCeil, zIn, zCab, liner));
// the 3.5 mm gap between the doors is dark on Haier's front: the slot behind it is in shadow the viewers don't compute
cab.add(span("MullionSeamShade", -0.063, -0.054, yBot + 0.01, yTop - 0.01, zCab, zCab + 0.001, seamShade));
// two small vent slots low at the back of each side (3/4 photos)
for (const s of [-1, 1]) {
  const x0 = s > 0 ? xo - 0.0005 : -xo - 0.0004, x1 = s > 0 ? xo + 0.0004 : -xo + 0.0005;
  cab.add(joined(s > 0 ? "SideVentsR" : "SideVentsL", [0.112, 0.138].map((y) => [x0, x1, y - 0.004, y + 0.004, zBack + 0.03, zBack + 0.09]), recess));
}
// the back: Haier's rear photo on the panel above the compressor bay, the bay's cover with its slots cut out
{
  const bay1 = rp.bay[1], m = span("RearPanel", -xo + 0.002, xo - 0.002, bay1, 1.735, zBack, zBack + 0.004, [sidePaint, sidePaint, topPaint, topPaint, sidePaint, rearM]);
  const p = m.geometry.attributes.position, n = m.geometry.attributes.normal, uv = m.geometry.attributes.uv;
  for (let i = 0; i < p.count; i++) if (n.getZ(i) < -0.5) uv.setXY(i, (xo - (p.getX(i) + m.position.x)) / W, (1.735 - (p.getY(i) + m.position.y)) / (1.735 - bay1));
  cab.add(m);
  const [cy0, cy1] = rp.bay, cx0 = -xo + 0.002, cx1 = xo - 0.002;
  const sh = new THREE.Shape();
  sh.moveTo(cx0, cy0); sh.lineTo(cx1, cy0); sh.lineTo(cx1, cy1); sh.lineTo(cx0, cy1); sh.lineTo(cx0, cy0);
  for (const [a, b, c, d] of rp.slots) { const h = new THREE.Path(); h.moveTo(a, b); h.lineTo(c, b); h.lineTo(c, d); h.lineTo(a, d); h.lineTo(a, b); sh.holes.push(h); }
  const geo = new THREE.ExtrudeGeometry(sh, { depth: 0.003, bevelEnabled: false, curveSegments: 1 });
  const q = geo.attributes.position, u = geo.attributes.uv;
  for (let i = 0; i < q.count; i++) u.setXY(i, (xo - q.getX(i)) / W, (cy1 - q.getY(i)) / (cy1 - cy0));   // the photo is from behind
  cab.add(mesh("RearBayCover", geo, [bayM, bayDark], 0, 0, zBack));
  cab.add(span("RearBayInside", -xIn, xIn, cy0, cy1, zBack + 0.03, zBack + 0.034, bayDark));
}
// the box on top at the back (rear photo: x -72 to +299 mm), to the full 1775 mm (the photo puts its top about 26 mm over the
// cabinet's; Haier's height is taken to be the box's)
{
  const [bx0, bx1] = rp.topbox;
  cab.add(span("TopBox", bx0, bx1, yTop, H - 0.003, zBack + 0.004, zBack + 0.16, boxM));
  cab.add(span("TopBoxLid", bx0 + 0.004, bx1 - 0.004, H - 0.003, H, zBack + 0.008, zBack + 0.156, boxM));
  // the cord: Haier's rear photo shows it leaving the box at x +23 mm and lying in a loop on the box's top to x +77 mm.
  // Lying there it showed over the box in the front and three-quarter views (the page's camera is above the top), which our
  // rule for cords rules out, so (as on Haier's HRT-683) it leaves the back panel by a white grommet 12 mm under the cabinet's
  // top at x +23 mm, runs along the back to x +77 mm 1.5 mm off the panel, drops, and swings in to a three-pin plug hung flat
  // on the back near the centre line, 0.95 m up (ESTIMATED: Haier shows nothing past the box). Below the top and near the
  // centre, the cord (9.5 mm proud) and the plug (17 mm) stay hidden behind the cabinet in the side views.
  const cx = rp.cord_exit, cf = rp.cord_far, cr = 0.004, yc = yTop - 0.012, zc = zBack - cr - 0.0015;
  const grom = cyl("Grommet", 0.007, 0.007, 0.003, white, cx, yc, zBack - 0.0013, 12);
  grom.rotation.x = Math.PI / 2;
  cab.add(grom);
  const px = 0.04, py = 0.95, zPlate = zBack - 0.0002;
  const pts = [[cx, yc, zBack + 0.004], [cx, yc, zBack - 0.002], [cx + 0.02, yc, zc], [cf - 0.012, yc, zc],
    [cf, yc - 0.025, zc], [cf, yTop - 0.12, zc], [cf - 0.004, 1.32, zc], [cf - 0.02, 1.14, zc], [px + 0.02, py + 0.10, zc],
    [px + 0.004, py + 0.045, zc], [px, py + 0.024, zc]].map(([x, y, z]) => new THREE.Vector3(x, y, z));
  cab.add(mesh("PowerCord", new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts, false, "centripetal"), 90, cr, 6, false), cordM));
  // India's three-pin plug (45 x 42 x 16 mm, pins 5.2 mm) hung flat on the back, the cord into its top, its pins at (0, +10.5)
  // and (+-9.5, -6.5) mm turned to the panel: pointing out, they stood 33 mm off the back and showed past the cabinet in the
  // side view; this way the plug stands 17 mm off, within what the cabinet hides
  const s = new THREE.Shape(), w = 0.045, h = 0.042, r = 0.012;
  s.moveTo(-w / 2 + r, -h / 2); s.lineTo(w / 2 - r, -h / 2); s.quadraticCurveTo(w / 2, -h / 2, w / 2, -h / 2 + r);
  s.lineTo(w / 2, h / 2 - r); s.quadraticCurveTo(w / 2, h / 2, w / 2 - r, h / 2); s.lineTo(-w / 2 + r, h / 2);
  s.quadraticCurveTo(-w / 2, h / 2, -w / 2, h / 2 - r); s.lineTo(-w / 2, -h / 2 + r); s.quadraticCurveTo(-w / 2, -h / 2, -w / 2 + r, -h / 2);
  const plugG = new THREE.ExtrudeGeometry(s, { depth: 0.013, bevelEnabled: true, bevelSize: 0.0015, bevelThickness: 0.0015, bevelSegments: 2, curveSegments: 8 });
  const plug = mesh("Plug", plugG, plugM, px, py, zPlate - 0.0015);
  plug.rotation.y = Math.PI;
  cab.add(plug);
  for (const [dx, dy] of [[0, 0.0105], [-0.0095, -0.0065], [0.0095, -0.0065]]) cab.add(cyl("PlugPin", 0.0026, 0.0026, 0.016, pinM, px + dx, py + dy, zPlate + 0.007, 10).rotateX(Math.PI / 2));
}
// hinges: silver moulded covers on the top's outer front corners (3/4 photos), black feet at the front, rollers behind
for (const s of [-1, 1]) {
  // the cover's side profile as the 3/4 photos show it: a rounded hump falling away to the back, with the hinge pin's cap a
  // small upright tab at its inner front corner (shape ESTIMATED from g02/g05; height 1764 mm as before)
  {
    const zf = zDb - 0.002, zb = zCab - 0.075, yT = 1.764, u = (z) => -z, hc = new THREE.Shape();
    hc.moveTo(u(zf), yTop); hc.lineTo(u(zf), yT - 0.004); hc.quadraticCurveTo(u(zf), yT, u(zf) + 0.004, yT);
    hc.lineTo(u(zf) + 0.022, yT); hc.bezierCurveTo(u(zf) + 0.05, yT, u(zb) - 0.004, yTop + 0.016, u(zb), yTop + 0.006);
    hc.lineTo(u(zb), yTop); hc.lineTo(u(zf), yTop);
    const xa = s > 0 ? xo - 0.085 : -xo + 0.002;
    cab.add(mesh("HingeCover", new THREE.ExtrudeGeometry(hc, { depth: 0.083, bevelEnabled: false, curveSegments: 10 }).rotateY(Math.PI / 2).translate(xa, 0, 0), hingeM));
    const xt = s > 0 ? xo - 0.085 : -xo + 0.075;
    cab.add(span("HingeCap", xt, xt + 0.01, yT - 0.004, yD1 + 0.024, zf - 0.012, zf - 0.003, hingeM));
  }
  cab.add(span("HingeLow", s > 0 ? xo - 0.06 : -xo + 0.004, s > 0 ? xo - 0.004 : -xo + 0.06, 0.008, yD0 - 0.002, zCab - 0.03, zPiv + 0.012, footM));
  cab.add(cyl("FootFront", 0.017, 0.018, yBot, footM, s * (xo - 0.045), yBot / 2, zCab - 0.04, 16));
  cab.add(cyl("Roller", 0.0115, 0.0115, 0.016, footM, s * (xo - 0.04), 0.0115, zBack + 0.07, 14).rotateZ(Math.PI / 2));
  cab.add(span("RollerBracket", s > 0 ? xo - 0.058 : -xo + 0.022, s > 0 ? xo - 0.022 : -xo + 0.058, 0.018, yBot, zBack + 0.03, zBack + 0.11, footM));
}

// ── inside, fixed: the lit ducts with their black name bars, the lights, vents and Haier's printed words ──
const zWall = zIn + 0.0007;
for (const [c, w, ytop, bar, plate, pw, ph, name] of [[FZ, 0.278, 1.613, 0.153, printMcBar, 0.0978, 0.0162, "Freezer"], [FR, 0.41, 1.625, 0.264, printDeo, 0.0667, 0.0161, "Fridge"]]) {
  const x0 = c.cx - w / 2, x1 = c.cx + w / 2, zd = zIn + 0.05;
  cab.add(span(name + "Duct", x0, x1, SH[0] + 0.0035, ytop, zIn, zd, [linerSide, linerSide, liner, liner, liner, liner]));
  cab.add(span(name + "DuctBar", c.cx - bar / 2, c.cx + bar / 2, 1.551, 1.573, zd, zd + 0.002, barBlack));
  cab.add(plane(name + "DuctPrint", pw, ph, plate, c.cx, 1.562, zd + 0.0027));
  cab.add(span(name + "DuctLine", c.cx - bar / 2, c.cx + bar / 2, 1.578, 1.584, zd, zd + 0.0015, linerGrey));
  cab.add(span(name + "Led", c.cx - w * 0.3, c.cx + w * 0.3, 1.645, 1.659, zIn, zIn + 0.006, lightM));
  // vent slots on the back wall under the first two shelves
  cab.add(joined(name + "Vents", SH.slice(0, 2).map((y) => [c.cx - 0.06, c.cx + 0.06, y - 0.05, y - 0.044, zIn, zIn + 0.004]), ventGrey));
}
cab.add(span("FridgeDuctIcon", FR.cx + 0.17, FR.cx + 0.19, 1.47, 1.49, zIn + 0.05, zIn + 0.0515, linerGrey));
cab.add(plane("PrintMagicZone", 0.1056, 0.0187, printZone, FZ.cx, 1.262, zWall));
cab.add(plane("PrintMagicCooling", 0.1335, 0.0177, printMc, FR.cx - 0.029, 1.262, zWall));
// the white box on the fridge's back wall under the third shelf (open photo: 23 to 288 mm across, 737 to 832 mm up)
cab.add(span("FridgeBackBox", 0.023, 0.288, 0.737, 0.832, zIn, zIn + 0.06, white));
cab.add(span("FridgeBackBoxSlot", 0.1, 0.21, 0.784, 0.79, zIn + 0.06, zIn + 0.0615, ventGrey));
// shelf ledges in the side walls
for (const [c, front] of [[FZ, fzFront], [FR, frFront]]) for (const y of [...SH, cover]) for (const s of [-1, 1]) {
  const x = s < 0 ? c.x0 : c.x1;
  cab.add(span("SideLedge", s < 0 ? x : x - 0.006, s < 0 ? x + 0.006 : x, y - 0.019, y - 0.007, zIn + 0.01, front - 0.03, linerSide));
}

// ── shelves, covers and drawers ──
function shelf(parent, name, c, y, front) {
  const g = group(name), x0 = c.x0, x1 = c.x1;
  g.add(span(name + "Glass", x0 + 0.004, x1 - 0.004, y - 0.003, y + 0.003, zIn + 0.012, front - 0.012, glass));
  g.add(span(name + "Rim", x0 + 0.004, x1 - 0.004, y - 0.003, y + 0.011, front - 0.012, front, glassRim));
  g.add(span(name + "Edge", x0 + 0.004, x1 - 0.004, y - 0.005, y - 0.003, front - 0.003, front, edgeGreen));
  g.add(span(name + "Tab", c.cx - 0.03, c.cx + 0.03, y - 0.012, y - 0.0055, front - 0.008, front + 0.0012, tabGrey));
  g.add(span(name + "RimBack", x0 + 0.004, x1 - 0.004, y - 0.003, y + 0.007, zIn + 0.012, zIn + 0.022, glassRim));
  g.add(span(name + "RailL", x0 + 0.004, x0 + 0.014, y - 0.007, y + 0.007, zIn + 0.012, front - 0.012, glassRim));
  g.add(span(name + "RailR", x1 - 0.014, x1 - 0.004, y - 0.007, y + 0.007, zIn + 0.012, front - 0.012, glassRim));
  parent.add(g);
}
function drawer(parent, name, c, [y0, y1], front, printM, pw, ph, py, dx) {
  const g = group(name + "Box"), zb = zIn + 0.012, x0 = c.x0 + 0.006, x1 = c.x1 - 0.006;
  g.add(span(name + "Floor", x0, x1, y0 - 0.004, y0, zb, front, clear));
  g.add(span(name + "Back", x0, x1, y0, y1, zb, zb + 0.004, clearLight));
  g.add(span(name + "WallL", x0, x0 + 0.004, y0, y1, zb + 0.004, front - 0.004, clear));
  g.add(span(name + "WallR", x1 - 0.004, x1, y0, y1, zb + 0.004, front - 0.004, clear));
  g.add(span(name + "Front", x0, x1, y0, y1, front - 0.004, front, clearLight));
  g.add(span(name + "Rim", x0, x1, y1 - 0.01, y1, front - 0.004, front + 0.004, clearRib));
  g.add(span(name + "FootRim", x0, x1, y0 - 0.004, y0 + 0.008, front - 0.004, front + 0.004, clearRib));
  g.add(plane(name + "Print", pw, ph, printM, c.cx + dx, py, front + 0.0007));
  parent.add(g);
  return { x0, x1, y0, y1, front };
}
// the glass over a lower drawer with its grey front rail (open photo: the band between the two drawers)
function drawerCover(parent, name, c, yG, yRail, front) {
  const g = group(name);
  g.add(span(name + "Glass", c.x0 + 0.004, c.x1 - 0.004, yG - 0.003, yG + 0.003, zIn + 0.012, front - 0.02, glass));
  g.add(span(name + "Rail", c.x0 + 0.004, c.x1 - 0.004, yRail, yG + 0.003, front - 0.02, front, linerGrey));
  parent.add(g);
}

// freezer: three shelves, the glass cover with the twist ice maker, the cover over the lower drawer; the drawers are a part
for (const [i, y] of SH.entries()) shelf(cab, `FzShelf${i + 1}`, FZ, y, fzFront);
shelf(cab, "FzCover", FZ, cover, fzFront);
drawerCover(cab, "FzDrawerCover", FZ, fzUp[0] - 0.005, fzLow[1] + 0.002, fzFront);
// the twist ice maker on the cover at the left (open photo: 155 mm wide, 164 mm tall; its depth ESTIMATED): the housing with
// its twist handle and ICEMAKER label above two clear ice trays
{
  const x0 = -0.392, x1 = -0.237, zf = fzFront - 0.01, zb = zf - 0.22, y = cover + 0.003;
  cab.add(span("IceMakerHousing", x0, x1, y + 0.088, y + 0.164, zb, zf, white));
  cab.add(span("IceMakerHandle", (x0 + x1) / 2 - 0.06, (x0 + x1) / 2 + 0.06, y + 0.164, y + 0.17, zf - 0.03, zf - 0.012, linerGrey));
  cab.add(plane("IceMakerLabel", 0.0304, 0.0064, printIce, (x0 + x1) / 2 - 0.02, y + 0.13, zf + 0.0007));
  for (const [i, [a, b]] of [[0, 0.043], [0.045, 0.087]].entries()) {
    cab.add(span(`IceTray${i + 1}`, x0 + 0.004, x1 - 0.004, y + a, y + b, zb + 0.004, zf - 0.004, clear));
    cab.add(span(`IceTray${i + 1}Rim`, x0 + 0.002, x1 - 0.002, y + b - 0.006, y + b, zf - 0.006, zf, clearRib));
  }
}
const fzDrawer = group("FreezerDrawer");
cab.add(fzDrawer);
const fzD1 = drawer(fzDrawer, "FreezeBoxUp", FZ, fzUp, fzFront, printFreeze, 0.093, 0.018, 0.4957, -0.042);
const fzD2 = drawer(fzDrawer, "FreezeBoxLow", FZ, fzLow, fzFront, printFreeze, 0.093, 0.018, 0.228, -0.042);

// fridge: everything that lifts out (three shelves, the cover, the two FRESHBOX drawers) is one part with its food
const trays = group("FridgeTrays");
cab.add(trays);
for (const [i, y] of SH.entries()) shelf(trays, `FrShelf${i + 1}`, FR, y, frFront);
shelf(trays, "FrCover", FR, cover, frFront);
drawerCover(trays, "FrDrawerCover", FR, frUp[0] - 0.005, frLow[1] + 0.002, frFront);
const frD1 = drawer(trays, "FreshBoxUp", FR, frUp, frFront, printFresh, 0.0853, 0.018, 0.502, -0.033);
const frD2 = drawer(trays, "FreshBoxLow", FR, frLow, frFront, printFresh, 0.0853, 0.018, 0.238, -0.033);

// ── stock: vegetarian South Indian food, eggs, juices, water and soft drinks (the fitting helpers of the LG 650 L) ──
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
// eggs standing in a white egg tray (Haier's stocked photo: eggs in the fridge door's top bin)
function eggTray(name, n) {
  const g = group(name), w = n * 0.046 + 0.006;
  g.add(box(name + "Base", w, 0.012, 0.05, K.eggTray, 0, 0.006, 0));
  for (let i = 0; i < n; i++) { const e = food.egg("Egg" + i, -w / 2 + 0.026 + i * 0.046, 0.004, 0, i + 1); e.userData.stock = false; g.add(e); }
  return tag(g);
}
const face = (o) => { o.rotation.y = Math.PI; return o; };

// fitting (BENCHMARK.md section 13), as the LG 650 L: every group an item sits in is only moved, never turned
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
const HEAP = ["Drumstick", "Cabbage", "Cauliflower", "Onion", "Potato", "Brinjal", "Capsicum", "Carrot", "Tomato", "LadiesFinger", "Coriander", "CurryLeaves", "GreenChilli", "AmulVanillaMagic", "AmulRajbhog", "FreshoGreenPeas", "ViswasParotta", "NityaParotta", "AmulPaneer"];
function heap(parent, name, cx, dr, items) {
  const g = group(name, cx, dr.y0, 0);
  parent.add(g);
  const B = { hw: (dr.x1 - dr.x0) / 2 - 0.012, z0: zIn + 0.03, z1: dr.front - 0.012 };
  items.forEach((o) => g.add(o));
  settle(items.slice().sort((a, b) => HEAP.indexOf(a.name.replace(/\d+$/, "")) - HEAP.indexOf(b.name.replace(/\d+$/, ""))), { tries: 30, spread: 0.08, bounds: B, ceil: dr.ceil - dr.y0 });
  return g;
}
const ring = (n, cx, cz, r, k) => [...Array(n)].map((_, i) => [cx + Math.cos(i * 2.4 + k) * r * Math.sqrt(i / n), cz + Math.sin(i * 2.4 + k) * r * Math.sqrt(i / n)]);
const at = (o, x, z) => { o.position.x = x; o.position.z = z; return o; };

// the fridge (Haier's stocked photo: bottles and dishes on the shelves, fruit in the upper FRESHBOX, vegetables below)
{
  const B = { hw: FR.hw - 0.02, z0: zIn + 0.03, z1: frFront - 0.0125 };
  // the top shelf's stock is "Shelf1Stock" and the upper drawer's "FreshZoneStock": the trays page test finds them by name.
  // The DEO FRESH duct stands 50 mm off the back wall over the top shelf: its stock starts in front of it
  const milk = pouch("NandiniMilk", "nandini_toned_milk");
  tray(trays, "Shelf1Stock", FR.cx, SH[0] + 0.003, { ...B, z0: zIn + 0.065 }, [
    [tiffin("Tiffin"), pouch("IdBatterPouch", "id_batter", true, 0.85), carton("MastiButtermilk", "amul_masti_buttermilk", 4)],
    [milk],
  ], (g) => ["aavin_milk", "amul_taaza_pouch"].forEach((k, i) => g.add(at(pouch(i ? "AmulTaazaPouch" : "AavinMilk", k), milk.position.x, milk.position.z))));
  tray(trays, "FrShelf2Stock", FR.cx, SH[1] + 0.003, B, [
    [food.coconutHalf("CoconutHalf", 0, 0, 0, 1), food.melonHalf("WatermelonHalf", 0, 0, 0, 1)],
    [paperTub("NandhanaPalace", "nandana_tub_wrap", 0.0525, 0.075), paperTub("NandhanaPalace2", "nandana_tub_wrap", 0.0525, 0.075), tin("RnrBiryani", "rnr_tin_lid", 0.06, 0.06)],
  ]);
  tray(trays, "FrShelf3Stock", FR.cx, SH[2] + 0.003, B, [
    [food.bananaBunch("Bananas", 0, 0, 0, 5, 1), food.grapes("Grapes", 0, 0, 0, 1), food.lemon("Lemon", 0, 0, 0, 1)],
    [...[1, 2].map((i) => food.apple("Apple", 0, 0, 0, i)), ...[3, 4].map((i) => food.orange("Orange", 0, 0, 0, i))],
  ]);
  tray(trays, "FrCoverStock", FR.cx, cover + 0.003, { ...B, z0: zIn + 0.075 }, [
    [brick("AmulButter1", "amul_butter", 0.085, 0.032, 0.055, K.butter), brick("AmulCheese", "amul_cheese_slices", 0.12, 0.03, 0.12, K.cheese)],
    [1, 2, 3].map((i) => cupWithLid("AmulMastiCup" + i, "amul_masti_dahi_lid", 0.04, 0.05)).concat([pouch("AmulPaneerFr", "amul_paneer", false, 0.8)]),
  ]);
  // upper FRESHBOX: the vegetables; lower: onions, potatoes and the big heads
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
  heap(trays, "FreshZoneStock", FR.cx, { ...frD1, ceil: cover - 0.003 - 0.012 }, v);
  const w = [];
  w.push(at(food.cabbage("Cabbage", 0, 0, 0, 1), -0.12, -0.2));
  w.push(at(food.cauliflower("Cauliflower", 0, 0, 0, 1), 0.1, -0.2));
  for (let i = 0; i < 8; i++) w.push(at(food.onion("Onion", 0, 0, 0, i + 1), -0.15 + (i % 4) * 0.07, -0.05 + Math.floor(i / 4) * 0.07));
  for (let i = 0; i < 6; i++) w.push(at(food.potato("Potato", 0, 0, 0, i + 1), 0.05 + (i % 3) * 0.06, -0.02 + Math.floor(i / 3) * 0.06));
  heap(trays, "FrDrawerLowStock", FR.cx, { ...frD2, ceil: frUp[0] - 0.008 - 0.012 }, w);
}
// the freezer (Haier's stocked photo: ice-cream tubs in the drawers, packs on the shelves); the cover holds the ice maker
{
  const B = { hw: FZ.hw - 0.02, z0: zIn + 0.03, z1: fzFront - 0.0125 };
  tray(cab, "FzShelf1Stock", FZ.cx, SH[0] + 0.003, { ...B, z0: zIn + 0.065 }, [[iceTub("AmulVanillaMagic", "amul_vanilla_magic_lid", 0.16, 0.085, 0.16), pouch("FreshoGreenPeas", "fresho_green_peas", false, 0.5)]]);
  tray(cab, "FzShelf2Stock", FZ.cx, SH[1] + 0.003, B, [[pouch("ViswasParotta", "viswas_parotta", false, 0.75)], [pouch("NityaParotta", "nitya_parotta", false, 0.75)]]);
  tray(cab, "FzShelf3Stock", FZ.cx, SH[2] + 0.003, B, [[pouch("FreshoGreenPeas3", "fresho_green_peas", false, 0.75)], [pouch("AmulPaneer", "amul_paneer", false, 0.75)]]);
  const u = [];
  u.push(at(iceTub("AmulVanillaMagic2", "amul_vanilla_magic_lid", 0.16, 0.085, 0.16), -0.06, -0.15));
  u.push(at(iceTub("AmulRajbhog", "amul_rajbhog_lid", 0.16, 0.085, 0.16), 0.0, 0.0));
  u.push(at(pouch("FreshoGreenPeas4", "fresho_green_peas", false, 0.8), 0.04, -0.22));
  heap(fzDrawer, "FzDrawerUpStock", FZ.cx, { ...fzD1, ceil: cover - 0.003 - 0.012 }, u);
  const f = [];
  f.push(at(pouch("ViswasParotta2", "viswas_parotta", false, 0.8), 0.03, -0.05));
  f.push(at(pouch("NityaParotta3", "nitya_parotta", false, 0.8), -0.03, -0.12));
  f.push(at(pouch("AmulPaneer2", "amul_paneer", false, 0.8), 0.0, 0.02));
  f.push(at(pouch("FreshoGreenPeas5", "fresho_green_peas", false, 0.9), 0.05, -0.2));
  heap(fzDrawer, "FzDrawerLowStock", FZ.cx, { ...fzD2, ceil: fzUp[0] - 0.008 - 0.012 }, f);
}

// ── doors: the freezer hinged on the left, the fridge on the right ──
// a non-indexed geometry's triangles sorted into material groups by pick(group, centroid) -> material index
function regroup(geo, pick) {
  const src = geo.attributes, n = src.position.count / 3, groups = geo.groups.length ? geo.groups : [{ start: 0, count: n * 3, materialIndex: 0 }];
  const tri = [];
  for (const gr of groups) for (let t = gr.start / 3; t < (gr.start + gr.count) / 3; t++) {
    const c = new THREE.Vector3();
    for (let k = 0; k < 3; k++) c.add(new THREE.Vector3().fromBufferAttribute(src.position, 3 * t + k));
    tri.push([pick(gr.materialIndex, c.multiplyScalar(1 / 3)), t]);
  }
  tri.sort((a, b) => a[0] - b[0]);
  const out = new THREE.BufferGeometry();
  for (const [k, a] of Object.entries(src)) {
    const arr = new a.array.constructor(a.array.length);
    tri.forEach(([, t], i) => arr.set(a.array.subarray(3 * t * a.itemSize, 3 * (t + 1) * a.itemSize), 3 * i * a.itemSize));
    out.setAttribute(k, new THREE.BufferAttribute(arr, a.itemSize));
  }
  let s = 0;
  while (s < tri.length) { let e = s; while (e < tri.length && tri[e][0] === tri[s][0]) e++; out.addGroup(3 * s, 3 * (e - s), tri[s][0]); s = e; }
  return out;
}
// a door body from x0 to x1 (door space), with a grip slot in its x1 side (sx 1) or x0 side (sx -1); the photo on its front
// spans u0 to u1 and the door's height. The face is one 5 mm skin across the whole door, so no joint runs down it (a joint
// between two boxes on the face showed the dark slot walls through it as a 1-pixel line); behind it the body and the side
// strip, the strip cut through by the slot (a hole with rounded ends, as both 3/4 photos show), its walls dark
function body(g, name, x0, x1, sx, F, u0, u1) {
  const [ys0, ys1] = slotY, [zs0, zs1] = slotZ, h = doorH, E = doorEdge, R = recess, Bk = doorBack, tS = 0.005;
  const xs = sx > 0 ? x1 - slotD : x0 + slotD;
  const [bx0, bx1] = sx > 0 ? [x0, xs] : [xs, x1];
  const ex0 = sx > 0 ? xs : x0;
  g.add(frontUV(span(name + "Face", x0, x1, 0, h, zF - tS, zF, [E, E, E, E, F, E]), u0, u1, h, 0));
  // (its face to the strip is DoorEdge too, the slot's floor: headless Chrome's software renderer lets edge-on faces behind a
  // closed door win a sample, and a dark face there drew a dark line down the door)
  g.add(span(name + "Body", bx0, bx1, 0, h, zB, zF - tS, [E, E, E, E, E, Bk]));
  // the strip's outline in (u = -z, y), the slot a hole in it, extruded across x
  const r = (zs1 - zs0) / 2, uA = -zs1, uB = -zs0, uc = (uA + uB) / 2;
  const sh = new THREE.Shape();
  sh.moveTo(-(zF - tS), 0); sh.lineTo(-zB, 0); sh.lineTo(-zB, h); sh.lineTo(-(zF - tS), h); sh.lineTo(-(zF - tS), 0);
  const hole = new THREE.Path();
  hole.moveTo(uA, ys0 + r); hole.lineTo(uA, ys1 - r); hole.absarc(uc, ys1 - r, r, Math.PI, 0, true);
  hole.lineTo(uB, ys0 + r); hole.absarc(uc, ys0 + r, r, 0, Math.PI, true);
  sh.holes.push(hole);
  let geo = new THREE.ExtrudeGeometry(sh, { depth: slotD, bevelEnabled: false, curveSegments: 10 }).rotateY(Math.PI / 2).translate(ex0, 0, 0);
  // caps (the side face and the inner face) DoorEdge; walls: the back DoorLiner, the slot Recess, the rest DoorEdge
  geo = regroup(geo, (gi, c) => (gi === 0 ? 0 : Math.abs(c.z - zB) < 1e-5 ? 1 : c.z > zs0 - 1e-4 && c.z < zs1 + 1e-4 && c.y > ys0 - 1e-4 && c.y < ys1 + 1e-4 ? 2 : 0));
  g.add(mesh(name + "SlotSide", geo, [E, Bk, R]));
}
// a door's moulded liner block, x0..x1, y0..y1 at the door's back (zb), its face at zl inset by d on every side (a moulding's
// draft, as the HRT-683): square sides sat edge-on to the straight-on camera, and headless Chrome's software renderer let some
// of their samples through the closed door as thin light lines
function linerBlock(name, x0, x1, y0, y1, zl, zb, d, m) {
  const A = [[x0 + d, y0 + d, zl], [x1 - d, y0 + d, zl], [x1 - d, y1 - d, zl], [x0 + d, y1 - d, zl]], Bq = [[x0, y0, zb], [x1, y0, zb], [x1, y1, zb], [x0, y1, zb]];
  const quads = [[A[1], A[0], A[3], A[2]], [A[0], A[1], Bq[1], Bq[0]], [A[1], A[2], Bq[2], Bq[1]], [A[2], A[3], Bq[3], Bq[2]], [A[3], A[0], Bq[0], Bq[3]]];
  const pos = [];
  for (const [a, b, c, e] of quads) pos.push(...a, ...b, ...c, ...a, ...c, ...e);
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute("uv", new THREE.Float32BufferAttribute(new Array((pos.length / 3) * 2).fill(0), 2));
  geo.computeVertexNormals();
  return mesh(name, geo, m);
}
// the gasket round the opening, the liner block inside it and the bins standing on the liner's face (door space)
function doorInside(g, name, c) {
  const L = (x) => x - g.position.x, y0 = yFloor - yD0, y1 = yCeil - yD0, zg0 = zB - 0.0145, zl = linerFace - zPiv;
  const ox0 = L(c.x0) - 0.018, ox1 = L(c.x1) + 0.018, oy0 = y0 - 0.018, oy1 = y1 + 0.018;
  g.add(span(name + "GasketT", ox0, ox1, y1, oy1, zg0, zB, gasket));
  g.add(span(name + "GasketB", ox0, ox1, oy0, y0, zg0, zB, gasket));
  g.add(span(name + "GasketL", ox0, L(c.x0), y0, y1, zg0, zB, gasket));
  g.add(span(name + "GasketR", L(c.x1), ox1, y0, y1, zg0, zB, gasket));
  g.add(linerBlock(name + "Liner", L(c.x0) + 0.004, L(c.x1) - 0.004, y0 + 0.004, y1 - 0.004, zl, zB, 0.008, doorBack));
  const B = BINS[name], bx0 = L(c.x0) + 0.016, bx1 = L(c.x1) - 0.016, out = [];
  B.at.forEach(([fy, h], i) => {
    const f = fy - yD0, za = zl, zb = zl - B.d;
    g.add(span(`${name}Bin${i}Floor`, bx0, bx1, f, f + 0.004, zb, za, clear));
    g.add(span(`${name}Bin${i}Lip`, bx0 + 0.004, bx1 - 0.004, f + 0.004, f + h - 0.008, zb, zb + 0.004, clear));
    g.add(span(`${name}Bin${i}Rim`, bx0, bx1, f + h - 0.008, f + h, zb, zb + 0.006, clearRib));
    g.add(span(`${name}Bin${i}EndL`, bx0, bx0 + 0.004, f + 0.004, f + h, zb, za, clear));
    g.add(span(`${name}Bin${i}EndR`, bx1 - 0.004, bx1, f + 0.004, f + h, zb, za, clear));
    out.push({ x0: bx0 + 0.008, x1: bx1 - 0.008, zm: zl - B.d / 2, y: f + 0.004 });
  });
  return out;
}
const row = (g, inside, items) => { items.forEach((o) => { face(o); o.position.y = inside.y; g.add(o); }); lineUp(items, inside.x0, inside.x1, inside.zm, { middle: true }); };

const freezerDoor = group("FreezerDoor", -pivX, yD0, zPiv);
{
  const L = (x) => x + pivX;
  body(freezerDoor, "FreezerDoor", L(-xo), L(fzEdge), 1, doorFzM, L(-xo), L(fzFace1));
  // its bright rounded edge down the face's right side (front photo: -69.3 to -60.5 mm)
  freezerDoor.add(span("FreezerDoorTrim", L(fzFace1), L(fzEdge) + 0.0002, 0, doorH, zF - 0.0045, zF + 0.0005, trimM));
  // a thin bright line down the hinge side's front corner too (both 3/4 photos)
  freezerDoor.add(span("FreezerDoorTrimOut", L(-xo) - 0.0002, L(-xo) + 0.0025, 0, doorH, zF - 0.004, zF + 0.0005, trimM));
  const bins = doorInside(freezerDoor, "FreezerDoor", FZ);
  const packs = [["fresho_green_peas", "viswas_parotta", "amul_paneer"], ["nitya_parotta", "fresho_green_peas", "amul_paneer"], ["viswas_parotta", "amul_paneer", "fresho_green_peas"]];
  bins.forEach((b, i) => row(freezerDoor, b, packs[i].map((k, j) => pouch(`FzPack${j}`, k, true, 0.5))));
}
const fridgeDoor = group("FridgeDoor", pivX, yD0, zPiv);
{
  const L = (x) => x - pivX, zStep = zF - stepBack;
  body(fridgeDoor, "FridgeDoor", L(frStep1), L(xo), -1, doorFrM, L(frFace0), L(xo));
  fridgeDoor.add(span("FridgeDoorTrim", L(frStep1) - 0.0002, L(frFace0), 0, doorH, zF - 0.0045, zF + 0.0005, trimM));
  fridgeDoor.add(span("FridgeDoorTrimOut", L(xo) - 0.0025, L(xo) + 0.0002, 0, doorH, zF - 0.004, zF + 0.0005, trimM));
  // the step: the photo's own fall down it below the display; behind the display the top of that strip
  const yS = 1.237 - yD0;
  fridgeDoor.add(frontUV(span("FridgeDoorStep", L(frX0), L(frStep1), 0, yS, zB, zStep, [doorEdge, doorEdge, doorEdge, doorEdge, channelM, doorBack]), L(frX0), L(frStep1), yS, 0));
  const up = span("FridgeDoorStepTop", L(frX0), L(frStep1), yS, doorH, zB, zStep, [doorEdge, doorEdge, doorEdge, doorEdge, channelM, doorBack]);
  { const uv = up.geometry.attributes.uv, n = up.geometry.attributes.normal; for (let i = 0; i < uv.count; i++) if (n.getZ(i) > 0.5) uv.setXY(i, 0.5, 0.002); }
  fridgeDoor.add(up);
  // the black glass display, its bottom edge slanting down to the right, and every word on it (display_print.png)
  const sh = new THREE.Shape(), a = L(frX0 - 0.0005), b = L(frStep1 + 0.0005);
  sh.moveTo(a, dispL - yD0); sh.lineTo(b, dispR - yD0); sh.lineTo(b, doorH - 0.0005); sh.lineTo(a, doorH - 0.0005); sh.lineTo(a, dispL - yD0);
  fridgeDoor.add(mesh("DisplayGlass", new THREE.ExtrudeGeometry(sh, { depth: 0.002, bevelEnabled: false, curveSegments: 1 }), [dispM, dispM], 0, 0, zStep));
  fridgeDoor.add(plane("DisplayPrint", 0.043, 0.216, printDisp, (a + b) / 2, doorH - 0.248, zStep + 0.0027));
  // the Haier wordmark top right (front photo: 78 mm wide, centred 367 mm right of the middle and 1675 mm up)
  // (logo.png carries 6 clear pixels round the 562 x 173 px ink, so the plane is that much larger)
  fridgeDoor.add(plane("HaierMarkDecal", 0.078 * 574 / 562, 0.078 / 3.249 * 185 / 173, logoM, L(0.3667), 1.6748 - yD0, zF + 0.0007));
  const bins = doorInside(fridgeDoor, "FridgeDoor", FR);
  row(fridgeDoor, bins[0], [eggTray("EggTray", 8)]);
  row(fridgeDoor, bins[1], [brandJar("MothersPickle", "mothers_mango_pickle", 0.036, 0.07, K.jarGreen, K.goldLid), brandJar("MothersPickle2", "mothers_mango_pickle", 0.036, 0.07, K.jarGreen, K.goldLid),
    brandJar("AavinGhee", "aavin_ghee_jar", 0.034, 0.07, K.amber, K.goldLid), pouch("SakthiSambar", "sakthi_sambar_powder", true, 0.8)]);
  row(fridgeDoor, bins[2], [carton("RealMango", "real_mango", 2), carton("RealMixedFruit", "real_mixed_fruit", 1), carton("AmulTaaza", "amul_taaza_carton", 3), pouch("NandiniGhee", "nandini_ghee_pouch", true, 0.7)]);
  row(fridgeDoor, bins[3], [petBrand("Coke", "coke_label", 0.042, 0.3, 0x2a1408, 0xc42b22), petBrand("Fanta", "fanta_label", 0.042, 0.3, 0xe8820e, 0xe07a12),
    petBrand("ThumsUp", "thumsup_label", 0.042, 0.3, 0x2a1408, 0x1b3a8c), petBrand("Bisleri", "bisleri_label", 0.0345, 0.265, 0xcfe9f7, 0x1a6fb0, 0.6)]);
  const cans = [[0x1b2d72, "thumsup_can", 0.105], [0xb82a20, "coke_label", 0.06], [0xe8820e, "fanta_label", 0.06]];
  row(fridgeDoor, bins[4], [petBrand("Bisleri2", "bisleri_label", 0.0345, 0.265, 0xcfe9f7, 0x1a6fb0, 0.6), petBrand("Bisleri3", "bisleri_label", 0.0345, 0.265, 0xcfe9f7, 0x1a6fb0, 0.6),
    ...cans.map(([col, key, lh]) => food.can("Can", col, 0, 0, 0, brand(key), arcFor(asp(key, 1) * lh, 0.033), lh))]);
}
root.add(freezerDoor, fridgeDoor);

// every mesh written without an index (the extruded and stock shapes) gets one, its repeated corners shared: the same
// triangles, normals and texture places, in less of the file (as the Samsung RS76CG8113)
{
  const done = new Map();
  root.traverse((o) => {
    if (!o.isMesh || o.geometry.index) return;
    if (!done.has(o.geometry)) done.set(o.geometry, mergeVertices(o.geometry, 1e-6));
    o.geometry = done.get(o.geometry);
  });
}
const parts = productParts(PRODUCTS, ID);
// what a slide may travel with its door open (the LG 650 L's check): points 1 cm apart through every mesh of the open door,
// tested against each sliding mesh's box
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
const used = new Set();
root.traverse((o) => o.material && [].concat(o.material).forEach((m) => used.add(m.name)));
const only = (t) => Object.fromEntries(Object.entries(t).filter(([k]) => used.has(k)));
// Grain (BENCHMARK.md section 10): Haier names the door "Steel" in Graphite Black; its photos show a fine level brushing under
// a soft sheen, so a soft hairline runs across the doors under a light clear coat. The painted sides and top get the soft
// peel. The prints are their own decals with no grain.
await exportGLB(root, clips, OUT, only({
  DoorFreezer: `${T}/door_freezer_gk.jpg`, DoorFridge: `${T}/door_fridge_gk.jpg`, ChannelFace: `${T}/channel_gk.jpg`,
  print_display: `${T}/display_print.png`, HaierMark: `${T}/logo.png`, RearPlate: `${T}/rear.jpg`, Bay: `${T}/bay.jpg`,
  print_deofresh: `${T}/print_deofresh.png`, print_magiccooling_bar: `${T}/print_magiccooling_bar.png`, print_magiczone: `${T}/print_magiczone.png`,
  print_magiccooling: `${T}/print_magiccooling.png`, print_freezebox: `${T}/print_freezebox.png`, print_freshbox: `${T}/print_freshbox.png`,
  print_icemaker: `${T}/print_icemaker.png`,
  ...food.textures(`${TEX}/food`),
  ...Object.fromEntries(Object.keys(labelMats).map((n) => [n, `${TEX}/brands/small/${n.slice(3)}.jpg`])),
}), { dir: `${TEX}/grain`, materials: {
  DoorFreezer: { type: "hairline_soft", dir: "h", clearcoat: [0.2, 0.15] },
  DoorFridge: { type: "hairline_soft", dir: "h", clearcoat: [0.2, 0.15] },
  DoorEdge: { type: "hairline_soft", dir: "h" },
  SidePaint: { type: "peel_soft" }, TopPaint: { type: "peel_soft" },
} });

// ── the two colours as material variants (KHR_materials_variants): Graphite Black (HES-690GK, the listed one, first) and
// Shiny Silver (HES-690SS), each from its own photos. On Haier's Shiny Silver photos the doors and their edges are a light
// brushed silver, the sides and top a mid grey (3/4 photos 105 to 120 against Graphite Black's 49); the display, the
// trims, the hinge covers, the back and the inside are the same on both ──
{
  const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
  const doc = await io.readBinary(new Uint8Array(fs.readFileSync(OUT)));
  const ext = doc.createExtension(KHRMaterialsVariants);
  const lin = (c) => ((c / 255) <= 0.04045 ? c / 255 / 12.92 : Math.pow((c / 255 + 0.055) / 1.055, 2.4));
  const SS = {
    DoorFreezer: { tex: `${T}/door_freezer_ss.jpg`, metal: 0.4, rough: 0.45 },
    DoorFridge: { tex: `${T}/door_fridge_ss.jpg`, metal: 0.4, rough: 0.45 },
    ChannelFace: { tex: `${T}/channel_ss.jpg`, metal: 0.4, rough: 0.45 },
    DoorEdge: { color: [168, 171, 176], metal: 0.6, rough: 0.4 },
    SidePaint: { color: [112, 114, 118], metal: 0.4, rough: 0.5 },
    TopPaint: { color: [112, 114, 118], metal: 0.4, rough: 0.55 },
    CabFrame: { color: [112, 114, 118], metal: 0.3, rough: 0.6 },
  };
  const FIN = [["Graphite Black", {}], ["Shiny Silver", SS]];
  const vs = FIN.map(([n]) => ext.createVariant(n));
  const mats = doc.getRoot().listMaterials(), alt = {};
  for (const name of new Set(FIN.flatMap(([, t]) => Object.keys(t)))) {
    const base = mats.find((m) => m.getName() === name);
    if (!base) throw new Error(`no material ${name}`);
    alt[name] = FIN.map(([fn, t]) => {
      const v = t[name];
      if (!v) return base;
      const m = base.clone().setName(`${name}${fn.replace(/\s+/g, "")}`);
      if (v.tex) m.setBaseColorTexture(doc.createTexture(m.getName()).setImage(new Uint8Array(fs.readFileSync(v.tex))).setMimeType("image/jpeg"));
      if (v.color) m.setBaseColorFactor([...v.color.map(lin), 1]);
      if (v.metal != null) m.setMetallicFactor(v.metal);
      if (v.rough != null) m.setRoughnessFactor(v.rough);
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
  console.log(OUT, (fs.statSync(OUT).size / 1048576).toFixed(2) + " MB with", FIN.length, "colours");
}
