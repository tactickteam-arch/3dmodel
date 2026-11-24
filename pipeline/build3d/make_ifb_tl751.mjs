// IFB TL751MS2SID, 7.5 kg top-load washing machine with Ai, Power Steam and the Eco Inverter Motor, Mystic Silver.
// Built to IFB's size, 543 W x 946 H x 575 D mm, 31 kg (IFB's product page; the same on IFB's store listing), and to IFB's own
// gallery for this model: the right-side photo gives the profile (a silver cabinet on a black plinth, the top cover sloping up
// toward the back, the gloss black control housing behind the lid with its print on a 20 degree face); the straight-down
// photo gives the lid (black glass with a tinted window), the hinge bar and every mark on the control panel; the lid-open
// photo gives the well, the drum, the triadic pulsator, the lint tower and the ActivMix tray. IFB has no photo of the back.
// The category's references are make_samsung_wa70.mjs and make_lg_t12.mjs; the helpers are copied from make_lg_t12.mjs. Every
// size IFB does not publish is measured off IFB's photos and scaled to the published size (private/research/ifb_tl751/NOTES.md).
// usage: node make_ifb_tl751.mjs <entry.json> <tex dir> <out.glb>
import { THREE, mat, mesh, box, group, flipV, inward, stateClips, exportGLB, productParts, saveZones } from "./lib.mjs";
import { mergeVertices, mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { NodeIO } from "@gltf-transform/core";
import { ALL_EXTENSIONS, KHRMaterialsClearcoat } from "@gltf-transform/extensions";
import fs from "node:fs";

const [PRODUCTS, TEX, OUT] = process.argv.slice(2);
const ID = "ifb-tl751ms2sid";
const T = `${TEX}/ifb_tl751`;

// ── size (metres); z runs front (+) to back (-), xf is the distance from the front edge ──
const W = 0.543, H = 0.946, D = 0.575;
const zF = D / 2;
const xz = (xf) => zF - xf;
const BODY = 0.545;                 // the cabinet; the control housing behind it reaches 557 mm, its two brackets IFB's 575 mm
const FT = 0.016, PLT = 0.059;      // the black plinth: its underside (on its feet and wheels) and its top
const SEAM = 0.791;                 // the joint between the cabinet and the top cover (side and front photos)
const coverTop = (xf) => 0.858 + 0.0654 * xf;        // the top cover rises toward the back (side photo)
// the control housing: a step up behind the hinge bar, then the print face rising at 20.3 degrees to the peak at 946 mm
const HF = 0.448, PF0 = [0.452, 0.915], PF1 = [0.536, 0.946];
const TH = Math.atan2(PF1[1] - PF0[1], PF1[0] - PF0[0]), CT = Math.cos(TH), ST = Math.sin(TH);
const OPEN = { x: 0.24, f0: 0.045, f1: 0.44, r: 0.03 };  // the opening under the lid
const DECK = 0.835;                 // the well's floor round the tub ring
const RC = (OPEN.f0 + OPEN.f1) / 2, zc = xz(RC);         // the tub ring's centre, under the opening's centre
const ringR = 0.215, drumR = 0.205, drumTop = DECK - 0.032, drumFloor = 0.43, drumDepth = drumTop - drumFloor;
const LX = 0.2705, LF = 0.004, LB = 0.4395, LT = 0.024;   // the lid: half-width, front and back edges, thickness
const lidFront = (x) => 0.002 + 0.008 * (x / 0.235) ** 2;  // its front edge bows forward at the middle (top photo)
const PIV = [coverTop(LB) + 0.003 + LT, LB];            // the hinge: the lid's top back edge (height, distance from the front)

// ── materials ──
// Mystic Silver: neutral grey with fine silver flecks (IFB's photos read R = G = B, 0.38-0.62 of white on the front)
const silverM = mat("Mystic", 0xffffff, { rough: 0.38, metal: 0.35 });
const sideM = mat("MysticSide", 0xffffff, { rough: 0.38, metal: 0.35 });
const plinthM = mat("Plinth", 0x161617, { rough: 0.7 });
const footM = mat("Foot", 0x1d1d1e, { rough: 0.7 });
const wheelM = mat("Wheel", 0x2a2a2b, { rough: 0.6 });
const seamM = mat("Seam", 0x2b2b2d, { rough: 0.6 });
// the control housing and its print: gloss black (the print's own background, 14/14/15); the print pieces share its values
const PANEL = { rough: 0.2, metal: 0.2 };
const panelM = mat("PanelFace", 0xffffff, PANEL);
const chromeM = mat("Chrome", 0xc6c8cb, { metal: 0.9, rough: 0.22 });
const bracketM = mat("Bracket", 0x9a9c9f, { metal: 0.7, rough: 0.4 });
const valveM = mat("InletValve", 0x141415, { rough: 0.45 });
// the lid: black glass. As LG T12's lid (look pass 5 Nov 2026), metal 1 over near-black keeps it dark at grazing angles; a
// clear coat is laid over it after export so the studio's lights show in it as sharp highlights, as on glass
const lidM = mat("LidGlass", 0x0b0b0c, { metal: 1, rough: 0.45 });
const windowM = mat("LidWindow", 0xffffff, { metal: 1, rough: 0.4, opacity: 0.999, side: THREE.DoubleSide });
const temperedM = mat("LidPrint", 0xffffff, { rough: 0.3, opacity: 0.999 });
const isiM = mat("LidISI", 0xffffff, { rough: 0.3, opacity: 0.999 });
const wellM = mat("WellGrey", 0x8e8f92, { rough: 0.45, side: THREE.DoubleSide });   // the well's walls (lid-open photo, 140-160)
const ringM = mat("TubRing", 0xa9aaad, { rough: 0.45, side: THREE.DoubleSide });
const drumM = mat("Drum", 0xffffff, { rough: 0.3, metal: 0.45, side: THREE.DoubleSide });
const floorM = mat("DrumFloor", 0x9fa1a4, { rough: 0.35, metal: 0.4 });
const pulsM = mat("Pulsator", 0xffffff, { rough: 0.45 });
const padM = mat("PulsatorPad", 0x3a3b3e, { rough: 0.45 });
const filterM = mat("LintFilter", 0xffffff, { rough: 0.4 });
const greyM = mat("FilterFrame", 0x7d7e81, { rough: 0.45 });
const trayM = mat("ActivMixFace", 0xffffff, { rough: 0.4 });
const trayBodyM = mat("ActivMixTray", 0x8a8b8e, { rough: 0.45 });
const bleachM = mat("BleachInlet", 0x47484b, { rough: 0.45 });

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
    } else if (caps.includes("nowalls")) continue;
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

