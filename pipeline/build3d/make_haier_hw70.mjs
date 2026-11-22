// Haier HW70-IM12929BK, 929 series front-load washer, 7 kg, 1200 rpm, Black (Sangeetha listing 20616, item code HW70-IM12929BK).
// Built to Haier India's published size for this model, 595 W x 850 H x 468 D mm (haier.com/in, this model's page; Sangeetha's
// listing and the 929-series user manual agree), and to the photos of this model on Sangeetha's listing (straight-on front, 3/4
// from the left, door open). Haier's own gallery photos for the model are no longer online.
// A black glass control band across the top: an upright lip under a face that leans back (ESTIMATED 30 degrees), the drawer's
// face at its left, the display and six keys in the middle, the programme dial (Haier: "Chrome Knob") at the right; the print
// is the manual's own drawing of the 929 panel (tex_haier_hw70.py). Under it the navy-black body ("Black"), the door with a
// silver rim, a tinted glass ("Half Transparent with black") and a clear bowl, hinged on the left, the dark grey gasket ("Gasket:
// Dark grey"), the 525 mm Super Drum, and the round pump-filter cover bottom right (shut: no photo shows it open, BENCHMARK 7).
// The sides carry the pressed relief of the 3/4 photo. The back: the manual's rear view (Fig. 2-2) places the four transit bolts,
// the back cover's nine screws and the water inlet valve; the cord and the drain hose are not modelled (the drawing does not
// show their runs clearly enough to place them).
// The drawer's tray is the manual's Fig. 3-5 (detergent at the left with the liquid/powder flap selector, softener at the front
// right, sanitizer behind it, the lock tab at the back); its sizes and colour ESTIMATED (no photo shows it open).
// usage: node make_haier_hw70.mjs <products.json> <tex dir> <out.glb>
import fs from "node:fs";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import { THREE, mat, mesh, box, faced, group, lathe, frontWithHoles, inward, stateClips, exportGLB, productParts, saveZones, tidyJSON } from "./lib.mjs";
import { uvDecals } from "./decal_curved.mjs";

const [PRODUCTS, TEX, OUT] = process.argv.slice(2);
const ID = "haier-hw70-im12929bk";
const T = `${TEX}/haier_hw70`;
const L = JSON.parse(fs.readFileSync(`${T}/layout.json`, "utf8"));
const mm = (v) => v / 1000;

// ── size (metres) ──
const W = 0.595, H = 0.85, D = 0.468;                        // Haier India: 595 x 850 x 468 mm (W x H x D)
const zF = D / 2, zB = -D / 2;
const feet = mm(L.feet);                                      // 15 mm: ESTIMATED, the feet under the cabinet in the front photo
const panelBot = mm(L.panel_bot), lipTop = mm(L.lip_top);     // the black band 750-850 mm; its upright lip to 776 mm
const TILT = THREE.MathUtils.degToRad(L.tilt_deg), slant = mm(L.slant);   // the face above leans back 30 degrees (ESTIMATED)
const setBack = (H - lipTop) * Math.tan(TILT);                // 42.7 mm: how far back the band's top edge sits
const slantZ = (y) => zF - Math.max(0, y - lipTop) * Math.tan(TILT);
const [PW, PH] = L.panel_px, SLANT_ROWS = L.panel_slant_rows, PS = 7;   // panel.jpg: 7 px per mm, slope rows then lip rows
const panelV = (y) => (y >= lipTop ? (H - y) / Math.cos(TILT) * 1000 * PS : SLANT_ROWS + (lipTop - y) * 1000 * PS) / PH;
const panelU = (x) => (x + W / 2) / W;
const cx = mm(L.door.x), cy = mm(L.door.y), ringR = mm(L.door.rim);   // the door's centre 460 mm up; its silver rim 277.7 mm
const flap = { x: mm(L.flap.x), y: mm(L.flap.y), r: mm(L.flap.r) };
// The door seat (open-door photo, 0.99 px per mm): the body's front ends at 276 mm from the door's centre, a black bezel falls
// to a shallow dish, the gasket's lip at 203 mm. Radii +-3 mm; the depths ESTIMATED from the shading.
const seatR = 0.276, gasketR = 0.203;
const DISH = [[seatR, 0.0], [0.272, -0.004], [0.266, -0.007], [0.24, -0.0105], [0.22, -0.0145], [0.207, -0.0185], [gasketR, -0.02]];
const dishZ = (r) => { for (let i = 1; i < DISH.length; i++) if (r >= DISH[i][0]) { const [r0, z0] = DISH[i - 1], [r1, z1] = DISH[i]; return z1 + (z0 - z1) * (r - r1) / (r0 - r1); } return DISH[DISH.length - 1][1]; };
// The door stands about 28 mm proud (ESTIMATED: Haier gives only the cabinet's 468 mm; the front photo shows a low dome). It
// swings on the left about a pin 16 mm in from its rim's left edge and 16 mm in front of the body; at 122 degrees its centre
// lands 388 mm left of the cabinet's, where the open-door photo has it (ESTIMATED).
const doorFront = 0.028, hingeX = cx - ringR + 0.016, hingeZ = zF + 0.016;

