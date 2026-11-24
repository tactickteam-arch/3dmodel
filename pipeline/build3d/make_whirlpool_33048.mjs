// Whirlpool 9 kg Steam front-load washer with in-built heater (XS9014BWME), item code 33048, Midnight Grey. No Sangeetha
// listing. Built from Whirlpool India's page for the same 9 kg Steam model in Midnight Grey (its own code 33049; the
// identity and that link: see NOTES.md): Whirlpool gives 64 x 85 x 60 cm, 71.2 kg.
// The cabinet, door, drum, pump-filter cover and side panels are the Xpert Care body of make_whirlpool_33015.mjs (which says
// where each size comes from): Whirlpool's straight-on front photo of this model has the same 0.706 : 1 front (60 cm by
// 85 cm, so the 64 cm is the depth to the door's front) and its door ring (r 270) and glass (r 170) at the same places.
// Its control band is its own, measured on that photo (1.2328 px per mm, +-0.8 mm; tex_whirlpool_33048.py): the drawer
// plate and its handle slot, the dial (Sanitize above it), the display slab with its touch keys, and a separate key column
// (Power, Steam, Start / Pause), both slabs 3 mm proud (ESTIMATED). The door is hinged on the left (Whirlpool's door-open
// photo of this model), swing ESTIMATED 110 degrees. No photo shows the back or the drawer's tray: both plain (ESTIMATED).
// usage: node make_whirlpool_33048.mjs <entry.json> <tex dir> <out.glb>
import fs from "node:fs";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import { THREE, mat, mesh, box, group, lathe, frontWithHoles, inward, stateClips, exportGLB, productParts, saveZones, tidyJSON } from "./lib.mjs";
import { uvDecals } from "./decal_curved.mjs";

const K = { id: "whirlpool-33048", slug: "whirlpool_33048", body: 0x45464a, metal: 0.35, rough: 0.4, colour: "Midnight Grey" };
const [PRODUCTS, TEX, OUT] = process.argv.slice(2);
const ID = K.id;
const T = `${TEX}/${K.slug}`;
const L = JSON.parse(fs.readFileSync(`${T}/layout.json`, "utf8"));
const mm = (v) => v / 1000;

// ── size (metres): 600 W x 850 H, the cabinet 595 deep, the door's front 640 mm from the back ──
const W = 0.6, H = 0.85, DEPTH = 0.64;
const zB = -DEPTH / 2, zF = zB + 0.595;                        // the cabinet's front face at +0.275
const feet = 0.015;                                           // the feet under the cabinet (front photo, +-2 mm)
const X = (xmm) => -W / 2 + mm(xmm);                          // band frame: mm from the cabinet's left edge
const Yt = (t) => mm(852 - t);                                // band frame: mm down from 852 mm
const bandTop = Yt(L.band[1]), bandBot = Yt(L.band[3]);       // 850 and 712 mm: the band; the seam over the lower front
const cx = 0, cy = 0.434;                                     // the door's centre (front photo)
const ringR = 0.270, glassR = 0.168;                          // the door's black ring and its glass (front photo, +-2 mm)
const seatR = 0.262, gasketR = 0.165;                         // the seat round the gasket; the 330 mm opening (Whirlpool, VERIFIED)
const flap = { x: 0.179, y: 0.0866, r: 0.0675 };              // the pump-filter cover (front photo)

