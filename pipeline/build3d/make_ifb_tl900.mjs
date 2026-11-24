// IFB TL900NB2SID, 9 kg DeepClean top-load washing machine with Eco Inverter Motor and Power Steam, Noir Black.
// Built to IFB's size, 570 W x 950 H x 590 D mm (IFB India's page for this model; the owner's manual TL421PKMAN360 lists
// other models' sizes in its table), and to IFB's own gallery for this model: the front, 3/4, side, lid-open, straight-down
// and room photos give the body (a speckled Noir Black cabinet with three pressed panels on each side, a black base band on
// a recessed plinth, the top cover with the control panel on its 21 degree slope, a tinted glass lid with a chrome nose and
// a gloss black band at the back); the manual's own drawing of this panel gives the print. Every size IFB does not publish is
// measured off IFB's photos and scaled to the published size (private/research/ifb_tl900/NOTES.md).
// The category's reference is make_lg_t12.mjs (a front-panel top loader): prism, dense, roundRect and the lid check are copied
// from it; the flat print decals and the knob follow make_ifb_exec1014.mjs.
// usage: node make_ifb_tl900.mjs <entry.json> <tex dir> <out.glb>
import { THREE, mat, mesh, box, group, inward, stateClips, exportGLB, productParts, saveZones } from "./lib.mjs";
import { mergeVertices, mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import fs from "node:fs";

const [PRODUCTS, TEX, OUT] = process.argv.slice(2);
const ID = "ifb-tl900nb2sid";
const T = `${TEX}/ifb_tl900`;

// ── size (metres); z runs front (+) to back (-), xf is the distance from the front edge ──
const W = 0.57, H = 0.95, D = 0.59;
const zF = D / 2;
const xz = (xf) => zF - xf;
const RCF = 0.025, RCB = 0.006;          // the cabinet's corners seen from above, front and back
const PL0 = 0.02, PL1 = 0.069;           // the recessed plinth, on its feet
const BB1 = 0.1;                         // the black base band, 69 to 100 mm
const J = 0.829;                         // the cabinet's top edge, where the top cover sits on it
const CF = 0.869;                        // the top cover's front face ends here; the control panel rises from it
const COVER = 0.922;                     // the top cover under the lid
const SLOPE = (21 * Math.PI) / 180, CS = Math.cos(SLOPE), SN = Math.sin(SLOPE);
const XS = (COVER - CF) / Math.tan(SLOPE);     // where the slope meets the flat cover, 138 mm back
const RB0 = 0.484;                        // the gloss black band at the back, 484 to 590 mm, 950 mm high
const rbTop = (xf) => (xf < D - 0.025 ? H : H - 0.025 + Math.sqrt(Math.max(0, 0.025 ** 2 - (xf - (D - 0.025)) ** 2)));
const LF = 0.095, LB = 0.476, LX = 0.283; // the lid: its chrome nose, its back edge, its half-width
const LBOT = 0.924;                       // the lid's underside, 2 mm over the cover
const lidTop = (xf) => 0.94 + ((xf - LF) / (LB - LF)) * 0.009;   // 940 mm at the nose, 949 mm at the back
const PIV = [lidTop(LB) - 0.0005, LB - 0.003];                   // the hinge axis: height, distance from the front
const OPEN = { x: 0.25, f0: 0.14, f1: 0.455, r: 0.04 };          // the opening under the lid
const WT = 0.004, ix = OPEN.x - WT, i0 = OPEN.f0 + WT, i1 = OPEN.f1 - WT, ir = OPEN.r - WT;
const DECK = 0.875;                        // the speckled deck round the tub ring
const RC = 0.3, zc = xz(RC);               // the tub's centre
const ringR = 0.208, drumR = 0.19, drumTop = DECK - 0.04, drumFloor = 0.4, drumDepth = drumTop - drumFloor;
const DBACK = 0.386, SHELF = 0.905;        // the back shelf with the detergent tray: its front edge and its top
const SLOT = 0.08;                         // the tray's half-width

// ── materials ──
// Noir Black: a speckled dark grey (sparkle.jpg, IFB's photos read sRGB 52 on the front, 67 on the lit side)
const bodyM = mat("Body", 0xffffff, { rough: 0.42, metal: 0.1 });
const baseM = mat("BaseBand", 0x19191a, { rough: 0.55 });
const plinthM = mat("Plinth", 0x121213, { rough: 0.7 });
const footM = mat("Foot", 0x1a1a1b, { rough: 0.7 });
const wheelM = mat("Wheel", 0x6b6d71, { rough: 0.6 });
const darkM = mat("Dark", 0x0b0b0c, { rough: 0.8 });
const gapM = mat("Seam", 0x111112, { rough: 0.7 });
const pocketM = mat("HandlePocket", 0x0e0e0f, { rough: 0.7 });
const panelGlass = mat("PanelGlass", 0x161618, { rough: 0.3 });           // the print's own black (22, 22, 24); rough 0.3: at 0.15 the gate's side view mirrored the studio white across the slope (look pass 24 Nov)
const bandM = mat("TopCover", 0x0c0c0d, { metal: 0.6, rough: 0.45 });    // gloss black band at the back (LG T12's look pass)
const chromeM = mat("Chrome", 0xc9cbce, { metal: 0.9, rough: 0.22 });
const knobSide = mat("KnobSide", 0xc9ccd0, { metal: 1, rough: 0.22 });
const knobTop = mat("KnobTop", 0xffffff, { metal: 0.7, rough: 0.3 });
const lidM = mat("LidTop", 0x0b0b0c, { metal: 1, rough: 0.5 });
const glassM = mat("LidGlass", 0x060607, { metal: 1, rough: 0.5, opacity: 0.9, side: THREE.DoubleSide });
const lidPrint = mat("LidPrint", 0xffffff, { rough: 0.3, opacity: 0.999 });
const ringM = mat("TubRing", 0xcdcecc, { rough: 0.45, side: THREE.DoubleSide });
const drumM = mat("Drum", 0xffffff, { rough: 0.3, metal: 0.3, side: THREE.DoubleSide });
const pulsM = mat("Pulsator", 0xb3b5b8, { rough: 0.45 });
const filterM = mat("LintFilter", 0xffffff, { rough: 0.45 });
const capM = mat("BleachCap", 0x1d1d1f, { rough: 0.4 });
const detM = mat("DetergentCover", 0xffffff, { rough: 0.35 });
const trayM = mat("Tray", 0x1a1a1c, { rough: 0.5 });
const hingeM = mat("Hinge", 0x1c1c1e, { rough: 0.5 });
const valveM = mat("InletValve", 0x1b1b1d, { rough: 0.5 });
const threadM = mat("InletFitting", 0xb8bbbf, { metal: 0.8, rough: 0.35 });
const cordM = mat("Cord", 0x18191b, { rough: 0.6 });
const plugM = mat("Plug", 0x1c1d1f, { rough: 0.5 });

const cyl = (name, rt, rb, h, m, x, y, z, seg = 24) => mesh(name, new THREE.CylinderGeometry(rt, rb, h, seg), m, x, y, z);
const V2 = (a, b) => new THREE.Vector2(a, b);

// the speckle (sparkle.jpg, a 128 mm tile) laid by box projection in metres, like the grain
const TILE = 0.128;
function speckUV(geo) {
  const p = geo.attributes.position, n = geo.attributes.normal, uv = new Float32Array(p.count * 2);
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i), ax = Math.abs(n.getX(i)), ay = Math.abs(n.getY(i)), az = Math.abs(n.getZ(i));
    const [a, b] = az >= ax && az >= ay ? [x, y] : ax >= ay ? [z, y] : [x, z];
    uv[2 * i] = a / TILE; uv[2 * i + 1] = b / TILE;
  }
  geo.setAttribute("uv", new THREE.BufferAttribute(uv, 2));
  return geo;
}
const body = (name, geo) => mesh(name, speckUV(geo), bodyM);

