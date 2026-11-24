// Haier HW90-DM14929EBKF, 929 series front-load washer, 9 kg, 1400 rpm, Black (Sangeetha listing 19369, item code
// HW90-DM14929EBKF). Built to Haier India's published size for this model, 595 W x 850 H x 500 D mm (Haier India's page for
// the model, archived 29 May 2024; the manual's technical data agrees), and to Haier's own gallery photos of it (straight-on
// front with the door open, 3/4 from each side with the door shut, the drum close-up).
// A black glass control band across the top: an upright lip under a face that leans back (ESTIMATED 30 degrees), the drawer's
// face at its left, the display and six keys in the middle, the programme dial at the right; the print is set from Haier's own
// picture of this panel (tex_haier_hw90.py). Under it the navy-black body ("Black"), a raised navy ring round the door seat,
// the door ("Half Transparent with black": a wide black ring round a tinted glass, a clear bowl behind), hinged on the left, the
// dark grey gasket ("Gasket: Dark grey"), the 525 mm drum ("525 Super Drum", "Pillow shape drum"), and the round pump-filter
// cover bottom right (shut: no photo shows it open, BENCHMARK 7). The sides carry the pressed relief of Haier's 3/4 photos.
// The back: the manual's rear view (Fig. 2-2) places the four transit bolts, the back cover's seven screws and the water inlet
// valve, and its leads place the power cord (out under the top cover, to a hanging Indian 3-pin plug) and the ribbed drain
// hose (up the back's left edge to a hook at the top).
// The drawer's tray follows the manual's section 3.4 and Fig. 3-5 (detergent at the left with the liquid/powder flap
// selector, softener and sanitizer at the right, the lock tab at the back); its sizes and colour ESTIMATED (no photo shows it
// open).
// usage: node make_haier_hw90.mjs <products.json> <tex dir> <out.glb>
import fs from "node:fs";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import { THREE, mat, mesh, box, faced, group, lathe, frontWithHoles, inward, stateClips, exportGLB, productParts, saveZones, tidyJSON } from "./lib.mjs";
import { uvDecals } from "./decal_curved.mjs";

const [PRODUCTS, TEX, OUT] = process.argv.slice(2);
const ID = "haier-hw90-dm14929ebkf";
const T = `${TEX}/haier_hw90`;
const L = JSON.parse(fs.readFileSync(`${T}/layout.json`, "utf8"));
const mm = (v) => v / 1000;

// ── size (metres) ──
const W = 0.595, H = 0.85, D = 0.5;                          // Haier India: 595 x 500 x 850 mm (W x D x H)
const zF = D / 2, zB = -D / 2;
const feet = mm(L.feet);                                      // 11.4 mm: ESTIMATED, the feet under the cabinet in Haier's front photo
const panelBot = mm(L.panel_bot), lipTop = mm(L.lip_top);     // the black band 741-850 mm; its upright lip to 769 mm
const TILT = THREE.MathUtils.degToRad(L.tilt_deg);            // the face above leans back 30 degrees (ESTIMATED)
const setBack = (H - lipTop) * Math.tan(TILT);                // 46.8 mm: how far back the band's top edge sits
const slantZ = (y) => zF - Math.max(0, y - lipTop) * Math.tan(TILT);
const [PW, PH] = L.panel_px, SLANT_ROWS = L.panel_slant_rows, PS = L.panel_px_per_mm;   // panel.jpg: slope rows then lip rows
const panelV = (y) => (y >= lipTop ? (H - y) / Math.cos(TILT) * 1000 * PS : SLANT_ROWS + (lipTop - y) * 1000 * PS) / PH;
const panelU = (x) => (x + W / 2) / W;
const cx = mm(L.door.x), cy = mm(L.door.y), ringR = mm(L.door.rim);   // the door's centre 469 mm up; the door 279 mm round
const flap = { x: mm(L.flap.x), y: mm(L.flap.y), r: mm(L.flap.r) };
// The door seat (Haier's front photo, door open, 1.26 px per mm): the body's front ends 271 mm from the door's centre, a black
// bezel falls to a shallow dish, the gasket's lip at 193 mm. Radii +-3 mm; the depths ESTIMATED from the shading.
const seatR = 0.271, gasketR = mm(L.door.gasket);
const DISH = [[seatR, 0.0], [0.267, -0.004], [0.261, -0.007], [0.236, -0.0105], [0.216, -0.0145], [0.197, -0.0185], [gasketR, -0.02]];
const dishZ = (r) => { for (let i = 1; i < DISH.length; i++) if (r >= DISH[i][0]) { const [r0, z0] = DISH[i - 1], [r1, z1] = DISH[i]; return z1 + (z0 - z1) * (r - r1) / (r0 - r1); } return DISH[DISH.length - 1][1]; };
// The door stands about 28 mm proud (ESTIMATED: Haier gives only the cabinet's 500 mm; the 3/4 photos show a low dome). It
// swings on the left about a pin 16 mm in from its left edge and 16 mm in front of the body; at 115 degrees its centre lands
// about 390 mm left of the cabinet's, where Haier's open-door photo has it (ESTIMATED).
const doorFront = 0.028, hingeX = cx - ringR + 0.016, hingeZ = zF + 0.016;

