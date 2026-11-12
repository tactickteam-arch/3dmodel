// Samsung RR24H2823.., 223 L direct-cool single-door refrigerator with the Stylish Grandé door and the Base Stand Drawer,
// in Samsung India's three colours of this body: Hydrangea Plum (RR24H2823HT/NL, the listed one, the default), Hydrangea
// Blue (RR24H2823HS/NL) and Midnight Blossom Blue (RR24H2823UZ/NL). One body, so one GLB, the colours as
// KHR_materials_variants.
// Built to Samsung's published size: 550 W x 1520 H x 665 D mm with the stand (Samsung India's page and the manual's
// table for RR23/24** "Stand"), 536 mm wide without the stand (the manual's "Basic" column and its plan drawing), 540 mm
// deep without the door (the page). Samsung's closed fronts draw the door about 5% short for its width, so the door's
// features are placed as fractions of the door's height; the open-door photo agrees with the published size and gives
// the inside at 0.774 px per mm. Every number and how it was got is in the private research notes (NOTES.md).
// What it is: a cabinet on a black base stand whose front is a drawer (Samsung: "a convenient place for food items that
// don't need cooling, such as potatoes and onions"); one door hinged on the right (the manual: it opens to 127 deg), its
// top an arched crown that rolls back, its sides rounded, a recessed line across it two fifths up ("a fine line
// aesthetically placed towards the bottom"), a bar handle on the left (chrome, black facing the door) with the lock at its foot; inside, the
// freezer box ("Super Freeze Zone") behind a clear blue flap hinged on its right, the knob panel beside it, the drip tray
// and the chiller tray under it, three toughened glass shelves, the vegetable box's cover and the vegetable box ("BIO
// Fresh Zone"); in the door, six pockets (the top one, the egg pair, two more and the bottle guard). The shelves, the
// chiller tray and the vegetable box come out with their food (FridgeTrays). Stocked for a south Indian kitchen, the base
// drawer with onions and potatoes.
// usage: node make_samsung_rr24.mjs <entry .json, never products.json> <tex dir> <out.glb>
import fs from "node:fs";
import { mergeGeometries, mergeVertices } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import { NodeIO } from "@gltf-transform/core";
import { ALL_EXTENSIONS, KHRMaterialsVariants, KHRMaterialsClearcoat } from "@gltf-transform/extensions";
import { THREE, mat, mesh, box, faced, group, flipV, stateClips, exportGLB, productParts, saveZones } from "./lib.mjs";
import { LGStock } from "./stock_lg.mjs";

const [PRODUCTS, TEX, OUT] = process.argv.slice(2);
const ID = "samsung-rr24h2823htnl";
const T = `${TEX}/samsung_rr24`;
const C = JSON.parse(fs.readFileSync(`${T}/colours.json`, "utf8"));

// ── size (metres) ──
const W = 0.550, Wc = 0.536, H = 1.520, D = 0.665;   // VERIFIED (page, manual)
const zB = -D / 2;
const zCabBack = zB, zFront = zB + 0.540;            // 540 mm without the door (page)
const zDoor = zFront + 0.008;                        // the gasket's gap (ESTIMATED)
const T_ = 0.072;                                    // the door to its face at the middle; the handle stands 45 mm proud of it (ESTIMATED split of the 125 mm)
const footH = 0.011;                                 // the stand's four feet (fronts: 8-9 px)
const standTop = 0.160, standLip = 0.163;            // the cabinet sits on the stand; the drawer front's top edge (fronts and the open photo)
const doorBot = 0.173;                               // the door's foot (fronts: 0.115 of the height)
const cabTop = 1.488;                                // the cabinet's top (open photo, row 92); the door's crown rises to 1520
const wall = 0.025, inW = Wc - 2 * wall;             // 486 mm between the walls at the front (open photo)
const floorIn = 0.233, ceil = 1.465;                 // the cavity's floor and ceiling (open photo)
const zIn = zCabBack + 0.05;                         // the cavity's back (ESTIMATED: a 50 mm back wall)
const zNose = 0.272;                                 // the drawer front (ESTIMATED: 15 mm behind the door's face)
// inside (the empty open photo ht_g_551226905 at 0.774 px per mm, floor row 1244, the cabinet's middle at column 841.5)
const fbX0 = -inW / 2, fbX1 = inW / 2, fbBot = 1.226, fbTop = 1.428;   // the freezer box's white surround
const flX0 = -0.213, flX1 = 0.185, flY0 = 1.239, flY1 = 1.414;          // the flap: 398 mm wide, its grip on the left
const fbZ1 = 0.102;                                  // the box's front: its flap's grip 5.5 mm behind the shut door's top pocket (ESTIMATED)
const dripBot = 1.181, dripTop = 1.212;              // the drip tray under the box
const ctBot = 1.085, ctTop = 1.178, ctZ1 = 0.115;    // the chiller tray
const s1 = 0.969, s2 = 0.798, s3 = 0.647;            // the glass shelves' tops (front rims)
const coverY = 0.528;                                // the vegetable box's cover
const vbBot = 0.236, vbTop = 0.505, vbLip = 0.477;   // the vegetable box: its sides, its lower front
const frontFridge = 0.0975;                          // shelves and the box stop 7 mm short of the shut door's deepest pocket
// the door
const pw = Wc - 0.002, dh = H - doorBot;
const linerFace = 0.016;
// door pockets: floors (from the floor, open photo), wall height, depth
const BK = {
  top: { y: 1.291 - doorBot, d: 0.082, h: 0.055 },
  egg: { y: 1.116 - doorBot, d: 0.075, h: 0.05 },
  third: { y: 0.894 - doorBot, d: 0.088, h: 0.06 },
  fourth: { y: 0.645 - doorBot, d: 0.09, h: 0.09 },
  bottle: { y: 0.270 - doorBot, d: 0.095, h: 0.075 },
};

