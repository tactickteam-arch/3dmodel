// LG T80SPMB1Z, 8 kg top-load washing machine with Smart Inverter motor and TurboDrum, Middle Black.
// Built to 540 W x 925 H x 560 D mm: LG India's spec page and FAQ (540 x 925 x 560), Sangeetha's listing (54 x 92.5 x 56 cm) and the
// size table in LG's owner's manual MFL72021909 (the T80SP* row: 540 / 560 / 925 mm, 32 kg) all agree.
// Copied from make_lg_t70.mjs (LG T70AJMB1Z, the same family, top cover and manual): a Middle Black cabinet on a grey plinth, a gloss
// black top cover with the control panel on its sloped front, a tempered glass lid with a black crescent handle edged in chrome, a
// raised band at the back. This model has the manual's "6 Water Level Model" panel (seven keys and Delay), its lint filter on the
// right of the drum and a one-cup detergent drawer, as LG's gallery shows. The top cover keeps the T70's shape in millimetres (the
// family's part: the T70 and T12 builders measure it the same from the top); the cabinet below is taller. Every height LG doesn't
// publish is read off LG's side and back photos at 925 mm (1.25 px/mm). LG's close-ups on this model's page are of the 7 kg
// T70SPMB1Z (same cabinet and panel, per the manual): see private/research/lg_t80/NOTES.md.
// usage: node make_lg_t80.mjs <entry.json> <tex dir> <out.glb>
import { THREE, mat, mesh, box, group, flipV, inward, stateClips, exportGLB, productParts, saveZones } from "./lib.mjs";
import { mergeVertices, mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { uvDecals } from "./decal_curved.mjs";

const [PRODUCTS, TEX, OUT] = process.argv.slice(2);
const ID = "lg-t80spmb1z";
const T = `${TEX}/lg_t80`;
import fs from "node:fs";
const LAYOUT = JSON.parse(fs.readFileSync(`${T}/panel_layout.json`, "utf8"));   // keys, rings, caps in panel mm (tex_lg_t80.py)

// ── size (metres); z runs front (+) to back (-), xf is the distance from the front edge ──
const W = 0.54, H = 0.925, D = 0.56;
const zF = D / 2;
const xz = (xf) => zF - xf;
const BODY = 0.548;                 // the cabinet and top cover; the water inlet's fitting reaches LG's 560 mm (the side photos give
                                    // about 548 mm for the cabinet, as the T70's)
const zB = xz(BODY);
const FT = 0.024, PLT = 0.087;      // the plinth's underside (on its feet) and its top (side photo 24 / 88 mm, back photo 85 mm)
const J = 0.81;                     // the cabinet's top edge, where the top cover sits on it (side photo 813, back photo 806 mm)
const RIM = H - 0.034;              // the top cover round the opening, under the lid (the family's 34 mm below the top)
const DECK = H - 0.08;              // the floor of the well round the tub ring (the family's 80 mm below the top)
const SLOPE = (23 * Math.PI) / 180, CS = Math.cos(SLOPE), SN = Math.sin(SLOPE);
const P0 = H - 0.085;               // the control panel's front edge, as the T70 85 mm below the top; it rises at 23 degrees
const panelTop = (xf) => P0 + Math.tan(SLOPE) * xf;
const coverTop = (xf) => Math.min(RIM, panelTop(xf));
const fCurve = (x) => 0.235 * x * x;                 // the top cover's front edge, seen from above (8 mm back at x 0.18 m: top_open.jpg)
const bCurve = (x) => 0.096 + 0.2 * x * x;           // the crescent: the lid's chrome front edge (the panel ends 104 mm back: top_open.jpg)
const FX = 0.229, SX = W / 2;                        // where the front edge's curve hands over to the rounded corners
const cCurve = (x) => bCurve(x) + 0.008;             // where the panel ends under the lid's edge
// the rear band behind the lid: its front edge slopes down into the notch the lid's back edge turns in (LG's side photo)
const RB0 = 0.41;                                    // the hinges stand on this line (top_open.jpg)
const RBK = BODY - 0.038;
const rbTop = (xf) => Math.min(H, H - 0.019 + (xf - RB0) * 2.5, xf < RBK ? H : H - (xf - RBK) * 0.5);
const OPEN = { x: 0.243, f0: 0.118, f1: 0.392, r: 0.04 };  // the opening under the lid (top_open.jpg, 1.715 px/mm)
const RC = 0.268, zc = xz(RC);                       // the tub ring's centre (the pulsator's centre, 273 mm back in top_open.jpg, less the deck's depth)
const ringR = 0.174, lipR = 0.153;                   // the light grey collar and its lip (top_open.jpg, at the deck)
// the drum: its radius and depth are not published and not readable off LG's photos; sized as the T12's in proportion to the
// collar (0.93), floor ESTIMATED
const drumR = 0.2, drumTop = DECK - 0.04, drumFloor = 0.36, drumDepth = drumTop - drumFloor;
// the lint filter's strip on the drum wall: at the right, toward the back (drum.jpg: -24 degrees from the right, seen from above)
const FA = -24, FAR = (FA * Math.PI) / 180;
const LX = 0.269, LB = 0.398;                        // the lid's half-width and its back edge
const PIV = [H - 0.015, 0.398];                      // the lid's hinge axis: height, distance from the front

// ── materials ──
const bodyM = mat("Body", 0x323232, { rough: 0.34, metal: 0.1 });               // Middle Black: sRGB (40-54) in LG's photos
// gloss black, the panel print's own background. Metal 0.6 and roughness 0.45 (look pass 5 Nov 2026): as a plain gloss dielectric
// it mirrored the viewer's back light (rear band 0.55 of the label white in the default view; LG's photos 0.25, 0.09 from above)
const coverM = mat("TopCover", 0x0c0c0d, { metal: 0.6, rough: 0.45 });
const plinthM = mat("Plinth", 0x525254, { rough: 0.7 });
const footM = mat("Foot", 0x4a4a4c, { rough: 0.7 });
const backM = mat("BackPanel", 0xffffff, { rough: 0.55, metal: 0.2 });
const panelM = mat("PanelFace", 0xffffff, { rough: 0.16 });
const chromeM = mat("Chrome", 0xc9cbce, { metal: 0.9, rough: 0.22 });
const capM = mat("BlackCap", 0x0a0a0b, { rough: 0.2 });
// The lid is seen at a grazing angle in every 3/4 view, where a gloss dielectric reflects ~10 % of whatever is behind the machine:
// the gate's bright room made it read silver (0.99 of the label white), the page's rim light 0.54 (LG's photo 0.22). Metal 1 over
// near-black keeps its face dark and rough 0.5 spreads the lights: 0.18 under the page light, 0.37 in the gate light, 0.42 in
// RealityKit under the page's studio.hdr (was 0.83), look pass 5 Nov 2026. Rougher matches RealityKit (0.75: 0.22) but leaves the page
// light's lid near black (0.07), so 0.5 is the middle.
const lidM = mat("LidTop", 0x0b0b0c, { metal: 1, rough: 0.5 });
const glassM = mat("LidGlass", 0x060607, { metal: 1, rough: 0.5, opacity: 0.9, side: THREE.DoubleSide });  // LG's photos show the drum through it, dimly
const handleM = mat("HandleFrame", 0x8c8a86, { rough: 0.35, metal: 0.3 });   // silver-grey, sRGB 125-150 in LG's side photo
const pocketM = mat("HandlePocket", 0x262627, { rough: 0.6 });
const wellM = mat("WellGrey", 0x3a3b3e, { rough: 0.45, side: THREE.DoubleSide });
const ringM = mat("TubRing", 0xb2b3b6, { rough: 0.45, side: THREE.DoubleSide });
const drumM = mat("PunchDrum", 0xffffff, { rough: 0.3, metal: 0.3, side: THREE.DoubleSide });
const pulsM = mat("Pulsator", 0xffffff, { rough: 0.45 });
const stripM = mat("DrumStrip", 0x9a9b9e, { rough: 0.45 });
const filterM = mat("LintFilter", 0xffffff, { rough: 0.4 });
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
const PANEL_UV = (x, s) => [(x + W / 2) / W, (0.14 - s) / 0.14];       // panel.jpg: 540 mm across, s 0-140 mm, row 0 at s = 140

const root = group("LGT80");
let printTex = {};
// the panel's print decals (decals.json: name -> file, rect in the panel's UVs); the keys' tops are printed from the same pieces
const DECALS = JSON.parse(fs.readFileSync(`${T}/decals.json`, "utf8"));
const cab = group("Cabinet");
root.add(cab);

// ── base: the grey plinth on four levelling feet ──
// the plinth stands 14 mm inside the cabinet's front and back (side photos) and 4 mm inside its sides (back photo), from 22 mm to 84 mm
cab.add(prism("Plinth", roundRect(new THREE.Shape(), -0.266, 0.266, 0.014, BODY - 0.014, 0.03, 0.012), flat(FT), flat(PLT), plinthM, { bev: 0.004, caps: ["bottom"], segs: 1 }));
// the feet: 234 mm either side of the centre (back photo), 57 mm from the front and 68 mm from the back (side photos)
for (const sx of [-1, 1]) for (const xf of [0.057, BODY - 0.068]) cab.add(cyl("Foot", 0.018, 0.018, 0.03, footM, sx * 0.234, 0.015, xz(xf), 20));

// ── cabinet: Middle Black, rounded corners ──
cab.add(prism("Cabinet", roundRect(new THREE.Shape(), -W / 2, W / 2, 0, BODY, 0.03, 0.015), flat(PLT), flat(J), bodyM, { caps: ["bottom"] }));
// the cabinet's top edge shows only at the front, where the cover's front curves back from it: that strip is closed here (the
// rest of the cabinet is open at the top, so the drum shows through the opening)
{
  const s = new THREE.Shape();
  s.moveTo(-W / 2, 0.06 - zF); s.lineTo(-W / 2, 0.03 - zF); s.absarc(-W / 2 + 0.03, 0.03 - zF, 0.03, Math.PI, 1.5 * Math.PI, false);
  s.lineTo(W / 2 - 0.03, -zF); s.absarc(W / 2 - 0.03, 0.03 - zF, 0.03, -Math.PI / 2, 0, false);
  s.lineTo(W / 2, 0.06 - zF);
  s.quadraticCurveTo(W / 2, 0.02 - zF, FX, fCurve(FX) - zF);
  across(fCurve, FX, -FX).forEach((p) => s.lineTo(p.x, p.y));
  s.quadraticCurveTo(-W / 2, 0.02 - zF, -W / 2, 0.06 - zF);
  const g = new THREE.ShapeGeometry(s, 8);
  g.rotateX(-Math.PI / 2);
  cab.add(mesh("CabinetTop", g, bodyM, 0, J, 0));
}
// a dark floor 1.5 mm under the cabinet's top edge, inside its walls, round the drum: the joint between the cabinet and the top
// cover shows this, not the hollow cabinet and the room behind it, from every side (handover pass 21 Nov: a see-through slit)
{
  const s = roundRect(new THREE.Shape(), -W / 2 + 0.001, W / 2 - 0.001, 0.001, BODY - 0.001, 0.029, 0.014);
  const h = new THREE.Path(); h.absarc(0, -zc, drumR + 0.004, 0, 2 * Math.PI, true); s.holes.push(h);
  const g = new THREE.ShapeGeometry(s, 24);
  g.rotateX(-Math.PI / 2);
  cab.add(mesh("CabinetFloorTop", g, coverM, 0, J - 0.0015, 0));
}
// (LG's energy label for T80SPMB1Z is put on by add_label.mjs, from pipeline/entries/lg-t80spmb1z.label.json)
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
// the handle pockets: a silver-grey frame round a recess, dark at the top and lit below, 104 x 40 mm at 456 mm high (drawn flush
// with the side, 0.6 mm proud), on the right side 114 mm from the back, on the left 147 mm from the front (LG's side photos)
const HY = 0.474;                   // the pockets' centre height (side photos, 1.254 px/mm)
for (const [sx, xf] of [[1, BODY - 0.114], [-1, 0.147]]) {
  const ring = roundRect(new THREE.Shape(), -0.052, 0.052, -0.02 + zF, 0.02 + zF, 0.015, 0.015);
  ring.holes.push(roundRect(new THREE.Path(), -0.044, 0.044, -0.012 + zF, 0.012 + zF, 0.009, 0.009));
  // the lit lower half of the recess, as light as the frame in LG's photo
  const lit = new THREE.ShapeGeometry(roundRect(new THREE.Shape(), -0.044, 0.044, -0.012 + zF, -0.002 + zF, 0.009, 0), 4).toNonIndexed();
  lit.translate(0, 0, 0.0006);
  const g = mergeGeometries([new THREE.ExtrudeGeometry(ring, { depth: 0.0006, bevelEnabled: false, curveSegments: 4 }), lit]);
  g.rotateY((sx * Math.PI) / 2);
  cab.add(mesh("HandleFrame", mergeVertices(g, 1e-6), handleM, sx * (W / 2), HY, xz(xf)));
  const r = mesh("HandlePocket", new THREE.PlaneGeometry(0.084, 0.015), pocketM, sx * (W / 2 + 0.0003), HY + 0.0058, xz(xf));   // the dark upper half
  r.rotation.y = (sx * Math.PI) / 2;
  cab.add(r);
}

// ── top cover ──
// the sloped control panel, from the cover's curved front edge back under the lid's crescent, printed with panel.jpg
{
  const pts = [
    ...across(fCurve, -FX, FX),
  ];
  const s = shapeOf(pts);
  s.quadraticCurveTo(SX, 0.02 - zF, SX, 0.06 - zF);
  across(cCurve, SX, -SX).forEach((p) => s.lineTo(p.x, p.y));
  s.lineTo(-SX, 0.06 - zF);
  s.quadraticCurveTo(-SX, 0.02 - zF, -FX, fCurve(-FX) - zF);
  const pf = prism("PanelFace", s, flat(J), (x, xf) => coverTop(xf), panelM, { bev: 0.003, caps: ["top"], uvf: (x, xf) => PANEL_UV(x, xf / CS) });
  cab.add(pf);
  // the print sharp: the panel drawn again at 12 px/mm (about 11 on the model), its inked part laid on the panel in pieces (tex_lg_t80.py --hi,
  // decal_curved.mjs), clipped to the panel's curved front edge
  printTex = uvDecals(pf, `${T}/decals.json`, (n) => mat(n, 0xffffff, { rough: 0.16 }), { cell: [0.015, 0.0025], clip: true });
}
// the top cover's front below the panel is Middle Black like the cabinet, not gloss black (LG's front and 3/4 photos of T80SPMB1Z:
// a body-coloured band from the cabinet's top edge up to the panel's front edge, 30 mm here): a skin 0.6 mm proud of the cover's front
{
  const q = (a, b, c, t) => a * (1 - t) ** 2 + 2 * b * (1 - t) * t + c * t * t;
  const line = [];                                        // the cover's front outline (x, xf), as the panel prism's
  for (let i = 0; i <= 8; i++) { const t = i / 8; line.push([q(-SX, -SX, -FX, t), q(0.06, 0.02, fCurve(-FX), t)]); }
  across(fCurve, -FX, FX).forEach((p, i) => i && line.push([p.x, p.y + zF]));
  for (let i = 1; i <= 8; i++) { const t = i / 8; line.push([q(FX, SX, SX, t), q(fCurve(FX), 0.02, 0.06, t)]); }
  const P = [], N = [], I = [];
  const y0 = J + 0.0005, y1 = P0 - 0.002, OFF = 0.0009;
  line.forEach(([x, xf], i) => {
    const [xa, fa] = line[Math.max(0, i - 1)], [xb, fb] = line[Math.min(line.length - 1, i + 1)];
    let nx = fb - fa, nf = -(xb - xa);                    // outward normal in (x, xf): the tangent turned toward the front
    const l = Math.hypot(nx, nf) || 1; nx /= l; nf /= l;
    const px = x + OFF * nx, pf = xf + OFF * nf;
    P.push(px, y0, xz(pf), px, y1, xz(pf)); N.push(nx, 0, -nf, nx, 0, -nf);
    if (i) { const a = 2 * (i - 1); I.push(a, a + 2, a + 1, a + 1, a + 2, a + 3); }
  });
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(P, 3));
  g.setAttribute("normal", new THREE.Float32BufferAttribute(N, 3));
  g.setAttribute("uv", new THREE.Float32BufferAttribute(new Array((P.length / 3) * 2).fill(0), 2));
  g.setIndex(I);
  cab.add(mesh("CoverFront", g, bodyM));
}
// the cover round the opening (flat under the lid), its sides down to the cabinet; it runs 6 mm under the panel and 10 mm into
// the rear band, 0.8 mm lower, so no two surfaces share a plane
{
  const s = shapeOf(across((x) => cCurve(x) - 0.006, -SX, SX));
  s.lineTo(SX, RB0 + 0.01 - zF); s.lineTo(-SX, RB0 + 0.01 - zF); s.closePath();
  s.holes.push(roundRect(new THREE.Path(), -OPEN.x, OPEN.x, OPEN.f0, OPEN.f1, OPEN.r, OPEN.r));
  cab.add(prism("TopCover", dense(s, 0.03), flat(J), (x, xf) => coverTop(xf) - 0.0008, coverM, { caps: ["top"] }));
}
// the rear band behind the lid: its front face carries the hinges; "8.0kg" printed on top
{
  const prof = [[RB0, J], [RB0, H - 0.019], [RB0 + 0.019 / 2.5, H]];
  for (let i = 0; i <= 8; i++) { const xf = RBK + ((BODY - RBK) * i) / 8; prof.push([xf, rbTop(xf)]); }
  prof.push([BODY, J]);
  cab.add(sideSlab("RearBand", prof, W, coverM));
}
{
  // "8.0kg" at the rear band's left (LG's front.jpg of T80SPMB1Z, as the T70's 7.0kg), 0.030 x 0.013 m
  const k = mesh("Capacity", flipV(new THREE.PlaneGeometry(0.030, 0.013)), kgM, -0.228, H + 0.0006, xz(0.475));
  k.rotation.x = -Math.PI / 2;
  cab.add(k);
  // the hinge blocks, 200 mm either side of the centre (top_open.jpg)
  for (const sx of [-1, 1]) cab.add(box("Hinge", 0.022, 0.013, 0.012, knuckleM, sx * 0.2, RIM + 0.0055, xz(RB0 - 0.005)));
}

