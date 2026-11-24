// Haier HWM110-H688BK, 11 kg fully automatic top-load washing machine with the in-built butterfly heater, Black.
// Built to Haier's size, 550 W x 1040 H x 570 D mm (Haier India's online shop for this model: "Dimensions in mm (WxDxH)
// 550*570*1040"), and to Haier's own gallery for it there (eight 4000 px renders: front, both 3/4 views, top, the panel
// close-up, the lid open, the drum from above and the back). Sizes Haier doesn't publish are measured off those renders
// (private/research/haier_hwm110/NOTES.md, all ESTIMATED): the back render is straight on (3.36 px per mm), the others are
// read as ratios to it.
// Copied in structure from make_haier_hwm70.mjs (the closest top loader) and changed to this model's own shapes: a tall
// black glass console across the back carrying the controls, a large framed glass lid hinged in front of it, a grey top
// cover with a recessed front grip under a silver trim, grooved sides with a handle, a ribbed rear cover.
// usage: node make_haier_hwm110.mjs <entry.json> <tex dir> <out.glb>
import { THREE, mat, mesh, box, group, inward, stateClips, exportGLB, productParts, saveZones } from "./lib.mjs";
import { mergeVertices } from "three/examples/jsm/utils/BufferGeometryUtils.js";

const [PRODUCTS, TEX, OUT] = process.argv.slice(2);
const ID = "haier-hwm110-h688bk";
const T = `${TEX}/haier_hwm110`;

// ── size (metres): x across, y up, z front (+) to back (-); d is the distance back from the front edge at the middle ──
const W = 0.55, H = 1.04, D = 0.57;
const zF = D / 2, zB = -D / 2;
const R = 2.2;                                    // the front's bow in plan (ESTIMATED: ~14 mm at the corners)
const sag = (x) => (x * x) / (2 * R);
const zAt = (d, x = 0) => zF - d - sag(x);
const plinthTop = 0.081, S = 0.85;                // plinth top and the cabinet's top edge (back render)
const TRIM = 0.953;                               // the silver trim along the top cover's front edge (front render)
const RC = 0.02, RB = 0.012;

// ── materials ──
const bodyM = mat("Body", 0x48494d, { metal: 0.5, rough: 0.34 });               // the cabinet's dark grey steel
const coverM = mat("TopCover", 0x595b60, { metal: 0.45, rough: 0.3 });           // the top cover and lid frame, a lighter grey
const black = mat("BlackPlastic", 0x0e0e10, { rough: 0.3 });
const consoleM = mat("ConsoleGlass", 0x070708, { metal: 0.7, rough: 0.2 });      // the console's gloss black
const plinthM = mat("Plinth", 0x141416, { rough: 0.75 });
const footM = mat("Foot", 0x2a2b2e, { rough: 0.8 });
const panelL = mat("PanelLeft", 0xffffff, { metal: 0.7, rough: 0.2 });
const panelR = mat("PanelRight", 0xffffff, { metal: 0.7, rough: 0.2 });
const trimM = mat("SilverTrim", 0xc4c7cb, { metal: 1, rough: 0.2 });
const glassM = mat("LidGlass", 0x1a1c1f, { metal: 0.2, rough: 0.04, opacity: 0.72, side: THREE.DoubleSide });
const wellM = mat("Well", 0x0f1011, { rough: 0.55 });
const ringM = mat("BalanceRing", 0xa9acb1, { rough: 0.5, side: THREE.DoubleSide });
const drumM = mat("PillowDrum", 0xffffff, { metal: 0.35, rough: 0.35, side: THREE.DoubleSide });
const baseM = mat("DrumBase", 0xc9cacd, { rough: 0.45 });
const pulsM = mat("Pulsator", 0xffffff, { rough: 0.4, side: THREE.DoubleSide });
const channelM = mat("FilterChannel", 0x8e9095, { rough: 0.45 });
const capM = mat("FilterCap", 0xffffff, { rough: 0.45 });
const boxM = mat("DetergentBox", 0x3c3d41, { rough: 0.4 });
const printM = mat("DetergentPrint", 0xffffff, { rough: 0.45, opacity: 0.999 });
const grooveM = mat("Groove", 0x46474b, { metal: 0.35, rough: 0.45 });
const handleM = mat("HandleInsert", 0x1c1d20, { rough: 0.45 });
const gripM = mat("HandleGrip", 0x9a9da2, { metal: 0.8, rough: 0.3 });
const rearM = mat("RearCover", 0xa9aab1, { rough: 0.55 });
const plateM = mat("RearPlate", 0xa4a6aa, { metal: 0.6, rough: 0.4 });
const screwM = mat("Screw", 0xb9bbbf, { metal: 0.8, rough: 0.3 });

