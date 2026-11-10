// Whirlpool 22343: Intellifresh Pro 235 L 2 star convertible frost-free double door, Illusia Steel (energy label model
// NDT23533IAQMC2PE). Built to Whirlpool India's published size, 564 W x 1587 H x 655 D mm, and to Whirlpool's own
// photos of this code: the straight front (the doors, the touch panel, the fridge door's top cap, the feet), the three
// 3/4 views (the side pocket handles, the hinges, the dark grey sides) and the panel close-up. Whirlpool's renders draw
// the body taller than the published size (H:W 3.0 against 2.81), so heights are read off them as a fraction of the
// body's height and laid on the published 1587 mm; parts that are the same on every body (the panel, the feet) keep
// their true size, read across at 0.863 px per mm (NOTES.md).
// Freezer on top, fridge below, both hinged on the right. Inside, from Whirlpool's open photo of the same model in
// Sapphire Luxuria (same energy label, same product page): in the freezer the ARCTIC FRESH ice bank on the shelf, the
// shelf, the back duct with its vents and the CONVERTIBLE FREEZER print; in the fridge the light housing and air tower,
// the EVERYDAY FRESH shelf, two more glass shelves, the crisper cover and the FRUITS & VEGETABLES crisper; on the
// freezer door two FROZEN FOOD bins, on the fridge door two EASY RACKs, the BIG BOTTLE RACK and the BOTTLE RACK.
// Whirlpool publishes no manual, rear photo or door swing for this model: the back is plain (no cord, plug or compressor
// bay is shown anywhere), and every inside height and the doors' 120 degrees are ESTIMATED (NOTES.md).
// The EVERYDAY FRESH shelf and the crisper come out with their food (FridgeTrays). Stocked for a south Indian kitchen
// (stock_lg.mjs, fit: true).
// usage: node make_whirlpool_22343.mjs <entry .json, never products.json> <tex dir> <out.glb>
import { LGStock } from "./stock_lg.mjs";
import { THREE, mat, mesh, box, faced, group, flipV, stateClips, exportGLB, productParts, saveZones } from "./lib.mjs";

const [PRODUCTS, TEX, OUT] = process.argv.slice(2);
const ID = "whirlpool-22343";
const T = `${TEX}/whirlpool_22343`;

// ── size (metres): Whirlpool's 564 x 1587 x 655 mm ──
const W = 0.564, H = 1.587, D = 0.655;
const doorT = 0.05, Dc = D - doorT;                  // door thickness ESTIMATED (3/4 views)
const zBack = -D / 2, zFront = zBack + Dc;
const wall = 0.042, backT = 0.045;                   // side walls (open photo: 470-480 mm between them) and the back (ESTIMATED)
// heights on Whirlpool's front (floor row 1498, top row 22: 1.0752 mm per px on the published height)
const cabTop = H - 0.012;                            // the top hinge cover stands on the cabinet behind the freezer door (ESTIMATED)
const yFreezer = 1.1327;                             // freezer door, 1132.7-1587 mm
const frBot = 0.031, frTop = 1.12;                   // fridge door, 31-1120 mm
const capH = 0.02, seamH = 0.002;                    // its top cap (1100-1120) and the dark seam under it
const base = 0.031;                                  // the cabinet's underside, at the doors' bottom edge
// inside heights, ESTIMATED from the open photo (1.587 mm per px on the 1587 mm body; NOTES.md)
const floorTop = 0.108;
const fzCeil = 1.065, fzFloor = 1.136;               // the mullion: fridge ceiling, freezer floor
const fzTop = 1.56;                                  // freezer ceiling
const fzShelfTop = 1.365;
const s1 = 0.936, s2 = 0.701, s3 = 0.513;            // EVERYDAY FRESH, shelf 2, shelf 3: glass tops
const sCover = 0.425;                                // the crisper cover's top
const vbBottom = 0.113, vbTop = 0.41;                // the FRUITS & VEGETABLES crisper
// door bins: floor above the door's bottom edge, end-wall height, depth out from the liner (ESTIMATED, open photo)
const BINS = {
  FridgeDoor: [
    { f: 0.05, h: 0.13, d: 0.1, print: "bottle", pw: 0.101 },
    { f: 0.39, h: 0.12, d: 0.1, print: "bigbottle", pw: 0.124 },
    { f: 0.751, h: 0.06, d: 0.09, print: "easy", pw: 0.08 },
    { f: 0.912, h: 0.06, d: 0.09, print: "easy", pw: 0.08, eggs: true },
  ],
  FreezerDoor: [{ f: 0.049, h: 0.07, d: 0.075, print: "frozen", pw: 0.08 }, { f: 0.228, h: 0.07, d: 0.075, print: "frozen", pw: 0.08 }],
};
const linerFace = 0.016;
const reach = (name) => Math.max(...BINS[name].map((b) => b.d)) + linerFace;
const frontFridge = zFront - reach("FridgeDoor") - 0.01;
const frontFreezer = zFront - reach("FreezerDoor") - 0.01;

