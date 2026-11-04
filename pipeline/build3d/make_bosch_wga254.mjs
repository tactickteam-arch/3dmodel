// Bosch WGA254ZPIN, Series 6 front-load washing machine, 10 kg, 1400 rpm, Dark lake.
// Built to Bosch's published size, 598 W x 848 H x 590 D mm (63.6 cm deep with the door closed, 104.9 cm with the door open
// at 90 degrees, 60 L drum), from Bosch's straight-on studio photo of this model (the front, at 4.04 px/mm), its 360-degree
// frames (the sides with the Anti Vibration rings, the open steel back with its hoses, cord and plug, modelled in 3D) and its
// manual 9001980248 (the parts and the drawer's compartments): a control strip with the detergent drawer at the left, the dial
// and the touch display; a glass door hinged on the left with a chrome ring and a black ring; a round pump-filter flap at the
// bottom right; a stainless Vario Drum. Every position comes from tex_bosch_wga254.py (layout.json, rear_paths.json).
// usage: node make_bosch_wga254.mjs <products.json> <tex dir> <out.glb>
import fs from "node:fs";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import { THREE, mat, mesh, box, faced, group, lathe, frontWithHoles, flipV, inward, stateClips, exportGLB, productParts, saveZones } from "./lib.mjs";

const [PRODUCTS, TEX, OUT] = process.argv.slice(2);
const ID = "bosch-wga254zpin";
const T = `${TEX}/bosch_wga254`;
const L = JSON.parse(fs.readFileSync(`${T}/layout.json`, "utf8"));
const rp = JSON.parse(fs.readFileSync(`${T}/rear_paths.json`, "utf8"));

// ── size (metres) ──
const W = 0.598, H = 0.848, D = 0.590;                       // Bosch: 848 x 598 x 590 mm (product page and product sheet)
const zF = D / 2, zB = -D / 2;
const feet = L.feet, stripY = L.strip_y, stripH = H - stripY;  // feet 15 mm: ESTIMATED from the 360 frames and the studio photo
const cx = L.door.x, cy = L.door.y, ringR = L.door.rim, chromeIn = L.door.ring, glassR = L.door.glass;
// The door seat, as Bosch's open-door photos show it (360 frame 33 square-on at 1.418 px per mm, PGA3 at an angle): a black
// groove at 243 mm radius, just inside the door's chrome rim, a shallow dish in the body colour, and the light grey gasket
// from 162 mm in. Radii VERIFIED off frame 33 (+-3 mm); the dish's depth (17.5 mm) ESTIMATED from the shading in PGA3.
const seatR = 0.2432, gasketR = 0.162;
const DISH = [[0.2372, -0.0022], [0.225, -0.003], [0.205, -0.0055], [0.185, -0.009], [0.172, -0.0135], [0.1635, -0.0175]];
const dishZ = (r) => { for (let i = 1; i < DISH.length; i++) if (r >= DISH[i][0]) { const [r0, z0] = DISH[i - 1], [r1, z1] = DISH[i]; return z1 + (z0 - z1) * (r - r1) / (r0 - r1); } return DISH[DISH.length - 1][1]; };
// The door is 45.8 mm proud of the body (636 mm deep with the door). Bosch gives 1049 mm with the door open at 90 degrees:
// 590 + (hingeZ - zF) + 2 x 246.1 = 1049, so the hinge axis sits 33 mm behind the body front, at the rim's left edge.
const hingeZ = zF - 0.033;
const flap = L.flap;

