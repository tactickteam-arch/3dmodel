// Samsung RT80H51C2FHL, 467 L double door with Bespoke AI, Black DOI, and its two sibling colours as material variants:
// EZ Clean Steel (RT80H51C2SHL) and Black Glass (RT80H51C2BHL). The client's list called it "805 L"; Samsung India's
// page for this exact code sells it as 467 L (freezer 107 L, fridge 360 L), and that is what is built (NOTES.md).
// Built to Samsung India's published size for this code, 700 W x 1820 H x 794 D mm (all three colours' pages), and to
// Samsung's photos of it: freezer on top, fridge below, both doors hinged on the right with recessed handles in the left
// edge, a silver strip with the SAMSUNG wordmark across the top of the fridge door, each code's own BEE label on its
// freezer door. It is the RT45HG6A22SLHL's family (RT6300D, the same manual) at a larger size, so the builder is that
// one's, measured again on this model's photos: the doors, the inside heights and the rear all come from this code's
// own gallery (NOTES.md).
// Inside, as the open-door photos and the manual's "Refrigerator at a glance" show them: in the freezer a plastic shelf
// and the Movable (twist) Ice Maker at the front left; in the fridge the Fresh Room tray, three tempered-glass shelves,
// the Active Fresh Filter+ unit on the back wall between the second and third shelves, the vegetable shelf (the cover of
// the Big Box) and the Big Box drawer; two bins on the freezer door, and on the fridge door a top bin, the twin egg bin
// and the bottle bin. The manual (Handle and care) says the shelves lift out, the vegetable shelf lifts out and the
// vegetable drawer slides out, so those are one part (FridgeTrays); the ice tray slides open with its bin (IceMaker).
// On the left side, low at the back, the compressor bay's louvred vent (all three codes' 3/4 photos). Stocked for a south
// Indian kitchen (stock_lg.mjs, fit: true).
// usage: node make_samsung_rt80.mjs <entry .json, never products.json> <tex dir> <out.glb>
import fs from "node:fs";
import { LGStock } from "./stock_lg.mjs";
import { THREE, mat, mesh, box, faced, group, stateClips, exportGLB, productParts, saveZones } from "./lib.mjs";
import { NodeIO } from "@gltf-transform/core";
import { ALL_EXTENSIONS, KHRMaterialsVariants, KHRMaterialsClearcoat } from "@gltf-transform/extensions";

const [PRODUCTS, TEX, OUT] = process.argv.slice(2);
const ID = "samsung-rt80h51c2fhl";
const T = `${TEX}/samsung_rt80`;

// ── size (metres) ──
const W = 0.70, H = 1.82, D = 0.794;                   // Samsung India: 70.00 cm x 1.82 m x 79.40 cm
const doorT = 0.05, Dc = D - doorT;                    // door thickness: the RT45's (ESTIMATED; no side photo straight on)
const zBack = -D / 2, zFront = zBack + Dc;
const wall = 0.03, feet = 0.018, floorTop = 0.077;
// on Samsung's straight-on front (1174 px for the 1820 mm body): the fridge door's bottom edge 37 mm up, the freezer door
// from 1245 mm, a 7 mm gap under it, the silver strip 15 mm (ESTIMATED, NOTES.md)
const doorBottom = 0.037, gap = 0.007;
const yFreezer = 1.245, freezerH = H - yFreezer, fridgeH = yFreezer - gap - doorBottom;
const yDiv = yFreezer - gap / 2;
// heights inside, ESTIMATED from the open-door photo fhl_g_550460087 (front plane, 0.6236 px per mm, floor row 1401):
// the shelf rims' top edges at rows 838 / 941 / 1064, the freezer shelf 414, the mullion 594-644, the Fresh Room's floor
// 752, the vegetable shelf 1170, the Big Box 1175-1343, the cabinet floor 1353 (NOTES.md)
const fzCeil = 1.214, fzFloor = 1.294;                       // the mullion: fridge ceiling and freezer floor
const sFresh = 1.045, s1 = 0.903, s2 = 0.738, s3 = 0.540, sCover = 0.374;
const bbBottom = 0.082, bbTop = 0.360;                        // the Big Box
const fzShelfTop = 1.583;                                     // the freezer's plastic shelf
// door bins, ESTIMATED on the open-door photo (the fridge door reads 0.694 px per mm there): the bottle bin from 340 mm up,
// the twin egg bin from 790 mm, the top bin from 1030 mm; the freezer door's two are the RT45's (the same bins)
const BINS = {
  FridgeDoor: [{ f: 0.34, h: 0.15, d: 0.095 }, { f: 0.79, h: 0.08, d: 0.06, twin: true }, { f: 1.03, h: 0.07, d: 0.10 }],
  FreezerDoor: [{ f: 0.072, h: 0.085, d: 0.085 }, { f: 0.275, h: 0.085, d: 0.075 }],
};
const linerFace = 0.016;                                      // the door liner's face, behind the door's back edge
// with the doors shut the bins reach into the cabinet: everything inside ends 1 cm short of the bin in front of it
const reach = (name) => Math.max(...BINS[name].map((b) => b.d)) + linerFace;
const frontFridge = zFront - reach("FridgeDoor") - 0.01;      // Fresh Room, shelves, vegetable shelf
const frontBigBox = zFront - 0.121;                           // the Big Box (below the bottle bin) ends level with them
const frontFreezer = zFront - reach("FreezerDoor") - 0.01;    // freezer shelf and the ice maker

