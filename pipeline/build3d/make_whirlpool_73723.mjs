// Whirlpool 73723: Icemagic Pro 207 L 3 star direct-cool single door, Wine Silk - Y (energy label model DAS20743ITAUC).
// Built to Whirlpool India's published size, 536 W x 1333 H x 655 D mm, and to Whirlpool's own photos of this code: the
// straight front (the flower print, the crescent top, the Breathe Arc handle, the mark, the feet and the red bottom
// hinge) and the two 3/4 views (the wine sides, the red top hinge cover, the lock in the gap at the front left, the grey
// gasket). Whirlpool's front draws the body squatter than the published size (H:W 2.36 against 2.49), so heights are
// read off it as a fraction of the body's height and laid on the published 1333 mm; the handle and the mark keep their
// true size, read across at 2.052 px per mm (NOTES.md).
// Inside: Whirlpool shows no open photo of this code. The layout follows its open photos of the same 207 L cabinet in
// the glass-door range (the freezer box with the knob and lamp beside it, the chill tray under it, three glass shelves,
// the crisper cover and the crisper, four door bins) and the Icemagic Pro close-ups for this range's own parts (the
// MAGIC CHILL tray, the honeycomb crisper cover with its blue slider, VEGGIE FRESH, ADVANCED AIR FLOW, BIG BOTTLE RACK).
// Every inside size, the door's 120 degrees and the freezer flap's left hinge are ESTIMATED (NOTES.md). Whirlpool
// publishes no manual or rear photo for this model: the back is plain (no compressor, cord or plug is shown anywhere).
// The top glass shelf, the chill tray and the crisper come out with their food (FridgeTrays). Stocked for a south
// Indian kitchen (stock_lg.mjs, fit: true).
// usage: node make_whirlpool_73723.mjs <entry .json, never products.json> <tex dir> <out.glb>
import { LGStock } from "./stock_lg.mjs";
import { THREE, mat, mesh, box, faced, group, flipV, stateClips, exportGLB, productParts, saveZones } from "./lib.mjs";

const [PRODUCTS, TEX, OUT] = process.argv.slice(2);
const ID = "whirlpool-73723";
const T = `${TEX}/whirlpool_73723`;

// ── size (metres): Whirlpool's 536 x 1333 x 655 mm, the depth to the handle's front ──
const W = 0.536, H = 1.333, D = 0.655;
const handleOut = 0.045, doorT = 0.05, gap = 0.012;   // the handle's reach, the door, the gasket gap (ESTIMATED, 3/4 views)
const Dc = D - handleOut - doorT - gap;               // the cabinet: 548 mm
const zBack = -D / 2, zFront = zBack + Dc, zDoor = zFront + gap;
const wall = 0.038, backT = 0.045;                    // ESTIMATED (open photo: about 460 mm between the walls)
// heights on Whirlpool's front (crest row 101 = 1333 mm, the feet's bottom row 2700 = 0: 0.5133 mm per px)
const doorBot = 0.043;                                // the door's bottom edge (row 2616)
const R = 1.95;                                       // the crescent top: 1333 mm at the middle, about 18 mm lower at the edges
const cabTop = 1.31;                                  // the cabinet's top, under the crescent's ends (ESTIMATED, 3/4 views)
const base = 0.038;                                   // the cabinet's underside (front: the feet are 38 mm tall)
// inside heights, ESTIMATED from the open photo of the glass-door 207 L (1.427 mm per px on the body's height)
const floorTop = 0.08, ceil = 1.27;
const fbBot = 1.035, fbTop = 1.253;                   // the freezer box
const ctBot = 0.935, ctTop = 1.013;                   // the MAGIC CHILL tray
const s1 = 0.806, s2 = 0.671, s3 = 0.5;               // glass shelves
const sCover = 0.371;                                 // the crisper cover's top
const vbBottom = 0.086, vbTop = 0.365;                // the crisper
const BINS = [                                         // door bins: floor above the door's bottom edge, wall height, depth
  { f: 0.118, h: 0.1, d: 0.095 },
  { f: 0.372, h: 0.1, d: 0.095, print: true },        // BIG BOTTLE RACK
  { f: 0.712, h: 0.07, d: 0.085 },
  { f: 1.137, h: 0.05, d: 0.08, eggs: true },
];
const linerFace = 0.016;
const frontFridge = zDoor - linerFace - Math.max(...BINS.map((b) => b.d)) - 0.01;

