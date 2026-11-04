// Haier HWD120-DM14F11BKU1, F11 front-load washer dryer, 12 kg wash / 7 kg dry, 1400 rpm, Black.
// Built to Haier India's published size, 595 W x 850 H x 593 D mm (haier.com/in, this model's page; Haier's own shop gives
// 600 x 620 x 850 mm, the 620 taking in the door), and Haier's gallery photos of this model (the straight-on front, the panel
// close-up, the 3/4 views from both sides, the door open from the front and from the left, and the Smart Dosing drawer):
// a black glass touch panel across the top with the drawer's section at its left, a recessed strip under it with the drawer's
// grip and the ULTRA FRESH AIR plate, a two-layer half-transparent door with a silver rim hinged on the left, a dark grey
// gasket, the 525 mm Super Drum, and the round pump-filter cover bottom right. Every position comes from tex_haier_hwd120.py
// (layout.json). Haier publishes no rear photo, manual or installation sheet for this model, so the back is left plain (no
// cord, hoses or transit bolts are modelled) and the filter cover stays shut (no photo shows it open: BENCHMARK 7).
// usage: node make_haier_hwd120.mjs <products.json> <tex dir> <out.glb>
import fs from "node:fs";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import { THREE, mat, mesh, box, faced, group, lathe, frontWithHoles, flipV, inward, stateClips, exportGLB, productParts, saveZones, tidyJSON } from "./lib.mjs";

const [PRODUCTS, TEX, OUT] = process.argv.slice(2);
const ID = "haier-hwd120-dm14f11bku1";
const T = `${TEX}/haier_hwd120`;
const L = JSON.parse(fs.readFileSync(`${T}/layout.json`, "utf8"));

// ── size (metres) ──
const W = 0.595, H = 0.85, D = 0.593;                        // Haier India: 595 x 850 x 593 mm (W x H x D)
const zF = D / 2, zB = -D / 2;
const feet = L.feet;                                          // 11 mm: ESTIMATED, the feet's height under the cabinet in the front photo
const panelBot = L.panel_bot, stripBot = L.strip_bot;         // the glass panel 771-850 mm, the recessed strip 737-771 mm (panel photo)
const cx = L.door.x, cy = L.door.y, ringR = L.door.rim;       // door centre 450 mm up; its silver rim 267.7 mm (535 mm across)
// The door seat (open-door photos, open_front.jpg at 1.19 px per mm, and the closed front): the painted front ends at 280 mm
// from the door's centre, a steep wall to 273 mm, then a shallow dish to the gasket's lip at 202.5 mm. Radii measured +-3 mm;
// the depths (6 mm, 20 mm) ESTIMATED from the shading.
const seatR = 0.280, gasketR = 0.2025;
const DISH = [[seatR, 0.0], [0.2765, -0.0035], [0.273, -0.006], [0.25, -0.009], [0.225, -0.0132], [0.205, -0.018], [gasketR, -0.02]];
const dishZ = (r) => { for (let i = 1; i < DISH.length; i++) if (r >= DISH[i][0]) { const [r0, z0] = DISH[i - 1], [r1, z1] = DISH[i]; return z1 + (z0 - z1) * (r - r1) / (r0 - r1); } return DISH[DISH.length - 1][1]; };
// The door stands 27 mm proud: Haier's shop gives 620 mm deep against haier.com's 593 mm (ESTIMATED reading of the two). It
// swings on the left about a pin 16 mm in from its rim's left edge and 14 mm in front of the body: where the open-door photo
// (open_front.jpg) puts its hinge-side edge, 24 mm inside the cabinet's left edge with the door at 126 degrees (ESTIMATED).
const doorFront = 0.027, hingeX = cx - ringR + 0.016, hingeZ = zF + 0.014;
const flap = L.flap;

