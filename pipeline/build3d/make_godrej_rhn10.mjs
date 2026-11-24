// Godrej Eon Rhine WTEON RHN 10 5.0 FEFH C GLGR, 10 kg top-load washing machine with an in-built heater, Glacial Grey.
// Built to the size on Sangeetha's listing 21646, 62 x 60.5 x 102 cm (W x D x H; Godrej's page gives no size), and to
// Godrej's own gallery for this model: the straight front and back photos give the heights and widths, the panel photo
// the rear control panel's print (redrawn sharp by tex_godrej_rhn10.py), the 3/4 photos the sides, the top cover's
// rounded front and the light-blue rim, the lid-open photo the well, the white tub ring, the drum, the Quadra steel
// pulsator and the lint filters. Godrej gives no side view or drawing: the cover's profile, the lid's thickness, the
// panel's slope and everything inside are read off the photos and fitted to the published size, ESTIMATED
// (private/research/godrej_rhn10/NOTES.md). The category's reference is make_samsung_wa70.mjs.
// usage: node make_godrej_rhn10.mjs <entry.json> <tex dir> <out.glb>
import { THREE, mat, mesh, group, flipV, inward, stateClips, exportGLB, productParts, saveZones } from "./lib.mjs";
import { uvDecals } from "./decal_curved.mjs";
import { NodeIO } from "@gltf-transform/core";
import { ALL_EXTENSIONS, KHRMaterialsClearcoat } from "@gltf-transform/extensions";
import fs from "node:fs";

const [PRODUCTS, TEX, OUT] = process.argv.slice(2);
const ID = "godrej-wteon-rhn-10-5-0-fefh-c-glgr";
const T = `${TEX}/godrej_rhn10`;

// ── size (metres); z runs front (+) to back (-), xf is the distance from the front edge ──
const W = 0.62, D = 0.605, H = 1.02;
const zF = D / 2, zB = -D / 2;
const xz = (xf) => zF - xf;
const FOOT = 0.031, PT = 0.104, BT = 0.886;   // feet, the plinth's top, the cabinet's top seam (front photo)
const R = 0.015;                               // the cabinet's rounded vertical corners
const CAP = 0.975;                             // the top cover's flat top round the lid
// the top cover: rings from the seam up to its top, each pulled in at the front (the rounded nose the 3/4 photos show)
// and a little at the sides; the back is flat (the back photo)
const COVER = [[0.886, 0, 0], [0.900, 0.004, 0], [0.930, 0.013, 0], [0.954, 0.022, 0], [0.966, 0.030, 0.001], [0.972, 0.036, 0.003], [CAP, 0.044, 0.006]];
// the opening under the lid, and the tub ring and drum under it (the lid-open photo: the ring is cut off at the back
// by the well's back wall)
const OPEN = { x: 0.282, f0: 0.058, f1: 0.437, r: 0.035 };
const RC = 0.27, zc = xz(RC);                  // the drum's axis
const RING_O = 0.215, DECK_R = 0.203, DECK = 0.952, SHELF = 0.925;
const drumR = 0.19, drumTop = 0.92, drumFloor = 0.455;
// the lid: hinged at its back edge, its top flush with the control panel's front edge
const LID = { x: 0.300, f0: 0.045, f1: 0.443, rF: 0.025, rB: 0.008 };
const PIV = [1.0, 0.445];                      // hinge axis: height, distance from the front
// the rear control panel: a housing on the cover, its glass sloping up to the 1020 mm top at the back
const HP = { x: 0.29, f0: 0.447, f1: D, rB: 0.025 };
const panelY = (xf) => 0.9995 + (xf - HP.f0) * (H - 0.9995) / (HP.f1 - HP.f0);

