// LG T12SJMB1Z, 12 kg top-load washing machine with Smart Inverter and TurboDrum, Middle Black.
// Built to LG's size, 590 W x 965 H x 625 D mm, 1300 mm high with the lid open (LG India's spec page; the owner's manual
// MFL72021909 gives the same 590 x 625 x 965), and to LG's own gallery for this model: the side and back photos give the
// profile (a Middle Black cabinet on a grey plinth, a gloss black top cover with the control panel on its sloped front, a
// tempered glass lid with a chrome crescent handle, and a raised band at the back); the straight-down photos and the manual's
// drawing give the control panel; the lid-open, drum and close-up photos give everything inside.
// The category's reference is make_samsung_wa70.mjs; the helpers are copied from make_samsung_wa80.mjs. Every size LG does not
// publish is measured off LG's photos and scaled to the published size (private/research/lg_t12/NOTES.md).
// usage: node make_lg_t12.mjs <entry.json> <tex dir> <out.glb>
import { THREE, mat, mesh, box, group, flipV, inward, stateClips, exportGLB, productParts, saveZones } from "./lib.mjs";
import { mergeVertices, mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";

const [PRODUCTS, TEX, OUT] = process.argv.slice(2);
const ID = "lg-t12sjmb1z";
const T = `${TEX}/lg_t12`;

// ── size (metres); z runs front (+) to back (-), xf is the distance from the front edge ──
const W = 0.59, H = 0.965, D = 0.625;
const zF = D / 2;
const xz = (xf) => zF - xf;
const BODY = 0.613;                 // the cabinet and top cover; the water inlet's fitting reaches LG's 625 mm
const zB = xz(BODY);
const FT = 0.024, PLT = 0.0915;     // the plinth's underside (on its feet) and its top
const J = 0.865;                    // the cabinet's top edge, where the top cover sits on it
const RIM = 0.931;                  // the top cover round the opening, under the lid
const DECK = 0.885;                 // the floor of the well round the tub ring
const SLOPE = (23 * Math.PI) / 180, CS = Math.cos(SLOPE), SN = Math.sin(SLOPE);
const P0 = 0.879;                   // the control panel's front edge; it rises at 23 degrees toward the lid
const panelTop = (xf) => P0 + Math.tan(SLOPE) * xf;
const coverTop = (xf) => Math.min(RIM, panelTop(xf));
const fCurve = (x) => 0.235 * x * x;                 // the top cover's front edge, seen from above
const bCurve = (x) => 0.089 + 0.457 * x * x;         // the crescent: the lid's chrome front edge
const cCurve = (x) => bCurve(x) + 0.008;             // where the panel ends under the lid's edge
// the rear band behind the lid: its front edge slopes down into the notch the lid's back edge turns in (LG's side photo)
const RB0 = 0.457;
const rbTop = (xf) => Math.min(H, 0.946 + (xf - RB0) * 2.5, xf < 0.575 ? H : H - (xf - 0.575) * 0.5);
const OPEN = { x: 0.267, f0: 0.133, f1: 0.435, r: 0.04 };  // the opening under the lid
const RC = 0.32, zc = xz(RC);                        // the tub ring's centre: its front just inside the opening's front edge
const ringR = 0.187, lipR = 0.165;
const drumR = 0.215, drumTop = DECK - 0.04, drumFloor = 0.4, drumDepth = drumTop - drumFloor;
const LX = 0.289, LB = 0.445;                        // the lid's half-width and its back edge
const PIV = [0.95, 0.445];                          // the lid's hinge axis: height, distance from the front

// ── materials ──
const bodyM = mat("Body", 0x323232, { rough: 0.34, metal: 0.1 });               // Middle Black: sRGB (40-54) in LG's photos
const coverM = mat("TopCover", 0x0c0c0d, { rough: 0.22 });          // gloss black, the panel print's own background
const plinthM = mat("Plinth", 0x525254, { rough: 0.7 });
const footM = mat("Foot", 0x4a4a4c, { rough: 0.7 });
const backM = mat("BackPanel", 0xffffff, { rough: 0.55, metal: 0.2 });
const labelM = mat("LabelBEE", 0xffffff, { rough: 0.5, opacity: 0.999 });
const panelM = mat("PanelFace", 0xffffff, { rough: 0.16 });
const chromeM = mat("Chrome", 0xc9cbce, { metal: 0.9, rough: 0.22 });
const capM = mat("BlackCap", 0x0a0a0b, { rough: 0.2 });
const lidM = mat("LidTop", 0x0b0b0c, { rough: 0.1 });
const glassM = mat("LidGlass", 0x060607, { rough: 0.14, opacity: 0.9, side: THREE.DoubleSide });  // LG's photos show the drum through it, dimly
const handleM = mat("HandleFrame", 0x8c8a86, { rough: 0.35, metal: 0.3 });   // silver-grey, sRGB 125-150 in LG's side photo
const pocketM = mat("HandlePocket", 0x262627, { rough: 0.6 });
const wellM = mat("WellGrey", 0x3a3b3e, { rough: 0.45, side: THREE.DoubleSide });
const ringM = mat("TubRing", 0x9c9da0, { rough: 0.45, side: THREE.DoubleSide });
const drumM = mat("PunchDrum", 0xffffff, { rough: 0.3, metal: 0.3, side: THREE.DoubleSide });
const pulsM = mat("Pulsator", 0xffffff, { rough: 0.45 });
const stripM = mat("DrumStrip", 0x9a9b9e, { rough: 0.45 });
const filterM = mat("LintFilter", 0xffffff, { rough: 0.4 });
const blueM = mat("BlueCap", 0x86a8c8, { rough: 0.3 });
const darkM = mat("DarkCap", 0x2f2f30, { rough: 0.35 });
const markM = mat("CapMark", 0x8c8d90, { rough: 0.4 });
const drawerM = mat("Drawer", 0x2e2e31, { rough: 0.4 });   // dark grey, as in LG's close-up of the open drawer
const detM = mat("DrawerFace", 0xffffff, { rough: 0.4 });
const knuckleM = mat("Hinge", 0xc8c9cc, { rough: 0.4 });
const kgM = mat("Capacity", 0xffffff, { rough: 0.2, opacity: 0.999 });
const inletM = mat("Inlet", 0x3f6fae, { rough: 0.4 });
const threadM = mat("InletFitting", 0xd8ceb2, { rough: 0.45 });
const grommetM = mat("DrainOutlet", 0xd9d9d9, { rough: 0.5 });
const hose = mat("DrainHose", 0x8f9296, { rough: 0.6 });
const cordM = mat("Cord", 0x6c6e72, { rough: 0.6 });
const plugM = mat("Plug", 0x2c2d30, { rough: 0.5 });
const pinM = mat("Pin", 0xb7bbc0, { metal: 0.9, rough: 0.3 });

const cyl = (name, rt, rb, h, m, x, y, z, seg = 24) => mesh(name, new THREE.CylinderGeometry(rt, rb, h, seg), m, x, y, z);

// A plan shape stood up between two surfaces, bot(x, xf) and top(x, xf). The shape (x, xf - zF) is extruded upward, then every
// vertex is lifted to its place between the two. The bevel is kept inside the outline (bevelOffset = -bevel), so the bevelled
// part is exactly as big as its outline. caps picks the caps to keep; uvf(x, xf) gives a vertex's texture coordinates.
// (make_samsung_wa80.mjs's prism, with surfaces that may also vary across the width.)
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
      // walls keep their (horizontal) normals; caps lean with the surface they now follow
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

// A shape with every edge cut into pieces no longer than step: the caps are then triangulated between points close together,
// so a surface that bends (the lid's rise and its sloped back edge) is followed, not cut across by long triangles.
function dense(shape, step = 0.005, curve = 12) {
  const { shape: outer, holes } = shape.extractPoints(curve);
  const clean = (pts) => (pts.length > 1 && pts[0].distanceTo(pts[pts.length - 1]) < 1e-9 ? pts.slice(0, -1) : pts);
  const sub = (pts) => {
    const out = [];
    for (let i = 0; i < pts.length; i++) {
      const a = pts[i], b = pts[(i + 1) % pts.length], n = Math.max(1, Math.ceil(a.distanceTo(b) / step));
      for (let k = 0; k < n; k++) out.push(new THREE.Vector2(a.x + ((b.x - a.x) * k) / n, a.y + ((b.y - a.y) * k) / n));
    }
    return out;
  };
  const d = new THREE.Shape(sub(clean(outer)));
  for (const h of holes) d.holes.push(new THREE.Path(sub(clean(h))));
  return d;
}

// a side profile (points [xf, y]) extruded across a width w, centred on x = 0 (make_samsung_wa80.mjs's sideSlab)
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
// a curve across the width, as points (x, xf - zF), from x0 to x1
const across = (fn, x0, x1, n = 24) => [...Array(n + 1).keys()].map((i) => { const x = x0 + ((x1 - x0) * i) / n; return new THREE.Vector2(x, fn(x) - zF); });
const shapeOf = (pts) => new THREE.Shape(pts);
const V = (x, xf) => new THREE.Vector2(x, xf - zF);

// the control panel's own coordinates: x across, s up the 23 degree slope from its front edge, h out of it
const onPanel = new THREE.Matrix4().makeBasis(new THREE.Vector3(1, 0, 0), new THREE.Vector3(0, SN, -CS), new THREE.Vector3(0, CS, SN)).setPosition(0, P0, zF);
const PANEL_UV = (x, s) => [(x + W / 2) / W, (0.14 - s) / 0.14];       // panel.jpg: 590 mm across, s 0-140 mm, row 0 at s = 140

const root = group("LGT12");
const cab = group("Cabinet");
root.add(cab);

// ── base: the grey plinth on four levelling feet ──
// the plinth stands 10 mm inside the cabinet's sides and front, 9 mm at the back, from 24 mm to 91.5 mm (LG's side photo)
cab.add(prism("Plinth", roundRect(new THREE.Shape(), -0.285, 0.285, 0.012, BODY - 0.009, 0.03, 0.012), flat(FT), flat(PLT), plinthM, { bev: 0.004, caps: ["bottom"], segs: 1 }));
for (const sx of [-1, 1]) for (const xf of [0.06, BODY - 0.07]) cab.add(cyl("Foot", 0.018, 0.018, 0.03, footM, sx * 0.24, 0.015, xz(xf), 20));

// ── cabinet: Middle Black, rounded corners ──
cab.add(prism("Cabinet", roundRect(new THREE.Shape(), -W / 2, W / 2, 0, BODY, 0.03, 0.015), flat(PLT), flat(J), bodyM, { caps: ["bottom"] }));
// the cabinet's top edge shows only at the front, where the cover's front curves back from it: that strip is closed here (the
// rest of the cabinet is open at the top, so the drum shows through the opening)
{
  const s = new THREE.Shape();
  s.moveTo(-W / 2, 0.06 - zF); s.lineTo(-W / 2, 0.03 - zF); s.absarc(-W / 2 + 0.03, 0.03 - zF, 0.03, Math.PI, 1.5 * Math.PI, false);
  s.lineTo(W / 2 - 0.03, -zF); s.absarc(W / 2 - 0.03, 0.03 - zF, 0.03, -Math.PI / 2, 0, false);
  s.lineTo(W / 2, 0.06 - zF);
  s.quadraticCurveTo(W / 2, 0.02 - zF, 0.25, fCurve(0.25) - zF);
  across(fCurve, 0.25, -0.25).forEach((p) => s.lineTo(p.x, p.y));
  s.quadraticCurveTo(-W / 2, 0.02 - zF, -W / 2, 0.06 - zF);
  const g = new THREE.ShapeGeometry(s, 8);
  g.rotateX(-Math.PI / 2);
  cab.add(mesh("CabinetTop", g, bodyM, 0, J, 0));
}
// LG's energy label for T12SJMB1Z, on the front at the right (LG's front photo)
cab.add(mesh("LabelBEE", flipV(new THREE.PlaneGeometry(0.0655, 0.1206)), labelM, 0.229, 0.648, zF + 0.0007));
// the back: LG's back photo, straightened, from the plinth to the top cover
{
  const R = 0.015, w = W - 2 * R;
  const g = flipV(new THREE.PlaneGeometry(w, J - PLT - 0.002));
  const uv = g.attributes.uv;
  for (let i = 0; i < uv.count; i++) uv.setX(i, R / W + uv.getX(i) * (w / W));
  const p = mesh("BackDecal", g, backM, 0, (J + PLT) / 2, zB - 0.0006);
  p.rotation.y = Math.PI;
  cab.add(p);
}
// the handle pockets: a silver-grey frame round a recess, dark at the top and lit below, 106 x 44 mm (drawn flush with the side, 0.6 mm proud), on the right side toward the back, on the left toward the front
for (const [sx, xf] of [[1, 0.475], [-1, 0.166]]) {
  const ring = roundRect(new THREE.Shape(), -0.053, 0.053, -0.022 + zF, 0.022 + zF, 0.016, 0.016);
  ring.holes.push(roundRect(new THREE.Path(), -0.045, 0.045, -0.014 + zF, 0.014 + zF, 0.01, 0.01));
  // the lit lower half of the recess, as light as the frame in LG's photo
  const lit = new THREE.ShapeGeometry(roundRect(new THREE.Shape(), -0.045, 0.045, -0.014 + zF, -0.002 + zF, 0.01, 0), 4).toNonIndexed();
  lit.translate(0, 0, 0.0006);
  const g = mergeGeometries([new THREE.ExtrudeGeometry(ring, { depth: 0.0006, bevelEnabled: false, curveSegments: 4 }), lit]);
  g.rotateY((sx * Math.PI) / 2);
  cab.add(mesh("HandleFrame", mergeVertices(g, 1e-6), handleM, sx * (W / 2), 0.505, xz(xf)));
  const r = mesh("HandlePocket", new THREE.PlaneGeometry(0.092, 0.017), pocketM, sx * (W / 2 + 0.0003), 0.505 + 0.0065, xz(xf));   // the dark upper half
  r.rotation.y = (sx * Math.PI) / 2;
  cab.add(r);
}

// ── top cover ──
// the sloped control panel, from the cover's curved front edge back under the lid's crescent, printed with panel.jpg
{
  const pts = [
    ...across(fCurve, -0.25, 0.25),
  ];
  const s = shapeOf(pts);
  s.quadraticCurveTo(0.295, 0.02 - zF, 0.295, 0.06 - zF);
  across(cCurve, 0.295, -0.295).forEach((p) => s.lineTo(p.x, p.y));
  s.lineTo(-0.295, 0.06 - zF);
  s.quadraticCurveTo(-0.295, 0.02 - zF, -0.25, fCurve(-0.25) - zF);
  cab.add(prism("PanelFace", s, flat(J), (x, xf) => coverTop(xf), panelM, { bev: 0.003, caps: ["top"], uvf: (x, xf) => PANEL_UV(x, xf / CS) }));
}
// the cover round the opening (flat under the lid), its sides down to the cabinet; it runs 6 mm under the panel and 10 mm into
// the rear band, 0.8 mm lower, so no two surfaces share a plane
{
  const s = shapeOf(across((x) => cCurve(x) - 0.006, -0.295, 0.295));
  s.lineTo(0.295, RB0 + 0.01 - zF); s.lineTo(-0.295, RB0 + 0.01 - zF); s.closePath();
  s.holes.push(roundRect(new THREE.Path(), -OPEN.x, OPEN.x, OPEN.f0, OPEN.f1, OPEN.r, OPEN.r));
  cab.add(prism("TopCover", dense(s, 0.03), flat(J), (x, xf) => coverTop(xf) - 0.0008, coverM, { caps: ["top"] }));
}
// the rear band behind the lid: its front face carries the hinges; "12kg" printed on top
{
  const prof = [[RB0, J], [RB0, 0.946], [RB0 + (H - 0.946) / 2.5, H]];
  for (let i = 0; i <= 8; i++) { const xf = 0.575 + ((BODY - 0.575) * i) / 8; prof.push([xf, rbTop(xf)]); }
  prof.push([BODY, J]);
  cab.add(sideSlab("RearBand", prof, W, coverM));
}
{
  const k = mesh("Capacity", flipV(new THREE.PlaneGeometry(0.027, 0.013)), kgM, -0.248, H + 0.0006, xz(0.501));
  k.rotation.x = -Math.PI / 2;
  cab.add(k);
  for (const sx of [-1, 1]) cab.add(box("Hinge", 0.022, 0.013, 0.012, knuckleM, sx * 0.256, RIM + 0.0055, xz(RB0 - 0.005)));
}

// ── the control panel's raised parts: nine keys (their tops printed with the panel), the Power and Start rings, two screw caps ──
{
  // key centres and sizes measured on panel.jpg (mm): Soil Level, Beeper, Water Level, Wash, Rinse, Spin, Program 1 and 2, Delay
  const keys = [[-134.5, 27.7], [-102.2, 25.6], [-66.5, 23.9], [-33.1, 23.0], [-0.4, 22.7], [32.5, 23.0], [65.4, 23.9], [98.3, 25.4], [66.1, 70.8]];
  const geos = keys.map(([kx, ks]) => {
    const w = 0.0201, h = 0.014, r = 0.003;
    const sh = new THREE.Shape();
    sh.moveTo(-w / 2 + r, -h / 2); sh.lineTo(w / 2 - r, -h / 2); sh.absarc(w / 2 - r, -h / 2 + r, r, -Math.PI / 2, 0, false);
    sh.lineTo(w / 2, h / 2 - r); sh.absarc(w / 2 - r, h / 2 - r, r, 0, Math.PI / 2, false);
    sh.lineTo(-w / 2 + r, h / 2); sh.absarc(-w / 2 + r, h / 2 - r, r, Math.PI / 2, Math.PI, false);
    sh.lineTo(-w / 2, -h / 2 + r); sh.absarc(-w / 2 + r, -h / 2 + r, r, Math.PI, 1.5 * Math.PI, false);
    const g = new THREE.ExtrudeGeometry(sh, { depth: 0.0014, bevelEnabled: false, curveSegments: 3 });
    g.translate(kx / 1000, ks / 1000, -0.0002);
    const p = g.attributes.position, uv = g.attributes.uv;
    for (let i = 0; i < p.count; i++) uv.setXY(i, ...PANEL_UV(p.getX(i), p.getY(i)));
    return g.applyMatrix4(onPanel);
  });
  cab.add(mesh("PanelKeys", mergeVertices(mergeGeometries(geos), 1e-6), panelM));
  // the chrome rings round Power (x 164 mm, s 75.5 mm, 10.4 mm radius) and Start/Pause (x 141 mm, s 44 mm, 15.8 mm radius)
  const rings = [[164.1, 75.5, 10.4], [141.4, 44.0, 15.8]].map(([rx, rs, rr]) => {
    const g = new THREE.TorusGeometry(rr / 1000, 0.0009, 8, 48);
    g.scale(1, 1, 0.8);
    g.translate(rx / 1000, rs / 1000, 0.0003);
    return g.applyMatrix4(onPanel);
  });
  cab.add(mesh("PanelRings", mergeGeometries(rings), chromeM));
  const caps = [-1, 1].map((sx) => {
    const g = new THREE.SphereGeometry(0.0095, 20, 8, 0, Math.PI * 2, 0, Math.PI / 2);
    g.rotateX(Math.PI / 2); g.scale(1, 1, 0.3);
    g.translate(sx * 0.2617, 0.0835, -0.0003);
    return g.applyMatrix4(onPanel);
  });
  cab.add(mesh("ScrewCaps", mergeGeometries(caps), capM));
}

// ── the well: grey walls down to the deck, the light grey tub ring, the Punch + 3 drum, the TurboDrum pulsator ──
{
  const wall = roundRect(new THREE.Shape(), -OPEN.x, OPEN.x, OPEN.f0, OPEN.f1, OPEN.r, OPEN.r);
  const ix = OPEN.x - 0.004, i0 = OPEN.f0 + 0.004, i1 = OPEN.f1 - 0.004, ir = OPEN.r - 0.004;
  wall.holes.push(roundRect(new THREE.Path(), -ix, ix, i0, i1, ir, ir));
  cab.add(prism("WellWall", wall, flat(DECK - 0.002), flat(RIM - 0.0005), wellM, { caps: ["top"] }));
  // the deck either side of the tub ring: the opening less the ring's circle
  const lune = (sx) => {
    const a0 = Math.atan2(i1 - RC, Math.sqrt(ringR ** 2 - (i1 - RC) ** 2)), a1 = Math.atan2(i0 - RC, Math.sqrt(ringR ** 2 - (i0 - RC) ** 2));
    const pts = [V(Math.sqrt(ringR ** 2 - (i0 - RC) ** 2), i0), V(ix - ir, i0)];
    for (let i = 1; i <= 6; i++) { const a = -Math.PI / 2 + (i / 6) * (Math.PI / 2); pts.push(V(ix - ir + ir * Math.cos(a), i0 + ir + ir * Math.sin(a))); }
    pts.push(V(ix, i1 - ir));
    for (let i = 1; i <= 6; i++) { const a = (i / 6) * (Math.PI / 2); pts.push(V(ix - ir + ir * Math.cos(a), i1 - ir + ir * Math.sin(a))); }
    for (let i = 0; i < 24; i++) { const a = a0 + ((a1 - a0) * i) / 24; pts.push(V(ringR * Math.cos(a), RC + ringR * Math.sin(a))); }
    const g = new THREE.ShapeGeometry(new THREE.Shape(pts.map((p) => new THREE.Vector2(sx * p.x, p.y))));
    g.rotateX(-Math.PI / 2);
    return g;
  };
  const dg = mergeGeometries([lune(1), lune(-1)]);
  dg.translate(0, DECK, 0);
  cab.add(mesh("Deck", dg, wellM));
  // the tub ring: a wide light grey collar, its lip turned down into the drum
  const ring = new THREE.LatheGeometry([[ringR, -0.001], [0.172, -0.003], [lipR, -0.009], [lipR - 0.002, -0.022], [0.175, -0.032], [drumR + 0.002, -0.04]].map(([r, y]) => new THREE.Vector2(r, y)), 96);
  cab.add(mesh("TubRing", ring, ringM, 0, DECK, zc));
  // drum wall, inward-facing: LG's Punch + 3 steel, 96 mm tiles, 14 round
  const g = new THREE.CylinderGeometry(drumR, drumR, drumDepth, 96, 1, true);
  const uv = g.attributes.uv;
  const uRep = 14, vRep = drumDepth / ((2 * Math.PI * drumR) / uRep);
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * uRep, 1 - uv.getY(i) * vRep);
  inward(g);
  cab.add(mesh("PunchDrum", g, drumM, 0, drumTop - drumDepth / 2, zc));
  // the floor and the pulsator, mapped straight down with LG's drum photo: pulsator.jpg's 256 px radius is RM
  const RP = 0.167, RM = (RP * 256) / 194;
  const planar = (geo) => {
    const p = geo.attributes.position, u = geo.attributes.uv;
    for (let i = 0; i < u.count; i++) u.setXY(i, 0.5 + p.getX(i) / (2 * RM), 0.5 + p.getZ(i) / (2 * RM));
    return geo;
  };
  const fl = new THREE.CircleGeometry(drumR, 72); fl.rotateX(-Math.PI / 2);
  cab.add(mesh("DrumFloor", planar(fl), pulsM, 0, drumFloor, zc));
  const dish = new THREE.LatheGeometry([[0, 0.012], [0.05, 0.0115], [0.12, 0.008], [RP, 0.003], [RP + 0.003, 0]].map(([r, y]) => new THREE.Vector2(r, y)), 72);
  cab.add(mesh("Pulsator", planar(dish), pulsM, 0, drumFloor, zc));
  // three turbines (raised cups) and the centre cap, at their places in the photo
  const tb = [-112, 126, 7].map((deg) => {
    const a = (deg * Math.PI) / 180, r = (128 / 194) * RP;
    const c = new THREE.CylinderGeometry(0.031, 0.033, 0.01, 32);
    c.translate(r * Math.cos(a), 0.0105 - 0.0035 * (r / RP), r * Math.sin(a));
    return planar(c);
  });
  const cc = new THREE.SphereGeometry(0.034, 32, 10, 0, Math.PI * 2, 0, Math.PI / 2); cc.scale(1, 0.4, 1); cc.translate(0, 0.011, 0);
  cab.add(mesh("Turbines", mergeGeometries([...tb, planar(cc)]), pulsM, 0, drumFloor, zc));
  // three grey strips on the drum wall; the one at the back carries the blue lint filter
  for (const deg of [-90, 30, 150]) {
    const a = (deg * Math.PI) / 180;
    const s = box("DrumStrip", 0.07, drumDepth - 0.01, 0.01, stripM, Math.cos(a) * (drumR - 0.006), drumFloor + 0.005 + (drumDepth - 0.01) / 2, zc + Math.sin(a) * (drumR - 0.006));
    s.rotation.y = -a - Math.PI / 2;
    cab.add(s);
  }
  const lf = new THREE.CylinderGeometry(0.034, 0.034, 0.008, 40); lf.rotateX(Math.PI / 2);
  cab.add(mesh("LintFilter", lf, filterM, 0, drumTop - 0.11, zc - drumR + 0.015));
  // the fabric softener's blue cap on the ring at the back right; the bleach dispenser's dark cap on the deck at the front left
  const bc = new THREE.SphereGeometry(0.017, 24, 10, 0, Math.PI * 2, 0, Math.PI / 2); bc.scale(1, 0.55, 1);
  cab.add(mesh("BlueCap", bc, blueM, ringR * Math.cos(0.56), DECK - 0.001, xz(RC + ringR * Math.sin(0.56))));
  cab.add(cyl("BleachCap", 0.03, 0.031, 0.008, darkM, -0.211, DECK + 0.004, xz(0.162), 40));
  const tri = new THREE.Shape([new THREE.Vector2(0, 0.009), new THREE.Vector2(-0.008, -0.006), new THREE.Vector2(0.008, -0.006)]);
  const tg = new THREE.ShapeGeometry(tri); tg.rotateX(-Math.PI / 2);
  cab.add(mesh("BleachMark", tg, markM, -0.211, DECK + 0.0085, xz(0.162)));
}