// ── the colours ──
// door: the face's texture; edge: the door's sides (the print's ground, read off the 3/4 views); side, top: the painted
// cabinet (charcoal on the Hydrangea pair, navy on Midnight Blossom: each colour's own 3/4 views)
const FIN = [
  { name: "Hydrangea Plum", variant: "Hydrangea Plum", slug: "hydrangea_plum", edge: 0x3a0714, side: 0x3c3d41, top: 0x343539 },
  { name: "Hydrangea Blue", variant: "Hydrangea Blue", slug: "hydrangea_blue", edge: 0x0a0a46, side: 0x3c3d41, top: 0x343539 },
  { name: "Midnight Blossom Blue", variant: "Midnight Blossom Blue", slug: "midnight_blossom_blue", edge: 0x05104a, side: 0x363a52, top: 0x30344a },
];
const F0 = FIN[0];
// satin, mostly metal, no coat: a glossy coat mirrored the studio's tall light in the default view (-28 deg) and washed
// the dark print pale (the first build here read pale pink, as the RT40's doors did). Metalness 0.7 keeps the print's
// darks: straight on, the door's lower part reads 0.068 of the label's white (Samsung's front 0.051; 0.5 gave 0.094)
const DOOR = { metal: 0.7, rough: 0.5, coat: null };

// ── materials ──
const doorFace = mat("DoorFace", 0xffffff, { metal: DOOR.metal, rough: DOOR.rough });
const doorEdge = mat("DoorEdge", F0.edge, { metal: 0, rough: 0.35 });
const sidePaint = mat("SidePaint", F0.side, { metal: 0.3, rough: 0.5 });
const topPaint = mat("TopPaint", F0.top, { metal: 0.15, rough: 0.65 });
const standM = mat("StandPlastic", 0x27282c, { rough: 0.6 });
const standFront = mat("StandFront", 0xffffff, { rough: 0.5 });
const markM = mat("SamsungMark", 0xffffff, { rough: 0.45, opacity: 0.999 });
const labelM = mat("LabelBEE", 0xffffff, { rough: 0.5, opacity: 0.999 });
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

const root = group("SamsungRR24");
const cab = group("Cabinet");
root.add(cab);

