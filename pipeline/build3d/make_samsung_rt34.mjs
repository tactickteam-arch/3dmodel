// Samsung RT34HG5A42BXHL, 330 L double door, Luxe Black.
// Built to Samsung's published size, 630 W x 1710 H x 740 D mm, and the official photos: freezer on top (75 L), fridge
// below (255 L), both doors hinged on the right with recessed handles on the left edge, a silver strip with the SAMSUNG
// wordmark across the top of the fridge door, the model's own BEE label on the freezer door.
// Inside, as Samsung's open-door photo (g_550669408.jpg) and the manual's "Refrigerator at a glance" show them: in the
// freezer a plastic shelf and the Movable (twist) Ice Maker at the front left; in the fridge the Fresh Room tray, two
// tempered-glass shelves, the vegetable shelf (the cover of the Big Box) and the Big Box drawer; two bins on the freezer
// door, and on the fridge door a top bin, the twin egg bin and the bottle bin.
// Samsung's manual (Maintenance, Handle and care) says the shelves lift out, the vegetable shelf lifts out and the
// vegetable drawer slides out, so those are one part (FridgeTrays) that comes out with its food when the fridge door is
// open; it says the ice tray slides open and its bin pulls forward, so the tray and bin are one part (IceMaker).
// Stocked for a south Indian kitchen (stock_lg.mjs, fit: true, BENCHMARK.md section 13).
// usage: node make_samsung_rt34.mjs <products.json> <tex dir> <out.glb>
import fs from "node:fs";
import { LGStock } from "./stock_lg.mjs";
import { THREE, mat, mesh, box, faced, group, stateClips, exportGLB, productParts, saveZones } from "./lib.mjs";

const [PRODUCTS, TEX, OUT] = process.argv.slice(2);
const ID = "samsung-rt34hg5a42bxhl";

// ── size (metres) ──
const W = 0.63, H = 1.71, D = 0.74;
const doorT = 0.05, Dc = D - doorT;
const zBack = -D / 2, zFront = zBack + Dc;
const wall = 0.03, feet = 0.018, floorTop = 0.07;
const doorBottom = 0.04, gap = 0.006;
const yFreezer = 1.148, freezerH = H - yFreezer, fridgeH = yFreezer - gap - doorBottom;
const yDiv = yFreezer - gap / 2;
// heights inside, measured on Samsung's open-door photo (g_550669408.jpg): 0.635 px per mm from the 1710 mm body (top
// edge row 116 to the floor under the feet, row 1202); the camera's eye level (row 698, 0.79 m) and distance (about
// 5.3 m) come from the doors' top and bottom corners, and correct the parts set about 12 cm back. Checked on a second
// part: the door gap at the open doors' free edges lands at 1140 mm against 1145 mm in the model. See NOTES.md.
const fzCeil = 1.123, fzFloor = 1.205;                       // the mullion: fridge ceiling and freezer floor
const sFresh = 0.976, s1 = 0.813, s2 = 0.636, sCover = 0.356; // Fresh Room floor, the glass shelves' tops, the vegetable shelf's top
const bbBottom = 0.075, bbTop = 0.345;                        // the Big Box
const fzShelfTop = 1.466;                                     // the freezer's plastic shelf
// door bins, measured on the same photo against each door's own height there: floor above the door's bottom edge, end
// wall height, and depth out from the door's liner (from the width of each bin's end wall)
const BINS = {
  FridgeDoor: [{ f: 0.33, h: 0.14, d: 0.095 }, { f: 0.70, h: 0.075, d: 0.06, twin: true }, { f: 0.92, h: 0.07, d: 0.10 }],
  FreezerDoor: [{ f: 0.07, h: 0.085, d: 0.085 }, { f: 0.265, h: 0.085, d: 0.075 }],
};
const linerFace = 0.016;                                      // the door liner's face, behind the door's back edge
// with the doors shut the bins reach into the cabinet: everything inside ends 1 cm short of the bin in front of it
const reach = (name) => Math.max(...BINS[name].map((b) => b.d)) + linerFace;
const frontFridge = zFront - reach("FridgeDoor") - 0.01;      // Fresh Room, shelves, vegetable shelf
const frontBigBox = zFront - 0.121;                           // the Big Box (below the bottle bin) ends level with them
const frontFreezer = zFront - reach("FreezerDoor") - 0.01;    // freezer shelf and the ice maker

