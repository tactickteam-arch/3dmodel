// LG GLD2356Z.., 224 L direct-cool single-door refrigerator with the Base Stand Drawer and the Smart Inverter Compressor,
// in four of LG's five colours: Shiny Steel (GLD2356ZAPZ, the listed one, the default), Wine Spring (ZAWS), Royal Spring
// (ZARS) and Blue Waterlily (ZABW). One body, so one GLB, the colours as KHR_materials_variants. LG's fifth colour, Red
// Waterlily (ZARW), has no page or gallery on LG India (only a 0.3 px per mm catalogue picture), so it is left out.
// Built to LG's published size, 591 W x 1392 H x 610 D mm (LG's pages and its dimension drawings for ZAPZ, ZAWS and ZABW,
// the height to the door's top from the floor under the base stand). LG's gallery renders draw the body about 8% taller
// for its width than that, so heights are read off them as fractions of the height and laid on 1392 mm (as for the
// Whirlpool 207 L); widths and depths are read at 591 and 610 mm. Every number and how it was got is in the private
// research notes (NOTES.md).
// What it is: a cabinet on a dark base stand whose front is a drawer (LG: "to keep up to 6 kg onion & potato"); one door
// hinged on the right, PET with rounded sides and top, LG's Ariana handle (a chrome bar in a pocket) and a key lock on the
// left; inside, the freezer box at the top behind a clear flap (its grip on the left, so hinged on the right), the knob
// dial and the lamp beside it, LG's Fit Max Chiller Tray under it, three toughened glass shelves, the Moist Balance
// Crisper's cover and the vegetable box; in the door, two pairs of small baskets, a wide basket, the 2 L bottle basket and
// the can basket: seven, as LG's open photos of all four colours show (the right top one with the egg cups for its floor),
// and the manual's door figure (seven holders; "the number of baskets may differ depending on models"). LG's spec table
// says 6; the specs row follows the product. The shelves, the chiller tray and the
// vegetable box come out with their food (FridgeTrays). Stocked for a south Indian kitchen, the base drawer with onions
// and potatoes as in LG's stocked photo.
// usage: node make_lg_gld2356.mjs <entry .json, never products.json> <tex dir> <out.glb>
import fs from "node:fs";
import { mergeGeometries, mergeVertices } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { NodeIO } from "@gltf-transform/core";
import { ALL_EXTENSIONS, KHRMaterialsVariants, KHRMaterialsClearcoat, KHRMaterialsSpecular } from "@gltf-transform/extensions";
import { THREE, mat, mesh, box, faced, group, flipV, stateClips, exportGLB, productParts, saveZones } from "./lib.mjs";
import { LGStock } from "./stock_lg.mjs";

const [PRODUCTS, TEX, OUT] = process.argv.slice(2);
const ID = "lg-gld2356zapz";
const T = `${TEX}/lg_gld2356`;
const C = JSON.parse(fs.readFileSync(`${T}/colours.json`, "utf8"));

// ── size (metres) ──
const W = 0.591, H = 1.392, D = 0.610;
const zB = -D / 2;
// depths on LG's side photo (DZ-10, z = -0.305 + (px - 786) / 775.4, the 610 mm from the rear spacers to the handle):
const zCabBack = -0.2908, zFront = 0.1799;   // the cabinet's back and front
const zDoor = zFront + 0.010;                // the door's back (the gasket's dark band, 8 px)
const T_ = 0.2728 - zDoor;                   // the door, to its face at the middle: 83 mm
const zStandBack = -0.2986, zStandSide = 0.2186, zNose = 0.2805;   // the base stand's back, its sides' front, the drawer's nose
// heights: fractions of the fronts' height (four photos) laid on 1392 mm
const standTop = 0.140;                      // the cabinet sits on the stand (side photo)
const faceTop = 0.114, lipTop = 0.134;       // the drawer front's face and its lip with the slot handle (fronts)
const doorBot = 0.143;                       // the door's foot (fronts: 0.103 of the height)
const cabTop = 1.350;                        // the cabinet's top (side and rear photos); the door rises 42 mm over it
const wall = 0.0495, inW = W - 2 * wall;     // DZ-04: 492 mm between the walls
const floorIn = 0.168, ceil = 1.315;         // the cavity's floor and ceiling (DZ-04)
const zIn = -0.241;                          // the cavity's back (ESTIMATED: a 50 mm back wall)
// inside (DZ-04, the empty open photo, heights as fractions):
const fbBot = 1.063, fbTop = 1.292, fbZ1 = 0.085;     // the freezer box's frame; its front stays 10 mm behind the top baskets
const flX0 = -0.2245, flX1 = 0.1565, flY0 = 1.066, flY1 = 1.281;   // the flap: 381 mm wide, grip on its left
const panelX0 = 0.1695;                      // the knob and lamp panel, right of the box
const ctBot = 0.970, ctTop = 1.052, ctZ1 = 0.09;   // the Fit Max Chiller Tray
const s1 = 0.828, s2 = 0.666, s3 = 0.504;    // the glass shelves' tops (front rims)
const coverY = 0.427;                        // the crisper's cover
const vbBot = 0.186, vbTop = 0.420;          // the vegetable box
const frontFridge = 0.070;                   // shelves and the box stop 9 mm short of the shut door's deepest basket
// the door
const pw = W - 0.002, dh = H - doorBot;
const linerFace = 0.016;
// door baskets: floors above the door's foot (DZ-04: 1355, 1161, 844, 447, 200 mm on the photo's scale), depth, wall height
const BK = {
  top: { y: 1.264 - doorBot, d: 0.07, h: 0.05 },
  second: { y: 1.083 - doorBot, d: 0.07, h: 0.05 },
  wide: { y: 0.787 - doorBot, d: 0.085, h: 0.07 },
  bottle: { y: 0.417 - doorBot, d: 0.095, h: 0.1 },
  can: { y: 0.187 - doorBot, d: 0.085, h: 0.08 },
};

// ── the colours ──
// door: the face's texture and finish; edge: the door's flat sides; side, top, stand: the painted cabinet and the base
// stand's plastic, each read off that colour's own side photo (DZ-10, large06) and tuned on the render; mark: the LG
// mark (dark on the steel, light on the prints)
const FIN = [
  { name: "Shiny Steel", variant: "Shiny Steel", slug: "shiny_steel", code: "GLD2356ZAPZ", swatch: "#a9aaab", edge: 0x949596, side: 0x76777a, top: 0x6a6b6d, stand: 0x5f5f61, mark: "dark",
    door: { metal: 0.38, rough: 0.5, coat: [0.6, 0.22], grain: true } },
  { name: "Wine Spring", variant: "Wine Spring", slug: "wine_spring", code: "GLD2356ZAWS", swatch: "#4a1a22", edge: 0x3e1e20, side: 0x31131d, top: 0x2c111a, stand: 0x311217, mark: "light",
    door: { metal: 0, rough: 0.35, coat: [0.9, 0.06], spec0: true } },
  { name: "Royal Spring", variant: "Royal Spring", slug: "royal_spring", code: "GLD2356ZARS", swatch: "#141a3c", edge: 0x1d2337, side: 0x03082d, top: 0x03072a, stand: 0x090a1e, mark: "light",
    door: { metal: 0, rough: 0.35, coat: [0.9, 0.06], spec0: true } },
  { name: "Blue Waterlily", variant: "Blue Waterlily", slug: "blue_waterlily", code: "GLD2356ZABW", swatch: "#24406e", edge: 0x283755, side: 0x050d3a, top: 0x050c35, stand: 0x0c0f26, mark: "light",
    door: { metal: 0, rough: 0.35, coat: [0.9, 0.06], spec0: true } },
];
const F0 = FIN[0];

