// Samsung RR21H2H25BR/HL, 189 L direct-cool single door with the Base Stand Drawer and the Digital Inverter Compressor,
// in the eleven colours Samsung India shows this body in with photos: Begonia Red (RR21H2H25BR, the listed one, the
// default), Begonia Blue (BB), Camellia Purple (CR), Camelia Blue (CU), Paradise Bloom Blue (9U), Midnight Blossom Blue
// (UZ), Hydrangea Blue (HS), Hydrangea Plum (HT), Paradise Bloom Purple (9R), Wild Lily Blue (WB) and Elegant Inox (S8).
// One body, so one GLB with the colours as KHR_materials_variants. Samsung's twelfth chip, Midnight Blossom Red (RZ),
// has no page and no photos on Samsung India, so it is left out.
// Built to Samsung India's published size for this code, 565 W x 1320 H (with the hinge) x 710 D (with the handle) mm,
// 665 mm without the handle and 560 mm without the door, 1270 mm without the hinge (the cabinet's top: the "Crown Door"
// rises over it). Samsung's straight-on fronts of all eleven codes draw the body at exactly 565 x 1320 px, so they are
// read at 1.0 px per mm; the open-door photo at 0.943 px per mm (the stand's 533 px). Every number and how it was got is
// in the private research notes (NOTES.md).
// What it is: a cabinet on a dark base stand whose front is a drawer (Samsung: "for food items that don't need cooling,
// such as potatoes and onions"); one door hinged on the right, its face curved across ("Horizontal Curve Design") with a
// round top (Samsung: "Crown Door design features a round-top shape ... and a new horizontal handle"), the chrome H-bar
// handle across its top and the key lock on the left; inside, the freezer box ("Super Freeze Zone") behind a clear flap
// hinged on its right, the temperature-control panel and its knob right of it, the vent slots over it, the chiller tray
// under it, the LED lamp on the back wall, two toughened glass shelves, the Vege Box under its glass cover; in the door
// five pockets (Samsung's spec: 5, transparent GPPS): a top pocket, two egg pockets side by side, a middle pocket and the
// deep bottle pocket. The shelves, the chiller tray, the cover and the Vege Box come out with their food (FridgeTrays).
// Stocked for a south Indian kitchen; the base drawer with potatoes and onions as in Samsung's photo of it.
// usage: node make_samsung_rr21.mjs <entry .json, never products.json> <tex dir> <out.glb>
import fs from "node:fs";
import { mergeGeometries, mergeVertices } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { NodeIO } from "@gltf-transform/core";
import { ALL_EXTENSIONS, KHRMaterialsVariants, KHRMaterialsClearcoat } from "@gltf-transform/extensions";
import { THREE, mat, mesh, box, faced, group, flipV, stateClips, exportGLB, productParts, saveZones } from "./lib.mjs";
import { LGStock } from "./stock_lg.mjs";

const [PRODUCTS, TEX, OUT] = process.argv.slice(2);
const ID = "samsung-rr21h2h25brhl";
const T = `${TEX}/samsung_rr21`;
const C = JSON.parse(fs.readFileSync(`${T}/colours.json`, "utf8"));

// ── size (metres) ──
const W = 0.565, H = 1.320, D = 0.710;                 // Samsung India: 56.50 cm x 1.32 m (with hinge) x 71.00 cm (with handle)
const zB = -D / 2;
const zFront = zB + 0.560;                             // Samsung India: 56.00 cm deep without the door
const zFace = zB + 0.665;                              // the door's face at its middle: 66.50 cm without the handle
const cabTop = 1.270;                                  // Samsung India: 1.27 m without the hinge (the cabinet's top)
const standTop = 0.150, standFoot = 0.013;             // the stand under the cabinet (fronts: its top row 1330, its foot 1467)
const standBackTop = 0.118;                            // the stand's back is lower (rear photo: row 1310)
const zNose = 0.295;                                   // the drawer's front (ESTIMATED: the manual draws the stand model's depth along the stand)
const doorBot = 0.155, doorTop = H;                    // the door: the seam over the stand (row 1325) to its top (row 159)
const zDoor = zFront + 0.010;                          // the door's back (ESTIMATED: a 10 mm gasket gap)
const T_ = zFace - zDoor;                              // the door to its face at the middle: 95 mm
const wall = 0.030, inW = W - 2 * wall;                // walls (ESTIMATED: the open photo's 22 mm flange and the freezer box's 38 mm gaps)
const floorIn = 0.228, ceil = 1.243;                   // the cavity's floor and ceiling at the opening (open photo rows 1254 and 296)
const zIn = zB + 0.055;                                // the cavity's back (ESTIMATED: a 55 mm back wall)
const bayTop = 0.412, bayD = 0.15;                     // the compressor bay (rear photo: open to row 1016; its depth ESTIMATED)
const stepTop = bayTop + 0.03, stepZ = zB + bayD + 0.03;   // the hump the bay makes in the cavity's back (ESTIMATED)
// inside, off the empty open photo at 0.943 px per mm, items behind the opening scaled up 3% about the eye (row 820):
const fbBot = 1.024, fbTop = 1.215;                    // the freezer box's frame (rows 512 and 337)
const fbX0 = -0.219, fbX1 = 0.218;                     // its columns 610-1022
const flX0 = -0.207, flX1 = 0.164, flY0 = 1.032, flY1 = 1.200;   // the clear flap (columns 622-972), its grip on the left
const pnX0 = 0.166;                                    // the temperature-control panel (columns 974-1021)
const ventY = 1.227;                                   // the eleven vent slots just over the box (rows 340-346, columns 649-942;
                                                       // in the close-up they sit in the band over the box, so put 12 mm over its top)
const ctBot = 0.942, ctTop = 1.016;                    // the chiller tray (rows 517-590)
const s1 = 0.776, s2 = 0.657;                          // the glass shelves' tops (rows 739, 848)
const coverY = 0.505;                                  // the Vege Box's glass cover (row 988)
const vbBot = 0.232, vbTop = 0.471;                    // the Vege Box (rows 1019-1238)
// the door: its liner stands 25 mm into the cabinet; the pockets hang off it (open photo: floors and wall heights)
const pw = W - 0.002, dh = doorTop - doorBot;
const linerFace = 0.025;
const BK = {
  top: { y: 1.075 - doorBot, d: 0.08, h: 0.09 },
  egg: { y: 0.904 - doorBot, d: 0.07, h: 0.06 },
  mid: { y: 0.595 - doorBot, d: 0.085, h: 0.1 },
  bottle: { y: 0.236 - doorBot, d: 0.095, h: 0.11 },
};
const zLiner = zDoor - linerFace;                                  // the liner's face, cabinet coordinates
const frontFridge = zLiner - BK.bottle.d - 0.012;                  // shelves and boxes stop short of the deepest pocket
const fbZ1 = zLiner - BK.top.d - 0.03;                             // the freezer box's front, its flap's grip 10 mm short of the top pocket
const ctZ1 = zLiner - BK.egg.d - 0.012;                            // the chiller tray's front, short of the egg pockets

// ── the colours ──
// door: its print (door_<slug>.jpg) and finish; edge: the door's sides (the print's ground); side, top: the painted
// cabinet; stand: the base stand's plastic; mark: the SAMSUNG wordmark's ink. Read off each colour's photos by
// tex_samsung_rr21.py (colours.json); the sides of the four colours with no 3/4 view take their stand's colour (ESTIMATED)
const hexOf = (s) => parseInt(s.slice(1), 16);
const SIDE = { camellia_purple: C.side_measured.cr, hydrangea_plum: C.side_measured.ht, elegant_inox: C.side_measured.s8 };
const NAMES = [
  ["begonia_red", "Begonia Red", "RR21H2H25BR"], ["begonia_blue", "Begonia Blue", "RR21H2H25BB"], ["camellia_purple", "Camellia Purple", "RR21H2H25CR"],
  ["camelia_blue", "Camelia Blue", "RR21H2H25CU"], ["paradise_bloom_blue", "Paradise Bloom Blue", "RR21H2H259U"], ["midnight_blossom_blue", "Midnight Blossom Blue", "RR21H2H25UZ"],
  ["hydrangea_blue", "Hydrangea Blue", "RR21H2H25HS"], ["hydrangea_plum", "Hydrangea Plum", "RR21H2H25HT"], ["paradise_bloom_purple", "Paradise Bloom Purple", "RR21H2H259R"],
  ["wild_lily_blue", "Wild Lily Blue", "RR21H2H25WB"], ["elegant_inox", "Elegant Inox", "RR21H2H25S8"],
];
// the printed doors are a printed film on steel, no grain. No clear coat: with one (0.3 / 0.1, roughness
// 0.45) the page's light strip laid a milky veil over the dark prints at -28 deg, 1.57-1.87 x their front against 0.98-1.21
// in Samsung's 3/4 photos; roughness 0.6 and no coat reads 1.04-1.12. The Elegant Inox keeps a light coat (0.3) with the
// photo's light bands in its texture: 1.16 x its front at -28 deg against 1.05 in Samsung's 3/4 photo.
const PRINT = { metal: 0.15, rough: 0.6, coat: null };
const STEEL = { metal: 0.38, rough: 0.6, coat: [0.3, 0.22], grain: true };
const FIN = NAMES.map(([slug, name, code]) => {
  const side = SIDE[slug] || C.stand[slug];
  return { slug, name, variant: name, code, edge: hexOf(C.edge[slug]), side: hexOf(side), top: hexOf(side), stand: hexOf(C.stand[slug]),
    mark: slug === "elegant_inox" ? "dark" : "light", door: slug === "elegant_inox" ? STEEL : PRINT };
});
const F0 = FIN[0];