// ── materials ──
const front = mat("Front", 0x15181f, { rough: 0.42 });          // "Black": a navy black in every photo (front photo 19-24/22-27/31-36)
const ringM = mat("SeatRing", 0x1b1f29, { rough: 0.4 });        // the raised ring round the seat, a lighter navy in the photos
const sideL = mat("SideL", 0xffffff, { rough: 0.45 });
const sideR = mat("SideR", 0xffffff, { rough: 0.45 });
const bodyDark = mat("BodyDark", 0x15181f, { rough: 0.45 });
const lidM = mat("TopLid", 0x0f1117, { rough: 0.5 });           // the top cover, black (3/4 photos)
const backM = mat("Back", 0x23262d, { rough: 0.7 });             // no photo of the back: the body's paint, plain
const panelM = mat("Panel", 0xffffff, { rough: 0.12 });         // black glass; the print is panel.jpg
const glassEdge = mat("PanelEdge", 0x0d0e10, { rough: 0.3 });
const dark = mat("Dark", 0x0b0c0e, { rough: 0.8 });
const knobTop = mat("KnobTop", 0xffffff, { rough: 0.35 });
const knobSide = mat("KnobSide", 0x18161a, { rough: 0.3 });     // the knob's dark edge (Haier's panel picture: no chrome)
const trayM = mat("TrayGrey", 0xd4d7db, { rough: 0.5 });        // UNVERIFIED colour: no photo shows the drawer open
const trayIn = mat("TrayInner", 0xbfc3c8, { rough: 0.6 });
const flapSel = mat("FlapSelector", 0x3a3d42, { rough: 0.5 });
const doorRing = mat("DoorRing", 0x0b0c0f, { rough: 0.22 });   // the door's wide black ring (every photo)
const tint = mat("DoorTint", 0x121417, { metal: 0.1, rough: 0.04, opacity: 0.45, side: THREE.DoubleSide });   // "Half Transparent with black" (Haier India)
const bowl = mat("GlassBowl", 0x30363c, { rough: 0.12, opacity: 0.12, side: THREE.DoubleSide });   // the clear inner bowl
const hookM = mat("DoorHook", 0xb9bdc2, { metal: 0.9, rough: 0.3 });
const gasket = mat("Gasket", 0x2b2d31, { rough: 0.85 });         // "Gasket: Dark grey" (Haier India)
const bezel = mat("Bezel", 0x0e0f12, { rough: 0.5 });            // the black seat round the gasket (open-door photo)
const drum = mat("Drum", 0xffffff, { metal: 0.9, rough: 0.26 });
const steel = mat("Steel", 0xc4c8cc, { metal: 1, rough: 0.18 });
const drumBack = mat("DrumBack", 0x4f5257, { metal: 0.9, rough: 0.24 });
const footPad = mat("Foot", 0x1d1e21, { rough: 0.7 });           // the feet: a dark pad on a short bright stem (photos)
const footStem = mat("FootStem", 0xa7abb0, { metal: 0.8, rough: 0.35 });
const slotM = mat("LockSlotFace", 0x0d0e10, { rough: 0.7 });
const hingeM = mat("Hinge", 0xa9adb3, { metal: 0.85, rough: 0.35 });   // the hinge bracket is silver in the open-door photo
const boltMat = mat("Bolt", 0xaeb2b7, { metal: 0.9, rough: 0.3 });
const capMat = mat("BoltCapPlastic", 0x2c2e32, { rough: 0.6 });
const screwM = mat("Screw", 0x8d9196, { metal: 0.8, rough: 0.35 });
const valveM = mat("Valve", 0x3a3c40, { rough: 0.55 });
const hoseM = mat("Hose", 0xffffff, { rough: 0.7 });             // the drain hose, ribbed (hose.jpg); grey UNVERIFIED
const cordM = mat("Cord", 0x2b2c2f, { rough: 0.6 });             // UNVERIFIED colour
const plugM = mat("PlugBody", 0x303134, { rough: 0.5 });
const pinM = mat("PlugPin", 0xb9b4a4, { metal: 0.9, rough: 0.3 });