// ── materials ──
const doorFace = mat("DoorFace", 0xffffff, { metal: F0.door.metal, rough: F0.door.rough });
const doorEdge = mat("DoorEdge", F0.edge, { metal: 0.2, rough: 0.45 });
const sidePaint = mat("SidePaint", F0.side, { metal: 0.3, rough: 0.45 });
const topPaint = mat("TopPaint", F0.top, { metal: 0.15, rough: 0.6 });
const standM = mat("StandPlastic", F0.stand, { rough: 0.55 });
const standFront = mat("StandFront", 0xffffff, { rough: 0.45 });
const standRear = mat("StandRear", 0xffffff, { rough: 0.7 });
const logoM = mat("LgMark", 0xffffff, { rough: 0.45, opacity: 0.999 });
// the stand's moulded LG mark, a shade lighter than its ground on every colour (colours.json stand_mark, read off each front)
const standMarkM = mat("StandMark", 0xffffff, { rough: 0.5, opacity: 0.999 });   // its ink is baked per finish
const labelM = mat("LabelBEE", 0xffffff, { rough: 0.5, opacity: 0.999 });
const rearM = mat("RearPlate", 0xffffff, { metal: 0.3, rough: 0.55 });
const chrome = mat("Chrome", 0xd4d7db, { metal: 1, rough: 0.14 });
const dark = mat("DarkPlastic", 0x1d1e21, { rough: 0.7 });
const hingeM = mat("HingeCover", 0x3a3b3e, { rough: 0.55 });
const liner = mat("Liner", 0xf1f3f5, { rough: 0.6 });
const linerSide = mat("LinerSide", 0xe4e8ec, { rough: 0.65 });
const linerDk = mat("LinerGrey", 0xd5d9de, { rough: 0.6 });
const gasket = mat("Gasket", 0x8d9196, { rough: 0.85 });
const white = mat("WhitePlastic", 0xf6f7f8, { rough: 0.45 });
const clear = mat("ClearPlastic", 0xc3d0da, { rough: 0.12, opacity: 0.5, side: THREE.DoubleSide });
const clearLight = mat("ClearPlasticLight", 0xdfe7ee, { rough: 0.12, opacity: 0.26, side: THREE.DoubleSide });
const clearRib = mat("ClearRib", 0xffffff, { rough: 0.3, opacity: 0.92 });
const flapM = mat("FlapClear", 0xb9c0c7, { rough: 0.25, opacity: 0.55, side: THREE.DoubleSide });   // the flap's grey tint (DZ-04)
const frosted = mat("Frosted", 0xe6edf1, { rough: 0.45, opacity: 0.8 });
const glass = mat("TemperedGlass", 0xa9cdd6, { rough: 0.05, opacity: 0.55, side: THREE.DoubleSide });
const glassRim = mat("ShelfRim", 0xe3e7ea, { rough: 0.45 });
const edgeGreen = mat("GlassEdge", 0x7fa7b0, { rough: 0.3 });
const lampM = mat("LedLamp", 0xfff3dc, { emissive: 0xffe7b8, emissiveIntensity: 1.2 });
const cordM = mat("Cord", 0x8d8f93, { rough: 0.6 });                 // the grey cord (rear photo)
const plugM = mat("Plug", 0x9a9ca0, { rough: 0.5 });
const pinM = mat("Pin", 0xb7bbc0, { metal: 0.9, rough: 0.3 });
const knobFace = mat("KnobFace", 0xffffff, { rough: 0.5 });
const knobSide = mat("KnobSide", 0xe6e8eb, { rough: 0.5 });
const PR = {};
for (const k of ["fastfreeze", "coolfresh", "lamp"]) PR[k] = mat("Print_" + k, 0xffffff, { rough: 0.5, opacity: 0.999 });
const dialM = mat("DialRing", 0xffffff, { rough: 0.5, opacity: 0.999 });
const stock = LGStock({ T3: `${TEX}/lg_glt3426`, TF: `${TEX}/food`, BR: `${TEX}/brands`, BRT: `${TEX}/brands/small` });

// ── small builders ──
const cyl = (name, rt, rb, h, m, x, y, z, seg = 16) => mesh(name, new THREE.CylinderGeometry(rt, rb, h, seg), m, x, y, z);
const plane = (name, w, h, m, x, y, z) => mesh(name, flipV(new THREE.PlaneGeometry(w, h)), m, x, y, z);
const printPlane = (name, key, wmm, hmm, x, y, z) => plane(name, wmm / 1000, hmm / 1000, PR[key], x, y, z);
function flipFaces(geo) {
  const idx = geo.index;
  for (let i = 0; i < idx.count; i += 3) { const a = idx.getX(i + 1); idx.setX(i + 1, idx.getX(i + 2)); idx.setX(i + 2, a); }
  const n = geo.attributes.normal;
  for (let i = 0; i < n.count; i++) n.setXYZ(i, -n.getX(i), -n.getY(i), -n.getZ(i));
  return geo;
}
// leave out what doesn't fit (never scaled): any stock item in grp that reaches into one of the keep-out boxes
function leaveOut(grp, keep, why) {
  if (!grp) return;
  grp.updateMatrixWorld(true);
  const out = [];
  for (const c of [...grp.children]) if (keep.some((k) => new THREE.Box3().setFromObject(c).intersectsBox(k))) { out.push(c.name); c.removeFromParent(); }
  if (out.length) console.log(`left out (${why}): ${out.join(", ")}`);
}
const B3 = (x0, y0, z0, x1, y1, z1) => new THREE.Box3(new THREE.Vector3(x0, y0, z0), new THREE.Vector3(x1, y1, z1));
// a clear door basket, open at the top; origin at its floor's middle on the face of the door's liner
function basket(name, w, dep, h) {
  const g = group(name, 0, 0, -linerFace);
  g.add(box(name + "Floor", w, 0.004, dep, clear, 0, 0.002, -dep / 2));
  g.add(box(name + "Lip", w, h * 0.85, 0.004, clear, 0, h * 0.425, -dep + 0.002));
  g.add(box(name + "EndL", 0.004, h, dep, clear, -w / 2 + 0.002, h / 2, -dep / 2));
  g.add(box(name + "EndR", 0.004, h, dep, clear, w / 2 - 0.002, h / 2, -dep / 2));
  g.add(box(name + "Rim", w, 0.007, 0.006, clearRib, 0, h * 0.85 - 0.0035, -dep + 0.003));
  return g;
}

const root = group("LGGLD2356");
const cab = group("Cabinet");
root.add(cab);

// ── the base stand: its sides, back and floor; the front is the drawer (below) ──
{
  const dz = zStandSide - zStandBack, zc = (zStandSide + zStandBack) / 2;
  cab.add(faced("StandSideL", 0.012, standTop, dz, [standM, standM, standM, standM, standM, standM], -W / 2 + 0.006, standTop / 2, zc));
  cab.add(faced("StandSideR", 0.012, standTop, dz, [standM, standM, standM, standM, standM, standM], W / 2 - 0.006, standTop / 2, zc));
  // its back: the photo's vents (DZ-11)
  cab.add(mesh("StandBack", flipV(new THREE.BoxGeometry(W - 0.024, standTop, 0.006)), [standM, standM, standM, standM, standM, standRear], 0, standTop / 2, zStandBack + 0.003));
  cab.add(box("StandFloor", W - 0.024, 0.006, dz, dark, 0, 0.003, zc));
  // the front posts either side of the drawer (seen when it is out, DZ-03): 50 mm wide
  for (const sx of [-1, 1]) cab.add(box("StandPost", 0.05, standTop - 0.007, 0.04, standM, sx * (W / 2 - 0.025), 0.006 + (standTop - 0.007) / 2, zStandSide - 0.02));
  // the stand's top under the cabinet's front, over the drawer
  cab.add(box("StandTopFront", W - 0.1, 0.004, zStandSide - 0.15, dark, 0, standTop - 0.002, (zStandSide + 0.15) / 2));
}

