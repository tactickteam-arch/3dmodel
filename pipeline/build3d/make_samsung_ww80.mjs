// Samsung WW80TA046AB1TL, 8 kg front-load washing machine with Eco Bubble, Hygiene Steam and Digital Inverter, Black.
// Built to Samsung's published size, 600 W x 850 H x 550 D mm (63.5 cm deep including the protruding parts, 107.2 cm with
// the door open at 90 degrees: product page, manual DC68-04383A), from Samsung's own photos of this model (the straight-on
// front shut and open, the control strip close, the 3/4 views, the right side with its three pressed panels, the back with
// its hoses, cord and plug as delivered) and the manual (the parts on page 16, the drawer's compartments on page 32, the
// filter cover and emergency drain on pages 41-42): a curved control strip with the detergent drawer at the left, the dial,
// the display with five keys, and the Power and Start/Pause buttons; a bowed front with the round door seat, a glossy black
// door hinged on the left, the gasket and the 2nd Diamond drum; the filter cover at the bottom right; this model's energy
// label. Every position on the front comes from tex_samsung_ww80.py (layout.json); the back's from rear_paths.json.
// usage: node make_samsung_ww80.mjs <products.json> <tex dir> <out.glb>
import fs from "node:fs";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import { mergeGeometries as mergeRaw, mergeVertices } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { THREE, mat, mesh, box, faced, group, lathe, flipV, inward, stateClips, exportGLB, productParts, saveZones } from "./lib.mjs";

const [PRODUCTS, TEX, OUT] = process.argv.slice(2);
const ID = "samsung-ww80ta046ab1tl";
const T = `${TEX}/samsung_ww80`;
const L = JSON.parse(fs.readFileSync(`${T}/layout.json`, "utf8"));
const rp = JSON.parse(fs.readFileSync(`${T}/rear_paths.json`, "utf8"));

// ── size (metres) ──
const W = 0.6, H = 0.85, D = 0.55;                 // Samsung: net 60.0 x 85.0 x 55.0 cm (product page; manual A, B, C)
const zF = D / 2, zB = -D / 2;
const feet = 0.012;                                 // ESTIMATED from the rear photo (1.403 px/mm)
// The front, in profile (Samsung's side photo, 1.467 px/mm; ESTIMATED): the control strip leans back as it rises, from 23.8 mm
// proud of the worktop's front edge at its foot (721 mm) to 1 mm behind it at the top (848 mm); below it the front bows out,
// 33.7 mm proud at 466 mm, then rolls back to the plinth 19 mm behind the worktop's edge.
const STRIP = [[721, 23.8], [741, 21], [769, 17], [806, 9.5], [830, 4.5], [840, 1.5], [848, -1]];
const pchip = (pts) => {                            // monotone cubic through the points (mm -> mm)
  const n = pts.length, x = pts.map((p) => p[0]), y = pts.map((p) => p[1]);
  const d = [], m = [];
  for (let i = 0; i < n - 1; i++) d.push((y[i + 1] - y[i]) / (x[i + 1] - x[i]));
  m[0] = d[0]; m[n - 1] = d[n - 2];
  for (let i = 1; i < n - 1; i++) m[i] = d[i - 1] * d[i] <= 0 ? 0 : (2 * d[i - 1] * d[i]) / (d[i - 1] + d[i]);
  return (h) => {
    if (h <= x[0]) return y[0] + m[0] * (h - x[0]);
    if (h >= x[n - 1]) return y[n - 1] + m[n - 1] * (h - x[n - 1]);
    let i = 0;
    while (h > x[i + 1]) i++;
    const hh = x[i + 1] - x[i], t = (h - x[i]) / hh, t2 = t * t, t3 = t2 * t;
    return (2 * t3 - 3 * t2 + 1) * y[i] + (t3 - 2 * t2 + t) * hh * m[i] + (-2 * t3 + 3 * t2) * y[i + 1] + (t3 - t2) * hh * m[i + 1];
  };
};
const stripFwd = pchip(STRIP);
const ROLL = [[12, -19], [17.5, -19], [18, -8], [19.5, -1.5], [22, 3], [26, 6.2], [30, 33.7 - 1.38e-4 * (30 - 466) ** 2]];
const rollFwd = pchip(ROLL);
const bowFwd = (h) => 33.7 - 1.38e-4 * (h - 466) ** 2;
const SEAM0 = 0.7195, SEAM1 = 0.7215, BOT = 0.030;  // the groove under the strip; where the bow ends at the bottom
const stripZ = (y) => zF + stripFwd(y * 1000) / 1000;
const frontZ = (y) => zF + (y >= BOT ? bowFwd(y * 1000) : rollFwd(y * 1000)) / 1000;
const slope = (f, y) => (f(y + 0.0005) - f(y - 0.0005)) / 0.001;     // dz/dy
const tilt = (f, y) => -Math.atan(-slope(f, y));                       // rotation about x that turns +z to the surface normal

// ── the door (front photos; Samsung's 635 mm and 1072 mm) ──
const cx = 0.004, cy = 0.462, R = 0.25;             // centre and outer radius: ESTIMATED from the straight-on photos (+-3 mm)
// 1072 mm deep with the door open at 90 degrees: the back (-275) + the hinge's z + the door's span (from the hinge to its far
// rim, 0.5 m) = 1072, so the hinge axis is at z 0.297, at the rim's left edge
const hingeX = cx - R, hingeZ = -0.275 + 1.072 - (cx + R - hingeX);

