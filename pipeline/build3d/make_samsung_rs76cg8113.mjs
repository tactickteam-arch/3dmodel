// Samsung RS76CG8113SLHL, 653 L side-by-side with Bespoke AI and Wi-Fi (Twin Cooling Plus, 3 star), in both colours
// Samsung sells this body in: EZ Clean Steel (RS76CG8113SLHL, the listed one, first) and Black DOI (RS76CG8113B1HL), as
// material variants (KHR_materials_variants), each from its own photos.
// Copied from make_samsung_rs76.mjs (the RS76CG80X0S9HL: the same cabinet, doors, size, rear and manual, DA68-04608A-06,
// which Samsung's download centre lists for this code too) and changed only where the 8113 differs:
// - the doors, channel and BEE label of each colour, from that code's own straight-on front and label;
// - the display, which adds a Wi-Fi icon and "AI Energy | SmartThings" under its keys;
// - the freezer's Twist Ice Maker (Samsung: "Icemaker: Manual Twist") standing on the lowest shelf under the third, in
//   place of the 80X0's ice tray on the top shelf;
// - the fridge's Rack & Shelf wine rack hung under the top shelf (Samsung: "Wine Rack: Yes", 105 mm for a bottle);
// - two vegetable and fruit drawers in the fridge (Samsung: "2 EA"), at the freezer drawers' heights, in place of the
//   80X0's cover and single drawer;
// - the Black DOI doors without the steel's clear coat, so they stay as dark at the 3/4 view as Samsung's photos show;
// - for the budgets with two colours: every mesh indexed, a few small clusters baked into one mesh, and the frosted rims
//   opaque (each see-through piece is its own mesh in the Apple file).
// Size (Samsung's page and manual p.19): 912 W x 716 D mm, 1746 mm to the cabinet's top and 1780 mm over the hinge covers,
// 610 mm deep without the doors; the freezer door opens to 165 degrees and the fridge door to 170; with the doors at 90
// degrees the depth is 1165 mm and the fridge door's face stands 30 mm outside the cabinet's side. Those two fix the hinge
// pins (18.5 mm in from each side, 57.5 mm in front of the cabinet).
// The back is Samsung's rear photo (the same photo for both codes): the dimpled panel, the raised control-box cover, the
// compressor cover with its grilles cut through, and the power cord to a three-pin plug.
// Moving parts: the two doors, the freezer drawers (with their food) and the fridge trays (the shelves, the wine rack and
// both fridge drawers, with their food). Stocked for a south Indian kitchen (stock_lg.mjs, fit: true).
// Every inside height and the bins are ESTIMATED from Samsung's open-door photo (NOTES.md).
// usage: node make_samsung_rs76cg8113.mjs <entry .json, never products.json> <tex dir> <out.glb>
import fs from "node:fs";
import { LGStock } from "./stock_lg.mjs";
import { THREE, mat, mesh, group, flipV, stateClips, exportGLB, productParts, saveZones } from "./lib.mjs";
import { mergeGeometries, mergeVertices } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { NodeIO } from "@gltf-transform/core";
import { ALL_EXTENSIONS, KHRMaterialsClearcoat, KHRMaterialsVariants } from "@gltf-transform/extensions";

const [PRODUCTS, TEX, OUT] = process.argv.slice(2);
const ID = "samsung-rs76cg8113slhl";
const T = `${TEX}/samsung_rs76cg8113`;
const rp = JSON.parse(fs.readFileSync(`${T}/rear_paths.json`, "utf8"));

// ── size (metres): VERIFIED, Samsung's page and manual ──
const W = 0.912, H = 1.78, Hc = 1.746, D = 0.716, Dc = 0.61;
const zBack = -D / 2, zC = zBack + Dc, zDoor = D / 2;     // back, the cabinet's front, the doors' front
const xo = W / 2;
// ESTIMATED from the photos (NOTES.md): the walls, the mullion, the doors' bottom and the gasket gap
const side = 0.044, xi = xo - side;                        // side walls 44 mm (the open-door photo's frame)
const mullL = -0.0855, mullR = -0.0385;                    // the mullion between freezer and fridge, 47 mm
const doorBottom = 0.04, doorH = Hc - doorBottom;          // the doors: 40 mm up to the cabinet's top
const gasketGap = 0.012;                                   // the doors' backs stand 12 mm off the cabinet's front
const ceil = 1.71, floorIn = 0.095;                        // inside: ceiling and floor
const zRear = zBack + 0.006;                               // the rear panel's face; the control-box cover stands 6 mm out
const zIn = -0.298;                                        // the back walls' inner face
const bayTop = rp.cover[1], stepTop = 0.2985, zStep = -0.118;   // the compressor bay: its cover (rear photo), the step inside
// hinge pins, from the manual's 07 (30 mm) and 08 (1165 mm) with the doors at 90 degrees
const pinX = xo - 0.0185, pinZ = 0.3095;
// the two openings
const FZ = { x0: -xi, x1: mullL }, FR = { x0: mullR, x1: xi };
for (const c of [FZ, FR]) { c.w = c.x1 - c.x0; c.xc = (c.x0 + c.x1) / 2; }
// shelves (glass tops) and drawers, both sides, from the open-door photo (the 8113's sl_g_534630966.jpg is framed as the
// 80X0's g_536089205.jpg to within 3 px: 0.718 px per mm, floor row 1468). The 8113's fridge has two drawers at the
// freezer drawers' heights, the lowest glass shelf over them
const SHELF = [1.428, 1.136, 0.872, 0.655];
const lowDrawer = [0.102, 0.387], upDrawer = [0.405, 0.638];
// the Rack & Shelf wine rack under the fridge's top shelf: Samsung's feature picture gives 105 mm from the rack to the
// shelf above (VERIFIED); its depth and the hangers' shape are ESTIMATED from the close-up sl_g_534630968.jpg
const RACK = { y: SHELF[0] - 0.006 - 0.105, d: 0.27 };
// the Twist Ice Maker on the freezer's lowest shelf, from the open-door photo (columns 749-882 and rows 866-994: 185 mm
// wide, 660 to 838 mm up, its middle 8 mm right of the freezer's) and the close-up sl_g_534630969.jpg (its housing runs
// back under the third shelf): width, height and place ESTIMATED from the photo, its 300 mm depth ESTIMATED from the close-up
const ICE = { w: 0.19, y0: SHELF[3], y1: 0.838, d: 0.3, dx: 0.008 };
// door bins: floor above the door's bottom, end-wall height; widths and depths (depths ESTIMATED from the 3/4 photos)
const BINS = {
  FreezerDoor: { w: 0.285, d: 0.09, at: [[1.43, 0.1], [1.132, 0.1], [0.784, 0.097], [0.4, 0.097], [0.079, 0.083]] },
  FridgeDoor: { w: 0.41, d: 0.1, at: [[1.459, 0.112], [1.159, 0.1], [0.769, 0.095], [0.4, 0.095], [0.079, 0.079]] },
};
const linerFace = zC - 0.016;                              // the door liner's face, inside the opening
const frontFridge = linerFace - BINS.FridgeDoor.d - 0.01;  // shelves and drawers end 1 cm behind the deepest bin
const frontFreezer = linerFace - BINS.FreezerDoor.d - 0.01;

