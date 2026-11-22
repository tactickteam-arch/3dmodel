// Godrej Eon Regalis WFEON RGL 9014 5.0 IDCRM CHGD, front-load washer, 9 kg, 1400 rpm, Champagne Gold (Sangeetha listing
// 21659, item code WFEON RGL 9014 5.0). Built to Godrej's published size, 596 W x 554 D x 840 H mm (its page for this model
// and the user manual), and Godrej's own photos of this model (tex_godrej_rgl9014.py).
// A panel band across the top: the detergent drawer's face at the left (black glass with Godrej's mark, the AI Tech badge,
// "1400 RPM | 9.0 kg", "Digi Inverter") on two legs over a finger recess, and the control panel's black glass with the
// programme knob, the display and the keys, its print the manual's own art. Below it the champagne front with the door's
// seat, a two-layer door with a chrome rim hinged on the left, the grey gasket, the FabriSafe drum, the lock's boss right
// of the opening, and the round pump-filter flap bottom right. Every position comes from tex_godrej_rgl9014.py
// (layout.json). The back is Godrej's rear photo, with the cord, its plug and the inlet valve modelled over their places;
// the four transit bolts stay in the print only (the manual has them taken out before use). The flap stays shut (no photo
// shows it open: BENCHMARK 7). The drain hose the manual lists is not modelled: no photo shows how it is routed.
// usage: node make_godrej_rgl9014.mjs <products.json> <tex dir> <out.glb>
import fs from "node:fs";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import { THREE, mat, mesh, box, faced, group, lathe, frontWithHoles, inward, stateClips, exportGLB, productParts, saveZones, tidyJSON } from "./lib.mjs";

const [PRODUCTS, TEX, OUT] = process.argv.slice(2);
const ID = "godrej-wfeon-rgl-9014-5-0-idcrm-chgd";
const T = `${TEX}/godrej_rgl9014`;
const L = JSON.parse(fs.readFileSync(`${T}/layout.json`, "utf8"));

// ── size (metres) ──
const W = 0.596, H = 0.84, D = 0.554;                        // Godrej: 596 x 554 x 840 mm (W x D x H)
const zF = D / 2, zB = -D / 2;
const feet = L.feet;                                          // 18 mm (front photo)
const bandBot = L.band_bot;                                   // the panel band, 723.4-840 mm
const cx = L.door.x, cy = L.door.y, rimR = L.door.rim, chromeIn = L.door.chrome_in, seatR = L.door.dish;
const ox = L.open.x - cx, oy = L.open.y - cy, gasketR = L.open.gasket;   // the opening sits 22.8 mm above the door's centre
// The door stands proud of the cabinet: the manual's dimension drawing (page 26) gives 554 mm deep along the cabinet's side
// and draws the door's rim and glass in front of it, about 40 mm (ESTIMATED from that drawing, 30-50 mm).
const doorFront = 0.040;
// It swings on the left (open-door photos) about a pin 20 mm in from its rim's left edge and 16 mm in front of the body
// (ESTIMATED); the open-door photo shows it at about 110 degrees.
const hingeX = cx - rimR + 0.02, hingeZ = zF + 0.016;
const flap = L.flap, knob = L.knob;