const cyl = (name, rt, rb, h, m, x, y, z, seg = 24) => mesh(name, new THREE.CylinderGeometry(rt, rb, h, seg), m, x, y, z);

// glTF reads v downward: flip a plane's v so its print stands upright
function flipV(g) { const u = g.attributes.uv; for (let i = 0; i < u.count; i++) u.setY(i, 1 - u.getY(i)); return g; }
function outline(inset = 0, n = 24) {
  const w = W / 2 - inset, zb = zB + inset, rc = RC, rb = RB;
  const zf = (x) => zF - inset - sag(x);
  const pts = [];
  const xs = w - rc;
  for (let i = 0; i <= n; i++) { const x = -xs + (2 * xs * i) / n; pts.push([x, zf(x)]); }
  const zc = zf(xs) - rc;
  for (let i = 1; i <= 6; i++) { const a = (Math.PI / 2) * (1 - i / 6); pts.push([xs + rc * Math.cos(a), zc + rc * Math.sin(a)]); }
  for (let i = 0; i <= 6; i++) { const a = -(Math.PI / 2) * (i / 6); pts.push([w - rb + rb * Math.cos(a), zb + rb + rb * Math.sin(a)]); }
  for (let i = 0; i <= 6; i++) { const a = -Math.PI / 2 - (Math.PI / 2) * (i / 6); pts.push([-w + rb + rb * Math.cos(a), zb + rb + rb * Math.sin(a)]); }
  for (let i = 0; i < 6; i++) { const a = Math.PI + (Math.PI / 2) * (i / 6); pts.push([-xs + rc * Math.cos(a), zc - rc * Math.sin(a)]); }
  return pts;
}
// a vertical strip along a polyline of [x, z] from y0 (or y0(x, z)) to y1 (or y1(x, z)), facing away from `centre`
function ribbon(name, pts, y0, y1, m, { closed = false, inwardFace = false, centre = [0, 0] } = {}) {
  const P = [], N = [];
  const Y0 = typeof y0 === "function" ? y0 : () => y0, Y1 = typeof y1 === "function" ? y1 : () => y1;
  const list = closed ? [...pts, pts[0]] : pts;
  for (let i = 0; i < list.length - 1; i++) {
    const [ax, az] = list[i], [bx, bz] = list[i + 1];
    let nx = bz - az, nz = -(bx - ax);
    const l = Math.hypot(nx, nz) || 1; nx /= l; nz /= l;
    const mx = (ax + bx) / 2 - centre[0], mz = (az + bz) / 2 - centre[1];
    if ((nx * mx + nz * mz < 0) !== inwardFace) { nx = -nx; nz = -nz; }
    const a = [ax, Y0(ax, az), az], b = [bx, Y0(bx, bz), bz], c = [bx, Y1(bx, bz), bz], d = [ax, Y1(ax, az), az];
    const e1 = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], e2 = [d[0] - a[0], d[1] - a[1], d[2] - a[2]];
    const nn = [e1[1] * e2[2] - e1[2] * e2[1], e1[2] * e2[0] - e1[0] * e2[2], e1[0] * e2[1] - e1[1] * e2[0]];
    const tri = nn[0] * nx + nn[2] * nz > 0 ? [a, b, c, a, c, d] : [a, c, b, a, d, c];
    for (const v of tri) { P.push(v[0], v[1], v[2]); N.push(nx, 0, nz); }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(P, 3));
  g.setAttribute("normal", new THREE.Float32BufferAttribute(N, 3));
  return mesh(name, mergeVertices(g, 1e-7), m);
}
// a flat plate from a plan outline ([x, z]) with holes, at height y (or y(x, z) for a sloped plate), facing up or down
function plate(name, pts, holes, y, m, { down = false, uvFn = null } = {}) {
  const s = new THREE.Shape(pts.map(([x, z]) => new THREE.Vector2(x, -z)));
  for (const h of holes) s.holes.push(new THREE.Path(h.map(([x, z]) => new THREE.Vector2(x, -z))));
  const g = new THREE.ShapeGeometry(s, 4);
  g.rotateX(-Math.PI / 2);
  if (down) { g.rotateX(Math.PI); g.scale(1, 1, -1); inward(g); }
  const p = g.attributes.position;
  if (typeof y === "function") for (let i = 0; i < p.count; i++) p.setY(i, y(p.getX(i), p.getZ(i)));
  else for (let i = 0; i < p.count; i++) p.setY(i, y);
  if (uvFn) { const u = g.attributes.uv; for (let i = 0; i < p.count; i++) u.setXY(i, ...uvFn(p.getX(i), p.getZ(i))); }
  g.computeVertexNormals();
  return mesh(name, g, m);
}
const rrect = (x0, x1, z0, z1, r, n = 6) => {
  const p = [];
  const arc = (cx, cz, a0) => { for (let i = 0; i <= n; i++) { const a = a0 + (Math.PI / 2) * (i / n); p.push([cx + r * Math.cos(a), cz + r * Math.sin(a)]); } };
  arc(x1 - r, z0 - r, 0); arc(x0 + r, z0 - r, Math.PI / 2); arc(x0 + r, z1 + r, Math.PI); arc(x1 - r, z1 + r, 1.5 * Math.PI);
  return p;
};
const circle = (cx, cz, r, n = 48) => Array.from({ length: n }, (_, i) => [cx + r * Math.cos((i / n) * 2 * Math.PI), cz + r * Math.sin((i / n) * 2 * Math.PI)]);
const tri = (name, verts, m) => {                    // a flat polygon from 3D points (a fan), facing by its winding
  const P = [];
  for (let i = 1; i < verts.length - 1; i++) P.push(...verts[0], ...verts[i], ...verts[i + 1]);
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(P, 3));
  g.computeVertexNormals();
  return mesh(name, g, m);
};