// ── materials ──
const flipV = (geo) => { const uv = geo.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setY(i, 1 - uv.getY(i)); return geo; };
const body = mat("Body", 0x3d3e43, { metal: 0.22, rough: 0.5 });
const topSkin = mat("TopSkin", 0x1e1f23, { metal: 0.1, rough: 0.8 });
const freezerFront = mat("FreezerFront", 0xffffff, { metal: 0.15, rough: 0.35 });
const fridgeFront = mat("FridgeFront", 0xffffff, { metal: 0.15, rough: 0.35 });
const doorEdge = mat("DoorEdge", 0x4a4b50, { metal: 0.3, rough: 0.45 });     // the doors' edges: dark grey, a shade under the sides (3/4 photo)
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
const rearMat = mat("Rear", 0xffffff, { metal: 0.35, rough: 0.55 });
const bayMat = mat("Bay", 0xffffff, { rough: 0.7 });
const bayDark = mat("BayDark", 0x0f1012, { rough: 0.85 });
const cordMat = mat("Cord", 0x5d6064, { rough: 0.6 });
const plugMat = mat("Plug", 0x45474b, { rough: 0.5 });
const pinMat = mat("Pin", 0xb7bbc0, { metal: 0.9, rough: 0.3 });
const silver = mat("Silver", 0xc9ccd0, { metal: 0.9, rough: 0.25 });

// rear: the cord path and bay position are read off Samsung's rear photo by tex_samsung_extra.py
const rp = JSON.parse(fs.readFileSync(`${TEX}/samsung/cord_path.json`, "utf8"));
const bayTop = rp.bay_top, bayD = 0.17;       // the compressor bay opens at the rear, up to 284 mm; its depth is an estimate

