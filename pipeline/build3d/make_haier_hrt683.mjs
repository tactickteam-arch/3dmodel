// Haier HRT-683GKU1, a 598 L three-door side-by-side refrigerator, Graphite Black, with the four other colours Haier India
// sells this body in (HRT-683ISU1 Inox Steel, HRT-683KGU1 Black Glass, HRT-683GOGU1 Grey Onyx Glass, HRT-683PWGU1 Pearl
// White Glass) as KHR_materials_variants. The client's list called it "683 L"; Haier's page for this code gives 598 L.
// Built to Haier's published size, 905 W x 1775 H x 697 D mm (Haier India's page for each of the five codes), from Haier's
// gallery photos of this model (straight front, both three-quarter views, open with every door, stocked, the freezer close
// up, rear) and each colour's own straight front: the convertible Magic Zone behind the upper left door, the freezer behind
// the lower left door, the fridge behind one full-height door on the right. The fridge door's left 60 mm is a step set back
// from its face, with the black glass display at its top and the chrome recess handle below; the two left doors have grip
// slots in their right sides. Inside, as Haier's open photos show: the Magic Zone's lit MAGIC COOLING duct, two glass
// shelves and a FRESHBOX drawer; the freezer's three-tray twist ice maker, the ICEPLUS bin and two FREEZEBOX drawers; the
// fridge's DEO FRESH duct, three glass shelves, a glass cover and two FRESHBOX drawers; three bins on the Magic Zone door
// and five on the fridge door. The fridge's shelves and drawers lift out (FridgeTrays). Stocked for a south Indian kitchen
// as Haier's stocked photo is: desserts in the Magic Zone, ice cream and frozen packs in the freezer, eggs in the fridge
// door's top bin.
// usage: node make_haier_hrt683.mjs <products.json> <tex dir> <out.glb>
import fs from "node:fs";
import { THREE, mat, mesh, box, group, flipV, stateClips, exportGLB, productParts, saveZones } from "./lib.mjs";
import { Food } from "./food.mjs";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { NodeIO } from "@gltf-transform/core";
import { ALL_EXTENSIONS, KHRMaterialsVariants, KHRMaterialsClearcoat } from "@gltf-transform/extensions";

const [PRODUCTS, TEX, OUT] = process.argv.slice(2);
const ID = "haier-hrt-683gku1";
const T = `${TEX}/haier_hrt683`;
const rp = JSON.parse(fs.readFileSync(`${T}/rear_paths.json`, "utf8"));
const FIN = JSON.parse(fs.readFileSync(`${T}/finishes.json`, "utf8"));

// ── size (metres): Haier's 905 x 1775 x 697 mm (VERIFIED); everything else measured on Haier's photos (NOTES.md, ESTIMATED) ──
const W = 0.905, H = 1.775, D = 0.697;
const xo = W / 2;
const zBack = -D / 2;
const zCab = zBack + 0.610;           // the cabinet's front: 610 mm deep (the same body as the HES-690: doors 72 mm)
const zDb = zCab + 0.015;             // the doors' back, behind a 15 mm gasket
const zDf = D / 2;                    // the doors' front
const zPiv = zDb + 0.02, pivX = xo - 0.012;   // hinge pins inside each door's outer back corner
const zF = zDf - zPiv, zB = zDb - zPiv;       // a door's front and back in its own frame
// doors (gk_front.jpg, 0.611 px per mm, door rows 60-1122): the right door and the freezer door from 29 mm up, the right
// door and the Magic Zone door to 1766; the left split 812 / 822
const yD0 = 0.029, yD1 = 1.766, ySplit0 = 0.812, ySplit1 = 0.822;
const yBot = 0.025, yTop = rp.y_top;  // the cabinet's bottom; its top 1747 (rear photo: the box on top stands 28 mm over it)
const xIn = xo - 0.051;               // inner wall faces (51 mm walls)
const mul0 = -0.090, mul1 = -0.041;   // the mullion (gk_open.jpg, 0.565 px per mm: columns 549-577)
const yCeil = 1.706, yFloor = 0.083;
const yDiv0 = 0.773, yDiv1 = 0.830;   // the shelf between the Magic Zone and the freezer (gk_open.jpg rows 628-660)
const zIn = zBack + 0.065;            // the inner back wall
const ZN = { x0: -xIn, x1: mul0, y0: yDiv1, y1: yCeil }, FZ = { x0: -xIn, x1: mul0, y0: yFloor, y1: yDiv0 }, FR = { x0: mul1, x1: xIn, y0: yFloor, y1: yCeil };
for (const c of [ZN, FZ, FR]) { c.cx = (c.x0 + c.x1) / 2; c.hw = (c.x1 - c.x0) / 2; }
// across the front (gk_front.jpg): the left doors' faces to -80 mm and their bright rounded edge to -71.5; a 2 mm gap; the
// fridge door's step from -69.5 to -10 mm (set back 25 mm): a black strip to -56, the display over the chrome channel to
// -10; a bright strip on the face's corner to +1.5, the fridge face from there to the right edge
const lEdge = -0.0715, lFace1 = -0.080, frX0 = -0.0695, frStep1 = -0.010, frFace0 = 0.0015, stepBack = 0.025;
// the display: black glass from -56 mm to the step's right edge, from the door's top down to 1338 mm at its left and
// 1284 mm at its right (gk_front.jpg rows 322 and 355)
const dispX0 = -0.056, dispL = 1.338, dispR = 1.284;
// shelves (glass tops), covers and drawers, from gk_open.jpg (0.565 px per mm, the floor at row 1097)
const ZSH = [1.404, 1.175], zBox = [0.874, 1.004];
const FRSH = [1.404, 1.110, 0.788], frCover = 0.623, frUp = [0.390, 0.605], frLow = [0.100, 0.360];
const iceMk = [0.694, 0.765], iceBin = [0.623, 0.688], fzUp = [0.384, 0.593], fzRail = [0.354, 0.379], fzLow = [0.092, 0.349];
// door bins: floor heights on gk_open.jpg (the open doors' own scale), heights; depths ESTIMATED. The freezer door's liner
// is plain (gk_open.jpg)
const linerFace = zCab - 0.016;
const BINS = {
  ZoneDoor: { d: 0.09, at: [[1.500, 0.075], [1.182, 0.08], [0.856, 0.09]] },
  FreezerDoor: { d: 0.09, at: [] },
  FridgeDoor: { d: 0.095, at: [[1.481, 0.07], [1.176, 0.1], [0.82, 0.1], [0.442, 0.1], [0.143, 0.1]] },
};
const zFront = (key) => linerFace - (BINS[key].d || 0.09) - 0.01;
const znFront = zFront("ZoneDoor"), fzFront = linerFace - 0.012, frFront = zFront("FridgeDoor");
// the left doors' grip slots in their right sides (gk_open_left.jpg, ESTIMATED): the Magic Zone door's from 1190 to 1350 mm
// up, the freezer door's from 610 to 790 mm; 15 mm wide, drawn as the slot's dark opening on the door's side
const slotZ = [zF - 0.022, zF - 0.007];

