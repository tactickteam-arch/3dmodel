// Haier HRF-3182IENSA-P, 268 L frost-free double door, not convertible, flat doors, recess handle, Nickel Steel: the
// code on Sangeetha's sheet (row 4, "HRF-3182IENSA-P"; Sangeetha lists no product for it). Haier India's page for this exact
// code gives 268 L, 2 star, 235 units a year, no fruit case (the sheet's 318 L, 8-in-1 convertible and Twin Inverter are not
// on it; NOTES.md). Built to Haier's published size, 548 W x 1685 H x 615 D mm (that page: "548*615*1685", W x D x H), and to
// Haier's gallery of the IENSA-P: the straight-on front (the doors, the Haier wordmark, the recess handle across the top of
// the fridge door, the feet and the bottom hinge), the two 3/4 views, the empty open-door photo (every shelf, box, vent and
// print inside), the stocked open photo and the straight-on back.
// It is the HRF-3182IBNS-P's body, doors and fridge (make_haier_hrf3182.mjs, whose heights were first measured on these same
// IENSA-P photos), less what the IBNS-P adds: no CONVERTIBLE badge on the freezer door, no convertible panel (slots, badge,
// mode knob) and no FRUITBOX. Inside the freezer the IENSA-P shows hexagon vents (three on each side of its back panel over
// the tray, two on each side under it), a slider control at the lower right, and the ice box standing on the tray.
// Freezer on top, fridge below, both doors hinged on the right. Haier publishes no manual, door swing or clearances: the
// doors' 140 degrees and every inside height are ESTIMATED from the open-door photos (NOTES.md). The cabinet's walls, back
// and doors are as thick as the HRF-2902ICMC-P's (the same 548 x 615 mm footprint; ESTIMATED).
// The SLIDINGSHELF and the FRESHBOX are one part (FridgeTrays) that comes out with its food when the fridge door is open;
// the ice box slides out. Stocked for a south Indian kitchen (stock_lg.mjs, fit: true).
// usage: node make_haier_hrf3182iensa.mjs <entry .json, never products.json> <tex dir> <out.glb>
import fs from "node:fs";
import { LGStock } from "./stock_lg.mjs";
import { THREE, mat, mesh, box, faced, group, flipV, stateClips, exportGLB, productParts, saveZones } from "./lib.mjs";

const [PRODUCTS, TEX, OUT] = process.argv.slice(2);
const ID = "haier-hrf-3182iensa-p";
const T = `${TEX}/haier_hrf3182iensa`;