// ── materials ──
const paint = { metal: K.metal, rough: K.rough };
const front = mat("Front", K.body, paint);
const sideM = mat("Side", 0xffffff, paint);                   // side.jpg: the paint with the pressed panel's light and shade
const topM = mat("TopLid", K.body, paint);
const backM = mat("Back", K.body, { rough: 0.6 });            // no photo of the back: the body's paint, plain
const panelM = mat("Panel", 0xffffff, paint);                 // the band: the same paint, the print in panel.jpg
const drawerM = mat("DrawerFace", 0xffffff, paint);
const slabM = mat("DisplaySlab", 0xffffff, { rough: 0.08 }); // black glass (display.jpg)
const keysM = mat("KeySlab", 0xffffff, { rough: 0.08 });     // the key column: black glass (keys.jpg)
const dark = mat("Dark", 0x101113, { rough: 0.8 });
const pocketM = mat("HandlePocket", 0x3a3c40, { rough: 0.55 });
const knobTop = mat("KnobTop", 0xffffff, { metal: 0.9, rough: 0.28 });   // spun metal (the close-up)
const chrome = mat("Chrome", 0xc8ccd0, { metal: 1, rough: 0.14 });
const knobBase = mat("KnobBase", 0x2a2c30, { rough: 0.45 });
const trayM = mat("TrayGrey", 0xd8dadd, { rough: 0.5 });      // UNVERIFIED colour: no photo shows the drawer open
const ring = mat("DoorRing", 0x0e0f11, { rough: 0.16 });      // the door's wide gloss-black ring (front photo)
const doorBack = mat("DoorBack", 0x9ea2a8, { metal: 0.6, rough: 0.35 });   // silver grey behind (door-open photo)
const tint = mat("DoorGlass", 0x1b1e22, { metal: 0.1, rough: 0.04, opacity: 0.38, side: THREE.DoubleSide });
const bowl = mat("GlassBowl", 0x3a4148, { rough: 0.1, opacity: 0.14, side: THREE.DoubleSide });
const gasket = mat("Gasket", 0x1c1d20, { rough: 0.85 });      // black rubber (door-open photo)
const drum = mat("Drum", 0xffffff, { metal: 0.9, rough: 0.26 });
const steel = mat("Steel", 0xc4c8cc, { metal: 1, rough: 0.2 });
const drumBack = mat("DrumBack", 0x55585d, { metal: 0.9, rough: 0.26 });
const footM = mat("Foot", 0x2a2b2e, { rough: 0.7 });
const hingeM = mat("Hinge", 0xa9adb3, { metal: 0.85, rough: 0.35 });   // the hinge bracket is silver (door-open photo)
const groove = mat("FlapGroove", 0x2a2c30, { rough: 0.7 });

const root = group("WhirlpoolSteam9kg");
const cab = group("Cabinet");
root.add(cab);

// a flat face in the band frame with holes, its UVs from a picture of the rectangle [x0, t0, x1, t1] (band mm); every face
// but the front takes `rest` (a single UV, so decals find only the front)
function plate(name, outline, holes, depth, uvRect, mats, rest = [0.002, 0.995]) {
  const shape = new THREE.Shape(outline.getPoints ? outline.getPoints(24) : outline);
  for (const h of holes) shape.holes.push(h);
  const g = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: false, curveSegments: 24 });
  const p = g.attributes.position, uv = g.attributes.uv;
  const [ux0, ut0, ux1, ut1] = uvRect;
  for (let i = 0; i < uv.count; i++) {
    if (p.getZ(i) > depth - 1e-7) uv.setXY(i, (p.getX(i) - X(ux0)) / (X(ux1) - X(ux0)), (Yt(ut0) - p.getY(i)) / (Yt(ut0) - Yt(ut1)));
    else uv.setXY(i, ...rest);
  }
  // front cap first in the groups: ExtrudeGeometry has caps (group 0) and sides (group 1)
  const m = mesh(name, g, mats);
  m.position.z = zF - depth;
  return m;
}
// a box seen from inside with no front wall (a bay, a pocket): BoxGeometry's +z face (indices 24-29) dropped
const openBox = (w, h, d) => {
  const g = inward(new THREE.BoxGeometry(w, h, d));
  const idx = [...g.index.array];
  idx.splice(24, 6);
  g.setIndex(idx);
  g.clearGroups();
  return g;
};
const rrect = (x0, y0, x1, y1, r, path = false) => {
  const s = path ? new THREE.Path() : new THREE.Shape();
  s.moveTo(x0 + r, y0); s.lineTo(x1 - r, y0); s.quadraticCurveTo(x1, y0, x1, y0 + r); s.lineTo(x1, y1 - r);
  s.quadraticCurveTo(x1, y1, x1 - r, y1); s.lineTo(x0 + r, y1); s.quadraticCurveTo(x0, y1, x0, y1 - r); s.lineTo(x0, y0 + r);
  s.quadraticCurveTo(x0, y0, x0 + r, y0);
  return s;
};