// ── materials ──
const front = mat("Front", 0xffffff, { rough: 0.42 });
const sideL = mat("SideL", 0xffffff, { rough: 0.45 });
const sideR = mat("SideR", 0xffffff, { rough: 0.45 });
const rearM = mat("Rear", 0xffffff, { metal: 0.25, rough: 0.5 });
const panelM = mat("Panel", 0xffffff, { rough: 0.38 });
// the display glass and the dial cap are gloss black: metal 0.85 over the near-black print keeps the face dark, and roughness 0.42
// spreads the viewer's bright lights instead of mirroring them grey. Look pass 5 Nov 2026, display as a share of the label white
// (Samsung's front photo 0.117, its dark glass 0.089): gate light 0.158 (was 0.40), page light 0.044 (was 0.027)
const glassFace = mat("PanelGlass", 0xffffff, { metal: 0.85, rough: 0.42 });
const bodyDark = mat("BodyDark", 0x2c2d30, { rough: 0.45 });
const topM = mat("TopPlate", 0x2e2f32, { rough: 0.7 });
const flapM = mat("FlapFace", 0x2c2d30, { rough: 0.45 });
const dark = mat("Dark", 0x0b0c0d, { rough: 0.8 });
const trayM = mat("Tray", 0xffffff, { rough: 0.5 });
const trayWall = mat("TrayWall", 0xdfe2e6, { rough: 0.5 });
const knobCap = mat("KnobCap", 0x0c0d0f, { metal: 0.85, rough: 0.42 });   // photo 0.074; 0.054 page light, 0.154 gate light
const chrome = mat("Chrome", 0xd0d3d8, { metal: 1, rough: 0.12 });
const doorBlack = mat("DoorBlack", 0x0a0b0c, { metal: 0.25, rough: 0.22 });   // the "Carved Door (Black)": glossy black, its sheen
// soft (front photo: the ring reads 0.087 of the label white; 0.094 here under the page light, was 0.041 at rough 0.12)
// the door glass and its bowl: a blended surface scales its own reflection by its opacity, so a 7-8 % dielectric showed no glass at
// all. As a metal it is only reflection: 1 - opacity of the drum shows through (the tint) and opacity x the base colour comes back as
// the bowl's curved highlights, as in Samsung's front photo (window 0.547 of the label white under the page light, 0.458 in
// RealityKit; photo 0.549)
const glass = mat("DoorGlass", 0x96989b, { metal: 1, rough: 0.03, opacity: 0.15, side: THREE.DoubleSide });
const bowl = mat("GlassBowl", 0xb4b6b9, { metal: 1, rough: 0.05, opacity: 0.25, side: THREE.DoubleSide });
const doorIn = mat("DoorInner", 0x56585c, { rough: 0.45 });    // the door's inner frame: mid grey (3/4 open photo)
const gasket = mat("Gasket", 0x5c5f63, { rough: 0.85 });         // mid grey in the open-door photos (the lip reads ~95 sRGB)
const drumM = mat("Drum", 0xffffff, { metal: 0.6, rough: 0.3 });
const steel = mat("Steel", 0xb9bcc1, { metal: 0.9, rough: 0.25 });
const footBase = mat("FootBase", 0x161718, { rough: 0.7 });
const labelM = mat("LabelBEE", 0xffffff, { rough: 0.5, opacity: 0.999 });
const filterM = mat("FilterCap", 0xb8bbbf, { rough: 0.5 });
const tubeM = mat("PumpHose", 0x111213, { rough: 0.7 });
const hoseM = mat("Hose", 0xffffff, { rough: 0.65 });           // ribbed light grey drain hose (rear photo)
const cuffM = mat("HoseCuffFace", 0xb4b6b9, { rough: 0.5 });
const clipM = mat("HoseClipFace", 0x2a2b2d, { rough: 0.6 });
const cordM = mat("CordFace", 0x8d8f93, { rough: 0.55 });       // the cord is grey in the rear photo
const plugM = mat("PlugFace", 0x5b5d61, { rough: 0.5 });
const pinM = mat("PlugPinFace", 0xb0b3b8, { metal: 0.9, rough: 0.3 });
const rubber = mat("Rubber", 0x141516, { rough: 0.8 });
const valveWhite = mat("ValveWhite", 0xe8e9ea, { rough: 0.4 });
const valveBlue = mat("ValveBlue", 0x2a6fb8, { rough: 0.4 });

// merges geometries whether or not they are indexed (a rounded box isn't, a cylinder is)
// merges (indexed and non-indexed alike), then welds shared corners so the GLB carries each vertex once
const mergeGeometries = (list, groups = false) => {
  if (list.every((g) => g.index)) return mergeRaw(list, groups);
  const m = mergeRaw(list.map((g) => (g.index ? g.toNonIndexed() : g)), groups);
  return groups ? m : mergeVertices(m, 1e-6);
};
const root = group("SamsungWW80");
const cab = group("Cabinet");
root.add(cab);

// a grid of rows x cols; pos(i, j) gives [x, y, z], uv(x, y) the texture place. Columns run so that (column direction) x
// (row direction) is the outward normal.
function grid(name, rows, cols, pos, uv, material) {
  const P = [], U = [], I = [];
  for (let i = 0; i < rows; i++) for (let j = 0; j < cols; j++) {
    const p = pos(i, j);
    P.push(...p);
    U.push(...(uv ? uv(p[0], p[1], p[2]) : [j / (cols - 1), i / (rows - 1)]));
  }
  for (let i = 0; i < rows - 1; i++) for (let j = 0; j < cols - 1; j++) {
    const a = i * cols + j, b = a + 1, c = a + cols, d = c + 1;
    I.push(a, b, c, b, d, c);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(P, 3));
  g.setAttribute("uv", new THREE.Float32BufferAttribute(U, 2));
  g.setIndex(I);
  g.computeVertexNormals();
  return mesh(name, g, material);
}
const range = (a, b, n) => [...Array(n + 1).keys()].map((k) => a + ((b - a) * k) / n);
const uniq = (a) => [...new Set(a.map((v) => +v.toFixed(6)))].sort((p, q) => p - q);
// the strip's texture: x -300..300 mm, h 721..850 mm, v down from the top
const panelUV = (x, y) => [(x + W / 2) / W, (0.85 - y) / 0.129];

