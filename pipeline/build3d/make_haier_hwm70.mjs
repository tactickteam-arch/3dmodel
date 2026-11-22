// Haier HWM70-306S8, 7 kg fully automatic top-load washing machine with Ultra Fresh Air, Dark Jade Silver.
// Built to Haier's size, 520 W x 905 H x 540 D mm (Haier India's page for this model, "Dimension WxDxH (mm): 520*540*905"),
// and to Haier's own gallery for this model: two 3/4 views (the cabinet, the side grooves and handle, the top cover), the
// lid-up view, the lid-shut and lid-up views from above (the control panel, the rear ridge, the drum and pulsator), plus
// Sangeetha's photos of the same model. The front is bowed: both top views show the front edge 14-15 mm further forward at
// the middle than 207 mm either side, an arc of about 1.52 m radius (ESTIMATED; the cabinet's sides and back are flat).
// Copied in structure from make_samsung_wa80bg.mjs (the closest top-loader builder) and changed to this model's own shapes:
// a front control panel, a glass lid hinged on a rear ridge, side grooves and handles. Sizes Haier doesn't publish are
// measured off the photos (private/research/haier_hwm70/NOTES.md).
// usage: node make_haier_hwm70.mjs <entry.json> <tex dir> <out.glb>
import { THREE, mat, mesh, box, group, inward, stateClips, exportGLB, productParts, saveZones } from "./lib.mjs";
import { mergeVertices } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import fs from "node:fs";
import { uvDecal } from "./decal_curved.mjs";

const [PRODUCTS, TEX, OUT] = process.argv.slice(2);
const ID = "haier-hwm70-306s8";
const T = `${TEX}/haier_hwm70`;

// ── size (metres): x across, y up, z front (+) to back (-); d is the distance back from the front edge at the middle ──
const W = 0.52, H = 0.905, D = 0.54;
const zF = D / 2, zB = -D / 2;
const R = 1.52;                                   // the front's bow (plan radius)
const sag = (x) => (x * x) / (2 * R);
const zAt = (d, x = 0) => zF - d - sag(x);        // a point d behind the bowed front line
const plinthTop = 0.034, S = 0.806;               // plinth top, cabinet top (the seam under the top cover)
const lipTop = 0.846, deckY = 0.850;              // the top cover's rounded lip and its deck
const RC = 0.02, RB = 0.012;                      // plan corner radii, front and back

// ── materials ──
const bodyM = mat("Body", 0x525458, { metal: 0.55, rough: 0.32 });                 // Dark Jade Silver PCM
const coverM = mat("TopCover", 0x55575b, { metal: 0.15, rough: 0.45 });
const black = mat("BlackPlastic", 0x111113, { rough: 0.3 });
const plinthM = mat("Plinth", 0x161618, { rough: 0.75 });
const footM = mat("Foot", 0x101112, { rough: 0.8 });
const panelM = mat("PanelFace", 0xffffff, { rough: 0.28 });
const trimM = mat("SilverTrim", 0xb4b7bb, { metal: 0.8, rough: 0.3 });
const glassM = mat("LidGlass", 0x060607, { rough: 0.05, opacity: 0.93, side: THREE.DoubleSide });
const wellM = mat("Well", 0x77797d, { rough: 0.5 });
const ringM = mat("BalanceRing", 0xc4c6c9, { rough: 0.45 });
const drumM = mat("PillowDrum", 0xffffff, { metal: 0.3, rough: 0.35, side: THREE.DoubleSide });
const baseM = mat("DrumBase", 0xb9bbbf, { rough: 0.45 });
const pulsM = mat("Pulsator", 0xffffff, { rough: 0.35 });
const vaneM = mat("PulsatorVane", 0x97a2dc, { rough: 0.35 });
const filterM = mat("MagicFilter", 0x6f80e0, { rough: 0.4 });
const beigeM = mat("TubPart", 0xd9d2c0, { rough: 0.5 });
const hingeM = mat("Hinge", 0x2a2b2e, { rough: 0.4 });
const pinM = mat("HingePin", 0xb9bbbf, { metal: 0.6, rough: 0.35 });
const grooveM = mat("Groove", 0x45474b, { metal: 0.35, rough: 0.45 });
const handleM = mat("HandleInsert", 0x232427, { rough: 0.45 });
const ventM = mat("Vent", 0x030304, { rough: 0.8 });
const printM = mat("RidgePrint", 0xffffff, { rough: 0.45, opacity: 0.999 });
const knobM = mat("FreshAirKnob", 0x2c2d30, { rough: 0.35 });
const knobRing = mat("FreshAirRing", 0xa9acb0, { metal: 0.7, rough: 0.3 });
const cordM = mat("Cord", 0x18191b, { rough: 0.6 });
const plugM = mat("Plug", 0x1c1d1f, { rough: 0.5 });
const pinMetal = mat("PlugPin", 0xc9b26a, { metal: 0.9, rough: 0.3 });
const hoseM = mat("Hose", 0x6c6e72, { rough: 0.7 });
const rearM = mat("RearCover", 0x4f5155, { metal: 0.3, rough: 0.5 });

const cyl = (name, rt, rb, h, m, x, y, z, seg = 24) => mesh(name, new THREE.CylinderGeometry(rt, rb, h, seg), m, x, y, z);