// ── materials ──
// Graphite Black (HRT-683GKU1): Haier's photo on the faces (its colour), a pre-coated metal with a fine sheen; the other
// colours swap the photo or the colour and the finish below (variants at the end)
const doorZnM = mat("DoorZone", 0x3f4659, { metal: 0.3, rough: 0.55 });
const doorFzM = mat("DoorFreezer", 0x3f4659, { metal: 0.3, rough: 0.55 });
const doorFrM = mat("DoorFridge", 0x3f4659, { metal: 0.3, rough: 0.55 });
const channelM = mat("ChannelFace", 0x202124, { metal: 0.5, rough: 0.3 });
const doorEdge = mat("DoorEdge", 0x2b2f3a, { metal: 0.3, rough: 0.75 });   // rough, so the lower doors' tops stay dark from above, as the split in Haier's photos
const recess = mat("Recess", 0x141518, { rough: 0.7 });
// the left doors' end caps and seal at the split between the Magic Zone and the freezer: dark moulded plastic, so the
// 10 mm gap reads as the dark line it is in every Haier front (gk_front.jpg, kg_front.jpg, pwg_front.jpg)
const capM = mat("DoorCap", 0x17181b, { rough: 0.8 });
const trimM = mat("TrimSilver", 0xc9ccd1, { metal: 0.9, rough: 0.25 });
const dispM = mat("DisplayGlass", 0x0b0b0d, { metal: 0.6, rough: 0.15 });
const printDisp = mat("print_display", 0xffffff, { rough: 0.4, opacity: 0.999 });
const logoM = mat("HaierMark", 0xffffff, { rough: 0.45, opacity: 0.999 });
const badgeM = mat("BadgeMagicConvertible", 0xffffff, { rough: 0.45, opacity: 0.999 });
const doorBack = mat("DoorLiner", 0xeef0f2, { rough: 0.55 });
// sides and top: a near-black paint on Graphite Black (gk_34right.jpg 52 grey); each colour's own on the others
const sidePaint = mat("SidePaint", 0x2e2f33, { metal: 0.3, rough: 0.5 });
const topPaint = mat("TopPaint", 0x2e2f33, { metal: 0.3, rough: 0.55 });
const frameM = mat("CabFrame", 0x2a2b2f, { metal: 0.2, rough: 0.6 });
const hingeM = mat("HingeCover", 0x1e1f22, { metal: 0.2, rough: 0.45 });
const rearM = mat("RearPlate", 0xffffff, { metal: 0.05, rough: 0.6 });
const bayM = mat("Bay", 0xffffff, { metal: 0.05, rough: 0.6 });
const bayDark = mat("BayDark", 0x1a1b1e, { rough: 0.8 });
const boxM = mat("TopBox", 0x9a9ea4, { metal: 0.5, rough: 0.45 });
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
const printFreeze = P("freezebox"), printFresh = P("freshbox"), printIce = P("iceplus");