// ── materials ──
const front = mat("Front", 0x13161e, { rough: 0.42 });          // "Black": a navy black in every photo (front photo 20/23/32)
const sideL = mat("SideL", 0xffffff, { rough: 0.45 });
const sideR = mat("SideR", 0xffffff, { rough: 0.45 });
const bodyDark = mat("BodyDark", 0x13161e, { rough: 0.45 });
const lidM = mat("TopLid", 0x0f1117, { rough: 0.5 });           // the top cover, black (3/4 photo 19/23/32)
const backM = mat("Back", 0x23262d, { rough: 0.7 });             // no photo of the back: the body's paint, plain
const panelM = mat("Panel", 0xffffff, { rough: 0.12 });         // black glass; the print is panel.jpg
const glassEdge = mat("PanelEdge", 0x0d0e10, { rough: 0.3 });
const dark = mat("Dark", 0x0b0c0e, { rough: 0.8 });
const knobTop = mat("KnobTop", 0xffffff, { rough: 0.38 });
const chrome = mat("Chrome", 0xc9cdd2, { metal: 1, rough: 0.16 });   // "Chrome Knob: Yes" (Haier India)
const trayM = mat("TrayGrey", 0xd4d7db, { rough: 0.5 });        // UNVERIFIED colour: no photo shows the drawer open
const trayIn = mat("TrayInner", 0xbfc3c8, { rough: 0.6 });
const flapSel = mat("FlapSelector", 0x3a3d42, { rough: 0.5 });
const silver = mat("DoorSilver", 0x9a9ea4, { metal: 0.9, rough: 0.35 });   // the door's rim, silver in the front photo
const doorIn = mat("DoorInner", 0x0c0d0f, { metal: 0.2, rough: 0.28 });   // the door's wide black ring (open-door photo)
const tint = mat("DoorTint", 0x121417, { metal: 0.1, rough: 0.04, opacity: 0.62, side: THREE.DoubleSide });   // "Half Transparent with black" (Haier India)
const bowl = mat("GlassBowl", 0x30363c, { rough: 0.12, opacity: 0.12, side: THREE.DoubleSide });   // the clear inner bowl
const hookM = mat("DoorHook", 0xb9bdc2, { metal: 0.9, rough: 0.3 });
const gasket = mat("Gasket", 0x2b2d31, { rough: 0.85 });         // "Gasket: Dark grey" (Haier India)
const bezel = mat("Bezel", 0x0e0f12, { rough: 0.5 });            // the black seat round the gasket (open-door photo)
const drum = mat("Drum", 0xffffff, { metal: 0.9, rough: 0.26 });
const steel = mat("Steel", 0xc4c8cc, { metal: 1, rough: 0.18 });
const drumBack = mat("DrumBack", 0x4f5257, { metal: 0.9, rough: 0.24 });
const footPad = mat("Foot", 0x1d1e21, { rough: 0.7 });           // the feet: a dark pad on a short bright stem (front photo)
const footStem = mat("FootStem", 0xa7abb0, { metal: 0.8, rough: 0.35 });
const slotM = mat("LockSlotFace", 0x0d0e10, { rough: 0.7 });
const hingeM = mat("Hinge", 0xa9adb3, { metal: 0.85, rough: 0.35 });   // the hinge bracket is silver in the open-door photo
const boltMat = mat("Bolt", 0xaeb2b7, { metal: 0.9, rough: 0.3 });
const capMat = mat("BoltCapPlastic", 0x2c2e32, { rough: 0.6 });
const screwM = mat("Screw", 0x8d9196, { metal: 0.8, rough: 0.35 });
const valveM = mat("Valve", 0x3a3c40, { rough: 0.55 });