// ── materials ──
const doorFace = mat("DoorFace", 0xffffff, { metal: F0.door.metal, rough: F0.door.rough });
const doorEdge = mat("DoorEdge", F0.edge, { metal: 0.3, rough: 0.45 });
const sidePaint = mat("SidePaint", F0.side, { metal: 0.3, rough: 0.45 });
const topPaint = mat("TopPaint", F0.top, { metal: 0.15, rough: 0.6 });
const standM = mat("StandPlastic", F0.stand, { rough: 0.55 });
const standFront = mat("StandFront", 0xffffff, { rough: 0.5 });
const markM = mat("SamsungMark", 0xffffff, { rough: 0.45, opacity: 0.999 });
const labelM = mat("LabelBEE", 0xffffff, { rough: 0.5, opacity: 0.999 });
const modelM = mat("LabelModel", 0xffffff, { rough: 0.5 });
const rearM = mat("RearPlate", 0xffffff, { metal: 0.3, rough: 0.55 });
const bayM = mat("Bay", 0xffffff, { rough: 0.7 });
const bayDark = mat("BayDark", 0x141518, { rough: 0.85 });
const chrome = mat("Chrome", 0xd4d7db, { metal: 1, rough: 0.14 });
const dark = mat("DarkPlastic", 0x1d1e21, { rough: 0.7 });
const hingeM = mat("HingeCover", 0x2a2b2e, { rough: 0.55 });
const liner = mat("Liner", 0xf1f3f5, { rough: 0.6 });
const linerSide = mat("LinerSide", 0xe4e8ec, { rough: 0.65 });
const linerDk = mat("LinerGrey", 0xd5d9de, { rough: 0.6 });
const doorLinerM = mat("DoorLiner", 0xc9ccd0, { metal: 0.2, rough: 0.5 });   // the door's grey liner frame (open photo)
const gasket = mat("Gasket", 0x8d9196, { rough: 0.85 });
const white = mat("WhitePlastic", 0xf6f7f8, { rough: 0.45 });
const clear = mat("ClearPlastic", 0xc9dcef, { rough: 0.12, opacity: 0.5, side: THREE.DoubleSide });       // Samsung: "a mild blue"
const clearLight = mat("ClearPlasticLight", 0xdfe9f3, { rough: 0.12, opacity: 0.26, side: THREE.DoubleSide });
const clearRib = mat("ClearRib", 0xeef4fa, { rough: 0.3, opacity: 0.92 });
const flapM = mat("FlapClear", 0xc4d6ea, { rough: 0.25, opacity: 0.5, side: THREE.DoubleSide });
const frosted = mat("Frosted", 0xe6eef6, { rough: 0.45, opacity: 0.8 });
const glass = mat("TemperedGlass", 0xa9cdd6, { rough: 0.05, opacity: 0.55, side: THREE.DoubleSide });
const glassRim = mat("ShelfRim", 0xe3e7ea, { rough: 0.45 });
const lampM = mat("LedLamp", 0xffffff, { emissive: 0xf4f8ff, emissiveIntensity: 1.5 });
const evapM = mat("FreezerWall", 0xdfe3e8, { metal: 0.3, rough: 0.45 });     // the freezer box's walls (close-up)
const cordM = mat("Cord", 0x2b2d31, { rough: 0.6 });
const plugM = mat("Plug", 0x2f3135, { rough: 0.5 });
const pinM = mat("Pin", 0xb7bbc0, { metal: 0.9, rough: 0.3 });
const panelM = mat("PanelPrint", 0xffffff, { rough: 0.5 });
const footM = mat("Foot", 0x18191d, { rough: 0.8 });
const stock = LGStock({ T3: `${TEX}/lg_glt3426`, TF: `${TEX}/food`, BR: `${TEX}/brands`, BRT: `${TEX}/brands/small` });

// ── small builders ──
const cyl = (name, rt, rb, h, m, x, y, z, seg = 16) => mesh(name, new THREE.CylinderGeometry(rt, rb, h, seg), m, x, y, z);
const plane = (name, w, h, m, x, y, z) => mesh(name, flipV(new THREE.PlaneGeometry(w, h)), m, x, y, z);
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
function pocket(name, w, dep, h) {
  const g = group(name, 0, 0, -linerFace);
  g.add(box(name + "Floor", w, 0.004, dep, clear, 0, 0.002, -dep / 2));
  g.add(box(name + "Lip", w, h * 0.85, 0.004, clear, 0, h * 0.425, -dep + 0.002));
  g.add(box(name + "EndL", 0.004, h, dep, clear, -w / 2 + 0.002, h / 2, -dep / 2));
  g.add(box(name + "EndR", 0.004, h, dep, clear, w / 2 - 0.002, h / 2, -dep / 2));
  g.add(box(name + "Rim", w, 0.007, 0.006, clearRib, 0, h * 0.85 - 0.0035, -dep + 0.003));
  return g;
}

const root = group("SamsungRR21");
const cab = group("Cabinet");
root.add(cab);

// ── the base stand: its sides, back, floor and feet; the front is the drawer (below) ──
{
  const zs1 = zNose - 0.012, dz = zs1 - zB, zc = (zs1 + zB) / 2, hS = standTop - standFoot;
  // the sides stop behind the drawer's front, whose ends carry them on to the front
  const zsE = zNose - 0.008 - 0.025, dzs = zsE - zB;
  for (const sx of [-1, 1]) cab.add(box("StandSide", 0.012, hS, dzs, standM, sx * (W / 2 - 0.006), standFoot + hS / 2, (zsE + zB) / 2));
  cab.add(box("StandBack", W - 0.026, standBackTop - standFoot, 0.008, standM, 0, standFoot + (standBackTop - standFoot) / 2, zB + 0.004));
  cab.add(box("StandFloor", W - 0.024, 0.005, dz - 0.01, dark, 0, standFoot + 0.0025, zc));
  cab.add(box("StandDeck", W - 0.024, 0.006, zs1 - stepZ + 0.1, standM, 0, standTop - 0.003, (zs1 + stepZ - 0.1) / 2));
  // four feet, 40 mm wide and 13 mm tall, 32 mm in from each side (fronts: x 776-815 and 1237-1277)
  for (const sx of [-1, 1]) for (const z of [zNose - 0.045, zB + 0.03]) cab.add(box("Foot", 0.04, standFoot, 0.035, footM, sx * (W / 2 - 0.052), standFoot / 2, z));
}