// ── materials ──
const doorFz = mat("FreezerFront", 0xffffff, { metal: 0.38, rough: 0.5 });
const doorFr = mat("FridgeFront", 0xffffff, { metal: 0.38, rough: 0.5 });
const doorEdge = mat("DoorEdge", 0xa4a7ac, { metal: 0.4, rough: 0.45 });     // the doors' sides and tops: the steel wraps round
const doorBack = mat("DoorBack", 0xc9ccd0, { metal: 0.2, rough: 0.55 });     // the doors' backs round the gasket (open-door photo)
const channel = mat("Channel", 0x3b3d41, { metal: 0.2, rough: 0.5 });        // the dark channel down the fridge door's left edge
const channelFace = mat("ChannelFace", 0xffffff, { metal: 0.2, rough: 0.5 }); // its front: the photo's own fall (channel.jpg)
const recess = mat("Recess", 0x0c0d0f, { rough: 0.6 });
const sidePaint = mat("SidePaint", 0xffffff, { metal: 0.3, rough: 0.5 });
const topPaint = mat("TopPaint", 0x4a4c50, { metal: 0.15, rough: 0.7 });
const backPaint = mat("BackPaint", 0x8e9195, { metal: 0.3, rough: 0.6 });
const frame = mat("FrontFrame", 0x3c3e42, { rough: 0.6 });                  // the cabinet's front round the openings, the mullion
const baseDark = mat("BaseDark", 0x1b1c1f, { rough: 0.8 });
const hingeM = mat("HingeCover", 0x44464a, { metal: 0.1, rough: 0.6 });     // dark grey moulded covers (open-door photo)
const footM = mat("Foot", 0x141518, { rough: 0.7 });
const threadM = mat("FootThread", 0x5b5e63, { metal: 0.6, rough: 0.4 });
const labelM = mat("LabelBEE", 0xffffff, { rough: 0.5, opacity: 0.999 });
const markM = mat("SamsungMark", 0xffffff, { metal: 0.3, rough: 0.4, opacity: 0.999 });
const liner = mat("Liner", 0xf1f3f5, { rough: 0.6 });
const linerGrey = mat("LinerGrey", 0xdde1e5, { rough: 0.62 });
const gasket = mat("Gasket", 0xc4c8cc, { rough: 0.85 });
const glass = mat("TemperedGlass", 0xa9cdd6, { rough: 0.05, opacity: 0.55, side: THREE.DoubleSide });
const shelfFrame = mat("ShelfFrame", 0xf4f5f6, { rough: 0.45 });
const clear = mat("ClearPlastic", 0xc3d0da, { rough: 0.12, opacity: 0.5, side: THREE.DoubleSide });
const clearLite = mat("ClearPlasticLight", 0xdfe7ee, { rough: 0.12, opacity: 0.26, side: THREE.DoubleSide });
// the bins' and drawers' frosted rims: opaque (the sibling's 0.78 made each rim its own mesh in the Apple file, twice per
// moving part, and took this fridge's two colours past the 450-mesh budget; at 0.78 they already read nearly solid)
const frosted = mat("Frosted", 0xe6edf1, { rough: 0.45 });
const white = mat("WhitePlastic", 0xf6f7f8, { rough: 0.45 });
const vent = mat("Vent", 0x8a9097, { rough: 0.7 });
const lightM = mat("Led", 0xffffff, { emissive: 0xf4f8ff, emissiveIntensity: 1.5 });
const iceM = mat("IceCube", 0xe3f4ff, { rough: 0.08, opacity: 0.72 });
const displayM = mat("DisplayPanel", 0xffffff, { rough: 0.3 });
const twinM = mat("PrintTwin", 0xffffff, { rough: 0.5, opacity: 0.999 });
const rearM = mat("Rear", 0xffffff, { metal: 0.35, rough: 0.55 });
const pcbM = mat("Pcb", 0xffffff, { metal: 0.2, rough: 0.6 });
const bayM = mat("Bay", 0xffffff, { rough: 0.7 });
const bayDark = mat("BayDark", 0x0f1012, { rough: 0.85 });
const cordM = mat("Cord", 0x2b2c2f, { rough: 0.6 });
const plugM = mat("Plug", 0x1f2023, { rough: 0.5 });
const pinM = mat("Pin", 0xb7bbc0, { metal: 0.9, rough: 0.3 });
const chromeM = mat("RackWire", 0xc4c7cb, { metal: 1, rough: 0.2 });      // the wine rack's chrome wire hangers

// a box by its extents; mats is one material or the six faces (+x, -x, +y, -y, +z, -z)
const bx = (name, x0, x1, y0, y1, z0, z1, mats, flip = false) => {
  const g = new THREE.BoxGeometry(x1 - x0, y1 - y0, z1 - z0);
  return mesh(name, flip ? flipV(g) : g, mats, (x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2);
};
const plane = (name, w, h, m, x, y, z) => mesh(name, flipV(new THREE.PlaneGeometry(w, h)), m, x, y, z);
const cyl = (name, rt, rb, h, m, x, y, z, seg = 20) => mesh(name, new THREE.CylinderGeometry(rt, rb, h, seg), m, x, y, z);
// the parent's meshes that pass test and wear material m, baked into one mesh called name: the same triangles in fewer
// pieces, so the Apple file stays within its entity budget
function fuse(parent, name, m, test) {
  const parts = parent.children.filter((c) => c.isMesh && c.material === m && test(c.name));
  if (parts.length < 2) return;
  const geos = parts.map((c) => {
    c.updateMatrix();
    const g = (c.geometry.index ? c.geometry.toNonIndexed() : c.geometry.clone()).applyMatrix4(c.matrix);
    g.clearGroups();
    for (const k of Object.keys(g.attributes)) if (!["position", "normal", "uv"].includes(k)) g.deleteAttribute(k);
    return g;
  });
  for (const c of parts) parent.remove(c);
  parent.add(mesh(name, mergeVertices(mergeGeometries(geos)), m));
}

const root = group("SamsungRS76CG8113");
const cab = group("Cabinet");
root.add(cab);

// ── the cabinet: dark grey painted sides, a dark top, white inside, the dark front frame and mullion ──
cab.add(bx("SideLeft", -xo, -xi, doorBottom, Hc, zRear + 0.004, zC, [liner, sidePaint, topPaint, baseDark, frame, backPaint], true));
cab.add(bx("SideRight", xi, xo, doorBottom, Hc, zRear + 0.004, zC, [sidePaint, liner, topPaint, baseDark, frame, backPaint], true));
cab.add(bx("Top", -xi, xi, ceil, Hc, zRear + 0.004, zC, [liner, liner, topPaint, liner, frame, backPaint]));
cab.add(bx("Base", -xi, xi, doorBottom, floorIn, zStep - 0.04, zC, [liner, liner, liner, baseDark, liner, bayDark]));
cab.add(bx("DividerMullion", mullL, mullR, floorIn, ceil, zIn, zC, [liner, liner, liner, liner, frame, liner]));
cab.add(bx("BackWall", -xi, xi, stepTop, ceil, zRear + 0.004, zIn, [liner, liner, liner, liner, liner, backPaint]));
// the compressor bay at the bottom of the back: inside, a step over it; outside, the bay is dark behind its cover
cab.add(bx("BackStepTop", -xi, xi, bayTop, stepTop, zRear + 0.004, zStep, [liner, liner, liner, bayDark, liner, bayDark]));
cab.add(bx("BackStepFront", -xi, xi, floorIn, bayTop, zStep - 0.04, zStep, [liner, liner, liner, liner, liner, bayDark]));

// the back: Samsung's rear photo on the dimpled panel, the raised control-box cover, the compressor cover with its slots cut
cab.add(bx("RearPanel", -xo + 0.002, xo - 0.002, bayTop, Hc - 0.002, zRear, zRear + 0.004, [backPaint, backPaint, backPaint, backPaint, backPaint, rearM], true));
{
  const [x0, y0, x1, y1] = rp.pcb;
  cab.add(bx("RearPcbCover", x0, x1, y0, y1, zBack, zRear, [backPaint, backPaint, backPaint, backPaint, backPaint, pcbM], true));
}
{
  const cx0 = -xo + 0.002, cx1 = xo - 0.002, cy0 = rp.cover[0], cy1 = bayTop;
  const sh = new THREE.Shape();
  sh.moveTo(cx0, cy0); sh.lineTo(cx1, cy0); sh.lineTo(cx1, cy1); sh.lineTo(cx0, cy1); sh.lineTo(cx0, cy0);
  for (const [a, b, c, d] of rp.slots) { const h = new THREE.Path(); h.moveTo(a, b); h.lineTo(c, b); h.lineTo(c, d); h.lineTo(a, d); h.lineTo(a, b); sh.holes.push(h); }
  const geo = new THREE.ExtrudeGeometry(sh, { depth: 0.003, bevelEnabled: false, curveSegments: 1 });
  const p = geo.attributes.position, uv = geo.attributes.uv;
  for (let i = 0; i < p.count; i++) uv.setXY(i, (xo - p.getX(i)) / W, (cy1 - p.getY(i)) / (cy1 - cy0));   // the photo is from behind
  const cover = mesh("RearBayCover", geo, [bayM, bayDark], 0, 0, zRear);
  cab.add(cover);
  // behind the slots: the dark bay (the step's back wall), and its floor
  cab.add(bx("RearBayFloor", -xi, xi, 0.012, 0.016, zRear + 0.004, zStep - 0.04, bayDark));
}
{ // the power cord from the control box, round the cover's corner and down the side, to a three-pin plug parked at the bottom
  // (cord 8 mm; the plug is India's three-pin, 45 x 42 x 16 mm; its spot is where Samsung's photo parks its plug)
  const [px0, py0, px1, py1] = rp.pcb;
  const pts = rp.cord.map(([x, y]) => new THREE.Vector3(x, y, (x >= px0 - 0.004 && x <= px1 + 0.004 && y >= py0 - 0.004) ? zBack - 0.0045 : zRear - 0.0045));
  cab.add(mesh("PowerCord", new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts, false, "centripetal"), 160, rp.cord_d / 2, 8, false), cordM));
  const [px, py] = rp.plug;
  const sh = new THREE.Shape(), w = 0.045, h = 0.042, r = 0.012;
  sh.moveTo(-w / 2 + r, -h / 2); sh.lineTo(w / 2 - r, -h / 2); sh.quadraticCurveTo(w / 2, -h / 2, w / 2, -h / 2 + r);
  sh.lineTo(w / 2, h / 2 - r); sh.quadraticCurveTo(w / 2, h / 2, w / 2 - r, h / 2); sh.lineTo(-w / 2 + r, h / 2);
  sh.quadraticCurveTo(-w / 2, h / 2, -w / 2, h / 2 - r); sh.lineTo(-w / 2, -h / 2 + r); sh.quadraticCurveTo(-w / 2, -h / 2, -w / 2 + r, -h / 2);
  const plug = mesh("Plug", new THREE.ExtrudeGeometry(sh, { depth: 0.016, bevelEnabled: true, bevelSize: 0.002, bevelThickness: 0.002, bevelSegments: 2, curveSegments: 8 }), plugM, px, py, zRear - 0.0025);
  plug.rotation.y = Math.PI;
  cab.add(plug);
  for (const [dx, dy] of [[0, 0.0105], [-0.0095, -0.0065], [0.0095, -0.0065]]) {
    const pin = mesh("PlugPin", new THREE.CylinderGeometry(0.0026, 0.0026, 0.016, 10), pinM, px + dx, py + dy, zRear - 0.0025 - 0.018 - 0.008);
    pin.rotation.x = Math.PI / 2; cab.add(pin);
  }
}

