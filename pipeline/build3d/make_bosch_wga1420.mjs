// Bosch WGA1420PIN, Series 6 front-load washing machine, 9 kg, Dark lake.
// Built to Bosch's published size, 598 W x 848 H x 590 D mm (636 mm deep with the door, 1049 mm with the door open at 90 degrees, 53 L drum),
// from Bosch's studio photo (front), its 360 degree frames (the sides with the concentric-ring Anti-Vibration panels, the open steel back with
// its hoses, cord and plug, modelled in 3D) and its page: a control strip with the detergent drawer at the left, the dial and the display; a black glass door hinged
// on the left with a chrome ring; a round pump-filter flap at the bottom right; a stainless drum with three ribs.
// usage: node make_bosch_wga1420.mjs <products.json> <tex dir> <out.glb>
import fs from "node:fs";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import { THREE, mat, mesh, box, faced, group, lathe, frontWithHoles, flipV, inward, stateClips, exportGLB, productParts, saveZones } from "./lib.mjs";

const [PRODUCTS, TEX, OUT] = process.argv.slice(2);
const ID = "bosch-wga1420pin";
const T = `${TEX}/bosch_wga1420`;

// ── size (metres); photo scale 2.676 px/mm across and 2.627 px/mm down, rows measured from the machine's top edge (file row 5) ──
const W = 0.598, H = 0.848, D = 0.590;
const zF = D / 2, zB = -D / 2;
const feet = 0.012, stripH = 0.1344, stripY = H - stripH;
const mmY = (row) => H - (row - 5) / 2.627 / 1000;           // photo row -> height above the floor
const mmX = (px) => (px - 800) / 2.676 / 1000;                // photo column -> metres from the centre
const cx = 0, cy = 0.455, ringR = 0.2435, holeR = 0.19;       // the door: centre and radii (measured on the studio photo)
const hingeZ = zF - 0.028;                                    // the door's hinge axis sits 28 mm behind the body front (1049 mm at 90 degrees)
const flap = { x: mmX(1315), y: mmY(1988), r: 0.0769 };      // the round pump-filter flap

// ── materials ──
const body = mat("Body", 0xffffff, { rough: 0.5 });
const front = mat("Front", 0xffffff, { rough: 0.48 });
const sideL = mat("SideL", 0xffffff, { rough: 0.5 });
const sideR = mat("SideR", 0xffffff, { rough: 0.5 });
const rearM = mat("Rear", 0xffffff, { rough: 0.55 });
const panelM = mat("Panel", 0xffffff, { rough: 0.32 });
const drawerM = mat("DrawerFace", 0xffffff, { rough: 0.3, metal: 0.15 });
const trayM = mat("Tray", 0xffffff, { rough: 0.5 });
const bodyDark = mat("BodyDark", 0x353a47, { rough: 0.5 });
const topM = mat("TopPlate", 0x2f3440, { rough: 0.75 });
const dark = mat("Dark", 0x0b0c0e, { rough: 0.8 });
const bay = mat("Bay", 0xb4b7bb, { rough: 0.6 });               // the pump recess is light grey plastic in Bosch's filter photo (PGA11)
const chrome = mat("Chrome", 0xc9ccd1, { metal: 1, rough: 0.16 });
const knobCap = mat("KnobCap", 0x1e1f22, { metal: 0.2, rough: 0.28 });
const knobRing = mat("KnobRing", 0xb7bbc1, { metal: 1, rough: 0.2 });
const ringBlack = mat("DoorBlack", 0x08090b, { metal: 0.3, rough: 0.12 });
const glass = mat("DoorGlass", 0x0f1216, { rough: 0.04, opacity: 0.16, side: THREE.DoubleSide });
const bowl = mat("GlassBowl", 0x2a2f36, { rough: 0.05, opacity: 0.2, side: THREE.DoubleSide });
const doorIn = mat("DoorInner", 0x2d3036, { rough: 0.6 });
const gasket = mat("Gasket", 0x25272b, { rough: 0.85 });
const drum = mat("Drum", 0xffffff, { metal: 0.85, rough: 0.34 });
const steel = mat("Steel", 0xb9bcc0, { metal: 0.9, rough: 0.3 });
const ribM = mat("DrumRib", 0xa8acb3, { metal: 0.9, rough: 0.3 });
const backGrey = mat("DrumBack", 0x4c5056, { metal: 0.7, rough: 0.42 });
const footM = mat("Foot", 0x17181a, { rough: 0.8 });
const flapM = mat("FlapFace", 0x3a3f4c, { rough: 0.48 });
const filterM = mat("FilterCap", 0x6c6f74, { rough: 0.55 });   // the cap's toothed ring is mid grey, its face and grip light (PGA11)
const filterFace = mat("FilterFace", 0xc9ccd0, { rough: 0.5 });
const hoseM = mat("PumpHose", 0x101113, { rough: 0.7 });