// ── materials ──
const front = mat("Front", 0xffffff, { rough: 0.45 });
const sideL = mat("SideL", 0xffffff, { rough: 0.48 });
const sideR = mat("SideR", 0xffffff, { rough: 0.48 });
const bodyDark = mat("BodyDark", 0x393b41, { rough: 0.48 });    // the paint, as the front photo shows it where it is evenly lit
const topM = mat("TopPlate", 0x34363c, { rough: 0.55 });
const backM = mat("Back", 0x303237, { rough: 0.7 });             // no photo of the back: the body's paint, plain
const panelM = mat("Panel", 0xffffff, { rough: 0.12 });         // black glass; the print is panel.jpg
const stripM = mat("Strip", 0xffffff, { rough: 0.45 });
const frameM = mat("PanelFrame", 0x8c9096, { metal: 0.7, rough: 0.3 });   // "Control Panel & Dispensor Silver" (Haier's shop)
const dark = mat("Dark", 0x0b0c0e, { rough: 0.8 });
const trayM = mat("TrayWhite", 0xf1f2f4, { rough: 0.5 });
const trayIn = mat("TrayInner", 0xd9dce0, { rough: 0.6 });
const lidM = mat("TankLid", 0xf6f6f8, { rough: 0.35 });
const pinkM = mat("TankRimPink", 0xeec3d2, { rough: 0.4 });     // the detergent tank's lid rim, pink in Haier's Smart Dosing image
const blueRimM = mat("TankRimBlue", 0xa9d3f2, { rough: 0.4 });  // the softener tank's, light blue
const capM = mat("DosingCap", 0x2e7fd9, { rough: 0.35 });       // the round blue cap between them
const silver = mat("DoorSilver", 0x90949a, { metal: 0.9, rough: 0.38 });     // "Door outer Silver" (Haier's shop)
const doorIn = mat("DoorInner", 0x0c0d0f, { metal: 0.2, rough: 0.28 });   // the black ring of the door, inside the glass (open-door photos)
const tint = mat("DoorTint", 0x121417, { metal: 0.1, rough: 0.04, opacity: 0.62, side: THREE.DoubleSide });   // "Half Transparent with black" (Haier India)
const bowl = mat("GlassBowl", 0x30363c, { rough: 0.12, opacity: 0.12, side: THREE.DoubleSide });   // the clear inner layer
const hookM = mat("DoorHook", 0xb9bdc2, { metal: 0.9, rough: 0.3 });   // the latch: a short bright bar (open_front.jpg)
const gasket = mat("Gasket", 0x2b2d31, { rough: 0.85 });         // "Gasket: Dark grey" (Haier India)
const drum = mat("Drum", 0x8c9095, { metal: 0.9, rough: 0.24 });   // the drum reads dark in the photos (no light reaches it): a darker steel
const steel = mat("Steel", 0xc4c8cc, { metal: 1, rough: 0.18 });
const drumBack = mat("DrumBack", 0x4f5257, { metal: 0.9, rough: 0.24 });
const footM = mat("Foot", 0x2a2b2e, { rough: 0.6 });             // the feet are dark in the photos
const slotM = mat("LockSlotFace", 0x0d0e10, { rough: 0.7 });
const hingeM = mat("Hinge", 0x26282c, { metal: 0.4, rough: 0.45 });   // dark brackets in the open-door photos

const root = group("HaierHWD120");
const cab = group("Cabinet");
root.add(cab);

// ── cabinet: the sides carry the pressed relief of Haier's 3/4 photos; the back is plain ──
// No two faces share a plane: the sides start 0.8 mm above the front's bottom edge and stop 1.5 mm under the top plate and
// 1.5 mm behind the front; the top sits 1.5 mm inside the sides and 3 mm behind the front; the panel stops 2.5 mm under the top.
const t = 0.012, sideY0 = feet + 0.0008, sideY1 = H - 0.0015, sideZ1 = zF - 0.0015;
const sideGeo = () => flipV(new THREE.BoxGeometry(t, sideY1 - sideY0, sideZ1 - zB));
cab.add(mesh("SideLeft", sideGeo(), [dark, sideL, bodyDark, bodyDark, bodyDark, bodyDark], -W / 2 + t / 2, (sideY0 + sideY1) / 2, (zB + sideZ1) / 2));
cab.add(mesh("SideRight", sideGeo(), [sideR, dark, bodyDark, bodyDark, bodyDark, bodyDark], W / 2 - t / 2, (sideY0 + sideY1) / 2, (zB + sideZ1) / 2));
// the top plate; its front edge, above the panel, is the panel frame's top rim
cab.add(faced("Top", W - 0.003, 0.014, D - 0.0045, [topM, topM, topM, dark, frameM, topM], 0, H - 0.007, -0.00075));   // 1.5 mm inside the back too
cab.add(box("Base", W - 2 * t - 0.001, t, (zF - 0.0105) - (zB + 0.0045), dark, 0, feet + 0.0015 + t / 2, ((zF - 0.0105) + (zB + 0.0045)) / 2));   // between the front and the back panel
const backH = H - 0.014 - feet - 0.002;
cab.add(mesh("BackPanel", new THREE.BoxGeometry(W - 2 * t - 0.001, backH, 0.004), [dark, dark, dark, dark, dark, backM], 0, feet + 0.001 + backH / 2, zB + 0.002));
{ // four round feet, 36 mm across (front photo), 31 mm in from the sides and 40 mm from the front and back (ESTIMATED)
  const g = new THREE.CylinderGeometry(0.018, 0.018, feet, 20);
  for (const [fx, fz] of [[-1, 1], [1, 1], [-1, -1], [1, -1]]) cab.add(mesh("Foot", g, footM, fx * 0.264, feet / 2, fz * (D / 2 - 0.04)));
}

