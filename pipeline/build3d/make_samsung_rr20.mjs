// Samsung RR20C1823.., 183 L direct-cool single-door refrigerator with the Stylish Grandé door and the Base Stand Drawer,
// in the eight colours Samsung India lists for this body: Camellia Purple (RR20C1823CR/HL, the listed one, the default),
// Camellia Blue (CU), Camellia Black (CB), Blooming Saffron Red (R8), Blooming Saffron Blue (U8), Elegant Inox (S8), Urban
// Tropical Blue (VB) and Urban Tropical Red (VF). One body, so one GLB, the colours as KHR_materials_variants.
// Built to Samsung's published size: 549 W x 1300 H x 640 D mm (with the hinge, the stand and the handle; 620 mm without
// the handle), 536 mm wide without the stand (the family manual's "Basic" column for RR19/20). Samsung's fronts draw the
// body about 11% tall for its width (the stand is drawn true), so the door's features are placed as fractions of the
// door's height. Every number and how it was got is in the private research notes (NOTES.md).
// What it is: a cabinet on a base stand (in the door's colour) whose front is a drawer (Samsung: "a convenient place to
// store all of your food items that don't need cooling, such as onions and potatoes"); one door hinged on the right (the
// manual: it opens to 127 deg), its top an arched crown that rolls back, its sides rounded, a fine recessed line across
// it ("a fine line aesthetically placed towards the bottom"), a bar handle on the left with the lock at its foot, the
// SAMSUNG mark and the Digital Inverter badge; inside, the freezer box ("Super Freeze Zone") behind a clear flap hinged
// on its right, the knob panel beside it, the drip tray and the chiller tray under it, the bulb lamp on the back wall,
// two toughened glass shelves, the vegetable box's cover and the vegetable box ("BIO Fresh Zone"); in the door, five
// pockets (the top one, the egg pair, the middle one and the bottle guard). The shelves, the chiller tray and the
// vegetable box come out with their food (FridgeTrays). Stocked for a south Indian kitchen, the base drawer with onions
// and potatoes.
// usage: node make_samsung_rr20.mjs <entry .json, never products.json> <tex dir> <out.glb>
import fs from "node:fs";
import { mergeGeometries, mergeVertices } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import { NodeIO } from "@gltf-transform/core";
import { ALL_EXTENSIONS, KHRMaterialsVariants, KHRMaterialsClearcoat } from "@gltf-transform/extensions";
import { THREE, mat, mesh, box, faced, group, flipV, stateClips, exportGLB, productParts, saveZones } from "./lib.mjs";
import { LGStock } from "./stock_lg.mjs";

const [PRODUCTS, TEX, OUT] = process.argv.slice(2);
const ID = "samsung-rr20c1823cr";
const T = `${TEX}/samsung_rr20`;
const C = JSON.parse(fs.readFileSync(`${T}/colours.json`, "utf8"));

// ── size (metres) ──
const W = 0.549, Wc = 0.536, H = 1.300, D = 0.640;   // VERIFIED (Samsung India's page; Wc the manual's "Basic" width)
const zB = -D / 2;
const zCabBack = zB, zFront = zB + 0.540;            // the cabinet 540 mm deep (ESTIMATED: 620 without the handle less the door's 80, as the RR24)
const zDoor = zFront + 0.008;                        // the gasket's gap (ESTIMATED)
const T_ = 0.072;                                    // the door to its face: the face at 620 mm (Samsung, without the handle)
const footH = 0.011;                                 // the stand's four feet (fronts)
const standTop = 0.163, standLip = 0.166;            // the cabinet sits on the stand; the drawer front's top edge (fronts)
const doorBot = 0.172;                               // the door's foot (fronts)
const cabTop = 1.268;                                // the cabinet's top, 32 mm under the crown (ESTIMATED, as the RR24); the crown rises to 1300
const wall = 0.0325, inW = Wc - 2 * wall;            // 471 mm between the walls at the front (open photo)
const floorIn = 0.199, ceil = 1.252;                 // the cavity's floor and ceiling (open photo)
const zIn = zCabBack + 0.05;                         // the cavity's back (ESTIMATED: a 50 mm back wall)
const zNose = 0.285;                                 // the drawer front (ESTIMATED: 15 mm behind the door's face)
// inside (Samsung's open photo, its heights scaled to the published size: NOTES.md)
const fbX0 = -inW / 2, fbX1 = inW / 2, fbBot = 1.041, fbTop = 1.221;   // the freezer box's white surround
const flX0 = -0.206, flX1 = 0.179, flY0 = 1.047, flY1 = 1.204;          // the flap, its grip on the left
const fbZ1 = 0.1145;                                 // the box's front: its flap's grip 5.5 mm behind the shut door's top pocket (ESTIMATED)
const dripBot = 1.025, dripTop = 1.041;              // the drip tray under the box
const ctBot = 0.919, ctTop = 0.998, ctZ1 = 0.1275;   // the chiller tray
const s1 = 0.763, s2 = 0.634;                        // the two glass shelves' tops (front rims)
const coverY = 0.451;                                // the vegetable box's cover
const vbBot = 0.220, vbTop = 0.435, vbLip = 0.42;    // the vegetable box: its sides, its lower front
const frontFridge = 0.110;                           // shelves and the box stop 7 mm short of the shut door's deepest pocket
// the door
const pw = Wc - 0.002, dh = H - doorBot;
const linerFace = 0.016;
// door pockets (Samsung: 5): floors (from the floor, open photo), wall height, depth
const BK = {
  top: { y: 1.104 - doorBot, d: 0.082, h: 0.055 },
  egg: { y: 0.952 - doorBot, d: 0.075, h: 0.05 },
  middle: { y: 0.598 - doorBot, d: 0.088, h: 0.07 },
  bottle: { y: 0.217 - doorBot, d: 0.095, h: 0.075 },
};

// ── the colours ──
// door: the face's texture (each colour's own Samsung front); edge: the door's sides; side, top: the painted cabinet;
// stand: the base stand's plastic (its front carries its own texture); all read off each colour's own 3/4 views
// (ESTIMATED); mark: the SAMSUNG print's ink (white on the printed doors, grey on the Inox)
const FIN = [
  { name: "Camellia Purple", slug: "camellia_purple", edge: 0x4a1f33, side: 0x5c1c34, top: 0x521830, stand: 0x470820, mark: "light" },
  { name: "Camellia Blue", slug: "camellia_blue", edge: 0x1e2c45, side: 0x263546, top: 0x212f3f, stand: 0x243444, mark: "light" },
  { name: "Camellia Black", slug: "camellia_black", edge: 0x1c1c1e, side: 0x323337, top: 0x2c2d31, stand: 0x2a2b30, mark: "light" },
  { name: "Blooming Saffron Red", slug: "blooming_saffron_red", edge: 0x4f0f26, side: 0x5c1c34, top: 0x521830, stand: 0x470820, mark: "light" },
  { name: "Blooming Saffron Blue", slug: "blooming_saffron_blue", edge: 0x0f1c30, side: 0x263546, top: 0x212f3f, stand: 0x243444, mark: "light" },
  { name: "Elegant Inox", slug: "elegant_inox", edge: 0x7d8087, side: 0x80838a, top: 0x75787e, stand: 0x383b42, mark: "dark", doorMetal: 0.45 },
  { name: "Urban Tropical Blue", slug: "urban_tropical_blue", edge: 0x10164a, side: 0x263546, top: 0x212f3f, stand: 0x303135, mark: "light" },
  { name: "Urban Tropical Red", slug: "urban_tropical_red", edge: 0x3e1520, side: 0x392c3b, top: 0x332734, stand: 0x303135, mark: "light" },
].map((f) => ({ ...f, variant: f.name }));
const F0 = FIN[0];
// satin, mostly metal, no coat (as the RR24: a glossy coat mirrored the studio's tall light and washed the print pale)
// The Inox's plain steel print reads too dark at 0.7 next to Samsung's light silver photos: 0.45 for it
const DOOR = { metal: 0.7, rough: 0.5, coat: null };

