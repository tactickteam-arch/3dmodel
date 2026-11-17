// LG GL-B211HPZD, 201 L 3-star direct-cool single-door refrigerator in Shiny Steel (LG India sells this model in that
// one colour: its page lists no sibling colours). Built from the LG 224 L single-door builder (make_lg_gld2356.mjs), the
// same maker's door, handle and freezer layout, without its base stand.
// Size: LG's 565 W x 1217 H x 700 D mm (LG's page; LG's owner's manual for this model's family, MFL72023301, gives the
// same in its third column and splits the depth: 38 mm of condenser on the back, 630 mm from the back to the door's
// face, 662 mm to the handle's front). Heights inside and outside are read off LG's photos as fractions laid on those
// figures; every number and how it was got is in the private research notes (NOTES.md).
// What it is: a cabinet on two front levelling feet, the wire-and-tube condenser on the back and the compressor in an
// open bay under it; one door hinged on the right, PET with rounded sides and an arched top, a chrome bar handle over a
// dark pocket with the lock in its foot; inside, the freezer across the top behind a clear door with "Fast Freezing Zone"
// on it (its grip on the left, so hinged on the right), the knob panel with the lamp under its right end, the chiller
// tray, two toughened glass shelves, the crisper's glass cover and the 16 L vegetable box; in the door, a basket with egg
// cups and one beside it at the top, one under the egg basket, a wide basket and the bottle basket (five holders on LG's
// open photos and its manual's figure; LG's spec table says 4 door baskets). The shelves, the chiller tray and the
// vegetable box come out with their food (FridgeTrays). Stocked for a south Indian kitchen.
// usage: node make_lg_glb211.mjs <entry .json, never products.json> <tex dir> <out.glb>
import fs from "node:fs";
import { mergeGeometries, mergeVertices } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { THREE, mat, mesh, box, faced, group, flipV, stateClips, exportGLB, productParts, saveZones } from "./lib.mjs";
import { LGStock } from "./stock_lg.mjs";

const [PRODUCTS, TEX, OUT] = process.argv.slice(2);
const ID = "lg-gl-b211hpzd";
const T = `${TEX}/lg_glb211`;
const C = JSON.parse(fs.readFileSync(`${T}/colours.json`, "utf8"));

// ── size (metres) ──
const W = 0.565, H = 1.217, D = 0.700;
// depths (LG's manual: condenser 38 mm, back to door face 630 mm, back to handle 662 mm); the cabinet's front and the
// door's back from LG's side photo (MZ-08, 1.049 mm a px from the back to the handle's front)
const zCond = -D / 2, zCabBack = zCond + 0.038;
const zFront = zCabBack + 0.534;             // the cabinet's front
const zDoor = zCabBack + 0.541;              // the door's back (the gasket's dark band)
const T_ = zCabBack + 0.630 - zDoor;         // the door, to its face at the middle: 89 mm
// heights (MZ-08, 1.0455 mm a px from the floor to the door's top)
const cabBot = 0.051, cabTop = 1.183;        // the cabinet's underside (on its feet) and its top
const doorBot = 0.060;                       // the door's foot
const ARCH = 0.019;                          // the door's top: 19 mm lower at its sides than at its middle (front photo)
const TOPBACK = 0.032;                       // and 32 mm lower at its back than at its face (side photo)
const wall = 0.044, inW = W - 2 * wall;      // 477 mm between the walls (the freezer's front on MZ-04)
const floorIn = 0.130, ceil = 1.158;         // the cavity's floor and ceiling (MZ-04)
const zIn = zCabBack + 0.05;                 // the cavity's back (ESTIMATED: a 50 mm back wall)
// inside (MZ-04, the empty open photo, 1.368 mm a px down the cabinet's front):
const fbBot = 0.913, fbTop = 1.113;          // the freezer box; its front stays clear of the shut door's top baskets
const fbZ1 = zDoor - 0.105;
const flX0 = -inW / 2 + 0.012, flX1 = inW / 2 - 0.012, flY0 = 0.918, flY1 = 1.095;   // its clear door, the box's width
const panelX0 = inW / 2 - 0.065, pnBot = 0.822, pnTop = fbBot - 0.001;               // the knob panel, 65 x 93 mm
const ctBot = 0.826, ctTop = 0.908, ctZ1 = fbZ1 - 0.005;   // the chiller tray, left of the panel
const s1 = 0.699, s2 = 0.543;                // the glass shelves' tops (front rims)
const coverY = 0.362;                        // the crisper's glass cover
const vbBot = 0.137, vbTop = 0.357;          // the vegetable box
const frontFridge = zDoor - 0.12;            // shelves and the box stop 9 mm short of the shut door's deepest basket
// the door
const pw = W - 0.002, dh = H - doorBot;
const linerFace = 0.016;
// door baskets: floors above the door's foot (MZ-04, read along the door), depth, wall height; the bottle basket is
// put 85 mm over the photo's reading so it clears the cavity's floor when the door shuts (ESTIMATED)
const BK = {
  eggs: { y: 1.022 - doorBot, d: 0.075, h: 0.05 },
  top: { y: 0.958 - doorBot, d: 0.0751, h: 0.05 },
  second: { y: 0.853 - doorBot, d: 0.075, h: 0.05 },
  wide: { y: 0.498 - doorBot, d: 0.095, h: 0.08 },
  bottle: { y: 0.145 - doorBot, d: 0.0951, h: 0.11 },
};