// ── materials ──
// The champagne paint: textured faces carry the photos' colour; plain faces take the same paint as the textures render it.
const front = mat("Front", 0xffffff, { rough: 0.4 });
const sideL = mat("SideL", 0xffffff, { rough: 0.42 });
const sideR = mat("SideR", 0xffffff, { rough: 0.42 });
const bandM = mat("Band", 0xffffff, { rough: 0.3 });           // the band: champagne frame and black glass, the print sharp
const champ = mat("Champagne", 0x8b8885, { rough: 0.4 });      // Godrej: "Champagne Gold" (the front photo's paint, as rendered)
const topM = mat("TopPlate", 0x8a8783, { rough: 0.42 });
const backM = mat("Back", 0xffffff, { rough: 0.6 });
const dark = mat("Dark", 0x0b0c0e, { rough: 0.8 });
const trayM = mat("TrayWhite", 0xe9e9ec, { rough: 0.5 });
const trayIn = mat("TrayInner", 0xd2d4d8, { rough: 0.6 });
const blueM = mat("SoftenerInsert", 0x9aa6dc, { rough: 0.45 });    // the blue siphon insert, "PUSH" / "MAX" (drawer photo)
const knobM = mat("Knob", 0x16171a, { rough: 0.35 });
const knobFace = mat("KnobFace", 0x26272b, { metal: 0.3, rough: 0.25 });
const chrome = mat("DoorChrome", 0xc9ccd0, { metal: 1, rough: 0.16 });   // the rim's chrome (front photo)
const doorIn = mat("DoorInner", 0x232425, { rough: 0.35 });      // the dark grey ring inside the rim (front photo)
const doorBack = mat("DoorBack", 0x8e8f93, { rough: 0.55 });     // the door's grey inner frame (open-door photos)
const tint = mat("DoorTint", 0x15171a, { metal: 0.1, rough: 0.04, opacity: 0.76, side: THREE.DoubleSide });
const bowl = mat("GlassBowl", 0x3a4046, { rough: 0.1, opacity: 0.14, side: THREE.DoubleSide });
const hookM = mat("DoorHook", 0xb9bdc2, { metal: 0.9, rough: 0.3 });
const gasket = mat("Gasket", 0x55565b, { rough: 0.85 });         // grey (drum close-up)
const drum = mat("Drum", 0x9a9ea3, { metal: 0.9, rough: 0.24 });
const steel = mat("Steel", 0xc4c8cc, { metal: 1, rough: 0.18 });
const drumBack = mat("DrumBack", 0x5b5e63, { metal: 0.9, rough: 0.24 });
const footM = mat("Foot", 0x2a2b2e, { rough: 0.6 });
const slotM = mat("LockSlotFace", 0x0d0e10, { rough: 0.7 });
const hingeM = mat("Hinge", 0x7d7e82, { metal: 0.4, rough: 0.45 });
const cordM = mat("Cord", 0x111214, { rough: 0.55 });
const valveM = mat("InletValve", 0xd8d8d6, { rough: 0.5 });

const root = group("GodrejRGL9014");
const cab = group("Cabinet");
root.add(cab);

// ── cabinet. No two faces share a plane: the top plate overhangs the sides by 0.5 mm (Godrej's 3/4 photos show its lip);
// the sides stop 0.5 mm under it and 1.5 mm behind the front; the back panel sits 1.5 mm inside the sides. ──
const t = 0.012, topT = 0.012, sideY0 = feet + 0.0008, sideY1 = H - topT - 0.0005, sideZ0 = zB + 0.0015, sideZ1 = zF - 0.0015;
const sideGeo = () => {
  const g = new THREE.BoxGeometry(t, sideY1 - sideY0, sideZ1 - sideZ0), uv = g.attributes.uv;
  for (let i = 0; i < uv.count; i++) uv.setY(i, 1 - uv.getY(i));
  return g;
};
cab.add(mesh("SideLeft", sideGeo(), [dark, sideL, champ, champ, champ, champ], -W / 2 + 0.0005 + t / 2, (sideY0 + sideY1) / 2, (sideZ0 + sideZ1) / 2));
cab.add(mesh("SideRight", sideGeo(), [sideR, dark, champ, champ, champ, champ], W / 2 - 0.0005 - t / 2, (sideY0 + sideY1) / 2, (sideZ0 + sideZ1) / 2));
cab.add(mesh("Top", new RoundedBoxGeometry(W, topT, D - 0.003, 2, 0.004), topM, 0, H - topT / 2, -0.0015));
cab.add(box("Base", W - 2 * t - 0.002, t, D - 0.03, dark, 0, feet + 0.0015 + t / 2, 0));
{ // the back: Godrej's rear photo
  const bh = sideY1 - sideY0, g = new THREE.BoxGeometry(W - 2 * t - 0.002, bh, 0.004), uv = g.attributes.uv;
  // the back face (-z) shows u from the cabinet's right (seen from behind, the photo's left) to its left: the photo as taken
  for (let i = 20; i < 24; i++) uv.setY(i, 1 - uv.getY(i));
  for (let i = 20; i < 24; i++) uv.setX(i, 0.0218 + uv.getX(i) * 0.9564);   // the photo spans the full 596 mm; this panel 2 x 13 mm less
  cab.add(mesh("BackPanel", g, [dark, dark, dark, dark, dark, backM], 0, sideY0 + bh / 2, zB + 0.0035));
}
{ // four round feet, 35 mm across, under the front corners (front photo) and as far in at the back (rear photo)
  const g = new THREE.CylinderGeometry(0.0175, 0.0175, feet, 20);
  for (const [fx, fz] of [[-1, 1], [1, 1], [-1, -1], [1, -1]]) cab.add(mesh("Foot", g, footM, fx * L.feet_x[1], feet / 2, fz * (D / 2 - 0.04)));
}
// the rear's parts, from Godrej's rear photo (0.8786 px per mm; seen from behind, so the photo's left is the cabinet's right)
const rX = (px) => -(px - 462.5) / 874.2, rY = (py) => (876 - py) / 0.8786 / 1000;
// The four transit bolts stay in the back's print only: the manual has them taken out before the machine is used.
{ // the mains cord: out of its grommet at the top left, a rectangular loop clipped to the back, up to the plug at the top right
  const pts = [[232, 192], [272, 192], [272, 316], [590, 316], [590, 192], [612, 186], [632, 182]].map(([px, py]) => new THREE.Vector3(rX(px), rY(py), zB - 0.006));
  const path = new THREE.CurvePath();
  for (let i = 1; i < pts.length; i++) path.add(new THREE.LineCurve3(pts[i - 1], pts[i]));
  cab.add(mesh("Cord", new THREE.TubeGeometry(path, 60, 0.0035, 8, false), cordM));
  cab.add(mesh("Plug", new RoundedBoxGeometry(0.046, 0.05, 0.024, 2, 0.006), cordM, rX(652), rY(184), zB - 0.014));
  cab.add(mesh("InletValve", new THREE.CylinderGeometry(0.012, 0.012, 0.022, 20), valveM, rX(660), rY(222), zB - 0.011).rotateX(Math.PI / 2));
}