// ── materials (base colour: Black DOI; the variants at the end swap the doors, their edges and the label) ──
const flipV = (geo) => { const uv = geo.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setY(i, 1 - uv.getY(i)); return geo; };
const body = mat("Body", 0x45474b, { metal: 0.22, rough: 0.5 });
const topSkin = mat("TopSkin", 0x404246, { metal: 0.1, rough: 0.75 });   // the top: painted like the sides (ESTIMATED, no photo shows it)
const freezerFront = mat("FreezerFront", 0xffffff, { metal: 0.15, rough: 0.35 });
const fridgeFront = mat("FridgeFront", 0xffffff, { metal: 0.15, rough: 0.35 });
const doorEdge = mat("DoorEdge", 0x505256, { metal: 0.3, rough: 0.45 });     // the doors' edges: dark grey on the 3/4 views
const trimSilver = mat("TrimSilver", 0xc3c6ca, { metal: 0.85, rough: 0.3 });
const labelM = mat("LabelBEE", 0xffffff, { rough: 0.5, opacity: 0.999 });
const markM = mat("SamsungMark", 0xffffff, { rough: 0.5, opacity: 0.999 });
const recess = mat("Recess", 0x0c0d0f, { rough: 0.6 });
const liner = mat("Liner", 0xdfe2e5, { rough: 0.72, emissive: 0x7d8186, emissiveIntensity: 0.55 });
const glass = mat("Glass", 0xcfe3ea, { rough: 0.05, opacity: 0.45 });
const binMat = mat("Bin", 0xcfe0ea, { rough: 0.15, opacity: 0.62 });
const frosted = mat("Frosted", 0xe6edf1, { rough: 0.45, opacity: 0.78 });
const gasket = mat("Gasket", 0xb8bcc0, { rough: 0.85 });
const light = mat("Light", 0xffffff, { emissive: 0xf4f8ff, emissiveIntensity: 1.4 });
const panelMat = mat("InnerPanel", 0xffffff, { rough: 0.45, opacity: 0.999 });
const backFz = mat("BackFreezer", 0xffffff, { rough: 0.7 }), backFr = mat("BackFridge", 0xffffff, { rough: 0.7 });
const filterMat = mat("FilterFace", 0xffffff, { rough: 0.55 });
const bigBoxPrint = mat("BigBoxPrint", 0xffffff, { rough: 0.5, opacity: 0.999 }), iceMakerPrint = mat("IceMakerPrint", 0xffffff, { rough: 0.5, opacity: 0.999 });
const railGrey = mat("Rail", 0xdfe2e6, { rough: 0.5 });
const clearLite = mat("ClearLight", 0xdfe7ee, { rough: 0.12, opacity: 0.3, side: THREE.DoubleSide });
const iceWhite = mat("IceMakerWhite", 0xf1f3f5, { rough: 0.45 });
const iceGrip = mat("IceGrip", 0xe4e7ea, { rough: 0.4 });
const iceCube = mat("IceCube", 0xe3f4ff, { rough: 0.08, opacity: 0.72 });
const grille = mat("Grille", 0xbfc3c8, { rough: 0.6 });
const back = mat("Back", 0x96999d, { metal: 0.3, rough: 0.7 });
const foot = mat("Foot", 0x141518, { rough: 0.7 });
const sidePaint = mat("SidePaint", 0xffffff, { metal: 0.3, rough: 0.5 });
const ventMat = mat("SideVent", 0x2a2c30, { metal: 0.2, rough: 0.6 });
const rearMat = mat("Rear", 0xffffff, { metal: 0.35, rough: 0.55 });
const bayMat = mat("Bay", 0xffffff, { rough: 0.7 });
const bayDark = mat("BayDark", 0x0f1012, { rough: 0.85 });
const cordMat = mat("Cord", 0x3d4044, { rough: 0.6 });
const plugMat = mat("Plug", 0x2f3135, { rough: 0.5 });
const pinMat = mat("Pin", 0xb7bbc0, { metal: 0.9, rough: 0.3 });
const silver = mat("Silver", 0xc9ccd0, { metal: 0.9, rough: 0.25 });

// rear: the cord path and bay position are read off Samsung's rear photo by tex_samsung_rt80.py
const rp = JSON.parse(fs.readFileSync(`${T}/cord_path.json`, "utf8"));
const bayTop = rp.bay_top, bayD = 0.17;       // the compressor bay opens at the rear, up to 270 mm; its depth is ESTIMATED (the RT45's)

const root = group("SamsungRT80");
const cab = group("Cabinet");
root.add(cab);