// ── small builders ──
const cyl = (name, rt, rb, h, m, x, y, z, seg = 14) => mesh(name, new THREE.CylinderGeometry(rt, rb, h, seg), m, x, y, z);
const plane = (name, w, h, m, x, y, z) => mesh(name, flipV(new THREE.PlaneGeometry(w, h)), m, x, y, z);
const span = (name, x0, x1, y0, y1, z0, z1, m) => mesh(name, flipV(new THREE.BoxGeometry(x1 - x0, y1 - y0, z1 - z0)).translate((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2), m);
function joined(name, boxes, m) {
  const geos = boxes.map(([x0, x1, y0, y1, z0, z1]) => new THREE.BoxGeometry(x1 - x0, y1 - y0, z1 - z0).translate((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2));
  return mesh(name, mergeGeometries(geos), m);
}
function frontUV(m, u0, u1, t, b) {
  const p = m.geometry.attributes.position, n = m.geometry.attributes.normal, uv = m.geometry.attributes.uv;
  for (let i = 0; i < p.count; i++) if (n.getZ(i) > 0.5) uv.setXY(i, (p.getX(i) + m.position.x - u0) / (u1 - u0), (t - (p.getY(i) + m.position.y)) / (t - b));
  return m;
}

const root = group("HaierHRT683");
const cab = group("Cabinet");
root.add(cab);

// ── cabinet shell (BoxGeometry faces: +x, -x, +y, -y, +z front, -z back) ──
cab.add(span("SideLeft", -xo, -xIn, yBot, yTop, zBack + 0.004, zCab, [linerSide, sidePaint, topPaint, footM, frameM, sidePaint]));
cab.add(span("SideRight", xIn, xo, yBot, yTop, zBack + 0.004, zCab, [sidePaint, linerSide, topPaint, footM, frameM, sidePaint]));
cab.add(span("Top", -xIn, xIn, yCeil, yTop, zBack + 0.004, zCab, [liner, liner, topPaint, liner, frameM, topPaint]));
cab.add(span("Base", -xIn, xIn, yBot, yFloor, zBack + 0.004, zCab, [liner, liner, liner, footM, liner, footM]));
cab.add(span("BackWall", -xIn, xIn, yFloor, yCeil, zBack + 0.004, zIn, liner));
cab.add(span("Mullion", mul0, mul1, yFloor, yCeil, zIn, zCab, liner));
cab.add(span("Divider", -xIn, mul0, yDiv0, yDiv1, zIn, zCab, liner));
// the 2 mm gap between the left doors and the fridge door's step is dark on Haier's front
cab.add(span("MullionSeamShade", -0.074, -0.066, yBot + 0.01, yTop - 0.01, zCab, zCab + 0.001, seamShade));
cab.add(span("DividerSeamShade", -xIn, mul0, ySplit0 - 0.002, ySplit1 + 0.002, zCab, zCab + 0.001, seamShade));
// two small vent slots low at the back of each side (pwg_34right.jpg)
for (const s of [-1, 1]) {
  const x0 = s > 0 ? xo - 0.0005 : -xo - 0.0004, x1 = s > 0 ? xo + 0.0004 : -xo + 0.0005;
  cab.add(joined(s > 0 ? "SideVentsR" : "SideVentsL", [0.112, 0.138].map((y) => [x0, x1, y - 0.004, y + 0.004, zBack + 0.03, zBack + 0.09]), recess));
}
// the back: Haier's rear photo on the panel above the compressor bay, the bay's cover with its slots cut out
{
  const bay1 = rp.bay[1], m = span("RearPanel", -xo + 0.002, xo - 0.002, bay1, yTop - 0.002, zBack, zBack + 0.004, [sidePaint, sidePaint, topPaint, topPaint, sidePaint, rearM]);
  const p = m.geometry.attributes.position, n = m.geometry.attributes.normal, uv = m.geometry.attributes.uv;
  for (let i = 0; i < p.count; i++) if (n.getZ(i) < -0.5) uv.setXY(i, (xo - (p.getX(i) + m.position.x)) / W, (yTop - 0.002 - (p.getY(i) + m.position.y)) / (yTop - 0.002 - bay1));
  cab.add(m);
  const [cy0, cy1] = rp.bay, cx0 = -xo + 0.002, cx1 = xo - 0.002;
  const sh = new THREE.Shape();
  sh.moveTo(cx0, cy0); sh.lineTo(cx1, cy0); sh.lineTo(cx1, cy1); sh.lineTo(cx0, cy1); sh.lineTo(cx0, cy0);
  for (const [a, b, c, d] of rp.slots) { const h = new THREE.Path(); h.moveTo(a, b); h.lineTo(c, b); h.lineTo(c, d); h.lineTo(a, d); h.lineTo(a, b); sh.holes.push(h); }
  const geo = new THREE.ExtrudeGeometry(sh, { depth: 0.003, bevelEnabled: false, curveSegments: 1 });
  const q = geo.attributes.position, u = geo.attributes.uv;
  for (let i = 0; i < q.count; i++) u.setXY(i, (xo - q.getX(i)) / W, (cy1 - q.getY(i)) / (cy1 - cy0));
  cab.add(mesh("RearBayCover", geo, [bayM, bayDark], 0, 0, zBack));
  cab.add(span("RearBayInside", -xIn, xIn, cy0, cy1, zBack + 0.03, zBack + 0.034, bayDark));
}
// the box on top at the back (rear photo: x -79 to +296 mm, 28 mm over the cabinet's top, to Haier's 1775 mm)
{
  const [bx0, bx1] = rp.topbox;
  cab.add(span("TopBox", bx0, bx1, yTop, H - 0.003, zBack + 0.004, zBack + 0.16, boxM));
  cab.add(span("TopBoxLid", bx0 + 0.004, bx1 - 0.004, H - 0.003, H, zBack + 0.008, zBack + 0.156, boxM));
  // the cord: the rear photo shows it leaving the box by a white grommet at x +22 mm and lying along the box's top to x +257
  // mm. Lying there it shows over the lid in the gate's front view (camera 2.39 m up) and over the box's ends in the side
  // views, which our rule for cords rules out, so here it leaves the back panel by a white grommet 12 mm under the cabinet's top at
  // x +22 mm, runs along the back to x +257 mm 1.5 mm off the panel, drops, then swings in to a three-pin plug hung flat on
  // the back near the centre line, 0.95 m up (ESTIMATED: Haier's photos show nothing past the top). Below the cabinet's
  // top and near the centre, the cord (9.5 mm proud) and the plug (17 mm) stay hidden behind the cabinet in both side
  // views (by the side view's perspective, up to about 20 mm near the centre and 9.6 mm at x +257 mm).
  const cx = rp.cord_exit, cf = rp.cord_far, cr = 0.004, yc = yTop - 0.012, zc = zBack - cr - 0.0015;
  const grom = cyl("Grommet", 0.007, 0.007, 0.003, white, cx, yc, zBack - 0.0013, 12);
  grom.rotation.x = Math.PI / 2;
  cab.add(grom);
  const px = 0.04, py = 0.95, zPlate = zBack - 0.0002;
  const pts = [[cx, yc, zBack + 0.004], [cx, yc, zBack - 0.002], [cx + 0.03, yc, zc], [(cx + cf) / 2, yc, zc], [cf - 0.03, yc, zc],
    [cf, yc - 0.025, zc], [cf, yTop - 0.12, zc], [cf - 0.006, 1.32, zc], [cf - 0.07, 1.14, zc], [px + 0.035, py + 0.10, zc],
    [px + 0.004, py + 0.045, zc], [px, py + 0.024, zc]].map(([x, y, z]) => new THREE.Vector3(x, y, z));
  cab.add(mesh("PowerCord", new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts, false, "centripetal"), 90, cr, 6, false), cordM));
  // India's three-pin plug (45 x 42 x 16 mm, pins 5.2 mm), its back to the panel, pins down
  const s = new THREE.Shape(), w = 0.045, h = 0.042, r = 0.012;
  s.moveTo(-w / 2 + r, -h / 2); s.lineTo(w / 2 - r, -h / 2); s.quadraticCurveTo(w / 2, -h / 2, w / 2, -h / 2 + r);
  s.lineTo(w / 2, h / 2 - r); s.quadraticCurveTo(w / 2, h / 2, w / 2 - r, h / 2); s.lineTo(-w / 2 + r, h / 2);
  s.quadraticCurveTo(-w / 2, h / 2, -w / 2, h / 2 - r); s.lineTo(-w / 2, -h / 2 + r); s.quadraticCurveTo(-w / 2, -h / 2, -w / 2 + r, -h / 2);
  const plugG = new THREE.ExtrudeGeometry(s, { depth: 0.014, bevelEnabled: true, bevelSize: 0.0015, bevelThickness: 0.0015, bevelSegments: 2, curveSegments: 8 });
  const plug = mesh("Plug", plugG, plugM, px, py, zPlate - 0.0015);
  plug.rotation.y = Math.PI;
  cab.add(plug);
  for (const [dx, dz] of [[0, -0.0085], [-0.0095, -0.0085], [0.0095, -0.0085]]) cab.add(cyl("PlugPin", 0.0026, 0.0026, 0.016, pinM, px + dx, py - 0.021 - 0.0095, zPlate + dz, 10));
}
// hinges: black moulded covers on the top's outer front corners (gk_34right.jpg), black feet at the front, rollers behind
for (const s of [-1, 1]) {
  cab.add(span("HingeCover", s > 0 ? xo - 0.085 : -xo + 0.002, s > 0 ? xo - 0.002 : -xo + 0.085, yTop, yD1 + 0.002, zCab - 0.075, zDb - 0.002, hingeM));
  cab.add(span("HingeLow", s > 0 ? xo - 0.06 : -xo + 0.004, s > 0 ? xo - 0.004 : -xo + 0.06, 0.012, yD0 - 0.002, zCab - 0.03, zPiv + 0.012, footM));
  cab.add(cyl("FootFront", 0.017, 0.018, yBot, footM, s * (xo - 0.045), yBot / 2, zCab - 0.04, 16));
  cab.add(cyl("Roller", 0.0115, 0.0115, 0.016, footM, s * (xo - 0.04), 0.0115, zBack + 0.07, 14).rotateZ(Math.PI / 2));
  cab.add(span("RollerBracket", s > 0 ? xo - 0.058 : -xo + 0.022, s > 0 ? xo - 0.022 : -xo + 0.058, 0.018, yBot, zBack + 0.03, zBack + 0.11, footM));
}
// the middle hinge between the two left doors (gk_open.jpg: a bracket on the cabinet's front at the split)
cab.add(span("HingeMid", -xo + 0.004, -xo + 0.06, ySplit0 + 0.001, ySplit1 - 0.001, zCab - 0.03, zPiv + 0.012, trimM));

