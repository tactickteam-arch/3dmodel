// Bosch WOE90DV0IN, Series 2 top-load washing machine, 9 kg, 680 rpm: a dark grey body under a black top, a glass lid hinged at
// the back with a bright trim on its front edge, and the control panel on the strip in front of the lid.
// Built to Bosch's size, 960 H x 550 W x 560 D mm (product page, spec sheet; Sangeetha 96 x 55 x 56 cm), and to Bosch's own
// photos: the square-on rear view PGA3 (2.1 px/mm) gives the heights (black top from 864 mm, plinth to 92 mm), the top views
// PGA5 (lid shut) and PGA6 (lid up) give the plan (rear cover 101 mm, lid 341 mm, panel 111 mm, the opening and the drum), the
// side view PGA2 the profile. Sizes read off the photos are ESTIMATED (private NOTES.md).
// usage: node make_bosch_woe90.mjs <products.json> <tex dir> <out.glb>
import fs from "node:fs";
import { THREE, mat, mesh, box, group, flipV, inward, stateClips, exportGLB, productParts, saveZones } from "./lib.mjs";

const [PRODUCTS, TEX, OUT] = process.argv.slice(2);
const ID = "bosch-woe90dv0in";
const T = `${TEX}/bosch_woe90`;

// ── size (metres); z runs front (+) to back (-), xf is the distance from the front ──
const W = 0.550, D = 0.560, H = 0.960;
const zF = D / 2, zB = -D / 2;
const xz = (xf) => zF - xf;
const footH = 0.020, plinthTop = 0.092, bodyTop = 0.864;
const R = 0.024;                                             // the front corners, rounded in plan (PGA5)
const PANEL_D = 0.111;                                       // the control strip in front of the lid
const panelY = (xf) => 0.902 + ((Math.max(xf, 0.006) - 0.006) / 0.105) * 0.016;   // the strip rises 16 mm toward the lid
const DECK = 0.918;                                          // the top under the lid
const REAR_F = 0.459;                                        // the fixed rear cover from xf 0.459 to the back, up to H
const OPEN = { x: 0.245, f0: 0.115, f1: 0.42, r: 0.045 };    // the opening under the lid (PGA6)
const LID = { f0: 0.105, f1: 0.446, w: 0.540, bot: DECK + 0.001, topF: 0.954, topB: 0.954 };   // a flat glass top
const lidTop = (xf) => LID.topF + ((xf - LID.f0) / (LID.f1 - LID.f0)) * (LID.topB - LID.topF);

// ── materials ──
const bodyM = mat("Body", 0x4a4c50, { rough: 0.5 });
const sideL = mat("SideL", 0xffffff, { rough: 0.5 });
const sideR = mat("SideR", 0xffffff, { rough: 0.5 });
const coverM = mat("Cover", 0x161719, { rough: 0.34 });
const panelM = mat("PanelFace", 0xffffff, { rough: 0.15 });
const panelMR = mat("PanelFaceR", 0xffffff, { rough: 0.15 });
const lidM = mat("LidFrame", 0x111214, { rough: 0.3 });
const glassM = mat("LidGlass", 0xffffff, { rough: 0.04, opacity: 0.999, side: THREE.DoubleSide });
const plateM = mat("LidPlate", 0xffffff, { rough: 0.35, opacity: 0.999 });
const trimM = mat("LidTrim", 0xd6d8db, { metal: 0.9, rough: 0.2 });
const plinthM = mat("Plinth", 0x18191b, { rough: 0.7 });
const footM = mat("Foot", 0x101112, { rough: 0.8 });
const rearM = mat("Rear", 0xffffff, { rough: 0.6 });
const wellM = mat("Well", 0x141517, { rough: 0.5, side: THREE.DoubleSide });
const tubM = mat("TubRim", 0xd9dadd, { rough: 0.45, side: THREE.DoubleSide });
const drumM = mat("Drum", 0xffffff, { rough: 0.4, side: THREE.DoubleSide });
const pulsM = mat("Pulsator", 0xffffff, { rough: 0.45 });
const floorM = mat("DrumFloor", 0xb4b6ba, { rough: 0.45 });
const hingeM = mat("Hinge", 0x0f1012, { rough: 0.4 });
const cordM = mat("Cord", 0xd8d8d6, { rough: 0.6 });
const plugM = mat("Plug", 0xe6e6e4, { rough: 0.5 });
const holderM = mat("PlugHolder", 0x1d1e20, { rough: 0.5 });
const inletM = mat("InletBlue", 0x2f7fd0, { rough: 0.45 });
const threadM = mat("InletThread", 0xb9bcc0, { metal: 0.85, rough: 0.35 });
const drainM = mat("DrainElbow", 0xe4e4e2, { rough: 0.5 });

