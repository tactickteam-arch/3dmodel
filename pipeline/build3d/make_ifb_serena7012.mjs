// IFB Serena MBN 7012K CMS, 7 kg front-load washing machine, Mocha body, black control panel, black glass door.
// Built to IFB's published size, 598 W x 521 D x 875 H mm (product page; Sangeetha's listing agrees; the manual shared with
// other models gives 518 mm for 7 kg), from IFB's own photos of this model (front, both 3/4 views, door open, drawer open;
// every one prints "SERENA MBN 7.0KG 1200RPM") and IFB's manual UF421PKMAN790 G (the parts, the drawer's compartments, the
// filter door, the back and the transit bolts). IFB draws it on the same cabinet as the Executive Plus MBN 1014K CMS, so this
// is make_ifb_serena7012.mjs with the Serena's depth, its print and its door: one black glass disc with a black rim, no chrome,
// the door's back and edge in the body colour (IFB's open-door photo). Positions come from tex_ifb_serena7012.py
// (layout.json). What is measured and what is ESTIMATED is listed in private/research/ifb_serena7012/NOTES.md.
// usage: node make_ifb_serena7012.mjs <products.json> <tex dir> <out.glb>
import fs from "node:fs";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { THREE, mat, mesh, box, group, lathe, frontWithHoles, inward, stateClips, exportGLB, productParts, saveZones } from "./lib.mjs";

const [PRODUCTS, TEX, OUT] = process.argv.slice(2);
const ID = "ifb-serena-mbn-7012k-cms";
const T = `${TEX}/ifb_serena7012`;
const L = JSON.parse(fs.readFileSync(`${T}/layout.json`, "utf8"));

// ── size (metres) ──
const W = L.W, H = L.H, D = L.D;                               // 0.598 x 0.875 x 0.667 (IFB)
const PROUD = 0.010;                                           // the black fascia stands 10 mm in front of the mocha body (ESTIMATED, 3/4 photos)
const zFF = D / 2, zF = zFF - PROUD, zB = -D / 2;              // the fascia's front is IFB's depth; the door stands in front of it
const feet = L.feet, faceBot = L.face_bot, chinBot = L.chin_bot, seam = L.seam;
const SX = W / 2 - 0.0025;                                     // the mocha sides sit 2.5 mm inside the fascia (photo: 794 vs 803 px)
const rc = 0.008;                                              // the front's rounded vertical edges (the photo's highlight band)
const fasciaD = 0.028;                                         // how far back the black fascia reaches (ESTIMATED, 3/4 photos)
const door = L.door, flap = L.flap;
const seatR = 0.2475, gasketR = 0.163;                         // the door seat's groove and the gasket's lip (IFB's open-door photo: 240-247 and 160-163 mm)
const drumR = 0.235, drumDepth = 0.30, drumZ = zF - 0.095 - drumDepth / 2;   // ESTIMATED; the drum's volume is not published

// ── materials ──
const MOCHA = 0x3e3632;                                        // matched to IFB's front photo, mean over its height (see NOTES)
const mocha = mat("Front", MOCHA, { metal: 0.25, rough: 0.42 });
const sideM = mat("Side", MOCHA, { metal: 0.25, rough: 0.45 });
const topM = mat("TopPlate", MOCHA, { metal: 0.15, rough: 0.6 });
const rearM = mat("Rear", 0x3a332f, { metal: 0.2, rough: 0.55 });
const flapM = mat("FlapFace", MOCHA, { metal: 0.25, rough: 0.42 });
const panelM = mat("Panel", 0xffffff, { rough: 0.3 });
const drawerM = mat("DrawerFace", 0xffffff, { rough: 0.32 });
const fascia = mat("Fascia", 0x1c1c1e, { rough: 0.32 });
const glassBlack = mat("DisplayGlassEdge", 0x050506, { rough: 0.1 });
const dark = mat("Dark", 0x0b0b0c, { rough: 0.8 });
const chrome = mat("Chrome", 0xd2d5d9, { metal: 1, rough: 0.14 });
const knobSide = mat("KnobSide", 0xc9ccd0, { metal: 1, rough: 0.22 });
const knobTop = mat("KnobTop", 0xffffff, { metal: 0.7, rough: 0.3 });
const btnFace = mat("BtnPower", 0xffffff, { metal: 0.6, rough: 0.3 });
const doorBlack = mat("DoorBlack", 0x211e1c, { metal: 0, rough: 0.12 });   // smoked dark brown-black, matched to IFB's front and 3/4 photos
const tint = mat("DoorGlass", 0x171514, { rough: 0.05, opacity: 0.88, side: THREE.DoubleSide });   // dark glass, the drum faint behind it (IFB's front photo)
const bowl = mat("GlassBowl", 0x23282d, { rough: 0.05, opacity: 0.12, side: THREE.DoubleSide });
const doorIn = mat("DoorInner", 0x3e3632, { metal: 0.15, rough: 0.5 });   // the door's back and edge are in the body colour (IFB's open-door photo)
const hingeM = mat("Hinge", 0x3a2f2a, { rough: 0.5 });
const gasket = mat("Gasket", 0x4a4c50, { rough: 0.85 });           // charcoal grey (open-door photo)
const drum = mat("Drum", 0xffffff, { metal: 0.75, rough: 0.3 });
const steel = mat("Steel", 0xb9bcc0, { metal: 0.9, rough: 0.28 });
const trayWall = mat("TrayWall", 0xc4c8cc, { metal: 0.5, rough: 0.3 }); // the tray's walls are silver (IFB's drawer photo)
const trayBlue = mat("TrayBlue", 0x1f6fe0, { rough: 0.3 });
const bayGrey = mat("PumpBay", 0x3c3e42, { rough: 0.6 });          // the filter housing is dark grey in the manual's drawing (p.61)
const filterM = mat("FilterCap", 0x55585d, { rough: 0.5 });
const footM = mat("Foot", 0x2c2d30, { rough: 0.6 });
const hoseM = mat("Hose", 0xffffff, { rough: 0.7 });
const inletM = mat("InletHoseFace", 0xb9bcc0, { rough: 0.55 });    // the supplied inlet hose is light grey with blue nuts (manual p.22)
const nutBlue = mat("InletNutFace", 0x2a63c8, { rough: 0.4 });
const cordM = mat("CordFace", 0x2a2b2e, { rough: 0.6 });
const plugM = mat("PlugFace", 0x2f3033, { rough: 0.5 });
const pinM = mat("PlugPinFace", 0xb4b8bd, { metal: 0.9, rough: 0.3 });
const boltM = mat("BoltFace", 0xaeb2b7, { metal: 0.9, rough: 0.3 });
const capM = mat("BoltCapFace", 0x1c1d1f, { rough: 0.7 });