// hinges: the moulded covers on the top's front corners (up to the 1780 mm overall height), the black bottom brackets;
// levelling feet at the front, small feet at the back
for (const s of [-1, 1]) {
  const o = s * xo, inn = s * (xo - 0.115);
  // the cover: full height at the back, a lower step at the front over the hinge (the open-door photo); none of it shows
  // over the doors' tops on Samsung's closed-door photos, so nothing is modelled on the doors' tops
  cab.add(bx("HingeCover", Math.min(o, inn), Math.max(o, inn), Hc, H, zC - 0.16, zC - 0.06, hingeM));
  cab.add(bx("HingeCoverFront", Math.min(o, inn), Math.max(o, inn), Hc, Hc + 0.02, zC - 0.06, zC, hingeM));
  cab.add(bx("HingeBottom", Math.min(o, s * (pinX - 0.025)), Math.max(o, s * (pinX - 0.025)), 0.026, doorBottom - 0.002, zC - 0.06, pinZ + 0.02, footM));
  cab.add(cyl("FootFront", 0.02, 0.022, 0.012, footM, s * (xo - 0.035), 0.006, zC - 0.03));
  cab.add(cyl("FootThread", 0.008, 0.008, doorBottom - 0.012, threadM, s * (xo - 0.035), 0.012 + (doorBottom - 0.012) / 2, zC - 0.03, 12));
  cab.add(bx("FootRear", s * (xo - 0.06), s * (xo - 0.02), 0, doorBottom, zRear + 0.03, zRear + 0.07, footM));
}