// every edge of a shape cut into pieces no longer than step, so a cap that bends follows its surface (make_lg_t12.mjs)
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

// a side profile (points [xf, y]) extruded across a width w, centred on x = 0 (make_lg_t12.mjs's sideSlab)
function sideSlab(name, pts, w, material) {
  const sh = new THREE.Shape();
  pts.forEach(([xf, y], i) => (i ? sh.lineTo(xf, y) : sh.moveTo(xf, y)));
  const g = new THREE.ExtrudeGeometry(sh, { depth: w, bevelEnabled: false, curveSegments: 6 });
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
const V = (x, xf) => new THREE.Vector2(x, xf - zF);

// The cabinet's walls: the plan outline (points [x, xf], anticlockwise seen from above) stood up from y0 to top(xf), cut into
// the walls that face the front, the sides and the back, each with its own texture coordinates. Normals are the outline's.
function walls(outline, y0, top) {
  const parts = { front: [], side: [], back: [] };
  const n = outline.length;
  const nrm = outline.map((_, i) => {
    const a = outline[(i - 1 + n) % n], b = outline[(i + 1) % n];
    const dx = b[0] - a[0], df = b[1] - a[1], l = Math.hypot(dx, df);
    return [-df / l, -dx / l];                      // (nx, nz): outward for an anticlockwise outline (z = zF - xf, so dz = -df)
  });
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    const mx = (nrm[i][0] + nrm[j][0]) / 2, mz = (nrm[i][1] + nrm[j][1]) / 2;
    const kind = Math.abs(mx) > 0.97 ? "side" : mz > 0 ? "front" : "back";
    parts[kind].push([i, j]);
  }
  const make = (segs, uvf) => {
    const P = [], N = [], U = [], I = [];
    for (const [i, j] of segs) {
      const base = P.length / 3;
      for (const k of [i, j]) {
        const [x, xf] = outline[k];
        for (const y of [y0, top(xf)]) {
          P.push(x, y, xz(xf)); N.push(nrm[k][0], 0, nrm[k][1]); U.push(...uvf(x, xf, y));
        }
      }
      I.push(base, base + 1, base + 2, base + 1, base + 3, base + 2);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(P, 3));
    g.setAttribute("normal", new THREE.Float32BufferAttribute(N, 3));
    g.setAttribute("uv", new THREE.Float32BufferAttribute(U, 2));
    g.setIndex(I);
    return g;
  };
  return { parts, make };
}

