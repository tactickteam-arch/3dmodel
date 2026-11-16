// LG AS-Q18KNXE (Sangeetha's Q18KNXEAMLG: set AS-Q18KNXE.AMLG, indoor unit ASNQ18KNXE.AMLG), 1.5 ton 3 star DUAL Inverter
// split AC, indoor unit, white.
// Size from Sangeetha's listing (LG publishes no product page for this model): 837 W x 308 H x 189 D mm, 8.1 kg.
// Shape from Sangeetha's front photo (sg_0, 1.01 px per mm across) and its feature photos (sg_1, sg_2), and LG's online owner's
// manual (MFL72020514, Type 1 indoor unit: the air filter lifts out of the top by its knobs; the up-down vane covers the outlet):
// a flat gloss white front panel with the grey LG mark in the middle and "Smart Inverter" at the right; under it the wide
// up-down vane between two end pieces; the air filter in the top inlet.
// The back sits at z = 0 so the unit hangs flat on a wall.
// usage: node make_lg_q18knxe.mjs <entries json> <tex dir> <out.glb>
import { THREE, mat, mesh, box, group, flipV, stateClips, exportGLB, productParts, saveZones } from "./lib.mjs";

const [PRODUCTS, TEX, OUT] = process.argv.slice(2);
const ID = "lg-q18knxeamlg";
const T = `${TEX}/lg_q18knxe`;

// ── size (metres) ──
const W = 0.837, H = 0.308, D = 0.189;
const capT = 0.009, xIn = W / 2 - capT;          // end caps from |x| 0.4095 to 0.4185
const zF = D;                                     // the front panel's face
const zT0 = 0.014, zT1 = 0.152;                   // the air filter in the top inlet, from here to here (ESTIMATED)
const yS = 0.0773;                                // the seam under the panel: 25.1% of the height up (photo row 597.5 of 381-670)
const xV = 0.350;                                 // the vane between the end pieces (photo seams at cols 186.5 and 893.5)

// ── side profile, (z, y) pairs; front at +z ──
const rz = 0.022, ry = 0.022, zr = zF - rz, yr = H - ry;    // top front round-over (ESTIMATED)
const arc = (cz, cy, az, ay, t0, t1, n) => [...Array(n + 1).keys()].map((i) => {
  const t = THREE.MathUtils.degToRad(t0 + (t1 - t0) * (i / n));
  return [cz + az * Math.cos(t), cy + ay * Math.sin(t)];
});
const lin = (a, b, n) => [...Array(n + 1).keys()].map((i) => [a[0] + (b[0] - a[0]) * i / n, a[1] + (b[1] - a[1]) * i / n]);
// the panel's outer surface: top (from the filter) -> round-over -> flat front, down to the seam
const panelOuter = [...lin([zT1, H], [zr, H], 2).slice(0, -1), ...arc(zr, yr, rz, ry, 90, 0, 10).slice(0, -1), ...lin([zF, yr], [zF, yS + 0.0012], 4)];
// under the seam: the vane and the end pieces turn under in one curve onto a flat underside (ESTIMATED: the front photo shows the
// vane over 23.5% of the height, down to the silhouette's bottom; sg_1 shows the end's rounded lower front)
const lower = [[zF, yS - 0.0012], [0.1888, 0.066], [0.1878, 0.056], [0.1855, 0.046], [0.1815, 0.0365], [0.1755, 0.0275], [0.1665, 0.019],
  [0.155, 0.0118], [0.140, 0.006], [0.122, 0.0022], [0.102, 0.0005], [0.080, 0], [0.012, 0], [0.004, 0.002], [0, 0.008]];
const onLower = (key, v) => {
  const k = key === "y" ? 1 : 0;
  for (let i = 0; i < lower.length - 1; i++) {
    const [a, b] = [lower[i], lower[i + 1]];
    if ((a[k] - v) * (b[k] - v) <= 0 && a[k] !== b[k]) { const t = (v - a[k]) / (b[k] - a[k]); return Object.assign([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t], { seg: i }); }
  }
  throw new Error(`not on the lower curve: ${key} ${v}`);
};
const START = Object.assign([...lower[0]], { seg: -1 }), END = Object.assign([...lower.at(-1)], { seg: lower.length - 1 });
const span = (p0, p1) => [[p0[0], p0[1]], ...lower.slice(p0.seg + 1, p1.seg + 1), [p1[0], p1[1]]].filter((q, i, a) => !i || Math.hypot(q[0] - a[i - 1][0], q[1] - a[i - 1][1]) > 1e-5);
const vA = onLower("y", 0.0745), vB = onLower("z", 0.118);           // the vane (and the outlet behind it) along the curve
const outline = [[0, H - 0.006], [0.006, H], ...lin([0.006, H], [zr, H], 6).slice(1, -1), ...arc(zr, yr, rz, ry, 90, 0, 10).slice(0, -1),
  ...lin([zF, yr], [zF, yS], 4), ...lower.slice(1)];

