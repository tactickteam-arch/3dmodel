// LG DFB532FP, free-standing dishwasher with TrueSteam, QuadWash and 14 place settings, Silver.
// Built to LG's size, 600 W x 850 H x 600 D mm (LG India's spec page and the owner's manual MFL70282499), and to LG's own
// gallery for this model. LG's photos are not to scale on both axes, so each is read in millimetres per axis (see
// tex_lg_dfb532.py): the front (DZ-01) gives the strips across the door, the side (DZ-13) the profile and the open side
// (DZ-11) where the door drops to and where the racks ride. Every size LG does not publish is read off those photos and is
// listed in private/research/lg_dfb532/NOTES.md:
//   top cover 814-850 mm, over the whole 600 mm depth; the cabinet's sides from the door's back (48 mm in) to 566 mm, with a
//   notch at the back's foot (DZ-13); the door 80-811 mm high, 48 mm thick: the panel strip 756-811 mm, the handle's undercut
//   under it (23 mm deep), the brushed face below; the kick plate under the door.
//   The door drops forward on a hinge 130 mm up at its face: open, its face lies 130 mm up and its inside 178 mm up (DZ-11:
//   134 and 178 mm). The lower rack runs on wheels on rails 200 mm up, in the tub and on the open door; the upper rack's side
//   bars run through rollers on the tub's walls, 580 mm up.
// The racks are wire, each one mesh of round wires (2 mm), merged per rack.
// usage: node make_lg_dfb532.mjs <entry.json> <tex dir> <out.glb>
import { THREE, mat, mesh, box, group, flipV, inward, stateClips, exportGLB, productParts, saveZones, frontWithHoles } from "./lib.mjs";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import fs from "node:fs";

const [PRODUCTS, TEX, OUT] = process.argv.slice(2);
const ID = "lg-dfb532fp";
const T = `${TEX}/lg_dfb532`;

// ── size (metres); z runs front (+) to back (-) ──
const W = 0.6, H = 0.85, D = 0.6;
const zF = D / 2;                          // the door's and the top cover's front
const zDoorBack = 0.2517;                  // the door's inside face (DZ-13: 48 mm thick)
const zBack = -0.2656;                     // the cabinet's back (DZ-13 x 1116); the top cover overhangs it to -0.2996
const xS = 0.2995;                         // the cabinet's sides
const yCover = 0.8138;                     // the top cover's underside (DZ-13: 36 mm thick)
const yDoor0 = 0.080, yDoor1 = 0.8114;     // the door's bottom and top (DZ-01)
const yBand0 = 0.7558;                     // the panel strip's bottom (DZ-01 y 172)
const yFace1 = 0.7095;                     // the brushed face's top, under the handle's undercut (DZ-01 y 222.5)
const yKick = 0.0717;                      // the kick plate's visible top (DZ-01 y 916.5)
const PIV = [0.130, zF - 0.0005];          // the door's hinge axis: height, z (DZ-11: the open door's face 134 mm up)
const NOTCH = { z: -0.210, y: 0.0857 };    // the notch at the back's foot (DZ-13)
// the tub (ESTIMATED from DZ-02 / DZ-07 / DZ-11): walls 524 mm apart, floor 165 mm, ceiling 790 mm, back 245 mm behind the centre
const TUB = { x: 0.262, y0: 0.165, y1: 0.79, zb: -0.245 };
const RAIL_Y = 0.200;                      // the lower rack's rails (tub and door)
const UP = { y: 0.537, roll: 0.58 };       // the upper rack's floor and its rollers (DZ-11: 537 and 550-570 mm)