const root = group("IFBSerena7012");
const cab = group("Cabinet");
root.add(cab);

// helpers: a flat outline extruded toward +z with a soft edge, mapped onto a texture box (x0..x1, y0..y1 in metres)
function slab(name, outline, holes, depth, bevel, mats, uvBox, zFront) {
  const s = new THREE.Shape(outline.map(([x, y]) => new THREE.Vector2(x, y)));
  for (const h of holes) s.holes.push(new THREE.Path(h.map(([x, y]) => new THREE.Vector2(x, y))));
  const g = new THREE.ExtrudeGeometry(s, { depth: depth - 2 * bevel, bevelEnabled: bevel > 0, bevelThickness: bevel, bevelSize: bevel, bevelSegments: 2, curveSegments: 4 });
  if (uvBox) {
    const p = g.attributes.position, uv = g.attributes.uv;
    for (let i = 0; i < uv.count; i++) uv.setXY(i, (p.getX(i) - uvBox.x0) / (uvBox.x1 - uvBox.x0), (uvBox.y1 - p.getY(i)) / (uvBox.y1 - uvBox.y0));
  }
  return mesh(name, g, mats, 0, 0, zFront - depth + bevel);
}
// a rounded rectangle as a list of points, optionally only some corners rounded (tl, tr, br, bl), shrunk by `inset`
function rrect(x0, y0, x1, y1, r, corners = [1, 1, 1, 1], inset = 0, seg = 4) {
  x0 += inset; y0 += inset; x1 -= inset; y1 -= inset;
  const pts = [];
  const arc = (cx, cy, a0, on) => {
    if (!on) { pts.push([cx + Math.cos(a0 + Math.PI / 4) * r * Math.SQRT2, cy + Math.sin(a0 + Math.PI / 4) * r * Math.SQRT2]); return; }
    for (let i = 0; i <= seg; i++) { const a = a0 + (i / seg) * Math.PI / 2; pts.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]); }
  };
  arc(x1 - r, y0 + r, -Math.PI / 2, corners[2]);       // bottom right
  arc(x1 - r, y1 - r, 0, corners[1]);                  // top right
  arc(x0 + r, y1 - r, Math.PI / 2, corners[0]);        // top left
  arc(x0 + r, y0 + r, Math.PI, corners[3]);            // bottom left
  return pts;
}
// a pressed-in panel in a side: a pill-shaped dish whose walls slope in by gIn over its depth gD, built in place on the side
// `side` (+1 right, -1 left) behind the side's 2 mm skin, every face turned to be seen from outside
function dish(side, zc) {
  const xo = side * (SX - 0.002), xi = side * (SX - 0.002 - gD);
  const outer = stadium(zc, gY0, gY1, gW, 12), inner = stadium(zc, gY0 + gIn, gY1 - gIn, gW - 2 * gIn, 12);
  const pos = [], tri = (a, b, c, want) => {
    const n = new THREE.Vector3().crossVectors(new THREE.Vector3().subVectors(b, a), new THREE.Vector3().subVectors(c, a));
    (n.dot(want) >= 0 ? [a, b, c] : [a, c, b]).forEach((v) => pos.push(v.x, v.y, v.z));
  };
  const out = new THREE.Vector3(side, 0, 0), cy = (gY0 + gY1) / 2;
  for (let i = 0; i < outer.length; i++) {
    const j = (i + 1) % outer.length;
    const O0 = new THREE.Vector3(xo, outer[i][1], outer[i][0]), O1 = new THREE.Vector3(xo, outer[j][1], outer[j][0]);
    const I0 = new THREE.Vector3(xi, inner[i][1], inner[i][0]), I1 = new THREE.Vector3(xi, inner[j][1], inner[j][0]);
    const toward = new THREE.Vector3(0, Math.max(Math.min(cy, gY1 - gW / 2), gY0 + gW / 2) - outer[i][1], zc - outer[i][0]);   // toward the pill's axis
    const want = toward.lengthSq() > 0 ? toward.normalize().add(out) : out;
    tri(O0, O1, I1, want); tri(O0, I1, I0, want);
  }
  const fl = THREE.ShapeUtils.triangulateShape(inner.map(([u, v]) => new THREE.Vector2(u, v)), []);
  for (const [a, b, c] of fl) tri(...[a, b, c].map((k) => new THREE.Vector3(xi, inner[k][1], inner[k][0])), out);
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.computeVertexNormals();
  const p = g.attributes.position, uv = new Float32Array(p.count * 2);
  for (let i = 0; i < p.count; i++) { uv[2 * i] = side * p.getZ(i); uv[2 * i + 1] = p.getY(i); }   // metres, as the side's own
  g.setAttribute("uv", new THREE.BufferAttribute(uv, 2));
  return g;
}
const stadium = (zc, y0, y1, w, seg = 10) => {        // a vertical pill in the side's (z, y) plane
  const r = w / 2, pts = [];
  for (let i = 0; i <= seg; i++) { const a = Math.PI + (i / seg) * Math.PI; pts.push([zc + Math.cos(a) * r, y1 - r - Math.sin(a) * r]); }
  for (let i = 0; i <= seg; i++) { const a = (i / seg) * Math.PI; pts.push([zc + Math.cos(a) * r, y0 + r - Math.sin(a) * r]); }
  return pts;
};

