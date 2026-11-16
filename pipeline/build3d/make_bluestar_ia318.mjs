// Blue Star IA318EXU, 1.5 ton (1.44 TR) 3 star E Series inverter split AC, indoor unit, Basic White.
// Size from Blue Star's own product page: indoor unit 931 x 235 x 315 mm (W x D x H); Sangeetha's listing agrees
// (93.1 x 31.5 x 23.5 cm, W x H x D). Shape from Blue Star's gallery (front 01, 3/4 left 02, 3/4 right 03), measured on
// the straight-on front at 1.1643 px per mm: a flat front panel (923 x 248 mm, 26 mm corners) with a light rim and a
// thin darker line round its face, the BLUE STAR badge top left, the hidden "24 C" display right; under it a lip and
// the curved louvre over the outlet (louvre span cols 125..1075 = 816 mm, 41.5 mm tall seen from the front, the slit
// above it at 45..47 mm); side caps with a knock-out cover low at the back of each side; a flat back at z = 0.
// The louvre's swing is motorised (Blue Star: "a motorised horizontal and vertical swing"); no photo shows it open, so
// its open angle is ESTIMATED. No photo shows the top, the back, the underside, the front panel lifted or the vertical
// vanes behind the louvre, so those are plain (top, back, underside) or left out (vanes, filters): see NOTES.md.
// usage: node make_bluestar_ia318.mjs <entries json> <tex dir> <out.glb>
import { THREE, mat, mesh, box, group, stateClips, exportGLB, productParts, saveZones } from "./lib.mjs";

const [PRODUCTS, TEX, OUT] = process.argv.slice(2);
const ID = "bluestar-ia318exu";

// ── size (metres) ──
const W = 0.931, H = 0.315, D = 0.235, XH = W / 2;
const capT = 0.018, capB = 0.008;               // side caps 18 mm thick, edges rounded 8 mm (Blue Star 02, 03: soft round edges)
const xIn = XH - capT;                          // the body between the caps
const zB = D - 0.016;                           // the body's front behind the 16 mm front panel
const zC = D - 0.0035;                          // the side caps come forward round the panel's ends (Blue Star 02, 03), 2 mm behind its rim
const yP0 = 0.067;                              // panel bottom (photo row 698 = 67 mm up)
const xP = 0.4615, rP = 0.026, bP = 0.003;      // panel half width (923 mm), corner radius, edge round
const yLip = 0.065, zL0 = 0.229, zL1 = 0.227;   // the lip under the panel (2 mm below it), sloping back a little
const yE = 0.047, zE = 0.175;                   // the lower front curve: centre (zE, yE), radii (zL1 - zE, yE)
const xL = 0.4085;                              // the outlet (and the louvre) span |x| < 0.4085 (photo cols 125..1075)
const rb = 0.020, rt = 0.020, rf = 0.010;       // back-bottom, back-top and front-top corners of the side profile

const deg = THREE.MathUtils.degToRad;
const arc = (cz, cy, az, ay, t0, t1, n) => [...Array(n + 1).keys()].map((i) => {
  const t = deg(t0 + (t1 - t0) * (i / n));
  return [cz + az * Math.cos(t), cy + ay * Math.sin(t)];
});
const lin = (a, b, n) => [...Array(n + 1).keys()].map((i) => [a[0] + (b[0] - a[0]) * i / n, a[1] + (b[1] - a[1]) * i / n]);

// the side profile, clockwise seen from +x with z to the right, inset by e (for the rounded side caps)
function outline(e = 0) {
  return [
    ...arc(rb, rb, rb - e, rb - e, -90, -180, 6),
    ...arc(rt, H - rt, rt - e, rt - e, 180, 90, 6),
    ...arc(zC - rf, H - rf, rf - e, rf - e, 90, 0, 4),
    [zC - e, yLip - e], [zL0 - e, yLip - e],
    ...arc(zE, yE, zL1 - zE - e, yE - e, 0, -90, 16),
  ];
}

// ── materials ── Blue Star's views of this "Basic White" unit show a faintly blue-grey panel (211/210/217 on the straight-on
// front) a little darker than the body and louvre (sides 228, louvre 214). Matching those numbers on the web viewer took a panel
// albedo of 0x9e (a mid grey: 162 in Apple's renderer, where the Haier's white panel reads 248), so the colours keep a white
// plastic's albedo and only the panel's step below the body and its blue tint from the photos.
const body = mat("Body", 0xe6e6ea, { rough: 0.38 });
const back = mat("Back", 0xd3d5d9, { rough: 0.7 });
const rim = mat("PanelRim", 0xdedee3, { rough: 0.3 });
const face = mat("PanelFront", 0xd3d2da, { rough: 0.32 });
const line = mat("PanelLine", 0xa4a4aa, { rough: 0.5 });
const louvreMat = mat("Louvre", 0xe3e2e8, { rough: 0.32 });
const louvreIn = mat("LouvreInner", 0xc9cacf, { rough: 0.55 });
const outlet = mat("Outlet", 0x232529, { rough: 0.85 });
const badgeMat = mat("Badge", 0xffffff, { rough: 0.4 });
const dispMat = mat("Display", 0xffffff, { rough: 0.4, opacity: 0.999, emissive: 0x9a9a9a });