// ── materials ──
// Glacial Grey: a satin metallic grey (Godrej's photos read sRGB 66-90 on the lit faces)
const bodyM = mat("Body", 0x5d5c5c, { metal: 0.35, rough: 0.42 });
const frontM = mat("Front", 0xffffff, { metal: 0.35, rough: 0.42 });
const sideLM = mat("SideL", 0xffffff, { metal: 0.35, rough: 0.42 });
const sideRM = mat("SideR", 0xffffff, { metal: 0.35, rough: 0.42 });
const backM = mat("Back", 0xffffff, { metal: 0.2, rough: 0.55 });
const backTopM = mat("BackTop", 0xffffff, { metal: 0.2, rough: 0.55 });
const coverM = mat("Cover", 0x5a595a, { metal: 0.35, rough: 0.4 });
const housingM = mat("Housing", 0x58585a, { metal: 0.35, rough: 0.4 });
const plinthM = mat("Plinth", 0x4a4a4c, { metal: 0.15, rough: 0.7 });
const footM = mat("Foot", 0x151516, { rough: 0.85 });
const blueM = mat("BlueRim", 0xa9cbec, { rough: 0.32 });          // the light-blue rim (photos: sRGB 167-190, 207-222, 247-254)
const blueUnderM = mat("BlueFrame", 0x9fb9d1, { rough: 0.45 });   // the lid's underside frame and hinges (lid-open photo)
const lidGlassM = mat("LidGlass", 0x313133, { rough: 0.07 });     // tinted toughened glass under a clear coat
const glassEdgeM = mat("GlassEdge", 0x101112, { rough: 0.1 });
const glassUnderM = mat("GlassUnder", 0x0c0c0d, { rough: 0.3 });
const panelM = mat("PanelGlass", 0xffffff, { rough: 0.08 });
const wellM = mat("Well", 0x1d1d1f, { rough: 0.6 });
const ringM = mat("TubRing", 0xe8e8e6, { rough: 0.38 });
const drumM = mat("Drum", 0xffffff, { metal: 0.45, rough: 0.35 });
const drumFloorM = mat("DrumFloor", 0xc9cacb, { metal: 0.3, rough: 0.4 });
const pulsM = mat("Pulsator", 0xffffff, { metal: 0.3, rough: 0.38 });
const filterM = mat("LintFilter", 0xffffff, { rough: 0.5 });
const filterSideM = mat("LintFilterSide", 0xc4c5c6, { rough: 0.5 });
const cordM = mat("Cord", 0x18181a, { rough: 0.55 });
const plugM = mat("PlugBody", 0x1c1c1e, { rough: 0.5 });
const inletM = mat("Inlet", 0xd9d9d6, { rough: 0.5 });
const brassM = mat("Brass", 0xc9a24a, { metal: 0.85, rough: 0.35 });
const drainM = mat("Drain", 0x9b9c9e, { rough: 0.6 });

// ── geometry helpers ──
// a rounded rectangle in plan, [x, z] points running counter-clockwise (x right, z toward the front)
function rrect(x0, x1, z0, z1, [rFR, rFL, rBL, rBR], seg = 8) {
  const pts = [];
  const arc = (cx, cz, r, a0) => {
    if (r <= 0) { pts.push([cx, cz]); return; }
    for (let i = 0; i <= seg; i++) { const a = a0 + (i / seg) * Math.PI / 2; pts.push([cx + r * Math.cos(a), cz + r * Math.sin(a)]); }
  };
  arc(x1 - rFR, z1 - rFR, rFR, 0);
  arc(x0 + rFL, z1 - rFL, rFL, Math.PI / 2);
  arc(x0 + rBL, z0 + rBL, rBL, Math.PI);
  arc(x1 - rBR, z0 + rBR, rBR, 1.5 * Math.PI);
  return pts;
}
const area = (p) => p.reduce((s, [x, z], i) => { const [x2, z2] = p[(i + 1) % p.length]; return s + x * z2 - x2 * z; }, 0) / 2;
const yAt = (y, x, z) => (typeof y === "function" ? y(x, z) : y);

