// LG GLT4416, 446 L double-door refrigerator, in its two colours as material variants: Ebony Sheen (GLT4416CCES.DESZEBN,
// glossy black PET doors, built first) and Shiny Steel (GLT4416CCPZ.DPZZEBN, steel-look PET doors).
// Built to LG's published size: 700 W x 1780 H mm (LG's page), 730 mm deep with the rear spacers (the manual's drawing for
// GLT44***: 660 mm cabinet, 705 mm with the door, 25 mm spacers). From LG's gallery photos of both colours (front, 3/4,
// open, stocked, rear) and the manual: freezer on top (114 L) with one glass shelf, a "Convertible" print on its back panel
// and a manual ice maker (1 lever, 2 trays) hanging under the shelf; fridge below (332 L) with a pull-out Fresh 0 Zone
// tray, an air duct up the back wall carrying the inner control panel, a Door Cooling duct on the left wall, three
// tempered-glass shelves and a Fresh Zone drawer; 2 baskets in the freezer door, 2 full and 5 half in the fridge door;
// both doors hinged on the right; a horizontal pocket handle under a silver cap across the top of the fridge door.
// The shelves, the Fresh 0 Zone tray and the drawer are one part (FridgeTrays) that slides out with its food.
// Heights are read off LG's photos (private research notes give each number and how it was measured).
// Stocked for a south Indian kitchen. usage: node make_lg_glt4416.mjs <products.json> <tex dir> <out.glb>
import fs from "node:fs";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { NodeIO } from "@gltf-transform/core";
import { ALL_EXTENSIONS, KHRMaterialsVariants, KHRMaterialsClearcoat, KHRMaterialsSpecular } from "@gltf-transform/extensions";
import { THREE, mat, mesh, box, faced, group, flipV, stateClips, exportGLB, productParts, saveZones } from "./lib.mjs";
import { LGStock } from "./stock_lg.mjs";

const [PRODUCTS, TEX, OUT] = process.argv.slice(2);
const ID = "lg-glt4416cces";
const T = `${TEX}/lg_glt4416`;

// ── size (metres) ──
const W = 0.700, H = 1.780, D = 0.730;
const doorT = 0.045;                          // the manual's F - E (705 - 660 mm)
const zBack = -D / 2;                         // the back of the rear spacers
const zBody = zBack + 0.025;                  // the cabinet's back (spacers 25 mm, manual D)
const zFront = zBody + 0.660;                 // the cabinet's front (manual E)
const cabTop = 1.736;                         // the cabinet's top: the freezer door stands 44 mm above it (DZ-06, DZ-08)
const wall = 0.036, feet = 0.018;
const inW = W - 2 * wall, zIn1 = zBody + 0.06, inD = zFront - zIn1;
// vertical layout, measured on LG's front photo of the Shiny Steel (1.65 mm a pixel) and its open-door photos
const fy0 = 1.245, fy1 = 1.706;               // freezer cavity floor and ceiling
const gy0 = 0.080, gy1 = 1.174;               // fridge cavity floor and ceiling
const fzBot = 1.2207;                         // freezer door bottom edge
const frTop = 1.2142, capBot = 1.2043, frLow = 0.031; // fridge door top, the silver cap's bottom, the door's bottom
// With the doors shut their baskets reach into the cabinet (95 mm deep plus 10 mm off the liner), so the shelves, the
// drawer and the freezer shelf end short of them, and the ice maker short of the freezer's lower basket.
const shelfFront = zFront - 0.115, drawerFront = zFront - 0.115, fzShelfFront = zFront - 0.09;
const s1 = 0.826, s2 = 0.682, s3 = 0.523;     // glass shelves (front rims on the open-door photo)
const fzShelfY = 1.460;                       // freezer glass shelf
const f0Y = 1.005;                            // Fresh 0 Zone tray floor (rim 1.143)
const coverY = 0.327, drawerY = 0.104;        // Fresh Zone glass cover and drawer floor (rim 0.315)

// ── materials. The ones the colours change are built here as Ebony Sheen; the Shiny Steel copies are made after export ──
const doorFzM = mat("DoorFreezer", 0x111112, { metal: 1, rough: 0.5 });
const doorFrM = mat("DoorFridge", 0x111112, { metal: 1, rough: 0.5 });
const sideM = mat("SideSteel", 0x6c6d70, { metal: 0.38, rough: 0.5 });
const topM = mat("TopSteel", 0x1c1d1f, { metal: 0.15, rough: 0.7 });
const logoM = mat("LgMark", 0xffffff, { rough: 0.5, opacity: 0.999 });
const doorEdge = mat("DoorEdge", 0x8a8c90, { metal: 0.6, rough: 0.35 });
const silverCap = mat("SilverLip", 0xb4b5b7, { metal: 0.8, rough: 0.3 });
// the pocket reads 11-15 on LG's front photos of both colours (was 55 at 0x26272a, metal 0.3): a matt black with no
// reflection of its own (KHR_materials_specular 0, set below)
const pocketM = mat("PocketDark", 0x202022, { rough: 0.8 });
// the freezer door's underside, seen in the 6.5 mm gap over the fridge door's cap: dark on both colours' front photos
// (16-20, then the cap), where the grey door edge drew a light band 4 px deep over the cap
const seamM = mat("SeamFin", 0x0b0c0d, { rough: 0.9 });
const steelEdge = mat("SteelEdge", 0x9a9b9d, { metal: 0.2, rough: 0.6 });
const black = mat("GripBlack", 0x151516, { rough: 0.5 });
const labelM = mat("LabelBEE", 0xffffff, { rough: 0.5, opacity: 0.999 });
const rearM = mat("RearPlate", 0xffffff, { metal: 0.3, rough: 0.55 });
const topCoverM = mat("TopCover", 0xa9acb0, { metal: 0.5, rough: 0.45 });
const liner = mat("Liner", 0xf1f3f5, { rough: 0.6 });
const linerSide = mat("LinerSide", 0xe4e8ec, { rough: 0.65 });
const linerDk = mat("LinerGrey", 0xdde1e6, { rough: 0.6 });
const gasket = mat("Gasket", 0x6c7176, { rough: 0.85 });
const plinth = mat("Plinth", 0x1a1b1d, { rough: 0.8 });
const clear = mat("ClearPlastic", 0xc3d0da, { rough: 0.12, opacity: 0.5, side: THREE.DoubleSide });
const clearLight = mat("ClearPlasticLight", 0xdfe7ee, { rough: 0.12, opacity: 0.26, side: THREE.DoubleSide });
const clearRib = mat("ClearRib", 0xffffff, { rough: 0.3, opacity: 0.92 });
const glass = mat("TemperedGlass", 0xa9cdd6, { rough: 0.05, opacity: 0.55, side: THREE.DoubleSide });
const glassRim = mat("ShelfRim", 0xe3e7ea, { rough: 0.45 });
const edgeGreen = mat("GlassEdge", 0x7fa7b0, { rough: 0.3 });
const white = mat("WhitePlastic", 0xf6f7f8, { rough: 0.45 });
const greyPlastic = mat("GreyPlastic", 0xa9adb2, { rough: 0.5 });
const ventDark = mat("VentSlot", 0x6f747b, { rough: 0.7 });
const ice = mat("IceCube", 0xe3f4ff, { rough: 0.08, opacity: 0.72 });
const lightM = mat("Led", 0xffffff, { emissive: 0xf4f8ff, emissiveIntensity: 1.5 });
const footM = mat("Foot", 0x131416, { rough: 0.7 });
const cordM = mat("Cord", 0x1e1f21, { rough: 0.6 });
const plugM = mat("Plug", 0x232427, { rough: 0.5 });
const pinM = mat("Pin", 0xb7bbc0, { metal: 0.9, rough: 0.3 });
const hingeM = mat("Hinge", 0xc9ccd0, { metal: 0.9, rough: 0.3 });
const printConv = mat("print_convertible", 0xffffff, { rough: 0.6, opacity: 0.999 });
const printIce = mat("print_icemaker", 0xffffff, { rough: 0.6, opacity: 0.999 });
const printF0 = mat("print_fresh0", 0xffffff, { rough: 0.6, opacity: 0.999 });
const printFz = mat("print_freshzone", 0xffffff, { rough: 0.6, opacity: 0.999 });
const panelM = mat("InnerPanel", 0xffffff, { rough: 0.45, opacity: 0.999 });
const stock = LGStock({ T3: `${TEX}/lg_glt3426`, TF: `${TEX}/food`, BR: `${TEX}/brands`, BRT: `${TEX}/brands/small` });