const root = group("HaierHW70");
const cab = group("Cabinet");
root.add(cab);

// A prism along x from a closed [y, z] profile: its faces in `faceSegs` (segment i runs from point i to i+1) take the panel
// print (panel.jpg, by panelU / panelV), the rest and the end caps take the second material.
function band(name, x0, x1, prof, faceSegs, mats) {
  const P = prof.map(([y, z]) => new THREE.Vector2(z, y));
  const ccw = THREE.ShapeUtils.isClockWise(P) ? false : true;
  const pos = [], uv = [], groups = [[], []];
  const tri = (a, b, c, n, g, uvs) => {
    const e1 = new THREE.Vector3().subVectors(b, a), e2 = new THREE.Vector3().subVectors(c, a);
    if (new THREE.Vector3().crossVectors(e1, e2).dot(n) < 0) { [b, c] = [c, b]; uvs = [uvs[0], uvs[2], uvs[1]]; }
    const start = pos.length / 3;
    for (const v of [a, b, c]) pos.push(v.x, v.y, v.z);
    for (const t of uvs) uv.push(...t);
    groups[g].push(start);
  };
  const n = prof.length;
  for (let i = 0; i < n; i++) {
    const [ya, za] = prof[i], [yb, zb] = prof[(i + 1) % n];
    const dz = zb - za, dy = yb - ya;
    const nn = ccw ? new THREE.Vector3(0, -dz, dy) : new THREE.Vector3(0, dz, -dy);    // outward (in the z-y plane)
    const isFace = faceSegs.includes(i), g = isFace ? 0 : 1;
    const A = new THREE.Vector3(x0, ya, za), B = new THREE.Vector3(x1, ya, za), C = new THREE.Vector3(x1, yb, zb), Dd = new THREE.Vector3(x0, yb, zb);
    const U = (v) => (isFace ? [panelU(v.x), panelV(v.y)] : [0.002, 0.995]);
    tri(A, B, C, nn, g, [U(A), U(B), U(C)]);
    tri(A, C, Dd, nn, g, [U(A), U(C), U(Dd)]);
  }
  const tris = THREE.ShapeUtils.triangulateShape(P, []);
  for (const [x, s] of [[x0, -1], [x1, 1]]) {
    for (const [a, b, c] of tris) {
      const v = [a, b, c].map((k) => new THREE.Vector3(x, prof[k][0], prof[k][1]));
      tri(v[0], v[1], v[2], new THREE.Vector3(s, 0, 0), 1, [[0.002, 0.995], [0.002, 0.995], [0.002, 0.995]]);
    }
  }
  // reorder by group so each material is one draw range
  const g = new THREE.BufferGeometry(), P2 = [], U2 = [];
  let count0 = 0;
  for (const gi of [0, 1]) for (const s of groups[gi]) { for (let k = 0; k < 3; k++) { P2.push(...pos.slice((s + k) * 3, (s + k) * 3 + 3)); U2.push(...uv.slice((s + k) * 2, (s + k) * 2 + 2)); } if (gi === 0) count0 += 3; }
  g.setAttribute("position", new THREE.Float32BufferAttribute(P2, 3));
  g.setAttribute("uv", new THREE.Float32BufferAttribute(U2, 2));
  g.computeVertexNormals();
  g.addGroup(0, count0, 0);
  g.addGroup(count0, P2.length / 3 - count0, 1);
  return mesh(name, g, mats);
}