const root = group("HaierHWM110");
const cab = group("Cabinet");
root.add(cab);

// ── base: the black plinth to 81 mm (back render), its front skirt ending 12 mm and its back 25 mm above the floor between
// the corner legs, on four round feet 25 mm tall (back render) ──
{
  const o = outline(0.001);
  cab.add(ribbon("Plinth", o, (x, z) => (z < 0 ? 0.025 : 0.012), plinthTop, plinthM, { closed: true }));
  cab.add(plate("PlinthUnder", o, [], (x, z) => (z < 0 ? 0.025 : 0.012), plinthM, { down: true }));
  for (const sx of [-1, 1]) for (const back of [false, true]) {
    const x = sx * (W / 2 - 0.035), z = back ? zB + 0.04 : zAt(0.04, x);
    cab.add(box("PlinthLeg", 0.06, 0.014, 0.06, plinthM, x, 0.025 + 0.007 - 0.0005, z));
    cab.add(cyl(back ? "FootFixed" : "FootAdjustable", 0.017, 0.018, 0.025, footM, x, 0.0125, z, 20));
  }
}

// ── cabinet: the bowed front and its corners and the back as one wrap; the two flat sides with four grooves each and a
// handle in the fourth groove's place (Haier's 3/4 renders: the left side's handle is near the front, the right side's near
// the back, the sides being 180-degree copies of each other) ──
const GROOVES = [0.085, 0.2, 0.315];                   // groove centres, from the handle side's far end (ESTIMATED)
const COL4 = 0.43, GW = 0.052, GY0 = 0.27, GY1 = 0.8;
const HND = { w: 0.062, h: 0.07, y: 0.615 };
{
  const o = outline(0);
  const right = [], left = [];
  for (let i = 0; i < o.length; i++) { if (Math.abs(o[i][0] - W / 2) < 1e-6) right.push(i); if (Math.abs(o[i][0] + W / 2) < 1e-6) left.push(i); }
  const rf = Math.min(...right), lb = Math.max(...left), rb = Math.max(...right), lf = Math.min(...left);
  cab.add(ribbon("CabinetFront", [...o.slice(lb), ...o.slice(0, rf + 1)], plinthTop, S, bodyM, { centre: [0, 0.05] }));
  cab.add(ribbon("CabinetBack", o.slice(rb, lf + 1), plinthTop, S, bodyM, { centre: [0, 0.05] }));
  const zFront = o[rf][1], zBack = o[rb][1];
  for (const sx of [1, -1]) {
    // right side: d measured from the back (handle near the back); left side: from the front (handle near the front)
    const dz = (d) => (sx > 0 ? zF - (D - d) : zF - d);
    const pill = (cd, y0, y1) => {
      const p = [], r = GW / 2, cz = dz(cd), n = 10;
      for (let i = 0; i <= n; i++) { const a = Math.PI + (Math.PI * i) / n; p.push([cz + r * Math.cos(a), y0 + r + r * Math.sin(a)]); }
      for (let i = 0; i <= n; i++) { const a = (Math.PI * i) / n; p.push([cz + r * Math.cos(a), y1 - r + r * Math.sin(a)]); }
      return p;
    };
    // right: grooves at D-0.085... i.e. measured from the back; left: measured from the front, so the handle column (COL4)
    // is near the back on the right and near the front on the left
    const cols = GROOVES.map((g) => D - g);
    const hz = dz(D - COL4);
    const hole = [[hz - HND.w / 2, HND.y - HND.h / 2], [hz + HND.w / 2, HND.y - HND.h / 2], [hz + HND.w / 2, HND.y + HND.h / 2], [hz - HND.w / 2, HND.y + HND.h / 2]];
    const grooves = [...cols.map((c) => pill(c, GY0, GY1)), pill(D - COL4, GY0, HND.y - HND.h / 2 - 0.05), pill(D - COL4, HND.y + HND.h / 2 + 0.035, GY1)];
    const map = ([z, y]) => new THREE.Vector2(sx > 0 ? -z : z, y);
    const s = new THREE.Shape([[zFront, plinthTop], [zBack, plinthTop], [zBack, S], [zFront, S]].map(map));
    for (const h of [...grooves, hole]) s.holes.push(new THREE.Path(h.map(map)));
    const g = new THREE.ShapeGeometry(s, 6);
    g.rotateY(sx * Math.PI / 2);
    cab.add(mesh("CabinetSide", g, bodyM, sx * W / 2, 0, 0));
    const pocket = (name, pts, depth, m) => {
      const P = [], N = [];
      const cz = pts.reduce((a, p) => a + p[0], 0) / pts.length, cy = pts.reduce((a, p) => a + p[1], 0) / pts.length;
      for (let i = 0; i < pts.length; i++) {
        const [az, ay] = pts[i], [bz, by] = pts[(i + 1) % pts.length];
        const mz = (az + bz) / 2, my = (ay + by) / 2;
        let nz = -(by - ay), ny = bz - az; const l = Math.hypot(nz, ny) || 1; nz /= l; ny /= l;
        if (nz * (cz - mz) + ny * (cy - my) < 0) { nz = -nz; ny = -ny; }
        const x0 = sx * W / 2, x1 = sx * (W / 2 - depth);
        const A = [x0, ay, az], B = [x0, by, bz], C = [x1, by, bz], Dd = [x1, ay, az];
        const e1 = [B[0] - A[0], B[1] - A[1], B[2] - A[2]], e2 = [Dd[0] - A[0], Dd[1] - A[1], Dd[2] - A[2]];
        const nn = [e1[1] * e2[2] - e1[2] * e2[1], e1[2] * e2[0] - e1[0] * e2[2], e1[0] * e2[1] - e1[1] * e2[0]];
        const t = nn[1] * ny + nn[2] * nz > 0 ? [A, B, C, A, C, Dd] : [A, C, B, A, Dd, C];
        for (const v of t) { P.push(...v); N.push(0, ny, nz); }
      }
      const gw = new THREE.BufferGeometry();
      gw.setAttribute("position", new THREE.Float32BufferAttribute(P, 3));
      gw.setAttribute("normal", new THREE.Float32BufferAttribute(N, 3));
      cab.add(mesh(name, gw, m));
      const gf = new THREE.ShapeGeometry(new THREE.Shape(pts.map(map)), 6);
      gf.rotateY(sx * Math.PI / 2);
      cab.add(mesh(name + "Floor", gf, m, sx * (W / 2 - depth), 0, 0));
    };
    for (const gp of grooves) pocket("Groove", gp, 0.004, grooveM);
    pocket("HandlePocket", hole, 0.026, handleM);
    // the handle's bright grip bar across the top of the opening and its dark frame
    const fr = new THREE.Shape([[hz - HND.w / 2 - 0.007, HND.y - HND.h / 2 - 0.007], [hz + HND.w / 2 + 0.007, HND.y - HND.h / 2 - 0.007], [hz + HND.w / 2 + 0.007, HND.y + HND.h / 2 + 0.007], [hz - HND.w / 2 - 0.007, HND.y + HND.h / 2 + 0.007]].map(map));
    fr.holes.push(new THREE.Path(hole.map(map)));
    const gfr = new THREE.ShapeGeometry(fr);
    gfr.rotateY(sx * Math.PI / 2);
    cab.add(mesh("HandleFrame", gfr, gripM, sx * (W / 2 + 0.0006), 0, 0));
    cab.add(box("HandleGrip", 0.022, 0.012, HND.w, gripM, sx * (W / 2 - 0.012), HND.y + HND.h / 2 - 0.006, hz));
  }
}