// ── plan outline: [x, z] points round the cabinet, the bowed front, rounded corners, flat sides and back ──
function outline(inset = 0, n = 24) {
  const w = W / 2 - inset, zb = zB + inset, rc = RC, rb = RB;
  const zf = (x) => zF - inset - sag(x);
  const pts = [];
  const xs = w - rc;
  for (let i = 0; i <= n; i++) { const x = -xs + (2 * xs * i) / n; pts.push([x, zf(x)]); }   // front, left to right
  const zc = zf(xs) - rc;
  for (let i = 1; i <= 6; i++) { const a = (Math.PI / 2) * (1 - i / 6); pts.push([xs + rc * Math.cos(a), zc + rc * Math.sin(a)]); }
  for (let i = 0; i <= 6; i++) { const a = -(Math.PI / 2) * (i / 6); pts.push([w - rb + rb * Math.cos(a), zb + rb + rb * Math.sin(a)]); }
  for (let i = 0; i <= 6; i++) { const a = -Math.PI / 2 - (Math.PI / 2) * (i / 6); pts.push([-w + rb + rb * Math.cos(a), zb + rb + rb * Math.sin(a)]); }
  for (let i = 0; i < 6; i++) { const a = Math.PI + (Math.PI / 2) * (i / 6); pts.push([-xs + rc * Math.cos(a), zc - rc * Math.sin(a)]); }
  return pts;
}
// a vertical strip along a polyline of [x, z] from y0 to y1, faces outward (away from cx, cz) or inward
function ribbon(name, pts, y0, y1, m, { closed = false, inwardFace = false, centre = [0, 0] } = {}) {
  const P = [], N = [], U = [];
  const list = closed ? [...pts, pts[0]] : pts;
  let len = 0;
  for (let i = 0; i < list.length - 1; i++) {
    const [ax, az] = list[i], [bx, bz] = list[i + 1];
    let nx = bz - az, nz = -(bx - ax);
    const l = Math.hypot(nx, nz) || 1; nx /= l; nz /= l;
    const mx = (ax + bx) / 2 - centre[0], mz = (az + bz) / 2 - centre[1];
    if ((nx * mx + nz * mz < 0) !== inwardFace) { nx = -nx; nz = -nz; }
    const seg = Math.hypot(bx - ax, bz - az);
    const quad = [[ax, y0, az, len], [bx, y0, bz, len + seg], [bx, y1, bz, len + seg], [ax, y1, az, len]];
    // winding: counter-clockwise seen from the normal side
    const a = quad[0], b = quad[1], c = quad[2], d = quad[3];
    const cross = (b[0] - a[0]) * (d[1] - a[1]) * 0 + ((b[2] - a[2]) * (d[1] - a[1]) - 0) * 0;
    const e1 = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], e2 = [d[0] - a[0], d[1] - a[1], d[2] - a[2]];
    const nn = [e1[1] * e2[2] - e1[2] * e2[1], e1[2] * e2[0] - e1[0] * e2[2], e1[0] * e2[1] - e1[1] * e2[0]];
    const tri = nn[0] * nx + nn[2] * nz > 0 ? [a, b, c, a, c, d] : [a, c, b, a, d, c];
    void cross;
    for (const v of tri) { P.push(v[0], v[1], v[2]); N.push(nx, 0, nz); U.push(v[3] / 0.2, v[1] / 0.2); }
    len += seg;
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(P, 3));
  g.setAttribute("normal", new THREE.Float32BufferAttribute(N, 3));
  g.setAttribute("uv", new THREE.Float32BufferAttribute(U, 2));
  return mesh(name, mergeVertices(g, 1e-7), m);
}
// a flat horizontal plate at height y from a plan outline ([x, z] points) with holes, facing up (or down)
function plate(name, pts, holes, y, m, { down = false, uvFn = null } = {}) {
  const s = new THREE.Shape(pts.map(([x, z]) => new THREE.Vector2(x, -z)));
  for (const h of holes) s.holes.push(new THREE.Path(h.map(([x, z]) => new THREE.Vector2(x, -z))));
  const g = new THREE.ShapeGeometry(s, 4);
  g.rotateX(-Math.PI / 2);
  if (down) { g.rotateX(Math.PI); g.scale(1, 1, -1); inward(g); for (let i = 0; i < g.attributes.normal.count; i++) g.attributes.normal.setXYZ(i, 0, -1, 0); }
  if (uvFn) { const p = g.attributes.position, u = g.attributes.uv; for (let i = 0; i < p.count; i++) u.setXY(i, ...uvFn(p.getX(i), p.getZ(i))); }
  return mesh(name, g, m, 0, y, 0);
}
const rrect = (x0, x1, z0, z1, r, n = 6) => {           // a plan rounded rectangle, z0 front (larger z), z1 back
  const p = [];
  const arc = (cx, cz, a0) => { for (let i = 0; i <= n; i++) { const a = a0 + (Math.PI / 2) * (i / n); p.push([cx + r * Math.cos(a), cz + r * Math.sin(a)]); } };
  arc(x1 - r, z0 - r, 0); arc(x0 + r, z0 - r, Math.PI / 2); arc(x0 + r, z1 + r, Math.PI); arc(x1 - r, z1 + r, 1.5 * Math.PI);
  return p;
};
const circle = (cx, cz, r, n = 48) => Array.from({ length: n }, (_, i) => [cx + r * Math.cos((i / n) * 2 * Math.PI), cz + r * Math.sin((i / n) * 2 * Math.PI)]);

const root = group("HaierHWM70");
const cab = group("Cabinet");
root.add(cab);