// A slab between two heights (numbers or functions of x, z) over a plan outline with holes: top, walls and underside,
// each with its own material (null leaves that face out). Top UVs from uvTop(x, z) (default: metres).
function prism(name, outline, holes, y0, y1, { top = null, side = null, bottom = null, uvTop = null } = {}) {
  const out = [];
  const add = (pos, nor, uv, m, suffix) => {
    if (!m || !pos.length) return;
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute("normal", new THREE.Float32BufferAttribute(nor, 3));
    g.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
    out.push([g, m, suffix]);
  };
  const contour = area(outline) > 0 ? outline : [...outline].reverse();
  const hs = holes.map((h) => (area(h) > 0 ? [...h].reverse() : h));
  const all = [contour, ...hs].flat();
  const tris = THREE.ShapeUtils.triangulateShape(contour.map(([x, z]) => new THREE.Vector2(x, z)), hs.map((h) => h.map(([x, z]) => new THREE.Vector2(x, z))));
  for (const [face, m, up, suffix] of [[y1, top, 1, ""], [y0, bottom, -1, "Under"]]) {
    if (!m) continue;
    const pos = [], nor = [], uv = [];
    for (const t of tris) {
      const P = t.map((k) => all[k]);
      const V = P.map(([x, z]) => new THREE.Vector3(x, yAt(face, x, z), z));
      const n = new THREE.Vector3().subVectors(V[1], V[0]).cross(new THREE.Vector3().subVectors(V[2], V[0])).normalize();
      const order = n.y * up > 0 ? [0, 1, 2] : [0, 2, 1];
      if (n.y * up < 0) n.negate();
      for (const k of order) {
        pos.push(V[k].x, V[k].y, V[k].z); nor.push(n.x, n.y, n.z);
        uv.push(...(uvTop && up > 0 ? uvTop(V[k].x, V[k].z) : [V[k].x, -V[k].z]));
      }
    }
    add(pos, nor, uv, m, suffix);
  }
  if (side) {
    const pos = [], nor = [], uv = [];
    // the contour runs counter-clockwise and the holes clockwise, so (dz, -dx) points away from the solid on both
    for (const loop of [contour, ...hs]) {
      const n = loop.length;
      const en = loop.map(([xa, za], i) => { const [xb, zb] = loop[(i + 1) % n]; const L = Math.hypot(xb - xa, zb - za) || 1; return [(zb - za) / L, -(xb - xa) / L]; });
      // a point's normal: smooth across gentle bends (the arcs), the edge's own at sharp corners
      const pn = en.map((b, i) => { const a = en[(i - 1 + n) % n]; return a[0] * b[0] + a[1] * b[1] > 0.7 ? new THREE.Vector3(a[0] + b[0], 0, a[1] + b[1]).normalize() : null; });
      let s = 0;
      for (let i = 0; i < n; i++) {
        const j = (i + 1) % n;
        const [xa, za] = loop[i], [xb, zb] = loop[j];
        const L = Math.hypot(xb - xa, zb - za);
        const e = new THREE.Vector3(en[i][0], 0, en[i][1]);
        const nA = pn[i] || e, nB = pn[j] || e;
        const A0 = [xa, yAt(y0, xa, za), za], A1 = [xa, yAt(y1, xa, za), za], B0 = [xb, yAt(y0, xb, zb), zb], B1 = [xb, yAt(y1, xb, zb), zb];
        const fn = new THREE.Vector3(...B0).sub(new THREE.Vector3(...A0)).cross(new THREE.Vector3(...A1).sub(new THREE.Vector3(...A0)));
        const quad = fn.dot(e) < 0 ? [[A0, nA, s, 0], [A1, nA, s, 1], [B0, nB, s + L, 0], [B0, nB, s + L, 0], [A1, nA, s, 1], [B1, nB, s + L, 1]]
          : [[A0, nA, s, 0], [B0, nB, s + L, 0], [A1, nA, s, 1], [A1, nA, s, 1], [B0, nB, s + L, 0], [B1, nB, s + L, 1]];
        for (const [p, nn, u, v] of quad) { pos.push(...p); nor.push(nn.x, nn.y, nn.z); uv.push(u, p[1]); void v; }
        s += L;
      }
    }
    add(pos, nor, uv, side, "Side");
  }
  return out.map(([g, m, suffix]) => mesh(name + suffix, g, m));
}
// turns a non-indexed geometry inside out (lib's inward() handles indexed ones)
function flipTris(g) {
  const p = g.attributes.position, n = g.attributes.normal, uv = g.attributes.uv;
  for (let i = 0; i < p.count; i += 3) for (const a of [p, uv]) {
    const t = [a.getX(i + 1), a.getY(i + 1), a.itemSize > 2 ? a.getZ(i + 1) : 0];
    if (a.itemSize > 2) { a.setXYZ(i + 1, a.getX(i + 2), a.getY(i + 2), a.getZ(i + 2)); a.setXYZ(i + 2, ...t); }
    else { a.setXY(i + 1, a.getX(i + 2), a.getY(i + 2)); a.setXY(i + 2, t[0], t[1]); }
  }
  for (let i = 0; i < n.count; i++) n.setXYZ(i, -n.getX(i), -n.getY(i), -n.getZ(i));
  return g;
}