const root = group("HaierHW90");
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
    const nn = ccw ? new THREE.Vector3(0, -dz, dy) : new THREE.Vector3(0, dz, -dy);
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

// ── cabinet: thin side sheets with the pressed relief (side_l / side_r.jpg), to 815 mm under the black top cover ──
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
const lidZ0 = zB + 0.0015, lidZ1 = zF - setBack - 0.001;
cab.add(box("Top", W - 0.001, H - 0.0005 - sideTop, lidZ1 - lidZ0, lidM, 0, (sideTop + H - 0.0005) / 2, (lidZ0 + lidZ1) / 2));
cab.add(box("Base", W - 2 * t - 0.001, 0.008, (zF - 0.0105) - (zB + 0.0045), dark, 0, feet + 0.0015 + 0.004, ((zF - 0.0105) + (zB + 0.0045)) / 2));
const backH = sideTop - 0.001 - feet - 0.002;
cab.add(mesh("BackPanel", new THREE.BoxGeometry(W - 2 * t - 0.001, backH, 0.004), [dark, dark, dark, dark, dark, backM], 0, feet + 0.001 + backH / 2, zB + 0.002));
{ // four feet: a dark pad 35 mm across and 8 mm tall on a bright stem (Haier's photos, +-2 mm); at 268.5 mm left and 266.5 mm
  // right of the centre (front photo), 40 mm in from the front and back (ESTIMATED)
  const pad = new THREE.CylinderGeometry(0.0175, 0.0175, 0.008, 24), stem = new THREE.CylinderGeometry(0.008, 0.008, feet - 0.008, 16);
  for (const fx of L.feet_x) for (const fz of [1, -1]) {
    cab.add(mesh("Foot", pad, footPad, mm(fx), 0.004, fz * (D / 2 - 0.04)));
    cab.add(mesh("FootStem", stem, footStem, mm(fx), 0.008 + (feet - 0.008) / 2, fz * (D / 2 - 0.04)));
  }
}
// ── the back: the manual's rear view (Fig. 2-2): transit-bolt caps T1-T4 with their bolt heads, the back cover's seven screws,
// the water inlet valve at the top (seen from behind, the right) ──
for (const [k, [bx, by]] of Object.entries(L.bolts)) {
  const x = mm(bx), y = mm(by);
  cab.add(mesh(`BoltRing${k}`, new THREE.CylinderGeometry(0.0195, 0.0195, 0.006, 28), capMat, x, y, zB - 0.003).rotateX(Math.PI / 2));
  cab.add(mesh(`BoltCap${k}`, new THREE.CylinderGeometry(0.016, 0.016, 0.010, 28), boltMat, x, y, zB - 0.008).rotateX(Math.PI / 2));
  cab.add(mesh(`BoltHead${k}`, new THREE.CylinderGeometry(0.0062, 0.0062, 0.006, 6), boltMat, x, y, zB - 0.016).rotateX(Math.PI / 2));
}
L.screws.forEach(([sx, sy]) => cab.add(mesh("BackScrew", new THREE.CylinderGeometry(0.0045, 0.0045, 0.0006, 16).rotateX(Math.PI / 2), screwM, mm(sx), mm(sy), zB - 0.0001)));
cab.add(mesh("InletValve", new THREE.CylinderGeometry(0.011, 0.011, 0.016, 24), valveM, mm(L.inlet[0]), mm(L.inlet[1]), zB - 0.008).rotateX(Math.PI / 2));
// ── the drain hose and the power cord, as the manual's rear view (Fig. 2-2: "4 Power cord", "6 Drain hose") draws them;
// both stay behind the back, so neither shows from the front, the 3/4 views or the side at eye level. Read off the drawing
// at 200 dpi (+-10 mm); their colours UNVERIFIED (no photo shows the back).
{
  const rx = (X) => W / 2 - (X - 637) / 298 * W, ry = (Y) => H - (Y - 524) / 401 * (H - feet);   // drawing px -> metres
  const tube = (name, pts, r, m, radial, perM = 110) => {
    const c = new THREE.CatmullRomCurve3(pts, false, "centripetal");
    const g = new THREE.TubeGeometry(c, Math.max(8, Math.round(c.getLength() * perM)), r, radial, false);
    cab.add(mesh(name, g, m));
    return { c, g };
  };
  const cap = (name, c, t, r, m) => {                         // closes a tube's end, so the hose isn't seen through
    const p = c.getPointAt(t), d = c.getTangentAt(t);
    const e = mesh(name, new THREE.CylinderGeometry(r, r, 0.003, 12), m, p.x, p.y, p.z);
    e.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), d);
    cab.add(e);
  };
  // the drain hose (20 mm, ribbed): from its outlet low on the back (drawing 897, 905), up the back's left edge (seen from the
  // front; the drawing's right edge, x 925) through a clip (y 630), to a hook at the top whose end hangs down (ESTIMATED shape)
  const rd = 0.010, zD = zB - 0.0005 - rd, xe = rx(925);   // hugging the back, so as little as can be shows past its edge from the side
  const drainPts = [[rx(897.5), ry(905)], [xe + 0.022, 0.062], [xe + 0.004, 0.09], [xe, 0.15], [xe, ry(630)], [xe, 0.77],
    [xe + 0.0035, 0.797], [xe + 0.0175, 0.808], [xe + 0.0315, 0.797], [xe + 0.0335, 0.77], [xe + 0.0335, 0.752]]
    .map(([x, y]) => new THREE.Vector3(x, y, zD));
  const dr = tube("DrainHose", drainPts, rd, hoseM, 12);
  { const uv = dr.g.attributes.uv, n = dr.c.getLength() / 0.0043; for (let i = 0; i < uv.count; i++) uv.setX(i, uv.getX(i) * n); }
  cap("HoseCapLow", dr.c, 0, rd, hoseM);
  cap("HoseCapEnd", dr.c, 1, rd, hoseM);
  cab.add(box("HoseClip", 0.03, 0.012, 2 * rd + 0.003, plugM, xe, ry(630), zB - (2 * rd + 0.003) / 2 - 0.0002));
  // the power cord (8 mm): out of the back just under the top cover (the drawing's lead 4 at x 822), down the back to its
  // Indian 3-pin plug, hung pins-down as delivered (route below the exit ESTIMATED: the drawing shows only where it leaves)
  const rc = 0.004, zC = zB - 0.0025 - rc, cx0 = rx(822), zPlug = zB - 0.0165;
  cab.add(mesh("CordGrommet", new THREE.CylinderGeometry(0.009, 0.010, 0.006, 16).rotateX(Math.PI / 2), plugM, cx0, 0.803, zB - 0.003));
  tube("PowerCord", [[cx0, 0.803, zB - 0.004], [cx0, 0.795, zC], [cx0 + 0.003, 0.70, zC], [cx0 + 0.005, 0.52, zC], [cx0 + 0.005, 0.445, zC], [cx0 + 0.005, 0.425, zPlug]]
    .map(([x, y, z]) => new THREE.Vector3(x, y, z)), rc, cordM, 8);
  const px = cx0 + 0.005;
  cab.add(mesh("CordRelief", new THREE.CylinderGeometry(0.0055, 0.0075, 0.022, 14), plugM, px, 0.425 - 0.011, zPlug));
  cab.add(mesh("Plug", new RoundedBoxGeometry(0.045, 0.042, 0.025, 2, 0.004), plugM, px, 0.403 - 0.021, zPlug));
  // Indian 3-pin (Type D): the earth pin thicker and longer, the two others side by side (layout ESTIMATED)
  for (const [dx, dz, r, len] of [[0, -0.006, 0.0026, 0.021], [-0.0095, 0.0045, 0.002, 0.016], [0.0095, 0.0045, 0.002, 0.016]])
    cab.add(mesh("PlugPin", new THREE.CylinderGeometry(r, r, len, 10), pinM, px + dx, 0.361 - len / 2, zPlug + dz));
}