// ── inside ──
const rib = (name, c, yTop, z0, z1) => { for (const x of [c.x0 + 0.004, c.x1 - 0.004]) cab.add(bx(name, x - 0.004, x + 0.004, yTop - 0.012, yTop, z0, z1, linerGrey)); };
// the lights at the front of each ceiling, the raised duct panels on the upper back walls with their vents, the small
// vents under each shelf, and "Twin Cooling Plus" printed on the fridge's panel
for (const [c, nm] of [[FZ, "Freezer"], [FR, "Fridge"]]) {
  cab.add(bx(`${nm}Led`, c.xc - c.w * 0.3, c.xc + c.w * 0.3, ceil - 0.006, ceil, zC - 0.06, zC - 0.035, lightM));
  cab.add(bx(`${nm}Duct`, c.x0 + 0.035, c.x1 - 0.035, SHELF[0] + 0.012, ceil - 0.012, zIn, zIn + 0.012, liner));
  cab.add(bx(`${nm}DuctVent`, c.xc - c.w * 0.22, c.xc + c.w * 0.22, 1.635, 1.643, zIn + 0.012, zIn + 0.015, vent));
  for (const y of SHELF.slice(0, 3)) cab.add(bx(`${nm}Vent`, c.xc - 0.025, c.xc + 0.025, y - 0.036, y - 0.028, zIn, zIn + 0.003, vent));
}
cab.add(plane("PrintTwinDecal", 0.165, 0.165 * 187 / 1188, twinM, FR.xc, 1.505, zIn + 0.0127));
// the display on the fridge's right wall near the front (Samsung's close-up sl_g_534630970.jpg, the same as the 80X0's;
// size and place ESTIMATED)
{
  // a box's -x face reads left to right towards the front, as seen from inside the fridge
  cab.add(mesh("DisplayPanel", flipV(new THREE.BoxGeometry(0.004, 0.203, 0.08)), [liner, displayM, liner, liner, liner, liner], xi - 0.002, 1.2585, 0.17));
}
// the freezer: ribs, four glass shelves, the Twist Ice Maker on the lowest shelf, two drawers on runners
function glassShelf(parent, name, c, yTop, z1, dx = 0) {
  const w = c.w - 0.016, x = c.xc - dx, z0 = zIn + 0.004;
  parent.add(bx(name, x - w / 2 + 0.008, x + w / 2 - 0.008, yTop - 0.006, yTop, z0 + 0.01, z1 - 0.014, glass));
  parent.add(bx(name + "Front", x - w / 2, x + w / 2, yTop - 0.02, yTop + 0.002, z1 - 0.014, z1, shelfFrame));
  parent.add(bx(name + "BackRim", x - w / 2, x + w / 2, yTop - 0.012, yTop, z0, z0 + 0.01, shelfFrame));
  for (const sx of [-1, 1]) parent.add(bx(name + "SideRail", sx < 0 ? x - w / 2 : x + w / 2 - 0.008, sx < 0 ? x - w / 2 + 0.008 : x + w / 2, yTop - 0.01, yTop, z0 + 0.01, z1 - 0.014, shelfFrame));
}
for (const [i, y] of SHELF.entries()) { glassShelf(cab, `FreezerShelf${i + 1}`, FZ, y, frontFreezer); rib("FreezerShelfRib", FZ, y - 0.006, zIn, frontFreezer - 0.02); }
{ // the Twist Ice Maker (Samsung: "Icemaker: Manual Twist"): a white housing standing on the lowest shelf and running back
  // under the third, its twist tray of 3 x 4 cubes on top (seen through the third shelf's glass in the close-up
  // sl_g_534630969.jpg), a front plate with a slot and the twist handle, and the clear ice bin under it at the front. On the
  // open-door photo: the bin 169 mm wide from 667 to 767 mm up, the handle 89 x 15 mm at 790-805 mm, the slot at 821-833 mm.
  // All sizes ESTIMATED from the two photos
  const xc = FZ.xc + ICE.dx, x0 = xc - ICE.w / 2, x1 = xc + ICE.w / 2, y0 = ICE.y0, y1 = ICE.y1, t = 0.004;
  const z1 = frontFreezer - 0.02, z0 = z1 - ICE.d;
  for (const [a, b] of [[x0, x0 + t], [x1 - t, x1]]) cab.add(bx("IceMakerSide", a, b, y0, y1, z0, z1, white));
  cab.add(bx("IceMakerBack", x0 + t, x1 - t, y0, y1, z0, z0 + t, white));
  // the top: a frame round the opening over the tray
  for (const [a, b] of [[x0 + t, x0 + 0.02], [x1 - 0.02, x1 - t]]) cab.add(bx("IceMakerTopRail", a, b, y1 - t, y1, z0 + t, z1 - t, white));
  cab.add(bx("IceMakerTopBack", x0 + 0.02, x1 - 0.02, y1 - t, y1, z0 + t, z0 + 0.02, white));
  // the front plate down to the bin, its slot and the twist handle (a rounded bar standing 10 mm out)
  const fy0 = 0.767;
  cab.add(bx("IceMakerFront", x0 + t, x1 - t, fy0, y1, z1 - t, z1, white));
  cab.add(bx("IceMakerSlot", x0 + 0.03, x1 - 0.03, 0.821, 0.833, z1, z1 + 0.001, vent));
  {
    const w = 0.089, h = 0.015, r = h / 2, sh = new THREE.Shape();
    sh.moveTo(-w / 2 + r, -h / 2); sh.lineTo(w / 2 - r, -h / 2); sh.absarc(w / 2 - r, 0, r, -Math.PI / 2, Math.PI / 2, false);
    sh.lineTo(-w / 2 + r, h / 2); sh.absarc(-w / 2 + r, 0, r, Math.PI / 2, Math.PI * 1.5, false);
    cab.add(mesh("IceMakerHandle", new THREE.ExtrudeGeometry(sh, { depth: 0.008, bevelEnabled: true, bevelSize: 0.0015, bevelThickness: 0.0015, bevelSegments: 1, curveSegments: 6 }), white, xc, 0.7975, z1 + 0.0015));
  }
  // the twist tray inside the housing's top: 3 x 4 cubes standing 6 mm out of their pockets
  const tx0 = x0 + 0.022, tx1 = x1 - 0.022, tz0 = z0 + 0.03, tz1 = z1 - 0.03;
  cab.add(bx("IceMakerTray", tx0, tx1, 0.8, 0.826, tz0, tz1, white));
  const cube = new THREE.BoxGeometry(0.04, 0.018, 0.05), px = (tx1 - tx0) / 3, pz = (tz1 - tz0) / 4;
  for (let i = 0; i < 12; i++) cab.add(mesh("IceCube", cube, iceM, tx0 + px * (i % 3 + 0.5), 0.823, tz0 + pz * (Math.floor(i / 3) + 0.5)));
  // the clear ice bin at the front, under the plate, with ice in it
  const bx0 = xc - 0.0845, bx1 = xc + 0.0845, by0 = 0.667, by1 = fy0 - 0.002, bz1 = z1 - 0.006, bz0 = bz1 - 0.16;
  cab.add(bx("IceBinFloor", bx0, bx1, by0, by0 + 0.004, bz0, bz1, clear));
  for (const [a, b] of [[bx0, bx0 + 0.004], [bx1 - 0.004, bx1]]) cab.add(bx("IceBinSide", a, b, by0 + 0.004, by1, bz0, bz1, clear));
  cab.add(bx("IceBinBack", bx0 + 0.004, bx1 - 0.004, by0 + 0.004, by1, bz0, bz0 + 0.004, clear));
  cab.add(bx("IceBinFront", bx0 + 0.004, bx1 - 0.004, by0 + 0.004, by1 - 0.012, bz1 - 0.004, bz1, clearLite));
  cab.add(bx("IceBinRim", bx0, bx1, by1 - 0.012, by1, bz1 - 0.008, bz1, frosted));
  // the bin's ice: two loose layers of cubes, each a little turned
  const ice = new THREE.BoxGeometry(0.036, 0.026, 0.042);
  [[-0.05, 0, 0.04, 0.2], [0, 0, 0.035, -0.3], [0.05, 0, 0.045, 0.1], [-0.045, 0, 0.1, -0.2], [0.005, 0, 0.1, 0.35], [0.052, 0, 0.105, -0.1],
    [-0.025, 1, 0.06, 0.6], [0.028, 1, 0.07, -0.5], [0.0, 1, 0.12, 0.25]].forEach(([dx, layer, dz, ry]) => {
    const m = mesh("IceCube", ice, iceM, xc + dx, by0 + 0.004 + 0.013 + layer * 0.024, bz0 + dz);
    m.rotation.set(layer ? 0.15 : 0, ry, layer ? -0.1 : 0);
    cab.add(m);
  });
  fuse(cab, "IceCubes", iceM, (n) => n === "IceCube");
  fuse(cab, "IceMakerBody", white, (n) => n.startsWith("IceMaker"));
  fuse(cab, "IceBin", clear, (n) => n === "IceBinFloor" || n === "IceBinSide" || n === "IceBinBack");
}
const fzDrawers = group("FreezerDrawers");
cab.add(fzDrawers);
function drawer(parent, name, c, [y0, y1], zb, zf, names = {}) {
  const w = c.w - 0.02, x0 = c.xc - w / 2, x1 = c.xc + w / 2, n = (k) => names[k] || `${name}${k}`;
  parent.add(bx(n("Floor"), x0, x1, y0, y0 + 0.004, zb, zf, clear));
  parent.add(bx(n("Back"), x0 + 0.004, x1 - 0.004, y0 + 0.004, y1, zb, zb + 0.004, clear));
  parent.add(bx(n("L"), x0, x0 + 0.004, y0 + 0.004, y1, zb, zf, clear));
  parent.add(bx(n("R"), x1 - 0.004, x1, y0 + 0.004, y1, zb, zf, clear));
  parent.add(bx(n("Front"), x0 + 0.004, x1 - 0.004, y0 + 0.004, y1 - 0.016, zf - 0.004, zf, clearLite));
  parent.add(bx(n("Rim"), x0, x1, y1 - 0.016, y1, zf - 0.01, zf, frosted));
  parent.add(bx(n("FootRim"), x0 + 0.004, x1 - 0.004, y0 + 0.004, y0 + 0.014, zf - 0.008, zf - 0.004, frosted));
  for (const x of [c.x0 + 0.004, c.x1 - 0.004]) cab.add(bx(`${name}Runner`, x - 0.004, x + 0.004, y1 - 0.03, y1 - 0.018, zb, zf - 0.02, linerGrey));
  return { x0, x1, floor: y0 + 0.004, zb, zf };
}
const DL = drawer(fzDrawers, "FreezerDrawerLow", FZ, lowDrawer, zStep + 0.006, frontFreezer);
const DU = drawer(fzDrawers, "FreezerDrawerUp", FZ, upDrawer, zIn + 0.006, frontFreezer);

