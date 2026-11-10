// LG GLT2526XWPZ, 251 L double-door refrigerator, Shiny Steel.
// Built to LG's published size, 555 W x 1573 H x 637 D mm (LG's page and Sangeetha listing 21329), from LG's gallery photos
// of this model (front, 3/4, sides, open, stocked, rear): freezer on top (59 L) with a dial and the Convertible print on its
// back wall, one shelf and a manual ice maker (lever and two trays) hanging under it on the right; fridge below (192 L) with a
// clear Turbo Fresh Zone box under the ceiling, two tempered-glass shelves, a glass cover and a Fresh Zone drawer with a white front; 2
// baskets in the freezer door and 3 in the fridge door; both doors hinged on the right; a black pocket grip across the top
// of the fridge door. As on the LG 343 L, the trays (the Turbo Fresh Zone, the shelves, the drawer's glass cover and the drawer) are
// one part (FridgeTrays) that slides out with its food when the fridge door is open.
// Heights are read off LG's photos (private research notes give each number and how it was measured).
// Stocked for a south Indian kitchen. usage: node make_lg_glt2526.mjs <products.json> <tex dir> <out.glb>
import fs from "node:fs";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { THREE, mat, mesh, box, faced, group, flipV, stateClips, exportGLB, productParts, saveZones } from "./lib.mjs";
import { LGStock } from "./stock_lg.mjs";

const [PRODUCTS, TEX, OUT] = process.argv.slice(2);
const ID = "lg-glt2526xwpz";
const T = `${TEX}/lg_glt2526`;

// ── size (metres) ──
const W = 0.555, H = 1.573, D = 0.637;
const doorT = 0.045, Dc = D - doorT;
const zBack = -D / 2, zFront = zBack + Dc;
const wall = 0.036, feet = 0.022;
const inW = W - 2 * wall, zIn1 = zBack + 0.06, inD = zFront - zIn1;
// vertical layout, measured on LG's front photo (1.47 mm a pixel) and its open-door photo (50 mm grid on the cabinet's front)
const fy0 = 1.128, fy1 = 1.533;              // freezer cavity floor and ceiling
const gy0 = 0.070, gy1 = 1.050;              // fridge cavity floor and ceiling
const fzBot = 1.089;                         // freezer door bottom edge
const frTop = 1.082, frLow = 0.032;          // fridge door top and bottom
const bandTop = 1.075, bandBot = 1.043;      // the black pocket grip under a thin silver lip
// With the doors shut their baskets reach into the cabinet (the bottle basket 105 mm), so the shelves, the drawer and its
// cover end 1 cm short of them, and the freezer shelf and the ice maker short of the freezer's baskets.
const shelfFront = zFront - 0.115, drawerFront = zFront - 0.112, fzShelfFront = zFront - 0.09;
const s1 = 0.693, s2 = 0.505;                // the two glass shelves
const coverY = 0.375, drawerY = 0.085;       // the drawer's glass cover (food stands on it) and the drawer's floor
const topY = 0.875;                          // the Turbo Fresh Zone's floor
const fzShelfY = 1.334;                      // freezer shelf