// ── materials ──
const doorFace = mat("DoorFace", 0xffffff, { metal: DOOR.metal, rough: DOOR.rough });
const doorEdge = mat("DoorEdge", F0.edge, { metal: 0, rough: 0.35 });
const sidePaint = mat("SidePaint", F0.side, { metal: 0.3, rough: 0.5 });
const topPaint = mat("TopPaint", F0.top, { metal: 0.15, rough: 0.65 });
const standM = mat("StandPlastic", F0.stand, { rough: 0.6 });
const standFront = mat("StandFront", 0xffffff, { rough: 0.5 });
const markM = mat("SamsungMark", 0xffffff, { rough: 0.45, opacity: 0.999 });
const badgeM = mat("InverterBadge", 0xffffff, { rough: 0.45, opacity: 0.999 });
const rearM = mat("SafeCleanBack", 0x8a8d91, { metal: 0.3, rough: 0.55 });
const chrome = mat("Chrome", 0xd4d7db, { metal: 1, rough: 0.14 });
const dark = mat("DarkPlastic", 0x1d1e21, { rough: 0.7 });
const hingeM = mat("HingeCover", 0x222326, { rough: 0.55 });
const liner = mat("Liner", 0xf1f3f5, { rough: 0.6 });
const linerSide = mat("LinerSide", 0xe4e8ec, { rough: 0.65 });
const linerDk = mat("LinerGrey", 0xd5d9de, { rough: 0.6 });
const gasket = mat("Gasket", 0xc9cdd1, { rough: 0.85 });
const white = mat("WhitePlastic", 0xf6f7f8, { rough: 0.45 });
const clear = mat("ClearPlastic", 0xb9d3ea, { rough: 0.12, opacity: 0.5, side: THREE.DoubleSide });       // Samsung's blue-tinted clear parts
const clearLight = mat("ClearPlasticLight", 0xd6e6f4, { rough: 0.12, opacity: 0.3, side: THREE.DoubleSide });
const clearRib = mat("ClearRib", 0xc7dcef, { rough: 0.3, opacity: 0.92 });
const flapM = mat("FlapClear", 0xa9cdef, { rough: 0.15, opacity: 0.35, side: THREE.DoubleSide });      // the flap's light blue: the tubs show through it (stocked photo)
const frosted = mat("Frosted", 0xd7e6f3, { rough: 0.45, opacity: 0.8 });
const glass = mat("TemperedGlass", 0xa9cdd6, { rough: 0.05, opacity: 0.55, side: THREE.DoubleSide });
const glassRim = mat("ShelfRim", 0xe3e7ea, { rough: 0.45 });
const edgeGreen = mat("GlassEdge", 0x7fa7b0, { rough: 0.3 });
const lampM = mat("LedLamp", 0xffffff, { emissive: 0xf4f8ff, emissiveIntensity: 1.5 });
const knobM = mat("KnobBlue", 0x9cc6ea, { rough: 0.35 });
const PR = {};
for (const k of ["freeze", "fresh", "temp"]) PR[k] = mat("Print_" + k, 0xffffff, { rough: 0.5, opacity: 0.999 });
const stock = LGStock({ T3: `${TEX}/lg_glt3426`, TF: `${TEX}/food`, BR: `${TEX}/brands`, BRT: `${TEX}/brands/small` });

// ── small builders ──
const cyl = (name, rt, rb, h, m, x, y, z, seg = 16) => mesh(name, new THREE.CylinderGeometry(rt, rb, h, seg), m, x, y, z);
const plane = (name, w, h, m, x, y, z) => mesh(name, flipV(new THREE.PlaneGeometry(w, h)), m, x, y, z);
const rbox = (name, w, h, d, r, m, x, y, z) => mesh(name, mergeVertices(new RoundedBoxGeometry(w, h, d, 2, r)), m, x, y, z);
function flipFaces(geo) {
  const idx = geo.index;
  for (let i = 0; i < idx.count; i += 3) { const a = idx.getX(i + 1); idx.setX(i + 1, idx.getX(i + 2)); idx.setX(i + 2, a); }
  const n = geo.attributes.normal;
  for (let i = 0; i < n.count; i++) n.setXYZ(i, -n.getX(i), -n.getY(i), -n.getZ(i));
  return geo;
}
function leaveOut(grp, keep, why) {
  if (!grp) return;
  grp.updateMatrixWorld(true);
  const out = [];
  for (const c of [...grp.children]) if (keep.some((k) => new THREE.Box3().setFromObject(c).intersectsBox(k))) { out.push(c.name); c.removeFromParent(); }
  if (out.length) console.log(`left out (${why}): ${out.join(", ")}`);
}
const B3 = (x0, y0, z0, x1, y1, z1) => new THREE.Box3(new THREE.Vector3(x0, y0, z0), new THREE.Vector3(x1, y1, z1));
// a clear door pocket, open at the top; origin at its floor's middle on the face of the door's liner
function basket(name, w, dep, h) {
  const g = group(name, 0, 0, -linerFace);
  g.add(box(name + "Floor", w, 0.004, dep, clear, 0, 0.002, -dep / 2));
  g.add(box(name + "Lip", w, h * 0.85, 0.004, clear, 0, h * 0.425, -dep + 0.002));
  g.add(box(name + "EndL", 0.004, h, dep, clear, -w / 2 + 0.002, h / 2, -dep / 2));
  g.add(box(name + "EndR", 0.004, h, dep, clear, w / 2 - 0.002, h / 2, -dep / 2));
  g.add(box(name + "Rim", w, 0.007, 0.006, clearRib, 0, h * 0.85 - 0.0035, -dep + 0.003));
  return g;
}

const root = group("SamsungRR20");
const cab = group("Cabinet");
root.add(cab);

// ── the base stand: in the body's colour, its sides flaring 6.5 mm out to the floor (549 mm against the cabinet's 536),
// four feet; the front is the drawer (below) ──
const zStandBack = zCabBack + 0.004;
{
  const dz = zNose - 0.006 - zStandBack, zc = (zNose - 0.006 + zStandBack) / 2, hS = standTop - footH;
  const tilt = Math.atan2(0.0065, hS);
  for (const sx of [-1, 1]) {
    // its outer face from the cabinet's side (268 mm out) at the top to 274.5 mm at the floor: 549 mm across (Samsung)
    const s = box("StandSide", 0.012, hS / Math.cos(tilt), dz, standM, sx * (W / 2 - 0.00325 - 0.006), footH + hS / 2, zc);
    s.rotation.z = sx * tilt;
    cab.add(s);
  }
  cab.add(box("StandBack", Wc - 0.012, hS, 0.006, standM, 0, footH + hS / 2, zStandBack + 0.003));
  cab.add(box("StandFloor", Wc - 0.012, 0.006, dz, dark, 0, footH + 0.003, zc));
  cab.add(box("StandTop", Wc - 0.012, 0.006, dz - 0.03, standM, 0, standTop - 0.003, zc - 0.015));
  // the feet: 36 mm square, 11 mm tall, at the four corners (fronts)
  for (const sx of [-1, 1]) for (const z of [zNose - 0.03, zStandBack + 0.025]) cab.add(box("StandFoot", 0.036, footH, 0.036, dark, sx * (W / 2 - 0.022), footH / 2, z));
}

// ── cabinet shell ──
const shellH = cabTop - standTop, shellMid = standTop + shellH / 2, Dc = zFront - zCabBack, zMid = (zFront + zCabBack) / 2;
cab.add(faced("SideLeft", wall, shellH, Dc, [linerSide, sidePaint, topPaint, standM, sidePaint, dark], -Wc / 2 + wall / 2, shellMid, zMid));
cab.add(faced("SideRight", wall, shellH, Dc, [sidePaint, linerSide, topPaint, standM, sidePaint, dark], Wc / 2 - wall / 2, shellMid, zMid));
cab.add(faced("Top", inW, cabTop - ceil, Dc, [liner, liner, topPaint, liner, sidePaint, dark], 0, (cabTop + ceil) / 2, zMid));
cab.add(faced("Base", inW, floorIn - standTop, Dc, [liner, liner, liner, standM, sidePaint, dark], 0, standTop + (floorIn - standTop) / 2, zMid));
cab.add(faced("BackWall", inW, ceil - floorIn, zIn - zCabBack, [liner, liner, liner, liner, liner, dark], 0, (ceil + floorIn) / 2, (zIn + zCabBack) / 2));
// the back: Samsung's "Safe Clean Back", a smooth cover over the components, wiped clean (the feature's own words; no
// rear photo of this model exists, so it is a plain cover in the feature picture's grey: ESTIMATED)
cab.add(box("SafeCleanBack", Wc - 0.004, shellH - 0.004, 0.003, rearM, 0, shellMid, zCabBack + 0.0015));
// the hinges on the right: the black top plate on the cabinet's top at the front (ESTIMATED, as the RR24: 110 mm across,
// 15 mm tall) and the bottom bracket under the door's right corner
cab.add(box("HingeCoverTop", 0.11, 0.015, 0.07, hingeM, Wc / 2 - 0.055, cabTop + 0.0075, zFront - 0.025));
cab.add(box("HingeBottom", 0.035, 0.006, 0.06, dark, Wc / 2 - 0.0175, standLip + 0.003, zFront + 0.025));
// the back: Samsung publishes no rear photo of this model and its manual draws no cord, so, as the RR24, no
// cord or plug is drawn (none may show from the front, a 3/4 or the side)