// ── small builders ──
const cyl = (name, rt, rb, h, m, x, y, z, seg = 12) => mesh(name, new THREE.CylinderGeometry(rt, rb, h, seg), m, x, y, z);
const plane = (name, w, h, m, x, y, z) => mesh(name, flipV(new THREE.PlaneGeometry(w, h)), m, x, y, z);
const boxes = (name, list, m) => mesh(name, mergeGeometries(list.map(([w, h, d, x, y, z]) => new THREE.BoxGeometry(w, h, d).translate(x, y, z))), m);
// a clear door basket, open at the top; origin at its floor, its back on the face of the door's liner (10 mm in)
function basket(name, w, dep, h, y, front = true) {
  const g = group(name, 0, y, -0.01);
  g.add(box(name + "Floor", w, 0.004, dep, clear, 0, 0.002, -dep / 2));
  g.add(box(name + "Back", w, h, 0.004, clear, 0, h / 2, -0.002));
  if (front) g.add(box(name + "Lip", w, h * 0.85, 0.004, clear, 0, h * 0.425, -dep + 0.002));
  g.add(box(name + "EndL", 0.004, h, dep, clear, -w / 2 + 0.002, h / 2, -dep / 2));
  g.add(box(name + "EndR", 0.004, h, dep, clear, w / 2 - 0.002, h / 2, -dep / 2));
  g.add(box(name + "Rim", w, 0.006, 0.006, clearRib, 0, h - 0.003, -dep + 0.003));
  return g;
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
// A door slab from a 2D outline (door-local x, y), extruded to depth d with a small rounded edge (the outline is drawn
// already inset by the bevel, so the slab keeps its measured size). Its triangles are sorted by the way they face: the
// front wears mFront with its UVs laid flat over the w x h panel (top of the texture at the top), the back mBack, the rest
// (the edges, and the pocket's walls) mEdge.
function slab(name, shape, x0, w, h, d, bev, mFront, mEdge, mBack) {
  const g = new THREE.ExtrudeGeometry(shape, { depth: d - 2 * bev, bevelEnabled: true, bevelSize: bev, bevelThickness: bev, bevelSegments: 2, curveSegments: 4 });
  g.translate(0, 0, bev);
  const pos = g.attributes.position, n = pos.count / 3, buckets = [[], [], []];
  const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3();
  for (let t = 0; t < n; t++) {
    a.fromBufferAttribute(pos, 3 * t); b.fromBufferAttribute(pos, 3 * t + 1); c.fromBufferAttribute(pos, 3 * t + 2);
    const nz = b.clone().sub(a).cross(c.clone().sub(a)).normalize().z;
    buckets[nz > 0.7 ? 0 : nz < -0.7 ? 2 : 1].push(t);
  }
  const P = [], N = [], U = [], out = new THREE.BufferGeometry();
  const nor = g.attributes.normal;
  let start = 0;
  buckets.forEach((list, gi) => {
    for (const t of list) for (let k = 0; k < 3; k++) {
      const i = 3 * t + k, x = pos.getX(i), y = pos.getY(i);
      P.push(x, y, pos.getZ(i)); N.push(nor.getX(i), nor.getY(i), nor.getZ(i));
      U.push((x - x0) / w, (h - y) / h);
    }
    out.addGroup(start, list.length * 3, gi);
    start += list.length * 3;
  });
  out.setAttribute("position", new THREE.Float32BufferAttribute(P, 3));
  out.setAttribute("normal", new THREE.Float32BufferAttribute(N, 3));
  out.setAttribute("uv", new THREE.Float32BufferAttribute(U, 2));
  return mesh(name, out, [mFront, mEdge, mBack]);
}

const root = group("LGGLT4416");
const cab = group("Cabinet");
root.add(cab);

// ── cabinet shell ──
const Dc = zFront - zBody, sideH = cabTop - feet, sideMid = feet + sideH / 2, zMid = zBody + Dc / 2;
// the sides wrap round to the front flange, which takes the top's colour (black on Ebony Sheen, grey on Shiny Steel)
cab.add(mesh("SideLeft", flipV(new THREE.BoxGeometry(wall, sideH, Dc)), [linerSide, sideM, topM, plinth, topM, sideM], -W / 2 + wall / 2, sideMid, zMid));
cab.add(mesh("SideRight", flipV(new THREE.BoxGeometry(wall, sideH, Dc)), [sideM, linerSide, topM, plinth, topM, sideM], W / 2 - wall / 2, sideMid, zMid));
cab.add(faced("Top", inW, cabTop - fy1, Dc, [topM, topM, topM, liner, topM, topM], 0, (cabTop + fy1) / 2, zMid));
cab.add(faced("Divider", inW, fy0 - gy1, inD, [liner, liner, liner, liner, liner, liner], 0, (fy0 + gy1) / 2, zIn1 + inD / 2));
cab.add(faced("Base", inW, gy0 - feet, Dc, [liner, liner, liner, liner, topM, liner], 0, feet + (gy0 - feet) / 2, zMid));
cab.add(box("Kickplate", inW, 0.026, 0.012, plinth, 0, feet + 0.013, zFront - 0.006));
cab.add(faced("BackFreezer", inW, fy1 - fy0, 0.012, [linerDk, linerDk, linerDk, linerDk, linerDk, linerDk], 0, (fy0 + fy1) / 2, zIn1 + 0.006));
cab.add(faced("BackFridge", inW, gy1 - gy0, 0.012, [liner, liner, liner, liner, liner, liner], 0, (gy0 + gy1) / 2, zIn1 + 0.006));
// the real back: LG's rear photo of this model (cropped to the cabinet's full-width rows) on a thin plate, from the
// rollers to the cabinet's top
const rearBot = feet, rearTop = cabTop;
cab.add(mesh("RearPlate", flipV(new THREE.BoxGeometry(W, rearTop - rearBot, 0.004)), [steelEdge, steelEdge, steelEdge, steelEdge, steelEdge, rearM], 0, (rearTop + rearBot) / 2, zBody + 0.002));
// the rear spacers: black blocks at both top corners, 25 mm deep (the manual's D), about 50 x 36 mm on the rear photo
for (const sx of [-1, 1]) cab.add(box("RearSpacer", 0.05, 0.036, zBody - zBack, plinth, sx * (W / 2 - 0.025), cabTop - 0.015, zBack + (zBody - zBack) / 2));
// the silver top cover at the back (rear photo: 127-749 % of the width from the fridge's right, 18 mm tall); its depth
// is not shown on any photo (estimated 120 mm)
cab.add(box("TopCover", 0.435, 0.018, 0.12, topCoverM, (W / 2 - 0.127 * W + W / 2 - 0.749 * W) / 2, cabTop + 0.009, zBody + 0.06));
// the black hinge cover on the cabinet's top at the front right (open-door photos DZ-04 and DZ-06: 553-665 mm from the
// left, top at 1.769 m) and the top hinge's bracket out to the door
cab.add(box("HingeCoverTop", 0.112, 0.033, 0.07, plinth, -W / 2 + 0.609, cabTop + 0.0165, zFront - 0.036));
cab.add(box("HingeTop", 0.034, 0.012, 0.05, plinth, W / 2 - 0.018, cabTop + 0.006, zFront - 0.026));
// feet: an adjustable foot at the front left (17-50 mm from the left on the front photo), a levelling leg under the lower
// hinge at the front right (653-694 mm, 18 mm tall), two rollers at the back
cab.add(cyl("FootFront", 0.0165, 0.0165, feet, footM, -W / 2 + 0.0335, feet / 2, zFront - 0.04, 16));
cab.add(cyl("FootLevel", 0.0205, 0.0205, 0.012, footM, W / 2 - 0.0265, 0.006, zFront + 0.018, 18));
cab.add(cyl("FootThread", 0.006, 0.006, feet - 0.012, pinM, W / 2 - 0.0265, 0.012 + (feet - 0.012) / 2, zFront + 0.018, 10));
cab.add(box("HingeLow", 0.05, 0.007, 0.07, hingeM, W / 2 - 0.025, feet + 0.0035, zFront + 0.005));
for (const fx of [-1, 1]) cab.add(cyl("Roller", 0.017, 0.017, 0.018, footM, fx * (W / 2 - 0.108), 0.017, zBody + 0.06).rotateZ(Math.PI / 2));
// the middle hinge: a steel plate in the gap between the doors on the right, with two bolt heads
cab.add(box("HingeMid", 0.034, 0.0035, doorT + 0.012, hingeM, W / 2 - 0.02, (fzBot + frTop) / 2, zFront + (doorT + 0.012) / 2 - 0.012));
for (const dz of [0.008, 0.028]) cab.add(cyl("HingeBolt", 0.0045, 0.0045, 0.001, hingeM, W / 2 - 0.02, (fzBot + frTop) / 2 + 0.0022, zFront + dz, 10));
// power cord: LG's rear photos show no cord (the open bay shows the compressor, its pipes and the drain tray), so its
// route is estimated: out of the bay beside the compressor (on the fridge's right), down to the floor and back, its
// three-pin plug lying behind the right rear corner
{
  const V = (x, y, z) => new THREE.Vector3(x, y, z);
  const px = W / 2 - 0.05, py = 0.023, pz = zBack - 0.1;
  const pts = [V(0.2, 0.16, zBody + 0.03), V(0.215, 0.15, zBody - 0.004), V(0.24, 0.11, zBody - 0.012), V(0.27, 0.05, zBody - 0.03), V(0.29, 0.012, zBody - 0.06), V(px, 0.006, pz + 0.04), V(px, py - 0.012, pz + 0.008)];
  cab.add(mesh("PowerCord", new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts, false, "centripetal"), 80, 0.0035, 6, false), cordM));
  const sh = new THREE.Shape(), w = 0.045, h = 0.042, r = 0.012;
  sh.moveTo(-w / 2 + r, -h / 2); sh.lineTo(w / 2 - r, -h / 2); sh.quadraticCurveTo(w / 2, -h / 2, w / 2, -h / 2 + r);
  sh.lineTo(w / 2, h / 2 - r); sh.quadraticCurveTo(w / 2, h / 2, w / 2 - r, h / 2); sh.lineTo(-w / 2 + r, h / 2);
  sh.quadraticCurveTo(-w / 2, h / 2, -w / 2, h / 2 - r); sh.lineTo(-w / 2, -h / 2 + r); sh.quadraticCurveTo(-w / 2, -h / 2, -w / 2 + r, -h / 2);
  // the plug lies on its face on the floor, pins up and back
  const plug = mesh("Plug", new THREE.ExtrudeGeometry(sh, { depth: 0.016, bevelEnabled: true, bevelSize: 0.002, bevelThickness: 0.002, bevelSegments: 2, curveSegments: 8 }), plugM, px, 0.002, pz);
  plug.rotation.x = -Math.PI / 2;
  cab.add(plug);
  for (const [dx, dy] of [[0, 0.0105], [-0.0095, -0.0065], [0.0095, -0.0065]]) {
    const pin = cyl("PlugPin", 0.0026, 0.0026, 0.016, pinM, px + dx, 0.002 + 0.016 + 0.002 + 0.008, pz - dy, 10);
    cab.add(pin);
  }
}