// the fridge (what comes out is FridgeTrays: the four shelves, the wine rack and both drawers, with their food)
const trays = group("FridgeTrays");
cab.add(trays);
for (const [i, y] of SHELF.entries()) { glassShelf(trays, `Shelf${i + 1}`, FR, y, frontFridge); rib("FridgeShelfRib", FR, y - 0.006, zIn, frontFridge - 0.02); }
{ // the Rack & Shelf wine rack hung under the top shelf: a clear tray whose floor is ridged front to back into cradles (the
  // scalloped edge on the open-door photo, about 30 mm apart), a front lip with a frosted rim, held at each side by a
  // chrome wire hooked under the shelf's side rail (close-up sl_g_534630968.jpg). 105 mm to the shelf above (Samsung,
  // VERIFIED); the depth, ridges and wire ESTIMATED
  const xr0 = FR.x0 + 0.012, xr1 = FR.x1 - 0.012, z1 = frontFridge - 0.016, z0 = z1 - RACK.d, y = RACK.y;
  trays.add(bx("WineRackFloor", xr0 + 0.003, xr1 - 0.003, y - 0.004, y, z0, z1, clear));
  trays.add(bx("WineRackLip", xr0 + 0.003, xr1 - 0.003, y, y + 0.022, z1 - 0.004, z1, clearLite));
  trays.add(bx("WineRackLipRim", xr0 + 0.003, xr1 - 0.003, y + 0.022, y + 0.026, z1 - 0.007, z1, frosted));
  trays.add(bx("WineRackBack", xr0 + 0.003, xr1 - 0.003, y, y + 0.014, z0, z0 + 0.004, clear));
  const n = Math.round((xr1 - xr0) / 0.03);
  for (let k = 1; k < n; k++) { const x = xr0 + (k * (xr1 - xr0)) / n; trays.add(bx("WineRackRidge", x - 0.002, x + 0.002, y, y + 0.007, z0 + 0.004, z1 - 0.004, clear)); }
  // the hangers: up from the rack's front and back corners to a rod under the shelf's side rail
  const top = SHELF[0] - 0.012, r = 0.0025, zf = z1 - 0.02, zb = z0 + 0.03;
  for (const x of [xr0, xr1]) {
    for (const z of [zf, zb]) trays.add(cyl("WineRackWire", r, r, top - y + 0.004, chromeM, x, (top + y - 0.004) / 2, z, 10));
    const h = cyl("WineRackWire", r, r, zf - zb + 2 * r, chromeM, x, top, (zf + zb) / 2, 10);
    h.rotation.x = Math.PI / 2;
    trays.add(h);
  }
  fuse(trays, "WineRack", clear, (n) => n.startsWith("WineRack"));
  fuse(trays, "WineRackWires", chromeM, (n) => n === "WineRackWire");
}
// the two vegetable and fruit drawers (Samsung: "2 EA"), at the freezer drawers' heights on the open-door photo, the
// lowest glass shelf over the upper one; the lower one stops at the compressor's step and holds the vegetables (its parts
// named as qa_bounds.mjs expects), the upper one the fruit
const FU = drawer(trays, "FridgeDrawerUp", FR, upDrawer, zIn + 0.006, frontFridge);
const VD = drawer(trays, "VegDrawer", FR, lowDrawer, zStep + 0.006, frontFridge,
  { Floor: "FzBoxFloor", Back: "FzBoxBack", L: "FzBoxL", R: "FzBoxR", Front: "FzBoxFront", Rim: "FzBoxRim", FootRim: "FzBoxFootRim" });

// ── doors: the hinge pins inside each door's outer corner; the photo-textured face (EZ Clean Steel, or Black DOI as a variant), the steel wrapping round its
// edges, the grip slots, the gasket, the liner and five bins ──
const slotDepth = 0.025;
// a door body from x0 to x1 (pin space), with a grip slot in its x1 side (sx 1) or x0 side (sx -1)
function body(g, name, x0, x1, zb, zf, h, sx, slot, edgeMats, front) {
  const [ys0, ys1, zs0, zs1] = slot;
  const xs = sx > 0 ? x1 - slotDepth : x0 + slotDepth;          // the slot's floor
  const [mx0, mx1] = sx > 0 ? [x0, xs] : [xs, x1];
  const [ex0, ex1] = sx > 0 ? [xs, x1] : [x0, xs];
  const F = front;                                               // every piece's front wears the door's photo
  const faces = (sideOut) => sx > 0 ? [sideOut, edgeMats.out, doorEdge, doorEdge, F, doorBack] : [edgeMats.out, sideOut, doorEdge, doorEdge, F, doorBack];
  const edge = edgeMats.slotSide;
  const lowTop = recess;                                         // the slot's floor and roof are the low and high pieces' faces
  const pieces = [
    bx(name + "Body", mx0, mx1, 0, h, zb, zf, faces(recess)),
    bx(name + "EdgeLow", ex0, ex1, 0, ys0, zb, zf, sx > 0 ? [edge, recess, lowTop, doorEdge, F, doorBack] : [recess, edge, lowTop, doorEdge, F, doorBack]),
    bx(name + "EdgeHigh", ex0, ex1, ys1, h, zb, zf, sx > 0 ? [edge, recess, doorEdge, recess, F, doorBack] : [recess, edge, doorEdge, recess, F, doorBack]),
    bx(name + "EdgeFront", ex0, ex1, ys0, ys1, zs1, zf, sx > 0 ? [edge, recess, recess, recess, F, recess] : [recess, edge, recess, recess, F, recess]),
    bx(name + "EdgeBack", ex0, ex1, ys0, ys1, zb, zs0, sx > 0 ? [edge, recess, recess, recess, recess, doorBack] : [recess, edge, recess, recess, recess, doorBack]),
  ];
  // the photo spans the whole face, x0 to x1 and the door's height (v 0 at the top)
  for (const m of pieces) {
    const p = m.geometry.attributes.position, n = m.geometry.attributes.normal, uv = m.geometry.attributes.uv;
    for (let i = 0; i < p.count; i++) if (n.getZ(i) > 0.5) uv.setXY(i, (p.getX(i) + m.position.x - x0) / (x1 - x0), (h - (p.getY(i) + m.position.y)) / h);
    g.add(m);
  }
}
// the gasket round the opening, the liner inside it and the bins standing on the liner's face (pin space)
function doorInside(g, name, c) {
  const toL = (x) => x - g.position.x, y0 = floorIn - doorBottom, y1 = ceil - doorBottom, zg0 = zC - pinZ, zg1 = zg0 + gasketGap, zl = linerFace - pinZ;
  const ox0 = toL(c.x0) - 0.018, ox1 = toL(c.x1) + 0.018, oy0 = y0 - 0.018, oy1 = y1 + 0.018;
  g.add(bx(name + "GasketT", ox0, ox1, y1, oy1, zg0, zg1, gasket));
  g.add(bx(name + "GasketB", ox0, ox1, oy0, y0, zg0, zg1, gasket));
  g.add(bx(name + "GasketL", ox0, toL(c.x0), y0, y1, zg0, zg1, gasket));
  g.add(bx(name + "GasketR", toL(c.x1), ox1, y0, y1, zg0, zg1, gasket));
  g.add(bx(name + "Liner", toL(c.x0) + 0.004, toL(c.x1) - 0.004, y0 + 0.004, y1 - 0.004, zl, zg0, liner));
  const B = BINS[name], bc = toL(c.xc);
  B.at.forEach(([f, h], i) => {
    const za = zl, zb = zl - B.d, x0 = bc - B.w / 2, x1 = bc + B.w / 2;
    g.add(bx(`${name}Bin${i}Floor`, x0, x1, f, f + 0.004, zb, za, clear));
    g.add(bx(`${name}Bin${i}Lip`, x0 + 0.004, x1 - 0.004, f + 0.004, f + h - 0.008, zb, zb + 0.004, clear));
    g.add(bx(`${name}Bin${i}Rim`, x0, x1, f + h - 0.008, f + h, zb, zb + 0.006, frosted));
    g.add(bx(`${name}Bin${i}EndL`, x0, x0 + 0.004, f + 0.004, f + h, zb, za, clear));
    g.add(bx(`${name}Bin${i}EndR`, x1 - 0.004, x1, f + 0.004, f + h, zb, za, clear));
  });
  return (dep) => [bc - B.w / 2 + 0.004, bc + B.w / 2 - 0.004, zl - dep / 2];
}
const zb = zC + gasketGap - pinZ, zf = zDoor - pinZ;               // the door's back and front, pin space
// the freezer door: hinged on the left (pin at -pinX); its face is plain, the grip slot is in its right edge, 15 to 52%
// down the door (Samsung's 3/4 photo from the right, g_536089203.jpg) and in its front 4 cm, which shows past the fridge
// door's set-back channel
const freezerDoor = group("FreezerDoor", -pinX, doorBottom, pinZ);
const fzX0 = -xo + pinX, fzX1 = mullL + 0.0215 + pinX;            // -0.456 .. -0.064 m
body(freezerDoor, "FreezerDoor", fzX0, fzX1, zb, zf, doorH, 1, [doorH * 0.48, doorH * 0.852, zf - 0.036, zf - 0.01], { out: doorEdge, slotSide: channel }, doorFz);
const fzInside = doorInside(freezerDoor, "FreezerDoor", FZ);
// the sides of the doors that face each other (where the grip slots are cut) are dark like the channel: Samsung's 3/4
// photos show them 10 to 70 grey with the slot black, a bright line only at the face's corner
// the fridge door: hinged on the right; its face stops 52 mm short of its left edge, where a dark channel is set 40 mm back
// (Samsung's straight-on front: the 56 mm dark band between the faces; the 3/4 photo from the left: the step and its slot,
// 20 to 53% down the door)
const fridgeDoor = group("FridgeDoor", pinX, doorBottom, pinZ);
const frX0 = mullR - 0.0215 - pinX, frX1 = xo - pinX, frFace0 = frX0 + 0.052, chZ = zf - 0.04;   // -0.060 .. 0.456 m, face from -0.008
body(fridgeDoor, "FridgeDoor", frFace0, frX1, zb, zf, doorH, -1, [doorH * 0.47, doorH * 0.804, chZ + 0.006, zf - 0.008], { out: doorEdge, slotSide: channel }, doorFr);
fridgeDoor.add(bx("FridgeDoorChannel", frX0, frFace0, 0, doorH, zb, chZ, [recess, channel, channel, channel, channelFace, doorBack], true));
// the SAMSUNG wordmark (84 mm, light silver, 45.5 mm below the top, centred 368 mm right of the middle: the 80X0's
// measurement, which the 8113's straight-on front repeats to the pixel: the same 59 px ink, 46 mm down and 370 mm across)
// and the BEE label, measured on the 8113's own front (sl_labelprod_554043386.jpg: columns 1191-1273 and rows 325-481,
// 0.6425 px per mm across and 0.656 down, the photo being 2.1% taller than the published size): 131 mm wide (its height
// then from the label image's aspect, 238 mm against the photo's 238), 120 mm below the top, centred 321 mm right of the
// middle. Both colours carry their own code's label in the same place (ESTIMATED)
const LW = 0.131, LH = LW * 1237 / 680;
fridgeDoor.add(plane("SamsungMarkDecal", 0.084, 0.084 / 6.522, markM, 0.368 - pinX, doorH - 0.0455, zf + 0.0007));
fridgeDoor.add(plane("BeeLabelDecal", LW, LH, labelM, 0.321 - pinX, doorH - 0.12 - LH / 2, zf + 0.0007));
const frInside = doorInside(fridgeDoor, "FridgeDoor", FR);
root.add(freezerDoor, fridgeDoor);

