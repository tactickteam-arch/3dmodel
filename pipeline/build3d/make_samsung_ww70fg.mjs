// Samsung WW70FG4S02ABTL, 7 kg front-load washing machine (WW4100F series) with Hygiene Steam and Digital Inverter, in Black,
// and the same body in Refined Inox (WW70FG4S02AXTL) as a second colour.
// Built to Samsung's published size, 600 W x 850 H x 490 D mm (product page; manual DC68-04378C: A 600, B 850, C 490, D 510 mm
// with the hoses at the back, E 980 mm with the door open at 90 degrees), from Samsung's own photos of this model (the straight-on
// front shut and open, the control band close, the 3/4 views, the left side with its three pressed channels, the back with its
// hoses, cord and plug as delivered) and the manual's control panel drawing: a control band leaning back with the detergent drawer
// at the left, the dial, the display with five keys and the Power and Start/Pause buttons; a flat brushed front, its lowest 21 cm
// leaning back to the plinth, with the round door seat; a black door hinged on the left over the gasket and the diamond drum; the
// filter cover at the bottom right; this model's energy label. Every position on the front comes from tex_samsung_ww70fg.py
// (layout.json); the back's from rear_paths.json.
// usage: node make_samsung_ww70fg.mjs <products.json> <tex dir> <out.glb>
import fs from "node:fs";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import { mergeGeometries as mergeRaw, mergeVertices } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { NodeIO } from "@gltf-transform/core";
import { ALL_EXTENSIONS, KHRMaterialsVariants } from "@gltf-transform/extensions";
import { THREE, mat, mesh, box, faced, group, lathe, inward, stateClips, exportGLB, productParts, saveZones } from "./lib.mjs";

const [PRODUCTS, TEX, OUT] = process.argv.slice(2);
const ID = "samsung-ww70fg4s02abtl";
const T = `${TEX}/samsung_ww70fg`;
const L = JSON.parse(fs.readFileSync(`${T}/layout.json`, "utf8"));
const rp = JSON.parse(fs.readFileSync(`${T}/rear_paths.json`, "utf8"));

// the colours Samsung sells this model in (the same body, door and drum): Black (WW70FG4S02ABTL) and Refined Inox (WW70FG4S02AXTL).
// The textures carry each colour's front, sides, back and band (suffix); the plain parts take these colours (sRGB, off the photos,
// times the textures' shade)
const FINISHES = [
  { name: "Black", suf: "", body: 0x2b2c2f, top: 0x1d1e21, label: "bee_label.png" },
  { name: "Refined Inox", suf: "_ax", body: 0x53504f, top: 0x4c4a48, label: "bee_label_ax.png" },
];
const F0 = FINISHES[0];

// ── size (metres) ──
const W = 0.6, H = 0.85, D = 0.49;                 // Samsung: 60.0 x 85.0 x 49.0 cm (product page; manual A, B, C)
const zB = -D / 2;
// Depths are measured off Samsung's side photo in mm from the back (1.4565 px/mm by the published height) and scaled so the door's
// front lands on the published 490 mm (the photo reads 494.7): 0.9905. ESTIMATED, +-2 mm.
const K = 0.9905;
const Zm = (mm) => (mm * K) / 1000 + zB;
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
// The front in profile (side photo; [h, mm from the back]): flat at 463.5 mm from the door's top down to 290 mm, then leaning back
// to 442 mm at its foot (31 mm), over a recessed plinth. The band above leans back from 460 mm at its foot (722 mm) to 433.5 mm
// at the top, under the worktop's front edge.
const FRONT = pchip([[31, 442], [37, 443.2], [78, 448], [119, 452.1], [160, 456.2], [201, 459.7], [243, 462.4], [290, 463.5], [721, 463.5]]);
const BAND = pchip([[722, 460], [740, 457.6], [770, 452], [800, 446], [822, 441.1], [844, 435], [849, 433.2]]);
const BOT = 0.031, SEAM0 = 0.7205, SEAM1 = 0.7225, BANDTOP = 0.8485;
const frontZ = (y) => Zm(FRONT(y * 1000));
const stripZ = (y) => Zm(BAND(y * 1000));
const slope = (f, y) => (f(y + 0.0005) - f(y - 0.0005)) / 0.001;     // dz/dy
const tilt = (f, y) => -Math.atan(-slope(f, y));                       // rotation about x that turns +z to the surface normal
const zFace = frontZ(0.5);                                             // the flat front round the door: 0.214

// ── the door (front photos; manual E 980 mm) ──
const cx = 0.0035, cy = 0.479, R = 0.25;            // centre and outer radius: ESTIMATED from the straight-on photos (+-3 mm)
// 980 mm deep with the door open at 90 degrees: the back (-0.245) + the hinge's z + the door's span (from the hinge to its far
// rim, 0.5 m) = 0.98, so the hinge axis is at z 0.235, at the rim's left edge
const hingeX = cx - R, hingeZ = zB + 0.98 - 2 * R;

