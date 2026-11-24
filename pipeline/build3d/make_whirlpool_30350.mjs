// Whirlpool Ace Turbo Dry Xtra 8.5 kg 5 star semi-automatic (twin-tub) washing machine, item code 30350 (Purple Dazzle),
// with Whirlpool's two other colours of the same body as material variants: Wine (Whirlpool 30351) and Grey (30352).
// Built to Whirlpool's published size, 870 W x 966 H x 512 D mm (Whirlpool India's page for 30350, VERIFIED), from
// Whirlpool's own pictures (pipeline/sources/photos/whirlpool_30350; private/research/whirlpool_30350/NOTES.md):
//   top_open.jpg      the plan: the D-shaped left end, the wash tub, the spin well, the console, the lids' hinges
//   console_top.jpg   the console and its print (tex_whirlpool_30350.py), the spin lid, the right-hand handle
//   front.jpg, three_quarter.jpg, side_right.jpg   the heights, the console's slope, the ribs, wheels and feet
// Two lids, each its own button: the round wash lid hinges at its left edge and folds over to the left (top_open.jpg
// shows it standing past upright); the spin lid hinges at its back edge, in front of the console, and stands upright.
// usage: node make_whirlpool_30350.mjs <entry.json> <tex dir> <out.glb>
import fs from "node:fs";
import { NodeIO } from "@gltf-transform/core";
import { ALL_EXTENSIONS, KHRMaterialsVariants, KHRMaterialsClearcoat } from "@gltf-transform/extensions";
import { THREE, mat, mesh, box, group, inward, flipV, stateClips, exportGLB, productParts, saveZones, tidyJSON } from "./lib.mjs";

const [PRODUCTS, TEX, OUT] = process.argv.slice(2);
const ID = "whirlpool-30350";
const T = `${TEX}/whirlpool_30350`;
const mm = (v) => v / 1000;

// ── the colours (Whirlpool's photos of each, the plain body under studio light, raised ~15 % for the light's fall-off) ──
const FINISHES = [
  { name: "Purple Dazzle", body: 0x40276a },
  { name: "Wine", body: 0x4f1c2f },
  { name: "Grey", body: 0x535354 },
];

// ── sizes (metres). VERIFIED: 870 W (body 845 + the right-hand handle), 966 H (the console's top), 512 D. ──
const X = (xmm) => -0.435 + mm(xmm);             // mm from the body's left end (the D's leftmost point)
const Zb = (zmm) => -0.256 + mm(zmm);            // mm from the back
const Y0 = 0.04;                                 // the body's underside (front.jpg: the feet and wheels show 35-45 mm) ESTIMATED
const STEP = 0.275;                              // the plinth's seam (front.jpg, ~275 mm up) ESTIMATED
const DECK = 0.84;                               // the top deck (front.jpg and side_right.jpg, ±15 mm) ESTIMATED
const XR = 0.41;                                 // the body's right end (845 mm); the handle stands out to 870
const WASH = { x: X(240), z: 0, lidR: 0.228 };   // the wash lid: 456 mm across, 12 mm in from the D (front.jpg, top_open.jpg)
const SPIN = { x0: X(483), x1: X(833), z0: Zb(124), z1: Zb(500) };     // the spin lid (console_top.jpg)
const WELL = { x0: X(500), x1: X(815), z0: Zb(144), z1: Zb(441) };     // the spin well's opening (top_open.jpg)
const CON = { x0: X(478), x1: X(838), zf: Zb(118), yf: 0.900, zt: Zb(8), yt: 0.958 };   // the console and its sloped face
const FACE = { w: 0.344, h: 0.125 };             // the printed face (tex_whirlpool_30350.py)