// A plan shape stood up between two surfaces, bot(x, xf) and top(x, xf) (make_lg_t12.mjs's prism)
function prismGeo(shape, bot, top, { bev = 0, caps = ["top", "bottom"], curve = 8, segs = 2 } = {}) {
  const t0 = 0.02;
  const g0 = new THREE.ExtrudeGeometry(shape, { depth: t0, bevelEnabled: bev > 0, bevelSize: bev, bevelThickness: bev, bevelOffset: -bev, bevelSegments: segs, curveSegments: curve });
  const pos = g0.attributes.position, nor = g0.attributes.normal;
  const P = [], N = [];
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
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(P, 3));
  g.setAttribute("normal", new THREE.Float32BufferAttribute(N, 3));
  g.setAttribute("uv", new THREE.Float32BufferAttribute(new Float32Array((P.length / 3) * 2), 2));
  return mergeVertices(g, 1e-6);
}
const flat = (h) => () => h;

// every edge of a shape cut into pieces no longer than step (make_lg_t12.mjs)
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

// a rounded rectangle seen from above, in shape coordinates (x, xf - zF), front corners rf, back corners rb (make_lg_t12.mjs)
function roundRect(p, x0, x1, f0, f1, rf, rb) {
  const Y0 = f0 - zF, Y1 = f1 - zF;
  p.moveTo(x0 + rf, Y0);
  p.lineTo(x1 - rf, Y0); if (rf) p.absarc(x1 - rf, Y0 + rf, rf, -Math.PI / 2, 0, false);
  p.lineTo(x1, Y1 - rb); if (rb) p.absarc(x1 - rb, Y1 - rb, rb, 0, Math.PI / 2, false);
  p.lineTo(x0 + rb, Y1); if (rb) p.absarc(x0 + rb, Y1 - rb, rb, Math.PI / 2, Math.PI, false);
  p.lineTo(x0, Y0 + rf); if (rf) p.absarc(x0 + rf, Y0 + rf, rf, Math.PI, 1.5 * Math.PI, false);
  return p;
}
// the same as a list of [a, b] points (a rounded rectangle in any plane), counter-clockwise
function rrPts(a0, a1, b0, b1, r, n = 8) {
  const p = [];
  const arc = (ca, cb, t0) => { for (let i = 0; i <= n; i++) { const t = t0 + (Math.PI / 2) * (i / n); p.push([ca + r * Math.cos(t), cb + r * Math.sin(t)]); } };
  arc(a1 - r, b0 + r, -Math.PI / 2); arc(a1 - r, b1 - r, 0); arc(a0 + r, b1 - r, Math.PI / 2); arc(a0 + r, b0 + r, Math.PI);
  return p;
}
// a vertical strip along a closed or open polyline of plan points [x, xf], from y0 to y1; faces away from (cx, cxf), or toward it
function ribbon(pts, y0, y1, { closed = false, toward = false, centre = [0, D / 2] } = {}) {
  const P = [], N = [];
  const list = closed ? [...pts, pts[0]] : pts;
  for (let i = 0; i < list.length - 1; i++) {
    const [ax, af] = list[i], [bx, bf] = list[i + 1];
    const A = [ax, xz(af)], B = [bx, xz(bf)];
    let nx = B[1] - A[1], nz = -(B[0] - A[0]);
    const l = Math.hypot(nx, nz) || 1; nx /= l; nz /= l;
    const mx = (A[0] + B[0]) / 2 - centre[0], mz = (A[1] + B[1]) / 2 - xz(centre[1]);
    if ((nx * mx + nz * mz < 0) !== toward) { nx = -nx; nz = -nz; }
    const a = [A[0], y0, A[1]], b = [B[0], y0, B[1]], c = [B[0], y1, B[1]], d = [A[0], y1, A[1]];
    const e1 = [b[0] - a[0], 0, b[2] - a[2]], e2 = [0, y1 - y0, 0];
    const nn = [e1[1] * e2[2] - e1[2] * e2[1], e1[2] * e2[0] - e1[0] * e2[2], e1[0] * e2[1] - e1[1] * e2[0]];
    const tri = nn[0] * nx + nn[2] * nz > 0 ? [a, b, c, a, c, d] : [a, c, b, a, d, c];
    for (const v of tri) { P.push(...v); N.push(nx, 0, nz); }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(P, 3));
  g.setAttribute("normal", new THREE.Float32BufferAttribute(N, 3));
  return mergeVertices(g, 1e-7);
}
// the cabinet's plan outline as [x, xf] points, inset by d
function outline(d = 0, n = 8) {
  const x0 = -W / 2 + d, x1 = W / 2 - d, f0 = d, f1 = D - d, rf = RCF - d, rb = Math.max(0.001, RCB - d);
  const p = [];
  const arc = (cx, cf, r, t0) => { for (let i = 0; i <= n; i++) { const t = t0 + (Math.PI / 2) * (i / n); p.push([cx + r * Math.cos(t), cf + r * Math.sin(t)]); } };
  arc(x1 - rf, f0 + rf, rf, -Math.PI / 2); arc(x1 - rb, f1 - rb, rb, 0); arc(x0 + rb, f1 - rb, rb, Math.PI / 2); arc(x0 + rf, f0 + rf, rf, Math.PI);
  return p;
}
const planShape = (pts) => new THREE.Shape(pts.map(([x, xf]) => V2(x, xf - zF)));