// ── cabinet shell ──
const shellH = cabTop - standTop, shellMid = standTop + shellH / 2, Dc = zFront - zB, zMid = (zFront + zB) / 2;
cab.add(faced("SideLeft", wall, shellH, Dc, [linerSide, sidePaint, topPaint, standM, sidePaint, dark], -W / 2 + wall / 2, shellMid, zMid));
cab.add(faced("SideRight", wall, shellH, Dc, [sidePaint, linerSide, topPaint, standM, sidePaint, dark], W / 2 - wall / 2, shellMid, zMid));
cab.add(faced("Top", inW, cabTop - ceil, Dc, [liner, liner, topPaint, liner, sidePaint, dark], 0, (cabTop + ceil) / 2, zMid));
// the base in front of the bay; the bay's ceiling; the back wall over the hump and the hump itself
cab.add(faced("Base", inW, floorIn - standTop, zFront - stepZ, [liner, liner, liner, standM, sidePaint, dark], 0, standTop + (floorIn - standTop) / 2, (zFront + stepZ) / 2));
cab.add(faced("BackWall", inW, ceil - stepTop, zIn - zB - 0.003, [liner, liner, liner, liner, liner, dark], 0, (ceil + stepTop) / 2, (zIn + zB + 0.003) / 2));
cab.add(faced("Hump", inW, stepTop - bayTop, stepZ - zB - 0.003, [liner, liner, liner, bayDark, liner, dark], 0, (stepTop + bayTop) / 2, (stepZ + zB + 0.003) / 2));
cab.add(faced("HumpFront", inW, bayTop - floorIn, 0.03, [liner, liner, liner, liner, liner, bayDark], 0, (bayTop + floorIn) / 2, stepZ - 0.015));
// the back: Samsung's rear photo (the embossed galvanised back, "CYCLOPENTANE"), 3.2 mm narrower than the body so the
// exporter's 0.8 mm separation keeps the published width (as on the RT40)
cab.add(mesh("RearPlate", flipV(new THREE.BoxGeometry(W - 0.0032, cabTop - bayTop - 0.0016, 0.003)), [dark, dark, dark, dark, dark, rearM], 0, (cabTop + bayTop) / 2, zB + 0.0015));
// the open bay: its machinery photographed on its back wall, dark walls and ceiling
{
  const bw = W - 2 * wall, bh = bayTop - standBackTop;
  cab.add(mesh("BayBack", flipV(new THREE.BoxGeometry(bw, bh, 0.01)), [liner, liner, liner, liner, liner, bayM], 0, standBackTop + bh / 2, zB + bayD + 0.005));
  cab.add(box("BayCeiling", bw, 0.006, bayD, bayDark, 0, bayTop - 0.003, zB + bayD / 2));
}
// hinges on the right: the dark cover on the cabinet's top behind the door's crown (freezer close-up: a block 70 mm
// across, 25 mm tall; ESTIMATED depth) and the bottom bracket on the stand under the door's right corner
cab.add(box("HingeCoverTop", 0.07, 0.025, 0.06, hingeM, W / 2 - 0.045, cabTop + 0.0125, zFront - 0.035));
cab.add(box("HingeBottom", 0.035, 0.003, 0.06, chrome, W / 2 - 0.0175, standTop + 0.0015, zFront + 0.03));
// the power cord: Samsung's rear photo shows its connector at the bay's top left (seen from behind) but no cord, and the
// manual says to tie the cord's extra length up at the back so it doesn't touch the floor. So it runs from the connector
// into a tied coil of three loops hung inside the open bay, the three-pin plug hanging under it, all within the body,
// never seen from the front or the sides (route and coil ESTIMATED); cord 8 mm, plug 45 x 42 x 16 mm
{
  const V = (x, y, z) => new THREE.Vector3(x, y, z);
  const x0 = W / 2 - 0.054, cx = W / 2 - 0.1, cy = 0.29, rr = 0.04, cz = zB + 0.03, pitch = 0.008;
  const pts = [V(x0, 0.35, zB + bayD - 0.005), V(x0 - 0.01, 0.345, zB + 0.09), V(cx + 0.012, cy + rr + 0.004, cz - 0.002)];
  for (let i = 0; i <= 36; i++) { const t = i / 12, a = Math.PI / 2 + 2 * Math.PI * t; pts.push(V(cx + rr * Math.cos(a), cy + rr * Math.sin(a), cz + pitch * t)); }
  const py = cy - rr - 0.03, pz = cz + 3 * pitch / 2;
  pts.push(V(cx + 0.004, cy - rr - 0.012, pz), V(cx, py + 0.004, pz));
  cab.add(mesh("PowerCord", new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts, false, "centripetal"), 260, 0.004, 6, false), cordM));
  // the tie round the coil's bottom
  cab.add(box("CordTie", 0.006, 0.014, 0.034, white, cx, cy - rr, cz + 1.5 * pitch));
  const sh = new THREE.Shape(), w = 0.045, h = 0.042, r = 0.012;
  sh.moveTo(-w / 2 + r, -h / 2); sh.lineTo(w / 2 - r, -h / 2); sh.quadraticCurveTo(w / 2, -h / 2, w / 2, -h / 2 + r);
  sh.lineTo(w / 2, h / 2 - r); sh.quadraticCurveTo(w / 2, h / 2, w / 2 - r, h / 2); sh.lineTo(-w / 2 + r, h / 2);
  sh.quadraticCurveTo(-w / 2, h / 2, -w / 2, h / 2 - r); sh.lineTo(-w / 2, -h / 2 + r); sh.quadraticCurveTo(-w / 2, -h / 2, -w / 2 + r, -h / 2);
  // the plug hangs pins down: its 16 mm body from py down
  const plug = mesh("Plug", new THREE.ExtrudeGeometry(sh, { depth: 0.016, bevelEnabled: true, bevelSize: 0.002, bevelThickness: 0.002, bevelSegments: 2, curveSegments: 8 }), plugM, cx, py, pz);
  plug.rotation.x = Math.PI / 2;
  cab.add(plug);
  for (const [dx, dz] of [[0, 0.0105], [-0.0095, -0.0065], [0.0095, -0.0065]]) cab.add(cyl("PlugPin", 0.0026, 0.0026, 0.016, pinM, cx + dx, py - 0.016 - 0.002 - 0.008, pz + dz, 10));
}