// ── materials ──
const front = mat("Front", 0xffffff, { rough: 0.42 });
const sideL = mat("SideL", 0xffffff, { rough: 0.45 });
const sideR = mat("SideR", 0xffffff, { rough: 0.45 });
const rearM = mat("Rear", 0xffffff, { metal: 0.25, rough: 0.5 });
const panelM = mat("Panel", 0xffffff, { rough: 0.35 });
// the display glass is gloss black over the print (as WW80's, look pass 5 Nov 2026)
const glassFace = mat("PanelGlass", 0xffffff, { metal: 0.85, rough: 0.42 });
const bodyDark = mat("BodyDark", F0.body, { rough: 0.45 });
const topM = mat("TopPlate", F0.top, { rough: 0.35 });          // the worktop is gloss in the close photo
const flapM = mat("FlapFace", F0.body, { rough: 0.45 });
const dark = mat("Dark", 0x0b0c0d, { rough: 0.8 });
const trayM = mat("Tray", 0xffffff, { rough: 0.5 });
const trayWall = mat("TrayWall", 0xdfe2e6, { rough: 0.5 });
const knobCap = mat("KnobCap", 0x0c0d0f, { metal: 0.85, rough: 0.42 });
const knobRing = mat("KnobRing", 0x2a2c30, { metal: 0.7, rough: 0.25 });   // the smoked ring round the cap (close photo)
const chrome = mat("Chrome", 0xd0d3d8, { metal: 1, rough: 0.12 });
const lamp = mat("DialLamp", 0x46c4f0, { rough: 0.4, emissive: 0x46c4f0, emissiveIntensity: 0.8 });
const doorBlack = mat("DoorBlack", 0x0a0b0c, { metal: 0.25, rough: 0.22 });   // Samsung: Door "Black", gloss
const glass = mat("DoorGlass", 0x96989b, { metal: 1, rough: 0.03, opacity: 0.15, side: THREE.DoubleSide });
const bowl = mat("GlassBowl", 0xb4b6b9, { metal: 1, rough: 0.05, opacity: 0.25, side: THREE.DoubleSide });
const doorIn = mat("DoorInner", 0x56585c, { rough: 0.45 });    // the door's inner frame: mid grey (open photo)
const gasket = mat("Gasket", 0x2a2b2e, { rough: 0.85 });         // dark grey in the open-door photos
const drumM = mat("Drum", 0xffffff, { metal: 0.6, rough: 0.3 });
const steel = mat("Steel", 0xb9bcc1, { metal: 0.9, rough: 0.25 });
const footBase = mat("FootBase", 0x161718, { rough: 0.7 });
const labelM = mat("LabelBEE", 0xffffff, { rough: 0.5, opacity: 0.999 });
const filterM = mat("FilterCap", 0xb8bbbf, { rough: 0.5 });
const tubeM = mat("PumpHose", 0x111213, { rough: 0.7 });
const hoseM = mat("Hose", 0xffffff, { rough: 0.65 });           // ribbed light grey drain hose (rear photo)
const sleeveM = mat("HoseSleeveFace", 0x141516, { rough: 0.95 });   // the black foam sleeve on its lower end
const cuffM = mat("HoseCuffFace", 0xb4b6b9, { rough: 0.5 });
const clipM = mat("HoseClipFace", 0xe4e5e7, { rough: 0.5 });    // the hose and cord clips are white here
const cordM = mat("CordFace", 0x6d6f73, { rough: 0.55 });       // the cord is grey in the rear photo
const plugM = mat("PlugFace", 0x4b4d51, { rough: 0.5 });
const pinM = mat("PlugPinFace", 0xb0b3b8, { metal: 0.9, rough: 0.3 });
const rubber = mat("Rubber", 0x141516, { rough: 0.8 });
const valveWhite = mat("ValveWhite", 0xe8e9ea, { rough: 0.4 });
const valveBlue = mat("ValveBlue", 0x2a6fb8, { rough: 0.4 });

const mergeGeometries = (list, groups = false) => {
  if (list.every((g) => g.index)) return mergeRaw(list, groups);
  const m = mergeRaw(list.map((g) => (g.index ? g.toNonIndexed() : g)), groups);
  return groups ? m : mergeVertices(m, 1e-6);
};
const root = group("SamsungWW70");
const cab = group("Cabinet");
root.add(cab);

// a grid of rows x cols; pos(i, j) gives [x, y, z], uv(x, y, z) the texture place (v down from the image's top). Columns run so
// that (column direction) x (row direction) is the outward normal.
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
// the band's texture: x -300..300 mm, h 722..850 mm, v down from the top
const panelUV = (x, y) => [(x + W / 2) / W, (0.85 - y) / 0.128];