const bodyM = mat("Body", FINISHES[0].body, { rough: 0.34 });
const glassM = mat("LidGlass", 0x38383d, { metal: 0.2, rough: 0.06 });          // the wash lid: smoked grey glass (front.jpg, three_quarter.jpg)
const spinM = mat("SpinGlass", 0x1c1c20, { metal: 0.2, rough: 0.05 });          // the spin lid: darker smoked glass (console_top.jpg, front.jpg)
const spinStripM = mat("SpinStrip", 0x4a4a50, { metal: 0.2, rough: 0.1 });      // its grey front strip
const gripM = mat("Grip", 0xe2e2e6, { rough: 0.32 });                           // the knobs' light grey grips
const whiteM = mat("White", 0xeeeef0, { rough: 0.45 });                         // the dispenser, the basket
const tyreM = mat("Tyre", 0x1a1a1c, { rough: 0.8 });
const darkM = mat("Dark", 0x141416, { rough: 0.7 });
const decal = (n) => { const m = mat(n, 0xffffff, { rough: 0.4 }); m.alphaTest = 0.5; return m; };

const root = group("Whirlpool30350");
const cab = group("Cabinet");
root.add(cab);

// ── the body: a loft through plan outlines (a D at the left, a rounded right end), the plinth set in under a seam ──
function outline(cxD, zh, xR, rc) {
  const pts = [];
  const seg = (a, b, n) => { for (let i = 0; i < n; i++) pts.push([a[0] + (b[0] - a[0]) * i / n, a[1] + (b[1] - a[1]) * i / n]); };
  const arc = (cx, cz, r, a0, a1, n) => { for (let i = 0; i < n; i++) { const a = a0 + (a1 - a0) * i / n; pts.push([cx + r * Math.cos(a), cz + r * Math.sin(a)]); } };
  const xm = (cxD + xR - rc) / 2;
  seg([xm, -zh], [xR - rc, -zh], 6);
  arc(xR - rc, -zh + rc, rc, -Math.PI / 2, 0, 6);
  seg([xR, -zh + rc], [xR, zh - rc], 8);
  arc(xR - rc, zh - rc, rc, 0, Math.PI / 2, 6);
  seg([xR - rc, zh], [cxD, zh], 12);
  arc(cxD, 0, zh, Math.PI / 2, Math.PI * 1.5, 48);
  seg([cxD, -zh], [xm, -zh], 6);
  return pts;
}
const cxD = X(256);
const RINGS = [
  [Y0, outline(cxD + 0.013, 0.246, XR - 0.014, 0.026)],
  [STEP - 0.004, outline(cxD + 0.010, 0.250, XR - 0.010, 0.026)],
  [STEP + 0.004, outline(cxD + 0.010, 0.256, XR - 0.004, 0.03)],
  [DECK, outline(cxD, 0.256, XR, 0.03)],
];
function loftBand(a, b) {
  const [ya, pa] = a, [yb, pb] = b, n = pa.length;
  const pos = [], idx = [];
  for (let i = 0; i <= n; i++) { const p = pa[i % n], q = pb[i % n]; pos.push(p[0], ya, p[1], q[0], yb, q[1]); }
  for (let i = 0; i < n; i++) { const k = i * 2; idx.push(k, k + 2, k + 1, k + 1, k + 2, k + 3); }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  // the outlines run clockwise seen from above: make the faces look outward (the front wall's normal must point to +z)
  let k = 0;
  for (let i = 1; i < n; i++) if (pa[i][1] > pa[k][1]) k = i;
  if (g.attributes.normal.getZ(2 * k) < 0) inward(g);
  g.setAttribute("uv", new THREE.Float32BufferAttribute(new Float32Array((n + 1) * 4).fill(0.5), 2));
  return g;
}
for (let i = 0; i < RINGS.length - 1; i++) cab.add(mesh(`Shell${i}`, loftBand(RINGS[i], RINGS[i + 1]), bodyM));
// the underside
{
  const s = new THREE.Shape(RINGS[0][1].map(([x, z]) => new THREE.Vector2(x, z)));
  const g = new THREE.ShapeGeometry(s);
  g.rotateX(Math.PI / 2);
  if (g.attributes.normal.getY(0) > 0) inward(g);
  cab.add(mesh("Underside", g, darkM, 0, Y0, 0));
}
// the deck, with the wash collar's and the spin well's holes
const rr = (x0, z0, x1, z1, r, path) => {
  const s = path ? new THREE.Path() : new THREE.Shape();
  // in the deck's shape plane (x, -z)
  const y0 = -z1, y1 = -z0;
  s.moveTo(x0 + r, y0); s.lineTo(x1 - r, y0); s.quadraticCurveTo(x1, y0, x1, y0 + r); s.lineTo(x1, y1 - r);
  s.quadraticCurveTo(x1, y1, x1 - r, y1); s.lineTo(x0 + r, y1); s.quadraticCurveTo(x0, y1, x0, y1 - r); s.lineTo(x0, y0 + r);
  s.quadraticCurveTo(x0, y0, x0 + r, y0);
  return s;
};
const COLLAR_R = 0.236;
{
  const s = new THREE.Shape(RINGS[3][1].map(([x, z]) => new THREE.Vector2(x, -z)));
  const h1 = new THREE.Path(); h1.absarc(WASH.x, -WASH.z, COLLAR_R, 0, Math.PI * 2, true); s.holes.push(h1);
  s.holes.push(rr(WELL.x0, WELL.z0, WELL.x1, WELL.z1, 0.02, true));
  const g = new THREE.ShapeGeometry(s, 48);
  g.rotateX(-Math.PI / 2);
  if (g.attributes.normal.getY(0) < 0) inward(g);
  const d = mesh("Deck", g, bodyM);
  d.position.y = DECK;
  cab.add(d);
}
// a surface of revolution about a vertical axis from (r, y) points; `out` = the first segment's face looks away from the axis
function ylathe(name, prof, m, out = true, seg = 96) {
  const g = new THREE.LatheGeometry(prof.map(([r, y]) => new THREE.Vector2(r, y)), seg);
  // LatheGeometry's faces: test the first segment's normal against the radial direction
  const n = g.attributes.normal, p = g.attributes.position;
  const radial = p.getX(0) * n.getX(0) + p.getZ(0) * n.getZ(0);
  const dy = prof[1][1] - prof[0][1], dr = prof[1][0] - prof[0][0];
  const faceOut = Math.abs(dy) >= Math.abs(dr) ? radial > 0 : n.getY(0) > 0;
  if (faceOut !== out) inward(g);
  return mesh(name, g, m);
}
// the wash collar and tub: up the collar's outside, over its lip, down the funnel and the tub's wall, across the floor
{
  const t = ylathe("WashTub", [
    [COLLAR_R, DECK], [COLLAR_R, DECK + 0.018], [0.232, DECK + 0.022], [0.206, DECK + 0.022], [0.199, DECK + 0.012],
    [0.188, DECK - 0.03], [0.186, 0.40], [0.17, 0.372], [0.14, 0.366],
  ], bodyM, true);
  t.position.set(WASH.x, 0, WASH.z);
  cab.add(t);
  // the impeller (top_open.jpg: white with dark pads and vanes, "ace" on the hub), 3 mm over the floor's inner edge
  const ig = new THREE.CircleGeometry(0.142, 96);
  ig.rotateX(-Math.PI / 2);
  flipV(ig);
  const imp = mesh("Impeller", ig, mat("ImpellerTex", 0xffffff, { rough: 0.45 }), WASH.x, 0.369, WASH.z);
  cab.add(imp);
  // its hub with the moulded "ace" (hub.jpg at 10 px/mm), 1.3 mm over the photo's hub, the word read from the front
  const hg = new THREE.CircleGeometry(0.03, 64);
  hg.rotateX(-Math.PI / 2);
  flipV(hg);
  cab.add(mesh("ImpellerHub", hg, mat("HubTex", 0xffffff, { rough: 0.5 }), WASH.x, 0.369 + 0.0013, WASH.z));
  // the Dynamix dispenser and lint filter on the tub's wall (tub_inside.jpg): white channel, blue detergent cup
  const dir = new THREE.Vector3(0.45, 0, -0.89).normalize();
  const disp = group("Dispenser", WASH.x + dir.x * 0.178, 0, WASH.z + dir.z * 0.178);
  disp.rotation.y = Math.atan2(-dir.x, -dir.z);
  disp.add(box("DispenserChannel", 0.05, 0.36, 0.014, whiteM, 0, 0.6, 0));
  const cup = new THREE.BoxGeometry(0.05, 0.026, 0.022);
  disp.add(mesh("DetergentCup", cup, [mat("CupSide", 0x31a6dc, { rough: 0.35 }), mat("CupSide", 0x31a6dc, { rough: 0.35 }), mat("CupSide", 0x31a6dc, { rough: 0.35 }), mat("CupSide", 0x31a6dc, { rough: 0.35 }), mat("Detergent", 0xffffff, { rough: 0.35 }), mat("CupSide", 0x31a6dc, { rough: 0.35 })], 0, 0.765, 0.012));
  cab.add(disp);
}
// the spin well (inward walls) with the white spin basket and its cap
{
  const ring = rr(WELL.x0, WELL.z0, WELL.x1, WELL.z1, 0.02, false).getPoints(48).map((v) => [v.x, -v.y]);
  if (ring.length && ring[0][0] === ring[ring.length - 1][0] && ring[0][1] === ring[ring.length - 1][1]) ring.pop();
  const g = loftBand([0.44, ring], [DECK, ring]);
  inward(g);
  // loftBand turned it outward; the well is seen from inside
  cab.add(mesh("SpinWell", g, bodyM));
  const fl = new THREE.ShapeGeometry(rr(WELL.x0, WELL.z0, WELL.x1, WELL.z1, 0.02, false), 48);
  fl.rotateX(-Math.PI / 2);
  if (fl.attributes.normal.getY(0) < 0) inward(fl);
  cab.add(mesh("SpinWellFloor", fl, bodyM, 0, 0.44, 0));
  const bx = X(650), bz = Zb(292);
  const basket = ylathe("SpinBasket", [[0.113, DECK - 0.11], [0.113, DECK - 0.052], [0.108, DECK - 0.047]], whiteM, true, 72);
  basket.position.set(bx, 0, bz);
  cab.add(basket);
  const cg = new THREE.CircleGeometry(0.108, 72);
  cg.rotateX(-Math.PI / 2);
  flipV(cg);
  cab.add(mesh("SpinCap", cg, mat("SpinCapTex", 0xffffff, { rough: 0.45 }), bx, DECK - 0.047, bz));
}
// the front's three raised ribs (front.jpg: 96 mm wide, 136-613 mm from the left, ~330-700 mm up), 3 mm proud; the first
// runs onto the D's curve, so each rib is built over the wall it lies on
function rib(a, b, y0, y1, h = 0.003) {
  const N = 16, pos = [], idx = [];
  const at = (xmm, y) => {
    const c = cxD + 0.010 * (DECK - y) / (DECK - (STEP + 0.004));          // the D's centre leans in with the taper
    const x = X(xmm);
    if (x >= c) return [[x, 0.256], [0, 1]];
    const dx = x - c, z = Math.sqrt(Math.max(0, 0.256 * 0.256 - dx * dx));
    return [[x, z], [dx / 0.256, z / 0.256]];
  };
  const quad = (p0, p1, p2, p3) => { const k = pos.length / 3; pos.push(...p0, ...p1, ...p2, ...p3); idx.push(k, k + 1, k + 2, k, k + 2, k + 3); };
  const P = (xmm, y, off) => { const [[x, z], [nx, nz]] = at(xmm, y); return [x + nx * off, y, z + nz * off]; };
  for (let i = 0; i < N; i++) {
    const u0 = a + (b - a) * i / N, u1 = a + (b - a) * (i + 1) / N;
    quad(P(u0, y0, h), P(u1, y0, h), P(u1, y1, h), P(u0, y1, h));                    // the face
    quad(P(u0, y1, h), P(u1, y1, h), P(u1, y1, -0.001), P(u0, y1, -0.001));          // the top
    quad(P(u1, y0, h), P(u0, y0, h), P(u0, y0, -0.001), P(u1, y0, -0.001));          // the bottom
  }
  quad(P(a, y0, -0.001), P(a, y0, h), P(a, y1, h), P(a, y1, -0.001));                // the ends
  quad(P(b, y0, h), P(b, y0, -0.001), P(b, y1, -0.001), P(b, y1, h));
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  if (g.attributes.normal.getZ(0) < 0) inward(g);
  g.setAttribute("uv", new THREE.Float32BufferAttribute(new Float32Array(pos.length / 3 * 2).fill(0.5), 2));
  return g;
}
for (const [a, b] of [[136, 232], [327, 422], [518, 613]]) cab.add(mesh("Rib", rib(a, b, 0.33, 0.70, 0.002), bodyM));
// the right-hand handle (console_top.jpg, three_quarter.jpg): a bar along the right end's top, 25 mm out
cab.add(box("Handle", 0.025, 0.026, 0.40, bodyM, XR + 0.0125 - 0.0005, DECK - 0.048, 0));
// wheels at the right end, front and back (front.jpg, side_right.jpg: ~84 mm, ESTIMATED), feet at the left end
for (const z of [0.205, -0.205]) {
  const w = new THREE.CylinderGeometry(0.042, 0.042, 0.026, 40);
  w.rotateX(Math.PI / 2);
  cab.add(mesh("Wheel", w, tyreM, X(790), 0.042, z));
  const h = new THREE.CylinderGeometry(0.022, 0.022, 0.031, 24);
  h.rotateX(Math.PI / 2);
  cab.add(mesh("WheelHub", h, bodyM, X(790), 0.042, z));
}
for (const z of [0.17, -0.17]) cab.add(mesh("Foot", new THREE.CylinderGeometry(0.022, 0.024, Y0 + 0.004, 32), darkM, X(95), (Y0 + 0.004) / 2, z));
// the water level selector behind the wash lid (top_open.jpg, console_top.jpg) and its print
cab.add(mesh("WaterSelector", new THREE.CylinderGeometry(0.011, 0.012, 0.016, 32), bodyM, X(340), DECK + 0.008, Zb(30)));
{
  const g = flipV(new THREE.PlaneGeometry(0.03, 0.011));
  g.rotateX(-Math.PI / 2);
  cab.add(mesh("WaterSelectorPrint", g, decal("DeckPrint"), X(312), DECK + 0.0013, Zb(24.5)));
}