// ── cabinet: the sides carry the pressed panels (side photo), the back is Samsung's rear photo with the hoses painted out ──
// No two faces share a plane: the sides stop 0.5 mm short of the back panel and of the top's skirts.
const sideY0 = 0.0125, sideY1 = 0.8125, sideZ0 = -0.242, sideZ1 = 0.257, t = 0.008;
const sideH = sideY1 - sideY0, sideD = sideZ1 - sideZ0;
cab.add(mesh("SideLeft", flipV(new THREE.BoxGeometry(t, sideH, sideD)), [dark, sideL, dark, dark, bodyDark, dark], -W / 2 + t / 2, sideY0 + sideH / 2, (sideZ0 + sideZ1) / 2));
cab.add(mesh("SideRight", flipV(new THREE.BoxGeometry(t, sideH, sideD)), [sideR, dark, dark, dark, bodyDark, dark], W / 2 - t / 2, sideY0 + sideH / 2, (sideZ0 + sideZ1) / 2));
{ // the worktop: a 10 mm slab over the full 600 x 550 mm, with 27 mm skirts down the sides and the back (the side photo's 36 mm
  // band, the rear photo's 39 mm); no skirt at the front, where the strip stands under the slab's edge
  // The slab's top is not flat (panel.png from above, 3/4 photo): an 18 mm rim runs round all four edges, then a narrow slope
  // (about 9 mm, darker in the photo) steps down to the field; the outer edge is rounded. Widths measured on panel.png (rim
  // 18.2-18.6 mm, field from 27.5-27.9 mm, at two depths); the 1.5 mm step and the 2 mm edge radius are ESTIMATED (no photo
  // shows them edge-on). Each side is its own strip, so the corners and the rim's inner edge stay crisp.
  const rimW = 0.0185, fieldIn = 0.0277, drop = 0.0015, rr = 0.002;
  const arc = [0, 1, 2, 3, 4].map((i) => { const a = (i / 4) * Math.PI / 2; return [rr - rr * Math.cos(a), H - rr + rr * Math.sin(a)]; });
  const profiles = [[[0, H - 0.01], ...arc, [rimW, H]], [[rimW, H], [fieldIn, H - drop]]];
  const sides = [(s) => [[-W / 2 + s, zF - s], [W / 2 - s, zF - s]], (s) => [[W / 2 - s, zF - s], [W / 2 - s, zB + s]],
    (s) => [[W / 2 - s, zB + s], [-W / 2 + s, zB + s]], (s) => [[-W / 2 + s, zB + s], [-W / 2 + s, zF - s]]];
  const strip = (side, prof) => {
    const pos = [], uv = [], idx = [];
    for (const [s, y] of prof) for (const [x, z] of side(s)) { pos.push(x, y, z); uv.push((x + W / 2) / W, (z - zB) / D); }
    for (let k = 0; k < prof.length - 1; k++) { const a0 = 2 * k, b0 = a0 + 1, a1 = a0 + 2, b1 = a0 + 3; idx.push(a0, b0, b1, a0, b1, a1); }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
    g.setIndex(idx); g.computeVertexNormals(); return g;
  };
  const field = new THREE.PlaneGeometry(W - 2 * fieldIn, D - 2 * fieldIn).rotateX(-Math.PI / 2).translate(0, H - drop, (zF + zB) / 2);
  const parts = [...sides.flatMap((sd) => profiles.map((pr) => strip(sd, pr))), field,
    new THREE.BoxGeometry(0.006, 0.0265, D - 0.001).translate(-W / 2 + 0.003, 0.8265, -0.0005),
    new THREE.BoxGeometry(0.006, 0.0265, D - 0.001).translate(W / 2 - 0.003, 0.8265, -0.0005),
    new THREE.BoxGeometry(W - 0.013, 0.0265, 0.006).translate(0, 0.8265, zB + 0.003)];
  cab.add(mesh("Top", mergeGeometries(parts), topM));
}
cab.add(box("Base", W - 2 * t - 0.002, 0.006, sideD - 0.004, dark, 0, sideY0 + 0.003 + 0.0005, (sideZ0 + sideZ1) / 2));
const backY0 = rp.panel.y0, backY1 = 0.8125, zBackFace = -0.2465;
cab.add(mesh("BackPanel", flipV(new THREE.BoxGeometry(W - 0.001, backY1 - backY0, 0.004)), [dark, dark, dark, dark, dark, rearM], 0, (backY0 + backY1) / 2, zBackFace + 0.002));
{ // four feet: a black pad and a silver hex nut (rear photo), 12 mm in all; x and z ESTIMATED from the rear and side photos
  const pad = new THREE.CylinderGeometry(0.0175, 0.0175, 0.006, 24).translate(0, 0.003, 0);
  const nut = new THREE.CylinderGeometry(0.009, 0.009, 0.0062, 6).translate(0, 0.0091, 0);
  const at = [[-0.276, 0.2315], [0.276, 0.2315], [-0.276, -0.214], [0.276, -0.214]];
  const pads = mergeGeometries(at.map(([fx, fz]) => pad.clone().translate(fx, 0, fz)));
  const nuts = mergeGeometries(at.map(([fx, fz]) => nut.clone().translate(fx, 0, fz)));
  cab.add(mesh("Feet", mergeGeometries([pads, nuts], true), [footBase, steel]));
}