// a ring strip round a circle (centre cx, cz) out to a plan outline, at height y, facing up: the deck round the tub ring
function ringToOutline(name, cx, cz, r, outline, y, m, seg = 128) {
  const hit = (dx, dz) => { // the nearest crossing of the ray from the centre with the outline
    let best = Infinity;
    for (let i = 0; i < outline.length; i++) {
      const [x1, z1] = outline[i], [x2, z2] = outline[(i + 1) % outline.length];
      const ex = x2 - x1, ez = z2 - z1, den = dx * ez - dz * ex;
      if (Math.abs(den) < 1e-12) continue;
      const t = ((x1 - cx) * ez - (z1 - cz) * ex) / den, s = ((x1 - cx) * dz - (z1 - cz) * dx) / den;
      if (t > 0 && s >= 0 && s <= 1) best = Math.min(best, t);
    }
    return best;
  };
  const pos = [], nor = [], uv = [];
  const P = [];
  for (let i = 0; i <= seg; i++) {
    const a = (i / seg) * Math.PI * 2, dx = Math.cos(a), dz = Math.sin(a);
    const ro = hit(dx, dz), ri = Math.min(r, ro);
    P.push([[cx + dx * ri, y, cz + dz * ri], [cx + dx * ro, y, cz + dz * ro]]);
  }
  for (let i = 0; i < seg; i++) {
    const [a0, a1] = P[i], [b0, b1] = P[i + 1];
    // angle grows from +x toward +z: seen from above (looking down -y) that is clockwise, so wind a0, a1, b0
    for (const p of [a0, b0, a1, a1, b0, b1]) { pos.push(...p); nor.push(0, 1, 0); uv.push(p[0], -p[2]); }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute("normal", new THREE.Float32BufferAttribute(nor, 3));
  g.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
  // make sure the faces look up
  const p = g.attributes.position;
  const n = new THREE.Vector3().subVectors(new THREE.Vector3().fromBufferAttribute(p, 1), new THREE.Vector3().fromBufferAttribute(p, 0))
    .cross(new THREE.Vector3().subVectors(new THREE.Vector3().fromBufferAttribute(p, 2), new THREE.Vector3().fromBufferAttribute(p, 0)));
  if (n.y < 0) for (let i = 0; i < p.count; i += 3) { const t = [p.getX(i + 1), p.getY(i + 1), p.getZ(i + 1)]; p.setXYZ(i + 1, p.getX(i + 2), p.getY(i + 2), p.getZ(i + 2)); p.setXYZ(i + 2, ...t); }
  return mesh(name, g, m);
}

// a lathe whose profile is [r, y] pairs (outer bottom, up, over, inner down: faces look outward and up)
const latheM = (name, prof, m, cx, cz, seg = 96) => mesh(name, new THREE.LatheGeometry(prof.map(([r, y]) => new THREE.Vector2(r, y)), seg), m, cx, 0, cz);

const root = group("GodrejRHN10");
const cab = group("Cabinet");
root.add(cab);
const addAll = (parent, ms) => { for (const m of [ms].flat()) parent.add(m); };

// ── base: four feet and the plinth (6 mm in at the sides, 10 mm at the front) ──
for (const sx of [-1, 1]) for (const z of [0.255, -0.258]) cab.add(mesh("Foot", new THREE.CylinderGeometry(0.019, 0.021, FOOT + 0.002, 20), footM, sx * 0.268, (FOOT + 0.002) / 2, z));
addAll(cab, prism("Plinth", rrect(-W / 2 + 0.006, W / 2 - 0.006, zB + 0.006, zF - 0.010, [0.012, 0.012, 0.012, 0.012]), [], FOOT, PT, { side: plinthM, bottom: plinthM }));

// ── the cabinet: front, sides and back from Godrej's photos, rounded corners, its underside ──
{
  const bh = BT - PT, yc = (PT + BT) / 2;
  cab.add(mesh("Front", flipV(new THREE.PlaneGeometry(W - 2 * R, bh)), frontM, 0, yc, zF));
  const bk = mesh("Back", flipV(new THREE.PlaneGeometry(W - 2 * R, bh)), backM, 0, yc, zB);
  bk.rotation.y = Math.PI; cab.add(bk);
  for (const [sx, m] of [[1, sideRM], [-1, sideLM]]) {
    const g = new THREE.PlaneGeometry(D - 2 * R, bh);
    const uv = g.attributes.uv; // the side photos cover the whole 605 mm, the corners included
    for (let i = 0; i < uv.count; i++) uv.setXY(i, (R + uv.getX(i) * (D - 2 * R)) / D, 1 - uv.getY(i));
    const s = mesh(sx > 0 ? "SideR" : "SideL", g, m, sx * W / 2, yc, 0);
    s.rotation.y = sx * Math.PI / 2; cab.add(s);
  }
  for (const [x, z, a] of [[W / 2 - R, zF - R, 0], [-W / 2 + R, zF - R, 1.5 * Math.PI], [-W / 2 + R, zB + R, Math.PI], [W / 2 - R, zB + R, 0.5 * Math.PI]])
    cab.add(mesh("Corner", new THREE.CylinderGeometry(R, R, bh, 6, 1, true, a, Math.PI / 2), bodyM, x, yc, z));
  addAll(cab, prism("Underside", rrect(-W / 2, W / 2, zB, zF, [R, R, R, R]), [], PT, PT, { bottom: plinthM }));
}

// ── the top cover: a loft of rounded rings up to the flat top, open where the lid is and under the panel housing ──
{
  const rings = COVER.map(([y, f, s]) => rrect(-W / 2 + s, W / 2 - s, zB, zF - f, [R, R, R, R], 6).map(([x, z]) => [x, y, z]));
  const n = rings[0].length, pos = [], idx = [];
  for (const r of rings) for (const p of r) pos.push(...p);
  for (let k = 0; k < rings.length - 1; k++) for (let i = 0; i < n; i++) {
    const a = k * n + i, b = k * n + ((i + 1) % n), c = a + n, d = b + n;
    idx.push(a, b, c, c, b, d);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  // wind outward: the ring runs counter-clockwise in (x, z), seen from above that is clockwise
  g.computeVertexNormals();
  const p0 = new THREE.Vector3().fromArray(pos, 0), nrm = new THREE.Vector3().fromBufferAttribute(g.attributes.normal, 0);
  if (nrm.dot(new THREE.Vector3(p0.x, 0, p0.z)) < 0) { for (let i = 0; i < idx.length; i += 3) [idx[i + 1], idx[i + 2]] = [idx[i + 2], idx[i + 1]]; g.setIndex(idx); g.computeVertexNormals(); }
  const uv = []; for (let i = 0; i < pos.length; i += 3) uv.push(pos[i], pos[i + 1]);
  g.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
  cab.add(mesh("CoverSkirt", g, coverM));
  const [, f, s] = COVER[COVER.length - 1];
  const opening = rrect(-OPEN.x, OPEN.x, xz(OPEN.f1), xz(OPEN.f0), [OPEN.r, OPEN.r, OPEN.r, OPEN.r]);
  addAll(cab, prism("CoverTop", rrect(-W / 2 + s, W / 2 - s, zB, zF - f, [R, R, R, R], 6), [opening], CAP, CAP, { top: coverM }));
  // the well: its walls from the cover down past the deck, the deck round the tub ring, a shelf under the deck
  const walls = prism("WellWall", opening, [], 0.915, CAP, { side: wellM })[0];
  flipTris(walls.geometry); walls.name = "WellWall"; cab.add(walls);
  cab.add(ringToOutline("Deck", 0, zc, DECK_R, opening, DECK, wellM));
  cab.add(ringToOutline("DeckShelf", 0, zc, RING_O - 0.001, opening, SHELF, wellM));
  // the white tub ring: a thick double lip (lid-open photo), under the deck at its outer edge
  cab.add(latheM("TubRing", [[RING_O, SHELF - 0.003], [RING_O, DECK - 0.0005], [0.205, DECK - 0.0003], [0.197, 0.9505], [0.191, 0.947], [0.186, 0.9495],
    [0.179, 0.9485], [0.174, 0.944], [0.171, 0.937], [0.171, 0.929], [0.178, 0.924], [drumR, drumTop]], ringM, 0, zc));
  // the drum: a steel wall of perforations and embossed ovals (a tile from the photo), the floor, the pulsator
  const dg = new THREE.CylinderGeometry(drumR, drumR, drumTop - drumFloor, 72, 1, true);
  const duv = dg.attributes.uv, uRep = Math.round((2 * Math.PI * drumR) / 0.12), vRep = (drumTop - drumFloor) / 0.12;
  for (let i = 0; i < duv.count; i++) duv.setXY(i, duv.getX(i) * uRep, (1 - duv.getY(i)) * vRep);
  inward(dg);
  cab.add(mesh("Drum", dg, drumM, 0, (drumTop + drumFloor) / 2, zc));
  const PR = 0.16, TR = PR * 470 / 455;     // the pulsator, and the texture's reach (its crop runs a little past the rim)
  const fl = new THREE.RingGeometry(PR - 0.002, drumR + 0.001, 72, 1);
  fl.rotateX(-Math.PI / 2);
  cab.add(mesh("DrumFloor", fl, drumFloorM, 0, drumFloor, zc));
  const pg = new THREE.LatheGeometry([[PR, drumFloor + 0.001], [0.14, drumFloor + 0.006], [0.10, drumFloor + 0.013], [0.05, drumFloor + 0.018], [0.0, drumFloor + 0.019]].map(([r, y]) => new THREE.Vector2(r, y)), 72);
  const pp = pg.attributes.position, puv = pg.attributes.uv;
  for (let i = 0; i < pp.count; i++) puv.setXY(i, 0.5 + pp.getX(i) / (2 * TR), 0.5 + pp.getZ(i) / (2 * TR));
  cab.add(mesh("Pulsator", pg, pulsM, 0, 0, zc));
  // the hub cap in the pulsator's middle
  cab.add(mesh("PulsatorHub", new THREE.CylinderGeometry(0.016, 0.018, 0.008, 24), pulsM, 0, drumFloor + 0.022, zc));
  // Dual Magic Lint Filter: moulded cartridges on the drum wall (lid-open photo: back, left and right)
  for (const [a, nm] of [[0, "LintFilterBack"], [Math.PI / 2, "LintFilterLeft"], [-Math.PI / 2, "LintFilterRight"]]) {
    // the moulded face (+z) toward the drum's axis; 9.5 mm in from the wall so the flat cartridge's edges stay inside it
    const rr = drumR - 0.0095;
    const f = mesh(nm, flipV(new THREE.BoxGeometry(0.07, 0.3, 0.012)), [filterSideM, filterSideM, filterSideM, filterSideM, filterM, filterSideM], -Math.sin(a) * rr, drumTop - 0.195, zc - Math.cos(a) * rr);
    f.rotation.y = a;
    cab.add(f);
  }
}

// ── the lid: tinted glass on a light-blue frame, its underside a blue frame round the glass, two blue hinges ──
const lid = group("Lid", 0, PIV[0], xz(PIV[1]));
{
  const zr = (xf) => PIV[1] - xf;          // lid-local z: from the hinge toward the front
  const out = rrect(-LID.x, LID.x, zr(LID.f1), zr(LID.f0), [LID.rF, LID.rF, LID.rB, LID.rB]);
  const in6 = rrect(-LID.x + 0.006, LID.x - 0.006, zr(LID.f1) + 0.006, zr(LID.f0) - 0.006, [LID.rF - 0.006, LID.rF - 0.006, 0.004, 0.004]);
  const win = rrect(-LID.x + 0.036, LID.x - 0.036, zr(LID.f1) + 0.06, zr(LID.f0) - 0.036, [0.012, 0.012, 0.006, 0.006]);
  addAll(lid, prism("LidGlass", out, [], -0.0045, -0.0005, { top: lidGlassM, side: glassEdgeM, bottom: glassUnderM }));
  addAll(lid, prism("LidRim", out, [in6], -0.0105, -0.0045, { side: blueM, bottom: blueUnderM }));
  addAll(lid, prism("LidFrame", in6, [win], -0.0245, -0.0105, { side: blueUnderM, bottom: blueUnderM }));
  for (const sx of [-1, 1]) addAll(lid, prism("LidHinge", rrect(sx * 0.235 - 0.025, sx * 0.235 + 0.025, 0.004, 0.034, [0.004, 0.004, 0.004, 0.004], 3), [], -0.042, -0.0245, { side: blueUnderM, bottom: blueUnderM }));
}
root.add(lid);

// ── the rear control panel: a grey housing, a light-blue trim under the glass, the printed glass ──
let panelTex = {};
{
  const plan = (dx) => rrect(-HP.x - dx, HP.x + dx, xz(HP.f1), xz(HP.f0) + dx, [0.002, 0.002, HP.rB, HP.rB]);
  const yTop = (x, z) => panelY(zF - z);
  addAll(cab, prism("Housing", plan(0), [], CAP, (x, z) => yTop(x, z) - 0.012, { side: housingM }));
  addAll(cab, prism("PanelTrim", plan(0.0015), [], (x, z) => yTop(x, z) - 0.012, (x, z) => yTop(x, z) - 0.004, { top: blueM, side: blueM, bottom: blueM }));
  addAll(cab, prism("PanelEdge", plan(0), [], (x, z) => yTop(x, z) - 0.004, yTop, { side: glassEdgeM }));
  // the glass's face: the print's 580 mm across, its 156 mm down the slope from the back edge (v = 0 at the image's top)
  const glass = prism("PanelGlass", plan(0), [], yTop, yTop, {
    top: panelM, uvTop: (x, z) => [(x + HP.x) / (2 * HP.x), (HP.f1 - (zF - z)) / (HP.f1 - HP.f0)],
  })[0];
  cab.add(glass);
  const printMats = {};
  panelTex = uvDecals(glass, `${T}/decals.json`, (n) => (printMats[n] = mat(n, 0xffffff, { rough: 0.16, opacity: 0.999 })), { cell: [0.003, 0.004], clip: true });
}
// the back of the cover and the housing: the grey plate from the back photo (screws, the blue trim's line)
cab.add(mesh("BackTop", flipV(new THREE.PlaneGeometry(0.53, 0.995 - BT)), backTopM, 0, (BT + 0.995) / 2, zB - 0.0008).rotateY(Math.PI));

// ── the back: the mains cord as the back photo lays it, its plug clipped on the cover, the inlet, the drain outlet ──
{
  const BK = 1424 / 620, BY = 2439 / 1020;
  const P = (px, row) => [(px - 1563.5) / BK / 1000, (2924 - row) / BY / 1000];
  const CORD = [[990, 748], [1300, 752], [1700, 757], [2000, 762], [2050, 772], [2062, 795], [2040, 812], [1850, 818], [1450, 824], [1110, 820], [1045, 808],
    [1040, 790], [1075, 782], [1500, 786], [2000, 790], [2050, 800], [1970, 1000], [1790, 1260], [1510, 1520], [1310, 1640], [1230, 1652], [1200, 1625]];
  // the photo's x is seen from behind: its left is the machine's right (+x)
  const pts = CORD.map(([c, r], i) => { const [x, y] = P(c, r); return new THREE.Vector3(-x, y, zB - 0.0055 - (i >= 7 && i <= 12 ? 0.008 : 0)); });
  cab.add(mesh("PowerCord", new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts, false, "centripetal"), 160, 0.004, 8, false), cordM));
  const [px, py] = P(1180, 1570);
  for (const m of prism("Plug", rrect(-px - 0.022, -px + 0.022, zB - 0.032, zB - 0.004, [0.006, 0.006, 0.006, 0.006], 3), [], py - 0.028, py + 0.028, { top: plugM, side: plugM, bottom: plugM })) { m.name = "Plug"; cab.add(m); }
  const [ix, iy] = P(1680, 770);
  const inlet = mesh("InletValve", new THREE.CylinderGeometry(0.014, 0.017, 0.026, 20), inletM, -ix, iy, zB - 0.013);
  inlet.rotation.x = Math.PI / 2; cab.add(inlet);
  const thr = mesh("InletThread", new THREE.CylinderGeometry(0.0115, 0.0115, 0.012, 20), brassM, -ix, iy, zB - 0.032);
  thr.rotation.x = Math.PI / 2; cab.add(thr);
  const [dx, dy] = P(1563, 2745);
  const dr = mesh("DrainHose", new THREE.CylinderGeometry(0.014, 0.016, 0.03, 20), drainM, -dx, dy, zB + 0.006 - 0.015);
  dr.rotation.x = Math.PI / 2; cab.add(dr);
}