// ── the console: its side profile extruded across, the sloped face carrying the print and the four knobs ──
{
  const s = new THREE.Shape();
  s.moveTo(CON.zf, DECK - 0.002); s.lineTo(CON.zf, CON.yf); s.lineTo(CON.zt, CON.yt);
  s.quadraticCurveTo(Zb(2), CON.yt + 0.006, Zb(2), CON.yt - 0.004);
  s.lineTo(Zb(2), DECK - 0.002); s.lineTo(CON.zf, DECK - 0.002);
  const g = new THREE.ExtrudeGeometry(s, { depth: CON.x1 - CON.x0, bevelEnabled: false, curveSegments: 6 });
  g.rotateY(-Math.PI / 2);
  // shape x became +z, extrusion ran to -x: put it at x0..x1
  const con = mesh("Console", g, bodyM, CON.x1, 0, 0);
  root.add(con);
  // the face's frame: origin at the face's top-left, u across (+x), v down the slope, n out of the face
  const slope = new THREE.Vector3(0, CON.yf - CON.yt, CON.zf - CON.zt).normalize();      // down the face
  const n = new THREE.Vector3(0, -slope.z, slope.y).multiplyScalar(-1);
  if (n.y < 0) n.multiplyScalar(-1);
  const faceX0 = (CON.x0 + CON.x1) / 2 - FACE.w / 2;
  const at = (u, v, lift = 0) => new THREE.Vector3(faceX0 + u, CON.yt, CON.zt).addScaledVector(slope, v).addScaledVector(n, lift);
  const q = new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(new THREE.Vector3(1, 0, 0), slope.clone().negate(), n));
  const fp = flipV(new THREE.PlaneGeometry(FACE.w, FACE.h));
  const print = mesh("ConsolePrint", fp, decal("ConsolePrint"));
  print.position.copy(at(FACE.w / 2, FACE.h / 2, 0.0013));
  print.quaternion.copy(q);
  root.add(print);
  // the knobs: a body-coloured dial and a light grey grip standing off it (console_top.jpg: dial 52 mm, grip 13.5 x 57 mm;
  // the grip's height, 16 mm, read off side_right.jpg, ESTIMATED)
  const K = FACE.w / 0.352;
  for (const u of [49.7, 137.3, 215.5, 301.8].map((v) => mm(v * K))) {
    const k = group("Knob");
    k.position.copy(at(u, mm(58 * K), 0));
    k.quaternion.copy(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), n));
    // after that turn the knob's local z must run down the face: line it up
    const lz = new THREE.Vector3(0, 0, 1).applyQuaternion(k.quaternion);
    const ang = Math.atan2(lz.clone().cross(slope).dot(n), lz.dot(slope));
    k.quaternion.premultiply(new THREE.Quaternion().setFromAxisAngle(n, ang));
    k.add(ylathe("KnobDial", [[0.0262, -0.002], [0.0262, 0.008], [0.0245, 0.0105], [0.0, 0.0105]], bodyM, true, 64));
    const grip = new THREE.BoxGeometry(0.0135, 0.0148, 0.054);
    k.add(mesh("KnobGrip", grip, gripM, 0, 0.0105 + 0.0074 - 0.0005, 0));
    root.add(k);
  }
}

