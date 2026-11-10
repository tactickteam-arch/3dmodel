// LG FHB1208Z2M, 8 kg front load, Middle Black.
// Built to LG's published size (owner's manual MFL72036419 p.11): W 600, H 850, D 550 mm for the cabinet, D' 590 mm to the
// front of the door, D'' 1030 mm with the door open at 90 degrees. Everything else is measured on LG's own photos:
//   gal1 (front, straight on): 706 px for 600 mm and 1000 px for 850 mm (1.1767 px/mm both ways), left edge x 646, top y 165;
//   gal3 (door open, straight on): 705 px for 600 mm, left edge x 764, top y 169;
//   DZ-10 / DZ-11 (sides, 1.351 px/mm by the height), DZ-12 (rear, 1.362 px/mm).
// The front has, top to bottom: a 31.5 mm top plate, the 90.5 mm control strip (drawer face 212.5 mm wide at the left,
// the dial, the programme names and a black display glass with the touch keys), then the front plate with the round door,
// the energy label at the right and the pump-filter cover at the bottom right; the cabinet stands 20 mm up on four feet.
// The front frame wraps 27 mm round the sides; the sides carry five embossed ribs (their photo is the texture).
// The back: the tub plate, four transit bolts, the drain hose, the power cord with its tied loop and the plug, the inlet,
// traced from the rear photo into rear_paths.json. Every number is tagged in private/research/lg_fhb1208/NOTES.md.
// usage: node make_lg_fhb1208.mjs <entries json> <tex dir> <out.glb>
import fs from "node:fs";
import { THREE, mat, mesh, box, group, lathe, flipV, inward, stateClips, exportGLB, productParts, saveZones } from "./lib.mjs";

const [PRODUCTS, TEX, OUT] = process.argv.slice(2);
const ID = "lg-fhb1208z2m";
const T = `${TEX}/lg_fhb1208`;

// ── size (metres) ──
const W = 0.6, H = 0.85, D = 0.55;                       // LG manual p.11 (VERIFIED)
const zF = D / 2, zB = -D / 2;
const yb = 0.020;                                         // the cabinet's lower edge (gal1 19.7 mm, DZ-10 22 mm, DZ-12 20 mm)
const top0 = 0.8185;                                      // the top plate's lower edge (gal1: 31.5 mm face)
const strip0 = 0.728;                                     // the strip's lower edge (gal1: strip 90.5 mm)
const stripMid = (top0 + strip0) / 2, stripH = top0 - strip0;
const drawerW = 0.2125;                                   // the drawer face (gal1 x 646-896)
const wrap = 0.027;                                       // the front frame wraps 27 mm round the sides (DZ-10 x 643-680)
const cx = 0.001, cy = 0.456;                             // the door and its opening: centre (gal1 door ring 455.2 mm, gal3 seat lip 460)
const doorR = 0.248;                                      // the door ring (gal1 circle fit, residual 1.5 mm)
const lipR = 0.247;                                       // the opening in the front plate: the seat's raised lip (gal3 r 241-247)
const flapC = { x: 0.1925, y: 0.087, w: 0.148, h: 0.1025 }; // the pump-filter cover's groove (gal1 x 118.5-266.5, y 35.8-138.3)

// ── materials ──
const frontM = mat("Front", 0xffffff, { metal: 0.3, rough: 0.45 });
const frontEdge = mat("FrontEdge", 0x3a3a3c, { metal: 0.3, rough: 0.45 });
const stripEdge = mat("StripEdge", 0x404042, { metal: 0.15, rough: 0.4 });
const sideR = mat("SideR", 0xffffff, { metal: 0.25, rough: 0.5 });
const sideL = mat("SideL", 0xffffff, { metal: 0.25, rough: 0.5 });
const rearM = mat("Rear", 0xffffff, { rough: 0.6 });
const panelM = mat("Panel", 0xffffff, { metal: 0.15, rough: 0.35 });
const glassKeys = mat("DisplayGlass", 0xffffff, { metal: 0.3, rough: 0.2 });
const drawerM = mat("DrawerFace", 0xffffff, { metal: 0.15, rough: 0.35 });
const topM = mat("TopPlate", 0x363638, { metal: 0.2, rough: 0.5 });
const bodyDark = mat("BodyDark", 0x2e2e30, { rough: 0.6 });
const dark = mat("Dark", 0x0b0c0d, { rough: 0.8 });
const pocketM = mat("Pocket", 0x151517, { rough: 0.7 });
const lipM = mat("PocketLip", 0x5a5a5e, { rough: 0.35, metal: 0.2 });
const trayM = mat("TrayWhite", 0xf1f3f5, { rough: 0.5 });
const trayFloor = mat("TrayFloor", 0xc9ced3, { rough: 0.6 });
const trayBlue = mat("TrayBlue", 0x4a86e0, { rough: 0.3 });
const chrome = mat("Chrome", 0xc4c7cb, { metal: 1, rough: 0.2 });
const knobSkirt = mat("KnobSkirt", 0x151517, { metal: 0.4, rough: 0.28 });
const knobTop = mat("KnobTop", 0xffffff, { metal: 0.6, rough: 0.35 });
const seatM = mat("DoorSeat", 0x2e2f32, { metal: 0.3, rough: 0.45, side: THREE.DoubleSide });
const seatLip = mat("SeatLip", 0x45474b, { metal: 0.5, rough: 0.3, side: THREE.DoubleSide });
const gasketM = mat("Gasket", 0x585d61, { rough: 0.85, side: THREE.DoubleSide });
const doorIn = mat("DoorInner", 0x2a2b2e, { rough: 0.55, side: THREE.DoubleSide });
const ringBlack = mat("DoorBlack", 0x050506, { metal: 0.3, rough: 0.14, side: THREE.DoubleSide });
const doorStep = mat("DoorStep", 0x0c0c0e, { metal: 0.3, rough: 0.25, side: THREE.DoubleSide });
const bezelM = mat("DoorBezel", 0x8a8e94, { metal: 0.7, rough: 0.3, side: THREE.DoubleSide });
const glass = mat("DoorGlass", 0x141516, { rough: 0.04, opacity: 0.12, side: THREE.DoubleSide });
const bowl = mat("GlassBowl", 0x9a9ea2, { rough: 0.05, opacity: 0.1, side: THREE.DoubleSide });
const drum = mat("Drum", 0xffffff, { metal: 0.85, rough: 0.28 });
const steel = mat("Steel", 0xb9bcc0, { metal: 0.9, rough: 0.3 });
const hingeM = mat("Hinge", 0x8f9296, { metal: 0.8, rough: 0.35 });
const backGrey = mat("DrumBack", 0x45474b, { metal: 0.85, rough: 0.35 });
const footM = mat("Foot", 0xa3a6ab, { metal: 0.7, rough: 0.35 });
const filterM = mat("FilterCap", 0x8d9096, { rough: 0.55 });
const bayM = mat("Bay", 0x101113, { rough: 0.75 });
const hoseM = mat("Hose", 0xffffff, { rough: 0.7 });
const cordM = mat("Cord", 0x8a8d91, { rough: 0.6 });
const plugM = mat("Plug", 0x7d8084, { rough: 0.55 });
const boltM = mat("Bolt", 0xaeb2b7, { metal: 0.9, rough: 0.3 });
const rubberM = mat("Rubber", 0x151618, { rough: 0.9 });
const blueM = mat("InletCap", 0x2c78d8, { rough: 0.5 });
const clipM = mat("HoseClip", 0xd9dbdd, { rough: 0.5 });
const stickTop = mat("StickerTop", 0xffffff, { rough: 0.6 });
const stickSide = mat("StickerSide", 0xffffff, { rough: 0.6 });
const labelM = mat("EnergyLabel", 0xffffff, { rough: 0.45 });