// ── the front below the strip: Haier's own paint (front.jpg) with the door seat cut out, 10 mm deep so its top edge is the
// strip recess's floor ──
const mainFront = frontWithHoles("FrontMain", W - 0.003, stripBot - feet, [{ x: cx, y: cy - feet, r: seatR }], front, 0.010);   // 1.5 mm inside the sides' faces
mainFront.position.set(0, feet, zF - 0.010);
cab.add(mainFront);
{ // the seat's wall and dish, mapped like the front so the paint runs on without a seam
  const m = lathe("DoorSeat", DISH, front);
  const pos = m.geometry.attributes.position, uv = m.geometry.attributes.uv;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, (pos.getX(i) + cx + W / 2) / W, 1 - (pos.getY(i) + cy - feet) / (stripBot - feet));
  m.position.set(cx, cy, zF);
  cab.add(m);
}
{ // the door lock's slot in the dish at the right, 224 mm from the door's centre, 13 x 9 mm (open-door photos; ESTIMATED +-3 mm)
  const r = 0.224;
  const s = faced("LockSlot", 0.009, 0.013, 0.002, [dark, dark, dark, dark, slotM, dark], cx + r, cy, zF + dishZ(r) + 0.0006);
  s.rotation.y = -Math.atan2(dishZ(r + 0.01) - dishZ(r - 0.01), 0.02);
  cab.add(s);
}
// the two hinge arms that come out of the dish at the left and reach the door's edge (open34.jpg): 201 mm left of the door's
// centre, 78 mm above and 124 mm below it; 18 mm tall (ESTIMATED). Hidden behind the door's black ring when it is shut.
for (const dy of [0.078, -0.124]) {
  const x0 = cx - 0.201, x1 = cx - Math.sqrt(0.262 ** 2 - dy ** 2), z0 = dishZ(Math.hypot(0.201, dy)) - 0.004;
  cab.add(box("HingeArm", x0 - x1, 0.018, 0.0008 - z0, hingeM, (x0 + x1) / 2, cy + dy, zF + (z0 + 0.0008) / 2));
}