// ── cabinet body: mocha sides with three pressed grooves each, top plate, back, base, rounded front edges ──
const bodyTop = H - 0.012;
const GROOVES = [0.25, 0.57, 0.85].map((f) => zF - f * (zF - zB));   // pressed-in panels; centres ESTIMATED from IFB's 3/4 photos
// IFB's 3/4 renders show one cabinet for every capacity, its side only about 35 cm deep (the door and the filter door, both round,
// give the view's angle), so the panels are placed by their share of the depth and sized by their own measured width
const gY0 = 0.08, gY1 = 0.81, gW = 0.06, gD = 0.006, gIn = 0.006;    // 730 x 60 mm, 6 mm deep, walls sloping in 6 mm (ESTIMATED)
for (const side of [1, -1]) {
  const outline = [[zB, feet], [zF - rc, feet], [zF - rc, bodyTop], [zB, bodyTop]].map(([z, y]) => [side * z, y]);
  const holes = GROOVES.map((zc) => stadium(zc, gY0, gY1, gW, 12).map(([z, y]) => [side * z, y]));
  const s = new THREE.Shape(outline.map(([u, v]) => new THREE.Vector2(u, v)));
  // a hole must wind the other way from its outline
  for (const h of holes) s.holes.push(new THREE.Path((side > 0 ? h : h.slice().reverse()).map(([u, v]) => new THREE.Vector2(u, v))));
  const g = new THREE.ExtrudeGeometry(s, { depth: 0.002, bevelEnabled: false, curveSegments: 8 });
  g.rotateY(-side * Math.PI / 2);
  cab.add(mesh(side > 0 ? "SideRight" : "SideLeft", g, sideM, side * SX, 0, 0));
  for (const zc of GROOVES) cab.add(mesh(side > 0 ? "GrooveRight" : "GrooveLeft", dish(side, zc), sideM));
}
for (const side of [1, -1]) {  // the rounded front edges, from the feet to the chin
  const g = new THREE.CylinderGeometry(rc, rc, chinBot - feet, 8, 1, true, side > 0 ? 0 : -Math.PI / 2, Math.PI / 2);
  cab.add(mesh("FrontEdge", g, mocha, side * (SX - rc), (feet + chinBot) / 2, zF - rc));
}
// top plate in two pieces with the seam IFB's 3/4 photos show near the back (ESTIMATED 120 mm from the back)
const topY = H - 0.0015, tz0 = zFF - fasciaD, tz1 = zB + 0.12;
cab.add(new THREE.Mesh(new RoundedBoxGeometry(2 * SX + 0.002, 0.012, tz0 - tz1 - 0.001, 2, 0.002), topM).translateX(0).translateY(topY - 0.006).translateZ((tz0 + tz1) / 2 - 0.0005));
cab.children[cab.children.length - 1].name = "TopPlate";
{ const m = new THREE.Mesh(new RoundedBoxGeometry(2 * SX + 0.002, 0.012, tz1 - zB - 0.0015, 2, 0.002), topM); m.name = "TopRear"; m.position.set(0, topY - 0.0065, (tz1 + zB) / 2 - 0.00075); cab.add(m); }
cab.add(box("TopSeam", 2 * SX - 0.004, 0.006, 0.004, dark, 0, topY - 0.009, tz1 - 0.0008));
cab.add(box("Base", 2 * SX - 0.006, 0.006, zF - zB - 0.02, dark, 0, feet + 0.003, (zF + zB) / 2));
// the back: the panel 3 mm inside the sides' rear edge, so the pressed cover and service panel IFB's drawing shows (manual
// p.20) stand out to the published depth and no further
const backZ = zB + 0.004;
cab.add(box("BackPanel", 2 * SX - 0.001, bodyTop - feet, 0.003, rearM, 0, (bodyTop + feet) / 2, backZ + 0.0015));
{
  const plate = (name, x0, y0, x1, y1, r, z, d) => {
    const g = new THREE.ExtrudeGeometry(new THREE.Shape(rrect(x0, y0, x1, y1, r, [1, 1, 1, 1], 0.0015).map(([x, y]) => new THREE.Vector2(x, y))), { depth: d - 0.002, bevelEnabled: true, bevelThickness: 0.001, bevelSize: 0.0015, bevelSegments: 1 });
    g.rotateY(Math.PI);
    cab.add(mesh(name, g, rearM, 0, 0, z - 0.001));
  };
  plate("RearCover", -0.255, 0.64, 0.255, 0.855, 0.03, backZ, 0.002);        // the upper rear cover (ESTIMATED from the drawing)
  plate("RearPanel", -0.185, 0.07, 0.185, 0.57, 0.035, backZ, 0.002);        // the service panel
  plate("RearPanelInner", -0.15, 0.1, 0.15, 0.54, 0.02, backZ - 0.002, 0.002);
}
// four transit bolts with their spacers (manual p.20: two under the upper cover, two low at the sides)
for (const [bx, by] of [[-0.215, 0.6], [0.215, 0.6], [-0.215, 0.22], [0.215, 0.22]]) {
  cab.add(mesh("BoltCap", new THREE.CylinderGeometry(0.019, 0.019, 0.008, 24), capM, bx, by, backZ - 0.004).rotateX(Math.PI / 2));
  cab.add(mesh("BoltHead", new THREE.CylinderGeometry(0.0085, 0.0085, 0.008, 6), boltM, bx, by, backZ - 0.012).rotateX(Math.PI / 2));
}
{ // the water inlet valve at the top (manual p.20 and p.22), with IFB's supplied hose connected: light grey, blue nuts
  const vx = -0.209, vy = 0.765;
  cab.add(mesh("InletValve", new THREE.CylinderGeometry(0.012, 0.012, 0.022, 18), plugM, vx, vy, backZ - 0.011).rotateX(Math.PI / 2));
  cab.add(mesh("InletNut", new THREE.CylinderGeometry(0.0145, 0.0145, 0.02, 6), nutBlue, vx, vy, backZ - 0.03).rotateX(Math.PI / 2));
  const pts = [[vx, vy, backZ - 0.04], [vx - 0.005, vy - 0.06, backZ - 0.03], [vx + 0.02, 0.55, backZ - 0.016], [vx + 0.05, 0.42, backZ - 0.016],
    [vx + 0.11, 0.36, backZ - 0.016], [vx + 0.17, 0.4, backZ - 0.016], [vx + 0.17, 0.47, backZ - 0.02]].map(([x, y, z]) => new THREE.Vector3(x, y, z));
  const c = new THREE.CatmullRomCurve3(pts, false, "centripetal");
  cab.add(mesh("InletHose", new THREE.TubeGeometry(c, 60, 0.0085, 10, false), inletM));
  const e = c.getPointAt(1), t = c.getTangentAt(1);
  const nut = mesh("InletNut", new THREE.CylinderGeometry(0.0145, 0.0145, 0.022, 6), nutBlue, e.x + t.x * 0.008, e.y + t.y * 0.008, e.z);
  nut.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), t);
  cab.add(nut);
}
{ // the drain hose from its outlet at the top, down the left of the back to its curved end guide (manual p.20, p.22)
  const hx = -0.12, hy = 0.75;
  cab.add(box("HoseBracket", 0.04, 0.03, 0.012, plugM, hx, hy, backZ - 0.006));
  const pts = [[hx, hy, backZ - 0.03], [hx - 0.06, hy - 0.02, backZ - 0.024], [-0.245, 0.66, backZ - 0.016], [-0.262, 0.5, backZ - 0.014],
    [-0.262, 0.3, backZ - 0.014], [-0.25, 0.16, backZ - 0.016], [-0.215, 0.11, backZ - 0.03], [-0.185, 0.14, backZ - 0.045]].map(([x, y, z]) => new THREE.Vector3(x, y, z));
  const c = new THREE.CatmullRomCurve3(pts, false, "centripetal");
  const g = new THREE.TubeGeometry(c, 110, 0.011, 10, false);
  const uv = g.attributes.uv, ribs = c.getLength() / 0.0045;
  for (let i = 0; i < uv.count; i++) uv.setX(i, uv.getX(i) * ribs);
  cab.add(mesh("DrainHose", g, hoseM));
  const e = c.getPointAt(1), t = c.getTangentAt(1);
  const end = mesh("HoseEnd", new THREE.CylinderGeometry(0.0125, 0.0125, 0.03, 16), plugM, e.x + t.x * 0.015, e.y + t.y * 0.015, e.z + t.z * 0.015);
  end.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), t);
  cab.add(end);
}
{ // the power cord from the top right of the back, down the side to the Indian 3-pin plug (manual p.20, p.24: 16 A, 3 pin)
  const gx = 0.245, gy = 0.8;
  cab.add(box("Grommet", 0.016, 0.022, 0.006, dark, gx, gy, backZ - 0.003));
  const pts = [[gx, gy, backZ - 0.006], [gx + 0.01, gy - 0.04, backZ - 0.008], [0.262, 0.62, backZ - 0.006], [0.264, 0.48, backZ - 0.006],
    [0.255, 0.4, backZ - 0.012], [0.235, 0.36, backZ - 0.02]].map(([x, y, z]) => new THREE.Vector3(x, y, z));   // the plug hangs clear of the lower bolt
  const c = new THREE.CatmullRomCurve3(pts, false, "centripetal");
  cab.add(mesh("CordRun", new THREE.TubeGeometry(c, 60, 0.0035, 8, false), cordM));
  const e = c.getPointAt(1);
  cab.add(mesh("CordRelief", new THREE.CylinderGeometry(0.005, 0.0065, 0.022, 12), plugM, e.x, e.y - 0.011, e.z));
  const py = e.y - 0.022 - 0.024;
  cab.add(mesh("Plug", new RoundedBoxGeometry(0.04, 0.048, 0.026, 2, 0.005), plugM, e.x, py, e.z));
  // Indian 3-pin: the earth pin thicker, above the two in a triangle (pins point down; ESTIMATED layout)
  [[0, 0.0045, 0.006, 0.026], [-0.0095, 0.0035, -0.006, 0.02], [0.0095, 0.0035, -0.006, 0.02]].forEach(([dx, r, dz, len]) =>
    cab.add(mesh("PlugPin", new THREE.CylinderGeometry(r, r, len, 10), pinM, e.x + dx, py - 0.024 - len / 2, e.z + dz)));
}
for (const [fx, fz] of [[-1, 1], [1, 1], [-1, -1], [1, -1]]) {  // adjustable feet with their lock nuts (manual p.21)
  const x = fx * L.feet_x, z = fz > 0 ? zF - 0.05 : zB + 0.05;
  cab.add(mesh("Foot", new THREE.CylinderGeometry(0.016, 0.017, feet * 0.55, 20), footM, x, feet * 0.275, z));
  cab.add(mesh("FootNut", new THREE.CylinderGeometry(0.012, 0.012, feet * 0.45, 6), footM, x, feet * 0.775, z));
}

