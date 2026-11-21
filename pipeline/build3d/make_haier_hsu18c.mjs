// Haier HSU18C-TQB3BN-INV, 1.5 ton 3 star Clean Cool Triple Inverter+ split AC, indoor unit (white with the blue trim).
// Size from Haier India's own page for this code: indoor unit 91 x 21 x 31 cm (W x D x H); Sangeetha's listing 18668 gives the same.
// Shape from the straight-on front on Sangeetha's listing (0.902 px per mm) and Haier's own 3/4 photos: a flat gloss white
// front panel with rounded corners and ends, the Haier logo, the 26 display with a snowflake and the DCinverter badge; a glossy
// blue strip under the panel whose ends wrap back round the corners; the louvre below it, swinging down on three arms (Haier's
// open-louvre photo); thick D-shaped end caps, 8 mm each side seen from the front, each with a recessed light grey panel, a back
// strip against the wall and an oval pipe knock-out low at the back (Sangeetha's side photos); inlet slots on top.
// This is not the Kinouchi Ultra body (make_haier_hso52.mjs): its end caps, strip and louvre differ. Only the build method is
// the same. Haier's manual 0011533504 (it lists HSU18C-TQB3BN-INV): the inlet grille (front panel) lifts to reach the air
// purifying filter; the horizontal flap (louvre) sits over the outlet with its vertical blades.
// The back sits at z = 0 so the unit hangs flat on a wall.
// usage: node make_haier_hsu18c.mjs <entries json> <tex dir> <out.glb>
import { THREE, mat, mesh, box, group, stateClips, exportGLB, productParts, saveZones } from "./lib.mjs";
import { mergeGeometries, mergeVertices } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { uvDecals } from "./decal_curved.mjs";

const [PRODUCTS, TEX, OUT] = process.argv.slice(2);
const ID = "haier-hsu18c-tqb3bn-inv";
const T = `${TEX}/haier_hsu18c`;

// ── size (metres) ──
const W = 0.91, H = 0.31, D = 0.21;
const HW = W / 2, xIn = 0.447, capT = HW - xIn;  // the panel spans |x| < 0.447 (photo), the caps the 8 mm outside it
const yP1 = 0.303, yP0 = 0.0805;                  // the panel's top and lower edge (photo rows 294 and 490)
const yS0 = 0.0683;                                // the blue strip from yS0 to yP0 (rows 491 to 501)
const xL0 = -0.403, xL1 = 0.400;                   // louvre ends (photo columns 48 and 773)
const zGrille = 0.10;                              // top inlet from the wall to here; the panel from here
const rc = 0.012, rcB = 0.005, rs = 0.016;         // panel corners seen from the front (top, bottom), its ends rounded back seen from above

