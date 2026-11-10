// Haier HRF-3782BNSA-P, 328 L frost-free double door, Nickel Steel, recess handle (Magic Convertible series), with its two
// other colours as material variants of the doors: Graphite Black (HRF-3782BGK-P) and GE Black (HRF-3782BGB-P).
// The sheet asked for HRF-3782BNS-P (345 L); Haier's page at that model's address now sells the HRF-3782BNSA-P, 328 L, and
// its gallery is the same set of photos (named "HRF 3782BNS-P select-01..08"), so this is built as the BNSA-P (NOTES.md).
// Built to Haier's published size, 623 W x 1640 H x 665 D mm (Haier India's page, "623*665*1640", W x D x H), and to
// Haier's own gallery of this model: the straight-on front (doors, the Haier wordmark, MAGICCONVERTIBLE, the recess handle
// across the top of the fridge door, the feet and the bottom hinge), the two 3/4 views (the dark grey sides, the door
// edges), the open-door photo empty and stocked (every shelf, bin, box and print inside) and the straight-on back (the
// embossed back plate, the compressor bay, the control box and its cable).
// Freezer on top, fridge below, both doors hinged on the right. Haier publishes no manual, door swing or clearances: the
// doors' 140 degrees and every inside height are ESTIMATED from the open-door photo (NOTES.md).
// Inside, as the photo shows it: in the freezer the MAGIC ZONE knob on a raised back panel with its vents, a glass shelf,
// and the movable ICEMAKER on the floor at the front left; in the fridge a duct box under the ceiling with its vent and
// two slots, three toughened-glass shelves, the MAGIC COOLING knob on its back panel, the glass cover and the FRESHBOX;
// two bins on the freezer door and three on the fridge door (the lowest is the BOTTLEGUARD). The three shelves, the cover
// and the FRESHBOX are one part (FridgeTrays) that comes out with its food when the fridge door is open; the ice maker
// slides out. Stocked for a south Indian kitchen (stock_lg.mjs, fit: true).
// usage: node make_haier_hrf3782.mjs <entry .json, never products.json> <tex dir> <out.glb>
import fs from "node:fs";
import { LGStock } from "./stock_lg.mjs";
import { THREE, mat, mesh, box, faced, group, flipV, stateClips, exportGLB, productParts, saveZones } from "./lib.mjs";
import { NodeIO } from "@gltf-transform/core";
import { ALL_EXTENSIONS, KHRMaterialsVariants, KHRMaterialsClearcoat } from "@gltf-transform/extensions";

const [PRODUCTS, TEX, OUT] = process.argv.slice(2);
const ID = "haier-hrf-3782bnsa-p";
const T = `${TEX}/haier_hrf3782`;

// ── size (metres): Haier's 623 x 1640 x 665 mm ──
const W = 0.623, H = 1.64, D = 0.665;
const doorT = 0.065, Dc = D - doorT;                 // door thickness ESTIMATED (3/4 photos: the doors' dark edge band)
const zBack = -D / 2, zFront = zBack + Dc;
const boxT = 0.01;                                    // the control box stands 10 mm off the back plate (ESTIMATED)
const zPlate = zBack + boxT;                          // the back plate
const wall = 0.035, backT = 0.05;                     // side walls and the back's insulation (ESTIMATED)
// heights on Haier's front (0.650 px per mm up; floor row 1140, door top row 74)
const cabTop = H - 0.012;                             // the doors stand about 12 mm above the cabinet's top (3/4 photos)
const yFreezer = 1.1146;                              // freezer door, 1114.6-1640 mm
const frBot = 0.025, frTop = 1.1106;                  // fridge door, 25-1110.6 mm (a 4 mm gap under the freezer door)
const faceTop = 1.0515, lipTop = 1.0685;              // its steel face ends at 1051.5; the handle's lip to 1068.5; the channel above
const recessDepth = 0.025;                            // how far the channel goes into the door (ESTIMATED)
const endW = 0.021;                                   // the channel's end blocks (front photo: 14 px each end)
const base = 0.025;                                   // the cabinet's underside, at the doors' bottom edge
// inside heights, ESTIMATED from Haier's open-door photo (0.577 px per mm up on the cabinet's front, NOTES.md)
const floorTop = 0.07;                                // fridge floor
const fzCeil = 1.08, fzFloor = 1.157;                 // the mullion: fridge ceiling, freezer floor (its front edge, row 413)
const fzTop = 1.595;                                  // freezer ceiling
const fzShelfTop = 1.347;                             // the freezer's glass shelf (its front rim, rows 307-316)
const s1 = 0.879, s2 = 0.69, s3 = 0.493;              // the fridge's three glass shelves
const sCover = 0.285;                                 // the FRESHBOX's glass cover
const vbBottom = floorTop + 0.006, vbTop = 0.272;     // the FRESHBOX
// door bins (ESTIMATED, same photo, at the bins' hinge ends): floor above the door's bottom edge, end height, depth
const BINS = {
  FridgeDoor: [{ f: 0.268, h: 0.12, d: 0.1, print: true }, { f: 0.659, h: 0.075, d: 0.09 }, { f: 0.893, h: 0.075, d: 0.07, eggs: true }],
  FreezerDoor: [{ f: 0.055, h: 0.085, d: 0.075 }, { f: 0.285, h: 0.075, d: 0.07 }],
};
const linerFace = 0.016;
const reach = (name) => Math.max(...BINS[name].map((b) => b.d)) + linerFace;
const frontFridge = zFront - reach("FridgeDoor") - 0.01;   // shelves, the cover and the FRESHBOX end here
const frontFreezer = zFront - reach("FreezerDoor") - 0.01;