// ── base: the black plinth (34 mm at the front, measured on Haier's 3/4 view), its front skirt ending 12 mm above the floor
// between the corner legs (Sangeetha's front photo), the corner legs on the manual's two adjustable front feet and two
// fixed rear feet ──
{
  const o = outline(0.001);
  cab.add(ribbon("Plinth", o, 0.012, plinthTop, plinthM, { closed: true }));
  cab.add(plate("PlinthUnder", o, [], 0.012, plinthM, { down: true }));
  for (const sx of [-1, 1]) for (const back of [false, true]) {
    const x = sx * (W / 2 - 0.035), z = back ? zB + 0.035 : zAt(0.035, x);
    cab.add(box("PlinthLeg", 0.055, 0.008, 0.05, plinthM, x, 0.008, z));
    cab.add(cyl(back ? "FootFixed" : "FootAdjustable", 0.017, 0.017, 0.004, footM, x, 0.002, z, 20));
  }
}

// ── cabinet: the bowed front and its corners and the back as one wrap; the two sides are flat panels with their grooves
// and handle cut out (Haier's 3/4 views: the right side has the long groove at the front, the short groove and the
// handle at the back; the left side the other way round) ──
const SIDE = {
  long: { w: 0.055, y0: 0.115, y1: 0.74, d: 0.125 },
  short: { w: 0.055, y0: 0.12, y1: 0.465, d: 0.41 },
  handle: { w: 0.08, h: 0.083, y: 0.556, d: 0.455 },
};
{
  const o = outline(0);
  const i0 = o.findIndex(([x, z]) => x >= W / 2 - 1e-6);                 // first point on the right side
  const right = []; for (let i = 0; i < o.length; i++) if (Math.abs(o[i][0] - W / 2) < 1e-6) right.push(i);
  const left = []; for (let i = 0; i < o.length; i++) if (Math.abs(o[i][0] + W / 2) < 1e-6) left.push(i);
  void i0;
  // the front wrap: the left side's front end, round the front, to the right side's front end
  const rf = Math.min(...right), lb = Math.max(...left);
  const front = [...o.slice(lb), ...o.slice(0, rf + 1)];
  const rb = Math.max(...right), lf = Math.min(...left);
  const back = o.slice(rb, lf + 1);
  cab.add(ribbon("CabinetFront", front, plinthTop, S, bodyM, { centre: [0, 0.05] }));
  cab.add(ribbon("CabinetBack", back, plinthTop, S, bodyM, { centre: [0, 0.05] }));
  const zFront = o[rf][1], zBack = o[rb][1];
  for (const sx of [1, -1]) {
    // groove and handle positions: d from the front on the right side, from the back on the left
    const dz = (d) => (sx > 0 ? zF - d : zB + d);
    const pill = (g) => {
      const p = [], r = g.w / 2, cz = dz(g.d), n = 10;
      for (let i = 0; i <= n; i++) { const a = Math.PI + (Math.PI * i) / n; p.push([cz + r * Math.cos(a), g.y0 + r + r * Math.sin(a)]); }
      for (let i = 0; i <= n; i++) { const a = (Math.PI * i) / n; p.push([cz + r * Math.cos(a), g.y1 - r + r * Math.sin(a)]); }
      return p;
    };
    const hd = SIDE.handle, hz = dz(hd.d);
    const hole = [[hz - hd.w / 2, hd.y - hd.h / 2], [hz + hd.w / 2, hd.y - hd.h / 2], [hz + hd.w / 2, hd.y + hd.h / 2], [hz - hd.w / 2, hd.y + hd.h / 2]];
    const holes = [pill(SIDE.long), pill(SIDE.short), hole];
    // the side panel in its own plane: shape X = -z (right side) or z (left side), shape Y = y
    const map = ([z, y]) => new THREE.Vector2(sx > 0 ? -z : z, y);
    const s = new THREE.Shape([[zFront, plinthTop], [zBack, plinthTop], [zBack, S], [zFront, S]].map(map));
    for (const h of holes) s.holes.push(new THREE.Path(h.map(map)));
    const g = new THREE.ShapeGeometry(s, 6);
    g.rotateY(sx * Math.PI / 2);
    cab.add(mesh("CabinetSide", g, bodyM, sx * W / 2, 0, 0));
    // the pockets behind the holes: walls 9 mm deep (groove) and 26 mm (handle), and a floor
    const pocket = (name, pts, depth, m) => {
      const wall = [];
      const P = [], N = [];
      for (let i = 0; i < pts.length; i++) {
        const [az, ay] = pts[i], [bz, by] = pts[(i + 1) % pts.length];
        const mz = (az + bz) / 2, my = (ay + by) / 2;
        const cz = pts.reduce((a, p) => a + p[0], 0) / pts.length, cy = pts.reduce((a, p) => a + p[1], 0) / pts.length;
        let nz = -(by - ay), ny = bz - az; const l = Math.hypot(nz, ny) || 1; nz /= l; ny /= l;
        if (nz * (cz - mz) + ny * (cy - my) < 0) { nz = -nz; ny = -ny; }     // facing into the pocket
        const x0 = sx * W / 2, x1 = sx * (W / 2 - depth);
        const A = [x0, ay, az], B = [x0, by, bz], C = [x1, by, bz], Dd = [x1, ay, az];
        const e1 = [B[0] - A[0], B[1] - A[1], B[2] - A[2]], e2 = [Dd[0] - A[0], Dd[1] - A[1], Dd[2] - A[2]];
        const nn = [e1[1] * e2[2] - e1[2] * e2[1], e1[2] * e2[0] - e1[0] * e2[2], e1[0] * e2[1] - e1[1] * e2[0]];
        const tri = nn[1] * ny + nn[2] * nz > 0 ? [A, B, C, A, C, Dd] : [A, C, B, A, Dd, C];
        for (const v of tri) { P.push(...v); N.push(0, ny, nz); }
        void wall;
      }
      const gw = new THREE.BufferGeometry();
      gw.setAttribute("position", new THREE.Float32BufferAttribute(P, 3));
      gw.setAttribute("normal", new THREE.Float32BufferAttribute(N, 3));
      cab.add(mesh(name, gw, m));
      const fs_ = new THREE.Shape(pts.map(map));
      const gf = new THREE.ShapeGeometry(fs_, 6);
      gf.rotateY(sx * Math.PI / 2);
      cab.add(mesh(name + "Floor", gf, m, sx * (W / 2 - depth), 0, 0));
    };
    pocket("Groove", pill(SIDE.long), 0.009, grooveM);
    pocket("Groove", pill(SIDE.short), 0.009, grooveM);
    pocket("HandlePocket", hole, 0.026, handleM);
    // the handle's black insert frame round the opening, 2 mm proud at most inside the cabinet's width
    const fr = new THREE.Shape([[hz - hd.w / 2 - 0.008, hd.y - hd.h / 2 - 0.008], [hz + hd.w / 2 + 0.008, hd.y - hd.h / 2 - 0.008], [hz + hd.w / 2 + 0.008, hd.y + hd.h / 2 + 0.008], [hz - hd.w / 2 - 0.008, hd.y + hd.h / 2 + 0.008]].map(map));
    fr.holes.push(new THREE.Path(hole.map(map)));
    const gfr = new THREE.ShapeGeometry(fr);
    gfr.rotateY(sx * Math.PI / 2);
    cab.add(mesh("HandleFrame", gfr, handleM, sx * (W / 2 + 0.0004), 0, 0));
    // the grip lip across the top of the handle opening
    cab.add(box("HandleGrip", 0.02, 0.012, hd.w, handleM, sx * (W / 2 - 0.012), hd.y + hd.h / 2 - 0.006, hz));
  }
}

