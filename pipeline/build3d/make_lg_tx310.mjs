// LG TX310NWO, 10 kg fully automatic top-load washing machine with AI Direct Drive and TurboDrum, Onyx Black.
// Built to LG's size, 565 W x 1003 H x 620 D mm, 1275 mm high with the lid open (LG India's spec page; the owner's manual
// MFL72021945 gives W 565, D 620, H 1003, D' 565 to the cabinet's back and H' 1275), and to LG's own gallery for this model:
// the side photos (DZ-13 / DZ-14, 1.13 px/mm) give the profile: a gloss Onyx Black cabinet on four feet, a top cover from
// 824 mm, a tempered glass lid that rises from 889 mm at the front to 925 mm at its hinge, and behind it the console, its face
// sloping up 30.9 degrees to 1003 mm, with a housing behind it for the water inlet. The straight-down photos give the panel
// (DZ-3), the well, the tub ring and the deck (DZ-4) and the drum and its TurboDrum pulsator (DZ-5); gal4 the detergent drawer.
// The panel's print is the manual's drawing, warped onto the face and redrawn at 12 px/mm (tex_lg_tx310.py).
// Helpers from make_lg_t12.mjs (prism, sideSlab, roundRect) and make_samsung_wa80.mjs (the flat print decals on a sloped
// face). Every size LG does not publish is read off LG's photos: private/research/lg_tx310/NOTES.md.
// usage: node make_lg_tx310.mjs <entry.json> <tex dir> <out.glb>
import { THREE, mat, mesh, box, group, flipV, inward, stateClips, exportGLB, productParts, saveZones } from "./lib.mjs";
import { mergeVertices, mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import fs from "node:fs";

const [PRODUCTS, TEX, OUT] = process.argv.slice(2);
const ID = "lg-tx310nwo";
const T = `${TEX}/lg_tx310`;

// ── size (metres); z runs front (+) to back (-), xf is the distance from the front edge ──
const W = 0.565, H = 1.003, D = 0.62;
const zF = D / 2;
const xz = (xf) => zF - xf;
const BODY = 0.565;                    // the cabinet's back (LG's D'); the inlet housing and its fitting reach 620 mm
const FT = 0.03;                       // the cabinet's lower edge (DZ-13: 23-36 mm; the feet below it)
const J = 0.824;                       // the seam between the cabinet and the top cover (DZ-13 y 315, gal1 y 482)
const lidTop = (xf) => 0.889 + (xf - 0.007) * 0.0925;    // the lid's top: 889 mm at the front, 925 at 396 mm (DZ-13)
const LID_T = 0.014;                   // the lid's thickness (DZ-13: the front lip 12-14 mm)
const LID0 = 0.003, LID1 = 0.398;      // the lid's front and back edges
const tc = (xf) => lidTop(xf) - LID_T - 0.0012;           // the top cover under the lid
// the console: its face from (404, 924.6) to (529.2, 999.6) mm in DZ-13, a flat top to 1003 mm, the back falling to the housing
const C0 = [0.404, 0.9246], C1 = [0.5292, 0.9996];
const SL = Math.atan2(C1[1] - C0[1], C1[0] - C0[0]), PS = Math.hypot(C1[0] - C0[0], C1[1] - C0[1]);
const OPEN = { x: 0.255, f0: 0.028, f1: 0.385, r: 0.045 };  // the opening under the lid (DZ-4)
const DECK = 0.850;                   // the deck round the tub ring, under the opening (ESTIMATED: 25-60 mm under the lid seat)
const RC = 0.22, zc = xz(RC);         // the tub ring's centre (DZ-4: 218 mm from the front)
const ringR = 0.188, lipR = 0.1725;   // the tub ring's outer edge and its lip: the drum mouth 345 mm across (DZ-4)
const drumR = 0.19, drumTop = DECK - 0.04, drumFloor = 0.36, drumDepth = drumTop - drumFloor;
const PIV = [0.9285, 0.4005];         // the lid's hinge axis: height, distance from the front

// ── materials ──
// Onyx Black: a deep gloss black (LG's photos: the front face sRGB 4-8 under the studio light, its highlight bands 90-180)
const bodyM = mat("Body", 0x0b0b0c, { rough: 0.16, metal: 0.1 });
const sideL = mat("SideL", 0xffffff, { rough: 0.2 });
const sideR = mat("SideR", 0xffffff, { rough: 0.2 });
const coverM = mat("TopCover", 0x0a0a0b, { rough: 0.18, metal: 0.1 });
const consoleM = mat("Console", 0x0a0a0b, { rough: 0.18, metal: 0.1 });
const panelM = mat("PanelFace", 0xffffff, { rough: 0.12 });
const baseM = mat("Base", 0x141415, { rough: 0.7 });
const footM = mat("Foot", 0x1a1a1b, { rough: 0.6 });
const backM = mat("BackPanel", 0xffffff, { rough: 0.55 });
const labelM = mat("EnergyLabel", 0xffffff, { rough: 0.45, opacity: 0.999 });
const lidM = mat("LidFrame", 0x08080a, { rough: 0.2, metal: 0.2 });
const glassM = mat("LidGlass", 0x040405, { metal: 0.6, rough: 0.12, opacity: 0.95, side: THREE.DoubleSide });   // LG's photos (gal9) show the tub ring only dimly through it
const deckM = mat("Deck", 0xffffff, { rough: 0.2 });
const wellM = mat("WellWall", 0x0c0c0d, { rough: 0.2, side: THREE.DoubleSide });
const ringM = mat("TubRing", 0xcdcfd2, { rough: 0.4, side: THREE.DoubleSide });   // light grey, DZ-5 sRGB 200-215
const drumM = mat("EmbossDrum", 0xffffff, { rough: 0.3, metal: 0.4, side: THREE.DoubleSide });
const pulsM = mat("Pulsator", 0xffffff, { rough: 0.45 });
const filterM = mat("LintFilter", 0xffffff, { rough: 0.45 });
const fallM = mat("SideWaterFall", 0xffffff, { rough: 0.35 });
const bezelM = mat("KnobBezel", 0x0e0e10, { rough: 0.25, metal: 0.3 });
const chromeM = mat("Chrome", 0xd0d2d6, { metal: 1, rough: 0.18 });
const drawerM = mat("Drawer", 0x101013, { rough: 0.3 });
const detM = mat("DrawerFace", 0xffffff, { rough: 0.3 });
const trayTopM = mat("DrawerTop", 0xffffff, { rough: 0.3 });
const blueM = mat("BlueCup", 0x9cc3ea, { rough: 0.35 });        // light blue cups and impeller (gal4)
const impM = mat("Impeller", 0x7fa9dd, { rough: 0.35 });
const inletM = mat("Inlet", 0x2f63b0, { rough: 0.4 });
const threadM = mat("InletFitting", 0xd8ceb2, { rough: 0.45 });

const cyl = (name, rt, rb, h, m, x, y, z, seg = 24) => mesh(name, new THREE.CylinderGeometry(rt, rb, h, seg), m, x, y, z);

// A plan shape stood up between two surfaces, bot(x, xf) and top(x, xf) (make_lg_t12.mjs's prism).
function prism(name, shape, bot, top, material, { bev = 0, caps = ["top", "bottom"], curve = 8, uvf = null, segs = 2 } = {}) {
  const t0 = 0.02;
  const g0 = new THREE.ExtrudeGeometry(shape, { depth: t0, bevelEnabled: bev > 0, bevelSize: bev, bevelThickness: bev, bevelOffset: -bev, bevelSegments: segs, curveSegments: curve });
  const pos = g0.attributes.position, nor = g0.attributes.normal, uv = g0.attributes.uv;
  const P = [], N = [], U = [];
  const e = 1e-4;
  const grad = (f, x, xf) => [(f(x + e, xf) - f(x - e, xf)) / (2 * e), (f(x, xf + e) - f(x, xf - e)) / (2 * e)];
  for (const gr of g0.groups) for (let i = gr.start; i < gr.start + gr.count; i += 3) {
    if (gr.materialIndex === 0) {
      const zc0 = (pos.getZ(i) + pos.getZ(i + 1) + pos.getZ(i + 2)) / 3;
      if (!caps.includes(zc0 > t0 / 2 ? "top" : "bottom")) continue;
    }
    for (let k = i; k < i + 3; k++) {
      const X = pos.getX(k), Y = pos.getY(k), Z = pos.getZ(k);
      const xf = zF + Y, f = (Z + bev) / (t0 + 2 * bev);
      const yb = bot(X, xf), yt = top(X, xf);
      P.push(X, yb + f * (yt - yb), -Y);
      let n = [nor.getX(k), nor.getZ(k), -nor.getY(k)];
      if (Math.abs(n[1]) > 0.98) {
        const s = Math.sign(n[1]);
        const [gx, gf] = grad(s > 0 ? top : bot, X, xf);
        const v = [-gx * s, s, gf * s], l = Math.hypot(...v);
        n = v.map((c) => c / l);
      }
      N.push(...n);
      U.push(...(uvf ? uvf(X, xf) : [uv.getX(k), uv.getY(k)]));
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(P, 3));
  g.setAttribute("normal", new THREE.Float32BufferAttribute(N, 3));
  g.setAttribute("uv", new THREE.Float32BufferAttribute(U, 2));
  return mesh(name, mergeVertices(g, 1e-6), material);
}
const flat = (h) => () => h;

// a side profile (points [xf, y]) extruded across a width w, centred on x = 0
function sideSlab(name, pts, w, material) {
  const sh = new THREE.Shape();
  pts.forEach(([xf, y], i) => (i ? sh.lineTo(xf, y) : sh.moveTo(xf, y)));
  const g = new THREE.ExtrudeGeometry(sh, { depth: w, bevelEnabled: false });
  g.rotateY(Math.PI / 2);
  g.translate(-w / 2, 0, zF);
  return mesh(name, mergeVertices(g, 1e-6), material);
}

// a rounded rectangle seen from above, in shape coordinates (x, xf - zF), front corners rf, back corners rb
function roundRect(p, x0, x1, f0, f1, rf, rb) {
  const Y0 = f0 - zF, Y1 = f1 - zF;
  p.moveTo(x0 + rf, Y0);
  p.lineTo(x1 - rf, Y0); if (rf) p.absarc(x1 - rf, Y0 + rf, rf, -Math.PI / 2, 0, false);
  p.lineTo(x1, Y1 - rb); if (rb) p.absarc(x1 - rb, Y1 - rb, rb, 0, Math.PI / 2, false);
  p.lineTo(x0 + rb, Y1); if (rb) p.absarc(x0 + rb, Y1 - rb, rb, Math.PI / 2, Math.PI, false);
  p.lineTo(x0, Y0 + rf); if (rf) p.absarc(x0 + rf, Y0 + rf, rf, Math.PI, 1.5 * Math.PI, false);
  return p;
}

const root = group("LGTX310");
const cab = group("Cabinet");
root.add(cab);

// ── base: a dark plinth under the cabinet and four levelling feet (DZ-13: feet 30-55 mm and 520-550 mm from the front) ──
cab.add(prism("Base", roundRect(new THREE.Shape(), -0.265, 0.265, 0.02, BODY - 0.02, 0.01, 0.01), flat(0.012), flat(FT + 0.001), baseM, { caps: ["bottom"] }));
for (const sx of [-1, 1]) for (const xf of [0.045, BODY - 0.04]) cab.add(cyl("Foot", 0.019, 0.02, 0.024, footM, sx * 0.235, 0.012, xz(xf), 20));

// ── cabinet: gloss Onyx Black, rounded corners; the sides carry LG's side photos (three tall embossed panels, the grip) ──
const RCAB = 0.012;
cab.add(prism("Cabinet", roundRect(new THREE.Shape(), -W / 2, W / 2, 0, BODY, RCAB, RCAB), flat(FT), flat(J), bodyM, { caps: ["bottom"] }));
{
  const S0 = 0.04, d = BODY - 2 * RCAB, h = J - S0 - 0.001;    // side_l / side_r.jpg cover 40 -> 824 mm
  for (const [sx, m] of [[-1, sideL], [1, sideR]]) {
    const g = flipV(new THREE.PlaneGeometry(d, h));
    const uv = g.attributes.uv;
    // the textures run from the front (column 0) to the back; on the left side the plane's u runs from the back
    for (let i = 0; i < uv.count; i++) { const u = RCAB / BODY + uv.getX(i) * (d / BODY); uv.setX(i, sx > 0 ? u : 1 - u); }
    for (let i = 0; i < uv.count; i++) uv.setY(i, (0.001 + uv.getY(i) * h) / (J - S0));
    const p = mesh(sx > 0 ? "SideRight" : "SideLeft", g, m, sx * (W / 2 + 0.0006), S0 + h / 2, xz(BODY / 2));
    p.rotation.y = (sx * Math.PI) / 2;
    cab.add(p);
  }
}
// the cabinet's open top is closed 1.5 mm under the seam, round the drum: the joint shows this, never the room behind
{
  // out to the side photos' planes (24 Nov leak check: from above, a slit showed between the console's side and the cabinet's)
  const s = roundRect(new THREE.Shape(), -W / 2 - 0.0005, W / 2 + 0.0005, 0.001, BODY + 0.0005, RCAB + 0.0005, RCAB + 0.0005);
  const h = new THREE.Path(); h.absarc(0, RC - zF, drumR + 0.004, 0, 2 * Math.PI, true); s.holes.push(h);
  const g = new THREE.ShapeGeometry(s, 24);
  g.rotateX(-Math.PI / 2);
  // ShapeGeometry's y is the shape's (xf - zF); after rotateX(-90) it lands on -z, so the shape's y = -z: mirror back
  g.scale(1, 1, -1);
  cab.add(mesh("CabinetFloorTop", g.toNonIndexed(), coverM, 0, J - 0.0015, 0));
  // the console stands 1.5 mm in from the cabinet's sides: a strip at each side closes the 1.5 mm slot under it, which a
  // view along the seam could see straight through (24 Nov leak check). The strip has no face toward the side panel: it
  // would lie in the panel's plane and flicker, and the panel hides it anyway.
  for (const sx of [-1, 1]) {
    const g = new THREE.BoxGeometry(0.0012, 0.0024, BODY - 2 * RCAB);
    const outer = g.groups[sx > 0 ? 0 : 1], idx = Array.from(g.index.array);
    g.setIndex(idx.filter((_, i) => i < outer.start || i >= outer.start + outer.count));
    g.clearGroups();
    cab.add(mesh("SeamSeal", g, coverM, sx * (W / 2 - 0.0008), J - 0.0009, xz(BODY / 2)));
  }
}
// the energy label: this model's own BEE label (it names TX310NWO), redrawn at 12 px/mm, a die-cut sticker with an arched top,
// 0.8 mm proud, where gal1 has it: centre 224 mm right of the middle, its top 813 mm up (ESTIMATED off gal1, +-3 mm)
{
  const geo = JSON.parse(fs.readFileSync(`${T}/label_geo.json`, "utf8"));
  const lw = geo.w_mm / 1000, lh = geo.h_mm / 1000, ary = geo.arch_ry_mm / 1000;
  const sh = new THREE.Shape();
  sh.moveTo(-lw / 2, -lh); sh.lineTo(lw / 2, -lh); sh.lineTo(lw / 2, -ary);
  sh.absellipse(0, -ary, lw / 2, ary, 0, Math.PI, false);
  sh.lineTo(-lw / 2, -lh);
  const g = new THREE.ShapeGeometry(sh, 32);
  const pos = g.attributes.position, uv = g.attributes.uv;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, (pos.getX(i) + lw / 2) / lw, -pos.getY(i) / lh);
  cab.add(mesh("EnergyLabel", g, labelM, 0.224, 0.813, zF + 0.0008));
}
// the back: LG's back photo, straightened (rear.jpg: 960 -> 30 mm... rows from 960 mm down to 24 mm, columns from the machine's
// right), on the cabinet's back from the base to the inlet housing
const REAR_V = (h) => (0.96 - h) / (0.96 - 0.024);
{
  const w = W - 2 * RCAB, y0 = FT + 0.001, y1 = J + 0.0005;      // up to the console's back (24 Nov leak check: a slit under it)
  const g = flipV(new THREE.PlaneGeometry(w, y1 - y0));
  const uv = g.attributes.uv;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, RCAB / W + uv.getX(i) * (w / W), REAR_V(y1 - uv.getY(i) * (y1 - y0)));
  const p = mesh("BackDecal", g, backM, 0, (y0 + y1) / 2, xz(BODY) - 0.0006);
  p.rotation.y = Math.PI;
  cab.add(p);
}