// ── freezer inside ──
const xL = -inW / 2, xR = inW / 2;
// the back wall: a raised panel (the photo: from the floor to 1.62 m, 35 mm in from each side), with two rows of vent
// slots (on the wall above it at 1.655 m and on its top at 1.595 m; each a long run left and right of a short group of
// five in the middle) and a short run under the shelf on the right (1.405 m); "Convertible" printed on it at 1.51 m.
// Positions are read off the open-door photo DZ-06 in perspective (+-2 cm).
const rpZ = zIn1 + 0.012 + 0.0075;
cab.add(box("FreezerPanel", inW - 0.07, 1.625 - fy0, 0.015, linerDk, 0, (fy0 + 1.625) / 2, rpZ));
function ventRow(name, y, z, runs) {
  const strips = [], slots = [];
  for (const [x0, x1] of runs) {
    strips.push([x1 - x0 + 0.01, 0.016, 0.004, (x0 + x1) / 2, y, z]);
    const n = Math.round((x1 - x0) / 0.0105);
    for (let i = 0; i <= n; i++) slots.push(new THREE.PlaneGeometry(0.0065, 0.009).translate(x0 + (i * (x1 - x0)) / n, y, z + 0.0026));
  }
  cab.add(boxes(name, strips, white));
  cab.add(mesh(name + "Slot", mergeGeometries(slots), ventDark));
}
ventRow("FreezerVentTop", 1.655, zIn1 + 0.014, [[-0.255, -0.03], [-0.008, 0.022], [0.048, 0.285]]);
ventRow("FreezerVentPanel", 1.595, rpZ + 0.0095, [[-0.255, -0.03], [-0.008, 0.022], [0.048, 0.285]]);
ventRow("FreezerVentLow", 1.405, rpZ + 0.0095, [[0.07, 0.225]]);
cab.add(plane("PrintConvertible", 0.13, 0.0232, printConv, 0.01, 1.51, rpZ + 0.0081));
cab.add(box("FreezerLed", 0.16, 0.006, 0.014, lightM, 0, fy1 - 0.003, zIn1 + 0.07));
// freezer glass shelf across the cavity, with its white front rim and rails
{
  const g = group("FreezerShelf", 0, fzShelfY, 0), z0 = rpZ + 0.0095, bd = fzShelfFront - 0.005 - z0;
  g.add(box("FzShelfGlass", inW - 0.012, 0.005, bd, glass, 0, 0, z0 + bd / 2));
  g.add(box("FzShelfRimF", inW - 0.008, 0.012, 0.01, glassRim, 0, 0.004, fzShelfFront - 0.005));
  g.add(box("FzShelfRailL", 0.008, 0.012, bd, glassRim, xL + 0.01, 0.003, z0 + bd / 2));
  g.add(box("FzShelfRailR", 0.008, 0.012, bd, glassRim, xR - 0.01, 0.003, z0 + bd / 2));
  cab.add(g);
}
// the ice maker hangs under the shelf on the left (DZ-06: 180 mm wide, 111-291 mm from the left, its bin's floor at
// 1.305 m); its front stays 95 mm behind the door's face so the lower door basket clears it. Two white rails under the
// shelf carry it.
const icX = -W / 2 + 0.201, icW = 0.18, icZ = zFront - 0.095, icD = 0.21;
for (const sx of [-1, 1]) cab.add(box("IceRail", 0.008, 0.008, icD + 0.02, white, icX + sx * (icW / 2 + 0.002), fzShelfY - 0.0065, icZ - icD / 2 - 0.01));