// ── the back: a cover plate on the back (the manual's rear drawing, ESTIMATED size), standing to the cabinet's depth ──
{
  // 0.7 mm proud of the back, its X ribs 1.3-1.7 mm more: both inside the 3 mm the gate allows past 540 mm
  cab.add(box("RearCover", 0.36, 0.6, 0.0006, rearM, 0, 0.42, zB - 0.0004));
  for (const s of [-1, 1]) {
    const rib = box("RearCoverRib", 0.012, 0.66, 0.0006, rearM, 0, 0.42, zB - 0.0013 - (s > 0 ? 0.0004 : 0));
    rib.rotation.z = s * 0.54;
    cab.add(rib);
  }
}

// ── top cover: grey skirt from the cabinet top to its lip, a rounded edge to the deck, the deck with the well opening ──
const WELL = { x: 0.232, d0: 0.096, d1: 0.405, r: 0.04 };
const tubD = 0.245, tubZ = zAt(tubD);
{
  const o = outline(0.0015);
  cab.add(ribbon("TopCoverSkirt", o, S, lipTop, coverM, { closed: true, centre: [0, 0.05] }));
  // the 1.5 mm ledge where the cover's skirt sits on the cabinet's top edge, closed: open, it was a slit through which the
  // background showed past the cabinet's inside at a low angle from behind
  cab.add(plate("TopCoverSeat", outline(0), [outline(0.0015)], S, bodyM));
  // the rounded lip: three bands stepping 1.2 mm in each
  let prev = o;
  [[0.0025, lipTop + 0.0018], [0.004, lipTop + 0.0032], [0.0055, deckY]].forEach(([ins, y], i, arr) => {
    const nxt = outline(0.0015 + ins);
    const y0 = i ? arr[i - 1][1] : lipTop;
    // a sloped band between prev (at y0) and nxt (at y)
    const P = [], N = [];
    for (let k = 0; k < prev.length; k++) {
      const a = prev[k], b = prev[(k + 1) % prev.length], c = nxt[(k + 1) % nxt.length], d = nxt[k];
      const A = [a[0], y0, a[1]], B = [b[0], y0, b[1]], C = [c[0], y, c[1]], Dd = [d[0], y, d[1]];
      const e1 = [B[0] - A[0], B[1] - A[1], B[2] - A[2]], e2 = [Dd[0] - A[0], Dd[1] - A[1], Dd[2] - A[2]];
      let nn = [e1[1] * e2[2] - e1[2] * e2[1], e1[2] * e2[0] - e1[0] * e2[2], e1[0] * e2[1] - e1[1] * e2[0]];
      const mx = (a[0] + b[0]) / 2, mz = (a[1] + b[1]) / 2 - 0.05;
      const out = nn[0] * mx + nn[2] * mz + nn[1] * 0.02 > 0;
      const tri = out ? [A, B, C, A, C, Dd] : [A, C, B, A, Dd, C];
      if (!out) nn = nn.map((v) => -v);
      const l = Math.hypot(...nn); nn = nn.map((v) => v / l);
      for (const v of tri) { P.push(...v); N.push(...nn); }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(P, 3));
    g.setAttribute("normal", new THREE.Float32BufferAttribute(N, 3));
    cab.add(mesh("TopCoverLip", g, coverM));
    prev = nxt;
  });
  const well = rrect(-WELL.x, WELL.x, zAt(WELL.d0), zAt(WELL.d1), WELL.r);
  cab.add(plate("TopCoverDeck", prev, [well], deckY, coverM));
  // the well: grey walls down to the tub cover, the tub cover with its round opening, the light balance ring
  const wy = 0.8;
  cab.add(ribbon("WellWall", [...well], wy, deckY, wellM, { closed: true, inwardFace: true, centre: [0, zAt((WELL.d0 + WELL.d1) / 2)] }));
  cab.add(plate("TubCover", well, [circle(0, tubZ, 0.168, 64)], wy, wellM));
  const ring = new THREE.LatheGeometry([[0.168, 0.0], [0.165, -0.004], [0.15, -0.012], [0.134, -0.016], [0.13, -0.022], [0.132, -0.03]].map(([r, y]) => new THREE.Vector2(r, y)), 72);
  cab.add(mesh("BalanceRing", ring, ringM, 0, wy, tubZ));
  // the Pillow Drum: an inward cylinder with Haier's pillow texture, its floor, the Balance Clean pulsator
  const drumR = 0.2, drumTop = wy - 0.03, drumDepth = 0.4, drumFloor = drumTop - drumDepth;
  const g = new THREE.CylinderGeometry(drumR, drumR, drumDepth, 72, 1, true);
  const uv = g.attributes.uv;
  const uRep = Math.round((2 * Math.PI * drumR) / 0.124), vRep = drumDepth / 0.124;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * uRep, 1 - uv.getY(i) * vRep);
  inward(g);
  cab.add(mesh("PillowDrum", g, drumM, 0, drumTop - drumDepth / 2, tubZ));
  const top_ = new THREE.RingGeometry(drumR - 0.004, 0.168, 72); top_.rotateX(-Math.PI / 2);
  cab.add(mesh("DrumRim", top_, ringM, 0, drumTop + 0.0005, tubZ));
  const fl = new THREE.CircleGeometry(drumR, 64); fl.rotateX(-Math.PI / 2);
  cab.add(mesh("DrumFloor", fl, baseM, 0, drumFloor, tubZ));
  const PR = 0.158;
  const dish = new THREE.LatheGeometry([[PR, 0.0], [0.15, 0.004], [0.11, 0.016], [0.04, 0.028], [0.0, 0.03]].map(([r, y]) => new THREE.Vector2(r, y)), 64);
  { const p = dish.attributes.position, u = dish.attributes.uv; for (let i = 0; i < u.count; i++) u.setXY(i, 0.5 + p.getX(i) / (2 * PR), 0.5 + p.getZ(i) / (2 * PR)); }
  cab.add(mesh("Pulsator", dish, pulsM, 0, drumFloor + 0.002, tubZ));
  // the four raised vanes, as the photos show them: a cross from the hub to the rim
  for (let i = 0; i < 4; i++) {
    const a = (i * Math.PI) / 2;
    const v = box("PulsatorVane", 0.12, 0.008, 0.014, vaneM, Math.cos(a) * 0.085, drumFloor + 0.021, tubZ + Math.sin(a) * 0.085);
    v.rotation.y = -a; v.rotation.z = -0.13; cab.add(v);
  }
  cab.add(cyl("PulsatorHub", 0.012, 0.014, 0.01, vaneM, 0, drumFloor + 0.036, tubZ, 20));
  // the two blue Magic filters on the drum wall (back left and front right in the top photos) and the light
  // perforated part on the back right; sizes ESTIMATED from the top photos
  const onWall = (name, m, ang, w, h, t, y) => {
    const b = box(name, w, h, t, m, Math.sin(ang) * (drumR - t / 2 - 0.002), y, tubZ + Math.cos(ang) * (drumR - t / 2 - 0.002));
    b.rotation.y = ang; cab.add(b);
  };
  onWall("MagicFilter", filterM, -2.35, 0.06, 0.15, 0.022, drumTop - 0.09);
  onWall("MagicFilter", filterM, 0.75, 0.06, 0.15, 0.022, drumTop - 0.11);
  onWall("TubPart", beigeM, 2.55, 0.05, 0.03, 0.02, drumTop - 0.025);
  // the notch at the back of the balance ring (Sangeetha's top photo)
  cab.add(box("RingNotch", 0.07, 0.006, 0.02, hingeM, 0, wy - 0.008, tubZ - 0.155));
}