// ── the back: the ribbed light grey rear cover (400 x 631 mm, its foot 76 mm up) and the metal plate above it with its two
// pressed slots and two oval holes, screws (back render, 3.36 px per mm) ──
{
  cab.add(box("RearCover", 0.4, 0.631, 0.0012, rearM, 0, 0.076 + 0.3155, zB - 0.0006));
  for (let i = 0; i < 9; i++) cab.add(box("RearCoverRib", 0.36, 0.034, 0.0008, rearM, 0, 0.13 + i * 0.065, zB - 0.0016));
  cab.add(box("RearPlate", 0.345, 0.153, 0.0008, plateM, 0, 0.7715, zB - 0.0004));
  for (const y of [0.818, 0.77]) { const sl = new THREE.PlaneGeometry(0.24, 0.022); sl.rotateY(Math.PI); cab.add(mesh("RearPlateSlot", sl, plateM, 0, y, zB - 0.0026)); }   // pressed slots, 1 mm behind the plate (it sits 0.8 mm out after defight)
  for (const sx of [-1, 1]) {
    const ov = new THREE.CircleGeometry(0.009, 20); ov.scale(1, 1.6, 1); ov.rotateY(Math.PI);
    cab.add(mesh("RearPlateHole", ov, black, sx * 0.135, 0.77, zB - 0.0026));
  }
  for (const [x, y] of [[-0.16, 0.72], [0.16, 0.72], [-0.16, 0.45], [0.16, 0.45], [-0.16, 0.12], [0.16, 0.12], [-0.25, 0.6], [0.25, 0.6], [-0.25, 0.24], [0.25, 0.24], [-0.21, 0.98], [0.21, 0.98]])
    cab.add(cyl("Screw", 0.0035, 0.0035, 0.0012, screwM, x, y, zB - 0.0018, 10).rotateX(Math.PI / 2));
}