const root = group("IFBTL751");

// ── base: the black plinth on two front feet and IFB's in-built wheels at the back ──
root.add(prism("Plinth", roundRect(new THREE.Shape(), -W / 2 + 0.004, W / 2 - 0.004, 0.004, BODY - 0.004, 0.018, 0.008), flat(FT), flat(PLT), plinthM, { bev: 0.003, caps: ["bottom"], segs: 1 }));
for (const sx of [-1, 1]) {
  root.add(cyl("Foot", 0.017, 0.019, FT + 0.002, footM, sx * 0.208, (FT + 0.002) / 2, xz(0.068), 20));
  const wh = cyl("Wheel", 0.016, 0.016, 0.014, wheelM, sx * 0.208, 0.016, xz(0.526), 20);
  wh.rotation.z = Math.PI / 2;
  root.add(wh);
}

// ── cabinet and top cover: Mystic Silver, one shell from the plinth to the cover's sloping top ──
const outline = (() => {
  const s = roundRect(new THREE.Shape(), -W / 2, W / 2, 0, BODY, 0.02, 0.01);
  const pts = s.extractPoints(8).shape.map((p) => [p.x, p.y + zF]);
  if (Math.hypot(pts[0][0] - pts[pts.length - 1][0], pts[0][1] - pts[pts.length - 1][1]) < 1e-9) pts.pop();
  // roundRect runs clockwise in (x, xf); the walls want anticlockwise seen from above (x right, z toward the viewer)
  const out = [];
  for (const p of pts) {
    const last = out[out.length - 1];
    if (last && Math.hypot(p[0] - last[0], p[1] - last[1]) < 1e-9) continue;
    out.push(p);
  }
  // long straight runs cut every 4 cm so the walls follow the sloping top exactly
  const dd = [];
  for (let i = 0; i < out.length; i++) {
    const a = out[i], b = out[(i + 1) % out.length], k = Math.max(1, Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / 0.04));
    for (let q = 0; q < k; q++) dd.push([a[0] + ((b[0] - a[0]) * q) / k, a[1] + ((b[1] - a[1]) * q) / k]);
  }
  return dd;
})();
{
  // check the winding: the walls' normals must point out
  let area = 0;
  for (let i = 0; i < outline.length; i++) { const a = outline[i], b = outline[(i + 1) % outline.length]; area += a[0] * xz(b[1]) - b[0] * xz(a[1]); }
  if (area < 0) outline.reverse();
}
// the walls stand 0.4 mm above the top cover's edge, so no hairline shows between them seen over the edge
const { parts: wallParts, make: makeWalls } = walls(outline, PLT, (xf) => coverTop(xf) + 0.0004);
// the front and back: the Mystic tile (512 px for 128 mm); the sides: IFB's side photo, xf 0-545 mm, 59-896 mm up
const TILE = 0.128;
const tileUV = (x, xf, y) => [(x + W / 2 + (xf < 0.3 ? xf : BODY - xf)) / TILE, (H - y) / TILE];
const sideUV = (x, xf, y) => [xf / BODY, (0.896 - y) / (0.896 - PLT)];
const cabinet = mesh("Cabinet", makeWalls(wallParts.front, tileUV), silverM);
root.add(cabinet);
root.add(mesh("CabinetSide", makeWalls(wallParts.side, sideUV), sideM));
root.add(mesh("CabinetBack", makeWalls(wallParts.back, tileUV), silverM));
// the seam across the front where the top cover sits on the cabinet (the side photo has it in its texture)
root.add(box("Seam", W - 0.04, 0.0012, 0.0008, seamM, 0, SEAM, zF + 0.0001));
// the top cover round the opening, from the front edge back to the hinge bar
{
  const s = roundRect(new THREE.Shape(), -W / 2, W / 2, 0, HF, 0.02, 0);
  s.holes.push(roundRect(new THREE.Path(), -OPEN.x, OPEN.x, OPEN.f0, OPEN.f1, OPEN.r, OPEN.r));
  root.add(prism("TopCover", dense(s, 0.02), flat(SEAM), (x, xf) => coverTop(xf), silverM, { caps: ["top", "nowalls"], uvf: (x, xf) => [(x + W / 2) / TILE, xf / TILE] }));
}