const root = group("SamsungRT34");
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
// outer back: Samsung's silver dimpled panel above the compressor bay (flush with the 740 mm depth)
const rearH = H - bayTop;
// 3.2 mm narrower and 1.6 mm shorter: the exporter moves overlapping surfaces 0.8 mm apart, and this keeps the model at the published 630 x 1710 mm
cab.add(mesh("RearPanel", flipV(new THREE.BoxGeometry(W - 0.0032, rearH - 0.0032, 0.004)), [back, back, back, back, back, rearMat], 0, bayTop + rearH / 2, zBack + 0.002));
// the open compressor bay below it: dark walls, ceiling and floor, and the photographed machinery on its back wall; the
// ceiling's top is the white step inside the fridge, behind the Big Box
const bayH = bayTop - floorTop, bayW = W - 2 * wall;
cab.add(faced("BayCeiling", bayW, 0.01, bayD, [bayDark, bayDark, liner, bayDark, bayDark, bayDark], 0, bayTop + 0.005, zBack + bayD / 2));
cab.add(box("BayFloor", bayW, 0.004, bayD, bayDark, 0, floorTop + 0.002, zBack + bayD / 2));
cab.add(box("BaySideL", 0.004, bayH - 0.0012, bayD, bayDark, -bayW / 2 + 0.002, floorTop + (bayH - 0.0012) / 2, zBack + bayD / 2));
cab.add(box("BaySideR", 0.004, bayH - 0.0012, bayD, bayDark, bayW / 2 - 0.002, floorTop + (bayH - 0.0012) / 2, zBack + bayD / 2));
cab.add(mesh("BayBack", flipV(new THREE.BoxGeometry(bayW, bayH, 0.012)), [liner, liner, liner, liner, liner, bayMat], 0, floorTop + bayH / 2, zBack + bayD + 0.006));
{ // power cord down the back to its three-pin plug (cord 8 mm and plug 45 x 42 x 20 mm, estimated from the photo)
  const pts = rp.cord.map(([x, y]) => new THREE.Vector3(x, y, zBack - 0.004));
  cab.add(mesh("PowerCord", new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts, false, "centripetal"), 120, rp.cord_d / 2, 6, false), cordMat));
  const [px, py] = rp.plug;
  const sh = new THREE.Shape(), w = 0.045, h = 0.042, r = 0.012;
  sh.moveTo(-w / 2 + r, -h / 2); sh.lineTo(w / 2 - r, -h / 2); sh.quadraticCurveTo(w / 2, -h / 2, w / 2, -h / 2 + r);
  sh.lineTo(w / 2, h / 2 - r); sh.quadraticCurveTo(w / 2, h / 2, w / 2 - r, h / 2); sh.lineTo(-w / 2 + r, h / 2);
  sh.quadraticCurveTo(-w / 2, h / 2, -w / 2, h / 2 - r); sh.lineTo(-w / 2, -h / 2 + r); sh.quadraticCurveTo(-w / 2, -h / 2, -w / 2 + r, -h / 2);
  const plug = mesh("Plug", new THREE.ExtrudeGeometry(sh, { depth: 0.016, bevelEnabled: true, bevelSize: 0.002, bevelThickness: 0.002, bevelSegments: 2, curveSegments: 8 }), plugMat, px, py, zBack - 0.004);
  plug.rotation.y = Math.PI;
  cab.add(plug);
  for (const [dx, dy] of [[0, 0.0105], [-0.0095, -0.0065], [0.0095, -0.0065]]) {
    const pin = mesh("PlugPin", new THREE.CylinderGeometry(0.0026, 0.0026, 0.016, 10), pinMat, px + dx, py + dy, zBack - 0.004 - 0.016 - 0.008);
    pin.rotation.x = Math.PI / 2; cab.add(pin);
  }
}
cab.add(box("Divider", W - 2 * wall, fzFloor - fzCeil, Dc - wall, liner, 0, (fzCeil + fzFloor) / 2, zMid + wall / 2));
// the middle hinge sits in the 6 mm gap between the doors
cab.add(box("CenterHinge", 0.07, gap - 0.001, 0.034, silver, W / 2 - 0.05, yDiv, zFront + 0.004));
cab.add(box("DividerTrim", W - 2 * wall, 0.008, 0.004, silver, 0, yDiv, zFront - 0.001));
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
// back-wall air ducts (Twin Cooling Plus): raised 12 mm, with the vents, the badge, the round grommet and the printed icons.
// tex_samsung_fridge.py drew them as they look on the open-door photo, at the doors' scale; the back wall is 0.64 m
// further from that camera (5.3 m away, eye 0.794 m up, 0.16 m right of the middle), so it looks 0.892 times its size:
// here each panel is scaled back up about that point, its top stopping 2 mm under the ceiling
const backWall = (name, w, y0, y1, ceil, m) => {
  const k = 1 / 0.892, ex = 0.16, ey = 0.794, x = ex + (0.008 - ex) * k, b = ey + (y0 - ey) * k, t = Math.min(ey + (y1 - ey) * k, ceil - 0.002);
  cab.add(mesh(name, flipV(new THREE.BoxGeometry(w * k, t - b, 0.012)), [liner, liner, liner, liner, m, liner], x, (b + t) / 2, zIn + 0.006));
};
backWall("FridgeDuct", 0.300, 0.588, 1.106, fzCeil, backFr);
backWall("FreezerDuct", 0.376, 1.208, 1.593, H - wall, backFz);
// ribs on the side walls that the shelves rest on (fixed: they stay when the trays come out)
const rails = (name, yTop, z0, z1, m = railGrey) => { for (const sx of [-1, 1]) cab.add(box(name, 0.012, 0.03, z1 - z0, m, sx * (inW / 2 - 0.004 + 0.002), yTop - 0.015, (z0 + z1) / 2)); };
cab.add(box("FridgeLed", 0.2, 0.008, 0.05, light, 0, fzCeil - 0.004, zFront - 0.12));
{ // the touch display on the fridge's right wall (68 x 120 mm), 854 to 974 mm up, 140 mm behind the door edge
  const panel = mesh("InnerPanelFace", flipV(new THREE.PlaneGeometry(0.068, 0.12)), panelMat, xIn - 0.001, 0.914, zFront - 0.14);
  panel.rotation.y = -Math.PI / 2;
  cab.add(panel);
}
// the Fresh Room: a clear tray under the fridge ceiling (976 to 1107 mm), on rails, with a frosted front rim. It stays in:
// the manual's "Handle and care" doesn't list it
{
  const tw = 0.486, z0 = zDuct + 0.004, z1 = frontFridge, td = z1 - z0, tz = (z0 + z1) / 2, y0 = sFresh;
  cab.add(box("FreshRoomFloor", tw, 0.004, td, binMat, 0, y0 + 0.002, tz));
  for (const sx of [-1, 1]) cab.add(box("FreshRoomSide", 0.004, 0.11, td, binMat, sx * (tw / 2 - 0.002), y0 + 0.055, tz));
  cab.add(box("FreshRoomBack", tw - 0.008, 0.08, 0.004, clearLite, 0, y0 + 0.04, z0 + 0.002));
  cab.add(box("FreshRoomFront", tw, 0.038, 0.004, clearLite, 0, y0 + 0.019, z1 - 0.002));
  cab.add(box("FreshRoomRim", tw, 0.01, 0.008, frosted, 0, y0 + 0.043, z1 - 0.004));
  cab.add(box("FreshRoomRail", tw + 0.01, 0.012, 0.01, railGrey, 0, 1.101, z1 - 0.02));
  for (const sx of [-1, 1]) cab.add(box("FreshRoomRunner", 0.02, 0.008, td, railGrey, sx * (tw / 2 + 0.012), 1.101, tz));
}