// ── inside, fixed: the lit ducts with their black name bars, the lights, vents and Haier's printed words ──
const zWall = zIn + 0.0007;
for (const [c, w, ytop, bar, plate, name, vent] of [[ZN, 0.25, 1.650, 0.147, printMcBar, "Zone", false], [FR, 0.40, 1.650, 0.26, printDeo, "Fridge", true]]) {
  const x0 = c.cx - w / 2, x1 = c.cx + w / 2, zd = zIn + 0.05;
  cab.add(span(name + "Duct", x0, x1, ZSH[0] + 0.0035, ytop, zIn, zd, [linerSide, linerSide, liner, liner, liner, liner]));
  cab.add(plane(name + "DuctPrint", bar, 0.0110, plate, c.cx, 1.5885, zd + 0.0027));
  cab.add(span(name + "DuctBar", c.cx - bar / 2, c.cx + bar / 2, 1.577, 1.600, zd, zd + 0.002, barBlack));
  cab.add(span(name + "Led", c.cx - w * 0.3, c.cx + w * 0.3, 1.672, 1.684, zIn, zIn + 0.006, lightM));
  cab.add(joined(name + "Vents", [ZSH[0], 1.18].map((y) => [c.cx - 0.04, c.cx + 0.04, y - 0.05, y - 0.044, zIn, zIn + 0.004]), ventGrey));
  // the fridge duct's grille right of its bar (gk_open.jpg: x +345 mm, 1596 mm up)
  if (vent) cab.add(joined("FridgeDuctGrille", [0, 1, 2].map((i) => [0.335, 0.355, 1.590 + i * 0.005, 1.5925 + i * 0.005, zd, zd + 0.0015]), ventGrey));
}
cab.add(plane("PrintMagicZone", 0.0721, 0.0128, printZone, ZN.cx, 1.280, zWall));
cab.add(plane("PrintMagicCooling", 0.0967, 0.0128, printMc, FR.cx, 1.283, zWall));
// shelf ledges in the side walls
for (const [c, front, ys] of [[ZN, znFront, [...ZSH]], [FR, frFront, [...FRSH, frCover]]]) for (const y of ys) for (const s of [-1, 1]) {
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
  if (printM) g.add(plane(name + "Print", pw, ph, printM, c.cx + dx, py, front + 0.0047));
  parent.add(g);
  return { x0, x1, y0, y1, front };
}
function drawerCover(parent, name, c, yG, yRail, front) {
  const g = group(name);
  g.add(span(name + "Glass", c.x0 + 0.004, c.x1 - 0.004, yG - 0.003, yG + 0.003, zIn + 0.012, front - 0.02, glass));
  g.add(span(name + "Rail", c.x0 + 0.004, c.x1 - 0.004, yRail, yG + 0.003, front - 0.02, front, linerGrey));
  parent.add(g);
}

// the Magic Zone: two shelves and the FRESHBOX drawer on its rail
for (const [i, y] of ZSH.entries()) shelf(cab, `ZnShelf${i + 1}`, ZN, y, znFront);
cab.add(span("ZnBoxRail", ZN.x0 + 0.004, ZN.x1 - 0.004, yDiv1, zBox[0] - 0.004, znFront - 0.03, znFront, linerGrey));
const znD = drawer(cab, "ZnFreshBox", ZN, zBox, znFront, printFresh, 0.0606, 0.0128, zBox[0] + 0.04, -0.035);
// the freezer: the twist ice maker's three trays and their housing at the top, the ICEPLUS bin under it (gk_freezer.jpg),
// two FREEZEBOX drawers with a rail between
{
  const x0 = FZ.x0 + 0.006, x1 = FZ.x1 - 0.006, zf = fzFront, zb = zf - 0.26;
  cab.add(span("IceMakerHousing", x0, x1, iceMk[0], iceMk[1], zb, zf, white));
  for (let i = 0; i < 3; i++) {
    const x = FZ.cx + (i - 1) * 0.088;
    const k = cyl("IceTwistKnob", 0.036, 0.036, 0.006, white, x, (iceMk[0] + iceMk[1]) / 2, zf + 0.003, 28);
    k.rotation.x = Math.PI / 2;
    cab.add(k);
    cab.add(span("IceTwistGrip", x - 0.026, x + 0.026, (iceMk[0] + iceMk[1]) / 2 - 0.003, (iceMk[0] + iceMk[1]) / 2 + 0.003, zf + 0.006, zf + 0.01, linerGrey));
  }
  cab.add(span("IceBin", x0, x1, iceBin[0], iceBin[1], zb, zf, white));
  cab.add(span("IceBinLip", x0, x1, iceBin[1] - 0.006, iceBin[1], zf, zf + 0.004, linerGrey));
  cab.add(plane("IceBinPrint", 0.0461, 0.0128, printIce, FZ.cx - 0.012, (iceBin[0] + iceBin[1]) / 2, zf + 0.0007));
  cab.add(span("FzDrawerRail", FZ.x0 + 0.004, FZ.x1 - 0.004, fzRail[0], fzRail[1], zf - 0.02, zf, linerGrey));
}
const fzD1 = drawer(cab, "FreezeBoxUp", FZ, fzUp, fzFront, printFreeze, 0.0661, 0.0128, fzUp[0] + 0.105, -0.035);
const fzD2 = drawer(cab, "FreezeBoxLow", FZ, fzLow, fzFront, printFreeze, 0.0661, 0.0128, fzLow[0] + 0.12, -0.035);
// fridge: everything that lifts out (three shelves, the cover, the two FRESHBOX drawers) is one part with its food
const trays = group("FridgeTrays");
cab.add(trays);
for (const [i, y] of FRSH.entries()) shelf(trays, `FrShelf${i + 1}`, FR, y, frFront);
shelf(trays, "FrCover", FR, frCover, frFront);
drawerCover(trays, "FrDrawerCover", FR, frUp[0] - 0.005, frLow[1] + 0.002, frFront);
const frD1 = drawer(trays, "FreshBoxUp", FR, frUp, frFront, printFresh, 0.0606, 0.0128, frUp[0] + 0.11, -0.03);
const frD2 = drawer(trays, "FreshBoxLow", FR, frLow, frFront, printFresh, 0.0606, 0.0128, frLow[0] + 0.13, -0.03);

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