// ── the front below the band: the body's paint with the door seat cut out, and the raised ring round the seat (its top rises
// over the band's lip, as in every photo) ──
const mainFront = frontWithHoles("FrontMain", W - 0.003, panelBot - feet, [{ x: cx, y: cy - feet, r: seatR }], front, 0.010);
mainFront.position.set(0, feet, zF - 0.010);
cab.add(mainFront);
cab.add(lathe("SeatRing", [[mm(L.door.ring), 0.0003], [mm(L.door.ring) - 0.001, 0.0016], [0.276, 0.0022], [0.2725, 0.0016], [seatR, 0.0003]], ringM).translateX(cx).translateY(cy).translateZ(zF));
cab.add(lathe("DoorSeat", DISH, bezel).translateX(cx).translateY(cy).translateZ(zF));
{ // the door lock's slot in the dish at the right, 236 mm from the door's centre (open-door photo); 13 x 9 mm ESTIMATED
  const r = 0.236;
  const s = faced("LockSlot", 0.009, 0.013, 0.002, [dark, dark, dark, dark, slotM, dark], cx + r, cy, zF + dishZ(r) + 0.0006);
  s.rotation.y = -Math.atan2(dishZ(r + 0.01) - dishZ(r - 0.01), 0.02);
  cab.add(s);
}
// the hinge: a silver plate in the dish at the left with two arms out to the door's edge (open-door photo: two tabs about
// 50 mm above and below the door's centre line; sizes ESTIMATED). Behind the door's black ring when it is shut.
for (const dy of [0.05, -0.05]) {
  const x0 = cx - 0.208, x1 = hingeX + 0.004, z0 = dishZ(Math.hypot(0.208, dy)) - 0.003;
  cab.add(box("HingeArm", x0 - x1, 0.016, 0.0008 - z0, hingeM, (x0 + x1) / 2, cy + dy, zF + (z0 + 0.0008) / 2));
}