// ── the bowed front: a curved face with the door seat's round hole and the filter cover's opening, built in strips across
// (each strip's edges at a hole are straight between the strip's rows, so the rows are dense where a hole's edge curves) ──
const seatR = 0.252;
const fl = L.flap, flR = fl.r - 0.004, fx0 = fl.x0 + 0.004, fx1 = fl.x1 - 0.004, fy0 = fl.y0 + 0.004, fy1 = fl.y1 - 0.004;
const holes = [
  { y0: cy - seatR, y1: cy + seatR, at: (y) => { const w = Math.sqrt(Math.max(0, seatR ** 2 - (y - cy) ** 2)); return [cx - w, cx + w]; } },
  { y0: fy0, y1: fy1, at: (y) => {
    const d = y < fy0 + flR ? fy0 + flR - y : y > fy1 - flR ? y - (fy1 - flR) : 0;
    const w = flR - Math.sqrt(Math.max(0, flR ** 2 - Math.min(d, flR) ** 2));
    return [fx0 + w, fx1 - w];
  } },
];
{
  let ys = range(BOT, SEAM0, 69);
  for (let k = 0; k <= 120; k++) ys.push(cy + seatR * Math.sin(-Math.PI / 2 + (Math.PI * k) / 120));
  for (let k = 0; k <= 8; k++) { const a = (Math.PI / 2) * k / 8; ys.push(fy0 + flR - flR * Math.cos(a), fy1 - flR + flR * Math.cos(a)); }
  ys = uniq(ys.filter((y) => y >= BOT && y <= SEAM0));
  const P = [], N = [], U = [];
  const vert = (x, y) => {
    const z = frontZ(y), s = slope(frontZ, y), n = new THREE.Vector3(0, -s, 1).normalize();
    P.push(x, y, z); N.push(n.x, n.y, n.z); U.push((x + W / 2) / W, (SEAM0 - y) / (SEAM0 - BOT));
  };
  for (let k = 0; k < ys.length - 1; k++) {
    const ya = ys[k], yb = ys[k + 1], ym = (ya + yb) / 2;
    const act = holes.filter((h) => ym > h.y0 && ym < h.y1).sort((p, q) => p.at(ym)[0] - q.at(ym)[0]);
    const edges = (y) => { const e = [-W / 2]; for (const h of act) e.push(...h.at(y)); e.push(W / 2); return e; };
    const ea = edges(ya), eb = edges(yb);
    for (let s = 0; s < ea.length; s += 2) {
      vert(ea[s], ya); vert(ea[s + 1], ya); vert(eb[s], yb);
      vert(ea[s + 1], ya); vert(eb[s + 1], yb); vert(eb[s], yb);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(P, 3));
  g.setAttribute("normal", new THREE.Float32BufferAttribute(N, 3));
  g.setAttribute("uv", new THREE.Float32BufferAttribute(U, 2));
  cab.add(mesh("FrontBow", g, front));
}
// the roll under it and the plinth, back to 19 mm behind the worktop's edge
{
  const ys = uniq([...range(feet + 0.0005, 0.0175, 2), ...range(0.0175, BOT, 16)]);
  cab.add(grid("FrontRoll", ys.length, 2, (i, j) => [j ? W / 2 : -W / 2, ys[i], frontZ(ys[i])], null, bodyDark));
}
// the groove under the strip
cab.add(box("FrontSeam", W - 0.001, SEAM1 - SEAM0 + 0.004, 0.012, dark, 0, (SEAM0 + SEAM1) / 2, frontZ(SEAM0) - 0.0075));
{ // the front's returns at the two sides, from the side panels' front edge (z 0.257) to the profile
  const prof = [];
  for (const y of uniq([...range(0.0176, BOT, 6), ...range(BOT, SEAM0, 40)])) prof.push([frontZ(y), y]);
  for (const y of range(SEAM1, sideY1, 20)) prof.push([stripZ(y), y]);
  const shape = (sgn) => {
    const s = new THREE.Shape();
    s.moveTo(sgn * sideZ1, 0.0176);
    for (const [z, y] of prof) s.lineTo(sgn * z, y);
    s.lineTo(sgn * sideZ1, sideY1);
    s.lineTo(sgn * sideZ1, 0.0176);
    return new THREE.ShapeGeometry(s);
  };
  const l = mesh("SideReturnL", shape(1), bodyDark, -W / 2, 0, 0); l.rotation.y = -Math.PI / 2; cab.add(l);
  const r = mesh("SideReturnR", shape(-1), bodyDark, W / 2, 0, 0); r.rotation.y = Math.PI / 2; cab.add(r);
}

// ── the door seat: the black groove the door's rim sits in, a shallow dish in the body colour, and its inner edge turning
// back to the gasket (open-door photo: groove 248-252 mm, gasket's edge 183 mm; depths ESTIMATED) ──
const ring = (name, rings, material, segs = 120, uvf = null) => grid(name, rings.length, segs + 1, (i, j) => {
  const a = (2 * Math.PI * j) / segs, [r, dz] = rings[i];
  const x = cx + Math.cos(a) * r, y = cy + Math.sin(a) * r;
  return [x, y, frontZ(y) + dz];
}, uvf, material);
cab.add(ring("SeatGroove", [[seatR, 0], [0.2505, -0.003], [0.2475, -0.0035]], dark));
const DISH = [[0.2475, -0.0035], [0.24, -0.005], [0.225, -0.0085], [0.205, -0.013], [0.192, -0.0175], [0.186, -0.0215], [0.1835, -0.0245], [0.182, -0.040]];
const dishDz = (r) => { for (let i = 1; i < DISH.length; i++) if (r >= DISH[i][0]) { const [r0, z0] = DISH[i - 1], [r1, z1] = DISH[i]; return z1 + ((z0 - z1) * (r - r1)) / (r0 - r1); } return DISH.at(-1)[1]; };
cab.add(ring("SeatDish", DISH, front, 120, (x, y) => [(x + W / 2) / W, (SEAM0 - y) / (SEAM0 - BOT)]));
{ // the door lock's slot at the right of the opening, and its two screws (open-door photos: 214 mm right, 461 mm up)
  const r = Math.hypot(L.lock.x - cx, L.lock.y - cy), z = frontZ(L.lock.y) + dishDz(r);
  const g = group("LockSlotMount", L.lock.x, L.lock.y, z);
  g.rotation.y = -Math.atan2(dishDz(r + 0.01) - dishDz(r - 0.01), 0.02);
  g.add(faced("LockSlot", 0.017, 0.019, 0.003, [dark, dark, dark, dark, dark, dark], 0, 0, 0.0004));
  const sc = new THREE.CylinderGeometry(0.0028, 0.0028, 0.002, 12).rotateX(Math.PI / 2);
  g.add(mesh("LockSlotScrews", mergeGeometries([sc.clone().translate(0, 0.032, 0.0006), sc.clone().translate(0, -0.032, 0.0006)]), steel));
  cab.add(g);
}
{ // the door's hinge bracket on the cabinet, in the dish at the left of the opening (open-door photos)
  const r = 0.214, z = frontZ(cy) + dishDz(r);
  cab.add(box("HingePlate", 0.024, 0.15, 0.008, steel, cx - r, cy, z + 0.001));
}
// the gasket: its rolled lip inside the dish's edge, then the boot back to the drum
cab.add(lathe("Gasket", [[0.186, 0.276], [0.181, 0.2805], [0.176, 0.2825], [0.170, 0.281], [0.164, 0.275], [0.157, 0.262], [0.150, 0.246], [0.143, 0.226], [0.136, 0.205], [0.131, 0.19]], gasket).translateX(cx).translateY(cy));

// ── the 2nd Diamond drum: diamond-pressed wall, three lifters, the back's three-armed spider (Samsung's drum photo) ──
const drumR = 0.235, drumDepth = 0.30, drumFront = 0.188, drumZ = drumFront - drumDepth / 2;
{
  const g = inward(new THREE.CylinderGeometry(drumR, drumR, drumDepth, 72, 1, true));
  g.rotateX(Math.PI / 2);
  const uv = g.attributes.uv, uRep = (2 * Math.PI * drumR) / 0.3, vRep = drumDepth / 0.15;   // drum.jpg: a 300 x 150 mm tile
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * uRep, 1 - uv.getY(i) * vRep);
  cab.add(mesh("DrumShell", g, drumM, cx, cy, drumZ));
}
cab.add(lathe("DrumLip", [[drumR, drumFront], [0.13, drumFront + 0.006]], steel).translateX(cx).translateY(cy));
cab.add(lathe("DrumBack", [[drumR, drumZ - drumDepth / 2], [0.12, drumZ - drumDepth / 2 + 0.006], [0.05, drumZ - drumDepth / 2 + 0.018], [0, drumZ - drumDepth / 2 + 0.02]], steel, 72).translateX(cx).translateY(cy));
{
  const ARMS = [Math.PI / 6, (5 * Math.PI) / 6, -Math.PI / 2];   // the spider's arms and the lifters: 2, 10 and 6 o'clock (front photo)
  const arms = [], lifts = [];
  for (const a of ARMS) {
    const arm = new RoundedBoxGeometry(0.19, 0.075, 0.03, 1, 0.012);
    arm.translate(0.135, 0, 0).rotateZ(a).translate(cx, cy, drumZ - drumDepth / 2 + 0.012);
    arms.push(arm);
    const lift = new RoundedBoxGeometry(0.05, 0.034, drumDepth - 0.02, 2, 0.014);
    lift.translate(0, -drumR + 0.012, 0).rotateZ(a + Math.PI / 2).translate(cx, cy, drumZ);
    lifts.push(lift);
  }
  arms.push(new THREE.CylinderGeometry(0.05, 0.055, 0.04, 40).rotateX(Math.PI / 2).translate(cx, cy, drumZ - drumDepth / 2 + 0.02));
  cab.add(mesh("DrumSpider", mergeGeometries(arms), steel));
  cab.add(mesh("DrumLifters", mergeGeometries(lifts), steel));
}