// ── inside: the vent plate, the freezer box, its flap, the control panel ──
const xL = -inW / 2, xR = inW / 2, wt = 0.008;
cab.add(box("VentPlate", inW, ceil - fbTop, fbZ1 - zIn, white, 0, (ceil + fbTop) / 2, (fbZ1 + zIn) / 2));
cab.add(mesh("VentSlots", mergeGeometries([...Array(11)].map((_, i) => new THREE.BoxGeometry(0.02, 0.006, 0.002).translate(-0.168 + i * 0.0287, ventY, fbZ1 + 0.001))), dark));
{
  const zc = (zIn + fbZ1) / 2, d = fbZ1 - zIn, h = fbTop - fbBot;
  cab.add(box("FreezerBoxFloor", fbX1 - fbX0, wt, d, white, (fbX0 + fbX1) / 2, fbBot + wt / 2, zc));
  for (const [n, x] of [["FreezerBoxL", fbX0 + wt / 2], ["FreezerBoxR", pnX0 - wt / 2]]) cab.add(box(n, wt, h, d, white, x, (fbBot + fbTop) / 2, zc));
  // the box's metal walls inside (the freezer close-up: the evaporator's dimpled plate, light grey)
  cab.add(box("FreezerBack", pnX0 - fbX0 - 2 * wt, h - wt, 0.004, evapM, (fbX0 + pnX0) / 2, (fbBot + fbTop + wt) / 2, zIn + 0.002));
  cab.add(box("FreezerFloorPlate", pnX0 - fbX0 - 2 * wt, 0.003, d - 0.03, evapM, (fbX0 + pnX0) / 2, fbBot + wt + 0.0015, zc - 0.01));
  // the frame round the flap
  cab.add(box("FreezerFrameL", flX0 - fbX0, h, 0.012, white, (fbX0 + flX0) / 2, (fbBot + fbTop) / 2, fbZ1 - 0.006));
  cab.add(box("FreezerFrameTop", pnX0 - flX0, fbTop - flY1, 0.012, white, (flX0 + pnX0) / 2, (fbTop + flY1) / 2, fbZ1 - 0.006));
  cab.add(box("FreezerFrameBot", pnX0 - flX0, flY0 - fbBot, 0.012, white, (flX0 + pnX0) / 2, (fbBot + flY0) / 2, fbZ1 - 0.006));
  // the control panel: white, its printed guide (photo) and the knob (open photo: 19 mm across, at 1.160 m)
  const pcx = (pnX0 + fbX1) / 2;
  cab.add(mesh("ControlPanel", new THREE.BoxGeometry(fbX1 - pnX0, h, d), [white, white, white, white, panelM, white], pcx, (fbBot + fbTop) / 2, zc));
  { const g = cab.getObjectByName("ControlPanel").geometry; flipV(g); }
  const k = cyl("TempKnob", 0.0095, 0.0095, 0.012, white, pcx, 1.160, fbZ1 + 0.006, 32);
  k.rotation.x = Math.PI / 2;
  cab.add(k);
  cab.add(box("KnobRib", 0.003, 0.014, 0.004, linerDk, pcx, 1.160, fbZ1 + 0.014));
  // the ice tray (Samsung's spec: "Ice Tray"; the freezer close-up shows a white tray of 2 x 6 cubes on the floor, right of
  // the middle; its size ESTIMATED at 150 x 80 x 25 mm)
  const iy = fbBot + wt + 0.003, ix = 0.05, iz = zIn + 0.04 + 0.04 + 0.06;
  const cells = [];
  cells.push(new THREE.BoxGeometry(0.15, 0.004, 0.08).translate(ix, iy + 0.002, iz));
  for (const sx of [-1, 1]) cells.push(new THREE.BoxGeometry(0.003, 0.025, 0.08).translate(ix + sx * 0.0735, iy + 0.0125, iz));
  for (const sz of [-1, 1]) cells.push(new THREE.BoxGeometry(0.15, 0.025, 0.003).translate(ix, iy + 0.0125, iz + sz * 0.0385));
  for (let i = 1; i < 6; i++) cells.push(new THREE.BoxGeometry(0.002, 0.02, 0.074).translate(ix - 0.075 + i * 0.025, iy + 0.012, iz));
  cells.push(new THREE.BoxGeometry(0.144, 0.02, 0.002).translate(ix, iy + 0.012, iz));
  cab.add(mesh("IceTray", mergeGeometries(cells), white));
}
// the flap: clear, hinged on its right edge (Samsung's freezer close-up shows it swung open to the right)
const flap = group("FreezerFlap", flX1, 0, fbZ1);
{
  const w = flX1 - flX0, yc = (flY0 + flY1) / 2, h = flY1 - flY0;
  flap.add(box("FlapPanel", w - 0.012, h - 0.012, 0.004, flapM, -w / 2, yc, 0.004));
  flap.add(box("FlapRimT", w, 0.006, 0.01, frosted, -w / 2, flY1 - 0.003, 0.005));
  flap.add(box("FlapRimB", w, 0.006, 0.01, frosted, -w / 2, flY0 + 0.003, 0.005));
  flap.add(box("FlapRimR", 0.006, h, 0.01, frosted, -0.003, yc, 0.005));
  flap.add(box("FlapRimL", 0.006, h, 0.01, frosted, -w + 0.003, yc, 0.005));
  // the grip on its left: a raised clear handle 30 mm wide over most of its height (open photo, close-up)
  flap.add(box("FlapGrip", 0.03, 0.12, 0.016, frosted, -w + 0.022, yc + 0.01, 0.012));
}
cab.add(flap);
// the LED lamp on the back wall under the chiller tray (open photo: a white housing about 45 x 65 mm)
cab.add(box("LampHousing", 0.045, 0.065, 0.022, white, 0, 0.845, zIn + 0.011));
cab.add(box("LedLampCover", 0.03, 0.04, 0.004, lampM, 0, 0.84, zIn + 0.024));
// the drain spout on the back wall at the left (open photo)
cab.add(box("DrainCup", 0.03, 0.035, 0.025, white, -0.17, 0.885, zIn + 0.0125));

// ── what comes out (FridgeTrays): the chiller tray, the glass shelves, the cover and the Vege Box ──
const trays = group("FridgeTrays");
cab.add(trays);
function rails(name, yTop, z0, z1) { for (const sx of [-1, 1]) cab.add(box(name, 0.01, 0.01, z1 - z0, linerDk, sx * (inW / 2 - 0.005), yTop - 0.01 - 0.0035, (z0 + z1) / 2)); }
function shelf(name, y) {
  const g = group(name, 0, y, 0), bd = frontFridge - 0.0085 - zIn - 0.012;
  g.add(box(name + "Glass", inW - 0.012, 0.006, bd, glass, 0, -0.003, zIn + bd / 2 + 0.012));
  g.add(box(name + "Rim", inW - 0.012, 0.014, 0.012, glassRim, 0, -0.004, frontFridge - 0.006));
  g.add(box(name + "RimBack", inW - 0.012, 0.01, 0.01, glassRim, 0, -0.006, zIn + 0.017));
  trays.add(g);
  rails(name + "Rail", y - 0.006, zIn, frontFridge - 0.012);
}
shelf("Shelf1", s1);
shelf("Shelf2", s2);
// the chiller tray: clear, its grip bar across the front (open photo), on runners under the freezer box
const ctZ0 = zIn + 0.012, ctW = fbX1 - fbX0 - 0.006, ctX = (fbX0 + fbX1) / 2, ctZ = (ctZ0 + ctZ1) / 2;
{
  const hh = ctTop - ctBot;
  trays.add(box("ChillFloor", ctW, 0.004, ctZ1 - ctZ0, clear, ctX, ctBot + 0.002, ctZ));
  for (const sx of [-1, 1]) trays.add(box("ChillSide", 0.004, hh, ctZ1 - ctZ0, clear, ctX + sx * (ctW / 2 - 0.002), ctBot + hh / 2, ctZ));
  trays.add(box("ChillBack", ctW, hh, 0.004, clear, ctX, ctBot + hh / 2, ctZ0 + 0.002));
  trays.add(box("ChillFront", ctW, hh * 0.7, 0.005, clearLight, ctX, ctBot + hh * 0.35, ctZ1 - 0.0025));
  trays.add(box("ChillGrip", 0.16, 0.006, 0.012, frosted, ctX, ctBot + hh * 0.7, ctZ1 - 0.002));
  for (const sx of [-1, 1]) trays.add(box("ChillGripPost", 0.006, hh * 0.35, 0.006, frosted, ctX + sx * 0.077, ctBot + hh * 0.52, ctZ1 - 0.002));
  for (const sx of [-1, 1]) cab.add(box("ChillRunner", 0.006, 0.006, ctZ1 - ctZ0, linerDk, ctX + sx * (ctW / 2 + 0.002), ctBot - 0.003, ctZ));
}
// the Vege Box's glass cover with its frosted front, and the box (FzBox* are the names qa_bounds reads); the box stops at
// the hump over the compressor bay
{
  const bd = frontFridge - 0.004 - zIn - 0.004;
  cab.add(box("CrisperCover", inW - 0.012, 0.005, bd, glass, 0, coverY - 0.0025, zIn + 0.004 + bd / 2));
  cab.add(box("CrisperCoverBand", inW - 0.012, 0.018, 0.012, frosted, 0, coverY - 0.009, frontFridge - 0.006));
  rails("CrisperCoverRail", coverY - 0.006, zIn, frontFridge - 0.012);
}
const vbW = inW - 0.016, vbZ0 = stepZ + 0.008, vbZ1 = frontFridge, vbD = vbZ1 - vbZ0, vbZ = (vbZ0 + vbZ1) / 2;
{
  const hh = vbTop - vbBot;
  trays.add(box("FzBoxFloor", vbW, 0.004, vbD, clear, 0, vbBot + 0.002, vbZ));
  trays.add(box("FzBoxBack", vbW, hh, 0.004, clear, 0, vbBot + hh / 2, vbZ0 + 0.002));
  trays.add(box("FzBoxL", 0.004, hh, vbD, clear, -vbW / 2 + 0.002, vbBot + hh / 2, vbZ));
  trays.add(box("FzBoxR", 0.004, hh, vbD, clear, vbW / 2 - 0.002, vbBot + hh / 2, vbZ));
  trays.add(box("FzBoxFront", vbW, hh - 0.012, 0.004, clearLight, 0, vbBot + (hh - 0.012) / 2, vbZ1 - 0.002));
  trays.add(box("FzBoxRim", vbW + 0.006, 0.012, 0.008, frosted, 0, vbTop - 0.006, vbZ1 - 0.002));
  trays.add(box("FzBoxGrip", 0.2, 0.012, 0.01, frosted, 0, vbTop - 0.04, vbZ1 + 0.003));
}

