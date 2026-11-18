// LG FHP1410Z5M, 10 kg front load with AI Direct Drive, Middle Black.
// Built to LG's published size (LG India's spec table for FHP1410Z5M; Sangeetha's listing gives the same): W 600, H 850,
// D 565 mm for the cabinet, D' 615 mm to the front of the door, D'' 1100 mm with the door open at 90 degrees.
// Everything else is measured on LG's own photos of this model (its gallery: the drawer reads "10kg"):
//   front_mz (front, straight on): 815.6 px for 600 mm (1.3593 px/mm), 1.3647 px/mm up, left edge x 120.8, floor y 1248;
//   DZ-10 / DZ-11 (left / right side), DZ-12 (rear, 1.0822 px/mm), DZ-4 and Sangeetha's sg3 (door open, three-quarter).
// The front has, top to bottom: the 99 mm control strip (drawer face 214.6 mm wide at the left, the dial with the power
// and start buttons, the programme names and a black display glass with the touch keys), then the front plate with the
// round door, the energy label at the top right and the pump-filter cover at the bottom right; the cabinet stands 20.5 mm
// up on four feet. The front frame's vertical edges are rounded and it wraps 32 mm round the sides; the sides carry five
// embossed ribs (their photo is the texture); the top lid shows 28 mm on the sides and back.
// The back: the tub plate, four transit bolts, the drain hose (from its end fitting at the bottom, up the left, over the
// top and down to its holder), the power cord and plug, the inlet, traced from the rear photo into rear_paths.json.
// Every number is tagged in private/research/lg_fhp1410/NOTES.md.
// usage: node make_lg_fhp1410.mjs <entries json> <tex dir> <out.glb>
import fs from "node:fs";
import { THREE, mat, mesh, box, group, lathe, flipV, inward, stateClips, exportGLB, productParts, saveZones } from "./lib.mjs";

const [PRODUCTS, TEX, OUT] = process.argv.slice(2);
const ID = "lg-fhp1410z5m";
const T = `${TEX}/lg_fhp1410`;

// ── size (metres) ──
const W = 0.6, H = 0.85, D = 0.565;                       // LG India's spec table (VERIFIED)
const zF = D / 2, zB = -D / 2;
const yb = 0.0205;                                        // the cabinet's lower edge (DZ-12; front_mz reads 18 mm, its feet sit behind the front)
const lid0 = 0.822;                                       // the top lid's lower edge on the sides and back (DZ-10 / DZ-11 / DZ-12)
const strip0 = 0.7504, stripTop = 0.8495;                 // the control strip (front_mz seam at y 224; its face reaches the lid's rim)
const stripMid = (stripTop + strip0) / 2, stripH = stripTop - strip0;
const drawerW = 0.2146;                                   // the drawer face (front_mz x 120.8-412.5)
const wrap = 0.032;                                       // the front frame wraps 32 mm round the sides (DZ-11)
const edgeR = 0.014;                                      // its vertical edges are rounded (front_mz: the highlight 14 mm in)
const cx = 0.0034, cy = 0.4675;                           // the door's centre (front_mz: the ring at x 180-886, y 253-966)
const doorR = 0.260;                                      // the door ring (front_mz: 519 mm across, 522 mm up)
const lipR = 0.247;                                       // the opening in the front plate: the seat's raised lip (sg3)
const flapC = { x: 0.196, y: 0.0857, w: 0.1486, h: 0.1041 }; // the pump-filter cover's groove (front_mz)