const root = group("LGFHB1208");
const cab = group("Cabinet");
root.add(cab);

// ── cabinet: top plate, ribbed sides, the front frame's wrap, base and back ──
const t = 0.006;
cab.add(box("Top", W, H - top0 - 0.0005, D, topM, 0, (H + top0 + 0.0005) / 2, 0));
{
  const sh = top0 - yb, sd = D - wrap - 0.002;
  cab.add(mesh("SideLeft", flipV(new THREE.BoxGeometry(t, sh, sd)), [bodyDark, sideL, bodyDark, bodyDark, bodyDark, bodyDark], -W / 2 + t / 2, yb + sh / 2, zB + 0.002 + sd / 2));
  cab.add(mesh("SideRight", flipV(new THREE.BoxGeometry(t, sh, sd)), [sideR, bodyDark, bodyDark, bodyDark, bodyDark, bodyDark], W / 2 - t / 2, yb + sh / 2, zB + 0.002 + sd / 2));
  for (const s of [-1, 1]) {                                // the front frame's 27 mm wrap: brushed below the strip, plain beside it
    const lw = wrap - 0.004;
    cab.add(box("FrontWrap", t, strip0 - yb, lw, frontEdge, s * (W / 2 - t / 2), (strip0 + yb) / 2, zF - 0.004 - lw / 2));
    cab.add(box("StripWrap", t, top0 - strip0, wrap - 0.010, stripEdge, s * (W / 2 - t / 2), stripMid, zF - 0.010 - (wrap - 0.010) / 2));
  }
}
cab.add(box("Base", W - 2 * t, 0.004, D - 0.01, dark, 0, yb + 0.002, 0));
cab.add(box("SeamBacker", W - 2 * t, 0.012, 0.002, dark, 0, strip0, zF - 0.012));
cab.add(box("SeamBackerTop", W - 2 * t, 0.010, 0.002, dark, 0, top0, zF - 0.012));
{ // the back: LG's rear photo (hose and cord painted out) from the cabinet's lower edge up to the top plate
  const g = new THREE.PlaneGeometry(W, top0 - yb);
  const uv = g.attributes.uv, pos = g.attributes.position;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, (pos.getX(i) + W / 2) / W, (H - (pos.getY(i) + (top0 + yb) / 2)) / H);
  const back = mesh("BackPanel", g, rearM, 0, (top0 + yb) / 2, zB - 0.0005);
  back.rotation.y = Math.PI;
  cab.add(back);
}
// four levelling feet: a silver pad, a hex nut and the threaded stem (gal1 x -275 / +269, about 34 mm across; DZ-10 50 mm
// behind the front and 27 mm in from the back)
for (const [fx, fz] of [[-0.274, zF - 0.052], [0.270, zF - 0.052], [-0.274, zB + 0.028], [0.270, zB + 0.028]]) {
  const f = group("Foot", fx, 0, fz);
  f.add(mesh("FootPad", new THREE.CylinderGeometry(0.0165, 0.017, 0.006, 24), footM, 0, 0.003, 0));
  f.add(mesh("FootNut", new THREE.CylinderGeometry(0.0115, 0.0115, 0.006, 6), footM, 0, 0.009, 0));
  f.add(mesh("FootThread", new THREE.CylinderGeometry(0.0055, 0.0055, yb - 0.012, 12), steel, 0, 0.012 + (yb - 0.012) / 2, 0));
  cab.add(f);
}