// ── materials ──
const front = mat("Front", 0xffffff, { rough: 0.48 });
const sideL = mat("SideL", 0xffffff, { rough: 0.5 });
const sideR = mat("SideR", 0xffffff, { rough: 0.5 });
const rearM = mat("Rear", 0xffffff, { metal: 0.2, rough: 0.55 });
const panelM = mat("Panel", 0xffffff, { rough: 0.32 });
const drawerM = mat("DrawerFace", 0xffffff, { rough: 0.4 });
const barM = mat("DrawerBar", 0xffffff, { metal: 0.35, rough: 0.22 });
const trayM = mat("Tray", 0xffffff, { rough: 0.5 });
const trayWall = mat("TrayWall", 0xe4e6e9, { rough: 0.5 });
const siphon = mat("TraySiphon", 0x78a0cc, { rough: 0.35 });
const bodyDark = mat("BodyDark", 0x353a47, { rough: 0.5 });
const topM = mat("TopPlate", 0x2f3440, { rough: 0.7 });
const dark = mat("Dark", 0x0b0c0e, { rough: 0.8 });
const bay = mat("Bay", 0xb4b7bb, { rough: 0.6 });               // the pump recess is light grey plastic in Bosch's filter photo (PGA11)
const knobCap = mat("KnobCap", 0x1b1c1f, { metal: 0.2, rough: 0.22 });
const knobRing = mat("KnobRing", 0xbfc3c9, { metal: 1, rough: 0.18 });
const knobBase = mat("KnobBase", 0x24272e, { rough: 0.5 });
const chrome = mat("Chrome", 0xc9ccd1, { metal: 1, rough: 0.16 });
const ringBlack = mat("DoorBlack", 0x07080a, { metal: 0.3, rough: 0.1 });
const glass = mat("DoorGlass", 0x1c2126, { rough: 0.04, opacity: 0.07, side: THREE.DoubleSide });   // clear: the drum shows through (PGA12)
const bowl = mat("GlassBowl", 0x23282d, { rough: 0.05, opacity: 0.07, side: THREE.DoubleSide });
const doorIn = mat("DoorInner", 0x0a0b0d, { metal: 0.2, rough: 0.25 });   // glossy black inside (frame 33, PGA3)
const gasket = mat("Gasket", 0x7e8287, { rough: 0.85 });         // light grey in Bosch's open-door photos (PGA3, PGA8)
const drum = mat("Drum", 0xffffff, { metal: 0.6, rough: 0.32 });       // the polished drum is bright through the glass (STP, PGA12)
const steel = mat("Steel", 0xb9bcc0, { metal: 0.9, rough: 0.3 });
const ribM = mat("DrumRib", 0xc6c9cd, { rough: 0.45 });
const backGrey = mat("DrumBack", 0x6d7177, { metal: 0.8, rough: 0.3 });
const footM = mat("Foot", 0xb0b3b7, { rough: 0.6 });             // light grey feet (PGA12, the 360 frames)
const flapM = mat("FlapFace", 0x3a3f4c, { rough: 0.48 });
const notchM = mat("FlapNotch", 0x0c0d10, { rough: 0.8 });
const filterM = mat("FilterCap", 0x6c6f74, { rough: 0.55 });
const filterFace = mat("FilterFace", 0xc9ccd0, { rough: 0.5 });
const pumpHoseM = mat("PumpHose", 0x101113, { rough: 0.7 });
const slotM = mat("LockSlotFace", 0x0d0e10, { rough: 0.7 });
// the back (Bosch's rear 360 frame, 1.40 px/mm): grey ribbed drain hose, smooth blue-grey inlet hose, dark grey cord
const drainM = mat("Hose", 0xffffff, { rough: 0.7 });
const cuffM = mat("HoseCuffFace", 0x9a9c9f, { rough: 0.55 });
const clipM = mat("HoseClip", 0x87898d, { rough: 0.6 });
const bracketM = mat("HoseBracketFace", 0x75777b, { rough: 0.6 });   // the moulded hose guide, a darker grey than the back (frame 15)
const inletM = mat("InletHoseFace", 0x6c7177, { rough: 0.45 });
const nutM = mat("InletNutFace", 0x9d9b94, { metal: 0.3, rough: 0.45 });
const cordM = mat("CordFace", 0x4a4c50, { rough: 0.6 });
const plugM = mat("PlugFace", 0x67686a, { rough: 0.5 });
const pinM = mat("PlugPinFace", 0xa4a8ad, { metal: 0.9, rough: 0.3 });

const root = group("BoschWGA254");
const cab = group("Cabinet");
root.add(cab);