// ── fridge inside ──
const trays = group("FridgeTrays");
cab.add(trays);
cab.add(box("FridgeLed", 0.2, 0.006, 0.016, lightM, 0, gy1 - 0.003, zFront - 0.17));
// the air duct up the back wall (DZ-07: 200 mm wide, widening to 310 mm under the Fresh 0 Zone tray), 10 mm proud, from
// the drawer's cover to the tray, with the vent grille under the tray, the inner control panel (118 x 57 mm, the manual's
// Type B) at 0.87 m and the round deodoriser cap at 0.42 m
const dZ = zIn1 + 0.012 + 0.005;
{
  const sh = new THREE.Shape();
  sh.moveTo(-0.1, coverY + 0.006); sh.lineTo(0.1, coverY + 0.006); sh.lineTo(0.1, 0.915); sh.lineTo(0.155, f0Y - 0.012);
  sh.lineTo(-0.155, f0Y - 0.012); sh.lineTo(-0.1, 0.915); sh.closePath();
  const g = new THREE.ExtrudeGeometry(sh, { depth: 0.01, bevelEnabled: false });
  cab.add(mesh("FridgeDuct", g, liner, 0, 0, zIn1 + 0.012));
}
cab.add(boxes("FridgeDuctGrille", [[0.06, 0.014, 0.003, 0, 0.975, dZ + 0.0065]], white));
cab.add(boxes("FridgeDuctGrilleSlot", [0, 1, 2, 3, 4, 5, 6].map((i) => [0.0045, 0.008, 0.002, -0.022 + i * 0.0073, 0.975, dZ + 0.0085]), ventDark));
cab.add(plane("InnerPanel", 0.118, 0.057, panelM, 0, 0.87, dZ + 0.0058));
cab.add(cyl("Deodoriser", 0.028, 0.028, 0.008, white, 0, 0.42, dZ + 0.0092, 24).rotateX(Math.PI / 2));
// the Door Cooling duct on the left wall (DZ-07: 0.775-1.04 m) with its two round outlets at 1.01 and 0.81 m; set 4 mm
// proud so the shelves' glass and rails clear it; its place front to back is estimated from perspective (in front of the
// Fresh 0 Zone tray)
const dcZ = zFront - 0.13;
cab.add(box("DoorCoolingDuct", 0.003, 0.265, 0.06, greyPlastic, xL + 0.0015, 0.9075, dcZ));
for (const sy of [1.01, 0.81]) cab.add(cyl("DoorCoolingOutlet", 0.017, 0.017, 0.0015, ventDark, xL + 0.0038, sy, dcZ, 20).rotateZ(Math.PI / 2));
// Fresh 0 Zone: a pull-out tray at the top, a clear box on side rails with LG's printed words on its front
const f0 = { bw: inW - 0.012, bd: 0.40, bh: 0.138 };
f0.zc = zIn1 + f0.bd / 2 + 0.014;
{
  const { bw, bd, bh, zc } = f0, g = group("Fresh0Zone", 0, f0Y, 0);
  g.add(box("F0Floor", bw, 0.004, bd, clear, 0, 0, zc));
  g.add(box("F0Back", bw, bh, 0.004, clearLight, 0, bh / 2, zIn1 + 0.016));
  g.add(box("F0SideL", 0.004, bh, bd, clear, -bw / 2, bh / 2, zc));
  g.add(box("F0SideR", 0.004, bh, bd, clear, bw / 2, bh / 2, zc));
  g.add(box("F0FrontLow", bw, 0.05, 0.004, clearLight, 0, 0.025, zc + bd / 2));
  g.add(box("F0FrontHigh", bw - 0.02, 0.083, 0.004, clearLight, 0, 0.0965, zc + bd / 2 - 0.004));
  g.add(box("F0Rim", bw, 0.008, 0.01, clearRib, 0, bh - 0.003, zc + bd / 2 - 0.004));
  g.add(box("F0Handle", 0.2, 0.012, 0.014, clearRib, 0, 0.05, zc + bd / 2 + 0.006));
  g.add(plane("PrintFresh0", 0.212, 0.047, printF0, 0, 0.11, zc + bd / 2 - 0.0015));
  trays.add(g);
}
stock.fresh0(trays, { y: f0Y + 0.002, z: f0.zc + 0.03 });
// three tempered-glass shelves with white rims, starting in front of the duct
function shelf(name, y) {
  const g = group(name, 0, y, 0), z0 = zIn1 + 0.03, bd = shelfFront - 0.0085 - z0;
  g.add(box(name + "Glass", inW - 0.01, 0.006, bd, glass, 0, 0, z0 + bd / 2));
  g.add(box(name + "Rim", inW - 0.01, 0.014, 0.012, glassRim, 0, 0.004, shelfFront - 0.0085));
  g.add(box(name + "Edge", inW - 0.01, 0.004, 0.003, edgeGreen, 0, -0.002, shelfFront - 0.0015));
  g.add(box(name + "RimBack", inW - 0.01, 0.01, 0.01, glassRim, 0, 0.002, z0 + 0.006));
  g.add(box(name + "RailL", 0.01, 0.014, bd, glassRim, xL + 0.012, 0, z0 + bd / 2));
  g.add(box(name + "RailR", 0.01, 0.014, bd, glassRim, xR - 0.012, 0, z0 + bd / 2));
  trays.add(g);
}
shelf("Shelf1", s1);
shelf("Shelf2", s2);
shelf("Shelf3", s3);
// Fresh Zone: a glass cover (fixed) over a big clear drawer with LG's printed words on its front
const fzD = drawerFront - zIn1 - 0.016, fzW = inW - 0.02, fzC = zIn1 + fzD / 2 + 0.016, fzH = 0.315 - drawerY;
{
  const g = group("FreshZoneCover", 0, 0, 0);
  g.add(box("FzGlassCover", inW - 0.01, 0.006, fzD, glass, 0, coverY, fzC));
  g.add(box("FzCoverRim", inW - 0.01, 0.012, 0.012, glassRim, 0, coverY + 0.003, drawerFront - 0.006));
  cab.add(g);
}
{
  const g = group("FreshZone", 0, 0, 0), bd = fzD, bw = fzW, zc = fzC, yc = drawerY + fzH / 2;
  g.add(box("FzBoxFloor", bw, 0.004, bd, clear, 0, drawerY, zc));
  g.add(box("FzBoxBack", bw, fzH, 0.004, clear, 0, yc, zIn1 + 0.018));
  g.add(box("FzBoxL", 0.004, fzH, bd, clear, -bw / 2, yc, zc));
  g.add(box("FzBoxR", 0.004, fzH, bd, clear, bw / 2, yc, zc));
  g.add(box("FzBoxFront", bw, fzH, 0.004, clearLight, 0, yc, zc + bd / 2));
  g.add(box("FzBoxRim", bw, 0.008, 0.008, clearRib, 0, drawerY + fzH - 0.004, zc + bd / 2));
  g.add(box("FzBoxFootRim", bw, 0.008, 0.008, clearRib, 0, drawerY + 0.003, zc + bd / 2));
  g.add(plane("PrintFreshZone", 0.208, 0.0509, printFz, 0, 0.245, zc + bd / 2 + 0.0023));
  trays.add(g);
}