// ── cabinet: the sides carry the pressed channels (side photo), the back is Samsung's rear photo with the hoses painted out ──
// The side walls run from 416 mm in front of the back (where the front's return begins) to the back, h 25 to 821.5 mm (under the
// worktop's skirt); the textures span exactly that.
const sideY0 = 0.025, sideY1 = 0.8215, zBackFace = zB + 0.0015, sideZ0 = zBackFace, sideZ1 = Zm(416);
{
  const ys = [sideY0, sideY1], zs = [sideZ0, sideZ1];
  const vOf = (y) => (sideY1 - y) / (sideY1 - sideY0);
  // left: columns run front-to-back... columns along +z give the -x normal
  cab.add(grid("SideLeft", 2, 2, (i, j) => [-W / 2, ys[i], zs[j]], (x, y, z) => [(sideZ1 - z) / (sideZ1 - sideZ0), vOf(y)], sideL));
  cab.add(grid("SideRight", 2, 2, (i, j) => [W / 2, ys[i], zs[1 - j]], (x, y, z) => [(z - sideZ0) / (sideZ1 - sideZ0), vOf(y)], sideR));
}
// the worktop: a 10 mm slab over the full width, from the back to 1.5 mm in front of the band's top, with 18.5 mm skirts down the
// sides and the back (the side photo's band, h 821.5-850 mm). Its top has a narrow rim round the edges and a slightly lower field,
// as the 3/4 photos show (rim width and step ESTIMATED, as on WW80's worktop)
const zTopF = stripZ(BANDTOP) + 0.0015, zSkirtF = stripZ(BANDTOP) - 0.001;
{
  const rimW = 0.0185, fieldIn = 0.0277, drop = 0.0015, rr = 0.002;
  const arc = [0, 1, 2, 3, 4].map((i) => { const a = (i / 4) * Math.PI / 2; return [rr - rr * Math.cos(a), H - rr + rr * Math.sin(a)]; });
  const profiles = [[[0, H - 0.01], ...arc, [rimW, H]], [[rimW, H], [fieldIn, H - drop]]];
  const sides = [(s) => [[-W / 2 + s, zTopF - s], [W / 2 - s, zTopF - s]], (s) => [[W / 2 - s, zTopF - s], [W / 2 - s, zB + s]],
    (s) => [[W / 2 - s, zB + s], [-W / 2 + s, zB + s]], (s) => [[-W / 2 + s, zB + s], [-W / 2 + s, zTopF - s]]];
  const strip = (side, prof) => {
    const pos = [], uv = [], idx = [];
    for (const [s, y] of prof) for (const [x, z] of side(s)) { pos.push(x, y, z); uv.push((x + W / 2) / W, (z - zB) / (zTopF - zB)); }
    for (let k = 0; k < prof.length - 1; k++) { const a0 = 2 * k, b0 = a0 + 1, a1 = a0 + 2, b1 = a0 + 3; idx.push(a0, b0, b1, a0, b1, a1); }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
    g.setIndex(idx); g.computeVertexNormals(); return g;
  };
  const field = new THREE.PlaneGeometry(W - 2 * fieldIn, zTopF - zB - 2 * fieldIn).rotateX(-Math.PI / 2).translate(0, H - drop, (zTopF + zB) / 2);
  const sk = H - 0.01 - (sideY1 + 0.0005), skY = (H - 0.01 + sideY1 + 0.0005) / 2;
  const parts = [...sides.flatMap((sd) => profiles.map((pr) => strip(sd, pr))), field,
    new THREE.BoxGeometry(0.006, sk, zSkirtF - zB).translate(-W / 2 + 0.003, skY, (zSkirtF + zB) / 2),
    new THREE.BoxGeometry(0.006, sk, zSkirtF - zB).translate(W / 2 - 0.003, skY, (zSkirtF + zB) / 2),
    new THREE.BoxGeometry(W - 0.013, sk, 0.006).translate(0, skY, zB + 0.003)];
  cab.add(mesh("Top", mergeGeometries(parts), topM));
}
// the plinth under the sides and the front (h 13.5-25 mm), recessed: dark
const FOOT = 0.0135;
cab.add(box("Base", W - 0.002, sideY0 - FOOT, sideZ1 - sideZ0 - 0.006, dark, 0, (FOOT + sideY0) / 2, (sideZ0 + sideZ1) / 2 - 0.001));
const backY0 = rp.panel.y0, backY1 = rp.panel.y1;
{ // the back: the rear photo, h 15-821.5 mm
  const ys = [backY0, backY1], xs = [W / 2 - 0.0005, -W / 2 + 0.0005];
  cab.add(grid("BackPanel", 2, 2, (i, j) => [xs[j], ys[i], zBackFace], (x, y) => [(W / 2 - x) / W, (backY1 - y) / (backY1 - backY0)], rearM));
}
{ // four feet: a black pad and a silver nut, 13.5 mm in all; x from the rear photo (276 mm either side), z from the side photo
  // (390 mm and 43 mm from the back); ESTIMATED +-3 mm
  const pad = new THREE.CylinderGeometry(0.016, 0.016, 0.0065, 24).translate(0, 0.00325, 0);
  const nut = new THREE.CylinderGeometry(0.009, 0.009, 0.0072, 6).translate(0, 0.0065 + 0.0036 - 0.0001, 0);
  const at = [[-0.2757, Zm(390 / K)], [0.2757, Zm(390 / K)], [-0.2757, Zm(43 / K)], [0.2757, Zm(43 / K)]];
  const pads = mergeGeometries(at.map(([fx, fz]) => pad.clone().translate(fx, 0, fz)));
  const nuts = mergeGeometries(at.map(([fx, fz]) => nut.clone().translate(fx, 0, fz)));
  cab.add(mesh("Feet", mergeGeometries([pads, nuts], true), [footBase, steel]));
}