// ── cabinet: the sides carry Bosch's Anti Vibration ring relief, the back is the open steel panel ──
// The sides stop 1.5 mm under the top plate and the top sits 1.5 mm inside the sides' faces, so no two faces share a plane
// (a shared plane flickers; defight would push it out 0.8 mm).
const t = 0.012, bodyH = H - 0.0015 - feet, midY = feet + bodyH / 2;
cab.add(mesh("SideLeft", flipV(new THREE.BoxGeometry(t, bodyH, D - 0.004)), [dark, sideL, bodyDark, bodyDark, bodyDark, bodyDark], -W / 2 + t / 2, midY, -0.002));
cab.add(mesh("SideRight", flipV(new THREE.BoxGeometry(t, bodyH, D - 0.004)), [sideR, dark, bodyDark, bodyDark, bodyDark, bodyDark], W / 2 - t / 2, midY, -0.002));
cab.add(faced("Top", W - 0.003, 0.014, D - 0.003, [topM, topM, topM, dark, topM, topM], 0, H - 0.007, -0.0015));
cab.add(box("Base", W - 2 * t, t, D - 0.01, dark, 0, feet + t / 2, -0.005));
const backH = H - 0.014 - feet;                                // the rear texture runs from the feet to the top plate (15-834 mm)
cab.add(mesh("BackPanel", flipV(new THREE.BoxGeometry(W - 2 * t, backH, 0.004)), [dark, dark, dark, dark, dark, rearM], 0, feet + backH / 2, zB + 0.002));
{ // four feet, 26 mm across, under the corners (x from the rear frame; ESTIMATED)
  const g = new THREE.CylinderGeometry(0.013, 0.013, feet, 20);
  for (const [fx, fz] of [[-1, 1], [1, 1], [-1, -1], [1, -1]]) cab.add(mesh("Foot", g, footM, fx * 0.272, feet / 2, fz * (D / 2 - 0.05)));
}