// ── stock: vegetarian South Indian food, eggs, juices, water and soft drinks (stock_lg.mjs, food.mjs) ──
stock.shelves(trays, {
  zIn1, inW, inD, s1, s2, s3, fz: drawerY + 0.002, fit: true, vk: 0.8,
  shelfB: { hw: inW / 2 - 0.03, z0: zIn1 + 0.044, z1: shelfFront - 0.015 },
  drawerB: { hw: fzW / 2 - 0.014, z0: zIn1 + 0.04, z1: drawerFront - 0.006, y0: drawerY + 0.002 },
  drawerCeil: coverY - 0.003 - 0.01 - (drawerY + 0.002), // the heap stays 1 cm under the drawer's glass cover
});
// LG's stocked photo (DZ-06) has the ice-cream tubs and standing packs on the glass shelf and flat packs on the floor,
// so stock_lg.mjs's "floor" and "top" are given the other way round (as on the LG 466 L)
const fzB = { hw: inW / 2 - 0.03, z0: rpZ + 0.02, z1: fzShelfFront - 0.02 };
stock.freezer(cab, { fit: true, zIn1, floor: fzShelfY + 0.0025, top: fy0, box: fzB });
// and, as in that photo, the tubs at the shelf's left and the packs at its right, one behind the other, so the
// "Convertible" print shows between them (stock_lg.mjs lines them up across the middle)
{
  const at = (n) => cab.getObjectByName(n), bx = (o) => new THREE.Box3().setFromObject(o);
  cab.updateMatrixWorld(true);
  for (const n of ["AmulVanillaMagic", "AmulRajbhog"]) { const o = at(n), b = bx(o); o.position.x += -fzB.hw - b.min.x; }
  let z = fzB.z0;
  for (const n of ["ViswasParotta", "NityaParotta", "FreshoGreenPeas"]) {
    const o = at(n); o.updateMatrixWorld(true); const b = bx(o);
    o.position.x += fzB.hw - b.max.x; o.position.z += z - b.min.z; z += b.max.z - b.min.z + 0.012;
  }
  if (z - 0.012 > fzB.z1) console.warn(`freezer shelf: the packs need ${((z - fzB.z0) * 1000).toFixed(0)} mm of depth`);
}