// the fridge (Haier's stocked photo: a cake and dishes on the shelves, fruit in the upper FRESHBOX, vegetables below)
{
  const B = { hw: FR.hw - 0.02, z0: zIn + 0.03, z1: frFront - 0.0125 };
  // the top shelf's stock is "Shelf1Stock" and the upper drawer's "FreshZoneStock": the trays page test finds them by name.
  // The DEO FRESH duct stands 50 mm off the back wall over the top shelf: its stock starts in front of it
  const milk = pouch("NandiniMilk", "nandini_toned_milk");
  tray(trays, "Shelf1Stock", FR.cx, FRSH[0] + 0.003, { ...B, z0: zIn + 0.065 }, [
    [tiffin("Tiffin"), pouch("IdBatterPouch", "id_batter", true, 0.85), carton("MastiButtermilk", "amul_masti_buttermilk", 4)],
    [milk],
  ], (g) => ["aavin_milk", "amul_taaza_pouch"].forEach((k, i) => g.add(at(pouch(i ? "AmulTaazaPouch" : "AavinMilk", k), milk.position.x, milk.position.z))));
  tray(trays, "FrShelf2Stock", FR.cx, FRSH[1] + 0.003, B, [
    [food.coconutHalf("CoconutHalf", 0, 0, 0, 1), food.melonHalf("WatermelonHalf", 0, 0, 0, 1)],
    [paperTub("NandhanaPalace", "nandana_tub_wrap", 0.0525, 0.075), paperTub("NandhanaPalace2", "nandana_tub_wrap", 0.0525, 0.075), tin("RnrBiryani", "rnr_tin_lid", 0.06, 0.06)],
  ], (g) => {
    // headless Chrome's software renderer (SwiftShader) let one edge-on side facet of this white tub win one 4x MSAA sample
    // through the closed fridge door, a light speck in the gate's front view; turned 0.1 rad on its own axis, it doesn't
    const t = g.getObjectByName("NandhanaPalace2"); if (t) t.rotation.y += 0.1;
  });
  tray(trays, "FrShelf3Stock", FR.cx, FRSH[2] + 0.003, B, [
    [food.bananaBunch("Bananas", 0, 0, 0, 5, 1), brick("AmulCheese", "amul_cheese_slices", 0.12, 0.03, 0.12, K.cheese)],
    [1, 2, 3].map((i) => cupWithLid("AmulMastiCup" + i, "amul_masti_dahi_lid", 0.04, 0.05)).concat([brick("AmulButter1", "amul_butter", 0.085, 0.032, 0.055, K.butter)]),
  ]);
  tray(trays, "FrCoverStock", FR.cx, frCover + 0.003, { ...B, z0: zIn + 0.075 }, [
    [pouch("AmulPaneerFr", "amul_paneer", false, 0.8), food.lemon("Lemon", 0, 0, 0, 1), food.lemon("Lemon", 0, 0, 0, 2)],
  ]);
  // upper FRESHBOX: fruit (Haier's stocked photo); lower: the vegetables
  const v = [];
  ring(5, -0.08, -0.12, 0.09, 1).forEach(([x, z], i) => v.push(at(food.apple("Apple", 0, 0, 0, i + 1), x, z)));
  ring(5, 0.08, -0.05, 0.09, 2).forEach(([x, z], i) => v.push(at(food.orange("Orange", 0, 0, 0, i + 1), x, z)));
  v.push(at(food.grapes("Grapes", 0, 0, 0, 1), 0.0, -0.22));
  v.push(at(food.grapes("Grapes", 0, 0, 0, 2), -0.14, 0.0));
  for (let i = 0; i < 3; i++) v.push(at(food.lemon("Lemon", 0, 0, 0, i + 3), 0.14 + i * 0.02, -0.2));
  heap(trays, "FreshZoneStock", FR.cx, { ...frD1, ceil: frCover - 0.003 - 0.012 }, v);
  const w = [];
  w.push(at(food.cabbage("Cabbage", 0, 0, 0, 1), -0.14, -0.2));
  w.push(at(food.cauliflower("Cauliflower", 0, 0, 0, 1), 0.12, -0.2));
  for (let i = 0; i < 5; i++) w.push(at(food.carrot("Carrot", 0, 0, 0, i + 1), -0.15 + i * 0.03, -0.05));
  for (let i = 0; i < 3; i++) { const b = at(food.brinjal("Brinjal", 0, 0, 0, i + 1), -0.02 + i * 0.07, -0.1); b.rotation.y = Math.PI / 2; w.push(b); }
  ["green", "red", "yellow"].forEach((k, i) => w.push(at(food.capsicum("Capsicum", 0, 0, 0, k, i + 1), -0.1 + i * 0.08, 0.02)));
  ring(6, 0.12, 0.0, 0.07, 3).forEach(([x, z], i) => w.push(at(food.tomato("Tomato", 0, 0, 0, i + 1), x, z)));
  for (let i = 0; i < 8; i++) w.push(at(food.okra("LadiesFinger", 0, 0, 0, i + 1), 0.0 + (i % 4) * 0.022, -0.22 + Math.floor(i / 4) * 0.02));
  for (let i = 0; i < 8; i++) w.push(at(food.chilli("GreenChilli", 0, 0, 0, i + 1), 0.1 + i * 0.006, -0.1));
  w.push(at(food.herb("Coriander", 0, 0, 0, "coriander", 1), -0.16, 0.03));
  w.push(at(food.herb("CurryLeaves", 0, 0, 0, "curry", 2), 0.17, -0.1));
  heap(trays, "FrDrawerLowStock", FR.cx, { ...frD2, ceil: frUp[0] - 0.008 - 0.012 }, w);
}
// the Magic Zone (set as a fridge in Haier's stocked photo: desserts and dishes on its shelves); the FRESHBOX holds paneer
// and butter
{
  const B = { hw: ZN.hw - 0.02, z0: zIn + 0.03, z1: znFront - 0.0125 };
  tray(cab, "ZnShelf1Stock", ZN.cx, ZSH[0] + 0.003, { ...B, z0: zIn + 0.065 }, [
    [1, 2].map((i) => cupWithLid("ZnCurdCup" + i, "amul_masti_dahi_lid", 0.04, 0.05)).concat([paperTub("ZnNandhana", "nandana_tub_wrap", 0.0525, 0.075)]),
  ]);
  tray(cab, "ZnShelf2Stock", ZN.cx, ZSH[1] + 0.003, B, [[tiffin("ZnTiffin")], [food.coconutHalf("ZnCoconutHalf", 0, 0, 0, 2)]]);
  const u = [];
  u.push(at(pouch("ZnPaneer", "amul_paneer", false, 0.8), -0.05, -0.15));
  u.push(at(brick("ZnButter", "amul_butter", 0.085, 0.032, 0.055, K.butter), 0.06, -0.05));
  u.push(at(brick("ZnButter2", "amul_butter", 0.085, 0.032, 0.055, K.butter), -0.06, 0.0));
  heap(cab, "ZnBoxStock", ZN.cx, { ...znD, ceil: ZSH[1] - 0.003 - 0.012 }, u);
}
// the freezer (gk_freezer.jpg: ice-cream tubs in the upper FREEZEBOX, frozen packs in the lower)
{
  const u = [];
  u.push(at(iceTub("AmulVanillaMagic", "amul_vanilla_magic_lid", 0.16, 0.085, 0.16), -0.06, -0.15));
  u.push(at(iceTub("AmulRajbhog", "amul_rajbhog_lid", 0.16, 0.085, 0.16), 0.04, 0.0));
  u.push(at(cupWithLid("FzCup1", "amul_masti_dahi_lid", 0.04, 0.05), -0.1, 0.03));
  heap(cab, "FzDrawerUpStock", FZ.cx, { ...fzD1, ceil: fzRail[0] + (iceBin[0] - fzRail[0]) - 0.012 - 0.003 }, u);
  const f = [];
  f.push(at(pouch("ViswasParotta", "viswas_parotta", false, 0.8), 0.03, -0.05));
  f.push(at(pouch("NityaParotta", "nitya_parotta", false, 0.8), -0.03, -0.12));
  f.push(at(pouch("AmulPaneer", "amul_paneer", false, 0.8), 0.0, 0.02));
  f.push(at(pouch("FreshoGreenPeas", "fresho_green_peas", false, 0.9), 0.05, -0.2));
  heap(cab, "FzDrawerLowStock", FZ.cx, { ...fzD2, ceil: fzRail[0] - 0.012 }, f);
}

