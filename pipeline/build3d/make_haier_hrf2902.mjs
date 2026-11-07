// Haier HRF-2902ICMC-P, 240 L frost-free double door, Marine Carnation (flat doors with the flower print).
// Built to Haier's published size, 548 W x 1560 H x 615 D mm (Haier India's page for this code; Sangeetha's listing 20637
// gives the same), and to the official photos: Haier's straight-on front (the print, the wordmark, the CONVERTIBLE badge,
// the recess handle and silver strip across the top of the fridge door, the feet and the bottom hinge) and Sangeetha's
// photos of this listing (the open doors with every tray named, the side, the recess handle close-up, the ice maker).
// Freezer on top, fridge below, both doors hinged on the right. Haier publishes no manual, rear photo or door swing for
// this model: the back is a plain panel (no cord, plug or compressor bay is shown anywhere), and every inside height
// and the doors' 140 degrees are ESTIMATED from Sangeetha's open-door photo (NOTES.md).
// Inside, as that photo names them: in the freezer the Ice Maker (a white tray over a clear bin, "detachable"), a shelf,
// the back-wall vents and dial; in the fridge the LED light, the Sliding Shelf, two toughened-glass shelves, the NAVI
// panel, the Separate Fruit Box, the vegetable box cover and the Large Vegetable Box; two bins on the freezer door, and on
// the fridge door two egg bins and the Big Bottle Rack. The Sliding Shelf, the Fruit Box and the Vegetable Box slide out,
// so they are one part (FridgeTrays) that comes out with its food when the fridge door is open; the ice maker is a part.
// Stocked for a south Indian kitchen (stock_lg.mjs, fit: true, BENCHMARK.md section 13).
// usage: node make_haier_hrf2902.mjs <entry .json, never products.json> <tex dir> <out.glb>
import { LGStock } from "./stock_lg.mjs";
import { THREE, mat, mesh, box, faced, group, flipV, stateClips, exportGLB, productParts, saveZones } from "./lib.mjs";

const [PRODUCTS, TEX, OUT] = process.argv.slice(2);
const ID = "haier-hrf-2902icmc-p";
const T = `${TEX}/haier_hrf2902`;

// ── size (metres): Haier's 548 x 1560 x 615 mm ──
const W = 0.548, H = 1.56, D = 0.615;
const doorT = 0.055, Dc = D - doorT;                 // door thickness ESTIMATED (Sangeetha's side views)
const zBack = -D / 2, zFront = zBack + Dc;
const wall = 0.03, backT = 0.04;                     // side walls and the back's insulation (ESTIMATED)
// heights on Haier's front (0.567 px per mm up; floor row 1031, door top row 146.5)
const cabTop = H - 0.015;                            // the doors stand about 15 mm above the cabinet's top (side views)
const yFreezer = 1.075;                              // freezer door, 1075-1560 mm
const frBot = 0.0397, frTop = 1.0697;                // fridge door, 39.7-1069.7 mm
const lipT = 0.003, recessH = 0.0273, stripH = 0.0212; // the door's top lip, the recess handle channel, the silver strip
const recessDepth = 0.025;                           // how far the channel goes into the door (ESTIMATED, recess close-up)
const base = 0.04;                                   // the cabinet's underside, at the doors' bottom edge
// inside heights, ESTIMATED from Sangeetha's open-door photo (0.366 px per mm on the 1560 mm body; NOTES.md)
const floorTop = 0.105;                              // fridge floor
const fzCeil = 1.05, fzFloor = 1.115;                // the mullion: fridge ceiling, freezer floor
const fzTop = cabTop - 0.035;                        // freezer ceiling
const fzShelfTop = 1.32;                             // the freezer shelf
const s1 = 0.888, s2 = 0.746, s3 = 0.492;            // Sliding Shelf, shelf 2, shelf 3 (over the fruit box): glass tops
const fbBottom = 0.375, fbTop = 0.48;                // the Separate Fruit Box
const sCover = 0.352;                                // the vegetable box cover's top
const vbBottom = floorTop + 0.006, vbTop = 0.335;    // the Large Vegetable Box
// door bins (ESTIMATED, same photo): floor above the door's bottom edge, end-wall height, depth out from the liner
const BINS = {
  FridgeDoor: [{ f: 0.31, h: 0.14, d: 0.095 }, { f: 0.77, h: 0.075, d: 0.09 }, { f: 0.935, h: 0.065, d: 0.065, eggs: true }],
  FreezerDoor: [{ f: 0.045, h: 0.1, d: 0.075 }, { f: 0.226, h: 0.07, d: 0.07 }],
};
const linerFace = 0.016;
const reach = (name) => Math.max(...BINS[name].map((b) => b.d)) + linerFace;
const frontFridge = zFront - reach("FridgeDoor") - 0.01;   // shelves, fruit box, vegetable box and its cover end here
const frontFreezer = zFront - reach("FreezerDoor") - 0.01;

