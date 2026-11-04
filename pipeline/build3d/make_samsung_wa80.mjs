// Samsung WA80F08S2CTL, 8 kg top-load washing machine with AI Wash and Super Speed, Deep Charcoal.
// Built to Samsung's size, 540 W x 988 H x 568 D mm (Samsung India's spec page and the user manual DC68-04429E-04), and to
// Samsung's own gallery for this model: the side photo gives the profile (a charcoal cabinet on a black plinth, a top cover that
// rises toward the back, a black lid with a tinted glass window, and the slanted rear control panel); the overhead panel photo and
// the manual's drawing give the control panel; the drum, pulsator, lid-open and detergent photos give everything inside.
// Copied from make_samsung_wa70.mjs (the category's reference) and changed to this model's shapes. Every size not published by
// Samsung is measured off Samsung's side photo, scaled to the published height and depth (private/research/samsung_wa80/NOTES.md).
// usage: node make_samsung_wa80.mjs <entry.json> <tex dir> <out.glb>
import { THREE, mat, mesh, box, faced, group, flipV, inward, stateClips, exportGLB, productParts, saveZones } from "./lib.mjs";
import { mergeVertices } from "three/examples/jsm/utils/BufferGeometryUtils.js";

const [PRODUCTS, TEX, OUT] = process.argv.slice(2);
const ID = "samsung-wa80f08s2ctl";
const T = `${TEX}/samsung_wa80`;

// ── size (metres); z runs front (+) to back (-), xf is the distance from the front edge ──
const W = 0.54, H = 0.988, D = 0.568;
const zF = D / 2, zB = -D / 2;
const xz = (xf) => zF - xf;
const plinthTop = 0.0994, cabTop = 0.805;
const HX = 0.411;                                              // the control panel's housing starts here
const seat = (xf) => 0.8632 + 0.0752 * Math.min(xf, HX);       // top of the top cover: the lid sits on it
const crease = (xf) => 0.8446 + 0.0789 * xf;                   // the step along the top cover's side
const lidTop = (xf) => 0.8819 + 0.1286 * xf;                   // the lid's upper surface
const LID0 = 0.009, LID1 = 0.409;                              // lid front and back edges
const WELL = { x: 0.236, f0: 0.045, f1: 0.405, r: 0.04 };       // the opening under the lid
const floorY = 0.838;                                          // the black tub cover round the tub opening
const tubR = 0.178, tubXf = 0.225, dz = xz(tubXf);             // the round opening into the tub
const drumR = 0.2, drumTop = floorY - 0.046, drumDepth = 0.43, drumFloor = drumTop - drumDepth;

// ── materials ──
const bodyM = mat("Body", 0x323235, { rough: 0.5 });              // Deep Charcoal: sRGB (50, 50, 53), as the side texture
const sideL = mat("SideL", 0xffffff, { rough: 0.5 });
const sideR = mat("SideR", 0xffffff, { rough: 0.5 });
const coverM = mat("TopCover", 0x323235, { rough: 0.5 });
const black = mat("BlackPlastic", 0x141416, { rough: 0.38 });
const plinthM = mat("Plinth", 0x1b1b1d, { rough: 0.75 });
const footM = mat("Foot", 0x101112, { rough: 0.8 });
const glassM = mat("LidGlass", 0x08090b, { rough: 0.05, opacity: 0.88, side: THREE.DoubleSide });   // the tint: Samsung's photos show the tub only faintly through it
const panelM = mat("PanelFace", 0xffffff, { rough: 0.18 });
const ringM = mat("PowerRing", 0x9a9ba0, { rough: 0.3 });
const labelM = mat("LabelBEE", 0xffffff, { rough: 0.5, opacity: 0.999 });
const tubCover = mat("TubCover", 0x18181a, { rough: 0.35 });
const tubGrey = mat("TubGrey", 0x9a9ca2, { rough: 0.45, side: THREE.DoubleSide });
const drumM = mat("DiamondDrum", 0xffffff, { rough: 0.35, metal: 0.25, side: THREE.DoubleSide });
const baseM = mat("DrumBase", 0xd6d8dc, { rough: 0.45 });
const pulsM = mat("Pulsator", 0xffffff, { rough: 0.4, side: THREE.DoubleSide });
const capM = mat("PulsatorCap", 0x9ccbd3, { rough: 0.3 });
const filterM = mat("MagicFilter", 0xffffff, { rough: 0.5 });
const filterFrame = mat("FilterFrame", 0x96989d, { rough: 0.5 });
const detBlack = mat("DetergentBox", 0x0c0c0e, { rough: 0.2 });
const detM = mat("DetergentFace", 0xffffff, { rough: 0.35 });
const blueM = mat("BluePlastic", 0x5f8fcf, { rough: 0.3 });
const hose = mat("DrainHose", 0x2b2c2f, { rough: 0.6 });
const cordM = mat("Cord", 0x2a2b2e, { rough: 0.6 });
const plugM = mat("Plug", 0x2c2d30, { rough: 0.5 });
const pinM = mat("Pin", 0xb7bbc0, { metal: 0.9, rough: 0.3 });

