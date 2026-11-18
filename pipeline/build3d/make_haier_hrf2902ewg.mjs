// Haier HRF-2902EWG-P, 240 L frost-free double door, Wave Glass (black glass doors with Haier's print), "Cool Pad".
// Built to Haier's published size, 548 W x 1560 H x 615 D mm (Haier India's page for this code; Sangeetha's listing
// 21522 gives the same), and to Haier's own gallery of this code: the straight-on front (the print, the mark, the doors'
// split, the feet and the bottom hinge), both 3/4 views (the doors' depth, the recess handles: a groove down the free
// side of each door, the glass's thin lit edge), the open doors empty and stocked (every part inside), and the freezer
// close-up (the COOL PACK plate, the ice maker). Freezer on top, fridge below, both hinged on the right.
// Haier publishes no manual, rear photo, door swing or clearance for this code: the back is plain (no cord, plug or
// compressor bay is shown anywhere), and every inside height, the doors' depth and their 140 degrees are ESTIMATED off
// those photos (private notes).
// Inside, as Haier's and Sangeetha's photos of this code show and name them: in the freezer the COOL PACK plate as its
// shelf ("Cool Pad"), the Ice Maker (a clear box on the floor at the front left), the back's vent grilles and the
// control under them; in the fridge the LED light, the back panel with its vents, the temperature knob and the NAVI
// badge, three toughened-glass shelves, the vegetable box's cover and the FRESHBOX (Large Vegetable Box); two bins on the
// freezer door; on the fridge door two egg bins and the BOTTLEGUARD Big Bottle Rack, with three moulded squares under it.
// The three shelves and the vegetable box slide out together (FridgeTrays); the ice maker is a part of its own.
// usage: node make_haier_hrf2902ewg.mjs <entry .json, never products.json> <tex dir> <out.glb>
import { LGStock } from "./stock_lg.mjs";
import { THREE, mat, mesh, box, faced, group, flipV, stateClips, exportGLB, productParts, saveZones } from "./lib.mjs";

const [PRODUCTS, TEX, OUT] = process.argv.slice(2);
const ID = "haier-hrf-2902ewg-p";
const T = `${TEX}/haier_hrf2902ewg`;

// ── size (metres): Haier's 548 x 1560 x 615 mm ──
const W = 0.548, H = 1.56, D = 0.615;
// the doors: 75 mm deep with a 10 mm gasket gap behind them (the door's side band is 0.14-0.16 of the depth on Haier's
// two 3/4 views: ESTIMATED)
const doorT = 0.075, gap = 0.01, glassT = 0.004, Dc = D - doorT - gap;
const zBack = -D / 2, zFront = zBack + Dc, zDoor = zFront + gap;
const wall = 0.03, backT = 0.04;                     // side walls and the back's insulation (ESTIMATED)
// heights on Haier's front (0.685 px per mm up; the floor row 1139, the door top row 70)
const cabTop = H - 0.015;                            // the doors stand about 15 mm above the cabinet's top (3/4 views)
const yFreezer = 1.073;                              // freezer door, 1073-1560 mm (its glass's lit bottom edge row 402)
const frBot = 0.041, frTop = 1.061;                  // fridge door, 41-1061 mm
const base = 0.041;                                  // the cabinet's underside, at the doors' bottom edge
// inside heights, ESTIMATED off Haier's empty open photo (g05: 0.6045 px per mm on the cabinet's front, the floor row 1101)
const floorTop = 0.095;                              // fridge floor
const fzCeil = 1.044, fzFloor = 1.11;                // the mullion: fridge ceiling, freezer floor
const fzTop = 1.512;                                 // freezer ceiling
const cpTop = 1.305, cpT = 0.02;                     // the COOL PACK plate's top and thickness
const s1 = 0.855, s2 = 0.701, s3 = 0.473;            // the three glass shelves' tops
const sCover = 0.329;                                // the vegetable box cover's top
const vbBottom = floorTop + 0.006, vbTop = sCover - 0.017;
// door bins (ESTIMATED, g05 measured at each door's hinge edge): floor above the door's bottom edge, end-wall height, depth
const BINS = {
  FridgeDoor: [{ f: 0.309, h: 0.13, d: 0.1, print: true }, { f: 0.726, h: 0.07, d: 0.09 }, { f: 0.863, h: 0.08, d: 0.09 }],
  FreezerDoor: [{ f: 0.046, h: 0.08, d: 0.075 }, { f: 0.255, h: 0.08, d: 0.075 }],
};
const linerFace = 0.016;
const reach = (name) => Math.max(...BINS[name].map((b) => b.d)) + linerFace;
const frontFridge = zDoor - reach("FridgeDoor") - 0.01;   // shelves, the vegetable box and its cover end here
const frontFreezer = zDoor - reach("FreezerDoor") - 0.01;