const parts = productParts(PRODUCTS, ID);
const clips = stateClips(root, parts);
saveZones(PRODUCTS, ID, root, parts);
let meshes = 0; root.traverse((o) => { if (o.isMesh) meshes++; });
console.log("meshes", meshes);
await exportGLB(root, clips, OUT, {
  Front: `${T}/front.jpg`, SideL: `${T}/side_l.jpg`, SideR: `${T}/side_r.jpg`, Back: `${T}/back.jpg`, BackTop: `${T}/housing.jpg`,
  PanelGlass: `${T}/panel.jpg`, Drum: `${T}/drum.jpg`, Pulsator: `${T}/pulsator.jpg`, LintFilter: `${T}/filter.jpg`,
  ...panelTex,
}, { dir: `${TEX}/grain`, materials: {
  // Grain (BENCHMARK.md section 10): the painted cabinet, cover and housing the soft peel; the moulded plinth and well the
  // strong one; none on the glass or the print
  Body: { type: "peel_soft" }, Front: { type: "peel_soft" }, SideL: { type: "peel_soft" }, SideR: { type: "peel_soft" }, Back: { type: "peel_soft" },
  BackTop: { type: "peel_soft" }, Cover: { type: "peel_soft" }, Housing: { type: "peel_soft" },
  Plinth: { type: "peel_strong" }, Well: { type: "peel_strong" },
} });
// the clear coat on the two glasses (exportGLB's coat comes only with a grain, and glass has none)
{
  const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
  const doc = await io.readBinary(new Uint8Array(fs.readFileSync(OUT)));
  const ext = doc.getRoot().listExtensionsUsed().find((e) => e.extensionName === "KHR_materials_clearcoat") || doc.createExtension(KHRMaterialsClearcoat);
  const coat = { LidGlass: [1.0, 0.05], PanelGlass: [1.0, 0.04] };
  const glass = doc.getRoot().listMaterials().filter((m) => coat[m.getName()]);
  if (glass.length !== 2) throw new Error("glass materials not found");
  for (const m of glass) m.setExtension("KHR_materials_clearcoat", ext.createClearcoat().setClearcoatFactor(coat[m.getName()][0]).setClearcoatRoughnessFactor(coat[m.getName()][1]));
  fs.writeFileSync(OUT, await io.writeBinary(doc));
  console.log(`clear coat on ${glass.map((m) => m.getName())}`);
}