// ── the control band: the upright lip and the leaning face, black glass with the print (panel.jpg) ──
const g0 = 0.0008;                                            // the gap round the drawer
const seam = mm(L.seam);                                      // the drawer's right edge, 117.5 mm left of the centre
const xl = -W / 2 + 0.0025, xr = W / 2 - 0.0025;
const PDEPTH = 0.07;                                          // the band's body behind its face (ESTIMATED; it is hidden)
const bandProf = [[panelBot, zF], [lipTop, zF], [H, zF - setBack], [H, zF - PDEPTH], [panelBot, zF - PDEPTH]];
const controlPanel = band("ControlPanel", seam + g0, xr, bandProf, [0, 1], [panelM, glassEdge]);
cab.add(controlPanel);
// the dial: a dark knob 54.6 mm across (the picture's dark disc inside the cyan ring) and 9 mm proud of the face (ESTIMATED),
// its top with the four-diamond mark (knob_top.jpg); the rings round it are printed
{
  const ky = mm(L.knob.y), kz = slantZ(ky), kr = mm(L.knob_r), kh = 0.009;
  const knob = group("Knob", mm(L.knob.x), ky, kz);
  knob.rotation.x = -TILT;
  knob.add(lathe("KnobSide", [[kr - 0.0015, 0.0], [kr, 0.002], [kr, kh - 0.0015], [kr - 0.0012, kh]], knobSide, 64));
  const top = lathe("KnobFace", [[kr - 0.0012, kh], [0, kh]], knobTop, 64);
  const p = top.geometry.attributes.position, uv = top.geometry.attributes.uv;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, 0.5 + p.getX(i) / (2 * kr), 0.5 - p.getY(i) / (2 * kr));
  knob.add(top);
  cab.add(knob);
}
// the six keys (Delay, Steam, Temp., Speed, Extra Rinse, Start/Pause): raised 0.8 mm off the face (ESTIMATED; the picture shows
// them as lighter rounded tiles), their faces carrying their own print: keys.jpg, the same print at 12 px per mm over the six
// keys (keys.json: its box as a fraction of the print's u and v)
const KB = JSON.parse(fs.readFileSync(`${T}/keys.json`, "utf8")).rect;
const keyM = mat("KeyFace", 0xffffff, { rough: 0.12 });
const keyUV = (u, v) => [(u - KB[0]) / (KB[2] - KB[0]), (v - KB[1]) / (KB[3] - KB[1])];
{
  const [ya, yb] = L.key_y.map(mm), yMid = (ya + yb) / 2;
  const s0 = (H - yb) / Math.cos(TILT), s1 = (H - ya) / Math.cos(TILT), sMid = (s0 + s1) / 2, len = s1 - s0, kd = 0.0011;
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
const bay = { x0: -W / 2 + t + 0.0005, x1: seam - 0.0005, y0: 0.726, y1: sideTop - 0.0005 };
cab.add(mesh("DrawerBay", inward(new THREE.BoxGeometry(bay.x1 - bay.x0, bay.y1 - bay.y0, 0.29)), dark, (bay.x0 + bay.x1) / 2, (bay.y0 + bay.y1) / 2, zF - 0.0105 - 0.145));

// ── the drawer: its face is the band's left section (lip and leaning face, with Haier, Direct motion, the 525 DRUM / REFRESH
// badges and the finger recess printed), 4.5 mm thick; the tray behind it per the manual's section 3.4 ──
const dX = (xl + seam - g0) / 2, dY = 0.79;
const drawer = group("Drawer", dX, dY, zF);
{
  const th = 0.0045;
  const prof = [[panelBot + 0.0005, zF], [lipTop, zF], [H, zF - setBack], [H, zF - setBack - th / Math.cos(TILT)], [lipTop + th * Math.tan(TILT / 2), zF - th], [panelBot + 0.0005, zF - th]];
  const f = band("DrawerFace", xl, seam - g0, prof, [0, 1], [panelM, glassEdge]);
  f.position.set(-dX, -dY, -zF);
  drawer.add(f);
  // the tray: 160 mm wide, 50 mm deep, 250 mm long (ESTIMATED), from 12 mm behind the face, its top 754 mm up, under the face
  const tw = 0.16, th2 = 0.05, tl = 0.25, z0 = -0.012, z1 = z0 - tl, zc = (z0 + z1) / 2, wt = 0.0025, y0 = 0.754 - dY;
  drawer.add(box("TrayFloor", tw, wt, tl, trayIn, 0, y0 - th2 / 2 + wt / 2, zc));
  drawer.add(box("TrayWallL", wt, th2, tl, trayM, -tw / 2 + wt / 2, y0, zc));
  drawer.add(box("TrayWallR", wt, th2, tl, trayM, tw / 2 - wt / 2, y0, zc));
  drawer.add(box("TrayWallBack", tw - 2 * wt, th2, wt, trayM, 0, y0, z1 + wt / 2));
  drawer.add(box("TrayWallFront", tw - 2 * wt, th2 * 0.85, wt, trayM, 0, y0 - th2 * 0.075, z0 - wt / 2));
  const mid = 0.008;
  drawer.add(box("TrayDivider", wt, th2 * 0.85, tl - 2 * wt, trayM, mid, y0 - th2 * 0.075, zc));
  for (const zz of [z0 - 0.085, z0 - 0.165]) drawer.add(box("TrayCross", tw / 2 - mid - wt, th2 * 0.75, wt, trayM, (mid + tw / 2) / 2, y0 - th2 * 0.125, zz));
  const cz0 = z0 - 0.165 - wt / 2, cz1 = z1 + wt;
  drawer.add(box("TrayCover", tw / 2 - mid - wt, wt, cz0 - cz1, trayM, (mid + tw / 2) / 2, y0 + th2 / 2 - wt / 2 - 0.002, (cz0 + cz1) / 2));
  drawer.add(box("FlapSelector", 0.03, 0.012, 0.018, flapSel, (-tw / 2 + mid) / 2, y0 + 0.006, z1 + 0.06));
  drawer.add(box("LockTab", 0.012, 0.006, 0.02, flapSel, (mid + tw / 2) / 2, y0 + th2 / 2 + 0.001, z1 + 0.035));
}
cab.add(drawer);

// ── the gasket and the 525 mm drum ──
const gasketRing = lathe("GasketRing", [[gasketR + 0.003, -0.0215], [gasketR, -0.0185], [0.187, -0.0175], [0.181, -0.022], [0.18, -0.03], [0.184, -0.04], [0.18, -0.05], [0.176, -0.062], [0.174, -0.075]], gasket);
gasketRing.position.set(cx, cy, zF);
cab.add(gasketRing);
// "525 Super Drum" / "Drum Diameter: 525 mm" (Haier India): 262.5 mm radius, VERIFIED; its depth ESTIMATED
const drumR = 0.2625, drumDepth = 0.33, drumZ = zF - 0.087 - drumDepth / 2;
{
  const g = inward(new THREE.CylinderGeometry(drumR, drumR, drumDepth, 72, 1, true));
  g.rotateX(Math.PI / 2);
  const uv = g.attributes.uv;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * 20, 1 - uv.getY(i));    // drum.jpg: an 82.5 mm strip, 20 round the drum
  cab.add(mesh("DrumShell", g, drum, cx, cy, drumZ));
}
cab.add(mesh("DrumBack", new THREE.CircleGeometry(drumR, 64), drumBack, cx, cy, drumZ - drumDepth / 2 + 0.002));
cab.add(lathe("DrumLip", [[drumR, 0], [0.174, 0.012]], steel).translateX(cx).translateY(cy).translateZ(drumZ + drumDepth / 2));
// three broad lifters along the wall and up the back to the hub, a Y with one arm straight up (Haier's open-door photo)
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