const root = group("BoschWGA1420");
const cab = group("Cabinet");
root.add(cab);

// ── cabinet: sides carry Bosch's Anti-Vibration ring relief, the back is the open steel panel with its hoses ──
const t = 0.012, bodyH = H - feet, midY = feet + bodyH / 2;
cab.add(mesh("SideLeft", flipV(new THREE.BoxGeometry(t, bodyH, D - 0.004)), [dark, sideL, bodyDark, bodyDark, bodyDark, bodyDark], -W / 2 + t / 2, midY, -0.002));
cab.add(mesh("SideRight", flipV(new THREE.BoxGeometry(t, bodyH, D - 0.004)), [sideR, dark, bodyDark, bodyDark, bodyDark, bodyDark], W / 2 - t / 2, midY, -0.002));
// the top sits 1.5 mm inside the sides' outer faces, so the two never share a plane (a shared plane is pushed out 0.8 mm by defight)
cab.add(faced("Top", W - 0.003, 0.014, D, [topM, topM, topM, dark, topM, topM], 0, H - 0.007, 0));
cab.add(box("Base", W - 2 * t, t, D - 0.01, dark, 0, feet + t / 2, -0.005));
cab.add(mesh("BackPanel", flipV(new THREE.BoxGeometry(W - 2 * t, bodyH - 0.014, 0.004)), [dark, dark, dark, dark, dark, rearM], 0, feet + (bodyH - 0.014) / 2, zB + 0.002));
for (const [fx, fz] of [[-1, 1], [1, 1], [-1, -1], [1, -1]]) {
  cab.add(mesh("Foot", new THREE.CylinderGeometry(0.017, 0.019, feet, 18), footM, fx * (W / 2 - 0.045), feet / 2, fz * (D / 2 - 0.05)));
}