// ── the front below the band: the photo's paint with the door seat cut out ──
const mainFront = frontWithHoles("FrontMain", W - 0.003, bandBot - feet, [{ x: cx, y: cy - feet, r: seatR }], front, 0.010);
mainFront.position.set(0, feet, zF - 0.010);
cab.add(mainFront);
const frontUV = (m, ox0, oy0) => {   // map a part of the front like the front itself, so the paint runs on without a seam
  const pos = m.geometry.attributes.position, uv = m.geometry.attributes.uv;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, (pos.getX(i) + ox0 + W / 2) / W, 1 - (pos.getY(i) + oy0 - feet) / (bandBot - feet));
  return m;
};
// the seat: a short steep wall from the seat's edge (250.8 mm from the door's centre) to 241 mm, 8 mm deep, then a flat
// floor round the gasket, which sits 22.8 mm higher, so the floor is wide below the opening and narrow above it (open-door
// photo). The depths ESTIMATED.
const floorR = 0.241, floorZ = -0.008;
cab.add(frontUV(lathe("DoorSeat", [[seatR, 0.0], [seatR - 0.002, -0.004], [floorR + 0.002, -0.0075], [floorR, floorZ]], front), cx, cy).translateX(cx).translateY(cy).translateZ(zF));
{
  const s = new THREE.Shape(); s.absarc(0, 0, floorR, 0, Math.PI * 2, false);
  const hole = new THREE.Path(); hole.absarc(ox, oy, gasketR, 0, Math.PI * 2, true); s.holes.push(hole);
  const m = frontUV(mesh("SeatFloor", new THREE.ShapeGeometry(s, 72), front), cx, cy);
  m.position.set(cx, cy, zF + floorZ);
  cab.add(m);
}
{ // the lock's boss right of the opening: a rounded champagne pad, 42 x 80 mm, with the latch's slot (open-door photo)
  cab.add(mesh("LatchBoss", new RoundedBoxGeometry(0.042, 0.08, 0.012, 3, 0.008), champ, L.latch.x, L.latch.y, zF + floorZ));
  cab.add(box("LatchSlot", 0.017, 0.02, 0.002, slotM, L.latch.x + 0.002, L.latch.y + 0.001, zF + floorZ + 0.0055));
}
// the hinge's two arms, out of the seat's floor at the left to the door's edge; hidden behind the door when it is shut
for (const dy of [0.085, -0.115]) {
  const x0 = cx - 0.215, x1 = hingeX - 0.004;
  cab.add(box("DoorHingeArm", x0 - x1, 0.02, 0.012 - floorZ, hingeM, (x0 + x1) / 2, cy + dy, zF + (floorZ + 0.012) / 2));
}

