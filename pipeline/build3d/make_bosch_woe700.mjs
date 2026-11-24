// Bosch WOE700D0IN, Series 2 top-load washing machine, 7 kg, 680 rpm: a grey body under a black top with a glass lid.
// Built to Bosch's size, 1015 H x 542 W x 552 D mm (product page, spec sheet and manual), and to Bosch's own photos: the side photo
// gives the profile (a black top over the grey body, a silver band across the front with BOSCH on it, a lid that rises toward the
// back, the control panel behind it sloping up toward the back); the overhead photos give the panel, the glass and the drum.
// The lid hinges at the back (spec sheet: door hinge rear, soft closing lid); the detergent drawer in the back wall of the
// well pulls out toward you once the lid is up (manual: detergent drawer). Sizes read off the photos are ESTIMATED (NOTES.md).
// usage: node make_bosch_woe700.mjs <products.json> <tex dir> <out.glb>
import fs from "node:fs";
import { THREE, mat, mesh, box, faced, group, flipV, inward, stateClips, exportGLB, productParts, saveZones } from "./lib.mjs";

const [PRODUCTS, TEX, OUT] = process.argv.slice(2);
const ID = "bosch-woe700d0in";
const T = `${TEX}/bosch_woe700`;

// ── size (metres); z runs front (+) to back (-), xf is the distance from the front ──
const W = 0.542, D = 0.552;
const zF = D / 2, zB = -D / 2;
const xz = (xf) => zF - xf;
const footH = 0.017, plinthTop = 0.066, bodyTop = 0.840;
const R = 0.022;                                             // the front corners, rounded in plan
const deck = (xf) => 0.901 + 0.112 * (xf - 0.042);           // the black top under the lid, rising toward the back
const BAND = [0.870, 0.024];                                 // the silver band: from y 0.870 at the front up to the deck at xf 0.024
const CAP_BACK = 0.425, SKIRT_BACK = 0.420;                  // the deck runs into the control panel at xf 0.42
const OPEN = { x: 0.239, f0: 0.05, f1: 0.39, r: 0.03 };      // the opening under the lid (ESTIMATED from Bosch's photo into the well)
const WELL = 0.80;                                           // the well's floor, where the tub's rim sits
const PIVOT = [0.410, 0.944];                                // lid hinge (xf, y)
const lidBot = (xf) => deck(xf) + 0.001;
const lidTop = (xf) => 0.926 + 0.0747 * (xf - 0.06);
const LID_BACK = 0.406, LID_W = 0.520;
const CON = { f0: 0.420, y0: 0.9403, lipF: 0.4255, lipY: 0.9615, topF: 0.542, topY: 1.014, backF: 0.551 };

// ── materials ──
const bodyM = mat("Body", 0x7e8084, { rough: 0.5 });
const sideL = mat("SideL", 0xffffff, { rough: 0.5 });
const sideR = mat("SideR", 0xffffff, { rough: 0.5 });
const coverM = mat("Cover", 0x141517, { rough: 0.32 });
const silverM = mat("SilverBand", 0x9c9ea2, { metal: 0.55, rough: 0.34 });
const logoM = mat("BandLogo", 0xffffff, { rough: 0.35, opacity: 0.999 });
const consoleM = mat("Console", 0x111214, { rough: 0.28 });
const panelM = mat("PanelFace", 0xffffff, { rough: 0.15 });
const panelMR = mat("PanelFaceR", 0xffffff, { rough: 0.15 });
const lidM = mat("LidFrame", 0x131416, { rough: 0.3 });
const glassM = mat("LidGlass", 0xffffff, { rough: 0.04, opacity: 0.999, side: THREE.DoubleSide });
const armM = mat("LidArmature", 0xffffff, { rough: 0.2, opacity: 0.999 });
const plinthM = mat("Plinth", 0x161719, { rough: 0.7 });
const footM = mat("Foot", 0x101112, { rough: 0.8 });
const rearM = mat("Rear", 0xffffff, { rough: 0.6 });
const wellM = mat("Well", 0x17181a, { rough: 0.5, side: THREE.DoubleSide });
const tubM = mat("TubRim", 0xe2e3e6, { rough: 0.45, side: THREE.DoubleSide });
const drumM = mat("Drum", 0xffffff, { rough: 0.4, side: THREE.DoubleSide });
const dishM = mat("Pulsator", 0xd6d8db, { rough: 0.45, side: THREE.DoubleSide });
const finM = mat("PulsatorFin", 0x8d949a, { rough: 0.5 });
const knobM = mat("PulsatorCap", 0xb5babe, { rough: 0.45 });
const filterM = mat("LintFilter", 0xffffff, { rough: 0.5 });
const filterBox = mat("LintFilterBox", 0xd2d4d8, { rough: 0.5 });
const drawerFace = mat("DrawerFace", 0xffffff, { rough: 0.4 });
const drawerM = mat("DrawerBody", 0x1b1c1e, { rough: 0.45 });
const hingeM = mat("Hinge", 0x0f1012, { rough: 0.4 });
const cordM = mat("Cord", 0x2a2b2e, { rough: 0.6 });
const plugM = mat("Plug", 0x232427, { rough: 0.5 });
const inletM = mat("InletBlue", 0x2f7fd0, { rough: 0.45 });
const threadM = mat("InletThread", 0xb9bcc0, { metal: 0.85, rough: 0.35 });
const drainM = mat("DrainElbow", 0xe4e4e2, { rough: 0.5 });