// ── detergent drawer: at the back of the well under the rear band; it slides out toward the front ──
const det = group("DetergentDrawer", 0, DECK + 0.002, xz(0.418));
{
  const fw = 0.15, fh = 0.042;
  det.add(mesh("DrawerFace", flipV(new THREE.BoxGeometry(fw, fh, 0.006)), [drawerM, drawerM, drawerM, drawerM, detM, drawerM], 0, fh / 2, -0.003));
  // the tray behind the face: floor, walls, and the divider between the detergent cup and the narrow one at the right
  const tz = -0.006 - 0.06;
  det.add(box("DrawerTray", fw - 0.006, 0.003, 0.12, drawerM, 0, 0.0015, tz));
  for (const x of [-fw / 2 + 0.003, fw / 2 - 0.003, 0.045]) det.add(box("DrawerWall", 0.003, 0.028, 0.12, drawerM, x, 0.014, tz));
  det.add(box("DrawerWall", fw - 0.006, 0.028, 0.003, drawerM, 0, 0.014, tz - 0.0585));
}
cab.add(det);

// ── lid: hinged at its back edge, a chrome crescent handle at the front, a black frame round a tinted glass window ──
const lid = group("Lid", 0, PIV[0], xz(PIV[1]));
{
  const bot = (x, xf) => coverTop(xf) + 0.002;
  // the back edge rounds down to 958 mm, into the notch in front of the rear band, so it clears the band as it turns
  // the frame is flat on top, its back edge sloping down; the chrome handle in front of it curves down to the panel
  const top = (x, xf) => Math.min(H, 0.958 + (LB - xf) * 1.5);
  const lipTop = (x, xf) => { const b = bot(x, xf) + 0.012, t = Math.min(1, Math.max(0, (xf - bCurve(x) - 0.002) / 0.008)); return b + (H - b) * Math.sqrt(t); };
  const lip = shapeOf(across((x) => bCurve(x) + 0.002, -LX, LX));
  across((x) => bCurve(x) + 0.01, LX, -LX).forEach((p) => lip.lineTo(p.x, p.y));
  const lm = prism("LidHandle", lip, bot, lipTop, chromeM, { bev: 0.0015, segs: 1 });
  const fr = shapeOf(across((x) => bCurve(x) + 0.01, -LX, LX));
  fr.lineTo(LX, LB - 0.012 - zF); fr.absarc(LX - 0.012, LB - 0.012 - zF, 0.012, 0, Math.PI / 2, false);
  fr.lineTo(-LX + 0.012, LB - zF); fr.absarc(-LX + 0.012, LB - 0.012 - zF, 0.012, Math.PI / 2, Math.PI, false);
  fr.closePath();
  fr.holes.push(roundRect(new THREE.Path(), -0.25, 0.25, 0.159, 0.41, 0.03, 0.03));
  const fm = prism("LidFrame", dense(fr, 0.03), bot, top, lidM, { bev: 0.0025, segs: 1 });
  const pane = mesh("LidWindow", new THREE.PlaneGeometry(0.5, 0.251), glassM, 0, H - 0.0006, xz(0.2845));
  pane.rotation.x = -Math.PI / 2;
  for (const m of [lm, fm, pane]) { m.position.y -= PIV[0]; m.position.z -= xz(PIV[1]); lid.add(m); }
}
root.add(lid);