// ── the back, as delivered (Bosch's rear 360 frame): the ribbed drain hose from its bracket at the top left, down the side,
// round the bottom and up into the holder at the right; the smooth inlet hose from the valve at the top right down the right,
// along a loop at the bottom and up the left to its tap nut; the power cord between the holders and its Indian 3-pin plug in
// the lower left holder. The hose holders sit on the four transit bolts (manual 9001980248, parts 7 and 8). Centre lines and
// sizes are traced off the photo by tex_bosch_wga254.py; how far each stands off the back, and which passes over which, is
// read off the photo where they cross (ESTIMATED). Bosch gives the lengths: inlet 120 cm, outlet 150 cm (manual 9001946103),
// cord 160 cm (product page).
{
  const rd = rp.drain_d / 2, ri = rp.inlet_d / 2, rc = rp.cord_d / 2;
  const px = (x, y) => [-(x - 964) / 1401, (1283 - y) / 1401];     // a rear-frame pixel to metres (front-view x)
  const bump = (at, s, h) => { const [bx, by] = px(...at); return (x, y) => h * Math.exp(-((x - bx) ** 2 + (y - by) ** 2) / s ** 2); };
  const v3 = (pts, z) => pts.map(([x, y], i) => new THREE.Vector3(x, y, typeof z === "function" ? z(x, y, i) : z));
  const tube = (name, pts, r, m, radial, perM = 90) => {
    const c = new THREE.CatmullRomCurve3(pts, false, "centripetal");
    const g = new THREE.TubeGeometry(c, Math.max(8, Math.round(c.getLength() * perM)), r, radial, false);
    cab.add(mesh(name, g, m));
    return { c, g };
  };
  const cap = (name, c, t, r, m) => {                          // closes a tube's end, so the hose isn't seen through
    const p = c.getPointAt(t), d = c.getTangentAt(t);
    const e = mesh(name, new THREE.CylinderGeometry(r, r, 0.003, 12), m, p.x, p.y, p.z);
    e.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), d);
    cab.add(e);
  };
  // the drain hose stands 8 mm off the back; low on the left it lifts over the inlet hose, which passes behind it there
  const overInletL = bump([650, 628], 0.03, 2 * ri + 0.003);
  const zDrain = (x, y) => zB - 0.008 - rd - overInletL(x, y);
  const dr = tube("DrainHose", v3(rp.drain, zDrain), rd, drainM, 12, 110);
  const uv = dr.g.attributes.uv, ribs = dr.c.getLength() / rp.rib;   // a rib every 2.8 mm (the photo's spacing)
  for (let i = 0; i < uv.count; i++) uv.setX(i, uv.getX(i) * ribs);
  cap("HoseEnd", dr.c, 0, rd, cuffM);
  { // the smooth end piece standing up out of the upper right holder, closed at its top
    const [[ax, ay], [, by]] = rp.cuff, z = zDrain(ax, ay);
    cab.add(mesh("HoseCuff", new THREE.CylinderGeometry(rp.cuff_d / 2, rp.cuff_d / 2, by - ay, 20), cuffM, ax, (ay + by) / 2, z));
  }
  { // the moulded bracket the hose hangs from at the top left, 12 mm deep behind the hose
    const sh = new THREE.Shape(rp.bracket.map(([x, y]) => new THREE.Vector2(x, y)));
    const g = new THREE.ExtrudeGeometry(sh, { depth: 0.012, bevelEnabled: false });
    const b = mesh("HoseBracket", g, bracketM, 0, 0, zB - 0.012);
    cab.add(b);
  }
  // the hose holders on the transit bolts, clipped round the hose
  const [hw, hh] = rp.holder_size;
  for (const [x, y] of rp.holders) cab.add(mesh("HoseHolder", new RoundedBoxGeometry(hw * 0.8, hh * 0.8, 0.022, 2, 0.003), clipM, x, y, zB - 0.011));
  // the inlet hose, 2.5 mm off the back; over the drain hose at the right and at the top left, behind it low on the left
  const overR = bump([1300, 705], 0.035, 2 * rd + 0.008), overTL = bump([648, 400], 0.03, 2 * rd + 0.008);
  const nEnd = rp.inlet.length - 1;
  const zIn = (x, y, i) => zB - 0.0025 - ri - Math.max(overR(x, y), overTL(x, y)) - (i === 0 ? 0.006 : 0) - (i === nEnd ? 0.004 : 0);
  const inl = tube("InletHose", v3(rp.inlet, zIn), ri, inletM, 10);
  { // the valve's connector on the back, and the tap nut at the hose's free end, its face turned out and down to the right
    const p0 = inl.c.getPointAt(0);
    cab.add(mesh("InletFitting", new THREE.CylinderGeometry(0.0075, 0.0085, zB - p0.z, 14), nutM, p0.x, p0.y, (p0.z + zB) / 2).rotateX(Math.PI / 2));
    const [nx, ny, nd] = rp.nut, e = inl.c.getPointAt(1);
    const nut = mesh("InletNut", new THREE.CylinderGeometry(nd / 2, nd / 2, 0.018, 6), nutM, nx, ny, e.z - 0.004);
    nut.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), new THREE.Vector3(-0.3, -0.25, -1).normalize());
    cab.add(nut);
  }
  // the power cord, 2.5 mm off the back (behind the hoses where it meets them); the run that crosses the inlet hose at the
  // bottom passes over it; the last run drops in front of the inlet hose to the plug
  const overInletB = bump([1060, 813], 0.03, 2 * ri + 0.001);
  tube("CordLow", v3(rp.cords.CordLow, zB - 0.0025 - rc), rc, cordM, 6);
  tube("CordBack", v3(rp.cords.CordBack, (x, y) => zB - 0.0025 - rc - overInletB(x, y)), rc, cordM, 6);
  const zPlug = zB - 0.0165;
  tube("CordDrop", v3(rp.cords.CordDrop, (x, y, i) => (i === 0 ? zB - 0.0025 - rc : zPlug)), rc, cordM, 6);
  { // the Indian 3-pin plug hanging pins-down: strain relief, body, three pins (the photo's sizes; the pins' layout ESTIMATED)
    const [sx, sy, sl, sd] = rp.plug.relief, [[bx0, by0], [bx1, by1]] = rp.plug.body;
    cab.add(mesh("CordRelief", new THREE.CylinderGeometry(sd / 2 * 0.8, sd / 2, sl, 14), plugM, sx, sy - sl / 2, zPlug));
    cab.add(mesh("Plug", new RoundedBoxGeometry(Math.abs(bx1 - bx0), by0 - by1, 0.025, 2, 0.004), plugM, (bx0 + bx1) / 2, (by0 + by1) / 2, zPlug));
    rp.plug.pins.forEach(([x, y, len], i) => cab.add(mesh("PlugPin", new THREE.CylinderGeometry(rp.plug.pin_d / 2, rp.plug.pin_d / 2, len, 10), pinM, x, y - len / 2, zPlug + (i === 1 ? -0.006 : 0.006))));
  }
  const [gx, gy] = rp.grommet;                                 // where the cord leaves the cabinet
  cab.add(box("Grommet", 0.013, 0.015, 0.004, dark, gx, gy, zB - 0.002));
}