// ── the control housing behind the lid: gloss black, the print on its sloped face ──
{
  const prof = [[0.544, coverTop(0.544) - 0.002], [0.544, 0.8], [0.557, 0.8], [0.557, 0.92], [0.553, 0.935], [0.546, 0.944], PF1, PF0, [HF, 0.915], [HF, coverTop(HF) - 0.0005]];
  root.add(sideSlab("PanelHousing", prof.reverse(), W - 0.002, panelM));
  // the hinge bar across the front of the housing, brushed metal (top photo)
  root.add(box("HingeBar", W - 0.04, 0.0095, 0.0075, chromeM, 0, 0.892, xz(0.4437)));
  // the print: IFB's panel drawn again at 12 px per mm (tex_ifb_tl751.py), five pieces laid 0.9 mm over the face
  const lay = JSON.parse(fs.readFileSync(`${T}/panel.json`, "utf8"));
  for (const [k, [x0, s0, x1, s1]] of Object.entries(lay.pieces)) {
    const w = (x1 - x0) / 1000, h = (s1 - s0) / 1000, xc = (x0 + x1) / 2000 - W / 2, sc = (s0 + s1) / 2000;
    const m = mesh(`PanelPrint_${k}`, flipV(new THREE.PlaneGeometry(w, h)), mat(`PanelPrint_${k}`, 0xffffff, PANEL),
      xc, PF0[1] + sc * ST + 0.0009 * CT, xz(PF0[0] + sc * CT) + 0.0009 * ST);
    m.rotation.x = -(Math.PI / 2 - TH);
    root.add(m);
  }
  // at the back: the two brackets at the housing's ends and the two water inlet valves (top and side photos)
  for (const sx of [-1, 1]) {
    root.add(box("Bracket", 0.021, 0.026, D - 0.557, bracketM, sx * 0.2395, 0.813, xz((0.557 + D) / 2)));
    const v = cyl("InletValve", 0.015, 0.015, 0.016, valveM, sx * 0.034, 0.86, xz(0.557 + 0.008), 28);
    v.rotation.x = Math.PI / 2;
    root.add(v);
  }
}

