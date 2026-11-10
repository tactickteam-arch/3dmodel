// LG GLT2216WY.., 225 L double-door refrigerator (Smart Mode), in LG's five colours: Radiant Onyx (GLT2216WYRO), Radiant Inox
// (WYRI), Onyx Black (WYOB), Shiny Steel (WYPZ), Dazzle Steel (WYDS). One body, so one GLB, the colours as
// KHR_materials_variants; Radiant Onyx is the default.
// Built to LG's published size, 555 W x 1445 H x 637 D mm (LG's page for each code; manual MFL05806603, GLT22**), from LG's
// gallery photos of these codes (front, energy label, 3/4 views, open, stocked, rear). Freezer on top (59 L) with a plain dial
// on its back wall, one shelf and a manual ice maker (tray over a bucket) under it on the LEFT; fridge below (166 L) with an air
// duct under its ceiling, two tempered-glass shelves, a glass cover and the Fresh Zone drawer with a white front; 2 baskets in
// the freezer door and 3 in the fridge door; both doors hinged on the right; LG's "Golden Pocket Handle", a gold lip across
// the top of the fridge door. As on the LG 251 L, the trays (shelves, the drawer's glass cover and the drawer) are one part
// (FridgeTrays) that slides out with its food when the fridge door is open.
// The freezer is the LG 251 L's (same 487 mm door, 59 L, the same photos' layout one-for-one), so its heights are the 251 L's
// moved down by the 131 mm the doors' split moved; the fridge is measured anew. Every number and how it was got is in the
// private research notes. Stocked for a south Indian kitchen.
// usage: node make_lg_glt2216.mjs <entry .json, never products.json> <tex dir> <out.glb>
import fs from "node:fs";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { NodeIO } from "@gltf-transform/core";
import { ALL_EXTENSIONS, KHRMaterialsVariants, KHRMaterialsClearcoat } from "@gltf-transform/extensions";
import { THREE, mat, mesh, box, faced, group, flipV, stateClips, exportGLB, productParts, saveZones } from "./lib.mjs";
import { LGStock } from "./stock_lg.mjs";

const [PRODUCTS, TEX, OUT] = process.argv.slice(2);
const ID = "lg-glt2216wyro";
const T = `${TEX}/lg_glt2216`;
const C = JSON.parse(fs.readFileSync(`${T}/colours.json`, "utf8"));

// ── size (metres) ──
const W = 0.555, H = 1.445, D = 0.637;
const doorT = 0.045, Dc = D - doorT;
const zBack = -D / 2, zFront = zBack + Dc;
const wall = 0.036, feet = 0.022;
const inW = W - 2 * wall, zIn1 = zBack + 0.06, inD = zFront - zIn1;
// vertical layout on LG's front photos (1.439 mm a pixel up; the five colours share one set-up) and open-door photo large06
// (the same scale, the cabinet 6 px lower)
const fzBot = 0.958;                         // freezer door, 958-1445 mm
const frTop = 0.942, frLow = 0.037;          // fridge door: its top is the gold lip's top; its foot
const goldBot = 0.909;                       // the gold lip, 909-942 mm
const shift = 1.089 - fzBot;                 // the LG 251 L's freezer, moved down (see the header)
const fy0 = 1.128 - shift, fy1 = 1.533 - shift;   // freezer cavity floor and ceiling
const fzShelfY = 1.334 - shift;              // freezer shelf (measured here at 1.20)
const gy0 = 0.070, gy1 = 0.937;              // fridge cavity floor and ceiling (large06: the opening's top 937 mm)
const shelfFront = zFront - 0.115, drawerFront = zFront - 0.112, fzShelfFront = zFront - 0.09;
const s1 = 0.752, s2 = 0.568;                // the two glass shelves (large06, front edges)
const coverY = 0.380, drawerY = 0.092;       // the drawer's glass cover (food stands on it) and the drawer's floor
const faceH = 0.14, fzH = 0.27;              // the drawer's white front (97-237 mm on large06) and its height