// ── cabinet: thin side sheets with the pressed relief (side_l / side_r.jpg), to 826 mm under the black top cover ──
// No two faces share a plane: the sheets stop 1.5 mm behind the front and 0.5 mm under the cover; the cover sits 0.5 mm
// inside the sheets' outer faces; the band's top (850 mm) stands 0.5 mm over the cover.
const t = 0.003, sideTop = mm(L.side_top), sideY0 = feet + 0.0008, sideY1 = sideTop - 0.0005, sideZ1 = zF - 0.0015;
const sideGeo = (u0) => {
  const g = new THREE.BoxGeometry(t, sideY1 - sideY0, sideZ1 - zB);
  const p = g.attributes.position, uv = g.attributes.uv;
  for (let i = 0; i < uv.count; i++) {
    const z = p.getZ(i) + (zB + sideZ1) / 2, y = p.getY(i) + (sideY0 + sideY1) / 2;
    uv.setXY(i, u0 ? (zF - z) / D : (z - zB) / D, (sideTop - y) / (sideTop - feet));
  }
  return g;
};
cab.add(mesh("SideLeft", sideGeo(false), [bodyDark, sideL, bodyDark, bodyDark, bodyDark, bodyDark], -W / 2 + t / 2, (sideY0 + sideY1) / 2, (zB + sideZ1) / 2));
cab.add(mesh("SideRight", sideGeo(true), [sideR, bodyDark, bodyDark, bodyDark, bodyDark, bodyDark], W / 2 - t / 2, (sideY0 + sideY1) / 2, (zB + sideZ1) / 2));
// the top cover, black, from the band's top edge to the back (3/4 photo: it stands over the side sheets by its own thickness)
const lidZ0 = zB + 0.0015, lidZ1 = zF - setBack - 0.001;
cab.add(box("Top", W - 0.001, H - 0.0005 - sideTop, lidZ1 - lidZ0, lidM, 0, (sideTop + H - 0.0005) / 2, (lidZ0 + lidZ1) / 2));
cab.add(box("Base", W - 2 * t - 0.001, 0.008, (zF - 0.0105) - (zB + 0.0045), dark, 0, feet + 0.0015 + 0.004, ((zF - 0.0105) + (zB + 0.0045)) / 2));
const backH = sideTop - 0.001 - feet - 0.002;
cab.add(mesh("BackPanel", new THREE.BoxGeometry(W - 2 * t - 0.001, backH, 0.004), [dark, dark, dark, dark, dark, backM], 0, feet + 0.001 + backH / 2, zB + 0.002));
{ // four feet: a dark pad 30 mm across and 10 mm tall on a bright stem 16 mm across and 5 mm tall (front photo, +-2 mm);
  // 269 and 272 mm either side of the centre (front photo), 40 mm in from the front and back (ESTIMATED)
  const pad = new THREE.CylinderGeometry(0.015, 0.015, 0.010, 24), stem = new THREE.CylinderGeometry(0.008, 0.008, feet - 0.010, 16);
  for (const fx of L.feet_x) for (const fz of [1, -1]) {
    cab.add(mesh("Foot", pad, footPad, mm(fx), 0.005, fz * (D / 2 - 0.04)));
    cab.add(mesh("FootStem", stem, footStem, mm(fx), 0.010 + (feet - 0.010) / 2, fz * (D / 2 - 0.04)));
  }
}
// ── the back: the manual's rear view (Fig. 2-2): transit-bolt caps T1-T4 with their bolt heads, the back cover's nine screws,
// the water inlet valve at the top right (seen from behind) ──
for (const [k, [bx, by]] of Object.entries(L.bolts)) {
  const x = mm(bx), y = mm(by);
  cab.add(mesh(`BoltRing${k}`, new THREE.CylinderGeometry(0.0195, 0.0195, 0.006, 28), capMat, x, y, zB - 0.003).rotateX(Math.PI / 2));
  cab.add(mesh(`BoltCap${k}`, new THREE.CylinderGeometry(0.016, 0.016, 0.010, 28), boltMat, x, y, zB - 0.008).rotateX(Math.PI / 2));
  cab.add(mesh(`BoltHead${k}`, new THREE.CylinderGeometry(0.0062, 0.0062, 0.006, 6), boltMat, x, y, zB - 0.016).rotateX(Math.PI / 2));
}
{
  L.screws.forEach(([sx, sy]) => cab.add(mesh("BackScrew", new THREE.CylinderGeometry(0.0045, 0.0045, 0.0006, 16).rotateX(Math.PI / 2), screwM, mm(sx), mm(sy), zB - 0.0001)));
}
cab.add(mesh("InletValve", new THREE.CylinderGeometry(0.011, 0.011, 0.016, 24), valveM, mm(L.inlet[0]), mm(L.inlet[1]), zB - 0.008).rotateX(Math.PI / 2));