// ── the control strip: one curved face carrying the print (panel.jpg), the drawer in its left part ──
const seam = L.seam, stripRows = uniq([...range(SEAM1, 0.848, 50)]);
{
  const xs = [seam + 0.0005, W / 2];
  cab.add(grid("Fascia", stripRows.length, 2, (i, j) => [xs[j], stripRows[i], stripZ(stripRows[i])], panelUV, panelM));
}
// the display glass, 1.6 mm proud, above the row of keys; its rows are the strip's own rows (ends on the strip's chords), so each
// glass facet is parallel to the strip facet under it
{
  const g = L.glass, y0 = Math.max(...L.keys.map((k) => k.y1)) + 0.0004;
  const lin = (y) => { const i = Math.min(stripRows.length - 2, stripRows.findIndex((r, k) => stripRows[k + 1] >= y));
    const t = (y - stripRows[i]) / (stripRows[i + 1] - stripRows[i]); return stripZ(stripRows[i]) * (1 - t) + stripZ(stripRows[i + 1]) * t; };
  const rows = [y0, ...stripRows.filter((y) => y > y0 + 1e-5 && y < g.y1 - 1e-5), g.y1];
  cab.add(grid("DisplayGlass", rows.length, 2, (i, j) => [j ? g.x1 : g.x0, rows[i], lin(rows[i]) + 0.0016], panelUV, glassFace));
}
// the five keys, raised 2.4 mm, and the Power and Start/Pause buttons, raised 4.5 mm in their recesses; the strip's print on
// their faces
const raised = (b, depth, rad, lift) => {
  const w = b.x1 - b.x0, h = b.y1 - b.y0, xc = (b.x0 + b.x1) / 2, yc = (b.y0 + b.y1) / 2;
  const g = new RoundedBoxGeometry(w, h, depth, 1, rad);
  const pos = g.attributes.position, uv = g.attributes.uv;
  for (let i = 0; i < pos.count; i++) uv.setXY(i, ...panelUV(xc + pos.getX(i), yc + pos.getY(i)));
  g.rotateX(tilt(stripZ, yc)).translate(xc, yc, stripZ(yc) + lift - depth / 2);
  return g;
};
cab.add(mesh("Keys", mergeGeometries(L.keys.map((k) => raised({ ...k, x0: k.x0 + 0.0003, x1: k.x1 - 0.0003 }, 0.0045, 0.0009, 0.0024))), panelM));
cab.add(mesh("ButtonFaces", mergeGeometries([raised(L.power, 0.008, 0.0022, 0.0045), raised(L.start, 0.008, 0.0022, 0.0045)]), panelM));
// the dial: a polished chrome ring round a glossy black cap, on the strip's black ring with its 14 lamps (in the print);
// sizes off the close photo (ring 24.4-28.8 mm), heights ESTIMATED from the 3/4 photos
{
  const d = L.dial, k = group("Dial", d.x, d.y, stripZ(d.y));
  k.rotation.x = tilt(stripZ, d.y);
  k.add(lathe("KnobRing", [[0.0288, -0.002], [0.0290, 0.007], [0.0287, 0.0115], [0.0279, 0.0138], [0.0264, 0.0146], [0.0250, 0.014], [0.0245, 0.0115]], chrome, 72));
  k.add(lathe("KnobCap", [[0.0245, 0.0115], [0.0243, 0.0128], [0.021, 0.0139], [0.012, 0.0146], [0, 0.0148]], knobCap, 72));
  cab.add(k);
}