// ── the mocha front, with the door seat and the filter door cut out ──
const fw = 2 * (SX - rc);
const front = frontWithHoles("FrontMain", fw, chinBot - feet, [{ x: door.x, y: door.y - feet, r: seatR }, { x: flap.x, y: flap.y - feet, r: flap.r }], mocha, 0.004);
front.position.set(0, feet, zF - 0.004);
cab.add(front);
// the door seat: a dark groove, then the dish in the body colour down to the gasket (open-door photo)
cab.add(lathe("SeatGroove", [[seatR - 0.0003, 0.0002], [seatR - 0.0003, -0.005], [0.2405, -0.005], [0.2405, -0.0025]], dark).translateX(door.x).translateY(door.y).translateZ(zF));
cab.add(lathe("DoorSeat", [[0.2405, -0.0025], [0.225, -0.0045], [0.205, -0.008], [0.185, -0.012], [0.172, -0.0155], [0.1635, -0.0185]], mocha).translateX(door.x).translateY(door.y).translateZ(zF));
// the hinge plate in the dish at the left, with its two screws, and the lock's slot at the right (open-door photo)
cab.add(box("HingePlate", 0.03, 0.2, 0.004, hingeM, door.x - 0.21, door.y, zF - 0.009));
for (const dy of [0.08, -0.08]) cab.add(mesh("HingeScrew", new THREE.CylinderGeometry(0.0035, 0.0035, 0.002, 10), steel, door.x - 0.21, door.y + dy, zF - 0.006).rotateX(Math.PI / 2));
cab.add(box("LockSlot", 0.016, 0.018, 0.004, dark, door.x + 0.205, door.y + 0.0155, zF - 0.0085));
// the gasket: its lip over the dish's inner edge, then two folds back to the drum
const gasketRing = lathe("GasketRing", [[gasketR + 0.003, -0.019], [gasketR, -0.0125], [0.156, -0.0105], [0.149, -0.013], [0.144, -0.025], [0.141, -0.038], [0.147, -0.05], [0.142, -0.063], [0.137, -0.088]], gasket);
gasketRing.position.set(door.x, door.y, zF);
cab.add(gasketRing);
{ // the stainless drum with its holes, three wide lifters, its back and hub
  const g = inward(new THREE.CylinderGeometry(drumR, drumR, drumDepth, 72, 1, true));
  g.rotateX(Math.PI / 2);
  const uv = g.attributes.uv, uRep = (2 * Math.PI * drumR) / 0.3, vRep = drumDepth / 0.15;   // drum.jpg is a 300 x 150 mm tile
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * uRep, 1 - uv.getY(i) * vRep);
  cab.add(mesh("DrumShell", g, drum, door.x, door.y, drumZ));
  const bg = new THREE.CircleGeometry(drumR, 64), buv = bg.attributes.uv;     // the perforated back, the same tile as the shell
  for (let i = 0; i < buv.count; i++) buv.setXY(i, buv.getX(i) * 2 * drumR / 0.3, 1 - buv.getY(i) * 2 * drumR / 0.15);
  cab.add(mesh("DrumBack", bg, drum, door.x, door.y, drumZ - drumDepth / 2 + 0.002));
  // the hub is a low dome, and the three lifters (55 mm tall, ESTIMATED) carry on across the back as ribs that meet at the hub
  // (IFB's open-door photo)
  const backZ0 = drumZ - drumDepth / 2 + 0.002;
  const hub = new THREE.SphereGeometry(0.048, 32, 8, 0, Math.PI * 2, 0, Math.PI / 2);
  hub.rotateX(Math.PI / 2); hub.scale(1, 1, 0.55);
  cab.add(mesh("DrumHub", hub, steel, door.x, door.y, backZ0 + 0.012));
  const lifters = [], ribs = [];
  for (let i = 0; i < 3; i++) {
    const a = Math.PI / 2 + (i / 3) * Math.PI * 2;
    const sh = new THREE.Shape([[-0.045, 0], [0.045, 0], [0.03, 0.03], [0.014, 0.05], [-0.014, 0.05], [-0.03, 0.03]].map(([x, y]) => new THREE.Vector2(x, y)));
    const lg = new THREE.ExtrudeGeometry(sh, { depth: drumDepth - 0.04, bevelEnabled: true, bevelThickness: 0.006, bevelSize: 0.005, bevelSegments: 2 });
    lg.translate(0, 0, -(drumDepth - 0.04) / 2);
    lg.rotateZ(a + Math.PI / 2); lg.translate(Math.cos(a) * (drumR - 0.004), Math.sin(a) * (drumR - 0.004), 0);
    lifters.push(lg);
    const rs = new THREE.Shape([[-0.016, 0.045], [0.016, 0.045], [0.04, drumR - 0.01], [-0.04, drumR - 0.01]].map(([x, y]) => new THREE.Vector2(x, y)));
    const rg = new THREE.ExtrudeGeometry(rs, { depth: 0.022, bevelEnabled: true, bevelThickness: 0.006, bevelSize: 0.006, bevelSegments: 2 });
    rg.rotateZ(a - Math.PI / 2);
    ribs.push(rg);
  }
  cab.add(mesh("Lifters", mergeGeometries(lifters), steel, door.x, door.y, drumZ));
  cab.add(mesh("DrumRibs", mergeGeometries(ribs), steel, door.x, door.y, backZ0 + 0.004));
}
// the pump-filter recess behind the round door (manual p.61): a dark grey housing, the filter knob with its grip, the drain plug
{
  const g = group("PumpBay", flap.x, flap.y, zF);
  g.add(lathe("PumpHousing", [[flap.r + 0.0002, 0.0], [flap.r + 0.0002, -0.03], [0.0, -0.03]], bayGrey, 48));
  g.add(mesh("FilterCap", new THREE.CylinderGeometry(0.03, 0.03, 0.02, 32), filterM, 0.01, -0.012, -0.02).rotateX(Math.PI / 2));
  g.add(box("FilterGrip", 0.007, 0.05, 0.008, filterM, 0.01, -0.012, -0.008));
  g.add(mesh("DrainPlug", new THREE.CylinderGeometry(0.008, 0.008, 0.012, 16), filterM, -0.038, 0.035, -0.022).rotateX(Math.PI / 2));
  g.add(mesh("PumpHose", new THREE.TubeGeometry(new THREE.CatmullRomCurve3([new THREE.Vector3(-0.055, -0.03, -0.028), new THREE.Vector3(-0.05, 0.01, -0.025), new THREE.Vector3(-0.038, 0.035, -0.024)]), 14, 0.0065, 8, false), dark));
  cab.add(g);
}
// the round filter door: hinged at its right edge (it swings out to the right in the manual's drawing, p.61), with the coin
// slot at its left edge (IFB's photos)
const filter = group("FilterFlap", flap.x + flap.r, flap.y, zF);
filter.add(mesh("FlapDisc", new THREE.CylinderGeometry(flap.r - 0.0012, flap.r - 0.0012, 0.004, 64), [flapM, flapM, flapM], -flap.r, 0, -0.0016).rotateX(Math.PI / 2));
filter.add(box("FlapNotch", 0.012, 0.016, 0.0016, dark, L.flap_slot.x - (flap.x + flap.r), L.flap_slot.y - flap.y, 0.0007));
filter.add(box("FlapCatch", 0.006, 0.008, 0.0016, bayGrey, L.flap_slot.x - (flap.x + flap.r) - 0.001, L.flap_slot.y - flap.y, 0.0012));
root.add(filter);