const cyl = (name, rt, rb, h, m, x, y, z, seg = 24) => mesh(name, new THREE.CylinderGeometry(rt, rb, h, seg), m, x, y, z);

// Flip each triangle so it looks out along want(centroid), then smooth the normals.
function orient(geo, want) {
  const idx = geo.index.array, p = geo.attributes.position;
  const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3(), n = new THREE.Vector3(), m = new THREE.Vector3();
  for (let t = 0; t < idx.length; t += 3) {
    a.fromBufferAttribute(p, idx[t]); b.fromBufferAttribute(p, idx[t + 1]); c.fromBufferAttribute(p, idx[t + 2]);
    n.subVectors(c, b).cross(new THREE.Vector3().subVectors(a, b));
    m.copy(a).add(b).add(c).multiplyScalar(1 / 3);
    if (n.dot(want(m)) < 0) { const s = idx[t + 1]; idx[t + 1] = idx[t + 2]; idx[t + 2] = s; }
  }
  geo.computeVertexNormals();
  return geo;
}
// A band of quads between rows of points (each row the same length).
function ribbon(rows, closed = false) {
  const n = rows[0].length, pos = [], uv = [], idx = [];
  rows.forEach((row, j) => row.forEach((v, i) => { pos.push(v.x, v.y, v.z); uv.push(i / (n - 1), j / (rows.length - 1)); }));
  const cols = closed ? n : n - 1;
  for (let j = 0; j < rows.length - 1; j++) for (let i = 0; i < cols; i++) {
    const a = j * n + i, b = j * n + ((i + 1) % n), c = (j + 1) * n + i, d = (j + 1) * n + ((i + 1) % n);
    idx.push(a, b, d, a, d, c);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  return g;
}
// the cabinet's outline in plan as [x, xf] points: the left side from xfBack, round the front corners, back along the right side
function outline(xfBack, r = R, seg = 14) {
  const pts = [[-W / 2, xfBack], [-W / 2, r]];
  for (let i = 1; i < seg; i++) { const a = (i / seg) * Math.PI / 2; pts.push([-W / 2 + r - r * Math.cos(a), r - r * Math.sin(a)]); }
  pts.push([-W / 2 + r, 0], [W / 2 - r, 0]);
  for (let i = 1; i < seg; i++) { const a = (i / seg) * Math.PI / 2; pts.push([W / 2 - r + r * Math.sin(a), r - r * Math.cos(a)]); }
  pts.push([W / 2, r], [W / 2, xfBack]);
  return pts;
}
// a rounded rectangle in plan, as [x, xf] points round the loop
function roundRect(x0, f0, x1, f1, r, seg = 10) {
  const pts = [], cs = [[x1 - r, f1 - r, 0], [x0 + r, f1 - r, 90], [x0 + r, f0 + r, 180], [x1 - r, f0 + r, 270]];
  for (const [cx, cf, a0] of cs) for (let i = 0; i <= seg; i++) { const a = ((a0 + (90 * i) / seg) * Math.PI) / 180; pts.push([cx + r * Math.cos(a), cf + r * Math.sin(a)]); }
  return pts;
}
const V = (x, y, xf) => new THREE.Vector3(x, y, xz(xf));
const out = (c) => (m) => new THREE.Vector3(m.x - c.x, 0, m.z - c.z);
const CENTRE = new THREE.Vector3(0, 0.5, xz(D / 2));
// a side-profile slab: points [xf, y] extruded across x from x0 to x1
function slab(name, pts, x0, x1, material) {
  const s = new THREE.Shape();
  pts.forEach(([xf, y], i) => (i ? s.lineTo(xf, y) : s.moveTo(xf, y)));
  const g = new THREE.ExtrudeGeometry(s, { depth: x1 - x0, bevelEnabled: false });
  g.rotateY(Math.PI / 2);                                   // shape x (xf) now runs toward -z, the extrusion along +x
  g.translate(x0, 0, zF);
  return mesh(name, g, material);
}

const root = group("BoschWOE700");
const cab = group("Cabinet");
root.add(cab);

// ── base: four feet and the black plinth (side photo: plinth 17-66 mm, feet about 17 mm) ──
for (const sx of [-1, 1]) for (const xf of [0.058, 0.512]) cab.add(cyl("Foot", 0.018, 0.021, footH, footM, sx * (W / 2 - 0.045), footH / 2, xz(xf), 20));
{ // the plinth, 3 mm inside the body, its front corners following the body's rounding, closed underneath
  const o = outline(D - 0.006, R).map(([x, f]) => [x * (W - 0.006) / W, f + 0.003]);
  const g = orient(ribbon([o.map(([x, f]) => V(x, footH, f)), o.map(([x, f]) => V(x, plinthTop, f))], true), out(CENTRE));
  cab.add(mesh("Plinth", g, plinthM));
  const s = new THREE.Shape();
  o.forEach(([x, f], i) => (i ? s.lineTo(x, f) : s.moveTo(x, f))); s.closePath();
  const b = new THREE.ShapeGeometry(s, 8), p = b.attributes.position;
  for (let i = 0; i < p.count; i++) { const x = p.getX(i), f = p.getY(i); p.setXYZ(i, x, footH, xz(f)); }
  cab.add(mesh("PlinthBase", orient(b, () => new THREE.Vector3(0, -1, 0)), plinthM));
}

// ── grey body: rounded front corners; the sides carry Bosch's side photo (its two pressed panels and the handle pocket) ──
{
  const o = outline(D);
  const g = orient(ribbon([o.map(([x, f]) => V(x, plinthTop, f)), o.map(([x, f]) => V(x, bodyTop, f))], true), out(CENTRE));
  cab.add(mesh("Body", g, bodyM));
  const sh = 0.838 - 0.0657, sy = (0.838 + 0.0657) / 2;
  for (const [sx, m] of [[-1, sideL], [1, sideR]]) {
    const len = D - R;
    const pg = new THREE.PlaneGeometry(len, sh);
    const uv = pg.attributes.uv, p = pg.attributes.position;
    for (let i = 0; i < uv.count; i++) {
      // plane x runs along the side; for the left side +x is toward the front, for the right side toward the back
      const along = p.getX(i) / len + 0.5;                  // 0..1 in the plane's own x
      const xf = sx < 0 ? D - along * len : R + along * len;
      uv.setXY(i, sx < 0 ? 1 - xf / D : xf / D, 1 - (p.getY(i) / sh + 0.5));
    }
    const pl = mesh(sx < 0 ? "SideDecalL" : "SideDecalR", pg, m, sx * (W / 2 + 0.0006), sy, xz(R + len / 2));
    pl.rotation.y = sx * Math.PI / 2;
    cab.add(pl);
  }
  // the handle pockets are in Bosch's side photo itself (a rim would push the width past 542 mm)
}

// ── the black top: a skirt round the front and sides, the silver band, the deck with the opening, the well walls ──
{
  const o = outline(SKIRT_BACK);
  const lo = o.map(([x, f]) => V(x, bodyTop, f)), mid = o.map(([x, f]) => V(x, BAND[0], f));
  cab.add(mesh("CoverSkirt", orient(ribbon([lo, mid]), out(CENTRE)), coverM));
  // above the band line: silver where the front slopes back (front and corners), black up the straight sides
  const front = o.filter(([, f]) => f < BAND[1] - 1e-6);
  const sloped = ribbon([front.map(([x, f]) => V(x, BAND[0], f)), front.map(([x, f]) => V(x, deck(BAND[1]), Math.max(f, BAND[1])))]);
  cab.add(mesh("SilverBand", orient(sloped, (m) => new THREE.Vector3(m.x - CENTRE.x, 0.6, m.z - CENTRE.z)), silverM));
  for (const sx of [-1, 1]) {
    const side = [[sx * W / 2, R], [sx * W / 2, SKIRT_BACK]];
    const g = ribbon([side.map(([x, f]) => V(x, BAND[0], f)), side.map(([x, f]) => V(x, deck(Math.max(f, BAND[1])), f))]);
    cab.add(mesh("CoverSide", orient(g, () => new THREE.Vector3(sx, 0, 0)), coverM));
  }
  // deck: flat in plan, lifted to deck(xf); the opening cut out
  const s = new THREE.Shape();
  s.moveTo(-W / 2, BAND[1]); s.lineTo(W / 2, BAND[1]); s.lineTo(W / 2, CAP_BACK); s.lineTo(-W / 2, CAP_BACK); s.closePath();
  const hp = roundRect(-OPEN.x, OPEN.f0, OPEN.x, OPEN.f1, OPEN.r);
  const hole = new THREE.Path(); hp.forEach(([x, f], i) => (i ? hole.lineTo(x, f) : hole.moveTo(x, f))); hole.closePath();
  s.holes.push(hole);
  const g = new THREE.ShapeGeometry(s, 12);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) { const x = p.getX(i), f = p.getY(i); p.setXYZ(i, x, deck(f), xz(f)); }
  cab.add(mesh("Deck", orient(g, () => new THREE.Vector3(0, 1, 0)), coverM));
  // the well walls, straight down from the deck's edge to the well floor
  const top = hp.map(([x, f]) => V(x, deck(f), f)), bot = hp.map(([x, f]) => V(x, WELL, f));
  const wc = V(0, 0.85, (OPEN.f0 + OPEN.f1) / 2);
  cab.add(mesh("WellWall", orient(ribbon([bot, top], true), (m) => new THREE.Vector3(wc.x - m.x, 0, wc.z - m.z)), wellM));
}
// Bosch's mark and name on the silver band (87 mm wide, centred; ESTIMATED from the front photo)
{
  const [lw, lh] = [0.087, 0.0194];
  const ang = Math.atan2(deck(BAND[1]) - BAND[0], BAND[1]);
  const cxf = BAND[1] / 2, cy = (BAND[0] + deck(BAND[1])) / 2;
  const n = new THREE.Vector3(0, Math.cos(ang), Math.sin(ang));          // the band looks up and out at the front
  const lg = mesh("BandLogo", flipV(new THREE.PlaneGeometry(lw, lh)), logoM, 0, cy + n.y * 0.0007, xz(cxf) + n.z * 0.0007);
  lg.rotation.x = -(Math.PI / 2 - ang);
  cab.add(lg);
}