// ── materials ──
const steelDoorF = mat("DoorFreezer", 0xd6d6d6, { metal: 0.38, rough: 0.5 });
const steelDoorR = mat("DoorFridge", 0xd6d6d6, { metal: 0.38, rough: 0.5 });
const sideSteel = mat("SideSteel", 0xd2d2d2, { metal: 0.38, rough: 0.5 });
const sideSteelL = mat("SideSteelL", 0xd2d2d2, { metal: 0.38, rough: 0.5 });
// the louvres are pressed into the side panel, so their faces take the side's own grey as rendered at 0.15-0.34 m
// (0x969697 drew white bars, 0x767677 dark ones: 97 against the side's 117-122 in the -40 degree render); only the
// 0.6 mm edges catch the light, as on LG's photo DZ-03
const sideEmboss = mat("SideEmboss", 0x8c8c8d, { metal: 0.38, rough: 0.5 });
const steelEdge = mat("SteelEdge", 0x9a9b9d, { metal: 0.2, rough: 0.6 });
const topSteel = mat("TopSteel", 0x7e8083, { metal: 0.15, rough: 0.7 });
const black = mat("GripBlack", 0x151516, { rough: 0.5 });
const silverLip = mat("SilverLip", 0xb4b5b7, { metal: 0.8, rough: 0.3 });
const labelM = mat("LabelBEE", 0xffffff, { rough: 0.5, opacity: 0.999 });
const logoM = mat("LgMark", 0xffffff, { rough: 0.5, opacity: 0.999 });
const rearM = mat("RearPlate", 0xffffff, { metal: 0.3, rough: 0.55 });
const liner = mat("Liner", 0xf1f3f5, { rough: 0.6 });
const linerSide = mat("LinerSide", 0xe4e8ec, { rough: 0.65 });
const linerDk = mat("LinerGrey", 0xcfd3d8, { rough: 0.6 });
const gasket = mat("Gasket", 0x6c7176, { rough: 0.85 });
const plinth = mat("Plinth", 0x1a1b1d, { rough: 0.8 });
const clear = mat("ClearPlastic", 0xc3d0da, { rough: 0.12, opacity: 0.5, side: THREE.DoubleSide });
const clearLight = mat("ClearPlasticLight", 0xdfe7ee, { rough: 0.12, opacity: 0.26, side: THREE.DoubleSide });
const clearRib = mat("ClearRib", 0xffffff, { rough: 0.3, opacity: 0.92 });
const glass = mat("TemperedGlass", 0xa9cdd6, { rough: 0.05, opacity: 0.55, side: THREE.DoubleSide });
const glassRim = mat("ShelfRim", 0xe3e7ea, { rough: 0.45 });
const edgeGreen = mat("GlassEdge", 0x7fa7b0, { rough: 0.3 });
const white = mat("WhitePlastic", 0xf6f7f8, { rough: 0.45 });
const ice = mat("IceCube", 0xe3f4ff, { rough: 0.08, opacity: 0.72 });
const lightM = mat("Led", 0xffffff, { emissive: 0xf4f8ff, emissiveIntensity: 1.5 });
const footM = mat("Foot", 0x131416, { rough: 0.7 });
const cordM = mat("Cord", 0xc4c6c9, { rough: 0.6 });
const plugM = mat("Plug", 0xd9dadc, { rough: 0.5 });
const pinM = mat("Pin", 0xb7bbc0, { metal: 0.9, rough: 0.3 });
const hingeM = mat("Hinge", 0xc9ccd0, { metal: 0.9, rough: 0.3 });
const knobFace = mat("KnobFace", 0xffffff, { rough: 0.5 });
const knobSide = mat("KnobSide", 0xe6e8eb, { rough: 0.5 });
const printConv = mat("print_convertible", 0xffffff, { rough: 0.6, opacity: 0.999 });
const drawerFace = mat("FreshZoneFront", 0xffffff, { rough: 0.45 });
const stock = LGStock({ T3: `${TEX}/lg_glt3426`, TF: `${TEX}/food`, BR: `${TEX}/brands`, BRT: `${TEX}/brands/small` });

// ── small builders ──
const cyl = (name, rt, rb, h, m, x, y, z, seg = 12) => mesh(name, new THREE.CylinderGeometry(rt, rb, h, seg), m, x, y, z);
const plane = (name, w, h, m, x, y, z) => mesh(name, flipV(new THREE.PlaneGeometry(w, h)), m, x, y, z);
// many small boxes of one material as one mesh: [w, h, d, x, y, z] each
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

const root = group("LGGLT2526");
const cab = group("Cabinet");
root.add(cab);