// ── materials ──
const sidePaint = mat("SidePaint", 0x56575a, { metal: 0.3, rough: 0.5 });     // dark grey painted steel (side views)
const topPaint = mat("TopPaint", 0x55565a, { metal: 0.15, rough: 0.7 });
const backPaint = mat("BackPaint", 0x505154, { metal: 0.1, rough: 0.75 });
const doorFz = mat("DoorFreezer", 0xffffff, { rough: 0.3 });                  // the flower print: glossy, no grain
const doorFr = mat("DoorFridge", 0xffffff, { rough: 0.3 });
const doorEdge = mat("DoorEdge", 0x1d2130, { metal: 0.2, rough: 0.5 });      // the doors' edges, dark navy-black (open-door photo)
const recessM = mat("Recess", 0x00104a, { rough: 0.6 });                      // the navy handle channel (photo: the door's navy)
const strip = mat("SilverStrip", 0xf4f6fa, { metal: 0.35, rough: 0.22 });     // bright, white-silver (photo: 246 falling to 191)
const frame = mat("FrontFrame", 0x1c1d21, { rough: 0.6 });                  // the cabinet's front frame round the openings: black on
                                                                               // the open-door photo, dark in the doors' gap on Haier's front
const logoM = mat("HaierMark", 0xffffff, { rough: 0.35, opacity: 0.999 });
const badgeM = mat("BadgeConvertible", 0xffffff, { rough: 0.35, opacity: 0.999 });
const liner = mat("Liner", 0xf1f3f5, { rough: 0.6 });
const linerDk = mat("LinerGrey", 0xdde1e5, { rough: 0.62 });
const gasket = mat("Gasket", 0x8d9196, { rough: 0.85 });
const baseDark = mat("BaseDark", 0x1b1c1f, { rough: 0.8 });
const glass = mat("TemperedGlass", 0xa9cdd6, { rough: 0.05, opacity: 0.55, side: THREE.DoubleSide });
const glassRim = mat("ShelfRim", 0xf4f5f6, { rough: 0.45 });
const clear = mat("ClearPlastic", 0xc3d0da, { rough: 0.12, opacity: 0.5, side: THREE.DoubleSide });
const clearLite = mat("ClearPlasticLight", 0xdfe7ee, { rough: 0.12, opacity: 0.26, side: THREE.DoubleSide });
const frosted = mat("Frosted", 0xe6edf1, { rough: 0.45, opacity: 0.78 });
const white = mat("WhitePlastic", 0xf6f7f8, { rough: 0.45 });
const vent = mat("Vent", 0x6b7077, { rough: 0.7 });
const lightM = mat("Led", 0xffffff, { emissive: 0xf4f8ff, emissiveIntensity: 1.5 });
const ice = mat("IceCube", 0xe3f4ff, { rough: 0.08, opacity: 0.72 });
const iceBin = mat("IceBinClear", 0xa9c4e4, { rough: 0.1, opacity: 0.55, side: THREE.DoubleSide });   // the ice maker's blue-clear bin (photo 5)
const footM = mat("Foot", 0x131416, { rough: 0.7 });
const hingeM = mat("Hinge", 0xc9ccd0, { metal: 0.9, rough: 0.3 });
const printSliding = mat("PrintSliding", 0xffffff, { rough: 0.5, opacity: 0.999 });
const printFruit = mat("PrintFruit", 0xffffff, { rough: 0.5, opacity: 0.999 });
const printNavi = mat("PrintNavi", 0xffffff, { rough: 0.5, opacity: 0.999 });
const coverRibs = mat("CoverRibs", 0xffffff, { rough: 0.4, opacity: 0.999 });