// ── groceries (stock_lg.mjs, food.mjs): vegetarian South Indian food, juices, water and soft drinks ──
const stock = LGStock({ T3: `${TEX}/lg_glt3426`, TF: `${TEX}/food`, BR: `${TEX}/brands`, BRT: `${TEX}/brands/small` });
root.updateMatrixWorld(true);
const wbox = (o) => { o.updateWorldMatrix(true, true); return new THREE.Box3().setFromObject(o); };
// move o into group g (keeping where it is), then so its bottom is at y, its middle across at x and its back at z (world)
function put(o, g, x, y, z) {
  g.attach(o);
  const b = wbox(o);
  if (x != null) o.position.x += x - (b.min.x + b.max.x) / 2;
  if (y != null) o.position.y += y - b.min.y;
  if (z != null) o.position.z += z - b.min.z;
  return wbox(o);
}
// Dropping items into a heap: the same method as stock_lg.mjs's settle (each item tries spots near where it was put, drops
// straight down onto the floor or what is under it, and keeps the lowest spot that rests across its middle), copied here
// because stock_lg.mjs keeps it to itself
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
  let drop = Infinity;
  for (const h of hits) drop = Math.min(drop, h[0]);
  const touch = hits.filter((h) => h[0] - drop < 0.004), c = b.getCenter(new THREE.Vector3()), mx = 0.15 * (b.max.x - b.min.x), mz = 0.15 * (b.max.z - b.min.z);
  const xs = touch.map((h) => h[1]), zs = touch.map((h) => h[2]);
  const steady = touch.some((h) => h[3]) || (Math.min(...xs) - mx <= c.x && c.x <= Math.max(...xs) + mx && Math.min(...zs) - mz <= c.z && c.z <= Math.max(...zs) + mz);
  return { drop, steady };
}
function settle(items, { tries = 1, spread = 0, bounds = null, ceil = Infinity, seed = 7, steadyOnly = false } = {}) {
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
      const m = measure(o), y = (m.min.y + m.max.y) / 2, fits = m.max.y <= ceil;
      if (!best || (fits && !best.fits) || (fits === best.fits && (steady && !best.steady || steady === best.steady && y < best.y - 0.001)))
        best = { x: o.position.x, y, z: o.position.z, py: o.position.y, steady, fits };
    }
    o.position.set(best.x, best.py, best.z);
    if (!best.fits || (steadyOnly && !best.steady)) { left.push(o.name); o.removeFromParent(); continue; }
    if (!best.steady) tipped.push(o.name);
    const meshes = meshesOf(o);
    o.updateWorldMatrix(true, true);
    placed.push({ box: wbox(o), meshes, pts: pointsOf(meshes) });
  }
  if (left.length) console.warn(`settle: no room for ${left.join(", ")}`);
  if (tipped.length) console.warn(`settle: no steady spot for ${tipped.join(", ")}`);
}
// a row of items spread evenly between x0 and x1 (their group's space), backs at z0; returns the row's depth
function row(items, x0, x1, z0) {
  const bs = items.map(measure), w = bs.reduce((s, b) => s + b.max.x - b.min.x, 0), gap = (x1 - x0 - w) / (items.length + 1);
  if (gap < 0.004) console.warn(`row: ${items.map((o) => o.name)} leave ${(gap * 1000).toFixed(1)} mm between them`);
  let x = x0 + gap, dep = 0;
  items.forEach((o, i) => {
    const b = bs[i];
    o.position.x += x - b.min.x; o.position.z += z0 - b.min.z;
    x += b.max.x - b.min.x + gap; dep = Math.max(dep, b.max.z - b.min.z);
  });
  return dep;
}
const kids = (g, name) => g.children.filter((o) => o.name === name);
const drop = (...os) => os.forEach((o) => o.parent.remove(o));