// ── top cover: from the seam up under the lid, open over the tub ──
{
  const s = roundRect(new THREE.Shape(), -W / 2, W / 2, 0, C0[0] + 0.004, RCAB, 0);
  s.holes.push(roundRect(new THREE.Path(), -OPEN.x, OPEN.x, OPEN.f0, OPEN.f1, OPEN.r, OPEN.r));
  cab.add(prism("TopCover", s, flat(J), (x, xf) => tc(xf), coverM, { caps: ["top"], curve: 10 }));
}
// the console: the sloped face, a flat top, the back falling to the inlet housing (DZ-13 profile)
cab.add(sideSlab("Console", [[C0[0], J], [C0[0], C0[1]], [C1[0], C1[1]], [0.5315, 1.0018], [0.5345, H], [0.545, H], [0.552, 0.996],
  [0.559, 0.982], [BODY, 0.958], [BODY, J]], W - 0.003, consoleM));
// the inlet housing behind the console (DZ-13: 565 -> 603 mm deep, 815 -> 958 mm up; DZ-15: 540 mm across)
const HB = 0.603, hbTop = (xf) => 0.958 - (xf - BODY) * 0.5;
cab.add(prism("InletHousing", roundRect(new THREE.Shape(), -0.27, 0.27, BODY - 0.002, HB, 0, 0.01), flat(0.815), (x, xf) => hbTop(xf), consoleM, { bev: 0.002, segs: 1 }));
{
  const y0 = 0.816, y1 = hbTop(HB) - 0.003, x0 = -0.268, x1 = 0.268;
  const g = flipV(new THREE.PlaneGeometry(x1 - x0, y1 - y0));
  const uv = g.attributes.uv;
  // rotated half a turn: the plane's u runs from the machine's right (+x), as the photo's columns do
  for (let i = 0; i < uv.count; i++) uv.setXY(i, (W / 2 - x1 + uv.getX(i) * (x1 - x0)) / W, REAR_V(y1 - uv.getY(i) * (y1 - y0)));
  const p = mesh("HousingBack", g, backM, 0, (y0 + y1) / 2, xz(HB) - 0.0006);
  p.rotation.y = Math.PI;
  cab.add(p);
  // the cold water inlet: a blue collar, its threaded fitting reaching LG's 620 mm (DZ-15: 103 mm right of the middle, 883 mm up)
  cab.add(cyl("InletCollar", 0.016, 0.016, 0.006, inletM, 0.103, 0.883, xz(HB) - 0.003, 32).rotateX(Math.PI / 2));
  cab.add(cyl("InletThread", 0.0115, 0.0115, D - HB - 0.004, threadM, 0.103, 0.883, xz((HB + D) / 2 + 0.002), 24).rotateX(Math.PI / 2));
}