// ── inside: the freezer box, its flap, the knob panel, the drip tray, the lamp ──
const xL = -inW / 2, xR = inW / 2, wt = 0.008;
// the cover over the box: white; a row of eight slots along the frame over the flap (open photo)
cab.add(box("VentPanel", inW, ceil - fbTop, fbZ1 - zIn, white, 0, (ceil + fbTop) / 2, (fbZ1 + zIn) / 2));
cab.add(mesh("VentSlots", mergeGeometries([...Array(8)].map((_, i) => new THREE.BoxGeometry(0.036, 0.005, 0.002).translate((flX0 + flX1) / 2 + (i - 3.5) * 0.046, 1.2125, fbZ1 + 0.001))), dark));
const panelX0 = flX1 + 0.002;
{
  const zc = (zIn + fbZ1) / 2, d = fbZ1 - zIn, h = fbTop - fbBot;
  cab.add(box("FreezerBoxFloor", panelX0 - xL, wt, d, white, (xL + panelX0) / 2, fbBot + wt / 2, zc));
  cab.add(box("FreezerFrameL", flX0 - xL, h, 0.012, white, (xL + flX0) / 2, (fbBot + fbTop) / 2, fbZ1 - 0.006));
  cab.add(box("FreezerFrameTop", flX1 - flX0, fbTop - flY1, 0.012, white, (flX0 + flX1) / 2, (fbTop + flY1) / 2, fbZ1 - 0.006));
  cab.add(box("FreezerFrameBot", flX1 - flX0, flY0 - fbBot, 0.012, white, (flX0 + flX1) / 2, (fbBot + flY0) / 2, fbZ1 - 0.006));
  // the box's back: light grey, with "Super Freeze Zone" across it (130 mm wide)
  cab.add(box("FreezerBack", panelX0 - xL, h - wt, 0.004, linerDk, (xL + panelX0) / 2, (fbBot + fbTop + wt) / 2, zIn + 0.002));
  cab.add(plane("PrintFreeze", 0.1385, 0.0185, PR.freeze, -0.008, 1.123, zIn + 0.0047));   // the PNG at 8 px per mm with its margin
  // the knob panel right of the flap (its left face the box's right wall): white, the blue knob in its ring at 1168 mm
  // (open photo), the words under it
  const px0 = panelX0, px1 = xR, pcx = (px0 + px1) / 2;
  cab.add(box("ControlPanel", px1 - px0, h, d, white, pcx, (fbBot + fbTop) / 2, zc));
  cab.add(plane("PanelPrint", 0.046, 0.15, PR.temp, pcx, 1.12, fbZ1 + 0.0007));
  const kx = pcx, ky = 1.195 - 0.027;
  const k = cyl("TempKnob", 0.0105, 0.0105, 0.012, knobM, kx, ky, fbZ1 + 0.006, 32);
  k.rotation.x = Math.PI / 2;
  cab.add(k);
  cab.add(box("KnobGrip", 0.004, 0.016, 0.004, white, kx, ky, fbZ1 + 0.0135));
}
// the flap: clear blue, hinged on its right edge, a shallow clear tray (the same flap as the RR24's: its sides 18 mm deep,
// ESTIMATED); they stop 3 mm inside its outline so its free edge's inner corner clears the frame as it swings
const flap = group("FreezerFlap", flX1, 0, fbZ1);
{
  const w = flX1 - flX0, yc = (flY0 + flY1) / 2, h = flY1 - flY0, sd = 0.018, st = 0.0025, ins = 0.003;
  flap.add(box("FlapPanel", w - 0.012, h - 0.012, 0.004, flapM, -w / 2, yc, 0.004));
  flap.add(box("FlapRimT", w, 0.006, 0.008, frosted, -w / 2, flY1 - 0.003, 0.004));
  flap.add(box("FlapRimB", w, 0.006, 0.008, frosted, -w / 2, flY0 + 0.003, 0.004));
  flap.add(box("FlapRimR", 0.006, h, 0.008, frosted, -0.003, yc, 0.004));
  flap.add(box("FlapRimL", 0.006, h, 0.008, frosted, -w + 0.003, yc, 0.004));
  // the tray's sides, one clear mesh: top and bottom across, left and right between them
  const sides = [
    new THREE.BoxGeometry(w - 2 * ins, st, sd).translate(-w / 2, flY1 - ins - st / 2, -sd / 2),
    new THREE.BoxGeometry(w - 2 * ins, st, sd).translate(-w / 2, flY0 + ins + st / 2, -sd / 2),
    new THREE.BoxGeometry(st, h - 2 * ins - 2 * st, sd).translate(-ins - st / 2, yc, -sd / 2),
    new THREE.BoxGeometry(st, h - 2 * ins - 2 * st, sd).translate(-w + ins + st / 2, yc, -sd / 2),
  ];
  flap.add(mesh("FlapSides", mergeGeometries(sides), flapM, 0, 0, 0));
  // the grip: a raised clear pocket on the flap's left (open photo: 40 mm wide, 100 mm tall)
  flap.add(box("FlapGrip", 0.04, 0.1, 0.008, frosted, -w + 0.034, yc + 0.01, 0.006));
}
cab.add(flap);
// the ice tray (Samsung: "Icemaker: Ice Tray"): milky clear, lying lengthwise at the front left of the box floor, as the
// RR24's (110 x 35 x 220 mm, ESTIMATED), two rows of cube wells
const iceM = mat("IceTray", 0xedf1f4, { rough: 0.35, opacity: 0.85 });
const ITx0 = xL + 0.012, ITw = 0.11, ITh = 0.035, ITd = 0.22, ITz1 = fbZ1 - 0.02, ITy = fbBot + wt;
{
  const g = [], cx = ITx0 + ITw / 2, cz = ITz1 - ITd / 2;
  g.push(new THREE.BoxGeometry(ITw, 0.006, ITd).translate(cx, ITy + 0.003, cz));
  for (const sx of [-1, 1]) g.push(new THREE.BoxGeometry(0.004, ITh, ITd).translate(cx + sx * (ITw / 2 - 0.002), ITy + ITh / 2, cz));
  for (const sz of [-1, 1]) g.push(new THREE.BoxGeometry(ITw, ITh, 0.004).translate(cx, ITy + ITh / 2, cz + sz * (ITd / 2 - 0.002)));
  g.push(new THREE.BoxGeometry(0.003, ITh - 0.004, ITd - 0.008).translate(cx, ITy + (ITh - 0.004) / 2, cz));
  for (let k = 1; k < 8; k++) g.push(new THREE.BoxGeometry(ITw - 0.008, ITh - 0.006, 0.003).translate(cx, ITy + (ITh - 0.006) / 2, cz - ITd / 2 + k * ITd / 8));
  cab.add(mesh("IceTray", mergeGeometries(g), iceM));
}
// the drip tray under the box
cab.add(box("DripTray", inW - 0.004, dripTop - dripBot, fbZ1 - 0.006 - zIn, white, 0, (dripBot + dripTop) / 2, (fbZ1 - 0.006 + zIn) / 2));
cab.add(box("DripTrayLip", inW - 0.004, 0.006, 0.006, linerDk, 0, dripTop - 0.003, fbZ1 - 0.003));
// the bulb lamp ("Clear View Lamp") on the back wall under the chiller tray: a white housing 60 x 52 mm with its clear
// lit cover (open photo), and the drain spout at the left (open photo)
cab.add(box("LampHousing", 0.06, 0.052, 0.022, white, 0.007, 0.893, zIn + 0.011));
cab.add(rbox("LedLampCover", 0.044, 0.034, 0.008, 0.003, lampM, 0.007, 0.891, zIn + 0.024));
cab.add(box("DrainCup", 0.033, 0.041, 0.025, white, -0.1665, 0.8745, zIn + 0.0125));