// ── materials ──
// Nickel Steel: the brushed texture carries the colour and the photo's soft bands. Roughness 0.6 under a light clear coat
// (COAT) keeps the doors' brightness about the same from the front and the 3/4s, as on Haier's photos; sharper (0.35)
// they read 20 darker straight on and 20 lighter at 16 degrees in the viewer's light
const doorFz = mat("DoorFreezer", 0xffffff, { metal: 0.38, rough: 0.6 });
const doorFr = mat("DoorFridge", 0xffffff, { metal: 0.38, rough: 0.6 });
const doorEdge = mat("DoorEdge", 0x2c2d30, { metal: 0.2, rough: 0.5 });       // the doors' edges, darker than the sides (3/4 photos: 49 against 61)
const lipM = mat("HandleLip", 0xc4c6c9, { metal: 0.45, rough: 0.35 });        // the handle's lip: light steel (front photo 214-231)
const channelM = mat("HandleChannel", 0xffffff, { rough: 0.6 });              // its channel, light read off the photo
const endM = mat("HandleEnd", 0x7c7e82, { rough: 0.5 });                      // the channel's end blocks (photo 128)
const capM = mat("HandleCap", 0x9fa1a5, { rough: 0.45 });                     // their rounded inner ends (photo 106-159)
const sidePaint = mat("SidePaint", 0x38393c, { metal: 0.3, rough: 0.5 });     // dark grey painted steel (3/4 photos at 16 degrees: 61; renders 62 left, 80 right)
const topPaint = mat("TopPaint", 0x37383b, { metal: 0.15, rough: 0.7 });
const frontEdge = mat("FrontEdge", 0x5d5e62, { metal: 0.2, rough: 0.55 });    // the sides' front edges round the openings (open photo)
const rearM = mat("RearPlate", 0xffffff, { metal: 0.3, rough: 0.55 });        // Haier's rear photo
const ctrlM = mat("ControlBox", 0xffffff, { metal: 0.4, rough: 0.45 });
const logoM = mat("HaierMark", 0xffffff, { rough: 0.35, opacity: 0.999 });
const magicM = mat("PrintMagic", 0xffffff, { rough: 0.35, opacity: 0.999 });
const liner = mat("Liner", 0xf1f3f5, { rough: 0.6 });
const linerDk = mat("LinerGrey", 0xdde1e5, { rough: 0.62 });
const gasket = mat("Gasket", 0x8d9196, { rough: 0.85 });
const baseDark = mat("BaseDark", 0x1b1c1f, { rough: 0.8 });
const glass = mat("TemperedGlass", 0xa9cdd6, { rough: 0.05, opacity: 0.55, side: THREE.DoubleSide });
const glassRim = mat("ShelfRim", 0xe9ecee, { rough: 0.45 });
const edgeGreen = mat("GlassEdge", 0x7fa7b0, { rough: 0.3 });
const clear = mat("ClearPlastic", 0xc3d0da, { rough: 0.12, opacity: 0.5, side: THREE.DoubleSide });
const clearLite = mat("ClearPlasticLight", 0xdfe7ee, { rough: 0.12, opacity: 0.26, side: THREE.DoubleSide });
const frosted = mat("Frosted", 0xe6edf1, { rough: 0.45, opacity: 0.78 });
const white = mat("WhitePlastic", 0xf6f7f8, { rough: 0.45 });
const vent = mat("Vent", 0x3c3f44, { rough: 0.7 });
const lightM = mat("Led", 0xffffff, { emissive: 0xf4f8ff, emissiveIntensity: 1.5 });
const ice = mat("IceCube", 0xe3f4ff, { rough: 0.08, opacity: 0.72 });
const footM = mat("Foot", 0x131416, { rough: 0.7 });
const hingeM = mat("Hinge", 0xc9ccd0, { metal: 0.9, rough: 0.3 });
const cordM = mat("Cord", 0x16171a, { rough: 0.6 });
const dialZone = mat("DialZone", 0xffffff, { rough: 0.45, opacity: 0.999 });
const dialCool = mat("DialCooling", 0xffffff, { rough: 0.45, opacity: 0.999 });
const arcZone = mat("ArcZone", 0xffffff, { rough: 0.6, opacity: 0.999 });
const arcCool = mat("ArcCooling", 0xffffff, { rough: 0.6, opacity: 0.999 });
const printIce = mat("PrintIcemaker", 0xffffff, { rough: 0.5, opacity: 0.999 });
const printFresh = mat("PrintFreshbox", 0xffffff, { rough: 0.5, opacity: 0.999 });
const printBottle = mat("PrintBottleguard", 0xffffff, { rough: 0.5, opacity: 0.999 });
const dotsM = mat("VentDots", 0xffffff, { rough: 0.6, opacity: 0.999 });

const root = group("HaierHRF3782");
const cab = group("Cabinet");
root.add(cab);
// the printed words are drawn at 7.2 px per mm (tex_haier_hrf3782.py): a decal's size in metres is its PNG's size / 7200
const png = (f) => { const b = fs.readFileSync(`${T}/${f}`); return [b.readUInt32BE(16) / 7200, b.readUInt32BE(20) / 7200]; };
const plane = (name, w, h, m, x, y, z) => mesh(name, flipV(new THREE.PlaneGeometry(w, h)), m, x, y, z);
const cyl = (name, rt, rb, h, m, x, y, z, seg = 16) => mesh(name, new THREE.CylinderGeometry(rt, rb, h, seg), m, x, y, z);