// the control panel's own coordinates: x across, s up the 21 degree slope from its front edge, h out of it
const onPanel = new THREE.Matrix4().makeBasis(new THREE.Vector3(1, 0, 0), new THREE.Vector3(0, SN, -CS), new THREE.Vector3(0, CS, SN)).setPosition(0, CF, zF);
const panelPoint = (x, s, h) => new THREE.Vector3(x, s, h).applyMatrix4(onPanel);

const root = group("IFBTL900");
const cab = group("Cabinet");
root.add(cab);

// ── base: four levelling feet, the in-built wheels at the back, the recessed plinth, the black base band ──
// the plinth stands 20 mm inside the sides, 22 mm inside the front and 23 mm inside the back (IFB's side photo)
for (const sx of [-1, 1]) {
  for (const xf of [0.066, 0.537]) cab.add(cyl("Foot", 0.018, 0.018, PL0 + 0.001, footM, sx * 0.235, (PL0 + 0.001) / 2, xz(xf), 20));
  const wh = new THREE.CylinderGeometry(0.0145, 0.0145, 0.012, 24); wh.rotateZ(Math.PI / 2);
  cab.add(mesh("Wheel", wh, wheelM, sx * 0.2, 0.0165, xz(0.556)));
}
{
  const s = roundRect(new THREE.Shape(), -W / 2 + 0.02, W / 2 - 0.02, 0.022, D - 0.023, 0.012, 0.006);
  cab.add(mesh("Plinth", prismGeo(s, flat(PL0), flat(PL1 + 0.0005), { caps: ["bottom"] }), plinthM));
  cab.add(mesh("BaseBand", prismGeo(planShape(outline(0.002)), flat(PL1), flat(BB1 + 0.001)), baseM));
}