// ── what comes out (FridgeTrays): the chiller tray, the glass shelves, the vegetable box ──
const trays = group("FridgeTrays");
cab.add(trays);
function rails(name, yTop, z0, z1) { for (const sx of [-1, 1]) cab.add(box(name, 0.01, 0.01, z1 - z0, linerDk, sx * (inW / 2 - 0.005), yTop - 0.01 - 0.0035, (z0 + z1) / 2)); }
function shelf(name, y) {
  const g = group(name, 0, y, 0), bd = frontFridge - 0.0085 - zIn - 0.012;
  g.add(box(name + "Glass", inW - 0.012, 0.006, bd, glass, 0, -0.003, zIn + bd / 2 + 0.012));
  g.add(box(name + "Rim", inW - 0.012, 0.014, 0.012, glassRim, 0, -0.004, frontFridge - 0.006));
  g.add(box(name + "Edge", inW - 0.012, 0.004, 0.003, edgeGreen, 0, -0.008, frontFridge + 0.0015));
  g.add(box(name + "RimBack", inW - 0.012, 0.01, 0.01, glassRim, 0, -0.006, zIn + 0.017));
  trays.add(g);
  rails(name + "Rail", y - 0.006, zIn, frontFridge - 0.012);
}
shelf("Shelf1", s1);
shelf("Shelf2", s2);
// the chiller tray: clear blue, its raised middle grip at the front (open photo)
const ctZ0 = zIn + 0.012, ctW = inW - 0.014, ctZ = (ctZ0 + ctZ1) / 2;
{
  const hh = ctTop - ctBot;
  trays.add(box("ChillFloor", ctW, 0.004, ctZ1 - ctZ0, clear, 0, ctBot + 0.002, ctZ));
  for (const sx of [-1, 1]) trays.add(box("ChillSide", 0.004, hh, ctZ1 - ctZ0, clear, sx * (ctW / 2 - 0.002), ctBot + hh / 2, ctZ));
  trays.add(box("ChillBack", ctW, hh, 0.004, clear, 0, ctBot + hh / 2, ctZ0 + 0.002));
  trays.add(box("ChillFront", ctW, hh * 0.7, 0.004, clear, 0, ctBot + hh * 0.35, ctZ1 - 0.002));
  trays.add(box("ChillGrip", 0.2, 0.012, 0.012, frosted, 0, ctBot + hh * 0.7, ctZ1 - 0.004));
  for (const sx of [-1, 1]) cab.add(box("ChillRunner", 0.006, 0.006, ctZ1 - ctZ0, linerDk, sx * (inW / 2 - 0.003), ctBot - 0.003, ctZ));
}
// the vegetable box's cover (glass, a frosted front band) and the vegetable box with "BIO Fresh Zone" on its front and a
// grip in its middle (FzBox* are the names qa_bounds reads)
{
  const bd = frontFridge - 0.004 - zIn - 0.004;
  cab.add(box("CrisperCover", inW - 0.012, 0.005, bd, glass, 0, coverY - 0.0025, zIn + 0.004 + bd / 2));
  cab.add(box("CrisperCoverBand", inW - 0.012, 0.02, 0.012, frosted, 0, coverY - 0.01, frontFridge - 0.006));
  rails("CrisperCoverRail", coverY - 0.006, zIn, frontFridge - 0.012);
}
const vbW = inW - 0.016, vbZ0 = zIn + 0.008, vbZ1 = frontFridge, vbD = vbZ1 - vbZ0, vbZ = (vbZ0 + vbZ1) / 2;
{
  const hh = vbTop - vbBot, hf = vbLip - vbBot;
  trays.add(box("FzBoxFloor", vbW, 0.004, vbD, clear, 0, vbBot + 0.002, vbZ));
  trays.add(box("FzBoxBack", vbW, hh, 0.004, clear, 0, vbBot + hh / 2, vbZ0 + 0.002));
  trays.add(box("FzBoxL", 0.004, hh, vbD, clear, -vbW / 2 + 0.002, vbBot + hh / 2, vbZ));
  trays.add(box("FzBoxR", 0.004, hh, vbD, clear, vbW / 2 - 0.002, vbBot + hh / 2, vbZ));
  trays.add(box("FzBoxFront", vbW, hf, 0.004, clearLight, 0, vbBot + hf / 2, vbZ1 - 0.002));
  trays.add(box("FzBoxRim", vbW + 0.006, 0.01, 0.008, frosted, 0, vbLip - 0.005, vbZ1 - 0.002));
  trays.add(box("FzBoxGrip", 0.12, 0.09, 0.006, frosted, 0, vbLip - 0.06, vbZ1 + 0.001));
  trays.add(plane("PrintFresh", 0.1275, 0.0165, PR.fresh, 0, 0.347, vbZ1 + 0.0025));
}

// ── the base stand's drawer: its front is the stand's whole face (as the RR24's), with the grip notch at its top middle
// (fronts: 254 mm wide, about 30 mm deep) and SAMSUNG embossed (fronts) ──
const drawer = group("BaseDrawer");
cab.add(drawer);
const fwTop = Wc + 0.004, fwBot = W - 0.004, fy0 = footH + 0.002, fy1 = standLip;
const notchW = 0.254, notchH = 0.03;
{
  // the face, trapezoid with the notch, UVs straight on from the front photo
  const hw = (y) => (fwBot + (fwTop - fwBot) * (y - fy0) / (fy1 - fy0)) / 2;
  const sh = new THREE.Shape();
  sh.moveTo(-hw(fy0), fy0); sh.lineTo(hw(fy0), fy0); sh.lineTo(hw(fy1), fy1);
  sh.lineTo(notchW / 2 + 0.008, fy1); sh.quadraticCurveTo(notchW / 2, fy1, notchW / 2, fy1 - 0.008);
  sh.lineTo(notchW / 2, fy1 - notchH + 0.006); sh.quadraticCurveTo(notchW / 2, fy1 - notchH, notchW / 2 - 0.006, fy1 - notchH);
  sh.lineTo(-notchW / 2 + 0.006, fy1 - notchH); sh.quadraticCurveTo(-notchW / 2, fy1 - notchH, -notchW / 2, fy1 - notchH + 0.006);
  sh.lineTo(-notchW / 2, fy1 - 0.008); sh.quadraticCurveTo(-notchW / 2, fy1, -notchW / 2 - 0.008, fy1);
  sh.lineTo(-hw(fy1), fy1); sh.lineTo(-hw(fy0), fy0);
  const g = new THREE.ShapeGeometry(sh, 6);
  const p = g.attributes.position, uv = g.attributes.uv;
  for (let i = 0; i < p.count; i++) uv.setXY(i, (p.getX(i) + fwBot / 2) / fwBot, 1 - (fy1 - p.getY(i)) / (fy1 - fy0));
  flipV(g);
  drawer.add(mesh("DrawerFace", g, standFront, 0, 0, zNose));
  // the face's thickness round its edge, and the notch's floor and back (the grip)
  drawer.add(box("DrawerFaceBack", fwBot - 0.01, fy1 - fy0, 0.012, standM, 0, (fy0 + fy1) / 2, zNose - 0.008));
  drawer.add(box("DrawerGripFloor", notchW, 0.004, 0.03, dark, 0, fy1 - notchH - 0.002, zNose - 0.015));
  drawer.add(box("DrawerGripBack", notchW, notchH, 0.004, dark, 0, fy1 - notchH / 2, zNose - 0.03));
  for (const sx of [-1, 1]) drawer.add(box("DrawerFaceEnd", 0.006, fy1 - fy0, 0.012, standM, sx * (fwTop / 2 - 0.003), (fy0 + fy1) / 2, zNose - 0.0065));
}
// the bin behind it: in the stand's colour (Samsung's CR photo of the drawer pulled out: a maroon lattice basket), between
// the stand's sides
const dbW = Wc - 0.05, dbZ0 = zStandBack + 0.03, dbZ1 = zNose - 0.034, dbFloor = footH + 0.012, dbTop = standTop - 0.012;
{
  const zc = (dbZ0 + dbZ1) / 2, d = dbZ1 - dbZ0;
  drawer.add(box("DrawerBinFloor", dbW, 0.004, d, standM, 0, dbFloor - 0.002, zc));
  // the sides: open lattice, as Samsung's photo of the RR24's drawer pulled out shows (the same Base Stand Drawer; no
  // photo of this one open): two rows of upright slots along each side (ESTIMATED), built from the bands and the posts
  const hS = dbTop - dbFloor + 0.004, y0 = dbFloor - 0.002, sw = 0.008, sh = 0.024, pitch = 0.02, end = 0.03;
  const r1 = y0 + 0.03, r2 = r1 + sh + 0.008, n = Math.floor((d - 2 * end + (pitch - sw)) / pitch);
  const z0 = zc - ((n - 1) * pitch + sw) / 2;                          // the first slot's back edge, the rows centred
  for (const sx of [-1, 1]) {
    const x = sx * (dbW / 2 - 0.002), g = [];
    const band = (ya, yb) => g.push(new THREE.BoxGeometry(0.004, yb - ya, d).translate(x, (ya + yb) / 2, zc));
    band(y0, r1); band(r1 + sh, r2); band(r2 + sh, y0 + hS);
    for (const ra of [r1, r2]) {
      // the posts: the solid ends, then one between each pair of slots
      g.push(new THREE.BoxGeometry(0.004, sh, z0 - (zc - d / 2)).translate(x, ra + sh / 2, (z0 + zc - d / 2) / 2));
      const zl = z0 + (n - 1) * pitch + sw;
      g.push(new THREE.BoxGeometry(0.004, sh, zc + d / 2 - zl).translate(x, ra + sh / 2, (zl + zc + d / 2) / 2));
      for (let i = 0; i < n - 1; i++) g.push(new THREE.BoxGeometry(0.004, sh, pitch - sw).translate(x, ra + sh / 2, z0 + i * pitch + sw + (pitch - sw) / 2));
    }
    drawer.add(mesh("DrawerBinSide", mergeGeometries(g), standM, 0, 0, 0));
  }
  drawer.add(box("DrawerBinBack", dbW, dbTop - dbFloor + 0.004, 0.004, standM, 0, (dbTop + dbFloor - 0.004) / 2, dbZ0 + 0.002));
  drawer.add(box("DrawerBinFront", dbW, dbTop - dbFloor + 0.004, 0.004, standM, 0, (dbTop + dbFloor - 0.004) / 2, dbZ1 - 0.002));
}