// ── cabinet: dark grey painted steel outside, white inside ──
const shellH = cabTop - base, shellMid = base + shellH / 2, cD = zFront - zPlate - 0.004, zMid = (zFront + zPlate + 0.004) / 2;
cab.add(faced("SideLeft", wall, shellH, cD, [liner, sidePaint, topPaint, baseDark, frontEdge, sidePaint], -W / 2 + wall / 2, shellMid, zMid));
cab.add(faced("SideRight", wall, shellH, cD, [sidePaint, liner, topPaint, baseDark, frontEdge, sidePaint], W / 2 - wall / 2, shellMid, zMid));
cab.add(faced("Top", W - 2 * wall, cabTop - fzTop, cD, [liner, liner, topPaint, liner, frontEdge, topPaint], 0, (cabTop + fzTop) / 2, zMid));
cab.add(faced("Base", W - 2 * wall, floorTop - base, cD, [liner, liner, liner, baseDark, baseDark, baseDark], 0, base + (floorTop - base) / 2, zMid));
cab.add(faced("BackWall", W - 2 * wall, fzTop - floorTop, backT - 0.0045 - boxT, [liner, liner, liner, liner, liner, liner], 0, (fzTop + floorTop) / 2, zBack + backT - (backT - 0.0045 - boxT) / 2));
cab.add(faced("Divider", W - 2 * wall, fzFloor - fzCeil, zFront - (zBack + backT), [liner, liner, liner, liner, liner, liner], 0, (fzCeil + fzFloor) / 2, (zFront + zBack + backT) / 2));
// the back: Haier's rear photo (the embossed plate and the open compressor bay) on a 4 mm plate, cropped to the cabinet
cab.add(mesh("RearPlate", flipV(new THREE.BoxGeometry(W, shellH, 0.004)), [sidePaint, sidePaint, topPaint, baseDark, liner, rearM], 0, shellMid, zPlate + 0.002));
// the control box on the back (rear photo x 662-772, rows 506-748: 168 x 378 mm, its middle 176 mm left of centre seen
// from the front, 785 mm up), and the cable from its foot down into the compressor bay, traced on the same photo
const rx = (px) => W / 2 - ((px - 397) / 409) * W, ry = (py) => base + ((1113 - py) / 1026) * (cabTop - base);
{
  const x0 = rx(772), x1 = rx(662), y0 = ry(748), y1 = ry(506);
  cab.add(mesh("ControlBox", flipV(new THREE.BoxGeometry(x1 - x0, y1 - y0, boxT)), [sidePaint, sidePaint, sidePaint, sidePaint, sidePaint, ctrlM], (x0 + x1) / 2, (y0 + y1) / 2, zBack + boxT / 2));
  const pts = [[719, 742, 0.003], [719, 752, -0.002], [720, 770, -0.0035], [724, 790, -0.0035], [727, 815, -0.0035], [731, 835, -0.0035], [735, 855, -0.0035], [739, 885, -0.0035], [741, 915, -0.0035], [744, 945, -0.0035], [746, 975, -0.0035], [748, 995, -0.003], [748, 1004, 0.01]]
    .map(([px, py, dz]) => new THREE.Vector3(rx(px), ry(py), zPlate + dz - 0.0001));
  pts[0].z = zBack + 0.002;                               // it leaves the box's foot
  cab.add(mesh("CordToBay", new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts, false, "centripetal"), 60, 0.0032, 6, false), cordM));
}
// feet: on Haier's front the left one 53 mm in (36 mm across), the right one under the bottom hinge 31 mm in (36 mm);
// the two at the back are not shown on any photo: ESTIMATED, as the front left
cab.add(cyl("FootFrontL", 0.017, 0.018, base, footM, -W / 2 + 0.053, base / 2, zFront - 0.06));
cab.add(cyl("FootFrontR", 0.017, 0.018, base - 0.006, footM, W / 2 - 0.031, (base - 0.006) / 2, zFront - 0.015));
for (const sx of [-1, 1]) cab.add(cyl("FootRear", 0.017, 0.018, base, footM, sx * (W / 2 - 0.053), base / 2, zPlate + 0.06));
// hinges on the right: the silver bracket over the right foot (front and 3/4 photos), the middle hinge plate on the
// mullion (open photo), and the cover on the cabinet's top behind the freezer door (3/4 photos)
cab.add(box("HingeBottom", 0.036, 0.006, 0.075, hingeM, W / 2 - 0.031, base - 0.003, zFront + 0.015));
cab.add(box("HingeMid", 0.045, 0.012, 0.006, hingeM, W / 2 - 0.03, (yFreezer + frTop) / 2, zFront + 0.003));
cab.add(box("HingeCoverTop", 0.07, H - cabTop - 0.001, 0.05, topPaint, W / 2 - 0.04, cabTop + (H - cabTop - 0.001) / 2, zFront - 0.026));