let printTex = {};
// ── the control panel strip: Haier's top photo, a crescent between the lip and the silver trim, sloping up 13 mm ──
// photo px: x = 600 + 2.2 * x(mm), y = 584 - 2.2 * d(mm); the texture spans photo x 48-1146, y 406-566
// (the strip's front edge stands 0.8 mm over the deck, so the whole strip is clear of it: at 0.849 its front 5 mm ran under
// the deck and the words under the three round keys were hidden)
const PANEL = { y0: deckY + 0.0008, y1: 0.862 };
const dFront = (x) => 0.0095 + sag(x);                  // the strip's front edge, 9.5 mm behind the bowed front
const dBack = (x) => 0.0827 + (x * x) / (2 * 5.0);      // the silver trim's front edge (a flatter arc)
const panelY = (d, x) => PANEL.y0 + (PANEL.y1 - PANEL.y0) * (d - dFront(x)) / (dBack(x) - dFront(x));
const panelUV = (x, z) => { const d = zF - z; return [((600 + 2200 * x) - 48) / 1098, ((584 - 2200 * d) - 406) / 160]; };
{
  const xe = 0.2495, n = 40, pts = [];
  for (let i = 0; i <= n; i++) { const x = -xe + (2 * xe * i) / n; pts.push([x, zF - dFront(x)]); }
  for (let i = n; i >= 0; i--) { const x = -xe + (2 * xe * i) / n; pts.push([x, zF - dBack(x)]); }
  // the face as a grid between the two arcs (n across, m from front to back), so it slopes evenly from the front edge to the
  // trim everywhere (a shape filled from its outline alone has long triangles along the front arc that stay at the front
  // edge's height, flat for up to 20 mm in the middle)
  const m = 8, P = [], UV = [], I = [];
  for (let i = 0; i <= n; i++) {
    const x = -xe + (2 * xe * i) / n;
    for (let j = 0; j <= m; j++) {
      const d = dFront(x) + (dBack(x) - dFront(x)) * (j / m), z = zF - d;
      P.push(x, panelY(d, x), z); UV.push(...panelUV(x, z));
    }
  }
  for (let i = 0; i < n; i++) for (let j = 0; j < m; j++) {
    const a = i * (m + 1) + j, b = a + m + 1, c = a + 1, d = b + 1;
    I.push(a, b, c, b, d, c);                              // facing up: x grows to the right, d grows to the back
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(P, 3));
  g.setAttribute("uv", new THREE.Float32BufferAttribute(UV, 2));
  g.setIndex(I);
  g.computeVertexNormals();
  if (g.attributes.normal.getY(0) < 0) throw new Error("PanelFace faces down");
  const panelFace = mesh("PanelFace", g, panelM);
  cab.add(panelFace);
  // the strip's two ends and its front edge closed down to the deck
  const edge = pts.slice(0, n + 1).map(([x, z]) => [x, z]);
  cab.add(ribbon("PanelEdge", edge, deckY - 0.002, PANEL.y0, black, { centre: [0, 0] }));
  for (const sx of [-1, 1]) {
    const x = sx * xe, zf = zF - dFront(x), zb = zF - dBack(x);
    const tri = new THREE.BufferGeometry();
    const v = [[x, deckY - 0.002, zf], [x, PANEL.y0, zf], [x, PANEL.y1, zb], [x, deckY - 0.002, zb]];
    const idx = sx > 0 ? [0, 2, 1, 0, 3, 2] : [0, 1, 2, 0, 2, 3];
    tri.setAttribute("position", new THREE.Float32BufferAttribute(idx.flatMap((k) => v[k]), 3));
    tri.setAttribute("normal", new THREE.Float32BufferAttribute(idx.flatMap(() => [sx, 0, 0]), 3));
    cab.add(mesh("PanelEnd", tri, black));
  }
  // the silver trim behind the strip and the gap to the lid
  const trim = [];
  for (let i = 0; i <= n; i++) { const x = -xe + (2 * xe * i) / n; trim.push([x, zF - dBack(x)]); }
  for (let i = n; i >= 0; i--) { const x = -xe + (2 * xe * i) / n; trim.push([x, zF - dBack(x) - 0.003]); }
  cab.add(plate("SilverTrim", trim, [], PANEL.y1 + 0.0004, trimM));
  // the strip's print at 12 px per mm for a close look (tex_haier_hwm70.py: the same drawing again, in two halves), laid
  // 0.9 mm over the strip and clipped to its crescent; the strip's own finish
  // (the grid is given per half: a 10 mm x 2.7 mm cell, as fine down the strip as its arcing front edge needs; the decal
  // tool's own count measures across the middle, which for a half reaching the strip's slanted end is off the strip)
  for (const [k, d] of Object.entries(JSON.parse(fs.readFileSync(`${T}/decals.json`, "utf8")))) {
    uvDecal(panelFace, d.rect, mat(`Print_${k}`, 0xffffff, { rough: 0.28 }), { name: `PrintDecal_${k}`, clip: true, nu: Math.ceil(0.499 * (d.rect[2] - d.rect[0]) / 0.01), nv: 24 });
    printTex[`Print_${k}`] = `${T}/${d.file}`;
  }
  // raised keys: the three round buttons and the two framed keys stand 1.2 mm proud; their tops carry the panel print,
  // from keys.jpg (the same drawing at 12 px per mm over the five keys; keys.json: its box as a fraction of the strip's u, v)
  const KB = JSON.parse(fs.readFileSync(`${T}/keys.json`, "utf8")).rect;
  const keyM = mat("KeyFace", 0xffffff, { rough: 0.28 });
  const keyUV = (x, z) => { const [u, v] = panelUV(x, z); return [(u - KB[0]) / (KB[2] - KB[0]), (v - KB[1]) / (KB[3] - KB[1])]; };
  const key = (name, shape, cx, d) => {
    const z = zF - d;
    const g = new THREE.ExtrudeGeometry(shape, { depth: 0.0012, bevelEnabled: false, curveSegments: 24 });
    g.rotateX(-Math.PI / 2);
    g.translate(cx, 0, z);
    const p = g.attributes.position, u = g.attributes.uv;
    const base = panelY(d, cx);
    for (let i = 0; i < p.count; i++) { const x = p.getX(i), zz = p.getZ(i); p.setY(i, panelY(zF - zz, x) + p.getY(i) + 0.0002); u.setXY(i, ...keyUV(x, zz)); }
    void base;
    g.computeVertexNormals();
    cab.add(mesh(name, g, [keyM, black]));
  };
  const disc = (r) => { const s_ = new THREE.Shape(); s_.absarc(0, 0, r, 0, Math.PI * 2, false); return s_; };
  const rr = (w, h, r) => { const s_ = new THREE.Shape(); const x0 = -w / 2, y0 = -h / 2; s_.moveTo(x0 + r, y0); s_.lineTo(-x0 - r, y0); s_.absarc(-x0 - r, y0 + r, r, -Math.PI / 2, 0); s_.lineTo(-x0, -y0 - r); s_.absarc(-x0 - r, -y0 - r, r, 0, Math.PI / 2); s_.lineTo(x0 + r, -y0); s_.absarc(x0 + r, -y0 - r, r, Math.PI / 2, Math.PI); s_.lineTo(x0, y0 + r); s_.absarc(x0 + r, y0 + r, r, Math.PI, 1.5 * Math.PI); return s_; };
  key("ButtonWaterLevel", disc(0.0093), -0.058, 0.0302);
  key("ButtonDelay", disc(0.0093), -0.0011, 0.0302);
  key("ButtonProgram", disc(0.0093), 0.0582, 0.0302);
  key("ButtonStartPause", rr(0.0205, 0.015, 0.003), 0.0893, 0.0366);
  key("ButtonPower", rr(0.0205, 0.0155, 0.003), 0.1111, 0.0545);
}