// ── materials ──
const frontM = mat("Front", 0x38383a, { metal: 0.3, rough: 0.45 });
const frontEdge = mat("FrontEdge", 0x38383a, { metal: 0.3, rough: 0.45 });
const stripEdge = mat("StripEdge", 0x3b3b3d, { metal: 0.15, rough: 0.4 });
const sideR = mat("SideR", 0xffffff, { metal: 0.25, rough: 0.5 });
const sideL = mat("SideL", 0xffffff, { metal: 0.25, rough: 0.5 });
const rearM = mat("Rear", 0xffffff, { rough: 0.6 });
const panelM = mat("Panel", 0xffffff, { metal: 0.15, rough: 0.35 });
const glassKeys = mat("DisplayGlass", 0xffffff, { metal: 0.3, rough: 0.2 });
const drawerM = mat("DrawerFace", 0xffffff, { metal: 0.15, rough: 0.35 });
const topM = mat("TopPlate", 0x313133, { metal: 0.2, rough: 0.5 });
const bodyDark = mat("BodyDark", 0x2e2e30, { rough: 0.6 });
const dark = mat("Dark", 0x0b0c0d, { rough: 0.8 });
const pocketM = mat("Pocket", 0x3a3a3e, { metal: 0.45, rough: 0.3 });   // front_mz: the scoop reads light grey and glossy
const lipM = mat("PocketLip", 0x5a5a5e, { rough: 0.35, metal: 0.2 });
const trayM = mat("TrayWhite", 0xf1f3f5, { rough: 0.5 });
const trayFloor = mat("TrayFloor", 0xc9ced3, { rough: 0.6 });
const trayBlue = mat("TrayBlue", 0x4a86e0, { rough: 0.3 });
const chrome = mat("Chrome", 0xc4c7cb, { metal: 1, rough: 0.2 });
const knobSkirt = mat("KnobSkirt", 0x1a1a1c, { metal: 0.5, rough: 0.25 });
const wellM = mat("DialWell", 0x242426, { metal: 0.3, rough: 0.35 });
const knobTop = mat("KnobTop", 0xffffff, { metal: 0.6, rough: 0.35 });
const btnPower = mat("BtnPower", 0xffffff, { metal: 0.2, rough: 0.35 });
const btnStart = mat("BtnStart", 0xffffff, { metal: 0.2, rough: 0.35 });
const seatM = mat("DoorSeat", 0x2e2f32, { metal: 0.3, rough: 0.45, side: THREE.DoubleSide });
const seatLip = mat("SeatLip", 0x45474b, { metal: 0.5, rough: 0.3, side: THREE.DoubleSide });
const gasketM = mat("Gasket", 0x8a8e93, { rough: 0.85, side: THREE.DoubleSide });
const doorIn = mat("DoorInner", 0xaeb0b3, { metal: 0.25, rough: 0.45, side: THREE.DoubleSide });
const ringBlack = mat("DoorBlack", 0x050506, { metal: 0.3, rough: 0.14, side: THREE.DoubleSide });
const doorStep = mat("DoorStep", 0x0c0c0e, { metal: 0.3, rough: 0.25, side: THREE.DoubleSide });
const bezelM = mat("DoorBezel", 0x8a8e94, { metal: 0.7, rough: 0.3, side: THREE.DoubleSide });
const glass = mat("DoorGlass", 0x0b0c0d, { rough: 0.04, opacity: 0.68, side: THREE.DoubleSide });
const bowl = mat("GlassBowl", 0x9a9ea2, { rough: 0.05, opacity: 0.1, side: THREE.DoubleSide });
const drum = mat("Drum", 0xffffff, { metal: 0.85, rough: 0.28 });
const lifterM = mat("DrumLifter", 0xffffff, { metal: 0.85, rough: 0.24 });
const steel = mat("Steel", 0xb9bcc0, { metal: 0.9, rough: 0.3 });
const hingeM = mat("Hinge", 0xa9acb0, { metal: 0.8, rough: 0.3 });
const backGrey = mat("DrumBack", 0x45474b, { metal: 0.85, rough: 0.35 });
const footM = mat("Foot", 0xa3a6ab, { metal: 0.7, rough: 0.35 });
const filterM = mat("FilterCap", 0x8d9096, { rough: 0.55 });
const bayM = mat("Bay", 0x101113, { rough: 0.75 });
const hoseM = mat("Hose", 0xffffff, { rough: 0.7 });
const cordM = mat("Cord", 0x1c1d1f, { rough: 0.6 });
const plugM = mat("Plug", 0x7d8084, { rough: 0.55 });
const boltM = mat("Bolt", 0xaeb2b7, { metal: 0.9, rough: 0.3 });
const rubberM = mat("Rubber", 0x151618, { rough: 0.9 });
const blueM = mat("InletCap", 0x2c78d8, { rough: 0.5 });
const clipM = mat("HoseClip", 0xd9dbdd, { rough: 0.5 });

const root = group("LGFHP1410");
const cab = group("Cabinet");
root.add(cab);

// ── cabinet: the top lid, ribbed sides, the front frame's rounded edges and wrap, base and back ──
const t = 0.006;
cab.add(box("Top", W, H - lid0, D - wrap, topM, 0, (H + lid0) / 2, zB + (D - wrap) / 2));
{
  const sh = lid0 - yb, sd = D - wrap - 0.001;
  cab.add(mesh("SideLeft", flipV(new THREE.BoxGeometry(t, sh, sd)), [bodyDark, sideL, bodyDark, bodyDark, bodyDark, bodyDark], -W / 2 + t / 2, yb + sh / 2, zB + sd / 2));
  cab.add(mesh("SideRight", flipV(new THREE.BoxGeometry(t, sh, sd)), [sideR, bodyDark, bodyDark, bodyDark, bodyDark, bodyDark], W / 2 - t / 2, yb + sh / 2, zB + sd / 2));
  for (const s of [-1, 1]) {
    // the front frame below the strip: a rounded vertical edge (radius 14 mm) and its wrap back to the side panel
    const g = new THREE.CylinderGeometry(edgeR, edgeR, strip0 - yb, 10, 1, true, s > 0 ? 0 : -Math.PI / 2, Math.PI / 2);
    cab.add(mesh("FrontEdgeRound", g, frontEdge, s * (W / 2 - edgeR), (strip0 + yb) / 2, zF - edgeR));
    const lw = wrap - edgeR;
    cab.add(box("FrontWrap", 0.002, strip0 - yb, lw, frontEdge, s * (W / 2 - 0.001), (strip0 + yb) / 2, zF - edgeR - lw / 2));
    // beside the strip: the strip's own frame, plain
    cab.add(box("StripWrap", 0.002, stripTop - strip0 - 0.001, wrap - 0.001, stripEdge, s * (W / 2 - 0.0015), stripMid - 0.0005, zF - wrap / 2 - 0.0005));
  }
  cab.add(box("StripCap", W - 0.003, 0.0015, wrap - 0.001, stripEdge, 0, stripTop - 0.00075, zF - wrap / 2 - 0.0005));
}
cab.add(box("Base", W - 2 * t, 0.004, D - 0.01, dark, 0, yb + 0.002, 0));
cab.add(box("SeamBacker", W - 2 * t, 0.012, 0.002, dark, 0, strip0, zF - 0.012));
{ // the back: LG's rear photo (hose and cord painted out) from the cabinet's lower edge up to the lid
  const g = new THREE.PlaneGeometry(W, lid0 - yb);
  const uv = g.attributes.uv, pos = g.attributes.position;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, (pos.getX(i) + W / 2) / W, (H - (pos.getY(i) + (lid0 + yb) / 2)) / H);
  const back = mesh("BackPanel", g, rearM, 0, (lid0 + yb) / 2, zB - 0.0005);
  back.rotation.y = Math.PI;
  cab.add(back);
}
// four levelling feet: a silver pad, a hex nut and the threaded stem (front_mz: centres x -280.0 / +275.1, pads 34 mm
// across; DZ-10 / DZ-11: the front pair about 55 mm behind the front, the back pair 27 mm in from the back, ESTIMATED)
for (const [fx, fz] of [[-0.280, zF - 0.055], [0.2751, zF - 0.055], [-0.280, zB + 0.027], [0.2751, zB + 0.027]]) {
  const f = group("Foot", fx, 0, fz);
  f.add(mesh("FootPad", new THREE.CylinderGeometry(0.0165, 0.017, 0.006, 24), footM, 0, 0.003, 0));
  f.add(mesh("FootNut", new THREE.CylinderGeometry(0.0115, 0.0115, 0.006, 6), footM, 0, 0.009, 0));
  f.add(mesh("FootThread", new THREE.CylinderGeometry(0.0055, 0.0055, yb - 0.012, 12), steel, 0, 0.012 + (yb - 0.012) / 2, 0));
  cab.add(f);
}

