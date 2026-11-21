// Lloyd 1.5 ton 3 star inverter split AC, indoor unit: GLS18I3ASCHC (Classic Series) and GLS18I3GWSPC, one body in two finishes.
// Size from Lloyd's own page for GLS18I3ASCHC (havells.com): IDU 85.6 x 28.5 x 21.9 cm (L x H x D). GLS18I3GWSPC has no
// maker page; Sangeetha's photos of it show the same body and the same printed panel (same outline, same honeycomb layout,
// same LLOYD and INVERTER), so it is built as the second finish of this body.
// Shape from Lloyd's straight-on front (1.2593 px per mm) and 3/4 photos and Sangeetha's photos: a flat white front panel
// with rounded corners and a fold 164 mm below the top, the lower band below the fold leaning back to the panel's edge, the
// louvre below it from x -364 to +316 mm (the right corner is wider), the louvre open in Sangeetha's GLS18I3GWSPC photos
// over vertical blades in two groups (3 cells left of the centre post, 4 right), and a pipe knock-out on the right end.
// The front panel stays shut: no photo shows it open. The back sits at z = 0 so the unit hangs flat on a wall.
// usage: node make_lloyd_gls18i3.mjs <entries json> <tex dir> <out.glb>
import fs from "node:fs";
import { THREE, mat, mesh, box, group, stateClips, exportGLB, productParts, saveZones } from "./lib.mjs";
import { uvDecals } from "./decal_curved.mjs";
import { NodeIO } from "@gltf-transform/core";
import { ALL_EXTENSIONS, KHRMaterialsVariants } from "@gltf-transform/extensions";

const [PRODUCTS, TEX, OUT] = process.argv.slice(2);
const ID = "lloyd-gls18i3aschc";
const T = `${TEX}/lloyd_gls18i3`;

// ── size (metres) ──
const W = 0.856, H = 0.285, D = 0.219;
const HW = W / 2;
const yFold = 0.1214, yB = 0.0721;            // the fold (photo row 669) and the panel's lower edge (row 731)
const yL0 = 0.0673, yL1 = 0.0276;             // louvre's top and bottom edge seen from the front (rows 737 and 787)
const xL0 = -0.364, xL1 = 0.316;              // louvre ends (photo columns 150 and 1006)
const xPost = -0.014;                          // the louvre's centre post, between the two groups of blades
const zGrille = 0.105;                         // top inlet from the wall to here; the panel from here
const rc = 0.03, rcB = 0.015, rs = 0.03;       // panel corners seen from the front (top, bottom) and its rounded ends seen from above

// ── side profile, (z, y) pairs; front at +z ──
const arc = (cz, cy, az, ay, t0, t1, n) => [...Array(n + 1).keys()].map((i) => {
  const t = THREE.MathUtils.degToRad(t0 + (t1 - t0) * (i / n));
  return [cz + az * Math.cos(t), cy + ay * Math.sin(t)];
});
const lin = (a, b, n) => [...Array(n + 1).keys()].map((i) => [a[0] + (b[0] - a[0]) * i / n, a[1] + (b[1] - a[1]) * i / n]);
const yTopFront = 0.255, zr = 0.186;          // top front round-over: 30 mm
const frontZ = (y) => 0.216 + 0.003 * Math.sin(Math.PI * (y - yFold) / (yTopFront - yFold)); // face bulges 3 mm, 219 mm deep
const zBand = 0.203;                           // the lower band leans back 13 mm over its 49 mm
const frontPts = (y0, y1, n) => [...Array(n + 1).keys()].map((i) => { const y = y0 + (y1 - y0) * i / n; return [frontZ(y), y]; });
// panel outer surface: top (from the inlet) -> round-over -> face -> fold -> lower band
const panelOuter = [...lin([zGrille, H], [zr, H], 3).slice(0, -1), ...arc(zr, yTopFront, 0.030, 0.030, 90, 0, 10).slice(0, -1),
  ...frontPts(yTopFront, yFold, 10), ...lin([frontZ(yFold), yFold], [zBand, yB], 3).slice(1)];