// ── the front below the control strip: the plain face with a hole for the door seat and one for the pump-filter flap ──
const mainFront = frontWithHoles("FrontMain", W, stripY - feet, [{ x: cx, y: cy - feet, r: seatR }, { x: flap.x, y: flap.y - feet, r: flap.r - 0.004 }], front, 0.004);
mainFront.position.set(0, feet, zF - 0.004);
cab.add(mainFront);
// the groove and the dish, the dish mapped like the front so its colour and grain run on without a seam
cab.add(lathe("SeatGroove", [[seatR - 0.0004, 0.0002], [seatR - 0.0004, -0.004], [0.2382, -0.004], [0.2372, -0.0022]], dark).translateX(cx).translateY(cy).translateZ(zF));
{
  const m = lathe("DoorSeat", DISH, front);
  const pos = m.geometry.attributes.position, uv = m.geometry.attributes.uv;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, (pos.getX(i) + cx + W / 2) / W, 1 - (pos.getY(i) + cy - feet) / (stripY - feet));
  m.position.set(cx, cy, zF);
  cab.add(m);
}
// the door lock's slot in the dish at the right (frame 33: its centre 203 mm right of the cabinet's centre line and 475 mm up;
// 16 x 18 mm), tilted with the dish
{
  const r = Math.hypot(L.lock_slot.x - cx, L.lock_slot.y - cy);
  const s = faced("LockSlot", 0.016, 0.018, 0.002, [dark, dark, dark, dark, slotM, dark], L.lock_slot.x, L.lock_slot.y, zF + dishZ(r) + 0.0004);
  s.rotation.y = -Math.atan2(dishZ(r + 0.01) - dishZ(r - 0.01), 0.02);   // its face square to the dish
  cab.add(s);
}

// ── the control strip: Bosch's print set again sharp (panel.jpg), a raised face with an opening for the drawer ──
// 1.5 mm inside the side faces and under the top edge, so it shares no plane with them
const dr = L.drawer, dW = dr.x1 - dr.x0, dH = dr.y1 - dr.y0, dX = (dr.x0 + dr.x1) / 2, dY = (dr.y0 + dr.y1) / 2;
{
  const w = W - 0.003, h = stripH - 0.0015, g0 = 0.0008;     // the gap round the drawer
  const s = new THREE.Shape();
  s.moveTo(-w / 2, stripY); s.lineTo(w / 2, stripY); s.lineTo(w / 2, stripY + h); s.lineTo(-w / 2, stripY + h); s.lineTo(-w / 2, stripY);
  const hole = new THREE.Path();
  hole.moveTo(dr.x0 - g0, dr.y0 - g0); hole.lineTo(dr.x0 - g0, dr.y1 + g0); hole.lineTo(dr.x1 + g0, dr.y1 + g0); hole.lineTo(dr.x1 + g0, dr.y0 - g0); hole.lineTo(dr.x0 - g0, dr.y0 - g0);
  s.holes.push(hole);
  const g = new THREE.ExtrudeGeometry(s, { depth: 0.01, bevelEnabled: false });
  const pos = g.attributes.position, uv = g.attributes.uv;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, (pos.getX(i) + W / 2) / W, 1 - (pos.getY(i) - stripY) / stripH);
  cab.add(mesh("ControlStrip", g, [panelM, bodyDark], 0, 0, zF - 0.009));
  // the dark bay the drawer slides out of
  cab.add(mesh("DrawerBay", inward(new THREE.BoxGeometry(dW + 2 * g0, dH + 2 * g0, 0.25)), dark, dX, dY, zF - 0.009 - 0.125));
}
{ // the display: black glass standing 1.5 mm proud, its face the strip's own print at that place
  const d = L.display, g = new THREE.BoxGeometry(d.x1 - d.x0, d.y1 - d.y0, 0.002), uv = g.attributes.uv;
  for (let i = 16; i < 20; i++) {
    const u = uv.getX(i), v = uv.getY(i);
    uv.setXY(i, (d.x0 + u * (d.x1 - d.x0) + W / 2) / W, 1 - (d.y0 + v * (d.y1 - d.y0) - stripY) / stripH);
  }
  cab.add(mesh("DisplayGlass", g, [dark, dark, dark, dark, panelM, dark], (d.x0 + d.x1) / 2, (d.y0 + d.y1) / 2, zF + 0.0015));
}
// the dial: a chrome ring with a notch at one o'clock round a black glossy cap (70 mm across, the cap 47.6 mm: measured on the
// studio photo; 15 mm tall, ESTIMATED from the 3/4 photos)
{
  const k = group("Dial", L.dial.x, L.dial.y, zF + 0.001);
  k.add(lathe("KnobBase", [[0.0368, 0], [0.0368, 0.0015], [0.0352, 0.0025], [0.0, 0.0025]], knobBase, 64));
  k.add(lathe("KnobRing", [[0.0352, 0.0018], [0.0353, 0.0118], [0.0338, 0.0142], [0.0246, 0.0146], [0.0240, 0.0128]], knobRing, 64));
  k.add(lathe("KnobCap", [[0.0240, 0.0128], [0.0238, 0.0142], [0.0222, 0.0151], [0.0, 0.0153]], knobCap, 64));
  const a = Math.PI / 3;                                       // one o'clock
  const mark = box("KnobMark", 0.0016, 0.0095, 0.001, knobBase, Math.cos(a) * 0.0295, Math.sin(a) * 0.0295, 0.0141);
  mark.rotation.z = a - Math.PI / 2;
  k.add(mark);
  cab.add(k);
}