// ── doors: the Magic Zone and the freezer hinged on the left, the fridge on the right ──
// a door body from x0 to x1 (door space), h tall, with a grip slot [ys0, ys1] in its x1 side (sx 1) or none; the photo on
// its front spans u0 to u1 and the door's height. One box, so the face and its edge strip stay one clean, continuous
// surface from the front, as on Haier's doors; the slot (closed, it sits in the 2 mm gap behind the fridge door's step)
// is its dark opening on the side. Split pieces left edge-on faces behind the front, and headless Chrome's software
// renderer let some of their 4x MSAA samples through as thin dark lines. caps: the top and bottom faces' materials
function body(g, name, x0, x1, h, sx, F, u0, u1, slot, caps = {}) {
  const E = doorEdge, R = recess, Bk = doorBack, T = caps.top || E, Bo = caps.bottom || E;
  g.add(frontUV(span(name + "Body", x0, x1, 0, h, zB, zF, [E, E, T, Bo, F, Bk]), u0, u1, h, 0));
  if (!slot) return;
  const [ys0, ys1] = slot, [zs0, zs1] = slotZ, xa = sx > 0 ? x1 + 0.0001 : x0 - 0.0004;
  g.add(span(name + "Slot", xa, xa + 0.0003, ys0, ys1, zs0, zs1, R));
}
// a door's moulded liner block, x0..x1, y0..y1 at the door's back (zb), its face at zl inset by d on every side (a moulding's
// draft). Square sides sat edge-on to the gate's straight-on camera, and headless Chrome's software renderer let some of
// their 4x MSAA samples through the closed door as thin light lines; drafted, they never sit edge-on behind a door face
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
  const L = (x) => x - g.position.x, y0 = c.y0 - g.position.y, y1 = c.y1 - g.position.y, zg0 = zB - 0.0145, zl = linerFace - zPiv;
  const ox0 = L(c.x0) - 0.018, ox1 = L(c.x1) + 0.018, oy0 = y0 - 0.018, oy1 = y1 + 0.018;
  g.add(span(name + "GasketT", ox0, ox1, y1, oy1, zg0, zB, gasket));
  g.add(span(name + "GasketB", ox0, ox1, oy0, y0, zg0, zB, gasket));
  g.add(span(name + "GasketL", ox0, L(c.x0), y0, y1, zg0, zB, gasket));
  g.add(span(name + "GasketR", L(c.x1), ox1, y0, y1, zg0, zB, gasket));
  g.add(linerBlock(name + "Liner", L(c.x0) + 0.004, L(c.x1) - 0.004, y0 + 0.004, y1 - 0.004, zl, zB, 0.008, doorBack));
  const B = BINS[name], bx0 = L(c.x0) + 0.016, bx1 = L(c.x1) - 0.016, out = [];
  B.at.forEach(([fy, h], i) => {
    const f = fy - g.position.y, za = zl, zb = zl - B.d;
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
// a left door: its face (photo or colour) to -80 mm, its bright rounded edge to -71.5 mm, a thin bright line down its hinge
// side's corner
function leftDoor(name, y0, y1, F, slot, split) {
  const g = group(name, -pivX, y0, zPiv), L = (x) => x + pivX, h = y1 - y0;
  body(g, name, L(-xo), L(lEdge), h, 1, F, L(-xo), L(lFace1), slot.map((y) => y - y0), split === "top" ? { top: capM } : { bottom: capM });
  // the seal along the split: a dark 3 mm bead into the gap, 6 mm back from the face (each door carries its own half)
  const sy = split === "top" ? [h, h + 0.003] : [-0.003, 0];
  g.add(span(name + "SplitSeal", L(-xo) + 0.004, L(lEdge) - 0.004, sy[0], sy[1], zB + 0.004, zF - 0.006, capM));
  g.add(span(name + "Trim", L(lFace1), L(lEdge) + 0.0002, 0, h, zF - 0.0045, zF + 0.0005, trimM));
  g.add(span(name + "TrimOut", L(-xo) - 0.0002, L(-xo) + 0.0025, 0, h, zF - 0.004, zF + 0.0005, trimM));
  return g;
}
const zoneDoor = leftDoor("ZoneDoor", ySplit1, yD1, doorZnM, [1.19, 1.35], "bottom");
{
  // MAGICCONVERTIBLE at the door's bottom left (its left end 432 mm left of the middle, 840 mm up)
  zoneDoor.add(plane("BadgeDecal", 0.118, 0.016, badgeM, -0.432 + 0.059 + pivX, 0.840 - ySplit1, zF + 0.0007));
  const bins = doorInside(zoneDoor, "ZoneDoor", ZN);
  row(zoneDoor, bins[0], [1, 2, 3].map((i) => cupWithLid("ZnDoorCup" + i, "amul_masti_dahi_lid", 0.033, 0.05)));
  row(zoneDoor, bins[1], [carton("ZnRealMango", "real_mango", 2), carton("ZnRealMixed", "real_mixed_fruit", 1), pouch("ZnSambar", "sakthi_sambar_powder", true, 0.8)]);
  row(zoneDoor, bins[2], [brandJar("MothersPickle", "mothers_mango_pickle", 0.036, 0.07, K.jarGreen, K.goldLid), brandJar("AavinGhee", "aavin_ghee_jar", 0.034, 0.07, K.amber, K.goldLid), pouch("NandiniGhee", "nandini_ghee_pouch", true, 0.7)]);
}
const freezerDoor = leftDoor("FreezerDoor", yD0, ySplit0, doorFzM, [0.61, 0.79], "top");
doorInside(freezerDoor, "FreezerDoor", FZ);
const doorH = yD1 - yD0;
const fridgeDoor = group("FridgeDoor", pivX, yD0, zPiv);
{
  const L = (x) => x - pivX, zStep = zF - stepBack;
  body(fridgeDoor, "FridgeDoor", L(frStep1), L(xo), doorH, 0, doorFrM, L(frFace0), L(xo), null);
  fridgeDoor.add(span("FridgeDoorTrim", L(frStep1) - 0.0002, L(frFace0), 0, doorH, zF - 0.0045, zF + 0.0005, trimM));
  fridgeDoor.add(span("FridgeDoorTrimOut", L(xo) - 0.0025, L(xo) + 0.0002, 0, doorH, zF - 0.004, zF + 0.0005, trimM));
  // the step: Haier's own photo of it (the black strip, the chrome channel that is the handle) over the full height
  fridgeDoor.add(frontUV(span("FridgeDoorStep", L(frX0), L(frStep1), 0, doorH, zB, zStep, [doorEdge, doorEdge, doorEdge, doorEdge, channelM, doorBack]), L(frX0), L(frStep1), doorH, 0));
  // the black glass display, its bottom edge slanting down to the right, and every word on it (display_print.png)
  const sh = new THREE.Shape(), a = L(dispX0), b = L(frStep1 + 0.0005);
  sh.moveTo(a, dispL - yD0); sh.lineTo(b, dispR - yD0); sh.lineTo(b, doorH - 0.0005); sh.lineTo(a, doorH - 0.0005); sh.lineTo(a, dispL - yD0);
  fridgeDoor.add(mesh("DisplayGlass", new THREE.ExtrudeGeometry(sh, { depth: 0.002, bevelEnabled: false, curveSegments: 1 }), [dispM, dispM], 0, 0, zStep));
  fridgeDoor.add(plane("DisplayPrint", 0.046, 0.330, printDisp, L(dispX0) + 0.023, doorH - 0.165, zStep + 0.0027));
  // the Haier wordmark top right (gk_front.jpg: 59 mm wide, centred 362 mm right of the middle and 1697 mm up)
  fridgeDoor.add(plane("HaierMarkDecal", 0.059, 0.059 / 3.244, logoM, L(0.3615), 1.697 - yD0, zF + 0.0007));
  const bins = doorInside(fridgeDoor, "FridgeDoor", FR);
  row(fridgeDoor, bins[0], [eggTray("EggTray", 6), brick("DoorButter", "amul_butter", 0.085, 0.032, 0.055, K.butter)]);
  row(fridgeDoor, bins[1], [carton("RealMango", "real_mango", 2), carton("RealMixedFruit", "real_mixed_fruit", 1), carton("AmulTaaza", "amul_taaza_carton", 3),
    petBrand("Bisleri", "bisleri_label", 0.0345, 0.265, 0xcfe9f7, 0x1a6fb0, 0.6)]);
  row(fridgeDoor, bins[2], [petBrand("Coke", "coke_label", 0.042, 0.3, 0x2a1408, 0xc42b22), petBrand("Fanta", "fanta_label", 0.042, 0.3, 0xe8820e, 0xe07a12),
    petBrand("ThumsUp", "thumsup_label", 0.042, 0.3, 0x2a1408, 0x1b3a8c), petBrand("Bisleri1", "bisleri_label", 0.0345, 0.265, 0xcfe9f7, 0x1a6fb0, 0.6)]);
  row(fridgeDoor, bins[3], [1, 2, 3, 4].map((i) => petBrand("Bisleri" + (i + 1), "bisleri_label", 0.0345, 0.265, 0xcfe9f7, 0x1a6fb0, 0.6)));
  const cans = [[0x1b2d72, "thumsup_can", 0.105], [0xb82a20, "coke_label", 0.06], [0xe8820e, "fanta_label", 0.06]];
  row(fridgeDoor, bins[4], [petBrand("Bisleri6", "bisleri_label", 0.0345, 0.265, 0xcfe9f7, 0x1a6fb0, 0.6), ...cans.map(([col, key, lh]) => food.can("Can", col, 0, 0, 0, brand(key), arcFor(asp(key, 1) * lh, 0.033), lh))]);
}
root.add(zoneDoor, freezerDoor, fridgeDoor);

const parts = productParts(PRODUCTS, ID);
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
// Grain (BENCHMARK.md section 10): Graphite Black is a pre-coated steel with a fine level sheen, Inox Steel brushed across:
// a soft hairline runs across the doors; the glass colours drop it (variants). The painted sides and top get the soft peel.
await exportGLB(root, clips, OUT, only({
  DoorZone: `${T}/door_zone_gk.jpg`, DoorFreezer: `${T}/door_freezer_gk.jpg`, DoorFridge: `${T}/door_fridge_gk.jpg`, ChannelFace: `${T}/channel_gk.jpg`,
  print_display: `${T}/display_print.png`, HaierMark: `${T}/logo.png`, BadgeMagicConvertible: `${T}/badge_wide_light.png`, RearPlate: `${T}/rear.jpg`, Bay: `${T}/bay.jpg`,
  print_deofresh: `${T}/print_deofresh.png`, print_magiccooling_bar: `${T}/print_magiccooling_bar.png`, print_magiczone: `${T}/print_magiczone.png`,
  print_magiccooling: `${T}/print_magiccooling.png`, print_freezebox: `${T}/print_freezebox.png`, print_freshbox: `${T}/print_freshbox.png`,
  print_iceplus: `${T}/print_iceplus.png`,
  ...food.textures(`${TEX}/food`),
  ...Object.fromEntries(Object.keys(labelMats).map((n) => [n, `${TEX}/brands/small/${n.slice(3)}.jpg`])),
}), { dir: `${TEX}/grain`, materials: {
  DoorZone: { type: "hairline_soft", dir: "h" }, DoorFreezer: { type: "hairline_soft", dir: "h" }, DoorFridge: { type: "hairline_soft", dir: "h" },
  DoorEdge: { type: "hairline_soft", dir: "h" },
  SidePaint: { type: "peel_soft" }, TopPaint: { type: "peel_soft" },
} });

// ── the five colours as material variants (KHR_materials_variants), each from its own photos: Graphite Black (HRT-683GKU1,
// the client's code, first), Inox Steel (HRT-683ISU1), Black Glass (HRT-683KGU1), Grey Onyx Glass (HRT-683GOGU1) and Pearl
// White Glass (HRT-683PWGU1). On Haier's photos the door faces, the step, the sides and the print change; the display, the
// hinges, the back and the inside are the same. Colours are each photo's measured median (finishes.json) ──
const rgb = (k, part) => FIN[k].faces[part][0];
const side = (k, v) => v ?? FIN[k].side[0];
// glass, not paint (the 10 Nov finish review): a full clear coat (1.0, roughness 0.05) for the sharp
// reflection over the glass's own colour; the dark glasses on a part-metal base as the Samsung RT80's Black Glass, the light
// ones (Pearl White, Grey Onyx's blue-grey) on a plain one so they keep their colour in Quick Look
const GLASS_DARK = { tex: null, grain: false, metal: 0.8, rough: 0.5, coat: [1.0, 0.05] };
const GLASS_LIGHT = { tex: null, grain: false, metal: 0.0, rough: 0.45, coat: [1.0, 0.05] };
// Grey Onyx's dark blue-green doors on part metal 0.3 (a full metal turns a tinted dark neutral black in RealityKit)
const GLASS_TINT = { tex: null, grain: false, metal: 0.3, rough: 0.45, coat: [1.0, 0.05] };
const STEEL = { metal: 0.38, rough: 0.55, coat: [0.4, 0.3] };
// a colour scaled per channel, so that the front render's median matches Haier's front photo (REVIEW.md)
const scale = (c, k) => c.map((v, i) => Math.round(v * k[i]));
const GOG_K = { zone: [0.72, 0.73, 0.74], dark: [0.82, 0.82, 0.82] };
const FINISHES = [
  // Graphite Black: a dark colour, so no clear coat, satin 0.7
  ["Graphite Black", {
    DoorZone: { metal: 0.3, rough: 0.7 }, DoorFreezer: { metal: 0.3, rough: 0.7 }, DoorFridge: { metal: 0.3, rough: 0.7 },
  }],
  ["Inox Steel", {
    DoorZone: { tex: `${T}/door_zone_is.jpg`, ...STEEL }, DoorFreezer: { tex: `${T}/door_freezer_is.jpg`, ...STEEL }, DoorFridge: { tex: `${T}/door_fridge_is.jpg`, ...STEEL },
    ChannelFace: { tex: `${T}/channel_is.jpg` }, DoorEdge: { color: [150, 146, 142], metal: 0.5, rough: 0.4 },
    SidePaint: { color: side("is"), metal: 0.38, rough: 0.5 }, TopPaint: { color: side("is"), metal: 0.38, rough: 0.55 }, CabFrame: { color: side("is") },
    BadgeMagicConvertible: { tex: `${T}/badge_plate.png` },
  }],
  ["Black Glass", {
    DoorZone: { color: [26, 27, 30], ...GLASS_DARK }, DoorFreezer: { color: [26, 27, 30], ...GLASS_DARK }, DoorFridge: { color: [26, 27, 30], ...GLASS_DARK },
    ChannelFace: { tex: `${T}/channel_kg.jpg` }, DoorEdge: { color: [30, 31, 34] },
    SidePaint: { color: side("kg") }, TopPaint: { color: side("kg") }, CabFrame: { color: side("kg") },
    BadgeMagicConvertible: { tex: `${T}/badge_small_light.png` },
  }],
  ["Grey Onyx Glass", {
    DoorZone: { color: scale(rgb("gog", "zone"), GOG_K.zone), ...GLASS_LIGHT },
    DoorFreezer: { color: scale(rgb("gog", "freezer"), GOG_K.dark), ...GLASS_TINT }, DoorFridge: { color: scale(rgb("gog", "fridge"), GOG_K.dark), ...GLASS_TINT },
    ChannelFace: { tex: `${T}/channel_gog.jpg` }, DoorEdge: { color: [40, 52, 60] },
    SidePaint: { color: side("gog") }, TopPaint: { color: side("gog") }, CabFrame: { color: side("gog") },
  }],
  ["Pearl White Glass", {
    DoorZone: { color: rgb("pwg", "zone"), ...GLASS_LIGHT }, DoorFreezer: { color: rgb("pwg", "freezer"), ...GLASS_LIGHT }, DoorFridge: { color: rgb("pwg", "fridge"), ...GLASS_LIGHT },
    ChannelFace: { tex: `${T}/channel_pwg.jpg` }, DoorEdge: { color: [218, 220, 222], metal: 0, rough: 0.4 },
    SidePaint: { color: side("pwg", [55, 55, 57]) }, TopPaint: { color: side("pwg", [55, 55, 57]) }, CabFrame: { color: side("pwg", [55, 55, 57]) },
    HaierMark: { tex: `${T}/logo_grey.png` }, BadgeMagicConvertible: { tex: `${T}/badge_wide_dark.png` },
  }],
];
{
  const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
  const doc = await io.readBinary(new Uint8Array(fs.readFileSync(OUT)));
  const ext = doc.createExtension(KHRMaterialsVariants);
  const coatExt = doc.createExtension(KHRMaterialsClearcoat);
  const lin = (c) => ((c / 255) <= 0.04045 ? c / 255 / 12.92 : Math.pow((c / 255 + 0.055) / 1.055, 2.4));
  const vs = FINISHES.map(([n]) => ext.createVariant(n));
  const mats = doc.getRoot().listMaterials(), texCache = new Map();
  const texOf = (file) => {
    if (!texCache.has(file)) texCache.set(file, doc.createTexture(file.split("/").pop().replace(/\.\w+$/, "")).setImage(new Uint8Array(fs.readFileSync(file))).setMimeType(file.endsWith(".png") ? "image/png" : "image/jpeg"));
    return texCache.get(file);
  };
  const apply = (m, v) => {
    if (v.tex === null) m.setBaseColorTexture(null);
    else if (v.tex) m.setBaseColorTexture(texOf(v.tex));
    if (v.color) m.setBaseColorFactor([...v.color.map(lin), m.getBaseColorFactor()[3]]);
    if (v.metal != null) m.setMetallicFactor(v.metal);
    if (v.rough != null) m.setRoughnessFactor(v.rough);
    if (v.grain === false) { m.setNormalTexture(null); m.setMetallicRoughnessTexture(null); }
    if (v.coat === null) m.setExtension("KHR_materials_clearcoat", null);
    else if (v.coat) m.setExtension("KHR_materials_clearcoat", coatExt.createClearcoat().setClearcoatFactor(v.coat[0]).setClearcoatRoughnessFactor(v.coat[1]));
    return m;
  };
  const alt = {};
  for (const name of new Set(FINISHES.flatMap(([, t]) => Object.keys(t)))) {
    const base = mats.find((m) => m.getName() === name);
    if (!base) throw new Error(`no material ${name}`);
    const clones = FINISHES.map(([fn, t], i) => (i === 0 || !t[name] ? null : apply(base.clone().setName(`${name}${fn.replace(/\s+/g, "")}`), t[name])));
    if (FINISHES[0][1][name]) apply(base, FINISHES[0][1][name]);
    alt[name] = clones.map((c) => c || base);
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