// ── the front below the band: the body's paint with the door seat cut out ──
const mainFront = frontWithHoles("FrontMain", W - 0.003, panelBot - feet, [{ x: cx, y: cy - feet, r: seatR }], front, 0.010);
mainFront.position.set(0, feet, zF - 0.010);
cab.add(mainFront);
cab.add(lathe("DoorSeat", DISH, bezel).translateX(cx).translateY(cy).translateZ(zF));
{ // the door lock's slot in the dish at the right, 240 mm from the door's centre (open-door photo); 13 x 9 mm ESTIMATED
  const r = 0.240;
  const s = faced("LockSlot", 0.009, 0.013, 0.002, [dark, dark, dark, dark, slotM, dark], cx + r, cy, zF + dishZ(r) + 0.0006);
  s.rotation.y = -Math.atan2(dishZ(r + 0.01) - dishZ(r - 0.01), 0.02);
  cab.add(s);
}
// the hinge: a silver plate in the dish at the left with two arms out to the door's edge (open-door photo: two tabs 50 mm
// above and below the door's centre line; sizes ESTIMATED). Behind the door's black ring when it is shut.
for (const dy of [0.05, -0.05]) {
  const x0 = cx - 0.212, x1 = hingeX + 0.004, z0 = dishZ(Math.hypot(0.212, dy)) - 0.003;
  cab.add(box("HingeArm", x0 - x1, 0.016, 0.0008 - z0, hingeM, (x0 + x1) / 2, cy + dy, zF + (z0 + 0.0008) / 2));
}