// ── the rear fittings, traced from LG's rear photo (crop px -> metres; the photo's left is the machine's +x side) ──
const rp = JSON.parse(fs.readFileSync(`${T}/rear_paths.json`, "utf8"));
const PPM = rp.px_per_mm;
const rx = (px) => W / 2 - px / PPM / 1000;
const ry = (py) => H - py / PPM / 1000;
const plateDepth = 0.012;
{ // the raised tub plate (rounded rectangle), its outer face the rear photo's plate; 12 mm proud (ESTIMATED)
  const [x0, y0, x1, y1] = rp.plate;
  const w = (x1 - x0) / PPM / 1000, h = (y1 - y0) / PPM / 1000, r = 0.034;
  const sh = new THREE.Shape();
  sh.moveTo(-w / 2 + r, -h / 2); sh.lineTo(w / 2 - r, -h / 2); sh.quadraticCurveTo(w / 2, -h / 2, w / 2, -h / 2 + r);
  sh.lineTo(w / 2, h / 2 - r); sh.quadraticCurveTo(w / 2, h / 2, w / 2 - r, h / 2); sh.lineTo(-w / 2 + r, h / 2);
  sh.quadraticCurveTo(-w / 2, h / 2, -w / 2, h / 2 - r); sh.lineTo(-w / 2, -h / 2 + r); sh.quadraticCurveTo(-w / 2, -h / 2, -w / 2 + r, -h / 2);
  const g = new THREE.ExtrudeGeometry(sh, { depth: plateDepth, bevelEnabled: false, curveSegments: 10 });
  g.rotateY(Math.PI);
  g.translate(rx((x0 + x1) / 2), ry((y0 + y1) / 2), zB - 0.0005);
  const pos = g.attributes.position, uv = g.attributes.uv;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, (W / 2 - pos.getX(i)) / W, (H - pos.getY(i)) / H);
  cab.add(mesh("TubPlate", g, rearM));
}
for (const [px, py] of rp.bolts) { // the four transit bolts: rubber ring, cap, hex head
  const bx = rx(px), by = ry(py);
  const ring = mesh("BoltRing", new THREE.CylinderGeometry(0.0125, 0.0125, 0.005, 24), rubberM, bx, by, zB - 0.0025); ring.rotation.x = Math.PI / 2; cab.add(ring);
  const cap = mesh("BoltCap", new THREE.CylinderGeometry(0.0105, 0.0105, 0.009, 24), boltM, bx, by, zB - 0.0075); cap.rotation.x = Math.PI / 2; cab.add(cap);
  const head = mesh("BoltHead", new THREE.CylinderGeometry(0.0072, 0.0072, 0.006, 6), boltM, bx, by, zB - 0.0135); head.rotation.x = Math.PI / 2; cab.add(head);
}
const zOver = (px, py) => {
  const [x0, y0, x1, y1] = rp.plate;
  return px > x0 + 6 && px < x1 - 6 && py > y0 + 6 && py < y1 - 6 ? zB - plateDepth : zB;
};
// The traced routes (photo px, every few px) carry the tracer's wobble. Resample every 2 px, smooth with a Gaussian of
// sigmaPx, thin to one point every everyPx, keep both ends: a smooth, even run through the photo's path.
function smoothRoute(P, sigmaPx, everyPx) {
  const dist = [0];
  for (let i = 1; i < P.length; i++) dist.push(dist[i - 1] + Math.hypot(P[i][0] - P[i - 1][0], P[i][1] - P[i - 1][1]));
  const L = dist[dist.length - 1], R = [];
  for (let sPx = 0, j = 0; sPx < L; sPx += 2) {
    while (j < P.length - 2 && dist[j + 1] < sPx) j++;
    const t = (sPx - dist[j]) / Math.max(1e-9, dist[j + 1] - dist[j]);
    R.push([P[j][0] + t * (P[j + 1][0] - P[j][0]), P[j][1] + t * (P[j + 1][1] - P[j][1])]);
  }
  R.push(P[P.length - 1]);
  const sig = sigmaPx / 2, K = Math.ceil(3 * sig), wts = [];
  for (let k = -K; k <= K; k++) wts.push(Math.exp(-0.5 * (k / sig) ** 2));
  const sm = R.map((_, i) => {
    let sx = 0, sy = 0, sw = 0;
    for (let k = -K; k <= K; k++) {
      const q = R[Math.min(R.length - 1, Math.max(0, i + k))], w = wts[k + K];
      sx += q[0] * w; sy += q[1] * w; sw += w;
    }
    return [sx / sw, sy / sw];
  });
  const step = Math.max(1, Math.round(everyPx / 2)), out = sm.filter((_, i) => i % step === 0);
  out[0] = R[0]; out.push(R[R.length - 1]);
  return out;
}
const hoseCtrl = smoothRoute(rp.hose, 8, 24), hoseR = 0.012, zH = zB - hoseR - 0.0015;
{ // drain hose: ribbed grey, 24 mm across its ribs (DZ-12: median 33 px at 1.362 px/mm, half-height edges of the rib-averaged
  // cross-section, 724 sections), one rib every 4.0 mm (5.4-5.6 px). Its route is the photo's hose centre line (the trace
  // re-centred between the measured edges), from its holder at bottom left up and over the top, down the right to the end fitting.
  const pts = hoseCtrl.map(([px, py]) => new THREE.Vector3(rx(px), ry(py), zH));
  const curve = new THREE.CatmullRomCurve3(pts, false, "centripetal");
  const len = curve.getLength();
  const g = new THREE.TubeGeometry(curve, Math.round(len / 0.008), hoseR, 10, false);
  const uv = g.attributes.uv, ribs = len / 0.004;
  for (let i = 0; i < uv.count; i++) uv.setX(i, uv.getX(i) * ribs);
  cab.add(mesh("DrainHose", g, hoseM));
  const e = pts[pts.length - 1];
  cab.add(mesh("HoseFitting", new THREE.CylinderGeometry(0.0145, 0.0145, 0.036, 20), plugM, e.x, e.y - 0.004, e.z));
  const s0 = pts[0];
  cab.add(mesh("HoseEnd", new THREE.SphereGeometry(hoseR, 12, 8), hoseM, s0.x, s0.y, s0.z));
  // the holder the hose end sits in: a light grey loop, 42 x 68 mm outside, its rim 4.5 mm (DZ-12 x 29-86, y 488-580);
  // how far it stands off the back is ESTIMATED (it reaches round the hose)
  const [hx0, hy0, hx1, hy1] = [29, 488, 86, 580].map((v) => v / PPM / 1000);
  const hw = (hx1 - hx0) / 2, hh = (hy1 - hy0) / 2, rim = 0.0045;
  const loop = (sh, a, b) => {
    sh.absarc(0, b - a, a, 0, Math.PI, false); sh.absarc(0, -(b - a), a, Math.PI, 2 * Math.PI, false);
  };
  const ring = new THREE.Shape(); loop(ring, hw, hh);
  const hole = new THREE.Path(); loop(hole, hw - rim, hh - rim); ring.holes.push(hole);
  const hg = new THREE.ExtrudeGeometry(ring, { depth: 0.026, bevelEnabled: false, curveSegments: 12 });
  const holder = mesh("HoseHolder", hg, clipM, W / 2 - (hx0 + hx1) / 2, H - (hy0 + hy1) / 2, zB - 0.026);
  cab.add(holder);
  // the white clip on the right that holds the hose: two blocks either side of it (DZ-12 x 724-734 and 759-768, y 314-341)
  for (const [x0, x1] of [[724, 734], [759, 768]]) {
    cab.add(box("HoseClip", (x1 - x0) / PPM / 1000, 27 / PPM / 1000, 0.022, clipM, rx((x0 + x1) / 2), ry(327.5), zB - 0.011));
  }
}
{ // the power cord: from the grommet over to the tie, the tied loop (with a white tie), the long run down the right to the plug
  // where the cord crosses the drain hose it lies on it, as in the photo (along the hose's top and over it on the right)
  const cordR = 0.0045;
  const overHose = (px, py) => {
    let best = Infinity;
    for (let i = 1; i < hoseCtrl.length; i++) {
      const [ax, ay] = hoseCtrl[i - 1], [bx, by] = hoseCtrl[i], vx = bx - ax, vy = by - ay;
      const t = Math.max(0, Math.min(1, ((px - ax) * vx + (py - ay) * vy) / (vx * vx + vy * vy || 1)));
      best = Math.min(best, Math.hypot(px - ax - t * vx, py - ay - t * vy));
    }
    const d = best / PPM / 1000, reach = hoseR + cordR;
    return d < reach ? zH - Math.sqrt(reach * reach - d * d) : Infinity;
  };
  const run = (list, dz = 0.0045) => {
    const q = smoothRoute(list, 12, 16), z = q.map(([px, py]) => Math.min(zOver(px, py) - dz, overHose(px, py)));
    // where it crosses onto the raised tub plate, the cord rises gradually, never in a step
    const zs = z.map((_, i) => Math.min(...z.slice(Math.max(0, i - 3), i + 4)));
    return q.map(([px, py], i) => new THREE.Vector3(rx(px), ry(py), zs.slice(Math.max(0, i - 2), i + 3).reduce((a, b) => a + b, 0) / zs.slice(Math.max(0, i - 2), i + 3).length));
  };
  const tube = (name, pts) => cab.add(mesh(name, new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts, false, "centripetal"), 110, 0.0045, 6, false), cordM));
  tube("CordRun", run(rp.cord));
  const loopPts = run(rp.loop, 0.0075);
  tube("CordLoop", loopPts);
  const [tx, ty] = rp.loop[0];
  cab.add(mesh("CordTie", new THREE.BoxGeometry(0.008, 0.016, 0.006), mat("Tie", 0xf2f2f2, { rough: 0.6 }), rx(tx), ry(ty), loopPts[0].z - 0.003));
  const [gx, gy] = rp.grommet;
  cab.add(mesh("Grommet", new THREE.TorusGeometry(0.0095, 0.0035, 8, 24), plugM, rx(gx), ry(gy), zB - 0.0035));
  const [px, py] = rp.plug;
  const ps = new THREE.Shape();
  ps.moveTo(0, 0.027); ps.bezierCurveTo(0.012, 0.021, 0.027, -0.008, 0.026, -0.017); ps.quadraticCurveTo(0, -0.032, -0.026, -0.017);
  ps.bezierCurveTo(-0.027, -0.008, -0.012, 0.021, 0, 0.027);
  const pg = new THREE.ExtrudeGeometry(ps, { depth: 0.014, bevelEnabled: true, bevelSize: 0.003, bevelThickness: 0.003, bevelSegments: 3, curveSegments: 14 });
  const plug = mesh("Plug", pg, plugM, rx(px), ry(py) - 0.002, zB - 0.004);
  plug.rotation.y = Math.PI;
  cab.add(plug);
  const [ix, iy] = rp.inlet;                                    // the water inlet: a grey seat and its blue cap
  const seatI = mesh("InletSeat", new THREE.CylinderGeometry(0.0115, 0.0115, 0.008, 20), plugM, rx(ix), ry(iy), zB - 0.004); seatI.rotation.x = Math.PI / 2; cab.add(seatI);
  const capI = mesh("InletCap", new THREE.CylinderGeometry(0.0078, 0.0078, 0.012, 20), blueM, rx(ix), ry(iy), zB - 0.012); capI.rotation.x = Math.PI / 2; cab.add(capI);
}