// ── geometry helpers (as in make_haier_hso52.mjs) ──
// A surface swept along x from a (z, y) polyline; normals to the left of the direction of travel (outward for a
// clockwise outline), `flip` turns them round.
function ribbon(name, pts, x0, x1, material, { flip = false } = {}) {
  const s = flip ? -1 : 1, n = pts.length;
  const len = [0];
  for (let i = 1; i < n; i++) len.push(len[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
  const pos = [], nor = [], uvs = [], idx = [];
  for (let i = 0; i < n; i++) {
    const a = pts[Math.max(0, i - 1)], b = pts[Math.min(n - 1, i + 1)];
    let tz = b[0] - a[0], ty = b[1] - a[1];
    const l = Math.hypot(tz, ty) || 1; tz /= l; ty /= l;
    for (const x of [x0, x1]) {
      pos.push(x, pts[i][1], pts[i][0]);
      nor.push(0, tz * s, -ty * s);
      uvs.push((x - x0) / (x1 - x0), len[i] / (len[n - 1] || 1));
    }
  }
  const P = (i) => new THREE.Vector3(pos[i * 3], pos[i * 3 + 1], pos[i * 3 + 2]);
  for (let i = 0; i < n - 1; i++) {
    const a = 2 * i, b = 2 * i + 1, c = 2 * i + 2, d = 2 * i + 3;
    const fn = new THREE.Vector3().crossVectors(P(c).sub(P(a)), P(b).sub(P(a)));
    const vn = new THREE.Vector3(nor[a * 3], nor[a * 3 + 1], nor[a * 3 + 2]).add(new THREE.Vector3(nor[c * 3], nor[c * 3 + 1], nor[c * 3 + 2]));
    if (fn.dot(vn) >= 0) idx.push(a, c, b, b, c, d); else idx.push(a, b, c, b, d, c);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute("normal", new THREE.Float32BufferAttribute(nor, 3));
  g.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
  g.setIndex(idx);
  return mesh(name, g, material);
}
function offset(pts, d) {
  const n = pts.length;
  return pts.map((p, i) => {
    const a = pts[Math.max(0, i - 1)], b = pts[Math.min(n - 1, i + 1)];
    let tz = b[0] - a[0], ty = b[1] - a[1];
    const l = Math.hypot(tz, ty) || 1;
    return [p[0] + (ty / l) * d, p[1] - (tz / l) * d];
  });
}
// a flat face in the plane x = const from a (z, y) polygon, facing +x (side 1) or -x (side -1)
function sideShape(name, poly, x, side, material) {
  const g = new THREE.ShapeGeometry(new THREE.Shape(poly.map(([z, y]) => new THREE.Vector2(side > 0 ? -z : z, y))));
  g.rotateY(side > 0 ? Math.PI / 2 : -Math.PI / 2);
  g.translate(x, 0, 0);
  return mesh(name, g, material);
}
function shell(name, outer, t, x0, x1, outerMat, innerMat, edgeMat) {
  const g = group(name);
  const inner = offset(outer, t);
  g.add(ribbon(name + "Outer", outer, x0, x1, outerMat));
  g.add(ribbon(name + "Inner", inner, x0, x1, innerMat, { flip: true }));
  g.add(ribbon(name + "Edge0", [inner[0], outer[0]], x0, x1, edgeMat));
  g.add(ribbon(name + "Edge1", [outer.at(-1), inner.at(-1)], x0, x1, edgeMat));
  const poly = [...outer, ...inner.slice().reverse()];
  g.add(sideShape(name + "EndL", poly, x0, -1, edgeMat));
  g.add(sideShape(name + "EndR", poly, x1, 1, edgeMat));
  return g;
}
function rrect(w, h, r) {
  const s = new THREE.Shape();
  s.moveTo(-w / 2 + r, -h / 2); s.lineTo(w / 2 - r, -h / 2); s.absarc(w / 2 - r, -h / 2 + r, r, -Math.PI / 2, 0);
  s.lineTo(w / 2, h / 2 - r); s.absarc(w / 2 - r, h / 2 - r, r, 0, Math.PI / 2);
  s.lineTo(-w / 2 + r, h / 2); s.absarc(-w / 2 + r, h / 2 - r, r, Math.PI / 2, Math.PI);
  s.lineTo(-w / 2, -h / 2 + r); s.absarc(-w / 2 + r, -h / 2 + r, r, Math.PI, 1.5 * Math.PI);
  return s;
}
// (decals are named Print… so that, ranked after PanelFace, they are the ones the anti-flicker step would move)
// a decal plane w x h centred at (x, y), facing +z at z, its photo the right way up
function decal(name, w, h, material, x, y, z) {
  const g = new THREE.PlaneGeometry(w, h);
  const uv = g.attributes.uv;
  for (let i = 0; i < uv.count; i++) uv.setY(i, 1 - uv.getY(i));
  return mesh(name, g, material, x, y, z);
}

const root = group("BlueStarIA318EXU");
const cab = group("Chassis");
root.add(cab);

// ── the body between the side caps: underside, back, top, the front behind the panel, the lip ──
const xr = xIn + 0.003;                          // reach 3 mm into the caps, under their rounded inner edges
cab.add(ribbon("Underside", [[zE, 0], ...arc(rb, rb, rb, rb, -90, -180, 6)], -xr, xr, body));
cab.add(ribbon("Back", [[0, rb], [0, H - rt]], -xr, xr, back));
cab.add(ribbon("Top", [...arc(rt, H - rt, rt, rt, 180, 90, 6), ...arc(zB - rf, H - rf, rf, rf, 90, 0, 4)], -xr, xr, body));
// (1.5 mm behind the panel's back, so the two never share a plane)
cab.add(ribbon("FrontBehindPanel", [[zB - 0.0015, H - rf], [zB - 0.0015, yLip], [zL0, yLip]], -xr, xr, body));
cab.add(ribbon("Lip", [[zL0, yLip], [zL1, yE]], -xr, xr, body));

// ── the outlet behind the louvre: a dark scroll from the lip back over the fan and down to the underside, its end walls ──
const scroll = [[zL1, yE], [0.21, 0.0525], [0.185, 0.057], [0.158, 0.056], [0.135, 0.048], [0.12, 0.034], [0.118, 0.019], [0.127, 0.008], [0.145, 0.002], [zE, 0]];
cab.add(ribbon("OutletScroll", scroll, -xL, xL, outlet));
const lower = arc(zE, yE, zL1 - zE, yE, 0, -90, 16);
const mouth = [...lower, ...scroll.slice(1, -1).reverse()];
cab.add(sideShape("OutletWallL", mouth, -xL, 1, outlet));
cab.add(sideShape("OutletWallR", mouth, xL, -1, outlet));
// the body's own curve either side of the louvre
cab.add(ribbon("CornerL", lower, -xr, -xL, body));
cab.add(ribbon("CornerR", lower, xL, xr, body));

// ── side caps: the whole profile, 18 mm thick, edges rounded ──
const capShape = new THREE.Shape(outline(capB).map(([z, y]) => new THREE.Vector2(z, y)));
for (const side of [-1, 1]) {
  const g = new THREE.ExtrudeGeometry(capShape, { depth: capT - 2 * capB, bevelEnabled: true, bevelSize: capB, bevelThickness: capB, bevelSegments: 3, curveSegments: 6 });
  g.rotateY(-Math.PI / 2);                       // shape (z, y), extruded towards -x
  g.translate(side > 0 ? XH - capB : -XH + capT - capB, 0, 0);
  cab.add(mesh(side > 0 ? "CapR" : "CapL", g, body));
  // the knock-out cover low at the back of each side (Blue Star 02 and 03; size and place ESTIMATED from those views)
  const cz0 = 0.004, cz1 = 0.041, cy0 = 0.004, cy1 = 0.075, ny = 0.012, nr = 0.005;
  // a 1 mm plate standing 0.8 mm proud, with the pipe notch cut into its back edge
  const u = (z) => (side > 0 ? z : -z);
  const cs = new THREE.Shape();
  cs.moveTo(u(cz0), cy0); cs.lineTo(u(cz1), cy0); cs.lineTo(u(cz1), cy1); cs.lineTo(u(cz0), cy1); cs.lineTo(u(cz0), ny + nr);
  cs.absarc(u(cz0), ny, nr, Math.PI / 2, -Math.PI / 2, side > 0);
  cs.lineTo(u(cz0), cy0);
  const cg = new THREE.ExtrudeGeometry(cs, { depth: 0.001, bevelEnabled: false, curveSegments: 8 });
  cg.rotateY(side > 0 ? -Math.PI / 2 : Math.PI / 2);
  cab.add(mesh(side > 0 ? "PipeCoverR" : "PipeCoverL", cg, body, side * (XH + 0.0008), 0, 0));
  // the dark pipe opening seen through the notch, in the plate's face plane (beside it, not under it)
  const notch = new THREE.CircleGeometry(nr, 16, side > 0 ? Math.PI / 2 : -Math.PI / 2, Math.PI);
  notch.rotateY(side * Math.PI / 2);
  cab.add(mesh(side > 0 ? "PipeNotchR" : "PipeNotchL", notch, outlet, side * (XH + 0.0008), ny, cz0));
}

// ── the front panel: rim, face, the line between them, badge and display ──
const panel = group("FrontPanel");
const pw = 2 * xP, ph = H - yP0, pyc = (yP0 + H) / 2;
const fT = 0.0015;                               // the face stands 1.5 mm proud of the rim: the step reads as the line round it
{
  const g = new THREE.ExtrudeGeometry(rrect(pw - 2 * bP, ph - 2 * bP, rP - bP), { depth: D - fT - zB - 2 * bP, bevelEnabled: true, bevelSize: bP, bevelThickness: bP, bevelSegments: 2, curveSegments: 10 });
  panel.add(mesh("PanelBody", g, rim, 0, pyc, zB + bP));
  // the face (inset 4.6 mm) and the darker line round it (3.4 to 4.6 mm in), side by side in the plane z = D
  const inset = (e) => rrect(pw - 2 * e, ph - 2 * e, rP - e);
  const ring = inset(0.0034);
  ring.holes.push(inset(0.0046));
  panel.add(mesh("PanelLine", new THREE.ShapeGeometry(ring, 10), line, 0, pyc, D));
  panel.add(mesh("PanelFace", new THREE.ShapeGeometry(inset(0.0046), 10), face, 0, pyc, D));
  // the 1.5 mm step round the outside of the line, facing out
  const pts = inset(0.0034).getPoints(10);
  if (THREE.ShapeUtils.isClockWise(pts)) pts.reverse();
  const pos = [], idx = [];
  pts.forEach((p) => pos.push(p.x, p.y, 0, p.x, p.y, fT));
  for (let i = 0; i < pts.length; i++) { const a = 2 * i, b = 2 * ((i + 1) % pts.length); idx.push(a, b, a + 1, a + 1, b, b + 1); }
  const wg = new THREE.BufferGeometry();
  wg.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  wg.setIndex(idx); wg.computeVertexNormals();
  panel.add(mesh("PanelStep", wg, line, 0, pyc, D - fT));
}
// badge: 92.0 x 19.4 mm with its white rim, centred 365 mm left of centre and 73.9 mm under the top (photo)
panel.add(decal("PrintBadge", 0.092, 0.0194, badgeMat, -0.365, H - 0.0739, D + 0.0008));
// display: decal box 56 x 32 mm from 770 mm to 826 mm across and 119 to 151 mm down (photo)
panel.add(decal("PrintDisplay", 0.056, 0.032, dispMat, 0.798 - XH, H - 0.135, D + 0.0008));
root.add(panel);

// ── louvre: the curved flap over the outlet, on the body's lower curve; hinged along its top edge ──
const flapOuter = arc(zE, yE, zL1 - zE, yE, -2.5, -89, 18);
const hp = flapOuter[0];
const lv = group("Louvre", 0, hp[1], hp[0]);
lv.add(shell("Flap", flapOuter.map(([z, y]) => [z - hp[0], y - hp[1]]), 0.003, -(xL - 0.0015), xL - 0.0015, louvreMat, louvreIn, louvreMat));
// three small lugs on its lower edge, at photo cols 173, 570 and 900 (ESTIMATED shape: 4 x 1.2 x 2 mm)
const lugAt = [zE + (zL1 - zE + 0.0005) * Math.cos(deg(-78)), yE + (yE + 0.0005) * Math.sin(deg(-78))];
for (const [i, x] of [-0.367, -0.026, 0.257].entries()) {
  const lug = box(`Lug${i}`, 0.004, 0.0012, 0.002, louvreMat, x, lugAt[1] - hp[1], lugAt[0] - hp[0]);
  lug.rotation.x = deg(-12);
  lv.add(lug);
}
root.add(lv);

const parts = productParts(PRODUCTS, ID);
const clips = stateClips(root, parts);
saveZones(PRODUCTS, ID, root, parts);
await exportGLB(root, clips, OUT, {
  Badge: `${TEX}/bluestar_ia318/badge.jpg`,
  Display: `${TEX}/bluestar_ia318/display.png`,
}, { dir: `${TEX}/grain`, materials: {
  // Grain (BENCHMARK section 10): moulded white plastic, the gentle peel, as on the Haier and Carrier ACs. Not on the
  // panel face, the badge or the display (print stays smooth; the face is a flat smooth plate in Blue Star's views).
  Body: { type: "peel_soft" }, PanelRim: { type: "peel_soft" }, Louvre: { type: "peel_soft" },
} });