// ── size (metres): Haier's 548 x 1685 x 615 mm (the IENSA-P page) ──
const W = 0.548, H = 1.685, D = 0.615;
const doorT = 0.055, Dc = D - doorT;                 // door thickness ESTIMATED (as the HRF-2902ICMC-P)
const zBack = -D / 2, zFront = zBack + Dc;
const wall = 0.03, backT = 0.04;                     // side walls and the back's insulation (ESTIMATED, as the HRF-2902ICMC-P)
// heights on Haier's front (0.625 px per mm up; floor row 1137, door top row 84)
const cabTop = H - 0.015;                            // the doors stand about 15 mm above the cabinet's top (3/4 photos)
const yFreezer = 1.207;                              // freezer door, 1207-1685 mm
const frBot = 0.043, frTop = 1.203;                  // fridge door, 43-1203 mm
const faceTop = 1.143, lipTop = 1.162;               // its steel face ends at 1143; the dark lip to 1162; the channel above
const recessDepth = 0.025;                           // how far the channel goes into the door (ESTIMATED)
const endL = 0.023, endR = 0.03;                     // the channel's end blocks (front photo: 14 px at the left, 19 at the right)
const base = 0.043;                                  // the cabinet's underside, at the doors' bottom edge
// inside heights, ESTIMATED from Haier's open-door photo (0.547 px per mm up on the cabinet's front, NOTES.md)
const floorTop = 0.107;                              // fridge floor
const fzCeil = 1.167, fzFloor = 1.233;               // the mullion: fridge ceiling, freezer floor
const fzTop = 1.632;                                 // freezer ceiling
const fzShelfTop = 1.425, padT = 0.02;               // the white tray across the freezer: its top, its thickness
const s1 = 1.008, s2 = 0.838, s3 = 0.657, s4 = 0.493; // the SLIDINGSHELF and the three glass shelves (s4 the lowest, open below)
const sCover = 0.322;                                // the FRESHBOX's grid cover
const vbBottom = floorTop + 0.006, vbTop = 0.306;    // the FRESHBOX
// door bins (ESTIMATED, same photo, at the bins' hinge ends): floor above the door's bottom edge, end height, depth
const BINS = {
  FridgeDoor: [{ f: 0.254, h: 0.15, d: 0.095, print: true }, { f: 0.716, h: 0.07, d: 0.09 }, { f: 0.96, h: 0.065, d: 0.065, eggs: true }],
  FreezerDoor: [{ f: 0.045, h: 0.095, d: 0.075 }, { f: 0.23, h: 0.09, d: 0.07 }],
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
const doorEdge = mat("DoorEdge", 0x1c1d20, { metal: 0.2, rough: 0.5 });       // the doors' edges, near black (3/4 photos: 23-24)
const lipM = mat("HandleLip", 0x3a3b3e, { metal: 0.3, rough: 0.4 });          // the handle's lip: dark grey (front photo 59)
const channelM = mat("HandleChannel", 0xffffff, { rough: 0.6 });              // its channel, light read off the photo
const endM = mat("HandleEnd", 0x55575b, { rough: 0.5 });                      // the channel's end blocks (photo 20-110)
const capM = mat("HandleCap", 0x6a6c70, { rough: 0.45 });
const sidePaint = mat("SidePaint", 0x38393c, { metal: 0.3, rough: 0.5 });     // dark grey painted steel (3/4 photos at 16 degrees: 47-64; renders 57-66)
const topPaint = mat("TopPaint", 0x37383b, { metal: 0.15, rough: 0.7 });
const frontEdge = mat("FrontEdge", 0x5d5e62, { metal: 0.2, rough: 0.55 });    // the sides' front edges round the openings
const rearM = mat("RearPlate", 0xffffff, { rough: 0.6 });                     // Haier's rear photo; not metal (renders 120 against the photo's 190, the back faces away from the light)
const logoM = mat("HaierMark", 0xffffff, { rough: 0.35, opacity: 0.999 });
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
const padM = mat("FreezerTray", 0xf2f4f6, { rough: 0.5, opacity: 0.9 });      // a white frosted tray (open photo)
const white = mat("WhitePlastic", 0xf6f7f8, { rough: 0.45 });
const vent = mat("Vent", 0x3c3f44, { rough: 0.7 });
const lightM = mat("Led", 0xffffff, { emissive: 0xf4f8ff, emissiveIntensity: 1.5 });
const ice = mat("IceCube", 0xe3f4ff, { rough: 0.08, opacity: 0.72 });
const footM = mat("Foot", 0x131416, { rough: 0.7 });
const hingeM = mat("Hinge", 0xc9ccd0, { metal: 0.9, rough: 0.3 });
const printSliding = mat("PrintSliding", 0xffffff, { rough: 0.5, opacity: 0.999 });
const printFresh = mat("PrintFreshbox", 0xffffff, { rough: 0.5, opacity: 0.999 });
const printBottle = mat("PrintBottleguard", 0xffffff, { rough: 0.5, opacity: 0.999 });
const printNavi = mat("PrintNavi", 0xffffff, { rough: 0.5, opacity: 0.999 });
const naviSlots = mat("NaviSlots", 0xffffff, { rough: 0.6, opacity: 0.999 });
const arcTemp = mat("ArcTemp", 0xffffff, { rough: 0.6, opacity: 0.999 });
const hexRowM = mat("HexRow", 0xffffff, { rough: 0.6, opacity: 0.999 });
const hexVent3 = mat("HexVent3", 0xffffff, { rough: 0.7, opacity: 0.999 });   // the freezer's dark hexagon vents
const hexVent2 = mat("HexVent2", 0xffffff, { rough: 0.7, opacity: 0.999 });
const fzCtrlM = mat("FzControl", 0xffffff, { rough: 0.5, opacity: 0.999 });    // the freezer control's window and label plates
const gridM = mat("CoverGrid", 0xffffff, { rough: 0.45, opacity: 0.999, side: THREE.DoubleSide });

const root = group("HaierHRF3182IENSA");
const cab = group("Cabinet");
root.add(cab);
// the printed words are drawn at 12 px per mm (tex_haier_hrf3182.py): a decal's size in metres is its PNG's size / 12000
const png = (f) => { const b = fs.readFileSync(`${T}/${f}`); return [b.readUInt32BE(16) / 12000, b.readUInt32BE(20) / 12000]; };
const plane = (name, w, h, m, x, y, z) => mesh(name, flipV(new THREE.PlaneGeometry(w, h)), m, x, y, z);
const decal = (name, f, m, x, y, z) => { const [w, h] = png(f); return plane(name, w, h, m, x, y, z); };
const cyl = (name, rt, rb, h, m, x, y, z, seg = 16) => mesh(name, new THREE.CylinderGeometry(rt, rb, h, seg), m, x, y, z);

// ── cabinet: dark grey painted steel outside, white inside ──
const shellH = cabTop - base, shellMid = base + shellH / 2, cD = zFront - zBack - 0.004, zMid = (zFront + zBack + 0.004) / 2;
cab.add(faced("SideLeft", wall, shellH, cD, [liner, sidePaint, topPaint, baseDark, frontEdge, sidePaint], -W / 2 + wall / 2, shellMid, zMid));
cab.add(faced("SideRight", wall, shellH, cD, [sidePaint, liner, topPaint, baseDark, frontEdge, sidePaint], W / 2 - wall / 2, shellMid, zMid));
cab.add(faced("Top", W - 2 * wall, cabTop - fzTop, cD, [liner, liner, topPaint, liner, frontEdge, topPaint], 0, (cabTop + fzTop) / 2, zMid));
cab.add(faced("Base", W - 2 * wall, floorTop - base, cD, [liner, liner, liner, baseDark, baseDark, baseDark], 0, base + (floorTop - base) / 2, zMid));
cab.add(faced("BackWall", W - 2 * wall, fzTop - floorTop, backT - 0.0045, [liner, liner, liner, liner, liner, liner], 0, (fzTop + floorTop) / 2, zBack + 0.004 + (backT - 0.0045) / 2));
cab.add(faced("Divider", W - 2 * wall, fzFloor - fzCeil, zFront - (zBack + backT), [liner, liner, liner, liner, liner, liner], 0, (fzCeil + fzFloor) / 2, (zFront + zBack + backT) / 2));
// the back: Haier's rear photo (the embossed plate and the open compressor bay with its wiring) on a 4 mm plate. No mains
// cord or plug shows on it or on any other photo, so none is modelled (NOTES.md)
cab.add(mesh("RearPlate", flipV(new THREE.BoxGeometry(W, shellH, 0.004)), [sidePaint, sidePaint, topPaint, baseDark, liner, rearM], 0, shellMid, zBack + 0.002));
// feet: on Haier's front the left one 46 mm in (44 mm across), the right one under the bottom hinge 39 mm in (43 mm); the
// two at the back are not shown on any photo: ESTIMATED, as the front left
cab.add(cyl("FootFrontL", 0.02, 0.021, base, footM, -W / 2 + 0.046, base / 2, zFront - 0.05));
cab.add(cyl("FootFrontR", 0.02, 0.021, base - 0.008, footM, W / 2 - 0.039, (base - 0.008) / 2, zFront - 0.015));
for (const sx of [-1, 1]) cab.add(cyl("FootRear", 0.02, 0.021, base, footM, sx * (W / 2 - 0.046), base / 2, zBack + 0.06));
// hinges on the right: the bracket over the right foot (front photo, 57 mm across), the middle hinge plate on the mullion
// (open photo), and the cover on the cabinet's top behind the freezer door (3/4 photos)
cab.add(box("HingeBottom", 0.05, 0.008, 0.07, hingeM, W / 2 - 0.037, base - 0.004, zFront + 0.012));
// (the plate as thick as the 4 mm gap between the doors less 1 mm: 12 mm thick, the doors' corners passed through it
// as they opened)
cab.add(box("HingeMid", 0.035, yFreezer - frTop - 0.001, 0.006, hingeM, W / 2 - 0.025, (yFreezer + frTop) / 2, zFront + 0.003));
cab.add(box("HingeCoverTop", 0.07, H - cabTop - 0.001, 0.05, topPaint, W / 2 - 0.04, cabTop + (H - cabTop - 0.001) / 2, zFront - 0.026));

// ── inside ──
const inW = W - 2 * wall;
const zIn = zBack + backT;                            // the back wall's inner face
const zDuct = zIn + 0.012;                            // the front of the raised back panels
const rails = (name, yTop, z0, z1) => { for (const sx of [-1, 1]) cab.add(box(name, 0.01, 0.012, z1 - z0, linerDk, sx * (inW / 2 - 0.005), yTop - 0.012, (z0 + z1) / 2)); };
// the freezer (IENSA-P open photo, 0.413 px per mm across its back panel; heights as on the IBNS-P's, the same cabinet; and
// Haier's stocked close-up of this freezer, 0.725 px per mm): a raised back panel up to 1545 mm with a group of three dark
// hexagon vents on each side near its top (centres 116 mm either side, at 1520 mm), the white tray across it, two vents on
// each side under the tray (90 mm either side, 1372 mm), the slider control at the lower right (159 mm right, 1327 mm) in a
// round 60 mm boss, and the faint row of eleven hexagons low down
cab.add(box("FreezerBackPanel", inW - 0.04, 1.545 - fzFloor, 0.012, liner, 0, (1.545 + fzFloor) / 2, zIn + 0.006));
for (const sx of [-1, 1]) cab.add(decal("FreezerHexTop", "hexvent3.png", hexVent3, sx * 0.116, 1.52, zDuct + 0.0007));
for (const sx of [-1, 1]) cab.add(decal("FreezerHexLow", "hexvent2.png", hexVent2, sx * 0.09, 1.372, zDuct + 0.0007));
cab.add(cyl("FreezerControlBoss", 0.03, 0.03, 0.0015, liner, 0.159, 1.327, zDuct + 0.00075, 40).rotateX(Math.PI / 2));
cab.add(decal("FreezerControlDecal", "fz_control.png", fzCtrlM, 0.159, 1.327 - 0.012, zDuct + 0.0022));
cab.add(decal("FreezerHexRow", "hexrow.png", hexRowM, -0.03, fzFloor + 0.017, zDuct + 0.0007));
{
  const z0 = zDuct + 0.002, z1 = frontFreezer, w = inW - 0.012;
  cab.add(box("FreezerTray", w, padT, z1 - z0, padM, 0, fzShelfTop - padT / 2, (z0 + z1) / 2));
  cab.add(box("FreezerTrayRim", w, padT + 0.004, 0.006, white, 0, fzShelfTop - padT / 2 - 0.002, z1 + 0.003));
  rails("FreezerTrayRail", fzShelfTop - padT, zIn, z1 - 0.01);
}
// the ice box on the tray at the front left (IENSA-P open and stocked photos): a clear box with a white rim round its top,
// ice inside (about 150 mm wide and 70 mm tall; its depth ESTIMATED 200 mm)
const icW = 0.15, icH = 0.07, icD = 0.2, icX = -inW / 2 + 0.012 + icW / 2, icZ1 = frontFreezer - 0.015, icZ0 = icZ1 - icD;
const iceBox = group("IceBox", icX, fzShelfTop + 0.0005, 0);
{
  const bz = icZ1 - icD / 2, bh = icH - 0.008;
  iceBox.add(box("IceBoxFloor", icW - 0.008, 0.004, icD - 0.008, clear, 0, 0.002, bz));
  for (const sx of [-1, 1]) iceBox.add(box("IceBoxSide", 0.004, bh, icD, clear, sx * (icW / 2 - 0.002), bh / 2, bz));
  iceBox.add(box("IceBoxBack", icW - 0.008, bh, 0.004, clear, 0, bh / 2, icZ0 + 0.002));
  iceBox.add(box("IceBoxFront", icW - 0.008, bh, 0.004, clear, 0, bh / 2, icZ1 - 0.002));
  for (const sx of [-1, 1]) iceBox.add(box("IceBoxRimSide", 0.008, 0.008, icD, white, sx * (icW / 2 - 0.004), icH - 0.004, bz));
  for (const sz of [icZ0 + 0.004, icZ1 - 0.004]) iceBox.add(box("IceBoxRimEnd", icW, 0.008, 0.008, white, 0, icH - 0.004, sz));
  const cube = new THREE.BoxGeometry(0.024, 0.02, 0.024);
  for (let i = 0; i < 12; i++) {
    const c = mesh("IceCube", cube, ice, -0.045 + (i % 4) * 0.03, 0.016 + Math.floor(i / 8) * 0.019, icZ1 - 0.04 - Math.floor((i % 8) / 4) * 0.07 - (i % 2) * 0.012);
    c.rotation.set(0.2 * (i % 3), 0.5 * i, 0.15 * (i % 4));
    // a tilted cube's low corner stays on the floor it sits on (it poked through the bin's floor)
    { c.updateMatrix(); const cb = cube.clone().applyMatrix4(c.matrix); cb.computeBoundingBox(); if (cb.boundingBox.min.y < 0.006) c.position.y += 0.006 - cb.boundingBox.min.y; }
    iceBox.add(c);
  }
}
cab.add(iceBox);

// the fridge: the LED at the front of the ceiling (Haier: LED; the open photo shows a light cover there, about 100 mm),
// the duct box under the ceiling with two slots, the back panel down to shelf 3 with the small temperature knob (under the
// SLIDINGSHELF) and the NAVI badge with its slots (under shelf 2)
cab.add(box("FridgeLed", 0.1, 0.004, 0.02, lightM, 0, fzCeil - 0.002, zFront - 0.1));
const ductW = 0.3, ductD = 0.045, ductBot = 1.07;
cab.add(box("FridgeDuct", ductW, fzCeil - ductBot, ductD, liner, 0, (fzCeil + ductBot) / 2, zIn + ductD / 2));
for (const sx of [-1, 1]) cab.add(box("FridgeSlot", 0.036, 0.008, 0.004, vent, sx * 0.022, 1.12, zIn + ductD + 0.002));
cab.add(box("FridgePanel", 0.2, ductBot - 0.675, 0.012, liner, 0, (ductBot + 0.675) / 2, zIn + 0.006));
cab.add(cyl("TempKnobRing", 0.022, 0.022, 0.006, linerDk, 0, 0.935, zDuct + 0.003, 32).rotateX(Math.PI / 2));
cab.add(cyl("TempKnob", 0.018, 0.018, 0.012, white, 0, 0.935, zDuct + 0.006, 32).rotateX(Math.PI / 2));
cab.add(decal("TempArcDecal", "arc_temp.png", arcTemp, 0, 0.935, zDuct + 0.0007));
cab.add(decal("PrintNaviDecal", "print_navi.png", printNavi, 0, 0.775, zDuct + 0.0007));
cab.add(decal("NaviSlotsDecal", "navi_slots.png", naviSlots, 0, 0.712, zDuct + 0.0007));

// the shelves: the SLIDINGSHELF slides out with the FRESHBOX (FridgeTrays); the three glass shelves and the cover stay.
// Under shelf 4 the IENSA-P is open down to the FRESHBOX's cover (no FRUITBOX)
const trays = group("FridgeTrays");
cab.add(trays);
function glassShelf(parent, name, yTop, sliding) {
  const z0 = zDuct + 0.002, z1 = frontFridge, w = inW - 0.014;
  parent.add(box(name, w, 0.006, z1 - 0.012 - z0, glass, 0, yTop - 0.003, (z0 + z1 - 0.012) / 2));
  if (sliding) {             // its white front strip, 29 mm tall, SLIDINGSHELF on it (open photo)
    parent.add(box(name + "Rim", w, 0.029, 0.012, white, 0, yTop - 0.0145 + 0.004, z1 - 0.006));
    parent.add(decal("PrintSlidingDecal", "print_sliding.png", printSliding, 0, yTop - 0.0145 + 0.004, z1 + 0.0007));
  } else {
    parent.add(box(name + "Rim", w, 0.012, 0.012, glassRim, 0, yTop - 0.006, z1 - 0.006));
    parent.add(box(name + "Edge", w, 0.004, 0.003, edgeGreen, 0, yTop - 0.01, z1 + 0.0015));
  }
  rails(name + "Rail", yTop - 0.006, zIn, z1 - 0.01);
}
glassShelf(trays, "Shelf1", s1, true);
glassShelf(cab, "Shelf2", s2, false);
glassShelf(cab, "Shelf3", s3, false);
glassShelf(cab, "Shelf4", s4, false);
{ // the grid cover over the FRESHBOX: white ribs front to back on a thin clear plate, a white front rim
  const z0 = zIn + 0.002, z1 = frontFridge, w = inW - 0.014, d = z1 - 0.012 - z0;
  cab.add(box("VegCover", w, 0.004, d, clearLite, 0, sCover - 0.008, (z0 + z1 - 0.012) / 2));
  const g = mesh("CoverGridDecal", new THREE.PlaneGeometry(w, d), gridM, 0, sCover - 0.0055, (z0 + z1 - 0.012) / 2);
  g.rotation.x = -Math.PI / 2;
  cab.add(g);
  cab.add(box("VegCoverFront", w, 0.016, 0.012, white, 0, sCover - 0.008, z1 - 0.006));
  rails("VegCoverRail", sCover - 0.01, zIn, z1 - 0.01);
}
// the FRESHBOX (FzBox* are the names qa_bounds reads), FRESHBOX and its icons 8 mm right of the middle of its front, 62 mm
// above its floor (IENSA-P open photo, 0.476 px per mm across the box's front)
const vbW = inW - 0.016, vbZ0 = zIn + 0.01, vbZ1 = frontFridge, vbD = vbZ1 - vbZ0, vbZ = (vbZ0 + vbZ1) / 2;
{
  const hh = vbTop - vbBottom;
  trays.add(box("FzBoxFloor", vbW, 0.004, vbD, clear, 0, vbBottom + 0.002, vbZ));
  trays.add(box("FzBoxBack", vbW, hh, 0.004, clear, 0, vbBottom + hh / 2, vbZ0 + 0.002));
  trays.add(box("FzBoxL", 0.004, hh, vbD, clear, -vbW / 2 + 0.002, vbBottom + hh / 2, vbZ));
  trays.add(box("FzBoxR", 0.004, hh, vbD, clear, vbW / 2 - 0.002, vbBottom + hh / 2, vbZ));
  trays.add(box("FzBoxFront", vbW, hh - 0.012, 0.004, clearLite, 0, vbBottom + (hh - 0.012) / 2, vbZ1 - 0.002));
  trays.add(box("FzBoxRim", vbW + 0.006, 0.01, 0.008, frosted, 0, vbTop - 0.005, vbZ1 - 0.002));
  trays.add(box("FzBoxFootRim", vbW, 0.01, 0.008, frosted, 0, vbBottom + 0.005, vbZ1 - 0.002));
  trays.add(decal("PrintFreshboxDecal", "print_freshbox.png", printFresh, 0.008, vbBottom + 0.062, vbZ1 + 0.0007));
}

// ── groceries (stock_lg.mjs, food.mjs): vegetarian South Indian food, eggs, juices, water and soft drinks ──
const stock = LGStock({ T3: `${TEX}/lg_glt3426`, TF: `${TEX}/food`, BR: `${TEX}/brands`, BRT: `${TEX}/brands/small` });
const vbFloor = vbBottom + 0.004;
stock.shelves(trays, {
  // stock_lg.mjs stands the food 3 mm over the height it is given: give it each top less 2.5 mm
  zIn1: zIn, inW, inD: frontFridge - zIn, s1: s1 - 0.0025, s2: s2 - 0.0025, s3: s4 - 0.0025, fz: vbFloor, fit: true,
  vz0: vbZ0 + 0.02, vk: 0.75,                       // spread so the heap settles steady (tried in steps; 3 of the 5 carrots find no room)
  shelfB: { hw: inW / 2 - 0.03, z0: zDuct + 0.02, z1: frontFridge - 0.015 },
  drawerB: { hw: vbW / 2 - 0.014, z0: vbZ0 + 0.02, z1: vbZ1 - 0.008, y0: vbFloor },
  drawerCeil: sCover - 0.008 - 0.01 - vbFloor,   // the heap stays 1 cm under the cover
});
// shelves 2 and 4 are fixed: their food stays in the cabinet when the trays come out (the fruit lies on shelf 4)
for (const n of ["Shelf2Stock", "Shelf3Stock"]) { const g = trays.getObjectByName(n); cab.attach(g); }
// shelf 3: butter, cheese and curd cups (the LG 343 L's Fresh 0 Zone set)
stock.fresh0(cab, { y: s3, z: (zDuct + frontFridge) / 2 + 0.01 });
stock.freezer(cab, { fit: true, zIn1: zIn, floor: fzFloor, top: fzShelfTop + 0.0005, box: { hw: inW / 2 - 0.03, z0: zDuct + 0.02, z1: frontFreezer - 0.01 } });

// The fitted stock is laid out for the LG 343 L's trays (about 540 mm between the walls; this one has 488 and is
// shallower), so it is laid out again where this cabinet differs: the SLIDINGSHELF sits under the duct box (45 mm deep),
// so its food starts 12 mm in front of it and the milk pouches are left out; shelf 2 leaves out the biryani tin; shelf 4,
// the lowest, holds the fruit as on Haier's stocked photo (bananas, grapes, a lemon, three apples and an orange) and the
// curd; in the freezer the ice box stands on the tray at the left with an ice-cream tub beside it (as on Haier's stocked
// photo); on the floor the two parotta packs stand at the back, the second tub at the front right and three packs lie in
// one pile at the front left; the standing pack of peas is left out (181 mm, the floor has 172 under the tray)
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
function place(o, { l, r, cx, b, f, y }) {     // moves o so its box's left/right/middle, back/front and bottom land there
  root.updateMatrixWorld(true);
  const bb = bbox(o);
  if (l != null) o.position.x += l - bb.min.x;
  if (r != null) o.position.x += r - bb.max.x;
  if (cx != null) o.position.x += cx - (bb.min.x + bb.max.x) / 2;
  if (b != null) o.position.z += b - bb.min.z;
  if (f != null) o.position.z += f - bb.max.z;
  if (y != null) o.position.y += y - bb.min.y;
}
const hw = inW / 2 - 0.03;
{
  const g = trays.getObjectByName("Shelf1Stock");
  drop(g.getObjectByName("NandiniMilk"), g.getObjectByName("AavinMilk"), g.getObjectByName("AmulTaazaPouch"));
  const z0 = zIn + ductD + 0.012;
  const d1 = row([g.getObjectByName("Tiffin"), g.getObjectByName("IdBatterPouch1"), g.getObjectByName("MastiButtermilk")], -hw, hw, z0);
  row([g.getObjectByName("RnrBiryaniBox")], -hw, hw, z0 + d1 + 0.012);
}
{
  const g = cab.getObjectByName("Shelf2Stock"), z0 = zDuct + 0.02;
  drop(g.getObjectByName("RnrBiryani"));
  const d1 = row([g.getObjectByName("CoconutHalf"), g.getObjectByName("WatermelonHalf")], -hw, hw, z0);
  row([g.getObjectByName("NandhanaPalace"), g.getObjectByName("NandhanaPalace2")], -hw, hw, z0 + d1 + 0.03);
}
{
  const g = cab.getObjectByName("Shelf3Stock"), z0 = zDuct + 0.02;
  const [a0, a1, a2, a3, a4] = kids(g, "Apple"), [o0, o1, o2] = kids(g, "Orange"), [l0, l1] = kids(g, "Lemon");
  drop(a1, a4, o1, o2, l0);
  const d1 = row([g.getObjectByName("Bananas"), g.getObjectByName("Grapes"), l1], -hw, hw, z0);
  row([a0, o0, a2, a3], -hw, hw, z0 + d1 + 0.02);
  // the curd goes on the SLIDINGSHELF beside the biryani box: shelf 4 has no room left for it, shelf 3 holds the cups
  const dahi = g.getObjectByName("AmulMastiDahi"), sl = trays.getObjectByName("Shelf1Stock");
  sl.attach(dahi);
  place(dahi, { y: s1 + 0.0005 });
  root.updateMatrixWorld(true);
  const box = sl.getObjectByName("RnrBiryaniBox"), bz = bbox(box);
  row([box, dahi], -hw, hw, bz.min.z);}
{
  const f = cab.getObjectByName("FreezerStock"), t = cab.getObjectByName("OnFreezerShelf");
  const inL = -inW / 2 + 0.015, inR = inW / 2 - 0.015, back = zDuct + 0.015, front = frontFreezer - 0.015;
  place(f.getObjectByName("ViswasParotta"), { l: inL, b: back });
  place(f.getObjectByName("NityaParotta"), { r: inR, b: back });
  place(f.getObjectByName("AmulRajbhog"), { r: inR, f: front, y: fzFloor + 0.0005 });
  drop(f.getObjectByName("FreshoGreenPeas"));       // standing it is 181 mm, the floor has 172 under the tray
  const tub = f.getObjectByName("AmulVanillaMagic");
  t.attach(tub);                                    // keeps where it is in the room, then moves
  place(tub, { l: icX + icW / 2 + 0.02, f: front - 0.005, y: fzShelfTop + 0.0005 });
  let top = fzFloor + 0.0005;
  ["ViswasParotta2", "AmulPaneer", "FreshoGreenPeas2"].forEach((n, i) => {
    const o = t.getObjectByName(n);
    f.attach(o);
    place(o, { l: inL + [0.005, 0.012, 0.008][i], f: front - [0.005, 0.015, 0.009][i], y: top });
    root.updateMatrixWorld(true);
    top = bbox(o).max.y;
  });
}
{ // the herbs lie flat on the FRESHBOX floor: their leaves' lowest tips go on the floor, not through it
  const g = trays.getObjectByName("FreshZoneStock");
  root.updateMatrixWorld(true);
  for (const o of [...kids(g, "Coriander"), ...kids(g, "CurryLeaves")]) {
    const lo = new THREE.Box3().setFromObject(o, true).min.y;
    if (lo < vbFloor + 0.001) o.position.y += vbFloor + 0.001 - lo;
  }
}

// ── doors: hinged on the right, brushed steel fronts, near-black edges ──
const pw = W - 0.002, bw = pw - 0.1;
const inside = (dep) => [-pw / 2 - bw / 2 + 0.004, -pw / 2 + bw / 2 - 0.004, -(linerFace + dep / 2)];
const EGGS = [0, 1, 2, 3, 4, 5].map((i) => -pw / 2 + bw / 2 - 0.004 - 0.03 - i * 0.05);   // at the bin's hinge end
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
    // BOTTLEGUARD on the lowest bin's front, towards its far end (open photo); it faces the room when the door is open
    if (b.print) { const [w, hh] = png("print_bottleguard.png"); pivot.add(plane("PrintBottleguardDecal", w, hh, printBottle, -pw / 2 - 0.03, b.f + b.h * 0.42, zl - 0.0007).rotateY(Math.PI)); }
    if (b.eggs) for (const x of EGGS) { const c = mesh("EggCup", new THREE.SphereGeometry(0.02, 12, 4, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), clear, x, b.f, zc); c.scale.y = 0.7; pivot.add(c); }
  });
}
// the freezer door: the Haier wordmark (59 mm, centred, its middle 85 mm below the top), measured on Haier's front; the
// IENSA-P's door has no other print
const freezerDoor = group("FreezerDoor", W / 2, yFreezer, zFront);
{
  const h = H - yFreezer;
  freezerDoor.add(mesh("FreezerPanel", flipV(new THREE.BoxGeometry(pw, h, doorT)), [doorEdge, doorEdge, doorEdge, doorEdge, doorFz, liner], -pw / 2, h / 2, doorT / 2));
  freezerDoor.add(decal("HaierMarkDecal", "logo.png", logoM, -pw / 2, h - 0.085, doorT + 0.0007));
  doorInside(freezerDoor, "FreezerDoor", h);
}
// the fridge door: the steel face, the handle's dark lip (a rounded bar), the channel above it set 25 mm back with its
// end blocks and their rounded inner ends
const fridgeDoor = group("FridgeDoor", W / 2, frBot, zFront);
{
  const h = frTop - frBot, faceH = faceTop - frBot, lipH = lipTop - faceTop, chH = frTop - lipTop;
  fridgeDoor.add(mesh("FridgePanel", flipV(new THREE.BoxGeometry(pw, faceH, doorT)), [doorEdge, doorEdge, doorEdge, doorEdge, doorFr, liner], -pw / 2, faceH / 2, doorT / 2));
  const sb = doorT - 0.004;
  fridgeDoor.add(mesh("HandleLip", new THREE.BoxGeometry(pw, lipH, sb), [doorEdge, doorEdge, lipM, doorEdge, lipM, liner], -pw / 2, faceH + lipH / 2, sb / 2));
  const round = mesh("HandleLipFace", new THREE.CylinderGeometry(lipH / 2, lipH / 2, pw - 0.003, 24, 1, false, -Math.PI / 2, Math.PI), lipM, -pw / 2, faceH + lipH / 2, sb);
  round.rotation.z = Math.PI / 2; round.scale.set(1, 1, 0.0035 / (lipH / 2));
  fridgeDoor.add(round);
  const cd = doorT - recessDepth, yc = lipTop - frBot + chH / 2, cw = pw - endL - endR;
  fridgeDoor.add(mesh("HandleChannel", flipV(new THREE.BoxGeometry(cw, chH, cd)), [doorEdge, doorEdge, doorEdge, doorEdge, channelM, liner], -pw + endL + cw / 2, yc, cd / 2));
  for (const [x, w, sx] of [[-pw + endL / 2, endL, -1], [-endR / 2, endR, 1]]) {
    fridgeDoor.add(mesh("HandleEnd", new THREE.BoxGeometry(w, chH, doorT), [doorEdge, doorEdge, doorEdge, doorEdge, endM, liner], x, yc, doorT / 2));
    const cap = cyl("HandleCap", recessDepth / 2, recessDepth / 2, chH - 0.001, capM, x - sx * w / 2, yc, cd + recessDepth / 2, 16);
    cap.scale.x = 0.55;
    fridgeDoor.add(cap);
  }
  doorInside(fridgeDoor, "FridgeDoor", h);
}
// the 4 mm gap between the doors: the white mullion behind it showed through as a bright line from eye level (on Haier's
// front it reads dark, in the doors' shadow). Each door carries a dark fin into the gap, the fridge door's at the back and
// the freezer door's in front of it, overlapping 1.2 mm in height and clearing the other door by 1.4 mm, so no straight
// line of sight reaches the mullion; each fin is set 1 mm into its own door and stops 2 mm short of the doors' sides
{
  const gap = yFreezer - frTop, ov = 0.0012, rise = (gap + ov) / 2, fw = pw - 0.004;
  fridgeDoor.add(box("SeamFinFridge", fw, rise + 0.001, 0.008, doorEdge, -pw / 2, frTop - frBot + (rise - 0.001) / 2, 0.006));
  freezerDoor.add(box("SeamFinFreezer", fw, rise + 0.001, 0.008, doorEdge, -pw / 2, -(rise - 0.001) / 2, 0.016));
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
  RearPlate: `${T}/rear.jpg`,
  PrintSliding: `${T}/print_sliding.png`,
  PrintFreshbox: `${T}/print_freshbox.png`,
  PrintBottleguard: `${T}/print_bottleguard.png`,
  PrintNavi: `${T}/print_navi.png`,
  NaviSlots: `${T}/navi_slots.png`,
  ArcTemp: `${T}/arc_temp.png`,
  HexRow: `${T}/hexrow.png`,
  HexVent3: `${T}/hexvent3.png`,
  HexVent2: `${T}/hexvent2.png`,
  FzControl: `${T}/fz_control.png`,
  CoverGrid: `${T}/grid.png`,
  ...stock.textures(),
}), { dir: `${TEX}/grain`, materials: {
  DoorFreezer: { type: "hairline", dir: "v", clearcoat: COAT },
  DoorFridge: { type: "hairline", dir: "v", clearcoat: COAT },
  SidePaint: { type: "peel_soft" }, TopPaint: { type: "peel_soft" },
} });