// ── the control panel: a block from the deck up to the top, its sloped face printed with Bosch's own panel ──
{
  const pts = [[CON.f0, bodyTop], [CON.f0, CON.y0], [CON.lipF, CON.lipY], [CON.topF, CON.topY], [0.547, 1.0125], [0.5495, 1.0095], [CON.backF, 1.004], [CON.backF, bodyTop]];
  cab.add(slab("ConsoleBlock", pts, -W / 2, W / 2, consoleM));
  const dx = CON.topF - CON.lipF, dy = CON.topY - CON.lipY, len = Math.hypot(dx, dy), beta = Math.atan2(dy, dx);
  const n = new THREE.Vector3(0, Math.cos(beta), Math.sin(beta));
  const c = V(0, (CON.lipY + CON.topY) / 2, (CON.lipF + CON.topF) / 2).addScaledVector(n, 0.0006);
  for (const [nm, m, sx] of [["PanelFace", panelM, -1], ["PanelFaceR", panelMR, 1]]) {
    const face = mesh(nm, flipV(new THREE.PlaneGeometry(W / 2, len)), m, sx * W / 4, c.y, c.z);
    face.rotation.x = -(Math.PI / 2 - beta);
    cab.add(face);
  }
}

// ── the back: Bosch's rear photo laid over it (cord and plug painted out of it; they are real parts below) ──
const REAR = JSON.parse(fs.readFileSync(`${T}/rear.json`, "utf8"));
{
  const y0 = footH, y1 = 1.004;
  const pg = new THREE.PlaneGeometry(W, y1 - y0, 1, 1);
  const p = pg.attributes.position, uv = pg.attributes.uv;
  for (let i = 0; i < p.count; i++) {
    const x = -p.getX(i), y = p.getY(i) + (y0 + y1) / 2;      // the plane is turned to face the back: its +x is the model's -x
    uv.setXY(i, ((271 - x * 1000) * REAR.pxPerMmH) / REAR.size[0], 1 - (REAR.rowOf840 + (840 - y * 1000) * REAR.pxPerMmV) / REAR.size[1]);
  }
  const pl = mesh("RearDecal", flipV(pg), rearM, 0, (y0 + y1) / 2, zB - 0.0006);
  pl.rotation.y = Math.PI;
  cab.add(pl);
  // the power cord's loop as the rear photo shows it, its clips, the plug parked in its round holder, the inlet and the drain
  const cz = zB - 0.0065;
  const pts = REAR.cord.map(([x, y]) => new THREE.Vector3(x, y, cz));
  cab.add(mesh("PowerCord", new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts, false, "centripetal"), 160, 0.0035, 6, false), cordM));
  for (const [x, y] of [pts[0], pts[pts.length - 1]].map((v) => [v.x, v.y])) cab.add(cyl("CordEnd", 0.005, 0.005, 0.006, cordM, x, y, zB - 0.003, 10).rotateX(Math.PI / 2));
  for (const sx of [-1, 1]) cab.add(box("CordClip", 0.016, 0.012, 0.009, plugM, sx * 0.2475, 0.868, zB - 0.0045));
  cab.add(cyl("Grommet", 0.011, 0.011, 0.004, plugM, 0.2036, 0.7853, zB - 0.002, 16).rotateX(Math.PI / 2));
  const [px, py] = REAR.plug;
  cab.add(cyl("CordPlugHolder", 0.022, 0.022, 0.006, plugM, px, py, zB - 0.003, 24).rotateX(Math.PI / 2));
  cab.add(cyl("Plug", 0.017, 0.019, 0.03, plugM, px, py, zB - 0.021, 20).rotateX(Math.PI / 2));
  const inX = (271 - 597 / REAR.pxPerMmH) / 1000, inY = (840 + (REAR.rowOf840 - 237) / REAR.pxPerMmV) / 1000;
  cab.add(cyl("InletValve", 0.0145, 0.0145, 0.006, inletM, inX, inY, zB - 0.003, 24).rotateX(Math.PI / 2));
  cab.add(cyl("InletThread", 0.0105, 0.0105, 0.012, threadM, inX, inY, zB - 0.012, 20).rotateX(Math.PI / 2));
  const dX = (271 - 515 / REAR.pxPerMmH) / 1000;
  const hp = [[dX, 0.045, zB + 0.004], [dX, 0.045, zB - 0.012], [dX, 0.036, zB - 0.022], [dX, 0.022, zB - 0.025]].map((a) => new THREE.Vector3(...a));
  cab.add(mesh("DrainHose", new THREE.TubeGeometry(new THREE.CatmullRomCurve3(hp, false, "centripetal"), 16, 0.011, 14, false), drainM));
}