// ── the control panel's raised parts: nine keys (their tops printed with the panel), the Power and Start rings, two screw caps ──
{
  // key centres from the fitted drawing (panel_layout.json, mm): Soil Level, Beeper, Water Level, Wash, Rinse, Spin, Program 1 and 2,
  // Delay; the keys are the T12's in proportion to the print (0.915: 30 mm pitch here against 33)
  const keys = LAYOUT.keys;
  const geos = keys.map(([kx, ks]) => {
    const w = LAYOUT.keyW / 1000, h = LAYOUT.keyH / 1000, r = 0.0028;
    const sh = new THREE.Shape();
    sh.moveTo(-w / 2 + r, -h / 2); sh.lineTo(w / 2 - r, -h / 2); sh.absarc(w / 2 - r, -h / 2 + r, r, -Math.PI / 2, 0, false);
    sh.lineTo(w / 2, h / 2 - r); sh.absarc(w / 2 - r, h / 2 - r, r, 0, Math.PI / 2, false);
    sh.lineTo(-w / 2 + r, h / 2); sh.absarc(-w / 2 + r, h / 2 - r, r, Math.PI / 2, Math.PI, false);
    sh.lineTo(-w / 2, -h / 2 + r); sh.absarc(-w / 2 + r, -h / 2 + r, r, Math.PI, 1.5 * Math.PI, false);
    const g = new THREE.ExtrudeGeometry(sh, { depth: 0.0014, bevelEnabled: false, curveSegments: 3 });
    g.translate(kx / 1000, ks / 1000, -0.0002);
    const p = g.attributes.position, uv = g.attributes.uv;
    // the key's top printed from the decal piece that holds it, in that piece's own UVs
    const [ku] = PANEL_UV(kx / 1000, ks / 1000);
    const piece = Object.keys(DECALS).find((k) => DECALS[k].rect[0] <= ku && ku < DECALS[k].rect[2]);
    if (!piece) throw new Error(`key at ${kx} mm is on no print decal`);
    const [u0, v0, u1, v1] = DECALS[piece].rect;
    for (let i = 0; i < p.count; i++) {
      const [u, v] = PANEL_UV(p.getX(i), p.getY(i));
      if (u < u0 || u > u1 || v < v0 || v > v1) throw new Error(`key at ${kx} mm crosses the edge of decal ${piece}`);
      uv.setXY(i, (u - u0) / (u1 - u0), (v - v0) / (v1 - v0));
    }
    g.userData.piece = piece;
    return g.applyMatrix4(onPanel);
  });
  for (const piece of new Set(geos.map((g) => g.userData.piece))) {
    const gs = geos.filter((g) => g.userData.piece === piece);
    cab.add(mesh(`PanelKeys_${piece}`, mergeVertices(mergeGeometries(gs), 1e-6), root.getObjectByName(`PrintDecal_${piece}`).material));
  }
  // the chrome rings round Power and Start/Pause (top_open.jpg, panel_layout.json: x, s, radius in mm)
  const rings = LAYOUT.rings.map(([rx, rs, rr]) => {
    const g = new THREE.TorusGeometry(rr / 1000, 0.0009, 8, 48);
    g.scale(1, 1, 0.8);
    g.translate(rx / 1000, rs / 1000, 0.0003);
    return g.applyMatrix4(onPanel);
  });
  cab.add(mesh("PanelRings", mergeGeometries(rings), chromeM));
  const caps = LAYOUT.caps.map(([cx, cs]) => {
    const g = new THREE.SphereGeometry(LAYOUT.capR / 1000, 20, 8, 0, Math.PI * 2, 0, Math.PI / 2);
    g.rotateX(Math.PI / 2); g.scale(1, 1, 0.3);
    g.translate(cx / 1000, cs / 1000, -0.0003);
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
  const ring = new THREE.LatheGeometry([[ringR, -0.001], [0.16, -0.003], [lipR, -0.009], [lipR - 0.002, -0.022], [0.163, -0.032], [drumR + 0.002, -0.04]].map(([r, y]) => new THREE.Vector2(r, y)), 96);
  cab.add(mesh("TubRing", ring, ringM, 0, DECK, zc));
  // drum wall, inward-facing: LG's Punch + 3 steel, 96 mm tiles, 14 round
  const g = new THREE.CylinderGeometry(drumR, drumR, drumDepth, 96, 1, true);
  const uv = g.attributes.uv;
  const uRep = 14, vRep = drumDepth / ((2 * Math.PI * drumR) / uRep);
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * uRep, 1 - uv.getY(i) * vRep);
  inward(g);
  cab.add(mesh("PunchDrum", g, drumM, 0, drumTop - drumDepth / 2, zc));
  // the floor and the pulsator, mapped straight down with LG's drum photo: pulsator.jpg's 256 px radius is RM. The pulsator is
  // 0.78 of the drum's radius (drum.jpg: rim 228 px, the wall's foot about 300 px; the T12 the same)
  const RP = 0.156, RM = (RP * 256) / 194;
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
  const tb = [-104, 17, 136].map((deg) => {
    const a = (deg * Math.PI) / 180, r = (126 / 194) * RP;
    const c = new THREE.CylinderGeometry(0.031, 0.033, 0.01, 32);
    c.translate(r * Math.cos(a), 0.0105 - 0.0035 * (r / RP), r * Math.sin(a));
    return planar(c);
  });
  const cc = new THREE.SphereGeometry(0.034, 32, 10, 0, Math.PI * 2, 0, Math.PI / 2); cc.scale(1, 0.4, 1); cc.translate(0, 0.011, 0);
  cab.add(mesh("Turbines", mergeGeometries([...tb, planar(cc)]), pulsM, 0, drumFloor, zc));
  // the grey strip on the drum wall at the left, carrying the blue lint filter (drum.jpg, top_open.jpg: no other strip shows)
  for (const deg of [FA]) {
    const a = (deg * Math.PI) / 180;
    const s = box("DrumStrip", 0.07, drumDepth - 0.01, 0.01, stripM, Math.cos(a) * (drumR - 0.006), drumFloor + 0.005 + (drumDepth - 0.01) / 2, zc + Math.sin(a) * (drumR - 0.006));
    s.rotation.y = -a - Math.PI / 2;
    cab.add(s);
  }
  // the lint filter: an oval on the strip, about 68 x 85 mm (drum.jpg, ESTIMATED), facing the drum's centre
  const lf = new THREE.CylinderGeometry(0.034, 0.034, 0.008, 40); lf.scale(1, 1, 1.25); lf.rotateX(Math.PI / 2); lf.rotateY(-Math.PI / 2 - FAR);
  cab.add(mesh("LintFilter", lf, filterM, Math.cos(FAR) * (drumR - 0.015), drumTop - 0.1, zc + Math.sin(FAR) * (drumR - 0.015)));
  // the bleach dispenser's dark cap on the deck at the front left (drum.jpg, top_open.jpg)
  // (the T70's blue softener cap on the ring is left out: no photo of this series shows one; the blue part here is the lint filter)
  cab.add(cyl("BleachCap", 0.03, 0.031, 0.008, darkM, -0.19, DECK + 0.004, xz(0.155), 40));
  const tri = new THREE.Shape([new THREE.Vector2(0, 0.009), new THREE.Vector2(-0.008, -0.006), new THREE.Vector2(0.008, -0.006)]);
  const tg = new THREE.ShapeGeometry(tri); tg.rotateX(-Math.PI / 2);
  cab.add(mesh("BleachMark", tg, markM, -0.19, DECK + 0.0085, xz(0.155)));
}

// ── detergent drawer: at the back of the well under the rear band; it slides out toward the front ──
const det = group("DetergentDrawer", 0, DECK + 0.002, xz(0.375));
{
  const fw = 0.15, fh = 0.042;
  det.add(mesh("DrawerFace", flipV(new THREE.BoxGeometry(fw, fh, 0.006)), [drawerM, drawerM, drawerM, drawerM, detM, drawerM], 0, fh / 2, -0.003));
  // the tray behind the face: floor, walls, and the divider between the detergent cup and the narrow one at the right
  const tz = -0.006 - 0.06;
  det.add(box("DrawerTray", fw - 0.006, 0.003, 0.12, drawerM, 0, 0.0015, tz));
  for (const x of [-fw / 2 + 0.003, fw / 2 - 0.003]) det.add(box("DrawerWall", 0.003, 0.028, 0.12, drawerM, x, 0.014, tz));
  det.add(box("DrawerWall", fw - 0.006, 0.028, 0.003, drawerM, 0, 0.014, tz - 0.0585));
}
cab.add(det);

// ── lid: hinged at its back edge, a chrome crescent handle at the front, a black frame round a tinted glass window ──
const lid = group("Lid", 0, PIV[0], xz(PIV[1]));
{
  const bot = (x, xf) => coverTop(xf) + 0.002;
  // the back edge rounds down 7 mm under the top, into the notch in front of the rear band, so it clears the band as it turns;
  // the frame is flat on top, its back edge sloping down; the handle in front of it curves down to the panel.
  // The T12's lid in this model's proportions (LG's side photos of this series: the lid's top 5-10 mm under the rear band, the
  // handle's nose at the top): the handle is a crescent, 33 mm deep at the middle, narrowing to 10 mm at the ends (ESTIMATED).
  const top = (x, xf) => Math.min(H - 0.01 + (xf - 0.15) * 0.0316, H - 0.007 + (LB - xf) * 1.5);
  const cBack = (x) => Math.max(bCurve(x) + 0.01, 0.129 + 0.1 * x * x), nose = (x) => (bCurve(x) + 0.002 + cBack(x)) / 2;
  const rise = (x, xf) => { const b = bot(x, xf) + 0.012, t = Math.min(1, Math.max(0, (xf - bCurve(x) - 0.002) / (nose(x) - bCurve(x) - 0.002))); return b + (H - b) * t; };
  const fall = (x, xf) => { const t = Math.min(1, Math.max(0, (xf - nose(x)) / (cBack(x) - nose(x)))); return H + (top(x, cBack(x)) - H) * t; };
  const band = (f0, f1) => { const sh = shapeOf(across(f0, -LX, LX)); across(f1, LX, -LX).forEach((p) => sh.lineTo(p.x, p.y)); return sh; };
  // the handle is gloss black with a thin chrome line along its crest, as the T70's (LG's front.jpg of T80SPMB1Z; the T12's is chrome
  // all over): seen from the front the line is 3-4 mm tall (3-5 px at 1.1 px/mm); here a 4.5 mm strip at the crest, its front face
  // ~3 mm proud of the rising handle, 0.4 mm above the top (ESTIMATED)
  // metal 1 over near-black as the lid frame (a gloss dielectric here faced the gate's bright room and read as a silver band)
  const handleBlackM = mat("LidHandleBlack", 0x0c0c0d, { metal: 1, rough: 0.38 });
  const lm = prism("LidHandle", band((x) => bCurve(x) + 0.002, nose), bot, rise, handleBlackM, { bev: 0.0015, segs: 1 });
  const lm2 = prism("LidHandleRear", band(nose, cBack), bot, fall, handleBlackM, { bev: 0.0015, segs: 1 });
  const lm3 = prism("LidHandleTrim", band((x) => nose(x) - 0.0015, (x) => nose(x) + 0.003), () => H - 0.006, () => H + 0.0004, chromeM, { bev: 0.0006, segs: 1 });
  const fr = shapeOf(across(cBack, -LX, LX));
  fr.lineTo(LX, LB - 0.012 - zF); fr.absarc(LX - 0.012, LB - 0.012 - zF, 0.012, 0, Math.PI / 2, false);
  fr.lineTo(-LX + 0.012, LB - zF); fr.absarc(-LX + 0.012, LB - 0.012 - zF, 0.012, Math.PI / 2, Math.PI, false);
  fr.closePath();
  fr.holes.push(roundRect(new THREE.Path(), -0.228, 0.228, 0.163, 0.366, 0.03, 0.03));
  const fm = prism("LidFrame", dense(fr, 0.03), bot, top, lidM, { bev: 0.0025, segs: 1 });
  const pane = mesh("LidWindow", new THREE.PlaneGeometry(0.456, 0.203), glassM, 0, top(0, 0.2645) - 0.0006, xz(0.2645));
  pane.rotation.x = -Math.PI / 2 + Math.atan(0.0316);                  // follows the frame's slope
  for (const m of [lm, lm2, lm3, fm, pane]) { m.position.y -= PIV[0]; m.position.z -= xz(PIV[1]); lid.add(m); }
}
root.add(lid);

// ── the back: the water inlet at the top, the power cord with its 3-pin plug, the drain outlet and hose (LG's manual) ──
{
  // the inlet: a blue collar on the rear band's back, its threaded fitting reaching LG's 625 mm depth
  // the inlet: a blue collar on the rear band's back, 50 mm right of the centre at 840 mm (back.jpg), its threaded fitting reaching
  // LG's 560 mm depth
  cab.add(cyl("InletCollar", 0.017, 0.017, 0.004, inletM, -0.044, 0.868, zB - 0.002, 32).rotateX(Math.PI / 2));
  cab.add(cyl("InletThread", 0.0115, 0.0115, 0.012, threadM, -0.044, 0.868, -D / 2 + 0.006, 24).rotateX(Math.PI / 2));
  // the cord leaves the top cover at the back right (back.jpg: its loop at x 0.155 m, 835 mm), runs down the cabinet's back edge
  // through LG's two blue clips (back.jpg: x 0.22 m at 685 and 440 mm); its route below them and the plug are ESTIMATED
  const cp = [[0.128, 0.852], [0.19, 0.853], [0.23, 0.83], [0.236, 0.716], [0.236, 0.58], [0.236, 0.454], [0.23, 0.37], [0.215, 0.322]].map(([x, y]) => new THREE.Vector3(x, y, zB - 0.006));
  cab.add(mesh("PowerCord", new THREE.TubeGeometry(new THREE.CatmullRomCurve3(cp, false, "centripetal"), 60, 0.0042, 6, false), cordM));
  cab.add(box("Plug", 0.036, 0.046, 0.022, plugM, 0.212, 0.297, zB - 0.013));
  for (const [dx, dz, r] of [[0, 0.004, 0.0035], [-0.0095, -0.004, 0.0026], [0.0095, -0.004, 0.0026]]) cab.add(cyl("PlugPin", r, r, 0.018, pinM, 0.212 + dx, 0.265, zB - 0.013 + dz, 10));
  // the drain outlet at the bottom of the back panel (back.jpg: 5 mm left of the centre, 128 mm up), and the drain hose pushed onto
  // it, turned toward the right (the manual; LG's photos show no hose)
  cab.add(cyl("Grommet", 0.017, 0.017, 0.016, grommetM, -0.003, 0.116, zB - 0.008, 32).rotateX(Math.PI / 2));
  const hp = [[-0.003, 0.116, zB - 0.02], [-0.003, 0.085, zB - 0.03], [0.025, 0.03, zB - 0.03], [0.12, 0.0135, zB - 0.03], [0.21, 0.0135, zB - 0.028]].map(([x, y, z]) => new THREE.Vector3(x, y, z));
  cab.add(mesh("DrainHose", new THREE.TubeGeometry(new THREE.CatmullRomCurve3(hp, false, "centripetal"), 60, 0.0125, 12, false), hose));
}

// ── the lid's opening: LG's page gives 1225 mm high with the lid open (for a 925 mm machine; see the header). The entry's angle is checked here: the height it gives, and
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
  console.log(`lid open ${deg} deg: ${(h * 1000).toFixed(1)} mm high (LG's page: 1225), ${(pen * 1000).toFixed(1)} mm into the rear band`);
}

const clips = stateClips(root, parts);
saveZones(PRODUCTS, ID, root, parts);
await exportGLB(root, clips, OUT, {
  PanelFace: `${T}/panel.jpg`, ...printTex, BackPanel: `${T}/back.jpg`, PunchDrum: `${T}/drum.jpg`,
  Pulsator: `${T}/pulsator.jpg`, LintFilter: `${T}/filter.jpg`, DrawerFace: `${T}/detergent.jpg`, Capacity: `${T}/kg8.png`,
}, { dir: `${TEX}/grain`, materials: {
  // Grain (BENCHMARK.md section 10): the Middle Black cabinet the peel, as LG's other dark washers; the gloss black top cover
  // the soft peel; the matt moulded plinth the strong peel; nothing on the panel print, the lid's glass or the labels
  Body: { type: "peel" }, TopCover: { type: "peel_soft" }, Plinth: { type: "peel_strong" },
} });
