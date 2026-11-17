// Haier HRD-2103PMG-P, 190 L 3 star direct-cool single door with a base drawer and a glass door, in the two glass colours
// Haier India shows on this same body: Mirror Glass (HRD-2103PMG-P, the listed one, the default) and Wave Glass
// (HRD-2103PWG-P). One body, so one GLB with the colours as KHR_materials_variants. The printed-steel HRD-2103 codes
// (external chrome handle, a different drawer front), the Spiral Glass (a box stand, 628 mm deep) and the Nickel Steel
// (1218 mm tall, no drawer) are other bodies and are not built here (the private research notes say why, code by code).
// Built to Haier India's published size, 530 W x 1313 H x 570 D mm. Haier's straight-on front is read at 0.670 px per mm
// (the body's 354 px), its rear at 0.679 and its open photo (Wave Glass) at 0.670 with the inside 3% further off. Every
// number and how it was got is in the private research notes (NOTES.md).
// What it is: a cabinet on a grey stand with arched legs whose front is the base drawer (glass faced, flush with the door);
// one flat glass door hinged on the right, the recess handle a groove down its left side and the round lock low on that
// side; inside, the freezer box behind a frosted flap hinged at its top (FREEZEZONE printed on it), the control panel
// with its dial and the LED lamp right of it, the vent slots over it, the chiller tray under it, three toughened glass
// shelves (Haier: "3 Toughened Glass Shelves"), the vegetable case under its cover; in the door five pockets: the top one,
// two half pockets side by side on a moulded rib, one half pocket on the hinge side, the big pocket and the bottle pocket.
// The shelves, the chiller tray and the vegetable case come out with their food (FridgeTrays).
// Stocked for a south Indian kitchen; the base drawer with onions and potatoes as in Haier's photo of it.
// usage: node make_haier_hrd2103.mjs <entry .json, never products.json> <tex dir> <out.glb>
import fs from "node:fs";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { NodeIO } from "@gltf-transform/core";
import { ALL_EXTENSIONS, KHRMaterialsVariants, KHRMaterialsClearcoat } from "@gltf-transform/extensions";
import { THREE, mat, mesh, box, faced, group, flipV, stateClips, exportGLB, productParts, saveZones } from "./lib.mjs";
import { LGStock } from "./stock_lg.mjs";

const [PRODUCTS, TEX, OUT] = process.argv.slice(2);
const ID = "haier-hrd-2103pmg-p";
const T = `${TEX}/haier_hrd2103`;
const C = JSON.parse(fs.readFileSync(`${T}/colours.json`, "utf8"));

// ── size (metres) ──
const W = 0.530, H = 1.313, D = 0.570;                 // Haier India: 530 x 570 x 1313 mm (W x D x H)
const zB = -D / 2;
const zFront = zB + 0.485;                             // the cabinet's front (ESTIMATED: the 3/4 views draw the door 0.156 of the depth)
const zDoor = zFront + 0.008;                          // the door's back (ESTIMATED: an 8 mm gasket gap)
const zFace = D / 2;                                   // the door's glass face and the drawer's front, flush (3/4 views)
const T_ = zFace - zDoor;                              // the door, 77 mm
const cabTop = 1.300;                                  // the cabinet's top (open photo: 9 mm under the door's top)
const standTop = 0.150, standBackTop = 0.131;          // the stand under the cabinet; its back is lower (rear photo: 131 mm)
const doorBot = 0.140, doorTop = H, dh = doorTop - doorBot;   // front: the door rows 160-943 (140 mm up to the top)
const drBot = 0.006, drTop = 0.106;                    // the drawer's front (front: rows 966-1037; 6 mm off the floor ESTIMATED)
const wall = 0.028, inW = W - 2 * wall;                // open photo: the cavity 474 mm wide
const floorIn = 0.180, ceil = 1.285;                   // the cavity's floor and ceiling (open photo)
const zIn = zB + 0.05;                                 // the cavity's back (ESTIMATED: a 50 mm back wall)
const bayTop = 0.374, bayD = 0.12;                     // the compressor bay (rear photo: open to 374 mm; its depth ESTIMATED)
const stepTop = bayTop + 0.03, stepZ = zB + bayD + 0.03;   // the hump the bay makes in the cavity's back (ESTIMATED)
// inside, off the empty open photo (Haier's Wave Glass gallery, the same body)
const fbBot = 1.081, fbTop = 1.264, fbX0 = -0.225, fbX1 = 0.221;   // the freezer box
const flX0 = -0.191, flX1 = 0.171, flY0 = 1.104, flY1 = 1.240;     // its frosted flap
const pnX0 = 0.171;                                    // the control panel, right of the flap
const ctBot = 1.009, ctTop = 1.078;                    // the chiller tray
const s1 = 0.858, s2 = 0.732, s3 = 0.604;              // the three glass shelves' tops
const coverY = 0.443;                                  // the vegetable case's cover
const vbBot = 0.202, vbTop = 0.432;                    // the vegetable case
// the door: its liner stands 25 mm into the cabinet; the pockets hang off it (open photo: floors and wall heights,
// measured up from the door's foot; depths ESTIMATED)
const pw = W - 0.002, rC = 0.02;                       // the door's top corners rounded 20 mm (front)
const linerFace = 0.025;
const BK = {
  top: { y: 1.016, d: 0.08, h: 0.094 },
  half: { y: 0.836, d: 0.07, h: 0.056 },               // two side by side on the rib
  halfL: { y: 0.662, d: 0.07, h: 0.054 },              // one, on the hinge side
  big: { y: 0.330, d: 0.085, h: 0.133 },
  bottle: { y: 0.048, d: 0.09, h: 0.121 },
};
const zLiner = zDoor - linerFace;
const frontFridge = zLiner - BK.bottle.d - 0.012;      // shelves and boxes stop short of the deepest pocket
const fbZ1 = zLiner - BK.top.d - 0.03;                 // the freezer box's front, 30 mm short of the top pocket
const ctZ1 = zLiner - BK.half.d - 0.012;               // the chiller tray's front, short of the half pockets