// ── top cover: grey, from the cabinet's top edge; its front band (to the silver trim at 953 mm) carries the recessed grip;
// its sides rise with the lid toward the console ──
const LID = { d0: 0.012, d1: 0.464, x: 0.27, yF: 0.958, yB: 0.985, t: 0.022 };
const lidTop = (d) => LID.yF + (LID.yB - LID.yF) * (d - LID.d0) / (LID.d1 - LID.d0);
const deckY = (d) => Math.min(lidTop(Math.max(d, LID.d0)), LID.yB) - LID.t;          // the ledge the lid rests on
const sideTop = (d) => (d <= LID.d0 ? TRIM : Math.min(lidTop(d), LID.yB) - 0.006);   // the cover's side edge under the lid's edge
const CON = { d0: 0.469, y0: 0.99, d1: 0.5547, y1: 1.031 };                            // the console face (95 mm slant)
const GRIP = { x: 0.175, y0: 0.887, y1: 0.912, depth: 0.016 };
{
  // the bowed front between two x values (sampled every 10 mm), at an inset from the outline
  const frontLine = (x0, x1, inset = 0.0015) => {
    const n = Math.max(2, Math.ceil((x1 - x0) / 0.01)), p = [];
    for (let i = 0; i <= n; i++) { const x = x0 + ((x1 - x0) * i) / n; p.push([x, zF - inset - sag(x)]); }
    return p;
  };
  const xs = W / 2 - 0.0015 - RC;
  const o = outline(0.0015);
  const cornerL = o.filter(([x, z]) => x < -xs - 1e-9 && z > 0).sort((a, b) => a[1] - b[1]);   // front-left arc, back to front
  const cornerR = o.filter(([x, z]) => x > xs + 1e-9 && z > 0).sort((a, b) => b[1] - a[1]);   // front-right arc, front to back
  const sideL = [[-W / 2 + 0.0015, zF - 0.045 - sag(xs)]], sideR = [[W / 2 - 0.0015, zF - 0.045 - sag(xs)]];
  const wrapL = [...cornerL], wrapR = [...cornerR];
  // the front band: under the grip, over it, and beside it
  cab.add(ribbon("TopCoverFront", [...wrapL, ...frontLine(-xs, xs), ...wrapR], S, GRIP.y0, coverM, { centre: [0, 0.05] }));
  cab.add(ribbon("TopCoverFront", [...wrapL, ...frontLine(-xs, xs), ...wrapR], GRIP.y1, TRIM - 0.004, coverM, { centre: [0, 0.05] }));
  cab.add(ribbon("TopCoverFront", [...wrapL, ...frontLine(-xs, -GRIP.x)], GRIP.y0, GRIP.y1, coverM, { centre: [0, 0.05] }));
  cab.add(ribbon("TopCoverFront", [...frontLine(GRIP.x, xs), ...wrapR], GRIP.y0, GRIP.y1, coverM, { centre: [0, 0.05] }));
  // the grip's recess, 16 mm deep
  const gp = frontLine(-GRIP.x, GRIP.x, 0.0015 + GRIP.depth);
  cab.add(ribbon("GripBack", gp, GRIP.y0, GRIP.y1, black, { centre: [0, -1] }));
  const gFront = frontLine(-GRIP.x, GRIP.x);
  cab.add(plate("GripFloor", [...gFront, ...gp.slice().reverse()], [], GRIP.y0, black));
  cab.add(plate("GripRoof", [...gFront, ...gp.slice().reverse()], [], GRIP.y1, black, { down: true }));
  for (const sx of [-1, 1]) {
    const x = sx * GRIP.x, zf = zF - 0.0015 - sag(x);
    const v = [[x, GRIP.y0, zf], [x, GRIP.y1, zf], [x, GRIP.y1, zf - GRIP.depth], [x, GRIP.y0, zf - GRIP.depth]];
    cab.add(tri("GripEnd", sx < 0 ? v : [v[0], v[3], v[2], v[1]], black));
  }
  // the silver trim: a 5 mm chrome band on the front's top edge, round the corners and 45 mm along each side
  const o9 = outline(0.0009);
  const tL = o9.filter(([x, z]) => x < -xs - 1e-9 && z > 0).sort((a, b) => a[1] - b[1]);
  const tR = o9.filter(([x, z]) => x > xs + 1e-9 && z > 0).sort((a, b) => b[1] - a[1]);
  cab.add(ribbon("TrimBand", [[-W / 2 + 0.0009, zF - 0.045 - sag(xs)], ...tL, ...frontLine(-xs, xs, 0.0009), ...tR, [W / 2 - 0.0009, zF - 0.045 - sag(xs)]], TRIM - 0.005, TRIM, trimM, { centre: [0, 0.05] }));
  // the sides of the cover, from the cabinet's edge up to just under the lid's edge (a 1.5 mm wall with its inner face and
  // top, so it reads solid from inside with the lid up), back to the console
  for (const sx of [-1, 1]) {
    const sd = []; for (let d = 0.0015 + RC; d <= CON.d0 - 0.002 + 1e-9; d += 0.02) sd.push(Math.min(d, CON.d0 - 0.002));
    if (sd[sd.length - 1] < CON.d0 - 0.002) sd.push(CON.d0 - 0.002);
    const outer = sd.map((d) => [sx * (W / 2 - 0.0015), zF - d - sag(xs)]);
    const inner = sd.map((d) => [sx * (W / 2 - 0.003), zF - d - sag(xs)]);
    cab.add(ribbon("TopCoverSide", outer, S, (x, z) => sideTop(zF - z), coverM, { centre: [0, outer[0][1]] , inwardFace: false }));
    cab.add(ribbon("TopCoverSideIn", inner, (x, z) => deckY(zF - z) - 0.001, (x, z) => sideTop(zF - z), coverM, { inwardFace: true, centre: [0, inner[0][1]] }));
    const capP = [];
    for (let i = 0; i < sd.length - 1; i++) {
      const y0 = sideTop(sd[i]), y1 = sideTop(sd[i + 1]);
      const A = [outer[i][0], y0, outer[i][1]], B = [outer[i + 1][0], y1, outer[i + 1][1]], C = [inner[i + 1][0], y1, inner[i + 1][1]], Dd = [inner[i][0], y0, inner[i][1]];
      capP.push(...(sx > 0 ? [...A, ...C, ...B, ...A, ...Dd, ...C] : [...A, ...B, ...C, ...A, ...C, ...Dd]));
    }
    const gc = new THREE.BufferGeometry(); gc.setAttribute("position", new THREE.Float32BufferAttribute(capP, 3)); gc.computeVertexNormals();
    cab.add(mesh("TopCoverSideTop", gc, coverM));
  }
  cab.add(plate("TopCoverSeat", outline(0), [outline(0.0015)], S, bodyM));
  // the front top edge: a 7.5 mm ledge behind the trim, then down to the seat the lid rests on
  const FE = 0.009;
  const fl0 = frontLine(-xs, xs), fl1 = frontLine(-xs, xs, FE);
  cab.add(plate("TopCoverLedge", [...fl0, ...fl1.slice().reverse()], [], TRIM, coverM));
  cab.add(ribbon("TopCoverLip", fl1, (x, z) => deckY(FE), TRIM, coverM, { centre: [0, -1], inwardFace: false }));
  // the seat the lid rests on (sloped, under the lid) round the well
  const well = rrect(-0.236, 0.236, zAt(0.04), zAt(0.442), 0.07);
  const seat = rrect(-(W / 2 - 0.003), W / 2 - 0.003, zF - FE - sag(xs), zF - (CON.d0 - 0.002), 0.012);
  cab.add(plate("LidSeat", seat, [well], (x, z) => deckY(zF - z), coverM));
  // the well: black walls down to the tub cover at 870 mm, the tub cover with its round opening, the white balance ring
  const wy = 0.87;
  const tubZ = zAt(0.242);
  cab.add(ribbon("WellWall", well, wy, (x, z) => deckY(zF - z) + 0.0005, wellM, { closed: true, inwardFace: true, centre: [0, zAt(0.241)] }));
  cab.add(plate("TubCover", well, [circle(0, tubZ, 0.215, 72)], wy, wellM));
  const ring = new THREE.LatheGeometry([[0.215, 0.0], [0.212, 0.008], [0.205, 0.01], [0.2, 0.004], [0.194, 0.009], [0.186, 0.004], [0.18, -0.004], [0.176, -0.02], [0.178, -0.03]].map(([r, y]) => new THREE.Vector2(r, y)).reverse(), 80);
  cab.add(mesh("BalanceRing", ring, ringM, 0, wy, tubZ));
  // the drum (pillow wall), its floor and the pulsator
  const drumR = 0.215, drumTop = wy - 0.03, drumDepth = 0.43, drumFloor = drumTop - drumDepth;
  const g = new THREE.CylinderGeometry(drumR, drumR, drumDepth, 80, 1, true);
  const uv = g.attributes.uv;
  const uRep = Math.round((2 * Math.PI * drumR) / 0.12), vRep = drumDepth / 0.132;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * uRep, 1 - uv.getY(i) * vRep);
  inward(g);
  cab.add(mesh("PillowDrum", g, drumM, 0, drumTop - drumDepth / 2, tubZ));
  const top_ = new THREE.RingGeometry(0.177, drumR + 0.004, 80); top_.rotateX(-Math.PI / 2);
  cab.add(mesh("DrumRim", top_, ringM, 0, drumTop + 0.0005, tubZ));
  const fl = new THREE.CircleGeometry(drumR, 64); fl.rotateX(-Math.PI / 2);
  cab.add(mesh("DrumFloor", fl, baseM, 0, drumFloor, tubZ));
  const PR = 0.19;
  const dish = new THREE.LatheGeometry([[PR, 0.0], [0.18, 0.006], [0.12, 0.02], [0.05, 0.03], [0.0, 0.032]].map(([r, y]) => new THREE.Vector2(r, y)), 64);
  { const p = dish.attributes.position, u = dish.attributes.uv; for (let i = 0; i < u.count; i++) u.setXY(i, 0.5 + p.getX(i) / (2 * PR), 0.5 - p.getZ(i) / (2 * PR)); }
  cab.add(mesh("Pulsator", dish, pulsM, 0, drumFloor + 0.002, tubZ));
  // the Magic filter: a grey channel down the drum's back wall with the white grid cap (lid-open renders)
  const fz = tubZ - drumR + 0.011;
  cab.add(box("FilterChannel", 0.075, 0.3, 0.018, channelM, 0, drumTop - 0.17, fz));
  const cap = new THREE.PlaneGeometry(0.052, 0.064);
  cab.add(mesh("FilterCap", cap, capM, 0, drumTop - 0.13, fz + 0.0095));
  // the detergent box at the back of the well, on the ring, with its print
  cab.add(box("DetergentBox", 0.15, 0.036, 0.04, boxM, 0, wy + 0.022, tubZ - 0.2));
  cab.add(mesh("DetergentPrint", flipV(new THREE.PlaneGeometry(0.052 * 632 / 624, 0.0042 * 58 / 50)), printM, 0, wy + 0.02, tubZ - 0.2 + 0.0209));
}

