// Samsung WA80BG4441BDTL, 8.0 kg 5 star top-load washing machine with Ecobubble and a Digital Inverter motor, in Versailles Gray
// (and its Light Gray twin, WA80BG4441BGTL, as a material variant).
// Built to Samsung's size, 540 W x 988 H x 568 D mm (Samsung India's spec page, the user manual DC68-04429A-13 p.44 and
// Sangeetha's listing), and to Samsung's own gallery for this model: the side photo gives the profile (a grey cabinet on a black
// plinth, a grey top cover that rises toward the back, a black lid with a tinted glass window and a rounded nose, and the
// slanted black rear control housing); the overhead panel photo and the manual's drawing give the control panel; the lid-open,
// detergent, drum and pulsator photos give everything inside; the rear photo of the Light Gray twin gives the back.
// Copied from make_samsung_wa80.mjs (the family's closest builder) and changed to this model's own shapes. Every size Samsung
// doesn't publish is measured off Samsung's side photo, scaled to the published height and depth
// (private/research/samsung_wa80bg/NOTES.md).
// usage: node make_samsung_wa80bg.mjs <entry.json> <tex dir> <out.glb>
import fs from "node:fs";
import { NodeIO } from "@gltf-transform/core";
import { ALL_EXTENSIONS, KHRMaterialsVariants } from "@gltf-transform/extensions";
import { THREE, mat, mesh, box, group, flipV, inward, stateClips, exportGLB, productParts, saveZones } from "./lib.mjs";
import { mergeVertices } from "three/examples/jsm/utils/BufferGeometryUtils.js";

const [PRODUCTS, TEX, OUT] = process.argv.slice(2);
const ID = "samsung-wa80bg4441bdtl";
const T = `${TEX}/samsung_wa80bg`;

// the colours Samsung sells this model in: body, top cover and inside parts take the colour; lid, panel and plinth stay black
const FINISHES = [
  { name: "Versailles Gray", body: 0x444447, tub: 0x141416, suf: "" },
  { name: "Light Gray", body: 0xacadb0, tub: 0xb2b3b7, suf: "_bg" },
];
const F0 = FINISHES[0];

// ── size (metres); z runs front (+) to back (-), xf is the distance from the front edge ──
const W = 0.54, H = 0.988, D = 0.568;
const zF = D / 2, zB = -D / 2;
const xz = (xf) => zF - xf;
const plinthTop = 0.080, cabTop = 0.802;
const HX = 0.412;                                              // the control panel's housing starts here
const seat = (xf) => 0.8605 + 0.080 * Math.min(xf, HX);        // top of the top cover: the lid sits on it
const crease = (xf) => 0.8435 + 0.065 * xf;                    // the step along the top cover's side
const lidTop = (xf) => 0.879 + 0.1306 * xf;                    // the lid's upper surface
const LID0 = 0.006, LID1 = 0.409;                              // lid front and back edges
const HB0 = 0.016;                                             // the top cover's upper band starts behind the lid's nose
const WELL = { x: 0.236, f0: 0.045, f1: 0.405, r: 0.04 };       // the opening under the lid
const floorY = 0.836;                                          // the tub cover round the tub opening
const tubR = 0.178, tubXf = 0.225, dz = xz(tubXf);             // the round opening into the tub
const drumR = 0.2, drumTop = floorY - 0.046, drumDepth = 0.43, drumFloor = drumTop - drumDepth;