// ── cabinet: dark painted metal outside, white inside ──
const shellH = H - feet, shellMid = feet + shellH / 2, zMid = zBack + Dc / 2;
cab.add(faced("SideLeft", wall, shellH, Dc, [liner, sidePaint, topSkin, body, body, body], -W / 2 + wall / 2, shellMid, zMid));
cab.add(faced("SideRight", wall, shellH, Dc, [sidePaint, liner, topSkin, body, body, body], W / 2 - wall / 2, shellMid, zMid));
cab.add(faced("Top", W - 2 * wall, wall, Dc, [body, body, topSkin, liner, body, body], 0, H - wall / 2, zMid));
cab.add(faced("Base", W - 2 * wall, floorTop - feet, Dc, [body, body, liner, body, body, body], 0, feet + (floorTop - feet) / 2, zMid));
const wallH = H - wall - bayTop;
cab.add(faced("BackWall", W - 2 * wall, wallH, wall, [liner, liner, liner, liner, liner, back], 0, bayTop + wallH / 2, zBack + 0.004 + wall / 2));
// outer back: Samsung's silver dimpled panel above the compressor bay (flush with the 794 mm depth)
const rearH = H - bayTop;
// 3.2 mm narrower and 1.6 mm shorter: the exporter moves overlapping surfaces 0.8 mm apart, and this keeps the model at the published 700 x 1820 mm
cab.add(mesh("RearPanel", flipV(new THREE.BoxGeometry(W - 0.0032, rearH - 0.0032, 0.004)), [back, back, back, back, back, rearMat], 0, bayTop + rearH / 2, zBack + 0.002));
// the open compressor bay below it: dark walls, ceiling and floor, and the photographed machinery on its back wall; the
// ceiling's top is the white step inside the fridge, behind the Big Box
const bayH = bayTop - floorTop, bayW = W - 2 * wall;
cab.add(faced("BayCeiling", bayW, 0.01, bayD, [bayDark, bayDark, liner, bayDark, bayDark, bayDark], 0, bayTop + 0.005, zBack + bayD / 2));
cab.add(box("BayFloor", bayW, 0.004, bayD, bayDark, 0, floorTop + 0.002, zBack + bayD / 2));
cab.add(box("BaySideL", 0.004, bayH - 0.0012, bayD, bayDark, -bayW / 2 + 0.002, floorTop + (bayH - 0.0012) / 2, zBack + bayD / 2));
cab.add(box("BaySideR", 0.004, bayH - 0.0012, bayD, bayDark, bayW / 2 - 0.002, floorTop + (bayH - 0.0012) / 2, zBack + bayD / 2));
cab.add(mesh("BayBack", flipV(new THREE.BoxGeometry(bayW, bayH, 0.012)), [liner, liner, liner, liner, liner, bayMat], 0, floorTop + bayH / 2, zBack + bayD + 0.006));
{ // power cord down the back to its three-pin plug (cord 6.5 mm: 4-5 px at 0.72 px per mm on the rear photo; plug 45 x 42 x 20 mm,
  // ESTIMATED from the photo's 62 x 42 mm with its strain relief)
  // The rear photo shows the plug clipped to the back just above the compressor bay. Clipped there it stands 36 mm proud of
  // the back and shows past the back edge from either side at eye level, which the brief rules out (cords and plugs never
  // visible from the front, 3/4 or side), so the plug hangs 35 mm down inside the open bay instead, its pins short of the
  // back's plane, and the cord follows the photo's route to the bay's top edge, then turns in to the plug
  const [px] = rp.plug, py = bayTop - 0.035, plugIn = 0.045;
  const last = rp.cord[rp.cord.length - 1];
  const pts = [...rp.cord.map(([x, y]) => new THREE.Vector3(x, y, zBack - 0.004)),
    new THREE.Vector3(last[0] + 0.008, bayTop - 0.007, zBack - 0.006),
    new THREE.Vector3(px - 0.004, bayTop - 0.012, zBack + 0.02),
    new THREE.Vector3(px, py + 0.024, zBack + plugIn - 0.012)];
  cab.add(mesh("PowerCord", new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts, false, "centripetal"), 140, rp.cord_d / 2, 6, false), cordMat));
  const sh = new THREE.Shape(), w = 0.045, h = 0.042, r = 0.012;
  sh.moveTo(-w / 2 + r, -h / 2); sh.lineTo(w / 2 - r, -h / 2); sh.quadraticCurveTo(w / 2, -h / 2, w / 2, -h / 2 + r);
  sh.lineTo(w / 2, h / 2 - r); sh.quadraticCurveTo(w / 2, h / 2, w / 2 - r, h / 2); sh.lineTo(-w / 2 + r, h / 2);
  sh.quadraticCurveTo(-w / 2, h / 2, -w / 2, h / 2 - r); sh.lineTo(-w / 2, -h / 2 + r); sh.quadraticCurveTo(-w / 2, -h / 2, -w / 2 + r, -h / 2);
  const plug = mesh("Plug", new THREE.ExtrudeGeometry(sh, { depth: 0.016, bevelEnabled: true, bevelSize: 0.002, bevelThickness: 0.002, bevelSegments: 2, curveSegments: 8 }), plugMat, px, py, zBack - 0.004 + plugIn);
  plug.rotation.y = Math.PI;
  cab.add(plug);
  for (const [dx, dy] of [[0, 0.0105], [-0.0095, -0.0065], [0.0095, -0.0065]]) {
    const pin = mesh("PlugPin", new THREE.CylinderGeometry(0.0026, 0.0026, 0.016, 10), pinMat, px + dx, py + dy, zBack - 0.004 + plugIn - 0.016 - 0.008);
    pin.rotation.x = Math.PI / 2; cab.add(pin);
  }
}
{ // the louvred vent low on the left side at the back (the 3/4-left photos of all three codes: about 140 mm along the side
  // and 135 mm tall, from 10 mm in front of the back and 40 mm above the floor; ESTIMATED off the foreshortened view)
  // a thin plate 0.6 mm proud of the side with its slots 0.8 mm proud of that, so the body stays within the published 700 mm
  const vz0 = zBack + 0.01, vz1 = vz0 + 0.14, vy0 = 0.04, vy1 = 0.175, x = -W / 2 - 0.0003;
  cab.add(box("SideVentFrame", 0.0006, vy1 - vy0, vz1 - vz0, ventMat, x, (vy0 + vy1) / 2, (vz0 + vz1) / 2));
  for (let i = 0; i < 11; i++) {
    const y = vy0 + 0.012 + i * ((vy1 - vy0 - 0.024) / 10);
    cab.add(box("SideVentSlat", 0.0008, 0.004, vz1 - vz0 - 0.016, recess, x - 0.0007, y, (vz0 + vz1) / 2));
  }
}
cab.add(box("Divider", W - 2 * wall, fzFloor - fzCeil, Dc - wall, liner, 0, (fzCeil + fzFloor) / 2, zMid + wall / 2));
// the middle hinge sits in the 7 mm gap between the doors
cab.add(box("CenterHinge", 0.07, gap - 0.001, 0.034, silver, W / 2 - 0.05, yDiv, zFront + 0.004));
cab.add(box("DividerTrim", W - 2 * wall, 0.008, 0.004, recess, 0, yDiv, zFront - 0.001));   // the gap between the doors reads black on Samsung's front
cab.add(box("Plinth", W - 0.03, doorBottom - feet - 0.002, 0.012, foot, 0, feet + (doorBottom - feet) / 2, zFront - 0.008));
cab.add(box("PlinthTab", 0.05, feet, 0.03, foot, 0, feet / 2, zFront - 0.02));
for (const [fx, fz] of [[-1, 1], [1, 1], [-1, -1], [1, -1]]) {
  cab.add(mesh("Foot", new THREE.CylinderGeometry(0.017, 0.019, feet, 20), foot, fx * (W / 2 - 0.035), feet / 2, zMid + fz * (Dc / 2 - 0.035)));
}