// ── inside ──
const inW = W - 2 * wall;
const zIn = zBack + backT;                            // the back wall's inner face
const zDuct = zIn + 0.012;                            // the front of the raised back panels
const rails = (name, yTop, z0, z1) => { for (const sx of [-1, 1]) cab.add(box(name, 0.01, 0.012, z1 - z0, linerDk, sx * (inW / 2 - 0.005), yTop - 0.012, (z0 + z1) / 2)); };
// a knob on a back panel: a ring, the printed face, and the scale arc printed round it (its PNG drawn at 7.2 px per mm)
function knob(name, x, y, faceM, arcM, arcPng, ringR, faceR) {
  cab.add(cyl(name + "Ring", ringR, ringR, 0.012, linerDk, x, y, zDuct + 0.006, 40).rotateX(Math.PI / 2));
  cab.add(cyl(name + "Face", faceR, faceR, 0.006, white, x, y, zDuct + 0.015, 40).rotateX(Math.PI / 2));
  cab.add(plane(name + "FaceDecal", faceR * 2, faceR * 2, faceM, x, y, zDuct + 0.0187));
  const [aw, ah] = png(arcPng);
  cab.add(plane(name + "ArcDecal", aw, ah, arcM, x, y, zDuct + 0.0007));
}
// the freezer: a raised back panel with two pairs of vent slots at its top either side of the MAGIC ZONE knob (open
// photo: the knob's ring 62 px across, the slots' inner ends 5 px outside it, level with its top; 0.92 of the front's
// scale on the back); under the shelf two rows of two slots, each with a dot vent between them; the glass shelf across it
{
  const y0 = fzShelfTop + 0.008, y1 = fzTop - 0.045;
  cab.add(box("FreezerDuct", inW - 0.05, y1 - y0, 0.012, liner, 0, (y0 + y1) / 2, zIn + 0.006));
  for (const sx of [-1, 1]) for (const dy of [0, 0.011]) cab.add(box("FreezerVentTop", 0.08, 0.005, 0.004, vent, sx * 0.11, y1 - 0.03 - dy, zDuct + 0.002));
  knob("ZoneKnob", 0, 1.45, dialZone, arcZone, "arc_zone.png", 0.05, 0.038);
  for (const dy of [0.02, 0.052]) {
    for (const sx of [-1, 1]) cab.add(box("FreezerVentLow", 0.1, 0.007, 0.004, vent, sx * 0.11, fzShelfTop - dy, zIn + 0.002));
    cab.add(plane("FreezerDots", 0.016, 0.012, dotsM, 0, fzShelfTop - dy, zIn + 0.0007));
  }
  const z0 = zDuct + 0.002, z1 = frontFreezer, w = inW - 0.012;
  cab.add(box("FreezerShelf", w, 0.006, z1 - 0.009 - z0, glass, 0, fzShelfTop - 0.003, (z0 + z1 - 0.009) / 2));
  cab.add(box("FreezerShelfRim", w, 0.016, 0.009, frosted, 0, fzShelfTop - 0.006, z1 - 0.0045));
  rails("FreezerShelfRail", fzShelfTop - 0.006, zIn, z1 - 0.01);
}
// the movable ICEMAKER on the freezer floor at the front left: a white housing with two twist trays at its front and the
// word on its top front, over a clear bin (open photo: 156 mm wide, 36 mm in from the left wall, its housing 55 mm and its
// bin 59 mm tall; depth ESTIMATED 200 mm)
const icW = 0.15, icH = 0.11, icD = 0.2, icX = -inW / 2 + 0.036 + icW / 2, icZ1 = frontFreezer - 0.015, icZ0 = icZ1 - icD;
const iceM = group("IceMaker", icX, fzFloor, 0);
{
  const bh = 0.055, bz = icZ1 - icD / 2;
  iceM.add(box("IceBinFloor", icW - 0.008, 0.004, icD, clear, 0, 0.002, bz));
  for (const sx of [-1, 1]) iceM.add(box("IceBinSide", 0.004, bh, icD, clear, sx * (icW / 2 - 0.006), bh / 2, bz));
  iceM.add(box("IceBinBack", icW - 0.016, bh, 0.004, clear, 0, bh / 2, icZ0 + 0.002));
  iceM.add(box("IceBinFront", icW - 0.016, bh, 0.004, clear, 0, bh / 2, icZ1 - 0.002));
  iceM.add(box("IceHousing", icW, icH - bh, icD, white, 0, bh + (icH - bh) / 2, bz));
  for (const sx of [-1, 1]) iceM.add(cyl("IceTwistTray", 0.028, 0.028, 0.008, white, sx * 0.035, bh + 0.012, icZ1 + 0.004, 24).rotateX(Math.PI / 2));
  const [pw0, ph0] = png("print_icemaker.png");
  iceM.add(plane("PrintIcemakerDecal", pw0, ph0, printIce, 0, icH - 0.014, icZ1 + 0.0007));
  const cube = new THREE.BoxGeometry(0.024, 0.02, 0.024);
  for (let i = 0; i < 10; i++) {
    const c = mesh("IceCube", cube, ice, -0.042 + (i % 4) * 0.028, 0.016 + Math.floor(i / 8) * 0.018, icZ1 - 0.04 - Math.floor((i % 8) / 4) * 0.06 - (i % 2) * 0.012);
    c.rotation.set(0.2 * (i % 3), 0.5 * i, 0.15 * (i % 4));
    iceM.add(c);
  }
}
cab.add(iceM);

// the fridge: an LED strip at the front of the ceiling (Haier's page: LED light; the open-door photo shows its glow at
// the middle of the ceiling's front; its size ESTIMATED), the duct box under the ceiling with its dot vent and two slots
// on a raised strip, the MAGIC COOLING knob on its back panel with two slots over it
cab.add(box("FridgeLed", 0.12, 0.004, 0.016, lightM, 0, fzCeil - 0.002, zFront - 0.13));
const ductW = 0.35, ductD = 0.055, ductBot = 0.925;
cab.add(box("FridgeDuct", ductW, fzCeil - ductBot, ductD, liner, 0, (fzCeil + ductBot) / 2, zIn + ductD / 2));
cab.add(plane("FridgeDots", 0.016, 0.012, dotsM, -ductW / 2 + 0.035, fzCeil - 0.03, zIn + ductD + 0.0007));
cab.add(box("FridgeSlotStrip", 0.12, 0.006, 0.003, linerDk, 0, fzCeil - 0.06, zIn + ductD + 0.0015));
for (const sx of [-1, 1]) cab.add(box("FridgeSlot", 0.012, 0.006, 0.004, vent, sx * 0.05, fzCeil - 0.06, zIn + ductD + 0.002));
cab.add(box("CoolingPanel", 0.34, 0.31, 0.012, liner, 0, 0.71, zIn + 0.006));
for (const sx of [-1, 1]) cab.add(box("CoolingSlot", 0.016, 0.007, 0.004, vent, sx * 0.05, 0.85, zDuct + 0.002));
knob("CoolingKnob", 0, 0.765, dialCool, arcCool, "arc_cooling.png", 0.044, 0.034);