// ── the glass touch panel: Haier's print set again sharp (panel.jpg), with a notch for the drawer's glass at the left ──
const g0 = 0.0008;                                            // the gap round the drawer
const dr = { x0: L.drawer[0] + 0.0003, x1: L.drawer[1] - 0.0003, y0: panelBot + 0.0005, y1: L.glass[3] };   // the drawer's glass face
const lip = { x0: L.lip[0], x1: L.lip[1], y0: stripBot + 0.0005, y1: panelBot - 0.0005 };          // its ribbed grip under it
{
  const xl = -W / 2 + 0.002, xr = W / 2 - 0.002, yt = H - 0.003, nx0 = dr.x0 - g0, nx1 = dr.x1 + g0, ny1 = dr.y1 + g0;
  const s = new THREE.Shape([[xl, panelBot], [nx0, panelBot], [nx0, ny1], [nx1, ny1], [nx1, panelBot], [xr, panelBot], [xr, yt], [xl, yt]].map(([x, y]) => new THREE.Vector2(x, y)));
  const g = new THREE.ExtrudeGeometry(s, { depth: 0.02, bevelEnabled: false });
  const pos = g.attributes.position, uv = g.attributes.uv;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, (pos.getX(i) + W / 2) / W, (H - pos.getY(i)) / (H - panelBot));
  cab.add(mesh("ControlPanel", g, [panelM, frameM], 0, 0, zF - 0.02));
}
// the strip under the panel, 8 mm back (ESTIMATED from the 3/4 photos): left and right of the drawer's grip, its face strip.jpg
const stripFace = (name, x0, x1, y0, y1, z, depth, m = stripM) => {
  const g = new THREE.BoxGeometry(x1 - x0, y1 - y0, depth), uv = g.attributes.uv;
  for (let i = 16; i < 20; i++) {
    const u = uv.getX(i), v = uv.getY(i);
    uv.setXY(i, (x0 + u * (x1 - x0) + W / 2) / W, (panelBot - (y0 + v * (y1 - y0))) / (panelBot - stripBot));
  }
  return mesh(name, g, [bodyDark, bodyDark, bodyDark, bodyDark, m, bodyDark], (x0 + x1) / 2, (y0 + y1) / 2, z - depth / 2);
};
cab.add(stripFace("StripLeft", -W / 2 + 0.0015, lip.x0 - g0, stripBot, panelBot, zF - 0.008, 0.004));
cab.add(stripFace("StripRight", L.drawer[1] + g0, W / 2 - 0.0015, stripBot, panelBot, zF - 0.008, 0.004));
// the ULTRA FRESH AIR plate, standing 4 mm out of the strip (its outline from the panel photo; the height ESTIMATED)
cab.add(stripFace("VentPlate", L.plate[0], L.plate[2], L.plate[1], L.plate[3], zF - 0.004, 0.006));
// the dark bay the drawer slides out of
const bay = { x0: dr.x0 - g0 + 0.0005, x1: dr.x1 + g0 - 0.0005, y0: stripBot + 0.0008, y1: dr.y1 + g0 - 0.0005 };
cab.add(mesh("DrawerBay", inward(new THREE.BoxGeometry(bay.x1 - bay.x0, bay.y1 - bay.y0, 0.29)), dark, (bay.x0 + bay.x1) / 2, (bay.y0 + bay.y1) / 2, zF - 0.0105 - 0.145));   // from behind the front's top edge

// ── the Smart Dosing drawer: its glass face with Haier's mark and badges, the ribbed grip, and the tray behind it as Haier's
// Smart Dosing image shows it: two auto-dosing tanks at the back with hinged lids (pink-rimmed detergent at the left,
// blue-rimmed softener at the right), the round blue cap between them, two open compartments in front. Sizes ESTIMATED. ──
const dX = (dr.x0 + dr.x1) / 2, dY = 0.791;
const drawer = group("Drawer", dX, dY, zF);
{
  const g = new THREE.BoxGeometry(dr.x1 - dr.x0, dr.y1 - dr.y0, 0.02), uv = g.attributes.uv;
  for (let i = 16; i < 20; i++) {
    const u = uv.getX(i), v = uv.getY(i);
    uv.setXY(i, (dr.x0 + u * (dr.x1 - dr.x0) + W / 2) / W, (H - (dr.y0 + v * (dr.y1 - dr.y0))) / (H - panelBot));
  }
  drawer.add(mesh("DrawerGlass", g, [frameM, frameM, frameM, frameM, panelM, dark], 0, (dr.y0 + dr.y1) / 2 - dY, -0.0103));
  const grip = stripFace("DrawerGrip", lip.x0, lip.x1, lip.y0, lip.y1, -0.0075, 0.012);
  grip.position.x -= dX; grip.position.y -= dY;
  drawer.add(grip);
  const tw = 0.17, th = 0.08, tl = 0.28, z1 = -0.02 - tl, zc = -0.02 - tl / 2, wt = 0.0025, y0 = -0.004;
  drawer.add(box("TrayFloor", tw, wt, tl, trayIn, 0, y0 - th / 2 + wt / 2, zc));
  drawer.add(box("TrayWallL", wt, th, tl, trayM, -tw / 2 + wt / 2, y0, zc));
  drawer.add(box("TrayWallR", wt, th, tl, trayM, tw / 2 - wt / 2, y0, zc));
  drawer.add(box("TrayWallBack", tw, th, wt, trayM, 0, y0, z1 + wt / 2));
  drawer.add(box("TrayWallFront", tw, th * 0.8, wt, trayM, 0, y0 - th * 0.1, -0.0205 - wt / 2));
  const tankL = 0.13, tz = z1 + wt + tankL / 2, tankW = (tw - 3 * wt) / 2;
  drawer.add(box("TrayDivider", wt, th * 0.75, tl - tankL - 0.004, trayM, 0, y0 - th * 0.125, (-0.02 + z1 + tankL) / 2));
  for (const [s, rim] of [[-1, pinkM], [1, blueRimM]]) {
    const x = s * (wt / 2 + tankW / 2);
    drawer.add(box(s < 0 ? "TankLeft" : "TankRight", tankW, th - 0.006, tankL, trayM, x, y0 - 0.0015, tz));
    drawer.add(box(s < 0 ? "TankRimLeft" : "TankRimRight", tankW - 0.002, 0.003, tankL - 0.002, rim, x, y0 + th / 2 - 0.0045, tz));
    drawer.add(box(s < 0 ? "TankLidLeft" : "TankLidRight", tankW - 0.012, 0.003, tankL - 0.012, lidM, x, y0 + th / 2 - 0.0015, tz));
  }
  drawer.add(mesh("DosingCap", new THREE.CylinderGeometry(0.019, 0.019, 0.006, 32), capM, 0.012, y0 + 0.006, tz + tankL / 2 + 0.003).rotateX(Math.PI / 2));
}
cab.add(drawer);