// ── the rear ridge behind the lid: black, its front slope carrying the vents and the "ULTRA FRESH AIR" print, the
// Ultra Fresh Air knob right of the middle and the raised block at the right (Haier's lid-shut views) ──
const RIDGE = { d0: 0.452, d1: 0.47, top: 0.893 };
{
  const prof = [[RIDGE.d0, deckY - 0.001], [RIDGE.d0, 0.858], [RIDGE.d1, RIDGE.top], [D - 0.008, RIDGE.top], [D - 0.0015, RIDGE.top - 0.007], [D - 0.0015, S + 0.002], [RIDGE.d0, S + 0.002]];
  const sh = new THREE.Shape(prof.map(([d, y]) => new THREE.Vector2(d, y)));
  const g = new THREE.ExtrudeGeometry(sh, { depth: W - 0.012, bevelEnabled: false });
  g.rotateY(Math.PI / 2);
  g.translate(-(W - 0.012) / 2, 0, zF);
  cab.add(mesh("RearRidge", g, black));
  // the raised block at the right, 6 mm higher (photo: from 105 mm right of the middle to the end)
  cab.add(box("RidgeBlock", W / 2 - 0.006 - 0.105, 0.006, D - 0.0015 - RIDGE.d1 - 0.012, black, (0.105 + W / 2 - 0.006) / 2, RIDGE.top + 0.003, zF - (RIDGE.d1 + 0.006 + (D - 0.0015 - RIDGE.d1 - 0.012) / 2)));
  // the knob (ring and cap): its top is the machine's highest point, 905 mm
  const kz = zF - 0.505;
  cab.add(cyl("FreshAirRing", 0.017, 0.018, 0.006, knobRing, 0.069, RIDGE.top + 0.003, kz, 32));
  cab.add(cyl("FreshAirKnob", 0.012, 0.013, 0.012 - 0.0005, knobM, 0.069, H - 0.006 - 0.00025, kz, 32));
  // vents: two groups of 22 slots on the slope (photo: x -228..-96 mm and +81..+221 mm)
  const ang = Math.atan2(RIDGE.top - 0.858, RIDGE.d1 - RIDGE.d0);
  const mid = [(RIDGE.d0 + RIDGE.d1) / 2, (0.858 + RIDGE.top) / 2];
  for (const [x0, x1] of [[-0.228, -0.096], [0.081, 0.221]]) {
    const nS = 22;
    for (let i = 0; i < nS; i++) {
      const x = x0 + ((x1 - x0) * (i + 0.5)) / nS;
      const v = box("Vent", 0.0024, 0.0004, 0.022, ventM, x, mid[1] + 0.0004 * Math.cos(ang), zF - mid[0] + 0.0004 * Math.sin(ang));
      v.rotation.x = ang; cab.add(v);
    }
  }
  // the print, centred between the left vents and the knob: 52 x 7 mm decal on the slope
  const pr = mesh("RidgePrint", new THREE.PlaneGeometry(0.0519, 0.007), printM, -0.025, mid[1] + 0.0007 * Math.cos(ang), zF - mid[0] + 0.0007 * Math.sin(ang));
  pr.rotation.x = -(Math.PI / 2 - ang);
  cab.add(pr);
  // the two hinge blocks at the back of the well (Sangeetha's top photo: -216..-161 mm and +119..+180 mm)
  for (const [x0, x1] of [[-0.216, -0.161], [0.119, 0.18]]) {
    cab.add(box("Hinge", x1 - x0, 0.022, 0.03, hingeM, (x0 + x1) / 2, deckY + 0.011, zF - 0.437));
    const outer = Math.abs(x0) > Math.abs(x1) ? x0 : x1;
    cab.add(cyl("HingePin", 0.006, 0.006, 0.008, pinM, outer + Math.sign(outer) * 0.004, deckY + 0.014, zF - 0.437, 16).rotateZ(Math.PI / 2));
  }
}