// ── the detergent drawer: Bosch's own face (its grip below the bar), the chrome bar with Bosch's mark set again crisp, and the
// tray behind with the manual's three compartments, left to right: II main wash, the fabric softener with its siphon, I prewash ──
const drawer = group("Drawer", dX, dY, zF - 0.004);
drawer.add(mesh("DrawerFace", flipV(new RoundedBoxGeometry(dW, dH, 0.012, 2, 0.0015)), [bodyDark, bodyDark, bodyDark, bodyDark, drawerM, bodyDark], 0, 0, 0));
{
  const b = L.bar;
  drawer.add(mesh("DrawerBar", flipV(new RoundedBoxGeometry(b.x1 - b.x0 - 0.001, b.y1 - b.y0, 0.004, 2, 0.0012)), [barM, barM, barM, barM, barM, barM].map((m, i) => (i === 4 ? m : chrome)), (b.x0 + b.x1) / 2 - dX, (b.y0 + b.y1) / 2 - dY, 0.0075));
  // the tray (manual 9001980248: compartment II main wash, the softener with its insert, I prewash; sizes ESTIMATED)
  const tw = dW - 0.014, th = dH - 0.02, tl = 0.2, z1 = -0.006 - tl, zc = -0.006 - tl / 2, wt = 0.0025, y0 = -0.004;
  const tg = new THREE.BoxGeometry(tw, wt, tl), tuv = tg.attributes.uv;
  for (let i = 8; i < 12; i++) tuv.setXY(i, tuv.getX(i), 1 - tuv.getY(i));   // the top face: the tray print, front at the bottom
  drawer.add(mesh("TrayFloor", tg, [trayWall, trayWall, trayM, trayWall, trayWall, trayWall], 0, y0 - th / 2 + wt / 2, zc));
  drawer.add(box("TrayWallL", wt, th, tl, trayWall, -tw / 2 + wt / 2, y0, zc));
  drawer.add(box("TrayWallR", wt, th, tl, trayWall, tw / 2 - wt / 2, y0, zc));
  drawer.add(box("TrayWallBack", tw, th, wt, trayWall, 0, y0, z1 + wt / 2));
  const xa = -tw / 2 + tw * (236 / 512), xb = -tw / 2 + tw * (330 / 512);   // the dividers where tray.jpg draws them
  drawer.add(box("TrayDividerA", wt, th * 0.85, tl * 0.96, trayWall, xa, y0 - th * 0.075, zc));
  drawer.add(box("TrayDividerB", wt, th * 0.85, tl * 0.96, trayWall, xb, y0 - th * 0.075, zc));
  drawer.add(box("TraySiphon", xb - xa - 0.01, 0.012, 0.03, siphon, (xa + xb) / 2, y0 - th / 2 + 0.012, z1 + 0.04));
}
cab.add(drawer);