// ── materials ──
const bodyM = mat("Body", F0.body, { rough: 0.5 });              // Versailles Gray: sRGB (68, 68, 71), as the side texture
const sideL = mat("SideL", 0xffffff, { rough: 0.5 });
const sideR = mat("SideR", 0xffffff, { rough: 0.5 });
const rearM = mat("Rear", 0xffffff, { rough: 0.55 });
const coverM = mat("TopCover", F0.body, { rough: 0.5 });
const black = mat("BlackPlastic", 0x141416, { rough: 0.38 });
const plinthM = mat("Plinth", 0x1b1b1d, { rough: 0.75 });
const footM = mat("Foot", 0x101112, { rough: 0.8 });
const glassM = mat("LidGlass", 0x08090b, { rough: 0.05, opacity: 0.88, side: THREE.DoubleSide });   // tinted: Samsung's photos show the tub only faintly through it
const panelM = mat("PanelFace", 0xffffff, { rough: 0.18 });
const ringM = mat("PowerRing", 0x9a9ba0, { rough: 0.3 });
const tubCover = mat("TubCover", F0.tub, { rough: 0.35 });
const tubGrey = mat("TubGrey", 0x9a9ca2, { rough: 0.45, side: THREE.DoubleSide });
const drumM = mat("DiamondDrum", 0xffffff, { rough: 0.35, metal: 0.25, side: THREE.DoubleSide });
const baseM = mat("DrumBase", 0xd6d8dc, { rough: 0.45 });
const pulsM = mat("Pulsator", 0xffffff, { rough: 0.4, side: THREE.DoubleSide });
const capM = mat("PulsatorCap", 0x9ccbd3, { rough: 0.3 });
const filterM = mat("MagicFilter", 0xffffff, { rough: 0.5 });
const filterFrame = mat("FilterFrame", 0x96989d, { rough: 0.5 });
const detBox = mat("DetergentBox", F0.tub, { rough: 0.2 });
const detM = mat("DetergentFace", 0xffffff, { rough: 0.35 });
const blueM = mat("BluePlastic", 0x5f8fcf, { rough: 0.3 });
const cordM = mat("Cord", 0x8a8b8e, { rough: 0.6 });             // light grey, as in Samsung's rear photo
const plugM = mat("Plug", 0x8a8b8e, { rough: 0.5 });

const cyl = (name, rt, rb, h, m, x, y, z, seg = 24) => mesh(name, new THREE.CylinderGeometry(rt, rb, h, seg), m, x, y, z);

// a side profile (points [xf, y]) extruded across a width w, centred on x = 0 (from the reference builder)
function sideSlab(name, pts, w, material) {
  const s = new THREE.Shape();
  pts.forEach(([xf, y], i) => (i ? s.lineTo(xf, y) : s.moveTo(xf, y)));
  const g = new THREE.ExtrudeGeometry(s, { depth: w, bevelEnabled: false });
  g.rotateY(Math.PI / 2);
  g.translate(-w / 2, 0, zF);
  return mesh(name, g, material);
}

// a rounded rectangle seen from above, in shape coordinates (x, xf - zF), front corners rf, back corners rb
function roundRect(p, x0, x1, f0, f1, rf, rb) {
  const Y0 = f0 - zF, Y1 = f1 - zF;
  p.moveTo(x0 + rf, Y0);
  p.lineTo(x1 - rf, Y0); p.absarc(x1 - rf, Y0 + rf, rf, -Math.PI / 2, 0, false);
  p.lineTo(x1, Y1 - rb); p.absarc(x1 - rb, Y1 - rb, rb, 0, Math.PI / 2, false);
  p.lineTo(x0 + rb, Y1); p.absarc(x0 + rb, Y1 - rb, rb, Math.PI / 2, Math.PI, false);
  p.lineTo(x0, Y0 + rf); p.absarc(x0 + rf, Y0 + rf, rf, Math.PI, 1.5 * Math.PI, false);
  return p;
}