// ── inside ──
const inW = W - 2 * wall - 0.006;                          // between the side ribs
const xIn = W / 2 - wall;                                  // the inner side walls
const zIn = zBack + 0.004 + wall;                          // the inner face of the back wall
const zDuct = zIn + 0.012;                                 // the front of the raised ducts on the back wall
// back-wall air ducts (Twin Cooling Plus): raised 12 mm, with the vents, the badges, the grommets and the printed icons.
// tex_samsung_rt80.py drew them at the sizes read off the open-door photo at the back wall (NOTES.md); the boxes are the
// same numbers
const backWall = (name, x0, x1, y0, y1, m) =>
  cab.add(mesh(name, flipV(new THREE.BoxGeometry(x1 - x0, y1 - y0, 0.012)), [liner, liner, liner, liner, m, liner], (x0 + x1) / 2, (y0 + y1) / 2, zIn + 0.006));
backWall("FridgeDuct", -0.173, 0.160, 0.600, 1.160, backFr);
backWall("FreezerDuct", -0.259, 0.261, 1.300, 1.745, backFz);
// the Active Fresh Filter+ unit, standing 15 mm proud of the duct between the second and third shelves (photo rows 944-968,
// x 842-1019: 323 x 44 mm), its louvres and name plate printed on its face
cab.add(mesh("ActiveFreshFilter", flipV(new THREE.BoxGeometry(0.323, 0.044, 0.015)), [liner, liner, liner, liner, filterMat, liner], -0.006, 0.636, zDuct + 0.0075));
// ribs on the side walls that the shelves rest on (fixed: they stay when the trays come out)
const rails = (name, yTop, z0, z1, m = railGrey) => { for (const sx of [-1, 1]) cab.add(box(name, 0.012, 0.03, z1 - z0, m, sx * (inW / 2 - 0.004 + 0.002), yTop - 0.015, (z0 + z1) / 2)); };
cab.add(box("FridgeLed", 0.2, 0.008, 0.05, light, 0, fzCeil - 0.004, zFront - 0.12));
{ // the touch display on the fridge's right wall (68 x 120 mm, the RT34's and RT45's: the same panel on Samsung's close-up
  // g_550460090), just under the Fresh Room, 140 mm behind the door edge
  const panel = mesh("InnerPanelFace", flipV(new THREE.PlaneGeometry(0.068, 0.12)), panelMat, xIn - 0.001, sFresh - 0.062, zFront - 0.14);
  panel.rotation.y = -Math.PI / 2;
  cab.add(panel);
}
// the Fresh Room: a clear tray under the fridge ceiling, on rails, with a frosted front rim. It stays in:
// the manual's "Handle and care" doesn't list it
{
  const tw = 0.556, z0 = zDuct + 0.004, z1 = frontFridge, td = z1 - z0, tz = (z0 + z1) / 2, y0 = sFresh;
  cab.add(box("FreshRoomFloor", tw, 0.004, td, binMat, 0, y0 + 0.002, tz));
  for (const sx of [-1, 1]) cab.add(box("FreshRoomSide", 0.004, 0.11, td, binMat, sx * (tw / 2 - 0.002), y0 + 0.055, tz));
  cab.add(box("FreshRoomBack", tw - 0.008, 0.08, 0.004, clearLite, 0, y0 + 0.04, z0 + 0.002));
  cab.add(box("FreshRoomFront", tw, 0.038, 0.004, clearLite, 0, y0 + 0.019, z1 - 0.002));
  cab.add(box("FreshRoomRim", tw, 0.01, 0.008, frosted, 0, y0 + 0.043, z1 - 0.004));
  cab.add(box("FreshRoomRail", tw + 0.01, 0.012, 0.01, railGrey, 0, sFresh + 0.125, z1 - 0.02));
  for (const sx of [-1, 1]) cab.add(box("FreshRoomRunner", 0.02, 0.008, td, railGrey, sx * (tw / 2 + 0.012), sFresh + 0.125, tz));
}