// ── materials ──
// steel film doors and painted steel sides as the LG 343 L's (metal under 0.5, so the iPhone file's part-metal fix applies)
const steelFz = mat("DoorFreezer", 0xffffff, { metal: 0.38, rough: 0.5 });     // Illusia Steel: the brushed texture carries the colour
const steelFr = mat("DoorFridge", 0xffffff, { metal: 0.38, rough: 0.5 });
const doorEdge = mat("DoorEdge", 0xa4a6aa, { metal: 0.38, rough: 0.5 });       // the doors' rounded edges, the same steel
const sideL = mat("SideSteelL", 0xffffff, { metal: 0.38, rough: 0.5 });        // painted steel sides: the texture carries the colour
const sideR = mat("SideSteelR", 0xffffff, { metal: 0.38, rough: 0.5 });        // and the fall from front to back
const topPaint = mat("TopPaint", 0x5a5b5f, { metal: 0.15, rough: 0.7 });
const backPaint = mat("BackPaint", 0x505154, { metal: 0.1, rough: 0.75 });
const frame = mat("FrontFrame", 0x1d1e21, { rough: 0.6 });                     // the cabinet's front round the openings, dark in the doors' gap
const panelM = mat("TouchPanel", 0xffffff, { metal: 0.7, rough: 0.22 });        // black glass with its print
const capM = mat("FridgeCap", 0xffffff, { metal: 0.4, rough: 0.35 });           // black and silver top cap of the fridge door
const seam = mat("CapSeam", 0x0d0e10, { rough: 0.7 });
const pocket = mat("PocketHandle", 0x111214, { rough: 0.7 });                  // the side pocket handles' dark slots
const liner = mat("Liner", 0xf1f3f5, { rough: 0.6 });
const linerDk = mat("LinerGrey", 0xdde1e5, { rough: 0.62 });
const gasket = mat("Gasket", 0x6c7176, { rough: 0.85 });
const baseDark = mat("BaseDark", 0x1b1c1f, { rough: 0.8 });
const glass = mat("TemperedGlass", 0xa9cdd6, { rough: 0.05, opacity: 0.55, side: THREE.DoubleSide });
const glassEdge = mat("ShelfSide", 0xe8eaec, { rough: 0.45 });
const chrome = mat("ChromeTrim", 0xc4c7cb, { metal: 1, rough: 0.2 });           // the shelves' bright front trims (open photo)
const clear = mat("ClearPlastic", 0xc3d0da, { rough: 0.12, opacity: 0.5, side: THREE.DoubleSide });
const clearLite = mat("ClearPlasticLight", 0xdfe7ee, { rough: 0.12, opacity: 0.26, side: THREE.DoubleSide });
const frosted = mat("Frosted", 0xe6edf1, { rough: 0.45, opacity: 0.78 });
const white = mat("WhitePlastic", 0xf6f7f8, { rough: 0.45 });
const vent = mat("Vent", 0x2a2c30, { rough: 0.7 });
const footM = mat("Foot", 0x131416, { rough: 0.7 });
const hingeM = mat("Hinge", 0xc9ccd0, { metal: 0.9, rough: 0.3 });
const PR = {};
for (const k of ["everyday", "arctic", "convertible", "frozen", "easy", "bigbottle", "bottle", "fruits"]) PR[k] = mat("Print_" + k, 0xffffff, { rough: 0.5, opacity: 0.999 });
const printAspect = { everyday: 32.8 / 4.3, arctic: 18.3 / 3.3, convertible: 20.4 / 7.2, frozen: 26.2 / 4.2, easy: 21.8 / 4.3, bigbottle: 33.1 / 4.3, bottle: 26.1 / 4.3, fruits: 43.7 / 10.5 };