// ── materials ──
const sidePaint = mat("SidePaint", 0x430816, { metal: 0.3, rough: 0.45 });    // Wine (3/4 views: 63-75, 5-8, 21-28; tuned so the web side reads 63, 5, 21)
const topPaint = mat("TopPaint", 0x45081a, { metal: 0.15, rough: 0.6 });
const backPaint = mat("BackPaint", 0x3f0815, { metal: 0.1, rough: 0.7 });
const redTrim = mat("RedTrim", 0x8a1024, { rough: 0.4 });                     // the hinge covers and the lock (front and 3/4 views)
const printM = mat("DoorPrint", 0xffffff, { rough: 0.3 });                    // the flower print: glossy, no grain
const doorEdge = mat("DoorEdge", 0x662f3a, { rough: 0.35 });                  // the print's mean along the door's sides
const logoM = mat("WhirlpoolMark", 0xffffff, { rough: 0.35, opacity: 0.999 });
const chrome = mat("Chrome", 0xc4c7cb, { metal: 1, rough: 0.18 });
const liner = mat("Liner", 0xf1f3f5, { rough: 0.6 });
const linerDk = mat("LinerGrey", 0xdde1e5, { rough: 0.62 });
const gasket = mat("Gasket", 0x8d9196, { rough: 0.85 });                      // the grey strip in the gap on the 3/4 views
const frame = mat("FrontFrame", 0x3a0712, { rough: 0.6 });
const baseDark = mat("BaseDark", 0x1b1c1f, { rough: 0.8 });
const glass = mat("TemperedGlass", 0xa9cdd6, { rough: 0.05, opacity: 0.55, side: THREE.DoubleSide });
const white = mat("WhitePlastic", 0xf6f7f8, { rough: 0.45 });
const clear = mat("ClearPlastic", 0xc3d0da, { rough: 0.12, opacity: 0.5, side: THREE.DoubleSide });
const clearLite = mat("ClearPlasticLight", 0xdfe7ee, { rough: 0.12, opacity: 0.26, side: THREE.DoubleSide });
const frosted = mat("Frosted", 0xe6edf1, { rough: 0.45, opacity: 0.78 });
const vent = mat("Vent", 0x2a2c30, { rough: 0.7 });
const blue = mat("SliderBlue", 0x2f74b8, { rough: 0.4 });                     // the crisper's moisture slider (close-up)
const footM = mat("Foot", 0x26272b, { metal: 0.3, rough: 0.5 });              // dark ribbed feet (front)
const pinM = mat("Hinge", 0xc9ccd0, { metal: 0.9, rough: 0.3 });
const meshM = mat("LampCover", 0xd9dde1, { rough: 0.5 });
const PR = {};
for (const k of ["magic", "veggie", "airflow", "bigbottle"]) PR[k] = mat("Print_" + k, 0xffffff, { rough: 0.5, opacity: 0.999 });
const comb = mat("Honeycomb", 0xffffff, { rough: 0.2, opacity: 0.999, side: THREE.DoubleSide });
const aspect = { magic: 11.62, veggie: 12.95, airflow: 18.75, bigbottle: 15.34 };