// the glass doors' finish, tuned on renders at the page's -28 deg view against Haier's 3/4 photo (g03: the plain black of
// the lower door reads 9): a clear coat laid a grey veil over the black (coat 0.5/0.06: 120; 0.15/0.2: 48; 0.1/0.1: 54);
// metal 0.3, rough 0.4 and no coat reads 35, the darkest that keeps the gloss streaks of the studio's strip lights
const GLASS = { metal: 0.3, rough: 0.4 };

// ── materials ──
const sidePaint = mat("SidePaint", 0x26272a, { metal: 0.3, rough: 0.5 });     // black painted steel (3/4 views read 28-30)
const topPaint = mat("TopPaint", 0x26272a, { metal: 0.15, rough: 0.7 });
const backPaint = mat("BackPaint", 0x202124, { metal: 0.1, rough: 0.75 });
const doorFz = mat("DoorFreezer", 0xffffff, GLASS);     // the print under the glass: no grain
const doorFr = mat("DoorFridge", 0xffffff, GLASS);
const doorEdge = mat("DoorEdge", 0x2c2d31, { metal: 0.3, rough: 0.45 });      // the doors' sides (3/4 views read 42-46)
const glassEdge = mat("GlassEdge", 0xc5cacd, { metal: 0.8, rough: 0.3 });     // the glass's thin lit edge
const groove = mat("Recess", 0x08090b, { rough: 0.7 });                        // the recess handles' grooves
const frame = mat("FrontFrame", 0x1a1b1e, { rough: 0.6 });
const logoM = mat("HaierMark", 0xffffff, { rough: 0.35, opacity: 0.999 });
const liner = mat("Liner", 0xf1f3f5, { rough: 0.6 });
const linerDk = mat("LinerGrey", 0xdde1e5, { rough: 0.62 });
const gasket = mat("Gasket", 0x8d9196, { rough: 0.85 });
const baseDark = mat("BaseDark", 0x1b1c1f, { rough: 0.8 });
const glass = mat("TemperedGlass", 0xa9cdd6, { rough: 0.05, opacity: 0.55, side: THREE.DoubleSide });
const glassRim = mat("ShelfRim", 0xb4b8bd, { metal: 0.6, rough: 0.35 });    // the shelves' grey front trims (g07)
const clear = mat("ClearPlastic", 0xc3d0da, { rough: 0.12, opacity: 0.5, side: THREE.DoubleSide });
const clearLite = mat("ClearPlasticLight", 0xdfe7ee, { rough: 0.12, opacity: 0.26, side: THREE.DoubleSide });
const frosted = mat("Frosted", 0xe6edf1, { rough: 0.45, opacity: 0.78 });
const white = mat("WhitePlastic", 0xf6f7f8, { rough: 0.45 });
const coolPack = mat("CoolPack", 0xffffff, { rough: 0.5 });
const vent = mat("Vent", 0x6b7077, { rough: 0.7 });
const lightM = mat("Led", 0xffffff, { emissive: 0xf4f8ff, emissiveIntensity: 1.5 });
const ice = mat("IceCube", 0xe3f4ff, { rough: 0.08, opacity: 0.72 });
const footM = mat("Foot", 0x131416, { rough: 0.7 });
const hingeM = mat("Hinge", 0xc9ccd0, { metal: 0.9, rough: 0.3 });
const printNavi = mat("PrintNavi", 0xffffff, { rough: 0.5, opacity: 0.999 });
const printDial = mat("PrintDial", 0xffffff, { rough: 0.5, opacity: 0.999 });
const printFresh = mat("PrintFresh", 0xffffff, { rough: 0.5, opacity: 0.999 });
const printBottle = mat("PrintBottle", 0xffffff, { rough: 0.5, opacity: 0.999 });
const printGlass = mat("PrintGlass", 0xffffff, { rough: 0.5, opacity: 0.999 });

const root = group("HaierHRF2902EWG");
const cab = group("Cabinet");
root.add(cab);
const plane = (name, w, h, m, x, y, z) => mesh(name, flipV(new THREE.PlaneGeometry(w, h)), m, x, y, z);
const cyl = (name, rt, rb, h, m, x, y, z, seg = 16) => mesh(name, new THREE.CylinderGeometry(rt, rb, h, seg), m, x, y, z);