// ── the control panel: the console's face printed with panel.jpg, the print sharp in pieces 0.9 mm over it ──
const printTex = {};
const onFace = (x, s, h) => new THREE.Vector3(x, C0[1] + s * Math.sin(SL) + h * Math.cos(SL), xz(C0[0] + s * Math.cos(SL) - h * Math.sin(SL)));
{
  const pg = group("PanelPlane", 0, 0, 0);
  pg.position.copy(onFace(0, PS / 2, 0.0006));
  pg.rotation.x = -SL;                  // the plane's normal (local +z, after the face turn below) leans back with the slope
  const face = mesh("PanelFace", flipV(new THREE.PlaneGeometry(W - 0.003, PS)), panelM, 0, 0, 0);
  pg.add(face);
  for (const [key, d] of Object.entries(JSON.parse(fs.readFileSync(`${T}/decals.json`, "utf8")))) {
    const [u0, v0, u1, v1] = d.rect;
    const dm = mesh(`PrintDecal_${key}`, flipV(new THREE.PlaneGeometry((u1 - u0) * (W - 0.003), (v1 - v0) * PS)), mat(`Print_${key}`, 0xffffff, { rough: 0.12, opacity: 0.999 }),
      -(W - 0.003) / 2 + ((u0 + u1) / 2) * (W - 0.003), PS / 2 - ((v0 + v1) / 2) * PS, 0.0009);
    pg.add(dm);
    printTex[`Print_${key}`] = `${T}/${d.file}`;
  }
  // the plane stands in x-y; turn it so its +y runs up the slope and its +z out of the face
  pg.rotation.set(-(Math.PI / 2 - SL), 0, 0);
  cab.add(pg);
  // the programme knob: a dark bezel 62 mm across and a chrome cap 50 mm across, 25 mm proud (DZ-13, DZ-3)
  const kg = JSON.parse(fs.readFileSync(`${T}/panel_geo.json`, "utf8")).knob;
  const kn = group("Knob", 0, 0, 0);
  kn.position.copy(onFace(kg.x_mm / 1000, kg.s_mm / 1000, 0));
  kn.rotation.set(-(Math.PI / 2 - SL), 0, 0);
  const bz = new THREE.LatheGeometry([[0, 0.018], [0.0265, 0.018], [0.0295, 0.0165], [0.031, 0.012], [0.031, -0.002]].map(([r, y]) => new THREE.Vector2(r, y)), 64);
  bz.rotateX(Math.PI / 2);
  kn.add(mesh("KnobBezel", bz, bezelM));
  const cp = new THREE.LatheGeometry([[0, 0.0255], [0.006, 0.0252], [0.0245, 0.0195], [0.025, 0.0178], [0.0252, 0.0172]].map(([r, y]) => new THREE.Vector2(r, y)), 64);
  cp.rotateX(Math.PI / 2);
  kn.add(mesh("KnobCap", cp, chromeM));
  cab.add(kn);
}