// ── front plate (20 -> 728 mm): the door opening and the pump-filter cut-out, UV-mapped to its printed texture ──
const plateTop = strip0 - 0.0008, plateH = plateTop - yb;
{
  const s = new THREE.Shape();
  s.moveTo(-W / 2, 0); s.lineTo(W / 2, 0); s.lineTo(W / 2, plateH); s.lineTo(-W / 2, plateH); s.lineTo(-W / 2, 0);
  const hole = new THREE.Path(); hole.absarc(cx, cy - yb, lipR, 0, Math.PI * 2, true); s.holes.push(hole);
  const r = 0.009, x0 = flapC.x - flapC.w / 2 + 0.001, x1 = flapC.x + flapC.w / 2 - 0.001, y0 = flapC.y - flapC.h / 2 - yb + 0.001, y1 = flapC.y + flapC.h / 2 - yb - 0.001;
  const cut = new THREE.Path();
  cut.moveTo(x0 + r, y0); cut.lineTo(x1 - r, y0); cut.quadraticCurveTo(x1, y0, x1, y0 + r); cut.lineTo(x1, y1 - r); cut.quadraticCurveTo(x1, y1, x1 - r, y1);
  cut.lineTo(x0 + r, y1); cut.quadraticCurveTo(x0, y1, x0, y1 - r); cut.lineTo(x0, y0 + r); cut.quadraticCurveTo(x0, y0, x0 + r, y0);
  s.holes.push(cut);
  const g = new THREE.ExtrudeGeometry(s, { depth: 0.004, bevelEnabled: false, curveSegments: 96 });
  const pos = g.attributes.position, uv = g.attributes.uv;
  const texH = 0.728 - yb;                                       // front.jpg spans 20 -> 728 mm
  for (let i = 0; i < uv.count; i++) uv.setXY(i, (pos.getX(i) + W / 2) / W, (0.728 - yb - pos.getY(i)) / texH);
  cab.add(mesh("FrontMain", g, [frontM, bodyDark], 0, yb, zF - 0.004));
}
// the door seat: a shallow dish from the raised lip (r 247 mm) down to the gasket (r 170 mm), 16 mm deep (ESTIMATED from the
// shading in gal3)
{
  const seat = group("DoorSeatRing", cx, cy, zF);
  seat.add(lathe("SeatLip", [[lipR, -0.004], [lipR, 0.0], [0.2445, 0.0015], [0.240, 0.0008], [0.236, -0.002]], seatLip, 96));
  seat.add(lathe("SeatDish", [[0.236, -0.002], [0.172, -0.016], [0.168, -0.020]], seatM, 96));
  cab.add(seat);
}
// the gasket: grey-blue rubber, a rolled lip (r 165 -> 142 mm, gal3 circle fits) folding back into the drum
{
  const g = lathe("GasketRing", [[0.168, -0.020], [0.165, -0.0165], [0.157, -0.0135], [0.147, -0.015], [0.1415, -0.023], [0.142, -0.040],
    [0.150, -0.060], [0.172, -0.085], [0.200, -0.100]], gasketM, 72);
  g.position.set(cx, cy, zF);
  cab.add(g);
}
// the stickers LG's open-door photo shows on the seat (photo crops: their print is too small to redraw). Each lies on the dish
// (rising 0.219 per unit of radius), its long side along the ring.
const dishZ = (r) => -0.002 - (0.236 - r) * (0.014 / 0.064);
function seatSticker(name, material, w, h, r0, thetaDeg, uAlongRadius) {
  const th = THREE.MathUtils.degToRad(thetaDeg);
  const rH = new THREE.Vector3(Math.cos(th), Math.sin(th), 0), tH = new THREE.Vector3(Math.sin(th), -Math.cos(th), 0);
  let ex = uAlongRadius ? rH.clone() : tH.clone();               // the texture's u direction
  let ey = uAlongRadius ? tH.clone().negate() : rH.clone();       // the texture's up
  const tilt = (v) => v.clone().add(new THREE.Vector3(0, 0, 0.219 * v.dot(rH))).normalize();
  ex = tilt(ex); ey = tilt(ey);
  const ez = new THREE.Vector3().crossVectors(ex, ey).normalize();
  const m = mesh(name, flipV(new THREE.PlaneGeometry(w, h)), material, cx + r0 * Math.cos(th), cy + r0 * Math.sin(th), zF + dishZ(r0) + 0.0007);
  m.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(ex, ey, ez));
  cab.add(m);
}
seatSticker("StickerTop", stickTop, 0.077, 0.0258, 0.2116, 62.1, false);
seatSticker("StickerSide", stickSide, 0.0285, 0.092, 0.1925, -32.3, true);
// the hinge (gal3): one chrome bracket on the seat at the left, a bar 23 mm wide from 385 to 528 mm up at x -214 to -191 mm,
// with an arm at 496 mm and one at 413 mm reaching forward and left into slots in the door's back to the pivot. The closed
// door hides it all. The lock slot is at the right (gal3: x 192, y 459).
const pivotL = 0.240;                                     // the pivot sits 240 mm left of the door's centre (ESTIMATED, below)
const pivotZ = zF + 0.020;                                // 20 mm in front of the plate, inside the closed door (ESTIMATED)
cab.add(box("HingePlate", 0.023, 0.143, 0.004, hingeM, -0.2025, 0.4565, zF + dishZ(0.2025) + 0.0022));
const armY = [0.496, 0.413];
for (const hy of armY) {
  const z0 = zF + dishZ(0.2025) + 0.004, z1 = pivotZ - 0.002, xa = -0.196, xb = cx - pivotL;
  cab.add(box("HingePlate", xa - xb, 0.012, z1 - z0, hingeM, (xa + xb) / 2, hy, (z0 + z1) / 2));
}
cab.add(box("LockSlot", 0.013, 0.022, 0.006, dark, cx + 0.191, cy + 0.003, zF + dishZ(0.191) + 0.0025));
// the pump-filter housing behind the cover: a dark box, the drain plug and the round filter cap with its grip (manual p.10)
{
  const g = group("PumpBay", flapC.x, flapC.y, zF);
  g.add(mesh("BayBox", inward(new THREE.BoxGeometry(flapC.w - 0.008, flapC.h - 0.008, 0.07)), bayM, 0, 0, -0.039));
  const fc = mesh("FilterCap", new THREE.CylinderGeometry(0.0285, 0.0285, 0.026, 36), filterM, 0.014, -0.006, -0.036); fc.rotation.x = Math.PI / 2; g.add(fc);
  g.add(box("FilterGrip", 0.052, 0.009, 0.007, steel, 0.014, -0.006, -0.0215));
  const dp = mesh("DrainPlug", new THREE.CylinderGeometry(0.0085, 0.0085, 0.02, 16), mat("DrainPlugM", 0x2a2b2e, { rough: 0.5 }), -0.043, 0.026, -0.034); dp.rotation.x = Math.PI / 2; g.add(dp);
  const hose = new THREE.CatmullRomCurve3([new THREE.Vector3(-0.043, 0.026, -0.044), new THREE.Vector3(-0.045, 0.012, -0.054), new THREE.Vector3(-0.036, -0.012, -0.059)]);
  g.add(mesh("PlugHose", new THREE.TubeGeometry(hose, 14, 0.004, 8, false), mat("PlugHoseM", 0x1b1c1e, { rough: 0.7 })));
  cab.add(g);
}
// the cover: a lid hinged along its lower edge, opening forward and down (manual p.10)
{
  const f = group("FilterFlap", flapC.x, flapC.y - flapC.h / 2 + 0.0015, zF - 0.0035);
  // the lid: a rounded rectangle (gal1: corners about 9 mm) in the front's own finish, its face mapped onto the front texture
  // so it matches the plate round it; 0.6 mm gap all round, its face 0.5 mm proud
  const lw = flapC.w / 2 - 0.0016, lh = flapC.h - 0.0032, r = 0.0085;
  const sh = new THREE.Shape();
  sh.moveTo(-lw + r, 0); sh.lineTo(lw - r, 0); sh.quadraticCurveTo(lw, 0, lw, r); sh.lineTo(lw, lh - r); sh.quadraticCurveTo(lw, lh, lw - r, lh);
  sh.lineTo(-lw + r, lh); sh.quadraticCurveTo(-lw, lh, -lw, lh - r); sh.lineTo(-lw, r); sh.quadraticCurveTo(-lw, 0, -lw + r, 0);
  const g = new THREE.ExtrudeGeometry(sh, { depth: 0.004, bevelEnabled: false, curveSegments: 6 });
  const gy = flapC.y - flapC.h / 2 + 0.0015, pos = g.attributes.position, uv = g.attributes.uv;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, (flapC.x + pos.getX(i) + W / 2) / W, (0.728 - (gy + pos.getY(i))) / (0.728 - yb));
  f.add(mesh("FlapLid", g, [frontM, bodyDark], 0, 0.0001, 0));
  root.add(f);
}
{ // the energy label: this model's own BEE label (it names FHB1208Z2M), redrawn at 12 px/mm, a die-cut sticker with an arched
  // top, 0.8 mm proud, where gal1 has it: 226-294 mm across, its arch top 701 mm up
  const geo = JSON.parse(fs.readFileSync(`${T}/label_geo.json`, "utf8"));
  const lw = geo.w_mm / 1000, lh = geo.h_mm / 1000, ary = geo.arch_ry_mm / 1000;
  const sh = new THREE.Shape();
  sh.moveTo(-lw / 2, -lh); sh.lineTo(lw / 2, -lh); sh.lineTo(lw / 2, -ary);
  sh.absellipse(0, -ary, lw / 2, ary, 0, Math.PI, false);
  sh.lineTo(-lw / 2, -lh);
  const g = new THREE.ShapeGeometry(sh, 32);
  const pos = g.attributes.position, uv = g.attributes.uv;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, (pos.getX(i) + lw / 2) / lw, -pos.getY(i) / lh);
  cab.add(mesh("EnergyLabel", g, labelM, 0.260, 0.7013, zF + 0.0008));
}