// ── cabinet: black painted steel outside, white inside; the frame round the openings black, the mullion's face white ──
const shellH = cabTop - base, shellMid = base + shellH / 2, zMid = zBack + Dc / 2;
cab.add(faced("SideLeft", wall, shellH, Dc, [liner, sidePaint, topPaint, baseDark, frame, backPaint], -W / 2 + wall / 2, shellMid, zMid));
cab.add(faced("SideRight", wall, shellH, Dc, [sidePaint, liner, topPaint, baseDark, frame, backPaint], W / 2 - wall / 2, shellMid, zMid));
cab.add(faced("Top", W - 2 * wall, cabTop - fzTop, Dc, [liner, liner, topPaint, liner, frame, backPaint], 0, (cabTop + fzTop) / 2, zMid));
cab.add(faced("Base", W - 2 * wall, floorTop - base, Dc, [liner, liner, liner, baseDark, liner, backPaint], 0, base + (floorTop - base) / 2, zMid));
cab.add(faced("BackWall", W - 2 * wall, fzTop - floorTop, backT, [liner, liner, liner, liner, liner, backPaint], 0, (fzTop + floorTop) / 2, zBack + backT / 2));
cab.add(faced("Divider", W - 2 * wall, fzFloor - fzCeil, Dc - backT, [liner, liner, liner, liner, liner, liner], 0, (fzCeil + fzFloor) / 2, zMid + backT / 2));
// the back: plain, in the body's paint. Haier publishes no rear photo or manual for this code (private notes)
// feet: a black foot 44 mm in from the left edge, and one under the silver bottom hinge bracket at the right (front and
// 3/4 views); the two at the back are ESTIMATED (not shown)
cab.add(cyl("FootFrontL", 0.016, 0.0175, base, footM, -W / 2 + 0.044, base / 2, zFront - 0.06));
cab.add(cyl("FootFrontR", 0.018, 0.02, base - 0.008, footM, W / 2 - 0.03, (base - 0.008) / 2, zFront - 0.015));
for (const sx of [-1, 1]) cab.add(cyl("FootRear", 0.016, 0.0175, base, footM, sx * (W / 2 - 0.044), base / 2, zBack + 0.06));
// hinges on the right: the bottom bracket over the right foot, the middle hinge's plate in the doors' gap (g05: a silver
// plate with two screws), and the top cover on the cabinet's top behind the freezer door
cab.add(box("HingeBottom", 0.032, 0.008, 0.075, hingeM, W / 2 - 0.03, base - 0.004, zFront + 0.035));
cab.add(box("HingeMid", 0.03, yFreezer - frTop - 0.002, gap + doorT * 0.5, hingeM, W / 2 - 0.022, (yFreezer + frTop) / 2, zFront + (gap + doorT * 0.5) / 2));
cab.add(box("HingeCoverTop", 0.07, H - cabTop - 0.001, 0.05, topPaint, W / 2 - 0.04, cabTop + (H - cabTop - 0.001) / 2, zFront - 0.026));

// ── inside ──
const inW = W - 2 * wall;
const zIn = zBack + backT;                            // the back wall's inner face
const zDuct = zIn + 0.012;                            // the front of the raised back-wall panels
const rails = (name, yTop, z0, z1) => { for (const sx of [-1, 1]) cab.add(box(name, 0.01, 0.012, z1 - z0, linerDk, sx * (inW / 2 - 0.005), yTop - 0.012, (z0 + z1) / 2)); };
// a vent grille: a row of small six-sided openings, as on g05/g07 (four per grille high up, three lower down)
const hexGeo = new THREE.CylinderGeometry(0.0085, 0.0085, 0.002, 6).rotateX(Math.PI / 2).rotateZ(Math.PI / 6);
function grille(name, n, x, y, z) { for (let i = 0; i < n; i++) cab.add(mesh(name, hexGeo, vent, x + (i - (n - 1) / 2) * 0.019, y, z)); }