const root = group("HaierHRF2902");
const cab = group("Cabinet");
root.add(cab);
const plane = (name, w, h, m, x, y, z) => mesh(name, flipV(new THREE.PlaneGeometry(w, h)), m, x, y, z);
const cyl = (name, rt, rb, h, m, x, y, z, seg = 16) => mesh(name, new THREE.CylinderGeometry(rt, rb, h, seg), m, x, y, z);

// ── cabinet: dark grey painted steel outside, white inside, its front frame black ──
const shellH = cabTop - base, shellMid = base + shellH / 2, zMid = zBack + Dc / 2;
cab.add(faced("SideLeft", wall, shellH, Dc, [liner, sidePaint, topPaint, baseDark, frame, backPaint], -W / 2 + wall / 2, shellMid, zMid));
cab.add(faced("SideRight", wall, shellH, Dc, [sidePaint, liner, topPaint, baseDark, frame, backPaint], W / 2 - wall / 2, shellMid, zMid));
cab.add(faced("Top", W - 2 * wall, cabTop - fzTop, Dc, [liner, liner, topPaint, liner, frame, backPaint], 0, (cabTop + fzTop) / 2, zMid));
cab.add(faced("Base", W - 2 * wall, floorTop - base, Dc, [liner, liner, liner, baseDark, baseDark, backPaint], 0, base + (floorTop - base) / 2, zMid));
cab.add(faced("BackWall", W - 2 * wall, fzTop - floorTop, backT, [liner, liner, liner, liner, liner, backPaint], 0, (fzTop + floorTop) / 2, zBack + backT / 2));
cab.add(faced("Divider", W - 2 * wall, fzFloor - fzCeil, Dc - backT, [liner, liner, liner, liner, frame, liner], 0, (fzCeil + fzFloor) / 2, zMid + backT / 2));
// the back is the walls' backs, plain in the body's paint. Haier publishes no rear photo or manual, so no cord, plug,
// compressor bay or rating plate is modelled (NOTES.md)
// feet: on Haier's front a foot 44 mm in from the left edge (35 mm across) and one under the bottom hinge 30 mm in from
// the right (40 mm across), from the floor to the cabinet's underside; the two at the back are ESTIMATED (not shown)
cab.add(cyl("FootFrontL", 0.016, 0.0175, base, footM, -W / 2 + 0.044, base / 2, zFront - 0.06));
cab.add(cyl("FootFrontR", 0.018, 0.02, base - 0.008, footM, W / 2 - 0.03, (base - 0.008) / 2, zFront - 0.015));
for (const sx of [-1, 1]) cab.add(cyl("FootRear", 0.016, 0.0175, base, footM, sx * (W / 2 - 0.044), base / 2, zBack + 0.06));
// hinges on the right: the bottom bracket over the right foot (Haier's front: 32 x 8 mm, silver), the middle hinge in the
// doors' gap, and the top cover on the cabinet's top behind the freezer door
cab.add(box("HingeBottom", 0.032, 0.008, 0.07, hingeM, W / 2 - 0.03, base - 0.004, zFront + 0.012));
cab.add(box("HingeMid", 0.025, yFreezer - frTop - 0.001, 0.03, hingeM, W / 2 - 0.02, (yFreezer + frTop) / 2, zFront + 0.006));
cab.add(box("HingeCoverTop", 0.07, H - cabTop - 0.001, 0.05, topPaint, W / 2 - 0.04, cabTop + (H - cabTop - 0.001) / 2, zFront - 0.026));