// ── the base stand's drawer: its front (the photo: the finger pocket along its top and Samsung's embossed mark), bowed
// 8 mm across (3/4 views), the bin behind it inside the stand (Samsung's photo shows it pulled out with potatoes and onions)
const drawer = group("BaseDrawer");
cab.add(drawer);
const fw = W - 0.006, bow = 0.008, zf = (x) => zNose - bow * (2 * x / fw) ** 2;
const dTop = standTop - 0.002, dBot = standFoot + 0.002;
{
  const nx = 32, ny = 4, pos = [], uv = [], idx = [];
  for (let j = 0; j <= ny; j++) for (let i = 0; i <= nx; i++) {
    const x = -fw / 2 + fw * i / nx, y = dBot + (dTop - dBot) * j / ny;
    pos.push(x, y, zf(x)); uv.push(i / nx, 1 - (y - standFoot) / (standTop - standFoot));
  }
  for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) { const a = j * (nx + 1) + i; idx.push(a, a + 1, a + nx + 2, a, a + nx + 2, a + nx + 1); }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2)); g.setIndex(idx); g.computeVertexNormals();
  drawer.add(mesh("DrawerFace", g, standFront));
  // the finger pocket's slot along the top (fronts: 400 mm wide, its dark line 112-118 mm up)
  drawer.add(box("DrawerSlot", 0.4, 0.006, 0.02, dark, 0, 0.115, zNose - 0.012));
  const zb = zNose - bow - 0.012;
  drawer.add(box("DrawerFrontBack", fw, dTop - dBot, 0.012, standM, 0, (dTop + dBot) / 2, zb - 0.006));
  drawer.add(box("DrawerFrontTop", fw, 0.004, zNose - bow - zb + 0.006, standM, 0, dTop - 0.002, (zb + zNose - bow) / 2 - 0.002));
  for (const sx of [-1, 1]) drawer.add(box("DrawerFrontEnd", 0.004, dTop - dBot, zNose - bow - zb + 0.004, standM, sx * (fw / 2 - 0.002), (dTop + dBot) / 2, (zb + zNose - bow) / 2));
}
const dbW = W - 0.05, dbZ0 = -0.16, dbZ1 = zNose - bow - 0.026, dbFloor = 0.024, dbTop = 0.135;
{
  const zc = (dbZ0 + dbZ1) / 2, d = dbZ1 - dbZ0;
  drawer.add(box("DrawerBinFloor", dbW, 0.004, d, standM, 0, dbFloor - 0.002, zc));
  for (const sx of [-1, 1]) drawer.add(box("DrawerBinSide", 0.004, dbTop - dbFloor + 0.004, d, standM, sx * (dbW / 2 - 0.002), (dbTop + dbFloor - 0.004) / 2, zc));
  drawer.add(box("DrawerBinBack", dbW, dbTop - dbFloor + 0.004, 0.004, standM, 0, (dbTop + dbFloor - 0.004) / 2, dbZ0 + 0.002));
}

// ── stock: vegetarian South Indian food, eggs, juices, water and soft drinks (stock_lg.mjs, food.mjs) ──
stock.shelves(trays, {
  zIn1: zIn, inW, inD: frontFridge - zIn, s1: s1 - 0.0005, s2: s2 - 0.0005, s3: coverY - 0.0005, fz: vbBot + 0.004, fit: true, vz0: vbZ0 + 0.02, vk: 0.5,
  shelfB: { hw: inW / 2 - 0.03, z0: zIn + 0.022, z1: frontFridge - 0.015 },
  drawerB: { hw: vbW / 2 - 0.014, z0: vbZ0 + 0.02, z1: vbZ1 - 0.008, y0: vbBot + 0.004 },
  drawerCeil: coverY - 0.005 - 0.01 - (vbBot + 0.004),
});
const bbox = (o) => { o.updateWorldMatrix(true, true); return new THREE.Box3().setFromObject(o); };
if (process.env.RR21_DUMP > 1) for (const n of ["Shelf1Stock", "Shelf2Stock", "Shelf3Stock", "FreshZoneStock"]) {
  const g = trays.getObjectByName(n);
  console.log(n, g.children.map((o) => { const b = bbox(o), s = b.getSize(new THREE.Vector3()); return `${o.name} ${(s.x * 1000).toFixed(0)}x${(s.y * 1000).toFixed(0)}x${(s.z * 1000).toFixed(0)}`; }).join("; "));
}
function row(items, x0, x1, z0) {
  const bs = items.map(bbox), w = bs.reduce((s, b) => s + b.max.x - b.min.x, 0), gap = (x1 - x0 - w) / (items.length + 1);
  if (gap < 0.006) console.warn(`row: ${items.map((o) => o.name)} leave ${(gap * 1000).toFixed(0)} mm between them`);
  let x = x0 + gap, dep = 0;
  items.forEach((o, i) => { const b = bs[i]; o.position.x += x - b.min.x; o.position.z += z0 - b.min.z; x += b.max.x - b.min.x + gap; dep = Math.max(dep, b.max.z - b.min.z); });
  return dep;
}
const kids = (g, name) => g.children.filter((o) => o.name === name);
const drop = (...os) => os.forEach((o) => o?.parent?.remove(o));
{
  const hw = inW / 2 - 0.03, z0 = zIn + 0.022;
  { // top shelf, 166 mm under the chiller tray, 30 mm off the back wall (the lamp and the drain spout stand there): the
    // tiffin, the milk and the buttermilk, then the batter; the biryani box (168 mm deep) has no room left in front
    const g = trays.getObjectByName("Shelf1Stock");
    const milk = g.getObjectByName("NandiniMilk"), pile = ["AavinMilk", "AmulTaazaPouch"].map((n) => g.getObjectByName(n)).filter(Boolean), m0 = milk.position.clone();
    drop(g.getObjectByName("RnrBiryaniBox"));
    const d1 = row([g.getObjectByName("Tiffin"), milk, g.getObjectByName("MastiButtermilk")], -hw, hw, z0 + 0.03);
    const d = milk.position.clone().sub(m0);
    pile.forEach((o) => o.position.add(d));
    row([g.getObjectByName("IdBatterPouch1")], -hw, hw, z0 + 0.03 + d1 + 0.012);
  }
  { // middle shelf (94 mm clear): the two sweet boxes at the back, the coconut and the melon in front
    const g = trays.getObjectByName("Shelf2Stock");
    drop(g.getObjectByName("RnrBiryani"));
    const d1 = row([g.getObjectByName("NandhanaPalace"), g.getObjectByName("NandhanaPalace2")], -hw, hw, z0);
    row([g.getObjectByName("CoconutHalf"), g.getObjectByName("WatermelonHalf")], -hw, hw, z0 + d1 + 0.012);
  }
  { // on the Vege Box's cover (127 mm clear): bananas and curd at the back, grapes, apples, an orange and a lemon in front
    const g = trays.getObjectByName("Shelf3Stock");
    const [a0, a1] = kids(g, "Apple"), [o0] = kids(g, "Orange"), [l0] = kids(g, "Lemon");
    const keep = new Set([a0, a1, o0, l0, g.getObjectByName("Bananas"), g.getObjectByName("Grapes"), g.getObjectByName("AmulMastiDahi")]);
    drop(...g.children.filter((o) => !keep.has(o)));
    const d1 = row([g.getObjectByName("Bananas"), g.getObjectByName("AmulMastiDahi")], -hw, hw, z0);
    row([g.getObjectByName("Grapes"), a0, o0, a1, l0], -hw, hw, z0 + d1 + 0.012);
  }
}
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
// the Vege Box is about 230 mm deep and 470 mm wide inside (it stops at the hump over the compressor), too small for
// stock_lg's heap (its drumsticks alone are 340 mm long): one layer is laid out from the heap's own vegetables instead,
// the cauliflower, the capsicums and an onion at the back, the tomatoes and a carrot in front, chillies by the cauliflower
const vegSrc = {};
{
  const v = trays.getObjectByName("FreshZoneStock");
  for (const n of ["Onion", "Potato"]) vegSrc[n] = kids(v, n);
  const pick = (n, i) => kids(v, n)[i];
  // (stock_lg's heap had no room for two of its capsicums: the one left stands with two onions)
  const cauli = pick("Cauliflower", 0), caps = [pick("Capsicum", 0), pick("Onion", 1)].filter(Boolean), on = pick("Onion", 0);
  const tom = [0, 1, 2].map((i) => pick("Tomato", i)).filter(Boolean), car = pick("Carrot", 0), chi = [pick("GreenChilli", 7), pick("GreenChilli", 4)].filter(Boolean);
  const keep = new Set([cauli, ...caps, on, ...tom, car, ...chi]);
  const gone = v.children.filter((o) => !keep.has(o)), count = {};
  gone.forEach((o) => (count[o.name] = (count[o.name] || 0) + 1));
  drop(...gone);
  console.log(`left out of the Vege Box (one layer only): ${Object.entries(count).map(([k, n]) => `${n} ${k}`).join(", ")}`);
  const dep = (o) => { const b = bbox(o); return b.max.z - b.min.z; };
  const x0 = -vbW / 2 + 0.006, x1 = vbW / 2 - 0.006, zb = vbZ0 + 0.008;
  row([cauli, ...caps, on], x0, x1, zb);
  const xr = bbox(cauli).max.x, dCO = Math.max(...[...caps, on].map(dep));
  const dT = row(tom, xr, x1, zb + dCO + 0.008);
  row([car], xr, x1, zb + dCO + 0.008 + dT + 0.008);
  row(chi, x0, xr, zb + dep(cauli) + 0.008);
  for (const o of keep) { const b = bbox(o); o.position.y += vbBot + 0.004 + 0.0005 - b.min.y; }
  leaveOut(v, [B3(-1, 0, -1, 1, 3, vbZ0 + 0.004), B3(-1, 0, vbZ1 - 0.006, 1, 3, 1), B3(-1, coverY - 0.005 - 0.01, -1, 1, 3, 1)], "past the Vege Box's back or front, or under 1 cm from its cover");
}
// the chiller tray: butter, cheese and curd cups (Samsung stocks it with cold cuts and cheese)
stock.fresh0(trays, { y: ctBot + 0.004, z: ctZ, bx: -0.15, cx: 0.07, ex: -0.04 });
leaveOut(trays.getObjectByName("F0Stock"), [B3(-1, fbBot - 0.006, -1, 1, 3, 1), B3(-1, 0, ctZ1 - 0.008, 1, 3, 1)], "too tall for the chiller tray");
// the freezer box: the two tubs stacked and the frozen packs beside them; nothing lies on a shelf (it has none)
// (the tubs and packs stand left of the ice tray, as in Samsung's close-up)
const fzX = (fbX0 + wt + 0.05 - 0.075) / 2;
stock.freezer(cab, { fit: true, zIn1: zIn, floor: fbBot + wt + 0.003, top: fbTop, box: { hw: (0.05 - 0.075 - fbX0 - wt) / 2 - 0.012, z0: zIn + 0.02, z1: fbZ1 - 0.02 } });
{
  const f = cab.getObjectByName("FreezerStock");
  if (f) f.position.x += fzX;
  cab.getObjectByName("OnFreezerShelf")?.removeFromParent();
  leaveOut(f, [B3(-1, fbTop - wt - 0.008, -1, 1, 3, 1), B3(-1, 0, fbZ1 - 0.012, 1, 3, 1), B3(0.05 - 0.075 - 0.003, 0, -1, 1, 3, 1), B3(-1, 0, -1, fbX0 + wt + 0.003, 3, 1)], "past the freezer box or onto the ice tray");
}
// the base drawer: potatoes on the left, onions on the right, one layer (Samsung's photo of it); copies of the Vege Box's
// own onions and potatoes
{
  const src = (n) => (vegSrc[n]?.length ? vegSrc[n] : null);
  const on = src("Onion"), po = src("Potato");
  const place = (s, name, xs, zs) => {
    if (!s) return;
    let k = 0;
    for (const z of zs) for (const x of xs) {
      const o = s[k++ % s.length].clone();
      o.name = name; o.position.set(x, 0, z); o.rotation.y = 0.7 * k;
      drawer.add(o);
      o.updateMatrixWorld(true);
      const b = new THREE.Box3().setFromObject(o);
      o.position.y += dbFloor + 0.0005 - b.min.y;
    }
  };
  place(po, "Potato", [-0.2, -0.12], [0.06, 0.15]);
  place(on, "Onion", [0.12, 0.2], [0.06, 0.15]);
}