const root = group("Whirlpool73723");
const cab = group("Cabinet");
root.add(cab);
const plane = (name, w, h, m, x, y, z) => mesh(name, flipV(new THREE.PlaneGeometry(w, h)), m, x, y, z);
const print = (name, key, w, x, y, z, back = false) => { const p = plane(name, w, w / aspect[key], PR[key], x, y, z); if (back) p.rotation.y = Math.PI; return p; };
const cyl = (name, rt, rb, h, m, x, y, z, seg = 18) => mesh(name, new THREE.CylinderGeometry(rt, rb, h, seg), m, x, y, z);

// ── cabinet: wine painted steel outside, white inside ──
const shellH = cabTop - base, shellMid = base + shellH / 2, zMid = zBack + Dc / 2;
cab.add(faced("SideLeft", wall, shellH, Dc, [liner, sidePaint, topPaint, baseDark, frame, backPaint], -W / 2 + wall / 2, shellMid, zMid));
cab.add(faced("SideRight", wall, shellH, Dc, [sidePaint, liner, topPaint, baseDark, frame, backPaint], W / 2 - wall / 2, shellMid, zMid));
cab.add(faced("Top", W - 2 * wall, cabTop - ceil, Dc, [liner, liner, topPaint, liner, frame, backPaint], 0, (cabTop + ceil) / 2, zMid));
cab.add(faced("Base", W - 2 * wall, floorTop - base, Dc, [liner, liner, liner, baseDark, frame, backPaint], 0, base + (floorTop - base) / 2, zMid));
cab.add(faced("BackWall", W - 2 * wall, ceil - floorTop, backT, [liner, liner, liner, liner, liner, backPaint], 0, (ceil + floorTop) / 2, zBack + backT / 2));
// the back: the walls' backs, plain. Whirlpool publishes no rear photo or manual for this model, so the compressor,
// cord and plug are not modelled (NOTES.md)
// feet (front): a dark ribbed foot 26 mm in from the left edge and one 22 mm in from the right under the red bottom
// hinge, 33 mm across; the two at the back are ESTIMATED (not shown)
cab.add(cyl("FootFrontL", 0.0165, 0.0165, base, footM, -W / 2 + 0.026, base / 2, zFront - 0.03));
cab.add(cyl("FootFrontR", 0.0165, 0.0165, base - 0.006, footM, W / 2 - 0.022, (base - 0.006) / 2, zDoor + 0.022));
for (const sx of [-1, 1]) cab.add(cyl("FootRear", 0.015, 0.015, base, footM, sx * (W / 2 - 0.035), base / 2, zBack + 0.05));
// the red bottom hinge bracket under the door's right corner, with its pin, and the red cover on the top hinge
cab.add(box("HingeBottom", 0.046, 0.006, zDoor + 0.042 - (zFront - 0.02), redTrim, W / 2 - 0.023, base - 0.003, (zDoor + 0.042 + zFront - 0.02) / 2));
cab.add(cyl("HingePin", 0.004, 0.004, doorBot - base - 0.001, pinM, W / 2 - 0.014, base + (doorBot - base - 0.001) / 2, zDoor + 0.014, 10));
cab.add(box("HingeCoverTop", 0.05, 0.015, 0.07, redTrim, W / 2 - 0.03, cabTop + 0.0075, zFront - 0.03));
// the lock: a small red block with a keyhole, on the cabinet's front at the left, in the gap behind the door, level
// with the handle's bottom (3/4 view from the left)
cab.add(box("Lock", 0.01, 0.016, 0.01, redTrim, -W / 2 + 0.006, 0.853, zFront + 0.005));
cab.add(cyl("LockKeyhole", 0.0035, 0.0035, 0.001, pinM, -W / 2 + 0.0005, 0.853, zFront + 0.005, 14).rotateZ(Math.PI / 2));