// ── materials ──
// Silver: brushed steel, its light bands baked in LG's photo; hairline grain across (DZ-01/DZ-04 show the lines run across)
const doorFaceM = mat("DoorFront", 0xffffff, { metal: 0.38, rough: 0.5 });
const bandM = mat("PanelBand", 0xffffff, { metal: 0.38, rough: 0.5 });
const recessM = mat("HandleRecess", 0xffffff, { metal: 0.2, rough: 0.55 });
const steelM = mat("DoorSteel", 0xa9aaad, { metal: 0.45, rough: 0.42 });        // the door's edges and slab
const doorTopM = mat("DoorTop", 0xffffff, { metal: 0.3, rough: 0.5 });
const sideM = mat("Side", 0xffffff, { rough: 0.5, metal: 0.15 });
const backM = mat("BackPanel", 0xffffff, { rough: 0.7 });
const coverTopM = mat("CoverTop", 0xb7b8ba, { metal: 0.3, rough: 0.45 });       // DZ-04: the top's light silver
const coverFrontM = mat("CoverFront", 0xffffff, { metal: 0.3, rough: 0.45 });
const coverSideM = mat("CoverSide", 0xffffff, { metal: 0.3, rough: 0.45 });
const coverBackM = mat("CoverBack", 0xffffff, { metal: 0.3, rough: 0.45 });
const kickM = mat("Kick", 0xffffff, { metal: 0.3, rough: 0.5 });
const frameM = mat("Frame", 0x9fa0a3, { metal: 0.45, rough: 0.4 });
const gasketM = mat("Gasket", 0x151517, { rough: 0.8 });
const darkM = mat("Bay", 0x0e0e10, { rough: 0.9 });
const tubM = mat("Tub", 0xb8babd, { metal: 0.9, rough: 0.2 });                  // stainless tub (DZ-02)
const innerM = mat("DoorInner", 0xffffff, { metal: 0.5, rough: 0.35 });
const nozzleM = mat("NozzlePlate", 0xffffff, { metal: 0.4, rough: 0.35 });
const wireM = mat("RackWire", 0x8a8d92, { metal: 0.2, rough: 0.45 });             // grey coated wire (DZ-02 / DZ-07)
const greyM = mat("RackGrey", 0x7b7e83, { rough: 0.5 });                         // the grey plastic parts
const barM = mat("RackBar", 0xffffff, { rough: 0.5 });
const basketM = mat("Basket", 0xffffff, { rough: 0.55 });
const wheelM = mat("Wheel", 0x8e9196, { rough: 0.45 });
const armM = mat("SprayArm", 0x4d4f53, { rough: 0.45 });
const ductM = mat("Duct", 0x2c2d30, { rough: 0.5 });
const printL = mat("Print_l", 0xffffff, { metal: 0.38, rough: 0.5, opacity: 0.999 });
const printR = mat("Print_r", 0xffffff, { metal: 0.38, rough: 0.5, opacity: 0.999 });
const topThinq = mat("TopThinQ", 0xffffff, { rough: 0.5, opacity: 0.999 });
const topBadge = mat("TopBadge", 0xffffff, { rough: 0.5, opacity: 0.999 });

const root = group("LG_DFB532FP");
const cab = group("Cabinet");
root.add(cab);

// a flat picture facing +z (or turned), its image the right way up (glTF counts v from the top)
const pic = (name, w, h, m, x, y, z) => mesh(name, flipV(new THREE.PlaneGeometry(w, h)), m, x, y, z);

// ── top cover: the whole width and depth; photo strips on its front, back and sides ──
{
  const d = zF - (-0.2996), zc = (zF + -0.2996) / 2, h = H - yCover;
  cab.add(mesh("TopCover", flipV(new THREE.BoxGeometry(W, h, d)), [coverSideM, coverSideM, coverTopM, darkM, coverFrontM, coverBackM], 0, yCover + h / 2, zc));
}

// ── sides: the photo of DZ-13 on a plane cut round the notch at the back's foot; the left side gets it mirrored ──
function sidePlane(name, sx) {
  const s = new THREE.Shape();
  s.moveTo(zDoorBack, 0); s.lineTo(NOTCH.z, 0); s.lineTo(NOTCH.z, NOTCH.y); s.lineTo(zBack, NOTCH.y); s.lineTo(zBack, yCover); s.lineTo(zDoorBack, yCover); s.lineTo(zDoorBack, 0);
  const g = new THREE.ShapeGeometry(s);
  const pos = g.attributes.position, uv = g.attributes.uv;
  const P = [];
  for (let i = 0; i < pos.count; i++) {
    const zz = pos.getX(i), y = pos.getY(i);
    uv.setXY(i, (zDoorBack - zz) / (zDoorBack - zBack), (yCover - y) / yCover);
    P.push([zz, y]);
  }
  // the shape is drawn in (z, y): lay it on the side, facing out
  for (let i = 0; i < pos.count; i++) pos.setXYZ(i, sx, P[i][1], P[i][0]);
  g.computeVertexNormals();
  if (sx > 0) { inward(g); }                // ShapeGeometry faces +z of its plane; on x = +side it must face +x
  const nn = g.attributes.normal;
  for (let i = 0; i < nn.count; i++) nn.setXYZ(i, Math.sign(sx), 0, 0);
  return mesh(name, g, sideM);
}
cab.add(sidePlane("SideRight", xS), sidePlane("SideLeft", -xS));