// ── side profile, (z, y) pairs; front at +z ──
const arc = (cz, cy, az, ay, t0, t1, n) => [...Array(n + 1).keys()].map((i) => {
  const t = THREE.MathUtils.degToRad(t0 + (t1 - t0) * (i / n));
  return [cz + az * Math.cos(t), cy + ay * Math.sin(t)];
});
const lin = (a, b, n) => [...Array(n + 1).keys()].map((i) => [a[0] + (b[0] - a[0]) * i / n, a[1] + (b[1] - a[1]) * i / n]);
const zr = 0.166, yr = 0.263, rr = 0.04;          // top front round-over
const frontZ = (y) => 0.206 + 0.004 * Math.sin(Math.PI * (y - yP0) / (yr - yP0)); // the face bulges 4 mm: 210 mm deep
const frontPts = (y0, y1, n) => [...Array(n + 1).keys()].map((i) => { const y = y0 + (y1 - y0) * i / n; return [frontZ(y), y]; });
const panelOuter = [...lin([zGrille, yP1], [zr, yP1], 3).slice(0, -1), ...arc(zr, yr, rr, yP1 - yr, 90, 0, 10).slice(0, -1), ...frontPts(yr, yP0, 10)];
// louvre: front edge just under the strip, curling under to its back edge; seen from the front it ends 26 mm above the bottom
const lc = [0.150, yS0], la = 0.055, lb = yS0 - 0.0262;
const louvreOuter = arc(lc[0], lc[1], la, -lb, 2, 90, 14);
const underside = [[0.150, 0.0256], [0.12, 0.018], [0.08, 0.009], [0.04, 0.003], [0.012, 0], [0.004, 0.002], [0, 0.008]];
// the whole outline (panel, strip, louvre, underside): the end plates between the caps and the panel
const outline = [[0, H - 0.006], [0.006, H], [zGrille, H], ...panelOuter, [frontZ(yP0) - 0.001, yS0], ...arc(lc[0], lc[1], la, -lb, 0, 90, 14).slice(1), ...underside.slice(1)];
// the end caps: a thick D, its top-front corner round 45 mm, its bottom-front corner a long curve to the floor (Sangeetha's side photos)
const capC = { zt: 0.160, yt: 0.265, rt: 0.045, zb: 0.115, yb: 0.11, ab: 0.09 };
const dOutline = (k) => {                          // k = inset (m)
  const { zt, yt, rt, zb, yb, ab } = capC;
  return [[k, H - 0.004 - k], ...lin([0.004 + k, H - k], [zt, H - k], 3).slice(0, -1), ...arc(zt, yt, rt - k, rt - k, 90, 0, 7),
    ...arc(zb, yb, ab - k, -(yb - k), 0, 90, 9).slice(1), ...lin([zb, k], [0.004 + k, k], 3).slice(1), [k, 0.004 + k]];
};
const capOuter = dOutline(0.002);                 // 2 mm in: the soft edge (bevel) brings it back out to the full size
// the recessed panel inside the cap's frame: 14 mm in from the front, top and bottom, from the back strip (30 mm off the wall)
const recess = (() => {
  const k = 0.014, zBack = 0.03, r = 0.02;
  const pts = dOutline(k).filter(([z]) => z > zBack + r);
  const top = pts[0][1], bot = pts.at(-1)[1];
  return [...arc(zBack + r, top - r, r, r, 180, 90, 5), ...pts, ...arc(zBack + r, bot + r, r, r, 270, 180, 5)];
})();

// ── materials ──
const panelFront = mat("PanelFront", 0xffffff, { rough: 0.2 });
const panelInner = mat("PanelInner", 0xe1e3e6, { rough: 0.6 });
const body = mat("Body", 0xf1f2f4, { rough: 0.3 });
const capMat = mat("SideCap", 0xf3f4f6, { rough: 0.3 });
const recessMat = mat("CapRecess", 0xd2d5d9, { rough: 0.35 });
const blue = mat("BlueStrip", 0x2c5a92, { metal: 0.45, rough: 0.34 });  // photos: 84,122,157 at the top of the strip to 18,43,70 under it; Haier 3/4 median 67,119,171
const grille = mat("TopGrille", 0xffffff, { rough: 0.5 });
const filterMat = mat("Filter", 0xffffff, { rough: 0.75 });
const louvreMat = mat("Louvre", 0xeef0f2, { rough: 0.28 });
const louvreIn = mat("LouvreInner", 0xd0d3d7, { rough: 0.5 });
const outlet = mat("Outlet", 0x9a9ea3, { rough: 0.85 });   // Haier's open-louvre photo: a light grey channel
const vaneMat = mat("Vane", 0xdcdfe2, { rough: 0.45 });
const bottomMat = mat("Bottom", 0xe4e6e9, { rough: 0.5, side: THREE.DoubleSide });   // two-sided: seen from inside through the seams it must not let the background through
const backMat = mat("Back", 0xc8cbcf, { rough: 0.7, side: THREE.DoubleSide });   // two-sided: seen from inside through the seams it must not let the background through
const lineMat = mat("Seam", 0xa4a8ad, { rough: 0.6 });