// ── cabinet: the speckled Noir Black walls, three pressed panels on each side (3 mm deep), a handle pocket in the last ──
// pressed panels: [front, back] from the front edge, 155 to 777 mm high, corners 38 mm (IFB's side photo, right side; the left
// side is not shown in any IFB photo and is built as its mirror)
const PILLS = [[0.069, 0.214], [0.251, 0.355], [0.392, 0.537]], PY = [0.155, 0.777], PR = 0.038, PD = 0.003;
const POCKET = { f0: 0.41, f1: 0.523, y0: 0.49, y1: 0.54, d: 0.03 };
{
  const o = outline();
  // the front and its corners, and the back and its corners, as two strips; the flat sides carry the pressed panels
  const front = [...o.slice(o.length - 9), ...o.slice(0, 9)];
  const back = o.slice(9, 27);
  cab.add(body("CabinetFront", ribbon(front, BB1, J)));
  cab.add(body("CabinetBack", ribbon(back, BB1, J)));
  for (const sx of [1, -1]) {
    // the side, drawn in (a, y) with a = xf on the right and -xf on the left, so its face looks outward
    const basis = sx > 0 ? [new THREE.Vector3(0, 0, -1), new THREE.Vector3(0, 1, 0), new THREE.Vector3(1, 0, 0)] : [new THREE.Vector3(0, 0, 1), new THREE.Vector3(0, 1, 0), new THREE.Vector3(-1, 0, 0)];
    const M = (x) => new THREE.Matrix4().makeBasis(...basis).setPosition(x, 0, zF);
    const A = (xf) => sx * xf;
    const side = new THREE.Shape([[RCF, BB1], [D - RCB, BB1], [D - RCB, J], [RCF, J]].map(([f, y]) => V2(A(f), y)));
    const pills = PILLS.map(([f0, f1]) => rrPts(f0, f1, PY[0], PY[1], PR).map(([f, y]) => [A(f), y]));
    for (const p of pills) side.holes.push(new THREE.Path(p.map(([a, y]) => V2(a, y))));
    cab.add(body("CabinetSide", new THREE.ShapeGeometry(side, 8).applyMatrix4(M(sx * W / 2))));
    // the pressed panels' floors, the last one round the handle pocket
    const floors = pills.map((p, i) => {
      const sh = new THREE.Shape(p.map(([a, y]) => V2(a, y)));
      if (i === 2) sh.holes.push(new THREE.Path(rrPts(POCKET.f0, POCKET.f1, POCKET.y0, POCKET.y1, 0.006, 4).map(([f, y]) => V2(A(f), y))));
      return new THREE.ShapeGeometry(sh, 8).applyMatrix4(M(sx * (W / 2 - PD)));
    });
    cab.add(body("PanelFloor", mergeGeometries(floors)));
    // the pressed panels' walls, 3 mm deep, facing into each panel
    const walls = pills.map((p) => {
      const P = [], N = [];
      const ca = p.reduce((s, q) => s + q[0], 0) / p.length, cy = (PY[0] + PY[1]) / 2;
      for (let i = 0; i < p.length; i++) {
        const [a0, y0] = p[i], [a1, y1] = p[(i + 1) % p.length];
        let na = -(y1 - y0), ny = a1 - a0;
        const l = Math.hypot(na, ny) || 1; na /= l; ny /= l;
        if (na * (ca - (a0 + a1) / 2) + ny * (cy - (y0 + y1) / 2) < 0) { na = -na; ny = -ny; }
        const w = (a, y, x) => new THREE.Vector3(a, y, 0).applyMatrix4(M(x));
        const q = [w(a0, y0, sx * W / 2), w(a1, y1, sx * W / 2), w(a1, y1, sx * (W / 2 - PD)), w(a0, y0, sx * (W / 2 - PD))];
        const nw = new THREE.Vector3(na, ny, 0).transformDirection(M(0));
        const gn = new THREE.Vector3().subVectors(q[1], q[0]).cross(new THREE.Vector3().subVectors(q[3], q[0]));
        const tri = gn.dot(nw) > 0 ? [0, 1, 2, 0, 2, 3] : [0, 2, 1, 0, 3, 2];
        for (const t of tri) { P.push(q[t].x, q[t].y, q[t].z); N.push(nw.x, nw.y, nw.z); }
      }
      const g = new THREE.BufferGeometry();
      g.setAttribute("position", new THREE.Float32BufferAttribute(P, 3));
      g.setAttribute("normal", new THREE.Float32BufferAttribute(N, 3));
      return mergeVertices(g, 1e-7);
    });
    cab.add(body("PanelWall", mergeGeometries(walls)));
    // the handle pocket: a dark recess 30 mm deep (its faces turned inward: seen only from inside)
    const pk = inward(new THREE.BoxGeometry(POCKET.d, POCKET.y1 - POCKET.y0, POCKET.f1 - POCKET.f0));
    cab.add(mesh("HandlePocket", pk, pocketM, sx * (W / 2 - PD - POCKET.d / 2), (POCKET.y0 + POCKET.y1) / 2, xz((POCKET.f0 + POCKET.f1) / 2)));
    // the small slot near the top of the side at the back (IFB's side photo)
    const sl = new THREE.ShapeGeometry(new THREE.Shape(rrPts(-0.003, 0.003, -0.006, 0.006, 0.003, 4).map(([a, b]) => V2(a, b))), 4);
    sl.rotateY((sx * Math.PI) / 2);
    cab.add(mesh("SideSlot", sl, darkM, sx * (W / 2 + 0.0008), 0.864, xz(0.553)));
  }
}
// the joint between the cabinet and the top cover: a dark groove 1.2 mm high and 1.2 mm deep, with its floor and ceiling
{
  cab.add(mesh("Seam", ribbon(outline(0.0012), J, J + 0.0012, { closed: true }), gapM));
  const ring = () => { const s = planShape(outline()); s.holes.push(new THREE.Path(outline(0.0012).map(([x, xf]) => V2(x, xf - zF)))); const g = new THREE.ShapeGeometry(s, 4); g.rotateX(-Math.PI / 2); return g; };
  cab.add(mesh("SeamFloor", ring().translate(0, J, 0), gapM));
  cab.add(mesh("SeamCeiling", inward(ring()).translate(0, J + 0.0012, 0), gapM));
}