// A plan shape stood up between two heights that each follow the side profile: bot(xf) and top(xf) (from make_samsung_wa80.mjs)
function prism(name, shape, bot, top, material, { bev = 0, caps = ["top", "bottom"], curve = 8 } = {}) {
  const t0 = 0.02;
  const g0 = new THREE.ExtrudeGeometry(shape, { depth: t0, bevelEnabled: bev > 0, bevelSize: bev, bevelThickness: bev, bevelOffset: -bev, bevelSegments: 2, curveSegments: curve });
  const pos = g0.attributes.position, nor = g0.attributes.normal, uv = g0.attributes.uv;
  const P = [], N = [], U = [];
  const slope = (f, xf) => (f(xf + 1e-4) - f(xf - 1e-4)) / 2e-4;
  for (const gr of g0.groups) for (let i = gr.start; i < gr.start + gr.count; i += 3) {
    if (gr.materialIndex === 0) {
      const zc = (pos.getZ(i) + pos.getZ(i + 1) + pos.getZ(i + 2)) / 3;
      if (!caps.includes(zc > t0 / 2 ? "top" : "bottom")) continue;
    }
    for (let k = i; k < i + 3; k++) {
      const X = pos.getX(k), Y = pos.getY(k), Z = pos.getZ(k);
      const xf = zF + Y, f = (Z + bev) / (t0 + 2 * bev);
      const yb = bot(xf), yt = top(xf);
      P.push(X, yb + f * (yt - yb), -Y);
      let n = [nor.getX(k), nor.getZ(k), -nor.getY(k)];
      if (Math.abs(n[1]) > 0.98) {
        const b = n[1] > 0 ? slope(top, xf) : slope(bot, xf);
        const s = Math.sign(n[1]), l = Math.hypot(1, b);
        n = [0, s / l, (s * b) / l];
      }
      N.push(...n);
      U.push(uv.getX(k), uv.getY(k));
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(P, 3));
  g.setAttribute("normal", new THREE.Float32BufferAttribute(N, 3));
  g.setAttribute("uv", new THREE.Float32BufferAttribute(U, 2));
  return mesh(name, mergeVertices(g, 1e-6), material);
}

const root = group("SamsungWA80BG");
const cab = group("Cabinet");
root.add(cab);

// ── base: the black plinth (a deeper skirt at the front corners, a recess between them) and four levelling feet ──
// measured on Samsung's side and front photos: the plinth's side ends 27 mm above the floor, the front skirts 16 mm, the back
// rises to 49 mm; the recess between the front skirts runs from x -0.143 to +0.143
cab.add(sideSlab("Plinth", [[0.006, plinthTop], [0.006, 0.027], [0.462, 0.027], [0.55, 0.043], [0.564, 0.049], [0.564, plinthTop]], W - 0.018, plinthM));
for (const sx of [-1, 1]) cab.add(box("PlinthSkirt", 0.118, 0.011, 0.126, plinthM, sx * 0.202, 0.0215, xz(0.069)));
for (const sx of [-1, 1]) {
  cab.add(cyl("Foot", 0.018, 0.018, 0.016, footM, sx * 0.222, 0.008, xz(0.054), 20));                  // front feet under the skirts
  cab.add(cyl("Foot", 0.018, 0.018, 0.021, footM, sx * 0.222, 0.0105, xz(0.528), 20));                 // rear feet: a foot and a collar
  cab.add(cyl("FootCollar", 0.015, 0.015, 0.02, footM, sx * 0.222, 0.031, xz(0.528), 20));
}

// ── cabinet: rounded corners; the side panels' relief is Samsung's side photo of each colour, laid on each side ──
{
  const s = roundRect(new THREE.Shape(), -W / 2, W / 2, 0, D, 0.011, 0.011);
  cab.add(prism("CabinetShell", s, () => plinthTop, () => cabTop, bodyM, { caps: [] }));
  const R = 0.011, d = D - 2 * R, h = cabTop - plinthTop - 0.002;
  for (const [sx, m] of [[-1, sideL], [1, sideR]]) {
    const g = flipV(new THREE.PlaneGeometry(d, h));
    const uv = g.attributes.uv;
    for (let i = 0; i < uv.count; i++) uv.setX(i, R / D + uv.getX(i) * (d / D));
    const p = mesh("SideDecal", g, m, sx * (W / 2 + 0.0006), plinthTop + 0.001 + h / 2, 0);
    p.rotation.y = sx * Math.PI / 2;
    cab.add(p);
  }
}

// ── top cover: a full-width band up to the crease, a narrower band above it up to the lid seat, both open over the tub ──
{
  const well = () => roundRect(new THREE.Path(), -WELL.x, WELL.x, WELL.f0, WELL.f1, WELL.r, WELL.r);
  const low = roundRect(new THREE.Shape(), -W / 2, W / 2, 0, D, 0.011, 0.011); low.holes.push(well());
  cab.add(prism("TopCoverLow", low, () => cabTop, crease, coverM, { caps: ["top"] }));
  const high = roundRect(new THREE.Shape(), -0.264, 0.264, HB0, 0.562, 0.009, 0.009); high.holes.push(well());
  cab.add(prism("TopCoverHigh", high, crease, seat, coverM, { caps: ["top"] }));
}

// ── the well: the tub cover with the round tub opening, the grey tub ring, the diamond drum and everything in it ──
{
  const fs_ = new THREE.Shape();
  const hd = (WELL.f1 - WELL.f0) / 2;
  fs_.moveTo(-WELL.x, -hd); fs_.lineTo(WELL.x, -hd); fs_.lineTo(WELL.x, hd); fs_.lineTo(-WELL.x, hd); fs_.closePath();
  const hole = new THREE.Path(); hole.absarc(0, tubXf - (WELL.f0 + WELL.f1) / 2, tubR, 0, Math.PI * 2, true); fs_.holes.push(hole);
  const fg = new THREE.ShapeGeometry(fs_, 64);
  fg.rotateX(-Math.PI / 2);
  cab.add(mesh("TubCover", fg, tubCover, 0, floorY, xz((WELL.f0 + WELL.f1) / 2)));
  const ring = new THREE.LatheGeometry([[0.184, 0.001], [0.178, -0.003], [0.177, -0.012], [0.185, -0.028], [drumR, -0.04], [drumR, -0.047]].map(([r, y]) => new THREE.Vector2(r, y)), 72);
  cab.add(mesh("TubRing", ring, tubGrey, 0, floorY, dz));
  const g = new THREE.CylinderGeometry(drumR, drumR, drumDepth, 72, 1, true);
  const uv = g.attributes.uv;
  const uRep = 6, vRep = drumDepth / ((2 * Math.PI * drumR) / uRep);
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * uRep, 1 - uv.getY(i) * vRep);
  inward(g);
  cab.add(mesh("DiamondDrum", g, drumM, 0, drumTop - drumDepth / 2, dz));
  const fl = new THREE.CircleGeometry(drumR, 64); fl.rotateX(-Math.PI / 2);
  cab.add(mesh("DrumFloor", fl, baseM, 0, drumFloor, dz));
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2 + Math.PI / 12;
    const n = box("FloorNub", 0.026, 0.03, 0.022, baseM, Math.cos(a) * 0.174, drumFloor + 0.015, dz + Math.sin(a) * 0.174);
    n.rotation.y = -a; cab.add(n);
  }
  // the PP Dual Wing pulsator: a pale dish (its holes are the texture), six raised vanes and a pale blue cap
  const PR = 0.15;
  const dish = new THREE.LatheGeometry([[0.0, 0.032], [0.03, 0.031], [0.09, 0.02], [0.14, 0.006], [PR, 0.0]].map(([r, y]) => new THREE.Vector2(r, y)), 64);
  { const p = dish.attributes.position, u = dish.attributes.uv; for (let i = 0; i < u.count; i++) u.setXY(i, 0.5 + p.getX(i) / (2 * PR), 0.5 + p.getZ(i) / (2 * PR)); }
  cab.add(mesh("Pulsator", dish, pulsM, 0, drumFloor + 0.002, dz));
  for (let i = 0; i < 6; i++) {
    const a = Math.PI / 6 + (i * Math.PI) / 3, r = 0.088;
    const v = box("PulsatorVane", 0.1, 0.014, 0.016, pulsM, Math.cos(a) * r, drumFloor + 0.002 + 0.021 + 0.004, dz + Math.sin(a) * r);
    v.rotation.y = -a; v.rotation.z = 0.12; cab.add(v);
  }
  const cap = new THREE.SphereGeometry(0.017, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2); cap.scale(1, 0.6, 1);
  cab.add(mesh("PulsatorCap", cap, capM, 0, drumFloor + 0.002 + 0.031, dz));
  // Magic Filter on one side of the drum wall; a plain moulded panel on the opposite side
  cab.add(mesh("MagicFilter", flipV(new THREE.BoxGeometry(0.014, 0.2, 0.075)), [filterFrame, filterM, filterFrame, filterFrame, filterFrame, filterFrame], drumR - 0.009, drumTop - 0.135, dz));
  cab.add(box("DrumPanel", 0.01, 0.4, 0.07, baseM, -drumR + 0.007, drumTop - drumDepth / 2 - 0.01, dz));
  // the round softener cap on the tub cover right of the detergent box (Samsung's lid-open photos: black, or light grey)
  cab.add(cyl("SoftenerRing", 0.031, 0.031, 0.006, detBox, 0.143, floorY + 0.003, xz(0.37), 32));
  const bc = new THREE.SphereGeometry(0.026, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2); bc.scale(1, 0.5, 1);
  cab.add(mesh("SoftenerCap", bc, detBox, 0.143, floorY + 0.005, xz(0.37)));
  // the detergent box's housing: a shelf over the back of the opening and a hood the drawer slides under
  cab.add(box("DetShelf", 0.196, 0.002, 0.075, detBox, 0, floorY + 0.0005, xz(0.3675)));
  cab.add(box("DetHood", 0.196, 0.0515, 0.045, detBox, 0, floorY + 0.004 + 0.02575, xz(0.3825)));
}