// the freezer: a raised duct panel behind the plate's top with two four-opening grilles, two more grilles over it on the
// back wall, two three-opening grilles below the plate, the control at the lower right (a round boss with a small dark
// key strip: its print can't be read), the COOL PACK plate as its shelf, the Ice Maker on the floor at the front left
cab.add(box("FreezerDuct", inW - 0.06, 0.105, 0.012, liner, 0, cpTop + 0.0525, zIn + 0.006));
grille("FreezerVentHigh", 4, -0.1, 1.383, zDuct + 0.001);
grille("FreezerVentHigh", 4, 0.085, 1.383, zDuct + 0.001);
grille("FreezerVentTop", 4, -0.1, 1.444, zIn + 0.001);
grille("FreezerVentTop", 4, 0.085, 1.444, zIn + 0.001);
grille("FreezerVentLow", 3, -0.08, 1.239, zIn + 0.001);
grille("FreezerVentLow", 3, 0.06, 1.239, zIn + 0.001);
grille("FreezerVentFloor", 4, 0.0, fzFloor + 0.012, zIn + 0.001);
{
  const c = cyl("FreezerControlBoss", 0.024, 0.024, 0.006, white, 0.115, 1.19, zIn + 0.003, 24); c.rotation.x = Math.PI / 2; cab.add(c);
  cab.add(box("FreezerControlKeys", 0.036, 0.006, 0.003, vent, 0.115, 1.184, zIn + 0.0065));
  for (const dx of [-0.013, 0, 0.013]) cab.add(box("FreezerControlKey", 0.009, 0.004, 0.003, vent, 0.115 + dx, 1.174, zIn + 0.0065));
}
// the COOL PACK plate: white plastic, 20 mm thick, its moulded top (coolpack.jpg) seen through the open door
{
  const z0 = zDuct + 0.002, z1 = frontFreezer, w = inW - 0.012;
  cab.add(faced("CoolPackPlate", w, cpT, z1 - z0, [white, white, coolPack, white, white, white], 0, cpTop - cpT / 2, (z0 + z1) / 2));
  rails("CoolPackRail", cpTop - cpT, zIn, z1 - 0.01);
}
// the Ice Maker: a clear box with a white lid and the ice in it, on the freezer floor at the front left; it slides out.
// Its size (120 x 150 x 55 mm) ESTIMATED off g05 and g07
const icW = 0.12, icD = 0.15, icH = 0.055, icX = -inW / 2 + 0.012 + icW / 2, icZ1 = frontFreezer - 0.015, icZ0 = icZ1 - icD;
const iceM = group("IceMaker", icX, fzFloor, 0);
{
  const bh = icH - 0.01, bz = icZ1 - icD / 2;
  iceM.add(box("IceBinFloor", icW, 0.004, icD, clear, 0, 0.002, bz));
  for (const sx of [-1, 1]) iceM.add(box("IceBinSide", 0.004, bh, icD, clear, sx * (icW / 2 - 0.002), bh / 2, bz));
  iceM.add(box("IceBinBack", icW - 0.008, bh, 0.004, clear, 0, bh / 2, icZ0 + 0.002));
  iceM.add(box("IceBinFront", icW - 0.008, bh, 0.004, clear, 0, bh / 2, icZ1 - 0.002));
  iceM.add(box("IceLid", icW + 0.004, 0.01, icD + 0.004, white, 0, bh + 0.005, bz));
  const cube = new THREE.BoxGeometry(0.024, 0.02, 0.024);
  for (let i = 0; i < 12; i++) {
    const c = mesh("IceCube", cube, ice, -0.03 + (i % 3) * 0.03, 0.016 + Math.floor(i / 6) * 0.018, icZ1 - 0.03 - (Math.floor(i / 3) % 2) * 0.05 - Math.floor(i / 6) * 0.03);
    c.rotation.set(0.2 * (i % 3), 0.5 * i, 0.15 * (i % 4));
    iceM.add(c);
  }
}
cab.add(iceM);

// the fridge: the LED light across the ceiling's front, the back panel (two vent slots at its top, five small holes, the
// temperature knob with its print, the NAVI badge)
cab.add(box("FridgeLed", 0.15, 0.006, 0.02, lightM, -0.01, fzCeil - 0.003, frontFridge - 0.06));
const pX = -0.012, pW = 0.2, pY0 = 0.506, pY1 = 0.994;
cab.add(box("FridgePanel", pW, pY1 - pY0, 0.012, liner, pX, (pY0 + pY1) / 2, zIn + 0.006));
for (const dx of [-0.024, 0.024]) cab.add(box("FridgeVent", 0.038, 0.007, 0.002, vent, pX + dx, 0.982, zDuct + 0.001));
for (let i = 0; i < 5; i++) cab.add(box("FridgePanelHole", 0.005, 0.0025, 0.002, vent, pX, 0.848 - i * 0.007, zDuct + 0.001));
{
  const kx = pX - 0.002, ky = 0.771;
  const k = cyl("TempKnob", 0.018, 0.018, 0.012, white, kx, ky, zDuct + 0.006, 32); k.rotation.x = Math.PI / 2; cab.add(k);
  cab.add(box("TempKnobGrip", 0.004, 0.026, 0.004, linerDk, kx, ky, zDuct + 0.014));
  cab.add(plane("PrintDialDecal", 0.08, 0.062, printDial, kx, ky - 0.001, zDuct + 0.0007));
}
cab.add(plane("PrintNaviDecal", 0.05, 0.05, printNavi, pX + 0.002, 0.634, zDuct + 0.0007));