// ── the base stand: black, its sides flaring 7 mm out to the floor (550 mm against the cabinet's 536), four feet; the
// front is the drawer (below) ──
const zStandBack = zCabBack + 0.004;
{
  const dz = zNose - 0.006 - zStandBack, zc = (zNose - 0.006 + zStandBack) / 2, hS = standTop - footH;
  const tilt = Math.atan2(0.007, hS);
  for (const sx of [-1, 1]) {
    // its outer face from the cabinet's side (268 mm out) at the top to 275 mm at the floor: 550 mm across (Samsung)
    const s = box("StandSide", 0.012, hS / Math.cos(tilt), dz, standM, sx * (W / 2 - 0.0035 - 0.006), footH + hS / 2, zc);
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
// the hinges on the right: the black top plate on the cabinet's top at the front (open photo: 110 mm across, 15 mm
// tall) and the bottom bracket under the door's right corner
cab.add(box("HingeCoverTop", 0.11, 0.015, 0.07, hingeM, Wc / 2 - 0.055, cabTop + 0.0075, zFront - 0.025));
cab.add(box("HingeBottom", 0.035, 0.006, 0.06, dark, Wc / 2 - 0.0175, standLip + 0.003, zFront + 0.025));
// the back: Samsung publishes no rear photo of this model and its manual draws no cord, so, as the Whirlpool 22343, no
// cord or plug is drawn (none may show from the front, a 3/4 or the side)

// ── inside: the freezer box, its flap, the knob panel, the drip tray, the lamp ──
const xL = -inW / 2, xR = inW / 2, wt = 0.008;
// the cold-air cover over the box: white, a row of seven slots (open photo: 1424-1417 mm)
cab.add(box("VentPanel", inW, ceil - fbTop, fbZ1 - zIn, white, 0, (ceil + fbTop) / 2, (fbZ1 + zIn) / 2));
cab.add(mesh("VentSlots", mergeGeometries([0, 1, 2, 3, 4, 5, 6].map((i) => new THREE.BoxGeometry(0.05, 0.006, 0.002).translate(-0.19 + i * 0.062, fbTop + 0.007, fbZ1 + 0.001))), dark));
const panelX0 = flX1 + 0.002;
{
  const zc = (zIn + fbZ1) / 2, d = fbZ1 - zIn, h = fbTop - fbBot;
  cab.add(box("FreezerBoxFloor", panelX0 - xL, wt, d, white, (xL + panelX0) / 2, fbBot + wt / 2, zc));
  cab.add(box("FreezerFrameL", flX0 - xL, h, 0.012, white, (xL + flX0) / 2, (fbBot + fbTop) / 2, fbZ1 - 0.006));
  cab.add(box("FreezerFrameTop", flX1 - flX0, fbTop - flY1, 0.012, white, (flX0 + flX1) / 2, (fbTop + flY1) / 2, fbZ1 - 0.006));
  cab.add(box("FreezerFrameBot", flX1 - flX0, flY0 - fbBot, 0.012, white, (flX0 + flX1) / 2, (fbBot + flY0) / 2, fbZ1 - 0.006));
  // the box's back: light grey, with "Super Freeze Zone" across it (130 mm wide)
  cab.add(box("FreezerBack", panelX0 - xL, h - wt, 0.004, linerDk, (xL + panelX0) / 2, (fbBot + fbTop + wt) / 2, zIn + 0.002));
  cab.add(plane("PrintFreeze", 0.1325, 0.0185, PR.freeze, -0.015, 1.322, zIn + 0.0047));   // the PNG at 8 px per mm with its 10 px margin
  // the knob panel right of the flap (its left face the box's right wall): white, TEMPERATURE CONTROL, the blue knob in its ring (open photo: the knob 20 mm
  // across at 1371 mm), the words under it
  const px0 = panelX0, px1 = xR, pcx = (px0 + px1) / 2;
  cab.add(box("ControlPanel", px1 - px0, h, d, white, pcx, (fbBot + fbTop) / 2, zc));
  cab.add(plane("PanelPrint", 0.046, 0.13, PR.temp, pcx, fbTop - 0.008 - 0.065, fbZ1 + 0.0007));
  const kx = pcx, ky = fbTop - 0.008 - 0.027;
  const k = cyl("TempKnob", 0.0105, 0.0105, 0.012, knobM, kx, ky, fbZ1 + 0.006, 32);
  k.rotation.x = Math.PI / 2;
  cab.add(k);
  cab.add(box("KnobGrip", 0.004, 0.016, 0.004, white, kx, ky, fbZ1 + 0.0135));
}
// the flap: clear blue, hinged on its right edge (Samsung's photo of the box open, ht_g_551227027). It is a shallow clear
// tray, not a flat panel: on that photo its four sides stand about 18 mm deep round the face (ESTIMATED, about a twentieth
// of its 398 mm width), reaching into the box when it is shut; they stop 3 mm inside its outline so its free edge's
// inner corner clears the frame as it swings (it moves out sideways by at most 0.3 mm)
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
// the ice tray (Samsung: "Icemaker: Ice Tray"): milky clear, lying lengthwise at the front left of the box floor (the
// flap-open photo ht_g_551227027); 110 x 35 mm across its front off that photo, 220 mm long (ESTIMATED: the photo sees it
// end on), two rows of cube wells
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
// the drip tray under the box, and the LED lamp under its middle (the open-box photo shows the lamp's light there)
cab.add(box("DripTray", inW - 0.004, dripTop - dripBot, fbZ1 - 0.006 - zIn, white, 0, (dripBot + dripTop) / 2, (fbZ1 - 0.006 + zIn) / 2));
cab.add(box("DripTrayLip", inW - 0.004, 0.006, 0.006, linerDk, 0, dripTop - 0.003, fbZ1 - 0.003));
cab.add(rbox("LedLampCover", 0.06, 0.008, 0.03, 0.003, lampM, 0, dripBot - 0.004, fbZ1 - 0.04));

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
shelf("Shelf3", s3);
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
  trays.add(plane("PrintFresh", 0.1125, 0.0165, PR.fresh, 0, vbBot + hf * 0.62, vbZ1 + 0.0025));
}

// ── the base stand's drawer: its front is the stand's whole face (Samsung's photo of it pulled out with potatoes), with
// the grip notch at its top middle (fronts: 254 mm wide, 21 mm deep) and SAMSUNG embossed (the photo) ──
const drawer = group("BaseDrawer");
cab.add(drawer);
const fwTop = Wc + 0.004, fwBot = W - 0.004, fy0 = footH + 0.002, fy1 = standLip;
const notchW = 0.254, notchH = 0.021;
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
// the bin behind it: dark plastic, between the stand's sides
const dbW = Wc - 0.05, dbZ0 = zStandBack + 0.03, dbZ1 = zNose - 0.034, dbFloor = footH + 0.012, dbTop = standTop - 0.012;
{
  const zc = (dbZ0 + dbZ1) / 2, d = dbZ1 - dbZ0;
  drawer.add(box("DrawerBinFloor", dbW, 0.004, d, dark, 0, dbFloor - 0.002, zc));
  // the sides: open lattice, as Samsung's photo of the drawer pulled out shows (ht_g_551226985): two rows of upright slots
  // along each side (ESTIMATED off that photo: slots 8 x 24 mm at a 20 mm pitch, a 30 mm solid band at the foot, 8 mm
  // between the rows), built from the bands and the posts between the slots
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
    drawer.add(mesh("DrawerBinSide", mergeGeometries(g), dark, 0, 0, 0));
  }
  drawer.add(box("DrawerBinBack", dbW, dbTop - dbFloor + 0.004, 0.004, dark, 0, (dbTop + dbFloor - 0.004) / 2, dbZ0 + 0.002));
  drawer.add(box("DrawerBinFront", dbW, dbTop - dbFloor + 0.004, 0.004, dark, 0, (dbTop + dbFloor - 0.004) / 2, dbZ1 - 0.002));
}