// the fridge: its four shelves, the vegetable drawer heap, the fruit drawer, and the butter, cheese and curd on the lowest
// shelf. The wine rack stays empty: the house stock has no wine and Samsung's photo puts wine bottles there
{
  const fridgeFood = group("FridgeFood", FR.xc, 0, 0);
  trays.add(fridgeFood);
  const hw = FR.w / 2 - 0.02, vw = (VD.x1 - VD.x0) / 2;   // the food stands 4 mm inside the shelves' side rails
  const shelfB = { hw, z0: zIn + 0.027, z1: frontFridge - 0.016 };
  const drawerB = { hw: vw - 0.014, z0: VD.zb + 0.02, z1: VD.zf - 0.008, y0: VD.floor };
  // the heap stays under the drawer's frosted front rim (the upper drawer's floor is 2 cm higher still)
  const vegCeil = lowDrawer[1] - 0.016 - 0.002 - VD.floor;
  stock.shelves(fridgeFood, {
    zIn1: zIn, inW: FR.w, inD: frontFridge - zIn, s1: SHELF[0] - 0.0025, s2: SHELF[1] - 0.0025, s3: SHELF[2] - 0.0025, fz: VD.floor, fit: true,
    vz0: VD.zb + 0.02, vk: 0.8 * (VD.zf - VD.zb - 0.04) / 0.454, shelfB, drawerB,
    drawerCeil: upDrawer[0] - 0.01 - VD.floor,
  });
  stock.fresh0(fridgeFood, { y: SHELF[3], z: (zIn + frontFridge) / 2, bx: -0.145, cx: 0.075, ex: -0.035 });
  // The LG 343 L's rows are laid out for 540 mm between the walls; this fridge has 450, so the third shelf holds less and is
  // laid out again in two rows: the bananas, grapes and a lemon, then four of the apples and oranges. The fruit that does
  // not fit there (an apple, two oranges, an apple and a lemon) goes into the upper drawer, the fruit drawer of Samsung's
  // stocked photo (sl_g_534630967.jpg); the curd pouch is left out
  root.updateMatrixWorld(true);
  {
    const g = fridgeFood.getObjectByName("Shelf3Stock");
    const [a0, a1, a2, a3, a4] = kids(g, "Apple"), [o0, o1, o2] = kids(g, "Orange"), [l0, l1] = kids(g, "Lemon");
    drop(g.getObjectByName("AmulMastiDahi"));
    const fd = group("FruitDrawerStock", 0, FU.floor, 0);
    fridgeFood.add(fd);
    root.updateMatrixWorld(true);
    for (const o of [a1, o1, a4, o2, l0]) fd.attach(o);
    const d1 = row([g.getObjectByName("Bananas"), g.getObjectByName("Grapes"), l1], -hw, hw, shelfB.z0);
    row([a0, o0, a2, a3], -hw, hw, shelfB.z0 + d1 + 0.03);
    settle([...g.children]);
    const fB = { hw: (FU.x1 - FU.x0) / 2 - 0.014, z0: FU.zb + 0.02, z1: FU.zf - 0.008 };
    const d2 = row([a1, o1, a4], -fB.hw, fB.hw, fB.z1 - 0.22);
    row([o2, l0], -fB.hw, fB.hw, fB.z1 - 0.22 + d2 + 0.02);
    settle([...fd.children], { tries: 30, spread: 0.06, bounds: fB });
  }
  // The vegetable drawer is 24 cm deep at its floor (it stops at the compressor's step), so the 34 cm drumsticks lie across
  // it at the back instead of along it, and the heap is dropped in again around them (the cauliflower's tilted leaves go
  // into its geometry first, as on the Haier HRF-2902, so its box is its real extent)
  {
    const v = fridgeFood.getObjectByName("FreshZoneStock");
    const c = v.getObjectByName("Cauliflower");
    if (c) for (const m of c.children) if (m.isMesh && (m.rotation.x || m.rotation.z)) {
      m.updateMatrix();
      m.geometry = m.geometry.clone().applyMatrix4(m.matrix);
      m.position.set(0, 0, 0); m.rotation.set(0, 0, 0); m.scale.set(1, 1, 1);
    }
    kids(v, "Drumstick").forEach((o, i) => { o.rotation.y += Math.PI / 2; o.position.set(0.02 * (i % 2 ? 1 : -1), 0, drawerB.z0 + 0.02 + i * 0.024); });
    const HEAP = ["Drumstick", "Cabbage", "Cauliflower", "Onion", "Potato", "Brinjal", "Capsicum", "Carrot", "Tomato", "LadiesFinger", "Coriander", "CurryLeaves", "GreenChilli"];
    settle(v.children.slice().sort((a, b) => HEAP.indexOf(a.name) - HEAP.indexOf(b.name)), { tries: 60, spread: 0.08, bounds: drawerB, ceil: vegCeil, steadyOnly: true });
  }
}
// the freezer: two sets of the freezer stock; tubs on the top shelf and the third, the lying packs of both sets stacked two
// high on the second shelf (the lowest shelf holds the Twist Ice Maker), the standing packs in the upper drawer. The lower
// drawer stays empty: it sits in the vegetable drawer's height band, where qa_bounds.mjs only allows the vegetable
// drawer's own food
{
  const fzFood = group("FreezerFood");
  cab.add(fzFood);
  const box = { hw: FZ.w / 2 - 0.02, z0: zIn + 0.02, z1: frontFreezer - 0.02 };
  const A = group("FreezerSetA", FZ.xc, 0, 0), B = group("FreezerSetB", FZ.xc, 0, 0);
  fzFood.add(A, B);
  stock.freezer(A, { fit: true, zIn1: zIn, floor: 1.0, top: 1.2, box });
  stock.freezer(B, { fit: true, zIn1: zIn, floor: 0.8, top: 1.4, box });
  root.updateMatrixWorld(true);
  const get = (g, n) => g.getObjectByName(n);
  const xL = FZ.x0 + 0.02, xR = FZ.x1 - 0.02;                 // inside the shelf's side rails
  // top shelf: tubs A stacked at the left
  const top = group("FzTopStock"); fzFood.add(top);
  const zt = zIn + 0.03;
  let b = put(get(A, "AmulVanillaMagic"), top, xL + 0.08, SHELF[0], zt);
  put(get(A, "AmulRajbhog"), top, (b.min.x + b.max.x) / 2, b.max.y, zt);
  // third shelf: tubs B stacked at the left, B's standing peas beside them
  const s3 = group("FzShelf3Stock"); fzFood.add(s3);
  b = put(get(B, "AmulVanillaMagic"), s3, xL + 0.08, SHELF[2], zt);
  put(get(B, "AmulRajbhog"), s3, (b.min.x + b.max.x) / 2, b.max.y, zt);
  const pb = get(B, "FreshoGreenPeas"), pw = wbox(pb);
  put(pb, s3, b.max.x + 0.012 + (pw.max.x - pw.min.x) / 2, SHELF[2], zt + 0.02);
  // second shelf: the three lying packs of set A, one at the back and two in front of it, and set B's three dropped on top
  // of them (the 80X0 had B's on the lowest shelf, where the 8113 has its ice maker)
  {
    const y = SHELF[1], s = group("FzShelf2Stock", 0, y, 0); fzFood.add(s);
    const order = [];
    for (const g of [A, B]) {
      const back = put(get(g, "ViswasParotta2"), s, FZ.xc, y + (g === B ? 0.06 : 0), zt);
      const f1 = get(g, "FreshoGreenPeas2"), f2 = get(g, "AmulPaneer"), w1 = wbox(f1), w2 = wbox(f2);
      const gap = (xR - xL - (w1.max.x - w1.min.x) - (w2.max.x - w2.min.x)) / 3;
      put(f1, s, xL + gap + (w1.max.x - w1.min.x) / 2, y + (g === B ? 0.06 : 0), back.max.z + 0.015);
      put(f2, s, xR - gap - (w2.max.x - w2.min.x) / 2, y + (g === B ? 0.06 : 0), back.max.z + 0.015);
      order.push(...s.children.slice(-3));
    }
    settle(order);
  }
  // the upper drawer: set A's peas and parottas and set B's parottas, standing in rows
  const dr = group("FzDrawerStock"); fzDrawers.add(dr);
  const dx0 = DU.x0 + 0.004, dx1 = DU.x1 - 0.004;
  let z = DU.zb + 0.03;
  for (const row of [[get(A, "FreshoGreenPeas"), get(A, "ViswasParotta")], [get(A, "NityaParotta")], [get(B, "ViswasParotta")], [get(B, "NityaParotta")]]) {
    const ws = row.map((o) => { const w = wbox(o); return w.max.x - w.min.x; }), gap = (dx1 - dx0 - ws.reduce((s, v) => s + v, 0)) / (row.length + 1);
    let x = dx0 + gap, dep = 0;
    row.forEach((o, i) => { const bb = put(o, dr, x + ws[i] / 2, DU.floor, z); dep = Math.max(dep, bb.max.z - bb.min.z); x += ws[i] + gap; });
    z += dep + 0.012;
  }
  const left = [A, B].flatMap((g) => g.children.flatMap((s) => s.children)).map((o) => o.name);
  if (left.length) console.warn("freezer items left over:", left);
  fzFood.remove(A, B);
}
// the door bins: the fridge door holds the jars at the top, the cans, the bottles, then the cartons; Samsung's photo shows
// no egg tray, so the eggs stock_lg adds are left out. The freezer door's two rows of packs go two to a bin
{
  const F = BINS.FridgeDoor, Z = BINS.FreezerDoor;
  stock.doorFridge(fridgeDoor, { fit: true, eggY: F.at[4][0], eggX: [], jarY: F.at[0][0], canY: F.at[1][0], botY: F.at[2][0], deps: { egg: F.d, jar: F.d, bottle: F.d, can: F.d }, inside: frInside });
  fridgeDoor.children.filter((o) => o.name === "Egg").forEach((o) => fridgeDoor.remove(o));
  const cartons = ["RealMango", "RealMixedFruit", "AmulTaaza"].map((n) => fridgeDoor.getObjectByName(n));
  const bottles = ["Coke", "Fanta", "Bisleri"].map((n) => fridgeDoor.getObjectByName(n));
  const rowAt = (items, y, ins) => {   // a row across a bin, each item's bottom on the bin's floor, centred front to back
    const [x0, x1, zm] = ins, ws = items.map((o) => { const b = wbox(o); return b.max.x - b.min.x; });
    const gap = (x1 - x0 - ws.reduce((s, v) => s + v, 0)) / (items.length + 1);
    if (gap < 0.004) console.warn("door row too tight:", items.map((o) => o.name), (gap * 1000).toFixed(1), "mm");
    let x = x0 + gap;
    items.forEach((o, i) => {
      const b = wbox(o), p = o.parent.position;
      o.position.x += p.x + x + ws[i] / 2 - (b.min.x + b.max.x) / 2;
      o.position.y += p.y + y + 0.004 - b.min.y;
      o.position.z += p.z + zm - (b.min.z + b.max.z) / 2;
      x += ws[i] + gap;
    });
  };
  // door rows are laid in the door's own space (the door is shut, so world = pin space + the pin)
  const ins = (f) => { const [a, c, m] = f(F.d); return [a, c, m]; };
  rowAt(bottles, F.at[2][0], ins(frInside));
  rowAt(cartons, F.at[3][0], ins(frInside));
  stock.doorFreezer(freezerDoor, { fit: true, b1: Z.at[0][0], b2: Z.at[1][0], dep: Z.d, inside: fzInside });
  const packs = freezerDoor.children.filter((o) => /^FzPack/.test(o.name));
  [0, 1, 2, 3].forEach((k) => rowAt(packs.slice(2 * k, 2 * k + 2), Z.at[k][0], fzInside(Z.d)));
}