// ── cabinet shell ──
const sideH = H - feet, sideMid = feet + sideH / 2, zMid = zBack + Dc / 2;
cab.add(mesh("SideLeft", flipV(new THREE.BoxGeometry(wall, sideH, Dc)), [linerSide, sideSteelL, topSteel, plinth, sideSteelL, sideSteelL], -W / 2 + wall / 2, sideMid, zMid));
cab.add(mesh("SideRight", flipV(new THREE.BoxGeometry(wall, sideH, Dc)), [sideSteel, linerSide, topSteel, plinth, sideSteel, sideSteel], W / 2 - wall / 2, sideMid, zMid));
// four pressed louvres low on the left side, towards the back (LG's 3/4 photo DZ-03: 148-342 mm above the floor)
{
  const zb = zBack + 0.11, zf = zBack + 0.33;
  const geos = [0.342, 0.292, 0.214, 0.164].map((yt) => {
    const s = new THREE.Shape([new THREE.Vector2(zb, yt), new THREE.Vector2(zb, yt - 0.025), new THREE.Vector2(zf, yt - 0.043), new THREE.Vector2(zf, yt - 0.018)]);
    return new THREE.ExtrudeGeometry(s, { depth: 0.0006, bevelEnabled: false }).rotateY(-Math.PI / 2).translate(-W / 2, 0, 0);
  });
  cab.add(mesh("SideLouvre", mergeGeometries(geos), sideEmboss));
}
cab.add(faced("Top", inW, 0.045, Dc, [topSteel, topSteel, topSteel, liner, topSteel, topSteel], 0, H - 0.0225, zMid));
cab.add(faced("Divider", inW, fy0 - gy1, inD, [liner, liner, liner, liner, liner, liner], 0, (fy0 + gy1) / 2, zIn1 + inD / 2));
cab.add(faced("Base", inW, gy0 - feet, Dc, [liner, liner, liner, liner, liner, liner], 0, feet + (gy0 - feet) / 2, zMid));
cab.add(box("Kickplate", inW, 0.026, 0.012, plinth, 0, feet + 0.013, zFront - 0.006));
cab.add(faced("BackFreezer", inW, fy1 - fy0, 0.012, [linerDk, linerDk, linerDk, linerDk, linerDk, linerDk], 0, (fy0 + fy1) / 2, zIn1 + 0.006));
cab.add(faced("BackFridge", inW, gy1 - gy0, 0.012, [liner, liner, liner, liner, liner, liner], 0, (gy0 + gy1) / 2, zIn1 + 0.006));
// the real back: LG's rear photo (cropped to the cabinet's full-width rows, the cord painted out) on a thin plate, from
// 15 mm above the floor to the top, as the crop runs on the photo
const rearBot = 0.015, rearTop = H;
cab.add(mesh("RearPlate", flipV(new THREE.BoxGeometry(W, rearTop - rearBot, 0.004)), [steelEdge, steelEdge, steelEdge, steelEdge, steelEdge, rearM], 0, (rearTop + rearBot) / 2, zBack + 0.002));
// feet: on LG's front photo the left one stands 15-47 mm in from the edge and set back, the right one at the very edge
// under the bottom hinge, a black knob on a threaded stem; two rollers at the back
cab.add(cyl("FootFront", 0.016, 0.017, 0.016, footM, -(W / 2 - 0.031), 0.008, zFront - 0.05, 16));
cab.add(cyl("FootThread", 0.006, 0.006, feet - 0.016, pinM, -(W / 2 - 0.031), 0.016 + (feet - 0.016) / 2, zFront - 0.05, 10));
cab.add(cyl("FootFront", 0.016, 0.017, 0.016, footM, W / 2 - 0.017, 0.008, zFront - 0.004, 16));
cab.add(cyl("FootThread", 0.006, 0.006, 0.012, pinM, W / 2 - 0.017, 0.022, zFront - 0.004, 10));
for (const fx of [-1, 1]) cab.add(cyl("Roller", 0.017, 0.017, 0.018, footM, fx * (W / 2 - 0.045), 0.017, zBack + 0.06).rotateZ(Math.PI / 2));
// hinges on the right: the bottom one a dark bracket under the fridge door (486-528 mm from the left on the front photo),
// the middle one a steel plate in the gap between the doors with two bolt heads, and a dark cover on top
cab.add(box("HingeBottom", 0.042, 0.004, 0.045, plinth, W / 2 - 0.048, 0.026, zFront + 0.0125));
cab.add(box("HingeMid", 0.034, 0.0035, doorT + 0.012, hingeM, W / 2 - 0.02, (fzBot + frTop) / 2, zFront + (doorT + 0.012) / 2 - 0.012));
for (const dz of [0.008, 0.028]) cab.add(cyl("HingeBolt", 0.0045, 0.0045, 0.001, hingeM, W / 2 - 0.02, (fzBot + frTop) / 2 + 0.0022, zFront + dz, 10));
cab.add(box("HingeCoverTop", 0.05, 0.012, 0.045, plinth, W / 2 - 0.033, H - 0.0052, zFront - 0.02));
// power cord: its route on the back traced on LG's rear photo (rear_paths.json); past the cabinet's edge the photo does
// not show it, so it is drawn hanging to the floor with its three-pin plug lying there (estimated)
{
  const RP = JSON.parse(fs.readFileSync(`${T}/rear_paths.json`, "utf8"));
  const zc = zBack - 0.0045, V = (x, y, z) => new THREE.Vector3(x, y, z);
  // (kept 8 mm inside the cabinet's edge, so the cord doesn't widen the model)
  const pts = RP.cord.map(([u, v]) => V(Math.min(W / 2 - u * W, W / 2 - 0.008), rearTop - v * (rearTop - rearBot), zc));
  const end = pts[pts.length - 1], px = W / 2 - 0.04, py = 0.023, pz = zBack - 0.1;
  pts.push(V(W / 2 - 0.011, end.y - 0.04, zBack - 0.012), V(W / 2 - 0.014, 0.16, zBack - 0.022), V(W / 2 - 0.022, 0.045, zBack - 0.042), V(px, py, pz + 0.006));
  cab.add(mesh("PowerCord", new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts, false, "centripetal"), 110, 0.0035, 6, false), cordM));
  const sh = new THREE.Shape(), w = 0.045, h = 0.042, r = 0.012;
  sh.moveTo(-w / 2 + r, -h / 2); sh.lineTo(w / 2 - r, -h / 2); sh.quadraticCurveTo(w / 2, -h / 2, w / 2, -h / 2 + r);
  sh.lineTo(w / 2, h / 2 - r); sh.quadraticCurveTo(w / 2, h / 2, w / 2 - r, h / 2); sh.lineTo(-w / 2 + r, h / 2);
  sh.quadraticCurveTo(-w / 2, h / 2, -w / 2, h / 2 - r); sh.lineTo(-w / 2, -h / 2 + r); sh.quadraticCurveTo(-w / 2, -h / 2, -w / 2 + r, -h / 2);
  const plug = mesh("Plug", new THREE.ExtrudeGeometry(sh, { depth: 0.016, bevelEnabled: true, bevelSize: 0.002, bevelThickness: 0.002, bevelSegments: 2, curveSegments: 8 }), plugM, px, py, pz);
  plug.rotation.y = Math.PI;
  cab.add(plug);
  for (const [dx, dy] of [[0, 0.0105], [-0.0095, -0.0065], [0.0095, -0.0065]]) {
    const pin = cyl("PlugPin", 0.0026, 0.0026, 0.016, pinM, px + dx, py + dy, pz - 0.016 - 0.008, 10);
    pin.rotation.x = Math.PI / 2; cab.add(pin);
  }
}