// ── materials ──
const doorFace = mat("DoorFace", 0xffffff, { metal: 0.38, rough: 0.5 });
const doorEdge = mat("DoorEdge", 0x949596, { metal: 0.2, rough: 0.45 });
const sidePaint = mat("SidePaint", 0x8a8b8f, { metal: 0.3, rough: 0.45 });
const topPaint = mat("TopPaint", 0x7a7b7e, { metal: 0.15, rough: 0.6 });
const baseM = mat("BasePlate", 0x4a4b4e, { metal: 0.2, rough: 0.6 });
const logoM = mat("LgMark", 0xffffff, { rough: 0.45, opacity: 0.999 });
const rearM = mat("RearPlate", 0xffffff, { metal: 0.05, rough: 0.55 });
const chrome = mat("Chrome", 0xd4d7db, { metal: 1, rough: 0.14 });
const dark = mat("DarkPlastic", 0x1d1e21, { rough: 0.7 });
const condM = mat("Condenser", 0x16171a, { metal: 0.3, rough: 0.5 });
const hingeM = mat("HingeCover", 0x3a3b3e, { rough: 0.55 });
const footM = mat("FootRubber", 0x141416, { rough: 0.8 });
const liner = mat("Liner", 0xf1f3f5, { rough: 0.6 });
const linerSide = mat("LinerSide", 0xe4e8ec, { rough: 0.65 });
const linerDk = mat("LinerGrey", 0xd5d9de, { rough: 0.6 });
const gasket = mat("Gasket", 0x8d9196, { rough: 0.85 });
const white = mat("WhitePlastic", 0xf6f7f8, { rough: 0.45 });
const clear = mat("ClearPlastic", 0xc3d0da, { rough: 0.12, opacity: 0.5, side: THREE.DoubleSide });
const clearLight = mat("ClearPlasticLight", 0xdfe7ee, { rough: 0.12, opacity: 0.26, side: THREE.DoubleSide });
const clearRib = mat("ClearRib", 0xffffff, { rough: 0.3, opacity: 0.92 });
const flapM = mat("FlapClear", 0xc9d3db, { rough: 0.2, opacity: 0.4, side: THREE.DoubleSide });   // MZ-04: clear, blue edges
const frosted = mat("Frosted", 0xe6edf1, { rough: 0.45, opacity: 0.8 });
const blueEdge = mat("ClearBlueEdge", 0x9cc3e4, { rough: 0.2, opacity: 0.85 });
const glass = mat("TemperedGlass", 0xa9cdd6, { rough: 0.05, opacity: 0.55, side: THREE.DoubleSide });
const glassRim = mat("ShelfRim", 0xe3e7ea, { rough: 0.45 });
const edgeGreen = mat("GlassEdge", 0x7fa7b0, { rough: 0.3 });
const lampM = mat("LedLamp", 0xfff3dc, { emissive: 0xffe7b8, emissiveIntensity: 1.2 });
const cordM = mat("Cord", 0x1a1b1d, { rough: 0.6 });                 // the black cord (rear photo)
const plugM = mat("Plug", 0x3c3d41, { rough: 0.5 });                 // its dark grey plug body (rear photo)
const pinM = mat("Pin", 0xb7bbc0, { metal: 0.9, rough: 0.3 });
const panelFace = mat("PanelFace", 0xffffff, { rough: 0.5 });
const knobM = mat("KnobDark", 0x2a2b2f, { rough: 0.45 });
const knobRim = mat("KnobRim", 0x55575c, { metal: 0.3, rough: 0.4 });
const printFF = mat("Print_fastfreeze", 0xffffff, { rough: 0.5, opacity: 0.999 });
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
// a clear door basket, open at the top, its rim's top edge blue as on LG's photos; origin at its floor's middle on the
// face of the door's liner
function basket(name, w, dep, h) {
  const g = group(name, 0, 0, -linerFace);
  g.add(box(name + "Floor", w, 0.004, dep, clear, 0, 0.002, -dep / 2));
  g.add(box(name + "Lip", w, h * 0.85, 0.004, clear, 0, h * 0.425, -dep + 0.002));
  g.add(box(name + "EndL", 0.004, h, dep, clear, -w / 2 + 0.002, h / 2, -dep / 2));
  g.add(box(name + "EndR", 0.004, h, dep, clear, w / 2 - 0.002, h / 2, -dep / 2));
  g.add(box(name + "Rim", w, 0.007, 0.006, blueEdge, 0, h * 0.85 - 0.0035, -dep + 0.003));
  return g;
}
// a rounded rectangle Shape
function rrect(w, h, r) {
  const s = new THREE.Shape();
  s.moveTo(-w / 2 + r, -h / 2); s.lineTo(w / 2 - r, -h / 2); s.quadraticCurveTo(w / 2, -h / 2, w / 2, -h / 2 + r);
  s.lineTo(w / 2, h / 2 - r); s.quadraticCurveTo(w / 2, h / 2, w / 2 - r, h / 2); s.lineTo(-w / 2 + r, h / 2);
  s.quadraticCurveTo(-w / 2, h / 2, -w / 2, h / 2 - r); s.lineTo(-w / 2, -h / 2 + r); s.quadraticCurveTo(-w / 2, -h / 2, -w / 2 + r, -h / 2);
  return s;
}

const root = group("LGGLB211");
const cab = group("Cabinet");
root.add(cab);