// ── the well and the drum: a black well floor round the white tub rim, the light perforated drum, the pulsator ──
const DRUM = { r: 0.18, xf: 0.22, top: WELL - 0.025, depth: 0.46 };
{
  const dz = xz(DRUM.xf);
  // the well floor: inside the body, round the tub's rim
  const fs0 = new THREE.Shape();
  fs0.moveTo(-W / 2 + 0.008, 0.012); fs0.lineTo(W / 2 - 0.008, 0.012); fs0.lineTo(W / 2 - 0.008, CON.f0); fs0.lineTo(-W / 2 + 0.008, CON.f0); fs0.closePath();
  const ho = new THREE.Path(); ho.absarc(0, DRUM.xf, DRUM.r + 0.012, 0, Math.PI * 2, true); fs0.holes.push(ho);
  const fl = new THREE.ShapeGeometry(fs0, 48), fp = fl.attributes.position;
  for (let i = 0; i < fp.count; i++) { const x = fp.getX(i), f = fp.getY(i); fp.setXYZ(i, x, WELL, xz(f)); }
  cab.add(mesh("WellFloor", orient(fl, () => new THREE.Vector3(0, 1, 0)), wellM));
  const rim = new THREE.LatheGeometry([new THREE.Vector2(DRUM.r + 0.02, WELL + 0.0005), new THREE.Vector2(DRUM.r + 0.014, WELL - 0.004), new THREE.Vector2(DRUM.r + 0.004, WELL - 0.014), new THREE.Vector2(DRUM.r, DRUM.top)], 72);
  cab.add(mesh("TubRim", rim, tubM, 0, 0, dz));
  const g = new THREE.CylinderGeometry(DRUM.r, DRUM.r, DRUM.depth, 72, 1, true);
  const uv = g.attributes.uv;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * 9, 1 - uv.getY(i) * 4);
  inward(g);
  cab.add(mesh("Drum", g, drumM, 0, DRUM.top - DRUM.depth / 2, dz));
  const floorY = DRUM.top - DRUM.depth;
  cab.add(cyl("DrumFloor", DRUM.r, DRUM.r, 0.006, dishM, 0, floorY, dz, 48));
  const dish = new THREE.LatheGeometry([new THREE.Vector2(0.0, 0.03), new THREE.Vector2(0.06, 0.028), new THREE.Vector2(0.13, 0.016), new THREE.Vector2(0.168, 0.004), new THREE.Vector2(0.172, 0.0)], 56);
  cab.add(mesh("Pulsator", dish, dishM, 0, floorY + 0.003, dz));
  // the grey Y fin: three arms (Bosch's photo into the drum), and three round caps between them
  for (const a of [30, 150, 270].map((d) => (d * Math.PI) / 180)) {
    const arm = mesh("PulsatorFin", new THREE.BoxGeometry(0.15, 0.022, 0.046), finM, Math.cos(a) * 0.075, floorY + 0.036, dz - Math.sin(a) * 0.075);
    arm.rotation.y = a;
    cab.add(arm);
  }
  cab.add(cyl("PulsatorHub", 0.035, 0.04, 0.026, finM, 0, floorY + 0.038, dz, 24));
  for (const a of [90, 210, 330].map((d) => (d * Math.PI) / 180)) cab.add(cyl("PulsatorCap", 0.03, 0.032, 0.014, knobM, Math.cos(a) * 0.105, floorY + 0.024, dz - Math.sin(a) * 0.105, 24));
  // the lint filter box on the drum wall at the back right
  const fa = (45 * Math.PI) / 180;
  const fr = DRUM.r - 0.011;
  const lf = mesh("LintFilter", flipV(new THREE.BoxGeometry(0.07, 0.2, 0.018)), [filterBox, filterBox, filterBox, filterBox, filterM, filterBox], Math.cos(fa) * fr, DRUM.top - 0.13, dz - Math.sin(fa) * fr);
  lf.rotation.y = Math.atan2(-Math.cos(fa), Math.sin(fa));
  cab.add(lf);
}