// ── the screw caps on the top cover's sides (right side near the front, left side near the back) ──
for (const sx of [1, -1]) {
  const z = sx > 0 ? zF - 0.075 : zB + 0.075;
  const c = new THREE.SphereGeometry(0.006, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2); c.scale(1, 0.33, 1);
  const m = mesh("ScrewCap", c, coverM, sx * (W / 2 - 0.0035), (S + lipTop) / 2, z);
  m.rotation.z = -sx * Math.PI / 2; cab.add(m);
}

// ── lid: hinged at its back edge on the ridge, a black frame round a large tinted glass window, its front edge on the
// silver trim (Haier's lid-shut view) ──
const LID = { d0: 0.0855, d1: RIDGE.d0 - 0.002, x: 0.247, yF: 0.869, yB: 0.878, t: 0.016 };
const lidTop = (d) => LID.yF + (LID.yB - LID.yF) * (d - LID.d0) / (LID.d1 - LID.d0);
const PIV = [LID.yB, LID.d1];
const lid = group("Lid", 0, PIV[0], zF - PIV[1]);
{
  const n = 30, pts = [];
  for (let i = 0; i <= n; i++) { const x = -LID.x + (2 * LID.x * i) / n; pts.push([x, zF - LID.d0 - (x * x) / (2 * 5.0)]); }
  pts.push([LID.x, zF - LID.d1], [-LID.x, zF - LID.d1]);
  const win = rrect(-0.208, 0.208, zF - 0.145, zF - 0.41, 0.012);
  // the frame: top surface sloping, walls down to just above the deck
  const s = new THREE.Shape(pts.map(([x, z]) => new THREE.Vector2(x, -z)));
  s.holes.push(new THREE.Path(win.map(([x, z]) => new THREE.Vector2(x, -z))));
  const g = new THREE.ExtrudeGeometry(s, { depth: LID.t, bevelEnabled: true, bevelSize: 0.0025, bevelThickness: 0.0025, bevelOffset: -0.0025, bevelSegments: 2, curveSegments: 6 });
  g.rotateX(-Math.PI / 2);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) { const d = zF - p.getZ(i); const f = (p.getY(i) + 0.0025) / (LID.t + 0.005); p.setY(i, lidTop(d) - LID.t - 0.005 + f * (LID.t + 0.005)); }
  g.computeVertexNormals();
  g.translate(0, -PIV[0], -(zF - PIV[1]));
  lid.add(mesh("LidFrame", g, black));
  // the glass window, 3 mm under the frame's top
  const gw = plate("LidWindow", rrect(-0.21, 0.21, zF - 0.143, zF - 0.412, 0.012), [], 0, glassM);
  const pg = gw.geometry.attributes.position;
  for (let i = 0; i < pg.count; i++) pg.setY(i, lidTop(zF - pg.getZ(i)) - 0.003);
  gw.geometry.computeVertexNormals();
  gw.geometry.translate(0, -PIV[0], -(zF - PIV[1]));
  gw.position.set(0, 0, 0);
  lid.add(gw);
}
root.add(lid);