// ── cabinet shell ──
const shellH = cabTop - standTop, shellMid = standTop + shellH / 2, Dc = zFront - zCabBack, zMid = (zFront + zCabBack) / 2;
cab.add(faced("SideLeft", wall, shellH, Dc, [linerSide, sidePaint, topPaint, standM, sidePaint, dark], -W / 2 + wall / 2, shellMid, zMid));
cab.add(faced("SideRight", wall, shellH, Dc, [sidePaint, linerSide, topPaint, standM, sidePaint, dark], W / 2 - wall / 2, shellMid, zMid));
cab.add(faced("Top", inW, cabTop - ceil, Dc, [liner, liner, topPaint, liner, sidePaint, dark], 0, (cabTop + ceil) / 2, zMid));
// the compressor bay: LG's rear photo shows it open below 80% of the back's height (DZ-11); it is recessed 40 mm here
// (ESTIMATED: the photo shows no depth, and the inside floor leaves no more), deep enough to hold the cord and plug
const yBay = cabTop - 0.8 * shellH, bayD = 0.04, zBay = zCabBack + bayD;
cab.add(faced("Base", inW, floorIn - standTop, zFront - zBay, [liner, liner, liner, standM, sidePaint, dark], 0, standTop + (floorIn - standTop) / 2, (zFront + zBay) / 2));
cab.add(faced("BackWall", inW, ceil - yBay, zIn - zCabBack, [liner, liner, liner, liner, liner, dark], 0, (ceil + yBay) / 2, (zIn + zCabBack) / 2));
cab.add(faced("BackWallLow", inW, yBay - floorIn, zIn - zBay, [liner, liner, liner, liner, liner, dark], 0, (yBay + floorIn) / 2, (zIn + zBay) / 2));
// the real back: LG's rear photo (DZ-11: the galvanised back with the compressor bay, the cord painted out), mapped
// straight on: u from the right side (+x, the photo's left seen from behind), v from the cabinet's top
function rearPanel(name, x0, x1, y0, y1, z) {
  const g = new THREE.PlaneGeometry(x1 - x0, y1 - y0).rotateY(Math.PI), cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
  const P = g.attributes.position, uv = g.attributes.uv;
  for (let i = 0; i < P.count; i++) uv.setXY(i, (W / 2 - (P.getX(i) + cx)) / W, (cabTop - (P.getY(i) + cy)) / shellH);
  return mesh(name, g, rearM, cx, cy, z);
}
const zPlate = zCabBack - 0.003;
cab.add(rearPanel("RearPlate", -W / 2, W / 2, yBay, cabTop, zPlate));
for (const sx of [-1, 1]) cab.add(rearPanel("RearPlate", sx < 0 ? -W / 2 : inW / 2, sx < 0 ? -inW / 2 : W / 2, standTop, yBay, zPlate));
cab.add(rearPanel("RearPlate", -inW / 2, inW / 2, standTop, yBay, zBay - 0.0005));
cab.add(box("BayTop", inW, 0.003, bayD + 0.003, dark, 0, yBay + 0.0015, zBay - (bayD + 0.003) / 2));
// (the bay's sides stand 1.5 mm in from the floor's ends, so no two faces share a plane: zfight)
for (const sx of [-1, 1]) cab.add(box("BaySide", 0.003, yBay - standTop, bayD, dark, sx * (inW / 2 - 0.003), (yBay + standTop) / 2, zBay - bayD / 2));
cab.add(box("BayFloor", inW, 0.003, zBay - zStandBack, dark, 0, standTop - 0.0015, (zBay + zStandBack) / 2));
// two dark spacers stand 14 mm off the back at each side (side photo: 944-1279 and 465-657 mm)
for (const sx of [-1, 1]) for (const [y0, y1] of [[0.944, 1.279], [0.465, 0.657]]) cab.add(box("RearSpacer", 0.012, y1 - y0, 0.011, dark, sx * (W / 2 - 0.008), (y0 + y1) / 2, zCabBack - 0.003 - 0.0055));
// hinges on the right: a dark cover on the cabinet's top behind the door (DZ-09, DZ-05: 90 mm across, 18 mm tall, 90 mm
// deep) and the bottom bracket under the door's right corner (fronts, DZ-03)
cab.add(box("HingeCoverTop", 0.09, 0.018, 0.09, hingeM, W / 2 - 0.045, cabTop + 0.009, zDoor - 0.002 - 0.045));
cab.add(box("HingeBottom", 0.035, 0.003, 0.07, chrome, W / 2 - 0.0205, standTop + 0.0025, zFront + 0.03));   // 3 mm in from the side: not in the stand post's plane
// power cord: its route traced on LG's rear photo (rear_paths.json: out of the compressor, through the clamp, toward
// the right side) inside the compressor bay; it stops 30 mm short of the side and the three-pin plug hangs flat
// against the bay's back, pins down, so no front, 3/4 or side view shows them (ESTIMATED past the photo's trace)
{
  const RP = JSON.parse(fs.readFileSync(`${T}/rear_paths.json`, "utf8"));
  const zc = zBay - 0.0005 - 0.0045, V = (x, y, z) => new THREE.Vector3(x, y, z), xMax = inW / 2 - 0.02;
  const pts = RP.cord.map(([u, v]) => V(W / 2 - u * W, cabTop - v * shellH, zc)).filter((p) => p.x <= xMax);
  const end = pts[pts.length - 1];
  const pw = 0.045, ph = 0.042, pt = 0.016, px = inW / 2 - 0.05, py = standTop + 0.02 + ph / 2, pz = zBay - 0.0005;
  pts.push(V(xMax, end.y - 0.02, zc), V(xMax - 0.004, py + ph / 2 + 0.03, zc), V(px + 0.004, py + ph / 2 + 0.006, pz - pt / 2 - 0.002));
  cab.add(mesh("PowerCord", new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts, false, "centripetal"), 90, 0.0035, 6, false), cordM));
  const sh = new THREE.Shape(), r = 0.012, w = pw, h = ph;
  sh.moveTo(-w / 2 + r, -h / 2); sh.lineTo(w / 2 - r, -h / 2); sh.quadraticCurveTo(w / 2, -h / 2, w / 2, -h / 2 + r);
  sh.lineTo(w / 2, h / 2 - r); sh.quadraticCurveTo(w / 2, h / 2, w / 2 - r, h / 2); sh.lineTo(-w / 2 + r, h / 2);
  sh.quadraticCurveTo(-w / 2, h / 2, -w / 2, h / 2 - r); sh.lineTo(-w / 2, -h / 2 + r); sh.quadraticCurveTo(-w / 2, -h / 2, -w / 2 + r, -h / 2);
  // the body flat against the bay's back (extruded away from it), the pins out of its bottom edge
  const plug = mesh("Plug", new THREE.ExtrudeGeometry(sh, { depth: pt - 0.004, bevelEnabled: true, bevelSize: 0.002, bevelThickness: 0.002, bevelSegments: 2, curveSegments: 8 }), plugM, px, py, pz - 0.002);
  plug.rotation.y = Math.PI;
  cab.add(plug);
  for (const [dx, dz] of [[-0.0095, -0.005], [0.0095, -0.005], [0, -0.011]]) cab.add(cyl("PlugPin", 0.0026, 0.0026, 0.016, pinM, px + dx, py - ph / 2 - 0.008, pz + dz, 10));
}