const cyl = (name, rt, rb, h, m, x, y, z, seg = 24) => mesh(name, new THREE.CylinderGeometry(rt, rb, h, seg), m, x, y, z);

// a side profile (points [xf, y]) extruded across a width w, centred on x = 0 (from the reference builder)
function sideSlab(name, pts, w, material) {
  const s = new THREE.Shape();
  pts.forEach(([xf, y], i) => (i ? s.lineTo(xf, y) : s.moveTo(xf, y)));
  const g = new THREE.ExtrudeGeometry(s, { depth: w, bevelEnabled: false });
  g.rotateY(Math.PI / 2);                  // shape x (the distance from the front) now runs toward -z, the extrusion along +x
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

// A plan shape stood up between two heights that each follow the side profile: bot(xf) and top(xf). The shape is extruded
// upward, then every vertex is lifted to its place between the two. The bevel is kept inside the outline (bevelOffset = -bevel),
// so the bevelled part is exactly as big as its outline (the WA70 lid had grown by its bevel). caps picks the caps to keep.
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
      // walls keep their (horizontal) normals; caps lean with the slope they now follow
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
  return mesh(name, mergeVertices(g, 1e-6), material);        // indexed: shared corners stored once (the Apple file's size)
}

const root = group("SamsungWA80");
const cab = group("Cabinet");
root.add(cab);

// ── base: the black plinth (taller skirt at the front with a notch in the middle) and four levelling feet ──
// the plinth stands 6-9 mm inside the cabinet's sides; its side ends 39 mm above the floor, the front skirt 16 mm, the rear 43 mm
cab.add(sideSlab("Plinth", [[0.007, plinthTop], [0.007, 0.031], [0.128, 0.031], [0.128, 0.039], [0.497, 0.039], [0.502, 0.043], [0.561, 0.043], [0.561, plinthTop]], W - 0.014, plinthM));
for (const sx of [-1, 1]) cab.add(box("PlinthSkirt", 0.12, 0.015, 0.121, plinthM, sx * 0.203, 0.0235, xz(0.0675)));
cab.add(box("PlinthBase", W - 0.044, 0.015, 0.369, plinthM, 0, 0.0315, xz(0.3125)));
for (const sx of [-1, 1]) {
  cab.add(cyl("Foot", 0.018, 0.018, 0.016, footM, sx * 0.222, 0.008, xz(0.051), 20));                  // front feet under the skirt
  cab.add(cyl("Foot", 0.019, 0.019, 0.021, footM, sx * 0.222, 0.0105, xz(0.521), 20));                 // rear feet: a foot and a collar
  cab.add(cyl("FootCollar", 0.016, 0.016, 0.022, footM, sx * 0.222, 0.032, xz(0.521), 20));
}

// ── cabinet: Deep Charcoal, rounded corners; the side panels' relief is Samsung's side photo, laid on each side ──
{
  const s = roundRect(new THREE.Shape(), -W / 2, W / 2, 0, D, 0.011, 0.011);
  cab.add(prism("Cabinet", s, () => plinthTop, () => cabTop, bodyM, { caps: [] }));
  const R = 0.011, d = D - 2 * R, h = cabTop - plinthTop - 0.002;
  for (const [sx, m] of [[-1, sideL], [1, sideR]]) {
    const g = flipV(new THREE.PlaneGeometry(d, h));
    const uv = g.attributes.uv;
    for (let i = 0; i < uv.count; i++) uv.setX(i, R / D + uv.getX(i) * (d / D));          // the photo covers the full depth
    const p = mesh("SideDecal", g, m, sx * (W / 2 + 0.0006), plinthTop + 0.001 + h / 2, 0);
    p.rotation.y = sx * Math.PI / 2;
    cab.add(p);
  }
  // Samsung's energy label for WA80F08S2CTL, on the front at the right
  cab.add(mesh("LabelBEE", flipV(new THREE.PlaneGeometry(0.092, 0.1715)), labelM, 0.164, 0.685, zF + 0.0007));
}

