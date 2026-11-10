// Haier HRD-752KSA, 50 L direct-cool single-door "bedroom" refrigerator (a mini bar), Black Steel: the only colour Haier
// sells this model in. Not on Sangeetha. Built from Haier India's own shop page for this code (listing 2351) and its six
// gallery photos (front, two 3/4 views, the back, the door open empty and stocked).
// Size: Haier gives 465 W x 490 D mm. Its page gives the height as 890 mm, which cannot be this 50 L cabinet: Haier's
// own rear and open-door photos put it at 552 +/- 4 mm on the 465 mm width (H/W 1.133 for the cabinet, plus the feet),
// so 554 mm is used (ESTIMATED; the retail listings' 55.4 cm). Every number and how it was got is in the private
// research notes (NOTES.md).
// What it is: a black textured cabinet on four round feet; one door hinged on the right (the open photos), its Black
// Steel face with fine horizontal lines, glossy black caps along its top and foot, a raised corner cap at its free top
// corner matching the hinge cover on the cabinet's other corner, the round lock and key on its left, the Haier mark
// in silver; a raised moulding on the cabinet's top behind the door. Inside (the open photos): the black front frame
// and its white lip, the freezer box at the top right behind its clear FREEZER flap, the control panel with the blue
// knob beside it, the clear drip tray on the glass shelf under the box, the one toughened glass shelf; on the door, the
// grey gasket, the moulded liner, the half rack at the top (hinge side), the full rack at the foot, the lock's catch.
// The back: Haier's rear photo on a plate (the galvanised back with CYCLOPENTANE embossed, the wiring label, the open
// compressor bay with the cord coiled in it as photographed; no plug shows in any photo, so none is drawn).
// Three parts: the door (165 deg: the open photo shows it almost flat with the front), the freezer flap (lifted up by
// its tab, ESTIMATED: no photo shows it open) and the shelf with the drip tray (FridgeTrays).
// usage: node make_haier_hrd752.mjs <entry .json, never products.json> <tex dir> <out.glb>
import fs from "node:fs";
import { mergeGeometries, mergeVertices } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import { THREE, mat, mesh, box, faced, group, flipV, lathe, stateClips, exportGLB, productParts, saveZones, tidyJSON } from "./lib.mjs";
import { Food } from "./food.mjs";

const [PRODUCTS, TEX, OUT] = process.argv.slice(2);
const ID = "haier-hrd-752ksa";
const T = `${TEX}/haier_hrd752`;
const INFO = JSON.parse(fs.readFileSync(`${T}/info.json`, "utf8"));

// ── size (metres) ──
const W = 0.465, H = 0.554, D = 0.490;               // W, D VERIFIED (Haier); H ESTIMATED (Haier's photos)
const zBack = -D / 2;
const zLock = D / 2;                                  // the lock's face is the front-most point
const zFace = zLock - 0.0045;                         // the door's face: the lock stands 4.5 mm proud (ESTIMATED)
const doorT = 0.039;                                  // the door, face to its back (ESTIMATED: the 3/4 views' edge band)
const zDB = zFace - doorT;                            // the door's back, where the gasket meets the cabinet
const zFront = zDB - 0.006;                           // the cabinet's front face (the gasket's 6 mm)
const footH = 0.025;                                  // the cabinet's underside (the open photo: 30 px at 0.826 mm per px)
const cabTop = 0.546;                                 // the cabinet's top; the corner caps rise to 554 (front photo: 8 mm)
const doorBot = 0.028, doorTop = cabTop;              // the door
const xHalf = W / 2;
// inside (the open photo g02_open_empty: rows at 0.826 mm per px from the feet's foot at row 920, columns at 0.789 mm
// per px from the cavity's middle at column 351)
const xIn = 0.1965;                                   // the cavity's walls (columns 102 and 600)
const xFrame = xHalf - 0.023;                         // the black frame's inner edge; the white lip from there to the wall
const floorIn = 0.073, ceil = 0.504;                  // the cavity's floor (row 832) and ceiling (row 310)
const frameTopY = 0.522;                              // the black frame's lower edge at the top (row 288)
const sillTop = floorIn, sillBot = 0.036;             // the white sill under the opening (rows 837-877), the black strip under it
const zIn = zFront - 0.30;                            // the cavity's back (ESTIMATED: 300 mm deep holds 50 L in 393 x 431 mm)
const zF = zFront - 0.115;                            // the freezer box's and the shelf's front: 17 mm behind the door's racks (ESTIMATED)
const fz = { x0: -0.084, x1: 0.118, y0: 0.362, y1: 0.486 };   // the freezer box (columns 245-500, rows 332-482)
const pnX1 = 0.180;                                   // the control panel, x 118-180 (columns 500-578)
const knob = { x: 0.150, y: 0.425 };                  // the knob's middle (column 541.6, row 405.6)
const drip = { x0: -0.080, x1: 0.163, y1: 0.3195 };   // the drip tray (columns 250-557, rows 532-560) on the shelf
const shelfY = 0.296;                                 // the glass shelf's top (row 562); its white rim to 287 (row 572)
// the door (local: x from -pw at its free edge to 0 at the hinge, y from its foot, z from its back to its face)
const pw = W - 0.002, dh = doorTop - doorBot;
const relief = 0.022;                                 // the moulded liner stands 22 mm off the door's back (ESTIMATED)
const pocket = 0.005;                                 // its two pockets' floors, 5 mm off it (ESTIMATED)
const rackD = 0.078;                                  // the racks' depth (ESTIMATED: the stocked photo's cans, 66 mm, fit across)
// the door's inside (the open photo: the door's own rows at 0.82 mm per px from its top, row 252; its columns from the
// hinge, column 612, at 0.85 mm per px), in the cabinet's x and y with the door shut: the liner's raised face, its upper
// pocket on the hinge side round the half rack, its lower pocket the width of the door round the full rack
const LINER = { x0: -0.1915, x1: 0.1915, y0: 0.080, y1: 0.498 };          // inside the opening's lip and sill when shut
const POCKET = { up: { x0: 0.004, x1: 0.188, y0: 0.298, y1: 0.490 },      // columns 660-880, rows 320-555
                 low: { x0: -0.184, x1: 0.188, y0: 0.086, y1: 0.291 } };   // columns 660-1100, rows 570-825