// ── cabinet shell ──
const shellH = cabTop - cabBot, shellMid = cabBot + shellH / 2, Dc = zFront - zCabBack, zMid = (zFront + zCabBack) / 2;
cab.add(faced("SideLeft", wall, shellH, Dc, [linerSide, sidePaint, topPaint, baseM, sidePaint, dark], -W / 2 + wall / 2, shellMid, zMid));
cab.add(faced("SideRight", wall, shellH, Dc, [sidePaint, linerSide, topPaint, baseM, sidePaint, dark], W / 2 - wall / 2, shellMid, zMid));
cab.add(faced("Top", inW, cabTop - ceil, Dc, [liner, liner, topPaint, liner, sidePaint, dark], 0, (cabTop + ceil) / 2, zMid));
// the side's pressed panels, low at the back on both sides (MZ-08, MZ-09: two 184 mm and two 100 mm long, 26 mm tall;
// ESTIMATED 1 mm proud)
for (const sx of [-1, 1]) for (const [z0, z1, y0, y1] of [[0.106, 0.290, 0.302, 0.328], [0.106, 0.290, 0.250, 0.276], [0.190, 0.290, 0.192, 0.218], [0.190, 0.290, 0.145, 0.171]]) {
  const g = new THREE.ExtrudeGeometry(rrect(z1 - z0, y1 - y0, 0.004), { depth: 0.001, bevelEnabled: false, curveSegments: 3 });
  g.rotateY(sx * Math.PI / 2);
  cab.add(mesh("SidePress", g, sidePaint, sx * W / 2, (y0 + y1) / 2, zCabBack + (z0 + z1) / 2));
}
// the compressor bay: open at the bottom of the back under the condenser (MZ-10: from 0.787 of the back's height down),
// recessed 50 mm (ESTIMATED: the photo shows no depth; the back wall is 50 mm)
const yBay = cabTop - 0.787 * shellH, bayD = 0.05, zBay = zCabBack + bayD;
cab.add(faced("Base", inW, floorIn - cabBot, zFront - zBay, [liner, liner, liner, baseM, sidePaint, dark], 0, cabBot + (floorIn - cabBot) / 2, (zFront + zBay) / 2));
cab.add(faced("BackWall", inW, ceil - yBay, zIn - zCabBack, [liner, liner, liner, liner, liner, dark], 0, (ceil + yBay) / 2, (zIn + zCabBack) / 2));
cab.add(faced("BackWallLow", inW, yBay - floorIn, zIn - zBay, [liner, liner, liner, liner, liner, dark], 0, (yBay + floorIn) / 2, (zIn + zBay) / 2));
// the real back: LG's rear photo (MZ-10, the condenser, its clips and the cord painted out), straight on: u from the
// right side (+x, the photo's left seen from behind), v from the cabinet's top to its foot
function rearPanel(name, x0, x1, y0, y1, z) {
  const g = new THREE.PlaneGeometry(x1 - x0, y1 - y0).rotateY(Math.PI), cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
  const P = g.attributes.position, uv = g.attributes.uv;
  for (let i = 0; i < P.count; i++) uv.setXY(i, (W / 2 - (P.getX(i) + cx)) / W, (cabTop - (P.getY(i) + cy)) / shellH);
  return mesh(name, g, rearM, cx, cy, z);
}
const zPlate = zCabBack - 0.0015;
cab.add(rearPanel("RearPlate", -W / 2, W / 2, yBay, cabTop, zPlate));
for (const sx of [-1, 1]) cab.add(rearPanel("RearPlate", sx < 0 ? -W / 2 : inW / 2, sx < 0 ? -inW / 2 : W / 2, cabBot, yBay, zPlate));
cab.add(rearPanel("RearPlate", -inW / 2, inW / 2, cabBot, yBay, zBay - 0.0005));
cab.add(box("BayTop", inW, 0.003, bayD + 0.002, dark, 0, yBay + 0.0015, zBay - (bayD + 0.002) / 2));
for (const sx of [-1, 1]) cab.add(box("BaySide", 0.003, yBay - cabBot - 0.003, bayD - 0.002, dark, sx * (inW / 2 - 0.003), (yBay + cabBot) / 2, zBay - bayD / 2));
// hinges on the right: a dark cover on the cabinet's top behind the door (MZ-04, MZ-09: about 89 mm long, 19 mm tall)
// and the bottom bracket under the door's right corner (front photo)
cab.add(box("HingeCoverTop", 0.06, 0.018, 0.089, hingeM, W / 2 - 0.032, cabTop + 0.009, zDoor - 0.002 - 0.0445));
cab.add(box("HingeBottom", 0.035, 0.004, 0.06, chrome, W / 2 - 0.0205, cabBot - 0.002, zFront + 0.018));
cab.add(cyl("HingePin", 0.004, 0.004, doorBot - cabBot + 0.006, chrome, W / 2 - 0.012, (doorBot + cabBot) / 2, zFront + 0.03, 10));
// the two front levelling feet (front photo: 29 mm in from each side; MZ-08: 172 mm behind the middle; a silver
// stem and a black knurled foot, 33 mm across), the adjustable legs of LG's manual
for (const sx of [-1, 1]) {
  const fx = sx * (W / 2 - 0.029), fz = zCabBack + 0.484;
  cab.add(cyl("FootStem", 0.0055, 0.0055, 0.014, chrome, fx, cabBot - 0.007, fz, 12));
  cab.add(cyl("FootFront", 0.0145, 0.0165, cabBot - 0.012, footM, fx, (cabBot - 0.012) / 2, fz, 20));
}