// ── the five colours ──
// door: its texture; side: painted side and cabinet front flanges; edge: the doors' edges; top: the cabinet's top; mark: the
// LG mark (light on the dark doors); line: the print's ink (null: no print); and the door's finish
const FIN = [
  { name: "Radiant Onyx", variant: "Radiant Onyx", slug: "radiant_onyx", code: "GLT2216WYRO", swatch: "#141318", edge: 0x1c1c1f, top: 0x1d1d20, mark: "light", line: C.radiant_onyx_line,
    door: { metal: 0.45, rough: 0.3, coat: null } },
  { name: "Radiant Inox", variant: "Radiant Inox", slug: "radiant_inox", code: "GLT2216WYRI", swatch: "#b9babb", edge: 0x9fa0a2, top: 0x7e8083, mark: "dark", line: C.radiant_inox_line,
    door: { metal: 0.3, rough: 0.45, coat: [0.35, 0.3] } },
  { name: "Onyx Black", variant: "Onyx Black", slug: "onyx_black", code: "GLT2216WYOB", swatch: "#09090b", edge: 0x1c1c1f, top: 0x1d1d20, mark: "light", line: null,
    door: { metal: 0.45, rough: 0.3, coat: null } },
  { name: "Shiny Steel", variant: "Shiny Steel", slug: "shiny_steel", code: "GLT2216WYPZ", swatch: "#a9aaab", edge: 0x9a9b9d, top: 0x7e8083, mark: "dark", line: null,
    door: { metal: 0.38, rough: 0.5, coat: [0.6, 0.22], grain: "hairline_soft_v" } },
  { name: "Dazzle Steel", variant: "Dazzle Steel", slug: "dazzle_steel", code: "GLT2216WYDS", swatch: "#8b8c8d", edge: 0x8e8f91, top: 0x7a7c7f, mark: "dark", line: null,
    door: { metal: 0.4, rough: 0.45, coat: [0.45, 0.22], grain: "hairline_soft_h" } },
];

// ── materials ──
const steelDoorF = mat("DoorFreezer", 0x202024, { metal: 0.3, rough: 0.28 });
const steelDoorR = mat("DoorFridge", 0x202024, { metal: 0.3, rough: 0.28 });
const printF = mat("PrintFreezer", 0xffffff, { rough: 0.35, opacity: 0.999 });
const printR = mat("PrintFridge", 0xffffff, { rough: 0.35, opacity: 0.999 });
const sideSteel = mat("SideSteel", 0xffffff, { metal: 0.38, rough: 0.5 });   // as the LG 251 L's sides
const doorEdge = mat("DoorEdge", 0x1c1c1f, { metal: 0.2, rough: 0.5 });
const topSteel = mat("TopSteel", 0x1d1d20, { metal: 0.15, rough: 0.6 });
const logoM = mat("LgMark", 0xffffff, { rough: 0.5, opacity: 0.999 });
// the Golden Pocket Handle: a pale champagne gold (LG's fronts: a median of 152/134/103 against the label's 255 white, the
// same on every colour), tuned by render to that ratio
const gold = mat("GoldLip", 0x86765b, { metal: 0.45, rough: 0.4 });
const black = mat("PocketBlack", 0x151516, { rough: 0.5 });
const labelM = mat("LabelBEE", 0xffffff, { rough: 0.5, opacity: 0.999 });
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
const drawerFace = mat("FreshZoneFront", 0xffffff, { rough: 0.45 });
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

const root = group("LGGLT2216");
const cab = group("Cabinet");
root.add(cab);