// ── the detergent drawer: the strip's left part (SAMSUNG, Ecobubble, the grip pocket scooped under the print), its rim, and the
// tray behind with the manual's three compartments (page 32), left to right: II main wash, the softener, I prewash ──
const dx0 = -W / 2 + 0.0005, dx1 = seam - 0.0005;
const pk = L.pocket, lipY = pk.y1;
const smooth = (t) => (t <= 0 ? 0 : t >= 1 ? 1 : t * t * (3 - 2 * t));
// the pocket's ends are steep walls in the 3/4 photos (crisp, not a long ramp): 8 mm, ESTIMATED from three_quarter.png
const pkRamp = 0.008;
const pocketDepth = (x, y) => {
  const fx = smooth((x - pk.x0) / pkRamp) * smooth((pk.x1 - x) / pkRamp);
  const fy = y > lipY ? 0 : y > lipY - 0.0007 ? 1 - (y - (lipY - 0.0007)) / 0.0007 : smooth((y - pk.y0) / (lipY - 0.0007 - pk.y0));
  return 0.014 * fx * fy;                                    // 14 mm deep under its lip: ESTIMATED from the 3/4 photos
};
const drawer = group("Drawer", 0, 0, 0);
{
  const rows = uniq([...stripRows, ...range(pk.y0, lipY - 0.0007, 18), lipY - 0.0007, lipY, lipY + 0.001]);
  const cols = uniq([...range(dx0, dx1, 20), ...range(pk.x0, pk.x0 + pkRamp, 6), ...range(pk.x1 - pkRamp, pk.x1, 6)]);
  drawer.add(grid("DrawerFace", rows.length, cols.length, (i, j) => [cols[j], rows[i], stripZ(rows[i]) - pocketDepth(cols[j], rows[i])], panelUV, panelM));
  // the face's rim: 12 mm deep round its four edges
  const yr = stripRows, dep = 0.012;
  drawer.add(grid("DrawerRimL", yr.length, 2, (i, j) => [dx0, yr[i], stripZ(yr[i]) - (j ? 0 : dep)], null, bodyDark));
  drawer.add(grid("DrawerRimR", yr.length, 2, (i, j) => [dx1, yr[i], stripZ(yr[i]) - (j ? dep : 0)], null, bodyDark));
  drawer.add(grid("DrawerRimTop", 2, 2, (i, j) => [j ? dx1 : dx0, 0.848, stripZ(0.848) - (i ? dep : 0)], null, bodyDark));
  drawer.add(grid("DrawerRimBottom", 2, 2, (i, j) => [j ? dx1 : dx0, SEAM1, stripZ(SEAM1) - (i ? 0 : dep)], null, bodyDark));
  // the tray (sizes ESTIMATED): floor with the compartments' print, side and back walls, the two dividers, the softener's siphon
  const tw = dx1 - dx0 - 0.014, th = 0.07, tl = 0.3, zt = stripZ(0.78) - 0.019 - tl / 2, y0 = 0.735 + th / 2;
  const tg = new THREE.BoxGeometry(tw, 0.0025, tl), tuv = tg.attributes.uv;
  for (let i = 8; i < 12; i++) tuv.setXY(i, tuv.getX(i), 1 - tuv.getY(i));
  const xc = (dx0 + dx1) / 2;
  drawer.add(mesh("TrayFloor", tg, [trayWall, trayWall, trayM, trayWall, trayWall, trayWall], xc, y0 - th / 2 + 0.00125, zt));
  const walls = [new THREE.BoxGeometry(0.0025, th, tl).translate(xc - tw / 2 + 0.00125, y0, zt), new THREE.BoxGeometry(0.0025, th, tl).translate(xc + tw / 2 - 0.00125, y0, zt),
    new THREE.BoxGeometry(tw, th, 0.0025).translate(xc, y0, zt - tl / 2 + 0.00125)];
  const xa = xc - tw / 2 + tw * (250 / 512), xb = xc - tw / 2 + tw * (352 / 512);    // the dividers where tray.jpg draws them
  walls.push(new THREE.BoxGeometry(0.0025, th * 0.85, tl * 0.96).translate(xa, y0 - th * 0.075, zt), new THREE.BoxGeometry(0.0025, th * 0.85, tl * 0.96).translate(xb, y0 - th * 0.075, zt));
  drawer.add(mesh("TrayWalls", mergeGeometries(walls), trayWall));
  drawer.add(box("TraySiphon", xb - xa - 0.008, 0.014, 0.03, mat("TraySiphonCap", 0xaab0ba, { rough: 0.4 }), (xa + xb) / 2, y0 - th / 2 + 0.009, zt + tl / 2 - 0.05));
}
cab.add(drawer);
// the dark bay the drawer slides out of, under the worktop's slab
cab.add(mesh("DrawerBay", inward(new THREE.BoxGeometry(dx1 - dx0 + 0.001, 0.839 - SEAM1, 0.33)), dark, (dx0 + dx1) / 2, (SEAM1 + 0.839) / 2, stripZ(0.848) - 0.002 - 0.165));

// ── the filter cover (manual parts 06-08): a rounded lid hinged along its lower edge over the debris filter's knob and the
// emergency drain tube ──
{
  const yc = (fy0 + fy1) / 2, bay = group("FlapBayMount", (fl.x0 + fl.x1) / 2, yc, frontZ(yc));
  bay.rotation.x = tilt(frontZ, yc);
  bay.add(mesh("FlapBay", inward(new THREE.BoxGeometry(fx1 - fx0, fy1 - fy0, 0.05)), bodyDark, 0, 0, -0.0012 - 0.025));
  bay.add(mesh("FlapFilterKnob", new THREE.CylinderGeometry(0.03, 0.03, 0.02, 36).rotateX(Math.PI / 2), filterM, 0.03, -0.004, -0.03));
  bay.add(box("FlapFilterGrip", 0.008, 0.052, 0.012, filterM, 0.03, -0.004, -0.016));
  const tube = new THREE.CatmullRomCurve3([new THREE.Vector3(-0.055, -0.03, -0.04), new THREE.Vector3(-0.05, 0.0, -0.03), new THREE.Vector3(-0.045, 0.025, -0.022)]);
  bay.add(mesh("FlapDrainTube", new THREE.TubeGeometry(tube, 12, 0.006, 10, false), tubeM));
  bay.add(mesh("FlapDrainCap", new THREE.CylinderGeometry(0.008, 0.008, 0.012, 16), tubeM, -0.045, 0.028, -0.021));
  cab.add(bay);
}
const pivotY = fl.y0, pivotZ = frontZ(fl.y0);
const filter = group("FilterFlap", 0, pivotY, pivotZ);
{
  const s = new THREE.Shape(), r = fl.r, x0 = fl.x0, x1 = fl.x1, y0 = fl.y0, y1 = fl.y1;
  s.moveTo(x0 + r, y0); s.lineTo(x1 - r, y0); s.absarc(x1 - r, y0 + r, r, -Math.PI / 2, 0); s.lineTo(x1, y1 - r); s.absarc(x1 - r, y1 - r, r, 0, Math.PI / 2);
  s.lineTo(x0 + r, y1); s.absarc(x0 + r, y1 - r, r, Math.PI / 2, Math.PI); s.lineTo(x0, y0 + r); s.absarc(x0 + r, y0 + r, r, Math.PI, 1.5 * Math.PI);
  const g = new THREE.ExtrudeGeometry(s, { depth: 0.003, bevelEnabled: false, curveSegments: 6 });
  const pos = g.attributes.position;
  for (let i = 0; i < pos.count; i++) { const y = pos.getY(i); pos.setXYZ(i, pos.getX(i), y - pivotY, pos.getZ(i) - 0.003 + 0.0012 + frontZ(y) - pivotZ); }
  g.computeVertexNormals();
  filter.add(mesh("FlapFace", g, flapM));
}
root.add(filter);