// ── the gasket and the 525 mm Super Drum ──
// the gasket: its lip over the dish's inner edge, a fold, then back to the drum (open-door photos)
const gasketRing = lathe("GasketRing", [[gasketR + 0.003, -0.0215], [gasketR, -0.0185], [0.197, -0.0175], [0.191, -0.022], [0.19, -0.03], [0.194, -0.04], [0.19, -0.05], [0.186, -0.062], [0.184, -0.075]], gasket);
gasketRing.position.set(cx, cy, zF);
cab.add(gasketRing);
// "The ingenious 525mm drum diameter" (Haier's SuperDrum-525 page image): 262.5 mm radius, VERIFIED; its depth ESTIMATED
const drumR = 0.2625, drumDepth = 0.35, drumZ = zF - 0.087 - drumDepth / 2;
{
  const g = inward(new THREE.CylinderGeometry(drumR, drumR, drumDepth, 72, 1, true));
  g.rotateX(Math.PI / 2);
  const uv = g.attributes.uv;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * 17, 1 - uv.getY(i));    // drum.jpg: a 96 mm strip, 17 round the drum
  cab.add(mesh("DrumShell", g, drum, cx, cy, drumZ));
}
cab.add(mesh("DrumBack", new THREE.CircleGeometry(drumR, 64), drumBack, cx, cy, drumZ - drumDepth / 2 + 0.002));
cab.add(lathe("DrumLip", [[drumR, 0], [0.184, 0.012]], steel).translateX(cx).translateY(cy).translateZ(drumZ + drumDepth / 2));
// three broad lifters along the wall and up the back to the hub, a Y with one arm straight up (open_front.jpg)
for (let i = 0; i < 3; i++) {
  const a = Math.PI / 2 + (i / 3) * Math.PI * 2;
  const lifter = mesh(`Lifter${i}`, new RoundedBoxGeometry(0.07, 0.04, drumDepth - 0.03, 2, 0.014), steel, cx + Math.cos(a) * (drumR - 0.016), cy + Math.sin(a) * (drumR - 0.016), drumZ + 0.01);
  lifter.rotation.z = a + Math.PI / 2;
  cab.add(lifter);
  const arm = mesh(`DrumArm${i}`, new RoundedBoxGeometry(0.06, drumR - 0.05, 0.03, 2, 0.012), steel, cx + Math.cos(a) * (drumR / 2 + 0.01), cy + Math.sin(a) * (drumR / 2 + 0.01), drumZ - drumDepth / 2 + 0.012);
  arm.rotation.z = a - Math.PI / 2;
  cab.add(arm);
}
cab.add(mesh("DrumHub", new THREE.CylinderGeometry(0.036, 0.04, 0.03, 40), drumBack, cx, cy, drumZ - drumDepth / 2 + 0.016).rotateX(Math.PI / 2));