const root = group("Whirlpool22343");
const cab = group("Cabinet");
root.add(cab);
const plane = (name, w, h, m, x, y, z) => mesh(name, flipV(new THREE.PlaneGeometry(w, h)), m, x, y, z);
const print = (name, key, w, x, y, z, back = false) => { const p = plane(name, w, w / printAspect[key], PR[key], x, y, z); if (back) p.rotation.y = Math.PI; return p; };
const cyl = (name, rt, rb, h, m, x, y, z, seg = 16) => mesh(name, new THREE.CylinderGeometry(rt, rb, h, seg), m, x, y, z);

// ── cabinet: dark grey painted steel outside, white inside ──
const shellH = cabTop - base, shellMid = base + shellH / 2, zMid = zBack + Dc / 2;
cab.add(faced("SideLeft", wall, shellH, Dc, [liner, sideL, topPaint, baseDark, frame, backPaint], -W / 2 + wall / 2, shellMid, zMid));
cab.add(faced("SideRight", wall, shellH, Dc, [sideR, liner, topPaint, baseDark, frame, backPaint], W / 2 - wall / 2, shellMid, zMid));
cab.add(faced("Top", W - 2 * wall, cabTop - fzTop, Dc, [liner, liner, topPaint, liner, frame, backPaint], 0, (cabTop + fzTop) / 2, zMid));
// the floor: level under the crisper, and a lower sill in front of it where the door's bottom bin comes in when shut
// (the open photo has that bin's floor about 20 mm under the crisper's; ESTIMATED)
const sillTop = 0.075, zSill = frontFridge;
cab.add(faced("Base", W - 2 * wall, floorTop - base, zSill - zBack, [liner, liner, liner, baseDark, liner, backPaint], 0, base + (floorTop - base) / 2, (zBack + zSill) / 2));
cab.add(faced("BaseSill", W - 2 * wall, sillTop - base, zFront - zSill, [liner, liner, liner, baseDark, frame, liner], 0, base + (sillTop - base) / 2, (zSill + zFront) / 2));
cab.add(faced("BackWall", W - 2 * wall, fzTop - floorTop, backT, [liner, liner, liner, liner, liner, backPaint], 0, (fzTop + floorTop) / 2, zBack + backT / 2));
cab.add(faced("Divider", W - 2 * wall, fzFloor - fzCeil, Dc - backT, [liner, liner, liner, liner, frame, liner], 0, (fzCeil + fzFloor) / 2, zMid + backT / 2));
// the back: the walls' backs, plain. Whirlpool publishes no rear photo or manual for this model, so no cord, plug,
// compressor bay or rating plate is modelled (NOTES.md)
// feet: on Whirlpool's front a foot 25 mm in from the left edge and one 28 mm in from the right, about 30 mm across and
// 31 mm tall; the two at the back are ESTIMATED (not shown)
cab.add(cyl("FootFrontL", 0.014, 0.015, base, footM, -W / 2 + 0.025 + 0.015, base / 2, zFront - 0.05));
cab.add(cyl("FootFrontR", 0.014, 0.015, base, footM, W / 2 - 0.028 - 0.015, base / 2, zFront - 0.05));
for (const sx of [-1, 1]) cab.add(cyl("FootRear", 0.014, 0.015, base, footM, sx * (W / 2 - 0.04), base / 2, zBack + 0.06));
// hinges on the right: the bottom bracket by the right foot, the middle hinge in the doors' gap, the top cover
cab.add(box("HingeBottom", 0.03, 0.007, 0.07, hingeM, W / 2 - 0.022, base - 0.0035, zFront + 0.012));
cab.add(box("HingeMid", 0.028, yFreezer - frTop - 0.001, 0.036, hingeM, W / 2 - 0.02, (yFreezer + frTop) / 2, zFront + 0.009));
cab.add(box("HingeCoverTop", 0.07, H - cabTop - 0.001, 0.06, topPaint, W / 2 - 0.04, cabTop + (H - cabTop - 0.001) / 2, zFront - 0.031));