// ── the pump-filter cover, bottom right: a round cover 100 mm across just proud of the front, a small dot at its top
// (Haier's front photo). Shut only. ──
cab.add(lathe("FlapDisc", [[flap.r, -0.0005], [flap.r, 0.0006], [flap.r - 0.0012, 0.0011], [0, 0.0011]], front, 64).translateX(flap.x).translateY(flap.y).translateZ(zF));
cab.add(mesh("FlapDot", new THREE.CylinderGeometry(0.003, 0.003, 0.0008, 16).rotateX(Math.PI / 2), dark, flap.x, flap.y + flap.r - 0.012, zF + 0.0013));

// ── the door: hinged on the left; a wide black ring round a dark tinted glass, a clear inner bowl behind ──
// Radii from Haier's open-door photo: the door 279 mm, its glass 198 mm.
const door = group("Door", hingeX, cy, hingeZ);
const dc = group("DoorCentre", cx - hingeX, 0, zF - hingeZ);
const gR = mm(L.door.glass);
dc.add(lathe("DoorRing", [[gR, 0.003], [ringR - 0.002, 0.003], [ringR, 0.006], [ringR, 0.013], [ringR - 0.006, 0.019], [gR + 0.014, 0.0215], [gR, 0.0205], [gR - 0.002, 0.003]], doorRing));
dc.add(lathe("DoorTint", [[gR, 0.0205], [0.16, 0.0228], [0.1, 0.0262], [0.0, doorFront]], tint));
dc.add(lathe("DoorBowl", [[gR - 0.002, 0.003], [gR - 0.01, -0.02], [gR - 0.028, -0.05], [gR - 0.062, -0.072], [0.07, -0.085], [0.0, -0.087]], bowl));
// the latch on the free side, into the lock slot; the hinge bracket with its two tabs on the hinge side (open-door photo)
dc.add(box("DoorHook", 0.012, 0.005, 0.016, hookM, 0.232, 0, -0.005));
dc.add(box("DoorHingeBracket", 0.022, 0.13, 0.006, hingeM, -(gR + 0.014), 0, -0.002));
door.add(dc);
root.add(door);