// ── freezer inside ──
const xL = -inW / 2, xR = inW / 2;
// on the back wall (LG's open-door photo DZ-06, scaled by the wall's width): two cold-air grilles under the ceiling, two
// slatted return vents at the foot, a black slot under the shelf on the left, and the dial with its printed scale and the
// word Convertible
cab.add(boxes("FreezerGrille", [[0.14, 0.022, 0.008, -0.107, fy1 - 0.03, zIn1 + 0.016], [0.064, 0.022, 0.008, -0.005, fy1 - 0.03, zIn1 + 0.016], [0.14, 0.022, 0.008, 0.105, fy1 - 0.03, zIn1 + 0.016]], white));
cab.add(boxes("FreezerGrilleSlot", [-0.107, 0.105].flatMap((x) => [0, 1].map((i) => [0.12, 0.003, 0.002, x, fy1 - 0.035 + i * 0.01, zIn1 + 0.0205])), plinth));
cab.add(boxes("FreezerVentPanel", [[0.14, 0.05, 0.004, -0.15, fy0 + 0.035, zIn1 + 0.014], [0.14, 0.05, 0.004, 0.145, fy0 + 0.035, zIn1 + 0.014]], white));
cab.add(boxes("FreezerVent", [-0.15, 0.145].flatMap((x) => [0, 1, 2, 3, 4, 5].map((i) => [0.12, 0.003, 0.002, x, fy0 + 0.015 + i * 0.008, zIn1 + 0.017])), plinth));
cab.add(box("FreezerSlot", 0.08, 0.012, 0.004, plinth, -0.148, fzShelfY - 0.016, zIn1 + 0.014));
cab.add(plane("PrintConvertible", 0.283, 0.07, printConv, -0.086, 1.422, zIn1 + 0.0125));
{
  const k = mesh("KnobDial", new THREE.CylinderGeometry(0.021, 0.021, 0.016, 28), [knobSide, knobFace, knobSide], -0.166, 1.415, zIn1 + 0.012 + 0.008);
  k.rotation.x = Math.PI / 2;
  cab.add(k);
}
// the freezer shelf across the cavity, with its rims and rails
{
  const g = group("FreezerShelf", 0, fzShelfY, 0), bd = fzShelfFront - 0.005 - zIn1 - 0.02;
  g.add(box("FzShelfGlass", inW - 0.012, 0.005, bd, glass, 0, 0, zIn1 + bd / 2 + 0.02));
  g.add(box("FzShelfRimF", inW - 0.008, 0.012, 0.01, glassRim, 0, 0.004, fzShelfFront - 0.005));
  g.add(box("FzShelfRimB", inW - 0.008, 0.01, 0.008, glassRim, 0, 0.003, zIn1 + 0.03));
  g.add(box("FzShelfRailL", 0.008, 0.012, bd, glassRim, xL + 0.01, 0.003, zIn1 + bd / 2 + 0.02));
  g.add(box("FzShelfRailR", 0.008, 0.012, bd, glassRim, xR - 0.01, 0.003, zIn1 + bd / 2 + 0.02));
  cab.add(g);
}
// the ice maker hangs under the shelf on the right (the photo: 184 mm wide at 0.02-0.20 m, bucket floor at 1.185 m); its
// front stays 95 mm behind the door's face so the lower door basket clears it
const icX = 0.11, icW = 0.17, icZ = zFront - 0.095, icDY = 0.005;
cab.add(box("IceHousingTop", icW + 0.01, 0.006, 0.2, white, icX, 1.317 + icDY, icZ - 0.1));
cab.add(box("IceHousingSideL", 0.005, 0.14, 0.2, white, icX - icW / 2 - 0.0025, 1.247 + icDY, icZ - 0.1));
cab.add(box("IceHousingSideR", 0.005, 0.14, 0.2, white, icX + icW / 2 + 0.0025, 1.247 + icDY, icZ - 0.1));