// ── inside: the freezer box, its flap, the knob and lamp panel ──
const xL = -inW / 2, xR = inW / 2, wt = 0.008;
// the cold-air cover under the ceiling: white, with a row of seven slots (DZ-04)
cab.add(box("VentPanel", inW, ceil - fbTop, fbZ1 - zIn, white, 0, (ceil + fbTop) / 2, (fbZ1 + zIn) / 2));
cab.add(mesh("VentSlots", mergeGeometries([0, 1, 2, 3, 4, 5, 6].map((i) => new THREE.BoxGeometry(0.052, 0.006, 0.002).translate(-0.198 + i * 0.066, (ceil + fbTop) / 2, fbZ1 + 0.001))), dark));
{
  const zc = (zIn + fbZ1) / 2, d = fbZ1 - zIn, h = fbTop - fbBot;
  cab.add(box("FreezerBoxFloor", panelX0 - xL, wt, d, white, (xL + panelX0) / 2, fbBot + wt / 2, zc));
  // tucked 1 mm inside the panel block, and stopping 1 mm behind the frame strip in front of it (no shared faces: zfight)
  cab.add(box("FreezerBoxRight", wt, h - 0.002, d - 0.013, white, panelX0 - wt / 2 - 0.0008, (fbBot + fbTop) / 2, zIn + (d - 0.013) / 2));
  // the frame round the flap: left strip, the strip between the flap's hinge and the panel, the band over the flap
  cab.add(box("FreezerFrameL", flX0 - xL, h, 0.012, white, (xL + flX0) / 2, (fbBot + fbTop) / 2, fbZ1 - 0.006));
  cab.add(box("FreezerFrameR", panelX0 - 0.003 - flX1, h, 0.012, white, (flX1 + panelX0 - 0.003) / 2, (fbBot + fbTop) / 2, fbZ1 - 0.006));
  cab.add(box("FreezerFrameTop", flX1 - flX0, fbTop - flY1, 0.012, white, (flX0 + flX1) / 2, (fbTop + flY1) / 2, fbZ1 - 0.006));
  cab.add(box("FreezerFrameBot", flX1 - flX0, flY0 - fbBot, 0.012, white, (flX0 + flX1) / 2, (fbBot + flY0) / 2, fbZ1 - 0.006));
  // the box's back: the cavity's back wall, grey, with "Fast Freezing Zone" across it (DZ-04: 126 mm wide)
  cab.add(box("FreezerBack", panelX0 - xL - wt - 0.002, h - wt, 0.004, linerDk, (xL + panelX0 - wt) / 2, (fbBot + fbTop + wt) / 2, zIn + 0.002));
  cab.add(printPlane("PrintFastFreeze", "fastfreeze", 126, 14, -0.04, 1.165, zIn + 0.0047));
  // the panel: white, the knob dial (LG's manual: 1 Low Cooling to 7 High Cooling) with its printed ring, "Lamp 10W" and
  // the lamp (DZ-04, DZ-05)
  const px0 = panelX0, px1 = xR, pcx = (px0 + px1) / 2;
  cab.add(box("ControlPanel", px1 - px0, h, d, white, pcx, (fbBot + fbTop) / 2, zc));
  const kx = 0.2045, ky = 1.228;
  cab.add(plane("DialRingDecal", 0.07, 0.07 / C.dial_fig.aspect, dialM, kx + (0.5 - C.dial_fig.cx) * 0.07, ky - (C.dial_fig.cy - 0.5) * 0.07 / C.dial_fig.aspect, fbZ1 + 0.0016));
  const k = mesh("KnobDial", new THREE.CylinderGeometry(0.021, 0.021, 0.016, 36), [knobSide, knobFace, knobSide], kx, ky, fbZ1 + 0.008);
  k.rotation.x = Math.PI / 2;
  cab.add(k);
  cab.add(cyl("KnobButton", 0.0055, 0.0055, 0.003, white, kx, ky, fbZ1 + 0.0175, 20).rotateX(Math.PI / 2));
  cab.add(printPlane("PrintLamp", "lamp", 15, 4, kx, 1.129, fbZ1 + 0.0007));
  const lamp = mesh("LedLampCover", new THREE.SphereGeometry(0.016, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2), lampM, kx, 1.091, fbZ1);
  lamp.rotation.x = Math.PI / 2; lamp.scale.set(1, 0.6, 1.3);
  cab.add(lamp);
}
// the flap: clear grey, hinged on its right edge (ESTIMATED: its grip is on the left, LG shows it shut only)
const flap = group("FreezerFlap", flX1, 0, fbZ1);
{
  const w = flX1 - flX0, yc = (flY0 + flY1) / 2, h = flY1 - flY0;
  flap.add(box("FlapPanel", w - 0.012, h - 0.012, 0.004, flapM, -w / 2, yc, 0.004));
  flap.add(box("FlapRimT", w, 0.006, 0.008, frosted, -w / 2, flY1 - 0.003, 0.004));
  flap.add(box("FlapRimB", w, 0.006, 0.008, frosted, -w / 2, flY0 + 0.003, 0.004));
  flap.add(box("FlapRimR", 0.006, h, 0.008, frosted, -0.003, yc, 0.004));
  flap.add(box("FlapRimL", 0.006, h, 0.008, frosted, -w + 0.003, yc, 0.004));
  // the grip: a curved recess on the flap's left (DZ-04, DZ-05: 40 mm wide, 150 mm tall), drawn as its raised rim
  flap.add(box("FlapGrip", 0.04, 0.15, 0.014, frosted, -w + 0.032, yc + 0.012, 0.009));
  flap.add(box("FlapLatch", 0.008, 0.03, 0.01, white, -w - 0.001, yc, 0.005));
}
cab.add(flap);
// the drain cup on the back wall under the chiller (DZ-04)
cab.add(box("DrainCup", 0.04, 0.05, 0.03, white, -0.154, 0.925, zIn + 0.015));

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
// the Fit Max Chiller Tray: clear, its frosted front with "Cool & Fresh Zone" (DZ-04: 122 mm wide), on runners
const ctZ0 = zIn + 0.012, ctW = inW - 0.014, ctZ = (ctZ0 + ctZ1) / 2;
{
  const hh = ctTop - ctBot;
  trays.add(box("ChillFloor", ctW, 0.004, ctZ1 - ctZ0, clear, 0, ctBot + 0.002, ctZ));
  for (const sx of [-1, 1]) trays.add(box("ChillSide", 0.004, hh, ctZ1 - ctZ0, clear, sx * (ctW / 2 - 0.002), ctBot + hh / 2, ctZ));
  trays.add(box("ChillBack", ctW, hh, 0.004, clear, 0, ctBot + hh / 2, ctZ0 + 0.002));
  trays.add(box("ChillFront", ctW, hh, 0.006, frosted, 0, ctBot + hh / 2, ctZ1 - 0.003));
  trays.add(printPlane("PrintCoolFresh", "coolfresh", 122, 14, 0, ctBot + hh / 2, ctZ1 + 0.0007));
  for (const sx of [-1, 1]) cab.add(box("ChillRunner", 0.006, 0.006, ctZ1 - ctZ0, linerDk, sx * (inW / 2 - 0.003), ctBot - 0.003, ctZ));
}
// the crisper's cover (glass with a frosted front band; LG: the Moist 'N' Fresh lattice cover) and the vegetable box
// (FzBox* are the names qa_bounds reads)
{
  const bd = frontFridge - 0.004 - zIn - 0.004;
  cab.add(box("CrisperCover", inW - 0.012, 0.005, bd, glass, 0, coverY - 0.0025, zIn + 0.004 + bd / 2));
  cab.add(box("CrisperCoverBand", inW - 0.012, 0.022, 0.012, frosted, 0, coverY - 0.011, frontFridge - 0.006));
  cab.add(box("MoistureSlider", 0.06, 0.008, 0.005, white, -0.08, coverY - 0.011, frontFridge + 0.0025));
  rails("CrisperCoverRail", coverY - 0.006, zIn, frontFridge - 0.012);
}
const vbW = inW - 0.016, vbZ0 = zIn + 0.008, vbZ1 = frontFridge, vbD = vbZ1 - vbZ0, vbZ = (vbZ0 + vbZ1) / 2;
{
  const hh = vbTop - vbBot;
  trays.add(box("FzBoxFloor", vbW, 0.004, vbD, clear, 0, vbBot + 0.002, vbZ));
  trays.add(box("FzBoxBack", vbW, hh, 0.004, clear, 0, vbBot + hh / 2, vbZ0 + 0.002));
  trays.add(box("FzBoxL", 0.004, hh, vbD, clear, -vbW / 2 + 0.002, vbBot + hh / 2, vbZ));
  trays.add(box("FzBoxR", 0.004, hh, vbD, clear, vbW / 2 - 0.002, vbBot + hh / 2, vbZ));
  trays.add(box("FzBoxFront", vbW, hh - 0.012, 0.004, clearLight, 0, vbBot + (hh - 0.012) / 2, vbZ1 - 0.002));
  trays.add(box("FzBoxRim", vbW + 0.006, 0.012, 0.008, frosted, 0, vbTop - 0.006, vbZ1 - 0.002));
}