// ── the control band: the upright lip and the leaning face, black glass with the 929 print (panel.jpg) ──
const g0 = 0.0008;                                            // the gap round the drawer
const seam = mm(L.seam);                                      // the drawer's right edge, 116.6 mm left of the centre
const xl = -W / 2 + 0.0025, xr = W / 2 - 0.0025;
const PDEPTH = 0.065;                                         // the band's body behind its face (ESTIMATED; it is hidden)
const bandProf = [[panelBot, zF], [lipTop, zF], [H, zF - setBack], [H, zF - PDEPTH], [panelBot, zF - PDEPTH]];
const controlPanel = band("ControlPanel", seam + g0, xr, bandProf, [0, 1], [panelM, glassEdge]);
cab.add(controlPanel);
// the dial: a chrome-edged knob, 48 mm across and 9 mm proud of the face (ESTIMATED; the photo shows it from the front only),
// its top dark with the four-diamond mark (knob_top.jpg); the ring round it is printed
{
  const ky = mm(L.knob.y), kz = slantZ(ky), kr = mm(L.knob_r), kh = 0.009;
  const knob = group("Knob", mm(L.knob.x), ky, kz);
  knob.rotation.x = -TILT;
  knob.add(lathe("KnobSide", [[kr - 0.0015, 0.0], [kr, 0.002], [kr, kh - 0.0015], [kr - 0.0012, kh]], chrome, 64));
  const top = lathe("KnobFace", [[kr - 0.0012, kh], [0, kh]], knobTop, 64);
  const p = top.geometry.attributes.position, uv = top.geometry.attributes.uv;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, 0.5 + p.getX(i) / (2 * kr), 0.5 - p.getY(i) / (2 * kr));
  knob.add(top);
  cab.add(knob);
}
// the six keys (Delay, Steam, Temp., Speed, Extra Rinse, Start/Pause): raised 1 mm off the face (ESTIMATED; the photo shows
// them as lighter rounded tiles), their faces carrying their own print: keys.jpg, the same drawing as panel.jpg at 12 px per
// mm over the six keys (keys.json: its box as a fraction of panel.jpg's u and v)
const KB = JSON.parse(fs.readFileSync(`${T}/keys.json`, "utf8")).rect;
const keyM = mat("KeyFace", 0xffffff, { rough: 0.12 });
const keyUV = (u, v) => [(u - KB[0]) / (KB[2] - KB[0]), (v - KB[1]) / (KB[3] - KB[1])];
{
  const [ya, yb] = L.key_y.map(mm), yMid = (ya + yb) / 2;
  const s0 = (H - yb) / Math.cos(TILT), s1 = (H - ya) / Math.cos(TILT), sMid = (s0 + s1) / 2, len = s1 - s0, kd = 0.0013;
  for (const [k0, k1] of L.keys) {
    const x0 = mm(k0), x1 = mm(k1), w = x1 - x0;
    const g = new THREE.BoxGeometry(w, len, kd), p = g.attributes.position, uv = g.attributes.uv;
    for (let i = 16; i < 20; i++) uv.setXY(i, ...keyUV(panelU(x0 + w / 2 + p.getX(i)), (sMid - p.getY(i)) * 1000 * PS / PH));
    for (const i of [...Array(16).keys(), 20, 21, 22, 23]) uv.setXY(i, 0.004, 0.02);     // keys.jpg's glass corner
    const key = mesh("Key", g, keyM, (x0 + x1) / 2, yMid, slantZ(yMid));
    key.rotation.x = -TILT;
    key.translateZ(kd / 2 - 0.0003);
    cab.add(key);
  }
}
// the dark bay the drawer slides out of
const bay = { x0: -W / 2 + t + 0.0005, x1: seam - 0.0005, y0: 0.735, y1: sideTop - 0.0005 };
cab.add(mesh("DrawerBay", inward(new THREE.BoxGeometry(bay.x1 - bay.x0, bay.y1 - bay.y0, 0.29)), dark, (bay.x0 + bay.x1) / 2, (bay.y0 + bay.y1) / 2, zF - 0.0105 - 0.145));

// ── the drawer: its face is the band's left section (lip and leaning face, with Haier, Inverter, the 525 DRUM / REFRESH badges
// and the finger recess printed), 4.5 mm thick; the tray behind it per the manual's Fig. 3-5 ──
const dX = (xl + seam - g0) / 2, dY = 0.80;
const drawer = group("Drawer", dX, dY, zF);
{
  const th = 0.0045;
  const prof = [[panelBot + 0.0005, zF], [lipTop, zF], [H, zF - setBack], [H, zF - setBack - th / Math.cos(TILT)], [lipTop + th * Math.tan(TILT / 2), zF - th], [panelBot + 0.0005, zF - th]];
  const f = band("DrawerFace", xl, seam - g0, prof, [0, 1], [panelM, glassEdge]);
  f.position.set(-dX, -dY, -zF);
  drawer.add(f);
  // the tray: 160 mm wide, 50 mm deep, 250 mm long (ESTIMATED), from 12 mm behind the face (clear of the body's front), its
  // top 788 mm up, under the leaning face
  const tw = 0.16, th2 = 0.05, tl = 0.25, z0 = -0.012, z1 = z0 - tl, zc = (z0 + z1) / 2, wt = 0.0025, y0 = 0.763 - dY;
  drawer.add(box("TrayFloor", tw, wt, tl, trayIn, 0, y0 - th2 / 2 + wt / 2, zc));
  drawer.add(box("TrayWallL", wt, th2, tl, trayM, -tw / 2 + wt / 2, y0, zc));
  drawer.add(box("TrayWallR", wt, th2, tl, trayM, tw / 2 - wt / 2, y0, zc));
  drawer.add(box("TrayWallBack", tw - 2 * wt, th2, wt, trayM, 0, y0, z1 + wt / 2));
  drawer.add(box("TrayWallFront", tw - 2 * wt, th2 * 0.85, wt, trayM, 0, y0 - th2 * 0.075, z0 - wt / 2));
  // 1 (detergent) the long left compartment; 4 (softener) front right, 3 (sanitizer) behind it, then the covered back right
  const mid = 0.008;
  drawer.add(box("TrayDivider", wt, th2 * 0.85, tl - 2 * wt, trayM, mid, y0 - th2 * 0.075, zc));
  for (const zz of [z0 - 0.085, z0 - 0.165]) drawer.add(box("TrayCross", tw / 2 - mid - wt, th2 * 0.75, wt, trayM, (mid + tw / 2) / 2, y0 - th2 * 0.125, zz));
  const cz0 = z0 - 0.165 - wt / 2, cz1 = z1 + wt;
  drawer.add(box("TrayCover", tw / 2 - mid - wt, wt, cz0 - cz1, trayM, (mid + tw / 2) / 2, y0 + th2 / 2 - wt / 2 - 0.002, (cz0 + cz1) / 2));
  // 2 the liquid/powder flap selector, at the back of compartment 1; 5 the lock tab on the cover
  drawer.add(box("FlapSelector", 0.03, 0.012, 0.018, flapSel, (-tw / 2 + mid) / 2, y0 + 0.006, z1 + 0.06));
  drawer.add(box("LockTab", 0.012, 0.006, 0.02, flapSel, (mid + tw / 2) / 2, y0 + th2 / 2 + 0.001, z1 + 0.035));
}
cab.add(drawer);