// what slides out (FridgeTrays): the three glass shelves and the FRESHBOX, with their food
const trays = group("FridgeTrays");
cab.add(trays);
const PG = { w: 0.113, h: 0.113 * 41 / 814 };
function glassShelf(parent, name, yTop) {
  const z0 = zDuct + 0.002, z1 = frontFridge, w = inW - 0.014;
  parent.add(box(name, w, 0.006, z1 - 0.012 - z0, glass, 0, yTop - 0.003, (z0 + z1 - 0.012) / 2));
  parent.add(box(name + "Rim", w, 0.016, 0.012, glassRim, 0, yTop - 0.006, z1 - 0.006));
  const p = plane("PrintGlassDecal", PG.w, PG.h, printGlass, 0, yTop + 0.0008, z1 - 0.03);
  p.rotation.x = -Math.PI / 2;
  parent.add(p);
  rails(name + "Rail", yTop - 0.006, zIn, z1 - 0.01);
}
glassShelf(trays, "Shelf1", s1);
glassShelf(trays, "Shelf2", s2);
glassShelf(trays, "Shelf3", s3);
// the vegetable box cover (fixed): a glass plate with a frosted front rim
{
  const z0 = zIn + 0.002, z1 = frontFridge, w = inW - 0.014;
  cab.add(box("VegCover", w, 0.006, z1 - 0.014 - z0, glass, 0, sCover - 0.003, (z0 + z1 - 0.014) / 2));
  cab.add(box("VegCoverFront", w, 0.016, 0.014, frosted, 0, sCover - 0.008, z1 - 0.007));
  rails("VegCoverRail", sCover - 0.006, zIn, z1 - 0.01);
}
// the FRESHBOX (Large Vegetable Box; FzBox* are the names qa_bounds reads), FRESHBOX on its front left of the middle
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
  trays.add(plane("PrintFreshDecal", 0.092, 0.092 * 94 / 662, printFresh, -0.025, 0.164, vbZ1 + 0.0007));
}

// ── groceries (stock_lg.mjs, food.mjs): vegetarian South Indian food, eggs, juices, water and soft drinks ──
const VK = +(process.env.VK || 0.72), VZ = +(process.env.VZ || 0.006);   // the vegetable heap's spread, tried in steps so every item settles steady
const stock = LGStock({ T3: `${TEX}/lg_glt3426`, TF: `${TEX}/food`, BR: `${TEX}/brands`, BRT: `${TEX}/brands/small` });
const vbFloor = vbBottom + 0.004;
stock.shelves(trays, {
  // stock_lg.mjs stands the food 3 mm over the height it is given: give it each top less 2.5 mm
  zIn1: zIn, inW, inD: frontFridge - zIn, s1: s1 - 0.0025, s2: s2 - 0.0025, s3: s3 - 0.0025, fz: vbFloor, fit: true,
  vz0: vbZ0 + VZ, vk: VK,
  shelfB: { hw: inW / 2 - 0.03, z0: zDuct + 0.02, z1: frontFridge - 0.015 },
  drawerB: { hw: vbW / 2 - 0.014, z0: vbZ0 + 0.006, z1: vbZ1 - 0.007, y0: vbFloor },   // the drumsticks are 341 mm long
  drawerCeil: sCover - 0.006 - 0.01 - vbFloor,
});
// the freezer: ice-cream tubs and packs on its floor behind the ice maker, packs lying on the COOL PACK plate
stock.freezer(cab, { fit: true, zIn1: zIn, floor: fzFloor, top: cpTop + 0.0005, box: { hw: inW / 2 - 0.03, z0: zDuct + 0.02, z1: icZ0 - 0.01 } });