// ── inside ──
const inW = W - 2 * wall;
const zIn = zBack + backT;                            // the back wall's inner face
const zDuct = zIn + 0.012;                            // the front of the raised back-wall panels
const rails = (name, yTop, z0, z1) => { for (const sx of [-1, 1]) cab.add(box(name, 0.01, 0.012, z1 - z0, linerDk, sx * (inW / 2 - 0.005), yTop - 0.012, (z0 + z1) / 2)); };
// the freezer: a raised duct panel across its upper back (a vent slot at the top right and the round dial), three vent
// slots in the lower back, the clear shelf across it
cab.add(box("FreezerDuct", inW - 0.06, fzTop - fzShelfTop - 0.012, 0.012, liner, 0, (fzTop + fzShelfTop) / 2 - 0.002, zIn + 0.006));
cab.add(box("FreezerVentTop", 0.11, 0.008, 0.004, vent, 0.09, fzTop - 0.05, zDuct + 0.002));
cab.add(cyl("FreezerDial", 0.021, 0.021, 0.014, white, 0.12, 1.405, zDuct + 0.007, 24).rotateX(Math.PI / 2));
cab.add(cyl("FreezerDialRing", 0.024, 0.024, 0.004, linerDk, 0.12, 1.405, zDuct + 0.002, 24).rotateX(Math.PI / 2));
for (const x of [-0.13, 0, 0.13]) cab.add(box("FreezerVent", 0.07, 0.01, 0.004, vent, x, fzFloor + 0.105, zIn + 0.002));
{
  const z0 = zDuct + 0.002, z1 = frontFreezer, w = inW - 0.012;
  cab.add(box("FreezerShelf", w, 0.006, z1 - 0.009 - z0, clearLite, 0, fzShelfTop - 0.003, (z0 + z1 - 0.009) / 2));
  cab.add(box("FreezerShelfRim", w, 0.016, 0.009, frosted, 0, fzShelfTop - 0.006, z1 - 0.0045));
  rails("FreezerShelfRail", fzShelfTop - 0.006, zIn, z1 - 0.01);
}
// the Ice Maker on the shelf at the front left: a white tray over a clear bin with the ice in it (Sangeetha's photo:
// "Detachable ice maker"); they slide out together. Its size is ESTIMATED from that photo (the bin about twice as long
// as it is wide)
const icW = 0.12, icD = 0.22, icX = -inW / 2 + 0.012 + icW / 2, icZ1 = frontFreezer - 0.015, icZ0 = icZ1 - icD;
const iceM = group("IceMaker", icX, fzShelfTop, 0);
{
  const bh = 0.06, bz = icZ1 - icD / 2;
  iceM.add(box("IceBinFloor", icW, 0.004, icD, iceBin, 0, 0.002, bz));
  for (const sx of [-1, 1]) iceM.add(box("IceBinSide", 0.004, bh, icD, iceBin, sx * (icW / 2 - 0.002), bh / 2, bz));
  iceM.add(box("IceBinBack", icW - 0.008, bh, 0.004, iceBin, 0, bh / 2, icZ0 + 0.002));
  iceM.add(box("IceBinFront", icW - 0.008, bh, 0.004, iceBin, 0, bh / 2, icZ1 - 0.002));
  iceM.add(box("IceTray", icW + 0.006, 0.018, icD + 0.006, white, 0, bh + 0.009, bz));
  iceM.add(box("IceTrayGrip", 0.06, 0.012, 0.01, white, 0, bh + 0.009, icZ1 + 0.008));
  const cube = new THREE.BoxGeometry(0.026, 0.022, 0.026);
  for (let i = 0; i < 12; i++) {
    const c = mesh("IceCube", cube, ice, -0.03 + (i % 3) * 0.03, 0.017 + Math.floor(i / 6) * 0.022, icZ1 - 0.035 - (Math.floor(i / 3) % 2) * 0.06 - (i % 2) * 0.01 - Math.floor(i / 6) * 0.04);
    c.rotation.set(0.2 * (i % 3), 0.5 * i, 0.15 * (i % 4));
    iceM.add(c);
  }
}
cab.add(iceM);