// ── stock: vegetarian South Indian food, eggs, juices, water and soft drinks (stock_lg.mjs, food.mjs) ──
stock.shelves(trays, {
  zIn1: zIn, inW, inD: frontFridge - zIn, s1: s1 - 0.0005, s2: s2 - 0.0005, s3: s3 - 0.0005, fz: vbBot + 0.004, fit: true, vz0: vbZ0 + 0.02, vk: 0.8,
  shelfB: { hw: inW / 2 - 0.03, z0: zIn + 0.022, z1: frontFridge - 0.015 },
  drawerB: { hw: vbW / 2 - 0.014, z0: vbZ0 + 0.02, z1: vbZ1 - 0.008, y0: vbBot + 0.004 },
  drawerCeil: coverY - 0.005 - 0.01 - (vbBot + 0.004),
});
// the shelves are 343 mm deep with 104, 146 and 126 mm over them, so the stock's rows are laid out again here: each row
// spaced across the shelf by the items' real widths, each item as far back as what is behind it lets it (12 mm apart),
// the rest left out
// boxes as qa_fit reads them (each part's own box, turned with it); exact: from the points (for a pack laid down)
const bbox = (o, exact = false) => { o.updateWorldMatrix(true, true); return new THREE.Box3().setFromObject(o, exact); };
const kids = (g, name) => g.children.filter((o) => o.name === name);
const drop = (why, ...os) => { const n = os.filter(Boolean); n.forEach((o) => o.parent?.remove(o)); if (n.length) console.log(`left out (${why}): ${n.map((o) => o.name).join(", ")}`); };
function row(items, x0, x1) {
  const bs = items.map(bbox), w = bs.reduce((s, b) => s + b.max.x - b.min.x, 0), gap = (x1 - x0 - w) / (items.length + 1);
  if (gap < 0.006) console.warn(`row: ${items.map((o) => o.name)} leave ${(gap * 1000).toFixed(0)} mm between them`);
  let x = x0 + gap;
  items.forEach((o, i) => { const b = bs[i]; o.position.x += x - b.min.x; x += b.max.x - b.min.x + gap; });
}
// each item's back as near z0 as the items already placed (behind) let it; what then reaches past z1 is left out
function packBack(items, z0, z1, behind, why) {
  const out = [];
  for (const o of items) {
    const b = bbox(o);
    let z = z0;
    for (const p of behind) { const q = bbox(p); if (q.max.x > b.min.x && q.min.x < b.max.x) z = Math.max(z, q.max.z + 0.012); }
    o.position.z += z - b.min.z;
    if (bbox(o).max.z > z1) out.push(o);
  }
  drop(why, ...out);
  return items.filter((o) => !out.includes(o));
}
{
  const hw = inW / 2 - 0.03, z0 = zIn + 0.022, z1 = frontFridge - 0.015;
  const g1 = trays.getObjectByName("Shelf1Stock"), g2 = trays.getObjectByName("Shelf2Stock"), g3 = trays.getObjectByName("Shelf3Stock");
  { // top shelf, 116 mm under the chiller tray: the biryani box and the milk pile, the curd tub in front of the box
    drop("taller than the 104 mm under the chiller tray", g1.getObjectByName("Tiffin"), g1.getObjectByName("IdBatterPouch1"), g1.getObjectByName("MastiButtermilk"));
    const milk = g1.getObjectByName("NandiniMilk"), pile = ["AavinMilk", "AmulTaazaPouch"].map((n) => g1.getObjectByName(n)).filter(Boolean), m0 = milk.position.clone();
    const box1 = g1.getObjectByName("RnrBiryaniBox");
    row([box1, milk], -hw, hw);
    const a = packBack([box1, milk], z0, z1, [], "past the top shelf's front");
    const d = milk.position.clone().sub(m0);
    pile.forEach((o) => o.position.add(d));
    const dahi = g3.getObjectByName("AmulMastiDahi");
    if (dahi) {
      g1.attach(dahi);
      dahi.position.y += bbox(box1).min.y - bbox(dahi).min.y;
      dahi.position.x += bbox(box1).min.x - bbox(dahi).min.x;
      packBack([dahi], z0, z1, a, "past the top shelf's front");
    }
  }
  { // middle shelf: the coconut and the melon at the back, the biryani and the two meal boxes in front
    const back = [g2.getObjectByName("CoconutHalf"), g2.getObjectByName("WatermelonHalf")];
    row(back, -hw, hw);
    packBack(back, z0, z1, [], "past the middle shelf's front");
    const front = [g2.getObjectByName("RnrBiryani"), g2.getObjectByName("NandhanaPalace"), g2.getObjectByName("NandhanaPalace2")];
    row(front, -hw, hw);
    packBack(front, z0, z1, back, "no room in front on the middle shelf");
  }
  { // bottom shelf: bananas, grapes and a lemon at the back, apples and an orange in front, a lemon in front of those
    const [a0, a1, a2, a3, a4] = kids(g3, "Apple"), [o0, o1, o2] = kids(g3, "Orange"), [l0, l1] = kids(g3, "Lemon");
    const A = [g3.getObjectByName("Bananas"), g3.getObjectByName("Grapes"), l1];
    row(A, -hw, hw);
    packBack(A, z0, z1, [], "past the bottom shelf's front");
    const Bk = [a0, a1, o0, a2];
    row(Bk, -hw, hw);
    const b = packBack(Bk, z0, z1, A, "no room in front on the bottom shelf");
    row([l0], bbox(a2).min.x, hw);
    packBack([l0], z0, z1, [...A, ...b], "no room in front on the bottom shelf");
    // the rest of the fruit on the vegetable box's glass cover (Samsung's stocked photo has a pot there), in a row
    // across its middle; the cover stays in when the trays come out, so this is part of the cabinet
    const cs = group("CoverStock");
    cab.add(cs);
    const fr = [a3, o1, a4, o2].filter(Boolean);
    fr.forEach((o) => cs.attach(o));
    row(fr, -hw, hw);
    fr.forEach((o) => { const b = bbox(o); o.position.y += coverY + 0.0005 - b.min.y; o.position.z += z0 + 0.12 - b.min.z; });
  }
}
if (process.env.RR24_SIZES) for (const n of ["Shelf1Stock", "Shelf2Stock", "Shelf3Stock", "F0Stock", "FreshZoneStock"]) for (const o of (trays.getObjectByName(n)?.children || [])) { const b = new THREE.Box3().setFromObject(o); console.log(n, o.name, ...["x", "y", "z"].map((k) => ((b.max[k] - b.min[k]) * 1000).toFixed(0)), "at", ...["x", "y", "z"].map((k) => (b.min[k] * 1000).toFixed(0))); }
// what is too tall for the space over its shelf, or reaches past the shelf's sides or front, is left out
{
  const shw = inW / 2 - 0.03;
  const over = { Shelf1Stock: ctBot - 0.012, Shelf2Stock: s1 - 0.0145 - 0.01, Shelf3Stock: s2 - 0.0145 - 0.01 };
  for (const [n, top] of Object.entries(over)) leaveOut(trays.getObjectByName(n), [B3(-1, 0, frontFridge - 0.014, 1, 2, 1), B3(-1, 0, -1, -shw - 0.003, 2, 1), B3(shw + 0.003, 0, -1, 1, 2, 1), B3(-1, top, -1, 1, 3, 1)], `too tall for ${n}'s space, or past its sides or front`);
  leaveOut(trays.getObjectByName("FreshZoneStock"), [B3(-1, coverY - 0.015, -1, 1, 3, 1)], "over the vegetable box's top");
}
// the cauliflower's parts are tilted, so their boxes, turned with them, reach 7 mm under the vegetable box's floor though
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
  // the box as Samsung's photos fill it: the ice tray at the front left, the ice-cream tubs to its right. These tubs are
  // 166 mm across (Samsung's props are smaller), so they stand one on the other at the back right, clear of the
  // "Super Freeze" end of the print; the parotta packs and peas are left out (they would hide the tubs or the print)
  {
    const tubs = [f.getObjectByName("AmulVanillaMagic"), f.getObjectByName("AmulRajbhog")], packs = [f.getObjectByName("ViswasParotta"), f.getObjectByName("NityaParotta")];
    const bz0 = zIn + 0.02, fl = fbBot + wt, bx1 = flX1 - 0.007;
    let y = fl;
    for (const t of tubs) { const b = bbox(t); t.position.x += bx1 - b.max.x; t.position.z += bz0 - b.min.z; t.position.y += y - b.min.y; y = bbox(t).max.y + 0.0005; }
    drop("they would hide the tubs or the box's print", ...packs, f.getObjectByName("FreshoGreenPeas"));
  }
  if (process.env.RR24_SIZES) for (const o of f.children) { const b = new THREE.Box3().setFromObject(o); console.log("Freezer", o.name, ...["x", "y", "z"].map((k) => ((b.max[k] - b.min[k]) * 1000).toFixed(0)), "at", ...["x", "y", "z"].map((k) => (b.min[k] * 1000).toFixed(0))); }
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
const CROWN = 0.028, CROWN_N = 3.5;   // the top falls 28 mm from the middle to the corners as (|x| / half)^3.5 (UZ front: 2, 11, 18, 22 px at 134-259 mm out)
const yTop = (x) => dh - CROWN * Math.pow(Math.min(1, Math.abs(x) / (pw / 2)), CROWN_N);
// the recessed line: 25 mm tall at 654 mm from the floor, from 227 mm left of the middle to 239 mm right (HT front),
// 2.5 mm deep with rounded ends (ESTIMATED: the photo's shading reads as a groove lit from above)
const GR = { y: 0.654 - doorBot, h: 0.025, x0: -0.227, x1: 0.239, dep: 0.0025, end: 0.012 };
const ell = (d, a, b) => (d >= a ? 0 : b * (1 - Math.sqrt(Math.max(0, 1 - (1 - d / a) ** 2))));
function groove(x, y) {
  const dy = Math.abs(y - GR.y) / (GR.h / 2);
  if (dy >= 1 || x < GR.x0 || x > GR.x1) return 0;
  const e = Math.min(1, (x - GR.x0) / GR.end, (GR.x1 - x) / GR.end);
  return GR.dep * 0.5 * (1 + Math.cos(Math.PI * dy)) * Math.sqrt(Math.max(0, e));
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
  // decals: SAMSUNG 66 mm wide at the door's middle, 106 mm under the crown; the energy label 101 mm wide (its own
  // aspect), its middle 150 mm right of the door's middle, its top 82 mm under the crown (the HT front)
  const mk = C.mark, mw = 0.066 * mk.padded[0] / (mk.padded[0] - 20);
  fridgeDoor.add(plane("SamsungMarkDecal", mw, mw * mk.padded[1] / mk.padded[0], markM, -pw / 2, dh - 0.106, T_ + 0.0008));
  const lw = 0.101 / (1 - 2 * C.label_pad), lh = lw / C.label_aspect;
  fridgeDoor.add(plane("BeeLabelDecal", lw, lh, labelM, -pw / 2 + 0.150, dh - 0.0816 - (lh * (1 - 2 * C.label_pad * C.label_aspect)) / 2, T_ + 0.0008));
  // the handle: a bar 32 mm wide (the UZ front: 28 px at 0.866 px per mm), chrome on its front and sides, black on the
  // side that faces the door (the 3/4 views), its front 45 mm proud of the face (Samsung: 66.5 cm deep with the handle,
  // 54.0 without the door), 449 mm long from 117 mm under the crown, its middle 52 mm in from the door's left edge; its
  // rounded top curves back into the door, its foot widens round the lock: an oval 17 x 46 mm with the key slot across
  // its lower part (the UZ front)
  const hx = -pw + 0.0525, hTop = dh - 0.117, hBot = dh - 0.566, L = hTop - hBot, bw = 0.032, bt = 0.016, rEnd = 0.07, Pz = 0.045 - bt / 2;
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
  fridgeDoor.add(rbox("HandleFoot", 0.036, 0.078, 0.026, 0.008, chrome, hx, hBot + 0.036, T_ + 0.011));   // its foot covers the bar's end
  const lock = cyl("DoorLock", 0.0085, 0.0085, 0.005, chrome, hx, hBot + 0.048, T_ + 0.0255, 28);
  lock.rotation.x = Math.PI / 2; lock.scale.set(1, 1, 2.7);
  fridgeDoor.add(lock);
  fridgeDoor.add(box("LockKeyhole", 0.008, 0.0015, 0.001, dark, hx, hBot + 0.036, T_ + 0.0283));
  // inside: the gasket in the gap, the liner, the pockets
  const lw2 = 0.45, ly0 = floorIn - doorBot, ly1 = ceil - doorBot;
  fridgeDoor.add(box("GasketT", pw - 0.04, 0.016, 0.008, gasket, -pw / 2, ly1 + 0.012, -0.004));
  fridgeDoor.add(box("GasketB", pw - 0.04, 0.016, 0.008, gasket, -pw / 2, 0.012, -0.004));
  fridgeDoor.add(box("GasketL", 0.016, ly1 + 0.004 - 0.02, 0.008, gasket, -pw + 0.022, (ly1 + 0.024) / 2, -0.004));
  fridgeDoor.add(box("GasketR", 0.016, ly1 + 0.004 - 0.02, 0.008, gasket, -0.022, (ly1 + 0.024) / 2, -0.004));
  fridgeDoor.add(box("DoorLiner", lw2, ly1 - ly0 - 0.004, 0.012, liner, -pw / 2, (ly0 + ly1) / 2, -linerFace + 0.006));
}
// pockets: the top one, the egg pair, the third and fourth, the bottle guard at the foot (open photo)
const bkW = 0.43, half = (bkW - 0.01) / 2;
const addBasket = (n, w, b, x) => { const k = basket(n, w, b.d, b.h); k.position.x = x; k.position.y = b.y; fridgeDoor.add(k); };
addBasket("TopPocket", bkW, BK.top, -pw / 2);
addBasket("EggPocketL", half, BK.egg, -pw / 2 - (bkW - half) / 2);
addBasket("EggPocketR", half, BK.egg, -pw / 2 + (bkW - half) / 2);
addBasket("ThirdPocket", bkW, BK.third, -pw / 2);
addBasket("FourthPocket", bkW, BK.fourth, -pw / 2);
addBasket("BottleGuard", bkW, BK.bottle, -pw / 2);
// the egg cups in the pair (the open photo shows them in both halves)
for (const sx of [-1, 1]) fridgeDoor.add(box("EggCupsRib", half - 0.02, 0.006, 0.05, clearRib, -pw / 2 + sx * (bkW - half) / 2, BK.egg.y + 0.007, -linerFace - BK.egg.d / 2));
// three eggs in each half of the pair, clear of its end walls
const eggX = [-1, 1].flatMap((sx) => [-0.064, 0, 0.064].map((d) => -pw / 2 + sx * (bkW - half) / 2 + d));
{
  const inside = (dep) => [-pw / 2 - bkW / 2 + 0.006, -pw / 2 + bkW / 2 - 0.006, -(linerFace + dep / 2)];
  // filled as Samsung's stocked photo fills them, from the top: small things, the eggs, jars, cartons, bottles. The
  // stock's rows are eggs, jars, bottles (with the cartons) and cans: the cans go in the top pocket, the cartons from the
  // bottle row into the fourth
  const deps = { egg: BK.egg.d, jar: BK.third.d, bottle: BK.bottle.d, can: BK.top.d };
  stock.doorFridge(fridgeDoor, { fit: true, eggY: BK.egg.y, eggX, jarY: BK.third.y, botY: BK.bottle.y, canY: BK.top.y, deps, inside });
  const dx = fridgeDoor.position.x, dz = fridgeDoor.position.z;
  const [x0, x1, zm] = inside(BK.fourth.d);
  const cartons = ["RealMango", "RealMixedFruit", "AmulTaaza"].map((n) => fridgeDoor.getObjectByName(n));
  cartons.forEach((o) => { o.position.y += BK.fourth.y - BK.bottle.y; const b = bbox(o); o.position.z += dz + zm - (b.min.z + b.max.z) / 2; });
  row(cartons, x0 + dx, x1 + dx);
  const [y0, y1] = inside(BK.bottle.d);
  row(["Coke", "Fanta", "Bisleri"].map((n) => fridgeDoor.getObjectByName(n)), y0 + dx, y1 + dx);
}
root.add(fridgeDoor);