// ── the condenser on the back: its tube's runs and bends, the three bands of wires, four clips (rear_paths.json, from
// LG's rear photo); 38 mm deep with the wires on its outer side (LG's manual) ──
const RP = JSON.parse(fs.readFileSync(`${T}/rear_paths.json`, "utf8"));
const rx = (u) => W / 2 - u * W, ry = (v) => cabTop - v * shellH;
{
  const zt = zCabBack - 0.0316, rt = 0.0024, zw = zCond + 0.0009, rw = 0.0008;
  const [ua, ub] = RP.bend_u, xa = rx(ua), xb = rx(ub);   // xa: the fridge's right end of the runs, xb: its left
  const ys = RP.runs_v.map(ry), pts = [];
  ys.forEach((y, i) => {
    const [p, q] = i % 2 ? [xa, xb] : [xb, xa];
    pts.push(new THREE.Vector3(p, y, zt), new THREE.Vector3(q, y, zt));
  });
  // the runs joined end to end by half-round bends
  const path = new THREE.CurvePath();
  for (let i = 0; i < pts.length; i += 2) {
    path.add(new THREE.LineCurve3(pts[i], pts[i + 1]));
    if (i + 2 < pts.length) {
      const a = pts[i + 1], b = pts[i + 2], r = (a.y - b.y) / 2, s = Math.sign(a.x) || 1;
      path.add(new THREE.CubicBezierCurve3(a, new THREE.Vector3(a.x + s * r * 1.33, a.y, zt), new THREE.Vector3(b.x + s * r * 1.33, b.y, zt), b));
    }
  }
  cab.add(mesh("CondenserTube", new THREE.TubeGeometry(path, 340, rt, 6, false), condM));
  const [wy0, wy1] = RP.wire_v.map(ry), wires = [];
  for (const [u0, u1, n] of RP.wire_bands) for (let k = 0; k < n; k++) {
    const x = rx(u0 + (u1 - u0) * k / (n - 1));
    wires.push(new THREE.BoxGeometry(2 * rw, wy0 - wy1, 2 * rw).translate(x, (wy0 + wy1) / 2, zw + rw));
  }
  cab.add(mesh("CondenserWires", mergeGeometries(wires), condM));
  for (const [u, v] of RP.clips) cab.add(cyl("CondenserClip", 0.007, 0.009, zCabBack - zt, dark, rx(u), ry(v), (zCabBack + zt) / 2, 12).rotateX(Math.PI / 2));
}
// the power cord: out of the back at the top of the fridge's left edge (rear photo), down over the condenser's end,
// tied to its lowest bend, into the bay to the plug hung in its corner (dark grey, rounded; its pins are hidden on the
// photo, so they are drawn down, as on an Indian three-pin plug: ESTIMATED)
{
  const V = (x, y, z) => new THREE.Vector3(x, y, z), zc = zCond + 0.004;
  const pts = RP.lead.map(([u, v], i) => V(Math.max(-W / 2 + 0.012, rx(u)), ry(v), i === 0 ? zCabBack - 0.006 : zc));
  const [pu, pv] = RP.plug, px = Math.max(-inW / 2 + 0.03, rx(pu)), py = ry(pv), pz = zBay - 0.0005;
  const ph = 0.042, pwid = 0.045, pt = 0.016;
  const last = pts[pts.length - 1];
  pts.push(V(last.x + 0.004, yBay - 0.01, zCabBack - 0.012), V(px, py + ph / 2 + 0.02, pz - pt / 2 - 0.004), V(px, py + ph / 2 + 0.003, pz - pt / 2 - 0.002));
  cab.add(mesh("PowerCord", new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts, false, "centripetal"), 110, 0.0035, 6, false), cordM));
  const plug = mesh("Plug", new THREE.ExtrudeGeometry(rrect(pwid, ph, 0.012), { depth: pt - 0.004, bevelEnabled: true, bevelSize: 0.002, bevelThickness: 0.002, bevelSegments: 2, curveSegments: 8 }), plugM, px, py, pz - 0.002);
  plug.rotation.y = Math.PI;
  cab.add(plug);
  for (const [dx, dz] of [[-0.0095, -0.005], [0.0095, -0.005], [0, -0.011]]) cab.add(cyl("PlugPin", 0.0026, 0.0026, 0.016, pinM, px + dx, py - ph / 2 - 0.008, pz + dz, 10));
}