const cyl = (name, rt, rb, h, m, x, y, z, seg = 24) => mesh(name, new THREE.CylinderGeometry(rt, rb, h, seg), m, x, y, z);

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
// the cabinet's outline in plan as [x, xf]: the left side from xfBack, round the front corners, back along the right side
function outline(xfBack, r = R, seg = 14, inset = 0) {
  const w = W / 2 - inset;
  const pts = [[-w, xfBack], [-w, r + inset]];
  for (let i = 1; i < seg; i++) { const a = (i / seg) * Math.PI / 2; pts.push([-w + r - r * Math.cos(a), inset + r - r * Math.sin(a)]); }
  pts.push([-w + r, inset], [w - r, inset]);
  for (let i = 1; i < seg; i++) { const a = (i / seg) * Math.PI / 2; pts.push([w - r + r * Math.sin(a), inset + r - r * Math.cos(a)]); }
  pts.push([w, r + inset], [w, xfBack]);
  return pts;
}
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
  g.rotateY(Math.PI / 2);
  g.translate(x0, 0, zF);
  return mesh(name, g, material);
}
// a flat shape in plan ([x, xf] loop), lifted to y = yOf(xf), facing up
function plan(name, loop, yOf, material, holes = [], uvOf = null) {
  const s = new THREE.Shape();
  loop.forEach(([x, f], i) => (i ? s.lineTo(x, f) : s.moveTo(x, f))); s.closePath();
  for (const h of holes) { const p = new THREE.Path(); h.forEach(([x, f], i) => (i ? p.lineTo(x, f) : p.moveTo(x, f))); p.closePath(); s.holes.push(p); }
  const g = new THREE.ShapeGeometry(s, 12), p = g.attributes.position, uv = g.attributes.uv;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), f = p.getY(i);
    if (uvOf) uv.setXY(i, ...uvOf(x, f));
    p.setXYZ(i, x, yOf(f), xz(f));
  }
  return mesh(name, orient(g, () => new THREE.Vector3(0, 1, 0)), material);
}

const root = group("BoschWOE90");
const cab = group("Cabinet");
root.add(cab);

// ── base: four feet and the black plinth ──
for (const sx of [-1, 1]) for (const xf of [0.06, 0.5]) cab.add(cyl("Foot", 0.019, 0.022, footH, footM, sx * (W / 2 - 0.045), footH / 2, xz(xf), 20));
{
  const o = outline(D - 0.003, R, 14, 0.003);
  cab.add(mesh("Plinth", orient(ribbon([o.map(([x, f]) => V(x, footH, f)), o.map(([x, f]) => V(x, plinthTop, f))], true), out(CENTRE)), plinthM));
  cab.add(plan("PlinthBase", o, () => footH, plinthM));
  cab.children.at(-1).geometry = orient(cab.children.at(-1).geometry, () => new THREE.Vector3(0, -1, 0));
}

