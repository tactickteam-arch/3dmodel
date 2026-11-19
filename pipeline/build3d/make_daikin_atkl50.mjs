// Daikin ATKL50XV16VKA (Sangeetha's ATKLRKL50XV16VKA: indoor ATKL50XV16VKA with outdoor RKL50XV16VKA), Premium Series,
// 5.0 kW (Daikin: 1.42 Tr; Sangeetha: 1.5 ton) 3 star inverter split AC, indoor unit, Premium White.
// Size from Daikin India's ATKL50XV page and Sangeetha's listing: 906 W x 298 H x 235 D mm.
// Shape from Sangeetha's straight-on front photo (sg_0, 0.929 px per mm) and its 3/4 views, and Daikin's operation manual
// 3P785322-3 (page 2, name of parts; page 18, the front panel opening on its two shafts at the top; page 29, the two air
// filters and the flaps): a flat gloss white front panel with the grey Daikin mark at the lower left and Daikin's INVERTER
// mark at the lower right; the top air inlet in six bays; under the panel a lower strip with the air outlet and its two
// flaps (horizontal blades) on the left and centre, and the signal receiver, the display and its two lamps on the right.
// The back sits at z = 0 so the unit hangs flat on a wall.
// usage: node make_daikin_atkl50.mjs <entries json> <tex dir> <out.glb>
import { THREE, mat, mesh, box, group, flipV, stateClips, exportGLB, productParts, saveZones } from "./lib.mjs";

const [PRODUCTS, TEX, OUT] = process.argv.slice(2);
const ID = "daikin-atklrkl50xv16vka";
const T = `${TEX}/daikin_atkl50`;

// ── size (metres) ──
const W = 0.906, H = 0.298, D = 0.235;
const capT = 0.010, xIn = W / 2 - capT;          // end caps from |x| 0.443 to 0.453
const zF = D;                                     // the front panel's face
const zG = 0.172;                                 // top inlet from the wall to here; the front panel from here
const yP0 = 0.0455;                               // the front panel's lower edge (1.5 mm gap to the strip below it)
const xO0 = -0.379, xO1 = 0.290;                  // the air outlet (photo cols 187 to 808)

// ── side profile, (z, y) pairs; front at +z ──
const rz = 0.026, ry = 0.024, zr = zF - rz, yr = H - ry;    // top front round-over (ESTIMATED from the 3/4 photos)
const arc = (cz, cy, az, ay, t0, t1, n) => [...Array(n + 1).keys()].map((i) => {
  const t = THREE.MathUtils.degToRad(t0 + (t1 - t0) * (i / n));
  return [cz + az * Math.cos(t), cy + ay * Math.sin(t)];
});
const lin = (a, b, n) => [...Array(n + 1).keys()].map((i) => [a[0] + (b[0] - a[0]) * i / n, a[1] + (b[1] - a[1]) * i / n]);
// panel outer surface: top (from the inlet) -> round-over -> flat front, down to its lower edge
const panelOuter = [...lin([zG, H], [zr, H], 3).slice(0, -1), ...arc(zr, yr, rz, ry, 90, 0, 12).slice(0, -1), ...lin([zF, yr], [zF, yP0], 4)];
// the lower strip and underside, from under the panel round to the wall (ESTIMATED from the photos' proportions: in the
// straight-on front views the strip under the panel is 11.5% of the unit's height, the outlet's two dark gaps at 7.3% and
// 3.4% and the display at 6.5%; the 3/4 view shows the front turning under in a tight round onto a flat underside)
const lower = [[zF - 0.0005, 0.044], [0.2338, 0.038], [0.2320, 0.030], [0.2280, 0.022], [0.2210, 0.015], [0.2110, 0.009], [0.1970, 0.0045],
  [0.178, 0.0015], [0.150, 0.0002], [0.120, 0], [0.012, 0], [0.004, 0.002], [0, 0.008]];
// a point on the lower curve at a given y (on the front part) or z (on the underside), with the index of its segment
const onLower = (key, v) => {
  const k = key === "y" ? 1 : 0;
  for (let i = 0; i < lower.length - 1; i++) {
    const [a, b] = [lower[i], lower[i + 1]];
    if ((a[k] - v) * (b[k] - v) <= 0 && a[k] !== b[k]) { const t = (v - a[k]) / (b[k] - a[k]); return Object.assign([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t], { seg: i }); }
  }
  throw new Error(`not on the lower curve: ${key} ${v}`);
};
const START = Object.assign([...lower[0]], { seg: -1 }), END = Object.assign([...lower.at(-1)], { seg: lower.length - 1 });
// the part of the lower curve between two points on it
const span = (p0, p1) => [[p0[0], p0[1]], ...lower.slice(p0.seg + 1, p1.seg + 1), [p1[0], p1[1]]].filter((q, i, a) => !i || Math.hypot(q[0] - a[i - 1][0], q[1] - a[i - 1][1]) > 1e-5);
const outTop = onLower("y", 0.0355), outBot = onLower("z", 0.165);          // the outlet opening along the curve
const outline = [[0, H - 0.006], [0.006, H], ...lin([0.006, H], [zr, H], 6).slice(1, -1), ...arc(zr, yr, rz, ry, 90, 0, 12).slice(0, -1),
  ...lin([zF, yr], [zF, lower[0][1]], 4), ...lower.slice(1)];