// ── the colours ──
// door: the glass's print (door_<slug>.jpg) and finish; edge: the door's painted sides; side, top: the cabinet; stand:
// the stand's plastic; drawer: the drawer's glass front. Read off each colour's photos by tex_haier_hrd2103.py.
const rgb = (a) => (a[0] << 16) | (a[1] << 8) | a[2];
// the glass's finish, tuned on renders at the page's -28 deg view and from the front against Haier's photos: a full clear
// coat (1.0 / 0.04) laid a milky veil over both doors at -28 deg (the mirror 220 against Haier's 148-170 grey, the print
// washed out); a light coat keeps the gloss: the mirror renders 160 at -28 deg and 170 from the front (Haier 148-170 and 166)
const GLASS = {
  mirror_glass: { metal: 0.15, rough: 0.35, coat: [0.3, 0.1] },
  wave_glass: { metal: 0.3, rough: 0.5, coat: [0.15, 0.2] },
};
const FIN = [["mirror_glass", "Mirror Glass", "HRD-2103PMG-P"], ["wave_glass", "Wave Glass", "HRD-2103PWG-P"]].map(([slug, name, code]) => {
  const c = C.colours[slug];
  return { slug, name, variant: name, code, edge: rgb(c.edge), side: rgb(c.side), top: rgb(c.side), stand: rgb(c.stand), drawer: rgb(c.drawer), door: GLASS[slug] };
});
const F0 = FIN[0];

// ── materials ──
const doorFace = mat("DoorFace", 0xffffff, { metal: F0.door.metal, rough: F0.door.rough });
const doorEdge = mat("DoorEdge", F0.edge, { metal: 0.3, rough: 0.45 });
const glassEdge = mat("GlassEdge", 0xc5cacd, { metal: 0.8, rough: 0.3 });
const sidePaint = mat("SidePaint", F0.side, { metal: 0.3, rough: 0.45 });
const topPaint = mat("TopPaint", F0.top, { metal: 0.15, rough: 0.6 });
const standM = mat("StandPlastic", F0.stand, { rough: 0.55 });
const standFront = mat("StandFront", F0.drawer, { metal: F0.door.metal, rough: F0.door.rough });
const markM = mat("HaierMark", 0xffffff, { rough: 0.45, opacity: 0.999 });
const flapPrint = mat("Print_freezer", 0xffffff, { rough: 0.4, opacity: 0.999 });
const rearM = mat("RearPlate", 0xffffff, { metal: 0.3, rough: 0.55 });
const bayM = mat("Bay", 0xffffff, { rough: 0.7 });
const bayDark = mat("BayDark", 0x141518, { rough: 0.85 });
const chrome = mat("Chrome", 0xd4d7db, { metal: 1, rough: 0.14 });
const dark = mat("DarkPlastic", 0x1d1e21, { rough: 0.7 });
const hingeM = mat("HingeCover", 0x2a2b2e, { rough: 0.55 });
const binM = mat("DrawerBasket", 0x6c6f73, { rough: 0.6 });                  // the drawer's grey basket (Haier's photo)
const liner = mat("Liner", 0xf1f3f5, { rough: 0.6 });
const linerSide = mat("LinerSide", 0xe4e8ec, { rough: 0.65 });
const linerDk = mat("LinerGrey", 0xd5d9de, { rough: 0.6 });
const gasket = mat("Gasket", 0x8d9196, { rough: 0.85 });
const white = mat("WhitePlastic", 0xf6f7f8, { rough: 0.45 });
const clear = mat("ClearPlastic", 0xd3e0ea, { rough: 0.12, opacity: 0.5, side: THREE.DoubleSide });
const clearLight = mat("ClearPlasticLight", 0xe3ebf2, { rough: 0.12, opacity: 0.26, side: THREE.DoubleSide });
const clearRib = mat("ClearRib", 0xeef4fa, { rough: 0.3, opacity: 0.92 });
const flapM = mat("FlapClear", 0xe4e9ee, { rough: 0.35, opacity: 0.62, side: THREE.DoubleSide });   // frosted (open photo)
const frosted = mat("Frosted", 0xe6eef6, { rough: 0.45, opacity: 0.8 });
const glass = mat("TemperedGlass", 0xa9cdd6, { rough: 0.05, opacity: 0.55, side: THREE.DoubleSide });
const glassRim = mat("ShelfRim", 0xe3e7ea, { rough: 0.45 });
const lampM = mat("LedLamp", 0xffffff, { emissive: 0xf4f8ff, emissiveIntensity: 1.5 });
const evapM = mat("FreezerWall", 0xdfe3e8, { metal: 0.3, rough: 0.45 });
const cordM = mat("Cord", 0x2b2d31, { rough: 0.6 });
const plugM = mat("Plug", 0x2f3135, { rough: 0.5 });
const pinM = mat("Pin", 0xb7bbc0, { metal: 0.9, rough: 0.3 });
const stock = LGStock({ T3: `${TEX}/lg_glt3426`, TF: `${TEX}/food`, BR: `${TEX}/brands`, BRT: `${TEX}/brands/small` });

// ── small builders ──
const cyl = (name, rt, rb, h, m, x, y, z, seg = 16) => mesh(name, new THREE.CylinderGeometry(rt, rb, h, seg), m, x, y, z);
const plane = (name, w, h, m, x, y, z) => mesh(name, flipV(new THREE.PlaneGeometry(w, h)), m, x, y, z);
function flipFaces(geo) {
  if (!geo.index) geo.setIndex([...Array(geo.attributes.position.count).keys()]);
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
// a rounded-top outline, centred on x, from y 0 to h (counter-clockwise)
function topRounded(w, h, r) {
  const s = new THREE.Shape();
  s.moveTo(-w / 2, 0); s.lineTo(w / 2, 0); s.lineTo(w / 2, h - r); s.quadraticCurveTo(w / 2, h, w / 2 - r, h);
  s.lineTo(-w / 2 + r, h); s.quadraticCurveTo(-w / 2, h, -w / 2, h - r); s.lineTo(-w / 2, 0);
  return s;
}
// a shape's flat face with UVs over its box (glTF: v down from the top)
function flat(shape, w, h, seg = 8) {
  const g = new THREE.ShapeGeometry(shape, seg), p = g.attributes.position, uv = g.attributes.uv;
  for (let i = 0; i < p.count; i++) uv.setXY(i, (p.getX(i) + w / 2) / w, (h - p.getY(i)) / h);
  return g;
}
// only the sides of a shape pushed back `depth` (its caps are made apart)
function sidesOf(shape, depth, seg = 8) {
  const g = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: false, curveSegments: seg }), s = g.groups[1], out = new THREE.BufferGeometry();
  for (const k of ["position", "normal", "uv"]) { const a = g.attributes[k]; out.setAttribute(k, new THREE.Float32BufferAttribute(a.array.slice(s.start * a.itemSize, (s.start + s.count) * a.itemSize), a.itemSize)); }
  return out;
}
// a rounded-ended slot, w x h, lying in its own x-y plane
function pill(w, h) {
  const r = Math.min(w, h) / 2, s = new THREE.Shape();
  s.moveTo(-w / 2, -h / 2 + r); s.absarc(0, -h / 2 + r, r, Math.PI, 2 * Math.PI, false); s.lineTo(w / 2, h / 2 - r); s.absarc(0, h / 2 - r, r, 0, Math.PI, false); s.lineTo(-w / 2, -h / 2 + r);
  return new THREE.ShapeGeometry(s, 8);
}
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
// the stand's legs: an outline from a to b along the floor, legs 84 mm wide at the floor, a 22 mm chamfer up to the
// arch's 47 mm (rear photo; the sides drawn the same, ESTIMATED from the 3/4 views)
function legs(a, b, top) {
  const s = new THREE.Shape();
  s.moveTo(a, 0); s.lineTo(a + 0.084, 0); s.lineTo(a + 0.106, 0.047); s.lineTo(b - 0.106, 0.047); s.lineTo(b - 0.084, 0); s.lineTo(b, 0); s.lineTo(b, top); s.lineTo(a, top); s.lineTo(a, 0);
  return s;
}