// ── ice maker: the tray unit and its bin slide out together (a real part): a white band with "Ice Maker" printed on
// it, the twist trays' face with their two round levers, a clear bin under them (DZ-06: band 22 mm, face 63 mm, bin
// 70 mm; levers 34 mm across, 37 mm either side of the middle) ──
const ic = group("IceMaker", icX, 0, icZ);
{
  ic.add(box("IceBand", icW, 0.02, 0.03, white, 0, 1.447, -0.015));
  ic.add(plane("PrintIceMaker", 0.044, 0.0094, printIce, 0, 1.447, 0.0007));
  ic.add(box("IceFace", icW - 0.004, 0.063, 0.012, white, 0, 1.4065, -0.01));
  // each lever a round white knob in a grey ring, a grip bar across it
  for (const sx of [-1, 1]) {
    ic.add(cyl("IceLeverRing", 0.0175, 0.0175, 0.003, greyPlastic, sx * 0.037, 1.404, -0.0025, 24).rotateX(Math.PI / 2));
    ic.add(cyl("IceLever", 0.0155, 0.0155, 0.005, white, sx * 0.037, 1.404, -0.0015, 24).rotateX(Math.PI / 2));
    ic.add(box("IceLeverGrip", 0.026, 0.005, 0.005, greyPlastic, sx * 0.037, 1.404, 0.0035));
  }
  ic.add(box("IceTrayBody", icW - 0.012, 0.05, icD - 0.03, white, 0, 1.405, -0.016 - (icD - 0.03) / 2));
  ic.add(box("IceBinFloor", icW - 0.01, 0.004, icD - 0.02, clear, 0, 1.307, -(icD - 0.02) / 2 - 0.006));
  ic.add(box("IceBinFront", icW - 0.01, 0.068, 0.004, clear, 0, 1.341, -0.006));
  ic.add(box("IceBinL", 0.004, 0.068, icD - 0.02, clear, -(icW - 0.01) / 2, 1.341, -(icD - 0.02) / 2 - 0.006));
  ic.add(box("IceBinR", 0.004, 0.068, icD - 0.02, clear, (icW - 0.01) / 2, 1.341, -(icD - 0.02) / 2 - 0.006));
  ic.add(box("IceBinBack", icW - 0.01, 0.068, 0.004, clear, 0, 1.341, -icD + 0.016));
  const cubes = [];
  for (let i = 0; i < 16; i++) {
    const c = new THREE.BoxGeometry(0.03, 0.025, 0.03);
    c.applyMatrix4(new THREE.Matrix4().compose(new THREE.Vector3(-0.055 + (i % 4) * 0.037 + (Math.floor(i / 4) % 2) * 0.012, 1.323 + Math.floor(i / 8) * 0.022, -0.05 - Math.floor((i % 8) / 4) * 0.06 - (i % 3) * 0.012),
      new THREE.Quaternion().setFromEuler(new THREE.Euler(0.2 * (i % 3), 0.5 * i, 0.15 * (i % 4))), new THREE.Vector3(1, 1, 1)));
    cubes.push(c);
  }
  ic.add(mesh("IceCube", mergeGeometries(cubes), ice));
}
cab.add(ic);
// anything on the freezer floor that would reach into the ice maker as it slides out
leaveOut(cab.getObjectByName("OnFreezerShelf"), [B3(icX - icW / 2 - 0.01, 1.30, icZ - icD - 0.01, icX + icW / 2 + 0.01, fzShelfY, zFront + 0.2)], "under the ice maker");