// ── the control strip: the printed panel right of the drawer, the seam lines, the raised display glass, the dial ──
{
  const x0 = -W / 2 + drawerW + 0.0004, pw = W / 2 - x0, h = stripH - 0.0016;
  cab.add(mesh("ControlStrip", flipV(new THREE.BoxGeometry(pw, h, 0.010)), [stripEdge, stripEdge, stripEdge, stripEdge, panelM, stripEdge], x0 + pw / 2, stripMid, zF - 0.005));
}
{ // the display glass with the touch keys stands 1.2 mm proud (ESTIMATED); its face is the strip texture where the glass is
  // (gal1 x 115.6-238.8 mm, y 752.5-798.75 mm)
  const gx0 = 0.1156, gx1 = 0.2388, gy0 = 0.7525, gy1 = 0.79875;
  const g = new THREE.BoxGeometry(gx1 - gx0, gy1 - gy0, 0.0012);
  const uv = g.attributes.uv;
  const sx0 = -W / 2 + drawerW;
  for (let i = 16; i < 20; i++) {
    const u = uv.getX(i), v = uv.getY(i);
    uv.setXY(i, (gx0 + u * (gx1 - gx0) - sx0) / (W / 2 - sx0), (top0 - (gy0 + v * (gy1 - gy0))) / stripH);
  }
  cab.add(mesh("DisplayGlass", g, [dark, dark, dark, dark, glassKeys, dark], (gx0 + gx1) / 2, (gy0 + gy1) / 2, zF + 0.0006));
}
// the dial: LG's dark-chrome knob, a chrome edge and a spun top; 51 mm across (gal1), about 13 mm high (ESTIMATED)
{
  const k = group("Dial", 0.0006, 0.7756, zF);
  k.add(lathe("KnobBase", [[0.0268, 0], [0.0268, 0.0016], [0.0258, 0.0022], [0.0, 0.0022]], knobSkirt, 64));
  k.add(lathe("KnobSkirt", [[0.0253, 0.0016], [0.0253, 0.0112], [0.0243, 0.0126], [0.0, 0.0126]], knobSkirt, 64));
  k.add(lathe("KnobEdge", [[0.0253, 0.0098], [0.0255, 0.0114], [0.0243, 0.0128], [0.0238, 0.0124]], chrome, 64));
  k.add(mesh("KnobTop", new THREE.CircleGeometry(0.0239, 64), knobTop, 0, 0, 0.01285));
  cab.add(k);
}