// ── back: DZ-14 above the notch, its foot under it; the notch's ceiling ──
{
  const hb = 0.816;                          // back.jpg's height (from the top cover's underside to the floor)
  const g = flipV(new THREE.PlaneGeometry(2 * xS, yCover - NOTCH.y));
  const uv = g.attributes.uv;
  for (let i = 0; i < uv.count; i++) uv.setY(i, uv.getY(i) * ((yCover - NOTCH.y) / hb));
  const b = mesh("Back", g, backM, 0, (yCover + NOTCH.y) / 2, zBack);
  b.rotation.y = Math.PI;
  cab.add(b);
  const g2 = flipV(new THREE.PlaneGeometry(2 * xS, NOTCH.y));
  const uv2 = g2.attributes.uv;
  for (let i = 0; i < uv2.count; i++) uv2.setY(i, (yCover - NOTCH.y) / hb + uv2.getY(i) * (NOTCH.y / hb));
  const b2 = mesh("BackFoot", g2, backM, 0, NOTCH.y / 2, NOTCH.z);
  b2.rotation.y = Math.PI;
  cab.add(b2);
  const c = mesh("NotchCeiling", new THREE.PlaneGeometry(2 * xS, NOTCH.z - zBack), darkM, 0, NOTCH.y, (NOTCH.z + zBack) / 2);
  c.rotation.x = Math.PI / 2;
  cab.add(c);
  // the cabinet's floor (seen only from below)
  const f = mesh("Underside", new THREE.PlaneGeometry(2 * xS, zDoorBack - NOTCH.z), darkM, 0, 0.003, (zDoorBack + NOTCH.z) / 2);
  f.rotation.x = Math.PI / 2;
  cab.add(f);
}

// ── kick plate under the door (DZ-01 y 916-994; DZ-13: 9 mm behind the door's face) and the dark bay behind the hinge ──
{
  const zk = zF - 0.009;
  // full width, so its sides meet the side panels' front edges with no slit (24 Nov leak check)
  cab.add(box("KickBox", 2 * xS, yKick + 0.003 - 0.003, zk - zDoorBack, steelM, 0, (yKick + 0.003) / 2 + 0.0015, (zk + zDoorBack) / 2));
  cab.add(pic("KickFace", 2 * xS - 0.002, yKick, kickM, 0, yKick / 2 + 0.001, zk + 0.001));
  // the bay the door's foot swings into: dark, closed, so an open door shows no daylight under its hinge
  const by0 = yKick + 0.0015, by1 = 0.145;
  cab.add(mesh("HingeBay", inward(new THREE.BoxGeometry(2 * xS - 0.006, by1 - by0, zDoorBack - 0.0015 - 0.205)), darkM, 0, (by0 + by1) / 2, (zDoorBack - 0.0015 + 0.205) / 2));
}

// ── the cabinet's front round the tub's mouth, and the gasket ──
{
  const fw = 2 * xS, y0 = 0.14, fh = yCover - y0;
  const s = new THREE.Shape();
  s.moveTo(-fw / 2, 0); s.lineTo(fw / 2, 0); s.lineTo(fw / 2, fh); s.lineTo(-fw / 2, fh); s.lineTo(-fw / 2, 0);
  const hole = new THREE.Path();
  hole.moveTo(-TUB.x, TUB.y0 - y0); hole.lineTo(-TUB.x, TUB.y1 - y0); hole.lineTo(TUB.x, TUB.y1 - y0); hole.lineTo(TUB.x, TUB.y0 - y0); hole.lineTo(-TUB.x, TUB.y0 - y0);
  s.holes.push(hole);
  const g = new THREE.ExtrudeGeometry(s, { depth: 0.01, bevelEnabled: false });
  const fr = mesh("FrontFrame", g, frameM, 0, y0, zDoorBack - 0.0127);
  cab.add(fr);
  const s2 = new THREE.Shape();
  const gx = TUB.x + 0.012, gy0 = TUB.y0 - 0.012, gy1 = TUB.y1 + 0.012;
  s2.moveTo(-gx, gy0); s2.lineTo(gx, gy0); s2.lineTo(gx, gy1); s2.lineTo(-gx, gy1); s2.lineTo(-gx, gy0);
  const h2 = new THREE.Path();
  h2.moveTo(-TUB.x, TUB.y0); h2.lineTo(-TUB.x, TUB.y1); h2.lineTo(TUB.x, TUB.y1); h2.lineTo(TUB.x, TUB.y0); h2.lineTo(-TUB.x, TUB.y0);
  s2.holes.push(h2);
  cab.add(mesh("Gasket", new THREE.ExtrudeGeometry(s2, { depth: 0.004, bevelEnabled: false }), gasketM, 0, 0, zDoorBack - 0.0055));   // 246.2-250.2 mm, the frame 239-249
}