const RACK = {
  top: { y: 0.343, h: 0.036, x0: 0.008, x1: 0.184 },  // the half rack (columns 665-875, rows 455-500), hinge side
  bot: { y: 0.158, h: 0.037, x0: -0.170, x1: 0.1845 }, // the full rack (columns 665-1085, rows 680-725)
};
const CATCH = { x0: -0.1705, x1: -0.1495, y0: 0.333, y1: 0.380 };        // the lock's catch (columns 1060-1085, rows 455-515)
const lockXY = { x: -0.186, y: 0.368 };               // the lock's middle (front photo: column 281.5, a third down the face)
const markXY = { x: 0.004, y: 0.463, w: 0.066 };      // the Haier mark (front photo: columns 552-666)

// ── materials ──
// Black Steel: the face's colour is in its texture (tex_haier_hrd752.py); satin and dark, no clear coat (BUILD_BRIEF:
// dark steel colours read washed out under a coat). Tuned on the gate's renders against Haier's 3/4 photos (REVIEW.md)
const doorFace = mat("DoorFace", 0xffffff, { metal: 0.38, rough: 0.75 });
const trim = mat("BlackTrim", 0x0b0c0e, { metal: 0, rough: 0.28 });            // the door's caps, edges, the corner caps
const sidePaint = mat("SidePaint", 0x3c3e41, { metal: 0, rough: 0.65 });        // the cabinet's embossed black skin (it reads 2.5 times the door's grey in the 3/4 photos)
const frameM = mat("FrontFrame", 0x111214, { rough: 0.5 });
const underM = mat("Underside", 0x1b1c1e, { rough: 0.8 });
const rearM = mat("RearPlate", 0xffffff, { metal: 0, rough: 0.6 });
const backDark = mat("DoorBack", 0x141517, { rough: 0.55 });
const liner = mat("Liner", 0xf1f3f5, { rough: 0.6 });
const linerSide = mat("LinerSide", 0xd9dde2, { rough: 0.65 });                // the moulding's walls, in their own shade (the open photo)
const linerGrey = mat("LinerGrey", 0xd3d7dc, { rough: 0.6 });
const gasketM = mat("Gasket", 0x8f9398, { rough: 0.85 });
const white = mat("WhitePlastic", 0xf5f6f7, { rough: 0.45 });
const panelM = mat("ControlPanel", 0xffffff, { rough: 0.45 });
const frosted = mat("Frosted", 0xdfe6ec, { rough: 0.4, opacity: 0.82 });
const flapM = mat("FlapClear", 0xd3dee7, { rough: 0.12, opacity: 0.38, side: THREE.DoubleSide });
const clear = mat("ClearPlastic", 0xc3d0da, { rough: 0.12, opacity: 0.5, side: THREE.DoubleSide });
const dripM = mat("DripClear", 0xe3ebf0, { rough: 0.1, opacity: 0.3, side: THREE.DoubleSide });
const clearRib = mat("ClearRib", 0xd5e0e8, { rough: 0.3, opacity: 0.92 });
const glass = mat("TemperedGlass", 0xa9cdd6, { rough: 0.05, opacity: 0.55, side: THREE.DoubleSide });
const knobBlue = mat("KnobBlue", 0xa9cdec, { rough: 0.35 });
const chrome = mat("Chrome", 0xc4c7cb, { metal: 1, rough: 0.2 });
const lockM = mat("LockChrome", 0xd6d9dd, { metal: 0.95, rough: 0.18 });         // the polished bezel (Haier's 3/4 photos)
const lockFace = mat("LockFace", 0xb4b8bd, { metal: 0.7, rough: 0.42 });          // the satin plug inside it
const darkM = mat("DarkPlastic", 0x1d1e21, { rough: 0.7 });
const footM = mat("FootRubber", 0x18191b, { rough: 0.75 });
const logoM = mat("HaierMark", 0xffffff, { rough: 0.45, opacity: 0.999 });
const flapPrint = mat("Print_freezer", 0xffffff, { rough: 0.4, opacity: 0.999 });