// the parts that come out (FridgeTrays): two glass shelves, the vegetable shelf and the Big Box, with their food
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
{ // the vegetable shelf: a clear plastic cover over the Big Box, hooked at the back wall, with its frosted low front
  const z0 = zIn + 0.002, z1 = frontFridge, w = inW - 0.014;
  trays.add(box("VegShelf", w, 0.006, z1 - 0.012 - z0, clearLite, 0, sCover - 0.003, (z0 + z1 - 0.012) / 2));
  trays.add(box("VegShelfFrontLow", w, 0.018, 0.012, frosted, 0, sCover - 0.008, z1 - 0.006));
  rails("VegShelfRail", sCover - 0.006, zIn, z1 - 0.01);
}
// the Big Box: one wide clear drawer, "Big Box" and three fruit icons printed on its front; it stops short of the
// compressor bay's step at the back
const bbW = 0.505, bbZ0 = zBack + bayD + 0.012 + 0.013, bbZ1 = frontBigBox, bbD = bbZ1 - bbZ0, bbZ = (bbZ0 + bbZ1) / 2;
{
  const hh = bbTop - bbBottom;
  trays.add(box("FzBoxFloor", bbW, 0.004, bbD, binMat, 0, bbBottom + 0.002, bbZ));
  trays.add(box("FzBoxBack", bbW, hh, 0.004, binMat, 0, bbBottom + hh / 2, bbZ0 + 0.002));
  trays.add(box("FzBoxL", 0.004, hh, bbD, binMat, -bbW / 2 + 0.002, bbBottom + hh / 2, bbZ));
  trays.add(box("FzBoxR", 0.004, hh, bbD, binMat, bbW / 2 - 0.002, bbBottom + hh / 2, bbZ));
  trays.add(box("FzBoxFront", bbW, hh - 0.012, 0.004, clearLite, 0, bbBottom + (hh - 0.012) / 2, bbZ1 - 0.002));
  trays.add(box("FzBoxRim", bbW + 0.01, 0.012, 0.008, frosted, 0, bbTop - 0.006, bbZ1 - 0.002));
  trays.add(box("FzBoxFootRim", bbW, 0.01, 0.008, frosted, 0, bbBottom + 0.005, bbZ1 - 0.002));
  trays.add(mesh("PrintBigBox", flipV(new THREE.PlaneGeometry(0.17, 0.10)), bigBoxPrint, 0, 0.208, bbZ1 + 0.0003));
}