const root = group("HaierHRD2103");
const cab = group("Cabinet");
root.add(cab);

// ── the stand: its sides and back with the arched legs, its floor and deck; the front is the drawer (below) ──
{
  const ext = (sh, d) => new THREE.ExtrudeGeometry(sh, { depth: d, bevelEnabled: false });
  for (const sx of [-1, 1]) {
    const g = ext(legs(zB, zFront, standTop), 0.012).rotateY(-Math.PI / 2);     // the outline's x along z, pushed to -x
    g.translate(sx > 0 ? W / 2 : -W / 2 + 0.012, 0, 0);
    cab.add(mesh("StandSide", g, standM));
  }
  cab.add(mesh("StandBack", ext(legs(-W / 2 + 0.012, W / 2 - 0.012, standBackTop), 0.008).translate(0, 0, zB), standM));
  cab.add(box("StandFloor", W - 0.024, 0.005, zFront - zB - 0.06, dark, 0, 0.02, (zFront + zB) / 2 + 0.02));
  const zd = zB + bayD + 0.01;
  cab.add(box("StandDeck", W - 0.024, 0.006, zFront - zd, standM, 0, standTop - 0.003, (zFront + zd) / 2));
  cab.add(box("BayFloor", W - 0.024, 0.004, bayD - 0.008, bayDark, 0, standBackTop - 0.002, zB + 0.008 + (bayD - 0.008) / 2));
  // the dark fascia behind the gap between the door and the drawer (front: rows 943-966)
  cab.add(box("StandFascia", W - 0.024, standTop - drTop + 0.004, 0.012, dark, 0, (standTop + drTop - 0.004) / 2, zFront - 0.006));
}

// ── cabinet shell ──
const shellH = cabTop - standTop, shellMid = standTop + shellH / 2, Dc = zFront - zB, zMid = (zFront + zB) / 2;
// each side wall is one box, its upright faces split at the cavity's ceiling; the inner face above it takes the top's paint
function sideWall(name, mats, inner, x) {
  const g = new THREE.BoxGeometry(wall, shellH, Dc, 1, 2, 1), q = g.attributes.position, cut = ceil - shellMid;
  for (let i = 0; i < q.count; i++) if (Math.abs(q.getY(i)) < 1e-9) q.setY(i, cut);
  const k = g.groups[inner];
  g.groups.splice(inner, 1, { start: k.start, count: 6, materialIndex: 6 }, { start: k.start + 6, count: 6, materialIndex: k.materialIndex });
  return mesh(name, g, [...mats, topPaint], x, shellMid, zMid);
}
cab.add(sideWall("SideLeft", [linerSide, sidePaint, topPaint, standM, sidePaint, dark], 0, -W / 2 + wall / 2));
cab.add(sideWall("SideRight", [sidePaint, linerSide, topPaint, standM, sidePaint, dark], 1, W / 2 - wall / 2));
cab.add(faced("Top", inW, cabTop - ceil, Dc, [topPaint, topPaint, topPaint, liner, sidePaint, dark], 0, (cabTop + ceil) / 2, zMid));
cab.add(faced("Base", inW, floorIn - standTop, zFront - stepZ, [liner, liner, liner, standM, sidePaint, dark], 0, standTop + (floorIn - standTop) / 2, (zFront + stepZ) / 2));
cab.add(faced("BackWall", inW, ceil - stepTop, zIn - zB - 0.003, [liner, liner, liner, liner, liner, dark], 0, (ceil + stepTop) / 2, (zIn + zB + 0.003) / 2));
cab.add(faced("Hump", inW, stepTop - bayTop, stepZ - zB - 0.003, [liner, liner, liner, bayDark, liner, dark], 0, (stepTop + bayTop) / 2, (stepZ + zB + 0.003) / 2));
cab.add(faced("HumpFront", inW, bayTop - floorIn, 0.03, [liner, liner, liner, liner, liner, bayDark], 0, (bayTop + floorIn) / 2, stepZ - 0.015));
// the back: Haier's rear photo (the embossed back), 3.2 mm narrower than the body so the exporter's 0.8 mm separation
// keeps the published width
cab.add(mesh("RearPlate", flipV(new THREE.BoxGeometry(W - 0.0032, cabTop - bayTop - 0.0016, 0.003)), [dark, dark, dark, dark, dark, rearM], 0, (cabTop + bayTop) / 2, zB + 0.0015));
// the open bay: the compressor and its tray photographed on its back wall, dark walls and ceiling
{
  const bw = W - 2 * wall, bh = bayTop - standBackTop;
  cab.add(mesh("BayBack", flipV(new THREE.BoxGeometry(bw, bh, 0.01)), [liner, liner, liner, liner, liner, bayM], 0, standBackTop + bh / 2, zB + bayD + 0.005));
  cab.add(box("BayCeiling", bw, 0.006, bayD, bayDark, 0, bayTop - 0.003, zB + bayD / 2));
}
// hinges on the right: the dark cover on the cabinet's top behind the door (3/4 views; its size ESTIMATED) and the bottom
// bracket in the gap under the door's right corner
cab.add(box("HingeCoverTop", 0.06, 0.012, 0.05, hingeM, W / 2 - 0.035, cabTop + 0.006, zFront - 0.03));
cab.add(box("HingeBottom", 0.04, 0.004, 0.075, chrome, W / 2 - 0.022, doorBot - 0.004, zFront + 0.036));
// the power cord: Haier's rear photo shows it coiled at the bay's side (the fridge's right seen from the front); it runs
// from the connector into a tied coil of three loops hung inside the open bay, the plug under it, all within the body
// (route and coil ESTIMATED); cord 8 mm, plug 45 x 42 x 16 mm
{
  const V = (x, y, z) => new THREE.Vector3(x, y, z);
  const x0 = W / 2 - 0.054, cx = W / 2 - 0.1, cy = 0.255, rr = 0.04, cz = zB + 0.03, pitch = 0.008;
  const pts = [V(x0, 0.335, zB + bayD - 0.005), V(x0 - 0.01, 0.31, zB + 0.07), V(cx + 0.012, cy + rr + 0.004, cz - 0.002)];
  for (let i = 0; i <= 36; i++) { const t = i / 12, a = Math.PI / 2 + 2 * Math.PI * t; pts.push(V(cx + rr * Math.cos(a), cy + rr * Math.sin(a), cz + pitch * t)); }
  const py = cy - rr - 0.03, pz = cz + 3 * pitch / 2;
  pts.push(V(cx + 0.004, cy - rr - 0.012, pz), V(cx, py + 0.004, pz));
  cab.add(mesh("PowerCord", new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts, false, "centripetal"), 260, 0.004, 6, false), cordM));
  cab.add(box("CordTie", 0.006, 0.014, 0.034, white, cx, cy - rr, cz + 1.5 * pitch));
  const sh = new THREE.Shape(), w = 0.045, h = 0.042, r = 0.012;
  sh.moveTo(-w / 2 + r, -h / 2); sh.lineTo(w / 2 - r, -h / 2); sh.quadraticCurveTo(w / 2, -h / 2, w / 2, -h / 2 + r);
  sh.lineTo(w / 2, h / 2 - r); sh.quadraticCurveTo(w / 2, h / 2, w / 2 - r, h / 2); sh.lineTo(-w / 2 + r, h / 2);
  sh.quadraticCurveTo(-w / 2, h / 2, -w / 2, h / 2 - r); sh.lineTo(-w / 2, -h / 2 + r); sh.quadraticCurveTo(-w / 2, -h / 2, -w / 2 + r, -h / 2);
  const plug = mesh("Plug", new THREE.ExtrudeGeometry(sh, { depth: 0.016, bevelEnabled: true, bevelSize: 0.002, bevelThickness: 0.002, bevelSegments: 2, curveSegments: 8 }), plugM, cx, py, pz);
  plug.rotation.x = Math.PI / 2;
  cab.add(plug);
  for (const [dx, dz] of [[0, 0.0105], [-0.0095, -0.0065], [0.0095, -0.0065]]) cab.add(cyl("PlugPin", 0.0026, 0.0026, 0.016, pinM, cx + dx, py - 0.016 - 0.002 - 0.008, pz + dz, 10));
}