// ── the console: a black glass wedge across the back, its sloped face carrying the controls (panel_l/r: 550 x 95 mm at
// 12 px per mm), its top rounded into the back ──
{
  const prof = [[CON.d0 - 0.002, deckY(CON.d0)], [CON.d0, CON.y0], [CON.d1, CON.y1], [0.5605, 1.0365], [0.565, 1.0392], [D - 0.0015, H - 0.0002], [D - 0.0015, S + 0.002], [CON.d0 - 0.002, S + 0.002]];
  const sh = new THREE.Shape(prof.map(([d, y]) => new THREE.Vector2(d, y)));
  const g = new THREE.ExtrudeGeometry(sh, { depth: W - 0.003, bevelEnabled: false });
  g.rotateY(Math.PI / 2);
  g.translate(-(W - 0.003) / 2, 0, zF);
  cab.add(mesh("Console", g, consoleM));
  // the printed face, 0.9 mm off the console, in two halves
  const n = new THREE.Vector2(-(CON.y1 - CON.y0), CON.d1 - CON.d0).normalize();       // (d, y) normal of the face
  for (const [half, m] of [[0, panelL], [1, panelR]]) {
    const x0 = -W / 2 + 0.002 + half * (W / 2 - 0.002), x1 = x0 + W / 2 - 0.002;
    const P = [], UV = [];
    const lift = 0.0009;
    const pt = (x, t) => [x, CON.y0 + (CON.y1 - CON.y0) * t + n.y * lift, zF - (CON.d0 + (CON.d1 - CON.d0) * t + n.x * lift)];
    const quad = [[x0, 0], [x1, 0], [x1, 1], [x0, 1]];
    for (const k of [0, 1, 2, 0, 2, 3]) { const [x, t] = quad[k]; P.push(...pt(x, t)); UV.push((x - x0) / (x1 - x0), 1 - t); }
    const gf = new THREE.BufferGeometry();
    gf.setAttribute("position", new THREE.Float32BufferAttribute(P, 3));
    gf.setAttribute("uv", new THREE.Float32BufferAttribute(UV, 2));
    gf.computeVertexNormals();
    if (gf.attributes.normal.getZ(0) < 0) throw new Error("panel faces back");
    cab.add(mesh(half ? "PanelFaceRight" : "PanelFaceLeft", gf, m));
  }
}