// ── inside ──
const inW = W - 2 * wall;
const zIn = zBack + backT;
const rails = (name, yTop, z0, z1) => { for (const sx of [-1, 1]) cab.add(box(name, 0.01, 0.012, z1 - z0, linerDk, sx * (inW / 2 - 0.005), yTop - 0.012, (z0 + z1) / 2)); };
// the freezer box at the top: its housing, the vent slots above the flap, the knob and the lamp cover to its right
const fbX0 = -0.205, fbX1 = 0.225, fbD = 0.33, fbZ1 = zIn + fbD, flX1 = 0.15, wt = 0.01;
{
  const w = fbX1 - fbX0, xc = (fbX0 + fbX1) / 2, h = fbTop - fbBot, zc = zIn + fbD / 2;
  cab.add(box("FreezerBoxTop", w, wt, fbD, white, xc, fbTop - wt / 2, zc));
  cab.add(box("FreezerBoxFloor", w, wt, fbD, white, xc, fbBot + wt / 2, zc));
  cab.add(box("FreezerBoxLeft", wt, h - 2 * wt, fbD, white, fbX0 + wt / 2, (fbBot + fbTop) / 2, zc));
  cab.add(box("FreezerBoxStrip", fbX1 - flX1, h - 2 * wt, fbD, white, (flX1 + fbX1) / 2, (fbBot + fbTop) / 2, zc));
  cab.add(box("FreezerBoxBand", flX1 - fbX0 - wt, 0.022, 0.012, white, (fbX0 + wt + flX1) / 2, fbTop - wt - 0.011, fbZ1 - 0.006));
  for (let i = 0; i < 7; i++) cab.add(box("FreezerVent", 0.04, 0.006, 0.002, vent, fbX0 + 0.04 + i * 0.054, fbTop - 0.011, fbZ1 + 0.001));
  // the knob (Whirlpool: "knob next to freezer") and the lamp's cover under it
  cab.add(cyl("ThermostatKnob", 0.018, 0.018, 0.016, white, 0.19, 1.175, fbZ1 + 0.008, 28).rotateX(Math.PI / 2));
  cab.add(cyl("KnobRing", 0.021, 0.021, 0.003, linerDk, 0.19, 1.175, fbZ1 + 0.0015, 28).rotateX(Math.PI / 2));
  cab.add(box("KnobGrip", 0.005, 0.03, 0.006, linerDk, 0.19, 1.175, fbZ1 + 0.019));
  cab.add(box("LampCover", 0.04, 0.05, 0.008, meshM, 0.19, 1.068, fbZ1 + 0.004));
}
// the freezer flap: clear, hinged on its left edge (ESTIMATED: the hinge pins show at the box's left on Whirlpool's
// close-ups), the frozen food behind it
const flap = group("FreezerFlap", fbX0 + wt, 0, fbZ1);
{
  const w = flX1 - fbX0 - wt, y0 = fbBot + wt, y1 = fbTop - wt - 0.022;
  flap.add(box("FlapPanel", w, y1 - y0, 0.004, clear, w / 2, (y0 + y1) / 2, 0.002));
  flap.add(box("FlapFrameL", 0.012, y1 - y0, 0.008, frosted, 0.006, (y0 + y1) / 2, 0.004));
  flap.add(box("FlapGrip", 0.012, 0.05, 0.012, frosted, w - 0.008, (y0 + y1) / 2, 0.006));
}
cab.add(flap);
// ADVANCED AIR FLOW on the back wall under the chill tray (close-up)
cab.add(print("PrintAirflow", "airflow", 0.13, 0, 0.885, zIn + 0.0007));