// ── the back: the water inlet at the top, the power cord with its 3-pin plug, the drain outlet and hose (LG's manual) ──
{
  // the inlet: a blue collar on the rear band's back, its threaded fitting reaching LG's 625 mm depth
  cab.add(cyl("InletCollar", 0.017, 0.017, 0.004, inletM, 0.05, 0.928, zB - 0.002, 32).rotateX(Math.PI / 2));
  cab.add(cyl("InletThread", 0.0115, 0.0115, 0.012, threadM, 0.05, 0.928, -D / 2 + 0.006, 24).rotateX(Math.PI / 2));
  // the cord leaves the top cover at the back right, runs down the cabinet's back edge through LG's two blue clips
  const cp = [[0.238, 0.878], [0.262, 0.8], [0.263, 0.62], [0.263, 0.48], [0.25, 0.37], [0.22, 0.31]].map(([x, y]) => new THREE.Vector3(x, y, zB - 0.006));
  cab.add(mesh("PowerCord", new THREE.TubeGeometry(new THREE.CatmullRomCurve3(cp, false, "centripetal"), 60, 0.0042, 6, false), cordM));
  cab.add(box("Plug", 0.036, 0.046, 0.022, plugM, 0.218, 0.285, zB - 0.013));
  for (const [dx, dz, r] of [[0, 0.004, 0.0035], [-0.0095, -0.004, 0.0026], [0.0095, -0.004, 0.0026]]) cab.add(cyl("PlugPin", r, r, 0.018, pinM, 0.218 + dx, 0.253, zB - 0.013 + dz, 10));
  // the drain outlet at the bottom of the back panel, and the drain hose pushed onto it, turned toward the right
  cab.add(cyl("Grommet", 0.017, 0.017, 0.016, grommetM, -0.011, 0.126, zB - 0.008, 32).rotateX(Math.PI / 2));
  const hp = [[-0.011, 0.126, zB - 0.02], [-0.011, 0.09, zB - 0.03], [0.02, 0.03, zB - 0.03], [0.12, 0.0135, zB - 0.03], [0.22, 0.0135, zB - 0.028]].map(([x, y, z]) => new THREE.Vector3(x, y, z));
  cab.add(mesh("DrainHose", new THREE.TubeGeometry(new THREE.CatmullRomCurve3(hp, false, "centripetal"), 60, 0.0125, 12, false), hose));
}