// ── lid: hinged at its top back edge in front of the console; a grey frame round a large tinted toughened-glass window ──
const PIV = [LID.yB, LID.d1];
const lid = group("Lid", 0, PIV[0], zF - PIV[1]);
{
  const n = 30, pts = [];
  for (let i = 0; i <= n; i++) { const x = -LID.x + (2 * LID.x * i) / n; pts.push([x, zF - LID.d0 - sag(x) * 0.6]); }
  pts.push([LID.x, zF - LID.d1], [-LID.x, zF - LID.d1]);
  const win = rrect(-0.238, 0.238, zF - 0.04, zF - 0.432, 0.03);
  const s = new THREE.Shape(pts.map(([x, z]) => new THREE.Vector2(x, -z)));
  s.holes.push(new THREE.Path(win.map(([x, z]) => new THREE.Vector2(x, -z))));
  const bev = 0.003;
  const g = new THREE.ExtrudeGeometry(s, { depth: LID.t - 2 * bev, bevelEnabled: true, bevelSize: bev, bevelThickness: bev, bevelOffset: -bev, bevelSegments: 2, curveSegments: 6 });
  g.rotateX(-Math.PI / 2);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) { const d = zF - p.getZ(i); const f = (p.getY(i) + bev) / LID.t; p.setY(i, lidTop(d) - LID.t + f * LID.t); }
  g.computeVertexNormals();
  g.translate(0, -PIV[0], -(zF - PIV[1]));
  lid.add(mesh("LidFrame", g, coverM));
  // the glass, 2 mm under the frame's top, spanning the window and a little under the frame
  const gw = plate("LidWindow", rrect(-0.242, 0.242, zF - 0.036, zF - 0.436, 0.032), [], (x, z) => lidTop(zF - z) - 0.002, glassM);
  gw.geometry.translate(0, -PIV[0], -(zF - PIV[1]));
  lid.add(gw);
  // the grip lip under the lid's front edge
}
root.add(lid);

const parts = productParts(PRODUCTS, ID);
const clips = stateClips(root, parts);
saveZones(PRODUCTS, ID, root, parts);
await exportGLB(root, clips, OUT, {
  PanelLeft: `${T}/panel_l.jpg`, PanelRight: `${T}/panel_r.jpg`, PillowDrum: `${T}/drum.jpg`, Pulsator: `${T}/pulsator.jpg`,
  FilterCap: `${T}/filter_cap.jpg`, DetergentPrint: `${T}/detergent_print.png`,
}, { dir: `${TEX}/grain`, materials: {
  // the steel cabinet and the grey top cover get the soft peel, the moulded plinth the strong peel; nothing on the
  // console's printed glass, the lid glass or the decals
  Body: { type: "peel_soft" }, TopCover: { type: "peel_soft", clearcoat: [0.4, 0.15] }, Plinth: { type: "peel_strong" },
} });