// the fridge: the LED light (four dots at the front of the ceiling), the vent panel under the ceiling, the NAVI panel
for (let i = 0; i < 4; i++) cab.add(box("FridgeLed", 0.008, 0.004, 0.008, lightM, -0.03 + i * 0.02, fzCeil - 0.002, zFront - 0.17));
cab.add(box("FridgeDuctTop", inW - 0.1, 0.06, 0.012, liner, 0, fzCeil - 0.032, zIn + 0.006));
for (const x of [-0.07, 0.07]) cab.add(box("FridgeVent", 0.08, 0.008, 0.004, vent, x, fzCeil - 0.035, zDuct + 0.002));
cab.add(box("NaviPanel", 0.19, 0.25, 0.012, liner, -0.03, 0.62, zIn + 0.006));
cab.add(plane("PrintNaviDecal", 0.046, 0.046, printNavi, -0.03, 0.665, zDuct + 0.0007));   // just under shelf 2, as on photo 4

// what slides out (FridgeTrays): the Sliding Shelf, the Separate Fruit Box and the Large Vegetable Box, with their food
const trays = group("FridgeTrays");
cab.add(trays);
function glassShelf(parent, name, yTop, print) {
  const z0 = zDuct + 0.002, z1 = frontFridge, w = inW - 0.014;
  parent.add(box(name, w, 0.006, z1 - 0.012 - z0, glass, 0, yTop - 0.003, (z0 + z1 - 0.012) / 2));
  parent.add(box(name + "Rim", w, 0.018, 0.012, glassRim, 0, yTop - 0.007, z1 - 0.006));
  if (print) parent.add(plane("PrintSlidingDecal", 0.12, 0.12 * 80 / 864, printSliding, 0, yTop - 0.007, z1 + 0.0007));
  rails(name + "Rail", yTop - 0.006, zIn, z1 - 0.01);
}
glassShelf(trays, "Shelf1", s1, true);               // the Sliding Shelf
glassShelf(cab, "Shelf2", s2, false);
glassShelf(cab, "Shelf3", s3, false);
// the Separate Fruit Box: a shallow clear box under shelf 3, "FRUIT BOX" on its front
const fbW = inW - 0.03, fbZ0 = zDuct + 0.006, fbZ1 = frontFridge, fbD = fbZ1 - fbZ0, fbZ = (fbZ0 + fbZ1) / 2, fbH = fbTop - fbBottom;
trays.add(box("FruitBoxFloor", fbW, 0.004, fbD, clear, 0, fbBottom + 0.002, fbZ));
trays.add(box("FruitBoxBack", fbW, fbH, 0.004, clear, 0, fbBottom + fbH / 2, fbZ0 + 0.002));
for (const sx of [-1, 1]) trays.add(box("FruitBoxSide", 0.004, fbH, fbD, clear, sx * (fbW / 2 - 0.002), fbBottom + fbH / 2, fbZ));
trays.add(box("FruitBoxFront", fbW, fbH - 0.01, 0.004, clearLite, 0, fbBottom + (fbH - 0.01) / 2, fbZ1 - 0.002));
trays.add(box("FruitBoxRim", fbW + 0.006, 0.01, 0.008, frosted, 0, fbTop - 0.005, fbZ1 - 0.002));
trays.add(plane("PrintFruitDecal", 0.095, 0.095 * 90 / 684, printFruit, 0, fbBottom + 0.055, fbZ1 + 0.0007));
for (const sx of [-1, 1]) cab.add(box("FruitBoxRunner", 0.012, 0.008, fbD, linerDk, sx * (fbW / 2 + 0.009), fbTop - 0.004, fbZ));
// the vegetable box cover (fixed): a glass plate with a ribbed frosted front
{
  const z0 = zIn + 0.002, z1 = frontFridge, w = inW - 0.014;
  cab.add(box("VegCover", w, 0.006, z1 - 0.014 - z0, glass, 0, sCover - 0.003, (z0 + z1 - 0.014) / 2));
  cab.add(box("VegCoverFront", w, 0.02, 0.014, frosted, 0, sCover - 0.01, z1 - 0.007));
  cab.add(plane("CoverRibsDecal", w - 0.02, 0.018, coverRibs, 0, sCover - 0.01, z1 + 0.0007));
  rails("VegCoverRail", sCover - 0.006, zIn, z1 - 0.01);
}
// the Large Vegetable Box (FzBox* are the names qa_bounds reads)
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
}