// ── groceries (stock_lg.mjs, food.mjs): vegetarian South Indian food, eggs, juices, water and soft drinks ──
const stock = LGStock({ T3: `${TEX}/lg_glt3426`, TF: `${TEX}/food`, BR: `${TEX}/brands`, BRT: `${TEX}/brands/small` });
const bbFloor = bbBottom + 0.004;
// the vegetable shelf plays the LG 343 L's third shelf: bananas, grapes, curd, apples, oranges and lemons
stock.shelves(trays, {
  // stock_lg.mjs stands the food 3 mm over the height it is given (the LG 343 L's glass centres): give it each top less 2.5 mm
  zIn1: zIn, inW, inD: frontFridge - zIn, s1: s1 - 0.0025, s2: s2 - 0.0025, s3: sCover - 0.0025, fz: bbFloor, fit: true,
  vz0: bbZ0 + 0.02, vk: 0.8 * (bbD - 0.04) / 0.454,
  shelfB: { hw: inW / 2 - 0.03, z0: zDuct + 0.02, z1: frontFridge - 0.015 },
  drawerB: { hw: bbW / 2 - 0.014, z0: bbZ0 + 0.02, z1: bbZ1 - 0.008, y0: bbFloor },
  drawerCeil: sCover - 0.006 - 0.01 - bbFloor, // the heap stays 1 cm under the vegetable shelf
});
// the Fresh Room: butter, cheese and curd cups (the LG 343 L's Fresh 0 Zone set)
stock.fresh0(cab, { y: sFresh + 0.004, z: (zDuct + 0.004 + frontFridge) / 2 + 0.03 });