// ── the front: a brushed face with the door seat's round hole and the filter cover's opening, built in strips across ──
const seatR = 0.252;
const fl = { x0: 0.0921, x1: 0.2449, y0: 0.033, y1: 0.148, r: 0.007 };   // the filter cover (open-door photo, +-1 mm)
const flR = fl.r, fx0 = fl.x0 + 0.003, fx1 = fl.x1 - 0.003, fy0 = fl.y0 + 0.003, fy1 = fl.y1 - 0.003, fr = flR - 0.003 > 0 ? flR - 0.003 : 0.002;
const holes = [
  { y0: cy - seatR, y1: cy + seatR, at: (y) => { const w = Math.sqrt(Math.max(0, seatR ** 2 - (y - cy) ** 2)); return [cx - w, cx + w]; } },
  { y0: fy0, y1: fy1, at: (y) => {
    const d = y < fy0 + fr ? fy0 + fr - y : y > fy1 - fr ? y - (fy1 - fr) : 0;
    const w = fr - Math.sqrt(Math.max(0, fr ** 2 - Math.min(d, fr) ** 2));
    return [fx0 + w, fx1 - w];
  } },
];
const frontUV = (x, y) => [(x + W / 2) / W, (SEAM0 - y) / (SEAM0 - BOT)];
{
  let ys = range(BOT, SEAM0, 69);
  for (let k = 0; k <= 120; k++) ys.push(cy + seatR * Math.sin(-Math.PI / 2 + (Math.PI * k) / 120));
  for (let k = 0; k <= 6; k++) { const a = (Math.PI / 2) * k / 6; ys.push(fy0 + fr - fr * Math.cos(a), fy1 - fr + fr * Math.cos(a)); }
  ys = uniq(ys.filter((y) => y >= BOT && y <= SEAM0));
  const P = [], N = [], U = [];
  const vert = (x, y) => {
    const z = frontZ(y), s = slope(frontZ, y), n = new THREE.Vector3(0, -s, 1).normalize();
    P.push(x, y, z); N.push(n.x, n.y, n.z); U.push(...frontUV(x, y));
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
  cab.add(mesh("FrontFace", g, front));
}
// the front's foot: its underside back to the plinth (415 mm from the back), and the plinth's face down to the feet
const zPlinth = Zm(414);
cab.add(grid("FrontFoot", 2, 2, (i, j) => [j ? -W / 2 : W / 2, BOT, i ? zPlinth : frontZ(BOT)], null, bodyDark));
cab.add(grid("FrontPlinth", 2, 2, (i, j) => [j ? W / 2 : -W / 2, i ? BOT : FOOT, zPlinth], null, dark));
// the groove between the front's top edge and the band's foot (front photos: a dark line), and the ledge back to the band
{
  const zf = frontZ(SEAM0) - 0.0005, zb = stripZ(SEAM1) - 0.004, y0 = SEAM0 - 0.003;
  cab.add(box("FrontSeam", W - 0.001, SEAM1 - y0, zf - zb, dark, 0, (y0 + SEAM1) / 2, (zf + zb) / 2));
}
{ // the front's returns at the two sides, from the side walls' front edge (416 mm from the back) to the profile; above the side
  // walls (h 821.5 mm) they meet the worktop's skirt
  const prof = [];
  for (const y of range(BOT, SEAM0, 50)) prof.push([frontZ(y), y]);
  for (const y of range(SEAM1, H - 0.0105, 20)) prof.push([stripZ(y), y]);
  const shape = (sgn) => {
    const s = new THREE.Shape();
    s.moveTo(sgn * sideZ1, BOT);
    for (const [z, y] of prof) s.lineTo(sgn * z, y);
    s.lineTo(sgn * zSkirtF, H - 0.0105);
    s.lineTo(sgn * zSkirtF, sideY1);
    s.lineTo(sgn * sideZ1, sideY1);
    s.lineTo(sgn * sideZ1, BOT);
    return new THREE.ShapeGeometry(s);
  };
  const l = mesh("SideReturnL", shape(1), bodyDark, -W / 2, 0, 0); l.rotation.y = -Math.PI / 2; cab.add(l);
  const r = mesh("SideReturnR", shape(-1), bodyDark, W / 2, 0, 0); r.rotation.y = Math.PI / 2; cab.add(r);
}

// ── the door seat: the black groove the door's rim sits in, a dish in the body colour, the gasket's rolled lip and its boot back
// to the drum (open-door photo: groove 248-252 mm, the gasket's edge 205 mm, the drum's mouth 176 mm; depths ESTIMATED) ──
const ring = (name, rings, material, segs = 120, uvf = null) => grid(name, rings.length, segs + 1, (i, j) => {
  const a = (2 * Math.PI * j) / segs, [r, dz] = rings[i];
  const x = cx + Math.cos(a) * r, y = cy + Math.sin(a) * r;
  return [x, y, frontZ(y) + dz];
}, uvf, material);
cab.add(ring("SeatGroove", [[seatR, 0], [0.2505, -0.004], [0.2475, -0.0055]], dark));
const DISH = [[0.2475, -0.0055], [0.24, -0.008], [0.225, -0.011], [0.212, -0.015], [0.207, -0.019]];
const dishDz = (r) => { for (let i = 1; i < DISH.length; i++) if (r >= DISH[i][0]) { const [r0, z0] = DISH[i - 1], [r1, z1] = DISH[i]; return z1 + ((z0 - z1) * (r - r1)) / (r0 - r1); } return DISH.at(-1)[1]; };
cab.add(ring("SeatDish", DISH, front, 120, frontUV));
const lock = { x: cx + 0.2125, y: 0.469 };          // the lock's slot right of the opening (open photo: 216 mm right, 469 mm up)
{
  const r = Math.hypot(lock.x - cx, lock.y - cy), z = zFace + dishDz(r);
  const g = group("LockSlotMount", lock.x, lock.y, z);
  g.rotation.y = -Math.atan2(dishDz(r + 0.005) - dishDz(r - 0.005), 0.01);
  g.add(faced("LockSlot", 0.014, 0.018, 0.003, [dark, dark, dark, dark, dark, dark], 0, 0, 0.0004));
  const sc = new THREE.CylinderGeometry(0.0026, 0.0026, 0.002, 12).rotateX(Math.PI / 2);
  g.add(mesh("LockSlotScrews", mergeGeometries([sc.clone().translate(0, 0.034, 0.0006), sc.clone().translate(0, -0.024, 0.0006)]), steel));
  cab.add(g);
}
const hingeR = 0.1935;                               // the hinge's brackets left of the opening (open photo: 190 mm left of the middle)
cab.add(mesh("HingePlate", mergeGeometries([-1, 1].map((s) => new THREE.BoxGeometry(0.02, 0.034, 0.006).translate(cx - hingeR, cy + s * 0.069, zFace - 0.019 + 0.0055 + 0.003))), steel));
const zG = zFace - 0.019;
cab.add(lathe("Gasket", [[0.207, zG], [0.202, zG + 0.004], [0.196, zG + 0.006], [0.189, zG + 0.005], [0.183, zG + 0.0], [0.178, zG - 0.012],
  [0.174, zG - 0.03], [0.170, zG - 0.048], [0.166, zG - 0.066]], gasket).translateX(cx).translateY(cy));

// ── the diamond drum: diamond-pressed wall, three lifters, the back's three-armed spider (open-door photo); sizes ESTIMATED ──
const drumR = 0.225, drumDepth = 0.22, drumFront = zG - 0.07, drumZ = drumFront - drumDepth / 2;
{
  const g = inward(new THREE.CylinderGeometry(drumR, drumR, drumDepth, 72, 1, true));
  g.rotateX(Math.PI / 2);
  const uv = g.attributes.uv, uRep = (2 * Math.PI * drumR) / 0.3, vRep = drumDepth / 0.15;   // drum.jpg: a 300 x 150 mm tile
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * uRep, 1 - uv.getY(i) * vRep);
  cab.add(mesh("DrumShell", g, drumM, cx, cy, drumZ));
}
cab.add(lathe("DrumLip", [[drumR, drumFront], [0.164, drumFront + 0.006]], steel).translateX(cx).translateY(cy));
cab.add(lathe("DrumBack", [[drumR, drumZ - drumDepth / 2], [0.12, drumZ - drumDepth / 2 + 0.006], [0.05, drumZ - drumDepth / 2 + 0.018], [0, drumZ - drumDepth / 2 + 0.02]], steel, 72).translateX(cx).translateY(cy));
{
  const ARMS = [Math.PI / 6, (5 * Math.PI) / 6, -Math.PI / 2];   // the lifters at 2, 10 and 6 o'clock (open photo)
  const arms = [], lifts = [];
  for (const a of ARMS) {
    const arm = new RoundedBoxGeometry(0.18, 0.07, 0.03, 1, 0.012);
    arm.translate(0.13, 0, 0).rotateZ(a).translate(cx, cy, drumZ - drumDepth / 2 + 0.012);
    arms.push(arm);
    const lift = new RoundedBoxGeometry(0.05, 0.034, drumDepth - 0.02, 2, 0.014);
    lift.translate(0, -drumR + 0.012, 0).rotateZ(a + Math.PI / 2).translate(cx, cy, drumZ);
    lifts.push(lift);
  }
  arms.push(new THREE.CylinderGeometry(0.05, 0.055, 0.04, 40).rotateX(Math.PI / 2).translate(cx, cy, drumZ - drumDepth / 2 + 0.02));
  cab.add(mesh("DrumSpider", mergeGeometries(arms), steel));
  cab.add(mesh("DrumLifters", mergeGeometries(lifts), steel));
}