// ── the black fascia: the drawer's face at the left, the control panel at the right, a chin under both ──
const pu = L.panel_uv, du = L.drawer_uv, dsp = L.display, gr = L.grip;
const bev = 0.0015, gap = 0.0008;
// the panel, with an opening for the display glass
cab.add(slab("ControlStrip", rrect(seam + gap, faceBot, W / 2, H, 0.008, [0, 1, 0, 0], bev), [rrect(dsp.x0 - bev, dsp.y0 - bev, dsp.x1 + bev, dsp.y1 + bev, 0.0015).reverse()], 0.01, bev, [panelM, fascia], pu, zFF));
{ // the display glass, 0.6 mm behind the panel's face, printed with the panel's own texture
  const g = new THREE.BoxGeometry(dsp.x1 - dsp.x0, dsp.y1 - dsp.y0, 0.004), uv = g.attributes.uv, p = g.attributes.position;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, (p.getX(i) + (dsp.x0 + dsp.x1) / 2 - pu.x0) / (pu.x1 - pu.x0), (pu.y1 - (p.getY(i) + (dsp.y0 + dsp.y1) / 2)) / (pu.y1 - pu.y0));
  cab.add(mesh("DisplayGlass", g, [glassBlack, glassBlack, glassBlack, glassBlack, panelM, glassBlack], (dsp.x0 + dsp.x1) / 2, (dsp.y0 + dsp.y1) / 2, zFF - 0.0006 - 0.002));
}
{ // the chin: a black band sloping back from the panel's lower edge to the mocha front (rows 262-288 of the photo)
  const sh = new THREE.Shape([[zFF - 0.0012, faceBot - 0.0002], [zF + 0.0005, chinBot], [zF - 0.02, chinBot], [zF - 0.02, faceBot - 0.0002]].map(([z, y]) => new THREE.Vector2(z, y)));   // just under the panel: no shared side plane
  const g = new THREE.ExtrudeGeometry(sh, { depth: W, bevelEnabled: false });
  g.rotateY(-Math.PI / 2);
  cab.add(mesh("FasciaChin", g, fascia, W / 2, 0, 0));
}
// the fascia's body behind the panel, its left side and top over the drawer's bay, and the bay itself
const fz0 = zFF - fasciaD, fz1 = zFF - 0.0105;
const fb0 = faceBot - 0.0002;   // the fascia's pieces start at the chin's top, so none shares the chin's end planes
cab.add(box("FasciaBody", W / 2 - seam, H - fb0, fz1 - fz0, fascia, (W / 2 + seam) / 2, (H + fb0) / 2, (fz0 + fz1) / 2));
cab.add(box("FasciaSideL", 0.0015, H - 0.002 - fb0, fz1 - fz0, fascia, -W / 2 + 0.00155, (H - 0.002 + fb0) / 2, (fz0 + fz1) / 2));   // 0.8 mm inside the drawer face's edge, under the top skin
cab.add(box("FasciaTopL", seam + W / 2 - 0.0008, 0.002, fz1 - fz0, fascia, (seam - W / 2 + 0.0008) / 2, H - 0.001, (fz0 + fz1) / 2));
// the drawer's bay: kept inside the side's pressed panels (6 mm deep) and under the top plate, with a black frame round its
// mouth so an open drawer never shows a gap into the cabinet
const BAY = { x0: -SX + 0.0105, x1: seam - 0.004, y0: faceBot + 0.006, y1: 0.858 };
cab.add(mesh("DrawerBay", inward(new THREE.BoxGeometry(BAY.x1 - BAY.x0, BAY.y1 - BAY.y0, 0.28)), dark, (BAY.x0 + BAY.x1) / 2, (BAY.y0 + BAY.y1) / 2, fz1 - 0.14));
{
  const sh = new THREE.Shape([[-W / 2 + 0.002, faceBot], [seam, faceBot], [seam, H - 0.002], [-W / 2 + 0.002, H - 0.002]].map(([x, y]) => new THREE.Vector2(x, y)));
  sh.holes.push(new THREE.Path([[BAY.x0, BAY.y0], [BAY.x0, BAY.y1], [BAY.x1, BAY.y1], [BAY.x1, BAY.y0]].map(([x, y]) => new THREE.Vector2(x, y))));
  cab.add(mesh("BayFrame", new THREE.ShapeGeometry(sh), fascia, 0, 0, fz1));
}