// ── inside ──
const inW = W - 2 * wall;
const zIn = zBack + backT;
const rails = (name, yTop, z0, z1) => { for (const sx of [-1, 1]) cab.add(box(name, 0.01, 0.012, z1 - z0, linerDk, sx * (inW / 2 - 0.005), yTop - 0.012, (z0 + z1) / 2)); };
// the freezer: the raised duct across its lower back (three vent slots along its top, the CONVERTIBLE FREEZER print),
// a row of small holes above it, the shelf, and the ARCTIC FRESH ice bank on the shelf at the left
const ductD = 0.03, ductTop = 1.3, zDuctFz = zIn + ductD;
cab.add(box("FreezerDuct", inW - 0.04, ductTop - fzFloor, ductD, liner, 0, (ductTop + fzFloor) / 2, zIn + ductD / 2));
for (const x of [-0.12, 0, 0.12]) cab.add(box("FreezerVent", 0.09, 0.008, 0.004, vent, x, ductTop - 0.012, zDuctFz + 0.0015));
for (let i = 0; i < 4; i++) cab.add(box("FreezerHole", 0.005, 0.005, 0.003, vent, -0.012 + i * 0.008, 1.318, zIn + 0.0015));
cab.add(print("PrintConvertible", "convertible", 0.075, 0, 1.25, zDuctFz + 0.0007));
{
  const z0 = zIn + 0.002, z1 = frontFreezer, w = inW - 0.012;
  cab.add(box("FreezerShelf", w, 0.006, z1 - 0.01 - z0, glass, 0, fzShelfTop - 0.003, (z0 + z1 - 0.01) / 2));
  cab.add(box("FreezerShelfTrim", w, 0.012, 0.01, white, 0, fzShelfTop - 0.006, z1 - 0.005));
  rails("FreezerShelfRail", fzShelfTop - 0.006, zIn, z1 - 0.01);
}
// the ice bank: a white lid over a clear box, 178 mm wide and 105 mm tall (open photo); its depth is ESTIMATED
const ibW = 0.178, ibH = 0.105, ibD = 0.24, ibX = -inW / 2 + 0.008 + ibW / 2, ibZ1 = frontFreezer - 0.012, ibZ0 = ibZ1 - ibD;
{
  const g = group("IceBank", ibX, fzShelfTop, 0), lid = 0.035, bh = ibH - lid, bz = (ibZ0 + ibZ1) / 2;
  g.add(box("IceBankFloor", ibW - 0.01, 0.004, ibD - 0.01, clear, 0, 0.002, bz));
  for (const sx of [-1, 1]) g.add(box("IceBankSide", 0.004, bh, ibD - 0.01, clear, sx * (ibW / 2 - 0.007), bh / 2, bz));
  g.add(box("IceBankFront", ibW - 0.014, bh, 0.004, clearLite, 0, bh / 2, ibZ1 - 0.007));
  g.add(box("IceBankBack", ibW - 0.014, bh, 0.004, clear, 0, bh / 2, ibZ0 + 0.007));
  g.add(box("IceBankLid", ibW, lid, ibD, white, 0, bh + lid / 2, bz));
  g.add(print("PrintArctic", "arctic", 0.056, 0, bh * 0.5, ibZ1 - 0.0045));
  cab.add(g);
}

// the fridge: the light housing at the top of the back (its two dark windows), the air tower under it with its slots
const twW = 0.2, twTop = 0.993, twBot = sCover, zTw = zIn + 0.015;
cab.add(box("LightHousing", twW, 1.041 - twTop, 0.05, liner, 0, (1.041 + twTop) / 2, zIn + 0.025));
for (const sx of [-1, 1]) cab.add(box("HousingWindow", 0.013, 0.013, 0.002, vent, sx * 0.055, 1.022, zIn + 0.051));
cab.add(box("AirTower", twW, twTop - twBot, 0.015, liner, 0, (twTop + twBot) / 2, zIn + 0.0075));
for (const y of [0.877, 0.751, 0.679, 0.481]) for (const sx of [-1, 1]) cab.add(box("TowerVent", 0.035, 0.006, 0.003, vent, sx * 0.055, y, zTw + 0.0015));