// ── the pump-filter cover, bottom right: a round cover just proud of the front, its finger notch at the top in the front's
// print (front.jpg). Haier shows it shut only, so it does not open. ──
{
  const r = flap.r;
  const m = lathe("FlapDisc", [[r, -0.0005], [r, 0.0006], [r - 0.0012, 0.0011], [0, 0.0011]], front, 64);
  const pos = m.geometry.attributes.position, uv = m.geometry.attributes.uv;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, (pos.getX(i) + flap.x + W / 2) / W, 1 - (pos.getY(i) + flap.y - feet) / (stripBot - feet));
  m.position.set(flap.x, flap.y, zF);
  cab.add(m);
}

// ── the door: hinged on the left; a silver rim, a dark tinted outer glass over a black ring, and a clear inner bowl ──
// Radii from the front photo: rim 261.5-267.7 mm; the black ring's inner edge 190 mm (open34.jpg). Profiles from the body front.
const door = group("Door", hingeX, cy, hingeZ);
const dc = group("DoorCentre", cx - hingeX, 0, zF - hingeZ);
dc.add(lathe("DoorInner", [[0.262, 0.009], [0.19, 0.009], [0.19, 0.003], [0.262, 0.003]], doorIn));
dc.add(lathe("DoorRim", [[0.262, 0.002], [ringR, 0.0045], [ringR, 0.0135], [0.2655, 0.0185], [0.2615, 0.0195]], silver));
dc.add(lathe("DoorTint", [[0.2615, 0.0195], [0.24, 0.0215], [0.2, 0.024], [0.12, 0.0262], [0.0, doorFront]], tint));
dc.add(lathe("DoorBowl", [[0.19, 0.003], [0.182, -0.02], [0.165, -0.05], [0.13, -0.075], [0.07, -0.088], [0.0, -0.09]], bowl));
// the latch on the door's black ring at its free side, which goes into the lock slot, between two round black studs
// (open_front.jpg: a short bright bar 212-224 mm from the centre; its size ESTIMATED)
dc.add(box("DoorHook", 0.012, 0.005, 0.016, hookM, 0.22, 0, -0.005));
for (const dy of [0.02, -0.02]) dc.add(mesh("DoorStud", new THREE.CylinderGeometry(0.005, 0.005, 0.004, 16), doorIn, 0.22, dy, 0.001).rotateX(Math.PI / 2));
door.add(dc);
root.add(door);

const parts = productParts(PRODUCTS, ID);
const clips = stateClips(root, parts);
saveZones(PRODUCTS, ID, root, parts);
// The door stands in front of the published depth (STANDARD section 8)
fs.writeFileSync(new URL(`../entries/${ID}.gate.json`, import.meta.url), tidyJSON({ sticksOut: {
  "Door[A-Z]\\w*": "Haier India's page gives 59.3 cm deep (595 x 850 x 593 mm); Haier's own online shop gives 62.0 cm (600 x 620 x 850 mm), which takes in the door. The door's rim and glass stand about 27 mm in front of the cabinet.",
} }));
// Grain (BENCHMARK.md section 10). Haier names the colour "Black" and the body "Black color body"; its photos show a smooth
// painted cabinet, so the painted faces get the gentle peel. No grain on the glass panel and the strip, which carry the print,
// nor on the silver rim, the glass, the drum or the tray.
const grain = { dir: `${TEX}/grain`, materials: {
  Front: { type: "peel_soft" }, SideL: { type: "peel_soft" }, SideR: { type: "peel_soft" }, BodyDark: { type: "peel_soft" },
  TopPlate: { type: "peel_soft" },
} };
await exportGLB(root, clips, OUT, {
  Front: `${T}/front.jpg`, SideL: `${T}/side_l.jpg`, SideR: `${T}/side_r.jpg`, Panel: `${T}/panel.jpg`, Strip: `${T}/strip.jpg`, Drum: `${T}/drum.jpg`,
}, grain);