// ── the door: hinged on the right; its face curved across and rounded over its top (the Crown Door), the H-bar handle,
// the key lock; the shape ESTIMATED from the fronts and 3/4 views (NOTES.md) ──
// fall: the face falls back over the outer 50 mm each side by 30 mm, over the top 60 mm by 45 mm (the round top), and
// bows 10 mm across its width; the top corners are rounded 50 mm in the front view (fronts: rows 159-207)
const SK = { a: 0.05, b: 0.03, at: 0.06, bt: 0.045, ab: 0.004, bb: 0.004, rc: 0.05, bow: 0.010 };
const ell = (d, a, b) => (d >= a ? 0 : b * (1 - Math.sqrt(Math.max(0, 1 - (1 - d / a) ** 2))));
// the face's depth at (x across from the door's middle, y up from its foot), without the corner rounding
// where the side fall meets the round top they blend as one rounded corner (a max of the two left a crease along the
// diagonal): u and v are how far into the side and top falls the point is, r their length, and the depth follows the
// side's 30 mm along the side, the top's 45 mm along the top
function faceZ(x, y, w = pw, h = dh) {
  const u = Math.max(0, 1 - (w / 2 - Math.abs(x)) / SK.a), v = Math.max(0, 1 - (h - y) / SK.at), r = Math.min(1, Math.hypot(u, v));
  const B = r > 0 ? (u * u * SK.b + v * v * SK.bt) / (u * u + v * v) : 0;
  const fall = B * (1 - Math.sqrt(Math.max(0, 1 - r * r)));
  return T_ - Math.max(fall, ell(y, SK.ab, SK.bb)) - SK.bow * (2 * x / w) ** 2;
}
const SKIN = { xs: [], ys: [] };
function doorSkin(w, h, moreX = [], moreY = []) {
  const dense = (n) => [...Array(n + 1)].map((_, i) => 1 - Math.cos((i / n) * Math.PI / 2));
  const xs = [...new Set([
    ...dense(12).map((s) => -w / 2 + SK.a * s), ...[...Array(25)].map((_, i) => -w / 2 + SK.a + (w - 2 * SK.a) * i / 24), ...dense(12).map((s) => w / 2 - SK.a * s), ...moreX,
  ].map((v) => +v.toFixed(6)))].sort((p, q) => p - q);
  const ys = [...new Set([
    0, 0.002, 0.004, ...[...Array(41)].map((_, i) => 0.004 + (h - SK.at - 0.004) * i / 40), ...dense(14).map((s) => h - SK.at * s), ...moreY,
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
    const z = Math.min(faceZ(x, y, w, h), T_ - corner - SK.bow * (2 * x / w) ** 2);
    pos.push(x, y, z); uv.push((x + w / 2) / w, (h - y) / h);
  }
  for (let j = 0; j < ny - 1; j++) for (let i = 0; i < nx - 1; i++) { const a = j * nx + i; idx.push(a, a + 1, a + nx + 1, a, a + nx + 1, a + nx); }
  for (let i = 0; i < nx; i++) ring.push(i);
  for (let j = 1; j < ny; j++) ring.push(j * nx + nx - 1);
  for (let i = nx - 2; i >= 0; i--) ring.push((ny - 1) * nx + i);
  for (let j = ny - 2; j > 0; j--) ring.push(j * nx);
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2)); g.setIndex(idx); g.computeVertexNormals();
  SKIN.xs = xs; SKIN.ys = ys;
  return { geo: g, ring: ring.map((k) => [pos[3 * k], pos[3 * k + 1], pos[3 * k + 2]]) };
}
// the band round the door from the face's outline back to the door's back; over the cabinet's top the crown's back
// curves forward 25 mm (3/4 views)
function doorBand(ring, h) {
  const back = ([x, y]) => [x, y - 0.025 * Math.min(1, Math.max(0, (y - (h - SK.rc - 0.02)) / (SK.rc + 0.02))), 0];
  const pos = [], idx = [], n = ring.length;
  ring.forEach((p) => pos.push(...p, ...back(p)));
  for (let k = 0; k < n; k++) { const k1 = (k + 1) % n, f0 = 2 * k, b0 = 2 * k + 1, f1 = 2 * k1, b1 = 2 * k1 + 1; idx.push(f0, b0, f1, f1, b0, b1); }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx); g.computeVertexNormals();
  const sh = new THREE.Shape(ring.map((p) => new THREE.Vector2(...back(p).slice(0, 2))));
  const cap = flipFaces(new THREE.ShapeGeometry(sh));
  return { band: g, cap };
}
// a decal that lies on the curved face: a grid over [x0, x1] x [y0, y1] (door-centred x, y up from the foot), `off` proud
// (its grid is the door's own grid inside it, and the door's grid has a line along each decal's edges, so each decal
// triangle lies over one of the face's own triangles, parallel to it)
function decal(name, m, x0, y0, x1, y1, off, u0 = 0, v0 = 0, u1 = 1, v1 = 1) {
  [x0, y0, x1, y1] = [x0, y0, x1, y1].map((v) => +v.toFixed(6));
  const lines = (a0, a1, own) => [...new Set([a0, a1, ...own.filter((v) => v > a0 && v < a1)])].sort((p, q) => p - q);
  const gx = lines(x0, x1, SKIN.xs), gy = lines(y0, y1, SKIN.ys), nx = gx.length - 1, ny = gy.length - 1, pos = [], uv = [], idx = [];
  for (let j = 0; j <= ny; j++) for (let i = 0; i <= nx; i++) {
    const x = gx[i], y = gy[j];
    // `off` along the face's normal: over the crown and the side falls a step in z alone would sit closer than `off`
    const e = 1e-4, dx = (faceZ(x + e, y) - faceZ(x - e, y)) / (2 * e), dy = (faceZ(x, y + e) - faceZ(x, y - e)) / (2 * e), nl = Math.hypot(dx, dy, 1);
    pos.push(x - dx / nl * off, y - dy / nl * off, faceZ(x, y) + off / nl); uv.push(u0 + (u1 - u0) * (x - x0) / (x1 - x0), v1 - (v1 - v0) * (y - y0) / (y1 - y0));
  }
  for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) { const a = j * (nx + 1) + i; idx.push(a, a + 1, a + nx + 2, a, a + nx + 2, a + nx + 1); }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2)); g.setIndex(idx); g.computeVertexNormals();
  const o = mesh(name, g, m);
  o.position.x = -pw / 2;
  return o;
}
const fridgeDoor = group("FridgeDoor", W / 2, doorBot, zDoor);
{
  // the decals: the SAMSUNG wordmark, 72 mm wide, its middle 98 mm below the door's top (fronts: ink x 990-1062, rows
  // 251-263); the model's own BEE label, 93 x 169 mm, its right edge 43 mm in from the hinge edge, its top 41 mm down
  // (Samsung's Begonia Red front with the label, 0.883 px per mm), with each colour's own code on a strip over it
  const mk = C.mark.light, mw = 0.072 * mk.size[0] / mk.ink_w, mh = mw * mk.size[1] / mk.size[0];
  const MK = [-mw / 2, dh - 0.098 - mh / 2, mw / 2, dh - 0.098 + mh / 2];
  const L = C.label, lw = 0.093 * L.size[0] / L.ink[0], lh = lw * L.size[1] / L.size[0];
  const lx1 = pw / 2 - 0.043 + (lw - 0.093) / 2, lx0 = lx1 - lw, lt1 = dh - 0.041 + (lh - 0.093 * L.ink[1] / L.ink[0]) / 2, lt0 = lt1 - lh;
  const [cu0, cv0, cu1, cv1] = L.code_box;
  const LB = [lx0, lt0, lx1, lt1], ST = [lx0 + cu0 * lw, lt1 - cv1 * lh, lx0 + cu1 * lw, lt1 - cv0 * lh];
  const { geo, ring } = doorSkin(pw, dh, [MK, LB, ST].flatMap((r) => [r[0], r[2]]), [MK, LB, ST].flatMap((r) => [r[1], r[3]]));
  geo.translate(-pw / 2, 0, 0);
  fridgeDoor.add(mesh("DoorFaceSkin", geo, doorFace));
  const { band, cap } = doorBand(ring, dh);
  band.translate(-pw / 2, 0, 0); cap.translate(-pw / 2, 0, 0);
  fridgeDoor.add(mesh("DoorSides", band, doorEdge));
  fridgeDoor.add(mesh("DoorBack", cap, linerSide));
  fridgeDoor.add(decal("SamsungMarkDecal", markM, ...MK, 0.0008));
  fridgeDoor.add(decal("BeeLabelDecal", labelM, ...LB, 0.0008));
  fridgeDoor.add(decal("LabelModelStrip", modelM, ...ST, 0.0016));
  // the key lock: a pill 17 x 50 mm at 50 mm from the left edge, 488 mm below the top (fronts: x 786-802, rows 624-673)
  {
    const lx = -pw / 2 + 0.050, ly = dh - 0.488, z = faceZ(lx, ly);
    const pill = mesh("DoorLock", new THREE.CapsuleGeometry(0.0085, 0.033, 6, 16), chrome, lx - pw / 2, ly, z + 0.001);
    pill.scale.z = 0.35;
    fridgeDoor.add(pill);
    fridgeDoor.add(box("LockFace", 0.011, 0.04, 0.001, white, lx - pw / 2, ly, z + 0.0041));
    fridgeDoor.add(cyl("LockKeyhole", 0.0035, 0.0035, 0.001, dark, lx - pw / 2, ly - 0.013, z + 0.0048, 16).rotateX(Math.PI / 2));
  }
  // the H-bar handle: a chrome bar across the door, 534 mm long (fronts: x 758-1292), its face 30 mm tall at 1063-1092
  // mm, standing 45 mm proud of the face's middle (Samsung: 71.0 against 66.5 cm), its ends curving back into the door
  {
    const Lh = 0.534, bh = 0.03, bd = 0.03, rEnd = 0.04, yc = 1.0775 - doorBot, zMid = T_ + 0.045 - bd / 2;
    const sh = new THREE.Shape(), r = 0.007;
    sh.moveTo(-bd / 2 + r, -bh / 2); sh.lineTo(bd / 2 - r, -bh / 2); sh.quadraticCurveTo(bd / 2, -bh / 2, bd / 2, -bh / 2 + r);
    sh.lineTo(bd / 2, bh / 2 - r); sh.quadraticCurveTo(bd / 2, bh / 2, bd / 2 - r, bh / 2); sh.lineTo(-bd / 2 + r, bh / 2);
    sh.quadraticCurveTo(-bd / 2, bh / 2, -bd / 2, bh / 2 - r); sh.lineTo(-bd / 2, -bh / 2 + r); sh.quadraticCurveTo(-bd / 2, -bh / 2, -bd / 2 + r, -bh / 2);
    let hg = new THREE.ExtrudeGeometry(sh, { depth: Lh, steps: 64, bevelEnabled: false, curveSegments: 4 });
    hg.deleteAttribute("uv"); hg.deleteAttribute("normal");
    hg = mergeVertices(hg);
    const q = hg.attributes.position;
    for (let i = 0; i < q.count; i++) {
      const s = q.getZ(i) - Lh / 2, a = Math.abs(s), t = Math.max(0, (a - (Lh / 2 - rEnd)) / rEnd);
      const zEnd = faceZ(s, yc) - 0.004 + bd / 2;     // the end's middle sinks 4 mm into the face
      const zc = zMid - (zMid - zEnd) * (1 - Math.sqrt(Math.max(0, 1 - t * t)));
      q.setXYZ(i, s, yc + q.getY(i), zc + q.getX(i));
    }
    hg.computeVertexNormals();
    fridgeDoor.add(mesh("HandleBar", hg, chrome, -pw / 2, 0, 0));
    // its underside, where the fingers go, is dark (the fronts, taken from below the handle, show a dark band under the
    // chrome down to row 436)
    fridgeDoor.add(box("HandleGrip", Lh - 2 * rEnd, 0.002, bd - 2 * r, dark, -pw / 2, yc - bh / 2 - 0.0005, zMid));
  }
  // inside: the gasket ring, the grey liner frame and the white liner the pockets hang on
  const ly0 = floorIn - doorBot + 0.004, ly1 = ceil - doorBot - 0.004;
  fridgeDoor.add(box("GasketT", pw - 0.04, 0.016, 0.008, gasket, -pw / 2, ly1 + 0.012, -0.005));
  fridgeDoor.add(box("GasketB", pw - 0.04, 0.016, 0.008, gasket, -pw / 2, ly0 - 0.012, -0.005));
  fridgeDoor.add(box("GasketL", 0.016, ly1 - ly0 + 0.04, 0.008, gasket, -pw + 0.028, (ly0 + ly1) / 2, -0.005));
  fridgeDoor.add(box("GasketR", 0.016, ly1 - ly0 + 0.04, 0.008, gasket, -0.028, (ly0 + ly1) / 2, -0.005));
  fridgeDoor.add(box("DoorLinerFrame", pw - 0.08, ly1 - ly0, 0.01, doorLinerM, -pw / 2, (ly0 + ly1) / 2, -0.005));
  fridgeDoor.add(box("DoorLiner", inW - 0.03, ly1 - ly0 - 0.02, linerFace - 0.01, liner, -pw / 2, (ly0 + ly1) / 2, -0.01 - (linerFace - 0.01) / 2));
}
// the pockets: the top one, the two egg pockets side by side, the middle one and the deep bottle pocket
const bkW = inW - 0.05, half = (bkW - 0.01) / 2;
const addPocket = (n, w, b, x) => { const k = pocket(n, w, b.d, b.h); k.position.x = x; k.position.y = b.y; fridgeDoor.add(k); };
addPocket("TopPocket", bkW, BK.top, -pw / 2);
addPocket("EggPocketL", half, BK.egg, -pw / 2 - (bkW - half) / 2);
addPocket("EggPocketR", half, BK.egg, -pw / 2 + (bkW - half) / 2);
addPocket("MidPocket", bkW, BK.mid, -pw / 2);
addPocket("BottlePocket", bkW, BK.bottle, -pw / 2);
// the eggs stand in the free-edge egg pocket's cups (Samsung's open photos: cups moulded in both egg pockets)
const eggX = [0, 1, 2, 3].map((i) => -pw / 2 - (bkW - half) / 2 - 0.075 + i * 0.05);
for (const sx of [-1, 1]) fridgeDoor.add(box("EggCupsRib", half - 0.02, 0.006, 0.05, clearRib, -pw / 2 + sx * (bkW - half) / 2, BK.egg.y + 0.007, -linerFace - BK.egg.d / 2));
{
  const inside = (dep) => [-pw / 2 - bkW / 2 + 0.006, -pw / 2 + bkW / 2 - 0.006, -(linerFace + dep / 2)];
  const deps = { egg: BK.egg.d, jar: BK.mid.d, bottle: BK.bottle.d };
  stock.doorFridge(fridgeDoor, { fit: true, eggY: BK.egg.y, eggX, jarY: BK.mid.y, botY: BK.bottle.y, canY: null, deps, inside });
  // what is taller than its pocket's space (to the pocket over it, less 1 cm) is left out
  const tops = [[BK.mid.y, BK.egg.y - 0.01], [BK.bottle.y, BK.mid.y - 0.01]];
  fridgeDoor.updateMatrixWorld(true);
  const inv = new THREE.Matrix4().copy(fridgeDoor.matrixWorld).invert();
  const out = [];
  for (const o of [...fridgeDoor.children]) {
    if (!o.isGroup && !o.isMesh) continue;
    if (/Pocket|Gasket|Door|Handle|Label|Lock|Samsung|Egg(Cups)?Rib/.test(o.name)) continue;
    const b = new THREE.Box3().setFromObject(o).applyMatrix4(inv);
    const t = tops.find(([f]) => Math.abs(b.min.y - f) < 0.02);
    if (t && b.max.y > t[1]) { out.push(o.name); o.removeFromParent(); }
  }
  if (out.length) console.log(`left out (taller than its pocket's space): ${out.join(", ")}`);
}
// the second egg pocket holds eggs too, and the top pocket three jars, as in Samsung's stocked open photo (copies of the
// door's own eggs and jars)
{
  for (const e of fridgeDoor.children.filter((o) => o.name === "Egg")) { const c = e.clone(); c.position.x += bkW - half; fridgeDoor.add(c); }
  const jars = ["MothersPickle", "AavinGhee", "MothersPickle2"].map((n) => fridgeDoor.getObjectByName(n)).filter(Boolean).map((j) => { const c = j.clone(); c.name = j.name + "Top"; fridgeDoor.add(c); return c; });
  for (const c of jars) { const b = bbox(c); c.position.y += doorBot + BK.top.y + 0.0045 - b.min.y; }
  row(jars, W / 2 - pw / 2 - bkW / 2 + 0.006, W / 2 - pw / 2 + bkW / 2 - 0.006, zDoor - linerFace - BK.top.d + 0.006);
}
root.add(fridgeDoor);