// ── the tub: five stainless walls seen from inside ──
{
  const zf = zDoorBack - 0.0015, d = zf - TUB.zb, zc = (zf + TUB.zb) / 2, w = 2 * TUB.x, h = TUB.y1 - TUB.y0, yc = (TUB.y0 + TUB.y1) / 2;
  const fl = mesh("TubFloor", new THREE.PlaneGeometry(w, d), tubM, 0, TUB.y0, zc); fl.rotation.x = -Math.PI / 2; cab.add(fl);
  const ce = mesh("TubCeiling", new THREE.PlaneGeometry(w, d), tubM, 0, TUB.y1, zc); ce.rotation.x = Math.PI / 2; cab.add(ce);
  cab.add(mesh("TubBack", new THREE.PlaneGeometry(w, h), tubM, 0, yc, TUB.zb));
  const l = mesh("TubLeft", new THREE.PlaneGeometry(d, h), tubM, -TUB.x, yc, zc); l.rotation.y = Math.PI / 2; cab.add(l);
  const r = mesh("TubRight", new THREE.PlaneGeometry(d, h), tubM, TUB.x, yc, zc); r.rotation.y = -Math.PI / 2; cab.add(r);
  // the lower rack's rails along the walls; the upper rack's rollers (two a side)
  for (const sx of [-1, 1]) {
    cab.add(box("LowerRail", 0.012, 0.008, d - 0.01, frameM, sx * (TUB.x - 0.006), RAIL_Y - 0.004, zc));
    for (const z of [0.2, 0.1]) {
      const rl = mesh("Roller", new THREE.CylinderGeometry(0.011, 0.011, 0.01, 16), greyM, sx * (TUB.x - 0.005), UP.roll - 0.019, z);
      rl.rotation.z = Math.PI / 2; cab.add(rl);
    }
  }
  // the duct up the back wall to the top wash impeller (DZ-02: dark grey, centred), the impeller at the ceiling
  cab.add(box("Duct", 0.05, 0.5, 0.009, ductM, 0, 0.5, TUB.zb + 0.0047));
  const imp = mesh("TopImpeller", new THREE.CylinderGeometry(0.03, 0.03, 0.012, 24), ductM, 0, TUB.y1 - 0.007, -0.06);
  cab.add(imp);
  // the lower spray arm and the filter in the sump (DZ-02); the steam nozzle plate at the tub's front foot
  cab.add(mesh("Filter", new THREE.CylinderGeometry(0.045, 0.045, 0.01, 32), armM, 0, TUB.y0 + 0.005, 0.03));
  const arm = box("LowerArm", 0.42, 0.012, 0.035, armM, 0, TUB.y0 + 0.024, -0.02);
  arm.rotation.y = 0.35; cab.add(arm);
  cab.add(mesh("LowerArmHub", new THREE.CylinderGeometry(0.02, 0.02, 0.02, 24), armM, 0, TUB.y0 + 0.015, -0.02));
  cab.add(pic("Nozzles", 0.431, 0.06, nozzleM, 0, TUB.y0 + 0.031, zDoorBack - 0.007));
}