// the parts that come out (FridgeTrays): three glass shelves, the vegetable shelf and the Big Box, with their food
const trays = group("FridgeTrays");
cab.add(trays);
function glassShelf(name, yTop, z0) {                    // a tempered-glass shelf with its thin white front rim
  const z1 = frontFridge, w = inW - 0.014;
  trays.add(box(name, w, 0.006, z1 - 0.009 - z0, glass, 0, yTop - 0.003, (z0 + z1 - 0.009) / 2));
  trays.add(box(name + "Rim", w, 0.012, 0.009, frosted, 0, yTop - 0.004, z1 - 0.0045));
  rails(name + "Rail", yTop - 0.006, zIn, z1 - 0.01);
}
glassShelf("Shelf1", s1, zDuct + 0.002);
glassShelf("Shelf2", s2, zDuct + 0.002);
glassShelf("Shelf3", s3, zDuct + 0.002);
{ // the vegetable shelf: a clear plastic cover over the Big Box, hooked at the back wall, with its frosted low front
  const z0 = zIn + 0.002, z1 = frontFridge, w = inW - 0.014;
  trays.add(box("VegShelf", w, 0.006, z1 - 0.012 - z0, clearLite, 0, sCover - 0.003, (z0 + z1 - 0.012) / 2));
  trays.add(box("VegShelfFrontLow", w, 0.018, 0.012, frosted, 0, sCover - 0.008, z1 - 0.006));
  rails("VegShelfRail", sCover - 0.006, zIn, z1 - 0.01);
}
// the Big Box: one wide clear drawer, "Big Box" and three fruit icons printed on its front; it stops short of the
// compressor bay's step at the back
const bbW = 0.575, bbZ0 = zBack + bayD + 0.012 + 0.013, bbZ1 = frontBigBox, bbD = bbZ1 - bbZ0, bbZ = (bbZ0 + bbZ1) / 2;
{
  const hh = bbTop - bbBottom;
  trays.add(box("FzBoxFloor", bbW, 0.004, bbD, binMat, 0, bbBottom + 0.002, bbZ));
  trays.add(box("FzBoxBack", bbW, hh, 0.004, binMat, 0, bbBottom + hh / 2, bbZ0 + 0.002));
  trays.add(box("FzBoxL", 0.004, hh, bbD, binMat, -bbW / 2 + 0.002, bbBottom + hh / 2, bbZ));
  trays.add(box("FzBoxR", 0.004, hh, bbD, binMat, bbW / 2 - 0.002, bbBottom + hh / 2, bbZ));
  trays.add(box("FzBoxFront", bbW, hh - 0.012, 0.004, clearLite, 0, bbBottom + (hh - 0.012) / 2, bbZ1 - 0.002));
  trays.add(box("FzBoxRim", bbW + 0.01, 0.012, 0.008, frosted, 0, bbTop - 0.006, bbZ1 - 0.002));
  trays.add(box("FzBoxFootRim", bbW, 0.01, 0.008, frosted, 0, bbBottom + 0.005, bbZ1 - 0.002));
  // the print's centre 0.62 of the way up the box's front (open-door photo: "Big Box" at row 1255 of 1175-1343)
  trays.add(mesh("PrintBigBox", flipV(new THREE.PlaneGeometry(0.17, 0.10)), bigBoxPrint, 0, 0.215, bbZ1 + 0.0003));
}

// ── groceries (stock_lg.mjs, food.mjs): vegetarian South Indian food, eggs, juices, water and soft drinks ──
const stock = LGStock({ T3: `${TEX}/lg_glt3426`, TF: `${TEX}/food`, BR: `${TEX}/brands`, BRT: `${TEX}/brands/small` });
const bbFloor = bbBottom + 0.004;
// stock_lg.mjs stocks three shelves: its first set (the tallest: cartons, the tiffin, batter) goes on the third shelf here,
// which has the most room above it (194 mm), its second (coconut, melon, tins) on the first shelf (under the Fresh Room,
// 138 mm), its third (fruit and curd) on the second shelf (161 mm). The vegetable shelf is left bare.
stock.shelves(trays, {
  // stock_lg.mjs stands the food 3 mm over the height it is given (the LG 343 L's glass centres): give it each top less 2.5 mm
  zIn1: zIn, inW, inD: frontFridge - zIn, s1: s3 - 0.0025, s2: s1 - 0.0025, s3: s2 - 0.0025, fz: bbFloor, fit: true,
  vz0: bbZ0 + 0.02, vk: 0.85 * (bbD - 0.04) / 0.454,   // 0.82-0.88 all settle steady (tried in steps)
  shelfB: { hw: inW / 2 - 0.03, z0: zDuct + 0.02, z1: frontFridge - 0.015 },
  drawerB: { hw: bbW / 2 - 0.014, z0: bbZ0 + 0.02, z1: bbZ1 - 0.008, y0: bbFloor },
  drawerCeil: sCover - 0.006 - 0.01 - bbFloor, // the heap stays 1 cm under the vegetable shelf
});
// qa_bounds.mjs measures each item by its meshes' corner boxes: the coriander's tilted leaves put that box 6.8 mm under the
// box floor although its lowest stem rests on it (lowest vertex 86.0 mm, the floor's top). Lifting the bunch 2.5 mm keeps
// the check's estimate inside; 2.5 mm of air under a bunch of leaves in the heap doesn't show.
{ const c = trays.getObjectByName("Coriander"); if (c) c.position.y += 0.0025; }
// the Fresh Room: butter, cheese and curd cups (the LG 343 L's Fresh 0 Zone set)
stock.fresh0(cab, { y: sFresh + 0.004, z: (zDuct + 0.004 + frontFridge) / 2 + 0.03 });