// ── the cabinet: side sheets, the top, the back, the base ──
// No two faces that look the same way lie within 1.2 mm of each other where they overlap (defight.mjs would move one): the
// sheets run from 3.5 mm in front of the back panel's face to 1.5 mm behind the front, the front plates sit inside them,
// the top lies on them, the band's top edge stands 1.5 mm under the top's.
const t = 0.003, sideY0 = feet + 0.0025, sideY1 = H - 0.0105, sideZ0 = zB + 0.0035, sideZ1 = zF - 0.0015;
const sideGeo = (right) => {
  const g = new THREE.BoxGeometry(t, sideY1 - sideY0, sideZ1 - sideZ0);
  const p = g.attributes.position, uv = g.attributes.uv;
  for (let i = 0; i < uv.count; i++) {
    const z = p.getZ(i) + (sideZ0 + sideZ1) / 2, y = p.getY(i) + (sideY0 + sideY1) / 2;
    uv.setXY(i, Math.min(1, (z - zB) / (zF - zB)), (0.838 - y) / (0.838 - feet));
  }
  return g;
};
cab.add(mesh("SideLeft", sideGeo(false), [front, sideM, front, front, front, front], -W / 2 + t / 2, (sideY0 + sideY1) / 2, (sideZ0 + sideZ1) / 2));
cab.add(mesh("SideRight", sideGeo(true), [sideM, front, front, front, front, front], W / 2 - t / 2, (sideY0 + sideY1) / 2, (sideZ0 + sideZ1) / 2));
// the top: the body's paint, lying on the side sheets
cab.add(mesh("Top", new THREE.BoxGeometry(W, H - sideY1, sideZ1 - zB - 0.0015), topM, 0, (H + sideY1) / 2, (zB + 0.0015 + sideZ1) / 2));
cab.add(box("Base", W - 0.014, 0.008, (zF - 0.010) - (zB + 0.005), dark, 0, 0.019 + 0.004, ((zF - 0.010) + (zB + 0.005)) / 2));
const backY0 = 0.0155, backH = sideY1 + 0.003 - backY0;
cab.add(mesh("BackPanel", new THREE.BoxGeometry(W - 0.0024, backH, 0.006), [dark, dark, dark, dark, dark, backM], 0, backY0 + backH / 2, zB + 0.003));
{ // four feet: a dark round foot 34 mm across under each corner (front photo), 40 mm in from the front and back (ESTIMATED)
  const foot = new THREE.CylinderGeometry(0.017, 0.019, feet + 0.004, 24);
  for (const fx of [-0.255, 0.255]) for (const fz of [zF - 0.04, zB + 0.04]) cab.add(mesh("Foot", foot, footM, fx, (feet + 0.004) / 2, fz));
}

// ── the lower front: the paint with the door seat cut out, a shallow dish to the gasket; the pump-filter cover ──
const lower = frontWithHoles("FrontMain", W - 0.003, bandBot - feet, [{ x: cx, y: cy - feet, r: seatR }], front, 0.010);
lower.position.set(0, feet, zF - 0.010);
cab.add(lower);
const DISH = [[seatR, 0.0], [0.255, -0.004], [0.235, -0.010], [0.2, -0.016], [0.175, -0.019], [gasketR + 0.002, -0.0205]];
cab.add(lathe("DoorSeat", DISH, front).translateX(cx).translateY(cy).translateZ(zF));
cab.add(lathe("FlapGroove", [[flap.r + 0.0012, 0.0002], [flap.r - 0.0002, 0.0002]], groove, 72).translateX(flap.x).translateY(flap.y).translateZ(zF));
cab.add(lathe("FlapCover", [[flap.r - 0.0002, 0.0002], [flap.r - 0.002, 0.0012], [flap.r - 0.01, 0.0016], [0, 0.0018]], front, 72).translateX(flap.x).translateY(flap.y).translateZ(zF));
// the door's hinge bracket in the dish at the left (door-open photo: a silver plate with two arms; sizes ESTIMATED), and
// the lock slot at the right
const hingeX = cx - ringR + 0.014, hingeZ = zF + 0.016;
for (const dy of [0.065, -0.065]) cab.add(box("HingePlate", 0.03, 0.026, 0.006, hingeM, cx - 0.236, cy + dy, zF - 0.0085 + 0.003));
cab.add(box("LockSlot", 0.008, 0.016, 0.004, dark, cx + 0.236, cy, zF - 0.0085 + 0.002));