// ── materials ──
const panelFront = mat("PanelFront", 0xffffff, { rough: 0.22 });
const body = mat("Body", 0xf3f4f5, { rough: 0.3 });
const capMat = mat("SideCap", 0xe7e9eb, { rough: 0.36 });
const groove = mat("Seam", 0x9a9ea4, { rough: 0.6 });
const filterMat = mat("Filter", 0xffffff, { rough: 0.7 });
const coilMat = mat("Coil", 0xffffff, { rough: 0.45, metal: 0.3 });
const vaneMat = mat("Louvre", 0xf1f2f4, { rough: 0.28 });
const vaneIn = mat("LouvreInner", 0xd4d7db, { rough: 0.5 });
const outlet = mat("Outlet", 0x26292e, { rough: 0.85 });
const backMat = mat("Back", 0xc6c9cd, { rough: 0.7 });
const knobMat = mat("Knob", 0xe9ebee, { rough: 0.4 });
const logoMat = mat("LGMark", 0xffffff, { rough: 0.45, opacity: 0.999 });
const textMat = mat("SmartInverter", 0xffffff, { rough: 0.45, opacity: 0.999 });

// ── geometry helpers (as in make_haier_hso52.mjs) ──
// A surface swept along x from a (z, y) polyline. Normals point to the left of the direction of travel (outward for a
// clockwise outline); `flip` turns them round. UVs: "topz" projects from above (u by x, v by z), "arc" runs v along the line.
function ribbon(name, pts, x0, x1, material, { flip = false, uv = "arc", box: ub = null } = {}) {
  const s = flip ? -1 : 1;
  const n = pts.length;
  const len = [0];
  for (let i = 1; i < n; i++) len.push(len[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
  const pos = [], nor = [], uvs = [], idx = [];
  for (let i = 0; i < n; i++) {
    const a = pts[Math.max(0, i - 1)], b = pts[Math.min(n - 1, i + 1)];
    let tz = b[0] - a[0], ty = b[1] - a[1];
    const l = Math.hypot(tz, ty) || 1; tz /= l; ty /= l;
    const nz = -ty * s, ny = tz * s;
    for (const x of [x0, x1]) {
      pos.push(x, pts[i][1], pts[i][0]);
      nor.push(0, ny, nz);
      if (uv === "topz") uvs.push((x - ub.x0) / (ub.x1 - ub.x0), (pts[i][0] - ub.z0) / (ub.z1 - ub.z0));
      else uvs.push((x - x0) / (x1 - x0), len[i] / len[n - 1]);
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
function sideShape(name, poly, x, side, material, depth = 0) {
  const shape = new THREE.Shape(poly.map(([z, y]) => new THREE.Vector2(side > 0 ? -z : z, y)));
  const g = depth ? new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: false, curveSegments: 4 }) : new THREE.ShapeGeometry(shape);
  g.rotateY(side > 0 ? Math.PI / 2 : -Math.PI / 2);
  g.translate(depth ? x - side * depth : x, 0, 0);
  return mesh(name, g, material);
}
function shell(name, outer, t, x0, x1, outerMat, innerMat, edgeMat, uvOpts = {}) {
  const g = group(name);
  const inner = offset(outer, t);
  g.add(ribbon(name + "Outer", outer, x0, x1, outerMat, uvOpts));
  g.add(ribbon(name + "Inner", inner, x0, x1, innerMat, { flip: true }));
  g.add(ribbon(name + "Edge0", [inner[0], outer[0]], x0, x1, edgeMat));
  g.add(ribbon(name + "Edge1", [outer.at(-1), inner.at(-1)], x0, x1, edgeMat));
  const poly = [...outer, ...inner.slice().reverse()];
  g.add(sideShape(name + "EndL", poly, x0, -1, edgeMat));
  g.add(sideShape(name + "EndR", poly, x1, 1, edgeMat));
  return g;
}
// a flat print standing proud of a surface, facing along `normal` in the y-z plane
function decal(name, w, h, material, x, y, z, tilt = 0) {
  const m = mesh(name, flipV(new THREE.PlaneGeometry(w, h)), material, x, y, z);
  m.rotation.x = tilt;
  return m;
}

const root = group("LGQ18KNXE");
const cab = group("Chassis");
root.add(cab);

// ── chassis: the top round the filter, the back, the front panel, the seam, the end pieces and the underside ──
cab.add(ribbon("TopBackEdge", [[0, H - 0.006], [0.006, H]], -xIn, xIn, body));
cab.add(ribbon("TopRim", [[0.006, H], [zT0, H]], -xIn, xIn, body));
cab.add(ribbon("RecessBack", [[zT0, H], [zT0, H - 0.016]], -xIn, xIn, body));
cab.add(ribbon("RecessFront", [[zT1, H - 0.016], [zT1, H]], -xIn, xIn, body));
cab.add(ribbon("Coil", [[zT0, H - 0.016], [zT1, H - 0.016]], -xIn, xIn, coilMat, { uv: "topz", box: { x0: -xIn, x1: xIn, z0: zT0, z1: zT1 } }));
cab.add(ribbon("Back", [[0, 0.008], [0, H - 0.006]], -xIn, xIn, backMat));
cab.add(ribbon("Panel", panelOuter, -xIn, xIn, panelFront));
cab.add(ribbon("SeamGroove", [[zF - 0.002, yS + 0.0012], [zF - 0.002, yS - 0.0012]], -xIn, xIn, groove));
cab.add(ribbon("SeamTop", [[zF, yS + 0.0012], [zF - 0.002, yS + 0.0012]], -xIn, xIn, groove));
cab.add(ribbon("SeamBottom", [[zF - 0.002, yS - 0.0012], [zF, yS - 0.0012]], -xIn, xIn, groove));
cab.add(ribbon("EndL", lower, -xIn, -xV - 0.001, body));
cab.add(ribbon("EndR", lower, xV + 0.001, xIn, body));
cab.add(ribbon("Lip", span(START, vA), -xV, xV, body));
cab.add(ribbon("Underside", span(vB, END), -xV, xV, body));
// the prints, 0.6 mm proud of the panel; each texture has 8 clear pixels round the print, so the planes are that much larger
// (photo sg_0: LG mark cols 525-555, rows 565-577 = 34.3% of the height up; "Smart Inverter" cols 868-928, 33.2% up)
cab.add(decal("LGMarkDecal", 0.030 * 496 / 480, 0.030 * 232 / 480, logoMat, 0, 0.1055, zF + 0.0006));
cab.add(decal("SmartInverterDecal", 0.0594 * 966 / 950, 0.0594 * 133 / 950, textMat, 0.3551, 0.1023, zF + 0.0006));

// ── the outlet behind the vane: a dark scroll, closed at both ends ──
const scroll = [vA, [0.172, 0.078], [0.154, 0.072], [0.141, 0.060], [0.132, 0.045], [0.126, 0.030], [0.121, 0.015], vB];
cab.add(ribbon("OutletScroll", scroll, -xV, xV, outlet));
const mouth = [...span(vA, vB), ...scroll.slice(1, -1).reverse()];
cab.add(sideShape("OutletWallL", mouth, -xV, 1, outlet));
cab.add(sideShape("OutletWallR", mouth, xV, -1, outlet));

// ── end caps ──
for (const side of [-1, 1]) {
  const s = side < 0 ? "L" : "R";
  cab.add(sideShape("Cap" + s, outline, side * (xIn + capT), side, capMat, capT));
}

// ── the air filter in the top inlet, with its two knobs at the front edge (manual Type 1: pull the knobs up slightly, then
// lift the whole filter out) ──
const filter = group("AirFilter");
filter.add(ribbon("FilterPlate", [[zT0, H - 0.0015], [zT1, H - 0.0015]], -xIn, xIn, filterMat, { uv: "topz", box: { x0: -xIn, x1: xIn, z0: zT0, z1: zT1 } }));
filter.add(ribbon("FilterUnder", [[zT0, H - 0.0025], [zT1, H - 0.0025]], -xIn, xIn, filterMat, { flip: true, uv: "topz", box: { x0: -xIn, x1: xIn, z0: zT0, z1: zT1 } }));
for (const x of [-0.15, 0.15]) filter.add(box("FilterKnob", 0.028, 0.0035, 0.008, knobMat, x, H - 0.0035, zT1 - 0.006));
root.add(filter);

// ── the up-down vane: hinged at its rear edge under the unit, its front edge swings out and down (angle ESTIMATED) ──
const vane = group("Louvre", 0, vB[1], vB[0]);
vane.add(shell("Vane", span(vA, vB).map(([z, y]) => [z - vB[0], y - vB[1]]), 0.003, -xV + 0.0005, xV - 0.0005, vaneMat, vaneIn, vaneMat));
root.add(vane);

const parts = productParts(PRODUCTS, ID);
const clips = stateClips(root, parts);
saveZones(PRODUCTS, ID, root, parts);
await exportGLB(root, clips, OUT, {
  Filter: `${T}/filter.jpg`,
  Coil: `${T}/coil.jpg`,
  LGMark: `${T}/logo.png`,
  SmartInverter: `${T}/smartinv.png`,
}, { dir: `${TEX}/grain`, materials: {
  // Grain (BENCHMARK.md section 10): moulded white plastic, the gentle peel on the body, the caps and the vane. Not on the
  // gloss front panel, which carries the prints.
  Body: { type: "peel_soft" }, SideCap: { type: "peel_soft" }, Louvre: { type: "peel_soft" },
} });