// what comes out (FridgeTrays): the top glass shelf, the MAGIC CHILL tray and the crisper, with their food
const trays = group("FridgeTrays");
cab.add(trays);
function glassShelf(parent, name, yTop) {
  const z0 = zIn + 0.002, z1 = frontFridge, w = inW - 0.014;
  parent.add(box(name, w, 0.006, z1 - 0.012 - z0, glass, 0, yTop - 0.003, (z0 + z1 - 0.012) / 2));
  parent.add(box(name + "Trim", w, 0.016, 0.012, white, 0, yTop - 0.007, z1 - 0.006));
  for (const sx of [-1, 1]) parent.add(box(name + "Side", 0.008, 0.012, z1 - z0, white, sx * (w / 2 - 0.004), yTop - 0.006, (z0 + z1) / 2));
  rails(name + "Rail", yTop - 0.006, zIn, z1 - 0.01);
}
glassShelf(trays, "Shelf1", s1);
glassShelf(cab, "Shelf2", s2);
glassShelf(cab, "Shelf3", s3);
// the MAGIC CHILL tray: clear, its chrome front band with the print
const ctZ0 = zIn + 0.02, ctZ1 = fbZ1 + 0.015, ctW = inW - 0.02, ctZ = (ctZ0 + ctZ1) / 2;
{
  const hh = ctTop - ctBot - 0.008;
  trays.add(box("ChillFloor", ctW, 0.004, ctZ1 - ctZ0, clear, 0, ctBot + 0.002, ctZ));
  for (const sx of [-1, 1]) trays.add(box("ChillSide", 0.004, hh, ctZ1 - ctZ0, clear, sx * (ctW / 2 - 0.002), ctBot + hh / 2, ctZ));
  trays.add(box("ChillBack", ctW, hh, 0.004, clear, 0, ctBot + hh / 2, ctZ0 + 0.002));
  trays.add(box("ChillFront", ctW, hh - 0.026, 0.004, clearLite, 0, ctBot + 0.026 + (hh - 0.026) / 2, ctZ1 - 0.002));
  trays.add(box("ChillBand", ctW, 0.024, 0.006, chrome, 0, ctBot + 0.012, ctZ1 - 0.003));
  trays.add(print("PrintMagic", "magic", 0.13, 0, ctBot + 0.012, ctZ1 + 0.0007));
  for (const sx of [-1, 1]) cab.add(box("ChillRunner", 0.012, 0.008, ctZ1 - ctZ0, linerDk, sx * (inW / 2 - 0.006), ctBot + 0.004, ctZ));
}
// the crisper cover: clear with the honeycomb, its front band with the blue moisture slider
{
  const z0 = zIn + 0.002, z1 = frontFridge, w = inW - 0.014;
  cab.add(box("CrisperCover", w, 0.005, z1 - 0.014 - z0, clearLite, 0, sCover - 0.0025, (z0 + z1 - 0.014) / 2));
  cab.add(plane("HoneycombDecal", w - 0.02, z1 - 0.03 - z0, comb, 0, sCover + 0.0007, (z0 + z1 - 0.014) / 2).rotateX(-Math.PI / 2));
  cab.add(box("CrisperCoverBand", w, 0.03, 0.014, frosted, 0, sCover - 0.015, z1 - 0.007));
  cab.add(box("MoistureSlider", 0.08, 0.012, 0.006, blue, -0.06, sCover - 0.015, z1 + 0.003));
  rails("CrisperCoverRail", sCover - 0.005, zIn, z1 - 0.01);
}
// the crisper (FzBox* are the names qa_bounds reads)
const vbW = inW - 0.016, vbZ0 = zIn + 0.01, vbZ1 = frontFridge, vbD = vbZ1 - vbZ0, vbZ = (vbZ0 + vbZ1) / 2;
{
  const hh = vbTop - vbBottom;
  trays.add(box("FzBoxFloor", vbW, 0.004, vbD, clear, 0, vbBottom + 0.002, vbZ));
  trays.add(box("FzBoxBack", vbW, hh, 0.004, clear, 0, vbBottom + hh / 2, vbZ0 + 0.002));
  trays.add(box("FzBoxL", 0.004, hh, vbD, clear, -vbW / 2 + 0.002, vbBottom + hh / 2, vbZ));
  trays.add(box("FzBoxR", 0.004, hh, vbD, clear, vbW / 2 - 0.002, vbBottom + hh / 2, vbZ));
  trays.add(box("FzBoxFront", vbW, hh - 0.012, 0.004, clearLite, 0, vbBottom + (hh - 0.012) / 2, vbZ1 - 0.002));
  trays.add(box("FzBoxRim", vbW + 0.006, 0.012, 0.008, frosted, 0, vbTop - 0.006, vbZ1 - 0.002));
  trays.add(print("PrintVeggie", "veggie", 0.15, 0.03, vbBottom + 0.07, vbZ1 + 0.0007));
}