// ── the wash lid: hinged at its left edge, it folds up and over to the left ──
const washLid = group("WashLid", WASH.x - WASH.lidR - 0.002, DECK + 0.0245, WASH.z);
{
  const c = group("WashLidCentre", WASH.lidR + 0.002, 0, 0);
  // the purple rim and underside: in over the glass's edge, across the top of the rim, down its outside, under it all
  c.add(ylathe("WashLidRim", [[0.2125, 0.0205], [0.215, 0.025], [0.225, 0.025], [WASH.lidR, 0.0205], [WASH.lidR, 0.004],
    [WASH.lidR - 0.003, 0.0], [0.0, 0.0]], bodyM, false, 96));
  const gg = new THREE.CircleGeometry(0.2138, 96);      // its edge runs in under the rim's lip: no seam to see through
  gg.rotateX(-Math.PI / 2);
  c.add(mesh("WashLidGlass", gg, glassM, 0, 0.0205, 0));
  // the Whirlpool wordmark (front.jpg: 172 mm wide, its centre 63 mm right of and 106 mm behind the lid's centre)
  const lg = flipV(new THREE.PlaneGeometry(0.172, 0.0587));
  lg.rotateX(-Math.PI / 2);
  c.add(mesh("WashLidLogo", lg, decal("LidLogo"), 0.063, 0.0205 + 0.0013, -0.106));
  washLid.add(c);
}
root.add(washLid);