// ── the dial: a chrome skirt and a brushed conical top (50.6 mm across, measured; 18 mm tall, ESTIMATED) ──
{
  const k = group("Dial", L.knob.x, L.knob.y, zFF);
  const r = L.knob.r;
  k.add(lathe("KnobBase", [[r + 0.0012, 0], [r + 0.0012, 0.0015], [r, 0.002]], dark, 64));
  k.add(lathe("KnobSide", [[r, 0.0015], [r, 0.0145], [r - 0.0008, 0.0165], [r - 0.002, 0.0172]], knobSide, 64));
  const top = new THREE.CircleGeometry(r - 0.002, 64);
  const p = top.attributes.position;
  for (let i = 0; i < p.count; i++) p.setZ(i, 0.0035 * (1 - Math.hypot(p.getX(i), p.getY(i)) / (r - 0.002)));   // a shallow cone
  top.computeVertexNormals();
  k.add(mesh("KnobTop", top, knobTop, 0, 0, 0.0172));
  cab.add(k);
}
{ // the power button: a chrome ring and cap with the power mark (23 mm across, measured; 6 mm tall, ESTIMATED)
  const b = group("PowerButton", L.power.x, L.power.y, zFF);
  const r = L.power.r;
  b.add(lathe("PowerRing", [[r, 0], [r, 0.004], [r - 0.0012, 0.0045], [r - 0.0012, 0.0035]], chrome, 48));
  b.add(lathe("PowerCap", [[r - 0.0012, 0.0035], [r - 0.0014, 0.0055], [r - 0.0026, 0.006]], chrome, 48));
  b.add(mesh("PowerFace", new THREE.CircleGeometry(r - 0.0026, 48), btnFace, 0, 0, 0.006));
  cab.add(b);
}