// every mesh written without an index (the extruded and stock shapes) gets one, its repeated corners shared: the same
// triangles, normals and texture places, in less of the file
{
  const done = new Map();
  root.traverse((o) => {
    if (!o.isMesh || o.geometry.index) return;
    if (!done.has(o.geometry)) done.set(o.geometry, mergeVertices(o.geometry, 1e-6));
    o.geometry = done.get(o.geometry);
  });
}
const parts = productParts(PRODUCTS, ID);
const clips = stateClips(root, parts);
saveZones(PRODUCTS, ID, root, parts);
// Grain (BENCHMARK.md section 10): Samsung names the finishes EZ Clean Steel and Black DOI; the 3/4 photos of both codes
// show fine vertical hairlines on the doors under a soft sheen, so the hairline grain runs up the door faces with a light
// clear coat (ESTIMATED). The dark grey painted sides and top get the soft peel. The prints are their own decals with no
// grain.
const used = new Set();
root.traverse((o) => o.material && [].concat(o.material).forEach((m) => used.add(m.name)));
const only = (t) => Object.fromEntries(Object.entries(t).filter(([k]) => used.has(k)));
await exportGLB(root, clips, OUT, only({
  FreezerFront: `${T}/door_freezer.jpg`,
  FridgeFront: `${T}/door_fridge.jpg`,
  ChannelFace: `${T}/channel.jpg`,
  SidePaint: `${T}/side_paint.jpg`,
  LabelBEE: `${T}/label.png`,
  SamsungMark: `${T}/mark.png`,
  DisplayPanel: `${T}/display.png`,
  PrintTwin: `${T}/print_twin.png`,
  Rear: `${T}/rear.jpg`,
  Pcb: `${T}/pcb.jpg`,
  Bay: `${T}/bay.jpg`,
  ...stock.textures(),
}), { dir: `${TEX}/grain`, materials: {
  FreezerFront: { type: "hairline", dir: "v", clearcoat: [0.6, 0.12] },
  FridgeFront: { type: "hairline", dir: "v", clearcoat: [0.6, 0.12] },
  SidePaint: { type: "peel_soft" }, TopPaint: { type: "peel_soft" },
} });

// ── the two colours as material variants (KHR_materials_variants): EZ Clean Steel (RS76CG8113SLHL, the listed one, first)
// and Black DOI (RS76CG8113B1HL), each door from its own code's straight-on front, each label its own code's. On Samsung's
// photos of the two codes only the doors differ: the sides, top, hinge covers, back and inside are the same photo for
// photo. The Black DOI doors' outer edges read 46-49 grey on the 3/4 photo against the steel's 111-116, and the doors'
// backs round the gasket 77-90 against 184-199 on the open-door photos, so those two take the same ratio (0.42) of the
// steel's colours (ESTIMATED) ──
{
  const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
  const doc = await io.readBinary(new Uint8Array(fs.readFileSync(OUT)));
  const ext = doc.createExtension(KHRMaterialsVariants);
  const lin = (c) => ((c / 255) <= 0.04045 ? c / 255 / 12.92 : Math.pow((c / 255 + 0.055) / 1.055, 2.4));
  // the black doors carry no clear coat: with the steel's coat the viewer's front-right lights lift them to mid grey at the
  // 3/4 view (0.40 of the label's white halfway down against the photo's 0.14); without it they read 0.18 there and 0.12
  // straight on, as on Samsung's photos, where the black doors are as dark at 3/4 as straight on (ESTIMATED by rendering)
  const B1M = { cc: 0 };
  const B1 = {
    FreezerFront: { tex: `${T}/door_freezer_b1.jpg`, ...B1M },
    FridgeFront: { tex: `${T}/door_fridge_b1.jpg`, ...B1M },
    ChannelFace: { tex: `${T}/channel_b1.jpg` },
    LabelBEE: { tex: `${T}/label_b1.png`, png: true },
    DoorEdge: { color: [69, 70, 72] },
    DoorBack: { color: [85, 86, 88] },
  };
  const FIN = [["EZ Clean Steel", {}], ["Black DOI", B1]];
  const vs = FIN.map(([n]) => ext.createVariant(n));
  const mats = doc.getRoot().listMaterials(), alt = {};
  for (const name of new Set(FIN.flatMap(([, t]) => Object.keys(t)))) {
    const base = mats.find((m) => m.getName() === name);
    if (!base) throw new Error(`no material ${name}`);
    alt[name] = FIN.map(([fn, t]) => {
      const v = t[name];
      if (!v) return base;
      const m = base.clone().setName(`${name}${fn.replace(/\s+/g, "")}`);
      if (v.tex) m.setBaseColorTexture(doc.createTexture(m.getName()).setImage(new Uint8Array(fs.readFileSync(v.tex))).setMimeType(v.png ? "image/png" : "image/jpeg"));
      if (v.color) m.setBaseColorFactor([...v.color.map(lin), base.getBaseColorFactor()[3]]);
      if (v.metal != null) m.setMetallicFactor(v.metal);
      if (v.rough != null) m.setRoughnessFactor(v.rough);
      if (v.cc === 0) m.setExtension("KHR_materials_clearcoat", null);
      else if (v.cc) m.setExtension("KHR_materials_clearcoat", doc.createExtension(KHRMaterialsClearcoat).createClearcoat().setClearcoatFactor(v.cc[0]).setClearcoatRoughnessFactor(v.cc[1]));
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