// ── the base stand's drawer: a bowed front with LG's embossed mark (the photo) and the slot handle in its lip, the bin
// behind it, inside the stand (a real part: LG's DZ-03 and its feature photo show it pulled out with onions and potatoes)
const drawer = group("BaseDrawer");
cab.add(drawer);
const fw = W - 0.006, bow = 0.016, zf = (x) => zNose - bow * (2 * x / fw) ** 2;
{
  // the face: a grid bowed in plan, mapped straight on from the front photo
  const nx = 32, ny = 4, y0 = 0.006, pos = [], uv = [], idx = [];
  for (let j = 0; j <= ny; j++) for (let i = 0; i <= nx; i++) {
    const x = -fw / 2 + fw * i / nx, y = y0 + (faceTop - y0) * j / ny;
    pos.push(x, y, zf(x)); uv.push(i / nx, 1 - j / ny);
  }
  for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) { const a = j * (nx + 1) + i; idx.push(a, a + 1, a + nx + 2, a, a + nx + 2, a + nx + 1); }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2)); g.setIndex(idx); g.computeVertexNormals();
  drawer.add(mesh("DrawerFace", g, standFront));
  // its LG mark, painted out of the photo and drawn sharp here: 100 mm wide, centred 54% down the face (ESTIMATED from
  // the fronts, where it reads about 110 x 42 mm)
  const smW = 0.1, smH = smW * 160 / 349, smY = faceTop - 0.54 * (faceTop - y0);
  drawer.add(plane("StandMarkDecal", smW, smH, standMarkM, 0, smY, zNose + 0.0006));
  // the lip over it: rounds back 26 mm to the slot handle (fronts: the slot 169 mm wide at the middle)
  const lp = [], li = [];
  for (let j = 0; j <= 3; j++) for (let i = 0; i <= nx; i++) {
    const x = -fw / 2 + fw * i / nx, a = (j / 3) * Math.PI / 2;
    lp.push(x, faceTop + (lipTop - faceTop) * Math.sin(a), zf(x) - 0.026 * (1 - Math.cos(a)));
  }
  for (let j = 0; j < 3; j++) for (let i = 0; i < nx; i++) { const a = j * (nx + 1) + i; li.push(a, a + 1, a + nx + 2, a, a + nx + 2, a + nx + 1); }
  const lg = new THREE.BufferGeometry();
  lg.setAttribute("position", new THREE.Float32BufferAttribute(lp, 3)); lg.setIndex(li); lg.computeVertexNormals();
  drawer.add(mesh("DrawerLip", lg, standM));
  drawer.add(box("DrawerLipTop", fw - 0.004, 0.004, 0.03, standM, 0, lipTop - 0.002, zNose - 0.026 - 0.015));
  drawer.add(box("DrawerSlot", 0.169, 0.006, 0.012, dark, 0, lipTop - 0.001, zNose - 0.026 - 0.004));
  // the front's back and its ends
  const zb = zNose - bow - 0.012;
  drawer.add(box("DrawerFrontBack", fw, lipTop - y0, 0.012, standM, 0, (y0 + lipTop) / 2, zb - 0.006));
  for (const sx of [-1, 1]) drawer.add(box("DrawerFrontEnd", 0.004, lipTop - y0, zNose - bow - zb + 0.004, standM, sx * (fw / 2 - 0.002), (y0 + lipTop) / 2, (zb + zNose - bow) / 2));
}
// the bin: dark plastic, between the stand's posts
const dbW = W - 0.11, dbZ0 = -0.22, dbZ1 = zNose - bow - 0.024, dbFloor = 0.012, dbTop = 0.11;
{
  const zc = (dbZ0 + dbZ1) / 2, d = dbZ1 - dbZ0;
  drawer.add(box("DrawerBinFloor", dbW, 0.004, d, dark, 0, dbFloor - 0.002, zc));
  for (const sx of [-1, 1]) drawer.add(box("DrawerBinSide", 0.004, dbTop - dbFloor + 0.004, d, dark, sx * (dbW / 2 - 0.002), (dbTop + dbFloor - 0.004) / 2, zc));
  drawer.add(box("DrawerBinBack", dbW, dbTop - dbFloor + 0.004, 0.004, dark, 0, (dbTop + dbFloor - 0.004) / 2, dbZ0 + 0.002));
}