// ── the gasket and the drum ──
cab.add(lathe("Gasket", [[gasketR + 0.004, -0.0215], [gasketR, -0.019], [gasketR - 0.007, -0.022], [gasketR - 0.009, -0.035], [gasketR - 0.004, -0.05], [gasketR - 0.01, -0.07], [gasketR + 0.012, -0.084], [0.226, -0.0875]], gasket).translateX(cx).translateY(cy).translateZ(zF));
const drumR = 0.232, drumDepth = 0.33, drumZ = zF - 0.088 - drumDepth / 2;   // ESTIMATED (behind the gasket, not measured)
{
  const g = inward(new THREE.CylinderGeometry(drumR, drumR, drumDepth, 72, 1, true));
  g.rotateX(Math.PI / 2);
  const uv = g.attributes.uv;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * 20, 1 - uv.getY(i));
  cab.add(mesh("DrumShell", g, drum, cx, cy, drumZ));
}
cab.add(mesh("DrumBack", new THREE.CircleGeometry(drumR + 0.002, 64), drumBack, cx, cy, drumZ - drumDepth / 2 + 0.002));
cab.add(lathe("DrumLip", [[drumR, -0.002], [drumR, 0.0], [0.22, 0.0]], steel).translateX(cx).translateY(cy).translateZ(drumZ + drumDepth / 2));
for (let i = 0; i < 3; i++) {                                 // three lifters (door-open photo)
  const a = Math.PI / 2 + (i / 3) * Math.PI * 2;
  const lf = mesh(`Lifter${i}`, new RoundedBoxGeometry(0.06, 0.035, drumDepth - 0.03, 2, 0.012), steel, cx + Math.cos(a) * (drumR - 0.014), cy + Math.sin(a) * (drumR - 0.014), drumZ + 0.01);
  lf.rotation.z = a + Math.PI / 2;
  cab.add(lf);
}

// ── the control band: one painted face with the drawer's groove cut out; the black display slab; the dial ──
const [gx0, gt0, gx1, gt1] = L.groove;
const bandFace = plate("ControlPanel", rrect(-W / 2 + 0.0015, bandBot, W / 2 - 0.0015, bandTop - 0.0015, 0.0001),
  [rrect(X(gx0), Yt(gt1), X(gx1), Yt(gt0), 0.0025, true)], 0.003, L.band, [panelM, panelM]);