// what slides out (FridgeTrays): the three shelves, the FRESHBOX cover and the FRESHBOX, with their food
const trays = group("FridgeTrays");
cab.add(trays);
function glassShelf(name, yTop, z0 = zDuct + 0.002) {
  const z1 = frontFridge, w = inW - 0.014;
  trays.add(box(name, w, 0.006, z1 - 0.012 - z0, glass, 0, yTop - 0.003, (z0 + z1 - 0.012) / 2));
  trays.add(box(name + "Rim", w, 0.016, 0.012, glassRim, 0, yTop - 0.006, z1 - 0.006));
  trays.add(box(name + "Edge", w, 0.004, 0.003, edgeGreen, 0, yTop - 0.012, z1 + 0.0015));
  rails(name + "Rail", yTop - 0.006, zIn, z1 - 0.01);
}
glassShelf("Shelf1", s1);
glassShelf("Shelf2", s2);
glassShelf("Shelf3", s3);
{ // the cover over the FRESHBOX: a glass plate with a frosted front rim
  const z0 = zIn + 0.002, z1 = frontFridge, w = inW - 0.014;
  trays.add(box("VegCover", w, 0.006, z1 - 0.014 - z0, glass, 0, sCover - 0.003, (z0 + z1 - 0.014) / 2));
  trays.add(box("VegCoverFront", w, 0.02, 0.014, frosted, 0, sCover - 0.01, z1 - 0.007));
  rails("VegCoverRail", sCover - 0.006, zIn, z1 - 0.01);
}
// the FRESHBOX (FzBox* are the names qa_bounds reads), its word on its front
const vbW = inW - 0.016, vbZ0 = zIn + 0.01, vbZ1 = frontFridge, vbD = vbZ1 - vbZ0, vbZ = (vbZ0 + vbZ1) / 2;
{
  const hh = vbTop - vbBottom;
  trays.add(box("FzBoxFloor", vbW, 0.004, vbD, clear, 0, vbBottom + 0.002, vbZ));
  trays.add(box("FzBoxBack", vbW, hh, 0.004, clear, 0, vbBottom + hh / 2, vbZ0 + 0.002));
  trays.add(box("FzBoxL", 0.004, hh, vbD, clear, -vbW / 2 + 0.002, vbBottom + hh / 2, vbZ));
  trays.add(box("FzBoxR", 0.004, hh, vbD, clear, vbW / 2 - 0.002, vbBottom + hh / 2, vbZ));
  trays.add(box("FzBoxFront", vbW, hh - 0.012, 0.004, clearLite, 0, vbBottom + (hh - 0.012) / 2, vbZ1 - 0.002));
  trays.add(box("FzBoxRim", vbW + 0.006, 0.012, 0.008, frosted, 0, vbTop - 0.006, vbZ1 - 0.002));
  trays.add(box("FzBoxFootRim", vbW, 0.01, 0.008, frosted, 0, vbBottom + 0.005, vbZ1 - 0.002));
  const [fw, fh] = png("print_freshbox.png");
  trays.add(plane("PrintFreshboxDecal", fw, fh, printFresh, 0.03, vbBottom + 0.1, vbZ1 + 0.0007));
}

// ── groceries (stock_lg.mjs, food.mjs): vegetarian South Indian food, eggs, juices, water and soft drinks ──
const stock = LGStock({ T3: `${TEX}/lg_glt3426`, TF: `${TEX}/food`, BR: `${TEX}/brands`, BRT: `${TEX}/brands/small` });
const vbFloor = vbBottom + 0.004;
stock.shelves(trays, {
  // stock_lg.mjs stands the food 3 mm over the height it is given: give it each top less 2.5 mm
  zIn1: zIn, inW, inD: frontFridge - zIn, s1: s1 - 0.0025, s2: s2 - 0.0025, s3: s3 - 0.0025, fz: vbFloor, fit: true,
  vz0: vbZ0 + 0.02, vk: 0.85,                       // spread so the heap settles steady (tried in steps)
  shelfB: { hw: inW / 2 - 0.03, z0: zDuct + 0.02, z1: frontFridge - 0.015 },
  drawerB: { hw: vbW / 2 - 0.014, z0: vbZ0 + 0.02, z1: vbZ1 - 0.008, y0: vbFloor },
  drawerCeil: sCover - 0.006 - 0.01 - vbFloor,   // the heap stays 1 cm under the cover
});
stock.freezer(cab, { fit: true, zIn1: zIn, floor: fzFloor, top: fzShelfTop + 0.0005, box: { hw: inW / 2 - 0.03, z0: zDuct + 0.02, z1: icZ0 - 0.01 } });