// ── the well: black walls down to the deck (LG's photo of the deck, straight down), the light grey tub ring, the embossed
// drum, the TurboDrum pulsator, the lint filter and the Side Water Fall panel ──
{
  const wall = roundRect(new THREE.Shape(), -OPEN.x, OPEN.x, OPEN.f0, OPEN.f1, OPEN.r, OPEN.r);
  const ix = OPEN.x - 0.003, i0 = OPEN.f0 + 0.003, i1 = OPEN.f1 - 0.003, ir = OPEN.r - 0.003;
  wall.holes.push(roundRect(new THREE.Path(), -ix, ix, i0, i1, ir, ir));
  cab.add(prism("WellWall", wall, flat(DECK - 0.002), (x, xf) => tc(xf) - 0.0005, wellM, { caps: [] }));
  // the deck: the opening less the tub ring's circle, mapped straight down with DZ-4 (x = (X - 1007) / 1.545 mm, xf = (1127 - Y) / 1.545)
  const dg = JSON.parse(fs.readFileSync(`${T}/deck_geo.json`, "utf8"));
  const s = roundRect(new THREE.Shape(), -ix, ix, i0, i1, ir, ir);
  const h = new THREE.Path(); h.absarc(0, RC - zF, ringR, 0, 2 * Math.PI, true); s.holes.push(h);
  const g = new THREE.ShapeGeometry(s, 32);
  const pos = g.attributes.position, uv = g.attributes.uv;
  const [cx0, cy0, cx1, cy1] = dg.crop;
  for (let i = 0; i < uv.count; i++) {
    const x = pos.getX(i) * 1000, xf = (pos.getY(i) + zF) * 1000;
    uv.setXY(i, (dg.cx + x * dg.ppm - cx0) / (cx1 - cx0), (dg.front_y - xf * dg.ppm - cy0) / (cy1 - cy0));
  }
  g.rotateX(-Math.PI / 2);
  g.scale(1, 1, -1);
  // rotateX(-90) then mirror: the shape's y (xf - zF) now runs along -z, so a point keeps z = zF - xf
  const pp = g.attributes.position; for (let i = 0; i < pp.count; i++) pp.setZ(i, -pp.getZ(i));
  cab.add(mesh("Deck", g, deckM, 0, DECK, 0));
  // the tub ring: a wide light grey collar, its lip turned down into the drum
  const ring = new THREE.LatheGeometry([[ringR + 0.002, 0.0005], [0.18, -0.002], [lipR, -0.008], [lipR - 0.002, -0.02], [0.178, -0.03], [drumR + 0.002, -0.04]].map(([r, y]) => new THREE.Vector2(r, y)), 96);
  cab.add(mesh("TubRing", ring, ringM, 0, DECK, zc));
  // the drum wall, inward-facing: LG's embossed steel, a mirrored tile from DZ-5, 12 round
  const dw = new THREE.CylinderGeometry(drumR, drumR, drumDepth, 96, 1, true);
  const duv = dw.attributes.uv;
  const uRep = 12, vRep = drumDepth / (((2 * Math.PI * drumR) / uRep) * (520 / 400));
  for (let i = 0; i < duv.count; i++) duv.setXY(i, duv.getX(i) * uRep, 1 - duv.getY(i) * vRep);
  inward(dw);
  cab.add(mesh("EmbossDrum", dw, drumM, 0, drumTop - drumDepth / 2, zc));
  // the floor and the pulsator, mapped straight down with DZ-5: pulsator.jpg's 384 px radius is RM
  const PR = 0.153, RM = (PR * 345) / 268;
  const planar = (geo) => {
    const p = geo.attributes.position, u = geo.attributes.uv;
    for (let i = 0; i < u.count; i++) u.setXY(i, 0.5 + p.getX(i) / (2 * RM), 0.5 + p.getZ(i) / (2 * RM));
    return geo;
  };
  const fl = new THREE.CircleGeometry(drumR + 0.003, 96); fl.rotateX(-Math.PI / 2);
  cab.add(mesh("DrumFloor", planar(fl), pulsM, 0, drumFloor, zc));
  const dish = new THREE.LatheGeometry([[0, 0.03], [0.018, 0.0295], [0.06, 0.02], [0.12, 0.008], [PR, 0.002], [PR + 0.003, 0]].map(([r, y]) => new THREE.Vector2(r, y)), 96);
  cab.add(mesh("Pulsator", planar(dish), pulsM, 0, drumFloor, zc));
  // the lint filter at the back right and the Side Water Fall panel at the front left (DZ-5), standing on the drum wall
  for (const [name, m, deg, w, hgt] of [["LintFilter", filterM, -45.6, 0.05, 0.2], ["SideWaterFall", fallM, 146.8, 0.06, 0.28]]) {
    const a = (deg * Math.PI) / 180;               // angle from +x toward -z (the back) in plan
    const p = mesh(name, flipV(new THREE.PlaneGeometry(w, hgt)), m, Math.cos(a) * (drumR - 0.012), drumTop - 0.02 - hgt / 2, zc + Math.sin(a) * (drumR - 0.012));
    p.rotation.y = -Math.PI / 2 - a;              // facing the drum's axis
    cab.add(p);
    const b = box(`${name}Back`, w, hgt, 0.01, drawerM, 0, 0, -0.0055);
    p.add(b);
  }
}