// ── the dark grey body; its sides carry Bosch's side photo (three pressed panels and the handle pocket) ──
{
  const o = outline(D);
  cab.add(mesh("Body", orient(ribbon([o.map(([x, f]) => V(x, plinthTop, f)), o.map(([x, f]) => V(x, bodyTop, f))], true), out(CENTRE)), bodyM));
  const sh = bodyTop - plinthTop, sy = (bodyTop + plinthTop) / 2, len = D - R;
  for (const [sx, m] of [[-1, sideL], [1, sideR]]) {
    const pg = new THREE.PlaneGeometry(len, sh);
    const uv = pg.attributes.uv, p = pg.attributes.position;
    for (let i = 0; i < uv.count; i++) {
      const along = p.getX(i) / len + 0.5;
      const xf = sx < 0 ? D - along * len : R + along * len;
      // the right side's photo has the front at its right edge; the left side's picture is its mirror (front at its left)
      uv.setXY(i, sx < 0 ? xf / D : 1 - xf / D, 0.5 - p.getY(i) / sh);
    }
    const pl = mesh(sx < 0 ? "SideDecalL" : "SideDecalR", pg, m, sx * (W / 2 + 0.0006), sy, xz(R + len / 2));
    pl.rotation.y = sx * Math.PI / 2;
    cab.add(pl);
  }
}

// ── the black top: skirt up to the panel strip, the deck and the rear cover; the panel face; the opening and its walls ──
const topY = (xf) => (xf < PANEL_D ? panelY(xf) : xf < REAR_F ? DECK : H);
{
  // the skirt round the front and sides, its top edge following the panel strip, the deck and the rear cover
  const o = outline(D).flatMap(([x, f], i, a) => {
    if (i === 0 || Math.abs(x) < W / 2 - 1e-6 || f < PANEL_D) return [[x, f]];
    return [[x, f]];
  });
  const sideRun = (sx) => [[sx * W / 2, R], [sx * W / 2, PANEL_D], [sx * W / 2, PANEL_D], [sx * W / 2, REAR_F], [sx * W / 2, REAR_F], [sx * W / 2, D]];
  const front = outline(R + 1e-4).slice(1, -1);
  const lo = front.map(([x, f]) => V(x, bodyTop, f)), hi = front.map(([x, f]) => V(x, panelY(f), f));
  cab.add(mesh("CoverFront", orient(ribbon([lo, hi]), out(CENTRE)), coverM));
  for (const sx of [-1, 1]) {
    const run = sideRun(sx);
    const tops = [panelY(R), panelY(PANEL_D), DECK, DECK, H, H];
    const g = ribbon([run.map(([x, f]) => V(x, bodyTop, f)), run.map(([x, f], i) => V(x, tops[i], f))]);
    cab.add(mesh("CoverSide", orient(g, () => new THREE.Vector3(sx, 0, 0)), coverM));
  }
  // the step faces: the panel strip's back edge down to the deck, and the rear cover's front face
  cab.add(box("RearCoverBack", W, H - bodyTop, 0.002, coverM, 0, (H + bodyTop) / 2, zB + 0.001));
  cab.add(plan("RearCoverTop", [[-W / 2, REAR_F], [W / 2, REAR_F], [W / 2, D], [-W / 2, D]], () => H, coverM));
  {
    const pts = [[REAR_F, DECK], [REAR_F, H], [REAR_F + 0.002, H], [REAR_F + 0.002, DECK]];
    cab.add(slab("RearCoverFront", pts, -W / 2, W / 2, coverM));
  }
  // the deck between the strip and the rear cover, the opening cut out
  const hp = roundRect(-OPEN.x, OPEN.f0, OPEN.x, OPEN.f1, OPEN.r);
  cab.add(plan("Deck", [[-W / 2, PANEL_D], [W / 2, PANEL_D], [W / 2, REAR_F], [-W / 2, REAR_F]], () => DECK, coverM, [hp]));
  const top = hp.map(([x, f]) => V(x, DECK, f)), bot = hp.map(([x, f]) => V(x, bodyTop - 0.01, f));
  const wc = V(0, 0.88, (OPEN.f0 + OPEN.f1) / 2);
  cab.add(mesh("WellWall", orient(ribbon([bot, top], true), (m) => new THREE.Vector3(wc.x - m.x, 0, wc.z - m.z)), wellM));
  // the panel strip: Bosch's panel redrawn (two halves, 10 px/mm), its plan following the body's rounded front corners
  const strip = outline(PANEL_D);
  const half = (sx) => {
    const pts = strip.filter(([x]) => sx * x >= -1e-9);
    return sx < 0 ? [...pts, [0, 0], [0, PANEL_D]] : [[0, 0], [0, PANEL_D], ...pts.reverse()];
  };
  const uvOf = (sx) => (x, f) => [sx < 0 ? (x + W / 2) / (W / 2) : x / (W / 2), (PANEL_D - f) / PANEL_D];
  for (const [nm, m, sx] of [["PanelFace", panelM, -1], ["PanelFaceR", panelMR, 1]]) {
    const pf = plan(nm, half(sx), panelY, m, [], uvOf(sx));
    cab.add(pf);
  }
  // under the strip's back edge: a short black wall from the strip down to the deck (the strip stands 0 mm above it here)
}