// ── freezer inside: the plastic shelf, the ice maker's housing at the front left, a grille along the floor's front ──
{
  const z0 = zDuct + 0.002, z1 = frontFreezer, w = inW - 0.014;
  cab.add(box("FreezerShelf", w, 0.006, z1 - 0.009 - z0, clearLite, 0, fzShelfTop - 0.003, (z0 + z1 - 0.009) / 2));
  cab.add(box("FreezerShelfRim", w, 0.022, 0.009, frosted, 0, fzShelfTop - 0.009, z1 - 0.0045));
  rails("FreezerShelfRail", fzShelfTop - 0.006, zIn, z1 - 0.01);
}
// the Movable Ice Maker: a white housing 188 mm wide and 178 mm tall (the RT45's: the same part on the open-door photos), its
// front 3.5 cm behind the freezer door's lower bin; the ice tray (with its grip) and the clear bin under it slide out together
const icX = -0.176, icW = 0.188, icH = 0.178, icD = 0.22, icZ1 = frontFreezer - 0.035, icZ0 = icZ1 - icD;
{
  const y0 = fzFloor, zc = (icZ0 + icZ1) / 2;
  cab.add(box("IceHousingTop", icW, 0.008, icD, iceWhite, icX, y0 + icH - 0.004, zc));
  for (const sx of [-1, 1]) cab.add(box("IceHousingSide", 0.005, icH - 0.008, icD, iceWhite, icX + sx * (icW / 2 - 0.0025), y0 + (icH - 0.008) / 2, zc));
  cab.add(box("IceHousingBack", icW - 0.01, icH - 0.008, 0.005, iceWhite, icX, y0 + (icH - 0.008) / 2, icZ0 + 0.0025));
  for (let i = 0; i < 10; i++) cab.add(box("FloorGrille", 0.026, 0.003, 0.005, grille, -0.08 + i * 0.0385, fzFloor + 0.0015, frontFreezer - 0.012));
}
const ice = group("IceMaker", icX, fzFloor, 0);
{
  const iw = icW - 0.012, zf = icZ1;
  ice.add(box("IceTrayFace", iw, 0.058, 0.006, iceWhite, 0, 0.142, zf - 0.003));
  ice.add(box("IceTrayGrip", 0.075, 0.012, 0.008, iceGrip, 0, 0.152, zf + 0.004));
  ice.add(box("IceTrayBody", iw - 0.004, 0.03, icD - 0.03, iceWhite, 0, 0.145, zf - 0.006 - (icD - 0.03) / 2));
  const bd = icD - 0.02, bz = zf - bd / 2, bh = 0.104;
  ice.add(box("IceBinFloor", iw, 0.004, bd, binMat, 0, 0.004, bz));
  ice.add(box("IceBinFront", iw, bh, 0.004, clearLite, 0, 0.002 + bh / 2, zf - 0.002));
  ice.add(box("IceBinRim", iw, 0.01, 0.01, frosted, 0, 0.002 + bh - 0.005, zf - 0.005));
  for (const sx of [-1, 1]) ice.add(box("IceBinSide", 0.004, bh, bd, binMat, sx * (iw / 2 - 0.002), 0.002 + bh / 2, bz));
  ice.add(box("IceBinBack", iw - 0.008, bh, 0.004, binMat, 0, 0.002 + bh / 2, zf - bd + 0.002));
  ice.add(mesh("PrintIceMaker", flipV(new THREE.PlaneGeometry(0.15, 0.024)), iceMakerPrint, 0, 0.075, zf + 0.0003));
  const cube = new THREE.BoxGeometry(0.028, 0.024, 0.028);
  for (let i = 0; i < 14; i++) {
    const c = mesh("IceCube", cube, iceCube, -0.055 + (i % 4) * 0.036 + (Math.floor(i / 4) % 2) * 0.012, 0.022 + Math.floor(i / 8) * 0.023, zf - 0.04 - Math.floor((i % 8) / 4) * 0.06 - (i % 3) * 0.012);
    c.rotation.set(0.2 * (i % 3), 0.5 * i, 0.15 * (i % 4));
    ice.add(c);
  }
}
cab.add(ice);
// the freezer's food: the ice-cream tubs and standing packs behind the ice maker, three packs lying on the shelf
stock.freezer(cab, { fit: true, zIn1: zIn, floor: fzFloor, top: fzShelfTop + 0.0005, box: { hw: inW / 2 - 0.03, z0: zDuct + 0.02, z1: icZ0 - 0.01 } });