// what comes out (FridgeTrays): the EVERYDAY FRESH shelf and the crisper, with their food
const trays = group("FridgeTrays");
cab.add(trays);
function glassShelf(parent, name, yTop, trimH, label) {
  const z0 = zTw + 0.002, z1 = frontFridge, w = inW - 0.014;
  parent.add(box(name, w, 0.006, z1 - 0.01 - z0, glass, 0, yTop - 0.003, (z0 + z1 - 0.01) / 2));
  for (const sx of [-1, 1]) parent.add(box(name + "Side", 0.008, 0.014, z1 - z0, glassEdge, sx * (w / 2 - 0.004), yTop - 0.007, (z0 + z1) / 2));
  parent.add(box(name + "Trim", w, trimH, 0.01, chrome, 0, yTop - trimH / 2 + 0.002, z1 - 0.005));
  if (label) parent.add(print("PrintEveryday", "everyday", 0.124, 0, yTop - trimH / 2 + 0.002, z1 + 0.0007));
  rails(name + "Rail", yTop - 0.006, zIn, z1 - 0.01);
}
glassShelf(trays, "Shelf1", s1, 0.026, true);        // EVERYDAY FRESH: the wide chrome front with its print
glassShelf(cab, "Shelf2", s2, 0.012, false);
glassShelf(cab, "Shelf3", s3, 0.012, false);
// the crisper cover (fixed): a frosted plate
{
  const z0 = zTw + 0.002, z1 = frontFridge, w = inW - 0.014;
  cab.add(box("CrisperCover", w, 0.006, z1 - 0.012 - z0, frosted, 0, sCover - 0.003, (z0 + z1 - 0.012) / 2));
  cab.add(box("CrisperCoverFront", w, 0.016, 0.012, white, 0, sCover - 0.008, z1 - 0.006));
  rails("CrisperCoverRail", sCover - 0.006, zIn, z1 - 0.01);
}
// the FRUITS & VEGETABLES crisper (FzBox* are the names qa_bounds reads)
const vbW = inW - 0.016, vbZ0 = zTw + 0.006, vbZ1 = frontFridge, vbD = vbZ1 - vbZ0, vbZ = (vbZ0 + vbZ1) / 2;
{
  const hh = vbTop - vbBottom;
  trays.add(box("FzBoxFloor", vbW, 0.004, vbD, clear, 0, vbBottom + 0.002, vbZ));
  trays.add(box("FzBoxBack", vbW, hh, 0.004, clear, 0, vbBottom + hh / 2, vbZ0 + 0.002));
  trays.add(box("FzBoxL", 0.004, hh, vbD, clear, -vbW / 2 + 0.002, vbBottom + hh / 2, vbZ));
  trays.add(box("FzBoxR", 0.004, hh, vbD, clear, vbW / 2 - 0.002, vbBottom + hh / 2, vbZ));
  trays.add(box("FzBoxFront", vbW, hh - 0.012, 0.004, clearLite, 0, vbBottom + (hh - 0.012) / 2, vbZ1 - 0.002));
  trays.add(box("FzBoxRim", vbW + 0.006, 0.012, 0.008, frosted, 0, vbTop - 0.006, vbZ1 - 0.002));
  trays.add(print("PrintFruits", "fruits", 0.16, 0, 0.297, vbZ1 + 0.0007));
}