// ── lid: hinged at its back edge, a black frame round a large tinted glass window, a rounded nose over the top cover's front ──
const PIV = [0.9335, LID1];
const lid = group("Lid", 0, PIV[0], xz(PIV[1]));
{
  const s = roundRect(new THREE.Shape(), -0.258, 0.258, LID0, LID1, 0.022, 0.006);
  s.holes.push(roundRect(new THREE.Path(), -0.233, 0.233, 0.049, 0.4, 0.008, 0.008));
  const fr = prism("LidFrame", s, (xf) => seat(Math.max(xf, HB0)) + 0.002, lidTop, black, { bev: 0.004, curve: 5 });
  fr.geometry.translate(0, -PIV[0], -xz(PIV[1]));
  lid.add(fr);
  // the nose: the lid's front edge hangs 9 mm down in front of the top cover (Samsung's side photo)
  const nose = roundRect(new THREE.Shape(), -0.25, 0.25, LID0 + 0.001, HB0 - 0.001, 0.004, 0.001);
  const nm = prism("LidNose", nose, () => 0.853, () => seat(HB0) + 0.004, black, { curve: 3 });
  nm.geometry.translate(0, -PIV[0], -xz(PIV[1]));
  lid.add(nm);
  const slope = Math.atan(0.1306), f0 = 0.046, f1 = 0.403, wxf = (f0 + f1) / 2;
  const pane = mesh("LidWindow", new THREE.PlaneGeometry(0.472, (f1 - f0) / Math.cos(slope)), glassM, 0, lidTop(wxf) - 0.0025 - PIV[0], xz(wxf) - xz(PIV[1]));
  pane.rotation.x = -Math.PI / 2 + slope;
  lid.add(pane);
}
root.add(lid);