// The fitted stock is laid out for the LG 343 L's trays; here it is laid out again where this cabinet differs:
// shelf 1 sits under the duct box (55 mm deep), so its food starts 12 mm in front of it; shelf 3 is shallower, so its
// fruit goes in two rows (bananas, grapes and curd, then apples, an orange and a lemon); the freezer shelf (under it
// only the low vent, no duct) takes its three packs from 20 mm off the back panel; and the standing pack of peas on
// the freezer floor would touch the shelf above, so it is left out (another pack of peas lies on the shelf)
root.updateMatrixWorld(true);
const bbox = (o) => new THREE.Box3().setFromObject(o);
function row(items, x0, x1, z0) {               // spread evenly between x0 and x1, backs at z0; returns the row's depth
  const bs = items.map(bbox), w = bs.reduce((s, b) => s + b.max.x - b.min.x, 0), gap = (x1 - x0 - w) / (items.length + 1);
  if (gap < 0.006) console.warn(`row: ${items.map((o) => o.name)} leave ${(gap * 1000).toFixed(0)} mm between them`);
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
{
  const g = trays.getObjectByName("Shelf1Stock");
  g.position.z += zIn + ductD + 0.012 - bbox(g).min.z;
}
{
  const g = trays.getObjectByName("Shelf3Stock"), hw = inW / 2 - 0.03, z0 = zDuct + 0.02;
  const [a0, a1, a2, a3, a4] = kids(g, "Apple"), [o0, o1, o2] = kids(g, "Orange"), [l0, l1] = kids(g, "Lemon");
  drop(a1, a4, o1, o2, l1);
  const d1 = row([g.getObjectByName("Bananas"), g.getObjectByName("Grapes"), g.getObjectByName("AmulMastiDahi")], -hw, hw, z0);
  row([a0, o0, a2, l0, a3], -hw, hw, z0 + d1 + 0.03);
}
{
  const g = cab.getObjectByName("OnFreezerShelf");
  g.position.z += zDuct + 0.02 - bbox(g).min.z;
}
{
  const g = cab.getObjectByName("FreezerStock");
  drop(g.getObjectByName("FreshoGreenPeas"));
  const tubs = kids(g, "AmulVanillaMagic").concat(kids(g, "AmulRajbhog")), packs = [g.getObjectByName("ViswasParotta"), g.getObjectByName("NityaParotta")];
  // the two tubs (stacked) at the left, the two parotta packs (one behind the other) at the right, as before
  const hw = inW / 2 - 0.03, bt = bbox(tubs[0]), bp = bbox(packs[0]);
  const gap = (2 * hw - (bt.max.x - bt.min.x) - (bp.max.x - bp.min.x)) / 3;
  tubs.forEach((o) => (o.position.x += -hw + gap - bt.min.x));
  packs.forEach((o) => (o.position.x += hw - gap - bp.max.x));
}
{ // the herbs lie flat on the FRESHBOX floor: their leaves' lowest tips go on the floor, not through it
  const g = trays.getObjectByName("FreshZoneStock");
  root.updateMatrixWorld(true);
  for (const o of [...kids(g, "Coriander"), ...kids(g, "CurryLeaves")]) {
    const lo = new THREE.Box3().setFromObject(o, true).min.y;
    if (lo < vbFloor + 0.001) o.position.y += vbFloor + 0.001 - lo;
  }
}

// ── doors: hinged on the right, brushed steel fronts, dark edges ──
const pw = W - 0.002, bw = pw - 0.1;
const inside = (dep) => [-pw / 2 - bw / 2 + 0.004, -pw / 2 + bw / 2 - 0.004, -(linerFace + dep / 2)];
const EGGS = [0, 1, 2, 3, 4, 5].map((i) => -pw / 2 + bw / 2 - 0.004 - 0.03 - i * 0.05);   // at the bin's hinge end, as photographed
function doorInside(pivot, name, h) {
  pivot.add(box(name + "GasketT", pw - 0.02, 0.014, 0.014, gasket, -pw / 2, h - 0.012, -0.007));
  pivot.add(box(name + "GasketB", pw - 0.02, 0.014, 0.014, gasket, -pw / 2, 0.012, -0.007));
  pivot.add(box(name + "GasketL", 0.014, h - 0.02, 0.014, gasket, -pw + 0.012, h / 2, -0.007));
  pivot.add(box(name + "GasketR", 0.014, h - 0.02, 0.014, gasket, -0.012, h / 2, -0.007));
  pivot.add(box(name + "Liner", pw - 0.05, h - 0.05, 0.012, liner, -pw / 2, h / 2, -0.01));
  BINS[name].forEach((b, i) => {
    const zc = -linerFace - b.d / 2, zl = -linerFace - b.d;
    pivot.add(box(`${name}Bin${i}Floor`, bw, 0.004, b.d, clear, -pw / 2, b.f + 0.002, zc));
    pivot.add(box(`${name}Bin${i}Lip`, bw, b.h * 0.8, 0.004, clear, -pw / 2, b.f + b.h * 0.4, zl + 0.002));
    pivot.add(box(`${name}Bin${i}Rim`, bw, 0.007, 0.005, frosted, -pw / 2, b.f + b.h * 0.8 - 0.0035, zl + 0.0025));
    for (const sx of [-1, 1]) pivot.add(box(`${name}Bin${i}End`, 0.004, b.h, b.d, clear, -pw / 2 + sx * (bw / 2 - 0.002), b.f + b.h / 2, zc));
    // BOTTLEGUARD on the lowest bin's front, towards the hinge end (open photo); it faces the room when the door is open
    if (b.print) { const [w, hh] = png("print_bottleguard.png"); pivot.add(plane("PrintBottleguardDecal", w, hh, printBottle, -0.05 - 0.04 - w / 2, b.f + b.h * 0.42, zl - 0.0007).rotateY(Math.PI)); }
    if (b.eggs) for (const x of EGGS) { const c = mesh("EggCup", new THREE.SphereGeometry(0.02, 12, 4, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), clear, x, b.f, zc); c.scale.y = 0.7; pivot.add(c); }
  });
}
// the freezer door: the Haier wordmark (60 mm, centred, its middle 82 mm below the top) and MAGICCONVERTIBLE (124 x 9 mm,
// its right end 17 mm in from the hinge edge, its foot 11.5 mm above the door's bottom), measured on Haier's front
const freezerDoor = group("FreezerDoor", W / 2, yFreezer, zFront);
{
  const h = H - yFreezer;
  freezerDoor.add(mesh("FreezerPanel", flipV(new THREE.BoxGeometry(pw, h, doorT)), [doorEdge, doorEdge, doorEdge, doorEdge, doorFz, liner], -pw / 2, h / 2, doorT / 2));
  const [lw, lh] = png("logo.png"), [mw, mh] = png("print_magic.png");   // 4 px of margin round the word
  freezerDoor.add(plane("HaierMarkDecal", lw, lh, logoM, -pw / 2, h - 0.082, doorT + 0.0007));
  freezerDoor.add(plane("PrintMagicDecal", mw, mh, magicM, -0.017 + 0.0006 - mw / 2, 0.0115 - 0.0006 + mh / 2, doorT + 0.0007));
  doorInside(freezerDoor, "FreezerDoor", h);
}
// the fridge door: the steel face, the handle's lip (a rounded bar, light steel), the channel above it set 25 mm back
// with its end blocks and their rounded inner ends
const fridgeDoor = group("FridgeDoor", W / 2, frBot, zFront);
{
  const h = frTop - frBot, faceH = faceTop - frBot, lipH = lipTop - faceTop, chH = frTop - lipTop;
  fridgeDoor.add(mesh("FridgePanel", flipV(new THREE.BoxGeometry(pw, faceH, doorT)), [doorEdge, doorEdge, doorEdge, doorEdge, doorFr, liner], -pw / 2, faceH / 2, doorT / 2));
  const sb = doorT - 0.004;
  fridgeDoor.add(mesh("HandleLip", new THREE.BoxGeometry(pw, lipH, sb), [doorEdge, doorEdge, lipM, doorEdge, lipM, liner], -pw / 2, faceH + lipH / 2, sb / 2));
  const round = mesh("HandleLipFace", new THREE.CylinderGeometry(lipH / 2, lipH / 2, pw - 0.003, 24, 1, false, -Math.PI / 2, Math.PI), lipM, -pw / 2, faceH + lipH / 2, sb);
  round.rotation.z = Math.PI / 2; round.scale.set(1, 1, 0.0035 / (lipH / 2));
  fridgeDoor.add(round);
  const cd = doorT - recessDepth, yc = lipTop - frBot + chH / 2;
  fridgeDoor.add(mesh("HandleChannel", flipV(new THREE.BoxGeometry(pw - 2 * endW, chH, cd)), [doorEdge, doorEdge, doorEdge, doorEdge, channelM, liner], -pw / 2, yc, cd / 2));
  for (const sx of [-1, 1]) {
    const x = -pw / 2 + sx * (pw / 2 - endW / 2);
    fridgeDoor.add(mesh("HandleEnd", new THREE.BoxGeometry(endW, chH, doorT), [doorEdge, doorEdge, doorEdge, doorEdge, endM, liner], x, yc, doorT / 2));
    const cap = cyl("HandleCap", recessDepth / 2, recessDepth / 2, chH - 0.001, capM, x - sx * endW / 2, yc, cd + recessDepth / 2, 16);
    cap.scale.x = 0.55;
    fridgeDoor.add(cap);
  }
  doorInside(fridgeDoor, "FridgeDoor", h);
}
{ // what sits in the door bins, so it swings out with the door
  const F = BINS.FridgeDoor, Z = BINS.FreezerDoor;
  stock.doorFridge(fridgeDoor, { fit: true, eggY: F[2].f, eggX: EGGS, eggDY: 0, eggTurn: Math.PI / 2, jarY: F[1].f, botY: F[0].f, canY: null, deps: { egg: F[2].d, jar: F[1].d, bottle: F[0].d }, inside });
  stock.doorFreezer(freezerDoor, { fit: true, b1: Z[1].f, b2: Z[0].f, dep: Math.min(Z[0].d, Z[1].d), inside });
}
root.add(freezerDoor, fridgeDoor);

const parts = productParts(PRODUCTS, ID);
const clips = stateClips(root, parts);
saveZones(PRODUCTS, ID, root, parts);
// tilted leaves: their tilt goes into their geometry, so a box round each one is its real extent (qa_bounds)
root.traverse((o) => {
  if (o.name !== "Cauliflower" && o.name !== "Cabbage") return;
  for (const m of o.children) if (m.isMesh && (m.rotation.x || m.rotation.z)) {
    m.updateMatrix();
    m.geometry = m.geometry.clone().applyMatrix4(m.matrix);
    m.position.set(0, 0, 0); m.rotation.set(0, 0, 0); m.scale.set(1, 1, 1);
  }
});
// the herbs' stems and leaves (each turned inside a turned stem) go flat into the bunch's own frame, for the same reason
root.updateMatrixWorld(true);
const herbs = [];
root.traverse((o) => (o.name === "Coriander" || o.name === "CurryLeaves") && herbs.push(o));
for (const g of herbs) {
  const inv = g.matrixWorld.clone().invert(), ms = [];
  g.traverse((m) => m.isMesh && ms.push(m));
  for (const m of ms) {
    m.geometry = m.geometry.clone().applyMatrix4(inv.clone().multiply(m.matrixWorld));
    m.removeFromParent(); m.position.set(0, 0, 0); m.rotation.set(0, 0, 0); m.scale.set(1, 1, 1);
    g.add(m);
  }
  g.children.filter((c) => !c.isMesh).forEach((c) => g.remove(c));
}
const used = new Set();
root.traverse((o) => o.material && [].concat(o.material).forEach((m) => used.add(m.name)));
const only = (t) => Object.fromEntries(Object.entries(t).filter(([k]) => used.has(k)));
// Grain (BENCHMARK.md section 10): Haier names the door finish "Steel" in Nickel Steel, brushed as LG's steel doors are,
// so the doors get the vertical hairline under a clear coat; the dark grey painted sides and top get the soft peel. No
// grain on the prints, the rear photo or the handle
// the clear coat on the doors: at 0.6 with roughness 0.12 the studio's light washed the 3/4 views out (Nickel Steel 209-217
// against 174; the Whirlpool 22343 found the same); 0.3 with roughness 0.3 keeps a soft gloss
const COAT = [0.3, 0.3];
await exportGLB(root, clips, OUT, only({
  DoorFreezer: `${T}/door_freezer.jpg`,
  DoorFridge: `${T}/door_fridge.jpg`,
  HandleChannel: `${T}/channel.jpg`,
  HaierMark: `${T}/logo.png`,
  PrintMagic: `${T}/print_magic.png`,
  RearPlate: `${T}/rear.jpg`,
  ControlBox: `${T}/ctrlbox.jpg`,
  DialZone: `${T}/dial_zone.png`,
  DialCooling: `${T}/dial_cooling.png`,
  ArcZone: `${T}/arc_zone.png`,
  ArcCooling: `${T}/arc_cooling.png`,
  PrintIcemaker: `${T}/print_icemaker.png`,
  PrintFreshbox: `${T}/print_freshbox.png`,
  PrintBottleguard: `${T}/print_bottleguard.png`,
  VentDots: `${T}/dots.png`,
  ...stock.textures(),
}), { dir: `${TEX}/grain`, materials: {
  DoorFreezer: { type: "hairline", dir: "v", clearcoat: COAT },
  DoorFridge: { type: "hairline", dir: "v", clearcoat: COAT },
  SidePaint: { type: "peel_soft" }, TopPaint: { type: "peel_soft" },
} });

// ── the three colours as material variants (KHR_materials_variants): Nickel Steel (HRF-3782BNSA-P) first, then Graphite
// Black (HRF-3782BGK-P) and GE Black (HRF-3782BGB-P). On Haier's photos of the two dark ones only the doors' colour
// changes: the same white MAGICCONVERTIBLE, the same light steel lip on the handle, the same dark grey sides (their 3/4
// photos read 38-42 on the lit-away side and 62-72 on the other, the Nickel Steel's 61 and 61: lit differently, not
// painted differently) ──
{
  const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
  const doc = await io.readBinary(new Uint8Array(fs.readFileSync(OUT)));
  const ext = doc.createExtension(KHRMaterialsVariants);
  // a colour's own value for a material: a texture path, a colour [r, g, b], or { tex, color, rough, coat } (coat:
  // [amount, roughness], or null for none)
  const lin = (c) => ((c / 255) <= 0.04045 ? c / 255 / 12.92 : Math.pow((c / 255 + 0.055) / 1.055, 2.4));
  const make = (m, tag, v) => {
    if (typeof v === "string") v = { tex: v }; else if (Array.isArray(v)) v = { color: v };
    if (v.color) m.setBaseColorFactor([...v.color.map(lin), 1]);
    if (v.tex) m.setBaseColorTexture(doc.createTexture(tag).setImage(new Uint8Array(fs.readFileSync(v.tex))).setMimeType(v.tex.endsWith(".png") ? "image/png" : "image/jpeg"));
    if (v.rough != null) m.setRoughnessFactor(v.rough);
    if (v.coat === null) m.setExtension("KHR_materials_clearcoat", null);
    else if (v.coat) m.setExtension("KHR_materials_clearcoat", doc.createExtension(KHRMaterialsClearcoat).createClearcoat().setClearcoatFactor(v.coat[0]).setClearcoatRoughnessFactor(v.coat[1]));
    return m;
  };
  // the dark doors take no clear coat and roughness 0.75: with the Nickel Steel's coat the viewer's light washed the
  // Graphite Black to a light blue-grey at 16 degrees (freezer door 97 against the photo's 78); without it within 10
  const DARK = { rough: 0.75, coat: null };
  const FIN = [
    ["Nickel Steel", {}],
    ["Graphite Black", { DoorFreezer: { tex: `${T}/door_freezer_gk.jpg`, ...DARK }, DoorFridge: { tex: `${T}/door_fridge_gk.jpg`, ...DARK } }],
    ["GE Black", { DoorFreezer: { tex: `${T}/door_freezer_gb.jpg`, ...DARK }, DoorFridge: { tex: `${T}/door_fridge_gb.jpg`, ...DARK } }],
  ];
  const vs = FIN.map(([n]) => ext.createVariant(n));
  const mats = doc.getRoot().listMaterials(), alt = {};
  for (const name of new Set(FIN.flatMap(([, t]) => Object.keys(t)))) {
    const base = mats.find((m) => m.getName() === name);
    if (!base) throw new Error(`no material ${name}`);
    alt[name] = FIN.map(([fn, t]) => {
      if (!t[name]) return base;
      const tag = `${name}${fn.replace(/\s+/g, "")}`;
      return make(base.clone().setName(tag), tag, t[name]);
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