// ── materials ──
const panelFront = mat("PanelFront", 0xffffff, { rough: 0.22 });
const panelInner = mat("PanelInner", 0xe3e5e8, { rough: 0.6 });
const body = mat("Body", 0xf3f4f5, { rough: 0.3 });
const capMat = mat("SideCap", 0xe6e8ea, { rough: 0.36 });
const grille = mat("TopGrille", 0xffffff, { rough: 0.5 });
const filterMat = mat("Filter", 0xffffff, { rough: 0.75 });
const flapMat = mat("Flap", 0xf1f2f4, { rough: 0.28 });
const flapIn = mat("FlapInner", 0xd4d7db, { rough: 0.5 });
const outlet = mat("Outlet", 0x26292e, { rough: 0.85 });
const backMat = mat("Back", 0xc6c9cd, { rough: 0.7 });
const receiverMat = mat("Receiver", 0xc9ccd1, { rough: 0.2 });
const windowMat = mat("DisplayWindow", 0x5c5f64, { rough: 0.18 });   // smoked grey, as the photos show it
const switchMat = mat("Switch", 0xe8e9eb, { rough: 0.4 });
const logoMat = mat("DaikinMark", 0xffffff, { rough: 0.45, opacity: 0.999 });
const badgeMat = mat("InverterMark", 0xffffff, { rough: 0.45, opacity: 0.999 });
const lampMat = mat("Lamps", 0xffffff, { rough: 0.45, opacity: 0.999 });

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

const root = group("DaikinATKL");
const cab = group("Chassis");
root.add(cab);

// ── chassis: top inlet, back, the lower strip either side of the outlet, the underside ──
cab.add(ribbon("TopBackEdge", [[0, H - 0.006], [0.006, H]], -xIn, xIn, body));
cab.add(ribbon("TopGrille", lin([0.006, H], [zG, H], 1), -xIn, xIn, grille, { uv: "topz", box: { x0: -xIn, x1: xIn, z0: 0.006, z1: zG } }));
cab.add(ribbon("Back", [[0, 0.008], [0, H - 0.006]], -xIn, xIn, backMat));
cab.add(ribbon("StripL", lower, -xIn, xO0 - 0.0015, body));
cab.add(ribbon("StripR", lower, xO1 + 0.0015, xIn, body));
// in front of and behind the outlet, along the outlet's length: the lip over it and the underside behind it
cab.add(ribbon("OutletLip", span(START, outTop), xO0, xO1, body));
cab.add(ribbon("Underside", span(outBot, END), xO0, xO1, body));

// ── under the panel: the two air filters over the coil ──
const filterFace = offset(panelOuter, 0.008).map(([z, y]) => [Math.min(Math.max(z, zG), zF - 0.008), y]);
filterFace[filterFace.length - 1][1] = 0.051;
cab.add(ribbon("FilterStep", [[zG, H], [zG, filterFace[0][1]]], -xIn, xIn, body));
cab.add(ribbon("Filters", filterFace, -xIn, xIn, filterMat));
const ff = filterFace.at(-1);
cab.add(ribbon("FilterLedge", [ff, [zF - 0.001, 0.0475]], -xIn, xIn, body));

// ── the outlet: a dark scroll behind the flaps, closed at both ends ──
const scroll = [outTop, [0.216, 0.040], [0.199, 0.036], [0.186, 0.028], [0.177, 0.017], [0.170, 0.007], outBot];
cab.add(ribbon("OutletScroll", scroll, xO0, xO1, outlet));
const mouth = [...span(outTop, outBot), ...scroll.slice(1, -1).reverse()];
cab.add(sideShape("OutletWallL", mouth, xO0, 1, outlet));
cab.add(sideShape("OutletWallR", mouth, xO1, -1, outlet));