// ── the well: grey walls down to the deck, the tub ring, the drum, the triadic pulsator, the lint tower ──
{
  const wall = roundRect(new THREE.Shape(), -OPEN.x, OPEN.x, OPEN.f0, OPEN.f1, OPEN.r, OPEN.r);
  const ix = OPEN.x - 0.004, i0 = OPEN.f0 + 0.004, i1 = OPEN.f1 - 0.004, ir = OPEN.r - 0.004;
  wall.holes.push(roundRect(new THREE.Path(), -ix, ix, i0, i1, ir, ir));
  root.add(prism("WellWall", wall, flat(DECK - 0.002), (x, xf) => coverTop(xf) - 0.0005, wellM, { caps: ["top"] }));
  // the deck either side of the tub ring: the opening less the ring's circle (make_lg_t12.mjs)
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
  dg.computeVertexNormals();
  dg.translate(0, DECK, 0);
  root.add(mesh("Deck", dg, wellM));
  // the tub ring: a light grey collar, its lip turned down into the drum
  const ring = new THREE.LatheGeometry([[ringR, -0.001], [0.198, -0.003], [0.19, -0.009], [0.188, -0.02], [0.196, -0.028], [drumR + 0.002, -0.032]].map(([r, y]) => new THREE.Vector2(r, y)), 96);
  root.add(mesh("TubRing", ring, ringM, 0, DECK, zc));
  // the drum wall, inward-facing: IFB's drum of raised drops, 96 mm tiles, 13 round
  const g = new THREE.CylinderGeometry(drumR, drumR, drumDepth, 96, 1, true);
  const uv = g.attributes.uv;
  const uRep = 13, vRep = drumDepth / ((2 * Math.PI * drumR) / uRep);
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * uRep, 1 - uv.getY(i) * vRep);
  inward(g);
  root.add(mesh("Drum", g, drumM, 0, drumTop - drumDepth / 2, zc));
  // the floor round the pulsator, and the pulsator mapped straight down with pulsator.jpg (300 mm across)
  const fl = new THREE.CircleGeometry(drumR, 72); fl.rotateX(-Math.PI / 2);
  root.add(mesh("DrumFloor", fl, floorM, 0, drumFloor, zc));
  const RP = 0.15;
  const planar = (geo) => {
    const p = geo.attributes.position, u = geo.attributes.uv;
    for (let i = 0; i < u.count; i++) u.setXY(i, 0.5 + p.getX(i) / (2 * RP), 0.5 + p.getZ(i) / (2 * RP));
    return geo;
  };
  const dish = new THREE.LatheGeometry([[0, 0.016], [0.04, 0.0155], [0.1, 0.011], [RP - 0.004, 0.004], [RP, 0]].map(([r, y]) => new THREE.Vector2(r, y)), 72);
  root.add(mesh("Pulsator", planar(dish), pulsM, 0, drumFloor + 0.001, zc));
  // its three round pads and the centre cap (lid-open photo)
  const pads = [90, 210, 330].map((deg) => {
    const a = (deg * Math.PI) / 180, r = 0.088;
    const c = new THREE.CylinderGeometry(0.026, 0.028, 0.008, 28);
    c.translate(r * Math.cos(a), 0.0115 + 0.002, r * Math.sin(a));
    return c;
  });
  const cc = new THREE.SphereGeometry(0.032, 28, 8, 0, Math.PI * 2, 0, Math.PI / 2); cc.scale(1, 0.35, 1); cc.translate(0, 0.0155, 0);
  root.add(mesh("PulsatorPads", mergeGeometries([...pads, cc]), padM, 0, drumFloor + 0.001, zc));
  // the lint tower on the drum wall at the back: a grey frame round a slotted window (lid-open photo)
  const ft = drumTop - 0.02 - 0.075;
  const fb = new THREE.BoxGeometry(0.052, 0.15, 0.012);
  flipV(fb);
  const lf = mesh("LintFilter", fb, [greyM, greyM, greyM, greyM, filterM, greyM], 0, ft, zc - drumR + 0.008);
  root.add(lf);
  // the bleach inlet on the deck at the front left (lid-open photo)
  root.add(cyl("BleachInlet", 0.017, 0.015, 0.006, bleachM, -0.205, DECK + 0.002, xz(0.08), 28));
}