// ── stock: vegetarian South Indian food, eggs, juices, water and soft drinks (stock_lg.mjs, food.mjs) ──
stock.shelves(trays, {
  zIn1: zIn, inW, inD: frontFridge - zIn, s1: s1 - 0.0005, s2: s2 - 0.0005, s3: s3 - 0.0005, fz: vbBot + 0.004, fit: true, vz0: vbZ0 + 0.02, vk: 0.6,
  shelfB: { hw: inW / 2 - 0.03, z0: zIn + 0.022, z1: frontFridge - 0.015 },
  drawerB: { hw: vbW / 2 - 0.014, z0: vbZ0 + 0.02, z1: vbZ1 - 0.008, y0: vbBot + 0.004 },
  drawerCeil: coverY - 0.005 - 0.01 - (vbBot + 0.004),
});
// the shelves are 274 mm deep, so the 343 L's rows are laid out again here: one or two rows per shelf, the rest left out
const bbox = (o) => { o.updateWorldMatrix(true, true); return new THREE.Box3().setFromObject(o); };
function row(items, x0, x1, z0) {
  const bs = items.map(bbox), w = bs.reduce((s, b) => s + b.max.x - b.min.x, 0), gap = (x1 - x0 - w) / (items.length + 1);
  if (gap < 0.006) console.warn(`row: ${items.map((o) => o.name)} leave ${(gap * 1000).toFixed(0)} mm between them`);
  let x = x0 + gap, dep = 0;
  items.forEach((o, i) => { const b = bs[i]; o.position.x += x - b.min.x; o.position.z += z0 - b.min.z; x += b.max.x - b.min.x + gap; dep = Math.max(dep, b.max.z - b.min.z); });
  return dep;
}
const kids = (g, name) => g.children.filter((o) => o.name === name);
const drop = (...os) => os.forEach((o) => o?.parent?.remove(o));
if (process.env.GLD_SIZES) for (const n of ["Shelf1Stock", "Shelf2Stock", "Shelf3Stock"]) for (const o of trays.getObjectByName(n).children) { const b = bbox(o); console.log(n, o.name, ...["x", "y", "z"].map((k) => ((b.max[k] - b.min[k]) * 1000).toFixed(0))); }
{
  const hw = inW / 2 - 0.03, z0 = zIn + 0.022, z1 = frontFridge - 0.015, fits = (d, n) => d > z1 - z0 && console.warn(`${n}: rows ${(d * 1000).toFixed(0)} mm deep, shelf ${((z1 - z0) * 1000).toFixed(0)}`);
  { // top shelf, 130 mm under the chiller: the buttermilk, the biryani box and the milk pile; the tiffin and batter are too tall
    const g = trays.getObjectByName("Shelf1Stock");
    drop(g.getObjectByName("Tiffin"), g.getObjectByName("IdBatterPouch1"));
    const milk = g.getObjectByName("NandiniMilk"), pile = ["AavinMilk", "AmulTaazaPouch"].map((n) => g.getObjectByName(n)).filter(Boolean), m0 = milk.position.clone();
    fits(0.02 + row([g.getObjectByName("RnrBiryaniBox"), milk, g.getObjectByName("MastiButtermilk")], -hw, hw, z0 + 0.02), "Shelf1Stock");   // clear of the drain cup
    const d = milk.position.clone().sub(m0);
    pile.forEach((o) => o.position.add(d));
  }
  { // middle shelf: the coconut and the melon
    const g = trays.getObjectByName("Shelf2Stock");
    drop(g.getObjectByName("RnrBiryani"), g.getObjectByName("NandhanaPalace"), g.getObjectByName("NandhanaPalace2"));
    fits(row([g.getObjectByName("CoconutHalf"), g.getObjectByName("WatermelonHalf")], -hw, hw, z0), "Shelf2Stock");
  }
  { // bottom shelf: bananas, grapes and an apple, then an orange and a lemon in front of the grapes
    const g = trays.getObjectByName("Shelf3Stock");
    const [a0, a1, a2, a3, a4] = kids(g, "Apple"), [o0, o1, o2] = kids(g, "Orange"), [l0, l1] = kids(g, "Lemon");
    drop(g.getObjectByName("AmulMastiDahi"), a0, a1, a3, a4, o1, o2, l0);
    const ban = g.getObjectByName("Bananas"), gr = g.getObjectByName("Grapes");
    row([ban, gr, a2], -hw, hw, z0);
    const d1 = Math.max(bbox(gr).max.z, bbox(a2).max.z) - z0 + 0.012;
    fits(d1 + row([o0, l1], bbox(ban).max.x, hw, z0 + d1), "Shelf3Stock");
  }
}
// what is too tall for the space over its shelf, or reaches past the shelf's sides or front, is left out
{
  const shw = inW / 2 - 0.03;
  const over = { Shelf1Stock: ctBot - 0.012, Shelf2Stock: s1 - 0.0145 - 0.01, Shelf3Stock: s2 - 0.0145 - 0.01 };
  for (const [n, top] of Object.entries(over)) leaveOut(trays.getObjectByName(n), [B3(-1, 0, frontFridge - 0.014, 1, 2, 1), B3(-1, 0, -1, -shw - 0.003, 2, 1), B3(shw + 0.003, 0, -1, 1, 2, 1), B3(-1, top, -1, 1, 3, 1)], `too tall for ${n}'s space, or past its sides or front`);
}
trays.getObjectByName("Cauliflower")?.traverse((m) => {
  if (!m.isMesh) return;
  m.updateMatrix(); m.geometry = m.geometry.clone().applyMatrix4(m.matrix);
  m.position.set(0, 0, 0); m.rotation.set(0, 0, 0); m.scale.set(1, 1, 1);
});
// the vegetable box is 290 mm deep inside, so the 340 mm drumsticks are left out; what lay on them is lowered straight
// down until it rests on the box floor or on what is under it, lowest first (nothing is ever raised)
{
  const v = trays.getObjectByName("FreshZoneStock");
  const out = kids(v, "Drumstick");
  drop(...out);
  if (out.length) console.log(`left out (longer than the vegetable box is deep): ${out.length} Drumstick`);
  // stock_lg's heap finds no steady spot under this box's lower cover for the top capsicum, what lies on it, the curry
  // leaves, and the tomatoes and chillies balanced on a capsicum or the cauliflower: they are left out too
  {
    const caps = kids(v, "Capsicum").map((o) => [o, bbox(o)]).sort((a, b) => b[1].max.y - a[1].max.y)[0];
    const on = caps ? v.children.filter((o) => { const b = bbox(o); return o !== caps[0] && b.min.y > caps[1].min.y + 0.03 && b.max.x > caps[1].min.x && b.min.x < caps[1].max.x && b.max.z > caps[1].min.z && b.min.z < caps[1].max.z; }) : [];
    const over = (top, name) => kids(v, top).flatMap((t) => { const tb = bbox(t); return kids(v, name).filter((o) => { const b = bbox(o); return b.min.y > tb.min.y + 0.03 && b.max.x > tb.min.x && b.min.x < tb.max.x && b.max.z > tb.min.z && b.min.z < tb.max.z; }); });
    const gone = [...new Set([caps?.[0], ...on, ...kids(v, "CurryLeaves"), ...over("Capsicum", "Tomato"), ...over("Capsicum", "GreenChilli"), ...over("Cauliflower", "GreenChilli")])].filter(Boolean);
    drop(...gone);
    console.log(`left out (no steady spot under the cover): ${gone.map((o) => o.name).join(", ")}`);
  }
  // rays down from each of its points onto what is already placed, and up from the placed points under it onto it
  const floorY = vbBot + 0.004, rc = new THREE.Raycaster(), DOWN = new THREE.Vector3(0, -1, 0), UP = new THREE.Vector3(0, 1, 0);
  const meshesOf = (o) => { const r = []; o.traverse((m) => m.isMesh && r.push(m)); return r; };
  const pts = (o) => { o.updateWorldMatrix(true, true); const r = []; for (const m of meshesOf(o)) { const p = m.geometry.attributes.position; for (let i = 0; i < p.count; i++) r.push(new THREE.Vector3().fromBufferAttribute(p, i).applyMatrix4(m.matrixWorld)); } return r; };
  const placed = [], placedPts = [];
  for (const o of v.children.map((o) => ({ o, y: bbox(o).min.y })).sort((a, b) => a.y - b.y).map((e) => e.o)) {
    const P = pts(o), B = bbox(o), mine = meshesOf(o);
    let d = Math.min(...P.map((p) => p.y - floorY));
    for (const p of P) { rc.set(p, DOWN); const h = rc.intersectObjects(placed, false)[0]; if (h) d = Math.min(d, h.distance); }
    for (const q of placedPts) {
      if (q.x < B.min.x || q.x > B.max.x || q.z < B.min.z || q.z > B.max.z || q.y > B.max.y) continue;
      rc.set(q, UP); const h = rc.intersectObjects(mine, false)[0]; if (h) d = Math.min(d, h.distance);
    }
    if (d > 0.0008) o.position.y -= d - 0.0003;
    placed.push(...mine); placedPts.push(...pts(o));
  }
}
// the chiller tray: butter, cheese and curd cups (LG stocks it with dairy: "milk, dairy products, and beverages")
stock.fresh0(trays, { y: ctBot + 0.004, z: ctZ, bx: -0.17, cx: 0.09, ex: -0.03 });
// the freezer box: the two tubs stacked and the frozen packs beside them; nothing lies on a shelf (it has none)
stock.freezer(cab, { fit: true, zIn1: zIn, floor: fbBot + wt, top: fbTop, box: { hw: (flX1 - xL) / 2 - 0.02, z0: zIn + 0.02, z1: fbZ1 - 0.02 } });
{
  const f = cab.getObjectByName("FreezerStock");
  if (f) f.position.x += (xL + flX1) / 2 - 0.005;
  cab.getObjectByName("OnFreezerShelf")?.removeFromParent();
  leaveOut(f, [B3(-1, fbTop - wt - 0.008, -1, 1, 3, 1), B3(-1, 0, fbZ1 - 0.012, 1, 3, 1), B3(flX1 - 0.006, 0, -1, 1, 3, 1)], "past the freezer box");
}
// the base drawer: red onions on the left, potatoes on the right, one layer at the front (LG's DZ-03); copies of the
// vegetable box's own onions and potatoes
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
  place(on, "Onion", [-0.185, -0.085], [0.03, 0.13]);
  place(po, "Potato", [0.085, 0.185], [0.03, 0.13]);
}