// ── fridge inside ──
const trays = group("FridgeTrays");
cab.add(trays);
cab.add(box("FridgeLed", 0.11, 0.006, 0.016, lightM, 0, gy1 - 0.006, zFront - 0.16));
// the Turbo Fresh Zone (LG's manual): a clear box under the fridge's ceiling that keeps the cold in when the door opens
// often; no printed words on it in LG's photos
const tt = { bw: inW - 0.012, bd: 0.40, bh: 0.135 };
tt.zc = zIn1 + tt.bd / 2 + 0.012;
{
  const { bw, bd, bh, zc } = tt, g = group("TurboFreshZone", 0, topY, 0);
  g.add(box("TtFloor", bw, 0.004, bd, clear, 0, 0, zc));
  g.add(box("TtBack", bw, bh, 0.004, clearLight, 0, bh / 2, zIn1 + 0.014));
  g.add(box("TtSideL", 0.004, bh, bd, clear, -bw / 2, bh / 2, zc));
  g.add(box("TtSideR", 0.004, bh, bd, clear, bw / 2, bh / 2, zc));
  g.add(box("TtFront", bw, bh, 0.004, clearLight, 0, bh / 2, zc + bd / 2));
  g.add(box("TtRim", bw, 0.008, 0.01, clearRib, 0, bh - 0.003, zc + bd / 2 - 0.004));
  g.add(box("TtHandle", 0.12, 0.05, 0.01, white, 0, bh - 0.035, zc + bd / 2 + 0.004));
  trays.add(g);
}
stock.fresh0(trays, { y: topY + 0.002, z: tt.zc + 0.03, bx: -0.17 });
// two tempered-glass shelves with white rims
function shelf(name, y) {
  const g = group(name, 0, y, 0), bd = shelfFront - 0.0085 - zIn1 - 0.014;
  g.add(box(name + "Glass", inW - 0.01, 0.006, bd, glass, 0, 0, zIn1 + bd / 2 + 0.014));
  g.add(box(name + "Rim", inW - 0.01, 0.014, 0.012, glassRim, 0, 0.004, shelfFront - 0.0085));
  g.add(box(name + "Edge", inW - 0.01, 0.004, 0.003, edgeGreen, 0, -0.002, shelfFront - 0.0015));
  g.add(box(name + "RimBack", inW - 0.01, 0.01, 0.01, glassRim, 0, 0.002, zIn1 + 0.02));
  g.add(box(name + "RailL", 0.01, 0.014, bd, glassRim, xL + 0.012, 0, zIn1 + bd / 2 + 0.014));
  g.add(box(name + "RailR", 0.01, 0.014, bd, glassRim, xR - 0.012, 0, zIn1 + bd / 2 + 0.014));
  trays.add(g);
}
shelf("Shelf1", s1);
shelf("Shelf2", s2);
// Fresh Zone: a glass cover over the drawer (food stands on it, as in LG's stocked photo), and the drawer, clear with a
// white front printed Fresh Zone
const fzD = drawerFront - zIn1 - 0.016, fzW = inW - 0.02, fzC = zIn1 + fzD / 2 + 0.016, fzH = 0.26, faceH = 0.135;
{
  const g = group("FreshZoneCover", 0, 0, 0);
  g.add(box("FzGlassCover", inW - 0.01, 0.006, fzD, glass, 0, coverY, fzC));
  g.add(box("FzCoverRim", inW - 0.01, 0.012, 0.012, glassRim, 0, coverY + 0.003, drawerFront - 0.006));
  trays.add(g);
}
{
  const g = group("FreshZone", 0, 0, 0), bd = fzD, bw = fzW, zc = fzC, yc = drawerY + fzH / 2;
  g.add(box("FzBoxFloor", bw, 0.004, bd, clear, 0, drawerY, zc));
  g.add(box("FzBoxBack", bw, fzH, 0.004, clear, 0, yc, zIn1 + 0.018));
  g.add(box("FzBoxL", 0.004, fzH, bd, clear, -bw / 2, yc, zc));
  g.add(box("FzBoxR", 0.004, fzH, bd, clear, bw / 2, yc, zc));
  g.add(mesh("FzBoxFront", flipV(new THREE.BoxGeometry(bw, faceH, 0.004)), [white, white, white, white, drawerFace, white], 0, drawerY + faceH / 2, zc + bd / 2));
  g.add(box("FzBoxFrontUp", bw, fzH - faceH, 0.004, clearLight, 0, drawerY + faceH + (fzH - faceH) / 2, zc + bd / 2));
  g.add(box("FzBoxRim", bw, 0.008, 0.008, clearRib, 0, drawerY + fzH - 0.004, zc + bd / 2));
  trays.add(g);
}