// ── detergent drawer: under the console's front, over the back of the tub; it slides out toward the front (gal4) ──
const DET = { w: 0.215, x: -0.035, h: 0.04, z: xz(OPEN.f1 - 0.003) };
const det = group("DetergentDrawer", DET.x, DECK + 0.004, DET.z);
{
  const face = mesh("DrawerFace", flipV(new THREE.BoxGeometry(DET.w, DET.h, 0.006)), [drawerM, drawerM, drawerM, drawerM, detM, drawerM], 0, DET.h / 2, -0.003);
  det.add(face);
  const tz = -0.006 - 0.075;
  det.add(box("DrawerTray", DET.w - 0.006, 0.003, 0.15, drawerM, 0, 0.0015, tz));
  for (const x of [-DET.w / 2 + 0.003, DET.w / 2 - 0.003]) det.add(box("DrawerWall", 0.003, 0.034, 0.15, drawerM, x, 0.017, tz));
  det.add(box("DrawerWall", DET.w - 0.006, 0.034, 0.003, drawerM, 0, 0.017, tz - 0.0735));
  // the tray's top edge behind the face: its words (Powdered Detergent, Liquid Detergent, Softener)
  const tt = mesh("DrawerTop", flipV(new THREE.PlaneGeometry(DET.w, 0.012)), trayTopM, 0, DET.h + 0.0003, -0.012);
  tt.rotation.x = -Math.PI / 2;
  det.add(tt);
  // two light blue cups at the right (liquid detergent and softener), the blue impeller of the powder cup at the left
  for (const x of [0.03, 0.078]) det.add(box("BlueCup", 0.042, 0.028, 0.09, blueM, x, 0.017, tz + 0.01));
  det.add(cyl("Impeller", 0.008, 0.008, 0.012, impM, -0.055, 0.022, tz + 0.01, 16));
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    const bl = box("Impeller", 0.03, 0.003, 0.012, impM, -0.055 + Math.cos(a) * 0.02, 0.026, tz + 0.01 + Math.sin(a) * 0.02);
    bl.rotation.order = "YXZ"; bl.rotation.y = -a; bl.rotation.x = 0.45; det.add(bl);
  }
}
cab.add(det);