// ── top cover: speckled like the cabinet; the control panel's slope at the front, flat round the opening under the lid ──
const TB = J + 0.0012;
{
  // the slope: the front face (829 to 869 mm), then up at 21 degrees to the flat cover
  const o = outline();
  const front = [...o.slice(o.length - 9), ...o.slice(0, 9)].filter(([, xf]) => xf < XS);
  const s = planShape([...front, [W / 2, XS], [-W / 2, XS]]);
  cab.add(body("CoverSlope", prismGeo(s, flat(TB), (x, xf) => CF + Math.tan(SLOPE) * xf, { caps: ["top"] })));
  // the flat cover round the opening, back to the band
  const back = o.filter(([, xf]) => xf > XS + 1e-6 && xf <= D);
  const sf = planShape([[W / 2, XS], ...back.filter(([x]) => x > 0).sort((a, b) => a[1] - b[1]), ...back.filter(([x]) => x <= 0).sort((a, b) => b[1] - a[1]), [-W / 2, XS]]);
  sf.holes.push(roundRect(new THREE.Path(), -OPEN.x, OPEN.x, OPEN.f0, OPEN.f1, OPEN.r, OPEN.r));
  cab.add(body("CoverTop", prismGeo(sf, flat(TB), flat(COVER), { caps: ["top"] })));
}
// the gloss black band at the back: its front face carries the hinges, its back edge rounds down (25 mm)
{
  const prof = [[RB0, COVER - 0.0005], [RB0, H]];
  for (let i = 0; i <= 8; i++) { const xf = D - 0.025 + (0.025 * i) / 8 - 0.002 * (i / 8); prof.push([xf, rbTop(xf)]); }
  prof.push([D - 0.002, COVER - 0.0005]);
  const sh = new THREE.Shape(prof.map(([xf, y]) => V2(xf, y)));
  const g = new THREE.ExtrudeGeometry(sh, { depth: W - 0.004, bevelEnabled: false, curveSegments: 8 });
  g.rotateY(Math.PI / 2);
  g.translate(-(W - 0.004) / 2, 0, zF);
  cab.add(mesh("RearBand", mergeVertices(g, 1e-6), bandM));
  for (const sx of [-1, 1]) cab.add(box("Hinge", 0.03, 0.018, 0.0075, hingeM, sx * 0.22, COVER + 0.009, xz(RB0 - 0.0035)));
}

// ── the control panel: a black glass sheet on the slope, the print laid on it, the chrome knob ──
{
  // the glass: 524 mm across, 5 to 138 mm up the slope (its top runs under the lid), its lower corners rounded 25 mm
  const sh = new THREE.Shape(rrPts(-0.262, 0.262, 0.005, 0.138, 0.025, 10).map(([x, s]) => V2(x, s)));
  const g = new THREE.ExtrudeGeometry(sh, { depth: 0.001, bevelEnabled: false, curveSegments: 10 });
  cab.add(mesh("PanelGlass", g.applyMatrix4(onPanel), panelGlass));
}
const printTex = {};
{
  // the print, redrawn from IFB's drawing of this panel at 12 px per mm (tex_ifb_tl900.py, decals.json): flat decals 0.9 mm
  // over the glass, each on its own black, the same black as the glass
  const DEC = JSON.parse(fs.readFileSync(`${T}/decals.json`, "utf8"));
  for (const [key, d] of Object.entries(DEC)) {
    const [x0, x1] = d.x.map((v) => v / 1000), [s0, s1] = d.s.map((v) => v / 1000);
    const g = new THREE.PlaneGeometry(x1 - x0, s1 - s0);
    g.translate((x0 + x1) / 2, (s0 + s1) / 2, 0.0019);
    const p = g.attributes.position, uv = g.attributes.uv;
    for (let i = 0; i < p.count; i++) uv.setXY(i, (p.getX(i) - x0) / (x1 - x0), (s1 - p.getY(i)) / (s1 - s0));
    cab.add(mesh(`PrintDecal_${key}`, g.applyMatrix4(onPanel), mat(`Print_${key}`, 0xffffff, { rough: 0.3 })));
    printTex[`Print_${key}`] = `${T}/${d.file}`;
  }
}
const LAY = JSON.parse(fs.readFileSync(`${T}/layout.json`, "utf8"));
{
  // the knob: a chrome bezel ring (61 mm across), a chrome skirt (50 mm across, 15 mm tall) and a brushed top (ESTIMATED heights)
  const [kx, ks] = LAY.knob.map((v) => v / 1000);
  const k = new THREE.Group();
  k.name = "Knob";
  const lathe = (name, pts, m, seg = 64) => {
    const g = new THREE.LatheGeometry(pts.map(([r, h]) => V2(r, h)), seg);
    g.rotateX(Math.PI / 2);
    return mesh(name, g, m);
  };
  // (a lathe's face looks to the right of its profile's direction: up the side is outward, inward across the top is up)
  k.add(lathe("KnobBezel", [[0.026, 0.0012], [0.0305, 0.0012], [0.0305, 0.0028], [0.029, 0.0034], [0.026, 0.0034]], chromeM));
  k.add(lathe("KnobBase", [[0.026, 0.0034], [0.026, 0.0013], [0.0245, 0.0013]], darkM));
  k.add(lathe("KnobSide", [[0.025, 0.0012], [0.025, 0.0145], [0.0242, 0.0162], [0.023, 0.0168]], knobSide));
  const top = new THREE.CircleGeometry(0.023, 64);
  const tp = top.attributes.position, tu = top.attributes.uv;
  for (let i = 0; i < tp.count; i++) { tp.setZ(i, 0.0168 + 0.002 * (1 - Math.hypot(tp.getX(i), tp.getY(i)) / 0.023)); tu.setY(i, 1 - tu.getY(i)); }
  top.computeVertexNormals();
  k.add(mesh("KnobTop", top, knobTop));
  k.position.set(kx, ks, 0.001);
  k.updateMatrix();
  // bake the panel's frame into each piece so the knob sits on the slope
  for (const c of [...k.children]) {
    const geo = c.geometry.clone().applyMatrix4(new THREE.Matrix4().multiplyMatrices(onPanel, k.matrix));
    cab.add(mesh(c.name, geo, c.material));
  }
}