// ── on the back, as delivered (Bosch's rear 360 frame): the ribbed drain hose from its bracket at the top down the side, round
// the bottom and up into the holder at the other side; the smooth inlet hose from the valve at the top, round in a loop to its tap
// nut; the power cord in its holders and the Indian 16 A plug (Bosch's product sheet) clipped at the lower holder. Centre lines,
// sizes and the plug's outline are traced off the photo by tex_bosch_wga1420.py (rear_paths.json); how far each stands off the
// back is ESTIMATED from Bosch's oblique 360 frames (the drain hose in front where they cross, the inlet hose over it at the right).
const rp = JSON.parse(fs.readFileSync(`${T}/rear_paths.json`, "utf8"));
const drainM = mat("Hose", 0xffffff, { rough: 0.7 });
const inletM = mat("InletHose", 0xa9acb1, { rough: 0.5 });
const cordM = mat("Cord", 0x5a5d62, { rough: 0.6 });
const plugM = mat("Plug", 0x83868b, { rough: 0.5 });
{
  const v3 = (pts, z) => pts.map(([x, y]) => new THREE.Vector3(x, y, typeof z === "function" ? z(x, y) : z));
  const tube = (name, pts, r, m, radial, perM = 90) => {
    const c = new THREE.CatmullRomCurve3(pts, false, "centripetal");
    const g = new THREE.TubeGeometry(c, Math.max(8, Math.round(c.getLength() * perM)), r, radial, false);
    cab.add(mesh(name, g, m));
    return { c, g };
  };
  // drain hose, 4 mm off the back; its ribs every 4 mm
  const dr = tube("DrainHose", v3(rp.drain, zB - 0.004 - rp.drain_d / 2), rp.drain_d / 2, drainM, 10, 110);
  const uv = dr.g.attributes.uv, ribs = dr.c.getLength() / 0.004;
  for (let i = 0; i < uv.count; i++) uv.setX(i, uv.getX(i) * ribs);
  for (const t of [0, 1]) { // close both ends (the top one sits in its bracket, the other in the holder), so the tube isn't seen through
    const p = dr.c.getPointAt(t), d = dr.c.getTangentAt(t);
    const end = mesh("HoseEnd", new THREE.CylinderGeometry(rp.drain_d / 2, rp.drain_d / 2, 0.004, 10), drainM, p.x, p.y, p.z);
    end.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), d);
    cab.add(end);
  }
  // inlet hose, 4 mm off the back, lifted over the drain hose where it crosses it at the right
  const [kx, ky] = [-(978 - 821) / 688, (747.5 - 491) / 688];
  const zIn = (x, y) => zB - 0.004 - rp.inlet_d / 2 - 0.025 * Math.exp(-(((x - kx) ** 2 + (y - ky) ** 2) / 0.058 ** 2));
  tube("InletHose", v3(rp.inlet, zIn), rp.inlet_d / 2, inletM, 8);
  const inStart = v3([rp.inlet[0]], zIn)[0];
  cab.add(mesh("InletFitting", new THREE.CylinderGeometry(0.0105, 0.0105, inStart.z - zB + 0.004, 6), plugM, inStart.x, inStart.y, (inStart.z + zB) / 2).rotateX(Math.PI / 2));
  { // the tap nut at the hose's free end, along the hose's last direction
    const [a, b] = v3(rp.nut, zIn), dir = b.clone().sub(a), len = dir.length();
    const nut = mesh("InletNut", new THREE.CylinderGeometry(0.012, 0.012, len, 6), plugM, (a.x + b.x) / 2, (a.y + b.y) / 2, (a.z + b.z) / 2);
    nut.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.normalize());
    cab.add(nut);
  }
  // the power cord: the runs that pass over the hoses stand further off the back
  const off = { CordRight: 0.008, CordToPlug: 0.022, CordUpper: 0.022, CordLower: 0.006, CordDown: 0.006 };
  for (const [name, pts] of Object.entries(rp.cords)) tube(name, v3(pts, zB - off[name]), rp.cord_d / 2, cordM, 6);
  // the plug hangs pins-down in the lower holder: strain-relief sleeve, body, the two pins the photo shows
  const [[sx, sy0], [, sy1]] = rp.plug.sleeve, [[bx0, by0], [bx1, by1]] = rp.plug.body;
  const zP = zB - 0.022, bw = Math.abs(bx1 - bx0), bh = by0 - by1;
  cab.add(mesh("CordSleeve", new THREE.CylinderGeometry(0.0062, 0.0075, sy0 - sy1, 12), plugM, sx, (sy0 + sy1) / 2, zP));
  cab.add(mesh("Plug", new RoundedBoxGeometry(bw, bh, 0.026, 2, 0.004), plugM, (bx0 + bx1) / 2, (by0 + by1) / 2, zP));
  for (const [[px, py0], [, py1]] of rp.plug.pins) cab.add(mesh("PlugPin", new THREE.CylinderGeometry(0.0035, 0.0035, py0 - py1, 10), steel, px, (py0 + py1) / 2, zP));
}

// ── the front below the control strip: the plain face with a hole for the door seat and one for the pump-filter flap ──
const mainFront = frontWithHoles("FrontMain", W, stripY - feet, [{ x: cx, y: cy - feet, r: holeR }, { x: flap.x, y: flap.y - feet, r: flap.r - 0.004 }], front, 0.004);
mainFront.geometry = mainFront.geometry;
mainFront.position.set(0, feet, zF - 0.004);
cab.add(mainFront);
// the control strip: the panel print, a raised face
// 1.5 mm inside the side faces and under the top (defight looks at planes closer than 1.2 mm), so it shares no plane with them and the cabinet stays at Bosch's 598 x 848 mm
cab.add(mesh("ControlStrip", flipV(new THREE.BoxGeometry(W - 0.003, stripH - 0.0015, 0.01)), [bodyDark, bodyDark, bodyDark, bodyDark, panelM, bodyDark], 0, stripY + (stripH - 0.0015) / 2, zF - 0.004));
cab.add(box("StripGroove", W, 0.0012, 0.0016, dark, 0, stripY - 0.0006, zF + 0.0008));
// the knob: chrome ring, black glossy cap, a white pointer
{
  const k = group("Dial", mmX(800), mmY(176), zF + 0.001);
  k.add(lathe("KnobBase", [[0.0385, 0], [0.0385, 0.003], [0.0345, 0.0042], [0.0, 0.0042]], knobCap, 64));
  k.add(lathe("KnobRing", [[0.0362, 0.003], [0.0362, 0.0135], [0.0338, 0.0148], [0.0305, 0.0148], [0.0305, 0.0105], [0.0345, 0.0042]], knobRing, 64));
  k.add(lathe("KnobCap", [[0.0305, 0.0105], [0.0302, 0.0132], [0.0275, 0.0148], [0.0, 0.0150]], knobCap, 64));
  const mark = box("KnobMark", 0.0016, 0.0085, 0.0008, mat("KnobPointer", 0xe9ebee, { rough: 0.4 }), 0, 0.0268, 0.0114);
  k.add(mark);
  cab.add(k);
}