// ── top cover: a full-width band up to the crease, a slightly narrower band above it up to the lid seat, both open over the tub ──
{
  const well = () => roundRect(new THREE.Path(), -WELL.x, WELL.x, WELL.f0, WELL.f1, WELL.r, WELL.r);
  const low = roundRect(new THREE.Shape(), -W / 2, W / 2, 0, D, 0.011, 0.011); low.holes.push(well());
  cab.add(prism("TopCoverLow", low, () => cabTop, crease, coverM, { caps: ["top"] }));
  const high = roundRect(new THREE.Shape(), -0.264, 0.264, 0.004, 0.562, 0.009, 0.009); high.holes.push(well());
  cab.add(prism("TopCoverHigh", high, crease, seat, coverM, { caps: ["top"] }));
}

// ── the well: the black tub cover with the round tub opening, the grey tub ring, the diamond drum and everything in it ──
{
  const fs = new THREE.Shape();
  fs.moveTo(-WELL.x, -(WELL.f1 - WELL.f0) / 2); fs.lineTo(WELL.x, -(WELL.f1 - WELL.f0) / 2); fs.lineTo(WELL.x, (WELL.f1 - WELL.f0) / 2); fs.lineTo(-WELL.x, (WELL.f1 - WELL.f0) / 2); fs.closePath();
  const hole = new THREE.Path(); hole.absarc(0, tubXf - (WELL.f0 + WELL.f1) / 2, tubR, 0, Math.PI * 2, true); fs.holes.push(hole);
  const fg = new THREE.ShapeGeometry(fs, 64);
  fg.rotateX(-Math.PI / 2);
  cab.add(mesh("TubCover", fg, tubCover, 0, floorY, xz((WELL.f0 + WELL.f1) / 2)));
  // tub ring: the light-grey balancer collar from the opening down to the drum
  const ring = new THREE.LatheGeometry([[0.184, 0.001], [0.178, -0.003], [0.177, -0.012], [0.185, -0.028], [drumR, -0.04], [drumR, -0.047]].map(([r, y]) => new THREE.Vector2(r, y)), 72);
  cab.add(mesh("TubRing", ring, tubGrey, 0, floorY, dz));
  // drum wall, inward-facing: the 2nd Diamond pattern, six tiles round, square tiles
  const g = new THREE.CylinderGeometry(drumR, drumR, drumDepth, 72, 1, true);
  const uv = g.attributes.uv;
  const uRep = 6, vRep = drumDepth / ((2 * Math.PI * drumR) / uRep);
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * uRep, 1 - uv.getY(i) * vRep);
  inward(g);
  cab.add(mesh("DiamondDrum", g, drumM, 0, drumTop - drumDepth / 2, dz));
  // drum floor: a light ring with twelve raised nubs round the pulsator
  const fl = new THREE.CircleGeometry(drumR, 64); fl.rotateX(-Math.PI / 2);
  cab.add(mesh("DrumFloor", fl, baseM, 0, drumFloor, dz));
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2 + Math.PI / 12;
    const n = box("FloorNub", 0.026, 0.03, 0.022, baseM, Math.cos(a) * 0.174, drumFloor + 0.015, dz + Math.sin(a) * 0.174);
    n.rotation.y = -a; cab.add(n);
  }
  // the PP Dual Storm pulsator: a white dish (its holes are the texture), six raised vanes and a pale blue cap
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
  // Magic Filter on one side of the drum wall (honeycomb mesh in a grey frame); a plain moulded panel on the opposite side
  const mf = mesh("MagicFilter", flipV(new THREE.BoxGeometry(0.014, 0.2, 0.075)), [filterFrame, filterM, filterFrame, filterFrame, filterFrame, filterFrame], drumR - 0.009, drumTop - 0.135, dz);
  cab.add(mf);
  cab.add(box("DrumPanel", 0.01, 0.4, 0.07, baseM, -drumR + 0.007, drumTop - drumDepth / 2 - 0.01, dz));
  // fabric softener cup on the rim of the drum (front right in Samsung's lid-open photo)
  const sc = box("SoftenerCup", 0.034, 0.008, 0.02, blueM, Math.cos(0.75) * 0.183, floorY - 0.012, dz + Math.sin(0.75) * 0.183);
  sc.rotation.y = -0.75 - Math.PI / 2; cab.add(sc);
  // the bleach compartment's blue cap and the dark knob beside it, on the tub cover right of the detergent box
  cab.add(cyl("BleachRing", 0.031, 0.031, 0.006, detBlack, 0.144, floorY + 0.003, xz(0.37), 32));
  const bc = new THREE.SphereGeometry(0.022, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2); bc.scale(1, 0.85, 1);
  cab.add(mesh("BleachCap", bc, blueM, 0.144, floorY + 0.005, xz(0.37)));
  const kn = new THREE.SphereGeometry(0.012, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2);
  cab.add(mesh("TubKnob", kn, detBlack, 0.212, floorY + 0.001, xz(0.37)));
  // the detergent box's housing: a shelf over the back of the opening and a hood the drawer slides under
  cab.add(box("DetShelf", 0.196, 0.002, 0.075, detBlack, 0, floorY + 0.0005, xz(0.3675)));
  cab.add(box("DetHood", 0.196, 0.0515, 0.045, detBlack, 0, floorY + 0.004 + 0.02575, xz(0.3825)));
}