// ── groceries (stock_lg.mjs, food.mjs): vegetarian South Indian food, eggs, juices, water and soft drinks ──
const stock = LGStock({ T3: `${TEX}/lg_glt3426`, TF: `${TEX}/food`, BR: `${TEX}/brands`, BRT: `${TEX}/brands/small` });
const vbFloor = vbBottom + 0.004;
// the Sliding Shelf plays the LG 343 L's top shelf, shelf 2 its second, the Fruit Box its third (the fruit)
stock.shelves(trays, {
  // stock_lg.mjs stands the food 3 mm over the height it is given: give it each top less 2.5 mm
  zIn1: zIn, inW, inD: frontFridge - zIn, s1: s1 - 0.0025, s2: s2 - 0.0025, s3: fbBottom + 0.004 - 0.0025, fz: vbFloor, fit: true,
  vz0: vbZ0 + 0.02, vk: 0.7,                        // spread so the heap settles steady (tried in steps)
  shelfB: { hw: inW / 2 - 0.03, z0: zDuct + 0.02, z1: frontFridge - 0.015 },
  drawerB: { hw: vbW / 2 - 0.014, z0: vbZ0 + 0.02, z1: vbZ1 - 0.008, y0: vbFloor },
  drawerCeil: sCover - 0.006 - 0.01 - vbFloor,   // the heap stays 1 cm under the cover
});
{ // shelf 2 doesn't slide out: its food stays with it
  const s2stock = trays.getObjectByName("Shelf2Stock");
  trays.remove(s2stock); cab.add(s2stock);
}
// shelf 3 (over the fruit box): butter, cheese and curd cups (the LG 343 L's Fresh 0 Zone set)
stock.fresh0(cab, { y: s3, z: (zDuct + frontFridge) / 2 + 0.01 });
// the freezer: ice-cream tubs and standing packs on its floor, three packs lying on the shelf behind the ice maker
stock.freezer(cab, { fit: true, zIn1: zIn, floor: fzFloor, top: fzShelfTop + 0.0005, box: { hw: inW / 2 - 0.03, z0: zDuct + 0.02, z1: icZ0 - 0.01 } });