// ── small builders ──
// the swept corner caps on the top (the front photo: each corner rises 8 mm, held flat for 12 mm, then sweeps down
// into the top over 70 mm): a profile in x and y, from the corner (x 0) inward (sign +1 to +x, -1 to -x), from
// y0 under the top to the top's line, extruded from z0 to z1
function swoop(name, m, sign, y0, z0, z1, x, y) {
  const pts = [[0, y0], [0, 0.008], [0.012, 0.008]];
  for (let i = 1; i <= 10; i++) { const t = i / 10, u = 1 - t; pts.push([u * u * 0.012 + 2 * u * t * 0.022 + t * t * 0.07, u * u * 0.008 + 2 * u * t * 0.0008 + t * t * 0.0006]); }
  pts.push([0.07, y0]);
  const P = pts.map(([a, b]) => new THREE.Vector2(sign * a, b));
  if (sign < 0) P.reverse();
  const g = new THREE.ExtrudeGeometry(new THREE.Shape(P), { depth: z1 - z0, bevelEnabled: false, curveSegments: 1 });
  return mesh(name, g, m, x, y, z0);
}
const cyl = (name, rt, rb, h, m, x, y, z, seg = 24) => mesh(name, new THREE.CylinderGeometry(rt, rb, h, seg), m, x, y, z);
const disc = (name, r, h, m, x, y, z, seg = 32) => { const c = cyl(name, r, r, h, m, x, y, z, seg); c.rotation.x = Math.PI / 2; return c; };
const plane = (name, w, h, m, x, y, z) => mesh(name, flipV(new THREE.PlaneGeometry(w, h)), m, x, y, z);
const rbox = (name, w, h, d, r, m, x, y, z) => mesh(name, mergeVertices(new RoundedBoxGeometry(w, h, d, 2, r)), m, x, y, z);
// a box from its corners
const B = (name, x0, y0, z0, x1, y1, z1, m) => box(name, x1 - x0, y1 - y0, z1 - z0, m, (x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2);
const F = (name, x0, y0, z0, x1, y1, z1, ms) => faced(name, x1 - x0, y1 - y0, z1 - z0, ms, (x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2);

const root = group("HaierHRD752");
const cab = group("Cabinet");
root.add(cab);

// ── the cabinet: sides, top and base in the embossed black skin; the back a plate with Haier's rear photo ──
const zS0 = zBack + 0.004, zS1 = zFront - 0.002;      // the shell, behind the rear plate and the front frame's 2 mm
// materials in face order: +x, -x, +y, -y, +z, -z
// each side one piece from the underside to the top (two pieces meeting on the side drew a line there); the top and
// the base between them, touching (overlapping, their faces lay in the sides' planes)
cab.add(F("SideLeft", -xHalf, footH, zS0, -xIn, cabTop, zS1, [linerSide, sidePaint, sidePaint, underM, frameM, darkM]));
cab.add(F("SideRight", xIn, footH, zS0, xHalf, cabTop, zS1, [sidePaint, linerSide, sidePaint, underM, frameM, darkM]));
cab.add(F("Top", -xIn, ceil, zS0, xIn, cabTop, zS1, [sidePaint, sidePaint, sidePaint, liner, frameM, darkM]));
cab.add(F("Base", -xIn, footH, zS0, xIn, floorIn, zS1, [sidePaint, sidePaint, liner, underM, frameM, darkM]));
cab.add(F("BackWall", -xIn, floorIn, zS0, xIn, ceil, zIn, [liner, liner, liner, liner, liner, darkM]));
// the rear plate: the photo on its back face, black round its edges
{
  const g = flipV(new THREE.BoxGeometry(W, cabTop - footH, 0.004));
  cab.add(mesh("RearPlate", g, [darkM, darkM, darkM, darkM, darkM, rearM], 0, (footH + cabTop) / 2, zBack + 0.002));
}
// the front frame round the opening: black, with the liner's white lip inside it (the open photo: 23-24 mm of black,
// 13 mm of lip at the sides, 18 mm at the top); the white sill under the opening and the black strip under that
{
  const z0 = zS1, z1 = zFront;
  cab.add(B("FrameLeft", -xHalf, sillBot, z0, -xFrame, cabTop, z1, frameM));
  cab.add(B("FrameRight", xFrame, sillBot, z0, xHalf, cabTop, z1, frameM));
  cab.add(B("FrameTop", -xFrame, frameTopY, z0, xFrame, cabTop, z1, frameM));
  cab.add(B("FrameBottom", -xHalf, footH, z0, xHalf, sillBot, z1, frameM));
  cab.add(B("LipLeft", -xFrame, sillTop, z0, -xIn, frameTopY, z1, white));
  cab.add(B("LipRight", xIn, sillTop, z0, xFrame, frameTopY, z1, white));
  cab.add(B("LipTop", -xIn, ceil, z0, xIn, frameTopY, z1, white));
  cab.add(B("Sill", -xFrame, sillBot, z0, xFrame, sillTop, z1, white));
  // the spare hinge's screw cap at the frame's foot on the left (the open photo: column 72, row 875), for turning the door
  cab.add(disc("HingeCapSpare", 0.0042, 0.0015, chrome, -0.220, 0.0305, zFront + 0.0007, 20));
}
// the raised moulding on the top behind the door (front photo: 140 mm across, 5 mm over the door's top; its depth from
// the 3/4 views, ESTIMATED), and the hinge cover on the top's right front corner (open photo: 12 mm over the top at
// columns 610-656; front photo: the same as the door's own corner cap on the left)
cab.add(rbox("TopRidge", 0.14, 0.0075, 0.04, 0.0025, trim, 0, cabTop + 0.0055 - 0.0075 / 2 + 0.002, zFront - 0.025));
cab.add(swoop("HingeCoverTop", trim, -1, 0.0005, zFront - 0.03, zFace - 0.0005, xHalf, cabTop));
// the feet: four round black feet on threaded steel stems (the 3/4 views and the open photos), 26 mm across, 28 mm in
// from the sides (front photo); the bottom hinge's chrome plate under the door's right corner, its pin up into the door
for (const sx of [-1, 1]) for (const z of [zFront - 0.025, zBack + 0.03]) {
  cab.add(cyl("Foot", 0.013, 0.0135, 0.019, footM, sx * 0.204, 0.0095, z, 20));
  cab.add(cyl("FootStem", 0.005, 0.005, footH - 0.019 + 0.001, chrome, sx * 0.204, 0.019 + (footH - 0.019) / 2, z, 12));
}
cab.add(B("HingeBottom", xHalf - 0.03, footH - 0.003, zFront - 0.03, xHalf, footH, zFace - 0.004, chrome));
cab.add(cyl("HingePin", 0.003, 0.003, doorBot - footH + 0.004, chrome, xHalf - 0.012, footH + (doorBot - footH + 0.004) / 2 - 0.0005, zDB + 0.012, 12));

// ── inside: the freezer box, its flap, the control panel and knob ──
{
  const zc = (zIn + zF) / 2, d = zF - zIn, t = 0.004;
  cab.add(B("FreezerFloor", fz.x0, fz.y0, zIn, fz.x1, fz.y0 + t, zF, frosted));
  cab.add(B("FreezerLeft", fz.x0, fz.y0 + t, zIn, fz.x0 + t, fz.y1, zF, frosted));
  cab.add(B("FreezerTop", fz.x0 + t, fz.y1 - t, zIn, fz.x1, fz.y1, zF, frosted));
  // hung from the ceiling on the evaporator's white plate
  cab.add(B("FreezerHanger", fz.x0 + 0.01, fz.y1, zIn, pnX1 - 0.01, ceil, zIn + 0.12, linerGrey));
  void zc; void d;
  // the control panel (white, its print the photo with "Temperature Setting" set again), 2 mm proud of the box's front
  const pm = [white, white, white, white, panelM, white];
  const p = F("ControlPanelBox", fz.x1, fz.y0, zIn, pnX1, fz.y1, zF + 0.002, pm);
  flipV(p.geometry);
  cab.add(p);
  // the knob: the white ring and the blue cap (the open photo: 16 and 13.7 mm across their radii)
  cab.add(disc("KnobRing", 0.0158, 0.008, white, knob.x, knob.y, zF + 0.002 + 0.004, 40));
  cab.add(disc("KnobCap", 0.0137, 0.010, knobBlue, knob.x, knob.y, zF + 0.002 + 0.005, 40));
  cab.add(B("KnobGrip", knob.x - 0.002, knob.y - 0.01, zF + 0.012, knob.x + 0.002, knob.y + 0.01, zF + 0.0145, white));
}
// the flap: clear, across the box's front, FREEZER moulded in it, the white tab at its foot (the open photo: the
// lettering 95 mm wide at row 411, the tab at columns 340-420, rows 450-462). It is the third part, hinged along its top
// and lifted out and up by the tab (ESTIMATED: no photo shows it open; the tab at its foot is where it is pulled)
const flap = group("FreezerFlap");
cab.add(flap);
{
  const x0 = fz.x0 + 0.002, x1 = fz.x1 - 0.002, y0 = fz.y0 + 0.002, y1 = fz.y1 - 0.002;
  flap.add(B("FlapClear", x0, y0, zF - 0.004, x1, y1, zF, flapM));
  // its frosted frame (the open photo: a light rim round the clear face)
  flap.add(B("FlapRim", x0, y1 - 0.006, zF - 0.004, x1, y1, zF + 0.002, frosted));
  flap.add(B("FlapRimFoot", x0, y0, zF - 0.004, x1, y0 + 0.005, zF + 0.002, frosted));
  flap.add(B("FlapRimL", x0, y0 + 0.005, zF - 0.004, x0 + 0.005, y1 - 0.006, zF + 0.002, frosted));
  flap.add(B("FlapRimR", x1 - 0.005, y0 + 0.005, zF - 0.004, x1, y1 - 0.006, zF + 0.002, frosted));
  const fw = INFO.flap.mm[0] / 1000 * INFO.flap.padded[0] / (INFO.flap.padded[0] - 20), fh = fw * INFO.flap.padded[1] / INFO.flap.padded[0];
  flap.add(plane("PrintFreezer", fw, fh, flapPrint, 0.019, 0.420, zF + 0.0008));
  flap.add(rbox("FlapTab", 0.062, 0.01, 0.008, 0.002, white, 0.023, 0.383, zF + 0.002));
  // the hinge along its top edge
  const pivot = new THREE.Vector3(0, y1, zF - 0.002);
  for (const c of flap.children) c.position.sub(pivot);
  flap.position.copy(pivot);
}

// ── what comes out (FridgeTrays): the glass shelf with its white front rim, and the drip tray on it ──
const trays = group("FridgeTrays");
cab.add(trays);
const shX = xIn - 0.004;
trays.add(B("ShelfGlass", -shX, shelfY - 0.005, zIn + 0.004, shX, shelfY, zF - 0.01, glass));
trays.add(B("ShelfRim", -shX, shelfY - 0.009, zF - 0.012, shX, shelfY + 0.0005, zF, white));
trays.add(B("ShelfRimBack", -shX, shelfY - 0.006, zIn + 0.002, shX, shelfY, zIn + 0.012, white));
for (const sx of [-1, 1]) cab.add(B("ShelfRail", sx > 0 ? xIn - 0.006 : -xIn, shelfY - 0.012, zIn, sx > 0 ? xIn : -xIn + 0.006, shelfY - 0.005, zF, linerGrey));
{
  const y0 = shelfY + 0.0005, y1 = drip.y1, z0 = zIn + 0.012, z1 = zF - 0.014, t = 0.003;
  trays.add(B("DripFloor", drip.x0, y0, z0, drip.x1, y0 + t, z1, dripM));
  trays.add(B("DripFront", drip.x0, y0, z1 - t, drip.x1, y1, z1, dripM));
  trays.add(B("DripBack", drip.x0, y0, z0, drip.x1, y1, z0 + t, dripM));
  trays.add(B("DripL", drip.x0, y0, z0, drip.x0 + t, y1, z1, dripM));
  trays.add(B("DripR", drip.x1 - t, y0, z0, drip.x1, y1, z1, dripM));
  trays.add(B("DripRim", drip.x0 - 0.002, y1 - 0.003, z1 - 0.004, drip.x1 + 0.002, y1, z1 + 0.001, clearRib));
}

// ── the door: hinged on the right ──
const fridgeDoor = group("FridgeDoor", xHalf - 0.001, doorBot, zDB);
root.add(fridgeDoor);
{
  const L = -pw, R = 0, capH = 0.016, footS = 0.008;
  // the body: the Black Steel face between the top cap and the foot strip, glossy black edges, a dark back
  const body = F("DoorBody", L, footS, 0.002, R, dh - capH, doorT, [trim, trim, trim, trim, doorFace, backDark]);
  flipV(body.geometry);
  fridgeDoor.add(body);
  // the top cap (rounded, its front edge catching the light: the front photo's line 5 mm under its top) and the foot strip
  fridgeDoor.add(rbox("DoorTopCap", pw, capH, doorT - 0.002 + 0.0012, 0.004, trim, -pw / 2, dh - capH / 2, (doorT + 0.0012 + 0.002) / 2));
  fridgeDoor.add(rbox("DoorFootStrip", pw, footS, doorT - 0.002 + 0.0006, 0.003, trim, -pw / 2, footS / 2, (doorT + 0.0006 + 0.002) / 2));
  // the corner cap on the free top corner, as the hinge cover on the cabinet's (front photo: both rise 8 mm)
  fridgeDoor.add(swoop("DoorCornerCap", trim, 1, -0.003, 0.003, doorT + 0.0005, L, dh));
  // the Haier mark and the lock
  const lw = markXY.w * INFO.logo.padded[0] / INFO.logo.inner[0], lh = lw * INFO.logo.padded[1] / INFO.logo.padded[0];
  fridgeDoor.add(plane("HaierMarkDecal", lw, lh, logoM, markXY.x - (xHalf - 0.001), markXY.y - doorBot, doorT + 0.0008));
  const lx = lockXY.x - (xHalf - 0.001), ly = lockXY.y - doorBot;
  // the lock (Haier's 3/4 photos): a domed polished bezel 29.6 mm across rising to 4.5 mm, a satin plug sunk 1 mm in
  // it, and the keyway, a slot with a diamond at its middle, sunk into the plug. Its round shape catches the light
  // (a flat disc read as a grey sticker in the Apple render)
  const bezel = lathe("DoorLock", [[0.0148, 0], [0.0147, 0.0012], [0.0143, 0.0026], [0.0136, 0.0037], [0.0127, 0.0044], [0.0118, 0.0045],
    [0.0111, 0.0043], [0.0106, 0.0038], [0.0104, 0.0034]], lockM, 48);
  bezel.position.set(lx, ly, doorT);
  fridgeDoor.add(bezel);
  fridgeDoor.add(disc("LockFace", 0.0105, 0.0035, lockFace, lx, ly, doorT + 0.00175, 40));
  const key = new THREE.Shape([[0, 0.0046], [0.0007, 0.0021], [0.0017, 0.0002], [0.0007, -0.0017], [0.0007, -0.0046], [-0.0007, -0.0046], [-0.0007, -0.0017],
    [-0.0017, 0.0002], [-0.0007, 0.0021]].map(([x, y]) => new THREE.Vector2(x, y)));
  const kw = mesh("LockKeyway", new THREE.ExtrudeGeometry(key, { depth: 0.0006, bevelEnabled: false }), darkM, lx, ly, doorT + 0.0035 - 0.0004);
  fridgeDoor.add(kw);
  // inside: the gasket on all four sides (12 mm in from the edges, 16 mm wide), the moulded liner, the lock's catch
  const gi = 0.012, gw = 0.016, gz0 = -0.006, gz1 = 0;
  fridgeDoor.add(B("GasketTop", L + gi, dh - gi - gw, gz0, R - gi, dh - gi, gz1, gasketM));
  fridgeDoor.add(B("GasketBottom", L + gi, gi, gz0, R - gi, gi + gw, gz1, gasketM));
  fridgeDoor.add(B("GasketLeft", L + gi, gi + gw, gz0, L + gi + gw, dh - gi - gw, gz1, gasketM));
  fridgeDoor.add(B("GasketRight", R - gi - gw, gi + gw, gz0, R - gi, dh - gi - gw, gz1, gasketM));
  fridgeDoor.add(B("DoorLinerFlat", L + gi + gw, gi + gw, -0.002, R - gi - gw, dh - gi - gw, 0, liner));
  // the moulded liner: the pockets' floor over all of it, then the raised face round the two pockets (in the cabinet's
  // x and y, turned to the door's own here)
  const ax = (x) => x - (xHalf - 0.001), ay = (y) => y - doorBot, Lr = LINER, U = POCKET.up, Lo = POCKET.low;
  const side4 = [linerSide, linerSide, linerSide, linerSide, liner, liner];
  fridgeDoor.add(F("DoorLinerPockets", ax(Lr.x0), ay(Lr.y0), -pocket, ax(Lr.x1), ay(Lr.y1), -0.002, side4));
  const raised = (name, x0, y0, x1, y1) => fridgeDoor.add(F(name, ax(x0), ay(y0), -relief, ax(x1), ay(y1), -pocket, side4));
  raised("DoorLinerTop", Lr.x0, U.y1, Lr.x1, Lr.y1);
  raised("DoorLinerMid", Lr.x0, Lo.y1, Lr.x1, U.y0);
  raised("DoorLinerFoot", Lr.x0, Lr.y0, Lr.x1, Lo.y0);
  raised("DoorLinerColumn", Lr.x0, U.y0, U.x0, U.y1);               // the raised part beside the upper pocket (free side)
  raised("DoorLinerEdgeUp", U.x1, U.y0, Lr.x1, U.y1);
  raised("DoorLinerEdgeLowL", Lr.x0, Lo.y0, Lo.x0, Lo.y1);
  raised("DoorLinerEdgeLowR", Lo.x1, Lo.y0, Lr.x1, Lo.y1);
  fridgeDoor.add(B("LockCatch", ax(CATCH.x0), ay(CATCH.y0), -relief - 0.012, ax(CATCH.x1), ay(CATCH.y1), -relief, white));
}
// the racks: clear, open at the top, set in the liner's pockets
function rack(name, r) {
  const x0 = r.x0 - (xHalf - 0.001), x1 = r.x1 - (xHalf - 0.001), y = r.y - doorBot, z1 = -pocket, z0 = -pocket - rackD, t = 0.003;
  const g = group(name);
  g.add(B(name + "Floor", x0, y - t, z0, x1, y, z1, clear));
  g.add(B(name + "Lip", x0, y - t, z0, x1, y + r.h * 0.85, z0 + t, clear));
  g.add(B(name + "EndL", x0, y - t, z0, x0 + t, y + r.h, z1, clear));
  g.add(B(name + "EndR", x1 - t, y - t, z0, x1, y + r.h, z1, clear));
  g.add(B(name + "Rim", x0, y + r.h * 0.85 - 0.006, z0 - 0.004, x1, y + r.h * 0.85, z0, clearRib));
  // the clips that hold it to the liner (the open photos: a white clip at each end, outside it), and the white band
  // round the front of its hinge end (the open photos: about 30 mm wide on each rack)
  for (const [a, b] of [[x0 - 0.002, x0], [x1, x1 + 0.002]]) g.add(B(name + "Clip", a, y + r.h * 0.2, z1 - 0.03, b, y + r.h * 1.3, z1, white));
  g.add(B(name + "Band", x1 - 0.03, y - t, z0 - 0.007, x1 + 0.002, y + r.h * 0.85, z0 - 0.004, white));
  fridgeDoor.add(g);
  return { x0, x1, y, z0, z1 };
}
const rTop = rack("RackTop", RACK.top), rBot = rack("RackBottom", RACK.bot);

// ── stock (the stocked photo: two cans in the half rack, bottles in the full rack, a little on the shelf, fruit on the
// floor, a frozen pack in the freezer box): vegetarian, real Indian brands ──
const BRT = `${TEX}/brands/small`;
const food = Food({ brandDir: BRT });
const brandMats = {};
const brand = (k) => (brandMats[k] ||= mat("br_" + k, 0xffffff, { rough: 0.5 }));
const man = JSON.parse(fs.readFileSync(`${TEX}/brands/manifest.json`, "utf8"));
const sz = (k) => man[k].real_size_mm.map((v) => v / 1000);
const asp = (k) => man[k].aspect;
const arcFor = (w, r) => 2 * Math.asin(Math.min(0.98, w / (2 * r)));
const bbox = (o) => { o.updateWorldMatrix(true, true); return new THREE.Box3().setFromObject(o); };
const face = (o) => { o.rotation.y = Math.PI; return o; };
// rest an item on a surface at height y (in its parent's space, the parent unturned)
const restOn = (o, y) => { const b = bbox(o), p = o.parent.getWorldPosition(new THREE.Vector3()); o.position.y += y - (b.min.y - p.y); };

// the shelf's left end (left of the drip tray): an Amul Taaza carton at the back, Amul Masti buttermilk in front
const shelfStock = group("Shelf1Stock");
trays.add(shelfStock);
// the page's tray test also reads a FreshZoneStock node in the trays; this fridge has no fresh zone, so it holds nothing
trays.add(group("FreshZoneStock"));
{
  const [tw, th, td] = sz("amul_taaza_carton"), [bw, bh, bd] = sz("amul_masti_buttermilk");
  const xl = -shX + 0.012;
  shelfStock.add(food.carton("AmulTaaza", "amul_taaza_carton.jpg", xl + tw / 2 + 0.006, shelfY, zIn + 0.03 + td / 2, 1, { W: tw, H: th, D: td }));
  shelfStock.add(food.carton("MastiButtermilk", "amul_masti_buttermilk.jpg", xl + bw / 2 + 0.012, shelfY, zIn + 0.03 + td + 0.03 + bd / 2, 2, { W: bw, H: bh, D: bd }));
}
// the floor: grapes, an orange, two apples and a lemon (the stocked photo: grapes and an orange)
const floorStock = group("FloorStock");
cab.add(floorStock);
{
  // under the shelf and behind the door's full rack (its front comes 98 mm into the cavity at 155-198 mm up)
  floorStock.add(food.grapes("Grapes", -0.14, floorIn, -0.04, 3));
  floorStock.add(food.lemon("Lemon", -0.15, floorIn, 0.045, 2));
  floorStock.add(food.orange("Orange", -0.05, floorIn, 0.02, 2));
  floorStock.add(food.apple("Apple", 0.05, floorIn, -0.045, 1));
  floorStock.add(food.apple("Apple", 0.142, floorIn, 0.03, 4));
}
// the freezer box: a pack of frozen green peas lying flat
const freezerStock = group("FreezerStock");
cab.add(freezerStock);
{
  const [pw2, ph2] = sz("fresho_green_peas");
  // its 190 mm across the box's 198 mm (turned a quarter), its 120 mm front to back
  const pk = food.sachet("FreshoGreenPeas", "fresho_green_peas.jpg", (fz.x0 + 0.004 + fz.x1) / 2, fz.y0 + 0.004, (zIn + zF - 0.004) / 2, 0, { W: pw2, D: ph2, T: 0.022 });
  pk.rotation.y = Math.PI / 2;
  freezerStock.add(pk);
}
// the door: the half rack two cans; the full rack two juice cartons at the free end (the stocked photo's juice and
// bottles are 70 mm round and more, which pass the raised liner over the pocket only at its depth) and two cans
{
  // each against its rack's front (the rack is 3 mm thick), 1.5 mm off it
  const zAt = (r, rr) => r.z0 + 0.003 + 0.0015 + rr, zc = zAt(rTop, 0.0343);
  const CAN = { coke_label: [0xb82a20, 0.06], fanta_label: [0xe8820e, 0.06], sprite_label: [0x0e9a48, 0.07], thumsup_can: [0x1b2d72, 0.105] };
  const can = (name, key, x, y, z = zc) => face(food.can(name, CAN[key][0], x, y, z, brand(key), arcFor(asp(key) * CAN[key][1], 0.033), CAN[key][1]));
  const xm = (rTop.x0 + rTop.x1) / 2;
  fridgeDoor.add(can("Can", "coke_label", xm - 0.04, rTop.y));
  fridgeDoor.add(can("Can", "fanta_label", xm + 0.04, rTop.y));
  const zb = zAt(rBot, 0.0343);
  fridgeDoor.add(can("Can", "thumsup_can", rBot.x1 - 0.045 - 0.075, rBot.y, zb));
  fridgeDoor.add(can("Can", "sprite_label", rBot.x1 - 0.045, rBot.y, zb));
  for (const [i, k] of ["real_mango", "real_mixed_fruit"].entries()) {
    const [w, h, d] = sz(k);
    fridgeDoor.add(face(food.carton(k === "real_mango" ? "RealMango" : "RealMixedFruit", k + ".jpg", rBot.x0 + 0.003 + 0.004 + w / 2 + i * (w + 0.006), rBot.y, rBot.z0 + 0.003 + 0.0015 + d / 2, i + 1, { W: w, H: h, D: d })));
  }
}

const parts = productParts(PRODUCTS, ID);
const clips = stateClips(root, parts);
saveZones(PRODUCTS, ID, root, parts);
// the bottle-storage callout on the full rack's front, where it is with the door open
{
  const data = JSON.parse(fs.readFileSync(PRODUCTS, "utf8"));
  const e = data.products.find((p) => p.id === ID);
  const p = parts.find((q) => q.key === "fridge");
  const q = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), THREE.MathUtils.degToRad(p.angle));
  const local = new THREE.Vector3((rBot.x0 + rBot.x1) / 2 + 0.06, rBot.y + 0.02, rBot.z0 - 0.004);
  const pos = local.clone().applyQuaternion(q).add(fridgeDoor.position), nrm = new THREE.Vector3(0, 0, -1).applyQuaternion(q);
  const hs = e.hotspots.find((h) => h.title === "Spacious Bottle Storage");
  hs.pos = [pos.x, pos.y, pos.z].map((v) => +v.toFixed(3));
  hs.normal = [nrm.x, nrm.y, nrm.z].map((v) => +v.toFixed(3));
  fs.writeFileSync(PRODUCTS, tidyJSON(data));
}
const textures = {
  DoorFace: `${T}/door.jpg`, RearPlate: `${T}/rear.jpg`, ControlPanel: `${T}/panel.jpg`, HaierMark: `${T}/logo.png`, Print_freezer: `${T}/flap.png`,
  ...food.textures(`${TEX}/food`),
  ...Object.fromEntries(Object.keys(brandMats).map((k) => ["br_" + k, `${BRT}/${k}.jpg`])),
};
{ const used = new Set(); root.traverse((o) => o.isMesh && [].concat(o.material).forEach((m) => used.add(m.name))); for (const k of Object.keys(textures)) if (!used.has(k)) delete textures[k]; }
if (process.env.HRD_SIZES) root.traverse((o) => { if (o.userData?.stock) { const b = bbox(o); console.log(o.name, ...["x", "y", "z"].map((k) => `${k} ${(b.min[k] * 1000).toFixed(0)}..${(b.max[k] * 1000).toFixed(0)}`)); } });
// grain: the Black Steel door's face the soft peel (the 3/4 photos show a smooth satin with no brushed lines; the
// front photo's faint lines across are in its texture), the cabinet's embossed black skin the strong peel (the 3/4
// photos show a pebbled, leather-like emboss); none on the print, decals, glass
await exportGLB(root, clips, OUT, textures, { dir: `${TEX}/grain`, materials: {
  DoorFace: { type: "peel_soft" }, SidePaint: { type: "peel_strong" }, FootRubber: { type: "peel_strong" },
} });