// ── the rear fittings, traced from LG's rear photo DZ-12 (photo px -> metres; the photo's left is the machine's +x side) ──
const rp = JSON.parse(fs.readFileSync(`${T}/rear_paths.json`, "utf8"));
const PPM = rp.px_per_mm;
const rx = (px) => W / 2 - (px - rp.x0) / PPM / 1000;
const ry = (py) => H - (py - rp.y0) / PPM / 1000;
const mm = (px) => px / PPM / 1000;
const plateDepth = 0.012;
{ // the raised tub plate (rounded rectangle), its outer face the rear photo's plate; 12 mm proud (ESTIMATED)
  const [x0, y0, x1, y1] = rp.plate;
  const w = mm(x1 - x0), h = mm(y1 - y0), r = 0.034;
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
const zOver = (px, py) => {
  const [x0, y0, x1, y1] = rp.plate;
  return px > x0 + 6 && px < x1 - 6 && py > y0 + 6 && py < y1 - 6 ? zB - plateDepth : zB;
};
for (const [px, py, pr] of rp.bolts) { // the four transit bolts: rubber ring, cap, hex head (their rings measured on DZ-12)
  const bx = rx(px), by = ry(py), R = mm(pr), z0 = zOver(px, py);
  const ring = mesh("BoltRing", new THREE.CylinderGeometry(R, R, 0.005, 24), rubberM, bx, by, z0 - 0.0025); ring.rotation.x = Math.PI / 2; cab.add(ring);
  const cap = mesh("BoltCap", new THREE.CylinderGeometry(R * 0.78, R * 0.78, 0.009, 24), boltM, bx, by, z0 - 0.0075); cap.rotation.x = Math.PI / 2; cab.add(cap);
  const head = mesh("BoltHead", new THREE.CylinderGeometry(R * 0.5, R * 0.5, 0.006, 6), boltM, bx, by, z0 - 0.0135); head.rotation.x = Math.PI / 2; cab.add(head);
}
// The traced routes carry the tracer's wobble: resample every 2 px, smooth with a Gaussian of sigmaPx, thin to one point
// every everyPx, keep both ends.
function smoothRoute(P, sigmaPx, everyPx) {
  const dist = [0];
  for (let i = 1; i < P.length; i++) dist.push(dist[i - 1] + Math.hypot(P[i][0] - P[i - 1][0], P[i][1] - P[i - 1][1]));
  const L = dist[dist.length - 1], R = [];
  for (let sPx = 0, j = 0; sPx < L; sPx += 2) {
    while (j < P.length - 2 && dist[j + 1] < sPx) j++;
    const u = (sPx - dist[j]) / Math.max(1e-9, dist[j + 1] - dist[j]);
    R.push([P[j][0] + u * (P[j + 1][0] - P[j][0]), P[j][1] + u * (P[j + 1][1] - P[j][1])]);
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
const hoseCtrl = smoothRoute(rp.hose, 8, 24), hoseR = rp.hose_d_mm / 2000, zH = zB - hoseR - 0.0015;
{ // drain hose: ribbed grey, 26 mm across its ribs (DZ-12: 28 px at 1.082 px/mm), one rib every 4.3 mm. Its route is the
  // photo's centre line: from its end fitting at the bottom middle, right along the bottom, up the machine's left side, over
  // the top and down the right side into its holder.
  // where the photo's hose runs along the cabinet's left edge (its outside reaches 5 mm past the side there, inside the
  // photo's own measuring error), it is kept within the side so the model stays at LG's 600 mm
  const xLim = W / 2 - hoseR - 0.0005;
  const pts = hoseCtrl.map(([px, py]) => new THREE.Vector3(Math.max(-xLim, Math.min(xLim, rx(px))), ry(py), zH));
  const curve = new THREE.CatmullRomCurve3(pts, false, "centripetal");
  const len = curve.getLength();
  const g = new THREE.TubeGeometry(curve, Math.round(len / 0.008), hoseR, 10, false);
  const uv = g.attributes.uv, ribs = len / 0.0043;
  for (let i = 0; i < uv.count; i++) uv.setX(i, uv.getX(i) * ribs);
  cab.add(mesh("DrainHose", g, hoseM));
  // the grey end fitting the hose starts from, lying along the bottom (DZ-12 x 690-740, y 905-933)
  const [fx0, fy0, fx1, fy1] = rp.hose_fit;
  const fit = mesh("HoseFitting", new THREE.CylinderGeometry(mm(fy1 - fy0) / 2, mm(fy1 - fy0) / 2, mm(fx1 - fx0), 20), plugM, rx((fx0 + fx1) / 2), ry((fy0 + fy1) / 2), zH);
  fit.rotation.z = Math.PI / 2;
  cab.add(fit);
  const e = pts[pts.length - 1];
  cab.add(mesh("HoseEnd", new THREE.SphereGeometry(hoseR, 12, 8), hoseM, e.x, e.y, e.z));
  // the holder the hose end sits in: a light grey loop round it (DZ-12 x 503-545, y 425-528); how far it stands off is ESTIMATED
  const [hx0, hy0, hx1, hy1] = rp.holder;
  const hw = mm(hx1 - hx0) / 2, hh = mm(hy1 - hy0) / 2, rim = 0.0045;
  const loop = (sh, a, b) => {
    sh.absarc(0, b - a, a, 0, Math.PI, false); sh.absarc(0, -(b - a), a, Math.PI, 2 * Math.PI, false);
  };
  const ring = new THREE.Shape(); loop(ring, hw, hh);
  const hole = new THREE.Path(); loop(hole, hw - rim, hh - rim); ring.holes.push(hole);
  const hg = new THREE.ExtrudeGeometry(ring, { depth: 0.03, bevelEnabled: false, curveSegments: 12 });
  cab.add(mesh("HoseHolder", hg, clipM, rx((hx0 + hx1) / 2), ry((hy0 + hy1) / 2), zB - 0.03));
  // the two white clips that hold the hose to the back, one each side (DZ-12: centre, width, height in px)
  for (const [px, py, w, h] of rp.clips) cab.add(box("HoseClip", mm(w), mm(h), 2 * hoseR + 0.004, clipM, rx(px), ry(py), zH));
}
{ // the power cord: from its grommet at the top over to the right (DZ-12), then the long run down the left to the plug.
  // Where it crosses the drain hose it lies on it, as in the photo.
  const cordR = 0.0045;
  const overHose = (px, py) => {
    let best = Infinity;
    for (let i = 1; i < hoseCtrl.length; i++) {
      const [ax, ay] = hoseCtrl[i - 1], [bx, by] = hoseCtrl[i], vx = bx - ax, vy = by - ay;
      const u = Math.max(0, Math.min(1, ((px - ax) * vx + (py - ay) * vy) / (vx * vx + vy * vy || 1)));
      best = Math.min(best, Math.hypot(px - ax - u * vx, py - ay - u * vy));
    }
    const d = mm(best), reach = hoseR + cordR;
    return d < reach ? zH - Math.sqrt(reach * reach - d * d) : Infinity;
  };
  const run = (list, dz = 0.0045) => {
    const q = smoothRoute(list, 12, 16), z = q.map(([px, py]) => Math.min(zOver(px, py) - dz, overHose(px, py)));
    const zs = z.map((_, i) => Math.min(...z.slice(Math.max(0, i - 3), i + 4)));
    return q.map(([px, py], i) => {
      const win = zs.slice(Math.max(0, i - 2), i + 3);
      return new THREE.Vector3(rx(px), ry(py), win.reduce((a, b) => a + b, 0) / win.length);
    });
  };
  const tube = (name, pts) => cab.add(mesh(name, new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts, false, "centripetal"), 90, cordR, 6, false), cordM));
  tube("CordTop", run(rp.cord_top));
  const down = run([...rp.cord_right, [rp.plug[0], rp.plug[1] - 18]]);
  tube("CordRun", down);
  const [gx, gy] = rp.grommet;
  cab.add(mesh("Grommet", new THREE.TorusGeometry(0.0095, 0.0035, 8, 24), plugM, rx(gx), ry(gy), zB - 0.0035));
  const [px, py] = rp.plug;
  const ps = new THREE.Shape();
  ps.moveTo(0, 0.027); ps.bezierCurveTo(0.012, 0.021, 0.027, -0.008, 0.026, -0.017); ps.quadraticCurveTo(0, -0.032, -0.026, -0.017);
  ps.bezierCurveTo(-0.027, -0.008, -0.012, 0.021, 0, 0.027);
  const pg = new THREE.ExtrudeGeometry(ps, { depth: 0.014, bevelEnabled: true, bevelSize: 0.003, bevelThickness: 0.003, bevelSegments: 3, curveSegments: 14 });
  const plug = mesh("Plug", pg, cordM, rx(px), ry(py) - 0.002, zB - 0.004);
  plug.rotation.y = Math.PI;
  cab.add(plug);
  const [ix, iy] = rp.inlet;                                    // the water inlet: a grey seat and its blue cap
  const seatI = mesh("InletSeat", new THREE.CylinderGeometry(0.0115, 0.0115, 0.008, 20), plugM, rx(ix), ry(iy), zB - 0.004); seatI.rotation.x = Math.PI / 2; cab.add(seatI);
  const capI = mesh("InletCap", new THREE.CylinderGeometry(0.0078, 0.0078, 0.012, 20), blueM, rx(ix), ry(iy), zB - 0.012); capI.rotation.x = Math.PI / 2; cab.add(capI);
}

// ── front plate (20.5 -> 750 mm, between the rounded edges): the door opening and the pump-filter cut-out ──
const plateTop = strip0 - 0.0008, plateH = plateTop - yb, pw2 = W / 2 - edgeR;
{
  const s = new THREE.Shape();
  s.moveTo(-pw2, 0); s.lineTo(pw2, 0); s.lineTo(pw2, plateH); s.lineTo(-pw2, plateH); s.lineTo(-pw2, 0);
  const hole = new THREE.Path(); hole.absarc(cx, cy - yb, lipR, 0, Math.PI * 2, true); s.holes.push(hole);
  const r = 0.009, x0 = flapC.x - flapC.w / 2 + 0.001, x1 = flapC.x + flapC.w / 2 - 0.001, y0 = flapC.y - flapC.h / 2 - yb + 0.001, y1 = flapC.y + flapC.h / 2 - yb - 0.001;
  const cut = new THREE.Path();
  cut.moveTo(x0 + r, y0); cut.lineTo(x1 - r, y0); cut.quadraticCurveTo(x1, y0, x1, y0 + r); cut.lineTo(x1, y1 - r); cut.quadraticCurveTo(x1, y1, x1 - r, y1);
  cut.lineTo(x0 + r, y1); cut.quadraticCurveTo(x0, y1, x0, y1 - r); cut.lineTo(x0, y0 + r); cut.quadraticCurveTo(x0, y0, x0 + r, y0);
  s.holes.push(cut);
  const g = new THREE.ExtrudeGeometry(s, { depth: 0.004, bevelEnabled: false, curveSegments: 96 });
  cab.add(mesh("FrontMain", g, [frontM, bodyDark], 0, yb, zF - 0.004));
}
// the door seat: a raised lip round the opening, then a shallow dish down to the gasket, 18 mm deep (ESTIMATED from sg3)
const dishZ = (r) => -0.002 - (0.236 - r) * (0.014 / 0.052);
{
  const seat = group("DoorSeatRing", cx, cy, zF);
  seat.add(lathe("SeatLip", [[lipR, -0.004], [lipR, 0.0], [0.2445, 0.0015], [0.240, 0.0008], [0.236, -0.002]], seatLip, 96));
  seat.add(lathe("SeatDish", [[0.236, -0.002], [0.184, -0.016], [0.180, -0.020]], seatM, 96));
  cab.add(seat);
}
// the gasket: light grey rubber (DZ-4, sg3), a rolled lip from r 180 to 154 mm folding back into the drum
{
  const g = lathe("GasketRing", [[0.180, -0.020], [0.177, -0.017], [0.169, -0.014], [0.159, -0.016], [0.154, -0.024], [0.155, -0.042],
    [0.163, -0.062], [0.185, -0.087], [0.210, -0.100]], gasketM, 72);
  g.position.set(cx, cy, zF);
  cab.add(g);
}
// the hinge (sg3, DZ-4): a chrome bracket on the seat at the left with two arms reaching forward into the door's back to
// the pivot. The closed door hides it. The lock slot is at the right of the opening (sg3).
const pivotL = doorR - 0.009;                             // the pivot 9 mm inside the ring's edge (ESTIMATED)
const pivotZ = zF + 0.022;                                // 22 mm in front of the plate, inside the closed door (ESTIMATED)
const hingeX = cx - 0.2038;
cab.add(box("HingePlate", 0.023, 0.143, 0.004, hingeM, hingeX, cy + 0.0016, zF + dishZ(0.2038) + 0.0022));
const armY = [cy + 0.0411, cy - 0.0419];
for (const hy of armY) {
  const z0 = zF + dishZ(0.2038) + 0.004, z1 = pivotZ - 0.002, xa = hingeX + 0.0063, xb = cx - pivotL;
  cab.add(box("HingePlate", xa - xb, 0.012, z1 - z0, hingeM, (xa + xb) / 2, hy, (z0 + z1) / 2));
}
const lockX = 0.205;
cab.add(box("LockSlot", 0.013, 0.024, 0.006, dark, cx + lockX, cy, zF + dishZ(lockX) + 0.0025));
// the pump-filter housing behind the cover: a dark box, the drain plug and the round filter cap with its grip (manual)
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
// the cover: a lid hinged along its lower edge, opening forward and down (manual), in the front's own finish, with the
// small finger notch at the middle of its top edge (front_mz: about 22 x 5 mm)
{
  const f = group("FilterFlap", flapC.x, flapC.y - flapC.h / 2 + 0.0015, zF - 0.0035);
  const lw = flapC.w / 2 - 0.0016, lh = flapC.h - 0.0032, r = 0.0085;
  const sh = new THREE.Shape();
  sh.moveTo(-lw + r, 0); sh.lineTo(lw - r, 0); sh.quadraticCurveTo(lw, 0, lw, r); sh.lineTo(lw, lh - r); sh.quadraticCurveTo(lw, lh, lw - r, lh);
  sh.lineTo(-lw + r, lh); sh.quadraticCurveTo(-lw, lh, -lw, lh - r); sh.lineTo(-lw, r); sh.quadraticCurveTo(-lw, 0, -lw + r, 0);
  const g = new THREE.ExtrudeGeometry(sh, { depth: 0.004, bevelEnabled: false, curveSegments: 6 });
  f.add(mesh("FlapLid", g, [frontM, bodyDark], 0, 0.0001, 0));
  f.add(box("FlapNotch", 0.022, 0.005, 0.0015, dark, 0, lh - 0.006, 0.0045));
  root.add(f);
}

// ── the control strip: the printed panel right of the drawer, the raised display glass, the dial, the two buttons ──
{
  const x0 = -W / 2 + drawerW + 0.0004, pw = W / 2 - x0, h = stripH - 0.0016;
  cab.add(mesh("ControlStrip", flipV(new THREE.BoxGeometry(pw, h, 0.010)), [stripEdge, stripEdge, stripEdge, stripEdge, panelM, stripEdge], x0 + pw / 2, stripMid, zF - 0.005));
}
{ // the display glass with the touch keys stands 1.2 mm proud (ESTIMATED); its face is the strip texture where the glass is
  // (front_mz px 682-893, 102-195: x 112.9-268.1 mm, y 771.6-839.7 mm)
  const gx0 = 0.1129, gx1 = 0.2681, gy0 = 0.7716, gy1 = 0.8397;
  const g = new THREE.BoxGeometry(gx1 - gx0, gy1 - gy0, 0.0012);
  const uv = g.attributes.uv;
  const sx0 = -W / 2 + drawerW;
  for (let i = 16; i < 20; i++) {
    const u = uv.getX(i), v = uv.getY(i);
    uv.setXY(i, (gx0 + u * (gx1 - gx0) - sx0) / (W / 2 - sx0), (stripTop - (gy0 + v * (gy1 - gy0))) / stripH);
  }
  cab.add(mesh("DisplayGlass", g, [dark, dark, dark, dark, glassKeys, dark], (gx0 + gx1) / 2, (gy0 + gy1) / 2, zF + 0.0006));
}
// the dial (front_mz centre x 534.5, y 147.5): a dark well 71 mm across with a light rim, the dark-chrome skirt 52.6 mm
// across and the spun silver top 39 mm across; heights ESTIMATED (about 14 mm)
{
  const k = group("Dial", 0.0043, 0.8064, zF);
  k.add(lathe("DialRing", [[0.0356, 0], [0.0352, 0.0012], [0.0340, 0.0016], [0.0300, 0.0010], [0.0270, 0.0006]], wellM, 64));
  k.add(lathe("KnobSkirt", [[0.0263, 0.0004], [0.0263, 0.0080], [0.0250, 0.0115], [0.0215, 0.0135], [0.0198, 0.0138]], knobSkirt, 64));
  k.add(lathe("KnobEdge", [[0.0198, 0.0138], [0.0196, 0.0141], [0.0193, 0.0141]], chrome, 64));
  k.add(mesh("KnobTop", new THREE.CircleGeometry(0.0195, 64), knobTop, 0, 0, 0.0141));
  cab.add(k);
}
// the power and start / pause buttons (front_mz: centres x 452.5 / 617.5, y 197; 25 mm wells, caps 19 mm), 3 mm proud (ESTIMATED)
for (const [name, bx, by, m] of [["PowerButton", -0.0560, 0.7701, btnPower], ["StartButton", 0.0654, 0.7698, btnStart]]) {
  const b = group(name, bx, by, zF);
  b.add(lathe(name + "Ring", [[0.0118, 0], [0.0118, 0.0014], [0.0108, 0.0020], [0.0100, 0.0018]], knobSkirt, 48));
  b.add(lathe(name + "Cap", [[0, 0], [0.0098, 0], [0.0098, 0.0024], [0.0094, 0.0029], [0, 0.0029]], knobSkirt, 48));
  b.add(mesh(name + "Face", new THREE.CircleGeometry(0.0095, 48), m, 0, 0, 0.00295));
  cab.add(b);
}

// ── detergent drawer: LG's face with its finger pocket (front_mz: 166 x 29.5 mm, x 26.8-193.2 mm from the left edge,
// y 756-785.5 mm), a white tray with the three compartments behind it (manual: main wash, pre-wash, softener) ──
const dX = -W / 2 + drawerW / 2 - 0.0004, dY = stripMid;
const drawer = group("Drawer", dX, dY, zF);
{
  const dw = drawerW - 0.0008, hw = dw / 2, hh = (stripH - 0.0016) / 2;
  const s = new THREE.Shape();
  s.moveTo(-hw, -hh); s.lineTo(hw, -hh); s.lineTo(hw, hh); s.lineTo(-hw, hh); s.lineTo(-hw, -hh);
  const pw = 0.1664, ph = 0.0295, pcx = 0.110 - drawerW / 2 + 0.0004, pcy = 0.77075 - stripMid, r = 0.008;
  const cut = new THREE.Path();
  cut.moveTo(pcx - pw / 2 + r, pcy - ph / 2); cut.lineTo(pcx + pw / 2 - r, pcy - ph / 2); cut.quadraticCurveTo(pcx + pw / 2, pcy - ph / 2, pcx + pw / 2, pcy - ph / 2 + r);
  cut.lineTo(pcx + pw / 2, pcy + ph / 2 - r); cut.quadraticCurveTo(pcx + pw / 2, pcy + ph / 2, pcx + pw / 2 - r, pcy + ph / 2);
  cut.lineTo(pcx - pw / 2 + r, pcy + ph / 2); cut.quadraticCurveTo(pcx - pw / 2, pcy + ph / 2, pcx - pw / 2, pcy + ph / 2 - r);
  cut.lineTo(pcx - pw / 2, pcy - ph / 2 + r); cut.quadraticCurveTo(pcx - pw / 2, pcy - ph / 2, pcx - pw / 2 + r, pcy - ph / 2);
  s.holes.push(cut);
  const g = new THREE.ExtrudeGeometry(s, { depth: 0.012, bevelEnabled: false, curveSegments: 6 });
  const pos = g.attributes.position, uv = g.attributes.uv;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, (pos.getX(i) + drawerW / 2 - 0.0004) / drawerW, (pos.getY(i) * -1 + stripH / 2) / stripH);
  g.translate(0, 0, -0.012);
  drawer.add(mesh("DrawerFace", g, [drawerM, pocketM]));
  // the finger pocket: dark inside, a bright lip along its top (front_mz shows the highlight there) and a grip at each end
  drawer.add(mesh("PocketInside", inward(new THREE.BoxGeometry(pw - 0.002, ph - 0.002, 0.016)), pocketM, pcx, pcy, -0.02));
  drawer.add(box("PocketLip", pw - 0.014, 0.0024, 0.008, lipM, pcx, pcy + ph / 2 - 0.0028, -0.0165));
  drawer.add(box("PocketGripL", 0.006, ph - 0.008, 0.004, lipM, pcx - pw / 2 + 0.005, pcy, -0.0125));
  drawer.add(box("PocketGripR", 0.006, ph - 0.008, 0.004, lipM, pcx + pw / 2 - 0.005, pcy, -0.0125));
  // the tray behind the face: main wash on the left, pre-wash at the front right, softener at the back right (the manual
  // shows it from one angle only, so the compartment sizes are ESTIMATED)
  const trayW = drawerW - 0.02, trayH = stripH - 0.03, trayL = 0.24, tz0 = -0.032, z1 = tz0 - trayL, zc = tz0 - trayL / 2, wt = 0.0028, y0 = -0.003;
  drawer.add(box("TrayFloor", trayW, wt, trayL, trayFloor, 0, y0 - trayH / 2 + wt / 2, zc));
  drawer.add(box("TrayWallL", wt, trayH, trayL, trayM, -trayW / 2 + wt / 2, y0, zc));
  drawer.add(box("TrayWallR", wt, trayH, trayL, trayM, trayW / 2 - wt / 2, y0, zc));
  drawer.add(box("TrayWallBack", trayW, trayH, wt, trayM, 0, y0, z1 + wt / 2));
  const xd = -trayW / 2 + trayW * 0.56;                        // DZ-8: the blue right part is about 44% of the tray
  drawer.add(box("TrayDivider", wt, trayH * 0.92, trayL * 0.96, trayM, xd, y0 - trayH * 0.04, zc));
  const xm = (xd + trayW / 2) / 2;
  drawer.add(box("TrayCross", trayW / 2 - xd - wt, trayH * 0.85, wt, trayM, xm, y0 - trayH * 0.075, tz0 - trayL * 0.52));
  drawer.add(box("SoftenerCap", 0.03, 0.026, 0.026, trayBlue, xm, y0 - trayH / 2 + 0.015, z1 + trayL * 0.2));
  // DZ-8 (drawer open): the right-hand compartments are under a light blue cover from the cross wall back
  drawer.add(box("TrayBlueLid", trayW / 2 - xd - 2 * wt, 0.003, trayL * 0.46, mat("TrayBlueLidM", 0x9cc6f2, { rough: 0.3 }), xm, y0 + trayH / 2 - 0.008, z1 + trayL * 0.25));
  drawer.add(box("SoftenerMax", trayW / 2 - xd - 2 * wt, 0.0016, 0.004, trayBlue, xm, y0 - trayH * 0.3, tz0 - trayL * 0.52 + 0.004));
  for (let i = 0; i < 4; i++) drawer.add(box(`TrayInsert${i}`, 0.0025, trayH * 0.7, trayL * 0.3, trayM, -trayW / 2 + 0.02 + i * 0.016, y0 - trayH * 0.1, z1 + trayL * 0.2));
}
cab.add(drawer);
cab.add(mesh("DrawerBay", inward(new THREE.BoxGeometry(drawerW - 0.004, stripH - 0.006, 0.31)), dark, -W / 2 + drawerW / 2, stripMid, zF - 0.157));