// ── the well: speckled walls down to the deck, the light grey tub ring, the steel drum, the Triadic Pulsator ──
{
  const wall = roundRect(new THREE.Shape(), -OPEN.x, OPEN.x, OPEN.f0, OPEN.f1, OPEN.r, OPEN.r);
  wall.holes.push(roundRect(new THREE.Path(), -ix, ix, i0, i1, ir, ir));
  // behind the shelf's front edge the walls stop at the shelf's top
  const wb = (x, xf) => (xf > DBACK + 0.006 ? SHELF - 0.001 : DECK - 0.012);
  cab.add(body("WellWall", prismGeo(dense(wall, 0.004), wb, flat(COVER - 0.0005), { caps: ["top"] })));
  // the deck either side of the tub ring, from the opening's front to the shelf (make_lg_t12.mjs's lunes)
  const rD = ringR - 0.003;
  const lune = (sx) => {
    const yb = DBACK + 0.001;
    const a0 = Math.atan2(yb - RC, Math.sqrt(rD ** 2 - (yb - RC) ** 2)), a1 = Math.atan2(i0 - RC, Math.sqrt(rD ** 2 - (i0 - RC) ** 2));
    const P = (x, xf) => V2(x, xf - zF);
    const pts = [P(Math.sqrt(rD ** 2 - (i0 - RC) ** 2), i0), P(ix - ir, i0)];
    for (let i = 1; i <= 6; i++) { const a = -Math.PI / 2 + (i / 6) * (Math.PI / 2); pts.push(P(ix - ir + ir * Math.cos(a), i0 + ir + ir * Math.sin(a))); }
    pts.push(P(ix, yb));
    for (let i = 0; i < 24; i++) { const a = a0 + ((a1 - a0) * i) / 24; pts.push(P(rD * Math.cos(a), RC + rD * Math.sin(a))); }
    const g = new THREE.ShapeGeometry(new THREE.Shape(pts.map((p) => V2(sx * p.x, p.y))));
    g.rotateX(-Math.PI / 2);
    return g;
  };
  const dg = mergeGeometries([lune(1), lune(-1)]);
  const dp = dg.attributes.normal;
  for (let i = 0; i < dp.count; i++) dp.setXYZ(i, 0, 1, 0);
  dg.translate(0, DECK, 0);
  cab.add(body("Deck", dg));
  // the tub ring: a wide light grey collar 1 mm under the deck, its lip over the drum, turning back out to the drum's wall
  const ring = new THREE.LatheGeometry([[ringR, -0.001], [0.19, -0.004], [0.168, -0.01], [0.158, -0.014], [0.157, -0.024], [0.17, -0.032], [drumR - 0.001, -0.039]].map(([r, y]) => V2(r, y)), 96);
  cab.add(mesh("TubRing", ring, ringM, 0, DECK, zc));
  // the drum wall, inward-facing: IFB's crescent steel, 7 tiles round, 120 mm high
  const g = new THREE.CylinderGeometry(drumR, drumR, drumDepth, 96, 1, true);
  const uv = g.attributes.uv;
  const uRep = 7, vRep = drumDepth / 0.12;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * uRep, (1 - uv.getY(i)) * vRep);
  inward(g);
  cab.add(mesh("DrumWall", g, drumM, 0, drumTop - drumDepth / 2, zc));
  const fl = new THREE.CircleGeometry(drumR, 72); fl.rotateX(-Math.PI / 2);
  cab.add(mesh("DrumFloor", fl, pulsM, 0, drumFloor, zc));
  // the Triadic Pulsator: a light grey dish, three ribs and the centre post (IFB's photos)
  const RP = 0.15;
  const parts = [new THREE.LatheGeometry([[RP + 0.003, 0], [RP, 0.004], [0.11, 0.009], [0.04, 0.015], [0, 0.016]].map(([r, y]) => V2(r, y)), 72)];
  for (let i = 0; i < 3; i++) {
    const a = (i * 2 * Math.PI) / 3 + Math.PI / 2;
    const rib = new THREE.BoxGeometry(0.016, 0.012, 0.1);
    rib.translate(0, 0.016, 0.075);
    rib.rotateY(a);
    parts.push(rib.toNonIndexed());
  }
  parts[0] = parts[0].toNonIndexed();
  const post = new THREE.CylinderGeometry(0.02, 0.026, 0.05, 32); post.translate(0, 0.04, 0); parts.push(post.toNonIndexed());
  const cap = new THREE.SphereGeometry(0.02, 24, 8, 0, Math.PI * 2, 0, Math.PI / 2); cap.scale(1, 0.4, 1); cap.translate(0, 0.065, 0); parts.push(cap.toNonIndexed());
  for (const p of parts) p.deleteAttribute("uv");
  cab.add(mesh("Pulsator", mergeGeometries(parts), pulsM, 0, drumFloor, zc));
  // the lint tower filter on the drum's back wall (filter.jpg, 60 x 260 mm)
  const lf = new THREE.BoxGeometry(0.06, 0.26, 0.012);
  const lu = lf.attributes.uv;
  for (let i = 16; i < 20; i++) lu.setY(i, 1 - lu.getY(i));
  cab.add(mesh("LintFilter", lf, [pulsM, pulsM, pulsM, pulsM, filterM, pulsM], 0, drumTop - 0.03 - 0.13, zc - drumR + 0.009));
  // the bleach inlet cap on the deck at the front left (IFB's lid-open photo)
  cab.add(cyl("BleachCap", 0.021, 0.022, 0.004, capM, -0.204, DECK + 0.002, xz(0.178), 40));
}