// ── the spin lid: hinged at its back edge in front of the console, it stands up ──
const spinLid = group("SpinLid", 0, DECK + 0.019, SPIN.z0);
{
  const w = SPIN.x1 - SPIN.x0, d = SPIN.z1 - SPIN.z0, cx = (SPIN.x0 + SPIN.x1) / 2;
  spinLid.add(box("SpinLidFrame", w, 0.0135, d, bodyM, cx, -0.019 + 0.003 + 0.00675, d / 2));
  spinLid.add(box("SpinLidGlass", w - 0.006, 0.0025, d - 0.024, spinM, cx, -0.00125, (d - 0.024) / 2 + 0.003));
  spinLid.add(box("SpinLidStrip", w - 0.006, 0.0025, 0.018, spinStripM, cx, -0.00125, d - 0.021 + 0.009));
  // "ace TurboDry" (console_top.jpg: 106 mm wide, centred 182 mm from the lid's left, 175 mm from its back)
  const lg = flipV(new THREE.PlaneGeometry(0.106, 0.016));
  lg.rotateX(-Math.PI / 2);
  spinLid.add(mesh("SpinLidLogo", lg, decal("SpinLogo"), SPIN.x0 + 0.182, 0.0013, 0.175));
}
root.add(spinLid);

const parts = productParts(PRODUCTS, ID);
const clips = stateClips(root, parts);
saveZones(PRODUCTS, ID, root, parts);
fs.writeFileSync(new URL(`../entries/${ID}.gate.json`, import.meta.url), tidyJSON({ sticksOut: {} }));
await exportGLB(root, clips, OUT, {
  ConsolePrint: `${T}/console_print.png`, LidLogo: `${T}/lid_logo.png`, SpinLogo: `${T}/spin_logo.png`, DeckPrint: `${T}/deck_print.png`,
  ImpellerTex: `${T}/impeller.jpg`, HubTex: `${T}/hub.jpg`, SpinCapTex: `${T}/spin_cap.jpg`, Detergent: `${T}/detergent.jpg`,
}, { dir: `${TEX}/grain`, materials: { Body: { type: "peel_soft" } } });