// The fitted stock is laid out for the LG 343 L's trays (about 540 mm between the walls and deeper shelves; this one has
// 488 mm and 327 mm of shelf), so three trays hold less here, as on the HRF-2902ICMC-P: the top shelf leaves out the milk
// sachets, the second the biryani tin; the third shelf holds the bananas, grapes, a lemon, three apples and an orange in two rows (the curd pouch,
// two apples, two oranges and a lemon left out); under the COOL PACK plate (175 mm) the second ice-cream tub and the
// standing peas pack don't fit and are left out
const kids = (g, name) => g.children.filter((o) => o.name === name);
const drop = (...os) => os.forEach((o) => o && o.parent && o.parent.remove(o));
{
  const g = trays.getObjectByName("Shelf1Stock");
  drop(...["NandiniMilk", "AavinMilk", "AmulTaazaPouch"].map((n) => g.getObjectByName(n)));
}
{
  root.updateMatrixWorld(true);
  const g = trays.getObjectByName("Shelf2Stock"), hw = inW / 2 - 0.03, z0 = zDuct + 0.02;
  drop(g.getObjectByName("RnrBiryani"));
  const d1 = rowBack([g.getObjectByName("CoconutHalf"), g.getObjectByName("WatermelonHalf")], -hw, hw, z0);
  console.log(`shelf 2: the first row is ${(d1 * 1000).toFixed(0)} mm deep`);
  rowBack([g.getObjectByName("NandhanaPalace"), g.getObjectByName("NandhanaPalace2")], -hw, hw, z0 + d1 + 0.012);
}
{
  const g = trays.getObjectByName("Shelf3Stock"), hw = inW / 2 - 0.03, z0 = zDuct + 0.02;
  const [a0, a1, a2, a3, a4] = kids(g, "Apple"), [o0, o1, o2] = kids(g, "Orange"), [l0, l1] = kids(g, "Lemon");
  drop(g.getObjectByName("AmulMastiDahi"), a1, a4, o1, o2, l0);
  const d1 = rowBack([g.getObjectByName("Bananas"), g.getObjectByName("Grapes"), l1], -hw, hw, z0);
  rowBack([a0, o0, a2, a3], -hw, hw, z0 + d1 + 0.03);
}
{
  const g = cab.getObjectByName("FreezerStock");
  drop(g.getObjectByName("AmulRajbhog"), g.getObjectByName("FreshoGreenPeas"));
}
function rowBack(items, x0, x1, z0) {        // spread evenly between x0 and x1, backs at z0; returns the row's depth
  const bs = items.map((o) => new THREE.Box3().setFromObject(o)), w = bs.reduce((s, b) => s + b.max.x - b.min.x, 0), g = (x1 - x0 - w) / (items.length + 1);
  if (g < 0.006) console.warn(`row: ${items.map((o) => o.name)} leave ${(g * 1000).toFixed(0)} mm between them`);
  let x = x0 + g, dep = 0;
  items.forEach((o, i) => { const b = bs[i]; o.position.x += x - b.min.x; o.position.z += z0 - b.min.z; x += b.max.x - b.min.x + g; dep = Math.max(dep, b.max.z - b.min.z); });
  return dep;
}