// ── the gasket and the 525 mm Super Drum ──
const gasketRing = lathe("GasketRing", [[gasketR + 0.003, -0.0215], [gasketR, -0.0185], [0.197, -0.0175], [0.191, -0.022], [0.19, -0.03], [0.194, -0.04], [0.19, -0.05], [0.186, -0.062], [0.184, -0.075]], gasket);
gasketRing.position.set(cx, cy, zF);
cab.add(gasketRing);
// "525 Super Drum" (Haier India; Sangeetha: drum diameter 525 mm): 262.5 mm radius, VERIFIED; its depth ESTIMATED
const drumR = 0.2625, drumDepth = 0.30, drumZ = zF - 0.087 - drumDepth / 2;
{
  const g = inward(new THREE.CylinderGeometry(drumR, drumR, drumDepth, 72, 1, true));
  g.rotateX(Math.PI / 2);
  const uv = g.attributes.uv;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * 20, 1 - uv.getY(i));    // drum.jpg: an 82.5 mm strip, 20 round the drum
  cab.add(mesh("DrumShell", g, drum, cx, cy, drumZ));
}
cab.add(mesh("DrumBack", new THREE.CircleGeometry(drumR, 64), drumBack, cx, cy, drumZ - drumDepth / 2 + 0.002));
cab.add(lathe("DrumLip", [[drumR, 0], [0.184, 0.012]], steel).translateX(cx).translateY(cy).translateZ(drumZ + drumDepth / 2));
// three broad lifters along the wall and up the back to the hub, a Y with one arm straight up (open-door photo)
for (let i = 0; i < 3; i++) {
  const a = Math.PI / 2 + (i / 3) * Math.PI * 2;
  const lifter = mesh(`Lifter${i}`, new RoundedBoxGeometry(0.07, 0.04, drumDepth - 0.03, 2, 0.014), steel, cx + Math.cos(a) * (drumR - 0.016), cy + Math.sin(a) * (drumR - 0.016), drumZ + 0.01);
  lifter.rotation.z = a + Math.PI / 2;
  cab.add(lifter);
  const arm = mesh(`DrumArm${i}`, new RoundedBoxGeometry(0.06, drumR - 0.05, 0.03, 2, 0.012), steel, cx + Math.cos(a) * (drumR / 2 + 0.01), cy + Math.sin(a) * (drumR / 2 + 0.01), drumZ - drumDepth / 2 + 0.012);
  arm.rotation.z = a - Math.PI / 2;
  cab.add(arm);
}
cab.add(mesh("DrumHub", new THREE.SphereGeometry(0.036, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2), steel, cx, cy, drumZ - drumDepth / 2 + 0.01).rotateX(Math.PI / 2));