// ── the ActivMix tray: the panel at the back of the well; it slides out toward the front ──
const det = group("DetergentDrawer", 0, DECK + 0.002, xz(0.432));
{
  const fw = 0.2, fh = 0.04, depth = 0.1;
  det.add(mesh("ActivMixFace", flipV(new THREE.BoxGeometry(fw, fh, 0.006)), [trayBodyM, trayBodyM, trayBodyM, trayBodyM, trayM, trayBodyM], 0, fh / 2, 0));
  const tz = -0.003 - depth / 2;
  const parts = [new THREE.BoxGeometry(fw - 0.008, 0.003, depth).translate(0, 0.0015, tz)];
  for (const x of [-fw / 2 + 0.006, fw / 2 - 0.006, -0.03, 0.03]) parts.push(new THREE.BoxGeometry(0.003, 0.03, depth).translate(x, 0.016, tz));
  parts.push(new THREE.BoxGeometry(fw - 0.008, 0.03, 0.003).translate(0, 0.016, tz - depth / 2 + 0.0015));
  det.add(mesh("ActivMixTray", mergeGeometries(parts), trayBodyM));
}
root.add(det);

// ── lid: black glass, hinged at its top back edge, a tinted window with IFB's dot border and TEMPERED GLASS on its front band ──
const lid = group("Lid", 0, PIV[0], xz(PIV[1]));
{
  const bot = (x, xf) => coverTop(xf) + 0.003;
  const top = (x, xf) => coverTop(xf) + 0.003 + LT;
  const fr = new THREE.Shape();
  const RF = 0.03, RB = 0.006;
  const frontPts = [];
  for (let i = 0; i <= 24; i++) { const x = -LX + RF + ((2 * (LX - RF)) * i) / 24; frontPts.push(V(x, LF + lidFront(x) - lidFront(0))); }
  fr.moveTo(frontPts[0].x, frontPts[0].y);
  frontPts.slice(1).forEach((p) => fr.lineTo(p.x, p.y));
  fr.quadraticCurveTo(LX, LF + lidFront(LX - RF) - lidFront(0) - zF, LX, LF + RF + 0.008 - zF);
  fr.lineTo(LX, LB - RB - zF); fr.absarc(LX - RB, LB - RB - zF, RB, 0, Math.PI / 2, false);
  fr.lineTo(-LX + RB, LB - zF); fr.absarc(-LX + RB, LB - RB - zF, RB, Math.PI / 2, Math.PI, false);
  fr.lineTo(-LX, LF + RF + 0.008 - zF);
  fr.quadraticCurveTo(-LX, LF + lidFront(-LX + RF) - lidFront(0) - zF, frontPts[0].x, frontPts[0].y);
  const WIN = { x: 0.2374, f0: 0.0964, f1: 0.371, r: 0.01 };
  fr.holes.push(roundRect(new THREE.Path(), -WIN.x, WIN.x, WIN.f0, WIN.f1, WIN.r, WIN.r));
  const fm = prism("LidGlass", dense(fr, 0.03), bot, top, lidM, { bev: 0.002, segs: 1 });
  // the window: lid_window.png, tinted (alpha 0.92: IFB's photos show the drum only faintly) with the dot border and the solid band at the front
  const wc = (WIN.f0 + WIN.f1) / 2, slope = Math.atan(0.0654);
  const pane = mesh("LidWindow", flipV(new THREE.PlaneGeometry(2 * WIN.x, (WIN.f1 - WIN.f0) / Math.cos(slope))), windowM, 0, top(0, wc) - 0.0006, xz(wc));
  pane.rotation.x = -Math.PI / 2 + slope;
  // TEMPERED GLASS on the band (120 x 25.9 mm piece), the glass maker's ISI mark at the window's back left corner
  const tg = mesh("LidPrint", flipV(new THREE.PlaneGeometry(0.12, 0.0259)), temperedM, 0, top(0, WIN.f0 + 0.01295) + 0.0003, xz(WIN.f0 + 0.01295));
  tg.rotation.x = -Math.PI / 2 + slope;
  const ic = [(-237 - 195.6) / 2000, (370.5 + 351.7) / 2000];
  const isi = mesh("LidISI", flipV(new THREE.PlaneGeometry(0.0414, 0.0188)), isiM, ic[0], top(0, ic[1]) + 0.0003, xz(ic[1]));
  isi.rotation.x = -Math.PI / 2 + slope;
  for (const m of [fm, pane, tg, isi]) { m.position.y -= PIV[0]; m.position.z -= xz(PIV[1]); lid.add(m); }
}
root.add(lid);