// ── the back: Bosch's rear photo laid over it; the cord and its plug are real parts ──
const REAR = JSON.parse(fs.readFileSync(`${T}/rear.json`, "utf8"));
{
  const y0 = plinthTop - 0.06, y1 = H;
  const pg = new THREE.PlaneGeometry(W, y1 - y0, 1, 1);
  const p = pg.attributes.position, uv = pg.attributes.uv;
  for (let i = 0; i < p.count; i++) {
    const x = -p.getX(i), y = p.getY(i) + (y0 + y1) / 2;   // the plane faces the back: its +x is the model's -x
    uv.setXY(i, ((W / 2 - x) * 1000 * REAR.pxPerMmH) / REAR.size[0], ((H - y) * 1000 * REAR.pxPerMmV) / REAR.size[1]);
  }
  const pl = mesh("RearDecal", pg, rearM, 0, (y0 + y1) / 2, zB - 0.0006);
  pl.rotation.y = Math.PI;
  cab.add(pl);
  const cz = zB - 0.0055;
  const pts = REAR.cord.map(([x, y]) => new THREE.Vector3(x, y, cz));
  cab.add(mesh("PowerCord", new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts, false, "centripetal"), 180, 0.0035, 6, false), cordM));
  const [ex, ey] = REAR.cord[0];
  cab.add(cyl("CordGrommet", 0.008, 0.008, 0.006, holderM, ex, ey, zB - 0.003, 14).rotateX(Math.PI / 2));
  const [px, py] = REAR.plug;
  cab.add(cyl("CordHolder", 0.03, 0.03, 0.006, holderM, px, py, zB - 0.003, 28).rotateX(Math.PI / 2));
  // the plug parked in its holder, pins inward: a rounded triangle body as the rear photo shows it
  const ps = new THREE.Shape();
  const tri = [[0, 0.024], [-0.021, -0.014], [0.021, -0.014]];
  ps.moveTo(...tri[0]); ps.lineTo(...tri[1]); ps.lineTo(...tri[2]); ps.closePath();
  const pgeo = new THREE.ExtrudeGeometry(ps, { depth: 0.016, bevelEnabled: true, bevelThickness: 0.003, bevelSize: 0.004, bevelSegments: 2 });
  cab.add(mesh("Plug", pgeo, plugM, px, py - 0.004, zB - 0.025));
  const inX = 0.0276, inY = 0.886;
  cab.add(cyl("InletValve", 0.012, 0.012, 0.006, inletM, inX, inY, zB - 0.003, 24).rotateX(Math.PI / 2));
  cab.add(cyl("InletThread", 0.0095, 0.0095, 0.012, threadM, inX, inY, zB - 0.012, 20).rotateX(Math.PI / 2));
  const dX = 0.001;
  const hp = [[dX, 0.052, zB + 0.004], [dX, 0.052, zB - 0.012], [dX, 0.044, zB - 0.022], [dX, 0.030, zB - 0.025]].map((a) => new THREE.Vector3(...a));
  cab.add(mesh("DrainHose", new THREE.TubeGeometry(new THREE.CatmullRomCurve3(hp, false, "centripetal"), 16, 0.011, 14, false), drainM));
}