// ── detergent drawer: LG's face with its finger pocket (gal1: 130.4 x 30.4 mm, centred 118.1 mm from the left edge and 60.2 mm
// under the strip's top), a white tray with the three compartments behind it (manual p.24) ──
const dX = -W / 2 + drawerW / 2 - 0.0004, dY = stripMid;
const drawer = group("Drawer", dX, dY, zF);
{
  const dw = drawerW - 0.0008, hw = dw / 2, hh = (stripH - 0.0016) / 2;
  const s = new THREE.Shape();
  s.moveTo(-hw, -hh); s.lineTo(hw, -hh); s.lineTo(hw, hh); s.lineTo(-hw, hh); s.lineTo(-hw, -hh);
  const pw = 0.1304, ph = 0.0304, pcx = 0.1181 - drawerW / 2 + 0.0004, pcy = (top0 - 0.0602) - stripMid, r = 0.006;
  const cut = new THREE.Path();
  cut.moveTo(pcx - pw / 2 + r, pcy - ph / 2); cut.lineTo(pcx + pw / 2 - r, pcy - ph / 2); cut.quadraticCurveTo(pcx + pw / 2, pcy - ph / 2, pcx + pw / 2, pcy - ph / 2 + r);
  cut.lineTo(pcx + pw / 2, pcy + ph / 2 - r); cut.quadraticCurveTo(pcx + pw / 2, pcy + ph / 2, pcx + pw / 2 - r, pcy + ph / 2);
  cut.lineTo(pcx - pw / 2 + r, pcy + ph / 2); cut.quadraticCurveTo(pcx - pw / 2, pcy + ph / 2, pcx - pw / 2, pcy + ph / 2 - r);
  cut.lineTo(pcx - pw / 2, pcy - ph / 2 + r); cut.quadraticCurveTo(pcx - pw / 2, pcy - ph / 2, pcx - pw / 2 + r, pcy - ph / 2);
  s.holes.push(cut);
  const g = new THREE.ExtrudeGeometry(s, { depth: 0.012, bevelEnabled: false, curveSegments: 6 });
  const pos = g.attributes.position, uv = g.attributes.uv;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, (pos.getX(i) + drawerW / 2) / drawerW, (pos.getY(i) * -1 + stripH / 2) / stripH);
  g.translate(0, 0, -0.012);
  drawer.add(mesh("DrawerFace", g, [drawerM, pocketM]));
  // the finger pocket: dark inside, a lighter frame round it and a grip at each end (gal1 shows bright hooks there)
  drawer.add(mesh("PocketInside", inward(new THREE.BoxGeometry(pw - 0.002, ph - 0.002, 0.016)), pocketM, pcx, pcy, -0.02));
  drawer.add(box("PocketLip", pw - 0.012, 0.0022, 0.008, lipM, pcx, pcy - ph / 2 + 0.0026, -0.0165));
  drawer.add(box("PocketGripL", 0.006, ph - 0.008, 0.004, lipM, pcx - pw / 2 + 0.005, pcy, -0.0125));
  drawer.add(box("PocketGripR", 0.006, ph - 0.008, 0.004, lipM, pcx + pw / 2 - 0.005, pcy, -0.0125));
  // the tray behind the face (manual p.24): main wash on the left, pre-wash at the front right, softener at the back right.
  // The manual shows it from one angle only, so the compartment sizes are ESTIMATED.
  const trayW = drawerW - 0.02, trayH = stripH - 0.03, trayL = 0.2, tz0 = -0.032, z1 = tz0 - trayL, zc = tz0 - trayL / 2, wt = 0.0028, y0 = -0.003;
  drawer.add(box("TrayFloor", trayW, wt, trayL, trayFloor, 0, y0 - trayH / 2 + wt / 2, zc));
  drawer.add(box("TrayWallL", wt, trayH, trayL, trayM, -trayW / 2 + wt / 2, y0, zc));
  drawer.add(box("TrayWallR", wt, trayH, trayL, trayM, trayW / 2 - wt / 2, y0, zc));
  drawer.add(box("TrayWallBack", trayW, trayH, wt, trayM, 0, y0, z1 + wt / 2));
  const xd = -trayW / 2 + trayW * 0.62;
  drawer.add(box("TrayDivider", wt, trayH * 0.92, trayL * 0.96, trayM, xd, y0 - trayH * 0.04, zc));
  const xm = (xd + trayW / 2) / 2;
  drawer.add(box("TrayCross", trayW / 2 - xd - wt, trayH * 0.85, wt, trayM, xm, y0 - trayH * 0.075, tz0 - trayL * 0.52));
  drawer.add(box("SoftenerCap", 0.03, 0.026, 0.026, trayBlue, xm, y0 - trayH / 2 + 0.015, z1 + trayL * 0.2));
  drawer.add(box("SoftenerMax", trayW / 2 - xd - 2 * wt, 0.0016, 0.004, trayBlue, xm, y0 - trayH * 0.3, tz0 - trayL * 0.52 + 0.004));
  for (let i = 0; i < 4; i++) drawer.add(box(`TrayInsert${i}`, 0.0025, trayH * 0.7, trayL * 0.3, trayM, -trayW / 2 + 0.02 + i * 0.016, y0 - trayH * 0.1, z1 + trayL * 0.2));
}
cab.add(drawer);
cab.add(mesh("DrawerBay", inward(new THREE.BoxGeometry(drawerW - 0.004, stripH - 0.006, 0.27)), dark, -W / 2 + drawerW / 2, stripMid, zF - 0.137));