const parts = productParts(PRODUCTS, ID);
const clips = stateClips(root, parts);
saveZones(PRODUCTS, ID, root, parts);
const textures = {
  DoorFace: `${T}/door_${F0.slug}.jpg`, StandFront: `${T}/stand_${F0.slug}.jpg`, RearPlate: `${T}/rear.jpg`, Bay: `${T}/bay.jpg`,
  LabelBEE: `${T}/label.png`, LabelModel: `${T}/model_${F0.slug}.jpg`, SamsungMark: `${T}/mark_${F0.mark}.png`, PanelPrint: `${T}/panel.jpg`,
};
Object.assign(textures, stock.textures());
{ const used = new Set(); root.traverse((o) => o.isMesh && [].concat(o.material).forEach((m) => used.add(m.name))); for (const k of Object.keys(textures)) if (!used.has(k)) delete textures[k]; }
// Grain: the door gets the soft hairline up the door (it is kept only on the Elegant Inox: the printed doors' variants
// take it off); the painted cabinet and the stand's plastic a soft peel. The decals carry none.
await exportGLB(root, clips, OUT, textures, { dir: `${TEX}/grain`, materials: {
  DoorFace: { type: "hairline_soft", dir: "v", clearcoat: STEEL.coat },
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
  const varExt = doc.createExtension(KHRMaterialsVariants);
  const hex = (c) => [((c >> 16) & 255) / 255, ((c >> 8) & 255) / 255, (c & 255) / 255].map((v) => Math.pow(v, 2.2));
  const VARY = ["DoorFace", "DoorEdge", "SidePaint", "TopPaint", "StandPlastic", "StandFront", "SamsungMark", "LabelModel"];
  const base = Object.fromEntries(VARY.map((n) => [n, byName(n)]));
  for (const n of VARY) if (!base[n]) throw new Error(`no material ${n}`);
  base.DoorFace.getBaseColorTexture().setName("DoorFace_" + F0.slug);
  const mats = FIN.map((f, i) => {
    const out = {};
    for (const n of VARY) {
      const m = i === 0 && n !== "DoorFace" ? base[n] : base[n].clone().setName(i === 0 ? `${n}_${f.slug}` : `${n}_${f.slug}`);
      if (n === "DoorFace") {
        m.setBaseColorTexture(image(`${T}/door_${f.slug}.jpg`, `DoorFace_${f.slug}`)).setBaseColorFactor([1, 1, 1, 1]);
        m.setMetallicFactor(f.door.metal).setRoughnessFactor(f.door.rough);
        if (!f.door.grain) { m.setNormalTexture(null); m.setMetallicRoughnessTexture(null); }
        m.setExtension("KHR_materials_clearcoat", f.door.coat ? coatExt.createClearcoat().setClearcoatFactor(f.door.coat[0]).setClearcoatRoughnessFactor(f.door.coat[1]) : null);
      }
      if (i > 0) {
        if (n === "StandFront") m.setBaseColorTexture(image(`${T}/stand_${f.slug}.jpg`, `StandFront_${f.slug}`));
        if (n === "DoorEdge") m.setBaseColorFactor([...hex(f.edge), 1]);
        if (n === "SidePaint") m.setBaseColorFactor([...hex(f.side), 1]);
        if (n === "TopPaint") m.setBaseColorFactor([...hex(f.top), 1]);
        if (n === "StandPlastic") m.setBaseColorFactor([...hex(f.stand), 1]);
        if (n === "SamsungMark") m.setBaseColorTexture(image(`${T}/mark_${f.mark}.png`, `SamsungMark_${f.mark}`));
        if (n === "LabelModel") m.setBaseColorTexture(image(`${T}/model_${f.slug}.jpg`, `LabelModel_${f.slug}`));
      }
      out[n] = m;
    }
    return out;
  });
  const variants = FIN.map((f) => varExt.createVariant(f.variant));
  let mapped = 0;
  for (const me of R.listMeshes()) for (const p of me.listPrimitives()) {
    const n = VARY.find((k) => p.getMaterial() === base[k]);
    if (!n) continue;
    if (n === "DoorFace") p.setMaterial(mats[0].DoorFace);   // the default look is the first colour's (no grain on its print)
    const list = varExt.createMappingList();
    FIN.forEach((f, i) => list.addMapping(varExt.createMapping().setMaterial(mats[i][n]).addVariant(variants[i])));
    p.setExtension("KHR_materials_variants", list);
    mapped++;
  }
  base.DoorFace.dispose();
  for (const t of R.listTextures()) if (!t.listParents().some((p) => p.propertyType === "Material")) t.dispose();
  fs.writeFileSync(OUT, await io.writeBinary(doc));
  console.log(`variants: ${FIN.map((f) => f.variant).join(", ")}; ${mapped} primitives mapped;`, (fs.statSync(OUT).size / 1048576).toFixed(2), "MB");
}