// ── inside: the freezer across the top, its clear door, the knob panel and the lamp ──
const xL = -inW / 2, xR = inW / 2, wt = 0.008;
cab.add(box("VentPanel", inW, ceil - fbTop, fbZ1 - zIn, white, 0, (ceil + fbTop) / 2, (fbZ1 + zIn) / 2));
{
  const zc = (zIn + fbZ1) / 2, d = fbZ1 - zIn, h = fbTop - fbBot;
  cab.add(box("FreezerBoxFloor", inW - 0.002, wt, d, white, 0, fbBot + wt / 2, zc));
  // the frame round its door: the strips either side, the band under it, the band over it with the row of 13 slots
  // (MZ-04)
  cab.add(box("FreezerFrameL", flX0 - xL, h - wt, 0.012, white, (xL + flX0) / 2, fbBot + wt + (h - wt) / 2, fbZ1 - 0.006));
  cab.add(box("FreezerFrameR", xR - flX1, h - wt, 0.012, white, (flX1 + xR) / 2, fbBot + wt + (h - wt) / 2, fbZ1 - 0.006));
  cab.add(box("FreezerFrameTop", flX1 - flX0, fbTop - flY1, 0.012, white, 0, (fbTop + flY1) / 2, fbZ1 - 0.006));
  cab.add(box("FreezerFrameBot", flX1 - flX0, flY0 - fbBot - wt, 0.012, white, 0, (fbBot + wt + flY0) / 2, fbZ1 - 0.006));
  cab.add(mesh("VentSlots", mergeGeometries([...Array(13)].map((_, i) => new THREE.BoxGeometry(0.022, 0.005, 0.002).translate((i - 6) * 0.033, (fbTop + flY1) / 2, fbZ1 + 0.001))), dark));
  cab.add(box("FreezerBack", inW - 0.004, h - wt, 0.004, linerDk, 0, fbBot + wt + (h - wt) / 2, zIn + 0.002));
  // the knob panel under the freezer's right end: its print (the dial's ring, "Defrost Button", "Lamp 10W"), the dark
  // knob (manual: 1 Low Cooling to 7 High Cooling), and the lamp's cover under it (MZ-03, MZ-04)
  const pd = 0.10, pcx = (panelX0 + xR) / 2, pcy = (pnBot + pnTop) / 2;
  cab.add(faced("ControlPanel", xR - panelX0, pnTop - pnBot, pd, [white, white, white, white, white, white], pcx, pcy, fbZ1 - pd / 2 - 0.0006));
  cab.add(plane("PanelPrint", xR - panelX0 - 0.001, pnTop - pnBot - 0.001, panelFace, pcx, pcy, fbZ1 + 0.0002));
  const [kmx, kmy] = C.knob_mm, [PWm, PHm] = C.panel_mm;
  const kx = panelX0 + (kmx / PWm) * (xR - panelX0), ky = pnTop - (kmy / PHm) * (pnTop - pnBot);
  const k = mesh("KnobDial", new THREE.CylinderGeometry(0.0125, 0.013, 0.012, 36), [knobRim, knobM, knobM], kx, ky, fbZ1 + 0.006);
  k.rotation.x = Math.PI / 2;
  cab.add(k);
  const lamp = mesh("LampCover", new THREE.SphereGeometry(0.02, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2), lampM, pcx, pnBot, fbZ1 - 0.03);
  lamp.rotation.x = Math.PI; lamp.scale.set(1.2, 0.6, 1.2);
  cab.add(lamp);
}
// the freezer's clear door, hinged on its right edge (ESTIMATED: its grip is on the left; LG shows it shut only):
// clear with blue edges, "Fast Freezing Zone" across it (MZ-03, MZ-04)
const flap = group("FreezerFlap", flX1, 0, fbZ1);
{
  const w = flX1 - flX0, yc = (flY0 + flY1) / 2, h = flY1 - flY0;
  flap.add(box("FlapPanel", w - 0.012, h - 0.012, 0.004, flapM, -w / 2, yc, 0.004));
  flap.add(box("FlapRimT", w, 0.006, 0.008, blueEdge, -w / 2, flY1 - 0.003, 0.004));
  flap.add(box("FlapRimB", w, 0.006, 0.008, blueEdge, -w / 2, flY0 + 0.003, 0.004));
  flap.add(box("FlapRimR", 0.006, h - 0.012, 0.008, blueEdge, -0.003, yc, 0.004));
  flap.add(box("FlapRimL", 0.006, h - 0.012, 0.008, blueEdge, -w + 0.003, yc, 0.004));
  // the grip: a clear moulding near its left end (MZ-04: 29 to 95 mm from the left, 120 mm tall)
  flap.add(box("FlapGrip", 0.05, 0.12, 0.006, frosted, -w + 0.062, 1.008, 0.008));   // 6 mm proud (ESTIMATED), so the shut door's top basket clears it
  flap.add(plane("PrintFastFreeze", 0.137, 0.014, printFF, -w / 2, 1.006, 0.0065));
}
cab.add(flap);
// the drain spout on the back wall under the chiller tray (MZ-04)
cab.add(box("DrainCup", 0.03, 0.045, 0.03, white, -0.122, 0.785, zIn + 0.015));

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
// the chiller tray: clear, its front edge blue (MZ-04), on runners, left of the knob panel
const ctX0 = xL + 0.004, ctX1 = panelX0 - 0.004, ctW = ctX1 - ctX0, ctCX = (ctX0 + ctX1) / 2;
const ctZ0 = zIn + 0.012, ctZ = (ctZ0 + ctZ1) / 2;
{
  const hh = ctTop - ctBot;
  trays.add(box("ChillFloor", ctW, 0.004, ctZ1 - ctZ0, clear, ctCX, ctBot + 0.002, ctZ));
  for (const sx of [-1, 1]) trays.add(box("ChillSide", 0.004, hh, ctZ1 - ctZ0, clear, ctCX + sx * (ctW / 2 - 0.002), ctBot + hh / 2, ctZ));
  trays.add(box("ChillBack", ctW, hh, 0.004, clear, ctCX, ctBot + hh / 2, ctZ0 + 0.002));
  trays.add(box("ChillFront", ctW, hh - 0.008, 0.004, clearLight, ctCX, ctBot + (hh - 0.008) / 2, ctZ1 - 0.002));
  trays.add(box("ChillRim", ctW, 0.008, 0.006, blueEdge, ctCX, ctTop - 0.004, ctZ1 - 0.003));
  cab.add(box("ChillRunner", 0.006, 0.006, ctZ1 - ctZ0, linerDk, xL + 0.003, ctBot - 0.003, ctZ));
}
// the crisper's glass cover and the vegetable box (FzBox* are the names qa_bounds reads)
{
  const bd = frontFridge - 0.004 - zIn - 0.004;
  cab.add(box("CrisperCover", inW - 0.012, 0.005, bd, glass, 0, coverY - 0.0025, zIn + 0.004 + bd / 2));
  cab.add(box("CrisperCoverRim", inW - 0.012, 0.016, 0.012, glassRim, 0, coverY - 0.008, frontFridge - 0.006));
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
  trays.add(box("FzBoxRim", vbW + 0.006, 0.01, 0.008, blueEdge, 0, vbBot + 0.07, vbZ1 + 0.002));
  trays.add(box("FzBoxTopRim", vbW + 0.006, 0.012, 0.008, frosted, 0, vbTop - 0.006, vbZ1 - 0.002));
}