// ── doors: hinged on the right; no handles, a pocket under a silver cap at the top of the fridge door ──
const pw = W - 0.004, bev = 0.0015;
const inside = (x0, x1) => (dep) => [x0 + 0.004, x1 - 0.004, -(0.01 + dep / 2)];
function doorShell(name, y0, parts) { const g = group(name, W / 2, y0, zFront); parts(g); return g; }
function gaskets(g, p, h) {
  g.add(box(p + "GasketT", pw - 0.02, 0.014, 0.014, gasket, -pw / 2, h - 0.012, -0.007));
  g.add(box(p + "GasketB", pw - 0.02, 0.014, 0.014, gasket, -pw / 2, 0.012, -0.007));
  g.add(box(p + "GasketL", 0.014, h - 0.02, 0.014, gasket, -pw + 0.012, h / 2, -0.007));
  g.add(box(p + "GasketR", 0.014, h - 0.02, 0.014, gasket, -0.012, h / 2, -0.007));
  g.add(box(p + "Liner", pw - 0.05, h - 0.05, 0.012, liner, -pw / 2, h / 2, -0.004));
}
const rect = (x0, y0, x1, y1) => { const s = new THREE.Shape(); s.moveTo(x0, y0); s.lineTo(x1, y0); s.lineTo(x1, y1); s.lineTo(x0, y1); s.closePath(); return s; };
const freezerDoor = doorShell("FreezerDoor", fzBot, (g) => {
  const h = H - fzBot;
  g.add(slab("FzPanel", rect(-pw + bev, bev, -bev, h - bev), -pw, pw, h, doorT, bev, doorFzM, doorEdge, liner));
  g.add(box("FzUnderside", pw - 2 * bev, 0.0005, doorT - bev, seamM, -pw / 2, -0.0003, (doorT - bev) / 2));
  // print, measured on LG's front photos: the LG mark 64 x 27 mm, 31 mm from the left and 31 mm down; the energy label
  // 73 mm wide (at its photo's aspect, 0.522), 30 mm from the right and 33 mm down
  g.add(plane("LgMarkDecal", 0.064, 0.0293, logoM, -pw + 0.031 + 0.032, h - 0.031 - 0.0147, doorT + 0.0007));
  g.add(plane("BeeLabelDecal", 0.073, 0.073 / 0.522, labelM, -0.03 - 0.0365, h - 0.033 - 0.073 / 0.522 / 2, doorT + 0.0007));
  gaskets(g, "Fz", cabTop - fzBot); // the gasket seals on the cabinet's front, which ends 44 mm under the door's top
  const b1 = 1.586 - fzBot, b2 = 1.286 - fzBot, kw = pw - 0.1;
  const k1 = basket("FzBasket1", kw, 0.07, 0.065, b1, true); k1.position.x = -pw / 2; g.add(k1);
  const k2 = basket("FzBasket2", kw, 0.07, 0.065, b2, true); k2.position.x = -pw / 2; g.add(k2);
  stock.doorFreezer(g, { fit: true, b1, b2, dep: 0.07, inside: inside(-pw / 2 - kw / 2, -pw / 2 + kw / 2) });
});
// the fridge door's face: its outline with the pocket cut out of its top (LG's front photo of the Shiny Steel, in mm
// from the door's left: the pocket's flat floor at 1.1679 m from 160 to 585 mm, its ends curving up to the cap at 48
// and 662 mm)
const fridgeDoor = doorShell("FridgeDoor", frLow, (g) => {
  const h = capBot - frLow, y = (v) => v - frLow, X = (mm) => -pw + (mm / 1000) * (pw / W), top = h - bev;
  const sh = new THREE.Shape();
  // each end a smooth curve through the measured points, sampled into 10 straight pieces (keeps the slab light)
  const curve = (pts) => new THREE.CatmullRomCurve3(pts.map(([mm, v]) => new THREE.Vector3(X(mm), v, 0)), false, "centripetal").getPoints(10);
  const right = curve([[662, top], [658, y(1.200) + bev], [643, y(1.190) + bev], [623, y(1.179) + bev], [603, y(1.1715) + bev], [585, y(1.1679) + bev]]);
  const left = curve([[160, y(1.1679) + bev], [130, y(1.1695) + bev], [98, y(1.174) + bev], [85, y(1.179) + bev], [65, y(1.189) + bev], [50, y(1.199) + bev], [48, top]]);
  sh.moveTo(-pw + bev, bev); sh.lineTo(-bev, bev); sh.lineTo(-bev, top);
  for (const p of [...right, ...left]) sh.lineTo(p.x, p.y);
  sh.lineTo(-pw + bev, top); sh.closePath();
  g.add(slab("FrPanel", sh, -pw, pw, h, doorT, bev, doorFrM, doorEdge, liner));
  // the pocket: its back wall 30 mm in (estimated), dark, behind the cut-out
  const pd = 0.03, pL = X(46), pR = X(664);
  g.add(box("PocketBack", pR - pL, capBot - 1.1679 + 0.004, doorT - pd - 0.002, pocketM, (pL + pR) / 2, y((capBot + 1.1679) / 2), (doorT - pd) / 2 + 0.001));
  // the silver cap across the door's top (10 mm), whose underside is the pocket's ceiling
  g.add(mesh("FrCap", new THREE.BoxGeometry(pw, frTop - capBot, doorT), [silverCap, silverCap, silverCap, silverCap, silverCap, liner], -pw / 2, y((frTop + capBot) / 2), doorT / 2));
  gaskets(g, "Fr", frTop - frLow);
  // baskets, floors on LG's open-door photo: two pairs of half baskets (1.034 and 0.807 m), a single half on the door's
  // free side (0.635), two full baskets (0.34 and 0.09)
  const kw = pw - 0.12, hw = (kw - 0.012) / 2, xc = -pw / 2, xHinge = xc + hw / 2 + 0.006, xFree = xc - hw / 2 - 0.006;
  const add = (n, w, x, dep, hh, yy) => { const k = basket(n, w, dep, hh, yy, true); k.position.x = x; g.add(k); return k; };
  const hY1 = y(1.034), hY2 = y(0.807), hY3 = y(0.635), fY1 = y(0.34), fY2 = y(0.09);
  add("HalfBasket1R", hw, xHinge, 0.075, 0.062, hY1); add("HalfBasket1L", hw, xFree, 0.075, 0.062, hY1);
  add("HalfBasket2R", hw, xHinge, 0.075, 0.062, hY2); add("HalfBasket2L", hw, xFree, 0.075, 0.062, hY2);
  add("HalfBasket3", hw, xFree, 0.075, 0.07, hY3);
  add("FullBasket1", kw, xc, 0.095, 0.15, fY1); add("FullBasket2", kw, xc, 0.085, 0.13, fY2);
  g.add(box("EggCupsRib", hw - 0.02, 0.006, 0.05, clearRib, xHinge, hY1 + 0.006, -0.047));
  // stock: the eggs in the hinge-side half basket at the top (the movable egg tray), the jars and pouches in the lower
  // full basket, the bottles and cartons in the upper one; no cans (no basket left for them)
  const deps = { egg: 0.075, jar: 0.085, bottle: 0.095 };
  const ranges = new Map([[deps.egg, [xHinge - hw / 2, xHinge + hw / 2]], [deps.jar, [xc - kw / 2, xc + kw / 2]], [deps.bottle, [xc - kw / 2, xc + kw / 2]]]);
  stock.doorFridge(g, { fit: true, eggY: hY1, jarY: fY2, botY: fY1, canY: null, deps, inside: (dep) => inside(...ranges.get(dep))(dep),
    eggX: [0, 1, 2, 3, 4].map((i) => xHinge - 0.104 + i * 0.052) });
  // stock_lg.mjs lines the bottle row up with the 2 L bottles at the door's free side, under the single half basket,
  // which they would cut into; turned end for end (same spacing) the bottles stand on the hinge side and the cartons go
  // under the half basket
  for (const n of ["Coke", "Fanta", "Bisleri", "RealMango", "RealMixedFruit", "AmulTaaza"]) { const o = g.getObjectByName(n); o.position.x = 2 * xc - o.position.x; }
});
root.add(freezerDoor, fridgeDoor);