// ── inside: the vent plate, the freezer box, its flap, the control panel ──
const wt = 0.008;
cab.add(box("VentPlate", inW, ceil - fbTop, fbZ1 - zIn, white, 0, (ceil + fbTop) / 2, (fbZ1 + zIn) / 2));
// six vent slots over the box (open photo)
cab.add(mesh("VentSlots", mergeGeometries([...Array(6)].map((_, i) => new THREE.BoxGeometry(0.026, 0.005, 0.002).translate(-0.17 + i * 0.062, (ceil + fbTop) / 2, fbZ1 + 0.001))), dark));
{
  const zc = (zIn + fbZ1) / 2, d = fbZ1 - zIn, h = fbTop - fbBot;
  cab.add(box("FreezerBoxFloor", fbX1 - fbX0, wt, d, white, (fbX0 + fbX1) / 2, fbBot + wt / 2, zc));
  for (const [n, x] of [["FreezerBoxL", fbX0 + wt / 2], ["FreezerBoxR", pnX0 - wt / 2]]) cab.add(box(n, wt, h, d, white, x, (fbBot + fbTop) / 2, zc));
  cab.add(box("FreezerBack", pnX0 - fbX0 - 2 * wt, h - wt, 0.004, evapM, (fbX0 + pnX0) / 2, (fbBot + fbTop + wt) / 2, zIn + 0.002));
  cab.add(box("FreezerFloorPlate", pnX0 - fbX0 - 2 * wt, 0.003, d - 0.03, evapM, (fbX0 + pnX0) / 2, fbBot + wt + 0.0015, zc - 0.01));
  // the frame round the flap
  cab.add(box("FreezerFrameL", flX0 - fbX0, h, 0.012, white, (fbX0 + flX0) / 2, (fbBot + fbTop) / 2, fbZ1 - 0.006));
  cab.add(box("FreezerFrameTop", pnX0 - flX0, fbTop - flY1, 0.012, white, (flX0 + pnX0) / 2, (fbTop + flY1) / 2, fbZ1 - 0.006));
  cab.add(box("FreezerFrameBot", pnX0 - flX0, flY0 - fbBot, 0.012, white, (flX0 + pnX0) / 2, (fbBot + flY0) / 2, fbZ1 - 0.006));
  // the control panel: white, the dial at the top (36 mm across), the LED lamp under it (open photo; its sticker,
  // unreadable in every photo, is left off)
  const pcx = (pnX0 + fbX1) / 2;
  cab.add(box("ControlPanel", fbX1 - pnX0, h, d, white, pcx, (fbBot + fbTop) / 2, zc));
  const k = cyl("TempDial", 0.018, 0.018, 0.012, white, 0.196, 1.201, fbZ1 + 0.007, 32);
  k.rotation.x = Math.PI / 2;
  cab.add(k);
  const kr = cyl("TempDialRing", 0.0185, 0.0185, 0.004, linerDk, 0.196, 1.201, fbZ1 + 0.002, 32);
  kr.rotation.x = Math.PI / 2;
  cab.add(kr);
  cab.add(box("DialRib", 0.004, 0.022, 0.005, linerDk, 0.196, 1.201, fbZ1 + 0.0145));
  cab.add(box("LampHousing", 0.036, 0.05, 0.006, white, 0.197, 1.117, fbZ1 + 0.003));
  cab.add(box("LedLampCover", 0.03, 0.044, 0.002, lampM, 0.197, 1.117, fbZ1 + 0.007));
}
// the flap: frosted, hinged along its top (it lifts up), FREEZEZONE printed on it left of the middle and a dark grip tab
// at its foot (open photo)
const flap = group("FreezerFlap");
cab.add(flap);
{
  const zF = fbZ1 + 0.006, x0 = flX0, x1 = flX1, y0 = flY0, y1 = flY1, cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
  flap.add(box("FlapPanel", x1 - x0 - 0.008, y1 - y0 - 0.008, 0.003, flapM, cx, cy, zF - 0.0015));
  flap.add(box("FlapRimT", x1 - x0, 0.006, 0.008, frosted, cx, y1 - 0.003, zF - 0.002));
  flap.add(box("FlapRimB", x1 - x0, 0.006, 0.008, frosted, cx, y0 + 0.003, zF - 0.002));
  flap.add(box("FlapRimL", 0.006, y1 - y0 - 0.012, 0.008, frosted, x0 + 0.003, cy, zF - 0.002));
  flap.add(box("FlapRimR", 0.006, y1 - y0 - 0.012, 0.008, frosted, x1 - 0.003, cy, zF - 0.002));
  const fw = C.flap.mm[0] / 1000 * C.flap.padded[0] / (C.flap.padded[0] - 2 * C.flap.pad), fh = fw * C.flap.padded[1] / C.flap.padded[0];
  flap.add(plane("PrintFreeze", fw, fh, flapPrint, 0.009, 1.169, zF + 0.0008));
  flap.add(box("FlapTab", 0.05, 0.01, 0.008, dark, cx, y0 + 0.008, zF + 0.004));
  // pivot on its top edge, at its face
  const pivot = new THREE.Vector3(0, y1, zF);
  for (const c of flap.children) c.position.sub(pivot);
  flap.position.copy(pivot);
}
// the drain spout on the back wall at the left (open photo: 909-958 mm)
cab.add(box("DrainCup", 0.03, 0.049, 0.025, white, -0.08, 0.9335, zIn + 0.0125));