// ── groceries (stock_lg.mjs, food.mjs) ──
const stock = LGStock({ T3: `${TEX}/lg_glt3426`, TF: `${TEX}/food`, BR: `${TEX}/brands`, BRT: `${TEX}/brands/small` });
const vbFloor = vbBottom + 0.004;
stock.shelves(trays, {
  zIn1: zIn, inW, inD: frontFridge - zIn, s1: s1 - 0.0025, s2: s2 - 0.0025, s3: s3 - 0.0025, fz: vbFloor, fit: true,
  vz0: vbZ0 + 0.02, vk: 0.65,
  shelfB: { hw: inW / 2 - 0.03, z0: zIn + 0.02, z1: frontFridge - 0.015 },
  drawerB: { hw: vbW / 2 - 0.014, z0: vbZ0 + 0.02, z1: vbZ1 - 0.008, y0: vbFloor },
  drawerCeil: sCover - 0.005 - 0.01 - vbFloor,
});
for (const n of ["Shelf2Stock", "Shelf3Stock"]) { const g = trays.getObjectByName(n); trays.remove(g); cab.add(g); }
// the freezer box: tubs and packs on its floor (no shelf inside it is shown, so nothing lies on one)
stock.freezer(cab, { fit: true, zIn1: zIn, floor: fbBot + wt, top: fbTop, box: { hw: (flX1 - fbX0) / 2 - 0.03, z0: zIn + 0.02, z1: fbZ1 - 0.02 } });

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
const hw = inW / 2 - 0.03, z0 = zIn + 0.02;
{ // the top shelf has 129 mm under the chill tray: the tiffin and the batter pouch are too tall, so it keeps the
  // buttermilk, the biryani box and the milk; the butter and curd cups go in the chill tray, as in Whirlpool's photo
  const g = trays.getObjectByName("Shelf1Stock");
  drop(g.getObjectByName("Tiffin"), g.getObjectByName("IdBatterPouch1"));
  stock.fresh0(trays, { y: ctBot + 0.004, z: 0 });
  root.updateMatrixWorld(true);
  const f = trays.getObjectByName("F0Stock"), [c0, c1, c2] = kids(f, "AmulMastiCup");
  drop(f.getObjectByName("AmulButter2"), f.getObjectByName("AmulCheese"));
  row([f.getObjectByName("AmulButter1"), c0, c1, c2], -ctW / 2 + 0.01, ctW / 2 - 0.01, ctZ0 + 0.02);
}
{
  const g = cab.getObjectByName("Shelf2Stock");
  drop(g.getObjectByName("RnrBiryani"));
  const d1 = row([g.getObjectByName("CoconutHalf"), g.getObjectByName("WatermelonHalf")], -hw, hw, z0);
  row([g.getObjectByName("NandhanaPalace"), g.getObjectByName("NandhanaPalace2")], -hw, hw, z0 + d1 + 0.03);
}
{
  const g = cab.getObjectByName("Shelf3Stock");
  const [a0, a1, a2, a3, a4] = kids(g, "Apple"), [o0, o1, o2] = kids(g, "Orange"), [l0, l1] = kids(g, "Lemon");
  drop(g.getObjectByName("AmulMastiDahi"), a3, a4, o1, o2, l0, l1);
  const d1 = row([g.getObjectByName("Bananas"), g.getObjectByName("Grapes")], -hw, hw, z0);
  row([a0, a1, o0, a2], -hw, hw, z0 + d1 + 0.03);
}
{ // the freezer box is 330 mm wide inside the flap: the two tubs stacked and the peas beside them; the parottas left out
  const f = cab.getObjectByName("FreezerStock");
  drop(f.getObjectByName("ViswasParotta"), f.getObjectByName("NityaParotta"), cab.getObjectByName("OnFreezerShelf"));
  const t0 = f.getObjectByName("AmulVanillaMagic"), t1 = f.getObjectByName("AmulRajbhog"), peas = f.getObjectByName("FreshoGreenPeas");
  const bx0 = fbX0 + wt + 0.012, bx1 = flX1 - 0.012;
  row([t0, peas], bx0, bx1, zIn + 0.03);
  t1.position.x = t0.position.x; t1.position.z = t0.position.z;
}