// ── lid: hinged at its back edge, a black frame round a large tinted glass window ──
const lid = group("Lid", 0, PIV[0], xz(PIV[1]));
{
  const s = roundRect(new THREE.Shape(), -W / 2 + 0.0015, W / 2 - 0.0015, LID0, LID1, 0.012, 0.004);
  s.holes.push(roundRect(new THREE.Path(), -0.25, 0.25, 0.04, 0.37, 0.018, 0.018));
  const fm = prism("LidFrame", s, (x, xf) => lidTop(xf) - LID_T, (x, xf) => lidTop(xf), lidM, { bev: 0.0025, segs: 1 });
  const wxf = (0.04 + 0.37) / 2, sl = Math.atan(0.0925);
  const pane = mesh("LidWindow", new THREE.PlaneGeometry(0.5, (0.37 - 0.04) / Math.cos(sl)), glassM, 0, lidTop(wxf) - 0.003, xz(wxf));
  pane.rotation.x = -Math.PI / 2 + sl;
  for (const m of [fm, pane]) { m.position.y -= PIV[0]; m.position.z -= xz(PIV[1]); lid.add(m); }
}
root.add(lid);

// ── the lid's opening: LG gives 1275 mm high with the lid open. The entry's angle is checked here: the height it gives and
// how far the open lid would pass into the console or the knob (must be 0) ──
const parts = productParts(PRODUCTS, ID);
{
  // the lid's profile at the knob's x: its top and underside, every 5 mm, in the lid group's frame
  const prof = [];
  for (let xf = LID0; xf <= LID1 + 1e-9; xf += 0.005) for (const y of [lidTop(xf), lidTop(xf) - LID_T]) prof.push([y - PIV[0], xz(xf) - xz(PIV[1])]);
  const faceH = (xf) => (xf < C0[0] ? -1 : xf < C1[0] ? C0[1] + (xf - C0[0]) * Math.tan(SL) : xf < 0.545 ? H : 0.958);
  const kg = JSON.parse(fs.readFileSync(`${T}/panel_geo.json`, "utf8")).knob;
  const kc = onFace(kg.x_mm / 1000, kg.s_mm / 1000, 0.026);           // the knob's top
  const deg = parts.find((p) => p.node === "Lid").angle;
  for (const d of [deg, -95, -100, -105, -110, -115, -120, -125]) {
    const a = (d * Math.PI) / 180;
    let h = 0, pen = 0, knob = Infinity;
    for (const [vy, vz] of prof) {
      const y = PIV[0] + vy * Math.cos(a) - vz * Math.sin(a), zz = xz(PIV[1]) + vy * Math.sin(a) + vz * Math.cos(a), xf = zF - zz;
      h = Math.max(h, y);
      pen = Math.max(pen, faceH(xf) - y);
      knob = Math.min(knob, Math.hypot(zz - kc.z, y - kc.y));
    }
    console.log(`lid open ${d} deg: ${(h * 1000).toFixed(1)} mm high (LG: 1275), ${(pen * 1000).toFixed(1)} mm into the console, knob top ${(knob * 1000).toFixed(1)} mm from the lid`);
  }
}