// ── detergent drawer: Bosch's own face with its chrome bar and logo, a tray with three compartments behind it ──
const dW = 0.1704, dH = 0.0792, dX = mmX(328), dY = mmY(179);
const drawer = group("Drawer", dX, dY, zF - 0.004);
drawer.add(mesh("DrawerFace", flipV(new THREE.BoxGeometry(dW, dH, 0.012)), [bodyDark, bodyDark, bodyDark, bodyDark, drawerM, bodyDark], 0, 0, 0.006));
drawer.add(mesh("DrawerTray", flipV(new THREE.BoxGeometry(dW - 0.016, 0.052, 0.21)), [trayM, trayM, trayM, trayM, trayM, trayM], 0, -0.008, -0.105));
cab.add(drawer);

// ── gasket and the stainless drum behind the door seat ──
const gasketRing = lathe("GasketRing", [[holeR + 0.004, 0.004], [holeR - 0.008, -0.012], [holeR - 0.022, -0.05], [holeR - 0.03, -0.085]], gasket);
gasketRing.position.set(cx, cy, zF - 0.004);
cab.add(gasketRing);
const drumR = 0.24, drumDepth = 0.30, drumZ = zF - 0.095 - drumDepth / 2;
{
  const g = inward(new THREE.CylinderGeometry(drumR, drumR, drumDepth, 72, 1, true));
  g.rotateX(Math.PI / 2);
  const uv = g.attributes.uv;
  const uRep = (2 * Math.PI * drumR) / 0.19, vRep = drumDepth / 0.095;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * uRep, 1 - uv.getY(i) * vRep);
  cab.add(mesh("DrumShell", g, drum, cx, cy, drumZ));
}
cab.add(mesh("DrumBack", new THREE.CircleGeometry(drumR, 64), backGrey, cx, cy, drumZ - drumDepth / 2 + 0.002));
for (let i = 0; i < 3; i++) { // the three raised arms that run from the hub out to the ribs on the wall, a trefoil seen from the front
  const a = (i / 3) * Math.PI * 2 + Math.PI / 6;
  const arm = box(`DrumArm${i}`, 0.17, 0.04, 0.02, ribM, cx + Math.cos(a) * 0.115, cy + Math.sin(a) * 0.115, drumZ - drumDepth / 2 + 0.012);
  arm.rotation.z = a;
  cab.add(arm);
}
cab.add(mesh("DrumHub", new THREE.CylinderGeometry(0.031, 0.034, 0.014, 40), ribM, cx, cy, drumZ - drumDepth / 2 + 0.008).rotateX(Math.PI / 2));
cab.add(lathe("DrumLip", [[drumR, 0], [holeR - 0.03, 0.012]], steel).translateX(cx).translateY(cy).translateZ(drumZ + drumDepth / 2));
for (let i = 0; i < 3; i++) { // three wide ribs, 120 degrees apart, as in Bosch's drum
  const a = (i / 3) * Math.PI * 2 + Math.PI / 6;
  const rib = box(`DrumRib${i}`, 0.085, 0.026, drumDepth - 0.03, ribM, cx + Math.cos(a) * (drumR - 0.012), cy + Math.sin(a) * (drumR - 0.012), drumZ);
  rib.rotation.z = a + Math.PI / 2;
  cab.add(rib);
}
// ── the pump-filter recess behind the round flap: a light grey housing, the round filter cap and the emergency-drain hose ──
{
  const g = group("PumpBay", flap.x, flap.y, zF);
  g.add(lathe("PumpHousing", [[flap.r - 0.004, 0.0], [flap.r - 0.004, -0.035], [0.0, -0.035]], bay, 48).rotateX(0));
  // Bosch's filter photo (PGA11, 3.95 px/mm on the recess): the filter cap low and right of centre with an upright grip, the
  // emergency-drain hose on a straight diagonal from a hole at the lower left to its plug at the upper right
  g.add(mesh("FilterCap", new THREE.CylinderGeometry(0.028, 0.028, 0.022, 36), [filterM, filterFace, filterM], 0.014, -0.036, -0.02).rotateX(Math.PI / 2));
  g.add(lathe("FilterRim", [[0.028, 0.0], [0.028, 0.0015], [0.0225, 0.0015], [0.0225, 0.0]], filterM, 36).translateX(0.014).translateY(-0.036).translateZ(-0.009));
  g.add(mesh("FilterGrip", new THREE.BoxGeometry(0.006, 0.046, 0.006), filterM, 0.014, -0.036, -0.006));
  const hose = new THREE.CatmullRomCurve3([new THREE.Vector3(-0.058, -0.016, -0.026), new THREE.Vector3(-0.054, -0.006, -0.014), new THREE.Vector3(-0.044, 0.001, -0.012), new THREE.Vector3(0.026, 0.054, -0.012)]);
  g.add(mesh("PumpHose", new THREE.TubeGeometry(hose, 20, 0.005, 8, false), hoseM));
  cab.add(g);
}
// the flap: a round lid hinged along its lower edge, with a small tab at the top
const filter = group("FilterFlap", flap.x, flap.y - flap.r, zF + 0.0005);
filter.add(mesh("FlapDisc", new THREE.CylinderGeometry(flap.r - 0.0005, flap.r - 0.0005, 0.006, 48), [bodyDark, flapM, flapM], 0, flap.r, 0.003).rotateX(Math.PI / 2));
filter.add(mesh("FlapRim", new THREE.TorusGeometry(flap.r - 0.0005, 0.0012, 6, 48), dark, 0, flap.r, 0.0062));
filter.add(box("FlapTab", 0.017, 0.006, 0.004, dark, 0, 2 * flap.r - 0.006, 0.006));
root.add(filter);