// ── the shelf at the back of the well, the detergent tray in its middle sliding out toward the front ──
{
  const sh0 = DECK - 0.012, sh1 = i1 + WT;
  for (const sx of [-1, 1]) {
    const w = ix - SLOT;
    cab.add(body("Shelf", new THREE.BoxGeometry(w, SHELF - sh0, sh1 - DBACK).translate(sx * (SLOT + w / 2), (SHELF + sh0) / 2, xz((DBACK + sh1) / 2))));
  }
  // under the tray's pocket, a skirt down past the tub ring
  cab.add(body("ShelfSkirt", new THREE.PlaneGeometry(2 * SLOT - 0.001, 0.877 - sh0).translate(0, (0.877 + sh0) / 2, xz(DBACK + 0.001))));
  // the pocket the tray slides in (faces inward)
  const pk = inward(new THREE.BoxGeometry(2 * SLOT - 0.001, SHELF - 0.877, 0.14));
  cab.add(mesh("TrayPocket", pk, darkM, 0, (SHELF + 0.877) / 2, xz(DBACK + 0.07)));
}
const det = group("DetergentDrawer", 0, 0, xz(DBACK));
{
  const fw = 2 * SLOT - 0.004, L = 0.12, y0 = 0.879, y1 = SHELF - 0.0045;
  // the cover, printed "Detergent" (detergent.jpg, 160 x 60 mm)
  const cg = new THREE.PlaneGeometry(fw, i1 - DBACK - 0.001);
  cg.rotateX(-Math.PI / 2);
  const cu = cg.attributes.uv;
  for (let i = 0; i < cu.count; i++) cu.setY(i, 1 - cu.getY(i));
  det.add(mesh("TrayCover", cg, detM, 0, SHELF - 0.001, -(i1 - DBACK) / 2));
  det.add(box("TrayFront", fw, SHELF - 0.002 - y0, 0.003, trayM, 0, (SHELF - 0.002 + y0) / 2, -0.0015));
  det.add(box("TrayFloor", fw - 0.004, 0.002, L, trayM, 0, y0 + 0.001, -L / 2));
  for (const x of [-fw / 2 + 0.0015, fw / 2 - 0.0015]) det.add(box("TrayWall", 0.003, y1 - y0, L - 0.004, trayM, x, (y0 + y1) / 2, -(L + 0.004) / 2));
  det.add(box("TrayWall", fw - 0.006, y1 - y0, 0.003, trayM, 0, (y0 + y1) / 2, -L + 0.0015));
  det.add(box("TrayWall", 0.003, y1 - y0 - 0.006, L - 0.01, trayM, 0.04, (y0 + y1 - 0.006) / 2, -L / 2));
  // the cover's underside, so the tray looks closed from below when pulled out
  const ug = new THREE.PlaneGeometry(fw, i1 - DBACK - 0.001); ug.rotateX(Math.PI / 2);
  det.add(mesh("TrayCoverBelow", ug, trayM, 0, SHELF - 0.002, -(i1 - DBACK) / 2));
}
cab.add(det);

// ── lid: hinged at its back edge, a chrome nose at the front, a black glass frame round a large tinted window ──
const lid = group("Lid", 0, PIV[0], xz(PIV[1]));
{
  // the outline: 566 mm across, front corners 20 mm, back corners 4 mm (IFB's straight-down photo)
  const outl = rrPts(-LX, LX, LF, LB, 0.02, 10);   // [x, xf], the front at the low xf
  const sq = rrPts(-LX, LX, LF, LB, 0.004, 4);
  const pts = [...outl.filter(([, f]) => f < LF + 0.05), ...sq.filter(([, f]) => f >= LF + 0.05)];
  pts.sort((a, b) => Math.atan2(a[1] - (LF + LB) / 2, a[0]) - Math.atan2(b[1] - (LF + LB) / 2, b[0]));
  // cut the outline at xf = c, keeping the front (keep < 0) or the back (keep > 0)
  const clip = (P, c, keep) => {
    const out = [], inside = (p) => keep * (p[1] - c) >= 0;
    for (let i = 0; i < P.length; i++) {
      const a = P[i], b = P[(i + 1) % P.length];
      if (inside(a)) out.push(a);
      if (inside(a) !== inside(b)) { const t = (c - a[1]) / (b[1] - a[1]); out.push([a[0] + t * (b[0] - a[0]), c]); }
    }
    return out;
  };
  const NOSE = LF + 0.012;
  const nose = planShape(clip(pts, NOSE, -1));
  const chrome = mesh("LidNose", prismGeo(nose, flat(LBOT + 0.002), (x, xf) => lidTop(xf) + 0.0002, { bev: 0.0015, segs: 2 }), chromeM);
  const fr = planShape(clip(pts, NOSE, 1));
  // the tinted window, 496 mm across, 143 to 409 mm from the front, corners 24 mm (IFB's straight-down photo)
  const WIN = { x: 0.248, f0: 0.143, f1: 0.409, r: 0.024 };
  fr.holes.push(roundRect(new THREE.Path(), -WIN.x, WIN.x, WIN.f0, WIN.f1, WIN.r, WIN.r));
  const frame = mesh("LidFrame", prismGeo(dense(fr, 0.03), flat(LBOT), (x, xf) => lidTop(xf), { bev: 0.0015, segs: 1 }), lidM);
  const wc = (WIN.f0 + WIN.f1) / 2;
  const pane = mesh("LidWindow", new THREE.PlaneGeometry(2 * WIN.x, WIN.f1 - WIN.f0), glassM, 0, lidTop(wc) - 0.0012, xz(wc));
  pane.rotation.x = -Math.PI / 2 + Math.atan(0.009 / (LB - LF));
  // "TEMPERED GLASS", printed white on the frame's front band (glass_print.png), 19 mm behind the nose
  const [gw, gh] = LAY.glassPrint.map((v) => v / 1000);
  const pf = 0.114;
  const gp = new THREE.PlaneGeometry(gw, gh);
  const gu = gp.attributes.uv;
  for (let i = 0; i < gu.count; i++) gu.setY(i, 1 - gu.getY(i));
  const print = mesh("LidPrint", gp, lidPrint, 0, lidTop(pf) + 0.0009, xz(pf));
  print.rotation.x = -Math.PI / 2 + Math.atan(0.009 / (LB - LF));
  for (const m of [chrome, frame, pane, print]) { m.position.y -= PIV[0]; m.position.z -= xz(PIV[1]); lid.add(m); }
}
root.add(lid);