// ── the detergent drawer: its face with the IFB mark and the grip pocket, the chrome lip, and the tray behind with the manual's
// compartments, left to right: II main wash, additives (IFB Sensora) with its siphon, I prewash (manual p.27; IFB's drawer photo
// shows the walls silver and the main-wash and additive compartments blue). Compartment widths ESTIMATED. ──
const drawer = group("Drawer");
{
  const x0 = -W / 2, x1 = seam - gap;
  drawer.add(slab("DrawerFace", rrect(x0, faceBot, x1, H, 0.008, [1, 0, 0, 0], bev), [rrect(gr.x0 - bev, gr.y0 - bev, gr.x1 + bev, gr.y1 + bev, 0.004).reverse()], 0.01, bev, [drawerM, fascia], du, zFF));
  drawer.add(mesh("GripPocket", inward(new THREE.BoxGeometry(gr.x1 - gr.x0, gr.y1 - gr.y0, 0.016)), dark, (gr.x0 + gr.x1) / 2, (gr.y0 + gr.y1) / 2, zFF - 0.0085 - 0.008));
  const lip = new RoundedBoxGeometry(gr.x1 - gr.x0 - 0.002, gr.y1 - gr.lip, 0.008, 2, 0.0015);
  drawer.add(mesh("DrawerBar", lip, chrome, (gr.x0 + gr.x1) / 2, (gr.y1 + gr.lip) / 2 - 0.0004, zFF - 0.0055));
  const tw = BAY.x1 - BAY.x0 - 0.006, th = 0.068, tl = 0.22, tx = (BAY.x0 + BAY.x1) / 2, ty = (faceBot + H) / 2 - 0.004, zc = zFF - 0.028 - tl / 2, wt = 0.0025;   // the tray starts behind the grip pocket
  drawer.add(box("TrayFloor", tw, wt, tl, trayWall, tx, ty - th / 2 + wt / 2, zc));
  drawer.add(box("TrayWallL", wt, th, tl, trayWall, tx - tw / 2 + wt / 2, ty, zc));
  drawer.add(box("TrayWallR", wt, th, tl, trayWall, tx + tw / 2 - wt / 2, ty, zc));
  drawer.add(box("TrayWallBack", tw, th, wt, trayWall, tx, ty, zc - tl / 2 + wt / 2));
  const xa = tx - tw / 2 + tw * 0.44, xb = tx - tw / 2 + tw * 0.66;
  drawer.add(box("TrayDividerA", wt, th * 0.9, tl * 0.96, trayWall, xa, ty - th * 0.05, zc));
  drawer.add(box("TrayDividerB", wt, th * 0.9, tl * 0.96, trayWall, xb, ty - th * 0.05, zc));
  const l0 = tx - tw / 2 + wt, fy = ty - th / 2 + wt + 0.0015;
  // the blue inserts sit high in their compartments (IFB's drawer photo): the liquid cup with its cap in the main wash, the
  // additives' cup with its siphon hole in the middle
  const rim = ty + th / 2, mainTop = rim - 0.014, addTop = rim - 0.018;
  drawer.add(box("TrayBlueMain", xa - l0 - 0.004, mainTop - fy, tl * 0.62, trayBlue, (l0 + xa) / 2, (mainTop + fy) / 2, zc - tl * 0.12));
  drawer.add(mesh("TrayBlueCap", new THREE.CylinderGeometry(0.012, 0.012, 0.012, 24), trayBlue, (l0 + xa) / 2, mainTop + 0.006, zc - tl * 0.05));
  drawer.add(box("TrayBlueAdd", xb - xa - 0.004, addTop - fy, tl * 0.9, trayBlue, (xa + xb) / 2, (addTop + fy) / 2, zc));
  drawer.add(mesh("TrayHole", new THREE.CircleGeometry(0.0055, 20), dark, (xa + xb) / 2, addTop + 0.0008, zc - tl * 0.1).rotateX(-Math.PI / 2));
}
cab.add(drawer);