// ── the pump-filter cover, bottom right: a round cover 117 mm across just proud of the front (front photo). Shut only. ──
cab.add(lathe("FlapDisc", [[flap.r, -0.0005], [flap.r, 0.0006], [flap.r - 0.0012, 0.0011], [0, 0.0011]], front, 64).translateX(flap.x).translateY(flap.y).translateZ(zF));

// ── the door: hinged on the left; a silver rim, a dark tinted glass over a wide black ring, and a clear inner bowl ──
// Radii from the front photo: rim 271-277.7 mm, the black ring's inner edge 185 mm (glass).
const door = group("Door", hingeX, cy, hingeZ);
const dc = group("DoorCentre", cx - hingeX, 0, zF - hingeZ);
const gR = mm(L.door.glass), sIn = mm(L.door.silver_in);
dc.add(lathe("DoorInner", [[sIn, 0.009], [gR, 0.009], [gR, 0.003], [sIn, 0.003]], doorIn));
dc.add(lathe("DoorRim", [[sIn, 0.002], [ringR, 0.0045], [ringR, 0.0125], [ringR - 0.0035, 0.017], [sIn, 0.018]], silver));
dc.add(lathe("DoorTint", [[sIn, 0.018], [0.25, 0.020], [0.2, 0.023], [0.12, 0.0262], [0.0, doorFront]], tint));
dc.add(lathe("DoorBowl", [[gR, 0.003], [gR - 0.008, -0.02], [gR - 0.026, -0.05], [gR - 0.06, -0.072], [0.07, -0.085], [0.0, -0.087]], bowl));
// the latch on the free side, into the lock slot; the hinge bracket with its two tabs on the hinge side (open-door photo)
dc.add(box("DoorHook", 0.012, 0.005, 0.016, hookM, 0.236, 0, -0.005));
dc.add(box("DoorHingeBracket", 0.022, 0.13, 0.006, hingeM, -(gR + 0.014), 0, -0.002));
door.add(dc);
root.add(door);

// the panel's print at 12 px per mm for a close look (tex_haier_hw70.py: the manual's drawing again at 2400 dpi), cut to the
// print and laid 0.9 mm over the band's flat faces: the display and the dial on the control panel, the drawer's words on the
// drawer face (they go with the drawer); the panel's own black glass
const printM = (n) => mat(n, 0xffffff, { rough: 0.12 });
const printTex = {
  ...uvDecals(controlPanel, `${T}/decals_panel.json`, printM, { cell: [0.05, 0.05] }),
  ...uvDecals(root.getObjectByName("DrawerFace"), `${T}/decals_drawer.json`, printM, { cell: [0.05, 0.05] }),
};

const parts = productParts(PRODUCTS, ID);
const clips = stateClips(root, parts);
saveZones(PRODUCTS, ID, root, parts);
// The door stands in front of the published depth (STANDARD section 8)
fs.writeFileSync(new URL(`../entries/${ID}.gate.json`, import.meta.url), tidyJSON({ sticksOut: {
  "Door[A-Z]\\w*": "Haier India's page for this model gives 59.5 x 85.0 x 46.8 cm (W x H x D) for the cabinet, as do Sangeetha's listing and the 929-series manual; the door's rim and glass stand about 28 mm in front of it (ESTIMATED from the front and open-door photos).",
} }));
// Grain (BENCHMARK.md section 10): Haier names the colour "Black"; the photos show a smooth painted cabinet, so the painted
// faces get the gentle peel. No grain on the glass band, the drawer face, the chrome, the glass, the drum or the tray.
const grain = { dir: `${TEX}/grain`, materials: {
  Front: { type: "peel_soft" }, SideL: { type: "peel_soft" }, SideR: { type: "peel_soft" }, BodyDark: { type: "peel_soft" },
  TopLid: { type: "peel_soft" },
} };
await exportGLB(root, clips, OUT, {
  SideL: `${T}/side_l.jpg`, SideR: `${T}/side_r.jpg`, Panel: `${T}/panel.jpg`, KnobTop: `${T}/knob_top.jpg`, Drum: `${T}/drum.jpg`,
  KeyFace: `${T}/keys.jpg`, ...printTex,
}, grain);