// ── the control band: one leaning face carrying the print (panel.jpg), the drawer in its left part ──
const seam = L.seam, stripRows = uniq([...range(SEAM1, BANDTOP, 50)]);
{
  const xs = [seam + 0.0005, W / 2];
  cab.add(grid("Fascia", stripRows.length, 2, (i, j) => [xs[j], stripRows[i], stripZ(stripRows[i])], panelUV, panelM));
}
// the display glass, 1.6 mm proud, above the row of keys
{
  const g = L.glass, y0 = Math.max(...L.keys.map((k) => k.y1)) + 0.0004;
  const lin = (y) => { const i = Math.min(stripRows.length - 2, stripRows.findIndex((r, k) => stripRows[k + 1] >= y));
    const t = (y - stripRows[i]) / (stripRows[i + 1] - stripRows[i]); return stripZ(stripRows[i]) * (1 - t) + stripZ(stripRows[i + 1]) * t; };
  const rows = [y0, ...stripRows.filter((y) => y > y0 + 1e-5 && y < g.y1 - 1e-5), g.y1];
  cab.add(grid("DisplayGlass", rows.length, 2, (i, j) => [j ? g.x1 : g.x0, rows[i], lin(rows[i]) + 0.0016], panelUV, glassFace));
}
// the five keys (light grey, raised 2.4 mm along the display's foot) and the Power and Start/Pause buttons (raised 4.5 mm in their
// frames); the band's print on their faces
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
// the dial: a smoked ring with a bright edge round a gloss black cap, 15 mm proud (side photo), with its cyan lamp at the ring's top
// right (close photo); radius from the front photo (29.7 mm)
{
  const d = L.dial, s = d.r / 0.029, k = group("Dial", d.x, d.y, stripZ(d.y));
  k.rotation.x = tilt(stripZ, d.y);
  k.add(lathe("KnobRing", [[0.0288 * s, -0.002], [0.0290 * s, 0.008], [0.0287 * s, 0.0125], [0.0279 * s, 0.0148], [0.0264 * s, 0.0156], [0.0250 * s, 0.015], [0.0245 * s, 0.0125]], knobRing, 72));
  k.add(lathe("KnobEdge", [[0.0290 * s + 0.0002, 0.0105], [0.0288 * s + 0.0002, 0.0135], [0.0279 * s + 0.0002, 0.0151]], chrome, 72));
  k.add(lathe("KnobCap", [[0.0245 * s, 0.0125], [0.0243 * s, 0.0138], [0.021 * s, 0.0149], [0.012 * s, 0.0156], [0, 0.0158]], knobCap, 72));
  const a = (65 * Math.PI) / 180, rl = 0.0270 * s;
  const lg = new THREE.BoxGeometry(0.0022, 0.0045, 0.0012).rotateZ(a - Math.PI / 2).translate(Math.cos(a) * rl, Math.sin(a) * rl, 0.0156);
  k.add(mesh("DialLamp", lg, lamp));
  cab.add(k);
}