// ── display (manual page 2): signal receiver, the inverter output and temperature display, the two lamps; the ON/OFF
// switch on the underside below them ──
const strip = (y) => onLower("y", y);
// a flat piece lying on the curved strip, centred at height y, tilted with the curve there
function onStrip(make, y, h, lift) {
  const [z1, y1] = strip(y + h / 2), [z0, y0] = strip(y - h / 2);
  const tilt = Math.atan2(z1 - z0, y1 - y0);          // the piece's up runs from the lower point to the upper one
  const m = make((y0 + y1) / 2, (z0 + z1) / 2 + lift);
  m.rotation.x = tilt;
  return m;
}
// the receiver and the display level with the outlet's upper gap (front photo: 6.5% of the height up); the lamps below
cab.add(onStrip((y, z) => box("ReceiverWindow", 0.023, 0.008, 0.0016, receiverMat, 0.3555, y, z), 0.0285, 0.008, 0.0002));
cab.add(onStrip((y, z) => box("DisplayWindow", 0.040, 0.008, 0.0016, windowMat, 0.398, y, z), 0.0285, 0.008, 0.0002));
cab.add(onStrip((y, z) => decal("LampMarks", 0.018 * 448 / 432, 0.008 * 208 / 192, lampMat, 0.360, y, z), 0.0185, 0.008, 0.0007));
{
  const [z, y] = onLower("z", 0.200);
  const s = box("OnOffSwitch", 0.013, 0.0016, 0.006, switchMat, 0.356, y - 0.0002, z - 0.004);
  s.rotation.x = Math.atan2(0.003, 0.024);
  cab.add(s);
}

// ── end caps ──
for (const side of [-1, 1]) {
  const s = side < 0 ? "L" : "R";
  cab.add(sideShape("Cap" + s, outline, side * (xIn + capT), side, capMat, capT));
}

// ── front panel: two shafts at its top back edge, lifts up to reach the air filters (manual page 18) ──
const pv = [zG, H - 0.003];
const fp = group("FrontPanel", 0, pv[1], pv[0]);
const rel = (pts) => pts.map(([z, y]) => [z - pv[0], y - pv[1]]);
fp.add(shell("Panel", rel(panelOuter), 0.004, -xIn, xIn, panelFront, panelInner, body));
// the prints, 0.6 mm proud of the face; each texture has 8 clear pixels round the print, so the planes are that much larger (photo: Daikin mark cols 149-193, INVERTER cols 886-934, both rows 589-599, which is
// 21.5% of the unit's height up)
fp.add(decal("DaikinMarkDecal", 0.048 * 784 / 768, 0.048 * 177 / 768, logoMat, -0.396, 0.0755 - pv[1], zF + 0.0006 - pv[0]));
fp.add(decal("InverterDecal", 0.053 * 864 / 848, 0.0086 * 154 / 138, badgeMat, 0.399, 0.0765 - pv[1], zF + 0.0006 - pv[0]));
root.add(fp);

// ── the two flaps (horizontal blades) over the outlet, both opening top-down like every split AC's: the upper one pivots
// at its lower edge and tips its top edge out and down; the lower one, under the unit, pivots at its back edge and drops
// its front edge (angles ESTIMATED) ──
// front photo: dark gap, the upper flap's thin white edge, dark gap, the lower flap
const upA = onLower("y", 0.0300), upB = onLower("y", 0.0235);
const loA = onLower("y", 0.0180);
const upper = group("FlapUpper", 0, upB[1], upB[0]);
upper.add(shell("FlapU", span(upA, upB).map(([z, y]) => [z - upB[0], y - upB[1]]), 0.003, xO0 + 0.001, xO1 - 0.001, flapMat, flapIn, flapMat));
root.add(upper);
const lp = onLower("z", 0.170);
const lowerFlap = group("FlapLower", 0, lp[1], lp[0]);
lowerFlap.add(shell("FlapL", span(loA, lp).map(([z, y]) => [z - lp[0], y - lp[1]]), 0.003, xO0 + 0.001, xO1 - 0.001, flapMat, flapIn, flapMat));
root.add(lowerFlap);
// the flaps' centre bearing, a light post across the outlet behind them (front photo col 504: x -37.5 mm)
cab.add(onStrip((y, z) => box("FlapBearing", 0.0025, 0.0175, 0.002, flapIn, -0.0375, y, z), 0.02675, 0.0175, -0.0045));

const parts = productParts(PRODUCTS, ID);
const clips = stateClips(root, parts);
saveZones(PRODUCTS, ID, root, parts);
await exportGLB(root, clips, OUT, {
  Filter: `${T}/filter.jpg`,
  TopGrille: `${T}/top.jpg`,
  DaikinMark: `${T}/logo.png`,
  InverterMark: `${T}/inverter.png`,
  Lamps: `${T}/lamps.png`,
}, { dir: `${TEX}/grain`, materials: {
  // Grain (BENCHMARK.md section 10): moulded white plastic, the gentle peel on the body, the caps and the flaps. Not on
  // the gloss front panel: Daikin's photos show it smooth and glossy, and the prints sit on it.
  Body: { type: "peel_soft" }, SideCap: { type: "peel_soft" }, Flap: { type: "peel_soft" },
} });