// The fitted stock is laid out for the LG 343 L's trays (about 540 mm between the walls; this one has 488 and a
// shallower cabinet), so three trays hold less here and are laid out again in rows inside their rims:
// shelf 2 leaves out the biryani tin, the fruit box holds the bananas, grapes, a lemon, three apples and an orange
// (the curd pouch is dairy, not fruit), and the three frozen packs on the freezer shelf lie in one pile to the right
// of the ice maker
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
  const g = cab.getObjectByName("Shelf2Stock"), hw = inW / 2 - 0.03, z0 = zDuct + 0.02;
  drop(g.getObjectByName("RnrBiryani"));
  const d1 = row([g.getObjectByName("CoconutHalf"), g.getObjectByName("WatermelonHalf")], -hw, hw, z0);
  row([g.getObjectByName("NandhanaPalace"), g.getObjectByName("NandhanaPalace2")], -hw, hw, z0 + d1 + 0.03);
}
{
  const g = trays.getObjectByName("Shelf3Stock"), hw = inW / 2 - 0.03, z0 = zDuct + 0.02;
  const [a0, a1, a2, a3, a4] = kids(g, "Apple"), [o0, o1, o2] = kids(g, "Orange"), [l0, l1] = kids(g, "Lemon");
  drop(g.getObjectByName("AmulMastiDahi"), a1, a4, o1, o2, l0);
  const d1 = row([g.getObjectByName("Bananas"), g.getObjectByName("Grapes"), l1], -hw, hw, z0);
  row([a0, o0, a2, a3], -hw, hw, z0 + d1 + 0.03);
}
{
  const g = cab.getObjectByName("OnFreezerShelf");
  const pile = ["ViswasParotta2", "AmulPaneer", "FreshoGreenPeas2"].map((n) => g.getObjectByName(n));
  const x0 = icX + icW / 2 + 0.003 + 0.015, x1 = inW / 2 - 0.02, xm = (x0 + x1) / 2, zb = zDuct + 0.03;
  let top = null;
  pile.forEach((o, i) => {
    const b = bbox(o);
    o.position.x += xm + [0, 0.008, -0.006][i] - (b.min.x + b.max.x) / 2;
    o.position.z += zb + [0, 0.01, 0.004][i] - b.min.z;
    if (top != null) o.position.y += top - b.min.y;
    top = (top ?? b.min.y) + (b.max.y - b.min.y);
  });
}