// ── groceries (stock_lg.mjs, food.mjs) ──
const stock = LGStock({ T3: `${TEX}/lg_glt3426`, TF: `${TEX}/food`, BR: `${TEX}/brands`, BRT: `${TEX}/brands/small` });
const vbFloor = vbBottom + 0.004;
stock.shelves(trays, {
  // stock_lg.mjs stands the food 3 mm over the height it is given: give it each top less 2.5 mm
  zIn1: zIn, inW, inD: frontFridge - zIn, s1: s1 - 0.0025, s2: s2 - 0.0025, s3: s3 - 0.0025, fz: vbFloor, fit: true,
  vz0: vbZ0 + 0.02, vk: 0.7,
  shelfB: { hw: inW / 2 - 0.03, z0: zTw + 0.02, z1: frontFridge - 0.015 },
  drawerB: { hw: vbW / 2 - 0.014, z0: vbZ0 + 0.02, z1: vbZ1 - 0.008, y0: vbFloor },
  drawerCeil: sCover - 0.006 - 0.01 - vbFloor,
});
for (const n of ["Shelf2Stock", "Shelf3Stock"]) { const g = trays.getObjectByName(n); trays.remove(g); cab.add(g); }
stock.freezer(cab, { fit: true, zIn1: zIn, floor: fzFloor, top: fzShelfTop + 0.0005, box: { hw: inW / 2 - 0.03, z0: zDuctFz + 0.02, z1: frontFreezer - 0.02 } });

// The fitted stock is laid out for the LG 343 L (about 540 mm between the walls; this one has 480 and a shallower
// cabinet), so some trays are laid out again in rows inside their rims (as for the Haier HRF-2902)
root.updateMatrixWorld(true);
const bbox = (o) => new THREE.Box3().setFromObject(o);
function row(items, x0, x1, z0) {
  const bs = items.map(bbox), w = bs.reduce((s, b) => s + b.max.x - b.min.x, 0), gap = (x1 - x0 - w) / (items.length + 1);
  if (gap < 0.006) console.warn(`row: ${items.map((o) => o.name)} leave ${(gap * 1000).toFixed(0)} mm between them`);
  let x = x0 + gap, dep = 0;
  items.forEach((o, i) => { const b = bs[i]; o.position.x += x - b.min.x; o.position.z += z0 - b.min.z; x += b.max.x - b.min.x + gap; dep = Math.max(dep, b.max.z - b.min.z); });
  return dep;
}
const kids = (g, name) => g.children.filter((o) => o.name === name);
const drop = (...os) => os.forEach((o) => o && o.parent.remove(o));
{
  const g = cab.getObjectByName("Shelf2Stock"), hw = inW / 2 - 0.03, z0 = zTw + 0.02;
  drop(g.getObjectByName("RnrBiryani"));
  const d1 = row([g.getObjectByName("CoconutHalf"), g.getObjectByName("WatermelonHalf")], -hw, hw, z0);
  row([g.getObjectByName("NandhanaPalace"), g.getObjectByName("NandhanaPalace2")], -hw, hw, z0 + d1 + 0.03);
}
{
  const g = cab.getObjectByName("Shelf3Stock"), hw = inW / 2 - 0.03, z0 = zTw + 0.02;
  const [a0, a1, a2, a3, a4] = kids(g, "Apple"), [o0, o1, o2] = kids(g, "Orange"), [l0, l1] = kids(g, "Lemon");
  drop(g.getObjectByName("AmulMastiDahi"), a3, a4, o1, o2, l0);
  const d1 = row([g.getObjectByName("Bananas"), g.getObjectByName("Grapes"), l1], -hw, hw, z0);
  row([a0, a1, o0, a2], -hw, hw, z0 + d1 + 0.03);
}
{ // the EVERYDAY FRESH shelf has 129 mm under the ceiling and the light housing at its back: the tiffin and the batter
  // pouch are too tall, so it holds what Whirlpool's stocked photo puts there, a butter brick and curd cups, with the
  // buttermilk in the back row and the biryani box and milk in front
  const g = trays.getObjectByName("Shelf1Stock"), hw = inW / 2 - 0.03, z0 = zTw + 0.02;
  drop(g.getObjectByName("Tiffin"), g.getObjectByName("IdBatterPouch1"));
  stock.fresh0(trays, { y: s1, z: 0 });
  root.updateMatrixWorld(true);
  const f = trays.getObjectByName("F0Stock"), [c0, c1, c2] = kids(f, "AmulMastiCup");
  drop(f.getObjectByName("AmulButter2"), f.getObjectByName("AmulCheese"), c2);
  row([f.getObjectByName("AmulButter1"), c0, c1, g.getObjectByName("MastiButtermilk")], -hw, hw, zIn + 0.06);
}
{ // the frozen packs on the freezer shelf: one pile to the right of the ice bank
  const g = cab.getObjectByName("OnFreezerShelf");
  const pile = ["ViswasParotta2", "AmulPaneer", "FreshoGreenPeas2"].map((n) => g.getObjectByName(n));
  const x0 = ibX + ibW / 2 + 0.015, x1 = inW / 2 - 0.02, xm = (x0 + x1) / 2, zb = zIn + 0.03;
  let top = null;
  pile.forEach((o, i) => {
    const b = bbox(o);
    o.position.x += xm + [0, 0.008, -0.006][i] - (b.min.x + b.max.x) / 2;
    o.position.z += zb + [0, 0.01, 0.004][i] - b.min.z;
    if (top != null) o.position.y += top - b.min.y;
    top = (top ?? b.min.y) + (b.max.y - b.min.y);
  });
}