// ── the gasket and the drum, round the opening ──
const gx = cx + ox, gy = cy + oy;
cab.add(lathe("GasketRing", [[gasketR + 0.002, floorZ - 0.001], [gasketR, floorZ + 0.0015], [gasketR - 0.006, floorZ + 0.001], [gasketR - 0.013, -0.016],
  [gasketR - 0.017, -0.03], [gasketR - 0.013, -0.045], [gasketR - 0.016, -0.06], [0.17, -0.075]], gasket).translateX(gx).translateY(gy).translateZ(zF));
// The drum: Godrej does not publish its size; 470 mm across and 300 mm deep (ESTIMATED: it fits the cabinet under the band)
const drumR = 0.235, drumDepth = 0.30, drumZ = zF - 0.075 - drumDepth / 2;
{
  const g = inward(new THREE.CylinderGeometry(drumR, drumR, drumDepth, 72, 1, true));
  g.rotateX(Math.PI / 2);
  const uv = g.attributes.uv;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * 15, 1 - uv.getY(i));    // drum.jpg: a 100 mm strip, 15 round the drum
  cab.add(mesh("DrumShell", g, drum, gx, gy, drumZ));
}
cab.add(mesh("DrumBack", new THREE.CircleGeometry(drumR, 64), drumBack, gx, gy, drumZ - drumDepth / 2 + 0.002));
cab.add(lathe("DrumLip", [[drumR, 0], [0.17, 0.012]], steel).translateX(gx).translateY(gy).translateZ(drumZ + drumDepth / 2));
// three broad lifters, a Y with one arm straight up, and ribs up the back to the hub (open-door photo, drum close-up)
for (let i = 0; i < 3; i++) {
  const a = Math.PI / 2 + (i / 3) * Math.PI * 2;
  const lifter = mesh(`Lifter${i}`, new RoundedBoxGeometry(0.075, 0.045, drumDepth - 0.03, 2, 0.016), steel, gx + Math.cos(a) * (drumR - 0.018), gy + Math.sin(a) * (drumR - 0.018), drumZ + 0.01);
  lifter.rotation.z = a + Math.PI / 2;
  cab.add(lifter);
  const arm = mesh(`DrumArm${i}`, new RoundedBoxGeometry(0.06, drumR - 0.05, 0.03, 2, 0.012), steel, gx + Math.cos(a) * (drumR / 2 + 0.01), gy + Math.sin(a) * (drumR / 2 + 0.01), drumZ - drumDepth / 2 + 0.012);
  arm.rotation.z = a - Math.PI / 2;
  cab.add(arm);
}
cab.add(mesh("DrumHub", new THREE.CylinderGeometry(0.036, 0.04, 0.03, 40), drumBack, gx, gy, drumZ - drumDepth / 2 + 0.016).rotateX(Math.PI / 2));

// ── the pump-filter flap, bottom right: a round cover just proud of the front, its finger notch at the top in the print ──
{
  const r = flap.r;
  const m = frontUV(lathe("FlapDisc", [[r, -0.0005], [r, 0.0006], [r - 0.0012, 0.0011], [0, 0.0011]], front, 64), flap.x, flap.y);
  m.position.set(flap.x, flap.y, zF);
  cab.add(m);
}

// ── the panel band: band.jpg on its face. Left of the drawer a thin strip of the frame; right of it the panel. ──
const bandFace = (name, geo, x0, y0) => {   // planar map of an extruded shape's front onto band.jpg
  const pos = geo.attributes.position, uv = geo.attributes.uv;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, (pos.getX(i) + x0 + W / 2) / W, (H - (pos.getY(i) + y0)) / (H - bandBot));
  return geo;
};
const bandTop = H - 0.003, g0 = 0.0008;
const bandBox = (name, x0, x1) => {
  const s = new THREE.Shape([[x0, bandBot], [x1, bandBot], [x1, bandTop], [x0, bandTop]].map(([x, y]) => new THREE.Vector2(x, y)));
  const g = bandFace(name, new THREE.ExtrudeGeometry(s, { depth: 0.02, bevelEnabled: false }), 0, 0);
  return mesh(name, g, [bandM, champ], 0, 0, zF - 0.02);
};
const [dx0, dx1] = L.drawer, [lx0, lx1] = L.legs;
cab.add(bandBox("BandLeft", -W / 2 + 0.0015, dx0 - g0));
cab.add(bandBox("ControlPanel", dx1 + g0, W / 2 - 0.0015));
// the programme knob: a black knurled ring with a glossy face, 55.6 mm across, standing 22 mm out (its depth ESTIMATED)
{
  const k = group("Knob", knob.x, knob.y, zF);
  k.add(mesh("KnobBody", new THREE.CylinderGeometry(knob.r - 0.0015, knob.r, 0.02, 48), knobM, 0, 0, 0.01).rotateX(Math.PI / 2));
  k.add(lathe("KnobFace", [[knob.r - 0.0015, 0.02], [knob.r - 0.0045, 0.0215], [0, 0.022]], knobFace, 48));
  cab.add(k);
}
// the dark bay the drawer slides out of
cab.add(mesh("DrawerBay", inward(new THREE.BoxGeometry(dx1 - dx0, H - topT - 0.001 - bandBot - 0.0008, 0.27)), dark, (dx0 + dx1) / 2, (bandBot + 0.0008 + H - topT - 0.001) / 2, zF - 0.02 - 0.135));