// ── wire: round wires merged into one mesh per rack ──
function wires(list, r = 0.0011) {
  const geos = [];
  const up = new THREE.Vector3(0, 1, 0);
  for (const [a, b] of list) {
    const A = new THREE.Vector3(...a), B = new THREE.Vector3(...b), L = A.distanceTo(B);
    if (L < 1e-4) continue;
    const g = new THREE.CylinderGeometry(r, r, L, 6, 1, true);
    const q = new THREE.Quaternion().setFromUnitVectors(up, B.clone().sub(A).normalize());
    g.applyQuaternion(q);
    const m = A.clone().add(B).multiplyScalar(0.5);
    g.translate(m.x, m.y, m.z);
    geos.push(g);
  }
  return mergeGeometries(geos);
}
const rect = (w, d, y, out) => {
  const x = w / 2, z = d / 2;
  out.push([[-x, y, -z], [x, y, -z]], [[x, y, -z], [x, y, z]], [[x, y, z], [-x, y, z]], [[-x, y, z], [-x, y, -z]]);
};
function basketWires(w, d, h, pitch, out) {
  rect(w, d, 0, out);
  for (let x = -w / 2 + pitch; x < w / 2 - 1e-3; x += pitch) out.push([[x, 0, -d / 2], [x, 0, d / 2]]);
  for (let z = -d / 2 + 0.04; z < d / 2 - 1e-3; z += 0.04) out.push([[-w / 2, 0, z], [w / 2, 0, z]]);
  for (const y of [h * 0.35, h * 0.7, h]) rect(w, d, y, out);
  for (let x = -w / 2; x <= w / 2 + 1e-3; x += pitch) for (const z of [-d / 2, d / 2]) out.push([[x, 0, z], [x, h, z]]);
  for (let z = -d / 2 + pitch; z < d / 2 - 1e-3; z += pitch) for (const x of [-w / 2, w / 2]) out.push([[x, 0, z], [x, h, z]]);
}
function wheels(name, xs, zs, y, r, m) {
  const gs = [];
  for (const x of xs) for (const z of zs) {
    const g = new THREE.CylinderGeometry(r, r, 0.009, 18);
    g.rotateZ(Math.PI / 2);
    g.translate(x, y, z);
    gs.push(g);
  }
  return mesh(name, mergeGeometries(gs), m);
}

// ── lower rack: 490 x 470 mm, 130 mm high; plate tines in four rows; the cutlery basket at the front, in the middle ──
const LR = { w: 0.49, d: 0.47, h: 0.13, wr: 0.015 };
const lower = group("LowerRack", 0, RAIL_Y + 2 * LR.wr + 0.007, -0.003);
{
  const L = [];
  basketWires(LR.w, LR.d, LR.h, 0.025, L);
  for (const x of [-0.17, -0.09, 0.09, 0.17]) {
    for (let z = -LR.d / 2 + 0.03; z < LR.d / 2 - 0.02; z += 0.025) {
      if (Math.abs(x) < 0.1 && z > 0.03) continue;              // the basket's place
      L.push([[x, 0, z], [x + Math.sign(x) * 0.012, 0.11, z]]);
    }
  }
  lower.add(mesh("LowerWire", wires(L), wireM));
  lower.add(wheels("LowerWheels", [-(TUB.x - 0.007), TUB.x - 0.007], [-0.18, -0.06, 0.06, 0.18], -LR.wr - 0.007, LR.wr, wheelM));
  // axles from the rack's side to each wheel
  const ax = [];
  for (const sx of [-1, 1]) for (const z of [-0.18, -0.06, 0.06, 0.18]) ax.push([[sx * LR.w / 2, 0, z], [sx * (TUB.x - 0.007), -LR.wr - 0.007, z]]);
  lower.add(mesh("LowerAxles", wires(ax, 0.0015), wireM));
  // the cutlery basket (DZ-02: 145 x 150 mm, grey grid; its front is the photo)
  const bk = mesh("CutleryBasket", flipV(new THREE.BoxGeometry(0.145, 0.15, 0.11)), [basketM, basketM, greyM, greyM, basketM, basketM], 0, 0.076, LR.d / 2 - 0.062);
  lower.add(bk);
  const hd = box("BasketHandle", 0.012, 0.05, 0.08, greyM, 0, 0.17, LR.d / 2 - 0.062);
  lower.add(hd);
}
cab.add(lower);