// ── the colours as KHR_materials_variants (Purple Dazzle first); the two glass lids get a clear coat ──
{
  const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
  const doc = await io.read(OUT);
  const R = doc.getRoot();
  const byName = (n) => R.listMaterials().find((m) => m.getName() === n);
  const coatExt = R.listExtensionsUsed().find((e) => e.extensionName === "KHR_materials_clearcoat") || doc.createExtension(KHRMaterialsClearcoat);
  for (const n of ["LidGlass", "SpinGlass", "SpinStrip"]) byName(n).setExtension("KHR_materials_clearcoat", coatExt.createClearcoat().setClearcoatFactor(1).setClearcoatRoughnessFactor(0.03));
  const varExt = doc.createExtension(KHRMaterialsVariants);
  const lin = (c) => [(c >> 16) & 255, (c >> 8) & 255, c & 255].map((v) => { v /= 255; return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; });
  const base = byName("Body");
  const mats = FINISHES.map((f, i) => (i === 0 ? base : base.clone().setName(`Body_${f.name.replace(/\W+/g, "")}`)).setBaseColorFactor([...lin(f.body), 1]));
  const variants = FINISHES.map((f) => varExt.createVariant(f.name));
  let mapped = 0;
  for (const node of R.listNodes()) for (const p of node.getMesh()?.listPrimitives() || []) {
    if (p.getMaterial() !== base) continue;
    const list = varExt.createMappingList();
    FINISHES.forEach((f, i) => list.addMapping(varExt.createMapping().setMaterial(mats[i]).addVariant(variants[i])));
    p.setExtension("KHR_materials_variants", list);
    mapped++;
  }
  fs.writeFileSync(OUT, await io.writeBinary(doc));
  console.log(`variants: ${FINISHES.map((f) => f.name).join(", ")}; ${mapped} primitives mapped;`, (fs.statSync(OUT).size / 1048576).toFixed(2), "MB");
}