// ── the stainless drum behind the gasket (DZ-4, sg3). LG's spec table: "Drum Lifter: Stainless Steel Slim Lifter"; the
// photos show three perforated steel lifters rising from the perforated wall, curving from the front lip to the back. Each
// rises to 120 mm at the back over 45 degrees either side of its centre and to 50 mm over 32 degrees at the front, after a
// 35 mm ramp (ESTIMATED from DZ-4 / sg3). Lifters carry the same perforated steel as the wall. The drum's radius and depth
// are not published: 250 mm and 340 mm (ESTIMATED; its back stands 120 mm in front of the cabinet's back for the motor). ──
const drumR = 0.25, drumDepth = 0.34, drumZ = zF - 0.105 - drumDepth / 2;
{
  const deg = THREE.MathUtils.degToRad, lifters = [270, 30, 150].map(deg);
  const hF = 0.05, hB = 0.12, wF = deg(32), wB = deg(45), ramp = 0.035;
  const zFront = drumZ + drumDepth / 2, NA = 120, a0 = deg(210);
  const ringsZ = [0, 0.008, 0.016, 0.026, 0.04, 0.07, 0.11, 0.16, 0.22, 0.28, drumDepth], NZ = ringsZ.length - 1;
  const radius = (phi, d) => {
    const s = d / drumDepth, rf = Math.min(1, d / ramp), up = rf * rf * (3 - 2 * rf);
    const h = (hF + (hB - hF) * s) * up, w = wF + (wB - wF) * s;
    let bump = 0;
    for (const a of lifters) {
      const u = Math.abs(Math.atan2(Math.sin(phi - a), Math.cos(phi - a))) / w;
      if (u < 1) bump = Math.max(bump, Math.cos((Math.PI / 2) * u * u));
    }
    return drumR - h * bump;
  };
  const SECN = NA / 3, Q = 0.6, TB = Math.sqrt((2 / Math.PI) * Math.acos(0.5));
  const colPhi = (i, d) => {
    const k = Math.min(2, Math.floor(i / SECN)), s = ((i - k * SECN) / SECN) * 2 - 1, w = wF + (wB - wF) * (d / drumDepth);
    const half = deg(60), lif = TB * w, m = Math.abs(s);
    const off = m <= Q ? (m / Q) * lif : lif + ((m - Q) / (1 - Q)) * (half - lif);
    return a0 + deg(60) + k * deg(120) + Math.sign(s) * off;
  };
  const P = [];
  for (let j = 0; j <= NZ; j++) {
    const z = zFront - ringsZ[j], ring = [];
    for (let i = 0; i <= NA; i++) {
      const phi = i === NA ? a0 + Math.PI * 2 : colPhi(i, ringsZ[j]), r = radius(phi, ringsZ[j]);
      ring.push([cx + r * Math.cos(phi), cy + r * Math.sin(phi), z]);
    }
    P.push(ring);
  }
  const len = (A, B) => Math.hypot(A[0] - B[0], A[1] - B[1], A[2] - B[2]);
  const SEC = NA / 3, arcs = P.map((ring) => { const c = [0]; for (let i = 1; i <= NA; i++) c.push(c[i - 1] + len(ring[i], ring[i - 1])); return c; });
  const U = Math.round((3 * arcs[0][SEC]) / 0.16) / 3;
  const down = [Array(NA + 1).fill(0)];
  for (let j = 1; j <= NZ; j++) down.push(P[j].map((p, i) => down[j - 1][i] + len(p, P[j - 1][i])));
  const pos = [], uv = [], idx = [], idxL = [];
  for (let k = 0; k < 3; k++) {
    const base = pos.length / 3;
    for (let j = 0; j <= NZ; j++) for (let i = k * SEC; i <= (k + 1) * SEC; i++) {
      const c = arcs[j], crest = c[k * SEC + SEC / 2];
      pos.push(...P[j][i]);
      uv.push(k * U + U / 2 + (c[i] - crest) / 0.16, down[j][i] / 0.08);
    }
    const row = SEC + 1;
    for (let j = 0; j < NZ; j++) for (let i = 0; i < SEC; i++) {
      const A = base + j * row + i, B = A + 1, C = A + row, Dd = C + 1;
      const s = ((i + 0.5) / SEC) * 2 - 1;
      (Math.abs(s) < Q && ringsZ[j] >= 0.008 ? idxL : idx).push(A, B, C, B, Dd, C);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex([...idx, ...idxL]);
  g.addGroup(0, idx.length, 0);
  g.addGroup(idx.length, idxL.length, 1);
  g.computeVertexNormals();
  cab.add(mesh("DrumShell", g, [drum, lifterM]));
}
cab.add(mesh("DrumBack", new THREE.CircleGeometry(drumR, 64), backGrey, cx, cy, drumZ - drumDepth / 2 + 0.002));
cab.add(mesh("DrumHub", new THREE.CylinderGeometry(0.024, 0.026, 0.01, 40), mat("DrumBoss", 0xd8d9db, { rough: 0.45 }), cx, cy, drumZ - drumDepth / 2 + 0.007).rotateX(Math.PI / 2));
cab.add(lathe("DrumLip", [[0.208, 0], [drumR, -0.005]], steel).translateX(cx).translateY(cy).translateZ(zF - 0.100));

// ── the door: hinged on the left, its pivot 9 mm inside the ring and 22 mm in front of the plate (ESTIMATED; with LG's
// D'' this puts the door's far edge 1098 mm from the back at 90 degrees, against LG's 1100 mm). The front of the door
// stands 50 mm proud of the cabinet (D' 615 against D 565 mm, VERIFIED). The ring is glossy black with the black tinted
// glass (LG: "Black Tinted Tempered Glass Cover") from r 184 mm in; its back is light grey (DZ-4, sg3). ──
const pivotX = cx - pivotL;
const door = group("Door", pivotX, cy, pivotZ);
const dc = group("DoorCentre", pivotL, 0, zF + 0.040 - pivotZ);
dc.add(lathe("DoorInnerRing", [[0.170, -0.038], [doorR - 0.0005, -0.038]], doorIn, 96));
dc.add(lathe("DoorRim", [[doorR - 0.0005, -0.038], [doorR, -0.024], [doorR - 0.001, -0.012], [doorR - 0.0055, -0.003], [doorR - 0.017, 0.002], [0.226, 0.005], [0.208, 0.006]], ringBlack, 96));
dc.add(lathe("DoorStep", [[0.208, 0.006], [0.204, 0.003], [0.192, 0.000], [0.188, -0.001]], doorStep, 96));
dc.add(lathe("DoorBezel", [[0.188, -0.001], [0.186, 0.001], [0.184, 0.002]], bezelM, 96));
dc.add(lathe("DoorGlass", [[0.184, 0.002], [0.12, 0.006], [0.06, 0.009], [0.0, 0.010]], glass, 72));
dc.add(lathe("DoorBowl", [[0.170, -0.038], [0.160, -0.046], [0.145, -0.058], [0.115, -0.074], [0.065, -0.086], [0.0, -0.090]], bowl, 72));
// the latch hook on the door's back at the far side, opposite the lock slot (sg3)
dc.add(box("DoorHook", 0.012, 0.024, 0.016, mat("DoorHookM", 0xc9cbce, { rough: 0.45 }), lockX, 0, -0.046));
door.add(dc);
for (const hy of armY) {
  door.add(box("DoorHingeArm", 0.018, 0.02, 0.01, hingeM, 0.009, hy - cy, -0.009));
  dc.add(box("DoorSlot", 0.016, 0.014, 0.002, dark, -0.229, hy - cy, -0.0392));
}
{ // the dark pull recess on the back of the ring at the far edge, a little above the middle (sg3: about 26 x 120 mm)
  const a = THREE.MathUtils.degToRad(28), r = 0.233;
  const p = box("DoorPull", 0.026, 0.12, 0.006, mat("DoorPullM", 0x1a1b1d, { rough: 0.5 }), r * Math.cos(a), r * Math.sin(a), -0.040);
  p.rotation.z = a;
  dc.add(p);
}
root.add(door);

const parts = productParts(PRODUCTS, ID);
const clips = stateClips(root, parts);
saveZones(PRODUCTS, ID, root, parts);
// Grain: LG's photos show fine horizontal hairlines on the Middle Black front frame; the ribbed sides and the top lid are
// speckled paint. No grain on the printed strip, the drawer face, the display glass or the label.
const grain = { dir: `${TEX}/grain`, materials: {
  Front: { type: "hairline_soft", dir: "h" }, FrontEdge: { type: "hairline_soft", dir: "h" },
  SideL: { type: "peel_soft" }, SideR: { type: "peel_soft" }, TopPlate: { type: "peel_soft" }, StripEdge: { type: "peel_soft" },
} };
await exportGLB(root, clips, OUT, {
  SideL: `${T}/side_l.jpg`, SideR: `${T}/side_r.jpg`, Rear: `${T}/rear.jpg`,
  Panel: `${T}/panel.jpg`, DisplayGlass: `${T}/panel.jpg`, DrawerFace: `${T}/drawer.jpg`, KnobTop: `${T}/knob_top.jpg`,
  Drum: `${T}/drum.jpg`, DrumLifter: `${T}/drum.jpg`, Hose: `${T}/hose.jpg`, BtnPower: `${T}/btn_power.jpg`, BtnStart: `${T}/btn_start.jpg`,
}, grain);
// the parts that stand in front of the published cabinet depth, with LG's own figures (read by the gate)
fs.writeFileSync(new URL(`../entries/${ID}.gate.json`, import.meta.url), JSON.stringify({ sticksOut: {
  "Door[A-Z]\\w*|Knob[A-Z]\\w*|DialRing|\\w*Button(Ring|Cap|Face)|Flap[A-Z]\\w*|LockSlot|HingePlate": "LG India gives D 565 mm for the cabinet and D' 615 mm to the door (spec table for FHP1410Z5M). The door, its hinge and lock, the dial, the two buttons and the filter flap stand in front of the cabinet.",
} }, null, 2) + "\n");