// ── stock: vegetarian South Indian food, eggs, juices, water and soft drinks (stock_lg.mjs, food.mjs) ──
// stock_lg.mjs fills three shelves; this fridge has two, and LG's stocked photo has food standing on the drawer's glass
// cover, so the cover is the third
stock.shelves(trays, {
  zIn1, inW, inD, s1, s2, s3: coverY, fz: drawerY + 0.002, fit: true, vk: 0.65,
  shelfB: { hw: inW / 2 - 0.03, z0: zIn1 + 0.034, z1: shelfFront - 0.015 },
  drawerB: { hw: fzW / 2 - 0.014, z0: zIn1 + 0.04, z1: drawerFront - 0.006, y0: drawerY + 0.002 },
  drawerCeil: coverY - 0.003 - 0.01 - (drawerY + 0.002), // the heap stays 1 cm under the drawer's glass cover
});
// rows that need more width or depth than these narrower shelves have: what reaches past a side or the front is left out
const shw = inW / 2 - 0.03;
for (const n of ["Shelf1Stock", "Shelf2Stock", "Shelf3Stock"]) leaveOut(trays.getObjectByName(n), [B3(-1, 0, shelfFront - 0.016, 1, 2, 1), B3(-1, 0, -1, -shw - 0.003, 2, 1), B3(shw + 0.003, 0, -1, 1, 2, 1)], `past ${n}'s side or front`);
// the cauliflower's leaves are tilted meshes; their own turn is baked into their shape so a box round them is the real one
trays.getObjectByName("Cauliflower")?.traverse((m) => {
  if (!m.isMesh) return;
  m.updateMatrix(); m.geometry = m.geometry.clone().applyMatrix4(m.matrix);
  m.position.set(0, 0, 0); m.rotation.set(0, 0, 0); m.scale.set(1, 1, 1);
});
stock.freezer(cab, { fit: true, zIn1, floor: fy0, top: fzShelfY + 0.0025, box: { hw: inW / 2 - 0.015, z0: zIn1 + 0.038, z1: icZ - 0.21 } });
// the packs on the shelf: back and front rows need 425 mm and the shelf has 410, so the rows go 4 cm further back (behind
// the shelf's back rim) and what still reaches the front rim is left out
{
  const t = cab.getObjectByName("OnFreezerShelf");
  t.position.z -= 0.04;
  leaveOut(t, [B3(-1, fzShelfY - 0.01, fzShelfFront - 0.012, 1, fy1, 1)], "past the freezer shelf's front");
}

// ── ice maker: the tray unit and the bucket slide out together (a real part) ──
const ic = group("IceMaker", icX, 0, icZ);
{
  ic.add(mesh("IceFace", new THREE.BoxGeometry(icW, 0.06, 0.03), white, 0, 1.288, -0.015));
  ic.add(box("IceFaceSlot", 0.08, 0.008, 0.004, plinth, 0, 1.304, 0.001));
  ic.add(box("IceFaceGrip", 0.08, 0.012, 0.01, white, 0, 1.272, 0.004));
  ic.add(box("IceTrayBody", icW - 0.012, 0.045, 0.17, white, 0, 1.29, -0.115));
  ic.add(box("IceBucketFloor", icW - 0.01, 0.004, 0.17, clear, 0, 1.18, -0.115));
  ic.add(box("IceBucketFront", icW - 0.01, 0.07, 0.004, clear, 0, 1.215, -0.032));
  ic.add(box("IceBucketL", 0.004, 0.07, 0.17, clear, -(icW - 0.01) / 2, 1.215, -0.115));
  ic.add(box("IceBucketR", 0.004, 0.07, 0.17, clear, (icW - 0.01) / 2, 1.215, -0.115));
  ic.add(box("IceBucketHandle", 0.07, 0.008, 0.01, clearRib, 0, 1.248, -0.028));
  const cubes = [];
  for (let i = 0; i < 16; i++) {
    const c = new THREE.BoxGeometry(0.03, 0.025, 0.03);
    c.applyMatrix4(new THREE.Matrix4().compose(new THREE.Vector3(-0.055 + (i % 4) * 0.037 + (Math.floor(i / 4) % 2) * 0.012, 1.196 + Math.floor(i / 8) * 0.024, -0.06 - Math.floor((i % 8) / 4) * 0.055 - (i % 3) * 0.012),
      new THREE.Quaternion().setFromEuler(new THREE.Euler(0.2 * (i % 3), 0.5 * i, 0.15 * (i % 4))), new THREE.Vector3(1, 1, 1)));
    cubes.push(c);
  }
  ic.add(mesh("IceCube", mergeGeometries(cubes), ice));
}
cab.add(ic);
ic.position.y = icDY;