// ── the door: hinged on the right; a PET front with rounded sides and top (LG's fronts: the highlight bands span the
// outer 65 mm each side; the side photo: the face falls back about 35 mm round them), the Ariana handle, the lock ──
const SK = { a: 0.065, b: 0.035, at: 0.03, bt: 0.035, ab: 0.004, bb: 0.004, rc: 0.04 };
const ell = (d, a, b) => (d >= a ? 0 : b * (1 - Math.sqrt(Math.max(0, 1 - (1 - d / a) ** 2))));
function doorSkin(w, h, t) {
  const dense = (n) => [...Array(n + 1)].map((_, i) => 1 - Math.cos((i / n) * Math.PI / 2));
  const xs = [...new Set([
    ...dense(12).map((s) => -w / 2 + SK.a * s), ...[...Array(25)].map((_, i) => -w / 2 + SK.a + (w - 2 * SK.a) * i / 24), ...dense(12).map((s) => w / 2 - SK.a * s),
  ].map((v) => +v.toFixed(6)))].sort((p, q) => p - q);
  const ys = [...new Set([
    0, 0.002, 0.004, ...[...Array(41)].map((_, i) => 0.004 + (h - SK.rc - 0.004) * i / 40), ...dense(12).map((s) => h - SK.rc * s),
  ].map((v) => +v.toFixed(6)))].sort((p, q) => p - q);
  const nx = xs.length, ny = ys.length, pos = [], uv = [], idx = [], ring = [];
  for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
    let x = xs[i], y = ys[j], corner = 0;
    const cx = Math.sign(x) * (w / 2 - SK.rc), cy = h - SK.rc;
    if (Math.abs(x) > w / 2 - SK.rc && y > cy) {
      const d = Math.hypot(x - cx, y - cy);
      if (d > SK.rc) { x = cx + (x - cx) * SK.rc / d; y = cy + (y - cy) * SK.rc / d; }
      corner = ell(SK.rc - Math.hypot(x - cx, y - cy), SK.at, SK.bt);
    }
    const fall = Math.max(ell(w / 2 - Math.abs(x), SK.a, SK.b), ell(h - y, SK.at, SK.bt), ell(y, SK.ab, SK.bb), corner);
    pos.push(x, y, t - fall); uv.push((x + w / 2) / w, (h - y) / h);
  }
  for (let j = 0; j < ny - 1; j++) for (let i = 0; i < nx - 1; i++) { const a = j * nx + i; idx.push(a, a + 1, a + nx + 1, a, a + nx + 1, a + nx); }
  // the outline, anticlockwise seen from the front: the foot, the right side, the top, the left side
  for (let i = 0; i < nx; i++) ring.push(i);
  for (let j = 1; j < ny; j++) ring.push(j * nx + nx - 1);
  for (let i = nx - 2; i >= 0; i--) ring.push((ny - 1) * nx + i);
  for (let j = ny - 2; j > 0; j--) ring.push(j * nx);
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2)); g.setIndex(idx); g.computeVertexNormals();
  return { geo: g, ring: ring.map((k) => [pos[3 * k], pos[3 * k + 1], pos[3 * k + 2]]) };
}
// the band round the door from the face's outline back to the door's back; the top falls 20 mm towards the back (side photo)
function doorBand(ring, h) {
  const back = ([x, y]) => [x, y - 0.02 * Math.min(1, Math.max(0, (y - (h - SK.rc - 0.02)) / (SK.rc + 0.02))), 0];
  const pos = [], idx = [], n = ring.length;
  ring.forEach((p) => pos.push(...p, ...back(p)));
  for (let k = 0; k < n; k++) { const k1 = (k + 1) % n, f0 = 2 * k, b0 = 2 * k + 1, f1 = 2 * k1, b1 = 2 * k1 + 1; idx.push(f0, b0, f1, f1, b0, b1); }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx); g.computeVertexNormals();
  const sh = new THREE.Shape(ring.map((p) => new THREE.Vector2(...back(p).slice(0, 2))));
  const cap = flipFaces(new THREE.ShapeGeometry(sh));
  return { band: g, cap };
}
const fridgeDoor = group("FridgeDoor", W / 2, doorBot, zDoor);
{
  const { geo, ring } = doorSkin(pw, dh, T_);
  geo.translate(-pw / 2, 0, 0);
  fridgeDoor.add(mesh("DoorFaceSkin", geo, doorFace));
  const { band, cap } = doorBand(ring, dh);
  band.translate(-pw / 2, 0, 0); cap.translate(-pw / 2, 0, 0);
  fridgeDoor.add(mesh("DoorSides", band, doorEdge));
  fridgeDoor.add(mesh("DoorBack", cap, linerSide));
  // decals: the LG mark 52 mm wide at the door's middle, 94 mm under its top; the energy label 84 mm wide (its own
  // aspect), its middle 103 mm left of the right edge and 174 mm down (the Shiny Steel front)
  fridgeDoor.add(plane("LgMarkDecal", 0.052, 0.052 * 160 / 349, logoM, -pw + 0.497 * pw, dh - 0.075 * dh, T_ + 0.0008));
  fridgeDoor.add(plane("BeeLabelDecal", 0.084, 0.084 / C.label_aspect, labelM, -pw + 0.8255 * pw, dh - 0.1395 * dh, T_ + 0.0008));
  // the key lock: a chrome barrel at the left, at half the door's height (fronts)
  const lx = -pw + 0.150 * pw, ly = dh - 0.5007 * dh;
  // the lock: about 22 mm across on LG's front photo (15 px at 1.5 mm per px, ESTIMATED)
  fridgeDoor.add(cyl("DoorLock", 0.011, 0.011, 0.005, chrome, lx, ly, T_ + 0.0025, 28).rotateX(Math.PI / 2));
  fridgeDoor.add(box("LockKeyhole", 0.002, 0.009, 0.001, dark, lx, ly, T_ + 0.0055));
  // the Ariana handle: a chrome bar 42 mm wide in its pocket, its middle standing 32 mm proud of the face (side photo:
  // the handle's front at 305 mm), its ends curving back into the pocket; 0.306 of the door's height long (fronts)
  const L = 0.306 * dh, bw = 0.042, bt = 0.014, rEnd = 0.06, P = 0.032 - bt / 2;
  const sh = new THREE.Shape(), r = 0.006;
  sh.moveTo(-bw / 2 + r, -bt / 2); sh.lineTo(bw / 2 - r, -bt / 2); sh.quadraticCurveTo(bw / 2, -bt / 2, bw / 2, -bt / 2 + r);
  sh.lineTo(bw / 2, bt / 2 - r); sh.quadraticCurveTo(bw / 2, bt / 2, bw / 2 - r, bt / 2); sh.lineTo(-bw / 2 + r, bt / 2);
  sh.quadraticCurveTo(-bw / 2, bt / 2, -bw / 2, bt / 2 - r); sh.lineTo(-bw / 2, -bt / 2 + r); sh.quadraticCurveTo(-bw / 2, -bt / 2, -bw / 2 + r, -bt / 2);
  let hg = new THREE.ExtrudeGeometry(sh, { depth: L, steps: 48, bevelEnabled: false, curveSegments: 4 });
  hg.deleteAttribute("uv"); hg.deleteAttribute("normal");
  hg = mergeVertices(hg);
  const q = hg.attributes.position;
  for (let i = 0; i < q.count; i++) {
    const s = q.getZ(i) - L / 2, a = Math.abs(s), t = Math.max(0, (a - (L / 2 - rEnd)) / rEnd);
    const zc = P - (P + 0.01) * (1 - Math.sqrt(Math.max(0, 1 - t * t)));
    q.setXYZ(i, q.getX(i), s, q.getY(i) + zc);
  }
  hg.computeVertexNormals();
  fridgeDoor.add(mesh("HandleBar", hg, chrome, -pw + 0.149 * pw, dh - 0.243 * dh, T_));
  // inside: the gasket in the gap, the liner, the baskets
  const lw = 0.48, ly0 = floorIn - doorBot, ly1 = ceil - doorBot;
  fridgeDoor.add(box("GasketT", pw - 0.04, 0.016, 0.01, gasket, -pw / 2, ly1 + 0.012, -0.005));
  fridgeDoor.add(box("GasketB", pw - 0.04, 0.016, 0.01, gasket, -pw / 2, 0.012, -0.005));
  fridgeDoor.add(box("GasketL", 0.016, ly1 + 0.004 - 0.02, 0.01, gasket, -pw + 0.028, (ly1 + 0.024) / 2, -0.005));
  fridgeDoor.add(box("GasketR", 0.016, ly1 + 0.004 - 0.02, 0.01, gasket, -0.028, (ly1 + 0.024) / 2, -0.005));
  fridgeDoor.add(box("DoorLiner", lw, ly1 - ly0 - 0.004, 0.012, liner, -pw / 2, (ly0 + ly1) / 2, -linerFace + 0.006));
}
// baskets: the liner's face is 16 mm in; two pairs at the top, then the wide basket, the bottle basket and the can basket
const bkW = 0.47, half = (bkW - 0.01) / 2;
const addBasket = (n, w, b, x) => { const k = basket(n, w, b.d, b.h); k.position.x = x; k.position.y = b.y; fridgeDoor.add(k); };
addBasket("TopBasketL", half, BK.top, -pw / 2 - (bkW - half) / 2);
addBasket("TopBasketR", half, BK.top, -pw / 2 + (bkW - half) / 2);
addBasket("MidBasketL", half, BK.second, -pw / 2 - (bkW - half) / 2);
addBasket("MidBasketR", half, BK.second, -pw / 2 + (bkW - half) / 2);
addBasket("WideBasket", bkW, BK.wide, -pw / 2);
addBasket("BottleBasket", bkW, BK.bottle, -pw / 2);
addBasket("CanBasket", bkW, BK.can, -pw / 2);
// the eggs in the right top basket (LG's stocked photo), in a cup strip
const eggX = [0, 1, 2, 3].map((i) => -pw / 2 + (bkW - half) / 2 - 0.078 + i * 0.052);
fridgeDoor.add(box("EggCupsRib", half - 0.02, 0.006, 0.05, clearRib, -pw / 2 + (bkW - half) / 2, BK.top.y + 0.007, -linerFace - BK.top.d / 2));
{
  const inside = (dep) => [-pw / 2 - bkW / 2 + 0.006, -pw / 2 + bkW / 2 - 0.006, -(linerFace + dep / 2)];
  const deps = { egg: BK.top.d, jar: BK.wide.d, bottle: BK.bottle.d, can: BK.can.d };
  stock.doorFridge(fridgeDoor, { fit: true, eggY: BK.top.y, eggX, jarY: BK.wide.y, botY: BK.bottle.y, canY: BK.can.y, deps, inside });
}
root.add(fridgeDoor);