// ── doors: hinged on the right; the photo-textured front, dark edges, a recessed handle on the left ──
const pw = W - 0.002, bw = pw - 0.13;
const inside = (dep) => [-pw / 2 - bw / 2 + 0.004, -pw / 2 + bw / 2 - 0.004, -(linerFace + dep / 2)];
const partX = -pw / 2 + bw / 2 - bw / 3;
const xHinge = -pw / 2 + bw / 2 - 0.004, xFree = -pw / 2 - bw / 2 + 0.004;   // the end walls' inner faces
const EGGS = [...[-1, 0, 1].map((k) => (xHinge + partX + 0.002) / 2 + k * 0.053), ...[0, 1, 2, 3, 4, 5].map((i) => (partX - 0.002 + xFree) / 2 + (i - 2.5) * 0.054)];
const STRIP = 0.015;                                         // the silver strip across the top of the fridge door
function door(name, y0, h, frontMat) {
  const pivot = group(name, W / 2, y0, zFront);
  const top = name === "FridgeDoor" ? STRIP : 0;
  const geo = flipV(new THREE.BoxGeometry(pw, h - top, doorT));
  pivot.add(mesh(name + "Panel", geo, [doorEdge, doorEdge, doorEdge, doorEdge, frontMat, liner], -pw / 2, (h - top) / 2, doorT / 2));
  if (top) {
    pivot.add(mesh(name + "Strip", new THREE.BoxGeometry(pw, top, doorT), [doorEdge, doorEdge, trimSilver, doorEdge, trimSilver, liner], -pw / 2, h - top / 2, doorT / 2));
    // SAMSUNG in dark ink on the strip, 28 mm wide, in the middle (Samsung's front photo: 18 px at 0.653 px per mm)
    pivot.add(mesh("SamsungMarkDecal", flipV(new THREE.PlaneGeometry(0.028, 0.028 * 74 / 480)), markM, -pw / 2, h - top / 2, doorT + 0.0006));
  } else {
    // the code's own BEE label, 130 x 237 mm, 58 mm in from the hinge edge and 74 mm down (Samsung's front photo)
    const lw = 0.13, lh = 0.13 * 1.8206;
    pivot.add(mesh("BeeLabelDecal", flipV(new THREE.PlaneGeometry(lw, lh)), labelM, -0.058 - lw / 2, h - 0.074 - lh / 2, doorT + 0.0006));
  }
  // recessed handle: a vertical pocket in the free edge (the 3/4-left photo, ESTIMATED): the freezer's 206 mm long, centred
  // 174 mm above the door's bottom; the fridge's 215 mm, from 40 mm below its top
  const rh = name === "FreezerDoor" ? 0.206 : 0.215;
  const ry = name === "FreezerDoor" ? 0.174 : h - 0.04 - rh / 2;
  const pocket = mesh(name + "Handle", new THREE.CapsuleGeometry(0.006, rh - 0.012, 4, 8), recess, -pw + 0.0045, ry, doorT * 0.45);
  pocket.scale.z = 0.026 / 0.012;                             // a slot with round ends, 12 mm wide and 26 mm deep
  pivot.add(pocket);
  pivot.add(box(name + "Gasket", pw - 0.018, h - 0.018, 0.008, gasket, -pw / 2, h / 2, -0.004));
  pivot.add(box(name + "Liner", pw - 0.07, h - 0.07, 0.012, liner, -pw / 2, h / 2, -0.01));
  BINS[name].forEach((b, i) => {
    const zc = -linerFace - b.d / 2, zl = -linerFace - b.d;
    pivot.add(box(`${name}Bin${i}Floor`, bw, 0.004, b.d, binMat, -pw / 2, b.f + 0.002, zc));
    pivot.add(box(`${name}Bin${i}Lip`, bw, b.h - 0.004, 0.004, binMat, -pw / 2, b.f + (b.h - 0.004) / 2, zl + 0.002));
    pivot.add(box(`${name}Bin${i}Rim`, bw, 0.007, 0.005, frosted, -pw / 2, b.f + b.h - 0.0035, zl + 0.0025));
    for (const sx of [-1, 1]) pivot.add(box(`${name}Bin${i}End`, 0.004, b.h, b.d, binMat, -pw / 2 + sx * (bw / 2 - 0.002), b.f + b.h / 2, zc));
    if (b.twin) {
      pivot.add(box(`${name}Bin${i}Part`, 0.004, b.h, b.d, binMat, partX, b.f + b.h / 2, zc));
      for (const x of EGGS) { const c = mesh("EggCup", new THREE.SphereGeometry(0.02, 12, 4, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), binMat, x, b.f, zc); c.scale.y = 0.7; pivot.add(c); }
    }
  });
  return pivot;
}
const fridgeDoor = door("FridgeDoor", doorBottom, fridgeH, fridgeFront);
const freezerDoor = door("FreezerDoor", yFreezer, freezerH, freezerFront);
{
  const F = BINS.FridgeDoor, Z = BINS.FreezerDoor;
  stock.doorFridge(fridgeDoor, { fit: true, eggY: F[1].f, eggX: EGGS, eggDY: 0, eggTurn: Math.PI / 2, jarY: F[2].f, botY: F[0].f, canY: null, deps: { egg: F[1].d, jar: F[2].d, bottle: F[0].d }, inside });
  stock.doorFreezer(freezerDoor, { fit: true, b1: Z[1].f, b2: Z[0].f, dep: Math.min(Z[0].d, Z[1].d), inside });
}
root.add(fridgeDoor, freezerDoor);

const parts = productParts(PRODUCTS, ID);
const clips = stateClips(root, parts);
saveZones(PRODUCTS, ID, root, parts);
// Grain: the doors are exported with the soft horizontal hairline so their geometry carries the grain UVs; the base colour
// (Black DOI, a smooth film on Samsung's photos) then drops the normal map below, and only EZ Clean Steel (fine horizontal
// brushing on its photos, as the RT45's) keeps it. The painted sides and top get the soft peel. Prints: no grain.
await exportGLB(root, clips, OUT, {
  FreezerFront: `${T}/door_freezer_f.jpg`,
  FridgeFront: `${T}/door_fridge_f.jpg`,
  LabelBEE: `${T}/label_f.png`,
  SamsungMark: `${T}/mark.png`,
  InnerPanel: `${T}/inner_panel.png`,
  BackFreezer: `${T}/back_freezer.png`,
  BackFridge: `${T}/back_fridge.png`,
  FilterFace: `${T}/filter_print.png`,
  BigBoxPrint: `${T}/bigbox_print.png`,
  IceMakerPrint: `${T}/icemaker_print.png`,
  SidePaint: `${T}/side_paint.jpg`,
  Rear: `${T}/rear.jpg`,
  Bay: `${T}/bay.jpg`,
  ...stock.textures(),
}, { dir: `${TEX}/grain`, materials: {
  FreezerFront: { type: "hairline_soft", dir: "h" },
  FridgeFront: { type: "hairline_soft", dir: "h" },
  SidePaint: { type: "peel_soft" }, TopSkin: { type: "peel_soft" },
} });