// ── what comes out (FridgeTrays): the chiller tray, the glass shelves and the vegetable case ──
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
shelf("Shelf3", s3);
// the chiller tray: clear, across the cavity under the freezer box, its grip bar across the front
const ctZ0 = zIn + 0.012, ctW = inW - 0.012, ctX = 0, ctZ = (ctZ0 + ctZ1) / 2;
{
  const hh = ctTop - ctBot;
  trays.add(box("ChillFloor", ctW, 0.004, ctZ1 - ctZ0, clear, ctX, ctBot + 0.002, ctZ));
  for (const sx of [-1, 1]) trays.add(box("ChillSide", 0.004, hh, ctZ1 - ctZ0, clear, ctX + sx * (ctW / 2 - 0.002), ctBot + hh / 2, ctZ));
  trays.add(box("ChillBack", ctW, hh, 0.004, clear, ctX, ctBot + hh / 2, ctZ0 + 0.002));
  trays.add(box("ChillFront", ctW, hh * 0.7, 0.005, clearLight, ctX, ctBot + hh * 0.35, ctZ1 - 0.0025));
  trays.add(box("ChillGrip", 0.16, 0.006, 0.012, frosted, ctX, ctBot + hh * 0.7, ctZ1 - 0.002));
  for (const sx of [-1, 1]) cab.add(box("ChillRunner", 0.006, 0.006, ctZ1 - ctZ0, linerDk, ctX + sx * (ctW / 2 + 0.002), ctBot - 0.003, ctZ));
}
// the vegetable case's cover with its frosted front, and the case (FzBox* are the names qa_bounds reads); the case stops
// at the hump over the compressor bay
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

// ── the base drawer: its glass front flush with the door (3/4 views), the grey basket behind it inside the stand
// (Haier's photo shows it pulled out with onions and potatoes) ──
const drawer = group("BaseDrawer");
cab.add(drawer);
{
  const zb = zFront + 0.002, d = zFace - zb;
  drawer.add(faced("DrawerFront", W - 0.004, drTop - drBot, d, [standFront, standFront, binM, binM, standFront, binM], 0, (drTop + drBot) / 2, zb + d / 2));
}
const dbW = W - 0.05, dbZ0 = zB + bayD + 0.02, dbZ1 = zFront + 0.002, dbFloor = 0.024, dbTop = 0.1;
{
  const zc = (dbZ0 + dbZ1) / 2, d = dbZ1 - dbZ0;
  drawer.add(box("DrawerBinFloor", dbW, 0.004, d, binM, 0, dbFloor - 0.002, zc));
  for (const sx of [-1, 1]) drawer.add(box("DrawerBinSide", 0.004, dbTop - dbFloor + 0.004, d, binM, sx * (dbW / 2 - 0.002), (dbTop + dbFloor - 0.004) / 2, zc));
  // its back stands up to 130 mm, a stop so nothing falls off behind (ESTIMATED; hidden under the stand's deck, 14 mm
  // clear of it)
  drawer.add(box("DrawerBinBack", dbW, 0.13 - dbFloor + 0.004, 0.004, binM, 0, (0.13 + dbFloor - 0.004) / 2, dbZ0 + 0.002));
}