// ── the back (IFB's side and 3/4 photos): the inlet valve near the right at 885 mm, its threaded fitting 23 mm out, and a
// bracket hanging from it to a clip at 765 mm, standing 8-34 mm out; the power cord runs from the top cover's back into the
// clip and its plug is held there (no IFB photo shows the cord: kept inside the bracket's outline, never seen from the front,
// the 3/4 or the side). The drain hose comes loose in the box (IFB's "Included Components"): not fitted ──
{
  const zB = -D / 2, vx = 0.2;
  cab.add(box("InletValve", 0.05, 0.03, 0.014, valveM, vx, 0.885, zB - 0.007));
  cab.add(cyl("InletThread", 0.0105, 0.0105, 0.012, threadM, vx, 0.885, zB - 0.02, 24).rotateX(Math.PI / 2));
  cab.add(box("HoseHangerBar", 0.006, 0.12, 0.004, valveM, vx + 0.02, 0.81, zB - 0.026));
  cab.add(box("HoseHangerArm", 0.006, 0.004, 0.022, valveM, vx + 0.02, 0.868, zB - 0.015));
  cab.add(box("HoseHangerClip", 0.03, 0.043, 0.026, valveM, vx + 0.02, 0.765, zB - 0.021));
  const cp = [[vx - 0.03, 0.86, zB + 0.002], [vx - 0.02, 0.84, zB - 0.012], [vx + 0.005, 0.8, zB - 0.016], [vx + 0.012, 0.79, zB - 0.017]].map(([x, y, z]) => new THREE.Vector3(x, y, z));
  cab.add(mesh("PowerCord", new THREE.TubeGeometry(new THREE.CatmullRomCurve3(cp, false, "centripetal"), 24, 0.0035, 6, false), cordM));
  cab.add(box("Plug", 0.024, 0.034, 0.02, plugM, vx + 0.02, 0.77, zB - 0.02));
}

// ── the lid's opening: the entry's angle is checked here: the height it gives, and how far the open lid would pass into
// the band at the back (must be 0) ──
const parts = productParts(PRODUCTS, ID);
{
  root.updateMatrixWorld(true);
  const pts = [];
  lid.traverse((o) => { if (o.isMesh) { const p = o.geometry.attributes.position; for (let i = 0; i < p.count; i++) pts.push(new THREE.Vector3().fromBufferAttribute(p, i).applyMatrix4(o.matrix)); } });
  const deg = parts.find((p) => p.node === "Lid").angle;
  let h = 0, pen = 0;
  for (let d = 0; d >= deg; d -= 5) {
    const a = (Math.max(d, deg) * Math.PI) / 180;
    for (const v of pts) {
      const y = PIV[0] + v.y * Math.cos(a) - v.z * Math.sin(a), xf = PIV[1] - (v.y * Math.sin(a) + v.z * Math.cos(a));
      if (d <= deg + 4) h = Math.max(h, y);
      if (xf > RB0 && y > COVER) pen = Math.max(pen, rbTop(xf) - y);
    }
  }
  console.log(`lid open ${deg} deg: ${(h * 1000).toFixed(1)} mm high, ${(pen * 1000).toFixed(1)} mm into the band at the back`);
}

// hotspots: on the panel's print and inside (written back into the entry)
{
  const e = JSON.parse(fs.readFileSync(PRODUCTS, "utf8"));
  const hs = e.products.find((p) => p.id === ID).hotspots;
  const r4 = (v) => +v.toFixed(4);
  const pn = [0, r4(CS), r4(SN)];
  const at = (x, s) => { const p = panelPoint(x, s, 0.0019); return [r4(p.x), r4(p.y), r4(p.z)]; };
  hs[0].pos = at(-0.2022, 0.045); hs[0].normal = pn;          // "POWER STEAM"
  hs[1].pos = at(-0.1542, 0.044); hs[1].normal = pn;          // "ECO INVERTER"
  hs[2].pos = [0.07, r4(drumFloor + 0.022), r4(zc + 0.07)]; hs[2].normal = [0, 1, 0];
  hs[3].pos = [-0.15, r4(lidTop(0.3) + 0.0005), r4(xz(0.3))]; hs[3].normal = [0, 1, 0];
  fs.writeFileSync(PRODUCTS, JSON.stringify(e, null, 2) + "\n");
}

const clips = stateClips(root, parts);
saveZones(PRODUCTS, ID, root, parts);
await exportGLB(root, clips, OUT, {
  Body: `${T}/sparkle.jpg`, ...printTex, KnobTop: `${T}/knob_top.jpg`, Drum: `${T}/drum.jpg`, LintFilter: `${T}/filter.jpg`,
  DetergentCover: `${T}/detergent.jpg`, LidPrint: `${T}/glass_print.png`,
}, { dir: `${TEX}/grain`, materials: {
  // Grain (BENCHMARK.md section 10): the speckled body the soft peel; the moulded base band and plinth the strong peel;
  // nothing on the panel glass and print, the chrome, the lid's glass or the gloss black band
  Body: { type: "peel_soft" }, BaseBand: { type: "peel_strong" }, Plinth: { type: "peel_strong" },
} });