cab.add(bandFace);
// the bay the drawer slides out of: dark, open at the front only
// (2 mm wider than the groove all round and starting just behind the band's face, so no seam opens between them)
const bay = { x0: X(gx0) - 0.002, x1: X(gx1) + 0.002, y0: Yt(gt1) - 0.002, y1: Yt(gt0) + 0.002 };
cab.add(mesh("DrawerBay", openBox(bay.x1 - bay.x0, bay.y1 - bay.y0, 0.3), dark, (bay.x0 + bay.x1) / 2, (bay.y0 + bay.y1) / 2, zF - 0.0031 - 0.15));
{ // the display slab, 3 mm proud of the band (ESTIMATED; clear of the print's decals laid 0.9 mm over the band), black glass with its print (display.jpg)
  const [sx0, st0, sx1, st1] = L.slab;
  const s = plate("DisplaySlab", rrect(X(sx0), Yt(st1), X(sx1), Yt(st0), mm(L.slab_r)), [], 0.003, L.slab, [slabM, slabM], [0.5, 0.015]);
  s.position.z = zF;
  cab.add(s);
}
{ // the key column (Power, Steam, Start / Pause): a second black slab, 3 mm proud (ESTIMATED), its print in keys.jpg
  const [kx0, kt0, kx1, kt1] = L.keys;
  const s = plate("KeySlab", rrect(X(kx0), Yt(kt1), X(kx1), Yt(kt0), mm(L.keys_r)), [], 0.003, L.keys, [keysM, keysM], [0.5, 0.015]);
  s.position.z = zF;
  cab.add(s);
}
{ // the dial: a spun-metal top on a chrome side, 62 mm across and 22 mm proud (ESTIMATED from the close-up), on a dark base
  const [kxm, ktm, krm] = L.knob, kr = mm(krm), kh = 0.022;
  const knob = group("Knob", X(kxm), Yt(ktm), zF);
  knob.add(lathe("KnobBase", [[kr + 0.0025, 0.0], [kr + 0.0015, 0.003], [kr, 0.003]], knobBase, 72));
  knob.add(lathe("KnobSide", [[kr, 0.003], [kr, kh - 0.003], [kr - 0.0015, kh - 0.0008], [kr - 0.003, kh]], chrome, 72));
  const top = lathe("KnobFace", [[kr - 0.003, kh], [0, kh + 0.0015]], knobTop, 72);
  const p = top.geometry.attributes.position, uv = top.geometry.attributes.uv;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, 0.5 + p.getX(i) / (2 * kr), 0.5 - p.getY(i) / (2 * kr));
  knob.add(top);
  cab.add(knob);
}

// ── the drawer: its face (the wordmark printed, the handle slot cut through, drawer.jpg), a pocket behind the slot, the tray ──
const [dx0, dt0, dx1, dt1] = L.drawer, [hx0, ht0, hx1, ht1] = L.slot;
const dX = (X(dx0) + X(dx1)) / 2, dY = (Yt(dt0) + Yt(dt1)) / 2;
const drawer = group("Drawer", dX, dY, zF);
{
  const f = plate("DrawerFaceFront", rrect(X(dx0), Yt(dt1), X(dx1), Yt(dt0), 0.002), [rrect(X(hx0), Yt(ht1), X(hx1), Yt(ht0), 0.004, true)], 0.004, L.drawer, [drawerM, drawerM]);
  f.position.set(-dX, -dY, -0.004);
  drawer.add(f);
  // the handle pocket: open at the front, 24 mm deep (ESTIMATED)
  const pw = X(hx1) - X(hx0) + 0.001, ph = Yt(ht0) - Yt(ht1) + 0.001;   // 0.5 mm wider than the slot all round: its walls start behind the face, no seam
  drawer.add(mesh("HandlePocket", openBox(pw, ph, 0.02), pocketM, (X(hx0) + X(hx1)) / 2 - dX, (Yt(ht0) + Yt(ht1)) / 2 - dY, -0.004 - 0.01));   // from the face's back (no overlap with the slot's sides), its floor 4 mm clear of the tray's front plate
  // a skirt filling the gap between the face and the tray's front plate (seen from the side with the drawer out), open at
  // the front so the slot still shows the pocket; it hides the pocket's outside
  {
    const g = new THREE.BoxGeometry(X(dx1) - X(dx0) - 0.006, Yt(dt0) - Yt(dt1) - 0.006, 0.0253);
    const idx = [...g.index.array];
    idx.splice(24, 6);
    g.setIndex(idx);
    g.clearGroups();
    drawer.add(mesh("DrawerSkirt", g, trayM, 0, 0, -0.0042 - 0.01265));   // its back 1.5 mm into the tray's front plate
  }
  // the tray: 170 mm wide, 60 mm deep, 260 mm long behind the face (ESTIMATED: no photo shows it open)
  const tw = 0.17, th = 0.06, tl = 0.26, z0 = -0.03, z1 = z0 - tl, zc = (z0 + z1) / 2, wt = 0.0025, y0 = -0.01;
  drawer.add(box("TrayFloor", tw, wt, tl, trayM, 0, y0 - th / 2 + wt / 2, zc));
  drawer.add(box("TrayWallL", wt, th, tl, trayM, -tw / 2 + wt / 2, y0, zc));
  drawer.add(box("TrayWallR", wt, th, tl, trayM, tw / 2 - wt / 2, y0, zc));
  drawer.add(box("TrayWallBack", tw - 2 * wt, th, wt, trayM, 0, y0, z1 + wt / 2));
  drawer.add(box("TrayDivider", wt, th * 0.85, tl - 2 * wt, trayM, -0.02, y0 - th * 0.075, zc));
  drawer.add(box("TrayFrontPlate", X(dx1) - X(dx0) - 0.004, Yt(dt0) - Yt(dt1) - 0.004, 0.003, trayM, 0, 0, -0.004 - 0.024 - 0.002));
}
cab.add(drawer);