const parts = productParts(PRODUCTS, ID);
const clips = stateClips(root, parts);
saveZones(PRODUCTS, ID, root, parts);
const textures = {
  DoorFace: `${T}/door_${F0.slug}.jpg`, StandFront: `${T}/stand_${F0.slug}.jpg`, StandMark: `${T}/standmark_${F0.slug}.png`, StandRear: `${T}/stand_rear.jpg`, RearPlate: `${T}/rear.jpg`,
  LabelBEE: `${T}/label.png`, LgMark: `${T}/lgmark_${F0.mark}.png`, KnobFace: `${T}/knob.jpg`, DialRing: `${T}/dial_ring.png`,
  Print_fastfreeze: `${T}/print_fastfreeze.png`, Print_coolfresh: `${T}/print_coolfresh.png`, Print_lamp: `${T}/print_lamp.png`,
};
Object.assign(textures, stock.textures());
{ const used = new Set(); root.traverse((o) => o.isMesh && [].concat(o.material).forEach((m) => used.add(m.name))); for (const k of Object.keys(textures)) if (!used.has(k)) delete textures[k]; }
// Grain: the Shiny Steel door gets the soft hairline up the door with a clear coat (the printed doors carry none: the
// variants take it off); the painted cabinet and the stand's plastic a soft peel. The decals carry none.
await exportGLB(root, clips, OUT, textures, { dir: `${TEX}/grain`, materials: {
  DoorFace: { type: "hairline_soft", dir: "v", clearcoat: F0.door.coat },
  SidePaint: { type: "peel_soft" }, TopPaint: { type: "peel_soft" }, StandPlastic: { type: "peel_soft" },
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
  const coatExt = R.listExtensionsUsed().find((e) => e.extensionName === "KHR_materials_clearcoat") || doc.createExtension(KHRMaterialsClearcoat);
  const varExt = doc.createExtension(KHRMaterialsVariants), specExt = doc.createExtension(KHRMaterialsSpecular);
  const hex = (c) => [((c >> 16) & 255) / 255, ((c >> 8) & 255) / 255, (c & 255) / 255].map((v) => Math.pow(v, 2.2));   // sRGB to linear, as three.js writes it
  const VARY = ["DoorFace", "DoorEdge", "SidePaint", "TopPaint", "StandPlastic", "StandFront", "LgMark", "StandMark"];
  const base = Object.fromEntries(VARY.map((n) => [n, byName(n)]));
  for (const n of VARY) if (!base[n]) throw new Error(`no material ${n}`);
  const mats = FIN.map((f, i) => {
    const out = {};
    for (const n of VARY) {
      if (i === 0) { out[n] = base[n]; continue; }
      const m = base[n].clone().setName(`${n}_${f.slug}`);
      if (n === "DoorFace") {
        m.setBaseColorTexture(image(`${T}/door_${f.slug}.jpg`, `DoorFace_${f.slug}`)).setBaseColorFactor([1, 1, 1, 1]);
        m.setMetallicFactor(f.door.metal).setRoughnessFactor(f.door.rough);
        m.setNormalTexture(null); m.setMetallicRoughnessTexture(null);
        m.setExtension("KHR_materials_clearcoat", f.door.coat ? coatExt.createClearcoat().setClearcoatFactor(f.door.coat[0]).setClearcoatRoughnessFactor(f.door.coat[1]) : null);
        // the printed film under its gloss has no reflection of its own (KHR_materials_specular 0), as a glass door's colour
        // layer: its soft one laid a grey veil over the dark grounds at 3/4 under the page's light. The Apple files don't
        // carry it (NOTES.md, finesse pass)
        if (f.door.spec0) m.setExtension("KHR_materials_specular", specExt.createSpecular().setSpecularFactor(0));
      }
      if (n === "StandFront") m.setBaseColorTexture(image(`${T}/stand_${f.slug}.jpg`, `StandFront_${f.slug}`));
      if (n === "DoorEdge") m.setBaseColorFactor([...hex(f.edge), 1]);
      if (n === "SidePaint") m.setBaseColorFactor([...hex(f.side), 1]);
      if (n === "TopPaint") m.setBaseColorFactor([...hex(f.top), 1]);
      if (n === "StandPlastic") m.setBaseColorFactor([...hex(f.stand), 1]);
      if (n === "StandMark") m.setBaseColorTexture(image(`${T}/standmark_${f.slug}.png`, `StandMark_${f.slug}`));
      if (n === "LgMark") m.setBaseColorTexture(image(`${T}/lgmark_${f.mark}.png`, `LgMark_${f.mark}`));
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