// ── Samsung's energy label for this model, on the front at the bottom left, following the bow ──
{
  const b = L.label, g = flipV(new THREE.PlaneGeometry(b.x1 - b.x0, b.y1 - b.y0, 1, 16)), pos = g.attributes.position;
  const xc = (b.x0 + b.x1) / 2, yc = (b.y0 + b.y1) / 2;
  for (let i = 0; i < pos.count; i++) { const y = pos.getY(i) + yc; pos.setXYZ(i, pos.getX(i) + xc, y, frontZ(y) + 0.0016); }
  g.computeVertexNormals();
  cab.add(mesh("LabelBEE", g, labelM));
}

// ── the door: hinged on the left; a glossy black ring, the clear glass, the grey inner frame with the glass bowl, the latch ──
const door = group("Door", hingeX, cy, hingeZ);
const dc = group("DoorCentre", cx - hingeX, 0, -hingeZ);         // the profiles below are in the cabinet's z
dc.add(lathe("DoorInner", [[0.172, 0.300], [0.18, 0.306], [0.20, 0.3105], [0.235, 0.312], [0.2485, 0.313]], doorIn));
dc.add(lathe("DoorRim", [[0.2485, 0.313], [0.2502, 0.317], [0.2505, 0.326], [0.249, 0.334], [0.244, 0.340], [0.23, 0.346], [0.205, 0.352], [0.18, 0.356], [0.166, 0.357]], doorBlack));
dc.add(lathe("DoorGlass", [[0.166, 0.357], [0.12, 0.3592], [0.06, 0.3602], [0.0, 0.3605]], glass));
dc.add(lathe("DoorTube", [[0.172, 0.300], [0.166, 0.357]], mat("DoorTubeFace", 0x101112, { rough: 0.5, side: THREE.DoubleSide })));
dc.add(lathe("DoorBowl", [[0.172, 0.300], [0.165, 0.285], [0.15, 0.262], [0.125, 0.240], [0.09, 0.226], [0.045, 0.220], [0.0, 0.219]], bowl));
// the latch: a steel plate with its hook on the inner side at the free edge, into the lock's slot (3/4 open photo)
dc.add(box("DoorLatchPlate", 0.024, 0.044, 0.003, steel, L.lock.x - cx, 0, 0.3105));
dc.add(box("DoorLatchHook", 0.008, 0.012, 0.016, steel, L.lock.x - cx, 0, 0.302));
// the hinge's two arms, from the frame back to the bracket (3/4 open photo)
for (const s of [1, -1]) dc.add(box(`DoorHingeArm${s > 0 ? "Top" : "Bottom"}`, 0.026, 0.022, 0.018, steel, -0.226, s * 0.052, 0.303));
door.add(dc);
root.add(door);