// ── stock: vegetarian South Indian food, eggs, juices, water and soft drinks (stock_lg.mjs, food.mjs); the crisper's
// glass cover is the third shelf (LG's stocked photo MZ-02: the melon and a cake on it) ──
stock.shelves(trays, {
  zIn1: zIn, inW, inD: frontFridge - zIn, s1: s1 - 0.0005, s2: s2 - 0.0005, s3: coverY - 0.0005, fz: vbBot + 0.004, fit: true, vz0: vbZ0 + 0.02, vk: 0.8,
  shelfB: { hw: inW / 2 - 0.03, z0: zIn + 0.022, z1: frontFridge - 0.015 },
  drawerB: { hw: vbW / 2 - 0.014, z0: vbZ0 + 0.02, z1: vbZ1 - 0.008, y0: vbBot + 0.004 },
  drawerCeil: coverY - 0.005 - 0.01 - (vbBot + 0.004),
});
// the shelves are 334 mm deep and 417 mm wide inside their rims: each shelf's rows are laid out again here (rows
// spaced by each item's real size, 6 mm or more between items), and an item or row that doesn't fit is left out, never
// scaled
const bbox = (o) => { o.updateWorldMatrix(true, true); return new THREE.Box3().setFromObject(o); };
const kids = (g, name) => g.children.filter((o) => o.name === name);
const drop = (why, ...os) => { const n = os.filter(Boolean); n.forEach((o) => o.parent?.remove(o)); if (n.length) console.log(`left out (${why}): ${n.map((o) => o.name).join(", ")}`); };
// the cauliflower's tilted leaves are baked into their meshes, so the box each mesh records is its true size (a tilted
// leaf's recorded box reaches 8 mm under the vegetable box's floor though the leaf itself doesn't)
{
  const c = trays.getObjectByName("Cauliflower");
  c?.children.filter((o) => o.isMesh && o.name !== "Curd").forEach((o) => { o.updateMatrix(); o.geometry = o.geometry.clone().applyMatrix4(o.matrix); o.position.set(0, 0, 0); o.rotation.set(0, 0, 0); o.scale.set(1, 1, 1); });
}
// the vegetable box is 355 mm deep inside: the 341 mm drumsticks are centred in it so they clear its front and back;
// the coriander and curry leaves find no steady spot on the heap under the cover and are left out
{
  const v = trays.getObjectByName("FreshZoneStock");
  kids(v, "Drumstick").forEach((o) => { const b = bbox(o); o.position.z += vbZ - (b.min.z + b.max.z) / 2; });
  drop("no steady spot under the cover", ...kids(v, "Coriander"), ...kids(v, "CurryLeaves"));
}
// one row across [x0, x1] with its back at z0, items dropped from its end until 6 mm stays between them; returns its depth
function row(items, x0, x1, z0, why) {
  items = items.filter(Boolean);
  let bs = items.map(bbox);
  const need = () => bs.reduce((s, b) => s + b.max.x - b.min.x, 0) + 0.006 * (items.length + 1);
  while (items.length > 1 && need() > x1 - x0) { drop(why, items.pop()); bs.pop(); }
  const w = bs.reduce((s, b) => s + b.max.x - b.min.x, 0), gap = (x1 - x0 - w) / (items.length + 1);
  let x = x0 + gap, dep = 0;
  items.forEach((o, i) => { const b = bs[i], dx = x - b.min.x, dz = z0 - b.min.z; o.position.x += dx; o.position.z += dz; o.userData.moved = [dx, dz]; x += b.max.x - b.min.x + gap; dep = Math.max(dep, b.max.z - b.min.z); });
  return dep;
}
// rows from the back; a row that would pass z1 is left out whole
function rows(list, x0, x1, z0, z1, why) {
  let z = z0;
  for (const r of list) {
    const items = r.filter(Boolean);
    if (!items.length) continue;
    const d = Math.max(...items.map((o) => { const b = bbox(o); return b.max.z - b.min.z; }));
    if (z + d > z1) { drop(why, ...items); continue; }
    z += row(items, x0, x1, z, why) + 0.012;
  }
}
{
  const hw = inW / 2 - 0.03, z0 = zIn + 0.022, z1 = frontFridge - 0.015, why = "no room on its shelf";
  { // top shelf, 127 mm under the chiller tray: the biryani box, the milk pile and the buttermilk; the tiffin and the
    // batter pouch are too tall
    const g = trays.getObjectByName("Shelf1Stock");
    drop("too tall for the top shelf", g.getObjectByName("Tiffin"), g.getObjectByName("IdBatterPouch1"));
    const milk = g.getObjectByName("NandiniMilk"), pile = ["AavinMilk", "AmulTaazaPouch"].map((n) => g.getObjectByName(n)).filter(Boolean);
    rows([[g.getObjectByName("RnrBiryaniBox"), milk, g.getObjectByName("MastiButtermilk")]], -hw, hw, z0 + 0.02, z1, why);
    const [dx, dz] = milk.userData.moved || [0, 0];
    pile.forEach((o) => { o.position.x += dx; o.position.z += dz; });
  }
  { // middle shelf: the coconut and the melon, the takeaway tubs in front
    const g = trays.getObjectByName("Shelf2Stock");
    rows([[g.getObjectByName("CoconutHalf"), g.getObjectByName("WatermelonHalf")], [g.getObjectByName("NandhanaPalace"), g.getObjectByName("NandhanaPalace2"), g.getObjectByName("RnrBiryani")]], -hw, hw, z0, z1, why);
  }
  { // the crisper's cover: bananas, grapes and apples, then oranges and lemons
    const g = trays.getObjectByName("Shelf3Stock");
    const ap = kids(g, "Apple"), or = kids(g, "Orange"), le = kids(g, "Lemon");
    drop("left for room", g.getObjectByName("AmulMastiDahi"));
    rows([[g.getObjectByName("Bananas"), g.getObjectByName("Grapes"), ap[0]], [ap[1], ap[2], ap[3], or[0], or[1]], [or[2], le[0], le[1], ap[4]]], -hw, hw, z0, z1, why);
  }
}
// the third shelf is the crisper's cover: it sits on the cabinet, not in the trays, so its stock stays when the trays
// come out
{ const s3g = trays.getObjectByName("Shelf3Stock"); if (s3g) cab.attach(s3g); }
// what is too tall for the space over its shelf, or reaches past the shelf's sides or front, is left out
{
  const shw = inW / 2 - 0.03;
  const over = { Shelf1Stock: ctBot - 0.012, Shelf2Stock: s1 - 0.0145 - 0.01, Shelf3Stock: s2 - 0.0145 - 0.01 };
  for (const [n, top] of Object.entries(over)) leaveOut(root.getObjectByName(n), [B3(-1, 0, frontFridge - 0.014, 1, 2, 1), B3(-1, 0, -1, -shw - 0.003, 2, 1), B3(shw + 0.003, 0, -1, 1, 2, 1), B3(-1, top, -1, 1, 3, 1)], `too tall for ${n}'s space, or past its sides or front`);
}
// the chiller tray: butter, cheese and curd cups
stock.fresh0(trays, { y: ctBot + 0.004, z: ctZ, bx: ctCX - 0.15, cx: ctCX + 0.06, ex: ctCX - 0.035 });
// the freezer: the two tubs stacked and the frozen packs beside them; it has no shelf
stock.freezer(cab, { fit: true, zIn1: zIn, floor: fbBot + wt, top: fbTop, box: { hw: inW / 2 - 0.008, z0: zIn + 0.02, z1: fbZ1 - 0.02 } });
{
  const f = cab.getObjectByName("FreezerStock");
  cab.getObjectByName("OnFreezerShelf")?.removeFromParent();
  leaveOut(f, [B3(-1, fbTop - 0.006, -1, 1, 3, 1), B3(-1, 0, fbZ1 - 0.016, 1, 3, 1), B3(xR - 0.003, 0, -1, 1, 3, 1), B3(-1, 0, -1, xL + 0.003, 3, 1)], "past the freezer box");
}