// ── the door: hinged at the left; its edge in the body colour, a black rim, then one black glass face, darker glass over the
// drum and a clear bowl into it. The edge is 258.5 mm out and the rim's inner seam 247 mm (measured on IFB's front photo);
// the profile's depths are ESTIMATED from the 3/4 photos, where the Serena's door stands flatter than the Executive Plus's. ──
const hingeX = door.x - door.rim + 0.02, hingeZ = zF + 0.025;
const doorG = group("Door", hingeX, door.y, hingeZ);
const dc = group("DoorCentre", door.x - hingeX, 0, zF - hingeZ);   // profiles below are measured from the body front
const R = door.rim, CI = door.chrome_in;
dc.add(lathe("DoorInner", [[0.150, 0.0035], [R - 0.003, 0.0035]], doorIn));
dc.add(lathe("DoorEdge", [[R - 0.003, 0.0035], [R, 0.007], [R + 0.0003, 0.017]], doorIn));
dc.add(lathe("DoorRim", [[R + 0.0003, 0.017], [R - 0.002, 0.024], [CI + 0.0015, 0.0285], [CI, 0.029]], doorBlack));
dc.add(lathe("DoorBlack", [[CI, 0.029], [CI - 0.01, 0.0335], [0.2, 0.0385], [0.158, 0.0415], [0.153, 0.041]], doorBlack));
dc.add(lathe("DoorGlass", [[0.153, 0.041], [0.11, 0.0442], [0.06, 0.0458], [0, 0.0463]], tint));
dc.add(lathe("DoorBowl", [[0.15, 0.0035], [0.146, -0.012], [0.132, -0.036], [0.105, -0.062], [0.06, -0.08], [0, -0.086]], bowl));
for (const dy of [0.058, -0.058]) dc.add(box("DoorHinge", 0.04, 0.014, 0.026, hingeM, -0.215, dy, 0.012));
dc.add(box("DoorLatch", 0.012, 0.016, 0.018, doorIn, 0.205, 0.0155, -0.004));
doorG.add(dc);
root.add(doorG);

const parts = productParts(PRODUCTS, ID);
const clips = stateClips(root, parts);
saveZones(PRODUCTS, ID, root, parts);
// Grain (BENCHMARK 10). IFB names the colour "Mocha" and publishes no material; its photos show smooth painted steel, so the
// painted faces get the gentle peel. The fascia's plain black plastic gets the same; no grain on the printed panel and drawer
// face, the chrome, the glass or the drum.
const grain = { dir: `${TEX}/grain`, materials: {
  Front: { type: "peel_soft" }, Side: { type: "peel_soft" }, TopPlate: { type: "peel_soft" }, FlapFace: { type: "peel_soft" }, Fascia: { type: "peel_soft" },
} };
await exportGLB(root, clips, OUT, {
  Panel: `${T}/panel.jpg`, DrawerFace: `${T}/drawer.jpg`, KnobTop: `${T}/knob_top.jpg`, BtnPower: `${T}/btn_power.jpg`, Drum: `${T}/drum.jpg`, Hose: `${T}/hose.jpg`,
}, grain);