// ── geometry helpers (as in make_haier_hso52.mjs) ──
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
// a flat shape in the side plane at x, facing out on `side`; with depth, a slab from x inward
function sideShape(name, poly, x, side, material, depth = 0, holes = [], bevel = 0) {
  const toV = (p) => p.map(([z, y]) => new THREE.Vector2(side > 0 ? -z : z, y));
  const shape = new THREE.Shape(toV(poly));
  for (const h of holes) shape.holes.push(new THREE.Path(toV(h)));
  const g = depth ? new THREE.ExtrudeGeometry(shape, bevel ? { depth: depth - 2 * bevel, bevelEnabled: true, bevelThickness: bevel, bevelSize: bevel * 0.8, bevelSegments: 2, curveSegments: 4 }
    : { depth, bevelEnabled: false, curveSegments: 4 }) : new THREE.ShapeGeometry(shape);
  if (bevel) g.translate(0, 0, bevel);
  if (depth) g.copy(mergeVertices(g, 1e-6));   // shared corners: a smaller file
  g.rotateY(side > 0 ? Math.PI / 2 : -Math.PI / 2);
  g.translate(depth ? x - side * depth : x, 0, 0);
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
// The front panel's surface: the side profile swept across, its ends rounded back by `r` seen from above and its corners
// rounded seen from the front (top `rc`, bottom `rcB`), one indexed grid so the normals are smooth. UVs are a straight
// projection from the front over the panel's box (v = 0 at the top), so the print lands where the photo has it.
function panelSurface(name, pts, half, r, material, { flip = false, inset = 0 } = {}) {
  const NE = 7;
  const cols = [];
  for (let i = NE; i >= 0; i--) cols.push({ side: -1, th: (i / NE) * Math.PI / 2 });
  for (let i = 0; i <= NE; i++) cols.push({ side: 1, th: (i / NE) * Math.PI / 2 });
  const hw = (y) => {
    const dTop = Math.max(0, y - (yP1 - rc)), dBot = Math.max(0, yP0 + rcB - y);
    let w = half;
    if (dTop > 0) w = Math.min(w, half - rc + Math.sqrt(Math.max(0, rc * rc - dTop * dTop)));
    if (dBot > 0) w = Math.min(w, half - rcB + Math.sqrt(Math.max(0, rcB * rcB - dBot * dBot)));
    return w;
  };
  const pos = [], uvs = [], idx = [];
  for (const [z, y] of pts) {
    const w = hw(y) - inset;
    const rr_ = Math.max(0.004, r - inset);
    for (const c of cols) {
      const x = c.side * (w - rr_ + rr_ * Math.sin(c.th));
      pos.push(x, y, z - rr_ * (1 - Math.cos(c.th)));
      uvs.push((x + xIn) / (2 * xIn), (H - y) / (H - yP0));
    }
  }
  const nc = cols.length;
  for (let i = 0; i < pts.length - 1; i++) for (let j = 0; j < nc - 1; j++) {
    const a = i * nc + j, b = a + 1, c = a + nc, d = c + 1;
    if (flip) idx.push(a, b, c, b, d, c); else idx.push(a, c, b, b, c, d);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  return mesh(name, g, material);
}

const root = group("HaierCleanCool");
const cab = group("Chassis");
root.add(cab);

// ── chassis: top inlet, back, underside, the end plates under the caps ──
cab.add(ribbon("TopBackEdge", [[0, H - 0.006], [0.006, H]], -xIn, xIn, body));
cab.add(ribbon("TopGrille", lin([0.006, H], [zGrille, H], 1), -xIn, xIn, grille, { uv: "topz", box: { x0: -xIn, x1: xIn, z0: 0.006, z1: zGrille } }));
cab.add(ribbon("Back", [[0, 0.008], [0, H - 0.006]], -xIn, xIn, backMat));
cab.add(ribbon("Underside", underside, -xIn, xIn, bottomMat));
for (const side of [-1, 1]) cab.add(sideShape("EndPlate" + (side < 0 ? "L" : "R"), outline, side * xIn, side, body));

// ── under the panel: the air filters over the coil, then the lip down behind the blue strip ──
const filterFace = offset(panelOuter, 0.008).map(([z, y]) => [Math.max(z, zGrille), y]);
filterFace[filterFace.length - 1][1] = 0.088;
cab.add(ribbon("FilterStep", [[zGrille, H], [zGrille, filterFace[0][1]]], -xIn, xIn, body));
cab.add(ribbon("Filters", filterFace, -xIn + 0.02, xIn - 0.02, filterMat));
const ff = filterFace.at(-1);
cab.add(ribbon("OutletLip", [ff, [0.19, yP0 + 0.002], [0.19, yS0 - 0.0005], [0.198, yS0 - 0.0015]], -xIn, xIn, body));

// ── the blue strip: a glossy band under the panel, its ends wrapping back round the corners (Haier's 3/4 photos) ──
{
  const z0 = 0.186, z1 = frontZ(yP0) + 0.0005, xr = xIn - 0.0005, r = 0.012;
  const s = new THREE.Shape();             // drawn in the top view: (x, -z) so that the extrusion runs up y
  s.moveTo(-xr, -z0); s.lineTo(xr, -z0); s.lineTo(xr, -(z1 - r)); s.quadraticCurveTo(xr, -z1, xr - r, -z1);
  s.lineTo(-xr + r, -z1); s.quadraticCurveTo(-xr, -z1, -xr, -(z1 - r)); s.lineTo(-xr, -z0);
  const bv = 0.0015;
  const g = new THREE.ExtrudeGeometry(s, { depth: yP0 - yS0 - 2 * bv, bevelEnabled: true, bevelThickness: bv, bevelSize: bv * 0.7, bevelSegments: 3, curveSegments: 6 });
  g.translate(0, 0, bv);
  g.rotateX(-Math.PI / 2);                 // shape (x, -z) to (x, z); the extrusion to +y
  g.translate(0, yS0, 0);
  cab.add(mesh("BlueStrip", g, blue));
}

// ── outlet behind the louvre: grey scroll, its end walls and 9 vertical blades ──
const scroll = [[0.198, yS0 - 0.0015], [0.178, 0.064], [0.158, 0.058], [0.141, 0.049], [0.129, 0.039], [0.127, 0.031], [0.133, 0.0245], [0.142, 0.0222], [0.150, 0.0258]];
cab.add(ribbon("OutletScroll", scroll, xL0, xL1, outlet));
const mouth = [...arc(lc[0], lc[1], la, -lb, 0, 90, 12), ...scroll.slice(1, -1).reverse()];
cab.add(sideShape("OutletWallL", mouth, xL0, 1, outlet));
cab.add(sideShape("OutletWallR", mouth, xL1, -1, outlet));
const vane = [...arc(lc[0], lc[1], la - 0.008, -(lb - 0.006), 4, 80, 8), ...scroll.slice(2, -1).reverse().map(([z, y]) => [z + 0.001, y])].filter(([z, y]) => z > 0.129 && y > 0.031);
// one mesh for all nine (fewer draw calls for AR)
const merged = (name, ms, m) => mesh(name, mergeGeometries(ms.map((x) => { x.updateMatrix(); const g = x.geometry.clone().applyMatrix4(x.matrix); g.deleteAttribute("uv"); return g; })), m);
cab.add(merged("Vanes", [...Array(9).keys()].map((i) => sideShape(`Vane${i}`, vane, xL0 + (i + 1) * (xL1 - xL0) / 10 + 0.001, 1, vaneMat, 0.002)), vaneMat));
// the fixed corners either side of the louvre, on the louvre's curve
const corner = arc(lc[0], lc[1], la, -lb, 0, 90, 14);
cab.add(ribbon("CornerL", corner, -xIn, xL0 - 0.0015, body));
cab.add(ribbon("CornerR", corner, xL1 + 0.0015, xIn, body));

// ── end caps: a thick D with a soft outer edge, the recessed grey panel, the seam of the back strip and the oval knock-out ──
for (const side of [-1, 1]) {
  const s = side < 0 ? "L" : "R";
  const xo = side * HW;
  cab.add(sideShape("Cap" + s, capOuter, xo, side, capMat, capT, [recess], 0.0025));
  cab.add(sideShape("CapRecess" + s, recess, xo - side * 0.0015, side, recessMat, capT - 0.0015));
  // the back strip's seam, 18 mm off the wall, and the knock-out (an oval outline across the seam, low at the back), ESTIMATED off the side photos
  const ko = (k) => [...arc(0.0185, 0.075, 0.009 - k, 0.009 - k, 0, 180, 8), ...arc(0.0185, 0.022, 0.009 - k, 0.009 - k, 180, 360, 8)];
  cab.add(merged("CapLines" + s, [sideShape("CapSeam" + s, [[0.0175, 0.004], [0.0185, 0.004], [0.0185, H - 0.004], [0.0175, H - 0.004]], xo + side * 0.0001, side, lineMat),
    sideShape("KnockOut" + s, [...ko(0), ...ko(0.0008).reverse()], xo + side * 0.0002, side, lineMat)], lineMat));
}

// ── front panel: hinged at its back edge on top, lifts up to reach the filters ──
const pv = [zGrille, yP1 - 0.003];
const fp = group("FrontPanel", 0, pv[1], pv[0]);
{
  const rel = (pts) => pts.map(([z, y]) => [z - pv[0], y - pv[1]]);
  const outerS = panelSurface("PanelFace", panelOuter, xIn, rs, panelFront);
  const innerS = panelSurface("PanelInner", offset(panelOuter, 0.003), xIn, rs, panelInner, { flip: true, inset: 0.003 });
  for (const m of [outerS, innerS]) { m.geometry.translate(0, -pv[1], -pv[0]); fp.add(m); }
  const e0 = panelOuter.at(-1), e1 = offset(panelOuter, 0.003).at(-1);
  fp.add(ribbon("PanelEdge", rel([e1, e0]), -xIn + rcB, xIn - rcB, body));
  fp.add(ribbon("PanelBackEdge", rel([offset(panelOuter, 0.003)[0], panelOuter[0]]), -xIn + rc, xIn - rc, body));
}
root.add(fp);

// ── louvre: the curved flap over the outlet, swinging down at its back edge; three arms inside (Haier's open-louvre photo) ──
const lp = [lc[0], lc[1] - lb + 0.002];
const lv = group("Louvre", 0, lp[1], lp[0]);
lv.add(shell("Flap", louvreOuter.map(([z, y]) => [z - lp[0], y - lp[1]]), 0.003, xL0 + 0.001, xL1 - 0.001, louvreMat, louvreIn, louvreMat));
for (const [i, x] of [-0.30, -0.08, 0.14].entries()) {
  const arm = box(`Arm${i}`, 0.007, 0.006, 0.03, louvreIn, x, 0.016, 0.008);
  arm.rotation.x = -0.7;
  lv.add(arm);
}
root.add(lv);

// every outward surface faces out: flip the panel faces if their normals point inward at the front centre
{
  const g = fp.getObjectByName("PanelFace").geometry;
  const n = g.attributes.normal, p = g.attributes.position;
  let best = -1, bi = 0;
  for (let i = 0; i < p.count; i++) if (p.getZ(i) > best) { best = p.getZ(i); bi = i; }
  if (n.getZ(bi) < 0) {
    for (const nm of ["PanelFace", "PanelInner"]) {
      const gg = fp.getObjectByName(nm).geometry, ix = gg.index.array;
      for (let i = 0; i < ix.length; i += 3) { const t = ix[i + 1]; ix[i + 1] = ix[i + 2]; ix[i + 2] = t; }
      gg.computeVertexNormals();
    }
  }
}

// the prints again at 15 px per mm on curved decals over the panel (tex_haier_hsu18c.py draws them, decals.json places them)
const printTex = uvDecals(fp.getObjectByName("PanelFace"), `${T}/decals.json`, (n) => mat(n, 0xffffff, { rough: 0.2 }));

const parts = productParts(PRODUCTS, ID);
const clips = stateClips(root, parts);
saveZones(PRODUCTS, ID, root, parts);
await exportGLB(root, clips, OUT, {
  PanelFront: `${T}/panel.jpg`,
  Filter: `${T}/filter.jpg`,
  TopGrille: `${T}/top.jpg`,
  ...printTex,
}, { dir: `${TEX}/grain`, materials: {
  // glossy moulded white plastic: a faint peel on the body, caps and louvre; none on the printed panel
  Body: { type: "peel_soft" }, SideCap: { type: "peel_soft" }, Louvre: { type: "peel_soft" },
} });