// ── the door: hinged on the left about a pin 14 mm in from the ring's edge and 16 mm in front of the body; a gloss-black
// ring that domes out to 45 mm (ESTIMATED), the glass inside it (r 168 mm), a silver-grey back and a clear bowl ──
const door = group("Door", hingeX, cy, hingeZ);
const dc = group("DoorCentre", cx - hingeX, 0, zF - hingeZ);
dc.add(lathe("DoorRing", [[ringR - 0.004, 0.003], [ringR, 0.006], [ringR, 0.022], [0.262, 0.035], [0.248, 0.0425], [0.225, 0.045], [0.2, 0.0425], [glassR + 0.01, 0.036], [glassR - 0.002, 0.030], [0.16, 0.012], [0.157, 0.0045], [0.158, 0.0045]], ring));
dc.add(lathe("DoorBack", [[0.158, 0.0045], [0.17, 0.004], [0.2, 0.0025], [ringR - 0.004, 0.003]], doorBack));
dc.add(lathe("DoorGlass", [[glassR, 0.0305], [0.12, 0.033], [0.0, 0.034]], tint));
dc.add(lathe("DoorBowl", [[0.158, 0.0045], [0.153, -0.015], [0.14, -0.04], [0.11, -0.062], [0.06, -0.072], [0.0, -0.074]], bowl));
dc.add(box("DoorHook", 0.01, 0.022, 0.012, doorBack, 0.236, 0, -0.003));
for (const dy of [0.065, -0.065]) dc.add(box("DoorHingeArm", 0.03, 0.022, 0.0055, hingeM, -(ringR - 0.02), dy, -0.0005));   // behind the door's back plate, 6 mm clear of its face
door.add(dc);
root.add(door);

// the band's print at 12 px per mm, cut to the ink and laid 0.9 mm over the band's face
const printM = (n) => mat(n, 0xffffff, paint);
const printTex = uvDecals(bandFace, `${T}/decals_panel.json`, printM, { cell: [0.05, 0.05] });

const parts = productParts(PRODUCTS, ID);
const clips = stateClips(root, parts);
saveZones(PRODUCTS, ID, root, parts);
fs.writeFileSync(new URL(`../entries/${ID}.gate.json`, import.meta.url), tidyJSON({ sticksOut: {} }));
// Grain (BENCHMARK.md section 10): a smooth painted cabinet, so the painted faces (the band and the drawer's face too, the
// same paint) get the gentle peel; none on the glass, the chrome, the rubber, the drum or the tray.
const peel = { type: "peel_soft" };
const grain = { dir: `${TEX}/grain`, materials: {
  Front: peel, Side: peel, TopLid: peel, Panel: peel, DrawerFace: peel, ...Object.fromEntries(Object.keys(printTex).map((k) => [k, peel])),
} };
await exportGLB(root, clips, OUT, {
  Side: `${T}/side.jpg`, Panel: `${T}/panel.jpg`, DrawerFace: `${T}/drawer.jpg`, DisplaySlab: `${T}/display.jpg`, KeySlab: `${T}/keys.jpg`,
  KnobTop: `${T}/knob_top.jpg`, Drum: `${T}/drum.jpg`, ...printTex,
}, grain);