// ── the door: hinged on the right, the flower print on its front, the crescent top ──
const pw = W - 0.002, hCrest = H - doorBot, hEdge = hCrest - (R - Math.sqrt(R * R - (pw / 2) ** 2));
function doorShape() {
  const s = new THREE.Shape(), a = Math.asin(pw / 2 / R), cy = hCrest - R;
  s.moveTo(-pw, 0); s.lineTo(0, 0); s.lineTo(0, hEdge);
  s.absarc(-pw / 2, cy, R, Math.PI / 2 - a, Math.PI / 2 + a, false);
  s.lineTo(-pw, 0);
  return s;
}
const fridgeDoor = group("FridgeDoor", W / 2, doorBot, zDoor);
{
  const body = new THREE.ExtrudeGeometry(doorShape(), { depth: doorT, bevelEnabled: false, curveSegments: 48 });
  fridgeDoor.add(mesh("DoorBody", body, [liner, doorEdge]));   // caps (the front one is under the print), sides
  const front = new THREE.ShapeGeometry(doorShape(), 48), p = front.attributes.position, uv = front.attributes.uv;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, (p.getX(i) + pw) / pw, (hCrest - p.getY(i)) / hCrest);
  fridgeDoor.add(mesh("DoorPrintFace", front, printM, 0, 0, doorT + 0.0007));
  // the Whirlpool mark: 66.7 mm wide, centred, its middle at 1240 mm (front)
  fridgeDoor.add(plane("WhirlpoolMarkDecal", 0.0667, 0.0667 / 3.008, logoM, -pw / 2, 1.24 - doorBot, doorT + 0.0014));
  // the Breathe Arc handle: a chrome bar 46 mm wide and 367 mm long, bowed out to the handle's 45 mm, its middle at
  // 1034 mm and 193 mm left of the door's middle (front; the bow ESTIMATED from the 3/4 views)
  const L = 0.367, bw = 0.046, bt = 0.014, sag = handleOut - bt;
  const g = new THREE.BoxGeometry(bw, L, bt, 1, 24, 1), q = g.attributes.position;
  for (let i = 0; i < q.count; i++) { const y = q.getY(i); q.setZ(i, q.getZ(i) + bt / 2 + sag * (1 - (2 * y / L) ** 2)); }
  g.computeVertexNormals();
  fridgeDoor.add(mesh("BreatheArcHandle", g, chrome, -pw / 2 - 0.193, 1.034 - doorBot, doorT));
  // inside: the gasket in the gap, the liner, the bins
  const hIn = hEdge;
  fridgeDoor.add(box("GasketT", pw - 0.04, 0.014, gap, gasket, -pw / 2, hIn - 0.02, -gap / 2));
  fridgeDoor.add(box("GasketB", pw - 0.04, 0.014, gap, gasket, -pw / 2, 0.02, -gap / 2));
  fridgeDoor.add(box("GasketL", 0.014, hIn - 0.04, gap, gasket, -pw + 0.021, hIn / 2, -gap / 2));
  fridgeDoor.add(box("GasketR", 0.014, hIn - 0.04, gap, gasket, -0.021, hIn / 2, -gap / 2));
  fridgeDoor.add(box("DoorLiner", pw - 0.07, hIn - 0.07, 0.012, liner, -pw / 2, hIn / 2, -0.01));
}
const bwid = pw - 0.1;
const inside = (dep) => [-pw / 2 - bwid / 2 + 0.004, -pw / 2 + bwid / 2 - 0.004, -(linerFace + dep / 2)];
// the eggs at the free end of the top bin (the stocked photo of the 207 L has them there)
const EGGS = [0, 1, 2, 3, 4, 5].map((i) => -pw / 2 - bwid / 2 + 0.004 + 0.03 + i * 0.045);
BINS.forEach((b, i) => {
  const zc = -linerFace - b.d / 2, zl = -linerFace - b.d;
  fridgeDoor.add(box(`DoorBin${i}Floor`, bwid, 0.004, b.d, clear, -pw / 2, b.f + 0.002, zc));
  fridgeDoor.add(box(`DoorBin${i}Lip`, bwid, b.h * 0.8, 0.004, clear, -pw / 2, b.f + b.h * 0.4, zl + 0.002));
  fridgeDoor.add(box(`DoorBin${i}Rim`, bwid, 0.007, 0.005, frosted, -pw / 2, b.f + b.h * 0.8 - 0.0035, zl + 0.0025));
  for (const sx of [-1, 1]) fridgeDoor.add(box(`DoorBin${i}End`, 0.004, b.h, b.d, clear, -pw / 2 + sx * (bwid / 2 - 0.002), b.f + b.h / 2, zc));
  if (b.print) fridgeDoor.add(print("PrintBigBottle", "bigbottle", 0.11, -pw / 2 + 0.1, b.f + 0.02, zl - 0.0007, true));
  if (b.eggs) for (const x of EGGS) { const c = mesh("EggCup", new THREE.SphereGeometry(0.02, 12, 4, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), clear, x, b.f, zc); c.scale.y = 0.7; fridgeDoor.add(c); }
});
stock.doorFridge(fridgeDoor, { fit: true, eggY: BINS[3].f, eggX: EGGS, eggDY: 0, eggTurn: Math.PI / 2, jarY: BINS[2].f, botY: BINS[1].f, canY: BINS[0].f,
  deps: { egg: BINS[3].d, jar: BINS[2].d, bottle: BINS[1].d, can: BINS[0].d }, inside });