// louvre: a curved flap, front edge just under the panel's edge, curling under to its back edge
const lc = [0.150, yL0], la = 0.051, lb = 0.041;
const louvreOuter = arc(lc[0], lc[1], la, -lb, 2, 90, 14);
const underside = [[0.150, yL1 - 0.0006], [0.136, 0.0126], [0.1, 0.008], [0.06, 0.004], [0.025, 0.0012], [0.012, 0], [0.004, 0.002], [0, 0.008]];
// the end caps' outline, clockwise seen from +x with z to the right: kept 20 mm inside the panel where the panel's rounded
// ends cover it, its top-front round-over 55 mm so it hides behind the panel's rounded top corners
const capOutline = [[0, H - 0.006], [0.006, H], ...lin([0.006, H], [0.15, H], 4).slice(1, -1), ...arc(0.15, H - 0.055, 0.047, 0.055, 90, 0, 10).slice(0, -1),
  [0.197, 0.2], [0.197, yFold], [zBand - 0.012, yB + 0.004], [zBand - 0.004, yL0], ...arc(lc[0], lc[1], la - 0.002, -lb, 0, 90, 12).slice(1), ...underside.slice(1)];

// ── materials (the first finish's: GLS18I3ASCHC, grey louvre and lower chassis; the second is a variant made after export) ──
const FINISHES = [
  { name: "White and grey", panel: "panel_aschc.jpg", lower: 0xa7aaae },
  { name: "White", panel: "panel_gwspc.jpg", lower: 0xeff0f2 },
];
const F0 = FINISHES[0];
const panelFront = mat("PanelFront", 0xffffff, { rough: 0.24 });
const panelInner = mat("PanelInner", 0xe1e3e6, { rough: 0.6, side: THREE.DoubleSide });
const body = mat("Body", 0xf1f2f4, { rough: 0.32 });
const lower = mat("LowerChassis", F0.lower, { rough: 0.36, side: THREE.DoubleSide });   // two-sided, as the back: the seam at each end looks into the unit
const grille = mat("TopGrille", 0xffffff, { rough: 0.5 });
const louvreMat = mat("Louvre", F0.lower, { rough: 0.3 });
const louvreIn = mat("LouvreInner", 0xc9ccd0, { rough: 0.5 });
const outlet = mat("Outlet", 0x6e7277, { rough: 0.85 });   // Sangeetha's open-louvre photos: a grey channel behind white blades
const vaneMat = mat("Vane", 0xdfe1e4, { rough: 0.45 });
const backMat = mat("Back", 0xd2d5d8, { rough: 0.7, side: THREE.DoubleSide });   // two-sided: seen from inside through the seams, it must not vanish
const knock = mat("KnockOut", 0xe4e6e9, { rough: 0.4 });

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
function sideShape(name, poly, x, side, material, depth = 0) {
  const shape = new THREE.Shape(poly.map(([z, y]) => new THREE.Vector2(side > 0 ? -z : z, y)));
  const g = depth ? new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: false, curveSegments: 4 }) : new THREE.ShapeGeometry(shape);
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
// rounded seen from the front (top `rc`, bottom `rcB`), as one indexed grid so the normals are smooth. UVs are a straight
// projection from the front over the panel's box (v = 0 at the top), so the print lands where the photo has it.
function panelSurface(name, pts, half, r, material, { flip = false, inset = 0 } = {}) {
  const NE = 7;                                   // steps round each end
  const cols = [];
  for (let i = NE; i >= 0; i--) cols.push({ side: -1, th: (i / NE) * Math.PI / 2 });
  for (let i = 0; i <= NE; i++) cols.push({ side: 1, th: (i / NE) * Math.PI / 2 });
  const hw = (y) => {
    const dTop = Math.max(0, y - (H - rc)), dBot = Math.max(0, yB + rcB - y);
    let w = half;
    if (dTop > 0) w = Math.min(w, half - rc + Math.sqrt(Math.max(0, rc * rc - dTop * dTop)));
    if (dBot > 0) w = Math.min(w, half - rcB + Math.sqrt(Math.max(0, rcB * rcB - dBot * dBot)));
    return w;
  };
  const pos = [], uvs = [], idx = [];
  for (const [z, y] of pts) {
    const w = hw(y) - inset;
    const rr = Math.max(0.004, r - inset);
    for (const c of cols) {
      const x = c.side * (w - rr + rr * Math.sin(c.th));
      pos.push(x, y, z - rr * (1 - Math.cos(c.th)));
      uvs.push((x + HW) / W, (H - y) / (H - yB));
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
  // the winding must face the outside (front) for the outer surface: check one face in the middle of the front
  const m = mesh(name, g, material);
  return m;
}

const root = group("LloydSplitAC");
const cab = group("Chassis");
root.add(cab);

// ── chassis: top inlet, back, underside, the end caps ──
cab.add(ribbon("TopBackEdge", [[0, H - 0.006], [0.006, H]], -HW + 0.006, HW - 0.006, body));
cab.add(ribbon("TopGrille", lin([0.006, H], [zGrille, H], 1), -HW + 0.01, HW - 0.01, grille, { uv: "topz", box: { x0: -HW + 0.01, x1: HW - 0.01, z0: 0.006, z1: zGrille } }));
// the top between the grille's ends and the end caps (4.5 mm each side): closed in the body's white, so no slot looks into the unit
for (const side of [-1, 1]) cab.add(ribbon("TopEnd" + (side < 0 ? "L" : "R"), lin([0.006, H], [zGrille, H], 1), side < 0 ? -HW + 0.0055 : HW - 0.01, side < 0 ? -HW + 0.01 : HW - 0.0055, body));
cab.add(ribbon("Back", [[0, 0.008], [0, H - 0.006]], -HW + 0.006, HW - 0.006, backMat));
cab.add(ribbon("Underside", underside, -HW + 0.006, HW - 0.006, lower));
for (const side of [-1, 1]) {
  const s = side < 0 ? "L" : "R";
  cab.add(sideShape("Cap" + s, capOutline, side * (HW - 0.0015), side, body, 0.004));
}
// the pipe knock-out on the right end, low and near the wall (Lloyd's 3/4 photo; 42 x 55 mm, ESTIMATED off the photo)
{
  const s = new THREE.Shape();
  const kz0 = 0.014, kz1 = 0.056, ky0 = 0.012, ky1 = 0.067, kr = 0.007;
  s.moveTo(-kz0 - kr, ky0); s.lineTo(-kz1 + kr, ky0); s.quadraticCurveTo(-kz1, ky0, -kz1, ky0 + kr); s.lineTo(-kz1, ky1 - kr);
  s.quadraticCurveTo(-kz1, ky1, -kz1 + kr, ky1); s.lineTo(-kz0 - kr, ky1); s.quadraticCurveTo(-kz0, ky1, -kz0, ky1 - kr);
  s.lineTo(-kz0, ky0 + kr); s.quadraticCurveTo(-kz0, ky0, -kz0 - kr, ky0);
  const g = new THREE.ExtrudeGeometry(s, { depth: 0.0008, bevelEnabled: false, curveSegments: 3 });
  g.rotateY(Math.PI / 2); g.translate(HW - 0.0015 + 0.0002, 0, 0);
  cab.add(mesh("KnockOutR", g, knock));
}

// ── under the panel's lower edge: the chassis lip the louvre closes against ──
cab.add(ribbon("OutletLip", [[zBand - 0.012, yB + 0.008], [zBand - 0.006, yB + 0.001], [lc[0] + la - 0.002, yL0 + 0.0005], [lc[0] + la - 0.002, lc[1] - 0.002]], -HW + 0.006, HW - 0.006, lower));

// ── outlet behind the louvre: dark scroll, its end walls and the vertical blades (2 inside the left group, 3 in the right) ──
const scroll = [[0.196, yL0 - 0.002], [0.178, yL0 - 0.004], [0.158, 0.059], [0.14, 0.05], [0.128, 0.04], [0.126, 0.03], [0.132, 0.022], [0.142, 0.019], [0.150, yL1 - 0.0004]];
cab.add(ribbon("OutletScroll", scroll, xL0, xL1, outlet));
const mouth = [...arc(lc[0], lc[1], la, -lb, 0, 90, 12), ...scroll.slice(1, -1).reverse()];
cab.add(sideShape("OutletWallL", mouth, xL0, 1, outlet));
cab.add(sideShape("OutletWallR", mouth, xL1, -1, outlet));
// each blade fills the front 50 mm of the channel, from the scroll to just behind the louvre (its front edge 4 mm back)
const vane = [...arc(lc[0], lc[1], la - 0.004, -(lb - 0.004), 4, 80, 8), ...scroll.slice(2, -1).reverse().map(([z, y]) => [z + 0.001, y])].filter(([z, y]) => z > 0.128 && y > yL1 + 0.004);
const blades = [xL0 + (xPost - xL0) / 3, xL0 + 2 * (xPost - xL0) / 3, ...[1, 2, 3].map((k) => xPost + k * (xL1 - xPost) / 4)];
blades.forEach((x, i) => cab.add(sideShape(`Blade${i}`, vane, x - 0.001, 1, vaneMat, 0.002)));
cab.add(sideShape("CentrePost", vane, xPost - 0.004, 1, vaneMat, 0.008));
// the fixed corners either side of the louvre, on the louvre's curve
const corner = arc(lc[0], lc[1], la, -lb, 0, 90, 14);
cab.add(ribbon("CornerL", corner, -HW + 0.006, xL0 - 0.0015, lower));
cab.add(ribbon("CornerR", corner, xL1 + 0.0015, HW - 0.006, lower));

// ── front panel (fixed: no photo shows it lifted, and Lloyd's common manual gives two ways to reach the filter without
// saying which this model uses) ──
const pv = [zGrille, H - 0.003];
const fp = group("FrontPanel", 0, pv[1], pv[0]);
{
  const rel = (pts) => pts.map(([z, y]) => [z - pv[0], y - pv[1]]);
  const outerS = panelSurface("PanelFace", panelOuter, HW, rs, panelFront);
  const innerS = panelSurface("PanelInner", offset(panelOuter, 0.003), HW, rs, panelInner, { flip: true, inset: 0.003 });
  for (const m of [outerS, innerS]) { m.geometry.translate(0, -pv[1], -pv[0]); fp.add(m); }
  // the panel's lower edge, a 3 mm strip along the bottom
  const e0 = panelOuter.at(-1), e1 = offset(panelOuter, 0.003).at(-1);
  fp.add(ribbon("PanelEdge", rel([e1, e0]), -HW + rcB, HW - rcB, body));
  fp.add(ribbon("PanelBackEdge", rel([offset(panelOuter, 0.003)[0], panelOuter[0]]), -HW + rc, HW - rc, body));
}
root.add(fp);

// ── louvre: the curved flap over the outlet, pivoting at its back edge, swinging down and out ──
const lp = [lc[0], lc[1] - lb + 0.002];
const lv = group("Louvre", 0, lp[1], lp[0]);
lv.add(shell("Flap", louvreOuter.map(([z, y]) => [z - lp[0], y - lp[1]]), 0.003, xL0 + 0.001, xL1 - 0.001, louvreMat, louvreIn, louvreMat));
root.add(lv);

// make sure every outward surface faces out: flip the panel faces if their normals point inward at the front centre
{
  const g = fp.getObjectByName("PanelFace").geometry;
  const n = g.attributes.normal, p = g.attributes.position;
  let best = 0, bi = 0;
  for (let i = 0; i < p.count; i++) if (p.getZ(i) > best) { best = p.getZ(i); bi = i; }
  if (n.getZ(bi) < 0) {
    for (const nm of ["PanelFace", "PanelInner"]) {
      const gg = fp.getObjectByName(nm).geometry, ix = gg.index.array;
      for (let i = 0; i < ix.length; i += 3) { const t = ix[i + 1]; ix[i + 1] = ix[i + 2]; ix[i + 2] = t; }
      gg.computeVertexNormals();
    }
  }
}

// the three words again at 15 px per mm on curved decals over the panel (tex_lloyd_gls18i3.py draws them, decals.json
// places them); the same in both finishes, so they need no variant
const printTex = uvDecals(fp.getObjectByName("PanelFace"), `${T}/decals.json`, (n) => mat(n, 0xffffff, { rough: 0.24 }));

const parts = productParts(PRODUCTS, ID);
const clips = stateClips(root, parts);
saveZones(PRODUCTS, ID, root, parts);
await exportGLB(root, clips, OUT, {
  PanelFront: `${T}/${F0.panel}`,
  TopGrille: `${T}/top.jpg`,
  ...printTex,
}, { dir: `${TEX}/grain`, materials: {
  // glossy moulded white plastic: the gentle peel on the body, caps and louvre; none on the printed panel
  Body: { type: "peel_soft" }, LowerChassis: { type: "peel_soft" }, Louvre: { type: "peel_soft" },
} });

// ── the second finish as a material variant (KHR_materials_variants): its own panel print, white louvre and lower chassis ──
{
  const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
  const doc = await io.readBinary(new Uint8Array(fs.readFileSync(OUT)));
  const ext = doc.createExtension(KHRMaterialsVariants);
  const vs = FINISHES.map((f) => ext.createVariant(f.name));
  const lin_ = (c) => [(c >> 16) & 255, (c >> 8) & 255, c & 255].map((v) => { v /= 255; return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; });
  const mats = doc.getRoot().listMaterials(), named = (n) => mats.find((m) => m.getName() === n);
  const SET = {
    PanelFront: (m, f) => m.setBaseColorTexture(doc.createTexture(f.panel.replace(/\.\w+$/, "")).setImage(new Uint8Array(fs.readFileSync(`${T}/${f.panel}`))).setMimeType("image/jpeg")),
    LowerChassis: (m, f) => m.setBaseColorFactor([...lin_(f.lower), 1]),
    Louvre: (m, f) => m.setBaseColorFactor([...lin_(f.lower), 1]),
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