// ── stock: vegetarian South Indian food, eggs, juices, water and soft drinks (stock_lg.mjs, food.mjs) ──
// two shelves, so the stock's third shelf goes on the vegetable box's glass cover (as the RR21's)
stock.shelves(trays, {
  zIn1: zIn, inW, inD: frontFridge - zIn, s1: s1 - 0.0005, s2: s2 - 0.0005, s3: coverY - 0.0005, fz: vbBot + 0.004, fit: true, vz0: vbZ0 + 0.02, vk: 0.75,
  shelfB: { hw: inW / 2 - 0.03, z0: zIn + 0.022, z1: frontFridge - 0.015 },
  drawerB: { hw: vbW / 2 - 0.014, z0: vbZ0 + 0.02, z1: vbZ1 - 0.008, y0: vbBot + 0.004 },
  drawerCeil: coverY - 0.005 - 0.01 - (vbBot + 0.004),
});
// boxes as qa_fit reads them (each part's own box, turned with it)
const bbox = (o) => { o.updateWorldMatrix(true, true); return new THREE.Box3().setFromObject(o); };
const kids = (g, name) => g.children.filter((o) => o.name === name);
const drop = (why, ...os) => { const n = os.filter(Boolean); n.forEach((o) => o.parent?.remove(o)); if (n.length) console.log(`left out (${why}): ${n.map((o) => o.name).join(", ")}`); };
if (process.env.RR20_SIZES) for (const n of ["Shelf1Stock", "Shelf2Stock", "Shelf3Stock", "F0Stock", "FreshZoneStock"]) for (const o of (trays.getObjectByName(n)?.children || [])) { const b = bbox(o); console.log(n, o.name, ...["x", "y", "z"].map((k) => ((b.max[k] - b.min[k]) * 1000).toFixed(0)), "at", ...["x", "y", "z"].map((k) => (b.min[k] * 1000).toFixed(0))); }
// a row across the shelf, spaced by the items' real widths, their backs at z0; returns the row's depth
function row(items, x0, x1, z0) {
  items = items.filter(Boolean);
  const bs = items.map(bbox), w = bs.reduce((s, b) => s + b.max.x - b.min.x, 0), gap = (x1 - x0 - w) / (items.length + 1);
  if (gap < 0.006) console.warn(`row: ${items.map((o) => o.name)} leave ${(gap * 1000).toFixed(0)} mm between them`);
  let x = x0 + gap, dep = 0;
  items.forEach((o, i) => { const b = bs[i]; o.position.x += x - b.min.x; if (z0 !== undefined) o.position.z += z0 - b.min.z; x += b.max.x - b.min.x + gap; dep = Math.max(dep, b.max.z - b.min.z); });
  return dep;
}
{
  const hw = inW / 2 - 0.03, z0 = zIn + 0.022;
  { // top shelf, 141 mm under the chiller tray, 30 mm off the back wall (the lamp and the drain spout stand there): the
    // tiffin, the milk and the buttermilk, then the batter; the biryani box has no room left in front
    const g = trays.getObjectByName("Shelf1Stock");
    const milk = g.getObjectByName("NandiniMilk"), pile = ["AavinMilk", "AmulTaazaPouch"].map((n) => g.getObjectByName(n)).filter(Boolean), m0 = milk.position.clone();
    drop("no room in front on the top shelf", g.getObjectByName("RnrBiryaniBox"));
    const d1 = row([g.getObjectByName("Tiffin"), milk, g.getObjectByName("MastiButtermilk")], -hw, hw, z0 + 0.03);
    const d = milk.position.clone().sub(m0);
    pile.forEach((o) => o.position.add(d));
    row([g.getObjectByName("IdBatterPouch1")], -hw, hw, z0 + 0.03 + d1 + 0.012);
  }
  { // middle shelf (113 mm clear): the two sweet boxes at the back, the coconut and the melon in front
    const g = trays.getObjectByName("Shelf2Stock");
    drop("no room on the lower shelf", g.getObjectByName("RnrBiryani"));
    const d1 = row([g.getObjectByName("NandhanaPalace"), g.getObjectByName("NandhanaPalace2")], -hw, hw, z0);
    row([g.getObjectByName("CoconutHalf"), g.getObjectByName("WatermelonHalf")], -hw, hw, z0 + d1 + 0.012);
  }
  { // on the vegetable box's cover (168 mm clear): bananas and curd at the back, grapes, apples, an orange and a lemon in front
    const g = trays.getObjectByName("Shelf3Stock");
    const [a0, a1] = kids(g, "Apple"), [o0] = kids(g, "Orange");
    const keep = new Set([a0, a1, o0, g.getObjectByName("Bananas"), g.getObjectByName("Grapes"), g.getObjectByName("AmulMastiDahi")]);
    drop("one row of fruit on the 471 mm cover", ...g.children.filter((o) => !keep.has(o)));
    const d1 = row([g.getObjectByName("Bananas"), g.getObjectByName("AmulMastiDahi")], -hw, hw, z0);
    row([g.getObjectByName("Grapes"), a0, o0, a1], -hw, hw, z0 + d1 + 0.012);
  }
}
// what is too tall for the space over its shelf, or reaches past the shelf's sides or front, is left out
{
  const shw = inW / 2 - 0.03;
  const over = { Shelf1Stock: ctBot - 0.012, Shelf2Stock: s1 - 0.0145 - 0.01, Shelf3Stock: s2 - 0.0145 - 0.01 };
  for (const [n, top] of Object.entries(over)) leaveOut(trays.getObjectByName(n), [B3(-1, 0, frontFridge - 0.014, 1, 2, 1), B3(-1, 0, -1, -shw - 0.003, 2, 1), B3(shw + 0.003, 0, -1, 1, 2, 1), B3(-1, top, -1, 1, 3, 1)], `too tall for ${n}'s space, or past its sides or front`);
  leaveOut(trays.getObjectByName("FreshZoneStock"), [B3(-1, coverY - 0.015, -1, 1, 3, 1), B3(-1, 0, vbZ1 - 0.006, 1, 3, 1)], "over the vegetable box's top or past its front");
}
// the cauliflower's parts are tilted, so their boxes, turned with them, reach under the vegetable box's floor though
// the cauliflower rests on it: the tilts are baked into the parts so the boxes that qa_bounds reads fit them
trays.getObjectByName("Cauliflower")?.traverse((m) => {
  if (!m.isMesh) return;
  m.updateMatrix(); m.geometry = m.geometry.clone().applyMatrix4(m.matrix);
  m.position.set(0, 0, 0); m.rotation.set(0, 0, 0); m.scale.set(1, 1, 1);
});
// the chiller tray: butter, cheese and curd cups
stock.fresh0(trays, { y: ctBot + 0.004, z: ctZ, bx: -0.17, cx: 0.09, ex: -0.03 });
leaveOut(trays.getObjectByName("F0Stock"), [B3(-1, ctTop + 0.012, -1, 1, 3, 1)], "too tall for the chiller tray");
// the freezer box: the two tubs stacked and the frozen packs beside them
stock.freezer(cab, { fit: true, zIn1: zIn, floor: fbBot + wt, top: fbTop, box: { hw: (flX1 - xL) / 2 - 0.02, z0: zIn + 0.02, z1: fbZ1 - 0.02 } });
{
  const f = cab.getObjectByName("FreezerStock");
  if (f) f.position.x += (xL + flX1) / 2 - 0.005;
  cab.getObjectByName("OnFreezerShelf")?.removeFromParent();
  // the ice tray at the front left, an ice-cream tub at the back right (the box is 172 mm tall inside: room for one of the
  // two 87 mm tubs, the other is left out); the parotta packs and peas are left out (they would hide the tub or the print)
  {
    drop("the box has room for one tub", f.getObjectByName("AmulRajbhog"));
    const tubs = [f.getObjectByName("AmulVanillaMagic")], packs = [f.getObjectByName("ViswasParotta"), f.getObjectByName("NityaParotta")];
    const bz0 = zIn + 0.02, fl = fbBot + wt, bx1 = flX1 - 0.007;
    let y = fl;
    for (const t of tubs) { const b = bbox(t); t.position.x += bx1 - b.max.x; t.position.z += bz0 - b.min.z; t.position.y += y - b.min.y; y = bbox(t).max.y + 0.0005; }
    drop("they would hide the tubs or the box's print", ...packs, f.getObjectByName("FreshoGreenPeas"));
  }
  if (process.env.RR20_SIZES) for (const o of f.children) { const b = new THREE.Box3().setFromObject(o); console.log("Freezer", o.name, ...["x", "y", "z"].map((k) => ((b.max[k] - b.min[k]) * 1000).toFixed(0)), "at", ...["x", "y", "z"].map((k) => (b.min[k] * 1000).toFixed(0))); }
  leaveOut(f, [B3(-1, fbTop - wt - 0.008, -1, 1, 3, 1), B3(-1, 0, fbZ1 - 0.012, 1, 3, 1), B3(flX1 - 0.006, 0, -1, 1, 3, 1)], "past the freezer box");
}
// the base drawer: onions on the left, potatoes on the right (Samsung: "such as potatoes and onions"); copies of the
// vegetable box's own
{
  const fz = trays.getObjectByName("FreshZoneStock");
  const on = fz.children.filter((o) => o.name === "Onion"), po = fz.children.filter((o) => o.name === "Potato");
  const place = (src, name, xs, zs) => {
    let k = 0;
    for (const z of zs) for (const x of xs) {
      const o = src[k++ % src.length].clone();
      o.name = name; o.position.set(x, 0, z); o.rotation.y = 0.7 * k;
      drawer.add(o);
      o.updateMatrixWorld(true);
      const b = new THREE.Box3().setFromObject(o);
      o.position.y += dbFloor + 0.0005 - b.min.y;
    }
  };
  if (on.length) place(on, "Onion", [-0.19, -0.11], [0.05, 0.15]);
  if (po.length) place(po, "Potato", [0.11, 0.19], [0.05, 0.15]);
}