// ── rear control panel: the black housing behind the lid, the panel glass on its slope (Samsung's own layout) ──
{
  const prof = [[HX, 0.87], [HX, 0.9336], [0.516, H], [0.520, 0.9848], [0.556, 0.9352], [0.560, 0.912], [0.564, 0.9105], [0.566, 0.905], [0.568, 0.891], [0.568, 0.87]];
  cab.add(sideSlab("PanelHousing", prof, 0.524, black));
  const p0 = [HX, 0.9336], p1 = [0.5142, 0.9871];
  const dx = p1[0] - p0[0], dy = p1[1] - p0[1], len = Math.hypot(dx, dy), ang = Math.atan2(dy, dx);
  const pg = group("PanelPlane", 0, (p0[1] + p1[1]) / 2, xz((p0[0] + p1[0]) / 2));
  pg.rotation.x = ang;
  pg.position.y += 0.0013 * Math.cos(ang); pg.position.z += 0.0013 * Math.sin(ang);
  // the texture is the whole 524 mm x 115.3 mm face, the ring at its centre
  const face = mesh("PanelFace", flipV(new THREE.PlaneGeometry(0.522, len)), panelM, 0, 0, 0);
  face.rotation.x = -Math.PI / 2;
  pg.add(face);
  // the Washing Cycles ring, raised: photo px (962, 477.5), radii 86.6-90.0 px at 4.146 px/mm, the face from row 236 to 714
  const mm = 4.146, v = (477.5 - (236 + 239)) / mm / 1000 * (len / 0.1153);
  const ring = mesh("PowerRing", new THREE.RingGeometry(86.6 / mm / 1000, 90.0 / mm / 1000, 72), ringM, 0, 0.0006, v);
  ring.rotation.x = -Math.PI / 2; pg.add(ring);
  root.add(pg);
}