// ── upper rack: 500 x 460 mm, its floor 537 mm up; the grey handle bar with LG's mark at the front; side bars that run
// through the rollers; the upper spray arm under it (it travels with the rack) ──
const UR = { w: 0.49, d: 0.455, h: 0.115 };
const upper = group("UpperRack", 0, UP.y, -0.006);
{
  const L = [];
  basketWires(UR.w, UR.d, UR.h, 0.025, L);
  for (const x of [-0.16, -0.06, 0.06, 0.16]) for (let z = -UR.d / 2 + 0.03; z < UR.d / 2 - 0.02; z += 0.03) L.push([[x, 0, z], [x, 0.07, z - 0.01]]);
  // the cup shelves at both sides, 70 mm up
  for (const sx of [-1, 1]) for (let i = 0; i < 4; i++) L.push([[sx * (0.17 + i * 0.015), 0.07, -UR.d / 2 + 0.02], [sx * (0.17 + i * 0.015), 0.07, UR.d / 2 - 0.02]]);
  upper.add(mesh("UpperWire", wires(L), wireM));
  // side bars in the rollers (a channel the rollers run in, 15 mm high)
  for (const sx of [-1, 1]) upper.add(box("UpperSideBar", 0.006, 0.016, UR.d, greyM, sx * (TUB.x - 0.005), UP.roll - UP.y, 0));
  for (const sx of [-1, 1]) {
    const br = [[[sx * UR.w / 2, UR.h * 0.7, -0.15], [sx * (TUB.x - 0.008), UP.roll - UP.y, -0.15]], [[sx * UR.w / 2, UR.h * 0.7, 0.15], [sx * (TUB.x - 0.008), UP.roll - UP.y, 0.15]]];
    upper.add(mesh("UpperBracket", wires(br, 0.002), greyM));
  }
  const bar = mesh("RackBar", flipV(new THREE.BoxGeometry(0.474, 0.047, 0.012)), [greyM, greyM, greyM, greyM, barM, greyM], 0, UR.h - 0.01, UR.d / 2 + 0.003);
  upper.add(bar);
  const arm = box("UpperArm", 0.36, 0.01, 0.03, armM, 0, -0.022, -0.02);
  arm.rotation.y = -0.4;
  upper.add(arm);
  upper.add(mesh("UpperArmHub", new THREE.CylinderGeometry(0.018, 0.018, 0.022, 24), armM, 0, -0.011, -0.02));
}
cab.add(upper);