// ── the door: hinged on the right; the Grandé front: an arched crown that rolls back, rounded sides, the recessed line ──
const SK = { a: 0.026, b: 0.016, at: 0.045, bt: 0.042, ab: 0.004, bb: 0.004 };
const CROWN = 0.028, CROWN_N = 3.5;   // the top falls 28 mm from the middle to the corners as (|x| / half)^3.5 (the same Grandé door as the RR24's; the fronts agree)
const yTop = (x) => dh - CROWN * Math.pow(Math.min(1, Math.abs(x) / (pw / 2)), CROWN_N);
// the recessed line: 20 mm tall at 575 mm from the floor, from 241 mm left of the middle to 249 mm right (fronts),
// 2.5 mm deep with rounded ends (ESTIMATED: the photo's shading reads as a groove lit from above)
const GR = { y: 0.575 - doorBot, h: 0.02, x0: -0.241, x1: 0.249, dep: 0.0025, end: 0.012 };
const ell = (d, a, b) => (d >= a ? 0 : b * (1 - Math.sqrt(Math.max(0, 1 - (1 - d / a) ** 2))));
function groove(x, y) {
  const dy = Math.abs(y - GR.y) / (GR.h / 2);
  if (dy >= 1 || x < GR.x0 || x > GR.x1) return 0;
  const e = Math.min(1, (x - GR.x0) / GR.end, (GR.x1 - x) / GR.end);
  return GR.dep * 0.5 * (1 + Math.cos(Math.PI * dy)) * Math.sqrt(Math.max(0, e));
}
// the face's depth at (x across from the door's middle, y up from its foot), as doorSkin builds it
const skinZ = (x, y) => T_ - Math.max(ell(pw / 2 - Math.abs(x), SK.a, SK.b), ell(yTop(x) - y, SK.at, SK.bt), ell(y, SK.ab, SK.bb)) - groove(x, y);
// a decal that lies on the face where it rolls back (the badge sits in the crown's fall): a grid over (x0..x1, y0..y1),
// each point lifted off the face by "lift" along the face's own normal
function decalOnSkin(name, m, cx, cy, w, h, lift = 0.0008, nx = 12, ny = 16) {
  const pos = [], uv = [], idx = [], e = 0.0005;
  for (let j = 0; j <= ny; j++) for (let i = 0; i <= nx; i++) {
    const x = cx - w / 2 + (w * i) / nx, y = cy + h / 2 - (h * j) / ny, z = skinZ(x, y);
    const dzx = (skinZ(x + e, y) - skinZ(x - e, y)) / (2 * e), dzy = (skinZ(x, y + e) - skinZ(x, y - e)) / (2 * e);
    const n = new THREE.Vector3(-dzx, -dzy, 1).normalize();
    pos.push(x + n.x * lift, y + n.y * lift, z + n.z * lift); uv.push(i / nx, j / ny);
  }
  for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) { const a = j * (nx + 1) + i, b = a + nx + 1; idx.push(a, b, a + 1, a + 1, b, b + 1); }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2)); g.setIndex(idx); g.computeVertexNormals();
  return mesh(name, g, m);
}
function doorSkin() {
  const w = pw, dense = (n) => [...Array(n + 1)].map((_, i) => 1 - Math.cos((i / n) * Math.PI / 2));
  const xs = [...new Set([
    ...dense(10).map((s) => -w / 2 + SK.a * s), ...[...Array(41)].map((_, i) => -w / 2 + SK.a + (w - 2 * SK.a) * i / 40), ...dense(10).map((s) => w / 2 - SK.a * s),
    ...[0, 0.25, 0.5, 0.75, 1].flatMap((s) => [GR.x0 + GR.end * s, GR.x1 - GR.end * s]),
  ].map((v) => +v.toFixed(6)))].sort((p, q) => p - q);
  const ySplit = dh - 0.12;
  // straight rows up to ySplit (dense round the line), then rows that follow the crown
  const ysLow = [...new Set([0, 0.002, 0.004, ...[...Array(31)].map((_, i) => 0.004 + (ySplit - 0.004) * i / 30),
    ...[...Array(13)].map((_, i) => GR.y - GR.h / 2 + GR.h * i / 12)].map((v) => +v.toFixed(6)))].sort((p, q) => p - q);
  const tUp = [...new Set([...[...Array(5)].map((_, i) => i / 8), ...dense(12).map((s) => 1 - 0.5 * s).filter((v) => v >= 0.5)].map((v) => +v.toFixed(6)))].sort((p, q) => p - q).slice(1);
  const nx = xs.length, rows = ysLow.length + tUp.length, pos = [], uv = [], idx = [];
  for (let j = 0; j < rows; j++) for (let i = 0; i < nx; i++) {
    const x = xs[i], y = j < ysLow.length ? ysLow[j] : ySplit + (yTop(x) - ySplit) * tUp[j - ysLow.length];
    const fall = Math.max(ell(w / 2 - Math.abs(x), SK.a, SK.b), ell(yTop(x) - y, SK.at, SK.bt), ell(y, SK.ab, SK.bb));
    pos.push(x, y, T_ - fall - groove(x, y)); uv.push((x + w / 2) / w, (dh - y) / dh);
  }
  for (let j = 0; j < rows - 1; j++) for (let i = 0; i < nx - 1; i++) { const a = j * nx + i; idx.push(a, a + 1, a + nx + 1, a, a + nx + 1, a + nx); }
  const ring = [];
  for (let i = 0; i < nx; i++) ring.push(i);
  for (let j = 1; j < rows; j++) ring.push(j * nx + nx - 1);
  for (let i = nx - 2; i >= 0; i--) ring.push((rows - 1) * nx + i);
  for (let j = rows - 2; j > 0; j--) ring.push(j * nx);
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2)); g.setIndex(idx); g.computeVertexNormals();
  return { geo: g, ring: ring.map((k) => [pos[3 * k], pos[3 * k + 1], pos[3 * k + 2]]) };
}
// the band round the door from the face's outline back to the door's back, and the back itself
function doorBand(ring) {
  const pos = [], idx = [], n = ring.length;
  ring.forEach((p) => pos.push(...p, p[0], p[1], 0));
  for (let k = 0; k < n; k++) { const k1 = (k + 1) % n, f0 = 2 * k, b0 = 2 * k + 1, f1 = 2 * k1, b1 = 2 * k1 + 1; idx.push(f0, b0, f1, f1, b0, b1); }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx); g.computeVertexNormals();
  const cap = flipFaces(new THREE.ShapeGeometry(new THREE.Shape(ring.map((p) => new THREE.Vector2(p[0], p[1])))));
  return { band: g, cap };
}
const fridgeDoor = group("FridgeDoor", Wc / 2 - 0.001, doorBot, zDoor);
{
  const { geo, ring } = doorSkin();
  geo.translate(-pw / 2, 0, 0);
  fridgeDoor.add(mesh("DoorFaceSkin", geo, doorFace));
  const { band, cap } = doorBand(ring);
  band.translate(-pw / 2, 0, 0); cap.translate(-pw / 2, 0, 0);
  fridgeDoor.add(mesh("DoorSides", band, doorEdge));
  fridgeDoor.add(mesh("DoorBack", cap, linerSide));
  // decals: SAMSUNG 69 mm wide, its middle 9 mm left of the door's middle and 87 mm under the crown; the Digital
  // Inverter badge 65 mm wide, its middle 197 mm right of the door's middle and 47 mm under the crown, where the crown
  // rolls back, so it follows the face (fronts). No energy label: the labels Samsung shows for this model ran to
  // 31 Dec 2025 (NOTES.md)
  const mk = C.mark, mw = 0.069 * mk.padded[0] / (mk.padded[0] - 20);
  const md = decalOnSkin("SamsungMarkDecal", markM, -0.009, dh - 0.087, mw, mw * mk.padded[1] / mk.padded[0], 0.0008, 8, 2);
  md.position.x = -pw / 2; fridgeDoor.add(md);
  const bw0 = 0.065, bh0 = bw0 / C.badge.aspect;
  const bd = decalOnSkin("InverterBadgeDecal", badgeM, 0.197, dh - 0.047, bw0, bh0, 0.0015, 10, 16);
  bd.position.x = -pw / 2; fridgeDoor.add(bd);
  // the handle: a bar 32 mm wide, chrome on its front and sides, black on the side that faces the door (the 3/4 views),
  // its front 20 mm proud of the face (Samsung: 64.0 cm deep with the handle, 62.0 without), 382 mm long from 97.5 mm
  // under the crown, its middle 49 mm in from the door's left edge; its rounded top curves back into the door, its foot
  // widens round the lock (fronts)
  const hx = -pw + 0.049, hTop = dh - 0.0975, hBot = dh - 0.480, L = hTop - hBot, bw = 0.032, bt = 0.012, rEnd = 0.06, Pz = 0.020 - bt / 2;
  const section = (w, y0, y1, r) => {
    const sh = new THREE.Shape();
    sh.moveTo(-w / 2 + r, y0); sh.lineTo(w / 2 - r, y0); sh.quadraticCurveTo(w / 2, y0, w / 2, y0 + r);
    sh.lineTo(w / 2, y1 - r); sh.quadraticCurveTo(w / 2, y1, w / 2 - r, y1); sh.lineTo(-w / 2 + r, y1);
    sh.quadraticCurveTo(-w / 2, y1, -w / 2, y1 - r); sh.lineTo(-w / 2, y0 + r); sh.quadraticCurveTo(-w / 2, y0, -w / 2 + r, y0);
    let g = new THREE.ExtrudeGeometry(sh, { depth: L, steps: 48, bevelEnabled: false, curveSegments: 4 });
    g.deleteAttribute("uv"); g.deleteAttribute("normal");
    g = mergeVertices(g);
    const q = g.attributes.position;
    for (let i = 0; i < q.count; i++) {
      const s = q.getZ(i) - L / 2, a = Math.abs(s), t = Math.max(0, (a - (L / 2 - rEnd)) / rEnd);
      const zc = Pz - (Pz + 0.008) * (1 - Math.sqrt(Math.max(0, 1 - t * t)));
      q.setXYZ(i, q.getX(i), s, q.getY(i) + zc);
    }
    g.computeVertexNormals();
    return g;
  };
  fridgeDoor.add(mesh("HandleBar", section(bw, -bt / 2 + 0.006, bt / 2, 0.007), chrome, hx, (hTop + hBot) / 2, T_));
  fridgeDoor.add(mesh("HandleBack", section(bw - 0.002, -bt / 2, -bt / 2 + 0.0068, 0.003), dark, hx, (hTop + hBot) / 2, T_));
  fridgeDoor.add(rbox("HandleFoot", 0.036, 0.078, 0.0195, 0.007, chrome, hx, hBot + 0.036, T_ + 0.00875));   // its foot covers the bar's end
  const lock = cyl("DoorLock", 0.0085, 0.0085, 0.005, chrome, hx, hBot + 0.047, T_ + 0.018, 28);
  lock.rotation.x = Math.PI / 2; lock.scale.set(1, 1, 2.7);
  fridgeDoor.add(lock);
  fridgeDoor.add(box("LockKeyhole", 0.008, 0.0015, 0.001, dark, hx, hBot + 0.036, T_ + 0.0208));
  // inside: the gasket in the gap, the liner, the pockets
  const lw2 = 0.45, ly0 = floorIn - doorBot, ly1 = ceil - doorBot;
  fridgeDoor.add(box("GasketT", pw - 0.04, 0.016, 0.008, gasket, -pw / 2, ly1 + 0.012, -0.004));
  fridgeDoor.add(box("GasketB", pw - 0.04, 0.016, 0.008, gasket, -pw / 2, 0.012, -0.004));
  fridgeDoor.add(box("GasketL", 0.016, ly1 + 0.004 - 0.02, 0.008, gasket, -pw + 0.022, (ly1 + 0.024) / 2, -0.004));
  fridgeDoor.add(box("GasketR", 0.016, ly1 + 0.004 - 0.02, 0.008, gasket, -0.022, (ly1 + 0.024) / 2, -0.004));
  fridgeDoor.add(box("DoorLiner", lw2, ly1 - ly0 - 0.004, 0.012, liner, -pw / 2, (ly0 + ly1) / 2, -linerFace + 0.006));
}
// pockets (Samsung: five transparent door pockets): the top one, the egg pair, the middle one, the bottle guard at the foot
const bkW = 0.43, half = (bkW - 0.01) / 2;
const addBasket = (n, w, b, x) => { const k = basket(n, w, b.d, b.h); k.position.x = x; k.position.y = b.y; fridgeDoor.add(k); };
addBasket("TopPocket", bkW, BK.top, -pw / 2);
addBasket("EggPocketL", half, BK.egg, -pw / 2 - (bkW - half) / 2);
addBasket("EggPocketR", half, BK.egg, -pw / 2 + (bkW - half) / 2);
addBasket("MiddlePocket", bkW, BK.middle, -pw / 2);
addBasket("BottleGuard", bkW, BK.bottle, -pw / 2);
// the egg cups in the pair (Samsung: egg tray)
for (const sx of [-1, 1]) fridgeDoor.add(box("EggCupsRib", half - 0.02, 0.006, 0.05, clearRib, -pw / 2 + sx * (bkW - half) / 2, BK.egg.y + 0.007, -linerFace - BK.egg.d / 2));
// three eggs in each half of the pair, clear of its end walls
const eggX = [-1, 1].flatMap((sx) => [-0.064, 0, 0.064].map((d) => -pw / 2 + sx * (bkW - half) / 2 + d));
{
  const inside = (dep) => [-pw / 2 - bkW / 2 + 0.006, -pw / 2 + bkW / 2 - 0.006, -(linerFace + dep / 2)];
  // from the top: cans, the eggs, jars, then the bottles and the cartons in the bottle guard
  const deps = { egg: BK.egg.d, jar: BK.middle.d, bottle: BK.bottle.d, can: BK.top.d };
  stock.doorFridge(fridgeDoor, { fit: true, eggY: BK.egg.y, eggX, jarY: BK.middle.y, botY: BK.bottle.y, canY: BK.top.y, deps, inside });
  const dx = fridgeDoor.position.x;
  const [x0, x1] = inside(BK.bottle.d);
  drop("the bottle guard is 418 mm wide inside", fridgeDoor.getObjectByName("AmulTaaza"));
  const bottles = ["RealMango", "RealMixedFruit", "Coke", "Fanta", "Bisleri"].map((n) => fridgeDoor.getObjectByName(n)).filter(Boolean);
  if (process.env.RR20_SIZES) for (const o of bottles) { const b = bbox(o); console.log("Door", o.name, ...["x", "y", "z"].map((k) => ((b.max[k] - b.min[k]) * 1000).toFixed(0))); }
  row(bottles, x0 + dx, x1 + dx);
}
root.add(fridgeDoor);