// ── doors: hinged on the right, no handles, black pocket grip at the top of the fridge door ──
const pw = W - 0.004;
const inside = (w) => (dep) => [-pw / 2 - w / 2 + 0.004, -pw / 2 + w / 2 - 0.004, -(0.01 + dep / 2)];
function doorShell(name, y0, parts) { const g = group(name, W / 2, y0, zFront); parts(g); return g; }
function gaskets(g, p, h) {
  g.add(box(p + "GasketT", pw - 0.02, 0.014, 0.014, gasket, -pw / 2, h - 0.012, -0.007));
  g.add(box(p + "GasketB", pw - 0.02, 0.014, 0.014, gasket, -pw / 2, 0.012, -0.007));
  g.add(box(p + "GasketL", 0.014, h - 0.02, 0.014, gasket, -pw + 0.012, h / 2, -0.007));
  g.add(box(p + "GasketR", 0.014, h - 0.02, 0.014, gasket, -0.012, h / 2, -0.007));
  g.add(box(p + "Liner", pw - 0.05, h - 0.05, 0.012, liner, -pw / 2, h / 2, -0.004));
}
// line items up across [x0, x1] (door space) with even gaps, their middles at depth zm
function rowAt(g, items, x0, x1, zm) {
  g.updateMatrixWorld(true);
  const p = g.position, bs = items.map((o) => new THREE.Box3().setFromObject(o));
  const gap = (x1 - x0 - bs.reduce((s, b) => s + b.max.x - b.min.x, 0)) / (items.length + 1);
  if (gap < 0) console.warn(`rowAt: ${items.map((o) => o.name)} do not fit`);
  let x = x0 + gap;
  items.forEach((o, i) => { const b = bs[i]; o.position.x += x - (b.min.x - p.x); o.position.z += zm - ((b.min.z + b.max.z) / 2 - p.z); x += b.max.x - b.min.x + gap; });
}
const freezerDoor = doorShell("FreezerDoor", fzBot, (g) => {
  const h = H - fzBot;
  g.add(mesh("FzPanel", flipV(new THREE.BoxGeometry(pw, h, doorT)), [steelEdge, steelEdge, topSteel, steelEdge, steelDoorF, liner], -pw / 2, h / 2, doorT / 2));
  // print, measured on LG's front photo: the LG mark 36-81 mm from the left and 33-50 mm down; the energy label 19-84 mm
  // from the right and 28-150 mm down
  g.add(plane("LgMarkDecal", 0.047, 0.0216, logoM, -pw + 0.0585, h - 0.0415, doorT + 0.0006));
  g.add(plane("BeeLabelDecal", 0.066, 0.122, labelM, -0.0515, h - 0.089, doorT + 0.0006));
  gaskets(g, "Fz", h);
  // basket floors on LG's open-door photo: 1.35 and 1.16 m
  const b1 = 1.35 - fzBot, b2 = 1.16 - fzBot;
  const k1 = basket("FzBasket1", pw - 0.1, 0.07, 0.065, b1, true); k1.position.x = -pw / 2; g.add(k1);
  const k2 = basket("FzBasket2", pw - 0.1, 0.07, 0.065, b2, true); k2.position.x = -pw / 2; g.add(k2);
  stock.doorFreezer(g, { fit: true, b1, b2, dep: 0.07, inside: inside(pw - 0.1) });
});
const fridgeDoor = doorShell("FridgeDoor", frLow, (g) => {
  const h = frTop - frLow, y = (v) => v - frLow;
  g.add(mesh("FrPanelLow", flipV(new THREE.BoxGeometry(pw, y(bandBot), doorT)), [steelEdge, steelEdge, steelEdge, steelEdge, steelDoorR, liner], -pw / 2, y(bandBot) / 2, doorT / 2));
  g.add(box("GripBand", pw, bandTop - bandBot, doorT - 0.016, black, -pw / 2, (y(bandBot) + y(bandTop)) / 2, (doorT - 0.016) / 2));
  for (const sx of [-1, 1]) g.add(box("GripEnd", 0.012, bandTop - bandBot - 0.0016, doorT - 0.001, black, -pw / 2 + sx * (pw / 2 - 0.006), (y(bandBot) + y(bandTop)) / 2, doorT / 2));
  g.add(mesh("FrLip", new THREE.BoxGeometry(pw, frTop - bandTop, doorT), [steelEdge, steelEdge, topSteel, steelEdge, silverLip, liner], -pw / 2, (y(bandTop) + h) / 2, doorT / 2));
  gaskets(g, "Fr", h);
  // three baskets (LG's spec), floors on LG's open-door photo at 0.875, 0.355 and 0.075 m: eggs and a few jars at the top,
  // bottles in the tall one, cans at the foot, as in LG's stocked photo
  const eggY = y(0.875), botY = y(0.355), canY = y(0.075);
  const add = (n, dep, hh, yy) => { const k = basket(n, pw - 0.12, dep, hh, yy, true); k.position.x = -pw / 2; g.add(k); };
  add("EggBasket", 0.085, 0.06, eggY); add("BottleBasket", 0.095, 0.13, botY); add("CanBasket", 0.08, 0.09, canY);
  const eggX = [0, 1, 2, 3, 4].map((i) => -0.095 - i * 0.05);
  g.add(box("EggCupsRib", 0.26, 0.006, 0.05, clearRib, -0.195, eggY + 0.006, -0.047));
  // stock_lg.mjs stocks four baskets (eggs, jars, bottles, cans); here the jar row is built on a spare shelf height, two jars
  // move into the egg basket beside the eggs, and the rest of that row is left out; the bottle row loses one carton to fit
  const deps = { egg: 0.085, jar: 0.085, bottle: 0.095, can: 0.08 };
  stock.doorFridge(g, { fit: true, eggY, jarY: y(0.62), botY, canY, deps, inside: inside(pw - 0.12), eggX });
  const [x0, x1] = inside(pw - 0.12)(0.075);
  const jars = ["MothersPickle", "AavinGhee"].map((n) => g.children.find((c) => c.name === n));
  for (const n of ["MothersPickle2", "SakthiSambar", "NandiniGhee", "RealMixedFruit"]) g.children.find((c) => c.name === n)?.removeFromParent();
  jars.forEach((o) => (o.position.y += eggY - y(0.62)));
  rowAt(g, jars, x0, -0.325, -(0.01 + deps.egg / 2));
  rowAt(g, ["Coke", "Fanta", "Bisleri", "RealMango", "AmulTaaza"].map((n) => g.children.find((c) => c.name === n)), x0, x1, -(0.01 + deps.bottle / 2));
});
root.add(freezerDoor, fridgeDoor);