// ── lid: hinged at the back; a black frame round a glass top with Bosch's armature on it ──
const lid = group("Lid", 0, PIVOT[1], xz(PIVOT[0]));
{
  const lslab = (name, pts, x0, x1, m = lidM) => {
    const s = slab(name, pts.map(([f, y]) => [f, y]), x0, x1, m);
    s.position.set(0, -PIVOT[1], -xz(PIVOT[0]));          // into the lid's own frame (the hinge at its origin)
    return s;
  };
  const GF = [0.075, 0.396], WF = [0.095, 0.357], WX = 0.2105;
  const frontPts = [[WF[0], lidBot(WF[0])], [0.042, lidBot(0.042)], [0.030, 0.9035], [0.0245, 0.910], [0.0265, 0.918], [0.034, 0.9235], [0.06, lidTop(0.06)], [WF[0], lidTop(WF[0])]];
  lid.add(lslab("LidFront", frontPts, -LID_W / 2, LID_W / 2));
  lid.add(lslab("LidBack", [[LID_BACK, lidBot(LID_BACK)], [WF[1], lidBot(WF[1])], [WF[1], lidTop(WF[1])], [LID_BACK, lidTop(LID_BACK)]], -LID_W / 2, LID_W / 2));
  for (const sx of [-1, 1]) {
    const [x0, x1] = sx < 0 ? [-LID_W / 2, -WX] : [WX, LID_W / 2];
    lid.add(lslab("LidRail", [[WF[1], lidBot(WF[1])], [WF[0], lidBot(WF[0])], [WF[0], lidTop(WF[0])], [WF[1], lidTop(WF[1])]], x0, x1));
  }
  // the glass, 513 x 321 mm with its dark print round a tinted window (texture), 0.7 mm above the frame
  const alpha = Math.atan(0.0747);
  const gl = (GF[1] - GF[0]) / Math.cos(alpha), gc = (GF[0] + GF[1]) / 2;
  const g = mesh("LidGlass", flipV(new THREE.PlaneGeometry(0.513, gl)), glassM, 0, lidTop(gc) + 0.0007 - PIVOT[1], xz(gc) - xz(PIVOT[0]));
  g.rotation.x = -(Math.PI / 2 - alpha);
  lid.add(g);
  // Bosch's armature on the glass (124 mm square decal, centred 142 mm from the glass's back edge; ESTIMATED from the top photo)
  const af = GF[1] - 0.142;
  const am = mesh("LidArmature", flipV(new THREE.PlaneGeometry(0.124, 0.124)), armM, 0, lidTop(af) + 0.0014 - PIVOT[1], xz(af) - xz(PIVOT[0]));
  am.rotation.x = -(Math.PI / 2 - alpha);
  lid.add(am);
  // finger grip on the lid's front edge (the side photo shows ridges there)
  lid.add(box("LidGrip", 0.26, 0.002, 0.004, hingeM, 0, 0.9105 - PIVOT[1], xz(0.0255) - xz(PIVOT[0])));
  for (const sx of [-1, 1]) lid.add(cyl("HingeBarrel", 0.006, 0.006, 0.04, hingeM, sx * 0.192, 0, 0, 16).rotateZ(Math.PI / 2));
}
root.add(lid);