// ── doors: hinged on the right, Illusia Steel fronts ──
const pw = W - 0.002, bw = pw - 0.1;
const inside = (dep) => [-pw / 2 - bw / 2 + 0.004, -pw / 2 + bw / 2 - 0.004, -(linerFace + dep / 2)];
// the eggs: six at the free end of the top EASY RACK (the stocked photo has them there, jars at the hinge end)
const EGGS = [0, 1, 2, 3, 4, 5].map((i) => -pw / 2 - bw / 2 + 0.004 + 0.03 + i * 0.045);
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
    pivot.add(print(`${name}Bin${i}Print`, b.print, b.pw, -pw / 2, b.f + b.h * 0.4, zl - 0.0007, true));
    if (b.eggs) for (const x of EGGS) { const c = mesh("EggCup", new THREE.SphereGeometry(0.02, 12, 4, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), clear, x, b.f, zc); c.scale.y = 0.7; pivot.add(c); }
  });
}
// a side pocket handle: the dark slot in the door's left edge (3/4 views; its height on the door ESTIMATED from them)
const pocketSlot = (pivot, name, y0, y1) => pivot.add(box(name, 0.004, y1 - y0, 0.012, pocket, -pw + 0.0015, (y0 + y1) / 2, doorT * 0.55));
// the touch panel: 94 x 236 mm of black glass from the freezer door's top edge down, centred, its bottom corners
// rounded (3.5 mm)
function panelPlane(w, h, r) {
  const s = new THREE.Shape();
  s.moveTo(-w / 2, h / 2); s.lineTo(-w / 2, -h / 2 + r); s.quadraticCurveTo(-w / 2, -h / 2, -w / 2 + r, -h / 2);
  s.lineTo(w / 2 - r, -h / 2); s.quadraticCurveTo(w / 2, -h / 2, w / 2, -h / 2 + r); s.lineTo(w / 2, h / 2); s.lineTo(-w / 2, h / 2);
  const g = new THREE.ShapeGeometry(s, 6), p = g.attributes.position, uv = g.attributes.uv;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, (p.getX(i) + w / 2) / w, (h / 2 - p.getY(i)) / h);
  return g;
}
const freezerDoor = group("FreezerDoor", W / 2, yFreezer, zFront);
{
  const h = H - yFreezer;
  freezerDoor.add(mesh("FreezerPanel", flipV(new THREE.BoxGeometry(pw, h, doorT)), [doorEdge, doorEdge, doorEdge, doorEdge, steelFz, liner], -pw / 2, h / 2, doorT / 2));
  freezerDoor.add(mesh("TouchPanelGlass", panelPlane(0.094, 0.236, 0.0035), panelM, -pw / 2, h - 0.118, doorT + 0.0007));
  pocketSlot(freezerDoor, "PocketHandleFreezer", 1.173 - yFreezer, 1.36 - yFreezer);
  doorInside(freezerDoor, "FreezerDoor", h);
}
const fridgeDoor = group("FridgeDoor", W / 2, frBot, zFront);
{
  const h = frTop - frBot, lowH = h - capH - seamH;
  fridgeDoor.add(mesh("FridgePanel", flipV(new THREE.BoxGeometry(pw, lowH, doorT)), [doorEdge, doorEdge, doorEdge, doorEdge, steelFr, liner], -pw / 2, lowH / 2, doorT / 2));
  const sd = doorT - 0.003;                              // the seam: a dark groove 3 mm deep under the cap
  fridgeDoor.add(box("CapSeam", pw, seamH, sd, seam, -pw / 2, lowH + seamH / 2, sd / 2));
  fridgeDoor.add(mesh("FridgeCapBand", flipV(new THREE.BoxGeometry(pw, capH, doorT)), [doorEdge, doorEdge, doorEdge, doorEdge, capM, liner], -pw / 2, lowH + seamH + capH / 2, doorT / 2));
  pocketSlot(fridgeDoor, "PocketHandleFridge", 0.847 - frBot, 1.043 - frBot);
  doorInside(fridgeDoor, "FridgeDoor", h);
}
{ // what sits in the door bins, so it swings out with the door
  const F = BINS.FridgeDoor, Z = BINS.FreezerDoor;
  stock.doorFridge(fridgeDoor, { fit: true, eggY: F[3].f, eggX: EGGS, eggDY: 0, eggTurn: Math.PI / 2, jarY: F[2].f, botY: F[1].f, canY: F[0].f, deps: { egg: F[3].d, jar: F[2].d, bottle: F[1].d, can: F[0].d }, inside });
  stock.doorFreezer(freezerDoor, { fit: true, b1: Z[1].f, b2: Z[0].f, dep: Math.min(Z[0].d, Z[1].d), inside });
}
root.add(freezerDoor, fridgeDoor);