// ── the lid's opening: IFB gives no height with it open. The entry's angle is checked here: the height it gives, and how
// far the open lid would pass into the control housing (must be 0) ──
const parts = productParts(PRODUCTS, ID);
{
  root.updateMatrixWorld(true);
  const pts = [];
  lid.traverse((o) => { if (o.isMesh) { const p = o.geometry.attributes.position; for (let i = 0; i < p.count; i++) pts.push(new THREE.Vector3().fromBufferAttribute(p, i).applyMatrix4(o.matrix)); } });
  const deg = parts.find((p) => p.node === "Lid").angle, a = (deg * Math.PI) / 180;
  // the housing's front, as the height of its face at each distance from the front
  const face = (xf) => (xf < HF ? -1 : xf < PF0[0] ? 0.915 : xf <= PF1[0] ? PF0[1] + (xf - PF0[0]) * Math.tan(TH) : H);
  let h = 0, pen = 0, back = 0;
  for (const v of pts) {
    const y = PIV[0] + v.y * Math.cos(a) - v.z * Math.sin(a), xf = PIV[1] - (v.y * Math.sin(a) + v.z * Math.cos(a));
    h = Math.max(h, y); back = Math.max(back, xf);
    if (xf > HF && y > coverTop(xf)) pen = Math.max(pen, face(xf) - y);
  }
  console.log(`lid open ${deg} deg: ${(h * 1000).toFixed(1)} mm high, back to ${(back * 1000).toFixed(1)} mm from the front, ${(pen * 1000).toFixed(1)} mm into the housing`);
}

const clips = stateClips(root, parts);
saveZones(PRODUCTS, ID, root, parts);
const prints = Object.fromEntries(Object.keys(JSON.parse(fs.readFileSync(`${T}/panel.json`, "utf8")).pieces).map((k) => [`PanelPrint_${k}`, `${T}/print_${k}.jpg`]));
await exportGLB(root, clips, OUT, {
  Mystic: `${T}/mystic.jpg`, MysticSide: `${T}/side.jpg`, PanelFace: `${T}/panel_base.jpg`, ...prints,
  LidWindow: `${T}/lid_window.png`, LidPrint: `${T}/lid_tempered.png`, LidISI: `${T}/lid_isi.png`,
  Drum: `${T}/drum.jpg`, Pulsator: `${T}/pulsator.jpg`, LintFilter: `${T}/filter.jpg`, ActivMixFace: `${T}/tray.jpg`,
}, { dir: `${TEX}/grain`, materials: {
  // Grain (BENCHMARK.md section 10): the painted Mystic Silver the soft peel; the moulded plinth the strong peel; nothing on
  // the panel print, the glass or the labels
  Mystic: { type: "peel_soft" }, MysticSide: { type: "peel_soft" }, Plinth: { type: "peel_strong" },
} });
// the clear coat on the lid's black glass and its window (exportGLB's coat comes only with a grain, and glass has none)
{
  const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
  const doc = await io.readBinary(new Uint8Array(fs.readFileSync(OUT)));
  const ext = doc.getRoot().listExtensionsUsed().find((e) => e.extensionName === "KHR_materials_clearcoat") || doc.createExtension(KHRMaterialsClearcoat);
  const glass = doc.getRoot().listMaterials().filter((m) => m.getName() === "LidGlass" || m.getName() === "LidWindow");
  if (glass.length !== 2) throw new Error("lid materials not found");
  for (const m of glass) m.setExtension("KHR_materials_clearcoat", ext.createClearcoat().setClearcoatFactor(0.5).setClearcoatRoughnessFactor(0.08));
  fs.writeFileSync(OUT, await io.writeBinary(doc));
  console.log(`clear coat on ${glass.map((m) => m.getName())}`);
}