// ── lid: hinged at its back edge, a black frame round a large tinted glass window; it sits 2 mm over the top cover ──
const PIV = [0.9335, LID1];
const lid = group("Lid", 0, PIV[0], xz(PIV[1]));
{
  const s = roundRect(new THREE.Shape(), -0.258, 0.258, LID0, LID1, 0.022, 0.006);
  s.holes.push(roundRect(new THREE.Path(), -0.233, 0.233, 0.049, 0.4, 0.008, 0.008));
  const fr = prism("LidFrame", s, (xf) => seat(xf) + 0.002, lidTop, black, { bev: 0.003, curve: 5 });
  fr.geometry.translate(0, -PIV[0], -xz(PIV[1]));
  lid.add(fr);
  // the tempered glass: one sloped pane just under the frame's top
  const slope = Math.atan(0.1286), f0 = 0.046, f1 = 0.403, wxf = (f0 + f1) / 2;
  const pane = mesh("LidWindow", new THREE.PlaneGeometry(0.472, (f1 - f0) / Math.cos(slope)), glassM, 0, lidTop(wxf) - 0.0025 - PIV[0], xz(wxf) - xz(PIV[1]));
  pane.rotation.x = -Math.PI / 2 + slope;
  lid.add(pane);
}
root.add(lid);

// ── rear control panel: the black housing behind the lid, the panel glass on its slope (Samsung's own layout) ──
{
  const prof = [[HX, 0.87], [HX, 0.9345], [0.5073, 0.9864], [0.5125, 0.988], [0.551, 0.941], [0.5555, 0.914], [0.5641, 0.898], [0.566, 0.888], [0.566, 0.87]];
  cab.add(sideSlab("PanelHousing", prof, 0.524, black));
  const p0 = [HX, 0.9345], p1 = [0.5073, 0.9864];
  const dx = p1[0] - p0[0], dy = p1[1] - p0[1], len = Math.hypot(dx, dy), ang = Math.atan2(dy, dx);
  const pg = group("PanelPlane", 0, (p0[1] + p1[1]) / 2, xz((p0[0] + p1[0]) / 2));
  pg.rotation.x = ang;                      // tilted up toward the back, its face toward the shopper
  pg.position.y += 0.0013 * Math.cos(ang); pg.position.z += 0.0013 * Math.sin(ang);
  const face = mesh("PanelFace", flipV(new THREE.PlaneGeometry(0.505, len)), panelM, 0, 0, 0);
  face.rotation.x = -Math.PI / 2;
  pg.add(face);
  // the Washing Cycles ring, raised: photo px (787.0, 473.5), radii 89.3-92.2 px, at 3.80 px/mm on a panel 1920 x 416 px from y 268
  const mm = 3.8, u = (787.0 - 960) / mm / 1000, v = (473.5 - (268 + 208)) / mm / 1000 * (len / 0.1095);
  const ring = mesh("PowerRing", new THREE.RingGeometry(89.3 / mm / 1000, 92.2 / mm / 1000, 72), ringM, u, 0.0006, v);
  ring.rotation.x = -Math.PI / 2; pg.add(ring);
  root.add(pg);
}