// ── the drawer: its face on two legs over the finger recess (front photo; drawer photo), and the tray behind it as Godrej's
// drawer photo shows it: a compartment at each side and the blue softener insert between them. Tray sizes ESTIMATED. ──
const dX = (dx0 + dx1) / 2, dY = (bandBot + bandTop) / 2;
const drawer = group("Drawer", dX, dY, zF);
{
  const top = bandTop, gt = L.grip_top;
  const s = new THREE.Shape([[dx0, bandBot], [lx0, bandBot], [lx0, gt], [lx1, gt], [lx1, bandBot], [dx1, bandBot], [dx1, top], [dx0, top]].map(([x, y]) => new THREE.Vector2(x - dX, y - dY)));
  const g = bandFace("DrawerFace", new THREE.ExtrudeGeometry(s, { depth: 0.02, bevelEnabled: false }), dX, dY);
  drawer.add(mesh("DrawerFace", g, [bandM, champ], 0, 0, -0.02));
  // the recess under the face's lip is dark (front photo): the lip's underside and a dark back wall 18.5 mm in
  drawer.add(box("DrawerGripBack", lx1 - lx0, gt - bandBot, 0.003, dark, (lx0 + lx1) / 2 - dX, (gt + bandBot) / 2 - dY, -0.0185));
  const tw = 0.18, th = 0.07, tl = 0.25, z1 = -0.02 - tl, zc = -0.02 - tl / 2, wt = 0.0025, y0 = 0.0;
  drawer.add(box("TrayFloor", tw, wt, tl, trayIn, 0, y0 - th / 2 + wt / 2, zc));
  drawer.add(box("TrayWallL", wt, th, tl, trayM, -tw / 2 + wt / 2, y0, zc));
  drawer.add(box("TrayWallR", wt, th, tl, trayM, tw / 2 - wt / 2, y0, zc));
  drawer.add(box("TrayWallBack", tw, th, wt, trayM, 0, y0, z1 + wt / 2));
  drawer.add(box("TrayWallFront", tw, th * 0.8, wt, trayM, 0, y0 - th * 0.1, -0.0205 - wt / 2));
  for (const x of [-0.028, 0.028]) drawer.add(box("TrayDivider", wt, th * 0.85, tl - 0.006, trayM, x, y0 - th * 0.075, zc));
  drawer.add(mesh("SoftenerInsert", new RoundedBoxGeometry(0.05, th * 0.75, tl * 0.75, 2, 0.006), blueM, 0, y0 - th * 0.1, z1 + wt + tl * 0.375 + 0.004));
}
cab.add(drawer);

// the band's print at 12 px per mm for a close look (tex_godrej_rgl9014.py band_hi: the same drawing again, cut to the print):
// flat decals 0.9 mm in front of the glass, the drawer's on the drawer (it goes with it), the panel's in two pieces; the
// band's own finish
const printTex = {};
for (const [k, d] of Object.entries(JSON.parse(fs.readFileSync(`${T}/decals.json`, "utf8")))) {
  const [u0, v0, u1, v1] = d.rect, bh = H - bandBot;
  const x0 = u0 * W - W / 2, x1 = u1 * W - W / 2, yT = H - v0 * bh, yB = H - v1 * bh;
  const g = new THREE.PlaneGeometry(x1 - x0, yT - yB);
  const p = g.attributes.position, uv = g.attributes.uv;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, p.getX(i) / (x1 - x0) + 0.5, 0.5 - p.getY(i) / (yT - yB));   // v = 0 at the top row
  const m = mesh(`PrintDecal_${k}`, g, mat(`Print_${k}`, 0xffffff, { rough: 0.3 }), (x0 + x1) / 2, (yT + yB) / 2, zF + 0.0009);
  if (d.drawer) { m.position.sub(new THREE.Vector3(dX, dY, zF)); drawer.add(m); } else cab.add(m);
  printTex[`Print_${k}`] = `${T}/${d.file}`;
}