// ── detergent drawer: in the back wall of the well under the hinge line; it pulls straight out toward you ──
const drawer = group("DetergentDrawer", 0, 0.925, xz(OPEN.f1));
{
  drawer.add(mesh("DrawerFront", flipV(new THREE.BoxGeometry(0.185, 0.018, 0.004)), [drawerM, drawerM, drawerM, drawerM, drawerFace, drawerM], 0, 0, 0.0027));
  drawer.add(box("DrawerTray", 0.176, 0.015, 0.1, drawerM, 0, -0.001, -0.05 + 0.001));
  for (const x of [-0.03, 0.03]) drawer.add(box("DrawerDivider", 0.002, 0.004, 0.09, wellM, x, 0.0085, -0.05));
}
cab.add(drawer);

const parts = productParts(PRODUCTS, ID);
const clips = stateClips(root, parts);
saveZones(PRODUCTS, ID, root, parts);
await exportGLB(root, clips, OUT, {
  SideL: `${T}/side_l.jpg`, SideR: `${T}/side_r.jpg`, PanelFace: `${T}/face_l.jpg`, PanelFaceR: `${T}/face_r.jpg`,
  BandLogo: `${T}/band_logo.png`, LidGlass: `${T}/glass.png`, LidArmature: `${T}/armature.png`, Rear: `${T}/rear.jpg`, Drum: `${T}/drum.jpg`,
  LintFilter: `${T}/filter.jpg`, DrawerFace: `${T}/drawer.jpg`,
}, { dir: `${TEX}/grain`, materials: {
  // painted grey cabinet (soft peel), moulded black top and plinth
  Body: { type: "peel_soft" }, SideL: { type: "peel_soft" }, SideR: { type: "peel_soft" },
  Cover: { type: "peel_soft" }, Plinth: { type: "peel_strong" }, LidFrame: { type: "peel_soft" },
} });