const parts = productParts(PRODUCTS, ID);
const clips = stateClips(root, parts);
saveZones(PRODUCTS, ID, root, parts);
const textures = {
  DoorFace: `${T}/door_${F0.slug}.jpg`, StandFront: `${T}/stand_${F0.slug}.jpg`, SamsungMark: `${T}/mark_${F0.mark}.png`, InverterBadge: `${T}/badge.png`,
  Print_freeze: `${T}/print_freeze.png`, Print_fresh: `${T}/print_fresh.png`, Print_temp: `${T}/print_temp.png`,
};
Object.assign(textures, stock.textures());
{ const used = new Set(); root.traverse((o) => o.isMesh && [].concat(o.material).forEach((m) => used.add(m.name))); for (const k of Object.keys(textures)) if (!used.has(k)) delete textures[k]; }
// Grain: the printed door carries none; the painted cabinet a soft peel, the stand's plastic a strong one, the back's
// cover a soft one. The decals carry none.
await exportGLB(root, clips, OUT, textures, { dir: `${TEX}/grain`, materials: {
  SidePaint: { type: "peel_soft" }, TopPaint: { type: "peel_soft" }, StandPlastic: { type: "peel_strong" }, SafeCleanBack: { type: "peel_soft" },
} });

// ── the colours as KHR_materials_variants ──
{
  const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
  const doc = await io.read(OUT);
  const R = doc.getRoot();
  const byName = (n) => R.listMaterials().find((m) => m.getName() === n);
  const texCache = new Map();
  const image = (file, name) => {
    if (!texCache.has(file)) texCache.set(file, R.listTextures().find((t) => t.getName() === name) ||
      doc.createTexture(name).setImage(new Uint8Array(fs.readFileSync(file))).setMimeType(file.endsWith(".png") ? "image/png" : "image/jpeg"));
    return texCache.get(file);
  };
  const varExt = doc.createExtension(KHRMaterialsVariants);
  const coatExt = DOOR.coat && (R.listExtensionsUsed().find((e) => e.extensionName === "KHR_materials_clearcoat") || doc.createExtension(KHRMaterialsClearcoat));
  const glossy = (m) => (DOOR.coat ? m.setExtension("KHR_materials_clearcoat", coatExt.createClearcoat().setClearcoatFactor(DOOR.coat[0]).setClearcoatRoughnessFactor(DOOR.coat[1])) : m);
  glossy(byName("DoorFace"));
  const hex = (c) => [((c >> 16) & 255) / 255, ((c >> 8) & 255) / 255, (c & 255) / 255].map((v) => Math.pow(v, 2.2));
  const VARY = ["DoorFace", "DoorEdge", "SidePaint", "TopPaint", "StandPlastic", "StandFront", "SamsungMark"];
  // a material is shared with the colour before it when that colour's value is the same (no copy)
  const same = (n, f, g) => (n === "SidePaint" ? f.side === g.side : n === "TopPaint" ? f.top === g.top : n === "StandPlastic" ? f.stand === g.stand : n === "SamsungMark" ? f.mark === g.mark : false);
  const base = Object.fromEntries(VARY.map((n) => [n, byName(n)]));
  for (const n of VARY) if (!base[n]) throw new Error(`no material ${n}`);
  const mats = [];
  FIN.forEach((f, i) => {
    const out = {};
    for (const n of VARY) {
      if (i === 0) { out[n] = base[n]; continue; }
      const k = FIN.slice(0, i).findIndex((g) => same(n, f, g));
      if (k >= 0) { out[n] = mats[k][n]; continue; }
      const m = base[n].clone().setName(`${n}_${f.slug}`);
      if (n === "DoorFace") glossy(m.setBaseColorTexture(image(`${T}/door_${f.slug}.jpg`, `DoorFace_${f.slug}`)).setBaseColorFactor([1, 1, 1, 1]));
      if (n === "DoorFace" && f.doorMetal != null) m.setMetallicFactor(f.doorMetal);
      if (n === "StandFront") m.setBaseColorTexture(image(`${T}/stand_${f.slug}.jpg`, `StandFront_${f.slug}`));
      if (n === "SamsungMark") m.setBaseColorTexture(image(`${T}/mark_${f.mark}.png`, `SamsungMark_${f.mark}`));
      if (n === "StandPlastic") m.setBaseColorFactor([...hex(f.stand), 1]);
      if (n === "DoorEdge") m.setBaseColorFactor([...hex(f.edge), 1]);
      if (n === "SidePaint") m.setBaseColorFactor([...hex(f.side), 1]);
      if (n === "TopPaint") m.setBaseColorFactor([...hex(f.top), 1]);
      out[n] = m;
    }
    mats.push(out);
  });
  const variants = FIN.map((f) => varExt.createVariant(f.variant));
  let mapped = 0;
  for (const me of R.listMeshes()) for (const p of me.listPrimitives()) {
    const n = VARY.find((k) => p.getMaterial() === base[k]);
    if (!n) continue;
    const list = varExt.createMappingList();
    FIN.forEach((f, i) => list.addMapping(varExt.createMapping().setMaterial(mats[i][n]).addVariant(variants[i])));
    p.setExtension("KHR_materials_variants", list);
    mapped++;
  }
  for (const t of R.listTextures()) if (!t.listParents().some((p) => p.propertyType === "Material")) t.dispose();
  fs.writeFileSync(OUT, await io.writeBinary(doc));
  console.log(`variants: ${FIN.map((f) => f.variant).join(", ")}; ${mapped} primitives mapped;`, (fs.statSync(OUT).size / 1048576).toFixed(2), "MB");
}