// ── the back, as delivered (Samsung's rear photo): the ribbed drain hose from its holder at the lower right (seen from behind:
// the photo's lower left) up, over the top and down the other side to its smooth end; the grey cord from its boss round its
// loop, along the top and down to the Indian 3-pin plug in its clip; three transit bolts in rubber; the cold-water inlet; the
// tub's aluminium cover standing 3.5 mm proud. Centre lines and sizes traced off the photo by tex_samsung_ww80.py; how far each
// stands off the back is ESTIMATED. The inlet hose is packed loose in the box (manual page 16), so it isn't fitted here.
{
  const rd = rp.drain_d / 2, rc = rp.cord_d / 2;
  const v3 = (pts, z) => pts.map(([x, y]) => new THREE.Vector3(x, y, z));
  const tube = (name, pts, r, m, radial, perM = 90) => {
    const c = new THREE.CatmullRomCurve3(pts, false, "centripetal");
    const g = new THREE.TubeGeometry(c, Math.max(8, Math.round(c.getLength() * perM)), r, radial, false);
    cab.add(mesh(name, g, m));
    return { c, g };
  };
  const zHose = zBackFace - 0.0025 - rd;
  const dr = tube("DrainHose", v3(rp.drain, zHose), rd, hoseM, 12, 110);
  const uv = dr.g.attributes.uv, ribs = dr.c.getLength() / rp.rib;
  for (let i = 0; i < uv.count; i++) uv.setX(i, uv.getX(i) * ribs);
  {
    const [[ax, ay], [bx, by]] = rp.cuff, len = Math.hypot(bx - ax, by - ay);
    const cuff = mesh("HoseCuff", new THREE.CylinderGeometry(rp.cuff_d / 2, rp.cuff_d / 2, len, 20), cuffM, (ax + bx) / 2, (ay + by) / 2, zHose);
    cuff.rotation.z = Math.atan2(-(bx - ax), by - ay);
    cab.add(cuff);
    cab.add(mesh("HoseEnd", new THREE.CylinderGeometry(rp.cuff_d / 2 - 0.001, rp.cuff_d / 2 - 0.001, 0.002, 20), dark, bx, by - 0.0005, zHose));
  }
  const [hx, hy, hw, hh] = rp.holder;
  cab.add(mesh("HoseHolder", new RoundedBoxGeometry(hw, hh, 0.026, 1, 0.004), clipM, hx, hy, zBackFace - 0.013));
  cab.add(mesh("HoseClip", mergeGeometries(rp.clips.map(([x, y, w, h]) => new RoundedBoxGeometry(w, h, 0.026, 1, 0.003).translate(x, y, zBackFace - 0.013))), clipM));
  // the cord, 1.5 mm off the back (behind the hose where they cross)
  tube("PowerCord", v3(rp.cord, zBackFace - 0.0015 - rc), rc, cordM, 6);
  { // the plug hanging pins-down from its strain relief (the photo's sizes; the pins' layout ESTIMATED, an Indian 6 A plug)
    const [sx, sy, sl, sd] = rp.plug.relief, [[bx0, by0], [bx1, by1]] = rp.plug.body, zp = zBackFace - 0.0145;
    cab.add(mesh("CordRelief", new THREE.CylinderGeometry(sd / 2 * 0.75, sd / 2, sl, 14), plugM, sx, sy - sl / 2, zp));
    cab.add(mesh("Plug", new RoundedBoxGeometry(Math.abs(bx1 - bx0), by0 - by1, 0.024, 1, 0.004), plugM, (bx0 + bx1) / 2, (by0 + by1) / 2, zp));
    const pin = (d, len, x, z) => new THREE.CylinderGeometry(d / 2, d / 2, len, 10).translate(x, by1 - len / 2, z);
    const pxc = (bx0 + bx1) / 2;
    cab.add(mesh("PlugPin", mergeGeometries([pin(0.007, 0.021, pxc, zp - 0.0065), pin(0.005, 0.016, pxc - 0.0095, zp + 0.0055), pin(0.005, 0.016, pxc + 0.0095, zp + 0.0055)]), pinM));
  }
  const [gx, gy] = rp.grommet;
  cab.add(mesh("Grommet", new THREE.CylinderGeometry(0.011, 0.012, 0.009, 20).rotateX(Math.PI / 2).scale(1, 1.45, 1), rubber, gx, gy, zBackFace - 0.0045));
  // the three transit bolts: a black rubber grommet and the bolt's hex head
  cab.add(mesh("BoltGrommet", mergeGeometries(rp.bolts.map(([x, y]) => new THREE.CylinderGeometry(0.0165, 0.0175, 0.006, 28).rotateX(Math.PI / 2).translate(x, y, zBackFace - 0.003))), rubber));
  cab.add(mesh("BoltHead", mergeGeometries(rp.bolts.map(([x, y]) => new THREE.CylinderGeometry(0.0068, 0.0068, 0.007, 6).rotateX(Math.PI / 2).translate(x, y, zBackFace - 0.0095))), steel));
  { // the cold-water inlet: a white ring round a blue core
    const [vx, vy] = rp.valve;
    const v = lathe("InletValve", [[0.0105, 0], [0.0105, 0.012], [0.0102, 0.0135], [0.0075, 0.0135], [0.0072, 0.012], [0.0072, 0.006]], valveWhite, 32);
    v.rotation.y = Math.PI; v.position.set(vx, vy, zBackFace);
    cab.add(v);
    cab.add(mesh("InletCore", new THREE.CircleGeometry(0.0072, 24).rotateY(Math.PI), valveBlue, vx, vy, zBackFace - 0.006));
  }
  { // the tub's aluminium cover: an arch on straight sides, its face the rear photo's own
    const tb = rp.tub, s = new THREE.Shape(), xc = (tb.x0 + tb.x1) / 2, a = (tb.x1 - tb.x0) / 2, b = tb.top - tb.spring, r = tb.r;
    s.moveTo(tb.x0, tb.spring); s.absellipse(xc, tb.spring, a, b, Math.PI, 0, true);
    s.lineTo(tb.x1, tb.bottom + r); s.absarc(tb.x1 - r, tb.bottom + r, r, 0, -Math.PI / 2, true);
    s.lineTo(tb.x0 + r, tb.bottom); s.absarc(tb.x0 + r, tb.bottom + r, r, -Math.PI / 2, -Math.PI, true); s.lineTo(tb.x0, tb.spring);
    const g = new THREE.ExtrudeGeometry(s, { depth: 0.0035, bevelEnabled: false, curveSegments: 12 });
    const pos = g.attributes.position, u = g.attributes.uv;
    for (let i = 0; i < pos.count; i++) u.setXY(i, (W / 2 - pos.getX(i)) / W, (backY1 - pos.getY(i)) / (backY1 - backY0));
    cab.add(mesh("TubPlate", g, rearM, 0, 0, zBackFace - 0.004));
  }
}

const parts = productParts(PRODUCTS, ID);
const clips = stateClips(root, parts);
saveZones(PRODUCTS, ID, root, parts);
// Grain (BENCHMARK.md section 10). Samsung names the colour "Black" (body) and the door "Carved Door (Black)"; its close photos
// show a smooth painted cabinet, so the painted faces (front, sides, top, the returns and the drawer's rim, the filter cover)
// get the gentle peel. No grain on the control strip, the keys and the buttons, which carry the print, nor on the glossy door,
// the chrome, the glass and the label.
const grain = { dir: `${TEX}/grain`, materials: {
  Front: { type: "peel_soft" }, SideL: { type: "peel_soft" }, SideR: { type: "peel_soft" }, BodyDark: { type: "peel_soft" },
  TopPlate: { type: "peel_soft" }, FlapFace: { type: "peel_soft" },
} };
await exportGLB(root, clips, OUT, {
  Front: `${T}/front.jpg`, SideL: `${T}/side_l.jpg`, SideR: `${T}/side_r.jpg`, Rear: `${T}/rear.jpg`, Panel: `${T}/panel.jpg`,
  PanelGlass: `${T}/panel.jpg`, Tray: `${T}/tray.jpg`, Drum: `${T}/drum.jpg`, Hose: `${T}/hose.jpg`, LabelBEE: `${T}/label.png`,
}, grain);
// the strip and the display glass carry the same print: keep one copy of panel.jpg in the file
{
  const { NodeIO } = await import("@gltf-transform/core");
  const { ALL_EXTENSIONS } = await import("@gltf-transform/extensions");
  const io = new NodeIO().registerExtensions(ALL_EXTENSIONS), doc = await io.read(OUT), r = doc.getRoot();
  const tex = (n) => r.listTextures().find((t) => t.getName() === n);
  const keep = tex("Panel"), dup = tex("PanelGlass");
  if (keep && dup) {
    for (const m of r.listMaterials()) if (m.getBaseColorTexture() === dup) m.setBaseColorTexture(keep);
    dup.dispose();
    fs.writeFileSync(OUT, await io.writeBinary(doc));
    console.log(OUT, (fs.statSync(OUT).size / 1024).toFixed(0) + " KB after sharing the strip's print");
  }
}