// ── the door: hinged at its foot, it drops forward; the slab's side profile has the handle's undercut ──
const door = group("Door", 0, PIV[0], PIV[1]);
{
  const toL = (o) => { o.position.y -= PIV[0]; o.position.z -= PIV[1]; return o; };
  // the slab's side profile in (z, y): the strip's face, the handle's undercut under it (DZ-13: 23 mm deep, 714-756 mm;
  // drawn square, its shading is in the photo), the brushed face
  const UC0 = 0.714, UCD = 0.023;
  const p = new THREE.Shape();
  const zf = zF - 0.0005;
  p.moveTo(zDoorBack, yDoor0); p.lineTo(zf, yDoor0); p.lineTo(zf, UC0); p.lineTo(zF - UCD, UC0); p.lineTo(zF - UCD, yBand0);
  p.lineTo(zF, yBand0); p.lineTo(zF, yDoor1); p.lineTo(zDoorBack, yDoor1); p.lineTo(zDoorBack, yDoor0);
  const g = new THREE.ExtrudeGeometry(p, { depth: 0.598, bevelEnabled: false });
  // the shape's (x, y) is (z, y) and the extrusion runs along x: swap x and z (a mirror, so turn the faces back out)
  const pos = g.attributes.position;
  for (let i = 0; i < pos.count; i++) { const X = pos.getX(i), Z = pos.getZ(i); pos.setXYZ(i, Z - 0.299, pos.getY(i), X); }
  // ExtrudeGeometry has no index, and inward() turns only an index round: give it one first (24 Nov: without it the
  // slab was inside out and its side showed its own floor through it)
  g.setIndex([...Array(pos.count).keys()]);
  inward(g);
  g.computeVertexNormals();
  door.add(toL(mesh("DoorSlab", g, steelM)));
  // photos on the front: the strip (print painted out), the undercut, the brushed face
  door.add(toL(pic("PanelBand", 0.598, yDoor1 - yBand0, bandM, 0, (yDoor1 + yBand0) / 2, zF + 0.0009)));
  const rec = pic("HandleRecess", 0.598, yBand0 - UC0, recessM, 0, (yBand0 + UC0) / 2, zF - UCD + 0.0009);
  door.add(toL(rec));
  door.add(toL(pic("DoorFront", 0.598, yFace1 - yDoor0, doorFaceM, 0, (yFace1 + yDoor0) / 2, zf + 0.0009)));
  // the print over the strip: two transparent halves, 12 px/mm (tex_lg_dfb532.py panel())
  const pp = JSON.parse(fs.readFileSync(`${T}/panel_print.json`, "utf8"));
  for (const [k, m] of [["l", printL], ["r", printR]]) {
    const q = pp[k], w = q.w_mm / 1000, h = q.h_mm / 1000;
    const x = -0.3 + q.x_mm / 1000 + w / 2, y = yDoor1 - q.y_mm / 1000 - h / 2;
    door.add(toL(pic(`PanelPrint_${k}`, w, h, m, x, y, zF + 0.0018)));
  }
  // the top edge (seen with the door down): DZ-04's photo, ThinQ and the badge over it
  const top = pic("DoorTopEdge", 0.598, zF - zDoorBack, doorTopM, 0, yDoor1 + 0.0009, (zF + zDoorBack) / 2);
  top.rotation.x = -Math.PI / 2;
  door.add(toL(top));
  const tp = JSON.parse(fs.readFileSync(`${T}/top_print.json`, "utf8"));
  for (const [k, m] of [["thinq", topThinq], ["badge", topBadge]]) {
    const q = tp[k], w = q.w_mm / 1000, h = q.h_mm / 1000;
    const x = -0.3 + q.x_mm / 1000 + w / 2, z = zDoorBack + q.y_mm / 1000 + h / 2;
    const d = pic(`TopPrint_${k}`, w, h, m, x, yDoor1 + 0.0018, z);
    d.rotation.x = -Math.PI / 2;
    door.add(toL(d));
  }
  // the inside: DZ-02 rectified, facing the tub; the rails the lower rack's wheels run on when the door is down
  const inn = pic("DoorInnerFace", 0.598, yDoor1 - yDoor0 - 0.002, innerM, 0, (yDoor1 + yDoor0) / 2, zDoorBack - 0.0009);
  inn.rotation.y = Math.PI;
  inn.rotation.z = Math.PI;                  // the photo's top (the door's top edge) at the door's top
  door.add(toL(inn));
  const railH = RAIL_Y - (PIV[0] + (PIV[1] - zDoorBack));   // the rails' height over the inside face when the door is down
  for (const sx of [-1, 1]) door.add(toL(box("DoorRail", 0.01, yDoor1 - 0.18 - 0.01, railH, frameM, sx * (TUB.x - 0.007), (yDoor1 + 0.18) / 2, zDoorBack - railH / 2 - 0.0005)));
}
root.add(door);

const parts = productParts(PRODUCTS, ID);
const clips = stateClips(root, parts);
saveZones(PRODUCTS, ID, root, parts);
await exportGLB(root, clips, OUT, {
  DoorFront: `${T}/door_front.jpg`, PanelBand: `${T}/band.jpg`, HandleRecess: `${T}/recess.jpg`, DoorTop: `${T}/door_top.jpg`,
  Side: `${T}/side.jpg`, BackPanel: `${T}/back.jpg`, CoverFront: `${T}/cover_front.jpg`, CoverSide: `${T}/cover_side.jpg`,
  CoverBack: `${T}/cover_back.jpg`, Kick: `${T}/kick.jpg`, DoorInner: `${T}/door_inner.jpg`, NozzlePlate: `${T}/nozzles.jpg`,
  RackBar: `${T}/rack_bar.jpg`, Basket: `${T}/basket.jpg`, Print_l: `${T}/print_l.png`, Print_r: `${T}/print_r.png`,
  TopThinQ: `${T}/top_thinq.png`, TopBadge: `${T}/top_badge.png`,
}, { dir: `${TEX}/grain`, materials: {
  // Grain: the brushed steel door, strip and slab the soft hairline across; the painted top and sides a soft peel
  DoorFront: { type: "hairline_soft", dir: "h" }, PanelBand: { type: "hairline_soft", dir: "h" }, DoorSteel: { type: "hairline_soft", dir: "h" },
  Print_l: { type: "hairline_soft", dir: "h" }, Print_r: { type: "hairline_soft", dir: "h" },
  CoverTop: { type: "peel_soft" }, Side: { type: "peel_soft" },
} });