// ── the stainless drum behind the gasket (gal3 straight on, gal6 and gal7 at 3/4). The wall is one perforated surface with
// its three lifters pressed into it, centred at 30, 150 and 270 degrees (gal3: the three humps' crests are nearest the hub
// at exactly those angles). They are big: low at the drum's front lip and growing to the back wall, where gal3 shows their
// crests 57 px from the hub against the hub's 26 px radius, so about 55-60 mm from the axis, and the three nearly meet,
// leaving only narrow valleys of back wall between them (the dark three-armed shape round the hub). Here each rises to
// 175 mm at the back over 57 degrees either side of its centre, and to 70 mm over 40 degrees at the front, after a 35 mm
// ramp up from the lip; the cross-section is flat-topped and falls steeply at the flanks, as gal3's outline does. All of
// it ESTIMATED from gal3 / gal6 / gal7. Holes 5 mm across on a 10 mm staggered pitch (gal3: the lifter face at the bottom),
// in the texture, on the lifters as on the wall (gal7); the back wall plain polished steel with the hub. ──
const drumR = 0.235, drumDepth = 0.30, drumZ = zF - 0.105 - drumDepth / 2;
{
  const deg = THREE.MathUtils.degToRad, lifters = [30, 150, 270].map(deg);
  const hF = 0.07, hB = 0.175, wF = deg(40), wB = deg(57), ramp = 0.035;
  const zFront = drumZ + drumDepth / 2, NA = 120, a0 = Math.PI / 2;   // the seam at the top, in the valley between two lifters
  const ringsZ = [0, 0.008, 0.016, 0.026, 0.04, 0.07, 0.11, 0.16, 0.22, drumDepth], NZ = ringsZ.length - 1;
  const radius = (phi, d) => {
    const s = d / drumDepth, rf = Math.min(1, d / ramp), up = rf * rf * (3 - 2 * rf);
    const h = (hF + (hB - hF) * s) * up, w = wF + (wB - wF) * s;
    let bump = 0;
    for (const a of lifters) {
      const t = Math.abs(Math.atan2(Math.sin(phi - a), Math.cos(phi - a))) / w;
      if (t < 1) bump = Math.max(bump, Math.cos((Math.PI / 2) * t * t));
    }
    return drumR - h * bump;
  };
  const P = [];                                                          // P[j][i] = [x, y, z]
  for (let j = 0; j <= NZ; j++) {
    const z = zFront - ringsZ[j], ring = [];
    for (let i = 0; i <= NA; i++) {
      const phi = a0 + (i / NA) * Math.PI * 2, r = radius(phi, ringsZ[j]);
      ring.push([cx + r * Math.cos(phi), cy + r * Math.sin(phi), z]);
    }
    P.push(ring);
  }
  // UVs: across, the true length round each ring measured from the lifter's crest, so the holes keep their size and the
  // hole rows follow the lifter's shape like a pressed perforated sheet; the sectors meet in the valleys (where the texture
  // may step, in the crease) and match there at the front ring. Along, the surface length down each column, so the holes
  // keep their size on the front ramps.
  const len = (A, B) => Math.hypot(A[0] - B[0], A[1] - B[1], A[2] - B[2]);
  const SEC = NA / 3, arcs = P.map((ring) => { const c = [0]; for (let i = 1; i <= NA; i++) c.push(c[i - 1] + len(ring[i], ring[i - 1])); return c; });
  const U = Math.round((3 * arcs[0][SEC]) / 0.16) / 3;                  // one sector's span in tiles, from the front ring
  const down = [Array(NA + 1).fill(0)];
  for (let j = 1; j <= NZ; j++) down.push(P[j].map((p, i) => down[j - 1][i] + len(p, P[j - 1][i])));
  const pos = [], uv = [], idx = [];
  for (let k = 0; k < 3; k++) {                                          // each sector its own vertices: the valleys are seams
    const base = pos.length / 3;
    for (let j = 0; j <= NZ; j++) for (let i = k * SEC; i <= (k + 1) * SEC; i++) {
      const c = arcs[j], crest = c[k * SEC + SEC / 2];
      pos.push(...P[j][i]);
      uv.push(k * U + U / 2 + (c[i] - crest) / 0.16, down[j][i] / 0.08);
    }
    const row = SEC + 1;
    for (let j = 0; j < NZ; j++) for (let i = 0; i < SEC; i++) {
      const A = base + j * row + i, B = A + 1, C = A + row, Dd = C + 1;  // j runs from the front to the back
      idx.push(A, B, C, B, Dd, C);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  cab.add(mesh("DrumShell", g, drum));
}
cab.add(mesh("DrumBack", new THREE.CircleGeometry(drumR, 64), backGrey, cx, cy, drumZ - drumDepth / 2 + 0.002));
cab.add(mesh("DrumHub", new THREE.CylinderGeometry(0.024, 0.026, 0.01, 40), mat("DrumBoss", 0xd8d9db, { rough: 0.45 }), cx, cy, drumZ - drumDepth / 2 + 0.007).rotateX(Math.PI / 2));
cab.add(lathe("DrumLip", [[0.200, 0], [drumR, -0.005]], steel).translateX(cx).translateY(cy).translateZ(zF - 0.100));

// ── the door: hinged on the left. Its pivot is 240 mm left of the door's centre, 8 mm inside the ring, and 20 mm in front of
// the plate. Opened 140 degrees, that puts the door's near edge 221 mm left of centre and its far edge 618 mm; rendered
// straight on from 6 m that is -693 -> -673 mm with the door nearer the camera, as in LG's open-door photo (gal3: near edge
// -218 mm at the hinge, far edge -673 mm, door height 522 mm against our 517). Both ESTIMATED from that photo. The front of the door stands 40 mm proud of the cabinet (D' 590 mm, VERIFIED). ──
const pivotX = cx - pivotL;
const door = group("Door", pivotX, cy, pivotZ);
const dc = group("DoorCentre", pivotL, 0, zF + 0.030 - pivotZ);
// profiles [r, z] in the door's frame (z 0 = the pivot's plane; the back of the ring sits 2 mm in front of the plate)
dc.add(lathe("DoorInnerRing", [[0.150, -0.028], [0.2475, -0.028]], doorIn, 96));
dc.add(lathe("DoorRim", [[0.2475, -0.028], [0.248, -0.018], [0.247, -0.010], [0.243, -0.003], [0.232, 0.002], [0.215, 0.005], [0.196, 0.006]], ringBlack, 96));
dc.add(lathe("DoorStep", [[0.196, 0.006], [0.192, 0.003], [0.170, 0.000], [0.158, -0.001]], doorStep, 96));
dc.add(lathe("DoorBezel", [[0.158, -0.001], [0.154, 0.001], [0.150, 0.002]], bezelM, 96));
dc.add(lathe("DoorGlass", [[0.150, 0.002], [0.10, 0.006], [0.05, 0.009], [0.0, 0.010]], glass, 72));
dc.add(lathe("DoorBowl", [[0.150, -0.028], [0.140, -0.040], [0.128, -0.060], [0.09, -0.078], [0.0, -0.083]], bowl, 72));
dc.add(box("DoorHook", 0.012, 0.022, 0.016, mat("DoorHookM", 0x1d1e20, { rough: 0.5 }), 0.190, 0.003, -0.036));
door.add(dc);
// the door's side of each hinge round the pivot, and the two black slots in the door's back the arms run into (gal3)
for (const hy of armY) {
  door.add(box("DoorHingeArm", 0.018, 0.02, 0.01, hingeM, 0.009, hy - cy, -0.007));
  dc.add(box("DoorSlot", 0.016, 0.014, 0.002, dark, -0.229, hy - cy, -0.0292));
}
// the pull recess on the back of the ring at the far edge (gal3: about 34 x 160 mm, black)
dc.add(box("DoorPull", 0.03, 0.16, 0.006, mat("DoorPullM", 0x070708, { rough: 0.5 }), doorR - 0.022, 0, -0.03));
root.add(door);

const parts = productParts(PRODUCTS, ID);
const clips = stateClips(root, parts);
saveZones(PRODUCTS, ID, root, parts);
// Grain: LG's side photo shows horizontal hairlines on the front plate and its wrap; the ribbed sides and the top
// are speckled paint. No grain on the printed strip, the drawer face, the display glass or the label.
const grain = { dir: `${TEX}/grain`, materials: {
  Front: { type: "hairline_soft", dir: "h" }, FrontEdge: { type: "hairline_soft", dir: "h" },
  SideL: { type: "peel_soft" }, SideR: { type: "peel_soft" }, TopPlate: { type: "peel_soft" }, StripEdge: { type: "peel_soft" },
} };
await exportGLB(root, clips, OUT, {
  Front: `${T}/front.jpg`, SideL: `${T}/side_l.jpg`, SideR: `${T}/side_r.jpg`, Rear: `${T}/rear.jpg`,
  Panel: `${T}/panel.jpg`, DisplayGlass: `${T}/panel.jpg`, DrawerFace: `${T}/drawer.jpg`, KnobTop: `${T}/knob_top.jpg`, Drum: `${T}/drum.jpg`,
  Hose: `${T}/hose.jpg`, EnergyLabel: `${T}/label.jpg`, StickerTop: `${T}/sticker_top.jpg`, StickerSide: `${T}/sticker_side.jpg`,
}, grain);