// ── the lid's opening: LG gives 1300 mm high with the lid open. The entry's angle is checked here: the height it gives, and
// how far the open lid would pass into the rear band (must be 0) ──
const parts = productParts(PRODUCTS, ID);
{
  root.updateMatrixWorld(true);
  const pts = [];
  lid.traverse((o) => { if (o.isMesh) { const p = o.geometry.attributes.position; for (let i = 0; i < p.count; i++) pts.push(new THREE.Vector3().fromBufferAttribute(p, i).applyMatrix4(o.matrix)); } });
  const deg = parts.find((p) => p.node === "Lid").angle, a = (deg * Math.PI) / 180;
  let h = 0, pen = 0;
  for (const v of pts) {
    const y = PIV[0] + v.y * Math.cos(a) - v.z * Math.sin(a), xf = PIV[1] - (v.y * Math.sin(a) + v.z * Math.cos(a));
    h = Math.max(h, y);
    if (xf > RB0 && y > J) pen = Math.max(pen, rbTop(xf) - y);
  }
  console.log(`lid open ${deg} deg: ${(h * 1000).toFixed(1)} mm high (LG: 1300), ${(pen * 1000).toFixed(1)} mm into the rear band`);
}

const clips = stateClips(root, parts);
saveZones(PRODUCTS, ID, root, parts);
await exportGLB(root, clips, OUT, {
  PanelFace: `${T}/panel.jpg`, LabelBEE: `${T}/label.png`, BackPanel: `${T}/back.jpg`, PunchDrum: `${T}/drum.jpg`,
  Pulsator: `${T}/pulsator.jpg`, LintFilter: `${T}/filter.jpg`, DrawerFace: `${T}/detergent.jpg`, Capacity: `${T}/kg12.png`,
}, { dir: `${TEX}/grain`, materials: {
  // Grain (BENCHMARK.md section 10): the Middle Black cabinet the peel, as LG's other dark washers; the gloss black top cover
  // the soft peel; the matt moulded plinth the strong peel; nothing on the panel print, the lid's glass or the labels
  Body: { type: "peel" }, TopCover: { type: "peel_soft" }, Plinth: { type: "peel_strong" },
} });