// ── the detergent drawer: the band's left part (SAMSUNG, the grip slot scooped under the print), its rim, and the tray behind with
// the manual's three compartments, left to right: II main wash, the softener with its blue siphon cap, I prewash ──
const dx0 = -W / 2 + 0.002, dx1 = seam - 0.0005;
const pk = L.pocket, lipY = pk.y1;
const smooth = (t) => (t <= 0 ? 0 : t >= 1 ? 1 : t * t * (3 - 2 * t));
const pkRamp = 0.008;                                // the slot's ends are steep in the 3/4 photos: ESTIMATED
const pocketDepth = (x, y) => {
  const fx = smooth((x - pk.x0) / pkRamp) * smooth((pk.x1 - x) / pkRamp);
  const fy = y > lipY ? 0 : y > lipY - 0.0007 ? 1 - (y - (lipY - 0.0007)) / 0.0007 : smooth((y - pk.y0) / (lipY - 0.0007 - pk.y0));
  return 0.014 * fx * fy;                            // 14 mm deep under its lip: ESTIMATED from the 3/4 photos
};
const drawer = group("Drawer", 0, 0, 0);
const trayL = 0.26;
{
  const rows = uniq([...stripRows, ...range(pk.y0, lipY - 0.0007, 18), lipY - 0.0007, lipY, lipY + 0.001]);
  const cols = uniq([...range(dx0, dx1, 20), ...range(pk.x0, pk.x0 + pkRamp, 6), ...range(pk.x1 - pkRamp, pk.x1, 6)]);
  drawer.add(grid("DrawerFace", rows.length, cols.length, (i, j) => [cols[j], rows[i], stripZ(rows[i]) - pocketDepth(cols[j], rows[i])], panelUV, panelM));
  const yr = stripRows, dep = 0.012;
  drawer.add(grid("DrawerRimL", yr.length, 2, (i, j) => [dx0, yr[i], stripZ(yr[i]) - (j ? 0 : dep)], null, bodyDark));
  drawer.add(grid("DrawerRimR", yr.length, 2, (i, j) => [dx1, yr[i], stripZ(yr[i]) - (j ? dep : 0)], null, bodyDark));
  drawer.add(grid("DrawerRimTop", 2, 2, (i, j) => [j ? dx1 : dx0, BANDTOP, stripZ(BANDTOP) - (i ? dep : 0)], null, bodyDark));
  drawer.add(grid("DrawerRimBottom", 2, 2, (i, j) => [j ? dx1 : dx0, SEAM1, stripZ(SEAM1) - (i ? 0 : dep)], null, bodyDark));
  const tw = dx1 - dx0 - 0.014, th = 0.07, zt = stripZ(0.78) - 0.019 - trayL / 2, y0 = 0.737 + th / 2;
  const tg = new THREE.BoxGeometry(tw, 0.0025, trayL), tuv = tg.attributes.uv;
  for (let i = 8; i < 12; i++) tuv.setXY(i, tuv.getX(i), 1 - tuv.getY(i));
  const xc = (dx0 + dx1) / 2;
  drawer.add(mesh("TrayFloor", tg, [trayWall, trayWall, trayM, trayWall, trayWall, trayWall], xc, y0 - th / 2 + 0.00125, zt));
  const walls = [new THREE.BoxGeometry(0.0025, th, trayL).translate(xc - tw / 2 + 0.00125, y0, zt), new THREE.BoxGeometry(0.0025, th, trayL).translate(xc + tw / 2 - 0.00125, y0, zt),
    new THREE.BoxGeometry(tw, th, 0.0025).translate(xc, y0, zt - trayL / 2 + 0.00125)];
  const xa = xc - tw / 2 + tw * (250 / 512), xb = xc - tw / 2 + tw * (352 / 512);    // the dividers where tray.jpg draws them
  walls.push(new THREE.BoxGeometry(0.0025, th * 0.85, trayL * 0.96).translate(xa, y0 - th * 0.075, zt), new THREE.BoxGeometry(0.0025, th * 0.85, trayL * 0.96).translate(xb, y0 - th * 0.075, zt));
  drawer.add(mesh("TrayWalls", mergeGeometries(walls), trayWall));
  drawer.add(box("TraySiphon", xb - xa - 0.008, 0.014, 0.03, mat("TraySiphonCap", 0x4a8ad0, { rough: 0.4 }), (xa + xb) / 2, y0 - th / 2 + 0.009, zt + trayL / 2 - 0.05));
}
cab.add(drawer);
// the dark bay the drawer slides out of, under the worktop's slab
cab.add(mesh("DrawerBay", inward(new THREE.BoxGeometry(dx1 - dx0 + 0.001, H - 0.0105 - SEAM1, 0.29)), dark, (dx0 + dx1) / 2, (SEAM1 + H - 0.0105) / 2, stripZ(BANDTOP) - 0.002 - 0.145));

// ── the filter cover: a rounded lid hinged along its lower edge over the debris filter's knob and the emergency drain tube ──
{
  const yc = (fy0 + fy1) / 2, bay = group("FlapBayMount", (fl.x0 + fl.x1) / 2, yc, frontZ(yc));
  bay.rotation.x = tilt(frontZ, yc);
  bay.add(mesh("FlapBay", inward(new THREE.BoxGeometry(fx1 - fx0, fy1 - fy0, 0.05)), bodyDark, 0, 0, -0.0012 - 0.025));
  bay.add(mesh("FlapFilterKnob", new THREE.CylinderGeometry(0.028, 0.028, 0.02, 36).rotateX(Math.PI / 2), filterM, 0.03, -0.004, -0.03));
  bay.add(box("FlapFilterGrip", 0.008, 0.048, 0.012, filterM, 0.03, -0.004, -0.016));
  const tube = new THREE.CatmullRomCurve3([new THREE.Vector3(-0.05, -0.03, -0.04), new THREE.Vector3(-0.046, 0.0, -0.03), new THREE.Vector3(-0.042, 0.022, -0.022)]);
  bay.add(mesh("FlapDrainTube", new THREE.TubeGeometry(tube, 12, 0.006, 10, false), tubeM));
  bay.add(mesh("FlapDrainCap", new THREE.CylinderGeometry(0.008, 0.008, 0.012, 16), tubeM, -0.042, 0.025, -0.021));
  cab.add(bay);
}
const pivotY = fl.y0, pivotZ = frontZ(fl.y0);
const filter = group("FilterFlap", 0, pivotY, pivotZ);
{ // the lid's face follows the front's lean row by row (a flat lid would stand off it in the middle), 2 mm proud, with a 3 mm
  // edge back to the front; the finger notch at its top's middle (open photo: 21 mm wide, 7 mm deep) is a dark slot
  const r = fl.r, x0 = fl.x0, x1 = fl.x1, y0 = fl.y0, y1 = fl.y1, lift = 0.002;
  const xin = (y) => { const d = y < y0 + r ? y0 + r - y : y > y1 - r ? y - (y1 - r) : 0; return r - Math.sqrt(Math.max(0, r * r - Math.min(d, r) ** 2)); };
  let ys = range(y0, y1, 24);
  for (let k = 0; k <= 6; k++) { const a = (Math.PI / 2) * k / 6; ys.push(y0 + r - r * Math.cos(a), y1 - r + r * Math.cos(a)); }
  ys = uniq(ys);
  const P = [], I = [], E = [], EI = [];
  ys.forEach((y) => { const w = xin(y); P.push(x0 + w, y - pivotY, frontZ(y) + lift - pivotZ, x1 - w, y - pivotY, frontZ(y) + lift - pivotZ); });
  for (let k = 0; k < ys.length - 1; k++) { const a0 = 2 * k; I.push(a0, a0 + 1, a0 + 2, a0 + 1, a0 + 3, a0 + 2); }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(P, 3));
  g.setIndex(I); g.computeVertexNormals();
  // the edge: round the outline, from the face back 3 mm
  const ring = [...ys.map((y) => [x1 - xin(y), y]), ...ys.slice().reverse().map((y) => [x0 + xin(y), y])];
  ring.forEach(([x, y]) => { const z = frontZ(y) - pivotZ; E.push(x, y - pivotY, z + lift, x, y - pivotY, z + lift - 0.003); });
  for (let k = 0; k < ring.length; k++) { const a0 = 2 * k, b0 = 2 * ((k + 1) % ring.length); EI.push(a0, a0 + 1, b0, a0 + 1, b0 + 1, b0); }
  const e = new THREE.BufferGeometry();
  e.setAttribute("position", new THREE.Float32BufferAttribute(E, 3));
  e.setIndex(EI); e.computeVertexNormals();
  filter.add(mesh("FlapFace", mergeGeometries([g, e]), flapM));
  const nx = (x0 + x1) / 2 - 0.006, ny = y1 - 0.0035;
  const notch = new THREE.BoxGeometry(0.021, 0.007, 0.002).rotateX(tilt(frontZ, ny)).translate(nx, ny - pivotY, frontZ(ny) + lift + 0.0002 - pivotZ);
  filter.add(mesh("FlapNotch", notch, dark));
}
root.add(filter);