// ── doors: hinged on the right; a black glass front with the print, a thin lit edge, dark painted sides, and the recess
// handle as a groove down each door's free side ──
const pw = W - 0.002, bw = pw - 0.1;
const inside = (dep) => [-pw / 2 - bw / 2 + 0.004, -pw / 2 + bw / 2 - 0.004, -(linerFace + dep / 2)];
// the eggs: three at the hinge end of each of the two upper bins (g06)
const EGGS = [0, 1, 2].map((i) => -pw / 2 + bw / 2 - 0.004 - 0.028 - i * 0.048);
function doorInside(pivot, name, h) {
  pivot.add(box(name + "GasketT", pw - 0.02, 0.014, gap, gasket, -pw / 2, h - 0.012, -gap / 2));
  pivot.add(box(name + "GasketB", pw - 0.02, 0.014, gap, gasket, -pw / 2, 0.012, -gap / 2));
  pivot.add(box(name + "GasketL", 0.014, h - 0.02, gap, gasket, -pw + 0.012, h / 2, -gap / 2));
  pivot.add(box(name + "GasketR", 0.014, h - 0.02, gap, gasket, -0.012, h / 2, -gap / 2));
  pivot.add(box(name + "Liner", pw - 0.05, h - 0.05, 0.006, liner, -pw / 2, h / 2, -linerFace + 0.003));
  BINS[name].forEach((b, i) => {
    const zc = -linerFace - b.d / 2, zl = -linerFace - b.d;
    pivot.add(box(`${name}Bin${i}Floor`, bw, 0.004, b.d, clear, -pw / 2, b.f + 0.002, zc));
    pivot.add(box(`${name}Bin${i}Lip`, bw, b.h * 0.8, 0.004, clear, -pw / 2, b.f + b.h * 0.4, zl + 0.002));
    pivot.add(box(`${name}Bin${i}Rim`, bw, 0.007, 0.005, frosted, -pw / 2, b.f + b.h * 0.8 - 0.0035, zl + 0.0025));
    for (const sx of [-1, 1]) pivot.add(box(`${name}Bin${i}End`, 0.004, b.h, b.d, clear, -pw / 2 + sx * (bw / 2 - 0.002), b.f + b.h / 2, zc));
    if (b.print) {   // BOTTLEGUARD on the rack's front, its middle 0.42 of the rack from the hinge end (g05)
      const p = plane("PrintBottleDecal", 0.135, 0.135 * 98 / 972, printBottle, -pw / 2 + bw / 2 - 0.42 * bw, b.f + 0.05, zl - 0.0007);
      p.rotation.y = Math.PI;
      pivot.add(p);
    }
  });
}
function doorFront(pivot, name, h, print) {
  // the body (dark painted sides), the glass on its front (its edges lit silver), the glass's face with the print
  const bt = doorT - glassT;
  pivot.add(mesh(name + "Body", new THREE.BoxGeometry(pw, h, bt), [doorEdge, doorEdge, doorEdge, doorEdge, doorEdge, doorEdge], -pw / 2, h / 2, bt / 2));   // its back dark round the liner (g05)
  pivot.add(mesh(name + "Glass", flipV(new THREE.BoxGeometry(pw, h, glassT)), [glassEdge, glassEdge, glassEdge, glassEdge, print, glassEdge], -pw / 2, h / 2, bt + glassT / 2));
}
function handleGroove(pivot, name, yTop, yBot) {
  // the recess handle: a dark groove 20 mm wide down the door's free (left) side, in the middle of its depth
  const g = box(name, 0.0012, yTop - yBot, 0.02, groove, -pw - 0.0002, (yTop + yBot) / 2, (doorT - glassT) / 2);
  pivot.add(g);
}
// the freezer door: the Haier mark 59 mm wide, centred, 80 mm below the top (Haier's front: x 581-621, rows 119-131);
// its handle groove 143-389 mm below its top (g03)
const freezerDoor = group("FreezerDoor", W / 2, yFreezer, zDoor);
{
  const h = H - yFreezer;
  doorFront(freezerDoor, "Freezer", h, doorFz);
  freezerDoor.add(plane("HaierMarkDecal", 0.059, 0.059 / 3.2443, logoM, -pw / 2, h - 0.08, doorT + 0.0007));
  handleGroove(freezerDoor, "FreezerHandleGroove", h - 0.143, h - 0.389);
  doorInside(freezerDoor, "FreezerDoor", h);
}
// the fridge door: its handle groove 93-524 mm below its top (g03); three moulded squares on its liner under the bottle
// rack, 134-240 mm above its foot (g05; the vegetable, fruit and carrot drawings in them are too soft to redraw: left out)
const fridgeDoor = group("FridgeDoor", W / 2, frBot, zDoor);
{
  const h = frTop - frBot;
  doorFront(fridgeDoor, "Fridge", h, doorFr);
  handleGroove(fridgeDoor, "FridgeHandleGroove", h - 0.093, h - 0.524);
  doorInside(fridgeDoor, "FridgeDoor", h);
  for (const dx of [-0.125, 0, 0.125]) fridgeDoor.add(box("DoorLinerSquare", 0.1, 0.106, 0.003, liner, -pw / 2 + dx, 0.187, -linerFace - 0.0015));
}
// what sits in the door bins, so it swings out with the door
{
  const F = BINS.FridgeDoor, Z = BINS.FreezerDoor;
  stock.doorFridge(fridgeDoor, { fit: true, eggY: F[2].f, eggX: EGGS, eggDY: 0, eggTurn: Math.PI / 2, jarY: F[1].f, botY: F[0].f, canY: null, deps: { egg: F[2].d, jar: F[1].d, bottle: F[0].d }, inside });
  stock.doorFreezer(freezerDoor, { fit: true, b1: Z[1].f, b2: Z[0].f, dep: Math.min(Z[0].d, Z[1].d), inside });
}
root.add(freezerDoor, fridgeDoor);