const parts = productParts(PRODUCTS, ID);
const clips = stateClips(root, parts);
saveZones(PRODUCTS, ID, root, parts);
const textures = {
  DoorFace: `${T}/door_${F0.slug}.jpg`, StandFront: `${T}/stand.jpg`, LabelBEE: `${T}/label_${F0.slug}.png`, SamsungMark: `${T}/mark.png`,
  Print_freeze: `${T}/print_freeze.png`, Print_fresh: `${T}/print_fresh.png`, Print_temp: `${T}/print_temp.png`,
};
Object.assign(textures, stock.textures());
{ const used = new Set(); root.traverse((o) => o.isMesh && [].concat(o.material).forEach((m) => used.add(m.name))); for (const k of Object.keys(textures)) if (!used.has(k)) delete textures[k]; }
// Grain: the printed door carries none (a clear coat only, added with the variants below); the painted cabinet a soft peel, the stand's plastic a
// strong one, the back's cover a soft one. The decals carry none.
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
  const VARY = ["DoorFace", "DoorEdge", "SidePaint", "TopPaint", "LabelBEE"];
  const base = Object.fromEntries(VARY.map((n) => [n, byName(n)]));
  for (const n of VARY) if (!base[n]) throw new Error(`no material ${n}`);
  const mats = FIN.map((f, i) => {
    const out = {};
    for (const n of VARY) {
      if (i === 0) { out[n] = base[n]; continue; }
      if ((n === "SidePaint" && f.side === F0.side) || (n === "TopPaint" && f.top === F0.top)) { out[n] = base[n]; continue; }
      const m = base[n].clone().setName(`${n}_${f.slug}`);
      if (n === "DoorFace") glossy(m.setBaseColorTexture(image(`${T}/door_${f.slug}.jpg`, `DoorFace_${f.slug}`)).setBaseColorFactor([1, 1, 1, 1]));
      if (n === "LabelBEE") m.setBaseColorTexture(image(`${T}/label_${f.slug}.png`, `LabelBEE_${f.slug}`));
      if (n === "DoorEdge") m.setBaseColorFactor([...hex(f.edge), 1]);
      if (n === "SidePaint") m.setBaseColorFactor([...hex(f.side), 1]);
      if (n === "TopPaint") m.setBaseColorFactor([...hex(f.top), 1]);
      out[n] = m;
    }
    return out;
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