// ── Samsung's energy label for this model, on the front at the bottom left where Samsung's front photo shows it (centre 197 mm
// left of the middle, 162 mm up), 64 mm wide like the other washer labels, following the front's lean ──
{
  const w = 0.064, h = w / 0.5059, xc = -0.197, yc = 0.162;
  const g = new THREE.PlaneGeometry(w, h, 1, 32), pos = g.attributes.position, uv = g.attributes.uv;
  for (let i = 0; i < uv.count; i++) uv.setY(i, 1 - uv.getY(i));
  for (let i = 0; i < pos.count; i++) { const y = pos.getY(i) + yc; pos.setXYZ(i, pos.getX(i) + xc, y, frontZ(y) + 0.0012); }
  g.computeVertexNormals();
  cab.add(mesh("LabelBEE", g, labelM));
}

// ── the door: hinged on the left; a gloss black ring, the clear glass dome, the grey inner frame with the glass bowl, the latch.
// The front's profile is the side photo's (the dome 494.7 mm from the back at the middle, 485 mm where the glass meets the ring) ──
const door = group("Door", hingeX, cy, hingeZ);
const dc = group("DoorCentre", cx - hingeX, 0, -hingeZ);         // the profiles below are in the cabinet's z
const zr = (pts) => pts.map(([r, mm]) => [r, Zm(mm)]);
dc.add(lathe("DoorInner", zr([[0.172, 454], [0.18, 455.2], [0.2, 456.5], [0.235, 458.3], [0.2485, 459]]), doorIn));
dc.add(lathe("DoorRim", zr([[0.2485, 459], [0.2502, 461.5], [0.2505, 465], [0.249, 468], [0.243, 470.5], [0.232, 473], [0.219, 476], [0.206, 478.5], [0.192, 481.3], [0.178, 483.6], [0.166, 485.2]]), doorBlack));
dc.add(lathe("DoorGlass", zr([[0.166, 485.2], [0.137, 488.8], [0.110, 491.6], [0.083, 493.6], [0.05, 494.5], [0.0, 494.7]]), glass));
dc.add(lathe("DoorTube", zr([[0.172, 454], [0.166, 485.2]]), mat("DoorTubeFace", 0x101112, { rough: 0.5, side: THREE.DoubleSide })));
dc.add(lathe("DoorBowl", zr([[0.172, 454], [0.166, 442], [0.152, 424], [0.128, 405], [0.095, 392], [0.05, 385], [0.0, 384]]), bowl));
dc.add(box("DoorLatchPlate", 0.022, 0.04, 0.003, steel, lock.x - cx, lock.y - cy, Zm(455.5)));
dc.add(box("DoorLatchHook", 0.008, 0.012, 0.014, steel, lock.x - cx, lock.y - cy, Zm(448)));
for (const s of [1, -1]) dc.add(box(`DoorHingeArm${s > 0 ? "Top" : "Bottom"}`, 0.024, 0.022, 0.016, steel, -hingeR + 0.004, s * 0.069, Zm(450)));
door.add(dc);
root.add(door);