// ── cabinet shell ──
const sideH = H - feet, sideMid = feet + sideH / 2, zMid = zBack + Dc / 2;
cab.add(mesh("SideLeft", flipV(new THREE.BoxGeometry(wall, sideH, Dc)), [linerSide, sideSteel, topSteel, plinth, sideSteel, sideSteel], -W / 2 + wall / 2, sideMid, zMid));
cab.add(mesh("SideRight", flipV(new THREE.BoxGeometry(wall, sideH, Dc)), [sideSteel, linerSide, topSteel, plinth, sideSteel, sideSteel], W / 2 - wall / 2, sideMid, zMid));
cab.add(faced("Top", inW, 0.045, Dc, [topSteel, topSteel, topSteel, liner, topSteel, topSteel], 0, H - 0.0225, zMid));
// the mullion between the compartments: white, and seen through the gap over the gold lip on LG's fronts
cab.add(faced("Divider", inW, fy0 - gy1, inD, [liner, liner, liner, liner, liner, liner], 0, (fy0 + gy1) / 2, zIn1 + inD / 2));
cab.add(faced("Base", inW, gy0 - feet, Dc, [liner, liner, liner, liner, liner, liner], 0, feet + (gy0 - feet) / 2, zMid));
cab.add(box("Kickplate", inW, 0.012, 0.012, plinth, 0, feet + 0.006, zFront - 0.006));
cab.add(faced("BackFreezer", inW, fy1 - fy0, 0.012, [linerDk, linerDk, linerDk, linerDk, linerDk, linerDk], 0, (fy0 + fy1) / 2, zIn1 + 0.006));
cab.add(faced("BackFridge", inW, gy1 - gy0, 0.012, [liner, liner, liner, liner, liner, liner], 0, (gy0 + gy1) / 2, zIn1 + 0.006));
// the real back: LG's rear photo (large12; the galvanised back between the side panels' 9 mm flanges, the cord painted out)
const rearBot = 0.018, rearTop = H, rearW = W - 0.018;
cab.add(mesh("RearPlate", flipV(new THREE.BoxGeometry(rearW, rearTop - rearBot, 0.004)), [plinth, plinth, plinth, plinth, plinth, rearM], 0, (rearTop + rearBot) / 2, zBack + 0.002));
cab.add(box("RearFlangeL", 0.0085, rearTop - rearBot, 0.004, sideSteel, -W / 2 + 0.00425 + 0.0004, (rearTop + rearBot) / 2, zBack + 0.002));
cab.add(box("RearFlangeR", 0.0085, rearTop - rearBot, 0.004, sideSteel, W / 2 - 0.00425 - 0.0004, (rearTop + rearBot) / 2, zBack + 0.002));
// feet (LG's fronts: the left one 14-40 mm in from the edge and set back, the right one at the edge under the bottom hinge,
// a black knob on a threaded stem); two rollers at the back
cab.add(cyl("FootFront", 0.013, 0.014, 0.016, footM, -(W / 2 - 0.027), 0.008, zFront - 0.05, 16));
cab.add(cyl("FootThread", 0.006, 0.006, feet - 0.016, pinM, -(W / 2 - 0.027), 0.016 + (feet - 0.016) / 2, zFront - 0.05, 10));
cab.add(cyl("FootFront", 0.016, 0.017, 0.016, footM, W / 2 - 0.017, 0.008, zFront - 0.004, 16));
cab.add(cyl("FootThread", 0.006, 0.006, 0.012, pinM, W / 2 - 0.017, 0.022, zFront - 0.004, 10));
for (const fx of [-1, 1]) cab.add(cyl("Roller", 0.017, 0.017, 0.018, footM, fx * (W / 2 - 0.045), 0.017, zBack + 0.06).rotateZ(Math.PI / 2));
// hinges on the right: the bottom bracket under the fridge door (485-541 mm from the left, 31-37 mm up); the middle hinge, a
// black block in the doors' gap (442-535 mm from the left) on a steel plate with two bolt heads; a dark cover on top
cab.add(box("HingeBottom", 0.056, 0.006, 0.045, plinth, -W / 2 + 0.513, 0.034, zFront + 0.0125));
cab.add(box("HingeMidCover", 0.093, fzBot - frTop - 0.002, doorT - 0.006, plinth, -W / 2 + 0.4885, (fzBot + frTop) / 2, zFront + (doorT - 0.006) / 2));
cab.add(box("HingeMid", 0.034, 0.0035, doorT + 0.012, hingeM, W / 2 - 0.02, (fzBot + frTop) / 2, zFront + (doorT + 0.012) / 2 - 0.012));
for (const dz of [0.008, 0.028]) cab.add(cyl("HingeBolt", 0.0045, 0.0045, 0.001, hingeM, W / 2 - 0.02, (fzBot + frTop) / 2 + 0.0022, zFront + dz, 10));
cab.add(box("HingeCoverTop", 0.05, 0.012, 0.045, plinth, W / 2 - 0.033, H - 0.0052, zFront - 0.02));
// the top 6 mm of the gap is dark on every front photo (the freezer door's gasket and its shadow), the rest the white
// mullion
cab.add(box("GapShadow", inW, 0.005, 0.002, plinth, 0, fzBot - 0.0035, zFront + 0.003));
// a small dark stop on the mullion at the gap's left end (16-47 mm from the left, seen on every front photo)
cab.add(box("DoorStop", 0.031, 0.01, 0.012, plinth, -W / 2 + 0.0315, (fzBot + frTop) / 2, zFront + 0.006));
// power cord: its route on the back traced on LG's rear photo (rear_paths.json); past the cabinet's edge the photo does not
// show it, so it is drawn hanging to the floor with its three-pin plug lying there (estimated)
{
  const RP = JSON.parse(fs.readFileSync(`${T}/rear_paths.json`, "utf8"));
  const zc = zBack - 0.0045, V = (x, y, z) => new THREE.Vector3(x, y, z);
  const pts = RP.cord.map(([u, v]) => V(Math.min(rearW / 2 - u * rearW, W / 2 - 0.008), rearTop - v * (rearTop - rearBot), zc));
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

// ── freezer inside (LG's open-door photo large06, the back wall scaled by its 483 mm width) ──
const xL = -inW / 2, xR = inW / 2;
// two cold-air grilles under the ceiling either side of a plain middle panel, two slatted vents at the foot, four small
// black openings in a row under the shelf right of the ice maker, and the dial (no print on this model's wall)
cab.add(boxes("FreezerGrille", [[0.14, 0.022, 0.008, -0.106, fy1 - 0.03, zIn1 + 0.016], [0.07, 0.022, 0.008, 0, fy1 - 0.03, zIn1 + 0.016], [0.14, 0.022, 0.008, 0.105, fy1 - 0.03, zIn1 + 0.016]], white));
cab.add(boxes("FreezerGrilleSlot", [-0.106, 0.105].flatMap((x) => [0, 1].map((i) => [0.12, 0.003, 0.002, x, fy1 - 0.035 + i * 0.01, zIn1 + 0.0205])), plinth));
cab.add(boxes("FreezerVentPanel", [[0.14, 0.05, 0.004, -0.148, fy0 + 0.035, zIn1 + 0.014], [0.14, 0.05, 0.004, 0.144, fy0 + 0.035, zIn1 + 0.014]], white));
cab.add(boxes("FreezerVent", [-0.148, 0.144].flatMap((x) => [0, 1, 2, 3, 4, 5].map((i) => [0.12, 0.003, 0.002, x, fy0 + 0.015 + i * 0.008, zIn1 + 0.017])), plinth));
cab.add(boxes("FreezerSlot", [0, 1, 2, 3].map((i) => [0.009, 0.009, 0.004, -0.0155 + i * 0.013, fzShelfY - 0.022, zIn1 + 0.014]), plinth));
{
  const k = mesh("KnobDial", new THREE.CylinderGeometry(0.02, 0.02, 0.016, 28), [knobSide, knobFace, knobSide], 0.004, 1.13, zIn1 + 0.012 + 0.008);
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
// the ice maker hangs under the shelf on the LEFT (large06: about 180 mm wide, its middle 110 mm left of the cavity's); its
// front stays 95 mm behind the door's face so the lower door basket clears it
const icX = -0.11, icW = 0.17, icZ = zFront - 0.095, icDY = 0.005 - shift;
cab.add(box("IceHousingTop", icW + 0.01, 0.006, 0.2, white, icX, 1.317 + icDY, icZ - 0.1));
cab.add(box("IceHousingSideL", 0.005, 0.14, 0.2, white, icX - icW / 2 - 0.0025, 1.247 + icDY, icZ - 0.1));
cab.add(box("IceHousingSideR", 0.005, 0.14, 0.2, white, icX + icW / 2 + 0.0025, 1.247 + icDY, icZ - 0.1));

// ── fridge inside ──
const trays = group("FridgeTrays");
cab.add(trays);
cab.add(box("FridgeLed", 0.11, 0.006, 0.016, lightM, 0, gy1 - 0.006, zFront - 0.16));
// the air duct under the ceiling on the back wall (large06: a white box about 140 mm wide and 90 mm tall, ESTIMATED depth)
const duct = { w: 0.14, h: 0.09, d: 0.035, y: gy1 - 0.06 - 0.045 };
cab.add(box("AirDuct", duct.w, duct.h, duct.d, white, 0.005, duct.y, zIn1 + 0.012 + duct.d / 2));
cab.add(box("AirDuctSlot", 0.06, 0.004, 0.002, plinth, 0.005, duct.y - duct.h / 2 + 0.008, zIn1 + 0.012 + duct.d + 0.001));
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
const fzD = drawerFront - zIn1 - 0.016, fzW = inW - 0.02, fzC = zIn1 + fzD / 2 + 0.016;
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
// rows that need more width or depth than these narrower shelves have, and what would touch the air duct, are left out
const shw = inW / 2 - 0.03;
const ductBox = B3(0.005 - duct.w / 2 - 0.004, duct.y - duct.h / 2 - 0.012, -1, 0.005 + duct.w / 2 + 0.004, 2, zIn1 + 0.012 + duct.d + 0.01);
for (const n of ["Shelf1Stock", "Shelf2Stock", "Shelf3Stock"]) leaveOut(trays.getObjectByName(n), [B3(-1, 0, shelfFront - 0.016, 1, 2, 1), B3(-1, 0, -1, -shw - 0.003, 2, 1), B3(shw + 0.003, 0, -1, 1, 2, 1), ductBox, B3(-1, gy1 - 0.012, -1, 1, 3, 1)], `past ${n}'s side or front, the duct or the ceiling`);
trays.getObjectByName("Cauliflower")?.traverse((m) => {
  if (!m.isMesh) return;
  m.updateMatrix(); m.geometry = m.geometry.clone().applyMatrix4(m.matrix);
  m.position.set(0, 0, 0); m.rotation.set(0, 0, 0); m.scale.set(1, 1, 1);
});
// the freezer's floor stock stays right of the ice maker (LG's stocked photo: frozen peas there, the ice maker on the left)
stock.freezer(cab, { fit: true, zIn1, floor: fy0, top: fzShelfY + 0.0025, box: { hw: inW / 2 - 0.015, z0: zIn1 + 0.038, z1: icZ - 0.21 } });
{
  const t = cab.getObjectByName("OnFreezerShelf");
  if (t) {
    t.position.z -= 0.04;
    leaveOut(t, [B3(-1, fzShelfY - 0.01, fzShelfFront - 0.012, 1, fy1, 1)], "past the freezer shelf's front");
  }
  leaveOut(cab.getObjectByName("FreezerStock") || cab.getObjectByName("FreezerFloor"), [B3(icX - icW / 2 - 0.01, fy0 - 0.01, -1, icX + icW / 2 + 0.01, fzShelfY, 1)], "under the ice maker");
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
// the drop is put in the parts, not on the group: Apple's files park a moving part's copy, shrunk to a point, at its
// group's origin, and an origin 126 mm under the floor would count in RealityKit's size
for (const c of ic.children) c.position.y += icDY;
cab.add(ic);

// ── doors: hinged on the right, no handles, the gold lip across the top of the fridge door ──
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
function rowAt(g, items, x0, x1, zm) {
  g.updateMatrixWorld(true);
  const p = g.position, bs = items.map((o) => new THREE.Box3().setFromObject(o));
  const gap = (x1 - x0 - bs.reduce((s, b) => s + b.max.x - b.min.x, 0)) / (items.length + 1);
  if (gap < 0) console.warn(`rowAt: ${items.map((o) => o.name)} do not fit`);
  let x = x0 + gap;
  items.forEach((o, i) => { const b = bs[i]; o.position.x += x - (b.min.x - p.x); o.position.z += zm - ((b.min.z + b.max.z) / 2 - p.z); x += b.max.x - b.min.x + gap; });
}
const decalZ = doorT + 0.0006, printZ = doorT + 0.0006, markZ = doorT + 0.0014;
const freezerDoor = doorShell("FreezerDoor", fzBot, (g) => {
  const h = H - fzBot;
  g.add(mesh("FzPanel", flipV(new THREE.BoxGeometry(pw, h, doorT)), [doorEdge, doorEdge, doorEdge, doorEdge, steelDoorF, liner], -pw / 2, h / 2, doorT / 2));
  // the Radiant colours' print, a decal over the whole door face (the other colours hide it)
  g.add(plane("PrintFreezerDecal", pw, h, printF, -pw / 2, h / 2, printZ));
  // LG mark 47 x 21.6 mm, its middle 56 mm from the left and 36 mm down; the energy label 71 x 135 mm, its middle 64 mm from
  // the right and 110 mm down (LG's fronts)
  g.add(plane("LgMarkDecal", 0.047, 0.0216, logoM, -pw + 0.056, h - 0.036, markZ));
  g.add(plane("BeeLabelDecal", 0.0714, 0.1354, labelM, -0.064, h - 0.110, markZ));
  gaskets(g, "Fz", h);
  // basket floors: the 251 L's, moved down with the freezer (large06 reads 1.229 and 1.031 m)
  const b1 = 1.35 - shift - fzBot, b2 = 1.16 - shift - fzBot;
  const k1 = basket("FzBasket1", pw - 0.1, 0.07, 0.065, b1, true); k1.position.x = -pw / 2; g.add(k1);
  const k2 = basket("FzBasket2", pw - 0.1, 0.07, 0.065, b2, true); k2.position.x = -pw / 2; g.add(k2);
  stock.doorFreezer(g, { fit: true, b1, b2, dep: 0.07, inside: inside(pw - 0.1) });
});
const fridgeDoor = doorShell("FridgeDoor", frLow, (g) => {
  const h = frTop - frLow, y = (v) => v - frLow;
  g.add(mesh("FrPanelLow", flipV(new THREE.BoxGeometry(pw, y(goldBot), doorT)), [doorEdge, doorEdge, doorEdge, doorEdge, steelDoorR, liner], -pw / 2, y(goldBot) / 2, doorT / 2));
  g.add(plane("PrintFridgeDecal", pw, y(goldBot), printR, -pw / 2, y(goldBot) / 2, printZ));
  // the Golden Pocket Handle: a gold lip, the door's top 33 mm, its front 10 mm deep; behind it the pocket (a dark recess
  // 22 mm deep for the fingers, from 8 mm under the lip's top), then the door's inner part
  const lipH = frTop - goldBot, lipD = 0.01, pocketD = 0.022;
  g.add(mesh("GoldLip", new THREE.BoxGeometry(pw, lipH, lipD), [gold, gold, gold, gold, gold, black], -pw / 2, y(goldBot) + lipH / 2, doorT - lipD / 2));
  g.add(box("PocketFloor", pw - 0.024, 0.004, pocketD, black, -pw / 2, y(goldBot) + 0.002, doorT - lipD - pocketD / 2));
  g.add(mesh("PocketBack", new THREE.BoxGeometry(pw, lipH, doorT - lipD - pocketD), [doorEdge, doorEdge, black, doorEdge, black, liner], -pw / 2, y(goldBot) + lipH / 2, (doorT - lipD - pocketD) / 2));
  for (const sx of [-1, 1]) g.add(box("PocketEnd", 0.012, lipH, pocketD, doorEdge, -pw / 2 + sx * (pw / 2 - 0.006), y(goldBot) + lipH / 2, doorT - lipD - pocketD / 2));
  gaskets(g, "Fr", h);
  // three baskets (LG's spec), floors on LG's open-door photo large06 at 0.769, 0.326 and 0.085 m: eggs and a few jars at the
  // top, bottles in the tall one, sauces and cans at the foot, as in LG's stocked photo
  const eggY = y(0.769), botY = y(0.326), canY = y(0.085);
  const add = (n, dep, hh, yy) => { const k = basket(n, pw - 0.12, dep, hh, yy, true); k.position.x = -pw / 2; g.add(k); };
  add("EggBasket", 0.085, 0.06, eggY); add("BottleBasket", 0.095, 0.13, botY); add("CanBasket", 0.08, 0.09, canY);
  const eggX = [0, 1, 2, 3, 4].map((i) => -0.095 - i * 0.05);
  g.add(box("EggCupsRib", 0.26, 0.006, 0.05, clearRib, -0.195, eggY + 0.006, -0.047));
  // stock_lg.mjs stocks four baskets (eggs, jars, bottles, cans); here, as on the 251 L, the jar row is built on a spare
  // height, two jars move into the egg basket beside the eggs, and the rest of that row is left out
  const deps = { egg: 0.085, jar: 0.085, bottle: 0.095, can: 0.08 };
  stock.doorFridge(g, { fit: true, eggY, jarY: y(0.55), botY, canY, deps, inside: inside(pw - 0.12), eggX });
  const [x0, x1] = inside(pw - 0.12)(0.075);
  const jars = ["MothersPickle", "AavinGhee"].map((n) => g.children.find((c) => c.name === n)).filter(Boolean);
  for (const n of ["MothersPickle2", "SakthiSambar", "NandiniGhee", "RealMixedFruit"]) g.children.find((c) => c.name === n)?.removeFromParent();
  jars.forEach((o) => (o.position.y += eggY - y(0.55)));
  rowAt(g, jars, x0, -0.325, -(0.01 + deps.egg / 2));
  rowAt(g, ["Coke", "Fanta", "Bisleri", "RealMango", "AmulTaaza"].map((n) => g.children.find((c) => c.name === n)).filter(Boolean), x0, x1, -(0.01 + deps.bottle / 2));
});
root.add(freezerDoor, fridgeDoor);

const parts = productParts(PRODUCTS, ID);
const clips = stateClips(root, parts);
saveZones(PRODUCTS, ID, root, parts);
const F0 = FIN[0].slug;
const textures = {
  DoorFreezer: `${T}/door_freezer_${F0}.jpg`, DoorFridge: `${T}/door_fridge_${F0}.jpg`, SideSteel: `${T}/side_${F0}.jpg`, RearPlate: `${T}/rear.jpg`,
  LabelBEE: `${T}/label.png`, LgMark: `${T}/lgmark_light.png`, PrintFreezer: `${T}/print_freezer_${F0}.png`, PrintFridge: `${T}/print_fridge_${F0}.png`,
  KnobFace: `${T}/knob.jpg`, FreshZoneFront: `${T}/fresh_zone.jpg`,
};
Object.assign(textures, stock.textures());
{ const used = new Set(); root.traverse((o) => o.isMesh && [].concat(o.material).forEach((m) => used.add(m.name))); for (const k of Object.keys(textures)) if (!used.has(k)) delete textures[k]; }
// Grain: the doors get the hairline UVs (the colours that are brushed use them; the glossy black ones carry no grain), the
// painted sides and top a soft peel. The gold lip carries none: at any viewing distance a grain there reads as wood.
await exportGLB(root, clips, OUT, textures, { dir: `${TEX}/grain`, materials: {
  DoorFreezer: { type: "hairline", dir: "v", clearcoat: [0.85, 0.16] },
  DoorFridge: { type: "hairline", dir: "v", clearcoat: [0.85, 0.16] },
  SideSteel: { type: "peel_soft" }, TopSteel: { type: "peel_soft" },
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
  const G = `${TEX}/grain`;
  const GRAINS = {
    hairline_v: { n: [`${G}/hairline_n.jpg`, "grain_hairline_n"], r: [`${G}/hairline_r.jpg`, "grain_hairline_r"] },
    hairline_soft_v: { n: [`${G}/hairline_soft_n.jpg`, "grain_hairline_soft_n"], r: [`${G}/hairline_r.jpg`, "grain_hairline_r"] },
    hairline_soft_h: { n: [`${T}/grain_hairline_soft_h_n.jpg`, "grain_hairline_soft_h_n"], r: [`${T}/grain_hairline_h_r.jpg`, "grain_hairline_h_r"] },
  };
  const coatExt = R.listExtensionsUsed().find((e) => e.extensionName === "KHR_materials_clearcoat") || doc.createExtension(KHRMaterialsClearcoat);
  const varExt = doc.createExtension(KHRMaterialsVariants);
  const hex = (c) => [((c >> 16) & 255) / 255, ((c >> 8) & 255) / 255, (c & 255) / 255].map((v) => Math.pow(v, 2.2));   // sRGB to linear, as three.js writes it
  const lin = (rgb) => rgb.map((v) => Math.pow(v / 255, 2.2));
  const VARY = ["DoorFreezer", "DoorFridge", "PrintFreezer", "PrintFridge", "SideSteel", "DoorEdge", "TopSteel", "LgMark"];
  const base = Object.fromEntries(VARY.map((n) => [n, byName(n)]));
  for (const n of VARY) if (!base[n]) throw new Error(`no material ${n}`);
  const setDoor = (m, f, part) => {
    m.setBaseColorTexture(image(`${T}/door_${part}_${f.slug}.jpg`, `Door${part === "freezer" ? "Freezer" : "Fridge"}_${f.slug}`)).setBaseColorFactor([1, 1, 1, 1]);
    m.setMetallicFactor(f.door.metal).setRoughnessFactor(f.door.rough);
    const g = f.door.grain && GRAINS[f.door.grain];
    if (g) {
      m.setNormalTexture(image(...g.n)); m.getNormalTextureInfo().setTexCoord(1);
      m.setMetallicRoughnessTexture(image(...g.r)); m.getMetallicRoughnessTextureInfo().setTexCoord(1);
    } else { m.setNormalTexture(null); m.setMetallicRoughnessTexture(null); }
    m.setExtension("KHR_materials_clearcoat", f.door.coat ? coatExt.createClearcoat().setClearcoatFactor(f.door.coat[0]).setClearcoatRoughnessFactor(f.door.coat[1]) : null);
  };
  const setPrint = (m, f, part) => {
    // the Radiant colours' decals carry their ink in the image (tex_lg_glt2216.py, INK_K)
    if (f.line) m.setBaseColorTexture(image(`${T}/print_${part}_${f.slug}.png`, `Print_${part}_${f.slug}`)).setBaseColorFactor([1, 1, 1, 1]);
    // no print on this colour: the decal takes a clear image (Apple's viewers ignore a clear colour factor's alpha)
    else m.setBaseColorTexture(image(`${T}/print_none.png`, "PrintNone")).setBaseColorFactor([1, 1, 1, 1]);
  };
  const mats = FIN.map((f, i) => {
    const out = {};
    for (const n of VARY) {
      const m = i === 0 ? base[n] : base[n].clone().setName(`${n}_${f.slug}`);
      if (n === "DoorFreezer") setDoor(m, f, "freezer");
      if (n === "DoorFridge") setDoor(m, f, "fridge");
      if (n === "PrintFreezer") setPrint(m, f, "freezer");
      if (n === "PrintFridge") setPrint(m, f, "fridge");
      if (n === "SideSteel") m.setBaseColorTexture(image(`${T}/side_${f.slug}.jpg`, `SideSteel_${f.slug}`));
      if (n === "DoorEdge") m.setBaseColorFactor([...hex(f.edge), 1]);
      if (n === "TopSteel") m.setBaseColorFactor([...hex(f.top), 1]);
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
  // drop textures nothing uses any more (the first colour's grain on the glossy doors)
  for (const t of R.listTextures()) if (!t.listParents().some((p) => p.propertyType === "Material")) t.dispose();
  fs.writeFileSync(OUT, await io.writeBinary(doc));
  console.log(`variants: ${FIN.map((f) => f.variant).join(", ")}; ${mapped} primitives mapped;`, (fs.statSync(OUT).size / 1048576).toFixed(2), "MB");
}