const parts = productParts(PRODUCTS, ID);
const clips = stateClips(root, parts);
saveZones(PRODUCTS, ID, root, parts);
const textures = {
  DoorFreezer: `${T}/door_freezer_es.jpg`, DoorFridge: `${T}/door_fridge_es.jpg`, SideSteel: `${T}/side_es.jpg`, RearPlate: `${T}/rear.jpg`,
  LabelBEE: `${T}/label.png`, LgMark: `${T}/lgmark_es.png`, InnerPanel: `${T}/panel.png`,
  print_convertible: `${T}/print_convertible.png`, print_icemaker: `${T}/print_icemaker.png`, print_fresh0: `${T}/print_fresh0.png`, print_freshzone: `${T}/print_freshzone.png`,
};
Object.assign(textures, stock.textures());
// Grain (BENCHMARK.md section 10): the doors get the LG 343 L's hairline under a clear film here, which is the Shiny
// Steel's; the Ebony Sheen copies drop the hairline below (a smooth gloss). Sides and top: the soft peel of factory paint.
await exportGLB(root, clips, OUT, textures, { dir: `${TEX}/grain`, materials: {
  DoorFreezer: { type: "hairline", dir: "v", clearcoat: [0.6, 0.12] },
  DoorFridge: { type: "hairline", dir: "v", clearcoat: [0.6, 0.12] },
  SideSteel: { type: "peel_soft" }, TopSteel: { type: "peel_soft" },
} });

// ── the two colours as material variants (KHR_materials_variants). Ebony Sheen (GLT4416CCES) is the file's own look;
// Shiny Steel (GLT4416CCPZ) swaps the doors, sides, top and LG mark. Each colour's numbers are matched to its own LG
// photos (tex_lg_glt4416.py gives them). ──
{
  const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
  const doc = await io.readBinary(new Uint8Array(fs.readFileSync(OUT)));
  const ext = doc.createExtension(KHRMaterialsVariants);
  const coat = doc.createExtension(KHRMaterialsClearcoat);
  const lin = (c) => ((c / 255) <= 0.04045 ? c / 255 / 12.92 : Math.pow((c / 255 + 0.055) / 1.055, 2.4));
  const mats = doc.getRoot().listMaterials(), byName = (n) => { const m = mats.find((x) => x.getName() === n); if (!m) throw new Error(`no material ${n}`); return m; };
  const tex = (file) => doc.createTexture(file.split("/").pop().replace(/\.\w+$/, "")).setImage(new Uint8Array(fs.readFileSync(file))).setMimeType(file.endsWith(".png") ? "image/png" : "image/jpeg");
  // Shiny Steel: the LG 466 L's recipe (m 0.38, r 0.5, hairline, clear film [0.6, 0.12]), on its own textures
  const PZ = {
    DoorFreezer: (m) => m.setBaseColorTexture(tex(`${T}/door_freezer_pz.jpg`)).setMetallicFactor(0.38).setRoughnessFactor(0.5),
    DoorFridge: (m) => m.setBaseColorTexture(tex(`${T}/door_fridge_pz.jpg`)).setMetallicFactor(0.38).setRoughnessFactor(0.5),
    SideSteel: (m) => m.setBaseColorTexture(tex(`${T}/side_pz.jpg`)),
    TopSteel: (m) => m.setBaseColorFactor([...[0x7e, 0x80, 0x83].map(lin), 1]),
    LgMark: (m) => m.setBaseColorTexture(tex(`${T}/lgmark_pz.png`)),
  };
  const vES = ext.createVariant("Ebony Sheen"), vPZ = ext.createVariant("Shiny Steel"), alt = {};
  for (const [name, fn] of Object.entries(PZ)) {
    const base = byName(name), pz = base.clone().setName(`${name}ShinySteel`);
    const cc = base.getExtension("KHR_materials_clearcoat");
    if (cc) pz.setExtension("KHR_materials_clearcoat", coat.createClearcoat().setClearcoatFactor(cc.getClearcoatFactor()).setClearcoatRoughnessFactor(cc.getClearcoatRoughnessFactor()));
    fn(pz);
    alt[name] = [base, pz];
  }
  // Ebony Sheen doors: a satin black sheen, no hairline and no clear film: m 1, r 0.5, the colour texture at level 45.
  // Swept on the page's light (look pass, 10 Nov), door grey levels at the default 3/4 view / straight on / 3/4 from the
  // right, against LG's photos (1-8 / 20 / 8-20): any clear film, or metal under 1, mirrors the studio's bright top and
  // the doors read grey (35-53 with m 0.9, r 0.3 and a film [0.15, 0.25]); a sharper metal (r 0.35) still shows it
  // (8-21); r 0.5 to 0.7 keeps them black, and level 42-50 then brings straight on to 16-25.
  for (const n of ["DoorFreezer", "DoorFridge"]) {
    const m = byName(n);
    m.setNormalTexture(null).setMetallicRoughnessTexture(null).setMetallicFactor(1).setRoughnessFactor(0.5);
    m.setExtension("KHR_materials_clearcoat", null);
  }
  for (const m of doc.getRoot().listMeshes()) for (const p of m.listPrimitives()) {
    const pair = alt[p.getMaterial()?.getName()];
    if (!pair) continue;
    const list = ext.createMappingList();
    list.addMapping(ext.createMapping().setMaterial(pair[0]).addVariant(vES));
    list.addMapping(ext.createMapping().setMaterial(pair[1]).addVariant(vPZ));
    p.setExtension("KHR_materials_variants", list);
  }
  // the pocket and the gap strip: no reflection of their own (as the LG 260 L's seam fins)
  const sp = doc.createExtension(KHRMaterialsSpecular);
  for (const n of ["PocketDark", "SeamFin"]) byName(n).setExtension("KHR_materials_specular", sp.createSpecular().setSpecularFactor(0));
  // drop the hairline images if nothing uses them any more (they stay: the Shiny Steel copies use them)
  fs.writeFileSync(OUT, await io.writeBinary(doc));
  console.log(OUT, (fs.statSync(OUT).size / 1048576).toFixed(2) + " MB with 2 colours");
}