// the panel's print at 12 px per mm for a close look, cut to the print and laid 0.9 mm over the band's flat faces: the display
// and the dial on the control panel, the drawer's words on the drawer face (they go with the drawer)
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
  "Door[A-Z]\\w*": "Haier India's page for this model gives 595 x 500 x 850 mm (W x D x H) for the cabinet, as does the manual; the door's ring and glass stand about 28 mm in front of it (ESTIMATED from Haier's 3/4 and open-door photos).",
} }));
// Grain (BENCHMARK.md section 10): Haier names the colour "Black"; the photos show a smooth painted cabinet, so the painted
// faces get the gentle peel. No grain on the glass band, the drawer face, the door, the drum or the tray.
const grain = { dir: `${TEX}/grain`, materials: {
  Front: { type: "peel_soft" }, SideL: { type: "peel_soft" }, SideR: { type: "peel_soft" }, BodyDark: { type: "peel_soft" },
  TopLid: { type: "peel_soft" }, SeatRing: { type: "peel_soft" },
} };
await exportGLB(root, clips, OUT, {
  SideL: `${T}/side_l.jpg`, SideR: `${T}/side_r.jpg`, Panel: `${T}/panel.jpg`, KnobTop: `${T}/knob_top.jpg`, Drum: `${T}/drum.jpg`,
  KeyFace: `${T}/keys.jpg`, Hose: `${T}/hose.jpg`, ...printTex,
}, grain);