// ── the gasket and the stainless Vario Drum behind the door seat ──
// the gasket: its lip over the dish's inner edge, then the tube back to the drum (PGA3, PGA8)
const gasketRing = lathe("GasketRing", [[gasketR + 0.003, -0.019], [gasketR, -0.0125], [0.156, -0.0105], [0.149, -0.013], [0.144, -0.025], [0.139, -0.055], [0.136, -0.08]], gasket);
gasketRing.position.set(cx, cy, zF);
cab.add(gasketRing);
const drumR = 0.24, drumDepth = 0.30, drumZ = zF - 0.095 - drumDepth / 2;
{
  const g = inward(new THREE.CylinderGeometry(drumR, drumR, drumDepth, 72, 1, true));
  g.rotateX(Math.PI / 2);
  const uv = g.attributes.uv;
  const uRep = (2 * Math.PI * drumR) / 0.38, vRep = drumDepth / 0.19;   // drum.jpg is a 380 x 190 mm tile
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * uRep, 1 - uv.getY(i) * vRep);
  cab.add(mesh("DrumShell", g, drum, cx, cy, drumZ));
}
cab.add(mesh("DrumBack", new THREE.CircleGeometry(drumR, 64), backGrey, cx, cy, drumZ - drumDepth / 2 + 0.002));
// the back's three pressed loops round the hub, a trefoil (Bosch's drum photo, PGA8), turned as frame 33 shows it: one loop
// straight up. Their size ESTIMATED from PGA8 and frame 33.
const PETAL = [[0.04, 0.012], [0.1, 0.03], [0.165, 0.046], [0.2, 0.03], [0.208, 0], [0.2, -0.03], [0.165, -0.046], [0.1, -0.03], [0.04, -0.012], [0.034, 0]];
for (let i = 0; i < 3; i++) {
  const a = Math.PI / 2 + (i / 3) * Math.PI * 2;
  const pts = PETAL.map(([u, v]) => new THREE.Vector3(u, v, 0));    // a pressed ridge round each petal (PGA8, the studio photo)
  const g = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts, true, "centripetal"), 48, 0.009, 8, true);
  g.rotateZ(a);
  cab.add(mesh(`DrumArm${i}`, g, steel, cx, cy, drumZ - drumDepth / 2 + 0.006));
}
cab.add(mesh("DrumHub", new THREE.CylinderGeometry(0.031, 0.034, 0.014, 40), steel, cx, cy, drumZ - drumDepth / 2 + 0.008).rotateX(Math.PI / 2));
cab.add(lathe("DrumLip", [[drumR, 0], [0.128, 0.012]], steel).translateX(cx).translateY(cy).translateZ(drumZ + drumDepth / 2));
for (let i = 0; i < 3; i++) { // three wide paddles, 120 degrees apart, in light grey plastic with raised drops (PGA8)
  const a = Math.PI / 2 + (i / 3) * Math.PI * 2;
  const rib = box(`DrumRib${i}`, 0.085, 0.026, drumDepth - 0.03, ribM, cx + Math.cos(a) * (drumR - 0.012), cy + Math.sin(a) * (drumR - 0.012), drumZ);
  rib.rotation.z = a + Math.PI / 2;
  cab.add(rib);
}