// ── stock: vegetarian South Indian food, eggs, juices, water and soft drinks (stock_lg.mjs, food.mjs) ──
stock.shelves(trays, {
  zIn1: zIn, inW, inD: frontFridge - zIn, s1: s1 - 0.0005, s2: s2 - 0.0005, s3: s3 - 0.0005, fz: vbBot + 0.004, fit: true, vz0: vbZ0 + 0.02, vk: 0.5,
  shelfB: { hw: inW / 2 - 0.03, z0: zIn + 0.022, z1: frontFridge - 0.015 },
  drawerB: { hw: vbW / 2 - 0.014, z0: vbZ0 + 0.02, z1: vbZ1 - 0.008, y0: vbBot + 0.004 },
  drawerCeil: coverY - 0.005 - 0.01 - (vbBot + 0.004),
});
const bbox = (o) => { o.updateWorldMatrix(true, true); return new THREE.Box3().setFromObject(o); };
if (process.env.H21_DUMP) for (const n of ["Shelf1Stock", "Shelf2Stock", "Shelf3Stock", "FreshZoneStock"]) {
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
  // the shelves are 280 mm deep to their rims (the door's bottle pocket stands in front of them), so each takes one deep
  // row at the back and, where there is room, a shallow one in front; the rest of stock_lg's layout is left out
  const zb = zIn + 0.027;                               // 2 mm clear of the drain spout on the back wall
  const only = (g, keep) => { const k = new Set(keep.filter(Boolean)); const gone = g.children.filter((o) => !k.has(o)); if (gone.length) console.log(`not on ${g.name} (no room on a 280 mm shelf): ${gone.map((o) => o.name).join(", ")}`); drop(...gone); };
  { // top shelf (139 mm clear under the chiller tray): the milk pouches, the biryani box and the buttermilk
    const g = trays.getObjectByName("Shelf1Stock");
    const milk = g.getObjectByName("NandiniMilk"), pile = ["AavinMilk", "AmulTaazaPouch"].map((n) => g.getObjectByName(n)).filter(Boolean), m0 = milk.position.clone();
    only(g, [milk, ...pile, g.getObjectByName("RnrBiryaniBox"), g.getObjectByName("MastiButtermilk")]);
    row([milk, g.getObjectByName("RnrBiryaniBox"), g.getObjectByName("MastiButtermilk")], -hw, hw, zb);
    const d = milk.position.clone().sub(m0);
    pile.forEach((o) => o.position.add(d));
  }
  { // middle shelf: the two sweet boxes and the coconut at the back, the biryani tin in front of the sweets
    const g = trays.getObjectByName("Shelf2Stock");
    const a = g.getObjectByName("NandhanaPalace"), b = g.getObjectByName("NandhanaPalace2"), c = g.getObjectByName("CoconutHalf"), t = g.getObjectByName("RnrBiryani");
    only(g, [a, b, c, t]);
    const d1 = row([a, b, c], -hw, hw, zb);
    row([t], bbox(a).min.x, bbox(b).max.x, zb + bbox(a).max.z - bbox(a).min.z + 0.006);
  }
  { // bottom shelf: bananas and curd at the back; grapes, an orange, an apple and two lemons in front
    const g = trays.getObjectByName("Shelf3Stock");
    const ap = kids(g, "Apple"), or = kids(g, "Orange"), le = kids(g, "Lemon");
    const small = (l) => l.slice().sort((p, q) => { const bp = bbox(p), bq = bbox(q); return (bp.max.z - bp.min.z) - (bq.max.z - bq.min.z); });
    const a1 = small(ap)[0], o1 = small(or)[0];
    only(g, [g.getObjectByName("Bananas"), g.getObjectByName("AmulMastiDahi"), g.getObjectByName("Grapes"), a1, o1, ...le]);
    const d1 = row([g.getObjectByName("Bananas"), g.getObjectByName("AmulMastiDahi")], -hw, hw, zb);
    row([g.getObjectByName("Grapes"), o1, a1, ...le], -hw, hw, zb + d1 + 0.006);
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
// the vegetable case is about 200 mm deep and 460 mm wide inside (it stops at the hump over the compressor), too small for
// stock_lg's heap: one layer is laid out from the heap's own vegetables, the cauliflower, a capsicum and onions at the
// back, the tomatoes and a carrot in front, chillies by the cauliflower
const vegSrc = {};
{
  const v = trays.getObjectByName("FreshZoneStock");
  for (const n of ["Onion", "Potato"]) vegSrc[n] = kids(v, n);
  const pick = (n, i) => kids(v, n)[i];
  const cauli = pick("Cauliflower", 0), caps = [pick("Capsicum", 0), pick("Onion", 1)].filter(Boolean), on = pick("Onion", 0);
  const tom = [0, 1, 2].map((i) => pick("Tomato", i)).filter(Boolean), car = pick("Carrot", 0), chi = [pick("GreenChilli", 7), pick("GreenChilli", 4)].filter(Boolean);
  const keep = new Set([cauli, ...caps, on, ...tom, car, ...chi].filter(Boolean));
  const gone = v.children.filter((o) => !keep.has(o)), count = {};
  gone.forEach((o) => (count[o.name] = (count[o.name] || 0) + 1));
  drop(...gone);
  console.log(`left out of the vegetable case (one layer only): ${Object.entries(count).map(([k, n]) => `${n} ${k}`).join(", ")}`);
  const dep = (o) => { const b = bbox(o); return b.max.z - b.min.z; };
  const x0 = -vbW / 2 + 0.006, x1 = vbW / 2 - 0.006, zb = vbZ0 + 0.008;
  row([cauli, ...caps, on].filter(Boolean), x0, x1, zb);
  const xr = bbox(cauli).max.x, dCO = Math.max(...[...caps, on].filter(Boolean).map(dep));
  const dT = row(tom, xr, x1, zb + dCO + 0.008);
  if (car) row([car], xr, x1, zb + dCO + 0.008 + dT + 0.008);
  row(chi, x0, xr, zb + dep(cauli) + 0.008);
  for (const o of keep) { const b = bbox(o); o.position.y += vbBot + 0.004 + 0.0005 - b.min.y; }
  leaveOut(v, [B3(-1, 0, -1, 1, 3, vbZ0 + 0.004), B3(-1, 0, vbZ1 - 0.006, 1, 3, 1), B3(-1, coverY - 0.005 - 0.01, -1, 1, 3, 1)], "past the vegetable case's back or front, or under 1 cm from its cover");
}
// the chiller tray: butter, cheese and curd cups
stock.fresh0(trays, { y: ctBot + 0.004, z: ctZ, bx: -0.15, cx: 0.07, ex: -0.04 });
leaveOut(trays.getObjectByName("F0Stock"), [B3(-1, fbBot - 0.006, -1, 1, 3, 1), B3(-1, 0, ctZ1 - 0.008, 1, 3, 1)], "too tall for the chiller tray");
// the freezer box: the tubs and the frozen packs across its floor
const fzX = (fbX0 + pnX0) / 2;
stock.freezer(cab, { fit: true, zIn1: zIn, floor: fbBot + wt + 0.003, top: fbTop, box: { hw: (pnX0 - fbX0 - 2 * wt) / 2 - 0.012, z0: zIn + 0.02, z1: fbZ1 - 0.02 } });
{
  const f = cab.getObjectByName("FreezerStock");
  if (f) f.position.x += fzX;
  // the box is 156 mm tall inside, too low for stock_lg's two stacked tubs: the tubs stand side by side at the back, the
  // frozen packs in front of them
  if (f) {
    const [va, rb] = ["AmulVanillaMagic", "AmulRajbhog"].map((n) => f.getObjectByName(n));
    if (va && rb) rb.position.y = va.position.y;
    const x0 = fbX0 + wt + 0.004, x1 = pnX0 - wt - 0.004;
    const d1 = row([va, rb].filter(Boolean), x0, x1, zIn + 0.02);
    // (the peas and the Nitya pack stand 181 and 162 mm tall: no room; the Viswas pack, 136 mm, stands in front)
    const tall = ["FreshoGreenPeas", "NityaParotta"].map((n) => f.getObjectByName(n)).filter(Boolean);
    if (tall.length) console.log(`left out (taller than the freezer box): ${tall.map((o) => o.name).join(", ")}`);
    drop(...tall);
    const packs = ["ViswasParotta"].map((n) => f.getObjectByName(n)).filter(Boolean);
    for (const o of packs) o.position.y = va.position.y;
    if (packs.length) row(packs, x0, x1, zIn + 0.02 + d1 + 0.01);
  }
  cab.getObjectByName("OnFreezerShelf")?.removeFromParent();
  leaveOut(f, [B3(-1, fbTop - wt - 0.008, -1, 1, 3, 1), B3(-1, 0, fbZ1 - 0.012, 1, 3, 1), B3(pnX0 - wt - 0.003, 0, -1, 1, 3, 1), B3(-1, 0, -1, fbX0 + wt + 0.003, 3, 1)], "past the freezer box");
}
// the base drawer: onions on the left, potatoes on the right, one layer (Haier's photo of it); copies of the vegetable
// case's own onions and potatoes
{
  const src = (n) => (vegSrc[n]?.length ? vegSrc[n] : null);
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
  place(src("Onion"), "Onion", [-0.19, -0.1], [-0.05, 0.045, 0.14]);
  place(src("Potato"), "Potato", [0.0, 0.095, 0.19], [-0.05, 0.045, 0.14]);
  const tall = drawer.children.filter((o) => /Onion|Potato/.test(o.name) && bbox(o).max.y > drTop - 0.004);
  if (tall.length) console.log(`left out (taller than the drawer's front): ${tall.map((o) => o.name).join(", ")}`);
  drop(...tall);
}

// ── the door: hinged on the right; a flat glass front on a painted frame, its top corners rounded 20 mm, a thin silver
// edge round the glass, the recess handle down its left side and the round lock low on that side ──
const fridgeDoor = group("FridgeDoor", W / 2, doorBot, zDoor);
{
  const out = topRounded(pw, dh, rC), glassT = 0.004;
  const add = (o) => { o.position.x -= pw / 2; fridgeDoor.add(o); return o; };
  add(mesh("DoorFrameSides", sidesOf(out, T_ - glassT), doorEdge));
  add(mesh("DoorGlassEdge", sidesOf(out, glassT).translate(0, 0, T_ - glassT), glassEdge));
  add(mesh("DoorGlass", flat(out, pw, dh).translate(0, 0, T_), doorFace));
  add(mesh("DoorBack", flipFaces(flat(out, pw, dh)), linerSide));
  // the Haier mark: 61 mm wide, its middle 84 mm below the top and 8 mm right of the middle (front: ink x 583-624, rows
  // 211-222); the same place on both colours (the Wave Glass's own mark, off its rectified 3/4 view, sits within 6 mm)
  const lw = 0.061 * C.logo.padded[0] / C.logo.inner[0], lh = lw * C.logo.padded[1] / C.logo.padded[0];
  add(plane("HaierMarkDecal", lw, lh, markM, 0.008, dh - 0.084, T_ + 0.0008));
  // the recess handle: a groove 18 mm wide down the left side from 37 to 521 mm under the top (3/4 views; its width
  // ESTIMATED), and inside it the dark finger pull
  {
    const gh = 0.484, gy = dh - 0.037 - gh / 2;
    const g = mesh("HandleRecess", pill(0.018, gh), dark, -pw / 2 - 0.0006, gy, T_ * 0.5);
    g.rotation.y = -Math.PI / 2;
    add(g);
  }
  // the lock: round, chrome, on the left side 64 mm above the door's foot (3/4 left view)
  {
    // (it stands 2 mm proud of the side, so the body keeps its published width)
    const l = cyl("DoorLock", 0.0075, 0.0075, 0.003, chrome, -pw / 2 - 0.0005, 0.064, T_ * 0.5, 24);
    l.rotation.z = Math.PI / 2;
    add(l);
    add(box("LockKeyhole", 0.0006, 0.007, 0.0025, dark, -pw / 2 - 0.0021, 0.064, T_ * 0.5));
  }
  // inside: the gasket ring, the liner the pockets hang on (open photo: liner rows to 40-1145 mm up the door)
  const ly0 = floorIn - doorBot + 0.004, ly1 = ceil - doorBot - 0.004;
  fridgeDoor.add(box("GasketT", pw - 0.04, 0.016, 0.008, gasket, -pw / 2, ly1 + 0.012, -0.0035));
  fridgeDoor.add(box("GasketB", pw - 0.04, 0.016, 0.008, gasket, -pw / 2, ly0 - 0.012, -0.0035));
  fridgeDoor.add(box("GasketL", 0.016, ly1 - ly0 + 0.04, 0.008, gasket, -pw + 0.028, (ly0 + ly1) / 2, -0.0035));
  fridgeDoor.add(box("GasketR", 0.016, ly1 - ly0 + 0.04, 0.008, gasket, -0.028, (ly0 + ly1) / 2, -0.0035));
  fridgeDoor.add(box("DoorLiner", inW - 0.03, ly1 - ly0 - 0.02, linerFace - 0.008, liner, -pw / 2, (ly0 + ly1) / 2, -0.008 - (linerFace - 0.008) / 2));
}
// the pockets: the top one, two half pockets on the rib, one half pocket on the hinge side, the big one, the bottle one
const bkW = inW - 0.05, ribW = 0.02, half = (bkW - ribW) / 2, hx = (ribW + half) / 2;   // hx: a half pocket's middle off the door's
const addPocket = (n, w, b, x) => { const k = pocket(n, w, b.d, b.h); k.position.x = x; k.position.y = b.y; fridgeDoor.add(k); };
addPocket("TopPocket", bkW, BK.top, -pw / 2);
addPocket("HalfPocketHinge", half, BK.half, -pw / 2 + hx);
addPocket("HalfPocketFree", half, BK.half, -pw / 2 - hx);
addPocket("HalfPocketLow", half, BK.halfL, -pw / 2 + hx);
addPocket("BigPocket", bkW, BK.big, -pw / 2);
addPocket("BottlePocket", bkW, BK.bottle, -pw / 2);
// the moulded rib down the middle of the liner, from 600 to 1000 mm up the door, its foot cut on the slant (open photo)
{
  const y0 = 0.6, y1 = 1.0, dep = 0.04, s = new THREE.Shape();
  s.moveTo(0, y0 + 0.04); s.lineTo(dep, y0); s.lineTo(dep, y1); s.lineTo(0, y1); s.lineTo(0, y0 + 0.04);
  const g = new THREE.ExtrudeGeometry(s, { depth: ribW, bevelEnabled: false }).rotateY(Math.PI / 2);   // the outline's x along -z
  g.translate(-pw / 2 - ribW / 2, 0, -linerFace);
  fridgeDoor.add(mesh("DoorRib", g, liner));
}
// the egg tray sits in the two half pockets (Haier: "Egg Tray: Yes"; where, ESTIMATED): three eggs in each
const eggX = [-0.055, 0, 0.055].map((d) => -pw / 2 + hx + d);
fridgeDoor.add(box("EggCupsRib", half - 0.02, 0.006, 0.05, clearRib, -pw / 2 + hx, BK.half.y + 0.007, -linerFace - BK.half.d / 2));
fridgeDoor.add(box("EggCupsRib", half - 0.02, 0.006, 0.05, clearRib, -pw / 2 - hx, BK.half.y + 0.007, -linerFace - BK.half.d / 2));
{
  const inside = (dep) => [-pw / 2 - bkW / 2 + 0.006, -pw / 2 + bkW / 2 - 0.006, -(linerFace + dep / 2)];
  const deps = { egg: BK.half.d, jar: BK.big.d, bottle: BK.bottle.d };
  stock.doorFridge(fridgeDoor, { fit: true, eggY: BK.half.y, eggX, jarY: BK.big.y, botY: BK.bottle.y, canY: null, deps, inside });
  // what is taller than its pocket's space (to the pocket over it, less 1 cm) is left out
  const tops = [[BK.big.y, BK.halfL.y - 0.01], [BK.bottle.y, BK.big.y - 0.01]];
  fridgeDoor.updateMatrixWorld(true);
  const inv = new THREE.Matrix4().copy(fridgeDoor.matrixWorld).invert();
  const out = [];
  for (const o of [...fridgeDoor.children]) {
    if (!o.isGroup && !o.isMesh) continue;
    if (/Pocket|Gasket|Door|Handle|Lock|Haier|Egg(Cups)?Rib/.test(o.name)) continue;
    const b = new THREE.Box3().setFromObject(o).applyMatrix4(inv);
    const t = tops.find(([f]) => Math.abs(b.min.y - f) < 0.02);
    if (t && b.max.y > t[1]) { out.push(o.name); o.removeFromParent(); }
  }
  if (out.length) console.log(`left out (taller than its pocket's space): ${out.join(", ")}`);
  // what stays in the bottle pocket is lined up again across it
  const low = fridgeDoor.children.filter((o) => (o.isGroup || o.isMesh) && !/Pocket|Gasket|Door|Handle|Lock|Haier|Rib/.test(o.name) && Math.abs(new THREE.Box3().setFromObject(o).applyMatrix4(inv).min.y - BK.bottle.y) < 0.02);
  if (low.length) row(low, W / 2 - pw / 2 - bkW / 2 + 0.006, W / 2 - pw / 2 + bkW / 2 - 0.006, zDoor - linerFace - BK.bottle.d + 0.006);
}
// the other half pocket holds eggs too, and the top pocket three jars (copies of the door's own eggs and jars)
{
  for (const e of fridgeDoor.children.filter((o) => o.name === "Egg")) { const c = e.clone(); c.position.x -= 2 * hx; fridgeDoor.add(c); }
  const jars = ["MothersPickle", "AavinGhee", "MothersPickle2"].map((n) => fridgeDoor.getObjectByName(n)).filter(Boolean).map((j) => { const c = j.clone(); c.name = j.name + "Top"; fridgeDoor.add(c); return c; });
  for (const c of jars) { const b = bbox(c); c.position.y += doorBot + BK.top.y + 0.0045 - b.min.y; }
  row(jars, W / 2 - pw / 2 - bkW / 2 + 0.006, W / 2 - pw / 2 + bkW / 2 - 0.006, zDoor - linerFace - BK.top.d + 0.006);
}
root.add(fridgeDoor);

const parts = productParts(PRODUCTS, ID);
const clips = stateClips(root, parts);
saveZones(PRODUCTS, ID, root, parts);
const textures = { DoorFace: `${T}/door_${F0.slug}.jpg`, RearPlate: `${T}/rear.jpg`, Bay: `${T}/bay.jpg`, HaierMark: `${T}/logo.png`, Print_freezer: `${T}/flap.png` };
Object.assign(textures, stock.textures());
{ const used = new Set(); root.traverse((o) => o.isMesh && [].concat(o.material).forEach((m) => used.add(m.name))); for (const k of Object.keys(textures)) if (!used.has(k)) delete textures[k]; }
// Grain: the painted cabinet, the door's painted frame and the stand's plastic a soft peel; the glass none
await exportGLB(root, clips, OUT, textures, { dir: `${TEX}/grain`, materials: {
  SidePaint: { type: "peel_soft" }, TopPaint: { type: "peel_soft" }, StandPlastic: { type: "peel_soft" }, DoorEdge: { type: "peel_soft" },
} });

// ── the colours as KHR_materials_variants; the glass gets its clear coat ──
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
  const VARY = ["DoorFace", "DoorEdge", "SidePaint", "TopPaint", "StandPlastic", "StandFront"];
  const base = Object.fromEntries(VARY.map((n) => [n, byName(n)]));
  for (const n of VARY) if (!base[n]) throw new Error(`no material ${n}`);
  base.DoorFace.getBaseColorTexture().setName("DoorFace_" + F0.slug);
  const coat = (m, c) => m.setExtension("KHR_materials_clearcoat", c ? coatExt.createClearcoat().setClearcoatFactor(c[0]).setClearcoatRoughnessFactor(c[1]) : null);
  const mats = FIN.map((f, i) => {
    const out = {};
    for (const n of VARY) {
      const m = i === 0 ? base[n] : base[n].clone().setName(`${n}_${f.slug}`);
      if (n === "DoorFace") {
        m.setBaseColorTexture(image(`${T}/door_${f.slug}.jpg`, `DoorFace_${f.slug}`)).setBaseColorFactor([1, 1, 1, 1]);
        m.setMetallicFactor(f.door.metal).setRoughnessFactor(f.door.rough);
        m.setNormalTexture(null); m.setMetallicRoughnessTexture(null);
        coat(m, f.door.coat);
      }
      if (n === "StandFront") { m.setBaseColorFactor([...hex(f.drawer), 1]).setMetallicFactor(f.door.metal).setRoughnessFactor(f.door.rough); coat(m, f.door.coat); }
      if (n === "DoorEdge") m.setBaseColorFactor([...hex(f.edge), 1]);
      if (n === "SidePaint") m.setBaseColorFactor([...hex(f.side), 1]);
      if (n === "TopPaint") m.setBaseColorFactor([...hex(f.top), 1]);
      if (n === "StandPlastic") m.setBaseColorFactor([...hex(f.stand), 1]);
      out[n] = m;
    }
    return out;
  });
  const variants = FIN.map((f) => varExt.createVariant(f.variant));
  let mapped = 0;
  for (const node of R.listNodes()) {
    const me = node.getMesh();
    if (!me) continue;
    for (const p of me.listPrimitives()) {
      const n = VARY.find((k) => p.getMaterial() === base[k]);
      if (!n) continue;
      const list = varExt.createMappingList();
      FIN.forEach((f, i) => list.addMapping(varExt.createMapping().setMaterial(mats[i][n]).addVariant(variants[i])));
      p.setExtension("KHR_materials_variants", list);
      mapped++;
    }
  }
  for (const t of R.listTextures()) if (!t.listParents().some((p) => p.propertyType === "Material")) t.dispose();
  fs.writeFileSync(OUT, await io.writeBinary(doc));
  console.log(`variants: ${FIN.map((f) => f.variant).join(", ")}; ${mapped} primitives mapped;`, (fs.statSync(OUT).size / 1048576).toFixed(2), "MB");
}