// ── the tub and drum: the light tub rim, the perforated drum, Bosch's pulsator from its own photo ──
const DRUM = { r: 0.193, xf: 0.28, top: bodyTop - 0.016, depth: 0.43 };
{
  const dz = xz(DRUM.xf);
  const fs0 = new THREE.Shape();
  fs0.moveTo(-W / 2 + 0.01, 0.01); fs0.lineTo(W / 2 - 0.01, 0.01); fs0.lineTo(W / 2 - 0.01, D - 0.01); fs0.lineTo(-W / 2 + 0.01, D - 0.01); fs0.closePath();
  const ho = new THREE.Path(); ho.absarc(0, DRUM.xf, DRUM.r + 0.012, 0, Math.PI * 2, true); fs0.holes.push(ho);
  const fl = new THREE.ShapeGeometry(fs0, 48), fp = fl.attributes.position;
  for (let i = 0; i < fp.count; i++) { const x = fp.getX(i), f = fp.getY(i); fp.setXYZ(i, x, bodyTop - 0.01, xz(f)); }
  cab.add(mesh("WellFloor", orient(fl, () => new THREE.Vector3(0, 1, 0)), wellM));
  const rim = new THREE.LatheGeometry([new THREE.Vector2(DRUM.r + 0.02, bodyTop - 0.0095), new THREE.Vector2(DRUM.r + 0.014, bodyTop - 0.013), new THREE.Vector2(DRUM.r + 0.004, DRUM.top + 0.002), new THREE.Vector2(DRUM.r, DRUM.top)], 72);
  cab.add(mesh("TubRim", rim, tubM, 0, 0, dz));
  const g = new THREE.CylinderGeometry(DRUM.r, DRUM.r, DRUM.depth, 72, 1, true);
  const uv = g.attributes.uv;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * 10, 1 - uv.getY(i) * 6);
  inward(g);
  cab.add(mesh("Drum", g, drumM, 0, DRUM.top - DRUM.depth / 2, dz));
  const floorY = DRUM.top - DRUM.depth;
  cab.add(cyl("DrumFloor", DRUM.r, DRUM.r, 0.004, floorM, 0, floorY, dz, 48));
  // the pulsator: a low dome carrying Bosch's top view of it (PGA6), so the four caps and the cross read as on the real one
  const PR = 0.165;
  const prof = [];
  for (let i = 0; i <= 10; i++) { const r = (PR * i) / 10; prof.push(new THREE.Vector2(r, 0.022 * (1 - (r / PR) ** 2))); }
  const dome = new THREE.LatheGeometry(prof.reverse(), 64);
  const dp = dome.attributes.position, du = dome.attributes.uv;
  for (let i = 0; i < dp.count; i++) du.setXY(i, Math.min(1, Math.max(0, 0.5 + dp.getX(i) / (2 * PR))), Math.min(1, Math.max(0, 0.5 + dp.getZ(i) / (2 * PR))));   // the photo's crop spans the pulsator's rim
  cab.add(mesh("Pulsator", dome, pulsM, 0, floorY + 0.002, dz));
}