// ── the door: chrome rim, the dark grey ring under a tinted outer glass, the grey inner frame and the clear bowl behind ──
// Radii from the front photo: the chrome 234.4-246.6 mm; the dark ring's inner edge round the opening's centre (the photo
// shows the window high in the door, over the opening), 160 mm (ESTIMATED from the open-door photos).
const door = group("Door", hingeX, cy, hingeZ);
const dc = group("DoorCentre", cx - hingeX, 0, zF - hingeZ);
{
  const s = new THREE.Shape(); s.absarc(0, 0, chromeIn + 0.001, 0, Math.PI * 2, false);
  const hole = new THREE.Path(); hole.absarc(ox, oy, 0.16, 0, Math.PI * 2, true); s.holes.push(hole);
  dc.add(mesh("DoorInner", new THREE.ExtrudeGeometry(s, { depth: 0.008, bevelEnabled: false, curveSegments: 48 }), doorIn, 0, 0, 0.005));
}
dc.add(lathe("DoorRim", [[chromeIn - 0.001, 0.003], [rimR - 0.003, 0.004], [rimR, 0.009], [rimR, 0.024], [rimR - 0.004, 0.0295], [chromeIn, 0.031]], chrome));
dc.add(lathe("DoorBackFrame", [[0.16, -0.006], [0.2, -0.003], [rimR - 0.004, 0.0035]], doorBack));
dc.add(lathe("DoorTint", [[chromeIn, 0.031], [0.2, 0.034], [0.12, 0.038], [0.0, doorFront]], tint));
dc.add(lathe("DoorBowl", [[0.162, 0.0055], [0.156, -0.02], [0.142, -0.045], [0.112, -0.065], [0.06, -0.078], [0.0, -0.08]], bowl).translateX(ox).translateY(oy));
// the latch on the door's free side, which goes into the boss's slot
dc.add(box("DoorHook", 0.012, 0.016, 0.022, hookM, L.latch.x - cx + 0.002, oy, -0.008));
door.add(dc);
root.add(door);

const parts = productParts(PRODUCTS, ID);
const clips = stateClips(root, parts);
saveZones(PRODUCTS, ID, root, parts);
// The door and the knob stand in front of the published depth (STANDARD section 8)
fs.writeFileSync(new URL(`../entries/${ID}.gate.json`, import.meta.url), tidyJSON({ sticksOut: {
  "Door[A-Z]\\w*": "Godrej gives 596 x 554 x 840 mm (its page for this model, the user manual, Sangeetha's listing 59.6 x 55.4 x 84 cm). The manual's dimension drawing (page 26) measures the 554 mm along the cabinet's side and draws the door's rim and glass in front of it, about 40 mm.",
  "Cord|Plug|InletValve": "The mains cord, its plug and the inlet valve stand on the back, behind the 554 mm cabinet Godrej gives (its rear photo).",
  "Knob\\w*": "The programme knob stands about 22 mm out of the panel's glass (Godrej's front and 3/4 photos), in front of the 554 mm cabinet Godrej gives.",
} }));
// Grain (BENCHMARK.md section 10). Godrej names the colour "Champagne Gold"; its photos show a smooth painted cabinet, so the
// painted faces get the gentle peel. None on the band (it carries the print), the chrome, the glass, the drum or the tray.
const grain = { dir: `${TEX}/grain`, materials: {
  Front: { type: "peel_soft" }, SideL: { type: "peel_soft" }, SideR: { type: "peel_soft" }, Champagne: { type: "peel_soft" },
  TopPlate: { type: "peel_soft" },
} };
await exportGLB(root, clips, OUT, {
  Front: `${T}/front.jpg`, SideL: `${T}/side_l.jpg`, SideR: `${T}/side_r.jpg`, Band: `${T}/band.jpg`, Back: `${T}/back.jpg`, Drum: `${T}/drum.jpg`,
  ...printTex,
}, grain);