// ── detergent box: a drawer at the back of the tub cover, a sloped gloss face, two cups with blue BubbleStorm impellers ──
const det = group("DetergentBox", 0, floorY + 0.0025, xz(0.37));     // 1 mm over the shelf
{
  const tilt = (70 * Math.PI) / 180;                      // the 66 mm face leans back 20 degrees, its lip just over the hood
  const fh = 0.066, fz = 0.035;                            // the face's lower edge, 35 mm in front of the drawer's centre
  const face = mesh("DetFace", flipV(new THREE.BoxGeometry(0.18, fh, 0.006)), [detBlack, detBlack, detBlack, detBlack, detM, detBlack], 0, 0, 0);
  face.position.set(0, (fh / 2) * Math.sin(tilt), fz - (fh / 2) * Math.cos(tilt));
  face.rotation.x = -(Math.PI / 2 - tilt);
  det.add(face);
  // the tray behind the face (hidden under the hood when shut): floor, walls and the divider between the two cups
  // (deep cups, as in Samsung's photo of the open box; the walls end 13 mm in front of the centre, behind the face)
  const tz = -0.016;
  det.add(box("DetTray", 0.172, 0.003, 0.058, detBlack, 0, 0.0015, tz));
  for (const sx of [-1, 0, 1]) det.add(box("DetWall", 0.003, 0.047, 0.058, detBlack, sx * 0.0845, 0.0265, tz));
  det.add(box("DetWall", 0.172, 0.047, 0.003, detBlack, 0, 0.0265, tz - 0.0275));
  for (const sx of [-1, 1]) {
    // the BubbleStorm impeller stands on a post near the rim of its cup, six pitched blades round a hub
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

// ── the back: the water inlet valve at the top, the power cord with its 3-pin plug, the drain hose (from the manual's drawing) ──
{
  cab.add(box("InletValve", 0.05, 0.047, 0.012, black, 0.19, 0.8565, zB - 0.0032));
  for (let i = 0; i < 4; i++) cab.add(box("InletRib", 0.054, 0.003, 0.004, black, 0.19, 0.84 + i * 0.011, zB - 0.0105));
  cab.add(cyl("InletThread", 0.011, 0.011, 0.016, black, 0.19, 0.8, zB - 0.004, 18).rotateX(Math.PI / 2));
  const cp = [[0.215, 0.3], [0.238, 0.22], [0.224, 0.14], [0.17, 0.12], [0.1, 0.115]].map(([x, y]) => new THREE.Vector3(x, y, zB - 0.006));
  cab.add(mesh("PowerCord", new THREE.TubeGeometry(new THREE.CatmullRomCurve3(cp, false, "centripetal"), 70, 0.004, 6, false), cordM));
  cab.add(mesh("Plug", new THREE.BoxGeometry(0.045, 0.042, 0.02), plugM, 0.095, 0.115, zB - 0.016));
  for (const [dx, dy] of [[0, 0.0105], [-0.0095, -0.0065], [0.0095, -0.0065]]) cab.add(cyl("PlugPin", 0.0026, 0.0026, 0.016, pinM, 0.095 + dx, 0.115 + dy, zB - 0.034, 10).rotateX(Math.PI / 2));
  const hp = [[0.2, 0.13], [0.232, 0.085], [0.226, 0.035], [0.17, 0.0135], [0.09, 0.0125]].map(([x, y]) => new THREE.Vector3(x, y, zB - 0.016));
  cab.add(mesh("DrainHose", new THREE.TubeGeometry(new THREE.CatmullRomCurve3(hp, false, "centripetal"), 60, 0.0105, 10, false), hose));
}

const parts = productParts(PRODUCTS, ID);
const clips = stateClips(root, parts);
saveZones(PRODUCTS, ID, root, parts);
await exportGLB(root, clips, OUT, {
  SideL: `${T}/side_l.jpg`, SideR: `${T}/side.jpg`, PanelFace: `${T}/panel.jpg`, LabelBEE: `${T}/label.png`,
  DiamondDrum: `${T}/drum.jpg`, Pulsator: `${T}/pulsator.jpg`, DetergentFace: `${T}/detergent.jpg`, MagicFilter: `${T}/filter.jpg`,
}, { dir: `${TEX}/grain`, materials: {
  // Grain (BENCHMARK.md section 10): painted Deep Charcoal cabinet, sides and top cover get the soft peel; the black lid frame
  // and panel housing are smooth gloss plastic in Samsung's photos (the strong peel read as pebbled leather): the soft peel too;
  // the matt moulded plinth the strong peel; nothing on the panel glass or the label, which carry print
  Body: { type: "peel_soft" }, SideL: { type: "peel_soft" }, SideR: { type: "peel_soft" }, TopCover: { type: "peel_soft" },
  BlackPlastic: { type: "peel_soft" }, Plinth: { type: "peel_strong" },
} });