const parts = productParts(PRODUCTS, ID);
const clips = stateClips(root, parts);
saveZones(PRODUCTS, ID, root, parts);
const textures = {
  DoorFreezer: `${T}/door_freezer.jpg`, DoorFridge: `${T}/door_fridge.jpg`, SideSteel: `${T}/side.jpg`, SideSteelL: `${T}/side_l.jpg`, RearPlate: `${T}/rear.jpg`,
  LabelBEE: `${T}/label.png`, LgMark: `${T}/lgmark.png`, print_convertible: `${T}/print_convertible.png`, KnobFace: `${T}/knob.jpg`, FreshZoneFront: `${T}/fresh_zone.jpg`,
};
Object.assign(textures, stock.textures());
// textures of food that was left out
{ const used = new Set(); root.traverse((o) => o.isMesh && [].concat(o.material).forEach((m) => used.add(m.name))); for (const k of Object.keys(textures)) if (!used.has(k)) delete textures[k]; }
// Grain (BENCHMARK.md section 10), as the LG 343 L: Shiny Steel is a printed steel look with fine vertical hairlines under a
// clear glossy film; the sides are smooth factory paint with a soft peel.
await exportGLB(root, clips, OUT, textures, { dir: `${TEX}/grain`, materials: {
  DoorFreezer: { type: "hairline", dir: "v", clearcoat: [0.6, 0.12] },
  DoorFridge: { type: "hairline", dir: "v", clearcoat: [0.6, 0.12] },
  SideSteel: { type: "peel_soft" }, SideSteelL: { type: "peel_soft" }, TopSteel: { type: "peel_soft" },
} });