// ── the three colours as material variants (KHR_materials_variants): Black DOI (RT80H51C2FHL, the client's code, first),
// EZ Clean Steel (RT80H51C2SHL) and Black Glass (RT80H51C2BHL). On Samsung's photos of the three only the door fronts,
// their edges and the label (each names its own code) change; the sides, strip, inside and back are the same ──
// a colour's own value for a material: { tex, color [r,g,b], metal, rough, coat: [amount, roughness] | null, grain: false }
const DOOR = {
  // Black DOI: a smooth dark film (no brushing on the photo at 3x): no normal map, no clear coat, roughness 0.75 (the brief's
  // dark-colour recipe). It reads 1.00-1.04 of Samsung's front and 0.99-1.10 of the 3/4 photos at 20 degrees; the earlier
  // glossy one (0.35 with a 0.3 coat) read 25-50% lighter at 3/4 (NOTES.md)
  f: { grain: false, rough: 0.75, coat: null },
  // EZ Clean Steel: the brief's steel recipe (Whirlpool 22343, Haier HRB-4052): metal 0.38, roughness 0.55, a 0.4 clear coat,
  // the brushed grain kept and the photo's light bands baked into the texture
  s: { metal: 0.38, rough: 0.55, coat: [0.4, 0.3] },
  // Black Glass: glass, not satin: a full clear coat (1.0, roughness 0.05) gives the sharp reflection, over a dark navy base
  // (metal 0.8, roughness 0.5) whose texture is the photo's own colour (tex_samsung_rt80.py LIN_K). Trials in NOTES.md
  b: { grain: false, metal: 0.8, rough: 0.5, coat: [1.0, 0.05] },
};
const FINISHES = [
  ["Black DOI", { FreezerFront: DOOR.f, FridgeFront: DOOR.f }],
  ["EZ Clean Steel", {
    FreezerFront: { tex: `${T}/door_freezer_s.jpg`, ...DOOR.s }, FridgeFront: { tex: `${T}/door_fridge_s.jpg`, ...DOOR.s },
    DoorEdge: { color: [118, 120, 124] }, LabelBEE: { tex: `${T}/label_s.png` },
  }],
  ["Black Glass", {
    FreezerFront: { tex: `${T}/door_freezer_b.jpg`, ...DOOR.b }, FridgeFront: { tex: `${T}/door_fridge_b.jpg`, ...DOOR.b },
    LabelBEE: { tex: `${T}/label_b.png` },
  }],
];
{
  const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
  const doc = await io.readBinary(new Uint8Array(fs.readFileSync(OUT)));
  const ext = doc.createExtension(KHRMaterialsVariants);
  const coatExt = doc.createExtension(KHRMaterialsClearcoat);
  const lin = (c) => ((c / 255) <= 0.04045 ? c / 255 / 12.92 : Math.pow((c / 255 + 0.055) / 1.055, 2.4));
  const vs = FINISHES.map(([n]) => ext.createVariant(n));
  const mats = doc.getRoot().listMaterials(), texCache = new Map();
  const texOf = (file) => {
    if (!texCache.has(file)) texCache.set(file, doc.createTexture(file.split("/").pop().replace(/\.\w+$/, "")).setImage(new Uint8Array(fs.readFileSync(file))).setMimeType(file.endsWith(".png") ? "image/png" : "image/jpeg"));
    return texCache.get(file);
  };
  const apply = (m, v) => {
    if (v.tex) m.setBaseColorTexture(texOf(v.tex));
    if (v.color) m.setBaseColorFactor([...v.color.map(lin), m.getBaseColorFactor()[3]]);
    if (v.metal != null) m.setMetallicFactor(v.metal);
    if (v.rough != null) m.setRoughnessFactor(v.rough);
    if (v.grain === false) { m.setNormalTexture(null); m.setMetallicRoughnessTexture(null); }
    if (v.coat === null) m.setExtension("KHR_materials_clearcoat", null);
    else if (v.coat) m.setExtension("KHR_materials_clearcoat", coatExt.createClearcoat().setClearcoatFactor(v.coat[0]).setClearcoatRoughnessFactor(v.coat[1]));
    return m;
  };
  const alt = {};
  for (const name of new Set(FINISHES.flatMap(([, t]) => Object.keys(t)))) {
    const base = mats.find((m) => m.getName() === name);
    if (!base) throw new Error(`no material ${name}`);
    // every colour's material is cloned from the exported one before the base is changed; the first colour then becomes the base
    const clones = FINISHES.map(([fn, t], i) => (i === 0 || !t[name] ? null : apply(base.clone().setName(`${name}${fn.replace(/\s+/g, "")}`), t[name])));
    if (FINISHES[0][1][name]) apply(base, FINISHES[0][1][name]);
    alt[name] = clones.map((c) => c || base);
  }
  for (const m of doc.getRoot().listMeshes()) for (const p of m.listPrimitives()) {
    const list0 = alt[p.getMaterial()?.getName()];
    if (!list0) continue;
    const list = ext.createMappingList();
    list0.forEach((mm, i) => list.addMapping(ext.createMapping().setMaterial(mm).addVariant(vs[i])));
    p.setExtension("KHR_materials_variants", list);
  }
  fs.writeFileSync(OUT, await io.writeBinary(doc));
  console.log(OUT, (fs.statSync(OUT).size / 1048576).toFixed(2) + " MB with", FINISHES.length, "colours");
}