// ── the back, as delivered (Samsung's rear photo): the ribbed drain hose from its foam sleeve at the lower left (seen from behind)
// up, over the top and down the other side to its smooth end; the grey cord from its grommet round its loop, along the top and down
// to the Indian 3-pin plug; four transit bolts in rubber; the cold-water inlet and its white fitting; the tub's aluminium cover
// standing 3.5 mm proud. Centre lines and sizes traced off the photo by tex_samsung_ww70fg.py; how far each stands off the back is
// ESTIMATED (the side photo: the hoses reach 24 mm behind the back, as the manual's D 510 mm against C 490 mm).
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
  tube("HoseSleeve", v3(rp.sleeve, zHose), rp.sleeve_d / 2, sleeveM, 14, 60);
  {
    const [[ax, ay], [bx, by]] = rp.cuff, len = Math.hypot(bx - ax, by - ay);
    const cuff = mesh("HoseCuff", new THREE.CylinderGeometry(rp.cuff_d / 2, rp.cuff_d / 2, len, 20), cuffM, (ax + bx) / 2, (ay + by) / 2, zHose);
    cuff.rotation.z = Math.atan2(-(bx - ax), by - ay);
    cab.add(cuff);
    cab.add(mesh("HoseEnd", new THREE.CylinderGeometry(rp.cuff_d / 2 - 0.001, rp.cuff_d / 2 - 0.001, 0.002, 20), dark, bx, by - 0.0005, zHose));
  }
  cab.add(mesh("HoseClip", mergeGeometries(rp.clips.map(([x, y, w, h]) => new RoundedBoxGeometry(w, h, 0.012, 1, 0.002).translate(x, y, zBackFace - 0.006))), clipM));
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
  cab.add(mesh("Grommet", new THREE.CylinderGeometry(0.011, 0.012, 0.009, 20).rotateX(Math.PI / 2).scale(1, 1.3, 1), rubber, gx, gy, zBackFace - 0.0045));
  cab.add(mesh("BoltGrommet", mergeGeometries(rp.bolts.map(([x, y]) => new THREE.CylinderGeometry(0.0165, 0.0175, 0.006, 28).rotateX(Math.PI / 2).translate(x, y, zBackFace - 0.003))), rubber));
  cab.add(mesh("BoltHead", mergeGeometries(rp.bolts.map(([x, y]) => new THREE.CylinderGeometry(0.0068, 0.0068, 0.007, 6).rotateX(Math.PI / 2).translate(x, y, zBackFace - 0.0095))), steel));
  { // the cold-water inlet: a white ring round a blue core, its two screws, and the white fitting beside it
    const [vx, vy] = rp.valve;
    const v = lathe("InletValve", [[0.0105, 0], [0.0105, 0.012], [0.0102, 0.0135], [0.0075, 0.0135], [0.0072, 0.012], [0.0072, 0.006]], valveWhite, 32);
    v.rotation.y = Math.PI; v.position.set(vx, vy, zBackFace);
    cab.add(v);
    cab.add(mesh("InletCore", new THREE.CircleGeometry(0.0072, 24).rotateY(Math.PI), valveBlue, vx, vy, zBackFace - 0.006));
    cab.add(mesh("InletScrews", mergeGeometries(rp.valve_screws.map(([x, y]) => new THREE.CylinderGeometry(0.003, 0.003, 0.003, 10).rotateX(Math.PI / 2).translate(x, y, zBackFace - 0.0015))), steel));
    const [bx, by, bw, bh] = rp.block;
    cab.add(mesh("InletBlock", new RoundedBoxGeometry(bw, bh, 0.022, 1, 0.004), valveWhite, bx, by, zBackFace - 0.011));
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
// Grain (BENCHMARK.md section 10). The front is brushed across in Samsung's photos (both colours): the soft hairline, across. The
// sides, worktop, returns, the drawer's rim and the filter cover are smooth paint: the soft peel. None on the band, the keys and
// buttons (they carry the print), the gloss door, the glass, the chrome and the label.
const grain = { dir: `${TEX}/grain`, materials: {
  Front: { type: "hairline_soft", dir: "h" }, SideL: { type: "peel_soft" }, SideR: { type: "peel_soft" }, BodyDark: { type: "peel_soft" },
  TopPlate: { type: "peel_soft" }, FlapFace: { type: "peel_soft" },
} };
await exportGLB(root, clips, OUT, {
  Front: `${T}/front.jpg`, SideL: `${T}/side_l.jpg`, SideR: `${T}/side_r.jpg`, Rear: `${T}/rear.jpg`, Panel: `${T}/panel.jpg`,
  PanelGlass: `${T}/panel.jpg`, Tray: `${T}/tray.jpg`, Drum: `${T}/drum.jpg`, Hose: `${T}/hose.jpg`, LabelBEE: `${T}/${F0.label}`,
}, grain);

// the band and the display glass carry the same print: one copy of panel.jpg; then the colours as material variants
// (KHR_materials_variants), Black first: Refined Inox gets its own copy of the front, sides, back, band, worktop, returns, filter
// cover and label materials
{
  const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
  const doc = await io.read(OUT), r = doc.getRoot();
  const named = (n) => r.listMaterials().find((m) => m.getName() === n);
  { const keep = named("Panel").getBaseColorTexture(), dup = named("PanelGlass").getBaseColorTexture();
    if (keep && dup && keep !== dup) { named("PanelGlass").setBaseColorTexture(keep); dup.dispose(); } }
  const ext = doc.createExtension(KHRMaterialsVariants);
  const vs = FINISHES.map((f) => ext.createVariant(f.name));
  const lin = (c) => [(c >> 16) & 255, (c >> 8) & 255, c & 255].map((v) => { v /= 255; return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; });
  const texs = new Map();
  const tex = (file) => {
    if (!texs.has(file)) texs.set(file, doc.createTexture(file.split("/").pop().replace(/\.\w+$/, "")).setImage(new Uint8Array(fs.readFileSync(file))).setMimeType(file.endsWith(".png") ? "image/png" : "image/jpeg"));
    return texs.get(file);
  };
  const SET = {
    Front: (m, f) => m.setBaseColorTexture(tex(`${T}/front${f.suf}.jpg`)),
    SideL: (m, f) => m.setBaseColorTexture(tex(`${T}/side_l${f.suf}.jpg`)),
    SideR: (m, f) => m.setBaseColorTexture(tex(`${T}/side_r${f.suf}.jpg`)),
    Rear: (m, f) => m.setBaseColorTexture(tex(`${T}/rear${f.suf}.jpg`)),
    Panel: (m, f) => m.setBaseColorTexture(tex(`${T}/panel${f.suf}.jpg`)),
    PanelGlass: (m, f) => m.setBaseColorTexture(tex(`${T}/panel${f.suf}.jpg`)),
    BodyDark: (m, f) => m.setBaseColorFactor([...lin(f.body), 1]),
    FlapFace: (m, f) => m.setBaseColorFactor([...lin(f.body), 1]),
    TopPlate: (m, f) => m.setBaseColorFactor([...lin(f.top), 1]),
    LabelBEE: (m, f) => m.setBaseColorTexture(tex(`${T}/${f.label}`)),
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
  for (const m of r.listMeshes()) for (const p of m.listPrimitives()) {
    const list0 = alt[p.getMaterial()?.getName()];
    if (!list0) continue;
    const list = ext.createMappingList();
    list0.forEach((mm, i) => list.addMapping(ext.createMapping().setMaterial(mm).addVariant(vs[i])));
    p.setExtension("KHR_materials_variants", list);
  }
  fs.writeFileSync(OUT, await io.writeBinary(doc));
  console.log(OUT, (fs.statSync(OUT).size / 1048576).toFixed(2) + " MB with", FINISHES.length, "colours");
}