// ── detergent box: a drawer at the back of the tub cover, a sloped gloss face, two cups with blue BubbleStorm impellers ──
const det = group("DetergentBox", 0, floorY + 0.0025, xz(0.37));
{
  const tilt = (70 * Math.PI) / 180;
  const fh = 0.066, fz = 0.035;
  const face = mesh("DetFace", flipV(new THREE.BoxGeometry(0.18, fh, 0.006)), [detBox, detBox, detBox, detBox, detM, detBox], 0, 0, 0);
  face.position.set(0, (fh / 2) * Math.sin(tilt), fz - (fh / 2) * Math.cos(tilt));
  face.rotation.x = -(Math.PI / 2 - tilt);
  det.add(face);
  const tz = -0.016;
  det.add(box("DetTray", 0.172, 0.003, 0.058, detBox, 0, 0.0015, tz));
  for (const sx of [-1, 0, 1]) det.add(box("DetWall", 0.003, 0.047, 0.058, detBox, sx * 0.0845, 0.0265, tz));
  det.add(box("DetWall", 0.172, 0.047, 0.003, detBox, 0, 0.0265, tz - 0.0275));
  for (const sx of [-1, 1]) {
    det.add(cyl("Impeller", 0.006, 0.006, 0.039, blueM, sx * 0.043, 0.0225, tz, 14));
    det.add(cyl("Impeller", 0.009, 0.009, 0.008, blueM, sx * 0.043, 0.04, tz, 16));
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      const b = box("Impeller", 0.022, 0.003, 0.009, blueM, sx * 0.043 + Math.cos(a) * 0.016, 0.04, tz + Math.sin(a) * 0.016);
      b.rotation.order = "YXZ"; b.rotation.y = -a; b.rotation.x = 0.5; det.add(b);
    }
  }
}
cab.add(det);

// ── the back: Samsung's rear photo (the cord painted out of it), the cold-water inlet, the power cord and its plug in the holder ──
{
  const top = 0.905, h = top - plinthTop;
  const rp = mesh("RearPanel", flipV(new THREE.PlaneGeometry(W - 0.004, h)), rearM, 0, plinthTop + h / 2, zB - 0.0006);
  rp.rotation.y = Math.PI;                      // facing back: the photo's left is the machine's right (+x)
  cab.add(rp);
  // the COLD inlet's thread stands 6 mm out of the housing's back (rear photo: x +0.064, 862 mm up)
  cab.add(cyl("InletThread", 0.011, 0.011, 0.012, black, 0.064, 0.862, zB - 0.006, 18).rotateX(Math.PI / 2));
  // the cord (rear photo, 1.224 px/mm across, 1.253 px/mm up): out of the housing at x +0.216, straight down, one loop, then
  // across to the plug standing in its holder at x +0.116, 0.50 m up; the loop's second pass lies over the first
  const px = ([u, w], z) => new THREE.Vector3((963 - u) / 1224, (1258 - w) / 1253, zB - z);
  const pts = [
    [[699, 186], 0.007], [[699, 300], 0.007], [[699, 400], 0.007], [[692, 432], 0.007], [[668, 458], 0.007], [[648, 480], 0.007],
    [[642, 520], 0.007], [[650, 567], 0.007], [[690, 593], 0.007], [[737, 580], 0.007], [[757, 547], 0.007], [[762, 515], 0.008],
    [[752, 485], 0.01], [[728, 463], 0.013], [[700, 452], 0.016], [[676, 458], 0.016], [[703, 448], 0.017], [[732, 458], 0.016],
    [[758, 482], 0.015], [[772, 512], 0.014], [[792, 526], 0.012], [[812, 534], 0.011], [[821, 560], 0.011], [[821, 585], 0.011],
  ].map(([p, z]) => px(p, z));
  cab.add(mesh("PowerCord", new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts, false, "centripetal"), 90, 0.004, 6, false), cordM));
  cab.add(box("CordHolder", 0.044, 0.074, 0.008, black, 0.116, 0.501, zB - 0.004));
  cab.add(box("Plug", 0.034, 0.05, 0.016, plugM, 0.116, 0.505, zB - 0.016));
}