const clips = stateClips(root, parts);
saveZones(PRODUCTS, ID, root, parts);
fs.writeFileSync(new URL("../entries/lg-tx310nwo.gate.json", import.meta.url), JSON.stringify({
  sticksOut: "Knob\\w*|Inlet\\w*|HousingBack",
  why: "LG's D 620 mm is to the water inlet's fitting at the back; the cabinet's back is at 565 mm (D'). The knob stands 25 mm off the console's face, inside the 1003 mm height.",
}, null, 2) + "\n");
await exportGLB(root, clips, OUT, {
  SideL: `${T}/side_l.jpg`, SideR: `${T}/side_r.jpg`, BackPanel: `${T}/rear.jpg`, PanelFace: `${T}/panel.jpg`, ...printTex,
  EnergyLabel: `${T}/label.jpg`, Deck: `${T}/deck.jpg`, EmbossDrum: `${T}/drum.jpg`, Pulsator: `${T}/pulsator.jpg`,
  LintFilter: `${T}/filter.jpg`, SideWaterFall: `${T}/waterfall.jpg`, DrawerFace: `${T}/drawer_face.jpg`, DrawerTop: `${T}/drawer_top.jpg`,
}, { dir: `${TEX}/grain`, materials: {
  // Grain (BENCHMARK.md section 10): the gloss Onyx Black cabinet, top cover and console the soft peel; the matt base the strong
  // peel; nothing on the panel print, the lid's glass, the label or the photo-textured sides
  Body: { type: "peel_soft" }, TopCover: { type: "peel_soft" }, Console: { type: "peel_soft" }, Base: { type: "peel_strong" },
} });