const parts = productParts(PRODUCTS, ID);
const clips = stateClips(root, parts);
saveZones(PRODUCTS, ID, root, parts);
{ // the cauliflower's tilted leaves: bake their tilt into their geometry so qa_fit measures the real extent (as Haier)
  const c = trays.getObjectByName("Cauliflower");
  if (c) for (const m of c.children) if (m.isMesh && (m.rotation.x || m.rotation.z)) {
    m.updateMatrix(); m.geometry = m.geometry.clone().applyMatrix4(m.matrix);
    m.position.set(0, 0, 0); m.rotation.set(0, 0, 0); m.scale.set(1, 1, 1);
  }
}
const used = new Set();
root.traverse((o) => o.material && [].concat(o.material).forEach((m) => used.add(m.name)));
const only = (t) => Object.fromEntries(Object.entries(t).filter(([k]) => used.has(k)));
// Grain: the doors are horizontally brushed steel under a glossy film (Whirlpool's photos), so the hairline across
// them with the clear coat that catches the studio's strips; the painted steel sides, top and back get the soft peel.
// No grain on the panel, cap or prints. The clear coat's roughness (0.3) keeps the default view's reflection of the
// studio's tall strip from washing the door out (at 0.12 it read 203 of 255 against the photo's 156).
await exportGLB(root, clips, OUT, only({
  DoorFreezer: `${T}/door_freezer.jpg`,
  DoorFridge: `${T}/door_fridge.jpg`,
  SideSteelL: `${T}/side_l.jpg`,
  SideSteelR: `${T}/side_r.jpg`,
  TouchPanel: `${T}/panel.jpg`,
  FridgeCap: `${T}/cap.jpg`,
  ...Object.fromEntries(Object.keys(PR).map((k) => ["Print_" + k, `${T}/print_${k}.png`])),
  ...stock.textures(),
}), { dir: `${TEX}/grain`, materials: {
  DoorFreezer: { type: "hairline", dir: "h", clearcoat: [0.6, 0.3] },
  DoorFridge: { type: "hairline", dir: "h", clearcoat: [0.6, 0.3] },
  DoorEdge: { type: "hairline_soft", dir: "h" },
  SideSteelL: { type: "peel_soft" }, SideSteelR: { type: "peel_soft" }, TopPaint: { type: "peel_soft" }, BackPaint: { type: "peel_soft" },
} });