// ── freezer inside: the plastic shelf, the ice maker's housing at the front left, a grille along the floor's front ──
{
  const z0 = zDuct + 0.002, z1 = frontFreezer, w = inW - 0.014;
  cab.add(box("FreezerShelf", w, 0.006, z1 - 0.009 - z0, clearLite, 0, fzShelfTop - 0.003, (z0 + z1 - 0.009) / 2));
  cab.add(box("FreezerShelfRim", w, 0.022, 0.009, frosted, 0, fzShelfTop - 0.009, z1 - 0.0045));
  rails("FreezerShelfRail", fzShelfTop - 0.006, zIn, z1 - 0.01);
}
// the Movable Ice Maker: a white housing 185 mm wide and 180 mm tall (photo), its front 4.5 cm behind the freezer
// door's lower bin; the ice tray (with its grip) and the clear bin under it slide out of it together
const icX = -0.1275, icW = 0.185, icH = 0.18, icD = 0.22, icZ1 = frontFreezer - 0.035, icZ0 = icZ1 - icD;
{
  const y0 = fzFloor, zc = (icZ0 + icZ1) / 2;
  cab.add(box("IceHousingTop", icW, 0.008, icD, iceWhite, icX, y0 + icH - 0.004, zc));
  for (const sx of [-1, 1]) cab.add(box("IceHousingSide", 0.005, icH - 0.008, icD, iceWhite, icX + sx * (icW / 2 - 0.0025), y0 + (icH - 0.008) / 2, zc));
  cab.add(box("IceHousingBack", icW - 0.01, icH - 0.008, 0.005, iceWhite, icX, y0 + (icH - 0.008) / 2, icZ0 + 0.0025));
  for (let i = 0; i < 9; i++) cab.add(box("FloorGrille", 0.026, 0.003, 0.005, grille, -0.11 + i * 0.0385, fzFloor + 0.0015, frontFreezer - 0.012));
}
const ice = group("IceMaker", icX, fzFloor, 0);
{
  const iw = icW - 0.012, zf = icZ1;
  // the tray: its white front plate with the grip, and the tray behind it
  ice.add(box("IceTrayFace", iw, 0.058, 0.006, iceWhite, 0, 0.142, zf - 0.003));
  ice.add(box("IceTrayGrip", 0.075, 0.012, 0.008, iceGrip, 0, 0.152, zf + 0.004));
  ice.add(box("IceTrayBody", iw - 0.004, 0.03, icD - 0.03, iceWhite, 0, 0.145, zf - 0.006 - (icD - 0.03) / 2));
  // the clear bin under it, with "Movable Ice Maker" on its front, and the ice in it
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
// the inside of a door bin: its x range between the end walls, and the middle of a depth dep in front of the liner
const inside = (dep) => [-pw / 2 - bw / 2 + 0.004, -pw / 2 + bw / 2 - 0.004, -(linerFace + dep / 2)];
// the twin bin's partition, a third of the way from the hinge end (the open-door photo), and the eggs in its cups:
// three in the small bin and six in the long one, evenly spaced in each
const partX = -pw / 2 + bw / 2 - bw / 3;
const xHinge = -pw / 2 + bw / 2 - 0.004, xFree = -pw / 2 - bw / 2 + 0.004;   // the end walls' inner faces
const EGGS = [...[-1, 0, 1].map((k) => (xHinge + partX + 0.002) / 2 + k * 0.053), ...[0, 1, 2, 3, 4, 5].map((i) => (partX - 0.002 + xFree) / 2 + (i - 2.5) * 0.054)];
function door(name, y0, h, frontMat) {
  const pivot = group(name, W / 2, y0, zFront);
  const top = name === "FridgeDoor" ? 0.014 : 0;              // the silver strip across the top of the fridge door
  const geo = flipV(new THREE.BoxGeometry(pw, h - top, doorT));
  pivot.add(mesh(name + "Panel", geo, [doorEdge, doorEdge, doorEdge, doorEdge, frontMat, liner], -pw / 2, (h - top) / 2, doorT / 2));
  if (top) {
    pivot.add(mesh(name + "Strip", new THREE.BoxGeometry(pw, top, doorT), [doorEdge, doorEdge, trimSilver, doorEdge, trimSilver, liner], -pw / 2, h - top / 2, doorT / 2));
    // SAMSUNG in dark ink on the strip, 30 mm wide, in the middle (Samsung's front photo)
    pivot.add(mesh("SamsungMarkDecal", flipV(new THREE.PlaneGeometry(0.03, 0.03 * 74 / 480)), markM, -pw / 2, h - top / 2, doorT + 0.0006));
  } else {
    // the model's own BEE label, 125 x 226 mm, 56 mm in from the hinge edge and 76 mm down (Sangeetha's front photo)
    pivot.add(mesh("BeeLabelDecal", flipV(new THREE.PlaneGeometry(0.125, 0.226)), labelM, -0.056 - 0.0625, h - 0.076 - 0.113, doorT + 0.0006));
  }
  // recessed handle: a vertical pocket in the free edge, 232 mm long (freezer 1279 to 1511 mm, fridge from 23 mm below the top)
  const rh = 0.232;
  const ry = name === "FreezerDoor" ? 0.247 : h - 0.023 - rh / 2;
  const pocket = mesh(name + "Handle", new THREE.CapsuleGeometry(0.006, rh - 0.012, 4, 8), recess, -pw + 0.0045, ry, doorT * 0.45);
  pocket.scale.z = 0.026 / 0.012;                             // a slot with round ends, 12 mm wide and 26 mm deep
  pivot.add(pocket);
  // inside: gasket, liner and bins standing on the liner's face
  pivot.add(box(name + "Gasket", pw - 0.018, h - 0.018, 0.008, gasket, -pw / 2, h / 2, -0.004));
  pivot.add(box(name + "Liner", pw - 0.07, h - 0.07, 0.012, liner, -pw / 2, h / 2, -0.01));
  BINS[name].forEach((b, i) => {
    const zc = -linerFace - b.d / 2, zl = -linerFace - b.d;
    pivot.add(box(`${name}Bin${i}Floor`, bw, 0.004, b.d, binMat, -pw / 2, b.f + 0.002, zc));
    pivot.add(box(`${name}Bin${i}Lip`, bw, b.h - 0.004, 0.004, binMat, -pw / 2, b.f + (b.h - 0.004) / 2, zl + 0.002));
    pivot.add(box(`${name}Bin${i}Rim`, bw, 0.007, 0.005, frosted, -pw / 2, b.f + b.h - 0.0035, zl + 0.0025));
    for (const sx of [-1, 1]) pivot.add(box(`${name}Bin${i}End`, 0.004, b.h, b.d, binMat, -pw / 2 + sx * (bw / 2 - 0.002), b.f + b.h / 2, zc));
    if (b.twin) {   // the twin bin: a partition, and the egg cups under its floor, one under each egg
      pivot.add(box(`${name}Bin${i}Part`, 0.004, b.h, b.d, binMat, partX, b.f + b.h / 2, zc));
      for (const x of EGGS) { const c = mesh("EggCup", new THREE.SphereGeometry(0.02, 12, 4, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), binMat, x, b.f, zc); c.scale.y = 0.7; pivot.add(c); }
    }
  });
  return pivot;
}
const fridgeDoor = door("FridgeDoor", doorBottom, fridgeH, fridgeFront);
const freezerDoor = door("FreezerDoor", yFreezer, freezerH, freezerFront);
{ // what sits in the door bins, so it swings out with the door
  const F = BINS.FridgeDoor, Z = BINS.FreezerDoor;
  // the eggs stand 4 mm down into the floor, in their cups; a quarter turn each keeps them inside the 6 cm bin
  stock.doorFridge(fridgeDoor, { fit: true, eggY: F[1].f, eggX: EGGS, eggDY: 0, eggTurn: Math.PI / 2, jarY: F[2].f, botY: F[0].f, canY: null, deps: { egg: F[1].d, jar: F[2].d, bottle: F[0].d }, inside });
  stock.doorFreezer(freezerDoor, { fit: true, b1: Z[1].f, b2: Z[0].f, dep: Math.min(Z[0].d, Z[1].d), inside });
}
root.add(fridgeDoor, freezerDoor);

const parts = productParts(PRODUCTS, ID);
const clips = stateClips(root, parts);
saveZones(PRODUCTS, ID, root, parts);
// Grain (BENCHMARK.md section 10). Samsung names the colour Luxe Black and the door a "Flat Door", and publishes no
// material. Its photos show fine horizontal hairlines on the doors and a fine speckled paint on the sides, so: the soft
// hairline across the doors, the soft peel on the sides and top (ESTIMATED, see NOTES.md). The prints (BEE label,
// SAMSUNG mark) are their own decals with no grain.
await exportGLB(root, clips, OUT, {
  FreezerFront: `${TEX}/samsung/door_freezer.jpg`,
  FridgeFront: `${TEX}/samsung/door_fridge.jpg`,
  LabelBEE: `${TEX}/samsung/label.png`,
  SamsungMark: `${TEX}/samsung/mark.png`,
  InnerPanel: `${TEX}/samsung/inner_panel.png`,
  BackFreezer: `${TEX}/samsung/back_freezer.png`,
  BackFridge: `${TEX}/samsung/back_fridge.png`,
  BigBoxPrint: `${TEX}/samsung/bigbox_print.png`,
  IceMakerPrint: `${TEX}/samsung/icemaker_print.png`,
  SidePaint: `${TEX}/samsung/side_paint.jpg`,
  Rear: `${TEX}/samsung/rear.jpg`,
  Bay: `${TEX}/samsung/bay.jpg`,
  ...stock.textures(),
}, { dir: `${TEX}/grain`, materials: {
  FreezerFront: { type: "hairline_soft", dir: "h" },
  FridgeFront: { type: "hairline_soft", dir: "h" },
  SidePaint: { type: "peel_soft" }, TopSkin: { type: "peel_soft" },
} });