// ── door: hinged on the left; chrome ring, black glass, a clear dome ──
// the door stands 46 mm proud of the body front (636 mm deep with the door); its front is at 0.074 above the hinge axis
const door = group("Door", cx - ringR, cy, hingeZ);
const dc = group("DoorCentre", ringR, 0, 0);
dc.add(lathe("DoorInnerRing", [[holeR - 0.02, 0.028], [ringR - 0.003, 0.028]], doorIn));
dc.add(lathe("DoorRim", [[ringR, 0.028], [ringR + 0.0012, 0.0395], [ringR - 0.002, 0.0545], [ringR - 0.0075, 0.0603]], chrome));
dc.add(lathe("DoorBlack", [[ringR - 0.0075, 0.0603], [ringR - 0.016, 0.0645], [0.19, 0.0676], [0.162, 0.0704]], ringBlack));
dc.add(lathe("DoorGlass", [[0.162, 0.0704], [0.12, 0.0720], [0.06, 0.0732], [0.0, 0.0738]], glass));
dc.add(lathe("DoorBowl", [[0.165, 0.028], [0.15, -0.002], [0.115, -0.035], [0.06, -0.054], [0.0, -0.062]], bowl));
door.add(dc);
root.add(door);

const parts = productParts(PRODUCTS, ID);
const clips = stateClips(root, parts);
saveZones(PRODUCTS, ID, root, parts);
// Grain (BENCHMARK.md section 10). Bosch names the colour "Dark lake" (product page) and the door frame "Silver-black grey"
// (Bosch's product sheet); it publishes no material. Its close photos show a smooth painted cabinet with a fine speckle, so the
// painted faces (front, sides, top, their edges and the pump-filter flap) get the gentle peel. No grain on the control strip and
// the drawer face, which carry print, nor on the polished door ring, which shows no brushing in Bosch's photos.
const grain = { dir: `${TEX}/grain`, materials: {
  Front: { type: "peel_soft" }, SideL: { type: "peel_soft" }, SideR: { type: "peel_soft" },
  BodyDark: { type: "peel_soft" }, TopPlate: { type: "peel_soft" }, FlapFace: { type: "peel_soft" },
} };
await exportGLB(root, clips, OUT, {
  Front: `${T}/front.jpg`, SideL: `${T}/side_l.jpg`, SideR: `${T}/side_r.jpg`, Rear: `${T}/rear.jpg`,
  Panel: `${T}/panel.jpg`, DrawerFace: `${T}/drawer.jpg`, Tray: `${T}/tray.jpg`, Drum: `${T}/drum.jpg`, Hose: `${T}/hose.jpg`,
}, grain);