const parts = productParts(PRODUCTS, ID);
const clips = stateClips(root, parts);
saveZones(PRODUCTS, ID, root, parts);
await exportGLB(root, clips, OUT, {
  SideL: `${T}/side_l.jpg`, SideR: `${T}/side.jpg`, Rear: `${T}/rear.jpg`, PanelFace: `${T}/panel.jpg`,
  DiamondDrum: `${T}/drum.jpg`, Pulsator: `${T}/pulsator.jpg`, DetergentFace: `${T}/detergent.jpg`, MagicFilter: `${T}/filter.jpg`,
}, { dir: `${TEX}/grain`, materials: {
  // Grain: the painted cabinet, sides and top cover get the soft peel; the black lid frame and housing are smooth gloss plastic
  // in Samsung's photos: the soft peel too; the matt moulded plinth the strong peel; nothing on the panel glass or the label
  Body: { type: "peel_soft" }, SideL: { type: "peel_soft" }, SideR: { type: "peel_soft" }, TopCover: { type: "peel_soft" },
  BlackPlastic: { type: "peel_soft" }, Plinth: { type: "peel_strong" },
} });

// ── the colours as material variants (KHR_materials_variants), Versailles Gray first: each later colour gets its own copy
// of the body, top cover, side, rear, tub cover and detergent box materials ──
{
  const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
  const doc = await io.readBinary(new Uint8Array(fs.readFileSync(OUT)));
  const ext = doc.createExtension(KHRMaterialsVariants);
  const vs = FINISHES.map((f) => ext.createVariant(f.name));
  const lin = (c) => [(c >> 16) & 255, (c >> 8) & 255, c & 255].map((v) => { v /= 255; return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; });
  const texs = new Map();
  const tex = (file) => {
    if (!texs.has(file)) texs.set(file, doc.createTexture(file.split("/").pop().replace(/\.\w+$/, "")).setImage(new Uint8Array(fs.readFileSync(file))).setMimeType(file.endsWith(".png") ? "image/png" : "image/jpeg"));
    return texs.get(file);
  };
  const mats = doc.getRoot().listMaterials(), named = (n) => mats.find((m) => m.getName() === n);
  const SET = {
    Body: (m, f) => m.setBaseColorFactor([...lin(f.body), 1]),
    TopCover: (m, f) => m.setBaseColorFactor([...lin(f.body), 1]),
    SideL: (m, f) => m.setBaseColorTexture(tex(`${T}/side_l${f.suf}.jpg`)),
    SideR: (m, f) => m.setBaseColorTexture(tex(`${T}/side${f.suf}.jpg`)),
    Rear: (m, f) => m.setBaseColorTexture(tex(`${T}/rear${f.suf}.jpg`)),
    DetergentFace: (m, f) => m.setBaseColorTexture(tex(`${T}/detergent${f.suf}.jpg`)),
    TubCover: (m, f) => m.setBaseColorFactor([...lin(f.tub), 1]),
    DetergentBox: (m, f) => m.setBaseColorFactor([...lin(f.tub), 1]),
  };
  const alt = {};
  for (const [name, set] of Object.entries(SET)) {
    const b = named(name);
    if (!b) throw new Error(`no material ${name}`);
    alt[name] = FINISHES.map((f, i) => {
      if (!i) return b;
      const m = b.clone().setName(`${name}${f.name.replace(/\s+/g, "")}`);
      set(m, f);
      return m;
    });
  }
  for (const m of doc.getRoot().listMeshes()) for (const p of m.listPrimitives()) {
    const list0 = alt[p.getMaterial()?.getName()];
    if (!list0) continue;
    const list = ext.createMappingList();
    list0.forEach((mm, i) => list.addMapping(ext.createMapping().setMaterial(mm).addVariant(vs[i])));
    p.setExtension("KHR_materials_variants", list);
  }
  fs.writeFileSync(OUT, await io.writeBinary(doc));
  console.log(OUT, (fs.statSync(OUT).size / 1048576).toFixed(2) + " MB with", FINISHES.length, "colours");
}