// ── the back: the inlet valve's thread at the top right, the power cord from the top left with its Indian 3-pin plug,
// the drain hose from the bottom right up the back to its hook (the manual's rear drawing; routes ESTIMATED) ──
{
  cab.add(cyl("InletThread", 0.011, 0.011, 0.016, black, 0.17, 0.865, zB - 0.008, 18).rotateX(Math.PI / 2));
  const cord = [[-0.19, 0.84, -0.002], [-0.19, 0.84, -0.02], [-0.195, 0.78, -0.03], [-0.2, 0.6, -0.028], [-0.198, 0.45, -0.024], [-0.185, 0.36, -0.02]].map(([x, y, dz]) => new THREE.Vector3(x, y, zB + dz));
  cab.add(mesh("PowerCord", new THREE.TubeGeometry(new THREE.CatmullRomCurve3(cord, false, "centripetal"), 40, 0.0035, 6, false), cordM));
  const plug = new THREE.Group(); plug.name = "PlugGroup";
  plug.add(box("Plug", 0.045, 0.05, 0.022, plugM, 0, 0, 0));
  for (const [px, py] of [[0, 0.0105], [-0.0095, -0.0065], [0.0095, -0.0065]]) plug.add(cyl("PlugPin", 0.0026, 0.0026, 0.016, pinMetal, px, py - 0.033, 0, 10));
  plug.position.set(-0.183, 0.33, zB - 0.02);
  cab.add(plug);
  const hose = [[0.205, 0.07, -0.002], [0.205, 0.07, -0.022], [0.21, 0.15, -0.028], [0.215, 0.5, -0.028], [0.218, 0.76, -0.028], [0.222, 0.8, -0.026], [0.232, 0.78, -0.024], [0.236, 0.7, -0.022]].map(([x, y, dz]) => new THREE.Vector3(x, y, zB + dz));
  cab.add(mesh("DrainHose", new THREE.TubeGeometry(new THREE.CatmullRomCurve3(hose, false, "centripetal"), 60, 0.011, 10, false), hoseM));
  cab.add(box("HoseHook", 0.03, 0.03, 0.02, black, 0.22, 0.79, zB - 0.012));
}

const parts = productParts(PRODUCTS, ID);
const clips = stateClips(root, parts);
saveZones(PRODUCTS, ID, root, parts);
await exportGLB(root, clips, OUT, {
  PanelFace: `${T}/panel.jpg`, PillowDrum: `${T}/drum.jpg`, Pulsator: `${T}/pulsator.jpg`, RidgePrint: `${T}/ridge_print.png`,
  KeyFace: `${T}/keys.jpg`, ...printTex,
}, { dir: `${TEX}/grain`, materials: {
  // Grain: the PCM cabinet and the grey top cover get the soft peel, the moulded plinth the strong peel; nothing on the
  // panel print, the glass or the black gloss lid
  Body: { type: "peel_soft" }, TopCover: { type: "peel_soft" }, Plinth: { type: "peel_strong" },
} });