// ── lid: hinged at its back top edge; a black frame round a glass top, the BOSCH plate, a bright trim on the front edge ──
const lid = group("Lid", 0, LID.topB, xz(LID.f1));
{
  const toLid = (m) => { m.position.y -= LID.topB; m.position.z -= xz(LID.f1); return m; };
  const frame = [[LID.f0, LID.bot], [LID.f1, LID.bot], [LID.f1, lidTop(LID.f1) - 0.0008], [LID.f0, lidTop(LID.f0) - 0.0008]];
  lid.add(toLid(slab("LidFrame", frame, -LID.w / 2, LID.w / 2, lidM)));
  const alpha = Math.atan((LID.topB - LID.topF) / (LID.f1 - LID.f0));
  const gl = (LID.f1 - LID.f0) / Math.cos(alpha), gc = (LID.f0 + LID.f1) / 2;
  const g = mesh("LidGlass", flipV(new THREE.PlaneGeometry(LID.w, gl)), glassM, 0, lidTop(gc), xz(gc));
  g.rotation.x = -(Math.PI / 2 - alpha);
  lid.add(toLid(g));
  // the BOSCH plate: 135 x 15.5 mm, its right end 4 mm in from the glass's right edge, 166 mm from the body's back (PGA5)
  const pf = D - 0.166;
  const pm = mesh("LidPlate", flipV(new THREE.PlaneGeometry(0.135, 0.0155)), plateM, LID.w / 2 - 0.004 - 0.0675, lidTop(pf) + 0.0007, xz(pf));
  pm.rotation.x = -(Math.PI / 2 - alpha);
  lid.add(toLid(pm));
  // the bright trim along the front edge, wrapping 30 mm round each front corner
  const tr = [];
  const rr = 0.03, yT = lidTop(LID.f0) - 0.003;
  for (let i = 0; i <= 8; i++) { const a = (i / 8) * Math.PI / 2; tr.push(new THREE.Vector3(-LID.w / 2 + rr - rr * Math.sin(a), yT, xz(LID.f0 + rr - rr * Math.cos(a)))); }
  tr.reverse();
  for (let i = 0; i <= 8; i++) { const a = (i / 8) * Math.PI / 2; tr.push(new THREE.Vector3(LID.w / 2 - rr + rr * Math.sin(a), yT, xz(LID.f0 + rr - rr * Math.cos(a)))); }
  const trimPts = [new THREE.Vector3(-LID.w / 2, yT, xz(LID.f0 + 0.03 + 0.03)), ...tr, new THREE.Vector3(LID.w / 2, yT, xz(LID.f0 + 0.06))];
  lid.add(toLid(mesh("LidTrim", new THREE.TubeGeometry(new THREE.CatmullRomCurve3(trimPts, false, "centripetal"), 60, 0.0022, 8, false), trimM)));
  for (const sx of [-1, 1]) lid.add(toLid(cyl("HingeBarrel", 0.006, 0.006, 0.04, hingeM, sx * 0.2, LID.topB - 0.008, xz(LID.f1 - 0.006), 16).rotateZ(Math.PI / 2)));
}
root.add(lid);

const parts = productParts(PRODUCTS, ID);
const clips = stateClips(root, parts);
saveZones(PRODUCTS, ID, root, parts);
await exportGLB(root, clips, OUT, {
  SideL: `${T}/side_l.jpg`, SideR: `${T}/side_r.jpg`, PanelFace: `${T}/face_l.jpg`, PanelFaceR: `${T}/face_r.jpg`,
  LidGlass: `${T}/glass.png`, LidPlate: `${T}/plate.png`, Rear: `${T}/rear.jpg`, Drum: `${T}/drum.jpg`, Pulsator: `${T}/pulsator.jpg`,
}, { dir: `${TEX}/grain`, materials: {
  Body: { type: "peel_soft" }, SideL: { type: "peel_soft" }, SideR: { type: "peel_soft" },
  Cover: { type: "peel_soft" }, Plinth: { type: "peel_strong" }, LidFrame: { type: "peel_soft" },
} });