// the eggs' cups, and the second bin's three eggs (g06: three eggs at the hinge end of each upper bin): copies of the
// top bin's eggs; the jars in that bin are lined up again in the rest of it
root.updateMatrixWorld(true);
const bbox = (o) => new THREE.Box3().setFromObject(o);
function row(items, x0, x1, z0) {
  const bs = items.map(bbox), w = bs.reduce((s, b) => s + b.max.x - b.min.x, 0), g = (x1 - x0 - w) / (items.length + 1);
  if (g < 0.004) console.warn(`row: ${items.map((o) => o.name)} leave ${(g * 1000).toFixed(0)} mm between them`);
  let x = x0 + g;
  items.forEach((o, i) => { const b = bs[i]; o.position.x += x - b.min.x; o.position.z += z0 - (b.min.z + b.max.z) / 2; x += b.max.x - b.min.x + g; });
}
{
  const F = BINS.FridgeDoor;
  const eggs = fridgeDoor.children.filter((o) => o.name === "Egg");
  for (const e of eggs) {
    const c = e.clone(); c.position.y += F[1].f - F[2].f; fridgeDoor.add(c);
  }
  const cupGeo = new THREE.SphereGeometry(0.02, 12, 4, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2);
  for (const b of [F[1], F[2]]) for (const x of EGGS) { const c = mesh("EggCup", cupGeo, clear, x, b.f, -linerFace - b.d / 2); c.scale.y = 0.7; fridgeDoor.add(c); }
  // the jar bin's own row: from its free end to the eggs (local x; the door is shut, so local x = world x - W/2)
  fridgeDoor.updateMatrixWorld(true);
  const inv = new THREE.Matrix4().copy(fridgeDoor.matrixWorld).invert();
  const jarRow = fridgeDoor.children.filter((o) => (o.isGroup || o.isMesh) && o.name !== "Egg" && !/Bin|Gasket|Liner|Body|Glass|Groove|Decal|Square|EggCup/.test(o.name)
    && Math.abs(bbox(o).applyMatrix4(inv).min.y - F[1].f) < 0.02);
  const x0 = -pw / 2 - bw / 2 + 0.006, x1 = Math.min(...EGGS) - 0.03;
  // what doesn't fit beside the eggs is left out, last first
  const keep = [];
  let wsum = 0;
  for (const o of jarRow) { const b = bbox(o); const w = b.max.x - b.min.x; if (wsum + w + 0.006 * (keep.length + 2) <= x1 - x0) { keep.push(o); wsum += w; } else o.removeFromParent(); }
  const dropped = jarRow.filter((o) => !keep.includes(o)).map((o) => o.name);
  if (dropped.length) console.log(`left out of the jar bin (no room beside the eggs): ${dropped.join(", ")}`);
  // row() works in world coordinates: shift the local range by the door's x
  row(keep, x0 + W / 2, x1 + W / 2, zDoor - linerFace - F[1].d / 2);
}

const parts = productParts(PRODUCTS, ID);
const clips = stateClips(root, parts);
saveZones(PRODUCTS, ID, root, parts);
// the cauliflower's tilted leaves: their tilt goes into their geometry, so a box round each is its real extent (as on
// the HRF-2902ICMC-P; nothing moves or looks different)
{
  const c = trays.getObjectByName("Cauliflower");
  if (c) for (const m of c.children) if (m.isMesh && (m.rotation.x || m.rotation.z)) {
    m.updateMatrix();
    m.geometry = m.geometry.clone().applyMatrix4(m.matrix);
    m.position.set(0, 0, 0); m.rotation.set(0, 0, 0); m.scale.set(1, 1, 1);
  }
}
const used = new Set();
root.traverse((o) => o.material && [].concat(o.material).forEach((m) => used.add(m.name)));
const only = (t) => Object.fromEntries(Object.entries(t).filter(([k]) => used.has(k)));
// Grain (BENCHMARK 10): the glass and its print, the decals and the plastics none; the painted sides, top and back and
// the doors' painted sides the soft peel (ESTIMATED: Haier publishes no material)
await exportGLB(root, clips, OUT, only({
  DoorFreezer: `${T}/door_freezer.jpg`,
  DoorFridge: `${T}/door_fridge.jpg`,
  HaierMark: `${T}/logo.png`,
  CoolPack: `${T}/coolpack.jpg`,
  PrintNavi: `${T}/print_navi.png`,
  PrintDial: `${T}/print_dial.png`,
  PrintFresh: `${T}/print_fresh.png`,
  PrintBottle: `${T}/print_bottle.png`,
  PrintGlass: `${T}/print_glass.png`,
  ...stock.textures(),
}), { dir: `${TEX}/grain`, materials: {
  SidePaint: { type: "peel_soft" }, TopPaint: { type: "peel_soft" }, BackPaint: { type: "peel_soft" }, DoorEdge: { type: "peel_soft" },
} });