// ── doors: hinged on the right, the flower print on flat fronts, dark edges ──
const pw = W - 0.002, bw = pw - 0.1;
const inside = (dep) => [-pw / 2 - bw / 2 + 0.004, -pw / 2 + bw / 2 - 0.004, -(linerFace + dep / 2)];
// the eggs: six in the top bin's hinge half, over their cups (the photo shows the eggs at the hinge end of both top bins)
const EGGS = [0, 1, 2, 3, 4, 5].map((i) => -pw / 2 + bw / 2 - 0.004 - 0.03 - i * 0.05);
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
    if (b.eggs) for (const x of EGGS) { const c = mesh("EggCup", new THREE.SphereGeometry(0.02, 12, 4, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), clear, x, b.f, zc); c.scale.y = 0.7; pivot.add(c); }
  });
}
// the freezer door: the print, the Haier wordmark (59 mm, centred, 80 mm below the top) and the CONVERTIBLE badge
// (82 x 17.6 mm, 17 mm in from the hinge edge and 7 mm above the bottom), measured on Haier's front
const freezerDoor = group("FreezerDoor", W / 2, yFreezer, zFront);
{
  const h = H - yFreezer;
  freezerDoor.add(mesh("FreezerPanel", flipV(new THREE.BoxGeometry(pw, h, doorT)), [doorEdge, doorEdge, doorEdge, doorEdge, doorFz, liner], -pw / 2, h / 2, doorT / 2));
  freezerDoor.add(plane("HaierMarkDecal", 0.059, 0.059 / 3.244, logoM, -pw / 2, h - 0.08, doorT + 0.0007));
  freezerDoor.add(plane("BadgeDecal", 0.082, 0.0176, badgeM, -0.017 - 0.041, 0.007 + 0.0088, doorT + 0.0007));
  doorInside(freezerDoor, "FreezerDoor", h);
}
// the fridge door: the print up to the silver strip, the strip, the recess handle's dark channel, and the door's top lip
const fridgeDoor = group("FridgeDoor", W / 2, frBot, zFront);
{
  const h = frTop - frBot, printH = h - lipT - recessH - stripH;
  fridgeDoor.add(mesh("FridgePanel", flipV(new THREE.BoxGeometry(pw, printH, doorT)), [doorEdge, doorEdge, doorEdge, doorEdge, doorFr, liner], -pw / 2, printH / 2, doorT / 2));
  // the strip: its face is rounded (the photo's light falls from 246 at its top to 191 at its bottom), a half-round 3.5 mm
  // proud of a body set 4 mm back, so its front is the door's front
  const sb = doorT - 0.004;
  fridgeDoor.add(mesh("FridgeStrip", new THREE.BoxGeometry(pw, stripH, sb), [doorEdge, doorEdge, doorEdge, doorEdge, strip, liner], -pw / 2, printH + stripH / 2, sb / 2));
  const round = mesh("FridgeStripFace", new THREE.CylinderGeometry(stripH / 2, stripH / 2, pw - 0.003, 24, 1, false, -Math.PI / 2, Math.PI), strip, -pw / 2, printH + stripH / 2, sb);
  round.rotation.z = Math.PI / 2; round.scale.set(1, 1, 0.0035 / (stripH / 2));
  fridgeDoor.add(round);
  const cd = doorT - recessDepth;                       // the channel: the door's back part, its front set back
  fridgeDoor.add(mesh("FridgeRecess", new THREE.BoxGeometry(pw, recessH, cd), [doorEdge, doorEdge, recessM, recessM, recessM, liner], -pw / 2, printH + stripH + recessH / 2, cd / 2));
  fridgeDoor.add(mesh("FridgeLip", new THREE.BoxGeometry(pw, lipT, doorT), [doorEdge, doorEdge, doorEdge, recessM, recessM, liner], -pw / 2, h - lipT / 2, doorT / 2));
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
// Grain (BENCHMARK.md section 10): Haier names the finish "Flower" (a printed door), so the doors and their decals carry no
// grain; the dark grey painted sides, top and back get the soft peel (ESTIMATED: Haier publishes no material)
// the cauliflower rests on the vegetable box's floor here (on the LG 343 L it lands on the drumsticks): its tilted leaves'
// boxes, taken corner by corner, reach 7.6 mm under the floor though no leaf does (qa_fit.mjs measures the meshes).
// Their tilt goes into their geometry, so a box around each one is its real extent; nothing moves or looks different.
{
  const c = trays.getObjectByName("Cauliflower");
  for (const m of c.children) if (m.isMesh && (m.rotation.x || m.rotation.z)) {
    m.updateMatrix();
    m.geometry = m.geometry.clone().applyMatrix4(m.matrix);
    m.position.set(0, 0, 0); m.rotation.set(0, 0, 0); m.scale.set(1, 1, 1);
  }
}
const used = new Set();
root.traverse((o) => o.material && [].concat(o.material).forEach((m) => used.add(m.name)));
const only = (t) => Object.fromEntries(Object.entries(t).filter(([k]) => used.has(k)));   // what was left out takes its textures with it
await exportGLB(root, clips, OUT, only({
  DoorFreezer: `${T}/door_freezer.jpg`,
  DoorFridge: `${T}/door_fridge.jpg`,
  HaierMark: `${T}/logo.png`,
  BadgeConvertible: `${T}/badge.png`,
  PrintSliding: `${T}/print_sliding.png`,
  PrintFruit: `${T}/print_fruit.png`,
  PrintNavi: `${T}/print_navi.png`,
  CoverRibs: `${T}/cover_ribs.png`,
  ...stock.textures(),
}), { dir: `${TEX}/grain`, materials: {
  SidePaint: { type: "peel_soft" }, TopPaint: { type: "peel_soft" }, BackPaint: { type: "peel_soft" },
} });