// ── the door: hinged on the right; a PET front with rounded sides, an arched top that falls back to the door's back,
// the bar handle over its pocket with the lock in its foot ──
const SK = { a: 0.065, b: 0.03, at: 0.045, bt: 0.035, ab: 0.004, bb: 0.004, rc: 0.04 };
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
    const yArch = y * (1 - (ARCH / h) * (2 * x / w) ** 2);
    pos.push(x, yArch, t - fall); uv.push((x + w / 2) / w, (h - y) / h);
  }
  for (let j = 0; j < ny - 1; j++) for (let i = 0; i < nx - 1; i++) { const a = j * nx + i; idx.push(a, a + 1, a + nx + 1, a, a + nx + 1, a + nx); }
  for (let i = 0; i < nx; i++) ring.push(i);
  for (let j = 1; j < ny; j++) ring.push(j * nx + nx - 1);
  for (let i = nx - 2; i >= 0; i--) ring.push((ny - 1) * nx + i);
  for (let j = ny - 2; j > 0; j--) ring.push(j * nx);
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2)); g.setIndex(idx); g.computeVertexNormals();
  return { geo: g, ring: ring.map((k) => [pos[3 * k], pos[3 * k + 1], pos[3 * k + 2]]) };
}
// the band round the door from the face's outline back to the door's back; the top falls 32 mm towards the back
function doorBand(ring, h) {
  const back = ([x, y]) => [x, y - TOPBACK * Math.min(1, Math.max(0, (y - (h - SK.rc - 0.06)) / (SK.rc + 0.06))), 0];
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
  // the LG mark, 53 mm wide, its middle at the door's middle, 103 mm under the top (front photo); no energy label: the
  // only one LG and Sangeetha show for this model is the 2023-25 series, which ended on 31 Dec 2025 (NOTES.md)
  fridgeDoor.add(plane("LgMarkDecal", 0.053, 0.053 / C.lgmark_aspect, logoM, -pw + 0.498 * pw, dh - 0.089 * dh, T_ + 0.0008));
  // the handle: a chrome bar 41 mm wide, 462 mm long (front photo: 0.056 to 0.462 of the door down from its top), bowed
  // out to 32 mm proud of the face (LG's manual: 662 against 630 mm), its ends on the face; the lock's round chrome cap
  // in its foot
  const v0 = 0.056, v1 = 0.462, L = (v1 - v0) * dh, bw = 0.041, bt = 0.016, P = 0.032 - bt / 2;
  const sh = rrect(bw, bt, 0.007);
  let hg = new THREE.ExtrudeGeometry(sh, { depth: L, steps: 48, bevelEnabled: false, curveSegments: 4 });
  hg.deleteAttribute("uv"); hg.deleteAttribute("normal");
  hg = mergeVertices(hg);
  const zc = (s) => bt / 2 + (P - bt / 2) * Math.sqrt(Math.max(0, 1 - (s / (L / 2)) ** 2));
  const q = hg.attributes.position;
  for (let i = 0; i < q.count; i++) { const s = q.getZ(i) - L / 2; q.setXYZ(i, q.getX(i), s, q.getY(i) + zc(s)); }
  hg.computeVertexNormals();
  const hx = -pw + 0.142 * pw, hy = dh - (v0 + v1) / 2 * dh;
  fridgeDoor.add(mesh("HandleBar", hg, chrome, hx, hy, T_));
  const ls = (dh - 0.443 * dh) - hy, lz = T_ + zc(ls) + bt / 2;
  fridgeDoor.add(cyl("DoorLock", 0.0085, 0.0085, 0.003, chrome, hx, dh - 0.443 * dh, lz + 0.0012, 24).rotateX(Math.PI / 2));
  fridgeDoor.add(box("LockKeyhole", 0.0018, 0.008, 0.001, dark, hx, dh - 0.443 * dh, lz + 0.0031));
  // inside: the gasket, the liner, the baskets
  const lw = inW - 0.01, ly0 = floorIn - doorBot, ly1 = ceil - doorBot;
  fridgeDoor.add(box("GasketT", pw - 0.04, 0.016, 0.01, gasket, -pw / 2, ly1 + 0.012, -0.005));
  fridgeDoor.add(box("GasketB", pw - 0.04, 0.016, 0.01, gasket, -pw / 2, 0.012, -0.005));
  fridgeDoor.add(box("GasketL", 0.016, ly1 + 0.004 - 0.02, 0.01, gasket, -pw + 0.028, (ly1 + 0.024) / 2, -0.005));
  fridgeDoor.add(box("GasketR", 0.016, ly1 + 0.004 - 0.02, 0.01, gasket, -0.028, (ly1 + 0.024) / 2, -0.005));
  fridgeDoor.add(box("DoorLiner", lw, ly1 - ly0 - 0.004, 0.012, liner, -pw / 2, (ly0 + ly1) / 2, -linerFace + 0.006));
}
// baskets: the hinge side (x near 0) is the left one on LG's open photo
const bkW = inW - 0.02, half = (bkW - 0.01) / 2, xHinge = -pw / 2 + (bkW - half) / 2, xFree = -pw / 2 - (bkW - half) / 2;
const addBasket = (n, w, b, x) => { const k = basket(n, w, b.d, b.h); k.position.x = x; k.position.y = b.y; fridgeDoor.add(k); };
addBasket("EggBasket", half, BK.eggs, xHinge);
addBasket("TopBasket", half, BK.top, xFree);
addBasket("MidBasket", half, BK.second, xHinge);
addBasket("WideBasket", bkW, BK.wide, -pw / 2);
addBasket("BottleBasket", bkW, BK.bottle, -pw / 2);
// the egg cups under the egg basket's floor (MZ-04: four cups across)
const eggX = [0, 1, 2, 3].map((i) => xHinge - 0.078 + i * 0.052);
fridgeDoor.add(box("EggCupsRib", half - 0.02, 0.006, 0.05, clearRib, xHinge, BK.eggs.y + 0.007, -linerFace - BK.eggs.d / 2));
{
  // the jar row goes in the top basket on the door's free half; the bottles and cartons in the wide basket; the cans
  // in the bottle basket
  const inside = (dep) => dep === BK.top.d ? [xFree - half / 2 + 0.006, xFree + half / 2 - 0.006, -(linerFace + dep / 2)] : [-pw / 2 - bkW / 2 + 0.006, -pw / 2 + bkW / 2 - 0.006, -(linerFace + dep / 2)];
  const deps = { egg: BK.eggs.d, jar: BK.top.d, bottle: BK.wide.d, can: BK.bottle.d };
  stock.doorFridge(fridgeDoor, { fit: true, eggY: BK.eggs.y, eggX, jarY: BK.top.y, botY: BK.wide.y, canY: BK.bottle.y, deps, inside });
}
// the jar row in the top basket, which is half the door wide and 69 mm deep inside its rim: laid again across it,
// a jar deeper than that or past the row's end is left out
{
  const inD = BK.top.d - 0.006, zc = zDoor - linerFace - inD / 2;
  const all = ["AavinGhee", "NandiniGhee", "SakthiSambar", "MothersPickle", "MothersPickle2"].map((n) => fridgeDoor.getObjectByName(n)).filter(Boolean);
  const deep = all.filter((o) => { const b = bbox(o); return b.max.z - b.min.z > inD + 0.0005; });
  drop("deeper than the top basket", ...deep);
  const jars = all.filter((o) => !deep.includes(o));
  // the door has no parent yet: its world x is W/2 on from its own
  row(jars, W / 2 + xFree - half / 2 + 0.006, W / 2 + xFree + half / 2 - 0.006, 0, "no room in the top basket");
  jars.filter((o) => o.parent).forEach((o) => { const b = bbox(o); o.position.z += zc - (b.min.z + b.max.z) / 2; });
}
root.add(fridgeDoor);

const parts = productParts(PRODUCTS, ID);
const clips = stateClips(root, parts);
saveZones(PRODUCTS, ID, root, parts);
const textures = {
  DoorFace: `${T}/door_shiny_steel.jpg`, RearPlate: `${T}/rear.jpg`, LgMark: `${T}/lgmark_dark.png`, PanelFace: `${T}/panel.jpg`,
  Print_fastfreeze: `${T}/print_fastfreeze.png`,
};
Object.assign(textures, stock.textures());
{ const used = new Set(); root.traverse((o) => o.isMesh && [].concat(o.material).forEach((m) => used.add(m.name))); for (const k of Object.keys(textures)) if (!used.has(k)) delete textures[k]; }
// Grain: the steel door the soft hairline up the door with a clear coat; the painted cabinet a soft peel. Decals,
// prints and the panel carry none.
await exportGLB(root, clips, OUT, textures, { dir: `${TEX}/grain`, materials: {
  DoorFace: { type: "hairline_soft", dir: "v", clearcoat: [0.6, 0.22] },
  SidePaint: { type: "peel_soft" }, TopPaint: { type: "peel_soft" },
} });
console.log("wrote", OUT, (fs.statSync(OUT).size / 1048576).toFixed(2), "MB");