// ── the pump-filter recess behind the round flap (manual part 1): the light grey housing, the filter cap and the
// emergency-drain hose, as Bosch's filter photo (PGA11) shows them ──
{
  const g = group("PumpBay", flap.x, flap.y, zF);
  g.add(lathe("PumpHousing", [[flap.r - 0.004, 0.0], [flap.r - 0.004, -0.035], [0.0, -0.035]], bay, 48));
  g.add(mesh("FilterCap", new THREE.CylinderGeometry(0.028, 0.028, 0.022, 36), [filterM, filterFace, filterM], 0.014, -0.036, -0.02).rotateX(Math.PI / 2));
  g.add(mesh("FilterGrip", new THREE.BoxGeometry(0.006, 0.046, 0.006), filterFace, 0.014, -0.036, -0.006));
  const hose = new THREE.CatmullRomCurve3([new THREE.Vector3(-0.058, -0.016, -0.026), new THREE.Vector3(-0.054, -0.006, -0.014), new THREE.Vector3(-0.044, 0.001, -0.012), new THREE.Vector3(0.026, 0.054, -0.012)]);
  g.add(mesh("PumpHose", new THREE.TubeGeometry(hose, 20, 0.005, 8, false), pumpHoseM));
  cab.add(g);
}
// the flap: a round lid hinged along its lower edge, with its light grey tab at the top (PGA12)
const filter = group("FilterFlap", flap.x, flap.y - flap.r, zF + 0.0005);
filter.add(mesh("FlapDisc", new THREE.CylinderGeometry(flap.r - 0.0005, flap.r - 0.0005, 0.006, 48), [bodyDark, flapM, flapM], 0, flap.r, 0.003).rotateX(Math.PI / 2));
filter.add(mesh("FlapRim", new THREE.TorusGeometry(flap.r - 0.0008, 0.0012, 6, 48), dark, 0, flap.r, 0.0062));
// its notch at the top, 19.6 x 10 mm, with the catch inside it (measured on the studio photo)
filter.add(faced("FlapNotch", 0.0196, 0.010, 0.002, [notchM, notchM, notchM, notchM, notchM, notchM], 0, 2 * flap.r - 0.0062, 0.0055));
filter.add(faced("FlapCatch", 0.015, 0.004, 0.002, [bodyDark, bodyDark, bodyDark, bodyDark, flapM, bodyDark], 0, 2 * flap.r - 0.0042, 0.0068));
root.add(filter);

// ── the door: hinged on the left; a chrome ring, the wide black ring and a clear glass with its bowl reaching into the drum ──
// Radii measured on the studio photo: chrome 236.6-246.1 mm, black ring to 163 mm; Bosch calls the frame "Silver-black grey".
const door = group("Door", cx - ringR, cy, hingeZ);
const dc = group("DoorCentre", ringR, 0, zF - hingeZ);        // the profiles below are measured from the body front
dc.add(lathe("DoorInnerRing", [[glassR, 0.0428], [0.152, 0.0025], [ringR - 0.003, 0.0025]], doorIn));     // 2.5 mm off the front, so no shared plane
dc.add(lathe("DoorRim", [[ringR - 0.0015, 0.0025], [ringR, 0.005], [ringR + 0.0008, 0.0175], [ringR - 0.0025, 0.0285], [chromeIn, 0.0335]], chrome));
dc.add(lathe("DoorBlack", [[chromeIn, 0.0335], [chromeIn - 0.008, 0.0375], [0.195, 0.0405], [glassR, 0.0428]], ringBlack));
dc.add(lathe("DoorGlass", [[glassR, 0.0428], [0.12, 0.0444], [0.06, 0.0455], [0.0, 0.0458]], glass));
dc.add(lathe("DoorBowl", [[0.152, 0.0025], [0.143, -0.012], [0.127, -0.035], [0.098, -0.065], [0.05, -0.083], [0.0, -0.09]], bowl));   // 6 mm or more inside the gasket
door.add(dc);
root.add(door);

const parts = productParts(PRODUCTS, ID);
const clips = stateClips(root, parts);
saveZones(PRODUCTS, ID, root, parts);
// Grain (BENCHMARK.md section 10). Bosch names the colour "Dark lake" (product page) and the door frame "Silver-black grey"
// (product sheet); it publishes no material. Its close photos show a smooth painted cabinet with a fine speckle, so the painted
// faces (front, sides, top, their edges, the drawer face and the pump-filter flap) get the gentle peel. No grain on the control
// strip, which carries the print, nor on the chrome, the glass and the polished door ring.
const grain = { dir: `${TEX}/grain`, materials: {
  Front: { type: "peel_soft" }, SideL: { type: "peel_soft" }, SideR: { type: "peel_soft" }, BodyDark: { type: "peel_soft" },
  TopPlate: { type: "peel_soft" }, FlapFace: { type: "peel_soft" }, DrawerFace: { type: "peel_soft" },
} };
await exportGLB(root, clips, OUT, {
  Front: `${T}/front.jpg`, SideL: `${T}/side_l.jpg`, SideR: `${T}/side_r.jpg`, Rear: `${T}/rear.jpg`, Panel: `${T}/panel.jpg`,
  DrawerFace: `${T}/drawer.jpg`, DrawerBar: `${T}/bar.jpg`, Tray: `${T}/tray.jpg`, Drum: `${T}/drum.jpg`, Hose: `${T}/hose.jpg`,
}, grain);