root.add(fridgeDoor);
{ // the bottle bin is 426 mm inside (the LG 343 L's takes six): the milk carton goes, the rest spread again
  drop(fridgeDoor.getObjectByName("AmulTaaza"));
  root.updateMatrixWorld(true);
  const items = ["Coke", "Fanta", "Bisleri", "RealMango", "RealMixedFruit"].map((n) => fridgeDoor.getObjectByName(n));
  const [x0, x1] = inside(BINS[1].d).map((v) => v + fridgeDoor.position.x), bs = items.map(bbox), w = bs.reduce((t, b) => t + b.max.x - b.min.x, 0), gp = (x1 - x0 - w) / (items.length + 1);
  let x = x0 + gp;
  items.forEach((o, i) => { o.position.x += x - bs[i].min.x; x += bs[i].max.x - bs[i].min.x + gp; });
}

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
// Grain: the door is a glossy print, so no grain on it or on the decals; the wine painted sides, top and
// back get the soft peel (ESTIMATED: Whirlpool publishes no material)
await exportGLB(root, clips, OUT, only({
  DoorPrint: `${T}/door_print.jpg`,
  WhirlpoolMark: `${T}/logo.png`,
  Honeycomb: `${T}/honeycomb.png`,
  ...Object.fromEntries(Object.keys(PR).map((k) => ["Print_" + k, `${T}/print_${k}.png`])),
  ...stock.textures(),
}), { dir: `${TEX}/grain`, materials: {
  SidePaint: { type: "peel_soft" }, TopPaint: { type: "peel_soft" }, BackPaint: { type: "peel_soft" },
} });
